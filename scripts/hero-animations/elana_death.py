# -*- coding: utf-8 -*-
"""Todesanimation + Leiche für Elana, the Rocky Rebel (Idle: 25x25).

Ablauf (siehe `PLAN`):
  Treffer-Blitz mit Funken → Rückstoß (Oberkörper kippt nach hinten,
  X-Augen) → Gitarre fliegt aus den Händen und dreht sich durch die Luft →
  Knie knicken ein → Elana kippt nach hinten um (Drehung um die Hüfte, das
  tiefste Pixel liegt immer auf dem Boden) → Aufprall, kleiner Hüpfer,
  Staubwolke, Gitarre prallt zweimal auf und bleibt liegen → Sternchen
  kreisen kurz → Leiche (Gitarre daneben).

Startpose = Idle-Frame 0 des Hero-Sheets. Der erste Frame ist ein
Treffer-Blitz, der den Wechsel aus jedem beliebigen Idle-Frame überdeckt.

Die Leinwand ist größer als das Idle-Sprite (`OX`/`OY` = Lage des
stehenden Sprites); `faceX`/`footY` im JSON halten die stehende Figur
deckungsgleich mit dem Idle auf dem Brett.

Aufruf (aus diesem Ordner):  python3 elana_death.py
Ausgabe (Arbeitsdateien): elana_death_sheet.png, elana_death.gif,
elana_corpse.png, elana_death_contact.png.
"""
import math
from PIL import Image
import numpy as np

IDLE = '../../data/hero-animations/elana-the-rocky-rebel.png'
W0 = H0 = 25
OX, OY = 6, 9            # Lage des stehenden Sprites in der Leinwand
CW, CH = 62, OY + H0     # Leinwand; Boden = untere Kante (y = CH)
M = 26                   # Rand der Arbeitsleinwand (für Drehungen)
MS = 70

_idle = np.array(Image.open(IDLE).convert('RGBA'))
BASE = _idle[:, 0:W0].copy()


def rgb(h, a=255):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


NECK = {25: rgb('3e3832'), 26: rgb('acb1b3'), 27: rgb('66514a'),
        28: rgb('acb1b3'), 29: rgb('3e3832')}
HAND = {(99, 48, 7), (193, 146, 92), (248, 188, 119)}
SHIRT = rgb('12181b')
BLACK = rgb('000000')


def cols(c):
    return tuple(int(v) for v in c[:3])


# ------------------------------------------------------------------ Teile
def split_parts(base):
    """Gitarre (Hals, Korpus, beide Hände) vom Körper trennen."""
    guitar = np.zeros((H0, W0), bool)
    for y in range(H0):
        for x in range(W0):
            c = base[y, x]
            if c[3] == 0:
                continue
            if c[1] > c[0] and c[1] > c[2] and x < 17:      # Haare bleiben
                continue
            red = c[0] > 140 and c[1] < 70 and c[2] < 70
            band = x >= 8 and 24 <= x + y <= 31
            korpus = x >= 11 and 15 <= y <= 21 and (
                red or sum(int(v) for v in c[:3]) < 90 or band)
            dunkel = x >= 14 and y >= 14
            if band or korpus or dunkel or (
                    8 <= x <= 11 and 15 <= y <= 18 and cols(c) in HAND):
                guitar[y, x] = True
    body = base.copy()
    body[guitar] = 0
    gtr = base.copy()
    gtr[~guitar] = 0
    # Loch im Körper schließen: dunkles Hemd hinter Schlaghand/Korpus
    for y in range(14, 21):
        for x in range(8, 14):
            if guitar[y, x] and body[y, x, 3] == 0:
                body[y, x] = SHIRT if x < 13 else BLACK
    # Hals unter der Greifhand auffüllen (Streifen nach x+y)
    for y in range(3, 14):
        for x in range(14, 25):
            if base[y, x, 3] and cols(base[y, x]) in HAND and (x + y) in NECK:
                gtr[y, x] = NECK[x + y]
    return body, gtr


BODY, GUITAR = split_parts(BASE)


# ------------------------------------------------------------ Hilfsfunktionen
def canvas():
    """Arbeitsleinwand: Leinwand + Rand M rundum."""
    return np.zeros((CH + 2 * M, CW + 2 * M, 4), np.uint8)


def put(dst, src, ox, oy):
    """src per Alpha an Leinwandposition (ox, oy) auf dst legen."""
    ys, xs = np.nonzero(src[..., 3])
    for y, x in zip(ys, xs):
        X, Y = x + ox + M, y + oy + M
        if 0 <= X < dst.shape[1] and 0 <= Y < dst.shape[0]:
            dst[Y, X] = src[y, x]


def over(dst, src):
    """Arbeitsebene src (gleiche Größe) über dst legen."""
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


def flash(img, amt):
    out = img.astype(np.float32)
    m = out[..., 3] > 0
    out[..., :3][m] = out[..., :3][m] + (255 - out[..., :3][m]) * amt
    return out.astype(np.uint8)


def shear_lean(img, lean, hip_y=19):
    """Oberkörper (über der Hüfte) nach rechts kippen: Zeilen oberhalb der
    Hüfte wandern proportional zur Höhe nach rechts (Zeilen bleiben ganz)."""
    out = np.zeros_like(img)
    for y in range(img.shape[0]):
        k = int(round(lean * (hip_y - y) / hip_y)) if y < hip_y else 0
        for x in np.nonzero(img[y, :, 3])[0]:
            if 0 <= x + k < img.shape[1]:
                out[y, x + k] = img[y, x]
    return out


def sink(img, d, hip_y=19):
    """Knie knicken ein: Oberkörper d Pixel nach unten, Beine (ab Hüfte) um
    d Zeilen gestaucht (die Zeilen direkt unter der Hüfte fallen weg)."""
    if d == 0:
        return img.copy()
    out = np.zeros_like(img)
    legs = img[hip_y + 1:]
    keep = legs[d:] if d < len(legs) else legs[-1:]
    out[d:hip_y + 1 + d] = img[:hip_y + 1]
    out[hip_y + 1 + d:hip_y + 1 + d + len(keep)] = keep
    return out


X_EYE = rgb('3b0040')


def x_eyes(img):
    """X-Augen auf das Visier (Pixel nur dort, wo Gesicht ist)."""
    for (x, y) in ((6, 9), (8, 9), (7, 10), (6, 11), (8, 11)):
        if img[y, x, 3]:
            img[y, x] = X_EYE
    return img


def rest_on_ground(layer):
    """Ebene so senken/heben, dass ihr tiefstes Pixel auf dem Boden liegt."""
    ys = np.where(layer[..., 3].any(axis=1))[0]
    d = (CH + M - 1) - ys.max()
    return np.roll(layer, d, axis=0), d


def despeckle(lay):
    """Einzelne Pixel ohne Nachbarn (Reste der Stauchung) entfernen."""
    a = lay[..., 3] > 0
    p = np.pad(a, 1)
    n = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx]
            for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0))
    lay[a & (n == 0)] = 0
    return lay


def crop(layer):
    return layer[M:M + CH, M:M + CW].copy()


# ------------------------------------------------------------ Effekte
DUST = rgb('cdbd9f')
DUST2 = rgb('968873')


def dust(dst, t, cx):
    """Staubwolke ab Aufprall (t = Frames seit Aufprall) am Boden um cx."""
    if t < 0:
        return
    rng = np.random.RandomState(7)
    for k in range(20):
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
    """Sternchen kreisen über dem Kopf (t = Frames seit Ende des Falls)."""
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
    """Kleiner Trefferstern (Kreuz + Diagonalen) auf dem Gesicht."""
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


# ------------------------------------------------------------ Gitarre
GTR_PIV = (18.0, 12.0)        # Drehpunkt in Sprite-Koordinaten
# (dx, dy, Winkel): Wurf, Fall, 1. Aufprall, Hüpfer, 2. Aufprall, Ruhe
GUITAR_PATH = [
    (0, 0, 0), (3, -3, 12), (6, -7, 35), (9, -11, 70), (12, -14, 110),
    (15, -15, 155), (18, -14, 200), (20, -10, 245), (22, -4, 290),
    (23, 2, 330),                      # Aufprall 1 (Boden)
    (24, -4, 352), (25, -5, 372), (26, -2, 392),
    (27, 2, 405),                      # Aufprall 2
    (27, 0, 405), (27, 2, 405),        # kleiner Nachhüpfer, Ruhe
]
GUITAR_HOP = {10: 5, 11: 7, 12: 3, 14: 1}


def guitar_layer(step):
    i = min(step, len(GUITAR_PATH) - 1)
    dx, dy, ang = GUITAR_PATH[i]
    lay = canvas()
    put(lay, GUITAR, OX + dx, OY + dy)
    lay = rotate(lay, ang, (OX + dx + GTR_PIV[0], OY + dy + GTR_PIV[1]))
    if i >= 9:                         # ab Aufprall: auf den Boden setzen
        lay, _ = rest_on_ground(lay)
        if i in GUITAR_HOP:
            lay = np.roll(lay, -GUITAR_HOP[i], axis=0)
    return lay


# ------------------------------------------------------------ Körper
def pose(lean, sink_d, eyes):
    b = BODY.copy()
    if eyes:
        x_eyes(b)
    return shear_lean(sink(b, sink_d), lean)


def squash(lay, f):
    """Vertikal auf f stauchen (am Boden verankert, Zeilen fallen weg) –
    Aufprall-Splat und flach liegende Leiche."""
    if f >= 1:
        return lay
    ys = np.where(lay[..., 3].any(axis=1))[0]
    y0, y1 = ys.min(), ys.max()
    h = y1 - y0 + 1
    h2 = max(1, int(round(h * f)))
    out = np.zeros_like(lay)
    for j in range(h2):
        out[y1 - (h2 - 1 - j)] = lay[y0 + int(j * h / h2)]
    return out


def body_layer(lean, sink_d, tilt, eyes=True, hop=0, flop=0, sq=1.0):
    """Körper auf der Arbeitsleinwand. Kopf, Rumpf und Beine werden getrennt
    um die Hüfte gedreht. Liegt sie (tilt ≥ 84), legt sich jedes Teil mit
    seiner Unterkante auf den Boden (flache Silhouette statt schiefem
    Klotz); die Beine federn nach dem Aufprall noch einmal hoch (`flop`)."""
    p = pose(lean, sink_d, eyes)
    cut1 = 14 + sink_d * 0          # Kopf | Rumpf
    cut2 = 19 + sink_d + 1          # Rumpf | Beine
    parts = []
    for (y0, y1) in ((0, cut1), (cut1, cut2), (cut2, p.shape[0])):
        lay = canvas()
        put(lay, p[y0:y1], OX, OY + y0)
        parts.append(lay)
    if tilt:
        piv = (OX + 8.5 - lean * 0.25, OY + 19 + sink_d * 0.5)
        parts = [rotate(parts[0], tilt, piv), rotate(parts[1], tilt, piv),
                 rotate(parts[2], tilt + flop, piv)]
        if tilt >= 84:
            parts = [rest_on_ground(q)[0] if q[..., 3].any() else q for q in parts]
        else:
            both = canvas()
            over(both, parts[0])
            over(both, parts[1])
            _, d = rest_on_ground(both)
            parts = [np.roll(q, d, axis=0) for q in parts]
    lay = parts[2]
    over(lay, parts[1])
    over(lay, parts[0])
    lay = squash(lay, sq) if tilt >= 90 or sq < 1 else lay
    if tilt >= 84:
        lay = despeckle(lay)
    if hop:
        lay = np.roll(lay, -hop, axis=0)
    return lay


FLOP = {13: 0, 14: 14, 15: 22, 16: 16, 17: 10, 18: 6}
SQUASH = {13: 0.78, 14: 0.92, 15: 0.84}   # Stauchung beim Aufprall; danach REST_SQUASH
REST_SQUASH = 0.86


# ------------------------------------------------------------------ Plan
#  (Blitz, Lehnen, Einsinken, Kippwinkel, Gitarre, Augen, Hop)
#  Gitarre None = noch in der Hand (folgt dem Rückstoß)
PLAN = [
    (0.80, 0, 0, 0, None, False, 0),
    (0.45, 1, 0, 0, None, False, 0),
    (0.15, 2, 0, 0, None, True, 0),
    (0.00, 3, 0, 0, 0, True, 0),
    (0.00, 3, 0, 0, 1, True, 0),
    (0.00, 3, 1, 0, 2, True, 0),
    (0.00, 4, 2, 0, 3, True, 0),
    (0.00, 6, 3, 6, 4, True, 0),
    (0.00, 6, 3, 16, 5, True, 0),
    (0.00, 6, 3, 30, 6, True, 0),
    (0.00, 6, 3, 46, 7, True, 0),
    (0.00, 6, 3, 64, 8, True, 0),
    (0.00, 6, 3, 80, 9, True, 0),
    (0.00, 6, 3, 90, 10, True, 0),      # Aufprall (Körper)
    (0.00, 6, 3, 86, 11, True, 2),      # Hüpfer
    (0.00, 6, 3, 90, 12, True, 1),
    (0.00, 6, 3, 90, 13, True, 0),
    (0.00, 6, 3, 90, 14, True, 0),
    (0.00, 6, 3, 90, 15, True, 0),
] + [(0.00, 6, 3, 90, 15, True, 0)] * 9
IMPACT = 13
FALL_END = 16


def build_frames(corpse=False):
    frames = []
    for i, (fl, lean, snk, tilt, gs, eyes, hop) in enumerate(PLAN):
        f = body_layer(lean, snk, tilt, eyes, hop, FLOP.get(i, 6 if i > 18 else 0),
                       SQUASH.get(i, REST_SQUASH if i > 15 else 1.0))
        if gs is None:                      # Gitarre noch in der Hand
            g = canvas()
            put(g, GUITAR, OX + lean // 2, OY)
        else:
            g = guitar_layer(gs)
        over(f, g)
        if not corpse:
            if i >= IMPACT:
                dust(f, i - IMPACT, OX + 14)
            if FALL_END - 1 <= i < FALL_END + 11:
                stars(f, i - (FALL_END - 1), OX + 25, CH - 20)
            if i <= 2:
                hit_spark(f, 3 - i, OX + 7 + i, OY + 10)
        if fl:
            f = flash(f, fl)
        frames.append(crop(f))
    return frames


def save_all(frames):
    n = len(frames)
    Image.fromarray(np.concatenate(frames, axis=1)).save('elana_death_sheet.png')
    Image.fromarray(frames[-1]).save('elana_corpse.png')
    sc, per = 6, 6
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
    import sys
    frames = build_frames()
    frames[-1] = build_frames(corpse=True)[-1]   # Leiche: ohne Staub/Sterne
    save_all(frames)
    if 'install' in sys.argv:
        install(frames)
    print('frames', len(frames))
