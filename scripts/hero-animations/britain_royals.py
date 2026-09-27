# -*- coding: utf-8 -*-
"""Idle-Animationen für Willy, George und Victorica samt Skins
(MotiveBritain.xcf).

Aufruf: python3 britain_royals.py <tag> [ms] <willy|george|hatmaker|victorica|empress>

* Alle federn in den Knien (die Füße bleiben stehen) und blinzeln zweimal pro
  Loop: das Lid senkt sich in Hautfarbe, geschlossen ist das Auge ein 2 px
  breiter schwarzer Strich.
* george / victorica: die Capes links und rechts flattern – sie bauschen sich
  nach außen, unten stärker als an der Schulter; der untere Teil samt
  weißem/hellblauem Saum bewegt sich als Ganzes, der Saum bleibt immer der
  Rand (zeilenweise verschoben, die Innenkante wird nachgezogen, damit keine
  Lücke zum Körper entsteht).
* Kronen (George, Victorica, Empress of Hearts) und Willys Hutschnalle
  blitzen einmal pro Loop auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
from flap_common import fill_pinholes

VARIANTS = {
    # slug, Knie, Augen [(x, y_oben, y_unten)] bzw. [(x, y)] einzeilig,
    # Lidfarbe, Cape (Zeile oben, Zeile unten, x links bis, x rechts ab), Glanz (x, y, Start)
    'willy': dict(slug='willy-the-valiant-leprechaun', knee=21, lid='f6bd7b',
                  eyes=[((6, 12), (6, 13)), ((9, 12), (9, 13))], line=[(5, 13), (6, 13), (9, 13), (10, 13)],
                  cape=None, glint=[(8, 6, 30)]),
    'george': dict(slug='george-the-mad-tyrant-king', knee=23, lid='ffd5a4',
                   eyes=[((7, 6), None), ((12, 6), None)], line=[(7, 6), (8, 6), (11, 6), (12, 6)],
                   cape=(17, 23, 4, 15), glint=[(10, 1, 28)]),
    'hatmaker': dict(slug='hatmaker-george', knee=30, lid='ffd5a4',
                     eyes=[((8, 13), (8, 14)), ((9, 13), (9, 14)), ((12, 13), (12, 14)), ((13, 13), (13, 14))],
                     line=[(8, 14), (9, 14), (12, 14), (13, 14)], cape=None, glint=[]),
    'victorica': dict(slug='victorica-the-eternal-empress', knee=33, lid='f6bd7b',
                      eyes=[((8, 17), (8, 18)), ((9, 17), (9, 18)), ((12, 17), (12, 18)), ((13, 17), (13, 18))],
                      line=[(8, 18), (9, 18), (12, 18), (13, 18)], cape=(26, 32, 5, 16), glint=[(10, 1, 28)]),
    'empress': dict(slug='empress-of-hearts-victorica', knee=27, lid='f6bd7b',
                    eyes=[((9, 12), (9, 13)), ((10, 12), (10, 13)), ((13, 12), (13, 13)), ((14, 12), (14, 13))],
                    line=[(9, 13), (10, 13), (13, 13), (14, 13)], cape=None, glint=[(12, 3, 28)]),
}
V = next((v for v in sys.argv[2:] if v in VARIANTS), 'willy')
C = VARIANTS[V]
SRC = np.array(Image.open(f"src/{C['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 4, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = C['knee']
LID, BLACK = rgb(C['lid']), (0, 0, 0, 255)
GOLD0, GOLD1 = rgb('ffe60f'), rgb('fff6ac')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}


def cape_side(x, y):
    """-1 = linkes Cape, 1 = rechtes, 0 = kein Cape."""
    if not C['cape']:
        return 0
    y0, y1, xl, xr = C['cape']
    if not y0 <= y <= y1:
        return 0
    return -1 if x <= xl else (1 if x >= xr else 0)


def billow(y, side, i):
    """Wie weit eine Cape-Zeile nach außen weht (0 an der Schulter, bis 2).
    Nach unten nie weniger als darüber; die untersten Zeilen samt Saum
    bewegen sich gemeinsam, damit der Saum immer der untere Rand bleibt."""
    y0, y1 = C['cape'][:2]
    f = min(1.0, (y - y0) / (y1 - y0 - 2))
    ph = 2 * math.pi * i / (16 if side > 0 else 24)     # eigene Takte, Frame 0 = Ruhelage
    amp = 2.2 * (0.5 - 0.5 * math.cos(ph)) * (0.85 + 0.15 * math.sin(3 * ph))
    return int(round(amp * f ** 1.2))


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for top, bot in C['eyes']:
            s[top[1], top[0]] = LID
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    cape = []
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            side = cape_side(x, y)
            if side:
                cape.append((x, y, side))
                continue
            out[y + PT + (b if y < KNEE else 0), x + P] = s[y, x]
    if b < 0:                                        # Zeile über dem Knie dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not cape_side(x, y) and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    if cape:                                         # Capes wehen nach außen
        inner = {}
        for x, y, side in cape:
            k = (y, side)
            inner[k] = max(inner.get(k, x), x) if side < 0 else min(inner.get(k, x), x)
        for x, y, side in cape:
            d = billow(y, side, i)
            out[y + PT + b, x + P + side * d] = s[y, x]
        for (y, side), xin in inner.items():         # Innenkante nachziehen
            d = billow(y, side, i)
            for k in range(1, d + 1):
                xx = xin + P + side * (d - k)
                if not out[y + PT + b, xx, 3]:
                    out[y + PT + b, xx] = s[y, xin]
    fill_pinholes(out)
    for gx, gy, start in C['glint']:                 # Aufblitzen
        for (x, y), c in sparkle_pixels(i, N, [(gx + P, gy + PT + b, start)], GOLD0, GOLD1).items():
            assert 1 <= x < W - 1 and 1 <= y < H - 1, 'Glanz ragt an den Rand'
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=8, check_edges=True)
