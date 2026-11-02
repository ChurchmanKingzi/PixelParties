# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Orks & Elfen“ (Chaorcs, Elfen, Reittiere, Waldwesen) — baut auf anim_lib / anim_feuer auf und ändert sie nicht.

Alles Pixelart: nur ganze Pixel, kein Alpha, nur Farben, die schon im Sprite stehen. Alle Funktionen erwarten Ebenen auf der VOLLEN Leinwand (L.platz).

    rauschen(x, y, i, n, ...)                  zeitlich nahtloses, nach links fließendes Feld −1 … 1 (für kochendes Feuer)
    feuerball(h, w, i, n, mitte, radius, rampe, schweif, ...)   Feuerball (Regel 15): ruhiger runder Körper (kochende Farbschichten, atmender Rand) mit einem Schweif aus
                                               Flammenzungen (anim_feuer.Feuer, um 90° gedreht: „oben“ der Zunge = links) und abreißenden Funken
    spalten_welle0(a, pivot_x, amp, i, n, lauf)  Wellenlauf wie L.spalten_welle, aber Frame 0 = Ruhepose (Verschiebung relativ zu Frame 0)
    kontur(a, farbe)                            alle Randpixel (4-Nachbar leer) einer Ebene in `farbe` (Außenhaut)
"""
import math

import numpy as np

import anim_lib as L
import anim_feuer as FEU


def rauschen(x, y, i, n, z=(0.0, 0.0)):
    """Glattes, in i nahtloses (Periode n) Feld −1 … 1, das mit der Zeit nach links (−x) fließt; (z) verschiebt das Muster."""
    t = 2 * math.pi * i / n
    x, y = x + z[0], y + z[1]
    v = (math.sin(0.85 * x + 0.45 * y + t) + math.sin(0.5 * x - 0.9 * y + 2 * t + 1.3) + math.sin(1.25 * x + 0.3 * y + 3 * t + 2.1)) / 3.0
    return v


def spalten_welle0(a, pivot_x, amp, i, n, lauf=1.0, zyklen=1, potenz=1.0):
    """Wie L.spalten_welle (Spalte wandert senkrecht um round(amp · sin(Phase − lauf·Abstandsanteil) · Abstandsanteil^potenz)), aber relativ zu Frame 0:
    Frame 0 ist exakt die Ruhepose (Verschiebung 0), der Phasenlauf (laufende Welle) bleibt erhalten."""
    h, w = a.shape[:2]
    cols = [x for x in range(w) if a[:, x, 3].any()]
    maxd = max(1, max(abs(x - pivot_x) for x in cols)) if cols else 1
    out = L.leer(h, w)

    def dy(x, ii):
        frac = abs(x - pivot_x) / maxd
        return int(round(amp * math.sin(2 * math.pi * zyklen * ii / n - lauf * frac) * frac ** potenz))
    for x in cols:
        d = dy(x, i) - dy(x, 0)
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + d < 0 or ys.max() + d >= h:
            raise L.ClipError(f'Spalte {x} würde um {d} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + d, x] = a[y, x]
    return out


def kontur(a, farbe):
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    frei = (~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:])
    for y, x in zip(*np.nonzero(m & frei)):
        a[y, x, :3] = farbe
    return a


def _farbe(rampe, k):
    return tuple(rampe[k])


def feuerball_koerper(h, w, i, n, mitte, rx, ry, rampe, kern_versatz=(1.2, -0.8), ps=0.12, speckel=0.55, dy=0):
    """Runder Feuerball: Maske = Ellipse (rx, ry) um `mitte`; Farbschichten nach dem Abstand zum (verschobenen) Kern plus Rauschen:
    hell (Kern) → gelb → orange; im hellen Kern gelbe Sprenkel, im gelben Ring helle Sprenkel; Randpixel = rand (Außenhaut)."""
    out = L.leer(h, w)
    cx, cy = mitte[0], mitte[1] + dy
    cxk, cyk = cx + kern_versatz[0], cy + kern_versatz[1]
    for y in range(h):
        for x in range(w):
            rr = math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
            if rr > 1.0 + 0.13 * rauschen(x * 1.2, y * 1.2, i, n, (11.0, 4.0)):        # Rand züngelt ±1 px
                continue
            d2 = math.sqrt(((x - cxk) / (rx * 0.92)) ** 2 + ((y - cyk) / (ry * 0.92)) ** 2)
            lv = d2 + ps * rauschen(x, y, i, n)
            sp = rauschen(x * 1.7 + 3, y * 1.7 - 2, i, n, (5.0, 1.0))
            if lv < 0.60:
                c = rampe['gelb'] if sp > speckel else rampe['hell']
            elif lv < 0.80:
                c = rampe['hell'] if sp < -speckel else rampe['gelb']
            elif lv < 0.95:
                c = rampe['orange']
            else:
                c = rampe['orange'] if sp < 0.2 else rampe['rot']
            out[y, x, :3] = c
            out[y, x, 3] = 255
    # einzelne Pixel (weniger als zwei 4-Nachbarn) weglassen: keine Fusseln am Rand
    m = out[..., 3] > 0
    p = np.pad(m, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    out[m & (nb < 2)] = 0
    return out


def feuerball(h, w, i, n, mitte, rx, ry, rampe, schweif, dy=0, puls=0.5):
    """Feuerball = Körper + Schweif. `schweif` = dict(feuer=FEU.Feuer-Instanz in gedrehten Koordinaten, x0=Leinwand-x der Spalte 0 der gedrehten Ebene, y0=Leinwand-y der Zeile 0, funken_leben=…).
    Die gedrehte Feuer-Ebene E (Zeilen = Zungenrichtung, Spalten = Dicke) wird mit np.rot90 gedreht („oben“ → links)."""
    ph = 2 * math.pi * i / n
    krx = rx + puls * math.sin(2 * ph)
    kry = ry + 0.8 * puls * math.sin(2 * ph + 0.7)
    koerper = feuerball_koerper(h, w, i, n, mitte, krx, kry, rampe, dy=dy)
    fe = schweif['feuer']
    e = fe.ebene(i)
    r = np.rot90(e, 1)                                   # R[zeile, spalte]: Spalte j ↔ E-Zeile j, Zeile ↔ gespiegelte E-Spalte
    ebene_schweif = L.leer(h, w)
    x0, y0 = schweif['x0'], schweif['y0']
    rh, rw = r.shape[:2]
    for yy in range(rh):
        for xx in range(rw):
            if r[yy, xx, 3]:
                X, Y = x0 + xx, y0 + yy + dy
                if not (0 <= X < w and 0 <= Y < h):
                    raise L.ClipError(f'Schweif-Pixel ({X},{Y}) außerhalb der Leinwand {w}×{h}')
                ebene_schweif[Y, X] = r[yy, xx]
    fk = fe.funken(i, leben=schweif.get('funken_leben', 9))
    fr = np.rot90(fk, 1)
    funken = L.leer(h, w)
    for yy in range(fr.shape[0]):
        for xx in range(fr.shape[1]):
            if fr[yy, xx, 3]:
                X, Y = x0 + xx, y0 + yy + dy
                if not (0 <= X < w and 0 <= Y < h):
                    raise L.ClipError(f'Funke ({X},{Y}) außerhalb der Leinwand {w}×{h}')
                funken[Y, X] = fr[yy, xx]
    # Körper über den Schweif; Körper-Randpixel, die im Inneren der Vereinigung liegen (dort, wo der Schweif ansetzt), werden orange
    u = ebene_schweif.copy()
    km = koerper[..., 3] > 0
    u[km] = koerper[km]
    m = u[..., 3] > 0
    p = np.pad(m, 1)
    innen = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    rot = tuple(rampe['rot'])
    for y, x in zip(*np.nonzero(km & innen)):
        if tuple(int(v) for v in u[y, x, :3]) == rot:
            u[y, x, :3] = rampe['orange']
    # Außenhaut: Randpixel der Vereinigung sind rot (Regel 16)
    frei = ~innen & m
    for y, x in zip(*np.nonzero(frei)):
        u[y, x, :3] = rot
    return u, funken
