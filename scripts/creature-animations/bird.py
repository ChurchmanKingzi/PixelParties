# -*- coding: utf-8 -*-
"""Idle-Animation für „Bird“ (Creature).

Quelle: src/bird.png — Ebene „Bird“ (10×14 px, 15 Farben) aus MotiveMoe.xcf (auf der Karte doppelt vergrößert).
Der Vogel ist von oben gesehen: Kopf unten (hellblaue Augen, gelber Schnabel), roter Rumpf, dunkelblaue Flügel
links/rechts, Schwanzfedern oben.

Aufruf:   python3 bird.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bird.png + .json

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelflattern: dreimal pro Schleife spreizen sich beide Flügel bis zu 2 px nach außen und klappen zurück; beim
  Spreizen wird die farbige Innenspalte des Flügels verdoppelt (Flügel wird breiter, Innenkante bleibt am Rumpf).
* Der Vogel hebt sich beim Spreizen um 1 px.
* Schwanzfedern (oben) wippen seitlich um 1 px.
* Blinzeln (Frames 15–16): die hellblauen Augen werden zum dunklen Strich.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('bird')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

fl_l = vorhanden & (xx <= 2) & (yy >= 3) & (yy <= 10)
fl_r = vorhanden & (xx >= 7) & (yy >= 3) & (yy <= 10)
schwanz = vorhanden & (yy <= 2)
rumpf = vorhanden & ~fl_l & ~fl_r & ~schwanz

UMRISS = tuple(int(v) for v in spr[3, 0, :3])                    # (24,24,32)
AUGE = tuple(int(v) for v in spr[11, 3, :3])                     # hellblau
AUGEN = [(3, 11), (7, 11)]


def frame(i):
    ph = L.sinus(i, N / 3)                                       # dreimal pro Schleife
    aus = max(0.0, math.sin(ph))
    dx = int(round(2.4 * aus))                                   # 0 … 2 px nach außen
    r, _ = L.trenne(spr, rumpf)
    s, _ = L.trenne(spr, schwanz)
    if i in (15, 16):
        for (x, y) in AUGEN:
            r[y, x, :3] = UMRISS
    s = L.zeilen_welle(s, 3, 1.0, L.sinus(i, N / 2, 0.6))
    # Flügel spreizen = breiter werden: die farbige Innenspalte wird dx-mal verdoppelt, die Außenkante rückt nach außen,
    # die Innenkante bleibt am Rumpf (keine Lücke).
    l = L.leer(sh, sw + 4); rr = L.leer(sh, sw + 4)                # Platz für 2 px links/rechts (Versatz 2)
    o = 2
    sp = lambda x: spr[:, x] * fl_l[:, x, None]                    # Spalte x des linken Flügels
    l[:, o - dx + 0] = sp(0)
    for k in range(dx + 1):
        l[:, o - dx + 1 + k] = sp(1)
    l[:, o + 2] = sp(2)
    sq = lambda x: spr[:, x] * fl_r[:, x, None]
    rr[:, o + 9 + dx] = sq(9)
    for k in range(dx + 1):
        rr[:, o + 8 + k] = sq(8)
    rr[:, o + 7] = sq(7)
    bob = -dx // 2 if dx else 0
    return L.zusammen(H, W, [(r, PAD_L, PAD_T + bob), (s, PAD_L, PAD_T + bob),
                             (l, PAD_L - o, PAD_T + bob), (rr, PAD_L - o, PAD_T + bob)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bird', 'Bird', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bird-strip.png', [frames[k] for k in (0, 1, 2, 3, 4, 5, 6, 15)], spalten=8, scale=14)
