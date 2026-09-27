# Hero-Idle-Animationen

Generator-Skripte für die animierten Hero-Sprites in `data/hero-animations/`.
Jedes Skript liest das Original-Sprite aus `src/` und erzeugt daraus ein
Spritesheet (alle Frames horizontal nebeneinander) sowie ein vergrößertes
Vorschau-GIF.

## Benutzung

Aus diesem Ordner heraus aufrufen (die Skripte nutzen relative Pfade):

```bash
cd scripts/hero-animations
python3 styx.py final        # -> styx_idle_sheet_final.png + styx_idle_final.gif
```

Abhängigkeiten: Python 3, `pillow`, `numpy`.

Das erzeugte Sheet wird unter dem Hero-Slug nach `data/hero-animations/`
kopiert, daneben liegt eine JSON-Datei mit den Metadaten. Die erzeugten
`*.gif`/`*sheet*.png` in diesem Ordner sind Arbeitsdateien (siehe `.gitignore`).

| Skript | Aufruf | Ausgabe-Sheet | Ziel in `data/hero-animations/` |
|---|---|---|---|
| `elana.py` | `gitarre` | `elana_idle_sheet_gitarre.png` | `elana-the-rocky-rebel` |
| `styx.py` | `final` | `styx_idle_sheet_final.png` | `styx-the-gate-to-the-spirit-world` |
| `rubin.py` | `final` | `rubin_idle_sheet_final.png` | `rubin-the-dragoneer-champion` |
| `ghuanjun.py` | `final` | `ghuanjun_idle_sheet_final.png` | `ghuanjun-the-undead-martial-artist` |
| `semi.py` | `final` | `semi_idle_sheet_final.png` | `treasure-huntress-semi` |
| `waflav.py` | `final` | `waflav_idle_sheet_final.png` | `swampborne-waflav` |
| `medea.py` (+ `medea_layers.py`) | `final` | `medea_idle_sheet_final.png` | `medea-the-swamp-witch` |
| `reiza.py` | `final` | `reiza_idle_sheet_final.png` | `reiza-the-chief-tormentor` |
| `sparrow.py` | `final` | `sparrow_idle_sheet_final.png` | `sparrow-the-buffoon-of-the-treasure-cave` |
| `guelde.py` | `final` | `guelde_idle_final_sheet.png` | `g-ldefaber-the-king-of-dwarfs` |
| `chaos.py` | `final` | `chaos_idle_final_sheet.png` | `chaos-diamond-the-cracked-keeper` |
| `kazena.py` | `final` | `kazena_idle_final_sheet.png` | `kazena-the-storming-rebel` |
| `damus.py` | `final` | `damus_idle_final_sheet.png` | `damus-the-prophet-of-apocalypse` |
| `rick.py` | `final` | `rick_idle_final_sheet.png` | `rick-the-trigger-happy-undertaker` |
| `sett.py` | `final` | `sett_idle_final_sheet.png` | `sett-the-adept-of-necromancy` |
| `archibald.py` | `final` | `archibald_idle_final_sheet.png` | `archibald-the-archmage` |
| `nao.py` | `final` | `nao_idle_final_sheet.png` | `nao-the-barrier-priestess` |
| `rafflesia.py` | `final` | `rafflesia_idle_final_sheet.png` | `rafflesia-the-poison-princess` |
| `dante.py` | `final` | `dante_idle_final_sheet.png` | `dante-the-wanderer-of-hell` |
| `zsos.py` | `final` | `zsos_idle_final_sheet.png` | `zsos-ssar-the-serpent-warlord` |
| `baaliel.py` | `final` | `baaliel_idle_final_sheet.png` | `baaliel-the-demon-general` |
| `inya.py` | `final` | `inya_idle_final_sheet.png` | `card-game-player-inya` |
| `zwei.py` | `final` | `zwei_idle_final_sheet.png` | `zwei-the-lucky-thief` |
| `night.py` | `final` | `night_idle_final_sheet.png` | `night-the-herald-of-chess` |
| `kasparov.py` | `final 90 b` | `kasparov_b_idle_final_sheet.png` | `kasperov-the-king-of-kings-b` |
| `kasparov.py` | `final 90 w` | `kasparov_w_idle_final_sheet.png` | `kasperov-the-king-of-kings-w` |
| `darion.py` | `final 80` | `darion_idle_final_sheet.png` | `darion-the-blood-crazy-groundskeeper` |
| `ghazma.py` | `final` | `ghazma_idle_final_sheet.png` | `ghazma-the-worm-feeder` |
| `sid.py` | `final` | `sid_idle_final_sheet.png` | `sid-the-king-of-thieves` |
| `beato.py` | `final` | `beato_idle_final_sheet.png` | `beato-the-butterfly-witch` |
| `fiedel.py` | `final` | `fiedel_idle_final_sheet.png` | `fiedel-the-mercenary-mage` |
| `boris.py` | `final` | `boris_idle_final_sheet.png` | `boris-the-guardian-of-blackport` |
| `arthor_king.py` | `final` | `arthor_king_idle_final_sheet.png` | `arthor-the-king-of-blackport` |
| `lilly.py` | `final` | `lilly_idle_final_sheet.png` | `lilly-the-charming-infiltrator` |
| `arthor_sword.py` | `final` | `arthor_sword_idle_final_sheet.png` | `arthor-inheritor-of-the-barbarian-sword` |
| `locke.py` | `final 80` | `locke_idle_final_sheet.png` | `locke-the-unseen-saboteur` |
| `mary.py` | `final 70` | `mary_idle_final_sheet.png` | `cute-princess-mary` |
| `mini.py` | `final` | `mini_idle_final_sheet.png` | `cute-annoyance-mini` |
| `tarleinn.py` | `final` | `tarleinn_idle_final_sheet.png` | `tarleinn-the-traveler` |
| `crestina_fq.py` | `final` | `crestina_fq_idle_final_sheet.png` | `fairy-queen-crestina-the-creation-fairy` |
| `mirjam.py` | `final` | `mirjam_idle_final_sheet.png` | `mirjam-the-fallen-cute-angel` |
| `crestina_true.py` (+ `crestina_wings.py`) | `final` | `crestina_true_idle_final_sheet.png` | `true-fairy-crestina-the-primordial-goddess` |
| `megu.py` | `final` | `megu_idle_final_sheet.png` | `cute-starlet-megu` |
| `vena.py` | `final` | `vena_idle_final_sheet.png` | `vena-the-bounty-huntress` |
| `monia.py` | `final` | `monia_idle_final_sheet.png` | `cool-rescuer-monia` |
| `monami.py` | `final` | `monami_idle_final_sheet.png` | `cute-ditz-monami` |
| `magenta.py` | `final` | `magenta_idle_final_sheet.png` | `cute-nerd-magenta` |
| `jenny.py` | `final` | `jenny_idle_final_sheet.png` | `jenny-the-class-fairy` |
| `molinda.py` (+ `molinda_wings.py`) | `final` | `molinda_idle_final_sheet.png` | `molinda-the-cutest-being-in-the-sky` |
| `alice.py` | `final` | `alice_idle_final_sheet.png` | `alice-the-transfer-student` |
| `mithuru.py` | `final` | `mithuru_idle_final_sheet.png` | `lord-mithuru-the-rotten-mastermind` |
| `thalia.py` | `final` | `thalia_idle_final_sheet.png` | `thalia-the-fun-fairy` |
| `null.py` | `final` | `null_idle_final_sheet.png` | `null-the-mage-slayer` |
| `maho.py` | `final` | `maho_idle_final_sheet.png` | `maho-the-cute-magical-girl` |
| `atta.py` | `final` | `atta_idle_final_sheet.png` | `atta-speaker-of-desires` |
| `bubbles.py` | `final gross` | `bubbles_idle_final_gross_sheet.png` | `bubbles-the-bouncy-bunny` |

`bubbles.py` ohne `gross` erzeugt eine auf Hero-Größe verkleinerte Variante
(Sprite aus `bubbles_downscale.py`), die aktuell nicht verwendet wird.

Alle Skripte sind deterministisch und reproduzieren die eingecheckten Sheets
pixelgenau.

## Sprites aus den xcf-Arbeitsdateien

Die GIMP-Arbeitsdateien liegen im Repo `PixelPartiesSprites` (Git LFS).
`xcf_extract.py` listet Ebenen, zeigt sie einzeln an und setzt ausgewählte
Ebenen (in Stapelreihenfolge, mit Deckkraft) zu einem zugeschnittenen Sprite
zusammen:

```bash
python3 xcf_extract.py MotiveMoe.xcf list mary                 # Ebenen suchen
python3 xcf_extract.py MotiveMoe.xcf preview vorschau.png 485 489
python3 xcf_extract.py MotiveMoe.xcf assemble src/cute-princess-mary.png "Mary-Kopie" "Mary #1"
```

| Sprite in `src/` | Datei | Ebenen |
|---|---|---|
| `cute-princess-mary.png` | `MotiveMoe.xcf` | `Mary-Kopie` (goldene Mary mit Krone) + `Mary #1` (Flügel) |
| alle übrigen MotiveMoe-Heroes | `MotiveMoe.xcf` | reproduzierbar per `python3 assemble_moe.py <MotiveMoe.xcf>` (Zuordnung im Skriptkopf) |
| MotiveArcanum-Heroes | `MotiveArcanum.xcf` | reproduzierbar per `python3 assemble_arcanum.py <MotiveArcanum.xcf>` (Zuordnung im Skriptkopf) |

Neue Datei durchsuchen: `xcf_scan.py dump` legt alle Ebenen einzeln ab,
`xcf_scan.py match <ordner> --heroes` gleicht sie mit allen noch nicht
animierten Hero-Karten ab (Fehler relativ zum Kontrast der Ebene – Werte
um 0,2–0,4 sind echte Treffer, ab ~0,45 Rauschen) und `xcf_scan.py sheet`
zeigt Karte und beste Ebenen nebeneinander. Aus dem Repo-Wurzelordner:

```bash
python3 scripts/hero-animations/xcf_scan.py dump MotiveArcanum.xcf /tmp/arc
python3 scripts/hero-animations/xcf_scan.py match /tmp/arc --heroes
python3 scripts/hero-animations/xcf_scan.py sheet /tmp/arc /tmp/arc_treffer.png 0.45
```

`assemble_moe.py` speichert bewegliche Teile zusätzlich deckungsgleich als
`src/<slug>-<teil>.png` (z. B. `-body`, `-wings`, `-arm`, `-flames`, `-fist`),
damit Flügel, Arme oder Feuer getrennt animiert werden können.
Achtung: nicht jede Ebene mit Namen des Heroes ist die richtige – Ascended
Molinda liegt z. B. in `Ascended Molinda-Kopie`, nicht in `Ascended Molinda`.

Abgleich immer mit der Karte in `cards/<Kartenname>.png`: dieselbe Figur liegt
oft in mehreren Farb-/Kostümvarianten in der Datei (z. B. `Mary` = rote
Variante ohne Krone/Flügel), Hintergründe/Auren der Karte gehören nicht zum Sprite.

## Konventionen

* **Dateiname** = Kartenname wie bei den Effekt-Skripten:
  `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` ohne Rand-Bindestriche
  (Umlaute und Apostrophe werden also zu `-`, z. B. `g-ldefaber-…`).
* **Spritesheet**: horizontal, alle Frames gleich groß, Loop nahtlos.
* **JSON**: `frameWidth`, `frameHeight`, `frames`, `frameMs`, `loop`,
  `layout` und – falls die Leinwand gegenüber dem Original vergrößert wurde –
  `padTop`/`padLeft`/`padRight`/`padBottom`. Um diesen Rand muss die Animation
  verschoben werden, damit sie deckungsgleich mit dem statischen Sprite liegt.
* **`faceX`** (Pflicht für neue Sheets): waagrechte Mitte des **Gesichts** in
  Frame-Pixeln, gemessen von der linken Frame-Kante (Kommazahlen erlaubt,
  z. B. `12.5`). Auf dem Brett steht das Gesicht genau über der Kartenmitte –
  Haare, Waffen oder Umhänge verschieben den Helden dadurch nicht mehr.
  Fehlt `faceX`, nimmt das Brett den Schwerpunkt des obersten Figurendrittels.
* **`anchorX`** (optional): ausdrücklich abweichender Bildmittelpunkt in
  denselben Einheiten; hat Vorrang vor `faceX` („sofern nicht anders
  angegeben, ist das Gesicht die Mitte").
* **`footY`** (optional): Standlinie in Frame-Pixeln von oben – hier steht
  der Held auf der Kartenmitte. Ohne Angabe gilt das unterste deckende
  Pixel. Nötig, wenn unter den Füßen noch etwas liegt (Medeas Schlangen);
  dieser Teil wird nicht abgeschnitten, sondern liegt vor dem Helden.
* **`boardScale`** (optional): Größenfaktor auf dem Brett für Ausreißer
  (Bubbles: `0.5`). Sonst stehen alle Helden im selben Maßstab.
* **`alphaScale`** (optional): Faktor auf die Deckkraft aller
  halbtransparenten Pixel (Gas, Rauch, Auren) auf dem Brett; voll deckende
  Pixel bleiben, wie sie sind. `< 1` = durchsichtiger (Medea: `0.55`).
* Gemeinsame Helfer (Glitzersterne, Lichtschimmer, Speichern, 1-px-Ring) in
  `anim_common.py`, Flügelschlag (Drehung ums Schultergelenk bzw. spaltentreue
  Scherung für sehr kleine Flügel, Lochfüller) in `flap_common.py`.

## Stil-Lektionen aus dem Feedback

* Freiheiten beim Ergänzen/Ändern von Pixeln sind ausdrücklich erwünscht
  (neue Glanz-/Rauch-/Funkenfarben, fehlende Bildteile vervollständigen).
* Stehende Figuren: **Füße bleiben immer am Boden** (Wippen aus den Knien);
  nur schwebende Figuren bewegen sich als Ganzes.
* **Bildinhalte** (bemaltes Schild, Landkarte) **nicht animieren** – nur mitbewegen.
* Gesichter: vorhandene Details (Augenweiß, Mund, Bäckchen) nicht übermalen;
  einen vorhandenen Mund editieren statt einen zweiten zu malen. Vorsicht bei
  Handgesten (keine Mittelfinger-Optik).
* **Keine Lücken**: zusammenhängende Flächen per Rückwärts-Mapping bzw. stetigem
  Verschiebungsfeld bewegen (Hals, Kopf/Körper); Arme bleiben mit der Schulter
  verbunden (Hubhöhe über den Arm verteilen, Schulterplatten mitkippen).
* Verformte Outlines neu als 1-px-Kontur zeichnen, statt sie mitzudehnen.
* Gas soll fließen/wehen (aufsteigende Schlieren, Randwellen, Wind) statt zu
  „wabbeln“, aus seiner Quelle entstehen und Augen/Gesichter nicht überdecken.
* Bewegungen lieber etwas lebendiger/übertriebener; Idle-Haltung aber nicht
  „tänzerisch“. Wippen mit dem ganzen Körper wirkt besser als Einzelbewegungen
  im Gesicht (Gesichter nicht „drehen“).
* Keine Silhouetten-Verbreiterung oder -Dellen durch Wind/Schlackern
  (Wind in eine Richtung, nur lose Strähnen bewegen).
* Outline-Pixel von Armen/Händen nie für Gesten übermalen.
* Laufende Muster (Kettensäge): Periode deutlich größer als 2x Tempo und
  Bewegungsspuren, sonst wirkt es wie Hin-und-her oder läuft rückwärts.
  Unvollständige/verwischte Objekte dürfen komplett neu gezeichnet werden.
* Wird ein Objekt bewegt/weggeworfen, alles ergänzen, was es in Ruhe verdeckt
  (Arm, Handecke, Handgelenk) – sonst schweben Hände oder entstehen Kerben.
* Bewegte Teile (Schwert, Knauf) vollständig maskieren und per Pixelvergleich
  über alle Frames prüfen; Freigelegtes nie mit Teilen des Objekts selbst füllen.
* **Nichts darf je abgeschnitten sein**: Partikel (Glitzer, Noten, Blitze,
  Herzchen, Pfeile) liegen komplett im Bild oder werden weggelassen bzw.
  blenden vorher aus; `save_outputs(..., check_edges=True)` bricht ab, sobald
  ein Frame den Bildrand berührt. Partikel auch nie halb hinter der Figur
  anschneiden – ganz oder gar nicht zeichnen.
* Auren, die im Original genau die Silhouette umgeben (Jenny), bei bewegten
  Flügeln jedes Frame neu als Ring um die aktuelle Silhouette berechnen.
* Vorhandene Mimik genau ansehen: ein roter Fleck unten im Gesicht ist oft
  schon ein offener Mund (Vena) – Brüllen dann nur dezent verstärken. Ein
  Strich-Auge kann schon ein Zwinkern sein (Monia).
* **Loop-Längen**: jede Teilbewegung muss N glatt teilen (Federn alle 12
  Frames -> N = 36, nicht 32), sonst bricht am Loop-Ende eine Bewegung ab
  und es entstehen z. B. zwei schnelle Bounces hintereinander. Zufalls-
  Partikel mit Generationen: Generation modulo (N / Periode) nehmen.
