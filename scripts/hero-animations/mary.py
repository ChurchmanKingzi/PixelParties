# -*- coding: utf-8 -*-
"""Flug-Animation für Cute Princess Mary (Sprite aus MotiveMoe.xcf).

Körper (`Mary-Kopie`) und Flügel (`Mary #1`) liegen als getrennte Ebenen vor
(src/cute-princess-mary-body.png / -wings.png, deckungsgleich mit
src/cute-princess-mary.png).

* Flügelschlag: jeder Flügel dreht sich um sein Schultergelenk – hoch (Spitzen
  nach oben, leicht angelegt) und kraftvoll herunter (weit gespreizt).
  Die Spitzen hängen der Wurzel nach (Nachschwingen), die Federn biegen sich.
  Gezeichnet wird per Rückwärts-Abbildung mit 3x3-Überabtastung und
  Mehrheitsfarbe – es entstehen keine neuen Mischfarben.
* Fliegen: beim Abschlag wird Mary nach oben gedrückt, beim Aufschlag sinkt
  sie etwas ab.
* Glut: von den Flügelspitzen lösen sich beim Abschlag kleine Funken.
* Körper (`body_layer`): die Haare wehen (die Außenkante der Strähnen am Kopf wird zeilenweise verschoben, die langen Locken unter den
  Schulterpolstern sind dieselbe Strähne und schwingen mit derselben, nur verzögerten Welle mit), die Arme schwingen als Einheiten seitwärts (Ärmel samt Hand um die Schulter, ohne dass die Hand wächst), der Saum
  des Kleides schwingt, und das Feuer am Kleid flackert (Farben wandern auf der Leiter Rot → Orange → Gelb nach oben). Der Kopf selbst
  bleibt starr (kein Dehnen und Stauchen).
* Krone: ein Lichtband wandert einmal pro Schleife über die Krone; danach blitzen Glitzersterne über den Zacken auf.
"""
import math
import sys
from collections import Counter
from PIL import Image
import numpy as np
from anim_common import rgb, step, sweep_level, draw_sparkles, save_outputs

BODY = np.array(Image.open('src/cute-princess-mary-body.png').convert('RGBA')).astype(int)
WINGS = np.array(Image.open('src/cute-princess-mary-wings.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PL = PR = 7
PT, PB = 10, 3
H, W = SH + PT + PB, SW + PL + PR
N = 32
FLAP = 16                                   # Frames pro Flügelschlag

MID_X = 39                                  # Trennlinie linker/rechter Flügel
PIVOTS = {-1: (34.0, 33.0), 1: (44.0, 33.0)}   # Schultergelenke (Sprite-Koordinaten)
UP, DOWN = 0.40, -0.34                      # Winkel oben/unten (Bogenmaß)
LAG = 0.018                                 # Nachschwingen (Phase) pro Pixel Abstand


def phase(i):
    return 2 * math.pi * (i % FLAP) / FLAP


def base_angle(i, r=0.0):
    """Schlagwinkel: schneller Abschlag, langsamerer Aufschlag."""
    p = phase(i) - LAG * r
    s = math.sin(p)
    s = s * (1.25 if s < 0 else 0.85)      # Abschlag kräftiger
    return (UP + DOWN) / 2 + (UP - DOWN) / 2 * max(-1.0, min(1.0, s))


def span(i):
    """Oben leicht angelegt (kürzer), unten voll gespreizt."""
    a = base_angle(i)
    return 0.93 + 0.07 * (UP - a) / (UP - DOWN)


def body_dy(i):
    """Abschlag drückt sie hoch, beim Aufschlag sinkt sie ab (leicht verzögert)."""
    return int(round(-2.2 * math.sin(phase(i) - 2.2) - 0.3))


def sample_wing(side, i, x, y, oy):
    """Rückwärts-Abbildung eines Ausgabepixels (Leinwand) in die Flügelquelle."""
    px_, py_ = PIVOTS[side]
    px_, py_ = px_ + PL, py_ + PT + oy
    votes = Counter()
    sc = span(i)
    for sx in (-0.33, 0.0, 0.33):
        for sy in (-0.33, 0.0, 0.33):
            dx, dy = x + sx - px_, y + sy - py_
            r = math.hypot(dx, dy)
            ang = side * base_angle(i, r)             # links: positiv = im Uhrzeigersinn hoch
            c, s = math.cos(-ang), math.sin(-ang)
            ux, uy = (dx * c - dy * s) / sc, (dx * s + dy * c) / sc
            qx = int(round(PIVOTS[side][0] + ux))
            qy = int(round(PIVOTS[side][1] + uy))
            if 0 <= qx < SW and 0 <= qy < SH and WINGS[qy, qx, 3] and \
                    ((qx < MID_X) if side < 0 else (qx >= MID_X)):
                votes[tuple(WINGS[qy, qx])] += 1
            else:
                votes[None] += 1
    col, n = votes.most_common(1)[0]
    if col is None and n < 5:                             # knappe Mehrheit leer -> Farbe nehmen
        rest = [(k, v) for k, v in votes.items() if k is not None]
        if rest and max(v for _, v in rest) >= 4:
            col = max(rest, key=lambda kv: kv[1])[0]
    return col


# --- Körper: Haare, Kopfwippen, Hände, Saum, Flackern, Krone -------------------------------------------------------------------------
MIRROR = 77                                  # x' = 77 − x spiegelt links ↔ rechts (Gesichtsmitte zwischen x = 38 und 39)
HAIR = {26: (33, 35), 27: (32, 35), 28: (32, 35), 29: (32, 35), 30: (31, 35), 31: (31, 35), 32: (31, 35), 33: (31, 35),   # Strähnen am Kopf
        37: (31, 32), 38: (31, 32)}                                                                                         # lange Locken
HEAD0, HEAD1 = 21, 33                         # Kopf-Zeilen (Krone bis Kinn)
FLAME_LADDER = [(0xde, 0x50, 0x3c), (0xfc, 0x7e, 0x32), (0xfb, 0xae, 0x3c)]             # Rot → Orange → Gelb (Feuer am Kleid)
CROWN_LADDER = [(0xde, 0x50, 0x3c), (0xfc, 0x7e, 0x32), (0xfb, 0xae, 0x3c), (0xf5, 0xe2, 0x84), (0xff, 0xe6, 0x7f), (0xfc, 0xe7, 0xd6)]
CROWN = (35, 42, 21, 25)                      # x0, x1, y0, y1 der Krone
SPARKS = [(42, 18, 18), (35, 18, 24), (39, 19, 29)]   # Glitzersterne über den Zacken: (x, y, Startframe)


def hair_shift(y, i):
    """Seitlicher Versatz der Außenkante der Haare in Zeile y (Wind von links). Die Welle läuft von oben nach unten durch die ganze
    Strähne, auch durch die langen Locken unter den Schulterpolstern: dieselbe Formel, nur Zeile für Zeile verzögert, damit sie sich
    wie die Fortsetzung des Haars am Kopf bewegen und nicht wie ein eigenes Teil."""
    amp = 0.35 + 0.15 * (y - 26)
    return int(round(amp * math.sin(2 * math.pi * (i % N) / N - 0.14 * (y - 26))))


def warp_row(row, xa, xb, d, side):
    """Strähne in Zeile `row` zwischen xa..xb: Außenkante um d Pixel nach außen (d < 0: nach innen), die Innenkante bleibt stehen.
    Die Pixel werden gedehnt bzw. gestaucht, es entstehen weder Lücken noch neue Farben."""
    src = row[xa:xb + 1].copy()
    n_src = xb - xa + 1
    n_out = max(1, n_src + d)
    out = np.zeros_like(row)
    for j in range(n_out):
        c = src[int(round(j * (n_src - 1) / max(1, n_out - 1)))]
        x = xb - n_out + 1 + j if side < 0 else xa + j
        out[x] = c
    return out


def body_layer(i):
    ph = phase(i)
    out = BODY.copy()
    # 1) Haare wehen
    for y, (xa, xb) in HAIR.items():
        w = hair_shift(y, i)
        for side in (-1, 1):
            a, b = (xa, xb) if side < 0 else (MIRROR - xb, MIRROR - xa)
            d = -w if side < 0 else w
            lo, hi = (a - 3, b) if side < 0 else (a, b + 3)
            out[y, lo:hi + 1] = 0
            seg = warp_row(BODY[y], a, b, d, side)
            out[y, lo:hi + 1] = np.where(seg[lo:hi + 1, 3:4] > 0, seg[lo:hi + 1], out[y, lo:hi + 1])
    # 2) Arme schwingen seitwärts, jeder Arm als Einheit (Ärmel samt Hand, Zeilen 40–47 zwischen Außenkante und Kleid) um die Schulter: die
    #    oberen Zeilen bewegen sich kaum, der Ärmelsaum unten am weitesten (Scherung ≈ Drehung). Die Hand wird dabei nicht größer, sondern
    #    wandert mit; der Spalt zum Kleid wird mit der Innenkante des Arms gefüllt.
    o = max(-1, int(round(3.0 * math.sin(ph - 1.6))))                  # > 0: nach außen
    for side in (-1, 1):
        xa, xb = (29, 36) if side < 0 else (MIRROR - 36, MIRROR - 29)
        inner = xb if side < 0 else xa
        for y in range(40, 48):
            dx = int(round(o * (y - 38) / 9.0))
            if not dx:
                continue
            arm = {x: out[y, x].copy() for x in range(xa, xb + 1)}
            for x in range(xa, xb + 1):
                out[y, x] = 0
            for x, c in arm.items():
                if c[3]:
                    out[y, x + side * dx] = c
            for k in range(max(0, dx)):                                   # Spalt zwischen Arm und Kleid füllen
                gx = inner + side * k
                if not out[y, gx, 3]:
                    out[y, gx] = arm[inner]
    # 3) Saum schwingt
    for y in range(48, 56):
        dx = int(round(math.sin(ph - 2.2 - 0.3 * (y - 47)) * (y - 47) / 7.0 * 1.2))
        if dx:
            out[y, 27:51] = np.roll(out[y, 27:51], dx, axis=0)
    # 4) Feuer am Kleid flackert (Farben wandern auf der Leiter)
    for y in range(34, 57):
        for x in range(SW):
            if out[y, x, 3] and tuple(out[y, x, :3]) in FLAME_LADDER:
                s = int(round(1.0 * math.sin(ph * 1.0 + 0.7 * x + 0.5 * y)))
                if s:
                    out[y, x, :3] = step(FLAME_LADDER, tuple(out[y, x, :3]), s)
    # 5) Lichtband über die Krone
    x0, x1, y0, y1 = CROWN
    for y in range(y0 - 1, y1 + 1):
        for x in range(x0, x1 + 1):
            if out[y, x, 3] and tuple(out[y, x, :3]) in CROWN_LADDER:
                lv = sweep_level(x, y, i, N, speed=1.25, slope=0.8, offset=29.0)
                if lv:
                    out[y, x, :3] = step(CROWN_LADDER, tuple(out[y, x, :3]), lv + 1)
    return out




EMBER = [(255, 236, 170), (255, 190, 80), (240, 120, 40), (190, 60, 30)]


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = body_dy(i)
    # Flügel (hinter dem Körper)
    for side in (-1, 1):
        for y in range(H):
            for x in range(W):
                c = sample_wing(side, i, x, y, oy)
                if c is not None:
                    out[y, x] = c
    # Körper (Haare, Kopf, Hände, Saum, Feuer, Krone: siehe body_layer)
    body = body_layer(i)
    for y in range(SH):
        for x in range(SW):
            if body[y, x, 3]:
                out[y + PT + oy, x + PL] = body[y, x]
    # Funken von den Flügelspitzen (Abschlag)
    for k in range(6):
        t = (i + k * 5) % 12
        if t >= 8:
            continue
        side = -1 if k % 2 else 1
        tip = (4 + 3 * (k // 2), 12 + 5 * (k // 2)) if side < 0 else (SW - 5 - 3 * (k // 2), 12 + 5 * (k // 2))
        # Spitze mit der aktuellen Flügelstellung mitdrehen
        pxv, pyv = PIVOTS[side]
        ang = side * base_angle(i - t, math.hypot(tip[0] - pxv, tip[1] - pyv))
        dx, dy = tip[0] - pxv, tip[1] - pyv
        c, s = math.cos(ang), math.sin(ang)
        ex = pxv + (dx * c - dy * s) * span(i - t) + PL
        ey = pyv + (dx * s + dy * c) * span(i - t) + PT + body_dy(i - t)
        ex += side * 0.4 * t
        ey += 0.6 * t + 0.08 * t * t
        xx, yy = int(round(ex)), int(round(ey))
        if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
            out[yy, xx] = (*EMBER[min(3, t // 2)], 255 - t * 22)
    # Glitzersterne über der Krone (folgen dem Körper)
    draw_sparkles(out, i, N, [(x + PL, y + PT + oy, st) for x, y, st in SPARKS], rgb('ffef93'), rgb('ffd900'))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mary_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=5)
