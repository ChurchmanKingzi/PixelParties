# -*- coding: utf-8 -*-
"""Idle-Animation für Vena, the Bounty Huntress (Sprite aus MotiveMoe.xcf).

Ebenen: Körper („Vena“) und die abgefeuerte Raketenfaust („Ebene #59“),
deckungsgleich in src/vena-the-bounty-huntress-{body,fist}.png.
* Die Raketenfaust schießt stoßweise nach vorn (unten) und fängt sich wieder;
  ihr Düsenfeuer wird dabei in die Länge gezogen und flackert jedes Frame,
  Rauchwölkchen steigen auf.
* Beim Stoß ruckt Vena 1 px zurück (nach oben), ihr Cyborg-Auge glüht auf.
* Das Jetpack-Feuer links und rechts lodert: jede Flammenspalte wird pro
  Frame zufällig gestreckt (Spitzen züngeln nach unten), der Kern flackert.
* Sie brüllt: anfangs ist ihr Mund geschlossen (schmaler roter Strich), dann
  geht er auf (so wie im Sprite), beim Brüllen noch 1 px weiter; sie wirft den
  Kopf 1 px zurück (Hals gedehnt, keine Lücke), neben dem Kopf zucken kurze
  Schrei-Striche. Danach schließt sie den Mund wieder.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/vena-the-bounty-huntress-body.png').convert('RGBA')).astype(int)
FIST = np.array(Image.open('src/vena-the-bounty-huntress-fist.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PT, PB, P = 4, 8, 4
H, W = SH + PT + PB, SW + 2 * P
N = 36
PERIOD = 12
FLAME_ROWS = range(15, 19)                           # Feuer der Faust (Zeilen 15–18)
FIST_TOP = 19


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def thrust(i):
    t = i % PERIOD
    return [0, 1, 3, 4, 4, 3, 3, 2, 2, 1, 1, 0][t]


EYE = {rgb('de4b4b'): rgb('ff8a7a'), rgb('ba2121'): rgb('ff4b4b')}
FIRE = [rgb('ff6800'), rgb('ff9100'), rgb('ffa500'), rgb('ffd84a')]
JET = {rgb(c) for c in ('874401', 'ff6800', 'ff9100', 'ffa500')}
JET_CORE = [rgb('ff6800'), rgb('ff9100'), rgb('ffa500'), rgb('ffd84a')]


def is_jet(x, y):
    return y >= 11 and (x <= 6 or x >= 19) and BODY[y, x, 3] and tuple(BODY[y, x]) in JET


JET_COLS = {}
for _x in range(SW):
    _ys = [y for y in range(SH) if is_jet(_x, y)]
    if _ys:
        JET_COLS[_x] = (min(_ys), max(_ys))
ROAR = range(18, 31)
HEAD_MAX_Y = 11
MOUTH_D = rgb('4f0000')
# Ihr Mund (Rot unten im Gesicht) ist schon offen – beim Brüllen reißt sie
# ihn nur 1 px weiter nach unten auf.
ROAR_MOUTH = {(12, 12): MOUTH_D, (13, 12): MOUTH_D}
SKIN = rgb('f6bd98')
CLOSED_MOUTH = {(12, 10): SKIN, (13, 10): SKIN, (12, 11): MOUTH_D, (13, 11): rgb('7a0000')}
MOUTH_OPEN = range(16, 33)                        # davor/danach geschlossen
SHOUT = rgb('ffe6d5')


def frame(i):
    out = np.zeros((H, W, 4), int)
    d = thrust(i)
    recoil = -1 if d >= 3 else 0
    glow = d >= 3
    roar = i in ROAR
    body = BODY.copy()
    if roar:
        for (x, y), c in ROAR_MOUTH.items():
            body[y, x] = c
    elif i not in MOUTH_OPEN:
        for (x, y), c in CLOSED_MOUTH.items():
            body[y, x] = c
    lift = 1 if roar and i not in (ROAR[0], ROAR[-1]) else 0
    # Körper (ohne Jetpack-Feuer); beim Brüllen Kopf 1 px zurück, Hals gedehnt
    for y in range(SH):
        for x in range(SW):
            if not body[y, x, 3] or is_jet(x, y):
                continue
            c = tuple(body[y, x])
            if glow and c in EYE:
                c = EYE[c]
            head = y <= HEAD_MAX_Y and 7 <= x <= 18
            out[y + PT + recoil - (lift if head else 0), x + P] = c
            if head and lift and y == HEAD_MAX_Y:
                out[y + PT + recoil, x + P] = c
    # Jetpack-Feuer: Spalten gestreckt, Kern flackert
    for x, (y0, y1) in JET_COLS.items():
        n = y1 - y0 + 1
        grow = 1.0 + 0.4 * rnd(x + 3, i) - 0.1 * rnd(x + 70, i)
        m = max(1, int(round(n * grow)))
        for j in range(m):
            sy = y0 + min(n - 1, int(j * n / m))
            if not is_jet(x, sy):
                continue
            c = tuple(BODY[sy, x])
            if c in JET_CORE[:3] and rnd(x * 13 + sy, i) > 0.6:
                k = JET_CORE.index(c)
                c = JET_CORE[k + 1] if rnd(x, i + 9) > 0.45 else JET_CORE[max(0, k - 1)]
            out[y0 + j + PT + recoil, x + P] = c
    # Schrei-Striche neben dem Kopf
    if roar:
        jit = i % 2
        for side, x0 in ((-1, 6), (1, 19)):
            for dx, dy in ((0, 0), (1, -1), (0, 3), (1, 4)):   # zwei kurze Striche
                xx = x0 + side * (dx + jit) + P
                yy = 3 + dy + PT + recoil - lift
                if out[yy, xx, 3] == 0:
                    out[yy, xx] = SHOUT
    # Faust: Körper der Faust wandert um d nach unten
    for y in range(FIST_TOP, SH):
        for x in range(SW):
            if FIST[y, x, 3]:
                out[y + PT + d, x + P] = FIST[y, x]
    # Feuer: oben fest, unten an der Faust -> Mittelzeile wird gedehnt
    rows = list(FLAME_ROWS)
    stretched = rows[:2] + [rows[2]] * (1 + d // 2) + [rows[3]] * (1 + (d + 1) // 2)
    top = FLAME_ROWS[0] + d - (len(stretched) - len(rows))
    for j, sy in enumerate(stretched):
        for x in range(SW):
            if FIST[sy, x, 3]:
                c = tuple(FIST[sy, x])
                if c in FIRE[:3] and rnd(x + 7 * j, i) > 0.55:
                    c = FIRE[min(3, FIRE.index(c) + 1)] if rnd(x, i + 50) > 0.3 else FIRE[max(0, FIRE.index(c) - 1)]
                out[top + j + PT, x + P] = c
    # flackernde Spitze
    tx = 8 + P
    ty = top + PT - 1
    if rnd(3, i) > 0.35 and out[ty, tx, 3] == 0:
        out[ty, tx] = rgb('a85e00')
    # Rauch
    for k in range(4):
        t = (i + k * 4) % 16
        if t >= 12:
            continue
        sx = int(round(tx + math.sin(t * 0.6 + k * 2) * 1.2 + (k % 2) - 0.5))
        sy = ty - 1 - t // 2
        a = int(160 * (1 - t / 12))
        for dx in range(1 if t < 4 else 2):
            if 0 <= sx + dx < W and 0 <= sy < H and out[sy, sx + dx, 3] == 0:
                out[sy, sx + dx] = (150, 150, 150, a)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'vena_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8, check_edges=True)
