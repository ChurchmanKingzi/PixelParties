#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Ausrollen einer neuen Version.
#
#     cd /opt/pixelparties && sudo bash deploy/deploy.sh
#
#  Holt den aktuellen Stand, baut das Frontend, startet den Dienst
#  neu und prüft, ob er wirklich antwortet. Tut er das nicht, wird
#  der vorherige Commit automatisch wiederhergestellt — ein
#  fehlgeschlagenes Deployment lässt das Spiel also nicht unten.
#
#  ZWEI DINGE, DIE ES NICHT TUT, UND ZWAR ABSICHTLICH:
#  · Es fasst .env nicht an (steht nicht im Repo, gehört dem Server).
#  · Es migriert keine Datenbank. Schemaänderungen macht server.js
#    beim Hochfahren selbst über initDatabase().
# ══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/pixelparties"
SVC_USER="pixelparties"
SERVICE="pixelparties.service"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_TRIES=30

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen."
cd "$APP_DIR" || die "$APP_DIR nicht gefunden."

as_svc() { sudo -H -u "$SVC_USER" "$@"; }

PREVIOUS="$(as_svc git rev-parse HEAD)"
log "Aktueller Stand: $(as_svc git log -1 --format='%h %s')"

# ── 1. Neuen Stand holen ──────────────────────────────────────
log "Änderungen holen"
as_svc git fetch --quiet origin
BRANCH="$(as_svc git rev-parse --abbrev-ref HEAD)"
as_svc git reset --hard --quiet "origin/$BRANCH"
log "Neuer Stand: $(as_svc git log -1 --format='%h %s')"

if [ "$PREVIOUS" = "$(as_svc git rev-parse HEAD)" ]; then
	warn "Kein neuer Commit — es wird trotzdem neu gebaut und gestartet."
fi

# ── 2. Abhängigkeiten und Frontend-Build ──────────────────────
# npm ci statt npm install: installiert exakt das, was in der
# package-lock.json steht, und wirft node_modules vorher weg. Damit
# ist der Server bitgleich mit deinem lokalen Stand.
log "Abhängigkeiten installieren"
as_svc npm ci --omit=dev --no-audit --no-fund

log "Frontend bauen"
as_svc npm run build

# ── 3. Neustart ───────────────────────────────────────────────
# Achtung, bekannte Folge: Die Sitzungen liegen in einer Map im
# Arbeitsspeicher (sessions in server.js). Jeder Neustart meldet
# alle angemeldeten Spieler ab. Das war auf Render genauso — aber
# es ist ein Grund, nicht mitten am Abend auszurollen.
log "Dienst neu starten"
# Die Unit-Dateien liegen als Symlink im Repo und koennen sich mit jedem
# Ausrollen aendern; ohne daemon-reload benutzt systemd die alte Fassung
# aus dem Speicher weiter und warnt nur beilaeufig.
systemctl daemon-reload
systemctl restart "$SERVICE"

# Gleiches gilt fuer das Caddyfile: auch versioniert, auch nicht von
# selbst neu eingelesen.
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
	systemctl reload caddy || warn "Caddy-Reload fehlgeschlagen — bitte pruefen."
else
	warn "Caddyfile ist fehlerhaft — Caddy wurde NICHT neu geladen."
	warn "Pruefen mit: caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
fi

# ── 4. Gesundheitsprüfung ─────────────────────────────────────
log "Warten, bis der Server antwortet"
for i in $(seq 1 "$HEALTH_TRIES"); do
	if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL"; then
		printf '\033[1;32m✓ Server antwortet nach %ss.\033[0m\n' "$i"
		log "Fertig. Protokoll: journalctl -fu $SERVICE"
		exit 0
	fi
	sleep 1
done

# ── 5. Rückfall ───────────────────────────────────────────────
warn "Server antwortet nach ${HEALTH_TRIES}s nicht. Rückfall auf $PREVIOUS."
as_svc git reset --hard --quiet "$PREVIOUS"
as_svc npm ci --omit=dev --no-audit --no-fund
as_svc npm run build
systemctl restart "$SERVICE"

sleep 5
if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL"; then
	die "Rückfall erfolgreich — die alte Version läuft wieder. Ursache im Protokoll suchen: journalctl -u $SERVICE -n 100"
else
	die "Auch der Rückfall antwortet nicht. Sofort nachsehen: journalctl -u $SERVICE -n 100"
fi
