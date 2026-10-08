"""Landschaft: organischer Boden (Gras, Dunkelgras, Erde, Wege, Teich) und Kulissen-Sprites."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image

from pixl import *


# --------------------------------------------------------------------------- Rauschen & Quantisierung (vektorisiert)


def smooth_noise(w, h, cell, seed):
    rng = np.random.RandomState(seed)
    gw, gh = w // cell + 3, h // cell + 3
    grid = rng.rand(gh, gw).astype(np.float32)
    img = Image.fromarray(grid, mode='F').resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(img)[:h, :w]


def quant_vec(L, lo, hi, X, Y, dw=0.14):
    span = hi - lo
    v = np.clip(L, 0, 1) * span
    base = np.floor(v).astype(np.int32)
    f = v - base
    base = np.minimum(base, span)
    chk = ((X + Y) % 2 == 0)
    up = (f > 0.5 + dw) | ((np.abs(f - 0.5) <= dw) & chk)
    return np.clip(lo + base + up.astype(np.int32), lo, hi)


def ramp_arr(name):
    return np.array(RAMPS[name], np.uint8)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def seg_dist(X, Y, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    ln2 = dx * dx + dy * dy
    t = np.clip(((X - x0) * dx + (Y - y0) * dy) / ln2, 0, 1)
    return np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))


# --------------------------------------------------------------------------- Boden


def make_ground(w, h, seed, paths, ponds):
    """liefert RGB (h,w,3) und eine Maske 'Wasser'/'Weg' für die Platzierung"""
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    Xi, Yi = X.astype(np.int32), Y.astype(np.int32)
    n1 = smooth_noise(w, h, 96, seed + 1)
    n2 = smooth_noise(w, h, 40, seed + 2)
    n3 = smooth_noise(w, h, 14, seed + 3)
    n4 = smooth_noise(w, h, 140, seed + 4)
    v = 0.45 * n1 + 0.35 * n2 + 0.20 * n3
    lo, hi = np.percentile(v, 4), np.percentile(v, 96)
    Ln = np.clip((v - lo) / (hi - lo), 0, 1)
    dark = smoothstep(0.58, 0.78, n4)
    L = np.clip(Ln * 0.8 + 0.22 - 0.55 * dark, 0, 1)
    idx = quant_vec(L, 1, 4, Xi, Yi)
    G = ramp_arr('grass')[idx]

    # Erdflecken
    m = 0.6 * smooth_noise(w, h, 70, seed + 5) + 0.4 * smooth_noise(w, h, 26, seed + 6)
    thr = np.percentile(m, 90)
    s = (m - thr) / (np.percentile(m, 99) - thr + 1e-6)
    dirt_idx = quant_vec(np.clip(0.25 + 0.6 * n3, 0, 1), 2, 4, Xi, Yi)
    chk = ((Xi + Yi) % 2 == 0)
    use_dirt = (s > 0.08) | ((s > -0.08) & (s <= 0.08) & chk)
    G = np.where(use_dirt[..., None], ramp_arr('dirt')[dirt_idx], G)

    water_mask = np.zeros((h, w), bool)
    path_mask = np.zeros((h, w), bool)

    # Teiche
    for (cx, cy, rx, ry) in ponds:
        d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 + 0.35 * (n2 - 0.5)
        shore = (d >= 0.98) & (d < 1.28)
        shore_in = shore & (d < 1.14)
        sand_idx = quant_vec(np.clip(0.55 + 0.4 * (n3 - 0.5), 0, 1), 3, 5, Xi, Yi)
        sand = ramp_arr('dirt')[sand_idx]
        outer_band = shore & ~shore_in
        pick_sand = shore_in | (outer_band & chk)
        G = np.where(pick_sand[..., None], sand, G)
        water = d < 0.98
        wave = 0.5 + 0.22 * np.sin((X * 0.32 + Y * 0.9) / 3.2) + 0.18 * (smooth_noise(w, h, 10, seed + 9) - 0.5)
        Lw = np.clip(wave - 0.28 * np.clip(d - 0.62, 0, 1), 0, 1)
        widx = quant_vec(Lw, 1, 4, Xi, Yi, dw=0.2)
        W_ = ramp_arr('sky')[widx]
        spark = (smooth_noise(w, h, 4, seed + 11) > 0.93) & (d < 0.8)
        W_ = np.where(spark[..., None], ramp_arr('sky')[5], W_)
        G = np.where(water[..., None], W_, G)
        water_mask |= (d < 1.3)

    # Wege
    pd = np.full((h, w), 1e9, np.float32)
    for pts, wd in paths:
        for (a, b) in zip(pts[:-1], pts[1:]):
            pd = np.minimum(pd, seg_dist(X, Y, a[0], a[1], b[0], b[1]) - wd / 2.0)
    wob = (smooth_noise(w, h, 18, seed + 12) - 0.5) * 7.0
    pdw = pd + wob
    inside = pdw < 0
    edge = (pdw >= -1.8) & (pdw < 2.4)
    base_idx = quant_vec(np.clip(0.5 + 0.9 * (n3 - 0.5), 0, 1), 3, 4, Xi, Yi, dw=0.25)
    road = ramp_arr('dirt')[base_idx]
    # Steinchen im Weg
    stones = (smooth_noise(w, h, 3, seed + 13) > 0.9) & inside
    road = np.where(stones[..., None], ramp_arr('dirt')[5], road)
    ruts = ((np.abs(((pdw + 50) % 100) - 50) < 0.1)) & inside
    G = np.where(inside[..., None], road, G)
    rim = edge & ~inside & chk
    G = np.where(rim[..., None], ramp_arr('dirt')[2], G)
    path_mask = pdw < 8
    return G.astype(np.uint8), water_mask, path_mask


def scatter_ground_decals(G, rng, count, avoid):
    """Grasbüschel, Blumen, Kiesel direkt in den Boden (Pixelmuster)"""
    h, w = G.shape[:2]
    gr = ramp_arr('grass')
    for _ in range(count):
        x, y = rng.randint(4, w - 5), rng.randint(4, h - 6)
        if avoid[y, x]:
            continue
        r = rng.random()
        if r < 0.62:      # Büschel
            G[y, x] = gr[5]
            G[y + 1, x - 1] = gr[4]
            G[y + 1, x + 1] = gr[4]
            G[y + 1, x] = gr[1]
            G[y + 2, x - 1] = gr[1]
            G[y + 2, x + 1] = gr[1]
        elif r < 0.9:     # Blume
            col = rng.choice([RAMPS['gold'][4], RAMPS['skin'][5], RAMPS['purple'][4], RAMPS['bone'][5]])
            G[y, x] = col
            G[y, x + 1] = col
            G[y + 1, x] = gr[1]
        else:             # Kiesel
            G[y, x] = RAMPS['stone'][4]
            G[y, x + 1] = RAMPS['stone'][3]
            G[y + 1, x + 1] = RAMPS['stone'][1]


# --------------------------------------------------------------------------- Kulissen-Sprites


def _blob(c, cx, cy, rx, ry, ramp, lo, hi, ambient=0.2):
    ellipse(c, cx, cy, rx, ry, ramp, lo=lo, hi=hi, ambient=ambient)


def tree_round(seed=1, ramp='leaf'):
    W, H = 50, 70
    c = Canvas(W, H)
    rnd = random.Random(seed)
    cx = 25
    # Stamm mit Wurzelfuß
    for y in range(40, 67):
        half = 3 + (1 if y > 60 else 0) + (2 if y > 64 else 0)
        for x in range(cx - half, cx + half + 1):
            u = (x - (cx - half)) / (2 * half + 1)
            idx = 4 if u < 0.25 else (3 if u < 0.55 else (2 if u < 0.85 else 1))
            if texture_noise(x, y // 2, seed) > 0.8:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    # Krone aus Blobs (hinten -> vorn)
    blobs = [(cx, 24, 19, 16), (cx - 12, 33, 11, 10), (cx + 12, 33, 11, 10), (cx, 12, 13, 10),
             (cx - 14, 21, 9, 9), (cx + 14, 21, 9, 9)]
    for (bx, by, rx, ry) in blobs:
        bx += rnd.randint(-2, 2)
        by += rnd.randint(-2, 2)
        _blob(c, bx, by, rx, ry, ramp, 1, 4, ambient=0.18)
    for (bx, by, rx, ry) in (blobs[3], blobs[0], blobs[4]):
        _blob(c, bx - 3, by - 3, rx * 0.55, ry * 0.5, ramp, 3, 5, ambient=0.3)
    for _ in range(24):
        x, y = rnd.randint(8, W - 9), rnd.randint(4, 40)
        if c.alpha(x, y):
            c.put_ramp(x, y, ramp, 5)
    # Schattenkante der Krone auf den Stamm
    for x in range(cx - 5, cx + 6):
        c.put_ramp(x, 42, 'wood', 1)
    c.outline()
    return c


def tree_blossom(seed=2):
    c = tree_round(seed, ramp='leaf')
    # rosa Blüten: Krone in 'cloth' (mauve-rosa) neu zeichnen
    W, H = c.w, c.h
    c2 = Canvas(W, H)
    rnd = random.Random(seed)
    cx = 25
    for y in range(40, 67):
        half = 3 + (1 if y > 60 else 0) + (2 if y > 64 else 0)
        for x in range(cx - half, cx + half + 1):
            u = (x - (cx - half)) / (2 * half + 1)
            idx = 3 if u < 0.25 else (2 if u < 0.55 else (1 if u < 0.85 else 0))
            c2.put_ramp(x, y, 'wood', idx + 1)
    blobs = [(cx, 24, 19, 16), (cx - 12, 33, 11, 10), (cx + 12, 33, 11, 10), (cx, 12, 13, 10),
             (cx - 14, 21, 9, 9), (cx + 14, 21, 9, 9)]
    for (bx, by, rx, ry) in blobs:
        _blob(c2, bx + rnd.randint(-2, 2), by + rnd.randint(-2, 2), rx, ry, 'cloth', 2, 5, ambient=0.2)
    for _ in range(26):
        x, y = rnd.randint(8, W - 9), rnd.randint(4, 40)
        if c2.alpha(x, y):
            c2.put_ramp(x, y, 'skin', 5)
    c2.outline()
    return c2


def tree_pine(seed=3):
    W, H = 34, 70
    c = Canvas(W, H)
    cx = 17
    c.rect(cx - 2, 56, cx + 2, 66, 'wood', 2)
    c.rect(cx - 2, 56, cx - 2, 66, 'wood', 4)
    for (top, bot, half) in ((6, 28, 11), (18, 42, 14), (30, 58, 16)):
        for y in range(top, bot):
            t_ = (y - top) / (bot - top)
            hw = 1.5 + t_ * half
            for x in range(int(cx - hw), int(cx + hw) + 1):
                u = (x - (cx - hw)) / (2 * hw + 0.01)
                L = 0.85 - 0.5 * u - 0.15 * t_ + (0.1 if (y - top) % 5 == 0 else 0)
                idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
                if (y - top) % 6 == 5:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'leaf', idx)
    c.put_ramp(cx, 4, 'leaf', 4)
    c.put_ramp(cx, 5, 'leaf', 3)
    c.outline()
    return c


def bush(seed=1, berries=False):
    c = Canvas(30, 22)
    rnd = random.Random(seed)
    for (bx, by, rx, ry) in ((15, 12, 12, 8), (8, 14, 7, 6), (22, 14, 7, 6), (15, 8, 8, 6)):
        _blob(c, bx, by, rx, ry, 'leaf', 1, 4, ambient=0.2)
    for _ in range(10):
        x, y = rnd.randint(5, 25), rnd.randint(3, 14)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'leaf', 5)
    if berries:
        for _ in range(5):
            x, y = rnd.randint(7, 23), rnd.randint(6, 16)
            if c.alpha(x, y):
                c.put_ramp(x, y, 'fire', 4)
                c.put_ramp(x + 1, y, 'fire', 3)
    c.outline()
    return c


def rock(seed=1, big=False):
    if big:
        c = Canvas(40, 30)
        ellipse(c, 20, 18, 17, 10, 'stone', lo=1, hi=5, ambient=0.15)
        ellipse(c, 13, 14, 8, 6, 'stone', lo=2, hi=5, ambient=0.25)
        for (x, y) in ((12, 11), (13, 11), (14, 12), (22, 22), (23, 22)):
            c.put_ramp(x, y, 'stone', 5)
        c.line(24, 12, 28, 18, 'stone', 1)
        for x in range(8, 30):
            if x % 3 == 0:
                c.put_ramp(x, 25, 'grass', 2)
    else:
        c = Canvas(22, 16)
        ellipse(c, 11, 9, 8.5, 5.5, 'stone', lo=1, hi=5, ambient=0.18)
        c.put_ramp(8, 6, 'stone', 5)
        c.put_ramp(9, 6, 'stone', 5)
        c.put_ramp(14, 12, 'grass', 3)
    c.outline()
    return c


def giant_mushroom(seed=1, cap='fire'):
    c = Canvas(44, 52)
    # Stiel
    for y in range(24, 49):
        half = 4 + (2 if y > 42 else 0)
        for x in range(22 - half, 22 + half + 1):
            u = (x - (22 - half)) / (2 * half + 1)
            idx = 5 if u < 0.2 else (4 if u < 0.5 else (3 if u < 0.8 else 2))
            c.put_ramp(x, y, 'bone', idx)
    # Lamellen unter dem Hut
    for x in range(8, 37):
        for y in range(22, 26):
            c.put_ramp(x, y, 'bone', 2 if (x + y) % 2 else 1)
    # Hut
    def clip(x, y):
        return y <= 24
    ellipse(c, 22, 24, 20, 16, cap, lo=1, hi=5, clip=clip, ambient=0.18)
    rnd = random.Random(seed)
    for (sx, sy, r) in ((13, 14, 3), (26, 10, 3.5), (32, 17, 2.5), (20, 19, 2.5), (9, 20, 2)):
        ellipse(c, sx, sy, r, r * 0.8, 'bone', lo=3, hi=5)
    c.outline()
    return c


def fence(n=1):
    c = Canvas(32 * n + 4, 22)
    for i in range(n + 1):
        x = i * 32 + 1
        c.rect(x, 4, x + 3, 19, 'wood', 3)
        c.rect(x, 4, x, 19, 'wood', 4)
        c.rect(x, 18, x + 3, 19, 'wood', 1)
        c.rect(x, 3, x + 3, 4, 'wood', 5)
    for y in (8, 14):
        for x in range(4, 32 * n + 1):
            c.put_ramp(x, y, 'wood', 4)
            c.put_ramp(x, y + 1, 'wood', 2)
    c.outline()
    return c


def signpost():
    c = Canvas(26, 34)
    c.rect(12, 8, 14, 32, 'wood', 3)
    c.rect(12, 8, 12, 32, 'wood', 4)
    c.rect(11, 30, 15, 32, 'wood', 1)
    round_rect(c, 2, 3, 22, 11, 'wood', lo=2, hi=5, radius=1)
    poly(c, [(4, 7), (9, 4), (9, 10)], 'wood', flat=1)          # Pfeil nach links
    c.rect(9, 6, 18, 8, 'wood', 1)
    round_rect(c, 6, 15, 24, 23, 'wood', lo=2, hi=5, radius=1)
    poly(c, [(22, 19), (17, 16), (17, 22)], 'wood', flat=1)     # Pfeil nach rechts
    c.rect(8, 18, 17, 20, 'wood', 1)
    c.outline()
    return c


def lily(seed=1):
    c = Canvas(14, 8)
    ellipse(c, 7, 4, 5.5, 3, 'leaf', lo=2, hi=5)
    c.put_ramp(11, 3, 'leaf', 0)
    c.put_ramp(10, 3, 'sky', 3)
    if seed % 2:
        c.put_ramp(6, 3, 'skin', 5)
        c.put_ramp(7, 3, 'skin', 4)
        c.put_ramp(6, 2, 'skin', 4)
    return c


def duck():
    c = Canvas(16, 14)
    ellipse(c, 8, 9, 6, 4, 'gold', lo=3, hi=5)
    ellipse(c, 11, 5, 3.2, 3, 'gold', lo=3, hi=5)
    c.rect(14, 6, 15, 7, 'fire', 4)
    c.put_ramp(12, 4, 'coal', 1)
    for x in range(3, 9):
        c.put_ramp(x, 9, 'gold', 2)
    c.outline()
    return c
