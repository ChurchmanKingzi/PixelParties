# -*- coding: utf-8 -*-
# VII – Der Wagen: Rubin, the Dragoneer Champion
# Rubin steht aufrecht im goldroten Streitwagen unter dem sternenbesetzten Baldachin, den Speer in
# der Rechten, eine Flamme in der Linken. Vor dem Wagen ruhen die beiden Drachenjungen in
# Kontrastfarben (Red Dragoneer und Green Dragoneer) statt der Sphingen. Dahinter Fluss und
# Stadtmauer mit Türmen im Abendrot.
from tarot_iv_vii_helpers import *

cv = new_card()
rnd = random.Random(77)

# ---------------------------------------------------------------- Himmel (Abendrot)
sky(cv, [(56, 20, 60), (120, 36, 64), (196, 70, 60), (240, 130, 70), (252, 190, 100), (255, 226, 160)], y1=196)
stars(cv, 22, y1=100, seed=9, cols=[(255, 230, 200), (255, 200, 180)], big=0.15)
disc_relief(cv, 125, 168, 30, [(230, 110, 40), (248, 160, 60), (255, 206, 110), (255, 236, 170), (255, 250, 220)],
            noise_k=0.1, bias=0.2, k=1.0, halo=(255, 220, 150), halo_r=16)
CL = [(150, 50, 70), (200, 90, 80), (236, 140, 100), (252, 190, 140), (255, 226, 190)]
for (cx, cy, w, h, sd) in [(40, 80, 44, 9, 1), (214, 70, 40, 8, 2), (60, 120, 36, 7, 3), (196, 114, 44, 8, 4)]:
    puffy_cloud(cv, cx, cy, w, h, CL, seed=sd)
cloud_band(cv, 140, AX0, 110, (250, 180, 130), (220, 120, 100), amp=2, seed=1)
cloud_band(cv, 132, 140, AX1, (250, 180, 130), (220, 120, 100), amp=2, seed=3)

# ---------------------------------------------------------------- Stadtmauer mit Türmen
WALLC = [(60, 30, 40), (96, 52, 52), (136, 80, 66), (176, 114, 84), (214, 156, 110), (240, 196, 146)]
ROOF = [(60, 10, 20), (110, 20, 30), (160, 36, 40), (206, 66, 56), (236, 110, 90)]
Hw = np.zeros((H, W), np.float32); Mw = np.zeros((H, W), bool)
yy, xx = np.indices((H, W))
WALL_TOP = 170
towers = [(28, 138, 12), (70, 150, 9), (180, 150, 9), (222, 134, 12), (125, 144, 10)]
for y in range(120, 198):
    for x in range(AX0, AX1):
        inwall = y >= WALL_TOP or (y >= WALL_TOP - 4 and (x // 5) % 2 == 0)
        intower = False
        for (tx, ty, tw) in towers:
            if abs(x - tx) <= tw and (y >= ty or (y >= ty - 4 and ((x - tx + tw) // 4) % 2 == 0)):
                intower = True
        if inwall or intower:
            Mw[y, x] = True
            by = (y - 120) % 6; bx = (x + (4 if ((y - 120) // 6) % 2 else 0)) % 9
            Hw[y, x] = min(by, 5 - by, bx, 8 - bx, 1.5) * 0.6
            for (tx, ty, tw) in towers:
                if abs(x - tx) <= tw and y >= ty:
                    Hw[y, x] += math.sqrt(max(0, 1 - ((x - tx) / (tw + 1)) ** 2)) * 3
Hw += (noise(H, W, 3, seed=71) - 0.5) * 0.6
relief(cv, Hw, np.zeros((H, W), np.int32), [WALLC], Mw, k=1.2, bias=-0.05)
# Kegeldächer + Banner auf den Türmen
for (tx, ty, tw) in towers:
    for y in range(ty - 26, ty - 3):
        hw = (y - (ty - 26)) / 23 * (tw + 3)
        for x in range(int(tx - hw), int(tx + hw) + 1):
            v = 0.75 - (x - tx + hw) / (2 * hw + 1) * 0.6
            px(cv, x, y, rampc(ROOF, v, x, y))
    for y in range(ty - 34, ty - 25):
        px(cv, tx, y, (60, 40, 30))
    for (dx, dy) in [(1, 0), (2, 0), (3, 0), (4, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2)]:
        px(cv, tx + dx, ty - 34 + dy, (240, 200, 60) if dy == 0 else (220, 50, 40))
    # leuchtende Fenster
    for wy in (ty + 6, ty + 14):
        if wy < WALL_TOP:
            px(cv, tx, wy, (255, 220, 120)); px(cv, tx, wy + 1, (255, 180, 80)); px(cv, tx - 1, wy, (60, 30, 30))
# Tor in der Mitte
for y in range(WALL_TOP + 4, 198):
    for x in range(115, 136):
        if (x - 125) ** 2 / 100 + (y - (WALL_TOP + 12)) ** 2 / 64 <= 1 or y >= WALL_TOP + 12:
            px(cv, x, y, (40, 20, 30) if abs(x - 125) < 9 else (70, 40, 40))
mist(cv, 176, 198, (255, 200, 150), mix=0.35, k=0.8, seed=72)

# ---------------------------------------------------------------- Fluss
WATER = [(30, 40, 90), (50, 80, 140), (80, 130, 190), (140, 180, 220), (220, 230, 240)]
for y in range(196, 212):
    for x in range(AX0, AX1):
        v = 0.4 + 0.25 * math.sin(x * 0.35 + y * 1.3) * 0.5 + (y - 196) / 40
        c = rampc(WATER, v, x, y)
        # Spiegelung der Sonne
        if abs(x - 125) < 20 - (y - 196) and (x + y * 3) % 5 < 2:
            c = (255, 210, 130)
        px(cv, x, y, c)
for x in range(AX0, AX1):
    px(cv, x, 196, (200, 160, 130)); px(cv, x, 212, (60, 70, 50))

# ---------------------------------------------------------------- Ufer / Wiese / Weg
GRASS = [(30, 60, 30), (50, 92, 40), (80, 126, 50), (120, 160, 70), (170, 196, 110)]
ROAD = [(80, 50, 36), (120, 80, 54), (160, 118, 80), (196, 156, 110), (226, 196, 150)]
NZ = noise(H, W, 3, seed=73)
for y in range(213, AY1):
    t = (y - 213) / (AY1 - 213)
    rw = 30 + t * 60
    for x in range(AX0, AX1):
        v = 0.7 - t * 0.35 + (NZ[y, x] - 0.5) * 0.5
        if abs(x - CX) < rw:
            c = rampc(ROAD, v - 0.05, x, y)
            if (int((y - 213) ** 1.3) % 7 == 0) and abs(x - CX) < rw - 3:
                c = ROAD[1]
        else:
            c = rampc(GRASS, v, x, y)
        px(cv, x, y, c)
for _ in range(160):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(214, AY1 - 1)
    t = (y - 213) / (AY1 - 213)
    if abs(x - CX) > 32 + t * 60:
        for k in range(rnd.randint(2, 4)):
            px(cv, x, y - k, GRASS[4] if k == 0 else GRASS[3])
for _ in range(24):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(216, AY1 - 3)
    t = (y - 213) / (AY1 - 213)
    if abs(x - CX) > 34 + t * 60:
        c = rnd.choice([(255, 220, 90), (255, 120, 80), (255, 255, 255)])
        sparkle(cv, x, y, c, r=1, c2=lerp(c, GRASS[2], 0.4))

# ---------------------------------------------------------------- Streitwagen: Räder, Kasten, Säulen, Baldachin
RED_L = [(60, 6, 14), (110, 16, 24), (164, 30, 34), (210, 60, 50), (240, 110, 86)]
CANOPY = [(10, 14, 40), (20, 28, 74), (34, 48, 116), (56, 76, 160), (90, 110, 200)]
WOOD = [(40, 22, 10), (80, 48, 22), (124, 80, 40), (166, 116, 64)]


def chariot_back(f):
    # hintere Säulen
    f.part('postB'); f.rect(92, 58, 95, 200, 'g'); f.rect(155, 58, 158, 200, 'g')
    # Baldachin
    f.part('canopy')
    top = [(x, 45 - 3 * math.sin(math.pi * (x - 60) / 130)) for x in range(60, 191)]
    fringe = [(x, 64 + (2 if (x // 5) % 2 else 0)) for x in range(190, 59, -1)]
    f.poly(top + fringe, 'c')
    f.part('canopyrim'); f.rect(60, 60, 190, 63, 'g')


fcb, cb = fig_draw(cv, chariot_back, {'W': mat(WOOD, pillow=2, k=1.4, noise=0.5, nscale=1), 'w': mat(WOOD, pillow=1, k=1.2),
                                      'g': mat(GOLD, pillow=1.5, k=1.7, spec=True), 'c': mat(CANOPY, pillow=4, k=1.3, folds=(0.25, 0.0, 0.5))})
# Sterne auf dem Baldachin
for (x, y) in [(70, 52), (84, 48), (98, 54), (112, 49), (126, 55), (140, 49), (154, 54), (168, 48), (180, 53), (76, 58), (118, 58), (162, 58), (134, 60)]:
    if fcb.L[y, x] == 'c':
        sparkle(cv, x, y, (255, 236, 150), r=1, c2=(200, 160, 60))
        px(cv, x, y, (255, 255, 220))
# Goldfransen am Baldachin
for x in range(60, 191, 2):
    px(cv, x, 64 + (2 if (x // 5) % 2 else 0), GOLD[3]); px(cv, x, 65 + (2 if (x // 5) % 2 else 0), GOLD[1])

# ---------------------------------------------------------------- Rubin
RUB = [(56, 4, 22), (106, 14, 40), (164, 30, 56), (214, 64, 80), (246, 120, 124), (255, 180, 176)]
CAPE = [(60, 6, 10), (116, 16, 16), (176, 36, 24), (222, 70, 36), (248, 120, 60)]
STEEL = [(26, 28, 36), (54, 58, 70), (90, 94, 108), (132, 136, 150), (180, 184, 196), (230, 232, 240)]
HORN = [(40, 4, 16), (90, 14, 30), (150, 30, 50), (200, 70, 80), (240, 150, 150)]
BLUE = [(10, 20, 70), (20, 50, 140), (40, 90, 200), (100, 150, 240)]
RY = 104       # Kopfmitte


def rubin(f):
    # Umhang hinter dem Körper
    f.part('cape'); f.poly([(98, 126), (152, 126), (170, 150), (180, 200), (70, 200), (80, 150)], 'C')
    # Hörner
    f.part('hornL'); f.curve([(117, RY - 10), (113, RY - 24), (110, RY - 36), (111, RY - 44)], 'H', w=8, w1=1.5)
    f.part('hornR'); f.curve([(133, RY - 10), (137, RY - 24), (140, RY - 36), (139, RY - 44)], 'H', w=8, w1=1.5)
    # Nackenkrause / Stachelkamm hinter dem Kopf
    f.part('frill')
    f.poly([(104, RY - 2), (96, RY - 12), (102, RY - 10), (100, RY - 20), (108, RY - 12), (125, RY - 14), (142, RY - 12),
            (150, RY - 20), (148, RY - 10), (154, RY - 12), (146, RY - 2), (150, RY + 8), (100, RY + 8)], 'R')
    # Hals, Körper
    f.part('neck'); f.rect(117, RY + 12, 133, RY + 26, 'R')
    f.part('torso'); f.poly([(104, 128), (146, 128), (150, 176), (100, 176)], 'R')
    f.part('plate'); f.poly([(106, 130), (144, 130), (146, 166), (136, 176), (125, 178), (114, 176), (104, 166)], 'S')
    f.part('plate2'); f.poly([(112, 146), (138, 146), (136, 170), (125, 174), (114, 170)], 'S')
    f.part('belt'); f.rect(100, 176, 150, 182, 'L')
    f.part('buckle'); f.rect(121, 175, 129, 183, 'g')
    f.part('tassets')
    for i, x0 in enumerate((100, 112, 125, 138)):
        f.poly([(x0, 182), (x0 + 12, 182), (x0 + 11, 198), (x0 + 1, 198)], 'S')
    # rechter Arm (Bildseite links) mit Speer
    f.part('upperR'); f.limb(102, 134, 90, 160, 7, 6, 'R')
    f.part('spear'); f.rect(88, 52, 91, 200, 'w')
    f.part('spearhead'); f.poly([(89.5, 36), (95, 48), (92, 56), (87, 56), (84, 48)], 'm')
    f.part('spearguard'); f.rect(84, 56, 95, 59, 'g')
    f.part('pennant'); f.poly([(91, 60), (108, 64), (100, 68), (110, 74), (91, 74)], 'C')
    f.part('forearmR'); f.limb(90, 160, 90, 176, 5.5, 5, 'R')
    f.part('fistR'); f.ellipse(90, 170, 6, 5.5, 'R')
    # linker Arm (Bildseite rechts) hält die Flamme
    f.part('upperL'); f.limb(148, 134, 162, 156, 7, 6, 'R')
    f.part('forearmL'); f.limb(162, 156, 164, 142, 5.5, 5, 'R')
    f.part('handL'); f.ellipse(164, 140, 6, 4.5, 'R')
    f.part('flame', line=False)
    f.poly([(156, 138), (158, 128), (160, 132), (162, 120), (165, 128), (168, 114), (170, 128), (173, 124), (172, 138), (164, 142)], 'f')
    f.part('flamecore', line=False)
    f.poly([(160, 138), (162, 130), (165, 133), (167, 124), (169, 134), (168, 139)], 'F')
    # Schulterstücke (Gold/Blau-Streifen wie auf der Karte)
    f.part('pauldL'); f.ellipse(100, 132, 10, 8, 'S')
    f.part('pauldR'); f.ellipse(150, 132, 10, 8, 'S')
    # Kopf: Drachenkopf von vorn (breite Stirn, lange Schnauze)
    f.part('head'); f.ellipse(125, RY - 2, 14, 11,'Q')
    f.part('jaw'); f.poly([(113, RY + 4), (137, RY + 4), (134, RY + 18), (125, RY + 24), (116, RY + 18)],'Q')
    f.part('snout'); f.poly([(117, RY + 1), (133, RY + 1), (132, RY + 14), (129, RY + 20), (121, RY + 20), (118, RY + 14)],'Q')
    f.part('browL'); f.poly([(109, RY - 5), (121, RY - 1), (123, RY - 5), (113, RY - 10)],'Q')
    f.part('browR'); f.poly([(141, RY - 5), (129, RY - 1), (127, RY - 5), (137, RY - 10)],'Q')


MATS = {
    'R': mat(RUB, pillow=4, k=1.5, noise=0.5, nscale=1, bias=0.02),
    'Q': mat(RUB, pillow=4, k=1.6, bias=0.05),
    'C': mat(CAPE, pillow=6, k=1.4, folds=(0.3, 0.02, 0.9)),
    'H': mat(HORN, pillow=2, k=1.7, spec=True),
    'S': mat(STEEL, pillow=3, k=1.8, spec=True, spec_col=(255, 255, 255)),
    'L': mat(BROWN, pillow=1.5, k=1.3),
    'g': mat(GOLD, pillow=1.5, k=1.8, spec=True),
    'w': mat(WOOD, pillow=1, k=1.2),
    'm': mat(SILVER, pillow=2, k=2.0, spec=True),
    'f': mat(FIRE[1:], pillow=3, k=1.2, bias=0.1),
    'F': mat(FIRE[3:], pillow=2, k=1.0, bias=0.2),
}
glow(cv, 125, 130, 60, (255, 200, 140), k=0.3, mix=0.25)
fr, rb = fig_draw(cv, rubin, MATS)
# Streifen auf den Schulterstücken
for (cx, sg) in ((100, -1), (150, 1)):
    for x in range(cx - 10, cx + 11):
        for (y, c) in [(129, GOLD[3]), (130, GOLD[2]), (132, BLUE[2]), (133, BLUE[1]), (135, GOLD[3])]:
            recolor_on(cv, fr, x, y, c, 'S')
# Schuppen auf der roten Haut (kleine Bögen)
for y in range(90, 200, 4):
    for x in range(80, 175, 4):
        xo = x + (2 if (y // 4) % 2 else 0)
        recolor_on(cv, fr, xo, y, RUB[1], 'R'); recolor_on(cv, fr, xo + 1, y + 1, RUB[1], 'R')
        recolor_on(cv, fr, xo - 1, y + 1, RUB[1], 'R')
# Gesicht: schmale, glühende Augen unter den Brauenwülsten, Nüstern, Reißzähne, Mittelkamm
for y in range(RY - 12, RY + 18):
    recolor_on(cv, fr, 125, y, RUB[4] if y % 3 else RUB[3], 'RQ')
for sg in (1, -1):
    X = lambda x: 125 - sg * (125 - x)
    glow(cv, X(116), RY - 1, 7, (255, 220, 140), k=0.6, mix=0.35)
    # schräges, glühendes Mandelauge (Kontur oben dick)
    for (x, y) in [(111, RY - 4), (112, RY - 4), (113, RY - 4), (114, RY - 3), (115, RY - 3), (116, RY - 2), (117, RY - 2),
                   (118, RY - 1), (119, RY), (120, RY + 1), (112, RY - 3), (111, RY - 3), (112, RY - 1), (113, RY), (114, RY + 1),
                   (115, RY + 1), (116, RY + 2), (117, RY + 2), (118, RY + 2), (119, RY + 1)]:
        px(cv, X(x), y, OUT)
    for (x, y, c) in [(113, RY - 3, (255, 255, 255)), (113, RY - 2, (255, 255, 230)), (114, RY - 2, (255, 255, 255)),
                      (115, RY - 2, (255, 250, 200)), (114, RY - 1, (255, 240, 170)), (115, RY - 1, (255, 230, 130)),
                      (116, RY - 1, (255, 210, 100)), (117, RY - 1, (255, 190, 80)), (115, RY, (255, 200, 90)),
                      (116, RY, (250, 150, 50)), (117, RY, (240, 120, 40)), (118, RY, (230, 100, 30)), (116, RY + 1, (220, 80, 20)),
                      (117, RY + 1, (200, 60, 20)), (118, RY + 1, (180, 50, 20)), (114, RY, (255, 220, 120))]:
        px(cv, X(x), y, c)
    px(cv, X(122), RY + 17, RUB[0]); px(cv, X(122), RY + 16, RUB[1])          # Nüstern
    for (x, y) in [(118, RY + 19), (118, RY + 20), (118, RY + 21), (119, RY + 19)]:                         # Hauer
        px(cv, X(x), y, (255, 255, 240))
    px(cv, X(118), RY + 22, (200, 200, 190))
for x in range(119, 132):
    px(cv, x, RY + 19 + (1 if 122 <= x <= 128 else 0), OUT)
# Rippen der Brustplatte
for y in (138, 144, 150, 156, 162):
    for x in range(104, 147):
        recolor_on(cv, fr, x, y, STEEL[1], 'S'); recolor_on(cv, fr, x, y + 1, STEEL[4], 'S')
# weiße Klauen
for (x, y) in [(84, 168), (84, 171), (84, 174), (158, 139), (161, 137), (167, 137), (170, 139)]:
    px(cv, x, y, (255, 255, 250)); px(cv, x - (1 if x < 125 else 0), y + 1, (190, 190, 200))
# Rüstungsnieten + Glanzlinie
for (x, y) in [(108, 134), (142, 134), (110, 160), (140, 160)]:
    px(cv, x, y, STEEL[5]); px(cv, x + 1, y + 1, STEEL[1])
for y in range(132, 164):
    recolor_on(cv, fr, 116 - (y - 132) * 0.1, y, STEEL[5] if y % 3 else STEEL[4], 'S')
# Rubin-Brosche
for (dx, dy, c) in [(0, 0, RUBY[2]), (-1, 0, RUBY[3]), (-1, -1, RUBY[4]), (1, 0, RUBY[1]), (0, 1, RUBY[1]), (0, -1, RUBY[3])]:
    px(cv, 125 + dx, 150 + dy, c)
glow(cv, 164, 128, 18, (255, 200, 90), k=0.5, mix=0.35)

# ---------------------------------------------------------------- Wagenkasten vorn + vordere Säulen


def chariot_front(f):
    f.part('box'); f.poly([(70, 196), (180, 196), (176, 262), (74, 262)], 'r')
    f.part('rim'); f.rect(68, 193, 182, 199, 'g')
    f.part('base'); f.rect(72, 260, 178, 266, 'g')
    f.part('posts'); f.rect(72, 60, 77, 196, 'g'); f.rect(173, 60, 178, 196, 'g')
    f.part('knobs'); f.ellipse(74.5, 192, 4.5, 3.5, 'g'); f.ellipse(175.5, 192, 4.5, 3.5, 'g')
    # Räder (schräg gesehen) seitlich am Kasten
    for wx in (64, 186):
        f.part('wheel%d' % wx); f.ellipse(wx, 238, 11, 28, 'W')
        f.part('hole%d' % wx); f.ellipse(wx, 238, 7.5, 23, '.', only='W')
        for a in np.linspace(0, math.pi, 4, endpoint=False):
            f.part('spoke%d_%d' % (wx, int(a * 100)))
            f.line(wx - math.cos(a) * 8, 238 - math.sin(a) * 23, wx + math.cos(a) * 8, 238 + math.sin(a) * 23, 'w', w=2)
        f.part('hub%d' % wx); f.ellipse(wx, 238, 4, 6, 'g')
        f.part('rimg%d' % wx); f.ellipse(wx, 238, 11, 28, 'G', only='W'); f.ellipse(wx, 238, 9, 26, 'W', only='G')
    # geflügeltes Emblem
    f.part('wingsE')
    for sg in (-1, 1):
        for k_ in range(4):
            f.limb(125 + sg * 6, 222 + k_ * 1.5, 125 + sg * (38 - k_ * 6), 212 + k_ * 5, 3.2 - k_ * 0.3, 2, 'g')
    f.part('orbE'); f.ellipse(125, 222, 7, 7, 'j')
    f.part('shield'); f.poly([(113, 234), (137, 234), (136, 248), (125, 256), (114, 248)], 'b')


ff, fr2 = fig_draw(cv, chariot_front, {'r': mat(RED_L, pillow=5, k=1.4, bias=0.02), 'g': mat(GOLD, pillow=1.8, k=1.8, spec=True),
                                       'W': mat(WOOD, pillow=2, k=1.4, noise=0.5, nscale=1), 'w': mat(WOOD, pillow=1, k=1.2),
                                       'G': mat(GOLD, pillow=1, k=1.5, spec=True),
                                       'j': mat(RUBY, pillow=3, k=1.5, spec=True), 'b': mat(BLUE_CLOTH, pillow=3, k=1.4)})
# Goldleiste (Innenrahmen) + Nieten auf dem Wagenkasten
frame_pts = [(76, 206), (174, 206), (171, 254), (79, 254), (76, 206)]
for i in range(len(frame_pts) - 1):
    (x0, y0), (x1, y1) = frame_pts[i], frame_pts[i + 1]
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for k_ in range(n + 1):
        t = k_ / max(1, n)
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        recolor_on(cv, ff, x, y, GOLD[3], 'r'); recolor_on(cv, ff, x + 1, y + 1, RED_L[0], 'r')
for (x, y) in [(79, 209), (171, 209), (81, 251), (169, 251), (125, 209), (125, 251)]:
    recolor_on(cv, ff, x, y, GOLD[4], 'r'); recolor_on(cv, ff, x + 1, y + 1, GOLD[1], 'r')
# Wappen: kleiner goldener Drache (Flamme) auf dem Schild
for (dx, dy) in [(0, -6), (-1, -5), (1, -5), (0, -4), (-2, -3), (0, -3), (2, -3), (-1, -2), (1, -2), (0, -1), (0, 0), (-3, -2), (3, -2)]:
    px(cv, 125 + dx, 246 + dy, GOLD[4] if dy < -3 else GOLD[3])
# Ornamentranken auf dem Kasten
for sg in (-1, 1):
    spiral(cv, 125 + sg * 34, 244, 5, 1.3, GOLD[2], a0=0, sgn=sg)
    spiral(cv, 125 + sg * 42, 230, 4, 1.3, GOLD[2], a0=math.pi, sgn=-sg)
for x in range(76, 176, 4):
    px(cv, x, 202, GOLD[1]); px(cv, x + 1, 202, GOLD[3])
sparkle(cv, 122, 219, (255, 255, 255), r=1, c2=RUBY[4])

# ---------------------------------------------------------------- Die beiden Drachenjungen
RDR = [(50, 14, 20), (96, 30, 34), (146, 56, 56), (186, 90, 84), (220, 130, 120), (246, 180, 170)]
ORNG = [(120, 40, 10), (190, 80, 16), (236, 130, 30), (252, 180, 60), (255, 220, 130)]
GDR = [(8, 36, 16), (16, 70, 26), (30, 110, 40), (60, 150, 56), (110, 190, 90), (170, 226, 140)]
TAN = [(90, 60, 30), (150, 110, 60), (200, 160, 100), (232, 204, 150), (250, 236, 200)]


def dragons(f):
    # --- Red Dragoneer (links), sitzend, Flügel gespreizt
    cx, cy = 50, 276
    f.part('rtail'); f.curve([(cx + 8, cy + 14), (cx + 20, cy + 20), (cx + 26, cy + 14)], 'r', w=5, w1=2)
    for sg in (-1, 1):
        f.part('rwing%d' % sg)
        f.poly([(cx + sg * 6, cy - 16), (cx + sg * 22, cy - 34), (cx + sg * 30, cy - 36), (cx + sg * 27, cy - 26),
                (cx + sg * 29, cy - 16), (cx + sg * 22, cy - 18), (cx + sg * 20, cy - 8), (cx + sg * 12, cy - 6)], 'o')
    f.part('rbody'); f.ellipse(cx, cy, 13, 15, 'r')
    f.part('rbelly'); f.ellipse(cx, cy + 3, 7, 10, 'o')
    f.part('rlegs'); f.ellipse(cx - 9, cy + 13, 6, 4, 'r'); f.ellipse(cx + 9, cy + 13, 6, 4, 'r')
    f.part('rarms'); f.limb(cx - 9, cy - 6, cx - 17, cy - 1, 3.2, 2.6, 'r'); f.limb(cx + 9, cy - 6, cx + 17, cy - 1, 3.2, 2.6, 'r')
    f.part('rhornL'); f.limb(cx - 7, cy - 32, cx - 13, cy - 42, 2.8, 1, 'o')
    f.part('rhornR'); f.limb(cx + 7, cy - 32, cx + 13, cy - 42, 2.8, 1, 'o')
    f.part('rhead'); f.ellipse(cx, cy - 25, 12, 10, 'r')
    f.part('rcrest'); f.poly([(cx - 3, cy - 34), (cx, cy - 40), (cx + 3, cy - 34)], 'r')
    f.part('rsnout'); f.ellipse(cx, cy - 18, 6, 4.5, 'r')
    # --- Green Dragoneer (rechts), schlangenartig, aufgerichtet
    gx, gy = 200, 280
    f.part('gcoil'); f.ellipse(gx + 2, gy + 10, 17, 7, 'G')
    f.part('gtail'); f.curve([(gx + 16, gy + 10), (gx + 26, gy + 4), (gx + 28, gy - 6), (gx + 24, gy - 12)], 'G', w=5, w1=2)
    f.part('gtuft'); f.ellipse(gx + 24, gy - 14, 3, 3.5, 't')
    f.part('gbody'); f.curve([(gx, gy + 4), (gx - 2, gy - 8), (gx - 4, gy - 20), (gx - 2, gy - 28)], 'G', w=16, w1=11)
    f.part('gbelly'); f.curve([(gx - 1, gy + 4), (gx - 3, gy - 8), (gx - 5, gy - 20)], 't', w=8, w1=6)
    f.part('garms'); f.limb(gx - 8, gy - 12, gx - 14, gy - 4, 2.8, 2.4, 'G'); f.limb(gx + 5, gy - 12, gx + 9, gy - 4, 2.8, 2.4, 'G')
    f.part('ghornL'); f.curve([(gx - 8, gy - 42), (gx - 12, gy - 50), (gx - 10, gy - 56)], 't', w=3.2, w1=1.5)
    f.part('ghornR'); f.curve([(gx + 4, gy - 42), (gx + 8, gy - 50), (gx + 6, gy - 56)], 't', w=3.2, w1=1.5)
    f.part('gmane', line=False)
    f.poly([(gx - 14, gy - 36), (gx - 20, gy - 40), (gx - 16, gy - 32), (gx - 22, gy - 28), (gx - 14, gy - 26)], 'G')
    f.poly([(gx + 10, gy - 36), (gx + 16, gy - 40), (gx + 12, gy - 32), (gx + 18, gy - 28), (gx + 10, gy - 26)], 'G')
    f.part('ghead'); f.ellipse(gx - 2, gy - 36, 11, 9, 'G')
    f.part('gsnout'); f.poly([(gx - 9, gy - 34), (gx + 5, gy - 34), (gx + 4, gy - 26), (gx - 2, gy - 23), (gx - 8, gy - 26)], 'G')
    f.part('gjaw'); f.poly([(gx - 7, gy - 26), (gx + 3, gy - 26), (gx + 1, gy - 22), (gx - 5, gy - 22)], 't')


DM = {'r': mat(RDR, pillow=4, k=1.5, bias=0.05, noise=0.4, nscale=1), 'o': mat(ORNG, pillow=2.5, k=1.4),
      'G': mat(GDR, pillow=4, k=1.5, bias=0.05, noise=0.4, nscale=1), 't': mat(TAN, pillow=2, k=1.4, spec=True)}
fd, dr = fig_draw(cv, dragons, DM)
RX_, RY_ = -8, 8      # Verschiebung des roten Drachen gegenüber dem Entwurf
GX_, GY_ = 8, 8       # Verschiebung des grünen Drachen
# Flügeladern beim roten Drachen
for sg in (-1, 1):
    for (ex, ey) in [(22, -34), (27, -26), (22, -18)]:
        for k_ in range(24):
            t = k_ / 23
            recolor_on(cv, fd, 58 + RX_ + sg * (6 + (ex - 6) * t), 268 + RY_ - 16 + (ey + 16) * t, RDR[2], 'o')
# Rot: blaue Augen, Nüstern, kleine Zähnchen
for ex in (51, 62):
    for (dx, dy, c) in [(0, 0, OUT), (1, 0, OUT), (2, 0, OUT), (0, 1, (255, 255, 255)), (1, 1, (60, 120, 230)), (2, 1, OUT),
                        (0, 2, (120, 170, 250)), (1, 2, (40, 80, 200)), (2, 2, OUT)]:
        px(cv, ex + RX_ + dx, 243 + RY_ + dy, c)
px(cv, 56 + RX_, 248 + RY_, RDR[0]); px(cv, 60 + RX_, 248 + RY_, RDR[0])
px(cv, 55 + RX_, 253 + RY_, (255, 255, 250)); px(cv, 61 + RX_, 253 + RY_, (255, 255, 250))
# weiße Klauen
for (x, y) in [(40, 268), (42, 269), (74, 268), (76, 267), (46, 283), (49, 284), (67, 283), (70, 284)]:
    px(cv, x + RX_, y + RY_, (255, 255, 250))
# Grün: rote Augen, weiße Barthaare/Zähne
for ex in (184, 194):
    for (dx, dy, c) in [(0, 0, OUT), (1, 0, OUT), (2, 0, OUT), (0, 1, (255, 120, 140)), (1, 1, (220, 30, 60)), (2, 1, OUT)]:
        px(cv, ex + GX_ + dx, 237 + GY_ + dy, c)
for (x, y) in [(186, 247), (194, 247)]:
    px(cv, x + GX_, y + GY_, (255, 255, 250)); px(cv, x + GX_, y + GY_ + 1, (220, 220, 220))
for sg in (-1, 1):
    for k_ in range(12):
        t = k_ / 11
        px(cv, 190 + GX_ + sg * (7 + t * 10), 243 + GY_ + t * 6 + math.sin(t * 5) * 1.5, (250, 250, 240))
px(cv, 187 + GX_, 242 + GY_, GDR[0]); px(cv, 192 + GX_, 242 + GY_, GDR[0])
# Bauchschuppen
for y in range(252, 270, 3):
    for x in range(184, 196):
        recolor_on(cv, fd, x + GX_, y + GY_, TAN[1], 't')
for y in range(262, 280, 3):
    for x in range(50, 67):
        recolor_on(cv, fd, x + RX_, y + RY_, ORNG[1], 'o')

# Funken / Glut in der Luft
for (x, y) in [(40, 150), (210, 160), (180, 94), (64, 100), (150, 72), (100, 40 + 50)]:
    sparkle(cv, x, y, (255, 240, 200), r=2, c2=(255, 150, 60))
for _ in range(30):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(70, 190)
    if tuple(cv.a[y, x]) != OUT and not rb[y, x, 3]:
        px(cv, x, y, rnd.choice([(255, 200, 80), (255, 140, 40)]))
vignette(cv, (40, 10, 20), strength=0.35)
emblem = emblem_generic(["#...#", "##.##", ".###.", "..#..", ".#.#."], {'#': (240, 90, 60)})
p = finish(cv, 'VII', 'RUBIN', out='07_chariot_rubin', emblem=emblem)
print(p)
