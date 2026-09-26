# -*- coding: utf-8 -*-
"""Idle-Animation für Arthor, Inheritor of the Barbarian Sword (55x142).

* Die rote, finstere Aura (halbtransparente Pixel) wabert: sie wird mit einem
  weichen, geschlossenen Verschiebungsfeld verzerrt und pulsiert in der
  Deckkraft. Stellen hinter der Figur werden vorher aus der Umgebung aufgefüllt,
  damit beim Verzerren keine Löcher entstehen.
* Er hebt das Schwert zweimal pro Loop bis 3 px an und senkt es wieder
  (Klinge, Parierstange, Griff mit Knauf und Hand als Einheit – der Knauf
  wird dabei nicht verlängert, darunter wird der Körper sichtbar).
* Die fünf Kerzen flackern: ihre Flammen werden jedes Frame neu gezeichnet
  (Höhe, Neigung und Glut wechseln).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/arthor-inheritor-of-the-barbarian-sword.png').convert('RGBA')).astype(float)
H, W = SRC.shape[:2]
N = 48
OPAQUE = SRC[:, :, 3] >= 255

# ---------------------------------------------------------------- Kerzen
# (linke Flammenspalte, unterste Flammenzeile)
CANDLES = [(15, 104), (40, 104), (15, 120), (40, 120), (27, 127)]
FLAME = set()
for cx, by in CANDLES:
    for y in range(by - 4, by + 1):
        for x in (cx - 1, cx, cx + 1, cx + 2):
            r, g, b, a = SRC[y, x]
            if a >= 255 and r > 180 and b < 120:
                FLAME.add((x, y))
RED, ORANGE, YELLOW, WHITE_HOT = (208, 29, 33), (232, 129, 58), (235, 183, 86), (255, 236, 170)


def rnd(k, i):
    """Deterministischer Zufall 0..1 je Kerze und Frame."""
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def flame_pixels(k, i):
    cx, by = CANDLES[k]
    h = 3 + int(rnd(k, i) * 2.99)                       # 3..5
    sway = int(round((rnd(k + 7, i) - 0.5) * 2.2))     # -1..1
    pix = [((cx, by), RED), ((cx + 1, by), ORANGE),
           ((cx, by - 1), ORANGE), ((cx + 1, by - 1), YELLOW if rnd(k + 3, i) > 0.3 else WHITE_HOT)]
    if h >= 3:
        pix.append(((cx + (1 if sway > 0 else 0), by - 2), YELLOW if h > 3 else ORANGE))
    if h >= 4:
        pix.append(((cx + max(0, sway) + (0 if sway >= 0 else -1) + 1 * (sway == 0), by - 3), ORANGE))
    if h >= 5:
        pix.append(((cx + sway + (1 if sway >= 0 else 0), by - 4), RED))
    return pix


# ---------------------------------------------------------------- Schwert
HAIR_TUFT = {(27, 95), (28, 94), (28, 95)}              # orange Haarsträhne bleibt am Kopf


def in_sword(x, y):
    if not OPAQUE[y, x] or (x, y) in HAIR_TUFT:
        return False
    if 75 <= y <= 99:
        return x >= 27
    if 100 <= y <= 103:
        return 29 <= x <= 34
    if 104 <= y <= 105:                                       # Griffende + Knauf
        return 29 <= x <= 34
    if 103 <= y <= 106 and 35 <= x <= 37:                     # Knaufstück rechts (rot/orange)
        return True
    return 106 <= y <= 108 and 32 <= x <= 34                  # rechte Knaufseite


SWORD = [(x, y) for y in range(75, 109) for x in range(W) if in_sword(x, y)]
SWORD_SET = set(SWORD)


def lift(i):
    return int(round(1.5 - 1.5 * math.cos(2 * math.pi * i / 24)))  # 0..3, zweimal pro Loop


def under(x, y, sprite):
    """Was unter dem angehobenen Schwert sichtbar wird."""
    if y <= 99:                                           # neben dem Kopf: Haar fortsetzen
        for d in range(1, 5):
            if 0 <= x - d and OPAQUE[y, x - d] and (x - d, y) not in SWORD_SET:
                return sprite[y, x - d]
        return None
    for d in range(1, 6):                                 # unter dem Knauf: Körper
        if y + d < H and OPAQUE[y + d, x] and (x, y + d) not in SWORD_SET:
            return sprite[y + d, x]
    return None


# ---------------------------------------------------------------- Aura
def build_aura():
    a = SRC.copy()
    have = (~OPAQUE) & (SRC[:, :, 3] > 0)
    a[~have] = 0
    # Stellen hinter der Figur aus den Nachbarn auffüllen (Premultiplied-Mittel)
    known = have.copy()
    ys, xs = np.nonzero(OPAQUE)
    todo = set(zip(ys.tolist(), xs.tolist()))
    while todo:
        nxt = set()
        upd = {}
        for y, x in todo:
            acc, n = np.zeros(4), 0
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and known[yy, xx]:
                    acc += a[yy, xx]
                    n += 1
            if n:
                upd[(y, x)] = acc / n
            else:
                nxt.add((y, x))
        if not upd:
            break
        for (y, x), v in upd.items():
            a[y, x] = v
            known[y, x] = True
        todo = nxt
    return a


AURA = build_aura()


def sample(img, fx, fy):
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - x0, fy - y0
    acc = np.zeros(4)
    for dx, dy, w in ((0, 0, (1 - tx) * (1 - ty)), (1, 0, tx * (1 - ty)),
                      (0, 1, (1 - tx) * ty), (1, 1, tx * ty)):
        xx, yy = min(W - 1, max(0, x0 + dx)), min(H - 1, max(0, y0 + dy))
        acc += img[yy, xx] * w
    return acc


def aura_frame(i):
    ph = 2 * math.pi * i / N
    out = np.zeros((H, W, 4))
    for y in range(H):
        for x in range(W):
            dx = 1.6 * math.sin(ph + y * 0.085) + 0.7 * math.sin(2 * ph + y * 0.19 + x * 0.11)
            dy = 1.8 * math.sin(ph + x * 0.13 + y * 0.03) + 0.9 * math.sin(2 * ph - y * 0.07)
            c = sample(AURA, x + dx, y + dy)
            pulse = 0.88 + 0.12 * math.sin(ph * 2 + y * 0.05 + x * 0.04)
            c[3] = min(254, c[3] * pulse)
            out[y, x] = c
    return out


def frame(i):
    out = aura_frame(i)
    sprite = SRC.copy()
    for x, y in FLAME:                                    # alte Flammen weg
        sprite[y, x, 3] = 0
    L = lift(i)
    # Figur, Kreis, Kerzen (ohne Schwert)
    for y in range(H):
        for x in range(W):
            if sprite[y, x, 3] >= 255 and (x, y) not in SWORD_SET:
                out[y, x] = sprite[y, x]
    # freigelegte Stellen unter dem angehobenen Schwert
    if L:
        moved = {(x, y - L) for x, y in SWORD}
        for x, y in SWORD:
            if (x, y) not in moved:
                c = under(x, y, sprite)
                if c is not None:
                    out[y, x] = c
    for x, y in SWORD:
        out[y - L, x] = sprite[y, x]
    for k in range(len(CANDLES)):
        for (x, y), c in flame_pixels(k, i):
            out[y, x] = (*c, 255)
    return np.clip(np.round(out), 0, 255).astype(int)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'arthor_sword_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=4)
