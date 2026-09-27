# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin Dark Maho (MotiveArcanum.xcf, linke Figur aus
„Ebene #72“, nicht gespiegelt).

* Sie schwebt (sanftes Auf und Ab).
* Die kleinen grauen Flügel schlagen (spaltentreu geschert, 6 Schläge pro Loop).
* Die Spitze ihres Zauberhuts wippt dem Schweben etwas nach (oben 1 px,
  die Reihen darunter nur im Umkehrpunkt).
* Im Sprite zwinkert sie: ihr linkes Auge (im Bild rechts) ist zu. Es öffnet
  sich zwischendrin (halb -> offen, gezeichnet mit den Farben des anderen
  Auges), bleibt gut die Hälfte des Loops offen – in der Zeit blinzelt sie
  einmal mit beiden Augen – und schließt sich wieder zum Zwinkern.
* Aus dem Herzchen in ihrem Haar steigen – wie bei Maho – Herzchen wackelnd
  auf und verblassen (nur ganz und nur neben die Figur gezeichnet).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import shear_flap, fill_pinholes

SRC = np.array(Image.open('src/dark-maho.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 5, 7, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
GREYS = {rgb(c) for c in ('383838', 'a4a4a4', 'bababa', '838383', '6c6c6c', '565656')}
_xs = np.arange(SW)[None, :].repeat(SH, 0)
WING = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in GREYS for x in range(SW)] for y in range(SH)]) \
    & ((_xs <= 5) | (_xs >= 16))
BODY = SRC.copy()
BODY[WING] = 0
PIVOTS = {-1: 5.5, 1: 16.0}
# Hutspitze: Reihen 0–3 (x13–17)
TIP = {(x, y) for y in range(0, 4) for x in range(12, SW) if SRC[y, x, 3]}
# Augen (links x8–9, rechts x12–13, Reihen 13–15)
SKIN, LASH = rgb('f7caa1'), rgb('010101')
EYES = [(8, 9), (12, 13)]
BLINK = {24: 'halb', 25: 'zu', 26: 'zu', 27: 'halb'}           # beide Augen (während beide offen sind)


def wink_state(i):
    """Ihr linkes Auge (im Bild rechts): 'zu' = Original (Zwinkern), sonst offen."""
    if i in BLINK:
        return BLINK[i]
    if i in (10, 36):
        return 'halb'
    return 'offen' if 11 <= i <= 35 else 'zu'


EYE_OPEN = {(x + 4, y): tuple(int(v) for v in SRC[y, x]) for x in (8, 9) for y in (13, 14, 15)}
PINK, PINK_HI, PINK_DK = rgb('ff4dc5'), rgb('ff8eda'), rgb('c6188e')
HEART = [(-2, 0, PINK_DK), (-1, 0, PINK_HI), (1, 0, PINK_DK), (2, 0, PINK_DK),
         (-2, 1, PINK), (-1, 1, PINK_DK), (0, 1, PINK_DK), (1, 1, PINK), (2, 1, PINK),
         (-1, 2, PINK), (0, 2, PINK), (1, 2, PINK), (0, 3, PINK)]
SMALL_HEART = [(-1, 0, PINK), (1, 0, PINK_HI), (-1, 1, PINK_DK), (0, 1, PINK), (1, 1, PINK), (0, 2, PINK_DK)]


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def tip_dx(i, y):
    s = math.sin(2 * math.pi * i / 16 - 1.6)          # hängt dem Schweben nach
    if y <= 1:
        return int(round(1.2 * s))
    return 1 if s > 0.85 else (-1 if s < -0.85 else 0)


def draw_heart(out, cx, cy, shape, alpha):
    """Ganz oder gar nicht: im Bild, mit 1 px Abstand zur Figur."""
    pts = [(cx + dx, cy + dy, c) for dx, dy, c in shape]
    if any(not (1 <= x < W - 1 and 1 <= y < H - 1) for x, y, _ in pts):
        return
    if any(out[y - 1:y + 2, x - 1:x + 2, 3].any() for x, y, _ in pts):
        return
    for x, y, c in pts:
        out[y, x] = (*c[:3], alpha)


def hearts(out, i, oy):
    t = i % 24
    hx = 22 + P                                       # rechts neben dem Hut, über dem Flügel
    if t < 3:                                         # kleines Herz ploppt auf
        draw_heart(out, hx, 8 + oy, SMALL_HEART, 255)
    elif t < 20:                                      # steigt wackelnd auf
        k = t - 3
        cx = hx + int(round(1.2 * math.sin(k * 0.7)))
        cy = 7 + oy - (k * 3) // 4
        a = 255 if k < 11 else int(255 * (17 - k) / 6)
        draw_heart(out, cx, cy, HEART, max(0, a))


def frame(i):
    s = BODY.copy()
    w = wink_state(i)
    if w != 'zu':                                     # linkes Auge geöffnet zeichnen
        for (x, y), c in EYE_OPEN.items():
            s[y, x] = c
    for (x0, x1), st in ((EYES[0], BLINK.get(i)), (EYES[1], w if w == 'halb' or i in BLINK else None)):
        if not st:
            continue
        for x in (x0, x1):
            s[13, x] = SKIN
            s[14, x] = LASH if st == 'halb' else SKIN
            if st == 'zu':
                s[15, x] = LASH
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    ph = 2 * math.pi * i / 8
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = WING & ((cols < SW / 2) if side < 0 else (cols >= SW / 2))
        shear_flap(SRC, m, PIVOTS[side], side, 0.35 * math.sin(ph), 0.85 + 0.15 * math.cos(ph), out, (P, oy),
                   curve=1.0)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                dx = tip_dx(i, y) if (x, y) in TIP else 0
                out[y + oy, x + P + dx] = s[y, x]
    fill_pinholes(out)
    hearts(out, i, oy)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'dark_maho_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
