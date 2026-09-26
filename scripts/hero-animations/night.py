# -*- coding: utf-8 -*-
"""Idle-Animation für Night, the Herald of Chess (40x45).

Ein schwerer Golem aus Schachfiguren:
* Schweres Atmen: der Rumpf sackt 1 px ein (ein Texturstreifen der Taille wird
  gestaucht), der Turm-Kopf folgt verzögert und sinkt in den Kragen; Füße fest.
* Die ausgestreckten Arme heben und senken sich langsam (Hände bis 2 px,
  an der Schulter 0 – die Arme bleiben verbunden).
* Die weißen Krallen zucken nacheinander (Finger für Finger).
* Die blauen Augen glühen pulsierend auf.
* Ein Marmorschimmer wandert über die weißen Zinnen und Krallen.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, sweep_level, save_outputs

SRC = np.array(Image.open('src/night-the-herald-of-chess.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48

WHITES = [rgb('999999'), rgb('b3b3b3'), rgb('cccccc'), rgb('e6e6e6'), rgb('ffffff')]
WHITE_SET = set(WHITES)
EYE = [rgb('006bb0'), rgb('1a8ee0'), rgb('4db8ff'), rgb('a8e4ff')]
EYE_HALO = rgb('c8e8ff')
EYES = [(18, 10), (21, 10)]


# ---------------------------------------------------------------- Zonen
def is_head(x, y):
    if 16 <= x <= 23 and 5 <= y <= 12:
        return True
    return 13 <= y <= 14 and x in (16, 19, 20, 23)       # Hals hinter den Zinnen


def is_arm(x, y):
    return 18 <= y <= 25 and (x <= 12 or x >= 27)


def is_claw(x, y):
    return is_arm(x, y) and px(SRC, x, y) in WHITE_SET


# ---------------------------------------------------------------- Timing
def sink(i):
    """Rumpf sackt schwer ein (zwei Atemzüge pro Loop)."""
    return 1 if 10 <= i % 24 < 19 else 0


def head_dy(i):
    """Kopf folgt verzögert (bleibt beim Hochkommen länger unten, nie Lücke)."""
    return max(sink(i), sink(i - 2))


def arm_lift(x, i):
    full = int(round(1 + wave(i, N, 0.0)))                # 0..2
    reach = (12 - x) / 6 if x <= 12 else (x - 27) / 6
    return int(round(full * min(1.0, max(0.0, reach))))


# Krallen-Finger (Seite, Zeilen, Startframe des Zuckens)
FINGERS = [('L', (18, 20), 12), ('L', (19, 21), 13), ('L', (22, 23), 14), ('L', (24, 25), 15),
           ('R', (18, 20), 36), ('R', (19, 21), 37), ('R', (22, 23), 38), ('R', (24, 25), 39)]


def claw_shift(x, y, i):
    """Zucken: Finger ziehen sich 1 px zur Handfläche, der Daumen knickt ein."""
    side = 'L' if x < 20 else 'R'
    thumb = (6 <= x <= 7) or (32 <= x <= 33)
    for s, (y0, y1), start in FINGERS:
        if s != side or not y0 <= y <= y1:
            continue
        t = (i - start) % N
        if not t < 3:
            continue
        if thumb and (y0, y1) == (18, 20):
            return 0, 1
        if not thumb and (y0, y1) != (18, 20):
            return (1 if side == 'L' else -1), 0
    return 0, 0


def eye_level(i):
    return max(0, min(3, int(round(1.5 + 1.8 * wave(i, 24, -1.2)))))


def frame(i):
    s = SRC.copy()
    # Marmorschimmer über alles Weiße (einmal pro Loop)
    for y in range(H):
        for x in range(W):
            c = px(SRC, x, y)
            if c in WHITE_SET:
                lv = sweep_level(x, y, i, N, speed=1.9, slope=0.5, offset=-6)
                if lv:
                    s[y, x] = WHITES[min(4, WHITES.index(c) + lv)]
    lv = eye_level(i)
    for x, y in EYES:
        s[y, x] = EYE[lv]
        if lv == 3:
            for hx in (x - 1, x + 1):
                if px(SRC, hx, y) in WHITE_SET:
                    s[y, hx] = EYE_HALO
    out = np.zeros_like(s)
    b = sink(i)
    # Kopf zuerst (liegt hinter Kragen und Zinnen)
    hd = head_dy(i)
    for y in range(H):
        for x in range(W):
            if s[y, x, 3] and is_head(x, y):
                out[y + hd, x] = s[y, x]
    # Rumpf: bis Zeile 27 sackt er ein (Zeile 27 entfällt), darunter fest
    for y in range(H):
        for x in range(W):
            sy = y - b if y <= 27 else y
            if 0 <= sy < H and s[sy, x, 3] and not is_head(x, sy) and not is_arm(x, sy):
                out[y, x] = s[sy, x]
    # Arme (erst Arm, dann Krallen darüber)
    for claws in (False, True):
        for y in range(18, 26):
            for x in range(W):
                if not s[y, x, 3] or not is_arm(x, y) or is_claw(x, y) != claws:
                    continue
                dx, dy = claw_shift(x, y, i) if claws else (0, 0)
                ty, tx = y + b - arm_lift(x, i) + dy, x + dx
                if 0 <= tx < W and 0 <= ty < H:
                    out[ty, tx] = s[y, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'night_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8)
