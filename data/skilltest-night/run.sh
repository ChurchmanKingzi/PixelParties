#!/usr/bin/env bash
# Über-Nacht-Lauf des Skill-Test-Trainings: startet den Trainer neu, falls er vor Ablauf der Frist endet (Absturz).
# Beenden: Datei data/skilltest-night/STOP anlegen, dann den Trainer mit SIGTERM beenden (er speichert sauber).
cd /home/user/PixelParties || exit 1
export PP_ST_PROFILE=/home/user/PixelParties/data/skilltest-night/profile.json
DEADLINE_FILE=data/skilltest-night/DEADLINE
[ -f "$DEADLINE_FILE" ] || echo $(( $(date +%s) + ${1:-21} * 3600 )) > "$DEADLINE_FILE"
DEADLINE=$(cat "$DEADLINE_FILE")
while [ "$(date +%s)" -lt "$DEADLINE" ] && [ ! -f data/skilltest-night/STOP ]; do
  REMAIN_MIN=$(( (DEADLINE - $(date +%s)) / 60 ))
  [ "$REMAIN_MIN" -ge 1 ] || break
  echo "[run.sh] Start Trainer ($(date -u +%FT%TZ)), noch $REMAIN_MIN min" >> data/skilltest-night/train.log
  nice -n 5 node --max-old-space-size=4096 scripts/skilltest-train.js --forever --minutes "$REMAIN_MIN" --workers 4 --seats 2-8 --max-turns 1200 \
    --bench-every 2500 --bench-games 80 --mcts-bench-every 10000 --mcts-bench-games 30 --milestone-every 5000 \
    --save-every 100 --checkpoint-minutes 60 --progress 300 >> data/skilltest-night/train.log 2>&1
  echo "[run.sh] Trainer beendet (Exit $?) $(date -u +%FT%TZ)" >> data/skilltest-night/train.log
  sleep 5
done
echo "[run.sh] Lauf beendet $(date -u +%FT%TZ)" >> data/skilltest-night/train.log
