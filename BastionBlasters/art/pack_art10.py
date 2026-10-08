"""pack_art10: Bauteil-Karten BF-08 Air Dock, BF-09 Temple of Cheer, BF-10 Chaos Cabinet, BP-02 Gun Deck, BP-03 Observatory,
BP-04 Cloud Anchor, BP-05 Bunker Mount, BP-06 Floating Fortress, BU-02 Canteen, BU-03 Repair Shop, BU-04 Alarm Bell.
Helfer-Module: pack_art10_kit / _ship / _holy / _work / _sky / _yard."""
from __future__ import annotations

from pack_art10_kit import *
from pack_art10_ship import *
from pack_art10_holy import *
from pack_art10_work import *
from pack_art10_sky import *
from pack_art10_yard import *


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
    shadow(world, 64, 70, 26, 6)
    world.draw(zep, zx, zy, 9000)
    # Tau von der Nase zum Anlegemast und Leine zum Lotsen
    rp = Canvas(40, 30)
    rope(rp, 0, 4, 16, 1, sag=3, ramp='bone', hi=5, lo=3)
    world.draw(rp, zx + 70, zy + 12, 9001)
    unit_at(world, pilot_gnome(), 66, 78, sh=(6, 2))
    rp2 = Canvas(20, 30)
    rope(rp2, 0, 0, 9, 21, sag=3, ramp='bone', hi=5, lo=3)
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
    prop_at(world, bush(2), 192, 100)
    prop_at(world, rock(2), 176, 130)
    prop_at(world, crate(), 178, 70)
    return finish(crop_world(world, 48, 6))


@card_art('BP-03')
def _art_bp03():
    rows = [".....", ".hhh.", ".hTh.", ".hhh.", "....."]
    world = ground_world('grass', 3, 160, 160)
    c, out = mini_castle(rows, 0, 0, world, tw=observatory_tower())
    # Mond guckt zurueck, Sterne, Sterngucker
    world.draw(moon_face(), 106, 14, 9000)
    for (x, y) in ((100, 17), (131, 40), (96, 34), (132, 20)):
        world_sparkle(world, x, y, 'gold')
    unit_at(world, astronomer(), 108, 94, sh=(6, 2))
    for (sp, x, y) in ((bush(2), 140, 140), (rock(1), 14, 148)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 8, 8))


@card_art('BP-04')
def _art_bp04():
    rows = [".....", ".hhh.", ".hhh.", ".hhT.", "....."]
    world = ground_world('grass', 4, 192, 160)
    c, out = mini_castle(rows, 0, 0, world, tw=cloud_anchor_tower())
    # Schatten der Wolke auf dem Hof, Waffen auf den Wolkenplaetzen
    shadow(world, 120, 124, 30, 7)
    ox, oy = 112 - 36, 131 - 84 + 1
    world.draw(rain_cannon(), ox + 22 - 8, oy + 15 - 17, 9000)
    world.draw(rain_mortar(), ox + 50 - 8, oy + 15 - 23, 9000)
    for (sp, x, y) in ((bush(2), 172, 150), (rock(1), 168, 90)):
        prop_at(world, sp, x, y)
    return finish(crop_world(world, 40, 41))


@card_art('BP-05')
def _art_bp05():
    world = ground_world('cobble', 5)
    bk = bunker()
    bx, by = 72 - 36, 80 - 70 + 1
    shadow(world, 76, 79, 36, 5)
    world.draw(bk, bx, by, 80)
    world.draw(garden_gnome(), bx + 38, by + 6, 81)
    world.draw(smoke_puff(), bx + 50, by + 56, 85)
    for (sp, x, y) in ((barrel(), 16, 38), (crate(), 128, 40), (crate(), 126, 86)):
        prop_at(world, sp, x, y)
    return finish(world)


@card_art('BP-06')
def _art_bp06():
    world = ground_world('grass', 6)
    shadow(world, 74, 80, 52, 11)
    wf = upward_waterfall(h=44, w=14)
    ox, oy = 10, 8
    world.draw(wf, ox + 106 - wf.w // 2, oy + 38 - wf.h + 12, 20)
    isl = floating_island()
    world.draw(isl, ox, oy, 40)
    for (sp, x, y) in ((bush(2), 132, 90), (rock(1), 14, 90)):
        prop_at(world, sp, x, y)
    return finish(world)


@card_art('BU-04')
def _art_bu04():
    world = ground_world('cobble', 7)
    fr = bell_frame(2)
    fx, fy = 40, 17
    shadow(world, 74, 82, 30, 5)
    world.draw(fr, fx, fy, 82)
    # Glocken-Zwerg am Seil
    world.draw(bell_gnome(), fx + 46, fy + 41, 85)
    # Schallwellen
    arcs = Canvas(144, 96)
    sound_arcs(arcs, fx + 20, 40, side=-1, n=3)
    sound_arcs(arcs, fx + 46, 40, side=1, n=3)
    world.draw(arcs, 0, 0, 9000)
    # markierter Eindringling und fliehender Buerger
    unit_at(world, goblin('walk', 1), 126, 74, flip=True)
    world.draw(mark_arrow(), 122, 36, 9000)
    unit_at(world, citizen('cloth', 0), 16, 82, flip=True, sh=(5, 2))
    for (sp, x, y) in ((barrel(), 16, 38), (crate(), 128, 90)):
        prop_at(world, sp, x, y)
    return finish(world)
