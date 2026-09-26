# -*- coding: utf-8 -*-
"""Hilfsfunktionen für die Karten 0–III (Narr, Magier, Hohepriesterin, Herrscherin).
Baut nur auf tlib auf und verändert sie nicht."""
from tlib import *


def poly_mask(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts, float)).astype(np.int32)], 1)
    return m.astype(bool)


def ellipse_mask(cx, cy, rx, ry):
    yy, xx = np.indices((H, W))
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def art_mask():
    m = np.zeros((H, W), bool)
    m[AY0:AY1, AX0:AX1] = True
    return m


def pillow_relief(cv, mask, ramp, pillow=4.0, k=1.6, bias=0.05, noise_k=0.0, nscale=3, seed=0, extra=None):
    """Maske als Kissen-Relief schattieren (Distanzfeld als Höhe) – für Steine, Wolken, Blätter."""
    mm = mask.astype(np.uint8)
    d = cv2.distanceTransform(np.pad(mm, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    hgt = np.sqrt(np.minimum(d, pillow) / pillow) * pillow * 0.6
    if noise_k:
        hgt = hgt + (noise(H, W, nscale, seed=seed) - 0.5) * noise_k
    if extra is not None:
        hgt = hgt + extra
    relief(cv, hgt, np.zeros((H, W), np.int32), [ramp], mask & art_mask(), k=k, bias=bias)


def outline_mask(cv, mask, col=OUT, diag=False):
    """1px Außenkontur um eine Maske zeichnen"""
    g = mask.copy()
    g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
    if diag:
        g[1:, 1:] |= mask[:-1, :-1]; g[:-1, :-1] |= mask[1:, 1:]; g[1:, :-1] |= mask[:-1, 1:]; g[:-1, 1:] |= mask[1:, :-1]
    ring = g & ~mask & art_mask()
    cv.a[ring] = col
    return ring


def mountains(cv, peaks, base, rock, snow=None, snow_depth=18, seed=0, x0=AX0, x1=AX1, ridge_k=0.9, haze=None, haze_k=0.0):
    """Gebirgskette als Relief: peaks = [(x, y_spitze, halbe_breite)], base = unterer Rand.
    Linke Flanken hell, rechte dunkel (Licht von links oben); Schneekappen bis snow_depth unter der Spitze."""
    yy, xx = np.indices((H, W)).astype(np.float32)
    top = np.full(W, 1e9, np.float32)
    nz = noise(1, W + 4, 6, seed=seed)[0]
    for x in range(x0, x1):
        for (px_, py_, hw) in peaks:
            t = abs(x - px_) / hw
            y = py_ + t * hw * 0.9 + (nz[x] - 0.5) * 6 * min(1, t * 3)
            top[x] = min(top[x], y)
    M = np.zeros((H, W), bool)
    Hm = np.zeros((H, W), np.float32)
    mat = np.zeros((H, W), np.int32)
    fn = noise(H, W, 5, seed=seed + 7)
    for x in range(x0, x1):
        ty = int(top[x])
        if ty >= base:
            continue
        # nächste Spitze -> Flankenseite
        best = min(peaks, key=lambda p: abs(x - p[0]) + (p[1] - top[x]) * 0.2)
        side = 1.0 if x > best[0] else -1.0
        for y in range(max(ty, AY0), base):
            M[y, x] = True
            # Grate: Höhe fällt zur Seite ab, Rinnen durch Rauschen
            dxp = (x - best[0])
            Hm[y, x] = -abs(dxp) * 0.35 + (fn[y, x] - 0.5) * 3 * ridge_k + math.sin(dxp * 0.5 + y * 0.25) * 0.4 * ridge_k
            if snow is not None and y < best[1] + snow_depth + (fn[y, x] - 0.5) * 10 - abs(dxp) * 0.15:
                mat[y, x] = 1
    ramps = [rock] + ([snow] if snow is not None else [])
    relief(cv, Hm, mat, ramps, M, k=1.6, bias=0.0)
    if haze is not None and haze_k > 0:
        for y, x in zip(*np.where(M)):
            t = (y - top[x]) / max(1, base - top[x])
            if BAYER4[y % 4, x % 4] < haze_k * (0.3 + t):
                blend_px(cv, x, y, haze, 0.5)
    return top, M


def glyph(cv, txt, size, cx, cy, ramp, outline=OUT, shadow=None, font=None):
    """dickes Zeichen (z.B. '?') als Relief mit Kontur"""
    m = text_mask(txt, size)
    mh, mw = m.shape
    x0 = int(cx - mw / 2); y0 = int(cy - mh / 2)
    M = np.zeros((H, W), bool)
    M[y0:y0 + mh, x0:x0 + mw] = m
    if shadow is not None:
        S = np.roll(np.roll(M, 2, 0), 2, 1)
        for y, x in zip(*np.where(S & ~M)):
            blend_px(cv, x, y, shadow, 0.45)
    d = cv2.distanceTransform(np.pad(M.astype(np.uint8), 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    relief(cv, np.minimum(d, 3).astype(np.float32), np.zeros((H, W), np.int32), [ramp], M, k=1.3, bias=0.15, blur=0.5)
    if outline is not None:
        outline_mask(cv, M, outline)
    return M


def arc_px(cv, cx, cy, rx, ry, a0, a1, c, n=40):
    for t in np.linspace(a0, a1, n):
        px(cv, cx + math.cos(t) * rx, cy + math.sin(t) * ry, c)


def grass_tufts(cv, n, x0, x1, y0, y1, ramp, seed=0, mask=None, hmin=2, hmax=5):
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randint(x0, x1 - 1); y = rnd.randint(y0, y1 - 1)
        if mask is not None and not mask[y, x]:
            continue
        hh = rnd.randint(hmin, hmax)
        lean = rnd.choice((-1, 0, 1))
        for k in range(hh):
            xx = x + (lean if k > hh // 2 else 0)
            if in_art(xx, y - k):
                px(cv, xx, y - k, ramp[-1] if k == hh - 1 else ramp[-2])


def small_flower(cv, x, y, petal, center=(255, 220, 90)):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        px(cv, x + dx, y + dy, petal)
    px(cv, x, y, center)


def star_px(cv, x, y, c, r=3, c2=None):
    """Stern mit diagonalen Zacken"""
    sparkle(cv, x, y, c, r, c2)
    if r >= 3:
        for k in (1,):
            px(cv, x + k, y + k, c2 or c); px(cv, x - k, y - k, c2 or c)
            px(cv, x + k, y - k, c2 or c); px(cv, x - k, y + k, c2 or c)


def facet_rock(cv, mask, ramp, n=30, seed=0, light=(-0.7, -0.5), bias=0.0, crack=None, shade_x=None):
    """Fels aus Facetten (Voronoi): jede Zelle hat eine eigene Neigung -> kantiger Stein, dunkle Fugen dazwischen"""
    rnd = random.Random(seed)
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return
    idx = [rnd.randrange(len(ys)) for _ in range(n)]
    pts = np.array([(xs[i], ys[i]) for i in idx], float)
    normals = []
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi); s = rnd.uniform(0.2, 0.9)
        normals.append((math.cos(a) * s, math.sin(a) * s))
    d = np.full(mask.shape, 1e9); d2 = np.full(mask.shape, 1e9); lab = np.zeros(mask.shape, np.int32)
    yy, xx = np.indices(mask.shape)
    for i, (px_, py_) in enumerate(pts):
        dd = np.hypot(xx - px_, (yy - py_) * 1.3)
        closer = dd < d
        d2 = np.where(closer, d, np.minimum(d2, dd))
        lab = np.where(closer, i, lab)
        d = np.where(closer, dd, d)
    L = np.array(light, float)
    for y, x in zip(ys, xs):
        nx, ny = normals[lab[y, x]]
        v = 0.55 + (nx * L[0] + ny * L[1]) * 0.45 + bias
        if shade_x is not None:
            v += shade_x(x, y)
        if d2[y, x] - d[y, x] < 1.2:
            c = crack or ramp[0]
            px(cv, x, y, c)
        else:
            px(cv, x, y, rampc(ramp, v, x, y))


def shift_layer(cv, bg, dx, dy=0):
    """alles, was seit bg (Kopie von cv.a) gezeichnet wurde, um dx/dy verschieben (nur im Bildfeld)"""
    fg = cv.a.copy()
    m = np.any(fg != bg, axis=2)
    cv.a[:] = bg
    ys, xs = np.where(m)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if in_art(X, Y):
            cv.a[Y, X] = fg[y, x]


def big_eye(cv, x, y, iris, w=6, h=8, flip=False, lash=OUT, white=(250, 250, 255), glow_=False):
    """größeres Anime-Auge: dicke Wimpernlinie, Iris-Verlauf, Pupille, zwei Glanzpunkte.
    x,y = linke obere Ecke; flip spiegelt (rechtes Auge)."""
    I = hair_ramp(iris)
    def P(i, j, c):
        ii = w - 1 - i if flip else i
        px(cv, x + ii, y + j, c)
    for i in range(-1, w + 1):
        P(i, 0, lash)
    P(w, -1, lash)                       # Wimpernschwung außen
    for i in range(w):
        P(i, 1, lash if i in (0, w - 1) else I[0])
    for j in range(2, h):
        t = (j - 2) / max(1, h - 3)
        for i in range(w):
            if i == 0:
                c = white if j < h - 1 else I[1]
            else:
                c = I[1] if t < 0.3 else (I[2] if t < 0.65 else I[3])
                if glow_ and t > 0.6:
                    c = I[4]
            P(i, j, c)
    # Pupille
    for j in range(3, h - 2):
        P(w // 2, j, I[0])
        if w >= 6:
            P(w // 2 - 1, j, I[0]) if j < h - 3 else None
    # Glanz
    P(w - 2, 2, (255, 255, 255)); P(w - 2, 3, (255, 255, 255)); P(w - 3, 2, (255, 255, 255))
    P(1, h - 2, lerp(I[4], (255, 255, 255), 0.5))
    # Unterlid
    for i in range(1, w - 1):
        P(i, h, lerp(lash, (200, 120, 100), 0.6)) if i % 2 else None


def tree_canopy(cv, cx, cy, w, h, ramp, seed=0, n=None, clip=True):
    """Baumkrone aus vielen kleinen Laubbüscheln (jeder Büschel eigenes Kissen-Relief, dunkle Lücken)"""
    rnd = random.Random(seed)
    n = n or max(6, int(w * h / 40))
    yy, xx = np.indices((H, W))
    blobs = []
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi); r = math.sqrt(rnd.random())
        bx = cx + math.cos(a) * r * w / 2; by = cy + math.sin(a) * r * h / 2
        br = rnd.uniform(3.5, 6.5) * (w / 30) ** 0.3
        blobs.append((by, bx, br))
    blobs.sort()                                  # hinten (oben) zuerst
    M_all = np.zeros((H, W), bool)
    for (by, bx, br) in blobs:
        m = np.hypot(xx - bx, (yy - by) * 1.15) <= br
        if clip:
            m &= art_mask()
        if not m.any():
            continue
        d = np.hypot(xx - bx + br * 0.35, (yy - by + br * 0.35) * 1.15)
        ys, xs = np.where(m)
        shade = 0.15 + 0.6 * (1 - (by - (cy - h / 2)) / h) * 0.5
        for y, x in zip(ys, xs):
            v = 0.95 - d[y, x] / (br * 1.5) + shade * 0.4
            px(cv, x, y, rampc(ramp, v, x, y))
        ring = np.hypot(xx - bx, (yy - by) * 1.15)
        edge = (ring > br - 1) & m & (yy > by)
        cv.a[edge] = ramp[0]
        M_all |= m
    return M_all
