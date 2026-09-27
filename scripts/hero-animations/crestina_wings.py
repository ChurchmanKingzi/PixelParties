# -*- coding: utf-8 -*-
"""Neu gezeichnete Flügel für True Fairy Crestina, the Primordial Goddess.

In der xcf gehen von ihr acht riesige, nie fertig gepixelte Lichtstrahlen aus –
eigentlich ihre Flügel. Hier werden daraus acht schlanke Feenflügel (vier je
Seite) in derselben Palette: gelbe Kontur, weiß-hellblaue Füllung, zur Spitze
hin cyan, mit heller Mittelader. Die Form ist ein Blatt: schmal an der Wurzel,
breit im äußeren Drittel, runde, leicht nach oben gebogene Spitze.
Gerastert wird mit 3x3-Überabtastung (Mehrheit), damit die Kanten sauber sind.
"""
import math
import numpy as np

YEL, WHITE, PALE, CYAN = (255, 255, 162), (255, 255, 255), (221, 246, 255), (180, 246, 255)
# (Winkel in Grad von oben nach außen, Länge, halbe Breite, Wurzelversatz dx/dy)
WINGS = [(12, 20, 4.0, (1, -2)), (47, 23, 4.9, (2, -1)), (85, 20, 4.3, (3, 1)), (122, 17, 4.0, (3, 3))]
PAD_X, PAD_Y = 28, 18                    # Figur-Versatz auf der Flügel-Leinwand
ROOT_DY = 10                             # Flügelwurzel: Zeile im Figurenrücken


def wing_field(W, H, root, mirror, flap=0.0, spread=1.0):
    """t (0 Wurzel .. 1 Spitze) und q (quer, -1..1) je Pixel, sonst NaN.

    flap: Drehung in Grad (positiv = nach oben/zusammen), spread: Längenfaktor.
    """
    T = np.full((H, W), np.nan)
    Q = np.full((H, W), np.nan)
    rx, ry = root
    for k, (ang, L, hw, (ox, oy)) in enumerate(WINGS):
        a = math.radians(ang - flap * (1.0 - 0.15 * k))
        L = L * spread
        ux, uy = math.sin(a) * mirror, -math.cos(a)
        nx, ny = -uy, ux
        bx, by = rx + ox * mirror, ry + oy
        x0 = int(max(0, min(bx, bx + ux * L) - hw - 3)); x1 = int(min(W, max(bx, bx + ux * L) + hw + 3))
        y0 = int(max(0, min(by, by + uy * L) - hw - 3)); y1 = int(min(H, max(by, by + uy * L) + hw + 3))
        bend = 1 if ang < 100 else -1
        for y in range(y0, y1):
            for x in range(x0, x1):
                hits = []
                for sx in (-1 / 3, 0, 1 / 3):
                    for sy in (-1 / 3, 0, 1 / 3):
                        px, py = x + .5 + sx - bx, y + .5 + sy - by
                        t = (px * ux + py * uy) / L
                        if not 0 <= t <= 1:
                            continue
                        q = px * nx + py * ny - mirror * 1.2 * t * t * bend
                        prof = max(0.55, hw * (t ** 0.55) * math.sqrt(max(0, 1 - t ** 2.2)))
                        if abs(q) <= prof:
                            hits.append((t, q / prof))
                if len(hits) >= 5:
                    t = sum(h[0] for h in hits) / len(hits)
                    q = sum(h[1] for h in hits) / len(hits)
                    if np.isnan(T[y, x]) or t < T[y, x]:
                        T[y, x], Q[y, x] = t, q
    return T, Q


def paint_wings(out, root, flap=0.0, spread=1.0, shimmer=None):
    """Beide Flügelseiten auf out (H x W x 4) malen. shimmer: t-Position eines
    Lichtschimmers, der die Flügel entlangläuft (oder None)."""
    H, W = out.shape[:2]
    for mirror in (-1, 1):
        T, Q = wing_field(W, H, root, mirror, flap, spread)
        ins = ~np.isnan(T)
        for y, x in zip(*np.nonzero(ins)):
            edge = any(not (0 <= x + dx < W and 0 <= y + dy < H) or not ins[y + dy, x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            t, q = T[y, x], Q[y, x]
            if edge:
                c = YEL
            elif shimmer is not None and abs(t - shimmer) < 0.07:
                c = WHITE
            elif abs(q) < 0.25 and t < 0.8:
                c = WHITE
            elif t > 0.72 or q * mirror > 0.55:
                c = CYAN
            elif t < 0.4:
                c = WHITE if abs(q) < 0.5 else PALE
            else:
                c = PALE
            out[y, x] = (*c, 255)


def compose_true_crestina(fig, flap=0.0, spread=1.0, shimmer=None, fig_dy=0):
    fh, fw = fig.shape[:2]
    W, H = fw + 2 * PAD_X, fh + 2 * PAD_Y
    out = np.zeros((H, W, 4), np.uint8)
    paint_wings(out, (PAD_X + fw / 2, PAD_Y + ROOT_DY + fig_dy), flap, spread, shimmer)
    m = fig[:, :, 3] > 0
    out[PAD_Y + fig_dy:PAD_Y + fig_dy + fh, PAD_X:PAD_X + fw][m] = fig[m]
    return out
