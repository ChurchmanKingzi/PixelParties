# -*- coding: utf-8 -*-
"""Idle-Animation für Darion, the Blood-Crazy Groundskeeper (50x47).

Völlig verrückter Hausmeister mit blutiger Kettensäge:
* Die Kette läuft ständig um das Blatt: oben nach vorne, unten zurück
  (neu gezeichnetes 4-px-Gliedermuster mit abstehenden Zähnen).
* Ruhephase: er wippt, der Motor tuckert und pustet graue Wölkchen,
  Blut tropft vom Sägeblatt und bildet kleine Pfützen.
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


# ---------------------------------------------------------------- Kette
# Die Kette wird neu gezeichnet: 4-px-Muster (Metallglanz, Blut, dunkle Glieder),
# das oben nach vorne und unten zurück zum Motor läuft (1 px pro Frame),
# dazu Zähne, die nach außen abstehen. Die Deckkraft des Originals (Bewegungs-
# unschärfe zum Blattende hin) bleibt erhalten.
LINK = [(201, 184, 176), (138, 20, 20), (58, 15, 15), (74, 20, 20)]
CHAIN_BASE = (70, 18, 18)
TOOTH = (190, 170, 162)
# (Kettenzeile, ruhige Zeile, Zahnzeile, Richtung)
CHAINS = [(22, 23, 21, 1), (29, 30, 31, -1)]
CHAIN_X = range(19, 42)


def run_chain(a, i):
    for line, inner, teeth, d in CHAINS:
        for x in CHAIN_X:
            k = (x - d * i) % 4
            if SRC[line, x, 3] > 40:
                a[line, x, :3] = LINK[k]
            if SRC[inner, x, 3] > 40:
                a[inner, x, :3] = CHAIN_BASE
            if k == 0 and SRC[line, x, 3] > 40:
                alpha = max(int(SRC[teeth, x, 3]), int(SRC[line, x, 3] * 0.8))
                a[teeth, x] = (*TOOTH, alpha)


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
    s = SRC.copy()
    face(s, i)
    run_chain(s, i)
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
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'darion_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8)
