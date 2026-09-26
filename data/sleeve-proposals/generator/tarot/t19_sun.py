# -*- coding: utf-8 -*-
# XIX – Die Sonne: Taio, the Sun Fencer
# Taio reckt das Sonnenschwert empor, in der anderen Hand das rote Banner der Sonnen-Karte;
# hinter ihm die Mauer mit Sonnenblumen, darüber die lachende Sonne mit geraden und gewellten Strahlen.
from tlib import *

cv = new_card()
# ---------------------------------------------------------------- Himmel
sky(cv, [(28, 70, 170), (44, 110, 210), (90, 160, 236), (160, 206, 246), (236, 236, 214)])
SX, SY, SR = 125, 104, 34
# Strahlen: gerade (lang) und gewellt (kurz) im Wechsel
for i in range(16):
    a = i * math.pi / 8 + math.pi / 16
    straight = i % 2 == 0
    L = 118 if straight else 84
    for s in np.linspace(SR + 2, L, 260):
        wob = 0 if straight else math.sin(s * 0.35) * 3.2
        hw = (7.0 if straight else 4.0) * (1 - (s - SR) / (L - SR)) + 0.6
        nx, ny = -math.sin(a), math.cos(a)
        bx = SX + math.cos(a) * s + nx * wob; by = SY + math.sin(a) * s + ny * wob
        for t in np.linspace(-hw, hw, int(hw * 2) + 2):
            x, y = int(round(bx + nx * t)), int(round(by + ny * t))
            if not in_art(x, y):
                continue
            edge = abs(t) / hw
            fade = (s - SR) / (L - SR)
            c = (255, 226, 96) if edge < 0.55 else (250, 176, 50)
            if fade > 0.55 and BAYER4[y % 4, x % 4] < (fade - 0.55) * 2.2:
                continue
            px(cv, x, y, c)
glow(cv, SX, SY, 74, (255, 246, 200), k=0.5, mix=0.35)
# Sonnenscheibe mit Relief
SUN = [(200, 90, 20), (236, 136, 30), (250, 186, 50), (255, 222, 96), (255, 244, 170), (255, 255, 230)]
disc_relief(cv, SX, SY, SR, SUN, noise_k=0.18, bias=0.12, k=1.6)
# Kranz (Korona-Ring)
for y in range(SY - SR - 3, SY + SR + 4):
    for x in range(SX - SR - 3, SX + SR + 4):
        d = math.hypot(x - SX, y - SY)
        if SR < d <= SR + 1.5:
            px(cv, x, y, (214, 110, 20))
# Gesicht: geschlossene, lachende Augen, rote Wangen, Lächeln
def arc(cx, cy, rx, ry, a0, a1, c, n=40):
    for t in np.linspace(a0, a1, n):
        px(cv, cx + math.cos(t) * rx, cy + math.sin(t) * ry, c)
FACE = (170, 70, 16)
for ex in (SX - 12, SX + 12):
    arc(ex, SY - 2, 6, 4, math.pi * 1.05, math.pi * 1.95, FACE)
    arc(ex, SY - 1, 6, 4, math.pi * 1.1, math.pi * 1.9, (214, 110, 26))
    # Brauen
    arc(ex, SY - 9, 6, 3, math.pi * 1.15, math.pi * 1.85, (214, 120, 30))
for cx_ in (SX - 20, SX + 20):
    for y in range(SY + 5, SY + 10):
        for x in range(cx_ - 4, cx_ + 5):
            if ((x - cx_) / 4.5) ** 2 + ((y - SY - 7) / 2.6) ** 2 <= 1 and (x + y) % 2 == 0:
                px(cv, x, y, (246, 120, 90))
arc(SX, SY + 8, 11, 7, 0.15, math.pi - 0.15, FACE, 60)
arc(SX, SY + 9, 10, 6, 0.3, math.pi - 0.3, (214, 110, 26), 60)
for x in range(SX - 6, SX + 7):
    for y in range(SY + 11, SY + 15):
        if ((x - SX) / 6.5) ** 2 + ((y - SY - 11) / 3.6) ** 2 <= 1:
            px(cv, x, y, (150, 40, 30) if y < SY + 13 else (230, 90, 80))
# Nase
px(cv, SX, SY + 3, (220, 130, 40)); px(cv, SX + 1, SY + 4, FACE)
# kleine Wolken
puffy_cloud(cv, 44, 92, 36, 12, [(120, 150, 210), (170, 196, 236), (214, 230, 250), (246, 250, 255)], seed=2)
puffy_cloud(cv, 212, 72, 30, 10, [(120, 150, 210), (170, 196, 236), (214, 230, 250), (246, 250, 255)], seed=5)
puffy_cloud(cv, 206, 160, 40, 12, [(140, 166, 216), (184, 206, 240), (224, 236, 252), (250, 252, 255)], seed=7)
# ---------------------------------------------------------------- Ferne Hügel
hills(cv, 214, 5, [(60, 120, 120), (84, 150, 130), (110, 176, 140)], freq=0.04, seed=1)
# ---------------------------------------------------------------- Sonnenblumen (hinter der Mauer)
SF_PETAL = [(150, 80, 0), (214, 136, 10), (250, 190, 30), (255, 226, 90), (255, 246, 170)]
SF_SEED = [(40, 20, 8), (70, 38, 14), (104, 60, 22), (140, 88, 34)]
LEAF = [(14, 48, 20), (26, 86, 30), (44, 124, 40), (76, 162, 56), (130, 200, 90)]
def sunflower(cx, cy, r, tilt=0.0, stem_to=240):
    # Stängel + Blätter
    f = Fig(W, H)
    f.curve([(cx, cy + r * 0.6), (cx + tilt * 6, cy + (stem_to - cy) * 0.5), (cx + tilt * 2, stem_to)], 'g', w=3)
    for (ly, side) in [(cy + (stem_to - cy) * 0.45, -1), (cy + (stem_to - cy) * 0.7, 1)]:
        lx = cx + tilt * 5
        f.poly([(lx, ly), (lx + side * 9, ly - 6), (lx + side * 15, ly - 2), (lx + side * 8, ly + 3)], 'l')
    f.outline()
    cv.paste(f.render({'g': mat(LEAF, pillow=1.5, k=1.2), 'l': mat(LEAF, pillow=2, k=1.4, bias=0.05)}), 0, 0)
    # Blütenblätter
    for i in range(18):
        a = i * math.pi * 2 / 18 + (0.17 if i % 2 else 0)
        rr = r * (1.0 if i % 2 == 0 else 0.86)
        for s in np.linspace(r * 0.45, rr, 20):
            hw = 2.4 * math.sin(math.pi * (s - r * 0.45) / (rr - r * 0.45 + 0.01)) + 0.4
            for t in np.linspace(-hw, hw, 6):
                x = cx + math.cos(a) * s - math.sin(a) * t; y = cy + (math.sin(a) * s + math.cos(a) * t) * 0.92
                v = 0.85 - 0.35 * (s / rr) - 0.25 * math.sin(a) - 0.12 * abs(t) / (hw + 0.01)
                px(cv, x, y, rampc(SF_PETAL, v, x, y))
    # Samenscheibe mit Spiralmuster
    rs = r * 0.48
    for y in range(int(cy - rs) - 1, int(cy + rs) + 2):
        for x in range(int(cx - rs) - 1, int(cx + rs) + 2):
            d = math.hypot(x - cx, (y - cy) / 0.92)
            if d <= rs:
                spiral = (math.atan2(y - cy, x - cx) * 3 + d * 0.9) % 2 < 1
                v = 0.55 - 0.3 * (y - cy) / rs - 0.2 * (x - cx) / rs + (0.15 if spiral else -0.1)
                px(cv, x, y, rampc(SF_SEED, v, x, y))
            elif d <= rs + 1:
                px(cv, x, y, SF_SEED[0])
for (x, y, r, t) in [(30, 198, 11, 0.3), (52, 184, 13, -0.2), (76, 204, 10, 0.2), (176, 206, 10, -0.2), (200, 186, 13, 0.2), (222, 200, 11, -0.3)]:
    sunflower(x, y, r, t)
# ---------------------------------------------------------------- Steinmauer
WALL = [(70, 48, 44), (110, 80, 64), (150, 116, 90), (190, 156, 120), (222, 194, 156), (246, 228, 196)]
WY0, WY1 = 222, 258
Hw = np.zeros((H, W), np.float32); Mw = np.zeros((H, W), bool)
for y in range(WY0, WY1):
    row = (y - WY0) // 9
    off = 0 if row % 2 == 0 else 11
    for x in range(AX0, AX1):
        Mw[y, x] = True
        by = (y - WY0) % 9; bx = (x + off) % 22
        e = min(by, 8 - by, bx, 21 - bx)
        Hw[y, x] = min(e, 3) * 0.7
Hw += (noise(H, W, 3, seed=11) - 0.5) * 0.9
relief(cv, Hw, np.zeros((H, W), np.int32), [WALL], Mw, k=1.4, bias=0.02)
# Mauerkrone
for x in range(AX0, AX1):
    for y in range(WY0 - 4, WY0):
        px(cv, x, y, rampc(WALL, 0.95 - (y - WY0 + 4) * 0.12, x, y))
    px(cv, x, WY0 - 5, WALL[0])
# Moos / Ranken an der Mauer
rnd = random.Random(4)
for _ in range(90):
    x = rnd.randint(AX0, AX1 - 1); y = WY0 - 1 + int(abs(rnd.gauss(0, 5)))
    px(cv, x, y, rnd.choice(LEAF[1:4]))
# ---------------------------------------------------------------- Wiese
GRASS = [(22, 70, 30), (36, 104, 38), (58, 140, 50), (92, 176, 64), (140, 206, 90)]
for y in range(WY1, AY1):
    for x in range(AX0, AX1):
        v = 0.75 - (y - WY1) / (AY1 - WY1) * 0.55 + (noise(H, W, 4, seed=12)[y, x] - 0.5) * 0.5
        px(cv, x, y, rampc(GRASS, v, x, y))
for _ in range(260):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(WY1, AY1 - 1)
    for k in range(rnd.randint(2, 4)):
        px(cv, x, y - k, GRASS[4] if k == 0 else GRASS[3])
for _ in range(40):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(WY1 + 4, AY1 - 3)
    c = rnd.choice([(255, 240, 120), (255, 255, 255), (250, 150, 60)])
    sparkle(cv, x, y, c, r=1, c2=lerp(c, GRASS[2], 0.4))
# Schatten der Mauer auf der Wiese
for y in range(WY1, WY1 + 5):
    for x in range(AX0, AX1):
        if BAYER4[y % 4, x % 4] < (1 - (y - WY1) / 5) * 0.8:
            blend_px(cv, x, y, (10, 30, 20), 0.35)

# ---------------------------------------------------------------- Taio
HAIR = [(40, 6, 10), (78, 14, 18), (120, 26, 26), (160, 48, 36), (196, 84, 56)]
TUNIC = [(26, 30, 12), (48, 56, 22), (74, 84, 34), (104, 114, 50), (140, 148, 76)]
PANTS = [(26, 28, 36), (48, 52, 64), (76, 80, 96), (108, 112, 130), (146, 150, 168)]
BOOT = [(30, 16, 10), (60, 34, 18), (94, 56, 30), (132, 84, 46), (170, 120, 70)]
LEATHER = [(40, 22, 12), (76, 44, 22), (112, 70, 36), (150, 102, 56)]
TEAL = [(10, 40, 50), (20, 84, 96), (40, 140, 150), (90, 200, 200), (180, 250, 240)]
BANNER = [(70, 6, 12), (130, 16, 24), (190, 36, 36), (232, 70, 56), (255, 130, 100)]
WOOD = [(40, 22, 10), (80, 48, 22), (124, 80, 40), (166, 116, 64)]

f = Fig(W, H)
# ---- Banner (hinter der Figur): Stange links, Tuch weht nach links
PX0 = 84
f.part('pole')
f.rect(PX0 - 1, 108, PX0 + 1, 296, 'o')
f.ellipse(PX0, 105, 3.5, 3.5, 'g')
f.part('banner')
pts = []
for i in range(31):
    t = i / 30
    pts.append((PX0 - 2 - t * 60, 112 + t * 6 + math.sin(t * 7) * 4))
for i in range(30, -1, -1):
    t = i / 30
    pts.append((PX0 - 2 - t * 60, 146 + t * 14 + math.sin(t * 7 + 0.6) * 5 - (6 if t > 0.92 else 0)))
f.poly(pts, 'r')
f.poly([(PX0 - 64, 118), (PX0 - 48, 138), (PX0 - 64, 158)], '.', only='r')     # Schwalbenschwanz
# ---- Flammen des Sonnenschwerts (hinter der Klinge)
ang = math.radians(-76)
ux, uy = math.cos(ang), math.sin(ang)
gx, gy = 170, 160                    # Faust
g0x, g0y = gx + ux * 11, gy + uy * 11   # Parierstange
BL = 84
bx1, by1 = g0x + ux * BL, g0y + uy * BL
f.part('flame', line=False)
for i in range(9):
    s0 = 8 + i * 9
    for side in (-1, 1):
        wob = math.sin(i * 1.7 + side) * 2
        bxs, bys = g0x + ux * s0, g0y + uy * s0
        w0 = 9 - i * 0.6
        tip = (bxs + ux * 22 + (-uy) * side * (w0 + 4 + wob), bys + uy * 22 + ux * side * (w0 + 4 + wob))
        f.poly([(bxs + (-uy) * side * 3, bys + ux * side * 3),
                (bxs + (-uy) * side * w0 + ux * 6, bys + ux * side * w0 + uy * 6), tip,
                (bxs + ux * 14 + (-uy) * side * 3, bys + uy * 14 + ux * side * 3)], 'f')
f.limb(g0x, g0y, bx1 + ux * 12, by1 + uy * 12, 7, 2, 'f')
# ---- Beine + Stiefel
f.part('legL'); f.limb(117, 248, 108, 284, 7.5, 6, 'p')
f.part('legR'); f.limb(133, 248, 144, 284, 7.5, 6, 'p')
f.part('bootL')
f.poly([(99, 280), (117, 280), (118, 297), (94, 297), (95, 289)], 'b')
f.rect(98, 279, 118, 283, 'b')
f.part('bootR')
f.poly([(135, 280), (153, 280), (158, 289), (159, 297), (134, 297)], 'b')
f.rect(134, 279, 154, 283, 'b')
f.part('cuffs'); f.rect(98, 279, 118, 282, 'L'); f.rect(134, 279, 154, 282, 'L')
# ---- Oberkörper + Tunika-Rock
f.part('body')
f.poly([(103, 204), (147, 204), (144, 222), (141, 238), (109, 238), (106, 222)], 't')
f.poly([(108, 234), (142, 234), (152, 258), (138, 262), (125, 259), (112, 262), (98, 258)], 't')
f.part('collar')
f.poly([(117, 202), (133, 202), (125, 216)], 's')
f.part('scarf')                       # kurzer Umhang/Schulterkragen
f.poly([(101, 204), (112, 199), (125, 206), (138, 199), (149, 204), (147, 214), (138, 211), (125, 218), (112, 211), (103, 214)], 'c')
f.part('belt')
f.rect(107, 235, 143, 240, 'L')
f.part('buckle'); f.rect(121, 233, 129, 242, 'g')
# ---- linker Arm (Banner)
f.part('armL'); f.limb(106, 209, 94, 226, 7, 6, 't')
f.part('forearmL'); f.limb(94, 226, 87, 206, 5, 4.5, 'L')
f.part('fistL'); f.ellipse(86, 201, 5.5, 5, 's')
f.part('pole2'); f.rect(PX0 - 1, 193, PX0 + 1, 197, 'o')
# ---- rechter Arm (Schwert)
f.part('armR'); f.limb(144, 209, 161, 192, 7, 6, 't')
f.part('forearmR'); f.limb(161, 192, 168, 168, 5, 4.5, 'L')
# Schwertgriff hinter der Faust
f.part('grip'); f.limb(gx - ux * 9, gy - uy * 9, gx + ux * 10, gy + uy * 10, 2.4, 2.4, 'e')
f.part('pommel'); f.ellipse(gx - ux * 11, gy - uy * 11, 3.2, 3.2, 'g')
f.part('fistR'); f.ellipse(gx, gy, 6, 5.5, 's')
# Parierstange: geschwungen wie Sonnenstrahlen
f.part('guard')
nx_, ny_ = -uy, ux
f.curve([(g0x - nx_ * 16 - ux * 4, g0y - ny_ * 16 - uy * 4), (g0x - nx_ * 8, g0y - ny_ * 8), (g0x, g0y),
         (g0x + nx_ * 8, g0y + ny_ * 8), (g0x + nx_ * 16 - ux * 4, g0y + ny_ * 16 - uy * 4)], 'g', w=4, w1=4)
f.ellipse(g0x, g0y, 6, 6, 'g')
# Klinge
f.part('blade')
f.limb(g0x + ux * 4, g0y + uy * 4, bx1, by1, 4.6, 0.8, 'w')
# ---- Kopf
f.part('neck'); f.rect(119, 190, 131, 204, 's')
f.part('hairback')          # Mähne hinter dem Kopf, fällt bis auf die Schultern
cx, cy = 125, 176
mane = []
for i in range(13):
    a = math.radians(150 + i * (240 / 12))
    rr = 27 + (4 if i % 2 == 0 else -1) + (2 if 4 <= i <= 8 else 0)
    mane.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    a2 = math.radians(150 + (i + 0.5) * (240 / 12))
    if i < 12:
        mane.append((cx + math.cos(a2) * 20, cy + math.sin(a2) * 20))
f.poly([(cx - 18, 214), (cx - 26, 206), (cx - 28, 196)] + mane + [(cx + 28, 196), (cx + 26, 206), (cx + 18, 214), (cx + 10, 200), (cx - 10, 200)], 'h')
f.part('face')
f.poly([(110, 176), (140, 176), (139, 190), (132, 199), (125, 201), (118, 199), (111, 190)], 's')
f.ellipse(125, 178, 15, 14, 's')
f.part('ears'); f.ellipse(109, 185, 2.5, 4, 's'); f.ellipse(141, 185, 2.5, 4, 's')
f.part('bangs')             # Pony: breite Strähnen bis knapp über die Augen
f.poly([(108, 180), (110, 166), (118, 160), (125, 158), (132, 160), (140, 166), (142, 180),
        (138, 172), (136, 179), (132, 170), (129, 177), (125, 168), (121, 177), (118, 170), (114, 179), (112, 172)], 'h')
f.part('lockL'); f.poly([(109, 172), (104, 190), (106, 204), (110, 190), (112, 180)], 'h')
f.part('lockR'); f.poly([(141, 172), (146, 190), (144, 204), (140, 190), (138, 180)], 'h')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.08),
    'h': mat(HAIR, pillow=4, k=1.8, noise=0.9, nscale=2),
    't': mat(TUNIC, pillow=4, k=1.4, folds=(0.3, 0.05, 0.6)),
    'c': mat(TUNIC, pillow=2, k=1.6, bias=0.1),
    'p': mat(PANTS, pillow=3, k=1.4, folds=(0.05, 0.4, 0.5)),
    'b': mat(BOOT, pillow=2.5, k=1.5, spec=True, spec_col=(210, 160, 110)),
    'L': mat(LEATHER, pillow=1.5, k=1.2),
    'g': mat(GOLD, pillow=2, k=1.8, spec=True, spec_col=(255, 255, 230)),
    'e': mat(TEAL, pillow=2, k=1.4),
    'w': mat(SILVER, pillow=2, k=2.2, spec=True),
    'r': mat(BANNER, pillow=5, k=1.5, folds=(0.25, -0.12, 1.3)),
    'o': mat(WOOD, pillow=1.5, k=1.2),
    'f': mat(FIRE, pillow=3, k=1.2, bias=0.25, noise=1.2, nscale=2),
}
glow(cv, 125, 210, 70, (255, 200, 90), k=0.35, mix=0.3)
fig = f.render(MATS)
cv.paste(fig, 0, 0)

# ---------------------------------------------------------------- Details in voller Auflösung
EYE = (150, 50, 24)
anime_eye(cv, 114, 180, EYE, h=7, w=5)
anime_eye(cv, 131, 180, EYE, h=7, w=5, flip=True)
for x in range(113, 120): px(cv, x, 177, HAIR[1])      # Brauen
for x in range(131, 138): px(cv, x, 177, HAIR[1])
px(cv, 125, 189, SKIN[2]); px(cv, 126, 190, SKIN[1])   # Nase
for x in range(121, 130): px(cv, x, 194, (96, 26, 26))  # grinsender Mund
for x in range(122, 129): px(cv, x, 195, (230, 236, 240))
for x in range(123, 128): px(cv, x, 196, (190, 60, 56))
px(cv, 120, 193, (96, 26, 26)); px(cv, 130, 193, (96, 26, 26))
blush(cv, 113, 190); blush(cv, 134, 190)
# Finger an beiden Fäusten
for (fx, fy) in [(83, 199), (83, 202), (83, 205)]:
    px(cv, fx, fy, SKIN[1]); px(cv, fx + 1, fy, SKIN[1])
for (fx, fy) in [(173, 158), (173, 161), (173, 164)]:
    px(cv, fx, fy, SKIN[1]); px(cv, fx - 1, fy, SKIN[1])
# Sonnenmedaillon auf dem Kragen
sparkle(cv, 125, 222, GOLD[4], r=2, c2=GOLD[2]); px(cv, 125, 222, (255, 255, 230))
# Glanzlinie auf der Klinge + Stern an der Spitze
for s in range(8, BL - 6):
    x = g0x + ux * s + uy * 1.4; y = g0y + uy * s - ux * 1.4
    if s % 10 < 7:
        px(cv, x, y, (255, 255, 255))
sparkle(cv, bx1 + ux * 6, by1 + uy * 6, (255, 255, 230), r=5, c2=(255, 200, 90))
# Rubin im Parierstangen-Zentrum
for (dx, dy, c) in [(0, 0, RUBY[2]), (-1, 0, RUBY[3]), (-1, -1, RUBY[4]), (1, 0, RUBY[1]), (0, 1, RUBY[1]), (0, -1, RUBY[3])]:
    px(cv, g0x + dx, g0y + dy, c)
# Sonnenmotiv auf dem Banner
BX, BY = 52, 136
for y in range(BY - 8, BY + 9):
    for x in range(BX - 8, BX + 9):
        d = math.hypot(x - BX, y - BY)
        a = math.atan2(y - BY, x - BX)
        if d <= 3.8 or (d <= 7.5 and abs(math.sin(a * 4)) > 0.82):
            if fig[y, x, 3] and tuple(cv.a[y, x]) != OUT:
                px(cv, x, y, GOLD[4] if d <= 2 else GOLD[3] if y < BY else GOLD[2])
# Saum der Tunika: helle Steppnaht knapp über der Unterkante des Rocks
TM = (f.L == 't')
for x in range(96, 156):
    ys = np.where(TM[240:, x])[0]
    if len(ys) and x % 3 != 0:
        px(cv, x, 240 + ys.max() - 2, TUNIC[4])
# Kniefalten
for (kx, ky) in [(112, 266), (140, 266)]:
    px(cv, kx, ky, PANTS[1]); px(cv, kx + 1, ky + 1, PANTS[1]); px(cv, kx - 1, ky - 1, PANTS[3])
# Funken
for (x, y) in [(60, 176), (98, 150), (206, 122), (150, 140), (208, 238), (40, 238), (196, 96)]:
    sparkle(cv, x, y, (255, 250, 210), r=2, c2=(255, 190, 80))

finish(cv, 'XIX', 'TAIO', out='19_sun_taio', emblem=emblem_sun)
print('ok')
