# -*- coding: utf-8 -*-
"""Idle-Animationen für die Nachzügler aus MotiveDeepsea.xcf.

Aufruf: python3 deepsea_late.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* arnold:   Arnold, the Maximum Lotl federt, pumpt mit dem erhobenen Arm (Bizeps), seine Kiemen
            wackeln jede für sich, über die Sonnenbrille huscht ein Glanz.
* feral:    Feral, the Fortress Breaker federt und blinzelt, ihr türkiser Kamm flackert, auf der
            Eisrüstung blitzen Glitzersterne.
* teppes:   Teppes, the Deepsea Vampire: das Cape wallt langsam, er blinzelt; die zwei Fledermäuse
            flattern unabhängig von ihm, jede auf eigener Bahn.
* teppesman: Teppesman the Deepsea Knight: wie Teppes, mit drei Fledermäusen.
* shuchaku: Shu'Chaku, the Blood Moon Projection schwebt, das rote Glühen pulsiert, die Augen
            leuchten auf, ab und zu flackert die Projektion (Zeilen verrutschen).
* waflav:   Deep-Drowned Waflav schlägt langsam mit den Skelettflügeln (steht dabei), die Tentakel
            am Kopf wiegen sich, er blinzelt, aus seinem Maul steigen Blasen.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, sparkle_pixels
from flap_common import shear_flap

N = 48
OUT = os.environ.get('DL_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'arnold': dict(slug='arnold-the-maximum-lotl', knee=17, pads=(2, 2, 3, 1)),
    'feral': dict(slug='feral-the-fortress-breaker', knee=20, pads=(3, 3, 3, 1)),
    'teppes': dict(slug='teppes-the-deepsea-vampire', knee=19, pads=(6, 4, 3, 1)),
    'teppesman': dict(slug='teppesman-the-deepsea-knight', knee=30, pads=(3, 5, 6, 1),
                      skin='Teppes, the Deepsea Vampire'),
    'shuchaku': dict(slug='shu-chaku-the-blood-moon-projection', pads=(4, 4, 4, 4)),
    'waflav': dict(slug='deep-drowned-waflav', knee=40, pads=(5, 5, 10, 2)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'arnold')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def blend(out, x, y, c):
    """Halbtransparentes Pixel c über out legen."""
    if not (0 <= y < out.shape[0] and 0 <= x < out.shape[1]) or c[3] <= 0:
        return
    a = c[3] / 255
    if not out[y, x, 3]:
        out[y, x] = c
        return
    out[y, x, :3] = [int(c[k] * a + out[y, x, k] * (1 - a)) for k in range(3)]
    out[y, x, 3] = 255


def paste(out, a, ox, oy):
    for y, x in zip(*np.nonzero(a[:, :, 3])):
        dot(out, x + ox, y + oy, a[y, x])


def blink(s, i, table):
    st = BLINK.get(i)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def flutter(out, s, i, ox, oy, rows, left, right, amp=2.0, speed=6, ok=None):
    """Zipfel flattern nach außen: je Zeile schiebt sich die Spitze um 0..amp px hinaus und zurück
    (Welle von oben nach unten), das Original bleibt darunter – nichts reißt."""
    t = 2 * math.pi * i / N
    env = 0.5 - 0.5 * math.cos(2 * t)
    for side, xs in ((-1, left), (1, right)):
        dxs = [round(amp * env * (0.5 + 0.5 * math.sin(speed * t - 0.9 * k + (0 if side < 0 else 1.7))))
               for k in range(len(rows))]
        for k in range(1, len(dxs)):
            dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
        for k, y in enumerate(rows):
            if dxs[k]:
                for x in xs:
                    if s[y, x, 3] and (ok is None or ok(s[y, x])):
                        dot(out, x + side * dxs[k] + ox, y + oy, s[y, x])


def components(a):
    import cv2
    n, lab = cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    return [lab == k for k in range(1, n)]


def line(out, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for k in range(n + 1):
        dot(out, round(x0 + (x1 - x0) * k / max(1, n)), round(y0 + (y1 - y0) * k / max(1, n)), c)


# ---------------------------------------------------------------- Arnold
AR_GILL = 'e440d8'
AR_ARM = (0, 7, 2, 12)                                  # der erhobene Arm (x0, x1, y0, y1)
AR_PUMP = {k + st: d for st in (4, 16, 28, 40) for k, d in enumerate([-1, -1, -1, 0])}
AR_SHADES = [(x, 4) for x in range(6, 17)]


def f_arnold(i):
    """Er federt, pumpt alle 12 Frames mit dem erhobenen Arm, die Kiemen wackeln, über die
    Sonnenbrille huscht ein Glanz."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    gill = (s[:, :, 3] > 0) & np.array([[hexc(c) == AR_GILL for c in row] for row in s])
    s[gill] = 0
    pump = AR_PUMP.get(i, 0)
    if pump:                                              # der Arm hebt sich, darunter rückt Arm nach
        x0, x1, y0, y1 = AR_ARM
        arm = s[y0:y1, x0:x1].copy()
        s[y0:y1, x0:x1] = 0
        s[y0 + pump:y1 + pump, x0:x1][arm[:, :, 3] > 0] = arm[arm[:, :, 3] > 0]
        s[y1 - 1, x0:x1][arm[-1, :, 3] > 0] = arm[-1][arm[-1, :, 3] > 0]
    g = (i % 24) - 4                                      # Glanz über die Brille
    if 0 <= g < len(AR_SHADES):
        x, y = AR_SHADES[g]
        s[y, x] = rgb('ffffff')
        if g > 0:
            s[y, x - 1] = rgb('e4ffff')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    for k, m in enumerate(components(np.where(gill[:, :, None], SRC, 0))):
        ph = 1.7 * k
        dy = round(0.9 * math.sin(4 * t + ph) - 0.9 * math.sin(ph))
        for y, x in zip(*np.nonzero(m)):
            dot(out, x + PL, y + dy + PT + b, rgb(AR_GILL))
    return out


# ---------------------------------------------------------------- Feral
FE_BLINK = {'halb': [((x, 9), '000000') for x in (6, 7, 10, 11)],
            'zu': [((x, 9), 'f6cd8b') for x in (6, 7, 10, 11)] + [((x, 10), '000000') for x in (6, 7, 10, 11)]}
FE_CREST = {'10bdbd', 'acffff', 'd6ffff'}
FE_SPARKLES = [(3, 16, 0), (14, 15, 12), (8, 21, 24), (1, 19, 36)]


def f_feral(i):
    """Sie federt und blinzelt, der türkise Kamm auf dem Helm flackert, auf der Eisrüstung blitzen
    Glitzersterne."""
    s = SRC.copy()
    blink(s, i, FE_BLINK)
    k = i % 6                                             # der Kamm flackert: die Spitze wechselt die Farbe
    if k in (1, 4):
        s[0, 8] = rgb('acffff')
    if k in (2,):
        s[1, 8] = rgb('d6ffff')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    if (i % 12) in (3, 4, 5):                             # und züngelt einen Pixel höher
        dot(out, 8 + PL, PT + b - 1, rgb('acffff' if i % 12 != 5 else '10bdbd'))
    for (x, y), c in sparkle_pixels(i, N, [(x + PL, y + PT + (b if y < KNEE else 0), t0) for x, y, t0 in FE_SPARKLES],
                                    rgb('e0ffff'), rgb('8bd5ff')).items():
        dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Teppes / Teppesman
TP = {
    'teppes': dict(eyes=[(16, 6), (16, 7), (17, 7), (21, 6), (20, 7), (21, 7)], face='152239', line='030817',
                   cape={'4a0004', '430000', 'e52a32', 'c61c27', '851f19', 'a41821'},
                   rows=list(range(11, 22)), left=range(6, 13), right=range(24, 32)),
    'teppesman': dict(eyes=[(24, 18), (24, 19), (25, 19), (29, 18), (28, 19), (29, 19)], face=None, line=None,
                      cape=None, rows=list(range(24, 34)), left=range(16, 22), right=range(32, 38)),
}
TP_BATS = None


def bat_paths():
    """Jede Fledermaus kreist auf einer eigenen kleinen Lissajous-Bahn um ihren Platz."""
    global TP_BATS
    if TP_BATS is None:
        bats = load('bats')
        TP_BATS = []
        for k, m in enumerate(components(bats)):
            ys, xs = np.nonzero(m)
            spr = np.where(m[:, :, None], bats, 0)
            TP_BATS.append((spr, int(round(xs.mean())), (1, 2, 1)[k % 3], (2, 1, 3)[k % 3], 1.3 + 2.1 * k))
    return TP_BATS


def f_teppes(i):
    """Das Cape wallt langsam (die Seiten wehen hinaus, der Saum wogt), er blinzelt; die Fledermäuse
    flattern schnell mit den Flügeln und kreisen jede für sich."""
    cfg = TP[V]
    t = 2 * math.pi * i / N
    body = load('body')
    s = body.copy()
    st = BLINK.get(i)
    if st:
        for x, y in cfg['eyes']:
            if st == 'zu' or y == min(yy for _, yy in cfg['eyes']):
                nb = body[y, x - 1] if hexc(body[y, x - 1]) not in ('f6ffff',) else body[y, x + 1]
                s[y, x] = nb
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    cape_ok = (lambda c: hexc(c) in cfg['cape']) if cfg['cape'] else (lambda c: hexc(c) != 'f6ffff')
    flutter(out, s, i, PL, PT + b, cfg['rows'], cfg['left'], cfg['right'], amp=1.6, speed=2, ok=cape_ok)
    for spr, cx, fx, fy, ph in bat_paths():               # die Fledermäuse, unabhängig von ihm
        dx = round(2.5 * math.sin(fx * t + ph) - 2.5 * math.sin(ph))
        dy = round(2.0 * math.sin(fy * t + ph * 1.7) - 2.0 * math.sin(ph * 1.7))
        lift = 0.45 * math.sin(8 * t + ph)                # schneller Flügelschlag
        m = spr[:, :, 3] > 0
        wings = np.zeros((H, W, 4), int)
        shear_flap(spr, m & (_xs < cx - 1), cx - 1, -1, lift, 1.0, wings, (PL + dx, PT + dy), curve=1.2)
        shear_flap(spr, m & (_xs > cx + 1), cx + 1, 1, lift, 1.0, wings, (PL + dx, PT + dy), curve=1.2)
        for y, x in zip(*np.nonzero(m & (abs(_xs - cx) <= 1))):
            dot(wings, x + PL + dx, y + PT + dy, spr[y, x])
        mm = wings[:, :, 3] > 0
        out[mm] = wings[mm]
    return out


# ---------------------------------------------------------------- Shu'Chaku
SC_GLITCH = {10: 2, 11: -1, 30: -2, 31: 1, 44: 1}


def f_shuchaku(i):
    """Die Projektion schwebt, das rote Glühen pulsiert, die Augen leuchten auf; ab und zu flackert sie
    (ein Zeilenband verrutscht kurz)."""
    t = 2 * math.pi * i / N
    glow, body = load('glow'), load('body')
    dy = -round(2.0 * math.sin(t))
    pulse = 0.75 + 0.35 * math.sin(2 * t)
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(glow[:, :, 3])):
        c = glow[y, x].copy()
        c[3] = min(255, int(c[3] * pulse))
        blend(out, x + PL, y + PT + dy, c)
    band = SC_GLITCH.get(i, 0)
    by0 = 15 + (i * 7) % 20
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        sx = band if by0 <= y < by0 + 4 else 0
        c = body[y, x]
        if hexc(c) == 'f6ffff' or (c[0] > 200 and c[1] > 200 and c[2] < 150):
            lvl = 0.5 + 0.5 * math.sin(3 * t)
            if lvl > 0.7 and hexc(c) != 'f6ffff':
                c = rgb('ffffc8')
        dot(out, x + sx + PL, y + PT + dy, c)
    return out


# ---------------------------------------------------------------- Deep-Drowned Waflav
WF_PIVOT = (49.5, 24.0)                                 # Schulter: hier treffen sich beide Skelettflügel
WF_BLINK = {'halb': [((x, 17), '000000') for x in (47, 48, 51, 52)],
            'zu': [((x, 17), '000000') for x in (47, 48, 51, 52)] + [((x, 18), '3a3a3a') for x in (47, 48, 51, 52)]}
WF_MOUTH = (49.5, 22)
WF_BUBBLES = [(0, -1), (5, 1), (11, -1), (16, 1), (21, -1), (27, 1), (32, -1), (37, 1), (43, -1)]


def wing_lines(out, wings, side, ang, ox, oy):
    """Dünne Knochenlinien um die Schulter drehen: jedes Pixel wird vorwärts abgebildet und mit seinen
    Nachbarn per Linie verbunden – so bleiben die 1-px-Linien geschlossen."""
    px, py = WF_PIVOT
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    m = wings[:, :, 3] > 0
    m &= (_xs < px) if side < 0 else (_xs > px)
    rot = {}
    for y, x in zip(*np.nonzero(m)):
        dx, dy = x - px, y - py
        rot[(x, y)] = (px + dx * ca - dy * sa, py + dx * sa + dy * ca)
    for (x, y), (rx, ry) in rot.items():
        for nx, ny in ((x + 1, y), (x, y + 1), (x + 1, y + 1), (x - 1, y + 1)):
            if (nx, ny) in rot:
                qx, qy = rot[(nx, ny)]
                line(out, round(rx) + ox, round(ry) + oy, round(qx) + ox, round(qy) + oy, wings[y, x])
        dot(out, round(rx) + ox, round(ry) + oy, wings[y, x])


def bubble(out, x, y, a, L):
    """Blase: wächst von 1 px über einen 2x2- zu einem 3x3-Ring und platzt am Ende."""
    rim, hi = rgb('9fd8ff', 220), rgb('e8f8ff')
    if a >= L - 1:
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            dot(out, x + dx, y + dy, rgb('9fd8ff', 150))
        return
    if a < 3:
        dot(out, x, y, hi)
    elif a < 7:
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            dot(out, x + dx, y + dy, rim)
        dot(out, x, y, hi)
    else:
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            dot(out, x + dx, y + dy, rim)
        dot(out, x - 1, y - 1, hi)


def f_waflav(i):
    """Er schlägt langsam mit den Skelettflügeln (bleibt dabei stehen), die Tentakel am Kopf wiegen
    sich, er blinzelt, aus seinem Maul steigen Blasen."""
    t = 2 * math.pi * i / N
    wings, tent, body = load('wings'), load('tentacles'), load('body')
    body = body.copy()
    blink(body, i, WF_BLINK)
    ang = 13.0 * math.sin(2 * t)                          # zwei langsame Schläge je Loop
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    wing_lines(out, wings, -1, ang, PL, PT)
    wing_lines(out, wings, 1, -ang, PL, PT)
    fig = np.zeros((H, W, 4), int)
    draw_bounce(fig, body, b, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(tent[:, :, 3])):         # die Tentakel wiegen sich, außen stärker
        d = abs(x - WF_PIVOT[0])
        dy = round(1.2 * (d / 16) * math.sin(3 * t - 0.3 * d))
        dot(fig, x + PL, y + dy + PT + b, tent[y, x])
    m = fig[:, :, 3] > 0
    out[m] = fig[m]
    mx, my = WF_MOUTH
    for e, side in WF_BUBBLES:                            # Blasen: aus dem Maul seitlich hinaus, dann hoch
        a = (i - e) % N
        L = 16
        if a < L:
            x = mx + side * (1.5 + min(a, 4) * 1.2) + 0.6 * math.sin(0.8 * a + e)
            y = my + 1 - max(0, a - 2) * 1.1
            bubble(out, round(x) + PL, round(y) + PT + b, a, L)
    return out


FRAME = dict(arnold=f_arnold, feral=f_feral, teppes=f_teppes, teppesman=f_teppes, shuchaku=f_shuchaku,
             waflav=f_waflav)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
