# -*- coding: utf-8 -*-
"""Idle-Animation für „Bird“ (Creature).

Quelle: src/bird.png — Ebene „Bird“ (10×14 px, 15 Farben) aus MotiveMoe.xcf (auf der Karte doppelt vergrößert).
Der Vogel ist von oben gesehen: Kopf unten (hellblaue Augen, gelber Schnabel), roter Rumpf, dunkelblaue Flügel
links/rechts, Schwanzfedern oben.

Aufruf:   python3 bird.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bird.png + .json

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelflattern: dreimal pro Schleife spreizen sich beide Flügel bis zu 2 px nach außen und klappen zurück; die Innenkante
  bleibt am Rumpf, der gespreizte Flügel ist neu gezeichnet (Federtextur, siehe fluegel()).
* Der Vogel hebt sich beim Spreizen um 1 px.
* Schwanzfedern (oben) wippen seitlich um 1 px.
* Blinzeln (Frames 15–16): die hellblauen Augen werden zum dunklen Strich.
Gespreizte Flügel haben Federtextur (gezackte Spitzen, diagonale Rippen) aus den Blautönen des gefalteten Flügels.
Alle Bewegungen laufen auf der vollen Leinwand. Nur ganze Pixel, nur Farben der Quelle.
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


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


LEITER = [tuple(int(v) for v in spr[10, 1, :3]), tuple(int(v) for v in spr[7, 1, :3]),
          tuple(int(v) for v in spr[4, 1, :3]), tuple(int(v) for v in spr[5, 1, :3])]   # dunkel → hell: I, D, G, B


def fluegel(links, dx):
    """Flügel auf der Leinwand: dx = 0 → Originalspalten (gefaltet). dx > 0 → gespreizt: Außenkante rückt um dx nach außen,
    die Innenkante bleibt am Rumpf. Der Zwischenraum bekommt Federtextur: gezackte Federspitzen am Rand (jede zweite Zeile
    ragt 1 px weiter hinaus) und diagonale Rippen (Farbe eine Stufe heller/dunkler auf der Helligkeitsleiter des Sprites)."""
    out = L.leer(H, W)
    ax, ix, ex = (0, 1, 2) if links else (9, 8, 7)           # Außen-, Innen- und Rumpfseite im Original
    sg = -1 if links else 1                                  # Richtung nach außen
    for y in range(3, 11):
        outer = ax + sg * (dx - (y % 2 if dx > 1 else 0))     # gezackter Außenrand
        out[PAD_T + y, PAD_L + outer] = spr[y, ax]
        if spr[y, ex, 3]:
            out[PAD_T + y, PAD_L + ex] = spr[y, ex]            # rumpfseitige Originalspalte
        xs = range(outer + 1, ix + 1) if links else range(ix, outer)
        c = tuple(int(v) for v in spr[y, ix, :3])
        for x in xs:
            col = c
            if dx and c in LEITER:                           # Federrippen: diagonal Stufe +1 / 0 / −1
                t = (abs(x - ix) + y) % 3
                col = LEITER[max(0, min(len(LEITER) - 1, LEITER.index(c) + {0: 1, 1: 0, 2: -1}[t]))]
            out[PAD_T + y, PAD_L + x, :3] = col
            out[PAD_T + y, PAD_L + x, 3] = 255
        if y == 3:                                           # oberer Umriss bis zur Außenkante
            for x in range(min(outer, ex), max(outer, ex) + 1):
                out[PAD_T + y, PAD_L + x] = spr[3, ax]
    return out


def frame(i):
    ph = L.sinus(i, N / 3)                                       # dreimal pro Schleife
    aus = max(0.0, math.sin(ph))
    dx = int(round(2.4 * aus))                                   # 0 … 2 px nach außen
    r = teil(rumpf)
    s = teil(schwanz)
    if i in (15, 16):
        for (x, y) in AUGEN:
            r[PAD_T + y, PAD_L + x, :3] = UMRISS
    s = L.zeilen_welle(s, PAD_T + 3, 1.0, L.sinus(i, N / 2, 0.6))
    l = fluegel(True, dx)
    rr = fluegel(False, dx)
    bob = -dx // 2 if dx else 0
    return L.zusammen(H, W, [(r, 0, bob), (s, 0, bob), (l, 0, bob), (rr, 0, bob)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bird', 'Bird', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bird-strip.png', [frames[k] for k in (0, 1, 2, 3, 4, 5, 6, 15)], spalten=8, scale=14)
