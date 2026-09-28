# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGuardianBeasts-Heroes und -Skins.

Aufruf: python3 guardianbeasts.py <tag> [ms] <variante>

* mao / hunter: Mao, the Vengeful Guardian bzw. Vengeful Hunter Mao federn und
            blinzeln; die Hand vor der Brust (rot bzw. weiß) holt nach links aus, zieht
            den Schlitzer am Bogen entlang nach rechts und kehrt zur Brust zurück, der Arm
            reicht dabei von der Schulter zur Hand; die Schlitzspur ihrer blutigen Klauen (der dunkelrote Bogen
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
                hand=dict(box=(11, 14, 15, 18), core=((12, 15), (13, 15), (12, 16), (13, 16)), hole=('1e1e1e', '262626', '333333'),
                          outline='4f0611', arm=(('3a3a3a', '474747', '2c2c2c'), '080808'), shoulder=(8, 14)),
                blink={'halb': [((10, 10), 'dacfd5'), ((11, 10), 'dacfd5'), ((14, 10), 'dacfd5'), ((15, 10), 'dacfd5')],
                       'zu': [((10, 10), 'dacfd5'), ((11, 10), 'dacfd5'), ((14, 10), 'dacfd5'), ((15, 10), 'dacfd5'),
                              ((10, 11), '000000'), ((11, 11), '000000'), ((14, 11), '000000'), ((15, 11), '000000')]}),
    'hunter': dict(slug='vengeful-hunter-mao', knee=19,
                   hand=dict(box=(12, 13, 14, 15), core=((12, 13), (13, 13), (12, 14), (13, 14)), hole=('696866', '7d8286', '5a5958'),
                             outline='4a4949', arm=(('8a8f93', '9ea3a7', '7d8286'), '3a3939'), shoulder=(9, 13)),
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
SWEEP = (36, 39)                                         # neuer Schlitzer, links -> rechts


def slash_param(sl):
    """Für jedes Pixel der Spur die Lage t entlang des Bogens (0 = linkes Ende, 1 = rechtes Ende):
    Winkel um den Punkt über der Bogenmitte."""
    ys, xs = np.nonzero(sl[:, :, 3])
    cx, cy = (xs.min() + xs.max()) / 2, ys.min() - 1.0
    th = np.arctan2(ys - cy, xs - cx)
    t = (th.max() - th) / (th.max() - th.min())
    return {(int(x), int(y)): float(v) for x, y, v in zip(xs, ys, t)}


def arc_point(t):
    """Mitte der Schlitzspur an der Stelle t."""
    pts = [(x, y) for (x, y), tt in SLASH_T.items() if abs(tt - t) < 0.07]
    return np.mean([p[0] for p in pts]), np.mean([p[1] for p in pts])


def ease(u):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, u)))


def hand_target(i, rest):
    """Wohin die Hand in Frame i will (Welt-Koordinaten des Sprites): Ausholen zum linken Ende
    des Bogens, dann mit dem Kopf des Schlitzers entlang, dann zurück zur Brust."""
    p0, p1 = arc_point(0.0), arc_point(1.0)
    if SWEEP[0] - 3 <= i < SWEEP[0]:                 # schnelles Ausholen
        u = ease((i - SWEEP[0] + 4) / 3)
        return rest[0] + (p0[0] - rest[0]) * u, rest[1] + (p0[1] - rest[1]) * u
    if SWEEP[0] <= i <= SWEEP[1]:
        head = (i - SWEEP[0] + 1) / (SWEEP[1] - SWEEP[0] + 1) * 1.2
        return arc_point(min(1.0, head))
    if SWEEP[1] < i <= SWEEP[1] + 3:
        u = ease((i - SWEEP[1]) / 3)
        return p1[0] + (rest[0] - p1[0]) * u, p1[1] + (rest[1] - p1[1]) * u
    return rest


def draw_arm(out, a, b, cols):
    """3 px dicker Arm von a nach b (Ausgabe-Koordinaten) mit Felltextur (Strähnen entlang des
    Arms) und durchgehender 1-px-Kontur, damit er sich vom Körper abhebt (nur an der Schulter
    geht er in den Körper über)."""
    fur, line = [rgb(c) for c in cols[0]], rgb(cols[1])
    L = max(1e-6, math.hypot(b[0] - a[0], b[1] - a[1]))
    ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    h, w = out.shape[:2]
    m = np.zeros((h, w), bool)
    col = {}
    for y in range(h):
        for x in range(w):
            px, py = x + 0.5 - a[0], y + 0.5 - a[1]
            s = px * ux + py * uy                        # entlang des Arms
            q = -px * uy + py * ux                       # quer dazu
            if -0.5 <= s <= L + 0.5 and abs(q) <= 1.55:
                m[y, x] = True
                col[(x, y)] = fur[(int(math.floor(s / 2)) + int(math.floor(q + 1.5))) % 3]
    ring = np.zeros_like(m)
    ring[1:] |= m[:-1]
    ring[:-1] |= m[1:]
    ring[:, 1:] |= m[:, :-1]
    ring[:, :-1] |= m[:, 1:]
    ring &= ~m
    for y, x in zip(*np.nonzero(ring)):
        if math.hypot(x + 0.5 - a[0], y + 0.5 - a[1]) > 2.2:   # an der Schulter keine Kontur
            out[y, x] = line
    for (x, y), c in col.items():
        out[y, x] = c


def f_mao(i):
    global SLASH_T
    body, sl = load('body'), load('slash')
    if SLASH_T is None:
        SLASH_T = slash_param(sl)
    blink(body, i)
    hc = C['hand']
    x0, y0, x1, y1 = hc['box']
    hand = np.zeros_like(body)                           # Hand samt Kontur ausschneiden
    hand[y0:y1, x0:x1] = body[y0:y1, x0:x1]
    keep = np.zeros(body.shape[:2], bool)
    for x, y in hc['core']:
        keep[y, x] = True
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not keep[y, x] and hexc(body[y, x]) != hc['outline']:
                hand[y, x] = 0
    rest = (np.mean([p[0] for p in hc['core']]), np.mean([p[1] for p in hc['core']]))
    tx, ty = hand_target(i, rest)
    ty = max(ty, rest[1])                                # nie höher als die Brust (Arm nicht übers Gesicht)
    sx, sy = hc['shoulder']
    L = math.hypot(tx - sx, ty - sy)
    if L > 12:                                           # Armlänge begrenzen (die Klauen reichen weiter)
        tx, ty = sx + (tx - sx) * 12 / L, sy + (ty - sy) * 12 / L
    ox, oy = int(round(tx - rest[0])), int(round(ty - rest[1]))
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    if ox or oy:                                         # Brust unter der Hand schließen
        for y in range(y0, y1):
            for x in range(x0, x1):
                if hand[y, x, 3]:                        # Felltextur statt einer Farbe
                    body[y, x] = rgb(hc['hole'][(x + 2 * y) % 3])
    knee_put(out, body, b)
    fill_pinholes(out)
    draw_slash(out, sl, i)
    if ox or oy:                                         # Arm und Hand vor Körper und Spur
        draw_arm(out, (sx + PL, sy + PT + b), (rest[0] + ox + PL, rest[1] + oy + PT + b), hc['arm'])
        ring = np.zeros(body.shape[:2], bool)
        hm = hand[:, :, 3] > 0
        for y, x in zip(*np.nonzero(hm)):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= y + dy < SH and 0 <= x + dx < SW and not hm[y + dy, x + dx]:
                    ring[y + dy, x + dx] = True
        for y, x in zip(*np.nonzero(ring)):
            out[y + PT + b + oy, x + PL + ox] = rgb(hc['outline'])
        put(out, hand, PL + ox, PT + b + oy)
    return out


def draw_slash(out, sl, i):
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
