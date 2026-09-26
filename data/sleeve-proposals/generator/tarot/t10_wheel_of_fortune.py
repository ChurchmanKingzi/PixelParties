# -*- coding: utf-8 -*-
# X – Das Rad des Schicksals: Willy, the Valiant Leprechaun
# Ein großes goldenes Glücksrad (T-A-R-O auf dem Ring, Kleeblatt/Münze/Hufeisen/Stern zwischen den Speichen)
# schwebt im Himmel unter einem Regenbogen. Willy thront wie die Sphinx oben auf dem Rad und reckt eine
# Goldmünze. Links purzeln Goldmünzen abwärts (statt der Schlange), rechts reitet ein Goldsack aufwärts
# (statt Anubis). In den vier Ecken Wolken mit Glückssymbolen: Kleeblatt, Hufeisen, Würfel, Goldtopf.
from t08_helpers import *

cv = new_card()
rnd = random.Random(10)
yy, xx = np.indices((H, W))
# ---------------------------------------------------------------- Himmel
sky(cv, [(30, 80, 190), (44, 112, 222), (72, 146, 236), (120, 184, 246), (176, 218, 250), (220, 238, 252)])
# weiche Lichtstrahlen hinter dem Rad
WCX, WCY, WR = 125, 216, 64
rays(cv, WCX, WCY, 24, WR, 170, (255, 244, 200), width=0.1, k=0.35, mix=0.3)
# ---------------------------------------------------------------- Regenbogen (Bogen über Willy und dem Rad)
RB = [(230, 40, 40), (250, 130, 30), (250, 220, 50), (70, 190, 60), (50, 120, 230), (110, 70, 200), (170, 80, 210)]
RCX, RCY, R0 = 125, 168, 116
for y in range(AY0, AY1):
    for x in range(AX0, AX1):
        d = math.hypot(x - RCX, (y - RCY) * 1.02)
        k = (R0 - d) / 2.0
        if 0 <= k < 7 and y < RCY + 40:
            i = int(k); f_ = k - i
            c = RB[i]
            if f_ > 0.75 and i < 6 and BAYER4[y % 4, x % 4] < (f_ - 0.75) * 4:
                c = RB[i + 1]
            # zum unteren Ende hin ausblenden
            fade = max(0, (y - (RCY - 10)) / 50)
            if BAYER4[y % 4, x % 4] < fade:
                continue
            blend_px(cv, x, y, c, 0.8)
        elif -3 <= k < 0 or 7 <= k < 10:
            if BAYER4[y % 4, x % 4] < 0.3 and y < RCY + 20:
                blend_px(cv, x, y, (255, 255, 255), 0.25)
# ---------------------------------------------------------------- Wolkenband unten
CL = [(120, 150, 210), (170, 196, 236), (214, 230, 250), (246, 250, 255)]
for (cx_, cy_, w_, h_, sd) in [(60, 296, 70, 18, 1), (125, 300, 80, 16, 2), (190, 296, 70, 18, 3), (30, 280, 30, 12, 4), (220, 282, 30, 12, 5)]:
    puffy_cloud(cv, cx_, cy_, w_, h_, CL, seed=sd)

# ---------------------------------------------------------------- Hilfsformen: Münze und Kleeblatt
def big_coin(cx_, cy_, r, squash=1.0, seed=0):
    """Goldmünze mit Rand und Kleeblatt-Prägung; squash < 1 = gedreht (Ellipse)"""
    rx_ = max(1.0, r * squash)
    for y in range(int(cy_ - r) - 2, int(cy_ + r) + 3):
        for x in range(int(cx_ - rx_) - 2, int(cx_ + rx_) + 3):
            d = math.hypot((x - cx_) / rx_, (y - cy_) / r)
            if d <= 1.0:
                v = 0.65 - (y - cy_) / r * 0.3 - (x - cx_) / max(rx_, 1) * 0.15
                if d > 0.72:
                    v += 0.15
                elif d > 0.6:
                    v -= 0.25
                px(cv, x, y, rampc(GOLD7, v, x, y))
            elif d <= 1.0 + 1.3 / r:
                px(cv, x, y, (70, 34, 8))
    if squash > 0.6 and r >= 4:
        px(cv, cx_, cy_ - 1, GOLD7[2]); px(cv, cx_ - 1, cy_, GOLD7[2]); px(cv, cx_ + 1, cy_, GOLD7[2]); px(cv, cx_, cy_ + 1, GOLD7[1])
    px(cv, cx_ - rx_ * 0.4, cy_ - r * 0.5, (255, 255, 240))
def clover_mask(cx_, cy_, sc=1.0):
    """Maske eines vierblättrigen Kleeblatts (vier Herzblätter, diagonale Spalten)"""
    M = np.zeros((H, W), bool); V = np.zeros((H, W), np.float32)
    dx = (xx - cx_) / sc; dy = (yy - cy_) / sc
    for (ux, uy) in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        a_ = dx * ux + dy * uy
        p_ = dx * (-uy) + dy * ux
        lobe = np.minimum(np.hypot(a_ - 3.9, p_ - 2.1), np.hypot(a_ - 3.9, p_ + 2.1)) <= 2.35
        tri = (a_ > 0) & (a_ <= 4.2) & (np.abs(p_) <= a_ * 0.75)
        m = (lobe | tri) & (a_ > 0)
        M |= m
        V = np.maximum(V, np.where(m, 1 - np.abs(p_) / 4.5, 0))
    gap = (np.abs(np.abs(dx) - np.abs(dy)) < 0.9) & (np.hypot(dx, dy) > 1.6)
    M &= ~gap
    return M, V

# ---------------------------------------------------------------- Das Glücksrad (Relief)
Hw = np.zeros((H, W), np.float32); Mw = np.zeros((H, W), bool); Matw = np.zeros((H, W), np.int32)
dW = np.hypot(xx - WCX, yy - WCY)
ang = np.arctan2(yy - WCY, xx - WCX)
# Außenring
ring = (dW <= WR) & (dW >= WR - 11)
Mw |= ring
Hw = np.where(ring, 2.2 - np.abs(dW - (WR - 5.5)) * 0.35, Hw)
# Randwülste
Hw = np.where(ring & ((dW > WR - 1.5) | (dW < WR - 9.5)), Hw + 0.8, Hw)
# Innenfläche (Emaille, grün)
face_ = dW < WR - 11
Mw |= face_
Matw[face_] = 1
Hw = np.where(face_, 0.3 + np.sqrt(np.maximum(0, 1 - (dW / (WR - 11)) ** 2)) * 0.6, Hw)
# 8 Speichen
spoke = np.zeros((H, W), bool)
for k in range(8):
    a = k * math.pi / 4
    ux, uy = math.cos(a), math.sin(a)
    along = (xx - WCX) * ux + (yy - WCY) * uy
    across = np.abs(-(xx - WCX) * uy + (yy - WCY) * ux)
    wsp = 2.6 - along * 0.012
    m = (along > 0) & (along < WR - 10) & (across < wsp)
    spoke |= m
    Hw = np.where(m, 1.6 - across * 0.4, Hw)
Matw[spoke] = 0
# innerer Ring + Nabe
iring = (dW <= 24) & (dW >= 19)
Matw[iring] = 0
Hw = np.where(iring, 1.8 - np.abs(dW - 21.5) * 0.5, Hw)
hub = dW < 12
Matw[hub] = 0
Hw = np.where(hub, 1.2 + np.sqrt(np.maximum(0, 1 - (dW / 12) ** 2)) * 2.4, Hw)
inner_face = (dW < 19) & (dW >= 12)
Matw[inner_face & ~spoke] = 2
ENAMEL = [(4, 40, 24), (10, 74, 40), (22, 110, 56), (44, 150, 70), (90, 190, 100)]
ENAMEL2 = [(40, 6, 20), (90, 14, 34), (150, 30, 50), (200, 60, 70), (240, 120, 120)]
relief(cv, Hw, Matw, [GOLD7, ENAMEL, ENAMEL2], Mw, k=1.3, bias=0.05)
# dunkle Kontur des Rads
edge = (dW > WR) & (dW <= WR + 1.2)
for y, x in zip(*np.where(edge)):
    px(cv, x, y, (90, 44, 10))
# Nieten auf dem Außenring
for k in range(24):
    a = k * math.pi / 12 + math.pi / 24
    x = WCX + math.cos(a) * (WR - 5.5); y = WCY + math.sin(a) * (WR - 5.5)
    if k % 3 == 1:
        continue
    px(cv, x, y, GOLD7[6]); px(cv, x + 1, y + 1, GOLD7[1])
# Buchstaben T A R O (eingraviert) auf dem Ring bei 45°-Positionen
LET = {
    'T': ["#####", "#####", "..#..", "..#..", "..#..", "..#..", "..#.."],
    'A': [".###.", "##.##", "#...#", "#####", "#...#", "#...#", "#...#"],
    'R': ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    'O': [".###.", "##.##", "#...#", "#...#", "#...#", "##.##", ".###."],
}
for ch, a in zip("TARO", (-45, 45, 135, 225)):
    cx_ = WCX + math.cos(math.radians(a)) * (WR - 5.5)
    cy_ = WCY + math.sin(math.radians(a)) * (WR - 5.5)
    G = LET[ch]
    x0, y0 = int(round(cx_ - 2)), int(round(cy_ - 3))
    for j, r in enumerate(G):             # Lichtkante unten rechts (Gravur)
        for i, c_ in enumerate(r):
            if c_ == '#':
                px(cv, x0 + i + 1, y0 + j + 1, GOLD7[6])
    for j, r in enumerate(G):
        for i, c_ in enumerate(r):
            if c_ == '#':
                px(cv, x0 + i, y0 + j, (70, 30, 6))
# Glückssymbole zwischen den Speichen (auf grüner Emaille)
CLOVER9 = ["..ab.ab..", "..abbbb..", "aa.bbb.aa", "abbb.bbbb", ".bbbObbb.", "abbb.bbbc", "ab.bbb.cc", "..bbbcc..", "..bc.cc.."]
def clover(cx_, cy_):
    M_ = np.zeros((H, W), bool)
    cols = {'a': (170, 250, 150), 'b': (90, 200, 80), 'c': (40, 130, 50), 'O': (20, 80, 30)}
    for j, r in enumerate(CLOVER9):
        for i, ch in enumerate(r):
            if ch in cols:
                M_[cy_ - 4 + j, cx_ - 4 + i] = True
    ring = cv2.dilate(M_.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~M_
    for y, x in zip(*np.where(ring)):
        px(cv, x, y, (4, 40, 20))
    for j, r in enumerate(CLOVER9):
        for i, ch in enumerate(r):
            if ch in cols:
                px(cv, cx_ - 4 + i, cy_ - 4 + j, cols[ch])
    px(cv, cx_ + 5, cy_ + 5, (4, 40, 20)); px(cv, cx_ + 6, cy_ + 6, (4, 40, 20))
def coin(cx_, cy_, r=4.6):
    big_coin(cx_, cy_, r, 1.0)
def horseshoe(cx_, cy_, c=SILVER):
    for t_ in np.linspace(math.radians(-25), math.radians(205), 60):
        for rr in (3.4, 4.4, 5.4):
            x = cx_ + math.cos(t_) * rr; y = cy_ + 1 - math.sin(t_) * rr
            px(cv, x, y, OUT if rr > 5 else (c[5] if math.sin(t_) > 0.2 else c[3]))
    for t_ in np.linspace(math.radians(-25), math.radians(205), 6)[1:-1]:
        px(cv, cx_ + math.cos(t_) * 4.4, cy_ + 1 - math.sin(t_) * 4.4, c[1])
def star5(cx_, cy_, c=(255, 250, 200), d=(230, 180, 60)):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = 5.5 if k % 2 == 0 else 2.3
        pts.append((cx_ + math.cos(a) * r, cy_ + math.sin(a) * r))
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
    ring = cv2.dilate(m, np.ones((3, 3), np.uint8)) - m
    for y, x in zip(*np.where(ring > 0)):
        px(cv, x, y, (80, 40, 10))
    for y, x in zip(*np.where(m > 0)):
        px(cv, x, y, c if (y - cy_) < 0.5 and (x - cx_) < 1 else d)
SYMS = [clover, coin, horseshoe, star5]
for k in range(8):
    a = k * math.pi / 4 + math.pi / 8
    x = int(round(WCX + math.cos(a) * 37)); y = int(round(WCY + math.sin(a) * 37))
    SYMS[k % 4](x, y)
# Edelstein in der Nabe
for y in range(WCY - 5, WCY + 6):
    for x in range(WCX - 5, WCX + 6):
        d = math.hypot(x - WCX, y - WCY)
        if d <= 4.5:
            px(cv, x, y, rampc(EMER, 0.75 - (y - WCY) * 0.08 - (x - WCX) * 0.05 - d * 0.06, x, y))
px(cv, WCX - 2, WCY - 2, (255, 255, 255)); px(cv, WCX - 1, WCY - 2, (220, 255, 230))
sparkle(cv, WCX - 2, WCY - 2, (255, 255, 255), r=3, c2=(160, 255, 200))

# ---------------------------------------------------------------- Münzstrom links (abwärts) und Goldsack rechts (aufwärts)
for i, (x, y, r, sq) in enumerate([(62, 166, 5, 0.9), (52, 184, 5, 0.4), (46, 204, 5.5, 1.0), (40, 224, 5, 0.6), (38, 246, 5.5, 0.2),
                                   (42, 266, 5, 0.85), (70, 188, 3.5, 0.7), (58, 232, 3.5, 0.5), (30, 196, 3.5, 1.0), (54, 256, 3.5, 0.9)]):
    big_coin(x, y, r, sq)
# Bewegungslinien der fallenden Münzen
for (x, y) in [(64, 156), (54, 174), (48, 194), (42, 214), (40, 236)]:
    for k in range(3):
        blend_px(cv, x + 3, y - 3 - k * 2, (255, 255, 255), 0.6)
# Goldsack (wie auf Willys Karte) klettert rechts am Rad hinauf
SACK = [(60, 34, 16), (104, 64, 30), (150, 100, 52), (190, 140, 84), (222, 180, 120)]
g = Fig(W, H)
g.part('sack'); g.ellipse(200, 192, 15, 14, 's'); g.poly([(190, 184), (210, 184), (206, 176), (194, 176)], 's')
g.part('neck'); g.rect(195, 172, 205, 178, 's')
g.part('tuft'); g.poly([(193, 172), (190, 164), (196, 168), (200, 162), (204, 168), (210, 164), (207, 172)], 's')
g.part('rope'); g.rect(193, 175, 207, 177, 'r')
g.outline()
cv.paste(g.render({'s': mat(SACK, pillow=4, k=1.5, bias=0.08, noise=0.5, nscale=2), 'r': mat(GOLD, pillow=1, k=1.2)}), 0, 0)
big_coin(200, 194, 6, 1.0)
for (x, y) in [(214, 206), (218, 196), (212, 214)]:
    for k in range(3):
        blend_px(cv, x + k, y + k * 2, (255, 255, 255), 0.6)

# ---------------------------------------------------------------- Eckwolken mit Glückssymbolen
def corner_cloud(cx_, cy_, seed):
    puffy_cloud(cv, cx_, cy_, 44, 14, [(150, 170, 220), (196, 214, 244), (230, 240, 252), (255, 255, 255)], seed=seed)
corner_cloud(38, 76, 11); corner_cloud(212, 76, 12); corner_cloud(38, 292, 13); corner_cloud(212, 292, 14)
# vierblättriges Kleeblatt (oben links)
CLV = [(10, 60, 20), (26, 110, 34), (50, 160, 50), (100, 210, 90), (170, 250, 150)]
def big_clover(cx_, cy_, sc=1.0):
    M, V = clover_mask(cx_, cy_, sc)
    for y, x in zip(*np.where(M)):
        v = 0.4 + V[y, x] * 0.35 - (y - cy_) * 0.03 - (x - cx_) * 0.025
        px(cv, x, y, rampc(CLV, v, x, y))
    ring = cv2.dilate(M.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~M
    for y, x in zip(*np.where(ring)):
        px(cv, x, y, CLV[0])
    for k in range(7):
        px(cv, cx_ + 2 + k * 0.4, cy_ + 3 + k, CLV[1]); px(cv, cx_ + 3 + k * 0.4, cy_ + 3 + k, CLV[0])
    # Glanz auf je einem Blatt
    for (ox, oy) in ((-2, -5), (3, -3), (-5, 1)):
        px(cv, cx_ + ox * sc, cy_ + oy * sc, CLV[4])
big_clover(36, 62, 1.45)
sparkle(cv, 46, 56, (255, 255, 240), r=2)
# Hufeisen (oben rechts), Öffnung nach oben = Glück bleibt drin
HS = [(40, 42, 60), (90, 96, 120), (150, 156, 180), (200, 206, 224), (240, 244, 252)]
for t_ in np.linspace(math.radians(0), math.radians(180), 80):
    for rr in np.linspace(5.5, 9, 6):
        x = 212 + math.cos(t_) * rr * 0.9; y = 60 + math.sin(t_) * rr
        v = 0.5 + (rr - 7.2) * -0.12 + math.cos(t_) * -0.2
        px(cv, x, y, rampc(HS, v, x, y))
for t_ in np.linspace(math.radians(0), math.radians(180), 5)[1:-1]:
    px(cv, 212 + math.cos(t_) * 7.2 * 0.9, 60 + math.sin(t_) * 7.2, HS[0])
for dx in (-8, 7):
    for yv in range(52, 61):
        px(cv, 212 + dx, yv, HS[3] if dx < 0 else HS[2])
        px(cv, 212 + dx + 1, yv, HS[2] if dx < 0 else HS[1])
sparkle(cv, 222, 54, (255, 255, 255), r=2)
# Würfel (unten links)
def die(cx_, cy_, s_=11):
    for y in range(cy_ - s_ // 2, cy_ + s_ // 2 + 1):
        for x in range(cx_ - s_ // 2, cx_ + s_ // 2 + 1):
            e = min(x - (cx_ - s_ // 2), (cx_ + s_ // 2) - x, y - (cy_ - s_ // 2), (cy_ + s_ // 2) - y)
            if e == 0 and (x in (cx_ - s_ // 2, cx_ + s_ // 2)) and (y in (cy_ - s_ // 2, cy_ + s_ // 2)):
                continue
            c = OUT if e == 0 else rampc(WHITE_CLOTH, 0.75 - (y - cy_) * 0.03 - (x - cx_) * 0.02, x, y)
            px(cv, x, y, c)
    # Seitenfläche (3D)
    for j in range(s_):
        for i in range(3):
            px(cv, cx_ + s_ // 2 + 1 + i, cy_ - s_ // 2 + 1 + j + i - 1, WHITE_CLOTH[1] if i < 2 else OUT)
    for (dx, dy) in ((-3, -3), (0, 0), (3, 3), (-3, 3), (3, -3)):
        px(cv, cx_ + dx, cy_ + dy, (200, 20, 40) if (dx, dy) == (0, 0) else OUT)
die(32, 280, 13)
# Topf mit Gold (unten rechts)
POT = [(10, 10, 16), (26, 26, 36), (48, 48, 62), (76, 76, 96), (120, 120, 140)]
pf = Fig(W, H)
pf.part('pot'); pf.ellipse(214, 284, 13, 10, 'p')
pf.part('rim'); pf.ellipse(214, 275, 14, 3.5, 'p')
pf.part('gold'); pf.ellipse(214, 272, 12, 5, 'g'); pf.ellipse(210, 268, 5, 3, 'g'); pf.ellipse(218, 269, 4, 3, 'g')
pf.part('leg'); pf.rect(204, 292, 207, 296, 'p'); pf.rect(221, 292, 224, 296, 'p')
pf.outline()
cv.paste(pf.render({'p': mat(POT, pillow=4, k=1.6, spec=True, spec_col=(170, 170, 190)), 'g': mat(GOLD7, pillow=2, k=1.8, noise=1.5, nscale=1, spec=True)}), 0, 0)
for (x, y) in [(208, 270), (214, 267), (220, 271), (212, 273)]:
    px(cv, x, y, (255, 255, 230))
sparkle(cv, 222, 262, (255, 255, 240), r=3, c2=(255, 200, 80))

# ---------------------------------------------------------------- Willy thront oben auf dem Rad
HATG = [(6, 40, 14), (14, 76, 24), (28, 120, 34), (56, 168, 48), (110, 214, 80), (170, 240, 130)]
SUIT = [(8, 44, 16), (18, 84, 28), (34, 128, 40), (64, 170, 56), (120, 210, 90)]
LAPEL = [(20, 90, 30), (44, 140, 44), (80, 190, 64), (140, 230, 110)]
HAIRW = [(90, 26, 6), (150, 50, 10), (210, 86, 22), (244, 128, 40), (255, 176, 90)]
BELT = [(30, 16, 8), (64, 36, 16), (104, 62, 30), (140, 92, 48)]
SHOE = [(26, 14, 8), (56, 32, 16), (92, 56, 28), (130, 86, 48), (170, 122, 76)]
SHIRT = WHITE_CLOTH
HX, HY = 125, 100
f = Fig(W, H)
# ---- Beine hängen vorne über den Radkranz
f.part('thighL'); f.ellipse(114, 156, 8, 6, 'u')
f.part('thighR'); f.ellipse(136, 156, 8, 6, 'u')
f.part('shinL'); f.limb(113, 158, 109, 178, 6.5, 5.5, 'u')
f.part('shinR'); f.limb(137, 158, 142, 176, 6.5, 5.5, 'u')
f.part('sockL'); f.limb(109, 176, 108, 180, 5, 5, 'w')
f.part('sockR'); f.limb(142, 174, 143, 178, 5, 5, 'w')
f.part('shoeL'); f.poly([(101, 179), (114, 179), (114, 187), (98, 187), (94, 184), (92, 180), (97, 181)], 'b')
f.part('shoeR'); f.poly([(136, 177), (149, 177), (153, 179), (158, 178), (156, 182), (152, 185), (136, 185)], 'b')
# ---- Rumpf
f.part('body'); f.poly([(106, 118), (144, 118), (146, 152), (104, 152)], 'u')
f.part('shirt'); f.poly([(118, 118), (132, 118), (125, 136)], 'w')
f.part('lapels', line=False)
f.poly([(112, 118), (118, 118), (125, 136), (121, 142), (112, 124)], 'l')
f.poly([(138, 118), (132, 118), (125, 136), (129, 142), (138, 124)], 'l')
f.part('belt'); f.rect(104, 142, 146, 148, 'e')
f.part('buckle'); f.rect(120, 140, 130, 150, 'g')
# ---- linker Arm: Hand greift den Radkranz
f.part('armL'); f.limb(106, 124, 96, 140, 6.5, 6, 'u')
f.part('foreL'); f.limb(96, 140, 100, 152, 6, 5.5, 'u')
f.part('cuffL'); f.limb(100, 151, 101, 154, 5.5, 5.5, 'w')
f.part('handL'); f.ellipse(102, 158, 5, 4.5, 's')
# ---- Kopf
f.part('neck'); f.rect(119, 112, 131, 120, 's')
f.part('hairB'); f.poly([(HX - 21, HY - 16), (HX + 21, HY - 16), (HX + 22, HY + 4), (HX + 16, HY + 10), (HX - 16, HY + 10), (HX - 22, HY + 4)], 'h')
f.part('ears')
f.poly([(HX - 17, HY - 1), (HX - 27, HY - 7), (HX - 21, HY + 6)], 's')
f.poly([(HX + 17, HY - 1), (HX + 27, HY - 7), (HX + 21, HY + 6)], 's')
f.part('face'); f.ellipse(HX, HY, 18, 16, 's')
f.part('beard')
f.poly([(HX - 18, HY - 4), (HX - 13, HY - 4), (HX - 12, HY + 6), (HX - 6, HY + 13), (HX + 6, HY + 13), (HX + 12, HY + 6), (HX + 13, HY - 4),
        (HX + 18, HY - 4), (HX + 17, HY + 8), (HX + 11, HY + 17), (HX, HY + 21), (HX - 11, HY + 17), (HX - 17, HY + 8)], 'h')
f.part('mouth'); f.poly([(HX - 8, HY + 6), (HX + 8, HY + 6), (HX + 6, HY + 12), (HX - 6, HY + 12)], 'M')
f.part('bangs'); f.poly([(HX - 18, HY - 7), (HX - 16, HY - 15), (HX + 16, HY - 15), (HX + 18, HY - 7), (HX + 12, HY - 11), (HX + 7, HY - 7),
                        (HX + 2, HY - 11), (HX - 3, HY - 7), (HX - 8, HY - 11), (HX - 12, HY - 7)], 'h')
# ---- Zylinder, keck schräg
f.part('hat')
f.poly([(HX - 16, HY - 18), (HX + 17, HY - 18), (HX + 20, HY - 52), (HX - 12, HY - 54)], 'H')
f.ellipse(HX + 4, HY - 53, 16, 4, 'H')
f.part('band'); f.poly([(HX - 16, HY - 29), (HX + 18, HY - 29), (HX + 17, HY - 20), (HX - 16, HY - 20)], 'e')
f.part('hbuckle'); f.rect(HX - 6, HY - 31, HX + 6, HY - 19, 'g')
f.part('hbhole'); f.rect(HX - 3, HY - 28, HX + 3, HY - 22, 'e')
f.part('brim'); f.ellipse(HX, HY - 17, 29, 5.5, 'H')
# ---- rechter Arm: reckt die Goldmünze empor
f.part('armR'); f.limb(144, 124, 156, 112, 6.5, 6, 'u')
f.part('foreR'); f.limb(156, 112, 160, 96, 6, 5.5, 'u')
f.part('cuffR'); f.limb(160, 97, 160, 94, 5.5, 5.5, 'w')
f.part('handR'); f.ellipse(161, 89, 5, 5, 's')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.08),
    'h': mat(HAIRW, pillow=3, k=1.7, noise=0.9, nscale=2, bias=0.05),
    'H': mat(HATG, pillow=4, k=1.6, bias=0.05, spec=True, spec_col=(200, 255, 170)),
    'u': mat(SUIT, pillow=4, k=1.4, folds=(0.2, 0.1, 0.4), bias=0.06),
    'l': mat(LAPEL, pillow=2, k=1.4, bias=0.05),
    'w': mat(SHIRT, pillow=2, k=1.3),
    'e': mat(BELT, pillow=1.5, k=1.3),
    'g': mat(GOLD7, pillow=1.5, k=1.8, spec=True, spec_col=(255, 255, 230)),
    'b': mat(SHOE, pillow=2.5, k=1.6, spec=True, spec_col=(220, 180, 130)),
    'M': mat([(60, 10, 16), (120, 30, 40), (190, 70, 70)], pillow=1, k=1),
}
glow(cv, 125, 120, 60, (255, 250, 200), k=0.35, mix=0.25)
fig = f.render(MATS)
cv.paste(fig, 0, 0)
# ---- Gesicht
EYE_W = (40, 120, 50)
anime_eye(cv, HX - 11, HY - 5, EYE_W, h=7, w=5)
anime_eye(cv, HX + 6, HY - 5, EYE_W, h=7, w=5, flip=True)
for i in range(6):                                   # hochgezogene Brauen
    px(cv, HX - 12 + i, HY - 8 - (1 if 1 <= i <= 3 else 0), HAIRW[0])
    px(cv, HX + 6 + i, HY - 8 - (1 if 2 <= i <= 4 else 0), HAIRW[0])
px(cv, HX, HY + 2, SKIN[2]); px(cv, HX + 1, HY + 3, SKIN[1]); px(cv, HX - 1, HY + 3, SKIN[2])   # Knubbelnase
for x in range(HX - 6, HX + 7):                      # breites Grinsen: Zähne oben, Zunge unten
    px(cv, x, HY + 7, (250, 250, 244) if x not in (HX - 6, HX + 6) else (210, 200, 196))
    if abs(x - HX) < 4:
        px(cv, x, HY + 10, (230, 100, 100))
px(cv, HX, HY + 7, (220, 214, 210))
blush(cv, HX - 15, HY + 3); blush(cv, HX + 12, HY + 3)
for (x, y) in [(HX - 10, HY + 2), (HX - 8, HY + 3), (HX + 9, HY + 2), (HX + 11, HY + 3)]:   # Sommersprossen
    px(cv, x, y, SKIN[2])
# Schnallen auf den Schuhen
for (x, y) in [(103, 180), (143, 178)]:
    for (dx, dy) in ((0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2)):
        px(cv, x + dx, y + dy, GOLD7[5] if dy == 0 else GOLD7[3])
# Jackenknöpfe
for y in (126, 134):
    px(cv, 122, y, GOLD7[5]); px(cv, 122, y + 1, GOLD7[2])
# Kleeblatt am Hut
clover(HX + 10, HY - 41)
# ---- die hochgereckte Münze
big_coin(162, 80, 8, 1.0)
M_, V_ = clover_mask(162, 80, 0.55)
for y, x in zip(*np.where(M_)):
    px(cv, x, y, GOLD7[2] if (x + y) % 2 else GOLD7[1])
for (dx, dy) in ((-4, 6), (-2, 7), (0, 7)):             # Finger vor der Münze
    px(cv, 162 + dx, 80 + dy, SKIN[3]); px(cv, 162 + dx, 80 + dy + 1, SKIN[1])
sparkle(cv, 156, 73, (255, 255, 255), r=4, c2=(255, 220, 110))
sparkle(cv, 171, 86, (255, 255, 240), r=2, c2=(255, 210, 90))

# ---------------------------------------------------------------- Goldregen
for _ in range(46):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(AY0 + 2, 250)
    if fig[y, x, 3] or math.hypot(x - WCX, y - WCY) < WR + 3:
        continue
    if rnd.random() < 0.55:
        c = rnd.choice([GOLD7[5], GOLD7[4], (255, 255, 230)])
        px(cv, x, y, c); px(cv, x, y + 1, GOLD7[2])
        if rnd.random() < 0.5:
            blend_px(cv, x, y - 1, (255, 255, 255), 0.5); blend_px(cv, x, y - 2, (255, 255, 255), 0.3)
    else:
        sparkle(cv, x, y, (255, 250, 210), r=rnd.choice([1, 1, 2]), c2=(255, 200, 80))

finish(cv, 'X', 'WILLY', out='10_wheel_of_fortune_willy', emblem=emblem_generic(
    ["..ab.ab..", "..abbbb..", "aa.bbb.aa", "abbb.bbbb", ".bbbObbb.", "abbb.bbbc", "ab.bbb.cc", "..bbbcc..", "..bc.cc.."],
    {'a': (170, 250, 150), 'b': (90, 200, 80), 'c': (40, 130, 50), 'O': (20, 80, 30)}))
print('ok')
