# -*- coding: utf-8 -*-
"""Hilfsfunktionen für die Tarot-Karten XII, XIV, XV, XVI (Alleria, Tempeste, Baaliel, Champion).
Baut auf tlib auf; tlib selbst wird nicht verändert."""
from tlib import *

SCRATCH = '/tmp/claude-0/-home-user-PixelParties/9d74de49-e7fe-5a37-a71b-7b4fe2be906a/scratchpad/b4'


def zoom(path, box, name, s=4):
    """Ausschnitt (in 250x350-Koordinaten) eines fertigen 750x1050-Bildes vergrößert speichern"""
    os.makedirs(SCRATCH, exist_ok=True)
    im = Image.open(path).convert('RGB')
    x0, y0, x1, y1 = [v * 3 for v in box]
    c = im.crop((x0, y0, x1, y1))
    c.resize((c.width * s // 3 * 2, c.height * s // 3 * 2), Image.NEAREST).save(os.path.join(SCRATCH, name + '.png'))


# ------------------------------------------------------------ Linien
def bline(cv, x0, y0, x1, y1, c, k=1.0, clip=True):
    """1px-Linie (Bresenham-artig), mit Deckkraft k gemischt"""
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    last = None
    for i in range(n + 1):
        t = i / max(1, n)
        x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
        if (x, y) == last:
            continue
        last = (x, y)
        if clip and not in_art(x, y):
            continue
        if k >= 1:
            px(cv, x, y, c)
        else:
            blend_px(cv, x, y, c, k)


def pts_line(x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    out = []
    for i in range(n + 1):
        t = i / max(1, n)
        p = (int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t)))
        if not out or out[-1] != p:
            out.append(p)
    return out


def sag(p0, p1, amount, n=None):
    """durchhängender Faden zwischen p0 und p1 (Parabel, amount in px nach unten bzw. zur Mitte)"""
    x0, y0 = p0; x1, y1 = p1
    n = n or int(max(abs(x1 - x0), abs(y1 - y0))) + 2
    out = []
    for i in range(n + 1):
        t = i / n
        out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + amount * 4 * t * (1 - t)))
    return out


def polyline(cv, pts, c, k=1.0):
    for (a, b) in zip(pts[:-1], pts[1:]):
        bline(cv, a[0], a[1], b[0], b[1], c, k)


# ------------------------------------------------------------ Spinnennetz
def spider_web(cv, cx, cy, spokes, rings, col=(214, 226, 246), k=0.8, seed=0, dew=0.25,
               light=None, sagk=0.12, mask=None):
    """Radnetz: spokes = Liste (winkel_grad, länge); rings = Anzahl Spiralringe.
    light=(lx,ly): Netzfäden in Richtung Licht heller. Gibt Liste der Tautropfen-Positionen zurück."""
    rnd = random.Random(seed)
    ends = []
    for (a, L) in spokes:
        r = math.radians(a)
        ends.append((cx + math.cos(r) * L, cy + math.sin(r) * L))

    def shade(x, y):
        if light is None:
            return col
        d = math.hypot(x - light[0], y - light[1])
        t = max(0.0, min(1.0, 1 - d / 150))
        return lerp(lerp(col, (120, 136, 170), 0.35), (255, 255, 255), t)

    def draw(pts, kk):
        for (a, b) in zip(pts[:-1], pts[1:]):
            for (x, y) in pts_line(a[0], a[1], b[0], b[1]):
                if mask is not None and not mask(x, y):
                    continue
                if in_art(x, y):
                    blend_px(cv, x, y, shade(x, y), kk)
    # Speichen
    for (ex, ey) in ends:
        draw([(cx, cy), (ex, ey)], k)
    # Spirale (Fangfäden) – leicht zur Mitte durchhängend
    drops = []
    n = len(ends)
    for ri in range(1, rings + 1):
        f = (ri / (rings + 0.6)) ** 0.95
        for i in range(n):
            j = (i + 1) % n
            a = (cx + (ends[i][0] - cx) * f, cy + (ends[i][1] - cy) * f)
            b = (cx + (ends[j][0] - cx) * f, cy + (ends[j][1] - cy) * f)
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            # Durchhang Richtung Mitte + etwas nach unten (Schwerkraft)
            mx += (cx - mx) * sagk; my += (cy - my) * sagk + 0.6
            pts = [a, (mx, my), b]
            # glätten
            sm = []
            for t in np.linspace(0, 1, 8):
                x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0]
                y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]
                sm.append((x, y))
            if rnd.random() < 0.06 and ri > 2:
                continue        # gerissener Faden
            draw(sm, k * (0.75 + 0.25 * rnd.random()))
            if rnd.random() < dew:
                t = rnd.uniform(0.25, 0.75)
                drops.append((sm[int(t * 7)][0], sm[int(t * 7)][1]))
    # Nabe
    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)]:
        if in_art(cx + dx, cy + dy):
            blend_px(cv, cx + dx, cy + dy, col, 0.5)
    return ends, drops


def dew_drop(cv, x, y, big=False, sparkle_it=False):
    x, y = int(round(x)), int(round(y))
    if not in_art(x, y):
        return
    px(cv, x, y, (255, 255, 255))
    blend_px(cv, x, y + 1, (120, 170, 230), 0.8)
    if big:
        blend_px(cv, x + 1, y, (190, 220, 255), 0.8)
        blend_px(cv, x + 1, y + 1, (70, 110, 180), 0.8)
    if sparkle_it:
        for (dx, dy) in [(2, 0), (-2, 0), (0, 2), (0, -2)]:
            blend_px(cv, x + dx, y + dy, (220, 240, 255), 0.5)


# ------------------------------------------------------------ Blitze
def bolt_path(x0, y0, x1, y1, seed=0, jag=0.28, depth=6):
    """Zickzack-Pfad per Mittelpunkt-Verschiebung"""
    rnd = random.Random(seed)
    pts = [(x0, y0), (x1, y1)]
    disp = math.hypot(x1 - x0, y1 - y0) * jag
    for _ in range(depth):
        new = [pts[0]]
        for (a, b) in zip(pts[:-1], pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            o = rnd.uniform(-disp, disp)
            new += [(mx - dy / L * o, my + dx / L * o), b]
        pts = new
        disp *= 0.52
    return pts


def draw_bolt(cv, pts, core=(255, 255, 255), mid=(200, 230, 255), outer=(120, 150, 255), width=1,
              glow_col=None, glow_r=8, glow_k=0.5, clip=True):
    """Blitz: Glühen (gedithert) + äußere Farbe + weißer Kern"""
    P = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        P += pts_line(a[0], a[1], b[0], b[1])
    if glow_col is not None:
        # Glühen: Distanzfeld zum Pfad
        m = np.zeros((H, W), np.uint8)
        for (x, y) in P:
            if 0 <= x < W and 0 <= y < H:
                m[y, x] = 1
        d = cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 3)
        ys, xs = np.where(d < glow_r)
        for y, x in zip(ys, xs):
            if clip and not in_art(x, y):
                continue
            t = 1 - d[y, x] / glow_r
            if BAYER4[y % 4, x % 4] < t * t * glow_k * 2:
                blend_px(cv, x, y, glow_col, 0.45)
    for (x, y) in P:
        for dx in range(-width, width + 1):
            for dy in range(-width, width + 1):
                if abs(dx) + abs(dy) <= width + 0 and (not clip or in_art(x + dx, y + dy)):
                    px(cv, x + dx, y + dy, outer)
    for (x, y) in P:
        for dx in range(-(width - 1), width):
            for dy in range(-(width - 1), width):
                if abs(dx) + abs(dy) <= max(0, width - 1) and (not clip or in_art(x + dx, y + dy)):
                    px(cv, x + dx, y + dy, mid)
    for (x, y) in P:
        if not clip or in_art(x, y):
            px(cv, x, y, core)
    return P


def bolt(cv, x0, y0, x1, y1, seed=0, jag=0.28, branches=3, width=1, **kw):
    pts = bolt_path(x0, y0, x1, y1, seed, jag)
    rnd = random.Random(seed + 99)
    br = []
    for i in range(branches):
        j = rnd.randint(len(pts) // 5, len(pts) * 4 // 5)
        bx, by = pts[j]
        ang = math.atan2(y1 - y0, x1 - x0) + rnd.choice([-1, 1]) * rnd.uniform(0.35, 0.9)
        L = math.hypot(x1 - x0, y1 - y0) * rnd.uniform(0.18, 0.35)
        br.append(bolt_path(bx, by, bx + math.cos(ang) * L, by + math.sin(ang) * L, seed + i * 7 + 1, jag * 1.1, 5))
    for b in br:
        draw_bolt(cv, b, width=max(0, width - 1), **kw)
    return draw_bolt(cv, pts, width=width, **kw)


# ------------------------------------------------------------ Regen
def rain(cv, n, cols=((150, 170, 220), (190, 210, 245)), ang=0.25, L=(3, 6), seed=0, k=0.55, mask=None,
         x0=AX0, x1=AX1, y0=AY0, y1=AY1):
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.uniform(x0, x1); y = rnd.uniform(y0, y1)
        l = rnd.randint(*L)
        c = rnd.choice(cols)
        for i in range(l):
            X = int(round(x + ang * i)); Y = int(round(y + i))
            if in_art(X, Y) and (mask is None or mask(X, Y)):
                blend_px(cv, X, Y, c, k * (0.6 + 0.4 * i / l))


# ------------------------------------------------------------ Relief-Helfer
def relief_mask(cv, M, Hm, ramp, k=1.4, bias=0.0, blur=0.6, light=(-0.62, -0.62, 0.48)):
    relief(cv, Hm, np.zeros((H, W), np.int32), [ramp], M & (np.indices((H, W))[0] >= AY0) & (np.indices((H, W))[0] < AY1)
           & (np.indices((H, W))[1] >= AX0) & (np.indices((H, W))[1] < AX1), k=k, bias=bias, blur=blur, light=light)


def dome(M, p=4.0):
    d = cv2.distanceTransform(np.pad(M.astype(np.uint8), 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    return np.sqrt(np.minimum(d, p) / p) * p * 0.6


def mask_outline(cv, M, c=OUT, clip=True):
    """dunkler Umriss um eine Maske (4er-Nachbarschaft)"""
    g = M.copy()
    g[1:] |= M[:-1]; g[:-1] |= M[1:]; g[:, 1:] |= M[:, :-1]; g[:, :-1] |= M[:, 1:]
    ring = g & ~M
    for y, x in zip(*np.where(ring)):
        if not clip or in_art(x, y):
            px(cv, x, y, c)


def upright_details(rgba, fn):
    """Details auf einer RGBA-Figur zeichnen (fn(cv2_) mit Canvas der Größe W x H),
    nur auf deckenden Pixeln; gibt neues RGBA zurück"""
    c = Canvas(rgba.shape[1], rgba.shape[0])
    c.a[:] = rgba[..., :3]
    fn(c)
    out = rgba.copy()
    op = rgba[..., 3] > 0
    out[op, :3] = c.a[op]
    return out


def moon_disc(cv, cx, cy, r, ramp, craters=(), seed=3, bias=0.08, k=2.0, alb=0.18, halo=None, halo_r=10):
    """wie tlib.disc_relief, aber mit Albedo-Rauschen (Maria/Flecken) statt reinem Höhenrauschen,
    damit flache Stellen nicht als starres Punktraster erscheinen"""
    d = np.hypot(xx_ - cx, yy_ - cy)
    M = d <= r
    Hm = np.where(M, np.sqrt(np.maximum(0, r * r - d * d)) * 0.05, 0).astype(np.float32)
    for (ccx, ccy, cr) in craters:
        dd = np.hypot(xx_ - ccx, yy_ - ccy)
        Hm -= np.where(dd < cr, 0.9 * np.sqrt(np.maximum(0, 1 - (dd / cr) ** 2)), 0)
        Hm += np.where((dd >= cr) & (dd < cr + 2), 0.35, 0)
    A = (noise(H, W, 7, seed=seed, octaves=3) - 0.5) * alb * 2
    M &= (yy_ >= AY0) & (yy_ < AY1) & (xx_ >= AX0) & (xx_ < AX1)
    relief(cv, Hm, np.zeros((H, W), np.int32), [ramp], M, k=k, bias=bias, albedo=A)
    if halo is not None:
        for y in range(int(cy - r - halo_r), int(cy + r + halo_r) + 1):
            for x in range(int(cx - r - halo_r), int(cx + r + halo_r) + 1):
                dd = math.hypot(x - cx, y - cy)
                if r < dd < r + halo_r and in_art(x, y) and BAYER4[y % 4, x % 4] < (1 - (dd - r) / halo_r) * 0.55:
                    blend_px(cv, x, y, halo, 0.3)
    return M


yy_, xx_ = np.indices((H, W))


def vignette2(cv, color=(10, 6, 16), strength=0.5, r0=0.55, protect=None):
    """wie tlib.vignette, aber ohne das starre Punktraster knapp über der Schwelle;
    protect(x, y) -> True: Pixel auslassen (z.B. Mond)"""
    cx = (AX0 + AX1) / 2; cy = (AY0 + AY1) / 2
    for y in range(AY0, AY1):
        for x in range(AX0, AX1):
            d = math.hypot((x - cx) / ((AX1 - AX0) / 2), (y - cy) / ((AY1 - AY0) / 2))
            t = (d - r0) / (1.42 - r0)
            if t > 0 and BAYER4[y % 4, x % 4] + 0.04 < t * strength:
                if protect is not None and protect(x, y):
                    continue
                blend_px(cv, x, y, color, 0.45)


def anime_eye2(cv, x0, y0, iris, w=6, h=9, flip=False, lash=(20, 10, 30), white=(246, 246, 252), pupil=None):
    """großes Anime-Auge: dicke Wimpernlinie, Iris-Verlauf (dunkel oben -> hell unten), Pupille, zwei Glanzpunkte.
    x0, y0 = linke obere Ecke (Wimpernlinie)"""
    I = hair_ramp(iris)
    pupil = pupil or tuple(int(v * 0.25) for v in iris)
    for j in range(h):
        for i in range(w):
            ii = (w - 1 - i) if flip else i
            X, Y = x0 + ii, y0 + j
            if j == 0 or (j == 1 and i >= 1):
                px(cv, X, Y, lash)
                continue
            if j == 1:
                px(cv, X, Y, white)
                continue
            if j == h - 1:
                if 1 <= i <= w - 2:
                    px(cv, X, Y, I[1] if i not in (1, w - 2) else lash)
                continue
            if i == 0:
                px(cv, X, Y, white if j < h - 2 else I[2])
                continue
            t = (j - 2) / max(1, h - 4)
            col = I[1] if t < 0.3 else I[2] if t < 0.62 else I[3]
            if j >= h - 3 and 2 <= i <= w - 2:
                col = I[4] if (i + j) % 2 == 0 else I[3]
            if 2 <= i <= w - 2 and 3 <= j <= 4 + (h - 8):
                col = pupil
            px(cv, X, Y, col)
    # Glanzpunkte
    gx = x0 + (w - 3 if flip else 1)
    px(cv, gx, y0 + 2, (255, 255, 255)); px(cv, gx + (-1 if flip else 1), y0 + 2, (255, 255, 255))
    px(cv, gx, y0 + 3, (255, 255, 255))
    px(cv, x0 + (1 if flip else w - 2), y0 + h - 3, (255, 255, 255))
    # Wimpernschwung außen
    ox = x0 - 1 if not flip else x0 + w
    px(cv, ox, y0, lash); px(cv, ox + (-1 if not flip else 1), y0 - 1, lash)


def glow2(cv, cx, cy, r, color, k=0.35, rx=1.0, ry=1.0, mix=0.35, clip=True):
    """wie tlib.glow, aber ohne starres Punktraster am Rand (Schwelle leicht versetzt)"""
    for y in range(int(cy - r / ry) - 1, int(cy + r / ry) + 2):
        for x in range(int(cx - r / rx) - 1, int(cx + r / rx) + 2):
            if clip and not in_art(x, y):
                continue
            d = math.hypot((x - cx) * rx, (y - cy) * ry)
            if d < r and BAYER4[y % 4, x % 4] + 0.03 < (1 - d / r) * k * 2:
                blend_px(cv, x, y, color, mix)


def rays2(cv, cx, cy, n, r0, r1, color, width=0.12, k=0.5, phase=0.0, mix=0.4):
    """wie tlib.rays, ohne Punktraster"""
    for y in range(AY0, AY1):
        for x in range(AX0, AX1):
            d = math.hypot(x - cx, y - cy)
            if r0 < d < r1:
                a = math.atan2(y - cy, x - cx) + phase
                s = abs(math.sin(a * n / 2))
                if s < width * 4:
                    t = (1 - (d - r0) / (r1 - r0)) * (1 - s / (width * 4))
                    if BAYER4[y % 4, x % 4] + 0.03 < t * k * 2:
                        blend_px(cv, x, y, color, mix)
