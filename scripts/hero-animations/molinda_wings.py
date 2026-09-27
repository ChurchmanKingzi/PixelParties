# -*- coding: utf-8 -*-
"""Neu gezeichnetes Flügelpaar für Molinda, the Cutest Being in the Sky.

Im Sprite hängt hinter ihr nur ein langer, gefalteter Flügel, der beim
Schlagen wie ein wehendes Cape wirkt. Stattdessen: zwei Engelsflügel (ein
vorderer, heller und ein hinterer, dunklerer) in der Sprite-Palette.
Aufbau je Flügel (lokal, Wurzel = Schulter):
* Armknochen: Wurzel -> Handgelenk -> Spitze (nach oben/außen),
* darunter hängende Schwungfedern (Kapseln), zur Spitze hin länger und
  mehr in Armrichtung gedreht – so entstehen die typischen „Finger“,
* oben eine Deckfedern-Leiste entlang des Arms.
Gerastert wird pro Frame (3x3-Überabtastung, Mehrheit), damit der Schlag
ohne Resampling-Matsch bleibt; Kontur 1 px, Federgrenzen als Linien.
"""
import math
import numpy as np

OUTLINE = (41, 41, 41)                     # 292929
LIGHT, MID, DARK, SHADE = (246, 255, 255), (204, 204, 255), (153, 153, 255), (153, 102, 255)


def _seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy)), t


def wing_parts(root, lift, span=1.0, mirror_scale=1.0, shape=None):
    """Geometrie eines Flügels: Liste (Art, Punkt A, Punkt B, Radius, Nummer).

    lift: Drehung in Bogenmaß (positiv = Flügel nach oben geschlagen).
    shape: optionale Proportionen (Oberarm, Hand, Feder-Grundlänge,
    Feder-Zuwachs, Federanzahl, Federbreite); Standard = Molinda.
    """
    arm1, arm2, f0, f1, n, fw = shape or (7, 7, 4.5, 5.0, 6, 2.2)
    rx, ry = root
    a1 = math.radians(-58) - lift              # Oberarm (nach oben rechts)
    a2 = math.radians(-22) - lift * 1.25       # Hand
    s = span * mirror_scale
    wx, wy = rx + math.cos(a1) * arm1 * s, ry + math.sin(a1) * arm1 * s
    tx, ty = wx + math.cos(a2) * arm2 * s, wy + math.sin(a2) * arm2 * s
    parts = [('arm', (rx, ry), (wx, wy), 2.0, -1), ('arm', (wx, wy), (tx, ty), 1.6, -1)]
    for k in range(n):
        t = k / (n - 1)
        if t < 0.5:
            u = t / 0.5
            bx, by = rx + (wx - rx) * u, ry + (wy - ry) * u
        else:
            u = (t - 0.5) / 0.5
            bx, by = wx + (tx - wx) * u, wy + (ty - wy) * u
        # Richtung: nahe der Wurzel nach unten, zur Spitze in Armrichtung
        fa = math.radians(95 - 105 * t ** 1.2) - lift * (0.3 + 0.9 * t)
        L = (f0 + f1 * t ** 0.8) * s
        ex, ey = bx + math.cos(fa) * L, by + math.sin(fa) * L
        parts.append(('feather', (bx, by), (ex, ey), fw - 0.5 * t, k))
    return parts


def render_wing(out, root, lift, span=1.0, far=False, skip=None, palette=None, shape=None):
    """Flügel in out (H x W x 4) malen; skip(x, y) -> True = Pixel nicht malen.
    palette: (Kontur, hell, mittel, dunkel, Federgrenze), Standard = Molinda."""
    outline, light, mid, dark, shade = palette or (OUTLINE, LIGHT, MID, DARK, SHADE)
    H, W = out.shape[:2]
    parts = wing_parts(root, lift, span, shape=shape)
    xs = [p[1][0] for p in parts] + [p[2][0] for p in parts]
    ys = [p[1][1] for p in parts] + [p[2][1] for p in parts]
    x0, x1 = max(0, int(min(xs)) - 3), min(W, int(max(xs)) + 4)
    y0, y1 = max(0, int(min(ys)) - 3), min(H, int(max(ys)) + 4)
    lab = {}
    for y in range(y0, y1):
        for x in range(x0, x1):
            votes = {}
            for sx in (-1 / 3, 0, 1 / 3):
                for sy in (-1 / 3, 0, 1 / 3):
                    px, py = x + 0.5 + sx, y + 0.5 + sy
                    hit = None
                    for kind, a, b, r, k in parts:          # Arm liegt über den Federn
                        d, t = _seg_dist(px, py, a[0], a[1], b[0], b[1])
                        rr = r * (1.0 - 0.35 * t * t) if kind == 'feather' else r
                        if d <= rr:
                            if kind == 'arm':
                                hit = ('arm', t)
                                break
                            if hit is None or k > hit[1]:
                                hit = ('f', k, t)
                    if hit is not None:
                        key = hit[:2]
                        votes.setdefault(key, []).append(hit)
            n = sum(len(v) for v in votes.values())
            if n >= 5:
                key = max(votes, key=lambda kk: len(votes[kk]))
                lab[(x, y)] = (key, sum(h[-1] for h in votes[key]) / len(votes[key]))
    for (x, y), (key, t) in lab.items():
        if skip and skip(x, y):
            continue
        edge = any((x + dx, y + dy) not in lab for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        border = any((x + dx, y + dy) in lab and lab[(x + dx, y + dy)][0] != key and key[0] == 'f'
                     and lab[(x + dx, y + dy)][0][0] == 'f' and lab[(x + dx, y + dy)][0][1] > key[1]
                     for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)))
        if edge:
            c = outline
        elif border:
            c = shade
        elif key[0] == 'arm':
            c = mid if far else light
        else:
            c = (dark if t > 0.6 else mid) if far else (mid if t > 0.65 else light)
        out[y, x] = (*c, 255)
