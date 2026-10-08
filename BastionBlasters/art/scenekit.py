"""Gemeinsame Szenen-Helfer: Teamfarben-Tausch, Bodenschatten, Zielschatten (für Stilprobe und Karten)."""
from __future__ import annotations

import numpy as np

from pixl import *


def swap_team(cv: Canvas, src='teamA', dst='teamB'):
    out = cv.copy()
    m = {RAMPS[src][i]: RAMPS[dst][i] for i in range(len(RAMPS[src]))}
    for y in range(cv.h):
        for x in range(cv.w):
            if out.px[y, x, 3]:
                col = tuple(int(v) for v in out.px[y, x, :3])
                if col in m:
                    out.px[y, x, :3] = m[col]
                    out.rid[y, x] = RAMP_ID[dst]
    return out


def shadow(world: World, cx, cy, rx, ry):
    """Schachbrett-Schatten nur auf Bodenpixeln (Tiefe < -40)"""
    x0, x1 = int(cx - rx - 1), int(cx + rx + 2)
    y0, y1 = int(cy - ry - 1), int(cy + ry + 2)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(world.w, x1), min(world.h, y1)
    if x1 <= x0 or y1 <= y0:
        return
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
    m = (d <= 1.0) & ((d < 0.5) | ((X + Y) % 2 == 0)) & (world.depth[y0:y1, x0:x1] < -40)
    sub = world.px[y0:y1, x0:x1, :3]
    sub[m] = darken_palette(sub[m], 2)


def zielschatten(world: World, cx, cy, r, phase=0):
    rr = r * (1.0 - 0.06 * (phase % 4))
    x0, x1 = max(0, int(cx - r - 3)), min(world.w, int(cx + r + 4))
    y0, y1 = max(0, int(cy - r - 3)), min(world.h, int(cy + r + 4))
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(X + 0.5 - cx, Y + 0.5 - cy)
    ground = world.depth[y0:y1, x0:x1] < -40
    ring = (np.abs(d - rr) < 1.3) & ground
    chk = ((X + Y) % 2 == 0)
    inner = (d < rr - 1.3) & ground & (((X % 3 == 0) & (Y % 3 == 0)) | (chk & (d > rr * 0.75)))
    center = (d < 2.2) & ground
    sub = world.px[y0:y1, x0:x1, :3]
    fire = np.array(RAMPS['fire'], np.uint8)
    sub[ring & chk] = fire[5]
    sub[ring & ~chk] = fire[4]
    sub[inner] = fire[2]
    sub[center] = fire[5]
