# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGrailWar-Heroes und -Skins.

Aufruf: python3 grailwar.py <tag> [ms] <variante>

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu je Variante:
* asriel:    Asriel, the Sapling Sacrificer: lacht in der Loop-Mitte manisch
             (Mund reißt auf – Zähne, dunkler Rachen – und schließt sich im
             Takt, der Oberkörper bebt dabei); Blut läuft die Messerklinge
             hinab und tropft unter der Faust vom Knauf zu Boden.
* barker:    Barker, the Monster Tamer: Federn, Blinzeln, die rote
             Bemalung glimmt auf und ab.
* blackstache: der Geisterpirat federt, blinzelt mit den gelben Augen, sein
             durchscheinender Körper flackert leicht, über die Säbelklinge
             läuft ein Lichtreflex.
* chuck:     Federn, Blinzeln; im Bier steigen Bläschen auf, auf der
             Schaumkrone platzt ab und zu eins.
* codumbus:  Federn; der Globus dreht sich (Land und Meer wandern, das Licht
             bleibt stehen, der Rand bleibt fest).
* devlin / mmdevlin: Federn; von den Krallen tropft Blut (Tropfen bildet
             sich, fällt, zerplatzt am Boden).
* enigma:    das Kind in der Kutte hüpft fröhlich; beim Blinzeln wird aus
             dem Kreuzauge ein lachendes „^“.
* krates:    Federn, Blinzeln; sein Jo-Jo schnellt am Faden hoch und fällt
             wieder, und dreht sich dabei.
* key:       Federn, Blinzeln.
* kyli:      die schwarzen Äste wiegen sich (oben stärker), die roten Augen
             glühen auf.
"""
import math
import os
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
N = 48
OUT = os.environ.get('GW_OUT', '.')

V_ = {
    'asriel': dict(slug='asriel-the-sapling-sacrificer', knee=18, pads=(3, 3, 3, 2),
                   lid=[((7, 7), 'f6cd8b'), ((8, 7), 'f6cd8b'), ((11, 7), 'f6cd8b'), ((12, 7), 'f6cd8b')],
                   line=[(7, 8), (8, 8), (11, 8), (12, 8)]),
    'barker': dict(slug='barker-the-monster-tamer', knee=22,
                   lid=[((7, 10), 'f8bc77'), ((12, 10), 'f8bc77')], line=[(7, 11), (12, 11)]),
    'blackstache': dict(slug='blackstache-scourge-of-the-pixel-seas', knee=20,
                        line=[(33, 10), (34, 10), (37, 10), (38, 10)]),
    'chuck': dict(slug='chuck-the-crazy-veteran', knee=18, line=[(13, 6), (17, 6)]),
    'codumbus': dict(slug='codumbus-the-clueless-voyager', knee=21),
    'devlin': dict(slug='devlin-the-masked-butcher', knee=20),
    'mmdevlin': dict(slug='mass-murderer-devlin', knee=20),
    'enigma': dict(slug='enigma-the-seller-of-secrets', pads=(3, 3, 4, 2)),
    'krates': dict(slug='krates-the-smartass', knee=23,
                   lid=[((7, 10), 'f6cd8b'), ((8, 10), 'f6cd8b'), ((11, 10), 'f6cd8b'), ((12, 10), 'f6cd8b')],
                   line=[(7, 11), (8, 11), (11, 11), (12, 11)]),
    'key': dict(slug='key-the-cursed-thief', knee=20,
                lid=[((5, 9), 'f6cd8b'), ((6, 9), 'f6cd8b'), ((9, 9), 'f6cd8b')],
                line=[(5, 10), (6, 10), (9, 10)]),
    'kyli': dict(slug='kyli-the-deceptive-sapling'),
}
V = next((v for v in sys.argv[2:] if v in V_), 'asriel')
C = V_[V]
SLUG = C['slug']


def load(part=None, slug=None):
    n = f'src/{slug or SLUG}-{part}.png' if part else f'src/{slug or SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def blink(s, i):
    """Lider (Hautfarbe) und geschlossenes Auge (schwarzer Strich) nach BLINK."""
    st = BLINK.get(i)
    if not st:
        return
    for (x, y), c in C.get('lid', []):
        s[y, x] = rgb(c)
    if st == 'zu' or 'lid' not in C:
        for x, y in C.get('line', []):
            s[y, x] = BLACK


def put(out, s, ox, oy, dy_fn=None, dx_fn=None):
    """s in out malen; dy_fn/dx_fn(x, y) = zusätzliche Verschiebung je Pixel."""
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy = y + oy + (dy_fn(x, y) if dy_fn else 0)
        xx = x + ox + (dx_fn(x, y) if dx_fn else 0)
        if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
            out[yy, xx] = s[y, x]


def knee_put(out, s, b, knee=None, ox=PL, oy=PT, moves=None):
    """Federn: Zeilen über dem Knie um b verschoben, die Beine bleiben stehen;
    beim Strecken (b < 0) wird die Zeile über dem Knie gedehnt.
    moves(x, y): Pixel, die unabhängig von der Zeile mitfedern."""
    knee = KNEE if knee is None else knee
    up = lambda x, y: y < knee or (moves is not None and moves(x, y))
    put(out, s, ox, oy, dy_fn=lambda x, y: b if up(x, y) else 0)
    if b < 0:
        y = knee - 1
        for x in range(s.shape[1]):
            if s[y, x, 3] and s[knee, x, 3] and not out[y + oy, x + ox, 3]:
                out[y + oy, x + ox] = s[y, x]


def sweep(mask, i, start, speed=1.5, width=1.5):
    """Lichtreflex, der schräg über die Pixel von mask läuft (einmal pro Loop)."""
    t = (i - start) % N
    pos = t * speed - 4
    hit = {}
    for y, x in zip(*np.nonzero(mask)):
        d = abs((x + y * 0.6) - pos)
        if d < width:
            hit[(x, y)] = 0.8 if d < width / 2 else 0.4
    return hit


# --- Bluttropfen ---------------------------------------------------------------
BLOOD = (rgb('5c0000'), rgb('9a0000'), rgb('d42a2a'))       # dunkel, mittel, Glanz


def drop_pixels(t, x, y, ground):
    """Ein Tropfen, der bei (x, y) unter einer Spitze hängt: t = 0..3 bildet
    er sich, dann löst er sich und fällt beschleunigt; am Boden (Zeile
    ground) zerplatzt er zwei Frames lang. Liefert {(x, y): Farbe}."""
    dk, md, hl = BLOOD
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


def draw_px(out, pix, only_empty=True):
    for (x, y), c in pix.items():
        assert 0 < x < out.shape[1] - 1 and 0 < y < out.shape[0] - 1, f'Partikel am Rand: {(x, y)}'
        if not only_empty or not out[y, x, 3]:
            out[y, x] = c


# --- Varianten ----------------------------------------------------------------
def f_asriel(i):
    s = SRC.copy()
    laugh = 16 <= i < 40
    if not laugh:
        blink(s, i)
    b = BOUNCE12[i % 12] if not laugh else 0
    if laugh:                                            # „HA – HA – HA“: 4 Frames je Lacher
        k = (i - 16) % 4
        mouth = 'weit' if k < 2 else 'halb'
        if i in (16, 39):
            mouth = 'halb'
        b = -1 if mouth == 'weit' else 0
        if mouth == 'weit':
            s[9, 9] = s[9, 10] = rgb('f6f6f6')           # Zähne
            s[10, 9] = s[10, 10] = rgb('5b0300')         # Rachen
        else:
            s[10, 9] = s[10, 10] = rgb('5b0300')
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Blut: rinnt links an der Klinge herab (Spalte 1, Zeile 10 → 13), dann unter der Faust
    # verborgen, bildet sich am Knauf (1, 18) als Tropfen und fällt auf den Boden (Zeile 24)
    for t0 in (2, 26):
        t = (i - t0) % N
        if t < 8:
            y = 10 + t // 2
            out[y + PT + b, 1 + PL] = BLOOD[1] if t % 2 else BLOOD[2]
        elif 11 <= t < 30:
            draw_px(out, drop_pixels(t - 11, 1 + PL, 18 + PT + b, 24 + PT))
    return out


BARKER_MARK = None


def f_barker(i):
    global BARKER_MARK
    if BARKER_MARK is None:
        BARKER_MARK = load('mark')[:, :, 3] > 0
    s = SRC.copy()
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(BARKER_MARK)):
        c = s[y, x]
        s[y, x] = [min(255, int(c[0] + 50 * f)), int(c[1] + 14 * f), int(c[2] + 14 * f), c[3]]
    blink(s, i)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12], moves=lambda x, y: x <= 4 and y < 26)   # Peitsche hängt an der Hand
    fill_pinholes(out)
    return out


def f_blackstache(i):
    s = SRC.copy()
    blink(s, i)
    ghost = (s[:, :, 3] > 0) & (s[:, :, 3] < 255)
    f = math.sin(2 * math.pi * 3 * i / N)
    s[ghost, 3] = np.clip(s[ghost, 3] + int(round(22 * f)), 0, 255)
    blade = (s[:, :, 3] == 255) & (_xs <= 19) & (_ys <= 17) & (np.abs(s[:, :, 0] - s[:, :, 2]) < 30) \
        & (s[:, :, 0] > 0x50)
    for (x, y), a in sweep(blade, i, 6, speed=1.2).items():
        s[y, x] = lighten(s[y, x], a)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12])
    fill_pinholes(out)
    return out


def f_chuck(i):
    s = SRC.copy()
    blink(s, i)
    beer = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if '%02x%02x%02x' % tuple(s[y, x, :3]) in ('ce9a10', 'dea610', 'b58a00', 'c69608'):
            beer[y, x] = True
    for x0, t0 in ((3, 0), (5, 9), (4, 20), (3, 31), (5, 40)):   # Bläschen steigen im Bier auf
        t = (i - t0) % N
        y = 17 - t // 2
        if t < 10 and beer[y, x0]:
            s[y, x0] = rgb('ffe89a')
    for x0, t0 in ((3, 12), (5, 34)):                    # auf der Schaumkrone platzt eins
        t = (i - t0) % N
        if t < 2:
            s[7, x0] = rgb('fffbe8')
        elif t == 2:
            s[6, x0 - 1] = s[6, x0 + 1] = rgb('fffbe8')
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12])
    fill_pinholes(out)
    return out


GLOBE = None


def f_codumbus(i):
    global GLOBE
    s = SRC.copy()
    # Land ↔ Meer je Helligkeitsrolle; die Glanzlichter (türkis/weiß) und die Randpixel stehen fest
    to_sea = {'92d14f': '0071c1', '6d9d3b': '005591', '53772d': '005591', '3e5921': '005591',
              'acdc7a': '3f94d0', '7d9860': '3f6683'}
    to_land = {'0071c1': '92d14f', '005591': '6d9d3b', '3f94d0': 'acdc7a', '3f6683': '7d9860'}
    if GLOBE is None:
        runs = []
        for y in range(0, 10):
            xs = [x for x in range(4, SW) if s[y, x, 3] and '%02x%02x%02x' % tuple(s[y, x, :3]) in
                  list(to_sea) + list(to_land) + ['00e6e6', '41ffff', 'a4ffff']]
            if len(xs) < 4:
                continue
            xs = list(range(xs[0] + 1, xs[-1]))
            hs = ['%02x%02x%02x' % tuple(s[y, x, :3]) for x in xs]
            runs.append((y, xs, hs))
        GLOBE = runs
    for y, xs, hs in GLOBE:
        n = len(xs)
        sh = int(round(i * n / N))
        for j, h in enumerate(hs):
            if h not in to_sea and h not in to_land:
                continue
            hsrc = hs[(j - sh) % n]
            land_src = hsrc in to_sea or (hsrc not in to_land and h in to_sea)
            if land_src and h in to_land:
                s[y, xs[j]] = rgb(to_land[h])
            elif not land_src and h in to_sea:
                s[y, xs[j]] = rgb(to_sea[h])
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12])
    fill_pinholes(out)
    return out


def f_devlin(i):
    s = SRC.copy()
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Tropfen unter den blutigen Krallenspitzen, zeitversetzt
    for (x, y), t0 in (((1, 20), 3), ((16, 20), 15), ((0, 19), 27), ((17, 19), 38)):
        t = (i - t0) % N
        # hängend federt der Tropfen mit der Kralle, fallend nicht mehr
        draw_px(out, drop_pixels(t, x + PL, y + PT + (b if t < 4 else 0), 22 + PT))
    return out


HOP = [0, 0, 0, -1, -2, -3, -3, -2, -1, 0, 0, 0]


def f_enigma(i):
    s = SRC.copy()
    if BLINK.get(i) == 'zu' or BLINK.get(i) == 'halb':   # Kreuzauge wird zum lachenden ^
        for x, y in ((8, 6), (8, 7), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8), (8, 9)):
            s[y, x] = rgb('1a0c12')
        for x, y in ((6, 9), (7, 8), (8, 7), (9, 8), (10, 9)):
            s[y, x] = rgb('ffffff')
    dy = HOP[i % 12]
    dx = int(round(0.6 * math.sin(2 * math.pi * 2 * i / N)))
    out = np.zeros((H, W, 4), int)
    put(out, s, PL + dx, PT + dy)
    return out


YOYO = None


def f_krates(i):
    global YOYO
    s = SRC.copy()
    if YOYO is None:
        YOYO = s[25:29, 0:4].copy()
    s[25:29, 0:4] = 0
    s[21:25, 2] = 0                                      # Faden (wird neu gezogen)
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b, moves=lambda x, y: False)
    fill_pinholes(out)
    t = i % 24                                           # zwei Würfe pro Loop
    d = -int(round(4 * math.sin(math.pi * t / 24) ** 0.7))
    yo = np.rot90(YOYO, k=(i // 2) % 4)
    top = 25 + d
    for y in range(21 + b, top):                         # Faden von der Hand bis zum Jo-Jo
        out[y + PT, 2 + PL] = rgb('cccccc') if (y - b) % 2 else rgb('ffffff')
    for y in range(4):
        for x in range(4):
            if yo[y, x, 3]:
                out[top + y + PT, x + PL] = yo[y, x]
    return out


def f_key(i):
    s = SRC.copy()
    blink(s, i)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12])
    fill_pinholes(out)
    return out


def f_kyli(i):
    s = SRC.copy()
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        c = s[y, x]
        if c[0] > 0x80 and c[1] < 0x20 and c[2] < 0x20:             # rote Augen glühen
            s[y, x] = [min(255, int(c[0] + 60 * f)), int(90 * f), int(90 * f), 255]
    w = 2 * math.pi * 2 * i / N

    def dx(x, y):
        if y < 15:                                       # gleiche Phase: der dünne Stamm reißt nicht
            return int(round(1.6 * ((15 - y) / 15) ** 1.5 * math.sin(w)))
        return 0

    def dy(x, y):
        if y < 15 and (x <= 4 or x >= 17):
            d = (4.5 - x) / 4.5 if x <= 4 else (x - 16.5) / 7
            return int(round(1.0 * d * math.sin(w + (0 if x <= 4 else math.pi))))
        return 0
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=dy, dx_fn=dx)
    fill_pinholes(out)
    return out


FRAME = dict(asriel=f_asriel, barker=f_barker, blackstache=f_blackstache, chuck=f_chuck, codumbus=f_codumbus,
             devlin=f_devlin, mmdevlin=f_devlin, enigma=f_enigma, krates=f_krates, key=f_key, kyli=f_kyli)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
