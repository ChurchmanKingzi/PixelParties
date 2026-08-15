#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Trainingslauf starten — in der gedrosselten Slice und losgelöst
#  von der SSH-Sitzung.
#
#     sudo bash deploy/train-run.sh 500
#     sudo bash deploy/train-run.sh 500 PP_TRAIN_HEAPSNAP=1
#
#  Das Gegenstück zu train.bat, mit zwei Unterschieden:
#
#  · Der Lauf hängt in pixelparties-training.slice und kann dem
#    Spielserver damit weder den Speicher noch alle vier Kerne
#    wegnehmen.
#  · Er läuft über systemd, nicht in deiner Shell. Du kannst die
#    Verbindung trennen und morgen nachsehen — anders als bei
#    nohup bleibt der Lauf sauber überwachbar und abbrechbar.
#
#  ZUR HEAP-GRENZE: Lokal gibst du 6144 MB. Hier sind es 3072, weil
#  sich Spiel und Training 8 GB teilen. Wenn deine Sammelläufe die
#  6 GB tatsächlich brauchen, ist nicht dieses Skript das Problem,
#  sondern der Tarif — dann innerhalb der G12-Reihe hochstufen.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/pixelparties"
SVC_USER="pixelparties"
GAMES="${1:-50}"
shift || true
HEAP_MB="${PP_TRAIN_HEAP_MB:-3072}"
UNIT="pptrain-$(date +%Y%m%d-%H%M%S)"

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }

# Zusätzliche KEY=WERT-Argumente durchreichen (z.B. PP_TRAIN_HEAPSNAP=1).
EXTRA_ENV=()
for kv in "$@"; do
	EXTRA_ENV+=(--setenv="$kv")
done

systemd-run \
	--unit="$UNIT" \
	--slice=pixelparties-training.slice \
	--uid="$SVC_USER" --gid="$SVC_USER" \
	--working-directory="$APP_DIR" \
	--setenv=PP_TRAIN=1 \
	--setenv=PP_TRAIN_GAMES="$GAMES" \
	--setenv=PP_NO_WATCH=1 \
	--setenv=NODE_ENV=production \
	"${EXTRA_ENV[@]}" \
	--property=StandardOutput=journal \
	--property=StandardError=journal \
	--collect \
	/usr/bin/node "--max-old-space-size=$HEAP_MB" --expose-gc server.js

cat <<EOF

Lauf gestartet: $UNIT   ($GAMES Partien, Heap-Grenze ${HEAP_MB} MB)

  Mitlesen:   journalctl -fu $UNIT
  Zustand:    systemctl status $UNIT
  Abbrechen:  systemctl stop $UNIT

EOF
