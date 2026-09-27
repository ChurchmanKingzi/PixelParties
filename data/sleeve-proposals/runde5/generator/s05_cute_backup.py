# -*- coding: utf-8 -*-
"""05 Cute Backup – Held: Cute Annoyance Mini.
Mini schwebt mit ihren grauen Federflügeln und dem frechen Grinsen groß im Vordergrund über einem Wolkenmeer;
hinter ihr steigt – nur als dunstiger Riese im rosa Abendschein – ihr größter „Cute“-Freund aus den Wolken:
die fünfköpfige Cute Hydra mit leuchtenden Herzaugen, zwei Herzchen (Charme) steigen über ihr auf.
Die kleine Nervensäge hat Verstärkung gerufen (Kartentext: sucht und beschwört „Cute“-Kreaturen; Summoning Magic).

Quellen (MotiveMoe.xcf):
  Ebene 497 „Mini #2“ + 498 „Mini“ (Flügelpaar) – Base-Mini, pixelgenau identisch mit Sichtbar #124
      (Ebene 101, Kartenausschnitt Lage 100,259 der Karte „Cute Annoyance Mini“; 0 abweichende Pixel).
      Nicht verwendet: 495 (Schatten, nicht in der Kartenszene), 326 „Trial of Annoyance“ (Variante mit offenem Mund).
  Ebene 190 „Cute Hydra“ – Karte „Cute Hydra“ (Sichtbar #81, Lage 256,158; vollständig, einzige Ebene)
  Ebene 499 „Mini #1“ – das kleine Herzchen (5×4) aus Minis Kartenszene, rosa umgefärbt
Selbst gezeichnet: Himmel mit Abendschein und Sternen, Wolkenschlieren, Wolkenbank, Wolkenmeer, Vordergrundwolken.

Skalierung (Tiefenebenen, Ausgabe = 250×350-Raster × 3):
  Himmel, Schein, Sterne, Schlieren             – 1× (250×350)
  Cute Hydra (gedunstet), Herzchen, Wolkenbank, Wolkenmeer – 3× (84×117)
  Mini, Vordergrundwolken                        – 5× (50×70)
"""
import math, random
from common import *  # noqa
import numpy as np

B = 'MotiveMoe'
rnd = random.Random(5)

mini = sprite('h05_mini', B, [497, 498])          # 34×25, Base-Mini (Sichtbar #124, Lage 100,259)
hydra = sprite('h05_hydra', B, [190])              # 48×44, Karte „Cute Hydra“ (Sichtbar #81)
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
    t = min(1, y / 230) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(250):
        cv.a[y, x] = SKY[i + 1] if f > bayer(x, y) else SKY[i]
# Abendschein hinter dem großen Freund (1×, geordnet gedithert)
GLOW = (246, 200, 238)
for y in range(350):
    for x in range(250):
        d = math.hypot((x - 125) / 1.0, (y - 92) / 0.9)
        t = max(0.0, 1 - d / 118) ** 1.6 * 0.85
        if t > 0:
            q = math.floor(t * 4 + bayer(x, y)) / 4
            if q > 0: cv.a[y, x] = mix(cv.a[y, x], GLOW, min(1, q))
# ein paar Sterne im oberen Himmel (1×, außerhalb des Abendscheins)
for (x, y, big) in [(30, 34, 1), (58, 58, 0), (214, 30, 1), (190, 62, 0), (236, 78, 0), (16, 84, 0), (96, 28, 0), (160, 24, 0)]:
    cv.px(x, y, (250, 236, 255))
    if big:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(x + dx, y + dy, (200, 170, 236))
# ferne Wolkenschlieren (1×)
for (cx, cy, L) in [(38, 52, 44), (212, 40, 38), (26, 104, 30), (226, 96, 34)]:
    for x in range(cx - L // 2, cx + L // 2):
        t = abs(x - cx) / (L / 2)
        col = mix(cv.a[cy, max(0, min(249, x))], (240, 214, 246), 0.55)
        cv.px(x, cy, col)
        if t < 0.55: cv.px(x, cy - 1, col)

# ---------------- Ebene 2: Cute Hydra hinter der Wolkenbank (3×) -----------------------------
W3, H3 = 84, 117
p3 = rgba(W3, H3)
hz = hydra.copy()
eye = (hz[..., 0] > 180) & (hz[..., 2] > 150) & (hz[..., 1] < 120)
for j in range(hz.shape[0]):
    for i in range(hz.shape[1]):
        if hz[j, i, 3] and not eye[j, i]:
            t = 0.40 + 0.25 * max(0, j - 20) / 24             # nach unten stärker im Dunst
            hz[j, i, :3] = mix(hz[j, i, :3], (168, 128, 214), t)
HX, HY = (W3 - hydra.shape[1]) // 2, 14
put(p3, hz, HX, HY)
# Herzchen (Charme) steigen über den äußeren Köpfen auf – symmetrisch
pink = heart.copy()
for j in range(pink.shape[0]):
    for i in range(pink.shape[1]):
        if pink[j, i, 3]:
            v = pink[j, i, :3].astype(int)
            pink[j, i, :3] = (250, 150, 220) if v[2] > 215 else (232, 100, 196) if v[1] > 40 else (176, 60, 156)
for (x, y) in [(HX + 1, HY - 3), (HX + hydra.shape[1] - 6, HY - 3)]:
    put(p3, pink, x, y)
# Wolkenmeer: gestaffelte Reihen nach vorn (weiter hinten kleiner und dunkler)
CL3 = [(250, 238, 250), (234, 212, 246), (212, 182, 236), (184, 150, 222), (156, 120, 204)]
CLF = [(218, 192, 240), (202, 172, 232), (186, 152, 222), (170, 134, 212), (154, 118, 202)]
for y in range(56, H3):
    for x in range(W3): p3[y, x] = list(CLF[4]) + [255]
for row, (cy, r, tones) in enumerate([(70, 6, CLF), (88, 8, CLF), (108, 10, CL3)]):
    puffs, x = [], -r + row * 3
    while x < W3 + r:
        rr = r + rnd.choice((-2, -1, 0, 1))
        puffs.append((x, cy + rnd.choice((-1, 0, 1)), rr)); x += rr + rnd.randint(2, 5)
    cumulus(p3, puffs, tones, base=cy + 2)
# Wolkenbank direkt hinter der Hydra: Tal in der Mitte, Türme links/rechts
cumulus(p3, [(-2, 48, 11), (8, 42, 9), (16, 48, 8), (25, 51, 8), (34, 53, 7), (42, 52, 7), (50, 53, 7),
             (59, 51, 8), (68, 48, 8), (76, 42, 9), (86, 48, 11),
             (4, 60, 9), (20, 60, 9), (42, 60, 10), (64, 60, 9), (80, 60, 9)], CL3, base=62)
# Charme-Aura: die Wolken direkt hinter Mini liegen in ihrem violetten Schein (3×, gedithert) – hebt die Flügel ab
AURA = (170, 124, 214)
for y in range(H3):
    for x in range(W3):
        if not p3[y, x, 3]: continue
        d = math.hypot((x - 42) / 34, (y - 77) / 26)
        t = max(0.0, 1 - d) * 0.9
        if t > 0 and math.floor(t * 3 + bayer(x, y)) / 3 > 0:
            q = min(1, math.floor(t * 3 + bayer(x, y)) / 3)
            p3[y, x, :3] = mix(p3[y, x, :3], AURA, 0.55 * q)
blit(cv, p3, 3, -1, -1)

# ---------------- Ebene 3: Mini + Vordergrundwolken (5×) ----------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
MX, MY = (W5 - mini.shape[1]) // 2, 33
CL5 = [(255, 250, 255), (244, 226, 250), (226, 200, 242), (200, 168, 230), (170, 136, 214)]
cumulus(p5, [(-1, 58, 8), (7, 62, 6), (14, 66, 5), (25, 69, 5), (36, 66, 5), (43, 62, 6), (51, 58, 8),
             (4, 70, 7), (46, 70, 7)], CL5)
put(p5, mini, MX, MY)
blit(cv, p5, 5)
print(save(cv, '05_cute_backup.png'))
