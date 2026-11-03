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


def _linie(p, q):
    """Bresenham-Pixel von p=(y,x) nach q=(y,x), beide Enden eingeschlossen."""
    (y0, x0), (y1, x1) = p, q
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((y0, x0))
        if (y0, x0) == (y1, x1):
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def nebel(a, wurzel, achse, laenge, i, n, amp_q=3.0, amp_a=2.0, lauf=2.2, quer=0.25, k1=2, k2=1, potenz=1.0, zusatz=None, phase=0.0, heller=None):
    """Dunkler Nebel statt starrer Welle (Nutzerkorrektur Runde 3, Elven Rider: Mähne und Schweif „fließend, als bestünden sie aus dunklem Nebel“).

    Jedes Pixel der Ebene `a` (volle Leinwand) wird mit einem glatten, in der Zeit nahtlosen Strömungsfeld VERSCHOBEN (Lagrange-Verformung, keine Spaltenkopie):
      u = Abstand des Pixels von `wurzel` = (x, y) entlang `achse` (Einheitsrichtung zur Spitze) / `laenge`, auf 0 … 1 begrenzt; Gewicht w = u^potenz (die Wurzel bleibt fest),
      Querversatz  = amp_q · w · sin(2π·k1·i/n − lauf·u + quer·v + phase)      (v = Abstand quer zur Achse; die Welle läuft von der Wurzel zur Spitze und ist über v phasenverschoben → Wirbel),
      Längsversatz = amp_a · w · sin(2π·k2·i/n − 0,7·lauf·u + 0,18·v + 1,1 + phase)  (die Strähnen dehnen und stauchen sich, der Nebel „strömt“),
    beide relativ zu Frame 0 (Frame 0 = Ruhepose). `zusatz(x, y, u)` darf einen zusätzlichen (dx, dy) liefern (z. B. Mitheben mit dem Atmen).
    Damit dünne Strähnen nicht zerreißen, wird zwischen den verschobenen Positionen zweier im Original benachbarter Pixel (8er-Nachbarschaft) mit einer Pixellinie verbunden
    (die Strähne wird dort gedehnt, nie gebrochen; die Farbe stammt von den beiden Enden). Alle Farben sind die der Ebene. ClipError, wenn etwas aus der Leinwand ragt.
    heller = dict(nur=(r,g,b), farbe=(r,g,b), k=2, frq=6.0, quer=0.5, schwelle=1.25): Pixel der Farbe `nur` hellen sich zeitweise zur (Quell-)Farbe `farbe` auf, wenn ein mit der Zeit zur Spitze laufendes
    Streifenmuster (Dichteunterschiede im Nebel) sie erfasst; in Frame 0 bleibt alles unverändert."""
    h, w = a.shape[:2]
    ax, ay = achse
    nl = math.hypot(ax, ay)
    ax, ay = ax / nl, ay / nl
    qx, qy = -ay, ax
    wx, wy = wurzel
    ys, xs = np.nonzero(a[..., 3])
    pos, farbe, uu = {}, {}, {}
    for y, x in zip(ys.tolist(), xs.tolist()):
        u = ((x - wx) * ax + (y - wy) * ay) / laenge
        u = min(1.0, max(0.0, u))
        v = -(x - wx) * ay + (y - wy) * ax
        wg = u ** potenz

        def feld(t):
            q = amp_q * wg * math.sin(2 * math.pi * k1 * t / n - lauf * u + quer * v + phase)
            l = amp_a * wg * math.sin(2 * math.pi * k2 * t / n - 0.7 * lauf * u + 0.18 * v + 1.1 + phase)
            return q, l
        q, l = feld(i)
        q0, l0 = feld(0)
        dq, dl = q - q0, l - l0
        zx, zy = zusatz(x, y, u) if zusatz else (0, 0)
        tx = x + int(round(dl * ax + dq * qx + zx))
        ty = y + int(round(dl * ay + dq * qy + zy))
        pos[(y, x)] = (ty, tx)
        c0 = a[y, x].copy()
        if heller and u > 0.15 and tuple(int(vv) for vv in c0[:3]) == tuple(heller['nur']):
            def strahl(t):
                return math.sin(2 * math.pi * heller.get('k', 2) * t / n - heller.get('frq', 6.0) * u + heller.get('quer', 0.5) * v + phase)
            if strahl(i) - strahl(0) > heller.get('schwelle', 1.25):
                c0[:3] = heller['farbe']
        farbe[(y, x)] = c0
        uu[(y, x)] = u
    out = L.leer(h, w)

    def setze(p, c):
        ty, tx = p
        if not (0 <= ty < h and 0 <= tx < w):
            raise L.ClipError(f'Nebelpixel bei ({tx},{ty}) liegt außerhalb der Leinwand {w}×{h}')
        out[ty, tx] = c
    # Brücken zuerst (liegen unter den eigentlichen Pixeln), dann die Pixel von der Wurzel zur Spitze
    for (y, x), p in pos.items():
        for (dy, dx) in ((0, 1), (1, 0), (1, 1), (1, -1)):
            q = (y + dy, x + dx)
            if q in pos:
                pq = pos[q]
                if max(abs(p[0] - pq[0]), abs(p[1] - pq[1])) > 1:
                    lin = _linie(p, pq)
                    m = len(lin)
                    for k, pt in enumerate(lin[1:-1], start=1):
                        setze(pt, farbe[(y, x)] if k <= m // 2 else farbe[q])
    for k in sorted(pos, key=lambda t: uu[t]):
        setze(pos[k], farbe[k])
    return out
