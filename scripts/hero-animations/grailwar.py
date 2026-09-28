# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGrailWar-Heroes und -Skins.

Aufruf: python3 grailwar.py <tag> [ms] <variante>

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu je Variante:
* asriel:    Asriel, the Sapling Sacrificer: lacht in der Loop-Mitte manisch
             (der Mund reißt im Takt auf – mal Zähne über dunklem Rachen, mal
             2 px hoch offen – der Oberkörper bebt dabei); Blut läuft die
             Messerklinge hinab und tropft unter der Faust vom Knauf zu Boden.
* barker:    Barker, the Monster Tamer: Federn, Blinzeln (die Augen reichen bis
             in die rote Zeile darunter), die rote Bemalung glimmt auf und ab;
             Peitsche und Metallarmband samt Hand federn als Ganzes mit dem Arm.
* alleria:   Alleria, the Queen of Spiders: nur ganzzahlige Verschiebungen,
             nichts wird neu gerastert: der Körper hebt und senkt sich um
             1 px (die Beinspitzen bleiben stehen, die Beine biegen sich mit),
             jedes der acht Beine hebt und senkt seine Spitze einzeln
             (Gangbild über Kreuz, eigene Phasen), der Spinnenkopf wippt
             eigenständig auf und ab, die Spinnenaugen glühen, sie blinzelt.
* blackstache: der Geisterpirat federt, blinzelt mit den gelben Augen, sein
             durchscheinender Körper flackert leicht; den Säbel neigt er
             leicht auf und ab (Drehung um die Faust), über die Klinge läuft
             ein Lichtreflex und sie funkelt; an den Enden seiner acht Lunten
             sprühen Funken.
* chuck:     Federn, Blinzeln, er redet ununterbrochen (Mund unter dem
             Schnauzbart); die Schaumkrone brodelt ständig (Blasen wogen,
             die Oberkante wölbt sich, Schaumflocken spritzen auf), im Bier
             steigen Bläschen auf.
* codumbus:  Federn; der Globus dreht sich (Land und Meer wandern, das Licht
             bleibt stehen, der Rand bleibt fest); seine zwei türkisen
             Schweißtropfen rinnen ständig über den Globus-Kopf herab.
* devlin / mmdevlin: Federn; von den Krallen tropft Blut (Tropfen bildet
             sich, fällt, zerplatzt am Boden), der Schweißtropfen an der
             Stirn rinnt herab und bildet sich neu.
* enigma:    das Kind in der Kutte erzählt: schnelles Squash-and-Stretch auf
             der Stelle, es schwingt den Arm, der Mund geht auf und zu. Das
             weiße Glitzern (vor dem schwarzen Gesicht, wandert senkrecht mit,
             und daneben) funkelt unabhängig von ihr.
* krates:    Federn, Blinzeln; sein Jo-Jo schnellt am Faden hoch und fällt
             wieder, und dreht sich dabei.
* key:       Federn, Blinzeln; die goldenen Armreifen glitzern, die
             abstehenden Haarsträhnen wandern um ihre Haarwurzel (bleiben
             immer mindestens diagonal mit ihr verbunden).
* kyli:      Squash-and-Stretch in der Senkrechten (die Füße bleiben), die
             schwarzen Äste wiegen sich (oben stärker), die roten Augen
             glühen auf und blinzeln.
"""
import math
import os
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
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
                   blink={'halb': [((7, 10), 'f8bc77'), ((12, 10), 'f8bc77'),
                                   ((7, 11), '000000'), ((12, 11), '000000')],
                          'zu': [((7, 10), 'f8bc77'), ((12, 10), 'f8bc77'),
                                 ((6, 11), 'd5a464'), ((7, 11), 'd5a464'), ((8, 11), 'd5a464'),
                                 ((11, 11), 'd5a464'), ((12, 11), 'd5a464'), ((13, 11), 'd5a464'),
                                 ((7, 12), '000000'), ((8, 12), '000000'), ((11, 12), '000000'), ((12, 12), '000000')]}),
    'blackstache': dict(slug='blackstache-scourge-of-the-pixel-seas', part='body', crop=(0, 2, 47, 29), knee=20,
                        pads=(3, 11, 7, 2),
                        line=[(33, 10), (34, 10), (37, 10), (38, 10)]),
    'chuck': dict(slug='chuck-the-crazy-veteran', knee=18, pads=(3, 3, 5, 2), line=[(13, 6), (17, 6)]),
    'codumbus': dict(slug='codumbus-the-clueless-voyager', knee=21, pads=(3, 3, 5, 2)),
    'devlin': dict(slug='devlin-the-masked-butcher', knee=20),
    'mmdevlin': dict(slug='mass-murderer-devlin', knee=20),
    'enigma': dict(slug='enigma-the-seller-of-secrets', knee=15, pads=(6, 7, 5, 2)),
    'krates': dict(slug='krates-the-smartass', knee=23,
                   lid=[((7, 10), 'f6cd8b'), ((8, 10), 'f6cd8b'), ((11, 10), 'f6cd8b'), ((12, 10), 'f6cd8b')],
                   line=[(7, 11), (8, 11), (11, 11), (12, 11)]),
    'key': dict(slug='key-the-cursed-thief', knee=20,
                lid=[((5, 9), 'f6cd8b'), ((6, 9), 'f6cd8b'), ((9, 9), 'f6cd8b')],
                line=[(5, 10), (6, 10), (9, 10)]),
    'alleria': dict(slug='alleria-the-queen-of-spiders', pads=(3, 3, 3, 2),
                    lid=[((16, 9), 'f5ce88'), ((17, 9), 'f5ce88')], line=[(16, 10), (17, 10)]),
    'kyli': dict(slug='kyli-the-deceptive-sapling', knee=28, pads=(3, 3, 5, 2),
                 blink={'halb': [((9, 16), '636363'), ((10, 16), '636363'), ((13, 16), '636363'), ((14, 16), '636363')],
                        'zu': [((9, 16), '636363'), ((10, 16), '636363'), ((13, 16), '636363'), ((14, 16), '636363'),
                               ((9, 17), '000000'), ((10, 17), '000000'), ((13, 17), '000000'), ((14, 17), '000000')]}),
}
V = next((v for v in sys.argv[2:] if v in V_), 'asriel')
C = V_[V]
SLUG = C['slug']


def load(part=None, slug=None):
    n = f'src/{slug or SLUG}-{part}.png' if part else f'src/{slug or SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
if 'crop' in C:
    _cx0, _cy0, _cx1, _cy1 = C['crop']
    SRC = SRC[_cy0:_cy1, _cx0:_cx1]
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def blink(s, i):
    """Lider (Hautfarbe) und geschlossenes Auge (schwarzer Strich) nach BLINK;
    oder je Zustand eigene Pixelliste (C['blink'])."""
    st = BLINK.get(i)
    if not st:
        return
    if 'blink' in C:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)
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


def knee_put(out, s, b, knee=None, ox=PL, oy=PT, moves=None, dx_fn=None):
    """Federn: Zeilen über dem Knie um b verschoben, die Beine bleiben stehen;
    beim Strecken (b < 0) wird die Zeile über dem Knie gedehnt.
    moves(x, y): Pixel, die unabhängig von der Zeile mitfedern."""
    knee = KNEE if knee is None else knee
    up = lambda x, y: y < knee or (moves is not None and moves(x, y))
    put(out, s, ox, oy, dy_fn=lambda x, y: b if up(x, y) else 0, dx_fn=dx_fn)
    if b < 0:
        y = knee - 1
        for x in range(s.shape[1]):
            if s[y, x, 3] and s[knee, x, 3] and not out[y + oy, x + ox, 3]:
                dx = dx_fn(x, y) if dx_fn else 0
                out[y + oy, x + ox + dx] = s[y, x]


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


def draw_px(out, pix, only_empty=True):
    for (x, y), c in pix.items():
        assert 0 < x < out.shape[1] - 1 and 0 < y < out.shape[0] - 1, f'Partikel am Rand: {(x, y)}'
        if not only_empty or not out[y, x, 3]:
            out[y, x] = c


def stars(out, i, sparkles, t0='fff6ac', t1='ffffff', only_empty=False):
    """Glitzersterne [(x, y, Startframe)] in Ausgabe-Koordinaten; mit
    only_empty wird ein Stern, der die Figur berühren würde, ganz weggelassen."""
    for st in sparkles:
        pix = sparkle_pixels(i, N, [st], rgb(t0), rgb(t1))
        if only_empty and any(out[y, x, 3] for x, y in pix):
            continue
        draw_px(out, pix, only_empty=False)


def talk_track(units, seed):
    """Sprechspur über 48 Frames: Silben (offen/weit) mit kurzen Pausen."""
    rng = np.random.default_rng(seed)
    tr = []
    while len(tr) < N:
        u = units[rng.integers(len(units))]
        tr += list(u)
    return tr[:N]


# --- Bluttropfen ---------------------------------------------------------------
BLOOD = (rgb('5c0000'), rgb('9a0000'), rgb('d42a2a'))       # dunkel, mittel, Glanz


def drop_pixels(t, x, y, ground, cols=BLOOD):
    """Ein Tropfen, der bei (x, y) unter einer Spitze hängt: t = 0..3 bildet
    er sich, dann löst er sich und fällt beschleunigt; am Boden (Zeile
    ground) zerplatzt er zwei Frames lang. Liefert {(x, y): Farbe}."""
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


# --- Varianten ----------------------------------------------------------------
def f_asriel(i):
    s = SRC.copy()
    laugh = 16 <= i < 40
    if not laugh:
        blink(s, i)
    b = BOUNCE12[i % 12]
    if laugh:                                            # „HA – HA – HA“: 4 Frames je Lacher
        k = (i - 16) % 4
        mouth = ['hoch', 'hoch', 'weit', 'halb'][k] if (i - 16) // 4 % 2 == 0 else ['weit', 'weit', 'hoch', 'halb'][k]
        if i in (16, 39):
            mouth = 'halb'
        b = -1 if k < 2 else 0
        if mouth == 'weit':                              # Zähne über dunklem Rachen
            s[9, 9] = s[9, 10] = rgb('f6f6f6')
            s[10, 9] = s[10, 10] = rgb('5b0300')
        elif mouth == 'hoch':                            # 2 px hoch aufgerissen
            s[9, 9] = s[9, 10] = rgb('3a0000')
            s[10, 9] = s[10, 10] = rgb('8a1414')
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
            draw_px(out, drop_pixels(t - 11, 1 + PL, 18 + PT + (b if t < 15 else 0), 24 + PT))
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
    knee_put(out, s, BOUNCE12[i % 12], moves=lambda x, y: (x <= 4 and y < 26) or (x >= 13 and y <= 24))   # Peitsche links, Armband + Hand rechts: hängen am Arm
    fill_pinholes(out)
    return out


BS_PIVOT = (24.0, 12.5)                                  # Faust am Säbelgriff
FUSES = None


def f_blackstache(i):
    global FUSES
    s = SRC.copy()
    if FUSES is None:                                    # Lunten (Ebene #229) in Körper-Koordinaten
        fu = load('fuses')
        cx, cy = C['crop'][:2]
        line, spark = [], []
        for y, x in zip(*np.nonzero(fu[:, :, 3])):
            (line if hexc(fu[y, x]) == '000000' else spark).append((x - cx, y - cy, fu[y, x].copy()))
        m = np.zeros(fu.shape[:2], np.uint8)
        for x, y, _ in spark:
            m[y + cy, x + cx] = 1
        n, lab = cv2.connectedComponents(m, connectivity=8)
        tips = []                                        # je Funkenbüschel: Mitte = weißer Kern
        for k in range(1, n):
            pts = [(x, y, c) for x, y, c in spark if lab[y + cy, x + cx] == k]
            core = [(x, y) for x, y, c in pts if hexc(c) == 'ffffff'] or [(x, y) for x, y, _ in pts]
            tips.append((core[0], pts))
        FUSES = (line, tips)
    line, tips = FUSES
    blink(s, i)
    ghost = (s[:, :, 3] > 0) & (s[:, :, 3] < 255)
    f = math.sin(2 * math.pi * 3 * i / N)
    s[ghost, 3] = np.clip(s[ghost, 3] + int(round(22 * f)), 0, 255)
    sword_m = (s[:, :, 3] > 0) & (_xs <= 24)
    blade = sword_m & (s[:, :, 3] == 255) & (_ys <= 17) & (np.abs(s[:, :, 0] - s[:, :, 2]) < 30) \
        & (s[:, :, 0] > 0x50) & (_xs <= 19)
    for (x, y), a in sweep(blade, i, 6, speed=1.2).items():
        s[y, x] = lighten(s[y, x], a)
    b = BOUNCE12[i % 12]
    k_tilt = 0.06 * math.sin(2 * math.pi * 2 * i / N)     # Spitze ± ~1,5 px
    tilt = lambda x: int(round(k_tilt * (BS_PIVOT[0] - x)))   # spaltenweise Scherung, nichts neu gerastert
    out = np.zeros((H, W, 4), int)
    sword = s.copy()
    sword[~sword_m] = 0
    put(out, sword, PL, PT + b, dy_fn=lambda x, y: -tilt(x))
    body = s.copy()
    body[sword_m] = 0
    knee_put(out, body, b)
    fill_pinholes(out)
    # Lunten federn mit; die Funken an ihren Enden sprühen (Frame 0 = Bild)
    fuse_px = set()
    for x, y, c in line:
        out[y + PT + b, x + PL] = c
        fuse_px.add((x, y))
    Y_, W_, O_ = rgb('ffff00'), rgb('ffffff'), rgb('ff9a1f')
    for k, ((cx, cy), pts) in enumerate(tips):
        if i == 0:
            for x, y, c in pts:
                out[y + PT + b, x + PL] = c
            continue
        rng = np.random.default_rng(1000 * k + i)
        pix = {(cx, cy): W_ if rng.random() < 0.6 else Y_}
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            r = rng.random()
            if r < 0.45:
                pix[(cx + dx, cy + dy)] = Y_ if r < 0.3 else O_
        if rng.random() < 0.5:                           # einzelner Funke fliegt weg
            dx, dy = [(2, -1), (-2, -1), (1, -2), (-1, -2), (2, 0), (-2, 0)][rng.integers(6)]
            pix[(cx + dx, cy + dy)] = W_ if rng.random() < 0.5 else Y_
        for (x, y), c in pix.items():
            if (x, y) in fuse_px:
                continue
            out[y + PT + b, x + PL] = c
    # Funkeln auf der Klinge (Punkte drehen mit)
    sp = [(x + PL, y - tilt(x) + PT + b, t0) for (x, y), t0 in (((4, 10), 4), ((11, 11), 20), ((16, 12), 34))]
    stars(out, i, sp, 'e8f4ff', 'ffffff')
    return out


FOAM = None
CHUCK_TALK = talk_track(['oo', 'ooc', 'ww', 'wwo', 'oc', 'c', 'owc'], 7)


def f_chuck(i):
    global FOAM
    s = SRC.copy()
    if FOAM is None:
        m = (s[:, :, 3] > 0) & (_xs <= 7) & (_ys >= 5) & (_ys <= 13)
        m &= np.array([[lum(s[y, x]) > 200 for x in range(SW)] for y in range(SH)])
        cols = sorted({hexc(s[y, x]) for y, x in zip(*np.nonzero(m))}, key=lambda h: lum(rgb(h)))
        rank = {h: k / (len(cols) - 1) for k, h in enumerate(cols)}
        tops = {x: int(np.nonzero(m[:, x])[0].min()) for x in range(SW) if m[:, x].any()}
        FOAM = (m, cols, rank, tops)
    m, cols, rank, tops = FOAM
    blink(s, i)
    # Reden: c = zu (Schnauzbart schließt), o = offen (Original), w = weit (Zunge)
    st = CHUCK_TALK[i] if i else 'o'
    if st == 'c':
        s[10, 15] = s[10, 16] = rgb('d5d5d5')
        s[11, 15] = s[11, 16] = rgb('330000')
    elif st == 'w':
        s[11, 15] = s[11, 16] = rgb('b01818')
    # Schaum brodelt: jede Blase wogt mit eigener Phase heller/dunkler
    w = 2 * math.pi * i / N
    for y, x in zip(*np.nonzero(m)):
        ph = (x * 1.7 + y * 2.9) % 6.283
        r = rank[hexc(s[y, x])] + 0.4 * (math.sin(3 * w + ph) - math.sin(ph))
        s[y, x] = rgb(cols[int(round(min(1.0, max(0.0, r)) * (len(cols) - 1)))])
    for x, ty in tops.items():                           # Oberkante wölbt sich
        ph = x * 2.1
        g = math.sin(4 * w + ph) - math.sin(ph)
        if g > 0.9 and ty - 1 >= 0 and not s[ty - 1, x, 3]:
            s[ty - 1, x] = rgb(cols[-1])
        elif g < -1.2 and ty + 1 < SH and m[ty + 1, x]:
            s[ty, x] = 0
    beer = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in ('ce9a10', 'dea610', 'b58a00', 'c69608'):
            beer[y, x] = True
    for x0, t0 in ((3, 0), (5, 9), (4, 20), (3, 31), (5, 40)):   # Bläschen steigen im Bier auf
        t = (i - t0) % N
        y = 17 - t // 2
        if t < 10 and beer[y, x0]:
            s[y, x0] = rgb('ffe89a')
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Schaumflocken spritzen auf (starten 2 px über der Krone, berühren sie nie)
    xs = sorted(tops)
    for k, t0 in enumerate(range(1, 45, 5)):
        x = xs[(k * 3) % len(xs)]
        t = (i - t0) % N
        if t < 4:
            y = tops[x] - 3 - t + PT + b
            xx = x + (1 if k % 2 else -1) * (t // 2) + PL
            if 0 < xx < W - 1 and not out[y, xx, 3] and not out[y + 1, xx, 3]:
                out[y, xx] = rgb('fffbe8') if t < 2 else rgb('f7ebc6')
    return out


GLOBE = None
SWEAT = ['a4ffff', '41ffff', '00e6e6']                   # die zwei türkisen Tropfen (oben hell)
SWEAT_AT = [(10, 1), (5, 5)]


def f_codumbus(i):
    global GLOBE
    s = SRC.copy()
    for x, y in SWEAT_AT:                                # Tropfen weg, darunter Globus (rechter Nachbar)
        for k in range(3):
            s[y + k, x] = s[y + k, x + 1]
    # Land ↔ Meer je Helligkeitsrolle; die Randpixel stehen fest
    to_sea = {'92d14f': '0071c1', '6d9d3b': '005591', '53772d': '005591', '3e5921': '005591',
              'acdc7a': '3f94d0', '7d9860': '3f6683'}
    to_land = {'0071c1': '92d14f', '005591': '6d9d3b', '3f94d0': 'acdc7a', '3f6683': '7d9860'}
    if GLOBE is None:
        runs = []
        gm = np.zeros((SH, SW), bool)
        for y in range(0, 10):
            xs = [x for x in range(4, SW) if s[y, x, 3] and hexc(s[y, x]) in list(to_sea) + list(to_land)]
            if len(xs) < 4:
                continue
            gm[y, xs[0]:xs[-1] + 1] = True
            xs = list(range(xs[0] + 1, xs[-1]))
            hs = [hexc(s[y, x]) for x in xs]
            runs.append((y, xs, hs))
        GLOBE = (runs, gm)
    runs, gm = GLOBE
    for y, xs, hs in runs:
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
    # Schweißtropfen rinnen über den Globus herab und tauchen oben wieder auf (2 Runden pro Loop)
    for x, y0 in SWEAT_AT:
        top = int(np.nonzero(gm[:, x])[0].min())
        bot = int(np.nonzero(gm[:, x])[0].max())
        ymin = top - 2
        L = bot - ymin + 1
        yt = ymin + ((y0 - ymin) + (i * L * 2) // N) % L
        for k, c in enumerate(SWEAT):
            if 0 <= yt + k < SH and gm[yt + k, x]:
                s[yt + k, x] = rgb(c)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    return out


def f_devlin(i):
    s = SRC.copy()
    sweat = [(y, x) for y, x in zip(*np.nonzero(s[:, :, 3])) if hexc(s[y, x]) in ('8bffff', 'beffff') and y < 8]
    for y, x in sweat:                                   # Stirn darunter freilegen (Farbe vom linken Nachbarn)
        s[y, x] = s[y, x - 1]
    sx, sy = sweat[0][1], min(y for y, _ in sweat)
    b = BOUNCE12[i % 12]
    # Schweißtropfen: bildet sich an der Stirn, rinnt die Wange herab, zweimal pro Loop
    t = i % 24
    if t < 4:
        drop = [(sy + (1 if t < 2 else 0), 'beffff')] + ([(sy + 1, '8bffff')] if t >= 2 else [])
    else:
        yy = sy + (t - 4) // 3
        drop = [(yy, 'beffff'), (yy + 1, '8bffff')] if yy + 1 <= 8 else []
    for y, c in drop:
        s[y, sx] = rgb(c)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Blut-Tropfen unter den Krallenspitzen, zeitversetzt
    for (x, y), t0 in (((1, 20), 3), ((16, 20), 15), ((0, 19), 27), ((17, 19), 38)):
        t = (i - t0) % N
        # hängend federt der Tropfen mit der Kralle, fallend nicht mehr
        draw_px(out, drop_pixels(t, x + PL, y + PT + (b if t < 4 else 0), 22 + PT))
    return out


ENIGMA_TALK = talk_track(['oo', 'oc', 'ww', 'wo', 'occ', 'c'], 11)
ARM_PIVOT = (6.0, 12.5)


B8 = [0, -1, -1, -1, 0, 1, 1, 1]


def f_enigma(i):
    s = SRC.copy()
    for x, y in ((8, 6), (8, 7), (6, 8), (7, 8), (9, 8), (10, 8), (8, 9), (8, 10)):   # Glitzern kommt eigenständig
        s[y, x] = rgb('1a0c12')
    st = ENIGMA_TALK[i] if i else 'o'                    # Mund: roter Strich, darunter Rachen
    if st == 'c':
        s[12, 9] = s[12, 10] = rgb('0a0a0a')
    elif st == 'w':
        s[12, 9] = s[12, 10] = rgb('5b0000')
        s[13, 9] = s[13, 10] = rgb('300000')
    arm_m = (s[:, :, 3] > 0) & (_xs <= 5) & (_ys >= 11) & (_ys <= 14)
    w = 2 * math.pi * i / N
    b = B8[i % 8]                                        # schnelles Wippen: 1-px-Hub an der Naht
    k_arm = 0.32 * math.sin(3 * w)                       # Arm schwingt beim Erzählen (spaltenweise Scherung)
    arm_dy = lambda x, y: b - int(round(k_arm * (ARM_PIVOT[0] - x))) if arm_m[y, x] else b if y < KNEE else 0
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=arm_dy)
    if b < 0:                                            # Naht dehnen
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    # Glitzern vor dem Gesicht wandert senkrecht mit ihr mit (Frame 0 = volles Kreuz wie im Bild)
    fy = 8 + PT + b
    stars(out, i, [(8 + PL, fy, 46), (8 + PL, fy, 22)], 'e8e8ff', 'ffffff')
    stars(out, i, [(PL - 3, 5 + PT, 8), (SW + 2 + PL, 4 + PT, 30), (SW + 2 + PL, 16 + PT, 14),
                   (PL - 3, 18 + PT, 36), (PL + 17, PT - 2, 40)], 'e8e8ff', 'ffffff', only_empty=True)
    return out


YOYO = None


def f_krates(i):
    global YOYO
    s = SRC.copy()
    if YOYO is None:
        yo = np.zeros((5, 5, 4), int)
        blk = s[25:29, 0:5].copy()
        keep = np.array([[blk[y, x, 3] > 0 and hexc(blk[y, x]) in
                          ('ad0000', 'c54c4c', 'ffc54c', '790000', 'ffad00', 'b37900') for x in range(5)]
                         for y in range(4)])
        blk[~keep] = 0
        yo[:4] = blk
        YOYO = (yo, keep)
    yo0, keep = YOYO
    blk = s[25:29, 0:5]
    blk[keep] = 0
    s[21:25, 2] = 0                                      # Faden (wird neu gezogen)
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    t = i % 24                                           # zwei Würfe pro Loop
    d = -int(round(4 * math.sin(math.pi * t / 24) ** 0.7))
    yo = np.rot90(yo0, k=(i // 2) % 4) if i % 24 else yo0
    top = 25 + d
    for y in range(21 + b, top):                         # Faden von der Hand bis zum Jo-Jo
        out[y + PT, 2 + PL] = rgb('cccccc') if (y - b) % 2 else rgb('ffffff')
    for y in range(5):
        for x in range(5):
            if yo[y, x, 3]:
                out[top + y + PT, x + PL] = yo[y, x]
    return out


KEY_STRAYS = [((9, 0), (8, 1), []), ((3, 2), (4, 3), [(2, 2)]), ((13, 3), (12, 4), []),
              ((0, 8), (1, 7), []), ((15, 11), (14, 10), [])]   # (Strähne, Wurzel, angehängte Pixel)
RING = [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]


def f_key(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    # abstehende Strähnen wehen: sie wandern um ihre Haarwurzel herum (bleiben immer mindestens
    # diagonal mit ihr verbunden), angehängte Pixel folgen mit demselben Abstand
    moved = {}
    base = s.copy()
    for (p, r, chain), ph in zip(KEY_STRAYS, (0.0, 1.3, 2.6, 4.0, 5.1)):
        for q in [p] + chain:
            base[q[1], q[0]] = 0
    for (p, r, chain), ph in zip(KEY_STRAYS, (0.0, 1.3, 2.6, 4.0, 5.1)):
        step = int(round(0.8 * (math.sin(w + ph) - math.sin(ph))))
        k = RING.index((p[0] - r[0], p[1] - r[1]))
        np_ = p
        for st in ([step, 0] if step else [0]):
            d = RING[(k + st) % 8]
            cand = (r[0] + d[0], r[1] + d[1])
            if 0 <= cand[0] < SW and 0 <= cand[1] < SH and not base[cand[1], cand[0], 3]:
                np_ = cand
                break
        off = (np_[0] - p[0], np_[1] - p[1])
        for q in [p] + chain:
            moved[(q[0] + off[0], q[1] + off[1])] = s[q[1], q[0]].copy()
    for (x, y), c in moved.items():
        if 0 <= x < SW and 0 <= y < SH:
            base[y, x] = c
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, base, b)
    fill_pinholes(out)
    stars(out, i, [(1 + PL, 19 + PT + b, 10), (14 + PL, 19 + PT + b, 22),
                   (2 + PL, 19 + PT + b, 34), (13 + PL, 19 + PT + b, 46)], 'ffe300', 'fff6ac')
    return out


B24 = [0, 0, 0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]


def f_kyli(i):
    s = SRC.copy()
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        c = s[y, x]
        if c[0] > 0x80 and c[1] < 0x20 and c[2] < 0x20:             # rote Augen glühen
            s[y, x] = [min(255, int(c[0] + 60 * f)), int(90 * f), int(90 * f), 255]
    blink(s, i)
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
    # Squash-and-Stretch als 1-px-Hub an der Naht über den Beinen (nichts wird neu gerastert)
    hb = B24[(i + 20) % 24] - B24[20]
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=lambda x, y: dy(x, y) + (hb if y < KNEE else 0), dx_fn=dx)
    if hb < 0:
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    return out


# Beine links (von außen oben nach innen unten) als Linienzüge ab der Wurzel; rechts gespiegelt
LEGS_L = [[(12, 10), (8, 9.5), (5, 11), (3, 13), (1, 15), (0, 19)],
          [(12, 13.5), (8, 14), (6, 16), (4, 19), (3, 22)],
          [(12, 16), (9, 18), (7, 21), (5, 24), (5, 27)],
          [(13, 20.5), (11, 23), (10, 26), (9, 29)]]
LEG_SEG = None


def leg_pos(px, py, L):
    """(Abstand, Anteil t entlang des Linienzugs: 0 = Wurzel, 1 = Spitze) des nächsten Punkts."""
    segs = list(zip(L, L[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    tot, acc, best = sum(lens), 0.0, (1e9, 0.0)
    for (a, b), ln in zip(segs, lens):
        dx, dy = b[0] - a[0], b[1] - a[1]
        u = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / (ln * ln)))
        d = math.hypot(px - a[0] - u * dx, py - a[1] - u * dy)
        if d < best[0]:
            best = (d, (acc + u * ln) / tot)
        acc += ln
    return best


def close_gaps(part, mask):
    """Einzelne Lücken im Bein (oben und unten Beinpixel) mit der Farbe darüber schließen."""
    op = part[:, :, 3] > 0
    for y in range(1, part.shape[0] - 1):
        for x in range(part.shape[1]):
            if not op[y, x] and op[y - 1, x] and op[y + 1, x] and mask[y - 1, x] and mask[y + 1, x]:
                part[y, x] = part[y - 1, x]


def f_alleria(i):
    global LEG_SEG
    s = SRC.copy()
    legs = LEGS_L + [[(SW - 1 - x, y) for x, y in L] for L in LEGS_L]
    if LEG_SEG is None:                                  # jedes Beinpixel: nächster Linienzug + Anteil t
        lab = np.full((SH, SW), -1)
        tt = np.zeros((SH, SW))
        for y, x in zip(*np.nonzero(s[:, :, 3])):
            if y >= 9 and (x <= 12 or x >= SW - 13):
                best = min((leg_pos(x, y, L) + (k,) for k, L in enumerate(legs)))
                lab[y, x], tt[y, x] = best[2], best[1]
        LEG_SEG = (lab, tt)
    lab, tt = LEG_SEG
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)    # Spinnenaugen glühen
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if y >= 19 and hexc(s[y, x]) in ('ff0200', 'ad0100'):
            c = s[y, x]
            s[y, x] = [255, int(c[1] + 110 * f), int(c[2] + 90 * f), 255]
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    # Nur ganzzahlige Verschiebungen (nichts wird neu gerastert, die Pixel bleiben scharf):
    # b = Squash/Stretch – der Körper hebt/senkt sich um 1 px, die Beinspitzen bleiben stehen;
    # jedes Bein hebt/senkt dazu seine Spitze einzeln (Gangbild über Kreuz, eigene Phasen)
    b = B24[i % 24]
    phases = [0.0, 3.3, 0.4, 3.0, 3.1, 0.2, 2.9, 0.5]
    legl = np.zeros((H, W, 4), int)
    legm = np.zeros((H, W), bool)
    for k in range(8):
        lift = max(0.0, 1.6 * (math.sin(w + phases[k]) - math.sin(phases[k])))   # nur anheben, nie unter den Boden
        for y, x in zip(*np.nonzero(lab == k)):
            t = tt[y, x]
            dy = int(round(b * (1 - t) - lift * t))
            legl[y + PT + dy, x + PL] = s[y, x]
            legm[y + PT + dy, x + PL] = True
    close_gaps(legl, legm)
    body = s.copy()
    body[lab >= 0] = 0
    head = body.copy()                                   # Spinnenkopf (ab Zeile 19) wippt eigenständig
    head[:19] = 0
    body[19:] = 0
    hd = int(round(0.8 * (math.sin(w + 1.2) - math.sin(1.2))))
    out = np.zeros((H, W, 4), int)
    m = legl[:, :, 3] > 0
    out[m] = legl[m]
    put(out, head, PL, PT + b + hd)
    if hd > 0:                                           # Lücke unter den Händen: oberste Kopfzeile dehnen
        for x in range(SW):
            if head[19, x, 3]:
                out[19 + PT + b, x + PL] = head[19, x]
    put(out, body, PL, PT + b)
    fill_pinholes(out)
    return out


FRAME = dict(asriel=f_asriel, barker=f_barker, blackstache=f_blackstache, chuck=f_chuck, codumbus=f_codumbus,
             devlin=f_devlin, mmdevlin=f_devlin, enigma=f_enigma, krates=f_krates, key=f_key, kyli=f_kyli, alleria=f_alleria)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
