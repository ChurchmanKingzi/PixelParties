# MoniaBot

Discord-Bot für den Pixel-Parties-Server. Einrichtung, Befehle und Betrieb: **[../docs/MONIABOT.md](../docs/MONIABOT.md)**.

```bash
npm install          # Abhängigkeiten
cp .env.example .env # Token und Server-ID eintragen
npm start            # Bot starten
npm test             # Tests (ohne Discord-Anmeldung)
node index.js --invite   # Einladungs-Adresse mit den nötigen Rechten
```

Aufbau: `index.js` (Anmeldung) → `lib/context.js` (Befehlsverteilung) → `features/*.js` (je ein Funktionsbereich);
reine Logik mit Tests in `lib/`. Kartenbilder entstehen mit dem Renderer des Spiels (`lib/card-renderer.js`).
