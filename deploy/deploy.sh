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
#  DREI DINGE, DIE ES NICHT TUT, UND ZWAR ABSICHTLICH:
#  · Es fasst .env nicht an (steht nicht im Repo, gehört dem Server).
#  · Es migriert keine Datenbank. Schemaänderungen macht server.js
#    beim Hochfahren selbst über initDatabase().
#  · Es überschreibt data/cpu-profiles/ nicht mit dem Git-Stand.
#    Siehe nächster Abschnitt.
#
#  ── WEM GEHÖREN WELCHE DATEIEN ────────────────────────────────
#  Für fast alles ist Git die Wahrheit: `git reset --hard` wirft
#  lokale Änderungen weg, und das ist richtig so.
#
#  Für data/cpu-profiles/ gilt das Gegenteil. Diese Dateien ENTSTEHEN
#  auf dem Server — Trainingsläufe schreiben die Gewichte, A/B-Läufe
#  das `abResult`, aus dem der Loader die Quarantäne ableitet. Ein
#  Reset auf den Git-Stand hat dort schon zweimal Messergebnisse
#  gelöscht: die abResult-Felder der 42er-Grundmessung waren nach
#  einem Ausrollen spurlos weg, weil niemand sie eingecheckt hatte.
#
#  Deshalb werden diese Pfade um den Reset herum gesichert und danach
#  zurückgelegt. Der Server gewinnt. Die Kehrseite: eine absichtliche
#  Profiländerung, die du LOKAL committest, erreicht den Server nicht
#  mehr von selbst. Dafür gibt es den Schalter:
#
#     sudo PP_DEPLOY_PROFILES=git bash deploy/deploy.sh
#
#  Damit gewinnt einmalig der Git-Stand. Zusätzlich landet vor jedem
#  Reset ein Schnappschuss in /var/backups/pixelparties/ — die letzten
#  SNAP_KEEP Stände bleiben liegen, falls doch etwas schiefgeht.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/pixelparties"
SVC_USER="pixelparties"
SERVICE="pixelparties.service"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_TRIES=30

# Pfade (relativ zu APP_DIR), bei denen der Server die Wahrheit ist.
# Nur versionierte, zur Laufzeit beschriebene Verzeichnisse gehören
# hier hinein — was ohnehin in der .gitignore steht (data/training/,
# data/demo-games/, …), fasst `git reset` gar nicht erst an.
BEWAHREN=("data/cpu-profiles")
SNAP_DIR="/var/backups/pixelparties"
SNAP_KEEP=10

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen."
cd "$APP_DIR" || die "$APP_DIR nicht gefunden."

as_svc() { sudo -H -u "$SVC_USER" "$@"; }

# ── Schutz der servereigenen Pfade ────────────────────────────
# Der Schnappschuss geht bewusst NACH /var/backups und nicht nach /tmp:
# er soll ein Deployment überleben, das mittendrin abbricht, und im
# Zweifel auch einen Neustart der Maschine.
SNAP=""

schnappschuss() {
        [ "${PP_DEPLOY_PROFILES:-server}" = "git" ] && return 0
        SNAP="$SNAP_DIR/$(date +%Y-%m-%d_%H%M%S)"
        local etwas=0 p
        for p in "${BEWAHREN[@]}"; do
                [ -e "$p" ] || continue
                mkdir -p "$SNAP/$(dirname "$p")"
                cp -a "$p" "$SNAP/$(dirname "$p")/"
                etwas=1
        done
        if [ "$etwas" -eq 1 ]; then
                log "Servereigene Dateien gesichert: $SNAP"
        else
                SNAP=""
        fi
}

zuruecklegen() {
        [ -n "$SNAP" ] || return 0
        local p abweichend=0
        for p in "${BEWAHREN[@]}"; do
                [ -e "$SNAP/$p" ] || continue
                # Vergleich VOR dem Zurücklegen: unterscheidet sich der
                # Git-Stand vom Serverstand, ist das eine Meldung wert —
                # dann liegt im Repo eine Fassung, die hier nie greift.
                if [ -e "$p" ] && ! diff -rq "$p" "$SNAP/$p" >/dev/null 2>&1; then
                        abweichend=1
                fi
                rm -rf "$p"
                mkdir -p "$(dirname "$p")"
                cp -a "$SNAP/$p" "$(dirname "$p")/"
                chown -R "$SVC_USER":"$SVC_USER" "$p"
        done
        log "Servereigene Dateien zurückgelegt (Server gewinnt)."
        if [ "$abweichend" -eq 1 ]; then
                warn "Der Git-Stand von ${BEWAHREN[*]} weicht vom Serverstand ab und wurde verworfen."
                warn "Soll der Git-Stand gelten:  sudo PP_DEPLOY_PROFILES=git bash deploy/deploy.sh"
        fi
}

# Jeder Reset im Skript läuft über diese Funktion — auch der Rückfall
# unten. Sonst wäre ein fehlgeschlagenes Deployment ausgerechnet der
# Fall, in dem die Messergebnisse doch verlorengehen.
reset_bewahrend() {
        schnappschuss
        as_svc git reset --hard --quiet "$1"
        zuruecklegen
}

alte_schnappschuesse_aufraeumen() {
        [ -d "$SNAP_DIR" ] || return 0
        local ueberzaehlig
        ueberzaehlig="$(ls -1d "$SNAP_DIR"/*/ 2>/dev/null | sort | head -n -"$SNAP_KEEP" || true)"
        [ -n "$ueberzaehlig" ] || return 0
        printf '%s\n' "$ueberzaehlig" | xargs -r rm -rf
}

mkdir -p "$SNAP_DIR"
chmod 700 "$SNAP_DIR"

if [ "${PP_DEPLOY_PROFILES:-server}" = "git" ]; then
        warn "PP_DEPLOY_PROFILES=git — ${BEWAHREN[*]} wird MIT dem Git-Stand überschrieben."
        warn "Vorhandene Trainings- und Messergebnisse auf dem Server gehen dabei verloren."
fi

PREVIOUS="$(as_svc git rev-parse HEAD)"
log "Aktueller Stand: $(as_svc git log -1 --format='%h %s')"

# ── 1. Neuen Stand holen ──────────────────────────────────────
log "Änderungen holen"
as_svc git fetch --quiet origin
BRANCH="$(as_svc git rev-parse --abbrev-ref HEAD)"
reset_bewahrend "origin/$BRANCH"
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
                alte_schnappschuesse_aufraeumen
                log "Fertig. Protokoll: journalctl -fu $SERVICE"
                exit 0
        fi
        sleep 1
done

# ── 5. Rückfall ───────────────────────────────────────────────
warn "Server antwortet nach ${HEALTH_TRIES}s nicht. Rückfall auf $PREVIOUS."
reset_bewahrend "$PREVIOUS"
as_svc npm ci --omit=dev --no-audit --no-fund
as_svc npm run build
systemctl restart "$SERVICE"

sleep 5
if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL"; then
        die "Rückfall erfolgreich — die alte Version läuft wieder. Ursache im Protokoll suchen: journalctl -u $SERVICE -n 100"
else
        die "Auch der Rückfall antwortet nicht. Sofort nachsehen: journalctl -u $SERVICE -n 100"
fi
