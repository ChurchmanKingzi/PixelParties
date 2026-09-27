# Sleeve-Entwürfe – Runde 3 (60 Stück)

Alle Motive sind aus den xcf-Ebenen des Repos **PixelPartiesSprites** gebaut (Figuren pixelgenau, ganzzahlig
skaliert); Hintergründe stammen aus den xcf-Dateien oder sind schlichte, selbst geditherte Verläufe in Spielfarben.
Kein Text. Übersicht: `00_overview.png`. Vorgaben: `BRIEF.md`. Pro Block eine Notizdatei `notes_A.md` … `notes_H.md`
mit Idee und Quellen je Sleeve.

| Nr. | Block | Quellen |
|---|---|---|
| 01–06 | A | MotiveChina, MotiveGuardianBeasts, MotiveJapan |
| 07–13 | B | MotiveDeepsea, MotiveHawaii |
| 14–19 | C | MotiveSteamDwarfs, MotiveRussia (+ Motive) |
| 20–26 | D | MotiveGrailWar |
| 27–32 | E | MotiveMoe, MotiveBoons |
| 33–38 | F | MotiveGN, MotiveArcanum (+ Motive) |
| 39–45 | G | Motive |
| 46–50 | H | MotiveBritain, MotiveCoolhalla, MotiveDeri, MotiveIndia, MotiveEgypt |
| 51–60 | A–H | Runde 3b: zehn neue (51 A, 52 B, 53 C, 54 D, 55–56 E, 57 F, 58–59 G, 60 H) |

Runde 3b: alle Sleeves außer den Nutzer-Favoriten 07, 13, 34 und 43 nach den Regeln in `BRIEF.md`
(„Runde 3b“: einheitliche Pixelgröße, vollständige Figuren, korrekte Positionierung, eigene Effekte)
überarbeitet; die Notizdateien nennen pro Sleeve die Skalierung.

## Generator
`generator/sNN_*.py` erzeugt jeweils ein Sleeve (aus `generator/` ausführen). `common.py` bindet die Werkzeuge
aus Runde 2 ein (`kit.py`, `xcfkit.py`). Die verwendeten Sprites liegen zusätzlich unter `generator/sprites3/`,
damit die Skripte auch ohne die exportierten xcf-Ebenen laufen. xcf-Export: `../runde2/generator/export_xcf.py`.

## Final: gerahmt, englische Namen
`final/<Name>.png` – alle 60 Sleeves mit verziertem Rahmen. 15 Bauformen (nicht nur Farben): ornate (Eckplatten,
Kartuschen), double (Doppelleiste), twist (gedrehte Kordel, Medaillons), industrial (Nietplatte, Eckstreben),
arch (Korbbogen mit Maßwerk, Sockel), icicle (Eiszapfen, Kristallecken), bamboo (Bambusrohre, Schnürung),
moulding (Bilderrahmen-Profil, Gehrung), card (Spielkarte mit runden Ecken), bone (Knochen), cosmic (Planeten mit
Ring), meander (Mäander), wave (Wellen, Muscheln), stone (Mauersteine), filigree (Spiralranken) – jeweils in einer
zum Motiv passenden Palette mit Edelsteinen. Rahmenpixel = 6 Bildpixel. Übersicht: `00_overview_final.png`.
Erzeugt mit `generator/frames2.py` (Tabelle `R3`: Nr. → Name, Bauform, Palette, Steine).
Die Shop-Sleeves 2–15 (`data/shop/sleeves/`) haben mit `python3 frames2.py shop` ebenfalls Rahmen bekommen
(Tabelle `SHOP_FR`; gerendert immer vom Original aus Commit bd5a7c5, sleeve1 unverändert).

## Im Shop
Alle Shop-Sleeves tragen englische Namen: Datei `data/shop/sleeves/<id>.png`, Anzeigename in
`data/shop/sleeve-names.json` (dort auch die alte Nummern-ID `formerId`; der Server migriert Käufe und
ausgerüstete Sleeves beim Start). Die 60 Sleeves dieser Runde:

| Datei | Name |
|---|---|
| lunar-new-year.png | Lunar New Year |
| heavenly-throne.png | Heavenly Throne |
| guardian-niu.png | Guardian Niu |
| yokai-parade.png | Yokai Parade |
| moonlit-duel.png | Moonlit Duel |
| fox-pond.png | Fox Pond |
| porthole.png | Porthole |
| into-the-deep.png | Into the Deep |
| sirens-song.png | Siren's Song |
| luau.png | Luau |
| fire-and-storm.png | Fire and Storm |
| aquatic-crest.png | Aquatic Crest |
| count-of-the-deep.png | Count of the Deep |
| lava-diver.png | Lava Diver |
| steam-crest.png | Steam Crest |
| dwarf-king.png | Dwarf King |
| hydra-duel.png | Hydra Duel |
| white-parade.png | White Parade |
| poison-card.png | Poison Card |
| t-rex-breach.png | T-Rex Breach |
| skulltop-storm.png | Skulltop Storm |
| the-summoning.png | The Summoning |
| generals-duel.png | Generals' Duel |
| crossing-the-alps.png | Crossing the Alps |
| blackstaches-bow.png | Blackstache's Bow |
| weapon-storm.png | Weapon Storm |
| rift-in-the-sky.png | Rift in the Sky |
| fun-fun-circus.png | Fun-Fun Circus |
| dragon-flight.png | Dragon Flight |
| close-encounter.png | Close Encounter |
| rise-of-the-phoenix.png | Rise of the Phoenix |
| ladder-to-the-sky.png | Ladder to the Sky |
| life-serum.png | Life Serum |
| blood-eclipse.png | Blood Eclipse |
| rotten-mastermind.png | Rotten Mastermind |
| vanitas.png | Vanitas |
| travelers-portal.png | Traveler's Portal |
| class-photo.png | Class Photo |
| inferno.png | Inferno |
| angels-mirror.png | Angel's Mirror |
| raise-the-minions.png | Raise the Minions |
| slime-drive.png | Slime Drive |
| cybug-case.png | Cybug Case |
| dragons-hoard.png | Dragon's Hoard |
| last-round.png | Last Round |
| midnight-in-london.png | Midnight in London |
| frozen-throne.png | Frozen Throne |
| trojan-gift.png | Trojan Gift |
| curtain-call.png | Curtain Call |
| nile-night.png | Nile Night |
| circle-of-fuses.png | Circle of Fuses |
| trident-shrine.png | Trident Shrine |
| dragon-pilot.png | Dragon Pilot |
| witching-hour.png | Witching Hour |
| twin-reapers.png | Twin Reapers |
| heart-bow.png | Heart Bow |
| exploding-skull.png | Exploding Skull |
| mammoth-trek.png | Mammoth Trek |
| qinglong-storm.png | Qinglong Storm |
| bone-wyrm.png | Bone Wyrm |
