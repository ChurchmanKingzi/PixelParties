# -*- coding: utf-8 -*-
"""Hilfsfunktionen für die Karten VIII–XI (Thorad, Koperniko, Willy, Madame Guillotine).
Baut auf tlib auf; tlib selbst bleibt unverändert."""
from tlib import *

SCR = '/tmp/claude-0/-home-user-PixelParties/9d74de49-e7fe-5a37-a71b-7b4fe2be906a/scratchpad/'


def arc(cv, cx, cy, rx, ry, a0, a1, c, n=40):
    """Ellipsenbogen (Winkel im Bogenmaß)"""
    for t in np.linspace(a0, a1, n):
        px(cv, cx + math.cos(t) * rx, cy + math.sin(t) * ry, c)


def recolor(rgba, mask, src, dst):
    """Pixel in mask, deren Farbe in Rampe src liegt, auf die gleiche Stufe in dst umfärben
    (z.B. Tigerstreifen über das bereits schattierte Fell legen)."""
    lut = {tuple(c): dst[min(len(dst) - 1, int(round(i * (len(dst) - 1) / max(1, len(src) - 1))))]
           for i, c in enumerate(src)}
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        k = tuple(int(v) for v in rgba[y, x, :3])
        if k in lut:
            rgba[y, x, :3] = lut[k]


def shift_ramp(rgba, mask, ramp, d):
    """Stufe innerhalb einer Rampe verschieben (d<0 dunkler) – für aufgemalte Schatten"""
    idx = {tuple(c): i for i, c in enumerate(ramp)}
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        k = tuple(int(v) for v in rgba[y, x, :3])
        if k in idx:
            rgba[y, x, :3] = ramp[max(0, min(len(ramp) - 1, idx[k] + d))]


def zoom(path, box, scale=3, name='zoom'):
    """Ausschnitt (in 250er-Koordinaten) vergrößert ins Scratchpad speichern"""
    im = Image.open(path).convert('RGB')
    x0, y0, x1, y1 = [v * 3 for v in box]
    c = im.crop((x0, y0, x1, y1))
    c = c.resize((c.width * scale // 3, c.height * scale // 3), Image.NEAREST)
    p = SCR + name + '.png'
    c.save(p)
    return p


def disc(cv, cx, cy, r, ramp, light=(-0.6, -0.7), rim=None, mask_fn=None):
    """kleine geditherte Kugel/Scheibe (Münzen, Blüten, Perlen)"""
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                if mask_fn is not None and not mask_fn(x, y):
                    continue
                v = 0.62 - ((x - cx) * light[0] + (y - cy) * light[1]) / max(1, r) * -0.45 - (d / max(r, 1)) ** 2 * 0.3
                c = rampc(ramp, v, x, y)
                if rim is not None and d > r - 1:
                    c = rim
                px(cv, x, y, c)


def small_flower(cv, x, y, petal, center=(255, 220, 90), dark=None):
    """5-Pixel-Blüte (Kreuz) mit Mitte"""
    dark = dark or lerp(petal, (0, 0, 0), 0.4)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        px(cv, x + dx, y + dy, petal if dy <= 0 and dx <= 0 else dark)
    px(cv, x, y, center)


def bloom(cv, x, y, petal, center=(255, 214, 80)):
    """größere Blüte (4x4, gerundet) mit Licht oben links"""
    lt = lerp(petal, (255, 255, 255), 0.45); dk = lerp(petal, (0, 0, 0), 0.35)
    rows = [".aab.", "aaCbb", "aCccd", "bbcdd", ".ddd."]
    cols = {'a': lt, 'b': petal, 'c': center, 'C': lerp(center, (255, 255, 255), 0.5), 'd': dk}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in cols:
                px(cv, x - 2 + i, y - 2 + j, cols[ch])


def garland(cv, pts, seed=0, cols=None, leaf=((30, 90, 40), (60, 140, 60)), step=3.2, mask=None, big=False):
    """Blumengirlande entlang einer Catmull-Rom-Kurve: Blattranke + Blüten im Wechsel"""
    rnd = random.Random(seed)
    cols = cols or [(250, 120, 150), (255, 255, 255), (255, 210, 80), (240, 90, 90), (190, 140, 250)]
    P = np.array(pts, float)
    P = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in np.linspace(0, 1, 40, endpoint=False):
            s2, s3 = s * s, s * s * s
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3))
    out.append(P[-2])
    acc = 0.0; last = out[0]
    for i, p in enumerate(out):
        acc += math.hypot(*(p - last)); last = p
        ok = mask is None or mask(int(p[0]), int(p[1]))
        if not ok:
            continue
        px(cv, p[0], p[1], leaf[0])
        px(cv, p[0], p[1] - 1, leaf[1])
        if big:
            px(cv, p[0], p[1] + 1, OUT)
        if acc >= step:
            acc = 0
            c = rnd.choice(cols)
            if big:
                if rnd.random() < 0.3:
                    for (dx, dy, cc) in [(1, -1, leaf[1]), (2, -2, leaf[1]), (2, -1, leaf[0]), (-1, 1, leaf[0]), (-2, 1, leaf[1])]:
                        px(cv, p[0] + dx, p[1] + dy, cc)
                else:
                    bloom(cv, int(p[0]), int(p[1]) - 1, c)
                continue
            ox, oy = rnd.choice([(0, 0), (1, 0), (0, 1), (-1, 0)])
            if rnd.random() < 0.25:
                px(cv, p[0] + ox + 1, p[1] + oy + 1, leaf[1]); px(cv, p[0] + ox + 2, p[1] + oy, leaf[0])
            else:
                small_flower(cv, int(p[0]) + ox, int(p[1]) + oy, c)


def lemniscate(cv, cx, cy, a, th=1.6, ramp=GOLD, glow_col=(255, 240, 180)):
    """liegende Acht (Unendlichkeitszeichen) als goldenes, schattiertes Band"""
    pts = []
    for t in np.linspace(0, 2 * math.pi, 400):
        d = 1 + math.sin(t) ** 2
        pts.append((cx + a * math.cos(t) / d, cy + a * math.sin(t) * math.cos(t) / d * 1.25))
    glow(cv, cx, cy, a * 1.6, glow_col, k=0.4, mix=0.35, ry=1.8)
    M = np.zeros((H, W), np.uint8)
    for (x, y) in pts:
        cv2.circle(M, (int(round(x)), int(round(y))), int(th), 1, -1)
    ys, xs = np.where(M > 0)
    # Umriss
    ring = cv2.dilate(M, np.ones((3, 3), np.uint8)) - M
    for y, x in zip(*np.where(ring > 0)):
        px(cv, x, y, ramp[0])
    for y, x in zip(ys, xs):
        v = 0.75 - (y - cy) / (a * 0.5) * 0.25
        px(cv, x, y, rampc(ramp, v, x, y))
    return pts


def text_tiny(cv, x, y, rows, cols):
    """Mini-Pixelgrafik aus Zeichenreihen (wie tlib._stamp, aber öffentlich)"""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in cols:
                px(cv, x + i, y + j, cols[ch])


def taper(M, pts, w0, w1=0.6, steps=50):
    """verjüngten Pinselstrich (Catmull-Rom) in eine bool-Maske M malen – z.B. Tigerstreifen"""
    P = np.array(pts, float)
    P = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in np.linspace(0, 1, steps, endpoint=False):
            s2, s3 = s * s, s * s * s
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3))
    out.append(P[-2])
    n = len(out)
    m = np.zeros(M.shape, np.uint8)
    for i, (x, y) in enumerate(out):
        r = (w0 + (w1 - w0) * i / max(1, n - 1)) / 2
        if r < 0.75:
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < M.shape[0] and 0 <= xi < M.shape[1]:
                m[yi, xi] = 1
        else:
            cv2.circle(m, (int(round(x)), int(round(y))), int(round(r)), 1, -1)
    M |= m.astype(bool)
    return M
