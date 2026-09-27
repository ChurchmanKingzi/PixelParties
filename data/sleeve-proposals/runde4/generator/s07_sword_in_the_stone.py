# -*- coding: utf-8 -*-
"""07 Sword in the Stone – Silhouette vor Himmel: Das Legendäre Schwert eines Barbarenkönigs steckt senkrecht in der
Spitze eines gedrungenen, bemoosten Felsens. Über ihm reißt die Morgendämmerung eine unregelmäßige Öffnung in die
Wolkendecke, ein Strahlenbündel fällt auf das Schwert; dahinter liegen ferne Hügel im Dunst.

Quellen:
  Motive 911 „Legendary Sword“ (Karte „Legendary Sword of a Barbarian King“), um 90° gedreht
  Motive 1274 „Sabrina #5“ (Felsbrocken) – nur als Umriss seiner oberen 20 Zeilen (gedrungene Kuppe)
  MotiveGN 421 „Klippen“ – Felswand-Textur mit Spalten und Moosranken (Texel 1:1, entsättigt zu Grau, Moos bleibt grün)
Selbst gezeichnet: Dämmerungshimmel, Wolkendecke mit Öffnung, Strahlenbündel, Wolkenbänder, Hügelkämme,
  Lichtkanten/Schatten am Fels, Grasbüschel auf der Kuppe, Riss am Einstich, Funkeln.

Skalierung:
  Vordergrund (Fels, Moos, Gras, Schwert, Funkeln, Riss): 5× (Raster 50×70)
  Hintergrund (Himmel, Wolken, Strahlen, Hügel): 2× (Raster 125×175)
"""
from common import *  # noqa
import numpy as np, math, cv2

M, G = 'Motive', 'MotiveGN'
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


def bumpy(x0, x1, base, amp, seed):
    r = np.random.RandomState(seed); out = np.zeros(BW); x = x0
    while x < x1:
        w = r.randint(6, 13); a = r.uniform(1.0, amp)
        for i in range(w):
            if 0 <= x + i < BW: out[x + i] = base + a * math.sin(math.pi * i / w)
        x += w
    return out


# Wolkendecke: gewellte Unterkante; unregelmäßige Öffnung aus mehreren versetzten Ellipsen, Rand ausgefranst
low = bumpy(0, BW, 30, 5, 11)
deck = yy <= low[None, :].repeat(BH, 0)
hole = np.zeros((BH, BW), bool)
for hx, hy, rx, ry in [(62, 17, 10, 4.5), (54, 20, 6, 3.5), (71, 14, 7, 3.5), (65, 22, 6, 3), (47, 17, 4, 2.5),
                       (78, 18, 4, 2.5)]:
    hole |= ((xx + 0.5 - hx) / rx) ** 2 + ((yy + 0.5 - hy) / ry) ** 2 < 1
rnd = np.random.RandomState(3).rand(BH, BW)
er = cv2.dilate(hole.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
hole |= er & (rnd < 0.35)                                  # ausgefranster Rand
deck &= ~hole
rim = deck & (cv2.dilate(hole.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
rim2 = deck & ~rim & (cv2.dilate(hole.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0)
lowedge = deck & ~np.roll(deck, -1, 0)
# Wolkenmasse: Helligkeit nach Abstand zur Öffnung (4 Stufen), Wolkenballen als Buckelreihen mit dunkler Unterlinie
dh = cv2.distanceTransform((~hole).astype(np.uint8), cv2.DIST_L2, 3)
lv = np.clip(3 - dh / 9, 0, 3).astype(int)
deck_cols = [(58, 42, 86), (84, 60, 108), (118, 80, 124), (160, 108, 136)]
for k, c in enumerate(deck_cols):
    bg.a[deck & (lv == k)] = c
for row_base, seed in [(8, 31), (16, 32), (24, 33)]:
    bl = bumpy(0, BW, row_base, 3.0, seed)
    for x in range(BW):
        y = int(round(bl[x]))
        if 0 <= y < BH and deck[y, x] and not rim[y, x] and not rim2[y, x]:
            bg.a[y, x] = np.clip(bg.a[y, x].astype(int) - 22, 0, 255)
        if 0 <= y - 1 < BH and deck[y - 1, x] and not rim[y - 1, x]:
            bg.a[y - 1, x] = np.clip(bg.a[y - 1, x].astype(int) + 18, 0, 255)
bg.a[rim2] = (176, 116, 136)
bg.a[rim] = (250, 206, 150)
bg.a[lowedge] = (190, 118, 136)
# Blick durch die Öffnung: heller Himmel mit Verlauf (kein Scheibenkörper)
hy_ = np.clip((yy - 10) / 14, 0, 1)
bg.a[hole] = np.where((hy_[hole] > 0.5)[:, None], (255, 232, 176), (255, 244, 208))

# Strahlenbündel: fünf divergierende Strahlen von der Öffnung nach unten (gedithert aufhellen)
SX0, SY0 = 62.5, 22
rays = [(-16, 0.34), (-7, 0.42), (0, 0.55), (8, 0.42), (17, 0.34)]      # (Zielversatz bei y=70, Stärke)
for dxr, s in rays:
    for y in range(SY0, 128):
        tt = (y - SY0) / (70 - SY0)
        cx = SX0 + dxr * tt + (dxr * 0.25)
        half = 1.5 + 2.8 * tt if dxr else 2.5 + 5 * tt
        fade = 1.0 if y < 76 else max(0.0, 1 - (y - 76) / 40)
        for x in range(int(cx - half - 1), int(cx + half + 2)):
            if not (0 <= x < BW) or deck[y, x]: continue
            d = abs(x + 0.5 - cx)
            if d < half and s * fade * (1 - 0.5 * d / half) > th[y, x] * 0.8:
                c = bg.a[y, x].astype(int)
                bg.a[y, x] = np.clip(c + (np.array([255, 224, 156]) - c) * 0.5, 0, 255).astype(np.uint8)


def wisp(x0, x1, yb, thick, seed, top_col, body_col, low_col):
    top = bumpy(x0, x1, 0, 3.2, seed)
    for x in range(max(0, x0), min(BW, x1)):
        e = min(x - x0, x1 - 1 - x)
        tk = min(thick, 1 + e // 2)
        yt = int(round(yb - top[x] * min(1, e / 6)))
        for y in range(yt, yb + tk):
            if 0 <= y < BH:
                bg.a[y, x] = top_col if y == yt else (low_col if y == yb + tk - 1 else body_col)


wisp(-4, 36, 58, 4, 21, (236, 150, 130), (150, 86, 114), (118, 68, 104))
wisp(90, 130, 54, 4, 22, (236, 150, 130), (150, 86, 114), (118, 68, 104))
wisp(-2, 28, 88, 3, 23, (252, 196, 150), (208, 124, 116), (180, 104, 112))
wisp(98, 128, 92, 3, 24, (252, 196, 150), (208, 124, 116), (180, 104, 112))

# Ferne Hügelkämme (zwei Schichten, dunstig)
for base, amp, freq, ph, col in [(122, 6, 0.06, 0.5, (150, 92, 118)), (132, 7, 0.045, 2.0, (104, 66, 104))]:
    for x in range(BW):
        h = base - amp * (0.6 * math.sin(x * freq + ph) + 0.4 * math.sin(x * freq * 2.3 + ph * 1.7))
        bg.a[int(h):, x] = col
bg.a[142:] = (70, 46, 84)
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
rock = sprite('b07_rock', M, [1274])                    # 52×69 – nur Umriss der Kuppe
ROWS = 20
shape = rock[:ROWS, :, 3] > 0
# Felstextur: Klippenwand aus MotiveGN 421 (Spalten + Moosranken), Brauntöne → kühles Grau, Moos bleibt
cl = layer(G, 421)
tex = cl[228 + 176:228 + 176 + ROWS, 70 + 90:70 + 90 + shape.shape[1], :3].astype(float)
hsv = cv2.cvtColor(tex.astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_RGB2HSV).reshape(tex.shape).astype(float)
green = (hsv[..., 0] > 30) & (hsv[..., 0] < 90) & (hsv[..., 1] > 60)
lumv = tex.mean(-1, keepdims=True)
grey = lumv * np.array([0.92, 0.92, 1.02]) + 18
tex = np.where(green[..., None], tex * np.array([0.85, 1.0, 0.8]), grey)
RY = 50
peak_x = 23
RX = FW // 2 - peak_x
for j in range(ROWS):
    for i in range(shape.shape[1]):
        if not shape[j, i]: continue
        c = tex[j, i].copy()
        up_empty = j == 0 or not shape[j - 1, i]
        left_empty = i == 0 or not shape[j, i - 1]
        right_empty = i == shape.shape[1] - 1 or not shape[j, i + 1]
        f = 1.0 - 0.02 * j                                   # nach unten dunkler
        if up_empty:
            c = c * 0.4 + np.array([250, 210, 150]) * 0.6        # Licht von oben (Strahl)
        elif j >= 1 and (not shape[j - 2, i] if j >= 2 else True):
            c = c * 1.25 + 10
        elif left_empty:
            c = c * 1.1
        elif right_empty or i > peak_x + 6 + j * 0.6:
            f *= 0.72                                         # Schattenseite
        dot(RX + i, RY + j, tuple(np.clip(c * f, 0, 255).astype(np.uint8)))
# Grasbüschel/Moos auf der Kuppe und den Kanten
for (i, j) in [(17, 3), (18, 2), (29, 3), (30, 4), (11, 7), (12, 6), (36, 8), (37, 7), (6, 12), (42, 12)]:
    x, y = RX + i, RY + j - 1
    if fg[y + 1, x, 3] and not fg[y, x, 3]:
        dot(x, y, (104, 150, 70))
        dot(x, y + 1, (70, 112, 52))
# Schwert
BURY = 8
SWX = FW // 2 - 5
SWY = RY + 2 + BURY - 32
# Schwert wird VOR dem Fels gesetzt und dann vom Fels verdeckt: Fels erneut auf eigene Ebene
rockpix = fg.copy()
put(sword, SWX, SWY)
m = rockpix[..., 3] > 0
fg[m] = rockpix[m]
# Einstich: Riss unter der Klinge und dunkle Spalte
for (dx, dy) in [(4, 2), (5, 3), (5, 4), (6, 5), (2, 3), (1, 4)]:
    dot(SWX + dx, RY + dy, (38, 30, 40))
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
