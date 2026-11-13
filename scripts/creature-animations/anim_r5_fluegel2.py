# -*- coding: utf-8 -*-
"""Runde 5, Gruppe „Flügel 2“: Flügelschlag als FÄCHER statt als starre Drehung, und Prüfhilfen gegen Lücken.

    faechern(a, px, py, k, seite)        # Flügel-Ebene um das Gelenk (px, py) auffächern/zusammenlegen: Die Körperkante (vom Gelenk senkrecht nach unten) bleibt stehen,
                                         # jeder Winkel zur Körperkante wird mit k multipliziert (k > 1 = Flügel hebt sich, k < 1 = Flügel senkt sich). Der Abstand zum Gelenk bleibt.
                                         # Rückwärtsabbildung, Nächster-Nachbar: keine Mischfarben, keine Löcher, und der Flügel bleibt in JEDER Pose auf ganzer Länge am Rumpf angewachsen.
    glatt(a)                             # Silhouette bereinigen: einzelne Spitzenpixel weg, einzelne Kerben mit Nachbarfarbe zu
    loecher(f, ausser=None)              # Hintergrundpixel, die von Figur umschlossen sind (4er-Nachbarschaft)
    zeilen_luecken(f, x0, x1)            # Hintergrundpixel, die in ihrer Zeile links UND rechts Figur haben (Spalt zwischen Flügel und Rumpf), im Spaltenbereich [x0, x1]
"""
import math

import cv2
import numpy as np


def faechern(a, px, py, k, seite):
    """seite = +1: Flügel liegt links vom Gelenk, −1: rechts."""
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    if abs(k - 1.0) < 1e-9:
        return a.copy()
    for y in range(h):
        for x in range(w):
            dx, dy = x - px, y - py
            r = math.hypot(dx, dy)
            d = math.atan2(-dx * seite, dy)                    # 0 = senkrecht nach unten (Körperkante), wächst zum Flügel hin
            ds = d / k
            if abs(ds) > math.pi:
                continue
            sx = int(math.floor(px - seite * r * math.sin(ds) + 0.5))
            sy = int(math.floor(py + r * math.cos(ds) + 0.5))
            if 0 <= sx < w and 0 <= sy < h and a[sy, sx, 3]:
                out[y, x] = a[sy, sx]
    return out


def glatt(a, runden=2):
    out = a.copy()
    h, w = a.shape[:2]
    for _ in range(runden):
        m = out[..., 3] > 0
        p = np.pad(m, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        neu = out.copy()
        neu[m & (n4 < 2)] = 0
        for y, x in zip(*np.nonzero(~m & (n4 >= 3))):
            farben = [tuple(int(v) for v in out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                      if 0 <= y + dy < h and 0 <= x + dx < w and out[y + dy, x + dx, 3]]
            neu[y, x, :3] = max(set(farben), key=farben.count)
            neu[y, x, 3] = 255
        out = neu
    return out


def loecher(f, ausser=None):
    leer = (f[..., 3] == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(leer, connectivity=4)
    rand = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    m = np.isin(lab, [q for q in range(1, n) if q not in rand])
    if ausser is not None:
        m &= ~ausser
    return m


def zeilen_luecken(f, x0, x1):
    m = f[..., 3] > 0
    links = np.cumsum(m, axis=1) > 0
    rechts = np.cumsum(m[:, ::-1], axis=1)[:, ::-1] > 0
    g = ~m & links & rechts
    g[:, :x0] = False
    g[:, x1 + 1:] = False
    return g
