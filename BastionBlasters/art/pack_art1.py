"""pack_art1: Kartenbilder der Artillerie UA-02 .. UA-13 (Funken-Magier, Donnerbüchse, Goblin-/Ork-Kanone, Eiszapfen-Mörser,
Sporenschleuder, Kalmar-Kanone, Fledermaus-Hexe, Nagelbrett-Ballista, Blitzspulen-Hexe, Maulwurf-Mörser, Frosch-Katapult).

Sprites stehen in pack_art1_sa / _sb / _sc, Geschosse und Effekte in pack_art1_fx, Helfer in pack_art1_kit.
"""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art1_kit import *
from pack_art1_fx import *
from pack_art1_sa import *
from pack_art1_sb import *
from pack_art1_sc import *


def _origin(spr, foot_x, foot_y):
    """linke obere Ecke eines mit unit_at gesetzten Sprites"""
    return int(foot_x - spr.w // 2), int(foot_y - spr.h + 1)


def _smoke_sprite(h=30, seed=1, w=16):
    return smoke_sprite(h, w, seed, n=max(3, h // 8))


def _burning(world, spr, fx, fy, flames, seed=1):
    """Sprite setzen und mit Flammen belegen: flames = [(dx, dy, w, h)] relativ zur linken oberen Ecke"""
    prop_at(world, spr, fx, fy)
    ox, oy = _origin(spr, fx, fy)
    for k, (dx, dy, w_, h_) in enumerate(flames):
        fl = flame(w_, h_, seed + k)
        world.draw(fl, ox + dx, oy + dy, 9000 + k)


# =========================================================================== UA-02 Funken-Magier


@card_art('UA-02')
def _art_ua02():
    w = ground_world('grass', 3)
    for (sp, x, y) in ((bush(2), 18, 38), (rock(2), 100, 92), (bush(1, True), 70, 30)):
        prop_at(w, sp, x, y)
    spr = spr_spark_mage()
    unit_at(w, spr, 36, 80)
    ox, oy = _origin(spr, 36, 80)
    tipx, tipy = ox + 36, oy + 12                       # Streichholzkopf
    # brennende Holzkisten rechts (Ziel) + Zielschatten
    zielschatten(w, 114, 76, 17, 1)
    _burning(w, crate(), 124, 68, [(1, -8, 9, 13), (7, -3, 7, 9)], 3)
    _burning(w, crate(), 108, 78, [(2, -9, 10, 14), (-3, -2, 6, 8)], 7)
    _burning(w, barrel(), 118, 88, [(2, -9, 9, 13)], 11)
    w.draw(_smoke_sprite(34, 2), 106, 34, 9000)
    w.draw(_smoke_sprite(30, 5), 120, 28, 9000)
    # Feuerball im flachen Flug mit Funkenspur
    fb = fireball()
    put(w, fb, 82, 56)
    for k in range(7):
        t = k / 7.0
        put_px(w, tipx + 8 + t * 18 + (k % 2), tipy + 3 + t * 6, 'fire', 4 if k % 2 else 5, 9000)
    for (x, y) in ((70, 52), (66, 60), (74, 62), (60, 48), (92, 50)):
        put_px(w, x, y, 'gold', 5, 9000)
    return finish(w)
