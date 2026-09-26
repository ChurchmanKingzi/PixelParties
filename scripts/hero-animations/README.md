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
| `kasparov.py` | `final 90 b` | `kasparov_b_idle_final_sheet.png` | `kasparov-the-king-of-kings-b` |
| `kasparov.py` | `final 90 w` | `kasparov_w_idle_final_sheet.png` | `kasparov-the-king-of-kings-w` |
| `darion.py` | `final 80` | `darion_idle_final_sheet.png` | `darion-the-blood-crazy-groundskeeper` |
| `bubbles.py` | `final gross` | `bubbles_idle_final_gross_sheet.png` | `bubbles-the-bouncy-bunny` |

`bubbles.py` ohne `gross` erzeugt eine auf Hero-Größe verkleinerte Variante
(Sprite aus `bubbles_downscale.py`), die aktuell nicht verwendet wird.

Alle Skripte sind deterministisch und reproduzieren die eingecheckten Sheets
pixelgenau.

## Konventionen

* **Dateiname** = Kartenname wie bei den Effekt-Skripten:
  `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` ohne Rand-Bindestriche
  (Umlaute und Apostrophe werden also zu `-`, z. B. `g-ldefaber-…`).
* **Spritesheet**: horizontal, alle Frames gleich groß, Loop nahtlos.
* **JSON**: `frameWidth`, `frameHeight`, `frames`, `frameMs`, `loop`,
  `layout` und – falls die Leinwand gegenüber dem Original vergrößert wurde –
  `padTop`/`padLeft`/`padRight`/`padBottom`. Um diesen Rand muss die Animation
  verschoben werden, damit sie deckungsgleich mit dem statischen Sprite liegt.
* Gemeinsame Helfer (Glitzersterne, Lichtschimmer, Speichern) in `anim_common.py`.

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
