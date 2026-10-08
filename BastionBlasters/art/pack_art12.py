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
    zielschatten(w, 36, 72, 20, 1)
    unit_at(w, catapult('load', 0), 34, 76, sh=(20, 4))
    mir = standing_mirror()
    mx, my = 94, 90
    prop_at(w, mir, mx, my)
    top = my - mir.h + 1
    # Schuss trifft den Spiegel (gelb, flach) und fliegt in hohem Bogen zurueck (weiss) auf den Schuetzen
    arc_dots(w, (50, 54), (78, top + 28), 5, n=10, col='gold', i0=3, i1=5)
    arc_dots(w, (76, top + 24), (38, 64), 34, n=22, col='bone', i0=4, i1=5, skip=2)
    spark(w, 78, top + 26, 'fire')
    plus(w, 78, top + 26, 'gold', 5)
    _stone(w, 56, 18)
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
    prop_at(w, coin_pile(22, 12, 2), 52, 78)
    prop_at(w, coin_pile(18, 11, 5), 112, 84)
    # Pluenderer schleicht heran
    unit_at(w, goblin('walk', 0), 28, 84)
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
    sub = w.px[:, :, :3]
    g = w.depth < -40
    sub[(d < 0.62) & chk & g] = np.array(RAMPS['fire'][3], np.uint8)
    sub[(d < 0.30) & g & ~chk] = np.array(RAMPS['teamA'][3], np.uint8)
    sub[(d < 0.30) & g & chk] = np.array(RAMPS['fire'][4], np.uint8)
    prop_at(w, btn, fx, fy)
    # Warnschild
    prop_at(w, warning_sign(), 118, 74)
    # Gnom schwitzt davor
    unit_at(w, spr_gnome('sweat'), 44, 84, sh=(7, 2))
    for (x, y) in ((32, 68), (55, 70), (34, 61), (58, 64), (30, 76)):
        for (dx, dy, i) in ((0, 0, 5), (0, 1, 4), (1, 1, 4), (0, 2, 3)):
            dot(w, x + dx, y + dy, 'ice', i)
    for (sp, x, y) in ((barrel(), 16, 40), (crate(), 128, 40)):
        prop_at(w, sp, x, y)
    return finish(w)


# =========================================================================== Raeume (Chaos)

from pack_art12_rooms import *

_ROWS32 = [".....", ".{L}{L}{L}.", ".{L}{L}{L}.", ".hhh.", "....."]
_ROWS33 = [".....", ".{L}{L}{L}.", ".{L}{L}{L}.", ".{L}{L}{L}.", ".hhh.", "....."]


def _room32(letter, theme, seed, ground='purple'):
    world = ground_world(ground, seed, 160, 160)
    rows = [r.format(L=letter) for r in _ROWS32]
    c, out = mini_castle(rows, 0, 0, world, themes={letter: theme})
    return world, out


def _room33(letter, theme, seed, ground='purple'):
    world = ground_world(ground, seed, 160, 192)
    rows = [r.format(L=letter) for r in _ROWS33]
    c, out = mini_castle(rows, 0, 0, world, themes={letter: theme})
    return world, out


def _tint_floor(world, x0, y0, x1, y1, ramp, idx, chk=True):
    """Bodenfleck (Schachbrett) fuer Licht/Glanz auf Bodenpixeln"""
    Y, X = np.mgrid[y0:y1, x0:x1]
    m = (world.depth[y0:y1, x0:x1] < -40)
    if chk:
        m &= ((X + Y) % 2 == 0)
    world.px[y0:y1, x0:x1, :3][m] = np.array(RAMPS[ramp][idx], np.uint8)


# --------------------------------------------------------------------------- BC-04 Sway Hall


def stage_curtain():
    c = Canvas(48, 24)
    for x in range(48):
        for y in range(24):
            # Vorhang: zwei Bahnen, in der Mitte offen, oben Schabracke
            mid = abs(x - 23.5)
            if y < 5:
                idx = 3 if (x // 3) % 2 else 2
                c.put_ramp(x, y, 'teamA', idx)
                continue
            if mid < 9:
                c.put_ramp(x, y, 'purple', 1 if (x + y) % 5 else 0)       # Hinterbuehne (dunkel)
                continue
            fold = (x // 3) % 3
            idx = (4, 3, 2)[fold]
            if y > 20:
                idx -= 1
            c.put_ramp(x, y, 'teamA', idx)
    hline(c, 0, 47, 5, 'gold', 4)
    for x in range(1, 47, 4):
        c.put_ramp(x, 6, 'gold', 3)
        c.put_ramp(x, 7, 'gold', 2)
    # Raffung mit Quaste
    for (x, side) in ((13, 1), (34, -1)):
        c.rect(x, 12, x + 1, 13, 'gold', 5)
        c.rect(x, 14, x + 1, 17, 'gold', 3)
    c.outline()
    return c


def furnish_sway(ctx):
    P = ctx.P
    X0, Y0, W = ctx.X0, ctx.Y0, ctx.W
    ctx.decor(stage_curtain(), X0 + 48)
    ctx.decor(karaoke_screen(), X0 + 17)
    ctx.decor(P['window'], X0 + W - 12)
    ctx.prop(speaker(), X0 + 3, Y0 + 5)
    ctx.prop(speaker(), X0 + W - 22, Y0 + 5)
    ctx.floor_deco(light_spots(), X0 + 4, Y0 + 14)
    ctx.prop(stage(44), X0 + 26, Y0 + 14)


THEME_SWAY = {'floor': floor_dance(), 'furnish': furnish_sway, 'low': False}


@card_art('BC-04')
def _art_bc04():
    w, out = _room32('Y', THEME_SWAY, 4)
    # Disco-Kugel haengt ueber der Tanzflaeche (rechts), Troll am Mikro auf der Buehne
    ball = disco_ball()
    w.draw(ball, 112 - ball.w // 2, 10, 9000)
    tr = spr_mic_troll()
    w.draw(tr, 80 - tr.w // 2, 57 - tr.h + 1, 75)
    # Tanzende Feinde und Freunde (Schunkeln: Noten + Schwung)
    unit_at(w, citizen('cloth', 0), 46, 82, sh=(5, 2))
    unit_at(w, spr_gnome('cheer'), 62, 83, sh=(6, 2))
    unit_at(w, skeleton('walk', 0), 96, 84, sh=(8, 3))
    unit_at(w, goblin('walk', 2), 116, 80, flip=True, sh=(8, 3))
    for (sp, x, y) in ((music_note('gold', 0), 46, 52), (music_note('ice', 1), 108, 54),
                       (music_note('teamA', 0), 100, 70), (music_note('slime', 1), 54, 70)):
        w.draw(sp, x, y, 9100)
    return finish(crop_world(w, 8, 6))


# --------------------------------------------------------------------------- BC-07 Bounce Hall


def furnish_bounce(ctx):
    P = ctx.P
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(padded_wall(), X0 + W // 2)
    ctx.floor_deco(bounce_pad(52, 24), X0 + 4, Y0 + 20)
    ctx.prop(ball_pit(), X0 + W - 48, Y0 + 6)


THEME_BOUNCE = {'floor': floor_rubber(), 'furnish': furnish_bounce, 'low': False}


@card_art('BC-07')
def _art_bc07():
    w, out = _room32('J', THEME_BOUNCE, 7)
    # Feind wird vom Sprungfeld nach oben geschleudert (leicht gekippt), Schatten auf der Matte, Pfeile nach oben
    sk = rotate(skeleton('walk', 1), -16)
    shadow(w, 60, 70, 8, 2.5)
    w.draw(sk, 60 - sk.w // 2, 41 - sk.h // 2, 9200)
    w.draw(up_arrow('gold'), 44, 52, 9100)
    w.draw(up_arrow('gold'), 74, 54, 9100)
    plus(w, 46, 34, 'gold', 5)
    plus(w, 76, 40, 'ice', 5)
    # Baelle + hopsende Gnome
    prop_at(w, beach_ball(8), 46, 83)
    prop_at(w, beach_ball(5, ('purple', 'bone', 'fire', 'bone')), 100, 83)
    unit_at(w, spr_gnome('cheer', coat='slime'), 116, 84, sh=(6, 2))
    gn = spr_gnome('jump')
    shadow(w, 86, 80, 6, 2)
    w.draw(gn, 86 - gn.w // 2, 40, 9200)
    return finish(crop_world(w, 8, 6))


# --------------------------------------------------------------------------- BC-08 Slow-Motion Tea Salon


def furnish_salon(ctx):
    P = ctx.P
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(P['window'], X0 + 14)
    ctx.decor(wall_clock(), X0 + W // 2)
    ctx.decor(P['window'], X0 + W - 14)
    ctx.floor_deco(rug(64, 30, 'teamB'), X0 + 16, Y0 + 22)
    ctx.prop(salon_chair(), X0 + 8, Y0 + 12)
    ctx.prop(salon_chair(), X0 + W - 24, Y0 + 12)
    ctx.prop(tea_table(), X0 + W // 2 - 23, Y0 + 20)


THEME_SALON = {'floor': floor_salon(), 'furnish': furnish_salon, 'low': False}


@card_art('BC-08')
def _art_bc08():
    w, out = _room32('E', THEME_SALON, 5)
    tx, ty = 80 - 23, 52                       # linke obere Ecke des Tisches
    top_y = ty + 11
    # auf dem Tisch
    w.draw(teapot(), tx + 6, top_y - 11, 9000)
    w.draw(cake_stand(), tx + 28, top_y - 14, 9000)
    w.draw(teacup(False), tx + 17, top_y - 7, 9000)
    # schwebende Tassen (Zeit steht still) mit Dampf
    for (x, y) in ((tx + 4, ty - 6), (tx + 24, ty - 16), (tx + 38, ty - 2)):
        w.draw(teacup(True), x, y, 9100)
    # eingefrorener Tee-Strahl aus der Kanne + Schwebetropfen
    w.draw(teaspill_stream(10), tx + 21, top_y - 12, 9100)
    for (x, y) in ((tx + 12, ty - 3), (tx + 30, ty - 10), (tx + 44, ty + 3), (tx + 1, ty - 14), (tx + 34, ty - 20)):
        dot(w, x, y, 'wood', 5)
        dot(w, x, y + 1, 'wood', 4)
        dot(w, x + 1, y + 1, 'wood', 3)
    # Gaeste: Skelett (Feind, schlaefrig) rechts, Buerger links, Schnecke am Boden
    unit_at(w, skeleton('idle', 0), 112, 72, flip=True, sh=(8, 3))
    w.draw(teacup(True), 100, 52, 9100)
    unit_at(w, citizen('cloth', 0), 46, 74, sh=(5, 2))
    prop_at(w, spr_snail(), 62, 82)
    return finish(crop_world(w, 8, 6))


# --------------------------------------------------------------------------- BC-03 Dragon Egg Incubator


def furnish_nest(ctx):
    P = ctx.P
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(thermometer(), X0 + 14)
    ctx.decor(P['window'], X0 + W // 2)
    ctx.decor(pressure_gauge(), X0 + W - 14)
    ctx.floor_deco(blanket_rug(64, 32), X0 + W // 2 - 32, Y0 + 28)
    ctx.floor_deco(warm_beam(36, 26), X0 + 6, Y0 + 28)
    ctx.floor_deco(warm_beam(36, 26), X0 + W - 42, Y0 + 28)
    ctx.prop(heat_lamp(), X0 + 5, Y0 + 12)
    ctx.prop(heat_lamp(), X0 + W - 25, Y0 + 12)
    ctx.prop(dragon_egg_nest(), X0 + W // 2 - 24, Y0 + 26)
    ctx.prop(hay_bale(), X0 + 5, Y0 + 58)
    ctx.prop(P['barrel'], X0 + W - 20, Y0 + 54)


THEME_NEST = {'floor': floor_hay(), 'furnish': furnish_nest, 'low': False}


@card_art('BC-03')
def _art_bc03():
    w, out = _room33('N', THEME_NEST, 3)
    # Waermeglitzer ueber dem Nest
    for (x, y, c_) in ((66, 54, 'fire'), (96, 50, 'gold'), (80, 46, 'gold')):
        plus(w, x, y, c_, 5)
    unit_at(w, spr_gnome('point'), 112, 106, flip=True, sh=(6, 2))
    return finish(crop_world(w, 8, 14))


# --------------------------------------------------------------------------- BC-05 Gravity Inverter


def furnish_gravity(ctx):
    P = ctx.P
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(P['window'], X0 + 14)
    ctx.decor(P['window'], X0 + W - 14)
    ctx.floor_deco(gravity_plate(64, 32), X0 + W // 2 - 32, Y0 + 44)
    ctx.prop(inverter_machine(), X0 + W // 2 - 17, Y0 + 2)


THEME_GRAV = {'floor': floor_gravity(), 'furnish': furnish_gravity, 'low': False}


def _float(w, spr, cx, cy, sx=None, sy=None, srx=7, sry=2.5):
    """schwebendes Objekt (Mitte cx, cy) mit kleinem Schatten weit unten"""
    if sx is not None:
        shadow(w, sx, sy, srx, sry)
    w.draw(spr, int(cx - spr.w / 2), int(cy - spr.h / 2), 9000 + int(cy))


@card_art('BC-05')
def _art_bc05():
    w, out = _room33('G', THEME_GRAV, 5)
    P = props_for('teamA')
    _float(w, vflip(P['plant']), 44, 50, 48, 96, 6, 2.2)
    _float(w, vflip(salon_chair()), 53, 72, 56, 100, 7, 2.5)
    _float(w, flying_carpet(), 50, 94, 54, 108, 15, 2.5)
    _float(w, rotate(vflip(P['crate']), 18), 114, 48, 116, 96, 7, 2.5)
    _float(w, vflip(skeleton('idle', 0)), 108, 74, 110, 106, 9, 3)
    # aufsteigende Pfeile + Schwebestaub (Kiesel und Funken)
    for (x, y) in ((70, 58), (90, 56), (80, 40)):
        w.draw(up_arrow('purple'), x, y, 9500)
    for (x, y, c_) in ((40, 70, 'purple'), (122, 60, 'purple'), (96, 34, 'ice'), (62, 40, 'gold')):
        plus(w, x, y, c_, 5)
    for (x, y) in ((74, 100), (88, 96), (70, 90)):
        sp = Canvas(4, 4)
        ellipse(sp, 2, 2, 1.8, 1.8, 'stone', lo=1, hi=5)
        sp.outline()
        w.draw(sp, x, y, 9400)
    return finish(crop_world(w, 8, 14))
