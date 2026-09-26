# -*- coding: utf-8 -*-
"""Idle-Animation für Darion, the Blood-Crazy Groundskeeper (50x47).

Völlig verrückter Hausmeister mit blutiger Kettensäge:
* Vollständiges Sägeblatt mit abgerundeter Spitze (das Original war nur
  verwischt); die Kette läuft ständig als Schleife herum: oben nach vorne,
  um die Spitze, unten zurück – mit abstehenden Zähnen.
* Ruhephase: er wippt, der Motor tuckert und pustet graue Wölkchen,
  Blut tropft vom Sägeblatt und bildet kleine Pfützen.
* Die Säge ist voller Blutspritzer, blutige Zähne; die rasende Kette
  schleudert ständig Tropfen von der Spitze.
* Zweimal pro Loop lässt er die Säge aufheulen: alles vibriert, dunkle
  Abgaswolken, Blut spritzt vom Blatt, und er lacht irre (Mund weit offen).
* Die Augen zucken unabhängig voneinander hin und her.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/darion-the-blood-crazy-groundskeeper.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48

REVS = [(10, 18), (34, 42)]                  # Aufheulen (Start, Ende)
GROUND = 35                                  # Fußsohlen


def revving(i):
    return any(a <= i % N < b for a, b in REVS)


def body_dy(i):
    if revving(i):
        return -1 if i % 2 else 0            # Vibration
    return -1 if 4 <= i % 16 < 10 else 0     # ruhiges Wippen


# ---------------------------------------------------------------- Gesicht
def face(a, i):
    t = i % N
    # Augen zucken: Pupille springt nach außen (links / rechts unabhängig)
    if t in (3, 4, 5, 21, 22, 40, 41, 42):
        a[19, 6], a[19, 7] = SRC[19, 7].copy(), SRC[19, 6].copy()
    if t in (7, 8, 26, 27, 28, 44):
        a[19, 10], a[19, 11] = SRC[19, 11].copy(), SRC[19, 10].copy()
    # irres Lachen beim Aufheulen: Mund reißt auf (abwechselnd weit / normal)
    if revving(i) and (t // 2) % 2 == 0:
        a[20, 7] = SRC[20, 8]
        a[20, 10] = SRC[20, 9]
        a[21, 7] = SRC[21, 8]
        a[21, 10] = SRC[21, 9]


# ---------------------------------------------------------------- Sägeblatt
# Das Original zeigt nur ein nach rechts verwischtes Blatt ohne Spitze. Es wird
# durch ein vollständiges Blatt mit abgerundeter Spitze ersetzt: die Blut-Textur
# des Originals läuft bis zur Spitze weiter, die Kette läuft als geschlossene
# Schleife herum (oben nach vorne, um die Spitze, unten zurück) und die Zähne
# stehen überall nach außen ab. Tempo: 3 px pro Frame bei 8-px-Muster (unter der
# halben Periode, damit die Laufrichtung eindeutig bleibt), jeder Zahn zieht eine
# 2-px-Bewegungsspur hinter sich her.
BLADE_X0 = 19                                # erste Blattspalte (davor: Motor)
NOSE_X, MID_Y = 36, 26                       # Mittelpunkt der Spitze
CHAIN_P, CHAIN_V = 8, 3                      # Musterperiode, px pro Frame (48*3 = 18*8)
# Glieder je Musterposition k; k=7 und k=6 sind die Bewegungsspur hinter k=0
LINK = [(206, 190, 182), (58, 15, 15), (138, 20, 20), (58, 15, 15),
        (96, 14, 14), (58, 15, 15), (104, 52, 50), (150, 112, 106)]
CHAIN_BASE = (70, 18, 18)
TOOTH = (196, 176, 168)
TOOTH_BLOODY = (176, 38, 34)
TOOTH_TRAIL = [(150, 120, 114, 190), (120, 70, 66, 120)]
L_TOP = NOSE_X - BLADE_X0
L_ARC = 13                                   # ~ pi * 4


def radial(x, y):
    """Abstand von der Blatt-Mittellinie bzw. vom Mittelpunkt der Spitze."""
    if x <= NOSE_X:
        return abs(y - MID_Y)
    return math.hypot(x - NOSE_X, y - MID_Y)


def chain_pos(x, y):
    """Laufweg entlang der Kette (oben 0.., Spitze, unten zurück)."""
    if x <= NOSE_X:
        return x - BLADE_X0 if y < MID_Y else L_TOP + L_ARC + (NOSE_X - x)
    ang = math.atan2(y - MID_Y, x - NOSE_X)              # -pi/2 (oben) .. pi/2 (unten)
    return L_TOP + (ang + math.pi / 2) / math.pi * L_ARC


def plate_color(x, y):
    sx = x if x <= 33 else 22 + (x - 22) % 12
    return tuple(int(v) for v in SRC[y, sx, :3])


def build_base():
    base = SRC.copy()
    for y in range(17, 34):                              # Unschärfe entfernen
        for x in range(15, W):
            if x >= BLADE_X0 or base[y, x, 3] < 255:
                base[y, x] = 0
    return base


BASE = build_base()


# getrocknete Blutspritzer auf Blatt und Motor (x, y, Farbe)
SPLAT_DARK, SPLAT, SPLAT_HI = (74, 4, 4), (128, 8, 8), (186, 30, 26)
SPLATTER = [(21, 25, SPLAT), (22, 25, SPLAT_DARK), (22, 26, SPLAT), (26, 27, SPLAT_HI),
            (27, 27, SPLAT), (27, 28, SPLAT_DARK), (30, 24, SPLAT), (31, 25, SPLAT_HI),
            (31, 26, SPLAT), (32, 25, SPLAT_DARK), (35, 27, SPLAT), (36, 26, SPLAT_HI),
            (37, 27, SPLAT_DARK), (38, 25, SPLAT), (34, 24, SPLAT_DARK), (24, 28, SPLAT),
            (13, 26, SPLAT), (14, 25, SPLAT_HI), (16, 27, SPLAT_DARK), (17, 28, SPLAT),
            (12, 28, SPLAT_DARK)]


def chain_k(x, y, i):
    """Musterposition und Zahn-Nummer an dieser Stelle der Kette."""
    q = int(round(chain_pos(x, y))) - CHAIN_V * i
    return q % CHAIN_P, q // CHAIN_P


def draw_blade(a, i):
    for y in range(MID_Y - 6, MID_Y + 7):
        for x in range(BLADE_X0, W):
            r = radial(x, y)
            if r <= 2.5:
                a[y, x] = (*plate_color(x, y), 255)
            elif r <= 3.5:
                a[y, x] = (*CHAIN_BASE, 255)
            elif r <= 4.5:
                k, _ = chain_k(x, y, i)
                a[y, x] = (*LINK[k], 255)
            elif r <= 5.4:
                k, n = chain_k(x, y, i)
                if k == 0:
                    a[y, x] = (*(TOOTH_BLOODY if n % 3 == 0 else TOOTH), 255)
                elif k in (7, 6):
                    a[y, x] = TOOTH_TRAIL[7 - k]
    for x, y, c in SPLATTER:
        if a[y, x, 3]:
            a[y, x, :3] = c


# ---------------------------------------------------------------- Partikel
def blend(out, x, y, c, alpha):
    x, y = int(round(x)), int(round(y))
    if not (0 <= x < W and 0 <= y < H) or alpha <= 0:
        return
    if out[y, x, 3] == 0:
        out[y, x] = (*c, int(alpha))
    elif out[y, x, 3] < 200:                  # über Unschärfe des Blatts
        k = alpha / 255
        out[y, x, :3] = [int(out[y, x, j] * (1 - k) + c[j] * k) for j in range(3)]
        out[y, x, 3] = max(out[y, x, 3], int(alpha))


BLOOD, BLOOD_DARK = (138, 10, 10), (96, 8, 8)
DRIPS = [(22, 0), (27, 12), (31, 24), (25, 30), (35, 40)]   # (x, Start)


def drips(out, i):
    for x, start in DRIPS:
        t = (i - start) % N
        if t < 3:                                        # Tropfen bildet sich
            blend(out, x, 32, BLOOD, 140 + 40 * t)
        elif t < 6:                                      # fällt
            y = 32 + (t - 2) * (t - 1) // 2 + 1
            if y < GROUND:
                blend(out, x, y, BLOOD, 230)
        elif t < 16:                                     # Pfütze, verblasst
            a = 220 - (t - 6) * 20
            blend(out, x, GROUND, BLOOD_DARK, a)
            if t >= 7:
                blend(out, x - 1, GROUND, BLOOD_DARK, a * 0.7)
                blend(out, x + 1, GROUND, BLOOD_DARK, a * 0.7)


SPRAY = [(24, 20, 0.9, 1.6), (30, 20, 1.3, 1.2), (36, 21, 1.6, 1.4), (27, 20, 0.5, 1.9),
         (40, 22, 1.8, 0.9), (33, 20, 1.0, 1.7)]


def spray(out, i):
    for start, end in REVS:
        t0 = (i - start) % N
        if t0 >= end - start + 4:
            continue
        for k, (x0, y0, vx, vy) in enumerate(SPRAY):
            t = t0 - k % 3                                 # gestaffelt
            if not 0 <= t < 6:
                continue
            x = x0 + vx * t
            y = y0 - vy * t + 0.35 * t * t
            blend(out, x, y, BLOOD if t < 4 else BLOOD_DARK, 235 - t * 30)


FLING = [(40, 23, 1.6, -1.2), (41, 26, 2.0, -0.4), (40, 29, 1.7, 0.6),
         (39, 22, 1.2, -1.6), (41, 27, 2.2, 0.0), (38, 30, 1.3, 1.0)]


def fling(out, i):
    """Die schnelle Kette schleudert ständig Blut von der Spitze."""
    for k, (x0, y0, vx, vy) in enumerate(FLING):
        for start in range(k * 2, N, 12):
            t = (i - start) % N
            if t >= 5:
                continue
            x = x0 + vx * t
            y = y0 + vy * t + 0.3 * t * t
            blend(out, x, y, BLOOD if t < 3 else BLOOD_DARK, 240 - t * 40)
            if t >= 1:                                   # kurze Spur
                blend(out, x - vx * 0.6, y - vy * 0.6, BLOOD_DARK, 120 - t * 20)


def smoke(out, i):
    """Abgaswölkchen steigen hinter dem Griff auf und treiben nach rechts."""
    rev = revving(i)
    starts = range(0, N, 3) if rev else range(0, N, 8)
    for st in starts:
        t = (i - st) % N
        life = 9
        if t >= life or (revving(st) != rev and not revving(st)):
            continue
        dark = revving(st)
        x = 16 + t * 0.7
        y = 18 - t * 1.1
        a = (200 if dark else 130) * (1 - t / life)
        c = (60, 56, 60) if dark else (150, 146, 150)
        r = 0 if t < 2 else 1 if t < 5 else 2           # Wölkchen wächst
        for ox in range(-(r // 2), r + 1):
            for oy in range(-r, 1):
                edge = abs(ox - r / 2) + abs(oy + r / 2)
                blend(out, x + ox, y + oy, c, a * max(0.35, 1 - 0.25 * edge))


def frame(i):
    s = BASE.copy()
    face(s, i)
    draw_blade(s, i)
    out = np.zeros_like(s)
    dy = body_dy(i)
    for y in range(H):
        for x in range(W):
            sy = y - dy if y < 32 else y                    # Füße bleiben stehen
            if 0 <= sy < H and s[sy, x, 3]:
                out[y, x] = s[sy, x]
    smoke(out, i)
    drips(out, i)
    spray(out, i)
    fling(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'darion_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8)
