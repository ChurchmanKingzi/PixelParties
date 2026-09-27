# -*- coding: utf-8 -*-
"""43 Threads of Fate – die drei verhüllten Nornen stehen nachts auf dem Eisplateau nebeneinander: die linke
spinnt aus ihrem Faserbausch den goldenen Schicksalsfaden, er hängt locker durch zur mittleren, die ihn zwischen
ihren Händen gespannt hält (misst), und weiter zur rechten, in deren Hand er endet – ein abgeschnittenes Stück
hängt herab. Vorn und tiefer, ohne eine Norne zu verdecken, leuchtet die Kristallkugel; am Himmel mit Milchstraße
steht das Sternbild der Weltenschlange.

Quellen (MotiveCoolhalla.xcf):
  Ebene 167 „Ebene #52“ – linke Norne mit Faserbausch in den Händen (Karte „The Nornstellar Foretellers of Coolness“)  3×
  Ebene 171 „Ebene #44“ – mittlere (frontal) und rechte Norne, per parts() getrennt (pixelgleich mit „Sichtbar #16“);
                          ergänzt: je 1 schwarzes Handpixel an den Ärmelenden (Farbe der Hände der linken Norne)       3×
  Ebene 165 „Ebene #93“ – Kristallkugel auf goldenem Fuß (Karte „Prophecy of Coolness“)                            3×
  Ebene 256/255 „Ebene #2/#3“ – Eisboden mit Schrägstreifen, nächtlich umgefärbt                                     2×
Himmel mit Milchstraße, Sterne, Sternbild, ferne Schneehügel, Lichtteich und der Schicksalsfaden (1 Pixel im 3×-Raster,
hell/dunkel Pixel für Pixel abwechselnd, durchhängende Parabeln) selbst gezeichnet. Kein Schneidwerkzeug in den
Coolhalla-Ebenen vorhanden – das Schneiden zeigt das abgeschnittene, herabhängende Fadenende.
Skalierung: Himmel/Hügel/Eisboden/Sternbild 2×, Nornen + Faden + Kugel 3×.
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
HOR = 96                                            # Horizont im 2×-Raster (y=224 im 250er-Bild)
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
# Lichtteich der Kugel auf dem Eis (stufig, ohne Dither); Kugelmitte x = 3·46/2
LPX = 69
for (rx, ry, f) in ((42, 11, 1.14), (29, 7, 1.14), (17, 4, 1.12)):
    m = bg.ellipse_mask(LPX, 158, rx, ry) & (yy >= HOR)
    bg.a[m, :3] = np.clip(bg.a[m, :3] * np.array([f, f, f * 1.08]) + np.array([6, 4, 14]), 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- Nornen, Faden, Kugel (3×)
fg = G(3)
W3, H3 = fg.w, fg.h
BLACK, GLOVE = (0, 0, 0, 255), (32, 32, 32, 255)
# Mittlere Norne: die über der Brust verschränkten Ärmel enden in zwei schwarzen Händen links/rechts
# (je 1 Pixel breit ergänzt, Farben aus der Handpartie der linken Norne) – sie hält den Faden gespannt: misst.
midh = np.zeros((mid.shape[0], mid.shape[1] + 2, 4), np.uint8); midh[:, 1:-1] = mid
for y in (15, 16):
    midh[y, 0] = BLACK; midh[y, -1] = BLACK
# Rechte Norne (blickt nach links): Ärmelende in Zeile 14/15 bekommt eine schwarze Hand – dort endet der Faden.
righth = np.zeros((right.shape[0], right.shape[1] + 1, 4), np.uint8); righth[:, 1:] = right
for y in (14, 15):
    righth[y, 0] = BLACK
FL = 78                                                # Fußlinie (y=234)
LX = 9                                                 # linke Norne: Körper x 9–23, Faserbausch bis x 28
RX = 63                                                # rechte Norne: Hand bei x 63
lx, ly = LX + 19, FL - 25 + 12                         # Faserbausch der linken Norne (Zeile 12, Spalte 19)
rx, ry = RX, FL - 25 + 14                              # Hand der rechten Norne
MC = (lx + rx) // 2                                    # mittlere Norne genau zwischen beiden Fadenenden
mx0 = MC - midh.shape[1] // 2
m1x, m2x, my = mx0, mx0 + midh.shape[1] - 1, FL - 25 + 15
fg.paste(midh, mx0, FL - 25)
fg.paste(left, LX, FL - 25)
fg.paste(righth, RX, FL - 25)
shadow = grid_mask(3)
for cx in (LX + 7, MC, RX + 8):
    shadow |= G(3).ellipse_mask(cx, FL, 7.5, 1.3)


def sag(x0, y0, x1, y1, depth, n=80):
    """Durchhängender Faden zwischen zwei Punkten (Parabel), als Punktliste."""
    return [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + depth * 4 * t * (1 - t)) for t in np.linspace(0, 1, n)]


LIGHT, DARK = (255, 214, 90), (176, 116, 30)


def thread(pts):
    """Kurve pixelweise rastern (ohne Doppelpixel, 8-zusammenhängend), Pixel für Pixel hell/dunkel."""
    cells = []
    for (x, y) in pts:
        c = (int(round(x)), int(round(y)))
        if not cells or c != cells[-1]:
            if cells and abs(c[0] - cells[-1][0]) <= 1 and abs(c[1] - cells[-1][1]) <= 1 and len(cells) > 1 \
                    and abs(c[0] - cells[-2][0]) <= 1 and abs(c[1] - cells[-2][1]) <= 1:
                cells[-1] = c                              # Ecke abkürzen (keine L-Treppen)
            else:
                cells.append(c)
    for i, (x, y) in enumerate(cells):
        fg.px(x, y, LIGHT if i % 2 == 0 else DARK)


line = sag(lx, ly, m1x - 1, my, 4, 400) + [(x, my) for x in np.linspace(m1x - 1, m2x + 1, 200)] + \
    sag(m2x + 1, my, rx - 1, ry, 4, 400)
thread(line)                                                        # spinnen → messen → schneiden
# abgeschnittenes Ende: ein kurzes Stück hängt unter der Hand der rechten Norne herab
thread([(rx - 1, ry + 1 + t) for t in np.linspace(0, 4, 20)])
# Kristallkugel vorn und tiefer, verdeckt keine Norne
BX, BB = MC, 108
glow_ball = hsv_shift(ball, 0, 1.0, 1.35)
fg.pb(outline(glow_ball, (14, 10, 30)), BX + 1, BB + 1)
bx0, by0 = BX + 1 - (ball.shape[1] + 2) // 2, BB + 1 - (ball.shape[0] + 2)
for (x, y) in ((6, 4), (5, 5), (5, 6), (7, 3)):
    fg.px(bx0 + x, by0 + y, (236, 236, 255))
shadow |= G(3).ellipse_mask(BX + 0.5, BB, 11, 1.2)
shadow &= ~fg.mask()

cv = flatten([bg, fg])
shade_final(cv, shadow, 3, 0.6)
print(save(cv, '43_threads_of_fate.png'))
