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
`final/<Name>.png` – alle 60 Sleeves mit verziertem Rahmen (Band mit Fase und Stilmuster, Eckplatten und
Kartuschen mit Edelsteinen; Stil und Steine passend zum Motiv, z. B. Lack/Gold für China, Messing für Steam
Dwarfs, Eis für den Norden, Knochen für Skelett-Motive). Rahmenpixel = 6 Bildpixel. Übersicht:
`00_overview_final.png`. Erzeugt mit `generator/frames.py` (Tabelle Nr. → Name, Stil, Edelsteine).
