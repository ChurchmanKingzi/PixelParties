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
