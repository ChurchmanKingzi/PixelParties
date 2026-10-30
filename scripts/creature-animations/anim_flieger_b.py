# -*- coding: utf-8 -*-
"""Hilfscode der Gruppe „Flieger“ (zweiter Animator) — baut auf anim_lib auf, ändert nichts daran.

Skelett-/Fledermausflügel, die aus Schlüsselpunkten neu gezeichnet werden (Pixelart, nur ganze Pixel, nur Farben aus Palette/Quell-Sprite):

    pose_mix(a, b, t)                       zwei Schlüsselposen (dict) linear mischen
    pose_vektor(p) / vektor_pose(v, vorlage)   Pose ↔ flache Float-Liste (zum Splinen)
    spline(schluessel, t, periode)          periodischer kubischer Hermite-Spline durch Schlüsselposen (nahtlose Schleife, Halt-Posen)
    knochenflügel(h, w, pose, pal, quelle, spalten, x0, y0, ...)
                                            einen linken Flügel auf eine Leinwand h×w zeichnen: Armknochen Schulter → Handgelenk, vier
                                            Fingerknochen (fächerförmig, mit Knick; Farben aus Spalten des gefalteten Flügels, beim Aufklappen
                                            pixelweise zu sauberen Knochen), gezackte, zerrissene Flügelhaut dazwischen, Handgelenkswulst
    rein_farbe(pr, ab_wurzel, ab_spitze)    saubere Fingerfarbe (Knochenrampe, Manschette + tan Spitze)
    spiegeln(a)                             Ebene an der senkrechten Mittelachse der Leinwand spiegeln (rechter Flügel = gespiegelter linker)
    verbunden4(a, start)                    Maske aller deckenden Pixel, die über KANTEN (4er-Nachbarschaft) mit `start` zusammenhängen
    linie(p0, p1) / linie4(p0, p1)          Bresenham (8er- bzw. 4er-verbunden)
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


def pose_vektor(pose):
    """Pose (dict) → flache Float-Liste, damit sie sich splinen lässt; vektor_pose() ist die Umkehrung (gleiche Struktur wie `vorlage`)."""
    v = []
    for k in sorted(pose):
        x = pose[k]
        v += list(x) if isinstance(x, (tuple, list)) else [x]
    return v


def vektor_pose(v, vorlage):
    out, i = {}, 0
    for k in sorted(vorlage):
        x = vorlage[k]
        if isinstance(x, (tuple, list)):
            out[k] = type(x)(v[i:i + len(x)]); i += len(x)
        else:
            out[k] = v[i]; i += 1
    return out


def spline(schluessel, t, periode):
    """Kubischer Hermite-Spline durch Schlüsselposen, periodisch (nahtlose Schleife). schluessel = [(zeit, vektor, halt)], zeit aufsteigend in
    [0, periode); halt=True → Tangente 0 (Pose verharrt, z. B. gefalteter Flügel). Gibt den Vektor zur Zeit t (mod periode) zurück.
    Durchläuft jede Schlüsselpose exakt und beschleunigt/bremst dazwischen weich (kein Stop-and-go an den Zwischenposen)."""
    t = t % periode
    n = len(schluessel)
    ks = [(z - periode, v, h) for (z, v, h) in schluessel] + list(schluessel) + [(z + periode, v, h) for (z, v, h) in schluessel]
    # Segment suchen
    i = next(j for j in range(len(ks) - 1) if ks[j][0] <= t < ks[j + 1][0])
    (z0, v0, h0), (z1, v1, h1) = ks[i], ks[i + 1]
    zm, vm, _ = ks[i - 1]
    zp, vp, _ = ks[i + 2]
    d = z1 - z0
    u = (t - z0) / d
    out = []
    for a in range(len(v0)):
        m0 = 0.0 if h0 else (v1[a] - vm[a]) / (z1 - zm)
        m1 = 0.0 if h1 else (vp[a] - v0[a]) / (zp - z0)
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        out.append(h00 * v0[a] + h10 * d * m0 + h01 * v1[a] + h11 * d * m1)
    return out


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


def rein_farbe(pr, ab_wurzel, ab_spitze):
    """Saubere Fingerfarbe (statt der rohen Quellspalte): helle Knochenrampe von der Wurzel, braune Binde (zwei Pixel) in der Mitte,
    am Ende eine Manschette (dunkel) mit tan Spitze wie die Hand im Original. pr = dict(knochen=[hell, mittel, grau], binde=(a, b),
    manschette=(dunkel, tan_mittel, tan_hell))."""
    if ab_spitze == 0:
        return pr['manschette'][2]
    if ab_spitze == 1:
        return pr['manschette'][1]
    if ab_spitze == 2:
        return pr['manschette'][0]
    if ab_wurzel < 4:
        return pr['knochen'][0]
    return pr['knochen'][1] if ab_spitze > 5 else pr['knochen'][2]


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
    rein = pose.get('rein', 0.0)
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
        steil = abs(math.sin(math.radians(angs[k]))) > 1.7 * abs(math.cos(math.radians(angs[k])))   # annähernd senkrecht (≥ 60° zur Waagerechten)
        v = float(lo - y0) if rho > 0.5 else 0.0                 # Teil hinter dem Gelenk nur beim gefalteten Flügel (sonst Zacken)
        while v <= lq + 1e-9:
            s_ = v * scale
            p = _pt(starts[k], angs[k], s_) if s_ <= sg else _pt(gel[k], angs[k] - knick, s_ - sg)
            row = max(lo, min(hi, y0 + int(round(v))))
            if quelle[row, col, 3]:
                c = tuple(int(c) for c in quelle[row, col, :3])
                if rein > ((row * 7 + k * 3) % 10) / 10.0 + 0.04:          # Übergang roh → sauber pixelweise (Dithering, kein Alpha)
                    c = rein_farbe(pal['rein'], row - lo, hi - row)
                pos = (int(round(p[0])), int(round(p[1])))
                if steil and sel:
                    px_, py_ = list(sel)[-1]
                    if pos[0] != px_ and pos[1] != py_:             # steiler Finger: Ecke dazu, damit er über Kanten zusammenhängt
                        sel.setdefault((px_, pos[1]), sel[(px_, py_)])
                sel[pos] = c
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
            c = haut_innen
        a[y, x, :3] = c
        a[y, x, 3] = 255

    # ---- Armknochen (2 px dick, oben hell, darunter grau), 4-verbunden — nur wenn der Arm eine Länge hat; braune Binden darauf
    if len(arm) > 2:
        for (x, y) in arm:
            setze(x, y + 1, pal['knochen'][2])
        for k, (x, y) in enumerate(arm):
            setze(x, y, pal['knochen'][0])
        for k in (len(arm) // 3, 2 * len(arm) // 3):
            if 0 < k < len(arm) - 1:
                setze(arm[k][0], arm[k][1] + 1, binde[0])
                if k + 1 < len(arm):
                    setze(arm[k + 1][0], arm[k + 1][1] + 1, binde[1])
    # ---- Finger: hinten (letzter) zuerst, damit die Vorderkante oben liegt; Wurzelhälfte 2 px dick (Schattenpixel daneben)
    for k in range(n - 1, -1, -1):
        pts = list(fing_px[k].items())
        dick = pose.get('dick', 0.4)
        for j, ((x, y), c) in enumerate(pts):
            setze(x, y, c)
        if rein >= 0.5 and dick > 0 and k == 0:
            ang = math.radians(angs[k])
            flach = abs(math.cos(ang)) > abs(math.sin(ang))
            for j, ((x, y), c) in enumerate(pts[:int(len(pts) * dick)]):
                sx, sy = (x, y + 1) if flach else (x + 1, y)
                if (sx, sy) not in fing_px[k] and 0 <= sy < h and 0 <= sx < w and not bone_m[sy, sx]:
                    setze(sx, sy, pal.get('schatten', pal['knochen'][2]))
    # ---- Handgelenk: Wulst aus Binde (3×3: dunkle Wicklung, Ecken mittelbraun, Mitte tan) — verdeckt, wo die Fingerwurzeln zusammenlaufen
    if pose.get('wulst', 0):
        wx, wy = int(round(Wr[0])), int(round(Wr[1]))
        muster = {(-1, -1): binde[1], (0, -1): binde[0], (1, -1): binde[1],
                  (-1, 0): binde[0], (0, 0): pal['rein']['manschette'][1], (1, 0): binde[0],
                  (-1, 1): binde[1], (0, 1): binde[0], (1, 1): binde[1]}
        for (dx, dy), c in muster.items():
            setze(wx + dx, wy + dy, c)
    return a
