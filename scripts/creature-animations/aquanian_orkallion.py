# -*- coding: utf-8 -*-
"""Idle-Animation für „Aquanian Orkallion“ (Creature).

Quelle: src/aquanian-orkallion.png — Ebene „Ebene #126“ (46×34 px, 21 Farben) aus MotiveDeepsea.xcf.

Aufruf:   python3 aquanian_orkallion.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/aquanian-orkallion.png + .json

Ablauf (32 Frames à 80 ms = 2,56 s):
* Schwimmwelle: Spalten wandern senkrecht, der Ausschlag wächst vom Maul (x = 0) zur Schwanzflosse (bis ±3 px),
  die Phase hinkt nach hinten hinterher — der ganze Körper schlängelt sich einmal pro Schleife.
* Die drei unten hängenden Flossen pendeln zusätzlich verzögert hin und her (Zeilenversatz, Aufhängung bei Zeile 25).
* Blinzeln (Frames 22–24): Lid schließt sich über die helle Augenraute (halb → zu → halb).
Maulnaht, Rückenmuster (rotes Kreuz) und Rückenflosse bleiben, wie sie sind. Alle Bewegungen laufen auf der vollen Leinwand (7 px Rand oben/unten); anim_lib wirft ClipError statt still abzuschneiden.
Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L

N, MS = 32, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 7, 7

spr = L.lade('aquanian-orkallion')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

flossen = vorhanden & (yy >= 26) & (xx >= 19)
rumpf = vorhanden & ~flossen

ROT, UMRISS = (152, 55, 72), (9, 14, 26)
# Auge (Raute): helles Weiß (11,15),(10,16),(11,16), Pupille (10,17),(11,17),(10,18)
AUGE_HELL = [(11, 15), (10, 16), (11, 16)]
AUGE_PUPILLE = [(10, 17), (11, 17), (10, 18)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                    # sofort auf die volle Leinwand (nichts wird abgeschnitten)


def frame(i):
    ph = L.sinus(i, N)
    r = teil(rumpf)
    f = teil(flossen)
    if i in (22, 24):                                       # halb zu: Lid deckt Pupille und oberes Weiß
        for (x, y) in AUGE_PUPILLE + [AUGE_HELL[0]]:
            r[PAD_T + y, PAD_L + x, :3] = ROT
    if i == 23:                                             # zu: dunkler Strich
        for (x, y) in AUGE_PUPILLE + [AUGE_HELL[0]]:
            r[PAD_T + y, PAD_L + x, :3] = ROT
        for (x, y) in AUGE_HELL[1:]:
            r[PAD_T + y, PAD_L + x, :3] = UMRISS
    f = L.zeilen_welle(f, PAD_T + 25, 1.6, ph - 1.2)
    ganz = L.zusammen(H, W, [(r, 0, 0), (f, 0, 0)])
    return L.spalten_welle(ganz, PAD_L, 3.2, ph, lauf=2.2)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('aquanian-orkallion', 'Aquanian Orkallion', frames, MS, prev)
    if prev:
        L.streifen(prev + '/aquanian-orkallion-strip.png', [frames[k] for k in (0, 4, 8, 12, 16, 20, 23, 28)], spalten=4, scale=6)
