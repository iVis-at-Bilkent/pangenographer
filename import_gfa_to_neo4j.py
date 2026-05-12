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
import csv
import os
import re
import sys
import threading
import time
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path
from typing import Any

try:
    from neo4j import GraphDatabase
except ImportError:
    print("The 'neo4j' package is required. Install it with:  pip install neo4j", file=sys.stderr)
    sys.exit(1)

try:
    import psutil  # type: ignore[import-untyped]
    _HAS_PSUTIL = True
except ImportError:
    psutil = None  # type: ignore[assignment]
    _HAS_PSUTIL = False


# ---------------------------------------------------------------------------
# Profiling: per-phase wall-clock + RSS, plus peak RSS across the whole run
# ---------------------------------------------------------------------------

def _fmt_bytes(b: int) -> str:
    if b <= 0:
        return "n/a"
    if b < 1024 ** 2:
        return f"{b / 1024:.1f} KB"
    if b < 1024 ** 3:
        return f"{b / 1024 ** 2:.1f} MB"
    return f"{b / 1024 ** 3:.2f} GB"


class Profiler:
    """Per-phase wall-clock + process RSS, with running peak RSS.

    Disabled by default — call `enable()` to start tracking. When disabled,
    `phase()` and `report()` are no-ops, and `rss()` returns 0.
    """

    def __init__(self) -> None:
        self.enabled = False
        self.phases: list[tuple[str, float, int, int, int]] = []
        self.peak_rss = 0
        self._proc: Any = None

    def enable(self) -> None:
        self.enabled = True
        if _HAS_PSUTIL:
            self._proc = psutil.Process(os.getpid())
        else:
            print(
                "Note: 'psutil' is not installed — RSS columns will show 'n/a'. "
                "Install with:  pip install psutil",
                file=sys.stderr,
            )

    def rss(self) -> int:
        if not self.enabled or self._proc is None:
            return 0
        try:
            r = int(self._proc.memory_info().rss)
        except Exception:
            return 0
        if r > self.peak_rss:
            self.peak_rss = r
        return r

    @contextmanager
    def phase(self, name: str):
        if not self.enabled:
            yield
            return
        rss_in = self.rss()
        t0 = time.time()
        try:
            yield
        finally:
            dt = time.time() - t0
            rss_out = self.rss()
            self.phases.append((name, dt, rss_in, rss_out, self.peak_rss))
            print(
                f"  [{name}] {dt:.2f}s   RSS {_fmt_bytes(rss_in)} -> {_fmt_bytes(rss_out)}"
                f"  (peak {_fmt_bytes(self.peak_rss)})"
            )

    def system_memory_line(self) -> str:
        if not self.enabled or not _HAS_PSUTIL:
            return ""
        vm = psutil.virtual_memory()
        return (
            f"System memory: total {_fmt_bytes(vm.total)}, "
            f"available {_fmt_bytes(vm.available)}, used {vm.percent:.1f}%"
        )

    def report(self) -> None:
        if not self.enabled or not self.phases:
            return
        print()
        print("=" * 86)
        print("Profiler summary")
        print("=" * 86)
        sm = self.system_memory_line()
        if sm:
            print(sm)
        print(f"{'Phase':<36} {'Time':>10} {'RSS in':>12} {'RSS out':>12} {'Peak':>12}")
        print("-" * 86)
        total_time = 0.0
        for name, dt, ri, ro, pk in self.phases:
            total_time += dt
            print(
                f"{name:<36} {dt:>9.2f}s "
                f"{_fmt_bytes(ri):>12} {_fmt_bytes(ro):>12} {_fmt_bytes(pk):>12}"
            )
        print("-" * 86)
        print(
            f"{'Total':<36} {total_time:>9.2f}s "
            f"{'':>12} {'':>12} {_fmt_bytes(self.peak_rss):>12}"
        )
        print("=" * 86)


PROF = Profiler()


# ---------------------------------------------------------------------------
# Resource recorder: background-thread sampler that writes a CSV with
# wall-clock time, RAM (process RSS + system memory used), and CPU usage.
# ---------------------------------------------------------------------------

class ResourceRecorder:
    """Sample resource usage from a background thread into a CSV.

    Columns:
        elapsed_seconds       wall-clock seconds since recording started
        rss_bytes             this process's resident set size
        system_used_bytes     system-wide memory used (psutil.virtual_memory)
        cpu_percent           process CPU% since the previous sample
        cpu_user_seconds      cumulative user-mode CPU time
        cpu_system_seconds    cumulative system-mode CPU time

    Tracks peak RSS across the whole run. No-ops when psutil is unavailable
    or `output_path` is None.
    """

    SAMPLE_INTERVAL_SEC = 0.5

    def __init__(self, output_path: Path | None) -> None:
        self.output_path = output_path
        self.interval = self.SAMPLE_INTERVAL_SEC
        self.peak_rss = 0
        self.sample_count = 0
        self.enabled = bool(_HAS_PSUTIL and output_path is not None)
        self._proc = psutil.Process(os.getpid()) if self.enabled else None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._fp = None
        self._writer = None
        self._t0: float | None = None

    def __enter__(self) -> "ResourceRecorder":
        if not self.enabled:
            return self
        assert self.output_path is not None and self._proc is not None
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self._fp = self.output_path.open("w", newline="")
        self._writer = csv.writer(self._fp)
        self._writer.writerow(
            [
                "elapsed_seconds",
                "rss_bytes",
                "system_used_bytes",
                "cpu_percent",
                "cpu_user_seconds",
                "cpu_system_seconds",
            ]
        )
        # Prime cpu_percent: the first call returns 0.0 because it needs a
        # baseline; subsequent calls return CPU% since the previous call.
        try:
            self._proc.cpu_percent(interval=None)
        except Exception:
            pass
        self._t0 = time.monotonic()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *exc: Any) -> None:
        if not self.enabled:
            return
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        if self._fp is not None:
            self._fp.close()

    def _run(self) -> None:
        assert self._proc is not None and self._writer is not None and self._fp is not None
        while True:
            elapsed = time.monotonic() - (self._t0 or time.monotonic())
            try:
                rss = int(self._proc.memory_info().rss)
                sys_used = int(psutil.virtual_memory().used)
                cpu_pct = float(self._proc.cpu_percent(interval=None))
                cpu_t = self._proc.cpu_times()
                cpu_user = float(cpu_t.user)
                cpu_sys = float(cpu_t.system)
            except Exception:
                rss = 0
                sys_used = 0
                cpu_pct = 0.0
                cpu_user = 0.0
                cpu_sys = 0.0
            self._writer.writerow(
                [
                    f"{elapsed:.3f}",
                    rss,
                    sys_used,
                    f"{cpu_pct:.2f}",
                    f"{cpu_user:.3f}",
                    f"{cpu_sys:.3f}",
                ]
            )
            try:
                self._fp.flush()
            except Exception:
                pass
            self.sample_count += 1
            if rss > self.peak_rss:
                self.peak_rss = rss
            if self._stop.wait(self.interval):
                break


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

def _estimate_record_bytes(item: dict[str, Any]) -> int:
    """Rough size estimate for one row when serialised over Bolt.
    Cheap heuristic — doesn't need to be precise, just proportional.
    """
    n = 32  # bookkeeping overhead per record
    for k, v in item.items():
        n += len(k) + 8
        if isinstance(v, str):
            n += len(v) + 4
        elif isinstance(v, (list, tuple)):
            n += 16
            for x in v:
                n += (len(x) + 4) if isinstance(x, str) else 16
        else:
            n += 16
    return n


# Keep each Bolt message comfortably under typical OS send-buffer / Neo4j
# transaction-memory limits. macOS's socket.sendall() returns OSError 22
# (EINVAL) for very large messages, so this also avoids that crash.
TARGET_BYTES_PER_BATCH = 20 * 1024 * 1024  # 20 MB


def _adaptive_batch_size(items: list[dict[str, Any]], requested: int, label: str) -> int:
    """Cap `requested` so each batch stays under TARGET_BYTES_PER_BATCH."""
    if not items:
        return requested
    sample = items[: min(500, len(items))]
    avg = max(1, sum(_estimate_record_bytes(x) for x in sample) // len(sample))
    safe = max(1, TARGET_BYTES_PER_BATCH // avg)
    effective = min(requested, safe)
    if effective < requested:
        print(
            f"    [{label}] adaptive batch size: {requested:,} -> {effective:,} "
            f"(~{avg:,} B/record, target {TARGET_BYTES_PER_BATCH // 1024 // 1024} MB/batch)"
        )
    return effective


def _run_batched(session, query: str, items: list[dict[str, Any]], batch_size: int, label: str) -> None:
    total = len(items)
    if total == 0:
        return
    effective_size = _adaptive_batch_size(items, batch_size, label)
    done = 0
    start = time.time()

    # Wrap each batch in a managed write transaction so the driver retries
    # on transient errors (connection drops, leader switches, etc.) instead of
    # killing the import. Using execute_write also ensures every batch is
    # committed before the next is sent, bounding the server-side memory.
    def _do_write(tx, _batch: list[dict[str, Any]]) -> None:
        tx.run(query, batch=_batch).consume()

    for i in range(0, total, effective_size):
        batch = items[i : i + effective_size]
        session.execute_write(_do_write, batch)
        done += len(batch)
        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        rss_str = ""
        if PROF.enabled:
            rss = PROF.rss()
            if rss > 0:
                rss_str = f"  RSS {_fmt_bytes(rss)}"
        print(f"    {label}: {done:,}/{total:,}  ({rate:,.0f}/s){rss_str}")


def clear_neo4j_database(uri: str, username: str, password: str) -> None:
    """DETACH DELETE every node in the database. Intentionally not wrapped in
    Profiler/ResourceRecorder so clearing time/RAM doesn't appear in import logs.

    Uses CALL { ... } IN TRANSACTIONS, which commits in chunks server-side
    instead of paying client round-trip latency per chunk like the old loop.
    """
    print("Clearing database...")
    start = time.time()
    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        with driver.session() as session:
            session.run(
                """
                MATCH (n)
                CALL { WITH n DETACH DELETE n }
                IN TRANSACTIONS OF 50000 ROWS
                """
            ).consume()
        print(f"    cleared in {time.time() - start:.1f}s")
    finally:
        driver.close()


def import_to_neo4j(
    data: dict[str, list[dict[str, Any]]],
    uri: str,
    username: str,
    password: str,
    batch_size: int,
) -> None:
    with PROF.phase("neo4j connect"):
        driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        with driver.session() as session:
            print("Ensuring indexes...")
            with PROF.phase("neo4j indexes"):
                session.run(
                    "CREATE INDEX segment_name_idx IF NOT EXISTS FOR (n:SEGMENT) ON (n.segmentName)"
                ).consume()

            # Nodes
            print(f"Importing {len(data['paths']):,} PATH nodes")
            with PROF.phase("import paths"):
                _run_batched(
                    session,
                    "UNWIND $batch AS row CREATE (p:PATH) SET p = row",
                    data["paths"],
                    batch_size,
                    "paths",
                )

            print(f"Importing {len(data['walks']):,} WALK nodes")
            with PROF.phase("import walks"):
                _run_batched(
                    session,
                    "UNWIND $batch AS row CREATE (w:WALK) SET w = row",
                    data["walks"],
                    batch_size,
                    "walks",
                )

            print(f"Importing {len(data['segments']):,} SEGMENT nodes")
            with PROF.phase("import segments"):
                _run_batched(
                    session,
                    "UNWIND $batch AS row CREATE (s:SEGMENT) SET s = row",
                    data["segments"],
                    batch_size,
                    "segments",
                )

            # Edges (MATCH by segmentName, which is indexed)
            print(f"Importing {len(data['links']):,} LINK edges")
            with PROF.phase("import links"):
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
            with PROF.phase("import jumps"):
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
            with PROF.phase("import containments"):
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
    parser.add_argument(
        "--profile",
        action="store_true",
        help="Print per-phase wall-clock timing and a summary table "
        "(adds RSS columns when psutil is installed). Off by default.",
    )
    parser.add_argument(
        "--resource-log",
        type=Path,
        default=None,
        help="Path to write a CSV recording resource usage over time "
        "(columns: elapsed_seconds, rss_bytes, system_used_bytes, "
        "cpu_percent, cpu_user_seconds, cpu_system_seconds). "
        "Off unless this flag is provided.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.input_file.exists():
        raise FileNotFoundError(f"Input file not found: {args.input_file}")
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be greater than 0")

    # Clear before any profiling/recording starts so the wipe doesn't show
    # up in the resource CSV or the per-phase summary.
    if args.clear:
        clear_neo4j_database(args.uri, args.username, args.password)

    t0 = time.time()

    if args.profile:
        PROF.enable()
        sm = PROF.system_memory_line()
        if sm:
            print(sm)

    resource_log_path: Path | None = args.resource_log
    recorder = ResourceRecorder(resource_log_path)
    if recorder.enabled:
        print(
            f"Recording resources every {recorder.interval:.2f}s -> {resource_log_path}"
        )
    elif resource_log_path is not None and not _HAS_PSUTIL:
        print(
            "Warning: --resource-log was requested but 'psutil' is not installed; "
            "no resource CSV will be written. Install with: pip install psutil",
            file=sys.stderr,
        )

    with recorder:
        run_import(args, t0)

    if args.profile:
        PROF.report()

    if recorder.enabled:
        print()
        print(
            f"Peak RSS: {_fmt_bytes(recorder.peak_rss)}  "
            f"(sampled {recorder.sample_count:,} points every {recorder.interval:.2f}s)"
        )
        print(f"Resource log:  {resource_log_path}")


def run_import(args: argparse.Namespace, t0: float) -> None:
    print(f"Parsing {args.input_file}...")
    with PROF.phase("parse GFA"):
        data = parse_gfa(args.input_file)
    print(
        "Parsed: "
        f"{len(data['segments']):,} segments, "
        f"{len(data['links']):,} links, "
        f"{len(data['jumps']):,} jumps, "
        f"{len(data['containments']):,} containments, "
        f"{len(data['paths']):,} paths ({len(data['pathEdges']):,} edges), "
        f"{len(data['walks']):,} walks ({len(data['walkEdges']):,} edges)"
    )

    print("Encoding names...")
    with PROF.phase("encode names"):
        encode_names_in_place(data)

    print("Aggregating path/walk memberships...")
    with PROF.phase("aggregate path/walk membership"):
        enrich_with_path_and_walk_membership(data)

    with PROF.phase("validate endpoints"):
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
    )

    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
