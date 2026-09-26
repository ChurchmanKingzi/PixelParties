# -*- coding: utf-8 -*-
"""Idle-Animation für Reiza, the Chief Tormentor (54x42).

* Peitsche als Seil: pendelt träge (Welle läuft zur Spitze), einmal pro Loop
  ein schneller Schnalzer mit Funken an der Spitze. Wird jeden Frame neu
  gerastert (Farbe entlang der Peitsche wie im Original).
* Dämonenflügel schlagen langsam, Biegung wächst zu den Spitzen.
* Wippen im Flügeltakt (bis 2 px Hub) aus den Knien, Füße bleiben am Boden;
  Kopf, Haarsträhnen und Brüste schwingen nach.
* Mimik: Blinzeln, breiteres sadistisches Grinsen, kurzes Lachen.
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/reiza-the-chief-tormentor.png').convert('RGBA')).astype(int)
H, W = BASE.shape[:2]
N = 48
CLEAR = (0, 0, 0, 0)


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def wave(i, period, phase=0.0):
    return math.sin(2 * math.pi * i / period + phase)


# ---------------------------------------------------------------- Peitsche
HANDLE = [(18, 24), (19, 24), (18, 25), (19, 25)]
ROPE = [(17, 24), (16, 24), (15, 24), (14, 24), (13, 24), (12, 24), (11, 25), (10, 25),
        (9, 26), (8, 27), (7, 28), (7, 29), (6, 30), (6, 31), (5, 32), (5, 33), (5, 34)]
ROPE_COL = [tuple(BASE[y, x]) for x, y in ROPE]
SPARK = [rgb('ffffff'), rgb('ffd6e0'), rgb('e7c3c3')]
CRACK_START = 30          # Frame, in dem der Schnalzer am Griff startet
CRACK_LEN = 8


def rope_points(i, anchor_dy):
    pts = []
    n = len(ROPE)
    for k, (x, y) in enumerate(ROPE):
        s = (k + 1) / n                                     # 0 Griff .. 1 Spitze
        env = s ** 1.3
        # trages Pendeln + Welle zur Spitze
        ox = 2.2 * env * wave(i, N, -3.2 * s)
        oy = 1.3 * env * wave(i, N, -3.2 * s + 1.4)
        # Schnalzer: Impuls läuft in CRACK_LEN Frames vom Griff zur Spitze
        t = (i - CRACK_START) % N
        if t < CRACK_LEN + 2:
            front = t / CRACK_LEN
            pulse = math.exp(-((s - front) ** 2) / 0.02)
            ox += 2.6 * pulse * env ** 0.5
            oy -= 2.0 * pulse * env ** 0.5
        pts.append((x + ox, y + oy + anchor_dy * (1 - s)))
    return pts


def draw_line(out, p0, p1, col):
    x0, y0 = int(round(p0[0])), int(round(p0[1]))
    x1, y1 = int(round(p1[0])), int(round(p1[1]))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        if 0 <= x0 < W and 0 <= y0 < H:
            out[y0, x0] = col
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def draw_whip(out, i, body_dy):
    for x, y in HANDLE:
        out[y + body_dy, x] = BASE[y, x]
    prev = (HANDLE[0][0] - 0.0, HANDLE[0][1] + body_dy)
    pts = rope_points(i, body_dy)
    for k, p in enumerate(pts):
        draw_line(out, prev, p, ROPE_COL[k])
        prev = p
    t = (i - CRACK_START) % N
    if CRACK_LEN - 1 <= t <= CRACK_LEN + 1:          # Funken an der Spitze
        tx, ty = int(round(pts[-1][0])), int(round(pts[-1][1]))
        k = t - (CRACK_LEN - 1)
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)) if k < 2 else ((-1, -1), (1, 1)):
            if 0 <= tx + dx < W and 0 <= ty + dy < H:
                out[ty + dy, tx + dx] = SPARK[min(k, 2)]


# ---------------------------------------------------------------- Mimik
SKIN = rgb('d5a2a1')
SKIN_L = rgb('e7c3c3')
LASH = rgb('000000')
MOUTH = rgb('2d0e13')
TEETH = rgb('f6ffff')


def expression(i):
    t = i % N
    if t in (8, 9) or t in (40,):
        return 'blink'
    if 20 <= t < 30:
        return 'grin'
    if 30 <= t < 34:
        return 'laugh'
    return 'normal'


def apply_face(a, i):
    e = expression(i)
    if e == 'blink':
        for x in (25, 26, 29, 30):
            a[17, x] = SKIN
            a[18, x] = LASH
    elif e in ('grin', 'laugh'):
        # Augen bleiben unverändert; Grinsen wird breiter, Eckzahn blitzt
        a[21, 26] = TEETH
        a[21, 29] = TEETH
        if e == 'laugh':
            a[22, 27] = MOUTH                       # Mund öffnet sich
            a[22, 28] = MOUTH


# ---------------------------------------------------------------- Körper
FLAP_PERIOD = N / 2


def hover(i, lag=0.0):
    """Schweben: bis 2 px Hub im Takt der Flügel (hebt sich beim Abschlag)."""
    return int(round(1.3 * wave(i - lag, FLAP_PERIOD, math.pi / 2 + 0.6)))


def flap(x, i):
    """Flügel: Auslenkung wächst vom Ansatz zu den Spitzen (bis 2.5 px)."""
    w = max(0.0, min(1.0, (abs(x - 27) - 7) / 17)) ** 1.2
    return int(round(-2.5 * w * wave(i, FLAP_PERIOD, -1.2 * w)))


def chest_dy(i):
    """Brüste folgen dem Oberkörper 1 Frame später und schwingen 1 px über."""
    d = hover(i, 1)
    d += hover(i, 1) - hover(i, 2)
    return d


def zone(x, y):
    if y >= 31:
        return 'feet'                            # Füße bleiben immer am Boden
    if y >= 29:
        return 'legs'
    if 24 <= x <= 31 and 24 <= y <= 27:
        return 'chest'
    if (x <= 20 or x >= 34) and y <= 25:
        return 'wing'
    if y <= 9:
        return 'hairtop'
    if y <= 23:
        return 'head'
    return 'torso'


def hair_dx(x, y, i):
    """Seitliche Haarsträhnen schwingen an den Spitzen."""
    if 18 <= y <= 22 and (21 <= x <= 23 or 31 <= x <= 33):
        amp = (y - 17) / 5
        return int(round(amp * 1.0 * wave(i, FLAP_PERIOD, 0.8 + (0.6 if x > 27 else 0))))
    return 0


WHIP_PX = set(HANDLE) | set(ROPE)


def frame(i):
    src = BASE.copy()
    for x, y in WHIP_PX:
        src[y, x] = CLEAR
    apply_face(src, i)
    out = np.zeros_like(src)
    for y in range(H):
        for x in range(W):
            z = zone(x, y)
            if z == 'feet':
                dx, dy = 0, 0
            elif z == 'legs':
                dx, dy = 0, int(round(hover(i, 1) / 2))  # Knie federn halb mit
            elif z == 'wing':
                dx, dy = 0, hover(i) + flap(x, i)
            elif z == 'chest':
                dx, dy = 0, chest_dy(i)
            elif z == 'hairtop':
                dx, dy = 0, hover(i, 2)
            elif z == 'head':
                dx, dy = hair_dx(x, y, i), hover(i, 1)
            else:
                dx, dy = 0, hover(i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H:
                out[y, x] = src[sy, sx]
    draw_whip(out, i, hover(i))
    return out


frames = [frame(i) for i in range(N)]

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    imgs = []
    for f in frames:
        im = Image.fromarray(f.astype(np.uint8)).resize((W * 8, H * 8), Image.NEAREST)
        b = Image.new('RGBA', im.size, (40, 30, 70, 255))
        b.alpha_composite(im)
        imgs.append(b.convert('RGB'))
    imgs[0].save(f'reiza_idle_{tag}.gif', save_all=True, append_images=imgs[1:],
                 duration=ms, loop=0, disposal=2, optimize=False)
    Image.fromarray(np.concatenate(frames, axis=1).astype(np.uint8)).save(f'reiza_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
