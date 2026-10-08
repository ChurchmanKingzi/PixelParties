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
    for (sp, x, y) in ((bush(2), 18, 38), (rock(2), 12, 91), (bush(1, True), 70, 30)):
        prop_at(w, sp, x, y)
    spr = spr_spark_mage()
    unit_at(w, spr, 40, 80)
    ox, oy = _origin(spr, 40, 80)
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


# =========================================================================== UA-03 Zwergen-Donnerbüchse


@card_art('UA-03')
def _art_ua03():
    w = ground_world('cobble', 4)
    for (sp, x, y) in ((barrel(), 16, 36), (crate(), 134, 30), (rock(1), 12, 92)):
        prop_at(w, sp, x, y)
    spr = spr_dwarf_blunderbuss()
    unit_at(w, spr, 40, 80, sh=(13, 3))
    ox, oy = _origin(spr, 40, 80)
    mx, my = ox + 40, oy + 5                              # Mündung
    # angeschlagene Mauer als Ziel: Risse, Brocken, Staub
    wall = stone_wall_piece(46, 24)
    zielschatten(w, 118, 82, 15, 1)
    shadow(w, 120, 66, 26, 3)
    w.draw(wall, 96, 66 - wall.h + 1, 66)
    crack_lines(w, [(108, 45), (111, 49), (109, 53), (113, 58), (112, 63)], 9000)
    crack_lines(w, [(122, 46), (120, 51), (124, 55), (123, 61)], 9000)
    crack_lines(w, [(111, 49), (116, 50)], 9000)
    for (x, y) in ((98, 69), (138, 69)):
        put(w, rock(1), x, y, 9000)
    # Mündungsfeuer + Qualm + Streuschuss (Kügelchen fächern auf)
    burst(w, mx + 5, my, 'fire', 10, 7, 4)
    w.draw(smoke_sprite(26, 14, 4, 3), mx - 2, my - 24, 9000)
    for k in range(13):                                   # Streuschuss: Kügelchen fächern kegelförmig auf
        d = 12 + k * 3.7
        off = ((k * 5) % 7 - 3) / 3.0 * d * 0.26
        x, y = mx + 6 + d, my + 2 + d * 0.10 + off
        pl = pellet(4 if k < 7 else 3)
        w.draw(pl, int(x - pl.w // 2), int(y - pl.h // 2), 9000)
    for (x, y) in ((96, 52), (98, 56), (97, 60), (95, 48), (100, 50)):
        burst(w, x, y, 'gold', 5, 3, x + y)
    return finish(w)


# =========================================================================== UA-04 Goblin-Kanone


@card_art('UA-04')
def _art_ua04():
    w = ground_world('mud', 2)
    for (sp, x, y) in ((tree_pine(1), 130, 46), (bush(3), 14, 36), (rock(1), 96, 38)):
        prop_at(w, sp, x, y)
    spr = spr_goblin_cannon()
    unit_at(w, spr, 38, 82, sh=(22, 4))
    ox, oy = _origin(spr, 38, 82)
    mx, my = ox + 44, oy + 10                              # Mündung (der kleine Goblin guckt heraus)
    w.draw(smoke_sprite(24, 14, 9, 3), mx + 6, my - 26, 9000)
    pts = arc_pts(mx + 8, my - 2, 112, 76, 40, 14)
    zielschatten(w, 112, 78, 15, 2)
    trail(w, pts[1:7], 'bone', 1, 2, 5, 3)
    gp = pts[8]
    put(w, proj_goblin(), gp[0], gp[1], 9100)
    # schon gelandeter Goblin + erschrockener Bürger am Ziel
    unit_at(w, mini_goblin(0), 128, 84, flip=True, sh=(6, 2))
    unit_at(w, citizen('cloth', 1), 98, 72, sh=(5, 2))
    for (x, y) in ((108, 60), (120, 66), (126, 70)):
        burst(w, x, y, 'gold', 4, 3, x)
    return finish(w)


# =========================================================================== UA-05 Ork-Kanone


@card_art('UA-05')
def _art_ua05():
    w = ground_world('sand', 5)
    for (sp, x, y) in ((cactus(1), 132, 46), (rock(1), 136, 90), (cactus(2), 14, 40)):
        prop_at(w, sp, x, y)
    spr = spr_orc_cannon()
    unit_at(w, spr, 36, 86, sh=(26, 4))
    ox, oy = _origin(spr, 36, 86)
    mx, my = ox + 51, oy + 13                              # Mündung
    w.draw(smoke_sprite(24, 16, 11, 3), mx + 8, my - 20, 9000)
    pts = arc_pts(mx + 8, my - 4, 114, 80, 28, 14)
    zielschatten(w, 114, 82, 17, 2)
    trail(w, pts[1:7], 'bone', 1, 2, 5, 3)
    op = pts[8]
    put(w, proj_orc(), op[0], op[1], 9100)
    put(w, shout_bubble(), op[0] + 19, op[1] - 13, 9200)
    for (x, y) in ((mx + 4, my - 2),):
        burst(w, x, y, 'fire', 10, 7, 3)
    return finish(w)


# =========================================================================== UA-06 Eiszapfen-Mörser


@card_art('UA-06')
def _art_ua06():
    w = ground_world('snow', 6)
    for (sp, x, y) in ((tree_pine(0), 12, 44), (tree_pine(1), 132, 42), (rock(2), 20, 92)):
        prop_at(w, sp, x, y)
    spr = spr_icicle_mortar()
    unit_at(w, spr, 40, 88, sh=(20, 4))
    ox, oy = _origin(spr, 40, 88)
    fx_, fy_ = ox + 36, oy + 27                              # Trichtermitte
    # weitere Zapfen fliegen senkrecht hoch / fallen auf das Ziel
    for (x, y0, y1) in ((fx_ - 6, fy_ - 24, fy_ - 46), (fx_ + 8, fy_ - 28, fy_ - 54), (fx_ + 22, fy_ - 20, fy_ - 38)):
        icicle_at(w, x, y0, x + 1, y1, 6, 9000)
    zielschatten(w, 112, 78, 17, 1)
    # Frostfläche auf dem Boden am Ziel
    for y in range(60, 94):
        for x in range(92, 134):
            d = math.hypot((x - 112) / 21.0, (y - 78) / 15.0)
            if d < 1.0 and w.depth[y, x] < -40 and ((x + y) % 2 == 0 or d < 0.6):
                w.px[y, x, :3] = RAMPS['ice'][5 if d < 0.45 and (x + y) % 3 == 0 else 4]
    zielschatten(w, 112, 78, 17, 1)
    for (x, y, h) in ((100, 82, 14), (110, 86, 18), (122, 82, 13), (116, 74, 10)):
        w.draw(icicle_shape(h, 5), x - 2, y - h + 1, y)
    for (x0, y0, x1, y1) in ((104, 14, 107, 54), (118, 8, 120, 50), (127, 22, 125, 58)):
        icicle_at(w, x0, y0, x1, y1, 6, 9000)
    for (x, y) in ((107, 60), (120, 56), (112, 68), (126, 64)):
        burst(w, x, y, 'ice', 6, 4, x)
    return finish(w)


# =========================================================================== UA-07 Sporenschleuder


@card_art('UA-07')
def _art_ua07():
    w = ground_world('grass', 4)
    for (sp, x, y) in ((giant_mushroom(2, 'fire'), 130, 40), (bush(2, True), 14, 38)):
        prop_at(w, sp, x, y)
    spr = spr_spore_slinger()
    unit_at(w, spr, 38, 88, sh=(20, 4))
    ox, oy = _origin(spr, 38, 88)
    mx, my = ox + 49, oy + 13
    pts = arc_pts(mx + 6, my - 2, 108, 72, 30, 14)
    for k, (x, y) in enumerate(pts[2:12]):
        dot_world(w, x, y, 'leaf', 5 if k % 2 else 4, 3 if k % 3 == 0 else 2, 9000)
        put_px(w, x + 2, y - 2, 'goblin', 5, 9001)
    zielschatten(w, 110, 80, 17, 1)
    w.draw(spore_cloud(46, 30, 3), 87, 58, 60)                       # Wolke hinter den Bürgern
    unit_at(w, citizen('cloth', 0), 100, 82, sh=(5, 2))
    unit_at(w, citizen('dirt', 1), 122, 78, flip=True, sh=(5, 2))
    w.draw(spore_cloud(30, 14, 8), 96, 74, 9300)                     # dünner Schleier davor
    for (x, y) in ((98, 70), (118, 66), (108, 62), (124, 72), (104, 88), (116, 86)):
        put_px(w, x, y, 'leaf', 5, 9400)
        put_px(w, x + 1, y, 'goblin', 5, 9400)
    for (x, y) in ((102, 70), (120, 72)):                            # Husten
        for (dx, dy) in ((0, 0), (2, -1), (4, 0), (1, -3), (3, -3)):
            put_px(w, x + dx, y + dy, 'bone', 5, 9500)
    return finish(w)


# =========================================================================== UA-08 Kalmar-Kanone


@card_art('UA-08')
def _art_ua08():
    w = ground_world('grass', 6)
    for (sp, x, y) in ((tree_round(2), 134, 38), (bush(3), 12, 36), (rock(2), 128, 92)):
        prop_at(w, sp, x, y)
    spr = spr_squid_cannon()
    unit_at(w, spr, 36, 86, sh=(22, 4))
    ox, oy = _origin(spr, 36, 86)
    sx, sy = ox + 54, oy + 20                                 # Tintenstrahl-Ende am Sprite
    # Pfeilturm (Gegner) mit Tintenspritzern: Blendung
    tw = arrow_tower('teamB')
    zielschatten(w, 112, 88, 16, 1)
    unit_at(w, tw, 112, 84, sh=(15, 4))
    tx, ty = _origin(tw, 112, 84)
    # fliegende Tintentropfen (flach, wird schmaler)
    rnd = random.Random(8)
    for k in range(9):
        t = k / 8.0
        x = sx + 6 + t * (tx + 6 - sx - 6)
        y = sy + 4 + t * (ty + 34 - sy - 4) - 16 * t * (1 - t)
        r = 3.2 - 1.4 * t + rnd.uniform(-0.4, 0.4)
        put(w, ink_blob(max(1.2, r), 10 + k), x, y, 9000)
    for (dx, dy, r) in ((8, 14, 4), (19, 20, 3), (14, 28, 3), (24, 34, 2), (6, 36, 2), (20, 10, 2)):
        put(w, ink_blob(r, dx + dy), tx + dx, ty + dy, 9200)
    for (x, y) in ((100, 56), (126, 50), (132, 64)):
        put_px(w, x, y, 'coal', 1, 9300)
        put_px(w, x + 1, y, 'purple', 2, 9300)
    for (x, y) in ((tx + 8, ty + 2), (tx + 28, ty + 4), (tx + 18, ty - 2)):               # Blendung: Sternchen
        for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
            put_px(w, x + dx, y + dy, 'gold', i, 9400)
    return finish(w)


# =========================================================================== UA-09 Fledermaus-Hexe


@card_art('UA-09')
def _art_ua09():
    w = ground_world('dark', 3)
    for (sp, x, y) in ((tombstone(0), 14, 40), (dead_tree(1), 132, 46), (tombstone(1), 26, 93), (tombstone(0), 136, 90)):
        prop_at(w, sp, x, y)
    spr = spr_bat_witch()
    shadow(w, 42, 86, 17, 3)
    w.draw(spr, 6, 18, 60)                                   # schwebt über dem Boden
    # Zielgebiet 3x3: mehrere Zielmarken, Fledermäuse stürzen darauf
    zones = ((98, 66, 6), (124, 60, 6), (110, 84, 6), (134, 80, 5))
    for (x, y, r) in zones:
        zielschatten(w, x, y, r, 1)
    for k, (x, y, r) in enumerate(zones):
        b = bat_spr(k % 2, big=(k % 2 == 0))
        bx, by = x - 4, y - 14
        put(w, b, bx, by, 9100)
        for j in range(1, 4):
            put_px(w, bx - 8 + j * 2, by - 6 + j * 3, 'purple', 4, 9000)
    for (x, y, fl) in ((84, 48, 0), (84, 70, 1), (70, 60, 0)):
        put(w, mini_bat(fl), x, y, 9050)
    unit_at(w, citizen('cloth', 1), 114, 72, flip=True, sh=(5, 2))
    return finish(w)


# =========================================================================== UA-10 Nagelbrett-Ballista


@card_art('UA-10')
def _art_ua10():
    w = ground_world('planks', 5)
    for (sp, x, y) in ((barrel(), 14, 34), (rack(), 132, 32), (crate(), 134, 92)):
        prop_at(w, sp, x, y)
    spr = spr_nailboard_ballista('fire')
    unit_at(w, spr, 34, 86, sh=(26, 4))
    ox, oy = _origin(spr, 34, 86)
    by = oy + 20                                              # Höhe des geladenen Bolzens
    zielschatten(w, 86, 82, 15, 1)
    # drei Barrikaden (Zellen) hintereinander: Einschussloch wird kleiner (-20 % je Zelle)
    fy = by + 28
    for k, (x, hole) in enumerate(((64, 4.2), (86, 3.4), (108, 2.6))):
        bar = barricade(hole)
        prop_at(w, bar, x, fy)
        hy = fy - bar.h + 1 + bar.h // 3 + 1
        for (dx, dy) in ((11, -5), (12, 3), (10, 7)):
            put_px(w, x + dx, hy + dy, 'wood', 5, 9300)
            put_px(w, x + dx + 1, hy + dy, 'wood', 3, 9300)
        burst(w, x + 11, hy, 'gold', 6, 4, x)
    hy = fy - 38 + 1 + 38 // 3 + 1
    bolt = proj_bolt()
    put(w, bolt, 122, hy, 9200)
    for k in range(7):
        put_px(w, 100 - k * 3, hy, 'bone', 3 if k > 3 else 5, 9100)
    return finish(w)


# =========================================================================== UA-11 Blitzspulen-Hexe


@card_art('UA-11')
def _art_ua11():
    w = ground_world('slab', 4)
    for (sp, x, y) in ((anvil(), 16, 36), (barrel(), 132, 34), (crate(), 132, 92)):
        prop_at(w, sp, x, y)
    spr = spr_coil_witch()
    unit_at(w, spr, 30, 85, sh=(15, 4))
    ox, oy = _origin(spr, 30, 85)
    tip = (ox + 40, oy + 19)                                   # Stabkugel
    g1 = guard('idle', 0)
    g2 = guard('idle', 1)
    sk = skeleton('idle', 1)
    unit_at(w, g1, 80, 80, flip=True, team_swap=True)
    unit_at(w, sk, 106, 66, flip=True)
    unit_at(w, g2, 126, 86, flip=True, team_swap=True)
    c1, c2, c3 = (78, 66), (105, 54), (124, 71)               # Körpermitten der Ziele
    lightning(w, [tip, c1], 3)
    lightning(w, [c1, c2], 5)
    lightning(w, [c2, c3], 8)
    for (x, y, r) in ((c1[0], c1[1], 5), (c2[0], c2[1], 4), (c3[0], c3[1], 5)):
        burst(w, x, y, 'gold', 8, r + 2, x, 9900)
    burst(w, tip[0], tip[1], 'ice', 8, 6, 2, 9900)
    for (x, y) in ((86, 54), (122, 58), (72, 76), (110, 78)):                 # Funken (Kurzschluss)
        put_px(w, x, y, 'gold', 5, 9800)
        put_px(w, x + 1, y + 1, 'ice', 5, 9800)
    return finish(w)


# =========================================================================== UA-12 Maulwurf-Mörser


@card_art('UA-12')
def _art_ua12():
    w = ground_world('dirt', 3)
    for (sp, x, y) in ((rock(2), 16, 40), (bush(1), 132, 34), (crate(), 14, 92)):
        prop_at(w, sp, x, y)
    spr = spr_mole_mortar()
    unit_at(w, spr, 34, 80, sh=(18, 4))
    # Rumpeln am Mörser: Erschütterungslinien
    for (x0, y0, x1, y1) in ((48, 82, 53, 84), (50, 78, 55, 79), (14, 82, 9, 84)):
        for t in range(6):
            put_px(w, x0 + (x1 - x0) * t / 5.0, y0 + (y1 - y0) * t / 5.0, 'dirt', 5, 9000)
    # unterirdische Bohrspur: Erdhügel von der Kanone zur Mauer, werden niedriger
    xs = (62, 72, 83, 94, 104)
    for k, x in enumerate(xs):
        y = 80 - k * 1.6
        m = dirt_mound(16 - k, 7 - k // 2, k + 2)
        shadow(w, x + 1, y + 1, 7, 2)
        w.draw(m, int(x - m.w // 2), int(y - m.h + 1), int(y) + 20)
    # Mauer als Ziel (Bauteil) mit Riss, darunter das aufbrechende Bohrloch
    wall = stone_wall_piece(40, 24)
    shadow(w, 124, 68, 24, 3)
    w.draw(wall, 104, 66 - wall.h + 1, 66)
    crack_lines(w, [(118, 40), (120, 46), (117, 51), (121, 57), (119, 64)], 9000)
    crack_lines(w, [(132, 44), (129, 50), (133, 56)], 9000)
    crack_lines(w, [(120, 46), (126, 47)], 9000)
    zielschatten(w, 120, 78, 14, 1)
    hole = Canvas(20, 8)
    ellipse(hole, 10, 4, 9.5, 3.6, 'dirt', lo=1, hi=4)
    ellipse(hole, 10, 4.4, 7, 2.4, 'coal', lo=0, hi=1)
    hole.outline()
    w.draw(hole, 110, 72, 70)
    dr = drill_proj()
    w.draw(dr, 114, 56, 9000)
    for (x, y) in ((106, 66), (126, 64), (130, 72), (108, 76), (118, 52), (112, 60), (124, 58)):
        put_px(w, x, y, 'dirt', 5, 9100)
        put_px(w, x + 1, y + 1, 'dirt', 3, 9100)
    return finish(w)


# =========================================================================== UA-13 Frosch-Katapult


@card_art('UA-13')
def _art_ua13():
    w = ground_world('purple', 4)
    for (sp, x, y) in ((giant_mushroom(3, 'purple'), 132, 44), (rock(1), 16, 40)):
        prop_at(w, sp, x, y)
    spr = spr_frog_catapult('fire')
    unit_at(w, spr, 38, 86, sh=(24, 4))
    ox, oy = _origin(spr, 38, 86)
    sx, sy = ox + 60, oy + 20                                  # Zungenspitze
    pts = arc_pts(sx + 6, sy - 2, 106, 76, 40, 14)
    trail(w, pts[1:6], 'slime', 1, 2, 5, 3)
    put(w, slime_ball(), pts[7][0], pts[7][1], 9100)
    zielschatten(w, 106, 78, 16, 1)
    # Verwandlung: Frösche hüpfen am Ziel, ein Bürger wird gerade zum Frosch
    unit_at(w, citizen('cloth', 0), 96, 80, sh=(5, 2))
    w.draw(mini_frog(0, 0), 108, 72, 90)
    w.draw(mini_frog(1, 5), 118, 60, 91)
    w.draw(mini_frog(0, 0), 120, 82, 92)
    for (x, y, c_) in ((100, 66, 'slime'), (112, 62, 'gold'), (118, 74, 'slime'), (128, 70, 'gold'), (94, 70, 'gold'), (104, 58, 'slime')):
        burst(w, x, y, c_, 5, 3, x + y, 9500)
    return finish(w)
