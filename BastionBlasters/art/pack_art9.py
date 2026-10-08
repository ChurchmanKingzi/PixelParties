"""pack_art9 - Kartenbilder: BW-07 Drill Yard, BW-08 Academy of Forbidden Books, BW-09 Trophy Hall, BW-10 Witch's Kitchen,
BW-11 The Great Hammer, BF-02 Arcanum, BF-03 Menagerie, BF-04 Siege Workshop, BF-05 Crypt, BF-06 Ice Grotto, BF-07 Greenhouse.
Sprites und Einrichtung liegen in den Helfermodulen pack_art9_*.py."""
from __future__ import annotations

from cards_art import *          # helpers, ART registry, pixl / scenekit / landscape / assets_*
import random
from pack_art9_kit import *
from pack_art9_hall import pad_bottom
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
    draw_wall(ctx, HL.plaque_goblin(), 17)
    draw_wall(ctx, HL.plaque_skull(), W - 17)
    draw_wall(ctx, HL.trophy_banner(), W // 2)
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


# =========================================================================== BF-05 Crypt

import pack_art9_crypt as CR
from pack_art9_hall import pad_bottom


def furnish_crypt(ctx):
    W = ctx.W
    draw_wall(ctx, CR.skull_niche(), 20)
    draw_wall(ctx, CR.skull_niche(), W - 20)
    draw_wall(ctx, CR.torch_green(), W // 2)
    draw_wall(ctx, pad_bottom(CR.cobweb(), 8), 12)
    draw_wall(ctx, pad_bottom(CR.cobweb(True), 8), W - 12)
    draw_floor(ctx, CR.crypt_rug(), 40, 14)
    draw_prop(ctx, CR.coffin('open'), 6, 6)
    draw_prop(ctx, CR.coffin('closed'), 26, 8)
    draw_prop(ctx, CR.armchair_reader(), 50, 10)
    draw_prop(ctx, CR.candelabra(), 44, 18)
    draw_prop(ctx, CR.bat_hanging(), 62, -14, key_add=0)


THEME_CRYPT = {'floor': floor_cobble(9, base='coal', tone=(1, 2), mortar=0, hi=3), 'furnish': furnish_crypt, 'low': False}


@card_art('BF-05')
def _art_bf05():
    world, X0, Y0, out = room_world('Y', THEME_CRYPT, '3x2', 'dark', 3)
    return finish(window_of(world))


# =========================================================================== BF-06 Ice Grotto

import pack_art9_ice as IC


def furnish_ice(ctx):
    W = ctx.W
    draw_wall(ctx, IC.icicles(W - 8, 22), W // 2)
    draw_wall(ctx, IC.key_board(), W // 2)
    draw_floor(ctx, IC.welcome_mat(), W // 2 - 12, 34)
    draw_prop(ctx, IC.ice_crystals(34, 1, 4), 5, 6)
    draw_prop(ctx, IC.ice_crystals(30, 7, 3), W - 5 - 25, 8)
    draw_prop(ctx, IC.penguin_clerk(), W // 2 - 8, 2)
    draw_prop(ctx, IC.reception_desk(), W // 2 - 26, 8)
    draw_prop(ctx, IC.snow_drift(26, 10, 1), 4, 36)
    draw_prop(ctx, IC.snow_drift(22, 9, 4), W - 28, 38)


THEME_ICE = {'floor': floor_cobble(7, base='ice', tone=(3, 4), mortar=2, hi=5), 'furnish': furnish_ice, 'low': False}


@card_art('BF-06')
def _art_bf06():
    world, X0, Y0, out = room_world('I', THEME_ICE, '3x2', 'snow', 2)
    return finish(window_of(world))


# =========================================================================== BW-11 The Great Hammer

import pack_art9_tech as TC


def furnish_hammer(ctx):
    W = ctx.W
    draw_wall(ctx, TC.gear(8, 'gold', 10, 4), 14)
    draw_wall(ctx, TC.gear(5, 'metal', 8, 3), 28)
    draw_wall(ctx, TC.blueprint(), W - 14)


THEME_HAMMER = {'floor': floor_plates('metal', 1, 2, 3), 'furnish': furnish_hammer, 'low': False}


def _gnome_at(world, spr, hand, flip=False):
    """Gnom so setzen, dass seine Haende bei `hand` liegen (pull-Pose: Haende bei (20, 10) im Sprite)"""
    hx = 20 if not flip else spr.w - 1 - 20
    x0, y0 = hand[0] - hx, hand[1] - 10
    foot_y = y0 + spr.h - 1
    shadow(world, x0 + spr.w // 2, foot_y - 1, 9, 3)
    world.draw(spr, x0, y0, foot_y, flip)


@card_art('BW-11')
def _art_bw11():
    world, X0, Y0, out = room_world('M', THEME_HAMMER, '3x3', 'grass', 5)
    ox, oy = 8, 6                                   # Fensterversatz
    hm = TC.giant_hammer(50, 84)
    hx0, hy0 = 72 - hm.w // 2 + ox, 2 + oy
    # Schatten des schwebenden Hammers am Boden
    shadow(world, 72 + ox, 88 + oy, 17, 4)
    world.draw(hm, hx0, hy0, 9000)
    eye = {'tl': (hx0 + 6, hy0 + 1), 'tr': (hx0 + hm.w - 7, hy0 + 1), 'bl': (hx0 + 6, hy0 + 25), 'br': (hx0 + hm.w - 7, hy0 + 25)}
    # drei Gnome an Seilen
    g1, g2, g3 = TC.gnome('pull', 'teamA'), TC.gnome('pull', 'leaf', 'dirt', 'cloth'), TC.gnome('pull', 'gold', 'bone', 'sky')
    hands = [(46 + ox, 47 + oy), (53 + ox, 77 + oy), (97 + ox, 64 + oy)]
    _gnome_at(world, g1, hands[0])
    _gnome_at(world, g2, hands[1])
    _gnome_at(world, g3, hands[2], flip=True)
    wrope(world, eye['tl'], hands[0], 2, key=9050)
    wrope(world, eye['bl'], hands[1], 2, key=9050)
    wrope(world, eye['tr'], hands[2], 2, key=9050)
    return finish(window_of(world))


# =========================================================================== BF-04 Siege Workshop


def furnish_siege(ctx):
    W = ctx.W
    draw_wall(ctx, pad_bottom(TC.pipe_run(W - 8, 14), 8), W // 2)
    draw_wall(ctx, TC.gear(10, 'gold', 11, 5), 60)
    draw_wall(ctx, TC.gear(6, 'metal', 8, 4), 79)
    draw_prop(ctx, TC.boiler(), 5, -8)
    draw_prop(ctx, TC.battering_ram(), 30, 26)
    draw_prop(ctx, TC.seesaw_mallet(), 50, 8)


THEME_SIEGE = {'floor': floor_plates('metal', 1, 2, 6), 'furnish': furnish_siege, 'low': False}


@card_art('BF-04')
def _art_bf04():
    world, X0, Y0, out = room_world('V', THEME_SIEGE, '3x3', 'dirt', 4)
    ox, oy = 8, 6
    # Dampf aus dem Kamin des Kessels
    bx, by = X0 + 5 + 28, Y0 - 8
    for k, (dx, dy, f, sz) in enumerate(((0, -9, 0, 1), (4, -19, 2, 2), (10, -28, 4, 2))):
        world.draw(TC.steam_puff(f, sz), bx + dx - 4, by + dy, 9000)
    unit_at(world, TC.gnome('work', 'metal', 'fire'), X0 + 24, Y0 + 62, sh=(9, 3))
    return finish(window_of(world))


# =========================================================================== BF-02 Arcanum

import pack_art9_arcane as AR
import pack_art9_ice as IC2


def furnish_arcanum(ctx):
    W = ctx.W
    arcane_cols = ['purple', 'ice', 'sky', 'cloth', 'purple', 'gold']
    draw_prop(ctx, SC.bookshelf(26, 36, 8, arcane_cols), 5, -18)
    draw_prop(ctx, SC.bookshelf(26, 36, 14, arcane_cols), W - 5 - 26, -18)
    draw_wall(ctx, SC.window_night(18, 22, star=True), W // 2)
    draw_floor(ctx, AR.rune_circle(19), W // 2 - 20, 26)
    draw_prop(ctx, AR.crystal_ball_stand(), W // 2 - 17, 10)
    draw_prop(ctx, AR.apprentice(), W - 12 - 24, 34)


THEME_ARCANUM = {'floor': floor_cobble(11, base='purple', tone=(0, 1), mortar=0, hi=2), 'furnish': furnish_arcanum, 'low': False}


@card_art('BF-02')
def _art_bf02():
    world, X0, Y0, out = room_world('N', THEME_ARCANUM, '3x3', 'grass', 3)
    # schwebende Buecher mit Funkenschweif (kreisen um die Kugel)
    for (spr, x, y) in ((SC.flying_book(0, 'teamA'), 34, 58), (SC.flying_book(1, 'gold'), 94, 52), (SC.flying_book(2, 'ice'), 40, 84)):
        world.draw(spr, x, y, 9000)
        wsparkle(world, x - 3, y + 12, 'purple')
        wsparkle(world, x + 21, y - 3, 'ice')
    return finish(window_of(world))


# =========================================================================== BF-03 Menagerie

import pack_art9_beasts as BE


def furnish_menagerie(ctx):
    W = ctx.W
    draw_wall(ctx, BE.chain_decor(), W // 2)
    for k, kind in enumerate(('bear', 'eyes', 'wolf')):
        draw_prop(ctx, BE.cage(kind), 4 + k * 29, -4)
    draw_floor(ctx, BE.straw_patch(36, 20, 1), 28, 38)
    draw_prop(ctx, BE.hay_bale(), 6, 40)
    draw_prop(ctx, BE.hay_bale(22, 14), 10, 52)
    draw_prop(ctx, BE.feed_sack(), W - 22, 40)


THEME_MENAGERIE = {'floor': floor_noise('dirt', 2, 3, 7, [('dirt', 4, 12), ('dirt', 1, 10), ('gold', 3, 10)]), 'furnish': furnish_menagerie, 'low': False}


@card_art('BF-03')
def _art_bf03():
    world, X0, Y0, out = room_world('G', THEME_MENAGERIE, '3x3', 'grass', 6)
    ox, oy = 8, 6
    cx, cy = 58 + ox, 74 + oy                  # Gnom (Fussstelle in Fensterkoordinaten 58, 74)
    unit_at(world, TC.gnome('shovel', 'leaf', 'dirt', 'cloth'), cx, cy, sh=(10, 3))
    prop_at(world, BE.manure_pile(), cx + 21, cy - 1)
    BE.stink_lines(world, cx + 21, cy - 12, 14)
    return finish(window_of(world))
