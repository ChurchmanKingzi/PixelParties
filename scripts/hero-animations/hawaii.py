# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveHawaii-Heroes.

Aufruf: python3 hawaii.py <tag> [ms] <variante>

Feuer: vorhandene Flammenpixel brennen als Feuer (burn): jede Flammensäule streckt und
staucht sich (der Fuß bleibt), die Zungen wiegen zur Spitze hin seitlich, die Hitze wogt
nach oben (Farbstufen aus den eigenen Farben der Flamme), über den Spitzen reißen
Fetzen ab. Frame 0 ist immer das Originalbild.

* taio:     Taio, the Sun Fencer: federt; um ihn lodert eine Flammenaura; er hebt und senkt
            das Flammenschwert, dessen Klinge brennt.
* taioasc:  Taio, Absorber of the Mountain's Heart: hängt an der Eisenkette und schaukelt
            leicht (Pendel um das obere Kettenende); Flammenhaar und das Feuer unter ihm
            brennen.
* waflav:   Flamebathed Waflav: Feuerflügel und Feuerhörner (und die Flammen an den
            Beinen) brennen, der Oberkörper atmet.
* pele:     Luna Pele, the Flame Dancer: tanzt Hula (die Hüften schwingen, der Oberkörper
            gegenläufig, die Füße bleiben, sie federt im Takt), das Flammenhaar auf Kopf und
            Rücken brennt, sie blinzelt.
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
OUT = os.environ.get('HW_OUT', '.')
FLAME = ('ca2c29', 'f47b22', 'f6e70e', 'f7f5b8')         # Hawaii-Flammen, dunkel -> hell

V_ = {
    'taio': dict(slug='taio-the-sun-fencer', part='body', knee=33, pads=(6, 6, 8, 2)),
    'taioasc': dict(slug='taio-absorber-of-the-mountain-s-heart', part='body', pads=(5, 5, 6, 2)),
    'waflav': dict(slug='flamebathed-waflav', part='body', knee=40, pads=(4, 4, 7, 2)),
    'pele': dict(slug='luna-pele-the-flame-dancer', pads=(5, 5, 7, 2),
                 blink={'halb': [((9, 16), '311800'), ((10, 16), '311800'), ((13, 16), '311800'), ((14, 16), '311800')],
                        'zu': [((9, 16), 'ae8a70'), ((10, 16), 'ae8a70'), ((13, 16), 'ae8a70'), ((14, 16), 'ae8a70'),
                               ((9, 17), '000000'), ((10, 17), '000000'), ((13, 17), '000000'), ((14, 17), '000000')]}),
}
V = next((v for v in sys.argv[2:] if v in V_), 'taio')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def blink(s, i):
    st = BLINK.get(i)
    if st and 'blink' in C:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)


def put(out, s, ox, oy, dy_fn=None, dx_fn=None):
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy = y + oy + (dy_fn(x, y) if dy_fn else 0)
        xx = x + ox + (dx_fn(x, y) if dx_fn else 0)
        if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
            out[yy, xx] = s[y, x]


def flame_mask(s):
    return np.array([[s[y, x, 3] > 0 and hexc(s[y, x]) in FLAME for x in range(s.shape[1])] for y in range(s.shape[0])])


# --- Feuer ----------------------------------------------------------------------
def burn(img, mask, i, seed=0, stretch=1.6, sway=0.9, flakes=True):
    """Die Flammenpixel (mask) von img als lodernde Flammen; Rückgabe {(x, y): Farbe} in
    img-Koordinaten (auch oberhalb/seitlich des Bildes). Benachbarte Spalten bewegen sich fast
    gleich (zusammenhängende Zungen statt Rauschen), Löcher werden geschlossen. Frame 0 = Original."""
    w = 2 * math.pi * i / N
    cols = sorted({hexc(img[y, x]) for y, x in zip(*np.nonzero(mask))}, key=lambda c: lum(rgb(c)))
    rank = {c: k for k, c in enumerate(cols)}
    n = max(1, len(cols) - 1)
    pal = [rgb(c) for c in cols]
    res = {}
    for x in range(mask.shape[1]):
        ys = np.nonzero(mask[:, x])[0]
        if not len(ys):
            continue
        runs, start = [], ys[0]
        for a_, c_ in zip(ys, list(ys[1:]) + [None]):
            if c_ is None or c_ != a_ + 1:
                runs.append((start, a_))
                start = c_
        for top, base in runs:
            h0 = base - top + 1
            ph = 0.35 * x + seed
            d = stretch * (math.sin(6 * w + ph) - math.sin(ph)) / 2 + \
                0.5 * stretch * (math.sin(4 * w - 0.23 * x + seed) - math.sin(-0.23 * x + seed)) / 2
            hh = max(1.0, h0 + d * min(1.0, h0 / 4))
            for y in range(int(math.floor(base - hh + 1)), base + 1):
                sy = base - int(round((base - y) * (h0 - 1) / max(1e-6, hh - 1))) if hh > 1 else base
                sy = min(base, max(top, sy))
                rel = (base - y) / max(1.0, hh)
                r = rank[hexc(img[sy, x])] / n + 0.12 * (math.sin(4 * w + 0.25 * x + 0.15 * y + seed)
                                                         - math.sin(0.25 * x + 0.15 * y + seed))
                col = pal[int(round(min(1.0, max(0.0, r)) * n))]
                dx = int(round(sway * rel ** 1.5 * (math.sin(4 * w - 0.35 * y + 0.25 * x) - math.sin(-0.35 * y + 0.25 * x))))
                res[(x + dx, y)] = col
            if flakes and h0 >= 5 and math.sin(1.3 * x + 2.0 + seed) > 0.75:
                p = (i + x * 5 + seed * 7) % 16
                if 0 < p < 4:                             # Fetzen reißt ab und steigt auf (nie in Frame 0)
                    ty = int(math.floor(base - hh + 1)) - 1 - p
                    if (x, ty) not in res:
                        res[(x, ty)] = pal[min(n, n // 3)] if p < 3 else pal[0]
    for _ in range(2):                                   # Löcher schließen (3 von 4 Nachbarn brennen)
        add = {}
        xs_ = [k[0] for k in res]
        ys_ = [k[1] for k in res]
        for y in range(min(ys_), max(ys_) + 1):
            for x in range(min(xs_), max(xs_) + 1):
                if (x, y) in res:
                    continue
                nb = [res[q] for q in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)) if q in res]
                if len(nb) >= 3:
                    add[(x, y)] = max(nb, key=lambda c: nb.count(c) + 0.001 * lum(c))
        res.update(add)
    return res


def draw_fire(out, res, ox, oy, only_empty=False, dx_fn=None):
    for (x, y), c in res.items():
        xx = x + ox + (dx_fn(x, y) if dx_fn else 0)
        yy = y + oy
        assert 0 < xx < out.shape[1] - 1 and 0 < yy < out.shape[0] - 1, f'Feuer am Rand: {(xx, yy)}'
        if not only_empty or not out[yy, xx, 3]:
            out[yy, xx] = c


def aura(out, fig, i, pal=FLAME, reach=3.0):
    """Flammenaura um die Figur (fig: Maske in Ausgabe-Koordinaten), hinter ihr: senkrechte Zungen
    steigen auf (nach oben reicht die Hitze weit, seitlich und unten kaum), außen rot, innen
    orange, nur an den heißesten Stellen gelb."""
    w = 2 * math.pi * i / N
    Hh, Ww = fig.shape
    fy, fx = np.nonzero(fig)
    for y in range(1, Hh - 1):
        for x in range(1, Ww - 1):
            if fig[y, x]:
                continue
            m = (np.abs(fx - x) <= reach + 1) & (fy >= y - 3) & (fy <= y + 10)
            if not m.any():
                continue
            dyv = fy[m] - y                              # > 0: Figur liegt darunter (Flamme steigt von ihr auf)
            ab = dyv > 0
            d_up = np.min(np.hypot(fx[m][ab] - x, dyv[ab] * 0.38)) if ab.any() else 99.0
            d_any = np.min(np.hypot(fx[m] - x, dyv))
            nz = 0.5 * math.sin(1.25 * x + 0.35 * y + 6 * w) + 0.5 * math.sin(0.8 * x - 0.25 * y + 4 * w + 1.7)
            h = max(1 - d_up / reach, 0.5 * (1 - d_any / 1.6)) + 0.35 * nz   # seitlich/unten nur ein roter Saum
            if h > 0.85:
                c = pal[2]
            elif h > 0.55:
                c = pal[1]
            elif h > 0.2:
                c = pal[0]
            else:
                continue
            if not out[y, x, 3]:
                out[y, x] = rgb(c)


# --- Varianten ------------------------------------------------------------------
def f_taio(i):
    body, sword = SRC.copy(), load('sword')
    b = BOUNCE12[i % 12]
    lift = -int(round(2 * (0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N))))   # Schwert heben und senken
    hand = np.zeros_like(body)                           # Faust am Heft geht mit dem Schwert
    sel = (_xs >= 14) & (_ys >= 15) & (_ys <= 22) & (body[:, :, 3] > 0)
    hand[sel] = body[sel]
    out = np.zeros((H, W, 4), int)
    fig = np.zeros((H, W), bool)
    for s_, dy in ((body, 0), (hand, lift), (sword, lift)):
        for y, x in zip(*np.nonzero(s_[:, :, 3])):
            yy = y + PT + dy + (b if y < KNEE else 0)
            if s_ is body:
                fig[yy, x + PL] = True
    aura(out, fig, i)
    tmp = np.zeros((H, W, 4), int)
    put(tmp, body, PL, PT, dy_fn=lambda x, y: b if y < KNEE else 0)
    put(tmp, hand, PL, PT + lift + b)
    blade = (sword[:, :, 3] > 0) & (_ys <= 16)
    hilt = sword.copy()
    hilt[blade] = 0
    put(tmp, hilt, PL, PT + lift + b)
    draw_fire(tmp, burn(sword, blade, i, seed=2, stretch=1.4, sway=0.7), PL, PT + lift + b)
    fill_pinholes(tmp)
    m = tmp[:, :, 3] > 0
    out[m] = tmp[m]
    return out


def f_taioasc(i):
    body, chain, flask, staff, fire = SRC.copy(), load('chain'), load('flask'), load('staff'), load('fire')
    w = 2 * math.pi * i / N
    swing = lambda x, y: int(round(2.2 * max(0, y) / 35 * math.sin(w)))   # Pendel um das obere Kettenende
    out = np.zeros((H, W, 4), int)
    draw_fire(out, burn(fire, fire[:, :, 3] > 0, i, seed=1, stretch=2.0, sway=1.0), PL, PT)
    fm = flame_mask(body)
    rest = body.copy()
    rest[fm] = 0
    put(out, rest, PL, PT, dx_fn=swing)
    draw_fire(out, burn(body, fm, i, seed=3, stretch=1.5, sway=0.9), PL, PT, dx_fn=swing)
    for s_ in (staff, flask, chain):
        put(out, s_, PL, PT, dx_fn=swing)
    fill_pinholes(out)
    return out


def f_waflav(i):
    body, wings = SRC.copy(), load('wings')
    b = [0, 0, 0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0][i % 24]
    up = lambda x, y: b if y < KNEE else 0
    out = np.zeros((H, W, 4), int)
    draw_fire(out, burn(wings, wings[:, :, 3] > 0, i, seed=4, stretch=2.4, sway=1.2), PL, PT + b)
    fm = flame_mask(body)
    rest = body.copy()
    rest[fm] = 0
    put(out, rest, PL, PT, dy_fn=up)
    if b < 0:                                            # Naht über den Beinen schließen
        for x in range(SW):
            if rest[KNEE - 1, x, 3] and rest[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = rest[KNEE - 1, x]
    upper, lower = fm & (_ys < KNEE), fm & (_ys >= KNEE)
    draw_fire(out, burn(body, upper, i, seed=5, stretch=1.6, sway=0.9), PL, PT + b)
    draw_fire(out, burn(body, lower, i, seed=6, stretch=1.2, sway=0.7), PL, PT)
    fill_pinholes(out)
    return out


def f_pele(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N                          # zwei Hüftschwünge pro Loop

    def prof(y):                                         # Füße fest, Hüfte am stärksten, Schultern gegenläufig
        if y >= 29:
            return 0.0
        if y >= 22:
            return (29 - y) / 7
        if y >= 16:
            return 1.0 - (22 - y) / 6 * 1.4
        return -0.4 * max(0.0, (y - 8) / 8)
    dx = lambda x, y: int(round(1.8 * prof(y) * math.sin(w)))
    bob = int(round(0.5 - 0.5 * math.cos(2 * w)))        # federt im Takt (in den Knien)
    dy = lambda x, y: bob if y < 27 else 0
    fm = flame_mask(s) & ~((_xs >= 5) & (_xs <= 16) & (_ys >= 14))   # Strähnen vor dem Körper bleiben
    rest = s.copy()
    rest[fm] = 0
    out = np.zeros((H, W, 4), int)
    fire = burn(s, fm, i, seed=7, stretch=1.3, sway=0.8)
    hair = {}                                            # Haarflammen mit dem Körper mitbewegen
    for (x, y), c in fire.items():
        yy = min(max(y, 0), SH - 1)
        hair[(x + dx(x, yy), y + dy(x, yy))] = c
    for (x, y), c in hair.items():                       # das Haar liegt hinter dem Körper
        out[y + PT, x + PL] = c
    tmp = np.zeros((H, W, 4), int)
    put(tmp, rest, PL, PT, dy_fn=dy, dx_fn=dx)
    fill_pinholes(tmp)
    m = tmp[:, :, 3] > 0
    out[m] = tmp[m]
    return out


FRAME = dict(taio=f_taio, taioasc=f_taioasc, waflav=f_waflav, pele=f_pele)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
