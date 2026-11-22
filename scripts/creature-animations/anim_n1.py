# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „n1“ (Doomed Pirate, Weapon Collecting Wight, Noble Mummy Guards, Mummy Maker Machine, Sarcophagus of Sealed Magic,
Leafagami Snake, Wildur, Wowkyrie, Yolomungandr). Baut auf anim_lib/anim_humanoide/anim_cool auf (nur lesen). Alles in ganzen Pixeln, kein Alpha,
nur Farben der Quelle.

    Szene(spr, pad)                    Leinwand = Sprite + Rand (links, oben, rechts, unten); .ebene(maske) legt einen Teil auf die volle Leinwand
    spalten_dy(a, dy_von_x)            jede Spalte starr um dy_von_x(x) Zeilen verschieben (Hebel/Schwenk in ganzen Pixeln, ≤ 1 px Gefälle je Spalte wählen)
    zeilen_dx(a, dx_von_y)             jede Zeile starr um dx_von_y(y) Spalten verschieben
    huelle(i, n, start, werte)         Posenfolge: Frame start+k → werte[k], sonst 0 (nahtlos modulo n)
    funkel(a, x, y, stufe, kern, arm)  kurzer Sparkle (0 = Mitte, 1 = Kreuz 1 px, 2 = Kreuz 2 px); Arme nur auf leere Felder oder Metall
    kleckse(h, w, liste, i, n)         Partikel ≥ 2×2 mit Start/Lebensdauer/Weg (Rauch, Staub, Blasen)
"""
import math

import numpy as np

import anim_lib as L


class Szene:
    def __init__(self, spr, pad):
        self.spr = spr
        self.sh, self.sw = spr.shape[:2]
        self.PL, self.PT, self.PR, self.PB = pad
        self.H, self.W = self.sh + self.PT + self.PB, self.sw + self.PL + self.PR
        self.OFF = (self.PL, self.PT)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.da = spr[..., 3] > 0

    def ebene(self, maske=None):
        t = self.spr.copy()
        if maske is not None:
            t[~maske] = 0
        return L.platz(t, self.H, self.W, self.PL, self.PT)

    def P(self, x, y):
        return x + self.PL, y + self.PT

    def col(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])


def spalten_dy(a, dy_von_x):
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        d = int(dy_von_x(x))
        if ys.min() + d < 0 or ys.max() + d >= h:
            raise L.ClipError(f'Spalte {x} würde um {d} aus der Leinwand geschoben')
        out[ys + d, x] = a[ys, x]
    return out


def zeilen_dx(a, dx_von_y):
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        d = int(dx_von_y(y))
        if xs.min() + d < 0 or xs.max() + d >= w:
            raise L.ClipError(f'Zeile {y} würde um {d} aus der Leinwand geschoben')
        out[y, xs + d] = a[y, xs]
    return out


def huelle(i, n, start, werte):
    k = (i - start) % n
    return werte[k] if k < len(werte) else 0


def setze(a, x, y, farbe):
    a[y, x, :3] = farbe
    a[y, x, 3] = 255


def funkel(a, x, y, stufe, kern, arm, nur_leer=True):
    """Sparkle um Leinwandpunkt (x, y). stufe None = nichts."""
    if stufe is None:
        return a
    setze(a, x, y, kern)
    for r in range(1, stufe + 1):
        for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)):
            if not nur_leer or not a[y + dy, x + dx, 3]:
                setze(a, x + dx, y + dy, arm if r == stufe and stufe > 1 else kern)
    return a


FORM = {1: [(0, 0), (1, 0), (0, 1), (1, 1)],
        2: [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)],
        3: [(1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3)]}


def kleckse(h, w, liste, i, n):
    """liste: dict(s, L, x0, y0, x1, y1, wackeln=0, farbe, rand=None, gross=[Größe je Lebensabschnitt, z. B. (1, 2, 2, 1)]). Leinwandkoordinaten (Ecke oben links)."""
    out = L.leer(h, w)
    for p in liste:
        k = (i - p['s']) % n
        if k >= p['L']:
            continue
        t = k / max(1, p['L'] - 1)
        g = p.get('gross', (1,))
        gr = g[min(len(g) - 1, int(t * len(g)))]
        cx = int(math.floor(p['x0'] + (p['x1'] - p['x0']) * t + p.get('wackeln', 0) * math.sin(2 * math.pi * t) + 0.5))
        cy = int(math.floor(p['y0'] + (p['y1'] - p['y0']) * t + 0.5))
        pts = FORM[gr]
        for (dx, dy) in pts:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Klecks bei ({x},{y}) außerhalb {w}×{h}')
            farbe = p['farbe']
            if p.get('rand') and gr >= 2 and (dx in (0, max(q[0] for q in pts)) or dy in (0, max(q[1] for q in pts))):
                farbe = p['rand']
            setze(out, x, y, farbe)
    return out
