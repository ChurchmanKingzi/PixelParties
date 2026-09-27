# -*- coding: utf-8 -*-
"""Idle-Animation für Diamond, the Keeper of Peace (MotiveSteamDwarfs.xcf, „Diamond“).

* Squash and Stretch (erste Loop-Hälfte): der Körper federt im 12er-Takt bis
  zu 2 px hoch (gestreckt – die Zeilen über den Beinen werden gedehnt) und
  2 px herunter (gestaucht); die Beine bleiben stehen.
* Er hebt den Karren (zweite Loop-Hälfte): Karren und rechte Kristallhand
  heben sich um bis zu 6 px, bleiben kurz oben (mit einem Nachfassen) und
  setzen wieder auf. Darunter
  wird sein rechtes Bein sichtbar – im Sprite verdeckt, hier als Spiegelbild
  des sichtbaren linken Beins mit Fuß ergänzt (Achse x = 19).
* Seine Kristalle funkeln: nacheinander blitzen Glitzersterne auf den
  Kristallspitzen auf, dazu läuft ein heller Schimmer über die Kristalle.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/diamond-the-keeper-of-peace.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 7, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 38
CRYSTAL = {rgb(c) for c in ('68a6a6', '80cccc', '91e6e6', 'b8e6e6')}
WHITE = np.array([235, 255, 255])
# Glitzersterne auf den Kristallspitzen: (x, y, Startframe)
SPARKLES = [(26, 2, 0), (39, 7, 8), (3, 7, 16), (30, 30, 24), (11, 41, 32), (19, 12, 40)]


BOUNCE = [0, -1, -2, -2, -1, 0, 1, 2, 2, 1, 0, 0]
CART_COLS = {rgb(c) for c in ('2d0a01', '411e05', '55320a', '693c14', '734619', '7d501e', 'af824b', '875a28',
                              'c39b64', 'b9825a', '191419', '5a555a', '736e73', '878287', '322d32', '464146',
                              '504164', '6e5f82', '8c7da0')}
HAND_COLS = CRYSTAL | {rgb('508080')}
_px = lambda f: np.array([[bool(SRC[y, x, 3]) and f(x, y, tuple(SRC[y, x])) for x in range(SW)] for y in range(SH)])
CART = _px(lambda x, y, c: x >= 15 and y >= 31 and c in CART_COLS)
RHAND = _px(lambda x, y, c: x >= 24 and 28 <= y <= 38 and c in HAND_COLS)
GROUP = CART | RHAND                                 # wird angehoben
# rechtes Bein: Spiegelbild des linken Unterkörpers (ohne linke Hand), Achse x = 19
LEG = np.zeros_like(SRC)
for _y in range(33, SH):
    for _x in range(0, 19):
        c = tuple(SRC[_y, _x])
        if SRC[_y, _x, 3] and not CART[_y, _x] and not (_y < 39 and _x < 12 and c in HAND_COLS):
            LEG[_y, 38 - _x] = SRC[_y, _x]
LIFT = [1, 2, 4, 5, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 5, 4, 2, 1, 0, 0, 0, 0, 0, 0]


def draw_squash(out, s, b):
    """Oberkörper um b verschieben, Beine (ab KNEE) bleiben; beim Strecken die
    Zeile über den Beinen wiederholen, damit keine Lücke entsteht."""
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                out[y + PT + (b if y < KNEE else 0), x + P] = s[y, x]
    for k in range(b, 0):
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT + k + 1, x + P, 3]:
                out[y + PT + k + 1, x + P] = s[y, x]


def frame(i):
    s = SRC.copy()
    g = (i % 24) * 3.2 - 10                          # Schimmer läuft schräg über die Kristalle
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3] and tuple(s[y, x]) in CRYSTAL and abs(x + y * 0.6 - g) < 1.5:
                s[y, x, :3] = (s[y, x, :3] * 0.45 + WHITE * 0.55).astype(int)
    out = np.zeros((H, W, 4), int)
    b, lift = (BOUNCE[i % 12], 0) if i < 24 else (0, LIFT[i - 24])
    for y, x in zip(*np.nonzero(LEG[:, :, 3])):     # verdecktes rechtes Bein (hinter dem Karren)
        out[y + PT + (b if y < KNEE else 0), x + P] = LEG[y, x]
    body = s.copy()
    body[GROUP] = 0
    draw_squash(out, body, b)
    for y, x in zip(*np.nonzero(GROUP)):             # Karren + rechte Hand (angehoben)
        out[y + PT + (b if y < KNEE else 0) - lift, x + P] = s[y, x]
    fill_pinholes(out)
    for x, y, t0 in SPARKLES:
        dy = (b if y < KNEE else 0) - (lift if RHAND[y, x] else 0)
        for (px_, py_), c in sparkle_pixels(i, N, [(x + P, y + PT + dy, t0)],
                                            rgb('e0ffff'), rgb('91e6e6')).items():
            assert 1 <= px_ < W - 1 and 1 <= py_ < H - 1, 'Glitzerstern ragt an den Rand'
            out[py_, px_] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'diamond_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=6,
                 check_edges=True)
