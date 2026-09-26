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


def dusk(sp, k=(0.84, 0.76, 0.86), add=(6, 2, 14), rim=(255, 156, 96), rim_amt=0.45):
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


# ---------------------------------------------------------------- Geometrie
HY = 136            # Horizont
VPX = 104           # Fluchtpunkt x
DH = 350 - HY       # Augenhöhe über Deck (Pixel bei z = 1)
XL, XR = -76, 70    # Deckkanten (Welt-x in Pixel bei z = 1)
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


cloud(58, 62, 110, 10, 11, (96, 52, 112), (140, 66, 118), (214, 108, 114), (252, 164, 114), tilt=-0.02)
cloud(206, 46, 92, 9, 12, (86, 48, 108), (132, 62, 116), (206, 102, 112), (250, 170, 118))
cloud(124, 92, 110, 7, 13, (160, 66, 106), (196, 88, 104), (238, 132, 100), (255, 198, 130), tilt=0.02)
cloud(24, 110, 70, 5, 14, (176, 74, 102), (210, 100, 100), (246, 150, 102), (255, 208, 138))
cloud(236, 112, 54, 5, 15, (190, 82, 98), (222, 110, 96), (250, 162, 106), (255, 218, 148))

# ================================================================ MEER
q = np.clip((YY - HY) / (H - HY), 0, 1)
WAT = [(0.0, (222, 124, 98)), (0.035, (168, 80, 112)), (0.1, (98, 54, 124)), (0.24, (46, 46, 142)),
       (0.45, (20, 58, 172)), (0.7, (12, 46, 156)), (1.0, (6, 30, 122))]
# Wellenzüge: horizontale Streifen, nach vorn länger (wie water.png)
def streaks(seed, scale, stretch):
    big_ = value_noise(W * 8, H, scale, seed=seed, octaves=2)
    out = np.zeros((H, W))
    for y in range(HY + 1, H):
        k = 1 + q[y, 0] * stretch
        xs = ((np.arange(W) - SUN_X) / k + y * 37.3 + 900) % (W * 8)
        out[y] = big_[y, xs.astype(int)]
    return out


wave = streaks(1, 20, 9)
fine = streaks(5, 6, 6)
# Rang-Transformation -> gleichverteilte Schwelle; Übergänge folgen den Wellenstreifen statt Bayer-Karos
rk = np.argsort(np.argsort(fine[HY + 1:].ravel())).reshape(fine[HY + 1:].shape) / fine[HY + 1:].size
thr = np.zeros((H, W)); thr[HY + 1:] = rk
# nahe am Horizont längere Streifen statt feinem Rauschen
rkw = np.argsort(np.argsort(wave[HY + 1:HY + 12].ravel())).reshape((11, W)) / (11 * W)
thr[HY + 1:HY + 12] = rkw
tw = np.clip(q ** 0.85 + (wave - 0.5) * 0.16, 0, 1)
sea = np.zeros((H, W, 4), np.uint8); sea[..., 3] = 255
for i in range(len(WAT) - 1):
    p0, c0 = WAT[i]; p1, c1 = WAT[i + 1]
    m = (tw >= p0) & (tw <= p1)
    loc = (tw - p0) / (p1 - p0)
    sea[m & (loc <= thr), :3] = c0
    sea[m & (loc > thr), :3] = c1
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

# Glitzerpfad unter der Sonne: Wellenkämme leuchten in einer Bahn zum Betrachter auf
qq = np.clip((YY - HY) / (H - HY), 0, 1)
cxp = SUN_X + (YY - HY) * 0.22
half = 5 + qq * 24
g = np.exp(-((XX - cxp) / half) ** 2) * (1 - qq * 0.35)
sea_m = YY > HY
CREST = (wave >= np.roll(wave, 1, 0)) & (wave >= np.roll(wave, -1, 0))
gl1 = sea_m & CREST & (wave > 1 - 0.62 * g)
gl2 = sea_m & CREST & (wave > 1 - 0.46 * g)
gl3 = sea_m & CREST & (wave > 1 - 0.34 * g) & (g > 0.45)
setm(a, gl1, (212, 116, 112))
setm(a, gl2, (250, 176, 112))
setm(a, gl3, (255, 230, 160))
# helle Säule direkt unter der Sonne
for k in range(1, 10):
    y = HY + k
    hw = int(round(SUN_R * (1 - k / 11)))
    for x in range(SUN_X - hw, SUN_X + hw + 1):
        if wave[y, x] > 0.46 + k * 0.012:
            px(a, x, y, (255, 226, 152) if abs(x - SUN_X) < hw * 0.55 else (250, 180, 112))


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
# unregelmäßiger Felsfuß
rfo = random.Random(41)
ext = 0
for x in range(0, 104):
    if rfo.random() < 0.35:
        ext = int(np.clip(ext + rfo.choice([-1, 1]), 0, 2))
    if x > 98:
        ext = 0
    CLIFF[CB + 1:CB + 1 + ext, x] = True
CL = [(28, 16, 40), (40, 23, 54), (54, 31, 68), (70, 40, 82), (92, 50, 92)]
# Gegenlicht-Klippe: dunkle Masse, oben vom Himmel etwas aufgehellt, Felsbänder als Simse
nc = value_noise(W, H, 6, seed=13, octaves=2)
ctop = np.array([min(cliff_p.get(x, CB), CB) for x in range(W)])
depth = np.clip((YY - ctop[None, :]) / 40.0, 0, 1)
lvl = np.clip(0.62 - depth * 0.55 + (nc - 0.5) * 0.35, 0, 0.999)
ci = np.clip(np.floor(lvl * 4 + BAYER4[YY % 4, XX % 4] * 0.9), 0, 4).astype(int)
cc = np.array([P(c) for c in CL], np.uint8)[ci]
a[CLIFF] = cc[CLIFF]
# Simse: leicht schräge Felsbänder (oben hell, darunter Schattenfuge)
rv = random.Random(23)
for _ in range(26):
    x0 = rv.randrange(0, 100)
    if x0 not in cliff_p:
        continue
    y0 = rv.randrange(cliff_p[x0] + 3, CB - 1) if cliff_p[x0] + 3 < CB - 1 else None
    if y0 is None:
        continue
    ln = rv.randint(5, 16)
    y = float(y0)
    for i in range(ln):
        x = x0 + i
        yi = int(round(y))
        if x in cliff_p and CLIFF[yi, x] and CLIFF[yi + 1, x] and yi + 1 < CB:
            a[yi, x] = P(CL[3] if yi - cliff_p[x] < 22 else CL[2])
            a[yi + 1, x] = P(CL[0])
        y += 0.35
rr_ = random.Random(17)
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
# Findlinge am Fuß + Brandung
BOULD = [(8, 7, 3), (27, 5, 2), (44, 9, 4), (58, 5, 2), (84, 5, 2), (98, 4, 2)]
for (bx, bw, bh) in BOULD:
    for i in range(bw):
        f = (i + 0.5) / bw
        hgt = int(round(bh * math.sqrt(max(0, 1 - (2 * f - 1) ** 2)) + 0.3))
        for k in range(hgt):
            y = CB + 1 - k
            px(a, bx + i, y, CL[1] if k < hgt - 1 else (CL[3] if f < 0.6 else (214, 108, 100)))
        CLIFF[CB + 1 - max(0, hgt - 1):CB + 2, bx + i] = True
rf_ = random.Random(19)
for x in range(0, 108):
    col_ = np.nonzero(CLIFF[:, x])[0] if x < W else []
    if len(col_) == 0:
        continue
    yb = col_.max()
    r_ = rf_.random()
    if r_ < 0.75:
        px(a, x, yb + 1, (236, 200, 200) if rf_.random() < 0.4 else (196, 150, 176))
    if rf_.random() < 0.3:
        px(a, x + rf_.choice([-1, 1]), yb + 2, (170, 126, 170))

# Schmugglerhöhle am Klippenfuß: dunkler Eingang, drinnen Laternenschein
CVX, CVW, CVH = 72, 6.5, 8
cvm = (((XX - CVX) / CVW) ** 2 + ((YY - (CB + 0.5)) / CVH) ** 2 <= 1) & (YY <= CB)
dcv = np.hypot(XX - CVX, (YY - (CB - 2)) * 1.3)
setm(a, cvm, (16, 8, 20))
setm(a, cvm & (dcv < 6) & dither_mask(None, np.clip(1 - dcv / 6, 0, 1) * 1.2), (64, 30, 30))
setm(a, cvm & (dcv < 3.5) & dither_mask(None, np.clip(1 - dcv / 3.5, 0, 1) * 1.4), (122, 58, 34))
rimcv = ndimage.binary_dilation(cvm) & ~cvm & CLIFF & (YY <= CB)
setm(a, rimcv & (XX >= CVX), (92, 50, 92))
setm(a, rimcv & (XX < CVX), CL[0])
# Kiste + Laterne im Eingang
for (x, y, c) in [(CVX - 4, CB, (111, 74, 30)), (CVX - 3, CB, (142, 96, 43)), (CVX - 4, CB - 1, (160, 110, 52)), (CVX - 3, CB - 1, (111, 74, 30)),
                  (CVX + 2, CB - 3, (28, 18, 26)), (CVX + 2, CB - 2, (255, 214, 120)), (CVX + 2, CB - 1, (240, 150, 60)), (CVX + 2, CB, (28, 18, 26))]:
    px(a, x, y, c)
# Spiegelung der Klippe
for y in range(CB + 2, CB + 26):
    my = CB - (y - CB) * 1
    if my < 0:
        break
    row = CLIFF[my]
    k = (y - CB) / 26
    m = row & (wave[y] < 0.78 - k * 0.42)
    a[y, m, :3] = (a[y, m, :3].astype(int) * 0.45 + np.array([28, 16, 44]) * 0.55).astype(np.uint8)

# Leuchtturm auf der Klippe
PRE_LH = a.copy()
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
TOWER = (a != PRE_LH).any(2)
# Leuchtfeuer: Schein + schwacher Lichtkegel nach links
lx_, ly_ = LH_LIGHT
dl = np.hypot(XX - lx_, YY - ly_)
ang = np.abs((YY - ly_) / np.maximum(lx_ - XX, 1e-3))
beam = (XX < lx_ - 3) & (ang < 0.16) & (YY < CB)
bt = np.clip(1 - (lx_ - XX) / 40, 0, 1) * 0.5
for rad, col in ((6.5, (206, 112, 120)), (4.5, (240, 160, 128))):
    ring = (dl <= rad) & (dl > 2.2) & ~CLIFF & ~TOWER & dither_mask(None, np.full((H, W), 0.5 if rad > 5 else 1.0))
    setm(a, ring, col)

# ================================================================ SCHIFF
def ship_img():
    """Brigg-Silhouette (Bug links) mit geblähten Rahsegeln, Klüver, Wanten, Heckfenstern."""
    Wd, Hd = 48, 42
    mi = Image.new('L', (Wd, Hd), 0)
    d = ImageDraw.Draw(mi)
    HB = 38                                 # Wasserlinie
    # Rumpf
    hull = [(5, HB - 6), (9, HB - 5), (20, HB - 4), (32, HB - 4), (38, HB - 5), (38, HB - 8), (43, HB - 8),
            (43, HB - 3), (41, HB), (11, HB), (7, HB - 3)]
    d.polygon(hull, fill=1)
    d.line([(0, HB - 9), (7, HB - 6)], fill=2)                      # Bugspriet
    MASTS = [(15, 33), (31, 35)]
    for mx, mh in MASTS:
        d.line([(mx, HB - 4 - mh), (mx, HB - 5)], fill=1)
    for (mx, mh), sails in zip(MASTS, [[(3, 4), (5, 5), (6, 6)], [(4, 4), (5, 5), (7, 6)]]):
        y = HB - 4 - mh + 3
        for hw, hs in sails:
            d.line([(mx - hw - 1, y), (mx + hw + 1, y)], fill=1)          # Rah
            poly = [(mx - hw, y), (mx + hw, y), (mx + hw + 2, y + hs * 0.55), (mx + hw, y + hs),
                    (mx, y + hs + 1), (mx - hw, y + hs), (mx - hw + 1, y + hs * 0.5)]
            d.polygon(poly, fill=1)
            y += hs + 3
    # Klüver
    d.polygon([(2, HB - 10), (13, HB - 32), (10, HB - 9)], fill=1)
    # Wimpel
    d.line([(31, HB - 40), (35, HB - 40)], fill=1)
    d.line([(31, HB - 39), (33, HB - 39)], fill=1)
    # Stage
    d.line([(15, HB - 37), (31, HB - 39)], fill=2)
    d.line([(31, HB - 39), (42, HB - 9)], fill=2)
    m = np.array(mi)
    for x in (37, 39, 41):
        m[HB - 3, x] = 3
    m[HB - 10, 43] = 3
    return m, HB


def draw_ship(a, x0, ybase):
    m, HB = ship_img()
    D = (36, 18, 44)
    FINE = (70, 34, 66)
    for (y, x) in zip(*np.nonzero(m)):
        X, Y = x0 + x, ybase - HB + y
        v = m[y, x]
        if v == 1:
            px(a, X, Y, D)
        elif v == 2:
            px(a, X, Y, FINE)
        elif v == 3:
            px(a, X, Y, (255, 208, 124))
    # Sonnenkante an den rechten Segelrändern
    for (y, x) in zip(*np.nonzero(m == 1)):
        if x + 1 < m.shape[1] and m[y, x + 1] == 0 and y < HB - 5:
            px(a, x0 + x, ybase - HB + y, (120, 52, 82))
    # Laternenschein
    return m, HB


SHIP_X = 126
SHIPM, _ = draw_ship(a, SHIP_X, HY + 1)
# Spiegelung des Schiffs (gespiegelt, von Wellen zerrissen)
rsh = random.Random(31)
_, SHB = ship_img()
for k in range(1, 22):
    y = HY + 1 + k
    my = SHB - k
    if my < 0:
        break
    sh = rsh.choice([-1, 0, 0, 1]) if k > 3 else 0
    for x in range(SHIPM.shape[1]):
        if SHIPM[my, x] in (1, 3) and wave[y, SHIP_X + x] < 0.62 and rsh.random() > k / 22 * 0.7:
            X = SHIP_X + x + sh
            if SHIPM[my, x] == 3:
                a[y, X, :3] = (250, 180, 110)
            else:
                a[y, X, :3] = (a[y, X, :3].astype(int) * 0.45 + np.array([40, 20, 52]) * 0.55).astype(np.uint8)

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
joint = (jf < dzpx / jl * 1.0) & (1 / pxw >= 3.2)
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
# Abendglanz auf den hinteren, hellen Planken
far2 = np.clip((Zd - 2.2) / (ZEND - 2.2), 0, 1)
sheen = (idx >= 5) & ~(gap | joint) & dither_mask(None, far2 * 0.9)
dkf[sheen, :3] = dkf[sheen, :3] * 0.45 + np.array([226, 138, 108]) * 0.55
dkf[..., :3] = dkf[..., :3] * np.array([0.84, 0.76, 0.86]) + np.array([6, 2, 14])
a[deck] = np.clip(dkf, 0, 255).astype(np.uint8)[deck]
# Kanten: linke/rechte Deckkante dunkel, Stirnkante hell
edgeL = deck & ~np.roll(deck, 1, 1)
edgeR = deck & ~np.roll(deck, -1, 1)
setm(a, edgeL | edgeR, (23, 12, 3))
DECK_TMP = deck
# Stirnbalken-Oberkante (heller Streifen innen an den Kanten)
inL = deck & np.roll(edgeL, 1, 1)
inR = deck & np.roll(edgeR, -1, 1)
setm(a, inL & (YY > sy(ZEND) + 2), (122, 82, 44))
setm(a, inR & (YY > sy(ZEND) + 2), (170, 112, 66))
# Nägel an den Plankenstößen, etwas Moos in den Fugen
pw = (XR - XL) / NPL
rn = random.Random(12)
for p_ in range(NPL):
    zj = 1 - joints[p_]
    while zj < ZEND:
        if zj > 1.0:
            y = int(round(sy(zj)))
            xa = sx(zj, XL + p_ * pw); xb = sx(zj, XL + (p_ + 1) * pw)
            if xb - xa >= 7 and y + 1 < H:
                for xn in (int(xa) + 2, int(xb) - 2):
                    if DECK_TMP[y + 1, xn]:
                        px(a, xn, y + 1, (118, 120, 132))
                    if xb - xa >= 11 and DECK_TMP[y + 1, xn] and y + 2 < H:
                        px(a, xn, y + 2, (58, 56, 66))
        zj += jl
for _ in range(90):
    y = rn.randrange(int(sy(ZEND)) + 2, H)
    x = rn.randrange(0, W)
    if (gap | joint)[y, x] and deck[y, x]:
        px(a, x, y, (52, 74, 34) if rn.random() < 0.6 else (72, 104, 44))
# Vignette unten
vg = np.clip((YY - 290) / 60, 0, 1) * 0.55
vm = deck & dither_mask(None, vg)
a[vm, :3] = (a[vm, :3] * 0.82).astype(np.uint8)
yend = int(round(sy(ZEND)))
# Stegende fängt das Abendlicht
endrow = deck & (YY == yend + 1) & ~edgeL & ~edgeR
setm(a, endrow, (206, 124, 98))
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
            kk = k / (hh * 0.7)
            for i in range(ww):
                if src[i, 3] > 200:
                    xx_ = x + i + sh
                    if 0 <= xx_ < W and not DECK[yy_, xx_] and wave[yy_, xx_] < 0.72 - kk * 0.3:
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
    """Schaumkranz an der Wasserlinie (Abendtöne), unregelmäßig."""
    FO = [(236, 216, 230), (178, 168, 220), (130, 128, 204)]
    r = random.Random(int(cx * 31 + yw * 7))
    x0 = int(round(cx - w / 2)) - 1; x1 = x0 + w + 1
    for x in range(x0, x1 + 1):
        v = r.random()
        wpx(a, x, yw, FO[0] if v < 0.55 else FO[1] if v < 0.85 else FO[2])
    for x in (x0 - 1, x1 + 1):
        if r.random() < 0.7:
            wpx(a, x, yw, FO[2])
    if w >= 5:
        for x in range(x0, x1 + 1):
            if r.random() < 0.35:
                wpx(a, x, yw + 1, FO[1] if r.random() < 0.5 else FO[2])
        if r.random() < 0.8:
            wpx(a, x0 - 2 - r.randrange(2), yw + 1, FO[2])
        if r.random() < 0.8:
            wpx(a, x1 + 2 + r.randrange(2), yw + 1, FO[2])


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
    zs = list(np.arange(0.98, ZEND - 0.2, 0.42)) + [ZEND - 0.03]
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
        px(a, x0, int(round(yw)), (178, 168, 220))
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
water_sprite(a, FASS, 186, 292, refl=False, foam=False)
water_sprite(a, ROCK, 206, 338)


# ================================================================ LATERNEN
LK = {'k': (28, 18, 26), 'K': (92, 66, 58), 'W': (255, 248, 214), 'Y': (255, 214, 120), 'y': (240, 150, 60)}
LSPR = {
    'big': ["....k....", "...kKk...", "..kkkkk..", ".kkKKKkk.", ".kWWkYyk.", ".kWYkYyk.", ".kYYkyyk.",
            ".kYykyyk.", ".kkkkkkk.", "..kKKKk..", "...kkk..."],
    'med': ["...k...", "..kkk..", ".kKKKk.", ".kWYyk.", ".kYYyk.", ".kkkkk.", "..kkk.."],
    'small': ["..k..", ".kkk.", "kWYyk", "kYyyk", ".kkk."],
    'tiny': [".k.", "kYk", "kyk"],
}


def lantern_img(kind):
    rows = LSPR[kind]
    o = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in LK:
                o[y, x] = P(LK[ch])
    return Image.fromarray(o, 'RGBA')


def warm_glow(a, cx, cy, r, strength=1.0, add=(200, 112, 24), only=None, water_glint=True):
    """Weicher Laternenschein: additives warmes Licht in 4 geditherten Stufen auf Holz & Co.;
    auf dem Wasser leuchten stattdessen die Wellenkämme orange auf."""
    d = np.hypot(XX - cx, (YY - cy) * 1.05) / r
    t = np.clip(1 - d, 0, 1) ** 1.5 * strength
    lv = np.floor(t * 4 + BAYER4[YY % 4, XX % 4] * 0.999) / 4
    ai = a[..., :3].astype(int)
    isw = (ai[..., 2] > ai[..., 0] + 50) & (YY > HY) & ~DECK
    m = (lv > 0) & (d < 1) & ~isw
    if only is not None:
        m &= only
    amt = (lv * 0.55)[m][:, None]
    c = a[m, :3].astype(float)
    lum = c.mean(1, keepdims=True) / 255
    a[m, :3] = np.clip(c + np.array(add) * amt * (1 - lum) ** 1.5, 0, 255).astype(np.uint8)
    if water_glint:
        tw = np.clip(1 - d, 0, 1) * strength
        g1 = isw & CREST & (d < 1) & (wave > 1 - 0.55 * tw)
        g2 = isw & CREST & (d < 1) & (wave > 1 - 0.38 * tw)
        setm(a, g1, (196, 104, 110))
        setm(a, g2, (244, 150, 84))


for (z, side, cx, y0, w) in sorted(LANT, key=lambda l: -l[0]):
    kind = 'big' if w >= 8 else 'med' if w >= 6 else 'small' if w >= 4 else 'tiny'
    li = lantern_img(kind)
    arm = {'big': 6, 'med': 4, 'small': 3, 'tiny': 2}[kind]
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
    rr = {'big': 30, 'med': 20, 'small': 13, 'tiny': 8}[kind]
    warm_glow(a, gx, gy, rr, 1.5)
    warm_glow(a, gx, gy, rr * 0.4, 1.2, add=(120, 90, 40), water_glint=False)
    comp(a, li, lx, ly)
    # Spiegelung im Wasser: Wellenkämme unter der Laterne leuchten auf
    yw = int(round(HY + (DH + WATER) / z))
    L = {'big': 46, 'med': 28, 'small': 16, 'tiny': 9}[kind]
    hw = li.width * 0.9
    for y in range(yw + 1, min(H - 6, yw + L)):
        k = (y - yw) / L
        for x in range(int(gx - hw * 2), int(gx + hw * 2) + 1):
            if not (0 <= x < W) or DECK[y, x]:
                continue
            gg = np.exp(-((x - gx) / (hw * (0.7 + k))) ** 2) * (1 - k)
            if CREST[y, x] and wave[y, x] > 1 - 0.5 * gg and int(a[y, x, 2]) > int(a[y, x, 0]) + 50:
                a[y, x] = P((255, 214, 130) if gg > 0.55 else (236, 140, 72))


# Höhlenlicht auf dem Wasser
warm_glow(a, CVX, CB + 1, 13, 1.3, only=(YY > CB + 1))

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



# Schmugglerluke (Area-Sprite aus pier.png) und Pfütze, die den Abendhimmel spiegelt
def hatch():
    c = np.array(PIER.crop((31, 58, 54, 75)))
    c[:, 0, 3] = 0
    for yy_ in (3, 4, 12, 13):
        c[yy_, 0, 3] = 255
    return Image.fromarray(c, 'RGBA')


def puddle_sky():
    c = np.array(area(AREA + 'puddle').crop((56, 0, 84, 18))).astype(int)
    al = c[..., 3] > 0
    L = c[..., :3].mean(2)
    lo, hi = np.percentile(L[al], 5), np.percentile(L[al], 95)
    t = np.clip((L - lo) / max(1, hi - lo), 0, 1)
    PAL = [(12, 40, 140), (22, 56, 166), (60, 50, 140), (150, 70, 116), (236, 150, 108)]
    yy_ = np.mgrid[0:c.shape[0], 0:c.shape[1]][0]
    tt = np.clip(t * 0.25 + (1 - yy_ / c.shape[0]) ** 1.3 * 0.9 - 0.05, 0, 0.999)   # hinten spiegelt der Horizont
    idx_ = np.floor(tt * len(PAL)).astype(int)
    out = np.zeros_like(c)
    out[..., :3] = np.clip(np.array(PAL)[idx_] * 0.82 + c[..., :3] * 0.18, 0, 255).astype(int)
    out[L > hi + 20, :3] = (255, 226, 170)
    edge = al & ~ndimage.binary_erosion(al)
    out[edge, :3] = (64, 34, 40)
    out[..., 3] = np.where(al, 255, 0)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


comp(a, dusk(hatch(), rim_amt=0), 82, 249)
comp(a, puddle_sky(), 104, 222)

shadow_on_deck(a, 46, 78, 316)
comp(a, dusk(CRATE), 46, 283)
comp(a, dusk(CRATE), 49, 272)
shadow_on_deck(a, 80, 100, 318)
comp(a, dusk(BTOP), 79, 299)
comp(a, dusk(COIL), 126, 302)


# ================================================================ RUDERBOOT (links, am Steg vertäut)
def rowboat():
    """Kleines Schmugglerboot, 3/4-Draufsicht wie die Area-Sprites (Bug rechts)."""
    L, Wb, SIDE = 32, 11, 3
    Hh = Wb + SIDE + 3
    o = np.zeros((Hh, L + 2, 4), np.uint8)
    top = np.zeros((Hh, L + 2), bool)
    cy = Wb / 2
    for x in range(L):
        f = x / (L - 1)
        hw = (Wb / 2) * (1 - max(0, (f - 0.5) / 0.5) ** 1.7) * (0.8 + 0.2 * min(1, f / 0.1))
        for y in range(Wb):
            if abs(y + 0.5 - cy) <= hw + 0.1:
                top[y + 1, x + 1] = True
    inner = ndimage.binary_erosion(top, iterations=1)
    inner2 = ndimage.binary_erosion(top, iterations=2)
    rim = top & ~inner
    side = np.zeros_like(top)
    for x in range(L + 2):
        ys = np.nonzero(top[:, x])[0]
        if len(ys):
            yb = ys.max()
            f = x / (L + 1)
            n = SIDE if f < 0.8 else max(1, round(SIDE * (1 - (f - 0.8) / 0.25)))
            side[yb + 1:yb + 1 + n, x] = True
    body = top | side
    outl = ndimage.binary_dilation(body) & ~body
    for y, x in zip(*np.nonzero(inner)):
        o[y, x] = P((61, 36, 12))
    for y, x in zip(*np.nonzero(inner2)):
        o[y, x] = P((79, 48, 15) if (x + (y // 2)) % 6 else (61, 36, 12))
    for y, x in zip(*np.nonzero(rim)):
        o[y, x] = P((191, 140, 74) if y <= cy + 1 else (142, 96, 43))
    for y, x in zip(*np.nonzero(side)):
        yb = np.nonzero(top[:, x])[0].max()
        k = y - yb
        o[y, x] = P([(126, 85, 36), (111, 74, 30), (94, 61, 23)][min(2, k - 1)])
    for y, x in zip(*np.nonzero(outl)):
        o[y, x] = P((23, 12, 3))
    # Ruderbänke
    for bx in (8, 19):
        for y in range(Hh):
            if inner[y, bx]:
                o[y, bx] = P((160, 110, 52)); o[y, bx + 1] = P((111, 74, 30))
    # Ladung: Sack (links) und Kistchen (rechts)
    sack = [".ooo.", "oSSso", "oSsso", ".ooo."]
    for j, row in enumerate(sack):
        for i, ch in enumerate(row):
            if ch != '.':
                o[4 + j, 12 + i] = P({'S': (226, 196, 146), 's': (189, 157, 108), 'o': (88, 62, 30)}[ch])
    for y in range(4, 9):
        for x in range(22, 27):
            edge = y in (4, 8) or x in (22, 26)
            o[y, x] = P((88, 57, 22) if edge else ((226, 184, 112) if y == 5 else (181, 129, 63)))
    return Image.fromarray(o, 'RGBA')


BOAT = rowboat()
BX, BY = 18, 206
# Spiegelung unter dem Boot (von Wellen zerrissen)
bm = np.array(BOAT)[..., 3] > 0
ba_ = np.array(dusk(BOAT))
bh_ = BOAT.height
for k in range(1, 8):
    y = BY + bh_ - 1 + k
    src = bh_ - 1 - k
    for x in range(BOAT.width):
        X = BX + x
        if src >= 0 and bm[src, x] and not DECK[y, X] and wave[y, X] < 0.74 - k * 0.05:
            a[y, X, :3] = np.clip(a[y, X, :3].astype(int) * 0.5 + ba_[src, x, :3] * 0.22 + np.array([6, 4, 18]), 0, 255)
comp(a, dusk(BOAT), BX, BY)
# Schaumkranz
for x in range(BX, BX + BOAT.width):
    ys = np.nonzero(bm[:, x - BX])[0]
    if len(ys) and random.Random(x * 17).random() < 0.45:
        wpx(a, x, BY + ys.max() + 1, (178, 168, 220) if x % 2 else (236, 216, 230))
# Festmacherleine zum Pfahl
post_z = [p_ for p_ in POSTS if p_[1] == 'L' and abs(p_[0] - 2.66) < 0.05][0][0]
tx, ty = sx(post_z, XL - 5) - 2, sy(post_z, 10)
fx, fy = BX + BOAT.width - 2, BY + 6
n = int(max(abs(tx - fx), abs(ty - fy)))
for i in range(n + 1):
    t_ = i / n
    x = fx + (tx - fx) * t_
    y = fy + (ty - fy) * t_ + 3 * math.sin(t_ * math.pi)
    px(a, round(x), round(y), (150, 118, 76))
# Bootslaterne am Heck
bl = lantern_img('small')
warm_glow(a, BX + 3, BY - 1, 9, 1.1)
comp(a, bl, BX + 1, BY - 3)


# ================================================================ MÖWEN
GULLS = {
    'up': ["#.......#", ".##...##.", "...#.#...", "....#...."],
    'glide': ["##.....##", "..##.##..", "....#...."],
    'small': ["#...#", ".#.#.", "..#.."],
}
for (kind, x, y, col) in [('up', 62, 124, (64, 30, 64)), ('glide', 78, 112, (60, 28, 62)), ('small', 96, 120, (92, 40, 78)),
                          ('glide', 196, 70, (46, 24, 58)), ('small', 212, 80, (60, 30, 66)), ('small', 186, 88, (70, 34, 70))]:
    for j, row in enumerate(GULLS[kind]):
        for i, ch in enumerate(row):
            if ch == '#':
                px(a, x + i, y + j, col)

# Möwe auf dem vordersten rechten Pfahl (Area-Sprite gull-side, 1x)
GS = area(AREA + 'gull-side').crop((0, 0, 24, 15))
gp = [p_ for p_ in POSTS if p_[1] == 'R'][-1]
gz = gp[0]
gcx = sx(gz, XR + 5)
gtop = int(round(sy(gz, PH_UP)))
comp(a, dusk(GS, k=(0.86, 0.8, 0.9), add=(4, 2, 12)), int(round(gcx - 13)), gtop - 14)

# Funkeln auf dem Glitzerpfad und am Steg
dsp = ImageDraw.Draw(img_tmp := Image.fromarray(a, 'RGBA'))
for (x, y, sz) in [(176, 152, 2), (196, 178, 1), (236, 214, 1), (224, 262, 2), (228, 300, 1), (166, 146, 1)]:
    if not DECK[y, x]:
        sparkle(dsp, x, y, sz, (255, 214, 140), core=(255, 250, 226))
a = np.array(img_tmp)

# ================================================================ RAHMEN + TITEL
img = Image.fromarray(a, 'RGBA')
bevel_frame(img, (18, 9, 3), (191, 140, 74), (111, 74, 30), (61, 36, 12), (23, 12, 3), width=6)
a = np.array(img)
# Holzmaserung im Rahmen
rf = random.Random(44)
for _ in range(120):
    side = rf.randrange(4)
    if side < 2:
        x = rf.randrange(8, W - 8); y = rf.choice([2, 3]) if side == 0 else rf.choice([H - 4, H - 3])
        for k in range(rf.randint(2, 6)):
            px(a, x + k, y, (94, 61, 23))
    else:
        y = rf.randrange(8, H - 8); x = rf.choice([2, 3]) if side == 2 else rf.choice([W - 4, W - 3])
        for k in range(rf.randint(2, 6)):
            px(a, x, y + k, (94, 61, 23))
# Eisenbeschläge in den Ecken (wie an der Kiste)
IRON = [(38, 43, 49), (56, 63, 71), (107, 116, 125), (142, 152, 161)]
for (cx_, cy_, fx, fy) in [(0, 0, 1, 1), (W - 1, 0, -1, 1), (0, H - 1, 1, -1), (W - 1, H - 1, -1, -1)]:
    for i in range(12):
        for j in range(12):
            if i < 6 or j < 6:
                if i + j < 17:
                    x = cx_ + fx * i; y = cy_ + fy * j
                    edge = (i == 0 or j == 0 or i + j == 16 or (i == 5 and j >= 6) or (j == 5 and i >= 6))
                    c = IRON[0] if edge else (IRON[2] if (i + j) < 6 else IRON[1])
                    px(a, x, y, c)
    for (i, j) in [(2, 2), (8, 2), (2, 8)]:
        px(a, cx_ + fx * i, cy_ + fy * j, IRON[3])
        px(a, cx_ + fx * (i + 1), cy_ + fy * (j + 1), IRON[0])

# Titel
ti = text_img("SMUGGLER'S PIER", 13, (255, 214, 128, 255), (34, 16, 34, 255))
ta = np.array(ti)
# zweifarbig: untere Hälfte orange
body = (ta[..., 3] > 0) & (np.abs(ta[..., :3].astype(int) - [255, 214, 128]).sum(2) < 10)
hh_ = ta.shape[0]
ys_ = np.nonzero(body.any(1))[0]
mid = (ys_.min() + ys_.max()) / 2 + 1
low = body & (np.arange(hh_)[:, None] > mid)
ta[low, :3] = (246, 160, 84)
ta[body & (np.arange(hh_)[:, None] == ys_.min()), :3] = (255, 240, 190)
ti = Image.fromarray(ta, 'RGBA')
tx = (W - ti.width) // 2
tyy = 13
shadow = silhouette(ti, (12, 6, 24, 255))
img2 = Image.fromarray(a, 'RGBA')
img2.alpha_composite(shadow, (tx + 1, tyy + 1))
img2.alpha_composite(ti, (tx, tyy))
a = np.array(img2)
dd = ImageDraw.Draw(img2)
for sx_ in (tx - 9, tx + ti.width + 8):
    cy_ = tyy + ti.height // 2
    img2 = Image.fromarray(a, 'RGBA'); dd = ImageDraw.Draw(img2)
    sparkle(dd, sx_, cy_, 2, (246, 160, 84), core=(255, 240, 190))
    a = np.array(img2)

img = Image.fromarray(a, 'RGBA')
if 'PP_TMP' in os.environ:
    img.convert('RGB').resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(TMP, 'v.png'))
print(save(img, '15_smugglers_pier'))
