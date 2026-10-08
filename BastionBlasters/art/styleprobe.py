"""Stilprobe v0.3: große Welt (56 x 28 Zellen), zwei modulare Burgen, reiche Landschaft.

Aufruf:  python3 -I styleprobe.py        (aus dem Ordner art/ heraus)
Ausgabe: art/out/
"""
from __future__ import annotations

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

from pixl import *
from assets_env import *
from assets_props import *
from assets_units import *
from castle import *
from landscape import *
from scenekit import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'sprites'), exist_ok=True)

WC, HC = 56, 28
W, H = WC * CELL, HC * CELL

# --------------------------------------------------------------------------- Burg-Layouts (ASCII, y von oben)

P1_ROWS = [
    "................",
    "......KKKSSS....",
    "......KKKSSS....",
    "...hhhhhhhhh....",
    "...hhhhhhhhhT...",
    "...WWWhhCChhhh..",
    "...WWWhhCChhhh..",
    "...hhhhhhhhhT...",
    "...hhhhhhhhh....",
    "......ZZZBBB....",
    "......ZZZBBB....",
    "................",
]
P2_ROWS = [
    "................",
    ".......SSSKKK...",
    ".......SSSKKK...",
    ".....Thhhhhh....",
    "....hhhhhhhhZZZ.",
    "....hhhhCChhZZZ.",
    "....hhhhCChhBBB.",
    "....hhhhhhhhBBB.",
    ".....Thhhhhh....",
    ".......WWW......",
    ".......WWW......",
    "................",
]


# --------------------------------------------------------------------------- Helfer


_SWAP_CACHE = {}


def swapped(cv, key):
    if key not in _SWAP_CACHE:
        _SWAP_CACHE[key] = swap_team(cv)
    return _SWAP_CACHE[key]


def stone_projectile():
    c = Canvas(14, 14)
    ellipse(c, 7, 7, 5.6, 5.6, 'stone', lo=0, hi=5)
    for (x, y) in ((5, 4), (6, 4), (5, 5)):
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(9, 9, 'coal', 2)
    c.put_ramp(8, 10, 'coal', 2)
    c.outline()
    return c


def trail_dot(k, n_total=12):
    """Schweifpartikel k = 1 (am Geschoss, Feuer) ... n_total (hinten, Rauch)"""
    q = k / float(n_total)
    r = max(1.3, 3.6 - 2.6 * q)
    n = int(r * 2 + 3)
    c = Canvas(n, n)
    mid = n / 2.0
    if q < 0.2:
        ramp, idx = 'fire', 5
    elif q < 0.4:
        ramp, idx = 'fire', 4
    elif q < 0.75:
        ramp, idx = 'bone', 5
    else:
        ramp, idx = 'stone', 4
    ellipse(c, mid, mid, r, r, ramp, lo=max(1, idx - 2), hi=idx)
    return c


# --------------------------------------------------------------------------- Welt (statischer Teil)


class Build:
    pass


def build_static():
    B = Build()
    rng = random.Random(7)
    B.castles = [
        Castle(P1_ROWS, 4, 8, 'teamA', gates=[(13, 5, 'E')], name='P1'),
        Castle(P2_ROWS, 34, 8, 'teamB', gates=[(4, 5, 'W'), (6, 8, 'S')], name='P2'),
    ]
    # Wege und Teiche
    main_path = [(576, 432), (690, 424), (800, 440), (900, 436), (1010, 428), (1120, 438), (1216, 432)]
    paths = [
        (main_path, 40),
        ([(900, 436), (905, 360), (880, 280), (870, 215)], 26),
        ([(900, 436), (890, 540), (840, 640), (760, 740)], 26),
        ([(1296, 556), (1290, 640), (1220, 730), (1100, 800)], 28),
    ]
    ponds = [(896, 150, 150, 58), (700, 790, 112, 46)]
    G, water, pathm = make_ground(W, H, 11, paths, ponds)
    avoid = water | pathm
    rr = random.Random(5)
    scatter_ground_decals(G, rr, 1700, avoid)
    world = World(W, H)
    world.px[:, :, :3] = G
    world.depth[:] = -100
    B.world = world
    B.water, B.pathm = water, pathm
    B.paths, B.ponds = paths, ponds

    # Böden und Wände
    tiles = FloorTiles()
    tex = Textures()
    fp = np.zeros((H, W), bool)
    kd = np.zeros((H, W), np.uint8)
    ht = np.zeros((H, W), np.uint8)
    for c in B.castles:
        c.paint_floors(world, tiles)
        c.paint_gates(world)
        c.add_walls(fp, kd, ht)
    wall_shadows(world, fp)
    B.fp = fp

    props = {'bed': bed(), 'bunk': bunk(), 'anvil': anvil(), 'barrel': barrel(), 'trough': trough(),
             'crate': crate(), 'rack': rack(), 'herb_table': herb_table(), 'chest': chest(), 'plant': plant(),
             'rug': rug(36, 20), 'window': window(), 'banner_cross': banner_cross(), 'crest': crest(),
             'forge_decor': forge_decor()}
    props_b = dict(props)
    props_b['bed'] = swap_team(props['bed'])
    props_b['bunk'] = swap_team(props['bunk'])
    props_b['rug'] = rug(36, 20, 'teamB')
    props_b['crest'] = crest('teamB')
    B.platforms = []
    for c in B.castles:
        tw = tower(c.team)
        cr = core(ring_team=c.team)
        out = c.place_objects(world, tw, cr, props if c.team == 'teamA' else props_b)
        B.platforms.append(out['platforms'])
    draw_walls(world, fp, kd, ht, tex)

    # Kulissen
    allow = np.ones((H, W), bool)
    for c in B.castles:
        xs = [p[0] for p in c.cells]
        ys = [p[1] for p in c.cells]
        x0, x1 = (c.ox + min(xs)) * CELL - 56, (c.ox + max(xs) + 1) * CELL + 56
        y0, y1 = (c.oy + min(ys)) * CELL - 70, (c.oy + max(ys) + 1) * CELL + 40
        allow[max(0, y0):y1, max(0, x0):x1] = False
    allow &= ~avoid
    allow[:, :30] = True
    placed = []

    def free(x, y, d):
        if not (0 <= x < W and 0 <= y < H) or not allow[int(y), int(x)]:
            return False
        for (px_, py_, dd) in placed:
            if (px_ - x) ** 2 + (py_ - y) ** 2 < (max(d, dd)) ** 2:
                return False
        return True

    trees = [tree_round(s, 'leaf') for s in range(4)] + [tree_round(s + 9, 'grass') for s in range(2)]
    pines = [tree_pine(s) for s in range(3)]
    blossoms = [tree_blossom(s) for s in range(2)]
    bushes = [bush(s, berries=(s % 2 == 0)) for s in range(4)]
    rocks_s = [rock(s) for s in range(3)]
    rock_b = rock(5, big=True)
    mush = [giant_mushroom(1, 'fire'), giant_mushroom(2, 'teamA')]
    objs = []

    def put(spr, x, y, flip=False):
        objs.append((spr, x, y, flip))
        placed.append((x, y, spr.w * 0.5))

    # Randwald oben und unten, links und rechts
    for x in range(14, W - 10, 34):
        fy = rng.randint(76, 112)
        s = rng.choice(trees + pines + trees + blossoms)
        put(s, x + rng.randint(-8, 8), fy)
    for x in range(10, W - 10, 38):
        fy = rng.randint(H - 36, H - 6)
        s = rng.choice(trees + pines + trees)
        put(s, x + rng.randint(-8, 8), fy)
    for y in range(150, H - 100, 52):
        put(rng.choice(trees + pines), rng.randint(12, 40), y + rng.randint(-8, 8))
        put(rng.choice(trees + pines), W - rng.randint(12, 40), y + rng.randint(-8, 8))
    # verstreute Bäume, Büsche, Steine, Pilze
    def scatter(lst, n, d, y_lo=120, y_hi=H - 70, tries=6000):
        cnt = 0
        for _ in range(tries):
            if cnt >= n:
                break
            x, y = rng.randint(30, W - 30), rng.randint(y_lo, y_hi)
            if free(x, y, d):
                put(rng.choice(lst), x, y, flip=rng.random() < 0.5)
                cnt += 1
    scatter(trees + pines + blossoms, 26, 62)
    scatter(bushes, 46, 34)
    scatter(rocks_s, 24, 30)
    scatter([rock_b], 7, 44)
    scatter(mush, 12, 52)
    # Zäune und Wegweiser
    fenc = fence(3)
    for (fx_, fy_) in ((772, 478), (772 + 100, 478), (1010, 478), (1010 + 100, 478)):
        objs.append((fence(3), fx_ - 2, fy_ - 20, False))
    sp = signpost()
    for (sx_, sy_) in ((930, 480), (1250, 600), (610, 466)):
        objs.append((sp, sx_ - 13, sy_ - 33, False))

    # Teich-Details
    lil = [lily(s) for s in range(4)]
    for (cx, cy, rx, ry) in ponds:
        for k in range(7):
            ang = rng.random() * 6.283
            rad = rng.random() * 0.6
            lx, ly = cx + math.cos(ang) * rx * rad, cy + math.sin(ang) * ry * rad
            objs.append((rng.choice(lil), lx - 7, ly - 4, False))
    objs.append((duck(), ponds[0][0] + 20, ponds[0][1] - 6, False))
    objs.append((duck(), ponds[1][0] - 26, ponds[1][1] + 4, True))

    for (spr, x, y, flip) in objs:
        if spr.h > 40:                # Baum/Pilz: (x, y) = Fußpunkt
            shadow(world, x + 4, y - 3, spr.w * 0.34, 4)
            world.draw(spr, int(x - spr.w // 2), int(y - spr.h + 1), int(y), flip)
        elif spr.w > 60:
            world.draw(spr, int(x), int(y), int(y) + spr.h, flip)
        else:
            if spr.h <= 24 and spr.w <= 42 and (spr.w, spr.h) not in ((14, 8),):
                shadow(world, x + 3, y - 2, spr.w * 0.34, 3)
            # kleinere Objekte sind mit (x, y) = Fußpunkt oder linke obere Ecke angegeben
            if spr in lil or spr.h in (8, 14):
                world.draw(spr, int(x), int(y), int(y) - 60, flip)       # Teich-Details knapp über dem Boden
            elif spr.h >= 30:
                world.draw(spr, int(x), int(y), int(y) + spr.h, flip)
            else:
                world.draw(spr, int(x - spr.w // 2), int(y - spr.h + 1), int(y), flip)
    return B


# --------------------------------------------------------------------------- dynamischer Teil


def draw_dynamic(B, t=0, animated=False):
    world = B.world.copy()
    f4, f3, f2 = t % 4, t % 3, t % 2
    items = []

    def unit(spr, fx, fy, flip=False, sh=(9, 3), swap=None, rank=0, head=0, key=None):
        cv = spr if swap is None else swapped(spr, swap)
        shadow(world, fx, fy - 1, sh[0], sh[1])
        items.append((fy if key is None else key, cv, fx - cv.w // 2, fy - cv.h + 1, flip))
        if rank:
            bd = rank_badge(rank)
            top = int(cv.px[:, :, 3].any(axis=1).argmax())
            items.append((fy + 500, bd, fx - bd.w // 2 + head, fy - cv.h + top - bd.h + 1, False))

    def loop(x0, L, v):
        return x0 + (t * v) % L if animated else x0

    # --- Bastion P1 (innen)
    unit(guard('idle', f2), 548, 440, sh=(9, 3))
    unit(builder('work', f3), 524, 472, sh=(8, 3))
    unit(witch('stir', f4), 352, 470, sh=(14, 3))
    for (cx, cy, kind, k) in ((350, 338, 'cloth', 0), (392, 334, 'dirt', 1), (470, 340, 'cloth', 0), (268, 466, 'dirt', 1), (330, 392, 'cloth', 1)):
        unit(citizen(kind, (t + k) % 2), cx, cy, sh=(5, 2), key=cy + 200 if cy < 360 else None)
    # --- Bastion P2 (innen, gespiegelt, Teamfarbe getauscht)
    unit(guard('idle', (t + 1) % 2), 1252, 440, flip=True, sh=(9, 3), swap='guard')
    unit(builder('work', (t + 1) % 3), 1236, 476, flip=True, sh=(8, 3), swap='builder')
    for (cx, cy, kind, k) in ((1350, 336, 'cloth', 0), (1452, 332, 'dirt', 1), (1360, 590, 'cloth', 1), (1520, 484, 'dirt', 0)):
        unit(swapped(citizen(kind, (t + k) % 2), 'cit' + kind + str((t + k) % 2)), cx, cy, flip=True, sh=(5, 2), key=cy + 200 if cy < 360 else None)
    # --- Katapulte auf den Plattformen
    cat1 = catapult('fire', (t // 2) % 3) if animated else catapult('load', 0)
    px1, py1 = B.platforms[0][0]
    unit(cat1, px1, py1 + 4, sh=(20, 4))
    cat2 = catapult('load', 0)
    px2, py2 = B.platforms[1][0]
    unit(swapped(cat2, 'cat2'), px2, py2 + 4, flip=True, sh=(20, 4))
    # --- Niemandsland: P1 stürmt nach rechts
    unit(skeleton('walk', f4), loop(640, 240, 15), 424, sh=(8, 3), rank=2)
    unit(skeleton('walk', (t + 2) % 4), loop(610, 240, 15), 462, sh=(8, 3))
    unit(goblin('walk', (t + 1) % 4), loop(650, 288, 18), 510, sh=(8, 3), rank=1)
    unit(goblin('walk', f4), loop(600, 288, 18), 388, sh=(8, 3))
    unit(pumpkin('run', f4), loop(620, 192, 12), 566, sh=(8, 3))
    unit(bear('slide', f3), loop(700, 192, 12) if animated else 780, 534, sh=(20, 4), rank=3, head=13)
    # --- Scharmützel in der Mitte
    unit(skeleton('attack', f3), 936, 440, sh=(8, 3), rank=1)
    unit(skeleton('idle', f2), 982, 440, flip=True, sh=(8, 3))
    unit(goblin('attack', f3), 1004, 478, flip=True, sh=(8, 3), swap='gob')
    unit(goblin('attack', (t + 1) % 3), 900, 470, sh=(8, 3))
    # --- P2 stürmt nach links
    unit(skeleton('walk', (t + 1) % 4), 1180 - (t * 15) % 240 if animated else 1120, 420, flip=True, sh=(8, 3))
    unit(bear('slide', f3), 1170 - (t * 12) % 192 if animated else 1070, 548, flip=True, sh=(20, 4), swap='bear', rank=2, head=-13)
    unit(pumpkin('run', (t + 2) % 4), 1190 - (t * 12) % 192 if animated else 1150, 480, flip=True, sh=(8, 3))
    unit(goblin('walk', (t + 3) % 4), 1160 - (t * 18) % 288 if animated else 1110, 388, flip=True, sh=(8, 3), swap='gob2')

    # --- Zielschatten und Projektile
    core2 = (1376, 448)
    zielschatten(world, core2[0], core2[1] + 8, 46, phase=t)
    zielschatten(world, 440, 566, 34, phase=t + 2)
    prog = (t % 16) / 15.0 if animated else 0.46
    p0 = (px1, py1 - 40)
    p1 = (core2[0], core2[1] - 4)

    def pos(a, b, pr, hgt):
        return (a[0] + (b[0] - a[0]) * pr, a[1] + (b[1] - a[1]) * pr - 4 * hgt * pr * (1 - pr))
    sx, sy = pos(p0, p1, prog, 180)
    for k in range(1, 13):
        tx_, ty_ = pos(p0, p1, max(0.0, prog - k * 0.012), 180)
        td = trail_dot(k)
        items.append((9100 - k, td, tx_ - td.w / 2, ty_ - td.h / 2, False))
    items.append((9100, stone_projectile(), sx - 7, sy - 7, False))
    shadow(world, sx, p0[1] + (p1[1] - p0[1]) * prog + 40, 5, 2)
    q0 = (px2, py2 - 40)
    q1 = (440, 556)
    prog2 = ((t + 6) % 16) / 15.0 if animated else 0.72
    sx2, sy2 = pos(q0, q1, prog2, 150)
    for k in range(1, 13):
        tx_, ty_ = pos(q0, q1, max(0.0, prog2 - k * 0.012), 150)
        td = trail_dot(k)
        items.append((9100 - k, td, tx_ - td.w / 2, ty_ - td.h / 2, False))
    items.append((9100, stone_projectile(), sx2 - 7, sy2 - 7, False))

    for (key, spr, x, y, flip) in items:
        world.draw(spr, int(x), int(y), int(key), flip)
    return world



def overlay_baugrund(B, im):
    """Planungsansicht: Baugrund (16 x 16), freie Zellen, Reichweitenringe der Artillerie"""
    base = im.convert('RGBA')
    lay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    font = label_font(11)
    plots = [(2, 6), (38, 6)]
    for (pxc, pyc), c in zip(plots, B.castles):
        occupied = {(c.ox + x, c.oy + y) for (x, y) in c.cells}
        for yy in range(pyc, pyc + 16):
            for xx in range(pxc, pxc + 16):
                x0, y0 = xx * CELL, yy * CELL
                if (xx, yy) not in occupied:
                    d.rectangle([x0, y0, x0 + CELL - 1, y0 + CELL - 1], fill=(255, 255, 255, 34))
                d.rectangle([x0, y0, x0 + CELL - 1, y0 + CELL - 1], outline=(255, 255, 255, 70))
        d.rectangle([pxc * CELL, pyc * CELL, (pxc + 16) * CELL - 1, (pyc + 16) * CELL - 1], outline=(255, 214, 74, 255), width=3)
        d.text((pxc * CELL + 8, pyc * CELL - 14), 'Baugrund 16 x 16 Zellen', fill=(255, 240, 160, 255), font=font)
    px1, py1 = B.platforms[0][0]
    cols = [(120, 255, 160), (90, 220, 255), (255, 190, 90)]
    rings = (('Kurz', 26), ('Mittel', 34), ('Weit', 42))
    for (name, cells), col in zip(rings, cols):
        r = cells * CELL
        n = int(6.2832 * r / 2)
        for k in range(n):
            if k % 8 >= 5:
                continue
            a = 6.2832 * k / n
            x, y = px1 + math.cos(a) * r, py1 + math.sin(a) * r
            if 0 <= x < base.width and 0 <= y < base.height:
                d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=col + (255,))
        ly = 26
        lx = px1 + math.sqrt(max(0.0, r * r - (py1 - ly) ** 2))
        if lx < base.width - 130:
            d.rectangle([lx - 4, ly - 3, lx + 112, ly + 14], fill=(20, 16, 40, 225))
            d.text((lx, ly - 1), f'{name} {cells} Zellen', fill=col + (255,), font=font)
    d.ellipse([px1 - 5, py1 - 5, px1 + 5, py1 + 5], fill=(255, 255, 255, 255), outline=(20, 16, 40, 255))
    d.rectangle([14, 14, 392, 98], fill=(20, 16, 40, 225))
    d.text((24, 20), 'Planungsansicht: Reichweiten ab Katapult-Plattform (weißer Punkt)', fill=(255, 255, 255, 255), font=font)
    d.text((24, 38), 'Kurz 26: erreicht den Feindkern (30 Zellen) noch nicht', fill=cols[0] + (255,), font=font)
    d.text((24, 54), 'Mittel 34: trifft Kern und Kernhof', fill=cols[1] + (255,), font=font)
    d.text((24, 70), 'Weit 42: bis zum hinteren Rand des Feindgrunds', fill=cols[2] + (255,), font=font)
    d.text((24, 84), 'Extrem 50: deckt die gesamte Karte ab', fill=(255, 130, 130, 255), font=font)
    base.alpha_composite(lay)
    return base.convert('RGB')


# --------------------------------------------------------------------------- Export


def main():
    # Palette
    sw = Canvas(6 * 10, len(RAMP_NAMES) * 10)
    for j, n in enumerate(RAMP_NAMES):
        for i, col in enumerate(RAMPS[n]):
            for y in range(10):
                for x in range(10):
                    sw.put(i * 10 + x, j * 10 + y, col)
    upscale(sw.to_image(), 3).save(os.path.join(OUT, 'palette.png'))

    # Umgebung/Wände
    tex = Textures()
    def tile_canvas(arr):
        c = Canvas(arr.shape[1], arr.shape[0])
        c.px[:, :, :3] = arr
        c.px[:, :, 3] = 255
        return c
    env = [
        ('Gras', tile_grass(1)), ('Hof-Pflaster', tile_cobble(2, base='dirt', tone=(3, 4), mortar=2, hi=5)),
        ('Dielen', tile_planks(3)), ('Mauer: Oberseite', tile_canvas(tex.tops[K_WALL])),
        ('Mauer hoch (22)', tile_canvas(tex.fronts[(H_TALL, K_WALL)])), ('Mauer niedrig (10)', tile_canvas(tex.fronts[(H_LOW, K_WALL)])),
        ('Tor Süd (24)', tile_canvas(tex.fronts[(H_GATE, K_GATE_H)])), ('Schwelle (Seitentor)', tile_canvas(tex.tops[K_GATE_H])),
        ('Wehrturm A', tower('teamA')), ('Wehrturm B', tower('teamB')), ('Kern (2x2)', core()),
        ('Katapult', catapult('load', 0)),
    ]
    sheet(env, 4, 64, 84, scale=4).save(os.path.join(OUT, 'umgebung.png'))

    P = [('Bett', bed()), ('Etagenbett', bunk()), ('Amboss', anvil()), ('Fass', barrel()), ('Trog', trough()),
         ('Kiste', crate()), ('Waffenständer', rack()), ('Kräutertisch', herb_table()), ('Truhe', chest()),
         ('Pflanze', plant()), ('Fenster', window()), ('Banner', banner_cross()), ('Wappen', crest()), ('Esse', forge_decor()),
         ('Teppich', rug(36, 20))]
    sheet(P, 8, 40, 36, scale=5).save(os.path.join(OUT, 'moebel.png'))

    L = [('Rundbaum', tree_round(1)), ('Rundbaum 2', tree_round(2, 'grass')), ('Kirschbaum', tree_blossom(2)), ('Kiefer', tree_pine(1)),
         ('Busch', bush(1, True)), ('Busch 2', bush(2)), ('Stein', rock(1)), ('Fels', rock(5, True)),
         ('Riesenpilz', giant_mushroom(1)), ('Riesenpilz 2', giant_mushroom(2, 'teamA')), ('Zaun', fence(2)),
         ('Wegweiser', signpost()), ('Seerose', lily(1)), ('Gummiente', duck())]
    sheet(L, 7, 56, 72, scale=3).save(os.path.join(OUT, 'landschaft.png'))

    # Einheiten
    atlas = {}
    strips = []
    all_colors = set()
    per_sprite = {}
    for name, (fn, anims) in UNITS.items():
        frames = []
        meta = {}
        idx = 0
        for an, n in anims.items():
            meta[an] = {'start': idx, 'frames': n}
            for f in range(n):
                frames.append(fn(an, f))
                idx += 1
        fw, fh = frames[0].w, frames[0].h
        sheet_cv = Canvas(fw * len(frames), fh)
        for i, fr in enumerate(frames):
            sheet_cv.blit(fr, i * fw, 0)
        fname = name.split(' ')[0].lower() + '.png'
        sheet_cv.to_image().save(os.path.join(OUT, 'sprites', fname))
        atlas[name] = {'file': 'sprites/' + fname, 'frame_w': fw, 'frame_h': fh, 'facing': 'right', 'anims': meta}
        cols = set().union(*[fr.colors() for fr in frames])
        per_sprite[name] = len(cols)
        all_colors |= cols
        strips.append((name, frames))
    with open(os.path.join(OUT, 'atlas.json'), 'w', encoding='utf-8') as fh:
        json.dump(atlas, fh, ensure_ascii=False, indent=2)
    scale, pad = 5, 6
    Wd = max(sum(cv.w for cv in fr) * scale + pad * (len(fr) + 1) for _, fr in strips)
    Hd = sum(max(cv.h for cv in fr) * scale + pad + 14 for _, fr in strips) + pad
    img = Image.new('RGBA', (Wd, Hd), hexrgb('#383250') + (255,))
    dr = ImageDraw.Draw(img)
    font = label_font(11)
    y = pad
    for name, fr in strips:
        dr.text((pad, y), f'{name}   ({per_sprite[name]} Farben)', fill=(240, 235, 250, 255), font=font)
        y += 14
        x = pad
        for cv in fr:
            img.alpha_composite(upscale(cv.to_image(), scale), (x, y))
            x += cv.w * scale + pad
        y += max(cv.h for cv in fr) * scale + pad
    img.save(os.path.join(OUT, 'einheiten.png'))

    # Welt
    B = build_static()
    world = draw_dynamic(B, 0, animated=False)
    im = world.image()
    bad = palette_violations(im)
    if bad:
        print(f'WARNUNG: Szene nutzt {bad} Farben außerhalb der Master-Palette', file=sys.stderr)
    im.save(os.path.join(OUT, 'szene_1x.png'))
    # Nahaufnahme der Burg P1 (x3)
    crop = im.crop((200, 250, 640, 690))
    upscale(crop, 3).save(os.path.join(OUT, 'szene_nahaufnahme_p1.png'))
    overlay_baugrund(B, im).save(os.path.join(OUT, 'szene_baugrund.png'))
    crop2 = im.crop((1180, 250, 1620, 690))
    upscale(crop2, 3).save(os.path.join(OUT, 'szene_nahaufnahme_p2.png'))

    # Animation (Ausschnitt 960x540, 16 Bilder, nahtlos)
    frames = []
    for t in range(16):
        w = draw_dynamic(B, t, animated=True)
        frames.append(w.image().crop((520, 250, 1480, 790)).convert('RGB'))
    frames[0].save(os.path.join(OUT, 'szene_animation.gif'), save_all=True, append_images=frames[1:],
                   duration=110, loop=0, disposal=2)

    with open(os.path.join(OUT, 'bericht.txt'), 'w', encoding='utf-8') as fh:
        fh.write(f'Welt: {WC} x {HC} Zellen = {W} x {H} px\n')
        fh.write(f'Gesamtfarben aller Einheiten: {len(all_colors)} (Master-Palette: {sum(len(v) for v in RAMPS.values()) + 2})\n')
        for k, v in per_sprite.items():
            fh.write(f'{k}: {v} Farben\n')
    print('fertig; Farben gesamt:', len(all_colors))


if __name__ == '__main__':
    main()
