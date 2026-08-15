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
#  ZUR HEAP-GRENZE: train-iterative.js startet seine Kindprozesse mit
#  PP_TRAIN_HEAP_MAX, Vorgabe im Skript 4096 MB. Das liegt ÜBER der
#  Speichergrenze der Slice — der Kernel würde das Kind töten, bevor V8
#  sein eigenes Limit erreicht, und du bekämst einen wortlosen Abbruch
#  statt eines JS-Fehlers mit Stacktrace. Deshalb setzt dieses Skript
#  3072, sofern du nichts anderes angibst.
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
[ "$_has_heap" -eq 1 ] || ENV_ARGS+=(--setenv=PP_TRAIN_HEAP_MAX=3072)

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
