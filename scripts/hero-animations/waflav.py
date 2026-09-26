# -*- coding: utf-8 -*-
"""Idle-Animation für Swampborne Waflav (84x52 + 4 px Rand oben = 84x56).

Ebenen (hinten -> vorne):
  1. Kreatur: schwere Flügelschläge (Spitzen hängen nach), Körper hebt sich
     beim Abschlag, Schleimfäden dehnen sich, Tropfen fallen, Schleimblasen
     blubbern und platzen, Augen glühen pulsierend und blinzeln.
  2. Giftgas (80 % Deckkraft, wie im Original): brodelt durch eine weiche
     Verzerrung, kleine Gaswölkchen lösen sich oben, steigen auf und vergehen.
Das Gas wird aus dem Original herausgelöst: wo es die Kreatur überdeckt,
wird die 80/20-Mischung zurückgerechnet und auf die Gaspalette gerundet.
"""
import math
import sys
from PIL import Image
import numpy as np

PAD_TOP = 4                    # Platz für aufsteigende Gaswölkchen
GAS_IMG = np.array(Image.open('src/swampborne-waflav.png').convert('RGBA')).astype(int)
GAS_IMG = np.concatenate([np.zeros((PAD_TOP, GAS_IMG.shape[1], 4), int), GAS_IMG])
REF = np.array(Image.open('src/swampborne-waflav-ohne-gas.png').convert('RGBA')).astype(int)
H, W = GAS_IMG.shape[:2]
N = 32
OFF_X, OFF_Y = -1, 11 + PAD_TOP    # Referenz (ohne Gas) -> Leinwand
GAS_A = 204

OUTLINE = (38, 25, 64)
DARK = (64, 42, 108)
MID = (87, 57, 147)
LIGHT = (125, 94, 187)
GAS_PAL = [OUTLINE, DARK, MID, LIGHT]
EYE = (0, 255, 11)

# ---------------------------------------------------------------- Ebenen trennen
CRE = np.zeros_like(GAS_IMG)
for y in range(REF.shape[0]):
    for x in range(REF.shape[1]):
        gy, gx = y + OFF_Y, x + OFF_X
        if 0 <= gy < H and 0 <= gx < W:
            CRE[gy, gx] = REF[y, x]

GAS = np.zeros_like(GAS_IMG)
for y in range(H):
    for x in range(W):
        g = GAS_IMG[y, x]
        c = CRE[y, x]
        if (g == c).all():
            continue
        if g[3] == GAS_A:
            GAS[y, x] = g
        else:                    # über der Kreatur eingemischt: zurückrechnen
            k = GAS_A / 255
            raw = (g[:3] - (1 - k) * c[:3]) / k
            best = min(GAS_PAL, key=lambda p: sum((raw[j] - p[j]) ** 2 for j in range(3)))
            GAS[y, x] = (*best, GAS_A)


def wave(i, period=N, phase=0.0):
    return math.sin(2 * math.pi * i / period + phase)


# ---------------------------------------------------------------- Kreatur
CX = 41.5                       # Körpermitte


def wing_weight(x):
    return max(0.0, min(1.0, (abs(x - CX) - 7) / 32)) ** 1.3


def flap_dy(x, i):
    """Flügel: Spitzen schwingen bis 3 px, mit Verzögerung zur Spitze hin."""
    w = wing_weight(x)
    return int(round(3.0 * w * wave(i, N, -1.3 * w)))


def body_bob(i):
    """Körper hebt sich, wenn die Flügel nach unten schlagen."""
    return int(round(-0.9 * wave(i, N, -0.6)))


BOTTOM = [max([y for y in range(H) if CRE[y, x, 3] > 0], default=-1) for x in range(W)]
FRINGE = 4                      # so viele Zeilen hängen unten als Schleimfaden
PHI = [((x * 37) % 17) / 17 * 2 * math.pi for x in range(W)]


def drip_stretch(x, i):
    return 1.0 + 0.3 * max(0.0, wave(i, 16, PHI[x]))


def stretch_fringe(a, i):
    """Schleimfäden unten an jeder Spalte dehnen sich rhythmisch."""
    src = a.copy()
    for x in range(W):
        yb = BOTTOM[x]
        if yb < 0:
            continue
        yf = yb - FRINGE
        s = drip_stretch(x, i)
        for y in range(yf + 1, min(H, yb + 3)):
            sy = yf + (y - yf) / s
            sy_i = int(math.floor(sy + 0.5))
            a[y, x] = src[sy_i, x] if sy_i <= yb else (0, 0, 0, 0)


DROPS = [  # (Spalte, Startframe)
    (39, 0), (44, 9), (28, 4), (56, 14), (19, 20), (64, 25), (42, 18), (33, 27),
]
DROP_ALPHA = [230, 200, 160, 120, 80, 45]


def drops(i):
    """Tropfen lösen sich vom Fadenende und fallen beschleunigt, verblassend."""
    out = []
    for x, start in DROPS:
        t = (i - start) % N
        if t >= len(DROP_ALPHA):
            continue
        y = BOTTOM[x] + 2 + (t * (t + 1)) // 3
        col = tuple(int(v) for v in CRE[BOTTOM[x] - 1, x][:3])
        if y < H:
            out.append((x, y, (*col, DROP_ALPHA[t])))
    return out


BUBBLES = [(x, y + PAD_TOP, t) for x, y, t in
           [(20, 30, 0), (60, 32, 7), (27, 38, 13), (70, 36, 19), (12, 33, 24), (55, 40, 29)]]


def bubbles(a, i):
    """Schleimblasen: wachsen, glänzen, platzen (4 Frames)."""
    for x, y, start in BUBBLES:
        t = (i - start) % N
        if a[y, x, 3] < 255:
            continue
        if t == 0:
            a[y, x] = (*MID, 255)
        elif t == 1:
            a[y, x] = (*LIGHT, 255)
            a[y - 1, x] = (*MID, 255)
        elif t == 2:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a[y + dy, x + dx] = (*LIGHT, 255)
            a[y, x] = (*OUTLINE, 255)
        elif t == 3:
            a[y - 1, x - 1] = (*LIGHT, 255)
            a[y + 1, x + 1] = (*MID, 255)


EYES = [(40, 34 + PAD_TOP), (43, 34 + PAD_TOP)]
EYE_GLOW = [(0, 150, 20), (0, 255, 11), (140, 255, 140)]


def eyes(a, i):
    if i % N in (22, 23):                       # blinzeln
        for x, y in EYES:
            a[y, x] = (*OUTLINE, 255)
            a[y - 1, x] = (*OUTLINE, 255)
        return
    lv = int(round(1 + wave(i, 16)))            # 0..2
    for x, y in EYES:
        a[y, x] = (*EYE_GLOW[lv], 255)


def creature(i):
    c = CRE.copy()
    stretch_fringe(c, i)
    bubbles(c, i)
    eyes(c, i)
    out = np.zeros_like(c)
    bob = body_bob(i)
    for x in range(W):
        dy = flap_dy(x, i) + bob
        for y in range(H):
            sy = y - dy
            if 0 <= sy < H:
                out[y, x] = c[sy, x]
    for x, y, col in drops(i):
        yy = y + flap_dy(x, i) + bob
        if 0 <= yy < H and out[yy, x, 3] == 0:
            out[yy, x] = col
    return out


# ---------------------------------------------------------------- Gas
def gas_layer(i):
    """Brodeln: weiche, schleifenfähige Verzerrung der Gasebene."""
    out = np.zeros_like(GAS)
    for y in range(H):
        for x in range(W):
            dx = 1.1 * wave(i, N, y * 0.16 + x * 0.05)
            dy = 1.2 * wave(i, N, x * 0.13 - y * 0.05 + 1.7)
            sx = int(round(x - dx))
            sy = int(round(y - dy))
            if 0 <= sx < W and 0 <= sy < H:
                out[y, x] = GAS[sy, sx]
    for x, y, col in gas_puffs(i):
        if 0 <= x < W and 0 <= y < H:
            out[y, x] = col
    return out


PUFFS = [(x, y + PAD_TOP, t) for x, y, t in
         [(44.5, 5.0, 0), (23.0, 11.0, 8), (61.5, 11.0, 16), (35.0, 7.0, 24)]]
PUFF_LIFE = 14


def gas_puffs(i):
    """Kleine Gaswölkchen lösen sich oben, steigen auf, wachsen und vergehen."""
    out = []
    for cx, cy, start in PUFFS:
        t = (i - start) % N
        if t >= PUFF_LIFE:
            continue
        f = t / PUFF_LIFE
        y0 = cy + 0.5 - t * 0.5
        x0 = cx + 0.8 * math.sin(t * 0.6)
        r = 1.0 + 1.3 * min(1.0, f * 1.6)          # wächst auf ~2.3 px Radius
        alpha = GAS_A if f < 0.55 else int(GAS_A * (1 - f) / 0.45)
        if alpha < 25 or r <= 0.2:
            continue
        for y in range(int(y0 - r - 1), int(y0 + r + 2)):
            for x in range(int(x0 - r - 1), int(x0 + r + 2)):
                d = math.hypot(x - x0, y - y0)
                if d > r + 0.3:
                    continue
                if d > r - 0.5:
                    col = OUTLINE
                elif (x - x0) + (y - y0) < -0.4:
                    col = LIGHT
                else:
                    col = MID
                out.append((x, y, (*col, alpha)))
    return out


# ---------------------------------------------------------------- Frame
HEAD_X = range(33, 51)
GAS_BOTTOM = {x: max(y for y in range(H) if GAS[y, x, 3] > 0) for x in HEAD_X}


def clip_gas_above_head(g, i):
    """Gas steigt aus dem Kopf auf: im Kopfbereich nie unter seine
    ursprüngliche Unterkante (relativ zum Kopf) -> Augen bleiben frei."""
    for x in HEAD_X:
        limit = GAS_BOTTOM[x] + body_bob(i) + flap_dy(x, i)
        g[limit + 1:, x] = 0


def frame(i):
    base = Image.fromarray(creature(i).astype(np.uint8))
    g = gas_layer(i)
    clip_gas_above_head(g, i)
    gas = Image.fromarray(g.astype(np.uint8))
    base.alpha_composite(gas)
    return np.array(base)


frames = [frame(i) for i in range(N)]


def save_gif(path, scale, ms, bg):
    imgs = []
    for f in frames:
        im = Image.fromarray(f).resize((W * scale, H * scale), Image.NEAREST)
        b = Image.new('RGBA', im.size, bg)
        b.alpha_composite(im)
        imgs.append(b.convert('RGB'))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms,
                 loop=0, disposal=2, optimize=False)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 90
    save_gif(f'waflav_idle_{tag}.gif', 6, ms, (40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'waflav_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
