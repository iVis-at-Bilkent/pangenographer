#!/usr/bin/env python3
"""Import a GFA file into a Neo4j database.

Replicates the GFA import pipeline of the pangenographer web app
(src/app/visuall/file-reader.service.ts + neo4j-db.service.ts)

It writes the same graph shape the web app expects:
  - (:SEGMENT {segmentName, segmentData, segmentLength, pathNames[], walkSampleIdentifiers[], ...})
  - (:PATH   {pathName, segmentNames, overlaps})
  - (:WALK   {sampleIdentifier, haplotypeIndex, sequenceIdentifier, ...})
  - (:SEGMENT)-[:LINK        {source,target,sourceOrientation,targetOrientation,overlap,pathNames[],walkSampleIdentifiers[],...}]->(:SEGMENT)
  - (:SEGMENT)-[:JUMP        {...,distance,pathNames[],walkSampleIdentifiers[]}]->(:SEGMENT)
  - (:SEGMENT)-[:CONTAINMENT {...,pos,overlap,pathNames[],walkSampleIdentifiers[]}]->(:SEGMENT)

Name-like properties (segmentName, pathName, sampleIdentifier, and the
source/target fields on edges) are encoded the same way the web app
encodes them in Cypher identifiers, so the data loaded by this script is 
interchangeable with data loaded through the UI.

Usage:
    pip install neo4j
    python import_gfa_to_neo4j.py input.gfa
    python import_gfa_to_neo4j.py input.gfa --uri bolt://localhost:7687 --password 12345678
    python import_gfa_to_neo4j.py input.gfa --clear --batch-size 2000
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    from neo4j import GraphDatabase
except ImportError:
    print("The 'neo4j' package is required. Install it with:  pip install neo4j", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants mirrored from src/app/visuall/constants.ts
# ---------------------------------------------------------------------------

CQL_QUERY_CHANGE_MARKER = "CQL_QUERY_CHANGE_MARKER"
PATH_WALK_NAME_DISALLOWED_REGEX = re.compile(r"[.\-+()\[\]{} :,/\\'\"?!;=<>&|%@#^*~`´]")

DEFAULT_URI = "bolt://localhost:7687"
DEFAULT_USERNAME = "neo4j"
DEFAULT_PASSWORD = "12345678"
DEFAULT_BATCH_SIZE = 500000


# ---------------------------------------------------------------------------
# Name encoding (matches Neo4jDb.propertyName2CQL in neo4j-db.service.ts)
# ---------------------------------------------------------------------------

def encode_name(name: str) -> str:
    """Replace disallowed chars with MARKER<charCode>MARKER."""
    def repl(match: re.Match[str]) -> str:
        return f"{CQL_QUERY_CHANGE_MARKER}{ord(match.group(0))}{CQL_QUERY_CHANGE_MARKER}"
    return PATH_WALK_NAME_DISALLOWED_REGEX.sub(repl, name)


def convert_orientation(orientation: str) -> str:
    """'+' or '>' -> 'forward', everything else -> 'reverse'."""
    return "forward" if orientation in ("+", ">") else "reverse"


# ---------------------------------------------------------------------------
# GFA line parsers (mirrored from file-reader.service.ts)
# ---------------------------------------------------------------------------

def _optional_value(field: str) -> str:
    # GFA optional fields look like "TAG:TYPE:VALUE", so substring(5) drops the prefix.
    return field[5:] if len(field) > 5 else ""


def _optional_int(field: str, default: int = 0) -> int:
    # Parse an optional integer field; tolerate empty values like "LN:i:".
    raw = _optional_value(field).strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def parse_segment(line: str) -> dict[str, Any]:
    parts = [p.strip() for p in line.split("\t")]
    segment: dict[str, Any] = {
        "segmentName": parts[1],
        "id": parts[1],
        "elementId": "",
        "segmentData": parts[2] if len(parts) > 2 else "",
        "segmentLength": len(parts[2]) if len(parts) > 2 else 0,
    }
    for field in parts[3:]:
        field = field.strip()
        if field.startswith("LN"):
            segment["segmentLength"] = _optional_int(field)
        elif field.startswith("RC"):
            segment["readCount"] = _optional_int(field)
        elif field.startswith("FC"):
            segment["fragmentCount"] = _optional_int(field)
        elif field.startswith("KC"):
            segment["kmerCount"] = _optional_int(field)
        elif field.startswith("SH"):
            segment["Sha256Checksum"] = field
        elif field.startswith("UR"):
            segment["UriOrLocalSystemPath"] = field
        elif field.startswith("SN"):
            segment["stableSequenceName"] = _optional_value(field)
        elif field.startswith("SO"):
            segment["stableSequenceOffset"] = _optional_int(field)
        elif field.startswith("SR"):
            segment["stableSequenceRank"] = _optional_int(field)
    return segment


def parse_link(line: str) -> dict[str, Any]:
    parts = [p.strip() for p in line.split("\t")]
    link: dict[str, Any] = {
        "source": parts[1],
        "sourceOrientation": convert_orientation(parts[2]),
        "target": parts[3],
        "targetOrientation": convert_orientation(parts[4]),
        "overlap": parts[5] if len(parts) > 5 else "*",
    }
    for field in parts[6:]:
        field = field.strip()
        if field.startswith("MQ"):
            link["mappingQuality"] = _optional_int(field)
        elif field.startswith("NM"):
            link["numberOfMismatchesOrGaps"] = _optional_int(field)
        elif field.startswith("RC"):
            link["readCount"] = _optional_int(field)
        elif field.startswith("FC"):
            link["fragmentCount"] = _optional_int(field)
        elif field.startswith("KC"):
            link["kmerCount"] = _optional_int(field)
        elif field.startswith("ID"):
            link["edgeIdentifier"] = field
    return link


def parse_jump(line: str) -> dict[str, Any]:
    parts = [p.strip() for p in line.split("\t")]
    jump: dict[str, Any] = {
        "source": parts[1],
        "sourceOrientation": convert_orientation(parts[2]),
        "target": parts[3],
        "targetOrientation": convert_orientation(parts[4]),
        "distance": parts[5] if len(parts) > 5 else "*",
    }
    for field in parts[6:]:
        field = field.strip()
        if field.startswith("SC"):
            jump["indirectShortcutConnections"] = _optional_int(field)
    return jump


def parse_containment(line: str) -> dict[str, Any]:
    parts = [p.strip() for p in line.split("\t")]
    c: dict[str, Any] = {
        "source": parts[1],
        "sourceOrientation": convert_orientation(parts[2]),
        "target": parts[3],
        "targetOrientation": convert_orientation(parts[4]),
        "pos": int(parts[5]) if len(parts) > 5 else 0,
        "overlap": parts[6] if len(parts) > 6 else "*",
    }
    # Neo4jDb expects a non-empty overlap (sets "*" when missing).
    if not c["overlap"]:
        c["overlap"] = "*"
    for field in parts[7:]:
        field = field.strip()
        if field.startswith("RC"):
            c["readCount"] = _optional_int(field)
        elif field.startswith("NM"):
            c["numberOfMismatchesOrGaps"] = _optional_int(field)
        elif field.startswith("ID"):
            c["edgeIdentifier"] = field
    return c


def parse_path(line: str):
    parts = [p.strip() for p in line.split("\t")]
    path: dict[str, Any] = {
        "pathName": parts[1],
        "segmentNames": parts[2] if len(parts) > 2 else "",
        "overlaps": parts[3] if len(parts) > 3 else "",
    }
    # Segment names like "11+,12-,13+" (or ";" separated for jumps)
    segment_names = [s for s in re.split(r"[+,;\-]", path["segmentNames"]) if s]
    orientations = [
        convert_orientation(s)
        for s in re.split(r"[^+\-]", path["segmentNames"])
        if s
    ]
    path_segments = [
        {"pathName": path["pathName"], "segmentName": sn} for sn in segment_names
    ]
    path_edges: list[dict[str, Any]] = []
    for i in range(len(segment_names) - 1):
        path_edges.append(
            {
                "pathName": path["pathName"],
                "source": segment_names[i],
                "sourceOrientation": orientations[i] if i < len(orientations) else "forward",
                "target": segment_names[i + 1],
                "targetOrientation": orientations[i + 1] if i + 1 < len(orientations) else "forward",
            }
        )
    return path, path_segments, path_edges


def parse_walk(line: str):
    parts = [p.strip() for p in line.split("\t")]
    walk: dict[str, Any] = {
        "sampleIdentifier": parts[1],
        "haplotypeIndex": parts[2],
        "sequenceIdentifier": parts[3],
        "sequenceStart": parts[4],
        "sequenceEnd": parts[5],
        "walk": parts[6] if len(parts) > 6 else "",
    }
    # Walk strings like ">11<12>13"
    segment_names = [s for s in re.split(r"[<>]", walk["walk"]) if s]
    orientations = [
        convert_orientation(s)
        for s in re.split(r"[^<>]", walk["walk"])
        if s
    ]
    walk_segments = [
        {"segmentName": sn, "sampleIdentifier": walk["sampleIdentifier"]}
        for sn in segment_names
    ]
    walk_edges: list[dict[str, Any]] = []
    for i in range(len(segment_names) - 1):
        walk_edges.append(
            {
                "sampleIdentifier": walk["sampleIdentifier"],
                "source": segment_names[i],
                "sourceOrientation": orientations[i] if i < len(orientations) else "forward",
                "target": segment_names[i + 1],
                "targetOrientation": orientations[i + 1] if i + 1 < len(orientations) else "forward",
            }
        )
    return walk, walk_segments, walk_edges


# ---------------------------------------------------------------------------
# Full-file parse
# ---------------------------------------------------------------------------

def parse_gfa(file_path: Path) -> dict[str, list[dict[str, Any]]]:
    data: dict[str, list[dict[str, Any]]] = {
        "segments": [],
        "links": [],
        "jumps": [],
        "containments": [],
        "paths": [],
        "pathSegments": [],
        "pathEdges": [],
        "walks": [],
        "walkSegments": [],
        "walkEdges": [],
    }

    with file_path.open("r", encoding="utf-8") as f:
        for line_no, raw in enumerate(f, 1):
            line = raw.rstrip("\n").rstrip("\r")
            if not line or line[0] in ("#", "H"):
                continue
            try:
                tag = line[0]
                if tag == "S":
                    data["segments"].append(parse_segment(line))
                elif tag == "L":
                    data["links"].append(parse_link(line))
                elif tag == "J":
                    data["jumps"].append(parse_jump(line))
                elif tag == "C":
                    data["containments"].append(parse_containment(line))
                elif tag == "P":
                    p, ps, pe = parse_path(line)
                    data["paths"].append(p)
                    data["pathSegments"].extend(ps)
                    data["pathEdges"].extend(pe)
                elif tag == "W":
                    w, ws, we = parse_walk(line)
                    data["walks"].append(w)
                    data["walkSegments"].extend(ws)
                    data["walkEdges"].extend(we)
                else:
                    print(f"  (line {line_no}) unknown tag '{tag}', skipped", file=sys.stderr)
            except Exception as exc:
                print(f"  (line {line_no}) parse error: {exc}", file=sys.stderr)

    return data


# ---------------------------------------------------------------------------
# Encoding + aggregation
# ---------------------------------------------------------------------------

def encode_names_in_place(data: dict[str, list[dict[str, Any]]]) -> None:
    for s in data["segments"]:
        s["segmentName"] = encode_name(s["segmentName"])
        s["id"] = s["segmentName"]
    for p in data["paths"]:
        p["pathName"] = encode_name(p["pathName"])
    for w in data["walks"]:
        w["sampleIdentifier"] = encode_name(w["sampleIdentifier"])
    for lk in data["links"]:
        lk["source"] = encode_name(lk["source"])
        lk["target"] = encode_name(lk["target"])
    for j in data["jumps"]:
        j["source"] = encode_name(j["source"])
        j["target"] = encode_name(j["target"])
    for c in data["containments"]:
        c["source"] = encode_name(c["source"])
        c["target"] = encode_name(c["target"])
    for ps in data["pathSegments"]:
        ps["segmentName"] = encode_name(ps["segmentName"])
        ps["pathName"] = encode_name(ps["pathName"])
    for ws in data["walkSegments"]:
        ws["segmentName"] = encode_name(ws["segmentName"])
        ws["sampleIdentifier"] = encode_name(ws["sampleIdentifier"])
    for pe in data["pathEdges"]:
        pe["source"] = encode_name(pe["source"])
        pe["target"] = encode_name(pe["target"])
        pe["pathName"] = encode_name(pe["pathName"])
    for we in data["walkEdges"]:
        we["source"] = encode_name(we["source"])
        we["target"] = encode_name(we["target"])
        we["sampleIdentifier"] = encode_name(we["sampleIdentifier"])


EdgeKey = tuple[str, str, str, str]


def _edge_key(e: dict[str, Any]) -> EdgeKey:
    return (e["source"], e["target"], e["sourceOrientation"], e["targetOrientation"])


def enrich_with_path_and_walk_membership(data: dict[str, list[dict[str, Any]]]) -> None:
    """Attach pathNames / walkSampleIdentifiers to segments and edges.

    Mirrors the GFAData2CQL logic that aggregates these per segment and per
    edge so the web app can filter by path/walk membership without extra joins.
    """
    seg_paths: dict[str, list[str]] = defaultdict(list)
    for ps in data["pathSegments"]:
        seg_paths[ps["segmentName"]].append(ps["pathName"])

    seg_walks: dict[str, list[str]] = defaultdict(list)
    for ws in data["walkSegments"]:
        seg_walks[ws["segmentName"]].append(ws["sampleIdentifier"])

    edge_paths: dict[EdgeKey, list[str]] = defaultdict(list)
    for pe in data["pathEdges"]:
        edge_paths[_edge_key(pe)].append(pe["pathName"])

    edge_walks: dict[EdgeKey, list[str]] = defaultdict(list)
    for we in data["walkEdges"]:
        edge_walks[_edge_key(we)].append(we["sampleIdentifier"])

    for s in data["segments"]:
        s["pathNames"] = seg_paths.get(s["segmentName"], [])
        s["walkSampleIdentifiers"] = seg_walks.get(s["segmentName"], [])

    for lk in data["links"]:
        key = _edge_key(lk)
        lk["pathNames"] = edge_paths.get(key, [])
        lk["walkSampleIdentifiers"] = edge_walks.get(key, [])

    for j in data["jumps"]:
        key = _edge_key(j)
        j["pathNames"] = edge_paths.get(key, [])
        j["walkSampleIdentifiers"] = edge_walks.get(key, [])

    for c in data["containments"]:
        key = _edge_key(c)
        c["pathNames"] = edge_paths.get(key, [])
        c["walkSampleIdentifiers"] = edge_walks.get(key, [])


def validate_edge_endpoints(data: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    """Count edges whose source/target segment is not in `data['segments']`.

    Orphan endpoints are still imported (Neo4j creates a stub SEGMENT via MERGE),
    but they usually signal a truncated or split GFA file the user should know
    about. Returns per-edge-type counts of orphaned endpoints.
    """
    known: set[str] = {s["segmentName"] for s in data["segments"]}
    orphans = {"links": 0, "jumps": 0, "containments": 0}
    for kind in orphans:
        for edge in data[kind]:
            if edge["source"] not in known or edge["target"] not in known:
                orphans[kind] += 1
    return orphans


# ---------------------------------------------------------------------------
# Neo4j import
# ---------------------------------------------------------------------------

def _run_batched(session, query: str, items: list[dict[str, Any]], batch_size: int, label: str) -> None:
    total = len(items)
    if total == 0:
        return
    done = 0
    start = time.time()
    for i in range(0, total, batch_size):
        batch = items[i : i + batch_size]
        session.run(query, batch=batch).consume()
        done += len(batch)
        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        print(f"    {label}: {done:,}/{total:,}  ({rate:,.0f}/s)")


def import_to_neo4j(
    data: dict[str, list[dict[str, Any]]],
    uri: str,
    username: str,
    password: str,
    batch_size: int,
    clear: bool,
) -> None:
    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        with driver.session() as session:
            if clear:
                print("Clearing database...")
                while True:
                    summary = session.run(
                        "MATCH (n) WITH n LIMIT 50000 DETACH DELETE n RETURN count(n) AS c"
                    ).single()
                    if not summary or summary["c"] == 0:
                        break
                    print(f"    deleted {summary['c']:,} nodes")

            print("Ensuring indexes...")
            session.run(
                "CREATE INDEX segment_name_idx IF NOT EXISTS FOR (n:SEGMENT) ON (n.segmentName)"
            ).consume()

            # Nodes
            print(f"Importing {len(data['paths']):,} PATH nodes")
            _run_batched(
                session,
                "UNWIND $batch AS row CREATE (p:PATH) SET p = row",
                data["paths"],
                batch_size,
                "paths",
            )

            print(f"Importing {len(data['walks']):,} WALK nodes")
            _run_batched(
                session,
                "UNWIND $batch AS row CREATE (w:WALK) SET w = row",
                data["walks"],
                batch_size,
                "walks",
            )

            print(f"Importing {len(data['segments']):,} SEGMENT nodes")
            _run_batched(
                session,
                "UNWIND $batch AS row CREATE (s:SEGMENT) SET s = row",
                data["segments"],
                batch_size,
                "segments",
            )

            # Edges (MATCH by segmentName, which is indexed)
            print(f"Importing {len(data['links']):,} LINK edges")
            _run_batched(
                session,
                """
                UNWIND $batch AS row
                MATCH (src:SEGMENT {segmentName: row.source})
                MATCH (tgt:SEGMENT {segmentName: row.target})
                CREATE (src)-[e:LINK]->(tgt)
                SET e = row
                """,
                data["links"],
                batch_size,
                "links",
            )

            print(f"Importing {len(data['jumps']):,} JUMP edges")
            _run_batched(
                session,
                """
                UNWIND $batch AS row
                MATCH (src:SEGMENT {segmentName: row.source})
                MATCH (tgt:SEGMENT {segmentName: row.target})
                CREATE (src)-[e:JUMP]->(tgt)
                SET e = row
                """,
                data["jumps"],
                batch_size,
                "jumps",
            )

            print(f"Importing {len(data['containments']):,} CONTAINMENT edges")
            _run_batched(
                session,
                """
                UNWIND $batch AS row
                MATCH (src:SEGMENT {segmentName: row.source})
                MATCH (tgt:SEGMENT {segmentName: row.target})
                CREATE (src)-[e:CONTAINMENT]->(tgt)
                SET e = row
                """,
                data["containments"],
                batch_size,
                "containments",
            )
    finally:
        driver.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import a GFA file into a Neo4j database (same schema as the pangenographer web app)."
    )
    parser.add_argument("input_file", type=Path, help="Path to the GFA file")
    parser.add_argument("--uri", default=DEFAULT_URI, help=f"Neo4j Bolt URI (default: {DEFAULT_URI})")
    parser.add_argument("--username", default=DEFAULT_USERNAME, help=f"Neo4j username (default: {DEFAULT_USERNAME})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Neo4j password")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Rows per UNWIND batch (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="DETACH DELETE all existing nodes before importing",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.input_file.exists():
        raise FileNotFoundError(f"Input file not found: {args.input_file}")
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be greater than 0")

    t0 = time.time()

    print(f"Parsing {args.input_file}...")
    data = parse_gfa(args.input_file)
    print(
        "Parsed: "
        f"{len(data['segments']):,} segments, "
        f"{len(data['links']):,} links, "
        f"{len(data['jumps']):,} jumps, "
        f"{len(data['containments']):,} containments, "
        f"{len(data['paths']):,} paths ({len(data['pathEdges']):,} edges), "
        f"{len(data['walks']):,} walks ({len(data['walkEdges']):,} edges) "
        f"in {time.time() - t0:.1f}s"
    )

    print("Encoding names and aggregating path/walk memberships...")
    encode_names_in_place(data)
    enrich_with_path_and_walk_membership(data)

    orphans = validate_edge_endpoints(data)
    total_orphans = sum(orphans.values())
    if total_orphans:
        print(
            f"WARNING: {total_orphans:,} edges reference segments not defined in this file "
            f"(links={orphans['links']:,}, jumps={orphans['jumps']:,}, containments={orphans['containments']:,}). "
            "These endpoints will be created as stub SEGMENT nodes."
        )

    print(f"Connecting to Neo4j at {args.uri}")
    import_to_neo4j(
        data=data,
        uri=args.uri,
        username=args.username,
        password=args.password,
        batch_size=args.batch_size,
        clear=args.clear,
    )

    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
