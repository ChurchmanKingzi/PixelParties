# Laufsheets (RPG-Maker-2003-Charsets) für die Kampagnenfiguren

Aus den Frontansichten in `public/campaign/sprites/` entstehen Laufsheets im Stil der RPG-Maker-2000/2003-Charsets:
4 Richtungen (Hoch, Rechts, Runter, Links) × 3 Frames (Schritt A, Stand, Schritt B).

Figuren: Tobi, Wendy, Mithuru, Ethan, Ellie, Georgie (RM2003-Sheet) und Crum (eigene Datei, siehe unten).

## Grundregel

**Die Mitte vorn (Runter / Stand) ist das Original-Sprite, Pixel für Pixel.** Nichts davon wird skaliert,
neu gezeichnet oder verschoben – die Sprites werden nur von ihrer 10-fachen Vergrößerung (`spriteUnit: 10`)
in die native Auflösung zurückgerechnet und auf die Zelle gesetzt (Körperachse = Zellmitte, Fußsohle auf Zeile 30
wie in den Referenzsheets). Alle übrigen elf Frames werden daran ausgerichtet:

* gleiche Höhe und gleiche Fußlinie (Stand-Frames enden auf y = 30),
* gleiche Körperachse, gleiche Palette (keine neuen Farben), Bänder/Streifen/Säume auf denselben Zeilen,
* Schritt-Frames wie in den Referenzen: Oberkörper 1 px tiefer, ein Fuß belastet (y = 31 vorn/hinten), der andere
  bleibt auf Standhöhe; im Profil steht der vordere Fuß flach, der hintere ist 1 px angehoben.

`check.py` und `build.py` prüfen die Regel bei jedem Lauf (`preview_center_vs_original.png` zeigt Original und
Mitte vorn nebeneinander).

## Aufruf

Aus diesem Ordner (benötigt `pillow` und `numpy`):

```
python3 check.py     # Qualitätsprüfung (Grundregel, Zellränder, Fußlinie, Höhe, Palette)
python3 build.py     # schreibt alles nach out/
python3 preview.py Tobi [Zoom] [Datei]    # eine Figur vergrößert ansehen
python3 native.py Tobi                    # Raster + Palette eines Originals ausgeben (für neue Figuren)
```

`inspect_tools.py` rendert einzelne Zellen vergrößert mit Koordinatengitter (zum Feilen an Pixeln).

## Ausgabe (`out/`)

| Datei | Inhalt |
| --- | --- |
| `charset_campaign.png` | RM2000/2003-Format: 288×256, 8-Bit-Palette, Index 0 = Transparenz (RTP-Grün 32,156,0), Zellen 24×32. Plätze 1–6 von 8 (Reihenfolge in `charset_campaign.json`) |
| `charset_campaign_alpha.png` | dieselben Pixel mit Alphakanal (für den Browser) |
| `charset_campaign.json` | Zellgröße, Spalten-/Zeilenfolge, Platz jeder Figur |
| `<Name>_walk.png` | einzelne Figur, 3 Spalten × 4 Zeilen, RGBA (Crum: Zellen 32×32) |
| `preview_sheet.png`, `preview_walk.gif` | Überblick und Laufzyklus A–Stand–B–Stand |
| `preview_center_vs_original.png` | Beleg der Grundregel |

**Crum** ist 28 px breit und passt nicht in die 24-px-Zelle des RM2003-Rasters. Er liegt deshalb in einer eigenen
Datei mit 32×32-Zellen (gleiche Spalten-/Zeilenfolge); in einem echten RM2003-Sheet würde er abgeschnitten.

## Wie die Ansichten entstehen

| Ansicht | Herstellung |
| --- | --- |
| Vorn, Schritt | Raster des Originals; Oberkörper +1 px, belastetes Bein +1 px, angehobener Fuß darüber (`figure.walk_layers`) |
| Hinten | Original mit handgezeichneten Flicken (Hinterkopf statt Gesicht, Rückseite statt Revers/Krawatte), dann gespiegelt – die Tasse (Mithuru) bzw. die Schleife (Georgie) wechseln dabei die Bildseite, wie es von hinten sein muss |
| Rechts | Haarkappe und Rumpf aus Original-Pixeln (Rumpf auf ca. 8 px verschmälert, ohne Mittelstreifen); Profilgesicht aus einer gemeinsamen Vorlage (`recipes.PROFILE_TEMPLATE`), vermessen an 32 Referenz-Profilen: senkrechte Vorderkante ohne Nase, Gesicht ca. 2 px vor dem Rumpf, Hals mittig, kein dunkler Pixel vor dem Kinn |
| Links | Spiegelung von Rechts; nur wo die Figur asymmetrisch ist, gibt es eine eigene Ansicht (Georgie ohne Schleife, Mithuru mit Tasse in der nahen Hand, Crum ohne Fisch) |

## Neue Figur hinzufügen

1. `python3 native.py Name` – Raster und Palette des Originals ablesen.
2. In `cast.py`: Palette eintragen, `F_NAME = front_rows('Name', PAL)`, Flicken für die Rückansicht (`G("""…""")`,
   Buchstaben = Palette-Plätze, `.` = Original stehen lassen, `_` = Pixel löschen), Profil mit
   `side_body(...)` (Haarzeilen, Buchstabenzuordnung der Vorlage, Rumpfzeilen/-spalten, Schuhe), Arm und
   schließlich `CAST['Name'] = make(...)` (Zell-x der Sprite-Spalte 0, Zeile des Hosenbundes, Spalte der Beintrennung).
3. Name in `ORDER` (`build.py`) eintragen, `python3 check.py` – es meldet fehlerhafte Rasterzeilen mit Datei und Zeile.

## Grenzen

* Die Profilgesichter folgen einer gemeinsamen Vorlage; Details (Brille, Haarsträhnen im Gesicht, Mund) gehen im
  Profil verloren, das Original sieht man nur von vorn.
* Rück- und Seitenansichten sind Handarbeit auf Basis des Originals und können im Detail von dem abweichen, was
  die Figur „wirklich“ zeigt (z. B. Nacken, Haarspitzen hinten, Rückseite von Kleidungsstücken).
* Vorn und hinten schwingen die Arme nicht; nur das Profil hat einen Armschwung.
* Crums Rücken- und Seitenansicht sind Näherungen (Pinguin mit Fisch/Flügel statt Mensch-Raster).
