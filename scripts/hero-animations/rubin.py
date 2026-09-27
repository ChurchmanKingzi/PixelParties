# -*- coding: utf-8 -*-
"""Idle-Animation für Rubin, the Dragoneer Champion (60x52).

* Flamme: prozedural aus einer Hitzekarte des Originals. Jede Spalte wird
  zeitabhängig gestreckt (Zungen wachsen/schrumpfen), eine weiche Rausch-
  textur scrollt nach oben (aufsteigende Hitze), die Spitze pendelt.
  Funken lösen sich und verglühen. Alles loopt nahtlos über N Frames.
* Atmung: Schultern + Kopf heben sich, Kopf folgt 1 Frame später,
  der Flammenarm 2 Frames später.
* Umhang weht: Welle läuft den Stoff hinunter, Auslenkung wächst zum Saum.
* Linker Arm pendelt leicht um die Schulter.
* Rauch: beim Ausatmen zwei Wölkchen aus den Nüstern.
* Blinzeln einmal pro Loop.
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/rubin-the-dragoneer-champion.png').convert('RGBA'))
H, W = BASE.shape[:2]
N = 32


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


CLEAR = (0, 0, 0, 0)
FIRE = [None, rgb('ca2c29'), rgb('f47b22'), rgb('f6e70e'), rgb('f7f5b8')]
HEAT_OF = {c: k for k, c in enumerate(FIRE) if c}
EMBER = [rgb('f47b22'), rgb('ca2c29'), rgb('bd1819'), rgb('9c1219')]
LID_DARK = rgb('6d0043')
LID_SKIN = rgb('a0003c')


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


# ---------------------------------------------------------------- Flamme
FX0, FX1, FY0, FY1 = 41, 54, 3, 25        # Arbeitsbereich der Flamme
FLAME_BASE = 25                            # unterste Flammenzeile
HEAT = np.zeros((H, W), dtype=float)
FLAME_MASK = set()
for y in range(FY0, FY1 + 1):
    for x in range(FX0, FX1 + 1):
        c = px(BASE, x, y)
        if c in HEAT_OF:
            HEAT[y, x] = HEAT_OF[c]
            FLAME_MASK.add((x, y))

rng = np.random.default_rng(7)
_noise = rng.random((32, W))
# weich machen (vertikal zyklisch, horizontal geklemmt)
for _ in range(2):
    _noise = (np.roll(_noise, 1, 0) + _noise * 2 + np.roll(_noise, -1, 0)) / 4
    _noise = (np.roll(_noise, 1, 1) + _noise * 2 + np.roll(_noise, -1, 1)) / 4
_noise = (_noise - _noise.min()) / (_noise.max() - _noise.min())
PHASE = rng.random(W) * 2 * math.pi
PHASE2 = rng.random(W) * 2 * math.pi


def column_stretch(x, i):
    t = 2 * math.pi * i / N
    n = 0.6 * math.sin(2 * t + PHASE[x]) + 0.4 * math.sin(3 * t + PHASE2[x])
    return 1.0 + 0.2 * n


def lean(y, i):
    """Spitze pendelt: bis zu 1 px in den oberen Zeilen."""
    return round(0.9 * math.sin(2 * math.pi * i / N * 2) * max(0, (18 - y)) / 7)


def flame_heat(x, y, i):
    s = column_stretch(x, i)
    sy = round(FLAME_BASE - (FLAME_BASE - y) / s)
    sx = x - lean(y, i)
    if not (FY0 <= sy <= FY1 and FX0 <= sx <= FX1):
        return 0
    h = HEAT[sy, sx]
    if h == 0:
        return 0
    if h >= 2:                               # Kern flackert, Rand bleibt stabil
        v = _noise[(y + i) % 32, x]          # scrollt nach oben
        if v > 0.78:
            h += 1
        elif v < 0.22:
            h -= 1
        h = max(2, min(4, h))
    return int(h)


EMBERS = [  # (Startspalte, Startzeile, Drift, Frame-Versatz)
    (43, 12, 0, 0), (47, 11, 1, 11), (50, 13, 1, 21), (45, 12, -1, 6),
]


def ember_pixels(i):
    out = []
    for x0, y0, drift, off in EMBERS:
        t = (i + off) % N
        if t >= 12:
            continue
        k = t // 3                            # 4 Stufen à 3 Frames
        y = y0 - t // 2 - 1
        x = x0 + (drift if t >= 6 else 0)
        out.append(((x, y), EMBER[k]))
    return out


# ---------------------------------------------------------------- Körper
def breath(i, lag=0):
    """-1 = eingeatmet (Schultern oben)."""
    t = (i - lag) % N
    return -1 if 4 <= t < 18 else 0


def zone_lag(x, y):
    if x >= 42 and y <= 29:
        return 2                              # Flammenarm hebt sich verzögert
    if x >= 42 or y > 22 or x < 14:
        return None                           # Umhang, Beine: fest
    if y <= 18 and 23 <= x <= 40:
        return 1                              # Kopf
    return 0                                  # Schultern


EYES_WHITE = [(29, 12), (29, 13), (34, 12), (33, 13)]
EYES_PUPIL = [(30, 13), (34, 13)]


def blink(i):
    return i in (24, 25)


# ---------------------------------------------------------------- Umhang
CAPE_COLS = {rgb('5c0c11'), rgb('bd1819'), rgb('dc2d29'), rgb('9c1219')}
CAPE_TOP = 23


def is_cape(x, y):
    return y >= CAPE_TOP and not (26 <= x <= 35) and px(BASE, x, y) in CAPE_COLS


CAPE_BOTTOM = H - 1
for _y in range(H - 1, 0, -1):
    if any(px(BASE, _x, _y) in CAPE_COLS for _x in range(W)):
        CAPE_BOTTOM = _y
        break
LEFT_IN, RIGHT_IN = 22, 37           # Ansatzkante am Körper (u = 0)


def _outer(y, left):
    xs = [x for x in range(W) if is_cape(x, y) and ((x < 30) == left)]
    if not xs:
        return None
    return min(xs) if left else max(xs)


OUTER_L = {y: _outer(y, True) for y in range(CAPE_TOP, H)}
OUTER_R = {y: _outer(y, False) for y in range(CAPE_TOP, H)}


def cloth_uv(x, y, left):
    """Stoffkoordinaten: u quer (0 Körper .. 1 Außenkante), v längs (0 .. 1 Saum)."""
    v = max(0.0, min(1.0, (y - CAPE_TOP) / (CAPE_BOTTOM - CAPE_TOP)))
    yi = min(max(int(round(y)), CAPE_TOP), H - 1)
    if left:
        xo = OUTER_L.get(yi)
        u = 0.0 if xo is None or xo >= LEFT_IN else (LEFT_IN - x) / (LEFT_IN - xo)
    else:
        xo = OUTER_R.get(yi)
        u = 0.0 if xo is None or xo <= RIGHT_IN else (x - RIGHT_IN) / (xo - RIGHT_IN)
    return max(0.0, min(1.0, u)), v


def billow(x, y, i, left):
    """Verschiebung (dx, dy) eines Stoffpunkts: Böe hebt/bläht, Wellen laufen durch."""
    u, v = cloth_uv(x, y, left)
    if u == 0 or v == 0:
        return 0.0, 0.0
    ph = 0.0 if left else 1.9
    t = 2 * math.pi * i / N
    gust = 0.5 + 0.5 * math.sin(t + ph)                     # 0 .. 1
    lift = 5.5 * gust * u ** 1.5 * v ** 1.3                  # Saumecke hebt ab
    flare = 2.2 * gust * u * v                               # bläht nach außen
    ripple = 1.3 * math.sin(2 * t - 5.0 * v - 3.0 * u + ph) * u * v
    sway = 0.9 * math.sin(2 * t - 4.0 * v + ph + 1.0) * u * v
    side = -1 if left else 1
    return side * (flare + sway), -lift + ripple


CAPE_OUTLINE = rgb('5c0c11')


def cloth_layer(src, left):
    """Umhangpixel einer Hälfte plus Füllung unter dem Körper (gegen Lücken).

    Die Outline-Farbe wird durch die nächste Stofffarbe ersetzt; die Outline
    wird nach dem Verformen neu (1 px) um die Silhouette gezeichnet.
    """
    cloth = {}
    for y in range(CAPE_TOP, H):
        known = [x for x in range(W) if is_cape(x, y) and ((x < 30) == left)]
        fabric = [x for x in known if px(src, x, y) != CAPE_OUTLINE]
        if not known:
            continue
        lo, hi = (min(known), 29) if left else (30, max(known))
        for x in range(lo, hi + 1):
            if not (is_cape(x, y) or src[y, x][3]):
                continue
            if fabric:
                k = x if x in fabric else min(fabric, key=lambda q: abs(q - x))
                cloth[(x, y)] = src[y, k].copy()
            elif (x, y - 1) in cloth:
                cloth[(x, y)] = cloth[(x, y - 1)].copy()
    return cloth


SUB = 4


def wave_cape(a, i):
    src = a.copy()
    body = {(x, y): src[y, x].copy() for y in range(CAPE_TOP, H) for x in range(W)
            if src[y, x][3] and not is_cape(x, y)}
    for y in range(CAPE_TOP, H):
        for x in range(W):
            if is_cape(x, y):
                a[y, x] = CLEAR
    layer = {}
    for left in (True, False):
        cloth = cloth_layer(src, left)
        for (x, y) in sorted(cloth, key=lambda p: p[1]):
            c = cloth[(x, y)]
            for sy in range(SUB):
                for sx in range(SUB):
                    fx = x - 0.5 + (sx + 0.5) / SUB
                    fy = y - 0.5 + (sy + 0.5) / SUB
                    dx, dy = billow(fx, fy, i, left)
                    tx, ty = int(round(fx + dx)), int(round(fy + dy))
                    if 0 <= tx < W and 0 <= ty < H:
                        layer[(tx, ty)] = c
    for (x, y), c in layer.items():
        if a[y, x][3] == 0:
            a[y, x] = c
    for (x, y), c in body.items():
        a[y, x] = c
    # frische 1-px-Outline: sichtbare Stoffpixel, die an Transparenz grenzen
    edge = []
    for (x, y) in layer:
        if (x, y) in body:
            continue
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < W and 0 <= ny < H) or a[ny, nx][3] == 0:
                edge.append((x, y))
                break
    for x, y in edge:
        a[y, x] = CAPE_OUTLINE


# ---------------------------------------------------------------- linker Arm
ARM_OK = {rgb('6d0043'), rgb('ff6766'), rgb('dc2544'), rgb('a0003c'), rgb('ff83c1'),
          rgb('f6ffff')}
ARM_ROWS = {y: (20, 27) for y in range(24, 38)}
ARM = set()
for _y, (_x0, _x1) in ARM_ROWS.items():
    for _x in range(_x0, _x1 + 1):
        _c = px(BASE, _x, _y)
        if _c in ARM_OK or (_y >= 33 and _c in (rgb('292929'), rgb('dc2d29')) and _x <= 23):
            ARM.add((_x, _y))


def arm_dx(y, i):
    """Pendel um die Schulter (Zeile 24); Hand schwingt am weitesten."""
    swing = 1.4 * math.sin(2 * math.pi * (i - 3) / N)
    return round(swing * (y - 24) / 13)


def move_arm(a, i):
    src = a.copy()
    for y in range(24, 38):
        dx = arm_dx(y, i)
        if dx == 0:
            continue
        pts = sorted(x for x in range(W) if (x, y) in ARM)
        if not pts:
            continue
        x0, x1 = pts[0], pts[-1]
        # frei werdende Seite mit dem Nachbarn dahinter füllen
        for x in pts:
            a[y, x] = src[y, x1 + 1] if dx < 0 else src[y, x0 - 1]
        for x in pts:
            a[y, x + dx] = src[y, x]


# ---------------------------------------------------------------- Rauch
# Beim Ausatmen schnaubt Rubin zwei Rauchwölkchen aus den Nüstern. Sie treten
# direkt an den Nüstern aus, wachsen, ziehen nach außen und oben und verblassen.
SMOKE = [rgb('d8d8d8'), rgb('9c9c9c'), rgb('7b7b7b'), rgb('6b6b6b'), rgb('525252')]
# (Mittelpunkt x, y, Radius) pro Schritt – linke Seite, rechts gespiegelt
PUFF_PATH = [(30.0, 16.0, 0.4), (29.0, 16.1, 0.6), (27.9, 15.9, 0.8),
             (26.6, 15.4, 1.0), (25.3, 14.6, 1.15), (24.0, 13.6, 1.25),
             (22.9, 12.4, 1.3), (22.0, 11.1, 1.25), (21.3, 9.7, 1.05)]
FACE_STEPS = 3                       # so viele Schritte darf Rauch aufs Gesicht
MIRROR_X = 63.0                      # Nüstern liegen bei x=30 und x=33
PUFFS = [(18, 1.0), (22, 0.75)]      # (Startframe, Größenfaktor)


def smoke_pixels(i, base):
    out = {}
    for start, scale in PUFFS:
        t = (i - start) % N
        k = t // 2                    # 2 Frames pro Schritt
        if k >= len(PUFF_PATH):
            continue
        cx, cy, r = PUFF_PATH[k]
        r *= scale
        shade = min(len(SMOKE) - 1, (k * len(SMOKE)) // len(PUFF_PATH))
        for mx in (False, True):
            x0 = MIRROR_X - cx if mx else cx
            for y in range(int(cy - r - 1), int(cy + r + 2)):
                for x in range(int(x0 - r - 1), int(x0 + r + 2)):
                    d = math.hypot(x - x0, y - cy)
                    if d > r + 0.35 or not (0 <= x < W and 0 <= y < H):
                        continue
                    if base[y, x][3] and (x, y) not in out and k >= FACE_STEPS:
                        continue      # später nicht mehr übers Gesicht malen
                    # Oberseite heller: kleines Highlight
                    hl = y < cy - 0.3 and shade > 0
                    out[(x, y)] = SMOKE[shade - 1 if hl else shade]
    return out


def source(i):
    a = BASE.copy()
    # Flamme neu zeichnen
    for x, y in FLAME_MASK:
        a[y, x] = CLEAR
    for y in range(FY0, FY1 + 1):
        for x in range(FX0, FX1 + 1):
            h = flame_heat(x, y, i)
            if h and px(BASE, x, y)[3] == 0 or h and (x, y) in FLAME_MASK:
                a[y, x] = FIRE[h]
    for (x, y), c in ember_pixels(i):
        if px(a, x, y)[3] == 0:
            a[y, x] = c
    # Blinzeln
    if blink(i):
        for x, y in EYES_WHITE:
            a[y, x] = LID_SKIN if y == 12 else LID_DARK
        for x, y in EYES_PUPIL:
            a[y, x] = LID_DARK
    wave_cape(a, i)
    move_arm(a, i)
    for (x, y), c in smoke_pixels(i, a).items():
        a[y, x] = c
    return a


def frame(i):
    s = source(i)
    out = np.zeros_like(BASE)
    for y in range(H):
        for x in range(W):
            lag = zone_lag(x, y)
            dy = 0 if lag is None else breath(i, lag)
            sy = y - dy
            out[y, x] = s[sy, x] if 0 <= sy < H else CLEAR
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
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    save_gif(f'rubin_idle_{tag}.gif', 8, ms, (40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'rubin_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
