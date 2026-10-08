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
    blob_shadow(w, 76, 64, 30, 6, steps=3)
    # zwei Bomben fallen aus der Gondel, Ziel jeweils markiert
    for (bx, by, tx, ty) in ((62, 58, 60, 82), (88, 66, 90, 84)):
        zielschatten(w, tx, ty, 9, 1)
        for k in range(1, 5):
            wpix(w, bx, by - 8 - k * 3, 'bone', 5 if k < 3 else 4)
            wpix(w, bx, by - 9 - k * 3, 'bone', 4)
            wpix(w, bx + 1, by - 8 - k * 3, 'bone', 3)
        _sprite_at(w, spr_zep_bomb(), bx, by)
    _sprite_at(w, spr_zeppelin('drop', 0), 76, 30)
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
    for (r, x, y, s) in ((14, 16, 90, 1), (11, 134, 36, 2), (9, 138, 92, 3)):
        prop_at(w, _cloud_puff(r, s), x, y)
    # Strahl von oben auf die Zielzelle
    tx, ty = 110, 74
    light_beam(w, tx, 0, ty, 8, 20)
    zielschatten(w, tx, ty, 13, 1)
    sparkles(w, [(tx - 12, ty - 8), (tx + 13, ty - 12), (tx + 6, ty - 20)])
    unit_at(w, spr_sky_organ(), 48, 86, sh=(24, 4))
    # Engelschor im Hintergrund auf Wolken
    for (ax, ay) in ((16, 42), (30, 26), (84, 26), (94, 44)):
        cp = _cloud_puff(8, ax)
        w.draw(cp, ax - cp.w // 2, ay + 8, 3)
        w.draw(spr_angel(), ax - 8, ay - 8, 4)
    return finish(w)


# --------------------------------------------------------------------------- UA-16 Sternschnuppen-Zauberer


@card_art('UA-16')
def _art_ua16():
    w = ground_world('grass', 5)
    for (sp, x, y) in ((bush(2, True), 14, 48), (tree_pine(2), 134, 58), (rock(2), 80, 94)):
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
    mx, my = 69, 47                                    # Muendung (Weltkoordinaten)
    # Muendungsfeuer + Rauchfahne, Granate fliegt flach nach rechts durch drei Steinplatten
    burst(w, mx + 5, my, 7)
    dust(w, mx + 1, my - 8, 4, 'stone', 3, 4, seed=2, key=9050, outline=False)
    dust(w, mx + 5, my - 15, 5, 'stone', 3, 4, seed=3, key=9050, outline=False)
    dust(w, mx + 10, my - 23, 6, 'stone', 3, 4, seed=4, key=9050, outline=False)
    wy = 66                                            # Fusspunkt der Platten: Loecher auf Hoehe der Granate
    prop_at(w, spr_slab(2), 94, wy)
    prop_at(w, spr_slab(1), 112, wy)
    prop_at(w, spr_slab(0), 130, wy)
    for k in range(0, 26):                             # Schweif der Granate
        wpix(w, 82 + k, my + (0 if k % 3 else 1), 'bone', 3 if k < 10 else 4 if k < 20 else 5, 9000)
    _sprite_at(w, spr_shell(), 112, my - 1, key=9200)
    for (i, (x, y)) in enumerate(((96, 40), (102, 52), (104, 34), (98, 58), (120, 38), (121, 54))):
        w.draw(spr_chunk(i), x, y, 9100)
    return finish(w)


# --------------------------------------------------------------------------- UA-18 Walfisch-Katapult


@card_art('UA-18')
def _art_ua18():
    w = ground_world('grass', 6)
    for (sp, x, y) in ((tree_round(1), 128, 46), (bush(1), 136, 40), (rock(2), 94, 92)):
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
    arc_dots(w, (36, 48), (tx, ty - 6), 40, n=16, ramp='bone', idx=5, skip=2)
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
    w = _pond_ground(2, [(34, 26, 32, 15)])
    for (sp, x, y) in ((tree_pine(1), 132, 52), (bush(2, True), 136, 92), (rock(3), 16, 92)):
        prop_at(w, sp, x, y)
    for (x, y, s) in ((24, 24, 1), (44, 32, 2), (36, 18, 3)):
        w.draw(lily(s), x - 7, y - 4, 20)
    prop_at(w, duck(), 52, 26)
    # Frosch 1 im Sprung (Schatten am Boden), Frosch 2 geduckt und schiessend
    blob_shadow(w, 62, 84, 12, 3)
    w.draw(spr_crossbow_frog('idle'), 62 - 18, 50 - 17, 900)
    arc_dots(w, (20, 84), (104, 84), 38, n=20, ramp='bone', idx=4, skip=2)
    unit_at(w, spr_crossbow_frog('crouch'), 104, 88, sh=(12, 3))
    for k in range(9):
        wpix(w, 122 + k * 2, 77, 'bone', 5 if k % 2 else 4)
    return finish(w)


# --------------------------------------------------------------------------- US-05 Rammbock-Ork


@card_art('US-05')
def _art_us05():
    w = ground_world('dirt', 3)
    for (sp, x, y) in ((tree_pine(2), 14, 42), (rock(1), 18, 92), (bush(2), 130, 92)):
        prop_at(w, sp, x, y)
    gate = spr_cracked_gate()
    prop_at(w, gate, 118, 74)
    unit_at(w, spr_ram_orc(), 76, 86, sh=(22, 4))
    speed_lines(w, 38, 64, n=3, length=11, seed=2, ramp='bone', idx=4)
    dust(w, 46, 84, 6, 'dirt', 3, 5, seed=1)
    for (i, (x, y)) in enumerate(((102, 30), (96, 44), (100, 58), (108, 24), (92, 52))):
        w.draw(spr_splinter(i), x, y, 9100)
    return finish(w)


# --------------------------------------------------------------------------- US-07 Reitgans-Goblin


@card_art('US-07')
def _art_us07():
    w = ground_world('grass', 4)
    for (sp, x, y) in ((bush(2), 132, 36), (tree_pine(0), 12, 44), (rock(2), 128, 92)):
        prop_at(w, sp, x, y)
    prop_at(w, pit(), 76, 88)
    w.draw(spr_goose_rider(), 76 - 30, 52 - 47, 900)
    arc_dots(w, (22, 84), (130, 84), 34, n=22, ramp='bone', idx=4, skip=2)
    dust(w, 24, 86, 5, 'dirt', 3, 5, seed=1)
    for (x, y) in ((30, 38), (24, 48), (36, 30)):
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
    hx, hy = 80, 76
    # Maulwurfsspur im Hof zum Loch
    for (x, y, b) in ((28, 34, 0), (42, 45, 0), (58, 57, 1)):
        prop_at(w, spr_molehill(b), x, y)
    w.draw(spr_dirt_hole(), hx - 17, hy - 9, hy)
    w.draw(spr_burrow_gnome(), hx - 15, hy + 2 - 38, hy + 2)
    w.draw(spr_dirt_lip(), hx - 17, hy - 1, hy + 6)
    for (i, (x, y)) in enumerate(((66, 52), (104, 48), (70, 40), (98, 62), (56, 66), (108, 70))):
        w.draw(spr_chunk(i), x, y, 9100)
    sparkles(w, [(hx + 28, hy - 44), (hx + 22, hy - 48)], ramp='bone', key=9100)
    unit_at(w, citizen('cloth', 1), 122, 84, flip=True, sh=(5, 2))
    return finish(w)


# --------------------------------------------------------------------------- US-09 Rumpelgeist


def _rot90(spr, k=1):
    c = Canvas(spr.h, spr.w) if k % 2 else Canvas(spr.w, spr.h)
    c.px = np.rot90(spr.px, k).copy()
    c.rid = np.rot90(spr.rid, k).copy()
    return c


def _draw_ghostly(world, spr, x, y, key, wall_bottom):
    """Sprite zeichnen; wo er in der Mauer steckt (y < wall_bottom) nur Schachbrett-Pixel, darunter deckend"""
    h, wd = spr.px.shape[:2]
    for yy in range(h):
        for xx in range(wd):
            if spr.px[yy, xx, 3] == 0:
                continue
            X, Y = x + xx, y + yy
            if not (0 <= X < world.w and 0 <= Y < world.h):
                continue
            dark = spr.rid[yy, xx] == RAMP_ID['coal']
            if Y < wall_bottom and not dark and X % 2 == 0 and Y % 2 == 0:
                continue
            world.px[Y, X] = spr.px[yy, xx]
            world.depth[Y, X] = key


@card_art('US-09')
def _art_us09():
    w = ground_world('dark', 4)
    wall = stone_wall_piece(144)
    wb = 40
    w.draw(wall, 0, wb - wall.h + 1, wb)
    shadow(w, 72, wb + 4, 70, 3)
    gh = spr_poltergeist()
    blob_shadow(w, 66, 80, 11, 3)
    _draw_ghostly(w, gh, 66 - gh.w // 2, 60 - gh.h, 9000, wb)
    # fliegende Gegenstaende
    w.draw(_rot90(barrel(), 1), 100, 50, 9000)
    w.draw(_rot90(crate(), 3), 16, 56, 9000)
    speed_lines(w, 118, 60, n=2, length=8, seed=3)
    speed_lines(w, 38, 66, n=2, length=8, seed=4)
    blob_shadow(w, 110, 82, 8, 2)
    blob_shadow(w, 26, 84, 8, 2)
    unit_at(w, citizen('dirt', 1), 124, 88, flip=True, sh=(5, 2))
    for (x, y) in ((128, 70), (131, 72), (134, 69)):
        wpix(w, x, y, 'sky', 5, 9000)
        wpix(w, x, y + 1, 'sky', 4, 9000)
    return finish(w)


# --------------------------------------------------------------------------- US-10 Zangen-Panzerkrebs


def _beach_ground(seed):
    w = ground_world('sand', seed)
    X = np.arange(WIN_W)[None, :]
    Y = np.arange(WIN_H)[:, None]
    edge = 22 + 4.0 * np.sin(X / 9.0) + 2.0 * np.sin(X / 4.3 + 1.0)
    water = Y < edge
    wet = (Y >= edge) & (Y < edge + 7)
    foam = (np.abs(Y - edge) < 1.6) & (((X + Y) % 2) == 0)
    rgb = w.px[:, :, :3].copy()
    depth = np.clip((edge - Y) / 22.0, 0, 1)
    idx = np.clip(np.round(4 - depth * 2.0), 2, 4).astype(int)
    chk = ((X + Y) % 2 == 0)
    idx = np.where((depth > 0.25) & (depth < 0.75) & chk, idx - 1, idx)
    sky = np.array(RAMPS['sky'], np.uint8)
    rgb = np.where(water[..., None], sky[np.broadcast_to(np.clip(idx, 0, 5), (WIN_H, WIN_W))], rgb)
    dk = darken_palette(rgb.reshape(-1, 3), 1).reshape(rgb.shape)
    rgb = np.where((wet & chk)[..., None], dk, rgb)
    rgb = np.where(foam[..., None], np.array(RAMPS['bone'][5], np.uint8), rgb)
    w.px[:, :, :3] = rgb
    return w


@card_art('US-10')
def _art_us10():
    w = _beach_ground(3)
    for (sp, x, y) in ((rock(3), 14, 56), (rock(1), 132, 60), (bush(2), 134, 92), (rock(2, True), 14, 94)):
        prop_at(w, sp, x, y)
    cx, cy = 58, 84
    rcx, rcy = cx - 30 + 48, cy - 39 + 12              # Mitte des Schluesselrings
    cit = citizen('cloth', 0)
    w.draw(cit, int(rcx - 8), int(rcy - 12), cy - 3)    # Buerger im Ring: der Ring liegt davor
    blob_shadow(w, rcx + 2, cy + 2, 7, 2)
    unit_at(w, spr_pincer_crab(), cx, cy, sh=(26, 4))
    dust(w, cx - 24, cy - 1, 4, 'dirt', 3, 5, seed=4, key=cy + 2)
    dust(w, cx + 24, cy - 1, 4, 'dirt', 3, 5, seed=5, key=cy + 2)
    return finish(w)
