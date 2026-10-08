"""Pack art2: Artillerie UA-14 .. UA-18 und Sturm-Einheiten US-04, US-05, US-07 .. US-10 (Sprites in pack_art2_*.py)."""
from __future__ import annotations

from cards_art import *                         # Helfer, ART-Registry, pixl / scenekit / landscape / assets_*
from pack_art2_kit import *
from pack_art2_fx import *
from pack_art2_props import *
from pack_art2_zeppelin import spr_zeppelin
from pack_art2_organ import spr_sky_organ
from pack_art2_wizard import spr_star_wizard
from pack_art2_bertha import spr_big_bertha
from pack_art2_whalecat import spr_whale_catapult, spr_whale_ball
from pack_art2_frog import spr_crossbow_frog
from pack_art2_orc import spr_ram_orc
from pack_art2_goose import spr_goose_rider
from pack_art2_gnome import spr_burrow_gnome
from pack_art2_ghost import spr_poltergeist
from pack_art2_crab import spr_pincer_crab


def _sprite_at(world, spr, cx, cy, key=9000, flip=False):
    """Sprite mit Mittelpunkt (cx, cy) in die Luft legen (immer obenauf)"""
    world.draw(spr, int(cx - spr.w // 2), int(cy - spr.h // 2), key, flip)


# --------------------------------------------------------------------------- UA-14 Brummzeppelin


@card_art('UA-14')
def _art_ua14():
    w = ground_world('grass', 3)
    for (sp, x, y) in ((tree_pine(1), 14, 46), (bush(2), 130, 42), (rock(1), 124, 90), (bush(1, True), 16, 90)):
        prop_at(w, sp, x, y)
    blob_shadow(w, 76, 68, 28, 6)
    # zwei Bomben fallen aus der Gondel, Ziel jeweils markiert
    for (bx, by, tx, ty) in ((62, 58, 60, 82), (86, 66, 88, 84)):
        zielschatten(w, tx, ty, 9, 1)
        for k in range(1, 5):
            wpix(w, bx, by - 8 - k * 3, 'bone', 4 if k < 3 else 3)
            wpix(w, bx, by - 9 - k * 3, 'bone', 3)
        _sprite_at(w, spr_zep_bomb(), bx, by)
    _sprite_at(w, spr_zeppelin('drop', 0), 72, 30)
    return finish(w)


# --------------------------------------------------------------------------- UA-15 Himmelsorgel


def _cloud_puff(rx, seed):
    c = Canvas(int(rx * 2 + 6), int(rx * 0.9 + 8))
    puff(c, c.w / 2, c.h / 2 + 1, rx, 'fur', 2, 5, seed)
    c.outline(dark=1, lit=4)
    return c


@card_art('UA-15')
def _art_ua15():
    w = ground_world('cloud', 4)
    for (r, x, y, s) in ((14, 16, 90, 1), (11, 134, 36, 2), (9, 126, 90, 3)):
        sp = _cloud_puff(r, s)
        prop_at(w, sp, x, y)
    # Strahl von oben auf die Zielzelle
    tx, ty = 110, 74
    light_beam(w, tx, 0, ty, 8, 20)
    zielschatten(w, tx, ty, 13, 1)
    sparkles(w, [(tx - 12, ty - 8), (tx + 13, ty - 12), (tx + 6, ty - 20)])
    unit_at(w, spr_sky_organ(), 48, 86, sh=(24, 4))
    # Engelschor im Hintergrund auf Wolken
    for (ax, ay) in ((18, 40), (30, 26), (66, 24), (78, 38)):
        cp = _cloud_puff(8, ax)
        w.draw(cp, ax - cp.w // 2, ay + 8, 3)
        w.draw(spr_angel(), ax - 8, ay - 8, 4)
    return finish(w)


# --------------------------------------------------------------------------- UA-16 Sternschnuppen-Zauberer


@card_art('UA-16')
def _art_ua16():
    w = ground_world('grass', 5)
    for (sp, x, y) in ((bush(2, True), 14, 48), (tree_pine(2), 134, 58), (rock(2), 126, 92)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_star_wizard(), 32, 86, sh=(11, 3))
    # Meteor mit Schweif faellt auf die markierte Zelle
    tx, ty = 112, 76
    zielschatten(w, tx, ty, 17, 1)
    hx, hy = 98, 42
    fire_tail(w, hx, hy, 14, 34, 50, 17, seed=3)
    _sprite_at(w, spr_meteor(), hx, hy)
    sparkles(w, [(48, 30), (54, 38), (42, 22)], key=9100)
    for (x, y) in ((tx - 20, ty + 4), (tx + 20, ty - 2), (tx + 4, ty + 17)):
        spark(w, x, y, 'fire')
    return finish(w)


# --------------------------------------------------------------------------- UA-17 Dicke Berta


@card_art('UA-17')
def _art_ua17():
    w = ground_world('dirt', 4)
    for (sp, x, y) in ((tree_pine(0), 12, 40), (rock(1), 20, 92), (bush(3), 128, 92)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_big_bertha(), 40, 86, sh=(30, 4))
    mx, my = 69, 49                                    # Muendung (Weltkoordinaten)
    # Muendungsfeuer + Rauch, Granate fliegt flach nach rechts durch drei Steinplatten
    burst(w, mx + 4, my - 1, 7)
    dust(w, mx - 2, my - 11, 7, 'stone', 3, 5, seed=2, key=9050)
    dust(w, mx + 5, my - 14, 5, 'stone', 3, 5, seed=3, key=9050)
    wy = 66                                            # Fusspunkt der Platten: Loecher auf Hoehe der Granate
    prop_at(w, spr_slab(2), 96, wy)
    prop_at(w, spr_slab(1), 114, wy)
    prop_at(w, spr_slab(0), 131, wy)
    for k in range(0, 26):                             # Schweif der Granate
        wpix(w, 80 + k, my + (0 if k % 3 else 1), 'bone', 3 if k < 10 else 4 if k < 20 else 5, 9000)
    _sprite_at(w, spr_shell(), 114, my - 1, key=9200)
    for (i, (x, y)) in enumerate(((100, 44), (104, 56), (108, 38), (101, 62), (120, 40), (122, 54))):
        w.draw(spr_chunk(i), x, y, 9100)
    return finish(w)


# --------------------------------------------------------------------------- UA-18 Walfisch-Katapult


@card_art('UA-18')
def _art_ua18():
    w = ground_world('grass', 6)
    for (sp, x, y) in ((tree_round(1), 128, 46), (bush(1), 130, 92), (rock(2), 16, 94)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_whale_catapult(), 40, 88, sh=(28, 4))
    tx, ty = 112, 78
    # Pfuetze + Zielmarke, der Wal fliegt im Bogen und verliert Wasser
    for yy in range(ty - 6, ty + 7):
        for xx in range(tx - 15, tx + 16):
            d = ((xx - tx) / 15.0) ** 2 + ((yy - ty) / 6.0) ** 2
            if d < 1.0 and w.depth[yy, xx] < -40:
                w.px[yy, xx, :3] = RAMPS['sky'][3 if (xx + yy) % 2 and d > 0.5 else 4]
    zielschatten(w, tx, ty, 17, 1)
    arc_dots(w, (36, 48), (tx, ty - 6), 40, n=16, ramp='sky', idx=5, skip=2)
    _sprite_at(w, spr_whale_ball(), 84, 24, key=9200)
    drops(w, [(70, 30), (66, 36), (60, 32), (74, 38), (62, 42), (80, 36), (56, 38), (68, 44)])
    drops(w, [(tx - 8, ty - 12), (tx + 6, ty - 16), (tx + 12, ty - 9), (tx - 14, ty - 5)], idx=4)
    return finish(w)


# --------------------------------------------------------------------------- US-04 Armbrustfrosch


def _pond_ground(seed, ponds):
    wd = ground_world('grass', seed)
    rng = random.Random(seed)
    G, water, pathm = make_ground(WIN_W, WIN_H, seed, [], ponds)
    scatter_ground_decals(G, rng, int(WIN_W * WIN_H / 90), water | pathm)
    wd.px[:, :, :3] = G
    return wd


@card_art('US-04')
def _art_us04():
    w = _pond_ground(2, [(104, 62, 34, 16)])
    for (sp, x, y) in ((tree_pine(1), 14, 44), (bush(2, True), 134, 34), (rock(3), 18, 92)):
        prop_at(w, sp, x, y)
    for (x, y, s) in ((96, 60, 1), (118, 70, 2), (84, 70, 3)):
        w.draw(lily(s), x - 7, y - 4, 20)
    # Frosch 1 im Sprung (Schatten am Boden darunter), Frosch 2 geduckt und schiessend
    blob_shadow(w, 50, 80, 12, 3)
    w.draw(spr_crossbow_frog('idle'), 50 - 18, 44 - 8, 900)
    for k in range(7):
        wpix(w, 14 + k * 5, 76 - int(18 * 4 * (k / 7.0) * (1 - k / 7.0)), 'bone', 4)
    unit_at(w, spr_crossbow_frog('crouch'), 92, 86, sh=(12, 3))
    for k in range(8):
        wpix(w, 112 + k * 3, 74, 'bone', 5 if k % 2 else 4)
    return finish(w)


# --------------------------------------------------------------------------- US-05 Rammbock-Ork


@card_art('US-05')
def _art_us05():
    w = ground_world('dirt', 3)
    for (sp, x, y) in ((tree_pine(2), 14, 42), (rock(1), 18, 92), (bush(2), 130, 92)):
        prop_at(w, sp, x, y)
    gate = spr_cracked_gate()
    prop_at(w, gate, 118, 74)
    unit_at(w, spr_ram_orc(), 56, 86, sh=(22, 4))
    speed_lines(w, 22, 62, n=3, length=11, seed=2, ramp='bone', idx=4)
    dust(w, 28, 84, 6, 'dirt', 3, 5, seed=1)
    for (i, (x, y)) in enumerate(((102, 30), (96, 44), (100, 58), (108, 24), (92, 52))):
        w.draw(spr_splinter(i), x, y, 9100)
    return finish(w)


# --------------------------------------------------------------------------- US-07 Reitgans-Goblin


@card_art('US-07')
def _art_us07():
    w = ground_world('grass', 4)
    for (sp, x, y) in ((bush(2), 130, 40), (tree_pine(0), 12, 40), (rock(2), 126, 92)):
        prop_at(w, sp, x, y)
    pit_spr = pit()
    prop_at(w, pit_spr, 72, 76)
    blob_shadow(w, 68, 82, 18, 4)
    w.draw(spr_goose_rider(), 72 - 30, 50 - 48 + 4, 900)
    arc_dots(w, (22, 80), (118, 80), 44, n=20, ramp='bone', idx=4, skip=2)
    dust(w, 22, 84, 5, 'dirt', 3, 5, seed=1)
    for (x, y) in ((34, 30), (28, 40), (40, 24)):
        wpix(w, x, y, 'bone', 5, 9000)
        wpix(w, x + 1, y + 1, 'bone', 4, 9000)
    return finish(w)


# --------------------------------------------------------------------------- US-08 Wuehl-Gnom


@card_art('US-08')
def _art_us08():
    w = ground_world('cobble', 5)
    # Aussenmauer oben, Hof darunter
    wall = stone_wall_piece(144)
    w.draw(wall, 0, 20 - wall.h + 1, 20)
    shadow(w, 72, 24, 70, 3)
    for (sp, x, y) in ((barrel(), 16, 52), (crate(), 128, 54)):
        prop_at(w, sp, x, y)
    # Maulwurfsspur im Hof zum Loch
    for (x, y, b) in ((30, 34, 0), (44, 44, 0), (58, 54, 1)):
        prop_at(w, spr_molehill(b), x, y)
    hole = spr_dirt_hole()
    w.draw(hole, 88 - 17, 74 - 9, 74)
    w.draw(spr_burrow_gnome(), 88 - 15, 76 - 38, 76)
    w.draw(spr_dirt_lip(), 88 - 17, 74 - 1, 80)
    speed_lines(w, 76, 42, n=0)
    for (i, (x, y)) in enumerate(((72, 52), (110, 48), (78, 40), (104, 60), (66, 62), (116, 66))):
        w.draw(spr_chunk(i), x, y, 9100)
    unit_at(w, citizen('cloth', 1), 122, 84, flip=True, sh=(5, 2))
    return finish(w)


# --------------------------------------------------------------------------- US-09 Rumpelgeist


def _rot90(spr, k=1):
    c = Canvas(spr.h, spr.w) if k % 2 else Canvas(spr.w, spr.h)
    c.px = np.rot90(spr.px, k).copy()
    c.rid = np.rot90(spr.rid, k).copy()
    return c


@card_art('US-09')
def _art_us09():
    w = ground_world('slab', 4)
    wall = stone_wall_piece(144)
    w.draw(wall, 0, 38 - wall.h + 1, 38)
    shadow(w, 72, 42, 70, 3)
    unit_at(w, spr_poltergeist(), 60, 80, sh=(10, 3))
    # fliegende Gegenstaende
    w.draw(_rot90(barrel(), 1), 98, 46, 9000)
    w.draw(_rot90(crate(), 3), 18, 52, 9000)
    speed_lines(w, 114, 56, n=2, length=8, seed=3)
    speed_lines(w, 36, 62, n=2, length=8, seed=4)
    unit_at(w, citizen('dirt', 1), 120, 86, flip=True, sh=(5, 2))
    return finish(w)


# --------------------------------------------------------------------------- US-10 Zangen-Panzerkrebs


@card_art('US-10')
def _art_us10():
    w = ground_world('sand', 3)
    for (sp, x, y) in ((rock(3), 16, 46), (rock(1), 128, 44), (bush(2), 132, 92), (rock(2, True), 14, 94)):
        prop_at(w, sp, x, y)
    cx, cy = 54, 84
    unit_at(w, spr_pincer_crab(), cx, cy, sh=(26, 4))
    # ein Buerger haengt im Schluesselring
    rx, ry = cx - 28 + 47, cy - 39 + 11
    cit = citizen('cloth', 0)
    w.draw(cit, rx - 8, ry - 12, cy + 1)
    return finish(w)
