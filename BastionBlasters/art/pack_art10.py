"""pack_art10: Bauteil-Karten BF-08 Air Dock, BF-09 Temple of Cheer, BF-10 Chaos Cabinet, BP-02 Gun Deck, BP-03 Observatory,
BP-04 Cloud Anchor, BP-05 Bunker Mount, BP-06 Floating Fortress, BU-02 Canteen, BU-03 Repair Shop, BU-04 Alarm Bell.
Helfer-Module: pack_art10_kit / _ship / _holy / _work / _sky / _yard."""
from __future__ import annotations

from pack_art10_kit import *
from pack_art10_ship import *


def _room(letter, theme, seed, rows=None, ground='grass', crop=(8, 6), size=(160, 160)):
    world = ground_world(ground, seed, size[0], size[1])
    rows = rows or [".....", f".{letter * 3}.", f".{letter * 3}.", ".hhh.", "....."]
    c, out = mini_castle(rows, 0, 0, world, themes={letter: theme})
    return world, c, out


@card_art('BP-02')
def _art_bp02():
    world, c, out = _room('G', THEME_GUNDECK, 11)
    unit_at(world, pirate_gnome(), 98, 62, sh=(6, 2))
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))


@card_art('BF-08')
def _art_bf08():
    world, c, out = _room('A', THEME_AIRDOCK, 8)
    zep = zeppelin()
    zx, zy = 28, 12
    shadow(world, 70, 66, 27, 6)
    world.draw(zep, zx, zy, 9000)
    # Tau von der Nase zum Anlegemast und Leine zum Lotsen
    rp = Canvas(40, 30)
    rope(rp, 0, 4, 16, 1, sag=3, ramp='bone', hi=5, lo=3)
    world.draw(rp, zx + 70, zy + 12, 9001)
    pil = pilot_gnome()
    unit_at(world, pil, 90, 80, flip=True, sh=(6, 2))
    rp2 = Canvas(40, 40)
    rope(rp2, 0, 0, 22, 20, sag=6, ramp='bone', hi=5, lo=3)
    world.draw(rp2, zx + 36, zy + 32, 9001)
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))
