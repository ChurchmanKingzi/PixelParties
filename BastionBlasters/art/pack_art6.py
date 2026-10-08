"""pack_art6: Zivilisten UZ-08 .. UZ-19 (Segens-Nonne, Traenkebrauer, Fallensteller-Koboldin, Imkerin, Jongleur-Clown,
Brieftauben-Bote, Gruft-Gaertnerin, Orakel-Kroete, Regenmacher-Schamane, Matrone Grosselfe, Schrott-Rudi, Opa Philosophenstein).
Sprites: pack_art6_s1.py / pack_art6_s2.py, Requisiten: pack_art6_props.py, Helfer: pack_art6_kit.py."""
from __future__ import annotations

from pack_art6_kit import *
from pack_art6_props import *
from pack_art6_s1 import *
from pack_art6_s1 import _bee
from pack_art6_s2 import *


# --------------------------------------------------------------------------- Szenen-Helfer


def ground_ring(w, cx, cy, rx, ry, ramp, a, b, th=0.16, depth=-50):
    """Ring auf dem Boden (Schachbrett aus zwei Rampentoenen); liegt ueber dem Boden, unter allen Figuren"""
    y0, y1 = max(0, int(cy - ry - 2)), min(w.h, int(cy + ry + 3))
    x0, x1 = max(0, int(cx - rx - 2)), min(w.w, int(cx + rx + 3))
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if 1 - th <= d <= 1 + th * 0.4 and w.depth[y, x] <= depth:
                w.px[y, x, :3] = RAMPS[ramp][a if (x + y) % 2 == 0 else b]
                w.depth[y, x] = depth


def ground_line(w, x0, y0, x1, y1, ramp, a, b, depth=-45):
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for k in range(n + 1):
        x = int(round(x0 + (x1 - x0) * k / max(1, n)))
        y = int(round(y0 + (y1 - y0) * k / max(1, n)))
        if 0 <= x < w.w and 0 <= y < w.h and w.depth[y, x] <= depth:
            w.px[y, x, :3] = RAMPS[ramp][a if k % 2 == 0 else b]
            w.depth[y, x] = depth


def confetti(w, rng, n, box=(4, 8, 140, 90)):
    cols = (('fire', 4), ('leaf', 4), ('ice', 4), ('gold', 5), ('purple', 4), ('teamA', 4), ('bone', 5))
    for _ in range(n):
        x, y = rng.randint(box[0], box[2]), rng.randint(box[1], box[3])
        r, i = cols[rng.randint(0, len(cols) - 1)]
        wput(w, x, y, r, i, 8900)
        if rng.random() < 0.4:
            wput(w, x + 1, y, r, i - 1, 8900)


def halo_small(w=16, h=7, ang=-8):
    c = Canvas(w, h)
    ring(c, w / 2, h / 2, w / 2 - 1, h / 2 - 0.8, 0.45, 'gold', lo=2, hi=5, ang=ang)
    c.outline(dark=1, lit=3)
    return c


def put_sprite(w, spr, x, y, depth=9000, flip=False):
    w.draw(spr, int(x), int(y), depth, flip)


# --------------------------------------------------------------------------- UZ-08 Segens-Nonne


@card_art('UZ-08')
def _art_uz08():
    w = ground_world('grass', 3)
    for (sp, x, y) in ((tree_blossom(2), 128, 56), (bush(1), 12, 44), (rock(2), 16, 90)):
        prop_at(w, sp, x, y)
    # Segen: goldener Ring am Boden, Heiligenschein ueber dem Beschuetzten
    ground_ring(w, 108, 80, 13, 4.2, 'gold', 4, 3)
    unit_at(w, spr_blessing_nun(), 48, 80, sh=(10, 3))
    unit_at(w, citizen('dirt', 1), 84, 90, sh=(5, 2))
    unit_at(w, citizen('cloth', 0), 108, 80, flip=True, sh=(5, 2))
    put_sprite(w, halo_small(16, 7, -6), 100, 51)
    # goldener Funkenbogen von der Nonne zum Segensziel
    for k, (x, y) in enumerate(arc_pts(64, 46, 106, 56, 16, 11)):
        wspark(w, int(x), int(y), 'gold', big=(k % 4 == 0)) if k % 2 == 0 else wput(w, int(x), int(y), 'gold', 4)
    wspark(w, 94, 60, 'gold', big=True)
    wspark(w, 122, 62, 'gold')
    wspark(w, 96, 74, 'gold')
    confetti(w, random.Random(8), 22, box=(60, 34, 134, 72))
    return finish(w)


# --------------------------------------------------------------------------- UZ-09 Traenkebrauer


@card_art('UZ-09')
def _art_uz09():
    w = ground_world('cobble', 6)
    for (sp, x, y) in ((herb_table(), 24, 44), (barrel(), 126, 36), (crate(), 128, 90)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_potion_brewer(), 50, 82, sh=(10, 3))
    unit_at(w, citizen('ice', 0), 112, 82, flip=True, sh=(5, 2))
    # Flaschenflug mit buntem Schweif
    pts = arc_pts(70, 58, 110, 66, 32, 16)
    for k, (x, y) in enumerate(pts[:9]):
        dot2(w, int(x), int(y), ('purple', 'slime', 'fire', 'ice')[k % 4])
    fx, fy = pts[9]
    put_sprite(w, flask('purple'), fx - 5, fy - 6)
    # Treffer: vier moegliche Traenke kreisen als Orbs um den Freund
    for (x, y, col) in ((101, 58, 'fire'), (124, 62, 'ice'), (98, 80, 'slime'), (126, 82, 'gold')):
        orb = Canvas(6, 6)
        ellipse(orb, 3, 3, 2.6, 2.6, col, lo=2, hi=5, ambient=0.3)
        orb.outline(dark=1, lit=3)
        put_sprite(w, orb, x - 3, y - 3)
    heal_cross(w, 112, 54, 'leaf')
    wspark(w, 106, 70, 'purple')
    wspark(w, 120, 72, 'gold')
    return finish(w)


# --------------------------------------------------------------------------- UZ-10 Fallensteller-Koboldin


@card_art('UZ-10')
def _art_uz10():
    w = ground_world('planks', 4)
    wall = stone_wall_piece(144, 20)
    shadow(w, 72, 36, 72, 3)
    w.draw(wall, 0, 34 - wall.h + 1, 34)
    for (sp, x, y) in ((barrel(), 14, 62), (crate(), 132, 52)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_trapper_kobold(), 44, 82, sh=(10, 3))
    # Falle A: scharf, mit Kaese; die Maus schnuppert schon
    w.draw(mouse_trap('armed'), 84, 50, 56)
    w.draw(cheese(), 106, 53, 57)
    w.draw(mouse(), 118, 62, 80)
    # Falle B: zugeschnappt, ein Topfhelm klemmt darin
    w.draw(mouse_trap('shut', helm=True), 104, 70, 88)
    # Falle C: scharf, vorn
    w.draw(mouse_trap('armed'), 76, 74, 90)
    w.draw(cheese(), 98, 77, 91)
    return finish(w)


# --------------------------------------------------------------------------- UZ-11 Imkerin


@card_art('UZ-11')
def _art_uz11():
    w = ground_world('grass', 5)
    for (sp, x, y) in ((bush(2), 14, 42), (tree_round(3), 132, 50), (honey_pot(), 24, 86)):
        prop_at(w, sp, x, y)
    for (col, x, y) in (('fire', 36, 52), ('cloth', 52, 46), ('gold', 90, 44), ('ice', 122, 80), ('fire', 82, 90), ('cloth', 130, 92)):
        prop_at(w, flower(col), x, y)
    prop_at(w, skep(), 108, 66)
    unit_at(w, spr_beekeeper(), 52, 84, sh=(10, 3))
    unit_at(w, citizen('cloth', 1), 98, 90, flip=True, sh=(5, 2))
    heal_cross(w, 98, 62, 'leaf')
    wspark(w, 106, 66, 'gold')
    # Bienen: Schwarm am Korb, Strom zur Imkerin
    for (x, y) in ((100, 38), (112, 36), (120, 44), (96, 46), (106, 30), (124, 54), (92, 56), (116, 26)):
        put_sprite(w, bee_big(), x, y)
    for k in range(8):
        t = k / 8.0
        x = 98 - 38 * t
        y = 52 + 6 * math.sin(t * 7) - 10 * t
        put_sprite(w, bee_big(), int(x), int(y))
        wput(w, int(x) + 6, int(y) + 3, 'gold', 3)
    return finish(w)


# --------------------------------------------------------------------------- UZ-12 Jongleur-Clown


@card_art('UZ-12')
def _art_uz12():
    w = ground_world('sand', 3)
    rng = random.Random(12)
    # Manegenrand: Ring aus roten und weissen Segmenten
    ground_ring(w, 72, 66, 62, 24, 'fire', 4, 4, th=0.07, depth=-60)
    ground_ring(w, 72, 66, 63, 25, 'bone', 5, 5, th=0.05, depth=-60)
    put_sprite(w, bunting(144), 0, 4, 9500)
    prop_at(w, striped_ball(8), 112, 88)
    unit_at(w, spr_juggler_clown(), 66, 84, sh=(14, 3))
    unit_at(w, citizen('leaf', 0), 128, 74, flip=True, sh=(5, 2))
    # Torte im Flug auf Kurs Gesicht
    pts = arc_pts(84, 56, 120, 62, 18, 10)
    for k, (x, y) in enumerate(pts[:6]):
        dot2(w, int(x), int(y), 'bone')
    put_sprite(w, pie(), pts[6][0] - 7, pts[6][1] - 6)
    confetti(w, rng, 46)
    return finish(w)


# --------------------------------------------------------------------------- UZ-13 Brieftauben-Bote


@card_art('UZ-13')
def _art_uz13():
    w = ground_world('dirt', 4)
    for (sp, x, y) in ((signpost(), 14, 46), (mailbox(), 126, 60), (bush(3), 130, 90)):
        prop_at(w, sp, x, y)
    unit_at(w, citizen('cloth', 0), 34, 82, sh=(5, 2))
    unit_at(w, citizen('ice', 1), 94, 90, sh=(5, 2))
    # Fluchtspuren der Freunde (Tempo +20 %)
    for (x, y) in ((24, 78), (20, 76), (22, 82), (84, 86), (80, 84), (82, 90)):
        wput(w, x, y, 'bone', 4)
        wput(w, x - 1, y, 'bone', 3)
        wput(w, x - 2, y, 'bone', 3)
    # Taube hoch in der Luft, Schatten am Boden
    shadow(w, 66, 74, 12, 2.5)
    dove = spr_pigeon_courier('idle', 0)
    put_sprite(w, dove, 44, 18)
    for (x, y, ln) in ((24, 30, 14), (18, 38, 20), (28, 46, 12), (36, 24, 8)):
        for k in range(ln):
            wput(w, x + k, y, 'bone', 5 if k % 3 else 4)
    for (x, y) in ((40, 52), (34, 58), (30, 64)):
        wput(w, x, y, 'bone', 5)
        wput(w, x + 1, y + 1, 'bone', 3)
    return finish(w)


# --------------------------------------------------------------------------- UZ-14 Gruft-Gaertnerin


@card_art('UZ-14')
def _art_uz14():
    w = ground_world('dark', 7)
    light_pool(w, 78, 74, 62, 30, 1)
    light_pool(w, 78, 74, 36, 18, 1)
    for (sp, x, y) in ((tombstone(0), 16, 42), (tombstone(1), 128, 46), (tombstone(0), 112, 92), (rose_bush(), 28, 90),
                       (rose_bush(), 128, 74), (tombstone(1), 38, 38), (lantern_post(), 112, 62)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_crypt_gardener(), 64, 82, sh=(11, 3))
    prop_at(w, bone_hand(), 98, 82)
    # Giesswasser rieselt auf die Skeletthand
    for (x, y) in ((86, 80), (88, 84), (90, 78), (89, 87), (92, 82)):
        wput(w, x, y, 'ice', 5)
        wput(w, x, y + 1, 'ice', 4)
    wspark(w, 102, 66, 'teamA')
    wspark(w, 112, 56, 'gold')
    return finish(w)


# --------------------------------------------------------------------------- UZ-15 Orakel-Kroete


@card_art('UZ-15')
def _art_uz15():
    w = ground_world('purple', 4)
    w.draw(rug(46, 24, 'gold'), 36, 62, -50)
    for (sp, x, y) in ((crate(), 14, 40), (barrel(), 128, 36)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_oracle_toad(), 60, 82, sh=(14, 3))
    # Voraussicht: Visionslinie von der Kugel zum Zielfeld; der Stein schlaegt daneben ein
    zielschatten(w, 104, 66, 14, 1)
    for k, (x, y) in enumerate(arc_pts(76, 62, 100, 64, 24, 10)):
        dot2(w, int(x), int(y), 'gold' if k % 2 else 'bone')
    w.draw(crater(26, 9), 118, 76, -45)
    prop_at(w, stone_projectile_small(), 131, 84)
    for k, (x, y) in enumerate(((139, 16), (138, 26), (136, 38), (135, 50), (133, 60))):
        dot2(w, x, y, 'bone')
    for (x, y) in ((117, 79), (140, 80), (121, 73), (137, 72), (128, 70)):
        wput(w, x, y, 'bone', 5)
        wput(w, x + 1, y - 1, 'bone', 4)
        wput(w, x - 1, y - 1, 'bone', 3)
    for (x, y) in ((24, 24), (98, 22), (112, 30), (12, 70), (84, 34), (70, 26), (50, 44)):
        wspark(w, x, y, 'purple' if (x + y) % 3 else 'gold')
    return finish(w)


# --------------------------------------------------------------------------- UZ-16 Regenmacher-Schamane


@card_art('UZ-16')
def _art_uz16():
    w = ground_world('grass', 6)
    rng = random.Random(16)
    w.px[:, :, :3] = darken_palette(w.px[:, :, :3], 1)
    for (x, y, pw) in ((28, 86, 20), (108, 88, 22), (114, 64, 16), (50, 62, 14)):
        w.draw(puddle(pw, 6), x - pw // 2, y - 3, -50)
    for (sp, x, y) in ((bush(2, True), 14, 44), (rock(1), 126, 48), (sprout(), 36, 54), (sprout(), 96, 50), (sprout(), 20, 82),
                       (flower('cloth'), 120, 78), (flower('gold'), 78, 90)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_rainmaker_shaman(), 70, 84, sh=(11, 3))
    # Regen ueber der ganzen Szene (schraege Striche)
    rain_streaks(w, rng, 52)
    for (x, y) in ((28, 86), (108, 88), (114, 64)):
        for (dx, dy) in ((-3, -1), (3, 0)):
            wput(w, x + dx, y + dy, 'sky', 5, 9000)
    return finish(w)


# --------------------------------------------------------------------------- UZ-17 Matrone Grosselfe


@card_art('UZ-17')
def _art_uz17():
    w = ground_world('planks', 3)
    w.px[:, :, :3] = darken_palette(w.px[:, :, :3], 1)
    w.draw(rug(64, 30, 'cloth'), 22, 56, -50)
    for (sp, x, y) in ((plant(), 14, 40), (basket(), 128, 40)):
        prop_at(w, sp, x, y)
    # roter Wollfaden schlaengelt sich ueber den Boden zu den frisch gestrickten Truppen
    for k in range(76):
        x = 56 + k * 1.15
        y = 84 + 3 * math.sin(k * 0.45)
        for dy in (0, 1):
            xi, yi = int(x), int(y) + dy
            if 0 <= xi < w.w:
                w.px[yi, xi, :3] = RAMPS['teamA'][4 if (k + dy) % 2 else 3]
                w.depth[yi, xi] = -45
    unit_at(w, spr_granny_elf(), 46, 80, sh=(11, 3))
    for (kind, x, y, f) in (('teamA', 98, 66, 0), ('leaf', 114, 80, 1), ('ice', 130, 68, 0)):
        unit_at(w, citizen(kind, f), x, y, flip=True, sh=(5, 2))
        for (dx, dy, i) in ((-6, -10, 5), (6, -12, 5), (-6, -9, 4)):
            wput(w, x + dx, y + dy, 'teamA', i)
    wspark(w, 88, 56, 'gold')
    wspark(w, 122, 58, 'gold')
    return finish(w)


# --------------------------------------------------------------------------- UZ-18 Schrott-Rudi


@card_art('UZ-18')
def _art_uz18():
    w = ground_world('dirt', 8)
    wall = stone_wall_piece(60, 22)
    shadow(w, 100, 62, 32, 3)
    w.draw(wall, 70, 58 - wall.h + 1, 58)
    for (x, y) in ((78, 41), (96, 45), (112, 41)):
        w.draw(metal_plate(15, 11), x, y, 59)
    for (sp, x, y) in ((scrap_heap(), 26, 50), (barrel(), 134, 88), (anvil(), 100, 88), (crate(), 14, 88)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_scrap_rudy(), 54, 84, sh=(12, 3))
    # Funken beim Nieten
    for (x, y, b) in ((76, 52, True), (74, 44, False), (80, 60, False), (70, 48, False)):
        wspark(w, x, y, 'gold' if (x + y) % 2 else 'fire', big=b)
    return finish(w)


# --------------------------------------------------------------------------- UZ-19 Opa Philosophenstein


@card_art('UZ-19')
def _art_uz19():
    w = ground_world('slab', 5)
    # Transmutationskreis am Boden: Doppelring, Dreieck, Punkte
    cx, cy = 66, 76
    ground_ring(w, cx, cy, 42, 15, 'gold', 4, 3, th=0.07)
    ground_ring(w, cx, cy, 33, 12, 'gold', 3, 2, th=0.07)
    tri = [(cx, cy - 12), (cx + 30, cy + 7), (cx - 30, cy + 7)]
    for (a, b) in ((0, 1), (1, 2), (2, 0)):
        ground_line(w, tri[a][0], tri[a][1], tri[b][0], tri[b][1], 'gold', 4, 3)
    for k in range(6):
        ang = k * math.pi / 3
        wput(w, int(cx + math.cos(ang) * 38), int(cy + math.sin(ang) * 13.5), 'gold', 5, -49)
    for (sp, x, y) in ((rack(), 16, 40), (barrel(), 132, 38)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_grandpa_philosopher(), 60, 84, sh=(13, 3))
    # Dampf steigt aus den Haaren auf (drei Schwaden)
    for (x0, ln, ph) in ((51, 20, 0.0), (56, 24, 1.8), (61, 18, 3.6)):
        for k in range(ln):
            xx = x0 + math.sin(k * 0.55 + ph) * 2.2
            yy = 38 - k
            if k >= ln - 4 and k % 2:
                continue
            wput(w, int(round(xx)), int(yy), 'bone', 5, 9000)
            wput(w, int(round(xx)) + 1, int(yy), 'fur', 3, 9000)
    # Heilung steigt auf, Blei wird zu Gold
    for (x, y) in ((100, 50), (112, 42), (92, 38)):
        heal_cross(w, x, y, 'leaf')
    prop_at(w, ingot('lead'), 108, 62)
    prop_at(w, ingot('gold'), 130, 62)
    for k in range(3):
        dot2(w, 114 + k * 4, 56, 'gold')
    wspark(w, 130, 52, 'gold', big=True)
    wspark(w, 100, 70, 'gold')
    return finish(w)



