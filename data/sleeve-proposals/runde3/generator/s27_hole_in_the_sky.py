# -*- coding: utf-8 -*-
"""27 Riss im Himmel – der Taghimmel über den Himmelsinseln bricht auf: aus einem dunkelroten Strudel mit
rot glühenden Sprüngen purzeln die niedlichen Wesen aus „Hole in the Sky“ heraus; unten gibt eine kleine
Himmelsinsel den Maßstab.

Runde 3b: ersetzt „Idol Live“ (eines von vier Konzert-Motiven). Einheitlich 3×.

Quellen (MotiveMoe.xcf):
  - Ebene 553 „Hintergrund“: Himmel mit Wolken
  - Ebene 360 „Hole in the Sky #2“: rote Sprunglinien (1 px breit → im 3×-Raster 3 px), zweimal (gedreht) gesetzt
  - Ebene 359 „Hole in the Sky #1“: vier Wesen (Fledermaus-Häschen, Geistervogel, grau geflügeltes Häschen,
    Katze auf schwarzem Flügel) – Karte „Hole in the Sky“, Regel-B-Vergleich mit „Sichtbar #151“: vollständig
  - Ebene 447 „Kleine Insel“: Grasinsel unten
  Der Strudel selbst: selbst gezeichnet (Rule D) – die Vorlage Ebene 361 ist weich gemalt/unscharf; hier als
  Spirale in 5 Dunkelrot-Stufen mit geordnetem Dithering im 3×-Raster, Farben aus Ebene 361 entnommen.
Skalierung: alles 3× (Szene im nativen Raster 84×117 gebaut und als Ganzes verdreifacht).
"""
from common import *
from e_util import upcanvas, small_canvas
import numpy as np, math

F = 'MotiveMoe'
K = 3


def vortex(cv, cx, cy, R):
    H, W = cv.a.shape[:2]
    Y, X = np.mgrid[0:H, 0:W]
    dx, dy = X - cx + 0.5, (Y - cy + 0.5) * 1.1
    r = np.hypot(dx, dy); ang = np.arctan2(dy, dx)
    # unregelmäßiger Rand
    edge = R * (1 + 0.10 * np.sin(5 * ang + 1.3) + 0.06 * np.sin(11 * ang))
    inside = r < edge
    rn = r / edge
    # Spiralarme
    s = 0.5 + 0.5 * np.sin(3 * ang + rn * 7.0)
    t = np.clip(0.85 - rn * 0.75 + (s - 0.5) * 0.7, 0, 1)      # 1 = Zentrum (Glut)
    pal = np.array([(20, 4, 10), (44, 8, 16), (74, 14, 20), (104, 22, 24), (150, 36, 28), (200, 70, 36)])
    lv = np.floor(t * 4 + BAYER4[Y % 4, X % 4] * 0.999).astype(int).clip(0, 4)
    # Glut im Zentrum
    glow = rn < 0.28
    lvl = np.where(glow, 4 + (rn < 0.14).astype(int), lv)
    lvl = np.where(glow & (BAYER4[Y % 4, X % 4] > 0.6) & (rn > 0.2), 3, lvl)
    col = pal[lvl]
    cv.a[inside] = col[inside]
    # dunkler Randsaum
    rim = (r >= edge) & (r < edge + 1.2)
    cv.a[rim] = (30, 6, 12)


def build():
    cv = small_canvas(K)                           # 84×117
    H, W = cv.a.shape[:2]
    sky = layer(F, 553)
    cv.a[:] = sky[222:222 + H, 196:196 + W, :3]
    CX, CY = 42, 42
    # Himmel rund um den Riss leicht rötlich verfärbt (gedithert, 3 Stufen)
    Y, X = np.mgrid[0:H, 0:W]
    d = np.hypot(X - CX, (Y - CY) * 1.1)
    q = np.clip(1 - (d - 16) / 62.0, 0, 1)
    q = np.floor(q * 4 + BAYER4[Y % 4, X % 4]) / 4 * 0.8
    cv.a[:] = (cv.a * (1 - q[..., None]) + np.array((46, 10, 44)) * q[..., None]).astype(np.uint8)

    # Sprünge im Himmel
    cr = compose(F, [360])                         # 67×91
    cr2 = rot90(flip(cr), 1)                       # 91×67
    m = np.zeros((H, W), bool)
    for c, dx, dy in ((cr, 0, 0), (cr2, 2, 6)):
        x0, y0 = CX - c.shape[1] // 2 + dx, CY - c.shape[0] // 2 + dy
        for yy, xx in zip(*np.where(c[..., 3] > 0)):
            if 0 <= y0 + yy < H and 0 <= x0 + xx < W: m[y0 + yy, x0 + xx] = True
    import cv2
    halo = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    cv.a[halo & ~m] = (cv.a[halo & ~m] * 0.45 + np.array((110, 10, 30)) * 0.55).astype(np.uint8)
    cv.a[m] = (236, 52, 44)

    vortex(cv, CX, CY, 21)

    # kleine Himmelsinsel unten (Maßstab, Boden)
    isl = compose(F, [447])
    cv.paste(isl, -22, 96)

    # Wesen purzeln aus dem Strudel
    cre = parts(sprite('e27_hole_creatures', F, [359]), dil=1)
    bat, ghost, grey, cat = cre[0], cre[1], cre[2], cre[3]
    cv.paste(ghost, 50, 12)
    cv.paste(cat, 8, 22)
    cv.paste(bat, 58, 46)
    cv.paste(grey, 14, 66)
    vignette(cv, 0.3, 0.62)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '27_riss_im_himmel.png'))
