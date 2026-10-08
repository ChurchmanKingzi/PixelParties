"""pack_art5: Verteidiger UV-12..UV-17 und Zivilisten UZ-03..UZ-07 (Kartenbilder 144 x 96).

Sprites: pack_art5_defenders.py (Verteidiger), pack_art5_civilians.py (Zivilisten), pack_art5_props.py (Kulissen).
"""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art5_kit import *
from pack_art5_defenders import *
from pack_art5_civilians import *
from pack_art5_props import *


# --------------------------------------------------------------------------- Helfer


def _wall_decor(w, base_y, spr, cx):
    """Wanddeko auf der Mauer-Vorderseite (Fusspunkt = unten, etwas ueber der Mauerkante)"""
    w.draw(spr, int(cx - spr.w / 2), base_y - spr.h - 3, base_y + 1)


def _chamber(kind, seed, base_y=34, tall=26):
    w = ground_world(kind, seed)
    wall_row(w, 0, 144, base_y, tall=tall)
    return w


def _tracer(w, x0, y0, x1, y1, n=5, key=9000):
    """Leuchtspur: kurze helle Striche entlang einer Linie"""
    for k in range(n):
        t = k / max(1, n - 1)
        x = int(x0 + (x1 - x0) * t)
        y = int(y0 + (y1 - y0) * t)
        for d in range(3):
            xx = x - d
            if 0 <= xx < w.w and 0 <= y < w.h:
                w.px[y, xx, :3] = RAMPS['gold'][5 if d == 0 else (4 if d == 1 else 3)]
                w.depth[y, xx] = key


def _burst(w, x, y, ramp='gold'):
    """kleiner Treffer-/Muendungsblitz (Stern)"""
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 5), (1, 0, 5), (0, -1, 5), (0, 1, 5), (-2, 0, 4), (2, 0, 4), (0, -2, 4), (0, 2, 4),
                        (-1, -1, 3), (1, 1, 3), (-1, 1, 3), (1, -1, 3), (3, 0, 3), (-3, 0, 3)):
        xx, yy = x + dx, y + dy
        if 0 <= xx < w.w and 0 <= yy < w.h:
            w.px[yy, xx, :3] = RAMPS[ramp][i]
            w.depth[yy, xx] = 9100


def _puff(w, cx, cy, r, ramp='bone', lo=2, hi=4, key=8000, semi=True):
    """Dampf-/Rauchwolke: Kugel mit Schachbrett-Rand (halbtransparent)"""
    cv = Canvas(int(r * 2 + 3), int(r * 2 + 3))
    ellipse(cv, cv.w / 2.0, cv.h / 2.0, r, r, ramp, lo=lo, hi=hi, ambient=0.4)
    if semi:
        for y in range(cv.h):
            for x in range(cv.w):
                if cv.alpha(x, y):
                    d = math.hypot(x + 0.5 - cv.w / 2.0, y + 0.5 - cv.h / 2.0) / r
                    if d > 0.62 and (x + y) % 2 == 1:
                        cv.clear_pixel(x, y)
    w.draw(cv, int(cx - cv.w / 2), int(cy - cv.h / 2), key)


def _plume(w, x, y, n=4, r0=3.0, grow=0.7, drift=1.5, ramp='stone', lo=2, hi=4, step=0.95):
    """aufsteigende Rauch-/Dampfsaeule aus ueberlappenden Wolken, nach oben breiter, mit Drift nach rechts"""
    for k in range(n):
        r = r0 + grow * k
        cx = x + drift * k + (1 if k % 2 else -1)
        cy = y - k * r0 * step * 1.5
        cv = Canvas(int(r * 2 + 3), int(r * 2 + 3))
        ellipse(cv, cv.w / 2.0, cv.h / 2.0, r, r, ramp, lo=lo, hi=hi - (1 if k >= n - 1 else 0), ambient=0.4)
        if k >= n - 2:                                   # oben ausfransen
            for yy in range(cv.h):
                for xx in range(cv.w):
                    if cv.alpha(xx, yy) and (xx + yy) % 2 == 1 and math.hypot(xx + 0.5 - cv.w / 2.0, yy + 0.5 - cv.h / 2.0) > r * 0.55:
                        cv.clear_pixel(xx, yy)
        w.draw(cv, int(cx - cv.w / 2), int(cy - cv.h / 2), 8000 + k)


# =========================================================================== UV-12 Cogwheel Centurion (Tor)


@card_art('UV-12')
def _art_uv12():
    w = ground_world('cobble', 12)
    wall_row(w, 0, 144, 36, tall=24)
    gate = wall_piece(40, 24, kind=2)
    w.draw(gate, 52, 36 - gate.h + 1, 36)
    for (sp, x, y) in ((barrel(), 14, 52), (crate(), 130, 52), (crate(), 118, 56)):
        prop_at(w, sp, x, y)
    sp = spr_cogwheel_centurion()
    ox, oy = 44 - sp.w // 2, 84 - sp.h + 1
    unit_at(w, sp, 44, 84, sh=(24, 4))
    mx, my = ox + 55, oy + 25                           # Muendung
    _burst(w, mx + 3, my, 'gold')
    for k in range(3):
        _tracer(w, mx + 8 + k * 2, my - 1 + k * 3 // 2 * 0 + (k - 1) * 3, 112 + k * 2, 66 + (k - 1) * 3 + k, n=7)
    # Eindringlinge laufen in den Beschuss
    unit_at(w, spr_raider('attack', 0), 124, 70, flip=True, sh=(6, 2))
    unit_at(w, spr_raider('walk', 1), 104, 88, flip=True, sh=(6, 2))
    _burst(w, 114, 63, 'fire')
    # Patronenhuelsen am Boden
    dots(w, [(64, 86), (68, 88), (71, 85), (60, 89)], 'gold', 5, key=-30)
    return finish(w)


# =========================================================================== UV-13 Paladin Penguin (Kernkammer)


@card_art('UV-13')
def _art_uv13():
    w = _chamber('slab', 13)
    _wall_decor(w, 34, crest('teamA'), 30)
    _wall_decor(w, 34, window(), 62)
    _wall_decor(w, 34, crest('teamA'), 94)
    cr = core()
    w.draw(cr, 98, 6, 6 + 66 + CELL)
    aura_ring(w, 52, 78, 34, 12, 'gold')
    unit_at(w, spr_paladin_penguin(), 52, 82, sh=(18, 4))
    unit_at(w, citizen('cloth', 1), 96, 86, flip=True, sh=(5, 2))
    sparkle(w, 26, 46, big=True)
    sparkle(w, 78, 42)
    sparkle(w, 20, 64)
    sparkle(w, 84, 62, big=True)
    sparkle(w, 68, 28)
    return finish(w)


# =========================================================================== UV-14 Giant Butler (Kernkammer)


@card_art('UV-14')
def _art_uv14():
    w = _chamber('slab', 14)
    _wall_decor(w, 34, window(), 26)
    _wall_decor(w, 34, crest('teamA'), 54)
    _wall_decor(w, 34, crest('teamA'), 90)
    _wall_decor(w, 34, window(), 118)
    w.draw(rug(60, 26, 'teamA'), 18, 62, -49)
    sp = spr_giant_butler()
    unit_at(w, sp, 62, 88, sh=(16, 4))
    unit_at(w, citizen('ice', 0), 28, 84, sh=(5, 2))
    unit_at(w, citizen('dirt', 1), 22, 74, sh=(5, 2))
    unit_at(w, spr_raider('attack', 0), 100, 84, flip=True, sh=(6, 2))
    unit_at(w, spr_raider('walk', 2), 124, 76, flip=True, sh=(6, 2))
    _burst(w, 82, 62, 'bone')
    return finish(w)


# =========================================================================== UV-15 Tooth Door (Tor)


@card_art('UV-15')
def _art_uv15():
    w = ground_world('cobble', 15)
    base = 74
    wall_row(w, 0, 144, base, tall=36, skip=(54, 90))
    door = spr_tooth_door('gulp')
    shadow(w, 72, base - 1, 20, 4)
    w.draw(door, 54, base - door.h + 1, base)
    prop_at(w, barrel(), 14, 90)
    prop_at(w, crate(), 132, 92)
    unit_at(w, spr_raider('walk', 1), 34, 88, sh=(6, 2))
    unit_at(w, spr_raider('walk', 3), 112, 86, flip=True, sh=(6, 2))
    # Speichel-Tropfen und Zahnklappern
    dots(w, [(70, base + 3), (71, base + 5), (70, base + 7)], 'sky', 4)
    return finish(w)


# =========================================================================== UV-16 Sir Reginald (Kernkammer)


@card_art('UV-16')
def _art_uv16():
    w = _chamber('slab', 16)
    _wall_decor(w, 34, crest('teamA'), 54)
    _wall_decor(w, 34, window(), 124)
    _wall_decor(w, 34, banner_cross(), 108)
    cr = core()
    w.draw(cr, -14, 6, 6 + 66 + CELL)
    aura_ring(w, 18, 78, 32, 11, 'gold')
    unit_at(w, spr_sir_reginald(), 84, 88, sh=(18, 4))
    unit_at(w, spr_raider('attack', 1), 126, 82, flip=True, sh=(6, 2))
    sparkle(w, 52, 50)
    sparkle(w, 108, 56, big=True)
    sparkle(w, 44, 30, big=True)
    return finish(w)


# =========================================================================== UV-17 Janitor Colossus (Mitte)


def _wall_hole(w, x0, base_y):
    """Loch in der Mauer, links schon frisch zugemauert (hellere Steine), rechts noch offen"""
    hole = [(x0 + 2, base_y - 23), (x0 + 11, base_y - 25), (x0 + 22, base_y - 21), (x0 + 24, base_y - 12), (x0 + 20, base_y - 5), (x0 + 4, base_y - 4), (x0, base_y - 12)]
    xs = [p[0] for p in hole]
    ys = [p[1] for p in hole]
    rows = {}
    for y in range(min(ys), max(ys) + 1):
        for x in range(min(xs), max(xs) + 1):
            if point_in_poly(x + 0.5, y + 0.5, hole):
                sub = w.px[y, x, :3].reshape(1, 3)
                if x < x0 + 12:
                    r = (y - (base_y - 25)) // 5
                    off = 5 if r % 2 else 0
                    if (y - (base_y - 25)) % 5 == 4 or (x + off) % 10 == 9:
                        col = RAMPS['stone'][1]
                    elif (y - (base_y - 25)) % 5 == 0:
                        col = RAMPS['stone'][5]
                    else:
                        col = RAMPS['stone'][4 if (x + y) % 9 else 3]
                else:
                    col = RAMPS['coal'][0] if (x + y) % 2 == 0 or y < base_y - 14 else RAMPS['coal'][1]
                w.px[y, x, :3] = col
    # ausgebrochene Kante
    for (x, y) in ((x0 + 22, base_y - 22), (x0 + 24, base_y - 14), (x0 + 12, base_y - 26), (x0 + 1, base_y - 6)):
        w.px[y, x, :3] = RAMPS['stone'][1]
    # Kellen-Linie zwischen frisch und offen
    for y in range(base_y - 24, base_y - 4):
        if w.px[y, x0 + 12, 0] != 0:
            w.px[y, x0 + 12, :3] = RAMPS['gold'][3 if y % 2 else 2]


@card_art('UV-17')
def _art_uv17():
    w = _chamber('planks', 17)
    _wall_decor(w, 34, window(), 24)
    _wall_decor(w, 34, crest('teamA'), 134)
    _wall_hole(w, 98, 34)
    sp = spr_janitor_colossus()
    unit_at(w, sp, 58, 88, sh=(28, 4))
    # Schutt wird gefegt, Staub steigt auf
    for (x, y) in ((100, 86), (108, 90), (114, 84)):
        prop_at(w, rock(x % 3 + 1), x, y)
    for (x, y, r) in ((90, 80, 3), (95, 74, 2.4), (86, 70, 2)):
        _puff(w, x, y, r, 'bone', 3, 5)
    unit_at(w, spr_raider('attack', 2), 128, 72, flip=True, sh=(6, 2))
    # Reparatur-Funken an der Mauer
    sparkle(w, 108, 12, big=True)
    sparkle(w, 100, 28)
    sparkle(w, 118, 24)
    sparkle(w, 20, 54)
    return finish(w)


# =========================================================================== UZ-03 Armorer Dwarf


@card_art('UZ-03')
def _art_uz03():
    w = ground_world('cobble', 3)
    for (sp, x, y) in ((rack(), 124, 40), (barrel(), 16, 38)):
        prop_at(w, sp, x, y)
    aura_ring(w, 68, 78, 46, 14, 'gold')
    unit_at(w, spr_armorer_dwarf(), 64, 82, sh=(12, 3))
    for (kind, x, y, fl, ic) in (('ice', 120, 76, True, 0), ('dirt', 106, 90, True, 1), ('cloth', 28, 74, False, 1)):
        unit_at(w, citizen(kind, ic), x, y, flip=fl, sh=(5, 2))
        shield = shield_icon()
        w.draw(shield, x - 4, y - 32, 9000)
    sparkle(w, 90, 62)
    sparkle(w, 82, 54, big=True)
    return finish(w)


# =========================================================================== UZ-04 Stew Cook


@card_art('UZ-04')
def _art_uz04():
    w = ground_world('dirt', 4)
    for (sp, x, y) in ((barrel(), 14, 38), (crate(), 128, 36), (bush(2), 126, 92)):
        prop_at(w, sp, x, y)
    pot = stew_pot()
    prop_at(w, pot, 98, 72)
    _plume(w, 96, 42, n=5, r0=3.0, grow=0.2, drift=0.8, ramp='bone', lo=3, hi=5)
    unit_at(w, spr_stew_cook(), 58, 82, sh=(14, 3))
    for (kind, x, y, fl) in (('slime', 118, 80, True), ('cloth', 78, 92, True)):
        unit_at(w, citizen(kind, 1), x, y, flip=fl, sh=(5, 2))
        w.draw(heart_icon(), x - 4, y - 30, 9000)
    return finish(w)


# =========================================================================== UZ-05 Fire-Marshal Kobold


def _water_arc(w, x0, y0, x1, y1, lift=18, n=40):
    """Wasserstrahl als Bogen: 2 px dick, helle Kante, Luecken = Tropfen"""
    for k in range(n):
        t = k / float(n - 1)
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t - lift * 4 * t * (1 - t)
        if k % 6 == 5:
            continue
        for (dx, dy, i) in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3), (-1, 0, 4)):
            xx, yy = int(x) + dx, int(y) + dy
            if 0 <= xx < w.w and 0 <= yy < w.h:
                w.px[yy, xx, :3] = RAMPS['sky'][i]
                w.depth[yy, xx] = 9000


@card_art('UZ-05')
def _art_uz05():
    w = ground_world('cobble', 5)
    prop_at(w, barrel(), 14, 38)
    # Pfuetze, Brandkiste, Brandfass
    for (x, y) in ((96, 86), (100, 87), (104, 86), (98, 89), (102, 89), (92, 88), (108, 88)):
        w.px[y, x, :3] = RAMPS['sky'][3 if (x + y) % 2 else 4]
        w.depth[y, x] = -44
    prop_at(w, burning(crate(), 0), 102, 74)
    prop_at(w, burning(barrel(), 1), 122, 80)
    _plume(w, 102, 56, n=5, r0=3.0, grow=0.8, drift=1.2, ramp='stone', lo=1, hi=3)
    _plume(w, 122, 60, n=4, r0=2.6, grow=0.7, drift=1.0, ramp='stone', lo=1, hi=3)
    sp = spr_fire_marshal_kobold()
    kx, ky = 44, 84
    unit_at(w, sp, kx, ky, sh=(13, 3))
    nx, ny = kx - sp.w // 2 + 38, ky - sp.h + 1 + 13               # Brause
    _water_arc(w, nx + 1, ny, 96, 66, lift=16)
    _burst(w, 97, 66, 'ice')
    unit_at(w, citizen('cloth', 0), 20, 86, sh=(5, 2))
    return finish(w)


# =========================================================================== UZ-06 Fanfare Bard


@card_art('UZ-06')
def _art_uz06():
    w = ground_world('dirt', 6)
    for (sp, x, y) in ((tree_round(2), 16, 66), (bush(1), 128, 38), (bush(3, True), 136, 92)):
        prop_at(w, sp, x, y)
    aura_ring(w, 66, 80, 46, 14, 'gold')
    unit_at(w, spr_fanfare_bard(), 56, 82, sh=(12, 3))
    for (kind, x, y, fl, jump) in (('ice', 96, 76, True, 3), ('cloth', 104, 90, True, 0), ('dirt', 106, 66, True, 1)):
        unit_at(w, citizen(kind, 1), x, y - jump, flip=fl, sh=(5, 2))
    for (x, y) in ((70, 32), (84, 20), (98, 38), (112, 24), (78, 50)):
        cv = Canvas(8, 9)
        note(cv, 1, 1)
        cv.outline()
        w.draw(cv, x, y, 9000)
    return finish(w)


# =========================================================================== UZ-07 Professor Moustache


@card_art('UZ-07')
def _art_uz07():
    w = ground_world('planks', 7)
    base = 44
    wall_row(w, 0, 144, base, tall=36)
    w.draw(blackboard(), 44, base - 34 - 2, base + 1)
    for (sp, x, y) in ((plant(), 16, 90), (plant(), 130, 66)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_professor_moustache(), 36, 76, sh=(11, 3))
    for (kind, x, y, fl) in (('ice', 98, 68, True), ('leaf', 118, 78, True)):
        unit_at(w, citizen(kind, 1), x, y, flip=fl, sh=(5, 2))
        w.draw(desk(), x - 11, y - 4, y + 8)
        sparkle(w, x - 1, y - 28)
        sparkle(w, x + 8, y - 22)
    return finish(w)
