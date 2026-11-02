# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Eis / Schnee“ (Mischief Militia, Slippery …, Schleime) — baut auf anim_lib / anim_humanoide auf.
Nur ganze Pixel, kein Alpha, nur Farben des Sprites.

    dunst_ebene(h, w, i, n, puffs, farben)   kalter Dunst: runde Wölkchen (nie ein einzelnes Pixel: 2×2 → 4×4/5×3 → 2×2), steigen langsam auf
    dunst_liste(rnd, n, x0, x1, y0, vy, …)   Wölkchenliste mit zufälliger Verteilung (feste Samen → reproduzierbar)
    linie(p, q)                              4-verbundene Pixellinie (Bresenham + Eckpixel)
    zweig_loeschen(a, off, pixel, ersatz)    Zweigarm-Pixel entfernen (ersatz: {Pixel: Farbe}; Standard: löschen)
    zweig_zeichnen(a, off, basis, spitze, f) Zweig als Linie von der Schulter zur Spitze (nur auf leere Felder)
    rotor_faerben(a, off, ring, mitte, ph, farben)   Rotorscheibe (flache Ellipse) dreht sich: zwei helle Blattschatten wandern um die Ellipse
    maske_aus(spr, bedingung)                Bool-Maske aus Bedingung(x, y, farbe)
    verlauf3(i, n, st, stufen)               0…stufen, glatt (Kosinus), Phase st
"""
import math

import numpy as np

import anim_lib as L


# ── Dunst ────────────────────────────────────────────────────────────────────────────────────────────────────
def dunst_stufe(form, t):
    """Wölkchen-Form im Lebenslauf t∈[0,1): unsichtbar → 2×2 → volle Form → 2×2 → unsichtbar (nie ein 1-px-Punkt)."""
    if t < 0.07 or t >= 0.93:
        return None
    if t < 0.24 or t >= 0.78:
        return 's'
    return form


def dunst_ebene(h, w, i, n, puffs, farben):
    """Kalter Dunst. puffs: Liste dict(x, y, vx, vy, off, form, wackeln): (x, y) Startpunkt, (vx, vy) Weg über EINE Schleife (nahtlos),
    off = Phasenversatz in Frames, form 'm' (5×3), 'o' (4×4), 'l' (7×5), 's' (2×2). farben = {'c': Kern, 'r': Rand}."""
    e = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        form = dunst_stufe(pf.get('form', 'm'), t)
        if form is None:
            continue
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * (t + pf.get('ph', 0)))
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Dunst bei ({x},{y}) außerhalb der Leinwand {w}×{h}')
            e[y, x, :3] = farben[k]
            e[y, x, 3] = 255
    return e


def dunst_liste(rnd, n, x0, x1, y0, vy, anzahl, formen=('m', 'o', 'm', 'l'), vx=(-2, 2), wackeln=(0.5, 1.5)):
    """`anzahl` Wölkchen, Startpunkt zufällig in x0…x1 (y0 fest), Weg (vx, vy), gleichmäßig über die Schleife versetzt."""
    out = []
    for k in range(anzahl):
        out.append(dict(x=rnd.uniform(x0, x1), y=y0 + rnd.uniform(-1, 1), vx=rnd.uniform(*vx), vy=vy * rnd.uniform(0.8, 1.2),
                        off=int(round(k * n / anzahl + rnd.uniform(-2, 2))) % n, form=formen[k % len(formen)],
                        wackeln=rnd.uniform(*wackeln), ph=rnd.random()))
    return out


# ── Linien / Zweige ──────────────────────────────────────────────────────────────────────────────────────────
def linie(p, q):
    """4-verbundene Pixellinie von p nach q (beide eingeschlossen): Bresenham, bei Diagonalschritten wird ein Eckpixel eingefügt."""
    (x0, y0), (x1, y1) = p, q
    pts = [(x0, y0)]
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1)
    err = dx - dy
    x, y = x0, y0
    while (x, y) != (x1, y1):
        e2 = 2 * err
        step_x = e2 > -dy
        step_y = e2 < dx
        if step_x:
            err -= dy
            x += sx
        if step_y:
            err += dx
            y += sy
        if step_x and step_y:
            pts.append((x - sx, y))          # Eckpixel: Linie bleibt 4-verbunden
        pts.append((x, y))
    return pts


def zweig_loeschen(a, off, pixel, ersatz=None):
    ersatz = ersatz or {}
    for (x, y) in pixel:
        X, Y = x + off[0], y + off[1]
        if (x, y) in ersatz and ersatz[(x, y)] is not None:
            a[Y, X, :3] = ersatz[(x, y)]
            a[Y, X, 3] = 255
        else:
            a[Y, X] = 0
    return a


def zweig_zeichnen(a, off, basis, spitze, farbe, nur_leer=True):
    """Linie basis → spitze (Spritekoordinaten). Das Basispixel wird immer gesetzt; die übrigen nur auf leere Felder (nie über den Körper)."""
    h, w = a.shape[:2]
    for k, (x, y) in enumerate(linie(basis, spitze)):
        X, Y = x + off[0], y + off[1]
        if not (0 <= X < w and 0 <= Y < h):
            raise L.ClipError(f'Zweigpixel ({x},{y}) außerhalb der Leinwand {w}×{h}')
        if k == 0 or not nur_leer or not a[Y, X, 3]:
            a[Y, X, :3] = farbe
            a[Y, X, 3] = 255
    return a


# ── Rotor ────────────────────────────────────────────────────────────────────────────────────────────────────
def rotor_faerben(a, off, ring, mitte, ph, farben, rx=3.6, ry=1.6):
    """Die Pixel der Rotorscheibe `ring` (Liste (x, y) in Spritekoordinaten; flache Ellipse um `mitte` = (cx, cy)) neu einfärben: zwei helle
    Blattschatten (gegenüberliegend) wandern mit der Phase `ph` um die Ellipse. Äußerste Randpixel (leere 4-Nachbarn im Ring) bleiben dunkel.
    farben = {'dunkel', 'mittel', 'hell', 'weiss'} (alles Farben des Sprites)."""
    rs = set(ring)
    for (x, y) in ring:
        if any(((x + dx, y + dy) not in rs) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c = farben['dunkel']                                       # Rand der Scheibe
        else:
            th = math.atan2((y - mitte[1]) / ry, (x - mitte[0]) / rx)
            s = math.cos(2 * (th - ph))
            c = farben['weiss'] if s > 0.62 else farben['hell'] if s > 0.15 else farben['mittel'] if s > -0.45 else farben['dunkel2'] if 'dunkel2' in farben else farben['mittel']
        a[y + off[1], x + off[0], :3] = c
        a[y + off[1], x + off[0], 3] = 255
    return a


# ── Kleines ──────────────────────────────────────────────────────────────────────────────────────────────────
def maske_aus(spr, bedingung):
    h, w = spr.shape[:2]
    m = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if spr[y, x, 3] and bedingung(x, y, tuple(int(v) for v in spr[y, x, :3])):
                m[y, x] = True
    return m


def verlauf3(i, n, st=0.0, stufen=1):
    """0…stufen, glatt (Kosinus), 0 bei i = 0 und st = 0."""
    return int(round(stufen * (0.5 - 0.5 * math.cos(L.sinus(i, n, st)))))


def wippen(i, n, ph=0.0, amp=1.0):
    """Ganzzahlige Schwingung −amp … +amp (sin), nahtlos bei ganzzahligem n."""
    return int(round(amp * math.sin(L.sinus(i, n, ph))))


# ── Schleime ─────────────────────────────────────────────────────────────────────────────────────────────────
def schleim_koerper(spr, i, n, pad_l, w, h, boden, zeilen_a, paare, sperre=(), stufen=2, wabbel=1.0, wabbel_n=16, wabbel_ph=0.0):
    """Squash & Stretch + Wabbeln eines Schleims auf der vollen Leinwand h×w; der Boden (Unterkante) bleibt am Boden.
    zeilen_a: Quellzeilen, die beim Strecken verdoppelt / beim Stauchen entfernt werden (in dieser Reihenfolge, je Stufe eine).
    Strecken bleibt gleich breit (Gesicht/Mund nicht verengen), Stauchen (≥ 2 Stufen) macht breiter; Gesichtsfarben `sperre` werden beim Mischen der Zusatzzeile nie kopiert."""
    import anim_amorph as A
    import anim_slime as S
    zeilen = A.zeilen_von(spr, 0, spr.shape[0] - 1, h, w, pad_l, 0)
    lev = int(round(stufen * math.sin(L.sinus(i, n))))
    loeschen, doppeln, p = set(), {}, 0
    if lev > 0:
        doppeln = {r: 1 for r in zeilen_a[:lev]}
        p = 0
    elif lev < 0:
        loeschen = set(zeilen_a[:-lev])
        p = 1 if -lev >= 2 else 0
    pose, quelle = S.koerper_pose(zeilen, loeschen=loeschen, doppeln=doppeln, p=p, paare=paare, x0=pad_l, sperre=sperre)
    nn = pose.shape[0]
    dxs = [int(round(wabbel * ((nn - 1 - j) / max(1, nn - 1)) * math.sin(L.sinus(i, wabbel_n, wabbel_ph)))) for j in range(nn)]
    pose = A.verschiebe_ausgabezeilen(pose, dxs)
    ebene, top = A.auf_leinwand(pose, h, boden, 0)
    return ebene
