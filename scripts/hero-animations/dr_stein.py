# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Dr. Heinz N. Stein“ (Frankensteins Monster) von Visionary Genius Heinz.

Sprite: src/dr-heinz-n-stein.png (dr_stein_sprite.py). Frame 0 ist die Ruhepose.
* Federn wie bei Heinz (die Füße bleiben stehen), schweres, langsames Blinzeln (zweimal pro Loop).
* Die Nackenbolzen laden sich auf: sie glühen im Takt blau-weiß, dazu zucken kleine Blitzbögen von
  den Bolzen nach außen (jedes Mal in neuer Zickzack-Form, nie über dem Gesicht).
* Alle 24 Frames ein Stromschlag: für vier Frames blitzt die ganze Figur auf, zittert um 1 px, und
  größere Blitze springen von den Bolzen und von den Händen.
Aufruf (aus scripts/hero-animations):  python3 dr_stein.py final 90
"""
import math
import random
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce

SRC = np.array(Image.open('src/dr-heinz-n-stein.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
KNEE = 21
PL, PR, PT, PB = 6, 6, 5, 2
H, W = SH + PT + PB, SW + PL + PR
N = 48
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
EYES = [(8, 10), (9, 10), (12, 10), (13, 10)]
LID, SHUT = rgb('49633b'), rgb('10150e')
BOLTS = {(x, y) for y in (13, 14) for x in range(SW)
         if SRC[y, x, 3] and tuple(SRC[y, x, :3]) in ((0xb9, 0xbf, 0xc8), (0xee, 0xf1, 0xf4), (0x6b, 0x70, 0x79))}
TIPS = [(4, 13), (17, 13)]                      # Bolzenspitzen (links/rechts), von dort gehen die Blitze aus
HANDS = [(1, 18), (20, 18)]
ELEC = [rgb(h) for h in ('1f6bff', '5cc8ff', 'b8f0ff', 'ffffff')]     # Rand -> Kern


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def tint(c, col, f):
    return [int(c[k] + (col[k] - c[k]) * f) for k in range(3)] + [int(c[3])]


def line_px(x0, y0, x1, y1):
    n = max(int(round(max(abs(x1 - x0), abs(y1 - y0)))), 1)
    pts = []
    for k in range(n + 1):
        p = (int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n)))
        if not pts or pts[-1] != p:
            pts.append(p)
    return pts


def zigzag(rng, p0, p1, jag):
    """Blitzpfad von p0 nach p1 mit zufälligem Ausschlag (Mittelpunktverschiebung), 8er-verbunden."""
    pts = [p0, p1]
    for d in range(2):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dy) or 1
            off = rng.uniform(-jag, jag) / (1.5 ** d)
            new += [(mx - dy / ln * off, my + dx / ln * off), b]
        pts = new
    px = []
    for a, b in zip(pts, pts[1:]):
        for p in line_px(a[0], a[1], b[0], b[1]):
            if not px or px[-1] != p:
                px.append(p)
    return px


def bolt(out, pix, fade=1.0):
    """Blitzbogen: dünner weißer/hellblauer Kern, nur gelegentlich ein dunkelblauer Saum; nur auf leere Pixel."""
    core = set(pix)
    halo = [(x + dx, y + dy) for k, (x, y) in enumerate(pix) if k % 2 == 0
            for dx, dy in ((0, -1), (0, 1))] if len(pix) > 3 else []
    for x, y in halo:
        if (x, y) not in core and 1 <= x < out.shape[1] - 1 and 1 <= y < out.shape[0] - 1 and not out[y, x, 3]:
            out[y, x] = [ELEC[0][0], ELEC[0][1], ELEC[0][2], int(150 * fade)]
    for k, (x, y) in enumerate(pix):
        if 1 <= x < out.shape[1] - 1 and 1 <= y < out.shape[0] - 1 and not out[y, x, 3]:
            col = ELEC[3] if k % 3 == 0 else ELEC[2]
            out[y, x] = [col[0], col[1], col[2], int(255 * fade)]


def charge(i):
    """Aufladung der Bolzen 0..1 (Puls alle 12 Frames) und Stromschlag-Phase (0 = keiner)."""
    f = max(0.0, math.sin(2 * math.pi * (i - 4) / 12)) ** 2
    shock = {10: 0.35, 11: 1.0, 12: 0.7, 13: 0.3, 34: 0.35, 35: 1.0, 36: 0.7, 37: 0.3}.get(i, 0.0)
    return f, shock


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:                                           # schweres Blinzeln: Lid fällt, dann Strich
        for x, y in EYES:
            s[y, x] = rgb('49633b') if st == 'halb' else rgb('10150e')
    f, shock = charge(i)
    for x, y in BOLTS:                               # Bolzen laden sich blau-weiß auf
        s[y, x] = tint(s[y, x], (0x9f, 0xe8, 0xff), 0.15 + 0.7 * f)
    if shock:                                        # Stromschlag: die ganze Figur blitzt auf
        for y, x in zip(*np.nonzero(s[:, :, 3])):
            if tuple(s[y, x, :3]) != (0, 0, 0):
                s[y, x] = tint(lighten(s[y, x], 0.12 * shock), (0xb8, 0xf0, 0xff), 0.14 * shock)
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    ox = PL + ((1, -1, 1, 0)[[10, 11, 12, 13, 34, 35, 36, 37].index(i) % 4] if shock else 0)
    draw_bounce(out, s, b, KNEE, PT, ox)
    # Blitzbögen von den Bolzen (immer ein paar, beim Stromschlag mehr und länger)
    rng = random.Random(1000 + i // 2)
    n_arcs = 0
    if f > 0.2:
        n_arcs = 1
    if f > 0.7:
        n_arcs = 2
    if shock:
        n_arcs = 3
    for side, (tx, ty) in enumerate(TIPS):
        d = -1 if side == 0 else 1
        for k in range(n_arcs):
            ln = rng.uniform(2.5, 4.0 + (2.0 if shock else 0.0))
            ang = math.radians(rng.uniform(-70, 25)) if k else math.radians(rng.uniform(-25, 20))
            ex = tx + d * ln * math.cos(ang)
            ey = ty + ln * math.sin(ang)
            pix = zigzag(rng, (tx + d, ty), (ex, ey), 1.6)
            pix = [(x + ox, y + PT + b) for x, y in pix]
            bolt(out, pix, fade=min(1.0, 0.5 + f))
    if shock >= 0.7:                                 # größere Blitze springen von den Händen
        for side, (hx, hy) in enumerate(HANDS):
            d = -1 if side == 0 else 1
            pix = zigzag(rng, (hx + d * 2, hy), (hx + d * 5, hy - rng.randint(0, 3)), 1.4)
            bolt(out, [(x + ox, y + PT + b) for x, y in pix], fade=shock)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'stein_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=6, check_edges=True)
