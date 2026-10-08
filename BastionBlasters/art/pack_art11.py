"""pack_art11: BU-05 Panic Room, BU-06 Gnome Express Lane, BU-07 Slide, BU-08 Recruiting Office, BU-09 Recall Portal,
BU-10 Curio Stockroom, BU-11 Chrono Shrine, BA-01 Shield Dome Generator, BA-02 Smog Chimney, BA-03 Net Launcher,
BA-04 Lightning Rod."""
from __future__ import annotations

from pack_art11_util import *
from pack_art11_chars import *
from pack_art11_rooms import *
from pack_art11_yard import *


def _room_world(rows, letter_theme, ox=0, oy=0, ground='grass', seed=1, size=(192, 160)):
    world = ground_world(ground, seed, size[0], size[1])
    c, out = mini_castle(rows, ox, oy, world, themes=letter_theme)
    return world, c, out


# --------------------------------------------------------------------------- BU-05 Panic Room


@card_art('BU-05')
def _art_bu05():
    rows = [".....", ".PPP.", ".PPP.", ".hhh.", "....."]
    world, c, out = _room_world(rows, {'P': THEME_PANIC}, seed=3, size=(160, 160))
    unit_at(world, spr_scared_citizen(), 62, 82, sh=(6, 2))
    unit_at(world, spr_cookie_citizen(), 86, 84, flip=True, sh=(6, 2))
    for (sp, x, y) in ((bush(2), 138, 142), (rock(1), 12, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))


# --------------------------------------------------------------------------- BU-08 Recruiting Office


@card_art('BU-08')
def _art_bu08():
    rows = [".......", ".hOOh..", ".hOOh..", ".hhhh..", "......."]
    world, c, out = _room_world(rows, {'O': THEME_OFFICE}, seed=4, size=(192, 160))
    unit_at(world, spr_recruit(), 66, 82, flip=True, sh=(6, 2))
    # linker Hof: Warteschlange; rechter Hof: Waffenstaender
    unit_at(world, skeleton('idle', 1), 46, 100, sh=(8, 3))
    prop_at(world, signpost(), 36, 66)
    prop_at(world, rack(), 148, 60)
    prop_at(world, barrel(), 142, 92)
    return finish(crop_world(world, 24, 6))


# --------------------------------------------------------------------------- BU-10 Curio Stockroom


@card_art('BU-10')
def _art_bu10():
    rows = [".......", ".hUUh..", ".hUUh..", ".hhhh..", "......."]
    world, c, out = _room_world(rows, {'U': THEME_CURIO}, seed=5, size=(192, 160))
    unit_at(world, spr_duster_citizen(), 84, 80, sh=(6, 2))
    # Hoefe: Lagerkram
    for (sp, x, y) in ((crate(), 44, 56), (crate(), 58, 56), (barrel(), 50, 84), (chest(), 152, 58), (crate(), 140, 90)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 24, 6))


# --------------------------------------------------------------------------- BU-11 Chrono Shrine


@card_art('BU-11')
def _art_bu11():
    rows = [".....", ".RRR.", ".RRR.", ".hhh.", "....."]
    world, c, out = _room_world(rows, {'R': THEME_CHRONO}, seed=6, size=(160, 160))
    X0, Y0 = 32, 32
    # schwebende Sanduhren mit Bodenschatten
    for (sp, cx, top, sh_y, srx) in ((hourglass(26), X0 + 48, Y0 + 17, Y0 + 45, 9), (hourglass(16, sand_frac=0.7), X0 + 28, Y0 + 20, Y0 + 40, 6),
                                      (hourglass(18, sand_frac=0.3), X0 + 70, Y0 + 16, Y0 + 40, 6)):
        shadow(world, cx, sh_y, srx, 2.4)
        world.draw(sp, cx - sp.w // 2, top, Y0 + 60)
    for (x, y) in ((X0 + 36, Y0 + 12), (X0 + 62, Y0 + 30), (X0 + 56, Y0 + 8), (X0 + 22, Y0 + 30)):
        star(world, x, y, 'ice', False)
    unit_at(world, spr_frozen_citizen(), X0 + 18, Y0 + 48, sh=(6, 2))
    world.draw(floating_mug(), X0 + 30, Y0 + 28, Y0 + 60)
    return finish(crop_world(world, 8, 6))


# --------------------------------------------------------------------------- BU-06 Gnome Express Lane


@card_art('BU-06')
def _art_bu06():
    w = ground_world('cobble', 7)
    bx, by = 22, 38
    shadow(w, bx + 52, by + 28, 52, 4)
    w.draw(conveyor_base(3), bx, by, by)
    w.draw(conveyor_front(3), bx, by + 26, by + 34)
    # Klingeln an beiden Enden
    w.draw(bell_post(), 4, 24, 62)
    w.draw(bell_post(), 122, 24, 62, flip=True)
    # Gnome in voller Fahrt, Geschwindigkeitsstriche
    for (x, y, tun, pose) in ((46, 62, 'ice', 'glide'), (80, 58, 'fur', 'glide'), (112, 62, 'ice', 'ring')):
        unit_at(w, spr_gnome_skater(tunic=tun, pose=pose), x, y, sh=(0.1, 0.1))
        for k, (dx, dy, ln) in enumerate(((-24, -16, 8), (-22, -6, 6))):
            for t in range(ln):
                px_at(w, x + dx + t, y + dy, 'bone', 5 if t < ln - 2 else 4, 9000)
    ding(w, 118, 36)
    # ein Skelett laeuft gemaechlich drumherum (Feinde meiden den Eilgang)
    unit_at(w, skeleton('walk', 1), 96, 92, flip=True, sh=(8, 3))
    for (sp, x, y) in ((barrel(), 16, 28), (crate(), 128, 30)):
        prop_at(w, sp, x, y)
    return finish(w)
