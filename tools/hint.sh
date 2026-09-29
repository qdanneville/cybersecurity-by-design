#!/usr/bin/env bash
set -euo pipefail
M="$1"; DIR="docs/hints/$M"
STATE=".hint-state/$M"; mkdir -p "$(dirname "$STATE")"
N=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
FILE="$DIR/$N.md"
if [ -f "$FILE" ]; then echo "$N" > "$STATE"; cat "$FILE";
else echo "Plus d'indices. Regarde solutions/$M.patch si tu es bloqué."; fi
