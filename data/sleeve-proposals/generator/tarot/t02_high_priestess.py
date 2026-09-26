# -*- coding: utf-8 -*-
# II – Die Hohepriesterin: Nao, the Barrier Priestess
# Nao sitzt ruhig zwischen der dunklen Säule „B“ und der hellen Säule „J“, hinter ihr der Vorhang mit
# Granatäpfeln, dahinter das nächtliche Meer und der Vollmond. Die Schriftrolle liegt in ihrem Schoß,
# die Mondsichel zu ihren Füßen. Ihre Barriere umgibt sie als goldene Sechseck-Kuppel.
from tarot_fmhe_helpers import *

cv = new_card()
rnd = random.Random(2)
# ---------------------------------------------------------------- Nachthimmel + Mond
sky(cv, [(6, 10, 34), (10, 18, 54), (18, 32, 84), (30, 52, 116), (52, 82, 150)], y1=140)
stars(cv, 110, y1=138, seed=4, big=0.15)
MX, MY, MR = 125, 102, 36
glow(cv, MX, MY, 70, (170, 200, 255), k=0.5, mix=0.3)
MOON = [(96, 110, 150), (140, 154, 190), (184, 196, 222), (220, 228, 244), (244, 248, 255), (255, 255, 255)]
disc_relief(cv, MX, MY, MR, MOON, craters=[(106, 96, 4), (146, 98, 3), (136, 118, 5), (114, 80, 3), (120, 110, 2)], noise_k=0.35,
            seed=6, bias=0.1, k=1.6, halo=(200, 220, 255), halo_r=8)
# ---------------------------------------------------------------- Meer am Horizont
SEA = [(10, 22, 60), (18, 38, 90), (30, 62, 126), (60, 100, 170), (130, 170, 230), (220, 236, 255)]
for y in range(136, 156):
    for x in range(AX0, AX1):
        v = 0.25 + 0.25 * math.sin(x * 0.5 + y * 1.3) * 0.5 + (y - 136) * 0.004
        # Mondlicht-Pfad
        if abs(x - MX) < 10 + (y - 136) * 0.8 and (x * 3 + y * 7) % 5 < 2:
            v = 0.85
        px(cv, x, y, rampc(SEA, v, x, y))
for x in range(AX0, AX1):
    px(cv, x, 136, (120, 150, 210))

# ---------------------------------------------------------------- Vorhang mit Granatäpfeln
VX0, VX1, VY0, VY1 = 44, 206, 150, 266
VEIL = [(12, 20, 56), (22, 36, 90), (36, 58, 128), (58, 88, 164), (92, 126, 196), (140, 170, 226)]
Mv = np.zeros((H, W), bool); Mv[VY0:VY1, VX0:VX1] = True
Hv = np.zeros((H, W), np.float32)
for x in range(VX0, VX1):
    Hv[:, x] = math.sin((x - VX0) * 0.33) * 1.6 + math.sin((x - VX0) * 0.11) * 0.8
relief(cv, Hv, np.zeros((H, W), np.int32), [VEIL], Mv, k=1.3, bias=0.0)
# Muster: Palmwedel-Raute + Granatäpfel
POM = [(70, 8, 20), (140, 20, 36), (200, 44, 54), (240, 100, 90), (255, 170, 150)]
LEAF = [(8, 40, 30), (16, 76, 50), (34, 116, 70), (70, 160, 100), (130, 210, 150)]
def pomegranate(cx, cy):
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            d = math.hypot(x - cx, (y - cy) * 1.05)
            if d <= 4.2:
                v = 0.8 - d / 6 - (x - cx + y - cy) * 0.06
                px(cv, x, y, rampc(POM, v, x, y))
            elif d <= 5.0:
                px(cv, x, y, (30, 6, 16))
    # Krönchen
    for (dx, dy) in [(-1, -5), (0, -6), (1, -5), (-2, -6), (2, -6)]:
        px(cv, cx + dx, cy + dy, POM[1] if dy == -5 else (30, 6, 16))
    px(cv, cx - 1, cy - 2, POM[4])
    # Blätter
    for (dx, dy) in [(-3, -5), (-4, -6), (3, -5), (4, -6)]:
        px(cv, cx + dx, cy + dy, LEAF[3])
for j, y in enumerate(range(VY0 + 12, VY1, 22)):
    for i, x in enumerate(range(VX0 + 10 + (11 if j % 2 else 0), VX1 - 4, 22)):
        # Rautenlinien (goldene Fäden)
        for t in range(-11, 12):
            for (xx, yy_) in [(x + t, y + 11 - abs(t))]:
                if VX0 <= xx < VX1 and VY0 < yy_ < VY1 and (xx + yy_) % 2 == 0:
                    px(cv, xx, yy_, (150, 130, 70))
        pomegranate(x, y)
# Vorhangstange + Saum
for x in range(VX0 - 2, VX1 + 2):
    for y in range(VY0 - 3, VY0 + 1):
        px(cv, x, y, rampc(GOLD, 0.9 - (y - VY0 + 3) * 0.2, x, y))
    px(cv, x, VY0 - 4, OUT); px(cv, x, VY0 + 1, OUT)
for x in range(VX0, VX1, 7):
    for y in range(VY0 + 1, VY0 + 5):
        px(cv, x, y, GOLD[2]); px(cv, x + 1, y, GOLD[3])

# ---------------------------------------------------------------- Boden (Marmorfliesen in Perspektive)
FY = 262
for y in range(FY, AY1):
    for x in range(AX0, AX1):
        t = (y - FY) / (AY1 - FY)
        u = (x - CX) / (0.6 + t * 1.2)
        tile = (int(math.floor(u / 16)) + int(math.floor((t ** 0.7) * 5))) % 2
        base = [(40, 52, 90), (70, 86, 130), (100, 116, 160)] if tile else [(170, 180, 210), (206, 214, 236), (236, 240, 252)]
        v = 0.3 + t * 0.6 + (noise(H, W, 3, seed=8)[y, x] - 0.5) * 0.4
        px(cv, x, y, rampc(base, v, x, y))
for x in range(AX0, AX1):
    px(cv, x, FY, (20, 20, 44)); px(cv, x, FY + 1, (140, 150, 190))

# ---------------------------------------------------------------- Säulen B (dunkel) und J (hell)
def pillar(x0, x1, ramp, letter, lcol):
    Mp = np.zeros((H, W), bool); Mp[AY0:FY + 6, x0:x1] = True
    cxp = (x0 + x1) / 2; hw = (x1 - x0) / 2
    Hp = np.zeros((H, W), np.float32)
    for x in range(x0, x1):
        Hp[:, x] = math.sqrt(max(0, 1 - ((x - cxp) / (hw + 0.5)) ** 2)) * 4 + (0.8 if (x - x0) % 6 == 3 else 0)
    Hp += (noise(H, W, 2, seed=x0) - 0.5) * 0.5
    relief(cv, Hp, np.zeros((H, W), np.int32), [ramp], Mp, k=1.4, bias=0.02)
    # Kapitell (Lotus) und Sockel
    for (yc, hh) in [(AY0 + 16, 10), (FY - 2, 8)]:
        Mc = np.zeros((H, W), bool); Mc[yc - hh // 2:yc + hh // 2, x0 - 4:x1 + 4] = True
        Hc = np.zeros((H, W), np.float32)
        for y in range(yc - hh // 2, yc + hh // 2):
            Hc[y, :] = math.sin(math.pi * (y - yc + hh / 2) / hh) * 2.5
        for x in range(x0 - 4, x1 + 4):
            Hc[:, x] += math.sin((x - x0) * 0.8) * 0.6
        relief(cv, Hc, np.zeros((H, W), np.int32), [ramp], Mc & art_mask(), k=1.6, bias=0.05)
        outline_mask(cv, Mc & art_mask(), OUT)
        # goldene Ringe über/unter dem Wulst
        for x in range(x0, x1):
            for yr in (yc - hh // 2 - 2, yc + hh // 2 + 1):
                if in_art(x, yr):
                    px(cv, x, yr, GOLD[3] if x % 2 else GOLD[2])
    # Lotusblätter am Kapitell
    for i in range(4):
        lx = x0 + 3 + i * (x1 - x0 - 6) / 3
        for yy_ in range(AY0 + 26, AY0 + 36):
            wv = (AY0 + 36 - yy_) * 0.35
            for x in range(int(lx - wv), int(lx + wv) + 1):
                if in_art(x, yy_):
                    px(cv, x, yy_, rampc(ramp, 0.75 - (x - lx + wv) / (2 * wv + 1) * 0.5, x, yy_))
            if in_art(int(lx - wv) - 1, yy_):
                px(cv, int(lx - wv) - 1, yy_, OUT)
    outline_mask(cv, Mp & art_mask(), OUT)
    glyph(cv, letter, 22, cxp, 100, lcol, outline=OUT)
PB = [(8, 8, 18), (18, 18, 34), (30, 30, 52), (46, 46, 74), (66, 68, 100), (92, 96, 130)]
PJ = [(110, 116, 150), (156, 162, 192), (196, 200, 224), (226, 230, 244), (244, 246, 252), (255, 255, 255)]
pillar(AX0, 44, PB, 'B', [(150, 140, 110), (200, 186, 140), (236, 226, 190), (255, 250, 230), (255, 255, 255)])
pillar(206, AX1, PJ, 'J', [(20, 16, 40), (34, 28, 64), (52, 46, 92), (76, 70, 120), (100, 96, 150)])

# ---------------------------------------------------------------- Barriere hinten (Sechseck-Gitter)
BX, BY, BRX, BRY = 125, 196, 78, 118
BG_ = [(255, 210, 90), (255, 236, 150), (255, 250, 210)]
yy, xx = np.indices((H, W))
er = np.sqrt(((xx - BX) / BRX) ** 2 + ((yy - BY) / BRY) ** 2)
S3 = math.sqrt(3)
def hexline(x, y, s=9.0):
    # Abstand zum nächsten Sechseckrand (spitz oben)
    q = (S3 / 3 * x - 1 / 3 * y) / s; r = (2 / 3 * y) / s
    cx_, cz = q, r; cy_ = -cx_ - cz
    rx, ry, rz = round(cx_), round(cy_), round(cz)
    dx, dy, dz = abs(rx - cx_), abs(ry - cy_), abs(rz - cz)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry
    hx = s * (S3 * rx + S3 / 2 * rz); hy = s * 1.5 * rz
    px_, py_ = x - hx, y - hy
    dmax = max(abs(px_), abs(px_ * 0.5 + py_ * S3 / 2), abs(px_ * 0.5 - py_ * S3 / 2))
    return s * S3 / 2 - dmax
def barrier(front):
    for y in range(AY0, AY1):
        for x in range(AX0, AX1):
            e = er[y, x]
            if e > 1.0 or y > FY + 14:
                continue
            # Kugel-Verzerrung: Gitter wird zum Rand hin gestaucht
            k = 1 / math.sqrt(max(0.12, 1 - e * e))
            hxv = BX + (x - BX) * (0.92 + 0.08 * k); hyv = BY + (y - BY) * (0.92 + 0.08 * k)
            d = hexline(hxv, hyv, 11.0)
            fres = e ** 3
            if d < 0.6:
                blend_px(cv, x, y, BG_[1] if (x + y) % 3 else BG_[2], 0.5 + 0.45 * fres)
            elif d < 1.6:
                if BAYER4[y % 4, x % 4] < 0.3 + fres * 0.4:
                    blend_px(cv, x, y, BG_[0], 0.3)
            elif BAYER4[y % 4, x % 4] < 0.06 + fres * 0.3:
                blend_px(cv, x, y, (255, 226, 140), 0.3)
barrier(False)
glow(cv, BX, BY - 20, 80, (255, 220, 140), k=0.3, mix=0.2)

# ---------------------------------------------------------------- Farben
HAIR = [(34, 16, 12), (62, 32, 20), (96, 54, 32), (134, 82, 50), (172, 118, 78), (204, 160, 116)]
ROBE = [(44, 10, 18), (84, 20, 30), (124, 34, 42), (164, 56, 56), (200, 92, 80), (228, 136, 116)]
PAUL = [(46, 56, 52), (96, 112, 100), (150, 168, 150), (198, 212, 194), (234, 242, 230), (255, 255, 250)]
CAPE = [(10, 16, 52), (20, 34, 96), (36, 60, 146), (60, 96, 196), (104, 144, 230), (160, 196, 250)]
STONE_T = [(40, 46, 80), (70, 78, 116), (104, 112, 150), (140, 148, 184), (180, 188, 218), (220, 226, 244)]
SCROLL = [(120, 100, 70), (180, 160, 120), (224, 210, 170), (246, 238, 210), (255, 252, 236)]

f = Fig(W, H)
# ---- Mantel (blau mit silbernem Saum), fällt von den Schultern weit auf den Boden
f.part('cape')
f.poly([(98, 150), (152, 150), (166, 186), (176, 240), (184, 272), (160, 278), (90, 278), (66, 272), (74, 240), (84, 186)], 'c')
f.part('capeTrimL'); f.poly([(84, 186), (88, 186), (78, 240), (70, 272), (66, 272), (74, 240)], 'W')
f.part('capeTrimR'); f.poly([(166, 186), (162, 186), (172, 240), (180, 272), (184, 272), (176, 240)], 'W')
# ---- Haare hinten (bis über die Schultern)
f.part('hairB')
f.poly([(103, 118), (147, 118), (155, 150), (153, 172), (144, 176), (106, 176), (97, 172), (95, 150)], 'h')
# ---- Rock (sitzend): Knie vorn, Stoff fällt in Falten, gewellter Saum
hem = []
for i in range(25):
    x = 87 + i * (163 - 87) / 24
    hem.append((x, 279 + 2.2 * math.sin(i * 1.3) + (2 if 8 < i < 17 else 0)))
f.part('skirt')
f.poly([(108, 190), (142, 190), (154, 208), (158, 240), (163, 272)] + hem[::-1] + [(87, 272), (92, 240), (96, 208)], 'r')
f.part('knees', line=False); f.ellipse(113, 212, 13, 8, 'r'); f.ellipse(137, 212, 13, 8, 'r')
# Faltenwurf: Täler (dunkel) und Grate (hell), ohne Kontur
f.part('folds', line=False)
for (x0, y0, x1, y1, w0) in [(100, 220, 92, 276, 2.2), (109, 222, 106, 280, 1.6), (141, 222, 144, 280, 1.6), (150, 220, 158, 276, 2.2)]:
    f.limb(x0, y0, x1, y1, 0.6, w0, 'q')
for (x0, y0, x1, y1, w0) in [(104, 222, 99, 278, 1.4), (146, 222, 151, 278, 1.4), (95, 230, 89, 272, 1.0), (155, 230, 161, 272, 1.0)]:
    f.limb(x0, y0, x1, y1, 0.5, w0, 'u')
f.curve([(112, 219), (118, 226), (125, 228), (132, 226), (138, 219)], 'q', w=1.4)     # Mulde zwischen den Knien
f.curve([(106, 214), (111, 208), (118, 207)], 'u', w=1.2); f.curve([(132, 207), (139, 208), (144, 214)], 'u', w=1.2)
f.part('hemBorder')
f.curve([(hx, hy - 1.5) for hx, hy in hem], 'g', w=3)
f.part('stole'); f.poly([(119, 214), (131, 214), (134, 279), (125, 283), (116, 279)], 'W')
f.part('stoleL'); f.line(119, 214, 116, 279, 'g', w=1)
f.part('stoleR'); f.line(131, 214, 134, 279, 'g', w=1)
# ---- Oberkörper (schmale Taille) mit Brustfalten
f.part('torso')
f.poly([(104, 152), (146, 152), (148, 170), (142, 192), (108, 192), (102, 170)], 'r')
f.part('tfolds', line=False)
f.limb(112, 164, 116, 184, 0.5, 1.2, 'q'); f.limb(138, 164, 134, 184, 0.5, 1.2, 'q')
f.limb(109, 168, 112, 184, 0.4, 0.9, 'u'); f.limb(141, 168, 138, 184, 0.4, 0.9, 'u')
f.part('collar'); f.poly([(116, 151), (134, 151), (125, 163)], 'W')
f.part('belt'); f.poly([(107, 185), (143, 185), (142, 191), (108, 191)], 'g')
f.part('buckle'); f.ellipse(125, 188, 3.5, 3.5, 'g')
# ---- Schriftrolle im Schoß
f.part('scroll'); f.poly([(99, 201), (151, 201), (153, 212), (97, 212)], 'p')
f.part('rollL'); f.ellipse(97, 206, 4, 7, 'p')
f.part('rollR'); f.ellipse(153, 206, 4, 7, 'p')
# ---- Arme mit weiten Ärmeln (Faltenlinien)
f.part('slvL'); f.poly([(102, 158), (94, 172), (88, 196), (85, 222), (100, 215), (109, 206), (106, 180)], 'r')
f.part('slvLf', line=False); f.limb(98, 172, 92, 214, 0.5, 1.5, 'q'); f.limb(103, 182, 99, 210, 0.4, 1.0, 'u')
f.part('slvR'); f.poly([(148, 158), (156, 172), (162, 196), (165, 222), (150, 215), (141, 206), (144, 180)], 'r')
f.part('slvRf', line=False); f.limb(152, 172, 158, 214, 0.5, 1.5, 'q'); f.limb(147, 182, 151, 210, 0.4, 1.0, 'u')
f.part('cuffL'); f.line(85, 221, 100, 214, 'g', w=2)
f.part('cuffR'); f.line(165, 221, 150, 214, 'g', w=2)
# Hände umfassen die Rollenenden: Handrücken + Daumen oben auf der Rolle
f.part('handL'); f.ellipse(103, 206, 5.5, 5, 's'); f.ellipse(99, 201, 3, 2.2, 's')
f.part('handR'); f.ellipse(147, 206, 5.5, 5, 's'); f.ellipse(151, 201, 3, 2.2, 's')
# ---- Schulterschützer (weiß/salbeigrün wie auf der Karte)
f.part('paulL'); f.ellipse(101, 157, 11, 8, 'P'); f.poly([(90, 157), (112, 157), (109, 169), (93, 169)], 'P')
f.part('paulR'); f.ellipse(149, 157, 11, 8, 'P'); f.poly([(138, 157), (160, 157), (157, 169), (141, 169)], 'P')
# ---- Kopf
f.part('neck'); f.rect(120, 142, 130, 153, 's')
cx, cy = 125, 128
f.part('face')
f.ellipse(cx, cy + 1, 17, 15, 's')
f.poly([(cx - 16, cy + 3), (cx + 16, cy + 3), (cx + 12, cy + 12), (cx + 5, cy + 17), (cx, cy + 18), (cx - 5, cy + 17), (cx - 12, cy + 12)], 's')
f.part('bangs')   # Pony aus vielen spitzen Strähnen
bang = [(cx - 19, cy + 6), (cx - 20, cy - 4), (cx - 13, cy - 15), (cx, cy - 19), (cx + 13, cy - 15), (cx + 20, cy - 4), (cx + 19, cy + 6)]
tips = [(18, 0), (15, -7), (13, -4), (10, -9), (7, -4), (4, -10), (1, -5), (-2, -10), (-5, -4), (-8, -9), (-11, -4), (-13, -7), (-17, 0)]
f.poly(bang + [(cx + dx, cy + dy) for dx, dy in tips], 'h')
f.part('sideL'); f.poly([(cx - 19, cy - 4), (cx - 15, cy + 1), (cx - 15, cy + 18), (cx - 17, cy + 32), (cx - 23, cy + 22)], 'h')
f.part('sideR'); f.poly([(cx + 19, cy - 4), (cx + 15, cy + 1), (cx + 15, cy + 18), (cx + 17, cy + 32), (cx + 23, cy + 22)], 'h')
# Stirnreif mit Mondsichel
f.part('circlet'); f.curve([(cx - 18, cy - 7), (cx - 8, cy - 12), (cx, cy - 13), (cx + 8, cy - 12), (cx + 18, cy - 7)], 'S', w=2)
f.part('gem'); f.ellipse(cx, cy - 14, 3, 3, 'S')
f.outline()

MATS = {
    's': mat(SKIN, pillow=5, k=0.8, bias=0.08),
    'h': mat(HAIR, pillow=4, k=1.8, noise=0.9, nscale=2, bias=0.05),
    'r': mat(ROBE, pillow=5, k=1.5, folds=(0.3, 0.03, 0.8), bias=0.05),
    'q': mat(ROBE[:4], pillow=1, k=1.0, bias=-0.25),
    'u': mat(ROBE[2:], pillow=1, k=1.0, bias=0.1),
    'c': mat(CAPE, pillow=5, k=1.4, folds=(0.4, 0.02, 1.0), bias=0.0),
    'W': mat(WHITE_CLOTH, pillow=2, k=1.2, bias=0.1),
    'P': mat(PAUL, pillow=4, k=1.8, spec=True, spec_col=(255, 255, 255), bias=0.05),
    'g': mat(GOLD, pillow=1.5, k=1.6, spec=True, spec_col=(255, 255, 230)),
    'S': mat(SILVER, pillow=1.5, k=1.8, spec=True, bias=0.1),
    'p': mat(SCROLL, pillow=2.5, k=1.4, bias=0.1),
    't': mat(STONE_T, pillow=3, k=1.4, bias=-0.05),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)
def inside(x, y):
    return fig[int(y), int(x), 3] > 0 and tuple(cv.a[int(y), int(x)]) != OUT

# ---------------------------------------------------------------- Details
EYE = (224, 146, 40)
big_eye(cv, 110, 128, EYE, w=7, h=9)
big_eye(cv, 133, 128, EYE, w=7, h=9, flip=True)
# Brauen (zart, über dem Pony sichtbar)
for (bx, d) in [(111, 1), (134, -1)]:
    for i in range(6):
        yb = 123 - (1 if 1 <= i <= 3 - (0 if d > 0 else -1) else 0)
        px(cv, bx + i, yb, HAIR[1])
# Nase + kleiner Mund + Rouge
px(cv, 126, 139, SKIN[2]); px(cv, 125, 140, SKIN[3])
for x in range(123, 128): px(cv, x, 143, (140, 50, 60))
px(cv, 122, 142, (140, 50, 60)); px(cv, 128, 142, (140, 50, 60))
for x in range(124, 127): px(cv, x, 144, (220, 120, 120))
for (bx, by) in [(110, 139), (134, 139)]:
    for dy in range(2):
        for dx in range(6):
            if (bx + dx + by + dy) % 2 == 0:
                blend_px(cv, bx + dx, by + dy, (250, 130, 140), 0.55)
# Haarsträhnen: dunkle Linien zwischen den Strähnen + Glanzring
for (x0, y0, x1, y1) in [(116, 112, 113, 124), (122, 110, 121, 125), (128, 110, 129, 125), (134, 112, 137, 124),
                         (110, 118, 106, 128), (140, 118, 144, 128)]:
    for t in np.linspace(0, 1, 16):
        x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        if inside(x, y) and tuple(cv.a[int(y), int(x)]) in set(tuple(c) for c in HAIR):
            px(cv, x, y, HAIR[1])
for x in range(108, 143):
    y = 117 + ((x - 125) / 17) ** 2 * 5
    if inside(x, y) and tuple(cv.a[int(y), int(x)]) in set(tuple(c) for c in HAIR) and (x % 5) != 0:
        px(cv, x, y, HAIR[4]); px(cv, x, y + 1, HAIR[3])
for (x0, y0, x1, y1) in [(104, 132, 104, 154), (146, 132, 146, 154), (101, 150, 100, 168), (149, 150, 150, 168)]:
    for t in np.linspace(0, 1, 16):
        x = x0 + (x1 - x0) * t + math.sin(t * 3) * 0.8; y = y0 + (y1 - y0) * t
        if inside(x, y) and tuple(cv.a[int(y), int(x)]) in set(tuple(c) for c in HAIR):
            px(cv, x, y, HAIR[1])
# Mondsichel am Stirnreif
px(cv, 124, 114, (255, 255, 255)); px(cv, 126, 115, (200, 220, 255))
# Schriftrolle: „TORA“ in winzigen Lettern + Zeilen
GL = {'T': ["###", ".#.", ".#.", ".#.", ".#."], 'O': ["###", "#.#", "#.#", "#.#", "###"],
      'R': ["##.", "#.#", "##.", "#.#", "#.#"], 'A': [".#.", "#.#", "###", "#.#", "#.#"]}
for i, ch in enumerate("TORA"):
    for j, row in enumerate(GL[ch]):
        for k, c in enumerate(row):
            if c == '#':
                px(cv, 118 + i * 4 + k, 203 + j, (70, 50, 40))
for x in range(108, 143):
    if x % 5 != 0 and inside(x, 210):
        px(cv, x, 210, (170, 150, 110))
# Finger
for (fx, fy0) in [(101, 204), (104, 205), (107, 205)]:
    for fy in range(fy0, fy0 + 4):
        px(cv, fx, fy, SKIN[1]); px(cv, 250 - fx, fy, SKIN[1])
for x in range(97, 102):
    px(cv, x, 203, SKIN[1]); px(cv, 250 - x, 203, SKIN[1])
px(cv, 98, 200, SKIN[5]); px(cv, 152, 200, SKIN[5])
# Goldrand an den Schulterschützern + grüne Einlage (wie auf der Karte)
for (pcx, pcy) in [(100, 158), (150, 158)]:
    for x in range(pcx - 8, pcx + 9):
        y = pcy + 10
        if inside(x, y):
            px(cv, x, y, GOLD[3] if x % 2 else GOLD[2])
    for y in range(pcy - 3, pcy + 7):
        if inside(pcx, y):
            px(cv, pcx, y, (100, 150, 110)); px(cv, pcx + 1, y, (70, 120, 90))
# Stickerei am Rock: Kreuz-/Sternmuster
for (x, y) in [(104, 246), (146, 246), (100, 262), (150, 262)]:
    if inside(x, y):
        sparkle(cv, x, y, GOLD[3], r=1, c2=GOLD[1])
# Stola: goldene Sechsecke (Barrieren-Zeichen)
for (ex_, ey_) in [(125, 232), (125, 252), (125, 272)]:
    hexp = [(ex_ + math.cos(math.pi / 6 + i * math.pi / 3) * 4, ey_ + math.sin(math.pi / 6 + i * math.pi / 3) * 4) for i in range(7)]
    for i in range(6):
        (x0, y0), (x1, y1) = hexp[i], hexp[i + 1]
        for t in np.linspace(0, 1, 8):
            px(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, GOLD[2])
    px(cv, ex_, ey_, GOLD[4])
# Sonnenkreuz auf der Brust (wie bei der klassischen Hohepriesterin)
for k in range(-3, 4):
    px(cv, 125 + k, 172, GOLD[3]); px(cv, 125, 172 + k, GOLD[3])
px(cv, 125, 172, GOLD[5])
# Muster auf der Saumborte
for i in range(88, 163, 5):
    for y in range(268, 290):
        if tuple(cv.a[y, i]) in set(tuple(c) for c in GOLD) and not (118 <= i <= 132):
            px(cv, i, y, RUBY[2]); break

# ---------------------------------------------------------------- Mondsichel zu ihren Füßen
CM = np.zeros((H, W), bool)
for y in range(236, AY1):
    for x in range(60, 190):
        d1 = math.hypot((x - 125) / 58, (y - 262) / 36)
        d2 = math.hypot((x - 125) / 56, (y - 254) / 35)
        if d1 <= 1 and d2 > 1:
            CM[y, x] = True
CM &= art_mask()
glow(cv, 125, 286, 50, (255, 240, 180), k=0.5, rx=0.8, ry=2.0, mix=0.3)
pillow_relief(cv, CM, [(150, 110, 40), (220, 170, 70), (250, 214, 120), (255, 240, 190), (255, 252, 236), (255, 255, 255)], pillow=3, k=1.6, bias=0.15)
outline_mask(cv, CM, (20, 20, 50))

# ---------------------------------------------------------------- Barriere vorn (leuchtender Rand)
for t in np.linspace(0, 2 * math.pi, 900):
    x = BX + math.cos(t) * BRX; y = BY + math.sin(t) * BRY
    if y < FY + 12 and in_art(x, y):
        px(cv, x, y, (255, 236, 150) if (int(t * 100) % 7) else (255, 255, 230))
        blend_px(cv, x + 1, y, (255, 220, 120), 0.4); blend_px(cv, x - 1, y, (255, 220, 120), 0.4)
# Lichtpunkte in der Barriere
for _ in range(26):
    a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.6, 0.98)
    x = BX + math.cos(a) * BRX * r; y = BY + math.sin(a) * BRY * r
    if y < FY and not inside(x, y):
        sparkle(cv, x, y, (255, 250, 210), r=rnd.choice([1, 1, 2]), c2=(255, 200, 90))

finish(cv, 'II', 'NAO', out='02_high_priestess_nao', emblem=emblem_moon)
print('ok')
