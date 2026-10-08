"""pack_art9 - Kartenbilder: BW-07 Drill Yard, BW-08 Academy of Forbidden Books, BW-09 Trophy Hall, BW-10 Witch's Kitchen,
BW-11 The Great Hammer, BF-02 Arcanum, BF-03 Menagerie, BF-04 Siege Workshop, BF-05 Crypt, BF-06 Ice Grotto, BF-07 Greenhouse.
Sprites und Einrichtung liegen in den Helfermodulen pack_art9_*.py."""
from __future__ import annotations

from cards_art import *          # helpers, ART registry, pixl / scenekit / landscape / assets_*
import random
from pack_art9_kit import *
import pack_art9_scholar as SC


# =========================================================================== BW-08 Academy of Forbidden Books


def furnish_academy(ctx):
    W = ctx.W
    # Wand: zwei Regale, dazwischen Nachtfenster und Kerzen
    draw_prop(ctx, SC.bookshelf(26, 32, 3), 6, -16)
    draw_prop(ctx, SC.bookshelf(26, 32, 11), W - 6 - 26, -16)
    draw_wall(ctx, SC.window_night(18, 24), W // 2)
    draw_wall(ctx, SC.candle_sconce(), W // 2 - 16)
    draw_wall(ctx, SC.candle_sconce(), W // 2 + 16)
    # Boden
    draw_floor(ctx, rug(44, 18, 'purple'), 24, 22)
    draw_prop(ctx, SC.lectern_forbidden(), 12, 14)
    draw_prop(ctx, SC.librarian_desk(), W - 6 - 34, 12)


THEME_ACADEMY = {'floor': floor_wood(21, tones=(1, 2)), 'furnish': furnish_academy, 'low': False}


@card_art('BW-08')
def _art_bw08():
    world, X0, Y0, out = room_world('A', THEME_ACADEMY, '3x2', 'grass', 4)
    # fliegende Buecher
    for (spr, x, y) in ((SC.winged_book('ice', 0), 72, 34), (SC.winged_book('teamA', 1), 84, 50), (SC.winged_book('leaf', 0), 60, 54)):
        world.draw(spr, x, y, 9000)
        wsparkle(world, x + 9, y - 3, 'purple')
    return finish(window_of(world))


# =========================================================================== BW-07 Drill Yard

import pack_art9_yard as YD


def _earth_patch(world, x0, y0, x1, y1, seed):
    """Uebungsplatz: dunkler, festgetretener Boden mit hellem Rand (liegt auf dem Hofpflaster)"""
    mud = ground_world('mud', seed, world.w, world.h)
    rng = random.Random(seed)
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
            if edge < 2 and (x + y) % 2:
                continue
            world.px[y, x, :3] = mud.px[y, x, :3]
    for x in range(x0, x1):
        world.px[y1 - 1, x, :3] = RAMPS['dirt'][0]
        world.px[y0, x, :3] = RAMPS['dirt'][1]
    for y in range(y0, y1):
        world.px[y, x1 - 1, :3] = RAMPS['dirt'][0]
        world.px[y, x0, :3] = RAMPS['dirt'][1]
    for _ in range(30):                                  # Fussspuren
        x, y = rng.randint(x0 + 3, x1 - 5), rng.randint(y0 + 3, y1 - 4)
        world.px[y, x, :3] = RAMPS['dirt'][4]
        world.px[y, x + 1, :3] = RAMPS['dirt'][3]


@card_art('BW-07')
def _art_bw07():
    w = ground_world('cobble', 6)
    x0, y0, x1, y1 = 18, 22, 126, 90
    _earth_patch(w, x0, y0, x1, y1, 5)
    # Eckpfosten und Seil an der Rueckseite
    post = YD.corner_post()
    w.draw(post, x0 + 4 - 7, y0 + 8 - post.h + 1, y0 + 8)
    w.draw(post, x1 - 5 - 7, y0 + 8 - post.h + 1, y0 + 8)
    wrope(w, (x0 + 5, y0 - 12), (x1 - 6, y0 - 12), 3, key=y0 + 7, ramp='bone', hi=4, lo=3)
    # Strohpuppen und Kletterwand
    prop_at(w, YD.straw_dummy(0, 1), 58, 56)
    prop_at(w, YD.straw_dummy(1, 2), 84, 58)
    prop_at(w, YD.climb_wall(), 112, 50)
    # Huerde mit springendem Rekruten und Sternchen (+XP)
    prop_at(w, YD.hurdle(), 100, 84)
    unit_at(w, YD.recruit('jump'), 100, 72, sh=(7, 2))
    wblit(w, YD.xp_star(True), 88, 58, 9100)
    wblit(w, YD.xp_star(False), 114, 62, 9100)
    wblit(w, YD.xp_star(False), 94, 47, 9100)
    # Feldwebel mit Ente
    unit_at(w, YD.sergeant(0), 36, 84, sh=(10, 3))
    return finish(w)


# =========================================================================== BW-09 Trophy Hall

import pack_art9_hall as HL


def furnish_trophy(ctx):
    W = ctx.W
    # Wand: Schilde mit Trophaeen, Banner, Pokalbrett
    draw_wall(ctx, HL.plaque_goblin(), 18)
    draw_wall(ctx, HL.plaque_skull(), W - 18)
    draw_wall(ctx, HL.trophy_banner(), W // 2)
    draw_wall(ctx, HL.plaque_bear(), 34)
    draw_wall(ctx, HL.plaque_goblin(), W - 34)
    # Boden: roter Laeufer zur Gnom-Statue
    draw_floor(ctx, rug(18, 48, 'teamA'), W // 2 - 9, 10)
    draw_prop(ctx, HL.gnome_medal(), W // 2 - 9, 2)
    draw_prop(ctx, HL.stuffed_bear(), 8, 8)
    draw_prop(ctx, HL.trophy_cup(14), W - 8 - 16, 20)
    draw_prop(ctx, HL.trophy_cup(12), 32, 30)


THEME_TROPHY = {'floor': floor_cobble(5, base='bone', tone=(2, 3), mortar=1, hi=4), 'furnish': furnish_trophy, 'low': False}


@card_art('BW-09')
def _art_bw09():
    world, X0, Y0, out = room_world('R', THEME_TROPHY, '3x2', 'grass', 2)
    return finish(window_of(world))


# =========================================================================== BW-10 Witch's Kitchen


def furnish_kitchen(ctx):
    W = ctx.W
    draw_wall(ctx, HL.pad_bottom(HL.potion_shelf(), 8), 22)
    draw_wall(ctx, HL.pad_bottom(HL.herb_rail(), 0), W - 22)
    draw_prop(ctx, HL.kitchen_table(), W - 36, 4)
    draw_prop(ctx, HL.cauldron_big(), 30, 8)
    draw_prop(ctx, HL.black_cat(), 10, 28)
    draw_prop(ctx, HL.broom(), 5, 4)


THEME_KITCHEN = {'floor': floor_checker(('coal', 2), ('cloth', 1)), 'furnish': furnish_kitchen, 'low': False}


@card_art('BW-10')
def _art_bw10():
    world, X0, Y0, out = room_world('H', THEME_KITCHEN, '3x2', 'grass', 3)
    cx, cy = X0 + 30 + 18, Y0 + 8        # Kessel: Mitte der Oberflaeche ~ (cx, cy + 8)
    sp = HL.stirring_spoon()
    world.draw(sp, cx - 6, cy - 22, 9000)
    # Dampf in Totenkopfform
    world.draw(HL.skull_steam(0), cx - 9, cy - 36, 9000)
    # Wirbel im Trank
    for (dx, dy, i) in ((-6, 7, 5), (-7, 8, 5), (-5, 9, 4), (4, 11, 5), (5, 10, 5), (6, 9, 4)):
        wput(world, cx + dx, cy + dy, 'slime', i)
    # Bewegungsstriche am Loeffel
    for (dx, dy) in ((9, -14), (10, -13), (11, -11), (12, -9)):
        wput(world, cx + dx, cy + dy, 'bone', 5)
    return finish(window_of(world))
