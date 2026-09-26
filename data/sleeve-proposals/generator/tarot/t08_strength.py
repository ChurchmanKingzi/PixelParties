# -*- coding: utf-8 -*-
# VIII – Die Kraft: Thorad, Strength of Coolness
# Thorad schließt ganz gelassen das Maul eines riesigen Tigers (Guardian Beast Hu im Stil: goldene
# Zackenmähne, rote Maske, eisblaue Augen). Über seinem Kopf schwebt die liegende Acht, beide tragen
# Blumengirlanden. Hinten der dunkelgrüne Zackenberg aus seiner Karte mit der schwarzen Krähe,
# weite Hügellandschaft und eine Blumenwiese.
from t08_helpers import *

cv = new_card()
rnd = random.Random(8)
# ---------------------------------------------------------------- Himmel
sky(cv, [(64, 120, 186), (96, 160, 212), (140, 198, 226), (184, 224, 232), (226, 242, 232)], y1=226)
CLOUD_W = [(120, 150, 184), (170, 196, 220), (212, 230, 244), (246, 250, 255)]
CLOUD_G = [(70, 76, 92), (104, 110, 126), (146, 150, 164), (190, 194, 204)]
puffy_cloud(cv, 40, 72, 48, 16, CLOUD_G, seed=3)       # rauchige Wolke links (wie auf der Karte)
puffy_cloud(cv, 64, 84, 40, 12, CLOUD_G, seed=6)
puffy_cloud(cv, 206, 70, 44, 14, CLOUD_W, seed=4)
puffy_cloud(cv, 222, 112, 30, 10, CLOUD_W, seed=9)
puffy_cloud(cv, 30, 128, 30, 9, CLOUD_W, seed=11)

# ---------------------------------------------------------------- Zackenberg (wie auf Thorads Karte)
MTN = [(10, 22, 20), (20, 40, 34), (32, 60, 48), (48, 82, 64), (70, 108, 84), (104, 140, 110)]
Hm = np.zeros((H, W), np.float32); Mm = np.zeros((H, W), bool)
yy, xx = np.indices((H, W))
PKX, PKY = 178, 76
# Grundkörper: breiter Kegel mit unregelmäßigem Grat
for x in range(AX0, AX1):
    ridge = PKY + abs(x - PKX) * 1.05 + 5 * math.sin(x * 0.21) + 3 * math.sin(x * 0.57 + 1)
    if x < PKX:
        ridge = PKY + (PKX - x) * 1.25 + 5 * math.sin(x * 0.23 + 2) + 3 * math.sin(x * 0.61)
    for y in range(int(ridge), 214):
        Mm[y, x] = True
        Hm[y, x] = min(y - ridge, 14) * 0.25
nz = noise(H, W, 5, seed=21)
Hm += (nz - 0.5) * 3.2
# Felsrippen (senkrechte Kerben)
Hm += np.sin(xx * 0.55 + nz * 6) * 0.7 * Mm
relief(cv, Hm, np.zeros((H, W), np.int32), [MTN], Mm, k=1.5, bias=-0.05)
# Luftperspektive: nach unten hin in den Dunst übergehen
for y, x in zip(*np.where(Mm)):
    tt = 0.18 + max(0, (y - 120) / 94) * 0.45
    if BAYER4[y % 4, x % 4] < tt * 1.4:
        blend_px(cv, x, y, (150, 196, 206), 0.3)
# Dornige Zacken, die aus dem Berg ragen (wie die Äste auf der Karte)
def spike(x0, y0, x1, y1, w0):
    for t in np.linspace(0, 1, 60):
        x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        w = w0 * (1 - t) + 0.4
        for s in np.linspace(-w, w, int(w * 2) + 2):
            X, Y = int(round(x + s)), int(round(y))
            if in_art(X, Y):
                px(cv, X, Y, MTN[1] if s > 0 else MTN[3])
    px(cv, x1, y1, MTN[0])
for (x0, y0, x1, y1, w0) in [(PKX, 82, PKX - 2, 58, 3), (150, 112, 132, 94, 2.2), (206, 108, 222, 92, 2.2),
                              (214, 124, 230, 114, 1.6), (138, 130, 124, 120, 1.6), (188, 94, 198, 82, 1.4)]:
    spike(x0, y0, x1, y1, w0)
# Nebelschleier am Bergfuß
fog(cv, 150, 212, (200, 226, 226), k=2.0, seed=4, mix=0.35)

# ---------------------------------------------------------------- Krähe auf dem Zacken
CROW = [(8, 8, 14), (22, 22, 34), (40, 42, 60), (70, 76, 100)]
def crow(cx, cy):
    f = Fig(W, H)
    f.part('tail'); f.poly([(cx + 3, cy + 5), (cx + 11, cy + 10), (cx + 9, cy + 12), (cx + 1, cy + 8)], 'c')
    f.part('body'); f.ellipse(cx, cy + 3, 5, 4, 'c')
    f.part('head'); f.ellipse(cx - 4, cy - 2, 3.2, 3, 'c')
    f.part('beak'); f.poly([(cx - 7, cy - 3), (cx - 11, cy - 1), (cx - 7, cy - 1)], 'b')
    f.part('wing'); f.poly([(cx - 2, cy + 1), (cx + 6, cy + 1), (cx + 9, cy + 7), (cx + 1, cy + 6)], 'w')
    f.outline()
    cv.paste(f.render({'c': mat(CROW, pillow=2, k=1.2, bias=0.05), 'w': mat(CROW, pillow=1.5, k=1.6, bias=0.1),
                       'b': mat([(40, 30, 20), (90, 76, 50), (150, 130, 80)], pillow=1, k=1)}), 0, 0)
    px(cv, cx - 5, cy - 3, (230, 220, 120)); px(cv, cx - 4, cy - 3, (20, 10, 10))
    for d in (-1, 1):
        px(cv, cx + d, cy + 8, (60, 50, 40)); px(cv, cx + d, cy + 9, (60, 50, 40))
crow(PKX - 3, 49)

# ---------------------------------------------------------------- Hügel und Wiese
hills(cv, 200, 5, [(56, 110, 110), (74, 136, 120), (96, 160, 128)], freq=0.045, seed=2)
hills(cv, 214, 6, [(40, 100, 60), (60, 130, 66), (86, 158, 76)], freq=0.06, seed=5)
GRASS = [(22, 66, 30), (36, 98, 38), (58, 134, 48), (90, 170, 62), (138, 204, 90)]
nG = noise(H, W, 4, seed=13)
for y in range(226, AY1):
    for x in range(AX0, AX1):
        v = 0.8 - (y - 226) / (AY1 - 226) * 0.5 + (nG[y, x] - 0.5) * 0.55
        px(cv, x, y, rampc(GRASS, v, x, y))
for y in range(222, 228):   # weicher Übergang Hügel -> Wiese
    for x in range(AX0, AX1):
        if BAYER4[y % 4, x % 4] < (y - 222) / 6:
            px(cv, x, y, rampc(GRASS, 0.8, x, y))
for _ in range(300):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(226, AY1 - 1)
    for k in range(rnd.randint(2, 4)):
        px(cv, x, y - k, GRASS[4] if k == 0 else GRASS[3])
FLOWER_COLS = [(250, 120, 150), (255, 255, 255), (255, 214, 80), (240, 90, 90), (190, 140, 250)]
for _ in range(60):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(230, AY1 - 3)
    small_flower(cv, x, y, rnd.choice(FLOWER_COLS))

# ---------------------------------------------------------------- Rosen und Lilien im Vordergrund (wie auf der Tarotkarte)
LEAF = [(14, 48, 20), (26, 86, 30), (44, 124, 40), (76, 162, 56)]
ROSE = [(70, 6, 16), (140, 16, 30), (200, 34, 44), (240, 80, 80), (255, 150, 140)]
LILY = [(150, 150, 170), (206, 206, 220), (240, 240, 248), (255, 255, 255)]
def stem(x, y0, y1, lean=0):
    for yy_ in range(y1, y0):
        px(cv, x + lean * (y0 - yy_) / max(1, y0 - y1), yy_, LEAF[1])
    for (dy, sd) in ((int((y0 - y1) * 0.5), -1), (int((y0 - y1) * 0.3), 1)):
        yy_ = y0 - dy
        px(cv, x + sd, yy_, LEAF[2]); px(cv, x + 2 * sd, yy_ - 1, LEAF[3]); px(cv, x + 3 * sd, yy_ - 1, LEAF[2])
def rose(x, y, h=10):
    stem(x, y + h, y + 2)
    for yy_ in range(y - 3, y + 4):
        for xx_ in range(x - 3, x + 4):
            d = math.hypot(xx_ - x, (yy_ - y) * 1.1)
            if d <= 3.3:
                sp = (math.atan2(yy_ - y, xx_ - x) * 2 + d * 1.6) % 3.2 < 1.1
                v = 0.7 - (yy_ - y) * 0.08 - (xx_ - x) * 0.05 - (0.3 if sp else 0) - d * 0.05
                px(cv, xx_, yy_, rampc(ROSE, v, xx_, yy_))
            elif d <= 4.3:
                px(cv, xx_, yy_, ROSE[0])
def lily(x, y, h=12):
    stem(x, y + h, y + 3)
    for a in range(6):
        ang = a * math.pi / 3 + 0.3
        for r_ in range(1, 5):
            X = x + math.cos(ang) * r_; Y = y + math.sin(ang) * r_ * 0.8
            px(cv, X, Y, LILY[3] if r_ < 3 and math.sin(ang) < 0.3 else LILY[2] if r_ < 4 else LILY[1])
    px(cv, x, y, (255, 200, 60)); px(cv, x + 1, y - 1, (255, 170, 40))
for (x, y, kind) in [(22, 270, 'r'), (30, 282, 'l'), (40, 272, 'r'), (20, 292, 'l'), (48, 290, 'r'), (36, 296, 'r'),
                     (126, 282, 'l'), (134, 292, 'r'), (122, 296, 'r'), (228, 232, 'r'), (140, 262, 'r'), (150, 252, 'l')]:
    (rose if kind == 'r' else lily)(x, y)
# Schlagschatten auf der Wiese
for (cx_, cy_, rx_, ry_) in [(82, 297, 40, 5), (196, 300, 52, 7)]:
    for yy_ in range(cy_ - ry_, cy_ + ry_ + 1):
        for xx_ in range(cx_ - rx_, cx_ + rx_ + 1):
            d = ((xx_ - cx_) / rx_) ** 2 + ((yy_ - cy_) / ry_) ** 2
            if d < 1 and in_art(xx_, yy_) and BAYER4[yy_ % 4, xx_ % 4] < (1 - d) * 1.2:
                blend_px(cv, xx_, yy_, (10, 36, 20), 0.45)

# ---------------------------------------------------------------- liegende Acht über Thorad
glow(cv, 80, 64, 30, (255, 250, 210), k=0.5, mix=0.3)
lemniscate(cv, 80, 64, 17, th=1.6)



# ================================================================= Tiger (im Stil von Guardian Beast Hu)
FUR = [(92, 30, 8), (160, 64, 14), (214, 108, 24), (242, 150, 40), (255, 196, 86), (255, 232, 160)]
STRIPE = [(12, 6, 12), (20, 10, 16), (32, 16, 20), (50, 26, 24), (72, 40, 30), (96, 56, 36)]
MANE = [(120, 70, 10), (196, 146, 24), (240, 206, 60), (255, 236, 120), (255, 250, 196), (255, 255, 240)]
WFUR = [(118, 104, 114), (166, 156, 164), (210, 202, 202), (238, 232, 226), (255, 252, 246)]
MASK = [(70, 8, 18), (130, 16, 30), (196, 30, 44), (236, 70, 70), (255, 130, 120)]
NOSE = [(70, 24, 34), (130, 56, 66), (196, 100, 110), (240, 164, 170)]
EARIN = [(120, 80, 90), (180, 140, 146), (226, 196, 196), (250, 232, 228)]
MOUTH = [(34, 4, 12), (80, 12, 26), (140, 30, 50), (200, 70, 90)]
TX, TY, S = 160, 172, 1.25     # Kopfmitte + Maßstab des Kopfes
def P(pts):
    return [(TX + x * S, TY + y * S) for (x, y) in pts]
def Q(x, y):
    return TX + x * S, TY + y * S
t = Fig(W, H)
# ---- Körper (sitzend, rechts aus dem Bild laufend)
t.part('body')
t.poly([(176, 196), (200, 192), (222, 202), (236, 214), (236, 302), (172, 302), (170, 240)], 'y')
t.ellipse(206, 232, 30, 30, 'y')
t.part('haunch'); t.ellipse(232, 268, 20, 27, 'y')
t.part('hindpaw'); t.ellipse(226, 296, 12, 6, 'y')
t.part('tail'); t.curve([(237, 282), (232, 294), (216, 300), (200, 298), (192, 292)], 'y', w=8, w1=5)
# ---- ferne Vorderpfote
t.part('legF'); t.limb(210, 236, 208, 283, 12, 9, 'y')
t.part('pawF'); t.ellipse(207, 291, 13, 7, 'y')
# ---- Brust-Latz (weißes Fell) + nahe Vorderpfote mit Ellbogen
t.part('chest', line=False)
t.ellipse(185, 222, 20, 26, 'w')
t.poly([(166, 236), (170, 254), (175, 246), (179, 264), (184, 250), (189, 266), (193, 250), (198, 258), (201, 244), (204, 230)], 'w')
t.part('legN')
t.limb(174, 230, 167, 258, 13, 10.5, 'y')
t.limb(167, 258, 162, 284, 10.5, 9.5, 'y')
t.part('pawN'); t.ellipse(158, 291, 15, 8, 'y')
# ---- Zackenkrone/Mähne (Hu): lange Zacken oben, kürzere seitlich
t.part('mane')
mane = []
N = 25
for i in range(N):
    a = math.radians(-226 + i * (272 / (N - 1)))
    top = -math.sin(a)
    rr = (37 + 9 * max(0, top)) if i % 2 == 0 else 29
    mane.append(Q(2 + math.cos(a) * rr * 1.08, 4 + math.sin(a) * rr))
t.poly(mane, 'm')
# ---- Ohren
t.part('earF'); t.ellipse(*Q(17, -19), 7.5 * S, 8.5 * S, 'y')
t.part('earN'); t.ellipse(*Q(-15, -20), 7.5 * S, 8.5 * S, 'y')
t.part('earIn', line=False); t.ellipse(*Q(-15, -18), 4.5 * S, 5.5 * S, 'e'); t.ellipse(*Q(17, -17), 4.5 * S, 5.5 * S, 'e')
# ---- Kopf mit gezackten Wangenkrausen
t.part('head')
t.poly(P([(-22, -15), (-12, -21), (4, -22), (18, -19), (26, -11), (29, -3), (36, 3), (30, 7), (35, 13), (28, 16), (30, 23),
          (18, 25), (6, 30), (-10, 31), (-22, 27), (-31, 24), (-28, 18), (-36, 13), (-29, 8), (-33, 1), (-27, -5), (-26, -11)]), 'y')
t.part('white', line=False)
t.poly(P([(-33, 1), (-24, 4), (-18, 12), (-20, 22), (-31, 24), (-28, 18), (-36, 13), (-29, 8)]), 'w')
t.poly(P([(36, 3), (24, 4), (14, 12), (16, 24), (30, 23), (28, 16), (35, 13), (30, 7)]), 'w')
# rote Maske (Hu): Raute auf der Stirn, Nasenrücken und flammenartige Brauen
t.part('redmask', line=False)
t.poly(P([(-5, -21), (1, -14), (1, -9), (-1, 5), (-11, 5), (-11, -9), (-11, -14)]), 'r')
t.poly(P([(-10, -10), (-19, -11), (-28, -7), (-22, -6), (-12, -6)]), 'r')
t.poly(P([(0, -10), (10, -12), (24, -9), (18, -6), (0, -6)]), 'r')
# Schnauze: Kinn, Maul, Schnurrhaarpolster, Nase
t.part('chin'); t.ellipse(*Q(-6, 25), 9 * S, 5 * S, 'w')
t.part('mouth'); t.poly(P([(-19, 15), (7, 15), (3, 22), (-15, 22)]), 'M')
t.part('padL'); t.ellipse(*Q(-13, 13), 8.5 * S, 6 * S, 'w')
t.part('padR'); t.ellipse(*Q(2, 13), 8.5 * S, 6 * S, 'w')
t.part('nose'); t.poly(P([(-14, 5), (2, 5), (-2, 11), (-10, 11)]), 'N')
t.outline()
TMATS = {
    'y': mat(FUR, pillow=7, k=1.5, bias=0.06),
    'm': mat(MANE, pillow=5, k=1.8, noise=0.8, nscale=2, bias=0.05),
    'w': mat(WFUR, pillow=3, k=1.4, bias=0.08),
    'r': mat(MASK, pillow=2, k=1.2, bias=0.06),
    'e': mat(EARIN, pillow=2, k=1.2),
    'N': mat(NOSE, pillow=1.5, k=1.6, bias=0.1, spec=True, spec_col=(255, 220, 230)),
    'M': mat(MOUTH, pillow=1.5, k=1.2),
}
trgba = t.render(TMATS)
# ---- Tigerstreifen als verjüngte Pinselstriche auf das schattierte Fell
SM = np.zeros((H, W), bool)
def TS(pts, w0, w1=0.6):
    taper(SM, [Q(x, y) for (x, y) in pts], w0 * S, w1)
# Kopf: Stirnstreifen seitlich der roten Raute, Ohrrücken, Wangenkeile
TS([(4, -19), (10, -16), (14, -14)], 2.0, 0.6)
TS([(6, -15), (12, -13)], 1.8, 0.6)
TS([(-14, -19), (-19, -15), (-22, -13)], 2.0, 0.6)
TS([(-15, -15), (-20, -13)], 1.8, 0.6)
TS([(18, -18), (22, -14)], 1.6, 0.6)
TS([(-21, -24), (-17, -27)], 2.2, 1)
TS([(23, -23), (19, -26)], 2.2, 1)
for (y, dy) in [(5, 0), (11, 2), (17, 1)]:
    TS([(-34, y), (-24, y + 1 + dy)], 2.6)
    TS([(33, y - 2), (22, y - 1 + dy)], 2.6)
# Körper: spindelförmige Keile vom Rücken nach unten
def spindle(pts, w):
    taper(SM, pts[:2], 1.0, w); taper(SM, pts[1:], w, 0.6)
for i, x0 in enumerate(range(200, 240, 9)):
    top = 196 + (x0 - 178) * 0.42
    wob = 2 if i % 2 else -2
    L_ = 20 + (i % 3) * 7
    spindle([(x0 + 1, top + 2), (x0 - 1 + wob, top + L_ * 0.45), (x0 + wob * 0.5 - 2, top + L_)], 2.6)
# Flanke/Keule: geschwungene Keile von rechts
for (y0_, L_) in [(234, 16), (248, 22), (262, 24), (276, 22), (289, 14)]:
    spindle([(237, y0_ - 2), (237 - L_ * 0.5, y0_ + 3), (237 - L_, y0_ + 1)], 2.8)
# Beine: waagrechte Bänder
for y in range(240, 282, 7):
    xl = 160 + (y - 240) * -0.05
    spindle([(xl, y), (xl + 7, y + 1), (xl + 14, y - 1)], 2.4)
# Schwanz: Ringe
for x in (230, 216, 204):
    taper(SM, [(x, 290), (x - 1, 296), (x - 2, 302)], 3, 1.2)
# Streifen nur innerhalb des jeweiligen Teils (keine Überläufe über Konturen hinweg)
PID = lambda n: t.P == t.parts[n][0]
body_m = PID('body') | PID('haunch')
legF_m = PID('legF')
SMb = SM.copy()
SMb[legF_m] = False
# Umgebungsverdeckung: Körper neben dem fernen Bein etwas dunkler
occ = cv2.dilate(legF_m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & body_m & (t.L == 'y')
shift_ramp(trgba, occ, FUR, -1)
occ2 = cv2.dilate(PID('legN').astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & PID('chest') & (t.L == 'w')
shift_ramp(trgba, occ2, WFUR, -1)
recolor(trgba, SMb & (t.L == 'y'), FUR, STRIPE)
recolor(trgba, SM & (t.L == 'w') & (yy < TY + 26), WFUR, [STRIPE[2], STRIPE[3], STRIPE[4], STRIPE[5], STRIPE[5]])
# Zehen an den Pfoten
for (cx_, cy_, rx_) in [(158, 291, 15), (207, 291, 13)]:
    for k in (-1, 0, 1):
        x = int(cx_ - 4 + k * rx_ * 0.42)
        for y in range(cy_ + 1, cy_ + 7):
            if trgba[y, x, 3] and tuple(trgba[y, x, :3]) != OUT:
                trgba[y, x, :3] = FUR[0]
cv.paste(trgba, 0, 0)
# ---- Gesicht des Tigers in voller Auflösung
EYEI = [(20, 60, 90), (60, 140, 190), (140, 210, 240), (220, 250, 255)]
def tiger_eye(x0, y0, w, flip=False):
    """ruhiges, halb geschlossenes Katzenauge (Mandelform) mit Schlitzpupille"""
    for i in range(w):
        ii = (w - 1 - i) if flip else i
        X = x0 + ii
        hgt = 4 if 1 < i < w - 2 else (3 if 0 < i < w - 1 else 2)
        yo = 0 if 0 < i < w - 1 else 1
        for j in range(hgt):
            Y = y0 + yo + j
            c = EYEI[1] if j == 0 else (EYEI[2] if j < 3 else EYEI[3])
            if i in (w // 2, w // 2 - 1) and j < hgt:
                c = (10, 10, 20) if j > 0 else EYEI[0]
            px(cv, X, Y, c)
        px(cv, X, y0 + yo - 1, OUT)
        px(cv, X, y0 + yo + hgt, MASK[0])
    px(cv, x0 + (w - 3 if flip else 2), y0 + 1, (255, 255, 255))
    px(cv, (x0 - 1) if not flip else (x0 + w), y0 - 1, OUT)
    px(cv, (x0 - 2) if not flip else (x0 + w + 1), y0 - 2, OUT)
ex, ey = Q(-20, -5); tiger_eye(int(ex), int(ey), 10)
ex, ey = Q(6, -6); tiger_eye(int(ex), int(ey), 10, flip=True)
# Schnurrhaarpunkte + Schnurrhaare
for (x, y) in [(-16, 12), (-12, 14), (-18, 15), (3, 12), (6, 14), (1, 15)]:
    px(cv, *Q(x, y), WFUR[1])
for (x0, y0, dx, dy) in [(-21, 12, -1, -0.2), (-21, 15, -1, 0.05), (10, 12, 1, -0.25), (10, 15, 1, 0.0)]:
    X0, Y0 = Q(x0, y0)
    for s in range(1, 17):
        x = X0 + dx * s; y = Y0 + dy * s + (s * s) * 0.012
        if (s % 5) != 4:
            blend_px(cv, x, y, (255, 255, 250), 0.85)
# Reißzähne über der Unterlippe
for fx in (-14, 2):
    X, Y = Q(fx, 15)
    for j in range(5):
        px(cv, X, Y + 1 + j, (250, 248, 236) if j < 4 else (200, 196, 190))
        if j < 3:
            px(cv, X + 1, Y + 1 + j, (222, 218, 208))
# Glanz auf der Nase
X, Y = Q(-8, 6); px(cv, X, Y, (255, 226, 230)); px(cv, X + 1, Y, (255, 200, 210))

# ================================================================= Thorad
HAIR = [(50, 12, 8), (96, 26, 12), (150, 50, 20), (196, 84, 34), (226, 124, 60)]
CAP = [(60, 4, 10), (120, 10, 20), (190, 24, 34), (232, 56, 56), (255, 120, 110)]
COAT = [(30, 6, 12), (56, 12, 20), (86, 20, 28), (118, 34, 40), (150, 56, 56), (182, 86, 78)]
TRIM = [(110, 80, 50), (170, 136, 90), (218, 190, 136), (244, 224, 176), (255, 246, 214)]
ARMOR = [(24, 24, 32), (48, 48, 60), (78, 78, 92), (112, 112, 126), (150, 150, 164), (196, 196, 208)]
PANTS = [(80, 80, 100), (130, 130, 150), (180, 182, 198), (220, 222, 234), (246, 246, 252)]
BOOT = [(14, 10, 14), (30, 22, 26), (52, 40, 42), (80, 64, 60)]
GEM = [(10, 60, 20), (30, 130, 40), (80, 200, 70), (170, 250, 130), (240, 255, 210)]
GRIP = [(30, 16, 10), (60, 34, 20), (96, 60, 34), (130, 90, 54)]
MOUTH_T = [(50, 10, 16), (110, 30, 40), (180, 70, 70)]
HX, HY = 78, 110            # Kopfmitte Thorad
f = Fig(W, H)
# ---- Schwert auf dem Rücken: Griff mit grünem Edelstein ragt über die Schulter
f.part('grip'); f.limb(58, 138, 44, 110, 2.6, 2.4, 'G')
f.part('guard'); f.limb(49, 132, 64, 124, 2.2, 2.2, 'S')
f.part('pommel'); f.ellipse(43, 106, 4, 4.5, 'e')
# ---- Beine
f.part('legB'); f.limb(90, 238, 100, 282, 7, 6, 'p')
f.part('legF'); f.limb(68, 238, 62, 282, 7.5, 6.5, 'p')
f.part('bootB'); f.poly([(92, 278), (108, 278), (116, 289), (116, 296), (92, 296)], 'b')
f.part('bootF'); f.poly([(54, 278), (72, 278), (74, 296), (48, 296), (49, 289)], 'b')
f.part('cuffs'); f.rect(92, 277, 108, 280, 'b'); f.rect(54, 277, 72, 280, 'b')
# ---- Mantel
f.part('coatback')
f.poly([(60, 144), (100, 144), (114, 252), (98, 257), (80, 253), (60, 257), (44, 251)], 'c')
f.part('armor'); f.poly([(70, 144), (92, 144), (94, 198), (68, 198)], 'a')
f.part('belt'); f.rect(67, 194, 95, 200, 'g')
f.part('coatL'); f.poly([(58, 144), (72, 144), (70, 198), (64, 251), (44, 251), (52, 188)], 'c')
f.part('coatR'); f.poly([(90, 144), (102, 144), (108, 188), (114, 251), (96, 253), (92, 198)], 'c')
f.part('trimL'); f.poly([(70, 144), (74, 144), (72, 198), (67, 251), (63, 251), (68, 198)], 't')
f.part('trimR'); f.poly([(88, 144), (92, 144), (94, 198), (98, 253), (94, 253), (90, 198)], 't')
f.part('hem'); f.poly([(44, 248), (66, 248), (65, 255), (43, 254)], 't'); f.poly([(95, 250), (114, 248), (115, 254), (95, 256)], 't')
f.part('collar')
f.poly([(54, 140), (66, 133), (80, 146), (94, 133), (106, 140), (108, 152), (94, 146), (80, 154), (66, 146), (52, 152)], 't')
# ---- Arm hinten (hält den Unterkiefer)
f.part('armF'); f.limb(98, 150, 112, 178, 7, 6.5, 'c')
f.part('foreF'); f.limb(112, 178, 130, 204, 6.5, 6, 'c')
f.part('cuffF'); f.limb(128, 202, 133, 207, 6.2, 6.2, 't')
f.part('handF'); f.ellipse(139, 210, 6.5, 5, 's'); f.limb(136, 208, 150, 206, 3, 2.5, 's')
# ---- Hals + Kopf
f.part('neck'); f.rect(72, 124, 86, 140, 's')
f.part('hairB')
f.poly([(HX - 19, HY - 8), (HX + 16, HY - 8), (HX + 17, HY + 8), (HX - 12, HY + 12), (HX - 20, HY + 8)], 'h')
f.part('face'); f.ellipse(HX + 2, HY + 2, 17, 15, 's')
f.part('ear'); f.ellipse(HX - 14, HY + 3, 2.5, 4, 's')
f.part('beard')
f.poly([(HX - 15, HY + 4), (HX - 10, HY + 11), (HX - 2, HY + 13), (HX + 8, HY + 13), (HX + 15, HY + 11), (HX + 19, HY + 4),
        (HX + 19, HY + 14), (HX + 14, HY + 24), (HX + 7, HY + 30), (HX + 3, HY + 33), (HX - 3, HY + 29), (HX - 12, HY + 21)], 'h')
f.part('stache')
f.poly([(HX - 4, HY + 10), (HX + 3, HY + 8), (HX + 10, HY + 10), (HX + 17, HY + 14), (HX + 9, HY + 13), (HX + 3, HY + 11), (HX - 2, HY + 13), (HX - 9, HY + 14)], 'h')
f.part('mouth'); f.poly([(HX - 1, HY + 14), (HX + 9, HY + 14), (HX + 7, HY + 17), (HX + 1, HY + 17)], 'M')
f.part('sideburn'); f.poly([(HX - 15, HY - 4), (HX - 10, HY - 4), (HX - 10, HY + 6), (HX - 15, HY + 4)], 'h')
f.part('bangs')
f.poly([(HX - 15, HY - 2), (HX - 13, HY - 10), (HX + 19, HY - 10), (HX + 20, HY - 2), (HX + 16, HY - 6), (HX + 12, HY - 4), (HX + 8, HY - 7),
        (HX + 3, HY - 4), (HX - 2, HY - 7), (HX - 7, HY - 3), (HX - 10, HY - 5)], 'h')
# ---- Mütze mit Feder (Feder hinten)
f.part('plume')
f.curve([(HX - 12, HY - 17), (HX - 22, HY - 24), (HX - 32, HY - 36), (HX - 34, HY - 46)], 'C', w=9, w1=3)
f.part('cap')
f.ellipse(HX + 2, HY - 17, 22, 10, 'C')
f.poly([(HX - 20, HY - 16), (HX + 23, HY - 16), (HX + 23, HY - 8), (HX - 20, HY - 8)], 'C')
f.part('capband'); f.rect(HX - 20, HY - 11, HX + 23, HY - 7, 'k')
# ---- Arm vorne (Hand auf der Schnauze)
f.part('armN'); f.limb(66, 152, 94, 166, 7.5, 7, 'c')
f.part('foreN'); f.limb(94, 166, 118, 178, 7, 6.5, 'c')
f.part('cuffN'); f.limb(116, 177, 121, 180, 6.8, 6.8, 't')
f.part('handN'); f.ellipse(127, 181, 7, 6, 's'); f.limb(126, 177, 139, 178, 3, 2.6, 's')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.08),
    'h': mat(HAIR, pillow=3, k=1.6, noise=0.8, nscale=2),
    'C': mat(CAP, pillow=4, k=1.6, bias=0.05, noise=0.4, nscale=2),
    'k': mat(COAT, pillow=1.5, k=1.2),
    'c': mat(COAT, pillow=4, k=1.4, folds=(0.3, 0.03, 0.7), bias=0.1),
    't': mat(TRIM, pillow=2, k=1.4, bias=0.05, noise=0.6, nscale=1),
    'a': mat(ARMOR, pillow=4, k=1.8, spec=True, spec_col=(230, 230, 240)),
    'g': mat(GOLD, pillow=1.5, k=1.6, spec=True, spec_col=(255, 255, 230)),
    'p': mat(PANTS, pillow=3, k=1.4, folds=(0.05, 0.4, 0.4)),
    'b': mat(BOOT, pillow=2.5, k=1.5, spec=True, spec_col=(130, 110, 110)),
    'e': mat(GEM, pillow=2, k=1.5, spec=True),
    'G': mat(GRIP, pillow=1.5, k=1.2),
    'S': mat(SILVER, pillow=2, k=1.8, spec=True),
    'M': mat(MOUTH_T, pillow=1, k=1),
}
frgba = f.render(MATS)
cv.paste(frgba, 0, 0)

# ---------------------------------------------------------------- Gesicht Thorad
EYE_T = [(20, 40, 90), (40, 90, 170), (80, 150, 230), (170, 220, 255)]
def cool_eye(x, y, flip=False):
    # halb geschlossenes, lässiges Auge: schweres Oberlid, Iris, Glanzpunkt
    rows = ["KKKKKK", "LIIIIL", "wIGGIw", "wiGGiw", ".ijji."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            ii = 5 - i if flip else i
            c = {'K': OUT, 'L': (70, 30, 30), 'I': EYE_T[1], 'G': EYE_T[0], 'i': EYE_T[2], 'j': EYE_T[3],
                 'w': (240, 240, 250)}.get(ch)
            if c:
                px(cv, x + ii, y + j, c)
    px(cv, x + (3 if flip else 2), y + 2, (255, 255, 255))
    px(cv, x + (6 if flip else -1), y, OUT)
    px(cv, x + (7 if flip else -2), y - 1, OUT)          # Lidstrich nach außen
cool_eye(HX - 8, HY + 1)
cool_eye(HX + 8, HY + 1, flip=True)
# Brauen: vorne gerade, hinten keck hochgezogen
for i in range(7):
    px(cv, HX - 9 + i, HY - 1 + (1 if i < 2 else 0), HAIR[0])
    px(cv, HX - 9 + i, HY - 2 + (1 if i < 2 else 0), HAIR[2])
for i in range(7):
    yb = HY - 2 - (1 if 1 <= i <= 4 else 0)
    px(cv, HX + 8 + i, yb, HAIR[0]); px(cv, HX + 8 + i, yb - 1, HAIR[2])
# Nase
px(cv, HX + 5, HY + 6, SKIN[2]); px(cv, HX + 5, HY + 7, SKIN[1]); px(cv, HX + 6, HY + 8, SKIN[1]); px(cv, HX + 4, HY + 8, SKIN[2])
# breites Grinsen mit Zähnen unter dem Schnurrbart
for x in range(HX, HX + 9):
    px(cv, x, HY + 14, (250, 248, 240) if x not in (HX, HX + 8) else (200, 190, 190))
px(cv, HX + 4, HY + 14, (214, 206, 206))
blush(cv, HX - 10, HY + 7); blush(cv, HX + 13, HY + 7)

# ---------------------------------------------------------------- Blumengirlande: von Thorads Gürtel zum Hals des Tigers
garland(cv, [(95, 198), (104, 214), (118, 229), (136, 236), (154, 232), (166, 222), (180, 214), (196, 212), (210, 206)], seed=5, step=3.4,
        leaf=((26, 86, 30), (60, 146, 56)), big=True)
# kleiner Blumenkranz am Mützenband
for (x, c) in [(HX - 12, (255, 255, 255)), (HX - 6, (250, 120, 150)), (HX, (255, 214, 80)), (HX + 7, (255, 255, 255)), (HX + 14, (250, 120, 150))]:
    small_flower(cv, x, HY - 9, c)
    px(cv, x + 2, HY - 8, (40, 110, 40))
# Funkeln um die liegende Acht
for (x, y, r) in [(58, 58, 2), (104, 54, 2), (98, 80, 1), (62, 78, 1), (80, 48, 1)]:
    sparkle(cv, x, y, (255, 250, 220), r=r, c2=(255, 200, 90))

finish(cv, 'VIII', 'THORAD', out='08_strength_thorad', emblem=emblem_generic(
    [".##.##.", "#..#..#", ".##.##."], {'#': (255, 214, 96)}))
print('ok')
