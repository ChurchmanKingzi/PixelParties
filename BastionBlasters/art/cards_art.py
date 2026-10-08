"""Bildfenster der Karten (144 x 96 px): kleine Dioramen im Stil der Spielwelt, nativ 1x (kein Hochskalieren)."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image

from pixl import *
from scenekit import *
from landscape import *
from assets_env import tile_cobble, tile_grass, tile_planks, tower, core
from assets_units import *
from assets_props import *
from assets_buildings import *
from castle import Castle, FloorTiles, Textures, wall_shadows, draw_walls, CELL, T

WIN_W, WIN_H = 144, 96


# --------------------------------------------------------------------------- Grundlagen


def _noise_rgb(ramp, lo, hi, seed, w, h, cells=(48, 20), spread=1.0):
    """Boden aus zwei Rauschfeldern, auf Rampenindizes lo..hi quantisiert (Schachbrett-Dither)"""
    Y, X = np.mgrid[0:h, 0:w]
    n = 0.6 * smooth_noise(w, h, cells[0], seed) + 0.4 * smooth_noise(w, h, cells[1], seed + 1)
    L = np.clip((n - n.min()) / (n.max() - n.min() + 1e-6), 0, 1)
    L = np.clip(0.5 + (L - 0.5) * spread, 0, 1)
    return np.array(RAMPS[ramp], np.uint8)[quant_vec(L, lo, hi, X, Y)]


def _glints(rgb, rng, count, ramp, idx):
    h, w = rgb.shape[:2]
    for _ in range(count):
        x, y = rng.randint(2, w - 3), rng.randint(2, h - 3)
        rgb[y, x] = RAMPS[ramp][idx]


GROUND_KINDS = ('grass', 'dirt', 'cobble', 'snow', 'dark', 'sand', 'cloud', 'purple', 'slab', 'planks', 'mud')


def ground_world(kind='grass', seed=1, w=WIN_W, h=WIN_H):
    """Boden als World. kind: grass | dirt | cobble | snow | dark (Gruft) | sand | cloud | purple (Chaos) | slab | planks | mud"""
    world = World(w, h)
    rng = random.Random(seed)
    if kind in ('cobble', 'slab', 'planks'):
        if kind == 'cobble':
            tile = tile_cobble(seed, 32, base='dirt', tone=(3, 4), mortar=2, hi=5)
        elif kind == 'slab':
            tile = tile_cobble(seed, 32, base='stone', tone=(3, 4), mortar=2, hi=5)
        else:
            tile = tile_planks(seed, 32, tone=(2, 3, 4))
        for y in range(0, h, 32):
            for x in range(0, w, 32):
                sub = tile.px[:min(32, h - y), :min(32, w - x), :3]
                world.px[y:y + sub.shape[0], x:x + sub.shape[1], :3] = sub
    elif kind in ('grass', 'dirt'):
        paths = []
        if kind == 'dirt':
            paths = [([(-20, h * 0.62), (w * 0.5, h * 0.55), (w + 20, h * 0.66)], 52)]
        G, water, pathm = make_ground(w, h, seed, paths, [])
        scatter_ground_decals(G, rng, int(w * h / 90), water | pathm)
        world.px[:, :, :3] = G
    else:
        spec = {'snow': ('ice', 3, 5, 18), 'dark': ('stone', 0, 2, 22), 'sand': ('dirt', 3, 5, 26), 'cloud': ('sky', 3, 5, 24),
                'purple': ('purple', 1, 3, 20), 'mud': ('dirt', 1, 3, 22)}[kind]
        rgb = _noise_rgb(spec[0], spec[1], spec[2], seed, w, h, cells=(spec[3] * 2, spec[3]))
        if kind == 'snow':
            _glints(rgb, rng, 60, 'ice', 5)
        elif kind == 'dark':
            _glints(rgb, rng, 40, 'bone', 3)
            _glints(rgb, rng, 30, 'grass', 1)
        elif kind == 'sand':
            _glints(rgb, rng, 40, 'gold', 4)
        elif kind == 'cloud':
            _glints(rgb, rng, 70, 'bone', 5)
        elif kind == 'purple':
            _glints(rgb, rng, 50, 'purple', 5)
            _glints(rgb, rng, 20, 'gold', 5)
        elif kind == 'mud':
            _glints(rgb, rng, 30, 'dirt', 4)
        world.px[:, :, :3] = rgb
    world.depth[:] = -100
    return world


def vignette(world: World):
    """Ränder per Schachbrett-Dither abdunkeln, damit der Blick in die Mitte geht"""
    h, w = world.h, world.w
    Y, X = np.mgrid[0:h, 0:w]
    d = np.hypot((X - w / 2) / (w / 2), (Y - h / 2) / (h / 2))
    chk = ((X + Y) % 2 == 0)
    m = ((d > 0.80) & chk) | (d > 1.08)
    sub = world.px[:, :, :3]
    sub[m] = darken_palette(sub[m], 1)


def unit_at(world, spr, foot_x, foot_y, flip=False, team_swap=False, sh=(9, 3)):
    cv = swap_team(spr) if team_swap else spr
    shadow(world, foot_x, foot_y - 1, sh[0], sh[1])
    world.draw(cv, int(foot_x - cv.w // 2), int(foot_y - cv.h + 1), int(foot_y), flip)


def prop_at(world, spr, foot_x, foot_y, flip=False):
    if spr.h > 24:
        shadow(world, foot_x + 3, foot_y - 3, spr.w * 0.34, 4)
    world.draw(spr, int(foot_x - spr.w // 2), int(foot_y - spr.h + 1), int(foot_y), flip)


def finish(world: World):
    vignette(world)
    return world.image()


def spark(world, x, y, col='gold'):
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        world.px[y + dy, x + dx, :3] = RAMPS[col][i]
        world.depth[y + dy, x + dx] = 9000


# --------------------------------------------------------------------------- Einheiten-Dioramen (Schlüssel = Karten-ID)


def art_unit(cid: str) -> Image.Image:
    seed = sum(ord(c) for c in cid)
    rnd = random.Random(seed)
    ground = {'UA-01': 'grass', 'US-01': 'dirt', 'US-02': 'dirt', 'US-03': 'dirt', 'US-06': 'snow',
              'UV-01': 'cobble', 'UZ-01': 'grass', 'UZ-02': 'cobble'}[cid]
    w = ground_world(ground, seed % 7 + 1)
    cx = WIN_W // 2
    if cid == 'UA-01':
        for (sp, x, y) in ((fence(2), 12, 36), (bush(1), 118, 40), (rock(2), 128, 84), (bush(3, True), 16, 88)):
            prop_at(w, sp, x, y)
        unit_at(w, catapult('fire', 1), 40, 78, sh=(20, 4))
        # Stein im Flug und Zielschatten rechts
        zielschatten(w, 112, 70, 16, 1)
        spark(w, 100, 22)
        items = [(stone_projectile_small(), 82, 30)]
        for (sp, x, y) in items:
            w.draw(sp, x - sp.w // 2, y - sp.h // 2, 9000)
        for k in range(1, 8):
            tx = 82 - k * 6
            ty = 30 + int(k * 3.2 - 0.17 * k * k * 1.0)
            dot = Canvas(3, 3)
            dot.put_ramp(1, 1, 'bone' if k > 2 else 'fire', 5)
            dot.put_ramp(0, 1, 'bone', 4)
            dot.put_ramp(2, 1, 'bone', 4)
            w.draw(dot, tx - 1, ty - 1, 9000 - k)
    elif cid == 'US-01':
        for (sp, x, y) in ((tree_pine(1), 14, 34), (bush(2), 128, 38), (rock(1), 120, 86)):
            prop_at(w, sp, x, y)
        unit_at(w, skeleton('walk', 0), 44, 66)
        unit_at(w, skeleton('walk', 2), 76, 80)
        unit_at(w, skeleton('attack', 1), 108, 70)
        unit_at(w, skeleton('walk', 1), 22, 88)
    elif cid == 'US-02':
        for (sp, x, y) in ((bush(2, True), 14, 38), (giant_mushroom(2, 'fire'), 126, 44), (rock(3), 18, 86)):
            prop_at(w, sp, x, y)
        unit_at(w, goblin('walk', 1), 64, 74)
        unit_at(w, goblin('walk', 3), 98, 86)
        unit_at(w, citizen('cloth', 0), 116, 64, flip=True, sh=(5, 2))
    elif cid == 'US-03':
        for (sp, x, y) in ((tree_pine(2), 14, 40), (bush(1), 124, 90), (rock(2), 16, 86)):
            prop_at(w, sp, x, y)
        unit_at(w, pumpkin('run', 1), 62, 78)
        unit_at(w, pumpkin('run', 3), 94, 66)
        # kleiner Funke am Zünder
        spark(w, 66, 44, 'fire')
    elif cid == 'US-06':
        for (sp, x, y) in ((tree_pine(0), 12, 38), (tree_pine(1), 130, 46), (rock(1), 126, 88), (rock(2), 20, 88)):
            prop_at(w, sp, x, y)
        unit_at(w, bear('slide', 1), 66, 72, sh=(24, 4))
        unit_at(w, bear('slide', 0), 108, 88, flip=False, sh=(24, 4))
    elif cid == 'UV-01':
        for (sp, x, y) in ((barrel(), 18, 34), (crate(), 126, 36), (rack(), 124, 86)):
            prop_at(w, sp, x, y)
        unit_at(w, guard('idle', 0), 64, 72)
        unit_at(w, guard('attack', 1), 100, 84, flip=True)
    elif cid == 'UZ-01':
        for (sp, x, y) in ((bush(2), 14, 38), (giant_mushroom(1, 'fire'), 124, 40), (herb_table(), 24, 86)):
            prop_at(w, sp, x, y)
        unit_at(w, witch('stir', 1), 68, 76, sh=(14, 3))
        unit_at(w, skeleton('idle', 1), 108, 82, flip=True)
    elif cid == 'UZ-02':
        for (sp, x, y) in ((crate(), 16, 34), (barrel(), 126, 36)):
            prop_at(w, sp, x, y)
        unit_at(w, builder('work', 1), 62, 74)
        unit_at(w, citizen('dirt', 1), 104, 82, sh=(5, 2))
    return finish(w)


def stone_projectile_small():
    c = Canvas(14, 14)
    ellipse(c, 7, 7, 5.6, 5.6, 'stone', lo=0, hi=5)
    for (x, y) in ((5, 4), (6, 4), (5, 5)):
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(9, 9, 'coal', 2)
    c.put_ramp(8, 10, 'coal', 2)
    c.outline()
    return c


# --------------------------------------------------------------------------- Bauteil-Dioramen


def props_for(team):
    pr = {'bed': bed(), 'bunk': bunk(), 'anvil': anvil(), 'barrel': barrel(), 'trough': trough(),
          'crate': crate(), 'rack': rack(), 'herb_table': herb_table(), 'chest': chest(), 'plant': plant(),
          'rug': rug(36, 20, team), 'window': window(), 'banner_cross': banner_cross(), 'crest': crest(team),
          'forge_decor': forge_decor()}
    if team == 'teamB':
        pr['bed'] = swap_team(pr['bed'])
        pr['bunk'] = swap_team(pr['bunk'])
    return pr


def mini_castle(rows, ox, oy, world, team='teamA', gates=(), tw=None, themes=None):
    """Baut eine kleine Burg in `world` (Boden, Wände, Möbel, Türme) und liefert (Burg, place_objects-Ergebnis)"""
    c = Castle(rows, ox, oy, team, gates=gates, name='card', themes=themes)
    tiles, tex = FloorTiles(), Textures()
    fp = np.zeros((world.h, world.w), bool)
    kd = np.zeros((world.h, world.w), np.uint8)
    ht = np.zeros((world.h, world.w), np.uint8)
    c.paint_floors(world, tiles)
    c.paint_gates(world)
    c.add_walls(fp, kd, ht)
    wall_shadows(world, fp)
    out = c.place_objects(world, tw or tower(team), core(ring_team=team), props_for(team))
    draw_walls(world, fp, kd, ht, tex)
    return c, out


def crop_world(world: World, x0, y0, w=WIN_W, h=WIN_H):
    out = World(w, h)
    out.px[:] = world.px[y0:y0 + h, x0:x0 + w]
    out.depth[:] = world.depth[y0:y0 + h, x0:x0 + w]
    return out


def stone_wall_piece(width, tall=22):
    """Mauerstück in Südansicht (Oberseite 8 px + Front), für Karten-Dioramen"""
    tex = Textures()
    top = tex.tops[1]
    front = tex.fronts[(tall, 1)]
    c = Canvas(width, 8 + tall)
    for x in range(width):
        for y in range(8):
            c.put(x, y, tuple(int(v) for v in top[y, x % 32]), RAMP_ID['stone'])
        for y in range(tall):
            c.put(x, 8 + y, tuple(int(v) for v in front[y, x % 32]), RAMP_ID['stone'])
    c.outline()
    return c


def art_building(cid: str) -> Image.Image:
    seed = sum(ord(ch) for ch in cid)
    room_letter = {'BH-01': 'K', 'BW-01': 'S', 'BU-01': 'W', 'BF-01': 'B', 'BP-01': 'Z'}
    if cid in room_letter:
        L = room_letter[cid]
        world = ground_world('grass', seed % 5 + 1, 160, 160)
        rows = ["....." , f".{L*3}.", f".{L*3}.", ".hhh.", "....."]
        c, out = mini_castle(rows, 0, 0, world)
        unit_scene = {
            'K': [(witch('stir', 2), 52, 86, False), (citizen('cloth', 0), 104, 84, True)],
            'S': [(builder('work', 2), 98, 84, True), (citizen('dirt', 1), 56, 90, False)],
            'W': [(citizen('cloth', 1), 98, 84, True), (citizen('dirt', 0), 54, 90, False)],
            'B': [(guard('idle', 1), 100, 86, True), (skeleton('walk', 1), 52, 90, False)],
            'Z': [(guard('idle', 0), 118, 88, True)],
        }[L]
        if L == 'Z':
            px, py = out['platforms'][0]
            unit_at(world, catapult('load', 0), px, py + 6, sh=(20, 4))
        for (sp, x, y, fl) in unit_scene:
            unit_at(world, sp, x, y, flip=fl, sh=(9 if sp.w > 20 else 5, 3 if sp.w > 20 else 2))
        for (sp, x, y) in ((bush(2), 138, 142), (rock(1), 12, 148)):
            prop_at(world, sp, x, y)
        return finish(crop_world(world, 8, 6))
    if cid == 'BT-01':
        world = ground_world('grass', 3, 192, 128)
        rows = [".....", ".hhT.", ".hhh.", "....."]
        tw = arrow_tower('teamA')
        c, out = mini_castle(rows, 0, 0, world, tw=tw)
        # Angreifer von rechts, Pfeil mit Schweif unterwegs
        unit_at(world, goblin('walk', 1), 152, 86, flip=True)
        unit_at(world, skeleton('walk', 2), 140, 108, flip=True)
        x0, y0, x1, y1 = 118, 40, 146, 74
        for k in range(1, 6):
            t = k / 6.0
            dot = Canvas(2, 2)
            dot.rect(0, 0, 1, 1, 'bone', 5 if k > 3 else 4)
            world.draw(dot, int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t - 10 * t * (1 - t) * 4 / 2), 9000 + k)
        ar = Canvas(11, 6)
        ar.line(0, 0, 8, 4, 'wood', 4)
        ar.line(0, 1, 8, 5, 'wood', 3)
        ar.put_ramp(9, 5, 'metal', 5)
        ar.put_ramp(10, 5, 'metal', 4)
        ar.put_ramp(0, 0, 'teamA', 4)
        ar.put_ramp(1, 0, 'teamA', 3)
        world.draw(ar, 138, 66, 9100)
        for (sp, x, y) in ((tree_pine(1), 150, 38), (bush(2), 10, 124)):
            prop_at(world, sp, x, y)
        return finish(crop_world(world, 24, 14))
    if cid == 'BS-02':
        world = ground_world('grass', 5, 144, 96)
        # Mauerlinie: Stein | Pudding | Stein, dahinter Hofpflaster
        tile = tile_cobble(3, 32, base='dirt', tone=(3, 4), mortar=2, hi=5)
        for y in range(0, 52, 32):
            for x in range(0, 144, 32):
                sub = tile.px[:min(32, 52 - y), :min(32, 144 - x), :3]
                world.px[y:y + sub.shape[0], x:x + sub.shape[1], :3] = sub
        wall_y = 66
        pw = pudding_wall(3)
        left = stone_wall_piece(20)
        right = stone_wall_piece(20)
        shadow(world, 72, wall_y + 4, 54, 3)
        world.draw(left, 0, wall_y - left.h + 1, wall_y)
        world.draw(pw, 20 + 0, wall_y - pw.h + 1, wall_y)
        world.draw(right, 124, wall_y - right.h + 1, wall_y)
        # Skelett klebt fest, klebrige Fäden
        unit_at(world, skeleton('attack', 1), 60, 88, sh=(8, 3))
        for k in range(10):
            x, y = 64 + k, 78 - k
            world.px[y, x, :3] = RAMPS['teamA'][4 if k % 2 else 3]
            world.depth[y, x] = 9000
        unit_at(world, skeleton('walk', 0), 104, 84, flip=True, sh=(8, 3))
        return finish(world)
    if cid == 'BS-06':
        world = ground_world('cobble', 4)
        pit_spr = pit()
        shadow(world, 66, 56, 15, 3)
        world.draw(pit_spr, 72 - 14, 52 - 24, 52)
        # Skelett steckt in der Grube (nur Kopf), zweites steht davor
        sk = skeleton('idle', 0)
        head = Canvas(sk.w, 14)
        head.px[:] = sk.px[:14]
        head.rid[:] = sk.rid[:14]
        world.draw(head, 72 - 16 + 1, 38, 9100)
        unit_at(world, skeleton('walk', 1), 112, 70, flip=True)
        unit_at(world, skeleton('walk', 3), 30, 76)
        for (sp, x, y) in ((barrel(), 16, 34), (crate(), 130, 34)):
            prop_at(world, sp, x, y)
        return finish(world)
    if cid == 'BH-02':
        world = ground_world('cobble', 6)
        tent = field_tent('teamA')
        shadow(world, 74, 70, 18, 4)
        world.draw(tent, 72 - 17, 70 - tent.h + 1, 70)
        unit_at(world, goblin('walk', 0), 106, 82, flip=True)
        unit_at(world, citizen('cloth', 0), 40, 80, sh=(5, 2))
        # Heil-Kreuze
        for (x, y) in ((86, 34), (96, 26), (104, 38)):
            for (dx, dy) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                world.px[y + dy, x + dx, :3] = RAMPS['leaf'][5 if (dx, dy) == (0, 0) else 4]
                world.depth[y + dy, x + dx] = 9000
        for (sp, x, y) in ((barrel(), 16, 34), (crate(), 128, 90)):
            prop_at(world, sp, x, y)
        return finish(world)
    raise KeyError(cid)


# --------------------------------------------------------------------------- Registry für Kartenbilder

ART = {}


def card_art(cid):
    """Dekorator: registriert eine Funktion () -> Image (144 x 96, RGBA) als Kartenbild für `cid`"""
    def deco(fn):
        ART[cid] = fn
        return fn
    return deco


def placeholder_art(cid):
    """Platzhalter für Karten ohne Bild: Chaos-Boden mit großem Fragezeichen (nur zur Entwicklung)"""
    w = ground_world('purple', sum(ord(c) for c in cid) % 9 + 1)
    from pixfont import GLYPHS
    g = np.kron(GLYPHS['?'], np.ones((5, 5), bool))[10:45]
    ys, xs = np.nonzero(g)
    for y, x in zip(ys, xs):
        X, Y = 60 + x, 28 + y
        w.px[Y, X, :3] = RAMPS['gold'][4 if (x + y) % 2 else 5]
        w.depth[Y, X] = 9000
    return finish(w)


def art_for(cid):
    if cid in ART:
        return ART[cid]()
    if cid in ('UA-01', 'US-01', 'US-02', 'US-03', 'US-06', 'UV-01', 'UZ-01', 'UZ-02'):
        return art_unit(cid)
    if cid in ('BH-01', 'BW-01', 'BU-01', 'BF-01', 'BP-01', 'BT-01', 'BS-02', 'BS-06', 'BH-02'):
        return art_building(cid)
    return placeholder_art(cid)
