# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „tier“ (Runde 2): Laufzyklen für kleine Vierbeiner und gemeinsame Hilfen.

Baut auf anim_lib / anim_tiere auf (nur ganze Pixel, kein Alpha, nur Quellfarben).

    gang(i, n, phase)                         # Fußbahn eines Beins im Laufzyklus: (dx, lift) in Pixeln
    bein_zeichnen(ebene, spec, y_top, y_end, dx, ox, oy)   # Bein prozedural zeichnen (Füllung + geschlossener Umriss)
    zeilen_versatz(a, {y: dx})                # ganze Zeilen starr verschieben (Scherung eines Beins)
"""
import math

import numpy as np

import anim_lib as L


def runde(v):
    """Kaufmännisch runden (0,5 → 1), symmetrisch zu 0 — Python-round() rundet sonst auf gerade Zahlen."""
    return int(math.floor(abs(v) + 0.5)) * (1 if v >= 0 else -1)


def gang(f, amp=2.0, schwung=0.3, hub=2.0):
    """Fußbahn eines Beins im Laufzyklus. f = Zyklusphase des Beins (0…1, nur der Bruchteil zählt).
    Schwungphase f ∈ [0, schwung): der Fuß hebt ab und schwingt von hinten (+amp) nach vorn (−amp), Hubhöhe sin-förmig bis `hub`.
    Standphase: der Fuß steht am Boden und wandert (relativ zum Körper) gleichmäßig von vorn (−amp) nach hinten (+amp).
    Rückgabe (dx, lift) als Fließkommazahlen; das Aufrunden macht der Aufrufer."""
    f %= 1.0
    if f < schwung:
        p = f / schwung
        return amp - 2 * amp * p, hub * math.sin(math.pi * p)
    p = (f - schwung) / (1 - schwung)
    return -amp + 2 * amp * p, 0.0


def bein_zeichnen(ebene, zeilen, y_top, y_end, dx, farbe_umriss, ecke='L', ox=0, oy=0, verdeckt_ab=None):
    """Zeichnet ein Bein auf `ebene` (Leinwand, RGBA): Füllzeilen y_top…y_end (Sprite-Koordinaten), Fuß unten bei y_end + 1 (Umrisszeile).
    zeilen = Liste (x_links, [Farben]) je Füllzeile von oben; reicht sie nicht, wird die letzte wiederholt.
    dx = Versatz des Fußes gegenüber der Hüfte (Scherung: Zeile k wandert um round(dx·(k+1)/(n+1)), die Fußzeile um dx).
    Der Umriss (Farbe `farbe_umriss`) wird als 4er-Rand um die Füllung neu gezogen, plus die Fußzeile (mit einer Ecke auf Seite `ecke` 'L'/'R', wie
    der Huf im Original); er ist damit in jeder Pose geschlossen. Die Zeile y_top − 1 (Hüfte) bekommt keinen Umriss (liegt unter/vor dem Körper)."""
    n = y_end - y_top + 1
    if n < 1:
        return ebene
    fuell = {}
    for k in range(n):
        s = runde(dx * (k + 1) / (n + 1))
        xl, cols = zeilen[min(k, len(zeilen) - 1)]
        for j, c in enumerate(cols):
            fuell[(xl + s + j, y_top + k)] = c
    umriss = set()
    for (x, y) in fuell:
        for (ax, ay) in ((x - 1, y), (x + 1, y)):
            if (ax, ay) not in fuell:
                umriss.add((ax, ay))
    xl, cols = zeilen[min(n - 1, len(zeilen) - 1)]
    s = runde(dx * n / (n + 1))
    xs = [x for (x, y) in fuell if y == y_end]
    for x in xs:
        umriss.add((x, y_end + 1))
    umriss.add((min(xs) - 1, y_end + 1) if ecke == 'L' else (max(xs) + 1, y_end + 1))
    for (x, y), c in fuell.items():
        ebene[y + oy, x + ox, :3] = c
        ebene[y + oy, x + ox, 3] = 255
    for (x, y) in umriss:
        if (x, y) in fuell:
            continue
        ebene[y + oy, x + ox, :3] = farbe_umriss
        ebene[y + oy, x + ox, 3] = 255
    return ebene


def zeilen_versatz(a, versatz):
    """Zeilen y → starr um versatz[y] (px, waagerecht) verschieben; nicht genannte Zeilen bleiben. ClipError, wenn etwas herausragt."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        d = int(versatz.get(y, 0))
        if xs_.min() + d < 0 or xs_.max() + d >= w:
            raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + d] = a[y, x]
    return out
