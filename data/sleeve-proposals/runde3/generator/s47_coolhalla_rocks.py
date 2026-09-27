# -*- coding: utf-8 -*-
"""47 Coolhalla Rocks – die Wikinger-Band spielt nachts vor der Eisburg, hinter dem Schlagzeug lodert ein
Feuerring, oben platzt Feuerwerk, vorne zünden die Pyro-Flammen.

Quellen (MotiveCoolhalla.xcf):
  Band (je eine vollständige Ebene, vgl. Szene „Sichtbar #36“): Schlagzeuger Ebene #118 (i106), Gitarrist
  Ebene #124 (i105), Sängerin Ebene #125 (i104), Keyboarder Ebene #129 (i103) – alle 3×.
  Feuerring Ebene #109 (i112, 2×) als Bühnenbild, Feuerwerk Ebene #131 (i107, in Einzelraketen zerlegt, 2×),
  Burg Ebene #11 (i253, 1×, nachtblau abgedunkelt), Eisboden-Farben Ebene #2 (i256) + Schraffur Ebene #3 (i255)
  als Bühne, Pyro-Flammen an der Bühnenkante aus den Flammenreihen Ebene #36 (i194) / #33 (i205), 3×.
  Himmel: eigener Nachtverlauf (Bayer-Dithering).
"""
from common import *
import numpy as np

B = 'MotiveCoolhalla'
cv = Canvas(250, 350)

# --- Nachthimmel (eigener Verlauf) -------------------------------------------------------------------------
top, bot = np.array([10, 12, 34]), np.array([46, 30, 70])
steps = [top + (bot - top) * t for t in np.linspace(0, 1, 6)]
for y in range(350):
    t = min(1, y / 220) * 5
    i = int(t); fr = t - i
    for x in range(250):
        c = steps[min(5, i + (1 if fr > BAYER4[y % 4, x % 4] else 0))]
        cv.a[y, x] = c

# --- Feuerwerk: Einzelraketen aus Ebene #131, 2× ------------------------------------------------------------
fw = parts(compose(B, [107]), dil=3)
fw = sorted(fw, key=lambda p: -p.shape[0] * p.shape[1])
pos = [(46, 44), (206, 40), (128, 22), (212, 120)]
for p, (cx, cy) in zip(fw, pos):
    p2 = up(p, 2)
    cv.paste(p2, cx - p2.shape[1] // 2, cy - p2.shape[0] // 2)

# --- Burg (1×, nachtblau, ohne eigene Lichter) --------------------------------------------------------------
castle = compose(B, [253])
c2 = castle.copy()
cc = c2[..., :3].astype(float)
lum = cc.mean(-1, keepdims=True)
c2[..., :3] = (cc * 0.18 + np.array([20, 24, 56]) * (0.55 + 0.6 * lum / 255)).clip(0, 255).astype(np.uint8)
cv.paste(c2, 125 - c2.shape[1] // 2, 244 - c2.shape[0])

# --- Bühne: Eisfläche (Farben aus Ebene #2) mit Schraffur aus Ebene #3, 2× ------------------------------------
hat = compose(B, [255])[30:62, 180:340]              # vollständig schraffierter Streifen
ICE, ICE_D, WHITE = np.array([164, 228, 252]), np.array([96, 140, 147]), np.array([240, 252, 252])
SY = 240
for y in range(SY, 350):
    t = (y - SY) / (350 - SY)
    base = ICE * (0.62 + 0.3 * t)
    row = hat[((y - SY) // 2) % hat.shape[0]]
    for x in range(250):
        c = base
        if row[(x // 2) % hat.shape[1], 3] > 0: c = WHITE * (0.66 + 0.3 * t)
        cv.a[y, x] = c.astype(np.uint8)
cv.a[SY] = ICE_D; cv.a[SY + 1] = ICE_D

def put(ids, key, cx, feet, k, fl=False, f=1.0):
    s = sprite('h47_' + key, B, ids)
    if fl: s = flip(s)
    if f != 1.0: s = darken(s, f)
    s = up(s, k)
    h, w = s.shape[:2]
    cv.paste(s, cx - w // 2, feet - h)
    return s

# --- Feuerring hinter dem Schlagzeug: Ebene #109 (i112), 2× -------------------------------------------------
ring = up(compose(B, [112]), 2)
cv.paste(ring, 128 - ring.shape[1] // 2, 176 - ring.shape[0] // 2)

# --- Band ------------------------------------------------------------------------------------------------
put([106], 'drums', 125, 252, 3)
put([105], 'guitar', 46, 308, 3)
put([103], 'keys', 206, 306, 3)
put([104], 'singer', 126, 332, 3)

# --- Pyro-Flammen an der Bühnenkante: Flammenreihen Ebene #33 (i205) / #36 (i194), einzeln 3× ---------------
fl = parts(compose(B, [194]), dil=1) + parts(compose(B, [205]), dil=1)
fl = [f for f in fl if f.shape[0] >= 8]
xs = [14, 50, 86, 164, 200, 236]
for i, x in enumerate(xs):
    f = up(fl[i % len(fl)], 3)
    cv.paste(f, x - f.shape[1] // 2, 346 - f.shape[0])

vignette(cv, 0.4, 0.62)
save(cv, '47_coolhalla_rocks.png')
