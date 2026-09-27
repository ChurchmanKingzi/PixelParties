# -*- coding: utf-8 -*-
"""24 Odd One Out – eine Allee steinerner Wächterbüsten führt in die Tiefe des Himmelsheiligtums; ganz vorn,
im Licht, steht auf einem leeren Sockel der „unauffällige“ Gartenzwerg mit Sonnenbrille – als wäre er
eine der Statuen.

Quellen (MotiveMoe.xcf):
  Ebene 212 „Inconspicuous Lawn Gnome“ – Gartenzwerg (geprüft gegen „Sichtbar #72“: vollständig), 5×
  Ebene 396 „Oracle of Heaven #4“ – Büsten auf Sockeln: rotäugig (links) und gelbäugig (rechts, gespiegelt)
             in der Mitte, grün-stachelig am Ende der Allee; die rotäugige liefert auch den leeren Sockel für
             den Zwerg (Büstenpixel auf der Sockeloberseite mit Sockelfarben geschlossen)
  Ebene 145 „Ebene #8“ – Büsten ohne Leuchtaugen (hinten), 2×
  Ebene 496 „Oracle of Heaven #5“ – Säulen (hinten), 2×
  Ebene 534 „Ebene #30“ – Rasen, Pflaster (16×16-Kachel, sandsteinfarben umgefärbt), Blumenbüsche, 2×
  Ebene 553 „Hintergrund“ – Himmel mit Wolken, Ebene 122 „Ebene #64“ – Wolke, 2×
Selbst gezeichnet (2×-Raster): perspektivischer Pflasterweg, Schatten, Lichtfleck um den Sockel und eine
geditherte Abdunklung des Bodens zum Rand hin (Licht auf dem Zwerg).

Tiefenebenen / Skalierung (Allee in drei Staffeln, je Staffel ein Raster):
  Himmel, Boden, Weg, hintere Staffel (Säulen, Büsten, Büsche) ... 125×175-Raster, 2×
  mittlere Staffel (rot- und gelbäugige Büste) ................... 84×117-Raster, 3×
  vorn: Zwerg auf Sockel (Hauptmotiv) ............................ 50×70-Raster, 5×
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
COB = hsv_shift(octa[64:80, 32:48], dh=120, ds=0.8, dv=0.95)  # Pflasterkachel 16×16
GRS = octa[16:30, 48:64]                                      # Rasen
BUSH = octa[33:46, 33:47]                                     # Blumenbusch
CLOUD = sprite('e24_cloud', M, [122])

# leerer Sockel: Sockel der rotäugigen Büste (Zeilen 17–29), Büstenpixel übermalt
ped = RED[17:30].copy()
bustcols = {(68, 63, 73), (148, 138, 156), (129, 119, 137), (170, 155, 181), (98, 92, 103), (180, 165, 191)}
for y in range(ped.shape[0]):
    for x in range(ped.shape[1]):
        if tuple(int(v) for v in ped[y, x, :3]) in bustcols and ped[y, x, 3]:
            ped[y, x, :3] = (98, 96, 100) if y == 0 else ((193, 183, 189) if y == 1 else (173, 171, 175))
ped[0, 2:14] = (98, 96, 100, 255)
GP = np.zeros((GNOME.shape[0] + ped.shape[0] - 3, 16, 4), np.uint8)
GP[GNOME.shape[0] - 3:] = ped
put(GP, GNOME, 0, 0)

# ---------- Ebene 1 (2×): Himmel ----------
g = Canvas(125, 175)
g.a[:] = layer(M, 553)[151 + 20:151 + 20 + 175, 70:195][..., :3]
g.paste(flip(CLOUD), 40, 8)
g.paste(CLOUD, -70, 30)
HZ = 58                                                      # Inselkante / Horizont
yy, xx = np.mgrid[0:175, 0:125]
for y in range(HZ, 175):
    for x in range(125):
        g.a[y, x] = GRS[(y - HZ) % GRS.shape[0], (x + 3 * ((y - HZ) // GRS.shape[0])) % GRS.shape[1], :3]
for x in range(125):
    g.px(x, HZ, (120, 160, 80)); g.px(x, HZ + 1, (60, 100, 40))
# perspektivischer Pflasterweg (Allee), wird nach vorn breiter
P0 = 66                                                      # Wegbeginn bei der hinteren Staffel
for y in range(P0, 175):
    hw = 7 + (y - P0) * 0.30
    for x in range(125):
        dx = abs(x + .5 - 62.5)
        if dx < hw:
            g.a[y, x] = COB[(y - P0) % 16, (x + 8) % 16, :3]
        elif dx < hw + 1:
            g.a[y, x] = (86, 70, 58)
# Boden nach vorn/außen etwas dunkler
for y in range(HZ + 2, 175):
    for x in range(125):
        t = 0.25 * abs(x + .5 - 62.5) / 62.5 + 0.12 * (y - HZ) / (175 - HZ)
        if t > BAYER4[y % 4, x % 4] * 0.5 + 0.12:
            g.a[y, x] = (g.a[y, x] * 0.82).astype(np.uint8)

# hintere Staffel (2×): Säule – Busch – Büste | grüne Büste am Wegende | Büste – Busch – Säule
BY = 70
back = [(pillar, 22), (plain[0], 40), (GRN, 62.5), (flip(plain[1]), 85), (pillar, 103)]
for s, cx in back:
    shadow(g, cx + 1.5, BY, s.shape[1] // 2 + 2, 1.8)
for s, cx in back:
    g.paste(s, int(round(cx - s.shape[1] / 2)), BY - s.shape[0])
for cx in (31, 94):
    g.paste(BUSH, cx - BUSH.shape[1] // 2, BY + 1 - BUSH.shape[0])

# mittlere Staffel (3×): Schatten im 2×-Raster
MB = 76                                                      # Fußlinie im 84×117-Raster
mid = [(17, RED), (67, flip(YEL))]
for cx, s in mid:
    shadow(g, cx * 1.5 + 1, MB * 1.5 - 0.5, s.shape[1] * 0.75 + 2, 2.4)

# vorn (5×): Zwerg auf Sockel, Lichtfleck + Schatten
GX, GB = 25, 65                                              # Mitte / Fußlinie im 50×70-Raster
fx, fy = GX * 2.5, GB * 2.5
# Lichtfleck (sonnenbeschienener Boden um den Sockel)
for y in range(int(fy - 9), int(fy + 8)):
    for x in range(int(fx - 32), int(fx + 33)):
        e = ((x + .5 - fx) / 30) ** 2 + ((y + .5 - fy) / 7.5) ** 2
        if e < 1 and 0 <= y < 175 and (1 - e) * 1.4 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = np.minimum(255, g.a[y, x].astype(int) * 1.22 + 14).astype(np.uint8)
shadow(g, fx + 5, fy - 0.5, 22, 3.2, 0.5)
# Licht auf den Zwerg: Umgebung zum Rand hin gedithert abdunkeln (Vignette im 2×-Raster)
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vignette_grid  # noqa
cvv = Canvas(125, 175); cvv.a[:] = g.a
vignette_grid(cvv, 0.55, 0.42, g=1, box=(0, HZ, 125, 175))
g.a[:] = cvv.a

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L3 = rgba(84, 117)
for cx, s in mid:
    put(L3, s, cx - s.shape[1] // 2, MB - s.shape[0])
out.paste(lift(L3, 3), 0, 0)
L5 = rgba(50, 70)
put(L5, GP, GX - GP.shape[1] // 2, GB - GP.shape[0])
out.paste(lift(L5, 5), 0, 0)
print(save(out, '24_odd_one_out.png'))
