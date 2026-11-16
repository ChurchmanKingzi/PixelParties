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


def schliessen(a, runden=2):
    """Ebene (z. B. ein gedrehter Flügel ohne eigenen Umriss) zu einer geschlossenen Fläche machen: von der Ebene selbst umschlossene Löcher und einzelne Kerben (leeres Pixel mit ≥ 3 belegten
    4er-Nachbarn) bekommen die häufigste Farbe ihrer belegten Nachbarn — nur Farben der Ebene selbst."""
    out = a.copy()
    h, w = a.shape[:2]
    for _ in range(runden):
        m = out[..., 3] > 0
        p = np.pad(m, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        ziel = (~m & (n4 >= 3)) | loecher(out)
        if not ziel.any():
            break
        neu = out.copy()
        for y, x in zip(*np.nonzero(ziel)):
            farben = [tuple(int(v) for v in out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                      if 0 <= y + dy < h and 0 <= x + dx < w and out[y + dy, x + dx, 3]]
            if farben:
                neu[y, x, :3] = max(set(farben), key=farben.count)
                neu[y, x, 3] = 255
        out = neu
    return out


def loecher_fuellen(f, bevorzugt, max_flaeche=5, ausser=None, runden=4):
    """Von der Figur umschlossene Hintergrundpixel (Löcher bis max_flaeche Pixel) schließen — mit einer Nachbarfarbe aus `bevorzugt` (z. B. den Federfarben), wenn eine angrenzt, sonst mit der
    häufigsten Nachbarfarbe. So wächst in eine Naht am Flügel nie Schwarz hinein."""
    out = f.copy()
    h, w = f.shape[:2]
    for _ in range(runden):
        lo = loecher(out, ausser)
        if not lo.any():
            break
        n, lab = cv2.connectedComponents(lo.astype(np.uint8), connectivity=4)
        geaendert = False
        for q in range(1, n):
            ys, xs = np.nonzero(lab == q)
            if len(ys) > max_flaeche:
                continue
            for y, x in zip(ys, xs):
                farben = [tuple(int(v) for v in out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                          if 0 <= y + dy < h and 0 <= x + dx < w and out[y + dy, x + dx, 3]]
                gut = [c for c in farben if c in bevorzugt]
                if farben:
                    out[y, x, :3] = max(set(gut or farben), key=(gut or farben).count)
                    out[y, x, 3] = 255
                    geaendert = True
        if not geaendert:
            break
    return out


def flaeche_schliessen(f, teil_maske, vorn_maske, farben):
    """Die Fläche eines Teils (z. B. Flügel = geschwenkter Flügel + stehender Ansatz) wird morphologisch geschlossen (3×3) und ihre Löcher gefüllt; jedes Pixel dieser Fläche, das nicht von der
    vorderen Lage verdeckt ist und keine der `farben` (Federfarben) trägt, bekommt die Farbe eines Nachbarn mit Federfarbe (8er-Nachbarschaft, von innen nach außen wachsend).
    Ergebnis: in der Flügelfläche liegt nur Flügel — kein Haar, kein Hintergrund."""
    out = f.copy()
    h, w = f.shape[:2]
    wm = cv2.morphologyEx(teil_maske.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
    wm |= loecher(np.dstack([wm.astype(np.uint8) * 255] * 4))
    fs = {tuple(c) for c in farben}
    ist = lambda y, x: out[y, x, 3] > 0 and tuple(int(v) for v in out[y, x, :3]) in fs
    offen = [(y, x) for y, x in zip(*np.nonzero(wm & ~vorn_maske)) if not ist(y, x)]
    for _ in range(6):
        if not offen:
            break
        rest_, neu = [], {}
        for y, x in offen:
            nb = [tuple(int(v) for v in out[y + dy, x + dx, :3]) for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (-1, 1), (1, -1), (1, 1))
                  if 0 <= y + dy < h and 0 <= x + dx < w and ist(y + dy, x + dx)]
            if nb:
                neu[(y, x)] = max(set(nb), key=nb.count)
            else:
                rest_.append((y, x))
        for (y, x), c in neu.items():
            out[y, x, :3] = c
            out[y, x, 3] = 255
        offen = rest_
    return out
