"""Stilprobe: erzeugt Kontaktbögen, Spritesheets, Atlas, Szenen-Montage und Animation.

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

from pixl import *
from assets_env import *
from assets_units import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'sprites'), exist_ok=True)

CELL = 32


# --------------------------------------------------------------------------- Helfer


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


def ground_shadow(scene: Canvas, cx, cy, rx, ry):
    """Schachbrett-Schatten (keine Alpha-Mischung)"""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1.0 and scene.inb(x, y):
                if d < 0.5 or (x + y) % 2 == 0:
                    scene.px[y, x, :3] = (scene.px[y, x, :3] * 0.55).astype('uint8')
                    scene.px[y, x, :3] = [q555(tuple(int(v) for v in scene.px[y, x, :3]))[i] for i in range(3)]


def zielschatten(scene: Canvas, cx, cy, r, phase=0):
    """pulsierender Dither-Kreis am Boden (Telegraph eines Einschlags)"""
    rr = r * (1.0 - 0.06 * (phase % 4))
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if not scene.inb(x, y):
                continue
            if abs(d - rr) < 1.3:
                scene.put_ramp(x, y, 'fire', 5 if (x + y) % 2 == 0 else 4)
            elif d < rr - 1.3:
                if (x % 3 == 0 and y % 3 == 0) or ((x + y) % 2 == 0 and d > rr * 0.75):
                    scene.put_ramp(x, y, 'fire', 2)
            if d < 2.2:
                scene.put_ramp(x, y, 'fire', 5)


def deco_rock(seed=1):
    c = Canvas(14, 12)
    ellipse(c, 7, 7, 5.6, 4.2, 'stone', lo=1, hi=5)
    c.put_ramp(5, 5, 'stone', 5)
    c.outline()
    return c


def deco_mushroom():
    c = Canvas(12, 12)
    c.rect(5, 6, 6, 10, 'bone', 4)
    c.put_ramp(6, 7, 'bone', 3)
    ellipse(c, 6, 5, 5, 3.5, 'teamA', lo=2, hi=5, clip=lambda x, y: y <= 6)
    for (x, y) in [(4, 3), (7, 4), (9, 5)]:
        c.put_ramp(x, y, 'bone', 5)
    c.outline()
    return c


def deco_hat():
    c = Canvas(16, 12)
    ellipse(c, 8, 8, 7, 2.2, 'purple', lo=1, hi=4)
    poly(c, [(5, 8), (11, 8), (9, 2), (12, 1)], 'purple', lo=1, hi=4)
    c.rect(5, 6, 10, 6, 'gold', 3)
    c.outline()
    return c


def deco_bones():
    c = Canvas(16, 8)
    thick_line(c, 2, 4, 12, 3, 2, 'bone', lo=2, hi=5)
    ellipse(c, 2, 4, 1.8, 1.8, 'bone', lo=3, hi=5)
    ellipse(c, 12, 3, 1.8, 1.8, 'bone', lo=3, hi=5)
    c.outline()
    return c


def stone_projectile():
    c = Canvas(10, 10)
    ellipse(c, 5, 5, 3.8, 3.8, 'stone', lo=1, hi=5)
    c.put_ramp(3, 3, 'stone', 5)
    c.outline()
    return c


# --------------------------------------------------------------------------- Bastion zusammenbauen


class Scene:
    def __init__(self, w_cells, h_cells):
        self.w, self.h = w_cells * CELL, h_cells * CELL
        self.ground = Canvas(self.w, self.h)
        self.objs = []     # (sortkey, sprite, x, y, flip)
        self.shadows = []  # (cx, cy, rx, ry)

    def add(self, key, sprite, x, y, flip=False):
        self.objs.append((key, sprite, int(x), int(y), flip))

    def render(self, fx=None):
        sc = self.ground.copy()
        for (cx, cy, rx, ry) in self.shadows:
            ground_shadow(sc, cx, cy, rx, ry)
        if fx:
            fx(sc)
        for (key, sprite, x, y, flip) in sorted(self.objs, key=lambda o: o[0]):
            sc.blit(sprite, x, y, flip=flip)
        return sc


def build_fortress(scene: Scene, ox, oy, mirror=False, team='teamA', seed=0, gate_rows=(2, 3)):
    """6x6-Bastion (inkl. Ringmauer) ab Zelle (ox,oy). Front rechts (mirror=False) bzw. links (mirror=True)."""
    N = 6
    H = WALL_H
    kinds = {(rx, ry): 'floor' for ry in range(N) for rx in range(N)}
    for i in range(N):
        for (rx, ry) in ((i, 0), (i, N - 1), (0, i), (N - 1, i)):
            kinds[(rx, ry)] = 'wall'
    for k in range(2, 4):
        for j in range(2, 4):
            kinds[(j, k)] = 'core'
    for gy in gate_rows:
        kinds[(N - 1, gy)] = 'gate'
    kinds[(N - 1, 0)] = 'tower'
    kinds[(N - 1, N - 1)] = 'tower'
    # Zinnenkranz (Südmauer, 2 Zellen) mit Geschützplätzen
    kinds[(1, N - 1)] = 'zinnen'
    kinds[(2, N - 1)] = 'zinnen2'
    # Räume in der Nordreihe des Innenhofs (Rückwand ersetzt die Mauer-Vorderseite)
    kinds[(1, 1)] = 'room_a'
    kinds[(2, 1)] = 'room_a2'
    kinds[(3, 1)] = 'room_b'
    kinds[(4, 1)] = 'room_b2'

    floor_tiles = [tile_cobble(2 + s_ * 10, base='dirt', tone=(3, 4), mortar=2, hi=5) for s_ in range(3)]
    walls = [wall_block(4 + s_) for s_ in range(3)]
    walls_top = [wall_top_only(4 + s_) for s_ in range(3)]
    tw = tower(team)
    gt = gate(team)
    cr = core(ring_team=team)
    ra = extend_room(room_krankenstation(team), lambda: tile_planks(7, 64, tone=(3, 4, 4)))
    rb = extend_room(room_schmiede(), lambda: tile_cobble(9, 64, tone=(1, 2), mortar=0, hi=3))
    zn = platform_zinnen(team)

    def R(rx, ry):
        return (N - 1 - rx, ry) if mirror else (rx, ry)

    def px(rx, ry):
        ax, ay = R(rx, ry)
        return (ox + ax) * CELL, (oy + ay) * CELL

    def is_tall(rx, ry):
        return (0 <= rx < N and 0 <= ry < N) and kinds[(rx, ry)] in ('wall', 'tower', 'zinnen', 'zinnen2', 'gate', 'room_a', 'room_a2', 'room_b', 'room_b2')

    # Boden
    for ry in range(N):
        for rx in range(N):
            x, y = px(rx, ry)
            scene.ground.blit(floor_tiles[(rx * 7 + ry * 3 + seed) % 3], x, y)
    # Objekte
    for ry in range(N):
        for rx in range(N):
            k = kinds[(rx, ry)]
            x, y = px(rx, ry)
            key = y + CELL - 1
            if k == 'wall':
                spr = walls_top[(rx + ry) % 3] if is_tall(rx, ry + 1) else walls[(rx + ry) % 3]
                scene.add(key, spr, x, y - H, flip=mirror)
            elif k == 'tower':
                scene.add(key + 1, tw, x + 16 - tw.w // 2, y + CELL - 3 - 66)
            elif k == 'gate':
                if gate_rows[0] == ry:
                    scene.add(key + CELL, gt, x, y, flip=mirror)
            elif k == 'zinnen':
                ax = x if not mirror else px(rx + 1, ry)[0]
                scene.add(key, zn, ax, y - H, flip=mirror)
            elif k == 'room_a':
                ax = x if not mirror else px(rx + 1, ry)[0]
                scene.add(key, ra, ax, y - H, flip=mirror)
            elif k == 'room_b':
                ax = x if not mirror else px(rx + 1, ry)[0]
                scene.add(key, rb, ax, y - H, flip=mirror)
            elif k == 'core' and (rx, ry) == (2, 2):
                cx_ = (ox + (2 if not mirror else N - 1 - 3)) * CELL
                cy_ = (oy + 2) * CELL
                scene.add(cy_ + 2 * CELL, cr, cx_ + CELL - 32, cy_ + CELL - 66)
    return kinds


# --------------------------------------------------------------------------- Szene


def make_scene(t=0, animated=False):
    sc = Scene(20, 9)
    # Wiese
    for cy in range(9):
        for cx in range(20):
            sc.ground.blit(tile_grass((cx * 5 + cy * 3) % 4 + 1), cx * CELL, cy * CELL)
    # Weg zwischen den Toren (Erde mit unregelmäßiger Kante)
    for y in range(3 * CELL + 2, 5 * CELL - 2):
        for x in range(6 * CELL, 14 * CELL + 8):
            edge_top = 3 * CELL + 2 + 3 * value_noise(x % 32, 7, 32, 3)
            edge_bot = 5 * CELL - 3 - 3 * value_noise(x % 32, 9, 32, 5)
            if edge_top <= y <= edge_bot:
                n = texture_noise(x // 2, y // 2, 8)
                idx = 3 if n < 0.55 else 2
                if abs(y - edge_top) < 1.5 or abs(y - edge_bot) < 1.5:
                    idx = 2 if (x + y) % 2 else 3
                sc.ground.put_ramp(x, y, 'dirt', idx)
    build_fortress(sc, 1, 1, mirror=False, team='teamA', seed=0)
    build_fortress(sc, 13, 1, mirror=True, team='teamB', seed=1)

    def unit(spr, feet_x, feet_y, flip=False, sh=(9, 3), team_swap_to=None, rank=0, head=0, key=None):
        cv = spr if team_swap_to is None else swap_team(spr, 'teamA', team_swap_to)
        sc.shadows.append((feet_x, feet_y - 1, sh[0], sh[1]))
        sc.add(feet_y if key is None else key, cv, feet_x - cv.w // 2, feet_y - cv.h + 1, flip=flip)
        if rank:
            bd = rank_badge(rank)
            top = int(cv.px[:, :, 3].any(axis=1).argmax())
            sc.add(feet_y + 500, bd, feet_x - bd.w // 2 + head, feet_y - cv.h + top - bd.h + 1)

    f4, f3, f2 = t % 4, t % 3, t % 2
    fa = lambda a, b: (a if not animated else a)

    # --- innen (P1): Bastion von x=32..224, y=32..224
    unit(guard('idle', f2), 178, 126, sh=(9, 3))
    unit(witch('stir', f4), 82, 156, sh=(14, 3))
    unit(builder('work', f3), 176, 156, sh=(8, 3))
    # --- innen (P2, gespiegelt, Teamfarbe getauscht)
    unit(guard('idle', (t + 1) % 2), 462, 126, flip=True, sh=(9, 3), team_swap_to='teamB')
    unit(builder('work', (t + 1) % 3), 462, 156, flip=True, sh=(8, 3), team_swap_to='teamB')
    # --- Katapult auf dem Zinnenkranz der Südmauer
    cat = catapult('fire', (t // 2) % 3) if animated else catapult('load', 0)
    sc.add(7 * CELL + 6, cat, 72, 6 * CELL - WALL_H + 22 - 42)
    # Bürger (Personal) in den Räumen und im Hof
    unit(citizen('cloth', f2), 98, 92, sh=(5, 2), key=140)
    unit(citizen('dirt', (t + 1) % 2), 168, 92, sh=(5, 2), key=140)
    unit(citizen('cloth', (t + 1) % 2), 130, 176, sh=(5, 2))
    unit(citizen('cloth', f2), 528, 92, flip=True, sh=(5, 2), team_swap_to='teamB', key=140)
    unit(citizen('dirt', (t + 1) % 2), 552, 176, flip=True, sh=(5, 2))

    def loop(x0, L, v):
        return x0 + (t * v) % L if animated else x0
    unit(skeleton('walk', f4), loop(240, 160, 10), 140, sh=(8, 3), rank=2)
    unit(goblin('walk', f4), loop(236, 192, 12), 186, sh=(8, 3), rank=1)
    unit(pumpkin('run', f4), loop(250, 144, 9), 226, sh=(8, 3))
    unit(bear('slide', f3), loop(260, 96, 6) if animated else 316, 206, sh=(20, 4), rank=3, head=13)
    # --- Scharmützel in der Mitte
    unit(skeleton('attack', f3), 336, 130, sh=(8, 3))
    unit(skeleton('idle', f2), 368, 130, flip=True, sh=(8, 3))
    unit(goblin('attack', f3), 384, 166, flip=True, sh=(8, 3), team_swap_to='teamB')
    # --- Deko
    sc.add(236, deco_rock(), 330, 236)
    sc.add(262, deco_mushroom(), 292, 258)
    sc.add(112, deco_hat(), 262, 106)
    sc.add(236, deco_bones(), 400, 214)
    sc.add(250, deco_mushroom(), 210, 262)

    # --- Zielschatten und Projektil
    tx, ty = 15 * CELL + 6, 4 * CELL

    def fx(scn):
        zielschatten(scn, tx, ty, 26, phase=t)
    prog = (t % 16) / 15.0 if animated else 0.5
    px0, py0 = 3 * CELL, 6 * CELL - 24
    px1, py1 = tx, ty - 6
    def pos(pr):
        return (px0 + (px1 - px0) * pr, py0 + (py1 - py0) * pr - 4 * 70 * pr * (1 - pr))
    sx, sy = pos(prog)
    for k in range(1, 9):
        tx_, ty_ = pos(max(0.0, prog - k * 0.03))
        sc.add(900 + k, _dot(k), tx_ - 1, ty_ - 1)
    sc.add(1000, stone_projectile(), sx - 5, sy - 5)
    sc.shadows.append((sx, py0 + (py1 - py0) * prog + 4, 5, 2))
    return sc, fx


def _dot(k):
    c = Canvas(3, 3)
    c.put_ramp(1, 1, 'bone', 5 if k % 2 else 4)
    if k < 4:
        c.put_ramp(0, 1, 'bone', 4)
        c.put_ramp(2, 1, 'bone', 4)
        c.put_ramp(1, 0, 'bone', 4)
        c.put_ramp(1, 2, 'bone', 4)
    return c


# --------------------------------------------------------------------------- Export


def main():
    # 1) Palette
    names = RAMP_NAMES
    sw = Canvas(6 * 10, len(names) * 10 + 0)
    for j, n in enumerate(names):
        for i, col in enumerate(RAMPS[n]):
            for y in range(10):
                for x in range(10):
                    sw.put(i * 10 + x, j * 10 + y, col)
    pal = upscale(sw.to_image(), 3)
    d = ImageDraw.Draw(pal)
    pal.save(os.path.join(OUT, 'palette.png'))

    # 2) Umgebung
    env = [
        ('Gras', tile_grass(1)), ('Pflaster (Innenhof)', tile_cobble(2, base='dirt', tone=(3, 4), mortar=2, hi=5)), ('Pflaster (Mauerkappe)', tile_cobble(24, base='stone', tone=(3, 4), mortar=2, hi=5)), ('Dielen', tile_planks(3)),
        ('Mauerblock (Ring)', wall_block(4)), ('Mauer, Süden verdeckt', wall_top_only(4)),
        ('Wehrturm', tower('teamA')), ('Wehrturm Team B', tower('teamB')), ('Tor (1x2)', gate('teamA')),
        ('Kern (2x2)', core()), ('Krankenstation', room_krankenstation()),
        ('Schmiede', room_schmiede()), ('Zinnenkranz', platform_zinnen()),
    ]
    sheet(env, 4, 64, 84, scale=4).save(os.path.join(OUT, 'umgebung.png'))

    # 3) Einheiten: Spritesheets + Atlas + Kontaktbogen
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

    scale = 5
    pad = 6
    W = max(sum(cv.w for cv in fr) * scale + pad * (len(fr) + 1) for _, fr in strips)
    H = sum(max(cv.h for cv in fr) * scale + pad + 14 for _, fr in strips) + pad
    img = Image.new('RGBA', (W, H), hexrgb('#383250') + (255,))
    dr = ImageDraw.Draw(img)
    y = pad
    font = ImageFont.load_default()
    for name, fr in strips:
        dr.text((pad, y), f'{name}   ({per_sprite[name]} Farben)', fill=(240, 235, 250, 255), font=font)
        y += 14
        x = pad
        for cv in fr:
            img.alpha_composite(upscale(cv.to_image(), scale), (x, y))
            x += cv.w * scale + pad
        y += max(cv.h for cv in fr) * scale + pad
    img.save(os.path.join(OUT, 'einheiten.png'))

    # 4) Szene (statisch) in 1x und 3x
    sc, fx = make_scene(0, animated=False)
    cv = sc.render(fx)
    im = cv.to_image()
    im.save(os.path.join(OUT, 'szene_1x.png'))
    upscale(im, 3).save(os.path.join(OUT, 'szene_3x.png'))

    # 5) Animation (16 Bilder, nahtlos)
    frames = []
    for t in range(16):
        sc, fx = make_scene(t, animated=True)
        frames.append(upscale(sc.render(fx).to_image(), 2).convert('RGB'))
    frames[0].save(os.path.join(OUT, 'szene_animation.gif'), save_all=True, append_images=frames[1:],
                   duration=110, loop=0, disposal=2)

    # 6) Bericht
    with open(os.path.join(OUT, 'bericht.txt'), 'w', encoding='utf-8') as fh:
        fh.write(f'Gesamtfarben aller Einheiten: {len(all_colors)} (Master-Palette: {sum(len(v) for v in RAMPS.values()) + 2})\n')
        for k, v in per_sprite.items():
            fh.write(f'{k}: {v} Farben\n')
    print('fertig; Farben gesamt:', len(all_colors), per_sprite)


if __name__ == '__main__':
    main()
