# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Classmate Hel“ (Sayo Aisaka, Negima) von Hel, the Bound Specter.

Ebenen: Körper (src/classmate-hel-body.png, vom Nutzer gezeichnet, mit Geisterschweif), Schulstuhl und Pult
(src/classmate-hel-{chair,desk}.png, classmate_hel_sprite.py).
Frame 0 ist die Ruhepose (der Sprite genau wie gezeichnet); jede Bewegung ist als Differenz zu Frame 0
formuliert.
* Der Körper schwebt nur sanft auf und ab (die ganze Figur, ±1 px) – er neigt sich nie zur Seite.
* Die langen weißen Haarsträhnen bewegen sich unabhängig davon, geisterhaft: jede Strähne mit eigener
  Wellenphase (eine Welle läuft die Strähne hinab, zur Spitze stärker, die Strähnen schwingen nicht im
  Gleichtakt), dazu schweben die Spitzen mit Verzögerung gegen den Körper auf und ab.
* Der Saum wellt sich (einzelne Spalten wachsen und schrumpfen im Wechsel um eine Zeile).
* Der Geisterschweif windet sich ständig: eine Welle läuft bis in die Spitze, die abgelösten
  Pünktchen am Ende schlingern mit.
* Vier Möbelstücke (drei Stühle, ein Pult) schweben um sie herum: jedes kreist auf einer kleinen Bahn mit
  eigener Phase, die Stühle auf der rechten Seite sind gespiegelt.
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
OUTLINE = (0x4c, 0x49, 0x66)
HAIR = {(0xd4, 0xd0, 0xee), (0xaa, 0xa5, 0xd2), (0x82, 0x7d, 0xae), (0xf4, 0xf2, 0xff)}
HAIR_Y0, HAIR_Y1 = 9, 24            # Haarsträhnen neben dem Körper (Zeilen im Sprite)
SKIRT_Y0, SKIRT_Y1 = 20, 26         # Rock bis Saum
TAIL_Y0 = 27                        # ab hier der Geisterschweif
FUR = [  # (Sprite, Mitte x, Mitte y, gespiegelt, Umlaufrichtung, Phase)
    (DESK, 8, 11, False, 1, 0.0),
    (CHAIR, 7, 26, False, -1, 2.1),
    (CHAIR, W - 8, 15, True, 1, 4.0),
    (CHAIR, W - 8, 30, True, -1, 1.2),
]


def col(p):
    return tuple(int(v) for v in p[:3])


def hair_spans():
    """Je Zeile die Spalten der Haarsträhnen links und rechts neben dem Körper."""
    out = {}
    for y in range(HAIR_Y0, HAIR_Y1 + 1):
        xs = np.nonzero(BODY[y, :, 3])[0]
        x0, x1 = xs.min(), xs.max()
        a = x0
        while a + 1 < SW and a - x0 < 4 and BODY[y, a + 1, 3] and (
                col(BODY[y, a + 1]) in HAIR or (col(BODY[y, a + 1]) == OUTLINE and a + 2 < SW
                                                and col(BODY[y, a + 2]) in HAIR)):
            a += 1
        b = x1
        while b - 1 >= 0 and x1 - b < 4 and BODY[y, b - 1, 3] and (
                col(BODY[y, b - 1]) in HAIR or (col(BODY[y, b - 1]) == OUTLINE and b - 2 >= 0
                                                and col(BODY[y, b - 2]) in HAIR)):
            b -= 1
        if a < b - 4:
            out[y] = (x0, a, b, x1)
    return out


SPANS = hair_spans()


def wave(i, y, c, cycles=2, ph=0.0):
    """Differenz einer laufenden Welle zu Frame 0 (in Frame 0 genau null); cycles Perioden pro Loop."""
    w = 2 * math.pi * cycles * i / N
    return math.sin(w - c * y + ph) - math.sin(-c * y + ph)


def clip01(v):
    return min(1.0, max(0.0, v))


def lock_dx(i, y, side):
    """Seitlicher Versatz einer Haarsträhne: eine Welle läuft die Strähne hinab (zur Spitze hin stärker);
    jede Strähne hat ihre eigene Phase, sie schwingen also nicht im Gleichtakt."""
    u = clip01((y - 8) / (HAIR_Y1 - 8))
    ph = 0.0 if side == 0 else 1.9
    return int(round(1.3 * u * (wave(i, y, 0.5, 2, ph) + 0.45 * wave(i, y, 0.9, 3, ph + 1.0))))


def lock_ev(i, y, side):
    """Senkrechter Versatz: die Strähne schwebt mit Verzögerung gegen den Körper auf und ab (Spitze stärker)."""
    u = clip01((y - 12) / (HAIR_Y1 + 2 - 12))
    ph = 0.8 if side == 0 else 2.6
    return int(round(1.6 * u * wave(i, 0, 0.0, 1, ph)))


def dx_tail(i, y):
    k = y - (TAIL_Y0 - 1)
    return int(round((1.0 + 0.15 * k) * wave(i, y, 0.7, 3)))


PX = 4                              # Rand links/rechts, damit verschobene Teile Platz haben
EXTRA_ROWS = 2                      # Platz unter dem Sprite für verlängerte Haarspitzen / Saum


def figure(i):
    """Der Körper bleibt, wie gezeichnet (er schwebt nur als Ganzes); Haarsträhnen, Saum und Schweif bewegen
    sich eigenständig (Breite SW + 2 * PX, Höhe SH + EXTRA_ROWS)."""
    out = np.zeros((SH + EXTRA_ROWS, SW + 2 * PX, 4), int)
    lockmask = np.zeros((SH, SW), bool)
    for y, (x0, a, b, x1) in SPANS.items():
        lockmask[y, x0:a + 1] = True
        lockmask[y, b:x1 + 1] = True
    # 1. Haarsträhnen (liegen unter dem Körper)
    for side in (0, 1):
        for y in range(HAIR_Y0, HAIR_Y1 + EXTRA_ROWS + 1):
            sy = y - lock_ev(i, y, side)           # Zeile im Sprite, die hier erscheint (Strähne dehnt/staucht sich)
            if sy > HAIR_Y1:                        # unter der Spitze: nichts
                continue
            sy = max(HAIR_Y0, sy)
            x0, a, b, x1 = SPANS[sy]
            dx = lock_dx(i, y, side)
            xs = range(x0, a + 1) if side == 0 else range(b, x1 + 1)
            for x in xs:
                out[y, x + PX + dx] = BODY[sy, x]
    # 2. Körper (ohne Strähnen und Schweif), unverändert
    body = (BODY[:, :, 3] > 0) & ~lockmask
    body[TAIL_Y0:] = False
    for y, x in zip(*np.nonzero(body)):
        out[y, x + PX] = BODY[y, x]
    # 3. Lücken zwischen Strähne und Körper mit der innersten Haarspalte schließen
    for y, (x0, a, b, x1) in SPANS.items():
        for lo, step in ((a + 1 + PX, -1), (b - 1 + PX, 1)):
            x = lo + step
            while 0 <= x < out.shape[1] and not out[y, x, 3] and abs(x - lo) < 2:    # nur 1-px-Lücken füllen
                x += step
            if 0 <= x < out.shape[1] and out[y, x, 3] and abs(x - lo) < 3:
                for xx in range(x, lo + step, -step):
                    out[y, xx] = out[y, x]
    # 4. Saum: einzelne Spalten wachsen und schrumpfen im Wechsel um eine Zeile (wellt sich, ohne zu kippen)
    for x in range(3, 13):
        d = wave(i, 0, 0.0, 2, -0.9 * x) > 0.9
        if d and out[SKIRT_Y1, x + PX, 3]:
            out[SKIRT_Y1 + 1, x + PX] = out[SKIRT_Y1, x + PX]
    # 5. Geisterschweif
    for y in range(TAIL_Y0, SH):
        d = dx_tail(i, y)
        for x in np.nonzero(BODY[y, :, 3])[0]:
            out[y, x + PX + d] = BODY[y, x]
    for y in range(TAIL_Y0, SH - 1):                    # Schweif zusammenhalten
        a, b = np.nonzero(out[y, :, 3])[0], np.nonzero(out[y + 1, :, 3])[0]
        if not len(a) or not len(b):
            continue
        if b.min() > a.max() + 1:
            for x in range(a.max() + 1, b.min()):
                out[y + 1, x] = rgb('4c4966')
        elif b.max() < a.min() - 1:
            for x in range(b.max() + 1, a.min()):
                out[y + 1, x] = rgb('4c4966')
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
    dy = -int(round(1.2 * math.sin(t)))
    put(out, figure(i), PL - PX, PT + dy)
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
        x = PL + SW // 2 + side * (SW // 2 + 2 + (k % 3) * 2) + int(round(1.2 * math.sin(0.45 * a + k)))
        y = PT + SH - 8 - int(round(1.2 * a))
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
