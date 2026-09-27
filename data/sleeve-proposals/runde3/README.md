# Sleeve-Entwürfe – Runde 3 (50 Stück)

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

## Generator
`generator/sNN_*.py` erzeugt jeweils ein Sleeve (aus `generator/` ausführen). `common.py` bindet die Werkzeuge
aus Runde 2 ein (`kit.py`, `xcfkit.py`). Die verwendeten Sprites liegen zusätzlich unter `generator/sprites3/`,
damit die Skripte auch ohne die exportierten xcf-Ebenen laufen. xcf-Export: `../runde2/generator/export_xcf.py`.
