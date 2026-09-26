# -*- coding: utf-8 -*-
# XIV – Die Mäßigkeit: Tempeste, the Weather Fairy
# Die Wetterfee steht mit einem Fuß im See, mit dem anderen am Ufer, und gießt zwischen zwei goldenen
# Kelchen einen Strom aus Regen hin und her, in dem kleine Blitzfunken knistern. Hinter ihr Feenflügel,
# ein Regenbogen, oben abziehende Gewitterwolken; ein Pfad führt zu den Bergen, wo die Sonne als Krone aufgeht.
# Schwertlilien am Ufer, goldenes Dreieck auf der Brust.
from tarot_b4_helpers import *

cv = new_card()
rnd = random.Random(14)
yy, xx = np.indices((H, W))
HOR = 226            # Horizont (Seeufer/Hügel)

# ---------------------------------------------------------------- Himmel: oben Gewitter, unten Morgenlicht
sky(cv, [(14, 20, 58), (24, 40, 96), (40, 76, 150), (70, 124, 196), (110, 160, 216), (160, 188, 222), (206, 204, 214),
         (240, 212, 190), (255, 214, 160)],
    y1=HOR + 6)
stars(cv, 25, y1=90, seed=4, big=0.05)
# Sonne/Krone zwischen den Bergen rechts
SX, SY = 204, 217
glow2(cv, SX, SY, 60, (255, 230, 160), k=0.55, mix=0.35)
rays2(cv, SX, SY, 18, 14, 70, (255, 240, 190), width=0.08, k=0.5, mix=0.35)

# Regenbogen (hinter allem Übrigen)
RB = [(226, 70, 80), (250, 150, 60), (250, 226, 90), (90, 200, 110), (70, 140, 230), (140, 90, 210)]
RCX, RCY, RR = 125, 262, 124


def rainbow(cv, cy, r, k=0.55, reflect=False, ytop=AY0, ybot=AY1):
    for y in range(ytop, ybot):
        for x in range(AX0, AX1):
            d = math.hypot(x - RCX, (y - cy) * (1 if not reflect else -1))
            if reflect and y < cy:
                continue
            if not reflect and y > cy:
                continue
            t = (r - d) / 2.2           # 6 Bänder à 2,2 px
            if 0 <= t < 6:
                i = int(t)
                c = RB[i]
                edge = min(t - i, i + 1 - t)
                kk = k * (0.75 if (t < 0.6 or t > 5.4) else 1.0)
                if BAYER4[y % 4, x % 4] < 0.85 or edge > 0.3:
                    blend_px(cv, x, y, c, kk)
            elif -3 < t < 0 or 6 <= t < 9:     # weicher Schimmer außen/innen
                tt = (-t if t < 0 else t - 6) / 3
                if BAYER4[y % 4, x % 4] < (1 - tt) * 0.35:
                    blend_px(cv, x, y, (255, 255, 255), 0.25)


rainbow(cv, RCY, RR, ybot=HOR)

# ---------------------------------------------------------------- Gewitterwolken oben mit Blitzen und Regen
STORM = [(18, 22, 48), (32, 38, 74), (52, 60, 102), (80, 90, 134), (118, 128, 170), (168, 176, 210)]
for (cx_, cy_, w_, h_, sd) in [(30, 60, 70, 20, 1), (92, 50, 64, 16, 2), (160, 54, 70, 18, 3), (222, 62, 64, 22, 4),
                               (60, 78, 60, 14, 5), (196, 82, 56, 14, 6)]:
    puffy_cloud(cv, cx_, cy_, w_, h_, STORM, seed=sd)
bolt(cv, 40, 70, 22, 128, seed=3, jag=0.3, branches=2, width=1, core=(255, 255, 230), mid=(255, 246, 170),
     outer=(240, 200, 90), glow_col=(255, 240, 170), glow_r=7, glow_k=0.45)
bolt(cv, 214, 76, 230, 124, seed=8, jag=0.3, branches=2, width=1, core=(255, 255, 230), mid=(255, 246, 170),
     outer=(240, 200, 90), glow_col=(255, 240, 170), glow_r=7, glow_k=0.45)
rain(cv, 90, cols=((140, 160, 210), (180, 200, 240)), ang=-0.3, L=(3, 6), seed=2, k=0.5, y0=70, y1=150, x0=AX0, x1=70)
rain(cv, 90, cols=((140, 160, 210), (180, 200, 240)), ang=-0.3, L=(3, 6), seed=3, k=0.5, y0=74, y1=150, x0=180, x1=AX1)

# ---------------------------------------------------------------- Berge mit der aufgehenden Sonne
MNT = [(62, 66, 118), (92, 94, 148), (128, 126, 176), (170, 164, 204), (214, 204, 228), (246, 238, 246)]
MNT2 = [(40, 50, 96), (60, 72, 120), (86, 100, 146), (120, 132, 172), (160, 170, 200)]
gul = noise(H, W, 2, seed=5, octaves=2)


def mountains(peaks, ramp, base, snow_y=None, seed=0):
    """gezackte Bergkette; Licht kommt von der Sonne rechts"""
    hm = np.full(W, -1e9)
    for (pxk, pyk, sl) in peaks:
        for x in range(W):
            hm[x] = max(hm[x], (base - pyk) - abs(x - pxk) * sl)
    rn = random.Random(seed)
    jag = np.array([0.0] * W)
    v = 0.0
    for x in range(W):
        v += rn.uniform(-1, 1) * 0.9; v *= 0.8
        jag[x] = v
    top = base - hm + jag
    M = (yy >= top[None, :]) & (yy <= base) & (xx >= AX0) & (xx < AX1)
    Hm = np.tile(hm[None, :], (H, 1)).astype(np.float32) * 0.35 + (gul - 0.5) * 2.4 \
        + np.sin(xx * 0.9 + yy * 0.25 + gul * 6) * 0.35
    relief(cv, Hm, np.zeros((H, W), np.int32), [ramp], M, k=1.4, bias=0.02, light=(0.62, -0.5, 0.5))
    if snow_y is not None:
        for x in range(AX0, AX1):
            for y in range(int(top[x]), base):
                sl = snow_y + math.sin(x * 0.7) * 2 + math.sin(x * 0.23) * 3
                if y < sl and M[y, x]:
                    lit = (x - np.argmax(hm[max(0, x - 30):x + 30]) - max(0, x - 30)) > 0
                    px(cv, x, y, (255, 250, 250) if lit and (x + y) % 3 else (214, 210, 236) if (x + y) % 2 else (190, 188, 224))
    for x in range(AX0, AX1):
        if AY0 <= int(top[x]) < base:
            px(cv, x, int(top[x]), ramp[0])
    return M, top


Mm, mtop = mountains([(150, 184, 1.05), (174, 196, 1.3), (234, 180, 1.2), (98, 198, 1.1), (64, 190, 0.95), (22, 200, 1.0)],
                     MNT, HOR + 1, snow_y=196, seed=3)
fog(cv, 196, HOR + 2, (240, 220, 220), k=1.6, seed=3, mix=0.3)
# Sonnenscheibe zwischen den Gipfeln
for y in range(SY - 13, SY + 1):
    for x in range(SX - 13, SX + 14):
        d = math.hypot(x - SX, y - SY)
        if d <= 12 and in_art(x, y) and not Mm[y, x]:
            px(cv, x, y, rampc([(255, 170, 60), (255, 210, 100), (255, 240, 170), (255, 255, 230)], 1.05 - d / 13, x, y))
# Krone aus Licht über der Sonne (Tarot: Krone am Ende des Pfades)
CR = [(200, 120, 20), (240, 170, 40), (255, 214, 90), (255, 240, 170), (255, 255, 230)]
cy0 = SY - 16
glow2(cv, SX, cy0 - 4, 18, (255, 240, 180), k=0.6, mix=0.3)
for x in range(SX - 11, SX + 12):          # Kronreif
    for y in range(cy0, cy0 + 3):
        px(cv, x, y, CR[3] if y == cy0 else CR[2] if y == cy0 + 1 else CR[1])
for i, dx in enumerate((-10, -5, 0, 5, 10)):  # Zacken mit Perlen
    hgt = 9 if i == 2 else 7 if i in (1, 3) else 6
    for k in range(hgt):
        w = 1.8 * (1 - k / hgt)
        for q in range(-int(round(w)), int(round(w)) + 1):
            px(cv, SX + dx + q, cy0 - 1 - k, CR[3] if q <= 0 else CR[2])
    px(cv, SX + dx, cy0 - 1 - hgt, CR[4]); px(cv, SX + dx, cy0 - 2 - hgt, CR[3])
for dx in (-7, 0, 7):
    px(cv, SX + dx, cy0 + 1, (80, 200, 255))
for x in range(SX - 12, SX + 13):          # dunkle Kontur unten am Reif
    px(cv, x, cy0 + 3, CR[0])

# ---------------------------------------------------------------- See (links) und Ufer mit Pfad (rechts)
WATER = [(20, 40, 90), (34, 70, 140), (60, 110, 180), (110, 160, 220), (180, 214, 245), (240, 250, 255)]
GRASS = [(22, 60, 40), (36, 96, 50), (62, 136, 62), (104, 176, 84), (160, 214, 120)]


def shore(y):
    """x-Grenze zwischen See (links) und Land (rechts) je Zeile"""
    t = (y - HOR) / (AY1 - HOR)
    return 78 + t * 58 + math.sin(y * 0.2) * 2


for y in range(HOR, AY1):
    sx_ = shore(y)
    for x in range(AX0, AX1):
        if x < sx_:
            t = (y - HOR) / (AY1 - HOR)
            v = 0.72 - t * 0.5 + (0.12 if (y + int(math.sin(x * 0.3 + y) * 2)) % 5 == 0 else 0)
            px(cv, x, y, rampc(WATER, v, x, y))
        else:
            t = (y - HOR) / (AY1 - HOR)
            v = 0.62 - t * 0.2 + (noise(H, W, 3, seed=9)[y, x] - 0.5) * 0.7
            px(cv, x, y, rampc(GRASS, v, x, y))
# Spiegelung des Regenbogens und der Sonne im See
for y in range(HOR, AY1):
    for x in range(AX0, int(shore(y))):
        d = math.hypot(x - RCX, (2 * HOR - y) - (RCY - 0))
        yr = 2 * HOR - y
        dd = math.hypot(x - RCX, yr - RCY)
        t = (RR - dd) / 2.2
        if 0 <= t < 6 and (y + x // 3) % 3 != 0:
            blend_px(cv, x, y, RB[int(t)], 0.3)
# Wellenlinien
for i in range(60):
    y = rnd.randint(HOR + 2, AY1 - 2); x = rnd.randint(AX0, int(shore(y)) - 6)
    L = rnd.randint(3, 9)
    for q in range(L):
        if x + q < shore(y) - 1:
            blend_px(cv, x + q, y, (230, 244, 255), 0.55)
            blend_px(cv, x + q, y + 1, (20, 40, 90), 0.25)
# Uferkante mit Kieseln
for y in range(HOR, AY1):
    sx_ = int(shore(y))
    px(cv, sx_, y, (220, 200, 150)); px(cv, sx_ + 1, y, (180, 150, 100)); px(cv, sx_ - 1, y, (140, 180, 220))
STONE2 = [(60, 60, 70), (100, 98, 108), (146, 142, 150), (196, 192, 196)]
for i in range(22):
    y = rnd.randint(HOR + 6, AY1 - 2); x = int(shore(y)) + rnd.randint(-1, 3)
    r_ = rnd.choice([1, 1, 2])
    for dy in range(-r_, r_ + 1):
        for dx in range(-r_ - 1, r_ + 2):
            if (dx / (r_ + 1.2)) ** 2 + (dy / (r_ + 0.2)) ** 2 <= 1:
                px(cv, x + dx, y + dy, STONE2[3 if (dx < 0 and dy < 0) else 1 if dy > 0 else 2])
# Pfad zu den Bergen (Perspektive: unten breit, oben schmal)
PATH = [(120, 96, 64), (160, 130, 86), (200, 170, 120), (232, 208, 160)]
for y in range(HOR, AY1):
    t = (y - HOR) / (AY1 - HOR)
    cxp = 200 + math.sin(t * 5.5) * 16 * t - t * 16
    w = 1 + t * 13
    for x in range(int(cxp - w), int(cxp + w) + 1):
        if in_art(x, y) and x > shore(y) + 3:
            v = 0.7 - abs(x - cxp) / (w + 1) * 0.4 + (noise(H, W, 2, seed=15)[y, x] - 0.5) * 0.5
            px(cv, x, y, rampc(PATH, v, x, y))
# Grashalme im Vordergrund
for i in range(260):
    y = rnd.randint(HOR + 4, AY1 - 1)
    x = rnd.randint(int(shore(y)) + 2, AX1 - 1)
    h = rnd.randint(1, 3 + int((y - HOR) / 20))
    for k in range(h):
        px(cv, x + (1 if k == h - 1 and i % 3 == 0 else 0), y - k, GRASS[3] if k == h - 1 else GRASS[2])
for i in range(30):   # Blümchen
    y = rnd.randint(HOR + 8, AY1 - 2); x = rnd.randint(int(shore(y)) + 4, AX1 - 2)
    c = rnd.choice([(255, 240, 120), (255, 255, 255), (250, 170, 200)])
    px(cv, x, y, c)
# Wolken am Horizont
CL = [(150, 150, 190), (196, 196, 226), (236, 232, 246), (255, 252, 255)]
puffy_cloud(cv, 40, 176, 44, 12, CL, seed=3)
puffy_cloud(cv, 222, 150, 40, 11, CL, seed=6)

# ---------------------------------------------------------------- Feenflügel (durchscheinend, hinter der Figur)
WING_EDGE = (120, 230, 255)


def wing(p0, tip, width, n_veins=4, k=0.4):
    """tropfenförmiger Flügel von p0 (Ansatz) zu tip"""
    ax, ay = p0; bx, by = tip
    L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
    nx, ny = -uy, ux
    M = np.zeros((H, W), bool)
    pts = []
    for i in range(41):
        t = i / 40
        w = width * math.sin(math.pi * t ** 0.7) * (1 - 0.1 * t)
        pts.append((ax + ux * L * t + nx * w, ay + uy * L * t + ny * w))
    for i in range(40, -1, -1):
        t = i / 40
        w = width * 0.55 * math.sin(math.pi * t ** 0.7)
        pts.append((ax + ux * L * t - nx * w, ay + uy * L * t - ny * w))
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
    M = m.astype(bool)
    d = cv2.distanceTransform(np.pad(m, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    for y, x in zip(*np.where(M)):
        if not in_art(x, y):
            continue
        t = ((x - ax) * ux + (y - ay) * uy) / L
        if d[y, x] <= 1:
            px(cv, x, y, WING_EDGE)
        else:
            c = lerp((200, 240, 255), (255, 255, 255), t)
            blend_px(cv, x, y, c, k * (0.6 + 0.4 * t) if BAYER4[y % 4, x % 4] < 0.75 else k * 0.4)
    # Adern
    for v in range(n_veins):
        off = (v - (n_veins - 1) / 2) / n_veins
        q = []
        for i in range(30):
            t = i / 29
            w = width * math.sin(math.pi * t ** 0.7) * off * 1.3
            q.append((ax + ux * L * t * 0.92 + nx * w, ay + uy * L * t * 0.92 + ny * w))
        for (a, b) in zip(q[:-1], q[1:]):
            for (x, y) in pts_line(a[0], a[1], b[0], b[1]):
                if M[y, x] and in_art(x, y):
                    blend_px(cv, x, y, (110, 200, 240), 0.55)
    return M


WM = np.zeros((H, W), bool)
WM |= wing((116, 146), (42, 84), 20, k=0.55)
WM |= wing((134, 146), (208, 84), 20, k=0.55)
WM |= wing((116, 156), (58, 204), 13, 3, k=0.5)
WM |= wing((134, 156), (192, 204), 13, 3, k=0.5)
# Glitzer auf den Flügeln
for (x, y) in [(66, 100), (80, 118), (184, 100), (170, 118), (76, 184), (174, 184), (96, 128), (154, 128)]:
    sparkle(cv, x, y, (255, 255, 255), r=1, c2=(170, 230, 255))

# ================================================================= Tempeste
HAIRB = [(8, 14, 40), (18, 34, 84), (30, 60, 140), (50, 100, 190), (90, 160, 230), (160, 220, 255)]
DRESSB = [(10, 22, 70), (20, 44, 120), (34, 72, 170), (60, 110, 210), (110, 160, 240), (180, 210, 255)]
CYAN = [(10, 70, 100), (20, 130, 170), (50, 200, 230), (130, 240, 255), (220, 255, 255)]
CLOUDW = [(110, 130, 180), (170, 186, 222), (214, 224, 244), (244, 248, 255), (255, 255, 255)]
FAIR = [(120, 66, 70), (190, 116, 108), (236, 166, 146), (250, 204, 182), (255, 228, 210), (255, 244, 234)]
BOOT = [(34, 18, 12), (70, 40, 22), (112, 68, 36), (156, 104, 60), (196, 146, 96)]

f = Fig(W, H)
# ---- Beine
f.part('legL'); f.limb(117, 238, 113, 282, 4.6, 3.4, 's')
f.part('legR'); f.limb(133, 238, 139, 276, 4.6, 3.4, 's')
f.part('bootL'); f.poly([(108, 272), (118, 272), (118, 286), (106, 290), (104, 287)], 'b')
f.part('bootR'); f.poly([(134, 268), (144, 268), (147, 280), (152, 283), (150, 286), (136, 286)], 'b')
f.part('cuffL'); f.rect(108, 271, 118, 274, 'y')
f.part('cuffR'); f.rect(134, 267, 144, 270, 'y')
# ---- Rock mit Wolken-Saum
f.part('skirt')
f.poly([(115, 168), (135, 168), (146, 196), (156, 238), (94, 238), (104, 196)], 'd')
f.part('cloudhem')
for i, x in enumerate(range(94, 158, 8)):
    f.ellipse(x + 2, 240 + (2 if i % 2 else 0), 6.5, 5, 'k')
# ---- Oberkörper
f.part('body'); f.poly([(110, 138), (140, 138), (138, 156), (135, 170), (115, 170), (112, 156)], 'd')
f.part('sash'); f.poly([(113, 166), (137, 166), (138, 173), (112, 173)], 'y')
f.part('bow'); f.poly([(125, 169), (117, 164), (117, 175)], 'y'); f.poly([(125, 169), (133, 164), (133, 175)], 'y')
f.ellipse(125, 169, 2, 2, 'y')
f.part('collar'); f.poly([(114, 137), (136, 137), (131, 145), (125, 142), (119, 145)], 'k')
# ---- Arme + Kelche
f.part('sleeveL'); f.ellipse(108, 143, 6.5, 6, 'k')
f.part('sleeveR'); f.ellipse(142, 143, 6.5, 6, 'k')


def rot(p, c, a):
    ca, sa = math.cos(a), math.sin(a)
    return (c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca)


def cup(gx, gy, ang, name):
    """goldener Kelch; (gx, gy) = Griff am Stiel, ang = Neigung (rad, + = im Uhrzeigersinn)"""
    c = (gx, gy)
    f.part(name + '_foot'); f.poly([rot(p, c, ang) for p in [(-5, 7), (5, 7), (3, 4), (-3, 4)]], 'g')
    f.part(name + '_stem'); f.poly([rot(p, c, ang) for p in [(-1.5, 5), (1.5, 5), (1.5, -8), (-1.5, -8)]], 'g')
    f.part(name + '_knot'); f.ellipse(*rot((0, -2), c, ang), 2.5, 2.5, 'g')
    bowl = [(-9, -19), (9, -19)] + [(math.cos(t) * 9, -19 + math.sin(t) * 11) for t in np.linspace(0.05, math.pi - 0.05, 14)]
    f.part(name + '_bowl'); f.poly([rot(p, c, ang) for p in bowl], 'g')
    f.part(name + '_rim'); f.poly([rot(p, c, ang) for p in [(-10, -21), (10, -21), (10, -18), (-10, -18)]], 'G')
    return rot((10, -20), c, ang), rot((0, -20), c, ang)


# linker Arm hoch (oberer Kelch, geneigt -> gießt nach rechts)
f.part('armL'); f.limb(107, 146, 97, 168, 3.6, 3.1, 's')
f.part('farmL'); f.limb(97, 168, 85, 174, 3.1, 2.7, 's')
f.part('bracL'); f.limb(93, 171, 89, 173, 3.5, 3.3, 'b')
LIP_A, MOUTH_A = cup(82, 174, math.radians(46), 'cupA')
f.part('handL'); f.ellipse(83, 175, 3.4, 3.4, 's')
# rechter Arm tiefer (unterer Kelch, aufrecht -> fängt auf)
f.part('armR'); f.limb(143, 146, 153, 170, 3.6, 3.1, 's')
f.part('farmR'); f.limb(153, 170, 166, 196, 3.1, 2.7, 's')
f.part('bracR'); f.limb(158, 180, 161, 186, 3.5, 3.3, 'b')
LIP_B, MOUTH_B = cup(168, 202, math.radians(-8), 'cupB')
f.part('handR'); f.ellipse(168, 201, 3.4, 3.4, 's')
# ---- Kopf
f.part('neck'); f.rect(120, 128, 130, 139, 's')
f.part('hairback')
f.ellipse(125, 112, 21, 20, 'h')
f.poly([(104, 108), (101, 126), (100, 140), (108, 136), (112, 128), (138, 128), (142, 136), (150, 140), (149, 126), (146, 108)], 'h')
f.part('bunlink'); f.curve([(126, 96), (134, 90), (140, 88)], 'h', w=10, w1=9)
f.part('bun'); f.ellipse(147, 84, 13, 12, 'h')
f.part('face')
f.ellipse(125, 116, 16, 15, 's')
f.poly([(110, 116), (140, 116), (139, 126), (132, 133), (125, 135), (118, 133), (111, 126)], 's')
f.part('ears'); f.ellipse(109, 121, 2.2, 3.2, 's'); f.ellipse(141, 121, 2.2, 3.2, 's')
f.part('bangs')
f.poly([(106, 122), (107, 106), (114, 98), (125, 95), (136, 98), (143, 106), (144, 122),
        (141, 114), (137, 112), (133, 106), (129, 113), (125, 108), (120, 113), (116, 107), (112, 113), (109, 116)], 'h')
f.part('lockL'); f.curve([(108, 110), (105, 122), (106, 134), (104, 142)], 'h', w=5, w1=2)
f.part('lockR'); f.curve([(142, 110), (145, 122), (144, 134), (146, 142)], 'h', w=5, w1=2)
f.part('clip'); f.ellipse(137, 99, 3, 3, 'y')        # Wolken-Haarspange
f.outline()
MATS = {
    's': mat(FAIR, pillow=3, k=1.2, bias=0.1),
    'h': mat(HAIRB, pillow=4, k=1.9, noise=0.9, nscale=2, folds=(0.25, 0.3, 0.5)),
    'd': mat(DRESSB, pillow=4, k=1.5, folds=(0.35, 0.04, 0.7)),
    'k': mat(CLOUDW, pillow=3, k=1.6, bias=0.1),
    'y': mat(CYAN, pillow=2, k=1.5, bias=0.05),
    'b': mat(BOOT, pillow=2, k=1.5, spec=True, spec_col=(230, 190, 140)),
    'g': mat(GOLD, pillow=2, k=1.9, spec=True, spec_col=(255, 255, 230)),
    'G': mat(GOLD7, pillow=1.5, k=1.5, bias=0.1),
}
fig = f.render(MATS)
FM = fig[..., 3] > 0

# Cyan-Aura um die Figur (wie auf der Karte)
d_out = cv2.distanceTransform((~FM).astype(np.uint8), cv2.DIST_L2, 3)
for y, x in zip(*np.where((d_out > 0) & (d_out < 8))):
    if not in_art(x, y):
        continue
    dd = d_out[y, x]
    if dd <= 1.5:
        px(cv, x, y, (90, 240, 255))
    elif dd <= 2.5:
        blend_px(cv, x, y, (60, 220, 250), 0.6)
    elif BAYER4[y % 4, x % 4] < (1 - dd / 8) * 0.9:
        blend_px(cv, x, y, (80, 230, 255), 0.4)
cv.paste(fig, 0, 0)
# Regentropfen-Muster auf dem Rock
DM = f.L == 'd'
for j, y in enumerate(range(182, 236, 9)):
    for x in range(96 + (5 if j % 2 else 0), 156, 10):
        if all(DM[y + dy, x] for dy in (-1, 0, 1, 2)) and DM[y, x - 1] and DM[y, x + 1]:
            px(cv, x, y - 1, (170, 220, 255)); px(cv, x, y, (130, 200, 250)); px(cv, x - 1, y + 1, (110, 170, 240))
            px(cv, x, y + 1, (200, 236, 255)); px(cv, x + 1, y + 1, (90, 150, 230)); px(cv, x, y + 2, (90, 150, 230))

# ---------------------------------------------------------------- Gesicht und Details
EYE = (40, 130, 230)
anime_eye2(cv, 112, 114, EYE, w=6, h=9, lash=(14, 20, 50))
anime_eye2(cv, 132, 114, EYE, w=6, h=9, flip=True, lash=(14, 20, 50))
for x in range(112, 119):
    px(cv, x, 112, HAIRB[1])
for x in range(131, 138):
    px(cv, x, 112, HAIRB[1])
px(cv, 125, 125, SKIN[2]); px(cv, 126, 126, SKIN[1])
for x in range(123, 128):
    px(cv, x, 130, (170, 70, 80))
px(cv, 122, 129, (170, 70, 80)); px(cv, 128, 129, (170, 70, 80))
blush(cv, 113, 126); blush(cv, 134, 126)
# Spirale im Haarknoten (Wirbelsturm-Locke) + Glanz
for t in np.linspace(0, 3.2 * math.pi, 70):
    r = 10 * (1 - t / (3.6 * math.pi))
    x = 147 + math.cos(t) * r; y = 84 + math.sin(t) * r * 0.92
    px(cv, x, y, HAIRB[0] if t < 2 * math.pi else HAIRB[1])
for (x, y) in [(141, 78), (142, 77), (143, 76), (118, 100), (119, 99), (120, 99)]:
    px(cv, x, y, HAIRB[5])
# Wolken-Haarspange: kleiner Blitz
for (x, y) in [(137, 97), (136, 98), (137, 99), (138, 99), (137, 100), (136, 101)]:
    px(cv, x, y, (255, 240, 120))
# goldenes Dreieck auf der Brust
for y in range(146, 156):
    w = (y - 146) * 0.55
    for x in range(int(125 - w), int(125 + w) + 1):
        e = y == 155 or abs(x - 125) >= w - 0.8
        px(cv, x, y, GOLD[4] if (x < 125 and not e) else GOLD[3] if not e else GOLD[1])
px(cv, 125, 146, GOLD[5])
sparkle(cv, 125, 151, (255, 255, 230), r=1, c2=GOLD[3])
# Finger über den Stielen
for (fx, fy) in [(81, 173), (81, 176), (166, 199), (166, 202)]:
    px(cv, fx, fy, SKIN[1])
# Wasser in den Kelchen
for q in range(-7, 8):
    x, y = rot((q, -20.5), (168, 202), math.radians(-8))
    px(cv, x, y, (140, 220, 255) if q < 3 else (80, 170, 240))

# ---------------------------------------------------------------- Strom aus Regen zwischen den Kelchen
A = (LIP_A[0] + 1, LIP_A[1])
B = (MOUTH_B[0], MOUTH_B[1] - 1)
Cc = (A[0] + 28, A[1] - 10)
STREAM = [(40, 110, 200), (90, 180, 240), (170, 230, 255), (240, 252, 255)]
spts = []
for i in range(120):
    t = i / 119
    x = (1 - t) ** 2 * A[0] + 2 * (1 - t) * t * Cc[0] + t * t * B[0]
    y = (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * Cc[1] + t * t * B[1]
    spts.append((x, y, t))
SM = np.zeros((H, W), bool)
SV = np.zeros((H, W), np.float32)
for i, (x, y, t) in enumerate(spts[:-1]):
    nx_, ny_ = spts[i + 1][0] - x, spts[i + 1][1] - y
    L = math.hypot(nx_, ny_) or 1
    nx_, ny_ = -ny_ / L, nx_ / L
    w = 3.4 - 1.2 * t + 0.6 * math.sin(t * 20)
    for q in np.linspace(-w, w, 13):
        X, Y = int(round(x + nx_ * q)), int(round(y + ny_ * q))
        SM[Y, X] = True
        SV[Y, X] = 0.8 + q / (w + 0.01) * 0.35 + (0.2 if int(t * 60) % 7 == 0 else 0) - (0.25 if int(t * 45 + q) % 9 == 0 else 0)
cupmask = np.isin(f.L, ['g', 'G'])
for y, x in zip(*np.where(SM)):
    px(cv, x, y, rampc(STREAM, SV[y, x], x, y))
g_ = SM.copy()
g_[1:] |= SM[:-1]; g_[:-1] |= SM[1:]; g_[:, 1:] |= SM[:, :-1]; g_[:, :-1] |= SM[:, 1:]
for y, x in zip(*np.where(g_ & ~SM & ~cupmask)):
    px(cv, x, y, (20, 46, 120))
# Glanzlinie oben auf dem Strom
for i, (x, y, t) in enumerate(spts[4:-8]):
    if i % 9 < 6:
        px(cv, x, y - 2.2 + 1.2 * t, (255, 255, 255))
# Tropfen um den Strom
for i in range(40):
    x, y, t = spts[rnd.randint(5, 114)]
    ox, oy = rnd.uniform(-6, 6), rnd.uniform(-5, 6)
    X, Y = x + ox, y + oy
    if math.hypot(ox, oy) > 3.5:
        px(cv, X, Y, (230, 250, 255)); blend_px(cv, X, Y + 1, (90, 170, 240), 0.8)
# feiner Regen, der vom Strom sprüht
for i in range(26):
    x, y, t = spts[rnd.randint(10, 110)]
    X = x + rnd.uniform(-3, 3); Y = y + rnd.uniform(4, 9)
    for q in range(rnd.randint(2, 4)):
        blend_px(cv, X - q * 0.25, Y + q, (200, 236, 255), 0.7)
# kleine Blitzfunken im Strom
for (t0, sd) in [(0.35, 1), (0.7, 3)]:
    i0 = int(t0 * 119)
    x0, y0, _ = spts[i0]
    pts = bolt_path(x0 - 5, y0 - 7, x0 + 5, y0 + 7, seed=sd, jag=0.5, depth=3)
    draw_bolt(cv, pts, core=(255, 255, 200), mid=(255, 230, 90), outer=(255, 200, 40), width=0,
              glow_col=(255, 230, 120), glow_r=4, glow_k=0.4)
# Dunst am oberen Kelch
for (x, y, r_) in [(A[0] - 2, A[1] - 3, 3), (A[0] + 3, A[1] - 5, 2.5), (A[0] - 6, A[1] - 6, 2)]:
    for yq in range(int(y - r_), int(y + r_) + 1):
        for xq in range(int(x - r_), int(x + r_) + 1):
            if math.hypot(xq - x, yq - y) <= r_:
                blend_px(cv, xq, yq, (230, 240, 255), 0.5 if BAYER4[yq % 4, xq % 4] < 0.6 else 0.2)
# Spritzer im unteren Kelch
for (dx, dy) in [(-4, -3), (3, -4), (-1, -5), (5, -2), (-6, -1)]:
    px(cv, B[0] + dx, B[1] + dy, (230, 250, 255))
sparkle(cv, B[0] + 1, B[1] - 7, (255, 255, 255), r=2, c2=(140, 210, 255))

# ---------------------------------------------------------------- Wasserringe um den Fuß im See, Uferdetails
for (rx, ry, k) in [(10, 2.5, 0.8), (15, 3.5, 0.55), (20, 4.5, 0.35)]:
    for t in np.linspace(0, 2 * math.pi, 140):
        x = 111 + math.cos(t) * rx; y = 288 + math.sin(t) * ry
        if (math.sin(t) > -0.1 or not FM[int(y), int(x)]) and x < shore(y) - 1:
            blend_px(cv, x, y, (230, 245, 255), k)
# Wasserlinie über dem Stiefel (Fuß steht im Wasser)
for x in range(103, 120):
    for y in range(286, 291):
        if FM[y, x] and x < shore(y):
            blend_px(cv, x, y, (70, 130, 200), 0.55)
    px(cv, x, 286, (200, 230, 255))

# ---------------------------------------------------------------- Schwertlilien (Iris) an den Ufern


def iris(x, y, h, flip=1):
    LEAF = [(20, 60, 40), (36, 100, 56), (70, 150, 80)]
    # Schwertblätter
    for (dx, hh, lean) in [(-3, h * 0.9, -0.12), (2, h * 0.75, 0.15), (0, h * 0.6, 0.05)]:
        for k in range(int(hh)):
            w = 1.6 * (1 - k / hh) + 0.4
            X = x + dx + lean * k
            for q in range(-int(w), int(w) + 1):
                px(cv, X + q, y - k, LEAF[2] if q < 0 else LEAF[1])
    # Stängel
    for k in range(int(h)):
        px(cv, x, y - k, LEAF[1])
    # Blüte: drei Hängeblätter (Falls, nach außen/unten) + drei aufrechte Domblätter
    bx, by = x, y - h
    PUR = [(40, 16, 96), (80, 36, 160), (126, 80, 214), (180, 150, 246), (230, 214, 255)]
    for sd in (-1, 1):                       # Hängeblätter
        for k in range(7):
            for q in range(-1, 2):
                X = bx + sd * (2 + k * 0.8) + q * 0.3; Y = by + 1 + k * 0.6 + q
                px(cv, X, Y, PUR[1] if q == 1 else PUR[2] if k < 4 else PUR[1])
        px(cv, bx + sd * 3, by + 2, (255, 214, 70)); px(cv, bx + sd * 4, by + 2, (255, 240, 150))
    for k in range(5):                       # Mittleres Hängeblatt nach vorn
        px(cv, bx, by + 2 + k, PUR[2] if k < 3 else PUR[1]); px(cv, bx - 1, by + 2 + k, PUR[1])
    for sd in (-1, 0, 1):                    # Domblätter
        for k in range(6):
            X = bx + sd * (1 + k * 0.25); Y = by - k
            px(cv, X, Y, PUR[3] if sd <= 0 else PUR[2])
            if k < 4:
                px(cv, X + (1 if sd >= 0 else -1), Y, PUR[4] if sd < 0 else PUR[3])
    px(cv, bx, by - 6, PUR[4])


for (x, y, h) in [(22, 302, 44), (36, 303, 34), (50, 304, 26), (204, 303, 30), (218, 303, 44), (230, 304, 34)]:
    iris(x, y, h)
# Schilf links
for (x, h) in [(20, 40), (38, 34), (50, 26)]:
    for k in range(h):
        px(cv, x + k * 0.05, AY1 - 1 - k, (60, 90, 50) if k < h - 5 else (120, 80, 40))

# Funkeln
for (x, y) in [(56, 150), (196, 170), (70, 232), (110, 70), (178, 236), (30, 214)]:
    sparkle(cv, x, y, (255, 255, 240), r=2, c2=(150, 220, 255))

FMD = cv2.dilate(FM.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
vignette2(cv, strength=0.45, protect=lambda x, y: FMD[y, x])
emblem = emblem_generic(["..#..", ".###.", "#####", "..#..", ".#..."], {'#': (120, 230, 255)})
p = finish(cv, 'XIV', 'TEMPESTE', out='14_temperance_tempeste', emblem=emblem)
print(p)
