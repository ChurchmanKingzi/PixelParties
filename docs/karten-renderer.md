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
Foil-Schicht der Seltenheit. Vorbild ist ein Full-Art-Holo: feine Schraffur über dem ganzen Bild, das Motiv
bleibt klar erkennbar, die Farben sind bewusst gedämpft. (Konturen-Leuchtlinien, Flächen-Tönung, Echolinien und
Prägung wurden ausprobiert und verworfen — auf Pixelart wirkten sie unruhig bzw. verwaschen.)

* **Name:** `renderCard` zeichnet den Skin-Namen in einem Goldverlauf (`goldFill`), das gilt überall, wo die
  Karte als Bild erscheint. Darüber legt das Spiel einen Hauch wandernder Pastellfarben und einen weißen Glanz
  (ein Band kreuzt jeden Punkt alle ~1,5 s), beschnitten durch die Umrisse der Buchstaben (`nameMask`). **Super Rare**
  (gold) und **Diamond Rare** (türkis) tragen denselben Namensglanz (`FoilName`, `CardRender.nameShimmerFor`);
  in Kleinansichten entfällt er dort.
* **Kunst:** feine Schrägstriche (Schraffur) mit wanderndem Pastell-Regenbogen und Glanzbänder, die ruhig über
  das Bild gleiten (ein Band kreuzt jeden Punkt alle ~1,8 s, meist ein Band zugleich). Beides liegt nur auf den helleren Flächen: `CardRender.holoLayers` rechnet dafür eine
  **Maske** aus dem nativen Pixelraster der Kunst (meist 76×51, gleiche Streckung wie `draw`, keine Unschärfe),
  je Pixel eine Stärke aus Helligkeit und Sättigung (Graustufen schwächer); dunkle Pixel (Umrisse, Schatten) bleiben
  frei, die Zeichnung bleibt scharf. Einmal je Skin, ~20 ms. Heraus kommen zwei PNG-Blobs (`all`, `nameMask`) plus
  die Lage in Prozent der Karte als CSS-Variablen (`CardRender.holoFor`, LRU 40).
* **Anzeige:** `SkinHolo` (app-shared.jsx) legt die Schichten übers Bild; Animation nur per `transform` unter
  statischen Masken (style.css, „SKIN-HOLO“): Schraffur (Maske aus `repeating-linear-gradient` in `cqw`, wächst mit
  der Karte, geschnitten mit der Flächenmaske; unter 150 px Kartenbreite aus), Glanzband (dieselbe Maske) und
  Namensglanz. Kleinansicht (`FoilKleinContext`): nichts (der goldene Name steckt im Kartenbild). Telefone (Lite)
  und „Play Animations: aus“: Schraffur still, kein Glanz.
* **Anschluss:** nur über `CardFoil` — `<CardFoil card={…} skin={…} />`; der Skin lässt sich aus einer
  Bild-URL lesen (`skinOfUrl(url)`), deshalb greift es automatisch in `CardMini`, `BoardCard`, den Tooltips
  (`CardSideTooltip`, `CardTooltipContent`), dem Spielerprofil und der Skin-Galerie des Deck-Editors.
  `scripts/check-foil.js` hält fest, dass `<SkinHolo>` und `<FoilName>` nur in `CardFoil` stehen.
* **Stellschrauben:** `CardRender.HOLO` (`on`, `dark`, `full`, `neutral`) und die Deckkraft-/Takt-Werte im
  CSS-Block „SKIN-HOLO“; `HOLO.on = false` schaltet alles ab (auch den goldenen Namen und den Namensglanz);
  `data/card-render.json` → `skins[<Name>].holo = false` nimmt einen einzelnen Skin aus.

### Schraffur auf Fullart-/Rare-Karten und Rahmenglanz

* **Schraffur und Glanzband ohne Skin:** dieselbe Schraffur und dasselbe Glanzband (ohne Namen) liegen auf dem Bild aller **Fullart-Karten**
  (Ascended Heroes und Fullart-Helden, nach Kartentyp: `CardRender.hatchEligible`) sowie aller **Super und Diamond
  Rares** (Foil-Kennzeichen). Die Maske kommt aus der Kunst der Karte selbst (`CardRender.hatchFor`, LRU 80). Die
  Textur wird erst geladen, wenn die Karte mindestens 150 px breit gezeichnet wird (`FoilHatch`, `useEffektHuelle`) —
  auf Brett, Hand und in Galerien kostet sie nichts. Bei Fullarts liegen beide Schichten auf der ganzen Fläche
  außer Namensleiste, Fähigkeitenfeldern, Regeltext und Werten (die Rahmenmaske ist hart ausgeschnitten; gemessen:
  0 geänderte Pixel innerhalb der Textfelder).
* **Rahmenglanz:** Gold-, Silber- und Diamant-Rahmen glänzen in ihrer Farbe: Lichtbänder (ein Band kreuzt
  jeden Punkt alle ~2,4 s) laufen über die Karte und leuchten nur auf dem Rahmen auf (`FoilRim`). Welche Farbe, entscheidet `CardRender.rimKind` aus Kartentyp
  und Seltenheit (Superhelden/Fullart-Helden und Super Rare = Gold, Rare = Silber, Diamond = Türkis; bei Skins gelten
  deren Werte). Die Maske ist die Form des Rahmens in halber Kartengröße (`drawRim`, derselbe Code wie das Kartenbild) und
  hängt nur von Kartentyp und Seltenheit ab — es gibt höchstens 5 Stück, alle Karten teilen sie. Erst ab 120 px Breite;
  nicht in Kleinansichten und im Lite-Modus.
* Beides hängt wie alles andere nur an `CardFoil`; `scripts/check-foil.js` prüft `<FoilHatch>` und `<FoilRim>` mit.

### Glanzbänder: Streifenmuster statt Einzelband

Bild-, Namens- und Rahmenglanz sind kein einzelnes Band, das alle paar Sekunden durchläuft, sondern ein Element mit
sich wiederholendem Streifenmuster (`background-size` = Kachel, `repeat-x`), das sich linear um genau eine Kachel
verschiebt: ein Band ist (meist) sichtbar, die Frequenz lässt sich ändern, **ohne zusätzliche Ebenen** (weiter eine
animierte Ebene je Glanz). Zwei CSS-Variablen stellen es ein:

| Glanz | `--kachel` (Abstand in Feldbreiten) | `--takt` (ein Band kreuzt jeden Punkt alle …) | Geschwindigkeit |
| --- | --- | --- | --- |
| Bild (`.skin-holo-glint i`) | 1,0 Bildbreiten | 1,8 s | 0,56 Feldbreiten/s |
| Name (`.skin-holo-name .sh-gl`) | 0,8 Namensbreiten | 1,5 s | 0,53 |
| Rahmen (`.skin-holo-rim i`) | 1,2 Kartenbreiten | 2,4 s | 0,50 |

**Richtung: von oben-links nach unten-rechts.** Die Streifen stehen als „/" (`skewX(-20deg)`); verschiebt sich das Muster
nach rechts (`translateX` von `-Kachel` nach `0`), wandert jedes Band senkrecht zu seiner Linie nach unten-rechts. (Gemessen
an den gerenderten Pixeln: die hellste Bandspalte wandert in jedem Schritt nach rechts, oben liegt das Band rechts von unten.)

Verlauf der Einstellungen (Bild): erst alle 5,5 s ein Einzelband, dann alle 2 s; ein Streifenmuster alle 0,7 s und alle 1,2 s
war jeweils zu hektisch, jetzt 1,8 s mit größerem Abstand. Das Element ist (1,4 + `--kachel`) Feldbreiten breit (Platz für
Schräge und Verschiebung), Breite, Kachelgröße und Verschiebung folgen per `calc()` daraus. Grundzustand `opacity: 0`: ohne
Animation (Lite, „Play Animations: aus“) steht kein Muster. Kosten: der Compositor zeichnet die ganze Fläche statt eines
schmalen Bandes (Software-Rendering: etwa doppelte Zeichenzeit am Tooltip, 60 fps bleiben).

### Performance der Foil-Schichten

Jede dieser Schichten ist eine Maske mit laufender Animation; auf Brett, Hand und in Galerien stehen davon sonst
dutzende zugleich. Darum gilt (gemessen, siehe unten):

* **Nur wo man sie sieht:** Skin-Holo, Namensglanz und Rahmenglanz werden erst ab **120 px** Kartenbreite angelegt und
  ihre Texturen erst dann gerechnet (Schraffur: 150 px); auf **Touch-Geräten** (`pointer: coarse`) erst ab **240 px**
  — dort bleiben Tooltip und Großansichten (`ppEffektMin`, `useEffektHuelle` in app-shared.jsx). Kleinansichten
  (`FoilKleinContext`) bekommen nichts.
* **Außerhalb des Bildschirms** halten die Schichten an (`.sh-ausserhalb`, ein gemeinsamer `IntersectionObserver`; ein
  gemeinsamer `ResizeObserver` für alle Karten).
* **Mittelgroße Karten** (< 300 px) und alle Touch-Geräte: der wandernde Regenbogen der Schraffur und das Farbwandern des
  Namens stehen still; es animieren nur die Glanzdurchläufe (Bild, Rahmen, Name — je ein `transform`). Telefone im
  Querformat (Lite): auch die Glanzdurchläufe aus.
* **Kein `mix-blend-mode`:** die Hülle `.skin-holo` ist ein Stacking-Kontext, die Blends wirkten nur in eine leere Gruppe
  (gemessen: Bild mit und ohne pixelgleich), kosteten aber je Schicht eine zusätzliche Offscreen-Fläche.
* **Rahmen-Ringe bleiben auf Skin-Karten:** hat die Basiskarte ein Foil, braucht die Karte die billigen `foil-rahmen`-
  Ringe, sonst fällt das CSS auf den alten `box-shadow`-Puls zurück (der teuerste Dauerläufer einer Foil-Karte).
* **Alter Diagonalglanz** der Foil-Karten (Bänder, `.foil-band`): **abgestellt** (`FOIL_DIAGONALGLANZ = false` in
  app-shared.jsx; `makeFoilBands` liefert dann keine Bänder). Der Code bleibt stehen, `true` schaltet ihn wieder ein
  (dann 2 statt 5 Bänder, Diamond 1 statt 3, mit ~3× längerem Takt). Funken, Staub, Schimmer und Rahmen-Ringe laufen weiter.
* Textur-Berechnung ~20–50 ms je Skin (in Blöcken mit Atempausen), Rahmenmasken höchstens 5 für alle Karten.

Messung (Headless-Chromium, Software-Rendering, Median aus 3 Läufen; Handy-Profil: 390×844, Touch, CPU 4× gedrosselt;
Szenen mit `CardMini` aus den gebauten Bundles, „Holo AUS“ = `CardRender.HOLO.on = false`):

| Szene | normale Karten | Holo AUS | Holo AN |
| --- | --- | --- | --- |
| Brett, 12 Karten à 82 px | 61 fps | 18 fps | 20 fps |
| Galerie, 12 Karten à 150 px | 61 fps | 25 fps | 33 fps |
| Tooltip, 1 Karte à 360 px | 61 fps | 61 fps | 60 fps (+10 Ebenen) |

Nach dem Abstellen des Diagonalglanzes (zuletzt 2 Bänder je Karte) liegen Brett und Galerie bei 19 bzw. 29 fps mit 161 bzw.
111 Ebenen (vorher 171 bzw. 118): ein kleiner Gewinn, die Bänder waren meist unsichtbar. Die Last in „Holo AUS“ stammt vom
**bestehenden** Foil der Super/Diamond Rares — heute vor allem Funken (je 11) und Staub (je 6) je Karte; die neuen
Schichten legen in Massenansichten nichts obendrauf. Worst Case Desktop (6 Karten à 210 px, alles aktiv): 37 → 28 fps
bei reinem Software-Rendering; teuerster Einzelposten ist der Rahmenglanz (Maske über die ganze Karte).

### Vollbild-Karten: deckende Umrisse

Bei Fullart-Karten (Ascended Heroes, Fullart-Helden) scheint das Bild blass durch die Boxen (Name, Fähigkeiten, Effekt,
Werte). Die Masken des Templates (`mask.fullart`, `mask.hero`) haben drei Stufen: 0 = Umrisslinie der Box (Rahmen voll
sichtbar), 51 = Füllung (20 % Bild), 255 = Bildfläche. Direkt innen an der Umrisslinie lagen aber noch die Bevel-Zeilen
(dunkle/helle Innenkante) auf Stufe 51 — durch sie schien das Bild und machte die Umrandung fleckig. `hardMask`
(card-render.js) macht sie hart: Pixel im Abstand 1 zur Umrisslinie werden deckend (Maske 0), im Abstand 2 jene, die nicht
die Füllfarbe haben. Die Füllung weiter innen (samt Dithering) bleibt halbtransparent. Einmal je Maske gerechnet;
`CardRender.OPT.hardOutlines = false` schaltet es ab.

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

## Dauerhafter Cache (IndexedDB)

Karten entstehen im Browser. Ohne Gedächtnis müsste nach **jedem Refresh** jede sichtbare Karte neu gezeichnet und als PNG
kodiert werden (gemessen ~37 ms je Karte auf dem Desktop, auf dem Handy ein Vielfaches). Der Karten-Cache im Shim
(`cache`, LRU 400) lebt nur im Arbeitsspeicher; darum heben `card-image-shim.js` und die Foil-Funktionen ihre fertigen
Bilder/Texturen zusätzlich dauerhaft in IndexedDB (`pp-render-cache`, Store `kv`) auf und holen sie beim nächsten Besuch zurück.

* **Was:** jede gezeichnete Karte (`c:<id>`, PNG-Blob, im Mittel 96 KB), die Skin-Maske samt Namensumriss (`h:<Skin>`), Schraffur-
  Masken (`a:<Karte>`), Namensumrisse der Rares (`n:<Karte>`) und die Rahmenmasken (`r:<Art>`). Lite-Geräte merken ihre halbaufgelösten
  Texturen unter eigenem Schlüssel (`:l`).
* **Gültigkeit:** `/api/render-version` (server.js, `render-version.js`) liefert einen **Inhalts**-Fingerabdruck von `card-render.js`,
  `card-image-shim.js`, Sprites, Schrift, Kunst-Atlas (samt Einzelbildern), `cards.json`, `card-render.json` und `skins.json`.
  Weicht der im Browser gemerkte Wert ab, wird der ganze Vorrat geleert — ein Update gilt sofort für alle (Vorgabe in server.js).
  Inhalt statt Zeitstempel, damit ein Deploy ohne Änderung den Cache nicht entwertet; je Datei wird nur neu gehasht, wenn sich Zeit
  oder Größe ändern (kalt ~50 ms, danach ~1 ms).
* **Grenzen und Rückfall:** höchstens 170 MB (`PC_MAX`; alle ~1.190 Karten wären ~112 MB, gemerkt wird nur, was je angezeigt wurde);
  Schreibfehler/„Speicher voll“ schalten das Merken für die Sitzung ab; ohne Version, ohne IndexedDB (privates Fenster, gesperrt) oder
  bei Quote < 64 MB bleibt alles beim Alten (jedes Mal zeichnen). Ein beschädigter Eintrag (nicht dekodierbar) wird beim `error` der
  Karte verworfen und die Karte neu gezeichnet (`CardImageShim.stats.recovered`).
* **Messung** (Headless-Chromium, 60 Karten, derselbe Browser-Kontext): kalt 2.205 ms (36,8 ms/Karte), Refresh 309 ms (5,1 ms/Karte),
  alle 60 aus dem Cache, 0 neu geschrieben. Gecachte Karten sind pixelgleich mit frisch gezeichneten (6 Karten, 18,9 Mio. Werte, 0 Abweichungen).
  `CardImageShim.cacheStats()` zeigt Treffer, Schreibvorgänge und Belegung.
* **Dateien** (Rahmen, Schrift, Atlas, Daten) werden unverändert bei jedem Aufruf per ETag nachgefragt (`maxAge: 0`, 304 ohne Inhalt):
  das ist die bindende Vorgabe „Updates sofort“ aus server.js und kostet nur Anfragen, keine Zeichenarbeit.

### Warum F5 trotz Cache langsam sein konnte (im echten Spiel gemessen)

Der Cache allein reichte nicht; drei Dinge standen davor:

1. **Zufällige Kartenwand im Hauptmenü** (`MenuCardBackground`, `app-screens.jsx`): jeder Besuch zog ~70 *andere* zufällige Karten
   (je Kachel doppelt im DOM = ~140 `<img>`) — fast alle nie gecacht, ~164 Zeichnungen je F5, die vor den Deck-Editor-Karten in der
   Warteschlange standen. Jetzt gibt es einen **Tages-Pool** (`MENU_BG_POOL = 90`, mit dem Datum als Samen gemischt): dieselben
   Karten den ganzen Tag, nach dem ersten Besuch kommt die Wand komplett aus dem Cache.
2. **Dekoration darf nichts aufhalten:** Bilder mit `data-card-low` laufen in der eigenen Stufe 3 der Warteschlange, hinter allem,
   was jemand ansehen will. Aufträge für Bilder, die nicht mehr in der Seite stehen (Menü verlassen), werden übersprungen
   (`stats.dropped`) und beim Wiedereinhängen vom MutationObserver (`adopt`) nachgeholt.
3. **PNG-Kodierung im Worker:** `canvas.toBlob` kodiert im Leerlauf des Hauptthreads. Auf einer belebten Seite (Menü-Animation)
   dauerte das 1–6,7 s je Karte (Ø 2,7 s), und weil der Arbeiter während dessen seinen Platz hielt, blockierten drei solcher
   Kodierungen **alle** Arbeiter — auch die für sichtbare Karten. `CardRender.toBlob` kodiert jetzt in einem Web Worker
   (`createImageBitmap` → `OffscreenCanvas.convertToBlob`): Ø 20–33 ms je Karte, pixelgleich zum Hauptthread-Ergebnis
   (30 Karten, 94,5 Mio. Werte, 0 Abweichungen, gleiche Dateigröße). Ohne Worker/OffscreenCanvas fällt jede Karte auf
   `canvas.toBlob` zurück; nach drei Fehlschlägen wird der Worker abgeschaltet. Gilt für alle Aufrufer (Karten, Skin-Masken,
   Schraffur, Namensumrisse, Rahmen).

Messung im echten Spiel (Headless-Chromium ohne GPU, also pessimistisch; Anmeldung → F5 → Deck Editor öffnen):

| | erste Karte sichtbar | alle 16 sichtbaren |
|---|---|---|
| Cache an, aber Zufallswand im Menü | 7,5–10,7 s | — |
| + Tages-Pool und Stufe 3 | 0,9–1,2 s | — |
| + Kodierung im Worker (F5, Cache warm) | 0,4–0,7 s | 0,6–0,9 s |

Die Kartenwand im Menü ist nach F5 (kalter Cache, 90 Karten rendern + kodieren) nach ~5 s vollständig, bei warmem Cache und
nach dem Zurückwechseln aus dem Deck Editor nach ~2,5–3,5 s (darin stecken 1,2 s Wartezeit des Vorrenderns). Der Rest der
Verzögerung beim Öffnen des Deck Editors ist Stil-/Paint-Arbeit des Browsers, nicht die Kartenerzeugung (JS ~50 ms).

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
