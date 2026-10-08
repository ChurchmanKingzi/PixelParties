# Pixel-Werkstatt (Bastion Blasters)

Alle Grafiken des Spiels entstehen als **Code**: Python (Pillow + numpy) zeichnet 16-Bit-Pixelart mit Farbrampen, Dithering und Selbst-Outlines und schreibt PNG-Spritesheets. Gleicher Code ergibt gleiche Pixel; jede Änderung ist ein Diff.

## Ausführen

```bash
cd art
python3 -I styleprobe.py      # ca. 40 s, schreibt nach art/out/
```

Benötigt Python 3 mit `Pillow` und `numpy`.

## Dateien

| Datei | Inhalt |
|---|---|
| `pixl.py` | Bibliothek: RGB555-Rampen (20 Rampen × 6 Töne), Canvas, schattierte Grundformen (Kugel, Polygon, Zylinder), Schachbrett- und Bayer-Dither, Sel-Out-Outline, Kontaktbogen |
| `assets_env.py` | Boden (Gras, Pflaster, Dielen), Mauerblock, Wehrturm, Tor, Kern, Räume, Zinnenkranz |
| `assets_units.py` | Einheiten der Stilprobe mit Animationen (Skelett, Goblin, Rutsch-Bär, Büttel, Hexe, Katapult, Kürbis-Bomber, Bau-Gnom, Bürger, Rangabzeichen) |
| `styleprobe.py` | Zusammenbau: Kontaktbögen, Spritesheets, Atlas, Szenen-Montage, Animation |

## Ausgabe (`out/`)

| Datei | Inhalt |
|---|---|
| `szene_3x.png`, `szene_1x.png` | Szenen-Montage: beide Bastionen (P1 Karmin, P2 Türkis gespiegelt), Niemandsland mit kämpfenden Einheiten, Zielschatten, Projektil |
| `szene_animation.gif` | 16 nahtlose Bilder: laufende Einheiten, schießendes Katapult, pulsierender Zielschatten |
| `einheiten.png` | alle Animationen der Einheiten (Farbzahl je Sprite im Titel) |
| `umgebung.png` | Böden, Mauerblock, Turm (beide Teams), Tor, Kern, Räume, Zinnenkranz |
| `palette.png` | die 20 Rampen der Master-Palette |
| `sprites/*.png` + `atlas.json` | Spritesheets je Einheit, Frame-Größe und Animations-Tags für die Engine |
| `bericht.txt` | Farbzählung je Sprite und insgesamt |

## Regeln der Werkstatt

- **Perspektive:** schräge Draufsicht. Boden von oben, Wände zeigen 10 px Vorderseite; Einheiten blicken nach rechts (links = gespiegelt).
- **Zelle 32 × 32 px**, Sprites M 32 × 32, L bis 56 × 38, Bauteile füllen ihre Zellen.
- **Palette:** RGB555, 122 Farben (20 Rampen × 6 + Tinte + Weiß). Jede Grafik nutzt nur diese. Die 16-Farben-Grenze je Sprite wird nicht erzwungen (Stilprobe: 22–42 Farben je Sprite).
- **Licht** von oben links, **Dither** nur als Schachbrett im Übergang zweier Töne, **Outline** hell an der Lichtseite, dunkel an der Schattenseite.
- **Team-Swap:** Teamfarbige Pixel stehen in `teamA`; `swap_team()` tauscht sie Index für Index gegen `teamB`.
- **Schatten** werden nicht eingebrannt, sondern beim Zusammenbau als Schachbrett-Dither auf den Boden gelegt.

## Nächste Schritte

1. Stilprobe sichten und freigeben (Rampen, Proportionen, Gesichter, Detailgrad).
2. P0-Karten als Batch (18 Bauteile, 19 Einheiten) mit den freigegebenen Bausteinen.
3. Effekte (Explosion, Zeitstopp-Frost, Zielschatten-Animation), UI-Rahmen und Karten.
