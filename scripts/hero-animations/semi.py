# -*- coding: utf-8 -*-
"""Idle-Animation für Treasure Huntress Semi (27x29).

* Gold funkelt: ein Lichtschimmer wandert diagonal über allen Goldschmuck,
  dazu blitzen reihum Sternglitzer auf (Diadem, Armreifen, Kette, Amulett).
* Flügel flattern sanft (Spitzen biegen sich), Glanzlicht läuft darüber.
* Keckes Zwinkern (halb -> zu -> halb), ihr Grinsen wird dabei breiter.
* Ruhige Idle-Haltung: Atemwelle läuft von der Hüfte nach oben durch
  Oberkörper, Kopf und Haar.
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/treasure-huntress-semi.png').convert('RGBA'))
H, W = BASE.shape[:2]
N = 32


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


CLEAR = (0, 0, 0, 0)
WHITE = rgb('ffffff')
# Gold-Leiter dunkel -> hell
GOLD = [rgb('c06004'), rgb('e68310'), rgb('ffb418'), rgb('ffde5a'), rgb('fff6ac'), WHITE]
GOLD_SET = set(GOLD[:-1])
STEEL = [rgb('676767'), rgb('b7b7b7'), rgb('d3d3d3'), rgb('f7f7f7'), WHITE]


def step(ladder, c, d):
    if c not in ladder:
        return c
    return ladder[max(0, min(len(ladder) - 1, ladder.index(c) + d))]


# Goldpixel: Goldfarben außerhalb der Hautpartien
GOLD_PX = {(x, y) for y in range(H) for x in range(W) if px(BASE, x, y) in GOLD_SET}
WING_L = [(4, 13), (4, 12), (3, 12), (2, 12), (1, 12)]       # vom Ansatz zur Spitze
WING_R = [(22, 11), (23, 11), (24, 11), (25, 11)]


# ---------------------------------------------------------------- Schimmer
def sweep_level(x, y, i):
    """Diagonales Lichtband wandert einmal pro Loop über die Figur."""
    pos = (i % N) * 2.2 - 8                  # Bandposition auf der Diagonale
    d = (x + y * 0.6) - pos
    if abs(d) < 1.0:
        return 2
    if abs(d) < 2.2:
        return 1
    return 0


def wing_shine(wing, i, start):
    """Glanzpunkt läuft den Flügel entlang (1 Frame pro Pixel)."""
    t = (i - start) % N
    if t < len(wing):
        return {wing[t]: 2, **({wing[t - 1]: 1} if t > 0 else {})}
    return {}


# ---------------------------------------------------------------- Glitzer
SPARKLES = [  # (x, y, Startframe)
    (18, 3, 0), (6, 12, 5), (17, 16, 10), (22, 12, 15),
    (16, 4, 20), (15, 19, 24), (14, 14, 28),
]
# Stern-Stufen: (Armlänge, Farbe Mitte, Farbe Arm innen, Farbe Arm außen)
STAR = [
    (0, rgb('fff6ac'), None, None),
    (1, WHITE, rgb('fff6ac'), None),
    (2, WHITE, WHITE, rgb('ffde5a')),
    (1, WHITE, rgb('ffde5a'), None),
    (0, rgb('fff6ac'), None, None),
]


def sparkle_pixels(i):
    out = {}
    for x, y, start in SPARKLES:
        t = (i - start) % N
        if t >= len(STAR):
            continue
        arm, c0, c1, c2 = STAR[t]
        out[(x, y)] = c0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if arm >= 1:
                out[(x + dx, y + dy)] = c1
            if arm >= 2:
                out[(x + 2 * dx, y + 2 * dy)] = c2
    return out


# ---------------------------------------------------------------- Zwinkern
SKIN = rgb('f5ce88')
SKIN_L = rgb('fce7d6')
LASH = rgb('000000')
GRIN = rgb('ffffff')
WINK_EYE = [(17, 10), (18, 10), (17, 11), (18, 11)]


def wink_state(i):
    """0 offen, 1 halb, 2 zu."""
    return {20: 1, 21: 2, 22: 2, 23: 2, 24: 2, 25: 2, 26: 1}.get(i % N, 0)


def apply_wink(a, i):
    st = wink_state(i)
    if st == 0:
        return
    if st == 1:                              # Lid halb unten
        a[10, 17] = LASH
        a[10, 18] = LASH
    else:                                    # zu: "^" (mit Gesichtskontur bei x=19)
        a[10, 17] = SKIN_L
        a[10, 18] = LASH
        a[11, 17] = LASH
        a[11, 18] = SKIN
        a[13, 15] = GRIN                     # vorhandenes Grinsen (14,13) wird breiter


# ---------------------------------------------------------------- Bewegung
def bob(i, lag=0):
    """Ruhiges Atmen: 1 px runter in der zweiten Loop-Hälfte."""
    t = (i - lag) % N
    return 1 if 8 <= t < 24 else 0


# Flügel: spaltenweise Biegung, Auslenkung wächst vom Ansatz zur Spitze
WING_ROWS = range(9, 20)
WINGS = [  # (Spalten, Ansatz-x, Richtung, Phase)
    (range(0, 5), 5, -1, 0.0),
    (range(23, 27), 22, 1, 0.5),
]
WING_AMP = 1.8
WING_PERIOD = 16


def wing_dy(x, i, root, direction, phase):
    reach = abs(x - root) / 4                # 0 am Ansatz .. 1 an der Spitze
    t = 2 * math.pi * i / WING_PERIOD + phase
    return int(round(-WING_AMP * math.sin(t) * min(1.0, reach) ** 1.2))


def flutter_wings(a, i):
    src = a.copy()
    for cols, root, direction, phase in WINGS:
        for x in cols:
            dy = wing_dy(x, i, root, direction, phase)
            if dy == 0:
                continue
            for y in WING_ROWS:
                sy = y - dy
                a[y, x] = src[sy, x] if sy in WING_ROWS else CLEAR


def zone_lag(x, y):
    """Atemwelle von unten nach oben; None = fest (Beine)."""
    if y >= 22:
        return None
    if (x <= 7 or x >= 21) and 9 <= y <= 19:
        return 2                             # Arme + Flügel
    if y <= 1:
        return 4                             # Haarspitze
    if y <= 4:
        return 3                             # Haar oben
    if y <= 13:
        return 2                             # Kopf
    if y <= 16:
        return 1                             # Brust/Schultern
    return 0                                 # Hüfte


def offset(x, y, i):
    lag = zone_lag(x, y)
    if lag is None:
        return 0, 0
    return 0, bob(i, lag)


def source(i):
    a = BASE.copy()
    for (x, y) in GOLD_PX:
        lv = sweep_level(x, y, i)
        if lv:
            a[y, x] = step(GOLD, px(BASE, x, y), lv)
    for wing, start in ((WING_L, 3), (WING_R, 14)):
        for (x, y), lv in wing_shine(wing, i, start).items():
            a[y, x] = step(STEEL, px(BASE, x, y), lv)
    flutter_wings(a, i)
    apply_wink(a, i)
    return a


def frame(i):
    s = source(i)
    out = np.zeros_like(BASE)
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sy < H and 0 <= sx < W:
                out[y, x] = s[sy, sx]
    for (x, y), c in sparkle_pixels(i).items():
        dx, dy = offset(x, y, i)
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H:
            out[yy, xx] = c
    return out


frames = [frame(i) for i in range(N)]


def save_gif(path, scale, ms, bg):
    imgs = []
    for f in frames:
        im = Image.fromarray(f).resize((W * scale, H * scale), Image.NEAREST)
        base = Image.new('RGBA', im.size, bg)
        base.alpha_composite(im)
        imgs.append(base.convert('RGB'))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms,
                 loop=0, disposal=2, optimize=False)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 90
    save_gif(f'semi_idle_{tag}.gif', 10, ms, (40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'semi_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
