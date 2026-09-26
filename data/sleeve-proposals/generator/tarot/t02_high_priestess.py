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
# ---- Haare hinten
f.part('hairB')
f.poly([(104, 120), (146, 120), (153, 150), (150, 168), (100, 168), (97, 150)], 'h')
# ---- Rock (sitzend: Knie nach vorn, Stoff fällt in Falten auf den Boden)
f.part('skirt')
f.poly([(108, 190), (142, 190), (154, 210), (158, 240), (163, 270), (154, 280), (125, 283), (96, 280), (87, 270), (92, 240), (96, 210)], 'r')
f.part('knees'); f.ellipse(113, 212, 13, 8, 'r'); f.ellipse(137, 212, 13, 8, 'r')
f.part('stole'); f.poly([(119, 214), (131, 214), (134, 280), (125, 284), (116, 280)], 'W')
f.part('stoleL'); f.line(119, 214, 116, 280, 'g', w=1)
f.part('stoleR'); f.line(131, 214, 134, 280, 'g', w=1)
# ---- Oberkörper (schmale Taille)
f.part('torso')
f.poly([(104, 152), (146, 152), (148, 170), (142, 192), (108, 192), (102, 170)], 'r')
f.part('collar'); f.poly([(116, 151), (134, 151), (125, 163)], 'W')
f.part('belt'); f.poly([(107, 185), (143, 185), (142, 191), (108, 191)], 'g')
f.part('buckle'); f.ellipse(125, 188, 3.5, 3.5, 'g')
# ---- Schriftrolle im Schoß
f.part('scroll'); f.poly([(100, 201), (150, 201), (152, 212), (98, 212)], 'p')
f.part('rollL'); f.ellipse(98, 206, 4, 7, 'p')
f.part('rollR'); f.ellipse(152, 206, 4, 7, 'p')
# ---- Arme mit weiten Ärmeln
f.part('slvL'); f.poly([(102, 158), (94, 172), (88, 196), (86, 222), (100, 214), (108, 204), (106, 180)], 'r')
f.part('slvR'); f.poly([(148, 158), (156, 172), (162, 196), (164, 222), (150, 214), (142, 204), (144, 180)], 'r')
f.part('cuffL'); f.line(86, 221, 100, 213, 'g', w=2)
f.part('cuffR'); f.line(164, 221, 150, 213, 'g', w=2)
f.part('handL'); f.ellipse(106, 203, 5, 4.5, 's')
f.part('handR'); f.ellipse(144, 203, 5, 4.5, 's')
# ---- Schulterschützer (weiß/salbeigrün wie auf der Karte)
f.part('paulL'); f.ellipse(101, 157, 11, 8, 'P'); f.poly([(90, 157), (112, 157), (109, 169), (93, 169)], 'P')
f.part('paulR'); f.ellipse(149, 157, 11, 8, 'P'); f.poly([(138, 157), (160, 157), (157, 169), (141, 169)], 'P')
# ---- Kopf
f.part('neck'); f.rect(120, 142, 130, 153, 's')
cx, cy = 125, 128
f.part('face')
f.ellipse(cx, cy + 1, 16, 15, 's')
f.poly([(cx - 15, cy + 3), (cx + 15, cy + 3), (cx + 11, cy + 13), (cx + 4, cy + 18), (cx - 4, cy + 18), (cx - 11, cy + 13)], 's')
f.part('bangs')
f.poly([(cx - 18, cy + 12), (cx - 19, cy - 4), (cx - 12, cy - 15), (cx, cy - 19), (cx + 12, cy - 15), (cx + 19, cy - 4), (cx + 18, cy + 12),
        (cx + 15, cy + 1), (cx + 12, cy - 5), (cx + 9, cy - 1), (cx + 5, cy - 6), (cx + 1, cy - 1), (cx - 3, cy - 6),
        (cx - 7, cy - 1), (cx - 10, cy - 5), (cx - 13, cy + 1), (cx - 15, cy + 1)], 'h')
f.part('sideL'); f.poly([(cx - 18, cy - 2), (cx - 13, cy + 2), (cx - 12, cy + 20), (cx - 15, cy + 32), (cx - 21, cy + 22)], 'h')
f.part('sideR'); f.poly([(cx + 18, cy - 2), (cx + 13, cy + 2), (cx + 12, cy + 20), (cx + 15, cy + 32), (cx + 21, cy + 22)], 'h')
# Stirnreif mit Mondsichel
f.part('circlet'); f.curve([(cx - 17, cy - 6), (cx - 8, cy - 11), (cx, cy - 12), (cx + 8, cy - 11), (cx + 17, cy - 6)], 'S', w=2)
f.part('gem'); f.ellipse(cx, cy - 13, 3, 3, 'S')
f.outline()

MATS = {
    's': mat(SKIN, pillow=4, k=1.0, bias=0.14),
    'h': mat(HAIR, pillow=4, k=1.8, noise=0.9, nscale=2, bias=0.05),
    'r': mat(ROBE, pillow=5, k=1.5, folds=(0.3, 0.03, 0.8), bias=0.05),
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
EYE = (196, 120, 44)
big_eye(cv, 112, 130, EYE, w=6, h=8)
big_eye(cv, 132, 130, EYE, w=6, h=8, flip=True)
for x in range(113, 119): px(cv, x, 126 if x not in (115, 116) else 125, HAIR[1])
for x in range(132, 138): px(cv, x, 126 if x not in (134, 135) else 125, HAIR[1])
px(cv, 125, 139, SKIN[2]); px(cv, 126, 140, SKIN[1])
for x in range(123, 128): px(cv, x, 143, (170, 70, 70))
px(cv, 124, 144, (220, 120, 110)); px(cv, 125, 144, (220, 120, 110)); px(cv, 126, 144, (220, 120, 110))
blush(cv, 113, 140); blush(cv, 135, 140)
# Haarsträhnen-Glanz
for (hx, hy, L) in [(110, 116, 6), (118, 112, 7), (130, 112, 7), (138, 116, 6)]:
    for k in range(L):
        x = hx + (k * 0.3 if hx < 125 else -k * 0.3); y = hy + k
        if inside(x, y):
            px(cv, x, y, HAIR[4])
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
for (fx, fy) in [(103, 202), (103, 205), (147, 202), (147, 205)]:
    px(cv, fx, fy, SKIN[1])
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
for (x, y) in [(110, 240), (140, 240), (125, 256), (100, 262), (150, 262), (125, 228)]:
    if inside(x, y):
        sparkle(cv, x, y, GOLD[3], r=1, c2=GOLD[1])
# Faltenlinien im Rock
for (x0, y0, x1, y1) in [(104, 222, 97, 278), (116, 224, 114, 281), (134, 224, 136, 281), (146, 222, 153, 278)]:
    for t in np.linspace(0, 1, 60):
        x = x0 + (x1 - x0) * t + math.sin(t * 4) * 1.2; y = y0 + (y1 - y0) * t
        if inside(x, y) and inside(x + 1, y):
            px(cv, x, y, ROBE[1]); 
            if t > 0.1 and inside(x - 1, y):
                px(cv, x - 1, y, ROBE[4] if (int(y) % 3) else ROBE[3])
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
# goldene Borte am Rocksaum
for x in range(86, 166):
    for yb in range(268, 283):
        if inside(x, yb) and not inside(x, yb + 1):
            px(cv, x, yb - 1, GOLD[3]); px(cv, x, yb - 2, GOLD[2])
            break

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
