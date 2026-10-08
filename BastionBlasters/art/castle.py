"""Modulare Burgen.

Eine Burg ist eine beliebige, kantenverbundene Menge von Zellen (ASCII-Karte). Die Wände entstehen
automatisch: dünn, auf den Zellkanten (Außenkante der Burg, Raumgrenzen), mit Türen und Toren.
Gerendert wird per Extrusion mit Tiefenpuffer (schräge Draufsicht, Kamera im Süden):

  * Boden: reine Draufsicht auf dem 32-px-Raster
  * alles Hohe: Süd-Fläche (Vorderseite) nach oben extrudiert, Ost-/West-Flächen unsichtbar
  * Nordwände zeigen ihre Innenseite, Südwände sind niedrig (Brüstung), damit man in die Burg sieht
"""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from assets_env import tile_cobble, tile_planks, value_noise, tower, core
from assets_props import *

CELL = 32
T = 8                    # Wanddicke (px)
H_TALL, H_LOW, H_SIDE, H_GATE = 22, 10, 20, 24
ROOM_LETTERS = set('KSWBZ')
DOOR_W = 14

K_WALL, K_GATE_H, K_GATE_H_B = 1, 2, 4        # Wand, Süd/Nord-Tor Team A / Team B (Seitentore sind offene Durchlässe)


def rgb_of(cv: Canvas):
    return cv.px[:, :, :3].copy()


# --------------------------------------------------------------------------- Texturen


def front_wall_tile(h, seed=1, moss=True):
    """Vorderseite einer Wand: Quader im Verband, 32 x h, kachelbar in x"""
    c = Canvas(32, h)
    rnd = random.Random(seed)
    ch = 6
    rows = (h + ch - 1) // ch
    for row in range(rows):
        y0 = row * ch
        off = 8 if row % 2 else 0
        for x in range(-8, 32, 16):
            bx = x + off
            t_ = rnd.choice([2, 3, 3])
            for yy in range(ch):
                py = y0 + yy
                if py >= h:
                    break
                for xx in range(16):
                    px = (bx + xx) % 32
                    if yy == ch - 1 or xx == 15:
                        idx = 1
                    elif yy == 0:
                        idx = 5 if row == 0 else min(5, t_ + 1)
                    elif xx == 0:
                        idx = min(5, t_ + 1)
                    else:
                        idx = t_ - (1 if row >= rows - 1 and yy > 2 else 0)
                        if texture_noise(px, py, seed) > 0.9:
                            idx = max(1, idx - 1)
                    c.put_ramp(px, py, 'stone', idx)
    for x in range(32):
        c.put_ramp(x, h - 1, 'stone', 0)
        if x % 2 == 0 and h > 8:
            c.put_ramp(x, h - 2, 'stone', 1)
    if moss and h > 12:
        for x in range(32):
            hh = int(1 + 2.0 * value_noise(x, 3, 32, seed + 11))
            if texture_noise(x, 0, seed + 5) > 0.55:
                for k in range(hh):
                    c.put_ramp(x, h - 2 - k, 'grass', 2 if k == 0 else (3 if (x + k) % 2 == 0 else 2))
    return c


def front_gate_h_tile(h, team='teamA', seed=1):
    """Tor-Vorderseite (Wand nach Süden): Steinbogen mit Holztor"""
    c = front_wall_tile(h, seed, moss=False)
    cx = 15.5
    for z in range(3, h):
        for x in range(5, 27):
            # Rundbogen
            if z < 9:
                dx = (x + 0.5 - 16) / 11.0
                top = 3 + 6 * (1 - math.sqrt(max(0.0, 1 - dx * dx)))
                if z < top:
                    continue
            bx = (x - 5) % 7
            idx = 3
            if bx == 6:
                idx = 1
            elif bx == 0:
                idx = 4
            if z > h - 5:
                idx = max(1, idx - 1)
            if texture_noise(x, z // 2, seed) > 0.84:
                idx = max(1, idx - 1)
            c.put_ramp(x, z, 'wood', idx)
    for z in range(4, h):
        c.put_ramp(15, z, 'wood', 0)
        c.put_ramp(16, z, 'wood', 1)
    for bz in (int(h * 0.38), int(h * 0.72)):
        for x in range(5, 27):
            if x in (15, 16):
                continue
            c.put_ramp(x, bz, 'metal', 3 if x % 2 else 4)
            c.put_ramp(x, bz + 1, 'metal', 2)
    c.put_ramp(13, int(h * 0.55), 'gold', 5)
    c.put_ramp(18, int(h * 0.55), 'gold', 5)
    # Rahmen dunkler absetzen
    for z in range(3, h):
        c.put_ramp(4, z, 'stone', 0)
        c.put_ramp(27, z, 'stone', 1)
    # Wappen über dem Bogen
    c.put_ramp(15, 0, team, 4)
    c.put_ramp(16, 0, team, 3)
    c.put_ramp(15, 1, team, 3)
    c.put_ramp(16, 1, team, 2)
    return c


def top_tile(kind, team='teamA', seed=2):
    if kind == K_WALL:
        return tile_cobble(seed + 20, 32, base='stone', tone=(3, 4), mortar=2, hi=5)
    pl = tile_planks(seed, 32, tone=(2, 3, 4))
    for y in (6, 22):
        for x in range(32):
            pl.put_ramp(x, y, 'metal', 3 if x % 2 else 4)
            pl.put_ramp(x, y + 1, 'metal', 2)
    for x in (15, 16):
        for y in range(32):
            pl.put_ramp(x, y, 'wood', 1)
    return pl


class Textures:
    def __init__(self):
        self.tops = {}
        self.fronts = {}
        for kind, team in ((K_WALL, 'teamA'), (K_GATE_H, 'teamA'), (K_GATE_H_B, 'teamB')):
            base = K_WALL if kind == K_WALL else K_GATE_H
            self.tops[kind] = rgb_of(top_tile(base, team))
        for h in (H_TALL, H_LOW, H_SIDE, H_GATE, 34):
            self.fronts[(h, K_WALL)] = rgb_of(front_wall_tile(h, seed=3))
            if h != 34:
                self.fronts[(h, K_GATE_H)] = rgb_of(front_gate_h_tile(h, 'teamA'))
                self.fronts[(h, K_GATE_H_B)] = rgb_of(front_gate_h_tile(h, 'teamB'))


# --------------------------------------------------------------------------- Burg


class Castle:
    def __init__(self, rows, ox, oy, team='teamA', gates=(), name=''):
        self.team = team
        self.ox, self.oy = ox, oy
        self.name = name
        self.cells = {}
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    self.cells[(x, y)] = ch
        # Module (zusammenhängende gleiche Raumbuchstaben)
        self.mod = {}
        self.modules = []
        seen = set()
        for c, ch in self.cells.items():
            if ch in ROOM_LETTERS and c not in seen:
                stack, cs = [c], set()
                while stack:
                    p = stack.pop()
                    if p in cs or self.cells.get(p) != ch:
                        continue
                    cs.add(p)
                    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        stack.append((p[0] + d[0], p[1] + d[1]))
                seen |= cs
                mid = len(self.modules)
                for p in cs:
                    self.mod[p] = mid
                xs = [p[0] for p in cs]
                ys = [p[1] for p in cs]
                self.modules.append({'id': mid, 'letter': ch, 'cells': cs, 'x0': min(xs), 'x1': max(xs),
                                     'y0': min(ys), 'y1': max(ys), 'door': None})
        self.gates = set(gates)       # (x, y, side) mit side in 'NESW': Kante der Zelle (x, y)
        self._pick_doors()

    # -- Hilfen
    def kind(self, p):
        return self.cells.get(p)

    @staticmethod
    def _edge_key(p, side):
        x, y = p
        if side == 'N':
            return ('h', x, y)
        if side == 'S':
            return ('h', x, y + 1)
        if side == 'W':
            return ('v', x, y)
        return ('v', x + 1, y)

    def _pick_doors(self):
        for m in self.modules:
            best = None
            for side, d in (('S', (0, 1)), ('E', (1, 0)), ('W', (-1, 0)), ('N', (0, -1))):
                cand = []
                for c in m['cells']:
                    n = (c[0] + d[0], c[1] + d[1])
                    if n not in m['cells'] and self.cells.get(n) in ('h', 'C'):
                        cand.append(c)
                if cand:
                    if side in 'NS':
                        cand.sort(key=lambda c: c[0])
                    else:
                        cand.sort(key=lambda c: c[1])
                    best = (side, cand[len(cand) // 2])
                    break
            m['door'] = best

    def door_edges(self):
        out = set()
        for m in self.modules:
            if m['door']:
                side, c = m['door']
                out.add(self._edge_key(c, side))
        return out

    def gate_edges(self):
        return {self._edge_key((x, y), s): (x, y, s) for (x, y, s) in self.gates}

    # -- Wände in die globalen Arrays eintragen
    def add_walls(self, fp, kd, ht):
        doors = self.door_edges()
        gates = self.gate_edges()
        edges = set()
        for (x, y) in self.cells:
            for s in 'NESW':
                edges.add(self._edge_key((x, y), s))
        gk_h = K_GATE_H if self.team == 'teamA' else K_GATE_H_B
        for e in sorted(edges):
            orient, ex, ey = e
            if orient == 'h':
                a, b = (ex, ey - 1), (ex, ey)
            else:
                a, b = (ex - 1, ey), (ex, ey)
            ka, kb = self.cells.get(a), self.cells.get(b)
            if ka == 'T' or kb == 'T':
                continue
            wall = False
            if (ka is None) != (kb is None):
                wall = True
            elif ka is not None and kb is not None:
                ma, mb = self.mod.get(a), self.mod.get(b)
                if ma != mb and (ma is not None or mb is not None):
                    wall = True
            if not wall:
                continue
            platform = any(self.cells.get(c) == 'Z' for c in (a, b))
            if orient == 'h':
                if ka is None:
                    tall = True          # Nordkante der Burg: Innenansicht
                elif kb is None:
                    tall = False         # Südkante der Burg
                else:
                    ma, mb = self.mod.get(a), self.mod.get(b)
                    tall = not (ma is not None and mb is None)
                h = H_LOW if (platform or not tall) else H_TALL
            else:
                h = H_SIDE if not platform else H_LOW
            kind = K_WALL
            if e in gates and orient == 'v':
                continue                   # Seitentor: offener Durchlass, Boden wird in paint_gates gelegt
            if e in gates:
                kind = gk_h
                h = H_GATE
            elif orient == 'v' and (('v', ex, ey - 1) in gates or ('v', ex, ey + 1) in gates):
                h = min(h, H_LOW)          # Torvorbau: Wand neben einem Seitentor niedrig, damit der Durchlass sichtbar bleibt
            self._stamp(fp, kd, ht, orient, ex, ey, h, kind, door=(e in doors))
            if e in gates:
                self._pillars(fp, kd, ht, orient, ex, ey)

    def _pillars(self, fp, kd, ht, orient, ex, ey):
        """zwei Steinpfeiler (höher als die Wand) links/rechts bzw. oben/unten vom Tor"""
        half = T // 2 + 1
        if orient == 'h':
            Y = (self.oy + ey) * CELL
            X0 = (self.ox + ex) * CELL
            pts = [(X0 - 1, Y), (X0 + CELL + 1, Y)]
        else:
            X = (self.ox + ex) * CELL
            Y0 = (self.oy + ey) * CELL
            pts = [(X, Y0 - 1), (X, Y0 + CELL + 1)]
        for (cx, cy) in pts:
            for yy in range(cy - half, cy + half):
                for xx in range(cx - half, cx + half):
                    fp[yy, xx] = True
                    ht[yy, xx] = 34
                    kd[yy, xx] = K_WALL

    def _stamp(self, fp, kd, ht, orient, ex, ey, h, kind, door=False):
        half = T // 2
        if orient == 'h':
            Y = (self.oy + ey) * CELL
            X0 = (self.ox + ex) * CELL
            ys = slice(Y - half, Y + half)
            xs = np.arange(X0 - half, X0 + CELL + half)
            for yy in range(Y - half, Y + half):
                for xx in xs:
                    if door and X0 + (CELL - DOOR_W) // 2 <= xx < X0 + (CELL + DOOR_W) // 2:
                        continue
                    k = kind if (kind != K_WALL and X0 <= xx < X0 + CELL) else K_WALL
                    fp[yy, xx] = True
                    if h >= ht[yy, xx]:
                        ht[yy, xx] = h
                    if kd[yy, xx] < k:
                        kd[yy, xx] = k
        else:
            X = (self.ox + ex) * CELL
            Y0 = (self.oy + ey) * CELL
            for yy in range(Y0 - half, Y0 + CELL + half):
                if door and Y0 + (CELL - DOOR_W) // 2 <= yy < Y0 + (CELL + DOOR_W) // 2:
                    continue
                for xx in range(X - half, X + half):
                    k = kind if (kind != K_WALL and Y0 <= yy < Y0 + CELL) else K_WALL
                    fp[yy, xx] = True
                    if h >= ht[yy, xx]:
                        ht[yy, xx] = h
                    if kd[yy, xx] < k:
                        kd[yy, xx] = k

    # -- Boden
    def paint_floors(self, world: World, tiles):
        for (x, y), ch in self.cells.items():
            X, Y = (self.ox + x) * CELL, (self.oy + y) * CELL
            tl = tiles.floor(ch, x, y)
            world.px[Y:Y + CELL, X:X + CELL, :3] = tl
            world.depth[Y:Y + CELL, X:X + CELL] = -50

    def paint_gates(self, world: World):
        """Seitentore (O/W) sind offene Durchlässe: Holzschwelle mit Eisenbändern auf den Boden legen"""
        pl = rgb_of(top_tile(K_GATE_H, self.team))
        for (x, y, s) in self.gates:
            if s not in 'EW':
                continue
            orient, ex, ey = self._edge_key((x, y), s)
            X = (self.ox + ex) * CELL
            Y0 = (self.oy + ey) * CELL
            for yy in range(Y0, Y0 + CELL):
                for xx in range(X - T // 2, X + T // 2):
                    world.px[yy, xx, :3] = pl[yy - Y0, (xx - X + 16) % 32]
                    world.depth[yy, xx] = -45

    # -- Objekte (Türme, Kern, Möbel, Wanddeko); gibt Plattform-Mitten zurück
    def place_objects(self, world: World, tw: Canvas, cr: Canvas, props):
        out = {'platforms': [], 'rooms': []}
        for (x, y), ch in self.cells.items():
            X, Y = (self.ox + x) * CELL, (self.oy + y) * CELL
            if ch == 'T':
                world.draw(tw, X + CELL // 2 - tw.w // 2, Y + CELL + 3 - tw.h, Y + CELL)
        # Kern: 2x2 Zellen 'C' (obere linke Zelle bestimmen)
        cs = sorted(p for p, ch in self.cells.items() if ch == 'C')
        if cs:
            x0 = min(p[0] for p in cs)
            y0 = min(p[1] for p in cs)
            cx = (self.ox + x0 + 1) * CELL
            cy = (self.oy + y0 + 1) * CELL
            world.draw(cr, cx - 32, cy - 66, cy + CELL)
        for m in self.modules:
            X0 = (self.ox + m['x0']) * CELL
            Y0 = (self.oy + m['y0']) * CELL
            W = (m['x1'] - m['x0'] + 1) * CELL
            Hh = (m['y1'] - m['y0'] + 1) * CELL
            self._furnish(world, m, X0, Y0, W, Hh, props, out)
        return out

    def _furnish(self, world, m, X0, Y0, W, Hh, P, out):
        L = m['letter']
        door_side = m['door'][0] if m['door'] else None
        wall_base = Y0 + T // 2
        # Wanddeko an der Nordwand (Vorderseite, Unterkante knapp über dem Boden)
        def decor(spr, cx):
            if door_side == 'N':
                return
            world.draw(spr, int(cx - spr.w / 2), wall_base - spr.h + 1, wall_base + 1)

        def prop(spr, x, y, key_add=0):
            world.draw(spr, int(x), int(y), int(y + spr.h) + key_add)

        if L == 'K':
            decor(P['banner_cross'], X0 + 16)
            decor(P['window'], X0 + W // 2)
            decor(P['banner_cross'], X0 + W - 16)
            for i in range(3):
                prop(P['bed'], X0 + 12 + i * 28, Y0 + 12)
            prop(P['herb_table'], X0 + 14, Y0 + Hh - 24)
            prop(P['plant'], X0 + W - 22, Y0 + Hh - 26)
            prop(P['rug'], X0 + W // 2 - 18, Y0 + Hh - 22, key_add=-200)
        elif L == 'S':
            decor(P['forge_decor'], X0 + W // 2)
            decor(P['crest'], X0 + 14)
            decor(P['crest'], X0 + W - 14)
            prop(P['anvil'], X0 + W // 2 - 11, Y0 + 28)
            prop(P['barrel'], X0 + 10, Y0 + Hh - 24)
            prop(P['trough'], X0 + W - 34, Y0 + Hh - 22)
            prop(P['crate'], X0 + 40, Y0 + Hh - 22)
        elif L == 'W':
            decor(P['window'], X0 + 20)
            decor(P['window'], X0 + W - 20)
            prop(P['bed'], X0 + 14, Y0 + 12)
            prop(P['bed'], X0 + 44, Y0 + 12)
            prop(P['chest'], X0 + W - 28, Y0 + Hh - 22)
            prop(P['rug'], X0 + 14, Y0 + Hh - 26, key_add=-200)
        elif L == 'B':
            decor(P['crest'], X0 + 16)
            decor(P['crest'], X0 + W - 16)
            for i in range(3):
                prop(P['bunk'], X0 + 10 + i * 24, Y0 + 12)
            prop(P['rack'], X0 + W - 34, Y0 + Hh - 26)
        elif L == 'Z':
            prop(P['crate'], X0 + 8, Y0 + Hh - 20)
            prop(P['crate'], X0 + W - 24, Y0 + Hh - 20)
            out['platforms'].append((X0 + W // 2, Y0 + Hh // 2 + 8))
        out['rooms'].append((L, X0, Y0, W, Hh))


# --------------------------------------------------------------------------- Böden


class FloorTiles:
    def __init__(self, team='teamA'):
        self.hof = [rgb_of(tile_cobble(2 + s * 10, base='dirt', tone=(3, 4), mortar=2, hi=5)) for s in range(3)]
        self.planks = {
            'K': rgb_of(tile_planks(7, 32, tone=(3, 4, 4))),
            'W': rgb_of(tile_planks(11, 32, tone=(2, 3, 3))),
            'B': rgb_of(tile_planks(15, 32, tone=(2, 3, 4))),
        }
        self.dark = rgb_of(tile_cobble(9, 32, base='stone', tone=(1, 2), mortar=0, hi=3))
        self.slab = rgb_of(tile_cobble(23, 32, base='stone', tone=(3, 4), mortar=2, hi=5))

    def floor(self, ch, x, y):
        if ch in ('h', 'C', 'T'):
            return self.hof[(x * 7 + y * 3) % 3]
        if ch in self.planks:
            return self.planks[ch]
        if ch == 'S':
            return self.dark
        return self.slab


# --------------------------------------------------------------------------- Wand-Rendering


def wall_shadows(world: World, fp, dx=7, dy=6):
    """Schlagschatten (Licht von links oben): Schachbrett-Dither rechts/unterhalb der Wände"""
    H, W = fp.shape
    sh = np.zeros_like(fp)
    ys, xs = np.nonzero(fp)
    ys2 = np.clip(ys + dy, 0, H - 1)
    xs2 = np.clip(xs + dx, 0, W - 1)
    sh[ys2, xs2] = True
    # auch die Zwischenpixel, damit die Fläche geschlossen ist
    ys3 = np.clip(ys + dy // 2, 0, H - 1)
    xs3 = np.clip(xs + dx // 2, 0, W - 1)
    sh[ys3, xs3] = True
    sh &= ~fp
    yy, xx = np.mgrid[0:H, 0:W]
    chk = ((xx + yy) % 2 == 0)
    ground = world.depth < -40
    m = sh & chk & ground
    world.px[:, :, :3][m] = darken_palette(world.px[:, :, :3][m], 2)


def draw_walls(world: World, fp, kd, ht, tex: Textures):
    rows = np.nonzero(fp.any(axis=1))[0]
    for py in rows:
        xs = np.nonzero(fp[py])[0]
        hs = ht[py, xs]
        ks = kd[py, xs]
        for h in np.unique(hs):
            for k in np.unique(ks[hs == h]):
                sel = (hs == h) & (ks == k)
                sx = xs[sel]
                top = tex.tops[int(k)][py % 32, sx % 32]
                front = tex.fronts[(int(h), int(k))]       # (h, 32, 3)
                for z in range(0, int(h) + 1):
                    y = py - int(h) + z
                    if y < 0 or y >= world.h:
                        continue
                    col = top if z == 0 else front[z - 1, sx % 32]
                    ok = world.depth[y, sx] <= py
                    world.px[y, sx[ok], :3] = col[ok]
                    world.depth[y, sx[ok]] = py
