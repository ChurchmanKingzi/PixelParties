# Hinweise für Agenten in diesem Repository

## Bugfixes: Fehlerbeschreibung für den Discord-Kanal (MoniaBot)

Der Bot postet nach jedem Deploy automatisch die Karten, deren Effekt-Skript (`cards/effects/*.js`) korrigiert wurde, in den Bugfix-Kanal.
**Wer einen Bug behebt, beschreibt ihn dafür in der Commit-Nachricht** – pro betroffener Karte (oder gemeinsamem Baustein `_…`) eine Zeile:

```
Bugfix-Note: <Kartenname oder _baustein> | <was genau schiefgelaufen ist, auf Englisch, ein bis zwei Sätze>
```

Beispiele:

```
Bugfix-Note: Fireball | Damage was dealt twice when the target had a shield.
Bugfix-Note: _alice-shared | Summons no longer stay on the board after their owner leaves.
```

* Schreibe es so, dass Spielerinnen und Spieler es verstehen (Auswirkung im Spiel, keine Code-Details); höchstens ca. 220 Zeichen.
* Bei einem Pull-Request mit mehreren Commits oder Squash-Merge müssen die Zeilen in der Nachricht stehen, die auf `main` landet.
* **Neue Karten, die noch nicht live sind:** Wer eine komplett neue Karte umsetzt und danach nachbessert (Troubleshooting vor dem Livegang), schreibt dafür **keine** `Bugfix-Note` – der Bot zeigt die Karte im Neue-Karten-Feed, nicht im Bugfix-Kanal (er ignoriert Karten, die seit dem zuletzt gemeldeten Stand neu in `data/cards.json` stehen, auch mit Note). Eine `Bugfix-Note` gehört nur zu Karten, die bereits live sind.
* **Balancing ist kein Bugfix:** Ändert sich der Eintrag einer Karte in `data/cards.json` (Effekttext, HP, Kosten …), zählt das als Balancing-Änderung
  und erscheint nur in den Patchnotes – auch wenn dabei das Skript angepasst wurde. Wurde dabei zusätzlich ein echter Fehler behoben
  (z. B. Skript passte nicht zum Kartentext), schreibe eine `Bugfix-Note` für diese Karte; dann erscheint sie auch im Bugfix-Kanal.
* Ohne `Bugfix-Note` erscheint die Karte trotzdem (erkannt am geänderten Skript), nur ohne Erklärung.

## Grafik-Regel: Jede Animation und jedes Highlight ist Pixelart

Alles, was neu gezeichnet oder animiert wird (Karten-Flüge, Effekte, Zielmarkierungen, Highlights, Symbole), muss **Pixelart** sein – kein weicher Look:

* **Emojis und Text-Symbole** (🔥 ✓ ★ → …) kommen aus der Pixel-Emoji-Schrift (`public/fonts/pp-pixel-emoji.woff2`), nicht aus der System-Schrift. Wer ein **neues** Emoji in Text, Titel, Beschriftung oder Kartenskript verwendet, baut sie neu: `node scripts/pixel-emoji/scan.js && node scripts/pixel-emoji/extract.js && python3 scripts/pixel-emoji/build_font.py` (Details: `scripts/pixel-emoji/README.md`). `npm test` schlägt fehl, solange ein Zeichen fehlt.
* **Keine** Weichzeichner-Schatten und -Scheine (`box-shadow`/`drop-shadow` mit Unschärfe), **keine** Drehungen oder stufenlosen Skalierungen von Kartenbildern, **keine** Glyphen/Emojis als Symbole, **keine** weichen Verläufe oder Alpha-Überblendungen.
* Stattdessen: harte Rahmen aus gestapelten `box-shadow: 0 0 0 Npx …`-Ringen, feste Farbpalette, Dithering (2×2-/Bayer-Raster) statt Alpha, Symbole als kleine Sprites (SVG mit `shape-rendering: crispEdges` bzw. Canvas, `image-rendering: pixelated`, ganzzahlig vergrößert), Bewegung in ganzen Pixeln im Bildtakt (~30 Bilder/s, `steps()`), Blinken per `steps(1)` statt weichem Pulsieren.
* Vorlagen: `BrackleCatapultCard` und `.potion-target-marked-red` (Brackle), die `sky_dig`-/`ppSalve`-Animationen in `public/app-board.jsx`, der Pixelierer in `public/app-shared.jsx` (`data-pp-px="aus"` für Grafik, die schon Pixelart ist).

## Farb-Regel: Alle Oberflächenfarben stammen aus der 256-Farben-Palette

Das Spiel hat eine feste Palette (`data/palette.json`, 8 Bit = höchstens 256 Farben). Ihre **Zentralfarben** sind die Farben der Karten-Elemente (Rahmen, Symbole, Ecken in `public/cardgen/sprites.png` und die Konstanten in `public/card-render.js`); dazu kommen Schattierungen davon und die Hauptfarben der Oberfläche. Kartenmotive, -rahmen und -symbole gehören dem Kartengestalter und werden **nicht** angefasst — sie sind die Quelle der Palette, nicht ihr Ziel.

* Jede **neue Farbe** in CSS/JSX/HTML (`#rrggbb`, `rgb()`, `hsl()` …) muss eine Palettenfarbe sein. `node scripts/palette/anwenden.js` setzt alle Farb-Literale auf die nächste Palettenfarbe (Lab-Abstand, Alpha bleibt); `npm test` schlägt fehl (`test/palette.test.js`), solange eine fremde Farbe im Quelltext steht. Am einfachsten: gleich eine Farbe aus `data/palette.json` nehmen.
* Farben, die erst **zur Laufzeit** entstehen (Spielerfarbe, Zufallspartikel, `hsl(${hue})`, Farben aus Kartenskripten), rastet `public/palette.js` ein (Stile, Canvas, SVG-Attribute). Die **Spielerfarbe** wird beim Speichern serverseitig auf die nächste Palettenfarbe gesetzt (`palette.js` im Wurzelverzeichnis, `snapHex`) und im Farbfeld des Profils live eingerastet.
* Die Palette selbst ändert man nur bewusst: `python3 scripts/palette/build_palette.py` (Gewichte der Oberfläche: `data/palette-ui-gewichte.json`), danach `node scripts/palette/anwenden.js` und `python3 scripts/pixel-emoji/build_font.py` (die Emoji-Schrift nutzt dieselben 256 Farben).
