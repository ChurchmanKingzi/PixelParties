"""pack_art8 Dioramen B: BW-02 Rüstkammer, BW-03 Pulverkammer, BW-04 Feuerwerkerei, BW-05 Kanonengießerei, BW-06 Runenpresse."""
from __future__ import annotations

from pack_art8_kit import *
from pack_art8_props import *
from pack_art8_chars import *


def _fin(world, geom, y0=6):
    return finish(crop_room(world, geom, y0))


def _feet(world, spr, fx, fy, key=None, flip=False):
    """Sprite mit Fußpunkt (fx, fy) = unten Mitte"""
    world.draw(spr, int(fx - spr.w // 2), int(fy - spr.h + 1), int(fy if key is None else key), flip)


# =========================================================================== BW-02 Rüstkammer (Raum 3x2)


def furnish_armory(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    P = ctx.P
    ctx.decor(P['crest'], X0 + 12)
    ctx.decor(weapon_wall(), X0 + W // 2)
    ctx.decor(P['crest'], X0 + W - 12)
    for (cx, head) in ((X0 + 18, 'helm'), (X0 + 48, 'bucket'), (X0 + 78, 'pot')):
        ctx.prop(armor_stand(head), cx - 14, Y0 - 8)
    ctx.floor_deco(P['rug'], X0 + W // 2 - 18, Y0 + H - 30)


THEME_ARMORY = {'floor': floor_slab(31, (2, 3), 1, 4), 'furnish': furnish_armory, 'low': False}


@card_art('BW-02')
def _art_bw02():
    world, c, out, geom = build_room('A', THEME_ARMORY, 3, 2, seed=2)
    MX, MY, MW, MH = geom
    # Kicher-Striche neben den Helmen
    for cx in (MX + 18, MX + 48, MX + 78):
        wdraw(world, giggle_marks(), cx - 18, MY - 6)
    # Knappe mit zu großem Eimerhelm
    _feet(world, squire_bucket(), MX + 62, MY + 50, flip=True)
    prop_at(world, bush(2), MX - 18, MY + 74)
    prop_at(world, rock(1), MX + MW + 16, MY + 70)
    return _fin(world, geom)


# =========================================================================== BW-03 Pulverkammer (Raum 2x2)


def furnish_powder(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(pipe_plaque(), X0 + 16)
    ctx.decor(hanging_lantern(), X0 + 40)
    ctx.prop(powder_keg(2), X0 + 4, Y0 + 10)
    ctx.prop(powder_keg(1), X0 + 26, Y0 + 14)
    ctx.prop(powder_keg(1), X0 + 15, Y0 - 3)
    ctx.floor_deco(powder_trail(24), X0 + 12, Y0 + 40)
    ctx.prop(sack_pile(), X0 + 5, Y0 + 36)


THEME_POWDER = {'floor': floor_dark_planks(), 'furnish': furnish_powder, 'low': False}


@card_art('BW-03')
def _art_bw03():
    world, c, out, geom = build_room('P', THEME_POWDER, 2, 2, seed=3)
    MX, MY, MW, MH = geom
    g = powder_gnome()
    _feet(world, g, MX + 46, MY + 49, flip=True)
    # Fliege kreist um ein Fass, glühende Asche fällt auf die Pulverspur
    wdraw(world, fly(), MX + 26, MY + 2)
    for (dx, dy) in ((22, 6), (24, 4), (26, 2), (30, 5), (32, 6)):
        wpix(world, MX + dx, MY + dy + 2, 'coal', 3)
    wdraw(world, ember_spark('gold'), MX + 33, MY + 40)
    prop_at(world, bush(1), MX - 20, MY + 24)
    prop_at(world, rock(2), MX + MW + 22, MY + 66)
    prop_at(world, bush(3, True), MX + MW + 20, MY + 24)
    return _fin(world, geom)


# =========================================================================== BW-04 Feuerwerkerei (Raum 2x2)


def furnish_fireworks(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(banner_rocket(), X0 + 14)
    ctx.decor(firecracker_string(), X0 + 44)
    ctx.floor_deco(scorch_mark(22, 9), X0 + 20, Y0 + 36)
    ctx.floor_deco(scorch_mark(16, 7), X0 + 6, Y0 + 40)
    ctx.prop(rocket_rack(), X0 + 3, Y0 + 12)
    ctx.prop(firework_fountain('fire'), X0 + 26, Y0 + 28)
    for (x, col) in ((X0 + 46, 'ice'), (X0 + 52, 'leaf')):
        ctx.prop(rocket(col, 24), x, Y0 + 12)


THEME_FIREWORKS = {'floor': floor_planks_light(), 'furnish': furnish_fireworks, 'low': False}


@card_art('BW-04')
def _art_bw04():
    world, c, out, geom = build_room('F', THEME_FIREWORKS, 2, 2, seed=4)
    MX, MY, MW, MH = geom
    # Funkenfontäne in fünf Farben aus dem Böller
    sf = spark_fountain(seed=4)
    world.draw(sf, MX + 32 - sf.w // 2, MY + 28 + 2 - sf.h + 2, 9000)
    # Feuerwerker rechts (blickt zur Fontäne)
    _feet(world, fireworks_worker(), MX + 50, MY + 48, flip=True)
    for (x, y, col) in ((MX + 10, MY + 6, 'gold'), (MX + 56, MY + 2, 'leaf'), (MX + 28, MY - 2, 'purple')):
        spark(world, x, y, col)
    prop_at(world, bush(2), MX - 20, MY + 24)
    prop_at(world, rock(1), MX + MW + 22, MY + 68)
    prop_at(world, bush(3), MX + MW + 20, MY + 26)
    return _fin(world, geom)


# =========================================================================== BW-05 Kanonengießerei (Raum 3x2)


def furnish_foundry(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(blueprint(), X0 + 76)
    post = clothesline_post()
    ctx.prop(post, X0 + 62, Y0 + 4)
    ctx.prop(post, X0 + 90 - 4, Y0 + 4)
    ctx.prop(crucible(), X0 + 16, Y0 + 0)
    ctx.floor_deco(scorch_mark(26, 10), X0 + 20, Y0 + 40)


THEME_FOUNDRY = {'floor': floor_sand(), 'furnish': furnish_foundry, 'low': False}


@card_art('BW-05')
def _art_bw05():
    world, c, out, geom = build_room('G', THEME_FOUNDRY, 3, 2, seed=5)
    MX, MY, MW, MH = geom
    # Rohre trocknen auf der Wäscheleine (Leine zwischen den Pfosten)
    world.draw(drying_cannon(1), MX + 64, MY + 6, 9000)
    world.draw(drying_cannon(0), MX + 60, MY + 26, 9000)
    _feet(world, foundry_worker(), MX + 10, MY + 48)
    prop_at(world, bush(2), MX - 18, MY + 74)
    prop_at(world, rock(1), MX + MW + 16, MY + 70)
    return _fin(world, geom)


# =========================================================================== BW-06 Runenpresse (Raum 2x2)


def furnish_runes(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(stone_tablet_decor(), X0 + 18)
    ctx.decor(crystal_cluster(), X0 + 52)
    ctx.prop(rune_press(), X0 + 4, Y0 + 2)
    ctx.prop(paper_stack(), X0 + 24, Y0 + 36)
    ctx.prop(ink_pot(), X0 + 44, Y0 + 12)


THEME_RUNES = {'floor': floor_rune(), 'furnish': furnish_runes, 'low': False}


@card_art('BW-06')
def _art_bw06():
    world, c, out, geom = build_room('R', THEME_RUNES, 2, 2, seed=6)
    MX, MY, MW, MH = geom
    tint_glow(world, MX + 24, MY + 40, 26, 10, 'purple', 3)
    ap = rune_apprentice()
    _feet(world, ap, MX + 44, MY + 48, flip=True)
    prop_at(world, bush(1), MX - 20, MY + 24)
    prop_at(world, rock(2), MX + MW + 22, MY + 66)
    prop_at(world, bush(3, True), MX + MW + 20, MY + 24)
    return _fin(world, geom)
