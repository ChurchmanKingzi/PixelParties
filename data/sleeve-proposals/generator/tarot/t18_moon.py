# -*- coding: utf-8 -*-
# XVIII – Der Mond: Tsu'Ki, the Lunatic Princess
# Die goldene Geisterprinzessin schwebt mit ausgebreiteten Armen vor dem Vollmond mit schlafendem Gesicht.
# Links und rechts zwei Türme, dazwischen windet sich ein Pfad zu den Bergen. Ein Hund (Loyal Beagle)
# und ein Wolf (Deepsea Werewolf) heulen den Mond an, aus dem Teich krabbelt ein Flusskrebs,
# goldene Tautropfen fallen vom Mond.
from tarot_sterne_helpers import *

cv = new_card()
rnd = random.Random(18)
HOR = 204
# ---------------------------------------------------------------- Nachthimmel (Lunatic-Stil: grünstichig, dunstig)
sky(cv, [(6, 10, 20), (12, 20, 34), (22, 34, 46), (40, 54, 58), (70, 80, 70), (104, 108, 82)], y1=HOR + 8)
vignette(cv, strength=0.45)
stars(cv, 150, y1=HOR - 30, seed=18, cols=[(230, 236, 210), (190, 210, 200), (255, 250, 220), (140, 160, 150)], big=0.1)
# Dunstschleier
fog(cv, AY0, HOR, (120, 130, 100), k=1.4, seed=4, mix=0.25)

MX, MY, MR = 125, 94, 48
# Strahlenkranz des Mondes: abwechselnd lange und kurze Strahlen
for i in range(32):
    a = i * math.pi / 16
    L = MR + (26 if i % 2 == 0 else 14)
    for s in np.linspace(MR + 2, L, 90):
        hw = (3.2 if i % 2 == 0 else 2.0) * (1 - (s - MR) / (L - MR)) + 0.4
        for t in np.linspace(-hw, hw, int(hw * 2) + 2):
            x = MX + math.cos(a) * s - math.sin(a) * t; y = MY + math.sin(a) * s + math.cos(a) * t
            if in_art(x, y):
                fade = (s - MR) / (L - MR)
                xi, yi = int(round(x)), int(round(y))
                if BAYER4[yi % 4, xi % 4] < (1 - fade) * 0.9:
                    blend_px(cv, xi, yi, (236, 226, 160), 0.45 if abs(t) < hw * 0.5 else 0.25)
glow(cv, MX, MY, MR + 30, (230, 230, 180), k=0.45, mix=0.28)
MOON = [(110, 104, 70), (156, 150, 104), (200, 196, 144), (232, 228, 180), (248, 246, 214), (255, 255, 240)]
disc_relief(cv, MX, MY, MR, MOON, craters=[(MX - 26, MY - 20, 5), (MX + 28, MY - 26, 4), (MX - 32, MY + 10, 6),
                                          (MX + 30, MY + 14, 5), (MX + 8, MY - 36, 3), (MX - 12, MY + 30, 4)],
            noise_k=0.4, bias=0.12, k=1.8)
# Mondrand: dünner, dunkler Kranz
for y in range(MY - MR - 2, MY + MR + 3):
    for x in range(MX - MR - 2, MX + MR + 3):
        d = math.hypot(x - MX, y - MY)
        if MR < d <= MR + 1.2 and in_art(x, y):
            px(cv, x, y, (150, 140, 90))
# Mondgesicht im Profil (wie auf der klassischen Karte), in der linken Sichel, Blick nach rechts zu Tsu'Ki
FACE = (120, 110, 70); FACE2 = (176, 168, 116)
def prof_x(y):
    """Profillinie: Stirn, Braue, Nase, Lippen, Kinn"""
    b = MX - 30 + 10 * math.cos((y - MY) / MR * 1.4)
    bump = 0
    for (yc, h, w) in [(MY - 16, 2.5, 3), (MY - 1, 8, 4.5), (MY + 9, 2.4, 1.6), (MY + 14, 2.0, 1.6), (MY + 22, 3.5, 3.5)]:
        bump += h * math.exp(-((y - yc) / w) ** 2)
    return b + bump
for y in range(MY - MR + 6, MY + MR - 5):
    xp = prof_x(y)
    for x in range(int(xp) + 1, MX + MR):
        if math.hypot(x - MX, y - MY) < MR - 1 and BAYER4[y % 4, x % 4] < 0.35:
            blend_px(cv, x, y, (150, 146, 100), 0.35)       # Schattenseite der Sichel
    px(cv, xp, y, FACE)
    px(cv, xp - 1, y, FACE2)
# geschlossenes Auge, Braue, Nasenloch, Mundwinkel
ey = MY - 9; ex = prof_x(ey) - 7
for (dx, dy) in [(-3, 0), (-2, 1), (-1, 1), (0, 1), (1, 1), (2, 0)]:
    px(cv, ex + dx, ey + dy, FACE)
for (dx, dy) in [(-2, 2), (0, 2), (2, 1)]:
    px(cv, ex + dx, ey + dy + 1, FACE2)
for dx in range(-3, 3):
    px(cv, ex + dx, ey - 5 - (1 if abs(dx) < 2 else 0), FACE2)
px(cv, prof_x(MY + 4) - 2, MY + 4, FACE)
for dx in range(0, 4):
    px(cv, prof_x(MY + 12) - 1 - dx, MY + 12, FACE2 if dx else FACE)
# Wangenschatten
for (dx, dy) in [(-10, 4), (-9, 5), (-11, 6)]:
    px(cv, prof_x(MY + dy) + dx, MY + dy, (220, 214, 160))

# ---------------------------------------------------------------- ferne Berge
MTN = [(40, 50, 66), (58, 70, 84), (80, 92, 104), (110, 120, 128), (170, 176, 176)]
for x in range(AX0, AX1):
    top = HOR - 2 - 20 * max(0, 1 - abs(x - 108) / 44) - 12 * max(0, 1 - abs(x - 150) / 30) - 4 * math.sin(x * 0.2)
    for y in range(int(top), HOR + 8):
        v = 0.7 - (y - top) / 30 + (0.25 if x < 108 and y < top + 6 else 0)
        px(cv, x, y, rampc(MTN, v, x, y))
    if top < HOR - 12:
        px(cv, x, int(top), MTN[4])        # Schneekante
    elif top < HOR - 6 and x % 2 == 0:
        px(cv, x, int(top), MTN[3])

# ---------------------------------------------------------------- Land, Pfad und Teich
GROUND = [(10, 18, 20), (18, 32, 30), (28, 50, 40), (44, 72, 52), (70, 100, 66)]
gn = noise(H, W, 5, seed=8)
for y in range(HOR + 4, AY1):
    for x in range(AX0, AX1):
        v = 0.3 + (y - HOR) / (AY1 - HOR) * 0.35 + (gn[y, x] - 0.5) * 0.5
        px(cv, x, y, rampc(GROUND, v, x, y))
PATH = [(60, 54, 44), (98, 90, 70), (140, 130, 100), (184, 176, 136), (220, 214, 170)]
def path_center(y):
    t = (y - HOR) / (278 - HOR)
    return 125 + 22 * math.sin(t * 5.2 + 0.4) * t
for y in range(HOR + 4, 282):
    t = (y - HOR) / (278 - HOR)
    hw = 1.5 + t * 13
    c = path_center(y)
    for x in range(int(c - hw), int(c + hw) + 1):
        e = abs(x - c) / hw
        v = 0.75 - e * 0.5 - (1 - t) * 0.25 + (gn[y, x] - 0.5) * 0.4
        px(cv, x, y, rampc(PATH, v, x, y))
    px(cv, c - hw - 1, y, GROUND[0]); px(cv, c + hw + 1, y, GROUND[0])
# Trittsteine und Kiesel auf dem Pfad
for _ in range(70):
    y = rnd.randint(HOR + 10, 279)
    t = (y - HOR) / (278 - HOR)
    hw = 1.5 + t * 13
    x = path_center(y) + rnd.uniform(-hw * 0.8, hw * 0.8)
    r = 0.6 + t * 1.8
    for yy in range(int(y - r), int(y + r) + 1):
        for xx in range(int(x - r * 1.4), int(x + r * 1.4) + 1):
            dd = ((xx - x) / (r * 1.4 + 0.01)) ** 2 + ((yy - y) / (r + 0.01)) ** 2
            if dd <= 1:
                px(cv, xx, yy, PATH[3] if yy < y else PATH[1])
    px(cv, x, y + r + 0.5, PATH[0])
# Gras + Kräuter
for _ in range(360):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(HOR + 8, AY1 - 1)
    if abs(x - path_center(min(y, 278))) > 2 + (y - HOR) / 64 * 13:
        for k in range(rnd.randint(1, 4)):
            px(cv, x, y - k, GROUND[4] if k == 0 else GROUND[3])
# Teich
WATER = [(8, 16, 26), (16, 32, 46), (30, 56, 70), (60, 92, 100), (130, 150, 140), (230, 226, 180)]
PY = 280
pond = np.zeros((H, W), bool)
for y in range(PY - 6, AY1):
    for x in range(AX0, AX1):
        top = PY + 4 * math.sin(x * 0.08) - 6 * max(0, 1 - abs(x - 125) / 60)
        if y >= top:
            pond[y, x] = True
            v = 0.45 - (y - top) / 40 * 0.3 + (gn[y, x] - 0.5) * 0.3
            if math.sin(y * 1.4 + math.sin(x * 0.12) * 2) > 0.85:
                v += 0.2
            px(cv, x, y, rampc(WATER, v, x, y))
        elif y >= top - 2:
            px(cv, x, y, (22, 26, 24))
# Mondspiegelung im Teich (flirrende Goldstreifen)
for y in range(PY, AY1):
    for x in range(95, 156):
        if pond[y, x]:
            d = abs(x - 125 - math.sin(y * 0.9) * 3) / (22 + (y - PY) * 0.3)
            if d < 1 and y % 3 != 1 and BAYER4[y % 4, x % 4] < (1 - d) * 0.9:
                px(cv, x, y, (240, 226, 160) if d < 0.35 else (150, 150, 110))
# Schilf am Teichrand
REED = [(12, 30, 26), (26, 56, 40), (50, 90, 56), (90, 130, 76)]
for (x0, hgt, lean) in [(24, 22, 2), (28, 30, -2), (33, 18, 3), (214, 26, -2), (220, 20, 2), (226, 30, 1), (90, 12, -2), (164, 14, 2)]:
    y0 = PY + 2
    for k in range(hgt):
        t = k / hgt
        px(cv, x0 + lean * t * t, y0 - k, REED[1] if k % 4 else REED[2]); px(cv, x0 + 1 + lean * t * t, y0 - k, REED[0])

# ---------------------------------------------------------------- Türme
TOWER = [(26, 28, 40), (44, 48, 62), (64, 68, 82), (88, 92, 104), (116, 118, 126), (150, 150, 152)]
def tower(x0, x1, ytop, ybot, win_side):
    Ht = np.zeros((H, W), np.float32); Mt = np.zeros((H, W), bool)
    for y in range(ytop - 8, ybot):
        for x in range(x0 - 3, x1 + 3):
            inside = x0 <= x < x1 and y >= ytop
            # Zinnenkranz (etwas breiter)
            if ytop - 8 <= y < ytop + 3 and x0 - 3 <= x < x1 + 3:
                if y >= ytop - 3 or ((x - x0 + 3) // 5) % 2 == 0:
                    inside = True
            if not inside or not in_art(x, y):
                continue
            Mt[y, x] = True
            # Quadermauerwerk
            row = (y - ytop) // 5
            off = 0 if row % 2 == 0 else 4
            by = (y - ytop) % 5; bx = (x - x0 + off) % 8
            e = min(by, 4 - by, bx, 7 - bx)
            Ht[y, x] = min(e, 1.5) * 0.6 + math.cos((x - x0) / (x1 - x0) * math.pi) * 2.0
    Ht += (noise(H, W, 3, seed=x0) - 0.5) * 0.8
    relief(cv, Ht, np.zeros((H, W), np.int32), [TOWER], Mt, k=1.3, bias=-0.08)
    # Umriss
    for y, x in zip(*np.where(Mt)):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if not Mt[y + dy, x + dx] and in_art(x + dx, y + dy):
                px(cv, x + dx, y + dy, (10, 10, 16))
    # Gesims
    for x in range(x0 - 3, x1 + 3):
        if in_art(x, ytop + 3):
            px(cv, x, ytop + 3, TOWER[0])
    # erleuchtete Fenster
    wx = (x0 + x1) // 2 + win_side
    for (wy, ww, wh) in [(ytop + 14, 3, 7), (ytop + 40, 2, 5)]:
        for y in range(wy - 1, wy + wh + 1):
            for x in range(wx - ww - 1, wx + ww + 1):
                if in_art(x, y):
                    top = y < wy + 1 and abs(x - wx + 0.5) > ww - 1
                    edge = y == wy - 1 or y == wy + wh or x == wx - ww - 1 or x == wx + ww
                    px(cv, x, y, (14, 12, 18) if (edge or top) else ((255, 224, 130) if y > wy + 1 else (255, 246, 190)))
        glow(cv, wx, wy + wh / 2, 9, (255, 200, 110), k=0.5, mix=0.25)
    # Efeu
    rr = random.Random(x0)
    for _ in range(40):
        x = rr.randint(x0, x1 - 1); y = ybot - int(abs(rr.gauss(0, 22)))
        if Mt[y, x]:
            px(cv, x, y, rr.choice([(30, 60, 40), (44, 86, 50), (70, 116, 64)]))
tower(16, 44, 126, 252, 2)
tower(206, 234, 132, 252, -2)
# Sockel/Schatten der Türme im Gras
for (x0, x1) in [(16, 48), (202, 234)]:
    for y in range(248, 256):
        for x in range(x0, x1):
            if in_art(x, y) and BAYER4[y % 4, x % 4] < (1 - (y - 248) / 8) * 0.9:
                blend_px(cv, x, y, (4, 8, 10), 0.5)

# ---------------------------------------------------------------- Hund (links) und Wolf (rechts) heulen
def canine(f, s, cx, kind):
    """sitzender Hund/Wolf im Profil, Schnauze zum Mond gereckt. s=+1: schaut nach rechts."""
    X = lambda x: cx + s * x
    f.part(kind + 'tail')
    if kind == 'dog':
        f.curve([(X(-12), 246), (X(-20), 240), (X(-23), 229)], 't', w=4, w1=2)
    else:
        f.curve([(X(-10), 249), (X(-22), 248), (X(-30), 240)], 't', w=8, w1=3)
    f.part(kind + 'legB'); f.limb(X(5), 232, X(6), 250, 3, 2.6, 't')
    f.part(kind + 'body')
    f.ellipse(X(-4), 238, 12, 11.5, 'a')
    f.poly([(X(-13), 236), (X(-6), 222), (X(3), 212), (X(13), 214), (X(14), 228), (X(8), 242), (X(-4), 248)], 'a')
    f.limb(X(7), 220, X(13), 203, 7.5, 6.5, 'a')
    f.ellipse(X(14), 199, 8, 7, 'a')
    f.limb(X(17), 196, X(26), 187, 4.4, 3, 'a')
    if kind == 'dog':
        f.poly([(X(8), 214), (X(14), 215), (X(14), 229), (X(10), 234), (X(6), 226)], 'w', only='a')   # weiße Brust
        f.limb(X(19), 196, X(26), 188, 2.8, 2, 'w', only='a')                                         # weiße Schnauze
    else:
        f.poly([(X(6), 216), (X(14), 216), (X(14), 230), (X(8), 236)], 'w', only='a')
    f.part(kind + 'jaw'); f.limb(X(18), 203, X(28), 195, 2.6, 1.6, 'w' if kind == 'dog' else 'a')
    f.part(kind + 'mouth', line=False); f.line(X(19), 200, X(27), 193, 'm', w=1)
    f.part(kind + 'hind'); f.ellipse(X(0), 251, 10, 3.2, 'a')
    f.part(kind + 'legF'); f.limb(X(11), 230, X(12), 250, 3.6, 3, 'a'); f.ellipse(X(14), 251, 4, 2.2, 'a')
    if kind == 'dog':
        f.part(kind + 'ear'); f.poly([(X(8), 194), (X(14), 193), (X(13), 204), (X(9), 212), (X(5), 206)], 'e')
    else:
        f.part(kind + 'ear'); f.poly([(X(7), 197), (X(9), 182), (X(15), 194)], 'a')
        f.part(kind + 'ruff'); f.poly([(X(3), 212), (X(-2), 222), (X(4), 219), (X(1), 229), (X(8), 223), (X(10), 213)], 'a')
    return (X(16), 196)

DOG = [(14, 12, 16), (30, 26, 32), (52, 46, 52), (78, 72, 76), (108, 102, 104)]
DOGW = [(80, 80, 90), (140, 140, 150), (196, 196, 204), (236, 236, 240)]
WOLF = [(12, 22, 44), (26, 44, 76), (46, 72, 110), (76, 108, 146), (120, 152, 184), (170, 196, 220)]
WOLFW = [(60, 86, 116), (110, 140, 170), (170, 196, 220), (220, 236, 248)]
DDY = 10                                   # Hunde etwas tiefer ins Bild
fd = Fig(W, H); eye_d = canine(fd, 1, 56, 'dog'); eye_d = (eye_d[0], eye_d[1] + DDY); fd.outline()
cv.paste(fd.render({'a': mat(DOG, pillow=4, k=1.5, bias=0.08), 'w': mat(DOGW, pillow=2, k=1.2), 't': mat(DOG, pillow=2, k=1.4),
                    'e': mat([(6, 6, 8), (18, 16, 20), (36, 32, 38), (60, 56, 62)], pillow=2, k=1.3), 'm': mat([(60, 10, 20), (120, 30, 40)], pillow=1)}), 0, DDY)
fw = Fig(W, H); eye_w = canine(fw, -1, 194, 'wolf'); eye_w = (eye_w[0], eye_w[1] + DDY); fw.outline()
wolf_rgba = fw.render({'a': mat(WOLF, pillow=4, k=1.5, noise=0.8, nscale=2, bias=0.05), 'w': mat(WOLFW, pillow=2, k=1.2),
                       't': mat(WOLF, pillow=3, k=1.5, noise=1.0, nscale=2), 'm': mat([(60, 10, 20), (120, 30, 40)], pillow=1)})
wolf_rgba = np.roll(wolf_rgba, DDY, axis=0)
cv.paste(wolf_rgba, 0, 0)
# Augen: Hund blau, Wolf weiß leuchtend
px(cv, eye_d[0], eye_d[1], (40, 90, 210)); px(cv, eye_d[0] - 1, eye_d[1], (14, 12, 16)); px(cv, eye_d[0], eye_d[1] - 1, (14, 12, 16))
px(cv, eye_w[0], eye_w[1], (240, 250, 255)); px(cv, eye_w[0] + 1, eye_w[1], (180, 220, 255)); px(cv, eye_w[0], eye_w[1] - 1, (10, 16, 30))
glow(cv, eye_w[0], eye_w[1], 4, (200, 240, 255), k=0.6, mix=0.3)
# Halsband des Hundes
for x in range(58, 70):
    y = 226 - (x - 58) * 0.8
    px(cv, x, y, (190, 36, 44)); px(cv, x, y + 1, (120, 16, 26))
px(cv, 65, 222, GOLD[4]); px(cv, 65, 223, GOLD[2])
# rote Tiefsee-Ranken am Werwolf
WM_ = wolf_rgba[..., 3] > 0
for (pts) in [[(186, 256), (182, 246), (186, 238), (181, 230)], [(198, 248), (202, 238), (198, 230)], [(178, 222), (174, 214), (177, 208)],
              [(206, 254), (212, 246), (210, 238)]]:
    P = []
    for i in range(len(pts) - 1):
        P += bezier(pts[i], ((pts[i][0] + pts[i + 1][0]) / 2 + 2, (pts[i][1] + pts[i + 1][1]) / 2), pts[i + 1], 12)
    for (x, y) in P:
        xi, yi = int(round(x)), int(round(y))
        px(cv, xi, yi, (150, 30, 44) if WM_[yi, xi] else (110, 20, 34))
    x, y = pts[-1]
    px(cv, x - 1, y - 1, (190, 50, 60)); px(cv, x + 1, y - 1, (190, 50, 60))
# Schallwellen des Geheuls
for (cx_, cy_, s) in [(85, 192, 1), (165, 192, -1)]:
    for r in (4, 7, 10):
        for a in np.linspace(-0.9, 0.4, 14):
            aa = -math.pi / 4 + a if s == 1 else -3 * math.pi / 4 - a
            x = cx_ + math.cos(aa) * r; y = cy_ + math.sin(aa) * r
            if (int(a * 20) % 3):
                blend_px(cv, x, y, (220, 220, 190), 0.55)

# ---------------------------------------------------------------- Flusskrebs krabbelt aus dem Teich
CRAY = [(50, 8, 8), (110, 24, 16), (170, 50, 24), (220, 96, 44), (250, 160, 90)]
k = Fig(W, H)
KX, KY = 125, 284
k.part('tail')
for i in range(4):
    k.ellipse(KX, KY + 8 + i * 3.2, 4.2 - i * 0.6, 2.2, 'r')
k.poly([(KX, KY + 19), (KX - 6, KY + 25), (KX + 6, KY + 25)], 'r')
k.part('legs')
for s in (-1, 1):
    for i in range(3):
        k.line(KX + s * 3, KY + 2 + i * 3, KX + s * 9, KY + 4 + i * 3 + 2, 'r', w=1)
k.part('body'); k.ellipse(KX, KY + 2, 5, 7, 'r')
k.part('arms')
for s in (-1, 1):
    k.limb(KX + s * 3, KY - 3, KX + s * 8, KY - 9, 1.6, 1.4, 'r')
k.part('claws')
for s in (-1, 1):
    k.ellipse(KX + s * 9, KY - 13, 3, 4.5, 'r')
    k.poly([(KX + s * 9, KY - 18), (KX + s * 7, KY - 22), (KX + s * 7.5, KY - 15)], 'r')
k.part('claws2')
for s in (-1, 1):
    k.poly([(KX + s * 10.5, KY - 16), (KX + s * 12, KY - 21), (KX + s * 12, KY - 14)], 'r')
k.part('antennae', line=False)
for s in (-1, 1):
    k.curve([(KX + s * 1, KY - 5), (KX + s * 4, KY - 14), (KX + s * 3, KY - 24), (KX + s * 7, KY - 30)], 'n', w=1)
k.outline()
cv.paste(k.render({'r': mat(CRAY, pillow=2, k=1.8, spec=True, spec_col=(255, 210, 160)), 'n': mat([(120, 40, 20), (190, 80, 40)], pillow=1)}), 0, 0)
px(cv, KX - 2, KY - 3, (10, 6, 6)); px(cv, KX + 2, KY - 3, (10, 6, 6))
# Wasserringe um den Krebs
for r in (10, 14):
    for a in np.linspace(0, math.pi, 30):
        x = KX + math.cos(a) * r * 1.3; y = KY + 16 + math.sin(a) * r * 0.35
        if pond[int(y), int(x)] and int(a * 12) % 3:
            px(cv, x, y, WATER[4])

# ---------------------------------------------------------------- Tsu'Ki
GH = [(150, 98, 22), (176, 120, 26), (212, 156, 36), (244, 202, 80), (255, 234, 150), (255, 250, 214), (255, 255, 246)]
GH_HAIR = [(130, 80, 12), (196, 138, 26), (236, 186, 56), (252, 218, 104), (255, 240, 170), (255, 252, 226)]
MASK = [(60, 62, 76), (120, 122, 136), (180, 182, 194), (226, 228, 236), (250, 250, 255)]
TX, TY = 125, 156          # Kopfmitte
glow(cv, TX, TY + 10, 74, (255, 236, 160), k=0.5, mix=0.26)
glow(cv, TX, TY - 10, 46, (255, 246, 200), k=0.55, mix=0.28)
t = Fig(W, H)
# Geistergewand: schlank an der Taille, fließt lang nach unten und weht leicht nach rechts aus
def robe_edge(u, side):
    """Kante des Gewands bei Höhe u (0 = Taille, 1 = Saum)"""
    w = 7 + 20 * u ** 0.75 + 2.5 * math.sin(u * 7 + (0 if side < 0 else 1.5)) * u
    sway = 6 * u ** 2
    return TX + side * w + sway
RL = TY + 32; RH = 62
robe = [(robe_edge(i / 16, -1), RL + i / 16 * RH) for i in range(17)]
hem = []
for i in range(13):
    u = i / 12
    x = robe_edge(1, -1) + (robe_edge(1, 1) - robe_edge(1, -1)) * u
    hem.append((x, RL + RH + (7 if i % 2 else -3) + 4 * math.sin(u * math.pi)))
robe += hem + [(robe_edge(i / 16, 1), RL + i / 16 * RH) for i in range(16, -1, -1)]
t.part('robe')
t.poly(robe, 'g')
# lange, schmale Hängeärmel
for s_ in (-1, 1):
    X = lambda x, s_=s_: TX + s_ * x
    t.part('sleeve%d' % s_, line=False)
    t.poly([(X(12), TY + 16), (X(28), TY + 12), (X(40), TY + 7), (X(40), TY + 13), (X(28), TY + 20), (X(14), TY + 23)], 'g')
    t.curve([(X(22), TY + 18), (X(27), TY + 26), (X(25), TY + 35), (X(29), TY + 44)], 'g', w=9, w1=1.5)
    t.curve([(X(34), TY + 13), (X(38), TY + 21), (X(36), TY + 30), (X(39), TY + 37)], 'g', w=6, w1=1)
    t.part('arm%d' % s_)
    t.limb(X(13), TY + 17, X(28), TY + 14, 3, 2.5, 'b')
    t.limb(X(28), TY + 14, X(42), TY + 8, 2.5, 1.9, 'b')
    t.part('hand%d' % s_)
    t.ellipse(X(44), TY + 7, 2.6, 2.3, 'b')
    t.line(X(45), TY + 5, X(49), TY + 2, 'b', w=1)
    t.line(X(46), TY + 7, X(51), TY + 5, 'b', w=1)
    t.line(X(46), TY + 8, X(50), TY + 9, 'b', w=1)
    t.line(X(43), TY + 5, X(45), TY + 2, 'b', w=1)
t.part('torso')
t.poly([(TX - 9, TY + 13), (TX + 9, TY + 13), (TX + 10, TY + 20), (TX + 7, TY + 34), (TX - 7, TY + 34), (TX - 10, TY + 20)], 'b')
t.part('collar', line=False)
t.poly([(TX - 10, TY + 13), (TX, TY + 21), (TX + 10, TY + 13), (TX + 7, TY + 12), (TX, TY + 17), (TX - 7, TY + 12)], 'g')
t.part('neck'); t.rect(TX - 4, TY + 6, TX + 4, TY + 13, 'b')
# Haar: lodernde, hochstehende Flammenmähne (hinter dem Kopf)
t.part('hair')
hair = [(-19, 4), (-23, -8), (-21, -20), (-27, -32), (-18, -30), (-17, -42), (-21, -52), (-11, -44), (-9, -56), (-8, -66),
        (-3, -56), (0, -62), (1, -72), (4, -58), (8, -66), (9, -54), (14, -58), (14, -46), (22, -50), (18, -38), (27, -32),
        (21, -22), (24, -10), (19, 4)]
t.poly([(TX + x, TY + y) for (x, y) in hair], 'h')
for s in (-1, 1):                      # seitliche Zacken (wie im Sprite)
    t.poly([(TX + s * 14, TY - 1), (TX + s * 31, TY + 3), (TX + s * 16, TY + 9)], 'h')
t.part('face')
t.ellipse(TX, TY + 1, 13, 11, 'b')
t.poly([(TX - 11, TY + 3), (TX + 11, TY + 3), (TX + 6, TY + 11), (TX, TY + 13), (TX - 6, TY + 11)], 'b')
t.part('bangs')
t.poly([(TX - 14, TY - 1), (TX - 10, TY - 12), (TX, TY - 15), (TX + 10, TY - 12), (TX + 14, TY - 1), (TX + 9, TY - 6),
        (TX + 6, TY - 1), (TX + 3, TY - 7), (TX, TY - 2), (TX - 3, TY - 7), (TX - 6, TY - 1), (TX - 9, TY - 6)], 'h')
# weiße Maske mit spitzen Ohren-Zacken (wie im Sprite)
t.part('mask')
t.poly([(TX - 13, TY - 6), (TX - 9, TY - 1), (TX - 3, TY - 1), (TX, TY + 1), (TX + 3, TY - 1), (TX + 9, TY - 1), (TX + 13, TY - 6),
        (TX + 14, TY + 3), (TX + 10, TY + 8), (TX + 3, TY + 8), (TX, TY + 6), (TX - 3, TY + 8), (TX - 10, TY + 8), (TX - 14, TY + 3)], 'k')
t.outline()
TM = {
    'b': mat(GH, pillow=4, k=1.3, bias=0.2),
    'g': mat(GH, pillow=6, k=1.3, bias=0.16, folds=(0.55, 0.0, 0.6)),
    'h': mat(GH_HAIR, pillow=5, k=1.5, bias=0.1, folds=(0.9, 0.0, 0.5)),
    'k': mat(MASK, pillow=2, k=1.5, bias=0.1, spec=True),
}
trgba = t.render(TM, outline_col=(110, 64, 14))
# Faltenwurf im Gewand: helle und dunkle Bahnen, die an der Taille zusammenlaufen
RM = t.L == 'g'
for i, u0 in enumerate(np.linspace(-0.8, 0.8, 7)):
    for y in range(RL + 3, RL + RH + 8):
        u = (y - RL) / RH
        xl, xr = robe_edge(min(u, 1), -1), robe_edge(min(u, 1), 1)
        x = int(round((xl + xr) / 2 + u0 * (xr - xl) / 2 * 0.9 + math.sin(y * 0.12 + i) * 1.2))
        if RM[y, x] and tuple(trgba[y, x, :3]) != (110, 64, 14):
            trgba[y, x, :3] = GH[5] if i % 2 == 0 else GH[1]
            if i % 2 == 0 and RM[y, x + 1]:
                trgba[y, x + 1, :3] = GH[4]
# geisterhaft: Ärmel und Gewand lösen sich nach unten hin im Dither-Schleier auf
for y in range(TY + 24, TY + 46):
    fade = (y - (TY + 24)) / 20.0
    for x in list(range(TX - 45, TX - 20)) + list(range(TX + 21, TX + 46)):
        if trgba[y, x, 3] and BAYER4[y % 4, x % 4] < fade * 0.8:
            trgba[y, x, 3] = 0
for y in range(TY + 62, H):
    fade = (y - (TY + 62)) / 38.0
    for x in range(TX - 40, TX + 45):
        if trgba[y, x, 3] and BAYER4[y % 4, x % 4] < fade * 1.05:
            trgba[y, x, 3] = 0
# halbdurchsichtiger Schleier um das Gewand (nur Lichtschimmer)
for y in range(RL + 10, RL + RH + 14):
    u = min(1, (y - RL) / RH)
    xl, xr = robe_edge(u, -1) - 4 - 6 * u, robe_edge(u, 1) + 4 + 6 * u
    for x in range(int(xl), int(xr) + 1):
        if not trgba[y, x, 3] and BAYER4[y % 4, x % 4] < 0.35 * (1 - u * 0.7):
            blend_px(cv, x, y, (255, 236, 170), 0.35)
cv.paste(trgba, 0, 0)
TMk = trgba[..., 3] > 0
# Strähnen im Flammenhaar: helle und dunkle Linien, die nach oben zusammenlaufen
HM = np.isin(t.L, ['h'])
for i, dx in enumerate(range(-16, 17, 4)):
    for yy in range(TY - 70, TY - 10):
        x = int(round(TX + dx * (1 + (TY - 10 - yy) / 120.0) + math.sin(yy * 0.3 + i) * 0.8))
        if HM[yy, x] and tuple(cv.a[yy, x]) != (110, 64, 14):
            px(cv, x, yy, GH_HAIR[5] if i % 2 else GH_HAIR[1])
# Augen hinter der Maske: links goldgelb leuchtend, rechts schwarz (wie im Sprite)
for (x, y, c) in [(TX - 8, TY + 3, (255, 236, 90)), (TX - 7, TY + 3, (255, 255, 200)), (TX - 8, TY + 4, (230, 190, 40)), (TX - 7, TY + 4, (255, 220, 70)),
                  (TX + 6, TY + 3, (10, 8, 14)), (TX + 7, TY + 3, (10, 8, 14)), (TX + 6, TY + 4, (10, 8, 14)), (TX + 7, TY + 4, (30, 26, 40))]:
    px(cv, x, y, c)
glow(cv, TX - 7, TY + 3, 5, (255, 240, 120), k=0.7, mix=0.35)
px(cv, TX - 1, TY + 10, (170, 110, 30)); px(cv, TX, TY + 10, (170, 110, 30)); px(cv, TX + 1, TY + 10, (170, 110, 30))
# helle Lichtbälle an den Händen (wie die weißen Lichter im Sprite)
for s in (-1, 1):
    hx = TX + s * 50
    glow(cv, hx, TY + 3, 13, (255, 255, 236), k=0.7, mix=0.35)
    glow(cv, hx, TY + 3, 6, (255, 255, 255), k=0.9, mix=0.5)
    twinkle(cv, hx, TY + 3, (255, 255, 255), r=4, c2=(255, 230, 150))
# Mondsichel-Diadem über der Maske
for a in np.linspace(math.pi * 0.25, math.pi * 1.35, 22):
    px(cv, TX + 0.5 + math.cos(a) * 3.4, TY - 18 + math.sin(a) * 3.4, (255, 255, 236))
# Glühfunken
for (x, y) in [(TX - 14, TY - 44), (TX + 6, TY - 64), (TX + 18, TY - 30), (TX - 4, TY - 62), (TX - 22, TY - 16), (TX + 24, TY + 44),
               (TX - 28, TY + 50), (TX + 6, TY + 94), (TX - 12, TY + 88)]:
    sparkle(cv, x, y, (255, 255, 230), r=1, c2=(255, 220, 120))

# ---------------------------------------------------------------- Tautropfen (Yod) fallen vom Mond
DROP = [(150, 100, 20), (220, 170, 50), (255, 222, 110), (255, 250, 210)]
def drop(x, y, sz=1):
    pts = [(0, -3), (0, -2), (-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (0, 1)]
    if sz > 1:
        pts = [(0, -4), (0, -3), (-1, -2), (0, -2), (1, -2), (-1, -1), (0, -1), (1, -1), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1)]
    for (dx, dy) in pts:
        c = DROP[2]
        if dx < 0 and dy <= 0:
            c = DROP[3]
        if dx > 0 or dy > 0:
            c = DROP[1]
        px(cv, x + dx, y + dy, c)
    px(cv, x - 1 + (1 if sz == 1 else 0), y + (2 if sz > 1 else 1), DROP[0])
for (x, y, sz) in [(60, 150, 2), (74, 168, 1), (46, 176, 1), (88, 140, 1), (190, 150, 2), (176, 170, 1), (204, 180, 1), (162, 142, 1),
                   (100, 188, 1), (150, 188, 1), (38, 132, 1), (212, 128, 1), (70, 118, 1), (182, 116, 1), (125, 38 + 20, 1)]:
    if not TMk[y, x]:
        glow(cv, x, y, 5, (255, 220, 120), k=0.5, mix=0.25)
        drop(x, y, sz)

glitter(cv, 30, (AX0, AY0, AX1, HOR), seed=7, cols=[(255, 250, 220), (230, 240, 210)], mask=~TMk)
fog(cv, HOR - 4, HOR + 30, (140, 150, 120), k=1.6, seed=12, mix=0.2)

finish(cv, 'XVIII', "TSU'KI", out='18_moon_tsuki', emblem=emblem_moon)
print('ok')
