# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Berserker“ (Fate/Zero) von Null, the Mage Slayer.

Ebenen (src/berserking-null-{blade,body,extras}.png, übereinander in dieser Reihenfolge):
blutiges Plattenschwert, Körper, Extras (rotes Sichel-Visier + blaue Haarbänder). Der
Visier-Schweif, das Blut und die Funken entstehen erst in der Animation.
* Schweres Atmen: der Oberkörper samt Arm und Schwert hebt sich 1 px, die Füße
  bleiben stehen (die Zeile darüber wird gedehnt – keine Lücke).
* Das rote Sichel-Visier glüht im Takt auf; ab und zu zieht ein Lichtschweif
  davon über die Schulter nach oben und verglimmt.
* Berserkers blaue Haarbänder wehen (Welle von den Ansätzen zur Spitze).
* Über das Schwert läuft ein roter Energiestoß vom Heft zur Spitze.
* Blut tropft von der Klinge zu Boden und zerplatzt; rote Funken steigen auf.
Aufruf (aus scripts/hero-animations):  python3 berserker.py final
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

# Ebenen aus dem Skin-Sprite (alle gleich groß, deckungsgleich); Stapel: Schwert, Körper, Extras
BODY = np.array(Image.open('src/berserking-null-body.png').convert('RGBA')).astype(int)
BLADE = np.array(Image.open('src/berserking-null-blade.png').convert('RGBA')).astype(int)
EXTRA = np.array(Image.open('src/berserking-null-extras.png').convert('RGBA')).astype(int)   # Bänder + Visier
CX, CY, CR, CB = 3, 2, 73, 41                        # Zuschnitt auf den Inhalt
BODY, BLADE, EXTRA = (l[CY:CB, CX:CR] for l in (BODY, BLADE, EXTRA))
SH, SW = BODY.shape[:2]
PL, PR, PT, PB = 2, 3, 4, 2
H, W = SH + PT + PB, SW + PL + PR
N = 32
FEET = 34 - CY                                       # ab hier stehen die Füße (Körper endet in Zeile 40)
GROUND = 40 - CY                                     # unterste Zeile der Füße
VISOR_Y, VISOR_X = 18 - CY, 54 - CX                  # rechtes Ende der Sichel (Schweif startet hier)
ROOT_X = 52 - CX                                     # ab hier beginnen die Bänder (Ansatz fest)
OUTLINE = (5, 4, 10)
BAND = [rgb(h) for h in ('1b2470', '2f43c8', '6f8cff', 'c4d2ff')]
BLOOD = [rgb(h) for h in ('2e0000', '6e0505', 'a80d0d', 'd92b24', 'ff7a66')]
GLOW = [rgb(h) for h in ('8a0010', 'ff2438', 'ff6a5a', 'ffb8a8', 'ffe6dc')]
MOTE = [rgb('ff9a88'), rgb('e63a2e'), rgb('b80f0f'), rgb('7d0505')]
VIS = {rgb('8a0010')[:3]: 0, rgb('ff2438')[:3]: 1, rgb('ffb8a8')[:3]: 3}


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def breath(i):
    return -1 if math.sin(2 * math.pi * i / 16) > 0 else 0


def line(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            p = (round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n))
            if not out or out[-1] != p:
                out.append(p)
    return out


def is_band(p):
    return p[3] > 0 and p[2] > p[0]


def ribbons(out, i, b):
    """Die Bänder der Extras-Ebene wehen: eine Welle läuft von den Ansätzen nach rechts (nur senkrechte
    Verschiebung, zur Spitze hin stärker; Lücken zwischen Spalten werden gefüllt)."""
    def dy(x):
        u = min(1.0, max(0.0, (x - ROOT_X) / 16))
        return int(round(2.6 * u * math.sin(2 * math.pi * i / N - 0.45 * (x - ROOT_X))))
    for y, x in zip(*np.nonzero(EXTRA[:, :, 3])):
        if not is_band(EXTRA[y, x]):
            continue
        d0, d1 = dy(x), dy(x + 1)
        for d in range(min(d0, d1), max(d0, d1) + 1):
            yy, xx = y + d + PT + b, x + PL
            if 1 <= yy < H - 1 and 1 <= xx < W - 1:
                out[yy, xx] = EXTRA[y, x]


def trail(out, i, b):
    """Lichtschweif vom rechten Visier-Ende: steigt über die Schulter, wellt nach rechts oben, verglimmt."""
    t = i % 16
    if t > 10:
        return
    path = [(VISOR_X + 1, VISOR_Y), (VISOR_X + 2, VISOR_Y - 1), (VISOR_X + 3, VISOR_Y - 3), (VISOR_X + 4, VISOR_Y - 5),
            (VISOR_X + 6, VISOR_Y - 8), (VISOR_X + 8, VISOR_Y - 10), (VISOR_X + 10, VISOR_Y - 11)]
    pts = line(path)
    head = int(t * len(pts) / 7)
    for k, (x, y) in enumerate(pts):
        age = head - k
        if age < 0 or age > 6:
            continue
        c = GLOW[max(0, 3 - age // 2)] if age < 6 else GLOW[0]
        yy, xx = y + PT + b, x + PL
        if 0 <= yy < H and 0 <= xx < W - 1:
            out[yy, xx] = c


def draw(out, s, b):
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        out[y + PT + (b if y < FEET else 0), x + PL] = s[y, x]


def is_red(p):
    return p[3] > 0 and p[0] > p[1] + 30 and p[0] > p[2] + 30


def frame(i):
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    blade = BLADE.copy()
    pos = 30 - CX - (i % 16) * 1.8                         # Energiestoß: Heft -> Spitze
    for y, x in np.argwhere(BLADE[:, :, 3] > 0):
        if not is_red(BLADE[y, x]):                        # Kontur und Heft bleiben
            continue
        d = abs(x - pos)
        if d < 0.6:
            blade[y, x] = GLOW[3]
        elif d < 1.5:
            blade[y, x] = BLOOD[4]
    for s in (blade, BODY):
        draw(out, s, b)
    if b:                                                   # Zeile über den Füßen dehnen
        y = FEET - 1
        for x in range(SW):
            if BODY[y, x, 3] and not out[y + PT, x + PL, 3]:
                out[y + PT, x + PL] = BODY[y, x]
    ph = (math.sin(2 * math.pi * i / 16) + 1) / 2          # Visier atmet mit
    vis = EXTRA.copy()
    for y, x in zip(*np.nonzero(EXTRA[:, :, 3])):
        k = VIS.get(tuple(EXTRA[y, x, :3]))
        if k is not None:
            vis[y, x] = GLOW[min(3, k + (1 if ph > 0.8 and k < 3 else 0))]
            out[y + PT + b, x + PL] = vis[y, x]
    ribbons(out, i, b)
    trail(out, i, b)
    # Blut tropft von der Klinge (zwei Stellen an der Unterkante)
    for x0, t0 in ((12 - CX, 2), (25 - CX, 18)):
        t = (i - t0) % N
        yb = 28 - CY + PT + b
        if t < 5:                                           # Tropfen bildet sich
            out[yb, x0 + PL] = BLOOD[2]
            if t >= 3:
                out[yb + 1, x0 + PL] = BLOOD[3]
        elif t < 17:                                        # fällt
            y = yb + 1 + (t - 5) * (GROUND + PT - yb - 2) // 11
            out[min(y, GROUND + PT - 1), x0 + PL] = BLOOD[3]
            out[max(yb + 1, y - 1), x0 + PL] = BLOOD[2]
        elif t < 21:                                        # zerplatzt am Boden
            r = t - 16
            y = GROUND + PT
            out[y, x0 + PL] = BLOOD[2]
            for dx in range(1, min(r, 3) + 1):
                if r < 4:
                    out[y, x0 + PL - dx] = BLOOD[1 + (dx > 1)]
                    out[y, x0 + PL + dx] = BLOOD[1 + (dx > 1)]
    # Funken steigen von der Klinge auf
    seeds = [(x, y) for y, x in np.argwhere(BLADE[:, :, 3] > 0) if y <= 22 - CY and is_red(BLADE[y, x])]
    for m in range(9):
        t = (i + m * 3) % 16
        gen = ((i + m * 3) // 16) % (N // 16)
        sx, sy = seeds[int(rnd(m, gen) * len(seeds)) % len(seeds)]
        x = int(round(sx + PL + (rnd(m + 7, gen) - 0.5) * t * 0.5))
        y = int(round(sy + PT + b - t * 0.55))
        if t >= 10 or not (1 <= x < W - 1 and 1 <= y < H - 1) or out[y, x, 3]:
            continue
        out[y, x] = MOTE[min(3, t // 3)]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'berserker_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6,
                 check_edges=True)
