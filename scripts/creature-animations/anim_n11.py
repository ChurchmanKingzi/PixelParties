# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „n11“ (letzte fehlende Creatures; Sprites teils aus Motiv-Masken × Kartenkunst). Verändert kein gemeinsames Modul.
Grundstock (Szene, starr, stufe, huelle, funkel, brocken, dampf, blasen, loecher, zuschneiden, kontakt, fertig) kommt unverändert aus anim_n9.

    zeilen_schub(a, dx_von_y)        jede Zeile starr um dx_von_y(y) verschieben (Scherung in ganzen Pixeln)
    spalten_schub(a, dy_von_x)       jede Spalte starr um dy_von_x(x) verschieben
    tropfen(...)                     fallende 2×2-Tropfen (beschleunigt, zerfällt im letzten Frame zu 2×1)
"""
import numpy as np

import anim_lib as L
from anim_n9 import *  # noqa: F401,F403
from anim_n9 import Szene, brocken  # noqa: F401


def zeilen_schub(a, dx_von_y):
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        dx = int(dx_von_y(y))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError('zeilen_schub: Zeile %d um %d aus der Leinwand' % (y, dx))
        out[y, xs + dx] = a[y, xs]
    return out


def spalten_schub(a, dy_von_x):
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = int(dy_von_x(x))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError('spalten_schub: Spalte %d um %d aus der Leinwand' % (x, dy))
        out[ys + dy, x] = a[ys, x]
    return out


def tropfen(h, w, i, liste, farbe, farbe2=None):
    """Fallende Tropfen: dict(x, y, start, dauer, g=0.12, vy=0.3). 2×2, im letzten Frame 2×1."""
    return brocken(h, w, i, [dict(x=t['x'], y=t['y'], vx=0, vy=t.get('vy', 0.3), g=t.get('g', 0.12), start=t['start'], dauer=t['dauer'])
                             for t in liste], farbe, farbe2)


def ueber(unten, oben):
    """`oben` über `unten` legen (gleiche Leinwand)."""
    f = unten.copy()
    m = oben[..., 3] > 0
    f[m] = oben[m]
    return f
