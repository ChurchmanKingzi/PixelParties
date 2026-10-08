"""pack_art10: Bauteil-Karten BF-08 Air Dock, BF-09 Temple of Cheer, BF-10 Chaos Cabinet, BP-02 Gun Deck, BP-03 Observatory,
BP-04 Cloud Anchor, BP-05 Bunker Mount, BP-06 Floating Fortress, BU-02 Canteen, BU-03 Repair Shop, BU-04 Alarm Bell.
Helfer-Module: pack_art10_kit / _ship / _holy / _work / _sky / _yard."""
from __future__ import annotations

from pack_art10_kit import *
from pack_art10_ship import *
from pack_art10_holy import *
from pack_art10_work import *


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


@card_art('BF-09')
def _art_bf09():
    rows = [".....", ".EEE.", ".EEE.", ".EEE.", ".hhh.", "....."]
    world = ground_world('grass', 9, 160, 192)
    c, out = mini_castle(rows, 0, 0, world, themes={'E': THEME_TEMPLE})
    cx = 80
    # Lichtstrahl aus dem Rosenfenster auf das Sparschwein
    beam, bx = light_beam(cx - 2, cx + 4, 36, 66, half_top=5, half_bot=11)
    world.draw(beam, bx, 36, 9000)
    # Besucher in den Baenken (Koepfe von hinten)
    for (x, y, hair, hi_) in ((46, 80, 'wood', 2), (58, 81, 'fire', 3), (101, 80, 'dirt', 3), (112, 81, 'bone', 4)):
        world.draw(head_back(hair, hi_), x, y, 140)
    unit_at(world, nun(), 80, 98, sh=(7, 2))
    world.draw(halo_disc(), 100, 84, 9000)
    for (x, y) in ((96, 84), (97, 86)):
        world.px[y, x, :3] = RAMPS['gold'][4]
    world_sparkle(world, 80, 40)
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))


@card_art('BF-10')
def _art_bf10():
    world, c, out = _room('X', THEME_CHAOS, 10)
    unit_at(world, clown(), 112, 80, flip=True, sh=(7, 2))
    # Jonglierbaelle
    for (bx, by, col) in ((104, 62, 'ice'), (113, 52, 'fire'), (122, 62, 'leaf')):
        ball = Canvas(6, 6)
        ellipse(ball, 3, 3, 2.6, 2.6, col, lo=1, hi=5, ambient=0.15)
        ball.outline()
        world.draw(ball, bx - 4, by - 4, 9000)
    unit_at(world, frog_small(), 62, 80, sh=(5, 2))
    prop_at(world, duck(), 46, 68)
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))


@card_art('BU-02')
def _art_bu02():
    world, c, out = _room('Q', THEME_CANTEEN, 12)
    t = troll()
    unit_at(world, t, 74, 82, sh=(14, 3))
    # Schwindelsterne ueber dem Troll und Schwapp-Tropfen
    world_sparkle(world, 62, 38)
    world_sparkle(world, 84, 36)
    unit_at(world, diner(), 108, 66, sh=(5, 2))
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 6))


@card_art('BU-03')
def _art_bu03():
    rows = [".......", ".hhRR..", ".hhRR..", ".hhhh..", "......."]
    world = ground_world('grass', 13, 224, 160)
    c, out = mini_castle(rows, 0, 0, world, themes={'R': THEME_REPAIR})
    # Mauerflicken an der Nordwand des Hofs, Leiter und Bau-Zwerg
    rep = wall_repair()
    world.draw(rep, 44, 14, 36)
    lad = ladder(40)
    world.draw(lad, 76, 24, 62)
    unit_at(world, fixer_gnome(), 84, 36, sh=(0.1, 0.1)) if False else None
    g = fixer_gnome()
    world.draw(g, 74, 11, 63)
    for (x, y) in ((92, 12), (95, 15), (93, 18)):
        world_sparkle(world, x, y, 'gold')
    prop_at(world, brick_pile(), 66, 80)
    prop_at(world, bush(2), 190, 140)
    return finish(crop_world(world, 56, 6))
