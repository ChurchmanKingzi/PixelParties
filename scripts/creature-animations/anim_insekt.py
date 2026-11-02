# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Insekt“ (Runde 2: Sparkfly Worker/Queen/Architect, Cybug Ladybug, Future Tech Drone, Diamond Spider, Moonlight Butterfly).
Baut auf anim_lib / anim_flieger auf, ändert sie nicht. Nur ganze Pixel, nur Quellfarben, Alpha nur 0/255.

    komponenten4(a)                     Zahl und Größen der 4-verbundenen Zusammenhangskomponenten eines RGBA-Felds (Prüfwerkzeug gegen Lücken/Nähte)
    haengen_pendeln(a, y_auf, amp, phase, lauf, oben_spalten)
                                        ein hängender Teil (Beutel am Bein) schwingt waagerecht: dx wächst mit dem Abstand zur Aufhängung, aber JEDE Zeile
                                        behält mindestens eine Spalte gemeinsam mit der Zeile darüber (4-verbunden), die oberste mit `oben_spalten` (feste Beine)
    rotor(h, w, mx, my, rx, ry, stellung, ...)   Rotor einer Drohne von oben: Blattstellung (Winkelschritt) einer Scheibe → Ebene
    staub_ebene(h, w, i, n, puffs, farben)       langsam aufsteigende Staubwölkchen (Minimum 3 Pixel, 4-verbunden, kleiner Klecks → 2×2 → Klecks), nahtlos
"""
import math
from collections import deque

import numpy as np

import anim_lib as L


def komponenten4(a):
    """(Anzahl, Größen absteigend, Labelfeld) der 4-verbundenen Komponenten der deckenden Pixel."""
    m = a[..., 3] > 0
    h, w = m.shape
    lab = np.zeros((h, w), int)
    n = 0
    groessen = []
    for y in range(h):
        for x in range(w):
            if m[y, x] and not lab[y, x]:
                n += 1
                lab[y, x] = n
                q = deque([(y, x)])
                c = 0
                while q:
                    cy, cx = q.popleft()
                    c += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                groessen.append(c)
    return n, sorted(groessen, reverse=True), lab


def haengen_pendeln(a, y_auf, amp, phase, lauf=0.0, oben_spalten=None):
    """Ein Teil, das ab Zeile y_auf+1 an festen Anschlüssen hängt (Beutel an den Beinen), schwingt waagerecht: dx(y) = round(amp · f · sin(phase − lauf·f)),
    f = (y − y_auf) / Tiefe (0 … 1). Zusammenhang: jede Zeile behält mindestens eine Spalte gemeinsam mit der Zeile darüber (die oberste mit `oben_spalten`,
    den Spalten der festen Zeile y_auf); sonst übernimmt sie das dx der Zeile darüber."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    zeilen = [y for y in range(h) if a[y, :, 3].any() and y > y_auf]
    if not zeilen:
        return a.copy()
    tiefe = max(1, max(zeilen) - y_auf)
    obere = set(oben_spalten or [])
    prev_dx = 0
    for y in zeilen:
        f = (y - y_auf) / tiefe
        dx = int(round(amp * f * (math.sin(phase - lauf * f) - math.sin(-lauf * f))))
        xs = set(np.nonzero(a[y, :, 3])[0].tolist())
        if y == zeilen[0]:
            if obere and not ({x + dx for x in xs} & obere):
                # nächstkleineres |dx|, das einen Anschluss hat
                for k in range(abs(dx), -1, -1):
                    dx2 = int(math.copysign(k, dx)) if dx else 0
                    if {x + dx2 for x in xs} & obere:
                        dx = dx2
                        break
        else:
            xs_oben = {x + prev_dx for x in np.nonzero(a[y - 1, :, 3])[0].tolist()}
            if not ({x + dx for x in xs} & xs_oben):
                for k in range(abs(dx), -1, -1):
                    dx2 = int(math.copysign(k, dx)) if dx else 0
                    if {x + dx2 for x in xs} & xs_oben:
                        dx = dx2
                        break
        if min(xs) + dx < 0 or max(xs) + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[y, x + dx] = a[y, x]
        prev_dx = dx
    # Zeilen oberhalb / auf der Aufhängung bleiben
    for y in range(h):
        if a[y, :, 3].any() and y <= y_auf:
            out[y] = a[y]
    return out


# ── Staub: Wölkchen, die nie kleiner als 3 Pixel werden (Regel 25: keine einzelnen 1-px-Punkte) ─────────────────────────────
STAUB_FORMEN = {
    'a': [(0, 0, 'c'), (1, 0, 'r'), (0, 1, 'r')],                               # Klecks (L-Form, 3 px)
    'b': [(0, 0, 'c'), (1, 0, 'r'), (0, 1, 'r'), (1, 1, 'r')],                  # 2×2
    'c': [(1, 1, 'c'), (1, 0, 'r'), (0, 1, 'r')],                               # Klecks (gegenüber gedreht, 3 px)
}


def staub_ebene(h, w, i, n, puffs, farben):
    """Wölkchen mit Lebenslauf (nahtlos über n Frames): Klecks (3 px) → 2×2 → Klecks → weg. puffs: dict(x, y, vx, vy, off, wackeln=0)."""
    ebene = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        if t < 0.12 or t > 0.9:
            continue
        form = 'a' if t < 0.3 else ('b' if t < 0.72 else 'c')
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        for (dx, dy, k) in STAUB_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Staub bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = farben[k]
            ebene[y, x, 3] = 255
    return ebene


# ── Rotoren (Drohne von oben): Scheibe mit rotierenden Blättern ───────────────────────────────────────────────────────────────
def linie8(p, q):
    """8-verbundene Linie (Bresenham) von p nach q, beide inklusive."""
    (x0, y0), (x1, y1) = p, q
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def blatt_pixel(mx, my, rx, ry, stufe, stufen=8, f=1.0):
    """Pixel eines durchgehenden Rotorblatts (zwei gegenüberliegende Blätter = eine Linie durch die Nabe (mx, my)) bei der Stellung `stufe` (0 … stufen−1 = 0 … 180°);
    die Linie endet auf dem Rand der Ellipse mit den Halbachsen rx, ry (Skalierung f)."""
    th = math.pi * (stufe % stufen) / stufen
    u, v = rx * f * math.cos(th), ry * f * math.sin(th)
    a = (int(math.floor(mx + u + 0.5)), int(math.floor(my + v + 0.5)))
    b = (int(math.floor(mx - u + 0.5)), int(math.floor(my - v + 0.5)))
    return linie8(a, b)
