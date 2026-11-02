# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe harpyA (Classical/Country/Grunge Harpyformer, Orphy) — baut auf anim_lib auf, ändert nichts daran.

    runde(x)                          kaufmännisch runden (x.5 → aufwärts), damit +/- symmetrisch bleibt
    streich(t, periode, ...)          Strich-Profil −1…+1 (Bogen/Plektrum hin und her), Frame 0 = Mitte
    kette_schwingen(a, y0, y1, dx_fn) hängende Kette/Schnur: Zeile y wandert waagerecht um dx_fn(y), die Kette bleibt zusammenhängend (4er-Nachbarschaft)
    unter_fuellen(unten, teil, quelle) Pixel hinter einem verschobenen Teil ergänzen: Zellen, in denen die Basisebene leer ist, bekommen die Farbe
                                      des nächsten deckenden Pixels einer Referenzebene in Richtung `richtung`
"""
import math

import numpy as np

import anim_lib as L


def runde(x):
    return int(math.floor(x + 0.5))


def streich(t, periode, versatz=0.0):
    """Sinusförmiger Hin-und-Her-Strich −1…+1; bei t = 0 (und versatz = 0) in der Mitte, damit Frame 0 = Ruhepose = Original."""
    return math.sin(2 * math.pi * t / periode + versatz)


def kette_schwingen(a, y0, y1, dx_fn):
    """Zeilen y0…y1 der Ebene `a` wandern waagerecht um runde(dx_fn(y)); alle anderen Zeilen bleiben. War ein Pixel in der Ruhepose mit dem Pixel
    der Zeile darüber 4er-verbunden, bleibt es das (sonst übernimmt die Zeile das dx der Zeile darüber) — die Kette reißt nicht auseinander."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    prev = 0
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = runde(dx_fn(y)) if y0 <= y <= y1 else 0
        if y0 < y <= y1 and dx != prev:
            for x in xs_:
                if a[y - 1, x, 3]:
                    xa = x + dx - prev
                    if not (0 <= xa < w and a[y - 1, xa, 3]):
                        dx = prev
                        break
        prev = dx
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def unter_fuellen(basis, referenz, maske, richtung=(0, -1), weite=6):
    """Zellen der Basisebene `basis` (H×W×4), die in `maske` (bool H×W) liegen und leer sind, bekommen die Farbe des ersten deckenden Pixels der Ebene
    `referenz` in Richtung `richtung` (dx, dy), höchstens `weite` Schritte weit. Gibt eine Kopie zurück."""
    out = basis.copy()
    h, w = basis.shape[:2]
    dx, dy = richtung
    for y, x in zip(*np.nonzero(maske & (basis[..., 3] == 0))):
        for k in range(1, weite + 1):
            xx, yy = x + dx * k, y + dy * k
            if not (0 <= xx < w and 0 <= yy < h):
                break
            if referenz[yy, xx, 3]:
                out[y, x] = referenz[yy, xx]
                break
    return out


def zeilen_versatz(a, dx_fn):
    """Jede Zeile y der Ebene `a` wandert waagerecht um runde(dx_fn(y)) (Zeilenscherung, z. B. ein hängender Flügelarm, der um die Schulter pendelt). Die Texturen der Zeilen
    bleiben unverändert (nichts wird kopiert); unterscheiden sich benachbarte dx um höchstens 1 px, bleibt der Zusammenhang erhalten. ClipError, wenn etwas herausragt."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = runde(dx_fn(y))
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out
