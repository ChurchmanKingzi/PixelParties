# -*- coding: utf-8 -*-
"""Idle-Animation für Styx, the Gate to the Spirit World (42x38 -> 42x40).

Styx schwebt: Der ganze Körper gleitet auf einer Sinuskurve (3 Stufen),
Saum und Geisterhände folgen verzögert. Dazu Detail-Animationen, die pro
Frame in eine modifizierte Quelle gezeichnet werden:
  * Energie-Impulse laufen die gepunkteten Fäden entlang zu den Händen
  * Finger-Tentakel wogen (Welle läuft nach unten)
  * Portal: Glühen pulsiert von innen nach außen, Seelen steigen auf,
    die Portal-Augen blinzeln einmal pro Loop
  * Kapuzenauge glüht langsam auf und ab
Die Leinwand bekommt oben und unten je 1 px Rand, damit das Schweben
nicht abgeschnitten wird.
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/styx-the-gate-to-the-spirit-world.png').convert('RGBA'))
H0, W = BASE.shape[:2]
PAD = 1
H = H0 + 2 * PAD
N = 32


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


CLEAR = (0, 0, 0, 0)
BLACK = rgb('000100')
# Violett-Leiter dunkel -> hell
PURPLE = [rgb('16062e'), rgb('220947'), rgb('2a0c58'), rgb('481496'), rgb('691edd'), rgb('9d63ff')]
K, L, M, I, J, GLOW = PURPLE
# Rot-Leiter dunkel -> hell (letzte Stufe = Glüh-Highlight)
RED = [rgb('3e0000'), rgb('5b0000'), rgb('960000'), rgb('c81010')]


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


def step(ladder, c, d):
    """Farbe c auf der Leiter um d Stufen verschieben (geklemmt)."""
    if c not in ladder:
        return c
    k = max(0, min(len(ladder) - 1, ladder.index(c) + d))
    return ladder[k]


def wave(i, period, lag=0.0):
    return math.sin(2 * math.pi * ((i - lag) / period))


# ---------------------------------------------------------------- Regionen
ARC_L = [(9, 12), (8, 13), (7, 15), (6, 17), (5, 19), (5, 21), (5, 22), (4, 22)]
ARC_R = [(32, 12), (33, 13), (34, 15), (35, 17), (36, 19), (36, 21), (36, 22), (37, 22)]


def claw_pixels(xs):
    return {(x, y) for y in range(23, 31) for x in xs if BASE[y, x][3]}


CLAW_L = claw_pixels(range(0, 9))
CLAW_R = claw_pixels(range(33, 42))

HOOD_EYE = [(20, 5), (21, 5), (20, 6), (21, 6)]
PORTAL = [(x, y) for y in range(15, 22) for x in range(18, 24)]
PORTAL_EYES = [(20, 15), (22, 15)]
SOULS_ORIG = [(19, 19), (21, 20)]
PORTAL_CENTER = (20.5, 17.5)


# ---------------------------------------------------------------- Timing
def hover(i, lag=0):
    """-1 (oben) / 0 / +1 (unten); steigt zuerst."""
    return -round(wave(i, N, lag))


def zone_lag(x, y):
    """Verzögerung des Schwebens pro (Quell-)Pixel."""
    side = x <= 8 or x >= 33
    if side:
        if y >= 23:
            return 2          # Geisterhände
        if y >= 18:
            return 1          # untere Fäden
        return 0
    if y >= 33:
        return 2              # Saumspitzen
    if y >= 29:
        return 1              # Saum
    return 0


def finger_dx(y, i, mirror):
    """Wogende Finger: Welle läuft nach unten, Amplitude wächst zur Spitze."""
    if y < 25:
        return 0
    amp = min(1.0, (y - 24) / 3)
    v = round(amp * wave(i, 16, (y - 24) * 1.6))
    return -v if mirror else v


def arc_colors(i, arc):
    """Impuls wandert die Fadenpunkte entlang (2 Frames pro Punkt)."""
    head = (i // 2) % 16          # 8 Punkte + 8 Frames Pause pro Sweep
    cols = []
    for k, p in enumerate(arc):
        c = px(BASE, *p)
        if k == head:
            c = GLOW
        elif k == head - 1:
            c = step(PURPLE, c, 1)
        cols.append(c)
    return cols


def claw_glow(i):
    """Hände leuchten kurz auf, wenn der Impuls ankommt."""
    head = (i // 2) % 16
    return 1 if head == 8 else 0


def portal_glow(x, y, i):
    """Glühen strahlt vom Zentrum nach außen (Periode 16)."""
    dist = math.hypot(x - PORTAL_CENTER[0], (y - PORTAL_CENTER[1]) * 0.8)
    ring = 0 if dist < 1.3 else (1 if dist < 2.4 else 2)
    t = (i - ring * 1.5) % 16
    return 1 if t < 6 else 0


def soul_positions(i):
    """Zwei Seelen steigen im Portal auf (2 Frames pro Zeile)."""
    out = []
    for col, offset in ((19, 0), (21, 8)):
        t = (i + offset) % 16
        k = t // 2                  # 0..7
        if k < 6:
            y = 21 - k
            fade = [0, 1, 2, 2, 1, 0][k]
            out.append(((col, y), RED[fade]))
    return out


def hood_glow(i):
    """-1 / 0 / +1 Helligkeit des Kapuzenauges."""
    return round(wave(i, N, -N / 4))


def portal_blink(i):
    return i in (26, 27)


# Unterleib-Tentakel -------------------------------------------------------
# Außententakel biegen sich als Ganzes (Auslenkung wächst zur Spitze, leichte
# Verzögerung entlang der Länge = Peitscheneffekt). Innententakel: nur die
# freien Spitzen (Zeilen 33-34) schlackern. Jeder Tentakel hat eigene Phase.
# (x0, x1, erste bewegte Zeile, Länge, max. Auslenkung, Phase)
TENTACLES = [
    (9, 15, 30, 8, 2.0, 0.0),        # außen links
    (26, 32, 30, 8, 2.0, 2.2),       # außen rechts
    (16, 18, 33, 2, 1.2, 1.1),       # innen
    (19, 20, 33, 2, 1.2, 3.0),
    (21, 23, 33, 2, 1.2, 4.4),
    (24, 25, 33, 2, 1.2, 5.5),
]


def tentacle_dx(y, i, y0, length, amp, phase):
    u = (y - y0 + 1) / length                      # 0..1 entlang des Tentakels
    if u <= 0:
        return 0
    theta = 2 * math.pi * i / 16 - 0.45 * (y - y0) + phase
    return round(amp * min(1.0, u) ** 1.4 * math.sin(theta))


def wobble_tentacles(a, i):
    """Rückwärts-Mapping pro Tentakel-Band und Zeile."""
    src = a.copy()
    for x0, x1, y0, length, amp, phase in TENTACLES:
        for y in range(y0, H0):
            dx = tentacle_dx(y, i, y0, length, amp, phase)
            if dx == 0:
                continue
            for x in range(x0, x1 + 1):
                sx = x - dx
                a[y, x] = src[y, sx] if x0 <= sx <= x1 or y < 33 else CLEAR
    return a


# ---------------------------------------------------------------- Aufbau
def source(i):
    a = BASE.copy()

    # Portal: Seelen entfernen, Glühen, Augen, neue Seelen
    for x, y in SOULS_ORIG:
        a[y, x] = K
    for x, y in PORTAL:
        c = px(a, x, y)
        if c in (K, L, M):
            a[y, x] = step(PURPLE, c, portal_glow(x, y, i))
    for x, y in PORTAL_EYES:
        a[y, x] = K if portal_blink(i) else RED[2]
    for (x, y), c in soul_positions(i):
        a[y, x] = c

    # Kapuzenauge
    g = hood_glow(i)
    for x, y in HOOD_EYE:
        a[y, x] = step(RED, px(BASE, x, y), g)

    # Finger + Handleuchten
    glow = claw_glow(i)
    for pts, mirror in ((CLAW_L, False), (CLAW_R, True)):
        cols = {p: step(PURPLE, px(BASE, *p), glow) for p in pts}
        for x, y in pts:
            a[y, x] = CLEAR
        for (x, y), c in cols.items():
            nx = x + finger_dx(y, i, mirror)
            if 0 <= nx < W:
                a[y, nx] = c

    # Energie-Fäden
    for arc in (ARC_L, ARC_R):
        for (x, y), c in zip(arc, arc_colors(i, arc)):
            a[y, x] = c

    wobble_tentacles(a, i)
    return a


def frame(i):
    s = source(i)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    for y in range(H):
        for x in range(W):
            zy = min(max(y - PAD, 0), H0 - 1)
            dy = hover(i, zone_lag(x, zy))
            sy = y - PAD - dy
            if 0 <= sy < H0:
                out[y, x] = s[sy, x]
    return out


frames = [frame(i) for i in range(N)]


def save_gif(path, scale, ms, bg):
    imgs = []
    for f in frames:
        im = Image.fromarray(f).resize((W * scale, H * scale), Image.NEAREST)
        base = Image.new('RGBA', im.size, bg)
        base.alpha_composite(im)
        imgs.append(base.convert('RGB'))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms,
                 loop=0, disposal=2, optimize=False)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    save_gif(f'styx_idle_{tag}.gif', 10, ms, (40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'styx_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
