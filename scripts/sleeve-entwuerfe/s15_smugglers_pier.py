# -*- coding: utf-8 -*-
"""15 Smuggler's Pier – der Schmugglersteg ragt in der Abenddämmerung aufs Meer hinaus:
Pfähle mit Tauen und Laternen, Kisten und Fässer, Möwen, Schmugglerschiff vor der
untergehenden Sonne, Felsküste links, Glitzerpfad auf dem Wasser."""
from lib import *

YY, XX = np.mgrid[0:H, 0:W]
AREA = 'smugglers-pier/'
PIER = area(AREA + 'pier')


# ---------------------------------------------------------------- Helfer
def P(c):
    return tuple(c[:3]) + (255,)


def setm(a, m, col):
    a[m] = P(col)


def px(a, x, y, col):
    x, y = int(x), int(y)
    if 0 <= x < W and 0 <= y < H:
        a[y, x] = P(col)


def comp(a, sprite, x, y):
    im = Image.fromarray(a, 'RGBA')
    im.alpha_composite(sprite, (int(x), int(y)))
    a[:] = np.array(im)


def comp_occ(a, sprite, x, y, ycut):
    """Sprite einsetzen; unterhalb ycut verdeckt das (nähere) Deck."""
    sa = np.array(sprite)
    hh, ww = sa.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww]
    gy, gx = yy + int(y), xx + int(x)
    ok = (gy >= 0) & (gy < H) & (gx >= 0) & (gx < W)
    occ = np.zeros_like(ok)
    occ[ok] = DECK[gy[ok], gx[ok]] & (gy[ok] > ycut)
    sa[..., 3] = np.where(occ, 0, sa[..., 3])
    comp(a, Image.fromarray(sa, 'RGBA'), x, y)


def dusk(sp, k=(0.74, 0.66, 0.82), add=(8, 4, 18), rim=(255, 150, 92), rim_amt=0.5):
    """Sprite in Abendlicht tauchen: dunkler/violetter, warme Lichtkante rechts (Sonne rechts)."""
    s_ = np.array(sp).astype(float)
    al = s_[..., 3] > 0
    L = s_[..., :3].mean(2)
    s_[..., :3] = s_[..., :3] * np.array(k) + np.array(add)
    if rim_amt:
        right_open = np.zeros_like(al)
        right_open[:, :-1] = ~al[:, 1:] | (np.pad(L, ((0, 0), (0, 0)))[:, 1:] < 45)
        right_open[:, -1] = True
        rm = al & right_open & (L >= 45)
        s_[rm, :3] = s_[rm, :3] * (1 - rim_amt) + np.array(rim) * rim_amt
    return Image.fromarray(np.clip(s_, 0, 255).astype(np.uint8), 'RGBA')


def darken(col, f):
    return tuple(int(round(c * f)) for c in col[:3])


# ---------------------------------------------------------------- Geometrie
HY = 136            # Horizont
VPX = 104           # Fluchtpunkt x
DH = 350 - HY       # Augenhöhe über Deck (Pixel bei z = 1)
XL, XR = -92, 84    # Deckkanten (Welt-x in Pixel bei z = 1)
WATER = 46          # Wasserspiegel unter dem Deck
ZEND = 4.7          # Stegende


def sy(z, h=0.0):
    """Bildschirm-y eines Punktes in Tiefe z, Höhe h über dem Deck."""
    return HY + (DH - h) / z


def sx(z, X):
    return VPX + X / z


a = np.zeros((H, W, 4), np.uint8)

# ================================================================ HIMMEL
SKY = [(0.0, (20, 18, 50)), (0.2, (36, 28, 76)), (0.42, (70, 40, 100)), (0.6, (124, 54, 110)),
       (0.75, (184, 74, 98)), (0.87, (228, 116, 84)), (1.0, (250, 170, 96))]
SUN_X, SUN_Y, SUN_R = 180, HY - 4, 15
dsun = np.hypot(XX - SUN_X, (YY - SUN_Y) * 1.7)
tsky = np.clip(YY / HY + np.clip(1 - dsun / 130, 0, 1) ** 2 * 0.22, 0, 1)
sky = np.array(dither_gradient((W, H), SKY, func=lambda x, y: tsky))
a[:HY] = sky[:HY]

# Sterne im oberen Himmel
rs = random.Random(3)
for _ in range(90):
    x, y = rs.randrange(8, W - 8), rs.randrange(8, 76)
    if rs.random() < (1 - y / 84) ** 1.3:
        a[y, x] = P(rs.choice([(176, 164, 214), (214, 204, 238), (130, 118, 184)]))
for (x, y) in [(38, 20), (214, 34), (122, 12), (84, 44)]:
    px(a, x, y, (255, 246, 232))
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        px(a, x + dx, y + dy, (150, 132, 196))

# Sonne mit Hof
sd = np.hypot(XX - SUN_X, YY - SUN_Y)
above = YY < HY
setm(a, dither_mask(None, np.clip(1 - (sd - SUN_R) / 40, 0, 1) ** 1.7 * 0.85) & above & (sd > SUN_R), (248, 180, 104))
setm(a, dither_mask(None, np.clip(1 - (sd - SUN_R) / 14, 0, 1)) & above & (sd > SUN_R), (255, 206, 132))
sunm = (sd <= SUN_R + 0.3) & above
setm(a, sunm, (255, 238, 184))
setm(a, sunm & (sd > SUN_R - 1.3), (255, 214, 136))
for yb, col in [(HY - 5, (250, 168, 98)), (HY - 9, (252, 186, 112)), (HY - 12, (254, 204, 132))]:
    setm(a, sunm & (YY == yb), col)


# Wolken: flache Schichtwolken, von unten angeleuchtet
def cloud(cx, cy, w, h, seed, body, under, rim2, rim, tilt=0.0):
    r = random.Random(seed)
    m = np.zeros((H, W), bool)
    n = r.randint(6, 9)
    for i in range(n):
        f = i / (n - 1) - 0.5
        ex = cx + f * w * 0.82 + r.uniform(-3, 3)
        mid_ = 1 - abs(f) * 1.5
        ew = r.uniform(w * 0.1, w * 0.2) * (0.7 + 0.5 * mid_)
        eh = h * (0.35 + 0.65 * mid_) * r.uniform(0.75, 1.1)
        by = cy + f * w * tilt
        m |= ((XX - ex) / ew) ** 2 + ((YY - (by - eh * 0.35)) / eh) ** 2 <= 1
        m &= ~((YY > by + r.choice([0, 1])) & (np.abs(XX - ex) < ew))
    # lange Schleier-Streifen unten
    for k in range(r.randint(2, 3)):
        yl = int(cy + 1 + k * 2)
        xl = int(cx - w * r.uniform(0.3, 0.6)); xr = int(cx + w * r.uniform(0.2, 0.55))
        m[yl, max(0, xl):min(W, xr)] = True
    # Abstand zur Unterkante je Pixel
    db = np.zeros((H, W), int)
    run = np.zeros(W, int)
    for y in range(H - 1, -1, -1):
        run = np.where(m[y], run + 1, 0)
        db[y] = run
    setm(a, m, body)
    setm(a, m & (db <= 4) & dither_mask(None, np.full((H, W), 0.5)), under)
    setm(a, m & (db <= 3), under)
    setm(a, m & (db == 2) & dither_mask(None, np.full((H, W), 0.5)), rim2)
    setm(a, m & (db == 1) & (np.roll(m, -1, 0) == False), rim)
    # Oberkante minimal heller (Streulicht)
    return m


cloud(62, 58, 104, 7, 11, (78, 46, 104), (132, 64, 118), (208, 104, 116), (250, 160, 112), tilt=-0.02)
cloud(212, 44, 84, 6, 12, (70, 42, 98), (122, 60, 114), (200, 98, 112), (248, 166, 116))
cloud(122, 90, 108, 6, 13, (150, 62, 106), (188, 84, 104), (236, 128, 100), (255, 196, 128), tilt=0.02)
cloud(26, 108, 70, 5, 14, (168, 70, 102), (206, 96, 100), (246, 148, 102), (255, 206, 136))
cloud(238, 112, 52, 4, 15, (186, 80, 98), (220, 108, 96), (250, 160, 106), (255, 216, 146))

# ================================================================ MEER
q = np.clip((YY - HY) / (H - HY), 0, 1)
WAT = [(0.0, (222, 124, 98)), (0.035, (168, 80, 112)), (0.1, (98, 54, 124)), (0.24, (46, 46, 142)),
       (0.45, (20, 58, 172)), (0.7, (12, 46, 156)), (1.0, (6, 30, 122))]
sea = np.array(dither_gradient((W, H), WAT, func=lambda x, y: np.clip(q ** 0.85, 0, 1)))
# Wellenzüge: horizontale Streifen, nach vorn länger (wie water.png)
big = value_noise(W * 8, H, 20, seed=1, octaves=2)
wave = np.zeros((H, W))
for y in range(HY + 1, H):
    k = 1 + q[y, 0] * 9
    xs = ((np.arange(W) - SUN_X) / k * 1.0 + y * 37.3 + 900) % (W * 8)
    wave[y] = big[y, xs.astype(int)]
hi = (wave > 0.6) & (YY > HY)
hi2 = (wave > 0.68) & (YY > HY)
lo = (wave < 0.38) & (YY > HY)
s2 = sea.astype(int)
s2[hi, :3] += [12, 18, 34]
s2[hi2, :3] += [10, 14, 24]
s2[lo, :3] -= [6, 10, 22]
sea = np.clip(s2, 0, 255).astype(np.uint8)
a[HY:] = sea[HY:]
a[HY, :] = P((238, 150, 102))

# Glitzerpfad unter der Sonne
rg = random.Random(21)
for y in range(HY + 1, H):
    qq = (y - HY) / (H - HY)
    half = 5 + qq * 60
    cx = SUN_X + (y - HY) * 0.25
    for _ in range(int(2 + half * 0.3)):
        if rg.random() > 0.75 * (1 - qq) ** 1.2 + 0.1:
            continue
        x = int(cx + rg.gauss(0, half * 0.42))
        if wave[y, min(W - 1, max(0, x))] < 0.5:
            continue
        ln = max(1, int(rg.uniform(1, 2 + qq * 7)))
        col = (255, 228, 156) if abs(x - cx) < half * 0.4 else (250, 172, 112)
        for i in range(ln):
            px(a, x + i, y, col)
SEA_REF = a.copy()


# ================================================================ KÜSTE (links)
def profile(pts, x0, x1, seed, jag=1):
    r = random.Random(seed)
    xs = np.arange(x0, x1)
    ys = np.interp(xs, [p_[0] for p_ in pts], [p_[1] for p_ in pts])
    out = {}
    j = 0
    for x, y in zip(xs, ys):
        if r.random() < 0.3:
            j = int(np.clip(j + r.choice([-1, 1]), -jag, jag))
        out[int(x)] = int(round(y)) + j
    return out


def fill_profile(prof, ybase):
    m = np.zeros((H, W), bool)
    for x, yt in prof.items():
        if 0 <= x < W:
            m[max(0, yt):ybase + 1, x] = True
    return m


# ferne Landzunge (dunstig)
far_p = profile([(0, 108), (30, 110), (60, 116), (90, 122), (112, 128), (128, 133), (138, 136)], 0, 139, 5)
FARM = fill_profile(far_p, HY)
FARPAL = [(118, 52, 104), (134, 60, 106), (150, 70, 106)]
nfar = value_noise(W, H, 8, seed=9)
setm(a, FARM, FARPAL[0])
setm(a, FARM & dither_mask(None, np.clip((YY - 108) / 30, 0, 1) * 0.9 + (nfar - 0.5) * 0.3), FARPAL[1])
topf = FARM & ~np.roll(FARM, 1, 0)
setm(a, topf, (214, 108, 104))
setm(a, topf & (np.roll(FARM, 1, 1) & ~np.roll(np.roll(FARM, 1, 0), 1, 1)) , (236, 136, 108))

# nahe Steilküste
cliff_p = profile([(0, 72), (8, 70), (16, 74), (24, 73), (30, 78), (38, 84), (44, 86), (50, 93), (56, 100),
                   (62, 104), (68, 112), (74, 118), (82, 126), (90, 134), (98, 141), (104, 146)], 0, 106, 8, jag=1)
CB = 146
CLIFF = fill_profile(cliff_p, CB)
CL = [(30, 18, 42), (42, 24, 56), (56, 32, 70), (74, 42, 84)]
nc = value_noise(W, H, 5, seed=13, octaves=2)
strata = (np.sin((YY * 0.9 + XX * 0.35) * 0.9 + nc * 6) + 1) / 2
lv = np.clip(0.25 + (strata - 0.5) * 0.5 + (nc - 0.5) * 0.6 + XX / 400, 0, 0.99)
ci = np.clip(np.floor(lv * 3 + BAYER4[YY % 4, XX % 4] * 0.8), 0, 3).astype(int)
cc = np.array([P(c) for c in CL], np.uint8)[ci]
a[CLIFF] = cc[CLIFF]
# Risse
rr_ = random.Random(17)
for _ in range(16):
    x = rr_.randrange(4, 96)
    if x not in cliff_p:
        continue
    y = rr_.randrange(cliff_p[x] + 4, CB - 2) if cliff_p[x] + 4 < CB - 2 else None
    if y is None:
        continue
    for k in range(rr_.randint(3, 8)):
        if CLIFF[y + k, x] and y + k < CB:
            a[y + k, x] = P(CL[0])
        x += rr_.choice([0, 0, 1, -1])
# Sonnenkante: Oberkante + nach rechts abfallende Flanken warm
topc = CLIFF & ~np.roll(CLIFF, 1, 0)
rightc = CLIFF & ~np.roll(CLIFF, -1, 1)
setm(a, topc, (148, 66, 96))
slope = np.zeros((H, W), bool)
for x in range(1, 105):
    if x in cliff_p and x + 1 in cliff_p and cliff_p[x + 1] >= cliff_p[x]:
        y0 = cliff_p[x]
        for k in range(0, 3):
            if k == 0:
                a[y0, x] = P((238, 138, 104))
            elif k == 1 and y0 + 1 < CB:
                a[y0 + 1, x] = P((176, 80, 98))
            elif k == 2 and y0 + 2 < CB and (x + y0) % 2 == 0:
                a[y0 + 2, x] = P((110, 50, 86))
# Gras auf der Kuppe
for x in range(2, 60):
    if x in cliff_p and rr_.random() < 0.45:
        px(a, x, cliff_p[x] - 1, (46, 40, 60))
        if rr_.random() < 0.3:
            px(a, x, cliff_p[x] - 2, (46, 40, 60))
# Brandung am Fuß
for x in range(0, 106):
    if CLIFF[CB, x] or CLIFF[CB - 1, x]:
        if rr_.random() < 0.7:
            px(a, x, CB + 1, (200, 150, 170) if x % 3 else (236, 196, 196))
        if rr_.random() < 0.3:
            px(a, x, CB, (170, 120, 160))
# Spiegelung der Klippe
for y in range(CB + 2, CB + 26):
    my = CB - (y - CB) * 1
    if my < 0:
        break
    row = CLIFF[my]
    br = (wave[y] > 0.62)
    m = row & ~br & ~DECK_ANY[y] if False else row & ~br
    k = (y - CB) / 26
    m &= dither_mask(None, np.full((H, W), 0.9 - k * 0.7))[y]
    a[y, m, :3] = (a[y, m, :3].astype(int) * 0.45 + np.array([28, 16, 44]) * 0.55).astype(np.uint8)

# Leuchtturm auf der Klippe
LX = 17
ly = cliff_p[LX] + 1
tower_h = 19
for k in range(tower_h):
    y = ly - k
    wdt = 6 if k < 8 else 5
    x0 = LX - wdt // 2
    band = (k // 4) % 2 == 1
    for i in range(wdt):
        if band:
            c = (120, 36, 60) if i < wdt - 2 else (190, 70, 80)
        else:
            c = (150, 130, 156) if i < wdt - 2 else (236, 190, 170)
        if i == 0:
            c = (34, 20, 44)
        px(a, x0 + i, y, c)
    px(a, x0 + wdt, y, (34, 20, 44))
ty = ly - tower_h
for i in range(-1, 6):
    px(a, LX - 3 + i, ty, (34, 20, 44))
for yy_ in (ty - 1, ty - 2, ty - 3):
    px(a, LX - 2, yy_, (34, 20, 44)); px(a, LX + 2, yy_, (34, 20, 44))
    for i in (-1, 0, 1):
        px(a, LX + i, yy_, (255, 236, 170) if i < 1 else (255, 206, 120))
for i in range(-2, 3):
    px(a, LX + i, ty - 4, (34, 20, 44))
for i in range(-1, 2):
    px(a, LX + i, ty - 5, (34, 20, 44))
px(a, LX, ty - 6, (34, 20, 44))
LH_LIGHT = (LX, ty - 2)

# ================================================================ SCHIFF
def ship(a, x0, ybase):
    D = (40, 22, 52)
    RIM = (226, 124, 100)
    m = np.zeros((40, 44), bool)
    # Rumpf (Bug links)
    for i in range(34):
        top = 30 if i < 26 else 27
        if i < 3:
            top = 29 + (3 - i) // 2
        bot = 34 if 3 <= i <= 31 else 33
        m[top:bot + 1, 5 + i] = True
    m[32:35, 5] = False; m[34, 6] = False
    for i in range(6):                           # Bugspriet
        m[28 - i // 2, i] = True
    for mx, mh in ((16, 26), (30, 24)):          # Masten
        m[30 - mh:30, mx] = True
    # Rahsegel
    for mx, mh, ww in ((16, 26, (5, 7, 8)), (30, 24, (5, 6, 7))):
        y = 30 - mh + 2
        for j, hw in enumerate(ww):
            hs = 5 if j == 2 else 4
            for k in range(hs):
                bulge = 1 if 0 < k < hs - 1 else 0
                m[y + k, mx - hw - bulge:mx + hw + 1 + bulge] = True
            y += hs + 1
    # Klüver
    for k in range(12):
        m[17 + k, 1 + 5 - k // 3 + 4: 16] = True if k > 2 else False
        m[17 + k, 16 - k // 1 - 1:16] = True
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        px(a, x0 + x, ybase - 34 + y, D)
    # Lichtkanten (Sonne rechts)
    for y, x in zip(ys, xs):
        if x + 1 >= m.shape[1] or not m[y, x + 1]:
            if y < 30:
                px(a, x0 + x, ybase - 34 + y, (146, 64, 92))
    for i in range(6, 38):
        if m[30 if i < 31 else 27, i]:
            pass
    for i in range(8, 38):
        yt = min(np.nonzero(m[27:, i])[0]) + 27 if m[27:, i].any() else None
        if yt is not None and yt >= 27:
            px(a, x0 + i, ybase - 34 + yt, (120, 56, 84) if i < 30 else RIM)
    # Heckfenster + Laterne
    for (xx_, yy_) in ((33, 29), (35, 29), (37, 29)):
        px(a, x0 + xx_, ybase - 34 + yy_, (255, 204, 120))
    px(a, x0 + 39, ybase - 34 + 26, (255, 230, 160))
    return m


SHIP_X = 128
ship(a, SHIP_X, HY + 1)
# Spiegelung des Schiffs (gebrochen)
rsh = random.Random(31)
for y in range(HY + 2, HY + 12):
    for x in range(SHIP_X + 4, SHIP_X + 40):
        if rsh.random() < 0.55 - (y - HY) * 0.045 and wave[y, x] < 0.6:
            a[y, x, :3] = (a[y, x, :3].astype(int) * 0.4 + np.array([40, 22, 52]) * 0.6).astype(np.uint8)

# ================================================================ STEG
Zd = np.where(YY > HY, DH / np.maximum(YY - HY, 1e-3), 1e9)
Xd = (XX - VPX) * Zd
deck = (YY > sy(ZEND)) & (Xd >= XL) & (Xd <= XR)
NPL = 13
u = (Xd - XL) / (XR - XL) * NPL
pl = np.clip(np.floor(u), 0, NPL - 1).astype(int)
fr = u - np.floor(u)
pxw = Zd / (XR - XL) * NPL                     # Plankenbreite pro Pixel
gap = (fr < pxw * 0.9) & (pl > 0)
# Stöße der Planken (versetzt)
rp = random.Random(4)
joints = [rp.uniform(0, 0.9) for _ in range(NPL)]
jl = 0.95
zz = (Zd - 1 + np.array(joints)[pl]) / jl
jf = zz - np.floor(zz)
dzpx = Zd ** 2 / DH                             # Tiefe pro Pixelzeile
joint = jf < dzpx / jl * 1.0
# Holztöne
WOOD = [(44, 24, 6), (61, 36, 12), (79, 48, 15), (94, 61, 23), (111, 74, 30), (126, 85, 36), (142, 96, 43), (160, 110, 52), (181, 129, 63)]
grain = value_noise(400, 400, 6, seed=7, octaves=2)
gi = np.clip(((Xd - XL) * 2.2).astype(int), 0, 399)
gz = np.clip(((Zd - 1) * 40).astype(int), 0, 399)
gv = grain[gz, gi]
pv = np.array([rp.uniform(-0.12, 0.12) for _ in range(NPL)])[pl]
# Licht: hinten Himmelsglanz, vorne dunkler, rechte Plankenkante heller
base = 0.42 + pv + (gv - 0.5) * 0.5
base += np.clip((fr - 0.7) * 1.2, 0, 0.3)
lvl = np.clip(base, 0, 1)
idx = np.clip(np.floor(lvl * 6 + 1.6 + BAYER4[YY % 4, XX % 4] * 0.9), 2, 7).astype(int)
dk = np.array([P(c) for c in WOOD], np.uint8)[idx]
dk[gap | joint] = P(WOOD[0])
# Dämmerung: weiter hinten Richtung Himmelsfarbe (Glanz)
far = np.clip((Zd - 1.6) / (ZEND - 1.6), 0, 1)
dkf = dk.astype(float)
tintc = np.array([150, 84, 104])
mix = dither_mask(None, far * 0.55)
dkf[mix, :3] = dkf[mix, :3] * 0.55 + tintc * 0.45
dkf[..., :3] = dkf[..., :3] * np.array([0.78, 0.7, 0.84]) + np.array([8, 4, 16])
a[deck] = np.clip(dkf, 0, 255).astype(np.uint8)[deck]
# Kanten: linke/rechte Deckkante dunkel, Stirnkante hell
edgeL = deck & ~np.roll(deck, 1, 1)
edgeR = deck & ~np.roll(deck, -1, 1)
setm(a, edgeL | edgeR, (23, 12, 3))
yend = int(round(sy(ZEND)))
DECK = deck.copy()


# ================================================================ WASSER-BEIWERK (Area-Sprites 1x)
def water_sprite(a, sp, x, yw, refl=True, foam=True):
    """Sprite so setzen, dass seine Unterkante auf der Wasserlinie yw steht; Spiegelung + Schaum."""
    sa = np.array(sp)
    hh, ww = sa.shape[:2]
    y0 = yw - hh + 1
    if refl:
        r = random.Random(x * 13 + yw)
        for k in range(1, int(hh * 0.7)):
            yy_ = yw + k
            if yy_ >= H:
                break
            src = sa[hh - k] if hh - k >= 0 else None
            if src is None:
                break
            sh = r.choice([-1, 0, 0, 0, 1]) if k > 2 else 0
            for i in range(ww):
                if src[i, 3] > 200 and r.random() > k / (hh * 0.7) * 0.8:
                    xx_ = x + i + sh
                    if 0 <= xx_ < W and not DECK[yy_, xx_] and wave[yy_, xx_] < 0.64:
                        c = a[yy_, xx_, :3].astype(int)
                        a[yy_, xx_, :3] = np.clip(c * 0.5 + src[i, :3] * 0.18 + np.array([12, 6, 24]), 0, 255)
    comp(a, dusk(sp), x, y0)
    if foam:
        foam_ring(a, x + ww / 2 - 0.5, yw + 1, ww - 1)


DALBEN = PIER.crop((233, 50, 260, 86)); DALBEN = DALBEN.crop(DALBEN.getbbox())
STUMP = PIER.crop((312, 25, 328, 48)); STUMP = STUMP.crop(STUMP.getbbox())
ROCK = PIER.crop((294, 80, 330, 100)); ROCK = ROCK.crop(ROCK.getbbox())
FASS = area(AREA + 'barrel').crop((0, 0, 18, 12))

# ================================================================ PFÄHLE
def post_sprite(w, hh, rope_at, moss_from, lantern=False, seed=0):
    """Holzpfahl im Stil von pier.png. w Breite inkl. Umriss, hh Höhe."""
    r = random.Random(seed)
    o = np.zeros((hh, w, 4), np.uint8)
    OUT = (23, 12, 3)
    tones = [(79, 48, 15), (94, 61, 23), (111, 74, 30), (126, 85, 36), (142, 96, 43), (160, 110, 52), (181, 129, 63)]
    inner = w - 2
    for y in range(hh):
        for x in range(w):
            if x == 0 or x == w - 1:
                o[y, x] = P(OUT); continue
            uu = (x - 1) / max(1, inner - 1)
            t = 1 + uu * 4.2 + (0.8 if (x + y * 3) % 7 == 0 else 0) * (w > 6)
            t += r.uniform(-0.6, 0.6)
            o[y, x] = P(tones[int(np.clip(t, 0, 6))])
    # Maserung: senkrechte dunkle Striche
    for _ in range(max(0, w // 3)):
        gx = r.randrange(1, w - 1)
        gy = r.randrange(2, hh - 2)
        for k in range(r.randint(2, 5)):
            if gy + k < hh:
                o[gy + k, gx] = P(tones[0])
    # Kappe
    cap = max(1, w // 5)
    for y in range(cap + 1):
        for x in range(w):
            dxl = x; dxr = w - 1 - x
            if min(dxl, dxr) < cap - y:
                o[y, x] = 0
    o[0, cap:w - cap] = P(OUT)
    for y in range(1, cap + 1):
        xs = [x for x in range(w) if o[y, x, 3] > 0]
        if xs:
            o[y, xs[0]] = P(OUT); o[y, xs[-1]] = P(OUT)
    if w >= 5:
        o[1, cap + 0:w - cap - 1] = P((160, 110, 52))
        o[1, w - cap - 2] = P((191, 140, 74))
    # Tau
    if rope_at is not None and w >= 4:
        rh = max(1, round(w * 0.36))
        ROPE = [(133, 102, 54), (163, 130, 80), (189, 157, 108), (210, 182, 134)]
        for y in range(rope_at, min(hh, rope_at + rh)):
            for x in range(0, w):
                k = (x + y) % 3
                c = ROPE[1 + k] if (x + 2 * y) % 4 else ROPE[0]
                if x == 0 or x == w - 1:
                    c = ROPE[0]
                o[y, x] = P(c)
        if w >= 8:
            o[rope_at + rh, 1] = P((133, 102, 54))
    # Moos und Seepocken unten
    if moss_from is not None:
        for y in range(moss_from, hh):
            for x in range(1, w - 1):
                g = (y - moss_from) / max(1, hh - moss_from)
                if r.random() < 0.35 + g * 0.6:
                    o[y, x] = P((31, 58, 26) if r.random() < 0.55 else (68, 112, 44))
            if w >= 6 and r.random() < 0.5:
                o[y, r.randrange(1, w - 1)] = P((200, 212, 214))
    return Image.fromarray(o, 'RGBA')


def wpx(a, x, y, col):
    if 0 <= x < W and 0 <= y < H and not DECK[y, x]:
        a[y, x] = P(col)


def foam_ring(a, cx, yw, w):
    FO = [(207, 230, 255), (140, 196, 255)]
    x0 = int(round(cx - w / 2)) - 1; x1 = x0 + w + 1
    for x in range(x0, x1 + 1):
        wpx(a, x, yw, FO[0] if (x - x0) % 3 else FO[1])
    wpx(a, x0 - 1, yw, FO[1]); wpx(a, x1 + 1, yw, FO[1])
    if w >= 6:
        for x in range(x0 + 1, x1, 2):
            wpx(a, x, yw + 1, FO[1])


def reflection(a, cx, yw, w, length, col):
    """Gebrochene Spiegelung eines Pfahls im Wasser."""
    r = random.Random(int(cx * 7 + yw))
    for k in range(1, length):
        y = yw + k
        if y >= H:
            break
        if k > 2 and r.random() < k / length * 0.9:
            continue
        sh = r.choice([-1, 0, 0, 1])
        for x in range(int(cx - w / 2) + sh, int(cx + w / 2) + sh):
            if 0 <= x < W and 0 <= y < H and not DECK[y, x]:
                c = a[y, x, :3].astype(int)
                a[y, x, :3] = np.clip(c * 0.55 + np.array(col) * 0.45, 0, 255)


LANT = []
POSTS = []
PW, PH_UP = 13, 30          # Pfahlbreite / Höhe über Deck (Welt)
for side, X in (('L', XL - 5), ('R', XR + 5)):
    zs = np.arange(0.98, ZEND + 0.01, 0.42)
    for i, z in enumerate(zs):
        POSTS.append((z, side, X, i))
POSTS.sort(key=lambda p: -p[0])
for (z, side, X, i) in POSTS:
    w = max(2, int(round(PW / z)))
    cx = sx(z, X)
    ytop = sy(z, PH_UP)
    ydeck = sy(z)
    yw = HY + (DH + WATER) / z
    hh = int(round(yw - ytop))
    x0 = int(round(cx - w / 2))
    y0 = int(round(ytop))
    if w <= 2:
        # winzige Pfähle: 1-2 px Striche
        for y in range(y0, int(round(yw))):
            px(a, x0, y, (61, 36, 12))
            if w == 2:
                px(a, x0 + 1, y, (111, 74, 30))
        px(a, x0, int(round(yw)), (140, 196, 255))
        continue
    lantern = (i % 2 == 1)
    rope_at = int(round((ytop + (ydeck - ytop) * 0.3) - y0))
    moss = int(round((yw - (WATER / z) * 0.35) - y0))
    sp = post_sprite(w, hh, rope_at if not lantern else None, moss, seed=int(z * 100) + (side == 'R'))
    reflection(a, cx, int(round(yw)) + 1, w, max(3, int(hh * 0.45)), (20, 12, 30))
    comp_occ(a, dusk(sp), x0, y0, ydeck)
    foam_ring(a, cx, int(round(yw)), w)
    if lantern:
        LANT.append((z, side, cx, y0, w))


# ---------------------------------------------------------------- Wasser-Sprites setzen
water_sprite(a, STUMP, 226, 196)
water_sprite(a, DALBEN, 196, 238)
fa = np.array(FASS)
water_sprite(a, FASS, 186, 292, refl=False, foam=False)
water_sprite(a, ROCK, 206, 338)


# ================================================================ LATERNEN
LK = {'k': (28, 18, 26), 'K': (92, 66, 58), 'W': (255, 248, 214), 'Y': (255, 214, 120), 'y': (240, 150, 60)}
LSPR = {
    'big': ["...k...", "..kkk..", ".kkKkk.", ".kWYyk.", ".kYYyk.", ".kyyyk.", ".kkkkk.", "..kkk.."],
    'med': ["..k..", ".kkk.", "kWYyk", "kYyyk", ".kkk."],
    'small': [".k.", "kYk", "kyk"],
    'tiny': ["k", "Y"],
}


def lantern_img(kind):
    rows = LSPR[kind]
    o = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in LK:
                o[y, x] = P(LK[ch])
    return Image.fromarray(o, 'RGBA')


def warm_glow(a, cx, cy, r, strength, col=(255, 168, 86), amt=0.45, only=None):
    d = np.hypot(XX - cx, (YY - cy) * 1.05)
    t = np.clip(1 - d / r, 0, 1) ** 1.6 * strength
    m = dither_mask(None, t) & (d < r)
    if only is not None:
        m &= only
    c = a[m, :3].astype(float)
    a[m, :3] = np.clip(c * (1 - amt) + np.array(col) * amt, 0, 255).astype(np.uint8)


for (z, side, cx, y0, w) in sorted(LANT, key=lambda l: -l[0]):
    kind = 'big' if w >= 8 else 'med' if w >= 6 else 'small' if w >= 4 else 'tiny'
    li = lantern_img(kind)
    arm = {'big': 5, 'med': 3, 'small': 2, 'tiny': 1}[kind]
    ay = y0 + max(1, w // 5) + 1
    if side == 'L':
        ax0, ax1 = int(round(cx - w / 2)) - arm, int(round(cx - w / 2)) - 1
        lx = ax0 - li.width // 2
    else:
        ax0, ax1 = int(round(cx + w / 2)), int(round(cx + w / 2)) + arm - 1
        lx = ax1 - li.width // 2 + 1
    # Arm aus dunklem Holz
    for x in range(ax0, ax1 + 1):
        px(a, x, ay, (44, 24, 14))
    if kind in ('big', 'med'):
        px(a, ax0 if side == 'L' else ax1, ay - 1, (44, 24, 14))
    ly = ay + 1
    gx, gy = lx + li.width / 2, ly + li.height / 2
    rr = {'big': 16, 'med': 11, 'small': 7, 'tiny': 5}[kind]
    warm_glow(a, gx, gy, rr, 0.85)
    warm_glow(a, gx, gy, rr * 0.5, 1.0, col=(255, 200, 120), amt=0.35)
    comp(a, li, lx, ly)
    # Spiegelung im Wasser
    yw = int(round(HY + (DH + WATER) / z))
    rl = random.Random(int(z * 1000))
    L = {'big': 34, 'med': 20, 'small': 10, 'tiny': 6}[kind]
    for k in range(2, L):
        y = yw + k
        if y >= H - 7:
            break
        if rl.random() < 0.35 + k / L * 0.4:
            continue
        ln = max(1, int(rl.uniform(1, li.width * (1 - k / L) + 1)))
        x = int(gx - ln / 2 + rl.choice([-1, 0, 0, 1]))
        col = (255, 214, 130) if k < L * 0.4 else (236, 146, 80)
        for i in range(ln):
            wpx(a, x + i, y, col)

# ================================================================ DECKLADUNG (Area-Sprites 1x)
def crate():
    c = PIER.crop((104, 39, 136, 73))
    ca = np.array(c)
    for (x, y) in [(0, 0), (31, 0), (0, 33), (31, 33)]:
        ca[y, x, 3] = 0
    return Image.fromarray(ca, 'RGBA')


def barrel_top():
    c = PIER.crop((70, 73, 94, 96))
    ca = np.array(c).astype(int)
    outl = (ca[..., :3].sum(2) <= 40)
    free = ~outl
    lab, _ = ndimage.label(free)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    m = ndimage.binary_fill_holes(~bg)
    lab2, n2 = ndimage.label(m)
    sz = ndimage.sum(m, lab2, range(1, n2 + 1))
    m = lab2 == (np.argmax(sz) + 1)
    out = np.array(c); out[..., 3] = np.where(m, 255, 0)
    im = Image.fromarray(out, 'RGBA')
    return im.crop(im.getbbox())


def coil():
    c = PIER.crop((136, 58, 172, 84))
    ca = np.array(c).astype(int)
    r_, g_, b_ = ca[..., 0], ca[..., 1], ca[..., 2]
    rope = (b_ / np.maximum(r_, 1) > 0.38) & (r_ > 90)
    rope = ndimage.binary_closing(rope, iterations=1)
    lab, n = ndimage.label(rope)
    sz = ndimage.sum(rope, lab, range(1, n + 1))
    rope = lab == (np.argmax(sz) + 1)
    m = ndimage.binary_fill_holes(rope)
    dark = ca[..., :3].sum(2) < 110
    m |= ndimage.binary_dilation(m) & dark
    out = np.array(c); out[..., 3] = np.where(m, 255, 0)
    im = Image.fromarray(out, 'RGBA')
    return im.crop(im.getbbox())


CRATE, BTOP, COIL = crate(), barrel_top(), coil()


def shadow_on_deck(a, x0, x1, y, h=2):
    for k in range(h):
        for x in range(x0 + k, x1 + 1 + k):
            if 0 <= x < W and 0 <= y + k < H and DECK[y + k, x]:
                a[y + k, x, :3] = (a[y + k, x, :3] * 0.6).astype(np.uint8)


shadow_on_deck(a, 34, 66, 316)
comp(a, dusk(CRATE), 34, 283)
comp(a, dusk(CRATE), 37, 272)
shadow_on_deck(a, 68, 88, 318)
comp(a, dusk(BTOP), 67, 299)
comp(a, dusk(COIL), 128, 300)

img = Image.fromarray(a, 'RGBA')
img.convert('RGB').resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(TMP, 'v.png'))
print(save(img, '15_smugglers_pier'))
