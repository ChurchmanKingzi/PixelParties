# -*- coding: utf-8 -*-
# I – Der Magier: Archibald, the Archmage
# Archibald reckt den Zauberstab gen Himmel und zeigt mit der anderen Hand zur Erde („wie oben, so unten“).
# Über ihm schwebt die liegende Acht, hinter ihm leuchtet ein großes Rosettenfenster aus Buntglas
# (Anspielung auf die Buntglas-Illustration seiner Karte). Auf dem Tisch: Kelch, Schwert, Münze und Stab;
# oben Rosenranken, unten Lilien.
from tarot_fmhe_helpers import *

cv = new_card()
rnd = random.Random(7)
# ---------------------------------------------------------------- Steinwand (Kapelle)
WALL = [(18, 12, 30), (32, 24, 50), (50, 40, 72), (72, 60, 96), (98, 86, 122), (130, 118, 150)]
Hw = np.zeros((H, W), np.float32); Mw = art_mask()
for y in range(AY0, AY1):
    row = (y - AY0) // 10
    off = 0 if row % 2 == 0 else 9
    for x in range(AX0, AX1):
        by = (y - AY0) % 10; bx = (x + off) % 18
        e = min(by, 9 - by, bx, 17 - bx)
        Hw[y, x] = min(e, 2.5) * 0.7
Hw += (noise(H, W, 3, seed=5) - 0.5) * 1.0
relief(cv, Hw, np.zeros((H, W), np.int32), [WALL], Mw, k=1.3, bias=-0.1)

# ---------------------------------------------------------------- Rosettenfenster aus Buntglas
WX, WY, WR = 125, 116, 82
GLASS = [
    [(40, 20, 90), (70, 40, 160), (110, 70, 220), (160, 120, 250), (210, 180, 255)],     # violett
    [(10, 30, 90), (20, 70, 170), (50, 120, 230), (110, 180, 255), (190, 230, 255)],     # blau
    [(80, 10, 30), (150, 20, 50), (210, 50, 70), (250, 110, 110), (255, 180, 170)],      # rot
    [(90, 60, 10), (170, 120, 20), (230, 180, 50), (255, 220, 110), (255, 246, 190)],    # gold
    [(10, 60, 40), (20, 110, 70), (50, 170, 110), (120, 220, 160), (200, 250, 220)],     # grün
]
LEAD = (22, 14, 32)
yy, xx = np.indices((H, W))
dist = np.hypot(xx - WX, yy - WY)
ang = (np.arctan2(yy - WY, xx - WX) + math.pi) / (2 * math.pi)       # 0..1
gn = noise(H, W, 2, seed=9)
Mwin = (dist <= WR) & art_mask()
# Steinrahmen (Maßwerk) um das Fenster
Mst = (dist > WR) & (dist <= WR + 7) & art_mask()
Hs = np.where(Mst, 2.5 - np.abs(dist - WR - 3.5) * 0.7, 0).astype(np.float32)
STONE2 = [(40, 30, 56), (70, 60, 90), (104, 94, 126), (140, 130, 160), (176, 168, 194), (214, 208, 226)]
relief(cv, Hs, np.zeros((H, W), np.int32), [STONE2], Mst, k=1.6, bias=0.05)
for y, x in zip(*np.where(Mwin)):
    d = dist[y, x]; a = ang[y, x]
    lead = False
    if d < 14:
        ramp = GLASS[3]; v = 0.95 - d / 30
        if abs(d - 7) < 0.6:
            lead = True
    elif d < 44:
        # zwölf Blütenblätter (Lanzettbögen)
        k = a * 12; seg = int(k) % 12; fk = k - int(k)
        petal_r = 44 - 10 * (1 - math.sin(math.pi * fk)) ** 2
        ramp = GLASS[[0, 1, 2, 1][seg % 4]] if d < petal_r else GLASS[4]
        v = 0.85 - (d - 14) / 60 + (gn[y, x] - 0.5) * 0.5
        if abs(d - 14) < 0.7 or abs(d - petal_r) < 0.7 or fk < 0.03 or fk > 0.97:
            lead = True
        if d < petal_r and abs(fk - 0.5) < 0.04 and d > 20:
            lead = True
    elif d < 70:
        k = a * 24; seg = int(k) % 24; fk = k - int(k)
        ramp = GLASS[[1, 0, 3, 0, 1, 2][seg % 6]]
        v = 0.7 - (d - 44) / 70 + (gn[y, x] - 0.5) * 0.5
        # Kreise in jeder Scheibe
        cxl = (fk - 0.5) * 2 * math.pi * d / 24; cyl = d - 57
        if abs(math.hypot(cxl, cyl) - 4.5) < 0.6:
            lead = True
        if math.hypot(cxl, cyl) < 4.5:
            ramp = GLASS[3] if seg % 2 else GLASS[2]
            v += 0.15
        if abs(d - 44) < 0.7 or fk < 0.02 or fk > 0.98:
            lead = True
    else:
        k = a * 48; fk = k - int(k)
        ramp = GLASS[[2, 1][int(k) % 2]]
        v = 0.5 - (d - 70) / 40 + (gn[y, x] - 0.5) * 0.5
        if abs(d - 70) < 0.7 or fk < 0.04 or fk > 0.96:
            lead = True
    if abs(d - WR) < 1.0:
        lead = True
    px(cv, x, y, LEAD if lead else rampc(ramp, v, x, y))
# Glasschimmer (helle Pünktchen)
for _ in range(160):
    x = rnd.randint(WX - WR, WX + WR); y = rnd.randint(WY - WR, WY + WR)
    if in_art(x, y) and Mwin[y, x] and tuple(cv.a[y, x]) != LEAD:
        blend_px(cv, x, y, (255, 255, 255), 0.45)
# zum Rand hin dunkler (Figur hebt sich besser ab), Mitte warm leuchtend
for y, x in zip(*np.where(Mwin)):
    t = (dist[y, x] - 40) / (WR - 40)
    if t > 0 and BAYER4[y % 4, x % 4] < t * 0.9:
        blend_px(cv, x, y, (20, 10, 40), 0.35)
glow(cv, WX, WY + 6, 56, (255, 226, 160), k=0.6, mix=0.3)
# Säulen links und rechts
PIL_ = [(30, 22, 44), (58, 48, 78), (90, 80, 112), (126, 116, 148), (166, 158, 186), (206, 200, 222)]
for (x0, x1) in [(AX0, 34), (216, AX1)]:
    Mp = np.zeros((H, W), bool); Mp[AY0:AY1, x0:x1] = True
    cxp = (x0 + x1) / 2
    Hp = np.zeros((H, W), np.float32)
    for x in range(x0, x1):
        Hp[:, x] = math.sqrt(max(0, 1 - ((x - cxp) / ((x1 - x0) / 2 + 0.5)) ** 2)) * 4 + (1.0 if (x - x0) % 5 == 2 else 0)
    relief(cv, Hp, np.zeros((H, W), np.int32), [PIL_], Mp, k=1.4, bias=0.02)
    for x in range(x0, x1):
        px(cv, x, AY0 + 22, PIL_[0]); px(cv, x, AY0 + 23, PIL_[4])
    outline_mask(cv, Mp, (14, 8, 22))
# Lichtstrahlen aus dem Fenster (schräg nach unten)
for i, sx0 in enumerate([70, 104, 140, 176]):
    for y in range(120, 250):
        for w_ in range(9):
            x = int(sx0 + (y - 120) * 0.35 + w_)
            if in_art(x, y) and BAYER4[y % 4, x % 4] < 0.22 * (1 - (y - 120) / 130):
                blend_px(cv, x, y, (255, 236, 200), 0.35)

# ---------------------------------------------------------------- liegende Acht (Lemniskate)
LX, LY, LA = 125, 58, 19
glow(cv, LX, LY, 30, (255, 236, 160), k=0.6, rx=0.7, ry=1.4, mix=0.45)

# ---------------------------------------------------------------- Farben
ROBE = [(26, 8, 46), (50, 18, 90), (80, 34, 140), (114, 58, 190), (154, 100, 226), (196, 156, 248)]
HAT = [(24, 8, 44), (46, 16, 86), (76, 30, 136), (110, 52, 186), (150, 92, 224), (190, 150, 246)]
BEARD = [(110, 110, 140), (160, 162, 186), (204, 206, 224), (234, 236, 246), (250, 250, 255), (255, 255, 255)]
WOOD = [(40, 20, 10), (78, 44, 20), (120, 74, 36), (166, 112, 60), (204, 156, 96)]
CLOTH = [(34, 6, 24), (66, 12, 40), (104, 22, 56), (146, 36, 70), (190, 64, 90)]
LEAF = [(10, 40, 20), (20, 76, 32), (40, 116, 44), (76, 160, 62), (130, 200, 96)]

f = Fig(W, H)
# ---- Haare hinter dem Kopf (weiß, lang)
f.part('hairB')
f.poly([(101, 128), (149, 128), (154, 150), (152, 176), (98, 176), (96, 150)], 'B')
# ---- Robe
f.part('robe')
f.poly([(98, 164), (152, 164), (164, 204), (172, 252), (78, 252), (86, 204)], 'r')
f.part('under')         # offene Robe: dunkles Untergewand mit Goldsaum
f.poly([(119, 200), (131, 200), (140, 252), (110, 252)], 'u')
f.part('trimL'); f.line(119, 200, 110, 252, 'g', w=2)
f.part('trimR'); f.line(131, 200, 140, 252, 'g', w=2)
# ---- gesenkter Arm (zeigt nach unten zur Erde)
f.part('handR')
HX, HY = 180, 218
f.poly([(HX - 5, HY - 3), (HX + 4, HY - 3), (HX + 6, HY + 4), (HX + 4, HY + 9), (HX + 4, HY + 20), (HX + 2, HY + 22), (HX, HY + 20),
        (HX, HY + 10), (HX - 4, HY + 8), (HX - 6, HY + 2)], 's')
f.part('slvR'); f.poly([(142, 166), (156, 168), (170, 180), (182, 196), (190, 210), (172, 218), (164, 204), (154, 194), (144, 188)], 'r')
f.part('cuffR'); f.poly([(170, 214), (189, 206), (192, 212), (173, 220)], 'g')
# ---- erhobener Arm mit Zauberstab
f.part('wand'); f.limb(80, 146, 80, 70, 2.2, 1.8, 'w')
f.part('wtip'); f.ellipse(80, 68, 3, 3, 'm')
f.part('slvL'); f.poly([(106, 166), (92, 158), (80, 146), (70, 150), (68, 170), (80, 186), (98, 184)], 'r')
f.part('cuffL'); f.poly([(68, 150), (82, 144), (86, 150), (72, 158)], 'g')
f.part('foreL'); f.limb(79, 146, 80, 130, 4.5, 4, 's')
f.part('handL'); f.ellipse(80, 128, 5, 5, 's')
f.part('wand2'); f.limb(80, 133, 80, 122, 2.2, 2.2, 'w')
# ---- Kopf
f.part('face')
f.ellipse(125, 142, 15, 14, 's')
f.part('ears'); f.ellipse(109, 143, 2.5, 4, 's'); f.ellipse(141, 143, 2.5, 4, 's')
f.part('beard')
f.poly([(108, 146), (142, 146), (148, 160), (146, 180), (138, 198), (130, 212), (125, 216), (120, 212), (112, 198), (104, 180), (102, 160)], 'B')
f.part('mustL'); f.poly([(125, 149), (118, 148), (110, 152), (106, 158), (114, 157), (120, 155), (125, 155)], 'B')
f.part('mustR'); f.poly([(125, 149), (132, 148), (140, 152), (144, 158), (136, 157), (130, 155), (125, 155)], 'B')
f.part('nose'); f.ellipse(125, 146, 3, 3.5, 's')
f.part('browL'); f.poly([(108, 133), (122, 134), (122, 138), (114, 139), (106, 141)], 'B')
f.part('browR'); f.poly([(142, 133), (128, 134), (128, 138), (136, 139), (144, 141)], 'B')
# ---- Hut mit hängender Spitze
f.part('hat')
f.poly([(104, 127), (112, 106), (119, 90), (126, 80), (134, 74), (146, 73), (156, 78), (163, 88), (164, 96),
        (156, 90), (146, 84), (140, 86), (138, 96), (141, 110), (147, 127)], 'h')
f.part('band'); f.poly([(105, 120), (145, 120), (147, 127), (104, 127)], 'g')
f.part('brim'); f.ellipse(125, 129, 31, 6, 'h')
f.part('tassel'); f.ellipse(164, 98, 3, 3, 'g')
# ---- Lemniskate
f.part('inf')
pts = []
for t in np.linspace(0, 2 * math.pi, 120):
    den = 1 + math.sin(t) ** 2
    pts.append((LX + LA * math.cos(t) / den, LY + LA * math.sin(t) * math.cos(t) / den * 1.2))
f.curve(pts, 'g', w=4)
f.outline()

MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.08),
    'B': mat(BEARD, pillow=3, k=1.7, noise=1.0, nscale=2, bias=0.02),
    'r': mat(ROBE, pillow=5, k=1.5, folds=(0.35, 0.02, 0.9), bias=0.02),
    'h': mat(HAT, pillow=5, k=1.6, folds=(0.2, 0.1, 0.5), bias=0.05),
    'g': mat(GOLD, pillow=1.5, k=1.6, spec=True, spec_col=(255, 255, 230), bias=0.05),
    'L': mat(WOOD, pillow=1.5, k=1.2),
    'w': mat(WOOD, pillow=1.2, k=1.2, bias=0.1),
    'm': mat(AMETH, pillow=2, k=1.2, bias=0.3),
    'u': mat([(10, 8, 30), (20, 18, 56), (34, 32, 90), (54, 52, 124)], pillow=3, k=1.3, folds=(0.4, 0.0, 0.5)),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)
def inside(x, y):
    return fig[int(y), int(x), 3] > 0 and tuple(cv.a[int(y), int(x)]) != OUT

# ---------------------------------------------------------------- Details Archibald
# Augen unter den buschigen Brauen: freundlich, mit Glanz
for (ex, fl) in [(114, False), (130, True)]:
    for i in range(6):
        px(cv, ex + i, 140, OUT)
    for i in range(1, 5):
        px(cv, ex + i, 141, (40, 90, 170)); px(cv, ex + i, 142, (70, 140, 220) if i in (2, 3) else (40, 90, 170))
    px(cv, ex + (3 if fl else 2), 141, (255, 255, 255))
    px(cv, ex, 141, SKIN[1]); px(cv, ex + 5, 141, SKIN[1])
blush(cv, 113, 146); blush(cv, 134, 146)
# Mund im Bart (wie auf der Karte: rot)
for x in range(121, 130):
    px(cv, x, 158, (110, 20, 30))
for x in range(122, 129):
    px(cv, x, 159, (180, 40, 50))
# Bartsträhnen
for (bx, by, L, d) in [(112, 164, 20, 0.35), (118, 168, 30, 0.2), (125, 166, 40, 0.0), (132, 168, 30, -0.2), (138, 164, 20, -0.35)]:
    for k in range(L):
        x = bx + k * d * 0.5; y = by + k
        if inside(x, y) and k % 7 < 5:
            px(cv, x, y, BEARD[1])
# Sterne auf Hut und Robe
for (x, y) in [(116, 110), (128, 96), (136, 80), (152, 82), (134, 112), (112, 124), (138, 124)]:
    if inside(x, y) and tuple(cv.a[y, x]) not in set(tuple(c) for c in GOLD):
        sparkle(cv, x, y, (255, 236, 120), r=1, c2=(240, 190, 60)); px(cv, x, y, (255, 255, 220))
GOLDSET = set(tuple(c) for c in GOLD)
for (x, y) in [(94, 196), (100, 232), (152, 230), (150, 196), (90, 244), (160, 246), (86, 176), (76, 166),
               (158, 188), (98, 212), (146, 212), (104, 180), (126, 236), (156, 178)]:
    if inside(x, y) and tuple(cv.a[y, x]) not in GOLDSET:
        sparkle(cv, x, y, (255, 236, 120), r=1, c2=(240, 190, 60))
        px(cv, x, y, (255, 255, 220))
# Knöchel/Finger der zeigenden Hand
px(cv, 181, 222, SKIN[1]); px(cv, 178, 223, SKIN[1]); px(cv, 183, 228, SKIN[4]); px(cv, 181, 238, SKIN[4])
# Finger an der Hand mit dem Stab
for (fx, fy) in [(84, 125), (84, 128), (84, 131)]:
    px(cv, fx, fy, SKIN[1])
# Kristallstern an der Stabspitze
glow(cv, 80, 68, 16, (220, 170, 255), k=0.7, mix=0.5)
sparkle(cv, 80, 68, (255, 255, 255), r=6, c2=(200, 140, 255))
for k in (1, 2):
    px(cv, 80 + k, 68 + k, (230, 200, 255)); px(cv, 80 - k, 68 - k, (230, 200, 255))
    px(cv, 80 + k, 68 - k, (230, 200, 255)); px(cv, 80 - k, 68 + k, (230, 200, 255))
# Funkenspur der Magie, spiralt um den Stab
for t in np.linspace(0, 5 * math.pi, 70):
    x = 80 + math.cos(t) * (4 + t * 1.4); y = 72 + t * 3.2 - 10
    if in_art(x, y) and not inside(x, y) and int(t * 10) % 3 == 0:
        px(cv, x, y, (230, 200, 255) if int(t * 10) % 2 else (255, 240, 170))
# Lemniskate-Glanz
sparkle(cv, LX - 12, LY - 3, (255, 255, 240), r=2)
sparkle(cv, LX + 13, LY + 3, (255, 255, 240), r=1)

# ---------------------------------------------------------------- Tisch mit Tuch
TY = 244
Mt = poly_mask([(22, TY), (228, TY), (234, TY + 10), (16, TY + 10)])
Ht = np.zeros((H, W), np.float32) + (noise(H, W, 2, seed=3) - 0.5) * 0.6
for x in range(AX0, AX1):
    Ht[:, x] += math.sin(x * 0.9) * 0.15
relief(cv, Ht, np.zeros((H, W), np.int32), [WOOD], Mt, k=1.5, bias=0.15)
# Tischtuch vorne mit Falten
Mc = np.zeros((H, W), bool)
for x in range(AX0, AX1):
    for y in range(TY + 10, AY1):
        Mc[y, x] = True
Hc = np.zeros((H, W), np.float32)
for y in range(TY + 10, AY1):
    for x in range(AX0, AX1):
        Hc[y, x] = math.sin(x * 0.2 + math.sin(y * 0.06) * 1.5) * 1.0 * min(1, (y - TY - 8) / 14)
relief(cv, Hc, np.zeros((H, W), np.int32), [CLOTH], Mc, k=1.4, bias=-0.1)
# Goldborte + Fransen
for x in range(AX0, AX1):
    for y in (TY + 10, TY + 11, TY + 12):
        px(cv, x, y, GOLD[3] if y == TY + 11 else GOLD[1])
    if x % 6 == 0:
        px(cv, x, TY + 12, GOLD[4])
    px(cv, x, TY + 9, OUT)
for x in range(AX0, AX1):
    px(cv, x, TY - 1, OUT)
# Stickerei: Sterne und Monde auf dem Tuch
for (x, y) in [(40, 280), (80, 288), (170, 288), (210, 280), (60, 266), (190, 266), (74, 298), (176, 298)]:
    sparkle(cv, x, y, (240, 200, 80), r=1, c2=(190, 130, 30))
# eingestickter Zauberkreis in der Mitte des Tuchs
MCX, MCY = 125, 280
arc_px(cv, MCX, MCY, 22, 15, 0, 2 * math.pi, (220, 170, 60), 200)
arc_px(cv, MCX, MCY, 18, 12, 0, 2 * math.pi, (170, 110, 30), 180)
hexa = [(MCX + math.cos(-math.pi / 2 + i * 2 * math.pi / 6) * 17, MCY + math.sin(-math.pi / 2 + i * 2 * math.pi / 6) * 11.5) for i in range(6)]
for i in range(6):
    (x0, y0), (x1, y1) = hexa[i], hexa[(i + 2) % 6]
    for t in np.linspace(0, 1, 40):
        px(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (236, 190, 80))
for i in range(12):
    a = i * math.pi / 6
    x = MCX + math.cos(a) * 20; y = MCY + math.sin(a) * 13.5
    px(cv, x, y, (255, 230, 140))
sparkle(cv, MCX, MCY, (255, 244, 190), r=2, c2=(220, 160, 50))
fog(cv, TY + 12, AY1, (20, 0, 10), k=1.0, seed=4, mix=0.3)

# ---------------------------------------------------------------- Die vier Farben auf dem Tisch
g = Fig(W, H)
# Kelch (links)
g.part('cup')
g.ellipse(46, 222, 11, 9, 'g', a0=0, a1=180)
g.poly([(35, 222), (57, 222), (56, 216), (36, 216)], 'g')
g.part('cupstem'); g.rect(44, 230, 48, 240, 'g'); g.ellipse(46, 234, 3.5, 2, 'g')
g.part('cupfoot'); g.ellipse(46, 243, 9, 3, 'g')
g.part('cuprim'); g.ellipse(46, 216, 11, 3, 'W')
# Schwert (liegt schräg auf dem Tisch)
g.part('blade'); g.limb(74, 246, 122, 238, 2.5, 1.2, 'S')
g.part('guard'); g.limb(70, 240, 74, 252, 1.8, 1.8, 'g')
g.part('grip'); g.limb(60, 248, 70, 246, 1.8, 1.8, 'L')
g.part('pommel'); g.ellipse(58, 248, 2.5, 2.5, 'g')
# Stab mit Knospen (rechts vorne)
g.part('staff'); g.limb(136, 250, 176, 238, 2.2, 2.0, 'w')
g.part('bud1'); g.ellipse(150, 243, 2.5, 1.8, 'l')
g.part('bud2'); g.ellipse(166, 238, 2.5, 1.8, 'l')
# Münze / Pentakel (rechts, aufrecht auf einem Ständer)
g.part('stand'); g.poly([(197, 246), (215, 246), (211, 238), (201, 238)], 'L')
g.part('coin'); g.ellipse(206, 224, 13, 13, 'g')
g.outline()
TMATS = {
    'g': mat(GOLD7, pillow=3, k=1.8, spec=True, spec_col=(255, 255, 236), bias=0.05),
    'W': mat([(60, 20, 30), (120, 40, 50), (170, 60, 70)], pillow=2, k=1.2, bias=-0.1),
    'S': mat(SILVER, pillow=1.5, k=2.0, spec=True, bias=0.1),
    'L': mat(WOOD, pillow=1.5, k=1.2),
    'w': mat(WOOD, pillow=1.2, k=1.3, bias=0.1),
    'l': mat(LEAF, pillow=1.2, k=1.2, bias=0.2),
}
tfig = g.render(TMATS)
# Schatten der Gegenstände auf dem Tisch
for (sx_, sw) in [(46, 10), (206, 12), (100, 26), (156, 20)]:
    for y in range(TY + 3, TY + 8):
        for x in range(sx_ - sw, sx_ + sw):
            if BAYER4[y % 4, x % 4] < 0.5:
                blend_px(cv, x, y, (20, 8, 10), 0.4)
cv.paste(tfig, 0, 0)
# Pentagramm auf der Münze
CXc, CYc = 206, 224
ring = [(CXc + math.cos(-math.pi / 2 + i * 4 * math.pi / 5) * 9, CYc + math.sin(-math.pi / 2 + i * 4 * math.pi / 5) * 9) for i in range(6)]
for i in range(5):
    (x0, y0), (x1, y1) = ring[i], ring[i + 1]
    for t in np.linspace(0, 1, 30):
        px(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, GOLD7[1])
arc_px(cv, CXc, CYc, 10, 10, 0, 2 * math.pi, GOLD7[2], 90)
arc_px(cv, CXc, CYc, 11, 11, math.pi * 1.0, math.pi * 1.6, GOLD7[6], 30)
# Edelsteine am Kelch
for (x, y, c) in [(46, 225, RUBY), (39, 221, SAPH), (53, 221, EMER)]:
    px(cv, x, y, c[2]); px(cv, x - 1, y, c[3]); px(cv, x, y - 1, c[4]); px(cv, x + 1, y, c[1])
# Kelch-Glanz
for y in range(219, 229):
    px(cv, 40, y, GOLD7[6]) if (y % 3) else None
# Rubin im Schwertknauf
px(cv, 58, 248, RUBY[3]); px(cv, 57, 247, RUBY[4])

# ---------------------------------------------------------------- Rosenranken oben
def rose(cx, cy, r=3):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = math.hypot(x - cx, y - cy)
            if d <= r + 0.3:
                v = 0.8 - d / (r + 1) * 0.5 - (y - cy) * 0.08
                px(cv, x, y, rampc(RED_CLOTH, v, x, y))
    for t in np.linspace(0, 2.6 * math.pi, 20):
        rr = 0.4 + t * 0.35
        if rr < r:
            px(cv, cx + math.cos(t) * rr, cy + math.sin(t) * rr, RED_CLOTH[0])
    arc_px(cv, cx, cy, r + 1, r + 1, 0, 2 * math.pi, (30, 4, 12), 40)
    px(cv, cx - 1, cy - 1, RED_CLOTH[4])
def leaf(cx, cy, a, L=5):
    for s in np.linspace(0, L, 14):
        w_ = math.sin(math.pi * s / L) * 1.6
        for t in np.linspace(-w_, w_, 5):
            x = cx + math.cos(a) * s - math.sin(a) * t; y = cy + math.sin(a) * s + math.cos(a) * t
            px(cv, x, y, LEAF[3] if t < 0 else LEAF[1])
def vine(pts, n_roses, seed):
    r_ = random.Random(seed)
    P = np.array(pts, float)
    path = []
    for i in range(len(P) - 1):
        for t in np.linspace(0, 1, 40, endpoint=False):
            path.append(P[i] + (P[i + 1] - P[i]) * t)
    for i, (x, y) in enumerate(path):
        px(cv, x, y, LEAF[0]); px(cv, x, y + 1, LEAF[1])
        if i % 9 == 0:
            leaf(x, y, r_.uniform(0, 2 * math.pi))
    for k in range(n_roses):
        x, y = path[int((k + 0.5) / n_roses * len(path))]
        rose(int(x), int(y) + r_.randint(-2, 2), r_.choice([3, 4]))
# Girlande entlang der Oberkante (durchhängend) und an den Säulen hinab
vine([(AX0 + 1, 48), (40, 52), (70, 56), (100, 54)], 3, 1)
vine([(150, 54), (180, 56), (210, 52), (AX1 - 2, 48)], 3, 2)
vine([(AX0 + 8, 48), (AX0 + 10, 90), (AX0 + 6, 130), (AX0 + 10, 170)], 3, 3)
vine([(AX1 - 8, 48), (AX1 - 10, 90), (AX1 - 6, 130), (AX1 - 10, 170)], 3, 4)

# ---------------------------------------------------------------- Lilien unten
def lily(cx, cy, s=1.0, flip=1):
    # drei weiße Blütenblätter, gelbe Staubgefäße
    for (a, L) in [(-math.pi / 2, 7), (-math.pi / 2 - 0.9, 7), (-math.pi / 2 + 0.9, 7), (-math.pi / 2 - 1.8, 5), (-math.pi / 2 + 1.8, 5)]:
        L *= s
        for u in np.linspace(0, L, 20):
            w_ = math.sin(math.pi * u / L) * 2.0 * s
            for t in np.linspace(-w_, w_, 6):
                x = cx + math.cos(a) * u - math.sin(a) * t; y = cy + math.sin(a) * u + math.cos(a) * t
                v = 0.9 - u / L * 0.2 - (0.3 if t > 0 else 0)
                px(cv, x, y, rampc(WHITE_CLOTH, v, x, y))
    for (dx, dy) in [(-1, -4), (1, -4), (0, -5)]:
        px(cv, cx + dx, cy + dy, (250, 200, 50))
    px(cv, cx, cy, (240, 220, 140))
def lily_stalk(x0, y0, x1, y1):
    for t in np.linspace(0, 1, 60):
        x = x0 + (x1 - x0) * t + math.sin(t * 3) * 1.5; y = y0 + (y1 - y0) * t
        px(cv, x, y, LEAF[2]); px(cv, x + 1, y, LEAF[0])
for (x0, x1, y1) in [(22, 26, 262), (32, 30, 272), (44, 46, 280), (206, 204, 280), (218, 222, 264), (228, 226, 274)]:
    lily_stalk(x0, AY1, x1, y1)
    leaf(x0 + 1, AY1 - 10, -math.pi / 2 - 0.6, 8); leaf(x0 + 1, AY1 - 16, -math.pi / 2 + 0.6, 7)
for (x, y) in [(26, 262), (30, 272), (46, 280), (204, 280), (222, 264), (226, 274)]:
    lily(x, y)

# ---------------------------------------------------------------- magische Funken
for (x, y, c) in [(60, 90, (220, 180, 255)), (100, 78, (255, 240, 170)), (170, 110, (220, 180, 255)), (190, 150, (255, 240, 170)),
                  (58, 190, (220, 180, 255)), (190, 196, (255, 240, 170)), (66, 118, (255, 255, 255)), (96, 100, (220, 180, 255)),
                  (160, 64, (255, 240, 170)), (184, 90, (255, 255, 255))]:
    sparkle(cv, x, y, c, r=2, c2=lerp(c, (80, 40, 140), 0.5))
for _ in range(40):
    x = rnd.randint(50, 200); y = rnd.randint(60, 240)
    if not inside(x, y):
        px(cv, x, y, rnd.choice([(255, 240, 180), (220, 190, 255)]))

emblem_inf = emblem_generic([".##.##.", "#..#..#", ".##.##."], {'#': (255, 220, 110)})
finish(cv, 'I', 'ARCHIBALD', out='01_magician_archibald', emblem=emblem_inf)
print('ok')
