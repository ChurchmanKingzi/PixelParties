# -*- coding: utf-8 -*-
"""09 First Snowfall – Winternacht: Ein großer Schneemann mit Zylinder und rotem Schal steht im Vordergrund auf
einer Schneewehe; hinter ihm zieht eine Eisläuferin ihre Bahn über den zugefrorenen Teich, am anderen Ufer stehen
verschneite kahle Bäume. Dichter Schneefall – die Flocken jeder Tiefenebene in deren eigener Pixelgröße.

Quellen:
  Motive 800 „Snowman“ (Karte „Slippery Snowman“), 6×
  Motive 797 „Sichtbar #36“ (Eisläuferin der Karte „Slippery Skates“ – trotz des Namens ein einzelnes Sprite), 2×
  MotiveRussia 90 „Ebene #106“ und 137 „Ebene #94“ (verschneite kahle Bäume), 2×
Selbst gezeichnet: Nachthimmel, Hügel, Teich (Eis, Glanz, Kufenspuren), Schneewehe, Schatten, Schneeflocken.

Skalierung:
  Hintergrund (Himmel, Mond, Hügel, Bäume, Teich, Eisläuferin + Spur, ferne Flocken): 2× (Raster 125×175)
  Mittelgrund (mittlere Schneeflocken): 3× (Raster 84×117, beschnitten)
  Vordergrund (Schneemann, Schneewehe, Schatten, nahe Flocken): 6× (Raster 42×59, beschnitten)
"""
from common import *  # noqa
import numpy as np, math

M, R = 'Motive', 'MotiveRussia'
BW, BH = 125, 175
yy, xx = np.mgrid[0:BH, 0:BW]
th = BAYER4[yy % 4, xx % 4]

# ---------------- Hintergrund 2× ----------------
bg = Canvas(BW, BH)
sky = [(8, 12, 32), (14, 22, 52), (22, 34, 72), (34, 50, 96)]
t = np.clip((yy - 5) / 80, 0, 1) * (len(sky) - 1)
q = np.floor(t + th * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
# Mondsichel mit Hof (oben links)
MX, MY, MR = 30, 30, 9
dd = np.sqrt((xx + 0.5 - MX) ** 2 + (yy + 0.5 - MY) ** 2)
for r, col in [(26, (22, 34, 76)), (19, (30, 46, 94)), (13, (42, 62, 118))]:
    g = np.clip(1 - (dd - r * 0.55) / (r * 0.45), 0, 1)
    bg.a[g > th] = col
dd2 = np.sqrt((xx + 0.5 - MX - 4) ** 2 + (yy + 0.5 - MY + 3) ** 2)
cres = (dd < MR) & (dd2 >= MR - 1)
bg.a[cres] = (236, 236, 214)
bg.a[cres & (dd >= MR - 1.2)] = (206, 206, 190)
# ferne Hügel (zwei Schichten, verschneit)
for base, amp, fr, ph, col, cap in [(76, 5, 0.07, 1.0, (58, 70, 116), (96, 110, 156)),
                                     (84, 4, 0.05, 3.0, (84, 98, 146), (132, 146, 192))]:
    for x in range(BW):
        h = int(base - amp * (0.6 * math.sin(x * fr + ph) + 0.4 * math.sin(x * fr * 2.7 + ph)))
        bg.a[h:, x] = col
        bg.a[h, x] = cap
# Ufer (Schnee) hinter dem Teich
SHORE = 92
bg.a[SHORE:] = (150, 164, 206)
for x in range(BW):
    bg.a[SHORE, x] = (196, 206, 236)
# Teich: Ellipse, Eis mit Glanzstreifen
PX, PY, PRX, PRY = 60, 124, 80, 27
e = ((xx + 0.5 - PX) / PRX) ** 2 + ((yy + 0.5 - PY) / PRY) ** 2
ice = e < 1
bg.a[ice] = (70, 96, 150)
bg.a[ice & (e > 0.82)] = (96, 124, 176)                           # heller Rand
band = ice & ((xx - yy * 1.6) % 46 < 2) & (e < 0.55)                # schräge Glanzstreifen
bg.a[band] = (100, 128, 180)
# Uferlinie dunkel
edge = ice & ~np.roll(ice, 1, 0)
bg.a[edge] = (48, 62, 108)
# Bäume am Ufer (Russia), 2×-Raster = Originalgröße
t1 = sprite('b09_tree1', R, [90]); t2 = sprite('b09_tree2', R, [137])
t1 = tint(t1, (40, 50, 110), 0.25); t2 = tint(t2, (40, 50, 110), 0.25)
for spr, x in [(t1, 4), (flip(t2), 22), (t2, 96), (flip(t1), 108)]:
    bg.paste(spr, x, SHORE + 2 - spr.shape[0])
# Eisläuferin weit hinten am linken Teichrand (2×-Raster = Originalgröße) mit Kufenspur und Schatten
sk = sprite('b09_skater', M, [797])                               # 13×23
SKX, SKY = 17, 84                                                 # Kufen bei y = SKY + 22
fx, fy = SKX + 7, SKY + 22
for k in range(220):
    s_ = k / 219
    x = fx + 3 + s_ * 52
    y = fy + 11 * math.sin(s_ * math.pi * 0.85)
    X, Y = int(round(x)), int(round(y))
    if 0 <= X < BW and 0 <= Y < BH and ice[Y, X]:
        bg.a[Y, X] = (206, 222, 248)
for i in range(-1, 10):
    X, Y = SKX + 2 + i, SKY + 23
    if 0 <= X < BW and ice[Y, X]: bg.a[Y, X] = (48, 64, 110)
bg.paste(sk, SKX, SKY)
# ferne Flocken (1 Rasterpixel)
rng = np.random.RandomState(9)
for _ in range(90):
    x, y = rng.randint(0, BW), rng.randint(0, BH)
    if math.hypot(x - MX, y - MY) < MR + 2: continue
    bg.px(x, y, (190, 200, 230) if rng.rand() < 0.6 else (150, 160, 200))
vignette(bg, 0.45, 0.55)

cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)

# ---------------- Mittelgrund 3×: nur Schneeflocken ----------------
MW, MH = 84, 117
mid = np.zeros((MH, MW, 4), np.uint8)
# mittlere Flocken
for _ in range(26):
    x, y = rng.randint(0, MW), rng.randint(0, MH)
    if mid[y, x, 3] == 0: mid[y, x] = (214, 222, 244, 255)
cv.paste(up(mid, 3)[:350, :250], 0, 0)

# ---------------- Vordergrund 6×: Schneewehe + Schneemann ----------------
FW, FH = 42, 59
fg = np.zeros((FH, FW, 4), np.uint8)
# Schneewehe: Oberkante als Kurve (links tiefer, rechts höher)
for x in range(FW):
    top = 54 - 2.6 * math.sin((x + 4) / FW * math.pi) - 0.06 * x
    for y in range(int(round(top)), FH):
        d = y - top
        c = (228, 234, 250) if d < 1 else ((196, 206, 238) if d < 3 else (164, 176, 220))
        fg[y, x] = (*c, 255)
snow = sprite('b09_snowman', M, [800])                            # 13×32
SX = 23
top_at = int(round(54 - 2.6 * math.sin((SX + 6 + 4) / FW * math.pi) - 0.06 * (SX + 6)))
SY = top_at + 2 - snow.shape[0]
# Schatten (nach links, Mondlicht von rechts)
for i in range(-5, 9):
    X, Y = SX + i, SY + snow.shape[0] - 1
    if 0 <= X < FW and 0 <= Y < FH and fg[Y, X, 3]:
        fg[Y, X, :3] = (132, 142, 196)
for j in range(snow.shape[0]):
    for i in range(snow.shape[1]):
        if snow[j, i, 3] >= 128: fg[SY + j, SX + i] = snow[j, i]
# Glitzer in der Schneewehe
for x, y in [(3, 57), (11, 56), (17, 58), (36, 57)]:
    if fg[y, x, 3]: fg[y, x, :3] = (244, 248, 255)
# nahe Flocken (1 Rasterpixel = 6 px)
for x, y in [(4, 8), (13, 20), (35, 6), (8, 33), (39, 27), (19, 4), (30, 40), (2, 44)]:
    if fg[y, x, 3] == 0: fg[y, x] = (236, 240, 252, 255)
cv.paste(up(fg, 6)[2:352, 1:251], 0, 0)

print(save(cv, '09_first_snowfall.png'))
