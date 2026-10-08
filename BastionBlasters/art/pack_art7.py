"""pack_art7: Bau-Karten BS-01, BS-03, BS-04, BS-05, BS-07, BS-08, BS-09 und BT-02 ... BT-08.
Sprites: pack_art7_walls.py (Wände, Tor, Hof-Bauteile), pack_art7_towers.py (Türme), pack_art7_fx.py (Helfer, Effekte)."""
from __future__ import annotations

from cards_art import *
from castle import wall_shadows, draw_walls, Textures
from pack_art7_fx import *
from pack_art7_walls import *
from pack_art7_towers import *


# --------------------------------------------------------------------------- gemeinsame Szenen-Helfer


def cobble_patch(world, x0, y0, x1, y1, seed=3):
    """Hofpflaster in ein Rechteck legen (x1, y1 exklusiv)"""
    tile = tile_cobble(seed, 32, base='dirt', tone=(3, 4), mortar=2, hi=5)
    for y in range(y0, y1):
        for x in range(x0, x1):
            world.px[y, x, :3] = tile.px[y % 32, x % 32, :3]
            world.depth[y, x] = -100


def stamp_wall(fp, kd, ht, x0, y0, x1, y1, h, kind=1):
    """Wandstück auf die Fußabdruck-Arrays stempeln (Weltpixel, x1/y1 exklusiv), wie castle.Castle._stamp"""
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            fp[yy, xx] = True
            if h >= ht[yy, xx]:
                ht[yy, xx] = h
            if kd[yy, xx] < kind:
                kd[yy, xx] = kind


def beetle(kind='ladybug'):
    """winziger Käfer (6 x 5), blickt nach rechts"""
    c = Canvas(6, 5)
    shell = {'ladybug': ('teamA', 3), 'gold': ('gold', 4), 'blue': ('ice', 3), 'green': ('leaf', 3)}[kind]
    c.rect(1, 1, 4, 3, shell[0], shell[1])
    c.put_ramp(1, 1, shell[0], shell[1] + 1)
    c.put_ramp(2, 1, shell[0], shell[1] + 1)
    c.put_ramp(5, 2, 'coal', 1)
    c.put_ramp(3, 2, 'coal', 1) if kind == 'ladybug' else None
    for x in (1, 3):
        c.put_ramp(x, 4, 'coal', 1)
    c.put_ramp(2, 0, 'coal', 1) if kind == 'ladybug' else None
    return c


def paint_beetle(world, spr, x, y, flip=False):
    world.draw(spr, x, y, 9000, flip)


# --------------------------------------------------------------------------- BS-01 Masonry


def moss_tufts(world, rect, seed, n=40):
    """Moospolster auf Wandpixel (Tiefe >= 0) streuen: kurze Büschel mit Tropfkante"""
    rng = random.Random(seed)
    x0, y0, x1, y1 = rect
    for _ in range(n):
        x, y = rng.randint(x0, x1 - 1), rng.randint(y0, y1 - 1)
        if world.depth[y, x] < 0:
            continue
        size = rng.choice([2, 2, 3, 4])
        for k in range(size):
            if x + k < world.w and world.depth[y, x + k] >= 0:
                wpx(world, x + k, y, 'grass', 4 if k == 0 else 3, 8000)
                if world.depth[y + 1, x + k] >= 0 and rng.random() < 0.7:
                    wpx(world, x + k, y + 1, 'grass', 2, 8000)
        if rng.random() < 0.5 and world.depth[y + 2, x] >= 0:
            wpx(world, x, y + 2, 'grass', 2, 8000)


def ivy(world, x, y0, y1, rng):
    """Efeuranke senkrecht an einer Wand"""
    xx = x
    for y in range(y0, y1):
        if rng.random() < 0.3:
            xx += rng.choice([-1, 1])
        wpx(world, xx, y, 'leaf', 2, 8000)
        if y % 4 == 0:
            for (dx, dy, i) in ((-1, 0, 3), (1, 0, 4), (0, -1, 4), (-1, 1, 2), (1, 1, 3)):
                wpx(world, xx + dx, y + dy, 'leaf', i, 8000)


@card_art('BS-01')
def _art_bs01():
    w = ground_world('grass', 4)
    cobble_patch(w, 0, 0, 114, 70, 3)
    cobble_patch(w, 58, 62, 80, 96, 5)                        # Pflasterweg vom Türdurchgang nach Süden
    H, W = w.h, w.w
    fp = np.zeros((H, W), bool)
    kd = np.zeros((H, W), np.uint8)
    ht = np.zeros((H, W), np.uint8)
    # Südwand: Fußabdruck y 62..69 (8 px), Türlücke 14 px; Ostwand biegt an der rechten Ecke nach Norden ab
    stamp_wall(fp, kd, ht, 0, 62, 62, 70, 22)
    stamp_wall(fp, kd, ht, 76, 62, 120, 70, 22)
    stamp_wall(fp, kd, ht, 112, 14, 120, 62, 20)
    wall_shadows(w, fp)
    draw_walls(w, fp, kd, ht, Textures())
    # Hofbewohner und Kulisse
    for (sp, x, y) in ((barrel(), 22, 34), (crate(), 44, 33), (barrel(), 86, 32)):
        prop_at(w, sp, x, y)
    for (sp, x, y) in ((bush(2), 16, 90), (rock(1), 104, 88), (bush(3, True), 133, 52), (rock(2), 134, 84)):
        prop_at(w, sp, x, y)
    # Bürger geht durch die Türlücke (hinter den Wandpixeln, in der Lücke sichtbar)
    cit = citizen('cloth', 0)
    w.draw(cit, 69 - cit.w // 2, 68 - cit.h + 1, 61)
    # Moos und Efeu
    moss_tufts(w, (0, 40, 62, 68), 5, 34)
    moss_tufts(w, (76, 40, 144, 68), 6, 34)
    moss_tufts(w, (110, 8, 122, 40), 7, 10)
    rng = random.Random(3)
    ivy(w, 114, 14, 40, rng)
    ivy(w, 12, 52, 66, rng)
    # Käfer in den Ritzen
    paint_beetle(w, beetle('ladybug'), 18, 58)
    paint_beetle(w, beetle('gold'), 40, 52)
    paint_beetle(w, beetle('blue'), 96, 56, True)
    paint_beetle(w, beetle('green'), 52, 62)
    paint_beetle(w, beetle('ladybug'), 104, 63, True)
    paint_beetle(w, beetle('gold'), 115, 30)
    # ein Käfer schaut aus einer Fuge (dunkler Spalt, zwei rote Augenpunkte)
    for (x, y) in ((28, 56), (29, 56), (30, 56)):
        wpx(w, x, y, 'coal', 0)
    wpx(w, 28, 57, 'fire', 5)
    wpx(w, 30, 57, 'fire', 5)
    return finish(w)


# --------------------------------------------------------------------------- BS-03 Armor Wall


@card_art('BS-03')
def _art_bs03():
    w = ground_world('dirt', 3)
    cobble_patch(w, 0, 0, 144, 56, 3)
    wall_y = 66
    aw = armor_wall(3, 1)
    left = stone_wall_piece(20)
    right = stone_wall_piece(20)
    shadow(w, 72, wall_y + 4, 56, 3)
    w.draw(left, 0, wall_y - left.h + 1, wall_y)
    w.draw(aw, 20, wall_y - aw.h + 1, wall_y)
    w.draw(right, 124, wall_y - right.h + 1, wall_y)
    for (sp, x, y) in ((barrel(), 14, 34), (crate(), 128, 33)):
        prop_at(w, sp, x, y)
    for (sp, x, y) in ((rock(2), 14, 88), (bush(1), 132, 90)):
        prop_at(w, sp, x, y)
    # Skelett drischt mit dem Löffel auf die Platte, Funken
    unit_at(w, skeleton('attack', 1), 44, 78, sh=(8, 3))
    burst(w, 57, 58, True, 'bone')
    burst(w, 57, 58, False, 'metal')
    # Felsbrocken prallt ab (Flugbahn gestrichelt), Beule; Gift-Spritzer rinnt wirkungslos ab
    w.draw(stone_projectile_small(), 112 - 7, 72 - 7, 9000)
    wline(w, 92, 53, 106, 64, 'bone', 4, 9000, dash=2)
    burst(w, 89, 52, False, 'gold')
    for (x, y, i) in ((78, 52, 4), (79, 52, 3), (77, 53, 3), (78, 54, 4), (80, 54, 3), (79, 55, 4), (77, 56, 3)):
        wpx(w, x, y, 'goblin', i)
    for k in range(7):
        wpx(w, 78, 56 + k, 'goblin', 3 if k % 2 else 4)
    wpx(w, 78, 63, 'goblin', 5)
    wpx(w, 80, 48, 'goblin', 5)
    unit_at(w, skeleton('walk', 1), 124, 90, flip=True, sh=(8, 3))
    return finish(w)


# --------------------------------------------------------------------------- BS-04 Ward Wall


def ripple(world, cx, cy, r, ramp='purple', key=9300):
    """gestrichelter Wellenring (flach, wie ein Ei) auf der Wandfläche"""
    for a in range(0, 360, 5):
        if (a // 15) % 2:
            continue
        x = cx + math.cos(math.radians(a)) * r * 1.35
        y = cy + math.sin(math.radians(a)) * r * 0.75
        wpx(world, x, y, ramp, 5 if r < 6 else 4, key)


def shard_fx(world, x, y, size=2, ramp='purple'):
    """kleiner Kristallsplitter (Raute)"""
    pts = [(0, -size, 5), (-1, 0, 4), (0, 0, 5), (1, 0, 3), (0, size, 3)]
    if size > 2:
        pts += [(0, -1, 5), (0, 1, 4)]
    for (dx, dy, i) in pts:
        wpx(world, x + dx, y + dy, ramp, i, 9200)


@card_art('BS-04')
def _art_bs04():
    w = ground_world('dark', 2)
    # Hof hinter der Mauer: Steinplatten
    tile = tile_cobble(23, 32, base='stone', tone=(3, 4), mortar=2, hi=5)
    for y in range(0, 52):
        for x in range(144):
            w.px[y, x, :3] = tile.px[y % 32, x % 32, :3]
    wall_y = 68
    ww = ward_wall(3, 1)
    left = stone_wall_piece(20)
    right = stone_wall_piece(20)
    shadow(w, 72, wall_y + 4, 56, 3)
    w.draw(left, 0, wall_y - left.h + 1, wall_y)
    w.draw(ww, 20, wall_y - ww.h + 1, wall_y)
    w.draw(right, 124, wall_y - right.h + 1, wall_y)
    top = wall_y - ww.h + 1
    # Rune pulsiert: Wellenringe um die mittlere Rune, Splitter rieseln
    rcx, rcy = 20 + 4 + 32 + 16, top + 31
    ripple(w, rcx, rcy, 9)
    ripple(w, rcx, rcy, 14)
    for (x, y, s) in ((50, top + 18, 2), (96, top + 24, 2), (66, top + 38, 1), (104, top + 12, 1), (38, top + 30, 1), (84, top + 34, 2)):
        shard_fx(w, x, y, s)
    # Arkan-Kugel prallt an der Wand ab, Blitz schlägt in die Splitterkrone ein
    for k in range(7):
        wpx(w, 46 - k * 5, 92 - k * 5, 'purple', 3 + (k % 2), 9000)
        wpx(w, 47 - k * 5, 92 - k * 5, 'purple', 2, 9000)
    wdisc(w, 56, 66, 3.5, 'purple', 4, 9100)
    wdisc(w, 55, 65, 1.6, 'purple', 5, 9101)
    ripple(w, 58, 62, 6)
    ripple(w, 58, 62, 10)
    bolt = [(122, 4), (117, 12), (122, 18), (114, 26), (119, 31), (108, 40)]
    for (a_, b_) in zip(bolt, bolt[1:]):
        wline(w, a_[0], a_[1], b_[0], b_[1], 'gold', 4, 9000)
        wline(w, a_[0] + 1, a_[1], b_[0] + 1, b_[1], 'bone', 5, 9001)
    burst(w, 108, 40, True, 'gold')
    ripple(w, 108, 40, 7)
    unit_at(w, skeleton('idle', 0), 120, 90, flip=True, sh=(8, 3))
    unit_at(w, goblin('idle', 1), 24, 91, sh=(8, 3))
    return finish(w)


# --------------------------------------------------------------------------- BS-07 Portcullis Gate


@card_art('BS-07')
def _art_bs07():
    w = ground_world('grass', 6)
    cobble_patch(w, 0, 0, 144, 74, 3)
    foot = 78
    gx = 72 - 33
    left = stone_wall_piece(44)
    right = stone_wall_piece(44)
    cobble_patch(w, 52, 70, 92, 96, 5)                       # Torweg (Pflaster) nach Süden
    shadow(w, 72, foot + 3, 64, 3)
    w.draw(left, 0, foot - left.h + 1, foot)
    w.draw(right, 100, foot - right.h + 1, foot)
    frame = portcullis_gate(0.55, 'frame')
    grid = portcullis_gate(0.55, 'grid')
    w.draw(frame, gx, foot - frame.h + 1, foot)
    w.draw(grid, gx, foot - grid.h + 1, foot - 6)
    # Eindringling im Torraum unter dem fallenden Gatter, der Hund bellt mutig
    unit_at(w, dog(), 60, foot - 1, sh=(8, 2))
    unit_at(w, skeleton('idle', 0), 82, foot - 1, flip=True, sh=(8, 3))
    for (dx, dy) in ((10, -10), (12, -5), (13, 0)):
        wline(w, 60 + dx, foot - 8 + dy, 60 + dx + 3, foot - 8 + dy - 1 + (1 if dy > 0 else 0), 'bone', 5, 9000)
    # Fallstriche und Staub aus dem Sturz
    for x in (60, 68, 76, 84):
        wline(w, x, foot - 22, x, foot - 17, 'bone', 4, 9000, dash=2)
    for (x, y, sz) in ((46, foot - 22, 5), (98, foot - 24, 5)):
        c = puff(sz * 2 + 2, sz + 3, x, 'stone', 3, 5)
        w.draw(c, x - c.w // 2, y - c.h // 2, 9000)
    for (sp, x, y) in ((barrel(), 14, 40), (crate(), 130, 40)):
        prop_at(w, sp, x, y)
    for (sp, x, y) in ((bush(2), 18, 90), (rock(1), 124, 90)):
        prop_at(w, sp, x, y)
    return finish(w)
