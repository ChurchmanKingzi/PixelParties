# -*- coding: utf-8 -*-
"""Idle-Animation für Natas, the Master of Hell (Teile deckungsgleich in src/natas-the-master-of-hell-*.png).

Aufruf: python3 natas.py <tag> [ms]

Teile: body (Anzug mit blauer Krawatte), arms (links die Hand vor dem Bauch, rechts der ausgestreckte Arm),
head (Kopf mit Hut, rotem Auge und Monokel), glint (das weiße Glanzkreuz auf dem Monokel), aura (der rote
Höllenschatten, im xcf zu 10 % deckend).

Frame 0 ist die Ruhepose. Er ist ständig in Bewegung: zweimal je Loop verbeugt er sich elegant (die zweite
etwas knapper): Kopf samt Haartolle neigt sich, die
Schultern gehen mit (die Zeilen rücken zusammen – nichts wird gedehnt), die Hand bleibt auf dem Bauch, der
ausgestreckte Arm schwingt einladend nach unten; in der tiefsten Verbeugung schließt er die Augen. Dann
richtet er sich wieder auf, und das Monokel blitzt (dazu zwischendurch kurze Funken). Die Haartolle wippt
ständig und federt beim Verbeugen nach; zwischen den Verbeugungen macht die ausgestreckte Hand eine kleine
Geste, und er blinzelt. Der rote Schatten liegt mit 8–14 % darüber und flackert.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs

N = 48
OUT = os.environ.get('NA_OUT', '.')
SLUG = 'natas-the-master-of-hell'
PL, PR, PT, PB = 2, 2, 2, 1


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


BODY, ARMS, HEAD, GLINT, AURA = (load(p) for p in ('body', 'arms', 'head', 'glint', 'aura'))
SH, SW = BODY.shape[:2]
H, W = SH + PT + PB, SW + PL + PR
WAIST = 17                                  # ab hier (Beine) bleibt alles stehen
SHOULDER = 10                               # oberste Zeile des Rumpfs
ARM_ROOT = 11                               # Spalte, an der der ausgestreckte Arm ansetzt
EYE = [(4, 9), (5, 9), (4, 10), (5, 10)]
BLINK = {'halb': [((4, 9), '311800'), ((5, 9), '311800')],
         'zu': [((4, 9), 'f5ce88'), ((5, 9), 'f5ce88'), ((4, 10), '311800'), ((5, 10), '311800')]}
GLINT_C = (9, 9)                            # Mitte des Glanzkreuzes auf dem Monokel
HAIR_ROW = 5                                # die graue Haartolle reicht bis Zeile 5
GLINT_AT = {18: 1, 19: 2, 20: 3, 21: 2, 22: 1, 42: 1, 43: 2, 44: 3, 45: 2, 46: 1,   # nach jeder Verbeugung
            31: 1, 32: 2, 33: 1, 7: 1}                       # und zwischendurch kurz


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


DEPTH = (1.0, 0.75)                         # zwei Verbeugungen je Loop, die zweite etwas knapper


def bow(i):
    """Tiefe der Verbeugung 0..1 im 24er-Takt: hinab, halten, wieder auf, kurz Luft holen."""
    j, k = i % 24, (i // 24) % 2
    if j < 2:
        u = 0.0
    elif j < 8:
        u = ease((j - 1) / 6)
    elif j < 12:
        u = 1.0
    elif j < 18:
        u = ease((18 - j) / 6)
    else:
        u = 0.0
    return u * DEPTH[k]


def hair_lag(i):
    """Die Haare federn nach: kommt der Kopf unten an oder hebt er sich wieder, hängen sie 1 px tiefer."""
    return 1 if (i % 24) in (8, 9, 12, 13, 14) else 0


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def frame(i):
    d = bow(i)
    sh = 2 * d                                                   # Schultern sinken bis 2 px
    hd = round(3 * d)                                            # Kopf neigt sich bis 3 px
    rs = lambda y: 0 if y >= WAIST else round(sh * (WAIST - y) / (WAIST - SHOULDER))   # Rumpf: zur Taille hin 0
    head = HEAD.copy()
    st = 'zu' if d > 0.7 else ('halb' if d > 0.4 else {20: 'halb', 21: 'zu', 22: 'halb'}.get(i))
    if st:
        for (x, y), c in BLINK[st]:
            head[y, x] = rgb(c)
    out = np.zeros((H, W, 4), int)
    for y in range(SH):                                          # Anzug: Zeilen rücken zusammen
        for x in range(SW):
            if BODY[y, x, 3]:
                dot(out, x + PL, y + PT + rs(min(max(y, SHOULDER), SH)), BODY[y, x])
    for y, x in zip(*np.nonzero(ARMS[:, :, 3])):                 # Arme
        dy = rs(max(y, SHOULDER))
        if x >= ARM_ROOT:                                        # ausgestreckter Arm schwingt nach unten …
            u = (x - ARM_ROOT) / (SW - 1 - ARM_ROOT)
            dy += round(1.6 * d * u)
            if d == 0:                                           # … und vollführt dazwischen eine kleine Geste
                dy += round(0.9 * u * math.sin(2 * math.pi * (i % 24) / 6))
        dot(out, x + PL, y + PT + dy, ARMS[y, x])
    t = 2 * math.pi * i / N
    lag = hair_lag(i) if d > 0 else 0
    for y, x in zip(*np.nonzero(head[:, :, 3])):                 # Kopf neigt sich, die Haartolle wippt
        dx = dy = 0
        if y <= HAIR_ROW:
            w = (HAIR_ROW + 1 - y) / (HAIR_ROW + 1)              # oben am stärksten
            dx = round(0.9 * w * math.sin(4 * t + 0.6 * y))
            dy = lag if y <= HAIR_ROW - 2 else 0
        dot(out, x + PL + dx, y + PT + hd + dy, head[y, x])
    al = 0.11 + 0.03 * math.sin(2 * math.pi * 3 * i / N) + 0.02 * math.sin(2 * math.pi * 7 * i / N + 1.3)
    for y, x in zip(*np.nonzero(AURA[:, :, 3])):                 # roter Höllenschatten flackert
        dy = hd if y < SHOULDER else rs(y)
        yy, xx = y + PT + dy, x + PL
        if not (0 <= yy < H and 0 <= xx < W):
            continue
        c = AURA[y, x]
        if out[yy, xx, 3]:
            out[yy, xx, :3] = [int(c[k] * al + out[yy, xx, k] * (1 - al)) for k in range(3)]
        else:
            out[yy, xx] = [c[0], c[1], c[2], int(255 * al)]
    g = GLINT_AT.get(i)                                          # das Monokel blitzt
    if g:
        cx, cy = GLINT_C[0] + PL, GLINT_C[1] + PT + hd
        if g == 3:
            for y, x in zip(*np.nonzero(GLINT[:, :, 3])):
                dot(out, x + PL, y + PT + hd, GLINT[y, x])
        else:
            dot(out, cx, cy, rgb('ffffff'))
            if g == 2:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    dot(out, cx + dx, cy + dy, rgb('e8f4ff'))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/natas_idle_{tag}', frames, ms, scale=8, check_edges=True)
