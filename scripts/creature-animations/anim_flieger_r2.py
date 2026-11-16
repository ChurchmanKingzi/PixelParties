# -*- coding: utf-8 -*-
"""Eigene Bausteine der Gruppe „Flieger“ (Korrekturrunde 2) — baut auf anim_lib auf, ändert keine gemeinsamen Module.

    biege(a, p0, ang0, laenge, delta_fn)    Flügel/Schwanz entlang einer GEKRÜMMTEN Mittellinie neu abtasten (Rückwärtsabbildung, Nächster-Nachbar):
                                            jedes Zielpixel holt sich das Quellpixel an derselben Stelle der Bogenlänge und desselben Querabstands.
                                            Keine Mischfarben, keine Löcher, konstante Breite, die Wurzel bleibt am Körper (delta_fn(s) = 0 an der Wurzel).
    inseln_weg(a, min_px)                   kleine 4-verbundene Reste (Abtast-Staub an den Kanten) entfernen

Winkel in rad, y zeigt nach unten: positiv = im Uhrzeigersinn auf dem Bildschirm (wie anim_flieger.drehen).
"""
import math

import cv2
import numpy as np

import anim_lib as L


def inseln_weg(a, min_px=4):
    """Kleine 4-verbundene Reste (Abtast-Staub an den Flügelkanten) entfernen; der größte Teil bleibt."""
    n, lab = cv2.connectedComponents((a[..., 3] > 0).astype(np.uint8), connectivity=4)
    if n <= 2:
        return a
    out = a.copy()
    groessen = [int((lab == k).sum()) for k in range(n)]
    haupt = int(np.argmax(groessen[1:])) + 1
    for k in range(1, n):
        if k != haupt and groessen[k] < min_px:
            out[lab == k] = 0
    return out


def biege(a, p0, ang0, laenge, delta_fn, ds=0.25, s_min=-6.0, s_extra=4.0, inseln=4):
    """Ebene `a` (volle Leinwand) entlang der gebogenen Mittellinie neu abtasten.
    p0 = Wurzelpunkt (x, y) in Leinwandkoordinaten, ang0 = Richtung der Quellachse zur Spitze (rad), laenge = Länge der Achse (px),
    delta_fn(s) = Zusatzwinkel der Mittellinie an der Bogenlänge s (0 an der Wurzel, wächst zur Spitze; der Aufrufer bestimmt Takt, Verzögerung, Drehsinn).
    Zielpixel (x, y) → nächster Punkt der gebogenen Mittellinie (Bogenlänge s, Querabstand q) → Quellpixel an p0 + s·u0 + q·n0 (u0 = Quellrichtung,
    n0 = Quernormale). Bei delta ≡ 0 ist die Abbildung die Identität. inseln: Reste kleiner als dieser Wert entfallen (0 = aus)."""
    h, w = a.shape[:2]
    ss = np.arange(s_min, laenge + s_extra + 1e-9, ds)
    phi = ang0 + np.array([delta_fn(s) for s in ss])
    i0 = int(np.argmin(np.abs(ss)))
    cx, cy = np.zeros_like(ss), np.zeros_like(ss)
    cx[i0], cy[i0] = p0
    for k in range(i0 + 1, len(ss)):
        pm = 0.5 * (phi[k] + phi[k - 1])
        cx[k], cy[k] = cx[k - 1] + math.cos(pm) * ds, cy[k - 1] + math.sin(pm) * ds
    for k in range(i0 - 1, -1, -1):
        pm = 0.5 * (phi[k] + phi[k + 1])
        cx[k], cy[k] = cx[k + 1] - math.cos(pm) * ds, cy[k + 1] - math.sin(pm) * ds
    # nur Zielpixel im Umkreis der Mittellinie betrachten (Rechenzeit)
    X, Y = np.meshgrid(np.arange(w), np.arange(h))
    X, Y = X.ravel().astype(float), Y.ravel().astype(float)
    D = (X[:, None] - cx[None, :]) ** 2 + (Y[:, None] - cy[None, :]) ** 2
    k = np.argmin(D, axis=1)
    dx, dy = X - cx[k], Y - cy[k]
    cp, sp_ = np.cos(phi[k]), np.sin(phi[k])
    along = dx * cp + dy * sp_
    q = -dx * sp_ + dy * cp                                     # Querabstand (Normale n = (−sin φ, cos φ))
    u0 = (math.cos(ang0), math.sin(ang0))
    n0 = (-math.sin(ang0), math.cos(ang0))
    sx = p0[0] + ss[k] * u0[0] + q * n0[0]
    sy = p0[1] + ss[k] * u0[1] + q * n0[1]
    ix, iy = np.floor(sx + 0.5).astype(int), np.floor(sy + 0.5).astype(int)
    ok = (np.abs(along) <= 1.0) & (ix >= 0) & (ix < w) & (iy >= 0) & (iy < h)
    out = L.leer(h, w)
    ok_idx = np.nonzero(ok)[0]
    quelle = a[iy[ok_idx], ix[ok_idx]]
    treffer = quelle[:, 3] > 0
    out.reshape(-1, 4)[ok_idx[treffer]] = quelle[treffer]
    return inseln_weg(out, inseln) if inseln else out
