# -*- coding: utf-8 -*-
"""24 Odd One Out – der „unauffällige“ Gartenzwerg hat sich auf einen leeren Sockel gestellt und steht
mit Sonnenbrille mitten in der Reihe der steinernen Wächterbüsten des Himmelsheiligtums – als wäre nichts.

Quellen (MotiveMoe.xcf):
  Ebene 212 „Inconspicuous Lawn Gnome“ – Gartenzwerg (geprüft gegen „Sichtbar #72“: vollständig), 4×
  Ebene 396 „Oracle of Heaven #4“ – Büsten auf Sockeln (rot- und gelbäugig; die rotäugige liefert auch den
             leeren Sockel für den Zwerg: Büstenpixel auf der Sockeloberseite mit Sockelfarben geschlossen), 4× / 2×
  Ebene 145 „Ebene #8“ – Büsten ohne leuchtende Augen, 2×
  Ebene 496 „Oracle of Heaven #5“ – Säulen, 2×
  Ebene 534 „Ebene #30“ – Pflaster (16×16-Kachel, sandsteinfarben umgefärbt), Rasen und Blumenbüsche
             des Oktogon-Heiligtums, 2×
  Ebene 553 „Hintergrund“ – Himmel mit Wolken, 2×
Selbst gezeichnet (2×-Raster): Schatten, Kanten von Rasen und Pflaster.

Tiefenebenen / Skalierung:
  Himmel, Rasen, Pflaster, hintere Reihe (Säulen + Büsten), Büsche ... 125×175-Raster, 2×
  vordere Reihe (Büste – Zwerg auf Sockel – Büste) .................. 63×88-Raster, 4×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
import math
import numpy as np

M = 'MotiveMoe'
W, H = 250, 350


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(L, s, x, y):
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(L.shape[1], x + w), min(L.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] > 127
    L[Y0:Y1, X0:X1][m] = sub[m]


def lift(L, k):
    return up(L, k)[:H, :W]


def shadow(g, cx, cy, rx, ry, f=0.55):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if e < 1 and 0 <= x < g.w and 0 <= y < g.h and (1 - e) * 1.7 > BAYER4[y % 4, x % 4]:
                g.a[y, x] = (g.a[y, x] * f).astype(np.uint8)


# ---------- Sprites ----------
busts = parts(sprite('e24_busts396', M, [396]), dil=0)        # [rot, gelb, grün-stachelig, blau-lockig]
plain = parts(sprite('e24_busts145', M, [145]), dil=0)        # drei Büsten ohne Leuchtaugen
cols_ = parts(sprite('e24_pillars496', M, [496]), dil=0)
pillar = [p for p in cols_ if p.shape == (32, 14, 4)][0]
RED, YEL, GRN = busts[0], busts[1], busts[2]
GNOME = sprite('e24_gnome', M, [212])                         # 15×24
octa = sprite('e24_octagon', M, [534])
COB = hsv_shift(octa[64:80, 32:48], dh=120, ds=0.8, dv=0.95)   # Pflasterkachel 16×16, sandsteinfarben umgefärbt
GRS = octa[16:30, 48:64]                                      # Rasen (reines Rasenstück)
BUSH = octa[33:46, 33:47]                                     # Blumenbusch

# leerer Sockel: Sockel der rotäugigen Büste (Zeilen 17–29), Büstenpixel übermalt
ped = RED[17:30].copy()
bustcols = {(68, 63, 73), (148, 138, 156), (129, 119, 137), (170, 155, 181), (98, 92, 103), (180, 165, 191)}
for y in range(ped.shape[0]):
    for x in range(ped.shape[1]):
        if tuple(int(v) for v in ped[y, x, :3]) in bustcols and ped[y, x, 3]:
            ped[y, x, :3] = (98, 96, 100) if y == 0 else ((193, 183, 189) if y == 1 else (173, 171, 175))
# Oberkante Zeile 0: Umriss über die ganze Sockelbreite schließen
ped[0, 2:14] = (98, 96, 100, 255)
# Zwerg auf den Sockel (Füße auf Sockeloberseite, Zeile 3)
GP = np.zeros((GNOME.shape[0] + ped.shape[0] - 3, 16, 4), np.uint8)
GP[GNOME.shape[0] - 3:] = ped
put(GP, GNOME, 16 // 2 - GNOME.shape[1] // 2 + 1 - 1, 0)

# ---------- Ebene 1 (2×) ----------
g = Canvas(125, 175)
g.a[:] = layer(M, 553)[151 + 60:151 + 60 + 175, 200:325][..., :3]
HZ = 46                                                      # Inselkante (Rasenbeginn)
PZ0, PZ1 = 78, 150                                           # Pflasterplatz zwischen hinterem und vorderem Rasenring
for y in range(HZ, 175):
    for x in range(125):
        if PZ0 <= y < PZ1:                                   # Platz im Schatten -> Büsten heben sich ab
            g.a[y, x] = (COB[(y - PZ0) % 16, (x + 6) % 16, :3] * 0.68).astype(np.uint8)
        else:
            g.a[y, x] = GRS[(y - HZ) % GRS.shape[0], (x + 3 * ((y - HZ) // GRS.shape[0])) % GRS.shape[1], :3]
for x in range(125):                                          # Pflasterränder
    g.px(x, PZ0, (86, 70, 58)); g.px(x, PZ1 - 1, (86, 70, 58)); g.px(x, PZ1, (40, 70, 30))
    g.px(x, HZ, (120, 160, 80)); g.px(x, HZ + 1, (60, 100, 40))

# hintere Reihe: Säule – Büste – Büste(grün, Mitte) – Büste – Säule, Fußlinie BY
BY = 74
row = [(pillar, 14), (plain[0], 38), (GRN, 62), (flip(plain[1]), 87), (pillar, 111)]
for s, cx in row:
    shadow(g, cx + 1, BY, s.shape[1] // 2 + 2, 2)
cvb = Canvas(125, 175); cvb.a[:] = g.a
for s, cx in row:
    cvb.paste(s, cx - s.shape[1] // 2, BY - s.shape[0])
g = cvb
for cx in (26, 99):                                          # Blumenbüsche zwischen Säule und Büste
    g.paste(BUSH, cx - BUSH.shape[1] // 2, BY + 1 - BUSH.shape[0])

# Schatten der vorderen Reihe (im 2×-Raster)
FB = 80                                                      # Fußlinie vorne im 63×88-Raster (auf dem vorderen Rasen)
pos = [(14, RED), (31, GP), (48, flip(YEL))]
for cx, s in pos:
    shadow(g, cx * 2 + 1, FB * 2 - 1, s.shape[1] + 5, 3.5, 0.5)

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L = rgba(63, 88)
for cx, s in pos:
    put(L, s, cx - s.shape[1] // 2, FB - s.shape[0])
out.paste(lift(L, 4), 0, 0)
print(save(out, '24_odd_one_out.png'))
