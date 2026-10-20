#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Einmalige Einrichtung von MoniaBot (Discord-Bot) auf dem Server.
#
#     cd /opt/pixelparties && sudo bash deploy/moniabot-setup.sh
#
#  Was es tut:
#   1. Abhängigkeiten des Bots installieren (bot/node_modules)
#   2. BOT_SECRET in /opt/pixelparties/.env erzeugen, falls noch keins da ist
#   3. bot/.env aus der Vorlage anlegen (dort trägst DU Token und Server-ID ein)
#   4. systemd-Dienst `moniabot` einrichten und aktivieren
#   5. Den Spielserver neu starten, damit er BOT_SECRET kennt
#
#  Es startet den Bot NICHT, solange DISCORD_TOKEN in bot/.env fehlt — das
#  tust du danach mit:  sudo systemctl start moniabot
#  Wiederholbar: ein zweiter Lauf ändert nur, was noch fehlt.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/pixelparties"
BOT_DIR="$APP_DIR/bot"
SVC_USER="pixelparties"

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen."
[ -f "$BOT_DIR/index.js" ] || die "$BOT_DIR/index.js fehlt — erst 'sudo bash deploy/deploy.sh' ausführen (holt den neuen Stand)."
command -v node >/dev/null 2>&1 || die "Node.js fehlt — erst deploy/setup.sh ausführen."
as_svc() { sudo -H -u "$SVC_USER" "$@"; }

# ── 1. Abhängigkeiten ─────────────────────────────────────────
log "Abhängigkeiten des Bots installieren"
mkdir -p "$BOT_DIR/data"
chown -R "$SVC_USER:$SVC_USER" "$BOT_DIR"
as_svc npm ci --omit=dev --no-audit --no-fund --prefix "$BOT_DIR"

# ── 2. Gemeinsames Geheimnis ──────────────────────────────────
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
if grep -qE '^BOT_SECRET=.+' "$ENV_FILE"; then
	log "BOT_SECRET ist in $ENV_FILE schon gesetzt — unverändert gelassen."
else
	log "BOT_SECRET erzeugen und in $ENV_FILE eintragen"
	sed -i '/^BOT_SECRET=/d' "$ENV_FILE"
	printf '\n# MoniaBot: gemeinsames Geheimnis zwischen Spiel und Bot (siehe docs/MONIABOT.md)\nBOT_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
fi
chown "$SVC_USER:$SVC_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── 3. Zugangsdaten des Bots ──────────────────────────────────
if [ ! -f "$BOT_DIR/.env" ]; then
	log "bot/.env aus der Vorlage anlegen"
	cp "$BOT_DIR/.env.example" "$BOT_DIR/.env"
fi
chown "$SVC_USER:$SVC_USER" "$BOT_DIR/.env"
chmod 600 "$BOT_DIR/.env"

# ── 4. systemd ────────────────────────────────────────────────
log "Dienst einrichten"
ln -sf "$APP_DIR/deploy/systemd/moniabot.service" /etc/systemd/system/moniabot.service
systemctl daemon-reload
systemctl enable moniabot.service >/dev/null

# ── 4b. Caddy: Bot-Routen von außen sperren ───────────────────
# setup.sh kopiert das Caddyfile nur, wenn es fehlt; spätere Änderungen im Repo erreichen /etc/caddy/Caddyfile nie von selbst.
# Hier wird die Sperre einmalig nachgetragen (mit Sicherung und Prüfung). Der Schutz durch BOT_SECRET und den Proxy-Header-Check
# im Spiel besteht ohnehin — das hier ist der zweite Riegel.
CADDYFILE=/etc/caddy/Caddyfile
if [ -f "$CADDYFILE" ] && ! grep -q '@botapi' "$CADDYFILE"; then
	if grep -q 'reverse_proxy 127.0.0.1:3000' "$CADDYFILE"; then
		log "Caddyfile: /api/bot von außen sperren"
		cp "$CADDYFILE" "$CADDYFILE.vor-moniabot"
		awk '/reverse_proxy 127\.0\.0\.1:3000/ && !done { print "\t@botapi path /api/bot /api/bot/*"; print "\trespond @botapi 404"; done=1 } { print }' "$CADDYFILE.vor-moniabot" > "$CADDYFILE"
		if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
			systemctl reload caddy || warn "Caddy-Reload fehlgeschlagen — bitte prüfen."
		else
			cp "$CADDYFILE.vor-moniabot" "$CADDYFILE"
			warn "Caddyfile-Änderung ungültig — zurückgesetzt. Nicht schlimm: der Schutz durch BOT_SECRET gilt trotzdem."
		fi
	else
		warn "In $CADDYFILE steht keine Zeile 'reverse_proxy 127.0.0.1:3000' — Sperre nicht eingetragen (Schutz durch BOT_SECRET gilt trotzdem)."
	fi
fi

# ── 5. Spielserver neu starten (damit BOT_SECRET gilt) ────────
# Achtung: das meldet alle angemeldeten Spieler ab (Sitzungen liegen im Arbeitsspeicher).
if systemctl is-active --quiet pixelparties.service; then
	warn "Der Spielserver wird jetzt neu gestartet (alle Spieler werden abgemeldet). Abbrechen mit Strg+C — 5 s Zeit."
	sleep 5
	systemctl restart pixelparties.service
fi

log "Fertig. Als Nächstes (siehe docs/MONIABOT.md, Schritt 4):"
cat <<EOT

  1. sudo nano $BOT_DIR/.env      → DISCORD_TOKEN und GUILD_ID eintragen (Kanal-IDs optional)
  2. sudo systemctl start moniabot
  3. sudo journalctl -fu moniabot  → es muss "angemeldet als MoniaBot" erscheinen (Strg+C beendet die Anzeige)

EOT
