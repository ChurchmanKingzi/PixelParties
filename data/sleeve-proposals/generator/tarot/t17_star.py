# -*- coding: utf-8 -*-
# XVII – Der Stern: Cute Starlet Megu
# Megu kniet mit ausgebreiteten Schmetterlingsflügeln am Ufer eines Sternenteichs und gießt aus zwei
# goldenen Krügen Wasser – einen in den Teich, einen aufs Land. Über ihr der große achtzackige Stern
# mit sieben kleinen Sternen, rechts ein Baum mit einem Vogel, Dämmerungshimmel; ein grünes Herz
# (wie auf ihrer Karte) leuchtet hinter ihr.
from tarot_sterne_helpers import *

cv = new_card()
rnd = random.Random(17)
# ---------------------------------------------------------------- Dämmerungshimmel
HOR = 222
sky(cv, [(10, 8, 34), (22, 16, 64), (46, 30, 104), (88, 50, 138), (150, 80, 158), (214, 120, 160), (250, 178, 158)],
    y1=HOR + 6)
# Milchstraßen-Schleier (diagonal, gedithert)
nz = noise(H, W, 8, seed=3)
for y in range(AY0, HOR):
    for x in range(AX0, AX1):
        d = abs((x - AX0) * 0.55 - (y - AY0) + 10) / 34
        t = max(0, 1 - d) * (0.6 + nz[y, x] * 0.8) * (1 - (y - AY0) / (HOR - AY0) * 0.6)
        if BAYER4[y % 4, x % 4] < t * 0.45:
            blend_px(cv, x, y, (170, 150, 230), 0.3)
vignette(cv, strength=0.4)
stars(cv, 260, y1=HOR - 20, seed=17, big=0.12)
stars(cv, 60, y1=HOR - 50, seed=18, cols=[(255, 220, 250), (200, 240, 255)], big=0.3)

# ---------------------------------------------------------------- großer Stern + sieben kleine
SX, SY = 125, 74
rays(cv, SX, SY, 16, 22, 64, (255, 236, 200), width=0.04, k=0.5, mix=0.3, phase=math.pi / 16)
glow(cv, SX, SY, 58, (255, 226, 190), k=0.55, mix=0.3)
glow(cv, SX, SY, 34, (255, 246, 220), k=0.6, mix=0.35)
star8(cv, SX, SY, 24, 16, 8, edge=(200, 140, 90))
# Facettenlinien
for i in range(8):
    a = -math.pi / 2 + i * math.pi / 4
    r = 22 if i % 2 == 0 else 14
    for s in np.linspace(3, r - 2, 40):
        x = SX + math.cos(a) * s; y = SY + math.sin(a) * s
        px(cv, x, y, (255, 255, 250))
SMALL = [(40, 60, (255, 250, 230)), (66, 92, (255, 214, 240)), (36, 124, (210, 236, 255)), (92, 52, (255, 240, 190)),
         (212, 60, (255, 250, 230)), (186, 94, (210, 236, 255)), (214, 126, (255, 214, 240))]
for (x, y, c) in SMALL:
    glow(cv, x, y, 13, c, k=0.5, mix=0.3)
    ramp = [lerp(c, (90, 60, 120), 0.55), lerp(c, (120, 90, 140), 0.25), c, lerp(c, (255, 255, 255), 0.6), (255, 255, 255)]
    star8(cv, x, y, 8, 5, 2.2, ramp=ramp, edge=lerp(c, (60, 30, 90), 0.6))

# ---------------------------------------------------------------- ferne Hügel
hills(cv, HOR - 4, 4, [(40, 28, 70), (58, 40, 92), (76, 54, 110)], freq=0.045, seed=2, y1=HOR + 10)
hills(cv, HOR + 3, 3, [(28, 22, 52), (40, 32, 70), (52, 42, 86)], freq=0.07, seed=5, y1=HOR + 14)

# ---------------------------------------------------------------- Teich (links/mitte) und Ufer (rechts, vorne)
WATER = [(14, 14, 44), (24, 30, 78), (40, 54, 118), (70, 96, 160), (130, 160, 210), (210, 226, 250)]
WY = HOR + 8
# Ufer-Linie: Land rechts und im Vordergrund unter Megu
def bank_x(y):
    """x-Grenze: links davon Wasser"""
    t = (y - WY) / (AY1 - WY)
    return 104 - 50 * t ** 0.6 + 4 * math.sin(y * 0.3)
land = np.zeros((H, W), bool)
for y in range(WY, AY1):
    bx = bank_x(y)
    for x in range(AX0, AX1):
        if x >= bx:
            land[y, x] = True
# Wasser: Spiegelung des Himmels + Sterne + Wellen
for y in range(WY, AY1):
    for x in range(AX0, AX1):
        if land[y, x]:
            continue
        t = (y - WY) / (AY1 - WY)
        v = 0.45 - t * 0.35 + (nz[y, x] - 0.5) * 0.25
        # Wellenbänder
        if math.sin(y * 1.3 + math.sin(x * 0.15) * 2) > 0.86:
            v += 0.22
        px(cv, x, y, rampc(WATER, v, x, y))
# Spiegelung des großen Sterns (senkrechter, flirrender Streifen)
for y in range(WY + 2, AY1):
    for x in range(AX0, 80):
        if land[y, x]:
            continue
        d = abs(x - 36 - (y - WY) * 0.1 - math.sin(y * 0.8) * 2)
        if d < 5 and (y % 3 != 0) and BAYER4[y % 4, x % 4] < (1 - d / 5) * 0.8:
            px(cv, x, y, (250, 236, 200) if d < 1.5 else (170, 180, 220))
for _ in range(50):
    x = rnd.randint(AX0, 110); y = rnd.randint(WY + 2, AY1 - 1)
    if not land[y, x]:
        px(cv, x, y, rnd.choice([(230, 236, 255), (255, 230, 250), (180, 200, 240)]))
# kleine Seerosen
LILY = [(10, 40, 30), (20, 76, 50), (40, 116, 70), (80, 160, 100)]
for (lx, ly, lr) in [(28, 270, 7), (32, 292, 6), (76, 236, 5)]:
    for y in range(ly - 4, ly + 5):
        for x in range(lx - lr - 1, lx + lr + 2):
            d = math.hypot((x - lx) / lr, (y - ly) / (lr * 0.45))
            a = math.atan2(y - ly, x - lx)
            if d <= 1 and not (-0.35 < a < 0.1 and d > 0.2) and in_art(x, y):
                px(cv, x, y, rampc(LILY, 0.8 - (y - ly + 4) / 9 * 0.6, x, y) if d < 0.85 else LILY[0])
    if lr > 6:
        for (dx, dy, c) in [(0, -2, (255, 220, 240)), (-1, -1, (250, 170, 210)), (1, -1, (250, 170, 210)), (0, -1, (255, 250, 220))]:
            px(cv, lx - 2 + dx, ly + dy, c)

# Land: Gras im Dämmerlicht
GRASS = [(12, 30, 34), (20, 50, 44), (32, 76, 56), (52, 106, 70), (90, 146, 96)]
gn = noise(H, W, 4, seed=21)
for y in range(WY, AY1):
    for x in range(AX0, AX1):
        if land[y, x]:
            v = 0.55 - (y - WY) / (AY1 - WY) * 0.25 + (gn[y, x] - 0.5) * 0.5
            px(cv, x, y, rampc(GRASS, v, x, y))
# Uferkante: dunkle Erdkante + helle Wasserlinie
for y in range(WY, AY1):
    bx = int(math.ceil(bank_x(y)))
    for k in range(0, 2):
        px(cv, bx + k, y, (26, 22, 30) if k == 0 else GRASS[1])
    px(cv, bx - 1, y, (150, 170, 220) if y % 3 else WATER[4])
# Grashalme + Blumen
for _ in range(300):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(WY + 2, AY1 - 1)
    if land[y, x]:
        for k in range(rnd.randint(2, 4)):
            if land[y - k, x] or k == 0:
                px(cv, x + (k // 2) * rnd.choice((0, 1)), y - k, GRASS[4] if k == 0 else GRASS[3])
for _ in range(34):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(WY + 4, AY1 - 3)
    if land[y, x]:
        c = rnd.choice([(255, 190, 230), (255, 255, 255), (200, 230, 255), (255, 240, 150)])
        sparkle(cv, x, y, c, r=1, c2=lerp(c, GRASS[2], 0.5))

# Uferkiesel + Schilf mit Rohrkolben am Teichrand
PEB = [(30, 28, 50), (60, 58, 84), (100, 98, 128), (150, 150, 176)]
for (y, r) in [(262, 3), (268, 2), (279, 3), (290, 2), (297, 3), (254, 2)]:
    bx = int(bank_x(y)) + 2
    for yy in range(y - r, y + r + 1):
        for xx in range(bx - r - 1, bx + r + 2):
            d = ((xx - bx) / (r + 1)) ** 2 + ((yy - y) / r) ** 2
            if d <= 1:
                px(cv, xx, yy, rampc(PEB, 0.9 - d * 0.4 - (yy - y + r) / (2 * r + 1) * 0.5, xx, yy) if d < 0.8 else PEB[0])
REED = [(16, 40, 30), (30, 70, 44), (56, 110, 60), (96, 150, 80)]
for i, (x0, y0, hgt, lean) in enumerate([(64, 290, 26, -3), (68, 292, 32, 1), (72, 289, 22, 4), (60, 296, 18, -5),
                                         (76, 294, 16, 5), (20, 238, 20, 3), (24, 240, 26, -2)]):
    for k in range(hgt):
        t = k / hgt
        x = x0 + lean * t * t; y = y0 - k
        px(cv, x, y, REED[1] if k % 5 else REED[2]); px(cv, x + 1, y, REED[0])
    if i % 2 == 0:       # Rohrkolben
        tx = x0 + lean; ty = y0 - hgt
        for k in range(6):
            px(cv, tx, ty + k, (70, 40, 26) if k < 5 else REED[1]); px(cv, tx + 1, ty + k, (110, 66, 40) if k < 5 else REED[0])
        px(cv, tx, ty - 1, REED[2])
# ---------------------------------------------------------------- Baum mit Vogel (rechts)
BARK = [(20, 12, 20), (40, 26, 36), (64, 44, 54), (92, 70, 78)]
FOL = [(10, 24, 36), (18, 42, 52), (30, 64, 68), (50, 92, 86), (90, 136, 116)]
t = Fig(W, H)
t.part('trunk')
t.curve([(222, HOR + 12), (220, 200), (214, 176), (210, 150)], 'b', w=7, w1=4)
t.curve([(216, 184), (228, 168), (238, 160)], 'b', w=3, w1=2)
t.curve([(212, 162), (198, 150), (190, 146)], 'b', w=3, w1=2)
t.part('crown')
for (cx_, cy_, r_) in [(212, 138, 16), (228, 130, 12), (198, 132, 10), (222, 150, 11), (236, 146, 9), (206, 120, 10), (222, 116, 9)]:
    t.ellipse(cx_, cy_, r_, r_ * 0.85, 'f')
t.outline()
cv.paste(t.render({'b': mat(BARK, pillow=2, k=1.4), 'f': mat(FOL, pillow=5, k=1.6, noise=1.4, nscale=2)}), 0, 0)
# kleine Blüten im Baum
for (x, y) in [(204, 126), (216, 134), (228, 124), (210, 146), (224, 146), (232, 136), (200, 138)]:
    px(cv, x, y, (255, 190, 220)); px(cv, x + 1, y, (220, 130, 180))
# Vogel (Ibis-artig) auf dem Ast links
B = Fig(W, H)
B.part('body'); B.ellipse(191, 142, 5, 3.2, 'w')
B.part('tail'); B.poly([(196, 141), (203, 143), (196, 144)], 'w')
B.part('head'); B.ellipse(186, 137, 2.6, 2.4, 'w')
B.part('beak'); B.curve([(184, 137), (180, 139), (178, 143)], 'y', w=1.4)
B.part('wing'); B.poly([(188, 140), (197, 139), (195, 144), (190, 144)], 'v')
B.part('legs'); B.line(190, 145, 190, 147, 'y'); B.line(193, 145, 193, 147, 'y')
B.outline()
cv.paste(B.render({'w': mat(WHITE_CLOTH, pillow=2, k=1.4, bias=0.05), 'v': mat(WHITE_CLOTH, pillow=1.5, k=1.2, bias=-0.1),
                   'y': mat([(120, 70, 20), (200, 130, 40), (240, 190, 90)], pillow=1, k=1)}), 0, 0)
px(cv, 185, 136, OUT)

# ---------------------------------------------------------------- Megu
HAIR = [(34, 16, 10), (64, 34, 16), (100, 56, 26), (138, 84, 40), (178, 118, 64), (214, 160, 104)]
DRESS = [(44, 6, 50), (86, 16, 94), (132, 30, 138), (180, 60, 178), (222, 116, 214), (246, 176, 240)]
WING = [(96, 30, 96), (156, 56, 146), (206, 98, 190), (234, 146, 218), (250, 198, 240), (255, 236, 252)]
FRILL = [(90, 80, 120), (150, 144, 180), (206, 204, 228), (240, 240, 252), (255, 255, 255)]
BOOT = [(14, 10, 20), (30, 24, 40), (52, 44, 66), (84, 76, 104)]

# Schatten auf dem Boden + heller Schein um Megu
for y in range(232, 250):
    for x in range(70, 184):
        d = ((x - 126) / 58) ** 2 + ((y - 241) / 7) ** 2
        if d < 1 and BAYER4[y % 4, x % 4] < (1 - d) * 1.2:
            blend_px(cv, x, y, (8, 14, 24), 0.5)
glow(cv, 125, 160, 70, (255, 200, 245), k=0.35, mix=0.28)

# ---- Flügel (hinter der Figur)
w = Fig(W, H)
w.part('upper')
upper = [(121, 166), (112, 150), (96, 128), (78, 110), (60, 98), (42, 94), (33, 102), (35, 118), (42, 134),
         (52, 150), (66, 162), (84, 170), (104, 172)]
w.poly(upper, 'w', mirror=True)
w.part('lower')
lower = [(120, 176), (102, 178), (84, 182), (68, 192), (60, 206), (62, 220), (70, 230), (80, 234), (92, 230),
         (102, 220), (110, 204), (118, 190)]
w.poly(lower, 'w', mirror=True)
w.outline()
wing_rgba = w.render({'w': mat(WING, pillow=7, k=1.1, bias=0.06)})
WM = wing_rgba[..., 3] > 0
# Muster: zum Rand hin dunkler werdendes Magenta, breiter schwarzer Saum
dist = cv2.distanceTransform(np.pad(WM.astype(np.uint8), 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
VEIN = (30, 10, 34)
for y, x in zip(*np.where(WM)):
    if tuple(wing_rgba[y, x, :3]) == OUT:
        continue
    d = dist[y, x]
    if d <= 4.2:
        wing_rgba[y, x, :3] = VEIN if d > 1.5 or (x + y) % 2 else (60, 20, 64)
    elif d <= 8:
        c = tuple(int(v) for v in wing_rgba[y, x, :3])
        if BAYER4[y % 4, x % 4] < (8 - d) / 4 * 0.8:
            wing_rgba[y, x, :3] = lerp(c, (110, 20, 100), 0.55)
cv.paste(wing_rgba, 0, 0)
# Adern: vom Ansatz zum Saum, zum Rand hin breiter
def vein(root, end, bend=0.0):
    pts = bezier(root, ((root[0] + end[0]) / 2 + bend, (root[1] + end[1]) / 2 - abs(bend)), end, 60)
    for i, (x, y) in enumerate(pts):
        xi, yi = int(round(x)), int(round(y))
        if WM[yi, xi]:
            px(cv, xi, yi, VEIN)
            if i > 12 and WM[yi, xi + 1]:
                px(cv, xi + 1, yi, VEIN)
            if i > 40 and WM[yi + 1, xi]:
                px(cv, xi, yi + 1, VEIN)
for s in (1, -1):
    X = (lambda x: x) if s == 1 else (lambda x: 250 - x)
    for (ex, ey, b) in [(40, 96, -2), (34, 110, 0), (38, 126, 2), (48, 144, 3), (62, 158, 3), (82, 168, 2)]:
        vein((X(120), 168), (X(ex), ey), b * s)
    for (ex, ey, b) in [(64, 200, 2), (62, 216, 2), (74, 230, 1), (90, 230, 0), (104, 216, 0)]:
        vein((X(119), 180), (X(ex), ey), b * s)
# weiße Tupfen im Saum (entlang der Kontur)
cnts, _ = cv2.findContours(WM.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
for c in cnts:
    c = c[:, 0, :]
    for i in range(0, len(c), 8):
        x, y = c[i]
        rx_ = 120 if x < 125 else 130
        ry_ = 170
        L = math.hypot(rx_ - x, ry_ - y) or 1
        dx, dy = (rx_ - x) / L, (ry_ - y) / L
        X_, Y_ = int(round(x + dx * 2.6)), int(round(y + dy * 2.6))
        if abs(x - 125) > 14 and WM[Y_, X_]:
            px(cv, X_, Y_, (255, 255, 255)); px(cv, X_ + 1, Y_, (230, 220, 240))
# Glanzlichter auf den Vorderflügeln
for s in (1, -1):
    for (x, y) in [(64, 112), (66, 113), (68, 114), (76, 120), (78, 121)]:
        px(cv, x if s == 1 else 250 - x, y, WING[5])

# ---- Körper
f = Fig(W, H)
f.part('hairback')
f.poly([(104, 128), (99, 150), (98, 172), (102, 188), (110, 186), (125, 176), (140, 186), (148, 188), (152, 172), (151, 150), (146, 128), (125, 118)], 'h')
# Rock: Glocke, kniend auf dem Boden ausgebreitet
f.part('skirt')
f.poly([(113, 184), (137, 184), (146, 204), (158, 222), (166, 234), (150, 241), (125, 243), (100, 241), (84, 234), (92, 222), (104, 204)], 'd')
f.part('boot')
f.poly([(158, 234), (171, 235), (177, 240), (176, 244), (158, 244)], 'b')
f.part('frill')
fr = [(82 + i * 4, 238 + (3 if i % 2 else 0) + int(3 * math.sin(i / 22 * math.pi))) for i in range(23)]
f.poly([(84, 232), (100, 237), (125, 239), (150, 237), (168, 232), (170, 238)] + fr[::-1], 'f')
f.part('skirt2')                            # Überrock (vorne) mit Falten
f.poly([(114, 184), (136, 184), (142, 200), (150, 222), (125, 231), (100, 222), (108, 200)], 'd')
f.part('torso')
f.poly([(114, 160), (136, 160), (138, 172), (136, 186), (114, 186), (112, 172)], 'd')
f.part('collar')
f.poly([(113, 160), (125, 166), (137, 160), (135, 156), (125, 161), (115, 156)], 'f')
f.part('neck'); f.rect(121, 150, 129, 160, 's')
f.part('bow')
f.poly([(125, 171), (117, 166), (116, 175)], 'g'); f.poly([(125, 171), (133, 166), (134, 175)], 'g')
f.poly([(124, 172), (120, 182), (124, 181)], 'g'); f.poly([(126, 172), (130, 182), (126, 181)], 'g')
f.part('gem'); f.ellipse(125, 171, 2.4, 2.4, 'e')
for s in (-1, 1):
    X = lambda x, s=s: 125 + s * (x - 125)
    f.part('arm%d' % s); f.limb(X(111), 166, X(104), 182, 4.2, 3.6, 's')
    f.part('fore%d' % s); f.limb(X(104), 182, X(91), 194, 3.6, 3.1, 's')
    f.part('sleeve%d' % s); f.ellipse(X(112), 164, 6.5, 6, 'd')
JUG = {}
for s in (-1, 1):
    jx, jy = (125 + s * 45, 199)
    JUG[s] = (jx, jy)
    f.part('jug%d' % s)
    ang = math.radians(35) * s          # nach außen gekippt
    ca, sa = math.cos(ang), math.sin(ang)
    R = lambda dx, dy, ca=ca, sa=sa, jx=jx, jy=jy: (jx + dx * ca - dy * sa, jy + dx * sa + dy * ca)
    f.poly([R(math.cos(a) * 8, math.sin(a) * 7 + 1) for a in np.linspace(0, 2 * math.pi, 30)], 'c')
    f.poly([R(-3, -6), R(3, -6), R(4, -11), R(-4, -11)], 'c')
    f.part('rim%d' % s)
    f.poly([R(-5, -11), R(5, -11), R(5, -13), R(-5, -13)], 'c')
    f.part('handle%d' % s)
    f.curve([R(-s * 4, -10), R(-s * 10, -9), R(-s * 9, -2), R(-s * 7, 2)], 'c', w=2)
    f.part('hand%d' % s); f.ellipse(125 + s * 36, 195, 3.8, 3.6, 's')
f.part('face')
f.ellipse(125, 139, 15.5, 14.5, 's')
f.poly([(111, 141), (139, 141), (134, 152), (125, 156), (116, 152)], 's')
f.part('hairtop')
f.ellipse(125, 132, 18, 15, 'h', keep='s')
f.part('bangs')
f.poly([(107, 147), (107, 130), (113, 121), (125, 116), (137, 121), (143, 130), (143, 147), (140, 140), (139, 133),
        (135, 136), (132, 129), (129, 134), (125, 128), (121, 134), (118, 129), (115, 136), (111, 133), (110, 140)], 'h')
f.part('lockL'); f.poly([(108, 132), (102, 152), (103, 174), (108, 162), (112, 146)], 'h')
f.part('lockR'); f.poly([(142, 132), (148, 152), (147, 174), (142, 162), (138, 146)], 'h')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.1),
    'h': mat(HAIR, pillow=4, k=1.8, noise=1.1, nscale=2, bias=0.02),
    'd': mat(DRESS, pillow=4, k=1.5, folds=(0.45, 0.0, 0.7)),
    'f': mat(FRILL, pillow=2, k=1.3, bias=0.05),
    'b': mat(BOOT, pillow=2, k=1.4, spec=True, spec_col=(140, 130, 170)),
    'g': mat(GOLD, pillow=2, k=1.8, spec=True),
    'e': mat(EMER, pillow=2, k=1.6, spec=True),
    'c': mat(GOLD7, pillow=4, k=1.6, spec=True, spec_col=(255, 255, 230)),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)
FM = (fig[..., 3] > 0) | WM

# ---------------------------------------------------------------- Wasser aus den Krügen
WSTR = [(60, 90, 170), (110, 150, 220), (170, 210, 250), (220, 240, 255), (255, 255, 255)]
jx, jy = JUG[-1]
mx_, my_ = jx - 9, jy - 9           # Tülle
hit = (mx_ - 24, 260)
stream(cv, bezier((mx_, my_), (mx_ - 22, my_ - 4), hit, 70), 1.2, 2.4, WSTR, seed=1)
for r in (4, 8, 12):
    for a in np.linspace(0, 2 * math.pi, 60):
        x = hit[0] + math.cos(a) * r; y = hit[1] + 1 + math.sin(a) * r * 0.3
        if in_art(x, y) and not land[int(y), int(x)] and (int(a * 10) % 3 or r < 6):
            px(cv, x, y, WATER[4] if r < 10 else WATER[3])
for (dx, dy) in [(-3, -4), (2, -5), (-5, -2), (4, -3), (0, -7)]:
    px(cv, hit[0] + dx, hit[1] + dy, (230, 244, 255))
# rechter Krug: aufs Land – das Wasser teilt sich in Rinnsale
jx, jy = JUG[1]
mx_, my_ = jx + 9, jy - 9
hit = (mx_ + 22, 252)
stream(cv, bezier((mx_, my_), (mx_ + 20, my_ - 2), hit, 60), 1.2, 2.2, WSTR, seed=2)
# wo das Wasser aufs Land fällt, blühen Sternblumen auf
FLW = [((255, 200, 236), (220, 120, 190)), ((255, 255, 255), (190, 200, 235)), ((255, 240, 160), (230, 170, 60)),
       ((200, 236, 255), (110, 160, 230))]
rf = random.Random(8)
spots = []
for _ in range(60):
    a_ = rf.uniform(0, 2 * math.pi); r_ = rf.uniform(8, 34)
    x = hit[0] + math.cos(a_) * r_ * 1.2; y = hit[1] + 12 + math.sin(a_) * r_ * 0.8
    if in_art(x, y) and land[int(y), int(x)] and y > 246:
        spots.append((int(x), int(y)))
for (x, y) in spots:
    # Stängel + Blatt
    for k in range(1, 4):
        px(cv, x, y + k, GRASS[3] if k < 3 else GRASS[2])
    px(cv, x + 1, y + 2, GRASS[4])
for (x, y) in spots:
    c, c2 = rf.choice(FLW)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        px(cv, x + dx, y + dy, c)
    px(cv, x, y, (255, 230, 120) if c != FLW[2][0] else (230, 120, 60))
    px(cv, x + 1, y + 1, c2); px(cv, x - 1, y + 1, c2)
# kleine Pfütze am Aufprall
for y in range(hit[1] - 3, hit[1] + 4):
    for x in range(hit[0] - 10, hit[0] + 11):
        if ((x - hit[0]) / 10) ** 2 + ((y - hit[1]) / 3.2) ** 2 <= 1:
            px(cv, x, y, rampc(WATER, 0.7 - (y - hit[1]) * 0.1, x, y))
for (dx, dy) in [(-3, -3), (3, -4), (0, -6), (5, -1), (-5, -1)]:
    px(cv, hit[0] + dx, hit[1] + dy, (230, 244, 255))

# ---------------------------------------------------------------- Details in voller Auflösung
# Heiligenschein
for a in np.linspace(0, 2 * math.pi, 90):
    x = 125 + math.cos(a) * 12; y = 110 + math.sin(a) * 3.2
    c = (255, 250, 220) if math.sin(a) < 0.3 else (240, 200, 130)
    px(cv, x, y, c)
    px(cv, x, y + 1, (250, 226, 170) if math.sin(a) > 0 else c)
glow(cv, 125, 110, 16, (255, 250, 210), k=0.5, mix=0.35, ry=2.2)
# Gesicht: linkes Auge zwinkert (^), rechtes groß und türkis
for (x, y) in [(114, 142), (115, 141), (116, 140), (117, 140), (118, 140), (119, 141), (120, 142)]:
    px(cv, x, y, OUT)
for (x, y) in [(116, 139), (118, 139)]:
    px(cv, x, y, (70, 30, 30))
anime_eye(cv, 128, 136, (30, 196, 214), h=8, w=6, flip=True)
px(cv, 129, 141, (180, 255, 255)); px(cv, 132, 137, (255, 255, 255))
px(cv, 121, 141, OUT)
px(cv, 125, 146, SKIN[2])                                      # Nase
MO = [(-1, 0, 1), (0, 0, 1), (1, 0, 1), (-2, 1, 1), (-1, 1, 2), (0, 1, 2), (1, 1, 2), (2, 1, 1), (-1, 2, 1), (0, 2, 3), (1, 2, 1), (0, 3, 1)]
for (dx, dy, k) in MO:
    px(cv, 125 + dx, 149 + dy, {1: (90, 20, 30), 2: (170, 36, 56), 3: (236, 110, 120)}[k])
blush(cv, 112, 146); blush(cv, 135, 146)
# Haarglanz (Ring) + Strähnen
for x in range(113, 138):
    y = 123 - int(3 * math.sin((x - 113) / 25 * math.pi))
    if x % 3 and fig[y, x, 3] and tuple(cv.a[y, x]) != OUT:
        px(cv, x, y, HAIR[5] if x % 3 == 1 else HAIR[4])
for (x0, y0, x1, y1) in [(104, 150, 103, 170), (106, 146, 105, 166), (146, 150, 147, 170), (144, 146, 145, 166),
                         (101, 160, 100, 182), (149, 160, 150, 182)]:
    for t in np.linspace(0, 1, 20):
        x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        if fig[int(y), int(round(x)), 3] and tuple(cv.a[int(y), int(round(x))]) != OUT:
            px(cv, x, y, HAIR[1])
# goldenes Muster auf dem Rock
for (x, y) in [(117, 196), (133, 196), (111, 212), (125, 206), (139, 212), (119, 222), (131, 222)]:
    sparkle(cv, x, y, GOLD[4], r=1, c2=GOLD[2])
# Finger an den Krügen
for s in (-1, 1):
    hx = 125 + s * 36
    for dy in (-1, 1):
        px(cv, hx + s * 3, 195 + dy, SKIN[1])
    jx, jy = JUG[s]
    px(cv, jx - 3, jy - 1, (255, 255, 240)); px(cv, jx - 2, jy - 2, (255, 255, 240))
# Musiknoten – sie singt
music_note(cv, 152, 122, (255, 210, 240), (200, 120, 190))
music_note(cv, 164, 106, (210, 240, 255), (120, 160, 220), double=True)
music_note(cv, 92, 116, (255, 240, 200), (220, 170, 110))
# Glitzer (nur im Hintergrund)
glitter(cv, 70, (AX0, AY0, AX1, HOR), seed=5, mask=~FM)
glitter(cv, 30, (AX0, 150, AX1, AY1), seed=6, cols=[(255, 255, 255), (220, 240, 255), (255, 220, 250)], mask=~FM)
for (x, y) in [(52, 186), (206, 196), (86, 152), (166, 152), (26, 214), (228, 90), (60, 250), (200, 272)]:
    if not FM[y, x]:
        twinkle(cv, x, y, (255, 250, 230), r=3, c2=(220, 170, 230))
finish(cv, 'XVII', 'MEGU', out='17_star_megu', emblem=emblem_star)
print('ok')
