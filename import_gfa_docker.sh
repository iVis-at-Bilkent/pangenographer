#!/usr/bin/env bash
# Run import_gfa_to_neo4j.py inside a one-shot Docker container.
# Builds the image, runs the import, then removes both the container and the
# image so nothing is left on the host after the import completes.
#
# Usage:
#   ./import_gfa_docker.sh <input.gfa> [importer flags...]
#
# Examples:
#   ./import_gfa_docker.sh sample_1.gfa --clear
#   ./import_gfa_docker.sh sample_1.gfa --uri bolt://host.docker.internal:7687 --password 12345678
#
# Neo4j connectivity:
#   - Defaults to bolt://host.docker.internal:7687 so the container reaches
#     Neo4j running on the host machine on Mac, Windows, and Linux
#     (host-gateway mapping handles Linux).
#   - Override with `--uri` if Neo4j lives elsewhere.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <input.gfa> [importer flags...]" >&2
  exit 1
fi

INPUT="$1"
shift

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT_ABS="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"
INPUT_NAME="$(basename "$INPUT_ABS")"
IMAGE_TAG="pangenographer-gfa-importer:local"

cleanup() {
  docker image rm -f "$IMAGE_TAG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$IMAGE_TAG" -f "$SCRIPT_DIR/Dockerfile.importer" "$SCRIPT_DIR"

# Default --uri only if the caller didn't pass one.
has_uri=false
for arg in "$@"; do
  if [[ "$arg" == "--uri" || "$arg" == "--uri="* ]]; then
    has_uri=true
    break
  fi
done

URI_ARGS=()
if ! $has_uri; then
  URI_ARGS=(--uri "bolt://host.docker.internal:7687")
fi

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$INPUT_ABS:/data/$INPUT_NAME:ro" \
  "$IMAGE_TAG" \
  "/data/$INPUT_NAME" "${URI_ARGS[@]}" "$@"
