# -*- coding: utf-8 -*-
"""Partikel um eine Figur, die sie nie berühren (ganz oder gar nicht, nie halb dahinter).

* rain(...):   Regen – kurze, leicht schräge Striche fallen schnell (Wind nach rechts).
* embers(...): Glut – Funken steigen auf, wackeln, kühlen ab (hellgelb -> gelb -> orange -> rot)
               und verlöschen.

Jedes System ist eine Liste von Bahnen [(Startframe, [Pixel je Alter: {(x, y): Farbe}])], die
beim Erzeugen gegen die Figur (Vereinigung aller Frames plus 1-px-Rand) und den Bildrand
geprüft wird. draw(out, system, i, n) malt Frame i (Loop über n Frames).
"""
import math
import numpy as np
from anim_common import rgb, ring8

RAIN_HEAD, RAIN_TAIL = rgb('d8f2ff', 235), rgb('7fbfee', 170)
EMBER = [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')]


def _fig_union(frames):
    fig = np.zeros(frames[0].shape[:2], bool)
    for f in frames:
        fig |= f[:, :, 3] > 0
    return fig | ring8(fig)


def _ok(pix, fig, region):
    H, W = fig.shape
    for (x, y) in pix:
        if not (1 <= x < W - 1 and 1 <= y < H - 1) or fig[y, x] or (region is not None and not region[y, x]):
            return False
    return True


def rain(frames, count, seed, region=None, n=48, vx=0.55, tail=0.4, vy=(2.2, 3.0), storm=False, length=2):
    """count Regentropfen; region (optional): Maske, in der sie fallen dürfen; vx/tail: Schräglage
    (Sturm: großes vx, der Schweif liegt entsprechend weiter links). storm=True: Tropfen kommen
    auch von links ins Bild und fliegen am rechten Rand hinaus; length: Strichlänge in Pixeln."""
    fig = _fig_union(frames)
    H, W = fig.shape
    rng = np.random.default_rng(seed)
    res, tries = [], 0
    while len(res) < count and tries < 20000:
        tries += 1
        e = int(rng.integers(n))
        x0, y0 = rng.uniform(-W * 0.6 if storm else 1, W - 3), rng.uniform(-2, H * 0.55)
        vy_ = rng.uniform(*vy)
        steps = []
        for a in range(40):
            yh = y0 + vy_ * a
            if yh > H - 2:
                break
            xh = x0 + vx * a
            if storm and xh > W - 2:
                break
            head = (int(round(xh)), int(round(yh)))
            px = {(int(round(xh - tail * k)), int(round(yh - k))): RAIN_TAIL for k in range(length - 1, 0, -1)}
            px[head] = RAIN_HEAD
            steps.append(px)
        steps = [p for p in steps if all(1 <= y and (not storm or 1 <= x) for (x, y) in p)]
        if len(steps) < 3 or not all(_ok(p, fig, region) for p in steps):
            continue
        if sum(1 for r in res if abs(r[0] - e) < 2) > 6:
            continue
        res.append((e, steps))
    return res


def embers(frames, count, seed, region=None, n=48, sources=None):
    """count Glutfunken; sources (optional): Liste möglicher Startpunkte (x, y)."""
    fig = _fig_union(frames)
    H, W = fig.shape
    rng = np.random.default_rng(seed)
    res, tries = [], 0
    while len(res) < count and tries < 20000:
        tries += 1
        e = int(rng.integers(n))
        if sources:
            x0, y0 = sources[int(rng.integers(len(sources)))]
            x0 += rng.uniform(-1.5, 1.5)
        else:
            x0, y0 = rng.uniform(1, W - 2), rng.uniform(H * 0.3, H - 2)
        L = int(rng.integers(9, 15))
        vy, ph, wob = rng.uniform(0.7, 1.1), rng.uniform(0, 6.3), rng.uniform(0.5, 1.0)
        steps = []
        for a in range(L):
            x = int(round(x0 + wob * math.sin(0.6 * a + ph)))
            y = int(round(y0 - vy * a))
            c = EMBER[min(3, int(4 * a / L))]
            steps.append({(x, y): c})
        if not all(_ok(p, fig, region) for p in steps):
            continue
        if sum(1 for r in res if abs(r[0] - e) < 2) > 5:
            continue
        res.append((e, steps))
    return res


def draw(out, system, i, n=48):
    for e, steps in system:
        a = (i - e) % n
        if a < len(steps):
            for (x, y), c in steps[a].items():
                out[y, x] = c
