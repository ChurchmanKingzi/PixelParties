# -*- coding: utf-8 -*-
"""Todesanimation + Leiche für Elana, the Rocky Rebel (Idle: 25x25).

Der Sprite ist in Einzelteile zerlegt (elana_parts.py: Kopf, Rumpf, beide
Arme, beide Beine, Gitarre). Jedes Teil hängt an einem Gelenk (Hüfte →
Rumpf → Nacken/Schultern) und wird pro Frame aus Keyframes posiert; jedes
Teil wird nur einmal gedreht (RotSprite-artig), dadurch bleiben die Pixel
sauber.

Ablauf: Treffer-Blitz → Rückstoß, Kopf schnellt zurück, Arme fliegen hoch,
Gitarre wird weggeschleudert → Knie knicken, Arme fuchteln → Elana kippt
nach hinten → Aufprall, Hüpfer, Gliedmaßen klappen auf → Staub, Sternchen →
Leiche (Gitarre daneben).

Startpose = Idle-Frame 0. Der erste Frame ist ein Treffer-Blitz, der den
Wechsel aus jedem beliebigen Idle-Frame überdeckt.

Aufruf (aus diesem Ordner):  python3 elana_death.py [install]
Ausgabe (Arbeitsdateien): elana_death_sheet.png, elana_death.gif,
elana_corpse.png, elana_death_contact.png.
"""
import math
import sys
from PIL import Image
import numpy as np
import elana_parts as EP

W0 = H0 = 25
OX, OY = 6, 9            # Lage des stehenden Sprites in der Leinwand
CW, CH = 62, OY + H0     # Leinwand; Boden = untere Kante (y = CH)
M = 26                   # Rand der Arbeitsleinwand (für Drehungen)
MS = 70
J = EP.JOINTS
P = EP.PARTS


def rgb(h, a=255):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# ------------------------------------------------------------ Hilfsfunktionen
def canvas():
    return np.zeros((CH + 2 * M, CW + 2 * M, 4), np.uint8)


def put(dst, src, ox, oy):
    ys, xs = np.nonzero(src[..., 3])
    for y, x in zip(ys, xs):
        X, Y = x + ox + M, y + oy + M
        if 0 <= X < dst.shape[1] and 0 <= Y < dst.shape[0]:
            dst[Y, X] = src[y, x]


def over(dst, src):
    m = src[..., 3] > 0
    dst[m] = src[m]


def dot(dst, x, y, col):
    X, Y = int(round(x)) + M, int(round(y)) + M
    if 0 <= X < dst.shape[1] and 0 <= Y < dst.shape[0]:
        dst[Y, X] = col


def rotate(img, deg, pivot, scale=4):
    """Pixelart-Drehung (RotSprite-artig): 4× hochskalieren, rückwärts mit
    nächstem Nachbarn drehen, dann je 4×4-Block die häufigste Farbe nehmen.
    Bewahrt die Palette. Drehung im Uhrzeigersinn um `pivot` (Leinwand-
    koordinaten, ohne Rand)."""
    if deg % 360 == 0:
        return img.copy()
    h, w = img.shape[:2]
    big = np.repeat(np.repeat(img, scale, 0), scale, 1)
    H, Wd = big.shape[:2]
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    px, py = (pivot[0] + M) * scale, (pivot[1] + M) * scale
    yy, xx = np.mgrid[0:H, 0:Wd]
    dx, dy = xx + 0.5 - px, yy + 0.5 - py
    sx = ca * dx + sa * dy + px
    sy = -sa * dx + ca * dy + py
    ix, iy = np.floor(sx).astype(int), np.floor(sy).astype(int)
    ok = (ix >= 0) & (ix < Wd) & (iy >= 0) & (iy < H)
    rot = np.zeros_like(big)
    rot[ok] = big[iy[ok], ix[ok]]
    blocks = rot.reshape(h, scale, w, scale, 4).transpose(0, 2, 1, 3, 4)
    opaque = (blocks[..., 3] > 0).sum(axis=(2, 3))
    out = np.zeros_like(img)
    for y, x in zip(*np.nonzero(opaque * 2 >= scale * scale)):
        blk = blocks[y, x].reshape(-1, 4)
        blk = blk[blk[:, 3] > 0]
        vals, cnt = np.unique(blk, axis=0, return_counts=True)
        out[y, x] = vals[cnt.argmax()]
    return out


def shift(img, dx, dy):
    """Ebene um ganze Pixel verschieben (mit Rand M kein Verlust)."""
    return np.roll(np.roll(img, int(dy), axis=0), int(dx), axis=1)


def flash(img, amt):
    out = img.astype(np.float32)
    m = out[..., 3] > 0
    out[..., :3][m] = out[..., :3][m] + (255 - out[..., :3][m]) * amt
    return out.astype(np.uint8)


def crop(layer):
    return layer[M:M + CH, M:M + CW].copy()


def lowest(layer):
    ys = np.where(layer[..., 3].any(axis=1))[0]
    return ys.max() if len(ys) else 0


def despeckle(lay):
    a = lay[..., 3] > 0
    p = np.pad(a, 1)
    n = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx]
            for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0))
    lay[a & (n == 0)] = 0
    return lay


# ------------------------------------------------------------ Teile posieren
def rot_pt(v, deg):
    a = math.radians(deg)
    return (v[0] * math.cos(a) - v[1] * math.sin(a),
            v[0] * math.sin(a) + v[1] * math.cos(a))


def head_img(eyes, hair):
    """Kopf mit Augenzustand (0 normal, 1 X) und nachziehenden Haarspitzen."""
    h = P['head'].copy()
    if eyes == 1:
        for (x, y) in ((6, 9), (8, 9), (7, 10), (6, 11), (8, 11)):
            if h[y, x, 3]:
                h[y, x] = EP.X_EYE
    if hair:
        out = np.zeros_like(h)
        for y in range(h.shape[0]):
            k = int(round(hair * (9 - y) / 9)) if y < 9 else 0
            for x in np.nonzero(h[y, :, 3])[0]:
                if 0 <= x + k < h.shape[1]:
                    out[y, x + k] = h[y, x]
        h = out
    return h


def place(part, pivot, ang, world):
    """Teil (Sprite-Koordinaten) einmal um `pivot` drehen und so verschieben,
    dass das Gelenk an `world` (Leinwandkoordinaten) liegt."""
    lay = canvas()
    put(lay, part, OX, OY)
    rp = (OX + pivot[0], OY + pivot[1])
    lay = rotate(lay, ang, rp)
    return shift(lay, round(world[0] - rp[0]), round(world[1] - rp[1]))


def render_body(s):
    """Alle Körperteile einer Pose s (dict) zeichnen; Rückgabe: Arbeitsebene."""
    hip = J['hip']
    hip_w = (OX + hip[0] + s['rx'], OY + hip[1] + s['ry'])
    R = s['rot']

    def joint(name):
        d = (J[name][0] - hip[0], J[name][1] - hip[1])
        r = rot_pt(d, R)
        return (hip_w[0] + r[0], hip_w[1] + r[1])

    layers = {}
    layers['torso'] = place(P['torso'], J['hip'], R, hip_w)
    layers['leg_l'] = place(P['leg_l'], J['hip_l'], R + s['leg_l'], joint('hip_l'))
    layers['leg_r'] = place(P['leg_r'], J['hip_r'], R + s['leg_r'], joint('hip_r'))
    layers['head'] = place(head_img(s['eyes'], s['hair']), J['neck'],
                           R + s['head'], joint('neck'))
    layers['arm_s'] = place(P['arm_s'], J['shoulder_s'], R + s['arm_s'],
                            joint('shoulder_s'))
    layers['arm_f'] = place(P['arm_f'], J['shoulder_f'], R + s['arm_f'],
                            joint('shoulder_f'))
    out = canvas()
    # Stehend liegt der Greifarm vor dem Kopf; liegend hinter ihm, damit die
    # Fäuste das Gesicht nicht verdecken.
    order = ('leg_l', 'leg_r', 'torso', 'arm_s', 'head', 'arm_f') if R < 50 else \
        ('leg_l', 'leg_r', 'arm_f', 'torso', 'arm_s', 'head')
    for k in order:
        over(out, layers[k])
    return out


def render_guitar(s):
    gp = J['guitar']
    lay = canvas()
    put(lay, P['guitar'], OX, OY)
    rp = (OX + gp[0], OY + gp[1])
    lay = rotate(lay, s['gang'], rp)
    return shift(lay, round(s['gx']), round(s['gy']))


# ------------------------------------------------------------ Effekte
DUST = rgb('cdbd9f')
DUST2 = rgb('968873')


def dust(dst, t, cx):
    if t < 0:
        return
    rng = np.random.RandomState(7)
    for k in range(22):
        side = -1 if k % 2 else 1
        ang = rng.uniform(0.1, 1.1)
        spd = rng.uniform(1.0, 2.4)
        life = rng.randint(5, 11)
        if t >= life:
            continue
        x = cx + side * (3 + spd * t * math.cos(ang) * 1.4)
        y = CH - 1 - (spd * t * math.sin(ang) * 0.8 - 0.1 * t * t)
        col = DUST if t < life - 3 else DUST2
        dot(dst, x, y, col)
        if t < 3:
            dot(dst, x + side, y, col)


STAR = rgb('ffe14a')
STAR2 = rgb('fff6b0')


def stars(dst, t, cx, cy, n=3):
    if t < 0:
        return
    for k in range(n):
        a = t * 0.6 + k * 2 * math.pi / n
        x, y = cx + 7 * math.cos(a), cy + 2.2 * math.sin(a)
        dot(dst, x, y, STAR)
        if t < 10:
            dot(dst, x, y - 1, STAR2)


SPARK = rgb('ffffff')
SPARK2 = rgb('ffd54a')


def hit_spark(dst, size, cx, cy):
    if size <= 0:
        return
    for k in range(-size, size + 1):
        col = SPARK if abs(k) <= size - 1 else SPARK2
        dot(dst, cx + k, cy, col)
        dot(dst, cx, cy + k, col)
    for k in range(1, size):
        for sx in (-1, 1):
            for sy in (-1, 1):
                dot(dst, cx + sx * k, cy + sy * k, SPARK2)


# ------------------------------------------------------------ Keyframes
# Alle Winkel in Grad, im Uhrzeigersinn, WELTWINKEL (0 = Teil zeigt wie im
# Stehen; bei Armen/Kopf also nach oben, bei Beinen nach unten; 90 = nach
# rechts gekippt). Elana blickt nach links und fällt nach rechts.
#  rx/ry   Hüfte: seitlicher Versatz / Anheben vom Boden (Hüpfer)
#  rot     Rumpf um die Hüfte    head_w  Kopf (Nacken)   hair  Haarnachzug (px)
#  af_w    Greifarm  as_w Schlagarm   ll_w/lr_w  Beine   eyes 0/1 (X)
#  gx/gy/gang  Gitarre (frei, relativ zur Ruhelage)
REST = dict(rx=0, ry=0, rot=0, head_w=0, hair=0, af_w=0, as_w=0, ll_w=0,
            lr_w=0, eyes=0, gx=0, gy=0, gang=0)
KEYS = {
    0: dict(),
    1: dict(rx=1, rot=3, head_w=16, hair=2, af_w=22, as_w=-22, gx=1, gang=3),
    2: dict(rx=2, rot=9, head_w=28, hair=3, af_w=55, as_w=-50, eyes=1,
            gx=3, gy=-4, gang=20),
    3: dict(rx=3, rot=14, head_w=34, hair=3, af_w=85, as_w=-80, eyes=1,
            ll_w=-4, lr_w=6, gx=6, gy=-9, gang=50),
    4: dict(rx=3, rot=20, head_w=38, hair=2, af_w=100, as_w=-105, eyes=1,
            ll_w=15, lr_w=8, gx=9, gy=-13, gang=90),
    6: dict(rx=3, rot=32, head_w=46, hair=1, af_w=80, as_w=-110, eyes=1,
            ll_w=28, lr_w=18, gx=15, gy=-15, gang=180),
    8: dict(rx=2, rot=46, head_w=55, af_w=60, as_w=-90, eyes=1,
            ll_w=44, lr_w=30, gx=20, gy=-9, gang=270),
    10: dict(rx=1, rot=62, head_w=68, af_w=50, as_w=-70, eyes=1,
             ll_w=58, lr_w=44, gx=23, gy=2, gang=350),
    12: dict(rx=0, rot=78, head_w=82, af_w=60, as_w=-50, eyes=1,
             ll_w=72, lr_w=60, gx=24, gy=-4, gang=372),
    13: dict(rx=0, rot=90, head_w=95, af_w=85, as_w=-30, eyes=1,
             ll_w=85, lr_w=78, gx=26, gy=2, gang=405),
    14: dict(rx=0, ry=3, rot=86, head_w=100, af_w=110, as_w=-10, eyes=1,
             ll_w=95, lr_w=72, gx=27, gy=-1, gang=405),
    15: dict(rx=0, rot=90, head_w=96, af_w=95, as_w=-40, eyes=1,
             ll_w=84, lr_w=80, gx=27, gy=2, gang=405),
    17: dict(rx=0, rot=90, head_w=100, af_w=95, as_w=-110, eyes=1,
             ll_w=84, lr_w=92, gx=27, gy=2, gang=405),
    22: dict(rx=0, rot=90, head_w=104, af_w=110, as_w=-240, eyes=1,
             ll_w=88, lr_w=96, gx=27, gy=2, gang=405),
}
LAST = 30
KEYS[LAST] = dict(KEYS[22])
IMPACT = 13


def ease(t, mode):
    if mode == 'in':
        return t * t
    if mode == 'out':
        return 1 - (1 - t) ** 2
    return t * t * (3 - 2 * t)


# Segment-Verläufe: Fall = beschleunigt (in), Rückstoß = schnell (out)
SEG = {(0, 1): 'out', (1, 2): 'out', (2, 3): 'io', (3, 4): 'io', (4, 6): 'io',
       (6, 8): 'in', (8, 10): 'in', (10, 12): 'in', (12, 13): 'in',
       (13, 14): 'out', (14, 15): 'in', (15, 17): 'io', (17, 22): 'io',
       (22, LAST): 'out'}


def state(i):
    ks = sorted(KEYS)
    a = max(k for k in ks if k <= i)
    b = min(k for k in ks if k >= i)
    A = dict(REST, **KEYS[a])
    B = dict(REST, **KEYS[b])
    if a == b:
        s = dict(A)
    else:
        t = ease((i - a) / (b - a), SEG.get((a, b), 'io'))
        s = {k: A[k] + (B[k] - A[k]) * t for k in REST}
        s['eyes'] = A['eyes'] if t < 0.5 else B['eyes']
    # Weltwinkel → Winkel relativ zum Elternteil (Rumpf)
    s['head'] = s['head_w'] - s['rot']
    s['arm_f'] = s['af_w'] - s['rot']
    s['arm_s'] = s['as_w'] - s['rot']
    s['leg_l'] = s['ll_w'] - s['rot']
    s['leg_r'] = s['lr_w'] - s['rot']
    return s


def frame(i, effects=True):
    s = state(i)
    body = render_body(s)
    # Füße/Körper stehen immer auf dem Boden (ry hebt ihn nur an: Hüpfer)
    d = (CH + M - 1) - lowest(body)
    body = shift(body, 0, d - int(round(s['ry'])))
    if i >= IMPACT:
        body = despeckle(body)
    g = render_guitar(s)
    if i >= 10:
        d = (CH + M - 1) - lowest(g)
        g = shift(g, 0, d - {11: 4, 12: 5, 14: 2}.get(i, 0))
    f = body
    over(f, g)
    if effects:
        if i >= IMPACT:
            dust(f, i - IMPACT, OX + 16)
        if 16 <= i < 27:
            stars(f, i - 16, OX + 27, CH - 22)
        if i <= 2:
            hit_spark(f, 3 - i, OX + 7 + i, OY + 10)
    fl = {0: 0.8, 1: 0.45, 2: 0.15}.get(i, 0)
    if fl:
        f = flash(f, fl)
    return crop(f)


def build_frames():
    frames = [frame(i) for i in range(LAST + 1)]
    frames[-1] = frame(LAST, effects=False)       # Leiche: ohne Staub/Sterne
    return frames


def save_all(frames):
    n = len(frames)
    Image.fromarray(np.concatenate(frames, axis=1)).save('elana_death_sheet.png')
    Image.fromarray(frames[-1]).save('elana_corpse.png')
    sc, per = 5, 8
    rows = (n + per - 1) // per
    cs = Image.new('RGBA', (per * CW * sc, rows * CH * sc), (60, 60, 90, 255))
    for k, f in enumerate(frames):
        im = Image.fromarray(f).resize((CW * sc, CH * sc), Image.NEAREST)
        cs.alpha_composite(im, ((k % per) * CW * sc, (k // per) * CH * sc))
    cs.save('elana_death_contact.png')
    gifs = []
    for f in frames:
        im = Image.fromarray(f).resize((CW * 8, CH * 8), Image.NEAREST)
        b = Image.new('RGBA', im.size, (40, 30, 70, 255))
        b.alpha_composite(im)
        gifs.append(b.convert('RGB'))
    gifs[0].save('elana_death.gif', save_all=True, append_images=gifs[1:],
                 duration=MS, loop=0, disposal=2)


def write_meta(n):
    """JSON für das Brett: größere Leinwand als das Idle, daher `faceX`/
    `footY`/pad*, damit die stehende Figur deckungsgleich mit dem Idle
    liegt. `loop: false` – der letzte Frame ist die Leiche."""
    return {
        'hero': 'Elana, the Rocky Rebel',
        'kind': 'death',
        'sheet': 'elana-the-rocky-rebel.png',
        'corpse': 'elana-the-rocky-rebel-corpse.png',
        'frameWidth': CW, 'frameHeight': CH, 'frames': n,
        'frameMs': MS, 'loop': False, 'layout': 'horizontal',
        'padTop': OY, 'padLeft': OX, 'padRight': CW - OX - W0, 'padBottom': 0,
        'faceX': OX + 9.5, 'footY': OY + H0,
        'startsFromIdleFrame': 0,
    }


def install(frames):
    import json
    import os
    out = '../../data/hero-animations/death'
    os.makedirs(out, exist_ok=True)
    Image.fromarray(np.concatenate(frames, axis=1)).save(out + '/elana-the-rocky-rebel.png')
    Image.fromarray(frames[-1]).save(out + '/elana-the-rocky-rebel-corpse.png')
    with open(out + '/elana-the-rocky-rebel.json', 'w', encoding='utf-8') as fh:
        json.dump(write_meta(len(frames)), fh, ensure_ascii=False, indent=2)
        fh.write('\n')


if __name__ == '__main__':
    frames = build_frames()
    save_all(frames)
    if 'install' in sys.argv:
        install(frames)
    print('frames', len(frames))
