# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin Space Huntress Vena (MotiveMoe.xcf: Ebene #143
+ Jetpack aus „Vena“ + Flamme der Raketenhand aus „Ebene #59“).

Teile: src/space-huntress-vena-{jet,body,fistflame}.png (deckungsgleich).
* Sie schwebt auf dem Jetpack (sanftes Auf und Ab).
* Das Jetpack-Feuer lodert: jede Flammenspalte wird pro Frame zufällig nach
  unten gestreckt, der Kern flackert.
* Die Flamme über der Raketenhand züngelt nach oben und flackert.
* Das Fähnchen auf dem Helm weht (die Tuchspalten wellen sich), über die
  Helmkuppel läuft ein Glanz.
* Im Sprite fehlt zwischen Schulter und Raketenfaust der Arm – er wird hier
  als gepanzerter Oberarm (Schulterstück + Armschiene in den Farben von Helm
  und Brustpanzer) dazugezeichnet; die Faustflamme liegt darüber.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

JET = np.array(Image.open('src/space-huntress-vena-jet.png').convert('RGBA')).astype(int)
BODY = np.array(Image.open('src/space-huntress-vena-body.png').convert('RGBA')).astype(int)
FF = np.array(Image.open('src/space-huntress-vena-fistflame.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
# Arm der Raketenhand ergänzen (Schulter x7–9, Armschiene bis zur Flamme)
_O, _M, _H, _T, _D = rgb('273122'), rgb('404c42'), rgb('747871'), rgb('51726c'), rgb('283936')
ARM = {(7, 17): _O, (7, 18): _O, (8, 18): _H, (7, 19): _O, (8, 19): _M, (9, 19): _H,
       (7, 20): _O, (8, 20): _M, (9, 20): _T, (10, 20): _D,
       (6, 21): _O, (7, 21): _M, (8, 21): _T, (9, 21): _M, (10, 21): _D, (11, 21): _O}
for (_x, _y), _c in ARM.items():
    assert not BODY[_y, _x, 3], (_x, _y)
    BODY[_y, _x] = _c
P, PT, PB = 3, 4, 7
H, W = SH + PT + PB, SW + 2 * P
N = 32
FIRE = [rgb('ff6800'), rgb('ff9100'), rgb('ffa500'), rgb('ffd84a')]
FLAME = {rgb(c) for c in ('874401', 'ff6800', 'ff9100', 'ffa500', 'a85e00', '9c3800')}
FLAG = [(x, y) for y in range(0, 3) for x in range(9, 14) if BODY[y, x, 3]]
DOME = [(x, y) for y in range(6, 10) for x in range(SW) if BODY[y, x, 3] and tuple(BODY[y, x]) in
        (rgb('404c42'), rgb('747871'))]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def flicker(c, x, y, i):
    if c in FIRE[:3] and rnd(x * 13 + y, i) > 0.6:
        k = FIRE.index(c)
        return FIRE[k + 1] if rnd(x, i + 9) > 0.45 else FIRE[max(0, k - 1)]
    return c


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    # Jetpack: Düsen fest, Feuer spaltenweise nach unten gestreckt
    for x in range(SW):
        ys = [y for y in range(SH) if JET[y, x, 3]]
        fl = [y for y in ys if tuple(JET[y, x]) in FLAME]
        for y in ys:
            if y not in fl:
                out[y + oy, x + P] = JET[y, x]
        if fl:
            y0, y1 = min(fl), max(fl)
            n = y1 - y0 + 1
            m = max(1, int(round(n * (1.0 + 0.4 * rnd(x + 3, i) - 0.1 * rnd(x + 70, i)))))
            for j in range(m):
                sy = y0 + min(n - 1, int(j * n / m))
                if JET[sy, x, 3]:
                    out[y0 + j + oy, x + P] = flicker(tuple(JET[sy, x]), x, sy, i)
    # Körper; Fähnchen weht, Glanz über die Kuppel
    flag = set(FLAG)
    g = (i % 16) * 1.1 - 2
    for y in range(SH):
        for x in range(SW):
            if not BODY[y, x, 3]:
                continue
            c = tuple(BODY[y, x])
            if (x, y) in DOME and abs(x - y * 0.5 - g) < 1.0:
                c = rgb('b8c0b8')
            dy = 1 if (x, y) in flag and math.sin(2 * math.pi * i / 8 - x * 0.9) > 0.3 else 0
            out[y + oy + dy, x + P] = c
    # Flamme der Raketenhand züngelt nach oben
    for x in range(SW):
        ys = [y for y in range(SH) if FF[y, x, 3]]
        if not ys:
            continue
        y0, y1 = min(ys), max(ys)
        n = y1 - y0 + 1
        m = max(1, int(round(n * (1.0 + 0.45 * rnd(x + 11, i)))))
        for j in range(m):
            sy = y1 - min(n - 1, int(j * n / m))
            if FF[sy, x, 3]:
                out[y1 - j + oy, x + P] = flicker(tuple(FF[sy, x]), x, sy, i)
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'space_vena_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8,
                 check_edges=True)
