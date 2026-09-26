# -*- coding: utf-8 -*-
"""07 Feuer & Eis: Feuer- und Eisdrache umschlingen ihr Nest mit zwei Dracheneiern.
Yin-Yang-Teilung: links Vulkan/Lavasee/Basaltsäulen, rechts Gletscher/Polarlicht/Eiskristalle.
Oben prallen Feueratem und Frostatem aufeinander."""
from lib import *
from scipy.spatial import cKDTree

yy, xx = np.mgrid[0:H, 0:W]
THR = BAYER4[yy % 4, xx % 4]

# ---------------------------------------------------------------- Paletten
F_OUT = (34, 4, 10)
FIRE_PAL = [F_OUT, (84, 10, 18), (140, 24, 22), (192, 50, 24), (232, 102, 36), (255, 176, 80)]
FIRE_BELLY = [(128, 58, 22), (200, 124, 40), (244, 190, 84), (255, 234, 160)]
FIRE_SPK = [F_OUT + (255,), (224, 84, 20, 255), (255, 178, 56, 255), (255, 246, 196, 255)]
I_OUT = (10, 16, 48)
ICE_PAL = [I_OUT, (28, 46, 108), (50, 86, 162), (90, 142, 212), (152, 200, 244), (224, 244, 255)]
ICE_BELLY = [(88, 120, 182), (144, 180, 224), (196, 222, 248), (244, 252, 255)]
ICE_SPK = [I_OUT + (255,), (104, 176, 236, 255), (200, 236, 255, 255), (255, 255, 255, 255)]
FW_PAL = [(30, 4, 10), (56, 8, 16), (92, 14, 20), (138, 30, 22), (188, 62, 28), (236, 118, 44)]
IW_PAL = [(8, 14, 44), (18, 30, 80), (32, 56, 124), (58, 98, 170), (100, 150, 214), (170, 212, 248)]


# ---------------------------------------------------------------- Helfer
def put(a, mask, col):
    a[mask, :3] = col[:3]
    a[mask, 3] = 255


def dith(t):
    return t > THR


def tones(lam, cols, amt=0.6):
    """lam 0..1 -> Farbe aus Stufen, mit leichtem Bayer-Dithering an den Übergängen."""
    n = len(cols)
    k = np.clip(np.floor(lam * n + (THR - 0.5) * amt), 0, n - 1).astype(int)
    return np.array(cols)[k]


def poly_mask(pts, w=W, h=H):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon([tuple(map(float, p)) for p in pts], fill=255)
    return np.array(m) > 0


def catmull(pts, step=0.25):
    P = np.array(pts, float)
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(np.hypot(*(p2 - p1)) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


def voronoi(pts):
    d, i = cKDTree(pts).query(np.stack([xx.ravel(), yy.ravel()], 1), k=2)
    return d[:, 0].reshape(H, W), d[:, 1].reshape(H, W), i[:, 0].reshape(H, W)


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def mirror_pts(pts):
    return [(W - 1 - x, y) for x, y in pts]


# ---------------------------------------------------------------- Teilung (Yin-Yang-S)
wob = value_noise(W, H, 10, seed=21, octaves=2)
BX = 125 + 22 * np.sin(2 * np.pi * (yy - 40) / 300.0) + (wob - 0.5) * 6
FIRE = xx < BX


# ================================================================ Feuerseite
def fire_side():
    a = np.array(dither_gradient((W, H), [(0, (18, 3, 8)), (0.2, (38, 6, 12)), (0.4, (72, 14, 14)), (0.54, (124, 32, 16)),
                                           (0.62, (176, 64, 22)), (0.66, (214, 108, 34))]))
    n = value_noise(W, H, 26, seed=4, octaves=3)
    n2 = value_noise(W, H, 12, seed=5, octaves=2)
    smoke_t = np.clip((n * 0.8 + n2 * 0.4 - 0.6) * 3.2, 0, 1) * np.clip(1.1 - yy / 200, 0, 1)
    sm = dith(smoke_t)
    put(a, sm, (50, 12, 16))
    put(a, sm & dith(np.clip(smoke_t - 0.3, 0, 1) * 1.6), (32, 8, 12))
    put(a, sm & ~np.roll(sm, -2, axis=0) & (yy > 20), (118, 34, 20))
    put(a, sm & ~np.roll(sm, -1, axis=0) & (yy > 70), (190, 74, 28))
    ridge = 184 + 8 * np.sin(xx / 13.0) + 5 * np.sin(xx / 5.3 + 1) + (value_noise(W, 1, 8, seed=9)[0] - 0.5) * 12
    far = yy > ridge
    put(a, far, (62, 16, 18))
    put(a, far & (yy < ridge + 1.5), (150, 54, 24))
    vol = poly_mask([(-4, 226), (10, 196), (30, 168), (46, 146), (56, 136), (62, 138), (68, 135), (76, 142), (90, 164), (108, 190), (128, 214), (140, 236), (-4, 246)])
    rock_n = value_noise(W, H, 6, seed=12, octaves=2)
    lam = np.clip(0.35 + (rock_n - 0.5) * 0.9 + (xx - 66) * -0.004 + (yy - 136) * 0.001, 0, 1)
    rc = tones(lam, [(24, 8, 12), (40, 14, 16), (60, 22, 20), (82, 32, 24)], 0.8)
    a[vol, :3] = rc[vol]
    edge = vol & ~ndimage.binary_erosion(vol)
    put(a, edge & (xx > 62), (176, 64, 26))
    put(a, edge & (xx <= 62), (100, 32, 22))
    cr = np.hypot((xx - 63) / 1.6, yy - 136)
    put(a, dith(np.clip(1 - cr / 30, 0, 1) * 0.9) & ~vol, (206, 90, 28))
    put(a, dith(np.clip(1 - cr / 13, 0, 1)) & ~vol, (255, 190, 70))
    put(a, (np.abs(xx - 63) < 6) & (np.abs(yy - 137) < 1.5) & vol, (255, 220, 110))
    # Rauchfahne aus dem Krater (unten angeglüht)
    rp = random.Random(8)
    for k in range(7):
        pcx = 63 + k * 3.2 + math.sin(k * 1.3) * 2
        pcy = 128 - k * 5.2
        rad = 4.5 + k * 1.3
        dd = np.hypot(xx - pcx, (yy - pcy) * 1.15)
        t = np.clip(1 - dd / rad, 0, 1) * (1.0 - k * 0.09) * 3.2
        pm_ = dith(t)
        put(a, pm_, (70, 30, 30))
        put(a, pm_ & dith(np.clip(t - 1.0, 0, 1)), (98, 48, 42))
        put(a, pm_ & ~np.roll(pm_, 1, axis=0) & (yy < pcy), (122, 66, 54))
        lit = pm_ & ~np.roll(pm_, -1, axis=0) & (yy > pcy)
        put(a, lit, (230, 110, 36) if k < 3 else (160, 64, 30))
    r = random.Random(3)
    for sx0, tx, n_ in [(58, 26, 90), (61, 44, 110), (66, 88, 100), (69, 104, 70)]:
        x, y = sx0, 138
        for _ in range(n_):
            y += 1
            goal = sx0 + (tx - sx0) * min(1.0, (y - 138) / 70.0)
            if r.random() < 0.55:
                x += int(np.sign(goal - x))
            else:
                x += r.choice([-1, 0, 0, 1])
            if not (0 <= x < W - 1 and 0 <= y < H) or not vol[y, x]:
                break
            a[y, x, :3] = (255, 200, 70)
            if vol[y, x + 1]: a[y, x + 1, :3] = (214, 84, 24)
            if x > 0 and vol[y, x - 1] and r.random() < 0.5: a[y, x - 1, :3] = (150, 38, 18)
    lake = yy > 236 + 3 * np.sin(xx / 9.0)
    pts = [(r.uniform(-10, 260), r.uniform(226, 360)) for _ in range(95)]
    d1, d2, ci = voronoi(pts)
    crust = tones(np.clip(0.35 + (rock_n - 0.5) - d1 / 40, 0, 1), [(30, 8, 10), (50, 16, 14), (74, 26, 18)], 0.8)
    a[lake, :3] = crust[lake]
    put(a, lake & ((d2 - d1) < 3.0), (196, 66, 20))
    put(a, lake & ((d2 - d1) < 1.6), (255, 180, 58))
    put(a, lake & ((d2 - d1) < 0.6), (255, 244, 176))
    put(a, lake & ~np.roll(lake, 1, axis=0), (255, 150, 40))
    return a


# ================================================================ Eisseite
def ice_side():
    a = np.array(dither_gradient((W, H), [(0, (4, 8, 26)), (0.2, (10, 20, 54)), (0.4, (22, 48, 102)), (0.54, (50, 104, 166)),
                                           (0.62, (116, 180, 228)), (0.66, (180, 224, 248))]))
    for (y0, amp, ph, cols) in [(40, 10, 0.0, [(24, 104, 100), (54, 190, 146), (170, 255, 214)]),
                                (66, 8, 1.7, [(44, 52, 132), (100, 100, 214), (196, 176, 255)])]:
        cy = y0 + amp * np.sin(xx / 21.0 + ph) + 4 * np.sin(xx / 7.0 + ph * 2)
        dy = yy - cy
        streak = (np.sin(xx * 1.7 + ph) * 0.5 + 0.5) * 0.35 + 0.65
        t = np.clip(1 - np.abs(dy + 6) / 14, 0, 1) * np.where(dy < 0, 1, np.clip(1 - dy / 3, 0, 1)) * streak
        put(a, dith(t * 0.9), cols[0])
        put(a, dith(np.clip(t - 0.35, 0, 1) * 1.8), cols[1])
        put(a, (np.abs(dy) < 0.7) & (THR < 0.8), cols[2])
    r = random.Random(12)
    for _ in range(120):
        x, y = r.randrange(0, W), r.randrange(0, 180)
        a[y, x, :3] = r.choice([(255, 255, 255), (170, 200, 255), (120, 150, 210), (200, 230, 255)])
        if r.random() < 0.07 and 1 <= x < W - 1 and y >= 1:
            for dx, dy_ in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                a[y + dy_, x + dx, :3] = (120, 150, 210)

    def range_(peaks, base, lit, shade, snow, seed):
        m = np.zeros((H, W), bool); face = np.zeros((H, W), bool)
        for (px, py, wl, wr) in peaks:
            tri = poly_mask([(px - wl, base), (px - wl * 0.4, py + (base - py) * 0.35), (px, py), (px + wr * 0.5, py + (base - py) * 0.3), (px + wr, base)])
            m |= tri
            gx = px + (yy - py) * 0.2 + np.sin(yy / 3.0 + px) * 1.2
            face |= tri & (xx > gx)
        nn = value_noise(W, H, 5, seed=seed, octaves=2)
        put(a, m, lit)
        put(a, m & face, shade)
        put(a, m & dith(np.clip((nn - 0.55) * 2, 0, 1)) & ~face, shade)
        put(a, m & face & dith(np.clip((nn - 0.62) * 2, 0, 1)), lit)
        for (px, py, wl, wr) in peaks:
            cap = m & (yy < py + 8 + 3 * np.sin(xx * 1.3 + px)) & (yy >= py)
            put(a, cap, snow[0]); put(a, cap & face, snow[1])
        put(a, m & ~np.roll(m, 1, axis=0), snow[0])
        return m
    range_([(150, 164, 30, 30), (190, 146, 34, 40), (230, 158, 30, 30)], 226, (104, 154, 210), (66, 104, 170), [(230, 246, 255), (168, 198, 236)], 31)
    range_([(172, 184, 24, 24), (212, 170, 30, 34), (250, 188, 22, 20)], 238, (80, 124, 192), (40, 70, 136), [(244, 252, 255), (148, 184, 228)], 32)
    lake = yy > 236 + 3 * np.sin(xx / 9.0)
    pts = [(r.uniform(-10, 260), r.uniform(226, 360)) for _ in range(55)]
    d1, d2, ci = voronoi(pts)
    lam = np.clip(0.55 - (yy - 236) / 240 + (ci % 3) * 0.07 + (value_noise(W, H, 8, seed=41) - 0.5) * 0.4, 0, 1)
    a[lake, :3] = tones(lam, [(50, 86, 156), (80, 128, 200), (120, 170, 226), (170, 212, 244)], 0.8)[lake]
    put(a, lake & ((d2 - d1) < 1.2), (226, 246, 255))
    put(a, lake & ((d2 - d1) >= 1.2) & ((d2 - d1) < 2.2) & ((xx + yy) % 2 == 0), (36, 64, 130))
    put(a, lake & ((((xx - yy * 0.5) % 23) < 1.5)) & ((yy % 3) != 0), (214, 240, 255))
    put(a, lake & ~np.roll(lake, 1, axis=0), (240, 252, 255))
    return a


def background():
    a = np.where(FIRE[..., None], fire_side(), ice_side())
    a[..., 3] = 255
    dist = xx - BX
    steam_n = value_noise(W, H, 7, seed=77, octaves=2)
    st = np.clip(1 - np.abs(dist) / 7, 0, 1) * (0.15 + steam_n * 0.7)
    put(a, dith(st * 0.7), (150, 140, 156))
    put(a, dith(np.clip(st - 0.4, 0, 1) * 1.6), (214, 210, 222))
    put(a, (dist > -1.0) & (dist <= 0.0), (255, 190, 90))
    put(a, (dist > 0.0) & (dist <= 1.0), (200, 236, 255))
    return Image.fromarray(a.astype(np.uint8))


# ================================================================ Drachenkörper
LIGHT = np.array([-0.55, -0.7, 0.55]); LIGHT /= np.linalg.norm(LIGHT)


def serpent(ctrl, rfun, pal, belly, spk, dorsal=1, spike_every=8, spikes=(0.06, 0.9), crystal=False):
    pts = catmull(ctrl)
    seg = np.diff(pts, axis=0)
    s = np.concatenate([[0], np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))]); L = s[-1]
    tan = np.gradient(pts, axis=0); tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    nor = np.stack([-tan[:, 1], tan[:, 0]], 1) * dorsal
    P = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], 1)
    dist, idx = cKDTree(pts).query(P)
    dist = dist.reshape(H, W); idx = idx.reshape(H, W)
    ss = s[idx]; r = rfun(ss / L)
    off = ((P.reshape(H, W, 2) - pts[idx]) * nor[idx]).sum(2)
    m = dist <= r
    v = np.clip(off / np.maximum(r, 0.5), -1, 1)
    n2 = nor[idx] * v[..., None]
    nz = np.sqrt(np.clip(1 - v * v, 0, 1))
    I = np.clip(n2[..., 0] * LIGHT[0] + n2[..., 1] * LIGHT[1] + nz * LIGHT[2], 0, 1)
    tone = np.clip(np.floor(I * 4.0 - 0.1 + (THR - 0.5) * 0.3), 0, 4).astype(int)
    sx, sy = 5.0, 3.6
    j = np.floor(off / sy)
    fs = (ss / sx + 0.5 * (j % 2)) % 1
    fl = (off / sy) % 1
    q = (fs + 0.6 * (2 * fl - 1) ** 2) % 1
    rimp = q < 0.24
    ts = np.where(rimp, np.maximum(tone - 1, 0), tone)
    glint = (~rimp) & (q > 0.3) & (q < 0.5) & (np.abs(fl - 0.5) < 0.25) & (tone >= 2)
    ts = np.where(glint, np.minimum(tone + 1, 4), ts)
    col = np.array(pal)[ts + 1]
    bel = v < -0.3
    bt = np.clip(np.floor(I * 3.6 - 0.2 + (THR - 0.5) * 0.3), 0, 3).astype(int)
    pl = np.floor(ss) % 4
    bt = np.where(pl == 0, np.maximum(bt - 1, 0), np.where(pl == 1, np.minimum(bt + 1, 3), bt))
    col = np.where(bel[..., None], np.array(belly)[bt], col)
    col = np.where((np.abs(v + 0.3) < 0.09)[..., None], np.array(pal[1]), col)
    out = np.zeros((H, W, 4), np.uint8)
    out[m, :3] = col[m]; out[m, 3] = 255
    body = outline(Image.fromarray(out), pal[0] + (255,))
    sp = layer(); d = ImageDraw.Draw(sp)
    k = 0
    for i in range(len(pts)):
        if s[i] < k * spike_every:
            continue
        k += 1
        uu = s[i] / L
        if not (spikes[0] < uu < spikes[1]):
            continue
        rr = float(rfun(np.array(uu)))
        c = pts[i]; t = tan[i]; n = nor[i]
        hgt = rr * 0.6 + 2.5
        b0 = c + n * (rr - 1.5) - t * 3.4; b1 = c + n * (rr - 1.5) + t * 1.8
        tip = c + n * (rr + hgt) + t * (hgt * (0.3 if crystal else 0.85))
        d.polygon([tuple(b0), tuple(tip), tuple(b1)], fill=spk[1])
        d.line([tuple(c + n * rr + t * 0.3), tuple(tip)], fill=spk[2])
        d.point(tuple(np.floor(tip)), fill=spk[3])
    sp = outline(sp, spk[0])
    lay = layer()
    lay.alpha_composite(sp); lay.alpha_composite(body)
    return lay, dict(pts=pts, tan=tan, nor=nor, s=s, L=L)


def rbody(u):
    u = np.asarray(u, float)
    return np.where(u < 0.16, 6.0 + u / 0.16 * 5.0, np.maximum(11.0 - (u - 0.16) / 0.84 * 10.0, 1.2))


# ================================================================ Drachenkopf (handgepixelt, Blick nach rechts)
HEAD = """
oo....................................................
oJJoo.................................................
.ohJJJoo..............................................
..oohhHHHHJJJoo.......................................
....oohhhHHHHJJoo.....................................
......ooohhHHHHJJoo...................................
.........oohHHHHHJJoo.................................
...........ohhHHHHHJJoo......o........................
............oohHHHHHHJJoooooo5o.......................
...oooooooo...ohhHHHhhh55555545oo.....................
..oJJJJJJJJooo.oohhh5554444444455ooo..................
...oooohhhHJJJooo5554444445555444555oooo........o.....
.......ooohhHHJJ232133213oooooooo4445555oooooooo5o....
...oo.....oohhh122213221323oEEeo344444445555555545oo..
..offoooo...oo1121112111212oepeo3333444444444444nn55o.
...ooffffoooo122213321332122oo12233333334444444414445o
.....ooffffff1222132213221322222222233333333333333444o
.......ooffff1211121112111212222222222223333333323334o
.........ooff2212321332133212222222221111111111111111o
...........o22212221322132211111111111111111111111111o
.........ooo2111211121112111mmwmmmwmmmwmmmwmmmwmmwwmo.
......ooofff2122212221222122mwmmmmmmmmmmmmmmmmmmmmwo..
..ooooffffff11111111111111cccccmmmwtttTtttmmmmmmmmo...
.offffffffffff11111111111bbbbbbccccccmmwmmmmmmmmmmo...
..ooooooooooooo111111bbbabbbabbbabbbaccccccmwmmmmo....
...............of1bbabbbabbbabbbabbbabbbabbcccccco....
.............oofabbbabbbabbbabbbabbbabbbabbbabccco....
............offfaaaaabbbabbbabbbabbbabbbabbbabbo......
..........oofffffoaaaaaaaaaaaaaaaaaaaaaaaaaaao........
.........offffoo...oooooooooooooooooooooooooo.........
.......ooffoo.........................................
......offoo...........................................
.......oo.............................................
"""


def sprite(txt, cmap):
    rows = txt.strip('\n').split('\n')
    w = max(len(r) for r in rows); h = len(rows)
    out = np.zeros((h, w, 4), np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cmap:
                out[y, x, :3] = cmap[ch][:3]; out[y, x, 3] = 255
    return Image.fromarray(out)


def head(pal, belly, horn, eye, frill, mouth=((60, 8, 18), (150, 36, 50), (220, 90, 100)), teeth=(250, 246, 226)):
    c = {'o': pal[0], '1': pal[1], '2': pal[2], '3': pal[3], '4': pal[4], '5': pal[5],
         'a': belly[0], 'b': belly[1], 'c': belly[2], 'h': horn[0], 'H': horn[1], 'J': horn[2],
         'm': mouth[0], 't': mouth[1], 'T': mouth[2], 'w': teeth, 'e': eye[0], 'E': eye[1],
         'p': pal[0], 'n': pal[0], 'f': frill[0], 'F': frill[1]}
    return sprite(HEAD, c)


# ================================================================ Flügel
def wing(shoulder, elbow, wrist, tips, back, pal, bone, seed=0):
    """Fledermausflügel: Arm (Schulter-Ellbogen-Handgelenk), Finger fächern vom Handgelenk aus.
    Jedes Membranfeld ist vom vorderen zum hinteren Finger hin verlaufend schattiert (Faltenwirkung)."""
    a = np.zeros((H, W, 4), np.uint8)
    wx, wy = wrist
    chain = list(tips) + [back]
    n = value_noise(W, H, 5, seed=seed, octaves=2)
    dw = np.hypot(xx - wx, yy - wy)
    ang = np.arctan2(yy - wy, xx - wx)
    mem = np.zeros((H, W), bool)
    for i in range(len(chain) - 1):
        p0 = np.array(chain[i], float); p1 = np.array(chain[i + 1], float)
        mid = (p0 + p1) / 2
        ctrl = mid + (np.array(wrist, float) - mid) * 0.28
        arc = [tuple((1 - t) ** 2 * p0 + 2 * (1 - t) * t * ctrl + t * t * p1) for t in np.linspace(0, 1, 20)]
        extra = [shoulder, elbow] if i == len(chain) - 2 else []
        pm = poly_mask([wrist] + arc + extra) & ~mem
        a0 = math.atan2(p0[1] - wy, p0[0] - wx); a1 = math.atan2(p1[1] - wy, p1[0] - wx)
        da = (a1 - a0 + np.pi) % (2 * np.pi) - np.pi
        raw = ((ang - a0 + np.pi) % (2 * np.pi) - np.pi) / (da if abs(da) > 1e-3 else 1)
        frac = np.where((raw < -0.05) | (raw > 1.05), 0.15, np.clip(raw, 0, 1))
        lam = np.clip(-0.04 + frac * 0.5 + dw / 300 + (n - 0.5) * 0.25, 0, 1)
        col = tones(lam, pal[1:], 1.0)
        a[pm, :3] = col[pm]; a[pm, 3] = 255
        mem |= pm
    lay = Image.fromarray(a)
    dr = ImageDraw.Draw(lay)
    # Adern: leicht gebogene Linien parallel zu den Fingern
    r = random.Random(seed)
    for i in range(len(chain) - 1):
        p0 = np.array(chain[i], float); p1 = np.array(chain[i + 1], float)
        for f in (0.35, 0.7):
            tgt = p0 + (p1 - p0) * f
            ln = r.uniform(0.55, 0.8)
            q0 = np.array(wrist, float) + (tgt - wrist) * 0.12
            q1 = np.array(wrist, float) + (tgt - wrist) * ln
            mid = (q0 + q1) / 2 + np.array([-(q1 - q0)[1], (q1 - q0)[0]]) * 0.06
            pts = [tuple((1 - t) ** 2 * q0 + 2 * (1 - t) * t * mid + t * t * q1) for t in np.linspace(0, 1, 12)]
            dr.line(pts, fill=pal[2])
            for k in range(2):
                bp = np.array(pts[r.randint(5, 10)])
                dd = (q1 - q0) / np.linalg.norm(q1 - q0)
                side = np.array([-dd[1], dd[0]]) * r.choice([-1, 1])
                dr.line([tuple(bp), tuple(bp + dd * 4 + side * 4)], fill=pal[2])
    la = np.array(lay)
    edge = mem & ~ndimage.binary_erosion(mem)
    edge2 = mem & ~edge & ~ndimage.binary_erosion(mem, iterations=2)
    put(la, edge2 & (dw > 30), pal[5])
    put(la, edge, pal[0])
    lay = Image.fromarray(la)
    dr = ImageDraw.Draw(lay)

    def bonel(p, q, w_, hi=True):
        dr.line([p, q], fill=bone[0], width=w_ + 2)
        dr.line([p, q], fill=bone[1], width=w_)
        if hi:
            dr.line([p, q], fill=bone[2], width=1)

    for tp in tips:
        bonel(wrist, tp, 2)
        # Knöchel in der Mitte
        kx, ky = (wx + tp[0]) / 2, (wy + tp[1]) / 2
        dr.ellipse((kx - 1.5, ky - 1.5, kx + 1.5, ky + 1.5), fill=bone[1], outline=bone[0])
        dr.point(tp, fill=bone[2])
        # Krallenspitze
        ddx, ddy = tp[0] - wx, tp[1] - wy; L = math.hypot(ddx, ddy)
        dr.line([tp, (tp[0] + ddx / L * 3, tp[1] + ddy / L * 3)], fill=bone[0], width=2)
    bonel(shoulder, elbow, 4); bonel(elbow, wrist, 3)
    for jnt in (elbow, wrist):
        dr.ellipse((jnt[0] - 2.5, jnt[1] - 2.5, jnt[0] + 2.5, jnt[1] + 2.5), fill=bone[1], outline=bone[0])
        dr.point((jnt[0] - 1, jnt[1] - 1), fill=bone[2])
    # Daumenkralle am Handgelenk
    sgn = 1 if elbow[0] > wx else -1
    dr.polygon([(wx - 1, wy - 2), (wx + 2 * sgn, wy - 2), (wx + 5 * sgn, wy - 8)], fill=bone[2], outline=bone[0])
    return lay


# ================================================================ Eier
def egg(w, h, kind):
    ey, ex = np.mgrid[0:h, 0:w]
    th = BAYER4[ey % 4, ex % 4]
    cx, cy = (w - 1) / 2, (h - 1) / 2 + 2
    rx, ry = w / 2 - 0.5, h / 2 - 1.5
    m = egg_mask(w, h, cx, cy, rx, ry, 0.2)
    ny = np.clip((ey - cy) / ry, -1, 1)
    rxx = rx * (1 - 0.2 * np.clip(-ny, 0, 1))
    nx = np.clip((ex - cx) / rxx, -1, 1)
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    lam = np.clip(nx * -0.5 + ny * -0.5 + nz * 0.7, 0, 1)
    lon = np.arcsin(np.clip(nx / np.sqrt(np.clip(1 - ny * ny, 0.05, 1)), -1, 1)) / (np.pi / 2)
    out = np.zeros((h, w, 4), np.uint8)
    if kind == 'fire':
        a = lon * 3.6; b = (ny + 1) * 5.0
        j = np.floor(b); fa = (a + 0.5 * (j % 2)) % 1; fb = b % 1
        yedge = 1 - 0.8 * np.abs(2 * fa - 1)
        loc = np.clip(fb / np.maximum(yedge, 0.1), 0, 1)
        Pl = [(34, 4, 8), (96, 12, 12), (164, 36, 16), (226, 96, 24), (255, 172, 48), (255, 236, 140)]
        k = np.clip(np.floor(loc * 3.4 + lam * 2.2 - 0.6 + (th - 0.5) * 0.5), 1, 5).astype(int)
        rim = (fb >= yedge - 0.06)
        k = np.where(rim, np.where(lam > 0.7, 1, 0), k)
        col = np.array(Pl)[k]
        oc = (30, 4, 8)
    else:
        a = lon * 3.4; b = (ny + 1) * 4.4
        f1 = (a + b) % 1; f2 = (a - b) % 1
        line = (f1 < 0.15) | (f2 < 0.15)
        cc = np.abs(f1 - 0.45) + np.abs(f2 - 0.45)
        Pl = [(16, 34, 84), (36, 84, 150), (66, 136, 200), (116, 188, 236), (186, 234, 252), (250, 255, 255)]
        k = np.clip(np.floor((1 - cc) * 2.2 + lam * 3.0 - 0.5 + (th - 0.5) * 0.5), 1, 5).astype(int)
        k = np.where(line, np.where(lam > 0.75, 2, 0), k)
        col = np.array(Pl)[k]
        oc = (10, 20, 58)
    out[m, :3] = col[m]; out[m, 3] = 255
    img = outline(Image.fromarray(out), oc + (255,))
    d = ImageDraw.Draw(img)
    gx, gy = int(w * 0.27), int(h * 0.2)
    d.line((gx, gy + 2, gx + 2, gy), fill=(255, 255, 240))
    d.point((gx - 1, gy + 5), fill=(255, 255, 240))
    return img


def crack(img, pts, core, glowc, width=2):
    a = np.array(img)[..., 3] > 0
    d = ImageDraw.Draw(img)
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=glowc, width=width)
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=core, width=1)
    b = np.array(img); b[..., 3] = np.where(a, b[..., 3], 0)
    return Image.fromarray(b)


# ================================================================ Basaltsäulen / Eiskristalle
def basalt(x0, x1, top_fn, seed=5):
    lay = layer()
    r = random.Random(seed)
    cw = 7
    C = np.array([(20, 8, 12), (36, 14, 18), (56, 24, 24), (80, 36, 30), (108, 52, 38)])
    for cx in range(x0, x1, cw):
        t = int(top_fn(cx + cw / 2) + r.randint(-2, 2))
        a = np.zeros((H, W, 4), np.uint8)
        body = (xx >= cx) & (xx < cx + cw) & (yy >= t + 2) & (yy < 305)
        fx = xx - cx
        base = np.where(fx < 2, 3, np.where(fx < 4, 2, np.where(fx < 6, 1, 0)))
        nb = value_noise(W, H, 4, seed=seed + cx, octaves=1)
        shade = base - ((yy - t) > 34).astype(int) - ((yy - t) > 62).astype(int) + (nb > 0.72) - (nb < 0.25)
        shade = np.clip(shade, 0, 4)
        a[body, :3] = C[shade][body]; a[body, 3] = 255
        for yb in range(t + 8 + r.randint(0, 6), 305, r.randint(9, 15)):
            seg = body & (yy == yb) & (fx < cw - 1)
            a[seg, :3] = (18, 6, 10)
            if r.random() < 0.35:
                a[seg & (fx >= 1) & (fx <= 3), :3] = (255, 140, 40)
        img = Image.fromarray(a)
        d = ImageDraw.Draw(img)
        d.polygon([(cx, t + 2), (cx + 1, t), (cx + cw - 2, t), (cx + cw - 1, t + 2), (cx + cw - 2, t + 3), (cx + 1, t + 3)], fill=(128, 66, 44))
        d.line((cx + 1, t, cx + cw - 2, t), fill=(176, 96, 52))
        d.point((cx + 2, t + 1), fill=(210, 130, 70))
        lay.alpha_composite(outline(img, (12, 4, 8, 255)))
    return lay


def crystal(lay, base, ang, length, wid, pal, seed=0):
    """Sechseckiges Kristallprisma mit drei sichtbaren Flächen und Spitze."""
    a = math.radians(ang)
    ax = np.array([math.sin(a), -math.cos(a)])
    nx_ = np.array([math.cos(a), math.sin(a)])
    b = np.array(base, float)
    hw = wid / 2
    tip = b + ax * (length + wid * 0.9)
    sh = b + ax * length
    L0, R0 = b - nx_ * hw, b + nx_ * hw
    L1, R1 = sh - nx_ * hw, sh + nx_ * hw
    ML0, MR0 = b - nx_ * hw * 0.25, b + nx_ * hw * 0.35
    ML1, MR1 = sh - nx_ * hw * 0.25, sh + nx_ * hw * 0.35
    img = layer(); d = ImageDraw.Draw(img)
    d.polygon([tuple(L0), tuple(L1), tuple(tip), tuple(R1), tuple(R0)], fill=pal[2])
    d.polygon([tuple(L0), tuple(L1), tuple(tip), tuple(ML1), tuple(ML0)], fill=pal[3])
    d.polygon([tuple(MR0), tuple(MR1), tuple(tip), tuple(R1), tuple(R0)], fill=pal[1])
    d.line([tuple(ML0), tuple(ML1), tuple(tip)], fill=pal[4])
    d.line([tuple(L0 + nx_ * 1), tuple(L1 + nx_ * 1)], fill=pal[4])
    r = random.Random(seed)
    for _ in range(max(1, int(length / 12))):
        t0 = r.uniform(0.15, 0.85)
        p = b + ax * length * t0
        d.line([tuple(p - nx_ * hw * 0.2), tuple(p + nx_ * hw * 0.3 + ax * 2)], fill=pal[4])
    img = outline(img, pal[0])
    ImageDraw.Draw(img).point(tuple(np.round(tip - ax * 1.2)), fill=(255, 255, 255))
    lay.alpha_composite(img)
    return lay


# ================================================================ Nest
def nest(front=True):
    lay = layer()
    r = random.Random(9 if front else 19)
    stones = []
    n = 40 if front else 26
    for i in range(n):
        t = i / (n - 1)
        x = 80 + t * 90 + r.uniform(-2, 2)
        y = (219 + 4 * math.sin(t * math.pi) + r.uniform(-2, 2)) if front else (212 - 3 * math.sin(t * math.pi) + r.uniform(-1, 1))
        stones.append((x, y, r.uniform(3.0, 5.2), r.uniform(2.2, 3.4)))
    stones.sort(key=lambda s: s[1])
    for (x, y, rx, ry) in stones:
        w_, h_ = int(rx * 2 + 3), int(ry * 2 + 3)
        sy, sx = np.mgrid[0:h_, 0:w_]
        nx_ = (sx - w_ / 2 + 0.5) / rx; ny_ = (sy - h_ / 2 + 0.5) / ry
        m = nx_ ** 2 + ny_ ** 2 <= 1
        l = np.clip(0.55 - nx_ * 0.35 - ny_ * 0.5, 0, 1)
        fire = FIRE[min(H - 1, int(y)), min(W - 1, int(x))]
        cols = [(22, 10, 18), (44, 24, 36), (72, 44, 58), (112, 78, 88)] if fire else [(46, 66, 118), (86, 118, 170), (156, 194, 232), (232, 246, 255)]
        k = np.clip(np.floor(l * 4 + (BAYER4[sy % 4, sx % 4] - 0.5) * 0.5), 0, 3).astype(int)
        o = np.zeros((h_, w_, 4), np.uint8)
        o[m, :3] = np.array(cols)[k][m]; o[m, 3] = 255
        s_img = outline(Image.fromarray(o), (12, 6, 14, 255))
        dd = ImageDraw.Draw(s_img)
        if fire and r.random() < 0.55:
            yx = h_ // 2 + r.randint(-1, 1)
            dd.line((w_ // 2 - 2, yx, w_ // 2, yx + 1, w_ // 2 + 2, yx), fill=(255, 130, 36))
            dd.point((w_ // 2, yx + 1), fill=(255, 220, 120))
        if not fire:
            dd.line((w_ // 2 - 2, 1, w_ // 2 + 1, 1), fill=(255, 255, 255))
        lay.alpha_composite(s_img, (int(x - w_ / 2), int(y - h_ / 2)))
    return lay


# ================================================================ Atem
def breath():
    lay = np.zeros((H, W, 4), np.uint8)
    n = value_noise(W, H, 5, seed=88, octaves=2)
    cy = MOUTH_F[1] + 1
    for side in ('fire', 'ice'):
        x0 = MOUTH_F[0] if side == 'fire' else MOUTH_I[0]
        sgn = 1 if side == 'fire' else -1
        dx = (xx - x0) * sgn
        span = abs(CLASH[0] - x0)
        t = dx / span
        wv = 2.2 + 9.0 * np.clip(t, 0, 1) ** 0.7
        wobble = np.sin(xx * 0.55 + (0 if side == 'fire' else 2)) * 1.2 * np.clip(t, 0, 1)
        dy = np.abs(yy - cy - wobble)
        core = np.clip(1 - dy / wv, 0, 1) * (dx >= 0) * (t <= 1.03)
        core = core * (0.7 + n * 0.6)
        cols = [(150, 24, 16), (230, 84, 22), (255, 170, 50), (255, 240, 170)] if side == 'fire' else \
               [(40, 70, 160), (100, 170, 236), (190, 236, 255), (255, 255, 255)]
        for i, thr_ in enumerate([0.12, 0.35, 0.58, 0.8]):
            mm = dith(np.clip((core - thr_) * 6, 0, 1)) & (core > thr_ - 0.08)
            put(lay, mm, cols[i])
    return Image.fromarray(lay)


def clash():
    cx, cy = CLASH
    dist = np.hypot(xx - cx, (yy - cy) * 1.1)
    ang = np.arctan2(yy - cy, xx - cx)
    ray = (np.cos(ang * 8) * 0.5 + 0.5) ** 3
    t = np.clip(1 - dist / (14 + 12 * ray), 0, 1)
    burst = dith(t * 1.4)
    st = np.clip(1 - np.hypot(xx - cx, (yy - cy + 6) * 1.6) / 26, 0, 1) * (0.5 + value_noise(W, H, 5, seed=3) * 0.8)
    a = np.zeros((H, W, 4), np.uint8)
    put(a, dith(st * 1.1) & ~burst, (200, 196, 210))
    put(a, dith(np.clip(st - 0.4, 0, 1) * 2) & ~burst, (236, 234, 240))
    put(a, burst, (255, 236, 200))
    put(a, dith(np.clip(t - 0.3, 0, 1) * 2.5), (255, 255, 255))
    out = Image.fromarray(a)
    d = ImageDraw.Draw(out)
    r = random.Random(23)
    for k in range(22):
        an = r.uniform(0, 2 * math.pi)
        r0, r1 = r.uniform(14, 20), r.uniform(22, 34)
        p0 = (cx + math.cos(an) * r0, cy + math.sin(an) * r0 * 0.8)
        p1 = (cx + math.cos(an) * r1, cy + math.sin(an) * r1 * 0.8)
        left = p1[0] < cx
        c0, c1 = ((255, 120, 30), (255, 220, 120)) if left else ((90, 170, 240), (230, 250, 255))
        d.line([p0, p1], fill=c0)
        d.point(p1, fill=c1)
    sparkle(d, cx, cy, 6, (255, 255, 220))
    return out


# ================================================================ Partikel: Glut und Schneeflocken
def particles(lay_img):
    d = ImageDraw.Draw(lay_img)
    r = random.Random(17)
    for _ in range(70):
        x, y = r.randrange(8, W - 8), r.randrange(10, 300)
        f = FIRE[y, x]
        # im Mittelband mischen sich beide
        if abs(x - BX[y, x]) < 26 and r.random() < 0.5:
            f = not f
        if f:
            c = r.choice([(255, 220, 120), (255, 170, 60), (255, 120, 30)])
            d.point((x, y), fill=c)
            if r.random() < 0.6:
                d.point((x - 1, y + 1), fill=(170, 50, 20))
        else:
            s = r.random()
            if s < 0.6:
                d.point((x, y), fill=(240, 250, 255))
            elif s < 0.85:
                d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(200, 230, 255)); d.point((x, y), fill=(255, 255, 255))
            else:
                sparkle(d, x, y, 2, (180, 220, 255))
                d.point([(x - 1, y - 1), (x + 1, y + 1), (x - 1, y + 1), (x + 1, y - 1)], fill=(150, 200, 250))
    return lay_img


# ================================================================ Aufbau
im = background()

HX, HY = 40, 66
NECK = (HX + 19, HY + 27)
MOUTH_F = (HX + 50, HY + 21)
MOUTH_I = (W - 1 - MOUTH_F[0], MOUTH_F[1])
CLASH = (125, MOUTH_F[1] + 1)

fire_ctrl = [NECK, (46, 108), (35, 124), (28, 146), (24, 172), (28, 204), (40, 232), (62, 256), (92, 271), (125, 280), (158, 288), (188, 292), (210, 286), (220, 272), (214, 260), (205, 262)]
ice_ctrl = mirror_pts(fire_ctrl)

# Flügel (ganz hinten)
FW = dict(shoulder=(28, 118), elbow=(80, 50), wrist=(58, 11), tips=[(8, 7), (3, 40), (5, 76), (12, 108)], back=(18, 128))
im.alpha_composite(wing(FW['shoulder'], FW['elbow'], FW['wrist'], FW['tips'], FW['back'], FW_PAL, [(30, 4, 10), (196, 80, 34), (255, 196, 110)], seed=3))
im.alpha_composite(wing(*[mirror_pts([FW[k]])[0] for k in ('shoulder', 'elbow', 'wrist')], mirror_pts(FW['tips']), mirror_pts([FW['back']])[0],
                        IW_PAL, [(8, 14, 44), (120, 176, 236), (240, 252, 255)], seed=4))


# Fels: Basaltsäulen links, Eiskristalle rechts
def top_fn(x):
    return 221 + max(0.0, abs(x - 125) - 50) ** 1.3 * 1.1


im.alpha_composite(basalt(48, 126, top_fn))
cl = layer()
CPAL = [(10, 18, 56, 255), (60, 104, 180, 255), (110, 162, 226, 255), (176, 216, 248, 255), (236, 250, 255, 255)]
for (bx, by, ang, ln, wd) in [(186, 300, 30, 44, 11), (176, 300, 14, 60, 13), (162, 300, 4, 70, 12), (150, 300, -6, 64, 11),
                              (138, 300, -12, 50, 10), (196, 300, 48, 30, 9), (130, 300, -20, 34, 8), (170, 290, 22, 20, 7)]:
    crystal(cl, (bx, by), ang, ln, wd, CPAL, seed=int(bx))
im.alpha_composite(cl)

# Eier im Nest
EW, EH = 36, 48
ie = egg(EW, EH, 'ice'); fe = egg(EW, EH, 'fire')
fe = crack(fe, [(2, 20), (7, 17), (10, 21), (15, 15), (19, 19), (24, 14), (29, 17), (34, 13)], (255, 250, 210), (255, 150, 40))
fe = crack(fe, [(15, 15), (16, 10), (14, 7)], (255, 250, 210), (255, 150, 40))
fe = crack(fe, [(19, 19), (20, 25), (18, 29)], (255, 250, 210), (255, 150, 40))
_d = ImageDraw.Draw(fe)
_d.polygon([(13, 5), (15, 3), (17, 4), (19, 3), (22, 5), (21, 8), (18, 9), (15, 8)], fill=(20, 2, 6))
_d.line([(13, 5), (15, 3), (17, 4), (19, 3), (22, 5)], fill=(255, 190, 80))
_d.point([(16, 6), (19, 6)], fill=(255, 236, 90)); _d.point([(16, 7), (19, 7)], fill=(255, 150, 20))
IEX, FEX, EY = 106 - EW // 2, 145 - EW // 2, 172
im.alpha_composite(nest(front=False))
gl, pp = glow(fe, (255, 140, 40, 255), radius=5, strength=0.45)
im.alpha_composite(gl, (FEX - pp, EY - pp))
gl, pp = glow(ie, (150, 220, 255, 255), radius=5, strength=0.35)
im.alpha_composite(gl, (IEX - pp, EY - pp))
im.alpha_composite(ie, (IEX, EY))
im.alpha_composite(fe, (FEX, EY))
im.alpha_composite(nest(front=True))
_d = ImageDraw.Draw(im)
for (sx_, sy_) in [(116, 223), (131, 224), (137, 221)]:
    _d.polygon([(sx_, sy_), (sx_ + 2, sy_ - 1), (sx_ + 3, sy_ + 1), (sx_ + 1, sy_ + 2)], fill=(200, 60, 20), outline=(40, 4, 8))

# Drachen
im = particles(im)
ice_lay, ICE_G = serpent(ice_ctrl, rbody, ICE_PAL, ICE_BELLY, ICE_SPK, dorsal=-1, crystal=True)
fire_lay, FIRE_G = serpent(fire_ctrl, rbody, FIRE_PAL, FIRE_BELLY, FIRE_SPK, dorsal=1)
im.alpha_composite(ice_lay)
im.alpha_composite(fire_lay)
FH = head(FIRE_PAL, FIRE_BELLY, [(90, 50, 30), (170, 130, 90), (240, 220, 170)], [(255, 150, 0), (255, 250, 180)], [(224, 84, 20), (255, 196, 60)])
IH = head(ICE_PAL, ICE_BELLY, [(60, 90, 150), (170, 210, 240), (255, 255, 255)], [(0, 200, 255), (220, 255, 255)], [(104, 176, 236), (230, 250, 255)]).transpose(Image.FLIP_LEFT_RIGHT)
im.alpha_composite(breath())
im.alpha_composite(clash())
im.alpha_composite(FH, (HX, HY))
im.alpha_composite(IH, (W - HX - IH.width, HY))

# ---------------------------------------------------------------- Kartenfiguren (1x, nativ)
def cut_sprites():
    nv = native('Red Dragoneer')

    def bgr(a):
        L = a[..., :3].mean(2); r, g, b = a[..., 0], a[..., 1], a[..., 2]
        return (L > 45) | ((g < 45) & (b < 70) & (r > 70))
    rd = keep_largest(cut_by(nv, (20, 8, 54, 42), bgr)); rd = rd.crop(rd.getbbox())
    bd = keep_largest(cut_native(native('Blue-Ice Dragon'), (18, 8, 58, 42), barrier_lum=70)); bd = bd.crop(bd.getbbox())
    sb = keep_largest(cut_by(native('Sorbereus the Adapting Dragon'), (6, 6, 70, 40),
                             lambda a: (a[..., 2] > a[..., 0] + 40) & (a[..., 2] > a[..., 1] + 10) & ~((a[..., 1] > 150) & (a[..., 0] > 120))))
    sb = sb.crop(sb.getbbox())
    return rd, bd, sb


RD, BD, SB = cut_sprites()
sp = outline(SB, (10, 14, 40, 255))
im.alpha_composite(sp, (134, 22))


# Drachlinge neben den Eiern (1x)
rd = outline(RD, (34, 4, 10, 255))
bd = outline(BD.transpose(Image.FLIP_LEFT_RIGHT), (10, 16, 48, 255))
for spr, (sx_, sy_), gc in [(rd, (57, 226 - rd.height), (20, 6, 8, 255)), (bd, (163, 227 - bd.height), (220, 240, 255, 255))]:
    g_, pp = glow(spr, gc, radius=2, strength=0.9)
    im.alpha_composite(g_, (sx_ - pp, sy_ - pp))
    im.alpha_composite(spr, (sx_, sy_))


# ================================================================ Vordergrund-Sims + Titel
def ledge():
    a = np.zeros((H, W, 4), np.uint8)
    n = value_noise(W, H, 5, seed=91, octaves=2)
    top = 306 + 2.5 * np.sin(xx / 6.0) + (value_noise(W, 1, 6, seed=92)[0] - 0.5) * 6
    m = yy >= top
    # Feuerseite: Basaltplatte mit Glutrissen
    lam = np.clip(0.45 + (n - 0.5) * 0.8 - (yy - top) / 60, 0, 1)
    fc = tones(lam, [(18, 6, 10), (30, 10, 14), (46, 16, 18), (64, 24, 22)], 0.8)
    ic = tones(lam, [(20, 34, 76), (34, 56, 110), (54, 86, 150), (80, 120, 184)], 0.8)
    a[m, :3] = np.where(FIRE[..., None], fc, ic)[m]; a[m, 3] = 255
    pts = [(random.Random(i).uniform(0, W), random.Random(i + 99).uniform(300, H)) for i in range(34)]
    d1, d2, _ = voronoi(pts)
    seam = m & ((d2 - d1) < 1.0) & (yy > top + 2)
    put(a, seam & FIRE, (150, 40, 18))
    put(a, seam & FIRE & ((d2 - d1) < 0.45), (255, 150, 40))
    put(a, seam & ~FIRE, (16, 26, 62))
    put(a, seam & ~FIRE & ((d2 - d1) < 0.45), (150, 196, 240))
    # Oberkante: Glutsaum links, Schneekappe rechts
    e1 = m & ~np.roll(m, 1, axis=0)
    e2 = m & ~np.roll(m, 2, axis=0) & ~e1
    e3 = m & ~np.roll(m, 3, axis=0) & ~e1 & ~e2
    put(a, e1 & FIRE, (255, 170, 60)); put(a, e2 & FIRE, (170, 56, 20)); put(a, e3 & FIRE & (THR < 0.5), (110, 32, 18))
    put(a, e1 & ~FIRE, (255, 255, 255)); put(a, e2 & ~FIRE, (226, 242, 255)); put(a, e3 & ~FIRE & (THR < 0.6), (170, 206, 240))
    # Schnee-Tropfnasen
    r = random.Random(4)
    for x in range(W):
        if not FIRE[310, x] and r.random() < 0.3:
            y0 = int(top[0, x]) + 3
            for k in range(r.randint(1, 3)):
                if y0 + k < H: a[y0 + k, x, :3] = (200, 228, 250)
    return Image.fromarray(a)


def title():
    # eigenes "&" (das der Spielschrift ähnelt einem "$")
    AMP = ['..######..', '.###..###.', '.###..###.', '.###.###..', '..#####...', '.#####..##',
           '###.###.##', '###..####.', '###...###.', '###..#####', '.#####..##']
    amp = np.array([[c == '#' for c in row] for row in AMP])
    t1 = text_img('FIRE', 16, (255, 255, 255, 255)); t2 = text_img('ICE', 16, (255, 255, 255, 255))
    gh = max(t1.height, t2.height, amp.shape[0])
    t = Image.new('RGBA', (t1.width + t2.width + amp.shape[1] + 10, gh), (0, 0, 0, 0))
    t.alpha_composite(t1, (0, gh - t1.height))
    am = np.zeros(amp.shape + (4,), np.uint8); am[amp] = (255, 255, 255, 255)
    t.alpha_composite(Image.fromarray(am), (t1.width + 5, gh - amp.shape[0]))
    t.alpha_composite(t2, (t1.width + amp.shape[1] + 10, gh - t2.height))
    a = np.array(t).astype(int)
    h_, w_ = a.shape[:2]
    x0, y0 = (W - w_) // 2, 320
    ty = np.mgrid[0:h_, 0:w_][0] / max(1, h_ - 1)
    fire = FIRE[y0:y0 + h_, x0:x0 + w_]
    m = a[..., 3] > 0
    fcol = np.where((ty < 0.45)[..., None], np.array((255, 236, 140)), np.where((ty < 0.75)[..., None], np.array((255, 164, 48)), np.array((230, 84, 24))))
    icol = np.where((ty < 0.45)[..., None], np.array((250, 255, 255)), np.where((ty < 0.75)[..., None], np.array((170, 220, 250)), np.array((96, 156, 226))))
    col = np.where(fire[..., None], fcol, icol)
    a[m, :3] = col[m]
    img = Image.fromarray(a.astype(np.uint8))
    o = outline(img, (255, 0, 255, 255))
    oa = np.array(o); om = (oa[..., 0] == 255) & (oa[..., 1] == 0) & (oa[..., 2] == 255)
    oa[om & fire] = (40, 6, 10, 255); oa[om & ~fire] = (8, 14, 44, 255)
    o = Image.fromarray(oa)
    sh = Image.new('RGBA', (w_ + 1, h_ + 1), (0, 0, 0, 0))
    sh.alpha_composite(silhouette(o, (6, 4, 10)), (1, 1)); sh.alpha_composite(o, (0, 0))
    return sh, (x0, y0)


# ================================================================ Rahmen
def split_frame():
    fr = layer()
    bevel_frame(fr, (40, 6, 8), (255, 190, 80), (170, 50, 20), (96, 18, 12), (40, 6, 8), width=5)
    fr2 = layer()
    bevel_frame(fr2, (8, 14, 46), (236, 248, 255), (110, 160, 220), (48, 80, 150), (8, 14, 46), width=5)
    fa = np.array(fr); fb = np.array(fr2)
    fa[~FIRE] = fb[~FIRE]
    img = Image.fromarray(fa)
    d = ImageDraw.Draw(img)
    for (x, y) in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3)]:
        f = FIRE[y, x]
        c1, c2, c3 = ((120, 20, 10), (255, 110, 30), (255, 240, 170)) if f else ((20, 40, 110), (110, 190, 250), (255, 255, 255))
        d.polygon([(x - 3, y), (x, y - 3), (x + 3, y), (x, y + 3)], fill=c2, outline=c1)
        d.point((x, y), fill=c3); d.point((x - 1, y - 1), fill=c3)
    return img


im.alpha_composite(ledge())
t, txy = title()
im.alpha_composite(t, txy)
im.alpha_composite(split_frame())
print(save(im, '07_feuer_und_eis'))
