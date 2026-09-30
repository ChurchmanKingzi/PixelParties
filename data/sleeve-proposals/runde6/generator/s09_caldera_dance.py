# -*- coding: utf-8 -*-
"""09 Caldera Dance – Gegner „Burning Inferno“ (Structure Deck Burning Inferno), Held: Luna Pele, the Flame Dancer.

Bildidee: Nachts tief im Krater. Luna Pele tanzt auf einem Basaltfelsen mitten im Lavasee (Heart of the Mountain),
links und rechts steigen ihre Flammensäulen aus der Lava (Dance of the Flame Pillars); die Kraterwände glühen von
unten, oben öffnet sich der Schlot zum Nachthimmel. Im Vulkan statt davor (≠ „Luau“: keine Tiki-Statuen, kein
Sonnenuntergang).

Quellen (MotiveHawaii.xcf):
  Ebene 262 „Luna Tepe“  – Base-Luna Pele mit Flammenhaar/-aura (Figur der Heldenkarte, Szene „Sichtbar #51“ = Ebene 5,
                            Lage 248,426; Pixel identisch).
  Ebene 258 „Ebene #20“  – einzelne hohe Flammensäule (Dance of the Flame Pillars), links normal, rechts gespiegelt.
  refs/lava_autotiles.png – Lava-Autotile des Nutzers (48×64, 16-px-Kacheln): Oberkanten- und Mittelkachel als Lavasee.
  Ebene 57 „Ebene #121“, 59 „Ebene #119“ – Basaltfelsen mit Zellmuster (Kraterwand-Textur, Felsinsel).
Selbst gezeichnet: Himmel, Lichtführung der Kraterwände, Glutsaum, Glutringe um Säulen/Insel, Funken.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Himmel, Kraterwände, Lavasee (Autotile), zwei Flammensäulen (links/rechts) mit Glutringen
  Mittelgrund 3× (84×117):  aufsteigende Funken
  Vordergrund 5× (50×70):   Basaltinsel und Luna Pele
"""
import math, random, os
from PIL import Image
import numpy as np
from common import *  # noqa

rnd = random.Random(9)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
B = 'MotiveHawaii'

# ------------------------------------------------------------------ Sprites
t262 = layer(B, 262)
pp_ = parts(t262[436:528, 139:336], dil=1)
luna = [p for p in pp_ if p.shape[:2] == (32, 22)][0]
pillar_big = [p for p in pp_ if p.shape[:2] == (60, 16)][0]
pillar_small = [p for p in pp_ if p.shape[:2] == (35, 14)][0]
pillar_tall = sorted(parts(sprite('o09_258', B, [258]), dil=1), key=lambda p: -p.shape[0])[0]   # eine einzelne hohe Säule
lava = sprite('o09_lava', B, [265])[..., :3].astype(float)          # 16×64
basalt = sprite('o09_basalt', B, [57])                               # 66×61
rock = sprite('o09_rock', B, [59])                                   # 34×49


def put(dst, s, x, y):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = s[j, i, :3]; dst[yy, xx, 3] = 255


# Basalt-Kachel: Innenbereich des Felsens (nur deckende Pixel), gespiegelt gekachelt
bt = basalt[18:50, 20:56, :3].astype(float)


def btex(y, x):
    h, w = bt.shape[:2]
    yy = y % (2 * h); yy = yy if yy < h else 2 * h - 1 - yy
    xx = x % (2 * w); xx = xx if xx < w else 2 * w - 1 - xx
    return bt[yy, xx]


# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
LAKE = 102                               # Oberkante Lavasee (Canvas y 204)
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
SKY_T, SKY_B = np.array((12, 6, 16)), np.array((70, 22, 16))
for y in range(H2):
    for x in range(W2):
        t = min(1.0, y / 60)
        c = SKY_T * (1 - t) + SKY_B * t
        bg[y, x, :3] = c
for _ in range(16):
    x, y = rnd.randrange(30, 95), rnd.randrange(2, 30)
    bg[y, x, :3] = (200, 170, 150)


def wall(x):
    """Innenkante der Kraterwand (y der Oberkante): Trichter, oben schmaler Schlot."""
    d = abs(x + 0.5 - W2 / 2) / (W2 / 2)
    return 4 + 80 * (1 - d) ** 1.6 + 2 * math.sin(x * 0.7) + 1.5 * math.sin(x * 1.9)


GLOW = np.array((255, 110, 30))
for x in range(W2):
    top = int(wall(x))
    for y in range(max(top, 0), LAKE):
        c = btex(y, x + (0 if x < W2 / 2 else 17))
        # Licht von unten (Lava), stärker zur Mitte und nach unten
        L = ((y - top) / max(1, LAKE - top)) ** 1.4 * 0.9 + max(0, (y - 70) / 48) * 0.5
        L = min(L, 1.2)
        q = math.floor(L * 5 + BAY[y % 4, x % 4]) / 5
        col = c * (0.55 + 0.25 * q) + GLOW * 0.33 * q
        bg[y, x, :3] = np.clip(col, 0, 255)
    if 0 <= top < H2:                                  # Grat im Gegenlicht
        bg[top, x, :3] = (120, 50, 30)

# Lavasee aus der Lava-Autotile-Textur des Nutzers (refs/lava_autotiles.png, 48×64, 16-px-Kacheln im RPG-Maker-
# Aufbau): oberste Kachelreihe = Oberkanten-Kachel (Krustenrand mit Lava darunter), darunter die reine Lava-Mittelkachel.
LAV = np.array(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'refs', 'lava_autotiles.png'))
               .convert('RGB')).astype(float)
T_TOP = LAV[16:32, 16:32]                      # Oberkante
T_MID = LAV[32:48, 16:32]                      # Mitte (reine Lava)
for y in range(LAKE, H2):
    k = y - LAKE
    for x in range(W2):
        t = T_TOP if k < 16 else T_MID
        c = t[k % 16, (x + 5) % 16]
        f = 0.72 + 0.28 * min(1, k / 40)          # hinten (am Ufer) etwas dunkler
        bg[y, x, :3] = np.clip(c * f, 0, 255)

# Flammensäulen (2×): zwei große links und rechts (wie auf ihrer Karte), Fuß jeweils im See
FR = ((255, 214, 120), (255, 150, 50))


def ring2(dst, cx, cy, rx, ry):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if not (0 <= x < dst.shape[1] and 0 <= y < dst.shape[0]): continue
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if 0.7 <= d < 1.0: dst[y, x, :3] = FR[0] if d < 0.85 else FR[1]


for cx, fy, s in ((22, LAKE + 12, pillar_tall), (103, LAKE + 12, flip(pillar_tall))):
    ring2(bg, cx, fy, 8, 2)
    put(bg, s, cx - s.shape[1] // 2, fy + 1 - s.shape[0])

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)


def glow_ring(dst, cx, cy, rx, ry, cols=((255, 214, 120), (255, 150, 50))):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if not (0 <= x < dst.shape[1] and 0 <= y < dst.shape[0]): continue
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if 0.72 <= d < 1.0:
                dst[y, x, :3] = cols[0] if d < 0.86 else cols[1]; dst[y, x, 3] = 255


# Funken, die aus dem See aufsteigen
for (x, y) in [(22, 40), (60, 30), (30, 22), (52, 52), (18, 60), (66, 58), (40, 18), (58, 74), (26, 76)]:
    mid[y, x, :3] = (255, 200, 90); mid[y, x, 3] = 255

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
# Basaltinsel: flacher Block aus der Basalt-Textur (Felsen 57), oben leicht gewölbt, Glutsaum an Kante und Fuß
iy = 53                                          # Oberkante (Canvas y 265)
IW = 12                                          # halbe Breite
isl = np.zeros((H5, W5, 4), np.uint8)
for y in range(iy - 1, iy + 9):
    for x in range(W5):
        dx = abs(x + 0.5 - 25)
        top = iy - 1 + (dx / IW) ** 3 * 3                     # flaches Plateau, Kanten fallen ab
        wid = IW + max(0, y - iy) * 0.55                       # Flanken laufen nach unten breit aus
        if dx > wid or y < top: continue
        c = bt[(y - iy + 6) % bt.shape[0], (x + 5) % bt.shape[1]]
        sh = 1.25 - 0.08 * max(0, y - iy)
        isl[y, x, :3] = np.clip(c * sh, 0, 255); isl[y, x, 3] = 255
        if y - top < 1: isl[y, x, :3] = (118, 60, 44)               # Glutlicht auf der Kante
        elif dx > wid - 1.2 and y > iy + 1: isl[y, x, :3] = (130, 52, 30)   # rote Flanken im Lavalicht
glow_ring(fg, 25, iy + 8.5, IW + 7, 1.8)
m = isl[..., 3] > 0
fg[m] = isl[m]
# Luna Pele
lx = 25 - luna.shape[1] // 2
put(fg, luna, lx, iy - luna.shape[0])

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(mid, 3), -1, 0)
cv.paste(up(fg, 5), 0, 0)
save(cv, '09_caldera_dance.png')
print('ok')
