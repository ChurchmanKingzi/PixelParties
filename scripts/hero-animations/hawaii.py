# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveHawaii-Heroes.

Aufruf: python3 hawaii.py <tag> [ms] <variante>

Feuer: vorhandene Flammenpixel brennen als Feuer (burn): jede Flammensäule streckt und
staucht sich (der Fuß bleibt), die Zungen wiegen zur Spitze hin seitlich, die Hitze wogt
nach oben (Farbstufen aus den eigenen Farben der Flamme), über den Spitzen reißen
Fetzen ab. Frame 0 ist immer das Originalbild.

* taio:     Taio, the Sun Fencer: federt; um ihn lodert eine Flammenaura; seine linke Hand hält den
            Griff, er hebt und senkt das Flammenschwert (Unterarm geht mit), die Klinge brennt.
            Die Farbfolge der Flammen (innen fast weiß, dann gelb, orange, außen rot) bleibt
            bei Taio, Ascended Taio und Waflavs Hörnern fest, nur die Form lodert.
* taioasc:  Taio, Absorber of the Mountain's Heart: hängt an der Eisenkette und schaukelt
            leicht (Pendel um das obere Kettenende); das Flammenhaar brennt, am gedrehten
            Flammenschwert (Klinge nach unten) flackert die Klinge und die Spitze züngelt.
* waflav:   Flamebathed Waflav steht, hebt und senkt die Klauen neben dem Kopf in kleinen,
            unregelmäßigen Gesten, der Mund geht ab und zu leicht zu (der Unterkiefer schiebt
            sich hoch), er blinzelt; die Feuerflügel sind ein Flammenfeld
            (Zungen steigen von unten nach oben durch die Flügel und züngeln über den Rand),
            Feuerhörner und die Flammen an den Beinen brennen.
* pele:     Luna Pele, the Flame Dancer: tanzt Hula (die Hüften schwingen, der Oberkörper
            gegenläufig, die Füße bleiben, sie federt im Takt), das Flammenhaar auf Kopf und
            Rücken brennt, sie blinzelt.
* tempeste / tempeluna: schweben auf und ab, schlagen mit den Flügeln, die Locke oben weht im
            Wind, sie blinzeln; die Kontur (Tempeste türkis, Tempeluna links rot, rechts türkis)
            wird jedes Frame neu um die ganze Figur gelegt – sie bleibt immer um die Flügel.
* moana:    Tempeste Moana singt (der Mund geht in Phrasen auf und zu), neben ihr steigen kleine
            Noten auf, die Haare wehen im Wind, sie tanzt langsam (Hüftschwung, sacht federnd).
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes, shear_flap
from anim_common import ring8

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
N = 48
OUT = os.environ.get('HW_OUT', '.')
FLAME = ('ca2c29', 'f47b22', 'f6e70e', 'f7f5b8')         # Hawaii-Flammen, dunkel -> hell

V_ = {
    'taio': dict(slug='taio-the-sun-fencer', part='body', knee=35, pads=(6, 6, 10, 2)),
    'taioasc': dict(slug='taio-absorber-of-the-mountain-s-heart', part='body', pads=(5, 5, 6, 5)),
    'waflav': dict(slug='flamebathed-waflav', part='body', pads=(4, 4, 7, 3),
                   blink={'halb': [((40, 30), '5a7080'), ((45, 30), '5a7080')],
                          'zu': [((40, 30), '000000'), ((45, 30), '000000')]}),
    'pele': dict(slug='luna-pele-the-flame-dancer', pads=(5, 5, 7, 2),
                 blink={'halb': [((9, 16), '311800'), ((10, 16), '311800'), ((13, 16), '311800'), ((14, 16), '311800')],
                        'zu': [((9, 16), 'ae8a70'), ((10, 16), 'ae8a70'), ((13, 16), 'ae8a70'), ((14, 16), 'ae8a70'),
                               ((9, 17), '000000'), ((10, 17), '000000'), ((13, 17), '000000'), ((14, 17), '000000')]}),
    'tempeste': dict(slug='tempeste-the-weather-fairy', pads=(5, 6, 5, 5), outline={'34fcff'},
                     wings=({'f6ffff', 'b4f6ff'}, {'f6ffff', 'b4f6ff'}), pivots=(5, 12),
                     blink={'halb': [((7, 12), '0093b3'), ((10, 12), '0093b3')],
                            'zu': [((7, 11), '152f66'), ((10, 11), '152f66'), ((7, 12), '000000'), ((10, 12), '000000')]}),
    'tempeluna': dict(slug='tempeluna-the-convergence-fairy', pads=(5, 6, 5, 5), outline={'34fcff', 'ff0000'},
                      wings=({'ffdd00', 'ffaa00', 'ff8b00'}, {'f6ffff', 'b4f6ff'}), pivots=(5, 12),
                      blink={'halb': [((7, 12), '630000'), ((10, 12), '0093b3')],
                             'zu': [((7, 11), '3f0909'), ((10, 11), '152f66'), ((7, 12), '000000'), ((10, 12), '000000')]}),
    'moana': dict(slug='tempeste-moana-the-rain-singer', pads=(5, 9, 9, 2)),
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
def burn(img, mask, i, seed=0, stretch=1.6, sway=0.9, flakes=True, heat=0.12):
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
                r = rank[hexc(img[sy, x])] / n + heat * (math.sin(4 * w + 0.25 * x + 0.15 * y + seed)
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
    body, sword, hnd = SRC.copy(), load('sword'), load('hand')
    b = BOUNCE12[i % 12]
    lift = -int(round(2 * (0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N))))   # Schwert heben und senken
    hys, hxs = np.nonzero(hnd[:, :, 3])
    arm = np.zeros_like(body)                            # Unterarm unter der Hand geht mit (Original bleibt darunter)
    sel = (_xs >= hxs.min() - 1) & (_ys >= hys.min() - 2) & (_ys <= hys.max() + 3) & (body[:, :, 3] > 0)
    arm[sel] = body[sel]
    out = np.zeros((H, W, 4), int)
    fig = np.zeros((H, W), bool)
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        fig[y + PT + (b if y < KNEE else 0), x + PL] = True
    aura(out, fig, i)
    tmp = np.zeros((H, W, 4), int)
    put(tmp, body, PL, PT, dy_fn=lambda x, y: b if y < KNEE else 0)
    if b < 0:                                            # beim Strecken die Zeile über der Kniekante dehnen
        for x in range(SW):
            if body[KNEE - 1, x, 3] and body[KNEE, x, 3] and not tmp[KNEE - 1 + PT, x + PL, 3]:
                tmp[KNEE - 1 + PT, x + PL] = body[KNEE - 1, x]
    put(tmp, arm, PL, PT + lift + b)
    blade = (sword[:, :, 3] > 0) & (_ys <= 16)
    hilt = sword.copy()
    hilt[blade] = 0
    put(tmp, hilt, PL, PT + lift + b)
    draw_fire(tmp, burn(sword, blade, i, seed=2, stretch=1.4, sway=0.7, heat=0.0), PL, PT + lift + b)
    put(tmp, hnd, PL, PT + lift + b)                     # die Hand hält den Griff
    fill_pinholes(tmp)
    m = tmp[:, :, 3] > 0
    out[m] = tmp[m]
    return out


def f_taioasc(i):
    body, chain, sword, staff = SRC.copy(), load('chain'), load('sword'), load('staff')
    w = 2 * math.pi * i / N
    swing = lambda x, y: int(round(2.2 * max(0, y) / 40 * math.sin(w)))   # Pendel um das obere Kettenende
    out = np.zeros((H, W, 4), int)
    # das gedrehte Flammenschwert (Klinge nach unten) liegt über der Hüfte, die Hand über dem Knauf;
    # die Klinge züngelt, die Farbfolge (innen hell, außen rot) bleibt dabei fest
    ys, xs = np.nonzero(sword[:, :, 3])
    guard = int(ys.min()) + 12                            # unterhalb der Parierstange beginnt die Klinge
    blade = (sword[:, :, 3] > 0) & (_ys >= guard)
    hilt = sword.copy()
    hilt[blade] = 0
    fm = flame_mask(body)
    rest = body.copy()
    rest[fm] = 0
    put(out, rest, PL, PT, dx_fn=swing)
    draw_fire(out, burn(body, fm, i, seed=3, stretch=1.5, sway=0.9, heat=0.0), PL, PT, dx_fn=swing)
    put(out, hilt, PL, PT, dx_fn=swing)                  # das Schwert liegt über der Hüfte ...
    fl = burn(sword[::-1], blade[::-1], i, seed=8, stretch=1.2, sway=0.8, flakes=False, heat=0.0)
    draw_fire(out, {(x, SH - 1 - y): c for (x, y), c in fl.items()}, PL, PT, dx_fn=swing)
    put(out, load('hand'), PL, PT, dx_fn=swing)          # ... die Hand über dem Knauf
    put(out, staff, PL, PT, dx_fn=swing)
    put(out, chain, PL, PT, dx_fn=swing)
    fill_pinholes(out)
    return out


def fire_field(img, mask, i, seed=0, reach=4, tongue=3.0):
    """Flammenfeld für große Feuerflächen (Waflavs Flügel): auch der Umriss lodert (die Säulen
    strecken und stauchen sich an den Spitzen um bis zu ±tongue px und wiegen seitlich), darin
    steigen Flammenzungen (senkrecht gestreckte Hitzeflecken) von unten nach oben, an den Rändern
    züngeln sie bis zu reach Pixel über die Silhouette hinaus.
    Rückgabe {(x, y): Farbe} in img-Koordinaten."""
    w = 2 * math.pi * i / N
    heat = {'ca2c29': 0.3, 'f47b22': 0.55, 'f6e70e': 0.78, 'f7f5b8': 1.0}
    h, wd = mask.shape
    hb = np.zeros((h + reach, wd))
    # 1) die Silhouette lodert: jede Flammensäule streckt/staucht sich an der Spitze (benachbarte
    #    Säulen ähnlich -> zusammenhängende Zungen), zur Spitze hin wiegt sie seitlich
    for x in range(wd):
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
            ph = 0.42 * x + seed
            d = tongue * (0.6 * (math.sin(6 * w + ph) - math.sin(ph)) + 0.4 * (math.sin(4 * w - 0.31 * x) - math.sin(-0.31 * x)))
            hh = max(1.0, h0 + d * min(1.0, h0 / 5))
            for y in range(int(math.floor(base - hh + 1)), base + 1):
                sy = base - int(round((base - y) * (h0 - 1) / max(1e-6, hh - 1))) if hh > 1 else base
                sy = min(base, max(top, sy))
                rel = (base - y) / max(1.0, hh)
                dx = int(round(1.3 * rel ** 1.6 * (math.sin(4 * w - 0.3 * y + 0.2 * x + seed) - math.sin(-0.3 * y + 0.2 * x + seed))))
                xx = x + dx
                if 0 <= xx < wd and y + reach >= 0:
                    hb[y + reach, xx] = max(hb[y + reach, xx], heat.get(hexc(img[sy, x]), 0.5))
    for _ in range(2):                                   # Löcher der verformten Fläche schließen
        z = hb == 0
        nb = (np.roll(hb, 1, 0) > 0).astype(int) + (np.roll(hb, -1, 0) > 0) + (np.roll(hb, 1, 1) > 0) + (np.roll(hb, -1, 1) > 0)
        fillv = np.maximum.reduce([np.roll(hb, 1, 0), np.roll(hb, -1, 0), np.roll(hb, 1, 1), np.roll(hb, -1, 1)])
        hb[z & (nb >= 3)] = fillv[z & (nb >= 3)]
    hs = hb.copy()                                       # Hitze steigt: nach oben ausgedehnt
    for k in range(1, reach + 1):
        hs[:-k] = np.maximum(hs[:-k], hb[k:] * (1 - 0.22 * k))
    inside = hb > 0
    edge = inside & ~(np.roll(inside, 1, 0) & np.roll(inside, -1, 0) & np.roll(inside, 1, 1) & np.roll(inside, -1, 1))
    res = {}
    for yy in range(h + reach):
        for x in range(wd):
            if hs[yy, x] <= 0:
                continue
            y = yy - reach
            ph = 2.6 * math.sin(0.55 * x + seed) + 0.9 * math.sin(1.37 * x + 2 * seed)   # je Spalte eigene Welle,
            nz = 0.7 * math.sin(0.5 * y + 6 * w + ph) + 0.3 * math.sin(0.95 * y + 4 * w + 1.3 * ph)   # läuft nach oben
            if inside[yy, x]:
                v = hb[yy, x] * (0.86 + 0.26 * nz)
                if not edge[yy, x]:
                    v = max(v, 0.21)                     # innen keine Löcher
            else:
                v = hs[yy, x] * (0.5 + 0.5 * nz) - 0.05
            if v > 0.88:
                c = 'f7f5b8'
            elif v > 0.66:
                c = 'f6e70e'
            elif v > 0.43:
                c = 'f47b22'
            elif v > 0.2:
                c = 'ca2c29'
            else:
                continue
            res[(x, y)] = rgb(c)
    return res


# Klauen: kleine, unregelmäßige Gesten (hoch/runter um 1 px, mit Pausen), links und rechts versetzt
WAF_LA = [0] * 5 + [-1] * 4 + [0] * 9 + [1] * 2 + [0] * 3 + [-1] * 6 + [0] * 7 + [1] * 3 + [0] * 9
WAF_RA = [0] * 11 + [-1] * 3 + [0] * 4 + [-1] * 2 + [0] * 8 + [1] * 4 + [0] * 5 + [-1] * 5 + [0] * 6
WAF_MOUTH = [0] * 7 + [1, 2, 2, 1] + [0] * 10 + [1, 1] + [0] * 6 + [1, 2, 2, 2, 1] + [0] * 7 + [1] + [0] * 6   # 2 = zu


def f_waflav(i):
    body, wings = SRC.copy(), load('wings')
    blink(body, i)
    la, ra, mo = WAF_LA[i], WAF_RA[i], WAF_MOUTH[i]

    def claws(x, y):                                     # nur die äußeren Klauen, der Körper bleibt stehen
        if 29 <= y <= 36 and x <= 34:
            return la
        if 29 <= y <= 36 and x >= 51:
            return ra
        return 0
    out = np.zeros((H, W, 4), int)
    draw_fire(out, fire_field(wings, wings[:, :, 3] > 0, i, seed=4), PL, PT)
    fm = flame_mask(body)
    rest = body.copy()
    rest[fm] = 0
    put(out, rest, PL, PT, dy_fn=claws)
    if mo:                                               # Mund: der Unterkiefer (untere Zähne) schiebt sich hoch
        jaw = np.zeros_like(rest)
        sel = (_ys >= 36) & (_ys <= 38) & (_xs >= 38) & (_xs <= 47) & (rest[:, :, 3] > 0)
        jaw[sel] = rest[sel]
        put(out, jaw, PL, PT - mo)
    draw_fire(out, burn(body, fm, i, seed=5, stretch=1.6, sway=0.9, heat=0.0), PL, PT)
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


# --- Etappe 2: Feen und Sängerin ------------------------------------------------
def f_fairy(i):
    """Tempeste / Tempeluna: schweben auf und ab, schlagen mit den Flügeln (spaltentreue Scherung),
    die Locke oben weht im Wind (nach rechts), sie blinzeln; die 1-px-Kontur wird jedes Frame neu
    um die ganze Figur gelegt – bei Tempeluna links rot, rechts türkis wie im Original."""
    s = SRC.copy()
    op = s[:, :, 3] > 0
    olm = op & np.array([[hexc(s[y, x]) in C['outline'] for x in range(SW)] for y in range(SH)])
    ocol = {}                                            # Konturfarbe je Seite (nächstes Original-Konturpixel)
    oys, oxs = np.nonzero(olm)
    inner = s.copy()
    inner[olm] = 0
    blink(inner, i)
    lw, rw = C['wings']
    iop = inner[:, :, 3] > 0
    wing = iop & (_ys >= 8) & (_ys <= 17) & np.array(
        [[(x <= 4 and hexc(inner[y, x]) in lw) or (x >= 13 and hexc(inner[y, x]) in rw) for x in range(SW)] for y in range(SH)])
    hv = int(round(1.5 * math.sin(2 * math.pi * 2 * i / N)))   # steigt auf und ab
    w = 2 * math.pi * 2 * i / N

    def curl(x, y):                                      # die Locke / die Haare oben wehen im Wind nach rechts
        if y <= 7 and not wing[y, x]:
            return int(round(1.3 * (7 - y) / 7 * (0.5 - 0.5 * math.cos(w - 0.5 * y)) * 2 - 1.3 * (7 - y) / 7 * (0.5 - 0.5 * math.cos(-0.5 * y)) * 2))
        return 0
    body = inner.copy()
    body[wing] = 0
    fig = np.zeros((H, W, 4), int)
    put(fig, body, PL, PT + hv, dx_fn=curl)
    lift = 0.5 * math.sin(2 * math.pi * 3 * i / N)
    pl, pr = C['pivots']
    shear_flap(inner, wing & (_xs <= 4), pl, -1, lift, 1.0, fig, offset=(PL, PT + hv))
    shear_flap(inner, wing & (_xs >= 13), pr, 1, lift, 1.0, fig, offset=(PL, PT + hv))
    fill_pinholes(fig)
    ring = ring8(fig[:, :, 3] > 0)
    out = fig.copy()
    for y, x in zip(*np.nonzero(ring)):
        sx, sy = x - PL, y - PT - hv
        k = np.argmin((oxs - sx) ** 2 + (oys - sy) ** 2)
        out[y, x] = s[oys[k], oxs[k]]
    return out


# Tempeste Moana: singt – Mund (0 = offen wie im Bild, 1 = halb, 2 = zu), Phrasen mit Atempausen
MOANA_MOUTH = [0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 2, 2,
               2, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 1, 1, 0]
NOTE = [(1, 0), (1, 1), (2, 1), (1, 2), (0, 3), (1, 3), (0, 4), (1, 4)]   # Achtelnote (3 x 5)
NOTES = None


def moana_base(i):
    s = SRC.copy()
    mo = MOANA_MOUTH[i]
    if mo >= 1:
        s[9, 8] = s[9, 9] = rgb('b38e73')
    if mo == 2:
        s[10, 7] = rgb('ae8a70')
        s[10, 8] = rgb('800005')
    w = 2 * math.pi * i / N                               # langsamer Tanz: ein Hüftschwung pro Loop
    op = s[:, :, 3] > 0
    hair = op & np.array([[hexc(s[y, x]) in ('000540', '002ad0', '0075f0', '154fe2', '479af6', '86bdfd', '0020b8', '000b92')
                           for x in range(SW)] for y in range(SH)]) & ((_xs <= 4) | (_xs >= 15)) & (_ys >= 8)

    def dx(x, y):
        sway = 0.0
        if y >= 12:                                      # Hüfte schwingt, Füße bleiben
            sway = (1.3 if y <= 20 else 1.3 * (24 - y) / 4) * math.sin(w)
        elif y >= 8:
            sway = -0.5 * math.sin(w) * (y - 8) / 4
        wind = 0.0
        if hair[y, x]:                                   # die Haare wehen im Wind nach rechts, unten stärker
            wind = 1.2 * (y - 8) / 16 * (0.5 - 0.5 * math.cos(2 * w * 2 - 0.4 * y)) * 2 - 1.2 * (y - 8) / 16 * (0.5 - 0.5 * math.cos(-0.4 * y)) * 2
        return int(round(sway + wind))
    bob = int(round(0.5 - 0.5 * math.cos(2 * w)))        # federt sacht im Takt
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dx_fn=dx, dy_fn=lambda x, y: bob if y < 20 else 0)
    fill_pinholes(out)
    return out


def moana_notes():
    """Noten steigen neben ihr auf (rechts vom Mund), wackeln und verblassen; nie an der Figur."""
    fig = np.zeros((H, W), bool)
    for k in range(N):
        fig |= moana_base(k)[:, :, 3] > 0
    fig |= ring8(fig)
    res = []
    rng = np.random.default_rng(5)
    tries = 0
    while len(res) < 6 and tries < 4000:
        tries += 1
        e = int(rng.integers(N))
        L = int(rng.integers(12, 17))
        x0 = rng.uniform(PL + SW - 4, W - 5)
        y0 = rng.uniform(PT + 4, PT + 12)
        path, ok = [], True
        for a in range(L):
            nx = int(round(x0 + 0.35 * a + 0.8 * math.sin(0.7 * a + e)))
            ny = int(round(y0 - 0.8 * a))
            for dx_, dy_ in NOTE:
                X, Y = nx + dx_, ny + dy_
                if not (1 <= X < W - 1 and 1 <= Y < H - 1) or fig[Y, X]:
                    ok = False
            path.append((nx, ny))
        if ok and all(min(abs(e - r[0]), N - abs(e - r[0])) > 5 for r in res):
            res.append((e, L, path))
    return res


def f_moana(i):
    global NOTES
    out = moana_base(i)
    if NOTES is None:
        NOTES = moana_notes()
    for k, (e, L, path) in enumerate(NOTES):
        a = (i - e) % N
        if a >= L:
            continue
        nx, ny = path[a]
        col = rgb(('ffffff', 'fff763', 'efaae7')[k % 3], 255 if a < L - 3 else 150)
        for dx_, dy_ in NOTE:
            out[ny + dy_, nx + dx_] = col
    return out


FRAME = dict(taio=f_taio, taioasc=f_taioasc, waflav=f_waflav, pele=f_pele, tempeste=f_fairy, tempeluna=f_fairy,
             moana=f_moana)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
