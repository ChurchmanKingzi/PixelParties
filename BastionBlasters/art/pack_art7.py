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
    ramp, idx = {'ladybug': ('teamA', 3), 'gold': ('gold', 4), 'blue': ('ice', 3), 'green': ('leaf', 3)}[kind]
    c.rect(1, 1, 4, 3, ramp, idx)
    c.put_ramp(1, 1, ramp, idx + 1)                      # Glanzpunkt
    c.put_ramp(2, 1, ramp, idx + 1)
    c.put_ramp(5, 2, 'coal', 1)                          # Kopf
    if kind == 'ladybug':
        c.put_ramp(3, 2, 'coal', 1)                      # Punkte
        c.put_ramp(2, 3, 'coal', 1)
    for x in (1, 3):                                     # Beinchen
        c.put_ramp(x, 4, 'coal', 1)
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
    for (sp, x, y) in ((rock(2), 14, 88),):
        prop_at(w, sp, x, y)
    # Skelett drischt mit dem Löffel auf die Platte, Funken
    unit_at(w, skeleton('attack', 1), 44, 78, sh=(8, 3))
    burst(w, 57, 58, True, 'bone')
    burst(w, 57, 58, False, 'metal')
    # Felsbrocken prallt ab (Flugbahn gestrichelt), Beule; Gift-Spritzer rinnt wirkungslos ab
    w.draw(stone_projectile_small(), 104 - 7, 70 - 7, 9000)
    wline(w, 92, 53, 99, 62, 'bone', 4, 9000, dash=2)
    burst(w, 89, 52, False, 'gold')
    for (x, y, i) in ((78, 52, 4), (79, 52, 3), (77, 53, 3), (78, 54, 4), (80, 54, 3), (79, 55, 4), (77, 56, 3)):
        wpx(w, x, y, 'goblin', i)
    for k in range(7):
        wpx(w, 78, 56 + k, 'goblin', 3 if k % 2 else 4)
    wpx(w, 78, 63, 'goblin', 5)
    wpx(w, 80, 48, 'goblin', 5)
    unit_at(w, skeleton('walk', 1), 130, 91, flip=True, sh=(8, 3))
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
    wdisc(w, 54, 68, 5.2, 'purple', 3, 9100)
    wdisc(w, 54, 68, 4.0, 'purple', 4, 9101)
    wdisc(w, 53, 67, 2.2, 'purple', 5, 9102)
    wpx(w, 52, 66, 'bone', 5, 9103)
    ripple(w, 58, 60, 7)
    ripple(w, 58, 60, 12)
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
    for (x, y) in ((54, foot - 18), (57, foot - 24), (90, foot - 20), (93, foot - 26), (88, foot - 12)):
        wpx(w, x, y, 'stone', 5, 9000)
        wpx(w, x + 1, y, 'stone', 4, 9000)
    for (sp, x, y) in ((barrel(), 14, 40), (crate(), 130, 40)):
        prop_at(w, sp, x, y)
    for (sp, x, y) in ((bush(2), 18, 90), (rock(1), 124, 90)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BS-05 Spike Strip


def sweat(world, x, y):
    """Schweißtropfen / Ouch-Funken über dem Kopf"""
    for (dx, dy, i) in ((0, 0, 5), (0, 1, 4), (-1, 1, 4), (1, 1, 4), (0, 2, 3)):
        wpx(world, x + dx, y + dy, 'ice', i, 9200)


@card_art('BS-05')
def _art_bs05():
    w = ground_world('cobble', 5)
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 128, 36)):
        prop_at(w, sp, x, y)
    strip = spike_strip()
    sx, sy = 72, 74                                         # Fußpunkt (Mitte unten) der Stachelflur
    shadow(w, sx + 1, sy - 1, 15, 3)
    w.draw(strip, sx - strip.w // 2, sy - strip.h + 1, sy)
    # Gegner tritt auf die Spitzen: hüpft mit Autsch-Funken, Schweiß, Tempo-Bremse (Striche hinter ihm)
    sk = skeleton('walk', 0)
    w.draw(sk, sx + 3 - sk.w // 2, sy - 27 - sk.h + 1, 9000 + sy)
    burst(w, sx - 6, sy - 56, False, 'gold')
    burst(w, sx + 16, sy - 54, False, 'bone')
    sweat(w, sx + 14, sy - 46)
    for k in range(3):
        wline(w, sx - 28 - k * 2, sy - 38 + k * 4, sx - 20 - k * 2, sy - 38 + k * 4, 'bone', 4 - (k % 2), 9000)
    # wartende Zweite
    unit_at(w, skeleton('idle', 1), 26, 84, sh=(8, 3))
    unit_at(w, goblin('walk', 2), 120, 84, flip=True, sh=(8, 3))
    return finish(w)


# --------------------------------------------------------------------------- BS-08 Revolving-Door Maze


@card_art('BS-08')
def _art_bs08():
    w = ground_world('cobble', 7)
    maze = revolving_maze()
    mx, my = 40, 26                                         # linke obere Ecke
    foot = my + maze.h - 1
    shadow(w, mx + 32, foot - 1, 36, 4)
    w.draw(maze, mx, my, foot)
    # verwirrter Gegner torkelt am Eingang, Sterne kreisen, wirre Laufspur auf dem Pflaster
    g = goblin('walk', 1)
    gx, gy = 30, 84
    shadow(w, gx, gy - 1, 9, 3)
    w.draw(g, gx - g.w // 2, gy - g.h + 1, 9000 + gy)
    dizzy(w, gx, gy - 31, 9, 3, 3, 0.6, 9500)
    for k in range(14):
        a = k * 0.55
        wpx(w, gx + 18 + math.cos(a) * (3 + k * 0.7), gy - 4 + math.sin(a) * (2 + k * 0.4), 'bone', 4, 4000)
    # einsamer Hut auf dem Boden
    w.draw(hat(), mx + 58, foot - 10, 9000)
    # zweiter Gegner kommt von rechts (vorsichtig)
    unit_at(w, skeleton('walk', 2), 120, 80, flip=True, sh=(8, 3))
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 128, 34)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- BS-09 Quench Pond


@card_art('BS-09')
def _art_bs09():
    w = ground_world('cobble', 8)
    pond = quench_pond()
    px_, py_ = 82, 66
    shadow(w, px_ + 1, py_ - 1, 15, 3)
    w.draw(pond, px_ - pond.w // 2, py_ - pond.h + 1, py_)
    # Brennendes Skelett rennt zum Teich: Flammen auf Helm, Rücken und Löffel
    sk = skeleton('walk', 1)
    fx_, fy_ = 42, 78
    unit_at(w, sk, fx_, fy_, sh=(8, 3))
    x0, y0 = fx_ - 16, fy_ - 31
    for (fl, dx, dy) in ((flame(11, 0.3), 14, -7), (flame(9, 1.7), 8, 12), (flame(8, 2.4), 24, 1)):
        w.draw(fl, x0 + dx, y0 + dy + 3, 9000)
    # Dampf steigt aus dem Teich, Spritzer
    for (x, y, sd) in ((px_ - 10, py_ - 36, 1), (px_ + 4, py_ - 44, 2), (px_ + 14, py_ - 32, 3)):
        c = puff(14, 10, sd, 'bone', 3, 5)
        w.draw(c, x - c.w // 2, y - c.h // 2, 9000)
    for (x, y) in ((px_ - 18, py_ - 22), (px_ - 16, py_ - 26), (px_ + 18, py_ - 24), (px_ + 12, py_ - 28)):
        wpx(w, x, y, 'ice', 5, 9000)
        wpx(w, x, y + 1, 'ice', 3, 9000)
    # gelöschter Gegner rechts (rußig, dampft)
    unit_at(w, skeleton('idle', 0), 120, 84, flip=True, sh=(8, 3))
    c = puff(12, 9, 5, 'bone', 3, 5)
    w.draw(c, 120 - 6, 84 - 40, 9000)
    for (sp, x, y) in ((barrel(), 16, 34), (crate(), 128, 34)):
        prop_at(w, sp, x, y)
    return finish(w)


# --------------------------------------------------------------------------- Türme: gemeinsamer Aufbau


class TW:
    """Turm-Szene in Fensterkoordinaten (144 x 96): kleine Burg mit Turmzelle 'T', Turmmitte bei x = 56, fertig beschnitten.
    Die Welt ist 240 x 160, das Fenster beginnt bei (56, y0)."""

    def __init__(self, ground, seed, tw, y0=14, rows=None):
        self.x0, self.y0 = 56, y0
        self.world = ground_world(ground, seed, 240, 160)
        rows = rows or [".....", ".hhT.", "....."]
        mini_castle(rows, 0, 1, self.world, tw=tw)

    def X(self, x):
        return int(x + self.x0)

    def Y(self, y):
        return int(y + self.y0)

    def shadow(self, x, y, sh=(9, 3)):
        shadow(self.world, self.X(x), self.Y(y) - 1, sh[0], sh[1])

    def unit(self, spr, x, y, flip=False, top=False, sh=(9, 3), shade=True):
        """Einheit mit Fußpunkt (x, y); top=True: liegt über allen Strahlen/Effekten (Schlüssel 9000 + y)"""
        if shade:
            self.shadow(x, y, sh)
        key = 9000 + int(y) if top else self.Y(y)
        self.world.draw(spr, self.X(x) - spr.w // 2, self.Y(y) - spr.h + 1, key, flip)

    def prop(self, spr, x, y, flip=False):
        prop_at(self.world, spr, self.X(x), self.Y(y), flip)

    def sprite(self, spr, x, y, key=9100, flip=False):
        """freies Sprite mit Mittelpunkt (x, y)"""
        self.world.draw(spr, self.X(x) - spr.w // 2, self.Y(y) - spr.h // 2, key, flip)

    def px(self, x, y, ramp, idx, key=9000):
        wpx(self.world, self.X(x), self.Y(y), ramp, idx, key)

    def line(self, x0, y0, x1, y1, ramp, idx, key=9000, dash=0):
        wline(self.world, self.X(x0), self.Y(y0), self.X(x1), self.Y(y1), ramp, idx, key, dash)

    def disc(self, x, y, r, ramp, idx, key=9000, chk=False):
        wdisc(self.world, self.X(x), self.Y(y), r, ramp, idx, key, chk)

    def burst(self, x, y, big=False, ramp='gold'):
        burst(self.world, self.X(x), self.Y(y), big, ramp)

    def poly_fill(self, pts, colors, key=5000):
        wp = [(self.X(px_), self.Y(py_)) for (px_, py_) in pts]
        dither_fill(self.world, wp, colors, key)

    def done(self):
        return finish(crop_world(self.world, self.x0, self.y0))


def _puddle(w, x, y, rx, ry, ramp='slime'):
    c = Canvas(int(rx * 2 + 4), int(ry * 2 + 4))
    ellipse(c, c.w / 2.0, c.h / 2.0, rx, ry, ramp, lo=1, hi=4, ambient=0.3)
    c.outline()
    w.world.draw(c, w.X(x) - c.w // 2, w.Y(y) - c.h // 2, -45)


# --------------------------------------------------------------------------- BT-02 Gloop Tower


@card_art('BT-02')
def _art_bt02():
    t = TW('dirt', 3, gloop_tower())
    for (sp, x, y) in ((bush(2), 128, 52), (rock(2), 14, 90), (tree_pine(1), 138, 36)):
        t.prop(sp, x, y)
    # Schleimbälle fliegen in hohem Bogen auf den Gegner
    p0, p1 = (78, 25), (112, 66)
    pts = parabola(p0, p1, 12, 12)
    for k in (3, 6, 9):
        t.sprite(gloop_ball(), pts[k][0], pts[k][1])
    for k in (1, 2, 4, 5, 7, 8):
        t.disc(pts[k][0], pts[k][1], 1, 'slime', 4 if k % 2 else 3)
    # Gegner: verschleimt, steht in der Pfütze
    _puddle(t, 112, 85, 14, 3.5)
    sk = splotches(skeleton('idle', 1), [(14, 16, 3), (20, 22, 2.4), (11, 24, 2), (16, 5, 2.2)], 'slime', 4)
    t.unit(sk, 112, 84, flip=True, top=True)
    drip = [(104, 70), (121, 73), (108, 76)]
    for (x, y) in drip:
        t.px(x, y, 'slime', 4)
        t.px(x, y + 1, 'slime', 3)
    t.burst(111, 62, False, 'slime')
    t.unit(goblin('walk', 2), 90, 91, flip=True, sh=(8, 3))
    return t.done()


# --------------------------------------------------------------------------- BT-03 Frost Flue


@card_art('BT-03')
def _art_bt03():
    t = TW('grass', 4, frost_flue())
    for (sp, x, y) in ((tree_pine(0), 136, 40), (rock(1), 16, 90), (bush(1), 12, 52)):
        t.prop(sp, x, y)
    apex = (63, 22)
    BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

    def col(x, y):
        wx, wy = x - t.x0, y - t.y0
        d = math.hypot(wx - apex[0], wy - apex[1])
        dens = max(0.18, 1.0 - d / 95.0)                       # dichter nahe der Esse
        if BAYER[y % 4][x % 4] / 16.0 > dens:
            return None
        if d < 30:
            return ('fur', 5)
        if d < 58:
            return ('ice', 5) if (x // 2 + y // 2) % 3 else ('fur', 5)
        return ('ice', 4)

    t.unit(skeleton('idle', 0), 112, 80, shade=True)         # Schatten zuerst, Kegel darüber
    t.poly_fill([apex, (143, 50), (112, 97)], col, 5000)
    rnd = random.Random(5)
    for _ in range(22):
        x, y = rnd.randint(70, 138), rnd.randint(30, 92)
        wx, wy = x - apex[0], y - apex[1]
        if wy > wx * 0.36 and wy < wx * 1.95:
            t.sprite(star_sprite('ice'), x, y, 5100)
    # eingefrorener Gegner (Eisblock-Tönung) und Eisplitter
    frozen = tint_ramp(skeleton('idle', 0), 'ice')
    t.unit(frozen, 112, 80, top=True, shade=False)
    for (x, y, hh) in ((98, 82, 7), (103, 86, 5), (124, 83, 6), (128, 78, 4)):
        for k in range(hh):
            t.px(x, y - k, 'ice', 5 if k > hh - 3 else 4)
            t.px(x + 1, y - k, 'ice', 3)
    t.unit(skeleton('walk', 1), 86, 91, flip=True, top=True, sh=(8, 3))
    t.line(80, 82, 84, 82, 'ice', 5, 9400)
    return t.done()


# --------------------------------------------------------------------------- BT-04 Chirp Spire


def _beam_pts(p0, p1, step=1.0):
    n = int(max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1])) / step)
    return [(p0[0] + (p1[0] - p0[0]) * k / n, p0[1] + (p1[1] - p0[1]) * k / n) for k in range(n + 1)]


@card_art('BT-04')
def _art_bt04():
    t = TW('grass', 6, chirp_spire())
    for (sp, x, y) in ((tree_round(2), 134, 42), (bush(2, True), 12, 56), (rock(2), 14, 90)):
        t.prop(sp, x, y)
    eye = (62, 57)
    far = (141, 84)
    targets = [(92, 79), (110, 85), (128, 91)]
    for k, (x, y) in enumerate(targets):
        t.unit(skeleton('idle', k % 2), x, y, flip=True, top=True)
    # Strahl durchschlägt alle drei (liegt über den Körpern): Mantel (Dither), lila Kern, heller Faden; Zirp-Wellen als Bögen
    for (x, y) in _beam_pts(eye, far):
        for dy in (-2, -1, 0, 1, 2):
            if abs(dy) == 2 and int(x + y) % 2:
                continue
            if abs(dy) == 2:
                ramp, idx = 'purple', 4
            elif abs(dy) == 1:
                ramp, idx = 'purple', 5
            else:
                ramp, idx = 'bone', 5
            t.px(x, y + dy, ramp, idx, 9500)
    ang = math.atan2(far[1] - eye[1], far[0] - eye[0])
    for k in range(5):
        d = 14 + k * 13
        cx, cy = eye[0] + math.cos(ang) * d, eye[1] + math.sin(ang) * d
        for a in range(-55, 56, 8):
            aa = ang + math.radians(a)
            px_ = cx + math.cos(aa) * (6 + k * 0.7)
            py_ = cy + math.sin(aa) * (6 + k * 0.7)
            t.px(px_, py_, 'purple', 5, 9502)
            t.px(px_ + 1, py_, 'purple', 3, 9502)
    for (x, y) in targets:
        t.burst(x, y - 13, False, 'purple')
        t.burst(x - 8, y - 25, False, 'bone')
    return t.done()


# --------------------------------------------------------------------------- BT-05 Hornet Tower


@card_art('BT-05')
def _art_bt05():
    t = TW('grass', 7, hornet_tower())
    for (sp, x, y) in ((tree_round(1), 136, 44), (bush(1), 12, 56), (rock(1), 16, 90), (bush(3, True), 96, 96)):
        t.prop(sp, x, y)
    nest = (58, 57)
    sk = (118, 85)
    t.shadow(sk[0], sk[1], (8, 3))
    # Flugspuren der Hornissen
    for (a, b) in (((nest[0] + 6, nest[1] - 2), (82, 46)), ((nest[0] + 6, nest[1]), (96, 62)), ((nest[0] + 6, nest[1] + 2), (110, 56))):
        t.line(a[0], a[1], b[0], b[1], 'bone', 4, 5000, dash=2)
    t.sprite(hornet(0), 86, 42, 9100)
    t.sprite(hornet(1), 100, 62, 9100)
    t.sprite(hornet(0), 128, 52, 9100)
    # Gegner wird gepiekst: Sterne
    t.unit(skeleton('idle', 1), sk[0], sk[1], flip=True, top=True, shade=False)
    t.burst(112, 70, False, 'gold')
    t.burst(124, 66, False, 'fire')
    t.px(104, 69, 'bone', 5)
    t.px(105, 70, 'bone', 4)
    t.line(112, 56, 124, 54, 'bone', 4, 5000, dash=2)
    return t.done()


# --------------------------------------------------------------------------- BT-06 Storm Spike


@card_art('BT-06')
def _art_bt06():
    t = TW('mud', 9, storm_spike())
    for (sp, x, y) in ((rock(2), 14, 90), (bush(2), 138, 40)):
        t.prop(sp, x, y)
    cloud = (58, 30)
    A, B, C = (92, 80), (122, 72), (112, 91)
    for (x, y) in (A, B, C):
        t.shadow(x, y, (8, 3))
    # Blitz: Wolke -> A, dann Kettenblitz A -> B -> C
    main = zigzag(cloud[0], cloud[1], A[0], A[1] - 14, 7, 5, 3)
    chain1 = zigzag(A[0], A[1] - 14, B[0], B[1] - 14, 4, 3, 5)
    chain2 = zigzag(B[0], B[1] - 14, C[0], C[1] - 14, 3, 3, 8)
    for pts in (main, chain1, chain2):
        for (a, b) in zip(pts, pts[1:]):
            t.line(a[0] - 1, a[1], b[0] - 1, b[1], 'gold', 3, 5000)
            t.line(a[0] + 1, a[1], b[0] + 1, b[1], 'gold', 4, 5000)
            t.line(a[0], a[1], b[0], b[1], 'bone', 5, 5001)
    t.unit(skeleton('idle', 0), A[0], A[1], flip=True, top=True, shade=False)
    t.unit(goblin('idle', 1), B[0], B[1], flip=True, top=True, shade=False)
    t.unit(skeleton('walk', 3), C[0], C[1], flip=True, top=True, shade=False)
    for (x, y) in (A, B, C):
        t.burst(x, y - 14, True, 'gold')
    # lächelnder Blitz-Kopf mitten im Hauptblitz
    t.sprite(smiling_bolt(), 74, 44, 9500)
    # Regen
    rnd = random.Random(12)
    for _ in range(26):
        x, y = rnd.randint(4, 140), rnd.randint(6, 92)
        t.line(x, y, x - 2, y + 4, 'ice', 3 if (x + y) % 2 else 4, 4000)
    return t.done()


# --------------------------------------------------------------------------- BT-07 Pelican Flak Nest


@card_art('BT-07')
def _art_bt07():
    t = TW('sand', 10, pelican_nest())
    for (sp, x, y) in ((bush(1), 136, 54), (rock(1), 14, 90), (bush(2), 16, 56)):
        t.prop(sp, x, y)
    # Flieger (Fledermäuse) und ihre Schatten auf dem Boden
    bat1, bat2 = (116, 34), (132, 14)
    t.shadow(bat1[0], 82, (8, 2))
    t.shadow(bat2[0], 70, (7, 2))
    t.sprite(bat(0), bat2[0], bat2[1], 9000)
    t.sprite(bat(1), bat1[0], bat1[1], 9000)
    # Fische fliegen im Bogen vom Schnabel auf die Fledermaus
    p0, p1 = (80, 24), (bat1[0] - 8, bat1[1] + 2)
    pts = parabola(p0, p1, 16, 10)
    t.sprite(fish(), pts[3][0], pts[3][1], 9100)
    t.sprite(fish(), pts[7][0], pts[7][1], 9100)
    for k in (1, 2, 5, 6, 9):
        t.px(pts[k][0], pts[k][1], 'ice', 5, 9000)
    t.burst(bat1[0] - 4, bat1[1] + 6, True, 'gold')
    t.burst(bat1[0] + 12, bat1[1] - 6, False, 'bone')
    # Bodengegner gehen unbehelligt vorbei
    t.unit(skeleton('walk', 2), 112, 90, flip=True)
    return t.done()


# --------------------------------------------------------------------------- BT-08 Confusion Beacon


@card_art('BT-08')
def _art_bt08():
    t = TW('dark', 11, confusion_beacon())
    for (sp, x, y) in ((rock(2), 14, 90), (bush(2), 136, 54)):
        t.prop(sp, x, y)
    apex = (60, 28)
    ang0 = math.radians(33)
    half = math.radians(15)
    L = 110
    pA = (apex[0] + math.cos(ang0 - half) * L, apex[1] + math.sin(ang0 - half) * L)
    pB = (apex[0] + math.cos(ang0 + half) * L, apex[1] + math.sin(ang0 + half) * L)
    foes = [(104, 78), (126, 88)]
    ghost = (86, 86)
    for (x, y) in foes + [ghost]:
        t.shadow(x, y, (8, 3))

    def col(x, y):
        wx, wy = x - t.x0, y - t.y0
        a = math.atan2(wy - apex[1], wx - apex[0])
        u = (a - (ang0 - half)) / (2 * half)
        if u < 0 or u > 1:
            return None
        band = min(4, int(u * 5))
        ramp, idx = RAINBOW[band]
        d = math.hypot(wx - apex[0], wy - apex[1])
        if (x + y) % 2 == 0 or d < 14:
            return (ramp, idx)
        return (ramp, idx - 1) if (x // 2 + y) % 3 == 0 else None

    t.poly_fill([apex, pA, pB], col, 5000)
    # Unsichtbarer wird enttarnt (Geisterfassung), zwei Verwirrte mit kreisenden Sternen
    t.unit(ghostly(skeleton('idle', 1)), ghost[0], ghost[1], flip=True, top=True, shade=False)
    t.unit(skeleton('walk', 0), foes[0][0], foes[0][1], flip=True, top=True, shade=False)
    t.unit(goblin('walk', 2), foes[1][0], foes[1][1], flip=True, top=True, shade=False)
    for (x, y, ph) in ((foes[0][0], foes[0][1] - 29, 0.4), (foes[1][0], foes[1][1] - 29, 2.0)):
        dizzy(t.world, t.X(x), t.Y(y), 8, 3, 3, ph, 9500)
    return t.done()
