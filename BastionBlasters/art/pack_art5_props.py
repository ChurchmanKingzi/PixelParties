"""Kulissen und Nebenfiguren fuer pack_art5: Tafel, Pult, Eintopftopf, Brandkiste, Symbole, Waende, Eindringling."""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from pack_art5_kit import *

_TEX = {}


def _tex():
    """Textures einmal bauen (castle.py) und merken"""
    if 'tex' not in _TEX:
        from castle import Textures
        _TEX['tex'] = Textures()
    return _TEX['tex']


# =========================================================================== Mauern


def wall_piece(width, tall=24, kind=1):
    """Mauerstueck in Suedansicht (Oberseite 8 px + Front `tall` px). kind 1 = Wand, 2 = Tor-Holz"""
    from castle import front_wall_tile, rgb_of
    tex = _tex()
    top = tex.tops[kind]
    if (tall, kind) in tex.fronts:
        front = tex.fronts[(tall, kind)]
    else:
        key = ('front', tall, kind)
        if key not in _TEX:
            _TEX[key] = rgb_of(front_wall_tile(tall, seed=3))
        front = _TEX[key]
    c = Canvas(width, 8 + tall)
    for x in range(width):
        for y in range(8):
            c.put(x, y, tuple(int(v) for v in top[y, x % 32]), RAMP_ID['stone'])
        for y in range(tall):
            c.put(x, 8 + y, tuple(int(v) for v in front[y, x % 32]), RAMP_ID['stone'])
    c.outline()
    return c


def wall_row(world, x0, x1, base_y, tall=24, skip=None):
    """Mauer von x0 bis x1 (Fusspunkt base_y); skip = (a, b) laesst eine Luecke fuer ein Tor"""
    segs = [(x0, x1)] if skip is None else [(x0, skip[0]), (skip[1], x1)]
    for (a, b) in segs:
        if b - a < 2:
            continue
        sp = wall_piece(b - a, tall)
        world.draw(sp, a, base_y - sp.h + 1, base_y)


# =========================================================================== Boden-Effekte


def aura_ring(world, cx, cy, rx, ry, ramp='gold', phase=0):
    """gestrichelter Ring + lockeres Punktfeld auf dem Boden (unter allen Figuren)"""
    w, h = int(rx * 2 + 6), int(ry * 2 + 6)
    c = Canvas(w, h)
    mx, my = w / 2.0, h / 2.0
    for y in range(h):
        for x in range(w):
            d = math.hypot((x + 0.5 - mx) / rx, (y + 0.5 - my) / ry)
            band = abs(d - 1.0) * min(rx, ry)
            if band < 1.2:
                if (x + y + phase) % 2 == 0:
                    c.put_ramp(x, y, ramp, 5)
                elif band < 0.8:
                    c.put_ramp(x, y, ramp, 2)
            elif d < 1.0 and ((x + y) % 4 == 0) and d > 0.55:
                c.put_ramp(x, y, ramp, 2)
    world.draw(c, int(cx - mx), int(cy - my), -45)


def sparkle(world, x, y, ramp='gold', big=False):
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        world.px[y + dy, x + dx, :3] = RAMPS[ramp][i]
        world.depth[y + dy, x + dx] = 9000
    if big:
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            world.px[y + dy, x + dx, :3] = RAMPS[ramp][3]
            world.depth[y + dy, x + dx] = 9000


def dots(world, plist, ramp, idx, key=9000):
    for (x, y) in plist:
        if 0 <= x < world.w and 0 <= y < world.h:
            world.px[y, x, :3] = RAMPS[ramp][idx]
            world.depth[y, x] = key


# =========================================================================== Symbole


def shield_icon():
    c = Canvas(8, 9)
    poly(c, [(0, 0), (7, 0), (7, 4), (4, 8), (3, 8), (0, 4)], 'metal', lo=1, hi=5)
    hline(c, 0, 7, 0, 'gold', 5)
    vline(c, 3, 1, 6, 'gold', 4)
    vline(c, 4, 1, 6, 'gold', 3)
    c.outline()
    return c


def heart_icon():
    c = Canvas(9, 8)
    for (x, y) in ((1, 1), (2, 0), (3, 0), (4, 1), (5, 0), (6, 0), (7, 1), (1, 2), (7, 2), (1, 3), (7, 3), (2, 4), (6, 4), (3, 5), (5, 5), (4, 6)):
        c.put_ramp(x, y, 'fire', 1)
    for y in range(1, 5):
        for x in range(2, 7):
            if (y == 4 and x in (2, 6)) or (y == 1 and x in (4,)):
                continue
            c.put_ramp(x, y, 'fire', 4 if x < 4 else 3)
    c.put_ramp(3, 5, 'fire', 3)
    c.put_ramp(4, 5, 'fire', 3)
    c.put_ramp(5, 5, 'fire', 2)
    c.put_ramp(2, 1, 'fire', 5)
    c.put_ramp(3, 1, 'fire', 5)
    c.put_ramp(2, 2, 'fire', 5)
    return c


def up_arrow(ramp='leaf'):
    c = Canvas(7, 8)
    poly(c, [(3, 0), (6, 3), (4, 3), (4, 7), (2, 7), (2, 3), (0, 3)], ramp, lo=2, hi=5)
    c.outline()
    return c


# =========================================================================== Requisiten


def blackboard(w=56, h=34):
    """Wandtafel mit Holzrahmen, Kreide-Kritzeleien (Kreis, Dreieck, Pfeil, Sterne, Welle) - kein Text"""
    c = Canvas(w, h)
    round_rect(c, 0, 0, w - 1, h - 1, 'wood', lo=1, hi=4, radius=2)
    for y in range(3, h - 4):
        for x in range(3, w - 3):
            tone = 1
            if (x + y * 2) % 13 == 0:
                tone = 2
            c.put_ramp(x, y, 'leaf', tone)
    hline(c, 3, w - 4, 3, 'leaf', 0)
    vline(c, 3, 3, h - 5, 'leaf', 0)
    # Kreide-Rinne mit Kreidestuecken
    c.rect(4, h - 4, w - 5, h - 3, 'wood', 3)
    c.rect(8, h - 5, 12, h - 5, 'bone', 5)
    c.rect(15, h - 5, 16, h - 5, 'bone', 4)
    # Kreis mit Punkt
    for ang in range(0, 360, 12):
        a = math.radians(ang)
        c.put_ramp(int(round(13 + math.cos(a) * 6)), int(round(12 + math.sin(a) * 6)), 'bone', 5)
    c.put_ramp(13, 12, 'bone', 4)
    c.put_ramp(14, 12, 'bone', 4)
    # Dreieck mit Hoehe
    c.line(26, 20, 32, 8, 'bone', 5)
    c.line(32, 8, 38, 20, 'bone', 5)
    c.line(26, 20, 38, 20, 'bone', 5)
    for y in range(11, 20, 2):
        c.put_ramp(32, y, 'bone', 3)
    # Pfeil nach rechts
    c.line(42, 10, 51, 10, 'bone', 5)
    c.line(49, 8, 51, 10, 'bone', 5)
    c.line(49, 12, 51, 10, 'bone', 5)
    # Sterne/Punkte und eine Welle
    for (x, y) in ((43, 17), (47, 15), (50, 18), (45, 21), (49, 22)):
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x + 1, y, 'gold', 3)
    for k in range(0, 24):
        c.put_ramp(6 + k, 22 + int(round(1.6 * math.sin(k * 0.8))), 'bone', 4)
    c.outline()
    return c


def desk():
    """Schulpult von vorn mit aufgeschlagenem Buch, 22 x 16"""
    c = Canvas(22, 16)
    c.rect(2, 8, 3, 15, 'wood', 2)
    c.rect(18, 8, 19, 15, 'wood', 1)
    round_rect(c, 0, 5, 21, 10, 'wood', lo=1, hi=4, radius=1)
    hline(c, 1, 20, 5, 'wood', 5)
    poly(c, [(4, 1), (10, 2), (10, 6), (3, 6)], 'bone', lo=3, hi=5)
    poly(c, [(11, 2), (17, 1), (18, 6), (11, 6)], 'bone', lo=2, hi=4)
    vline(c, 10, 2, 6, 'bone', 1)
    for y in (3, 4):
        for x in (5, 6, 7, 8, 13, 14, 15):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, 'stone', 2)
    c.outline()
    return c


def stew_pot(f=0):
    """grosser Eintopftopf (genietetes Metall) ueber Feuerstelle: Flammen links und rechts, 34 x 30"""
    c = Canvas(34, 30)
    # Scheite
    thick_line(c, 4, 27, 29, 24, 3.2, 'wood', lo=0, hi=3)
    thick_line(c, 4, 24, 30, 27, 3.2, 'wood', lo=1, hi=4)
    pts(c, [(5, 26), (6, 26), (28, 24), (29, 24)], 'dirt', 5)
    # Flammen hinter und neben dem Topf
    flame(c, 5, 25, 14, f + 1, w=6)
    flame(c, 28, 25, 14, f + 2, w=6)
    # Topf
    ellipse(c, 17, 14, 12.4, 9.6, 'metal', lo=0, hi=5, ambient=0.2)
    ellipse(c, 17, 7.0, 11.2, 3.4, 'metal', lo=1, hi=5)
    ellipse(c, 17, 7.4, 9.4, 2.5, 'wood', lo=2, hi=4, ambient=0.3)
    for (x, y) in ((12, 6), (15, 7), (19, 6), (22, 7), (17, 5)):
        c.put_ramp(x, y, 'fire', 3)
    for (x, y) in ((13, 7), (20, 7)):
        c.put_ramp(x, y, 'leaf', 4)
    for (x, y) in ((8, 15), (26, 15), (13, 20), (21, 20)):
        c.put_ramp(x, y, 'metal', 5)
    hline(c, 7, 27, 17, 'metal', 1)
    thick_line(c, 3, 12, 6, 9, 2.0, 'metal', lo=1, hi=4)
    thick_line(c, 31, 12, 28, 9, 2.0, 'metal', lo=0, hi=3)
    flame(c, 14, 26, 7, f, w=5)
    flame(c, 20, 26, 6, f + 1, w=5)
    c.outline()
    return c


def burning(spr, f=0, big=True):
    """Kiste/Fass mit Flammen oben: Sprite wird um Flammen nach oben erweitert"""
    h = spr.h + 14
    c = Canvas(spr.w, h)
    c.blit(spr, 0, 14)
    # Russ
    for x in range(2, spr.w - 2):
        if x % 2 == 0 and c.alpha(x, 15):
            c.put_ramp(x, 15, 'coal', 1)
    cx = spr.w // 2
    flame(c, cx - 4, 17, 10, f + 1, w=5)
    flame(c, cx + 3, 17, 12, f, w=6)
    flame(c, cx, 16, 14, f + 2, w=7)
    for (x, y) in ((cx - 6, 5), (cx + 6, 3), (cx + 2, 0)):
        c.put_ramp(x, y, 'gold', 5)
    return c


def lantern_post():
    c = Canvas(10, 30)
    c.rect(4, 8, 5, 29, 'wood', 2)
    c.rect(4, 8, 4, 29, 'wood', 4)
    round_rect(c, 1, 0, 8, 9, 'metal', lo=0, hi=3, radius=1)
    c.rect(3, 2, 6, 7, 'gold', 4)
    c.rect(4, 3, 5, 5, 'gold', 5)
    c.outline()
    return c


# =========================================================================== Eindringling (Nebenfigur, Teamfarbe B)


def spr_raider(anim='idle', f=0):
    """kleiner Eindringling (S): Kapuzenkittel, Stirnband in Gegnerfarbe, Knueppel"""
    c = Canvas(18, 22)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    stride = [2, 0, -2, 0][f % 4] if anim == 'walk' else 0
    thick_line(c, 7, 16 + bob, 7 - stride, 20, 2.4, 'wood', lo=0, hi=2)
    thick_line(c, 11, 16 + bob, 11 + stride, 20, 2.4, 'wood', lo=1, hi=3)
    c.rect(5 - stride, 20, 8 - stride, 21, 'coal', 2)
    c.rect(10 + stride, 20, 13 + stride, 21, 'coal', 3)
    round_rect(c, 4, 9 + bob, 13, 17 + bob, 'stone', lo=1, hi=4, radius=2)
    hline(c, 4, 13, 14 + bob, 'wood', 2)
    thick_line(c, 4, 10 + bob, 2, 15 + bob, 2.0, 'stone', lo=1, hi=3)
    arm = {'idle': (13, 15), 'walk': (14, 14), 'attack': (15, 11)}.get(anim, (13, 15))
    thick_line(c, 12, 11 + bob, arm[0], arm[1] + bob, 2.0, 'stone', lo=2, hi=4)
    thick_line(c, arm[0], arm[1] + bob, arm[0] + 2, arm[1] - 8 + bob, 1.8, 'wood', lo=2, hi=4)
    ellipse(c, arm[0] + 2.4, arm[1] - 9 + bob, 1.9, 2.4, 'wood', lo=1, hi=4)
    ellipse(c, 8.5, 6 + bob, 4.0, 3.7, 'skin', lo=2, hi=5)
    c.put_ramp(11, 6 + bob, 'coal', 1)
    for x in range(4, 14):
        c.put_ramp(x, 3 + bob, 'teamB', 3 if x > 7 else 2)
    c.put_ramp(3, 4 + bob, 'teamB', 3)
    c.put_ramp(2, 5 + bob, 'teamB', 2)
    c.put_ramp(3, 6 + bob, 'teamB', 2)
    c.outline()
    return c
