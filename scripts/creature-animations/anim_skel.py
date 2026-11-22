# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „Skelette“ (Runde 2) — baut auf anim_lib auf, ändert nichts daran.

    flughaut_fluegel(h, w, pose, farben)     Linker Fledermaus-/Skelettflügel MIT Flughaut: Armknochen vom Rückenansatz S zum Gelenk W, vier Fingerknochen (mit Knick),
                                             dazwischen eine Membran (Fläche) mit eingebuchtetem Hinterrand; Knochen und Rand sind Linien (4-verbunden), die Fläche ist gefüllt.
                                             pose: dict(S=(x, y), W=(x, y), ang=[θ1..θ4] in Grad (Bildkoordinaten: 90° = unten, 180° = links, 270° = oben), len=[ℓ1..ℓ4], knick=Grad)
                                             Wirft ClipError, wenn etwas über die Leinwand ragt.
"""
import math

import numpy as np

import anim_lib as L
import anim_flieger_b as B


def _pt(p, ang, laenge):
    r = math.radians(ang)
    return (p[0] + laenge * math.cos(r), p[1] + laenge * math.sin(r))


def _im_polygon(px, py, poly):
    """Gerade-ungerade-Regel: liegt (px, py) im Polygon `poly` (Liste von (x, y))?"""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def flughaut_geometrie(pose, tief=0.28, huefte=(-1.0, 9.0)):
    """Kontrollpunkte eines Flügels: Armknochen S→W, je Finger (Knie, Spitze), Polygon der Flughaut (mit eingebuchtetem Hinterrand) und die Hinterrandlinie."""
    S, Wr = pose['S'], pose['W']
    knick = pose.get('knick', 0.0)
    fing = []
    for ang, ln in zip(pose['ang'], pose['len']):
        knie = _pt(Wr, ang, ln * 0.55)
        spitze = _pt(knie, ang - knick, ln * 0.45)
        fing.append((knie, spitze))
    H = (S[0] + huefte[0], S[1] + huefte[1])
    rand = [fing[0][1]]
    for k in range(len(fing) - 1):
        a, b = fing[k][1], fing[k + 1][1]
        m = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
        m = (m[0] + (Wr[0] - m[0]) * tief, m[1] + (Wr[1] - m[1]) * tief)         # Hinterrand zwischen zwei Spitzen buchtet sich zum Gelenk hin ein
        rand += [m, b]
    rand.append(H)
    poly = [S, Wr, fing[0][0]] + rand
    return S, Wr, fing, H, rand, poly


def flughaut_fluegel(h, w, pose, farben):
    """farben = dict(haut=(r,g,b), knochen=(r,g,b), rand=(r,g,b), nub=(r,g,b), kralle=(r,g,b))."""
    a = L.leer(h, w)

    def setze(x, y, c, nur_leer=False):
        if not (0 <= y < h and 0 <= x < w):
            raise L.ClipError(f'Flügelpixel ({x},{y}) außerhalb der Leinwand {w}×{h}')
        if nur_leer and a[y, x, 3]:
            return
        a[y, x, :3] = c
        a[y, x, 3] = 255

    S, Wr, fing, H, rand, poly = flughaut_geometrie(pose)
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0, x1 = int(math.floor(min(xs))), int(math.ceil(max(xs)))
    y0, y1 = int(math.floor(min(ys))), int(math.ceil(max(ys)))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if _im_polygon(x, y, poly):
                setze(x, y, farben['haut'])
    # Hinterrand (Umriss der Membran): Linie über alle Spitzen und Einbuchtungen bis zur Hüfte, 4-verbunden
    for p, q in zip(rand, rand[1:]):
        for (x, y) in B.linie4(p, q):
            setze(x, y, farben['rand'])
    # Knochen: Arm S → W, Finger W → Knie → Spitze (4-verbunden)
    for (x, y) in B.linie4(S, Wr):
        setze(x, y, farben['knochen'])
    for knie, spitze in fing:
        for (x, y) in B.linie4(Wr, knie) + B.linie4(knie, spitze):
            setze(x, y, farben['knochen'])
        setze(int(round(spitze[0])), int(round(spitze[1])), farben['kralle'])
    # Gelenkknubbel 3×3 am Handgelenk: Ring in Knochenfarbe, Kern heller
    wx, wy = int(round(Wr[0])), int(round(Wr[1]))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            setze(wx + dx, wy + dy, farben['nub'] if dx == 0 and dy == 0 else farben['knochen'])
    return a
