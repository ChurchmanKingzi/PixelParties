# -*- coding: utf-8 -*-
"""13 Big Gwen – Nachtpanorama: der große Uhrturm „Big Gwen" über der viktorianischen Stadt am Fluss,
Mond, Sterne, Schleierwolken, Smog, Schlote mit Warnlichtern, erleuchtete Fenster, Laternen, ein kleiner
Dampfer und Spiegelungen im Wasser. Baut auf den Ebenen der Big-Gwen-Area auf (public/areas/big-gwen/):
city/lights/beacons/flowers/lamp-glow als Uferzeile (Kachel in Hausblöcke zerlegt und neu gereiht),
tower/tower-glow mit verlängertem Schaft, hand-hour/hand-min, smog, smoke, daw."""
from lib import *

YY, XX = np.mgrid[0:H, 0:W]
G = 'big-gwen/'


def A(n):
    return area(G + n)


# ---------------------------------------------------------------- Helfer
def ordered(v, n):
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.clip(np.floor(v * (n - 1) + BAYER4[yy % 4, xx % 4]), 0, n - 1).astype(int)


RN = np.random.RandomState(99).rand(H, W)


def noisy(v, n):
    """Stufen mit Zufallsschwelle (wie das körnige sky.png der Area)."""
    h, w = v.shape
    return np.clip(np.floor(v * (n - 1) + RN[:h, :w]), 0, n - 1).astype(int)


def nmask(t):
    return t > RN[:t.shape[0], :t.shape[1]]


def rgba(c):
    return tuple(c[:3]) + (255,)


def setc(img, m, col):
    a = np.array(img); a[m] = rgba(col)
    return Image.fromarray(a)


def comp(img, spr, x, y):
    img.alpha_composite(spr, (int(x), int(y)))


def alpha_mul(spr, f):
    a = np.array(spr).astype(float); a[..., 3] *= f
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def layer_idx(idx, mask, pal):
    P = np.array([rgba(c) for c in pal], np.uint8)
    out = P[np.clip(idx, 0, len(pal) - 1)]
    out[~mask] = 0
    return Image.fromarray(out, 'RGBA')


def lum(a):
    return a[..., 0] * 0.3 + a[..., 1] * 0.55 + a[..., 2] * 0.15


SKY = [(10, 9, 32), (14, 12, 40), (19, 16, 49), (24, 21, 59), (30, 26, 70), (37, 31, 81), (45, 37, 91),
       (55, 43, 99), (67, 49, 104), (80, 56, 104), (94, 64, 102), (108, 74, 100)]
MOON = [(106, 98, 132), (138, 126, 150), (151, 140, 164), (180, 168, 180), (206, 192, 192), (226, 214, 202),
        (240, 230, 214)]

CITY_Y = 180       # Oberkante der city.png-Kachel
WALL = CITY_Y + 84  # Oberkante der Ufermauer
WATER = WALL + 8   # Wasserlinie
HOR = CITY_Y + 40  # Horizont (hinter der Stadt)
MX, MY, MR = 195, 62, 14   # Mond

# ---------------------------------------------------------------- Himmel
nz = value_noise(W, H, 22, seed=3, octaves=3)
v = np.clip(YY / HOR, 0, 1) ** 1.35 + (nz - 0.5) * 0.14
dm = np.hypot(XX - MX, (YY - MY) * 1.05)
v = v + np.clip(1 - dm / 80, 0, 1) ** 1.8 * 0.34
idx = noisy(np.clip(v, 0, 1), len(SKY))
im = layer_idx(idx, np.ones((H, W), bool), SKY)
# Mondhof: klare Ringe mit schmalen Dither-Übergängen
for rad, col in [(36, (40, 34, 92)), (28, (54, 48, 110)), (21, (72, 66, 128))]:
    t = np.clip((rad - dm) / 4.0, 0, 1)
    im = setc(im, dither_mask(None, t), col)


# Schleierwolken: lange, dünne Streifen, oben rechts vom Mond angeleuchtet
def streak_cloud(cx, cy, ww, hh, seed, pal):
    """pal: (Schatten, Körper, Licht, Glanz)."""
    r = np.random.RandomState(seed)
    nzc = value_noise(W, H, 5, seed=seed, octaves=2)
    u = (XX - cx) / ww
    base = cy + hh * 0.5
    # Oberkante: Buckel, Unterkante flach
    top = base - hh * np.clip(1 - u * u, 0, 1) ** 0.7 * (0.65 + 0.7 * nzc)
    m = (YY >= np.round(top)) & (YY <= base) & (np.abs(u) < 1)
    for _ in range(3):
        ox = r.uniform(-0.6, 0.6); oy = r.uniform(1, hh * 0.8); sw = r.uniform(0.25, 0.45)
        u2 = (XX - cx - ox * ww) / (ww * sw)
        t2 = base + oy - hh * 0.8 * np.clip(1 - u2 * u2, 0, 1) ** 0.7
        m |= (YY >= np.round(t2)) & (YY <= base + oy) & (np.abs(u2) < 1)
    m = ndimage.binary_opening(m, np.ones((1, 2)))
    lab = np.zeros((H, W), int)
    lab[m] = 1
    top_e = m & ~np.roll(m, 1, 0)
    bot_e = m & ~np.roll(m, -1, 0)
    lab[bot_e] = 0 + 4
    lab[top_e] = 2
    lab[top_e & (XX > cx - ww * 0.1) & (nzc > 0.45)] = 3
    out = np.zeros((H, W, 4), np.uint8)
    out[lab == 4] = rgba(pal[0]); out[lab == 1] = rgba(pal[1]); out[lab == 2] = rgba(pal[2]); out[lab == 3] = rgba(pal[3])
    return Image.fromarray(out), m


CLP = [(26, 22, 60), (36, 30, 76), (58, 50, 106), (96, 88, 146)]
clouds = []
for (cx, cy, ww, hh, sd, pal) in [
        (200, 73, 40, 4, 31, [(44, 36, 88), (58, 50, 108), (92, 84, 142), (150, 140, 184)]),
        (56, 92, 46, 5, 32, CLP), (232, 104, 30, 4, 33, [(40, 32, 84), (52, 44, 100), (78, 70, 128), (120, 112, 168)]),
        (150, 146, 44, 4, 34, [(52, 38, 90), (62, 46, 98), (80, 62, 116), (108, 90, 140)]),
        (18, 150, 32, 3, 35, [(56, 40, 94), (66, 48, 102), (84, 64, 118), (104, 84, 136)])]:
    clouds.append(streak_cloud(cx, cy, ww, hh, sd, pal))
cloud_mask = np.zeros((H, W), bool)
cloud_raw = np.zeros((H, W), bool)
for _, m in clouds:
    cloud_mask |= ndimage.binary_dilation(m, iterations=2)
    cloud_raw |= m

# Sterne (wie sky.png: 1px + wenige Kreuze), nicht in Mondnähe
rnd = random.Random(13)
d = ImageDraw.Draw(im)
CROSS = [(40, 38), (72, 58), (228, 120), (22, 112), (162, 46), (18, 70)]
for _ in range(110):
    x, y = rnd.randrange(8, W - 8), rnd.randrange(8, 185)
    if math.hypot(x - MX, y - MY) < 40 or cloud_mask[y, x]:
        continue
    if (56 < x < 194 and y < 36) or any(abs(x - cx_) < 4 and abs(y - cy_) < 4 for cx_, cy_ in CROSS):
        continue
    if y > 150 or (y / 185 > 0.5 and rnd.random() < 0.65):
        continue
    c = rnd.choice([(110, 106, 168), (110, 106, 168), (140, 134, 196), (190, 184, 230)])
    d.point((x, y), fill=c)
for (x, y) in CROSS:
    d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(140, 134, 196))
    d.point((x, y), fill=(236, 232, 255))

# ---------------------------------------------------------------- Mond
s = 2 * MR + 1
my, mx = np.mgrid[0:s, 0:s]
nx = (mx - MR) / (MR + 0.5); ny = (my - MR) / (MR + 0.5)
inside = nx * nx + ny * ny <= 1
nzm = value_noise(s, s, 6, seed=26, octaves=2)
# flache Tonflächen wie moon.png: Grundton, Licht oben rechts, Schatten unten links, Mare-Flecken
li = np.full((s, s), 4)
sh = nx * 0.7 - ny * 0.7                 # >0: zum Licht
li[sh > 0.35] = 5
li[(sh > 0.62) & (nx * nx + ny * ny > 0.45)] = 6
li[sh < -0.55] = 3
li[(sh < -0.75) & (nx * nx + ny * ny > 0.6)] = 2
mare = (nzm > 0.63) & (nx * nx + ny * ny < 0.75)
li[mare] = np.maximum(li[mare] - 1, 2)
mare2 = (nzm > 0.74) & (nx * nx + ny * ny < 0.6)
li[mare2] = np.maximum(li[mare2] - 1, 2)
moon_img = layer_idx(li, inside, MOON)
ma = np.array(moon_img)
edge = inside & ~ndimage.binary_erosion(inside)
ma[edge & (sh < -0.1)] = rgba(MOON[1])
ma[edge & (sh > 0.45)] = rgba(MOON[6])
for (cx_, cy_) in [(MR + 5, MR - 6), (MR - 6, MR + 4), (MR + 2, MR + 7)]:
    if inside[cy_, cx_] and inside[cy_ + 1, cx_ + 1]:
        ma[cy_, cx_] = rgba(MOON[2]); ma[cy_, cx_ + 1] = rgba(MOON[3])
        ma[cy_ + 1, cx_] = rgba(MOON[3]); ma[cy_ + 1, cx_ + 1] = rgba(MOON[5])
moon_img = Image.fromarray(ma)
comp(im, moon_img, MX - MR, MY - MR)
for cimg, _ in clouds:
    comp(im, cimg, 0, 0)


# Lichtglocke: der Smog über der Stadt glimmt warm von unten
a = np.array(im).astype(float)
tg = np.clip((YY - (CITY_Y - 30)) / 60.0, 0, 1) ** 1.2 * 0.8
gm = nmask(tg) & (YY < CITY_Y + 60)
mix = a[..., :3] * 0.7 + np.array([150, 92, 96]) * 0.3
a[gm, :3] = mix[gm]
im = Image.fromarray(a.clip(0, 255).astype(np.uint8))

# ---------------------------------------------------------------- ferne Stadt (Silhouetten)
def far_city(seed, base, hmin, hmax, body, rim, win, dens, spires=(), domes=(), stacks=()):
    r = random.Random(seed)
    lay = np.zeros((H, W), int)
    x = -4
    while x < W + 4:
        w = r.randint(8, 16)
        top = base - r.randint(hmin, hmax)
        kind = r.random()
        for xx in range(x, min(W, x + w)):
            if xx < 0:
                continue
            t = top
            if kind < 0.35:
                t = top + abs(xx - (x + (w - 1) / 2)) * 0.8
            elif kind < 0.6:
                t = top + (2 if (xx - x < 2 or x + w - 1 - xx < 2) else 0)
            lay[int(t):base, xx] = 1
        for _ in range(r.randint(0, 2)):
            cx = x + r.randint(2, max(2, w - 3))
            if 0 <= cx < W - 1:
                lay[top - r.randint(3, 5):top + 1, cx:cx + 2] = 1
        x += w
    for (sx, sh, sw, sb) in spires:
        lay[sb:base, sx - sw:sx + sw + 1] = 1
        for k in range(sh):
            hw = int(round(sw * (k / sh)))
            lay[sb - sh + k, sx - hw:sx + hw + 1] = 1
    for (dx, dr, db) in domes:
        dy, dxx = np.mgrid[0:H, 0:W]
        lay[((dxx - dx) ** 2 + ((dy - db) * 1.15) ** 2 <= dr * dr) & (dy <= db)] = 1
        lay[db:base, dx - dr - 2:dx + dr + 3] = 1
        lay[db - int(dr / 1.15) - 5:db - int(dr / 1.15) + 1, dx:dx + 1] = 1
        lay[db - int(dr / 1.15) - 3:db - int(dr / 1.15), dx - 1:dx + 2] = 1
    for (sx, st) in stacks:
        lay[st:base, sx:sx + 3] = 1
        lay[st, sx - 1:sx + 4] = 1
    m = lay > 0
    rimm = (m & ~np.roll(m, -1, 1)) | (m & ~np.roll(m, 1, 0))
    lay[rimm] = 2
    rr = np.random.RandomState(seed)
    wm = (m & ~rimm) & (YY % 4 == 1) & (XX % 3 == 1) & (rr.rand(H, W) < dens) & (YY < base - 1) & (YY < CITY_Y + 14)
    wm &= np.roll(m, 2, 0) & np.roll(m, -1, 1) & np.roll(m, 1, 1)
    lay[wm] = 3
    out = np.zeros((H, W, 4), np.uint8)
    out[lay == 1] = rgba(body); out[lay == 2] = rgba(rim); out[lay == 3] = rgba(win)
    return Image.fromarray(out), m


far1, m1 = far_city(5, HOR, 22, 36, (46, 35, 80), (62, 48, 98), (116, 80, 88), 0.0,
                    spires=[(30, 22, 3, HOR - 34), (214, 26, 3, HOR - 38)], domes=[(64, 16, HOR - 40)],
                    stacks=[(176, HOR - 58), (236, HOR - 50)])
comp(im, far1, 0, 0)
far2, m2 = far_city(9, HOR + 6, 14, 26, (30, 24, 58), (42, 34, 74), (178, 116, 66), 0.12,
                    stacks=[(92, HOR - 42), (158, HOR - 36)])
comp(im, far2, 0, 0)
for (bx, by) in [(177, HOR - 59), (237, HOR - 51), (93, HOR - 43), (159, HOR - 37)]:
    d = ImageDraw.Draw(im)
    d.point([(bx - 1, by - 1), (bx + 1, by - 1), (bx, by - 2)], fill=(120, 40, 50))
    d.point((bx, by - 1), fill=(255, 90, 58))

# Smog hinter der nahen Stadt (Kachel 2x, zweite gespiegelt)
smog = A('smog')
smog2 = smog.transpose(Image.FLIP_LEFT_RIGHT)
comp(im, alpha_mul(smog, 0.8), 0, CITY_Y - 8)
comp(im, alpha_mul(smog2, 0.8), 128, CITY_Y - 14)

# ---------------------------------------------------------------- nahe Stadt (Segmente der Kachel)
city = A('city')
lights = [A('lights-a'), A('lights-b'), A('lights-c')]


def drop_olive(l):
    a = np.array(l).astype(int)
    ol = (np.abs(a[..., 0] - a[..., 1]) < 12) & (a[..., 2] < a[..., 0] - 25) & (a[..., 3] == 255)
    a[ol] = 0
    return Image.fromarray(a.astype(np.uint8))


lights = [drop_olive(l) for l in lights]
beac = A('beacons')
lamp = A('lamp-glow')
flw = A('flowers').crop((0, 0, 128, 100))
BLOCKS = {'A': (0, 20), 'B': (20, 61), 'C': (61, 82), 'D': (82, 128)}


def swap_facades(t):
    a = np.array(t).astype(int)
    sub = a[30:58]
    r, g, b = sub[..., 0].copy(), sub[..., 1], sub[..., 2].copy()
    m = (sub[..., 3] > 0) & (np.abs(r - b) > 6) & ((r + g + b) > 60)
    sub[..., 0] = np.where(m, b, r)
    sub[..., 2] = np.where(m, r, b)
    a[30:58] = sub
    return Image.fromarray(a.astype(np.uint8))


def tile_layers(sel_lights, recolor=False):
    t = city.copy()
    if recolor:
        t = swap_facades(t)
    for i in sel_lights:
        t.alpha_composite(lights[i])
    t.alpha_composite(beac)
    t.alpha_composite(flw)
    t.alpha_composite(lamp)
    return t


def strip(parts, x0):
    """parts: Liste (Blockfolge, Lichter, umfärben)."""
    out = Image.new('RGBA', (W + 260, 100))
    x = 0
    pos = []
    for seq, sel, rec in parts:
        t = tile_layers(sel, rec)
        for bl in seq:
            a0, a1 = BLOCKS[bl]
            out.alpha_composite(t.crop((a0, 0, a1, 100)), (x, 0))
            pos.append((bl, x + x0 - a0))
            x += a1 - a0
    return out, pos


near, bpos = strip([('DAB', [0, 1], False), ('CBDAC', [0, 2], True)], -2)
comp(im, near.crop((0, 0, 256, 84)), -2, CITY_Y)

# Rauchfahnen aus den großen Schloten
SCHLOTE = [(22, 17), (32.5, 24), (103, 13), (65.5, 28)]
smk = A('smoke-big'); sms = A('smoke')
rs = random.Random(3)
for bl, off in bpos:
    a0, a1 = BLOCKS[bl]
    for (sx, sy) in SCHLOTE:
        if a0 <= sx < a1:
            cx = int(sx + off); cy = CITY_Y + sy
            if abs(cx - 125) < 26:
                continue
            for i in range(4):
                spr = smk if i > 0 else sms
                f = [0.85, 0.7, 0.5, 0.3][i]
                comp(im, alpha_mul(spr, f), cx - spr.width // 2 - i * 3 - rs.randint(0, 1), cy - 6 - i * 6)

# ---------------------------------------------------------------- Turm (Schaft verlängert)
tower = A('tower')
ta = np.array(tower); ta[96:, 8:14] = 0
ta[ta[..., 3] < 255] = 0
tower = Image.fromarray(ta)
tglow = np.array(A('tower-glow'))
tglow[tglow[..., 3] == 230] = 0          # Fensterschlitze selbst setzen
tglow = Image.fromarray(tglow)
K = 11
SEC = (71, 80)
per = SEC[1] - SEC[0]
TH = 100 + K * per


def extend(img, vary=False):
    out = Image.new('RGBA', (64, TH))
    out.paste(img.crop((0, 0, 64, SEC[1])), (0, 0))
    for k in range(K):
        out.paste(img.crop((0, SEC[0], 64, SEC[1])), (0, SEC[1] + k * per))
    out.paste(img.crop((0, SEC[1], 64, 100)), (0, SEC[1] + K * per))
    return out


T = extend(tower)
TG = Image.new('RGBA', (64, TH))
tg0 = extend(tglow)
# Klar: Scheibenschein nur oben (Zifferblatt), Rest weg
tga = np.array(tg0); tga[60:] = 0
TG = Image.fromarray(tga)

# Steintextur leicht variieren (keine identischen Wiederholungen)
ta = np.array(T).astype(int)
stone = {}
cols = np.unique(ta[57:TH - 12][ta[57:TH - 12, :, 3] > 0][:, :3], axis=0)
cols = sorted([tuple(c) for c in cols], key=lambda c: c[0] + c[1] + c[2])
browns = [c for c in cols if c[0] > c[2] + 12 and 40 < sum(c) < 520]
rv = np.random.RandomState(7)
for y in range(SEC[1], SEC[1] + K * per):
    for x in range(18, 47):
        c = tuple(ta[y, x, :3])
        if c in browns and rv.rand() < 0.12:
            i = browns.index(c) + rv.choice([-1, 1])
            if 0 <= i < len(browns) and abs(sum(browns[i]) - sum(c)) < 70:
                ta[y, x, :3] = browns[i]
T = Image.fromarray(ta.astype(np.uint8))

# Schaft nach unten hin in den Dunst abdunkeln (Rampe um eine Stufe, geordnet gedithert)
RAMP = [(46, 32, 36), (67, 48, 42), (90, 64, 50), (114, 84, 62), (140, 106, 76), (164, 128, 90), (186, 148, 104),
        (206, 168, 120), (223, 188, 138)]
ta = np.array(T).astype(int)
y0s, y1s = 58, TH - 14
for y in range(y0s, y1s):
    u = (y - y0s) / (y1s - y0s)
    tdark = 0.1 + 0.5 * np.clip((u - 0.05) / 0.6, 0, 1) - 0.25 * np.clip((u - 0.8) / 0.2, 0, 1)
    for x in range(14, 51):
        c = tuple(ta[y, x, :3])
        if ta[y, x, 3] and c in RAMP and RAMP.index(c) > 0:
            tt_ = tdark * (0.6 if x >= 44 else 1.0)
            if tt_ > BAYER4[y % 4, x % 4]:
                ta[y, x, :3] = RAMP[RAMP.index(c) - 1]
T = Image.fromarray(ta.astype(np.uint8))

# Fensterschlitze: zufällig erleuchtet
WINX = [22, 27, 32, 37, 42]
rl = random.Random(11)
tgl = np.array(TG)
tarr = np.array(T)
sec_rows = [65] + [SEC[1] + k * per + 3 for k in range(K)] + [74 + K * per, 83 + K * per]
for si, y0 in enumerate(sec_rows):
    p = 0.55 if si < 3 else (0.22 if si < len(sec_rows) - 3 else 0.4)
    for x in WINX:
        if rl.random() < p and tarr[y0 + 2, x, :3].sum() < 60:
            n = sum(1 for yy in range(y0, y0 + 5) if tarr[yy, x, :3].sum() < 60)
            ys = [yy for yy in range(y0, y0 + 5) if tarr[yy, x, :3].sum() < 60]
            for j, yy in enumerate(ys):
                tgl[yy, x] = (255, 240, 176, 230) if j == 0 else (255, 200, 96, 230)
TG = Image.fromarray(tgl)

TX = 125 - 32
TY = WALL - TH
hh = A('hand-hour'); hm = A('hand-min')
fh, fm = 59, 52
T.alpha_composite(hh.crop((fh * 23, 0, fh * 23 + 23, 23)), (32 - 11, 41 - 11))
T.alpha_composite(hm.crop((fm * 23, 0, fm * 23 + 23, 23)), (32 - 11, 41 - 11))
ImageDraw.Draw(T).point((32, 41), fill=(232, 184, 58))
# warmer Schein des Zifferblatts im Himmel hinter dem Turm
dcl = np.hypot(XX - (TX + 32), (YY - (TY + 41)) * 0.9)
for rad, col in [(30, (46, 34, 84)), (22, (64, 44, 96)), (16, (86, 58, 104))]:
    t = np.clip((rad - dcl) / 4.0, 0, 1)
    im = setc(im, dither_mask(None, t) & (np.array(im)[..., 2] < 150) & ~cloud_raw, col)
comp(im, T, TX, TY)
comp(im, TG, TX, TY)

# Dohlen um die Turmspitze
daw = A('daw')
for (x, y, f) in [(TX + 6, TY + 4, 0), (TX + 50, TY - 6, 1), (TX + 58, TY + 14, 0), (TX - 14, TY + 22, 1)]:
    comp(im, daw.crop((f * 7, 0, f * 7 + 7, 4)), x, y)

# vorderer Smog, zart über Stadt und Turm
comp(im, alpha_mul(smog, 0.28), -40, CITY_Y - 56)
comp(im, alpha_mul(smog2, 0.28), 88, CITY_Y - 50)

# Glühwürmchen über den Beeten
d = ImageDraw.Draw(im)
rf = random.Random(17)
for _ in range(9):
    x = rf.randrange(12, W - 12); y = CITY_Y + rf.randrange(66, 78)
    if abs(x - 125) < 24:
        continue
    d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(90, 110, 60))
    d.point((x, y), fill=(228, 244, 122))

# ---------------------------------------------------------------- Ufermauer
WALLP = [(20, 18, 40), (30, 28, 54), (40, 38, 68), (54, 52, 86), (74, 72, 108)]
a = np.array(im)
for y in range(WALL, WATER):
    k = y - WALL
    for x in range(W):
        if k == 0:
            c = WALLP[4] if (x // 11) % 5 != 4 else WALLP[3]
        elif k == 1:
            c = WALLP[2]
        else:
            row = (k - 2) // 3
            jx = (x + (row % 2) * 6) % 12
            ky = (k - 2) % 3
            if ky == 2 or jx == 0:
                c = WALLP[0]
            elif ky == 0 and jx < 11:
                c = WALLP[2] if (x * 7 + row * 3) % 5 else WALLP[3]
            else:
                c = WALLP[1]
        a[y, x] = rgba(c)
im = Image.fromarray(a)

# ---------------------------------------------------------------- Wasser mit Spiegelung
WP = [(8, 8, 24), (12, 12, 32), (17, 16, 42), (23, 21, 52), (30, 27, 64), (40, 35, 78), (54, 47, 96),
      (74, 66, 120)]
WARM = [(92, 52, 46), (150, 90, 50), (214, 142, 64), (250, 204, 120)]
scene = np.array(im).astype(int)
out = np.array(im)
Wh = H - 6 - WATER
rw = random.Random(4)
Ls = lum(scene)
warm_src = (scene[..., 0] > scene[..., 2] + 50) & (Ls > 118)
warm_src[CITY_Y + 68:] = False               # Blumen/Beete nicht spiegeln
tower_src = np.zeros((H, W), bool)
tower_src[:, TX:TX + 64] = np.array(T)[..., 3][np.clip(np.arange(H) - TY, 0, TH - 1)] > 0
tower_src[:TY] = False
for y in range(WATER, H):
    k = y - WATER
    tk = min(1, k / Wh)
    sy = max(WATER - 1 - int(k * 1.25), 0)
    x = 0
    base_i = 3 - (1 if tk > 0.35 else 0) - (1 if tk > 0.75 else 0)
    while x < W:
        seg = rw.randint(3, 12)
        amp = 1 + int(tk * 2.5)
        off = rw.randint(-amp, amp)
        for xx in range(x, min(W, x + seg)):
            sx = (xx - off) % W
            c = scene[sy, sx]
            L = Ls[sy, sx]
            if warm_src[sy, sx]:
                wi = 1 if L < 150 else (2 if L < 200 else 3)
                wi = max(0, wi - (1 if tk > 0.45 else 0))
                col = WARM[wi]
            elif tower_src[sy, sx]:
                col = (110, 70, 54) if L > 150 else ((78, 50, 52) if L > 100 else (44, 32, 56))
            else:
                lv = np.clip((L - 20) / 90, 0, 1) * (1 - tk * 0.6)
                wi = base_i + int(np.floor(lv * 3 + RN[y, xx] * 0.8))
                col = WP[min(wi, 6)]
            out[y, xx] = rgba(col)
        x += seg
# Wellentäler: dunkle, gebrochene Linien
rn = np.random.RandomState(5)
for y in range(WATER + 2, H):
    k = y - WATER; tk = min(1, k / Wh)
    if y % 2:
        continue
    x = rn.randint(0, 6)
    while x < W:
        seg = rn.randint(3, 10)
        if rn.rand() < 0.35 + tk * 0.25:
            out[y, x:x + seg] = rgba(WP[max(0, 2 - int(tk * 2))])
        x += seg + rn.randint(2, 8)
# Mondglitzern und Wellenkämme
for y in range(WATER + 1, H):
    k = y - WATER; tk = min(1, k / Wh)
    x = rn.randint(0, 4)
    while x < W:
        seg = rn.randint(2, 6)
        dxm = abs(x + seg / 2 - MX)
        wpath = 5 + tk * 16
        pm = 0.07 + 0.75 * np.exp(-(dxm / wpath) ** 2)
        if rn.rand() < pm * (0.6 if y % 2 else 0.25):
            if dxm < wpath * 0.6:
                c = MOON[6] if rn.rand() < 0.4 else MOON[4]
            elif dxm < wpath * 1.3:
                c = MOON[1]
            else:
                c = WP[5] if rn.rand() < 0.6 else WP[6]
            out[y, x:x + seg] = rgba(c)
        x += seg + rn.randint(1, 6)
# Lichtsäulen der Straßenlaternen und hellsten Fenster
lampx = sorted(set(np.where((scene[CITY_Y + 59:CITY_Y + 68, :, 0] == 255) & (scene[CITY_Y + 59:CITY_Y + 68, :, 1] >= 240))[1]))
cols_x = []
for x in lampx:
    if not cols_x or x - cols_x[-1][-1] > 2:
        cols_x.append([x])
    else:
        cols_x[-1].append(x)
rl2 = np.random.RandomState(8)
for grp in cols_x:
    cx = (grp[0] + grp[-1]) / 2
    if abs(cx - 125) < 22:
        continue
    jit = 0
    for y in range(WATER + 1, WATER + 44):
        k = y - WATER
        if y % 2 == 0 and rl2.rand() < 0.5:
            jit = rl2.randint(-1, 1) if k > 6 else 0
        if rl2.rand() > 0.92 - k / 60:
            continue
        hw = 1 if k < 5 else rl2.choice([1, 2, 2, 3] if k < 20 else [2, 3, 3, 4])
        c = WARM[3] if k < 7 else (WARM[2] if k < 20 else WARM[1])
        x0 = int(round(cx - (hw - 1) / 2 + jit))
        out[y, max(0, x0):min(W, x0 + hw)] = rgba(c)
im = Image.fromarray(out)

# ---------------------------------------------------------------- kleiner Dampfer auf dem Fluss
def steamer():
    w_, h_ = 44, 18
    img = Image.new('RGBA', (w_, h_))
    d = ImageDraw.Draw(img)
    HULL, CAB, RIM, LIT = (12, 10, 26), (26, 22, 48), (78, 70, 122), (255, 204, 102)
    dy = 12  # Deckslinie
    d.polygon([(2, dy), (38, dy), (41, dy - 2), (42, dy - 2), (38, dy + 4), (5, dy + 4)], fill=HULL)
    d.line((2, dy, 38, dy), fill=RIM); d.point([(39, dy - 1), (40, dy - 2), (41, dy - 2)], fill=RIM)
    d.rectangle((9, dy - 5, 29, dy - 1), fill=CAB)
    d.line((8, dy - 6, 30, dy - 6), fill=RIM)
    d.rectangle((9, dy - 5, 29, dy - 5), fill=HULL)
    for x in (12, 16, 20, 24):
        d.point((x, dy - 3), fill=LIT); d.point((x + 1, dy - 3), fill=(200, 138, 58))
    d.rectangle((17, dy - 11, 19, dy - 7), fill=HULL)
    d.line((17, dy - 10, 19, dy - 10), fill=(120, 40, 44))
    d.point((20, dy - 11), fill=RIM); d.line((20, dy - 10, 20, dy - 7), fill=RIM)
    d.line((35, dy - 5, 35, dy - 1), fill=HULL)
    d.point((35, dy - 6), fill=(255, 228, 154))
    d.line((4, dy - 3, 4, dy - 1), fill=HULL); d.point((4, dy - 4), fill=(220, 60, 50))
    return img, dy


boat, bdy = steamer()
BX, BY = 34, WATER + 38
a = np.array(im)
# ruhigeres Wasser um das Boot + Glanzkante an der Wasserlinie
rb0 = np.random.RandomState(9)
yl = BY + bdy + 5
x = BX + 1
while x < BX + 44:
    seg = rb0.randint(3, 8)
    a[yl, x:min(x + seg, BX + 44)] = rgba(WP[5] if rb0.rand() < 0.7 else WP[4])
    x += seg + rb0.randint(1, 3)
im = Image.fromarray(a)
comp(im, boat, BX, BY)
for cx_, cy_ in [(18, -1)]:
    for i in range(2):
        spr = smk if i else sms
        comp(im, alpha_mul(spr, [0.7, 0.4][i]), BX + cx_ - spr.width // 2 - 2 - i * 5, BY + cy_ - 4 - i * 4)
# Spiegelung der Bullaugen
a = np.array(im)
rb = np.random.RandomState(3)
for x in (12, 16, 20, 24, 35):
    for k in range(2, 10):
        if rb.rand() < 0.55:
            yy_ = BY + bdy + 4 + k
            a[yy_, BX + x + rb.randint(-1, 1)] = rgba(WARM[2] if k < 5 else WARM[1])
im = Image.fromarray(a)

# ---------------------------------------------------------------- Rahmen
bevel_frame(im, (8, 6, 18), (226, 184, 104), (122, 86, 48), (60, 40, 26), (8, 6, 18), width=6)
d = ImageDraw.Draw(im)
for (x, y) in [(3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)]:
    d.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(56, 30, 14))
    d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(232, 164, 56))
    d.point((x - 1, y - 1), fill=(255, 238, 170))
    d.point((x, y), fill=(255, 214, 96))

print(save(im, '13_big_gwen'))
