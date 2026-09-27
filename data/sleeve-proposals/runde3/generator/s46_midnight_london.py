# -*- coding: utf-8 -*-
"""46 Midnight London – Big Ben schlägt Mitternacht im Nebel; davor halten die Gardisten mit Bärenfellmützen
Wache, in der Mitte die Königin mit ihrem Corgi.

Quellen (MotiveBritain.xcf):
  Big Ben: Ebene #4 (i270, nur der Turm, Zeilen 0–175), 2×, nächtlich abgedunkelt (Zifferblatt bleibt hell);
  der Parlamentsflügel derselben Ebene (Zeilen 200–336) dunkel im Hintergrund links (gespiegelt) und rechts.
  Gardisten: „Big Gwen Guards“ (i188, zwei spiegelbildliche Wachen in einer Ebene, getrennt), 4×.
  Königin: „Victorica“ (i260), 3×.  Corgi: Ebene #27 (i212), 3×.
  Himmel und Nebelbänke: eigene Verläufe/Bayer-Dithering in Nachtfarben.
"""
from common import *
import numpy as np

B = 'MotiveBritain'
cv = Canvas(250, 350)

# --- Nachthimmel ----------------------------------------------------------------------------------------
cols = [np.array(c) for c in ((8, 12, 28), (16, 24, 46), (28, 38, 62), (44, 54, 76))]
for y in range(350):
    t = min(1, y / 300) * (len(cols) - 1)
    i = int(t); fr = t - i
    for x in range(250):
        cv.a[y, x] = cols[min(len(cols) - 1, i + (1 if fr > BAYER4[y % 4, x % 4] else 0))]

# --- Parlamentsflügel (aus derselben Ebene, rechts neben dem Turm), 2×, weit hinten im Nebel ------------------
bb = compose(B, [270])
par = bb[200:336, 92:259].copy()
pc = par[..., :3].astype(float)
par[..., :3] = (pc * np.array([0.34, 0.37, 0.5]) + np.array([10, 14, 30])).clip(0, 255).astype(np.uint8)
p2 = up(par, 2)
PY = 128
cv.paste(p2, 170, PY)
cv.paste(flip(p2), 80 - p2.shape[1], PY)

# --- Big Ben (2×) -----------------------------------------------------------------------------------------
bb = compose(B, [270])
tower = bb[:176, 20:96].copy()
c = tower[..., :3].astype(float)
lum = c.mean(-1)
yy, xx = np.mgrid[0:lum.shape[0], 0:lum.shape[1]]
lit = ((yy - 95.5) ** 2 + (xx - 36.5) ** 2) <= 20.5 ** 2               # Zifferblatt (Mitte 56,95 in der Ebene)
dark = (c * np.array([0.42, 0.44, 0.6]) + np.array([4, 6, 16])).clip(0, 255)
c = np.where(lit[..., None], c, dark)
tower[..., :3] = c.astype(np.uint8)
t2 = up(tower, 2)
TY = 6
cv.paste(t2, 125 - t2.shape[1] // 2, TY)

# --- Nebelbänke (gedithert) -------------------------------------------------------------------------------
FOG = np.array([118, 128, 146])
def fogband(y0, y1, dens):
    for y in range(y0, y1):
        t = 1 - abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2))
        for x in range(250):
            wob = 0.5 + 0.5 * np.sin(x * 0.05 + y * 0.13)
            if t * dens * (0.6 + 0.4 * wob) > BAYER4[y % 4, x % 4] * 0.95 + 0.05:
                cv.a[y, x] = (cv.a[y, x] * 0.45 + FOG * 0.55).astype(np.uint8)

fogband(150, 200, 0.5)
fogband(226, 306, 1.4)
fogband(290, 350, 1.0)


def put(key, s, cx, feet, k, fl=False):
    if fl: s = flip(s)
    s = up(s, k)
    h, w = s.shape[:2]
    cv.paste(s, cx - w // 2, feet - h)

# --- Gardisten, Königin, Corgi ----------------------------------------------------------------------------
guards = split_x(sprite('h46_guards', B, [188]))
put('gl', guards[0], 44, 350, 4)
put('gr', guards[1], 206, 350, 4)
put('queen', sprite('h46_queen', B, [260]), 125, 342, 3)
put('corgi', sprite('h46_corgi', B, [212]), 80, 350, 3)

vignette(cv, 0.45, 0.6)
save(cv, '46_midnight_london.png')
