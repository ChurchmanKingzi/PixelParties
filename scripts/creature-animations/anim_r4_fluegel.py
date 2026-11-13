# -*- coding: utf-8 -*-
"""Runde 4, Gruppe „Flügel“: handgezeichnete Flügel-Schlüsselposen (Pixel für Pixel als Textzeilen im Skript) statt rechnerisch gedrehter/gescherter Flügel.

    pose(zeilen, farben, x0, y0, H, W, pad_l, pad_t)   # Textzeilen → RGBA-Ebene auf der Arbeitsleinwand; (x0, y0) = Sprite-Koordinate des linken oberen Zeichens
    spiegeln(ebene, achse2)                            # Ebene waagerecht spiegeln (achse2 = 2 × Spiegelachse in Leinwandspalten)
    takt(folge, i)                                     # Pose des Frames i aus einer Posenfolge (Liste, Länge = Schlagdauer)
    ohne_innenluecken(f, wing, koerper)                # Prüfhilfe: Hintergrundpixel, die von Figur umschlossen sind
"""
import numpy as np


def pose(zeilen, farben, x0, y0, H, W, pad_l, pad_t):
    a = np.zeros((H, W, 4), np.uint8)
    for r, z in enumerate(zeilen):
        for c, ch in enumerate(z):
            if ch in '. ':
                continue
            y, x = pad_t + y0 + r, pad_l + x0 + c
            assert 0 <= y < H and 0 <= x < W, f'Pose ragt aus der Leinwand: ({x},{y})'
            a[y, x, :3] = farben[ch]
            a[y, x, 3] = 255
    return a


def spiegeln(ebene, achse2):
    """x → achse2 − x (achse2 = Summe zweier spiegelgleicher Leinwandspalten)."""
    out = np.zeros_like(ebene)
    h, w = ebene.shape[:2]
    ys, xs = np.nonzero(ebene[..., 3])
    nx = achse2 - xs
    assert (nx >= 0).all() and (nx < w).all(), 'Spiegelbild ragt aus der Leinwand'
    out[ys, nx] = ebene[ys, xs]
    return out


def takt(folge, i):
    return folge[i % len(folge)]


def text(a, farben, x0, y0, x1, y1):
    """Ausschnitt einer Ebene als Textzeilen (zum Abzeichnen/Prüfen)."""
    rück = {tuple(v): k for k, v in farben.items()}
    return [''.join(rück[tuple(int(v) for v in a[y, x, :3])] if a[y, x, 3] else '.' for x in range(x0, x1)) for y in range(y0, y1)]
