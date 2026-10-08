"""pack_art8 Dioramen A: BH-05 Zahnklempner, BH-06 Brunnen der ewigen Jugend, BH-07 Phönix-Nest."""
from __future__ import annotations

from pack_art8_kit import *
from pack_art8_props import *
from pack_art8_chars import *


def _fin(world, geom, y0=6):
    return finish(crop_room(world, geom, y0))


# =========================================================================== BH-05 Zahnklempner (Raum 2x2)


def furnish_tinker(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(tooth_sign(), X0 + 14)
    ctx.decor(dental_lamp_wall(), X0 + 37)
    ctx.decor(tooth_jars(1), X0 + 56)
    ctx.prop(tooth_patient_chair(), X0 + 24, Y0 + 10)
    ctx.prop(spittoon(), X0 + 10, Y0 + 40)


THEME_TINKER = {'floor': floor_metal(), 'furnish': furnish_tinker, 'low': False}


@card_art('BH-05')
def _art_bh05():
    world, c, out, geom = build_room('D', THEME_TINKER, 2, 2, seed=5)
    MX, MY, MW, MH = geom
    # Zahnklempner links, blickt zum Patienten
    d = dentist_gnome()
    world.draw(d, MX + 20 - d.w // 2, MY + 47 - d.h + 1, MY + 47)
    # Lichtkegel der Lampe auf den Patienten
    light_cone(world, MX + 41, MY + 5, 6, MX + 42, MY + 36, 36)
    light_glow(world, MX + 42, MY + 44, 26, 11)
    # draußen: wartender Patient, Büsche
    pw = patient_waiting()
    unit_at(world, pw, MX - 22, MY + 54, sh=(6, 2))
    prop_at(world, bush(1), MX - 24, MY + 20)
    prop_at(world, rock(2), MX + MW + 24, MY + 66)
    prop_at(world, bush(3, True), MX + MW + 20, MY + 24)
    return _fin(world, geom)


# =========================================================================== BH-06 Brunnen der ewigen Jugend (Hof 2x2)


def _stand(world, spr, fx, fy, key=None, flip=False):
    world.draw(spr, int(fx - spr.w // 2), int(fy - spr.h + 1), int(fy if key is None else key), flip)


@card_art('BH-06')
def _art_bh06():
    w = ground_world('cobble', 7)
    fnt = youth_fountain()
    shadow(w, 75, 85, 38, 5)
    _stand(w, fnt, 72, 86, key=80)
    # Putten tanzen auf dem Beckenrand, eine fliegt
    _stand(w, putto(0), 46, 76, key=95)
    _stand(w, putto(1), 98, 77, key=95, flip=True)
    _stand(w, putto(1, flying=True), 112, 36, key=9000, flip=True)
    _stand(w, putto(0, flying=True), 30, 30, key=9000)
    # Patienten am Rand, Glitzer
    unit_at(w, citizen('cloth', 1), 126, 84, flip=True, sh=(5, 2))
    unit_at(w, citizen('dirt', 0), 20, 84, sh=(5, 2))
    for (x, y, col) in ((54, 16, 'gold'), (92, 18, 'ice'), (124, 56, 'gold'), (16, 58, 'ice'), (104, 46, 'bone'), (40, 44, 'gold'), (82, 10, 'gold')):
        spark(w, x, y, col)
    for (x, y) in ((120, 70), (24, 70)):
        wdraw(w, heal_plus(), x - 2, y - 2)
    for (sp, x, y) in ((plant(), 14, 40), (plant(), 130, 40)):
        prop_at(w, sp, x, y)
    return finish(w)


# =========================================================================== BH-07 Phönix-Nest (Raum 3x3)


def furnish_nest(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(brazier(), X0 + 12)
    ctx.decor(feather_banner(), X0 + 32)
    ctx.decor(feather_banner(), X0 + 64)
    ctx.decor(brazier(), X0 + W - 12)
    nest = phoenix_nest_full()
    ctx.prop(nest, X0 + (W - nest.w) // 2, Y0 + 6)
    ctx.floor_deco(floor_feather('fire'), X0 + 8, Y0 + 52)
    ctx.floor_deco(floor_feather('gold', True), X0 + 76, Y0 + 44)
    ctx.floor_deco(floor_feather('gold'), X0 + 20, Y0 + 70)
    ctx.floor_deco(floor_feather('fire', True), X0 + 70, Y0 + 66)


THEME_NEST = {'floor': floor_ember(), 'furnish': furnish_nest, 'low': False}


@card_art('BH-07')
def _art_bh07():
    world, c, out, geom = build_room('N', THEME_NEST, 3, 3, seed=9)
    MX, MY, MW, MH = geom
    nx, ny = MX + (MW - 76) // 2, MY + 6
    tint_glow(world, MX + MW // 2, ny + 46, 44, 16, 'fire', 2)
    # Funken aus dem Schnabel
    bx, by = nx + 52, ny + 27
    for (dx, dy, col) in ((4, -3, 'gold'), (9, -7, 'fire'), (6, -12, 'gold'), (13, -5, 'gold'), (17, -11, 'fire'), (11, -16, 'gold')):
        wdraw(world, ember_spark(col), bx + dx, by + dy)
    for (dx, dy) in ((-30, -10), (-18, -22), (26, -18), (36, -6), (-36, 8)):
        wdraw(world, ember_spark('gold'), nx + 38 + dx, ny + dy)
    unit_at(world, citizen('cloth', 0), MX + MW - 10, MY + 68, flip=True, sh=(5, 2))
    prop_at(world, bush(2), MX - 18, MY + 76)
    prop_at(world, rock(1), MX + MW + 16, MY + 72)
    return finish(crop_room(world, geom, 14))
