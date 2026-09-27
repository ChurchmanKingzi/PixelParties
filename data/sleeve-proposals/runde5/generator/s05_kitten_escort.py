# -*- coding: utf-8 -*-
"""05 Kitten Escort – Held: Cute Annoyance Mini (Base-Version).
Mini schwebt mit grauen Federflügeln und frechem Grinsen groß vor einem großen, weichen Herz in ihrem Kartenlila
über einem Wolkenmeer im Abendhimmel; ihre zwei geflügelten Cute Cats (die Katzen ihrer Base-Karte, Summoning Magic)
eskortieren sie diagonal versetzt – links oben und rechts unten –, kleine rosa Herzchen (Charme) füllen die Gegenecken.

Quellen (MotiveMoe.xcf):
  Ebene 497 „Mini #2“ + 498 „Mini“ (Flügelpaar) – Base-Mini, pixelgenau identisch mit Sichtbar #124
      (Ebene 101, Kartenausschnitt Lage 100,259 der Karte „Cute Annoyance Mini“; 0 abweichende Pixel).
      Nicht verwendet: 495 (Schatten, nicht in der Kartenszene), 326 „Trial of Annoyance“ (Variante).
  Ebene 494 „Mini #5“ – die zwei Flügelkatzen der Mini-Karte (je 23×14; per Vorlagenvergleich in Sichtbar #124
      gefunden, Abweichungen nur dort, wo der Kartenausschnitt sie abschneidet).
  Ebene 499 „Mini #1“ – das kleine Herzchen (5×4) aus Minis Kartenszene, rosa umgefärbt.
Selbst gezeichnet: Himmel, Sterne, Wolkenschlieren, großes Herz mit Schein und Glanzlicht (nach dem Kartenherz),
Wolkenmeer, Vordergrundwolken.

Skalierung (Tiefenebenen, Ausgabe = 250×350-Raster × 3):
  Himmel, Sterne, Schlieren                          – 1× (250×350)
  großes Herz, Herzchen, Wolkenmeer                  – 2× (125×175)
  Mini, beide Cute Cats, Vordergrundwolken           – 4× (63×88)
"""
import math, random
from common import *  # noqa
import numpy as np

B = 'MotiveMoe'
rnd = random.Random(5)

mini = sprite('h05_mini', B, [497, 498])          # 34×25, Base-Mini (Sichtbar #124, Lage 100,259)
cat_l, cat_r = parts(compose(B, [494]), dil=1)[1:]   # die zwei Flügelkatzen der Mini-Karte, je 23×14
heart = [p for p in parts(compose(B, [499]), dil=1) if p.shape[0] < 10][0]   # 5×4 Herzchen


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y):
    h, w = s.shape[:2]
    for j in range(h):
        yy = y + j
        if not 0 <= yy < dst.shape[0]: continue
        for i in range(w):
            xx = x + i
            if 0 <= xx < dst.shape[1] and s[j, i, 3] > 0:
                dst[yy, xx] = s[j, i]


def blit(cv, layer_, k, ox=0, oy=0):
    cv.paste(up(layer_, k), ox, oy)


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def bayer(x, y):
    return BAYER4[y % 4, x % 4]


def cumulus(arr, puffs, tones, base=None, light=(-0.55, -0.83)):
    """Haufenwolke aus Kreisen (cx, cy, r) im Raster von arr; tones hell→dunkel.
    Schattierung je Pixel nach Kugelnormalen (Licht von links oben), geordnet gedithert;
    unterhalb von `base` flach abgeschnitten."""
    H, W = arr.shape[:2]
    n = len(tones) - 1
    for y in range(H):
        for x in range(W):
            best = None
            for (cx, cy, r) in puffs:
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d2 = dx * dx + dy * dy
                if d2 <= r * r:
                    nz = math.sqrt(max(0.0, 1 - d2 / (r * r)))
                    lam = (dx / r) * light[0] + (dy / r) * light[1] + nz * 0.55
                    best = lam if best is None else max(best, lam)
            if best is None: continue
            if base is not None and y >= base: best = min(best, -0.2)
            t = min(1, max(0, (0.95 - best) / 1.25)) * n
            i = int(t); f = t - i
            k = min(n, i + (1 if f > bayer(x, y) else 0))
            arr[y, x] = list(tones[k]) + [255]




# ---------------- Ebene 1: Himmel (1×) -----------------------------------------------------
cv = Canvas(250, 350)
SKY = [(52, 32, 100), (74, 48, 138), (104, 72, 174), (140, 104, 202), (178, 140, 222), (214, 176, 232), (240, 206, 238)]
for y in range(350):
    t = min(1, y / 260) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(250):
        cv.a[y, x] = SKY[i + 1] if f > bayer(x, y) else SKY[i]
for (x, y, big) in [(30, 34, 1), (58, 52, 0), (216, 30, 1), (196, 58, 0), (232, 84, 0), (150, 34, 0), (100, 26, 0), (18, 110, 0)]:
    cv.px(x, y, (250, 236, 255))
    if big:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(x + dx, y + dy, (200, 170, 236))
for (cx, cy, L) in [(46, 88, 40), (214, 112, 36), (30, 170, 28), (226, 196, 30)]:
    for x in range(cx - L // 2, cx + L // 2):
        t = abs(x - cx) / (L / 2)
        col = mix(cv.a[cy, max(0, min(249, x))], (236, 208, 244), 0.5)
        cv.px(x, cy, col)
        if t < 0.55: cv.px(x, cy - 1, col)

# ---------------- Ebene 2: Herz-Glanz / ferne Hydra + Wolkenmeer (2×) -----------------------
W2, H2 = 125, 175
p2 = rgba(W2, H2)
MCX, MCY = 62.5, 89          # Minis Mitte im 2×-Raster (125 px, 178 px)
if True:
    # großes, weiches Herz in Minis Kartenlila (selbst gezeichnet), Licht von links oben
    HT = [(150, 108, 236), (128, 84, 226), (108, 62, 214), (92, 48, 198), (78, 38, 180)]
    GL = (204, 170, 240)
    S_ = 46.0
    def hf(x, y):
        u, v = (x + 0.5 - MCX) / S_, -(y + 0.5 - (MCY - 6)) / S_
        return (u * u + v * v - 1) ** 3 - u * u * v ** 3
    for y in range(H2):
        for x in range(W2):
            f = hf(x, y)
            if f <= 0:
                # Tiefe ins Herz: Abstand zum Rand grob über f
                depth = min(1.0, (-f) ** 0.33 * 1.6)
                u, v = (x - MCX) / S_, (y - MCY) / S_
                lam = 0.55 * depth - 0.45 * u - 0.35 * v   # hell links oben, dunkel rechts unten
                t = min(1, max(0, (0.9 - lam) / 1.3)) * (len(HT) - 1)
                i = int(t); k = min(len(HT) - 1, i + (1 if t - i > bayer(x, y) else 0))
                p2[y, x] = list(HT[k]) + [255]
            else:
                # weicher Schein um das Herz (gedithert, 2 Stufen)
                g = max(0.0, 1 - f ** 0.33 / 0.3)
                if g > bayer(x, y):
                    p2[y, x] = list(mix(cv.a[min(349, y * 2), min(249, x * 2)], GL, 0.4)) + [255]
    # Glanzlicht links oben (wie auf der Karte)
    for (x, y) in [(35, 62), (36, 61), (37, 60), (38, 60), (39, 59), (34, 64), (34, 65), (33, 67)]:
        p2[y, x] = [196, 168, 248, 255]
# Wolkenmeer (2×): ferne Reihen, nach vorn größer
CLF = [(226, 200, 244), (208, 178, 234), (190, 156, 224), (172, 138, 214), (156, 120, 204)]
for y in range(128, H2):
    for x in range(W2): p2[y, x] = list(CLF[4]) + [255]
for row, (cy, r) in enumerate([(128, 6), (140, 8), (156, 10)]):
    puffs, x = [], -r + row * 4
    while x < W2 + r:
        rr = r + rnd.choice((-2, -1, 0, 1))
        puffs.append((x, cy + rnd.choice((-1, 0, 1)), rr)); x += rr + rnd.randint(3, 6)
    cumulus(p2, puffs, CLF, base=cy + 2)
# kleine Herzchen wie auf Minis Karte, in den freien Gegenecken der Diagonale (rechts oben, links unten)
pink = heart.copy()
for j in range(pink.shape[0]):
    for i in range(pink.shape[1]):
        if pink[j, i, 3]:
            v = pink[j, i, :3].astype(int)
            pink[j, i, :3] = (250, 156, 222) if v[2] > 215 else (234, 108, 200) if v[1] > 40 else (180, 64, 160)
for (x, y) in [(99, 17), (108, 24), (13, 104), (21, 112)]:
    put(p2, pink, x, y)
blit(cv, p2, 2)

# ---------------- Ebene 3: Mini + ihre zwei Flügelkatzen + Vordergrundwolken (4×) -----------
W4, H4 = 63, 88
p4 = rgba(W4, H4)
CL4 = [(252, 244, 254), (240, 222, 250), (222, 198, 242), (200, 170, 230), (178, 144, 218)]
# ruhige Vordergrundwolken: links höher (Gegengewicht zur Katze rechts unten), rechts flach
cumulus(p4, [(-2, 78, 10), (9, 83, 8), (20, 88, 7), (34, 90, 7), (47, 88, 7), (59, 86, 8), (68, 90, 8)], CL4)
MX, MY = (W4 - mini.shape[1]) // 2, 32
put(p4, mini, MX, MY)
put(p4, cat_l, 7, 15)                                # links oben
put(p4, cat_r, W4 - 7 - cat_r.shape[1], 61)         # rechts unten
blit(cv, p4, 4, -1, -1)
print(save(cv, '05_kitten_escort.png'))
