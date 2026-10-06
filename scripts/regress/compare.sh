#!/usr/bin/env bash
# Vergleicht das aktuelle Normalspiel (2 Spieler, CPU gegen CPU, geseedet)
# mit dem eingecheckten Referenzlauf `baseline-2p.jsonl` (Stand vor dem
# Skill-Test-Umbau, Commit ff42ef5). Exit 0 = identisch.
#
#   scripts/regress/compare.sh            # Seeds 7/11/23, je 3 Spiele (~8 min)
set -uo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for seed in 7 11 23; do
  scripts/regress/run-2p.sh "$TMP/s$seed.jsonl" 3 "$seed" >/dev/null 2>&1
done
cat "$TMP/s7.jsonl" "$TMP/s11.jsonl" "$TMP/s23.jsonl" > "$TMP/now.jsonl"
if diff -q scripts/regress/baseline-2p.jsonl "$TMP/now.jsonl" >/dev/null; then
  echo "✓ Normalspiel unverändert ($(wc -l < "$TMP/now.jsonl") Spiele identisch)"
  exit 0
fi
echo "✗ ABWEICHUNG gegenüber der Baseline:"
node -e '
const fs=require("fs");
const a=fs.readFileSync("scripts/regress/baseline-2p.jsonl","utf8").trim().split("\n").map(JSON.parse);
const b=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);
for (let i=0;i<Math.max(a.length,b.length);i++){
  const x=a[i],y=b[i];
  if(!x||!y){console.log("Spiel "+i+": fehlt");continue;}
  if(x.fp===y.fp)continue;
  let d=-1;for(let t=0;t<Math.max(x.turnFps.length,y.turnFps.length);t++){if(x.turnFps[t]!==y.turnFps[t]){d=t;break;}}
  console.log("Spiel "+i+": erste Abweichung bei Zug-Index "+d+" (Basis "+x.turnFps.length+" Züge, jetzt "+y.turnFps.length+")");
}' "$TMP/now.jsonl"
exit 1
