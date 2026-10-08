# Pixel-Werkstatt (Bastion Blasters)

Alle Grafiken des Spiels entstehen als **Code**: Python (Pillow + numpy) zeichnet 16-Bit-Pixelart mit Farbrampen, Dithering und Selbst-Outlines und schreibt PNG-Spritesheets. Gleicher Code ergibt gleiche Pixel (geprüft: zwei Läufe liefern identische PNGs); jede Änderung ist ein Diff.

## Ausführen

```bash
cd art
python3 -I styleprobe.py      # ca. 6 s, schreibt nach art/out/
```

Benötigt Python 3 mit `Pillow` und `numpy`. Für Beschriftungen in den Planungsbildern wird, falls vorhanden, DejaVu Sans verwendet (sonst Pillow-Standardfont ohne Umlaute).

## Dateien

| Datei | Inhalt |
|---|---|
| `pixl.py` | Bibliothek: RGB555-Rampen (20 Rampen × 6 Töne), `Canvas`, schattierte Grundformen (Kugel, Polygon, Linie, Rundrechteck), Schachbrett-Dither, Sel-Out-Outline, Kontaktbogen, **`World`** (Tiefenpuffer-Renderer: Pixel wird nur gezeichnet, wenn sein Tiefenschlüssel ≥ dem bisherigen ist) |
| `castle.py` | **Modularer Burg-Generator:** ASCII-Grundriss → Module (zusammenhängende Raumbuchstaben), automatische dünne Wände auf Zellkanten (Höhen 22 / 10 / 20 px), Türen, Tore (Süd/Nord mit Flügeltüren, Ost/West als offener Durchlass), Torpfeiler, Böden, Möbel, Türme, Wandschatten, Wand-Extrusion mit Tiefenpuffer |
| `landscape.py` | Organischer Boden (Rauschfelder, Pfade, Teiche, Dither-Übergänge), Bodendekor, Kulissen: Bäume, Büsche, Felsen, Riesenpilze, Zaun, Wegweiser, Seerosen, Gummiente |
| `assets_env.py` | Bodenkacheln (Gras, Pflaster, Dielen), Wehrturm, Kern |
| `assets_props.py` | Möbel und Wanddeko: Bett, Etagenbett, Amboss, Fass, Trog, Kiste, Waffenständer, Kräutertisch, Truhe, Pflanze, Teppich, Fenster, Banner, Wappen, Esse |
| `assets_units.py` | Einheiten mit Animationen (Skelett, Goblin, Rutsch-Bär, Büttel, Hexe, Katapult, Kürbis-Bomber in 3/4-Ansicht, Bau-Gnom, Bürger, Rangabzeichen) |
| `scenekit.py` | Gemeinsame Szenen-Helfer: Team-Swap, Bodenschatten, Zielschatten |
| `assets_buildings.py` | Bauteil-Sprites der ersten Karten: Pfeilturm, Puddingwand, Fallgrube, Feldlazarett |
| `pixfont.py` | Pixelfont „Schlamassia 5 × 7“ (Umlaute, ß, Satzzeichen), `draw_text`, Rich-Text mit kluger Fettschrift (`draw_rich`), Zeilenumbruch |
| `cardicons.py` | 7-px-Symbole für Kartenwerte (Herz, Schwert, Uhr, …) |
| `cards_art.py` | Bildfenster der Karten (144 × 96, nativ): Dioramen für Einheiten und Bauteile |
| `cards.py` | **Kartenrenderer** (160 × 224): Rahmen, Namensband, abgeleitete Typzeile, Werteleiste, Effektbox mit automatisch fetten Glossarbegriffen, `RANK 3`-Abzeichen, Flavor, Übersicht |
| `cardback.py` | **Kartenrücken:** großes goldenes Logo (3-fach vergrößerter Pixelfont mit Verlauf, Kontur, Schatten), Zinnenband, Schnörkel, Ecken, Medaillon mit Kernkristall |
| `styleprobe.py` | Zusammenbau: Karte 56 × 28 Zellen, zwei Burgen, Landschaft, Einheiten, Projektile, Zielschatten; Kontaktbögen, Atlas, Animation, Planungsansicht |

## Ausgabe (`out/`)

| Datei | Inhalt |
|---|---|
| `szene_1x.png` | **Ganze Karte** (1792 × 896 px): zwei modulare Burgen (P1 Karmin, P2 Türkis), Wege, Teiche, Randwald, kämpfende Einheiten, Katapult-Salven mit Schweif, Zielschatten |
| `szene_nahaufnahme_p1.png`, `szene_nahaufnahme_p2.png` | Ausschnitte beider Burgen in ×3 zur Prüfung von Perspektive, Wänden, Toren und Möbeln |
| `szene_baugrund.png` | **Planungsansicht:** Baugrund 16 × 16 (freie Zellen heller), Reichweitenringe Kurz 26 / Mittel 34 / Weit 42 ab einem Katapult-Platz |
| `szene_animation.gif` | 16 nahtlose Bilder (Ausschnitt 960 × 540): laufende Einheiten, schießendes Katapult, Geschosse, pulsierender Zielschatten |
| `einheiten.png` | alle Animationen der Einheiten (Farbzahl je Sprite im Titel) |
| `moebel.png` | Möbel und Wanddeko |
| `landschaft.png` | Bäume, Büsche, Felsen, Pilze, Zaun, Wegweiser, Seerose, Ente |
| `umgebung.png` | Boden, Mauer-Texturen (Oberseite, hoch, niedrig), Tore, Türme beider Teams, Kern, Katapult |
| `palette.png` | die 20 Rampen der Master-Palette |
| `sprites/*.png` + `atlas.json` | Spritesheets je Einheit, Frame-Größe und Animations-Tags für die Engine |
| `cards/*.png`, `cards_overview.png`, `card_back.png` | **Erste 17 Karten** (8 Einheiten, 9 Bauteile) einzeln in 160 × 224 und als Übersicht (×2); `*_x3.png` = ×3-Ansichten |
| `bericht.txt` | Weltmaße, Farbzählung je Sprite und insgesamt |

## Karten erzeugen

```bash
python3 tools/export_cards.py        # Kataloge -> daten/cards.json (aus dem Ordner BastionBlasters/)
python3 tools/lint_card_text.py      # Nomenklatur prüfen (muss OK melden)
python3 tools/build_nomenclature.py  # NOMENCLATURE.md aus daten/keywords.json neu erzeugen
cd art && python3 -I cards.py        # -> out/cards/*.png, out/cards_overview.png, out/card_back.png
```

Neue Karte: Eintrag in `daten/card_text.json` (`stats`, `rules`, `talent`, `flavor`; Typzeile und Kopfzeile werden aus den Katalogdaten abgeleitet), Bildfenster in `cards_art.py` ergänzen, Linter und Renderer laufen lassen. Regeltext und Talent zusammen höchstens 5 Zeilen, Flavor höchstens 2; der Renderer warnt bei Überlänge. Glossarbegriffe nie von Hand fett setzen.

## Regeln der Werkstatt

- **Perspektive (eine Regel für alles):** Boden reine Draufsicht; **Hohes steht mit seinem Fußabdruck auf dem Boden und wird als Südansicht nach oben gezeichnet**; es gibt nur Südseiten. Wände sind **dünn (8 px)** und stehen auf den Zellkanten (Nordwand 22 px, Südwand 10 px, Seitenwand 20 px, Torbogen 24 px, Pfeiler 34 px). Der Tiefenpuffer sortiert alles pro Pixel.
- **Seitentore:** Weil eine Seitenwand ihre Öffnung verdeckt, solange die Öffnung schmaler als die Wandhöhe ist, sind Ost/West-Tore ein voller Zellendurchlass mit niedriger Wand daneben.
- **Zelle 32 × 32 px**, Sprites M 32 × 32, L bis 56 × 38. Räume sind mindestens 2 Zellen tief.
- **Gesichter einfach halten:** 1–2 Pixel pro Auge, Wiedererkennung über Silhouette, Hut und Werkzeug. Kürbis-Bomber: 3/4-Drehung mit nach vorn geneigtem Stiel.
- **Palette:** RGB555, 122 Farben (20 Rampen × 6 + Tinte + Weiß). Jede Grafik nutzt nur diese (die Stilprobe 99). Die 16-Farben-Grenze je Sprite wird nicht erzwungen (Einheiten: 19–41 Farben).
- **Licht** von oben links, **Dither** nur als Schachbrett im Übergang zweier Töne, **Outline** hell an der Lichtseite, dunkel an der Schattenseite.
- **Team-Swap:** Teamfarbige Pixel stehen in `teamA`; `swap_team()` tauscht sie Index für Index gegen `teamB`.
- **Schatten** werden nicht eingebrannt, sondern beim Zusammenbau als Schachbrett-Dither auf den Boden gelegt.

## Neue Burg entwerfen

Im ASCII-Grundriss (y von oben) steht `h` für Hof, `C` für den 2 × 2-Kern, `T` für eine Turmzelle und ein Buchstabe je Raum-Modul (`K` Krankenstation, `S` Schmiede, `W` Wohnhaus, `B` Kaserne, `Z` Zinnenplattform). Gleiche Buchstaben, die sich berühren, bilden ein Modul. Tore sind `(x, y, Seite)` mit Seite `N`, `E`, `S`, `W`. Beispiel siehe `P1_ROWS` und `P2_ROWS` in `styleprobe.py`; Wände und Türen entstehen automatisch.

## Nächste Schritte

1. Stilprobe v0.3 sichten und freigeben (Perspektive, Gesichter, Kürbis, Landschaft, Kartengröße).
2. P0-Karten als Batch (18 Bauteile, 19 Einheiten) mit den freigegebenen Bausteinen.
3. Effekte (Explosion, Zeitstopp-Frost, Zielschatten-Animation), UI-Rahmen und Karten.
