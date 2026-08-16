#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Trainingslauf in der gedrosselten Slice starten, losgelöst von der
#  SSH-Sitzung. Nimmt einen BELIEBIGEN Befehl, optional mit
#  vorangestellten KEY=WERT-Umgebungsvariablen:
#
#    sudo bash deploy/train-run.sh node scripts/train-iterative.js "Frozen Mischief"
#    sudo bash deploy/train-run.sh node scripts/train-iterative.js "Bone Rush" resume
#    sudo bash deploy/train-run.sh PP_MCTS_BUDGET_MS=8000 node scripts/train-iterative.js "Big Stomp"
#    sudo bash deploy/train-run.sh node scripts/train-all-decks.js
#
#  Warum überhaupt ein Wrapper:
#  · Der Lauf hängt in pixelparties-training.slice und kann dem
#    Spielserver weder den Speicher noch alle Kerne wegnehmen.
#  · Er läuft unter systemd statt in deiner Shell. Verbindung trennen ist
#    gefahrlos, und der Lauf bleibt überwach- und abbrechbar.
#
#  ZUR HEAP-GRENZE — 4096 IST KEIN ZUFALLSWERT:
#  In v389 stand hier 3072, um unter die Slice-Grenze zu passen. Das war
#  ein Fehler mit Folgen für die Ergebnisse: _engine.js leitet die
#  Schwellen seines Heap-Wächters aus dem TATSÄCHLICHEN V8-Limit ab
#  (0.60/0.72/0.80 x Limit). Reißt eine davon, wird MCTS für diesen Zug
#  ABGEBROCHEN — die CPU spielt den Zug ohne Suche. Ein kleineres Limit
#  heißt also: früher abbrechen, schwächer pilotieren, schlechtere
#  Trainingsdaten. Läufe auf verschiedenen Heap-Größen sind NICHT
#  vergleichbar. 4096 entspricht der Vorgabe in train-iterative.js und
#  damit dem lokalen Lauf; die Slice ist entsprechend angehoben.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/pixelparties"
SVC_USER="pixelparties"
UNIT="pptrain-$(date +%Y%m%d-%H%M%S)"

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }
[ $# -gt 0 ] || { sed -n '3,23p' "$0"; exit 1; }

# Führende KEY=WERT-Argumente als Umgebung abgreifen, der Rest ist der Befehl.
ENV_ARGS=()
while [ $# -gt 0 ] && [[ "$1" =~ ^[A-Z_][A-Z0-9_]*= ]]; do
	ENV_ARGS+=(--setenv="$1")
	shift
done
[ $# -gt 0 ] || { echo "Kein Befehl angegeben." >&2; exit 1; }

# Heap-Vorgabe nur setzen, wenn der Aufrufer sie nicht selbst mitgibt.
_has_heap=0
if [ ${#ENV_ARGS[@]} -gt 0 ]; then
	for _e in "${ENV_ARGS[@]}"; do
		case "$_e" in --setenv=PP_TRAIN_HEAP_MAX=*) _has_heap=1 ;; esac
	done
fi
[ "$_has_heap" -eq 1 ] || ENV_ARGS+=(--setenv=PP_TRAIN_HEAP_MAX=4096)

# systemd-run braucht einen absoluten Pfad zum Programm.
CMD="$(command -v "$1")" || { echo "Nicht gefunden: $1" >&2; exit 1; }
shift

systemd-run \
	--unit="$UNIT" \
	--slice=pixelparties-training.slice \
	--uid="$SVC_USER" --gid="$SVC_USER" \
	--working-directory="$APP_DIR" \
	--setenv=NODE_ENV=production \
	--setenv=PP_NO_WATCH=1 \
	"${ENV_ARGS[@]}" \
	--property=StandardOutput=journal \
	--property=StandardError=journal \
	--collect \
	"$CMD" "$@"

cat <<EOF

Lauf gestartet: $UNIT

  Mitlesen:   journalctl -fu $UNIT
  Auslastung: systemctl status pixelparties-training.slice --no-pager
  Abbrechen:  systemctl stop $UNIT

EOF
