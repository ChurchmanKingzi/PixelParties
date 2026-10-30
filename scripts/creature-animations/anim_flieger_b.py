# -*- coding: utf-8 -*-
"""Hilfscode der Gruppe „Flieger“ (zweiter Animator) — baut auf anim_lib / anim_flieger auf, ändert beides nicht.

Skelett-/Fledermausflügel, die aus Schlüsselpunkten neu gezeichnet werden (Pixelart, nur ganze Pixel, nur übergebene Farben):

    pose_mix(a, b, t)                       Schlüsselposen (dict) linear mischen
    knochenflügel(h, w, pose, pal, ...)     einen linken Flügel auf eine Leinwand h×w zeichnen: Armknochen Schulter → Handgelenk,
                                            Fingerknochen (fächerförmig, mit Knick) vom Handgelenk, gezackte Flügelhaut dazwischen,
                                            Handgelenkswulst (Binde), Fingerkrallen
    spiegeln(a)                             Ebene an der senkrechten Mittelachse der Leinwand spiegeln (rechter Flügel = gespiegelter linker)
    verbunden4(a, start)                    Maske aller deckenden Pixel, die über KANTEN (4er-Nachbarschaft) mit `start` zusammenhängen
    band_hell(frame, i, n, start, dauer, rampen, ...)   diagonales Lichtband über ein fertig zusammengesetztes Bild (Glanz)
Koordinaten der Posen sind Leinwandkoordinaten (Float); gezeichnet wird auf die nächsten ganzen Pixel.
"""
import math

import numpy as np

import anim_lib as L


# ── Schlüsselposen mischen ───────────────────────────────────────────────────────────────────────────────────────────
def pose_mix(a, b, t):
    """Pose = dict aus Zahlen, Zahlen-Tupeln und -Listen. Linear zwischen a (t=0) und b (t=1)."""
    out = {}
    for k, va in a.items():
        vb = b[k]
        if isinstance(va, (tuple, list)):
            out[k] = type(va)(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = va + (vb - va) * t
    return out


def weich(t):
    """Sanftes Ein-/Ausschwingen 0…1 (Smoothstep) — Gelenkbewegung beschleunigt und bremst."""
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ── Rasterhilfen ─────────────────────────────────────────────────────────────────────────────────────────────────────
def linie(p0, p1):
    """Bresenham, Punkte (x, y) von p0 bis p1 (ganze Pixel, 8-verbunden)."""
    x0, y0 = int(round(p0[0])), int(round(p0[1]))
    x1, y1 = int(round(p1[0])), int(round(p1[1]))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy
    return pts


def linie4(p0, p1):
    """Wie linie(), aber 4-verbunden (an jeder diagonalen Stufe ein Pixel dazu) — für Knochen, die an Kanten zusammenhängen müssen."""
    pts = linie(p0, p1)
    out = [pts[0]]
    for (x, y) in pts[1:]:
        px, py = out[-1]
        if x != px and y != py:
            out.append((x, py))
        out.append((x, y))
    return out


def punkt_in_polygon(poly, x, y):
    """Strahlverfahren; poly = Liste (x, y)."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def polygon_maske(h, w, poly):
    m = np.zeros((h, w), bool)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    for y in range(max(0, int(math.floor(min(ys)))), min(h, int(math.ceil(max(ys))) + 1)):
        for x in range(max(0, int(math.floor(min(xs)))), min(w, int(math.ceil(max(xs))) + 1)):
            if punkt_in_polygon(poly, x, y):
                m[y, x] = True
    return m


def spiegeln(a):
    return a[:, ::-1].copy()


def verbunden4(a, start):
    """Alle deckenden Pixel von `a`, die über Kanten (4er-Nachbarschaft) mit den Pixeln der Maske `start` zusammenhängen."""
    h, w = a.shape[:2]
    deck = a[..., 3] > 0
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y, x in zip(*np.nonzero(start & deck))]
    for (y, x) in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and deck[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                stack.append((yy, xx))
    return seen


# ── Skelettflügel ────────────────────────────────────────────────────────────────────────────────────────────────────
def _pt(p, ang, laenge):
    r = math.radians(ang)
    return (p[0] + laenge * math.cos(r), p[1] + laenge * math.sin(r))


def knochenflügel(h, w, pose, pal, quelle, spalten, x0, y0, risse=(), adern=True):
    """Linker Flügel (Außenseite = kleineres x) auf eine leere Leinwand h×w. Die Fingerknochen tragen die Textur des gefalteten Flügels:
    Jeder Finger k ist eine Spalte `spalten[k]` des Quell-Sprites `quelle` (von Zeile y0 abwärts, Pixel für Pixel dieselben Farben: Knochen,
    braune Binden, tan Handgelenk), die um das Handgelenk fächerförmig aufgeklappt wird. Bei pose['rho'] = 1 und allen Winkeln 90° entsteht
    wieder der gefaltete Flügel.

    pose: dict(S=(x,y) Schulter am Körper, W=(x,y) Handgelenk (bei Ruhe = (x0, y0)), rho=1…0 (seitlicher Abstand der Fingerwurzeln, 1 = wie im
          Original, 0 = alle am Handgelenk), ang=[θ1..θn] Fingerwinkel in Grad (Bildkoordinaten: 90° = nach unten, 180° = nach links, 270° = nach
          oben; erster Finger = Vorderkante), len=[ℓ1..ℓn] Fingerlängen in px, knick=Grad (Fingerspitzen krümmen sich nach unten),
          hueft=(x,y) Ansatz der Flügelhaut am Körper, zacke=Tiefe der Zacken (0…0,5), wulst=0/1 Handgelenkswulst zeichnen,
          haut=0/1 Flügelhaut zeichnen).
    pal: dict(knochen=[hell, mittel, grau], haut=(innen, nah am Knochen, Rand, Ader), binde=(dunkel, mittel)).
    Reihenfolge: Haut (unten) → Adern → Arm → Finger → Handgelenk. Wirft ClipError, wenn etwas über die Leinwand ragen würde."""
    a = L.leer(h, w)
    S, Wr = pose['S'], pose['W']
    angs, lens = pose['ang'], pose['len']
    knick = pose.get('knick', 0.0)
    hueft = pose['hueft']
    zacke = pose.get('zacke', 0.3)
    rho = pose.get('rho', 0.0)
    n = len(angs)
    haut_innen, haut_nah, haut_rand, haut_ader = pal['haut']
    binde = pal['binde']

    def setze(x, y, c):
        if not (0 <= y < h and 0 <= x < w):
            raise L.ClipError(f'Flügelpixel ({x},{y}) außerhalb der Leinwand {w}×{h}')
        a[y, x, :3] = c
        a[y, x, 3] = 255

    # Fingerbahnen: Wurzel = Handgelenk + rho·(Spaltenabstand, 0); bei 55 % der Länge knickt der Finger
    starts, gel, spitze = [], [], []
    for k in range(n):
        st = (Wr[0] + rho * (spalten[k] - x0), Wr[1])
        g = _pt(st, angs[k], lens[k] * 0.55)
        starts.append(st); gel.append(g)
        spitze.append(_pt(g, angs[k] - knick, lens[k] * 0.45))

    # ---- Flügelhaut: Polygon Schulter → Handgelenk → Fingerspitzen (mit Zacken dazwischen) → Hüfte
    haut_m = np.zeros((h, w), bool)
    if pose.get('haut', 1):
        poly = [S, Wr, spitze[0]]
        ecken = spitze + [hueft]
        for k in range(n):
            p, q = ecken[k], ecken[k + 1]
            for j in range(1, 6):
                t = j / 6.0
                mx, my = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
                tief = zacke * math.sin(math.pi * t) * math.hypot(q[0] - p[0], q[1] - p[1]) * (1.0 if k < n - 1 else 0.55)
                vx, vy = Wr[0] - mx, Wr[1] - my                       # Zacke zeigt zum Handgelenk hin
                vl = math.hypot(vx, vy) or 1.0
                poly.append((mx + vx / vl * tief, my + vy / vl * tief))
            poly.append(q)
        for (x, y) in poly:
            if not (0 <= x < w and 0 <= y < h):
                raise L.ClipError(f'Flügelhaut-Ecke ({x:.1f},{y:.1f}) außerhalb der Leinwand {w}×{h}')
        haut_m = polygon_maske(h, w, poly)
        for (t, r) in risse:                                              # Löcher folgen dem Flügel ((t, r)-Koordinaten)
            k = min(n - 2, int(t * (n - 1)))
            tt = t * (n - 1) - k
            ang = angs[k] + (angs[k + 1] - angs[k]) * tt
            ln = lens[k] + (lens[k + 1] - lens[k]) * tt
            p = _pt(Wr, ang, ln * r)
            px_, py_ = int(round(p[0])), int(round(p[1]))
            if 0 <= py_ < h and 0 <= px_ < w:
                haut_m[py_, px_] = False

    # Fingerpixel (Farbe aus der Quellspalte): v = Zeilenabstand zur Pivotzeile in der Quelle, s = Weg entlang des Fingers
    fing_px = []
    for k in range(n):
        col = spalten[k]
        ys = np.nonzero(quelle[:, col, 3])[0]
        lo, hi = int(ys.min()), int(ys.max())
        lq = max(1, hi - y0)                                      # Quelllänge ab Pivotzeile
        scale = lens[k] / lq
        sg = lens[k] * 0.55
        sel = {}
        v = float(lo - y0)
        while v <= lq + 1e-9:
            s_ = v * scale
            p = _pt(starts[k], angs[k], s_) if s_ <= sg else _pt(gel[k], angs[k] - knick, s_ - sg)
            row = max(lo, min(hi, y0 + int(round(v))))
            if quelle[row, col, 3]:
                sel[(int(round(p[0])), int(round(p[1])))] = tuple(int(c) for c in quelle[row, col, :3])
            v += 0.5 / scale
        fing_px.append(sel)
    bone_m = np.zeros((h, w), bool)
    arm = linie4(S, Wr)
    for (x, y) in arm:
        if 0 <= y < h and 0 <= x < w:
            bone_m[y, x] = True
    for sel in fing_px:
        for (x, y), c in sel.items():
            if 0 <= y < h and 0 <= x < w:
                bone_m[y, x] = True

    ader_m = np.zeros((h, w), bool)
    if adern and pose.get('haut', 1):                                 # gestrichelte Falten der Haut zwischen je zwei Fingern
        for k in range(n - 1):
            ang = (angs[k] + angs[k + 1]) / 2.0
            ln = (lens[k] + lens[k + 1]) / 2.0 * 0.62
            for j, (x, y) in enumerate(linie(_pt(Wr, ang, 2.5), _pt(Wr, ang, ln))):
                if j % 2 == 0 and 0 <= y < h and 0 <= x < w:
                    ader_m[y, x] = True

    rand = np.zeros((h, w), bool)
    for y, x in zip(*np.nonzero(haut_m)):
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < h and 0 <= xx < w) or not haut_m[yy, xx]:
                rand[y, x] = True
    for y, x in zip(*np.nonzero(haut_m)):
        if rand[y, x]:
            c = pal['haut'][2]
        elif ader_m[y, x]:
            c = pal['haut'][3]
        else:
            nah = any(0 <= y + dy < h and 0 <= x + dx < w and bone_m[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            c = haut_nah if nah else haut_innen
        a[y, x, :3] = c
        a[y, x, 3] = 255

    # ---- Armknochen (2 px dick, oben hell, darunter grau), 4-verbunden — nur wenn der Arm eine Länge hat
    if len(arm) > 2:
        for (x, y) in arm:
            setze(x, y + 1, pal['knochen'][2])
        for k, (x, y) in enumerate(arm):
            setze(x, y, pal['knochen'][1] if k % 6 == 3 else pal['knochen'][0])
    # ---- Finger: hinten (letzter) zuerst, damit die Vorderkante oben liegt
    for k in range(n - 1, -1, -1):
        for (x, y), c in fing_px[k].items():
            setze(x, y, c)
    # ---- Handgelenk: Wulst aus Binde (2×2) mit hellem Knöchel
    if pose.get('wulst', 0):
        wx, wy = int(round(Wr[0])), int(round(Wr[1]))
        for dx, dy in ((0, 0), (-1, 0), (0, 1), (-1, 1)):
            setze(wx + dx, wy + dy, binde[0] if (dx + dy) % 2 == 0 else binde[1])
        setze(wx - 1, wy, pal['knochen'][0])
    return a


# ── Glanz: Lichtband über ein fertiges Bild ──────────────────────────────────────────────────────────────────────────
def band_hell(frame, i, n, start, dauer, rampen, stufen=1, breite=2.6, achse=(1.0, 0.6), kern=None, maske=None, x_bereich=None):
    """Ein Lichtband wandert diagonal über alle Pixel von `frame` (Leinwand), deren Farbe in einer der `rampen` (Listen dunkel → hell)
    steht; sie werden `stufen` Stufen heller (im Bandkern `kern`). Läuft von x_bereich[0] bis x_bereich[1] (u = achse·(x, y)).
    Wirkt nur im Zeitfenster [start, start+dauer) (zyklisch mod n). Ändert `frame` an Ort und Stelle."""
    k = (i - start) % n
    if k >= dauer:
        return frame
    H, W = frame.shape[:2]
    ys, xs = np.nonzero(frame[..., 3] > 0)
    if maske is not None:
        sel = maske[ys, xs]
        ys, xs = ys[sel], xs[sel]
    if not len(ys):
        return frame
    u = achse[0] * xs + achse[1] * ys
    if x_bereich is None:
        umin, umax = float(u.min()), float(u.max())
    else:
        umin, umax = x_bereich
    mitte = umin - breite + (k + 0.5) / dauer * (umax - umin + 2 * breite)
    for y, x, uu in zip(ys, xs, u):
        d = abs(uu - mitte)
        if d > breite / 2.0 + 0.001:
            continue
        c = tuple(int(v) for v in frame[y, x, :3])
        st = kern if (kern is not None and d <= breite / 4.0) else stufen
        for r in rampen:
            if c in r:
                frame[y, x, :3] = r[max(0, min(len(r) - 1, r.index(c) + st))]
                break
    return frame
