# -*- coding: utf-8 -*-
"""07 Sword in the Stone – Silhouette vor Himmel: Das Legendäre Schwert eines Barbarenkönigs steckt senkrecht in der
Spitze eines mächtigen Felsbrockens. Über ihm reißt die Morgendämmerung eine Lücke in die Wolkendecke, ein
goldener Lichtstrahl fällt genau auf den Griff; dahinter liegen ferne Hügel im Dunst.

Quellen (Motive.xcf):
  Ebene 911 „Legendary Sword“ (Karte „Legendary Sword of a Barbarian King“), um 90° gedreht
  Ebene 1274 „Sabrina #5“ (Felsbrocken; nur der obere Teil sichtbar, warm getönt)
Selbst gezeichnet: Dämmerungshimmel, Wolkenbänder, Lichtstrahl, Hügelkämme, Funkeln am Griff, Einstichschatten.

Skalierung:
  Vordergrund (Fels + Schwert + Funkeln + Einstichschatten): 5× (Raster 50×70)
  Hintergrund (Himmel, Wolken, Lichtstrahl, Hügel): 2× (Raster 125×175)
"""
from common import *  # noqa
import numpy as np, math

M = 'Motive'
BW, BH = 125, 175
yy, xx = np.mgrid[0:BH, 0:BW]
th = BAYER4[yy % 4, xx % 4]

# ---------------- Hintergrund 2× ----------------
bg = Canvas(BW, BH)
sky = [(14, 16, 44), (30, 28, 74), (62, 44, 104), (118, 64, 112), (184, 96, 104), (232, 150, 106), (248, 196, 132)]
t = np.clip((yy - 4) / 118, 0, 1) * (len(sky) - 1)
q = np.floor(t + th * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c

# Wolkendecke oben mit rundem Loch (Lichtquelle) und zwei lockere Wolkenbänder darunter
rng = np.random.RandomState(7)


def bumpy(x0, x1, base, amp, seed):
    r = np.random.RandomState(seed); out = np.zeros(BW); x = x0
    while x < x1:
        w = r.randint(6, 13); a = r.uniform(1.0, amp)
        for i in range(w):
            if 0 <= x + i < BW: out[x + i] = base + a * math.sin(math.pi * i / w)
        x += w
    return out


# Decke: Unterkante gewellt (nach unten ausgebeult)
low = bumpy(0, BW, 26, 4.5, 11)
HX, HY, HRX, HRY = 62.5, 17, 11, 6.5
for x in range(BW):
    for y in range(0, int(low[x]) + 1):
        dh = ((x + 0.5 - HX) / HRX) ** 2 + ((y + 0.5 - HY) / HRY) ** 2
        if dh < 1: continue
        if dh < 1.35: bg.a[y, x] = (255, 214, 150)         # heller Rand des Wolkenlochs
        elif y >= low[x] - 1: bg.a[y, x] = (176, 108, 132)    # angestrahlte Unterkante
        elif dh < 2.2: bg.a[y, x] = (132, 88, 128)
        else: bg.a[y, x] = (62, 46, 94) if (y < low[x] - 4 or (x + y) % 2) else (96, 66, 112)
# Loch: helles Inneres
for x in range(BW):
    for y in range(0, 30):
        dh = ((x + 0.5 - HX) / HRX) ** 2 + ((y + 0.5 - HY) / HRY) ** 2
        if dh < 1: bg.a[y, x] = (255, 236, 186) if dh < 0.45 else (250, 206, 150)


def wisp(x0, x1, yb, thick, seed, top_col, body_col, low_col):
    top = bumpy(x0, x1, 0, 3.2, seed)
    for x in range(max(0, x0), min(BW, x1)):
        # an den Enden ausdünnen
        e = min(x - x0, x1 - 1 - x)
        tk = min(thick, 1 + e // 2)
        yt = int(round(yb - top[x] * min(1, e / 6)))
        for y in range(yt, yb + tk):
            if 0 <= y < BH:
                bg.a[y, x] = top_col if y == yt else (low_col if y == yb + tk - 1 else body_col)


wisp(-4, 44, 50, 4, 21, (236, 150, 130), (150, 86, 114), (118, 68, 104))
wisp(82, 130, 46, 4, 22, (236, 150, 130), (150, 86, 114), (118, 68, 104))
wisp(-2, 34, 80, 3, 23, (252, 196, 150), (208, 124, 116), (180, 104, 112))
wisp(92, 128, 84, 3, 24, (252, 196, 150), (208, 124, 116), (180, 104, 112))

# Ferne Hügelkämme (zwei Schichten, dunstig)
for base, amp, freq, ph, col in [(118, 6, 0.06, 0.5, (150, 92, 118)), (128, 7, 0.045, 2.0, (104, 66, 104))]:
    for x in range(BW):
        h = base - amp * (0.6 * math.sin(x * freq + ph) + 0.4 * math.sin(x * freq * 2.3 + ph * 1.7))
        bg.a[int(h):, x] = col
bg.a[134:] = (70, 46, 84)

# Lichtstrahl aus der Wolkenlücke auf den Griff (geordnet gedithert, zwei Stufen)
SX, TOPY, HITY = 62.5, 20, 64
for y in range(TOPY, HITY + 18):
    tt = (y - TOPY) / (HITY - TOPY)
    half = 7 + 8 * tt
    core = 2 + 3 * tt
    for x in range(BW):
        d = abs(x + 0.5 - SX)
        if d < half:
            a = 0.55 if d < core else 0.3 * (1 - (d - core) / (half - core))
            a *= 1.0 if y <= HITY else max(0, 1 - (y - HITY) / 18)
            if a > th[y, x]:
                c = bg.a[y, x].astype(int)
                bg.a[y, x] = np.clip(c + (np.array([255, 222, 150]) - c) * 0.6, 0, 255).astype(np.uint8)
vignette(bg, 0.45, 0.6)

# ---------------- Vordergrund 5× ----------------
FW, FH = 50, 70
fg = np.zeros((FH, FW, 4), np.uint8)


def put(img, x, y):
    h, w = img.shape[:2]
    for j in range(h):
        for i in range(w):
            if img[j, i, 3] >= 128 and 0 <= y + j < FH and 0 <= x + i < FW:
                fg[y + j, x + i] = img[j, i]


def dot(x, y, c):
    if 0 <= x < FW and 0 <= y < FH:
        fg[y, x, :3] = c; fg[y, x, 3] = 255


sword = rot90(sprite('b07_sword', M, [911]), 3)          # Knauf oben, Spitze unten (11×32)
rock = sprite('b07_rock', M, [1274])                    # 52×69
# Fels warm tönen (Morgenlicht), obere Kante heller
rk = tint(rock, (120, 70, 80), 0.18)
m = rk[..., 3] > 0
topedge = m & ~np.vstack([np.zeros((1, m.shape[1]), bool), m[:-1]])
rk[topedge, :3] = np.clip(rk[topedge, :3].astype(int) + (60, 40, 10), 0, 255).astype(np.uint8)
# Licht von oben: obere Felszeilen aufhellen (Stufen)
for j in range(rk.shape[0]):
    f = 1.25 - 0.4 * min(1, j / 18)
    rk[j, :, :3] = np.clip(rk[j, :, :3].astype(float) * f, 0, 255).astype(np.uint8)
RY = 44                                                  # Felsspitze (Rasterzeile)
peak_x = 23
RX = FW // 2 - peak_x
BURY = 8                                                 # im Fels steckende Klingenlänge
SWX = FW // 2 - 5
SWY = RY + 2 + BURY - 32
put(sword, SWX, SWY)
put(rk, RX, RY)
# Einstich: feiner Riss unter der Klinge, Schlagschatten rechts der Klinge auf dem Fels
for (dx, dy) in [(4, 2), (5, 3), (5, 4), (6, 5)]:
    dot(SWX + dx, RY + dy, (46, 34, 42))
# Funkeln am Griff (Kreuzsterne)
for (x, y, s) in [(SWX - 3, SWY + 3, 1), (SWX + 13, SWY + 8, 1), (SWX + 12, SWY - 1, 0)]:
    dot(x, y, (255, 250, 220))
    if s:
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            dot(x + dx, y + dy, (250, 214, 140))

# ---------------- Zusammensetzen ----------------
cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)
cv.paste(up(fg, 5), 0, 0)
print(save(cv, '07_sword_in_the_stone.png'))
