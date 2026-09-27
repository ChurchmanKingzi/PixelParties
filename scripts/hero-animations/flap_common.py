# -*- coding: utf-8 -*-
"""Flügel drehen (für Flügelschlag-Animationen, siehe mary.py).

Ein Flügel(-Fächer) dreht sich um sein Schultergelenk. Gerastert wird per
Rückwärts-Abbildung mit 3x3-Überabtastung und Mehrheitsfarbe – es entstehen
keine Mischfarben, die Pixel-Palette bleibt erhalten.
"""
import math
from collections import Counter
import numpy as np


def rotate_part(src, mask, pivot, angle, out_shape, offset=(0, 0), span=1.0, lag=0.0):
    """src: HxWx4 (int), mask: HxW bool (welche Pixel zum Teil gehören).

    pivot: Drehpunkt (x, y) in src-Koordinaten, angle: Winkel in Bogenmaß
    (positiv = im Uhrzeigersinn) oder Funktion angle(r) mit r = Abstand zum
    Drehpunkt (für Nachschwingen), offset: Verschiebung src -> Ausgabe,
    span: Streckung entlang des Radius (<1 = angelegt/verkürzt).
    Liefert ein HxWx4-Array der Ausgabegröße (leer = Alpha 0).
    """
    H, W = out_shape
    SH, SW = src.shape[:2]
    out = np.zeros((H, W, 4), int)
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return out
    px_, py_ = pivot[0] + offset[0], pivot[1] + offset[1]
    rmax = max(math.hypot(x - pivot[0], y - pivot[1]) for x, y in zip(xs, ys)) * 1.15 / min(1.0, span) + 2
    x0, x1 = max(0, int(px_ - rmax)), min(W, int(px_ + rmax) + 1)
    y0, y1 = max(0, int(py_ - rmax)), min(H, int(py_ + rmax) + 1)
    afn = angle if callable(angle) else (lambda r, a=angle: a)
    for y in range(y0, y1):
        for x in range(x0, x1):
            votes = Counter()
            for sx in (-0.33, 0.0, 0.33):
                for sy in (-0.33, 0.0, 0.33):
                    dx, dy = x + sx - px_, y + sy - py_
                    a = afn(math.hypot(dx, dy))
                    c, s = math.cos(-a), math.sin(-a)
                    ux, uy = (dx * c - dy * s) / span, (dx * s + dy * c) / span
                    qx = int(round(pivot[0] + ux))
                    qy = int(round(pivot[1] + uy))
                    if 0 <= qx < SW and 0 <= qy < SH and mask[qy, qx]:
                        votes[tuple(int(v) for v in src[qy, qx])] += 1
                    else:
                        votes[None] += 1
            col, n = votes.most_common(1)[0]
            if col is None and n < 5:
                rest = [(k, v) for k, v in votes.items() if k is not None]
                if rest and max(v for _, v in rest) >= 4:
                    col = max(rest, key=lambda kv: kv[1])[0]
            if col is not None:
                out[y, x] = col
    return out


def over(dst, part):
    """part (mit Alpha 0 = leer) deckend über dst legen."""
    m = part[:, :, 3] > 0
    dst[m] = part[m]
    return dst


def shear_flap(src, mask, pivot_x, side, lift, squeeze, out, offset=(0, 0), curve=1.0):
    """Spaltentreuer Flügelschlag für kleine Flügel (Drehung würde sie verwaschen).

    Jede Spalte außerhalb von pivot_x wird als Ganzes verschoben:
    horizontal gestaucht (squeeze < 1 = Flügel verkürzt, Perspektive) und
    vertikal geschert (lift > 0 = Spitzen nach oben, < 0 nach unten).
    curve > 1 lässt die Spitzen stärker ausschlagen als die Wurzel.
    Pixel innen vom Drehpunkt bleiben stehen. Malt direkt in out.
    """
    SH, SW = src.shape[:2]
    H, W = out.shape[:2]
    cols = [x for x in range(SW) if mask[:, x].any()]
    if not cols:
        return out
    far = max(abs(x - pivot_x) for x in cols) + 1
    for ox in range(W):
        sx_out = ox - offset[0]
        d = (sx_out - pivot_x) * side
        if d < 0:
            cs = sx_out
            shift = 0
        else:
            ds = d / squeeze
            cs = int(round(pivot_x + side * ds))
            shift = int(round(lift * far * (ds / far) ** curve))
        if not 0 <= cs < SW:
            continue
        for y in range(SH):
            if mask[y, cs]:
                oy = y - shift + offset[1]
                if 0 <= oy < H:
                    out[oy, ox] = src[y, cs]
    return out


def fill_pinholes(part):
    """Einzelne leere Pixel im gedrehten Teil (von allen 4 Nachbarn umgeben)
    mit der häufigsten Nachbarfarbe schließen."""
    h, w = part.shape[:2]
    a = part[:, :, 3] > 0
    fix = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not a[y, x] and a[y - 1, x] and a[y + 1, x] and a[y, x - 1] and a[y, x + 1]:
                nb = Counter(tuple(int(v) for v in part[yy, xx])
                             for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
                fix.append((x, y, nb.most_common(1)[0][0]))
    for x, y, c in fix:
        part[y, x] = c
    return part
