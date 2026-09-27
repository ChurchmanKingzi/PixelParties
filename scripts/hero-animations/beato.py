# -*- coding: utf-8 -*-
"""Idle-Animation für Beato, the Butterfly Witch (21x28 + je 3 px links/rechts = 27x28).

Elegante Hexe und Tänzerin – sie tanzt richtig:
* Tanzschritt (zweimal pro Loop): Standbein links, das rechte Bein winkelt an
  und kickt zur Seite (sie hebt sich dabei auf die Spitze), kleiner Hüpfer,
  Standbeinwechsel, dasselbe gespiegelt. Die Beine werden pro Frame neu
  gezeichnet, der Standfuß bleibt am Boden.
* Der Oberkörper wiegt sich über das Standbein, der Arm auf der Kick-Seite
  schwingt hoch, der Rocksaum schwingt gegenläufig nach.
* Beide Augen offen; ab und zu zwinkert sie, einmal blinzelt sie.
* Goldene Schmetterlinge umkreisen sie flatternd und ziehen eine Glitzerspur.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, wave, save_outputs

SRC = np.array(Image.open('src/beato-the-butterfly-witch.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL = PR = 3
BASE = np.zeros((SH, SW + PL + PR, 4), int)
BASE[:, PL:PL + SW] = SRC
H, W = BASE.shape[:2]
N = 48

SKIN, LASH = rgb('f7bc97'), rgb('000200')
EYE_R = [((11, 12), rgb('031f35')), ((12, 12), rgb('00fbfc')),      # rechtes Auge geöffnet
         ((11, 13), rgb('33576d')), ((12, 13), rgb('f2ffff'))]
OUT = rgb('000200')
LEGS = {'L': (6, rgb('f4f7f3'), rgb('474946')),       # (linke Spalte, Strumpf, Schuh)
        'R': (10, rgb('474946'), rgb('1a0607'))}


# ---------------------------------------------------------------- Tanz
def step(i):
    """Standbein und Pose des Spielbeins: (stand, spiel_pose)."""
    t = i % 24
    if t < 6:
        return 'L', 'kurz'
    if t < 11:
        return 'L', 'kick'
    if t == 11:
        return None, 'kurz'                                  # Hüpfer
    if t < 18:
        return 'R', 'kurz'
    if t < 23:
        return 'R', 'kick'
    return None, 'kurz'


def body_dy(i):
    stand, pose = step(i)
    if stand is None:
        return -1                                            # in der Luft
    return -1 if pose == 'kick' and 1 <= (i % 24) % 12 - 6 + 1 <= 4 else 0


def sway(i):
    """Oberkörper wiegt sich über das Standbein (-1 links, +1 rechts)."""
    return -int(round(1.1 * math.sin(2 * math.pi * (i + 2) / 24)))


def draw_leg(out, name, pose, dy, dx, grounded):
    x0, stock, shoe = LEGS[name]
    x0 += PL
    d = -1 if name == 'L' else 1                              # nach außen
    hip = 25 + dy
    rows = []
    if pose == 'lang':
        for y in range(hip, 26):
            rows.append((y, dx if y == hip and dx else 0, 'strumpf'))
        rows += [(26, 0, 'schuh'), (27, 0, 'spitze')]
        if not grounded:
            rows = [(y - 1, o, k) for y, o, k in rows]
    elif pose == 'kurz':
        rows = [(hip, dx, 'schuh'), (hip + 1, dx, 'spitze')]
    else:                                                     # Kick zur Seite
        rows = [(hip, dx, 'strumpf'), (hip + 1, dx + d, 'strumpf'),
                (hip + 2, dx + 2 * d, 'schuh'), (hip + 3, dx + 2 * d, 'spitze')]
    for y, o, kind in rows:
        xs = x0 + o
        if kind == 'spitze':
            pix = [(1, OUT), (2, OUT)]
        else:
            fill = stock if kind == 'strumpf' else shoe
            pix = [(0, OUT), (1, fill), (2, fill), (3, OUT)]
        for k, c in pix:
            if 0 <= y < H and 0 <= xs + k < W:
                out[y, xs + k] = c


def is_arm(ox, oy):
    return 14 <= oy <= 18 and (ox <= 4 or ox >= 16)


def arm_lift(ox, i):
    """Arm auf der Kick-Seite schwingt hoch (rechts um Frame 8, links um Frame 20)."""
    if ox <= 4:
        reach, ph = (5 - ox) / 4, -0.654 + math.pi
    else:
        reach, ph = (ox - 15) / 4, -0.654
    lift = int(round(1 + wave(i, 24, ph)))                 # 0..2
    return int(round(lift * min(1.0, reach)))


def skirt_dx(oy, i):
    if not 20 <= oy <= 24:
        return 0
    return -int(round(1.2 * min(1.0, (oy - 19) / 4) * math.sin(2 * math.pi * (i - 1) / 24)))


def eyes(a, i):
    t = i % N
    if t in (30, 31):                                        # blinzeln (beide)
        for x in (7, 8, 11, 12):
            a[12, x + PL] = SKIN
            a[13, x + PL] = LASH
        return
    if 18 <= t < 23 or 42 <= t < 47:                         # zwinkern (Original)
        return
    for (x, y), c in EYE_R:
        a[y, x + PL] = c


# ---------------------------------------------------------------- Schmetterlinge
GOLD = [rgb('d19745'), rgb('ffcc80'), rgb('ffd290')]
BODY = rgb('311800')
# (Mittelpunkt x, y, Radius x, y, Umläufe pro Loop, Phase, Flatter-Versatz)
BUTTERFLIES = [(13.5, 13.0, 12.0, 9.0, 1, 0.0, 0), (13.5, 17.0, 11.0, 6.0, -1, 2.2, 2)]


def butterfly_pos(b, i):
    cx, cy, rx, ry, laps, ph, _ = b
    a = 2 * math.pi * laps * i / N + ph
    x = cx + rx * math.cos(a)
    y = cy + ry * math.sin(a) + 1.2 * math.sin(4 * a)
    return x, y, math.sin(a) > 0                           # vorne, wenn unten im Kreis


WINGS = {                                                  # Flügelstellungen
    'offen': [((-2, -1), 1), ((-1, -1), 2), ((1, -1), 2), ((2, -1), 1),
              ((-1, 0), 1), ((1, 0), 1), ((-2, 0), 0), ((2, 0), 0), ((-1, 1), 0), ((1, 1), 0)],
    'halb': [((-1, -1), 1), ((1, -1), 1), ((-1, -2), 2), ((1, -2), 2), ((-1, 0), 0), ((1, 0), 0)],
    'zu': [((0, -1), 1), ((0, -2), 2), ((-1, -2), 0)],
}
FLAP = ['offen', 'halb', 'zu', 'halb']


def draw_butterfly(out, x, y, i, flap_off, front):
    x, y = int(round(x)), int(round(y))
    pix = [((dx, dy), GOLD[k]) for (dx, dy), k in WINGS[FLAP[(i + flap_off) % 4]]]
    pix += [((0, 0), BODY), ((0, -1), BODY)] if FLAP[(i + flap_off) % 4] != 'zu' else [((0, 0), BODY)]
    for (dx, dy), c in pix:
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H and (front or out[yy, xx, 3] == 0):
            out[yy, xx] = c


def frame(i):
    s = BASE.copy()
    eyes(s, i)
    out = np.zeros_like(s)
    dy, dx = body_dy(i), sway(i)
    stand, pose = step(i)
    # Beine neu zeichnen (Standbein zuerst, Spielbein davor)
    for name in ('L', 'R'):
        if name == stand:
            draw_leg(out, name, 'lang', dy, dx, True)
    for name in ('L', 'R'):
        if name != stand:
            draw_leg(out, name, pose, dy, dx, False)
    # Körper (ohne Arme und Original-Beine): wiegt sich, Rock schwingt nach
    for oy in range(25):
        for ox in range(SW):
            if not s[oy, ox + PL, 3] or is_arm(ox, oy):
                continue
            ty, tx = oy + dy, ox + PL + dx + skirt_dx(oy, i)
            if 0 <= ty < H and 0 <= tx < W:
                out[ty, tx] = s[oy, ox + PL]
    # Arme: schwingen im Tanz (als Ganzes, an der Schulter verbunden)
    for oy in range(14, 19):
        for ox in range(SW):
            if s[oy, ox + PL, 3] and is_arm(ox, oy):
                ty = oy + dy - arm_lift(ox, i)
                if 0 <= ty < H and 0 <= ox + PL + dx < W:
                    out[ty, ox + PL + dx] = s[oy, ox + PL]
    # Schmetterlinge mit Glitzerspur
    for b in BUTTERFLIES:
        x, y, front = butterfly_pos(b, i)
        px_, py_, _ = butterfly_pos(b, i - 1)
        tx, ty = int(round(px_)), int(round(py_))
        if 0 <= tx < W and 0 <= ty < H and out[ty, tx, 3] == 0:
            out[ty, tx] = (*GOLD[2][:3], 110)
        draw_butterfly(out, x, y, i, b[6], front)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'beato_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
