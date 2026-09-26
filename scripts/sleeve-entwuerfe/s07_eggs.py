# -*- coding: utf-8 -*-
"""07 Feuer & Eis: Feuer- und Eisdrache umschlingen ihr Nest mit zwei Dracheneiern.
Yin-Yang-Teilung: links Vulkan/Lavasee, rechts Gletscher/Polarlicht."""
from lib import *
from scipy.spatial import cKDTree

STAGE = int(os.environ.get('S07_STAGE', '99'))
yy, xx = np.mgrid[0:H, 0:W]
THR = BAYER4[yy % 4, xx % 4]
RND = random.Random(7)

# ---------------------------------------------------------------- Paletten
F_OUT = (36, 6, 10)
FIRE_PAL = [F_OUT, (92, 14, 16), (150, 30, 20), (206, 64, 24), (240, 120, 40), (255, 190, 90)]
FIRE_BELLY = [(150, 70, 24), (214, 140, 46), (248, 200, 92), (255, 238, 170)]
FIRE_SPK = [F_OUT + (255,), (214, 70, 18, 255), (255, 170, 50, 255), (255, 244, 190, 255)]
I_OUT = (12, 18, 52)
ICE_PAL = [I_OUT, (32, 52, 116), (56, 96, 172), (98, 152, 218), (158, 204, 246), (226, 246, 255)]
ICE_BELLY = [(92, 124, 186), (148, 184, 226), (198, 224, 248), (244, 252, 255)]
ICE_SPK = [I_OUT + (255,), (104, 176, 236, 255), (200, 236, 255, 255), (255, 255, 255, 255)]


# ---------------------------------------------------------------- Helfer
def arr(img):
    return np.array(img)


def put(a, mask, col):
    a[mask, :3] = col[:3]
    a[mask, 3] = 255


def dith(t, amt=1.0):
    """t (0..1) -> Bool mit Bayer-Dithering."""
    return t > (THR if amt == 1.0 else 0.5 + (THR - 0.5) * amt)


def tones(lam, cols, amt=0.6):
    """lam 0..1 -> Farbindex mit leichtem Dithering zwischen Stufen."""
    n = len(cols)
    k = np.clip(np.floor(lam * n + (THR - 0.5) * amt), 0, n - 1).astype(int)
    return np.array(cols)[k]


def poly_mask(pts, w=W, h=H):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
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


def voronoi(pts, w=W, h=H):
    """Abstand zum nächsten/zweitnächsten Punkt + Zellindex."""
    tree = cKDTree(pts)
    P = np.stack([xx.ravel()[:w * h] if (w, h) == (W, H) else None], 0) if False else None
    gy, gx = np.mgrid[0:h, 0:w]
    d, i = tree.query(np.stack([gx.ravel(), gy.ravel()], 1), k=2)
    return d[:, 0].reshape(h, w), d[:, 1].reshape(h, w), i[:, 0].reshape(h, w)


# ---------------------------------------------------------------- Teilung (Yin-Yang-S)
wob = value_noise(W, H, 10, seed=21, octaves=2)
BX = 125 + 24 * np.sin(2 * np.pi * (yy - 40) / 300.0) + (wob - 0.5) * 6
FIRE = xx < BX


# ================================================================ Feuerseite
def fire_side():
    a = arr(dither_gradient((W, H), [(0, (22, 4, 8)), (0.16, (46, 8, 12)), (0.34, (92, 18, 14)), (0.48, (150, 40, 16)),
                                      (0.56, (206, 84, 24)), (0.6, (240, 140, 44))]))
    # Rauchschwaden oben (randbeleuchtet von unten)
    n = value_noise(W, H, 26, seed=4, octaves=3)
    n2 = value_noise(W, H, 12, seed=5, octaves=2)
    smoke_t = np.clip((n * 0.8 + n2 * 0.4 - 0.62) * 3.2, 0, 1) * np.clip(1 - yy / 190, 0, 1)
    sm = dith(smoke_t)
    below = np.roll(sm, -2, axis=0)
    put(a, sm, (58, 14, 16))
    put(a, sm & dith(np.clip(smoke_t - 0.3, 0, 1) * 1.6), (40, 10, 14))
    rim = sm & ~below & (yy > 20)
    put(a, rim, (150, 44, 20))
    put(a, sm & ~np.roll(sm, -1, axis=0) & (yy > 60), (210, 90, 30))
    # ferne Bergkette
    ridge = 172 + 10 * np.sin(xx / 13.0) + 6 * np.sin(xx / 5.3 + 1) + (value_noise(W, 1, 8, seed=9)[0] - 0.5) * 14
    far = yy > ridge
    put(a, far, (70, 18, 18))
    put(a, far & (yy < ridge + 2) & dith(np.full((H, W), 0.5)), (140, 50, 24))
    # Vulkan
    vol = poly_mask([(-4, 214), (6, 170), (22, 132), (34, 112), (41, 108), (49, 110), (54, 108), (62, 116), (78, 142), (98, 176), (120, 206), (140, 230), (-4, 240)])
    rock_n = value_noise(W, H, 6, seed=12, octaves=2)
    lam = np.clip(0.35 + (rock_n - 0.5) * 0.9 - (xx - 48) * 0.004 + (yy - 110) * 0.001, 0, 1)
    rc = tones(lam, [(26, 8, 10), (44, 14, 14), (64, 22, 18), (86, 32, 22)], 0.8)
    a[vol, :3] = rc[vol]
    # Rand-Licht auf der rechten Flanke vom Glühen
    edge = vol & ~ndimage.binary_erosion(vol)
    put(a, edge & (xx > 44), (170, 60, 24))
    put(a, edge & (xx <= 44), (96, 30, 20))
    # Kraterglut
    cr = np.hypot((xx - 46) / 1.6, yy - 108)
    halo = np.clip(1 - cr / 26, 0, 1) * 0.9
    hm = dith(halo) & ~vol
    put(a, hm, (230, 110, 30))
    put(a, dith(np.clip(1 - cr / 12, 0, 1)) & ~vol, (255, 200, 80))
    put(a, (np.abs(xx - 46) < 8) & (np.abs(yy - 109) < 2) & vol, (255, 220, 110))
    # Lavaströme (Random Walk)
    r = random.Random(3)
    for sx0, n_ in [(40, 70), (47, 90), (52, 60), (44, 110)]:
        x, y = sx0, 110
        for _ in range(n_):
            y += 1
            x += r.choice([-1, 0, 0, 1, 1]) * (1 if x > 46 else 1)
            x += 1 if r.random() < 0.25 else 0
            if not (0 <= x < W and 0 <= y < H) or not vol[y, x]:
                break
            a[y, x, :3] = (255, 200, 70)
            if x + 1 < W and vol[y, x + 1]: a[y, x + 1, :3] = (220, 90, 24)
            if x - 1 >= 0 and vol[y, x - 1] and r.random() < 0.5: a[y, x - 1, :3] = (160, 40, 18)
    # Lavasee mit Krustenplatten (Voronoi)
    lake = yy > 232 + 4 * np.sin(xx / 9.0)
    pts = [(r.uniform(-10, 260), r.uniform(220, 360)) for _ in range(90)]
    d1, d2, ci = voronoi(pts)
    seam = (d2 - d1) < 1.6
    seam2 = (d2 - d1) < 3.0
    pl = rock_n
    crust = tones(np.clip(0.35 + (pl - 0.5) + (d1 / 14) * -0.3, 0, 1), [(34, 10, 10), (56, 18, 14), (80, 28, 18)], 0.8)
    a[lake, :3] = crust[lake]
    put(a, lake & seam2, (200, 70, 20))
    put(a, lake & seam, (255, 186, 60))
    put(a, lake & seam & ((d2 - d1) < 0.6), (255, 246, 180))
    lk_edge = lake & ~np.roll(lake, 1, axis=0)
    put(a, lk_edge, (255, 150, 40))
    return a


# ================================================================ Eisseite
def ice_side():
    a = arr(dither_gradient((W, H), [(0, (4, 8, 26)), (0.18, (10, 20, 54)), (0.36, (22, 50, 104)), (0.5, (54, 110, 170)),
                                      (0.58, (120, 186, 230)), (0.62, (190, 230, 250))]))
    # Polarlicht
    for (y0, amp, ph, cols) in [(46, 12, 0.0, [(30, 120, 110), (60, 200, 150), (170, 255, 210)]),
                                (74, 9, 1.7, [(50, 60, 140), (110, 110, 220), (200, 180, 255)])]:
        cy = y0 + amp * np.sin(xx / 21.0 + ph) + 4 * np.sin(xx / 7.0 + ph * 2)
        dy = yy - cy
        streak = (np.sin(xx * 1.7 + ph) * 0.5 + 0.5) * 0.35 + 0.65
        t = np.clip(1 - np.abs(dy + 6) / 14, 0, 1) * np.where(dy < 0, 1, np.clip(1 - dy / 3, 0, 1)) * streak
        put(a, dith(t * 0.9), cols[0])
        put(a, dith(np.clip(t - 0.35, 0, 1) * 1.8), cols[1])
        put(a, (np.abs(dy) < 0.7) & dith(np.full((H, W), 0.8)), cols[2])
    # Sterne
    r = random.Random(12)
    for _ in range(110):
        x, y = r.randrange(0, W), r.randrange(0, 170)
        c = r.choice([(255, 255, 255), (170, 200, 255), (120, 150, 210), (200, 230, 255)])
        a[y, x, :3] = c
        if r.random() < 0.07 and 1 <= x < W - 1 and 1 <= y < H - 1:
            for dx, dy_ in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                a[y + dy_, x + dx, :3] = (120, 150, 210)
    # ferne Gletscherkette (heller, dunstig)
    def range_(peaks, base, lit, shade, snow, seed):
        m = np.zeros((H, W), bool); face = np.zeros((H, W), bool)
        for (px, py, wl, wr) in peaks:
            tri = poly_mask([(px - wl, base), (px, py), (px + wr, base)])
            m |= tri
            # Schattenseite rechts des Grats (Grat leicht gezackt)
            gx = px + (yy - py) * 0.18 + np.sin(yy / 3.0 + px) * 1.2
            face |= tri & (xx > gx)
        nn = value_noise(W, H, 5, seed=seed, octaves=2)
        put(a, m, lit)
        put(a, m & face, shade)
        put(a, m & dith(np.clip((nn - 0.55) * 2, 0, 1)) & ~face, shade)
        put(a, m & face & dith(np.clip((nn - 0.6) * 2, 0, 1)), lit)
        # Schneekappen
        for (px, py, wl, wr) in peaks:
            cap = m & (yy < py + 9 + 3 * np.sin(xx * 1.3 + px)) & (yy >= py)
            put(a, cap, snow[0]); put(a, cap & face, snow[1])
        return m
    range_([(150, 150, 30, 30), (186, 132, 34, 40), (226, 146, 30, 30), (252, 128, 26, 30)], 215, (110, 160, 214), (70, 110, 176), [(230, 246, 255), (170, 200, 236)], 31)
    range_([(170, 176, 26, 24), (214, 160, 30, 34), (248, 180, 22, 20)], 230, (86, 130, 196), (44, 74, 140), [(244, 252, 255), (150, 186, 230)], 32)
    # zugefrorener See mit Rissen
    lake = yy > 232 + 4 * np.sin(xx / 9.0)
    pts = [(r.uniform(-10, 260), r.uniform(220, 360)) for _ in range(40)]
    d1, d2, ci = voronoi(pts)
    lam = np.clip(0.55 - (yy - 232) / 240 + (ci % 3) * 0.08 + (value_noise(W, H, 8, seed=41) - 0.5) * 0.4, 0, 1)
    ic = tones(lam, [(60, 100, 170), (90, 140, 210), (130, 180, 232), (180, 220, 248)], 0.8)
    a[lake, :3] = ic[lake]
    put(a, lake & ((d2 - d1) < 1.2), (230, 248, 255))
    put(a, lake & ((d2 - d1) >= 1.2) & ((d2 - d1) < 2.2) & ((xx + yy) % 2 == 0), (40, 70, 140))
    # Spiegelglanz-Streifen
    gl = lake & ((((xx - yy * 0.5) % 23) < 1.5)) & ((yy % 3) != 0)
    put(a, gl, (220, 244, 255))
    put(a, lake & ~np.roll(lake, 1, axis=0), (240, 252, 255))
    return a


def background():
    fa = fire_side(); ia = ice_side()
    a = np.where(FIRE[..., None], fa, ia)
    a[..., 3] = 255
    # Grenze: Dampfband mit Glutrand / Frostrand
    dist = xx - BX
    put(a, (dist > -1.5) & (dist <= -0.5), (255, 200, 90))
    put(a, (dist > -0.5) & (dist <= 0.5), (255, 250, 230))
    put(a, (dist > 0.5) & (dist <= 1.5), (200, 236, 255))
    steam_n = value_noise(W, H, 7, seed=77, octaves=2)
    st = np.clip(1 - np.abs(dist) / 9, 0, 1) * (0.3 + steam_n * 0.9)
    put(a, dith(st * 0.8) & (np.abs(dist) > 1.5), (238, 232, 232))
    put(a, dith(np.clip(st - 0.45, 0, 1) * 2) & (np.abs(dist) > 1.5), (255, 255, 255))
    return Image.fromarray(a.astype(np.uint8))


im = background()
if STAGE <= 1:
    up(im, 3).save(os.path.join(TMP, 's07_stage.png')); im.save(os.path.join(TMP, 's07_base.png')); raise SystemExit


# ================================================================ Drachen
LIGHT = np.array([-0.5, -0.72, 0.8]); LIGHT /= np.linalg.norm(LIGHT)


def serpent(ctrl, rfun, pal, belly, spk, dorsal=1, spike_every=8, spikes=(0.06, 0.9), crystal=False):
    pts = catmull(ctrl)
    seg = np.diff(pts, axis=0)
    s = np.concatenate([[0], np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))]); L = s[-1]
    tan = np.gradient(pts, axis=0); tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    nor = np.stack([-tan[:, 1], tan[:, 0]], 1) * dorsal
    tree = cKDTree(pts)
    P = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], 1)
    dist, idx = tree.query(P)
    dist = dist.reshape(H, W); idx = idx.reshape(H, W)
    ss = s[idx]; u = ss / L
    r = rfun(u)
    off = ((P.reshape(H, W, 2) - pts[idx]) * nor[idx]).sum(2)
    m = dist <= r
    v = np.clip(off / np.maximum(r, 0.5), -1, 1)
    n2 = nor[idx] * v[..., None]
    nz = np.sqrt(np.clip(1 - v * v, 0, 1))
    I = np.clip(n2[..., 0] * LIGHT[0] + n2[..., 1] * LIGHT[1] + nz * LIGHT[2], 0, 1)
    tone = np.clip(np.floor(I * 4.3 + (THR - 0.5) * 0.35), 0, 4).astype(int)
    # Schuppen (Bögen, zum Schwanz offen)
    sx, sy = 6.0, 4.0
    j = np.floor(off / sy)
    fs = (ss / sx + 0.5 * (j % 2)) % 1
    fl = (off / sy) % 1
    q = (fs + 0.5 * (2 * fl - 1) ** 2) % 1
    rimp = q < 0.2
    ts = np.where(rimp, np.maximum(tone - 1, 0), tone)
    ts = np.where((~rimp) & (q > 0.62) & (q < 0.8) & (tone >= 2) & (np.abs(fl - 0.5) < 0.3), np.minimum(tone + 1, 4), ts)
    col = np.array(pal)[ts + 1]
    # Bauchplatten
    bel = v < -0.4
    bt = np.clip(np.floor(I * 3.4 + (THR - 0.5) * 0.3), 0, 3).astype(int)
    plate = (np.floor(ss) % 4 == 0)
    bt = np.where(plate, np.maximum(bt - 1, 0), bt)
    col = np.where(bel[..., None], np.array(belly)[bt], col)
    col = np.where((np.abs(v + 0.4) < 0.1)[..., None], np.array(pal[1]), col)
    out = np.zeros((H, W, 4), np.uint8)
    out[m, :3] = col[m]; out[m, 3] = 255
    body = outline(Image.fromarray(out), pal[0] + (255,))
    # Rückenkamm
    sp = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(sp)
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
        hgt = rr * 0.55 + 2.5
        b0 = c + n * (rr - 1.5) - t * 3.2; b1 = c + n * (rr - 1.5) + t * 1.6
        tip = c + n * (rr + hgt) + t * (hgt * 0.8 if not crystal else hgt * 0.3)
        d.polygon([tuple(b0), tuple(tip), tuple(b1)], fill=spk[1])
        d.line([tuple(c + n * rr + t * 0.3), tuple(tip)], fill=spk[2])
        d.point(tuple(np.floor(tip)), fill=spk[3])
    sp = outline(sp, spk[0])
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lay.alpha_composite(sp); lay.alpha_composite(body)
    return lay, dict(pts=pts, tan=tan, nor=nor, s=s, L=L, r=rfun)


def rbody(u):
    u = np.asarray(u, float)
    return np.where(u < 0.16, 6.0 + u / 0.16 * 5.0, np.maximum(11.0 - (u - 0.16) / 0.84 * 10.0, 1.2))


HEAD = """
.ooo....................................
oJJHoo..................................
.ohJJHoo................................
..ohhJJHoo..............................
...oohhJJHoo............................
.....oohhJJHo.oo........................
.......oohhHo.o45oo.....................
...ooo..oohho4455oo.....................
..ofFfoo.o3o44555444oo..................
...offFfo33334444444444oooo.............
....ooffo2333ooo33444444444ooo..........
...ooo.o223oEeeo33333344444445oo........
..ofFfoo2223oppoo3333333333444455oo.....
...offFo21222oo22223333333333333345o....
....ooo122122212222222333333333nn3333o..
..ooo.o1122122122222222222222222222223o.
.ofFfo111221212222211111111111111111122o
..offo1112121222111owwoooowooowoooowwoo.
...oo.o1111111111omwmmmmmmmmmmmmmmmwmo..
....ooo111211121ommmttttttmmmmmmmmoo....
...ofFfo11211211oammmmmTttttmmmmwo......
....offo1111111oabbbwmmmmwmmmmwoo.......
.....oo.o11111oabbbbbbbbbbbbboo.........
........o1111oabbbccccccccbboo..........
.........o11oaabbbbbbbbbbboo............
..........oooooooooooooooo..............
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


FH = head(FIRE_PAL, FIRE_BELLY, [(90, 50, 30), (170, 130, 90), (240, 220, 170)], [(255, 150, 0), (255, 250, 180)], [(230, 90, 20), (255, 200, 60)])
IH = head(ICE_PAL, ICE_BELLY, [(60, 90, 150), (170, 210, 240), (255, 255, 255)], [(0, 200, 255), (220, 255, 255)], [(120, 190, 240), (230, 250, 255)]).transpose(Image.FLIP_LEFT_RIGHT)
HX, HY = 38, 66                      # Feuerkopf (Blick nach rechts)
NECK = (HX + 11, HY + 21)            # Halsansatz
MOUTH_F = (HX + 37, HY + 19)
MOUTH_I = (W - 1 - MOUTH_F[0], MOUTH_F[1])

fire_ctrl = [NECK, (40, 100), (31, 118), (26, 142), (24, 172), (28, 204), (40, 232), (62, 256), (92, 271), (125, 280), (158, 288), (188, 292), (210, 286), (220, 272), (214, 260), (205, 262)]
ice_ctrl = [(W - 1 - x, y) for x, y in fire_ctrl]


def wing(shoulder, wrist, tips, back, pal, bone, seed=0):
    """Fledermausflügel: Membran zwischen Fingern mit gebogener Hinterkante."""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W, 4), np.uint8)
    wx, wy = wrist
    chain = tips + [back]
    mem = np.zeros((H, W), bool)
    for i in range(len(chain) - 1):
        p0 = np.array(chain[i], float); p1 = np.array(chain[i + 1], float)
        # Bogen zwischen p0 und p1, zur Handwurzel hin eingezogen
        mid = (p0 + p1) / 2; dirw = np.array(wrist, float) - mid
        ctrl = mid + dirw * 0.22
        arc = [tuple(p0 + (ctrl - p0) * 2 * t * (1 - t) / 0.5 * 0 + ((1 - t) ** 2) * 0 + 0) for t in []]
        ts = np.linspace(0, 1, 16)
        arc = [tuple((1 - t) ** 2 * p0 + 2 * (1 - t) * t * ctrl + t * t * p1) for t in ts]
        root = shoulder if i == len(chain) - 2 else wrist
        mem |= poly_mask([wrist] + arc + ([shoulder] if i == len(chain) - 2 else []))
    mem |= poly_mask([wrist, shoulder, chain[-1]])
    # Schattierung: zur Kante heller, Rippen-Bänder
    d = np.hypot(xx - wx, yy - wy)
    n = value_noise(W, H, 6, seed=seed, octaves=2)
    lam = np.clip(0.25 + d / 150 + (n - 0.5) * 0.35, 0, 1)
    col = tones(lam, pal[1:], 0.9)
    a[mem, :3] = col[mem]; a[mem, 3] = 255
    edge = mem & ~ndimage.binary_erosion(mem)
    lay = Image.fromarray(a)
    dr = ImageDraw.Draw(lay)
    # Adern
    r = random.Random(seed)
    for tp in tips:
        for k in range(2):
            t0 = r.uniform(0.3, 0.7)
            px = wx + (tp[0] - wx) * t0; py = wy + (tp[1] - wy) * t0
            ang = math.atan2(tp[1] - wy, tp[0] - wx) + r.choice([-1, 1]) * r.uniform(0.35, 0.6)
            ln = r.uniform(8, 16)
            q = (px + math.cos(ang) * ln, py + math.sin(ang) * ln)
            if 0 <= int(q[1]) < H and 0 <= int(q[0]) < W and mem[int(q[1]), int(q[0])]:
                dr.line([(px, py), q], fill=pal[1])
    la = np.array(lay); put(la, edge, pal[0]); lay = Image.fromarray(la)
    dr = ImageDraw.Draw(lay)
    # Knochen: Arm + Finger
    def bonel(p, q, w_):
        dr.line([p, q], fill=bone[0], width=w_ + 2)
        dr.line([p, q], fill=bone[1], width=w_)
    bonel(shoulder, wrist, 3)
    for tp in tips:
        bonel(wrist, tp, 1)
    dr.line([shoulder, wrist], fill=bone[2], width=1)
    for tp in tips:
        dr.point(tp, fill=bone[2])
    # Daumenkralle
    dr.polygon([(wx - 2, wy), (wx + 2, wy - 1), (wx + (3 if tips[0][0] < wx else -3), wy - 6)], fill=bone[2])
    dr.ellipse((wx - 2, wy - 2, wx + 2, wy + 2), fill=bone[1], outline=bone[0])
    return lay


FW_PAL = [(30, 4, 8), (70, 10, 14), (110, 20, 18), (160, 40, 22), (206, 76, 30), (236, 124, 44)]
IW_PAL = [(10, 16, 48), (24, 40, 96), (40, 70, 140), (70, 112, 186), (112, 160, 220), (170, 210, 246)]
fire_wing = wing((34, 126), (60, 16), [(10, 10), (6, 46), (10, 84)], (22, 126), FW_PAL, [(36, 6, 10), (200, 80, 30), (255, 200, 110)], seed=3)
ice_wing = wing((W - 1 - 34, 126), (W - 1 - 60, 16), [(W - 1 - 10, 10), (W - 1 - 6, 46), (W - 1 - 10, 84)], (W - 1 - 22, 126), IW_PAL, [(12, 18, 52), (120, 180, 240), (240, 252, 255)], seed=4)


# ================================================================ Eier
def egg(w, h, kind, seed=0):
    ey, ex = np.mgrid[0:h, 0:w]
    th = BAYER4[ey % 4, ex % 4]
    cx, cy = (w - 1) / 2, (h - 1) / 2 + 2
    rx, ry = w / 2 - 0.5, h / 2 - 1.5
    m = egg_mask(w, h, cx, cy, rx, ry, 0.2)
    ny = np.clip((ey - cy) / ry, -1, 1)
    rxx = rx * (1 - 0.2 * np.clip(-ny, 0, 1))
    nx = np.clip((ex - cx) / rxx, -1, 1)
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    lam = np.clip(nx * -0.5 + ny * -0.55 + nz * 0.75, 0, 1)
    lon = np.arcsin(np.clip(nx / np.sqrt(np.clip(1 - ny * ny, 0.05, 1)), -1, 1)) / (np.pi / 2)
    out = np.zeros((h, w, 4), np.uint8)
    if kind == 'fire':
        a = lon * 3.4; b = (ny + 1) * 4.6
        j = np.floor(b); fa = (a + 0.5 * (j % 2)) % 1; fb = b % 1
        yedge = 1 - 0.75 * np.abs(2 * fa - 1)
        inside = fb < yedge
        loc = np.clip(fb / np.maximum(yedge, 0.1), 0, 1)
        P = [(40, 4, 8), (100, 14, 12), (170, 40, 16), (230, 100, 24), (255, 180, 50), (255, 236, 140)]
        k = np.floor(loc * 3.6 + lam * 2.4 - 0.9 + (th - 0.5) * 0.6)
        k = np.clip(k, 1, 5).astype(int)
        rimm = (~inside) | (np.abs(fb - yedge) < 0.14) | (fb > yedge - 0.02) & (fb < yedge + 0.2)
        k = np.where(rimm, np.where(lam > 0.75, 2, 0), k)
        col = np.array(P)[k]
        oc = (30, 4, 6)
    else:
        a = lon * 3.2; b = (ny + 1) * 4.2
        u1 = a + b; u2 = a - b
        f1 = u1 % 1; f2 = u2 % 1
        line = (f1 < 0.16) | (f2 < 0.16)
        cc = (np.abs(f1 - 0.55) + np.abs(f2 - 0.55))
        P = [(38, 30, 80), (60, 70, 140), (90, 120, 190), (140, 180, 230), (196, 228, 250), (250, 255, 255)]
        k = np.floor((1 - cc) * 2.4 + lam * 3.0 - 0.6 + (th - 0.5) * 0.6)
        k = np.clip(k, 1, 5).astype(int)
        k = np.where(line, np.where(lam > 0.8, 2, 0), k)
        col = np.array(P)[k]
        oc = (20, 18, 56)
    out[m, :3] = col[m]; out[m, 3] = 255
    img = outline(Image.fromarray(out), oc + (255,))
    d = ImageDraw.Draw(img)
    # Glanzlicht
    gx, gy = int(w * 0.28), int(h * 0.22)
    d.line((gx, gy + 1, gx + 1, gy), fill=(255, 255, 240))
    d.point((gx, gy + 3), fill=(255, 255, 240))
    return img


def crack(img, pts, core, glowc, dark):
    d = ImageDraw.Draw(img)
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=glowc, width=2)
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=core, width=1)


# ================================================================ Fels + Nest
def crag():
    a = np.zeros((H, W, 4), np.uint8)
    top = 206
    shape = poly_mask([(70, top + 2), (86, top - 2), (164, top - 2), (180, top + 2), (176, 232), (168, 262), (160, 300), (90, 300), (82, 262), (74, 232)])
    fire = FIRE
    # Basaltsäulen links
    colw = 6
    ci = (xx - 70) // colw
    fx = (xx - 70) % colw
    r = random.Random(5)
    offs = {i: r.randint(-3, 3) for i in range(-2, 40)}
    nb = value_noise(W, H, 5, seed=55, octaves=2)
    lam = np.where(fx < 2, 0.8, np.where(fx < 5, 0.5, 0.15)) + (nb - 0.5) * 0.35 - (yy - top) / 260
    bc = tones(np.clip(lam, 0, 1), [(22, 10, 12), (40, 18, 18), (62, 28, 24), (90, 42, 30), (126, 60, 36)], 0.7)
    band = np.zeros((H, W), bool)
    for i in range(-2, 40):
        for yb in range(top + 10 + offs[i] * 2, 300, 11 + (i % 3)):
            band |= (ci == i) & (yy == yb)
    col = np.where(band[..., None], np.array((20, 8, 10)), bc)
    joint = (fx == colw - 1)
    col = np.where(joint[..., None], np.array((16, 6, 8)), col)
    # Lava in Fugen
    lavaj = joint & (np.array([[offs.get(int(c), 0) for c in row] for row in ci]) > 1) & (yy > top + 6)
    col = np.where(lavaj[..., None], np.array((255, 150, 40)), col)
    # Eisseite rechts: Fels mit Eispanzer
    ice_n = value_noise(W, H, 7, seed=66, octaves=3)
    il = np.clip(0.55 + (ice_n - 0.5) * 0.9 - (yy - top) / 200 + ((xx + yy // 2) % 9 == 0) * 0.25, 0, 1)
    icec = tones(il, [(40, 60, 120), (70, 110, 180), (120, 170, 228), (180, 220, 250), (236, 250, 255)], 0.8)
    col = np.where(fire[..., None], col, icec)
    put(a, shape, (0, 0, 0))
    a[shape, :3] = col[shape]
    img = Image.fromarray(a)
    d = ImageDraw.Draw(img)
    # Eiszapfen an der Oberkante (rechts)
    for x in range(128, 178, 3):
        if not FIRE[top, x]:
            ln = r.randint(3, 9)
            d.line((x, top, x, top + ln), fill=(220, 244, 255))
            d.point((x, top + ln + 1), fill=(150, 200, 240))
            d.line((x + 1, top, x + 1, top + ln - 2), fill=(120, 170, 226))
    img = outline(img, (14, 6, 12, 255))
    return img


def nest():
    """Nestschale aus Steinen: links Obsidian mit Glutadern, rechts bereifte Steine."""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    r = random.Random(9)
    stones = []
    for i in range(46):
        t = i / 45
        x = 78 + t * 94 + r.uniform(-2, 2)
        y = 204 + 7 * math.sin(t * math.pi) * 0.5 + r.uniform(-3, 3) - 3 * math.sin(t * math.pi)
        stones.append((x, y, r.uniform(3.0, 5.0), r.uniform(2.2, 3.4)))
    stones.sort(key=lambda s: s[1])
    for (x, y, rx, ry) in stones:
        w_, h_ = int(rx * 2 + 3), int(ry * 2 + 3)
        sy, sx = np.mgrid[0:h_, 0:w_]
        m = ((sx - w_ / 2 + 0.5) / rx) ** 2 + ((sy - h_ / 2 + 0.5) / ry) ** 2 <= 1
        nx_ = (sx - w_ / 2) / rx; ny_ = (sy - h_ / 2) / ry
        l = np.clip(0.55 - nx_ * 0.35 - ny_ * 0.45, 0, 1)
        fire = FIRE[min(H - 1, int(y)), min(W - 1, int(x))]
        cols = [(20, 10, 16), (42, 24, 34), (70, 44, 56), (110, 76, 84)] if fire else [(50, 70, 120), (90, 120, 170), (160, 196, 232), (236, 248, 255)]
        k = np.clip(np.floor(l * 4), 0, 3).astype(int)
        o = np.zeros((h_, w_, 4), np.uint8)
        o[m, :3] = np.array(cols)[k][m]; o[m, 3] = 255
        s_img = outline(Image.fromarray(o), (12, 6, 12, 255))
        if fire and r.random() < 0.5:
            dd = ImageDraw.Draw(s_img)
            dd.line((w_ // 2 - 1, h_ // 2, w_ // 2 + 1, h_ // 2 + 1), fill=(255, 140, 40))
        if not fire:
            dd = ImageDraw.Draw(s_img)
            dd.line((w_ // 2 - 2, 1, w_ // 2 + 1, 1), fill=(255, 255, 255))
        lay.alpha_composite(s_img, (int(x - w_ / 2), int(y - h_ / 2)))
    return lay

im.alpha_composite(fire_wing); im.alpha_composite(ice_wing)
ice_lay, ICE_G = serpent(ice_ctrl, rbody, ICE_PAL, ICE_BELLY, ICE_SPK, dorsal=-1, crystal=True)
fire_lay, FIRE_G = serpent(fire_ctrl, rbody, FIRE_PAL, FIRE_BELLY, FIRE_SPK, dorsal=1)
im.alpha_composite(ice_lay)
im.alpha_composite(fire_lay)
im.alpha_composite(FH, (HX, HY))
im.alpha_composite(IH, (W - HX - IH.width, HY))
cr = crag()
im.alpha_composite(cr)
EW, EH = 30, 40
ie = egg(EW, EH, 'ice'); fe = egg(EW, EH, 'fire')
crack(fe, [(4, 16), (9, 13), (12, 17), (17, 12), (21, 15), (26, 11)], (255, 250, 210), (255, 160, 40), None)
crack(fe, [(12, 17), (13, 22), (11, 26)], (255, 250, 210), (255, 160, 40), None)
gl, pp = glow(fe, (255, 150, 40, 255), radius=4, strength=0.5)
im.alpha_composite(gl, (140 - EW // 2 - pp, 170 - pp))
gl, pp = glow(ie, (170, 230, 255, 255), radius=4, strength=0.4)
im.alpha_composite(gl, (110 - EW // 2 - pp, 170 - pp))
im.alpha_composite(ie, (110 - EW // 2, 170))
im.alpha_composite(fe, (140 - EW // 2, 170))
im.alpha_composite(nest())
if STAGE <= 2:
    up(im, 3).save(os.path.join(TMP, 's07_stage.png')); im.save(os.path.join(TMP, 's07_base.png')); raise SystemExit
