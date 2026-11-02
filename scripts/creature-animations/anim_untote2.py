# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Untote 2“ (Skelette, Ghoul, Mumien, Würmer, Maschine, Sarkophag) — baut auf anim_lib,
anim_untote (U) und anim_humanoide (Hm) auf, ändert sie nicht. Alles Pixelart: nur ganze Pixel, kein Alpha, nur Farben des Sprites.
Alle Funktionen erwarten Ebenen auf der VOLLEN Leinwand (L.platz) und werfen ClipError, wenn etwas herausragen würde.

    sn(i, per, ph)                   sin(2π·i/per + ph)
    hub(i, per, amp, ph)             ganzzahliger Hub amp·(sin − sin(ph)), 0 bei i = 0 (Ruhepose)
    ebene(spr, maske, H, W, off)     Teil des Sprites (Maske in Sprite-Koordinaten) auf die volle Leinwand legen
    streck_teil(a, maske, zeile, n)  Atmen nur an einem Teil (Maske in Leinwand-Koordinaten): Zeile n-mal einfügen, alles darüber steigt
    zeilen_versatz4(a, offs)         Zeilen waagerecht verschieben, Unterschied benachbarter Zeilen ≤ 1 (bleibt 4-verbunden)
    wellen_offs(...)                 Wanderwelle als Zeilenversatz (Wurm), ganzzahlig, Gefälle ≤ 1 je Zeile, Fuß fest
    komp4(a)                         Anzahl der 4-verbundenen Flecken (Wurm darf nie zerreißen)
    rampe_hell(spr)                  {Farbe: nächsthellere Farbe derselben Rampe} aus den Farben des Sprites (für Metallglanz)
    glanz_band(...)                  diagonales Lichtband über eine Pixelmenge (nur Metall, Gold, Edelstein)
    pruefen_modul(...)               in tools/check.py (nicht im Repo)
"""
import math

import numpy as np

import anim_lib as L
import anim_untote as U


def sn(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def hub(i, per, amp, ph=0.0):
    """Ganzzahliger Hub amp·(sin(2πi/per+ph) − sin(ph)): bei i = 0 genau 0 (Ruhepose = Original)."""
    return int(round(amp * (sn(i, per, ph) - math.sin(ph))))


def stufen(i, per, hoch, ph=0.0):
    """0 … hoch, sanft (1 − cos), 0 bei i = 0 (ph = 0)."""
    return int(round(hoch * (0.5 - 0.5 * math.cos(2 * math.pi * i / per + ph))))


def fenster(i, n, start, laenge):
    """1 im Fenster [start, start+laenge) (mod n), sonst 0."""
    return 1 if 0 <= (i - start) % n < laenge else 0


def folge(i, n, start, werte):
    """werte[k] im Frame start+k (mod n), sonst None."""
    k = (i - start) % n
    return werte[k] if 0 <= k < len(werte) else None


def ebene(spr, maske, H, W, off):
    """Pixel von spr (Maske in Sprite-Koordinaten) auf eine leere Leinwand H×W legen (Versatz off = (ox, oy))."""
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, off[0], off[1])


def streck_teil(a, maske, zeile, n):
    """Nur die Pixel in `maske` (Leinwand-Koordinaten) atmen: `zeile` wird n-mal zusätzlich eingefügt (Texturmischung von L.streck_zeile),
    alles darüber steigt um n. Der Rest bleibt stehen. Gibt die neue Ebene zurück (Maske und Rest zusammengelegt)."""
    if n <= 0:
        return a.copy()
    teil, rest = L.trenne(a, maske)
    teil = L.streck_zeile(teil, zeile, n)
    return L.zusammen(a.shape[0], a.shape[1], [(rest, 0, 0), (teil, 0, 0)])


def zeilen_versatz4(a, offs, y0=None, y1=None):
    """Ganze Zeilen y (Leinwandzeilen) um offs[y] px waagerecht schieben (nur Zeilen von y0 bis y1, sonst alle in offs). Das Gefälle zwischen
    benachbarten Zeilen wird auf ≤ 1 px begrenzt (sonst reißt die Röhre auf); ClipError beim Herausragen."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        dx = int(offs.get(y, 0))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[y, x + dx] = a[y, x]
    return out


def glatt(offs, ys):
    """Gefälle ≤ 1 je Zeile erzwingen (ys = Zeilen in Reihenfolge von der festen Stelle zur freien): offs[y] ← innerhalb ±1 des Vorgängers."""
    res = dict(offs)
    for k in range(1, len(ys)):
        a, b = res.get(ys[k - 1], 0), res.get(ys[k], 0)
        res[ys[k]] = max(a - 1, min(a + 1, b))
    return res


def wellen_offs(ys, amp, i, per, wellenlaenge, ph=0.0, potenz=1.0, ruhe=True):
    """Wanderwelle: für jede Zeile y aus `ys` (Reihenfolge: feste Stelle (Fuß) → freies Ende) der Versatz
    round(amp·f^potenz·(sin(2π(i/per − k/wellenlaenge) + ph) − Ruhe)) mit f = k/(n−1) (k = Index in ys). Fuß (k = 0) bleibt stehen, das Gefälle ist
    ≤ 1 je Zeile. ruhe=True: wird so verschoben, dass Frame 0 der Ruhepose (Versatz 0) entspricht (die Welle wird bei i = 0 abgezogen)."""
    n = len(ys)
    res = {}
    for k, y in enumerate(ys):
        f = (k / max(1, n - 1)) ** potenz
        w = math.sin(2 * math.pi * (i / per - k / wellenlaenge) + ph)
        w0 = math.sin(2 * math.pi * (0 - k / wellenlaenge) + ph) if ruhe else 0.0
        res[y] = int(round(amp * f * (w - w0)))
    return glatt(res, list(ys))


def komp4(a):
    """Anzahl der 4-verbundenen Flecken der deckenden Pixel."""
    m = a[..., 3] > 0
    h, w = m.shape
    seen = np.zeros_like(m)
    n = 0
    for y in range(h):
        for x in range(w):
            if m[y, x] and not seen[y, x]:
                n += 1
                st = [(y, x)]
                seen[y, x] = True
                while st:
                    cy, cx = st.pop()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
    return n


def rgb(a, x, y):
    return tuple(int(v) for v in a[y, x, :3])


def setze(a, pixel, off=(0, 0)):
    """{(x, y): farbe oder None} in a schreiben (Sprite-Koordinaten + off). None löscht das Pixel."""
    h, w = a.shape[:2]
    for (x, y), c in pixel.items():
        X, Y = x + off[0], y + off[1]
        if not (0 <= X < w and 0 <= Y < h):
            raise L.ClipError(f'Pixel ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        if c is None:
            a[Y, X] = 0
        else:
            a[Y, X, :3] = c
            a[Y, X, 3] = 255
    return a


def lies(a, pts, off=(0, 0)):
    return {(x, y): (rgb(a, x + off[0], y + off[1]) if a[y + off[1], x + off[0], 3] else None) for (x, y) in pts}


def rampe_hell(spr, nur=None, farbton=40):
    """{Farbe: nächsthellere Farbe} aus den Farben des Sprites: je Farbe die nächsthellere (Summe der RGB-Werte größer), deren Farbton ähnlich ist
    (Chroma-Abstand ≤ `farbton`) — so bleibt Grau grau und Gold gold. `nur` = Liste erlaubter Farben (sonst alle Farben des Sprites)."""
    cols = nur if nur is not None else sorted({tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, key=lambda c: sum(c))
    cols = sorted(cols, key=lambda c: sum(c))

    def chroma(c):
        m = sum(c) / 3.0
        return tuple(v - m for v in c)

    out = {}
    for c in cols:
        best = None
        for d in cols:
            if sum(d) > sum(c) and max(abs(p - q) for p, q in zip(chroma(c), chroma(d))) <= farbton:
                if best is None or sum(d) < sum(best):
                    best = d
        if best is not None:
            out[c] = best
    return out


def glanz_band(a, punkte, rampe, d, breite=2, off=(0, 0), stufen_=1):
    """Lichtband: Pixel aus `punkte` (Sprite-Koordinaten) mit d ≤ x + y < d + breite werden `stufen_` Stufen heller auf `rampe` ({Farbe: hellere Farbe}).
    Nur Pixel, deren Farbe in der Rampe steht, ändern sich."""
    for (x, y) in punkte:
        if d <= x + y < d + breite:
            X, Y = x + off[0], y + off[1]
            if a[Y, X, 3]:
                c = rgb(a, X, Y)
                for _ in range(stufen_):
                    c = rampe.get(c, c)
                a[Y, X, :3] = c
    return a


def stern(a, x, y, st, mitte, arm, off=(0, 0)):
    """Vierzackiger Glitzerstern am Objekt (Sprite-Koordinaten): st 0 = nichts, 1 = nur Mitte, 2 = Mitte + 4 Arme à 1 px. Bleibt am Objekt."""
    if st <= 0:
        return a
    pts = {(x, y): mitte}
    if st >= 2:
        pts.update({(x + 1, y): arm, (x - 1, y): arm, (x, y + 1): arm, (x, y - 1): arm})
    return setze(a, pts, off)


def verschieben_teil(a, maske, dx, dy):
    """Pixel in `maske` (Leinwand) starr um (dx, dy) verschieben; der Rest bleibt, verschobene Pixel liegen oben auf."""
    teil, rest = L.trenne(a, maske)
    return L.zusammen(a.shape[0], a.shape[1], [(rest, 0, 0), (teil, dx, dy)])
