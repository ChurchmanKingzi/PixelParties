# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGuardianBeasts-Heroes und -Skins.

Aufruf: python3 guardianbeasts.py <tag> [ms] <variante>

* mao / hunter: Mao, the Vengeful Guardian bzw. Vengeful Hunter Mao federn und
            blinzeln; die Schlitzspur ihrer blutigen Klauen (der dunkelrote Bogen
            unten, links nach rechts) steht in Frame 0 wie im Kartenbild, verblasst
            vom Ende her, und später reißt ein neuer Schlitzer den Bogen in einem
            Zug von links nach rechts wieder auf (heller Kopf, dunkler Schweif);
            die Spur steht fest im Raum, der Körper federt davor.
* dajan:    Dajan, Conqueror of the Treasure Cave federt und blinzelt; Blut rinnt die
            Dolchklinge hinab und tropft von der Parierstange zu Boden, der
            Lichtreflex neben dem Dolch funkelt.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
N = 48
OUT = os.environ.get('GB_OUT', '.')

V_ = {
    'mao': dict(slug='mao-the-vengeful-guardian', knee=21,
                blink={'halb': [((10, 10), 'dacfd5'), ((11, 10), 'dacfd5'), ((14, 10), 'dacfd5'), ((15, 10), 'dacfd5')],
                       'zu': [((10, 10), 'dacfd5'), ((11, 10), 'dacfd5'), ((14, 10), 'dacfd5'), ((15, 10), 'dacfd5'),
                              ((10, 11), '000000'), ((11, 11), '000000'), ((14, 11), '000000'), ((15, 11), '000000')]}),
    'hunter': dict(slug='vengeful-hunter-mao', knee=19,
                   blink={'halb': [((10, 9), '1a6614'), ((11, 9), '8a7a45'), ((14, 9), '1a6614'), ((15, 9), '8a7a45')],
                          'zu': [((10, 9), '000000'), ((11, 9), '000000'), ((14, 9), '000000'), ((15, 9), '000000')]}),
    'dajan': dict(slug='dajan-conqueror-of-the-treasure-cave', knee=20, pads=(3, 3, 3, 2),
                  blink={'halb': [((6, 9), '5a4030'), ((9, 9), '5a4030')],
                         'zu': [((5, 9), '000000'), ((6, 9), '000000'), ((9, 9), '000000'), ((10, 9), '000000')]}),
}
V = next((v for v in sys.argv[2:] if v in V_), 'mao')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
H, W = SH + PT + PB, SW + PL + PR


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def blink(s, i):
    st = BLINK.get(i)
    if st:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)


def put(out, s, ox, oy, dy_fn=None):
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy = y + oy + (dy_fn(x, y) if dy_fn else 0)
        if 0 <= yy < out.shape[0]:
            out[yy, x + ox] = s[y, x]


def knee_put(out, s, b):
    """Federn: Zeilen über dem Knie um b verschoben, die Beine bleiben stehen; beim Strecken
    wird die Zeile über dem Knie gedehnt."""
    put(out, s, PL, PT, dy_fn=lambda x, y: b if y < KNEE else 0)
    if b < 0:
        y = KNEE - 1
        for x in range(s.shape[1]):
            if s[y, x, 3] and s[KNEE, x, 3] and not out[y + PT, x + PL, 3]:
                out[y + PT, x + PL] = s[y, x]


# --- Bluttropfen (wie bei GrailWar) ---------------------------------------------
BLOOD = (rgb('5c0000'), rgb('9a0000'), rgb('d42a2a'))


def drop_pixels(t, x, y, ground, cols=BLOOD):
    dk, md, hl = cols
    if t < 0:
        return {}
    if t < 2:
        return {(x, y): md}
    if t < 4:
        return {(x, y): md, (x, y + 1): hl}
    k = t - 4
    yd = y + 2 + (k * (k + 1)) // 2
    if yd < ground:
        return {(x, yd - 1): dk, (x, yd): md} if k else {(x, yd - 1): md, (x, yd): hl}
    k_hit = next(k2 for k2 in range(40) if y + 2 + (k2 * (k2 + 1)) // 2 >= ground)
    if k - k_hit == 0:
        return {(x, ground): md, (x - 1, ground): dk, (x + 1, ground): dk}
    if k - k_hit == 1:
        return {(x - 1, ground): dk, (x + 1, ground): dk}
    return {}


# --- Mao: Schlitzspur ------------------------------------------------------------
SLASH_T = None
FADE = (1, 12)                                           # Spur verblasst vom Ende her
SWEEP = (32, 39)                                         # neuer Schlitzer, links -> rechts


def slash_param(sl):
    """Für jedes Pixel der Spur die Lage t entlang des Bogens (0 = linkes Ende, 1 = rechtes Ende):
    Winkel um den Punkt über der Bogenmitte."""
    ys, xs = np.nonzero(sl[:, :, 3])
    cx, cy = (xs.min() + xs.max()) / 2, ys.min() - 1.0
    th = np.arctan2(ys - cy, xs - cx)
    t = (th.max() - th) / (th.max() - th.min())
    return {(int(x), int(y)): float(v) for x, y, v in zip(xs, ys, t)}


def f_mao(i):
    global SLASH_T
    body, sl = load('body'), load('slash')
    if SLASH_T is None:
        SLASH_T = slash_param(sl)
    blink(body, i)
    out = np.zeros((H, W, 4), int)
    knee_put(out, body, BOUNCE12[i % 12])
    fill_pinholes(out)
    for (x, y), t in SLASH_T.items():
        c = sl[y, x]
        if FADE[0] <= i <= FADE[1]:                      # verblasst vom linken Ende her (leicht zerfasert)
            u = (i - FADE[0] + 1) / (FADE[1] - FADE[0] + 1)
            if t + 0.08 * math.sin(3.1 * x + 1.7 * y) < 1.15 * u:
                continue
            c = [int(v * (1 - 0.35 * u)) for v in c[:3]] + [255]
        elif FADE[1] < i < SWEEP[0]:
            continue
        elif SWEEP[0] <= i <= SWEEP[1]:                  # der Schlitzer zieht den Bogen auf
            head = (i - SWEEP[0] + 1) / (SWEEP[1] - SWEEP[0] + 1) * 1.2
            if t > head:
                continue
            d = head - t
            if d < 0.09:
                c = rgb('ff7a5c')
            elif d < 0.2:
                c = rgb('e0301e')
            elif d < 0.35:
                c = lighten(c, 0.25)
        elif SWEEP[1] < i <= SWEEP[1] + 3:               # kurz nachglühend
            c = lighten(c, 0.2 * (SWEEP[1] + 4 - i) / 4)
        out[y + PT, x + PL] = c
    return out


# --- Dajan ----------------------------------------------------------------------
GLINT = ('d8c386', 'fffeb9')


def f_dajan(i):
    body, dagger, blood = load('body'), load('dagger'), load('blood')
    blink(body, i)
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)   # der Lichtreflex funkelt
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        if x >= 14 and y <= 8 and hexc(body[y, x]) in GLINT:
            base = rgb(hexc(body[y, x]))
            body[y, x] = lighten(base, 0.8 * f) if f > 0.5 else [int(v * (0.75 + 0.5 * f)) for v in base[:3]] + [255]
    comp = body.copy()
    for part in (dagger, blood):
        m = part[:, :, 3] > 0
        comp[m] = part[m]
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, comp, b)
    fill_pinholes(out)
    # Blut rinnt die Klinge hinab (Spalte 13, Zeile 5 -> 9) und tropft vom rechten Ende der
    # Parierstange (15, 10) zu Boden (Zeile 24)
    for t0 in (0, 16, 32):
        t = (i - t0) % N
        if t < 10:
            y = 5 + t // 2
            out[y + PT + b, 13 + PL] = BLOOD[2] if t % 2 == 0 else BLOOD[1]
        if 8 <= t < 30:
            for (x, y), c in drop_pixels(t - 8, 15 + PL, 10 + PT + (b if t < 12 else 0), 24 + PT).items():
                out[y, x] = c
    return out


FRAME = dict(mao=f_mao, hunter=f_mao, dajan=f_dajan)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
