# -*- coding: utf-8 -*-
"""12 Temple of Sacrifice – Blick durch den Regenwald auf die Maya-Stufenpyramide:
Karstberge mit Wasserfall im Morgendunst, Lichtstrahlen von oben rechts, Aras, Lianen."""
from lib import *

YY, XX = np.mgrid[0:H, 0:W]
TSP = 'temple-of-sacrifice/'


# ---------------------------------------------------------------- Helfer
def ordered(v, n):
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.clip(np.floor(v * (n - 1) + BAYER4[yy % 4, xx % 4]), 0, n - 1).astype(int)


def rgba(c):
    return tuple(c) + (255,) if len(c) == 3 else tuple(c)


def layer_from(idx, mask, pal):
    P = np.array([rgba(c) for c in pal], np.uint8)
    out = P[np.clip(idx, 0, len(pal) - 1)]
    out[~mask] = 0
    return Image.fromarray(out, 'RGBA')


def comp(img, sprite, x, y):
    img.alpha_composite(sprite, (int(x), int(y)))


def arr(img):
    return np.array(img)


def setc(img, m, col):
    a = np.array(img); a[m] = rgba(col)
    return Image.fromarray(a)


def mix(img, m, col, t=1.0):
    a = np.array(img).astype(float)
    a[m, :3] = a[m, :3] * (1 - t) + np.array(col[:3]) * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def domes(w, h, shapes, pal, light=(0.7, -0.55, 0.45), flat=None, amb=0.0):
    """Plastische Formen aus Ellipsen (cx, cy, rx, ry); pal dunkel -> hell, Licht oben rechts."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    hgt = np.zeros((h, w))
    for (cx, cy, rx, ry) in shapes:
        d2 = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        hgt = np.maximum(hgt, np.sqrt(np.clip(1 - d2, 0, 1)) * min(rx, ry))
    m = hgt > 0
    if flat is not None:
        m &= yy <= flat
    gy, gx = np.gradient(hgt)
    n = np.dstack([-gx, -gy, np.ones_like(hgt) * 1.1])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array(light, float); L /= np.linalg.norm(L)
    s = n[..., 0] * L[0] + n[..., 1] * L[1] + n[..., 2] * L[2]
    s = np.clip((s + 0.15) / 1.05 + amb, 0, 1)
    return m, s


def leaf_mask(L, Wd, ang):
    """Blattform (Basis bei u=-1, Spitze bei u=+1) als Maske + (u, v)-Koordinaten."""
    R = int(L / 2 + Wd / 2 + 2)
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(float)
    ca, sa = math.cos(ang), math.sin(ang)
    u = (xx * ca + yy * sa) / (L / 2)
    v = (-xx * sa + yy * ca) / (Wd / 2)
    prof = np.clip(1 - u * u, 0, 1) ** 0.45 * (1 - 0.18 * u)
    m = (np.abs(u) <= 1) & (np.abs(v) <= prof)
    return m, u, v, R


def paint_leaves(a, leaves, pal, outl=None, light=(0.72, -0.69)):
    """Blätter nacheinander (hinten -> vorne) in das RGBA-Array a malen.
    leaves: (cx, cy, ang, L, Wd, tone) - tone = Grundstufe in pal."""
    h, w = a.shape[:2]
    lx, ly = light
    for (cx, cy, ang, L, Wd, tone) in leaves:
        m, u, v, R = leaf_mask(L, Wd, ang)
        if not m.any():
            continue
        # Seite zum Licht heller (Blatt entlang der Mittelrippe gefaltet)
        nx, ny = -math.sin(ang), math.cos(ang)
        side = np.sign(v) * (nx * lx + ny * ly)
        idx = tone + np.where(side > 0.15, 1, np.where(side < -0.15, -1, 0))
        idx = idx + np.where(u > 0.55, 1, 0) * (side >= 0)
        if L >= 7:
            idx = np.where((np.abs(v) < 0.22) & (u > -0.8) & (u < 0.7), tone - 1, idx)
        idx = np.clip(idx, 0, len(pal) - 1)
        er = ndimage.binary_erosion(m)
        edge = m & ~er
        ox, oy = int(round(cx)) - R, int(round(cy)) - R
        ys, xs = np.nonzero(m)
        for yy_, xx_ in zip(ys, xs):
            X, Y = ox + xx_, oy + yy_
            if 0 <= X < w and 0 <= Y < h:
                if outl is not None and edge[yy_, xx_]:
                    a[Y, X] = rgba(outl)
                else:
                    a[Y, X] = rgba(pal[idx[yy_, xx_]])
    return a


def leaf_cluster(cx, cy, n, spread, seed, Lr=(5, 8), Wr=(3, 5), tone=(1, 3), up=0.0, droop=0.6):
    """Blätterbüschel: Blätter strahlen vom Zentrum aus, vorne/oben rechts heller."""
    r = random.Random(seed)
    out = []
    for k in range(n):
        ang = r.uniform(0, 2 * math.pi)
        dd = r.uniform(0.0, 0.75) * spread
        x = cx + math.cos(ang) * dd
        y = cy + math.sin(ang) * dd * 0.8 - up
        L = r.uniform(*Lr); Wd = r.uniform(*Wr)
        a = ang + r.uniform(-0.5, 0.5)
        # Blätter hängen leicht nach unten
        a = math.atan2(math.sin(a) + droop, math.cos(a))
        lit = (x - cx) * 0.7 - (y - cy) * 0.7
        t = r.randint(tone[0], tone[1]) + (1 if lit > spread * 0.35 else 0) - (1 if lit < -spread * 0.45 else 0)
        out.append((x + math.cos(a) * L / 2, y + math.sin(a) * L / 2, a, L, Wd, t, dd))
    out.sort(key=lambda q: (q[5], -q[6]))
    return [q[:6] for q in out]


# ---------------------------------------------------------------- Farben
OUTL = (7, 16, 10)
LEAF = [(18, 48, 27), (26, 63, 34), (35, 80, 42), (46, 96, 48), (60, 112, 54), (78, 130, 62), (98, 148, 74)]
TEAL = [(10, 23, 18), (14, 31, 24), (18, 40, 29), (23, 49, 35), (28, 58, 42), (35, 68, 50)]
BARK = [(31, 24, 16), (43, 33, 20), (58, 49, 34), (74, 63, 44), (90, 78, 56)]
MOSS = [(26, 63, 34), (39, 69, 31), (54, 90, 40)]

# ---------------------------------------------------------------- Himmel
def fine_stops(keys, n=24):
    """Schlüsselfarben fein interpolieren -> feines Dithering zwischen nahen Tönen."""
    out = []
    for i in range(n + 1):
        t = i / n
        for k in range(len(keys) - 1):
            if keys[k][0] <= t <= keys[k + 1][0]:
                u = (t - keys[k][0]) / max(1e-6, keys[k + 1][0] - keys[k][0])
                out.append((t, lerp(keys[k][1], keys[k + 1][1], u)))
                break
    return out


SKYK = [(0, (18, 46, 54)), (0.25, (34, 82, 84)), (0.5, (74, 128, 114)), (0.72, (136, 170, 136)),
        (0.88, (180, 198, 154)), (1, (206, 212, 166))]
SKYF = lambda x, y: np.clip((y - 10) / 190.0, 0, 1)
SKYIMG = dither_gradient((W, H), fine_stops(SKYK, 30), func=SKYF)
im = new()
im.alpha_composite(SKYIMG)
# Sonnenschein oben rechts (hinter dem Blätterdach)
SX, SY = 196, 70
dist = np.hypot(XX - SX, (YY - SY) * 1.1)
glowt = np.clip(1 - dist / 150, 0, 1) ** 1.6
base = np.array(im).astype(float)
warm = np.array([236, 228, 172], float)
t = glowt * 0.85
q = np.floor(t * 10 + BAYER4[YY % 4, XX % 4]) / 10
base[..., :3] = base[..., :3] * (1 - q[..., None]) + warm * q[..., None]
im = Image.fromarray(base.clip(0, 255).astype(np.uint8))
SKYIMG = im.copy()


def fade_to_sky(lay, m, fy0, fy1, levels=5):
    """Nach unten in den Dunst (Himmelsfarbe) übergehen, in Zwischenstufen gedithert."""
    a = lay.astype(float)
    sk = np.array(SKYIMG).astype(float)
    t = np.clip((YY - fy0) / max(1, fy1 - fy0), 0, 1)
    q = np.clip(np.floor(t * (levels - 1) + BAYER4[YY % 4, XX % 4]) / (levels - 1), 0, 1)
    a[..., :3] = a[..., :3] * (1 - q[..., None]) + sk[..., :3] * q[..., None]
    out = a.clip(0, 255).astype(np.uint8)
    out[~m] = 0
    return out


def karst(towers, pal, seed, fy0, fy1, crown=None, tex=0.35, rim=None):
    """Karsttürme mit unregelmäßigem Umriss (Ausbuchtungen, Neigung), Licht oben rechts,
    senkrechte Kalkrinnen, Dschungel auf Kuppen und Simsen; unten Dunst."""
    r = np.random.RandomState(seed)
    m = np.zeros((H, W), bool)
    U = np.full((H, W), 0.0); V = np.full((H, W), 0.0)
    for (cx, top, hw, hh, lean) in towers:
        ph = r.rand(8) * 6.28
        jl = np.cumsum(r.randint(-1, 2, 400)) * 0.25
        jr = np.cumsum(r.randint(-1, 2, 400)) * 0.25
        for y in range(int(top), H):
            k = y - int(top)
            f = (y - top) / hh
            base = hw * min(1.0, 1.35 * max(f, 0.0) ** 0.5) * (1 + 0.25 * max(0, f - 0.55))
            wl = base * (1 + 0.14 * math.sin(f * 6 + ph[0]) + 0.07 * math.sin(f * 15 + ph[1])) + jl[k] * 0.4
            wr = base * (1 + 0.14 * math.sin(f * 6 + ph[2]) + 0.07 * math.sin(f * 15 + ph[3])) + jr[k] * 0.4
            wl = max(wl, 0.5); wr = max(wr, 0.5)
            c = cx + lean * f * hh
            x0, x1 = int(round(c - wl)), int(round(c + wr))
            for x in range(max(0, x0), min(W, x1 + 1)):
                uu = (x - c) / (wr if x >= c else wl)
                m[y, x] = True; U[y, x] = uu; V[y, x] = f
    s = 0.42 + 0.5 * np.sign(U) * np.abs(U) ** 1.5 + 0.3 * np.clip(0.3 - V, 0, 0.3)
    st = np.array(Image.fromarray((value_noise(W, 24, 1.3, seed=seed + 3, octaves=1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)) / 255
    s = s + (st - 0.5) * tex
    idx = ordered(np.clip(s, 0, 1), len(pal))
    lay = np.array(layer_from(idx, m, pal))
    if crown is not None:
        cz = value_noise(W, H, 3, seed=seed + 11, octaves=2)
        topd = np.zeros((H, W))
        # Abstand zum oberen Umriss je Spalte
        edge_top = m & ~np.roll(m, 1, 0)
        dist_top = ndimage.distance_transform_edt(~edge_top)
        cm = m & ((dist_top < 3 + 3 * cz) | ((cz > 0.64) & (U > -0.6))) & (V < 0.75)
        ci = ordered(np.clip(0.3 + 0.55 * np.clip(U, -1, 1) + (cz - 0.5) * 0.8, 0, 1), len(crown))
        cl = np.array(layer_from(ci, cm, crown))
        lay[cm] = cl[cm]
    if rim is not None:
        e = m & ~np.roll(m, -1, 1) & (U > 0.2)
        lay[e] = rgba(rim)
    return Image.fromarray(fade_to_sky(lay, m, fy0, fy1)), m


# ---------------------------------------------------------------- ferne Karstberge
FARP = [(112, 146, 124), (126, 158, 132), (142, 172, 140), (164, 190, 152)]
FARC = [(104, 140, 114), (118, 152, 120), (134, 166, 128)]
far = [(20, 112, 13, 60, 0.05), (46, 126, 10, 50, -0.08), (98, 128, 15, 50, 0.1), (150, 100, 12, 60, -0.05),
       (174, 118, 14, 60, 0.12), (222, 88, 13, 70, -0.06), (244, 116, 10, 50, 0.0), (124, 138, 16, 40, 0.0)]
lay, _ = karst(far, FARP, 1, 125, 178, crown=FARC, tex=0.3, rim=(178, 200, 158))
comp(im, lay, 0, 0)

# ---------------------------------------------------------------- mittlere Karstberge
MIDP = [(52, 88, 76), (64, 104, 86), (80, 120, 96), (100, 140, 108), (126, 160, 120)]
MIDC = [(38, 76, 58), (50, 92, 64), (66, 110, 72), (84, 128, 80)]
mid = [(24, 124, 16, 80, 0.08), (62, 142, 13, 70, -0.1), (206, 134, 15, 80, 0.1), (236, 120, 17, 80, -0.05)]
lay, mm = karst(mid, MIDP, 2, 150, 212, crown=MIDC, tex=0.35, rim=(150, 178, 132))
comp(im, lay, 0, 0)



def treeline(circles, pal, edge, fy0=None, fy1=None, light=(0.7, -0.6, 0.5), tex=0.25, seed=0):
    """Baumkronen-Reihe: jede Krone einzeln schattiert, vordere (tiefere) Kronen überdecken hintere,
    dunkle Kante am Rand vorderer Kronen."""
    best = np.full((H, W), -1e9); ids = np.full((H, W), -1)
    sh = np.zeros((H, W))
    L = np.array(light, float); L /= np.linalg.norm(L)
    for i, (cx, cy, rx, ry) in enumerate(circles):
        x0, x1 = max(0, int(cx - rx - 1)), min(W, int(cx + rx + 2))
        y0, y1 = max(0, int(cy - ry - 1)), min(H, int(cy + ry + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        xx = XX[y0:y1, x0:x1]; yy = YY[y0:y1, x0:x1]
        nx = (xx - cx) / rx; ny = (yy - cy) / ry
        d2 = nx * nx + ny * ny
        inside = d2 <= 1
        pri = cy + i * 1e-3
        upd = inside & (pri > best[y0:y1, x0:x1])
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        s = nx * L[0] + ny * L[1] + nz * L[2]
        best[y0:y1, x0:x1] = np.where(upd, pri, best[y0:y1, x0:x1])
        ids[y0:y1, x0:x1] = np.where(upd, i, ids[y0:y1, x0:x1])
        sh[y0:y1, x0:x1] = np.where(upd, s, sh[y0:y1, x0:x1])
    m = ids >= 0
    nzv = value_noise(W, H, 2, seed=seed, octaves=2)
    v = np.clip((sh + 0.2) / 1.1 + (nzv - 0.5) * tex, 0, 1)
    lay = np.array(layer_from(ordered(v, len(pal)), m, pal))
    if edge is not None:
        # Kante: Pixel einer Krone, deren Nachbar (unten/links) zu einer hinteren Krone gehört oder leer ist
        e = np.zeros_like(m)
        for dy, dx in ((1, 0), (0, -1), (1, -1), (0, 1)):
            nb = np.roll(np.roll(ids, -dy, 0), -dx, 1)
            nbb = np.roll(np.roll(best, -dy, 0), -dx, 1)
            e |= m & (nb != ids) & ((nb < 0) | (nbb < best - 0.5))
        lay[e] = rgba(edge)
    if fy0 is not None:
        lay = fade_to_sky(lay, m, fy0, fy1)
    return Image.fromarray(lay), m


def crown_row(x0, x1, base, seed, rmin, rmax, step, jitter=3, flat=0.8):
    r = random.Random(seed)
    out = []
    x = x0
    while x < x1:
        rr = r.uniform(rmin, rmax)
        b = base(x) if callable(base) else base
        out.append((x, b - rr * 0.5 + r.uniform(-jitter, jitter), rr, rr * flat))
        x += step * r.uniform(0.7, 1.2)
    return out


def clump_row(x0, x1, base, seed, rmin, rmax, step, jitter=2, flat=0.85):
    """Kronen als Blumenkohl-Büschel: Hauptkreis + kleinere Teilkronen obenauf."""
    r = random.Random(seed)
    out = []
    x = x0
    while x < x1:
        rr = r.uniform(rmin, rmax)
        b = base(x) if callable(base) else base
        cy = b - rr * 0.5 + r.uniform(-jitter, jitter)
        out.append((x, cy, rr, rr * flat))
        for k in range(r.randint(1, 3)):
            a = r.uniform(-2.6, -0.5)
            sr = rr * r.uniform(0.4, 0.6)
            out.append((x + math.cos(a) * rr * 0.6, cy + math.sin(a) * rr * 0.55 - 0.01, sr, sr * flat))
        x += step * r.uniform(0.6, 1.3)
    return out


def forest_band(crowns, pal, edge, fy0, fy1, seed, body_col=None):
    lay, m = treeline(crowns, pal, edge, seed=seed)
    # Waldkörper: alles unterhalb der Kronenlinie (je Spalte ab dem Kronen-Schwerpunkt) füllen
    body = np.zeros((H, W), bool)
    for (cx, cy, rx, ry) in crowns:
        body |= (np.abs(XX - cx) <= rx * 0.7) & (YY >= cy)
    top = np.where(body.any(0), body.argmax(0), H)
    body = YY >= top[None, :]
    la = np.array(lay)
    la[body & ~m] = rgba(body_col or pal[0])
    return Image.fromarray(fade_to_sky(la, m | body, fy0, fy1)), m | body


# ---------------------------------------------------------------- Wasserfall am linken Karstturm
def waterfall(img, x0, y0, y1, w, seed):
    a = np.array(img)
    r = np.random.RandomState(seed)
    WF = [(126, 170, 156), (160, 196, 178), (196, 220, 198), (228, 240, 220)]
    streak = r.rand(w + 2)
    for y in range(y0, y1):
        for i in range(w):
            x = x0 + i + (1 if y - y0 > 2 and i == 0 and False else 0)
            ph = (y * 0.9 + streak[i] * 13) % 5
            k = 2 if ph < 2 else (3 if ph < 3 else 1)
            if i == 0: k = max(0, k - 1)
            if i == w - 1: k = min(3, k + 1)
            if (y - y0) < 2: k = 3
            a[y, x] = rgba(WF[k])
    img = Image.fromarray(a)
    # Gischt am Fuß
    sp = np.hypot((XX - (x0 + w / 2)) / 7.0, (YY - y1) / 3.5)
    img = setc(img, dither_mask(None, np.clip(1 - sp, 0, 1) * 1.3), (214, 228, 204))
    return img


# ---------------------------------------------------------------- Waldstufen im Dunst
TX, TY = 25, 243
C1P = [(96, 136, 106), (110, 150, 114), (126, 164, 122), (144, 178, 132)]
lay, _ = forest_band(clump_row(-6, W + 8, 204, 21, 4, 8, 7), C1P, (86, 124, 98), 200, 224, 21)
comp(im, lay, 0, 0)
im = waterfall(im, 55, 150, 196, 3, 3)
C2P = [(50, 92, 68), (62, 108, 76), (76, 124, 84), (94, 140, 94), (114, 156, 104)]
base2 = lambda x: TY + 2 - 64 * (abs(x - 125) / 125) ** 1.5
lay, _ = forest_band(clump_row(-6, W + 8, base2, 22, 5, 11, 9), C2P, (38, 72, 54), TY + 12, TY + 44, 22)
comp(im, lay, 0, 0)
C3P = [(30, 64, 46), (38, 78, 52), (50, 94, 60), (66, 112, 70)]
base3 = lambda x: TY + 30 - 60 * (abs(x - 125) / 125) ** 1.2
lay, _ = forest_band(clump_row(-6, W + 8, base3, 23, 6, 12, 10), C3P, (20, 44, 32), TY + 60, TY + 90, 23)
comp(im, lay, 0, 0)
BG_DONE = np.array(im).copy()

# ---------------------------------------------------------------- Dschungelband seitlich (Kachel des Spiels)
tile = area(TSP + 'tile')
comp(im, tile.crop((0, 0, 72, 100)), 0, TY)
comp(im, tile.crop((50, 0, 128, 100)), W - 78, TY)


def limb_field(chains):
    """Stämme/Äste als Ketten von Kapseln [(x, y, r)], vereinigt. Liefert Maske und Normalen."""
    best = np.full((H, W), 1e9); NX = np.zeros((H, W)); NY = np.zeros((H, W))
    for pts in chains:
        for (x0, y0, r0), (x1, y1, r1) in zip(pts[:-1], pts[1:]):
            bx0, bx1 = int(max(0, min(x0, x1) - max(r0, r1) - 2)), int(min(W, max(x0, x1) + max(r0, r1) + 3))
            by0, by1 = int(max(0, min(y0, y1) - max(r0, r1) - 2)), int(min(H, max(y0, y1) + max(r0, r1) + 3))
            if bx0 >= bx1 or by0 >= by1:
                continue
            xx = XX[by0:by1, bx0:bx1]; yy = YY[by0:by1, bx0:bx1]
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy + 1e-9
            t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / L2, 0, 1)
            ox, oy = xx - (x0 + t * dx), yy - (y0 + t * dy)
            rr = np.maximum(r0 + (r1 - r0) * t, 0.5)
            dn = np.hypot(ox, oy) / rr
            upd = dn < best[by0:by1, bx0:bx1]
            best[by0:by1, bx0:bx1] = np.where(upd, dn, best[by0:by1, bx0:bx1])
            NX[by0:by1, bx0:bx1] = np.where(upd, ox / rr, NX[by0:by1, bx0:bx1])
            NY[by0:by1, bx0:bx1] = np.where(upd, oy / rr, NY[by0:by1, bx0:bx1])
    return best <= 1.0, NX, NY


def paint_limbs(img, chains, seed, moss=0.3, light=(0.75, -0.66)):
    """Rinde im Stil der Tempelbäume: dunkle Kontur, Brauntöne, Licht oben rechts, Moosflecken."""
    a = np.array(img)
    m, nx, ny = limb_field(chains)
    r = np.random.RandomState(seed)
    lam = nx * light[0] + ny * light[1]
    gs = np.array(Image.fromarray((r.rand(H // 5 + 2, W) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)) / 255
    v = 0.42 + 0.42 * lam + (gs - 0.5) * 0.55
    idx = np.clip(np.floor(v * 4 + BAYER4[YY % 4, XX % 4] * 0.9), 0, 4).astype(int)
    col = np.array([rgba(c) for c in BARK], np.uint8)[idx]
    mz = value_noise(W, H, 2, seed=seed + 5, octaves=2)
    mm = (mz + (r.rand(H, W) - 0.5) * 0.25) > 1 - moss * (0.8 - 0.5 * lam)
    mcol = np.array([rgba(c) for c in MOSS], np.uint8)[np.clip((lam * 1.5 + 1).astype(int), 0, 2)]
    col[mm] = mcol[mm]
    edge = m & ~ndimage.binary_erosion(m)
    a[m] = col[m]
    a[edge] = rgba(OUTL)
    return Image.fromarray(a), m


def foliage_mass(mask, seed, dark=0):
    """Dichtes Blattwerk im Schatten: fleckige dunkle Teal-Töne wie der Hintergrund des Kachelbildes."""
    nz = value_noise(W, H, 3, seed=seed, octaves=3)
    v = np.clip(nz * 1.15 - 0.12 - dark * 0.15, 0, 1)
    return layer_from(ordered(v, len(TEAL)), mask, TEAL)


def poisson_pts(mask, spacing, seed, limit=4000):
    r = random.Random(seed)
    ys, xs = np.nonzero(mask)
    order = list(range(len(ys))); r.shuffle(order)
    pts = []
    grid = {}
    for i in order:
        x, y = int(xs[i]), int(ys[i])
        gx, gy = x // spacing, y // spacing
        ok = True
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                for (px, py) in grid.get((gx + ddx, gy + ddy), []):
                    if (px - x) ** 2 + (py - y) ** 2 < spacing * spacing:
                        ok = False; break
                if not ok: break
            if not ok: break
        if ok:
            pts.append((x, y)); grid.setdefault((gx, gy), []).append((x, y))
            if len(pts) >= limit: break
    return pts


def leafy(img, mask, seed, spacing=6, inner=12, tone_edge=(1, 3), tone_in=(0, 1), spread=5, n=11, Lr=(5, 9), Wr=(4, 5.5), pal=None, skip=None):
    """Blätterbüschel entlang des gesamten Umrisses der Masse (dicht) und locker im Inneren.
    Kanten, die zum Licht (oben rechts) zeigen, heller."""
    pal = pal or LEAF
    a = np.array(img)
    edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
    if skip is not None:
        edge &= ~skip
    sm = ndimage.gaussian_filter(mask.astype(float), 2.0)
    gy, gx = np.gradient(sm)
    inner_m = ndimage.binary_erosion(mask, iterations=4)
    pe = poisson_pts(edge, spacing, seed)
    pi = poisson_pts(inner_m, inner, seed + 1)
    jobs = []
    for (x, y) in pi:
        jobs.append((0, y, x, tone_in))
    for (x, y) in pe:
        nxv, nyv = -gx[y, x], -gy[y, x]
        ln = math.hypot(nxv, nyv) + 1e-9
        lit = (nxv * 0.72 - nyv * 0.69) / ln
        d = (1 if lit > 0.3 else 0) - (1 if lit < -0.5 else 0)
        jobs.append((1, y, x, (max(0, tone_edge[0] + d), max(0, tone_edge[1] + d))))
    jobs.sort()
    for (lvl, y, x, tn) in jobs:
        paint_leaves(a, leaf_cluster(x, y, n if lvl else n - 3, spread, int(x * 131 + y * 7 + seed), Lr=Lr, Wr=Wr, tone=tn), pal, OUTL)
    return Image.fromarray(a)


def blob_mask(lobes, sy=1.1):
    m = np.zeros((H, W), bool)
    for (bx, by, br) in lobes:
        m |= (XX - bx) ** 2 + ((YY - by) * sy) ** 2 <= br * br
    return m


# ---------------------------------------------------------------- Hecke über der Oberkante des Kachelbands
hedge = [(x, TY + 2 + (abs(x - 125) < 70) * 6, 7) for x in range(-4, 80, 7)] + [(x, TY + 2, 7) for x in range(176, W + 6, 7)]
hm = blob_mask(hedge) & (YY >= TY - 8) & (YY < TY + 14)
comp(im, foliage_mass(hm, 61), 0, 0)
im = leafy(im, hm, 62, spacing=5, inner=10, tone_edge=(1, 2), tone_in=(0, 1), spread=4, n=9, Lr=(4, 7), Wr=(3.5, 5))

# ---------------------------------------------------------------- Stämme (Tempelbäume nach oben verlängert) und Äste
treesL = [[(33.5, TY + 14, 4.0), (33.5, TY - 40, 4.0), (35, 150, 4.3), (38, 80, 4.6), (40, 20, 5.0), (40, 0, 5.0)],
          [(38, 72, 2.4), (52, 56, 1.9), (68, 46, 1.4)]]
treesR = [[(211.5, TY + 14, 5.5), (211, TY - 50, 5.5), (208, 120, 5.8), (206, 60, 6.0), (205, 0, 6.0)],
          [(206, 80, 2.6), (188, 62, 1.9), (172, 54, 1.4)]]
im, trunkL = paint_limbs(im, treesL, 5, moss=0.35)
im, trunkR = paint_limbs(im, treesR, 6, moss=0.35)

# ---------------------------------------------------------------- Blätterdach oben + Seitenwände
lobes = [
    (10, 14, 18), (34, 16, 16), (58, 12, 16), (80, 16, 13), (72, 42, 9), (100, 8, 12), (124, 6, 10), (146, 8, 12),
    (168, 12, 15), (192, 16, 16), (218, 14, 18), (242, 18, 16), (176, 50, 9), (150, 30, 9), (95, 30, 8),
    (12, 50, 16), (8, 84, 14), (12, 116, 13), (6, 150, 12), (10, 182, 12), (6, 214, 11),
    (240, 52, 16), (244, 88, 14), (238, 120, 13), (244, 154, 12), (240, 186, 12), (246, 216, 11),
]
canm = blob_mask(lobes) | (YY < 9)
comp(im, foliage_mass(canm, 41), 0, 0)

# Lianen des Spiels (sway.png, Bild 1) hängen aus dem Blätterdach – Oberkanten verschwinden im Laub
sway = area(TSP + 'sway').crop((0, 0, 128, 100))
slab, sn = ndimage.label(np.array(sway)[..., 3] > 0, structure=np.ones((3, 3)))
VINES = {}
for i, sl in enumerate(ndimage.find_objects(slab)):
    if sl[0].start == 0 and sl[0].stop > 25:
        a_ = np.array(sway.crop((sl[1].start, 0, sl[1].stop, sl[0].stop)))
        a_[..., 3] = np.where(slab[0:sl[0].stop, sl[1].start:sl[1].stop] == i + 1, a_[..., 3], 0)
        VINES[sl[1].start] = Image.fromarray(a_)
vk = sorted(VINES)
print('vines', [(k, VINES[k].size) for k in vk])


def canopy_bottom(x):
    col = canm[:, int(x)]
    ys = np.nonzero(col[:120])[0]
    return int(ys.max()) if len(ys) else 0


for (x, key, dy) in [(56, vk[2], -10), (90, vk[4], -8), (118, vk[1], -6), (158, vk[5], -8), (184, vk[3], -8), (226, vk[0], -14)]:
    v = VINES[key]
    comp(im, v, x - v.width // 2, canopy_bottom(x) + dy)
im = leafy(im, canm, 51)

# ---------------------------------------------------------------- Tempel
temple = area(TSP + 'temple')
comp(im, temple, TX, TY)

print(save(im, '12_temple_of_sacrifice'))
