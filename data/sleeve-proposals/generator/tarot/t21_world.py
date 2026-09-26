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

# ---------------------------------------------------------------- Wolken in den Ecken (Sitz der vier Bestien)
CLOUD = [(60, 70, 120), (100, 120, 170), (150, 180, 220), (200, 226, 246), (240, 250, 255)]
for (cx_, cy_, w_, h_, sd) in [(40, 122, 60, 13, 1), (212, 134, 60, 13, 2), (46, 300, 70, 13, 3), (204, 302, 76, 13, 4)]:
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


def clip_paste(rgba):
    """nur innerhalb des Bildfelds einfügen"""
    rgba = rgba.copy()
    m = np.zeros(rgba.shape[:2], bool); m[AY0:AY1, AX0:AX1] = True
    rgba[~m, 3] = 0
    cv.paste(rgba, 0, 0)
    return rgba


def bolt(pts, c=(120, 240, 255), c2=(230, 255, 255)):
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        for t in np.linspace(0, 1, 14):
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            if in_art(x, y):
                px(cv, x, y, c2); blend_px(cv, x + 1, y, c, 0.7); blend_px(cv, x - 1, y, c, 0.35)


def scale_pattern(fig, keys, dark, light, box, step=4, mask_fn=None):
    """Schuppen: versetzte Bögen, gedithert auf die Fläche gesetzt"""
    x0, y0, x1, y1 = box
    for y in range(max(AY0, y0), min(AY1, y1)):
        for x in range(max(AX0, x0), min(AX1, x1)):
            if fig.L[y, x] not in keys or tuple(cv.a[y, x]) == OUT:
                continue
            if mask_fn is not None and not mask_fn(x, y):
                continue
            row = y // 3
            u = (x + (row % 2) * (step // 2)) % step
            v = y % 3
            if v == 0 and u in (1, 2):
                px(cv, x, y, dark)
            elif v == 2 and u == 0:
                px(cv, x, y, dark)
            elif v == 1 and u == 2 and BAYER4[y % 4, x % 4] < 0.5:
                px(cv, x, y, light)


# ---------------------------------------------------------------- Qinglong (oben links): Blauer Drache
QL = [(30, 44, 80), (60, 86, 130), (100, 134, 180), (150, 180, 220), (200, 222, 246), (240, 248, 255)]
QB = [(120, 120, 110), (180, 176, 150), (226, 220, 190), (250, 246, 226)]
q = Fig(W, H); Q = TF(q, 44, 92, 1.4)
Q.part('tail'); Q.curve([(-18, 24), (-8, 30), (6, 28), (12, 22)], 'q', w=6, w1=1)
Q.part('tailfin', line=False); Q.poly([(11, 23), (17, 16), (15, 25), (19, 28)], 'm')
Q.part('body'); Q.curve([(-18, 24), (-10, 18), (-20, 6), (-12, -6), (0, -8)], 'q', w=10, w1=9)
Q.part('belly', line=False); Q.curve([(-14, 23), (-7, 17), (-16, 7), (-9, -3)], 'b', w=3, w1=3)
Q.part('mane', line=False)
for (x, y, dx, dy) in [(-22, 18, -7, -2), (-24, 6, -7, -4), (-18, -6, -6, -6), (-8, -12, -3, -8), (-2, -16, 0, -7)]:
    Q.poly([(x, y), (x + dx, y + dy), (x + 3, y - 3)], 'm')
Q.part('claw'); Q.limb(-4, -2, 4, 8, 3, 2.4, 'q')
Q.part('talon')
for k_ in (-1, 0, 1):
    Q.limb(4, 8, 7 + k_ * 1.5, 11 + abs(k_), 1, 0.6, 'g')
Q.part('horn2'); Q.poly([(2, -18), (-6, -26), (-2, -20)], 'm')
Q.part('head')
Q.ellipse(6, -12, 9, 7.5, 'q')
Q.poly([(10, -18), (25, -16), (28, -11), (13, -7)], 'q')              # Oberkiefer
Q.part('brow'); Q.poly([(4, -17), (13, -18), (11, -15), (5, -14)], 'm')
Q.part('mouth'); Q.poly([(12, -8), (27, -10), (26, -4), (12, -4)], 'r')
Q.part('jaw'); Q.poly([(8, -6), (25, -4), (24, 0), (9, 0)], 'q')
Q.part('horn')                                                         # goldener Blitz-Horn (wie im Sprite)
Q.poly([(4, -18), (0, -27), (5, -27), (1, -36), (10, -25), (5, -25), (9, -17)], 'g')
Q.part('whisk', line=False)
Q.curve([(27, -12), (33, -18), (34, -26)], 'm', w=1.1)
Q.curve([(24, -2), (30, 3), (28, 10)], 'm', w=1.1)
q.outline()
clip_paste(q.render({'q': mat(QL, pillow=4, k=1.6, bias=0.1, spec=True), 'b': mat(QB, pillow=1.5, k=1.2, folds=(0.0, 1.6, 0.4)),
                     'g': mat(GOLD, pillow=1.5, k=1.8, spec=True), 'r': mat([(60, 6, 20), (120, 20, 40), (180, 50, 60)], pillow=1.5, k=1.2),
                     'm': mat([(70, 180, 230), (130, 230, 255), (220, 255, 255)], pillow=1, k=1)}))
hx_, hy_ = Q.T(6, -12)
scale_pattern(q, ['q'], QL[1], QL[4], (AX0, 50, 100, 140), mask_fn=lambda x, y: math.hypot(x - hx_, y - hy_) > 11 and y < Q.T(0, 20)[1] + 20)
# Auge, Zähne, Nüstern
X_, Y_ = Q.T(9, -14)
for (dx, dy, c) in [(0, 0, (255, 240, 90)), (1, 0, (255, 200, 40)), (0, 1, (230, 170, 30)), (1, 1, (20, 20, 40)), (-1, 0, (20, 20, 40)), (2, -1, (20, 20, 40)), (0, -1, (20, 20, 40)), (1, -1, (20, 20, 40))]:
    px(cv, X_ + dx, Y_ + dy, c)
for xx in (15, 19, 23):
    X_, Y_ = Q.T(xx, -9); px(cv, X_, Y_, (255, 255, 255)); px(cv, X_, Y_ + 1, (220, 220, 230))
    X_, Y_ = Q.T(xx + 1, -4); px(cv, X_, Y_, (255, 255, 255)); px(cv, X_, Y_ - 1, (220, 220, 230))
X_, Y_ = Q.T(25, -15); px(cv, X_, Y_, QL[0]); px(cv, X_ + 1, Y_, QL[0])
# türkise Blitze um den Drachen (wie im Sprite)
bolt([(84, 44), (79, 52), (85, 55), (77, 66)])
bolt([(20, 46), (25, 55), (20, 60), (26, 70)])
bolt([(86, 100), (80, 108), (86, 112)])

# ---------------------------------------------------------------- Zhuque (oben rechts): Zinnoberroter Phönix
ZR = [(50, 14, 14), (100, 30, 28), (150, 50, 40), (200, 84, 56), (236, 136, 90), (255, 190, 130)]
ZC = [(150, 110, 70), (210, 170, 110), (244, 220, 160), (255, 244, 210)]
ZB = [(10, 16, 40), (24, 40, 80), (50, 76, 130), (100, 130, 190)]
ZX, ZY, ZS = 204, 90, 1.38
z = Fig(W, H); Z = TF(z, ZX, ZY, ZS)
FEATH = [(28, -32, 4.4), (29, -22, 4.4), (27, -12, 4.2), (23, -3, 4), (17, 4, 3.6)]
for s_ in (-1, 1):
    Zs = TF(z, ZX, ZY, ZS, flip=s_)
    Zs.part('membrane%d' % s_)            # geschlossene Flügelfläche unter den Schwungfedern
    Zs.poly([(3, -3)] + [(4 + (ex - 4) * 0.72, -2 + (ey + 2) * 0.72) for (ex, ey, w0) in FEATH] + [(8, 4)], 'o')
    for i, (ex, ey, w0) in enumerate(FEATH):
        Zs.part('f%d_%d' % (s_, i)); Zs.limb(4, -2, ex, ey, w0 * 0.8, 1.6, 'r')
    Zs.part('sec%d' % s_)                    # Armschwingen (kürzere Federreihe)
    for i, (ex, ey) in enumerate([(20, -20), (19, -11), (16, -3), (12, 3)]):
        Zs.part('s%d_%d' % (s_, i)); Zs.limb(4, -2, ex, ey, 3.2, 1.6, 'o')
    Zs.part('cov%d' % s_)
    Zs.poly([(3, -4), (12, -16), (18, -22), (14, -8), (8, 3)], 'c2')
    Zs.part('edge%d' % s_)
    Zs.curve([(6, -8), (14, -20), (22, -28), (27, -33)], 'c', w=2.6, w1=1.4)
for i, (dx, ln) in enumerate([(-10, 22), (-5, 26), (0, 28), (5, 26), (10, 22)]):
    Z.part('t%d' % i); Z.curve([(dx * 0.2, 8), (dx * 0.6, 8 + ln * 0.5), (dx * 1.3, 8 + ln)], 'o' if i % 2 else 'r', w=5, w1=1.6)
Z.part('spirals')
for (dx, ln) in [(-10, 22), (0, 28), (10, 22)]:
    Z.ellipse(dx * 1.3, 8 + ln + 1, 3.6, 3.4, 'd')
Z.part('body'); Z.ellipse(0, 2, 6, 9, 'r')
Z.part('breast'); Z.ellipse(0, 3, 3, 4.6, 'c')
Z.part('head'); Z.ellipse(0, -9, 4.6, 4.4, 'r')
Z.part('crest')
Z.curve([(0, -12), (-3, -18), (1, -24)], 'o', w=2.6, w1=1)
Z.curve([(1, -12), (4, -17), (7, -19)], 'o', w=2.2, w1=1)
Z.curve([(-1, -12), (-5, -15), (-7, -14)], 'o', w=1.8, w1=1)
Z.part('beak'); Z.poly([(-1.8, -7.5), (1.8, -7.5), (0, -3.5)], 'y')
z.outline()
clip_paste(z.render({'r': mat(ZR, pillow=3, k=1.5, bias=0.1), 'o': mat(ZR, pillow=2, k=1.4, bias=0.2),
                     'c': mat(ZC, pillow=2, k=1.4, bias=0.05), 'c2': mat(ZR, pillow=3, k=1.4, bias=0.1),
                     'd': mat(ZB, pillow=2, k=1.4), 'y': mat(GOLD, pillow=1, k=1.5)}))
# Federkiele + gedithertes Federmuster
for s_ in (-1, 1):
    Zs = TF(z, ZX, ZY, ZS, flip=s_)
    for (ex, ey, w0) in FEATH:
        for t in np.linspace(0.25, 0.92, 22):
            x, y = Zs.T(4 + (ex - 4) * t, -2 + (ey + 2) * t)
            if in_art(x, y) and tuple(cv.a[int(round(y)), int(round(x))]) != OUT:
                px(cv, x, y, ZR[5] if t < 0.6 else ZR[4])
scale_pattern(z, ['c2'], ZR[2], ZR[5], (150, 44, AX1, 110), step=4)
for (cx_, cy_, rr) in [(-13, 31, 3.5), (13, 31, 3.5), (0, 37, 3.3)]:     # Spiralen in den Schwanzfedern
    X0, Y0 = Z.T(cx_, cy_)
    for t in np.linspace(0, 3 * math.pi, 50):
        r = rr * ZS * (1 - t / (3.3 * math.pi))
        px(cv, X0 + math.cos(t) * r, Y0 + math.sin(t) * r, ZB[3])
X_, Y_ = Z.T(0, -10)
px(cv, X_ - 3, Y_, (255, 230, 120)); px(cv, X_ + 3, Y_, (255, 230, 120)); px(cv, X_ - 3, Y_ + 1, (40, 10, 10)); px(cv, X_ + 3, Y_ + 1, (40, 10, 10))
glow(cv, ZX, ZY - 6, 30, (255, 150, 90), k=0.35, mix=0.2)
for (x, y) in [(176, 60), (228, 100), (190, 110), (222, 52)]:     # Glutfunken
    sparkle(cv, x, y, (255, 220, 150), r=1, c2=(230, 120, 60))

# ---------------------------------------------------------------- Xuanwu (unten links): Schildkröte mit Schlange
SH = [(24, 26, 36), (46, 50, 66), (74, 80, 100), (108, 116, 136), (150, 158, 178), (196, 202, 218)]
XS = [(44, 40, 46), (86, 80, 84), (130, 122, 120), (174, 166, 156), (214, 206, 196)]
SN = [(6, 8, 16), (14, 22, 32), (28, 42, 56), (50, 72, 84), (90, 120, 120)]
SNB = [(120, 100, 30), (190, 160, 60), (236, 214, 120)]
TX_, TY_ = 50, 280                       # Panzermitte (Unterkante)
# Schlangenschwanz hinter dem Panzer
sb = Fig(W, H)
sb.part('snakeback'); sb.curve([(40, 298), (22, 296), (14, 284), (16, 268), (24, 258)], 's', w=5.5, w1=5)
sb.outline()
clip_paste(sb.render({'s': mat(SN, pillow=2, k=1.5, bias=0.08)}))
# Beine, Hals, Kopf, Schwanz
x_ = Fig(W, H)
x_.part('tailx'); x_.limb(TX_ - 26, TY_ + 1, TX_ - 34, TY_ + 6, 3, 1, 's')
x_.part('legB'); x_.limb(TX_ - 18, TY_ + 1, TX_ - 27, TY_ + 12, 5, 4, 's'); x_.ellipse(TX_ - 28, TY_ + 14, 5, 2.6, 's')
x_.part('legF'); x_.limb(TX_ + 20, TY_ + 1, TX_ + 29, TY_ + 11, 5.4, 4.4, 's'); x_.ellipse(TX_ + 31, TY_ + 13, 5.4, 2.8, 's')
x_.part('plastron'); x_.ellipse(TX_, TY_ + 6, 24, 4, 'p')
x_.part('neck'); x_.limb(TX_ + 26, TY_ - 6, TX_ + 36, TY_ - 16, 6, 5.4, 's')
x_.part('head')
x_.ellipse(TX_ + 41, TY_ - 21, 7.5, 6.4, 's')
x_.ellipse(TX_ + 47, TY_ - 20, 5.5, 4.4, 's')             # stumpfe Schildkrötenschnauze
x_.part('ears')                          # kleine Fledermausohren (wie im Sprite)
x_.poly([(TX_ + 36, TY_ - 25), (TX_ + 35, TY_ - 30), (TX_ + 39, TY_ - 26)], 's')
x_.part('mouthx'); x_.poly([(TX_ + 45, TY_ - 18), (TX_ + 52, TY_ - 19), (TX_ + 50, TY_ - 16), (TX_ + 45, TY_ - 16)], 'r')
x_.outline()
clip_paste(x_.render({'s': mat(XS, pillow=3, k=1.5, bias=0.05), 'r': mat([(60, 6, 20), (130, 30, 50)], pillow=1, k=1),
                      'p': mat([(120, 100, 60), (180, 160, 100), (226, 210, 150)], pillow=2, k=1.3)}))
scale_pattern(x_, ['s'], XS[1], XS[3], (AX0, 250, 110, AY1))
# Panzer als Relief: gewölbte Kuppel mit sechseckigen Platten (Voronoi auf Sechseckgitter)
yy, xx = np.indices((H, W)).astype(np.float32)
RX, RY = 31, 24
rim_y = lambda x: TY_ + 3 * (1 - min(1, ((x - TX_) / RX) ** 2))      # Randlinie: in der Mitte tiefer (Wölbung)
dome = ((xx - TX_) / RX) ** 2 + ((yy - TY_ - 2) / RY) ** 2
Msh = (dome <= 1) & (yy <= TY_ + 3 * (1 - np.minimum(1, ((xx - TX_) / RX) ** 2)))
cents = []
for j in range(-4, 2):
    for i in range(-6, 7):
        cents.append((TX_ + i * 9 + (4.5 if j % 2 else 0), TY_ + j * 7.5 + 2))
cents = np.array(cents, np.float32)
D = np.stack([np.hypot((xx - cx_) * 1.0, (yy - cy_) * 1.2) for (cx_, cy_) in cents])
Ds = np.sort(D, axis=0)
edge = Ds[1] - Ds[0]
Hsh = np.sqrt(np.clip(1 - dome, 0, 1)) * 6 + np.minimum(edge, 3) * 0.55 + (noise(H, W, 2, seed=44) - 0.5) * 0.5
Msh &= (yy >= AY0) & (xx >= AX0)
relief(cv, Hsh, np.zeros((H, W), np.int32), [SH], Msh, k=1.2, bias=0.06)
for y, x in zip(*np.where(Msh)):
    if edge[y, x] < 1.0:
        px(cv, x, y, SH[0] if (x + y) % 3 else SH[1])
# Panzerrand (heller Saum mit Kerben) + Umriss
for x in range(TX_ - RX, TX_ + RX + 1):
    ry_ = int(round(rim_y(x)))
    for k in range(-1, 4):
        y = ry_ + k
        if in_art(x, y):
            px(cv, x, y, OUT if k == 3 else (SH[4] if k == -1 else rampc(SH, 0.75 - k * 0.12, x, y)))
    if x % 6 == 0 and in_art(x, ry_ + 1):
        px(cv, x, ry_ + 1, SH[1]); px(cv, x, ry_ + 2, SH[1])
ring = cv2.dilate(Msh.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
for y, x in zip(*np.where(ring & ~Msh)):
    if in_art(x, y) and y < rim_y(x):
        px(cv, x, y, OUT)
# Schlange windet sich über den Panzer, Kopf erhoben – Blick zur Schildkröte (klassisches Xuanwu-Motiv)
sn = Fig(W, H)
sn.part('snake')
sn.curve([(24, 258), (36, 254), (48, 262), (60, 256), (70, 250), (74, 240), (70, 230)], 's', w=5.5, w1=4.5)
sn.part('snakehead')
sn.ellipse(74, 225, 5, 3.8, 's')
sn.poly([(76, 222), (83, 224), (82, 228), (76, 229)], 's')
sn.part('tongue', line=False); sn.curve([(83, 226), (87, 228), (89, 227)], 'r', w=1)
sn.outline()
clip_paste(sn.render({'s': mat(SN, pillow=2.5, k=1.6, bias=0.1, spec=True), 'r': mat([(160, 20, 30), (230, 60, 60)], pillow=1)}))
scale_pattern(sn, ['s'], SN[1], SN[4], (20, 216, 92, 270), step=3)
# gelbes Bauchband der Schlange
for (x, y) in bezier((25, 260), (48, 266), (68, 252), 26):
    if tuple(cv.a[int(y), int(x)]) != OUT:
        px(cv, x, y, SNB[1] if int(x) % 2 else SNB[2])
px(cv, 77, 224, (255, 220, 60)); px(cv, 78, 224, (20, 10, 10))
# Schildkröte: rotes Auge, Fangzähne, Nüstern, Wangenröte
px(cv, TX_ + 42, TY_ - 23, (255, 80, 90)); px(cv, TX_ + 43, TY_ - 23, (30, 10, 14)); px(cv, TX_ + 42, TY_ - 24, (30, 10, 14))
for xx_ in (TX_ + 47, TX_ + 50):
    px(cv, xx_, TY_ - 18, (255, 255, 255)); px(cv, xx_, TY_ - 17, (220, 220, 230))
px(cv, TX_ + 51, TY_ - 21, XS[0])
blush(cv, TX_ + 38, TY_ - 18, (240, 140, 160))
for (lx, ly) in [(TX_ - 29, TY_ + 15), (TX_ + 32, TY_ + 14)]:      # Krallen
    for k_ in (-2, 0, 2):
        px(cv, lx + k_, ly + 1, (230, 222, 206)); px(cv, lx + k_, ly + 2, (120, 110, 100))

# ---------------------------------------------------------------- Baihu (unten rechts): Weißer Tiger
BT = [(60, 56, 90), (116, 114, 158), (176, 176, 212), (222, 222, 244), (246, 246, 255), (255, 255, 255)]
STR = (26, 20, 38)
b_ = Fig(W, H)
b_.part('tail'); b_.curve([(222, 282), (232, 272), (232, 258), (224, 248), (218, 246)], 'w', w=5.5, w1=3.2)
b_.part('legBack'); b_.limb(174, 280, 170, 295, 4.6, 4, 'w'); b_.ellipse(166, 296, 5.5, 3, 'w')
b_.part('body'); b_.ellipse(198, 279, 25, 12.5, 'w')
b_.part('haunch'); b_.ellipse(215, 281, 12, 11, 'w')
b_.part('hindpaw'); b_.ellipse(207, 295, 9, 3.6, 'w')
b_.part('chest'); b_.poly([(170, 262), (190, 266), (192, 282), (180, 288), (168, 280)], 'f')
b_.part('legFront'); b_.limb(184, 280, 183, 294, 5.6, 5, 'w'); b_.ellipse(179, 297, 7.5, 3.4, 'w')
b_.part('ruffL'); b_.poly([(158, 254), (150, 256), (156, 260), (149, 264), (157, 266), (152, 271), (162, 268)], 'f')
b_.part('ruffR'); b_.poly([(186, 252), (194, 252), (189, 257), (196, 261), (188, 263), (193, 268), (184, 266)], 'f')
b_.part('head'); b_.ellipse(172, 256, 15, 13, 'w')
b_.part('ears')
b_.poly([(160, 248), (157, 236), (168, 243)], 'w'); b_.poly([(178, 243), (186, 234), (186, 248)], 'w')
b_.part('muzzle'); b_.ellipse(168, 264, 8.5, 5.5, 'f')
b_.part('mouth'); b_.ellipse(168, 268, 3.8, 2.2, 'm')
b_.part('nose'); b_.poly([(165, 260), (170, 260), (167.5, 262.5)], 'n')
b_.outline()
clip_paste(b_.render({'w': mat(BT, pillow=4, k=1.5, bias=0.04, noise=0.6, nscale=2), 'f': mat(WHITE_CLOTH, pillow=3, k=1.4, noise=0.8, nscale=2, bias=0.05),
                      'm': mat([(40, 4, 14), (100, 10, 30), (160, 30, 50)], pillow=2, k=1.3), 'n': mat([(140, 60, 90), (220, 120, 150)], pillow=1, k=1)}))
TL_ = b_.L
def stripe(pts, w=1.6, taper=False):
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        ww = w * (1 - 0.7 * i / max(1, n - 1)) if taper else w
        for dx in range(-int(ww // 2), max(1, int(math.ceil(ww / 2)))):
            X, Y = int(round(x + dx)), int(round(y))
            if TL_[Y, X] == 'w' and tuple(cv.a[Y, X]) != OUT:
                px(cv, X, Y, STR)
# Körperstreifen (schwarz, geschwungen)
for (x0, top, bot, bend) in [(184, 268, 286, 3), (192, 267, 289, 3), (200, 267, 290, 2), (208, 268, 288, 2), (216, 271, 285, 1), (224, 273, 284, 1)]:
    stripe(bezier((x0 - 2, top - 1), (x0 + bend + 3, (top + bot) / 2), (x0 - 1, bot - 5), 22), w=3.4 if x0 < 212 else 2.6, taper=True)
for (x0, y0) in [(210, 276), (218, 278)]:      # Keulenstreifen
    stripe(bezier((x0, y0), (x0 + 4, y0 + 4), (x0 + 3, y0 + 10), 14))
for (y0,) in [(286,), (290,)]:                  # Beinstreifen
    stripe([(181, y0), (182, y0), (183, y0), (184, y0)], 1)
    stripe([(169, y0 - 1), (170, y0 - 1), (171, y0 - 1)], 1)
for i, t in enumerate(np.linspace(0.15, 0.9, 5)):   # Schwanzringe
    x, y = bezier((222, 282), (236, 262), (218, 246), 50)[int(t * 49)]
    stripe([(x - 2, y), (x - 1, y), (x, y), (x + 1, y), (x + 2, y)], 1)
# Stirnzeichnung + Wangenstreifen
for (pts) in [[(170, 245), (174, 245)], [(169, 248), (175, 248)], [(172, 244), (172, 250)],
              [(160, 252), (163, 253)], [(159, 256), (163, 256)], [(181, 252), (184, 251)], [(182, 256), (186, 256)], [(166, 246), (167, 249)], [(178, 246), (177, 249)]]:
    stripe(bezier(pts[0], ((pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2), pts[-1], 8), w=1)
# rote Augen (wie im Sprite), Fangzähne, Innenohr
for (ex, s_) in [(164, -1), (179, 1)]:
    for (dx, dy, c) in [(-1, 0, (240, 40, 50)), (0, 0, (255, 70, 70)), (1, 0, (240, 40, 50)), (-1, 1, (160, 16, 26)), (0, 1, (200, 24, 36)),
                        (1, 1, (160, 16, 26)), (-2, -1, STR), (-1, -1, STR), (0, -1, STR), (1, -1, STR), (2, -1, STR), (s_ * 3, -2, STR),
                        (-s_ * 2, 0, STR)]:
        px(cv, ex + dx, 254 + dy, c)
    px(cv, ex, 254, (255, 230, 200))
for (x, y) in [(165, 267), (171, 267)]:
    px(cv, x, y, (255, 255, 255)); px(cv, x, y + 1, (230, 230, 240))
for (x, y) in [(160, 243), (161, 244), (183, 241), (183, 243)]:
    px(cv, x, y, (230, 150, 180))
for (x, y) in [(160, 264), (162, 266), (175, 264), (173, 266)]:
    px(cv, x, y, BT[1])
for dx in (-4, -1, 2):                          # Krallen
    px(cv, 179 + dx, 299, BT[0])
glow(cv, 196, 270, 34, (230, 230, 255), k=0.25, mix=0.15)

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
f.limb(129, 182, 140, 201, 5.8, 4.4, 's')
f.ellipse(140.5, 201.5, 4.5, 4.3, 's')                  # rundes Knie
f.limb(140, 203, 129, 217, 4.0, 2.9, 's')
f.part('shoeB')                                         # zierlicher Schuh, Spitze nach hinten
f.ellipse(129, 218, 3.2, 2.8, 'k')
f.limb(129, 218, 121, 221, 2.6, 1.3, 'k')
# Standbein
f.part('legF')
f.limb(121, 182, 119, 207, 6, 4.4, 's')
f.ellipse(119, 207, 4.3, 3.8, 's')
f.limb(119, 208, 118, 232, 4.2, 2.9, 's')
f.part('shoeF')                                         # auf Zehenspitzen: Schuh mit Spann, Spitze nach unten
f.ellipse(118, 235, 3.4, 3.4, 'k')
f.limb(118, 236, 116.5, 245, 3.0, 1.4, 'k')
# Kleid: Mieder + wehender Rock
f.part('skirt')
skirt = [(115, 157), (135, 157), (140, 168), (148, 180), (156, 188)]
for i in range(9):                       # wellenförmiger Saum
    u = i / 8
    skirt.append((154 - u * 56, 190 + (4 if i % 2 else 0) - 3 * math.sin(u * math.pi) + u * 1))
skirt += [(100, 186), (106, 176), (111, 166)]
f.poly(skirt, 'd')
f.part('bodice')
f.poly([(116, 136), (134, 136), (136, 148), (134, 160), (116, 160), (114, 148)], 'd')
f.part('neck'); f.rect(122, 126, 128, 137, 's')
# Arme + Stäbe
f.part('staffR')                     # rechter Stab (erhoben)
f.limb(166, 132, 158, 78, 1.6, 1.6, 't')
f.part('armR')
f.curve([(135, 139), (144, 133), (151, 125), (156, 117), (160, 111)], 's', w=7.2, w1=5)
f.part('handR'); f.ellipse(161, 109, 3.4, 3.2, 's')
f.part('staffL')                     # linker Stab (gesenkt)
f.limb(84, 190, 94, 138, 1.6, 1.6, 't')
f.part('armL')
f.curve([(115, 139), (108, 146), (102, 153), (96, 159), (91, 162)], 's', w=7.2, w1=5)
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
    'd': mat(DRESS, pillow=4, k=1.5, folds=(0.55, 0.1, 0.6)),
    'k': mat([(10, 50, 60), (20, 100, 110), (60, 170, 170), (150, 236, 220), (230, 255, 245)], pillow=2, k=1.6, spec=True),
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
# Leuchtsaum am Rocksaum + Faltenlichter
DM_ = f.L == 'd'
for y in range(170, 200):
    for x in range(98, 160):
        if DM_[y, x] and not DM_[y + 1, x] and not DM_[y + 2, x]:
            px(cv, x, y - 1, (190, 255, 230)); px(cv, x, y - 2, DRESS[4] if x % 2 else (190, 255, 230))
            blend_px(cv, x, y + 2, (160, 255, 210), 0.5)
for (x0, x1) in [(118, 108), (125, 125), (132, 144)]:
    for t_ in np.linspace(0.15, 0.9, 12):
        x = 125 + (x0 - 125) * 0.2 + (x1 - x0 * 0.2 - 125 * 0.8) * t_; y = 160 + t_ * 28
        if DM_[int(y), int(round(x))] and tuple(cv.a[int(y), int(round(x))]) != OUT:
            px(cv, x, y, DRESS[4])
for (x, y) in [(110, 186), (122, 190), (136, 188), (148, 186)]:
    sparkle(cv, x, y + 2, (220, 255, 240), r=1, c2=(120, 220, 190))
for (x, y) in [(117, 233), (119, 232), (128, 216), (130, 216)]:   # Schuhbänder
    px(cv, x, y, GOLD[4])
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
