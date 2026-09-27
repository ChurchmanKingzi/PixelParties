# -*- coding: utf-8 -*-
"""46 Midnight London – Big Ben schlägt Mitternacht im Nebel; davor, auf dem nassen Pflaster des Vorplatzes,
halten die zwei Gardisten mit Bärenfellmütze und Hellebarde Wache, in der Mitte die Königin mit ihrem Corgi.

Quellen (MotiveBritain.xcf):
  Big Ben: Ebene #4 (i270, nur der Turm, Zeilen 0–175), 2×, nächtlich abgedunkelt (Zifferblatt bleibt hell);
  der Parlamentsflügel derselben Ebene (Zeilen 200–336) dunkel im Nebel links (gespiegelt) und rechts.
  Gardisten: „Big Gwen Guards“ (i188, zwei spiegelbildliche Wachen in einer Ebene; laut Szene „Sichtbar #16“
  vollständig), Königin: „Victorica“ (i260, vollständig), Corgi: Ebene #27 (i212, laut „Sichtbar #8“ vollständig).
  Himmel, Nebel und Pflaster: eigene Verläufe/Bayer-Dithering in Nachtfarben.

Skalierung: alle Figuren (Gardisten, Königin, Corgi) und das Pflaster 3× auf einer Ebene; Big Ben + Parlament 2×
weit hinten jenseits der Nebelbank.
"""
from common import *
import numpy as np

B = 'MotiveBritain'
cv = Canvas(250, 350)
YY, XX = np.mgrid[0:350, 0:250]

# --- Nachthimmel ----------------------------------------------------------------------------------------
cols = [np.array(c) for c in ((8, 12, 28), (16, 24, 46), (28, 38, 62), (44, 54, 76))]
t = np.clip(YY / 300, 0, 1) * (len(cols) - 1)
q = np.floor(t + BAYER4[YY % 4, XX % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    cv.a[q == k] = c
rng = np.random.default_rng(46)
for _ in range(26):
    x, y = rng.integers(2, 248), rng.integers(2, 120)
    cv.a[y, x] = (150, 160, 190) if rng.random() < 0.7 else (220, 226, 240)

# --- Parlamentsflügel (aus derselben Ebene, rechts neben dem Turm), 2×, weit hinten im Nebel ------------------
bb = compose(B, [270])
par = bb[200:336, 92:259].copy()
pc = par[..., :3].astype(float)
par[..., :3] = (pc * np.array([0.30, 0.33, 0.46]) + np.array([10, 14, 30])).clip(0, 255).astype(np.uint8)
p2 = up(par, 2)
PY = 128
cv.paste(p2, 170, PY)
cv.paste(flip(p2), 80 - p2.shape[1], PY)

# --- Big Ben (2×) -----------------------------------------------------------------------------------------
tower = bb[:176, 20:96].copy()
c = tower[..., :3].astype(float)
yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
lit = ((yy - 95.5) ** 2 + (xx - 36.5) ** 2) <= 20.5 ** 2               # Zifferblatt
dark = (c * np.array([0.42, 0.44, 0.6]) + np.array([4, 6, 16])).clip(0, 255)
tower[..., :3] = np.where(lit[..., None], c, dark).astype(np.uint8)
t2 = up(tower, 2)
TX, TY = 125 - t2.shape[1] // 2, 4
cv.paste(t2, TX, TY)

# --- Nebelbänke (gedithert) -------------------------------------------------------------------------------
FOG = np.array([112, 122, 142])
def fogband(y0, y1, dens):
    for y in range(y0, y1):
        tt = 1 - abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2))
        for x in range(250):
            wob = 0.5 + 0.5 * np.sin(x * 0.05 + y * 0.13)
            if tt * dens * (0.6 + 0.4 * wob) > BAYER4[y % 4, x % 4] * 0.95 + 0.05:
                cv.a[y, x] = (cv.a[y, x] * 0.45 + FOG * 0.55).astype(np.uint8)
fogband(150, 200, 0.5)
fogband(222, 290, 1.5)

# --- Vorplatz: nasses Pflaster (3×-Raster: Fugen alle 3 bzw. 6 px) ------------------------------------------
GY = 272
STONE = [np.array(c) for c in ((34, 38, 56), (44, 48, 68), (56, 60, 80))]
for y in range(GY, 350):
    r = (y - GY) // 9                                   # Steinreihen, 3 Rasterpixel hoch
    for x in range(250):
        off = 9 if r % 2 else 0
        joint = ((y - GY) % 9 == 8) or ((x + off) % 18 == 17)
        hh = ((x + off) // 18 * 7 + r * 3) % 3
        col = STONE[hh] * (0.6 + 0.4 * (y - GY) / 78)
        if joint: col = np.array((18, 20, 32))
        cv.a[y, x] = col.astype(np.uint8)
# Nebelschleier über der Pflasterkante
fogband(262, 286, 1.2)


def put(s, cx, feet, k=3, fl=False):
    if fl: s = flip(s)
    s = up(s, k)
    h, w = s.shape[:2]
    # Schlagschatten (Ellipse, 3×-Raster)
    for yy_ in range(feet - 6, feet + 3, 3):
        for xx_ in range(cx - w // 2, cx + w // 2, 3):
            if ((xx_ + 1.5 - cx) / (w * 0.42)) ** 2 + ((yy_ + 1.5 - feet + 1) / 5) ** 2 < 1 and 0 <= yy_ < 348:
                cv.a[yy_:yy_ + 3, xx_:xx_ + 3] = (cv.a[yy_:yy_ + 3, xx_:xx_ + 3] * 0.45).astype(np.uint8)
    cv.paste(s, cx - w // 2, feet - h)

# --- Gardisten, Königin, Corgi – alle 3× ----------------------------------------------------------------------
guards = split_x(sprite('h46_guards', B, [188]))
put(guards[0], 44, 330)
put(guards[1], 206, 330)
put(sprite('h46_queen', B, [260]), 125, 340)
put(flip(sprite('h46_corgi', B, [212])), 164, 349)

vignette(cv, 0.45, 0.6)
save(cv, '46_midnight_london.png')
