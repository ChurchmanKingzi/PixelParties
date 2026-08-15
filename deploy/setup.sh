#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Einmalige Grundeinrichtung des netcup-Servers.
#
#  Ablauf auf der frischen Ubuntu-24.04-Maschine, als root:
#
#     apt-get update && apt-get install -y git
#     git clone <REPO-URL> /opt/pixelparties
#     cd /opt/pixelparties
#     ADMIN_USER=al bash deploy/setup.sh
#
#  Das Skript ist wiederholbar: Ein zweiter Lauf ändert nur, was
#  noch fehlt. Es bricht ab, bevor es SSH absichert, falls kein
#  öffentlicher Schlüssel hinterlegt ist — sonst würdest du dich
#  im letzten Schritt selbst aussperren.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-al}"
APP_DIR="/opt/pixelparties"
SVC_USER="pixelparties"

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte als root ausführen."
[ -f "$APP_DIR/server.js" ] || die "$APP_DIR/server.js fehlt — erst das Repo dorthin klonen."

# ── 1. Systemaktualisierung und Grundpakete ───────────────────
log "System aktualisieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

log "Grundpakete installieren"
apt-get install -y -qq \
	curl ca-certificates gnupg git ufw fail2ban \
	unattended-upgrades apt-transport-https \
	debian-keyring debian-archive-keyring

# ── 2. Node.js 22 LTS ─────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
	log "Node.js 22 LTS installieren"
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
	apt-get install -y -qq nodejs
fi
log "Node-Version: $(node --version)"

# ── 3. Caddy ──────────────────────────────────────────────────
if ! command -v caddy >/dev/null 2>&1; then
	log "Caddy installieren"
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
fi

# ── 4. Dienstbenutzer ─────────────────────────────────────────
# Kein Login, keine Shell. Dieser Benutzer führt nur den Node-Prozess
# aus; wer ihn übernimmt, bekommt damit kein brauchbares Konto.
if ! id "$SVC_USER" >/dev/null 2>&1; then
	log "Dienstbenutzer $SVC_USER anlegen"
	useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SVC_USER"
fi

log "Verzeichnisse und Rechte setzen"
mkdir -p "$APP_DIR/data" "$APP_DIR/public/dist" \
	"$APP_DIR/uploads/avatars" "$APP_DIR/uploads/cardbacks" \
	/var/log/caddy
chown -R "$SVC_USER:$SVC_USER" "$APP_DIR"
chown -R caddy:caddy /var/log/caddy
# .env enthält Zugangsdaten (Turso-Token, Brevo-Schlüssel) und geht
# niemanden außer dem Dienstbenutzer etwas an.
[ -f "$APP_DIR/.env" ] && chmod 600 "$APP_DIR/.env"

# ── 5. Anmeldebenutzer für dich ───────────────────────────────
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
	log "Anmeldebenutzer $ADMIN_USER anlegen"
	adduser --disabled-password --gecos "" "$ADMIN_USER"
	usermod -aG sudo "$ADMIN_USER"
fi

# Das Konto hat bewusst kein Passwort — angemeldet wird nur per Schlüssel.
# Damit wuerde `sudo` aber nach einem Passwort fragen, das es nicht gibt,
# und du kaemst an nichts mehr heran. Deshalb sudo ohne Passwortabfrage.
# Der Schutz liegt beim Schluessel und seiner Passphrase.
# Wenn du das lieber klassisch willst: `passwd $ADMIN_USER` setzen und
# danach /etc/sudoers.d/90-$ADMIN_USER loeschen.
if ! passwd -S "$ADMIN_USER" 2>/dev/null | awk '{exit ($2=="P")?0:1}'; then
	log "sudo ohne Passwortabfrage für $ADMIN_USER einrichten"
	printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$ADMIN_USER" > "/etc/sudoers.d/90-$ADMIN_USER"
	chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
	visudo -c -q || die "sudoers-Datei fehlerhaft — nicht abmelden, erst reparieren."
fi

# git meldet sonst "detected dubious ownership": das Repo gehoert dem
# Dienstbenutzer, aufgerufen wird es teils als root.
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

ADMIN_HOME="$(getent passwd "$ADMIN_USER" | cut -d: -f6)"
ADMIN_KEYS="$ADMIN_HOME/.ssh/authorized_keys"

# Schlüssel von root übernehmen, falls netcup ihn dort hinterlegt hat.
if [ -s /root/.ssh/authorized_keys ] && [ ! -s "$ADMIN_KEYS" ]; then
	log "SSH-Schlüssel von root nach $ADMIN_USER übernehmen"
	install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$ADMIN_HOME/.ssh"
	install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" \
		/root/.ssh/authorized_keys "$ADMIN_KEYS"
fi

# ── 6. Firewall ───────────────────────────────────────────────
log "Firewall einrichten"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
# Port 3000 steht bewusst NICHT offen: server.js lauscht per HOST auf
# 127.0.0.1, erreichbar ist er nur durch Caddy hindurch.

# ── 7. Automatische Sicherheitsupdates ────────────────────────
log "Unbeaufsichtigte Sicherheitsupdates aktivieren"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── 8. systemd-Units ──────────────────────────────────────────
log "systemd-Units installieren"
for unit in pixelparties.slice pixelparties-training.slice pixelparties.service; do
	ln -sf "$APP_DIR/deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable pixelparties.service >/dev/null

# ── 9. Caddy-Konfiguration ────────────────────────────────────
log "Caddyfile verlinken"
if [ -e /etc/caddy/Caddyfile ] && [ ! -L /etc/caddy/Caddyfile ]; then
	mv /etc/caddy/Caddyfile /etc/caddy/Caddyfile.original
fi
ln -sf "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
if grep -q 'DEINE-MAILADRESSE' "$APP_DIR/deploy/Caddyfile"; then
	printf '\n\033[1;33m! deploy/Caddyfile: E-Mail-Adresse ist noch der Platzhalter.\033[0m\n'
	printf '\033[1;33m  Erst eintragen, dann "systemctl reload caddy".\033[0m\n'
fi

# ── 10. SSH absichern — zuletzt und nur mit Netz ──────────────
if [ -s "$ADMIN_KEYS" ]; then
	log "SSH absichern (nur Schlüssel, kein root-Login)"
	cat > /etc/ssh/sshd_config.d/60-pixelparties.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $ADMIN_USER
EOF
	sshd -t && systemctl reload ssh
	printf '\n\033[1;33m! Bevor du diese Sitzung schließt: In einem ZWEITEN\033[0m\n'
	printf '\033[1;33m  Terminal "ssh %s@<IP>" testen. Erst wenn das klappt,\033[0m\n' "$ADMIN_USER"
	printf '\033[1;33m  ist der Weg zurück entbehrlich.\033[0m\n'
else
	printf '\n\033[1;33m! SSH NICHT abgesichert: %s ist leer.\033[0m\n' "$ADMIN_KEYS"
	printf '\033[1;33m  Erst den öffentlichen Schlüssel dort eintragen, dann\033[0m\n'
	printf '\033[1;33m  dieses Skript erneut laufen lassen.\033[0m\n'
fi

log "Grundeinrichtung fertig."
cat <<EOF

Nächste Schritte:
  1. $APP_DIR/.env anlegen (Vorlage: .env.example, Abschnitt PRODUKTION)
  2. deploy/Caddyfile: E-Mail-Adresse eintragen
  3. A-Record für neu.pixelpartiestcg.com auf diesen Server zeigen lassen
  4. sudo bash deploy/deploy.sh

EOF
