# -*- coding: utf-8 -*-
"""Quetzahuitls Flügel vervollständigen (mit dem Nutzer abgestimmt).

In MotiveSteamDwarfs.xcf sind die Flügel („Ebene #101“ links, „Ebene #102“ rechts) oben
abgeschnitten. Über dem Original wächst ein Stapel breiter Federn (wie die Original-Stufen), deren
Spitzen auf der Hülle einer Nutzer-Skizze liegen; die Streifen jeder Feder laufen fächerförmig in
ihre Spitze, der Flügelknochen verjüngt sich gleichmäßig nach oben und setzt bündig am Original an.

Die Skizze selbst ist nicht nötig: ihr Knochenverlauf steckt als Parabel in FIT_L/FIT_R, ihre
Hülle in TIPS/TIPS_R (alles in Skizzenkoordinaten, SK_W x SK_H, Ursprung OFF in der Datei).
Der rechte Flügel wird gespiegelt mit demselben Verfahren gebaut.
"""
import math
import numpy as np

OFF = (164, 252)                                        # Skizze -> Dateikoordinaten
SK_W, SK_H = 118, 120
YTOP = 21                                               # oberste Knochenzeile der Skizze
FIT_L = (0.011815608177837209, -0.7761467460383819, 53.07897456279799)    # Knochenmitte x(y)
FIT_R = (0.010431936902525106, -0.6288216023510125, 41.610303580891795)   # (gespiegelt)
TIPS = [(14, 5), (8, 14), (7, 35), (12, 47)]            # Hülle der Federspitzen (linker Flügel)
TIPS_R = [(109, 5), (111, 17), (109, 29), (111, 38), (113, 46)]
GREENS = {'153816', '001704', '112f12', '07220b', '375623', '051c09', '0c2609', '2f5427', '2e491d'}
OUTL = '413211'                                         # dunkle Außenkontur der Federn
SEP = '6c531d'                                          # Trennlinie zwischen zwei Federn
SEQ = 'ccccccceeebbbfffeee'                             # Streifenfolge der Federn
PAL = {'c': 'c3a041', 'e': 'a58834', 'b': '6c531d', 'f': '8b6b26'}


def hx(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def rgba(h):
    return [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255]


def polyline_point(pts, s):
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    d = s * sum(seg)
    for (a, b), L in zip(zip(pts, pts[1:]), seg):
        if d <= L or L == 0:
            u = d / L if L else 0
            return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        d -= L
    return pts[-1]


def build_left(wings, fit, tips, n_feathers=9, seed=5):
    """wings: (RGBA-Ausschnitt, x, y) des linken Flügels. Gibt (RGBA, x, y) des fertigen Flügels."""
    H, W = SK_H, SK_W
    ox, oy = OFF
    wa, wx, wy = wings
    canvas = np.zeros((H, W, 4), int)
    wn = np.array([[hx(c) for c in row] for row in wa])
    top_mem = min(y for y in range(wa.shape[0])
                  if any(wa[y, x, 3] and wn[y, x] not in GREENS for x in range(wa.shape[1])))
    ys, xs = np.nonzero(wa[:, :, 3])
    for y, x in zip(ys, xs):
        if y < top_mem + 4 and x < wa.shape[1] // 3 and wn[y, x] in GREENS:
            continue                                    # loser Fingerknochen-Strich außen
        if y < top_mem and wn[y, x] in GREENS:
            continue                                    # dünner Knochenstrich: wird neu gezeichnet
        canvas[y + wy - oy, x + wx - ox] = wa[y, x]
    orig = canvas[:, :, 3] > 0
    yj = top_mem + wy - oy                              # Anschlusszeile (oberste Membranzeile des Originals)
    ytop = YTOP
    xarm = lambda y: float(np.polyval(fit, y))
    green = lambda y, x: canvas[y, x, 3] and hx(canvas[y, x]) in GREENS
    jl = min(x for x in range(W) if green(yj, x))       # der neue Knochen setzt bündig am Original an
    shift = jl - xarm(yj)
    xl = lambda y: xarm(y) + shift                      # linke Knochenkontur
    # Federn: Wurzeln gleichmäßig am Knochen, Spitzen auf der Hülle (oben -> unten)
    env = tips + [(min(x for x in range(W) if canvas[yj + 2, x, 3]) - 1, yj + 1)]
    rng = np.random.default_rng(seed)
    feathers = []
    for k in range(n_feathers):
        s = k / (n_feathers - 1)
        tx, ty = polyline_point(env, s)
        yb = ytop + 3 + (yj - 1 - ytop - 3) * s
        feathers.append(((tx, ty), (xl(yb) - 1, yb), rng.uniform(0, len(SEQ))))
    spacing = (yj - ytop) / (n_feathers - 1)
    feat = np.zeros((H, W), int) - 1
    for k in range(n_feathers - 1, -1, -1):             # unten zuerst, obere Federn liegen darüber
        (tx, ty), (bx, by), sh = feathers[k]
        L = math.dist((tx, ty), (bx, by))
        ux, uy = (tx - bx) / L, (ty - by) / L
        hbase = spacing * 0.95 + 0.6
        for y in range(max(0, int(min(ty, by - hbase)) - 2), min(H, int(max(ty, by + hbase)) + 3)):
            for x in range(max(0, int(min(tx, bx)) - 3), min(W, int(max(tx, bx)) + 4)):
                t = (x - bx) * ux + (y - by) * uy
                if t < -1.5 or t > L:
                    continue
                perp = -(x - bx) * uy + (y - by) * ux
                tt = max(0.0, t) / L
                w = hbase * (1 - tt) ** 0.5 + 0.7        # breite Federn, stumpfe Spitze
                if abs(perp) <= w and x < xl(y) - 0.5 and y <= yj + 3 and not green(y, x):
                    feat[y, x] = k
    out = canvas.copy()
    for y, x in zip(*np.nonzero(feat >= 0)):            # Streifen laufen fächerförmig in die Spitze
        (tx, ty), (bx, by), sh = feathers[feat[y, x]]
        L = math.dist((tx, ty), (bx, by))
        phi = math.atan2(y - ty, x - tx) - math.atan2(by - ty, bx - tx)
        phi = (phi + math.pi) % (2 * math.pi) - math.pi
        out[y, x] = rgba(PAL[SEQ[int(phi * L / 0.45 + sh) % len(SEQ)]])
    for y, x in zip(*np.nonzero(feat >= 0)):            # Kontur: dunkel nur außen, dazwischen heller
        k = feat[y, x]
        nb = [(y + dy, x + dx) for dy, dx in ((1, 0), (0, -1), (-1, 0), (0, 1))]
        edge = False
        for yy, xx in nb:
            if not (0 <= yy < H and 0 <= xx < W):
                edge = True
            elif feat[yy, xx] < 0 and not orig[yy, xx] and xx < xl(yy):
                edge = True
        sep = any(0 <= yy < H and 0 <= xx < W and feat[yy, xx] > k for yy, xx in nb[:2])
        if edge:
            out[y, x] = rgba(OUTL)
        elif sep:
            out[y, x] = rgba(SEP)
    # Knochen: gleichmäßig verjüngt, so breit wie das Original an der Anschlusszeile
    wj = len([x for x in range(W) if green(yj, x)])
    for y in range(ytop - 1, yj):
        u = (y - (ytop - 1)) / max(1, yj - (ytop - 1))
        wi = max(1, int(round(1 + (wj - 1) * u)))
        x0 = int(round(xl(y)))
        cols = ['001704'] if wi == 1 else ['07220b', '001704'] if wi == 2 else \
            ['001704'] + ['153816'] * (wi - 2) + ['001704']
        for i, h in enumerate(cols):
            out[y, x0 + i] = rgba(h)
    # Außenkontur des Knochens geschlossen halten: jedes freiliegende Knochenpixel wird dunkelgrün
    dark = []
    for y in range(max(0, ytop - 2), min(H, yj + 6)):
        for x in range(W):
            if out[y, x, 3] and hx(out[y, x]) in GREENS and hx(out[y, x]) != '001704':
                if any(not (0 <= yy < H and 0 <= xx < W) or out[yy, xx, 3] == 0
                       for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))):
                    dark.append((y, x))
    for y, x in dark:
        out[y, x] = rgba('001704')
    ys, xs = np.nonzero(out[:, :, 3])
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return out[y0:y1, x0:x1], x0 + ox, y0 + oy


def build_right(wings, **kw):
    """Wie build_left, am Skizzenrand gespiegelt."""
    ox = OFF[0]
    wa, wx, wy = wings
    fx = lambda xabs, w: ox + (SK_W - 1) - (xabs - ox) - (w - 1)
    tipsf = [(SK_W - 1 - x, y) for x, y in TIPS_R]
    out, x0, y0 = build_left((wa[:, ::-1], fx(wx, wa.shape[1]), wy), FIT_R, tipsf, **kw)
    return out[:, ::-1], fx(x0, out.shape[1]), y0


def complete(left, right):
    """left/right: Flügel-Ebenen als Leinwand-RGBA. Gibt beide vervollständigt als Leinwand-RGBA."""
    res = []
    for a, build in ((left, lambda w: build_left(w, FIT_L, TIPS)), (right, build_right)):
        ys, xs = np.nonzero(a[:, :, 3])
        x0, y0 = xs.min(), ys.min()
        w, wx, wy = build((a[y0:ys.max() + 1, x0:xs.max() + 1].astype(int), x0, y0))
        c = np.zeros_like(a)
        c[wy:wy + w.shape[0], wx:wx + w.shape[1]] = w.astype(np.uint8)
        res.append(c)
    return res
