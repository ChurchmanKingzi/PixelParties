# -*- coding: utf-8 -*-
"""Idle-Animation für Güldefaber, the King of Dwarfs (36x36 + 2 px links = 38x36).

* Gold glitzert: Lichtschimmer wandert über Fass, Zepterstab, Krone und
  Rüstung; Sternglitzer blitzen reihum; die Silberreifen des Fasses glänzen mit.
* Idle: er hebt das Fass-Zepter periodisch an, hält es triumphierend hoch und
  stampft es auf (Staub, Körper staucht, Bart schwingt nach); Atmen mit
  verzögertem Kopf, Blinzeln.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, step, sweep_level, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/g-ldefaber-the-king-of-dwarfs.png').convert('RGBA')).astype(int)
PAD_L = 2
BASE = np.concatenate([np.zeros((SRC.shape[0], PAD_L, 4), int), SRC], axis=1)
H, W = BASE.shape[:2]
N = 40
CLEAR = (0, 0, 0, 0)

GOLD = [rgb(h) for h in ('b34b1e', 'ee6428', 'ff9600', 'f29a3e', 'ffbb00', 'ffcf00',
                         'fad54a', 'fae86f', 'f7f7ad', 'ffffff')]
HOOP = [rgb(h) for h in ('807e81', '9e9b9f', 'bdb8bf', 'ffffff')]
GOLD_SET = set(GOLD[:-1])
HOOP_SET = set(HOOP[:-1])


def X(x):
    return x + PAD_L


SPARKLES = [(X(x), y, s) for x, y, s in [
    (6, 8, 0), (24, 14, 5), (16, 5, 10), (12, 28, 15), (19, 14, 20),
    (33, 24, 25), (8, 15, 30), (27, 14, 35), (16, 23, 18),
]]

# Augen (2x2) und Blinzeln
EYES = [(X(21), 20), (X(22), 20), (X(21), 21), (X(22), 21),
        (X(25), 20), (X(26), 20), (X(25), 21), (X(26), 21)]
SKIN = rgb('f6cd8b')
LID = rgb('181818')


def blink(i):
    return i % N in (12, 13, 33)


# ---------------------------------------------------------------- Zonen
SCEPTER_MAX_X = X(22)          # Fass + Stab liegen links davon (bis Zeile 20 Fass)


def is_scepter(x, y):
    if y <= 20 and x <= SCEPTER_MAX_X and not (x >= X(20) and y >= 17):
        return True
    return X(10) <= x <= X(13) and y >= 20


def is_arm(x, y):
    """Sichtbarer Armteil direkt am Griff (der Rest liegt unter der Schulterplatte)."""
    return x == X(14) and 23 <= y <= 26


def is_plate(x, y):
    """Goldene Schulterplatte über dem Arm."""
    return X(15) <= x <= X(18) and 21 <= y <= 26 and px(BASE, x, y) in GOLD_SET


# Cape-Farbe je Spalte (wird unter gehobenem Arm/Platte sichtbar)
CAPE_COL = {X(14): rgb('330606'), X(15): rgb('6e0d0d'), X(16): rgb('4f0a0a'),
            X(17): rgb('4f0a0a'), X(18): rgb('6e0d0d')}


CAPE_DARK, CAPE_MID = rgb('330606'), rgb('4f0a0a')


# Zepter-Zyklus: ruhen -> anheben -> oben halten (Zittern) -> aufstampfen -> nachfedern
#            0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
LIFT = ([0] * 8 + [-1, -2, -3, -3, -4, -4, -4, -4, -4, -3, -4, -4] +
        [-4, -4, -2, 1, 1, 0, 0, 0] + [0] * 12)
IMPACT = 23                    # Frame, in dem der Stab aufschlägt


def lift(i):
    return LIFT[i % N]


def body_dy(i, lag=0):
    """Körper: Atmen (2x pro Loop) + Stauchen beim Aufstampfen,
    Strecken beim Anheben."""
    t = (i - lag) % N
    d = 1 if (t % 20) >= 10 else 0
    if lift(i - lag) <= -3:
        d -= 1                                       # reckt sich stolz
    if t in (IMPACT, IMPACT + 1):
        d += 1                                       # staucht beim Aufstampfen
    return d


def beard_dx(x, y, i):
    """Bartspitzen schwingen nach (besonders nach dem Aufstampfen)."""
    if y >= 29 and X(20) <= x <= X(30):
        t = (i - IMPACT) % N
        kick = [1, 1, -1, -1, 1, 0][t] if t < 6 else 0
        return kick + int(round(0.6 * wave(i, 20, 1.0)))
    return 0


def source(i):
    a = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            lv = sweep_level(x, y, i, N, speed=1.8, slope=0.7, offset=-6)
            if lv and c in GOLD_SET:
                a[y, x] = step(GOLD, c, lv)
            elif lv and c in HOOP_SET:
                a[y, x] = step(HOOP, c, lv)
    if blink(i):
        for k, (x, y) in enumerate(EYES):
            a[y, x] = SKIN if y == 20 else LID
    return a


STAFF_COLS = {x: BASE[H - 1, x].copy() for x in range(X(10), X(14))}


SCEPTER_PX = [(x, y) for y in range(H) for x in range(W) if BASE[y, x, 3] and is_scepter(x, y)]
ARM_PX = [(x, y) for y in range(H) for x in range(W) if BASE[y, x, 3] and is_arm(x, y)]
PLATE_PX = [(x, y) for y in range(H) for x in range(W) if BASE[y, x, 3] and is_plate(x, y)]
MOVING = set(SCEPTER_PX) | set(ARM_PX) | set(PLATE_PX)
ARM_FILL = rgb('f29a3e')          # Armfarbe für den sichtbar werdenden Oberarm


def plate_dy(x, L):
    """Schulterplatte hebt sich mit und kippt: armseitig (links) stärker."""
    return int(round(L * 0.55 * (X(19) - x) / 4))


def frame(i):
    s = source(i)
    out = np.zeros_like(s)
    L = lift(i)
    # 1) Körper (Rückwärts-Mapping, ohne Zepter und Handschuh)
    for y in range(H):
        for x in range(W):
            if y >= 33:
                dx, dy = 0, 0                          # unterer Rand bleibt stehen
            elif y <= 23:
                dx, dy = beard_dx(x, y, i), body_dy(i, 1)   # Kopf, Krone
            else:
                dx, dy = beard_dx(x, y, i), body_dy(i, 0)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3] and (sx, sy) not in MOVING:
                out[y, x] = s[sy, sx]
    # Kopfkontur links, die sonst vom Fass verdeckt wird
    hd = body_dy(i, 1)
    for y in range(14, 17):
        if out[y + hd, X(22), 3] == 0:
            out[y + hd, X(22)] = rgb('525252')
    # 2) Schulter: Cape kommt zum Vorschein, Platte hebt/kippt, Arm hängt dran
    bd = body_dy(i, 0)
    arm_dy = L + bd
    for x, y in PLATE_PX + ARM_PX:
        if 0 <= y + bd < H and x in CAPE_COL:
            out[y + bd, x] = CAPE_COL[x]
    for x, y in PLATE_PX:
        yy = y + bd + plate_dy(x, L)
        if 0 <= yy < H:
            out[yy, x] = s[y, x]
    arm_rows = sorted(y for _, y in ARM_PX)
    for x, y in ARM_PX:
        if 0 <= y + arm_dy < H:
            out[y + arm_dy, x] = s[y, x]
    # Oberarm verbindet Hand und Schulter: Lücke unter der Hand bis zur Platte füllen
    x14 = X(14)
    shoulder_y = 25 + bd + plate_dy(X(15), L)       # Unterkante der Platte am Arm
    hand_bottom = arm_rows[-1] + arm_dy
    for y in range(hand_bottom + 1, shoulder_y + 1):
        if 0 <= y < H:
            out[y, x14] = ARM_FILL
    # 3) Zepter (Fass + Stab) vorne
    for x, y in SCEPTER_PX:
        if 0 <= y + L < H:
            out[y + L, x] = s[y, x]
    # Stab reicht immer bis zum unteren Bildrand (läuft außerhalb weiter)
    if L < 0:
        for x, c in STAFF_COLS.items():
            for y in range(H + L, H):
                out[y, x] = c
    # Aufprallstaub beim Aufstampfen
    t = (i - IMPACT) % N
    if t in (0, 1, 2):
        dust = rgb('d5d5d5', 200 - t * 60)
        for dx in ((-2, 5) if t == 0 else (-3, -2, 5, 6) if t == 1 else (-4, 7)):
            xx = X(10) + dx
            if 0 <= xx < W:
                out[H - 1 - (1 if t else 0), xx] = dust
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, rgb('fae86f'), rgb('ffcf00')).items():
        dy = L if x <= SCEPTER_MAX_X and y <= 30 and x < X(20) else body_dy(i, 1)
        if 0 <= x < W and 0 <= y + dy < H:
            out[y + dy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'guelde_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90)
