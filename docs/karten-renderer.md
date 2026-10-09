# Karten werden zur Laufzeit gezeichnet

Das Spiel liefert keine fertigen Karten-PNGs mehr aus (früher ~1.200 Dateien, ~264 MB in `cards/`).
Stattdessen setzt der Browser jede Karte aus Rahmen, Symbolen, Schrift und der Kunst zusammen —
nach denselben Regeln wie das Magic-Set-Editor-Template, von dem das Pixelraster, die
Textboxen und die Zeilenabstände stammen. Die MSE-Dateien selbst gehören **nicht** ins Repo.

## Ablauf im Browser

```
<img src="/cards/Name.png">  ──►  card-image-shim.js  ──►  card-render.js  ──►  blob:-URL
                                   (Datei → Karte/Skin)      (Canvas 750×1050)
```

* `public/card-image-shim.js` fängt jede Bildquelle der Form `/cards/<Datei>.png` und
  `/cards/skins/<Skin>.png` ab (`img.src`, `setAttribute`, `new Image()`, per `innerHTML` erzeugte
  `<img>`). `img.src` liefert weiterhin die Karten-URL zurück — der Rest des Spiels bleibt unverändert.
  Sichtbare Bilder kommen zuerst an die Reihe, weit entfernte erst beim Scrollen; fertige Karten werden
  als `blob:`-URL gemerkt (LRU, 400 Stück). Gibt es zu einer Quelle keine Kunst, wird sie ganz normal
  vom Server geladen.
* `public/card-render.js` zeichnet die Karte (`window.CardRender`): Rahmen → Kunst (durch die Maske) →
  Name → Level/Schule → Typ-Symbol → Seltenheits-Rahmen → Werte → Effekttext → Ecken-Stempel.
  Text ist Vektorpfad (Umrisse der Schrift „Pixel Intv", `cardgen/glyphs.json`), nicht Browser-Text:
  so liegt jede Zeile auf jedem Gerät an derselben Stelle. Die Schriftgröße des Effekttexts wird wie
  in MSE per Binärsuche (7 Schritte, 7–20 pt) an die Textbox angepasst.
* Karten mit Skin = Basiskarte mit anderem Bild und Namen (`CardRender.renderCard(karte, { skin })`).
* **Seltenheit:** Das Foil-Kennzeichen aus `cards.json` gilt als Seltenheit, die das Spiel kennt
  (`diamond_rare` → Diamond, `secret_rare` → Super Rare) und bestimmt Rahmen, Textfarbe und Ecken-Stempel.
  Alle anderen Karten nehmen `r` aus `data/card-render.json` (aus den früheren Kartenbildern abgeleitet).
* **Diamond-Rahmen:** 14 px oben/unten, 15 px links/rechts (Template-`diafoil.png`), mit den Ecken des Gold-/
  Silberrahmens: je Ecke 2×2 Blöcke (Eckblock und diagonal innen gedämpft, die zwei Nachbarn am Rand dunkler);
  dazwischen wechseln Zellen (15 × 14 px, Raster 50 × 75) wie beim Gold ab der dritten Zelle zwischen zwei Tönen.
* **Symbole im Text:** Zauberschulen werden im Effekt- und Fähigkeitentext nur **im Zusammenhang mit Spells**
  durch die Bilder der Symbolschrift „PixelParties-text-replacements“ ersetzt: „Magic Arts Spells“ →
  „[Symbol] Spells“, ebenso Kurzformen („Destruction Spells“) und Aufzählungen („Decay or Support Spell“,
  „Destruction or Decay Magic Spell“: jede Schule davor). Wird die Fähigkeit selbst gemeint („Magic Arts 1“,
  „Fighting level“, „a Support Magic Ability“, „Support Zone“), bleibt der Name Text. Fighting hat sein
  Schwert statt „Spells“ vor „Attacks“ („Fighting Attacks“, und auf der Fähigkeitskarte Fighting steht es in
  jeder Stufe vor „Attacks“: „Allows the use of [Schwert] Attacks up to Level 1 …“). Die Regel steht in
  `SYMBOLS`/`SYM_RE` in `card-render.js` und stimmt mit den alten MSE-Karten überein (Abgleich aller
  Karten mit Schulnamen im Text gegen die früheren PNGs). Größe und Lage wie in MSE
  (Symbolgröße 8,5 bzw. 10,5 / `image font size` 30, Flächenmittel-Skalierung, mittig in der Zeile); ein
  Symbol zählt im Umbruch wie ein einzelnes Zeichen. Kartennamen und Fähigkeitsfelder der Helden bleiben Text.
  Weitere Symbole: Eintrag in `SYMBOLS`, Bild in `scripts/build-cardgen-sprites.py` (`SYMBOL_FILES`).

## Skin-Holo (Foil nur für Skin-Karten)

Skin-Karten tragen ein eigenes Holo-Foil, das **nur Kunst und Namen** betrifft (Rahmen, Werte, Regeltext
bleiben ruhig; bei Vollbild-Helden bleiben die Textfelder frei). Es ersetzt auf einer Karte mit Skin die
Foil-Schicht der Seltenheit.

* **Name:** `renderCard` zeichnet den Skin-Namen in einem Goldverlauf (`goldFill`), das gilt überall, wo die
  Karte als Bild erscheint. Darüber legt das Spiel einen Hauch wandernder Pastellfarben und einen weißen Glanz,
  beschnitten durch die Umrisse der Buchstaben (`nameMask`).
* **Kunst:** Das Muster ist keine Kachel, sondern wird aus der Kunst selbst gerechnet (`CardRender.holoLayers`,
  einmal je Skin, ~80–150 ms in mehreren Blöcken mit Atempausen): (1) Konturen auf dem nativen Pixelraster
  (die dunklere Seite jeder Kante, Stärke = Helligkeitssprung), (2) Abstandsfeld zur nächsten Kontur
  (Felzenszwalb-EDT; kräftige Umrisse zählen, als lägen sie näher), (3) Echolinien im Abstandsfeld —
  sie umlaufen jede Kontur wie Höhenlinien und erhalten je Linie und Ort einen anderen Farbton,
  (4) Prägung aus der geglätteten Helligkeit (Licht von links oben). Heraus kommen drei PNG-Blobs
  (`holo`, `relief`, `nameMask`) plus die Lage in Prozent der Karte als CSS-Variablen (`CardRender.holoFor`,
  LRU 40).
* **Anzeige:** `SkinHolo` (app-shared.jsx) legt die Schichten übers Bild; Animation nur per `transform`/`opacity`
  unter statischen Masken (style.css, „SKIN-HOLO“): Prägung (fest), drei im Farbton gedrehte Linienabzüge,
  die per Deckkraft ineinander geblendet werden, ein Glanzband, das nur auf den Linien aufleuchtet, und der
  Namensglanz. Kleinansicht (`FoilKleinContext`), Telefone (Lite) und „Play Animations: aus“ zeigen einen
  ruhigen Zustand (ein Linienabzug, kein Glanz).
* **Anschluss:** nur über `CardFoil` — `<CardFoil card={…} skin={…} />`; der Skin lässt sich aus einer
  Bild-URL lesen (`skinOfUrl(url)`), deshalb greift es automatisch in `CardMini`, `BoardCard`, den Tooltips
  (`CardSideTooltip`, `CardTooltipContent`), dem Spielerprofil und der Skin-Galerie des Deck-Editors.
  `scripts/check-foil.js` hält fest, dass `<SkinHolo>` nur in `CardFoil` steht.
* **Stellschrauben:** `CardRender.HOLO` (`on`, `period`, `width`, `reach`, `floor`, `seed`, `relief`);
  `HOLO.on = false` schaltet alles ab (auch den goldenen Namen); `data/card-render.json` →
  `skins[<Name>].holo = false` nimmt einen einzelnen Skin aus.

## Dateien

| Pfad | Inhalt |
| --- | --- |
| `public/cardgen/sprites.png` + `.json` | alle Rahmen, Masken, Symbole (auch die Text-Symbole), Ecken-Stempel (Pixelraster 1/10, ~25 KB) |
| `public/cardgen/glyphs.json` | Schrift-Umrisse (aus `data/Pixel Intv.otf`) |
| `public/cardgen/art.png` + `.json` | **Atlas** der Kunst: ~1.240 Motive im NATIVEN Pixelraster (meist 76×51) |
| `public/cardgen/art/<id>.webp` | wenige Motive (Archer, Cannon Tower, …), die kein sauberes Raster haben — in Vollauflösung |
| `data/card-art/index.json` + `native/*.png` | Quelle des Atlas (`Karte/Skin → { id, kind }`; `a` = Atlas, `b` = Vollauflösung) |
| `data/card-render.json` | Seltenheit (`r`), Rahmen (`f`), Sonderfälle je Karte; Anzeigenamen/Flags der Skins |

Der Renderer streckt die native Kunst per nearest neighbour auf das Bildfeld (610×400, bei
Vollbild-Helden 750×1050) — dieselbe Streckung wie im Template. Foils sind nicht Teil der Karte:
nur die goldenen Rahmenelemente sind übernommen, die Foil-Effekte macht das Spiel dynamisch.

## Skripte

```bash
# Sprites aus dem MSE-Style-Ordner (liegt außerhalb des Repos); die Symbolschrift
# (PixelParties-text-replacements.mse-symbol-font) wird neben dem Style-Ordner gesucht, sonst --symbols <Ordner>
python scripts/build-cardgen-sprites.py --src <…/PixelParties-standard.mse-style>
# Schrift-Umrisse (benötigt fonttools)
python scripts/build-cardgen-glyphs.py
# Kunst-Atlas aus data/card-art (räumt nicht mehr benutzte art/*.webp auf)
python scripts/build-card-art.py
```

Neue Karte: Motiv im nativen Raster als `data/card-art/native/<id>.png` ablegen, in
`data/card-art/index.json` eintragen (`"<Kartenname>": { "id": "<id>", "kind": "a" }`) und
`build-card-art.py` laufen lassen. Seltenheit/Rahmen kommen aus `data/card-render.json`
(Standard: häufig, Rahmen passend zum Kartentyp aus `cards.json`). Neuer Skin: dasselbe mit dem
Schlüssel `skin/<Skinname>`; der Name muss in `data/skins.json` stehen.

## Hinweise

* Server: `card-images.js` kennt „Karte hat Bild" jetzt aus `public/cardgen/art.json` (zusätzlich zu
  evtl. noch vorhandenen Dateien in `cards/`); `/api/cards/available`, Shop, Tages-Held und
  Skill Test arbeiten damit ohne PNG-Ordner. Freischaltbare Skins sind in `data/card-render.json`
  mit `unlockable: true` gekennzeichnet (`unlockable-skins.js`).
* Die Kunst wurde aus den früheren Karten-PNGs gewonnen (Foil herausgerechnet, Raster rekonstruiert).
  Die alten PNGs stehen weiter in der Git-Historie (`git log -- cards`), falls ein Offline-Werkzeug
  sie braucht (`scripts/hero-animations`, `scripts/sleeve-entwuerfe`, `scripts/avatar-entwuerfe`,
  `scripts/sharpen_card_art.py`).
* Umschalter zum Ausprobieren: `CardRender.OPT` (z. B. `OPT.silverRim = false` blendet den silbernen
  Rahmen der Seltenheit „rare" aus).
