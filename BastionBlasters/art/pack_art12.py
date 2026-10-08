"""pack_art12: Chaos- und Wehr-Bauten (BA-05, BA-06, BC-01 .. BC-09)."""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art12_kit import *
from pack_art12_units import *
from pack_art12_yard import *


def _stone(world, cx, cy, key=9100):
    sp = stone_projectile_small()
    world.draw(sp, int(cx - sp.w // 2), int(cy - sp.h // 2), key)


# --------------------------------------------------------------------------- BA-05 Trampoline Roof


@card_art('BA-05')
def _art_ba05():
    w = ground_world('cobble', 5)
    house = trampoline_roof()
    fx, fy = 72, 90
    prop_at(w, house, fx, fy)
    top = fy - house.h + 1
    # Granate prallt ab: ankommende (gelb) + zurueckgeworfene (weiss) Bahn
    arc_dots(w, (6, 8), (38, top + 12), 4, n=16, col='gold', i0=3, i1=5)
    _stone(w, 40, top + 4)
    arc_dots(w, (54, top + 12), (118, 12), 18, n=24, col='bone', i0=4, i1=5)
    _stone(w, 122, 16)
    spark(w, 52, top + 12, 'gold')
    # Gnom huepft zum Spass
    gn = spr_gnome('jump')
    w.draw(gn, 82 - gn.w // 2, top + 14 - gn.h + 1, 9200)
    for k in range(3):
        dot(w, 70 + k * 3, top + 18 - (k % 2), 'bone', 4)
    for (sp, x, y) in ((barrel(), 14, 90), (crate(), 130, 88)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BA-06 Mirror of Retribution


@card_art('BA-06')
def _art_ba06():
    w = ground_world('cobble', 11)
    # Katapult links (laedt), Zielmarke unter ihm: der Schuss kommt zurueck
    zielschatten(w, 33, 78, 17, 1)
    unit_at(w, catapult('load', 0), 33, 84, sh=(20, 4))
    mir = standing_mirror()
    mx, my = 96, 90
    prop_at(w, mir, mx, my)
    top = my - mir.h + 1
    # Schuss trifft den Spiegel (gelb) und fliegt zurueck (weiss)
    arc_dots(w, (46, 40), (82, top + 28), 14, n=12, col='gold', i0=3, i1=5)
    arc_dots(w, (80, top + 24), (36, 66), 20, n=16, col='bone', i0=4, i1=5, skip=2)
    spark(w, 82, top + 26, 'fire')
    plus(w, 82, top + 26, 'gold', 5)
    _stone(w, 64, 28)
    for (sp, x, y) in ((barrel(), 128, 50), (crate(), 130, 90), (bush(2), 12, 44)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BC-01 Wishing Well


@card_art('BC-01')
def _art_bc01():
    w = ground_world('purple', 7)
    cobble_patch(w, 72, 74, 46, 17, seed=6)
    well = wishing_well()
    fx, fy = 72, 86
    prop_at(w, well, fx, fy)
    top = fy - well.h + 1
    # Frosch auf dem Rand
    fr = spr_frog()
    w.draw(fr, fx - 18, top + 38, fy + 5)
    # Muenzen am Boden
    for (x, y) in ((50, 86), (96, 84), (104, 88), (44, 78)):
        for (dx, dy, i) in ((0, 0, 5), (1, 0, 4), (0, 1, 3), (1, 1, 2)):
            dot(w, x + dx, y + dy, 'gold', i, 90)
    # Buerger wirft eine Muenze
    unit_at(w, citizen('cloth', 1), 114, 84, flip=True, sh=(5, 2))
    arc_dots(w, (108, 70), (84, top + 34), 16, n=12, col='gold', i0=3, i1=5, skip=0)
    star4(w, 92, top + 14, 'gold')
    # Wunsch-Funkeln ueber dem Dach
    for (x, y, c_) in ((58, 6, 'purple'), (86, 8, 'gold'), (72, 4, 'bone'), (100, 20, 'purple'), (46, 20, 'gold')):
        plus(w, x, y, c_, 5)
    for (sp, x, y) in ((giant_mushroom(2, 'purple'), 20, 60), (rock(1), 128, 52)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BC-02 Cuckoo Clock


@card_art('BC-02')
def _art_bc02():
    w = ground_world('cobble', 9)
    ck = cuckoo_clock_tower()
    fx, fy = 44, 90
    prop_at(w, ck, fx, fy)
    top = fy - ck.h + 1
    # Treffer-Stern an der Faust des Kuckucks
    gx, gy = fx - ck.w // 2 + 17 + 27, top + 32 - 18 + 12
    star4(w, gx + 6, gy, 'gold')
    # betaeubter Eindringling: Sternchen, Teleport-Ring am Boden
    sx, sy = 104, 80
    Y, X = np.mgrid[0:w.h, 0:w.w]
    d = ((X + 0.5 - sx) / 17.0) ** 2 + ((Y + 0.5 - (sy - 2)) / 5.5) ** 2
    ring = (np.abs(d - 1.0) < 0.28) & (w.depth < -40)
    w.px[:, :, :3][ring & ((X + Y) % 2 == 0)] = np.array(RAMPS['purple'][4], np.uint8)
    w.px[:, :, :3][ring & ((X + Y) % 2 == 1)] = np.array(RAMPS['purple'][3], np.uint8)
    unit_at(w, skeleton('idle', 1), sx, sy)
    for (dx, dy) in ((-9, -31), (11, -29), (2, -39)):
        star4(w, sx + dx, sy + dy, 'gold')
    for (x, y) in ((88, 62), (122, 66), (96, 58)):
        plus(w, x, y, 'purple', 5)
    # naechster Eindringling naht
    unit_at(w, skeleton('walk', 1), 126, 56, flip=True)
    for (sp, x, y) in ((barrel(), 132, 90), (crate(), 92, 30)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BC-06 Living Treasure Chest


@card_art('BC-06')
def _art_bc06():
    w = ground_world('purple', 4)
    cobble_patch(w, 78, 70, 50, 20, seed=13)
    # roter Teppich als Koeder
    w.draw(rug(40, 22, 'teamA'), 58, 56, -49)
    ch = living_chest()
    fx, fy = 78, 76
    prop_at(w, ch, fx, fy)
    top = fy - ch.h + 1
    # Goldspur zur Truhe, Goldglitzern auf den Zaehnen
    for (x, y) in ((36, 86), (44, 82), (52, 80), (88, 66)):
        for (dx, dy, i) in ((0, 0, 5), (1, 0, 4), (0, 1, 3), (1, 1, 2)):
            dot(w, x + dx, y + dy, 'gold', i, 90)
    star4(w, fx - 12, top + 14, 'bone')
    star4(w, fx + 10, top + 15, 'gold')
    # Pluenderer schleicht heran
    unit_at(w, goblin('walk', 0), 28, 82)
    for (sp, x, y) in ((crate(), 128, 42), (barrel(), 18, 40), (giant_mushroom(1, 'purple'), 124, 90)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BC-09 The Red Button


@card_art('BC-09')
def _art_bc09():
    w = ground_world('cobble', 14)
    btn = red_button()
    fx, fy = 76, 76
    # roter Warnschein auf dem Boden (Schachbrett-Dither)
    Y, X = np.mgrid[0:w.h, 0:w.w]
    d = ((X + 0.5 - fx) / 44.0) ** 2 + ((Y + 0.5 - (fy - 4)) / 17.0) ** 2
    chk = (X + Y) % 2 == 0
    m = ((d < 0.5) & chk) | ((d < 0.2))
    sub = w.px[:, :, :3]
    sub[m & (w.depth < -40)] = np.array(RAMPS['teamA'][2], np.uint8)
    prop_at(w, btn, fx, fy)
    # Warnschild
    prop_at(w, warning_sign(), 118, 74)
    # Gnom schwitzt davor
    unit_at(w, spr_gnome('sweat'), 44, 84, sh=(7, 2))
    for (x, y) in ((32, 66), (56, 70), (34, 60), (58, 63)):
        dot(w, x, y, 'ice', 5)
        dot(w, x, y + 1, 'ice', 4)
    for (sp, x, y) in ((barrel(), 16, 40), (crate(), 128, 40)):
        prop_at(w, sp, x, y)
    return finish(w)
