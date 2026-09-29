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
    'styxgate': dict(slug='styx-the-opened-gate', pads=(3, 6, 1, 1)),
    'tushu': dict(slug='tushu-the-knowledge-keeper', pads=(2, 1, 3, 1)),
    'patty': dict(slug='patty-the-ninja-of-revenge', knee=17, pads=(5, 5, 5, 1)),
    'rool': dict(slug='rool-the-troll-guard', knee=24, pads=(3, 3, 3, 2)),
    'champion': dict(slug='champion-the-eye-of-the-storm', knee=36, pads=(8, 8, 3, 3)),
    'stormkissed': dict(slug='stormkissed-waflav', pads=(1, 1, 10, 3)),
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
SG_HAND = [(0, 12, 'big', 1.0), (12, 16, 'big', -1), (16, 28, 3, 0), (30, 42, 9, 0), (44, 48, 'big', 1)]  # Handweg


def line(out, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for k in range(n + 1):
        blend(out, round(x0 + (x1 - x0) * k / max(1, n)), round(y0 + (y1 - y0) * k / max(1, n)), c)


def warp(out, part, field, ox, oy):
    """Teil verformen, ohne dass Lücken entstehen: jedes Pixel wird verschoben (field(x, y) -> (dx, dy))
    und mit seinen Nachbarn per Linie verbunden."""
    pts = {}
    for y, x in zip(*np.nonzero(part[:, :, 3])):
        dx, dy = field(x, y)
        pts[(x, y)] = (x + dx, y + dy)
    for (x, y), (nx, ny) in pts.items():
        for qx, qy in ((x + 1, y), (x, y + 1), (x + 1, y + 1), (x - 1, y + 1)):
            if (qx, qy) in pts:
                mx, my = pts[(qx, qy)]
                if max(abs(mx - nx), abs(my - ny)) > 1:
                    line(out, nx + ox, ny + oy, mx + ox, my + oy, part[y, x])
        blend(out, nx + ox, ny + oy, part[y, x])


def hand_state(i):
    """Die Geisterhand aus „Ebene #669“: wo sie gerade ist (Tor) und wie weit sie heraushängt (0..1)."""
    for a, e, gate, mode in SG_HAND:
        if a <= i < e:
            u = (i - a) / (e - a)
            if mode == 1.0 or mode == 1:
                ext = 1.0 if mode == 1.0 and gate == 'big' and a == 0 else u
            elif mode == -1:
                ext = 1.0 - u
            else:
                ext = math.sin(math.pi * u)                # heraus und wieder hinein
            return gate, ext
    return 'big', 1.0


def f_styxgate(i):
    """Die Schatten wabern, die Schattenarme wiegen sich (lückenlos), die kleinen Tore gehen auf und zu,
    verschwinden und erscheinen wieder; die Geisterhand greift aus dem großen Tor, zieht sich zurück und
    greift aus anderen Toren; Geisterköpfe steigen aus den Schatten auf."""
    global SG
    t = 2 * math.pi * i / N
    if SG is None:
        shadow, tendrils, gates, hand = load('shadow'), load('tendrils'), load('gates'), load('eye')
        gl = components(gates)
        heads = np.array(Image.open('src/styx-the-opened-gate-heads.png').convert('RGBA')).astype(int)
        m = components(heads)[0]
        ys, xs = np.nonzero(m)
        head = np.where(m[:, :, None], heads, 0)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        ys, xs = np.nonzero(hand[:, :, 3])
        hx0, hy0 = xs.min(), ys.min()
        hand = hand[hy0:ys.max() + 1, hx0:xs.max() + 1]
        SG = shadow, tendrils, gates, gl, head, hand, hx0, hy0
    shadow, tendrils, gates, gl, head, hand, hx0, hy0 = SG
    out = np.zeros((H, W, 4), int)
    wob = lambda y: round(1.2 * math.sin(2 * t + 0.35 * y) - 1.2 * math.sin(0.35 * y))
    for y, x in zip(*np.nonzero(shadow[:, :, 3])):        # der Schattenblock wabert zeilenweise
        dy = round(0.8 * math.sin(3 * t + 0.25 * x) - 0.8 * math.sin(0.25 * x)) if y > SH - 30 else 0
        dot(out, x + wob(y) + PL, y + dy + PT, shadow[y, x])

    def tfield(x, y):                                     # Schattenarme: unten weit ausschwingend
        u = max(0.0, (y - 28) / (SH - 28)) ** 1.2
        dx = 3.2 * u * (math.sin(2 * t - 0.22 * x - 0.15 * y) - math.sin(-0.22 * x - 0.15 * y))
        dy = 1.2 * u * (math.sin(3 * t - 0.3 * x) - math.sin(-0.3 * x))
        return round(dx), round(dy)
    warp(out, tendrils, tfield, PL, PT)
    gate, ext = hand_state(i)
    info = []
    for k, m in enumerate(gl):
        ys, xs = np.nonzero(m)
        info.append((xs.min(), xs.max(), ys.min(), ys.max(), len(ys) > 100))
    big_k = next(k for k, g in enumerate(info) if g[4])
    small = [k for k, g in enumerate(info) if not g[4]]
    hk = big_k if gate == 'big' else small[gate % len(small)]
    x0, x1, y0, y1, _ = info[hk]                           # die Hand hängt aus ihrem Tor heraus
    hh, hw = hand.shape[:2]
    if gate == 'big':
        tx, ty = hx0, hy0 - round((1 - ext) * hh)
    else:
        tx, ty = (x0 + x1) // 2 - hw // 2, y0 + 2 - round((1 - ext) * hh)
    for k, m in enumerate(gl):                            # Tore: auf – schließen – weg – erscheinen – öffnen
        ys, xs = np.nonzero(m)
        gx0, gx1, gy0, gy1, big = info[k]
        cy = (gy0 + gy1) / 2
        a = (i + 5 * k) % 24
        f = (1.0 if a < 10 else 0.5 if a in (10, 11, 20, 21) else 0.15 if a in (12, 13, 18, 19) else 0.0)
        if big or k == hk:
            f = 1.0
        if f <= 0:
            continue
        dy0 = wob(int(cy))
        for y, x in zip(ys, xs):
            if f >= 1 or abs(y - cy) <= max(0.5, f * (gy1 - gy0) / 2):
                dot(out, x + PL + dy0, y + PT, gates[y, x])
    for y, x in zip(*np.nonzero(hand[:, :, 3])):
        yy = y + ty
        if yy >= y0:                                      # über dem Tor steckt sie noch drin
            dot(out, x + tx + wob((y0 + y1) // 2) + PL, yy + PT, hand[y, x])
    hh2, hw2 = head.shape[:2]
    for k in range(6):                                    # Geisterköpfe steigen aus den Schatten auf
        a = (i - 8 * k) % N
        L = 22
        if a < L:
            x = 8 + (k * 17) % (SW - hw2 - 8) + round(1.2 * math.sin(0.5 * a + k))
            y = SH - 18 - round(1.6 * a)
            al = min(1.0, a / 4) * (1 - max(0, a - L + 6) / 6)
            paste(out, head, x + PL, y + PT, alpha=al)
    return out


# ---------------------------------------------------------------- Tushu
TU_ROBE = lambda c: int(c[2]) > int(c[1]) + 30 and int(c[0]) > int(c[1])     # lila Robe


def f_tushu(i):
    """Er schwebt, seine Robe weht an den Zipfeln; die Schriftrollen schweben jede für sich, ihre roten
    Bänder schlackern; das Buch liegt ruhig."""
    t = 2 * math.pi * i / N
    body, scrolls = load('body'), load('scrolls')
    out = np.zeros((H, W, 4), int)
    dy = -round(1.5 * math.sin(t))
    comps = components(scrolls)
    book = max(comps, key=lambda m: np.nonzero(m)[0].mean())   # das Buch liegt unten in der Mitte
    for y, x in zip(*np.nonzero(book)):
        dot(out, x + PL, y + PT, scrolls[y, x])
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        dot(out, x + PL, y + dy + PT, body[y, x])
    flutter(out, body, i, PL, PT + dy, list(range(12, SH)), range(0, 24), range(33, SW), amp=1.4, speed=4,
            ok=TU_ROBE)
    for k, m in enumerate([c for c in comps if c is not book]):
        ph = 1.9 * k
        sy = -round(2.0 * math.sin(2 * t + ph) - 2.0 * math.sin(ph))
        sx = round(1.0 * math.sin(t + ph) - 1.0 * math.sin(ph))
        ys, xs = np.nonzero(m)
        red = [(y, x) for y, x in zip(ys, xs) if scrolls[y, x, 0] > 150 and scrolls[y, x, 1] < 80]
        rtop = min((y for y, _ in red), default=0) + 3
        span = max(1, max((y for y, _ in red), default=1) - rtop)

        def field(x, y, ph=ph):
            if scrolls[y, x, 0] > 150 and scrolls[y, x, 1] < 80 and y > rtop:   # die Bänder schlackern
                u = (y - rtop) / span
                return round(1.8 * u * math.sin(5 * t - 0.6 * y + ph)), 0
            return 0, 0
        sub = np.where(m[:, :, None], scrolls, 0)
        warp(out, sub, field, PL + sx, PT + sy)
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
    b = -1 if B24[i % 24] < 0 else 0                     # sie federt als Ganzes (nichts wird gedehnt)
    st = PA_GONE.get(i)
    out = np.zeros((H, W, 4), int)
    cx, cy = PL + SW / 2, PT + SH / 2
    if st in (None, 'poof', 'back'):
        paste(out, s, PL, PT + b)
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
    body, bag = load('body').copy(), load('bag')
    for part in ('arm', 'beard'):                         # ausgestreckter Arm und Bart gehören fest dazu
        p = load(part)
        body[p[:, :, 3] > 0] = p[p[:, :, 3] > 0]
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
    b = -round(2.5 * math.sin(t))                         # er schwebt frei: steigt und sinkt als Ganzes
    out = np.zeros((H, W, 4), int)
    paste(out, s, PL, PT + b)
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
SK_FLAP = [(0.0, 1.0, 0), (0.08, 1.0, 1), (0.12, 1.0, 2),                     # fällt, Flügel heben sich
           (-0.16, 0.9, 0), (-0.3, 0.84, -2), (-0.26, 0.86, -3),              # Schlag: schnell, er steigt
           (-0.16, 0.9, -3), (-0.07, 0.95, -2), (0.0, 1.0, -1),               # erholen
           (0.03, 1.0, -1), (0.02, 1.0, 0), (0.0, 1.0, 0)]                     # 12 Frames: vier Schläge je Loop


def f_stormkissed(i):
    """Er schlägt mit den Kristallflügeln: der Abschlag ist schnell (die Spitzen schlagen tief, der Flügel
    staucht sich perspektivisch), der Körper steigt; dann sinkt er, während die Flügel sich wieder heben.
    An den Flügelspitzen knistern Funken."""
    wings, body = load('wings'), load('body')
    lift, squeeze, dy = SK_FLAP[i % 12]
    t = 2 * math.pi * i / N                               # dazu steigt und sinkt er unregelmäßig
    dy += round(1.6 * math.sin(t + 0.4) + 1.1 * math.sin(3 * t + 2.0) + 0.7 * math.sin(5 * t) -
                (1.6 * math.sin(0.4) + 1.1 * math.sin(2.0)))
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
KL_EYE = {'halb': [((11, 8), '300700'), ((12, 8), '300700')],
          'zu': [((11, 8), 'f6bd7b'), ((12, 8), 'f6bd7b'), ((11, 9), '300700'), ((12, 9), '300700')]}
KL_GIRL = {'halb': [((x, 19), '301700') for x in (7, 8, 11, 12)],
           'zu': [((x, 19), 'f6bd7b') for x in (7, 8, 11, 12)] + [((x, 20), '301700') for x in (7, 8, 11, 12)]}


def f_klaus(i):
    """Er hält die Geisel fest und atmet, das Messer blitzt auf; die Geisel zittert ab und zu und blinzelt."""
    s = SRC.copy()
    blink(s, i, KL_GIRL, shift=10)
    blink(s, i, KL_EYE)
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
KO_TALK = [0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0,
           1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0]


def f_kohtamaster(i):
    """Er reckt das Messer (es zuckt zweimal je Loop hoch, die Klinge blitzt), der Zettel in seiner
    Hand flattert, er federt."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    if not KO_TALK[i]:                                    # er spricht: der Mund geht auf und zu
        for x in (17, 18):
            for y in (13, 14):
                s[y, x] = rgb('f6bd7b')
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
