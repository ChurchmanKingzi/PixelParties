# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe „n6“ (Neubau-Welle 3: Sleeping Beauty, Pythia, Afflicted Pests, Ash Worms, Clone, Crum, Frolake, Glasowt, Life-Searcher,
Motharch Squire, Pure Advantage Camel). Baut nur auf anim_lib auf (gemeinsame Module bleiben unverändert).

    woelkchen(h, w, i, n, puffs, farben)   wie L.puff_ebene, aber NIE kleiner als 2×2 (Regel 25: keine einzelnen 1-px-Punkte): 2×2 → volle Form → 2×2
    teil_schieben(a, maske, dx, dy)        Leinwandpixel unter `maske` (Leinwandkoordinaten) starr verschieben → (rest, teil)
    fuellen(rest, a, farbe_fn)             Lücken (in a deckend, in rest leer) mit farbe_fn(x, y) fertigzeichnen
"""
import math

import numpy as np

import anim_lib as L

KLEIN = [(0, 0, 'c'), (1, 0, 'r'), (0, 1, 'r'), (1, 1, 'r')]


def woelkchen(h, w, i, n, puffs, farben, rand=0.22):
    """puffs: dict(x, y, vx, vy, off, form, wackeln, dauer) wie L.puff_ebene; dauer (Frames, Standard n) = sichtbare Lebenszeit innerhalb der Schleife n
    (danach Pause bis zum nächsten Durchlauf). Im ersten/letzten Lebensabschnitt (`rand`) ist das Wölkchen 2×2, dazwischen die volle Form."""
    ebene = L.leer(h, w)
    for pf in puffs:
        k = (i + pf.get('off', 0)) % n
        dauer = pf.get('dauer', n)
        if k >= dauer:
            continue
        t = k / dauer
        cx = int(round(pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)))
        cy = int(round(pf['y'] + pf.get('vy', 0) * t))
        form = L.PUFF_FORMEN[pf.get('form', 'o')] if rand <= t < 1 - rand else KLEIN
        for dx, dy, typ in form:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Partikel bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = farben[typ]; ebene[y, x, 3] = 255
    return ebene


def teil_schieben(a, maske, dx, dy):
    teil, rest = L.trenne(a, maske & (a[..., 3] > 0))
    return rest, L.versetze(teil, dx, dy)


def fuellen(rest, a, farbe_fn):
    for y, x in zip(*np.nonzero((a[..., 3] > 0) & (rest[..., 3] == 0))):
        c = farbe_fn(x, y)
        if c is not None:
            rest[y, x, :3] = c; rest[y, x, 3] = 255
    return rest
