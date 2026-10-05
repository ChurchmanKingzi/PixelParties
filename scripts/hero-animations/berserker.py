# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Berserker“ (Fate/Zero) von Null, the Mage Slayer.

Teile (berserker_sprite.py): Körper + blutiges Plattenschwert
(src/berserker-null-{body,blade}.png). Die Bänder, der Visier-Schweif, das Blut
und die Funken entstehen erst in der Animation.
* Schweres Atmen: der Oberkörper samt Arm und Schwert hebt sich 1 px, die Füße
  bleiben stehen (die Zeile darüber wird gedehnt – keine Lücke).
* Das rote Sichel-Visier glüht im Takt auf; ab und zu zieht ein Lichtschweif
  davon über die Schulter nach oben und verglimmt.
* Berserkers blaue Haarbänder wehen vom Helm nach rechts (Welle entlang der Bänder).
* Über das Schwert läuft ein roter Energiestoß vom Heft zur Spitze.
* Blut tropft von der Klinge zu Boden und zerplatzt; rote Funken steigen auf.
Aufruf (aus scripts/hero-animations):  python3 berserker.py final
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/berserker-null-body.png').convert('RGBA')).astype(int)
BLADE = np.array(Image.open('src/berserker-null-blade.png').convert('RGBA')).astype(int)
CY = 3                                               # darüber ist die Leinwand leer
BODY, BLADE = BODY[CY:], BLADE[CY:]
SH, SW = BODY.shape[:2]
PL, PR, PT, PB = 2, 6, 7, 2
H, W = SH + PT + PB, SW + PL + PR
N = 32
FEET = 29 - CY                                       # ab hier stehen die Füße (Null: 22 + 7)
GROUND = 36 - CY                                     # unterste Zeile der Füße
VISOR_Y, VISOR_X = 16 - CY, 52                       # rechtes Ende der Sichel (Schweif startet hier)
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


def ribbons(out, i, b):
    """Drei Haarbänder wehen vom Helm nach rechts (hinter der Figur): zur Spitze hin schmaler,
    eine Welle läuft entlang der Bänder, oben ein heller Saum."""
    # (Startpunkt, Steigung, Länge, Amplitude, Phase, Dicke am Ansatz)
    strands = [((50, 10), -0.45, 17, 3.0, 0.0, 3), ((51, 13), -0.08, 16, 2.8, 2.1, 3), ((48, 8), -0.85, 13, 2.2, 4.2, 2)]
    for (x0, y0), sl, ln, amp, ph, th in strands:
        cols = {}
        for k in range(ln + 1):
            u = k / ln
            y = y0 + sl * k + amp * u * math.sin(2 * math.pi * i / N - 0.5 * k + ph)
            t = th if u < 0.45 else (max(1, th - 1) if u < 0.8 else 1)
            for d in range(t):
                cols[(x0 + k, round(y) + d)] = BAND[2] if d == 0 else (BAND[0] if d == t - 1 and t > 1 else BAND[1])
        for (x, y), c in cols.items():
            yy, xx = y + PT + b - CY, x + PL
            if 1 <= yy < H - 1 and 1 <= xx < W - 1 and not out[yy, xx, 3]:
                out[yy, xx] = c
        # senkrechte Lücken zwischen benachbarten Spalten füllen (Band bleibt zusammenhängend)
        for x in sorted({x for x, _ in cols})[:-1]:
            ys0 = [y for (xx, y) in cols if xx == x]
            ys1 = [y for (xx, y) in cols if xx == x + 1]
            lo, hi = max(min(ys0), min(ys1)), min(max(ys0), max(ys1))
            if min(ys0) > max(ys1) or min(ys1) > max(ys0):
                a_, b_ = (max(ys1), min(ys0)) if min(ys0) > max(ys1) else (max(ys0), min(ys1))
                for y in range(a_ + 1, b_):
                    yy, xx = y + PT + b - CY, x + PL
                    if 1 <= yy < H - 1 and 1 <= xx < W - 1 and not out[yy, xx, 3]:
                        out[yy, xx] = BAND[1]


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


def frame(i):
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    ribbons(out, i, b)
    body = BODY.copy()
    ph = (math.sin(2 * math.pi * i / 16) + 1) / 2          # Visier atmet mit
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        k = VIS.get(tuple(body[y, x, :3]))
        if k is not None:
            body[y, x] = GLOW[min(3, k + (1 if ph > 0.8 and k < 3 else 0))]
    blade = BLADE.copy()
    pos = 27 - (i % 16) * 1.7                              # Energiestoß: Heft -> Spitze
    for y, x in np.argwhere(BLADE[:, :, 3] > 0):
        if tuple(BLADE[y, x, :3]) == (5, 4, 10):           # Kontur bleibt
            continue
        d = abs(x - pos)
        if d < 0.6:
            blade[y, x] = GLOW[3]
        elif d < 1.5:
            blade[y, x] = BLOOD[4]
    for s in (blade, body):
        draw(out, s, b)
    if b:                                                   # Zeile über den Füßen dehnen
        y = FEET - 1
        for x in range(SW):
            if BODY[y, x, 3] and not out[y + PT, x + PL, 3]:
                out[y + PT, x + PL] = body[y, x]
    trail(out, i, b)
    # Blut tropft von der Klinge
    for x0, t0 in ((12, 2), (20, 18)):
        t = (i - t0) % N
        yb = 22 - CY + PT + b
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
    seeds = [(x, y) for y, x in np.argwhere(BLADE[:, :, 3] > 0) if y <= 13 - CY + 1]
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
