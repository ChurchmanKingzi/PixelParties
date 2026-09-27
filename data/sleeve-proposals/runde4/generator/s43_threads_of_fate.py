# -*- coding: utf-8 -*-
"""43 Threads of Fate – die drei verhüllten Nornen stehen nachts auf dem Eisplateau über Coolhalla um die
leuchtende Kristallkugel; die linke Norne spinnt den goldenen Schicksalsfaden über die Kugel hinweg zur rechten.

Quellen (MotiveCoolhalla.xcf):
  Ebene 167 „Ebene #52“ – linke Norne mit Faden in den Händen (Karte „The Nornstellar Foretellers of Coolness“)  4×
  Ebene 171 „Ebene #44“ – mittlere (frontal) und rechte Norne, per parts() getrennt (gleiche Karte)            4×
  Ebene 165 „Ebene #93“ – Kristallkugel auf goldenem Fuß (Karte „Prophecy of Coolness“)                      4×
  Ebene 256/255 „Ebene #2/#3“ – Eisboden mit Schrägstreifen, nächtlich umgefärbt                               2×
Himmel mit Milchstraße, Sterne, ferne Schneehügel, Lichtteich, Schicksalsfaden (1 Zelle, Gold hell/dunkel im Wechsel) selbst gezeichnet.
Skalierung: Himmel/Hügel/Eisboden 2×, Nornen + Kugel + Faden 4×.
"""
import math
import numpy as np
from kit41_45 import *  # noqa

C = 'MotiveCoolhalla'
left = sprite('i43_norn_left', C, [167])
mid, right = parts(sprite('i43_norns_mr', C, [171]), dil=0)
ball = sprite('i43_ball', C, [165])
ice = compose(C, [255, 256], crop=False)

# ---------------------------------------------------------------- Hintergrund (2×)
bg = G(2)
W2, H2 = bg.w, bg.h
HOR = 112                                            # Horizont im 2×-Raster (y=224 im 250er-Bild)
yy, xx = np.mgrid[0:H2, 0:W2]
bg.vgrad([(0, (8, 10, 30)), (0.5, (14, 22, 56)), (0.85, (26, 44, 86)), (1, (44, 72, 112))], 0, HOR)
# Milchstraße: schräges Band, zwei gedämpfte Stufen
d = np.abs((xx - 10) * 0.62 - (yy - 8) * 1.0) / 1.2
band = (yy < HOR - 8)
bg.dfill(band & (d < 16), (26, 36, 78), np.clip(1 - d / 16, 0, 1) * 1.4)
bg.dfill(band & (d < 7), (40, 52, 104), np.clip(1 - d / 7, 0, 1) * 1.2)
rng = np.random.default_rng(43)
for n in range(150):
    x, y = rng.integers(0, W2), rng.integers(0, HOR - 14)
    if n > 60 and abs((x - 10) * 0.62 - (y - 8)) / 1.2 > 12: continue      # Sterne im Band dichter
    bg.px(x, y, (200, 214, 255) if n % 6 else (255, 236, 170))
for (x, y) in [(20, 12), (100, 20), (44, 44), (86, 7), (110, 58), (12, 64), (70, 30)]:
    for dd in (-1, 1):
        bg.px(x + dd, y, (130, 150, 215)); bg.px(x, y + dd, (130, 150, 215))
    bg.px(x, y, (255, 255, 255))
# Sternbild der Weltenschlange über den Nornen (feine Linien zwischen Sternen, selbst gezeichnet)
SERP = [(30, 72), (22, 60), (28, 47), (44, 42), (58, 50), (70, 60), (86, 58), (96, 46), (92, 32), (80, 26)]
for (a, b), (c, d2) in zip(SERP[:-1], SERP[1:]):
    bg.line(a, b, c, d2, (70, 84, 140))
for i, (x, y) in enumerate(SERP):
    big = i == len(SERP) - 1
    col = (255, 226, 150) if big else (220, 230, 255)
    bg.px(x, y, col)
    for dd in (-1, 1):
        bg.px(x + dd, y, (120, 140, 210)); bg.px(x, y + dd, (120, 140, 210))
    if big:
        for dd in (-2, 2):
            bg.px(x + dd, y, (90, 100, 170)); bg.px(x, y + dd, (90, 100, 170))
# ferne Schneehügel (zwei Staffeln, selbst gezeichnet)
for (base, amp, f, ph, col) in ((HOR - 6, 7, 0.07, 1.0, (30, 46, 84)), (HOR - 1, 5, 0.11, 3.0, (40, 62, 104))):
    top = base - amp * (0.5 + 0.5 * np.sin(xx[0] * f + ph)) - 2 * np.sin(xx[0] * 0.31 + ph)
    for x in range(W2):
        t = int(top[x]); bg.rect(x, t, x + 1, HOR, col); bg.px(x, t, tuple(min(255, c + 22) for c in col))
# Eisboden: Ebenen 256+255 der Burg-Szene, nachtblau umgefärbt
floor = ice[190:257, 0:451]
fl = recol(floor, lambda c: c * np.array([0.40, 0.52, 0.74]))
for y in range(HOR, H2):
    row = fl[min(fl.shape[0] - 1, 12 + (y - HOR) % (fl.shape[0] - 12))]
    for x in range(W2):
        p = row[(x + 40) % fl.shape[1]]
        bg.a[y, x] = (p[0], p[1], p[2], 255) if p[3] > 0 else (56, 84, 124, 255)
bg.rect(0, HOR, W2, HOR + 1, (100, 132, 176))
# Lichtteich der Kugel auf dem Eis (stufig, ohne Dither)
for (rx, ry, f) in ((42, 11, 1.14), (29, 7, 1.14), (17, 4, 1.12)):
    m = bg.ellipse_mask(62.5, 160, rx, ry) & (yy >= HOR)
    bg.a[m, :3] = np.clip(bg.a[m, :3] * np.array([f, f, f * 1.08]) + np.array([6, 4, 14]), 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- Nornen, Faden, Kugel (4×)
fg = G(4)
FL = 66                                                # Fußlinie der äußeren Nornen (y=264)
fg.pb(mid, 32, FL - 2)                                  # mittlere Norne einen Schritt weiter hinten
LX = 6
fg.pb(left, LX + left.shape[1] // 2, FL)
RX = 63 - 6 - right.shape[1]
fg.paste(right, RX, FL - right.shape[0])
shadow = grid_mask(4)
for (cx, cy, w) in ((LX + 7, FL, 6.5), (RX + 7, FL, 6.5), (32, FL - 2, 6)):
    shadow |= G(4).ellipse_mask(cx, cy, w, 1.4)
# Faden: von den Händen der linken Norne (wie auf der Karte) über die Brust der mittleren zur Hand der rechten
lx, ly = LX + left.shape[1] - 1, FL - 11
rx, ry = RX + 1, FL - 11
pts = []
for i in range(61):
    t = i / 60
    pts.append((lx + (rx - lx) * t, ly - 2.4 * math.sin(math.pi * t) ** 0.6))
fg.poly(pts, (255, 214, 90), alt=(200, 140, 40))
# Kugel vorn auf dem Eis, heller (sie leuchtet) + Glanzlicht auf dem Glas
BB = 81
glow_ball = hsv_shift(ball, 0, 1.0, 1.35)
fg.pb(outline(glow_ball, (14, 10, 30)), 32, BB + 1)
bx0, by0 = 32 - (ball.shape[1] + 2) // 2, BB + 1 - (ball.shape[0] + 2)
for (x, y) in ((6, 4), (5, 5), (5, 6), (7, 3)):
    fg.px(bx0 + x, by0 + y, (236, 236, 255))
shadow |= G(4).ellipse_mask(32, BB, 11, 1.2)
shadow &= ~fg.mask()

cv = flatten([bg, fg])
shade_final(cv, shadow, 4, 0.6)
print(save(cv, '43_threads_of_fate.png'))
