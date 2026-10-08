"""pack_art8: Kartenbilder für BH-03 Badehaus, BH-04 Heilpilz-Garten, BH-05 Zahnklempner, BH-06 Brunnen der ewigen Jugend,
BH-07 Phönix-Nest, BW-02 Rüstkammer, BW-03 Pulverkammer, BW-04 Feuerwerkerei, BW-05 Kanonengießerei, BW-06 Runenpresse."""
from __future__ import annotations

from pack_art8_kit import *
from pack_art8_props import *
from pack_art8_chars import *
import pack_art8_scenes_a      # noqa: F401


def _view(geom, y0=6):
    """Weltkoordinaten-Versatz des 144x96-Fensters (Modul waagerecht zentriert)"""
    MX, MY, MW, MH = geom
    return MX + MW // 2 - 72, y0


def _fin(world, geom, y0=6):
    return finish(crop_room(world, geom, y0))


# =========================================================================== BH-03 Badehaus (Raum 3x2)


def furnish_bath(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    P = ctx.P
    ctx.decor(spout_decor(), X0 + 18)
    ctx.decor(P['window'], X0 + 48)
    ctx.decor(towel_rail(), X0 + W - 16)
    ctx.floor_deco(bath_pool(54, 28), X0 + 8, Y0 + 10)
    ctx.floor_deco(bath_mat(), X0 + 38, Y0 + H - 22)
    ctx.prop(bath_bench(), X0 + 63, Y0 + 28)
    ctx.prop(bath_bucket(), X0 + 78, Y0 + 12)


THEME_BATH = {'floor': floor_bath(), 'furnish': furnish_bath, 'low': False}


@card_art('BH-03')
def _art_bh03():
    world, c, out, geom = build_room('X', THEME_BATH, 3, 2, seed=3)
    MX, MY, MW, MH = geom
    px, py = MX + 8, MY + 10
    world.draw(spout_stream(11), MX + 18 + 1, MY + 5, 9000)
    world.draw(troll_bather(), px + 11, py + 16 - 36, py + 30)
    world.draw(rubber_duck_big(), px + 6, py + 16, py + 24)
    for (dx, dy, sz) in ((10, -14, 1), (52, -4, 1), (28, -26, 0), (46, -22, 0), (0, 22, 0)):
        world.draw(steam_puff(sz), px + dx, py + dy, 9000)
    prop_at(world, bush(2), MX - 18, MY + 74)
    prop_at(world, rock(1), MX + MW + 16, MY + 70)
    return _fin(world, geom)


# =========================================================================== BH-04 Heilpilz-Garten (Hof 2x2)


def _stand(world, spr, fx, fy, key=None, flip=False):
    """Sprite mit Fußpunkt (fx, fy) (unten Mitte) setzen; key = Tiefe (Standard: fy)"""
    world.draw(spr, int(fx - spr.w // 2), int(fy - spr.h + 1), int(fy if key is None else key), flip)


@card_art('BH-04')
def _art_bh04():
    w = ground_world('cobble', 5)
    bed = mush_bed()
    shadow(w, 74, 79, 36, 4)
    _stand(w, bed, 72, 80, key=45)
    for (h, fx, fy, tilt, seed, patch) in ((22, 84, 54, 0, 2, False), (30, 60, 56, 0, 1, True), (14, 44, 63, 0, 3, False),
                                           (14, 102, 65, 0, 4, False), (22, 74, 68, 3, 5, False)):
        _stand(w, mushroom(h, tilt=tilt, seed=seed, patch=patch), fx, fy)
    # Patient am Beet, Heilkreuze und Sporen
    unit_at(w, citizen('cloth', 0), 124, 76, flip=True, sh=(5, 2))
    unit_at(w, citizen('dirt', 1), 20, 82, sh=(5, 2))
    for (x, y) in ((118, 52), (126, 44), (14, 62), (24, 56)):
        wdraw(w, heal_plus(), x - 2, y - 2)
    for (x, y) in ((66, 22), (80, 28), (52, 30), (92, 36), (72, 14), (96, 20)):
        wdraw(w, spore(), x, y)
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 130, 34)):
        prop_at(w, sp, x, y)
    return finish(w)
