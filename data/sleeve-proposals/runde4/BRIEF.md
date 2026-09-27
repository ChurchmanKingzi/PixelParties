# Auftrag: neue Sleeves für Pixel Parties (Runde 4, 50 Stück)

Du entwirfst Kartenhüllen („Sleeves“, Rückseiten-Motive) für das Kartenspiel Pixel Parties.
Repo: /home/user/PixelParties. Es gibt bereits 83 Shop-Sleeves (data/shop/sleeves/, Namen in
data/shop/sleeve-names.json). Runde 2/3 zum Anschauen: data/sleeve-proposals/runde2/final/ und runde3/final/.

## Maßstab (Lob des Nutzers)
„Blood Eclipse“, „Count of the Deep“, „Porthole“, „Cybug Case“ (runde3/final) und „Detective Board“ (runde2/final):
„hier stimmt einfach die Komposition“ – **ein klares Hauptmotiv, eine originelle Bildidee, ruhiger Hintergrund,
klare Tiefenstaffelung, einheitliche Pixelgröße**. Groß und präsent, nicht klein und verstreut.

## Harte Regeln (alle vom Nutzer, VERBINDLICH)
1. **Nur vorhandene Grafik.** Figuren/Objekte stammen aus den xcf-Ebenen (/home/user/sprites_export/<Datei>/).
   Erlaubt: ganzzahlig skalieren (nearest), spiegeln, um 90° drehen, umfärben/abdunkeln, zuschneiden, kacheln,
   kombinieren, leicht editieren. Keine erfundenen Figuren/Objekte.
2. **Effekte und Hintergründe selbst zeichnen**, wenn ein Sprite dafür zweckentfremdet schlecht aussähe (Feuer, Rauch,
   Licht, Strahlen, Wasser, Himmel, Vulkan, Fäden, Seile, Linien, Ringe). Saubere Pixel-Art: harte Kanten, kleine
   Palette aus Spielfarben, geordnetes Dithering erlaubt – und **dieselbe Pixelgröße wie die Umgebung**.
   Negativbeispiel: ein Feuer-Sprite als Vulkanausbruch.
3. **Kein Text** (keine Titel, Schriftzüge, Zahlen, Beschriftungen – auch nicht aus Kartenbildern mitgeschleppt).
4. **Einheitliche Pixelgröße = sofortiges Ausschlusskriterium.** Ausgabe 750×1050 = 250×350-Raster × 3
   (`save(cv, 'NN_name.png')` erwartet ein Canvas 250×350). Baue jede Tiefenebene auf IHREM groben Raster
   (z. B. 125×175 für 2×, 84×117 für 3×, 63×88 für 4×) und skaliere sie einmal hoch – dann haben Figuren, Linien,
   Fäden, Kanten, Schatten und selbst gezeichnete Effekte dieser Ebene automatisch dieselbe Pixelgröße.
   Verschiedene Pixelgrößen NUR, wenn das größere Element eindeutig im Vordergrund steht (wie der Vampir in
   „Count of the Deep“ vor dem 2×-Schloss oder die Lupe im Detective Board). Nie zwei Figuren nebeneinander/auf
   gleicher Höhe mit verschiedener Skalierung, keine 1-px-Linien (250er-Raster) neben 2×-Figuren.
5. **Vollständige Figuren, keine fehlenden Pixel.** Sprites aus xcf-Ebenen, nicht aus Kartenbildern ausschneiden.
   Figuren bestehen oft aus mehreren Ebenen, die NICHT benachbart im Stapel liegen (Arme, Waffen, Umhänge, Kronen,
   Effekte liegen teils viele Ebenen weiter oben/unten). Prüfe JEDE Figur gegen ihre „Sichtbar“-Szene
   (scenes_with, scene_layers mit großem Radius, card_region_layers, touching; findcards.py) und vergleiche dein
   zusammengesetztes Sprite pixelweise mit dem Szenenausschnitt. Fehlt etwas, ergänze es aus der Szene oder editiere
   es plausibel nach. Bekannte frühere Fehler: Dante ohne Arme, T-Rex ohne Krone, Strongman ohne Keule,
   Moriarty ohne Körper, fehlende Pixel bei Ren/Balance/Spinne.
6. **Korrekte Positionierung und Logik.** Figuren stehen auf festem Boden (Füße auf der Bodenlinie, Schatten passend),
   Werkzeuge/Waffen treffen sinnvolle Ziele (Negativbeispiel: Spitzhacke schlägt über die Inselkante ins Leere),
   Fäden/Seile/Strahlen verbinden, was sie verbinden sollen, und hängen irgendwo fest; Größenverhältnisse plausibel.
7. **Komposition.** Klare Bildidee und Blickführung, Tiefe (Vorder-/Mittel-/Hintergrund), ruhiger Hintergrund.
   Nicht überladen, nicht gedrängt; **ausgewogen** (nicht unten- oder obenlastig: große/dunkle Figuren nicht alle auf
   eine Seite). Symmetrische Anordnungen wirklich symmetrisch (gespiegelte Plätze, ähnlich große Figuren als Paar,
   keine Figur weiter innen/außen als ihre Nachbarn). Keine Streumuster aus vielen kleinen gleichen Sprites, kein
   flacher Hintergrund mit nebeneinandergesetzten Sprites (verworfen: „Army of the Cute“, „Slippery Slope“).
8. **Transparenz** für Geister, Spiegelungen, Glas, Fäden erlaubt (geordnetes Dithering oder Alpha auf ganze Pixel
   derselben Rasterebene). Fäden wie bei den Puppen: 1 Pixel breit (im Raster ihrer Ebene), hell/dunkel
   Pixel für Pixel abwechselnd.
9. **Rahmen kommt später** per Skript (15 Bauformen, s. u.). Er deckt je Rand ca. 12–22 px des 250er-Rasters ab
   (bei „icicle“ oben bis 32). Also: Hintergrund bis zum Rand füllen, aber Wichtiges (Gesichter, Hände, Hauptmotiv)
   mindestens ~22 px vom Rand fernhalten. Keinen eigenen Rahmen zeichnen.
   Optional darf EIN Vordergrundelement über den Rahmen ragen (wie die Lupe im Detective Board): dann zusätzlich
   `runde4/generator/overlays/NN_name_base.png` (Bild ohne dieses Element, 750×1050) und `…_top.png`
   (nur das Element + Schatten, RGBA 750×1050) speichern und das in den Notizen vermerken.
10. **Keine Doppelungen.** Nicht wiederholen, was es schon gibt (Shop-Namen): Pixel Parties, Monster Handler,
    Blue Grin, Deepsea Awakening (Cthulhu), The Eye Sees You, Future Tech Blueprint, Wowhalla, King of Kings (Schach),
    Lunatic Cycle (Mondphasen), Pixel Pocket, Wanted: Blackstache, Church of the Light (Kirchenfenster), Slime Jar,
    Skullmael XIII (Tarot), Doom Clock, Lunar New Year, Heavenly Throne, Guardian Niu, Yokai Parade, Moonlit Duel,
    Fox Pond, Porthole, Into the Deep, Siren's Song, Luau, Fire and Storm, Aquatic Crest, Count of the Deep,
    Lava Diver, Steam Crest, Dwarf King, Hydra Duel, White Parade, Poison Card, T-Rex Breach, Skulltop Storm,
    The Summoning, Generals' Duel, Crossing the Alps, Blackstache's Bow, Weapon Storm, Rift in the Sky, Fun-Fun
    Circus, Dragon Flight, Close Encounter, Rise of the Phoenix, Ladder to the Sky, Life Serum, Blood Eclipse,
    Rotten Mastermind, Vanitas, Traveler's Portal, Class Photo, Inferno, Angel's Mirror, Raise the Minions,
    Slime Drive, Cybug Case, Dragon's Hoard, Last Round (Taverne), Midnight in London, Frozen Throne, Trojan Gift,
    Curtain Call, Nile Night, Circle of Fuses, Trident Shrine, Dragon Pilot, Witching Hour, Twin Reapers, Heart Bow,
    Exploding Skull, Mammoth Trek, Qinglong Storm, Bone Wyrm, Guardian Zodiac, Puppet Theater, Spider Nest,
    Pharaoh's Tomb, Gigantisaur Comic, Detective Board, Cycling Demons, Divine Balance.
    Ausgereizte Motivtypen, NICHT mehr: Konzert/Bühne/Vorhang, Bibliothek, Blutmond/roter Mond, Tierkreis-Ring,
    Pentagramm, Waage, Wanted-Plakat, Tarotkarte, Spinnennetz. Auch innerhalb von Runde 4 keine Doppelungen:
    **Trage deine 5 Ideen zuerst in `runde4/concepts.md` ein** (eine Zeile je Idee) und lies vorher, was die anderen
    schon eingetragen haben; ähnliche Idee schon da → andere wählen.
11. Abwechslung: Szene, Porträt/Close-up, Stillleben, Schaukasten/Vitrine, Blick durch Fenster/Schlüsselloch/
    Fernrohr, Spiegelung im Wasser, Silhouette vor Himmel, Luftbild/Draufsicht, Karte/Plan, Gruppenbild, Kampf,
    Reise, Jahreszeit/Wetter, Mosaik/Fliesen aus Spieltexturen … Jede Idee eigenständig.

## Material
- xcf-Ebenen als PNG: /home/user/sprites_export/<Datei>/ (layers.json: alle Ebenen mit Index, Name, Offset;
  index.json + crops/). Alle Ebenen einer Datei teilen ein Koordinatensystem. „Sichtbar …“-Ebenen sind fertige
  Szenen-Abzüge (ganze Kartenbilder in Originalpixeln) – zeigen, wie Ebenen zusammengehören, und taugen als
  Hintergrundquelle.
- Kontaktbögen aller Ebenen (Index + Name):
  /tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/cat/<Datei>_NN.png
- Karten: /home/user/PixelParties/cards/*.png (Bild im Bereich x 70–680, y 168–568), Kartendaten
  /home/user/PixelParties/data/cards.json. Karte in xcf-Szene finden:
  `python3 /home/user/sprites_export/findcards.py <Datei> "<Kartenname>" …` → Szene-Ebene + Lage.

## Werkzeuge (Python 3, Pillow/NumPy/OpenCV)
Skripte in /home/user/PixelParties/data/sleeve-proposals/runde4/generator/ ablegen, dort `from common import *`
(Code: runde2/generator/kit.py und xcfkit.py; Beispiele: runde3/generator/s*.py, runde2/generator/s0*.py).
- `sprite(key, datei, [ebenen])` → RGBA-Array (Ebenen in GIMP-Reihenfolge zusammengesetzt, zugeschnitten), wird unter
  generator/sprites4/<key>.png gecacht – Keys mit deinem Block-Präfix eindeutig halten (z. B. „c13_…“).
- `compose(datei, [ebenen], crop=True)`, `layer(datei, i)` (volle Leinwand), `layer_info`, `find(datei, 'Name')`,
  `parts(s, dil=1)`, `part_at(s, x, y)`, `split_x(s)`, `scene_sprite(key, datei, szene, loc, box)`,
  `scenes_with`, `scene_layers`, `card_region_layers`, `touching`, `bbox`.
- kit: `Canvas(w, h)` (beliebige Größe, z. B. 125×175), `cv.paste(rgba, x, y, alpha=…)`, `cv.px`, `cv.rect`,
  `up(s, k)`, `flip`, `rot90`, `hsv_shift`, `darken`, `tint`, `silhouette`, `fill_tiles`, `vignette`, `ordered`,
  `ring`, `disc`, `widen`, `save(cv, 'NN_name.png')` → schreibt nach runde4/.
- **Jedes Sleeve selbst mit dem Read-Tool ansehen und mindestens einmal verbessern** (Pixelgrößen? fehlende Pixel?
  Figuren vollständig? Füße auf dem Boden? Komposition ausgewogen? Hauptmotiv groß genug? Rahmenzone frei?).
  Tipp: Vorschau mit Rahmen: `sys.path.insert(0, '../../runde3/generator'); import frames2 as F;
  F.apply('../NN_name.png', '/tmp/.../x.png', 'ornate', 'gold', 'ruby')`.

## Rahmen-Vorschlag
Bauformen: ornate, double, twist, industrial, arch, icicle, bamboo, moulding, card, bone, cosmic, meander, wave,
stone, filigree. Paletten: gold, bronze, silver, lacquer, ebony, bamboo, brass, sea, wood, stone, iron, ice, gothic,
cosmic, bone. Steine: ruby, emerald, sapphire, amethyst, amber, jade, pearl, topaz, rose, onyx, lava, cyan, lime,
magenta (optional ein zweiter Stein). Wähle je Sleeve eine passende Kombination, im Block möglichst verschiedene
Bauformen.

## Ablieferung
- Pro Sleeve: `runde4/NN_kurzname.png` (750×1050, OHNE Rahmen) und `runde4/generator/sNN_kurzname.py`
  (reproduzierbar; Docstring nennt xcf-Dateien/Ebenen/Karten und die Skalierung jeder Tiefenebene).
- `runde4/notes_<Block>.md`: je Sleeve eine Zeile
  `NN | English Name | Idee | Skalierung (welche Ebene wie groß) | Quellen | Rahmen: form/palette/stein[/stein2]`.
  English Name: kurz, stimmungsvoll, ohne Nummer, keine Dopplung mit den Shop-Namen.
- **Keine git-Befehle**, keine Dateien außerhalb von runde4/ ändern, fremde Dateien nicht anfassen (andere Agenten
  arbeiten parallel; concepts.md nur um deine eigenen Zeilen ergänzen).
