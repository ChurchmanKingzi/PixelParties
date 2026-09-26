# -*- coding: utf-8 -*-
"""Idle-Animation für Fiedel, the Mercenary Mage (27x32 + je 6 px links/rechts = 39x32).

* Der schwarze Umhang weht kräftig: beide Seiten bauschen sich nach außen,
  Wellen laufen den Stoff hinab (Saum am stärksten); die Kontur wird jedes
  Frame frisch mit 1 px gezeichnet. Nur Umhangfarben werden gedehnt,
  Stiefel und Handschuhe bleiben.
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


def billow(oy, i, side):
    """Dehnfaktor einer Umhangzeile: nach unten stärker, Wellen laufen hinab."""
    d = (oy - TOP + 1) / (SH - TOP)                       # 0 oben .. 1 Saum
    ph = 0.0 if side < 0 else 1.9
    flap = 0.5 + 0.5 * math.sin(2 * math.pi * i / 16 - 0.8 * (oy - TOP) + ph)
    gust = 0.7 + 0.3 * wave(i, 48, ph)
    return 1.0 + 0.9 * d * (0.35 + 0.65 * flap) * gust


OUTLINE = rgb('0a0a0a')


def draw_cape(out, i):
    """Umhang zeilenweise vom Ansatz nach außen dehnen, dann frische 1-px-Kontur."""
    for side, anchor in ((-1, LEFT_IN), (1, RIGHT_IN)):
        for oy in range(TOP, SH):
            sc = billow(oy, i, side)
            for dist in range(0, 16):
                sd = dist / sc
                sx = int(round(anchor - sd)) if side < 0 else int(round(anchor + sd))
                ox = anchor - dist if side < 0 else anchor + dist
                if 0 <= sx < SW and is_cape(sx, oy) and 0 <= ox + PL < W:
                    out[oy, ox + PL] = SRC[oy, sx]
    m = out[:, :, 3] > 0
    for y in range(H):
        for x in range(W):
            if not m[y, x]:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H):
                    edge = True
                elif not m[yy, xx] and BASE[yy, xx, 3] == 0:
                    edge = True
            if edge:
                out[y, x] = OUTLINE


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
    cape = np.zeros_like(s)
    draw_cape(cape, i)
    m = cape[:, :, 3] > 0
    out[m] = cape[m]
    aura(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'fiedel_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
