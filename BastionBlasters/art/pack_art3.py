"""pack_art3: Karten-Dioramen fuer US-11 .. US-23 (Sturm-Einheiten in Bewegung).

Sprites liegen in pack_art3_a.py (US-11..15), pack_art3_b.py (US-16..19), pack_art3_c.py (US-20..23),
gemeinsame Helfer in pack_art3_lib.py. Dieses Modul registriert die Dioramen (@card_art).
"""
from __future__ import annotations

from pack_art3_lib import *
from pack_art3_a import *
from pack_art3_b import *
from pack_art3_c import *


# --------------------------------------------------------------------------- kleine Szenen-Helfer


def _flame_cone(world, x0, y0, x1, y1, w0, w1, seed=0, depth=8500, bend=0.0):
    """Feueratem als Kegel von (x0, y0) nach (x1, y1): gelber Kern, rote Zungen, Schachbrett-Dither am Rand"""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    pad = int(w1 + abs(bend) + 4)
    xs0, xs1 = int(min(x0, x1) - pad), int(max(x0, x1) + pad)
    ys0, ys1 = int(min(y0, y1) - pad), int(max(y0, y1) + pad)
    for y in range(max(0, ys0), min(world.h, ys1)):
        for x in range(max(0, xs0), min(world.w, xs1)):
            qx, qy = x + 0.5 - x0, y + 0.5 - y0
            t = (qx * ux + qy * uy) / ln
            if t < 0 or t > 1:
                continue
            s = qx * nx + qy * ny - bend * math.sin(math.pi * t)
            s -= 1.6 * math.sin(t * 17.0 + seed * 1.7) * t
            h = (w0 + (w1 - w0) * t ** 0.9) / 2.0
            h *= 0.72 + 0.5 * texture_noise(int(t * 11), 1 + (s > 0), seed)
            a = abs(s) / max(h, 0.5)
            if a > 1.0:
                continue
            chk = (x + y) % 2 == 0
            v = a * 0.8 + 0.6 * t
            if v < 0.30:
                idx, ramp = 5, 'gold'
            elif v < 0.50:
                idx, ramp = (5, 'gold') if chk else (4, 'gold')
            elif v < 0.72:
                idx, ramp = (4, 'gold') if chk else (5, 'fire')
            elif v < 0.92:
                idx, ramp = (5, 'fire') if chk else (4, 'fire')
            elif v < 1.12:
                if not chk:
                    idx, ramp = 4, 'fire'
                else:
                    idx, ramp = 3, 'fire'
            elif v < 1.3:
                if not chk:
                    continue
                idx, ramp = 3, 'fire'
            else:
                if not (chk and (x // 2 + y) % 2 == 0):
                    continue
                idx, ramp = 2, 'fire'
            put_world(world, x, y, ramp, idx, depth)


def _spore_cloud(world, cx, cy, r, seed=1, depth=7000, ramp='slime'):
    """giftgruene Sporenwolke / Rauchwolke (Boden, Schachbrett-Rand)"""
    rnd = random.Random(seed)
    blobs = [(cx, cy, r)] + [(cx + rnd.randint(-r, r), cy + rnd.randint(-r // 2, r // 2), max(2, int(r * rnd.uniform(0.45, 0.7))))
                              for _ in range(4)]
    for (bx, by, br) in blobs:
        for y in range(int(by - br - 1), int(by + br * 0.8 + 2)):
            for x in range(int(bx - br - 1), int(bx + br + 2)):
                d = math.hypot((x + 0.5 - bx) / br, (y + 0.5 - by) / (br * 0.75))
                if d > 1.0:
                    continue
                chk = (x + y) % 2 == 0
                if d < 0.45:
                    idx = 4 if (x + y) % 3 else 5
                elif d < 0.8:
                    idx = 3 if chk else 4
                else:
                    if not chk:
                        continue
                    idx = 2
                put_world(world, x, y, ramp, idx, depth)


def _slush(world, cx, cy, rx, ry, depth=-60):
    """Schneematsch-Pfuetze: graublau, Schachbrett-Rand"""
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            n = texture_noise(x // 2, y // 2, 4) * 0.25
            d += n
            if d > 1.0 or not (0 <= x < world.w and 0 <= y < world.h):
                continue
            chk = (x + y) % 2 == 0
            if d < 0.55:
                ramp, idx = ('metal', 2) if chk else ('ice', 1)
            elif d < 0.85:
                ramp, idx = ('metal', 3) if chk else ('metal', 2)
            else:
                ramp, idx = ('metal', 4) if chk else ('metal', 3)
            world.px[y, x, :3] = RAMPS[ramp][idx]
            world.depth[y, x] = depth


def _arc_dots(world, p0, p1, p2, n, ramp='bone', idx=5, depth=9000, skip=1):
    pts = bezier(p0, p1, p2, p2, n)
    for k, (x, y) in enumerate(pts):
        if k % (skip + 1) == 0:
            put_world(world, int(x), int(y), ramp, idx, depth)
            put_world(world, int(x) + 1, int(y), ramp, max(2, idx - 1), depth)


def _coin():
    c = Canvas(6, 5)
    ellipse(c, 3, 2.5, 2.6, 1.8, 'gold', lo=2, hi=5)
    c.put_ramp(2, 2, 'gold', 5)
    c.outline()
    return c


def _carrot():
    c = Canvas(15, 7)
    cone(c, (4, 3), (14, 4), 5.0, 'fire', 2, 5)
    for (x0, y0, x1, y1) in ((3, 2, 0, 0), (3, 3, 0, 3), (3, 4, 0, 6)):
        c.line(x0, y0, x1, y1, 'leaf', 3)
    c.put_ramp(8, 3, 'fire', 2)
    c.put_ramp(8, 4, 'fire', 2)
    c.outline()
    return c


def _bucket():
    c = Canvas(11, 9)
    poly(c, [(3, 1), (7, 1), (9.5, 7), (0.5, 7)], 'metal', lo=1, hi=4)
    for x in range(0, 11):
        c.put_ramp(x, 7, 'metal', 2)
    c.put_ramp(4, 2, 'metal', 5)
    c.outline()
    return c


def _coal(n=3):
    c = Canvas(3, 3)
    c.rect(0, 0, 1, 1, 'coal', 3)
    c.put_ramp(0, 0, 'coal', 5)
    return c


def _gear_floor(r=3):
    c = Canvas(r * 2 + 3, r * 2 + 3)
    gear(c, r + 1, r + 1, r, 'gold', lo=1, hi=4, teeth=8)
    c.outline()
    return c


# =========================================================================== US-11 Snowman Warrior


@card_art('US-11')
def _art_us11():
    w = ground_world('snow', 4)
    for (sp, x, y) in ((tree_pine(1), 14, 40), (tree_pine(2), 134, 34), (rock(1), 126, 90), (rock(2), 14, 90)):
        prop_at(w, sp, x, y)
    # ein gefallener Schneemann: Matsch, Eimerhelm, Kohle, Karotte
    _slush(w, 30, 66, 15, 5)
    w.draw(_bucket(), 24, 56, 70)
    for (x, y) in ((38, 63), (42, 67), (20, 68)):
        w.draw(_coal(), x, y, 70)
    w.draw(_carrot(), 31, 67, 70)
    unit_at(w, spr_snowman_warrior(f=0), 62, 88, sh=(15, 3))
    unit_at(w, spr_snowman_warrior(f=1), 104, 72, sh=(15, 3))
    unit_at(w, citizen('cloth', 1), 134, 66, sh=(5, 2))
    return finish(w)


# =========================================================================== US-12 Rubber Golem


@card_art('US-12')
def _art_us12():
    w = ground_world('grass', 3)
    for (sp, x, y) in ((tree_round(2), 16, 44), (bush(2, True), 130, 36), (rock(2), 134, 90), (bush(1), 100, 20)):
        prop_at(w, sp, x, y)
    # gestauchter Golem vor dem Sprung
    unit_at(w, spr_rubber_golem('hop', 0), 40, 86, sh=(19, 4))
    # Sprungbahn + Golem in der Luft + Zielschatten beim naechsten Feind
    zielschatten(w, 112, 80, 15, 1)
    _arc_dots(w, (56, 56), (82, 8), (108, 70), 14, 'bone', 5, 8900, skip=1)
    gs = spr_rubber_golem('hop', 1)
    shadow(w, 84, 82, 12, 3)
    w.draw(gs, 84 - gs.w // 2, 62 - gs.h + 1, 8800)
    unit_at(w, citizen('dirt', 0), 114, 82, sh=(5, 2))
    return finish(w)


# =========================================================================== US-13 Spore Runner


@card_art('US-13')
def _art_us13():
    w = ground_world('dirt', 5)
    for (sp, x, y) in ((giant_mushroom(1, 'purple'), 18, 52), (bush(3), 128, 40), (rock(1), 126, 90), (bush(2, True), 14, 92)):
        prop_at(w, sp, x, y)
    # Sporenspur: Wolken, die kleiner werden
    for (cx, cy, r, sd) in ((60, 84, 10, 1), (36, 88, 8, 2), (46, 66, 7, 4), (22, 74, 5, 3)):
        _spore_cloud(w, cx, cy, r, sd)
    unit_at(w, spr_spore_runner(f=1), 90, 82, sh=(11, 3))
    unit_at(w, spr_spore_runner(f=3), 70, 62, sh=(11, 3))
    unit_at(w, citizen('cloth', 0), 124, 66, sh=(5, 2))
    rnd = random.Random(2)
    for k in range(18):
        put_world(w, rnd.randint(40, 96), rnd.randint(52, 84), 'slime', rnd.choice((3, 4, 5)))
    return finish(w)


# =========================================================================== US-14 Tick-Tock Trooper


@card_art('US-14')
def _art_us14():
    w = ground_world('slab', 6)
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 128, 34), (rack(), 124, 90)):
        prop_at(w, sp, x, y)
    for (sp, x, y) in ((_gear_floor(3), 26, 70), (_gear_floor(2), 104, 88), (_gear_floor(2), 34, 90)):
        w.draw(sp, x, y, -50)
    unit_at(w, spr_tick_tock_trooper(f=0), 52, 84, sh=(12, 3))
    unit_at(w, spr_tick_tock_trooper('charged', 1), 100, 70, sh=(12, 3))
    return finish(w)


# =========================================================================== US-15 Walking Crate


@card_art('US-15')
def _art_us15():
    w = ground_world('dirt', 7)
    for (sp, x, y) in ((tree_round(3), 128, 48), (bush(1, True), 16, 36), (rock(2), 128, 92)):
        prop_at(w, sp, x, y)
    # Koeder: Goldtaler-Spur zur harmlosen Truhe
    for (x, y) in ((96, 74), (104, 70), (88, 80), (112, 80), (100, 84)):
        w.draw(_coin(), x, y, -50)
    unit_at(w, spr_crate_loot(), 106, 70, sh=(12, 3))
    unit_at(w, citizen('dirt', 1), 90, 82, sh=(5, 2))
    unit_at(w, spr_walking_crate(f=0), 46, 84, sh=(15, 3))
    return finish(w)


# =========================================================================== US-16 Muddle Apprentice


def _frog_in_hat():
    c = Canvas(18, 14)
    ellipse(c, 9, 9, 6.6, 3.8, 'goblin', lo=1, hi=4)
    ellipse(c, 12.5, 6, 4.2, 3.4, 'goblin', lo=2, hi=5)
    ellipse(c, 11, 4, 1.8, 1.8, 'bone', lo=3, hi=5)
    c.put_ramp(12, 4, 'coal', 1)
    ellipse(c, 15, 4, 1.6, 1.6, 'bone', lo=3, hi=5)
    c.put_ramp(15, 4, 'coal', 1)
    for x in range(10, 17):
        c.put_ramp(x, 8, 'coal', 2)
    thick_line(c, 4, 11, 1, 12, 2, 'goblin', lo=1, hi=3)
    thick_line(c, 11, 12, 14, 12, 2, 'goblin', lo=2, hi=4)
    # winziger Buergerhut
    for x in range(8, 16):
        c.put_ramp(x, 1, 'wood', 2 if x > 11 else 1)
    c.put_ramp(10, 0, 'wood', 3)
    c.put_ramp(11, 0, 'wood', 3)
    c.outline()
    return c


def _orb(c, cx, cy):
    ellipse(c, cx, cy, 4.4, 4.4, 'purple', lo=1, hi=5, ambient=0.3)
    c.rect(int(cx) - 1, int(cy) - 1, int(cx), int(cy), 'purple', 5)


@card_art('US-16')
def _art_us16():
    w = ground_world('grass', 5)
    for (sp, x, y) in ((tree_round(1), 14, 46), (bush(2), 128, 36), (rock(1), 16, 92)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_muddle_apprentice(f=1), 44, 82, sh=(13, 3))
    # Chaosbolzen: ein Funkenschwarm in allen Schadensfarben (F, E, B, G, A), Sinus-Schweif
    cols = (('fire', 4), ('ice', 5), ('gold', 5), ('slime', 4), ('purple', 4))
    for k in range(18):
        x = 68 + k * 3
        y = 48 + int(4 * math.sin(k * 0.9)) + k // 3
        r, i = cols[k % 5]
        w.px[y:y + 2, x:x + 2, :3] = RAMPS[r][i]
        w.depth[y:y + 2, x:x + 2] = 9000
        if k % 3 == 0:
            put_world(w, x + 1, y - 2 - k % 2, r, 5)
    orb = Canvas(11, 11)
    _orb(orb, 5.5, 5.5)
    orb.outline()
    w.draw(orb, 84, 46, 9100)
    for (x, y, r) in ((104, 40, 'fire'), (114, 58, 'ice'), (96, 62, 'slime'), (124, 46, 'gold'), (108, 72, 'purple')):
        cross_spark(w, x, y, r)
    # Fehlzauber: ein Buerger wurde zum Frosch (mit Hut)
    fr = _frog_in_hat()
    shadow(w, 116, 86, 8, 2)
    w.draw(fr, 108, 76, 86)
    star_spark(w, 110, 70, 'gold', big=True)
    star_spark(w, 126, 78, 'fire')
    return finish(w)


# =========================================================================== US-17 Spaghetti Strangler


def _noodle_wrap(world, cx, cy):
    """zwei Nudelschlingen um einen Buerger (Festgehalten): hinterer Bogen dunkel, vorderer hell"""
    for dy in (0, 4):
        for k in range(0, 181, 12):
            a = math.radians(k)
            x = int(round(cx + math.cos(a) * 5.0))
            y = int(round(cy + dy + math.sin(a) * 2.2))
            for (ox, oy, ramp, idx) in ((0, 0, 'gold', 4), (0, 1, 'gold', 3), (0, 2, 'gold', 2)):
                put_world(world, x + ox, y + oy, ramp, idx, 9100)
        for k in range(180, 361, 12):
            a = math.radians(k)
            x = int(round(cx + math.cos(a) * 5.0))
            y = int(round(cy + dy + math.sin(a) * 2.2))
            put_world(world, x, y, 'gold', 2, 9100)
            put_world(world, x, y + 1, 'gold', 1, 9100)


@card_art('US-17')
def _art_us17():
    w = ground_world('slab', 4)
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 130, 36), (rack(), 128, 92)):
        prop_at(w, sp, x, y)
    sx, sy = 46, 88
    unit_at(w, spr_spaghetti_strangler(f=1), sx, sy, sh=(26, 4))
    ox, oy = sx - 30, sy - 45
    tips = [(ox + 57, oy + 10), (ox + 58, oy + 26), (ox + 52, oy + 8)]
    victims = [(100, 54), (118, 82), (130, 58)]
    lift = 6
    ov = Canvas(144, 96)
    for (tp, vc) in zip(tips, victims):
        mid1 = (tp[0] + 14, tp[1] - 12)
        mid2 = (vc[0] - 12, vc[1] - 26)
        strand_taper(ov, bezier(tp, mid1, mid2, (vc[0], vc[1] - lift - 11), 16), 3.2, 2.2, 'gold', lo=2, hi=5)
    ov.outline()
    for (x, y) in victims:
        shadow(w, x, y - 1, 5, 2)
        cit = citizen('cloth' if x < 110 else 'dirt', 1)
        w.draw(cit, x - cit.w // 2, y - lift - cit.h + 1, y)
    w.draw(ov, 0, 0, 9000)
    for (x, y) in victims:
        _noodle_wrap(w, x, y - lift - 11)
    return finish(w)


# =========================================================================== US-18 Bloodsucker Swarm


def _blood_drop(w, x, y, big=False):
    for (dx, dy, i) in ((0, 0, 4), (1, 0, 3), (0, 1, 3), (1, 1, 2)):
        put_world(w, x + dx, y + dy, 'fire', i)
    if big:
        put_world(w, x, y - 1, 'fire', 4)


@card_art('US-18')
def _art_us18():
    w = ground_world('dark', 3)
    for (sp, x, y) in ((gravestone(0), 18, 42), (gravestone(1), 128, 50), (dead_tree(1), 112, 38), (gravestone(0), 130, 92),
                       (gravestone(1), 14, 92), (gravestone(0), 30, 66)):
        prop_at(w, sp, x, y)
    sx, sy = 44, 14
    unit_at(w, citizen('cloth', 0), 74, 86, sh=(5, 2))
    # Schatten der Fledermaeuse auf dem Boden
    for (bx, rx) in ((54, 6), (93, 5), (53, 6), (94, 5), (74, 9)):
        shadow(w, bx, 86 + (bx % 3) * 2 - 2, rx, 2)
    sw = spr_bloodsucker_swarm(f=1)
    w.draw(sw, sx, sy, 400)
    # Lebensraub: rote Tropfen steigen vom Buerger zum Schwarm
    for k in range(8):
        _blood_drop(w, 73 + int(3 * math.sin(k * 1.3)), 74 - k * 5 + (k % 2), big=(k % 3 == 0))
    for (x, y) in ((60, 62), (88, 58), (56, 40)):
        _blood_drop(w, x, y)
    return finish(w)


# =========================================================================== US-19 Dragon-Rider Dwarf


def _wall_scene(kind_far='grass', seed=5, wall_bottom=52):
    """Hof (Pflaster) mit Mauer quer durch das Bild; dahinter Wiese"""
    w = ground_world('cobble', seed)
    g = ground_world(kind_far, seed + 1)
    w.px[:wall_bottom - 28] = g.px[:wall_bottom - 28]
    wall = stone_wall_piece(144)
    shadow(w, 72, wall_bottom + 4, 70, 3)
    w.draw(wall, 0, wall_bottom - wall.h + 1, wall_bottom)
    return w


@card_art('US-19')
def _art_us19():
    w = _wall_scene('grass', 5, 50)
    for (sp, x, y) in ((barrel(), 14, 66), (crate(), 130, 66)):
        prop_at(w, sp, x, y)
    # Landeplatz: Brandfleck + Feueratem
    x0, y0 = 16, 12
    mouth = (x0 + 59, y0 + 26)
    for yy in range(70, 90):
        for xx in range(92, 134):
            d = math.hypot((xx - 112) / 20.0, (yy - 80) / 9.0)
            if d < 1.0 and ((xx + yy) % 2 == 0 or d < 0.55):
                w.px[yy, xx, :3] = RAMPS['coal'][1 if d < 0.55 else 2]
    _flame_cone(w, mouth[0], mouth[1], 114, 80, 5, 40, seed=3, depth=8500, bend=5)
    # Schatten des Fliegers
    shadow(w, 48, 84, 22, 4)
    dr = spr_dragon_rider_dwarf(f=1)
    w.draw(dr, x0, y0, 8800)
    unit_at(w, citizen('cloth', 1), 134, 84, sh=(5, 2))
    for (x, y) in ((100, 70), (124, 74), (118, 88)):
        spark(w, x, y, 'fire')
    return finish(w)


# =========================================================================== US-20 Raccoon Assassin


def _smoke(w, cx, cy, r, seed=1, depth=9000):
    """Rauchbombe: Wolke aus Schachbrett-Dither"""
    _spore_cloud(w, cx, cy, r, seed, depth, ramp='bone')


@card_art('US-20')
def _art_us20():
    w = ground_world('dirt', 3)
    for (sp, x, y) in ((barrel(), 16, 38), (barrel(), 30, 34), (crate(), 128, 36), (bush(2), 132, 92)):
        prop_at(w, sp, x, y)
    # getarnter Waschbaer (Schachbrett-Schimmer), schleicht von links
    ghost = dither_cut(spr_raccoon_assassin(f=0), 0)
    unit_at(w, ghost, 40, 80, sh=(12, 2))
    # sichtbarer Waschbaer sticht von hinten zu, Rauchbombe zu seinen Fuessen
    _smoke(w, 70, 86, 8, 1, 90)
    unit_at(w, spr_raccoon_assassin(f=1), 90, 86, sh=(14, 3))
    _smoke(w, 76, 78, 6, 5, 90)
    _smoke(w, 104, 90, 5, 2, 9000)
    unit_at(w, citizen('cloth', 0), 120, 80, sh=(5, 2))
    star_spark(w, 118, 70, 'bone', big=True)
    star_spark(w, 126, 66, 'fire')
    return finish(w)


# =========================================================================== US-21 Hill Giant


@card_art('US-21')
def _art_us21():
    w = ground_world('grass', 6)
    for (sp, x, y) in ((tree_round(3), 12, 46), (bush(2), 134, 40), (rock(2), 14, 92), (bush(1, True), 132, 92)):
        prop_at(w, sp, x, y)
    # Stampf-Ring und Risse am vorderen Stiefel
    ring_world(w, 92, 87, 16, 5, 'dirt', 5, 4, 7000)
    ring_world(w, 92, 87, 22, 7, 'dirt', 4, 3, 7000)
    for (x0, y0, x1, y1) in ((104, 88, 116, 92), (100, 90, 104, 94), (80, 90, 74, 94)):
        for (x, y) in zip(range(min(x0, x1), max(x0, x1)), range(min(y0, y1), max(y0, y1))):
            put_world(w, x, y, 'coal', 1, 7001)
    unit_at(w, spr_hill_giant(f=0), 74, 88, sh=(32, 5))
    unit_at(w, citizen('cloth', 1), 126, 76, sh=(5, 2))
    unit_at(w, citizen('dirt', 0), 22, 70, sh=(5, 2))
    return finish(w)


# =========================================================================== US-22 Cakefire, the Birthday Dragon


def _cake_table():
    c = Canvas(30, 24)
    c.rect(4, 15, 5, 22, 'wood', 2)
    c.rect(24, 15, 25, 22, 'wood', 2)
    round_rect(c, 1, 13, 28, 17, 'wood', lo=1, hi=4, radius=1)
    # dreistoeckiger Kuchen
    round_rect(c, 6, 9, 23, 13, 'skin', lo=2, hi=5, radius=1)
    round_rect(c, 9, 5, 20, 9, 'cloth', lo=2, hi=5, radius=1)
    c.rect(6, 9, 23, 9, 'bone', 5)
    c.rect(9, 5, 20, 5, 'bone', 5)
    for x in range(7, 23, 3):
        c.put_ramp(x, 10, 'bone', 4)
        c.put_ramp(x, 11, 'bone', 4)
    c.rect(14, 1, 15, 4, 'ice', 4)
    c.put_ramp(14, 0, 'gold', 5)
    c.put_ramp(15, 0, 'fire', 4)
    c.put_ramp(17, 4, 'fire', 4)
    c.outline()
    return c


def _balloon(col, i=3):
    c = Canvas(11, 22)
    ellipse(c, 5.5, 5.5, 4.6, 5.4, col, lo=1, hi=5, ambient=0.3)
    c.put_ramp(3, 3, col, 5)
    c.put_ramp(3, 4, col, 5)
    poly(c, [(4.5, 10.5), (6.5, 10.5), (5.5, 12.5)], col, lo=1, hi=3)
    c.outline()
    for k in range(12, 22):
        c.put_ramp(5 + (1 if k % 4 < 2 else 0), k, 'bone', 3)
    return c


@card_art('US-22')
def _art_us22():
    w = ground_world('grass', 8)
    for (sp, x, y) in ((tree_round(2), 130, 46), (bush(2, True), 134, 92)):
        prop_at(w, sp, x, y)
    # Geburtstagstisch mit Kuchen und Luftballons (vom Drachen gestoert)
    prop_at(w, _cake_table(), 24, 90)
    for (col, x, y) in (('fire', 12, 76), ('ice', 22, 70), ('gold', 31, 74)):
        w.draw(_balloon(col), x - 5, y - 20, 95)
    x0, y0 = 12, 6
    mouth = (x0 + 66, y0 + 34)
    # Brandspur und Feueratem
    for yy in range(66, 92):
        for xx in range(88, 140):
            d = math.hypot((xx - 114) / 24.0, (yy - 80) / 10.0)
            if d < 1.0 and ((xx + yy) % 2 == 0 or d < 0.5):
                w.px[yy, xx, :3] = RAMPS['coal'][1 if d < 0.5 else 2]
    _flame_cone(w, mouth[0], mouth[1], 114, 80, 6, 44, seed=5, depth=8500, bend=-4)
    shadow(w, 52, 86, 24, 4)
    dr = spr_cakefire(f=2)
    w.draw(dr, x0, y0, 8800)
    for (x, y, k) in ((104, 88, 'cloth'), (130, 76, 'dirt'), (124, 60, 'ice')):
        shadow(w, x, y - 1, 5, 2)
        cit = citizen(k, 1)
        w.draw(cit, x - cit.w // 2, y - cit.h + 1, 8900)
    for (x, y) in ((96, 72), (130, 84), (108, 90)):
        spark(w, x, y, 'fire')
    return finish(w)


# =========================================================================== US-23 Mirror Twin


def _mirrorize(spr):
    """Spiegelkopie: alle Toene auf Silber/Himmel umgesetzt (Rampenindex bleibt), dazu Glanzdiagonalen"""
    m = {'gold': 'metal', 'metal': 'sky', 'teamA': 'ice', 'bone': 'fur', 'skin': 'metal', 'wood': 'stone', 'fire': 'sky',
         'dirt': 'stone', 'coal': 'coal'}
    out = recolor(spr, lambda n, i: (m.get(n, n), i))
    for y in range(out.h):
        for x in range(out.w):
            if out.alpha(x, y) and (x - y) % 17 == 0 and out.rid[y, x] >= 0:
                n = RAMP_NAMES[out.rid[y, x]]
                if n not in ('coal',):
                    out.put_ramp(x, y, 'fur', 5)
    return out


def _shard(h=12):
    c = Canvas(8, h)
    poly(c, [(3, 0), (6, h - 3), (4, h - 1), (1, h - 3)], 'metal', lo=2, hi=5)
    c.put_ramp(3, 3, 'fur', 5)
    c.put_ramp(3, 4, 'fur', 5)
    c.put_ramp(2, 6, 'sky', 4)
    c.outline()
    return c


@card_art('US-23')
def _art_us23():
    w = ground_world('purple', 4)
    for (sp, x, y) in ((_shard(12), 14, 40), (_shard(9), 24, 46), (_shard(13), 132, 44), (_shard(9), 128, 92), (_shard(11), 16, 92)):
        prop_at(w, sp, x, y)
    # Original (stark), Zwilling in der Mitte, gespiegelte Kopie rechts (Mimikry)
    tr = spr_tick_tock_trooper(f=2)
    unit_at(w, tr, 28, 74, sh=(12, 3))
    unit_at(w, spr_mirror_twin(f=1), 74, 84, sh=(11, 3))
    cp = _mirrorize(tr).flipped()
    unit_at(w, cp, 120, 78, sh=(12, 3))
    for (x, y) in ((50, 56), (96, 60), (100, 40), (44, 38)):
        star_spark(w, x, y, 'ice')
    return finish(w)
