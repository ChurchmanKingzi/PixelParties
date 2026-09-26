# -*- coding: utf-8 -*-
"""Idle-Animation für Locke, the Unseen Saboteur (27x25 + 4 px oben = 27x29).

* Die Zündschnur der Dynamitstange brennt: der Funke sprüht jedes Frame neu,
  Funken fliegen weg, kleine Rauchwölkchen steigen auf.
* Lässiges Idle: er atmet ruhig (Füße fest) und wirft die Dynamitstange
  einmal pro Loop locker hoch und fängt sie wieder (die Stange ist dabei
  vollständig – der Teil hinter der Hand wird ergänzt).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, save_outputs

SRC = np.array(Image.open('src/locke-the-unseen-saboteur.png').convert('RGBA')).astype(int)
PT = 4
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 48

DYN = {rgb(c) for c in ('26030a', '4a0514', 'be111a', 'f23b1c', '870a23')}
SPARK_OLD = {rgb('ffff00'), rgb('fefefe')}
FUSE = [(20, 8), (20, 7), (20, 6), (21, 5), (22, 5)]
TIP = (23, 5)                                      # Funke am Ende der Zündschnur
FUSE_COL = rgb('000000')


def is_dyn(x, oy):
    return 18 <= x <= 22 and 9 <= oy <= 18 and px(SRC, x, oy) in DYN


DYNAMITE = [(x, oy) for oy in range(SRC.shape[0]) for x in range(W) if is_dyn(x, oy)]
OUTL, DARK, RED, HI, DEEP = rgb('26030a'), rgb('4a0514'), rgb('be111a'), rgb('f23b1c'), rgb('870a23')


def stick_color(x, oy):
    """Vollständige Dynamitstange (auch der Teil hinter der Hand)."""
    if px(SRC, x, oy) in DYN:
        return px(SRC, x, oy)
    if x == 18 or oy == 18:
        return OUTL
    if x == 21 or oy == 9:
        return DARK
    if x == 19:
        return RED if oy <= 14 else DEEP
    return HI if oy <= 14 else RED if oy <= 16 else DEEP


STICK = [(x, oy, stick_color(x, oy)) for oy in range(9, 19) for x in range(18, 22)]
HAND = [(x, oy) for oy in range(13, 18) for x in range(19, 23)
        if SRC[oy, x, 3] and px(SRC, x, oy) not in DYN]
# Arm hinter der Stange (sonst schwebt die Hand, wenn die Stange fliegt)
SLEEVE_OUT, SLEEVE, SLEEVE_HI = rgb('000000'), rgb('202020'), rgb('414141')
# Oberarm von der Schulter (Zeile 9) herunter, Unterarm bis zur Hand
ARM = [(18, oy, SLEEVE) for oy in range(9, 13)] + [(19, oy, SLEEVE_OUT) for oy in range(9, 13)] + \
      [(x, 13, SLEEVE_HI) for x in (18, 19)] + [(x, 14, SLEEVE_HI) for x in (18, 19)] + \
      [(x, oy, SLEEVE) for oy in (15, 16) for x in (18, 19)] + [(x, 17, SLEEVE_OUT) for x in (18, 19)]


def breath(i):
    return -1 if 6 <= i % 24 < 15 else 0


TOSS_START, TOSS_LEN = 26, 10


def toss(i):
    t = (i - TOSS_START) % N
    if t >= TOSS_LEN:
        return 0
    return -int(round(5 * math.sin(math.pi * t / TOSS_LEN)))


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


SPARK = [rgb('ffffff'), rgb('ffff00'), rgb('ffb000'), rgb('ff5a00')]


def draw_spark(out, x, y, i):
    """Sprühender Funke: heller Kern, zufällige Zacken, wegfliegende Funken."""
    def put(xx, yy, c):
        if 0 <= xx < W and 0 <= yy < H:
            out[yy, xx] = c
    put(x, y, SPARK[0])
    for k, (dx, dy) in enumerate(((1, 0), (-1, 0), (0, -1), (0, 1), (1, -1), (-1, -1), (1, 1))):
        if rnd(k, i) > 0.45:
            put(x + dx, y + dy, SPARK[1 if k < 4 else 2])
    for k in range(4):                                   # Funkenflug
        age = (i + k * 3) % 6
        ang = rnd(k + 20, (i + k * 3) // 6) * 2 * math.pi
        r = 1 + age
        xx = int(round(x + math.cos(ang) * r))
        yy = int(round(y + math.sin(ang) * r * 0.8 + 0.15 * age * age))
        if age < 5 and 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
            out[yy, xx] = SPARK[min(3, 1 + age // 2)]


def smoke(out, x, y, i):
    for k in range(3):
        t = (i + k * 5) % 15
        if t >= 12:
            continue
        xx = int(round(x + 0.3 * t + math.sin(t * 0.7 + k)))
        yy = y - 1 - t // 2
        a = int(150 * (1 - t / 12))
        for dx in range(1 if t < 5 else 2):
            if 0 <= xx + dx < W and 0 <= yy < H and out[yy, xx + dx, 3] == 0:
                out[yy, xx + dx] = (170, 170, 170, a)


def frame(i):
    s = BASE.copy()
    for oy in range(SRC.shape[0]):                       # alten Funken entfernen
        for x in range(W):
            if px(SRC, x, oy) in SPARK_OLD:
                s[oy + PT, x] = 0
    out = np.zeros_like(s)
    b = breath(i)
    feet = 21
    for y in range(H):
        for x in range(W):
            oy = y - PT
            if not s[y, x, 3] or (x, oy) in set(DYNAMITE) or (x, oy) in FUSE:
                continue
            out[y + (b if oy < feet else 0), x] = s[y, x]
    if b < 0:
        for x in range(W):
            if s[feet - 1 + PT, x, 3] and not out[feet - 1 + PT, x, 3]:
                out[feet - 1 + PT, x] = s[feet - 1 + PT, x]
    # Dynamit (+ Zündschnur): liegt in der Hand, fliegt kurz hoch
    dy = b + toss(i)
    for x, oy, c in ARM:                                 # Unterarm (liegt hinter der Stange)
        out[oy + PT + b, x] = c
    for x, oy, c in STICK:
        out[oy + PT + dy, x] = c
    for x, oy in HAND:                                   # Hand liegt immer vorne
        out[oy + PT + b, x] = s[oy + PT, x]
    for x, oy in FUSE:
        out[oy + PT + dy, x] = FUSE_COL
    tx, ty = TIP[0], TIP[1] + PT + dy
    smoke(out, tx, ty, i)
    draw_spark(out, tx, ty, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'locke_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=10)
