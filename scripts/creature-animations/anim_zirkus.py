# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Fun-Fun Circus“ (Elefant, Strongman, Direktor, Clown). Baut auf anim_lib / anim_humanoide auf
(nur ganze Pixel, kein Alpha, nur Farben des Sprites).

    spalten_ring(a, spalten, y0, y1, schritt)   Pixel einer Spalte kreisen zyklisch im Bereich y0…y1 abwärts (Blutstropfen laufen herunter, Schleife nahtlos)
    zeilen_scherung(a, off, y_unten, amp, y_oben)   Ballonbündel schwankt: jede Zeile über y_unten wird um round(amp · (y_unten − y)/(y_unten − y_oben)) waagerecht verschoben (starr je Zeile, Gefälle ≤ 1 px)
    ring_streifen(a, off, zeilen, x0, x1, muster, versatz)   Laufstreifen (Podest): Muster der Periode 4 läuft waagerecht
    kugel_drehen(a, off, maske, phase)   Kugel „dreht“: je Zeile kreisen die Innenpixel zyklisch (Phase 0…1 = eine volle Umdrehung je Schleife)
    konfetti(...)                         fallendes Konfetti (2×2) mit Schrumpfen am Anfang/Ende
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L


def rund(v):
    return int(math.copysign(math.floor(abs(v) + 0.5), v))


def spalten_ring(a, off, spalten, y0, y1, schritt):
    """Für jede Spalte x (Spritekoordinate) in `spalten` (Dict x -> (y0, y1)) kreisen deren Pixel im Bereich y0…y1 (Spritekoordinaten) um `schritt` Zeilen nach unten
    (ein Pixel, das unten herausläuft, erscheint oben wieder). schritt darf eine Zahl oder Dict x -> Zahl sein."""
    for x, (ya, yb) in spalten.items():
        s = schritt[x] if isinstance(schritt, dict) else schritt
        X = x + off[0]
        R = yb - ya + 1
        if R <= 0 or s % R == 0:
            continue
        col = {y: a[y + off[1], X].copy() for y in range(ya, yb + 1) if a[y + off[1], X, 3]}
        for y in col:
            a[y + off[1], X] = 0
        for y, px in col.items():
            a[ya + (y - ya + s) % R + off[1], X] = px
    return a


def zeilen_scherung(a, off, y_unten, amp, y_oben, bis_x=None):
    """Bündel (Ballons) pendelt: Zeile y (Spritekoordinate, y_oben ≤ y < y_unten) rückt um rund(amp·(y_unten − y)/(y_unten − y_oben)) px waagerecht; darunter bleibt alles."""
    out = L.leer(*a.shape[:2])
    for Y in range(a.shape[0]):
        xs = np.nonzero(a[Y, :, 3])[0]
        if not len(xs):
            continue
        y = Y - off[1]
        f = max(0.0, (y_unten - y) / float(y_unten - y_oben))
        dx = rund(amp * f)
        if xs.min() + dx < 0 or xs.max() + dx >= a.shape[1]:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        out[Y, xs + dx] = a[Y, xs]
    return out


def ring_streifen(a, off, zeilen, x0, x1, periode, versatz, quelle):
    """Laufstreifen: in den Spritezeilen `zeilen` (x0…x1 einschließlich) steht an Spalte x das Quellpixel der Spalte x0 + ((x − x0 − versatz) mod periode) — das Muster
    läuft um `versatz` Pixel nach rechts. Frame mit versatz % periode == 0 = Original (wenn die Quelle in x0…x1 periodisch ist)."""
    for y in zeilen:
        for x in range(x0, x1 + 1):
            sx = x0 + ((x - x0 - versatz) % periode)
            a[y + off[1], x + off[0]] = quelle[y, sx]
    return a


def kugel_drehen(a, off, innen, phase):
    """Kugel dreht: für jede Zeile y kreisen die Pixel der Maske `innen` (Spritekoordinaten, zusammenhängende Innenpixel der Zeile) um rund(phase · Breite) px.
    Phase 0 = Original, Phase 1 = wieder Original (volle Umdrehung je Schleife)."""
    for y in range(innen.shape[0]):
        xs = np.nonzero(innen[y])[0]
        if len(xs) < 2:
            continue
        x0, x1 = xs.min(), xs.max()
        w = x1 - x0 + 1
        s = int(math.floor(phase * w + 1e-9)) % w
        if s == 0:
            continue
        seg = {x: a[y + off[1], x + off[0]].copy() for x in range(x0, x1 + 1)}
        for x in range(x0, x1 + 1):
            a[y + off[1], x + off[0]] = seg[x0 + ((x - x0 - s) % w)]
    return a
