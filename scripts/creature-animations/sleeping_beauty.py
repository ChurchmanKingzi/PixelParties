# -*- coding: utf-8 -*-
"""Idle-Animation für „Sleeping Beauty“ (Creature) — Dornröschen schläft mit Krone im Himmelbett; nur Kopf und roter Kragen schauen unter der Decke hervor.

Quelle: src/sleeping-beauty.png (50×48 px, 35 Farben).
PICK: [["MotiveGrailWar", 709, 1], ["MotiveGrailWar", 710, "Bett = Bildausschnitt x 240–289, y 168–215 der Ebene"]]
  Ebene 709 „Sleeping Beauty“ ist nur Kopf + Kragen (12×17 px, liegt bei x 19–30, y 0–16); das Bett mit Kissen und Decke liegt auf der Nachbarebene 710
  (Regel 20). Ohne das Bett wäre die Figur eine in der Luft hängende Büste – deshalb gehört das Bett hier zur Figur (das Fenster derselben Ebene nicht).

Was im Sprite ist (x, y):
* KOPFTEIL des Betts (y 0–6, braun), zwei weiße KISSEN-Streifen (x 16–19 und x 30–33, y 2–10) links/rechts des Kopfs.
* KRONE (x 21–28, y 0–1): Gold (255,222,90)/(255,246,172). Einziges Metall → ein kurzer Sparkle.
* HAAR (x 19–30, y 2–11, orange), GESICHT (x 22–27, y 7–10): die schwarzen 2-px-Striche (22–23, 8) und (26–27, 8) sind die GESCHLOSSENEN Augen – sie bleiben zu (kein Blinzeln).
* KRAGEN (x 19–30, y 11–16): rot mit weißem Besatz (246,255,255), Hals/Dekolleté hautfarben.
* DECKE (y 6–45, blaugrau): V-Falten um den Hals (x 17–32, y 11–24), obere Knitterfalten (y 16–20, links x 3–15, rechts x 34–46), untere Knitterfalten (y 26–30), Bettfüße (y 44–47).

Idee: Sie schläft tief – die Decke hebt und senkt sich mit dem Atem, an der Nase wächst und schrumpft eine Schlafblase, der Kopf sackt einmal je Schleife 1 px tiefer ins Kissen.
Ablauf (64 Frames à 80 ms = 5,1 s, nahtlos; langsam, weil Schlaf):
* Atmen (Periode 32, 2× je Schleife): Einatmen → die oberen Knitterfalten wandern 1 px nach oben (Frames 8–19), mit 3 Frames Nachlauf die unteren 1 px nach unten
  (Decke wölbt sich). Die Falten sind starre Ausschnitte, die in der einfarbigen Deckenfläche verschoben werden (nichts wird gestreckt, keine Lücke, Umriss bleibt).
* Schlafblase (Periode 32, im Takt des Atems): beim Ausatmen wächst rechts unter der Nase eine Blase 1×1 → 2×2 → 3×3 (ohne Ecken) → 4×4-Kreis und schrumpft beim Einatmen wieder.
  Farben: Weiß des Kragenbesatzes (246,255,255) mit Rand im hellen Deckenton (192,203,220).
* Kopf sackt (Frames 44–55): Kopf + Krone + Haar (x 19–30, y 0–11) als Einheit 1 px nach unten (Kinn schiebt sich über die oberste Kragenzeile); die frei werdenden
  Pixel am oberen Rand werden mit dem, was dahinter liegt, fertiggezeichnet (Kopfteil-Kante (49,36,16) bzw. Kissen). Kein seitliches Kopfbewegen.
* Krone: Sparkle (Mitte → Kreuz → Mitte) an der linken Zacke (22,0) in Frames 30–32.
Frame 0 = Original.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4

N, MS = 64, 80
G = N4.Figur('sleeping-beauty', 3, 3, 4, 3)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

WEISS, HELL = f(22, 14), f(5, 7)          # (246,255,255), (192,203,220)
GOLD_H = f(24, 0)                         # (255,246,172)
DECKE = f(10, 14)                         # (139,155,180)
FALTE_OL, FALTE_OR = (5, 16, 16, 21), (34, 16, 45, 21)     # x0, y0, x1, y1 (ausschließlich)
FALTE_UL, FALTE_UR = (5, 26, 16, 31), (34, 26, 45, 31)
KOPF = (19, 0, 31, 12)
BLASE = {0: [], 1: [(0, 0)], 2: [(0, 0), (1, 0), (0, 1), (1, 1)],
         3: [(0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2)]}
BLASE_RAND = {3: [(0, -1), (1, -1), (-1, 0), (2, 0), (-1, 1), (2, 1), (0, 2), (1, 2)], 2: [(1, 1)], 1: []}
BX, BY = 27, 9                             # Blase sitzt rechts unter der Nase


def rect(r):
    return L.rechteck(spr, r[0], r[1], r[2], r[3])


def schiebe(a, r, dy):
    """Starren Ausschnitt um dy verschieben; frei werdende Pixel bekommen die Deckenfarbe (er liegt in der einfarbigen Fläche)."""
    if not dy:
        return a
    rest, teil = N4.starr(a, OFF, rect(r), 0, dy)
    luecke = (a[..., 3] > 0) & (rest[..., 3] == 0)
    rest[luecke, :3] = DECKE; rest[luecke, 3] = 255
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def kopf_sacken(a):
    rest, teil = N4.starr(a, OFF, rect(KOPF) & ~L.farbmaske(spr, [f(20, 1)]) | L.rechteck(spr, 21, 0, 29, 2), 0, 1)
    for y, x in zip(*np.nonzero((a[..., 3] > 0) & (rest[..., 3] == 0))):
        sx, sy = x - OFF[0], y - OFF[1]
        nx = x - 1 if sx < 25 else x + 1                     # was dahinter liegt = äußerer Nachbar (Kopfteil bzw. Kissen)
        rest[y, x] = a[y, nx]
        if sy == 0:
            rest[y, x, :3] = f(12, 0)                        # Kopfteil-Oberkante
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def frame(i):
    a = G.ebene()
    p = i % 32
    oben = 1 if 8 <= p < 20 else 0
    unten = 1 if 11 <= p < 23 else 0
    a = schiebe(a, FALTE_OL, -oben); a = schiebe(a, FALTE_OR, -oben)
    a = schiebe(a, FALTE_UL, unten); a = schiebe(a, FALTE_UR, unten)
    sack = Hm.takt(i, N, 44, 12)
    if sack:
        a = kopf_sacken(a)
    st = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 2, 2, 1][p]
    for (dx, dy) in BLASE[st]:
        c = HELL if (dx, dy) in BLASE_RAND[st] else WEISS
        Hm.setze(a, {(BX + dx, BY + dy + sack): c}, OFF)
    N4.funkeln(a, 22, 0, Hm.folge(i, 30, [0, 1, 2], N), (255, 255, 255), GOLD_H, OFF)
    return a


if __name__ == '__main__':
    N4.abschluss(G, 'Sleeping Beauty', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
