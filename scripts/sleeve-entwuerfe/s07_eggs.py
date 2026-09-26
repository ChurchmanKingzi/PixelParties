# -*- coding: utf-8 -*-
"""07 Feuer & Eis: Feuer- gegen Eis-Kartenmotive auf einer Yin-Yang-geteilten Landschaft.
Links Vulkan/Lavasee/Basaltsäulen mit Phönix Duigno, Luna Pele, Burning Skeleton und Red Dragoneer,
rechts Gletscher/Polarlicht/Eiskristalle mit Slippery Whoolmoth, Polar, Pengu, Snowman und Gon, the Frostbringer.
In der Mitte die beiden Dracheneier im Nest. Alle Figuren sind im Stil ihrer Kartensprites nachgepixelt."""
from lib import *
from scipy.spatial import cKDTree

yy, xx = np.mgrid[0:H, 0:W]
THR = BAYER4[yy % 4, xx % 4]

# ---------------------------------------------------------------- Paletten
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




def voronoi(pts):
    d, i = cKDTree(pts).query(np.stack([xx.ravel(), yy.ravel()], 1), k=2)
    return d[:, 0].reshape(H, W), d[:, 1].reshape(H, W), i[:, 0].reshape(H, W)


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))




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


def clash(cx, cy, s=1.0):
    """Aufprall Feuer auf Eis: Lichtblitz, Dampfwolke, Funken/Eissplitter."""
    dist = np.hypot(xx - cx, (yy - cy) * 1.1) / s
    ang = np.arctan2(yy - cy, xx - cx)
    ray = (np.cos(ang * 8) * 0.5 + 0.5) ** 3
    t = np.clip(1 - dist / (14 + 12 * ray), 0, 1)
    burst = dith(t * 1.4)
    st = np.clip(1 - np.hypot(xx - cx, (yy - cy + 6 * s) * 1.6) / (26 * s), 0, 1) * (0.5 + value_noise(W, H, 5, seed=3) * 0.8)
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
        r0, r1 = r.uniform(14, 20) * s, r.uniform(22, 34) * s
        p0 = (cx + math.cos(an) * r0, cy + math.sin(an) * r0 * 0.8)
        p1 = (cx + math.cos(an) * r1, cy + math.sin(an) * r1 * 0.8)
        left = p1[0] < cx
        c0, c1 = ((255, 120, 30), (255, 220, 120)) if left else ((90, 170, 240), (230, 250, 255))
        d.line([p0, p1], fill=c0)
        d.point(p1, fill=c1)
    sparkle(d, cx, cy, max(2, int(6 * s)), (255, 255, 220))
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



# ================================================================ Figuren (nachgezeichnet im Stil der Kartensprites)
# Jede Figur ist eine handgepixelte Karte (ASCII + Palette) nach dem nativen Kartenbild als Vorlage,
# bzw. (Duigno, Whoolmoth) aus sauberen Flächen und Linien aufgebaut. Skalierung nur ganzzahlig (2x NN).
S = {}

S['snowman'] = ("""
.....kkkkk.....
....kcccCCk....
....kcccCCk....
....kccccCk....
....kccccCk....
....kccccCk....
...kkkkkkkkk...
..kccccccCCCk..
...kkkkkkkkk...
...owwwwwwwo...
...owkwwwkWo...
...owwwnnwWo...
...owkwkwkwo...
...RRRRRRRRR...
..rrrrrrrrrrr..
..orrrwwwwwWo..
..owrrwwwwwWo..
.owwrrwwwwwwWo.
.owwrrwwwwwwWo.
.owwwrwwwwwsWo.
.owwwwwwwwwsWo.
..owwwwwwwsso..
...ooooooooo...
..owwwwwwwwWo..
.owwwwwwwwwsWo.
owwwwwwwwwwssWo
owwwwwwwwwwwsWo
owwwwwwwwwwwsWo
owwwwwwwwwwssWo
.owwwwwwwwwssWo
.owwwwwwwwssWo.
..osswwwwsssoo.
...ooooooooo...
""", {'k': (30, 28, 32), 'c': (58, 58, 60), 'C': (96, 96, 102), 'o': (86, 86, 96), 'w': (226, 226, 238),
      'W': (252, 254, 253), 's': (178, 178, 200), 'n': (224, 112, 24), 'r': (120, 8, 6), 'R': (168, 30, 24)})

S['skel'] = ("""
.........y..........
........yoy.........
........oyo.........
.......kkkkkk.......
......kddddddk......
.....kddmddmddk.....
.....kdRrddrRdk.....
.....kddddddddk.....
.....kdmkmmkmdk.....
...kkkkddddddkkkk...
..kddddmddddmddddk..
.kddmdddmmmmdddmddk.
.kdmkdddmddmdddkmdk.
.kdmkkddmmmmddkkmdk.
.kdmk.kddmmddk.kmdk.
.kddk.kdmddmdk.kddk.
.odok.kddmmddk.kodo.
.oook.kddddddk.kooo.
..ok..kllllllk..ko..
......kllLllLlk.....
......kllk.kllk.....
......kLlk.kLlk.....
......klLk.klLk.....
.....kkkkk.kkkkk....
""", {'k': (14, 10, 10), 'd': (32, 22, 18), 'm': (62, 42, 24), 'r': (240, 12, 8), 'R': (255, 140, 70),
      'o': (253, 110, 10), 'y': (253, 206, 40), 'l': (56, 44, 26), 'L': (86, 70, 40)})

S['pele'] = ("""
..........r...........
....r....rr...r.r.....
....r.r.ror..rorr.....
.r..rrrrorr.rorrr..r..
.r.rorrroooroorror.r..
.rroyoorroyoroyooyorr.
.royyooroyyoroyooyyor.
.royyoooyyoyoyyooyyor.
.royYyyyYyoyyYYyyYyor.
.rooyYyyYyyYyyYyYyoor.
..royyYyYYyYyyYYyyor..
...royyYyYYyyYYyyor...
....rooyYYYyYyyoor....
...rokkkkkkkkkkkkor...
..rroksssssssssskorr..
..rookseesssseeskoor..
..roykppssssssppkyor..
.royykssspppsssskyyor.
royyYYksssssssskYyyor.
rroykksssssssssskkyr..
r.oksskssssssssksskor.
..okssk.ssssssss.kssko
..okSk..kssssssk..kSko
..okkk..kssssssk..kkko
.roy..kGgGgGgGgGk.yor.
roy...kGgGgGgGgGk..yor
ry....kGgGgGgGgGk...yr
.r....kGgGgGgGgGk...r.
.......ksk..ksk.......
.......ksk..ksk.......
......kkkk..kkkk......
""", {'k': (46, 30, 8), 'r': (205, 45, 40), 'o': (245, 121, 37), 'y': (245, 222, 12), 'Y': (250, 248, 190),
      's': (150, 106, 74), 'S': (184, 140, 100), 'p': (236, 128, 118), 'e': (20, 10, 4), 'g': (98, 150, 48), 'G': (150, 206, 96)})

S['gon'] = ("""
....kkkkk.......
..kkhhhhhkk.....
.khhWWhhhhhk....
khWWhhhhHhhhk...
kkhhhhhhhHhhhk..
.khhhhhhhhHhhk..
.kHhhkhhhhhHhhk.
.khkSSkhhhhhHhk.
..kSEsshhhhhHk..
..kSEssshhhHhk..
..ksssssHhhHk...
...kksskhhHk....
..kBbbbbbbbk....
.kBbbbbbbbbbk...
kSSkbbbbbbBbk...
kSskbbbbbbBbk...
.kk.kbbbbbBBk...
....kwwwwwwgk...
....kwwwwwwgk...
...kwwwwwwwggk..
...kwwwwwwwggk..
...kwwwwwwgggk..
....kkBBkBBkkk..
....kBBk.kBBk...
....kkkk.kkkk...
""", {'k': (52, 48, 72), 'h': (222, 224, 232), 'H': (168, 170, 186), 'W': (252, 254, 255), 's': (229, 189, 139),
      'S': (251, 216, 175), 'E': (70, 190, 230), 'b': (67, 124, 216), 'B': (40, 78, 160), 'w': (222, 224, 238), 'g': (150, 152, 172)})

S['polar'] = ("""
.......kk.k........................
......kwwkwk.......................
.....kwwwwwwk......................
....kwwwwwwwwkkkkkkkkkkkkkkkkkkk...
...kwwwkwwwwwwwwwwwwwwwwwwwwwwwwkk.
..kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk
kkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk
kkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk
.kkkkssswwwwwwwwwwwwwwwwwwwwwwwwwsk
..kssskkswwwwwwwwwwwwwwwwwwwwwwwssk
...kkk.ksswwwwwwwwwwwwwwwwwwwwwsssk
.......kssswwwwwwwwwwwwwwwwwwwwsssk
........ksssswwwwwwwwwwwwwwwwssssk.
.........kssssssssssssssssssssssk..
..........kkkssskkkkkkkksssskkk....
............kssk.......kssk........
...........kkkkkk.....kkkkkk.......
...........kgWgWk.....kgWgWk.......
............kkkk.......kkkk........
""", {'k': (39, 38, 37), 'w': (247, 243, 236), 's': (176, 174, 187), 'g': (90, 90, 96), 'W': (230, 230, 236)})

S['pengu'] = ("""
..........kkkkkk..............
.........kbbcbcbkkkkkkkkk.....
........kbWbbbbbybbbbbbbbkkk..
...kkkkkbbbbbbbbybbbbbbbbbbbkk
.knnnnnkbbbbbbbyybbbbbbbbbbbbk
...kkkkkkbbbbbyywwwwwwwwwwwbbk
........kkbbbywwwwwwwwwwwwwwwk
.........kkkkwwwwwwwwwwwwwwwk.
............kkkkkkkkkkkkkkkk..
""", {'k': (25, 25, 24), 'b': (45, 44, 49), 'c': (80, 80, 88), 'W': (240, 240, 240), 'y': (235, 187, 20),
      'n': (114, 81, 66), 'w': (220, 218, 229)})

S['rd'] = ("""
..kkkkkkk..................kkkkkkk
...kkkrrrkkk............kkkrrrkkk.
....kookkkrRkk........kkRrkkkook..
.....koor.kkRRkk....kkRRkkkrook...
......krkoorrRsRkkkkRsRrrookrk....
.......kkorkkRkkkrRkkkRkkrokk.....
........krkokk.kkrRkk.kkokrk......
.........kookRkkrrRRkkRkook.......
.........kookRkkrrrRkkRkook.......
.........kokkRRkkkkkkRRkkok.......
.........krrkkRrrRRrrRkkrrk.......
..........kokRkprRRrpkRkok........
..........kkrkkBpRRpBkkrkk........
.........kRrkrkBsRRsBkrkrRk.......
......WskRkkkrkrrRRrrkrkkkRksW....
.......skskkkrkRRRRkrkkksks.......
..........WrrkkkpRRpkkkrrW........
..........krRrkkkrRkkkrRrk........
.......k..krRrrkrkkrkrrRrk........
.......kk.krrrrkrrrrkrrrrk........
.......krkkkrrkkroorkkrrkk........
.......krk.kkkrkooookrkkk.........
.......krrkkrrrkooookrrrk.........
.......krrrkrkrkooookrkrk.........
........krokskskoookksksk.........
.........kkWkWkrokk..kWkW.........
...........kkkkkk.................
""", {'k': (51, 25, 5), 'p': (1, 1, 3), 'r': (145, 46, 42), 'R': (197, 82, 83), 'o': (230, 132, 16), 's': (189, 195, 214),
      'W': (245, 250, 248), 'B': (70, 130, 230)})

S['fireball'] = ("""
.......rrooo....
....rrroooyyoo..
.rrrooooyyyYyyo.
rroooyyyYYYYYyyo
.rrrooooyyyYyyo.
....rrroooyyoo..
.......rrooo....
""", {'r': (190, 40, 20), 'o': (245, 124, 30), 'y': (252, 204, 40), 'Y': (255, 250, 190)})

S['snowball'] = ("""
.kkk.
kWwwk
kwwwk
kswsk
.kkk.
""", {'k': (70, 80, 120), 'w': (232, 236, 248), 'W': (255, 255, 255), 's': (180, 190, 220)})


def sprite(key):
    txt, pal = S[key]
    rows = txt.strip('\n').split('\n')
    w = max(len(r) for r in rows); h = len(rows)
    out = np.zeros((h, w, 4), np.uint8)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c in pal:
                out[y, x, :3] = pal[c]; out[y, x, 3] = 255
    return Image.fromarray(out)


def grid_img(g, pal):
    out = np.zeros(g.shape + (4,), np.uint8)
    for c, col in pal.items():
        m = g == c; out[m, :3] = col; out[m, 3] = 255
    return Image.fromarray(out)


DW, DH = 76, 46
C = {'k': (86, 26, 44), 'K': (60, 14, 30), 'p': (222, 92, 84), 'P': (238, 122, 100), 'o': (242, 140, 56), 'y': (250, 196, 70),
     'Y': (255, 234, 150), 'r': (206, 50, 40), 'W': (255, 252, 220), 'e': (30, 6, 12)}


def dpm(pts):
    m = Image.new('L', (DW, DH), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.array(m) > 0


def duigno():
    g = np.full((DH, DW), '.', dtype='<U1')
    yy, xx = np.mgrid[0:DH, 0:DW]
    # Flügel links: steile Spitze, Sägezahn-Schwungfedern unten
    top = [(36, 25), (31, 19), (25, 13), (17, 8), (13, 9), (8, 15), (3, 22), (0, 28)]
    bot = []
    x = 0
    tips = [(0, 33), (4, 38), (8, 40), (12, 41), (16, 41), (20, 41), (24, 40), (28, 39), (32, 38)]
    for i, (tx, ty) in enumerate(tips):
        bot.append((tx, ty))
        if i < len(tips) - 1:
            nx_ = tips[i + 1][0]
            bot.append(((tx + nx_) / 2 + 0.5, ty - 3))
    poly = top + bot[::-1][::-1]
    poly = top + [(0, 31)] + bot + [(35, 35), (37, 30)]
    wingL = dpm(poly)
    wing = wingL | wingL[:, ::-1]
    # Farbverlauf: Abstand zur Oberkante
    dtop = np.zeros((DH, DW))
    for x in range(DW):
        col = np.where(wing[:, x])[0]
        if len(col): dtop[col, x] = col - col[0]
    g[wing] = 'p'
    g[wing & (dtop <= 5)] = 'P'
    g[wing & (dtop <= 2)] = 'o'
    g[wing & (dtop <= 0)] = 'y'
    g[wing & (yy >= 31)] = 'o'
    g[wing & (yy >= 35)] = 'y'
    g[wing & (yy >= 38)] = 'Y'
    # Deckfederbogen
    for x in range(DW):
        xl = x if x < DW / 2 else DW - 1 - x
        if 2 <= xl <= 34:
            y = int(round(30 - 12 * math.sin(math.pi * (xl + 4) / 44)))
            if wing[y, x]: g[y, x] = 'k'
    # Schwungfedern: Linien fächerförmig von oben zur Lücke zwischen zwei Spitzen
    for i in range(len(tips) - 1):
        gx = (tips[i][0] + tips[i + 1][0]) / 2 + 0.5
        gy = min(tips[i][1], tips[i + 1][1]) - 3
        ox, oy = 18, 14
        for t in np.linspace(0.45, 1.0, 30):
            px, py = ox + (gx - ox) * t, oy + (gy - oy) * t
            for X, Y in ((int(round(px)), int(round(py))), (DW - 1 - int(round(px)), int(round(py)))):
                if 0 <= Y < DH and wing[Y, X]: g[Y, X] = 'k'
    # Körper mit Brustfedern
    body = dpm([(33, 24), (43, 24), (45, 30), (43, 37), (38, 40), (33, 37), (31, 30)])
    g[body] = 'y'; g[body & (xx >= 40)] = 'o'; g[body & (yy >= 36)] = 'o'
    for (cx, cy) in [(36, 28), (40, 28), (38, 31), (36, 34), (40, 34)]:
        g[cy, cx - 1] = 'o'; g[cy + 1, cx] = 'o'; g[cy, cx + 1] = 'o'
    # Schwanzflammen
    for (x0, x1, yb, xt) in [(32, 36, 45, 33), (36, 40, 46, 38), (40, 44, 45, 43), (30, 33, 42, 29), (43, 46, 43, 47)]:
        fl = dpm([(x0, 37), (x1, 37), (xt, yb)])
        new = fl & (g == '.')
        g[new] = 'r'
        g[new & (yy < yb - 4)] = 'o'
        g[new & (yy < yb - 7)] = 'y'
    # Hals + Kopf (Blick nach links)
    neck = dpm([(34, 25), (40, 25), (39, 17), (36, 11), (31, 11), (34, 18)])
    g[neck] = 'y'; g[neck & (xx >= 37)] = 'o'
    head = dpm([(27, 9), (30, 6), (35, 6), (37, 9), (36, 13), (31, 14), (28, 13)])
    g[head] = 'Y'; g[head & (yy >= 12)] = 'y'
    beak = dpm([(28, 9.5), (20, 12), (28, 13)])
    g[beak] = 'o'; g[beak & (yy >= 12)] = 'r'
    g[10, 30] = 'e'; g[10, 31] = 'e'; g[9, 30] = 'W'
    # Flammenkrone nach hinten oben
    for pts, c in [([(31, 7), (31, 0), (34, 6)], 'o'), ([(34, 7), (38, 0), (37, 8)], 'y'), ([(36, 8), (43, 3), (38, 11)], 'o'),
                   ([(37, 11), (45, 9), (38, 13)], 'r'), ([(32, 6), (33, 2), (34, 6)], 'Y')]:
        g[dpm(pts) & (g == '.')] = c
    fill = g != '.'
    ol = ndimage.binary_dilation(fill) & ~fill
    g[ol] = 'k'
    return g


MW, MH = 72, 48
MC = {'k': (40, 18, 20), 'd': (84, 44, 38), 'm': (118, 66, 52), 'l': (150, 96, 76), 'L': (182, 130, 104),
      't': (240, 232, 208), 'T': (196, 184, 160), 'e': (14, 8, 10), 'W': (255, 255, 255)}


def mpm(pts, w=MW, h=MH):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.array(m) > 0


def ell(cx, cy, rx, ry):
    yy, xx = np.mgrid[0:MH, 0:MW]
    return ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1


def tube(pts, r0, r1):
    yy, xx = np.mgrid[0:MH, 0:MW]
    m = np.zeros((MH, MW), bool)
    P = []
    for i in range(len(pts) - 1):
        for t in np.linspace(0, 1, 16, endpoint=False):
            P.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
    P.append(pts[-1])
    for i, (x, y) in enumerate(P):
        r = r0 + (r1 - r0) * i / (len(P) - 1)
        m |= (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r
    return m


def whoolmoth():
    g = np.full((MH, MW), '.', dtype='<U1')
    yy, xx = np.mgrid[0:MH, 0:MW]
    body = mpm([(26, 8), (32, 6), (38, 3), (46, 2), (54, 4), (63, 8), (72, 12), (72, 36), (62, 38), (44, 38), (32, 36), (26, 28)])
    head = ell(21, 16, 11, 11) | ell(22, 9, 8, 7)
    legs = mpm([(31, 30), (41, 30), (41, 43), (42, 46), (30, 46), (31, 43)]) | mpm([(56, 32), (66, 32), (66, 43), (67, 46), (55, 46), (56, 43)])
    trunk = tube([(15, 20), (12, 28), (11, 36), (10, 42), (7, 45), (4, 44)], 4.2, 1.6)
    a = body | head | legs | trunk
    # Grundfell: oben hell, unten dunkel
    g[a] = 'm'
    wv = 1.5 * np.sin(xx / 2.3)
    g[a & (yy < 13 + wv)] = 'l'
    g[a & (yy < 7 + wv)] = 'L'
    g[a & (yy > 28 + wv)] = 'd'
    g[legs] = 'd'
    # Kopf-Kuppel hell
    g[head & (yy < 15) & (xx < 29)] = 'l'
    g[head & (yy < 8) & (xx < 30)] = 'L'
    g[head & (xx < 14) & (yy > 12)] = 'm'
    g[trunk] = 'm'; g[trunk & (xx < 11)] = 'd'
    # Rüssel-Ringe
    for y in range(24, 44, 3):
        row = np.where(trunk[y])[0]
        if len(row) > 2: g[y, row[1]:row[-1]] = 'd'
    # Fellsträhnen (senkrecht, versetzt)
    r = random.Random(4)
    for x in range(28, MW, 3):
        y0 = r.randint(14, 22)
        for y in range(y0, min(MH, y0 + r.randint(6, 14))):
            if a[y, x] and not trunk[y, x]: g[y, x] = 'd'
    for x in range(30, MW, 4):
        y0 = r.randint(5, 10)
        for y in range(y0, y0 + r.randint(3, 6)):
            if a[y, x]: g[y, x] = 'm'
    # Fransen unten an Bauch/Beinen
    for x in range(26, MW):
        col = np.where(a[:, x])[0]
        if len(col):
            yb = col[-1]
            if (x % 3) == 0 and yb + 1 < MH and not legs[yb, x]:
                g[yb + 1, x] = 'd'
    # Zehennägel
    for x0 in (31, 34, 37, 56, 59, 62):
        g[45, x0:x0 + 2] = 't'
    # Ohr
    ear = ell(31, 16, 3.5, 6)
    g[ear] = 'd'; g[ear & (xx < 30)] = 'm'
    # Auge
    g[12, 17] = 'e'; g[12, 18] = 'e'; g[13, 18] = 'e'; g[12, 16] = 'W'
    g[10, 15:20] = 'd'; g[11, 19] = 'd'
    # Stoßzähne (weit ausladend, nach vorne-oben gebogen)
    t1 = tube([(17, 26), (12, 33), (6, 36), (2, 33), (1, 27)], 2.0, 1.1)
    t2 = tube([(23, 27), (21, 34), (17, 37), (13, 36)], 1.6, 1.0)
    g[t2 & ~trunk] = 'T'
    g[t1] = 't'
    g[t1 & (np.roll(t1, -1, axis=0) == False)] = 'T'
    fill = g != '.'
    g[ndimage.binary_dilation(fill) & ~fill] = 'k'
    # Kontur zwischen Rüssel und Kopf
    return g



EGG_TILES = {
    'fire': ["22333322",
             "k233332k",
             ".k2454k.",
             "..k44k..",
             "...kk..."],
    'ice': [".3443.",
            "334443",
            "k3333k",
            ".kkkk."],
}


def egg_clean(kind, w=28, h=36):
    """Drachenei im Muster der Karte: Schuppen-Kacheln (Dachziegel), je Schuppe eine Lichtstufe, 1px-Konturen."""
    P = {'fire': [(55, 7, 3), (120, 18, 12), (196, 50, 20), (240, 124, 24), (250, 204, 40), (252, 244, 150)],
         'ice': [(40, 36, 92), (48, 86, 160), (82, 136, 206), (128, 184, 234), (188, 226, 250), (250, 254, 255)]}[kind]
    tile = EGG_TILES[kind]
    th_, tw = len(tile), len(tile[0])
    step = 3 if kind == 'fire' else 3
    k = np.full((h, w), 1, int)
    cx, cy = (w - 1) / 2, (h - 1) / 2 + 1.5
    rows_ = list(range(-1, h // step + 2))
    for j in reversed(rows_):
        off = (tw // 2) if j % 2 else 0
        for i in range(-1, w // tw + 2):
            x0, y0 = i * tw - off, j * step
            lam = ((x0 + tw / 2 - cx) / w * -1.0 + (y0 + th_ / 2 - cy) / h * -1.2)
            sh = 1 if lam > 0.3 else (0 if lam > -0.25 else (-1 if lam > -0.6 else -2))
            for ty in range(th_):
                for tx in range(tw):
                    c = tile[ty][tx]
                    X, Y = x0 + tx, y0 + ty
                    if c == '.' or not (0 <= X < w and 0 <= Y < h):
                        continue
                    k[Y, X] = 0 if c == 'k' else int(np.clip(int(c) + sh, 1, 5))
    m = egg_mask(w, h, cx, cy, w / 2 - 0.5, h / 2 - 1, 0.2)
    out = np.zeros((h, w, 4), np.uint8)
    out[m, :3] = np.array(P)[k][m]; out[m, 3] = 255
    img = outline(Image.fromarray(out), P[0] + (255,))
    d = ImageDraw.Draw(img)
    gx, gy = int(w * 0.27), int(h * 0.17)
    d.point([(gx, gy + 1), (gx + 1, gy), (gx, gy + 3)], fill=(255, 255, 240))
    return img


def place(img, spr, x, y, glow_col=None, r=2, st=0.8, rim=None):
    """Figur setzen; rim = saubere 1px-Randlinie statt Schein."""
    if rim:
        spr = outline(spr, rim + (255,))
        x -= 1; y -= 1
    elif glow_col:
        g_, p_ = glow(spr, glow_col, radius=r, strength=st)
        img.alpha_composite(g_, (int(x) - p_, int(y) - p_))
    img.alpha_composite(spr, (int(x), int(y)))


# ================================================================ Aufbau
im = background()

# Held Feuer: Phönix Duigno (oben links, Blick zur Eisseite)
ph = up(grid_img(duigno(), C), 2).transpose(Image.FLIP_LEFT_RIGHT)
place(im, ph, 2, 6)


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

# Held Eis: Slippery Whoolmoth (rechts, läuft aus dem Bild wie auf der Karte)
# Eisscholle (Area-Sprite slippery-ice, 1x) als Boden für das Whoolmoth
shelf = np.array(area('slippery-ice/tile').crop((0, 34, 128, 83)))
sx_ = np.arange(shelf.shape[1]); top = (3 + 2 * np.sin(sx_ / 5.0) + np.sin(sx_ / 2.1)).astype(int)
for x_ in range(shelf.shape[1]):
    shelf[:top[x_], x_, 3] = 0
    shelf[top[x_], x_] = (255, 255, 255, 255); shelf[top[x_] + 1, x_] = (226, 234, 252, 255)
shelf = outline(Image.fromarray(shelf), (40, 50, 120, 255))
im.alpha_composite(shelf, (W - shelf.width + 4, 178))
wm = up(grid_img(whoolmoth(), MC), 2)
place(im, wm, W - wm.width + 8, 88)

# Eier im Nest (über Kreuz wie die Punkte im Yin-Yang)
FEGG = egg_clean('fire'); IEGG = egg_clean('ice')
IEX, FEX, EY = 125 - IEGG.width - 3, 128, 219 - FEGG.height
im.alpha_composite(nest(front=False))
place(im, FEGG, FEX, EY, (255, 140, 40, 255), r=3, st=0.35)
place(im, IEGG, IEX, EY, (150, 220, 255, 255), r=3, st=0.25)
im.alpha_composite(nest(front=True))
rd = sprite('rd')
place(im, rd, IEX - rd.width + 6, 224 - rd.height, rim=(255, 170, 60))
pg = sprite('pengu')
place(im, pg, FEX + FEGG.width - 2, 223 - pg.height)
pb = sprite('polar')
place(im, pb, 206, 236 - pb.height)

im = particles(im)

# Feuer-Truppe links unten, Eis-Truppe rechts unten (2x)
pele = up(sprite('pele'), 2)
place(im, pele, 6, 306 - pele.height)
sk = up(sprite('skel'), 2)
place(im, sk, 58, 306 - sk.height, rim=(255, 150, 40))
gon = up(sprite('gon'), 2)
place(im, gon, 150, 306 - gon.height)
sm = up(sprite('snowman'), 2)
place(im, sm, W - 8 - sm.width, 306 - sm.height)
# Geschosse treffen sich über der Grenze
fb = up(sprite('fireball'), 2)
place(im, fb, 90, 252)
sb = sprite('snowball')
for (x_, y_) in [(138, 256), (146, 250), (144, 262)]:
    im.alpha_composite(sb, (x_, y_))
im.alpha_composite(clash(128, 259, 0.55))


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
