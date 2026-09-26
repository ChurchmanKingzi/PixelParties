# -*- coding: utf-8 -*-
# VI – Die Liebenden: Cute Angel Molinda
# Molinda schwebt als Amor mit Flügeln, goldenem Bogen und Herzpfeil über den beiden Liebenden;
# hinter ihr strahlt eine Herz-Sonne (das große rosa Herz ihrer Karte). Links der Apfelbaum mit
# (niedlicher) Schlange, rechts der Baum mit Flammenblättern, in der Mitte der Berg. Unten halten
# sich Cute Bunny und Cute Cat an den Pfoten, umgeben von Herzchen.
from tarot_iv_vii_helpers import *

cv = new_card()
rnd = random.Random(66)

# ---------------------------------------------------------------- Himmel
sky(cv, [(40, 70, 190), (64, 110, 220), (120, 150, 236), (200, 170, 230), (250, 196, 214), (255, 226, 214)], y1=240)
stars(cv, 24, y1=120, seed=6, cols=[(255, 255, 255), (255, 220, 240), (220, 230, 255)], big=0.2)
# Herz-Sonne mit Strahlen
HX, HY0, HS = 125, 104, 50
yy, xx = np.indices((H, W))
Xn = (xx - HX) / HS; Yn = -(yy - HY0) / HS
heart = (Xn ** 2 + Yn ** 2 - 1) ** 3 - Xn ** 2 * Yn ** 3 <= 0
rays(cv, HX, HY0 - 8, 20, 50, 160, (255, 236, 200), width=0.11, k=0.6, mix=0.4)
glow(cv, HX, HY0 - 6, 84, (255, 214, 226), k=0.55, mix=0.35)
HEART = [(170, 40, 90), (214, 70, 120), (240, 110, 150), (252, 160, 186), (255, 206, 220), (255, 240, 246)]
dist = cv2.distanceTransform(heart.astype(np.uint8), cv2.DIST_L2, 3)
Hh = np.sqrt(np.minimum(dist, 18) / 18) * 5 + (noise(H, W, 4, seed=61) - 0.5) * 0.3
relief(cv, Hh, np.zeros((H, W), np.int32), [HEART], heart & (yy >= AY0), k=1.4, bias=0.12)
edge = heart & ~(cv2.erode(heart.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
for y, x in zip(*np.where(edge)):
    if in_art(x, y):
        px(cv, x, y, (200, 50, 100))
# Herzchen verteilt am Himmel


def small_heart(x, y, c=(250, 90, 130), c2=(255, 190, 210), s=1):
    rows = [".#.#.", "#####", "#####", ".###.", "..#.."] if s == 1 else ["..#.#..", ".#####.", "#######", "#######", ".#####.", "..###..", "...#..."]
    rows = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."] if s == 2 else rows
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '#':
                px(cv, x + i, y + j, c2 if (j == 1 and i in (1, 2)) or (j == 0) else c)


for (x, y, s) in [(30, 60, 1), (206, 54, 1), (50, 96, 2), (194, 90, 2), (24, 130, 1), (222, 126, 1), (70, 60, 1), (178, 66, 1)]:
    small_heart(x, y, s=s)

# ---------------------------------------------------------------- Berg in der Mitte + Wolken
MTN = [(90, 70, 130), (120, 96, 160), (156, 128, 190), (196, 166, 214), (228, 204, 236), (250, 238, 250)]
peak_range(cv, [(125, 150, 62, 1.6), (90, 196, 30, 1.8), (164, 190, 34, 1.8)], 250, MTN, seed=11, k=1.3, bias=0.08, striate=0.6)
# Schneekappe
for y in range(150, 172):
    for x in range(100, 151):
        t = (y - 150) / 22
        hw = 62 * t ** (1 / 1.6)
        if abs(x - 125) < hw - 1 and y < 160 + 4 * math.sin(x * 0.7) + 3 * math.sin(x * 0.23):
            px(cv, x, y, rampc([(200, 190, 230), (236, 232, 250), (255, 255, 255)], 0.8 - (x - 110) / 60, x, y))
mist(cv, 196, 240, (255, 220, 230), mix=0.45, k=0.9, seed=12)
CLOUDP = [(200, 150, 200), (234, 196, 226), (250, 226, 240), (255, 244, 250), (255, 255, 255)]
for (cx, cy, w, h, sd) in [(40, 176, 46, 11, 1), (212, 170, 44, 10, 2), (125, 190, 120, 14, 3), (70, 200, 60, 12, 4), (184, 204, 60, 12, 5)]:
    puffy_cloud(cv, cx, cy, w, h, CLOUDP, seed=sd)

# ---------------------------------------------------------------- Wiese
GRASS = [(22, 80, 50), (36, 116, 60), (60, 156, 72), (104, 196, 96), (160, 226, 130)]
tops = hills(cv, 236, 4, GRASS, freq=0.05, seed=2)
NZ = noise(H, W, 4, seed=63)
for x in range(AX0, AX1):
    for y in range(tops[x], AY1):
        v = 0.8 - (y - tops[x]) / (AY1 - tops[x] + 1) * 0.5 + (NZ[y, x] - 0.5) * 0.5
        px(cv, x, y, rampc(GRASS, v, x, y))
for _ in range(260):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(240, AY1 - 1)
    for k in range(rnd.randint(2, 4)):
        px(cv, x, y - k, GRASS[4] if k == 0 else GRASS[3])
for _ in range(46):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(246, AY1 - 3)
    c = rnd.choice([(255, 150, 190), (255, 255, 255), (255, 220, 120), (240, 110, 150)])
    sparkle(cv, x, y, c, r=1, c2=lerp(c, GRASS[2], 0.4))
    px(cv, x, y, (255, 240, 150))

# ---------------------------------------------------------------- Apfelbaum (links) mit Schlange
BARK = [(40, 22, 16), (74, 44, 28), (110, 70, 42), (146, 100, 62), (180, 136, 90)]
LEAF = [(14, 60, 36), (24, 96, 46), (44, 136, 58), (84, 176, 76), (140, 214, 110)]
APPLE = [(90, 6, 16), (160, 16, 30), (220, 40, 50), (250, 110, 100), (255, 200, 190)]


def apple_tree(f):
    f.part('trunk')
    f.poly([(32, 268), (48, 268), (46, 240), (47, 210), (52, 186), (44, 186), (38, 212), (35, 240)], 't')
    f.limb(44, 196, 60, 176, 3, 2, 't'); f.limb(42, 204, 26, 184, 3, 2, 't')
    f.part('roots'); f.poly([(26, 270), (54, 270), (48, 264), (32, 264)], 't')
    for i, (cx, cy, r) in enumerate([(22, 170, 14), (44, 156, 18), (66, 168, 14), (30, 146, 14), (58, 144, 14),
                                      (44, 136, 14), (20, 190, 10), (68, 188, 10), (44, 176, 14)]):
        f.part('leaf%d' % i); f.ellipse(cx, cy, r, r * 0.9, 'l')


ft, tr = fig_draw(cv, apple_tree, {'t': mat(BARK, pillow=2.5, k=1.4, noise=0.8, nscale=1),
                                   'l': mat(LEAF, pillow=6, k=1.5, noise=1.2, nscale=2, bias=0.05)})
# Äpfel
for (x, y) in [(18, 160), (36, 150), (56, 158), (66, 176), (28, 180), (48, 172), (40, 132), (62, 136), (14, 190), (72, 190)]:
    for j in range(-3, 4):
        for i in range(-3, 4):
            if i * i + j * j <= 10:
                v = 0.7 - 0.12 * i - 0.12 * j
                px(cv, x + i, y + j, rampc(APPLE, v, x + i, y + j))
    px(cv, x - 1, y - 2, (255, 230, 220)); px(cv, x, y - 4, BARK[1]); px(cv, x + 1, y - 4, LEAF[3])
    px(cv, x - 3, y + 1, APPLE[0]) if False else None
# Blattadern / Glanz
for _ in range(80):
    x = rnd.randint(8, 82); y = rnd.randint(124, 200)
    if tr[y, x, 3] and ft.L[y, x] == 'l' and tuple(cv.a[y, x]) != OUT:
        px(cv, x, y, LEAF[4] if rnd.random() < 0.5 else LEAF[1])
# Schlange (niedlich, grün mit rosa Bauch) um den Stamm
SNAKE = [(20, 70, 40), (40, 120, 60), (80, 170, 80), (140, 214, 110), (200, 240, 170)]


def snake(f):
    f.part('coil1'); f.curve([(30, 250), (40, 246), (50, 242), (54, 236)], 'n', w=5)
    f.part('coil2'); f.curve([(54, 236), (44, 230), (34, 226), (32, 220), (40, 214), (50, 212)], 'n', w=5)
    f.part('coil3'); f.curve([(50, 212), (56, 206), (60, 198), (66, 194)], 'n', w=4.6)
    f.part('shead'); f.ellipse(70, 192, 5.5, 4.5, 'n')


fs, sn = fig_draw(cv, snake, {'n': mat(SNAKE, pillow=2.5, k=1.5, spec=True)})
for (x, y) in [(34, 249), (44, 245), (50, 229), (38, 218), (58, 203)]:
    px(cv, x, y, (250, 150, 180)); px(cv, x + 1, y, (250, 180, 200))
px(cv, 71, 190, OUT); px(cv, 72, 190, OUT); px(cv, 71, 189, (255, 255, 255))   # Auge
blush(cv, 70, 193, (250, 120, 150))
px(cv, 76, 193, (230, 40, 70)); px(cv, 77, 192, (230, 40, 70)); px(cv, 77, 194, (230, 40, 70))  # Zunge

# ---------------------------------------------------------------- Flammenbaum (rechts)


FLAMES = [(206, 132), (190, 142), (222, 142), (180, 160), (206, 152), (232, 160), (192, 172), (220, 174),
          (178, 186), (234, 188), (202, 184), (216, 190)]


def flame_pts(cx, cy, w, h, wob):
    """Flammenzunge: breiter runder Fuß, geschwungene Spitze"""
    L, Rr = [], []
    for k_ in range(15):
        t = k_ / 14
        hw = w * math.sin(math.pi * (0.5 + 0.5 * t)) ** 0.8 * (1 - t * 0.15)
        x0 = cx + wob * math.sin(t * 2.6) * t
        y0 = cy - t * h
        L.append((x0 - hw, y0)); Rr.append((x0 + hw, y0))
    bottom = [(cx + w * math.cos(a), cy + w * 0.7 * math.sin(a)) for a in np.linspace(0, math.pi, 8)]
    return L + [(cx + wob * math.sin(2.6) * 1.05, cy - h * 1.08)] + Rr[::-1] + bottom


def flame_tree(f):
    f.part('trunk')
    f.poly([(202, 268), (218, 268), (215, 240), (214, 212), (208, 190), (204, 190), (206, 214), (204, 240)], 't')
    f.limb(209, 204, 194, 186, 3, 2, 't'); f.limb(212, 208, 226, 190, 3, 2, 't')
    f.part('roots'); f.poly([(196, 270), (224, 270), (218, 264), (202, 264)], 't')
    # zwölf Flammenblätter im Kranz
    for i, (cx, cy) in enumerate(FLAMES):
        h = 18 + (i % 3) * 3
        wob = 3.5 * math.sin(i * 1.7 + 0.5)
        f.part('fl%d' % i)
        f.poly(flame_pts(cx, cy, 7.5, h, wob), 'f')
        f.part('flc%d' % i, line=False)
        f.poly(flame_pts(cx, cy + 2, 3.8, h * 0.6, wob * 0.6), 'F')


fft, ftr = fig_draw(cv, flame_tree, {'t': mat(BARK, pillow=2.5, k=1.4, noise=0.8, nscale=1),
                                     'f': mat(FIRE[:5], pillow=4, k=1.3, bias=0.05, noise=0.6, nscale=2),
                                     'F': mat(FIRE[3:], pillow=2, k=1.0, bias=0.2)})
glow(cv, 206, 162, 40, (255, 190, 90), k=0.3, mix=0.3)

# ---------------------------------------------------------------- Molinda
HAIR = [(6, 6, 12), (18, 18, 28), (34, 34, 50), (60, 60, 84), (104, 104, 140)]
DRESS = [(30, 70, 130), (50, 110, 180), (90, 160, 226), (150, 206, 246), (210, 238, 255)]
WHITE = [(120, 120, 170), (170, 172, 210), (214, 216, 240), (240, 242, 252), (255, 255, 255)]
PRIM = [(56, 36, 110), (94, 70, 170), (140, 120, 216), (186, 176, 242), (226, 224, 255)]
COV = [(110, 100, 170), (160, 156, 214), (206, 204, 242), (236, 236, 252), (255, 255, 255)]
BOOT = [(20, 12, 12), (44, 28, 24), (72, 48, 38), (104, 74, 58)]
PINK = [(150, 30, 80), (210, 60, 120), (246, 110, 160), (255, 170, 204), (255, 226, 238)]
MY = 84           # Kopfmitte


WO, WC, WR = (64, 72), (88, 74), (113, 104)     # Handgelenk des Flügels, Kontrollpunkt, Schulter


def wing_P(t):
    """Flügelbug vom Handgelenk (t=0) zur Schulter (t=1)"""
    return ((1 - t) ** 2 * WO[0] + 2 * (1 - t) * t * WC[0] + t * t * WR[0],
            (1 - t) ** 2 * WO[1] + 2 * (1 - t) * t * WC[1] + t * t * WR[1])


def wing_feathers():
    """(Lage, Material, Start, Ende, r0, r1) für den linken Flügel – von hinten nach vorn.
    Lage 0: Handschwingen (fächern vom Handgelenk nach oben/außen), 1: Armschwingen (hängen nach unten),
    2: große Deckfedern, 3: Handdecken"""
    out = []
    wx, wy = wing_P(0)
    for i in range(7):
        a = math.radians(128 + i * 11)
        L = 22 + i * 1.7
        sx, sy = wx + i * 0.8, wy + i * 0.8
        out.append((0, 'p', (sx, sy), (sx + math.cos(a) * L, sy - math.sin(a) * L), 4.0, 3.2))
    for i in range(8):
        t = 0.08 + i / 7 * 0.8
        sx, sy = wing_P(t)
        a = math.radians(205 + t * 58)
        L = 30 - 12 * t
        out.append((1, 'x', (sx, sy), (sx + math.cos(a) * L, sy - math.sin(a) * L), 4.4, 3.6))
    for i in range(8):
        t = 0.08 + i / 7 * 0.8
        sx, sy = wing_P(t)
        a = math.radians(205 + t * 58)
        L = (30 - 12 * t) * 0.5
        out.append((2, 'c', (sx, sy), (sx + math.cos(a) * L, sy - math.sin(a) * L), 5.0, 4.4))
    for i in range(7):
        a = math.radians(128 + i * 11)
        L = (22 + i * 1.7) * 0.42
        sx, sy = wx + i * 0.8, wy + i * 0.8
        out.append((3, 'c', (sx, sy), (sx + math.cos(a) * L, sy - math.sin(a) * L), 4.6, 4.0))
    return out


def wing(f, side):
    """Engelsflügel in Lagen: Hand- und Armschwingen, Deckfedern, kleine Deckfedern, Flügelbug"""
    X = (lambda x: x) if side < 0 else (lambda x: 250 - x)
    for j, (layer, key, (sx, sy), (ex, ey), r0, r1) in enumerate(wing_feathers()):
        f.part('w%d_%d' % (side, j))
        f.limb(X(sx), sy, X(ex), ey, r0, r1, key)
    # kleine Deckfedern: schuppenartige Reihen entlang des Flügelbugs
    k_ = 0
    for row, (off, rr) in enumerate([(5, 3.4), (2, 3.2)]):
        for t in np.linspace(0.05 + row * 0.05, 0.92, 8 - row):
            x, y = wing_P(t)
            f.part('lc%d_%d' % (side, k_)); k_ += 1
            f.ellipse(X(x - off * 0.5), y + off, rr, rr * 0.9, 'z')
    f.part('warm%d' % side)
    pts = [wing_P(t) for t in np.linspace(0, 1, 14)]
    f.curve([(X(x), y) for (x, y) in pts], 'z', w=7, w1=9)


def molinda(f):
    wing(f, -1); wing(f, 1)
    # Haare hinten (lang, wellig bis zur Hüfte)
    f.part('hairback')
    f.poly([(106, 70), (144, 70), (152, 96), (156, 120), (152, 136), (146, 130), (140, 140), (134, 128), (125, 120),
            (116, 128), (110, 140), (104, 130), (98, 136), (94, 120), (98, 96)], 'h')
    # Beine + Stiefel
    f.part('legL'); f.limb(118, 148, 114, 166, 4, 3.4, 'W')
    f.part('legR'); f.limb(132, 148, 140, 162, 4, 3.4, 'W')
    f.part('bootL'); f.poly([(110, 162), (118, 162), (118, 172), (113, 174), (109, 170)], 'B')
    f.part('bootR'); f.poly([(136, 158), (144, 157), (147, 166), (143, 169), (137, 166)], 'B')
    # Kleid: Rock mit weißem Rüschensaum, Mieder
    f.part('skirt'); f.poly([(112, 120), (138, 120), (152, 146), (125, 150), (98, 146)], 'D')
    f.part('frill')
    for i in range(7):
        x = 100 + i * 8.3
        f.ellipse(x, 147 + (1 if i in (0, 6) else 2) - abs(3 - i) * 0.3, 5, 3.2, 'w')
    f.part('apron'); f.poly([(117, 122), (133, 122), (137, 141), (113, 141)], 'w')
    f.part('bodice'); f.poly([(114, 102), (136, 102), (138, 122), (112, 122)], 'D')
    f.part('corset'); f.poly([(115, 116), (135, 116), (136, 122), (114, 122)], 'k')
    f.part('waistbow'); f.ellipse(121, 119, 3.5, 2.6, 'P'); f.ellipse(129, 119, 3.5, 2.6, 'P'); f.ellipse(125, 119, 1.8, 1.8, 'P')
    f.part('collar'); f.ellipse(119, 103, 6, 3, 'w'); f.ellipse(131, 103, 6, 3, 'w')
    f.part('brooch'); f.ellipse(125, 106, 2.6, 2.4, 'P')
    # Arme: links (Bildseite) hält den Bogen, rechts den Herzpfeil
    f.part('armL'); f.limb(114, 107, 94, 118, 4, 3.2, 's')
    f.part('sleeveL'); f.ellipse(112, 107, 6, 5, 'D')
    f.part('armR'); f.limb(136, 107, 154, 101, 4, 3.2, 's')
    f.part('sleeveR'); f.ellipse(138, 107, 6, 5, 'D')
    # Bogen (gold) mit Sehne
    f.part('bow'); f.curve([(94, 86), (86, 98), (83, 118), (86, 138), (94, 150)], 'g', w=3.4, w1=3.4)
    f.part('bowtips'); f.ellipse(94, 86, 2.5, 2.5, 'P'); f.ellipse(94, 150, 2.5, 2.5, 'P')
    f.part('handL'); f.ellipse(88, 119, 3.8, 3.6, 's')
    # Herzpfeil (Engelsfeder-Befiederung)
    f.part('shaft'); f.line(148, 112, 180, 72, 'a', w=2)
    f.part('fletch')
    for k_ in range(3):
        bx_, by_ = 148 + k_ * 2.4, 112 - k_ * 3.2
        f.poly([(bx_, by_), (bx_ - 7, by_ + 1), (bx_ - 9, by_ + 6), (bx_ - 3, by_ + 4)], 'c')
        f.poly([(bx_, by_), (bx_ + 3, by_ + 6), (bx_ + 1, by_ + 11), (bx_ - 2, by_ + 5)], 'c')
    f.part('tip')
    hx, hy = 182, 68
    f.ellipse(hx - 3, hy - 1, 3.6, 3.6, 'P'); f.ellipse(hx + 2.5, hy + 2.5, 3.6, 3.6, 'P')
    f.poly([(hx - 6.4, hy + 0.5), (hx + 2, hy + 5.8), (hx + 5, hy - 5), (hx - 1, hy - 4)], 'P')
    f.part('handR'); f.ellipse(156, 100, 3.8, 3.6, 's')
    # Kopf
    f.part('neck'); f.rect(121, 96, 129, 104, 's')
    f.part('face')
    f.ellipse(125, MY, 16, 14.5, 's')
    f.poly([(109, MY), (141, MY), (138, MY + 10), (132, MY + 15), (125, MY + 17), (118, MY + 15), (112, MY + 10)], 's')
    f.part('bangs')
    f.poly([(108, MY + 8), (108, MY - 8), (114, MY - 14), (125, MY - 16), (136, MY - 14), (142, MY - 8), (142, MY + 8),
            (139, MY - 1), (137, MY + 3), (134, MY - 4), (130, MY + 1), (126, MY - 6), (121, MY + 1), (117, MY - 4),
            (114, MY + 3), (111, MY - 1)], 'h')
    f.part('locks')
    f.poly([(108, MY - 6), (102, MY + 10), (104, MY + 30), (109, MY + 20), (111, MY + 6)], 'h', mirror=True)
    f.part('ahoge'); f.curve([(124, MY - 15), (122, MY - 21), (126, MY - 25), (130, MY - 23)], 'h', w=2.2, w1=1.2)
    # Blume im Haar (Bildseite rechts, wie auf der Karte)
    f.part('flower')
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        f.ellipse(143 + math.cos(a) * 3.2, MY - 7 + math.sin(a) * 3.2, 2.6, 2.6, 'P')
    f.part('flowerc'); f.ellipse(143, MY - 7, 1.6, 1.6, 'y')
    # Heiligenschein
    f.part('halo', line=True)
    f.ellipse(CX, MY - 22, 13, 3.6, 'y'); f.ellipse(CX, MY - 22, 9.5, 1.6, '.', only='y')


MATS = {
    's': mat(SKIN, pillow=5, k=1.0, bias=0.25),
    'h': mat(HAIR, pillow=4, k=1.9, noise=0.8, nscale=2, bias=0.1),
    'D': mat(DRESS, pillow=3.5, k=1.4, folds=(0.3, 0.05, 0.4)),
    'w': mat(WHITE, pillow=2, k=1.4, bias=0.05),
    'W': mat(WHITE, pillow=2, k=1.3, bias=0.1),
    'k': mat([(20, 14, 20), (42, 30, 36), (70, 52, 56), (100, 80, 84)], pillow=2, k=1.3),
    'B': mat(BOOT, pillow=2, k=1.4, spec=True, spec_col=(160, 130, 120)),
    'P': mat(PINK, pillow=2.5, k=1.5, spec=True, spec_col=(255, 240, 250)),
    'g': mat(GOLD7, pillow=1.5, k=1.8, spec=True),
    'y': mat(GOLD7, pillow=1.2, k=1.6, bias=0.15, spec=True),
    'a': mat(BROWN, pillow=1, k=1.2, bias=0.1),
    'p': mat(PRIM, pillow=3, k=1.4, bias=0.0),
    'x': mat([(84, 64, 150), (128, 110, 200), (170, 160, 232), (210, 206, 248), (238, 238, 255)], pillow=3, k=1.4, bias=0.03),
    'c': mat(COV, pillow=3, k=1.4, bias=0.06),
    'z': mat(COV, pillow=2.5, k=1.3, bias=0.14),
}
# Molinda wird als Materialkarte gezeichnet und vor dem Rendern um SK vergrößert
SK, SCX, SCY = 1.12, 125, 112


def T(x, y):
    return SCX + (x - SCX) * SK, SCY + (y - SCY) * SK


fm = Fig(W, H)
molinda(fm)
scale_fig(fm, SK, SCX, SCY)
fm.outline()
fm.inner_mask = fm.inner_lines()
fig = fm.render(MATS)
fig[:AY0, :, 3] = 0; fig[AY1:, :, 3] = 0; fig[:, :AX0, 3] = 0; fig[:, AX1:, 3] = 0      # nur im Bildfeld
cv.paste(fig, 0, 0)
# Bogensehne
bx_, _ = T(94, 0)
_, by0 = T(0, 88); _, by1 = T(0, 149); _, bh0 = T(0, 115); _, bh1 = T(0, 123)
for y in range(int(by0), int(by1) + 1):
    if not (bh0 <= y <= bh1):
        px(cv, bx_, y, (255, 250, 240))
# Gesicht: helle Haut neu verlaufen lassen (Schatten unter dem Pony)
SKL = [(214, 136, 110), (240, 176, 146), (252, 208, 180), (255, 226, 204), (255, 242, 228)]
fx0, fy0 = T(104, MY - 17); fx1, fy1 = T(146, MY + 19)
_, fmy = T(0, MY)
for y in range(int(fy0), int(fy1)):
    for x in range(int(fx0), int(fx1)):
        if fm.L[y, x] == 's' and tuple(cv.a[y, x]) != OUT and not fm.inner_mask[y, x]:
            v = 0.78 - 0.3 * (y - fmy + 9) / 30 - 0.12 * (x - 125) / 18
            if fm.L[y - 1, x] == 'h' or fm.L[y - 2, x] == 'h':
                v -= 0.35
            px(cv, x, y, rampc(SKL, v, x, y))
# Arme ebenso heller
ax0, ay0 = T(80, 95); ax1, ay1 = T(170, 125)
for y in range(int(ay0), int(ay1)):
    for x in range(int(ax0), int(ax1)):
        if fm.L[y, x] == 's' and tuple(cv.a[y, x]) != OUT and not fm.inner_mask[y, x] and not (fx0 <= x <= fx1 and y < T(0, 104)[1]):
            c = tuple(int(q) for q in cv.a[y, x])
            px(cv, x, y, SKL[1] if sum(c) < 420 else SKL[2] if sum(c) < 560 else SKL[3])
EYE = (236, 60, 150)
ex_, ey_ = T(111, MY + 1)
big_eye(cv, int(ex_), int(ey_), EYE, w=8, h=10, lash2=(60, 20, 50))
ex2, _ = T(139, MY + 1)
big_eye(cv, int(ex2) - 8 + 1, int(ey_), EYE, w=8, h=10, flip=True, lash2=(60, 20, 50))
for (bxx, byy) in [(111, MY + 11), (137, MY + 11)]:
    X_, Y_ = T(bxx, byy)
    blush(cv, X_, Y_, (250, 120, 160)); blush(cv, X_ + 1, Y_ + 1, (250, 120, 160)); blush(cv, X_ - 1, Y_ + 1, (250, 120, 160))
mx_, my_ = T(125, MY + 13)
for (dx, dy) in [(-2, 0), (-1, 1), (0, 1), (1, 1), (2, 0)]:
    px(cv, mx_ + dx, my_ + dy, (170, 60, 80))
nx_, ny_ = T(125, MY + 8)
px(cv, nx_, ny_, SKIN[3])
# Federkiele (Schaft) auf Hand- und Armschwingen, dunklere Spitzen der Handschwingen
for side in (-1, 1):
    X = (lambda x: x) if side < 0 else (lambda x: 250 - x)
    for (layer, key, (sx, sy), (ex, ey), r0, r1) in wing_feathers():
        if layer >= 2:
            continue
        for u in np.arange(0.5, 0.9, 0.02):
            qx, qy = T(X(sx + (ex - sx) * u), sy + (ey - sy) * u)
            recolor_on(cv, fm, qx, qy, PRIM[4] if layer == 0 else COV[3], key)
# Haarglanz
for (x, y) in [(115, MY - 11), (117, MY - 11), (119, MY - 12), (131, MY - 12), (133, MY - 11), (135, MY - 11)]:
    X_, Y_ = T(x, y)
    px(cv, X_, Y_, HAIR[4]); px(cv, X_ + 1, Y_, HAIR[3])
# Rüschenpunkte auf dem Rock
for x in range(100, 152, 3):
    X_, Y_ = T(x, 143)
    recolor_on(cv, fm, X_, Y_, WHITE[4], 'D')
sparkle(cv, *T(124, 105), (255, 255, 255), r=1, c2=PINK[3])
sparkle(cv, *T(181, 66), (255, 255, 240), r=2, c2=PINK[3])

# ---------------------------------------------------------------- Die Liebenden: Cute Bunny und Cute Cat
FURW = [(120, 120, 170), (176, 176, 214), (218, 218, 240), (242, 242, 252), (255, 255, 255)]
FURC = [(130, 110, 170), (186, 166, 214), (226, 208, 240), (246, 234, 252), (255, 250, 255)]
BATW = [(10, 8, 16), (26, 22, 34), (48, 42, 60), (80, 72, 96), (120, 112, 140)]
GREYW = [(60, 60, 72), (100, 100, 116), (146, 146, 162), (192, 192, 206), (232, 232, 242)]


def lovers(f):
    # --- Bunny (links, blickt nach rechts)
    bx, by = 98, 268
    f.part('bwing')
    f.poly([(bx - 6, by - 14), (bx - 22, by - 30), (bx - 30, by - 26), (bx - 34, by - 16), (bx - 28, by - 18), (bx - 26, by - 10),
            (bx - 20, by - 12), (bx - 16, by - 4)], 'b')
    f.part('bbody'); f.ellipse(bx, by, 13, 12, 'u')
    f.part('bfoot'); f.ellipse(bx - 6, by + 11, 6, 3, 'u'); f.ellipse(bx + 7, by + 11, 6, 3, 'u')
    f.part('btail'); f.ellipse(bx - 13, by + 4, 4, 4, 'u')
    f.part('bearL'); f.limb(bx - 6, by - 26, bx - 12, by - 44, 4.2, 3.4, 'u')
    f.part('bearR'); f.limb(bx + 4, by - 26, bx + 10, by - 43, 4.2, 3.4, 'u')
    f.part('bearLi'); f.limb(bx - 6.5, by - 28, bx - 11, by - 41, 1.8, 1.4, 'q')
    f.part('bearRi'); f.limb(bx + 4.5, by - 28, bx + 9, by - 40, 1.8, 1.4, 'q')
    f.part('bhead'); f.ellipse(bx + 1, by - 18, 13, 11, 'u')
    f.part('bpaw'); f.limb(bx + 8, by - 2, bx + 24, by - 8, 3.4, 3, 'u')
    # --- Cat (rechts, blickt nach links)
    cx, cy = 152, 268
    for k_, (ex_, ey_) in enumerate([(cx + 22, cy - 36), (cx + 30, cy - 28), (cx + 32, cy - 18), (cx + 28, cy - 8)]):
        f.part('cwing%d' % k_); f.limb(cx + 6, cy - 12, ex_, ey_, 4.5, 3.0, 'e')
    f.part('cwingb'); f.ellipse(cx + 12, cy - 16, 7, 6, 'e')
    f.part('ctail'); f.curve([(cx + 10, cy + 6), (cx + 20, cy + 2), (cx + 22, cy - 8), (cx + 18, cy - 14)], 'v', w=4, w1=3)
    f.part('cbody'); f.ellipse(cx, cy, 12, 12, 'v')
    f.part('cfoot'); f.ellipse(cx + 6, cy + 11, 6, 3, 'v'); f.ellipse(cx - 7, cy + 11, 6, 3, 'v')
    f.part('cearL'); f.poly([(cx - 12, cy - 22), (cx - 12, cy - 38), (cx - 3, cy - 28)], 'v')
    f.part('cearR'); f.poly([(cx + 10, cy - 22), (cx + 12, cy - 38), (cx + 2, cy - 29)], 'v')
    f.part('cearLi'); f.poly([(cx - 10, cy - 25), (cx - 10.5, cy - 34), (cx - 5, cy - 28)], 'q')
    f.part('cearRi'); f.poly([(cx + 8.5, cy - 25), (cx + 10.5, cy - 34), (cx + 4, cy - 28)], 'q')
    f.part('chead'); f.ellipse(cx - 1, cy - 18, 13, 11, 'v')
    f.part('cpaw'); f.limb(cx - 8, cy - 2, cx - 24, cy - 8, 3.4, 3, 'v')


LM = {'u': mat(FURW, pillow=4, k=1.3, bias=0.12), 'v': mat(FURC, pillow=4, k=1.3, bias=0.12),
      'b': mat(BATW, pillow=2, k=1.4), 'e': mat(GREYW, pillow=2.5, k=1.4, noise=0.5, nscale=1),
      'q': mat(PINK[1:], pillow=1, k=1.0, bias=0.1)}
glow(cv, 125, 256, 34, (255, 200, 220), k=0.4, mix=0.3)
fl, lv = fig_draw(cv, lovers, LM)
# Gesichter
# Bunny: schwarze Punktaugen, rosa Wangen, kleiner Mund
for (x, y) in [(96, 248), (97, 248), (96, 249), (97, 249), (106, 248), (107, 248), (106, 249), (107, 249)]:
    px(cv, x, y, OUT)
px(cv, 96, 248, (255, 255, 255)); px(cv, 106, 248, (255, 255, 255))
blush(cv, 92, 253, (250, 130, 160)); blush(cv, 108, 253, (250, 130, 160))
px(cv, 101, 253, OUT); px(cv, 102, 253, OUT); px(cv, 101, 252, (250, 140, 170))
# Cat: grüne Augen, rosa Näschen, w-Mund, Schnurrhaare
for ex in (143, 153):
    for (dx, dy, c) in [(0, 0, OUT), (1, 0, OUT), (0, 1, (40, 160, 60)), (1, 1, (40, 160, 60)), (0, 2, (20, 100, 40)), (1, 2, (20, 100, 40))]:
        px(cv, ex + dx, 247 + dy, c)
    px(cv, ex, 248, (220, 255, 220))
blush(cv, 139, 253, (250, 130, 170)); blush(cv, 156, 253, (250, 130, 170))
px(cv, 148, 252, (250, 110, 150)); px(cv, 149, 252, (250, 110, 150))
for (dx, dy) in [(-2, 254), (-1, 255), (0, 254), (1, 255), (2, 254)]:
    px(cv, 148 + dx, dy, (120, 60, 90))
for (x0, y0, sg) in [(138, 252, -1), (160, 252, 1)]:
    for i in range(4):
        px(cv, x0 + sg * i, y0 - (1 if i > 1 else 0), (150, 130, 170))
# Fellflausch
for (x, y) in [(90, 262), (104, 266), (146, 264), (158, 266), (100, 238), (152, 238)]:
    px(cv, x, y, (255, 255, 255))
# Herz zwischen den beiden + kleine Herzchen
BIGH = ["..###...###..", ".#####.#####.", "#############", "#############", ".###########.", "..#########..",
        "...#######...", "....#####....", ".....###.....", "......#......"]
glow(cv, 125, 224, 18, (255, 150, 190), k=0.5, mix=0.35)
for j, r in enumerate(BIGH):
    for i, ch in enumerate(r):
        if ch == '#':
            x, y = 119 + i, 218 + j
            edge = (i == 0 or r[i - 1] == '.' or i == len(r) - 1 or r[i + 1] == '.' or j == len(BIGH) - 1 or BIGH[j + 1][i] == '.'
                    or j == 0 or BIGH[j - 1][i] == '.')
            v = 0.85 - 0.08 * i - 0.06 * j
            px(cv, x, y, (150, 20, 60) if edge else rampc(HEART[:5], v + 0.3, x, y))
px(cv, 121, 220, (255, 255, 255)); px(cv, 122, 220, (255, 240, 246)); px(cv, 121, 221, (255, 240, 246))
for (x, y) in [(134, 236), (108, 238), (140, 226)]:
    small_heart(x, y)
# Flughaut-Adern am Fledermausflügel
for (ex, ey) in [(76, 238), (68, 242), (64, 252), (72, 256)]:
    for k_ in range(40):
        t = k_ / 39
        recolor_on(cv, fl, 92 + (ex - 92) * t, 254 + (ey - 254) * t, BATW[3], 'b')
for (x, y) in [(125, 262)]:
    sparkle(cv, x, y, (255, 255, 255), r=2, c2=(255, 180, 210))

# Funkeln
for (x, y) in [(66, 110), (186, 112), (40, 220), (210, 226), (82, 170), (168, 160)]:
    sparkle(cv, x, y, (255, 255, 255), r=2, c2=(255, 190, 220))
vignette(cv, (60, 20, 70), strength=0.3, r0=0.78)
p = finish(cv, 'VI', 'MOLINDA', out='06_lovers_molinda', emblem=emblem_heart)
print(p)
