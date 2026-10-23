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
* **Balancing ist kein Bugfix:** Ändert sich der Eintrag einer Karte in `data/cards.json` (Effekttext, HP, Kosten …), zählt das als Balancing-Änderung
  und erscheint nur in den Patchnotes – auch wenn dabei das Skript angepasst wurde. Wurde dabei zusätzlich ein echter Fehler behoben
  (z. B. Skript passte nicht zum Kartentext), schreibe eine `Bugfix-Note` für diese Karte; dann erscheint sie auch im Bugfix-Kanal.
* Ohne `Bugfix-Note` erscheint die Karte trotzdem (erkannt am geänderten Skript), nur ohne Erklärung.

## Grafik-Regel: Jede Animation und jedes Highlight ist Pixelart

Alles, was neu gezeichnet oder animiert wird (Karten-Flüge, Effekte, Zielmarkierungen, Highlights, Symbole), muss **Pixelart** sein – kein weicher Look:

* **Keine** Weichzeichner-Schatten und -Scheine (`box-shadow`/`drop-shadow` mit Unschärfe), **keine** Drehungen oder stufenlosen Skalierungen von Kartenbildern, **keine** Glyphen/Emojis als Symbole, **keine** weichen Verläufe oder Alpha-Überblendungen.
* Stattdessen: harte Rahmen aus gestapelten `box-shadow: 0 0 0 Npx …`-Ringen, feste Farbpalette, Dithering (2×2-/Bayer-Raster) statt Alpha, Symbole als kleine Sprites (SVG mit `shape-rendering: crispEdges` bzw. Canvas, `image-rendering: pixelated`, ganzzahlig vergrößert), Bewegung in ganzen Pixeln im Bildtakt (~30 Bilder/s, `steps()`), Blinken per `steps(1)` statt weichem Pulsieren.
* Vorlagen: `BrackleCatapultCard` und `.potion-target-marked-red` (Brackle), die `sky_dig`-/`ppSalve`-Animationen in `public/app-board.jsx`, der Pixelierer in `public/app-shared.jsx` (`data-pp-px="aus"` für Grafik, die schon Pixelart ist).
