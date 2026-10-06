#!/usr/bin/env bash
# Seeded 2-Spieler-Regressionslauf. Nutzung:
#   scripts/regress/run-2p.sh <ausgabedatei> [spiele] [seed]
# Vergleich: diff <(cut -c1-200 a.jsonl) <(cut -c1-200 b.jsonl)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:?Ausgabedatei fehlt}"
GAMES="${2:-6}"
SEED="${3:-1}"
rm -f "$OUT" "${OUT}.train.jsonl" "${OUT}.train.crash.json" 2>/dev/null || true
PP_REGRESS_SEED="$SEED" PP_REGRESS_OUT="$OUT" PP_TRAIN=1 PP_TRAIN_GAMES="$GAMES" \
PP_MCTS_BUDGET_MS=600000 PP_MCTS_PULLS=4 PP_TRAIN_HORIZON=1 PP_DEMO_RECORD=0 NODE_ENV=production \
PP_TRAIN_OUT="${OUT}.train.jsonl" \
  node --max-old-space-size=4096 -r ./scripts/regress/seed-preload.js server.js 2>&1 | grep -E "^\[train\]" || true
cat "$OUT"
