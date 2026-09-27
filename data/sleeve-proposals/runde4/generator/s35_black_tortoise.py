# -*- coding: utf-8 -*-
"""Sleeve 35 – „Black Tortoise“: Xuanwu, die Schildkröte des Nordens, watet nachts durch einen spiegelglatten
Bergsee. Hinter ihr stehen verschneite Gipfel unter dem Sternenhimmel; der See spiegelt Schildkröte, Berge und
Sterne – nur ein paar Wellenlinien brechen das Spiegelbild. Die Wasserlinie liegt in der Bildmitte, das Bild ist
um sie herum gespiegelt.

Skalierung: EINE Ebene, alles im 84×117-Raster gebaut und einmal 3× hochskaliert (Schildkröte, Spiegelbild,
Berge, Sterne, Wellenlinien, Himmelsverlauf).

Quellen (MotiveRussia.xcf, Karte „Cardinal Beast Xuanwu“, Szene 1 „Sichtbar #42“):
  Xuanwu = Ebene 5 „Xuanwu #1“ (Panzer, Beine, gehörnter Kopf, Schlange am Hals – vollständig; der weiße
           Wischer „Xuanwumon“ (Ebene 2) und der Bogen (Ebene 4) sind Angriffs-Effekte der Karte und entfallen)
  Himmel, Sterne, Berge, Wasser, Wellen, Spiegelung: selbst gezeichnet (Farben aus dem Eismeer der Karte,
  Ebene 221 „Ebene #6“)
"""
from common import *
import numpy as np

RU = 'MotiveRussia'
W, H = 84, 117
cv = Canvas(W, H)
yy, xx = np.mgrid[0:H, 0:W]
TH = BAYER4[yy % 4, xx % 4]
rng = np.random.RandomState(35)

WL = 60                                          # Wasserlinie (Füße der Schildkröte)

# ---------- Himmel (oberhalb WL) ----------
cols = [(6, 8, 26), (10, 16, 42), (18, 28, 64), (32, 46, 90)]
t = np.clip(yy / (WL - 6), 0, 1) * (len(cols) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(cols) - 1).astype(int)
sky = np.zeros((H, W, 3), np.uint8)
for k, c in enumerate(cols):
    sky[q == k] = c
stars = [(rng.randint(2, W - 2), rng.randint(2, 30)) for _ in range(26)]
for x, y in stars:
    sky[y, x] = (210, 216, 250) if rng.rand() < 0.7 else (150, 164, 220)

# ---------- Mond (links oben) mit Hof ----------
MX_, MY_, MR = 19, 13, 6.5
dm = np.hypot(xx + .5 - MX_, yy + .5 - MY_)
halo = (np.clip(1 - (dm - MR) / 12, 0, 1) * 0.5 > TH) & (dm >= MR) & (yy < WL)
sky[halo] = (sky[halo] * 0.6 + np.array([90, 100, 150]) * 0.4).astype(np.uint8)
sky[dm < MR] = (236, 236, 214)
sky[(dm < MR) & (xx + .5 - MX_ + (yy + .5 - MY_) * 0.3 > 2.5)] = (206, 208, 196)   # Schattenseite
for cx_, cy_ in [(17, 11), (21, 15), (16, 16)]:                                      # Krater
    sky[cy_, cx_] = (200, 200, 186)

# ---------- Berge: zwei Ketten, verschneite Gipfel, Licht von links ----------
def mountains(peaks, lit, shade, snow_l, snow_s):
    """peaks: (x, y, halbe Breite). Jeder Berg: linke Flanke hell, rechte dunkel, Schneekappe mit Zacken."""
    for px, py, w in sorted(peaks, key=lambda p: -p[1]):
        slope = (WL - py) / w
        cap = 8 + (w % 3)
        for x in range(W):
            top = py + abs(x + .5 - px) * slope
            if top >= WL: continue
            for y in range(int(np.ceil(top)), WL):
                left = x + .5 < px
                capline = py + cap + (2 if (x // 2) % 2 else 0) - (1 if (x // 3) % 3 == 0 else 0)
                if y < capline:
                    sky[y, x] = snow_l if left else snow_s
                else:
                    sky[y, x] = lit if left else shade
far = [(14, 22, 22), (44, 16, 24), (74, 22, 20)]
near = [(-2, 36, 16), (28, 34, 18), (60, 33, 18), (88, 37, 14)]
mountains(far, (54, 64, 112), (40, 48, 90), (170, 180, 226), (128, 138, 192))
mountains(near, (36, 44, 84), (24, 30, 62), (140, 150, 204), (100, 110, 166))
sky[WL - 1] = (26, 32, 62)
cv.a[:WL] = sky[:WL]

# ---------- Schildkröte ----------
tor = sprite('g35_xuanwu', RU, [5])
th_, tw = tor.shape[:2]
TX, TY = W // 2 - tw // 2 + 1, WL - th_
fig = np.zeros((H, W, 4), np.uint8)
fig[TY:TY + th_, TX:TX + tw] = tor

# ---------- Wasser: Spiegelbild des oberen Teils ----------
above = cv.a[:WL].copy()
m = fig[:WL, :, 3] > 0
above[m] = fig[:WL][m][:, :3]
water_base = np.array([12, 20, 48])
for j in range(H - WL):
    src_y = WL - 1 - j
    shift = 0
    if j % 5 == 3: shift = 1
    if j % 7 == 5: shift = -1
    if src_y >= 0:
        row = np.roll(above[src_y], shift, axis=0).astype(float)
    else:
        row = np.tile(np.array(cols[0], float), (W, 1))
    f = 0.62 - 0.22 * min(1, j / 50)
    cv.a[WL + j] = (row * f + water_base * (1 - f)).astype(np.uint8)
# Wellenlinien (helle, kurze Striche, nach vorn länger)
for j, n in [(4, 3), (9, 3), (15, 4), (22, 4), (30, 5), (40, 5), (52, 6)]:
    L = 3 + j // 8
    for _ in range(n):
        x0 = rng.randint(2, W - L - 2)
        y = WL + j
        if y < H:
            cv.a[y, x0:x0 + L] = np.maximum(cv.a[y, x0:x0 + L], (70, 86, 140))
# Mondglitzern: helle Striche in einer Säule unter dem Mond
for j in range(2, H - WL, 3):
    L = 2 + (j * 7) % 4
    x0 = MX_ - L // 2 + ((j * 5) % 3) - 1
    cv.a[WL + j, max(0, x0):x0 + L] = (190, 196, 200) if j < 30 else (140, 150, 180)
# Uferlinie / Wasserlinie an den Beinen
cv.a[WL, :] = np.maximum(cv.a[WL, :], (40, 52, 96))

# Schildkröte über das Spiegelbild
cv.paste(fig[:WL], 0, 0)
# Wasserring an jedem Bein (helle Linie direkt an der Wasserlinie)
legs = np.where(fig[WL - 1, :, 3] > 0)[0]
for x in legs:
    for dx in (-1, 0, 1):
        if 0 <= x + dx < W:
            cv.a[WL, x + dx] = (120, 140, 196)

out = Canvas(250, 350)
out.a[:] = up(np.dstack([cv.a, np.full((H, W), 255, np.uint8)]), 3)[:350, 1:251, :3]
print(save(out, '35_black_tortoise.png'))
