# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Spinnen“ (Pixelart, nur ganze Pixel, nur Farben des Sprites).

Beine werden NICHT als starre Spalten/Zeilen verschoben, sondern als Pfade (Wurzel am Körper → Fuß) behandelt:
    beine = zerlege_beine(spr, bein_maske, koerper_maske)       # Liste von Bein-Dicts (Pfad, Farben, Seite)
    zeichne_bein(ebene, bein, wirkung, dx, dy)                  # Bein mit verschobenen Gelenken neu zeichnen
`wirkung(knoten) -> (ddx, ddy)` gibt je Knoten (dict mit x, y, dist, anteil 0…1) den Versatz in ganzen Pixeln.
Zwischen zwei verschobenen Nachbarknoten wird mit einer 8er-Linie (Bresenham) verbunden — das Bein reißt nie auf, es gibt keine
losen Punkte, und die Wurzel (Anteil 0) bleibt am Körper angewachsen.

    schwingen(a, phase, lauf)   → Versatz-Funktion „Bein pendelt seitlich“ (Fuß schwingt am weitesten)
    schnipp(...)                → Versatz-Funktion „Fußspitze knickt für ein paar Frames ab“

Außerdem: huell(i, n, start, laenge) (0…1…0), kontakt() für Prüfbilder (aus anim_tiere).
"""
import math

import numpy as np

import anim_lib as L
import anim_tiere as T


def linie(p, q):
    """Alle Pixel einer 8er-Linie von p nach q (inklusive beider Enden)."""
    (x0, y0), (x1, y1) = p, q
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    out = []
    while True:
        out.append((x0, y0))
        if (x0, y0) == (x1, y1):
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy; x0 += sx
        if e2 < dx:
            err += dx; y0 += sy
    return out


def zerlege_beine(spr, bein_maske, koerper_maske, mitte_x=None, verbinden=True):
    """Zerlegt die Pixel von `bein_maske` in einzelne Beine (8er-Zusammenhang) und legt je Bein einen Pfad an.
    Wurzel = Pixel, die einen Körperpixel (`koerper_maske`) in der 8er-Nachbarschaft haben (dist 0); von dort per Breitensuche nach außen.
    Rückgabe: Liste von dict(knoten=[dict(x, y, farbe, eltern, dist, anteil)], maxd, seite, mx, my)."""
    h, w = bein_maske.shape
    mitte_x = (w - 1) / 2.0 if mitte_x is None else mitte_x
    rest = bein_maske.copy()
    beine = []
    nb8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    seen = np.zeros_like(rest)
    for y0, x0 in zip(*np.nonzero(rest)):
        if seen[y0, x0]:
            continue
        comp = []
        st = [(x0, y0)]; seen[y0, x0] = True
        while st:
            x, y = st.pop(); comp.append((x, y))
            for dx, dy in nb8:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and rest[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; st.append((xx, yy))
        cs = set(comp)
        wurzeln = [p for p in comp if any(0 <= p[1] + dy < h and 0 <= p[0] + dx < w and koerper_maske[p[1] + dy, p[0] + dx] for dx, dy in nb8)]
        if not wurzeln:       # frei schwebendes Teil: der Pixel mit kleinstem Abstand zur Körpermaske
            ky, kx = np.nonzero(koerper_maske)
            wurzeln = [min(comp, key=lambda p: min(max(abs(p[0] - a), abs(p[1] - b)) for a, b in zip(kx, ky)))]
        knoten = []; idx = {}
        for p in wurzeln:
            idx[p] = len(knoten)
            knoten.append(dict(x=p[0], y=p[1], farbe=tuple(int(v) for v in spr[p[1], p[0], :3]), eltern=-1, dist=0))
        k = 0
        while k < len(knoten):
            n = knoten[k]; k += 1
            for dx, dy in nb8:
                q = (n['x'] + dx, n['y'] + dy)
                if q in cs and q not in idx:
                    idx[q] = len(knoten)
                    knoten.append(dict(x=q[0], y=q[1], farbe=tuple(int(v) for v in spr[q[1], q[0], :3]), eltern=idx[(n['x'], n['y'])], dist=n['dist'] + 1))
        maxd = max(n['dist'] for n in knoten)
        for n in knoten:
            n['anteil'] = (n['dist'] / maxd) if maxd else 0.0
            n['maxd_minus'] = maxd - n['dist']
        mx = sum(n['x'] for n in knoten) / len(knoten); my = sum(n['y'] for n in knoten) / len(knoten)
        beine.append(dict(knoten=knoten, maxd=maxd, seite='l' if mx < mitte_x else 'r', mx=mx, my=my))
    beine.sort(key=lambda b: (b['seite'], b['my']))
    return beine


def zeichne_bein(ebene, bein, wirkung, dx=0, dy=0, kuerzen=0):
    """Bein mit verschobenen Gelenken auf `ebene` zeichnen (dx, dy = Versatz des ganzen Beins auf der Leinwand).
    kuerzen = k: die äußersten k Knoten fallen auf den Gelenkpunkt davor zurück (Fuß zieht an / Bein wird um k px kürzer) — ohne Knick und ohne Querstrich."""
    h, w = ebene.shape[:2]
    neu = []
    for n in bein['knoten']:
        ddx, ddy = wirkung(n)
        neu.append((n['x'] + dx + int(ddx), n['y'] + dy + int(ddy)))
    if kuerzen:
        for k, n in enumerate(bein['knoten']):
            if n['maxd_minus'] < kuerzen:
                a = k
                for _ in range(kuerzen - n['maxd_minus']):
                    a = bein['knoten'][a]['eltern'] if bein['knoten'][a]['eltern'] >= 0 else a
                neu[k] = neu[a]
    for k, n in enumerate(bein['knoten']):
        p = neu[k]
        pix = [p] if n['eltern'] < 0 else linie(neu[n['eltern']], p)[1:]      # der Elternpixel gehört dem Eltern-Knoten (eigene Farbe)
        for (x, y) in pix:
            if not (0 <= x < w and 0 <= y < h):
                raise L.ClipError(f'Beinpixel ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = n['farbe']; ebene[y, x, 3] = 255
    return ebene


def huell(i, n, start, laenge):
    return T.huellkurve(i, n, start, laenge)


def pendel(amp_x, amp_y, phase, potenz=1.0, lauf=0.0):
    """Versatz-Funktion: das Bein pendelt; Versatz = Anteil^potenz · amp · sin(phase − lauf·Anteil), auf ganze Pixel gerundet."""
    def f(n):
        a = n['anteil'] ** potenz
        s = math.sin(phase - lauf * n['anteil'])
        return round(amp_x * a * s), round(amp_y * a * s)
    return f


def knick(dx, dy, tiefe=1):
    """Versatz-Funktion: nur die äußersten `tiefe` Knoten des Beins weichen um (dx, dy) aus (Fußspitze knickt ab)."""
    def f(n):
        return (dx, dy) if n['maxd_minus'] < tiefe else (0, 0)
    return f
