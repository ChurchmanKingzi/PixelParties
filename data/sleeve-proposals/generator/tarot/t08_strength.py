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
WFUR = [(104, 92, 104), (150, 140, 150), (196, 188, 190), (228, 222, 216), (246, 242, 234), (255, 254, 250)]
MASK = [(80, 8, 20), (140, 18, 32), (196, 34, 44), (230, 72, 66), (250, 120, 100)]
NOSE = [(70, 24, 34), (120, 50, 62), (176, 88, 100), (220, 136, 146), (246, 184, 190)]
EARIN = [(120, 80, 90), (180, 140, 146), (226, 196, 196), (250, 232, 228)]
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
# ---- nahe Vorderpfote mit Ellbogen (der weiße Brustlatz wird unten als Fell-Relief gemalt)
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
# ---- Ohren (rund, innen helles Fell)
t.part('earF'); t.ellipse(*Q(18, -20), 7.5 * S, 8.5 * S, 'y')
t.part('earN'); t.ellipse(*Q(-13, -21), 7.5 * S, 8.5 * S, 'y')
t.part('earIn', line=False); t.ellipse(*Q(-13, -19), 4.5 * S, 5.5 * S, 'e'); t.ellipse(*Q(18, -18), 4.5 * S, 5.5 * S, 'e')
t.outline()
TMATS = {
    'y': mat(FUR, pillow=7, k=1.5, bias=0.06),
    'm': mat(MANE, pillow=5, k=1.8, noise=0.8, nscale=2, bias=0.05),
    'e': mat(EARIN, pillow=2, k=1.2),
}
trgba = t.render(TMATS)
# ---- Körperstreifen: geschwungene, vom Rücken her verjüngte Pinselstriche (teils gegabelt)
SM = np.zeros((H, W), bool)
for i, x0 in enumerate([194, 203, 212, 221, 230]):
    top = 196 + (x0 - 178) * 0.42
    L_ = 24 + (i % 3) * 6
    taper(SM, [(x0, top), (x0 + 3, top + L_ * 0.3), (x0 + 5, top + L_ * 0.6), (x0 + 2 + (i % 2) * 3, top + L_)], 3.8, 0.5)
    if i % 2 == 0:
        taper(SM, [(x0 + 4, top + L_ * 0.35), (x0 + 8, top + L_ * 0.55), (x0 + 9, top + L_ * 0.75)], 2.2, 0.5)
# Flanke/Keule: Bögen von hinten nach vorn
for k, (y0_, L_) in enumerate([(236, 16), (249, 22), (262, 25), (276, 22), (289, 14)]):
    taper(SM, [(238, y0_), (232, y0_ + 3), (226, y0_ + 3 - (k % 2) * 2), (238 - L_, y0_ - 2)], 3.4, 0.5)
# Vorderbein: Bänder setzen an der Hinterkante an, umlaufen das Bein und laufen spitz aus
for k, y in enumerate(range(238, 282, 7)):
    tt = (y - 230) / 54
    xl = 161 - tt * 9
    L_ = 12 + (k % 2) * 5
    taper(SM, [(xl, y + 2), (xl + L_ * 0.4, y), (xl + L_, y + 1.5)], 3.0, 0.5)
# Schwanz: Ringe
for x in (230, 216, 204):
    taper(SM, [(x, 290), (x - 1, 296), (x - 2, 302)], 3, 1.2)
PID = lambda n: t.P == t.parts[n][0]
body_m = PID('body') | PID('haunch')
legF_m = PID('legF')
SMb = SM.copy()
SMb[legF_m] = False
occ = cv2.dilate(legF_m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & body_m & (t.L == 'y')
shift_ramp(trgba, occ, FUR, -1)
recolor(trgba, SMb & (t.L == 'y'), FUR, STRIPE)
# Ohrrücken: dunkler Rand oben
for (ex_, ey_) in (Q(-13, -21), Q(18, -20)):
    for y in range(int(ey_ - 11), int(ey_ - 4)):
        for x in range(int(ex_ - 10), int(ex_ + 11)):
            if (t.L[y, x] == 'y') and (PID('earN') | PID('earF'))[y, x] and ((x - ex_) / 9.4) ** 2 + ((y - ey_) / 10.6) ** 2 > 0.55:
                trgba[y, x, :3] = STRIPE[2] if (x + y) % 3 else STRIPE[3]
# Zehen an den Pfoten
for (cx_, cy_, rx_) in [(158, 291, 15), (207, 291, 13)]:
    for k in (-1, 0, 1):
        x = int(cx_ - 4 + k * rx_ * 0.42)
        for y in range(cy_ + 1, cy_ + 7):
            if trgba[y, x, 3] and tuple(trgba[y, x, :3]) != OUT:
                trgba[y, x, :3] = FUR[0]
cv.paste(trgba, 0, 0)

# ---- Brustlatz: weißes Fell-Relief mit gezackten Rändern (hinter dem nahen Vorderbein)
Hc = np.zeros((H, W), np.float32); Mc = np.zeros((H, W), bool)
nf = noise(H, W, 2, seed=77)
for y in range(192, 272):
    ty_ = (y - 190) / 82
    cxc = 185 + (y - 196) * 0.04
    hw = 19 * math.sin(math.pi * min(0.999, 0.18 + ty_ * 0.82)) ** 0.6 + 2.0 * math.sin(y * 1.05) + 1.0 * math.sin(y * 2.3)
    for x in range(int(cxc - hw) - 1, int(cxc + hw) + 2):
        dx = (x - cxc) / max(1, hw)
        ybot = 262 + 6 * abs(math.sin((x - 160) * 0.5)) - abs(dx) * 10
        if abs(dx) <= 1 and y < ybot:
            Mc[y, x] = True
            Hc[y, x] = math.sqrt(max(0, 1 - dx * dx)) * 5 + 0.25 * math.sin(x * 0.9 + y * 0.5 + nf[y, x] * 5) + (nf[y, x] - 0.5) * 1.2 + (y - 190) * 0.02
Mc &= body_m                                # nur auf dem Körper, das Vorderbein bleibt davor
relief(cv, Hc, np.zeros((H, W), np.int32), [WFUR], Mc, k=1.0, bias=0.1)
# Übergang Fell orange -> weiß: kleine dunkle Büschel außen am Rand
ring_c = cv2.dilate(Mc.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~Mc & body_m & (t.L == 'y')
for y, x in zip(*np.where(ring_c)):
    if (x + 2 * y) % 3:
        px(cv, x, y, FUR[1])
# Schatten des Vorderbeins auf dem Latz
occ2 = cv2.dilate(PID('legN').astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & Mc
for y, x in zip(*np.where(occ2)):
    px(cv, x, y, WFUR[1] if (x + y) % 2 else WFUR[2])

# ---- Kopf als modelliertes Höhenrelief: Schädel, vorspringende Schnauze, Nasenrücken, Backenbart
hx = (xx - TX) / S; hy = (yy - TY) / S
def ell(cx_, cy_, rx_, ry_, h_):
    d = ((hx - cx_) / rx_) ** 2 + ((hy - cy_) / ry_) ** 2
    return np.where(d < 1, np.sqrt(np.maximum(0, 1 - d)) * h_, 0).astype(np.float32), d < 1
skull, mS = ell(3, -4, 24, 20, 7)
muz, mMz = ell(-12, 10, 12.5, 9.5, 6)
chin, mCh = ell(-9, 20, 8.5, 5.5, 4)
chkL, mL = ell(-21, 9, 11, 11, 4)
chkR, mR = ell(19, 8, 12, 12, 4)
jaw, mJ = ell(3, 17, 18, 10, 3)
nfh = noise(H, W, 2, seed=81)
# gezackte Backenbart-Büschel außen
tuft = np.zeros((H, W), bool)
for (bx, by, side) in [(-30, 2, -1), (-33, 8, -1), (-32, 14, -1), (-29, 20, -1), (29, 0, 1), (32, 6, 1), (32, 12, 1), (29, 18, 1)]:
    pts = P([(bx - side * 4, by - 2.5), (bx + side * 5, by + 1), (bx - side * 4, by + 3.5)])
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
    tuft |= m > 0
Hh = np.maximum.reduce([skull, np.where(mMz, muz + 5.5, 0), np.where(mCh, chin + 4.5, 0),
                        np.where(mL, chkL + 3.5, 0), np.where(mR, chkR + 3.5, 0), np.where(tuft, 2.5, 0), np.where(mJ, jaw + 2.5, 0)]).astype(np.float32)
# Nasenrücken als Grat zwischen den Augen hinunter zur Nase
ax_, ay_, bx_, by_ = -5, -12, -11, 3
dxr, dyr = bx_ - ax_, by_ - ay_
tt = np.clip(((hx - ax_) * dxr + (hy - ay_) * dyr) / (dxr * dxr + dyr * dyr), 0, 1)
dr = np.hypot(hx - (ax_ + tt * dxr), hy - (ay_ + tt * dyr))
Hh += np.where(dr < 4.2, (1 - dr / 4.2) * (1.5 + tt * 2.5), 0)
# Brauenwülste, Augenhöhlen, Fellstruktur
Hh += ell(-15, -9, 7, 2.6, 1.3)[0] + ell(7, -10, 7, 2.6, 1.3)[0]
Hh -= ell(-15, -4, 5.5, 3.2, 1.6)[0] + ell(7, -5, 5.5, 3.2, 1.6)[0]
Mh = mS | mMz | mCh | mL | mR | tuft | mJ
Hh += np.where(mL | mR | tuft, (nfh - 0.5) * 2.0, (nfh - 0.5) * 0.6)
# Materialkarte: 0 Fell, 1 weißes Fell, 2 Nase, 3 rotes Hu-Mal, 4 Streifen
Mat = np.zeros((H, W), np.int32)
white = (mMz & (hy > 3.5)) | (mMz & (hx < -19)) | mCh | ((mL | mR | tuft | mJ) & (hy > 5) & ~mMz)
white |= ell(-16, -11, 3.6, 1.8, 1)[1] | ell(7, -12, 3.6, 1.8, 1)[1]          # helle Flecken über den Augen
Mat[white] = 1
nose_m = np.zeros((H, W), np.uint8)
cv2.fillPoly(nose_m, [np.round(np.array(P([(-18.5, 2.5), (-5.5, 2.5), (-9, 7), (-12, 9), (-15, 7)]))).astype(np.int32)], 1)
Mat[nose_m > 0] = 2
# rotes Stirnmal (Hu): kleine Flammenraute + feine Winkelstreifen, in das Streifenmuster eingebettet
RM = np.zeros((H, W), bool)
taper(RM, [Q(-4, -24), Q(-4, -20), Q(-4, -16)], 0.8, 3.0)
taper(RM, [Q(-4, -16), Q(-4, -14)], 3.0, 0.6)
taper(RM, [Q(-12, -16), Q(-8, -14), Q(-5, -12)], 0.6, 1.8)
taper(RM, [Q(4, -17), Q(0, -14), Q(-3, -12)], 0.6, 1.8)
Mat[RM & Mh & (Mat == 0)] = 3
# schwarze Kopfstreifen: Stirnseiten, Schläfen, Backen
HS = np.zeros((H, W), bool)
def TS(pts, w0, w1=0.5):
    taper(HS, [Q(x, y) for (x, y) in pts], w0 * S, w1)
TS([(-20, -17), (-16, -15), (-12, -14)], 2.2)
TS([(-21, -13), (-17, -12)], 1.8)
TS([(12, -20), (8, -17), (5, -15)], 2.2)
TS([(15, -16), (10, -14)], 1.8)
TS([(-4, -26), (-4, -24)], 1.6)
TS([(22, -9), (17, -8)], 1.8)
TS([(-26, -5), (-22, -3)], 1.6)
for (y, dy) in [(3, 0), (9, 1), (15, 1), (20, 0)]:
    TS([(-35, y), (-29, y + 0.5), (-24, y + 1 + dy)], 2.4)
    TS([(34, y - 2), (28, y - 1.5), (22, y - 1 + dy)], 2.4)
Mat[HS & Mh & (Mat != 2) & (Mat != 3)] = 4
# gezackter Silhouettenrand erhält eine Umrisslinie
relief(cv, Hh, Mat, [FUR, WFUR, NOSE, MASK, STRIPE], Mh, k=0.95, bias=0.06, blur=0.8,
       albedo=np.where(Mat == 1, 0.14, 0.0))
ring_h = cv2.dilate(Mh.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~Mh
for y, x in zip(*np.where(ring_h)):
    px(cv, x, y, OUT)
# Kontur zwischen Schnauze und Wangen (nur unten, weich), Nasenumriss
edge_m = cv2.dilate(mMz.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~mMz & Mh & (hy > 8)
for y, x in zip(*np.where(edge_m)):
    px(cv, x, y, WFUR[0] if Mat[y, x] == 1 else FUR[1])
nr = cv2.dilate(nose_m, np.ones((3, 3), np.uint8)).astype(bool) & ~(nose_m > 0)
for y, x in zip(*np.where(nr & (yy >= TY + 2.5 * S))):
    px(cv, x, y, NOSE[0])
X, Y = Q(-14, 4); px(cv, X, Y, (255, 226, 230)); px(cv, X + 1, Y, (255, 206, 214)); px(cv, X, Y + 1, NOSE[3])
X, Y = Q(-15.5, 6.5); px(cv, X, Y, NOSE[0]); X, Y = Q(-8.5, 6.5); px(cv, X, Y, NOSE[0])      # Nasenlöcher
# Maul: Philtrum + geschlossene Lippenlinie ("ω"), Reißzähne ragen über die Unterlippe
def polyline(pts, c):
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for i in range(n + 1):
            px(cv, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, c)
MOUTHL = (40, 10, 18)
polyline(P([(-12, 9), (-12, 12)]), MOUTHL)
polyline(P([(-12, 12), (-15, 13.5), (-19, 13.5), (-22, 12), (-24, 12.5)]), MOUTHL)
polyline(P([(-12, 12), (-9, 13.5), (-5, 13.5), (-2, 12), (0, 12.5)]), MOUTHL)
for fx in (-18, -6):
    X, Y = Q(fx, 13.5)
    for j in range(1, 6):
        px(cv, X, Y + j, (252, 250, 240) if j < 5 else (190, 186, 180))
        if j < 4:
            px(cv, X + 1, Y + j, (214, 210, 200))
    px(cv, X - 1, Y + 1, MOUTHL); px(cv, X + 2, Y + 1, MOUTHL)
# Schnurrhaarpunkte + Schnurrhaare
for (x, y) in [(-19, 6.5), (-21, 8.5), (-17, 9), (-4, 6.5), (-2, 8.5), (-6, 9), (-20, 10.5), (-3, 10.5)]:
    px(cv, *Q(x, y), WFUR[1])
for (x0, y0, dx, dy) in [(-25, 8, -1, -0.25), (-25, 10, -1, 0.0), (-25, 12, -1, 0.2), (1, 8, 1, -0.3), (1, 10, 1, -0.1)]:
    X0, Y0 = Q(x0, y0)
    for s in range(1, 16):
        x = X0 + dx * s; y = Y0 + dy * s + (s * s) * 0.012
        if (s % 5) != 4:
            blend_px(cv, x, y, (255, 255, 250), 0.8)
# ---- Augen: ruhige, halb geschlossene Katzenaugen mit Schlitzpupille und dunklem Lidstrich
EYEI = [(20, 60, 90), (60, 140, 190), (140, 210, 240), (220, 250, 255)]
def cat_eye(cx_, cy_, w, h, flip=False):
    sgn = -1 if flip else 1
    for i in range(w):
        x = int(round(cx_ - w / 2 + i))
        tq = (i + 0.5) / w * 2 - 1                              # -1 innen .. 1 außen (bei sgn=1: links = außen)
        outer = -tq * sgn
        half = h / 2 * math.sqrt(max(0, 1 - tq * tq)) + 0.3
        yc = cy_ - outer * 1.2                                  # äußerer Winkel leicht angehoben
        top = int(round(yc - half * 0.35)); bot = int(round(yc + half))   # schweres Oberlid
        for y in range(top, bot + 1):
            f_ = (y - top) / max(1, bot - top)
            c = EYEI[1] if f_ < 0.3 else EYEI[2] if f_ < 0.75 else EYEI[3]
            if abs(x - cx_) < 0.9:
                c = (8, 8, 16)
            px(cv, x, y, c)
        px(cv, x, top - 1, OUT)
        px(cv, x, bot + 1, STRIPE[2])
    # Lidstrich zum äußeren Winkel und Tränenlinie Richtung Nase
    xo = cx_ + sgn * (-w / 2 - 1)
    px(cv, xo, cy_ - 2, OUT); px(cv, xo - sgn, cy_ - 3, OUT); px(cv, xo - 2 * sgn, cy_ - 3, OUT)
    xi = cx_ + sgn * (w / 2)
    px(cv, xi, cy_ + 1, OUT); px(cv, xi + sgn * 0.5, cy_ + 2, STRIPE[2]); px(cv, xi + sgn, cy_ + 3, STRIPE[3])
    px(cv, cx_ - 2 * sgn, cy_ - 1, (255, 255, 255))
ex, ey = Q(-15, -4); cat_eye(ex, ey, 10, 5.5)
ex, ey = Q(7, -5); cat_eye(ex, ey, 9, 5, flip=True)

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
# Finger an beiden Händen
for yf in (177, 179):
    for xf in range(131, 139):
        px(cv, xf, yf, SKIN[1])
for yf in (206, 208):
    for xf in range(142, 150):
        px(cv, xf, yf, SKIN[1])
px(cv, 124, 185, SKIN[1]); px(cv, 125, 186, SKIN[1])          # Daumen
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
