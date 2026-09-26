# -*- coding: utf-8 -*-
# 0 – Der Narr: Tobi, the Average Student
# Tobi schlendert fröhlich und ahnungslos auf die Klippenkante zu: Bündel am Stock über der Schulter,
# weiße Rose in der Hand, der Beagle springt warnend an ihm hoch. Über ihm schwebt sein "?".
# Helle Sonne, schneebedeckte Berge, tief unten das Tal im Dunst.
from tarot_fmhe_helpers import *

cv = new_card()
rnd = random.Random(3)
# ---------------------------------------------------------------- Himmel
sky(cv, [(44, 104, 206), (62, 134, 226), (98, 170, 240), (150, 204, 248), (206, 232, 252), (246, 246, 232)], y1=250)
SX, SY, SR = 54, 78, 17
rays(cv, SX, SY, 14, SR + 3, 120, (255, 250, 214), width=0.1, k=0.55, mix=0.45)
glow(cv, SX, SY, 60, (255, 252, 226), k=0.55, mix=0.4)
SUN = [(236, 160, 40), (250, 200, 70), (255, 230, 120), (255, 246, 180), (255, 252, 226), (255, 255, 246)]
disc_relief(cv, SX, SY, SR, SUN, noise_k=0.12, bias=0.2, k=1.4, halo=(255, 255, 230), halo_r=7)
CL = [(126, 156, 214), (170, 198, 238), (212, 228, 250), (240, 246, 255), (255, 255, 255)]
puffy_cloud(cv, 196, 70, 48, 14, CL, seed=4)
puffy_cloud(cv, 222, 104, 30, 9, CL, seed=8)
puffy_cloud(cv, 120, 60, 26, 7, CL, seed=11)
puffy_cloud(cv, 30, 140, 30, 9, CL, seed=6)
# Vögel in der Ferne
for (bx, by) in [(176, 128), (186, 122), (168, 120)]:
    for dx, dy in [(-2, -1), (-1, 0), (1, 0), (2, -1)]:
        px(cv, bx + dx, by + dy, (60, 80, 120))
    px(cv, bx, by + 1, (60, 80, 120))
# ---------------------------------------------------------------- Berge
FAR = [(92, 104, 160), (116, 130, 186), (140, 156, 206), (170, 186, 224), (200, 212, 238)]
SNOW = [(150, 170, 214), (190, 206, 236), (224, 234, 250), (246, 250, 255), (255, 255, 255)]
mountains(cv, [(40, 168, 40), (104, 150, 46), (176, 160, 40), (226, 146, 44)], 240, FAR, SNOW, snow_depth=22,
          seed=2, haze=(210, 226, 246), haze_k=0.35)
NEAR = [(46, 76, 96), (62, 100, 110), (84, 126, 120), (112, 152, 130), (150, 184, 150)]
SNOW2 = [(140, 164, 200), (184, 204, 232), (220, 232, 248), (244, 250, 255), (255, 255, 255)]
mountains(cv, [(20, 196, 34), (70, 188, 40), (150, 200, 36), (210, 180, 38)], 250, NEAR, SNOW2, snow_depth=10,
          seed=5, ridge_k=1.2, haze=(200, 220, 240), haze_k=0.2)
fog(cv, 205, 250, (236, 244, 252), k=2.6, seed=3, mix=0.5)
# ---------------------------------------------------------------- Tal tief unten (rechts hinter der Klippe)
VAL = [(70, 120, 130), (96, 146, 140), (126, 172, 150), (160, 196, 166), (200, 222, 196)]
nv = noise(H, W, 5, seed=21)
for y in range(226, AY1):
    for x in range(150, AX1):
        v = 0.85 - (y - 226) / 76 * 0.45 + (nv[y, x] - 0.5) * 0.6
        px(cv, x, y, rampc(VAL, v, x, y))
# Felder im Tal (kleine Parzellen)
for (fx, fy, fw, fh, c) in [(200, 250, 12, 4, (176, 196, 140)), (214, 262, 14, 5, (196, 190, 130)), (206, 278, 16, 5, (150, 190, 150)),
                            (222, 244, 10, 3, (190, 206, 160))]:
    for y in range(fy, fy + fh):
        for x in range(fx - (y - fy), fx + fw - (y - fy)):
            if (x + y) % 2 == 0 or y == fy:
                px(cv, x, y, c)
# Fluss, der sich durchs Tal schlängelt
for y in range(230, AY1):
    t = (y - 230) / 70
    cxr = 196 + math.sin(t * 7) * 10 + t * 18
    wr = 0.8 + t * 3
    for x in range(int(cxr - wr), int(cxr + wr) + 1):
        c = (214, 236, 250) if abs(x - cxr) < wr * 0.5 else (150, 196, 226)
        px(cv, x, y, c)
# Baumtupfen im Tal
for _ in range(90):
    x = rnd.randint(180, AX1 - 2); y = rnd.randint(232, AY1 - 2)
    c1 = (40, 84, 80); c2 = (70, 120, 100)
    px(cv, x, y, c2); px(cv, x + 1, y, c1); px(cv, x, y + 1, c1)
# kleine Tannen im Tal (je tiefer, desto größer)
for _ in range(26):
    x = rnd.randint(176, AX1 - 3); y = rnd.randint(236, AY1 - 2)
    hh = 2 + int((y - 236) / 22)
    for k in range(hh + 1):
        for dx in range(-(k // 2), k // 2 + 1):
            px(cv, x + dx, y - hh + k, (34, 76, 70) if dx >= 0 else (60, 110, 90))
fog(cv, 226, AY1, (230, 240, 250), k=1.6, seed=7, mix=0.4)

# ---------------------------------------------------------------- Plateau mit Klippenkante
def edge_x(y):
    # rechter Rand der Grasfläche: erst diagonal (Kante weicht zurück), dann fast senkrecht (Steilwand)
    if y < 262:
        return 140 + (y - 238) * 2.1
    return 190 + (y - 262) * 0.12 + math.sin(y * 0.7) * 1.0
def face_w(y):
    return 0 if y < 242 else min(40, (y - 242) * 0.9 + 3)
GR = [(26, 74, 30), (42, 106, 40), (68, 144, 50), (104, 180, 64), (152, 212, 96), (200, 236, 140)]
Mg = np.zeros((H, W), bool)
gtop = {}
for x in range(AX0, AX1):
    gtop[x] = int(238 + 4 * math.sin(x * 0.035 + 0.8))
nz = noise(H, W, 4, seed=12)
for y in range(AY0, AY1):
    for x in range(AX0, AX1):
        if y >= gtop[x] and x < edge_x(y):
            Mg[y, x] = True
            v = 0.72 - (y - 240) / 62 * 0.3 + (nz[y, x] - 0.5) * 0.55
            px(cv, x, y, rampc(GR, v, x, y))
for x in range(AX0, AX1):
    y = gtop[x]
    if Mg[y, x]:
        px(cv, x, y, GR[5] if x % 3 else GR[4])
# Steilwand der Klippe (liegt im Schatten, Licht kommt von links)
ROCK = [(62, 50, 58), (98, 82, 84), (138, 118, 110), (176, 156, 136), (212, 196, 170), (240, 230, 206)]
Mr = np.zeros((H, W), bool)
for y in range(238, AY1):
    ex = edge_x(y); fw = face_w(y)
    for x in range(int(ex), int(ex + fw) + 1):
        if in_art(x, y) and not Mg[y, x]:
            Mr[y, x] = True
facet_rock(cv, Mr, ROCK, n=34, seed=4, bias=0.02, crack=(46, 36, 48),
           shade_x=lambda x, y: -(x - edge_x(y)) * 0.02 - max(0, y - 280) * 0.012)
fog(cv, 284, AY1, (220, 232, 246), k=2.0, seed=17, mix=0.3)
outline_mask(cv, Mr, (26, 26, 40))
for y in range(240, AY1):
    ex = int(edge_x(y))
    px(cv, ex, y, ROCK[4] if y % 3 else ROCK[3])
# Grasbüschel, die über die Kante hängen
for y in range(240, AY1, 2):
    ex = int(edge_x(y))
    for k in range(rnd.randint(1, 3)):
        px(cv, ex + k, y + k, GR[2]); px(cv, ex + k, y + k + 1, GR[1])
grass_tufts(cv, 320, AX0, AX1, 240, AY1, GR, seed=3, mask=Mg)
# Wiesenblumen
for _ in range(34):
    x = rnd.randint(AX0 + 2, 180); y = rnd.randint(246, AY1 - 3)
    if Mg[y, x]:
        small_flower(cv, x, y, rnd.choice([(255, 255, 255), (255, 214, 90), (250, 150, 180), (190, 170, 255)]))
# größere Blumen im Vordergrund
for (fx, fy, c) in [(24, 280, (255, 255, 255)), (40, 290, (255, 214, 90)), (62, 296, (255, 255, 255)), (150, 298, (250, 150, 180)),
                    (170, 294, (255, 255, 255)), (22, 262, (190, 170, 255))]:
    for (dx, dy) in [(0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
        px(cv, fx + dx, fy + dy, c if abs(dx) + abs(dy) == 2 else lerp(c, (0, 0, 0), 0.2))
    px(cv, fx, fy, (255, 200, 60)); px(cv, fx, fy + 3, GR[1]); px(cv, fx, fy + 4, GR[1])
# Steine
for (sx_, sy_, rx_, ry_) in [(160, 244, 5, 3), (30, 294, 8, 5), (58, 262, 4, 2.5)]:
    m = ellipse_mask(sx_, sy_, rx_, ry_)
    pillow_relief(cv, m, ROCK, pillow=4, k=1.8, bias=0.2, noise_k=0.6, seed=sx_)
    outline_mask(cv, m, (30, 30, 40))
# bröckelnde Steinchen fallen in den Abgrund
for (x, y) in [(214, 252), (218, 262), (221, 276)]:
    px(cv, x, y, ROCK[1]); px(cv, x + 1, y, ROCK[2]); px(cv, x, y + 1, ROCK[0])
# Schatten unter Tobi und dem Hund
for (sx_, sy_, rx_) in [(106, 291, 34), (168, 290, 14)]:
    for y in range(sy_ - 3, sy_ + 4):
        for x in range(sx_ - rx_, sx_ + rx_):
            if ((x - sx_) / rx_) ** 2 + ((y - sy_) / 3.5) ** 2 <= 1 and BAYER4[y % 4, x % 4] < 0.6:
                blend_px(cv, x, y, (14, 40, 20), 0.45)

# ---------------------------------------------------------------- Farben
HAIR = [(120, 80, 8), (186, 140, 20), (232, 196, 40), (250, 230, 90), (255, 248, 170), (255, 255, 226)]
JACKET = [(12, 22, 14), (22, 40, 24), (34, 62, 34), (50, 88, 44), (72, 114, 56)]
LIME = [(40, 90, 10), (96, 160, 16), (160, 220, 40), (210, 250, 100), (240, 255, 190)]
PANTS = [(16, 18, 26), (30, 34, 46), (48, 54, 70), (72, 78, 98), (100, 106, 128)]
SHOE = [(40, 14, 8), (90, 36, 16), (150, 70, 30), (200, 110, 56), (236, 160, 100)]
CLOTH = [(70, 10, 20), (130, 20, 30), (190, 40, 44), (232, 80, 70), (255, 140, 120)]
WOOD = [(46, 26, 12), (90, 54, 24), (136, 88, 44), (180, 130, 76)]
DOG = [(14, 12, 18), (30, 28, 36), (50, 48, 58), (76, 74, 86), (106, 104, 118)]
DOG_L = [(70, 70, 80), (110, 110, 120), (150, 150, 160), (196, 196, 204), (232, 232, 238)]
ROSE = [(120, 130, 150), (176, 184, 204), (220, 226, 240), (246, 248, 255), (255, 255, 255)]
LEAF = [(14, 48, 20), (26, 86, 30), (44, 124, 40), (76, 162, 56), (130, 200, 90)]

BG = cv.a.copy()   # Figur wird am Ende als Ebene nach links verschoben
DXF = -12
f = Fig(W, H)
# ---- Bündel am Stock (hinter allem)
STx0, STy0 = 117, 201      # Hand
STx1, STy1 = 54, 116       # Stockende
f.part('bundle')
f.ellipse(48, 132, 15, 13, 'c')
f.poly([(40, 124), (56, 122), (60, 134), (36, 136)], 'c')
f.part('knot')
f.poly([(46, 118), (54, 114), (60, 121), (52, 124)], 'c')
f.poly([(52, 118), (60, 112), (63, 118), (57, 122)], 'c')
f.part('stick')
f.limb(STx0 + 3, STy0 + 4, STx1 - 2, STy1 - 3, 1.8, 1.6, 'w')
# ---- Hund: hinteres Hinterbein + Schwanz
f.part('dtail'); f.curve([(192, 262), (200, 252), (203, 242), (201, 236)], 'd', w=4, w1=2)
f.part('dlegB'); f.limb(190, 268, 196, 287, 4.5, 3, 'd')
f.ellipse(197, 288, 4, 2.5, 'd')
# ---- Beine Tobi (hinteres Bein zuerst)
f.part('legB')
f.limb(112, 226, 101, 254, 8, 7, 'p')
f.limb(101, 254, 90, 279, 7, 6, 'p')
f.part('shoeB')
f.poly([(80, 278), (94, 274), (101, 280), (98, 287), (84, 288), (79, 284)], 'b')
f.part('legF')
f.limb(127, 226, 139, 252, 8.5, 7.5, 'p')
f.limb(139, 252, 142, 280, 7.5, 6.5, 'p')
f.part('shoeF')
f.poly([(133, 279), (148, 278), (160, 284), (160, 291), (133, 291)], 'b')
# ---- Oberkörper: Schuljacke
f.part('body')
f.poly([(100, 176), (140, 176), (146, 196), (144, 226), (100, 228), (96, 200)], 'j')
f.part('hem')          # limettengrüner Saum
f.poly([(99, 221), (145, 220), (145, 227), (100, 229)], 'l')
f.part('shirt')
f.poly([(110, 174), (130, 174), (120, 202)], 'W')
f.part('tie')
f.poly([(118, 177), (122, 177), (123, 194), (120, 199), (117, 194)], 'l')
f.part('knot'); f.rect(118, 175, 122, 178, 'l')
f.part('collarL'); f.poly([(110, 174), (118, 175), (113, 182)], 'W')
f.part('collarR'); f.poly([(130, 174), (122, 175), (127, 182)], 'W')
f.part('lapL'); f.poly([(103, 178), (110, 174), (120, 203), (107, 194)], 'j')
f.part('lapR'); f.poly([(137, 178), (130, 174), (120, 203), (133, 194)], 'j')
f.part('trimL'); f.line(110, 176, 119, 202, 'l', w=1)
f.part('trimR'); f.line(130, 176, 121, 202, 'l', w=1)
# ---- Arm mit dem Stock (vor dem Körper, Hand vor der Brust)
f.part('armB'); f.limb(102, 182, 98, 204, 7.5, 6.5, 'j')
f.part('foreB'); f.limb(98, 204, 114, 203, 6, 5.5, 'j')
f.part('cuffB'); f.limb(110, 203, 113, 203, 5.5, 5.5, 'l')
f.part('stick2'); f.limb(STx0 + 5, STy0 + 6, STx0 - 6, STy0 - 7, 1.8, 1.8, 'w')
f.part('handB'); f.ellipse(117, 201, 5, 4.5, 's')
# ---- Arm mit der Rose (nach rechts oben ausgestreckt)
f.part('armF'); f.limb(139, 183, 153, 194, 7.5, 6.5, 'j')
f.part('foreF'); f.limb(153, 194, 162, 178, 6, 5.5, 'j')
f.part('cuffF'); f.limb(159, 183, 161, 180, 5.8, 5.8, 'l')
f.part('stem'); f.curve([(164, 178), (165, 168), (168, 158), (171, 150)], 'g', w=1.6)
f.part('rleaf'); f.poly([(166, 166), (173, 160), (178, 162), (171, 168)], 'g')
f.part('rleaf2'); f.poly([(166, 162), (159, 158), (156, 160), (163, 165)], 'g')
f.part('handF'); f.ellipse(163, 177, 5.5, 5, 's')
f.part('rose'); f.ellipse(172, 145, 8, 7, 'r')
f.poly([(165, 146), (179, 146), (176, 152), (172, 154), (168, 152)], 'r')
# ---- Hals + Kopf
f.part('neck'); f.rect(116, 164, 126, 176, 's')
cx, cy = 121, 146
f.part('hairB')      # Haarmasse hinter dem Gesicht (stachelig)
spikes = []
for i in range(19):
    a = math.radians(150 + i * (250 / 18))
    rr = 27 + ([8, 5, 10, 6, 9][i % 5] if i % 2 == 0 else -1) + (3 if 5 <= i <= 12 else 0)
    spikes.append((cx + 1 + math.cos(a) * rr, cy - 2 + math.sin(a) * rr * 0.95))
f.poly(spikes + [(cx + 22, cy + 18), (cx - 20, cy + 18)], 'h')
f.part('face')
f.ellipse(cx + 1, cy + 2, 18, 16, 's')
f.poly([(cx - 16, cy + 4), (cx + 19, cy + 4), (cx + 17, cy + 13), (cx + 11, cy + 19), (cx + 5, cy + 22), (cx - 3, cy + 21),
        (cx - 11, cy + 17), (cx - 15, cy + 11)], 's')
f.part('ear'); f.ellipse(cx - 17, cy + 8, 3, 4.5, 's')
f.part('bangs')      # Pony: Strähnen bis über die Augen, nach rechts gekämmt
f.poly([(cx - 20, cy + 10), (cx - 20, cy - 8), (cx - 10, cy - 18), (cx + 4, cy - 20), (cx + 16, cy - 14), (cx + 22, cy - 2),
        (cx + 21, cy + 8), (cx + 17, cy - 2), (cx + 14, cy + 6), (cx + 10, cy - 3), (cx + 6, cy + 5), (cx + 1, cy - 4),
        (cx - 3, cy + 5), (cx - 7, cy - 3), (cx - 12, cy + 5), (cx - 14, cy - 2), (cx - 16, cy + 10)], 'h')
f.part('sideburn'); f.poly([(cx - 20, cy), (cx - 15, cy + 2), (cx - 13, cy + 16), (cx - 19, cy + 12)], 'h')
# ---- Hund (Beagle): springt an Tobi hoch, Pfoten erhoben
f.part('dbody')
f.limb(190, 266, 176, 240, 10, 9, 'd')
f.part('dchest'); f.ellipse(176, 246, 6, 8, 'D')
f.part('dlegF'); f.limb(184, 272, 184, 288, 4.5, 3.5, 'd')
f.ellipse(186, 289, 4.5, 2.5, 'd')
f.part('dthigh'); f.ellipse(188, 270, 7, 8, 'd')
f.part('dpawB'); f.limb(178, 240, 166, 234, 3.5, 3, 'd'); f.ellipse(164, 233, 3.5, 3, 'D')
f.part('dhead')
f.ellipse(174, 224, 10, 9, 'd')
f.part('dmuzzle'); f.ellipse(165, 228, 6.5, 5, 'D')
f.part('dnose'); f.ellipse(160, 226, 2.5, 2, 'n')
f.part('dear'); f.poly([(176, 216), (184, 216), (188, 226), (186, 236), (180, 234), (178, 224)], 'e')
f.part('dpawF'); f.limb(176, 246, 160, 244, 3.5, 3, 'd'); f.ellipse(158, 243, 3.5, 3, 'D')
f.outline()

MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.1),
    'h': mat(HAIR, pillow=4, k=1.9, noise=1.1, nscale=2, bias=0.05),
    'j': mat(JACKET, pillow=4, k=1.5, folds=(0.25, 0.05, 0.5), bias=0.08),
    'l': mat(LIME, pillow=1.5, k=1.2, bias=0.05),
    'W': mat(WHITE_CLOTH, pillow=2, k=1.2, bias=0.1),
    'p': mat(PANTS, pillow=3, k=1.4, folds=(0.05, 0.35, 0.4), bias=0.08),
    'b': mat(SHOE, pillow=2.5, k=1.5, spec=True, spec_col=(250, 200, 150)),
    'c': mat(CLOTH, pillow=5, k=1.5, folds=(0.3, 0.2, 0.9)),
    'w': mat(WOOD, pillow=1.2, k=1.2, bias=0.1),
    'd': mat(DOG, pillow=4, k=1.5, noise=0.6, nscale=2, bias=0.12),
    'D': mat(DOG_L, pillow=3, k=1.3, bias=0.05),
    'e': mat([(6, 6, 10), (18, 16, 22), (34, 32, 42), (56, 54, 66)], pillow=3, k=1.4, bias=0.1),
    'n': mat([(10, 8, 12), (30, 26, 34), (70, 64, 80)], pillow=1, k=1),
    'g': mat(LEAF, pillow=1.5, k=1.2, bias=0.1),
    'r': mat(ROSE, pillow=4, k=1.6, bias=0.05),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)

# ---------------------------------------------------------------- Details
def inside(x, y):
    return fig[int(y), int(x), 3] > 0 and tuple(cv.a[int(y), int(x)]) != OUT
# Gesicht: Blick nach oben rechts, fröhlich
EYE = (60, 140, 230)
anime_eye(cv, 115, 150, EYE, h=8, w=5)
anime_eye(cv, 130, 150, EYE, h=8, w=5, flip=True)
# Pupille nach oben gedreht (Glanz oben rechts)
for (ex_, ) in [(116,), (131,)]:
    px(cv, ex_ + 2, 151, (255, 255, 255)); px(cv, ex_ + 3, 152, (220, 240, 255))
# Brauen (hochgezogen, sorglos) – unter dem Pony teilweise sichtbar
for x in range(115, 120): px(cv, x, 147 - (1 if x == 117 else 0), HAIR[0])
for x in range(130, 135): px(cv, x, 147 - (1 if x == 132 else 0), HAIR[0])
px(cv, 127, 161, SKIN[2]); px(cv, 128, 162, SKIN[1])     # Nase
# offener, lachender Mund (D-Form)
MD, MR_ = (100, 26, 30), (160, 44, 50)
for x in range(121, 130): px(cv, x, 163, MD)
px(cv, 120, 162, MD); px(cv, 130, 162, MD)
px(cv, 121, 164, MD); px(cv, 129, 164, MD)
for x in range(122, 129): px(cv, x, 164, (250, 250, 252) if x < 127 else MR_)
px(cv, 122, 165, MD); px(cv, 128, 165, MD)
for x in range(123, 128): px(cv, x, 165, MR_)
px(cv, 123, 166, MD); px(cv, 127, 166, MD)
for x in range(124, 127): px(cv, x, 166, (236, 116, 120))
for x in range(124, 127): px(cv, x, 167, MD)
blush(cv, 113, 162); blush(cv, 134, 162)
# Wangenglanz
px(cv, 112, 158, SKIN[5])
# Haarsträhnen-Highlights
for (hx, hy, L) in [(104, 128, 8), (112, 124, 7), (124, 122, 9), (134, 128, 7), (140, 136, 6), (98, 140, 5)]:
    for k in range(L):
        x = hx + k * 0.6; y = hy + k
        if inside(x, y):
            px(cv, x, y, HAIR[4] if k < L - 2 else HAIR[3])
# Knöpfe + Wappen auf der Jacke
for yb in (208, 214):
    px(cv, 136, yb, LIME[3]); px(cv, 137, yb, LIME[2])
for (x, y, c) in [(104, 190, LIME[3]), (105, 190, LIME[2]), (104, 191, LIME[1]), (105, 191, LIME[2])]:
    px(cv, x + 32, y - 2, c)
# Finger (Hand am Stock und Hand mit Rose)
for (fx, fy) in [(119, 199), (119, 201), (119, 203)]:
    px(cv, fx, fy, SKIN[1]); px(cv, fx + 1, fy, SKIN[2])
px(cv, 114, 198, SKIN[4]); px(cv, 115, 198, SKIN[4])
for (fx, fy) in [(160, 174), (160, 177), (161, 180)]:
    px(cv, fx, fy, SKIN[1])
# Rose: Blütenblätter als Linien (Kelch + Spirale)
PL = (118, 124, 156)
arc_px(cv, 172, 146, 6.5, 4.5, 0.15, math.pi - 0.15, PL, 40)
arc_px(cv, 172, 145, 4.2, 3.0, 0.25, math.pi - 0.25, PL, 30)
arc_px(cv, 167, 142, 3, 3.5, math.pi * 0.55, math.pi * 1.35, PL, 16)
arc_px(cv, 177, 142, 3, 3.5, -math.pi * 0.35, math.pi * 0.45, PL, 16)
for t in np.linspace(0.5, 3 * math.pi, 40):
    r = 0.5 + t * 0.28
    px(cv, 172 + math.cos(t) * r, 142 + math.sin(t) * r * 0.8, PL)
px(cv, 170, 140, ROSE[4]); px(cv, 168, 141, ROSE[4])
# Punkte auf dem Tuch
for (x, y) in [(40, 128), (48, 124), (56, 132), (44, 138), (36, 134), (52, 140), (58, 124)]:
    if inside(x, y):
        px(cv, x, y, (255, 236, 220)); px(cv, x + 1, y, (240, 200, 190)); px(cv, x, y + 1, (240, 200, 190))
# Flicken auf dem Bündel
for y in range(136, 141):
    for x in range(52, 58):
        if inside(x, y):
            px(cv, x, y, OUT if (y in (136, 140) or x in (52, 57)) else ((90, 60, 140) if (x + y) % 2 else (120, 90, 170)))
# Hund: Auge, Zunge, Halsband
px(cv, 170, 221, (30, 90, 200)); px(cv, 171, 221, (80, 150, 250)); px(cv, 170, 220, OUT); px(cv, 171, 220, OUT)
px(cv, 171, 222, (10, 10, 20))
for (x, y) in [(162, 232), (163, 232), (162, 233), (163, 234)]:
    px(cv, x, y, (240, 110, 130))
px(cv, 164, 231, (100, 30, 40))
for (x, y) in [(169, 234), (170, 235), (171, 236), (172, 237), (173, 237), (174, 238)]:
    px(cv, x, y, (210, 40, 40)); px(cv, x, y + 1, (130, 20, 30))
px(cv, 172, 239, GOLD[4]); px(cv, 172, 240, GOLD[2])
# Schmetterling (flattert sorglos mit)
for (x, y, c) in [(-2, -1, (250, 190, 60)), (-1, -1, (255, 220, 100)), (-2, 0, (250, 190, 60)), (-1, 0, (255, 236, 150)),
                  (1, -1, (255, 220, 100)), (2, -1, (250, 190, 60)), (1, 0, (255, 236, 150)), (2, 0, (250, 190, 60)),
                  (-1, 1, (230, 150, 40)), (1, 1, (230, 150, 40)), (0, -1, OUT), (0, 0, OUT), (0, 1, OUT)]:
    px(cv, 78 + x, 186 + y, c)
# ---------------------------------------------------------------- Das große "?"
glyph(cv, '?', 42, 124, 88, [(120, 140, 190), (180, 196, 230), (224, 232, 250), (248, 250, 255), (255, 255, 255)],
      outline=(40, 50, 90), shadow=(20, 40, 110))
for (x, y) in [(104, 82), (146, 98), (110, 104), (142, 76)]:
    sparkle(cv, x, y, (255, 255, 255), r=2, c2=(170, 200, 250))
# Funkeln
for (x, y) in [(196, 170), (30, 200), (150, 132)]:
    sparkle(cv, x, y, (255, 252, 220), r=1)

shift_layer(cv, BG, DXF)
finish(cv, '0', 'TOBI', out='00_fool_tobi', emblem=emblem_generic(
    ["..#..", ".#.#.", "...#.", "..#..", ".....", "..#.."], {'#': (255, 240, 200)}))
print('ok')
