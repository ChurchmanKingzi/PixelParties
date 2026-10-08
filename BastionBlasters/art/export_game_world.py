"""Exporter 'world' des Spielprototyps: world.png / world.json (Boeden, Waende, Tore, Tuerme, Kern, Hofgebaeude, Labels, Icons, Marker),
bg_field.png / bg_field.json (Schlachtfeld-Boden ohne Burg) und die Kartenbilder in game/public/cards/.

Aufruf (aus art/):   python3 -I export_game_world.py
Ausgabe:             game/public/assets/world.png, world.json, bg_field.png, bg_field.json, game/public/cards/*.png,
                     Kontaktbogen art/out/game_assets/world_*.png

Vertrag: game/ASSET_SPEC.md, Abschnitt 3. Master-Palette, Alpha 0/255, deterministisch (feste Seeds, keine Zeit, sortierte Ausgaben).
Es wird keine bestehende Datei veraendert; cards.py und sheets.py werden nicht ausgefuehrt (nur art/out/cards/ wird kopiert).
"""
from __future__ import annotations

import glob
import importlib
import json
import math
import os
import random
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import numpy as np
from PIL import Image, ImageDraw

import pixl
from pixl import (Canvas, RAMPS, RAMP_ID, INK, WHITE, ellipse, round_rect, thick_line, poly, quant, texture_noise,
                  point_in_poly, palette_violations, darken_palette, upscale, label_font, hexrgb, World)
import cards_art
from assets_env import tile_cobble, tile_planks, tile_grass, tower, core, value_noise
from castle import (front_wall_tile, front_gate_h_tile, top_tile, Textures, FloorTiles, H_TALL, H_LOW, H_SIDE, H_GATE,
                    K_WALL, K_GATE_H, CELL)
from landscape import (smooth_noise, quant_vec, ramp_arr, smoothstep, seg_dist, tree_round, tree_pine, tree_blossom, bush, rock,
                       giant_mushroom, lily, duck)
from scenekit import shadow, swap_team
from pixfont import draw_text, text_width
import cardicons

pixl_draw = pixl.World.draw        # echte World.draw (vor jedem Patchen gemerkt)

GAME = os.path.join(ROOT, 'game', 'public')
ASSETS = os.path.join(GAME, 'assets')
CARDS_OUT = os.path.join(GAME, 'cards')
SHEETS = os.path.join(HERE, 'out', 'game_assets')
CARDS_IN = os.path.join(HERE, 'out', 'cards')
CARD_BACK = os.path.join(HERE, 'out', 'card_back.png')

BG_W_CELLS, BG_H_CELLS = 56, 28
PLOTS = ((2, 6, 17, 21), (38, 6, 53, 21))          # Baugrund P1 / P2 (Zellen, inklusiv)
CORRIDOR = (11, 16)                                # Mittelgasse (Zeilen, inklusiv), bleibt frei


# --------------------------------------------------------------------------- kleine Helfer


def crop(cv: Canvas, x0, y0, w, h) -> Canvas:
    o = Canvas(w, h)
    o.px[:] = cv.px[y0:y0 + h, x0:x0 + w]
    o.rid[:] = cv.rid[y0:y0 + h, x0:x0 + w]
    return o


def from_rgb(arr) -> Canvas:
    """opake Canvas aus einem (h, w, 3)-Array (Kacheln der Burgengine)"""
    arr = np.asarray(arr)
    c = Canvas(arr.shape[1], arr.shape[0])
    c.px[:, :, :3] = arr
    c.px[:, :, 3] = 255
    return c


def trim(cv: Canvas) -> Canvas:
    a = cv.px[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    return crop(cv, int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1))


def clear(c: Canvas, x, y):
    c.clear_pixel(int(x), int(y))


def put(c: Canvas, x, y, ramp, idx):
    c.put_ramp(int(x), int(y), ramp, idx)


def mid32(c: Canvas) -> Canvas:
    """mittlere 32 Spalten einer 96 px breiten Arbeitsflaeche (periodisch gezeichnet) -> kachelbarer Streifen"""
    return crop(c, 32, 0, 32, c.h)


def jag_line(c: Canvas, x0, y0, x1, y1, rnd, dark, lit=None, ramp='stone', wrap=None):
    """gezackte Risslinie von (x0, y0) nach (x1, y1): dunkler Kern, helle Kante rechts daneben"""
    n = max(abs(x1 - x0), abs(y1 - y0))
    x, y = float(x0), float(y0)
    pts = []
    for k in range(n + 1):
        t = k / max(1, n)
        px = x0 + (x1 - x0) * t + rnd.choice([-1, 0, 0, 1]) * (1 if 0 < k < n else 0)
        py = y0 + (y1 - y0) * t
        pts.append((int(round(px)), int(round(py))))
    for i, (px, py) in enumerate(pts):
        if wrap:
            px %= wrap
        if c.alpha(px, py):
            put(c, px, py, ramp, dark)
        if i + 1 < len(pts) and pts[i + 1][0] != pts[i][0]:      # waagrechter Versatz: Zwischenpixel
            mx = (pts[i][0] + pts[i + 1][0]) // 2
            if wrap:
                mx %= wrap
            if c.alpha(mx, py):
                put(c, mx, py, ramp, dark)
    if lit is not None:
        for (px, py) in pts:
            if wrap:
                px %= wrap
            qx = (px + 1) % wrap if wrap else px + 1
            if c.alpha(qx, py) and tuple(c.px[py, qx, :3]) != tuple(RAMPS[ramp][dark]):
                put(c, qx, py, ramp, lit)


# --------------------------------------------------------------------------- Boeden (32 x 32)


def build_floors():
    out = {}
    ft = FloorTiles()
    for s in range(3):                                   # Hofpflaster wie FloorTiles.hof
        out[f'tile.yard.{s}'] = tile_cobble(2 + s * 10, base='dirt', tone=(3, 4), mortar=2, hi=5)
    out['tile.slab'] = from_rgb(ft.slab)
    out['tile.dark'] = from_rgb(ft.dark)
    out['tile.planks.0'] = tile_planks(7, 32, tone=(3, 4, 4))     # hell (Krankenstation)
    out['tile.planks.1'] = tile_planks(3, 32, tone=(2, 3, 4))     # gemischt (Standarddielen)
    out['tile.planks.2'] = tile_planks(15, 32, tone=(2, 3, 4))    # Kaserne
    out['tile.planks.3'] = tile_planks(11, 32, tone=(2, 3, 3))    # dunkel (Schlafsaal)
    for s in range(4):
        out[f'tile.grass.{s}'] = tile_grass(s + 1, 32)
    out['tile.rubble'] = tile_rubble()
    return out


def _stone_blob(c, cx, cy, rx, ry, lo, hi, ramp='stone'):
    ellipse(c, cx, cy, rx, ry, ramp, lo=lo, hi=hi, ambient=0.22)


def tile_rubble():
    """Truemmer einer zerstoerten Wand / eines Raums: Steinbrocken und Scherben, zwischen den Steinen durchsichtig (32 x 32, kachelbar)"""
    c = Canvas(96, 96)
    rnd = random.Random(31)
    spots = [(5, 6, 4.2, 3.2), (15, 4, 2.4, 1.8), (26, 8, 3.6, 2.8), (9, 16, 2.0, 1.5), (20, 15, 5.0, 3.6), (30, 20, 2.2, 1.7),
             (4, 25, 3.2, 2.4), (13, 27, 4.4, 3.2), (25, 28, 2.4, 1.8), (17, 22, 1.6, 1.3), (1, 14, 1.8, 1.4)]
    for ox in (-32, 0, 32):
        for oy in (-32, 0, 32):
            for (x, y, rx, ry) in spots:
                _stone_blob(c, 32 + x + ox, 32 + y + oy, rx, ry, 1 if rx < 3 else 2, 4 if rx < 3 else 5)
    t = crop(c, 32, 32, 32, 32)
    for (x, y) in ((6, 5), (21, 14), (14, 26), (26, 7)):             # Glanzkanten
        if t.alpha(x, y):
            put(t, x, y, 'stone', 5)
    for _ in range(14):                                              # Staub / Splitter
        x, y = rnd.randint(1, 30), rnd.randint(1, 30)
        if not t.alpha(x, y) and not any(t.alpha(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            put(t, x, y, 'dirt' if rnd.random() < 0.6 else 'stone', 3 if rnd.random() < 0.6 else 2)
    t.outline()
    return t


# --------------------------------------------------------------------------- Waende: Stein (Engine-Texturen) und Schaeden


def stone_top_tile():
    return top_tile(K_WALL, 'teamA')                # 32 x 32, seed 2 wie Textures.tops


def stone_top():
    """Wandoberseite 32 x 8: die Pixelzeilen 28..31 und 0..3 der Kachel, also genau das Band, das die Engine fuer eine Wand auf einer Zellkante
    (Fussabdruck y-4 .. y+3) zeigt; kachelbar in x"""
    t = stone_top_tile()
    c = Canvas(32, 8)
    for y in range(8):
        c.px[y] = t.px[(y + 28) % 32]
        c.rid[y] = t.rid[(y + 28) % 32]
    return c


def stone_front(h):
    return front_wall_tile(h, seed=3)               # wie Textures.fronts


def _bricks(h, seed=3):
    """Lage der Quader wie in front_wall_tile: Liste (x0 (mod 32), y0, y1) mit Breite 16"""
    ch = 6
    out = []
    rows = (h + ch - 1) // ch
    for row in range(rows):
        off = 8 if row % 2 else 0
        for x in range(-8, 32, 16):
            out.append(((x + off) % 32, row * ch, min(h - 1, row * ch + ch - 1), row))
    return out


def damage_stone_front(c: Canvas, h, seed=1):
    """Risse und herausgebrochene Steine in einer Steinfront (kachelbar: alles mit x mod 32)"""
    c = c.copy()
    rnd = random.Random(seed * 13 + h)
    cand = [b for b in _bricks(h) if b[1] > 0 or h <= 10]
    rnd.shuffle(cand)
    nmiss = 1 if h <= 10 else 2
    done = 0
    first_x = 0
    for (bx, y0, y1, row) in cand:
        if done >= nmiss:
            break
        if y1 >= h - 1 and h > 10:
            continue                                                # Bodenreihe bleibt
        if done == 1 and abs(bx - first_x) < 14:
            continue
        done += 1
        first_x = bx
        for yy in range(y0, y1):
            for xx in range(0, 15):
                px = (bx + xx) % 32
                edge = xx in (0, 14) or yy in (y0, y1 - 1)
                if edge and ((xx * 7 + yy * 3 + seed) % 3 == 0):
                    continue                                       # Randstuecke bleiben stehen: ausgebrochene Kante
                if yy == y0 and xx > 1:
                    put(c, px, yy, 'stone', 0)
                elif (xx + yy) % 2 == 0 and yy > y0 + 1:
                    put(c, px, yy, 'stone', 1)
                else:
                    put(c, px, yy, 'stone', 0)
        # lichte Kante unten rechts im Loch (Tiefe)
        for xx in range(2, 13):
            put(c, (bx + xx) % 32, y1 - 1, 'stone', 2 if xx % 2 else 1)
    # Risse
    n_cracks = 1 if h <= 10 else 2
    starts = [(rnd.randint(3, 10), 0), (rnd.randint(18, 28), 0)]
    for k in range(n_cracks):
        sx, sy = starts[k]
        jag_line(c, sx, sy, sx + rnd.randint(-5, 5), min(h - 2, sy + (h - 3 if h <= 10 else int(h * 0.8))), rnd, 0, 4, 'stone', wrap=32)
    return c


def damage_stone_top(c: Canvas, seed=1):
    c = c.copy()
    rnd = random.Random(seed * 7 + 3)
    jag_line(c, 6, 0, 13, 7, rnd, 0, 5, 'stone', wrap=32)
    jag_line(c, 21, 0, 17, 7, rnd, 0, 5, 'stone', wrap=32)
    for (cx, cy, rx, ry) in ((24, 4, 3.4, 2.4), (9, 5, 2.4, 1.8)):
        for y in range(8):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if d <= 1.0:
                    put(c, x % 32, y, 'stone', 0 if d < 0.55 else 1)
    return c


# --------------------------------------------------------------------------- Waende: Pudding (rosa, glaenzende Klumpen)


PUD = 'cloth'


def _blob(c, x0, y0, x1, y1, tone_shift=0, radius=4):
    round_rect(c, x0, y0, x1, y1, PUD, lo=2 + tone_shift, hi=5, radius=radius, ambient=0.2, bias=0.04 * tone_shift)


def pudding_front(h, dmg=False, seed=5):
    rows = 1 if h <= 12 else 2
    ch = h // rows
    W = Canvas(96, h)
    W.rect(0, 0, 95, h - 1, PUD, 1)
    rnd = random.Random(seed)
    tone = [[rnd.choice([0, 0, 1]) for _ in range(2)] for _ in range(rows)]
    for r in range(rows):
        y0 = r * ch
        y1 = y0 + ch - 1
        off = 8 if r % 2 else 0
        for k in range(-2, 8):
            x0 = k * 16 + off
            _blob(W, x0 + 1, y0, x0 + 15, y1 - (1 if r == rows - 1 else 0) , tone[r][k % 2], radius=4 if ch > 10 else 3)
            # Glanzstreifen und Glanzpunkt
            gx, gy = x0 + 4, y0 + 2
            for (dx, dy, tone_i) in ((0, 0, 5), (1, 0, 5), (0, 1, 5), (2, -0, 4), (0, 2, 4)):
                if 0 <= gy + dy <= y1 - 2:
                    W.put_ramp(gx + dx, gy + dy, 'bone' if tone_i == 5 else PUD, 5 if tone_i == 5 else 5)
            if ch >= 10:
                W.put_ramp(x0 + 11, y1 - 3, PUD, 5)                       # Blase
            if (k + r) % 3 == 0 and ch >= 10:
                W.put_ramp(x0 + 9, y0 + 3, 'skin', 5)
    for x in range(96):                                                   # Bodenschatten
        W.put_ramp(x, h - 1, PUD, 0)
        if x % 2 == 0:
            W.put_ramp(x, h - 2, PUD, 1)
    c = mid32(W)
    if dmg:
        c = damage_pudding_front(c, h, seed)
    return c


def damage_pudding_front(c: Canvas, h, seed):
    """Loeffelkuhlen (ausgeloeffelte Mulden) und Risse im Pudding"""
    c = c.copy()
    rnd = random.Random(seed * 5 + h)
    holes = [(9, max(3, h // 2 - 1), 6.0, 3.8), (24, max(4, h // 2 + 1), 4.6, 3.0)] if h > 10 else [(10, 5, 5.0, 3.2)]
    for (cx, cy, rx, ry) in holes:
        for y in range(int(cy - ry - 2), int(cy + ry + 3)):
            for x in range(int(cx - rx - 2), int(cx + rx + 3)):
                d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if 0 <= y < h - 2 and d <= 1.0:
                    inner = d < 0.55
                    upper = y < cy
                    put(c, x % 32, y, PUD, 0 if inner and upper else (1 if inner else 2))
                elif 0 <= y < h - 2 and d <= 1.55 and ((x + y) % 2 == 0) and y < cy:
                    put(c, x % 32, y, PUD, 5)                           # glaenzender Rand der Mulde
        # Gussrinne unter der Mulde
        for k in range(3):
            yy = int(cy + ry) + 1 + k
            if yy < h - 2:
                put(c, int(cx) % 32, yy, PUD, 3)
    for k in range(2 if h > 10 else 1):
        sx = rnd.randint(2, 29)
        jag_line(c, sx, 0, sx + rnd.randint(-3, 3), h - 3, rnd, 0, 5, PUD, wrap=32)
    return c


def pudding_top(dmg=False, seed=5):
    W = Canvas(96, 8)
    for x in range(96):
        for y in range(8):
            v = y / 7.0
            bump = 0.06 * math.sin((x % 32) / 32.0 * 2 * math.pi * 2)
            L = 0.80 - 0.36 * v + bump
            W.put_ramp(x, y, PUD, quant(max(0.0, min(1.0, L)), 3, 5, x, y))
    for k in range(-1, 7):
        x = k * 16
        for y in range(8):
            W.put_ramp(x, y, PUD, 2)                                      # Fuge zwischen den Klumpen
    for x in range(96):
        W.put_ramp(x, 0, PUD, 5)
        W.put_ramp(x, 7, PUD, 2)
        if x % 2:
            W.put_ramp(x, 6, PUD, 3)
    for k in range(-1, 7):                                                # Glanz
        W.put_ramp(k * 16 + 4, 2, 'bone', 5)
        W.put_ramp(k * 16 + 5, 2, 'bone', 5)
        W.put_ramp(k * 16 + 4, 3, PUD, 5)
    for ox in (0, 32, 64):
        # Kirsche links, Sahnetupfer rechts
        ellipse(W, ox + 8, 3.5, 2.6, 2.4, 'fire', lo=1, hi=4, ambient=0.25, spec=(ox + 7, 2, 5))
        W.put_ramp(ox + 9, 1, 'leaf', 3)
        for (dx, dy, i) in ((-2, 1, 4), (-1, 1, 5), (0, 1, 5), (1, 1, 5), (2, 1, 4), (-1, 0, 5), (0, 0, 5), (1, 0, 5), (0, -1, 5), (-2, 2, 3), (-1, 2, 3), (0, 2, 3), (1, 2, 3), (2, 2, 3)):
            W.put_ramp(ox + 24 + dx, 4 + dy, 'bone', i)
    c = mid32(W)
    if dmg:
        c = c.copy()
        rnd = random.Random(seed + 9)
        for (cx, cy, rx, ry) in ((12, 4, 4.0, 2.4), (26, 3, 2.6, 2.0)):
            for y in range(8):
                for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                    d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                    if d <= 1.0:
                        put(c, x % 32, y, PUD, 0 if d < 0.5 else 1)
                    elif d <= 1.6 and (x + y) % 2 == 0 and y < cy:
                        put(c, x % 32, y, PUD, 5)
        jag_line(c, 3, 0, 5, 7, rnd, 0, 5, PUD, wrap=32)
    return c


# --------------------------------------------------------------------------- Waende: Panzer (genietete Platten, Rost)


def _plate(c, x0, y0, x1, y1, tone, seedv):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            v = (y - y0) / max(1, y1 - y0)
            L = 0.80 - 0.34 * u - 0.30 * v
            idx = quant(max(0.0, min(1.0, L)), tone - 1, tone + 1, x, y)
            if texture_noise(x, y, seedv) > 0.93:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'metal', idx)
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y0, 'metal', 5 if x % 5 else 4)
        c.put_ramp(x, y1, 'metal', 0)
        if y1 - 1 > y0:
            c.put_ramp(x, y1 - 1, 'metal', 1)
    for y in range(y0, y1 + 1):
        c.put_ramp(x0, y, 'metal', 4)
        c.put_ramp(x1, y, 'metal', 1)
    c.put_ramp(x0, y1, 'metal', 1)


def _rivet(c, x, y):
    ellipse(c, x + 1.5, y + 1.5, 2.0, 2.0, 'metal', lo=2, hi=5, ambient=0.3, spec=(x + 1, y + 1, 5))
    c.put_ramp(x + 3, y + 3, 'metal', 0)
    c.put_ramp(x + 2, y + 3, 'metal', 1)
    c.put_ramp(x + 3, y + 2, 'metal', 1)


def _rust_blob(c, cx, cy, rx, ry):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0 and c.alpha(x, y):
                if d < 0.45:
                    c.put_ramp(x, y, 'dirt', 3 if (x + y) % 2 == 0 else 2)
                elif (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'dirt', 2)


def _rust_streak(c, x, y, ln, rnd):
    for k in range(ln):
        if (k + x) % 3 == 2 and rnd.random() < 0.7:
            continue
        if c.alpha(x, y + k):
            c.put_ramp(x, y + k, 'dirt', 3 if k < 2 else 2)


def armor_front(h, dmg=False, seed=11):
    rows = 1 if h <= 12 else 2
    ch = h // rows
    c = Canvas(32, h)
    rnd = random.Random(seed + h)
    for r in range(rows):
        y0 = r * ch
        y1 = y0 + ch - 1
        if r % 2 == 0:
            plates = [(0, 31, 3)]
            if h <= 12:
                plates = [(0, 13, 2), (14, 31, 3)]
        else:
            plates = [(0, 11, 2), (12, 31, 3)]
        for (xa, xb, tone) in plates:
            _plate(c, xa, y0, xb, y1, tone, seed + r * 3 + xa)
        # Nieten: Ecken der Platten
        for (xa, xb, tone) in plates:
            if xb - xa > 12 and ch >= 10:
                for x in range(xa + 3, xb - 4, 9 if xb - xa > 20 else 12):
                    if x + 3 < 31 and x > 0:
                        _rivet(c, x, y0 + 2)
            elif ch >= 10:
                _rivet(c, xa + 4, y0 + 3)
    for x in range(32):
        c.put_ramp(x, h - 1, 'metal', 0)
    # Beule
    if h >= 20:
        for y in range(h):
            for x in range(32):
                d = ((x - 21) / 4.2) ** 2 + ((y - 7) / 3.0) ** 2
                if d <= 1.0 and c.alpha(x, y):
                    c.put_ramp(x, y, 'metal', 1 if (x - 21) + (y - 7) < 0 else 4)
                elif d <= 1.8 and c.alpha(x, y) and (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'metal', 2)
    # Rost
    _rust_blob(c, 8, h - 3, 6.5, 2.4)
    _rust_blob(c, 25, h - 4 if h > 10 else h - 3, 4.5, 2.2)
    for (x, y0_, ln) in ((6, 4, 4), (14, ch + 3 if rows > 1 else 3, 5), (27, 3, 4)):
        _rust_streak(c, x, min(y0_, h - 6), ln, rnd)
    if dmg:
        c = damage_armor_front(c, h, seed)
    return c


def damage_armor_front(c: Canvas, h, seed):
    """aufgerissene Platte (Loch mit Blech-Lappen), Risse, fehlende Nieten, mehr Rost"""
    c = c.copy()
    rnd = random.Random(seed * 3 + h)
    cx, cy = 16, h // 2 - (1 if h > 10 else 0)
    pts = [(cx - 6, cy - 3), (cx - 2, cy - 5), (cx + 3, cy - 4), (cx + 7, cy - 1), (cx + 5, cy + 3), (cx - 1, cy + 4), (cx - 5, cy + 2)]
    if h <= 10:
        pts = [(cx - 5, cy - 2), (cx - 1, cy - 3), (cx + 4, cy - 2), (cx + 6, cy + 1), (cx + 1, cy + 3), (cx - 4, cy + 2)]
    ys = [p[1] for p in pts]
    for y in range(min(ys) - 1, max(ys) + 2):
        for x in range(cx - 9, cx + 10):
            if 0 <= y < h - 1 and point_in_poly(x + 0.5, y + 0.5, pts):
                dark = 0 if y < cy + 1 else 1
                c.put_ramp(x, y, 'coal', dark)
    # Blech-Lappen oben und unten (aufgebogen)
    for k, (x, y) in enumerate(pts):
        if 0 <= y < h - 1 and c.alpha(x, y):
            c.put_ramp(x, y, 'metal', 5 if k % 2 == 0 else 4)
    for x in range(cx - 4, cx + 4):
        yy = cy + 4 if h > 10 else cy + 3
        if 0 < yy < h - 1:
            c.put_ramp(x, yy, 'metal', 5 if (x + 1) % 2 == 0 else 3)
    # Risse
    for sx in (5, 27):
        jag_line(c, sx, 0, sx + rnd.randint(-2, 2), h - 3, rnd, 0, 5, 'metal', wrap=32)
    # mehr Rost am Loch
    _rust_blob(c, cx - 7, cy + 2, 3.0, 2.0)
    _rust_blob(c, cx + 8, cy - 2, 2.6, 2.0)
    for x in (cx - 5, cx + 2):
        _rust_streak(c, x, min(h - 6, cy + 4), 4, rnd)
    return c


def armor_top(dmg=False, seed=11):
    c = Canvas(32, 8)
    for x in range(32):
        for y in range(8):
            v = y / 7.0
            L = 0.86 - 0.22 * v - 0.10 * (x / 32.0)
            c.put_ramp(x, y, 'metal', quant(max(0.0, min(1.0, L)), 2, 4, x, y))
    for x in range(32):
        c.put_ramp(x, 0, 'metal', 5)
        c.put_ramp(x, 7, 'metal', 1)
    for y in range(1, 7):
        c.put_ramp(0, y, 'metal', 1)
        c.put_ramp(1, y, 'metal', 4)
        c.put_ramp(16, y, 'metal', 1)
        c.put_ramp(17, y, 'metal', 4)
    for x in (4, 12, 20, 28):
        if x not in (28,):
            _rivet(c, x, 2)
    _rivet(c, 25, 2)
    _rust_blob(c, 9, 6, 3.4, 1.6)
    _rust_blob(c, 27, 5, 2.4, 1.6)
    if dmg:
        rnd = random.Random(seed + 4)
        for (cx, cy, rx, ry) in ((11, 3, 3.6, 2.4),):
            for y in range(8):
                for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                    d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                    if d <= 1.0:
                        c.put_ramp(x, y, 'coal', 0 if y < cy else 1)
        jag_line(c, 22, 0, 24, 7, rnd, 0, 5, 'metal', wrap=32)
        c.put_ramp(20, 3, 'dirt', 2)
    return c


# --------------------------------------------------------------------------- Waende: Bann (Kristallbloecke mit Runen)


def _rune(c, cx, cy, phase=2, big=True):
    """leuchtende Bannrune (wie rune() der Karte BS-04, 3 Pulsphasen)"""
    if big:
        halo = 5 + phase
        for y in range(cy - halo - 1, cy + halo + 2):
            for x in range(cx - halo - 1, cx + halo + 2):
                d = math.hypot(x - cx, (y - cy) * 1.05)
                if d <= halo and c.alpha(x, y) and (x + y) % 2 == 0:
                    if d > halo - 2.0:
                        c.put_ramp(x, y, 'purple', 2)
                    elif d > halo - 3.2:
                        c.put_ramp(x, y, 'purple', 3)
        ring = [(0, -4), (2, -4), (3, -2), (4, 0), (3, 2), (2, 4), (0, 4), (-2, 4), (-3, 2), (-4, 0), (-3, -2), (-2, -4)]
        for (dx, dy) in ring:
            c.put_ramp(cx + dx, cy + dy, 'purple', 5)
        for k in range(-2, 3):
            c.put_ramp(cx, cy + k, 'purple', 5)
        for k in range(1, 3):
            c.put_ramp(cx - k, cy - 2 + k, 'purple', 4)
            c.put_ramp(cx + k, cy - 2 + k, 'purple', 4)
        c.put_ramp(cx, cy + 4, 'bone', 5)
        c.put_ramp(cx, cy - 4, 'bone', 5)
        c.put_ramp(cx, cy, 'bone', 5)
    else:
        for (dx, dy) in ((0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-1, -1), (1, -1), (-2, 0), (2, 0)):
            c.put_ramp(cx + dx, cy + dy, 'purple', 5)
        c.put_ramp(cx, cy, 'bone', 5)


def ward_front(h, dmg=False, seed=3):
    c = Canvas(32, h)
    f0 = 0
    sock = 3 if h > 10 else 2                                  # Steinsockel unten
    fh = h - sock
    for x in range(32):
        bx = x
        for y in range(fh):
            t = y / float(max(1, fh - 1))
            sh = int(t * 2)
            if bx <= 1:
                idx = 5 if bx == 0 else 4
            elif bx < 7 + sh:
                idx = 3 if t < 0.5 else 2
                if (x + y) % 2 == 0 and abs(t - 0.5) < 0.1:
                    idx = 2 if idx == 3 else 3
            elif bx < 25 + sh:
                idx = 2 if t < 0.35 else 1
                if (x + y) % 2 == 0 and abs(t - 0.35) < 0.12:
                    idx = 2 if idx == 1 else 1
            elif bx < 31:
                idx = 1 if t < 0.6 else 0
            else:
                idx = 0
            if bx in (7 + sh, 25 + sh):
                idx = 4 if bx == 7 + sh else 3
            if y == 0:
                idx = 5
            elif y == 1 and bx > 1:
                idx = max(idx, 3)
            if texture_noise(x, y, 40 + seed) > 0.968 and bx > 2:
                idx = 5
            c.put_ramp(x, y, 'purple', idx)
    for x in range(32):
        for y in range(fh, h):
            c.put_ramp(x, y, 'stone', 0 if y == h - 1 else (1 if (x + y) % 2 else 2))
    if h >= 20:
        _rune(c, 16, 9 if h >= 22 else 8, 1 if dmg else 2)
    else:
        _rune(c, 16, 4, 2, big=False)
    if dmg:
        c = damage_ward_front(c, h, seed, sock)
    return c


def damage_ward_front(c: Canvas, h, seed, sock):
    c = c.copy()
    rnd = random.Random(seed * 17 + h)
    fh = h - sock
    # abgesplitterte Ecke (oben rechts) und Kante (unten links)
    for y in range(0, 5 if h > 10 else 3):
        for x in range(32 - (7 - 2 * y), 32):
            if y < 4:
                put(c, x, y, 'purple', 0 if y > 0 else 1)
    for y in range(max(0, fh - 4), fh):
        for x in range(0, 4 - (fh - 1 - y)):
            put(c, x, y, 'purple', 0)
    # Bruchlinien (hell-dunkel) durch den Block
    jag_line(c, 11, 0, 14, fh - 1, rnd, 0, 5, 'purple', wrap=32)
    jag_line(c, 22, 1, 19, fh - 1, rnd, 0, 4, 'purple', wrap=32)
    # zerrissene Rune: Funken am Riss
    if h >= 20:
        for (dx, dy) in ((3, 2), (4, 3), (-5, -2), (6, -3)):
            if c.alpha(16 + dx, 9 + dy):
                put(c, 16 + dx, 9 + dy, 'bone', 5)
    # Splitter-Leerstellen
    for _ in range(2):
        x, y = rnd.randint(3, 28), rnd.randint(2, max(3, fh - 3))
        for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
            put(c, x + dx, y + dy, 'purple', 0)
    return c


def ward_top(dmg=False, seed=3):
    c = Canvas(32, 8)
    for x in range(32):
        for y in range(8):
            v = y / 7.0
            bx = x
            L = 0.92 - 0.32 * v - 0.12 * (bx / 32.0)
            idx = quant(max(0.0, min(1.0, L)), 2, 5, x, y)
            if (bx + y * 3) % 16 == 0:
                idx = 5
            c.put_ramp(x, y, 'purple', idx)
    for x in range(32):
        c.put_ramp(x, 0, 'purple', 5)
        c.put_ramp(x, 7, 'purple', 1)
    for y in range(8):
        c.put_ramp(0, y, 'purple', 5 if y else 5)
        c.put_ramp(16, y, 'purple', 1)
    for (x, y) in ((6, 3), (23, 4), (12, 5)):
        c.put_ramp(x, y, 'bone', 5)
    if dmg:
        rnd = random.Random(seed + 2)
        jag_line(c, 8, 0, 11, 7, rnd, 0, 4, 'purple', wrap=32)
        jag_line(c, 24, 0, 21, 7, rnd, 0, 5, 'purple', wrap=32)
        for (cx, cy, rx, ry) in ((19, 3, 2.6, 2.0),):
            for y in range(8):
                for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                    d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                    if d <= 1.0:
                        c.put_ramp(x, y, 'purple', 0)
    return c


# --------------------------------------------------------------------------- Waende: Zusammenbau, Pfosten, Bresche


def build_walls():
    out = {}
    heights = (22, 10, 20)
    out['wall.top'] = stone_top()
    out['wall.top.dmg'] = damage_stone_top(out['wall.top'])
    for h in heights:
        out[f'wall.front.{h}'] = stone_front(h)
        out[f'wall.front.{h}.dmg'] = damage_stone_front(out[f'wall.front.{h}'], h)
    for name, ftop, ffront in (('pudding', pudding_top, pudding_front), ('armor', armor_top, armor_front), ('ward', ward_top, ward_front)):
        out[f'wall.top.{name}'] = ftop()
        out[f'wall.top.{name}.dmg'] = ftop(dmg=True)
        for h in heights:
            out[f'wall.front.{h}.{name}'] = ffront(h)
            out[f'wall.front.{h}.{name}.dmg'] = ffront(h, dmg=True)
    out['wall.post'] = wall_post()
    out['wall.breach'] = wall_breach()
    return out


def wall_post():
    """Eckpfeiler 10 x 34 (Oberseite 8 + Front 26): Ausschnitt der Engine-Quader (front_wall_tile) mit heller linker und dunkler rechter Kante"""
    c = Canvas(10, 34)
    top = stone_top_tile()
    for y in range(8):
        for x in range(10):
            c.put(x, y, tuple(int(v) for v in top.px[y + 8, x + 11, :3]), RAMP_ID['stone'])
    for x in range(10):
        c.put_ramp(x, 0, 'stone', 5)
        c.put_ramp(x, 7, 'stone', 2)
    for y in range(8):
        c.put_ramp(0, y, 'stone', 5)
        c.put_ramp(9, y, 'stone', 1)
    fr = front_wall_tile(26, seed=4, moss=False)
    for y in range(26):
        for x in range(10):
            col = tuple(int(v) for v in fr.px[y, x + 10, :3])
            c.put(x, 8 + y, col, RAMP_ID['stone'])
    for y in range(8, 34):
        cur = tuple(int(v) for v in c.px[y, 0, :3])
        if cur in (RAMPS['stone'][1], RAMPS['stone'][2], RAMPS['stone'][3]):
            c.put_ramp(0, y, 'stone', 4)
        c.put_ramp(9, y, 'stone', 1)
        c.put_ramp(8, y, 'stone', 2 if (y // 2) % 2 else 1)
    for x in range(10):                                   # Schattenkante unter der Kappe
        c.put_ramp(x, 8, 'stone', 1)
        c.put_ramp(x, 33, 'stone', 0)
    return c


def wall_breach():
    """Truemmerhaufen in einer Wandluecke (32 x 12): Steinbrocken, Schutt, Staub; durchsichtig zwischen den Steinen"""
    c = Canvas(32, 12)
    rnd = random.Random(21)
    blocks = [(3, 9, 5.2, 2.8), (12, 9, 6.4, 3.0), (23, 9, 5.8, 2.8), (8, 6, 4.4, 2.8), (17, 5, 5.0, 3.2), (26, 6, 3.4, 2.4),
              (13, 3, 3.4, 2.2), (5, 3, 2.4, 1.8), (22, 2, 2.6, 1.8)]
    for (x, y, rx, ry) in blocks:
        _stone_blob(c, x, y, rx, ry, 1, 4 if (x + y) % 2 else 5)
    for (x, y) in ((8, 4), (17, 3), (13, 2), (4, 3), (26, 5), (3, 8), (23, 7)):
        if c.alpha(x, y):
            put(c, x, y, 'stone', 5)
    for k in range(32):                                    # Schutt und Staub am Boden
        if rnd.random() < 0.55 and not c.alpha(k, 11):
            put(c, k, 11, 'dirt', 3 if rnd.random() < 0.5 else 2)
    for _ in range(10):
        x, y = rnd.randint(0, 31), rnd.randint(8, 11)
        if not c.alpha(x, y):
            put(c, x, y, 'stone' if rnd.random() < 0.5 else 'dirt', 2 if rnd.random() < 0.5 else 3)
    c.outline()
    return c


# --------------------------------------------------------------------------- Tueren und Tore


def _wood_leaf(c, x0, x1, y0, y1, seed=1):
    """schmaler Torfluegel (Holzbretter von der Kante gesehen), Licht links"""
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            idx = 4 if u < 0.34 else (3 if u < 0.67 else 2)
            if texture_noise(x, y, seed) > 0.86:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
        c.put_ramp(x, y1, 'wood', 1)


def door_front(h):
    """Tuer in einer Suedwand: Quaderfront mit 14 px breitem, durchsichtigem Durchgang (Holzrahmen, Sturz, offener Fluegel)"""
    c = stone_front(h)
    x0, x1 = (32 - 14) // 2, (32 + 14) // 2 - 1                   # 9 .. 22 wie castle.DOOR_W
    top = 5 if h >= 20 else 4
    lin = top - 2                                                  # Sturz (Holzbalken)
    for y in range(top, h):
        for x in range(x0, x1 + 1):
            clear(c, x, y)
    # Stein-Gewaende unten dunkel absetzen
    for y in range(lin, h):
        for x in (x0 - 2, x0 - 1):
            c.put_ramp(x, y, 'wood', 4 if x == x0 - 2 else 2)
        for x in (x1 + 1, x1 + 2):
            c.put_ramp(x, y, 'wood', 3 if x == x1 + 1 else 1)
    for x in range(x0 - 2, x1 + 3):
        c.put_ramp(x, lin, 'wood', 4 if x % 3 else 5)
        c.put_ramp(x, lin + 1, 'wood', 2)
    c.put_ramp(x0 - 1, lin, 'metal', 4)
    c.put_ramp(x1 + 1, lin, 'metal', 3)
    # Schatten unter dem Sturz im Durchgang (Tiefe)
    for x in range(x0, x1 + 1):
        if (x + top) % 2 == 0 or h < 20:
            c.put_ramp(x, top, 'coal', 1)
    # offener Torfluegel links im Durchgang
    if h >= 20:
        _wood_leaf(c, x0, x0 + 2, top + 1, h - 1, 3)
        for y in (top + 4, h - 5):
            for x in range(x0, x0 + 3):
                c.put_ramp(x, y, 'metal', 3 if x % 2 else 4)
        c.put_ramp(x0 + 2, top + 8 if h > 22 else top + 7, 'gold', 5)
    else:
        _wood_leaf(c, x0, x0 + 1, top + 1, h - 1, 3)
    return c


def _gate_opening(h):
    """Pixelmenge des Torbogens (wie front_gate_h_tile) und Bogenoberkante je Spalte"""
    cells = set()
    tops = {}
    for z in range(3, h):
        for x in range(5, 27):
            if z < 9:
                dx = (x + 0.5 - 16) / 11.0
                top = 3 + 6 * (1 - math.sqrt(max(0.0, 1 - dx * dx)))
                tops[x] = top
                if z < top:
                    continue
            cells.add((x, z))
    return cells, tops


def gate_front(team):
    return front_gate_h_tile(H_GATE, team)             # Seed 1 wie Textures.fronts


def gate_open(team):
    """offenes Tor: gleicher Steinbogen, Durchgang durchsichtig, Torfluegel seitlich zurueckgeschwenkt, dunkle Bogenunterkante"""
    h = H_GATE
    c = front_gate_h_tile(h, team)
    cells, tops = _gate_opening(h)
    for (x, z) in cells:
        clear(c, x, z)
    # Bogenunterkante: zwei dunkle Zeilen (Mauerstaerke)
    for (x, z) in sorted(cells):
        top = tops.get(x, 3)
        if z < math.ceil(top) + 2 and z >= 3:
            c.put_ramp(x, z, 'coal', 0 if z < math.ceil(top) + 1 else 1)
    # Fluegel: links x 5..8, rechts x 23..26
    for (xa, xb) in ((5, 7), (24, 26)):
        for z in range(9, h):
            for x in range(xa, xb + 1):
                u = (x - xa) / max(1, xb - xa)
                idx = 4 if u < 0.34 else (3 if u < 0.67 else 2)
                if xa > 20:
                    idx = {0: 3, 1: 2, 2: 1}[x - xa] if False else (3 if x == xa else (2 if x == xa + 1 else 1))
                if texture_noise(x, z, 3) > 0.86:
                    idx = max(1, idx - 1)
                c.put_ramp(x, z, 'wood', idx)
        for bz in (int(h * 0.38), int(h * 0.72)):
            for x in range(xa, xb + 1):
                c.put_ramp(x, bz, 'metal', 3 if x % 2 else 4)
                c.put_ramp(x, bz + 1, 'metal', 2)
        c.put_ramp(xa + 1, int(h * 0.55), 'gold', 5)
    # Fluegel-Oberkanten folgen dem Bogen
    for x in (5, 6, 7, 24, 25, 26):
        yt = int(math.ceil(tops.get(x, 3)))
        for z in range(yt, 9):
            if (x, z) in cells:
                c.put_ramp(x, z, 'wood', 4 if x < 16 else 2)
    return c


def gate_side():
    """Seitentor: offener Durchlass mit Holzschwelle (Eisenbaender), 8 x 32, wie Castle.paint_gates"""
    pl = top_tile(K_GATE_H, 'teamA')
    c = Canvas(8, 32)
    for yy in range(32):
        for xx in range(8):
            c.px[yy, xx] = pl.px[yy, (xx - 4 + 16) % 32]
            c.rid[yy, xx] = pl.rid[yy, (xx - 4 + 16) % 32]
    return c


def build_doors():
    out = {}
    out['door.front'] = door_front(H_TALL)
    out['door.front.10'] = door_front(H_LOW)
    out['gate.front@A'] = gate_front('teamA')
    out['gate.front@B'] = gate_front('teamB')
    out['gate.open@A'] = gate_open('teamA')
    out['gate.open@B'] = gate_open('teamB')
    out['gate.side'] = gate_side()
    return out


# --------------------------------------------------------------------------- Turm, Kern und Ruinen


def build_tower_ruin(team='teamA'):
    """Turmruine: der gemauerte Zylinderstumpf des Wehrturms (assets_env.tower) mit ausgebrochener Krone, Schutt, Russflecken"""
    src = tower(team)                                   # 40 x 72
    c = Canvas(40, 72)
    rnd = random.Random(41)
    bx0, bx1 = 6, 33
    broke = {}
    for x in range(bx0, bx1 + 1):
        n = value_noise(x * 2, 5, 32, 17)
        broke[x] = int(46 + 5 * n + (3 if (x // 3) % 2 else 0) + (2 if x % 5 == 0 else 0))
    # Zylinderstumpf: Koerper vom Original, ab der Bruchkante
    for x in range(bx0, bx1 + 1):
        for y in range(broke[x], 67):
            c.px[y, x] = src.px[y, x]
            c.rid[y, x] = src.rid[y, x]
    # Innenseite der Rueckwand hinter der Bruchkante (dunkel, zackig, niedriger als die Front)
    for x in range(bx0 + 2, bx1 - 1):
        back = broke[x] - 3 - (2 if (x // 4) % 2 else 0)
        for y in range(back, broke[x]):
            idx = 1 if (x + y) % 2 else 0
            c.put_ramp(x, y, 'stone', idx)
    # Bruchkante: helle Kante oben, dunkle Absplitterungen
    for x in range(bx0, bx1 + 1):
        c.put_ramp(x, broke[x], 'stone', 5 if x % 3 else 4)
        if x % 2 == 0:
            c.put_ramp(x, broke[x] + 1, 'stone', 3)
    # Risse
    for sx, sy in ((12, broke[12] + 2), (25, broke[25] + 3)):
        jag_line(c, sx, sy, sx + rnd.randint(-2, 2), min(63, sy + 9), rnd, 0, 4, 'stone')
    # Russ (Schachbrett) an der Krone
    for x in range(bx0, bx1 + 1):
        for y in range(broke[x] + 2, broke[x] + 7):
            if (x + y) % 2 == 0 and c.alpha(x, y) and rnd.random() < 0.3:
                c.put_ramp(x, y, 'stone', 1)
    # Schutt: herabgefallene Quader und Bruchstuecke am Fuss
    for (x, y, rx, ry, lo, hi) in ((4, 66, 4.5, 2.6, 1, 4), (10, 69, 3.4, 2.2, 1, 4), (30, 68, 5.2, 2.8, 1, 4), (37, 66, 2.8, 2.0, 1, 3),
                                   (20, 70, 2.6, 1.8, 1, 3), (35, 70, 2.2, 1.6, 2, 4), (24, 69, 3.0, 2.0, 1, 4)):
        ellipse(c, x, y, rx, ry, 'stone', lo=lo, hi=hi, ambient=0.2)
    for (x, y) in ((3, 65), (30, 67), (9, 68)):
        c.put_ramp(x, y, 'stone', 5)
    c.outline()
    return c


def core_sprite(f=0, ring_team='teamA', glow='purple'):
    """Kern (wie assets_env.core, 64 x 84) mit drei Gluehphasen f = 0, 1, 2: Glut unter dem Kristall pulsiert, Funken funkeln, Runenpunkte wandern"""
    c = Canvas(64, 84)
    cx = 32
    ellipse(c, cx, 66, 29, 13, 'stone', lo=1, hi=4, ambient=0.3, flatness=0.35)
    for k, ang in enumerate(range(0, 360, 20)):
        a = math.radians(ang)
        x = cx + math.cos(a) * 22
        y = 66 + math.sin(a) * 9.5
        hot = (k + f) % 3 == 0
        c.put_ramp(int(x), int(y), ring_team, 5 if hot else 4)
        c.put_ramp(int(x), int(y) + 1, ring_team, 3 if hot else 2)
    ellipse(c, cx, 64, 18, 8, 'stone', lo=1, hi=5, ambient=0.3, flatness=0.25)
    inner = (0.30, 0.42, 0.56)[f]
    outer = (0.62, 0.72, 0.86)[f]
    for y in range(48, 72):
        for x in range(cx - 18, cx + 18):
            dx = (x + 0.5 - cx) / 17.0
            dy = (y + 0.5 - 62) / 9.0
            d = dx * dx + dy * dy
            if d < 1.0 and c.px[y, x, 3]:
                if d < inner:
                    c.put_ramp(x, y, glow, (3, 4, 4)[f] if (x + y) % 2 == 0 else (2, 3, 3)[f])
                elif d < outer and (x + y) % 2 == 0:
                    c.put_ramp(x, y, glow, 2 if f < 2 else 3)

    def facet(pts, ramp, idx_fn):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            for x in range(min(xs), max(xs) + 1):
                if point_in_poly(x + 0.5, y + 0.5, pts):
                    c.put_ramp(x, y, ramp, idx_fn(x, y))

    top, bot = (cx, 22), (cx, 61)
    L1, L2, R1, R2 = (cx - 9, 31), (cx - 9, 49), (cx + 9, 31), (cx + 9, 49)
    M1, M2 = (cx, 35), (cx, 53)
    span = 39.0
    bias = (-0.04, 0.0, 0.05)[f]
    facet([top, L1, L2, bot, M2, M1], glow, lambda x, y: quant(0.55 + bias + 0.45 * (1 - (y - 22) / span) * 0.8, 2, 5, x, y))
    facet([top, M1, M2, bot, R2, R1], glow, lambda x, y: quant(0.15 + bias + 0.35 * (1 - (y - 22) / span), 1, 4, x, y))
    for y in range(35, 54):
        c.put_ramp(cx, y, glow, 5)
    for k in range(9):
        c.put_ramp(cx - 6, 33 + k + f * 2, glow, 5)                     # Glanzstreifen wandert
    c.put_ramp(cx - 4, 27, glow, 5)
    c.put_ramp(cx - 3, 26, glow, 5)
    spark = [(10, 36), (52, 30), (46, 52), (16, 54), (26, 18), (40, 20)]
    for i, (x, y) in enumerate(spark):
        ph = (i + f) % 3
        if ph == 2:
            continue
        c.put_ramp(x, y, glow, 5)
        if ph == 0:
            for (dx, dy) in ((1, 0), (0, -1), (0, 1), (-1, 0)):
                c.put_ramp(x + dx, y + dy, glow, 3)
    c.outline()
    return c


def build_core_ruin(ring_team='teamA'):
    """zerstoerter Kern: aufgerissene Sockelscheibe, Krater mit Glut, zersprungener Kristall (dunkle Scherben)"""
    c = Canvas(64, 84)
    cx = 32
    rnd = random.Random(53)
    ellipse(c, cx, 66, 29, 13, 'stone', lo=0, hi=3, ambient=0.3, flatness=0.35)
    for k, ang in enumerate(range(0, 360, 20)):
        if k % 3 == 1:
            continue
        a = math.radians(ang)
        x = cx + math.cos(a) * 22
        y = 66 + math.sin(a) * 9.5
        c.put_ramp(int(x), int(y), ring_team, 2)
        c.put_ramp(int(x), int(y) + 1, ring_team, 1)
    ellipse(c, cx, 64, 18, 8, 'stone', lo=0, hi=4, ambient=0.3, flatness=0.25)
    # Krater
    ellipse(c, cx, 64, 12, 5, 'coal', lo=0, hi=2, ambient=0.3)
    for (x, y) in ((cx - 5, 65), (cx + 3, 63), (cx + 7, 65), (cx - 1, 66), (cx + 1, 62)):
        c.put_ramp(x, y, 'fire', 4 if (x + y) % 2 else 3)
    # Risse in der Scheibe
    for (x0, y0, x1, y1) in ((cx - 24, 62, cx - 14, 66), (cx + 15, 66, cx + 26, 71), (cx - 8, 71, cx - 5, 76), (cx + 6, 54, cx + 9, 58)):
        jag_line(c, x0, y0, x1, y1, rnd, 0, 3, 'stone')
    # Scherben des Kristalls (dunkel, matt), einer ragt noch auf
    shards = [([(cx - 9, 61), (cx - 6, 47), (cx - 1, 60)], 0, 3),
              ([(cx + 1, 62), (cx + 6, 52), (cx + 11, 61)], 0, 3),
              ([(cx - 17, 67), (cx - 12, 62), (cx - 9, 68)], 0, 3),
              ([(cx + 11, 68), (cx + 17, 64), (cx + 20, 69)], 0, 2),
              ([(cx - 3, 66), (cx + 1, 64), (cx + 4, 67)], 1, 4)]
    for pts, lo, hi in shards:
        poly(c, pts, 'purple', lo=lo, hi=hi)
    c.put_ramp(cx - 6, 49, 'purple', 4)
    c.put_ramp(cx - 6, 50, 'purple', 4)
    c.put_ramp(cx - 5, 51, 'purple', 3)
    c.put_ramp(cx + 6, 54, 'purple', 4)
    for (x, y) in ((cx - 14, 56), (cx + 14, 57), (cx - 20, 61), (cx + 19, 59)):          # Funken / Asche
        c.put_ramp(x, y, 'coal', 4)
    c.put_ramp(cx - 2, 57, 'fire', 5)
    c.put_ramp(cx + 9, 58, 'fire', 4)
    c.outline()
    return c


# --------------------------------------------------------------------------- Hofgebaeude und Tuerme als Karten: Dioramen aufzeichnen


class Recorder:
    """Zeichnet die Sprites eines Karten-Dioramas auf: patcht pixl.World.draw (deckt prop_at / unit_at / direkte world.draw-Aufrufe ab)
    und mini_castle (Turm-Sprite `tw=`) in cards_art und allen geladenen pack_*-Modulen, stellt alles danach wieder her"""

    def __init__(self, modules):
        self.modules = modules
        self.calls = []
        self.tws = []
        self._orig_draw = None
        self._orig_mc = {}

    def __enter__(self):
        rec = self
        self._orig_draw = pixl.World.draw
        orig_draw = self._orig_draw

        def draw(world, sprite, x, y, key, flip=False):
            caller = sys._getframe(1).f_code.co_name
            rec.calls.append({'spr': sprite, 'x': int(x), 'y': int(y), 'key': int(key), 'flip': bool(flip), 'caller': caller})
            return orig_draw(world, sprite, x, y, key, flip)

        pixl.World.draw = draw
        orig_mc = cards_art.mini_castle

        def mini_castle(rows, ox, oy, world, team='teamA', gates=(), tw=None, themes=None):
            rec.tws.append(tw)
            return orig_mc(rows, ox, oy, world, team, gates, tw, themes)

        for m in [cards_art] + list(self.modules):
            if hasattr(m, 'mini_castle'):
                self._orig_mc[m.__name__] = (m, m.mini_castle)
                m.mini_castle = mini_castle
        return self

    def __exit__(self, *a):
        pixl.World.draw = self._orig_draw
        for (m, f) in self._orig_mc.values():
            m.mini_castle = f

    def reset(self):
        self.calls.clear()
        self.tws.clear()


def load_packs():
    mods = []
    for f in sorted(glob.glob(os.path.join(HERE, 'pack_*.py'))):
        mods.append(importlib.import_module(os.path.basename(f)[:-3]))      # Packs registrieren ihre Dioramen in cards_art.ART
    return mods


def replay(calls, pad=(40, 40), size=(400, 300), dx_fn=None, raw=False):
    """gewaehlte Aufrufe in eine durchsichtige World zeichnen (Tiefenpuffer wie im Diorama) und auf die Nutzpixel beschneiden (raw: nicht beschneiden)"""
    w = World(size[0], size[1])
    w.px[:, :, 3] = 0
    w.depth[:] = -100
    for cl in calls:
        x = cl['x'] + pad[0] + (dx_fn(cl) if dx_fn else 0)
        pixl_draw(w, cl['spr'], x, cl['y'] + pad[1], cl['key'], cl['flip'])
    cv = Canvas(size[0], size[1])
    cv.px[:] = w.px
    return cv if raw else trim(cv)


def trim_together(cvs):
    """mehrere Rohbilder auf dieselbe Nutzpixel-Huelle beschneiden (Animationsbilder bleiben deckungsgleich)"""
    a = np.zeros(cvs[0].px.shape[:2], bool)
    for cv in cvs:
        a |= cv.px[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    return [crop(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1) for cv in cvs]



# Auswahl je Karte: erlaubte Sprite-Groessen (b, h); aufgezeichnet werden nur Aufrufe mit Schluessel < 9000 und nicht von unit_at
YARD_SIZES = {
    'BS-05': {(32, 32)},
    'BS-06': {(32, 32)},
    'BS-07': {(66, 66)},
    'BS-08': {(64, 36)},
    'BS-09': {(32, 32)},
    'BH-02': {(34, 38)},
    'BH-04': {(70, 46), (26, 24), (34, 32), (18, 16), (29, 24)},
    'BH-06': {(74, 66), (22, 18)},
    'BW-07': {(14, 26), (26, 40), (28, 34), (34, 18)},
    'BP-05': {(72, 70), (16, 24)},
    'BU-04': {(64, 66), (20, 28)},
    'BU-06': {(100, 27), (100, 17), (16, 38)},
    'BU-07': {(92, 58), (16, 14)},
    'BU-09': {(68, 62)},
    'BA-01': {(36, 50)},
    'BA-03': {(50, 72)},
    'BA-05': {(76, 60)},
    'BA-06': {(36, 66)},
    'BC-01': {(50, 64), (14, 11)},
    'BC-06': {(38, 36)},
    'BC-09': {(36, 50)},
}
TOWER_CARDS = ['BT-01', 'BT-02', 'BT-03', 'BT-04', 'BT-05', 'BT-06', 'BT-07', 'BT-08', 'BP-03', 'BP-04', 'BA-02', 'BA-04']
PROP_TOWERS = {'BC-02': {(56, 84)}}                      # Turm als freies Prop (kein mini_castle)
FOOTPRINT = {}                                           # wird aus cards.json (masse) gefuellt: id -> (cols, rows)


def parse_masse(s):
    if not s or '×' not in s and 'x' not in s:
        return (1, 1)
    a, b = s.replace('x', '×').split('×')
    return (int(a.strip()[-1]), int(b.strip()[0]))


def hero_for(cid, rec: Recorder, mods):
    """liefert eine Liste von Bildern [(Canvas, anchor_x, anchor_y), ...] (meist eines) fuer die Hofgebaeude-/Turm-Karte `cid`"""
    rec.reset()
    fn = cards_art.ART.get(cid)
    if fn is None:
        fn = lambda: cards_art.art_building(cid)        # Karten der ersten Serie (BS-06, BT-01, BH-02)
    fn()
    if cid in TOWER_CARDS:
        tw = rec.tws[-1]
        return [(tw, tw.w // 2, tw.h - 3)]               # Fuss wie Castle.place_objects (Sockel ragt 3 px ueber die Zellkante)
    sizes = YARD_SIZES.get(cid) or PROP_TOWERS[cid]
    sel = [c for c in rec.calls if (c['spr'].w, c['spr'].h) in sizes and c['key'] < 9000 and c['caller'] != 'unit_at']
    if cid == 'BW-07':
        return [hero_drill_yard(sel)]
    if cid == 'BU-06':
        return [hero_express_lane(sel)]
    if cid == 'BU-04':
        return hero_bell(sel)
    cv = replay(sel)
    return [(cv, cv.w // 2, cv.h)]


def earth_patch(w, h, seed=6):
    """Uebungsplatz (BW-07): festgetretener Boden mit dunklerem, ausgefranstem Rand; liegt auf dem Hofpflaster"""
    base = cards_art.ground_world('mud', seed, w, h)
    c = from_rgb(base.px[:, :, :3])
    rnd = random.Random(seed)
    for y in range(h):
        for x in range(w):
            edge = min(x, w - 1 - x, y, h - 1 - y)
            if edge < 2 and (x + y) % 2:
                clear(c, x, y)
    for x in range(w):
        for (y, i) in ((h - 1, 0), (0, 1)):
            if c.alpha(x, y):
                put(c, x, y, 'dirt', i)
    for y in range(h):
        for (x, i) in ((w - 1, 0), (0, 1)):
            if c.alpha(x, y):
                put(c, x, y, 'dirt', i)
    for _ in range(26):                                    # Fussspuren
        x, y = rnd.randint(3, w - 5), rnd.randint(3, h - 4)
        put(c, x, y, 'dirt', 4)
        put(c, x + 1, y, 'dirt', 3)
    return c


def hero_drill_yard(sel):
    """Drillplatz (3 x 2): Erdplatz 96 x 64, zwei Eckpfosten mit Fahnen, zwei Strohpuppen, Kletterwand, Huerde (Sprites des Dioramas)"""
    xs = [c['x'] for c in sel]
    left = (min(xs) + max(c['x'] + c['spr'].w for c in sel)) // 2 - 48
    bottom = max(c['y'] + c['spr'].h for c in sel)
    patch = {'spr': earth_patch(96, 64), 'x': left, 'y': bottom - 64, 'key': -60, 'flip': False, 'caller': 'patch'}
    cv = replay([patch] + sel)
    return cv, cv.w // 2, cv.h


def hero_express_lane(sel):
    """Gnomen-Expressspur (3 x 1): Foerderband mit Chevrons, Zahnradfront, Glockenpfosten an beiden Enden (etwas an die Enden herangerueckt)"""
    xs = sorted(c['x'] for c in sel if c['spr'].w == 16)
    lo, hi = xs[0], xs[-1]

    def dx(c):
        if c['spr'].w != 16:
            return 0
        return 6 if c['x'] == lo else -6

    cv = replay(sel, dx_fn=dx)
    return cv, cv.w // 2, cv.h


def hero_bell(sel):
    """Alarmglocke (2 Bilder): Glocke schwingt nach rechts (Diorama) und nach links; Glocken-Zwerg haengt am Seil"""
    import pack_art10_yard as Y
    alt = [dict(c, spr=Y.bell_frame(-2)) if c['spr'].w == 64 else c for c in sel]
    a, b = trim_together([replay(sel, raw=True), replay(alt, raw=True)])
    return [(a, a.w // 2, a.h), (b, b.w // 2, b.h)]


def build_heroes(cards):
    """alle 34 Karten mit Hof-/Turm-/Tor-Sprite: id -> (Canvas, ax, ay, (cols, rows))"""
    ids = [c['id'] for c in cards if c.get('bauart') in ('hof', 'turm', 'tor')]
    mods = load_packs()
    out = {}
    with Recorder(mods) as rec:
        for cid in ids:
            out[cid] = hero_for(cid, rec, mods)
    meta = {c['id']: parse_masse(c.get('masse')) for c in cards}
    return {cid: (frames, meta[cid]) for cid, frames in out.items()}


# --------------------------------------------------------------------------- Labels, Icons, Marker, Baeume


LABEL_H = 13


def build_labels(cards):
    out = {}
    for c in cards:
        name = c['name_en']
        w = text_width(name) + 2
        arr = np.zeros((LABEL_H, w, 4), np.uint8)
        draw_text(arr, 1, 3, name, WHITE, outline=INK)
        cv = Canvas(w, LABEL_H)
        cv.px[:] = arr
        out[f"label.{c['id']}"] = cv
    return out


def build_icons():
    out = {}
    for name in cardicons.ICONS:
        arr = cardicons.icon_canvas(name)
        cv = Canvas(arr.shape[1], arr.shape[0])
        cv.px[:] = arr
        out[f'icon.{name}'] = cv
    return out


def _marker_square(ramp, lo, mid, hi):
    """32 x 32 'durchscheinendes' Feld: Schachbrett-Fuellung, kraeftiger Rand, helle Eckwinkel; Alpha nur 0 / 255"""
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            edge = min(x, y, 31 - x, 31 - y)
            if edge == 0:
                c.put_ramp(x, y, ramp, mid)
            elif edge == 1:
                if (x + y) % 2 == 0:
                    c.put_ramp(x, y, ramp, lo)
            elif (x + y) % 2 == 0:
                c.put_ramp(x, y, ramp, lo if (x // 4 + y // 4) % 2 else mid)
    for (x0, y0, dx, dy) in ((0, 0, 1, 1), (31, 0, -1, 1), (0, 31, 1, -1), (31, 31, -1, -1)):
        for k in range(6):
            c.put_ramp(x0 + dx * k, y0, ramp, hi)
            c.put_ramp(x0, y0 + dy * k, ramp, hi)
            if k < 3:
                c.put_ramp(x0 + dx * k, y0 + dy, ramp, mid)
                c.put_ramp(x0 + dx, y0 + dy * k, ramp, mid)
    return c


def build_markers():
    out = {}
    out['marker.build.ok'] = _marker_square('leaf', 3, 4, 5)
    bad = _marker_square('fire', 2, 3, 5)
    for k in range(7, 25):                                    # Kreuz in der Mitte: unbebaubar
        for (x, y) in ((k, k), (k, 31 - k), (k + 1, k), (k + 1, 31 - k)):
            bad.put_ramp(x, y, 'fire', 4)
    out['marker.build.bad'] = bad
    bp = Canvas(32, 32)                                       # Blaupause: blaue Schraffur mit hellen Gitterlinien
    for y in range(32):
        for x in range(32):
            edge = min(x, y, 31 - x, 31 - y)
            if (x + y) % 6 == 0:
                bp.put_ramp(x, y, 'sky', 3)
            elif (x - y) % 16 == 0 and (x + y) % 2 == 0:
                bp.put_ramp(x, y, 'sky', 2)
            if edge == 0 and (x + y) % 4 < 3:
                bp.put_ramp(x, y, 'sky', 4)
    for x in (0, 31):
        for y in (0, 31):
            bp.put_ramp(x, y, 'sky', 5)
    out['marker.blueprint'] = bp
    rg = Canvas(4, 4)                                         # Reichweitenpunkt: 4 x 4, Schachbrett zweier Toene
    for y in range(4):
        for x in range(4):
            if (x in (0, 3)) and (y in (0, 3)):
                continue
            rg.put_ramp(x, y, 'bone', 5 if (x + y) % 2 == 0 else 3)
    out['marker.range'] = rg
    return out


def build_trees():
    return {'tree.0': tree_round(1, 'leaf'), 'tree.1': tree_pine(1), 'tree.2': tree_round(10, 'grass')}


# --------------------------------------------------------------------------- Atlas


class Atlas:
    def __init__(self, image_name):
        self.image = image_name
        self.items = {}            # key -> (ndarray, ax, ay)
        self.aliases = {}          # key -> target key

    def add(self, key, cv, ax=0, ay=0):
        assert key not in self.items and key not in self.aliases, key
        arr = cv.px if isinstance(cv, Canvas) else cv
        a = arr[:, :, 3]
        assert set(np.unique(a).tolist()) <= {0, 255}, f'Alpha {key}'
        self.items[key] = (arr.copy(), int(ax), int(ay))

    def alias(self, key, target):
        assert key not in self.items and key not in self.aliases, key
        self.aliases[key] = target

    def pack(self, max_w=2048, pad=1):
        order = sorted(self.items, key=lambda k: (-self.items[k][0].shape[0], -self.items[k][0].shape[1], k))
        pos = {}
        x, y, row_h = pad, pad, 0
        for k in order:
            h, w = self.items[k][0].shape[:2]
            if x + w + pad > max_w:
                x, y, row_h = pad, y + row_h + pad, 0
            pos[k] = (x, y)
            x += w + pad
            row_h = max(row_h, h)
        H = y + row_h + pad
        W = max(pos[k][0] + self.items[k][0].shape[1] for k in pos) + pad
        img = np.zeros((H, W, 4), np.uint8)
        frames = {}
        for k in order:
            arr, ax, ay = self.items[k]
            px, py = pos[k]
            img[py:py + arr.shape[0], px:px + arr.shape[1]] = arr
            frames[k] = {'x': px, 'y': py, 'w': int(arr.shape[1]), 'h': int(arr.shape[0]), 'ax': ax, 'ay': ay}
        for k, t in self.aliases.items():
            frames[k] = dict(frames[t])
        return Image.fromarray(img, 'RGBA'), {'image': self.image, 'frames': {k: frames[k] for k in sorted(frames)}}


def save_json(path, obj):
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write('\n')


# --------------------------------------------------------------------------- Kontaktbogen (Annotation, kein Spielinhalt)


SHEET_BG = hexrgb('#2b2540') + (255,)
CELL_BG = hexrgb('#383250') + (255,)
GROUND_BG = hexrgb('#4c7a3c') + (255,)


def contact_sheet(entries, cols, scale, path, cell_bg=CELL_BG, outline_fn=None, min_cell=(0, 0)):
    """entries: [(Titel, Canvas, ax, ay)]. Ein Bild x`scale`, Titel als Beschriftung; outline_fn(entry) -> Rechteck (x0, y0, x1, y1) in Spritepixeln (kann ausserhalb liegen)."""
    font = label_font(10)
    tw = max(int(font.getlength(e[0])) for e in entries)
    cw = max(max(e[1].w for e in entries) * scale, min_cell[0], tw) + 12
    ch = max(max(e[1].h for e in entries) * scale, min_cell[1]) + 28
    rows = (len(entries) + cols - 1) // cols
    img = Image.new('RGBA', (cols * cw + 8, rows * ch + 8), SHEET_BG)
    d = ImageDraw.Draw(img)
    for i, e in enumerate(entries):
        title, cv, ax, ay = e[:4]
        x = 8 + (i % cols) * cw
        y = 8 + (i // cols) * ch
        d.text((x, y), title, fill=(240, 235, 250, 255), font=font)
        box = (x, y + 14, x + cw - 12, y + 14 + ch - 28)
        d.rectangle(box, fill=cell_bg)
        im = upscale(cv.to_image(), scale)
        ox = x + (cw - 12 - im.width) // 2
        oy = y + 14 + (ch - 28 - im.height) // 2
        img.alpha_composite(im, (ox, oy))
        if outline_fn:
            r = outline_fn(e)
            if r:
                d.rectangle([ox + r[0] * scale, oy + r[1] * scale, ox + r[2] * scale - 1, oy + r[3] * scale - 1], outline=(255, 214, 74, 255))
    img.save(path)
    return img


# --------------------------------------------------------------------------- Schlachtfeld-Boden (bg_field.png)

BG_W, BG_H = BG_W_CELLS * CELL, BG_H_CELLS * CELL
BG_SEED = 11

# Hauptweg zwischen den Bastionen (Mittelgasse) und Abzweige; die Enden liegen mindestens 26 px (Kappe + Wackelrand) ausserhalb der Baugruende
BG_PATHS = [
    ([(604, 432), (690, 424), (800, 440), (900, 436), (1010, 428), (1120, 438), (1188, 432)], 40),
    ([(900, 436), (905, 360), (880, 280), (870, 215)], 26),
    ([(900, 436), (890, 540), (840, 640), (760, 742)], 26),
    ([(790, 744), (950, 792), (1090, 788), (1170, 786)], 24),
]
# Teiche als Ellipsen (Mittelpunkt, Radien in px); die gesperrten Zellen werden aus den gezeichneten Teichpixeln abgeleitet
BG_PONDS = [(896, 150, 150, 58), (700, 792, 112, 46), (1256, 792, 100, 40)]
POND_MIN_COVER = 0.12            # Zelle gilt als Teichzelle ab 12 % Teichpixeln; schwaechere Randsplitter werden zu Gras zurueckgeschnitten


def plot_rects_px():
    return [(x0 * CELL, y0 * CELL, (x1 + 1) * CELL, (y1 + 1) * CELL) for (x0, y0, x1, y1) in PLOTS]


def corridor_rect_px():
    """Mittelgasse zwischen den Baugruenden (Pixel, rechts/unten exklusiv)"""
    return ((PLOTS[0][2] + 1) * CELL, CORRIDOR[0] * CELL, PLOTS[1][0] * CELL, (CORRIDOR[1] + 1) * CELL)


def _plot_distance():
    """Abstand (px) jedes Pixels zu den Baugrund-Rechtecken (innen = 0)"""
    Y, X = np.mgrid[0:BG_H, 0:BG_W].astype(np.float32)
    d = np.full((BG_H, BG_W), 1e9, np.float32)
    for (x0, y0, x1, y1) in plot_rects_px():
        dx = np.maximum(np.maximum(x0 - X, X - (x1 - 1)), 0)
        dy = np.maximum(np.maximum(y0 - Y, Y - (y1 - 1)), 0)
        d = np.minimum(d, np.hypot(dx, dy))
    return d


def make_field_ground(seed=BG_SEED):
    """Kopie von landscape.make_ground mit zwei Aenderungen: Erdflecken verschwinden in/um die Baugruende (schlichtes Gras),
    Teiche werden auf ganze Zellen begrenzt. Liefert RGB, Wassermaske, Wegmaske (mit Rand), sichtbaren Weg, Teichpixel je Teich, Zellrechtecke der Teiche"""
    w, h = BG_W, BG_H
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
    chk = ((Xi + Yi) % 2 == 0)
    # Erdflecken (nicht im / direkt am Baugrund)
    dplot = _plot_distance()
    m = 0.6 * smooth_noise(w, h, 70, seed + 5) + 0.4 * smooth_noise(w, h, 26, seed + 6)
    thr = np.percentile(m, 90)
    s = (m - thr) / (np.percentile(m, 99) - thr + 1e-6)
    s = s - 3.0 * (1.0 - smoothstep(6.0, 40.0, dplot))
    dirt_idx = quant_vec(np.clip(0.25 + 0.6 * n3, 0, 1), 2, 4, Xi, Yi)
    use_dirt = (s > 0.08) | ((s > -0.08) & (s <= 0.08) & chk)
    G = np.where(use_dirt[..., None], ramp_arr('dirt')[dirt_idx], G)

    # Teiche: Maske aus Ellipse + Rauschen, dann auf Zellen mit genug Teichpixeln begrenzen
    water_mask = np.zeros((h, w), bool)
    pond_pix = []
    pond_cells = []
    wave = 0.5 + 0.22 * np.sin((X * 0.32 + Y * 0.9) / 3.2) + 0.18 * (smooth_noise(w, h, 10, seed + 9) - 0.5)
    sparkle_n = smooth_noise(w, h, 4, seed + 11)
    for (cx, cy, rx, ry) in BG_PONDS:
        d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 + 0.35 * (n2 - 0.5)
        pm = d < 1.28
        cov = pm.reshape(h // CELL, CELL, w // CELL, CELL).mean(axis=(1, 3))
        blocked = cov >= POND_MIN_COVER
        pm &= np.kron(blocked, np.ones((CELL, CELL), bool))
        pond_pix.append((pm, d))
        pond_cells.append(blocked)
        shore = (d >= 0.98) & pm
        shore_in = shore & (d < 1.14)
        sand_idx = quant_vec(np.clip(0.55 + 0.4 * (n3 - 0.5), 0, 1), 3, 5, Xi, Yi)
        sand = ramp_arr('dirt')[sand_idx]
        outer_band = shore & ~shore_in
        pick_sand = shore_in | (outer_band & chk)
        G = np.where(pick_sand[..., None], sand, G)
        water = (d < 0.98) & pm
        Lw = np.clip(wave - 0.28 * np.clip(d - 0.62, 0, 1), 0, 1)
        widx = quant_vec(Lw, 1, 4, Xi, Yi, dw=0.2)
        W_ = ramp_arr('sky')[widx]
        sp = (sparkle_n > 0.93) & (d < 0.8)
        W_ = np.where(sp[..., None], ramp_arr('sky')[5], W_)
        G = np.where(water[..., None], W_, G)
        water_mask |= pm

    # Wege
    pd = np.full((h, w), 1e9, np.float32)
    for pts, wd in BG_PATHS:
        for (a, b) in zip(pts[:-1], pts[1:]):
            pd = np.minimum(pd, seg_dist(X, Y, a[0], a[1], b[0], b[1]) - wd / 2.0)
    wob = (smooth_noise(w, h, 18, seed + 12) - 0.5) * 7.0
    pdw = pd + wob
    inside = (pdw < 0) & ~water_mask
    edge = (pdw >= -1.8) & (pdw < 2.4) & ~water_mask
    base_idx = quant_vec(np.clip(0.5 + 0.9 * (n3 - 0.5), 0, 1), 3, 4, Xi, Yi, dw=0.25)
    road = ramp_arr('dirt')[base_idx]
    stones = (smooth_noise(w, h, 3, seed + 13) > 0.9) & inside
    road = np.where(stones[..., None], ramp_arr('dirt')[5], road)
    G = np.where(inside[..., None], road, G)
    rim = edge & ~inside & chk
    G = np.where(rim[..., None], ramp_arr('dirt')[2], G)
    path_mask = pdw < 8
    path_vis = pdw < 2.4

    # Teichzellen als Rechtecke (inklusive Zellkoordinaten): je Teich Zeilenspannen, gleiche Spannen aufeinanderfolgender Zeilen zusammengefasst
    rects = []
    for blocked in pond_cells:
        spans = {}
        for cy in range(blocked.shape[0]):
            xs = np.nonzero(blocked[cy])[0]
            if len(xs) == 0:
                continue
            run0 = prev = int(xs[0])
            for x in list(xs[1:]) + [None]:
                if x is None or int(x) != prev + 1:
                    spans.setdefault(cy, []).append((run0, prev))
                    if x is not None:
                        run0 = int(x)
                prev = int(x) if x is not None else prev
        open_rects = {}
        for cy in sorted(spans):
            cur = {}
            for sp in spans[cy]:
                if sp in open_rects and open_rects[sp][3] == cy - 1:
                    r = open_rects.pop(sp)
                    r[3] = cy
                    cur[sp] = r
                else:
                    cur[sp] = [sp[0], cy, sp[1], cy]
            for sp, r in list(open_rects.items()):
                rects.append(r)
            open_rects = cur
        rects.extend(open_rects.values())
    rects = sorted([[int(a), int(b), int(c), int(d)] for (a, b, c, d) in rects], key=lambda r: (r[1], r[0]))
    return G.astype(np.uint8), water_mask, path_mask, path_vis, pond_pix, rects


def scatter_field_decals(G, rng, count, avoid, plain):
    """Grasbueschel, Blumen, Kiesel (wie landscape.scatter_ground_decals); in den Baugruenden nur Grasbueschel"""
    h, w = G.shape[:2]
    gr = ramp_arr('grass')
    for _ in range(count):
        x, y = rng.randint(4, w - 5), rng.randint(4, h - 6)
        r = rng.random()
        if avoid[y, x]:
            continue
        if plain[y, x] and r >= 0.62:
            continue
        if r < 0.62:
            G[y, x] = gr[5]
            G[y + 1, x - 1] = gr[4]
            G[y + 1, x + 1] = gr[4]
            G[y + 1, x] = gr[1]
            G[y + 2, x - 1] = gr[1]
            G[y + 2, x + 1] = gr[1]
        elif r < 0.9:
            col = rng.choice([RAMPS['gold'][4], RAMPS['skin'][5], RAMPS['purple'][4], RAMPS['bone'][5]])
            G[y, x] = col
            G[y, x + 1] = col
            G[y + 1, x] = gr[1]
        else:
            G[y, x] = RAMPS['stone'][4]
            G[y, x + 1] = RAMPS['stone'][3]
            G[y + 1, x + 1] = RAMPS['stone'][1]


def _rect_hit(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def build_field():
    """liefert dict: image (RGB-Array), ponds (Zellrechtecke), trees [(x, y, kind)], preview (Welt inkl. Baeume), masks"""
    rng = random.Random(7)
    G, water, pathm, path_vis, pond_pix, ponds = make_field_ground()
    dplot = _plot_distance()
    plain = dplot <= 0
    avoid = water | pathm
    scatter_field_decals(G, random.Random(5), 1700, avoid, plain)
    world = World(BG_W, BG_H)
    world.px[:, :, :3] = G
    world.depth[:] = -100

    forbid = [(x0 - 6, y0 - 6, x1 + 6, y1 + 6) for (x0, y0, x1, y1) in plot_rects_px()] + [corridor_rect_px()]
    # Wasser/Weg-Kontaktbereich (aufgeweitet), nur fuer Fusspunkte
    pad = 7
    blk = water | pathm
    ys, xs = np.nonzero(blk)
    dil = np.zeros_like(blk)
    for dy in range(-pad, pad + 1, 2):
        for dx in range(-pad, pad + 1, 2):
            dil[np.clip(ys + dy, 0, BG_H - 1), np.clip(xs + dx, 0, BG_W - 1)] = True
    placed = []                                   # (x, y, radius) fuer Mindestabstand
    objs = []                                     # (sprite | None, x, y, flip, kind)  Fusspunkt = Mitte unten

    def ok(x, y, spr_w, spr_h, mind, tall=True):
        bbox = (x - spr_w // 2 - 1, y - spr_h, x - spr_w // 2 + spr_w + 1, y + 2)
        if bbox[0] < 0 or bbox[2] > BG_W or bbox[1] < -4 or bbox[3] > BG_H:
            return False
        for f in forbid:
            if _rect_hit(bbox, f):
                return False
        fx0, fx1 = max(0, x - spr_w // 3), min(BG_W, x + spr_w // 3)
        if dil[max(0, y - 4):min(BG_H, y + 2), fx0:fx1].any():
            return False
        for (px_, py_, dd) in placed:
            if (px_ - x) ** 2 + (py_ - y) ** 2 < max(mind, dd) ** 2:
                return False
        return True

    tree_sprites = build_trees()
    ts = [tree_sprites['tree.0'], tree_sprites['tree.1'], tree_sprites['tree.2']]
    trees = []

    def add_tree(x, y):
        k = rng.choice([0, 0, 0, 1, 1, 1, 2])
        spr = ts[k]
        if ok(x, y, spr.w, spr.h, 26):
            trees.append((int(x), int(y), k))
            placed.append((x, y, spr.w * 0.42))
            shadow(world, x + 4, y - 3, spr.w * 0.34, 4)
            return True
        return False

    # Randwald: oben (drei Reihen), unten (zwei Reihen), links/rechts schmale Streifen
    for (y_lo, y_hi, step) in ((64, 100, 33), (116, 150, 36), (160, 184, 40)):
        for x in range(14, BG_W - 10, step):
            add_tree(x + rng.randint(-8, 8), rng.randint(y_lo, y_hi))
    for (y_lo, y_hi, step) in ((790, 830, 34), (846, 892, 36)):
        for x in range(12, BG_W - 10, step):
            add_tree(x + rng.randint(-8, 8), rng.randint(y_lo, y_hi))
    for y in range(200, 790, 46):
        add_tree(rng.randint(25, 36), y + rng.randint(-8, 8))
        add_tree(rng.randint(1758, 1766), y + rng.randint(-8, 8))
    # verstreute Baeume in der offenen Mitte (nicht in der Mittelgasse)
    cnt = 0
    for _ in range(3000):
        if cnt >= 18:
            break
        x, y = rng.randint(576, 1216), rng.randint(120, BG_H - 60)
        if add_tree(x, y):
            cnt += 1

    # gebackene Kulissen (kleine Dinge, keine Hindernisse): Buesche, Steine, Pilze, Seerosen, Enten
    bushes = [bush(s, berries=(s % 2 == 0)) for s in range(4)]
    rocks_s = [rock(s) for s in range(3)]
    rock_b = rock(5, big=True)
    mush = [giant_mushroom(1, 'fire'), giant_mushroom(2, 'teamA')]

    def scatter(lst, n, mind, y_lo=40, y_hi=BG_H - 8, tries=8000, x_lo=20, x_hi=BG_W - 20):
        c = 0
        for _ in range(tries):
            if c >= n:
                break
            x, y = rng.randint(x_lo, x_hi), rng.randint(y_lo, y_hi)
            spr = rng.choice(lst)
            if ok(x, y, spr.w, spr.h, mind):
                fl = rng.random() < 0.5
                objs.append((spr, x, y, fl, 'prop'))
                placed.append((x, y, spr.w * 0.5))
                c += 1

    scatter(mush, 12, 52)
    scatter([rock_b], 7, 44)
    scatter(rocks_s, 22, 30)
    scatter(bushes, 44, 34)
    for (spr, x, y, fl, kind) in sorted(objs, key=lambda o: o[2]):
        if spr.h > 40:
            shadow(world, x + 4, y - 3, spr.w * 0.34, 4)
        elif spr.h <= 24 and spr.w <= 42:
            shadow(world, x + 3, y - 2, spr.w * 0.34, 3)
        world.draw(spr, int(x - spr.w // 2), int(y - spr.h + 1), int(y), fl)

    # Teich-Details: Seerosen und Enten (innerhalb des Wassers)
    lil = [lily(s) for s in range(4)]
    for pi, ((cx, cy, rx, ry), (pm, d)) in enumerate(zip(BG_PONDS, pond_pix)):
        for k in range(7):
            for _try in range(30):
                ang = rng.random() * 6.283
                rad = rng.random() * 0.6
                lx, ly = cx + math.cos(ang) * rx * rad, cy + math.sin(ang) * ry * rad
                xi, yi = int(lx), int(ly)
                if d[yi, xi] < 0.75 and pm[yi - 4:yi + 5, xi - 7:xi + 8].all():
                    world.draw(rng.choice(lil), xi - 7, yi - 4, -60 + yi % 30)
                    break
    for (idx_p, dx, dy, fl) in ((0, 20, -6, False), (1, -26, 4, True)):
        cx, cy, rx, ry = BG_PONDS[idx_p]
        world.draw(duck(), cx + dx, cy + dy, 40, fl)

    img = world.px[:, :, :3].copy()
    # Vorschau-Welt: Hintergrund + Baeume (die das Spiel als Sprites zeichnet)
    prev = world.copy()
    for (x, y, k) in sorted(trees, key=lambda t: t[1]):
        spr = ts[k]
        prev.draw(spr, int(x - spr.w // 2), int(y - spr.h + 1), int(y) + 200)
    return {'rgb': img, 'ponds': ponds, 'trees': trees, 'preview': prev, 'water': water, 'path': pathm, 'path_vis': path_vis, 'plain': plain}


def check_field(f):
    """Vertraege des Hintergrunds pruefen (bricht bei Verstoss ab)"""
    ponds = f['ponds']
    for (x0, y0, x1, y1) in ponds:                                     # Teiche ausserhalb der Mittelgasse und der Baugruende
        assert y1 < CORRIDOR[0] or y0 > CORRIDOR[1], ('Teich in der Mittelgasse', (x0, y0, x1, y1))
        for (px0, py0, px1, py1) in PLOTS:
            assert x1 < px0 or x0 > px1 or y1 < py0 or y0 > py1, ('Teich im Baugrund', (x0, y0, x1, y1))
    blocked = np.zeros((BG_H_CELLS, BG_W_CELLS), bool)
    for (x0, y0, x1, y1) in ponds:
        blocked[y0:y1 + 1, x0:x1 + 1] = True
    water = f['water']
    cells_with_water = water.reshape(BG_H_CELLS, CELL, BG_W_CELLS, CELL).any(axis=(1, 3))
    assert not (cells_with_water & ~blocked).any(), 'Teichpixel ausserhalb der gesperrten Zellen'
    assert not (blocked & ~cells_with_water).any(), 'gesperrte Zelle ohne Teich'
    for (x0, y0, x1, y1), name in zip(plot_rects_px(), ('P1', 'P2')):    # Baugruende: kein Wasser, kein Weg
        assert not water[y0:y1, x0:x1].any(), 'Wasser im Baugrund ' + name
        assert not f['path_vis'][y0:y1, x0:x1].any(), 'Weg im Baugrund ' + name
    for (x, y, k) in f['trees']:
        for (x0, y0, x1, y1) in plot_rects_px():
            w = (50, 34, 50)[k]
            assert not _rect_hit((x - w // 2, y - 70, x + w // 2, y + 1), (x0, y0, x1, y1)), ('Baum im Baugrund', (x, y))


# --------------------------------------------------------------------------- Hauptprogramm


def _differs(a: Canvas, b: Canvas) -> bool:
    return not np.array_equal(a.px, b.px)


def write_bg_preview(field, path_prev, path_detail):
    prev = field['preview'].image().convert('RGB')
    small = prev.resize((BG_W // 2, BG_H // 2), Image.BOX).convert('RGBA')
    d = ImageDraw.Draw(small)
    font = label_font(11)
    for i, (x0, y0, x1, y1) in enumerate(PLOTS):
        d.rectangle([x0 * CELL // 2, y0 * CELL // 2, (x1 + 1) * CELL // 2 - 1, (y1 + 1) * CELL // 2 - 1], outline=(255, 214, 74, 255), width=2)
        d.text((x0 * CELL // 2 + 6, y0 * CELL // 2 + 4), f'P{i + 1}: Zellen x {x0}..{x1}, y {y0}..{y1}', fill=(255, 240, 160, 255), font=font)
    for (x0, y0, x1, y1) in field['ponds']:
        d.rectangle([x0 * CELL // 2, y0 * CELL // 2, (x1 + 1) * CELL // 2 - 1, (y1 + 1) * CELL // 2 - 1], outline=(90, 220, 255, 255), width=1)
    cx0, cy0, cx1, cy1 = corridor_rect_px()
    for y in (cy0, cy1):
        for x in range(cx0 // 2, cx1 // 2, 6):
            d.line([x, y // 2, x + 2, y // 2], fill=(255, 255, 255, 255))
    d.text((cx0 // 2 + 6, cy0 // 2 - 14), 'Mittelgasse y 11..16', fill=(255, 255, 255, 255), font=font)
    small.save(path_prev)
    # Detail x2: Mitte (Weg, Teich, Kulissen)
    crop = prev.crop((560, 60, 1232, 540))
    upscale(crop.convert('RGBA'), 2).save(path_detail)


def main():
    for d in (ASSETS, CARDS_OUT, SHEETS):
        os.makedirs(d, exist_ok=True)
    cards = json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))
    assert len(cards) == 154

    atlas = Atlas('world.png')
    sheet_entries = {}                                  # Gruppe -> [(Titel, Canvas, ax, ay, extra)]
    counts = {}

    def add(group, key, cv, ax=0, ay=0, sheet=True, **extra):
        atlas.add(key, cv, ax, ay)
        counts[group] = counts.get(group, 0) + 1
        if sheet:
            sheet_entries.setdefault(group, []).append((key, cv, ax, ay, extra))

    for k, v in build_floors().items():
        add('floors', k, v)
    for k, v in build_walls().items():
        if k == 'wall.post':
            add('walls', k, v, v.w // 2, v.h)
        else:
            add('walls', k, v)
    for k, v in build_doors().items():
        add('doors', k, v)
    for team in ('A', 'B'):
        t = tower('team' + team)
        add('towers', f'tower@{team}', t, t.w // 2, t.h - 3)
    tr = build_tower_ruin()
    add('towers', 'tower.ruin', tr, tr.w // 2, tr.h - 3)
    for team in ('A', 'B'):
        for f in range(3):
            cv = core_sprite(f, 'team' + team)
            key = f'core.crystal#{f}' if team == 'A' else f'core.crystal@B#{f}'
            add('core', key, cv, 32, 98)
    atlas.alias('core.crystal', 'core.crystal#0')
    atlas.alias('core.crystal@B', 'core.crystal@B#0')
    add('core', 'core.ruin', build_core_ruin(), 32, 98)

    heroes = build_heroes(cards)
    for cid, (frames, fp) in heroes.items():
        grp = 'towers_cards' if cid in TOWER_CARDS or cid in PROP_TOWERS else ('gate' if cid == 'BS-07' else 'yard')
        cv, ax, ay = frames[0]
        add(grp, cid, cv, ax, ay, fp=fp)                 # Grundschluessel = Bild 0, dazu <ID>#0, <ID>#1 ...
        atlas.alias(cid + '#0', cid)
        swapped = []
        for i, (cv_i, ax_i, ay_i) in enumerate(frames):
            if i:
                add('extra_frames', f'{cid}#{i}', cv_i, ax_i, ay_i, sheet=False)
            swapped.append((swap_team(cv_i), ax_i, ay_i))
        if any(_differs(sw[0], fr[0]) for sw, fr in zip(swapped, frames)):
            add('team_b_variants', cid + '@B', swapped[0][0], swapped[0][1], swapped[0][2], sheet=False)
            atlas.alias(cid + '@B#0', cid + '@B')
            for i in range(1, len(swapped)):
                add('team_b_variants', f'{cid}@B#{i}', swapped[i][0], swapped[i][1], swapped[i][2], sheet=False)

    for k, v in build_labels(cards).items():
        add('labels', k, v, v.w // 2, v.h)
    for k, v in build_icons().items():
        add('icons', k, v, v.w // 2, v.h // 2)
    for k, v in build_markers().items():
        if k == 'marker.range':
            add('markers', k, v, 2, 2)
        else:
            add('markers', k, v, 0, 0)
    for k, v in build_trees().items():
        add('trees', k, v, v.w // 2, v.h - 1)

    img, meta = atlas.pack()
    bad = palette_violations(img)
    assert bad == 0, f'world.png: {bad} Farben ausserhalb der Master-Palette'
    img.save(os.path.join(ASSETS, 'world.png'))
    save_json(os.path.join(ASSETS, 'world.json'), meta)

    # --- Hintergrund
    field = build_field()
    check_field(field)
    bg = Image.fromarray(np.dstack([field['rgb'], np.full((BG_H, BG_W), 255, np.uint8)]), 'RGBA')
    assert palette_violations(bg) == 0, 'bg_field.png: Farben ausserhalb der Master-Palette'
    assert bg.size == (BG_W, BG_H)
    bg.save(os.path.join(ASSETS, 'bg_field.png'))
    trees = sorted(field['trees'], key=lambda t: (t[1], t[0]))
    save_json(os.path.join(ASSETS, 'bg_field.json'), {
        'image': 'bg_field.png', 'width': BG_W, 'height': BG_H, 'cell': CELL,
        'ponds': field['ponds'],
        'trees': [[x, y] for (x, y, k) in trees], 'tree_kind': [k for (x, y, k) in trees],
        'plots': [list(p) for p in PLOTS], 'corridor': list(CORRIDOR),
    })

    # --- Kartenbilder kopieren
    missing = []
    for c in cards:
        src = os.path.join(CARDS_IN, c['id'] + '.png')
        if not os.path.exists(src):
            missing.append(c['id'])
            continue
        shutil.copyfile(src, os.path.join(CARDS_OUT, c['id'] + '.png'))
    shutil.copyfile(CARD_BACK, os.path.join(CARDS_OUT, 'back.png'))
    assert not missing, f'Kartenbilder fehlen: {missing}'

    # --- Kontaktbogen
    S = sheet_entries
    contact_sheet([(e[0], e[1], e[2], e[3]) for e in S['floors']], 5, 3, os.path.join(SHEETS, 'world_floors.png'))
    contact_sheet([(e[0], e[1], e[2], e[3]) for e in S['walls']], 4, 3, os.path.join(SHEETS, 'world_walls.png'))
    dc = [(e[0], e[1], e[2], e[3]) for e in S['doors'] + S['towers'] + S['core']]
    contact_sheet(dc, 5, 3, os.path.join(SHEETS, 'world_doors_core.png'), cell_bg=GROUND_BG)

    def foot(e):
        fp = e[4]['fp']
        ax, ay = e[2], e[3]
        return (ax - fp[0] * 16, ay - fp[1] * 32, ax + fp[0] * 16, ay)

    bl = [(e[0] + f'  fp {e[4]["fp"][0]}x{e[4]["fp"][1]}', e[1], e[2], e[3], e[4]) for e in S['gate'] + S['yard'] + S['towers_cards']]
    contact_sheet(bl, 5, 3, os.path.join(SHEETS, 'world_buildings.png'), cell_bg=GROUND_BG, outline_fn=foot)
    lb = [(e[0], e[1], e[2], e[3]) for e in S['labels']]
    contact_sheet(lb, 3, 3, os.path.join(SHEETS, 'world_labels.png'))
    ic = [(e[0], e[1], e[2], e[3]) for e in S['icons']]
    contact_sheet(ic, 10, 8, os.path.join(SHEETS, 'world_icons.png'))
    mk = [(e[0], e[1], e[2], e[3]) for e in S['markers'] + S['trees']]
    contact_sheet(mk, 4, 3, os.path.join(SHEETS, 'world_markers_trees.png'))
    write_bg_preview(field, os.path.join(SHEETS, 'world_bg_preview.png'), os.path.join(SHEETS, 'world_bg_detail.png'))
    atl = Image.new('RGBA', img.size, SHEET_BG)
    atl.alpha_composite(img)
    atl.save(os.path.join(SHEETS, 'world_atlas.png'))

    n_frames = len(meta['frames'])
    print(f'world.png {img.size[0]}x{img.size[1]}, {n_frames} Frames (davon {len(atlas.aliases)} Aliase)')
    print('  ' + ', '.join(f'{k}: {v}' for k, v in counts.items()))
    print(f'bg_field.png {BG_W}x{BG_H}, Teiche: {field["ponds"]}, Baeume: {len(trees)}')


if __name__ == '__main__':
    main()
