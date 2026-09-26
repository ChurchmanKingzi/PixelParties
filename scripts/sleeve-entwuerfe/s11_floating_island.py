# -*- coding: utf-8 -*-
"""11 Floating Island – Tarleinns schwebende Insel über dem Wolkenmeer: der Fluss stürzt als langer
Wasserfall mit Gischt und Regenbogen in die Wolken; Schwebeinseln in vielen Tiefen (Spiel-Sprites und
im Stil von island.png neu gemalte Inseln mit Bäumen, Felsen, Ranken, Bächen, Ruinen), Quellwolken,
Cirren, Sonne oben rechts (wie im Spiel: Licht IMMER oben rechts), Vögel in mehreren Tiefen.
Aufgebaut aus den Area-Ebenen public/areas/floating-island/."""
from lib import *

FI = 'floating-island/'
YY, XX = np.mgrid[0:H, 0:W]
rnd = random.Random(11)


# ---------------------------------------------------------------- Helfer
def A(n):
    return area(FI + n)


def ordered(v, n, ox=0, oy=0):
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.clip(np.floor(v * (n - 1) + BAYER4[(yy + oy) % 4, (xx + ox) % 4]), 0, n - 1).astype(int)


def rgba(c):
    return tuple(c) + (255,) if len(c) == 3 else tuple(c)


def layer_from(idx, mask, pal):
    P = np.array([rgba(c) for c in pal], np.uint8)
    out = P[np.clip(idx, 0, len(pal) - 1)]
    out[~mask] = 0
    return Image.fromarray(out, 'RGBA')


def comp(img, sprite, x, y):
    img.alpha_composite(sprite, (int(x), int(y)))


def setc(img, m, col):
    a = np.array(img); a[m] = rgba(col)
    return Image.fromarray(a)


def haze(img, col, amt):
    """Luftperspektive: Farben Richtung Dunst ziehen (Pixelstruktur bleibt)."""
    a = np.array(img).astype(float)
    a[..., :3] = a[..., :3] * (1 - amt) + np.array(col) * amt
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def sea_layer(w, h, seed, rmin, rmax, pal, amp=4, depth=22, ox=0, oy=0, towers=(), rows=2, pad=0):
    """Wolkenmeer-Schicht aus runden Buckeln (Licht oben rechts), gemalt wie Pixel-Art-Wolken:
    helle Kappe oben rechts, Hauptton, Schattensichel unten links; Körper darunter wird nach unten
    dunkler. Tiefer liegende Buckel überdecken höhere -> klare Kanten. pal dunkel -> hell."""
    r = random.Random(seed)
    n = len(pal)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    val = np.full((h, w), -1.0)
    circ = []
    base = pad + amp + rmax * 1.5
    ph = r.uniform(0, 6)
    for row in range(rows):
        x = r.uniform(-rmax, 0)
        while x < w + rmax:
            rr = r.uniform(rmin, rmax) * (1 - 0.18 * row)
            lift = amp * (math.sin(x * 0.05 + ph) + 1) * 0.5 + r.uniform(0, amp * 0.5)
            cy = base - rr * 0.45 + lift - amp + row * rmax * 0.55
            circ.append((x + row * rmax * 0.5, cy, rr))
            x += rr * r.uniform(0.9, 1.3)
    for (tx, er, lift) in towers:
        circ.append((tx, base - er * 0.5 - lift, er))
    # Körper
    body = yy >= base - 1
    val[body] = 0.55
    circ.sort(key=lambda c: c[1] + c[2] * 0.3)
    for (cx, cy, rr) in circ:
        dx = (xx - cx) / rr; dy = (yy - cy) / rr
        d = np.sqrt(dx * dx + dy * dy)
        disc = d <= 1
        lit = (dx * 0.5 - dy * 0.85)           # Licht von oben rechts
        v = 0.62 + 0.38 * np.clip(lit, -1, 1)
        v = np.where(d > 0.84, v - 0.1 * np.clip(-lit + 0.3, 0, 1), v)   # dunkler Randsaum unten links
        v = np.where((d > 1 - 1.3 / rr) & (lit > 0.45), 1.2, v)          # Sonnenkante oben rechts
        val = np.where(disc, v, val)
    m = val >= 0
    below = np.clip((yy - (base - rmax * 0.2)) / depth, 0, 1)
    val = val - 0.55 * below
    val += (value_noise(w, h, 5, seed=seed + 100, octaves=2) - 0.5) * 0.10
    idx = ordered(np.clip(val, 0, 1), n, ox, oy)
    return layer_from(idx, m, pal)


def puff(w, h, circ, pal, flat=None, seed=0, ox=0, oy=0):
    """Einzelne Pixelwolke aus Buckeln (gleiche Malweise wie sea_layer)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    val = np.full((h, w), -1.0)
    for (cx, cy, rr) in sorted(circ, key=lambda c: c[1] + c[2] * 0.3):
        dx = (xx - cx) / rr; dy = (yy - cy) / rr
        d = np.sqrt(dx * dx + dy * dy)
        lit = (dx * 0.5 - dy * 0.85)
        v = 0.62 + 0.38 * np.clip(lit, -1, 1)
        v = np.where(d > 0.84, v - 0.1 * np.clip(-lit + 0.3, 0, 1), v)
        v = np.where((d > 1 - 1.3 / rr) & (lit > 0.45), 1.2, v)
        val = np.where(d <= 1, v, val)
    m = val >= 0
    if flat is not None:
        m &= yy <= flat
    val += (value_noise(w, h, 5, seed=seed + 7, octaves=2) - 0.5) * 0.10
    return layer_from(ordered(np.clip(val, 0, 1), len(pal), ox, oy), m, pal)


# ---------------------------------------------------------------- Paletten (aus island.png / isle-*.png / sway.png)
GRASS = [(12, 32, 8), (17, 51, 11), (24, 68, 15), (31, 86, 19), (38, 103, 23), (46, 120, 27), (55, 137, 32),
         (66, 153, 38)]
CANO = [(20, 47, 11), (29, 64, 15), (40, 82, 19), (53, 101, 24), (70, 120, 29), (90, 139, 35), (116, 160, 44)]
EARTH = [(25, 13, 7), (44, 25, 13), (59, 33, 18), (80, 46, 25), (103, 62, 36), (124, 76, 41), (157, 98, 56)]
EARTH_R = [(49, 23, 14), (67, 31, 19), (90, 43, 26), (114, 56, 34), (138, 70, 41), (174, 91, 56), (209, 113, 77)]
TRUNK = [(21, 11, 5), (58, 34, 18), (85, 52, 28), (110, 69, 38)]
ROCKP = [(52, 42, 64), (81, 67, 95), (104, 87, 120), (128, 109, 144), (154, 135, 168), (182, 165, 194)]
STONE = [(49, 51, 63), (92, 95, 109), (116, 119, 133), (144, 148, 160), (173, 176, 185)]
FLOWERS = [(255, 226, 74), (255, 154, 54), (232, 56, 58), (91, 143, 255), (245, 143, 201), (255, 243, 246)]
OUT_G, OUT_E, OUT_V = (12, 32, 8), (21, 11, 5), (8, 22, 6)
WATP = [(8, 26, 90), (13, 35, 120), (19, 52, 164), (26, 72, 200), (35, 96, 226), (47, 120, 243), (78, 147, 251),
        (128, 180, 255), (188, 217, 255), (230, 242, 255)]


def noise1(n, scale, seed):
    r = np.random.RandomState(seed)
    g = r.rand(n // max(1, scale) + 3)
    x = np.arange(n) / scale
    i = np.floor(x).astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    return g[i] * (1 - f) + g[i + 1] * f


def paint_islet(w, cap_h, depth, seed, trees=(), rocks=(), bushes=3, vines=4, roots=4, spikes=None,
                flowers=6, stream=None, stones=2, ruin=None):
    """Schwebeinsel im Stil von island.png: Graskappe (Draufsicht, Licht oben rechts) mit Bäumen,
    Büschen, Felsen, Blumen; Erd-Unterseite mit Schichten, Zacken, Steinen, Ranken und Wurzeln.
    trees: [(x, y, r)] relativ zur Kappe (0..w, 0..cap_h); rocks: [(x, y, r)]; stream: (x_quelle, y_quelle, x_rand)."""
    r = random.Random(seed)
    SW, SH = w + 10, cap_h + depth + 26
    ox, oy = 5, 6 + max([t[2] for t in trees], default=0)
    SH += oy
    yy, xx = np.mgrid[0:SH, 0:SW].astype(float)
    cx, cy = ox + (w - 1) / 2, oy + (cap_h - 1) / 2
    rx, ry = w / 2, cap_h / 2
    ang = np.arctan2((yy - cy) / ry, (xx - cx) / rx)
    wob = 1 + 0.05 * np.sin(ang * 3 + seed) + 0.04 * np.sin(ang * 7 + seed * 2) + 0.03 * np.sin(ang * 13 + seed)
    dn = np.hypot((xx - cx) / rx, (yy - cy) / ry) / wob
    cap = dn <= 1.0
    # --- Unterseite
    cols = np.where(cap.any(0))[0]
    edge_in = max(3, int(w * 0.07))
    x0, x1 = cols.min() + edge_in, cols.max() - edge_in
    prof = np.zeros(SW)
    nz = noise1(SW, 4, seed + 3)
    for x in range(x0, x1 + 1):
        u = (x - cx) / (rx - 2)
        prof[x] = depth * 0.5 * max(0, 1 - u * u) ** 1.2 + 2 + nz[x] * 2.5
    if spikes is None:
        spikes = []
        for _ in range(max(2, w // 12)):
            u = r.uniform(-0.7, 0.7)
            sl = r.uniform(0.6, 0.95) * depth * (1 - abs(u) * 0.45)
            spikes.append((cx + u * rx, max(2.5, sl * r.uniform(0.22, 0.3)), sl))
        spikes.append((cx + r.uniform(-0.12, 0.12) * rx, max(3.5, depth * 0.3), depth))
    for (sx, sw, sl) in spikes:
        for x in range(int(sx - sw - 1), int(sx + sw + 2)):
            if x0 <= x <= x1:
                prof[x] = max(prof[x], sl * max(0, 1 - abs(x + 0.5 - sx) / sw) ** 1.5)
    bot = cy + prof
    und = (yy >= cy) & (yy <= bot[None, :]) & (xx >= x0) & (xx <= x1) & (prof[None, :] > 0)
    und = ndimage.binary_opening(und, np.ones((1, 2))) | (und & (yy < cy + 3))
    # Erdschattierung
    body = np.zeros((SH, SW))
    lab, n = ndimage.label(und, structure=[[0, 0, 0], [1, 1, 1], [0, 0, 0]])
    rel = np.zeros((SH, SW))
    for sl in ndimage.find_objects(lab):
        pass
    for y in range(SH):
        row = und[y]
        if not row.any():
            continue
        xs = np.where(row)[0]
        segs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        for sgm in segs:
            a_, b_ = sgm[0], sgm[-1]
            rel[y, a_:b_ + 1] = (np.arange(a_, b_ + 1) - a_ + 0.5) / max(1, b_ - a_ + 1)
    capbot = np.array([np.max(np.where(cap[:, x])[0]) if cap[:, x].any() else int(cy) for x in range(SW)], int)
    below = (yy - capbot[None, :])
    strata = np.sin((yy + nz[None, :] * 5) * 1.25) * 0.1
    vn = value_noise(SW, SH, 3, seed=seed + 9, octaves=2)
    v = 0.66 - np.clip((yy - cy) / (depth + 1), 0, 1) * 0.3 + (rel - 0.5) * 0.5 + strata + (vn - 0.5) * 0.28
    eidx = ordered(np.clip(v, 0, 1), len(EARTH), 1, 2)
    out = np.zeros((SH, SW, 4), np.uint8)
    PE = np.array([rgba(c) for c in EARTH], np.uint8)
    PR = np.array([rgba(c) for c in EARTH_R], np.uint8)
    out[und] = PE[eidx[und]]
    top_band = und & (below >= 0) & (below < 3.5)
    ridx = ordered(np.clip(v + 0.15 - below * 0.06, 0, 1), len(EARTH_R), 3, 1)
    out[top_band] = PR[ridx[top_band]]
    # Steine in der Erde
    for _ in range(stones):
        for _t in range(20):
            sx, sy = r.randrange(x0 + 2, x1 - 2), int(cy + r.uniform(3, depth * 0.35))
            if und[sy - 1:sy + 3, sx - 2:sx + 4].all():
                break
        else:
            continue
        pts = [(0, 0, 1), (1, 0, 3), (2, 0, 3), (0, 1, 2), (1, 1, 2), (2, 1, 1)]
        for (dx, dy, k) in pts:
            out[sy + dy, sx + dx] = rgba(STONE[k + (1 if (dx == 2 and dy == 0) else 0)])
        out[sy + 2, sx:sx + 3] = rgba(STONE[0])
    # Umriss der Unterseite
    und_all = und.copy()
    e = und & ~ndimage.binary_erosion(und, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]], border_value=0)
    e &= ~(yy < capbot[None, :] + 1)
    out[e] = rgba(OUT_E)
    # --- Graskappe
    gn = value_noise(SW, SH, 3, seed=seed + 1, octaves=2) * 0.6 + value_noise(SW, SH, 1, seed=seed + 5, octaves=1) * 0.4
    lit = (xx - cx) / rx * 0.14 - (yy - cy) / ry * 0.18
    gv = 0.66 + (gn - 0.5) * 0.8 + lit - np.clip(dn - 0.78, 0, 1) * 1.1
    gidx = 1 + ordered(np.clip(gv, 0, 1), len(GRASS) - 1, 2, 3)
    PG = np.array([rgba(c) for c in GRASS], np.uint8)
    capimg = np.zeros((SH, SW, 4), np.uint8)
    capimg[cap] = PG[gidx[cap]]
    # Büsche (dunkle Kringel wie auf der Hauptinsel)
    for _ in range(bushes):
        bx, by = cx + r.uniform(-0.6, 0.6) * rx, cy + r.uniform(-0.5, 0.5) * ry
        br = r.choice([2, 2.5, 3])
        d = np.hypot(xx - bx, (yy - by) * 1.1)
        ring = (d <= br + 0.5) & (d > br - 0.6) & cap
        inner = (d <= br - 0.6) & cap
        lower_left = ((xx - bx) * 0.5 - (yy - by) * 0.85) < 0.3
        capimg[ring & lower_left] = rgba(GRASS[0])
        capimg[ring & ~lower_left] = rgba(GRASS[2])
        ii = np.clip(gidx + 1, 0, len(GRASS) - 1)
        capimg[inner] = PG[ii[inner]]
    # Umriss der Kappe
    ce = cap & ~ndimage.binary_erosion(cap, border_value=0)
    capimg[ce] = rgba(OUT_G)
    # Grasfransen an der Unterkante
    for x in range(int(x0) - 2, int(x1) + 3):
        if not cap[:, x].any():
            continue
        yb = capbot[x]
        if r.random() < 0.45:
            L = r.choice([1, 1, 2, 2, 3])
            for k in range(1, L + 1):
                if yb + k < SH:
                    capimg[yb + k, x] = rgba(GRASS[2] if k < L else OUT_G)
    # Baumschatten auf dem Gras
    for (tx, ty, tr) in trees:
        px, py = ox + tx, oy + ty
        d = np.hypot((xx - (px - 2)) / (tr * 0.95), (yy - (py + tr * 0.55)) / (tr * 0.55))
        sm = (d <= 1) & cap & ~ce
        dk = np.clip(gidx - 2, 1, len(GRASS) - 1)
        capimg[sm] = PG[dk[sm]]
    # Blumen
    for _ in range(flowers):
        for _t in range(10):
            fx, fy = int(cx + r.uniform(-0.75, 0.75) * rx), int(cy + r.uniform(-0.6, 0.6) * ry)
            if dn[fy, fx] < 0.8:
                break
        c = r.choice(FLOWERS)
        capimg[fy, fx] = rgba(c)
        if r.random() < 0.4 and dn[fy, fx + 1] < 0.8:
            capimg[fy, fx + 1] = rgba(GRASS[6])
    # Bach (optional): kleiner Quelltümpel, gewundener 3-px-Lauf bis zur Kante
    fall_pts = []
    if stream:
        sx, sy, ex = stream[:3]
        x, y = ox + sx, oy + sy
        path = []
        while True:
            path.append((x, y))
            if not cap[int(y + 2.5), int(round(x))]:
                break
            y += 0.5
            x += (ox + ex - x) * 0.08 + 0.35 * math.sin(y * 0.5 + seed)
        smask = np.zeros((SH, SW), bool)
        for (px, py) in path:
            smask |= np.hypot(xx - px, yy - py) <= 1.3
        pond = np.hypot((xx - (ox + sx)) / 3.2, (yy - (oy + sy)) / 2.0) <= 1
        smask = (smask | pond) & cap & (dn < 1.02)
        edge = smask & ~ndimage.binary_erosion(smask)
        hl = smask & ~edge & (np.roll(smask, -1, 1) == 0) | (smask & ~edge & dither_mask(None, np.full((SH, SW), 0.18)))
        capimg[smask] = rgba(WATP[4])
        capimg[smask & ~edge & (np.roll(edge, 1, 1) | np.roll(edge, 1, 0))] = rgba(WATP[3])
        capimg[hl] = rgba(WATP[6])
        capimg[edge] = rgba(WATP[2])
        bank_ = ndimage.binary_dilation(smask) & ~smask & cap & (dn < 0.97)
        capimg[bank_ & ((yy - 0) > 0) & np.roll(smask, -1, 0)] = rgba(GRASS[1])
        fall_pts.append((int(round(path[-1][0])), int(path[-1][1]) + 2))
    # Felsen
    rockimg = np.zeros((SH, SW, 4), np.uint8)
    for (rx_, ry_, rr) in sorted(rocks, key=lambda t: t[1]):
        px, py = ox + rx_, oy + ry_
        d = np.hypot(xx - px, (yy - py) * 1.25)
        m = d <= rr
        lt = (xx - px) / rr * 0.5 - (yy - py) / rr * 0.85
        k = np.clip(np.round(2.6 + lt * 1.8 + (gn - 0.5)), 1, 5).astype(int)
        PK = np.array([rgba(c) for c in ROCKP], np.uint8)
        rockimg[m] = PK[k[m]]
        rim = m & ~ndimage.binary_erosion(m)
        rockimg[rim & (lt < 0.35)] = rgba(ROCKP[0])
    # --- Zusammensetzen: Erde, Wurzeln/Ranken, Kappe, Felsen, Bäume
    img = Image.fromarray(out)
    # Wurzeln (halbtransparent dunkel wie im Original)
    ra = np.zeros((SH, SW, 4), np.uint8)
    tips = []
    for (sx, sw, sl) in spikes:
        tx = int(round(sx))
        if 0 <= tx < SW and und[:, tx].any():
            tips.append((tx, int(np.where(und[:, tx])[0].max())))
    for (tx, ty) in r.sample(tips, min(roots, len(tips))):
        x, y = tx, ty
        for k in range(r.randint(3, 6)):
            y += 1
            if 0 <= y < SH and 0 <= x < SW and not und[y, x]:
                ra[y, x] = (8, 22, 6, 200)
            if k == 1 and r.random() < 0.5:
                x += r.choice([-1, 1])
                if 0 <= y < SH and 0 <= x < SW and not und[y, x]:
                    ra[y, x] = (8, 22, 6, 200)
    img.alpha_composite(Image.fromarray(ra))
    ci = Image.fromarray(capimg)
    img.alpha_composite(ci)
    # Ranken von der Kappe (3px: Umriss + Grün, wie im Original)
    va = np.array(img)
    for _ in range(vines):
        for _t in range(20):
            x = r.randrange(int(x0), int(x1) + 1)
            if cap[:, x].any():
                break
        y = capbot[x] + 1
        L = r.randint(4, 6 + depth // 3)
        for k in range(L):
            yk = y + k
            if yk >= SH - 1:
                break
            if k and k % 4 == 0 and r.random() < 0.5:
                x += r.choice([-1, 1])
            va[yk, x] = rgba(CANO[2 + (k % 3 == 0)] if k < L - 1 else CANO[4])
            for dx in (-1, 1):
                if va[yk, x + dx, 3] == 0 or not und[yk, x + dx]:
                    va[yk, x + dx] = rgba(OUT_V)
            if r.random() < 0.18:
                va[yk, x + r.choice([-1, 1])] = rgba(CANO[4])
        va[min(SH - 1, y + L), x] = rgba(OUT_V)
    img = Image.fromarray(va)
    img.alpha_composite(Image.fromarray(rockimg))
    # Ruine (optional): kleine Säulen
    if ruin:
        for (px_, py_, hh) in ruin:
            px, py = ox + px_, oy + py_
            d = ImageDraw.Draw(img)
            broken = hh < 8
            # Schatten auf dem Gras (nach links unten)
            d.line((px - 3, py + 1, px + 1, py + 1), fill=GRASS[1])
            # Säulenschaft: links Schatten, rechts Licht, Kanneluren
            d.rectangle((px - 1, py - hh, px + 2, py), fill=STONE[2])
            d.line((px, py - hh, px, py), fill=STONE[3])
            d.line((px + 1, py - hh, px + 1, py), fill=STONE[3])
            d.line((px + 2, py - hh, px + 2, py), fill=STONE[4])
            d.line((px - 1, py - hh, px - 1, py), fill=STONE[1])
            for yk in range(py - hh + 3, py, 4):
                d.point((px + 1, yk), fill=STONE[2])
            # Basis
            d.line((px - 2, py, px + 3, py), fill=STONE[1])
            d.point((px + 3, py), fill=STONE[3])
            if broken:
                d.point((px + 2, py - hh), fill=(0, 0, 0, 0))
                d.point((px - 1, py - hh), fill=STONE[2])
                d.point((px + 2, py - hh + 1), fill=STONE[3])
            else:
                d.rectangle((px - 2, py - hh - 2, px + 3, py - hh - 1), fill=STONE[3])
                d.line((px - 2, py - hh - 2, px + 3, py - hh - 2), fill=STONE[4])
                d.point((px - 2, py - hh - 1), fill=STONE[1])
            # Efeu
            ry = py - r.randint(1, max(2, hh // 2))
            d.point((px - 1, ry), fill=CANO[4]); d.point((px - 1, ry + 1), fill=CANO[3])
            d.point((px, ry + 2), fill=CANO[4])
    # Wasserfall am Rand der Kappe (optional)
    if stream and len(stream) > 3 and fall_pts:
        L = stream[3]
        fx, fy = fall_pts[0]
        a = np.array(img)
        for k in range(L):
            yk = fy + 1 + k
            if yk >= SH:
                break
            for dx, c in ((-2, 0), (-1, 3 + (k % 3 == 0)), (0, 5 if (k * 7) % 5 else 7), (1, 4), (2, 2)):
                a[yk, fx + dx] = rgba(WATP[c])
            if k < 2:
                a[yk, fx - 1:fx + 2] = rgba(WATP[9 - k])
            if k > 3 and r.random() < 0.25 + 0.4 * k / L:
                a[yk, fx + r.choice([-4, -3, 3, 4])] = rgba(WATP[8])
        for _ in range(8):
            a[min(SH - 1, fy + L + r.randint(-2, 1)), fx + r.randint(-3, 3)] = rgba(WATP[8] if r.random() < 0.5 else WATP[9])
        img = Image.fromarray(a)
    # Bäume: Krone aus mehreren Ballen (wie in island.png), Licht oben rechts, dunkler Umriss
    PC = np.array([rgba(c) for c in CANO], np.uint8)
    for (tx, ty, tr) in sorted(trees, key=lambda t: t[1]):
        px, py = ox + tx, oy + ty
        d = ImageDraw.Draw(img)
        th = max(2, tr // 2)
        d.rectangle((px - 1, py, px, py + th), fill=TRUNK[2])
        d.point((px - 1, py + th), fill=TRUNK[1])
        d.line((px + 1, py, px + 1, py + th), fill=TRUNK[0])
        d.line((px - 2, py, px - 2, py + th), fill=TRUNK[0])
        cyy = py - tr * 0.55
        rt = random.Random(int(px * 31 + py))
        ph1, ph2 = rt.uniform(0, 6), rt.uniform(0, 6)
        aa = np.arctan2(yy - cyy, xx - px)
        dd = np.hypot(xx - px, (yy - cyy) * 1.05)
        m = dd <= tr * (1 + 0.07 * np.sin(aa * 3 + ph1) + 0.05 * np.sin(aa * 5 + ph2))
        lt = (xx - px) / tr * 0.55 - (yy - cyy) / tr * 0.85
        tn = value_noise(SW, SH, 1, seed=int(px * 7 + py), octaves=1)
        base = 0.8 + lt * 0.42 + (tn - 0.5) * 0.28
        # Blattballen: hellere Kuppen mit dunkler Sichel unten links
        clumps = []
        for _ in range(3 if tr < 6 else 5):
            a_ = rt.uniform(-math.pi, math.pi)
            rr_ = rt.uniform(0.15, 0.55) * tr
            clumps.append((px + math.cos(a_) * rr_ + tr * 0.1, cyy + math.sin(a_) * rr_ - tr * 0.1, tr * rt.uniform(0.3, 0.42)))
        crescent = np.zeros((SH, SW), bool)
        for (bx, by, br) in sorted(clumps, key=lambda b: b[1]):
            db = np.hypot(xx - bx, yy - by)
            inb = db <= br
            lb = (xx - bx) * 0.5 - (yy - by) * 0.85
            base = np.where(inb, base + 0.12 + 0.1 * np.clip(lb / br, -1, 1), base)
            crescent |= (db > br) & (db <= br + 1) & (lb < -0.3 * br)
            crescent &= ~inb
        k = ordered(np.clip(base, 0, 1), len(CANO), 1, 0)
        k = np.where(crescent, np.maximum(k - 2, 0), k)
        a = np.array(img)
        a[m] = PC[k[m]]
        rim = m & ~ndimage.binary_erosion(m)
        a[rim] = rgba(OUT_G)
        img = Image.fromarray(a)
    return img, (ox, oy), fall_pts


# ---------------------------------------------------------------- Palette (aus den Area-Bildern)
SKYP = [(19, 73, 189), (23, 83, 203), (26, 93, 215), (31, 103, 224), (38, 114, 232), (45, 125, 239),
        (54, 136, 243), (76, 152, 246), (104, 170, 248), (138, 190, 250)]
CLOUD = [(100, 133, 200), (131, 163, 220), (152, 180, 227), (173, 196, 234), (203, 219, 245),
         (221, 232, 249), (237, 243, 252)]
CLOUDX = CLOUD + [(250, 252, 255)]
WAT = {'H': (8, 26, 90), 'F': (13, 35, 120), 'C': (19, 52, 164), 'B': (26, 72, 200), 'A': (35, 96, 226),
       'D': (47, 120, 243), 'E': (78, 147, 251), 'I': (128, 180, 255), 'G': (188, 217, 255),
       'J': (26, 58, 154), 'K': (230, 242, 255), 'L': (212, 232, 255)}
HAZE = (104, 170, 248)


def sea_pal(hz, lo=0, hi=7, col=HAZE):
    return [lerp(c, col, hz) for c in CLOUDX[lo:hi]]


def lighten(img, m, col, amt):
    a = np.array(img).astype(float)
    a[m, :3] = a[m, :3] * (1 - amt) + np.array(col) * amt
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


# ---------------------------------------------------------------- Himmel
SUN = (198, 58)
RAMP = SKYP + [(172, 208, 252), (208, 230, 255), (236, 246, 255)]
noise = value_noise(W, H, 16, seed=4)
dsun = np.hypot(XX - SUN[0], (YY - SUN[1]) * 1.05)
ang = np.arctan2(YY - SUN[1], XX - SUN[0])
v = YY / 250.0 * 8.2 + (noise - 0.5) * 1.1
v += 3.2 * np.exp(-(dsun / 62) ** 2) + 5.5 * np.exp(-(dsun / 20) ** 2)
ray = np.clip(np.sin(ang * 13 + 0.9) * 1.6 - 0.6, 0, 1) * ((ang > 1.3) & (ang < 3.1))
v += ray * 1.5 * np.clip(1 - dsun / 260, 0, 1) * np.clip(dsun / 30, 0, 1)
idx = np.clip(np.floor(v + BAYER4[YY % 4, XX % 4]), 0, len(RAMP) - 1).astype(int)
im = layer_from(idx, np.ones((H, W), bool), RAMP)

# Cirren: Büschel feiner, gestaffelter Schlieren (Pixel-Art-Stil wie die Striche im Spiel-Himmel)
def cirrus(img, cx, cy, n, span, seed, amt=0.4, slope=-0.12):
    r = random.Random(seed)
    a = np.array(img).astype(float)
    for k in range(n):
        y = int(cy + (k - n / 2) * 2 + r.randint(-1, 1))
        L = int(span * r.uniform(0.35, 1.0) * (1 - abs(k - n / 2) / (n * 0.9)))
        x0 = int(cx - L / 2 + r.randint(-span // 6, span // 6))
        for x in range(x0, x0 + L):
            yy_ = y + int(round((x - cx) * slope))
            if not (0 <= x < W and 0 <= yy_ < H):
                continue
            u = (x - x0) / max(1, L - 1)
            core = min(u, 1 - u) * 2
            if core < 0.12 and (x % 2):
                continue
            a_ = amt * (0.55 + 0.45 * core)
            col = (236, 246, 255) if core > 0.55 and k % 2 == 0 else (190, 222, 255)
            a[yy_, x, :3] = a[yy_, x, :3] * (1 - a_) + np.array(col) * a_
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


for (cx_, cy_, n_, sp_, sd_, am_, sl_) in [(214, 100, 3, 40, 3, 0.3, -0.08), (40, 108, 3, 36, 4, 0.26, -0.05)]:
    im = cirrus(im, cx_, cy_, n_, sp_, sd_, am_, sl_)


# Schäfchenwolken: Felder winziger, plastischer Wölkchen (Licht oben rechts), zum Rand hin ausdünnend
def mackerel(img, cx, cy, rw, rh, n, seed, hz):
    r = random.Random(seed)
    pal = sea_pal(hz, 1, 8)
    placed = []
    for _ in range(n * 4):
        if len(placed) >= n:
            break
        x = cx + r.gauss(0, rw); y = cy + r.gauss(0, rh)
        if any(abs(x - px) < 9 and abs(y - py) < 5 for px, py in placed):
            continue
        placed.append((x, y))
        fall_off = math.exp(-(((x - cx) / (rw * 1.3)) ** 2 + ((y - cy) / (rh * 1.3)) ** 2))
        k = r.randint(2, 3)
        circ = [(4 + j * 3.2 + r.uniform(-0.5, 0.5), 5 - (1.2 if j == 1 else 0), r.uniform(1.9, 2.8)) for j in range(k)]
        c = puff(8 + k * 3, 9, circ, pal, flat=6, seed=r.randint(0, 99), ox=int(x), oy=int(y))
        c = haze(c, HAZE, 0.08 + 0.5 * (1 - fall_off))
        comp(img, c, x - 4, y - 5)


mackerel(im, 62, 40, 22, 5, 11, 71, 0.35)
mackerel(im, 150, 124, 22, 4, 8, 72, 0.3)
mackerel(im, 128, 70, 14, 3, 5, 73, 0.4)

# Sonnenscheibe
dsun_c = np.hypot(XX - SUN[0], YY - SUN[1])
im = setc(im, dsun_c <= 7.3, (255, 240, 190))
im = setc(im, dsun_c <= 6.3, (255, 249, 222))
im = setc(im, dsun_c <= 4.4, (255, 255, 248))
# Lichtkreuz der Sonne (gedithert auslaufend)
fl = np.zeros((H, W))
for (dx_, dy_, L_) in [(1, 0, 26), (-1, 0, 26), (0, 1, 18), (0, -1, 18)]:
    for k in range(8, L_):
        x, y = SUN[0] + dx_ * k, SUN[1] + dy_ * k
        if 0 <= x < W and 0 <= y < H:
            fl[y, x] = 1 - k / L_
a_ = np.array(im).astype(float)
a_[..., :3] = a_[..., :3] * (1 - fl[..., None] * 0.75) + np.array([255, 250, 226]) * fl[..., None] * 0.75
im = Image.fromarray(a_.clip(0, 255).astype(np.uint8))

# ---------------------------------------------------------------- Sprites der Area
CB = A('clouds-back')
cb_lab, _ = ndimage.label(np.array(CB)[:75, :, 3] > 0, structure=np.ones((3, 3)))
PUFFS = [CB.crop((s_[1].start, s_[0].start, s_[1].stop, s_[0].stop)) for s_ in ndimage.find_objects(cb_lab)]
PUFFS.sort(key=lambda c: -c.width)
BANK = CB.crop((0, 76, 256, 100))
BIRD = A('bird')
BIRDS = [BIRD.crop((k * 11, 0, k * 11 + 11, 7)) for k in range(4)]
FLY = A('butterfly')
FLIES = [FLY.crop((k * 5, 0, k * 5 + 5, 4)) for k in range(2)]
ISLE = {n: A('isle-' + n) for n in 'abcde'}

# ---------------------------------------------------------------- ferne Quellwolken am Horizont
FARC = sea_pal(0.5, 0, 8)
comp(im, puff(90, 70, [(20, 48, 16), (40, 36, 20), (62, 44, 15), (78, 54, 11), (8, 58, 10), (50, 58, 14)],
              FARC, seed=31, oy=150), -16, 162)
comp(im, puff(96, 80, [(22, 56, 14), (44, 40, 19), (60, 26, 15), (72, 44, 17), (88, 56, 11), (34, 60, 13)],
              FARC, seed=32, oy=140), 176, 150)
comp(im, puff(70, 40, [(12, 26, 10), (30, 18, 13), (48, 24, 11), (62, 30, 8)], sea_pal(0.58, 0, 8), seed=33,
              oy=190), 70, 196)

# ---------------------------------------------------------------- ferne Schwebeinseln (Dunst)
ruin, _, _ = paint_islet(48, 15, 26, 41, trees=[(9, 5, 4), (40, 8, 3)], bushes=1, vines=3, flowers=0,
                         ruin=[(18, 8, 10), (25, 6, 13), (32, 9, 8)], stones=1)
comp(im, haze(ruin, HAZE, 0.58), 10, 50)
comp(im, haze(ISLE['c'], HAZE, 0.66), 98, 42)
far2, _, _ = paint_islet(22, 8, 13, 43, trees=[(7, 3, 3)], bushes=1, vines=1, flowers=0, stones=0, roots=2)
comp(im, haze(far2, HAZE, 0.62), 150, 74)
comp(im, haze(flip(ISLE['e']), HAZE, 0.6), 212, 94)

# kleine Himmelswolken (1x, Spiel-Sprites)
for (i, x, y, hz) in [(0, 6, 116, 0.05), (4, 150, 96, 0.12), (3, 58, 30, 0.25)]:
    comp(im, haze(PUFFS[i], HAZE, hz), x, y)

# ferne Vogelschwärme (kleine Möwen-Silhouetten, im Dunst)
dv = ImageDraw.Draw(im)
for (bx, by, n_, sd) in [(116, 80, 3, 1), (26, 152, 3, 2), (220, 146, 2, 3)]:
    rb = random.Random(sd)
    for k in range(n_):
        x, y = bx + k * 7 + rb.randint(-1, 1), by + rb.randint(-2, 2) + (k % 2) * 2
        c = (58, 92, 170)
        if rb.random() < 0.5:   # Flügel oben
            dv.point([(x - 2, y - 1), (x - 1, y), (x, y + 1), (x + 1, y), (x + 2, y - 1)], fill=c)
        else:                   # Flügel waagrecht
            dv.point([(x - 2, y + 1), (x - 1, y), (x, y + 1), (x + 1, y), (x + 2, y + 1)], fill=c)

# ---------------------------------------------------------------- Wolkenmeer hinten
comp(im, haze(BANK, HAZE, 0.3), -3, 228)


def draw_sea(rows):
    global im
    for (ty, sd, r0, r1, hz, lo, hi, amp, tw) in rows:
        pal = sea_pal(hz, lo, hi)
        PADY = 30
        lay = sea_layer(W, H - ty + PADY, sd, r0, r1, pal, amp=amp, oy=ty - PADY, towers=tw, pad=PADY,
                        rows=1 if r1 >= 18 else 2)
        comp(im, lay, 0, ty - PADY)


SEA = [(234, 5, 5, 9, 0.24, 0, 6, 3, ((196, 16, 5),))]
draw_sea(SEA)

# mittlere Schwebeinseln (leichter Dunst)
comp(im, haze(ISLE['a'], HAZE, 0.25), 8, 192)
comp(im, haze(flip(ISLE['b']), HAZE, 0.2), 216, 184)

# ---------------------------------------------------------------- Hauptinsel
IX, IY = 25, 106
island = A('island')
water = A('water').crop((0, 0, 200, 100))
sway = A('sway').crop((0, 0, 200, 100))
wa = np.array(water); wa[85:, :, 3] = 0; water = Image.fromarray(wa)

# Wasserfall verlängern (Palette/Struktur wie water.png), mit Schaumstufen und Gischtschleier
FALL_TOP = 85
FALL_END = 250 - IY
fh = FALL_END - FALL_TOP
fw = 36
X0 = 57 - 42                  # Ausschnitt beginnt bei Stück-x 42
fall = np.zeros((fh, fw, 4), np.uint8)
rf = random.Random(21)
INNER = ['A', 'B', 'B', 'D', 'E', 'A', 'B', 'I', 'D', 'C', 'A', 'B']
edges = []
for y_ in range(fh):
    g = y_ / fh
    xl = X0 - int(g * 2.99)
    xr = (69 - 42) + int(g * 2.99)
    edges.append((xl, xr))
    fall[y_, xl] = rgba(WAT['H'])
    fall[y_, xl + 1] = rgba(WAT['F'])
    fall[y_, xl + 2] = rgba(WAT['F'] if (y_ // 3) % 3 else WAT['C'])
    fall[y_, xr] = rgba(WAT['J'])
for x in range(fw):
    y_ = 0
    while y_ < fh:
        L = rf.randint(2, 7)
        c = rf.choice(INNER)
        for k in range(L):
            yk = y_ + k
            if yk < fh:
                xl, xr = edges[yk]
                if xl + 3 <= x <= xr - 1:
                    fall[yk, x] = rgba(WAT[c])
        y_ += L
# Schaumstufen (Luftwirbel reißen die Oberfläche auf)
for (fy0, th) in [(14, 2), (31, 3), (46, 2)]:
    for x in range(fw):
        for k in range(th + 2):
            yk = fy0 + k + (1 if (x * 5) % 7 < 2 else 0)
            if yk < fh and fall[yk, x, 3]:
                xl, xr = edges[yk]
                if xl + 1 <= x <= xr and (k < th or rf.random() < 0.4):
                    fall[yk, x] = rgba(WAT['K'] if (k == 0 or rf.random() < 0.4) else WAT['L'] if k < th else WAT['I'])
# nach unten in Dunst übergehen
fy_ = np.mgrid[0:fh, 0:fw][0]
hz_t = np.clip((fy_ - 8) / (fh - 8), 0, 1) ** 1.2 * 0.45
fa_ = fall.astype(float)
fa_[..., :3] = fa_[..., :3] * (1 - hz_t[..., None]) + np.array([150, 192, 246]) * hz_t[..., None]
fall = fa_.clip(0, 255).astype(np.uint8)
# Gischtschleier an den Kanten, nach unten breiter und dichter
for y_ in range(fh):
    xl, xr = edges[y_]
    g = y_ / fh
    for side, xe in ((-1, xl), (1, xr)):
        for k in range(1, 2 + int(g * 5)):
            p_ = (0.05 + 0.4 * g * g) * (1 - (k - 1) / (1 + g * 5))
            if rf.random() < p_:
                x = xe + side * k
                if 0 <= x < fw:
                    fall[y_, x] = rgba(WAT['L'] if rf.random() < 0.6 else WAT['K'])
fall_img = Image.fromarray(fall)
FX, FY = IX + 42, IY + FALL_TOP

comp(im, island, IX, IY)
comp(im, water, IX, IY)
comp(im, fall_img, FX, FY)
comp(im, sway, IX, IY)

# Glitzern auf dem Fluss, Tropfen am Überlauf
dd = ImageDraw.Draw(im)
for (gx, gy) in [(60, 10), (58, 30), (61, 46)]:
    x, y = IX + gx, IY + gy
    dd.point([(x - 1, y), (x + 1, y)], fill=(188, 217, 255))
    dd.point((x, y), fill=(255, 255, 255))
for (tx, ty) in [(57, 66), (70, 70), (56, 76), (71, 79)]:
    dd.point((IX + tx, IY + ty), fill=(188, 217, 255))

# ---------------------------------------------------------------- Wolkenmeer vorne
SEA2 = [
    (244, 7, 6, 11, 0.12, 0, 7, 3, ()),
    (260, 8, 8, 14, 0.05, 0, 7, 4, ((170, 20, 6),)),
    (282, 9, 10, 18, 0.0, 1, 8, 5, ((30, 24, 4),)),
    (312, 10, 15, 26, 0.0, 1, 8, 5, ((4, 30, 12), (246, 28, 10))),
]
draw_sea(SEA2[:1])

# Gischtwolke + Regenbogen, wo der Wasserfall in die Wolken stürzt
FCX = FX + (X0 + 69 - 42) // 2 + 1
SPL_Y = 240
RBW = [(232, 56, 58), (255, 154, 54), (255, 226, 74), (100, 214, 90), (91, 143, 255), (120, 96, 236), (170, 96, 226)]
rcx, rcy, rr0 = FCX + 20, SPL_Y + 26, 30
dr = np.hypot(XX - rcx, YY - rcy)
arc_t = np.clip((ang_ := np.arctan2(-(YY - rcy), XX - rcx)), 0, np.pi)
fade = np.clip(np.sin(arc_t) * 1.6 - 0.25, 0, 1) * (YY < rcy)
for i, c in enumerate(RBW):
    band = (dr >= rr0 - i - 0.5) & (dr < rr0 - i + 0.5)
    a_ = np.array(im).astype(float)
    f_ = np.where(band, np.clip(fade * 1.3 - 0.15, 0, 1) * 0.5, 0)[..., None]
    a_[..., :3] = a_[..., :3] * (1 - f_) + np.array(c) * f_
    im = Image.fromarray(a_.clip(0, 255).astype(np.uint8))
sp = puff(46, 26, [(10, 11, 7.5), (3, 17, 5), (34, 10, 8), (42, 16, 5), (22, 12.5, 7), (15, 18, 6), (29, 18, 6)],
          sea_pal(0.02, 1, 8), seed=3, oy=SPL_Y - 4)
comp(im, sp, FCX - 22, SPL_Y - 4)
dsp = ImageDraw.Draw(im)
rs = random.Random(8)
for _ in range(22):
    x = FCX + int(rs.gauss(0, 8)); y = SPL_Y - 2 - int(abs(rs.gauss(0, 7)))
    dsp.point((x, y), fill=WAT['K'] if rs.random() < 0.5 else WAT['L'])
draw_sea(SEA2[1:2])

# Insel mittlerer Tiefe links
mid, _, _ = paint_islet(54, 18, 26, 52, trees=[(10, 6, 5), (44, 8, 5)], rocks=[(33, 12, 2.5)], bushes=2, vines=4,
                        flowers=5, stones=1, ruin=[(22, 9, 9), (29, 7, 6)])
comp(im, haze(mid, HAZE, 0.12), 2, 238)
draw_sea(SEA2[2:3])

# ---------------------------------------------------------------- Vordergrund-Insel (rechts, angeschnitten)
fg, (fox, foy), fpts = paint_islet(110, 44, 50, 61, trees=[(12, 16, 7), (26, 7, 8), (44, 3, 7), (84, 5, 8),
                                                         (98, 14, 8), (90, 30, 7), (104, 26, 5)],
                                   rocks=[(62, 8, 4), (68, 11, 3.5), (57, 12, 3), (72, 6, 2.5)], bushes=6,
                                   vines=6, flowers=14, stream=(60, 16, 38, 34), stones=3, roots=4)
FGX, FGY = 146, 250
comp(im, fg, FGX, FGY)
draw_sea(SEA2[3:])

# ---------------------------------------------------------------- Schwalben (mittlere Tiefe)
for (k, x, y, fl) in [(0, 60, 86, False), (2, 78, 79, False), (0, 176, 94, True), (2, 132, 232, True),
                      (2, 52, 300, False), (0, 70, 292, False)]:
    b = BIRDS[k]
    comp(im, flip(b) if fl else b, x, y)

# ---------------------------------------------------------------- Licht: Sonnenbahnen über der ganzen Szene
ray2 = np.clip(np.sin(ang * 13 + 0.9) * 1.6 - 0.8, 0, 1) * ((ang > 1.45) & (ang < 2.9))
amt2 = ray2 * 0.13 * np.clip(1 - dsun / 330, 0, 1) * np.clip((dsun - 40) / 40, 0, 1)
# Wolkenmeer: sonnenseitig (rechts) wärmer/heller, links kühler
sea_zone = np.clip((YY - 236) / 20, 0, 1)
warm = sea_zone * np.clip((XX - 60) / 190, 0, 1) * 0.10
cool = sea_zone * np.clip((120 - XX) / 120, 0, 1) * 0.10
a_ = np.array(im).astype(float)
a_[..., :3] = a_[..., :3] * (1 - amt2[..., None]) + np.array([255, 250, 228]) * amt2[..., None]
a_[..., :3] = a_[..., :3] * (1 - warm[..., None]) + np.array([255, 246, 222]) * warm[..., None]
a_[..., :3] = a_[..., :3] * (1 - cool[..., None]) + np.array([70, 104, 196]) * cool[..., None]
im = Image.fromarray(a_.clip(0, 255).astype(np.uint8))

# ---------------------------------------------------------------- Rahmen
bevel_frame(im, (48, 30, 12), (255, 234, 160), (218, 168, 64), (146, 94, 30), (48, 30, 12), width=6)
dfr = ImageDraw.Draw(im)
dfr.rectangle((6, 6, W - 7, H - 7), outline=(22, 58, 146))
for (x, y) in [(3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)]:
    dfr.rectangle((x - 3, y - 3, x + 3, y + 3), fill=(48, 30, 12))
    dfr.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(255, 234, 160))
    dfr.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(44, 104, 206))
    dfr.point((x - 1, y - 1), fill=(188, 217, 255))
    dfr.point((x + 1, y + 1), fill=(22, 58, 146))

print(save(im, '11_floating_island'))
