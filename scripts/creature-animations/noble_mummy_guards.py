# -*- coding: utf-8 -*-
"""Idle-Animation für „Noble Mummy Guards“ (Creature) — zwei Mumien-Wachen (spiegelbildlich), jede hält einen Stab mit Federfächer (Flabellum).

Quelle: src/noble-mummy-guards.png (58×33 px, 14 Farben; vorbereitet).
PICK: [["MotiveEgypt", 183, 1]]   (Ebene „Royal Mummy Guards“, beide Wachen auf einer Ebene, vollständig; Ebene 177 „Mummy“ ist eine andere Karte)
Abgleich mit der Kartenkunst Noble_Mummy_Guards.png: identisch (beide Wachen nebeneinander vor der Ziegelwand).

Was im Sprite ist (linke Wache, x 0–28; die rechte ist gespiegelt, x → 57−x, nur die Rippen-Schattierung des Fächers ist verschoben statt gespiegelt):
* FÄCHER (y 0–9): blaue Fächerfläche (4,94,154) mit Rippen (186,150,118)/(123,92,63) (x 9–21), darüber zwei lange, bogenförmig herabhängende helle FEDERN (254,238,213)/(186,150,118)
  (links x 5–12, rechts x 20–27, Spitzen bei y 7–8).
* STAB (x 15–17, y 10–32): braun (48,30,10)/(133,97,63)/(92,60,35), steht auf dem Boden (y 32).
* HAND (x 16–18, y 18–21 und x 15, y 19–20): Bandagen-Faust um den Stab (vor dem Stab).
* MUMIE (x 0–14, y 8–30): schwarzer Körper (21,21,21) mit grauen Bandagen (120,120,120)/(179,179,179); Kopf y 8–16 mit schwarzer Gesichtsöffnung und zwei ROTEN GLÜHAUGEN
  ((5–6,13) und (9–10,12–13); (179,0,0)/(255,0,0)); loses BANDAGEN-ENDE links (x 0–2, y 17–19); Füße y 29–30.

Ablauf (64 Frames à 70 ms = 4,48 s, nahtlos, Frame 0 = Original; die rechte Wache läuft um eine halbe Schleife versetzt):
* WACH-STOSS (Idle-Idee): die Wache hebt den Stab (Stab + Fächer + Hand als starre Einheit) 2 px an, hält kurz und stößt ihn auf den Boden; beim Aufsetzen zwei kleine Staubwölkchen (2×2, Stabfarben)
  am Stabfuß. Links ab Frame 8, rechts ab Frame 40. Der Stab ist starr (nie gestreckt), die Hand geht exakt mit.
* FEDERN federn nach: beim Aufsetzen bleiben die äußeren Federspitzen 3 Frames 1 px oben (Federn sind biegsam; Spaltenversatz nur an den äußeren Spalten).
* ATMEN: der Körper (ohne Stab/Hand) hebt sich 1 px (texturierte Einfügezeile y 24, anim_textur), Füße und Stab bleiben stehen; je Wache einmal je halber Schleife, versetzt. Kopf nie seitlich.
* GLÜHAUGEN flackern kurz (hell → dunkelrot, innerhalb der Augenpixel), kein Blinzeln (keine Lider).
* BANDAGEN-ENDE (x 0–2, y 18–19) pendelt 1 px.
Ergänzungen: Kopfumriss (21,21,21) bei (5,8), (13,8) und (14,9) unter Federspitze bzw. Fächerkante/-fuß (im Original verdeckt, wird beim Anheben des Stabs frei); je Wache gespiegelt. Keine neuen Farben.
"""
import math

import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1
import anim_textur as TX
TX.umleiten()

N, MS = 64, 70
spr = L.lade('noble-mummy-guards')
PL, PT, PB = 4, 5, 3
OFF = (PL, PT)


ERGAENZUNG = [(5, 8), (13, 8), (14, 9)]


def teile(halb):
    """Ebenen einer Wache (linke Hälfte bzw. gespiegelte rechte Hälfte – der Fächer ist nicht gespiegelt schattiert, daher zwei Sätze)."""
    S = N1.Szene(halb, (PL, PT, 0, PB))
    xx, yy = S.xx, S.yy
    A_ = L.farbmaske(halb, [(21, 21, 21)])
    STAB = S.da & ((yy <= 7) | ((yy == 8) & ~A_) | ((yy == 9) & (xx >= 14) & (xx <= 18)) | ((yy >= 10) & (xx >= 15) & (xx <= 17))
                   | ((yy >= 18) & (yy <= 21) & (xx >= 16) & (xx <= 18)) | ((yy >= 19) & (yy <= 20) & (xx == 15)))
    BAND = S.da & (xx <= 2) & (yy >= 18) & (yy <= 19)
    KOERPER = S.da & ~STAB & ~BAND
    koerper = S.ebene(KOERPER)
    for (x, y) in ERGAENZUNG:                       # Kopfumriss unter Federspitze/Fächer fertigzeichnen (wird frei, wenn der Stab gehoben ist)
        assert STAB[y, x]
        N1.setze(koerper, PL + x, PT + y, (21, 21, 21))
    return S, S.ebene(STAB), koerper, S.ebene(BAND)


SATZ = [teile(spr[:, :29].copy()), teile(spr[:, ::-1][:, :29].copy())]
S = SATZ[0][0]
H, HW = S.H, S.W
W = 2 * HW
ROT_H, ROT_D = (255, 0, 0), (179, 0, 0)
AUGEN = [(6, 13), (10, 13)]
assert all(S.col(x, y) == ROT_H for x, y in AUGEN)
STOSS = [1, 1, 2, 2, 2, 2, 2, 2, 1]                     # Hub des Stabs ab Startframe; danach 0 (aufgesetzt)
STAUB = dict(farbe=(186, 150, 118), rand=(123, 92, 63))
TEST_EBENEN = 'koerper'


def wache(i, nur=None, satz=0):
    S, E_ST, E_K, E_B = SATZ[satz]
    kb = E_K.copy()
    if (i % 32) in (20, 21):
        for (x, y) in AUGEN:
            kb[PT + y, PL + x, :3] = ROT_D
    n = 1 if 10 <= (i % 32) < 22 else 0
    kb = TX.streck_zeile(kb, PT + 24, n)
    band = L.versetze(E_B, int(round(math.sin(L.sinus(i, 32)))), -n)
    k = N1.huelle(i, N, 8, STOSS)
    stab = E_ST
    if N1.huelle(i, N, 8 + len(STOSS) - 1, [1, 1, 1, 1]):       # Federspitzen bleiben beim Aufsetzen kurz oben
        stab = N1.spalten_dy(stab, lambda x: -1 if (x - PL <= 7 or x - PL >= 25) else 0)
    lay = [(kb, 0, 0), (band, 0, 0), (stab, 0, -k)]
    if nur != 'koerper':
        s0 = 8 + len(STOSS)
        px, py = S.P(13, 31)
        lay.insert(0, (N1.kleckse(H, HW, [dict(s=s0, L=7, x0=px, y0=py, x1=px - 4, y1=py - 2, gross=(1, 1, 1), **STAUB),
                                          dict(s=s0, L=7, x0=px + 5, y0=py, x1=px + 9, y1=py - 2, gross=(1, 1, 1), **STAUB)], i, N), 0, 0))
    return L.zusammen(H, HW, lay)


def frame(i, nur=None):
    return np.concatenate([wache(i, nur), wache((i + N // 2) % N, nur, 1)[:, ::-1]], axis=1)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('noble-mummy-guards', 'Noble Mummy Guards', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
