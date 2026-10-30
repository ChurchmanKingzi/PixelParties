# -*- coding: utf-8 -*-
"""Idle-Animation für „Blue-Ice Dragon“ (Creature).

Quelle: src/blue-ice-dragon.png — Ebene „Blue-Ice Dragon“ (36×28 px, 34 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 blue_ice_dragon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/blue-ice-dragon.png + .json

Ablauf (24 Frames à 75 ms = 1,8 s):
* Flügelschlag: zweimal pro Schleife; Spaltenversatz wächst zur Flügelspitze hin, die Lücke zum Rumpf wird
  beim Anheben geschlossen.
* Schwebe-Bob: der Körper hebt sich beim Abschlag um 1 px.
* Kopf nickt an den Umkehrpunkten um 1 px, Schwanz schwingt mit Verzögerung, die Beine baumeln.
* Die weißen Pixel im Maul sind Zähne: sie sitzen fest am Kiefer und gehen nur mit dem Kopf mit.
* Blinzeln (Frames 17–19): beide Augen schließen sich über einen Zwischenschritt.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 75
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 4

spr = L.lade('blue-ice-dragon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

fluegel = vorhanden & (xx <= 16) & (yy <= 9)
kopf = vorhanden & (xx >= 19) & (yy <= 13)
schwanz = vorhanden & (xx <= 8) & (yy >= 12) & ~fluegel
beine = vorhanden & (yy >= 20) & ~schwanz & ~fluegel & ~kopf
rumpf = vorhanden & ~fluegel & ~kopf & ~schwanz & ~beine

# Augen: zwei Pixelpaare je Auge (oben Pupille/Iris, unten Glanz)
AUGEN = [(28, 6), (29, 6), (31, 6), (32, 6), (28, 7), (29, 7), (31, 7), (32, 7)]
HAUT = tuple(int(v) for v in spr[6, 30, :3])
UMRISS = tuple(int(v) for v in spr[6, 33, :3])


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return t


def frame(i):
    ph = L.sinus(i, N / 2)
    dy_koerper = int(round(-math.sin(ph)))
    fl = L.spalten_welle(teil(fluegel), 16, 3.4, ph, bias=0.8, fuell=(rumpf | beine | schwanz | kopf))
    kp = teil(kopf)
    kopf_dy = int(round(0.6 * math.sin(ph - 0.9)))
    kp = L.versetze(kp, 0, kopf_dy)
    sz = L.spalten_welle(teil(schwanz), 9, 2.3, ph - 1.3, potenz=1.0)
    bn = L.zeilen_welle(teil(beine), 19, 1.1, L.sinus(i, N / 2, 0.8))
    rp = teil(rumpf)
    # Blinzeln
    if i in (17, 19):
        for (x, y) in AUGEN[:4]:
            kp[y, x, :3] = HAUT
    if i == 18:
        for (x, y) in AUGEN[:4]:
            kp[y, x, :3] = HAUT
        for (x, y) in AUGEN[4:]:
            kp[y, x, :3] = UMRISS
    return L.zusammen(H, W, [(bn, PAD_L, PAD_T + dy_koerper), (sz, PAD_L, PAD_T + dy_koerper), (rp, PAD_L, PAD_T + dy_koerper),
                             (kp, PAD_L, PAD_T + dy_koerper), (fl, PAD_L, PAD_T + dy_koerper)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('blue-ice-dragon', 'Blue-Ice Dragon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/blue-ice-dragon-strip.png', frames, spalten=6, scale=7)
