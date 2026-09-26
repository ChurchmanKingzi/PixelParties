# -*- coding: utf-8 -*-
# XXI – Die Welt: True Fairy Crestina, the Primordial Goddess
# Crestina schwebt tanzend im ovalen Lorbeerkranz mit roten Bändern, in jeder Hand einen leuchtenden Stab,
# umweht von einer violetten Schärpe. In den vier Ecken ruhen auf Wolken die vier Kardinalsbestien:
# Qinglong (Drache, oben links), Zhuque (Phönix, oben rechts), Xuanwu (Schildkröte, unten links)
# und Baihu (Tiger, unten rechts). Kosmischer Hintergrund mit Nebeln und Sternen.
from tarot_sterne_helpers import *

cv = new_card()
rnd = random.Random(21)
# ---------------------------------------------------------------- Kosmos
sky(cv, [(6, 4, 20), (14, 10, 40), (22, 18, 60), (18, 26, 64), (12, 22, 50), (8, 10, 30)])
n1 = noise(H, W, 16, seed=31, octaves=4); n2 = noise(H, W, 12, seed=32, octaves=4)
for y in range(AY0, AY1):
    for x in range(AX0, AX1):
        # türkis-grüner Urnebel (Crestinas Licht) und magentafarbene Schleier
        a = (n1[y, x] - 0.46) * 3.2
        b = (n2[y, x] - 0.52) * 3.0
        if a > 0 and BAYER4[y % 4, x % 4] < a:
            blend_px(cv, x, y, (40, 150, 150) if a < 0.55 else (110, 220, 190), 0.35)
        if b > 0 and BAYER4[y % 4, x % 4] < b * 0.9:
            blend_px(cv, x, y, (130, 50, 150) if b < 0.5 else (210, 120, 220), 0.3)
stars(cv, 320, seed=21, big=0.12, cols=[(255, 255, 255), (200, 255, 240), (230, 210, 255), (160, 200, 255)])
# ferne Galaxie-Spirale hinter dem Kranz
GX, GY = 125, 170
for i in range(1400):
    t = i / 1400 * 4 * math.pi
    for arm in (0, math.pi):
        r = 6 + t * 7.5
        a = t + arm
        x = GX + math.cos(a) * r * 1.05 + rnd.gauss(0, 2.2); y = GY + math.sin(a) * r * 0.55 + rnd.gauss(0, 1.8)
        if in_art(x, y) and rnd.random() < 0.35:
            blend_px(cv, x, y, (200, 255, 240) if r < 40 else (170, 200, 255), 0.5)
glow(cv, GX, GY, 100, (120, 255, 210), k=0.4, mix=0.22)
glow(cv, GX, GY - 20, 60, (200, 255, 240), k=0.45, mix=0.25)
# Strahlenkranz der Urgöttin
rays(cv, GX, 140, 24, 16, 92, (170, 255, 225), width=0.05, k=0.45, mix=0.28)

# ---------------------------------------------------------------- Lorbeerkranz (Oval) mit roten Bändern
WX, WY, WRX, WRY = 125, 170, 58, 101
LEAF = [(6, 30, 20), (12, 62, 36), (26, 100, 50), (52, 144, 64), (110, 196, 100), (190, 240, 170)]
RIB = [(60, 4, 16), (120, 12, 30), (180, 28, 44), (226, 60, 64), (250, 130, 120)]
wf = Fig(W, H)
wf.part('ring')
for t in np.linspace(0, 2 * math.pi, 400):
    wf.ellipse(WX + math.cos(t) * WRX, WY + math.sin(t) * WRY, 1.4, 1.4, 'b')
NL = 40
lr = random.Random(5)
def leaf(fig, x, y, ang_, L=13, Wd=3.0, name=''):
    pts = []
    for k in range(13):
        u = k / 12; w_ = Wd * math.sin(u * math.pi) ** 0.8
        pts.append((x + math.cos(ang_) * u * L - math.sin(ang_) * w_, y + math.sin(ang_) * u * L + math.cos(ang_) * w_))
    for k in range(12, -1, -1):
        u = k / 12; w_ = Wd * math.sin(u * math.pi) ** 0.8
        pts.append((x + math.cos(ang_) * u * L + math.sin(ang_) * w_, y + math.sin(ang_) * u * L - math.cos(ang_) * w_))
    fig.part(name); fig.poly(pts, 'l')
    return pts
LEAVES = []
for i in range(NL):
    t = (i + 0.5) / NL * 2 * math.pi
    x = WX + math.cos(t) * WRX; y = WY + math.sin(t) * WRY
    dx, dy = -math.sin(t) * WRX, math.cos(t) * WRY
    L_ = math.hypot(dx, dy); dx /= L_; dy /= L_
    # Blätter wachsen von unten nach oben (beide Kranzhälften treffen sich an der oberen Schleife)
    if abs(dy) > 0.2:
        sg = -1 if dy > 0 else 1
    else:
        sg = 1 if dx * (x - WX) > 0 else -1
    dx, dy = dx * sg, dy * sg
    base = math.atan2(dy, dx)
    for j, side in enumerate((-1, 1)):
        off = side * 1.5
        ox, oy = x + math.cos(t) * off, y + math.sin(t) * off
        LEAVES.append((ox, oy, base + side * 0.72 * (1 if (x - WX) * dy >= 0 else -1) + lr.uniform(-0.12, 0.12), 'l%d_%d' % (i, j)))
for (ox, oy, ang_, name) in LEAVES:
    leaf(wf, ox, oy, ang_, name=name)
wf.outline()
wreath = wf.render({'l': mat(LEAF, pillow=2, k=1.8, bias=0.1, spec=True, spec_col=(210, 255, 190)), 'b': mat(BROWN, pillow=1, k=1)})
cv.paste(wreath, 0, 0)
# Mittelrippe auf jedem Blatt
for (ox, oy, ang_, name) in LEAVES:
    for u in np.linspace(0.2, 0.75, 5):
        x = ox + math.cos(ang_) * u * 13; y = oy + math.sin(ang_) * u * 13
        if wf.L[int(round(y)), int(round(x))] == 'l':
            px(cv, x, y, LEAF[4] if u < 0.4 else LEAF[3])
# Beeren
for i in range(0, NL, 5):
    t = (i + 0.1) / NL * 2 * math.pi
    x = WX + math.cos(t) * WRX; y = WY + math.sin(t) * WRY
    if abs(math.sin(t)) < 0.95:
        px(cv, x, y, (210, 40, 60)); px(cv, x - 1, y - 1, (255, 160, 150)); px(cv, x + 1, y, (120, 10, 30)); px(cv, x, y + 1, (140, 16, 36))

def ribbon_bow(cx, cy, up):
    """rotes Band: Wicklung um den Kranz + Lemniskaten-Schleife + fliegende Enden"""
    f = Fig(W, H)
    f.part('tails')
    s = -1 if up else 1
    if up:
        f.curve([(cx - 2, cy), (cx - 10, cy + 7), (cx - 18, cy + 5), (cx - 25, cy + 12)], 'r', w=4, w1=3)
        f.curve([(cx + 2, cy), (cx + 10, cy + 7), (cx + 18, cy + 5), (cx + 25, cy + 12)], 'r', w=4, w1=3)
    else:
        f.curve([(cx - 2, cy), (cx - 10, cy + 8), (cx - 9, cy + 15), (cx - 16, cy + 22)], 'r', w=4, w1=3)
        f.curve([(cx + 2, cy), (cx + 10, cy + 9), (cx + 8, cy + 16), (cx + 15, cy + 23)], 'r', w=4, w1=3)
    f.part('loopL'); f.ellipse(cx - 7, cy, 7, 4.2, 'r'); f.ellipse(cx - 7, cy, 3, 1.4, '.')
    f.part('loopR'); f.ellipse(cx + 7, cy, 7, 4.2, 'r'); f.ellipse(cx + 7, cy, 3, 1.4, '.')
    f.part('knot'); f.ellipse(cx, cy, 3, 3.5, 'r')
    f.outline()
    cv.paste(f.render({'r': mat(RIB, pillow=2, k=1.8, spec=True, spec_col=(255, 200, 190))}), 0, 0)
    # Schwalbenschwanz-Enden

ribbon_bow(WX, WY - WRY, True)
ribbon_bow(WX, WY + WRY, False)

# ---------------------------------------------------------------- Wolken in den Ecken
CLOUD = [(60, 70, 120), (100, 120, 170), (150, 180, 220), (200, 226, 246), (240, 250, 255)]
for (cx_, cy_, w_, h_, sd) in [(40, 104, 52, 12, 1), (210, 104, 52, 12, 2), (42, 292, 54, 12, 3), (208, 292, 54, 12, 4)]:
    puffy_cloud(cv, cx_, cy_, w_, h_, CLOUD, seed=sd)

class TF:
    """Fig mit Verschiebung/Skalierung: Bestien in lokalen Koordinaten zeichnen"""
    def __init__(self, fig, ox, oy, sc=1.0, flip=1):
        self.f, self.ox, self.oy, self.sc, self.fl = fig, ox, oy, sc, flip
    def T(self, x, y):
        return (self.ox + self.fl * x * self.sc, self.oy + y * self.sc)
    def part(self, *a, **k):
        self.f.part(*a, **k)
    def ellipse(self, x, y, rx, ry, k, **kw):
        X, Y = self.T(x, y); self.f.ellipse(X, Y, rx * self.sc, ry * self.sc, k, **kw)
    def poly(self, pts, k, **kw):
        self.f.poly([self.T(*p) for p in pts], k, **kw)
    def limb(self, x0, y0, x1, y1, r0, r1, k, **kw):
        a = self.T(x0, y0); b = self.T(x1, y1); self.f.limb(a[0], a[1], b[0], b[1], r0 * self.sc, r1 * self.sc, k, **kw)
    def curve(self, pts, k, w=1.0, w1=None, **kw):
        self.f.curve([self.T(*p) for p in pts], k, w=w * self.sc, w1=None if w1 is None else w1 * self.sc, **kw)

def bolt(pts, c=(120, 240, 255), c2=(230, 255, 255)):
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        for t in np.linspace(0, 1, 12):
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            if in_art(x, y):
                px(cv, x, y, c2); blend_px(cv, x + 1, y, c, 0.7)

# ---------------------------------------------------------------- Qinglong (oben links): Blauer Drache
QL = [(30, 44, 80), (60, 86, 130), (100, 134, 180), (150, 180, 220), (200, 222, 246), (240, 248, 255)]
QB = [(120, 120, 110), (180, 176, 150), (226, 220, 190), (250, 246, 226)]
QO, QY0 = 38, 76
q = Fig(W, H); Q = TF(q, QO, QY0)
Q.part('tail'); Q.curve([(-18, 24), (-8, 30), (6, 28), (12, 22)], 'q', w=6, w1=1)
Q.part('body'); Q.curve([(-18, 24), (-10, 18), (-20, 6), (-12, -6), (0, -8)], 'q', w=10, w1=9)
Q.part('belly', line=False); Q.curve([(-14, 23), (-7, 17), (-16, 7), (-9, -3)], 'b', w=3, w1=3)
Q.part('mane', line=False)
for (x, y, dx, dy) in [(-22, 18, -7, -2), (-24, 6, -7, -4), (-18, -6, -6, -6), (-8, -12, -3, -8)]:
    Q.poly([(x, y), (x + dx, y + dy), (x + 3, y - 3)], 'm')
Q.part('claw'); Q.limb(-4, -2, 4, 8, 3, 2.4, 'q')
Q.part('horn2'); Q.poly([(2, -18), (-6, -26), (-2, -20)], 'm')
Q.part('head')
Q.ellipse(6, -12, 9, 7.5, 'q')
Q.poly([(10, -18), (25, -16), (28, -11), (13, -7)], 'q')              # Oberkiefer
Q.part('mouth'); Q.poly([(12, -8), (27, -10), (26, -4), (12, -4)], 'r')
Q.part('jaw'); Q.poly([(8, -6), (25, -4), (24, 0), (9, 0)], 'q')
Q.part('horn')                                                         # goldener Blitz-Horn (wie im Sprite)
Q.poly([(4, -18), (0, -27), (5, -27), (1, -36), (10, -25), (5, -25), (9, -17)], 'g')
Q.part('whisk', line=False)
Q.curve([(27, -12), (33, -18), (34, -26)], 'm', w=1.3)
Q.curve([(24, -2), (30, 3), (28, 10)], 'm', w=1.3)
q.outline()
cv.paste(q.render({'q': mat(QL, pillow=4, k=1.6, bias=0.1, spec=True), 'b': mat(QB, pillow=1.5, k=1.2),
                   'g': mat(GOLD, pillow=1.5, k=1.8, spec=True), 'r': mat([(60, 6, 20), (120, 20, 40), (180, 50, 60)], pillow=1.5, k=1.2),
                   'm': mat([(70, 180, 230), (130, 230, 255), (220, 255, 255)], pillow=1, k=1)}), 0, 0)
# Bauchschuppen-Linien, Auge, Zähne, Nüstern
for (x, y) in [(-14, 21), (-10, 17), (-15, 11), (-14, 5), (-11, 0)]:
    X_, Y_ = Q.T(x, y); px(cv, X_, Y_, QB[0])
X_, Y_ = Q.T(9, -14)
px(cv, X_, Y_, (255, 240, 90)); px(cv, X_ + 1, Y_, (255, 200, 40)); px(cv, X_ + 1, Y_ - 1, (20, 20, 40)); px(cv, X_, Y_ - 1, (20, 20, 40))
for xx in (15, 19, 23):
    X_, Y_ = Q.T(xx, -8); px(cv, X_, Y_, (255, 255, 255))
    X_, Y_ = Q.T(xx + 1, -4); px(cv, X_, Y_, (255, 255, 255))
X_, Y_ = Q.T(25, -15); px(cv, X_, Y_, QL[0])
# türkise Blitze um den Drachen (wie im Sprite)
bolt([(70, 46), (66, 52), (71, 55), (64, 64)])
bolt([(18, 50), (22, 57), (18, 61), (23, 68)])
bolt([(66, 86), (62, 92), (67, 95)])

# ---------------------------------------------------------------- Zhuque (oben rechts): Zinnoberroter Phönix
ZR = [(50, 14, 14), (100, 30, 28), (150, 50, 40), (200, 84, 56), (236, 136, 90)]
ZC = [(150, 110, 70), (210, 170, 110), (244, 220, 160), (255, 244, 210)]
ZB = [(10, 16, 40), (24, 40, 80), (50, 76, 130), (100, 130, 190)]
z = Fig(W, H); Z = TF(z, 208, 78)
for s_ in (-1, 1):
    Zs = TF(z, 208, 78, flip=s_)
    # Schwungfedern: jede eine eigene Fläche -> gefiederte Kontur
    for i, (ex, ey, w0) in enumerate([(28, -32, 4.2), (29, -22, 4.2), (27, -12, 4), (23, -3, 3.8), (17, 4, 3.4)]):
        Zs.part('f%d_%d' % (s_, i)); Zs.limb(4, -2, ex, ey, w0 * 0.8, 1.6, 'r')
    Zs.part('cov%d' % s_)
    Zs.poly([(3, -4), (12, -16), (20, -24), (16, -8), (8, 4)], 'r')
    Zs.part('edge%d' % s_)
    Zs.curve([(6, -8), (14, -20), (22, -28), (27, -33)], 'c', w=2.6, w1=1.4)
Z.part('tail')
for i, dx in enumerate((-6, 0, 6)):
    Z.part('t%d' % i); Z.curve([(0, 8), (dx * 1.1, 18), (dx * 1.6, 25)], 'r', w=4, w1=2)
Z.part('spirals')
for s_ in (-1, 1):
    Z.ellipse(s_ * 9, 27, 4.4, 4.2, 'd')
Z.ellipse(0, 29, 3.4, 3.4, 'd')
Z.part('body'); Z.ellipse(0, 2, 6, 9, 'r')
Z.part('breast'); Z.ellipse(0, 4, 3.6, 6, 'c')
Z.part('head'); Z.ellipse(0, -9, 4.6, 4.4, 'r')
Z.part('crest')
Z.curve([(0, -12), (-3, -18), (1, -24)], 'c', w=2.2, w1=1)
Z.curve([(1, -12), (4, -17), (7, -19)], 'c', w=1.8, w1=1)
Z.part('beak'); Z.poly([(-1.8, -7.5), (1.8, -7.5), (0, -3.5)], 'y')
z.outline()
cv.paste(z.render({'r': mat(ZR, pillow=3, k=1.5, bias=0.1), 'c': mat(ZC, pillow=2, k=1.4, bias=0.05),
                   'd': mat(ZB, pillow=2, k=1.4), 'y': mat(GOLD, pillow=1, k=1.5)}), 0, 0)
for (cx_, cy_, rr) in [(208 - 9, 105, 3.2), (208 + 9, 105, 3.2), (208, 107, 2.4)]:     # Spiralen
    for t in np.linspace(0, 3 * math.pi, 40):
        r = rr * (1 - t / (3.3 * math.pi))
        px(cv, cx_ + math.cos(t) * r, cy_ + math.sin(t) * r, ZB[3])
px(cv, 206, 68, (255, 230, 120)); px(cv, 210, 68, (255, 230, 120))
glow(cv, 208, 72, 26, (255, 150, 90), k=0.35, mix=0.2)

# ---------------------------------------------------------------- Xuanwu (unten links): Schwarze Schildkröte
SH = [(26, 28, 40), (52, 56, 74), (84, 90, 110), (122, 128, 150), (170, 176, 196), (214, 218, 232)]
XS = [(50, 44, 50), (96, 86, 90), (144, 132, 130), (186, 176, 166), (222, 214, 204)]
x_ = Fig(W, H); XT = TF(x_, 42, 282, 1.15)
XT.part('tailx'); XT.limb(-20, 0, -27, 4, 2.4, 1, 's')
XT.part('legs')
for (lx, ly) in [(-15, 3), (-1, 4), (13, 3)]:
    XT.limb(lx, ly, lx - 1, ly + 8, 3.6, 3.2, 's')
XT.part('neck'); XT.limb(16, -2, 24, -8, 4.6, 4.2, 's')
XT.part('shell')
XT.ellipse(0, 0, 22, 16, 'h', a0=180, a1=360)
XT.part('rim'); XT.poly([(-23, -1), (23, -1), (21, 4), (-21, 4)], 'k')
XT.part('head'); XT.ellipse(27, -11, 6.5, 5.5, 's')
XT.part('ears')                     # kleine Fledermausohren (wie im Sprite)
XT.poly([(23, -15), (21, -22), (26, -16)], 's'); XT.poly([(28, -16), (30, -23), (31, -15)], 's')
XT.part('snout'); XT.poly([(30, -13), (37, -11), (36, -7), (29, -7)], 's')
XT.part('mouthx'); XT.poly([(29, -8), (36, -8), (34, -5), (29, -5)], 'r')
x_.outline()
cv.paste(x_.render({'h': mat(SH, pillow=6, k=1.7, bias=0.05), 'k': mat(SH, pillow=1.5, k=1.2, bias=0.15), 's': mat(XS, pillow=3, k=1.5, bias=0.05),
                    'r': mat([(60, 6, 20), (130, 30, 50)], pillow=1, k=1)}), 0, 0)
# Panzerplatten: Sechsecke mit hellen Kanten
for (cx_, cy_, rx_, ry_) in [(0, -9, 6, 4.5), (-12, -5, 5, 4), (12, -5, 5, 4), (-19, -1, 3, 2.5), (19, -1, 3, 2.5)]:
    X0, Y0 = XT.T(cx_, cy_); rx_ *= 1.15; ry_ *= 1.15
    for k in range(6):
        a0_ = k * math.pi / 3; a1_ = (k + 1) * math.pi / 3
        for t in np.linspace(0, 1, 8):
            a = a0_ + (a1_ - a0_) * t
            xx = X0 + math.cos(a) * rx_; yy = Y0 + math.sin(a) * ry_
            if x_.L[int(round(yy)), int(round(xx))] == 'h':
                px(cv, xx, yy, SH[1] if math.sin(a) > -0.3 else SH[4])
    px(cv, X0 - 1, Y0 - 1, SH[5])
X_, Y_ = XT.T(28, -13); px(cv, X_, Y_, (255, 80, 90)); px(cv, X_ + 1, Y_, (30, 10, 14))
for xx in (31, 34):
    X_, Y_ = XT.T(xx, -8); px(cv, X_, Y_, (255, 255, 255)); px(cv, X_, Y_ + 1, (230, 230, 230))
X_, Y_ = XT.T(25, -9); blush(cv, X_, Y_, (240, 140, 160))

# ---------------------------------------------------------------- Baihu (unten rechts): Weißer Tiger
BT = [(50, 40, 90), (100, 90, 150), (150, 144, 200), (200, 198, 236), (236, 236, 252), (255, 255, 255)]
b_ = Fig(W, H)
BX, BY = 206, 266
b_.part('spikes')                    # stachelige Schnurrhaar-Büschel (wie im Sprite)
for s in (-1, 1):
    for (dy, L) in [(-4, 14), (2, 16), (8, 12)]:
        b_.poly([(BX + s * 8, BY + dy - 2), (BX + s * (10 + L), BY + dy - 1), (BX + s * 8, BY + dy + 2)], 'w')
b_.part('paws')
b_.ellipse(BX - 9, BY + 22, 6, 4, 'w'); b_.ellipse(BX + 9, BY + 22, 6, 4, 'w')
b_.part('head')
b_.ellipse(BX, BY, 12, 11, 'w')
b_.part('ears')
b_.poly([(BX - 11, BY - 5), (BX - 13, BY - 18), (BX - 4, BY - 10)], 'w'); b_.poly([(BX + 11, BY - 5), (BX + 13, BY - 18), (BX + 4, BY - 10)], 'w')
b_.part('ruff')                      # weiße Mähne
ruff = []
for i in range(15):
    a = math.pi * (0.05 + i / 14 * 0.9)
    r = 14 if i % 2 == 0 else 10
    ruff.append((BX + math.cos(a) * r * 1.2, BY + 8 + math.sin(a) * r * 0.8))
b_.poly([(BX - 14, BY + 8), (BX + 14, BY + 8)] + ruff[::-1], 'f')
b_.part('muzzle'); b_.ellipse(BX, BY + 4, 6, 4.5, 'f')
b_.part('mouth'); b_.ellipse(BX, BY + 7, 4, 3, 'm')
b_.outline()
cv.paste(b_.render({'w': mat(BT, pillow=3, k=1.5, bias=0.02), 'f': mat(WHITE_CLOTH, pillow=3, k=1.4, noise=0.8, nscale=2),
                    'm': mat([(40, 4, 14), (100, 10, 30), (160, 30, 50)], pillow=2, k=1.3)}), 0, 0)
# Streifen, rote Augen, Zähne
for s in (-1, 1):
    for (dx, dy) in [(3, -10), (3, -9), (4, -8), (8, -7), (9, -6), (9, -5), (10, -1), (11, 0), (11, 2), (10, 3)]:
        px(cv, BX + s * dx, BY + dy, BT[0])
    px(cv, BX, BY - 9, BT[0]); px(cv, BX, BY - 8, BT[0]); px(cv, BX - 1, BY - 10, BT[0]); px(cv, BX + 1, BY - 10, BT[0])
    ex = BX + s * 5
    px(cv, ex, BY - 2, (240, 40, 50)); px(cv, ex - s, BY - 2, (140, 10, 20)); px(cv, ex, BY - 3, (40, 10, 30)); px(cv, ex - s, BY - 3, (40, 10, 30))
    px(cv, BX + s * 3, BY + 5, (255, 255, 255)); px(cv, BX + s * 3, BY + 6, (255, 255, 255))
    px(cv, BX + s * 2, BY + 10, (255, 255, 255))
px(cv, BX, BY + 1, (60, 20, 50)); px(cv, BX - 1, BY + 1, (60, 20, 50)); px(cv, BX + 1, BY + 1, (60, 20, 50))
for dx in (-10, -8, 8, 10):          # Krallen
    px(cv, BX + dx, BY + 25, BT[0])

# ---------------------------------------------------------------- Crestina
HAIRC = [(10, 10, 34), (20, 24, 70), (34, 44, 110), (50, 80, 150), (80, 150, 190), (150, 230, 240)]
DRESS = [(8, 40, 54), (16, 80, 96), (30, 130, 136), (70, 190, 172), (150, 236, 210), (224, 255, 240)]
SASH = [(60, 20, 80), (110, 50, 140), (160, 96, 200), (206, 150, 236), (240, 210, 255)]
WINGC = [(70, 120, 160), (120, 190, 220), (180, 236, 250), (226, 252, 255), (255, 255, 255)]
STAFF = [(40, 30, 16), (90, 64, 30), (150, 110, 50), (210, 170, 90), (250, 230, 160)]
CX0 = 125
glow(cv, CX0, 150, 64, (140, 255, 210), k=0.55, mix=0.3)

# ---- Flügel (durchscheinend, hinter der Figur)
wg = Fig(W, H)
wg.part('up')
wg.poly([(123, 134), (112, 118), (100, 104), (88, 98), (82, 104), (84, 118), (94, 132), (108, 140)], 'w', mirror=True)
wg.part('low')
wg.poly([(123, 140), (108, 146), (94, 156), (88, 168), (94, 174), (106, 168), (118, 154)], 'w', mirror=True)
wg.outline()
wr = wg.render({'w': mat(WINGC, pillow=6, k=1.1, bias=0.12)}, outline_col=(120, 200, 230))
for y, x in zip(*np.where(wr[..., 3] > 0)):
    c = tuple(int(v) for v in wr[y, x, :3])
    blend_px(cv, x, y, c, 0.8 if BAYER4[y % 4, x % 4] < 0.7 else 0.45)
# Adern in den Flügeln
for s in (1, -1):
    for (ex, ey) in [(88, 100), (84, 112), (92, 128), (92, 162), (100, 170)]:
        for t in np.linspace(0.1, 0.92, 24):
            x = 124 + (ex - 124) * t; y = 138 + (ey - 138) * t
            xx = x if s == 1 else 250 - x
            if wr[int(y), int(round(xx)), 3]:
                px(cv, xx, y, (170, 240, 255))

# ---- Figur
f = Fig(W, H)
# hinteres Schärpenende (weht links hinter ihr)
f.part('sashback')
f.curve([(113, 136), (104, 140), (96, 150), (98, 164), (92, 178), (96, 190)], 'v', w=4, w1=1.6)
# Haar hinten (fällt bis auf die Schultern)
f.part('hairback')
f.poly([(111, 110), (106, 128), (108, 146), (116, 140), (125, 136), (134, 140), (142, 146), (144, 128), (139, 110)], 'h')
# gebeugtes Bein (hinter dem Standbein, klassische "4"-Pose)
f.part('legB')
f.limb(129, 182, 141, 202, 5.8, 4.6, 's')
f.limb(141, 202, 127, 218, 4.4, 3.4, 's')
f.poly([(127, 215), (120, 220), (123, 223), (130, 219)], 's')
# Standbein
f.part('legF')
f.limb(121, 182, 119, 208, 6, 4.6, 's')
f.limb(119, 208, 118, 234, 4.4, 3.2, 's')
f.poly([(115, 232), (121, 232), (120, 242), (117, 245)], 's')
# Kleid: Mieder + wehender Rock
f.part('skirt')
f.poly([(115, 158), (135, 158), (142, 172), (152, 186), (144, 190), (136, 186), (128, 192), (120, 186), (110, 190), (104, 184), (112, 172)], 'd')
f.part('bodice')
f.poly([(116, 136), (134, 136), (136, 148), (134, 160), (116, 160), (114, 148)], 'd')
f.part('neck'); f.rect(122, 126, 128, 137, 's')
# Arme + Stäbe
f.part('staffR')                     # rechter Stab (erhoben)
f.limb(166, 132, 158, 78, 1.6, 1.6, 't')
f.part('armR')
f.limb(135, 139, 150, 128, 3.6, 3, 's')
f.limb(150, 128, 160, 112, 3, 2.6, 's')
f.part('handR'); f.ellipse(161, 109, 3.4, 3.2, 's')
f.part('staffL')                     # linker Stab (gesenkt)
f.limb(84, 190, 94, 138, 1.6, 1.6, 't')
f.part('armL')
f.limb(115, 139, 104, 152, 3.6, 3, 's')
f.limb(104, 152, 92, 162, 3, 2.6, 's')
f.part('handL'); f.ellipse(90, 163, 3.4, 3.2, 's')
# Schärpe: um die Taille geschlungen, weht zu beiden Seiten
f.part('sash')
f.curve([(113, 136), (122, 146), (134, 157), (146, 162), (156, 174), (152, 188), (160, 202), (157, 214)], 'v', w=4.5, w1=2)
# Kopf
f.part('face')
f.ellipse(125, 116, 12, 12, 's')
f.poly([(114, 118), (136, 118), (131, 127), (125, 130), (119, 127)], 's')
f.part('crown')                      # dunkles, sternförmig abstehendes Haar (wie im Sprite)
for (a, L) in [(-160, 9), (-135, 13), (-110, 12), (-90, 15), (-70, 12), (-45, 13), (-20, 9)]:
    ar = math.radians(a)
    bx, by = 125 + math.cos(ar) * 10, 112 + math.sin(ar) * 10
    tx, ty = 125 + math.cos(ar) * (10 + L), 112 + math.sin(ar) * (10 + L)
    f.poly([(bx - math.sin(ar) * 3.4, by + math.cos(ar) * 3.4), (tx, ty), (bx + math.sin(ar) * 3.4, by - math.cos(ar) * 3.4)], 'h')
f.ellipse(125, 110, 14, 9, 'h', keep='s')
f.part('bangs')
f.poly([(111, 122), (112, 107), (118, 101), (125, 99), (132, 101), (138, 107), (139, 122), (136, 112), (133, 115), (130, 108),
        (127, 113), (124, 106), (121, 113), (118, 108), (115, 115), (113, 112)], 'h')
f.part('locks')
f.poly([(112, 112), (107, 126), (109, 138), (113, 128)], 'h'); f.poly([(138, 112), (143, 126), (141, 138), (137, 128)], 'h')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.12),
    'h': mat(HAIRC, pillow=4, k=1.7, noise=0.8, nscale=2, bias=0.05),
    'd': mat(DRESS, pillow=4, k=1.5, folds=(0.5, 0.1, 0.6)),
    'v': mat(SASH, pillow=2, k=1.5, folds=(0.4, 0.4, 0.5)),
    't': mat(STAFF, pillow=1.2, k=1.6, spec=True),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)
FM = fig[..., 3] > 0
# Licht-Kontur (lavendel-türkiser Schein um die Silhouette, wie der Rand im Sprite)
ring = np.zeros_like(FM)
ring[1:] |= FM[:-1]; ring[:-1] |= FM[1:]; ring[:, 1:] |= FM[:, :-1]; ring[:, :-1] |= FM[:, 1:]
ring &= ~FM
for y, x in zip(*np.where(ring)):
    if in_art(x, y) and BAYER4[y % 4, x % 4] < 0.7:
        blend_px(cv, x, y, (170, 255, 230), 0.55)
# Gesicht
anime_eye(cv, 117, 117, (40, 210, 230), h=7, w=5)
anime_eye(cv, 128, 117, (40, 210, 230), h=7, w=5, flip=True)
px(cv, 125, 123, SKIN[2])
for x in (123, 124, 125, 126, 127):
    px(cv, x, 126, (180, 70, 80) if x in (124, 125, 126) else SKIN[1])
px(cv, 125, 127, (230, 120, 130))
blush(cv, 115, 123); blush(cv, 132, 123)
# Glanz im Haar
for x in range(116, 135):
    y = 104 - int(2 * math.sin((x - 116) / 19 * math.pi))
    if x % 3 and FM[y, x] and tuple(cv.a[y, x]) != OUT:
        px(cv, x, y, HAIRC[5] if x % 3 == 1 else HAIRC[4])
# leuchtende Kristalle an den Stabenden (Urlicht der Schöpfung)
for (sx, sy) in [(158, 78), (166, 132), (94, 138), (84, 190)]:
    glow(cv, sx, sy, 8, (160, 255, 200), k=0.8, mix=0.35)
    for (dx, dy, c) in [(0, -2, (230, 255, 240)), (-1, -1, (160, 255, 200)), (0, -1, (200, 255, 230)), (1, -1, (80, 200, 150)),
                        (-1, 0, (120, 240, 180)), (0, 0, (255, 255, 255)), (1, 0, (60, 170, 130)), (0, 1, (80, 200, 150)), (0, 2, (40, 140, 110))]:
        px(cv, sx + dx, sy + dy, c)
    sparkle(cv, sx, sy - 5, (240, 255, 250), r=2, c2=(120, 230, 190))
# Diadem mit grünem Stern
sparkle(cv, 125, 101, (170, 255, 200), r=2, c2=(60, 180, 130)); px(cv, 125, 101, (255, 255, 255))
# Sternenstaub, der um sie kreist
for i in range(26):
    t = i / 26 * 2 * math.pi
    x = CX0 + math.cos(t) * 44; y = 170 + math.sin(t) * 86
    if not FM[int(y), int(x)] and rnd.random() < 0.7:
        sparkle(cv, x, y, (230, 255, 245), r=1, c2=(120, 220, 200))
glitter(cv, 50, (AX0, AY0, AX1, AY1), seed=9, mask=~FM, cols=[(255, 255, 255), (200, 255, 240), (230, 210, 255)])

finish(cv, 'XXI', 'CRESTINA', out='21_world_crestina', emblem=emblem_generic(
    [".###.", "#...#", "#.#.#", "#...#", ".###."], {'#': (120, 220, 130)}))
print('ok')
