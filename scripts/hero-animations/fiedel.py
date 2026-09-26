# -*- coding: utf-8 -*-
"""Idle-Animation für Fiedel, the Mercenary Mage (27x32 + je 6 px links/rechts = 39x32).

* Der schwarze Umhang weht kräftig: beide Hälften schwingen um die Schultern
  nach außen und oben: der Saumzipfel hebt sich vom Boden, der Saum hängt
  dazwischen durch, die Außenkante bauscht sich. Die Hälften werden jedes
  Frame als Stoffflächen neu gezeichnet (Falten von der Schulter aus, frische
  1-px-Kontur); Stiefel, Arme und Handschuhe liegen darüber.
* Dunkle Aura: violett-schwarze Schwaden steigen um ihn herum auf.
* Das rote Auge im verdunkelten Gesicht glüht pulsierend.
* Ruhiges Atmen von Kopf und Schultern.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/fiedel-the-mercenary-mage.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL = PR = 6
BASE = np.zeros((SH, SW + PL + PR, 4), int)
BASE[:, PL:PL + SW] = SRC
H, W = BASE.shape[:2]
N = 48

CAPE_COLS = {rgb(c) for c in ('0a0a0a', '3b3b3b', '141414', '202020', '070707', '282828', '373737', '000000')}
LEFT_IN, RIGHT_IN = 8, 18                     # Ansatz des Umhangs (Originalspalten)
TOP = 19                                      # ab hier weht der Umhang
EYE = [rgb('801416'), rgb('b01c1c'), rgb('e8322a'), rgb('ff6a50')]


def is_cape(ox, oy):
    if oy < TOP or not (ox <= 7 or ox >= RIGHT_IN):
        return False
    return px(SRC, ox, oy) in CAPE_COLS


OUTLINE = rgb('0a0a0a')
FILL, FILL_DARK, FOLD = rgb('202020'), rgb('141414'), rgb('3b3b3b')
CENTER_X = 13.0                                # Spiegelachse zwischen den Umhanghälften


def swing(i, side):
    """Auslenkwinkel des Saumzipfels (Bogenmaß) und Bauschen der Außenkante."""
    ph = 0.0 if side < 0 else 2.1
    flap = 0.5 + 0.5 * math.sin(2 * math.pi * i / 16 + ph)
    gust = 0.7 + 0.3 * wave(i, 48, ph)
    return (0.18 + 0.62 * flap) * gust, math.sin(2 * math.pi * i / 16 + ph - 1.2)


def bezier(p0, p1, p2, n=12):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (k / n for k in range(n + 1))]


def panel(i, side):
    """Umrisspolygon der linken Umhanghälfte (für rechts gespiegelt)."""
    phi, bulge = swing(i, side)
    top_in, top_out = (8.5, 19.0), (4.5, 18.5)
    bottom_in = (8.0, 27.0)
    pivot = (7.0, 19.0)
    vx, vy = 0.5 - pivot[0], 27.0 - pivot[1]              # Saumzipfel in Ruhe: (0.5, 27)
    c, s_ = math.cos(phi), math.sin(phi)
    corner = (pivot[0] + vx * c - vy * s_, pivot[1] + vx * s_ + vy * c)
    # Saum hängt zwischen den Ecken durch, Außenkante bauscht sich
    mid = ((bottom_in[0] + corner[0]) / 2, (bottom_in[1] + corner[1]) / 2 + 1.2 + 0.8 * bulge)
    hem = bezier(bottom_in, mid, corner)
    omid = ((corner[0] + top_out[0]) / 2 - 1.2 - 0.9 * bulge * phi,
            (corner[1] + top_out[1]) / 2)
    outer = bezier(corner, omid, top_out)[1:]
    poly = [top_in] + [(top_in[0] - 0.01, 22.0)] + hem + outer
    if side > 0:
        poly = [(2 * CENTER_X - x, y) for x, y in poly]
    return poly


def inside(poly, x, y):
    n, hit = len(poly), False
    for k in range(n):
        (x1, y1), (x2, y2) = poly[k], poly[(k + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                hit = not hit
    return hit


def draw_cape(out, body, i):
    """Umhanghälften als Stoffflächen: Falten strahlen von der Schulter aus,
    frische 1-px-Kontur; Körper (Stiefel, Arme, Handschuhe) liegt darüber."""
    cape = np.zeros_like(out)
    for side in (-1, 1):
        poly = panel(i, side)
        ax = 8.0 if side < 0 else 2 * CENTER_X - 8.0
        for y in range(H):
            for x in range(W):
                ox, oy = x - PL + 0.5, y + 0.5
                if not inside(poly, ox, oy):
                    continue
                ang = math.atan2(abs(ox - ax), max(0.1, oy - 18.0))
                band = int(ang / 0.28)
                col = FOLD if band % 3 == 1 else FILL_DARK if band % 3 == 2 else FILL
                cape[y, x] = col
    m = cape[:, :, 3] > 0
    res = cape.copy()
    for y in range(H):
        for x in range(W):
            if not m[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H) or (not m[yy, xx] and body[yy, xx, 3] == 0):
                    res[y, x] = OUTLINE
                    break
    # Umhang unter den Körper legen
    mm = (res[:, :, 3] > 0) & (body[:, :, 3] == 0)
    out[mm] = res[mm]


def breath(i):
    return -1 if 6 <= i % 24 < 16 else 0


# Aura-Schwaden: (x, y, Startframe) in Originalkoordinaten
AURA = [(3, 20, 0), (22, 21, 6), (5, 14, 12), (21, 13, 18), (1, 24, 24), (24, 24, 30),
        (7, 9, 36), (18, 8, 42)]
AURA_COLS = [(58, 26, 84), (34, 14, 52), (20, 8, 30)]


def aura(out, i):
    for x0, y0, start in AURA:
        t = (i - start) % N
        if t >= 12:
            continue
        x = x0 + PL + int(round(1.2 * math.sin(t * 0.6 + x0)))
        y = y0 - t
        a = int(170 * (1 - t / 12))
        for k, (dx, dy) in enumerate(((0, 0), (0, 1), (1, 1))):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                out[yy, xx] = (*AURA_COLS[k], max(0, a - k * 40))


def frame(i):
    s = BASE.copy()
    lv = max(0, min(3, int(round(1.5 + 1.8 * wave(i, 24, -0.8)))))
    s[11, 9 + PL] = EYE[lv]
    out = np.zeros_like(s)
    b = breath(i)
    # Körper ohne wehenden Umhang; Kopf/Schultern atmen
    for y in range(H):
        for x in range(W):
            sy = y - b if y <= 18 else y
            ox = x - PL
            if 0 <= sy < H and s[sy, x, 3] and not is_cape(ox, sy):
                out[y, x] = s[sy, x]
    draw_cape(out, out.copy(), i)
    aura(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'fiedel_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
