# -*- coding: utf-8 -*-
"""Idle-Animation für „Mummy Maker Machine“ (Creature) — die Mumifizier-Maschine: Trichter mit eingeworfenem Opfer, grauer Kasten mit Kontrolllampen, acht Gasschläuche, Auswurfschacht und Förderband.

Quelle: src/mummy-maker-machine.png (54×68 px, 50 Farben; vorbereitet aus MotiveEgypt, Ebene 178 „Ebene #139“ + Nachbarebenen: Kasten, Trichter, Schläuche, Opfer, Förderband).
PICK: [["MotiveEgypt", 178, 1]] + Nachbarebenen (bereits in src/ zusammengesetzt). Abgleich mit Mummy_Maker_Machine.png: Kasten, Lampen, Trichter, Opfer und Schacht an derselben Stelle; die Kunst
zeigt zusätzlich farbige Gasschwaden (gelb, violett, grün, rot …) aus den Schlauchenden – daraus ist die Idle-Idee abgeleitet.

Was im Sprite ist (x, y):
* OPFER/Figur im Trichter (x 18–35, y 0–14): braunes Wesen mit Schweißerbrille (graue Gläser (192,192,192), blaues Mittelteil), ragt aus dem Trichter. Starr, wippt nur als Ganzes.
* TRICHTER (y 14–24): schwarzer Rand (y 14–16), grau gestreifter Kegel. KASTEN (x 9–44, y 25–51): graues Blech mit Schrägschraffur, Füße (y 50–51).
* KONTROLLLAMPEN (je 2 Pixel hell/dunkel): violett (13–14,27), gelb (39–40,27), orange (11,29–30), blau (42,29–30), grün (11,36–37), rot (42,36–37); zwei „aus“-Lampen schwarz (11,44–45) und grau (42,44–45).
* ACHT SCHLÄUCHE (schwarz, je vier links/rechts): führen vom Kasten schräg nach außen oben, Mündungen (3×2 schwarz) bei (7–9,16), (44–46,16), (2–4,22), (49–51,22), (1–3,30), (50–52,30), (0–2,38), (51–53,38). Starr.
* AUSWURFSCHACHT (x 21–32, y 40–51): schwarze Öffnung, darin graue BANDAGEN-Streifen (120/179). FÖRDERBAND (x 21–32, y 52–67): Lamellen im 3-Zeilen-Rhythmus.

Ablauf (72 Frames à 70 ms = 5,04 s, nahtlos, Frame 0 = Original):
* FÖRDERBAND läuft: die Lamellen (y 53–66) wandern alle 2 Frames 1 px nach unten (zyklisch, Periode 3 px); Rahmenzeilen y 52/67 bleiben.
* BANDAGEN fahren das GANZE Band hinunter (Runde 8, Nutzerwunsch): das Bandagenknäuel der Quelle (die hellen Pixel 120/179 in x 22–31, y 43–50, starr als Einheit) taucht oben an der
  Schachtoberkante (y 41) auf, fährt im Bandtempo (1 px je 2 Frames) durch den Schacht und über die ganze Länge der Lamellen bis zum Bandende (y 66) und verschwindet dort Zeile für Zeile
  hinter der unteren Rahmenzeile; 4 Frames später kommt oben das nächste. Der Schacht dahinter ist leer nachgezeichnet (Schachtfarben 13/21/38 der Quelle, Zeilen 43–50). In Frame 0 liegt
  das Knäuel genau an seinem Originalplatz.
* LAMPEN-LAUFLICHT + GAS (Idle-Idee): alle 12 Frames leuchtet die nächste Lampe auf (beide Pixel hell, dann beide dunkel, dann normal), und aus dem zugehörigen Schlauch (violett oben links, gelb oben rechts,
  orange/blau zweite Reihe, grün/rot dritte Reihe) steigt ein Gaswölkchen in der Lampenfarbe (2×2 → 3×3 → 2×2, Kern hell, Rand dunkel – nur die zwei Farben der Lampe) langsam auf. Die untersten Schläuche gehören zu den „aus“-Lampen und bleiben still.
* OPFER ruckt: im Takt jeder Lampe sackt die Figur im Trichter 3 Frames lang 1 px ab (starr, hinter dem Trichterrand) und kommt wieder hoch.
Maschine selbst (Kasten, Trichter, Schläuche) ist starr und steht fest. Kein Glanz (mattes Blech), kein Feuer. Ergänzungen: keine (das Opfer sinkt nur hinter den schwarzen Trichterrand). Keine neuen Farben.
"""
import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1

N, MS = 72, 70
spr = L.lade('mummy-maker-machine')
S = N1.Szene(spr, (3, 3, 3, 3))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
xx, yy = S.xx, S.yy
SCHWARZ = L.farbmaske(spr, [(0, 0, 0)])
OPFER = S.da & ((yy <= 13) | ((yy == 14) & (xx >= 21) & (xx <= 32) & ~SCHWARZ))
E_OP, E_M = S.ebene(OPFER), S.ebene(S.da & ~OPFER)
# Lampen: (hell-Pixel, dunkel-Pixel, Schlauchmündung x (linke Ecke des Wölkchens), y)
LAMPEN = [((14, 27), (13, 27), (8, 14)), ((40, 27), (39, 27), (45, 14)), ((11, 29), (11, 30), (3, 20)),
          ((42, 29), (42, 30), (50, 20)), ((11, 36), (11, 37), (2, 28)), ((42, 36), (42, 37), (51, 28))]
for h_, d_, _ in LAMPEN:
    assert sum(S.col(*h_)) > sum(S.col(*d_)), (h_, d_)
TAKT = 12
TEST_EBENEN = 'koerper'
KN = E_M[PT + 43:PT + 51, PL + 22:PL + 32].copy()           # Bandagenknäuel (8 Zeilen)
KN_M = KN[..., 0] >= 100
LEER = KN.copy()
LEER[KN_M, :3] = (21, 21, 21)
assert tuple(LEER[7, 0, :3]) == (38, 38, 38)


def frame(i, nur=None):
    m = E_M.copy()
    s = (i // 2) % 3                                         # Förderband
    for y in range(53, 67):
        m[PT + y, PL + 21:PL + 33] = E_M[PT + 53 + (y - 53 - s) % 3, PL + 21:PL + 33]
    m[PT + 43:PT + 51, PL + 22:PL + 32] = LEER                # Schacht ohne Knäuel
    top = 33 + (10 + i // 2) % 36                            # Bandagenknäuel: oberste Zeile (Sprite-y), 43 in Frame 0
    for r in range(8):
        y = top + r
        if 41 <= y <= 66:
            zl = m[PT + y, PL + 22:PL + 32]
            zl[KN_M[r]] = KN[r][KN_M[r]]
    puffs = []
    for k, (h_, d_, (mx, my)) in enumerate(LAMPEN):
        t = (i - 1 - k * TAKT) % N
        ch, cd = S.col(*h_), S.col(*d_)
        if t < 3:
            m[PT + d_[1], PL + d_[0], :3] = ch
        elif t < 6:
            m[PT + h_[1], PL + h_[0], :3] = cd
        puffs.append(dict(s=2 + k * TAKT, L=8, x0=PL + mx, y0=PT + my, x1=PL + mx + (-1 if mx < 27 else 1), y1=PT + my - 5, gross=(1, 2, 2, 1), farbe=ch, rand=cd))
    op = 1 if (i - 1) % TAKT < 3 else 0
    lay = [(E_OP, 0, op), (m, 0, 0)]
    if nur != 'koerper':
        lay.append((N1.kleckse(H, W, puffs, i, N), 0, 0))
    return L.zusammen(H, W, lay)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('mummy-maker-machine', 'Mummy Maker Machine', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
