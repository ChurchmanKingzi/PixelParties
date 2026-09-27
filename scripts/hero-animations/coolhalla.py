# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveCoolhalla-Heroes und den Skin Shrunken
Prodigy Peter Röll.

Aufruf: python3 coolhalla.py <tag> [ms] <freshya|thorad|cooldin|lolki|peter|prodigy>

Alle federn in den Knien (die Füße bleiben stehen) und blinzeln zweimal pro
Loop: das Lid senkt sich, geschlossen ist das Auge ein 2 px breiter schwarzer
Strich. Dazu:
* freshya:  ihr Zopf weht nach außen (unten stärker, die Innenkante wird
            nachgezogen – keine Lücke zum Körper).
* thorad:   die Glut seiner Zigarette glimmt auf und ab, Rauch steigt in
            kleinen, halbtransparenten Wölkchen schräg nach oben und vergeht.
* cooldin:  er rollt auf dem Skateboard sachte vor und zurück (Brett und
            Figur gemeinsam), die Räder drehen sich dabei; die Krone blitzt.
* lolki:    sein roter Umhang weht nach außen (unten stärker, der Saum bleibt
            der untere Rand); die Krone blitzt.
* peter / prodigy: ein Lichtreflex läuft einmal pro Loop die Klinge hinab.
  Beim Skin blinzelt er hinter den Brillengläsern (die Gläser dunkeln ab).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
from flap_common import fill_pinholes

BLACK = (0, 0, 0, 255)
VARIANTS = {
    'freshya': dict(slug='freshya-beauty-of-coolness', knee=21,
                    lid=[((5, 9), '5a2000'), ((10, 9), '5a2000')],
                    line=[(5, 9), (6, 9), (9, 9), (10, 9)],
                    cape=dict(side=1, rows=(20, 23), x=lambda y: 12, amp=1.8)),
    'thorad': dict(slug='thorad-strength-of-coolness', knee=23, pr=4,
                   lid=[((9, 9), 'f6cd8b'), ((13, 9), 'f6cd8b')],
                   line=[(8, 10), (9, 10), (12, 10), (13, 10)]),
    'cooldin': dict(slug='cooldin-king-of-coolness', knee=26,
                    lid=[((14, 14), '22283e')],
                    line=[(13, 14), (14, 14)], glint=(11, 7, 30)),
    'lolki': dict(slug='lolki-trickstar-of-coolness', knee=27,
                  lid=[((4, 14), 'fac5a3'), ((5, 14), 'fac5a3'), ((8, 14), 'fac5a3'), ((9, 14), 'fac5a3')],
                  line=[(4, 15), (5, 15), (8, 15), (9, 15)],
                  cape=dict(side=1, rows=(19, 30), x=lambda y: 13 if y <= 25 else 12, amp=2.2),
                  glint=(7, 1, 30)),
    'peter': dict(slug='peter-r-ll-the-protagonist', knee=37,
                  lid=[((11, 26), '370000'), ((14, 26), '370000')],
                  line=[(10, 26), (11, 26), (14, 26), (15, 26)], sword=True),
    'prodigy': dict(slug='shrunken-prodigy-peter-r-ll', knee=37,
                    lid=[((11, 26), '24426a'), ((14, 26), '24426a')],
                    line=[], closed=[((11, 25), '112550'), ((11, 26), '112550'), ((14, 25), '112550'), ((14, 26), '112550')],
                    sword=True),
}
V = next((v for v in sys.argv[2:] if v in VARIANTS), 'freshya')
C = VARIANTS[V]
SRC = np.array(Image.open(f"src/{C['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 4, 2
PR = C.get('pr', P)                                  # rechter Rand (Thorads Rauch braucht mehr)
H, W = SH + PT + PB, SW + P + PR
N = 48
KNEE = C['knee']
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
GOLD0, GOLD1 = rgb('ffe60f'), rgb('fff6ac')

# --- Umhang / Zopf (weht nach außen) ---------------------------------------
CAPE = set()
if 'cape' in C:
    cy0, cy1 = C['cape']['rows']
    for y in range(cy0, cy1 + 1):
        for x in range(SW):
            if SRC[y, x, 3] and (x >= C['cape']['x'](y) if C['cape']['side'] > 0 else x <= C['cape']['x'](y)):
                CAPE.add((x, y))


def billow(y, i):
    """Nach unten nie weniger als darüber; Frame 0 = Ruhelage."""
    cy0, cy1 = C['cape']['rows']
    f = min(1.0, (y - cy0) / max(1, cy1 - cy0 - 1))
    ph = 2 * math.pi * i / 24
    amp = C['cape']['amp'] * (0.5 - 0.5 * math.cos(ph)) * (0.85 + 0.15 * math.sin(3 * ph))
    return int(round(amp * f ** 1.2))


# --- Cooldin: rollen, Räder -------------------------------------------------
WHEEL = (rgb('332925'), rgb('49443e'))


def roll(i):
    return int(round(math.sin(2 * math.pi * i / 24))) if V == 'cooldin' else 0


# --- Thorad: Glut und Rauch --------------------------------------------------
EMBER = [(14, 10), (13, 11)]
EMBER_COLS = [rgb('de5c1e'), rgb('f07a2e'), rgb('ffa04a'), rgb('f07a2e')]
SMOKE_PATH = [(15, 9), (16, 8), (17, 7), (18, 6), (19, 5), (20, 4), (21, 3), (22, 2), (23, 1), (23, 0)]
SMOKE_ALPHA = [220, 215, 205, 195, 180, 160, 135, 105, 75, 45]
SMOKE_SIZE = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]          # Wölkchen wachsen beim Aufsteigen

# --- Peter: Lichtreflex auf der Klinge --------------------------------------
BLADE = {(x, y) for y in range(0, 24) for x in range(0, 8)
         if SRC[y, x, 3] and tuple(SRC[y, x, :3]) in {(0x27, 0x27, 0x27), (0x40, 0x40, 0x40), (0x2a, 0x2a, 0x2a)}}


def blend(dst, c, a):
    if not dst[3]:
        return np.array([*c[:3], a])
    f = a / 255
    return np.array([*(np.round(np.array(c[:3]) * f + dst[:3] * (1 - f))).astype(int), 255])


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for (x, y), c in C['lid']:
            s[y, x] = rgb(c)
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
            for (x, y), c in C.get('closed', []):
                s[y, x] = rgb(c)
    if C.get('sword'):                               # Reflex wandert die Klinge hinab
        pos = (i % 24) * 30 / 24 - 3
        for x, y in BLADE:
            d = abs(y - pos)
            if d < 0.8:
                s[y, x] = rgb('9a9a9a')
            elif d < 1.8:
                s[y, x] = rgb('5c5c5c')
    if V == 'thorad':
        for k, (x, y) in enumerate(EMBER):
            s[y, x] = EMBER_COLS[(i // 3 + k) % 4]
    if V == 'cooldin' and roll(i) != roll(i - 1):   # Räder drehen sich beim Rollen
        for y in range(SH):
            for x in range(SW):
                c = tuple(s[y, x])
                if c == WHEEL[0]:
                    s[y, x] = WHEEL[1]
                elif c == WHEEL[1]:
                    s[y, x] = WHEEL[0]
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    rx = roll(i)

    def dy_of(y):
        return b if y < KNEE else 0

    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dx = rx + (C['cape']['side'] * billow(y, i) if (x, y) in CAPE else 0)
            out[y + PT + dy_of(y), x + P + dx] = s[y, x]
    if b < 0:                                        # Zeile über dem Knie dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3]:
                dx = rx + (C['cape']['side'] * billow(y, i) if (x, y) in CAPE else 0)
                if not out[y + PT, x + P + dx, 3]:
                    out[y + PT, x + P + dx] = s[y, x]
    if CAPE:                                         # Innenkante nachziehen
        side = C['cape']['side']
        rows = {}
        for x, y in CAPE:
            rows[y] = min(rows.get(y, x), x) if side > 0 else max(rows.get(y, x), x)
        for y, xin in rows.items():
            d = billow(y, i)
            for k in range(d):
                xx = xin + P + rx + side * k
                yy = y + PT + dy_of(y)
                if not out[yy, xx, 3]:
                    out[yy, xx] = s[y, xin]
    fill_pinholes(out)
    if V == 'thorad':                                # Rauch
        for start in (4, 12, 20, 28, 36, 44):       # Frame 0: nur ein Wölkchen, noch im Sprite
            t = (i - start) % 48
            if t < len(SMOKE_PATH):
                x, y = SMOKE_PATH[t]
                cells = {1: [(0, 0)], 2: [(0, 0), (1, 0), (0, -1)], 3: [(0, 0), (1, 0), (0, -1), (1, -1), (-1, 0)]}[SMOKE_SIZE[t]]
                for k, (ox, oy) in enumerate(cells):
                    xx, yy = x + ox + P + rx, y + oy + PT + b
                    a = SMOKE_ALPHA[t] if k == 0 else SMOKE_ALPHA[t] * 2 // 3
                    out[yy, xx] = blend(out[yy, xx], rgb('eeeeee' if k == 0 else 'd6d6d6'), a)
    if 'glint' in C:
        gx, gy, start = C['glint']
        for (x, y), c in sparkle_pixels(i, N, [(gx + P + rx, gy + PT + b, start)], GOLD0, GOLD1).items():
            assert 1 <= x < W - 1 and 1 <= y < H - 1, 'Glanz ragt an den Rand'
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=8, check_edges=True)
