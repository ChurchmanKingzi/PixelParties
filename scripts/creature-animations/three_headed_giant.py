# -*- coding: utf-8 -*-
"""Idle-Animation für „3-Headed Giant“ (Creature).

Quelle: src/3-headed-giant.png — Ebene „3-Headed GIant“ (36×32 px, 28 Farben) aus Motive.xcf.

Aufruf:   python3 three_headed_giant.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/3-headed-giant.png + .json

Ablauf (32 Frames à 90 ms = 2,88 s):
* Atmen: eine Bauchzeile (Zeile 21) wird bis zu zweimal eingefügt — der Oberkörper mit Köpfen und Keule hebt sich um
  bis zu 2 px, die Füße bleiben stehen (Squash & Stretch).
* Oberkörper lehnt sich hin und her (Zeilenversatz wächst nach oben, Köpfe ±1 px), die Keule pendelt gegenläufig
  um die Hand (links hinter dem Körper).
* Jeder Kopf blinzelt zu eigener Zeit: leuchtendes Augenpixel → dunkelrot → Lid (3 Stufen).
Der rote Fleck rechts (30,17) und alle Hauer/Krallen sind fest. Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 32, 90
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 3
BAUCHZEILE = 21

spr = L.lade('3-headed-giant')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# Keule: Der Keulenkopf (Zeilen 0–14) besteht aus neutral dunkelgrauen Pixeln und ist über sie zusammenhängend
# (die Stachelspitzen reichen bis x = 11); die Köpfe haben braune Umrisse. Griff/Zwinge ab Zeile 15: x ≤ 7 (dort
# beginnt der Arm bei x = 8).
def neutral_dunkel(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return abs(r - g) <= 3 and abs(g - b) <= 3 and r <= 140


kopf = np.zeros((sh, sw), bool)
stapel = [(5, 3)]
while stapel:
    x, y = stapel.pop()
    if not (0 <= x < sw and 0 <= y <= 14) or kopf[y, x] or not vorhanden[y, x] or not neutral_dunkel(spr[y, x, :3]):
        continue
    kopf[y, x] = True
    stapel += [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
keule = kopf | (vorhanden & (yy >= 15) & (xx <= 7))
koerper = vorhanden & ~keule
oben = koerper & (yy <= 20)
unten = koerper & (yy > 20)

HELL, DUNKELROT, LID = (225, 92, 69), (94, 20, 0), (37, 20, 10)
AUGEN = [(9, 14), (14, 14), (18, 11), (23, 11), (27, 14), (32, 14)]
BLINZELN = {0: (20, 21, 22), 1: (20, 21, 22), 2: (8, 9, 10), 3: (8, 9, 10), 4: (14, 15, 16), 5: (14, 15, 16)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return t


def blinzeln(t, i):
    for k, (cx, cy) in enumerate(AUGEN):
        a, b, c = BLINZELN[k]
        if i not in (a, b, c):
            continue
        gruppe = [(cx, cy)] + [(x, y) for x, y in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1))
                               if 0 <= x < sw and 0 <= y < sh and t[y, x, 3] and tuple(t[y, x, :3]) == DUNKELROT]
        for (x, y) in gruppe:
            t[y, x, :3] = LID if i == b else (DUNKELROT if (x, y) == (cx, cy) else t[y, x, :3])
    return t


def frame(i):
    lehnen = L.sinus(i, N)
    atem = int(round(1 - math.cos(L.sinus(i, N))))                 # 0 … 2 zusätzliche Bauchzeilen
    ob = L.zeilen_welle(blinzeln(teil(oben), i), 20, 0.9, lehnen, richtung=-1)
    un = teil(unten)
    kl = L.zeilen_welle(teil(keule), 20, 1.8, lehnen - 1.0, signiert=True)
    f = L.zusammen(H, W, [(kl, PAD_L, PAD_T), (un, PAD_L, PAD_T), (ob, PAD_L, PAD_T)])
    return L.streck_zeile(f, PAD_T + BAUCHZEILE, atem)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('3-headed-giant', '3-Headed Giant', frames, MS, prev)
    if prev:
        L.streifen(prev + '/3-headed-giant-strip.png', [frames[k] for k in (0, 4, 8, 9, 12, 16, 20, 21)], spalten=4, scale=8)
