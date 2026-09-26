# -*- coding: utf-8 -*-
# XVI – Der Turm: Champion, the Stormbringer
# Gewitternacht: Champion schwebt in violetter Rüstung auf seinem Wirbelsturm und schleudert einen Blitz
# in die Spitze eines hohen Uhrturms (nach Big Gwen) auf einem Felsen. Die Turmkrone fliegt davon,
# aus den Fenstern schlagen Flammen, zwei Gestalten stürzen, Feuertropfen und Regen fallen.
from tarot_b4_helpers import *

cv = new_card()
rnd = random.Random(16)
yy, xx = np.indices((H, W))

# ---------------------------------------------------------------- Nachthimmel + Sturmwolken
sky(cv, [(8, 6, 22), (16, 12, 40), (28, 22, 64), (44, 36, 92), (60, 50, 112), (46, 40, 88)])
stars(cv, 20, y1=120, seed=16, big=0.0, cols=[(180, 170, 230), (140, 130, 200)])
glow2(cv, 150, 80, 90, (120, 100, 220), k=0.35, mix=0.3)          # Blitzlicht in den Wolken
CLD = [(16, 12, 34), (30, 24, 58), (50, 42, 86), (76, 66, 120), (112, 102, 160), (160, 150, 206)]
for (cx_, cy_, w_, h_, sd) in [(30, 54, 60, 16, 1), (96, 48, 70, 14, 2), (170, 52, 80, 18, 3), (228, 60, 50, 16, 4),
                               (130, 72, 60, 12, 5), (210, 90, 44, 12, 6), (44, 86, 56, 12, 7)]:
    puffy_cloud(cv, cx_, cy_, w_, h_, CLD, seed=sd)
# ferne Blitze im Hintergrund
bolt(cv, 226, 64, 232, 150, seed=5, jag=0.3, branches=2, width=0, core=(230, 220, 255), mid=(180, 160, 255),
     outer=(140, 110, 240), glow_col=(150, 120, 255), glow_r=6, glow_k=0.4)
bolt(cv, 30, 92, 20, 170, seed=9, jag=0.3, branches=1, width=0, core=(230, 220, 255), mid=(180, 160, 255),
     outer=(140, 110, 240), glow_col=(150, 120, 255), glow_r=6, glow_k=0.35)

# ---------------------------------------------------------------- Wirbelsturm (Trichter) hinter Champion
TW = [(70, 64, 110), (110, 104, 150), (150, 146, 188), (196, 194, 226), (236, 236, 250)]


def funnel_c(y):
    return 70 - (y - 70) * 0.08 + math.sin(y * 0.045) * 7


def funnel_r(y):
    return 6 + (300 - y) * 0.2


for y in range(70, AY1):
    c = funnel_c(y); r = funnel_r(y)
    for x in range(int(c - r), int(c + r) + 1):
        t = abs(x - c) / r
        if in_art(x, y) and BAYER4[y % 4, x % 4] < 0.45 * (1 - t * t):
            blend_px(cv, x, y, (120, 114, 170), 0.35)
for i in range(170):
    y = rnd.uniform(74, AY1 - 2)
    c = funnel_c(y); r = funnel_r(y)
    a0 = rnd.uniform(0, 2 * math.pi); span = rnd.uniform(0.8, 2.2)
    for t in np.linspace(a0, a0 + span, int(r * span) + 4):
        x = c + math.cos(t) * r; yq = y + math.sin(t) * r * 0.16
        front = math.sin(t) > 0
        col = TW[3] if front else TW[1]
        if in_art(x, yq):
            blend_px(cv, x, yq, col, 0.6 if front else 0.35)
# aufgewirbelte Trümmer am Fuß
for i in range(30):
    y = rnd.uniform(250, 300); c = funnel_c(y); r = funnel_r(y) + 10
    x = c + rnd.uniform(-r, r)
    px(cv, x, y, rnd.choice([(60, 50, 60), (90, 80, 90), (40, 60, 40)]))

# ---------------------------------------------------------------- Boden links + Felsen unter dem Turm
ROCK = [(10, 8, 18), (22, 18, 34), (38, 32, 54), (58, 52, 80), (86, 80, 112), (124, 118, 150)]
for y in range(276, AY1):
    for x in range(AX0, AX1):
        top = 280 + int(3 * math.sin(x * 0.07) + 2 * math.sin(x * 0.23))
        if y >= top:
            v = 0.45 - (y - top) * 0.02 + (noise(H, W, 3, seed=21)[y, x] - 0.5) * 0.5
            px(cv, x, y, rampc(ROCK, v, x, y))
crag = [(126, 302), (138, 280), (150, 266), (160, 252), (168, 247), (200, 246), (214, 252), (226, 262), (234, 266), (240, 302)]
Mc = np.zeros((H, W), np.uint8)
cv2.fillPoly(Mc, [np.array(crag, np.int32)], 1)
Mc = Mc.astype(bool) & (yy < AY1) & (xx < AX1)
Hc = dome(Mc, 8) + (noise(H, W, 3, seed=31, octaves=3) - 0.5) * 3.0 + np.sin(xx * 0.4 + yy * 0.9) * 0.4
relief(cv, Hc.astype(np.float32), np.zeros((H, W), np.int32), [ROCK], Mc, k=1.5, bias=0.02)
mask_outline(cv, Mc, (4, 2, 10))

# ---------------------------------------------------------------- Der Turm (nach Big Gwen)
TAN = [(60, 34, 20), (104, 66, 36), (150, 104, 62), (190, 146, 98), (222, 184, 132), (246, 220, 176)]
TAN_D = [(40, 22, 14), (74, 46, 26), (108, 74, 44), (138, 100, 62), (170, 130, 86)]
STN = [(28, 28, 40), (54, 54, 70), (86, 86, 104), (124, 124, 142), (168, 168, 184), (212, 212, 224)]
T = Fig(W, H)
TX = 184
# Schaft
T.part('shaft'); T.rect(TX - 16, 150, TX + 16, 250, 't')
for sx in (-10, -2, 6, 13):
    T.part('stripe%d' % sx); T.rect(TX + sx, 152, TX + sx + 2, 249, 'u')
T.part('band'); T.rect(TX - 16, 226, TX + 16, 231, 'l')
T.part('base'); T.rect(TX - 19, 244, TX + 19, 252, 'k')
# Uhrengeschoss (breiter)
T.part('clockbox'); T.rect(TX - 20, 113, TX + 20, 151, 't')
T.part('mold1'); T.rect(TX - 21, 112, TX + 21, 115, 'l')
T.part('mold2'); T.rect(TX - 21, 148, TX + 21, 152, 'u')
T.part('clockframe'); T.rect(TX - 12, 120, TX + 12, 144, 'g')
T.part('clockface'); T.rect(TX - 9, 123, TX + 9, 141, 'c')
# Steinband + oberer Aufsatz (vom Blitz zerborsten)
T.part('stone'); T.rect(TX - 22, 102, TX + 22, 112, 'k')
T.part('stonetop'); T.rect(TX - 23, 100, TX + 23, 103, 'K')
T.part('upper'); T.poly([(TX - 12, 100), (TX + 12, 100), (TX + 12, 92), (TX + 7, 86), (TX + 4, 91), (TX, 83), (TX - 4, 90),
                         (TX - 8, 85), (TX - 12, 92)], 't')
# Fenster (gewölbt)
for (wx, wy) in [(TX - 7, 164), (TX + 7, 184), (TX - 7, 204), (TX + 7, 238)]:
    T.part('win%d%d' % (wx, wy))
    T.rect(wx - 3, wy - 3, wx + 3, wy + 6, 'w'); T.ellipse(wx, wy - 3, 3, 3, 'w')
T.outline()
TMATS = {
    't': mat(TAN, pillow=3, k=1.4, bias=-0.06, noise=0.5, nscale=2),
    'u': mat(TAN_D, pillow=1, k=1.2, bias=-0.1),
    'l': mat(TAN[2:], pillow=1.5, k=1.2, bias=0.05),
    'k': mat(STN, pillow=2, k=1.6, noise=0.6, nscale=2),
    'K': mat(STN[2:], pillow=1, k=1.2, bias=0.1),
    'g': mat(GOLD, pillow=1.5, k=1.8, spec=True),
    'c': mat([(170, 170, 190), (210, 210, 226), (240, 240, 250), (255, 255, 255)], pillow=3, k=1.2, bias=0.1),
    'w': mat([(10, 6, 10), (24, 12, 16), (40, 20, 22)], pillow=1, k=1),
}
trgba = T.render(TMATS)
TM = trgba[..., 3] > 0
cv.paste(trgba, 0, 0)
# rechte Seitenfläche (Perspektive, im Schatten)
for y in range(114, 250):
    for x in range(TX + 17 if y >= 150 else TX + 21, TX + (22 if y >= 150 else 26)):
        if in_art(x, y) and not TM[y, x - 6] is False:
            px(cv, x, y, rampc(TAN_D, 0.2 + (0.1 if (x + y) % 7 == 0 else 0), x, y))
# Uhr: Ziffernstriche, Zeiger, Sprünge im Glas
for k in range(12):
    a = k * math.pi / 6
    px(cv, TX + math.cos(a) * 7.5, 132 + math.sin(a) * 7.5, (90, 90, 110))
for (x, y) in [(TX, 132), (TX, 131), (TX, 130), (TX, 129), (TX, 128), (TX, 127), (TX + 1, 132), (TX + 2, 133), (TX + 3, 134), (TX + 4, 135)]:
    px(cv, x, y, (20, 16, 24))
for (a, b) in [((TX + 2, 124), (TX - 1, 131)), ((TX - 1, 131), (TX - 7, 134)), ((TX - 1, 131), (TX + 3, 140)), ((TX + 2, 124), (TX + 7, 128))]:
    bline(cv, a[0], a[1], b[0], b[1], (120, 120, 150))
# Fenster: Flammen schlagen heraus
FL = Fig(W, H)
FL.part('f', line=False)
for (wx, wy, sd) in [(TX - 7, 164, -1), (TX + 7, 184, 1), (TX - 7, 204, -1)]:
    for i in range(4):
        L = rnd.uniform(9, 16)
        a = -math.pi / 2 + sd * rnd.uniform(0.2, 0.9)
        FL.poly([(wx - 3, wy + 4), (wx + 3, wy + 4), (wx + math.cos(a) * L + sd * 2, wy + math.sin(a) * L)], 'f')
    FL.ellipse(wx, wy + 1, 4, 5, 'f')
FL.outline(k='K')
frgba = FL.render({'f': mat(FIRE, pillow=3, k=1.2, bias=0.25, noise=1.2, nscale=2)}, outline_col=(110, 20, 6))
for (wx, wy, sd) in [(TX - 7, 164, -1), (TX + 7, 184, 1), (TX - 7, 204, -1)]:
    glow2(cv, wx, wy, 18, (255, 140, 40), k=0.6, mix=0.35)
cv.paste(frgba, 0, 0)
# Rauch über den Fenstern
for (sx_, sy_) in [(TX - 16, 150), (TX + 14, 170)]:
    for i in range(6):
        r_ = 3 + i * 0.8
        cx_, cy_ = sx_ + i * 2.5, sy_ - i * 6
        for y in range(int(cy_ - r_), int(cy_ + r_) + 1):
            for x in range(int(cx_ - r_), int(cx_ + r_) + 1):
                if math.hypot(x - cx_, y - cy_) <= r_ and in_art(x, y) and BAYER4[y % 4, x % 4] < 0.55:
                    blend_px(cv, x, y, (40, 34, 50), 0.5)

# ---------------------------------------------------------------- Die davonfliegende Krone (Turmspitze)
CR = Fig(W, H)
cc = (212, 62); ca = math.radians(28)


def R(p):
    return (cc[0] + p[0] * math.cos(ca) - p[1] * math.sin(ca), cc[1] + p[0] * math.sin(ca) + p[1] * math.cos(ca))


CR.part('ring'); CR.poly([R(p) for p in [(-11, 2), (11, 2), (10, 7), (-10, 7)]], 'g')
CR.part('spikes')
for dx in (-9, -3, 3, 9):
    CR.poly([R(p) for p in [(dx - 3, 2), (dx + 3, 2), (dx, -8 if abs(dx) < 5 else -5)]], 'g')
CR.part('gem'); CR.ellipse(*R((0, 4)), 2, 2, 'r')
CR.outline()
crgba = CR.render({'g': mat(GOLD, pillow=2, k=1.8, spec=True, spec_col=(255, 255, 230)), 'r': mat(RUBY, pillow=1, k=1.2, bias=0.2)})
glow2(cv, cc[0], cc[1], 16, (255, 220, 140), k=0.5, mix=0.3)
cv.paste(crgba, 0, 0)
# Bruchstücke fliegen mit
for (x, y, s_) in [(200, 78, 2), (222, 80, 1), (196, 70, 1), (228, 68, 2), (206, 90, 1), (190, 76, 1)]:
    for dy in range(s_ + 1):
        for dx in range(s_ + 1):
            px(cv, x + dx, y + dy, TAN[3] if dy == 0 else TAN[1])
    px(cv, x - 1, y - 1, OUT)

# ================================================================= Champion
ARM = [(18, 8, 46), (38, 18, 96), (66, 38, 160), (104, 76, 222), (150, 132, 255), (214, 206, 255)]
SUIT = [(8, 8, 20), (18, 16, 40), (30, 28, 64), (46, 44, 92), (70, 70, 126)]
VIS = [(34, 34, 46), (70, 70, 88), (116, 116, 136), (172, 172, 192), (224, 224, 236)]
SCARF = [(40, 14, 70), (74, 30, 130), (112, 56, 190), (156, 100, 236), (206, 170, 255)]

f = Fig(W, H)
# ---- Schal, weht nach links
f.part('scarf')
f.curve([(80, 122), (66, 118), (52, 110), (40, 114), (26, 106), (18, 110)], 's', w=8, w1=4)
f.curve([(80, 124), (64, 126), (50, 124), (36, 130), (24, 126)], 's', w=6, w1=3)
# ---- Beine (nach hinten wehend)
f.part('thighL'); f.limb(81, 160, 68, 182, 6.5, 5.5, 'n')
f.part('shinL'); f.limb(68, 182, 54, 194, 5.5, 4.5, 'a')
f.part('footL'); f.poly([(44, 190), (58, 188), (60, 196), (46, 199)], 'a')
f.part('kneeL'); f.ellipse(68, 182, 5, 5, 'a')
f.part('thighR'); f.limb(95, 162, 98, 188, 6.5, 5.5, 'n')
f.part('shinR'); f.limb(98, 188, 86, 202, 5.5, 4.5, 'a')
f.part('footR'); f.poly([(76, 200), (88, 198), (90, 207), (76, 208)], 'a')
f.part('kneeR'); f.ellipse(98, 188, 5, 5, 'a')
# ---- Rumpf
f.part('torso'); f.poly([(72, 126), (102, 126), (100, 144), (98, 160), (78, 160), (74, 144)], 'n')
f.part('chest'); f.poly([(74, 127), (100, 127), (99, 142), (88, 148), (76, 142)], 'a')
f.part('emblem'); f.poly([(83, 130), (93, 130), (93, 140), (88, 143), (83, 140)], 'v')
f.part('belt'); f.poly([(76, 152), (100, 152), (100, 158), (76, 158)], 'a')
f.part('tassets'); f.poly([(76, 158), (87, 158), (84, 170), (74, 168)], 'a'); f.poly([(89, 158), (100, 158), (102, 168), (92, 170)], 'a')
# ---- rechter Arm hoch (schleudert den Blitz)
f.part('uarmR'); f.limb(74, 130, 61, 108, 5.5, 4.8, 'n')
f.part('farmR'); f.limb(61, 108, 64, 86, 4.8, 4.2, 'a')
f.part('fistR'); f.ellipse(64, 81, 5.5, 5.5, 'a')
f.part('paulR'); f.ellipse(73, 128, 8, 7, 'a')
# ---- linker Arm ausgestreckt zum Turm
f.part('uarmL'); f.limb(100, 132, 117, 138, 5.5, 4.8, 'n')
f.part('farmL'); f.limb(117, 138, 133, 134, 4.8, 4.2, 'a')
f.part('handL'); f.ellipse(137, 133, 4.5, 4, 'n')
for (dx, dy) in [(4, -3), (5, -1), (5, 1), (4, 3)]:
    f.limb(139, 133 + dy * 0.5, 141 + dx, 133 + dy, 1.4, 1.1, 'n')
f.part('paulL'); f.ellipse(101, 129, 8, 7, 'a')
# ---- Kopf mit Helm, Visierband und Maske
f.part('neck'); f.rect(82, 116, 92, 126, 'n')
f.part('helm'); f.ellipse(87, 106, 16, 15, 'a')
f.poly([(76, 96), (84, 84), (92, 84), (100, 96)], 'a')
f.part('crest'); f.poly([(86, 90), (90, 90), (96, 72), (92, 74), (88, 82)], 'v')
f.part('visor'); f.poly([(72, 101), (102, 101), (102, 106), (72, 106)], 'g')
f.part('eyes'); f.poly([(76, 106), (99, 106), (98, 112), (77, 112)], 'e')
f.part('mask'); f.poly([(74, 112), (101, 112), (99, 118), (92, 123), (82, 123), (75, 118)], 'n')
f.outline()
MATS = {
    'a': mat(ARM, pillow=3, k=1.9, bias=0.02, spec=True, spec_col=(230, 220, 255)),
    'n': mat(SUIT, pillow=3, k=1.6, bias=0.08, folds=(0.2, 0.2, 0.4)),
    'v': mat([(90, 70, 150), (150, 140, 210), (220, 216, 250), (255, 255, 255)], pillow=1.5, k=1.4, bias=0.1),
    'g': mat(VIS, pillow=1.5, k=1.8, spec=True),
    'e': mat(SKIN, pillow=2, k=1.2, bias=0.15),
    's': mat(SCARF, pillow=3, k=1.5, folds=(0.1, 0.5, 0.6)),
}
fig = f.render(MATS, light=(0.5, -0.7, 0.5))      # Licht vom Blitz/Turm (rechts oben)
FM = fig[..., 3] > 0
# violette Aura (Sturmenergie)
d_out = cv2.distanceTransform((~FM).astype(np.uint8), cv2.DIST_L2, 3)
for y, x in zip(*np.where((d_out > 0) & (d_out < 7))):
    if in_art(x, y) and BAYER4[y % 4, x % 4] + 0.03 < (1 - d_out[y, x] / 7) * 0.9:
        blend_px(cv, x, y, (160, 120, 255), 0.4)
cv.paste(fig, 0, 0)
# Augen: grimmig, weiß-violett leuchtend
for (ex, sd) in [(80, 1), (94, -1)]:
    for i in range(5):
        top = 108 - (i * sd - 2 * sd) * 0.4
        for y in range(int(round(top)), 111):
            px(cv, ex + i - 2, y, (250, 248, 255))
    px(cv, ex + sd, 109, (120, 60, 220)); px(cv, ex + sd, 110, (70, 30, 150))
for x in range(76, 99):
    px(cv, x, 107, (40, 24, 40)) if x in (76, 77, 97, 98) else None
# Schachbrett-Emblem auf der Brust (weiß/violett wie auf der Karte)
for y in range(131, 140):
    for x in range(84, 93):
        if ((x - 84) // 3 + (y - 131) // 3) % 2 == 0:
            px(cv, x, y, (236, 232, 255) if x < 88 else (200, 196, 236))
        else:
            px(cv, x, y, ARM[3] if x < 88 else ARM[2])
# Glanzkanten der Rüstung (Blitzlicht)
for (x, y) in [(66, 78), (67, 79), (97, 122), (98, 123), (106, 126), (108, 127), (99, 96), (100, 97)]:
    px(cv, x, y, ARM[5])

# ---------------------------------------------------------------- Der geschleuderte Blitz
BOLT = dict(core=(255, 255, 255), mid=(220, 210, 255), outer=(150, 110, 255), glow_col=(170, 140, 255), glow_r=10, glow_k=0.55)
main = bolt_path(66, 74, 181, 90, seed=21, jag=0.16, depth=6)
draw_bolt(cv, main, width=2, **BOLT)
for (fr, ang, L, sd) in [(0.45, -0.9, 22, 3), (0.8, 0.6, 18, 4), (0.3, 0.8, 14, 5), (0.62, -0.5, 16, 6)]:
    x0, y0 = main[int(fr * (len(main) - 1))]
    br = bolt_path(x0, y0, x0 + math.cos(ang) * L, y0 + math.sin(ang) * L, seed=sd, jag=0.3, depth=4)
    draw_bolt(cv, br, width=0, **BOLT)
# Einschlag an der Turmspitze
glow2(cv, 182, 90, 22, (255, 250, 220), k=0.8, mix=0.45)
sparkle(cv, 182, 90, (255, 255, 255), r=6, c2=(200, 180, 255))
for i in range(14):
    a = rnd.uniform(0, 2 * math.pi); L = rnd.uniform(5, 12)
    bline(cv, 182 + math.cos(a) * 3, 90 + math.sin(a) * 3, 182 + math.cos(a) * L, 90 + math.sin(a) * L, (255, 240, 200), 0.7)
# Knistern um die Faust
for sd in range(3):
    a = -math.pi / 2 + (sd - 1) * 0.9
    br = bolt_path(64, 80, 64 + math.cos(a) * 12, 80 + math.sin(a) * 12, seed=40 + sd, jag=0.4, depth=3)
    draw_bolt(cv, br, width=0, **BOLT)

# ---------------------------------------------------------------- stürzende Gestalten + Feuertropfen


def faller(x, y, flip, col=(40, 30, 50), rim=(255, 150, 60)):
    """kleine kopfüber stürzende Figur (Silhouette, vom Feuer angeleuchtet)"""
    g = Fig(W, H)
    g.part('b'); g.ellipse(x, y + 7, 3.2, 4.5, 'b')                                   # Körper
    g.part('h'); g.ellipse(x - flip * 1, y + 13, 2.6, 2.6, 's')                       # Kopf (unten)
    g.part('l'); g.limb(x - 1, y + 3, x - 4 * flip, y - 4, 1.4, 1.1, 'b'); g.limb(x + 1, y + 3, x + 5 * flip, y - 2, 1.4, 1.1, 'b')
    g.part('a'); g.limb(x - 2, y + 9, x - 7 * flip, y + 8, 1.1, 0.9, 'b'); g.limb(x + 2, y + 9, x + 6 * flip, y + 14, 1.1, 0.9, 'b')
    g.outline()
    rg = g.render({'b': mat([(30, 20, 40), (60, 40, 70), (110, 70, 90), (200, 120, 80)], pillow=1.5, k=1.5, bias=0.1),
                   's': mat(SKIN, pillow=1.5, k=1.2, bias=0.1)}, light=(0.6, 0.6, 0.5))
    cv.paste(rg, 0, 0)


faller(150, 178, 1)
faller(222, 196, -1)


def fire_drop(x, y, s=1.0):
    for k in range(int(6 * s)):
        w = max(0, int(round((1 - k / (6 * s)) * 1.6 * s)))
        for q in range(-w, w + 1):
            c = FIRE[4] if (q == 0 and k < 3 * s) else FIRE[3] if abs(q) < w else FIRE[2]
            px(cv, x + q, y - k + 3, c)
    px(cv, x, y + 3, FIRE[5])
    glow2(cv, x, y + 1, 4 * s, (255, 150, 50), k=0.5, mix=0.3)


for (x, y, s_) in [(160, 118, 1.2), (206, 140, 1.0), (142, 214, 1.0), (218, 232, 1.2), (156, 250, 0.9), (226, 170, 0.9),
                   (170, 96, 0.8), (140, 150, 0.8), (200, 222, 0.8)]:
    fire_drop(x, y, s_)

# ---------------------------------------------------------------- Regen (vor allem, schräg vom Sturm)
rain(cv, 380, cols=((120, 116, 180), (170, 166, 220), (200, 200, 240)), ang=0.35, L=(4, 8), seed=3, k=0.45)

vignette2(cv, color=(6, 4, 14), strength=0.55, protect=lambda x, y: FM[y, x])
emblem = emblem_generic(["..##.", ".##..", "####.", "..##.", ".##..", "#...."], {'#': (190, 160, 255)})
p = finish(cv, 'XVI', 'CHAMPION', out='16_tower_champion', emblem=emblem)
print(p)
