# -*- coding: utf-8 -*-
# XII – Der Gehängte: Alleria, the Queen of Spiders
# Alleria hängt kopfüber, gelassen, an ihrem eigenen Spinnenfaden von einem lebenden Ast;
# ein Bein gestreckt, das andere zur „4“ gekreuzt, die Spinnenbeine elegant gefaltet, das lange
# schwarze Haar fällt nach unten, um den Kopf ein leuchtender Heiligenschein.
# Mondlicht-Wald mit großen Radnetzen voller Tautropfen.
from tarot_b4_helpers import *

cv = new_card()
rnd = random.Random(12)
yy, xx = np.indices((H, W))
ART = (yy >= AY0) & (yy < AY1) & (xx >= AX0) & (xx < AX1)

# ---------------------------------------------------------------- Himmel + Mond
sky(cv, [(6, 8, 24), (12, 18, 44), (22, 34, 72), (34, 58, 98), (48, 82, 118), (40, 70, 96)])
stars(cv, 90, y1=200, seed=12, big=0.08)
MX, MY, MR = 125, 104, 40
glow2(cv, MX, MY, 92, (150, 190, 230), k=0.45, mix=0.3)
MOON = [(96, 112, 140), (140, 156, 182), (182, 194, 212), (214, 222, 234), (236, 240, 246), (252, 252, 255)]
moon_disc(cv, MX, MY, MR, MOON, craters=[(108, 90, 7), (140, 118, 9), (132, 86, 4), (112, 124, 5), (150, 96, 3)],
          seed=5, bias=0.06, k=1.8, alb=0.2, halo=(200, 220, 250), halo_r=12)

# ---------------------------------------------------------------- ferner Wald (zwei Schichten) + Nebel
FAR1 = [(20, 36, 58), (28, 48, 72), (38, 62, 86), (52, 80, 104)]
FAR2 = [(10, 20, 34), (16, 30, 46), (24, 42, 58), (36, 58, 74)]
for i, x in enumerate(range(8, 250, 17)):
    h = 18 + (i * 37) % 14
    puffy_cloud(cv, x, 212 - (i * 13) % 12, 26, h, FAR1, seed=i)
# ferne Stämme im Dunst (mit feinen Ästen)
for (tx, tw, ty) in [(24, 4, 150), (46, 3, 170), (70, 5, 160), (98, 3, 180), (150, 3, 176), (176, 5, 156), (200, 3, 168), (226, 4, 152)]:
    for y in range(ty, 244):
        for x in range(tx, tx + tw):
            px(cv, x, y, FAR1[2] if x == tx else FAR1[1] if x < tx + tw - 1 else FAR1[0])
    for (by_, sd) in [(ty + 14, -1), (ty + 26, 1), (ty + 38, -1)]:
        for q in range(9):
            px(cv, (tx if sd < 0 else tx + tw - 1) + sd * q, by_ - q * 0.8, FAR1[1])
fog(cv, 196, 240, (110, 140, 170), k=2.0, seed=4, mix=0.35)
for i, x in enumerate(range(0, 256, 21)):
    h = 20 + (i * 29) % 12
    puffy_cloud(cv, x + 6, 236 - (i * 7) % 10, 32, h, FAR2, seed=40 + i)
for y in range(236, AY1):
    for x in range(AX0, AX1):
        px(cv, x, y, rampc(FAR2, 0.25 - (y - 236) * 0.004, x, y))
fog(cv, 228, 272, (90, 120, 150), k=1.8, seed=8, mix=0.3)

# ---------------------------------------------------------------- Stämme links/rechts
BARK = [(10, 8, 16), (22, 18, 28), (38, 32, 44), (58, 50, 62), (84, 76, 88), (118, 112, 126)]


def trunk(x0, x1, y0, y1, flare=0, seed=0):
    M = np.zeros((H, W), bool)
    for y in range(y0, y1):
        t = max(0, (y - (y1 - 30)) / 30)
        a = x0 - int(flare * t * t); b = x1 + int(flare * t * t)
        M[y, max(0, a):b] = True
    cx = (x0 + x1) / 2
    Hm = np.sqrt(np.maximum(0, 1 - ((xx - cx) / ((x1 - x0) / 2 + 6)) ** 2)) * 3.0
    Hm += (noise(H, W, 2, seed=seed, octaves=2) - 0.5) * 1.2
    Hm += np.sin(xx * 1.3 + noise(H, W, 8, seed=seed + 1) * 6) * 0.45     # Borkenrillen
    relief_mask(cv, M, Hm.astype(np.float32), BARK, k=1.5, bias=-0.02)
    mask_outline(cv, M, (4, 4, 10))
    return M


TL = trunk(0, 30, AY0, AY1, flare=14, seed=3)
TR = trunk(220, 250, AY0, AY1, flare=14, seed=9)

# ---------------------------------------------------------------- Ast (lebendes Holz) quer oben
WOOD = [(14, 10, 14), (32, 24, 26), (54, 42, 40), (80, 64, 56), (110, 92, 78), (146, 128, 110)]
MOSS = [(12, 34, 30), (22, 58, 42), (40, 88, 56), (70, 122, 72), (116, 160, 96)]
BM = np.zeros((H, W), bool)
bc = {}
for x in range(0, W):
    t = x / W
    c = 52 + math.sin(x * 0.045) * 2.2 + t * 1.5
    r = 7.5 - t * 2.4
    bc[x] = (c, r)
    BM[int(c - r):int(c + r) + 1, x] = True
Hb = np.zeros((H, W), np.float32)
for x in range(W):
    c, r = bc[x]
    for y in range(int(c - r), int(c + r) + 1):
        Hb[y, x] = math.sqrt(max(0, 1 - ((y - c) / (r + 1)) ** 2)) * 3
Hb += (noise(H, W, 2, seed=21, octaves=2) - 0.5) * 1.0
Hb += np.sin(yy * 1.7 + xx * 0.12 + noise(H, W, 10, seed=2) * 5) * 0.35
relief_mask(cv, BM, Hb, WOOD, k=1.5)
# Knorren
for (kx, ky) in [(62, 53), (186, 52)]:
    for y in range(ky - 3, ky + 4):
        for x in range(kx - 4, kx + 5):
            d = math.hypot((x - kx) / 1.4, y - ky)
            if d < 3:
                px(cv, x, y, WOOD[0] if d < 1.5 else WOOD[1] if (x < kx) else WOOD[3])
mask_outline(cv, BM, (4, 4, 10))
# Moos oben auf dem Ast
for x in range(AX0, AX1):
    c, r = bc[x]
    top = int(c - r)
    n = noise(H, W, 5, seed=31)[top, x]
    if n > 0.45:
        for k in range(int((n - 0.45) * 10) + 1):
            px(cv, x, top + k, rampc(MOSS, 0.9 - k * 0.25, x, top + k))
        px(cv, x, top - 1, MOSS[1] if n > 0.55 else (4, 4, 10))
# Zweige mit Blättern (lebender Baum) – nach oben und außen
LEAF = [(8, 30, 26), (16, 52, 40), (30, 82, 56), (56, 118, 72), (98, 160, 100)]


def leaf(x, y, ang, L=5):
    for s in range(L):
        w = math.sin(math.pi * (s + 0.5) / L) * 1.6
        for t in np.linspace(-w, w, 4):
            X = x + math.cos(ang) * s - math.sin(ang) * t
            Y = y + math.sin(ang) * s + math.cos(ang) * t
            v = 0.7 - 0.3 * (t / (w + 0.01)) - s * 0.03
            if in_art(X, Y):
                px(cv, X, Y, rampc(LEAF, v, int(X), int(Y)))


for (sx, sy, ang, L) in [(44, 46, -2.0, 12), (92, 45, -1.3, 9), (160, 46, -1.9, 10), (206, 47, -1.1, 8), (70, 58, 1.8, 7)]:
    ex, ey = sx + math.cos(ang) * L, sy + math.sin(ang) * L
    bline(cv, sx, sy, ex, ey, WOOD[1])
    bline(cv, sx + 1, sy, ex + 1, ey, WOOD[2])
    for i in range(3):
        t = 0.4 + i * 0.3
        leaf(sx + (ex - sx) * t, sy + (ey - sy) * t, ang + (0.9 if i % 2 else -0.9), 5)
    leaf(ex, ey, ang, 6)
# hängende Flechten-Fäden unter dem Ast
for x in range(AX0 + 4, AX1 - 4, 9):
    if x in range(100, 152):
        continue
    c, r = bc[x]
    L = 3 + (x * 7) % 9
    for k in range(L):
        px(cv, x + (1 if k > L * 0.6 else 0), int(c + r) + 1 + k, MOSS[1] if k % 3 else MOSS[2])

# ---------------------------------------------------------------- Waldboden
GROUND = [(6, 10, 14), (12, 22, 22), (20, 36, 30), (32, 54, 40), (50, 78, 52)]
for y in range(282, AY1):
    for x in range(AX0, AX1):
        top = 282 + int(2 * math.sin(x * 0.11) + 1.5 * math.sin(x * 0.37))
        if y >= top:
            v = 0.6 - (y - top) * 0.03 + (noise(H, W, 3, seed=77)[y, x] - 0.5) * 0.6
            px(cv, x, y, rampc(GROUND, v, x, y))
# Farne
FERN = [(14, 40, 36), (28, 70, 56), (50, 108, 76), (92, 152, 104)]


def fern(x, y, L, ang, bend=0.04):
    """Farnwedel: gebogene Mittelrippe mit wechselständigen Fiederblättchen"""
    X, Y, a = x, y, ang
    for s in range(L):
        a += bend
        X += math.cos(a); Y += math.sin(a)
        if s % 2 == 0 and s < L - 1:
            ln = 6.5 * math.sin(math.pi * (s + 2) / (L + 2)) + 1
            for sd in (-1, 1):
                aa = a + sd * 1.0
                for q in range(1, int(ln) + 1):
                    qx = X + math.cos(aa) * q + math.cos(a) * q * 0.5
                    qy = Y + math.sin(aa) * q + math.sin(a) * q * 0.5 + q * q * 0.04
                    c = FERN[3] if (sd < 0 and q < ln - 1) else FERN[2] if q < ln - 1 else FERN[1]
                    if in_art(qx, qy):
                        px(cv, qx, qy, c)
    X, Y, a = x, y, ang
    for s in range(L):
        a += bend
        X += math.cos(a); Y += math.sin(a)
        if in_art(X, Y):
            px(cv, X, Y, FERN[1])


# Gras am Bodenrand (mondbeschienen)
GRASS = [(10, 26, 26), (18, 44, 38), (32, 70, 54), (60, 108, 80), (110, 160, 130)]
for x in range(AX0, AX1):
    top = 282 + int(2 * math.sin(x * 0.11) + 1.5 * math.sin(x * 0.37))
    for rep in range(2):
        if rnd.random() < 0.7:
            h = rnd.randint(2, 7)
            lean = rnd.choice([-1, 0, 1])
            for k in range(h):
                X_ = x + (lean if k > h * 0.6 else 0)
                px(cv, X_, top + rep * 5 - k, GRASS[3] if k == h - 1 else GRASS[2] if k > h / 2 else GRASS[1])
for (x, y, L, a) in [(34, 294, 24, -2.2), (38, 296, 22, -1.2), (28, 298, 16, -2.8),
                     (212, 294, 24, -0.9), (208, 296, 22, -2.0), (218, 298, 16, -0.4),
                     (80, 300, 14, -2.4), (170, 300, 14, -0.7)]:
    fern(x, y, L, a, bend=0.05 if a < -1.57 else -0.05)
# Pilze (leuchtend blau) und blaue Blume wie auf der Karte
SHROOM = [(20, 40, 90), (40, 90, 170), (80, 160, 230), (170, 230, 255)]
for (mx_, my_, mr) in [(58, 292, 4), (66, 295, 3), (190, 290, 4), (182, 294, 2.5), (98, 297, 2.5)]:
    glow2(cv, mx_, my_ - 2, 9, (90, 170, 240), k=0.45, mix=0.3)
    for y in range(int(my_ - mr) - 1, my_ + 1):
        for x in range(int(mx_ - mr) - 1, int(mx_ + mr) + 2):
            if ((x - mx_) / (mr + 0.5)) ** 2 + ((y - my_ + 0.5) / (mr * 0.8)) ** 2 <= 1 and y <= my_ - 1:
                px(cv, x, y, rampc(SHROOM, 0.9 - (y - my_ + mr) / (mr + 1) * 0.5 - (x - mx_) * 0.06, x, y))
    for y in range(my_, my_ + 4):
        px(cv, mx_, y, (150, 170, 190)); px(cv, mx_ + 1, y, (90, 110, 130))
for (bx, by) in [(150, 293), (30, 298), (122, 299)]:
    for (dx, dy) in [(0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
        px(cv, bx + dx, by + dy, (70, 110, 220) if dy >= 0 else (120, 160, 250))
    px(cv, bx, by, (250, 230, 110))

# ---------------------------------------------------------------- große Spinnennetze mit Tau
LIGHT = (MX, MY)
drops = []
# links oben: zwischen Stamm und Ast
e, d = spider_web(cv, 58, 96, [(-95, 38), (-60, 44), (-25, 42), (5, 34), (35, 38), (70, 44), (105, 50), (140, 30), (170, 28),
                               (200, 30), (235, 42), (260, 40)], 11, seed=3, light=LIGHT, k=0.6, dew=0.28)
drops += d
for (a, b) in [((58 + math.cos(math.radians(-95)) * 38, 96 + math.sin(math.radians(-95)) * 38), (54, 59)),
               ((28, 88), (30, 96))]:
    bline(cv, a[0], a[1], b[0], b[1], (190, 204, 230), 0.6)
# rechts: großes Netz zwischen rechtem Stamm und Ast
e, d = spider_web(cv, 190, 108, [(-100, 50), (-70, 52), (-40, 36), (-10, 30), (20, 30), (50, 38), (80, 46), (110, 44),
                                 (140, 40), (170, 44), (200, 42), (230, 46)], 11, seed=8, light=LIGHT, k=0.6, dew=0.3)
drops += d
# kleines Netz unten rechts zwischen Farn und Stamm
e, d = spider_web(cv, 204, 262, [(-90, 18), (-45, 16), (0, 16), (45, 20), (90, 22), (135, 20), (180, 14), (225, 16), (270, 18)],
                  7, seed=15, light=LIGHT, k=0.6, dew=0.35)
drops += d
# kleines Netz unten links
e, d = spider_web(cv, 44, 250, [(-80, 20), (-30, 18), (10, 14), (50, 20), (100, 22), (150, 18), (190, 14), (230, 20)],
                  7, seed=19, light=LIGHT, k=0.55, dew=0.35)
drops += d
for i, (x, y) in enumerate(drops):
    dew_drop(cv, x, y, big=(i % 4 == 0), sparkle_it=(i % 9 == 0))

# ---------------------------------------------------------------- Heiligenschein (hinter dem Kopf)
HX, HY = 125, 227
glow2(cv, HX, HY, 46, (255, 230, 160), k=0.6, mix=0.35)
rays2(cv, HX, HY, 24, 26, 52, (255, 236, 180), width=0.1, k=0.55, mix=0.4)
for y in range(HY - 34, HY + 35):
    for x in range(HX - 34, HX + 35):
        d_ = math.hypot(x - HX, y - HY)
        if 27.2 <= d_ <= 30.2 and in_art(x, y):
            v = 0.9 - 0.35 * ((y - HY) / 30) - 0.15 * ((x - HX) / 30)
            px(cv, x, y, rampc(GOLD7[2:], v, x, y))
        elif 30.2 < d_ <= 31.2 and in_art(x, y):
            px(cv, x, y, (120, 70, 20))

# ================================================================= Alleria (aufrecht gezeichnet, dann gespiegelt)
# Koordinaten hier „aufrecht“: yu = 349 - y_final
HAIR = [(4, 4, 10), (10, 12, 24), (20, 24, 42), (34, 40, 66), (56, 66, 100), (92, 106, 142)]
PALE = [(96, 66, 86), (156, 122, 140), (208, 184, 192), (232, 216, 218), (246, 236, 234), (254, 250, 248)]
DRESS = [(6, 4, 12), (16, 10, 28), (30, 20, 50), (50, 34, 78), (76, 56, 110), (110, 90, 146)]
TIGHTS = [(6, 4, 12), (14, 12, 26), (26, 24, 44), (42, 40, 66), (66, 66, 98), (104, 106, 140)]
LACE = [(14, 12, 26), (40, 40, 66), (80, 84, 116), (130, 136, 168), (190, 196, 220)]
CHIT = [(4, 6, 14), (12, 16, 32), (24, 32, 56), (44, 56, 88), (74, 92, 130), (130, 152, 192)]
RED = [(60, 4, 14), (130, 10, 30), (210, 30, 44), (255, 90, 90), (255, 200, 190)]
SILK = [(120, 130, 160), (180, 190, 214), (230, 236, 248)]

f = Fig(W, H)
# ---- Spinnenbeine (am Rücken angesetzt, hinter allem) – elegant gefaltet
LEGS = [  # (Ansatz, Knie, Mittelgelenk, Spitze) für die linke Seite; rechts gespiegelt
    ((117, 190), (86, 206), (80, 234), (95, 258)),
    ((116, 186), (74, 186), (66, 212), (74, 238)),
    ((116, 182), (74, 166), (66, 140), (76, 116)),
    ((117, 178), (88, 154), (86, 128), (97, 108)),
]
for i, (a, b, c, d) in enumerate(LEGS):
    for side in (1, -1):
        def X(p):
            return (p[0] if side == 1 else 250 - p[0], p[1])
        A, B, C, D = X(a), X(b), X(c), X(d)
        f.part('sl%d%d_f' % (i, side)); f.limb(A[0], A[1], B[0], B[1], 2.9, 2.2, 'c')
        f.part('sl%d%d_k' % (i, side)); f.ellipse(B[0], B[1], 2.6, 2.6, 'j')
        f.part('sl%d%d_t' % (i, side))
        f.curve([B, ((B[0] + C[0]) / 2 - side * 1.5, (B[1] + C[1]) / 2), C], 'c', w=4.0, w1=3.0)
        f.part('sl%d%d_m' % (i, side)); f.ellipse(C[0], C[1], 1.8, 1.8, 'j')
        f.part('sl%d%d_s' % (i, side)); f.curve([C, ((C[0] + D[0]) / 2 + side * 2, (C[1] + D[1]) / 2), D], 'c', w=2.6, w1=1.0)
# ---- gekreuztes Bein (hinter dem gestreckten): Oberschenkel nach außen, Schienbein zurück -> „4“
f.part('thighB'); f.limb(131, 203, 150, 227, 5.8, 4.4, 'l')
f.part('shinB'); f.limb(150, 227, 140, 232, 4.3, 4.6, 'l'); f.limb(140, 232, 126, 237, 4.6, 2.7, 'l')
f.part('footB'); f.limb(126, 237, 114, 239, 2.8, 1.3, 'b')
# ---- gestrecktes Bein, Fuß gestreckt (Spitze zeigt im Endbild nach oben)
f.part('legA'); f.limb(119, 203, 120, 236, 6.2, 4.2, 'l')
f.limb(120, 236, 120.5, 247, 4.3, 4.9, 'l'); f.limb(120.5, 247, 121, 266, 4.9, 2.7, 'l')
f.part('footA'); f.limb(121, 266, 122, 283, 3.1, 1.2, 'b')
f.part('ankle'); f.rect(116, 262, 125, 266, 'w')        # Seidenfaden-Wickel um den Knöchel
# ---- Arme hinter dem Rücken (Unterarme hinter dem Körper)
f.part('forearms'); f.limb(102, 181, 116, 190, 2.8, 2.4, 'd', mirror=True)
# ---- Körper: Hüfte (Strumpfhose) + Mieder
f.part('hips'); f.ellipse(125, 197, 14, 10, 'l')
f.part('bodice')
f.poly([(109, 157), (141, 157), (142, 165), (137, 174), (134, 184), (125, 188), (116, 184), (113, 174), (108, 165)], 'd')
f.part('belt')          # Spitzengürtel mit Zacken (Netzspitze)
f.poly([(115, 181), (135, 181), (137, 186), (125, 188), (113, 186)], 'e')
f.part('armL'); f.limb(110, 160, 102, 181, 3.7, 2.9, 'd')
f.part('armR'); f.limb(140, 160, 148, 181, 3.7, 2.9, 'd')
f.part('cuffs'); f.ellipse(102, 182, 3.2, 2.2, 'e'); f.ellipse(148, 182, 3.2, 2.2, 'e')
f.part('collar')      # hoher Spitzenkragen wie ein Netz
f.poly([(114, 151), (136, 151), (144, 158), (106, 158)], 'e')
f.part('neckline'); f.poly([(120, 154), (130, 154), (125, 162)], 's')
# ---- Kopf
f.part('neck'); f.rect(121, 145, 129, 155, 's')
# Haar: Schopf + einzelne Strähnen (abwechselnde Teile -> feine Trennlinien)
f.part('hairback')
f.poly([(106, 140), (103, 122), (104, 100), (146, 100), (147, 122), (144, 140)], 'h')
LOCKS = []
for i in range(9):
    x = 104 + i * 5.25
    end = [80, 72, 77, 68, 74, 67, 76, 70, 79][i]
    w0 = 9.5
    wob = [1.5, -1, 2, -1.5, 1, -2, 1.5, -1, 2][i]
    spread = (x - 125) * 0.16
    LOCKS.append([(x, 104), (x + wob + spread * 0.5, 86), (x + spread - wob, 72), (x + spread + wob * 0.5, end)])
for i, P in enumerate(LOCKS):
    f.part('lock%d' % (i % 2)); f.curve(P, 'h', w=8.5, w1=1.0)
f.part('face')
f.ellipse(125, 131, 18, 16, 's')
f.poly([(107, 131), (143, 131), (141, 142), (133, 149), (125, 152), (117, 149), (109, 142)], 's')
f.part('ears'); f.ellipse(107, 136, 2.2, 3.5, 's'); f.ellipse(143, 136, 2.2, 3.5, 's')
f.part('hairline')      # Stirn frei: das Haar fällt (im Endbild) vom Scheitel nach unten weg
f.poly([(106, 130), (107, 118), (115, 111), (125, 109), (135, 111), (143, 118), (144, 130),
        (140, 122), (133, 120), (125, 122), (117, 120), (110, 122)], 'h')
f.part('lockL'); f.curve([(108, 124), (104, 134), (105, 146), (108, 153)], 'h', w=4, w1=1.5)
f.part('lockR'); f.curve([(142, 124), (146, 134), (145, 146), (142, 153)], 'h', w=4, w1=1.5)
f.part('tiara')          # silbernes Spinnen-Diadem
f.curve([(110, 123), (117, 119), (125, 118), (133, 119), (140, 123)], 'g', w=2)
f.poly([(125, 112), (128, 117), (125, 121), (122, 117)], 'g')
f.outline()
MATS = {
    'c': mat(CHIT, pillow=2, k=1.8, bias=0.04, spec=True, spec_col=(190, 210, 240)),
    'j': mat(CHIT, pillow=2, k=1.6, bias=0.16, spec=True, spec_col=(200, 220, 250)),
    'l': mat(TIGHTS, pillow=3, k=1.9, bias=0.02, spec=True, spec_col=(140, 140, 190)),
    'b': mat(DRESS, pillow=2, k=1.8, bias=0.1, spec=True, spec_col=(170, 150, 210)),
    'w': mat(SILK, pillow=1, k=1.2, bias=0.1),
    'd': mat(DRESS, pillow=4, k=1.7, bias=0.02, folds=(0.05, 0.35, 0.5)),
    'e': mat(LACE, pillow=1.5, k=1.4, bias=0.02),
    's': mat(PALE, pillow=3, k=1.1, bias=0.1),
    'h': mat(HAIR, pillow=3, k=2.0, bias=0.0, noise=0.5, nscale=2),
    'g': mat(SILVER, pillow=1.5, k=1.8, bias=0.1, spec=True),
}
# Licht von unten im aufrechten Bild = von oben im gespiegelten Endbild
fig = f.render(MATS, light=(-0.62, 0.62, 0.48))

LASH = (12, 4, 18)


def red_eye(c, x0, y0, flip=False):
    """großes rotes Anime-Auge 7x8 (aufrecht), Wimpern oben"""
    w, h = 7, 9
    IR = [(70, 4, 14), (150, 14, 30), (214, 36, 46), (250, 96, 90), (255, 170, 150)]
    for j in range(h):
        for i in range(w):
            ii = (w - 1 - i) if flip else i
            X, Y = x0 + ii, y0 + j
            if j <= 1:
                px(c, X, Y, LASH)
                continue
            if j == h - 1:
                if 1 <= i <= w - 2:
                    px(c, X, Y, LASH if i in (1, w - 2) else (60, 30, 50))
                continue
            if i == 0 or i == w - 1:
                px(c, X, Y, (240, 236, 244) if j > 2 else LASH)
                continue
            t = (j - 2) / (h - 3)
            col = IR[1] if t < 0.3 else IR[2] if t < 0.65 else IR[3]
            if 2 <= i <= 4 and 3 <= j <= 5:
                col = (40, 0, 10)                      # Pupille
            px(c, X, Y, col)
    # Glanzlichter
    gx = x0 + (4 if flip else 1)
    px(c, gx, y0 + 2, (255, 255, 255)); px(c, gx + (-1 if flip else 1), y0 + 2, (255, 255, 255))
    px(c, gx, y0 + 3, (255, 255, 255))
    px(c, x0 + (1 if flip else 5), y0 + 6, (255, 220, 210))
    # Wimpernschwung außen
    ox = x0 - 1 if not flip else x0 + w
    px(c, ox, y0, LASH); px(c, ox + (-1 if not flip else 1), y0 - 1, LASH)


def face(c):
    red_eye(c, 110, 130)
    red_eye(c, 133, 130, flip=True)
    for x in range(111, 117):
        px(c, x, 126, HAIR[2])            # Brauen (sanft geschwungen)
    px(c, 110, 127, HAIR[2])
    for x in range(134, 140):
        px(c, x, 126, HAIR[2])
    px(c, 140, 127, HAIR[2])
    px(c, 125, 142, PALE[1]); px(c, 126, 143, PALE[2])     # Nase
    for x in range(122, 129):
        px(c, x, 147, (110, 30, 56))      # sanftes Lächeln, dunkle Lippen
    px(c, 121, 146, (110, 30, 56)); px(c, 129, 146, (110, 30, 56))
    for x in range(123, 128):
        px(c, x, 148, (180, 80, 104))
    blush(c, 110, 142, (230, 130, 160)); blush(c, 138, 142, (230, 130, 160))
    # Rubin im Diadem
    px(c, 125, 116, RED[2]); px(c, 124, 115, RED[3]); px(c, 125, 117, RED[1])
    # Brosche am Kragen
    for (dx, dy, cc) in [(0, 0, RED[2]), (-1, 0, RED[3]), (0, -1, RED[3]), (1, 0, RED[1]), (0, 1, RED[1])]:
        px(c, 125 + dx, 158 + dy, cc)
    # rote Schnürung am Mieder
    for y in range(163, 180, 3):
        w = 3 if y < 172 else 2
        px(c, 125 - w, y, RED[1]); px(c, 125 + w, y, RED[1])
        for q in range(-w + 1, w):
            px(c, 125 + q, y + 1, RED[2] if q <= 0 else RED[1])
    # rote Sanduhr (Schwarze-Witwe-Zeichen) als Gürtelschnalle
    for (dx, dy) in [(-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2), (-1, 3), (0, 3), (1, 3),
                     (-2, 4), (-1, 4), (0, 4), (1, 4), (2, 4)]:
        px(c, 125 + dx, 182 + dy, RED[3] if dy < 2 else RED[2])
    # gestreifte Strümpfe (feine Querstreifen unterhalb der Knie)
    for y in range(238, 266):
        if y % 4 == 0:
            for x in range(110, 132):
                if tuple(c.a[y, x]) in [tuple(v) for v in TIGHTS[1:]]:
                    c.a[y, x] = lerp(tuple(c.a[y, x]), (120, 70, 140), 0.45)
    # Spitzenmuster (Netz) auf dem Mieder
    for y in range(160, 181):
        for x in range(108, 143):
            if ((x - 125) + (y - 150)) % 5 == 0 or ((x - 125) - (y - 150)) % 5 == 0:
                if tuple(c.a[y, x]) in [tuple(v) for v in DRESS[1:]]:
                    c.a[y, x] = lerp(tuple(c.a[y, x]), LACE[2], 0.28)
    # Glanzsträhnen im Haar
    for i, P in enumerate(LOCKS):
        if i % 2 == 0:
            continue
        for t in np.linspace(0.1, 0.7, 26):
            k_ = t * (len(P) - 1)
            j = min(int(k_), len(P) - 2); u = k_ - j
            x = P[j][0] + (P[j + 1][0] - P[j][0]) * u + 1
            y = P[j][1] + (P[j + 1][1] - P[j][1]) * u
            if c.a[int(y), int(x)].tolist() != list(OUT):
                px(c, x, y, HAIR[4] if 0.2 < t < 0.5 else HAIR[3])
    # Gelenkringe an den Spinnenbeinen
    for (a, b, cc, d) in LEGS:
        for side in (1, -1):
            for p in (b, cc):
                X_ = p[0] if side == 1 else 250 - p[0]
                px(c, X_, p[1], RED[2]); px(c, X_ - side, p[1], RED[1])

fig = upright_details(fig, face)
fig = fig[::-1].copy()
fig = np.roll(fig, 9, axis=0)   # Figur etwas tiefer -> sichtbarer Faden
FIGM = fig[..., 3] > 0

# Mondlicht-Randlicht auf der Silhouette (Seite zum Mond)
op = FIGM
edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
for y, x in zip(*np.where(op)):
    if fig[y, x, :3].tolist() == list(OUT):
        continue
    dx, dy = MX - x, MY - y
    L = math.hypot(dx, dy) or 1
    nx, ny = int(round(x + dx / L * 2)), int(round(y + dy / L * 2))
    if 0 <= nx < W and 0 <= ny < H and (not op[ny, nx] or fig[ny, nx, :3].tolist() == list(OUT)):
        if L < 110 and (x + y) % 2 == 0:
            fig[y, x, :3] = lerp(tuple(fig[y, x, :3]), (180, 200, 240), 0.45)
cv.paste(fig, 0, 0)

# ---------------------------------------------------------------- Seidenfaden vom Ast zum Knöchel
ankle_x = 121
for y in range(58, 92):
    if not FIGM[y, ankle_x - 1]:
        bright = sum(int(v) for v in cv.a[y, ankle_x - 1]) > 480      # vor dem Mond: dunkle Silhouette
        px(cv, ankle_x - 1, y, (70, 80, 112) if bright else ((230, 238, 252) if y % 3 else (170, 184, 214)))
        if bright:
            blend_px(cv, ankle_x - 2, y, (120, 130, 160), 0.35)
# Befestigung am Ast: kleines Knäuel
for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1), (-2, 1), (2, 1)]:
    px(cv, ankle_x - 1 + dx, 58 + dy, SILK[2] if dy <= 0 else SILK[1])
sparkle(cv, ankle_x - 1, 65, (255, 255, 255), r=2, c2=(170, 200, 240))

# ---------------------------------------------------------------- kleine Spinnen an Fäden, Glühwürmchen
def tiny_spider(x, y, thread_top):
    for yy_ in range(thread_top, y - 1):
        if in_art(x, yy_):
            blend_px(cv, x, yy_, (200, 214, 240), 0.55)
    for (dx, dy, c) in [(0, 0, CHIT[2]), (1, 0, CHIT[3]), (0, 1, CHIT[1]), (1, 1, CHIT[2]), (0, -1, CHIT[3]), (1, -1, CHIT[3]),
                        (0, 2, RED[2])]:
        px(cv, x + dx, y + dy, c)
    for s in (-1, 1):
        for (dx, dy) in [(2, -1), (3, -2), (2, 1), (3, 2), (2, 0), (3, 0)]:
            px(cv, x + (dx if s > 0 else 1 - dx), y + dy, CHIT[0])


tiny_spider(84, 156, 60)
tiny_spider(176, 176, 60)
for (x, y) in [(48, 174), (200, 150), (88, 268), (164, 250), (36, 128), (212, 210), (150, 280)]:
    glow2(cv, x, y, 4, (220, 255, 150), k=0.7, mix=0.35)
    px(cv, x, y, (250, 255, 200)); px(cv, x + 1, y, (200, 240, 120)); px(cv, x, y + 1, (170, 220, 100))
for (x, y) in [(96, 248), (154, 254), (125, 266)]:
    sparkle(cv, x, y, (255, 250, 220), r=2, c2=(230, 190, 110))

FMD = cv2.dilate(FIGM.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
vignette2(cv, strength=0.5, protect=lambda x, y: math.hypot(x - MX, y - MY) <= MR + 1 or FMD[y, x])
emblem = emblem_generic(["#.#.#", ".###.", "##o##", ".###.", "#.#.#"], {'#': (210, 214, 236), 'o': (230, 40, 50)})
p = finish(cv, 'XII', 'ALLERIA', out='12_hanged_man_alleria', emblem=emblem)
print(p)
