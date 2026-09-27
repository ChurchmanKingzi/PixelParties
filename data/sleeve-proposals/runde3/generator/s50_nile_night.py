# -*- coding: utf-8 -*-
"""50 Nile Night – Pyramide vor dem Vollmond, gespiegelt im Nil; am Ufer halten Anubis und Sobek Wache.

Quellen (MotiveEgypt.xcf):
  Himmel mit Mond: Ebene #13 (i235), 2×, Ausschnitt um den Mond.
  Pyramiden: „Pyramid“ (MotiveIndia i186 – dieselbe Grafik liegt in MotiveEgypt als i121 kopfüber) und
  Ebene #89 (i96, kopfüber → gespiegelt), 2×, mondbeschienen umgefärbt; Spiegelbild im Wasser = dieselben
  Ebenen vertikal gespiegelt, in 2-px-Blöcken wellig versetzt.
  Nil: Wassertextur aus „Hintergrund“ (i234, x120–152 = eine 32-px-Periode), 2×; Ufer: Sand Ebene #91 (i93), 2×.
  Wächter am Ufer (Einzel-Ebenen, vollständig laut Sichtbar-Szenen): Khet (i214, Anubis-Mumie, 4×),
  Ebene #1 (i230, Krokodil-Mumie mit Anch, 4×), mondblau getönt.
"""
from common import *
import numpy as np

B = 'MotiveEgypt'
cv = Canvas(250, 350)

# --- Himmel ---------------------------------------------------------------------------------------------
sky = compose(B, [235])[..., :3]
MX, MY = 126, 60                                # Mondmitte auf dem Canvas (Ebene: 179,103) – hinter der Spitze
sx0, sy0 = 179 - MX // 2, 103 - MY // 2
sk = up(sky[sy0:sy0 + 110, sx0:sx0 + 125], 2)
cv.a[:220] = sk[:220, :250]

HOR = 204                                       # Pyramidenfuß = Uferlinie hinten
W1 = 300                                        # vorderes Ufer


def moonlit(s, f=1.0):
    o = s.copy(); o[..., :3] = (o[..., :3] * np.array([0.68, 0.62, 0.6]) * f + np.array([6, 10, 38])).clip(0, 255).astype(np.uint8)
    return o


# Große Pyramide: „Pyramid“ aus MotiveIndia (i186, spitze Form, gleiche Grafik wie Egypt i121, die dort
# kopfüber liegt), horizontal gespiegelt → Lichtseite rechts. Kleine Pyramide: Egypt Ebene #89 (i96), kopfüber
# in der Datei → vertikal gespiegelt.
P2 = moonlit(up(flip(compose('MotiveIndia', [186])), 2), 1.0)
P1 = moonlit(up(compose(B, [96])[::-1], 2), 0.62)
pyr = [(P1, 214), (P2, 110)]
for s, ax in pyr:
    cv.paste(s, ax - s.shape[1] // 2, HOR - s.shape[0])

# --- Nil ------------------------------------------------------------------------------------------------
water = compose(B, [234])[50:210, 120:152, :3]
wat = up(np.tile(water, (1, 5, 1)), 2)
wc = np.array([0.36, 0.42, 0.66])
for y in range(HOR, W1):
    cv.a[y] = (wat[(y - HOR) % wat.shape[0], :250] * wc).astype(np.uint8)

# Spiegelbild der Pyramiden: gespiegelt, in 2-px-Blöcken wellig versetzt, mit Wasserlücken
for s, ax in pyr:
    f = s[::-1]
    h, w = f.shape[:2]
    x0 = ax - w // 2
    for j in range(0, h, 2):
        y = HOR + j
        if y + 1 >= W1: break
        blk = j // 2
        t = j / (W1 - HOR)
        if blk % 4 == 3 or (blk % 4 == 1 and t > 0.45): continue       # Wasserstreifen
        dx = 2 * int(round(np.sin(blk * 1.3) * (1 + 2 * t)))
        for i in range(w):
            x = x0 + i + dx
            if 0 <= x < 250 and f[j, i, 3]:
                for yy in (y, y + 1):
                    cv.a[yy, x] = (f[j, i, :3] * (0.62 - 0.25 * t) + cv.a[yy, x] * (0.38 + 0.25 * t)).astype(np.uint8)
cv.a[HOR] = (20, 24, 46)

# Mondspiegelung (2-px-Blöcke)
moonc = np.array([196, 204, 168])
for y in range(HOR + 2, W1 - 2, 4):
    t = (y - HOR) / (W1 - HOR)
    half = int(8 + 16 * t)
    for x in range(MX - half, MX + half, 2):
        if 0 <= x < 249:
            edge = abs(x - MX) / half
            if (1 - edge) > BAYER4[(y // 2) % 4, (x // 2) % 4] * 0.8 + 0.12 and (x // 4 + y // 4) % 3:
                cv.a[y:y + 2, x:x + 2] = moonc

# --- vorderes Ufer --------------------------------------------------------------------------------------
sand = up(compose(B, [93])[..., :3], 2)
for y in range(W1, 350):
    cv.a[y] = (sand[(y + 30) % sand.shape[0], :250] * np.array([0.40, 0.36, 0.42])).astype(np.uint8)
cv.a[W1] = (14, 14, 26)

# --- Silhouetten der Götter am Ufer ---------------------------------------------------------------------
SIL = (10, 10, 22)

def sil(key, ids, cx, feet, k, keep_gold=False, fl=False):
    s = sprite('h50_' + key, B, ids)
    if fl: s = flip(s)
    o = silhouette(s, SIL)
    if keep_gold:                      # goldenes Anch bleibt sichtbar (vom Mond angeleuchtet)
        c = s[..., :3].astype(int)
        gold = (c[..., 0] > 150) & (c[..., 1] > 110) & (c[..., 2] < 90)
        o[gold, :3] = (s[gold, :3] * 0.85).astype(np.uint8)
    o = up(o, k)
    h, w = o.shape[:2]
    cv.paste(o, cx - w // 2, feet - h)

def god(key, ids, cx, feet, k, fl=False):
    s = sprite('h50_' + key, B, ids)
    if fl: s = flip(s)
    s = up(s, k)
    s = s.copy(); s[..., :3] = (s[..., :3] * np.array([0.78, 0.8, 0.95]) + np.array([4, 6, 18])).clip(0, 255).astype(np.uint8)
    h, w = s.shape[:2]
    sh = np.zeros((k, w - 2 * k, 4), np.uint8); sh[..., 3] = 255
    cv.paste(sh, cx - w // 2 + k, feet - k, alpha=0.5)
    cv.paste(s, cx - w // 2, feet - h)

god('khet', [214], 50, 348, 4, fl=True)
god('sobek', [230], 200, 348, 4)

vignette(cv, 0.5, 0.6)
save(cv, '50_nile_night.png')
