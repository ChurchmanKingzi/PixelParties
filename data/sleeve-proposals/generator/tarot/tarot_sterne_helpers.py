# -*- coding: utf-8 -*-
"""Hilfsfunktionen für XVII (Stern), XVIII (Mond), XX (Gericht) und XXI (Welt).
Baut nur auf tlib auf; tlib selbst bleibt unverändert."""
from tlib import *

STAR_RAMP = [(150, 110, 60), (230, 190, 90), (255, 232, 140), (255, 248, 206), (255, 255, 246)]


def star_poly(cx, cy, r_main, r_diag, r_in, rot=0.0, n=8):
    """Eckpunkte eines n-zackigen Sterns (abwechselnd lange/kurze Zacken)"""
    pts = []
    for i in range(n * 2):
        a = rot - math.pi / 2 + i * math.pi / n
        if i % 2 == 0:
            r = r_main if (i // 2) % 2 == 0 else r_diag
        else:
            r = r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def star8(cv, cx, cy, r_main, r_diag=None, r_in=None, ramp=STAR_RAMP, edge=None, glow_r=None,
          glow_col=(255, 240, 200), glow_k=0.5, rot=0.0, n=8, facet=True):
    """großer Zackenstern mit Facetten-Schattierung (Licht von links oben), gedithertem Hof"""
    r_diag = r_diag or r_main * 0.62
    r_in = r_in or r_main * 0.3
    if glow_r:
        glow(cv, cx, cy, glow_r, glow_col, k=glow_k, mix=0.35)
    pts = star_poly(cx, cy, r_main, r_diag, r_in, rot, n)
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
    ys, xs = np.where(m > 0)
    for y, x in zip(ys, xs):
        if not in_art(x, y):
            continue
        d = math.hypot(x - cx, y - cy) / r_main
        v = 1.0 - d * 0.75
        if facet:
            # jede Zacke hat eine helle und eine dunkle Hälfte (Grat in der Mitte)
            a = (math.atan2(y - cy, x - cx) - rot + math.pi / 2) % (2 * math.pi / n)
            half = a < math.pi / n
            v += 0.12 if half else -0.14
        px(cv, x, y, rampc(ramp, v, x, y))
    if edge is not None:
        e = m.astype(bool)
        ring = np.zeros_like(e)
        ring[1:] |= e[:-1]; ring[:-1] |= e[1:]; ring[:, 1:] |= e[:, :-1]; ring[:, :-1] |= e[:, 1:]
        ring &= ~e
        for y, x in zip(*np.where(ring)):
            if in_art(x, y):
                px(cv, x, y, edge)
    px(cv, cx, cy, ramp[-1])
    return m


def twinkle(cv, x, y, c, r=3, c2=None, diag=True):
    """vierzackiges Funkeln, optional mit kurzen Diagonalen"""
    sparkle(cv, x, y, c, r=r, c2=c2)
    if diag and r >= 3:
        for k in (1,):
            for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                blend_px(cv, x + dx * k, y + dy * k, c, 0.55)


def glitter(cv, n, box, seed=0, cols=None, mask=None):
    """Glitzer: winzige Kreuze und Punkte"""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = box
    cols = cols or [(255, 255, 255), (255, 240, 200), (220, 230, 255), (255, 210, 240)]
    for _ in range(n):
        x = rnd.randint(x0, x1 - 1); y = rnd.randint(y0, y1 - 1)
        if mask is not None and not mask[y, x]:
            continue
        c = rnd.choice(cols)
        r = rnd.random()
        if r < 0.12:
            sparkle(cv, x, y, c, r=2, c2=lerp(c, tuple(cv.a[y, x]), 0.5))
        elif r < 0.4:
            sparkle(cv, x, y, c, r=1, c2=lerp(c, tuple(cv.a[y, x]), 0.4))
        else:
            px(cv, x, y, c)


def music_note(cv, x, y, c, c2, double=False):
    """kleine Achtelnote (x,y = Notenkopf links oben)"""
    for (dx, dy) in [(0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (0, 2), (1, 2)]:
        px(cv, x + dx, y + dy, c)
    for k in range(1, 7):
        px(cv, x + 2, y - k, c)
    px(cv, x + 3, y - 6, c); px(cv, x + 4, y - 5, c); px(cv, x + 4, y - 4, c2)
    px(cv, x, y + 1, c2)
    if double:
        for (dx, dy) in [(5, 1), (6, 0), (6, 1), (7, 0), (7, 1), (5, 2), (6, 2)]:
            px(cv, x + dx, y - 1 + dy, c)
        for k in range(1, 8):
            px(cv, x + 7, y - 1 - k, c)
        for i in range(2, 8):
            px(cv, x + i, y - 7 - (i - 2) // 3, c)


def bezier(p0, p1, p2, n=60):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]


def stream(cv, pts, w0, w1, ramp, seed=0, sparkles=True):
    """Wasserstrahl entlang Punkten (hell in der Mitte, gedithert zum Rand)"""
    rnd = random.Random(seed)
    n = len(pts)
    for i in range(n - 1):
        x0, y0 = pts[i]; x1, y1 = pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        w = w0 + (w1 - w0) * i / (n - 1)
        for t in np.linspace(-w, w, int(w * 4) + 3):
            x = x0 + nx * t; y = y0 + ny * t
            e = abs(t) / (w + 0.01)
            v = 0.92 - e * 0.75 + 0.05 * math.sin(i * 0.5)
            px(cv, x, y, rampc(ramp, v, x, y))
    if sparkles:
        for i in range(0, n, 7):
            if rnd.random() < 0.6:
                x, y = pts[i]
                px(cv, x + rnd.choice((-1, 0, 1)), y, (255, 255, 255))
