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
    unit_at(world, spr_recruit(), 86, 80, sh=(6, 2))
    # linker Hof: Warteschlange; rechter Hof: Waffenstaender
    unit_at(world, skeleton('idle', 1), 46, 100, sh=(8, 3))
    prop_at(world, signpost(), 36, 66)
    prop_at(world, rack(), 148, 60)
    prop_at(world, barrel(), 142, 92)
    # Papagei ruft den Rekruten an (Schallbogen)
    for (dx, dy, i) in ((0, 0, 5), (-1, 1, 4), (-1, 2, 4), (0, 3, 5), (-4, -2, 4), (-5, -1, 3), (-5, 1, 3), (-5, 3, 3), (-4, 5, 4)):
        px_at(world, 103 + dx, 52 + dy, 'gold', i, 9000)
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


# --------------------------------------------------------------------------- BU-07 Slide


@card_art('BU-07')
def _art_bu07():
    w = ground_world('cobble', 9)
    sl = slide_sprite()
    fx, fy = 26, 78                      # linke Kante, Bodenlinie des Sprites
    # nasser Boden um die Pfuetze
    H, W = w.h, w.w
    Y, X = np.mgrid[0:H, 0:W]
    dd = np.hypot((X - (fx + 80)) / 30.0, (Y - (fy - 2)) / 10.0)
    ground = w.depth < -40
    shade_mask(w, (dd < 1.0) & ground & (((X + Y) % 2) == 0), -1)
    shade_mask(w, (dd < 0.6) & ground, -1)
    shadow(w, fx + 18, fy - 4, 18, 3)
    w.draw(sl, fx, fy - sl.h + 4, fy)
    # Rutscher auf der Bahn (Bahn: Suedkante y_a + (x - x_a) * slope)
    sx, sy = fx + 28 + 18, fy - sl.h + 4 + 22 + 10
    w.draw(spr_slider(), sx - 11, sy - 18, fy + 2)
    w.draw(spr_slider(kind='teamA', species='goblin'), fx + 28 + 46 - 16, fy - sl.h + 4 + 22 + 25 - 20, fy + 3)
    splash_drops(w, fx + 80, fy - 7)
    d = duck()
    w.draw(d, fx + 84, fy - 14, fy + 4)
    unit_at(w, spr_cheer_citizen(kind='dirt'), 30, 92, sh=(5, 2))
    for (sp, x, y) in ((barrel(), 14, 34), (crate(), 128, 34)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BU-09 Recall Portal


@card_art('BU-09')
def _art_bu09():
    w = ground_world('cobble', 11)
    pt = portal_sprite()
    px0, py_foot = 96, 82
    shadow(w, px0 + 2, py_foot - 4, 30, 5)
    w.draw(pt, px0 - pt.w // 2, py_foot - pt.h + 1, py_foot)
    # Wirbel-Leuchten: Boden rund ums Portal etwas heller
    lighten_disc(w, px0, py_foot - 6, 28, 1, ring=0.5)
    # verletztes Skelett loest sich auf und strudelt ins Portal
    rng = random.Random(5)
    sk, parts = dissolve_sprite(bandaged_skeleton(2), rng, 18, 0.95)
    sx, sy = 42, 88
    w.draw(sk, sx - sk.w // 2, sy - sk.h + 1, sy)
    tx, ty = px0 - 4, py_foot - 34
    for (x, y, t) in parts:
        wx, wy = sx - sk.w // 2 + x, sy - sk.h + 1 + y
        f = 0.10 + 0.85 * t
        qx, qy = wx + (tx - wx) * f, wy + (ty - wy) * f - 7 * math.sin(f * math.pi)
        qx, qy = int(qx), int(qy)
        px_at(w, qx, qy, 'bone' if rng.random() < 0.5 else 'ice', 5, 9000)
        px_at(w, qx - 1, qy, 'purple', 4, 9000)
        if rng.random() < 0.4:
            px_at(w, qx + 1, qy, 'ice', 4, 9000)
    for (x, y) in ((64, 50), (76, 40), (112, 24)):
        star(w, x, y, 'ice', False)
    prop_at(w, portal_sign(), 30, 52)
    for (sp, x, y) in ((barrel(), 130, 24), (crate(), 134, 92)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BA-01 Shield Dome Generator


@card_art('BA-01')
def _art_ba01():
    w = ground_world('cobble', 13)
    g = dome_generator()
    gx, gy = 72, 66
    shadow(w, gx + 3, gy - 4, 16, 4)
    w.draw(g, gx - g.w // 2, gy - g.h + 1, gy)
    # Buerger unter der Kuppel schauen hoch
    unit_at(w, citizen('cloth', 0), 44, 74, sh=(5, 2))
    unit_at(w, citizen('dirt', 1), 104, 70, flip=True, sh=(5, 2))
    for (sp, x, y) in ((barrel(), 20, 34), (crate(), 126, 90)):
        prop_at(w, sp, x, y)
    # Granate kommt von rechts oben und prallt an der Kuppel ab
    ix, iy = 118, 30
    shell = stone_projectile_small()
    for (x, y) in arc_points(144, 0, ix + 4, iy - 3, 10, 10)[:-1]:
        px_at(w, int(x), int(y), 'fire', 4, 9700)
        px_at(w, int(x) + 1, int(y), 'bone', 5, 9700)
    dome_overlay(w, 72, 50, 56, 39, impact=(ix, iy))
    w.draw(shell, ix - 5, iy - 8, 9900)
    star(w, ix + 4, iy - 10, 'gold', True, 9950)
    star(w, ix - 9, iy + 1, 'fire', False, 9950)
    for (x, y) in ((28, 30), (124, 62), (42, 78), (96, 14)):
        star(w, x, y, 'ice', False, 9950)
    return finish(w)


# --------------------------------------------------------------------------- BA-03 Net Launcher


@card_art('BA-03')
def _art_ba03():
    w = ground_world('cobble', 15)
    nl = net_launcher()
    nx, nfoot = 42, 82
    shadow(w, nx, nfoot - 5, 24, 4)
    w.draw(nl, nx - nl.w // 2, nfoot - nl.h + 3, nfoot)
    # Frosch wirft zurueck zum Schuetzen (gegnerisches Katapult rechts)
    unit_at(w, spr_frog(), 84, 82, sh=(10, 3))
    cat = catapult('load', 0)
    unit_at(w, cat, 118, 80, flip=True, team_swap=True, sh=(20, 4))
    ball_s = ball(3.2)
    pts = arc_points(96, 62, 118, 60, 16, 9)
    for (x, y) in pts[1:-1]:
        px_at(w, int(x), int(y), 'bone', 5, 9000)
        px_at(w, int(x) + 1, int(y), 'bone', 3, 9000)
    w.draw(ball_s, 104 - ball_s.w // 2, 49 - ball_s.h // 2, 9100)
    zielschatten(w, 118, 80, 12, 1)
    for (sp, x, y) in ((barrel(), 14, 34), (crate(), 130, 32)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BA-02 Smog Chimney


@card_art('BA-02')
def _art_ba02():
    world = ground_world('grass', 17, 192, 160)
    rows = [".....", ".Thh.", ".hhh.", "....."]
    c, out = mini_castle(rows, 0, 1, world, tw=chimney_tower())
    cr = Canvas(24, 14)
    ellipse(cr, 12, 7, 10, 5, 'coal', lo=0, hi=2)
    ellipse(cr, 12, 7, 6, 3, 'coal', lo=0, hi=1)
    cr.outline()
    world.draw(cr, 80 - 12, 98 - 7, -48)
    # Nebelbank ueber dem Hof (rosa getoent: innen voll, aussen Schachbrett)
    H, W = world.h, world.w
    Y, X = np.mgrid[0:H, 0:W]
    nz = 0.5 * smooth_noise(W, H, 14, 5) + 0.5 * smooth_noise(W, H, 7, 6)
    d = np.hypot((X - 112) / 46.0, (Y - 92) / 24.0) + (nz - 0.5) * 0.9
    ground = world.depth < -40
    tint_pink(world, (d < 0.62) & ground, 1)
    tint_pink(world, (d >= 0.62) & (d < 0.95) & ground & (((X + Y) % 2) == 0), 1)
    # Zielmarke (gedachter Einschlag) im Nebel, Einschlag eine Zelle daneben
    zielschatten(world, 112, 90, 12, 1)
    # Rauchfahne: Schlotoeffnung ca. (48, 46) in Weltkoordinaten, treibt nach rechts
    plume = [(48, 43, 4), (50, 37, 6), (58, 32, 8), (70, 30, 9), (84, 32, 9), (98, 37, 9), (110, 45, 9), (118, 57, 8)]
    low = [(134, 76, 7), (100, 90, 6)]
    smog_puffs(world, plume + low)
    # Schuss kommt von rechts oben, verschwindet im Nebel, Einschlag daneben
    ix, iy = 80, 98
    for (x, y) in arc_points(190, 28, ix + 2, iy - 8, 30, 24)[3:-1]:
        px_at(world, int(x), int(y), 'bone', 5, 9500)
        px_at(world, int(x) + 1, int(y), 'fire', 4, 9500)
    shell = stone_projectile_small()
    world.draw(shell, ix - 7, iy - 22, 9600)
    for (dx, dy, i) in ((0, 0, 5), (-2, -1, 4), (2, -1, 4), (-1, 2, 4), (1, 2, 3)):
        px_at(world, ix + dx + 6, iy + dy - 9, 'fire', i, 9600)
    return finish(crop_world(world, 8, 17))


# --------------------------------------------------------------------------- BA-04 Lightning Rod


@card_art('BA-04')
def _art_ba04():
    world = ground_world('grass', 19, 192, 160)
    rows = [".....", ".hhT.", ".hhh.", "....."]
    c, out = mini_castle(rows, 0, 1, world, tw=rod_tower())
    rng = random.Random(4)
    # Gewitterstimmung: alles eine Stufe dunkler, Wolkenband am oberen Rand
    dim_world(world, 1)
    H, W = world.h, world.w
    Y, X = np.mgrid[0:H, 0:W]
    nz = 0.6 * smooth_noise(W, H, 16, 8) + 0.4 * smooth_noise(W, H, 8, 9)
    edge = 22 + (nz - 0.5) * 26
    chk = ((X + Y) % 2 == 0)
    cl = np.array(RAMPS['coal'], np.uint8)
    full = (Y < edge - 3)
    half = (Y < edge + 1) & ~full & chk
    dark = (Y < edge - 10) & chk
    world.px[:, :, :3][full] = cl[2]
    world.px[:, :, :3][half] = cl[2]
    world.px[:, :, :3][dark] = cl[1]
    m = full | half
    world.depth[m] = np.maximum(world.depth[m], 8000)
    # Arkan-Geschoss (lila) wird zur Spitze hin abgelenkt (die Bahn knickt ein)
    tipx, tipy = 112, 26
    p0, p1, p2 = (8, 126), (70, 104), (tipx - 5, tipy + 9)
    trail = []
    for k in range(0, 31):
        t = k / 30.0
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        trail.append((x, y))
    for k, (x, y) in enumerate(trail[:-4]):
        if k % 2 == 0:
            px_at(world, int(x), int(y), 'purple', 2 + min(3, k // 8), 9300)
            if k > 12:
                px_at(world, int(x), int(y) - 1, 'purple', 4, 9300)
                px_at(world, int(x) + 1, int(y), 'purple', 3, 9300)
    ox, oy = trail[-5]
    orb = Canvas(11, 11)
    ellipse(orb, 5.5, 5.5, 4.4, 4.4, 'purple', lo=2, hi=5)
    orb.rect(4, 4, 6, 6, 'bone', 5)
    orb.outline()
    world.draw(orb, int(ox) - 5, int(oy) - 5, 9310)
    # Blitz aus dem Wolkenband direkt in die Nadel, kurzer Nebenast
    pts = bolt_points(94, 14, tipx, tipy - 1, rng, jag=5, steps=5)
    draw_bolt(world, pts, thick=True)
    draw_bolt(world, bolt_points(pts[2][0], pts[2][1], 84, 50, rng, jag=3, steps=3))
    # Blitzschein ueber der Szene
    lighten_disc(world, tipx, tipy + 10, 36, 1, ring=0.45)
    # Buerger im Hof: Haare zu Berge
    unit_at(world, spr_cheer_citizen(kind='cloth', shocked=True), 66, 100, sh=(5, 2))
    # Funken sprueht es von der Kugel
    for (x, y, big) in ((tipx - 14, tipy + 6, False), (tipx + 12, tipy + 4, False), (tipx - 9, tipy + 20, False), (tipx + 15, tipy + 16, False),
                        (tipx - 4, tipy - 4, True)):
        star(world, x, y, 'gold' if not big else 'bone', big, 9900)
    for (x, y) in ((tipx - 17, tipy + 13), (tipx + 18, tipy + 10), (tipx - 12, tipy + 30), (tipx + 7, tipy - 8)):
        px_at(world, x, y, 'bone', 5, 9900)
        px_at(world, x + 1, y + 1, 'ice', 4, 9900)
    return finish(crop_world(world, 8, 10))
