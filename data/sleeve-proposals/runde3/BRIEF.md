# Auftrag: neue Sleeves für Pixel Parties (Runde 3)

Du entwirfst Kartenhüllen („Sleeves“, Rückseiten-Motive) für das Kartenspiel Pixel Parties.
Repo: /home/user/PixelParties. Bestehende Shop-Sleeves: data/shop/sleeves/sleeve1–15.png (nicht kopieren!).
**sleeve2.png ist das Vorbild**: große, dicht komponierte Szene mit ganzzahlig hochskalierten Figuren aus dem
Spiel, die den Rahmen füllen; Hintergrund aus Spielgrafik; alles erkennbar aus den Karten, nur umposiert/skaliert/
leicht bearbeitet.

## Harte Regeln (Nutzer-Vorgaben)
1. **Nur vorhandene Grafik**: Figuren, Objekte, Hintergründe stammen aus den xcf-Ebenen (s. u.) bzw. Kartenbildern
   (/home/user/PixelParties/cards/*.png). Erlaubt: skalieren (ganzzahlig, nearest), spiegeln, drehen um 90°,
   umfärben/abdunkeln, zuschneiden, kacheln, Teile kombinieren, leicht editieren. Hintergründe dürfen auch aus
   xcf übernommen, selbst erstellt (schlichte Verläufe/Muster in Spielfarben, Dithering) oder editiert werden.
   Keine erfundenen Figuren/Objekte.
2. **Kein Text** auf den Sleeves (keine Titel, Schriftzüge, Beschriftungen).
3. **Keine fehlenden Pixel**: Sprites nur aus xcf-Ebenen (sauber freigestellt), nicht aus Kartenbildern ausschneiden,
   wenn es die Figur als Ebene gibt. Prüfe, ob eine Figur aus mehreren Ebenen besteht (Waffe, Umhang, Effekte als
   eigene Ebenen) und setze sie korrekt zusammen (Hilfen: scenes_with, scene_layers, card_region_layers, touching).
4. Pixel-Art bleibt scharf: Ausgabe 750×1050 PNG = 250×350-Raster × 3 (kit.save(cv, name) erwartet Canvas 250×350).
   Figuren auf dem 250×350-Raster ganzzahlig skalieren (typisch 2×–6×; groß und präsent wie sleeve2!). Keine
   halbtransparenten Kanten, kein Weichzeichnen der Sprites.
5. Logik: Verbindungen müssen stimmen (z. B. Marionettenfäden enden am Puppenspieler, Fäden hängen irgendwo).
6. Nutzer-Feedback bisher: Gefallen haben „Detective Board“ (Ermittlungswand mit Fotos + Faden + Lupe — originelles
   Konzept), „Spider Nest“, „Pharaoh Tomb“ (Wand aus Spieltextur), „Divine Balance“ mit Strahlenkranz, „Puppet Theater“.
   **Hässlich/verworfen**: „Army of the Cute“ (flacher Hintergrund, viele kleine gleiche Sprites verstreut, riesiges
   grobes Mosaik-Herz) und „Slippery Slope“ (Sprites einfach nebeneinander auf Streifenmuster). Also: keine
   Streu-Muster aus Mini-Sprites, sondern echte Komposition mit Bildidee, Tiefe, Blickführung.
7. Eigenständige Ideen pro Sleeve, abwechslungsreich (Szene, Porträt/Close-up, Tarot-/Plakat-/Wappen-artige
   Rahmung ohne Text, Aquarium/Schaukasten, Spiegelung, Silhouette vor Mond, Gruppenbild, Kampf, Stillleben …).
   Themen der bestehenden Shop-Sleeves nicht wiederholen (Cthulhu über Deepsea-Schloss, Auge im All, Future-Tech-
   Blaupause, Wowhalla-Regenbogen, Schach-König, Lunatic-Mond, Pixel-Pocket, Wanted, Kirchenfenster, Slime-Glas,
   Tarot Skullmael, Doom Clock) und nicht die Runde-2-Motive (Zodiac, Puppentheater, Spinnennetz, Pharaonengrab,
   Gigantisaurier-Comic, Detektivwand, Pentagramm-Dämonen, Waage).

## Material
- xcf-Ebenen als PNG: /home/user/sprites_export/<Datei>/ (layers.json: alle Ebenen mit Name, Offset; index.json +
  crops/: zugeschnittene Ebenen). Alle Ebenen einer Datei liegen im selben Leinwand-Koordinatensystem; Ebenen, die
  sich räumlich überlagern, gehören oft zusammen. Ebenen namens „Sichtbar …“ sind fertige Szenen-Abzüge (ganze
  Kartenbilder in Originalpixeln) — ideal, um zu sehen, wie Ebenen zusammengehören, und als Hintergrundquelle.
- Kontaktbögen (Übersicht aller Ebenen mit Index+Name):
  /tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/cat/<Datei>_NN.png
- Karten: /home/user/PixelParties/cards/*.png (750×1050, Bild im Bereich x 70–680, y 168–568, natives Raster ~8 px),
  Kartendaten: /home/user/PixelParties/data/cards.json. Karte in xcf-Szene finden:
  `python3 /home/user/sprites_export/findcards.py <Datei> "<Kartenname>" ...` → Szene-Ebene + Lage.

## Werkzeuge (Python 3, Pillow/NumPy/OpenCV installiert)
Skripte in /home/user/PixelParties/data/sleeve-proposals/runde3/generator/ ablegen, dort `from common import *`.
- `sprite(key, datei, [ebenen])` → RGBA-Array, Ebenen in GIMP-Reihenfolge zusammengesetzt, zugeschnitten; wird unter
  generator/sprites3/<key>.png abgelegt (Keys mit deinem Präfix eindeutig halten, z. B. „b07_…“).
- `compose(datei, [ebenen], crop=True)`, `layer(datei, i)` (volle Leinwand), `layer_info`, `find(datei, 'Name')`
- `parts(s, dil=1)` trennt mehrere Figuren einer Ebene; `part_at(s, x, y)`; `split_x(s)`
- `scene_sprite(key, datei, szene, loc, box)` exakter Ausschnitt aus einer Sichtbar-Szene
- kit: `Canvas(250, 350)`, `cv.paste(rgba, x, y)`, `up(s, k)`, `flip`, `rot90`, `hsv_shift(s, dh, ds, dv)`,
  `darken`, `tint`, `silhouette(s, farbe)`, `outline(s, farbe)`, `fill_tiles`, `vignette(cv, stärke, r0)`,
  `ordered(...)`/`BAYER4` (Dithering), `ring`, `disc`, `save(cv, 'NN_name.png')` → schreibt nach runde3/.
- Vorschau prüfen: Bild mit dem Read-Tool ansehen (z. B. die fertige PNG). **Jedes Sleeve selbst kritisch
  ansehen und mindestens einmal verbessern** (fehlende Pixel? Kanten? Komposition leer/überladen? Figuren zu klein?).

## Ablieferung
- Pro Sleeve: `runde3/NN_kurzname.png` (750×1050) und `runde3/generator/sNN_kurzname.py` (reproduzierbar,
  Docstring nennt verwendete xcf-Dateien/Ebenen/Karten), Nummern NN aus deinem Block.
- Zusätzlich `runde3/notes_<Block>.md`: je Sleeve eine Zeile „NN | Titel | Idee | Quellen“.
- **Keine git-Befehle** (kein commit/push) und keine Dateien außerhalb von runde3/ ändern. Andere Agenten arbeiten
  parallel in denselben Ordnern, fasse fremde Dateien nicht an.

---

# Runde 3b – Überarbeitung + 10 neue (Feedback des Nutzers, VERBINDLICH)

**Lob:** „Blood Eclipse“ (34), „Count of the Deep“ (13), „Porthole“ (07), „Cybug Case“ (43) — „hier stimmt einfach die
Komposition“. Diese vier werden NICHT verändert. Sie sind der Maßstab für alle anderen: ein klares Hauptmotiv, ruhiger
Hintergrund, klare Tiefenstaffelung, einheitliche Pixelgröße.

## Neue harte Regeln
A. **Einheitliche Pixelgröße = sofortiges Ausschlusskriterium.** Alle Elemente, die auf derselben Bildebene/Tiefe
   stehen, müssen dieselbe Skalierung haben (z. B. alle 3×). Unterschiedliche Pixelgrößen sind NUR erlaubt, wenn sie
   klar aus der Perspektive folgen: Das größer skalierte Element steht eindeutig im Vordergrund (wie der Vampir in 13
   vor dem 2×-Schloss). Nie zwei Figuren nebeneinander/auf derselben Höhe mit verschiedenen Skalierungen (Negativbeispiel:
   „Tavern“ 45). Hintergründe/Kacheln zählen mit: ein 2×-Hintergrund hinter 5×-Figuren nur, wenn er klar weit hinten
   liegt. Im Zweifel: alles in derselben Skalierung. Kein 1×-Element neben 3×-Elementen.
B. **Vollständige Figuren.** Figuren bestehen oft aus mehreren Ebenen, die NICHT direkt übereinander im Ebenenstapel
   liegen (Beispiel: Dantes Arme liegen in einer weiter oben gelegenen Ebene). Prüfe jede Figur gegen ihre
   „Sichtbar“-Szene: Suche ALLE Ebenen der Datei, deren Pixel im Szenen-Abzug innerhalb der Figuren-Bounding-Box
   sichtbar sind (match_frac/scene_layers mit großem Radius, nicht nur Nachbarebenen), und vergleiche dein
   zusammengesetztes Sprite pixelweise mit dem Ausschnitt der Szene. Fehlt etwas Offensichtliches (Arme, Pompom-Stück,
   Waffe), ergänze es aus der Szene oder – falls es in der Vorlage fehlt/verdeckt war – editiere es plausibel nach
   (spiegeln/kopieren vorhandener Pixel der Figur).
C. **Korrekte Positionierung/Logik.** Figuren stehen auf festem Boden, Werkzeuge treffen sinnvolle Ziele (Negativbeispiel:
   Archäologe schlägt mit der Spitzhacke über die Inselkante ins Leere), Fäden/Strahlen verbinden, was sie verbinden
   sollen, Schatten/Füße passen zum Untergrund.
D. **Effekte und Hintergrundelemente** (Feuer, Rauch, Licht, Vulkan, Wasser, Himmel) dürfen und sollen selbst gezeichnet
   oder deutlich editiert werden, wenn ein vorhandenes Sprite zweckentfremdet schlecht aussieht (Negativbeispiel: Luau
   nutzt ein Feuer-Sprite als Vulkanausbruch). Selbst gezeichnete Effekte in sauberer Pixel-Art (harte Kanten,
   begrenzte Palette, gleiche Pixelgröße wie die Umgebung!).
E. Halbtransparenz ist für Geister/Spiegelungen erlaubt (geordnetes Dithering oder echtes Alpha-Blending auf ganze
   Pixel), z. B. soll Hel, der Schulgeist, im Klassenfoto (38) halbtransparent im Hintergrund schweben.
F. Doppelungen vermeiden: Konzert/Bühne gibt es schon 4× (27, 41, 47, 49), Bibliothek 2× (02, 35), Blutmond 3× (08, 09,
   34). Beim Überarbeiten dürfen Motive geändert werden, wenn das die Doppelung auflöst. Neue Sleeves: keine Konzerte,
   keine Bibliotheken, kein Blutmond.

## Ablauf je Agent
1. Eigene Sleeves (außer 07/13/34/43) nacheinander kritisch prüfen: Pixelgrößen, Vollständigkeit (Regel B – bei JEDER
   Figur prüfen!), Positionierung, Komposition. Verbessern (Datei/Skript gleichen Namens überschreiben). Wenn ein Sleeve
   nicht zu retten ist, darf es komplett neu gedacht werden (gleiche Nummer, neuer Kurzname; alte PNG/Skript löschen).
2. Die neuen Sleeves des Blocks (Nummern s. Auftrag) nach denselben Regeln bauen.
3. `notes_<Block>.md` aktualisieren: pro Sleeve eine Zeile inkl. „Skalierung: …“ (welche Elemente in welcher Größe).
