# -*- coding: utf-8 -*-
"""Eigene Bausteine der Gruppe „Flieger“ (Korrekturrunde 3, Flügelschlag) — baut auf anim_lib auf, ändert keine gemeinsamen Module.

    luecken_fuellen(f, max_flaeche)    vom Rand aus nicht erreichbare leere Stellen (Löcher in der Figur, z. B. Naht zwischen starrer Schulter und gedrehtem Flügel) mit der
                                       häufigsten Nachbarfarbe füllen (nur Quellfarben, 4er-Nachbarn); Löcher größer als max_flaeche bleiben (echte Öffnungen, z. B. zwischen Flügel und Körper).
                                       ausser = Maske (Leinwand) von Löchern, die schon im Original vorhanden sind und bleiben sollen (Frame 0 = Original)
    eingeschlossen(maske)              Löcher des Originals (für luecken_fuellen(ausser=…))
    gespiegelt(a, achse_x)             Ebene an der Spalte achse_x (kann .5 sein) spiegeln
    glatt(a, min_nachbarn)             einzelne Spitzenpixel (weniger als `min_nachbarn` belegte 4er-Nachbarn) entfernen
"""
import cv2
import numpy as np

import anim_lib as L


def luecken_fuellen(f, max_flaeche=6, wiederholungen=3, ausser=None):
    h, w = f.shape[:2]
    out = f.copy()
    for _ in range(wiederholungen):
        leer = (out[..., 3] == 0).astype(np.uint8)
        n, lab = cv2.connectedComponents(leer, connectivity=4)
        rand_labels = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
        geaendert = False
        for k in range(1, n):
            if k in rand_labels:
                continue
            ys, xs = np.nonzero(lab == k)
            if len(ys) > max_flaeche:
                continue
            if ausser is not None and ausser[ys, xs].any():
                continue
            for y, x in zip(ys, xs):
                farben = []
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and out[yy, xx, 3]:
                        farben.append(tuple(int(v) for v in out[yy, xx, :3]))
                if farben:
                    c = max(set(farben), key=farben.count)
                    out[y, x, :3] = c
                    out[y, x, 3] = 255
                    geaendert = True
        if not geaendert:
            break
    return out


def eingeschlossen(maske):
    """Leere Stellen der Figurenmaske (bool, Leinwand mit freiem Rand), die vom Rand aus nicht erreichbar sind (4er-Nachbarschaft): die Löcher des Originals."""
    leer = (~maske).astype(np.uint8)
    n, lab = cv2.connectedComponents(leer, connectivity=4)
    rand = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    return np.isin(lab, [k for k in range(1, n) if k not in rand])


def gespiegelt(a, achse_x):
    h, w = a.shape[:2]
    out = L.leer(h, w)
    for x in range(w):
        xm = int(round(2 * achse_x - x))
        if 0 <= xm < w:
            out[:, xm] = a[:, x]
    return out


def glatt(a, min_nachbarn=2):
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    out = a.copy()
    out[m & (n4 < min_nachbarn)] = 0
    return out
