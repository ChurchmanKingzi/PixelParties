"""Einheiten der Stilprobe. Alle Figuren blicken nach rechts (links = gespiegelt).

Gesichtsregel (v0.3): Gesichter sind bewusst schlicht. Augen sind 1-2 Pixel, kein Weiß, keine Brauen,
kein Glanzpunkt; Mund höchstens eine kurze Linie; Charakter entsteht aus Silhouette und Accessoires.
"""
from __future__ import annotations

import math
import random

from pixl import *


# =========================================================================== Skelett


def skeleton(anim='walk', f=0):
    c = Canvas(32, 32)
    stride = [4, 0, -4, 0][f % 4] if anim == 'walk' else 0
    bob = [0, -1, 0, -1][f % 4] if anim == 'walk' else [0, -1][f % 2] if anim == 'idle' else 0
    swing = [1, 0, -1, 0][f % 4] if anim == 'walk' else 0
    hx, hy = 15, 25 + bob
    # hinteres Bein (dunkler)
    fx = hx - stride
    thick_line(c, hx, hy, fx, 30, 2, 'bone', lo=1, hi=3)
    for dx in range(0, 4):
        c.put_ramp(fx + dx - 1, 30, 'bone', 2)
    thick_line(c, 14, 17 + bob, 11 - swing, 22 + bob, 2, 'bone', lo=1, hi=3)
    # Becken + Rippen
    ellipse(c, 15.5, hy - 0.5, 3.6, 2.2, 'bone', lo=2, hi=4)
    ellipse(c, 16, 20 + bob, 4.8, 5.0, 'bone', lo=2, hi=5, flatness=0.25)
    for y in (18, 20, 22):
        for x in range(13, 20):
            if x != 16:
                c.put_ramp(x, y + bob, 'bone', 1 if (x + y) % 2 == 0 else 2)
    for y in range(16, 25):
        c.put_ramp(16, y + bob, 'bone', 3)
    # vorderes Bein
    fx2 = hx + stride
    thick_line(c, hx + 1, hy, fx2, 30, 2, 'bone', lo=2, hi=5)
    for dx in range(0, 5):
        c.put_ramp(fx2 + dx - 1, 30, 'bone', 3)
        c.put_ramp(fx2 + dx - 1, 31, 'bone', 1)
    # Löffel-Schwert
    ang_tip = (27, 10)
    hand = (22, 20 + bob + swing)
    if anim == 'attack':
        hand = {0: (21, 17), 1: (24, 19), 2: (23, 21)}[f % 3]
        ang_tip = {0: (27, 10), 1: (30, 14), 2: (29, 22)}[f % 3]
    tip = ang_tip if anim == 'attack' else (27, 10 - (1 if bob else 0))
    thick_line(c, 17, 18 + bob, hand[0], hand[1] + bob, 2, 'bone', lo=2, hi=5)
    thick_line(c, hand[0], hand[1] + bob, tip[0], tip[1] + bob, 2, 'wood', lo=2, hi=4)
    ellipse(c, tip[0] + 0.5, tip[1] - 1.5 + bob, 2.8, 3.4, 'wood', lo=2, hi=5)
    c.put_ramp(tip[0], tip[1] - 2 + bob, 'wood', 1)
    c.put_ramp(tip[0] + 1, tip[1] - 1 + bob, 'wood', 1)
    # Schädel (Gesicht: zwei Höhlen, ein Kiefer)
    ellipse(c, 17.5, 11 + bob, 5.6, 5.2, 'bone', lo=2, hi=5, flatness=0.15)
    for x in range(14, 22):
        c.put_ramp(x, 15 + bob, 'bone', 3)
        c.put_ramp(x, 16 + bob, 'bone', 2)
    c.put_ramp(16, 16 + bob, 'coal', 1)
    c.put_ramp(19, 16 + bob, 'coal', 1)
    c.rect(19, 10 + bob, 20, 12 + bob, 'coal', 1)
    # Topf-Helm
    def pot_clip(x, y):
        return y <= 9 + bob
    ellipse(c, 17.5, 9.0, 6.6, 6.0, 'metal', lo=1, hi=5, clip=pot_clip)
    for x in range(11, 25):
        c.put_ramp(x, 9 + bob, 'metal', 1 if x % 2 else 2)
    for (x, y) in [(10, 6), (9, 7), (9, 8), (10, 8), (25, 6), (26, 7), (26, 8), (25, 8)]:
        c.put_ramp(x, y + bob, 'metal', 4 if x < 12 else 2)
    c.put_ramp(17, 2 + bob, 'metal', 4)
    c.put_ramp(18, 2 + bob, 'metal', 3)
    c.put_ramp(17, 3 + bob, 'metal', 3)
    c.put_ramp(18, 3 + bob, 'metal', 2)
    c.outline()
    return c


# =========================================================================== Beute-Goblin


def goblin(anim='walk', f=0):
    c = Canvas(32, 32)
    stride = [3, 0, -3, 0][f % 4] if anim == 'walk' else 0
    bob = [0, -1, 0, -1][f % 4] if anim == 'walk' else [0, -1][f % 2]
    sway = [0, 1, 2, 1][f % 4] if anim == 'walk' else 0
    hx, hy = 15, 24 + bob
    thick_line(c, hx - 1, hy, hx - 1 - stride, 29, 3, 'goblin', lo=1, hi=3)
    for dx in range(-1, 4):
        c.put_ramp(hx - 2 - stride + dx, 30, 'goblin', 2)
        c.put_ramp(hx - 2 - stride + dx, 31, 'goblin', 1)
    # Sack
    ellipse(c, 9 - sway * 0.5, 19 + bob, 5.8, 6.4, 'dirt', lo=1, hi=4)
    for (x, y) in [(8, 12), (9, 13), (10, 12), (9, 11), (10, 11)]:
        c.put_ramp(x, y + bob, 'dirt', 2)
    c.put_ramp(9, 13 + bob, 'dirt', 5)
    # Körper (Lumpen-Tunika)
    round_rect(c, 11, 16 + bob, 20, 24 + bob, 'cloth', lo=1, hi=4, radius=2)
    for x in range(11, 21, 2):
        c.put_ramp(x, 24 + bob, 'cloth', 1)
        c.put_ramp(x + 1, 25 + bob, 'cloth', 1)
    for x in range(11, 21):
        c.put_ramp(x, 21 + bob, 'gold', 2 if x % 2 else 1)
    c.put_ramp(15, 21 + bob, 'gold', 5)
    thick_line(c, hx + 2, hy, hx + 2 + stride, 29, 3, 'goblin', lo=2, hi=5)
    for dx in range(-1, 5):
        c.put_ramp(hx + 2 + stride + dx, 30, 'goblin', 3)
        c.put_ramp(hx + 2 + stride + dx, 31, 'goblin', 1)
    atk = {0: (-1, 0), 1: (2, -2), 2: (4, 0)}[f % 3] if anim == 'attack' else (0, 0)
    ax, ay = 21 + atk[0], 22 + atk[1] + bob
    thick_line(c, 18, 18 + bob, ax, ay, 2, 'goblin', lo=2, hi=5)
    c.rect(ax, ay - 1, ax + 3, ay, 'metal', 4)
    c.put_ramp(ax + 4, ay - 1, 'metal', 5)
    c.put_ramp(ax - 1, ay, 'wood', 3)
    # Kopf: große Silhouette, Gesicht nur Auge + Mundstrich (v0.3: keine Schnauzenkugel, kein Zahn)
    ellipse(c, 17.5, 11 + bob, 6.8, 5.8, 'goblin', lo=2, hi=5)
    poly(c, [(12, 9 + bob), (3, 5 + bob), (11, 14 + bob)], 'goblin', lo=1, hi=4)
    poly(c, [(22, 7 + bob), (28, 3 + bob), (24, 12 + bob)], 'goblin', lo=2, hi=5)
    c.put_ramp(5, 6 + bob, 'skin', 3)
    c.put_ramp(6, 7 + bob, 'skin', 2)
    c.rect(20, 9 + bob, 21, 10 + bob, 'coal', 1)          # ein Auge, 2 x 2
    c.put_ramp(20, 9 + bob, 'bone', 5)                   # Glanzpunkt
    c.put_ramp(24, 12 + bob, 'goblin', 1)                # Nasenloch
    for x in range(20, 24):
        c.put_ramp(x, 14 + bob, 'goblin', 1)             # Mundstrich
    c.outline()
    return c


# =========================================================================== Rutsch-Bär (56x38)


def bear(anim='slide', f=0):
    c = Canvas(56, 38)
    rnd = random.Random(40 + f)
    bob = [0, -1, 0][f % 3]
    wav = [0, 1, 0][f % 3]
    reach = [0, 1, 2][f % 3]
    for _ in range(26):
        x = rnd.randint(0, 20)
        y = rnd.randint(27, 36)
        c.put_ramp(x, y, 'ice', rnd.choice([3, 4, 5, 5]))
    for k in range(9):
        c.put_ramp(2 + k * 2 + (f % 2), 33 + (k % 2), 'ice', 5)
        if k % 2 == 0:
            c.put_ramp(3 + k * 2, 32 - (f + k) % 3, 'ice', 4)
    ellipse(c, 9, 29 + bob, 4.6, 3.4, 'fur', lo=1, hi=3)
    ellipse(c, 15, 31 + bob, 4.8, 3.2, 'fur', lo=2, hi=4)
    for (x, y) in [(6, 28), (8, 27), (10, 28)]:
        c.put_ramp(x, y + bob, 'skin', 2)
    c.put_ramp(8, 30 + bob, 'skin', 3)
    ellipse(c, 25, 24 + bob, 16, 8.6, 'fur', lo=1, hi=5, ambient=0.12)
    for _ in range(18):
        x = rnd.randint(10, 36)
        y = rnd.randint(18, 28)
        if c.alpha(x, y + bob):
            i = rnd.choice([2, 3])
            c.put_ramp(x, y + bob, 'fur', i)
            c.put_ramp(x + 1, y + 1 + bob, 'fur', i)
    for x in range(12, 38):
        yy = int(16.4 + bob + 0.012 * (x - 25) ** 2)
        c.put_ramp(x, yy + 1, 'fur', 5)
    # Schal
    for k in range(14):
        x = 35 - k
        y = 18 - k // 3 + (1 if (k + f) % 3 == 0 else 0) + wav
        c.put_ramp(x, y + bob, 'teamA', 4)
        c.put_ramp(x, y + 1 + bob, 'teamA', 3)
        c.put_ramp(x, y + 2 + bob, 'teamA', 2)
    ellipse(c, 36, 21 + bob, 3.6, 3.8, 'teamA', lo=2, hi=5)
    thick_line(c, 33, 28 + bob, 47 + reach, 31 + bob, 5.4, 'fur', lo=1, hi=4)
    thick_line(c, 34, 25 + bob, 49 + reach, 27 + bob, 5.4, 'fur', lo=2, hi=5)
    for (x, y) in [(52 + reach, 26), (53 + reach, 27), (52 + reach, 28)]:
        c.put_ramp(x, y + bob, 'bone', 5)
    for (x, y) in [(50 + reach, 31), (51 + reach, 32)]:
        c.put_ramp(x, y + bob, 'bone', 4)
    # Kopf (Gesicht: Brille mit Punkt, Nase, kurzer Mund)
    ellipse(c, 41, 18 + bob, 9.0, 8.0, 'fur', lo=2, hi=5, ambient=0.2)
    ellipse(c, 48.5, 22 + bob, 4.6, 3.4, 'fur', lo=4, hi=5)
    c.rect(51, 20 + bob, 52, 21 + bob, 'coal', 1)
    for x in range(48, 51):
        c.put_ramp(x, 24 + bob, 'coal', 2)
    ellipse(c, 35.5, 10.5 + bob, 3.2, 3.2, 'fur', lo=2, hi=4)
    ellipse(c, 44.5, 9.5 + bob, 3.2, 3.2, 'fur', lo=3, hi=5)
    c.put_ramp(35, 10 + bob, 'skin', 3)
    c.put_ramp(44, 9 + bob, 'skin', 3)
    c.rect(46, 17 + bob, 47, 18 + bob, 'coal', 1)         # Perlenauge, 2 x 2 (v0.3: keine Schneebrille)
    c.put_ramp(46, 17 + bob, 'bone', 5)
    c.outline()
    return c


# =========================================================================== Bratpfannen-Büttel


def guard(anim='idle', f=0):
    c = Canvas(32, 32)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    push = {0: 0, 1: 3, 2: 1}[f % 3] if anim == 'attack' else 0
    thick_line(c, 13, 24 + bob, 12, 29, 3.5, 'metal', lo=1, hi=3)
    thick_line(c, 18, 24 + bob, 19, 29, 3.5, 'metal', lo=2, hi=4)
    for x in range(10, 15):
        c.put_ramp(x, 30, 'wood', 2)
        c.put_ramp(x, 31, 'wood', 1)
    for x in range(17, 23):
        c.put_ramp(x, 30, 'wood', 3)
        c.put_ramp(x, 31, 'wood', 1)
    round_rect(c, 10, 14 + bob, 21, 25 + bob, 'teamA', lo=1, hi=4, radius=2)
    for x in range(10, 22):
        c.put_ramp(x, 22 + bob, 'gold', 2 if x % 2 else 1)
    c.put_ramp(15, 22 + bob, 'gold', 5)
    c.put_ramp(16, 22 + bob, 'gold', 5)
    ellipse(c, 10.5, 15.5 + bob, 3.4, 2.8, 'metal', lo=1, hi=4)
    ellipse(c, 21.5, 15.5 + bob, 3.4, 2.8, 'metal', lo=2, hi=5)
    thick_line(c, 10, 17 + bob, 7, 23 + bob, 2.5, 'metal', lo=1, hi=3)
    thick_line(c, 7, 23 + bob, 4, 18 + bob, 1.5, 'wood', lo=2, hi=4)
    poly(c, [(2, 14 + bob), (5, 14 + bob), (6, 19 + bob), (3, 19 + bob)], 'metal', lo=2, hi=5)
    # Kopf: ein Auge, Schnurrbart als Block
    ellipse(c, 15, 10.5 + bob, 5.4, 4.9, 'skin', lo=2, hi=5)
    c.rect(13, 13 + bob, 19, 14 + bob, 'coal', 2)
    c.put_ramp(18, 13 + bob, 'coal', 3)
    c.put_ramp(19, 13 + bob, 'coal', 3)
    c.rect(18, 9 + bob, 18, 10 + bob, 'coal', 1)
    def cap(x, y):
        return y <= 8 + bob
    ellipse(c, 15, 7.5 + bob, 6.8, 5.8, 'metal', lo=1, hi=5, clip=cap)
    for x in range(8, 23):
        c.put_ramp(x, 8 + bob, 'metal', 1 if x % 2 else 2)
    for y in range(1, 4):
        c.put_ramp(15, y + bob, 'teamA', 3)
        c.put_ramp(16, y + bob, 'teamA', 2)
    c.put_ramp(14, 2 + bob, 'teamA', 4)
    # Pfanne
    px_, py_ = 23 + push, 22 + bob
    thick_line(c, px_ - 5, py_ + 7, px_ - 9, py_ + 8, 3.0, 'wood', lo=1, hi=4)
    ellipse(c, px_ + 1, py_, 7.4, 8.0, 'coal', lo=0, hi=3)
    ellipse(c, px_ + 1, py_, 6.4, 7.0, 'metal', lo=1, hi=3, ambient=0.3, flatness=0.2)
    ellipse(c, px_ + 1.5, py_ + 0.5, 4.8, 5.4, 'coal', lo=2, hi=3, ambient=0.25)
    ellipse(c, px_ + 1, py_ + 1, 3.8, 3.4, 'bone', lo=3, hi=5)
    ellipse(c, px_ + 2.3, py_ + 0.6, 2.0, 2.0, 'gold', lo=3, hi=5)
    c.put_ramp(px_ + 2, py_ - 0.5, 'gold', 5)
    if anim == 'attack' and f == 1:
        for k in range(4):
            c.put_ramp(px_ + 9 + k, py_ - 4 + k * 3, 'bone', 5)
            c.put_ramp(px_ + 10 + k, py_ - 3 + k * 3, 'bone', 4)
    c.outline()
    return c


# =========================================================================== Kräuterhexe (40x36)


def witch(anim='stir', f=0):
    c = Canvas(40, 36)
    cx, cy = 29, 24
    for wx in (23, 35):
        ellipse(c, wx, 32, 3.6, 3.6, 'wood', lo=1, hi=4)
        c.put_ramp(wx, 32, 'metal', 4)
        c.put_ramp(wx - 3, 32, 'wood', 1)
        c.put_ramp(wx + 3, 32, 'wood', 1)
    ellipse(c, cx, cy + 1, 9.2, 8.2, 'coal', lo=1, hi=4, ambient=0.25)
    ellipse(c, cx, cy - 5.5, 9.4, 3.4, 'metal', lo=1, hi=4)
    ellipse(c, cx, cy - 5.2, 7.4, 2.4, 'slime', lo=2, hi=5)
    rnd = random.Random(10 + f)
    for _ in range(3):
        bx = cx + rnd.randint(-5, 5)
        c.put_ramp(bx, cy - 6 + rnd.randint(-1, 1), 'slime', 5)
    for k in range(3):
        sx = cx - 6 + k * 5 + (1 if (f + k) % 2 else 0)
        sy = cy - 10 - ((f * 2 + k * 3) % 9)
        for (dx, dy, i) in [(0, 0, 5), (1, 0, 5), (2, 0, 4), (-1, 1, 4), (0, 1, 5), (1, 1, 5), (2, 1, 5), (3, 1, 4), (0, 2, 4), (1, 2, 4), (2, 2, 4)]:
            if (dx + dy + k) % 3 != 0 or dy == 1:
                c.put_ramp(sx + dx, sy + dy, 'bone', i)
    bob = [0, -1, 0, -1][f % 4] if anim == 'stir' else 0
    poly(c, [(8, 15 + bob), (17, 15 + bob), (20, 31), (4, 31)], 'purple', lo=1, hi=4)
    for x in range(4, 21):
        c.put_ramp(x, 31, 'purple', 1)
    poly(c, [(9, 19 + bob), (16, 19 + bob), (17, 29), (7, 29)], 'bone', lo=3, hi=5)
    for y in (22, 25, 28):
        for x in range(9, 16):
            if (x + y) % 3 == 0:
                c.put_ramp(x, y + bob, 'bone', 2)
    c.rect(8, 17 + bob, 16, 17 + bob, 'gold', 3)
    ang = f % 4
    hand = [(19, 20), (21, 19), (22, 21), (20, 22)][ang]
    thick_line(c, 15, 18 + bob, hand[0], hand[1] + bob, 2.4, 'purple', lo=2, hi=4)
    tipx = cx - 1 + [-2, 0, 2, 0][ang]
    thick_line(c, hand[0], hand[1] + bob, tipx, cy - 5, 1.4, 'metal', lo=2, hi=4)
    c.put_ramp(hand[0], hand[1] + bob, 'skin', 4)
    # Kopf: Nase als Silhouette, ein Auge
    ellipse(c, 12.5, 11 + bob, 4.2, 3.9, 'skin', lo=2, hi=5)
    poly(c, [(15, 11 + bob), (17.5, 12.5 + bob), (15, 13.5 + bob)], 'skin', lo=3, hi=5)
    c.put_ramp(14, 10 + bob, 'coal', 1)
    for y in range(11, 17):
        c.put_ramp(8, y + bob, 'bone', 3)
        c.put_ramp(9, y + bob, 'bone', 4 if y % 2 else 3)
    ellipse(c, 12, 8 + bob, 9, 2.4, 'purple', lo=1, hi=4)
    poly(c, [(8, 8 + bob), (16, 8 + bob), (14, 2 + bob), (18, -1 + bob), (13, 0 + bob), (10, 3 + bob)], 'purple', lo=1, hi=4)
    for x in range(8, 16):
        c.put_ramp(x, 6 + bob, 'gold', 2)
    c.put_ramp(11, 6 + bob, 'gold', 5)
    c.put_ramp(12, 6 + bob, 'gold', 4)
    c.outline()
    return c


# =========================================================================== Rumpel-Katapult (48x44)


def catapult(anim='load', f=0):
    c = Canvas(48, 44)
    for y in (33, 34, 35):
        for x in range(4, 44):
            c.put_ramp(x, y, 'wood', {33: 4, 34: 3, 35: 2}[y])
    for x in range(4, 44):
        c.put_ramp(x, 36, 'wood', 1)
    for wx in (10, 37):
        ellipse(c, wx, 36, 6.2, 6.2, 'wood', lo=1, hi=4)
        ellipse(c, wx, 36, 3.6, 3.6, 'wood', lo=0, hi=2)
        for ang in range(0, 360, 60):
            a = math.radians(ang + 30)
            c.put_ramp(wx + int(round(math.cos(a) * 5)), 36 + int(round(math.sin(a) * 5)), 'wood', 1)
            c.put_ramp(wx + int(round(math.cos(a) * 3)), 36 + int(round(math.sin(a) * 3)), 'wood', 4)
        ellipse(c, wx, 36, 1.8, 1.8, 'metal', lo=2, hi=5)
    round_rect(c, 13, 22, 33, 34, 'wood', lo=1, hi=4, radius=2)
    for y in (26, 30):
        for x in range(14, 33):
            c.put_ramp(x, y, 'wood', 1)
    # Gesicht: zwei Augen mit Punkt, ein Mund
    for (ex, ey) in ((19, 27), (27, 27)):
        ellipse(c, ex, ey, 2.6, 2.6, 'bone', lo=3, hi=5)
        c.put_ramp(ex + 1, ey, 'coal', 1)
    for x in range(19, 28):
        c.put_ramp(x, 32, 'coal', 1)
    thick_line(c, 15, 22, 22, 13, 3.2, 'wood', lo=1, hi=4)
    thick_line(c, 31, 22, 24, 13, 3.2, 'wood', lo=1, hi=4)
    thick_line(c, 18, 20, 28, 20, 2, 'wood', lo=1, hi=3)
    ellipse(c, 23, 13, 2.8, 2.8, 'metal', lo=1, hi=5)
    arm = {'load': (7, 24), 'wind': (14, 4), 'fire': (36, 5), 'recover': (35, 17)}
    key = 'load'
    if anim == 'fire':
        key = ['wind', 'fire', 'recover'][f % 3]
    tipx, tipy = arm[key]
    thick_line(c, 23, 13, tipx, tipy, 3.2, 'wood', lo=1, hi=4)
    ellipse(c, tipx, tipy, 4.4, 3.0, 'wood', lo=0, hi=3)
    if key in ('load', 'wind'):
        ellipse(c, tipx, tipy - 2, 3.6, 3.4, 'stone', lo=1, hi=5)
    for k in range(10):
        c.put_ramp(30 + k, 21 + (k // 4), 'dirt', 4 if k % 2 else 3)
    thick_line(c, 31, 22, 31, 14, 1.2, 'wood', lo=2, hi=3)
    for k in range(6):
        c.put_ramp(32 + k, 14 + k // 3, 'teamA', 3)
        c.put_ramp(32 + k, 15 + k // 3, 'teamA', 2)
    c.outline()
    return c


# =========================================================================== Kürbis-Bomber (Kopf im Dreiviertelprofil)


def pumpkin(anim='run', f=0):
    c = Canvas(32, 32)
    stride = [3, 0, -3, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    thick_line(c, 13, 25 + bob, 12 - stride, 29, 3, 'wood', lo=1, hi=3)
    thick_line(c, 18, 25 + bob, 18 + stride, 29, 3, 'wood', lo=2, hi=4)
    for x in range(9 - stride, 15 - stride):
        c.put_ramp(x, 30, 'wood', 2)
    for x in range(17 + stride, 23 + stride):
        c.put_ramp(x, 30, 'wood', 3)
    round_rect(c, 11, 20 + bob, 20, 27 + bob, 'cloth', lo=1, hi=4, radius=2)
    for x in range(11, 21):
        c.put_ramp(x, 24 + bob, 'goblin', 2 if x % 2 else 1)
    thick_line(c, 11, 22 + bob, 8, 26 + bob + (1 if stride > 0 else 0), 2.2, 'goblin', lo=1, hi=3)
    thick_line(c, 20, 22 + bob, 24, 26 + bob + (1 if stride < 0 else 0), 2.2, 'goblin', lo=2, hi=5)
    # Kürbis: Kugel, leicht nach vorn gekippt (1 px tiefer und weiter rechts)
    cx, cy, rx, ry = 17.0, 13.0 + bob, 10.0, 8.6
    ellipse(c, cx, cy, rx, ry, 'fire', lo=1, hi=5)
    yaw = math.radians(32)                               # Blickrichtung: nach rechts vorn
    # Rippen als Meridiane einer Kugel, die um 32° nach rechts gedreht ist
    for a_deg in (-84, -50, -16, 18, 52):
        a = math.radians(a_deg) + yaw
        if math.cos(a) <= 0.05:
            continue
        for y in range(int(cy - ry) + 1, int(cy + ry)):
            dy = (y + 0.5 - cy) / ry
            if abs(dy) >= 1:
                continue
            span = math.sqrt(1 - dy * dy) * rx
            x = int(round(cx + math.sin(a) * span))
            c.put_ramp(x, y, 'fire', 1)
    # Gesicht auf der Vorderseite: bewegt sich mit der Drehung nach rechts, rechte Seite schmaler (Verkürzung)
    def pos(a_deg, dy_):
        a = math.radians(a_deg) + yaw
        dy = dy_ / ry
        span = math.sqrt(max(0.0, 1 - dy * dy)) * rx
        return cx + math.sin(a) * span, math.cos(a)
    ex1, w1 = pos(-26, -2.2)         # linkes (fernes) Auge
    ex2, w2 = pos(22, -2.2)          # rechtes (nahes) Auge, nah am Rand
    for (ex, w) in ((ex1, w1), (ex2, w2)):
        half = max(1, int(round(2.4 * w)))
        ey = int(round(cy - 2.4))
        poly(c, [(ex - half, ey + 3), (ex + half + 1, ey + 3), (ex + 0.5, ey - 1)], 'gold', flat=5)
    nx, nw = pos(0, 1.6)
    c.rect(int(round(nx)), int(round(cy + 1.6)), int(round(nx)) + 1, int(round(cy + 2.8)), 'gold', 4)
    # Mund: Zickzack, folgt der Rundung (rechts höher)
    for k in range(-5, 6):
        a_deg = k * 9.0
        mx, mw = pos(a_deg, 4.4 - 0.12 * max(0, k))
        if mw <= 0.12:
            continue
        my = int(round(cy + 4.4 - 0.12 * max(0, k))) + (1 if k % 2 == 0 else 0)
        c.put_ramp(int(round(mx)), my, 'gold', 5 if k % 2 == 0 else 4)
    # Stiel nach vorn geneigt + Blatt
    thick_line(c, 15.5, int(cy - ry) + 1, 19.5, int(cy - ry) - 2, 3, 'leaf', lo=2, hi=4)
    for (x, y) in [(22, int(cy - ry) - 2), (23, int(cy - ry) - 3), (21, int(cy - ry) - 3)]:
        c.put_ramp(x, y, 'leaf', 4)
    # Lunte + Funke
    for k, (x, y) in enumerate([(20, -1), (21, -2), (22, -2), (23, -1)]):
        c.put_ramp(x, y + 1 + bob + 1, 'dirt', 3)
    spark = [(24, 0), (25, -1), (24, -1)][f % 3]
    c.put_ramp(spark[0], max(0, spark[1] + 1 + bob), 'gold', 5)
    c.put_ramp(spark[0] + 1, max(0, spark[1] + 1 + bob), 'fire', 4)
    c.outline()
    return c


# =========================================================================== Bau-Gnom


def builder(anim='work', f=0):
    c = Canvas(32, 32)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    hit = [0, -2, 1][f % 3] if anim == 'work' else 0
    thick_line(c, 13, 25 + bob, 12, 29, 3.2, 'ice', lo=1, hi=3)
    thick_line(c, 18, 25 + bob, 19, 29, 3.2, 'ice', lo=2, hi=4)
    for x in range(9, 15):
        c.put_ramp(x, 30, 'wood', 2)
        c.put_ramp(x, 31, 'wood', 1)
    for x in range(17, 23):
        c.put_ramp(x, 30, 'wood', 3)
        c.put_ramp(x, 31, 'wood', 1)
    round_rect(c, 10, 17 + bob, 21, 26 + bob, 'ice', lo=1, hi=4, radius=2)
    c.rect(10, 17 + bob, 21, 19 + bob, 'bone', 3)
    for x in (12, 19):
        for y in range(17, 22):
            c.put_ramp(x, y + bob, 'teamA', 3)
    c.put_ramp(12, 21 + bob, 'gold', 5)
    c.put_ramp(19, 21 + bob, 'gold', 5)
    thick_line(c, 10, 19 + bob, 7, 23 + bob, 2.4, 'skin', lo=1, hi=4)
    c.rect(5, 22 + bob, 8, 25 + bob, 'stone', 3)
    c.rect(5, 22 + bob, 8, 22 + bob, 'stone', 4)
    c.rect(5, 25 + bob, 8, 25 + bob, 'stone', 2)
    hx, hy = 21, 20 + bob + hit
    thick_line(c, 20, 19 + bob, hx + 1, hy, 2.4, 'skin', lo=2, hi=5)
    thick_line(c, hx + 1, hy, hx + 5, hy - 5 - (1 if hit < 0 else 0), 1.6, 'wood', lo=2, hi=4)
    poly(c, [(hx + 4, hy - 7 + (hit < 0)), (hx + 9, hy - 8 + (hit < 0)), (hx + 6, hy - 3 + (hit < 0))], 'metal', lo=2, hi=5)
    poly(c, [(11, 13 + bob), (21, 13 + bob), (24, 18 + bob), (16, 25 + bob), (8, 18 + bob)], 'bone', lo=3, hi=5)
    for (x, y) in [(12, 18), (14, 20), (16, 22), (18, 19), (20, 17), (15, 17), (17, 24)]:
        c.put_ramp(x, y + bob, 'bone', 2)
    # Kopf: Nase als roter Knubbel, ein Auge
    ellipse(c, 16, 10 + bob, 5.2, 4.6, 'skin', lo=2, hi=5)
    c.rect(18, 8 + bob, 18, 9 + bob, 'coal', 1)
    ellipse(c, 21.2, 11 + bob, 1.7, 1.5, 'skin', lo=3, hi=5)
    c.put_ramp(21, 11 + bob, 'fire', 4)
    poly(c, [(10, 8 + bob), (22, 8 + bob), (19, 0 + bob), (24, -2 + bob), (14, 1 + bob)], 'teamA', lo=1, hi=4)
    for x in range(10, 23):
        c.put_ramp(x, 8 + bob, 'teamA', 1)
        c.put_ramp(x, 7 + bob, 'teamA', 4 if x < 16 else 3)
    ellipse(c, 24, 0 + bob, 1.8, 1.8, 'gold', lo=3, hi=5)
    c.outline()
    return c


# =========================================================================== Bürger (Standard-Zivilisten, Größe S)


def citizen(kind='cloth', f=0):
    c = Canvas(16, 20)
    bob = [0, -1][f % 2]
    thick_line(c, 6, 15 + bob, 6, 18, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 10, 15 + bob, 10, 18, 2.2, 'wood', lo=2, hi=4)
    round_rect(c, 4, 9 + bob, 11, 16 + bob, kind, lo=1, hi=4, radius=2)
    c.rect(4, 13 + bob, 11, 13 + bob, 'gold', 2)
    thick_line(c, 4, 10 + bob, 2, 14 + bob, 1.8, 'skin', lo=2, hi=4)
    thick_line(c, 11, 10 + bob, 13, 14 + bob, 1.8, 'skin', lo=3, hi=5)
    ellipse(c, 8, 6 + bob, 3.8, 3.5, 'skin', lo=2, hi=5)
    c.put_ramp(10, 6 + bob, 'coal', 1)
    for x in range(5, 12):
        c.put_ramp(x, 3 + bob, 'wood', 2 if x > 7 else 1)
    c.put_ramp(6, 2 + bob, 'wood', 3)
    c.put_ramp(7, 2 + bob, 'wood', 3)
    c.outline()
    return c


def rank_badge(rank=2):
    """Rangabzeichen: goldene Winkel (R1..R5)"""
    h = 3 * rank + 2
    c = Canvas(9, h)
    for i in range(rank):
        y = 1 + i * 3
        for k in range(4):
            c.put_ramp(1 + k, y + k // 2, 'gold', 5 if k < 2 else 4)
            c.put_ramp(7 - k, y + k // 2, 'gold', 5 if k < 2 else 4)
        c.put_ramp(4, y + 2, 'gold', 4)
        c.put_ramp(3, y + 2, 'gold', 3)
        c.put_ramp(5, y + 2, 'gold', 3)
    c.outline()
    return c


UNITS = {
    'US-01 Topfhelm-Skelett': (skeleton, {'idle': 2, 'walk': 4, 'attack': 3}),
    'US-02 Beute-Goblin': (goblin, {'idle': 2, 'walk': 4, 'attack': 3}),
    'US-06 Rutsch-Bär': (bear, {'slide': 3}),
    'UV-01 Bratpfannen-Büttel': (guard, {'idle': 2, 'attack': 3}),
    'UZ-01 Kräuterhexe': (witch, {'stir': 4}),
    'UA-01 Rumpel-Katapult': (catapult, {'load': 1, 'fire': 3}),
    'US-03 Kürbis-Bomber': (pumpkin, {'run': 4}),
    'UZ-02 Bau-Gnom': (builder, {'idle': 2, 'work': 3}),
}
