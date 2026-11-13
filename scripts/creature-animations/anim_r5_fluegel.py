# -*- coding: utf-8 -*-
"""Runde 5, Gruppe „Drachen“: der GANZE Flügel bewegt sich als Einheit um sein Gelenk am Körper (Nutzer: „schlägt nur mit der oberen Hälfte der Flügel statt mit den ganzen“).

    starr_gedreht(ebene, px, py, w, umriss)        # Flügel als starres Ganzes um (px, py) gedreht NEU aufgebaut: Fläche per 3×3-Überabtastung (glatte Kanten), Innenfarben per Nächster-Nachbar aus der Quelle,
                                                   # Umriss NICHT mitgedreht, sondern danach neu gezogen (umriss_ziehen) → immer genau 1 px
    scher_drehung(ebene, px, py, w)                # kleine Drehung (wenige Grad) als Doppel-Scherung: Spalten wandern senkrecht, Zeilen waagerecht, jeweils proportional zum Abstand vom Gelenk — nur ganze
                                                   # Pixelverschiebungen, keine Umtastung schräger Linien (für ruhiges Heben/Senken)
    umriss_ziehen(fluegel, vorn, umriss)           # jedes Flügelpixel mit freiem 4er-Nachbarn (weder Flügel noch davorliegender Körper) wird Umrissfarbe
    spiegeln(ebene, achse2)                        # waagerecht spiegeln (x → achse2 − x)
Winkel w in Bogenmaß, positiv = im Uhrzeigersinn auf dem Bild (linker Flügel: Spitze hebt sich). Koordinaten = Leinwandpixel, Pixelmitte bei +0,5.
"""
import math

import numpy as np


def spiegeln(ebene, achse2):
    out = np.zeros_like(ebene)
    ys, xs = np.nonzero(ebene[..., 3])
    nx = achse2 - xs
    assert (nx >= 0).all() and (nx < ebene.shape[1]).all(), 'Spiegelbild ragt aus der Leinwand'
    out[ys, nx] = ebene[ys, xs]
    return out


def _zurueck(x, y, px, py, c, s):
    """Zielpunkt → Quellpunkt (Drehung um −w)."""
    dx, dy = x - px, y - py
    return px + dx * c + dy * s, py - dx * s + dy * c


def starr_gedreht(ebene, px, py, w, umriss):
    h, wd = ebene.shape[:2]
    m = ebene[..., 3] > 0
    ist_umriss = (ebene[..., :3] == np.array(umriss, np.uint8)).all(axis=2) & m
    innen = m & ~ist_umriss
    iy, ix = np.nonzero(innen)
    c, s = math.cos(w), math.sin(w)
    out = np.zeros_like(ebene)
    ys, xs = np.nonzero(m)
    r = int(math.ceil(max(math.hypot(x + 0.5 - px, y + 0.5 - py) for x, y in zip(xs, ys)))) + 2
    sub = (1 / 6, 3 / 6, 5 / 6)
    for Y in range(max(0, int(py) - r), min(h, int(py) + r + 1)):
        for X in range(max(0, int(px) - r), min(wd, int(px) + r + 1)):
            n = 0
            for sy in sub:
                for sx in sub:
                    qx, qy = _zurueck(X + sx, Y + sy, px, py, c, s)
                    jx, jy = int(math.floor(qx)), int(math.floor(qy))
                    if 0 <= jx < wd and 0 <= jy < h and m[jy, jx]:
                        n += 1
            if n < 5:
                continue
            qx, qy = _zurueck(X + 0.5, Y + 0.5, px, py, c, s)
            jx, jy = int(math.floor(qx)), int(math.floor(qy))
            if 0 <= jx < wd and 0 <= jy < h and innen[jy, jx]:
                out[Y, X] = ebene[jy, jx]
            elif len(iy):
                k = int(np.argmin((ix + 0.5 - qx) ** 2 + (iy + 0.5 - qy) ** 2))      # nächstes Innenpixel der Quelle (Umrisslinien werden nicht mitgedreht)
                out[Y, X] = ebene[iy[k], ix[k]]
            else:
                out[Y, X, :3] = umriss
            out[Y, X, 3] = 255
    # einzelne abstehende Pixel (Zacken der Abtastung: höchstens ein 4er-Nachbar) entfernen — ein Durchgang, echte Spitzen bleiben bis auf ihr letztes Pixel erhalten
    mm = out[..., 3] > 0
    nb = np.zeros(mm.shape, int)
    nb[1:] += mm[:-1]; nb[:-1] += mm[1:]; nb[:, 1:] += mm[:, :-1]; nb[:, :-1] += mm[:, 1:]
    out[mm & (nb <= 1)] = 0
    return out


def loecher_schliessen(f, ausser, farbe, max_px=4):
    """Vom Rand nicht erreichbare Hintergrundinseln ≤ max_px (schmale Schlitze zwischen Flügel und Körper), die nicht schon in der Quelle offen sind (`ausser`), in `farbe` schließen."""
    import cv2
    frei = (f[..., 3] == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(frei, connectivity=4)
    aussen = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    for c in range(1, n):
        if c in aussen:
            continue
        ys, xs = np.nonzero(lab == c)
        if len(ys) <= max_px and not ausser[ys, xs].any():
            f[ys, xs, :3] = farbe
            f[ys, xs, 3] = 255
    return f


def scher_drehung(ebene, px, py, w):
    h, wd = ebene.shape[:2]
    out = np.zeros_like(ebene)
    for Y in range(h):
        for X in range(wd):
            y = Y - int(round(w * (X + 0.5 - px)))
            if not 0 <= y < h:
                continue
            x = X + int(round(w * (y + 0.5 - py)))
            if 0 <= x < wd and ebene[y, x, 3]:
                out[Y, X] = ebene[y, x]
    return out


def umriss_ziehen(fluegel, vorn, umriss):
    """vorn: Maske (H×W bool) der davorliegenden Figur. Verändert `fluegel` nicht, gibt eine Kopie zurück."""
    out = fluegel.copy()
    h, wd = out.shape[:2]
    belegt = (fluegel[..., 3] > 0) | vorn
    for y, x in zip(*np.nonzero(fluegel[..., 3])):
        if vorn[y, x]:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < h and 0 <= xx < wd) or not belegt[yy, xx]:
                out[y, x, :3] = umriss
                break
    return out
