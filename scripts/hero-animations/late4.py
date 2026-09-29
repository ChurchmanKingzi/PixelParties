# -*- coding: utf-8 -*-
"""Idle-Animationen für Nachzügler aus mehreren Dateien (Sprites aus assemble_late.py).

Aufruf: python3 late4.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* styxgate:  Styx, the Opened Gate: er besteht aus Schatten, die wabern (Zeilen und Schattenarme wiegen
             sich); die lila Tore öffnen und schließen sich, aus offenen Toren greifen fahle Arme; Geister-
             köpfe steigen als Partikel aus den Schatten auf und verblassen.
* tushu:     Tushu, the Knowledge Keeper schwebt, Buch und Schriftrollen schweben jede für sich um ihn.
* patty:     Patty, the Ninja of Revenge federt und blinzelt; zweimal je Loop verschwindet sie in einer
             Rauchwolke und taucht ebenso wieder auf.
* rool:      Rool, the Troll Guard federt, der Geldsack an seiner Hand pendelt, die Münze glitzert.
* champion:  Champion, the Eye of the Storm: Sturmböen zerzausen sein Haar, Windstreifen jagen vorbei,
             über die Klinge läuft ein Blitz.
* stormkissed: Stormkissed Waflav schlägt mit den großen Kristallflügeln (Abschlag schnell, Körper steigt,
             dann sinkt er, während die Flügel sich heben), an den Flügeln knistern Funken.
* klaus:     Klaus, the Cult Leader hält die Geisel fest, das Messer blitzt, die Geisel zittert und blinzelt.
* kohtamaster: Kohta, Master of Super-Killing reckt das Messer (es zuckt hoch, die Klinge blitzt), der Zettel
             in seiner Hand flattert.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, sparkle_pixels, ring8
from flap_common import shear_flap

N = 48
OUT = os.environ.get('L4_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'styxgate': dict(slug='styx-the-opened-gate', pads=(3, 4, 3, 1)),
    'tushu': dict(slug='tushu-the-knowledge-keeper', pads=(2, 2, 3, 2)),
    'patty': dict(slug='patty-the-ninja-of-revenge', knee=17, pads=(5, 5, 5, 1)),
    'rool': dict(slug='rool-the-troll-guard', knee=24, pads=(3, 3, 3, 2)),
    'champion': dict(slug='champion-the-eye-of-the-storm', knee=36, pads=(8, 8, 3, 1)),
    'stormkissed': dict(slug='stormkissed-waflav', pads=(3, 3, 6, 3)),
    'klaus': dict(slug='klaus-the-cult-leader', knee=24, pads=(3, 3, 3, 1)),
    'kohtamaster': dict(slug='kohta-master-of-super-killing', knee=22, pads=(3, 3, 4, 1)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'tushu')
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
    if not (0 <= y < out.shape[0] and 0 <= x < out.shape[1]) or c[3] <= 0:
        return
    a = c[3] / 255
    if not out[y, x, 3]:
        out[y, x] = c
        return
    out[y, x, :3] = [int(c[k] * a + out[y, x, k] * (1 - a)) for k in range(3)]
    out[y, x, 3] = max(int(out[y, x, 3]), int(c[3]))


def paste(out, a, ox, oy, alpha=1.0):
    for y, x in zip(*np.nonzero(a[:, :, 3])):
        c = a[y, x]
        if alpha < 1 or c[3] < 255:
            blend(out, x + ox, y + oy, [c[0], c[1], c[2], int(c[3] * alpha)])
        else:
            dot(out, x + ox, y + oy, c)


def blink(s, i, table, shift=0):
    st = BLINK.get((i + shift) % N)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def flutter(out, s, i, ox, oy, rows, left, right, amp=2.0, speed=6, ok=None, env=True):
    t = 2 * math.pi * i / N
    e = (0.5 - 0.5 * math.cos(2 * t)) if env else 1.0
    for side, xs in ((-1, left), (1, right)):
        dxs = [round(amp * e * (0.5 + 0.5 * math.sin(speed * t - 0.9 * k + (0 if side < 0 else 1.7))))
               for k in range(len(rows))]
        for k in range(1, len(dxs)):
            dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
        for k, y in enumerate(rows):
            if dxs[k]:
                for x in xs:
                    if s[y, x, 3] and (ok is None or ok(s[y, x])):
                        dot(out, x + side * dxs[k] + ox, y + oy, s[y, x])


def components(a, min_px=1):
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    return [lab == k for k in range(1, n) if st[k][4] >= min_px]


def puff(out, cx, cy, a, L, cols=('e8e4f0', 'c8c4d0', 'a8a4b0')):
    """Rauchwölkchen: wächst und verblasst."""
    r = 1 + 2.5 * a / L
    al = int(230 * (1 - a / L))
    for yy in range(int(cy - r - 1), int(cy + r + 2)):
        for xx in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(xx - cx, yy - cy)
            if d <= r:
                blend(out, xx, yy, rgb(cols[(xx + yy + a) % len(cols)], al))


# ---------------------------------------------------------------- Styx, the Opened Gate
SG = None
SG_HEADS = None


def f_styxgate(i):
    """Die Schatten wabern, die Tore gehen auf und zu, aus offenen Toren greifen Arme, Geisterköpfe
    steigen auf."""
    global SG, SG_HEADS
    t = 2 * math.pi * i / N
    if SG is None:
        shadow, tendrils, gates, eye = load('shadow'), load('tendrils'), load('gates'), load('eye')
        gl = components(gates)
        heads = np.array(Image.open('src/styx-the-opened-gate-heads.png').convert('RGBA')).astype(int)
        m = components(heads)[0]                          # ein einzelner Geisterkopf als Vorlage
        ys, xs = np.nonzero(m)
        head = np.where(m[:, :, None], heads, 0)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        SG = shadow, tendrils, gates, eye, gl, head
    shadow, tendrils, gates, eye, gl, head = SG
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(shadow[:, :, 3])):        # der Schattenblock wabert zeilenweise
        dx = round(1.2 * math.sin(2 * t + 0.35 * y) - 1.2 * math.sin(0.35 * y))
        dy = round(0.8 * math.sin(3 * t + 0.25 * x) - 0.8 * math.sin(0.25 * x)) if y > SH - 30 else 0
        dot(out, x + dx + PL, y + dy + PT, shadow[y, x])
    for y, x in zip(*np.nonzero(tendrils[:, :, 3])):      # Schattenarme wiegen sich, unten stärker
        u = max(0.0, (y - 30) / (SH - 30))
        dx = round(2.0 * u * math.sin(2 * t - 0.2 * x) - 2.0 * u * math.sin(-0.2 * x))
        blend(out, x + dx + PL, y + PT, tendrils[y, x])
    arms = []
    for k, m in enumerate(gl):                            # Tore: offen – schließen – zu – öffnen
        ys, xs = np.nonzero(m)
        cy, cx = ys.mean(), xs.mean()
        big = len(ys) > 40
        a = (i + 7 * k) % 24
        f = 1.0 if a < 12 else (0.5 if a in (12, 13, 22, 23) else 0.0)
        if big:
            f = 1.0
        dy0 = round(1.2 * math.sin(2 * t + 0.35 * cy) - 1.2 * math.sin(0.35 * cy))
        for y, x in zip(ys, xs):
            if f >= 1 or abs(y - cy) <= f * (ys.max() - ys.min()) / 2:
                dot(out, x + PL + dy0, y + PT, gates[y, x])
        if f >= 1 and not big and 3 <= a < 11 and k % 3 == 0:   # ein fahler Arm greift heraus
            reach = min(a - 2, 11 - a, 4)
            arms.append((cx + dy0, ys.max(), reach, 1 if k % 2 else -1))
    for y, x in zip(*np.nonzero(eye[:, :, 3])):
        dot(out, x + PL, y + PT, eye[y, x])
    for cx, by, reach, side in arms:
        for r in range(1, reach + 1):
            dot(out, round(cx + side * r * 0.6) + PL, int(by) + r + PT, rgb('b8b4c8'))
        hx, hy = round(cx + side * reach * 0.6) + PL, int(by) + reach + 1 + PT
        for dx in (-1, 0, 1):
            dot(out, hx + dx, hy, rgb('d8d4e8'))          # Klauenhand
    hh, hw = head.shape[:2]
    for k in range(6):                                    # Geisterköpfe steigen aus den Schatten auf
        a = (i - 8 * k) % N
        L = 22
        if a < L:
            x0 = 8 + (k * 17) % (SW - hw - 8)
            x = x0 + round(1.2 * math.sin(0.5 * a + k))
            y = SH - 18 - round(1.6 * a)
            al = min(1.0, a / 4) * (1 - max(0, a - L + 6) / 6)
            paste(out, head, x + PL, y + PT, alpha=al)
    return out


# ---------------------------------------------------------------- Tushu
def f_tushu(i):
    """Er schwebt; Buch und Schriftrollen schweben jede für sich (eigene Höhe und eigener Takt)."""
    t = 2 * math.pi * i / N
    body, scrolls = load('body'), load('scrolls')
    out = np.zeros((H, W, 4), int)
    dy = -round(1.5 * math.sin(t))
    for k, m in enumerate(components(scrolls)):
        ph = 1.9 * k
        sy = -round(2.0 * math.sin(2 * t + ph) - 2.0 * math.sin(ph))
        sx = round(1.0 * math.sin(t + ph) - 1.0 * math.sin(ph))
        for y, x in zip(*np.nonzero(m)):
            dot(out, x + sx + PL, y + sy + PT, scrolls[y, x])
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        dot(out, x + PL, y + dy + PT, body[y, x])
    return out


# ---------------------------------------------------------------- Patty
PA_BLINK = {'halb': [((7, 9), '000000'), ((12, 9), '000000')],
            'zu': [((7, 9), 'f6cd8b'), ((12, 9), 'f6cd8b'), ((7, 10), '000000'), ((8, 10), '000000'),
                   ((11, 10), '000000'), ((12, 10), '000000')]}
PA_GONE = {k: 'poof' for k in (20, 21)} | {k: 'gone' for k in range(22, 27)} | {27: 'back', 28: 'back'}


def f_patty(i):
    """Sie federt und blinzelt; einmal je Loop verschwindet sie ninjagleich in einer Rauchwolke und
    taucht ein Stück daneben ebenso wieder auf, dann huscht sie zurück."""
    s = SRC.copy()
    blink(s, i, PA_BLINK)
    b = B24[i % 24]
    st = PA_GONE.get(i)
    out = np.zeros((H, W, 4), int)
    cx, cy = PL + SW / 2, PT + SH / 2
    if st in (None, 'poof'):
        draw_bounce(out, s, b, KNEE, PT, PL)
    elif st == 'back':
        draw_bounce(out, s, b, KNEE, PT, PL)
    if st == 'poof':
        a = i - 20
        for dx, dy in ((-4, 2), (4, 2), (0, -3), (-3, -2), (3, -3)):
            puff(out, cx + dx, cy + dy, a + 1, 4)
    if st == 'gone':
        a = i - 22
        for dx, dy in ((-4, 2), (4, 2), (0, -3)):
            puff(out, cx + dx, cy + dy - a * 0.5, a + 3, 9)
    if st == 'back':
        a = i - 27
        for dx, dy in ((-3, 3), (3, 3)):
            puff(out, cx + dx, cy + dy, a + 2, 4)
    return out


# ---------------------------------------------------------------- Rool
def f_rool(i):
    """Er federt; der Geldsack an seiner Hand pendelt nach, die Münze darauf glitzert."""
    t = 2 * math.pi * i / N
    body, bag = load('body'), load('bag')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, body, b, KNEE, PT, PL)
    ys, xs = np.nonzero(bag[:, :, 3])
    top = ys.min()
    sw = 1.2 * math.sin(2 * t - 0.8)                      # Pendel: unten schwingt es weiter aus
    lag = B24[(i - 2) % 24]
    for y, x in zip(ys, xs):
        dx = round(sw * (y - top) / (ys.max() - top))
        dot(out, x + dx + PL, y + PT + min(b, lag), bag[y, x])
    gold = [(y, x) for y, x in zip(ys, xs) if bag[y, x, 0] > 220 and bag[y, x, 1] > 180 and bag[y, x, 2] < 80]
    if gold:
        gy, gx = gold[len(gold) // 2]
        dx = round(sw * (gy - top) / (ys.max() - top))
        for (x, y), c in sparkle_pixels(i, N, [(gx + dx + PL, gy + PT + min(b, lag), 6), (gx + dx + PL, gy + PT + min(b, lag), 30)],
                                        rgb('fffbd0'), rgb('ffd700')).items():
            dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Champion, the Eye of the Storm
CH_WIND = None


def purple(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return b > r and b > g + 20


def f_champion(i):
    """Sturmböen zerzausen sein Haar (beide Seiten, ruppig), Windstreifen jagen vorbei, über die Klinge
    zuckt ab und zu ein Blitz; er federt."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    rows = list(range(15, 25))
    for side, xs in ((1, range(12, SW)), (-1, range(7, 12))):   # zerzaust: je Zeile ein ruppiger Ausschlag
        for k, y in enumerate(rows):
            g = 0.5 + 0.5 * math.sin(5 * t - 1.1 * k + (0 if side > 0 else 2.0)) * math.sin(3 * t + k)
            dx = round((2.2 if side > 0 else 1.2) * max(0.0, g) * (0.5 - 0.5 * math.cos(2 * t) + 0.4))
            if not dx:
                continue
            for x in xs:
                if s[y, x, 3] and purple(s[y, x]) and not (4 <= x <= 7):
                    dot(out, x + side * dx + PL, y + PT + b, s[y, x])
    for k in range(5):                                    # Windstreifen
        a = (i * 3 + k * 19) % (W + 12) - 6
        y = PT + 6 + (k * 9) % (SH - 6)
        for d in range(4):
            x = a - d
            if 1 <= x < W - 1 and not out[y, x, 3]:
                blend(out, x, y, rgb('d8e0ff', 150 - 30 * d))
    if (i % 16) in (5, 6):                                # Blitz über die Klinge
        for y in range(0, 15):
            x = 5 + (1 if (y + i) % 3 == 0 else 0)
            if out[y + PT + b, x + PL, 3]:
                dot(out, x + PL, y + PT + b, rgb('e8f0ff' if y % 2 else 'b8a0ff'))
    return out


# ---------------------------------------------------------------- Stormkissed Waflav
SK_PIVOT = (63, 70)                                     # Flügelwurzeln links/rechts
SK_FLAP = [(0.0, 1.0, 0), (0.06, 1.0, 1), (0.1, 1.0, 2), (0.12, 1.0, 2),     # fällt, Flügel heben sich
           (-0.12, 0.93, 0), (-0.26, 0.86, -2), (-0.3, 0.84, -3), (-0.26, 0.86, -3),   # Schlag, steigt
           (-0.18, 0.9, -3), (-0.1, 0.94, -2), (-0.03, 0.97, -2), (0.02, 1.0, -1),
           (0.03, 1.0, -1), (0.02, 1.0, 0), (0.01, 1.0, 0), (0.0, 1.0, 0)]


def f_stormkissed(i):
    """Er schlägt mit den Kristallflügeln: der Abschlag ist schnell (die Spitzen schlagen tief, der Flügel
    staucht sich perspektivisch), der Körper steigt; dann sinkt er, während die Flügel sich wieder heben.
    An den Flügelspitzen knistern Funken."""
    wings, body = load('wings'), load('body')
    lift, squeeze, dy = SK_FLAP[i % 16]
    out = np.zeros((H, W, 4), int)
    m = wings[:, :, 3] > 0
    shear_flap(wings, m & (_xs < SK_PIVOT[0]), SK_PIVOT[0], -1, lift, squeeze, out, (PL, PT + dy), curve=1.4)
    shear_flap(wings, m & (_xs > SK_PIVOT[1]), SK_PIVOT[1], 1, lift, squeeze, out, (PL, PT + dy), curve=1.4)
    for y, x in zip(*np.nonzero(m & (_xs >= SK_PIVOT[0]) & (_xs <= SK_PIVOT[1]))):
        dot(out, x + PL, y + PT + dy, wings[y, x])
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        dot(out, x + PL, y + PT + dy, body[y, x])
    if (i % 12) in (3, 4):                                # Funken an den Spitzen
        for side in (-1, 1):
            ys, xs = np.nonzero(out[:, :, 3])
            tip = xs.min() if side < 0 else xs.max()
            ty = ys[xs == tip].mean()
            for k in range(3):
                dot(out, int(tip + side * (1 + k % 2)), int(ty - 2 + 2 * k), rgb('e8f8ff' if k != 1 else '8fd0ff'))
    return out


# ---------------------------------------------------------------- Klaus, the Cult Leader
KL_GIRL = {'halb': [((x, 19), '301700') for x in (7, 8, 11, 12)],
           'zu': [((x, 19), 'f6bd7b') for x in (7, 8, 11, 12)] + [((x, 20), '301700') for x in (7, 8, 11, 12)]}


def f_klaus(i):
    """Er hält die Geisel fest und atmet, das Messer blitzt auf; die Geisel zittert ab und zu und blinzelt."""
    s = SRC.copy()
    blink(s, i, KL_GIRL, shift=10)
    g = (i % 24) - 6                                      # Glanz läuft die Klinge (x 1–2, y 6–12) hinab
    for y in range(5, 13):
        for x in (1, 2):
            if s[y, x, 3] and abs(y - 6 - g) < 1:
                s[y, x] = rgb('ffffff')
    b = B24[i % 24]
    shake = 1 if (i % 16) in (9, 11) else (-1 if (i % 16) == 10 else 0)
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL, dx_fn=(lambda x, y: shake if 13 <= y <= 24 and 4 <= x <= 15 else 0))
    return out


# ---------------------------------------------------------------- Kohta, Master of Super-Killing
def f_kohtamaster(i):
    """Er reckt das Messer (es zuckt zweimal je Loop hoch, die Klinge blitzt), der Zettel in seiner
    Hand flattert, er federt."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    g = (i % 24) - 4
    for y in range(0, 21):
        for x in range(26, SW):
            if s[y, x, 3] and hexc(s[y, x]) in ('ffffff', 'e8e8e8', 'cccccc') and abs(y - g * 1.3) < 1:
                s[y, x] = rgb('ffffff')
    b = B24[i % 24]
    jab = -1 if (i % 24) in (6, 7, 8) else 0
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL, dx_fn=None)
    if jab:                                               # das Messer (samt Hand) zuckt hoch
        knife = (s[:, :, 3] > 0) & (_xs >= 24) & (_ys <= 21)
        for y, x in zip(*np.nonzero(knife)):
            out[y + PT + b, x + PL] = 0
        for y, x in zip(*np.nonzero(knife)):
            dot(out, x + PL, y + PT + b + jab, s[y, x])
        for x in range(24, SW):                           # darunter rückt der Arm nach
            if s[21, x, 3] and not out[21 + PT + b, x + PL, 3]:
                dot(out, x + PL, 21 + PT + b, s[21, x])
    flutter(out, s, i, PL, PT + b, list(range(13, 21)), range(0, 9), [], amp=1.3, speed=5)
    return out


FRAME = dict(styxgate=f_styxgate, tushu=f_tushu, patty=f_patty, rool=f_rool, champion=f_champion,
             stormkissed=f_stormkissed, klaus=f_klaus, kohtamaster=f_kohtamaster)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
