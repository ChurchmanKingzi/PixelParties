# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Classmate Hel“ (Sayo Aisaka, Negima) von Hel, the Bound Specter.

Teile (classmate_hel_sprite.py): Körper, Schulstuhl, Pult (src/classmate-hel-{body,chair,desk}.png).
* Sie schwebt sanft auf und ab (die ganze Figur), das lange weiße Haar weht in eine Richtung
  (nach unten stärker, die Welle läuft durch), sie blinzelt und lächelt zwischendurch breiter.
* Vier Möbelstücke (drei Stühle, ein Pult) schweben um sie herum: jedes kreist auf einer kleinen
  Bahn mit eigener Phase, die Stühle auf der rechten Seite sind gespiegelt.
* Fahle Geisterlichter steigen neben ihr auf.
Aufruf (aus scripts/hero-animations):  python3 classmate_hel.py final 90
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/classmate-hel-body.png').convert('RGBA')).astype(int)
CHAIR = np.array(Image.open('src/classmate-hel-chair.png').convert('RGBA')).astype(int)
DESK = np.array(Image.open('src/classmate-hel-desk.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PL, PR, PT, PB = 14, 14, 7, 4
H, W = SH + PT + PB, SW + PL + PR
N = 48
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
SKIN, EYE_DARK, MOUTH = rgb('fbe4d6'), rgb('3b2f6e'), rgb('cf6470')
HAIR_Y0 = 14                                        # ab hier hängt das Haar neben dem Körper
FUR = [  # (Sprite, Mitte x, Mitte y, gespiegelt, Umlaufrichtung, Phase)
    (DESK, 8, 11, False, 1, 0.0),
    (CHAIR, 7, 26, False, -1, 2.1),
    (CHAIR, W - 8, 15, True, 1, 4.0),
    (CHAIR, W - 8, 30, True, -1, 1.2),
]


def hair_spans():
    """Je Zeile die Spalten des Haars links/rechts neben dem Körper: von der ersten Kontur bis vor der zweiten."""
    out = {}
    for y in range(HAIR_Y0, SH):
        xs = [x for x in range(SW // 2) if BODY[y, x, 3]]
        if not xs:
            continue
        k = [x for x in xs if tuple(BODY[y, x, :3]) == rgb('000000')[:3]]
        if len(k) >= 2:
            out[y] = (k[0], k[1] - 1)                # Haar: x0 .. x1-1 (ohne die Körperkontur)
    return out


SPANS = hair_spans()


def hair_dx(i, y):
    w = 2 * math.pi * 2 * i / N
    u = (y - HAIR_Y0) / (SH - HAIR_Y0)
    return int(round(0.75 * u * (math.sin(w - 0.4 * y) - math.sin(-0.4 * y)) / 1.0))


def figure(i):
    """Körper mit Mimik und wehendem Haar (in Körper-Koordinaten)."""
    s = BODY.copy()
    st = BLINK.get(i)
    for x in (6, 7, 9, 10):
        if st:
            s[8, x] = SKIN
            s[9, x] = EYE_DARK
    if 18 <= i < 31:                                # breiteres Lächeln
        for x in (7, 8, 9):
            s[11, x] = MOUTH
        s[12, 8] = SKIN
    hair = np.zeros((SH, SW), bool)
    for y, (a, b) in SPANS.items():
        hair[y, a:b + 1] = True
        hair[y, SW - 1 - b:SW - a] = True
    out = np.zeros_like(s)
    for y, (a, b) in SPANS.items():                 # Haar zuerst: der Körper liegt darüber
        dx = hair_dx(i, y)
        for side in (0, 1):
            xs = range(a, b + 1) if side == 0 else range(SW - 1 - b, SW - a)
            for x in xs:
                if 0 <= x + dx < SW:
                    out[y, x + dx] = s[y, x]
            if side == 0 and dx < 0:                  # innere Lücke zum Körper mit der innersten Haarspalte füllen
                out[y, b + dx + 1:b + 1] = s[y, b]
            if side == 1 and dx > 0:
                out[y, SW - 1 - b:SW - 1 - b + dx] = s[y, SW - 1 - b]
    keep = (s[:, :, 3] > 0) & ~hair
    out[keep] = s[keep]
    return out


def put(out, s, ox, oy, flip=False):
    if flip:
        s = s[:, ::-1]
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy, xx = y + oy, x + ox
        if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
            out[yy, xx] = s[y, x]


def frame(i):
    t = 2 * math.pi * i / N
    out = np.zeros((H, W, 4), int)
    for spr, cx, cy, flip, d, ph in FUR:            # Möbel kreisen auf kleinen Bahnen
        a = d * t + ph
        x = cx + int(round(2.3 * math.cos(a)))
        y = cy + int(round(2.6 * math.sin(a)))
        put(out, spr, x - spr.shape[1] // 2, y - spr.shape[0] // 2, flip)
    dy = -int(round(2 * math.sin(t)))
    put(out, figure(i), PL, PT + dy)
    near = np.zeros((H, W), bool)                   # Geisterlichter nie an Figur oder Möbeln
    ys, xs = np.nonzero(out[:, :, 3])
    for y, x in zip(ys, xs):
        near[max(0, y - 2):y + 3, max(0, x - 2):x + 3] = True
    for k in range(5):
        a = (i + k * 10) % N
        L = 26
        if a >= L:
            continue
        side = -1 if k % 2 else 1
        x = PL + SW // 2 + side * (SW // 2 + 1 + (k % 3) * 2) + int(round(1.2 * math.sin(0.45 * a + k)))
        y = PT + SH - 6 - int(round(1.2 * a))
        for yy, c in ((y, rgb('e8e4ff', int(210 * min(1.0, a / 3) * (1 - a / L)))),
                      (y + 1, rgb('b8b0d8', int(150 * min(1.0, a / 3) * (1 - a / L))))):
            if 1 <= x < W - 1 and 1 <= yy < H - 1 and not near[yy, x] and c[3] > 20 and not out[yy, x, 3]:
                out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'classmate_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=6,
                 check_edges=True)
