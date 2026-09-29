# -*- coding: utf-8 -*-
"""Idle-Animationen für Hel (assemble_late.py) und die aus Kartenbildern rekonstruierten Heroes.

Aufruf: python3 late5.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* hel:      Hel, the Bound Specter schwebt, der Saum ihres Umhangs weht geisterhaft, ihre roten Augen
            glühen auf und sie blinzelt; fahle Geisterlichter steigen um sie auf.
* cecilia:  Cecilia, the Harrowing Crusader (Kopf mit Piratenhut aus dem Kartenbild, Körper wie Bad
            Birthday Girl Cecilia) atmet und blinzelt, ihr Haken blitzt.
* fiona:    Fiona, the Empty Vessel of a Forgotten Sorceress federt leicht und blinzelt; lila Blitze
            zucken als Partikel um sie herum (sie berühren sie nicht), die Krone funkelt.
* mary:     Mary Crestmas fliegt singend: die Engelsflügel schlagen, sie steigt und sinkt, der Mund geht auf und zu, der Bommel ihrer
            Santa-Mütze wippt, rote und grüne Noten steigen auf.
* beato:    Beato, the Eternal Butterfly fliegt: die Flügel schlagen (sie falten sich zur Mitte), sie
            steigt beim Abschlag und gaukelt in einer liegenden Acht; kleine goldene Schmetterlinge
            flattern um sie herum.
"""
import math
import os
import sys
import numpy as np
import cv2
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, sparkle_pixels
from flap_common import shear_flap

N = 48
OUT = os.environ.get('L4_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'hel': dict(slug='hel-the-bound-specter', pads=(5, 6, 3, 10)),
    'cecilia': dict(slug='cecilia-the-harrowing-crusader', knee=14, pads=(1, 1, 3, 1)),
    'fiona': dict(slug='fiona-the-empty-vessel-of-a-forgotten-sorceress', knee=19, pads=(9, 9, 4, 1)),
    'mary': dict(slug='mary-crestmas', pads=(7, 9, 9, 4)),
    'beato': dict(slug='beato-the-eternal-butterfly', pads=(8, 9, 6, 7)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'hel')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def blend(out, x, y, c):
    if not (0 <= y < out.shape[0] and 0 <= x < out.shape[1]) or c[3] <= 0:
        return
    a = c[3] / 255
    if not out[y, x, 3]:
        out[y, x] = c
        return
    out[y, x, :3] = [int(c[k] * a + out[y, x, k] * (1 - a)) for k in range(3)]
    out[y, x, 3] = max(int(out[y, x, 3]), int(c[3]))


def paste(out, a, ox, oy):
    for y, x in zip(*np.nonzero(a[:, :, 3])):
        dot(out, x + ox, y + oy, a[y, x])


def blink(s, i, table, shift=0):
    st = BLINK.get((i + shift) % N)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def squash(out, s, knees, oy, ox):
    """Wie draw_bounce, aber mit mehreren Knicken: Zeilen oberhalb von knee verschieben sich um die Summe
    aller b der darunter liegenden Knicke; beim Strecken füllt die Zeile über dem Knick die Lücke."""
    sh, sw = s.shape[:2]
    off = [sum(b for k, b in knees if y < k) for y in range(sh)]
    for y in range(sh):
        for x in range(sw):
            if s[y, x, 3]:
                dot(out, x + ox, y + oy + off[y], s[y, x])
    for y in range(sh - 1):                               # Lücken zwischen Zeile y und y+1 füllen
        for g in range(off[y] + y + 1, off[y + 1] + y + 1):
            for x in range(sw):
                if s[y, x, 3] and s[y + 1, x, 3] and not out[g + oy, x + ox, 3]:
                    out[g + oy, x + ox] = s[y, x]


def near_mask(out, r=1):
    """Figur samt r Pixeln Abstand: dort dürfen keine Partikel hin."""
    return cv2.dilate((out[:, :, 3] > 0).astype(np.uint8), np.ones((2 * r + 1, 2 * r + 1), np.uint8)) > 0


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


# ---------------------------------------------------------------- Hel
HEL_EYES = {'halb': [((5, 11), '555555'), ((6, 11), '555555'), ((9, 11), '555555'), ((10, 11), '555555')],
            'zu': [((x, 11), '191919') for x in (5, 6, 9, 10)]}
HEL_DRIP = [(7, 0), (9, 12), (8, 30)]                   # (Spalte, Startframe): Blutströme aus der Wunde
HEL_WOUND = [(x, y) for y in (19, 20) for x in range(6, 11)]
HEL_GLOW = {5: 'ff4040', 6: 'ff8080', 7: 'ff4040', 29: 'ff4040', 30: 'ff8080', 31: 'ff4040'}


def f_hel(i):
    """Sie schwebt, der Saum weht, die Augen glühen auf und sie blinzelt; Geisterlichter steigen auf."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    if i in HEL_GLOW:
        for x in (6, 10):
            s[11, x] = rgb(HEL_GLOW[i])
    blink(s, i, HEL_EYES)
    dy = -round(2 * math.sin(t))
    hem = lambda y: round(1.4 * (y - 19) / (SH - 19) * (math.sin(3 * t - 0.9 * y) - math.sin(-0.9 * y))) \
        if y >= 20 else 0                                 # der Saum weht: unten stärker
    if (i % 12) in (0, 1, 6):                             # die Wunde quillt
        for x, y in HEL_WOUND:
            if s[y, x, 0] > 0x80:
                s[y, x] = rgb('c81010' if (i % 12) == 0 else 'b00808')
    drops = []
    for col, st in HEL_DRIP:                              # Blut rinnt über den dunklen Umhang zum Saum …
        a = (i - st) % 24
        head = 21 + min(a // 2, 4)
        if a < 16:
            fade = 1.0 if a < 10 else 1 - (a - 10) / 6
            for y in range(21, head + 1):
                c = '9f0000' if y == head and a < 10 else '7a0000' if fade > 0.5 else '4a0000'
                s[y, col] = rgb(c)
        if 8 <= a < 20:                                   # … und tropft vom Saum ab
            drops.append((col, a - 8))
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        dot(out, x + hem(y) + PL, y + dy + PT, s[y, x])
    for col, a in drops:
        x = col + hem(SH - 1) + PL
        y0 = SH + dy + PT
        if a < 3:                                         # der Tropfen schwillt unter dem Saum an
            dot(out, x, y0, rgb('9f0000'))
            if a == 2:
                dot(out, x, y0 + 1, rgb('7a0000'))
        else:                                             # fällt immer schneller, zieht einen Faden
            y = y0 + round(0.35 * (a - 2) ** 2)
            if y - y0 <= 7:
                dot(out, x, y, rgb('b00808'))
                dot(out, x, y - 1, rgb('7a0000', 150))
    near = near_mask(out, 1)
    for k in range(6):                                    # fahle Geisterlichter steigen auf
        a = (i * 1 + k * 8) % N
        L = 20
        if a >= L:
            continue
        side = -1 if k % 2 else 1
        x = PL + SW // 2 + side * (SW // 2 + 1 + (k % 3)) + round(1.2 * math.sin(0.45 * a + k))
        y = PT + SH - 4 - round(1.3 * a)
        al = int(210 * min(1.0, a / 3) * (1 - a / L))
        for xx, yy, c in ((x, y, 'e8e4ff'), (x, y + 1, 'b8b0d8')):
            if 0 < xx < W - 1 and 0 < yy < H - 1 and not near[yy, xx]:
                blend(out, xx, yy, rgb(c, al))
    return out


# ---------------------------------------------------------------- Cecilia, the Harrowing Crusader
CE_LEG = 23                                              # Stiefelschäfte (Zeile 22) werden gedehnt/gestaucht
CE_HOOK = (4, 20)                                        # rechts neben der Hakenspitze (3, 20)
CE_EYE = {'halb': [((10, 9), '3b211a')], 'zu': [((10, 9), 'f6cd8b'), ((10, 10), '3b211a')]}


def f_cecilia(i):
    """Sie atmet (Oberkörper federt), blinzelt mit dem sichtbaren Auge, ihr Haken blitzt."""
    s = SRC.copy()
    blink(s, i, CE_EYE)
    out = np.zeros((H, W, 4), int)
    b = B24[i % 24]
    squash(out, s, [(KNEE, b), (CE_LEG, b)], PT, PL)      # Oberkörper und Beine federn beide
    hx, hy = CE_HOOK                                      # Glanz rechts neben der Hakenspitze
    for (x, y), c in sparkle_pixels(i, N, [(hx + PL, hy + PT + b, 8), (hx + PL, hy + PT + b, 32)],
                                    rgb('ffffff'), rgb('c8e8ff')).items():
        if not out[y, x, 3] or (x, y) == (hx + PL, hy + PT + b):
            dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Fiona
FI_EYES = {'halb': [((x, 7), '322504') for x in (4, 5, 8, 9)],
           'zu': [((x, 7), 'fee8d0') for x in (4, 5, 8, 9)] + [((x, 8), '322504') for x in (4, 5, 8, 9)]}
FI_BOLT = [rgb('f0d8ff'), rgb('b060f0'), rgb('6a2a8a')]


def bolt(out, near, x, y, dx, dy, n, k, i, core):
    """Zackiger Blitz: Schritt für Schritt in Grundrichtung (dx, dy) mit zufälligem Querversatz."""
    pts = []
    for s in range(n):
        pts.append((x, y))
        j = rnd(k * 31 + s, i)
        if dx:
            x += dx
            y += -1 if j < 0.33 else 1 if j > 0.66 else 0
        else:
            y += dy
            x += -1 if j < 0.33 else 1 if j > 0.66 else 0
    for s, (x, y) in enumerate(pts):
        if 0 < x < W - 1 and 0 < y < H - 1 and not near[y, x]:
            c = FI_BOLT[0] if core and s % 3 == 1 else FI_BOLT[1] if core else FI_BOLT[2]
            dot(out, x, y, c)


def f_fiona(i):
    """Sie federt und blinzelt, die Krone funkelt; lila Blitze zucken um sie herum."""
    s = SRC.copy()
    blink(s, i, FI_EYES)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    for (x, y), c in sparkle_pixels(i, N, [(PL + 5, PT + b, 4), (PL + 8, PT + b, 28)],
                                    rgb('fffbd0'), rgb('ffd700')).items():
        if not out[y, x, 3] or y <= PT + b:
            dot(out, x, y, c)
    near = near_mask(out, 1)
    for k in range(4):                                    # Blitze: je 3 Frames sichtbar, reihum versetzt
        a = (i + 3 * k) % 12
        if a >= 3:
            continue
        seed = (i - a) + 7 * k
        side = 1 if (k + (i - a) // 12) % 2 else -1
        y0 = PT + 2 + int(rnd(seed, 5) * (SH - 4))
        x0 = PL + (SW + 1 if side > 0 else -2)
        n = 6 + int(rnd(seed, 9) * 3)
        bolt(out, near, x0, y0, side, 0, n, seed, 0, core=(a < 2))
        for br in (2, 5):                                 # Verzweigungen nach oben und unten
            if rnd(seed, 11 + br) > 0.3:
                bolt(out, near, x0 + side * br, y0 + (1 if br == 5 else 0), 0,
                     1 if rnd(seed, 13 + br) > 0.5 else -1, 3 + int(rnd(seed, 17 + br) * 3), seed + 50 + br, 0,
                     core=(a < 2))
    return out


# ---------------------------------------------------------------- Mary Crestmas
NOTES = None
MA_MOUTH = [(11, 13), (12, 13)]
MA_SING = [1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0,
           1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1]
MA_WING_ROWS = np.array([8 <= y <= 24 for y in range(SH)])   # weiße Engelsflügel links (x ≤ 4) und rechts (x ≥ 19)
_ys, _xs = np.mgrid[0:SH, 0:SW]
MA_NOTE_COLS = [('d8232f', '8b1414'), ('2e9e3e', '145a1e'), ('f4d040', '9a7a10')]


def f_mary(i):
    """Sie singt: wiegt sich (oben weiter als unten), der Mund geht auf und zu, der Bommel wippt nach,
    Noten steigen auf."""
    global NOTES
    t = 2 * math.pi * i / N
    if NOTES is None:
        notes = np.array(Image.open('src/pinta-the-singing-ship-notes.png').convert('RGBA')).astype(int)
        n, lab, st, _ = cv2.connectedComponentsWithStats((notes[:, :, 3] > 0).astype(np.uint8), connectivity=8)
        NOTES = []
        for k in range(1, n):
            x, y, w, h, _ = st[k]
            NOTES.append((lab[y:y + h, x:x + w] == k))
    s = SRC.copy()
    if not MA_SING[i]:
        for x, y in MA_MOUTH:
            s[y, x] = rgb('f2c27e')
    lift = 0.6 * math.sin(2 * math.pi * i / 12)           # Flügelschlag (12 Frames), Spitzen hoch/runter
    squeeze = 1 - 0.3 * abs(lift) / 0.6
    dy = -round(2 * math.sin(t) + 0.8 * math.sin(2 * math.pi * i / 12 - 1.4))   # sie steigt und sinkt
    out = np.zeros((H, W, 4), int)
    wing = (s[:, :, 3] > 0) & (MA_WING_ROWS[:, None]) & ((_xs <= 4) | (_xs >= 19))
    shear_flap(s, wing & (_xs <= 4), 4, -1, lift, squeeze, out, (PL, PT + dy), curve=1.3)
    shear_flap(s, wing & (_xs >= 19), 19, 1, lift, squeeze, out, (PL, PT + dy), curve=1.3)
    for y, x in zip(*np.nonzero((s[:, :, 3] > 0) & ~wing)):
        dx = round(0.9 * math.sin(2 * t - 1.2) + 0.6 * math.sin(2 * math.pi * i / 12)) \
            if y <= 3 and x >= 16 else 0                  # der Bommel schwingt nach
        dot(out, x + dx + PL, y + PT + dy, s[y, x])
    near = near_mask(out, 1)
    for k in range(5):
        a = (i + k * 10) % N
        L = 26
        if a >= L:
            continue
        m = NOTES[k % len(NOTES)]
        fg, dk = MA_NOTE_COLS[k % 3]
        side = 1 if k % 2 else -1
        x = PL + (SW - 2 if side > 0 else 1) + side * round(0.25 * a) + round(1.3 * math.sin(0.5 * a + k))
        y = PT + 12 - round(0.8 * a)
        al = int(255 * min(1.0, a / 3) * (1 - max(0, a - L + 6) / 6))
        for yy, xx in zip(*np.nonzero(m)):
            X, Y = x + xx, y + yy
            if 0 < X < W - 1 and 0 < Y < H - 1 and not near[Y, X]:
                blend(out, X, Y, rgb(fg if (xx + yy) % 3 else dk, al))
    return out


# ---------------------------------------------------------------- Beato
BE_FLAP = [1.0, 0.86, 0.62, 0.42, 0.34, 0.5, 0.74, 0.92]     # Flügelbreite je Frame (8er-Schlag)
BE_BODY = (8, 13)                                            # Mittelteil mit Gesicht bleibt ungestaucht
BE_BUGS = None


def f_beato(i):
    """Sie fliegt: die Flügel falten sich zur Mitte und öffnen sich wieder, sie steigt beim Abschlag
    und gaukelt in einer liegenden Acht; goldene Schmetterlinge flattern um sie."""
    t = 2 * math.pi * i / N
    f = BE_FLAP[i % 8]
    lift = [0, 0, 0, 1, 1, 0, -1, -1][i % 8]
    fx = round(2.5 * math.sin(t))
    fy = round(1.5 * math.sin(2 * t)) + lift
    out = np.zeros((H, W, 4), int)
    l, r = BE_BODY
    cx0, cx1 = l - 0.5, r + 0.5
    cols = {}
    for x in range(SW):                                   # Spalten vorwärts abbilden (keine Lücken)
        if x < l:
            nx = round(cx0 - (cx0 - x) * f)
        elif x > r:
            nx = round(cx1 + (x - cx1) * f)
        else:
            nx = x
        cols.setdefault(nx, []).append(x)
    for nx, xs in cols.items():
        src = min(xs, key=lambda x: abs(x - (l + r) / 2)) if nx < l or nx > r else xs[0]
        # beim Falten liegt die äußere Flügelkante oben: nimm die äußerste Spalte, wenn vorhanden
        src = min(xs) if nx < l else max(xs) if nx > r else src
        for y in range(SH):
            if SRC[y, src, 3]:
                dot(out, nx + PL + fx, y + PT + fy, SRC[y, src])
    near = near_mask(out, 1)
    for k in range(5):                                    # goldene Mini-Schmetterlinge
        ph = k * 1.3
        x = PL + SW // 2 + round((SW // 2 + 5) * math.cos(t + ph)) + round(math.sin(3 * t + k))
        y = PT + SH // 2 + round((SH // 2 + 4) * math.sin(t * (1 if k % 2 else -1) + ph))
        open_ = (i + k) % 4 < 2
        pts = [(-1, -1), (1, -1), (-1, 1), (1, 1), (0, 0)] if open_ else [(0, -1), (0, 1), (0, 0)]
        for dx, dy in pts:
            X, Y = x + dx, y + dy
            if 0 < X < W - 1 and 0 < Y < H - 1 and not near[Y, X]:
                dot(out, X, Y, rgb('fff0a0' if (dx, dy) == (0, 0) else 'f0c030'))
    return out


FRAME = dict(hel=f_hel, cecilia=f_cecilia, fiona=f_fiona, mary=f_mary, beato=f_beato)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
