# -*- coding: utf-8 -*-
"""05 Wowhalla – Die Halle der Coolness auf ihrer Wolkeninsel, Bifab-Regenbogenbrücke mit Fackeln,
Helden des Cool-Archetyps auf dem Weg zur Halle, Wowkyrie am Himmel."""
from lib import *

rnd = random.Random(5)
YY, XX = np.mgrid[0:H, 0:W]


# ---------------------------------------------------------------- Helfer
def ordered(v, n):
    """Wert v (0..1) auf n Stufen mit Bayer-Dithering -> Index 0..n-1."""
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.clip(np.floor(v * (n - 1) + BAYER4[yy % 4, xx % 4]), 0, n - 1).astype(int)


def put(img, mask, col, ox=0, oy=0):
    a = np.array(img)
    h, w = mask.shape
    sub = a[oy:oy + h, ox:ox + w]
    m = mask[:sub.shape[0], :sub.shape[1]]
    if len(col) == 3:
        col = tuple(col) + (255,)
    sub[m] = col
    return Image.fromarray(a, 'RGBA')


def layer_from(idx, mask, pal):
    P = np.array([tuple(c) + (255,) if len(c) == 3 else c for c in pal], np.uint8)
    out = P[np.clip(idx, 0, len(pal) - 1)]
    out[~mask] = 0
    return Image.fromarray(out, 'RGBA')


def cloud3d(w, h, circles, pal, light=(-0.55, -0.75, 0.55), flat=None, rim=None):
    """Plastische Pixelwolke aus Kreisen; pal dunkel -> hell. flat: y ab dem abgeschnitten wird."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    hgt = np.zeros((h, w))
    for (cx, cy, r) in circles:
        d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)
        hgt = np.maximum(hgt, np.sqrt(np.clip(1 - d2, 0, 1)) * r)
    m = hgt > 0
    if flat is not None:
        m &= yy <= flat
    gy, gx = np.gradient(hgt)
    n = np.dstack([-gx, -gy, np.ones_like(hgt) * 1.2])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array(light); L = L / np.linalg.norm(L)
    s = -(n[..., 0] * L[0] + n[..., 1] * L[1]) * 0.9 + n[..., 2] * L[2] * 0.6
    s = np.clip((s + 0.25) / 1.1, 0, 1)
    # nach unten dunkler
    s = s * 0.75 + 0.25 * (1 - np.clip((yy - yy[m].min() if m.any() else 0) / max(1, h), 0, 1))
    idx = ordered(s, len(pal))
    img = layer_from(idx, m, pal)
    if rim:
        a = np.array(img)
        e = m & ~ndimage.binary_erosion(m)
        bottom = e & (np.roll(~m, -1, 0) | (yy >= h - 1))
        a[bottom] = tuple(rim) + (255,)
        img = Image.fromarray(a, 'RGBA')
    return img


def bank(w, h, n, seed, rmin, rmax, base=None):
    r = random.Random(seed)
    base = h - 2 if base is None else base
    circ = []
    for i in range(n):
        x = (i + r.uniform(0.2, 0.8)) * w / n
        mid = 1 - abs(x / w - 0.5) * 1.6
        rr = r.uniform(rmin, rmax) * (0.55 + 0.45 * max(0, mid))
        circ.append((x, base - rr * r.uniform(0.2, 0.7), rr))
    return circ


def scale2x(img):
    """EPX/Scale2x: 2x-Vergrößerung mit geglätteten Pixel-Diagonalen (statt grober Blöcke)."""
    a = np.array(img).astype(np.int64)
    key = (a[..., 0] << 24) | (a[..., 1] << 16) | (a[..., 2] << 8) | a[..., 3]
    key = np.where(a[..., 3] == 0, -1, key)
    P = np.pad(key, 1, mode='edge')
    A = P[:-2, 1:-1]; B = P[1:-1, 2:]; C = P[1:-1, :-2]; D = P[2:, 1:-1]
    h, w = key.shape
    src = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    up_ = src[:-2, 1:-1]; rt = src[1:-1, 2:]; lf = src[1:-1, :-2]; dn = src[2:, 1:-1]
    out = np.zeros((h * 2, w * 2, 4), np.int64)
    e0 = (C == A) & (C != D) & (A != B)
    e1 = (A == B) & (A != C) & (B != D)
    e2 = (D == C) & (D != B) & (C != A)
    e3 = (B == D) & (B != A) & (D != C)
    out[0::2, 0::2] = np.where(e0[..., None], up_, a)
    out[0::2, 1::2] = np.where(e1[..., None], rt, a)
    out[1::2, 0::2] = np.where(e2[..., None], lf, a)
    out[1::2, 1::2] = np.where(e3[..., None], dn, a)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def comp(img, sprite, x, y):
    img.alpha_composite(sprite, (int(x), int(y)))


def cut_sky(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ((b - r > 18) & (g - r > 10)) | ((r > 200) & (g > 215) & (b > 215) & (b >= r - 2))



def add(img, m, rgb):
    a = np.array(img).astype(int); a[m, :3] = np.clip(a[m, :3] + np.array(rgb), 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def setc(img, m, col):
    a = np.array(img); a[m] = tuple(col) + (255,)
    return Image.fromarray(a)


# ---------------------------------------------------------------- Himmel
SKY = [(0, (34, 84, 146)), (0.16, (46, 118, 172)), (0.38, (76, 164, 196)), (0.58, (112, 198, 212)),
       (0.78, (160, 222, 228)), (1, (206, 240, 242))]
im = new()
im.alpha_composite(dither_gradient((W, H), SKY, func=lambda x, y: y / 330.0))

# Diagonale "Cool"-Streifen, oben kräftiger
u = (XX + YY * 0.8) % 34
band = u < 12
t = np.clip(0.75 - YY / 330.0, 0.1, 0.7)
im = add(im, band & dither_mask(None, t), (14, 20, 16))
im = add(im, (u < 1) & (YY < 260) & dither_mask(None, t + 0.2), (22, 26, 20))

# Glorienschein / Strahlenkranz hinter der Halle
GX, GY = 126, 126
ang = np.arctan2(YY - GY, XX - GX)
dist = np.hypot(XX - GX, (YY - GY) * 1.15)
rays = np.sin(ang * 12 + 0.3) > 0.4
im = add(im, rays & dither_mask(None, np.clip(1 - dist / 190, 0, 1) * 0.6), (26, 28, 18))
for rad, col, st in [(118, (164, 226, 226), 0.75), (86, (200, 240, 234), 0.8), (58, (236, 250, 234), 0.9)]:
    im = setc(im, dither_mask(None, np.clip(1 - dist / rad, 0, 1) * st * 1.5), col)

# kleine Himmelswolken (Area-Sprites, 1x)
cl = area('wowhalla/clouds')
lab, n = ndimage.label(np.array(cl)[..., 3] > 0, structure=np.ones((3, 3)))
small = []
for s in ndimage.find_objects(lab):
    c = cl.crop((s[1].start, s[0].start, s[1].stop, s[0].stop))
    if c.width > 5:
        small.append(c)
small.sort(key=lambda c: -c.width)
for (i, x, y) in [(0, 176, 40), (1, 22, 44), (2, 214, 104), (1, 150, 6), (2, 10, 150), (0, 196, 150)]:
    comp(im, small[i % len(small)], x, y)

# ---------------------------------------------------------------- Kumulus-Türme hinter der Insel
CU = [(128, 194, 212), (150, 208, 222), (174, 222, 232), (198, 234, 240), (222, 245, 248)]
for (x0, y0, w, h, seed, n, r0, r1) in [(-16, 104, 96, 76, 61, 7, 12, 26), (170, 96, 100, 84, 62, 7, 12, 28)]:
    r_ = random.Random(seed)
    circ = []
    for i in range(n):
        cx = r_.uniform(10, w - 10)
        top = abs(cx - w / 2) / (w / 2)
        rr = r_.uniform(r0, r1) * (1.1 - 0.5 * top)
        circ.append((cx, h - rr * r_.uniform(0.3, 1.4) - 4, rr))
    comp(im, cloud3d(w, h, circ, CU, flat=h - 3), x0, y0)

# ---------------------------------------------------------------- ferne Wolkenbänke
for (y0, h, pal, seed, rr, nn) in [
        (196, 60, [(112, 180, 202), (132, 196, 212), (154, 210, 220), (178, 224, 230)], 3, (9, 20), 16),
        (222, 60, [(126, 190, 210), (152, 208, 222), (180, 224, 234), (206, 238, 242)], 8, (10, 22), 14)]:
    comp(im, cloud3d(W + 40, h, bank(W + 40, h, nn, seed, *rr), pal), -20, y0)

# ferne Mini-Inseln mit Zahnradturm (aus dem Wowhalla-Hintergrund)
tile = area('wowhalla/tile')


def mini_island(w, d, seed, pal, snow=(232, 244, 250)):
    r = random.Random(seed)
    hh = d + 4
    m = np.zeros((hh, w), bool)
    for x in range(w):
        uu = abs(x - (w - 1) / 2) / (w / 2)
        dep = int(d * (1 - uu) ** 0.8) + r.randint(0, 2)
        m[0:max(2, dep), x] = True
    yy, xx = np.mgrid[0:hh, 0:w]
    v = 1 - yy / hh * 0.8 - (xx / w) * 0.3
    img = layer_from(ordered(np.clip(v, 0, 1), len(pal)), m, pal)
    top = np.zeros_like(m); top[0:2, :] = True
    return put(img, top & m, snow)


tower = tile.crop((24, 34, 40, 75))
ta = np.array(tower).astype(int)
ta[..., 3] = np.where((ta[..., 2] > 180) & (ta[..., 1] > 170), 0, 255)
tower = Image.fromarray(ta.astype(np.uint8))
tower = adjust(tower, 1.08, 0.85, 0.7)
FARP = [(70, 100, 134), (90, 124, 156), (114, 150, 176), (142, 178, 198)]
comp(im, tower, 213, 150)
comp(im, mini_island(36, 12, 4, FARP), 203, 188)
comp(im, cloud3d(48, 14, bank(48, 14, 5, 21, 4, 7), [(160, 214, 226), (192, 232, 238), (226, 246, 250)]), 197, 184)
tw2 = tower.crop((0, 12, tower.width, tower.height))
tw2 = shrink(tw2, 0.7)
comp(im, tw2, 22, 186)
comp(im, mini_island(26, 9, 6, FARP), 12, 198)
comp(im, cloud3d(36, 12, bank(36, 12, 4, 22, 3, 6), [(160, 214, 226), (192, 232, 238), (226, 246, 250)]), 6, 194)

# ---------------------------------------------------------------- Titel
tt = text_img('WOWHALLA', 20, (255, 216, 76, 255), outline_col=(92, 44, 10, 255), shadow=(24, 44, 88, 255))
comp(im, tt, W // 2 - tt.width // 2, 13)
dd = ImageDraw.Draw(im)
for (x, y) in [(W // 2 - tt.width // 2 - 9, 22), (W // 2 + tt.width // 2 + 8, 22)]:
    sparkle(dd, x, y, 3, (255, 220, 110))

# ---------------------------------------------------------------- Halle-Position
HX, HY = 37, 80

# Dampf aus dem Schlot
smoke = area('wowhalla/smoke')
sm_frames = [smoke.crop((k * 48, 0, k * 48 + 48, 33)) for k in range(8)]


def steamify(s, light=(240, 248, 252), mid=(208, 226, 238), dark=(160, 190, 212)):
    a = np.array(s).astype(int)
    L = a[..., :3].mean(2)
    t = np.clip((L - 62) / 40, 0, 1)
    idx = ordered(t, 3)
    P = np.array([dark, mid, light])
    a[..., :3] = P[idx]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


chim_x, chim_y = HX + 142, HY + 32
for k, (dx, dy) in enumerate([(-40, -60), (-30, -33)]):
    f = steamify(sm_frames[(k * 3 + 1) % 8])
    if k == 0:  # oben gedithert ausblenden
        fa_ = np.array(f); fy2 = np.mgrid[0:fa_.shape[0], 0:fa_.shape[1]][0]
        fa_[..., 3] = np.where(dither_mask(None, np.clip(fy2 / 18.0, 0, 1)), fa_[..., 3], 0)
        f = Image.fromarray(fa_)
    comp(im, f, chim_x + dx, chim_y + dy)

# ---------------------------------------------------------------- Wowkyrie am Himmel
RB = [(236, 84, 92), (242, 160, 70), (242, 226, 90), (100, 214, 90), (70, 200, 236), (70, 120, 226), (160, 96, 236)]
wk = cut_by(native('Wowkyrie, Bringer of Coolness'), (16, 4, 50, 44), cut_sky)
wka = np.array(wk); wka[:, 30:, 3] = 0
wk = Image.fromarray(wka); wk = wk.crop(wk.getbbox())
wk2 = outline(scale2x(wk), (26, 22, 52, 255))
WX, WY = 12, 38
dtr = ImageDraw.Draw(im)
x0 = WX + 44
for x in range(x0, x0 + 64):
    uu = x - x0
    yb = WY + 48 + int(round(-uu * 0.35 - 5 * math.sin(uu * 0.07)))
    fade = uu / 64
    for i, c in enumerate(RB):
        for k in range(2):
            if fade < BAYER4[(yb + i * 2 + k) % 4, x % 4] * 1.1 + 0.05 or uu < 20:
                dtr.point((x, yb + i * 2 + k), fill=c)
rs = random.Random(9)
for _ in range(9):
    uu = rs.randrange(30, 78); x = x0 + uu
    y = WY + 48 + int(round(-uu * 0.35 - 5 * math.sin(uu * 0.07))) + rs.randrange(-4, 16)
    if rs.random() < 0.4:
        sparkle(dtr, x, y, 2, (255, 250, 210))
    else:
        dtr.point((x, y), fill=(255, 255, 255))
comp(im, wk2, WX, WY)

# ---------------------------------------------------------------- Hauptinsel
IX0, IX1, ITOP = 30, 222, HY + 86
iw = IX1 - IX0
ih = 90
isl = np.zeros((ih, iw), bool)
prof = []
for x in range(iw):
    uu = (x - iw * 0.5) / (iw / 2)
    dep = 12 + 54 * max(0, 1 - abs(uu)) ** 1.5
    dep += 4 * math.sin(x * 0.37) + 3 * math.sin(x * 0.91 + 1) + rnd.randint(-1, 1)
    prof.append(int(dep))
    isl[0:int(dep), x] = True
yy, xx = np.mgrid[0:ih, 0:iw]
noise = value_noise(iw, ih, 10, seed=3)
strata = np.sin(yy * 0.6 + noise * 6) * 0.1
v = 0.98 - yy / 70 * 0.75 - (xx / iw) * 0.3 + strata + (noise - 0.5) * 0.3
ROCK = [(28, 26, 52), (44, 42, 80), (64, 62, 106), (90, 90, 136), (122, 124, 168), (160, 166, 204)]
rock = layer_from(ordered(np.clip(v, 0, 1), len(ROCK)), isl, ROCK)
ra = np.array(rock)
for k in range(16):
    x = rnd.randrange(8, iw - 8); y = rnd.randrange(6, 26)
    for s in range(rnd.randint(5, 14)):
        if 0 <= y < ih and 0 <= x < iw - 1 and isl[y, x]:
            ra[y, x] = ROCK[0] + (255,)
            if isl[y, x + 1]:
                ra[y, x + 1] = ROCK[4] + (255,)
        y += 1; x += rnd.choice([-1, 0, 0, 1])
e = isl & ~ndimage.binary_erosion(isl)
ra[e & (yy > 3)] = (20, 16, 40, 255)
rock = Image.fromarray(ra)
d = ImageDraw.Draw(rock)
for x in range(2, iw - 2, 3):
    if rnd.random() < 0.55:
        y = prof[x] - 1
        L_ = rnd.randint(2, 6)
        d.line((x, y, x, y + L_), fill=(180, 224, 242))
        d.point((x, y), fill=(240, 252, 255))
        if L_ > 3:
            d.point((x, y + L_), fill=(110, 180, 214))
# Kristalle (Coolness-Eis) in der Wand
for (cx, cy) in [(40, 20), (120, 30), (150, 14), (80, 40)]:
    for k in range(4):
        d.line((cx + k, cy - k * 2 + 6, cx + k, cy + 6), fill=[(90, 200, 236), (150, 230, 250), (220, 250, 255), (70, 150, 210)][k])
comp(im, rock, IX0, ITOP)

# Zahnräder
gears = area('wowhalla/gears')
glab, gn = ndimage.label(np.array(gears)[..., 3] > 0, structure=np.ones((3, 3)))
GEARS = [gears.crop((s[1].start, s[0].start, s[1].stop, s[0].stop)) for s in ndimage.find_objects(glab)]
big_g = [g for g in GEARS if g.width >= 24]
grey_g = [g for g in GEARS if g.width < 24 and np.array(g)[..., :3].astype(int).std(2)[np.array(g)[..., 3] > 0].mean() < 10]
orange_s = [g for g in GEARS if g.width < 24 and g not in grey_g]
comp(im, big_g[1], IX0 + 128, ITOP + 6)

# Plateau (Boden mit Cool-Streifen)
PW = iw + 6
pl = np.zeros((26, PW), bool)
for x in range(PW):
    uu = (x - PW / 2) / (PW / 2)
    pl[0:int(11 + 9 * max(0, 1 - uu * uu)), x] = True
py, px = np.mgrid[0:26, 0:PW]
stripe = ((px + py) // 3) % 2 == 0
FLOOR = [(150, 214, 238), (236, 248, 252), (104, 180, 214), (52, 110, 160)]
fl = np.where(stripe, 0, 1)
bottom_edge = pl & ~np.roll(pl, -1, 0)
fl[bottom_edge] = 3
fl[np.roll(bottom_edge, -1, 0) & pl] = 2
comp(im, layer_from(fl, pl, FLOOR), IX0 - 3, ITOP - 6)

# Halle (1x)
comp(im, area('wowhalla/hall'), HX, HY)

# Wolken an den Inselflanken
CL = [(146, 196, 220), (184, 222, 236), (222, 242, 250), (250, 254, 255)]
for (cx, cy, w, h, seed) in [(8, ITOP - 6, 60, 22, 11), (196, ITOP - 10, 60, 24, 12)]:
    comp(im, cloud3d(w, h, bank(w, h, 6, seed, 5, 10), CL, rim=(118, 168, 200)), cx, cy)

# ---------------------------------------------------------------- Wolkenmeer
for (y0, h, pal, seed, rr, nn) in [
        (246, 60, [(140, 196, 218), (176, 220, 234), (212, 238, 246), (240, 250, 254)], 31, (11, 22), 11),
        (276, 70, [(150, 202, 224), (190, 228, 240), (226, 244, 250), (252, 255, 255)], 32, (13, 25), 9)]:
    comp(im, cloud3d(W + 40, h, bank(W + 40, h, nn, seed, *rr), pal, rim=(124, 172, 204)), -20, y0)

# Zahnrad-Insel rechts (Maschinerie der Coolness)
MIDP = [(52, 50, 92), (74, 72, 118), (102, 102, 150), (138, 142, 184)]
tower_full = Image.fromarray(ta.astype(np.uint8))
GIX, GIY = 190, 272
comp(im, tower_full, GIX + 30, GIY - 40)
comp(im, big_g[0], GIX + 4, GIY - 27)
comp(im, orange_s[0], GIX + 26, GIY - 12)
comp(im, mini_island(52, 16, 9, MIDP), GIX, GIY)
comp(im, steamify(area('wowhalla/steam')), GIX + 12, GIY - 50)
comp(im, cloud3d(64, 16, bank(64, 16, 6, 51, 4, 8), CL, rim=(118, 168, 200)), GIX - 8, GIY + 6)

# Die Nornstellar auf einer Eisscholle (links)
nvn = native('The Nornstellar, Foretellers of Coolness')


def norn_bg(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; L = a[..., :3].mean(2)
    m = ((b > 200) & (L > 150)) | ((r - b > 70) & (g > 120)) | ((r > g) & (g > b) & (r - b > 40) & (L > 70) & (L < 170)) | ((b > r + 30) & (L < 120))
    return m & ~((b < 40) & (r > 220))


norn = cut_by(nvn, (14, 10, 68, 44), norn_bg)
na = np.array(norn); nm = na[..., 3] > 0
nL = na[..., :3].astype(int).mean(2)
nm[0:4, 26:30] &= nL[0:4, 26:30] > 30
nm[0:13, 36:45] &= nL[0:13, 36:45] > 30
lab, k = ndimage.label(nm); sz = ndimage.sum(nm, lab, range(1, k + 1)); nm = np.isin(lab, np.where(sz > 10)[0] + 1)
na[..., 3] = np.where(nm, 255, 0)
norn = Image.fromarray(na); norn = norn.crop(norn.getbbox())
norn = outline(norn, (24, 20, 46, 255))
FX, FY = 14, 268
floe_w = norn.width + 12
floe = mini_island(floe_w, 14, 13, MIDP)
fa = np.array(floe)
fy_, fx_ = np.mgrid[0:fa.shape[0], 0:fa.shape[1]]
top = (fy_ < 4) & (fa[..., 3] > 0)
fa[top & (((fx_ + fy_) // 2) % 2 == 0)] = (150, 214, 238, 255)
fa[top & (((fx_ + fy_) // 2) % 2 == 1)] = (236, 248, 252, 255)
fa[(fy_ == 4) & (fa[..., 3] > 0)] = (60, 110, 160, 255)
comp(im, Image.fromarray(fa), FX, FY)
comp(im, norn, FX + 6, FY - norn.height + 3)
comp(im, cloud3d(floe_w + 16, 14, bank(floe_w + 16, 14, 6, 52, 3, 7), CL, rim=(118, 168, 200)), FX - 10, FY + 8)

# ---------------------------------------------------------------- Bifab – Regenbogenbrücke (perspektivisch)
Y0, Y1 = HY + 104, H + 4          # Tor-Ende .. unterer Rand
W0, W1 = 13, 150
KA = (W1 - W0) / (Y1 - Y0)
YH = Y0 - W0 / KA                 # Fluchtpunkt-Höhe


def road_w(y):
    return KA * (y - YH)


def road_x(y):
    s = np.clip((y - Y0) / (Y1 - Y0), 0, 1)
    return 126 + 34 * np.sin(np.pi * s ** 0.9) * (1 - s * 0.35) - 8 * s


def depth(y):
    return 1.0 / (y - YH)


yy_r = np.arange(Y0, H)
RBP = []
for c in RB:
    RBP += [tuple(min(255, int(v * 0.62 + 255 * 0.38)) for v in c), c, tuple(int(v * 0.8) for v in c)]
PAL_R = np.array([c + (255,) for c in RBP], np.uint8)
deck = np.zeros((H, W, 4), np.uint8)
dmask = np.zeros((H, W), bool)
z0 = depth(Y0)
for y in yy_r:
    w = road_w(y); xc = road_x(y)
    xl, xr = xc - w / 2, xc + w / 2
    plank_line = int(depth(y) / 0.0007) != int(depth(y + 1) / 0.0007) and w > 22
    plank_hi = int(depth(y - 1) / 0.0007) != int(depth(y) / 0.0007) and w > 22
    for x in range(int(math.floor(xl)), int(math.ceil(xr)) + 1):
        if not (0 <= x < W and 0 <= y < H):
            continue
        f = (x + 0.5 - xl) / w
        if f < 0 or f > 1:
            continue
        b = min(6, int(f * 7))
        sub = (f * 7) % 1
        k = 0 if sub < 0.28 else (1 if sub < 0.78 else 2)
        if plank_line:
            k = 2
        elif plank_hi and k == 1:
            k = 0
        elif w > 30 and k == 1 and rnd.random() < 0.05:
            k = rnd.choice([0, 2])
        deck[y, x] = PAL_R[b * 3 + k]
        dmask[y, x] = True
# Glanz in der Mitte der Brücke (gedithert)
glint = dmask & dither_mask(None, np.clip(0.35 - np.abs(XX - road_x(YY)) / (road_w(np.maximum(YY, Y0)) * 0.5 + 1) * 0.5, 0, 1) * 0.6)
deck[glint, :3] = np.clip(deck[glint, :3].astype(int) + 36, 0, 255)
deck_img = Image.fromarray(deck, 'RGBA')
# Seitenkante (Unterseite der Brücke) + Bordstein
side = np.zeros((H, W, 4), np.uint8)
EDGE_L = [(250, 236, 180), (214, 176, 90), (120, 80, 40)]
SIDE = [(54, 44, 96), (84, 70, 136), (32, 26, 60)]
for y in yy_r:
    w = road_w(y); xc = road_x(y)
    th = max(1, int(round(w * 0.045)))
    for sgn in (-1, 1):
        xe = int(round(xc + sgn * w / 2))
        for k in range(th + 1):
            x = xe + sgn * k
            if 0 <= x < W:
                side[y, x] = (SIDE[0] if k < th else SIDE[2]) + (255,)
    # Bordstein (goldene Kante)
    for sgn in (-1, 1):
        xe = int(round(xc + sgn * (w / 2 - 0.5)))
        if 0 <= xe < W:
            deck[y, xe] = EDGE_L[1] + (255,)
side_img = Image.fromarray(side, 'RGBA')
# Unterseite unter dem Tor-Ende
comp(im, side_img, 0, 0)
comp(im, Image.fromarray(deck, 'RGBA'), 0, 0)
d = ImageDraw.Draw(im)
xa, xb = road_x(Y0) - W0 / 2, road_x(Y0) + W0 / 2
d.line((int(xa) - 1, Y0 - 1, int(xb) + 1, Y0 - 1), fill=(36, 28, 70))

# Fackeln (aus der Bifab-Karte) auf Pfosten, perspektivisch skaliert
bf = native('Bifab, Bridge to Coolness')
torch = cut_by(bf, (15, 3, 24, 13), lambda a: (a[..., 2] >= a[..., 0] - 6) & (a[..., :3].mean(2) > 150))
torch = keep_largest(torch); torch = torch.crop(torch.getbbox())
TORCH = {2: up(torch, 2), 1: torch, 0: shrink(torch, 0.7), -1: shrink(torch, 0.5)}


def torch_at(y, sgn):
    w = road_w(y); xc = road_x(y)
    x = xc + sgn * (w / 2 - 1)
    sc = w / 60.0
    key = 2 if sc > 1.55 else (1 if sc > 0.7 else (0 if sc > 0.38 else -1))
    tt = TORCH[key]
    post = max(1, int(round(8 * sc)))
    pw = 2 if key == 2 else 1
    dd = ImageDraw.Draw(im)
    top = y - post
    dd.rectangle((int(x) - pw // 2 - (1 if key == 2 else 0), top, int(x) + pw // 2, y), fill=(40, 30, 50))
    if key >= 1:
        dd.line((int(x) - (1 if key == 2 else 0), top, int(x) - (1 if key == 2 else 0), y), fill=(96, 80, 90))
    g, p = glow(tt, (250, 236, 186, 255), radius=1 + max(0, key), strength=0.22)
    comp(im, g, x - tt.width // 2 - p, top - tt.height + 2 - p)
    comp(im, tt, x - tt.width // 2, top - tt.height + 2)


TORCH_ROWS = []
Dn = depth(338)
for i in range(14):
    y = int(round(YH + 1 / (Dn + 0.0046 * i)))
    if not TORCH_ROWS or TORCH_ROWS[-1] - y >= 3:
        TORCH_ROWS.append(y)

rs2 = random.Random(17)
dsp = ImageDraw.Draw(im)
for _ in range(10):
    y = rs2.randrange(Y0 + 30, H - 10)
    w = road_w(y); x = road_x(y) - w / 2 + rs2.uniform(0.1, 0.9) * w
    sparkle(dsp, int(x), y, 2 if w > 60 else 1, (255, 255, 230))

# ---------------------------------------------------------------- Helden auf der Brücke


def hero(name, box, bl, fix=None):
    c = cut_native(native(name), box, barrier_lum=bl)
    if fix:
        c = fix(c)
    c = keep_largest(c)
    return c.crop(c.getbbox())


def fix_sw(c):
    a = np.array(c).astype(int)
    a[0:2, :, 3] = 0
    a[(a[..., 2] > a[..., 0] + 30), 3] = 0
    return Image.fromarray(a.astype(np.uint8))


def fix_th(c):
    a = np.array(c).astype(int); L = a[..., :3].mean(2)
    a[(a[..., 1] > a[..., 0] + 5) & (L < 95), 3] = 0
    return Image.fromarray(a.astype(np.uint8))


hip = hero('Hipdall, Protector of Coolness', (25, 8, 50, 36), 70)
fre = hero('Freshya, Beauty of Coolness', (29, 13, 49, 41), 90)
swa = hero('Swagdri, Forger of Coolness', (29, 20, 49, 42), 90, fix_sw)
tho = hero('Thorad, Strength of Coolness', (33, 11, 54, 38), 70, fix_th)


def on_road(sprite, y, f=0.5, flip=False, k=1):
    w = road_w(y); x = road_x(y) - w / 2 + f * w
    s = sprite.transpose(Image.FLIP_LEFT_RIGHT) if flip else sprite
    if k > 1:
        s = scale2x(s)
    s = outline(s, (30, 24, 50, 255))
    sh = Image.new('RGBA', (s.width + 2, 4), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((0, 0, s.width + 1, 3), fill=(50, 34, 96, 255))
    shm = np.array(sh); shm[..., 3] = np.where(dither_mask(None, np.full(shm.shape[:2], 0.5)) & (shm[..., 3] > 0), 255, 0)
    comp(im, Image.fromarray(shm), x - s.width // 2 - 1, y - 1)
    comp(im, s, x - s.width // 2, y - s.height + 1)


items = []
for y in TORCH_ROWS:
    items.append((y, 'torch', None))
items += [(Y0 + 12, 'hero', (hip, 0.5, False, 1)), (Y0 + 40, 'hero', (swa, 0.35, False, 1)),
          (Y0 + 70, 'hero', (tho, 0.62, True, 1)), (Y0 + 136, 'hero', (fre, 0.38, False, 2))]
items.sort(key=lambda it: it[0])
for (y, kind, arg) in items:
    if kind == 'torch':
        torch_at(y, -1); torch_at(y, 1)
    else:
        on_road(arg[0], y, arg[1], arg[2], arg[3])


# ---------------------------------------------------------------- Vordergrund-Wolken
FG = [(170, 214, 232), (206, 234, 244), (236, 248, 252), (255, 255, 255)]
comp(im, cloud3d(90, 40, bank(90, 40, 6, 41, 10, 18), FG, rim=(134, 180, 210)), -14, 318)
comp(im, cloud3d(80, 36, bank(80, 36, 5, 42, 9, 16), FG, rim=(134, 180, 210)), 186, 322)

# ---------------------------------------------------------------- Schnee
for sn in [area('wowhalla/snow-far'), area('wowhalla/snow-near')]:
    for ty in range(0, H, 100):
        for tx in range(0, W, 64):
            comp(im, sn, tx, ty)

# ---------------------------------------------------------------- Rahmen
bevel_frame(im, (40, 26, 10), (255, 232, 150), (214, 160, 50), (140, 86, 22), (40, 26, 10), width=6)
dfr = ImageDraw.Draw(im)
dfr.rectangle((6, 6, W - 7, H - 7), outline=(120, 210, 236))
for x in range(22, W - 20, 17):
    for y in (3, H - 4):
        dfr.point((x, y), fill=(255, 244, 196)); dfr.point((x + 1, y), fill=(120, 70, 20))
for y in range(24, H - 20, 17):
    for x in (3, W - 4):
        dfr.point((x, y), fill=(255, 244, 196)); dfr.point((x, y + 1), fill=(120, 70, 20))
for (x, y) in [(-5, -5), (W - 15, -5), (-5, H - 15), (W - 15, H - 15)]:
    comp(im, grey_g[1], x, y)

print(save(im, '05_wowhalla_regenbogen'))
