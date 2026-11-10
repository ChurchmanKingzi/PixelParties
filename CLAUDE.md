# Hinweise für Agenten in diesem Repository

## Nicht ins Repository: Tests, Audits, Berichte, Dokumentation

Ins Git-Projekt gehört **nur, was zum Spiel selbst gehört** (Server, Client, `cards/`, `data/`, Bau-/Prüfskripte, `test/` für `npm test`, `bot/`, `skilltest/`, `deploy/`, `electron/`). **Niemals** committen: Niche-/Repro-Tests samt Harness (`docs/niche-tests/**`), alles unter `docs/`, Audit-Tabellen, Nacht-/Skilltest-Berichte, Markdown-Dokus/Briefs/Notizen (außer `CLAUDE.md`, `README.md`, `cards/effects/CARD_API.md`), Berichtsdateien (`*.trail.json`, `*_report.csv`). Sie bleiben lokal beim Arbeitenden und sind per `.gitignore` ausgeschlossen — auch Subagenten und Worktrees halten sich daran (Ergebnisse in den Bericht, nicht ins Repo). Was für andere wichtig ist, gehört als Kommentar ins betroffene Kartenskript oder knapp in `cards/effects/CARD_API.md`.

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
* **Reine Anpassung an eine NEUE Karte ist kein Bugfix:** Wird ein bestehendes Skript (oder ein gemeinsamer Baustein, auch `_engine`) nur geändert, damit es zu einer neuen Karte passt (neuer Engine-Vertrag, Wechselwirkung, Zielfilter für die neue Karte), schreibe pro betroffener Karte/Baustein eine Zeile
  `Bugfix-Skip: <Kartenname oder _baustein>` (optional `| Grund`) in die Commit-Nachricht – **keine** `Bugfix-Note`. Der Bot meldet das Ziel dann nicht im Bugfix-Kanal. Dasselbe gilt für Nachbesserungen an einer neuen Karte, die für Spieler noch nicht
  freigegeben ist, auch wenn sie schon in `data/cards.json` steht. Ein `Bugfix-Skip` hat Vorrang vor einer `Bugfix-Note` desselben Ziels im selben Bot-Zeitraum (so nimmt man eine zu Unrecht geschriebene Note in einem späteren Commit zurück) –
  also nicht für eine Karte schreiben, an der im selben Zeitraum auch ein echter Fehler behoben wurde.

## Grafik-Regel: Jede Animation und jedes Highlight ist Pixelart

Alles, was neu gezeichnet oder animiert wird (Karten-Flüge, Effekte, Zielmarkierungen, Highlights, Symbole), muss **Pixelart** sein – kein weicher Look:

* **Emojis und Text-Symbole** (🔥 ✓ ★ → …) kommen aus der Pixel-Emoji-Schrift (`public/fonts/pp-pixel-emoji.woff2`), nicht aus der System-Schrift. Wer ein **neues** Emoji in Text, Titel, Beschriftung oder Kartenskript verwendet, baut sie neu: `node scripts/pixel-emoji/scan.js && node scripts/pixel-emoji/extract.js && python3 scripts/pixel-emoji/build_font.py`. `npm test` schlägt fehl, solange ein Zeichen fehlt.
* **Keine** Weichzeichner-Schatten und -Scheine (`box-shadow`/`drop-shadow` mit Unschärfe), **keine** Drehungen oder stufenlosen Skalierungen von Kartenbildern, **keine** Glyphen/Emojis als Symbole, **keine** weichen Verläufe oder Alpha-Überblendungen.
* Stattdessen: harte Rahmen aus gestapelten `box-shadow: 0 0 0 Npx …`-Ringen, feste Farbpalette, Dithering (2×2-/Bayer-Raster) statt Alpha, Symbole als kleine Sprites (SVG mit `shape-rendering: crispEdges` bzw. Canvas, `image-rendering: pixelated`, ganzzahlig vergrößert), Bewegung in ganzen Pixeln im Bildtakt (~30 Bilder/s, `steps()`), Blinken per `steps(1)` statt weichem Pulsieren.
* Vorlagen: `BrackleCatapultCard` und `.potion-target-marked-red` (Brackle), die `sky_dig`-/`ppSalve`-Animationen in `public/app-board.jsx`, der Pixelierer in `public/app-shared.jsx` (`data-pp-px="aus"` für Grafik, die schon Pixelart ist).
* **Pixelgröße: Jede Animation hat die Standard-Pixelgröße der Heroes.** Die Rasterzelle eines Effekts (Leinwand, Partikel, Hammerköpfe, Ringe …) entspricht dem Hero-Pixel: Breite des `.hero-idle-canvas` geteilt durch die Frame-Breite des Sheets, gemessen am Hero des Ziels in seiner Reihe (ohne Hero: `2,8125 × --board-scale × Plane-Zoom`; die Pixelgröße der Heroes ist bewusst bei jedem Hero gleich und hängt nur von Gerät und Reihe ab). Rasterzelle `S = max(2, round(Hero-Pixel))`; nicht stufenlos skalieren (das verwischt und verletzt die Palette). Wird ein Held in eine Effekt-Leinwand gemalt (Quetschen, Tod), dann mit einer Zelle je Sprite-Pixel, damit sein Raster identisch bleibt. Eine feste Zelle von 3 px (ältere Effekte, `ppFx30Maler`) ist auf kleinen Bildschirmen und dem Handy gröber als die Heroes und gilt nicht mehr als Vorbild.

* **Vorgebackene Stylesheets:** Im Normalmodus lädt das Spiel `public/style.hart.css` / `style-skilltest.hart.css` — `style.css` mit schon angewandtem `pixel-hart.js` (spart ~100 ms Umwandlung je Spielstart, mehr auf dem Handy). Wer `style.css`, `style-skilltest.css`, `pixel-hart.js` oder die Palette ändert, backt neu: `node scripts/build.js` und danach `node scripts/hart/build-css.js` (braucht Playwright). `npm test` schlägt sonst fehl (`test/hart-css.test.js`); bis dahin liefert der Server die ungebackene Quelle aus (nie falsch, nur langsamer). Das Skript prüft die Fassung Regel für Regel gegen die Laufzeit-Pipeline.

## Farb-Regel: Alle Oberflächenfarben stammen aus der 256-Farben-Palette

Das Spiel hat eine feste Palette (`data/palette.json`, 8 Bit = höchstens 256 Farben). Ihre **Zentralfarben** sind die Farben der Karten-Elemente (Rahmen, Symbole, Ecken in `public/cardgen/sprites.png` und die Konstanten in `public/card-render.js`); dazu kommen Schattierungen davon und die Hauptfarben der Oberfläche. Kartenmotive, -rahmen und -symbole gehören dem Kartengestalter und werden **nicht** angefasst — sie sind die Quelle der Palette, nicht ihr Ziel.

* Jede **neue Farbe** in CSS/JSX/HTML (`#rrggbb`, `rgb()`, `hsl()` …) muss eine Palettenfarbe sein. `node scripts/palette/anwenden.js` setzt alle Farb-Literale auf die nächste Palettenfarbe (Lab-Abstand, Alpha bleibt); `npm test` schlägt fehl (`test/palette.test.js`), solange eine fremde Farbe im Quelltext steht. Am einfachsten: gleich eine Farbe aus `data/palette.json` nehmen.
* Farben, die erst **zur Laufzeit** entstehen (Spielerfarbe, Zufallspartikel, `hsl(${hue})`, Farben aus Kartenskripten), rastet `public/palette.js` ein (Stile, Canvas, SVG-Attribute). Die **Spielerfarbe** wird beim Speichern serverseitig auf die nächste Palettenfarbe gesetzt (`palette.js` im Wurzelverzeichnis, `snapHex`) und im Farbfeld des Profils live eingerastet.
* Die Palette selbst ändert man nur bewusst: `python3 scripts/palette/build_palette.py` (Gewichte der Oberfläche: `data/palette-ui-gewichte.json`), danach `node scripts/palette/anwenden.js` und `python3 scripts/pixel-emoji/build_font.py` (die Emoji-Schrift nutzt dieselben 256 Farben).
* **Feste Farben des Spielgestalters** stehen in `data/palette-fest.json` (z. B. die Farben der Gold-Münze). Sie kommen **exakt** in die Palette (`build_palette.py`, nie auf Nachbarfarben gerastet) und werden dort, wofür sie gedacht sind, unverändert verwendet — Gold im Spiel (Münze, Goldzahl, Gold-Zahlen im Duell) nutzt genau diese fünf Farben. Gibt der Gestalter ein Icon oder Farben vor, werden sie dort eingetragen und das Icon pixelgenau übernommen (die 🪙-Münze der Emoji-Schrift ist sein 12×12-Sprite).

* **Titelbild und Login-Kulisse sind vorgebackene Pixelart** (Raster 3 px, Bayer-Mischdither, Palette): `public/title.png`, `electron/assets/title.png` und `data/animated_screen/layers2/*.png` sind Ergebnisse von `python3 scripts/title-pixel/bake.py` — **nie von Hand ändern, zur Laufzeit wird nichts pixelisiert**. Die Originale liegen unter `scripts/title-pixel/originals/` (nicht ausgeliefert; das Skript liest nur von dort). Neue Grafik: Original dort ersetzen und neu backen.
* Nach **jeder Änderung an `data/palette.json`** (oder an Originalen/Skript) neu backen: `python3 scripts/title-pixel/bake.py` (wenige Sekunden); `npm test` schlägt sonst fehl (`test/title-pixel.test.js`, Stand-Hash in `scripts/title-pixel/stand.json`). Gebackene Bilder nie mit Glättung zeichnen (`image-rendering: pixelated`, `imageSmoothingEnabled = false`).

## Offene Baustellen (für andere Instanzen; erledigte Einträge löschen)

* **Foils werden von einer anderen Instanz komplett neu geschrieben. Wichtig zu beachten!** Der heutige Stand ist nur ein Zwischenstand der Performance-Arbeit (3.11.2026), kein Zielentwurf:
  * Sparkle-Funken und Foil-Staub laufen schon als EINE Canvas je Foil-Karte (`public/app-fx-35.jsx`, `window.PpFx35Foil`, Anbindung in `FoilOverlay` in `public/app-shared.jsx`; Rückfall auf die alten DOM-Funken bei `window.__ppFx35Alt`; greift nur in der Großansicht, mit aktiver Pixel-Pipeline, nicht im Retro-Modus und nicht im Handy-Profil). Rahmen-Ringe (`foilRahmen3/4`), Schimmer (`foilShimmerKlein`, `foilDiamondShimmerKlein`, `foilSchimmerWeg`), Gold-Schiller, `hand-bloom-pulse` und `pp-portraet-puls` laufen noch per CSS (zusammen ~150 ms Style/Paint je 4 s im Leerlauf).
  * **Dauer-Animationen kosten Hauptfaden-Zeit.** Jede laufende CSS-Animation löst im Takt einen Style-Neuaufbau aus; `pixel-anim.js` zwingt gebackene Animationen mit Skalierung per `scrollMarginTop` auf den Hauptfaden (der Compositor würde bilinear skalieren → Mischfarben, Palettenverstoß). Vor dem Foil-Umbau waren Foil/Sparkle ~85 % der Paint-Kosten im Leerlauf, die Hand-/Brett-Motes ~80 % der Style-Kosten (jetzt Canvas, `app-fx-34.jsx`). Darum: Dauerlauf-Optik als Canvas (eine Ebene je Karte/Schicht, 30-Hz-Takt `ppTaktRaf`, nur bei Bildwechsel zeichnen, nur wenn sichtbar via IntersectionObserver, Leinwand einmal anlegen und im Leerlauf aufwärmen), nicht als dutzende animierte Elemente.
  * **Kein Layout lesen im Takt, keine breiten `:has()`-/Nachfahren-Selektoren unter `body`/`.screen-full`.** Eine Regel `body:has(.x) .screen-full *` hatte jedes eingefügte Element mit Klasse zum Auslöser eines Style-Neuaufbaus des ganzen Baums gemacht (10–50 ms); sie hängt jetzt an `body[data-rotate-gate]`.
  * **Messung 3.11.2026 (Tutorial 7, Desktop-Leerlauf, CPU 6× gedrosselt, 8 s):** Die gesamte Paint-/Style-Last des Bretts (≈ 900 ms Paint + ≈ 900 ms UpdateLayoutTree, rund 22 % des Hauptfadens) kommt von den neun laufenden CSS-Animationen `foilRahmen3/4`, `foilShimmerKlein`, `foilDiamondShimmerKlein`, `foilSchimmerWeg`, `ppGoldSchiller(Icon)`, `hand-bloom-pulse` und `pp-portraet-puls`. Pausiert man genau diese, fallen Paint und Style auf 0; alle Canvas-Ebenen (Held-Sprites, Motes, Foil-Funken) zusammen ausgeblendet ändern daran nichts. Der Foil-Umbau ist also der größte verbleibende Hebel für das Onboarding auf schwachen Geräten — Dauer-Optik als Canvas, nicht als CSS-Animation.
  * **Handy-Profil nicht aufweichen:** `battle-lite` (`style.css`, `@media (pointer: coarse) and (max-height: 600px)`) schaltet Motes/Foil-Ebenen dort ab bzw. reduziert sie; der Leerlauf kostet dort nur ~25 ms/s. Foils dürfen das nicht wieder teurer machen.
  * **Messen als Verteilung (Median, p90, p99, MAX), auch direkt nach dem Laden** — einzelne 12–20-ms-Ausreißer (erstes Zeichnen in eine frisch eingehängte sichtbare Leinwand, erzwungenes Layout) sind genau die Ruckler, die sich summieren. Messvorlagen: CDP-Trace `devtools.timeline` (`UpdateLayoutTree`, `Paint`, `Layerize`), Leerlauf-Summe je 4 s auf dem Tutorial-7-Brett; Richtwert nach den Umbauten: Style ~68 ms, Paint ~60 ms, Layerize ~31 ms je 4 s, 17 laufende Animationen.
  * Die Konstanten in `app-fx-35.jsx` (`PP_FX35_MAX_BILDER`, `PP_FX35_MAX_DAUER`, Schwelle 400 px²) spiegeln die von `pixel-anim.js` (`globalMaxBilder`, `ditherMin`, `globalMaxDauer`); bei Änderungen dort mitziehen. Das Aussehen der bisherigen Foils (Funken-/Staub-Takt, Farben, Dichte) ist der Vergleichsmaßstab für den Neuentwurf; die Canvas-Fassung in `app-fx-35.jsx` kann als Vorlage dienen oder ersetzt werden.
