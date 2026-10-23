# Pixel-Emoji-Schrift

Jedes Emoji und jedes Text-Symbol, das das Spiel anzeigt (🔥 ⚔️ ✓ ★ → …), kommt aus einer eigenen **Pixelart-Schrift** (`public/fonts/pp-pixel-emoji.woff2`,
Familie `PP Pixel Emoji`), nicht aus der Emoji-Schrift des Betriebssystems. Sie ist ueber `unicode-range` unter die Spiel-Schriften gelegt
(`Pixel Intv`, `Press Start 2P`, `Orbitron`, `Rajdhani`, `Roboto`, `Orbit`) und fuer Bedienelemente ohne eigene Schrift; der Block steht in `public/style.css`
zwischen `PIXEL-EMOJI:BEGIN` und `PIXEL-EMOJI:END` und wird vom Bau-Skript geschrieben.

Wer ein **neues** Emoji in Text, Titel, Beschriftung oder Kartenskript einbaut, muss die Schrift neu bauen:

    node scripts/pixel-emoji/scan.js          # sammelt alle Zeichen aus dem Quelltext (Kommentare ausgenommen) → zeichen.json
    node scripts/pixel-emoji/extract.js       # rastert sie (Sprites des Spiels, sonst System-Emoji → 16x16) → glyphen.json
    python3 scripts/pixel-emoji/build_font.py # baut woff2 + CSS-Block  (pip install fonttools brotli)
    node scripts/pixel-emoji/pruefen.js       # Gegenprobe: nichts fehlt

* `extract.js` braucht Playwright und startet den Server auf Port 3992 (React-UMD per `PE_REACT_DIR` oder aus dem Netz).
* Handgezeichnetes hat Vorrang: Sprites in `PP_PX_ICONS`/`PP_PX_ZEICHEN` (`public/app-shared.jsx`) werden uebernommen; eigene Raster koennen in
  `handarbeit.json` (Schluessel = Zeichen, Wert = `{ "pal": {"A":"#rrggbb"}, "z": ["..A..", …] }` bzw. `{ "mono": true, "z": [...] }`) stehen und ersetzen die Automatik.
* Einfarbige Symbole folgen der Textfarbe (`color`); Farb-Emojis haben feste Farben.
* Aufbau: COLRv0/CPAL (Chrome, Edge, Firefox) plus OpenType-SVG (Safari); ohne Farbschrift-Unterstuetzung erscheint eine einfarbige Silhouette.
* Nicht abgedeckt: Emojis, die Spielerinnen und Spieler im Chat tippen und die im Quelltext nicht vorkommen — sie bleiben System-Emoji.
