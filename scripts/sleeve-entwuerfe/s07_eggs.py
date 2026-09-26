# -*- coding: utf-8 -*-
"""07 Feuer & Eis: Feuer- gegen Eis-Kartenmotive auf einer Yin-Yang-geteilten Landschaft.
Links Vulkan/Lavasee/Basaltsäulen mit Phönix Duigno, Luna Pele und Burning Skeleton,
rechts Gletscher/Polarlicht/Eiskristalle mit Iceage, Slippery Snowman, Icy Slime und Gon im Eisblock.
In der Mitte die beiden Dracheneier im Nest."""
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



# ================================================================ Kartenfiguren
def sat(a):
    mx = a[..., :3].max(2); mn = a[..., :3].min(2)
    return (mx - mn) / np.maximum(mx, 1)


def cutm(name, box, fn, close=0, fill=True, n=1):
    """Figur aus nativem Kartenbild per Farbmaske ausschneiden."""
    c = native(name).crop(box)
    a = np.array(c).astype(int)
    m = fn(a)
    if close:
        m = ndimage.binary_closing(m, iterations=close)
    if fill:
        m = ndimage.binary_fill_holes(m)
    o = np.array(c); o[..., 3] = np.where(m, 255, 0)
    im_ = keep_largest(Image.fromarray(o), n)
    return im_.crop(im_.getbbox())


def Lum(a): return a[..., :3].mean(2)


def egg_cut(name, cx, cy, rx, ry):
    a = np.array(native(name)); h, w = a.shape[:2]
    a[..., 3] = np.where(egg_mask(w, h, cx, cy, rx, ry, 0.22), 255, 0)
    e = Image.fromarray(a)
    return e.crop(e.getbbox())


def hero(spr, k, pal, rim, line_col, fade=0, fade_right=0):
    """Kartenmotiv im Stil des Lunatic-Hawk (06): Helligkeit der Vorlage, k-fach, pro Pixel gedithert."""
    a = np.array(spr).astype(float)
    m = a[..., 3] > 0
    Lm = a[..., :3].mean(2)
    lo, hi = np.percentile(Lm[m], 5), np.percentile(Lm[m], 95)
    t = np.clip((Lm - lo) / (hi - lo), 0, 1); t[~m] = 0
    h, w = m.shape
    T = np.array(Image.fromarray((t * 255).astype(np.uint8)).resize((w * k, h * k), Image.BILINEAR)) / 255
    M = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((w * k, h * k), Image.BILINEAR)) > 110
    line = m & (Lm < ndimage.uniform_filter(Lm, 3) - 10)
    LN = np.kron(line, np.ones((k, k))).astype(bool) & M
    hh, ww = M.shape
    y_, x_ = np.mgrid[0:hh, 0:ww]
    th = BAYER4[y_ % 4, x_ % 4]
    idx = np.clip(np.floor(T * len(pal) + (th - 0.5)), 0, len(pal) - 1).astype(int)
    out = np.zeros((hh, ww, 4), np.uint8)
    out[M, :3] = np.array(pal)[idx][M]; out[M, 3] = 255
    out[LN & (th < 0.75)] = line_col + (255,)
    out[M & ~ndimage.binary_erosion(M)] = rim + (255,)
    # hart abgeschnittene Kanten der Vorlage weich ausdithern
    ft = np.ones((hh, ww))
    if fade:
        # Federspitzen statt gerader Schnittkante
        yb = hh - 1 - fade * 0.6 * np.abs(np.sin(np.pi * x_ / 11.0))
        ft = np.minimum(ft, np.clip((yb - y_) / fade, 0, 1))
    if fade_right:
        ft = np.minimum(ft, np.clip((ww - 1 - x_) / fade_right, 0, 1))
    out[~(ft > th)] = 0
    return Image.fromarray(out)


def figure(spr, k, oc):
    return outline(up(spr, k), oc + (255,))


def place(img, spr, x, y, glow_col=None, r=2, st=0.8):
    if glow_col:
        g_, p_ = glow(spr, glow_col, radius=r, strength=st)
        img.alpha_composite(g_, (int(x) - p_, int(y) - p_))
    img.alpha_composite(spr, (int(x), int(y)))


R_ = lambda a: a[..., 0]; G_ = lambda a: a[..., 1]; B_ = lambda a: a[..., 2]
PHOENIX = cutm('Duigno the Flaming Phoenix', (0, 0, 76, 39), lambda a: R_(a) > G_(a) + 18, close=1)
ICEAGE = cutm('Iceage', (18, 4, 76, 51), lambda a: (Lum(a) < 196) & (B_(a) > R_(a) + 25) & (Lum(a) > 120), close=1)
SKELETON = cutm('Burning Skeleton', (24, 8, 52, 42), lambda a: (Lum(a) < 70) | ((G_(a) < 60) & (R_(a) < 130)))
PELE = cutm('Luna Pele the Flame Dancer', (26, 8, 52, 46),
            lambda a: ~((np.abs(R_(a) - 208) < 28) & (np.abs(G_(a) - 178) < 30) & (np.abs(B_(a) - 108) < 34)))
FIREBALL = cutm('Chaorc Friendly Fireballer', (18, 14, 50, 34),
                lambda a: (R_(a) > 200) & (G_(a) > 60) | ((R_(a) > 150) & (G_(a) < 80) & (B_(a) < 80)) & (Lum(a) > 80))
SNOWMAN = cutm('Slippery Snowman', (34, 10, 52, 48),
               lambda a: (Lum(a) < 80) | ((R_(a) > 150) & (G_(a) < 80)) | ((Lum(a) > 205) & (np.abs(R_(a) - B_(a)) < 22)))
ISLIME = cutm('Icy Slime', (26, 16, 48, 38), lambda a: (G_(a) >= B_(a) - 14) & (G_(a) > R_(a) + 25) | (Lum(a) < 90))
ICEBLOCK = cutm('Snow Cannon', (48, 10, 76, 48), lambda a: Lum(a) > 110)
SNOWBALL = cutm('Snow Cannon', (26, 20, 38, 30), lambda a: Lum(a) > 180)
CASTER = cutm('Flame Avalanche', (26, 0, 50, 22), lambda a: ~((R_(a) > 170) & (B_(a) < 100)))
RUNE = cutm('Frost Rune', (26, 14, 48, 36), lambda a: G_(a) > R_(a) + 30)
FEGG = egg_cut('Flaming Dragonegg', 38.3, 26.5, 16.8, 19.5)
IEGG = adjust(egg_cut('Icy Dragonegg', 38.2, 26.8, 16.6, 19.5), contrast=1.2, sat=1.2)


# ================================================================ Aufbau
im = background()

# Held Feuer: Phönix Duigno (oben links), Held Eis: Iceage-Bestie (rechts)
ph = hero(PHOENIX, 2, [(120, 20, 14), (190, 56, 20), (236, 112, 30), (255, 176, 60), (255, 230, 140)], (255, 246, 200), (70, 8, 10), fade=12)
ph = ph.transpose(Image.FLIP_LEFT_RIGHT)
PHX, PHY = 4, 16
place(im, ph, PHX, PHY, (150, 40, 16, 255), r=4, st=0.5)
ic = hero(ICEAGE, 2, [(30, 50, 120), (60, 100, 180), (110, 160, 226), (170, 210, 246), (230, 246, 255)], (255, 255, 255), (16, 28, 80), fade=24, fade_right=16)
ic = ic.transpose(Image.FLIP_LEFT_RIGHT)
ICX, ICY = W - ic.width - 4, 90
place(im, ic, ICX, ICY, (70, 130, 210, 255), r=4, st=0.5)
rune = outline(RUNE, (10, 30, 50, 255))
place(im, rune, 196, 24, (160, 255, 236, 255), r=4, st=0.9)
sparkle(ImageDraw.Draw(im), 196 + rune.width // 2, 24 + rune.height // 2, 9, (200, 255, 240))
im.alpha_composite(rune, (196, 24))


cs = outline(CASTER, (30, 4, 8, 255))
place(im, cs, 44, 150 - cs.height, (255, 150, 40, 255), r=2, st=0.6)

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

# Eier (Kartenmotive, 1x) im Nest – über Kreuz wie die Punkte im Yin-Yang
IEX, FEX, EY = 125 - IEGG.width - 2, 127, 218 - FEGG.height
im.alpha_composite(nest(front=False))
fe = outline(FEGG, (30, 4, 8, 255)); ie = outline(IEGG, (10, 20, 58, 255))
place(im, fe, FEX, EY, (255, 140, 40, 255), r=5, st=0.45)
place(im, ie, IEX, 218 - IEGG.height, (150, 220, 255, 255), r=5, st=0.35)
im.alpha_composite(nest(front=True))


def dragonlings():
    def bgr(a):
        L_ = a[..., :3].mean(2); r, g, b = a[..., 0], a[..., 1], a[..., 2]
        return (L_ > 45) | ((g < 45) & (b < 70) & (r > 70))
    rd = keep_largest(cut_by(native('Red Dragoneer'), (20, 8, 54, 42), bgr)); rd = rd.crop(rd.getbbox())
    bd = keep_largest(cut_native(native('Blue-Ice Dragon'), (18, 8, 58, 42), barrier_lum=70)); bd = bd.crop(bd.getbbox())
    return outline(rd, (34, 4, 10, 255)), outline(bd.transpose(Image.FLIP_LEFT_RIGHT), (10, 16, 48, 255))


RD, BD = dragonlings()
place(im, RD, IEX - RD.width + 4, 224 - RD.height, (20, 6, 8, 255), r=2, st=0.9)
place(im, BD, FEX + FEGG.width - 3, 225 - BD.height, (220, 240, 255, 255), r=2, st=0.9)

im = particles(im)

# Feuer-Truppe links unten, Eis-Truppe rechts unten
pele = figure(PELE, 2, (40, 6, 10))
place(im, pele, 8, 305 - pele.height, (255, 120, 30, 255), r=3, st=0.5)
sk = figure(SKELETON, 2, (40, 6, 10))
place(im, sk, 62, 305 - sk.height, (255, 150, 40, 255), r=2, st=0.6)
sm = figure(SNOWMAN, 2, (10, 16, 48))
place(im, sm, W - 10 - sm.width, 305 - sm.height, (180, 220, 255, 255), r=2, st=0.5)
sl = figure(ISLIME, 2, (10, 16, 48))
place(im, sl, 162, 305 - sl.height, (120, 240, 230, 255), r=2, st=0.5)
blk = outline(ICEBLOCK, (10, 16, 48, 255))
place(im, blk, 214, 212, (200, 236, 255, 255), r=2, st=0.5)
# Geschosse treffen sich über der Grenze
fb = outline(FIREBALL, (40, 6, 10, 255))
place(im, fb, 96, 250, (255, 120, 30, 255), r=2, st=0.6)
sb = outline(SNOWBALL, (10, 16, 48, 255))
for (x_, y_) in [(140, 254), (152, 250), (147, 260)]:
    im.alpha_composite(sb, (x_, y_))
im.alpha_composite(clash(129, 257, 0.55))

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
