#!/usr/bin/env bash
set -euo pipefail
ok(){ printf "\033[32m✓ %s\033[0m\n" "$1"; }
ko(){ printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=1; }
FAIL=0
command -v docker >/dev/null && ok "docker présent" || ko "docker manquant"
command -v curl >/dev/null && ok "curl présent" || ko "curl manquant"
command -v jq >/dev/null && ok "jq présent" || ko "jq manquant (brew install jq / apt install jq)"
docker info >/dev/null 2>&1 && ok "docker actif" || ko "docker daemon arrêté"
node -v 2>/dev/null | grep -qE 'v(2[2-9]|[3-9][0-9])' && ok "node >= 22" || ko "node >= 22 requis"
# Available RAM (not total; architecture §5). Linux: MemAvailable via free.
# macOS: free + inactive + speculative + purgeable pages ≈ what the OS can hand out.
if command -v free >/dev/null; then
  FREE_MB=$(free -m | awk '/^Mem:/{print $7}')
else
  PS=$(vm_stat)
  PGSIZE=$(echo "$PS" | sed -n 's/.*page size of \([0-9]*\) bytes.*/\1/p'); PGSIZE=${PGSIZE:-4096}
  pages(){ echo "$PS" | awk -v k="$1" 'index($0,k){gsub(/\./,"",$NF); print $NF+0}'; }
  FREE_MB=$(( ( $(pages "Pages free:") + $(pages "Pages inactive:") \
    + $(pages "Pages speculative:") + $(pages "Pages purgeable:") ) * PGSIZE / 1024 / 1024 ))
fi
[ "${FREE_MB:-0}" -ge 3000 ] && ok "RAM libre ${FREE_MB} Mo" || ko "RAM libre ${FREE_MB} Mo (<3 Go, 16 Go conseillés)"
for p in 3000 5432 6379; do
  (lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1) && ko "port $p occupé" || ok "port $p libre"
done
exit $FAIL
