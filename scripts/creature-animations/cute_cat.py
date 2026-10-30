# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Cat“ (Creature).

Quelle: src/cute-cat.png — die geflügelte Katze (23×13 px, 15 Farben) aus MotiveMoe.xcf,
Ebene 329 („Trial of Ann“), Figur 1; gefunden mit creature_scan.py.

Aufruf:   python3 cute_cat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-cat.png + .json

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht, je weiter vom Körper, desto mehr
  (Spitze ca. −1 … +3 px) — links und rechts gleichzeitig.
* Körper schaukelt gegenläufig (Abschlag → Katze hebt sich um 1 px).
* Schwanz (unten links) wedelt einmal pro Schleife um 1 px.
* Blinzeln (Frames 15–17): die grünen Augenpixel schließen sich über zwei Zwischenstufen.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

GRAU = [(63, 62, 64), (163, 161, 166), (196, 201, 204), (132, 130, 134)]
AUGE_OBEN, AUGE_UNTEN = (41, 123, 0), (24, 65, 0)
WEISS, UMRISS = (255, 246, 255), (57, 8, 32)

spr = L.lade('cute-cat')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R

fluegel = L.farbmaske(spr, GRAU)
links = fluegel & (np.arange(sw)[None, :] <= 9)
rechts = fluegel & (np.arange(sw)[None, :] >= 16)
rest = L.deckend(spr) & ~fluegel
schwanz = rest & (np.arange(sw)[None, :] <= 5)
koerper = rest & ~schwanz


def frame(i):
    ph = L.sinus(i, N / 2)                                  # zwei Schläge pro Schleife
    fl, _ = L.trenne(spr, links)
    fr, _ = L.trenne(spr, rechts)
    kp, _ = L.trenne(spr, koerper)
    sz, _ = L.trenne(spr, schwanz)
    fl = L.spalten_welle(fl, 9.5, 2.2, ph, bias=0.8)
    fr = L.spalten_welle(fr, 16.5, 2.2, ph, bias=0.8)
    # Blinzeln
    if i in (15, 17):
        kp = L.tausche(kp, {AUGE_OBEN: WEISS})                  # halb zu
    if i == 16:
        kp = L.tausche(kp, {AUGE_OBEN: WEISS, AUGE_UNTEN: UMRISS})   # ganz zu
    koerper_dy = int(round(-0.8 * math.sin(ph)))
    schwanz_dx = int(round(math.sin(L.sinus(i, N))))
    return L.zusammen(H, W, [(fl, PAD_L, PAD_T), (fr, PAD_L, PAD_T),
                             (sz, PAD_L + schwanz_dx, PAD_T + koerper_dy), (kp, PAD_L, PAD_T + koerper_dy)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-cat', 'Cute Cat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-cat-strip.png', frames)
