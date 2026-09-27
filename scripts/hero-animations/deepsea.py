# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveDeepsea-Heroes und -Skins (außer Toras,
siehe toras.py).

Aufruf: python3 deepsea.py <tag> [ms] <variante>
Varianten: arnold kit lolek captain mender rakah rhabi saya grass siphem
           asgore sorin tryse

Allen gemeinsam: Wippen in den Knien (Füße bleiben stehen) bzw. Atmen, und
menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich). Dazu:
* arnold:  Bravo Arnold (Sonnenbrille, kein Blinzeln); seine Tolle weht im
           Wind (zeilenweise, Spitze stärker, Wurzel fest am Kopf); seine
           Axolotl-Kiemen wackeln, jede für sich.
* kit:     Wippen und Blinzeln.
* lolek / captain: türkise bzw. pinke Scherben schweben als Partikel um ihn,
           jede auf eigener Bahn und mit eigenem Takt; sie funkeln ab und zu.
           Eine Scherbe wird nur ganz gezeichnet (nie vor oder hinter der Figur
           angeschnitten).
* mender:  der Dreizack leuchtet pulsierend und funkelt an den Spitzen
           (Taucherhelm – kein Blinzeln).
* rakah:   die Schwanzflosse schlägt sachte (spaltenweise, außen stärker);
           seine roten Augen blinzeln.
* rhabi:   die Flammenkrone flackert, die Augenhöhlen glühen auf, die vier
           Knochenarme klappern abwechselnd.
* saya:    ihre Flügel schlagen (spaltentreu geschert); sie blinzelt.
* grass:   Saya the Grass Princess steckt im Busch: der Busch bleibt stehen,
           sie atmet (Oberkörper 1 px) und blinzelt.
* siphem:  sein Flügel-Umhang flattert: eine Welle läuft von innen nach außen
           (spaltenweise, außen stärker).
* asgore:  Monster King Siphem: der Umhang weht nach außen, der rote Dreizack
           glitzert, und er schaut immer wieder zum Dreizack hinüber; blinzelt.
* sorin:   Wippen und Blinzeln.
* tryse:   er sticht zu: Arm, Hand und Schwert holen aus und stoßen vor. Die
           schwarze Kante des Schulter-Capes am Gesicht bleibt immer an ihrem
           Platz; beim Zustoßen wird die Lücke dahinter in Stoffgrau gefüllt
           (Ober- und Unterkante schwarz weiter), beim Ausholen verschwindet der
           Arm hinter der Kante. Er blinzelt.
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, sweep_level, BOUNCE12
from flap_common import fill_pinholes, shear_flap

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
V_ = {
    'arnold': dict(slug='bravo-arnold', knee=26),
    'kit': dict(slug='kit-the-shark-researcher', knee=19,
                lid=[((6, 7), 'f6bd7b'), ((7, 7), 'f6bd7b'), ((10, 7), 'f6bd7b'), ((11, 7), 'f6bd7b')],
                line=[(6, 8), (7, 8), (10, 8), (11, 8)]),
    'lolek': dict(slug='lolek-the-shard-knight', knee=20, pad=6,
                  lid=[((11, 6), 'f6bd7b'), ((12, 6), 'f6bd7b'), ((15, 6), 'f6bd7b'), ((16, 6), 'f6bd7b')],
                  line=[(11, 7), (12, 7), (15, 7), (16, 7)]),
    'captain': dict(slug='division-captain-lolek', knee=22, pad=6,
                    lid=[((5, 6), 'f6bd7b'), ((6, 6), 'f6bd7b'), ((9, 6), 'f6bd7b'), ((10, 6), 'f6bd7b')],
                    line=[(5, 7), (6, 7), (9, 7), (10, 7)]),
    'mender': dict(slug='lolek-mender-of-the-shattered-trident', knee=34),
    'rakah': dict(slug='rakah-the-loan-shark', knee=21, pb=5,
                  lid=[((10, 6), '1c1c20'), ((14, 6), '1c1c20')],
                  line=[(10, 7), (11, 7), (14, 7), (15, 7)]),
    'rhabi': dict(slug='rha-bi-the-living-skeleton', knee=21),
    'saya': dict(slug='saya-the-plant-princess', knee=19,
                 lid=[((11, 8), 'f7bc97'), ((14, 8), 'f7bc97')],
                 line=[(10, 9), (11, 9), (14, 9), (15, 9)]),
    'grass': dict(slug='saya-the-grass-princess', breath=12,
                  lid=[((6, 8), 'f7bc97'), ((9, 8), 'f7bc97')],
                  line=[(5, 8), (6, 8), (9, 8), (10, 8)]),
    'siphem': dict(slug='siphem-the-deepsea-demon', knee=27),
    'asgore': dict(slug='monster-king-siphem', knee=28,
                   lid=[((19, 8), 'dfe1b9'), ((20, 8), 'dfe1b9'), ((23, 8), 'dfe1b9'), ((24, 8), 'dfe1b9')],
                   line=[(19, 9), (20, 9), (23, 9), (24, 9)]),
    'sorin': dict(slug='sorin-the-warden-of-blood-rock', knee=21,
                  lid=[((6, 8), '2e222d'), ((9, 8), '2e222d')],
                  line=[(5, 8), (6, 8), (9, 8), (10, 8)]),
    'tryse': dict(slug='tryse-the-shadow-slayer', knee=22, pad_r=4,
                  lid=[((7, 6), '20211f')],
                  line=[(7, 7), (8, 7)]),
}
V = next((v for v in sys.argv[2:] if v in V_), 'kit')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
P = C.get('pad', 3)
PR = C.get('pad_r', P)
PT, PB = C.get('pad', 4), C.get('pb', 2)
H, W = SH + PT + PB, SW + P + PR
N = 48
KNEE = C.get('knee', SH)

# --- Teile / Masken ----------------------------------------------------------
if V == 'arnold':
    HAIR = load('hair')[:, :, 3] > 0
    HAIR_ROOT = 9                                    # ab hier sitzt die Tolle auf dem Kopf
    GILL = rgb('e440d8')
    _m = (SRC[:, :, :3] == GILL[:3]).all(2) & (SRC[:, :, 3] > 0)
    _n, _lab = cv2.connectedComponents(_m.astype(np.uint8), connectivity=8)
    GILL_LAB = _lab
    GILL_N = _n
if V in ('lolek', 'captain'):
    _sh = load('shards')
    _n, _lab = cv2.connectedComponents((_sh[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    SHARDS = []
    for k in range(1, _n):
        ys, xs = np.nonzero(_lab == k)
        t = np.zeros((ys.max() - ys.min() + 1, xs.max() - xs.min() + 1, 4), int)
        t[ys - ys.min(), xs - xs.min()] = _sh[ys, xs]
        SHARDS.append(t)
    SHARDS.sort(key=lambda t: -int((t[:, :, 3] > 0).sum()))
    # (Vorlage, Anker x, Anker y im Frame, Periode x, Periode y, Phase)
    if V == 'lolek':
        PARTS = [(0, 1, 3, 24, 16, 0), (1, 26, 4, 16, 24, 5), (2, 1, 26, 48, 16, 11), (3, 28, 22, 24, 48, 17),
                 (4, 14, 1, 16, 24, 7), (5, 29, 12, 48, 24, 29)]
    else:
        PARTS = [(0, 1, 2, 24, 16, 3), (1, 21, 3, 16, 24, 9), (2, 1, 20, 48, 16, 14), (3, 22, 24, 24, 48, 21),
                 (4, 11, 1, 16, 24, 1), (5, 23, 13, 48, 24, 31)]
if V == 'mender':
    TRIDENT = load('trident')
    TRI = TRIDENT[:, :, 3] > 0
    GLOW = {rgb(c): k for k, c in enumerate(('fd51fe', 'f7a5fe', 'f9c0fe', 'fbd8fe'))}
    GLOW_COLS = [rgb(c) for c in ('fd51fe', 'f7a5fe', 'f9c0fe', 'fbd8fe', 'ffffff')]
if V == 'rakah':
    TAIL = load('tail')[:, :, 3] > 0
    BLOOD_COLS = [rgb('0f4d3d'), rgb('18775e')]
    BLOOD = np.array([[bool(SRC[y, x, 3]) and tuple(SRC[y, x]) in BLOOD_COLS for x in range(SW)] for y in range(SH)])
    BLOOD_HI = rgb('3fbf96')
    DRIPS = [(19, 0), (21, 7)]                       # (x, Phase) – Tropfen lösen sich unten
if V == 'asgore':
    TRIDENT = load('trident')[:, :, 3] > 0
    CAPE_L = {(x, y) for y in range(15, 29) for x in range(0, 18) if SRC[y, x, 3] and not TRIDENT[y, x]}
    CAPE_R = {(x, y) for y in range(15, 29) for x in range(27, SW) if SRC[y, x, 3]}
    LOOK = set(range(20, 30))                        # schaut zum Dreizack (links)
if V == 'saya':
    WINGS = load('wings')
    _wm = WINGS[:, :, 3] > 0
    _xs = np.arange(SW)[None, :]
    WING_L = _wm & (_xs < 13)
    WING_R = _wm & (_xs >= 13)
if V == 'tryse':
    ARM = (load('arm')[:, :, 3] > 0) | (load('hand')[:, :, 3] > 0) | (load('sword')[:, :, 3] > 0)
    ARM &= ~((load('body')[:, :, 3] > 0) & (np.arange(SW)[None, :] < 12))
    ARM &= np.arange(SH)[:, None] <= 14              # nur Arm, Hand und Schwert (nicht der Unterkörper)
    ARM_FIRST = {y: int(np.nonzero(ARM[y])[0].min()) for y in range(SH) if ARM[y].any()}   # Kante am Gesicht
if V == 'rhabi':
    GOLD = [rgb(c) for c in ('732910', 'd56210', 'ffb418', 'ffde5a', 'fff6ac')]
    EYE_GLOW = [rgb(c) for c in ('550808', '7a1010', 'a81818', '7a1010')]
    ARM_UL = {(x, y) for y in range(10, 16) for x in range(0, 7)}
    ARM_UR = {(x, y) for y in range(10, 16) for x in range(19, SW)}
    ARM_LL = {(x, y) for y in range(16, 21) for x in range(0, 8)}
    ARM_LR = {(x, y) for y in range(16, 21) for x in range(18, SW)}


def blend(dst, c, a):
    if not dst[3]:
        return np.array([*c[:3], a])
    f = a / 255
    return np.array([*(np.round(np.array(c[:3]) * f + dst[:3] * (1 - f))).astype(int), 255])


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def wave(d, dmax, i, amp, period=24, k=0.35):
    """Welle nach außen; Frame 0 = Ruhelage."""
    f = (d / dmax) ** 1.3
    return int(round(amp * f * (math.sin(2 * math.pi * i / period - k * d) + math.sin(k * d))))


def billow(y, y0, y1, i, amp=2.0, period=24):
    f = min(1.0, (y - y0) / max(1, y1 - y0 - 2))
    ph = 2 * math.pi * i / period
    return int(round(amp * (0.5 - 0.5 * math.cos(ph)) * f ** 1.2))


def stab(i):
    """Tryse: ausholen (-2), zustechen (+3), zurück."""
    t = i % 24
    return {6: -1, 7: -2, 8: -2, 9: 1, 10: 3, 11: 3, 12: 3, 13: 2, 14: 1}.get(t, 0)


def extra(x, y, i, b, sx):
    """Zusätzlicher Versatz eines Pixels (ohne Wippen/Atmen)."""
    dx, dy = 0, 0
    if V == 'arnold' and HAIR[y, x]:                 # Tolle weht im Wind (Spitze stärker, Wurzel fest)
        f = max(0.0, (HAIR_ROOT - y) / HAIR_ROOT)
        ph = 2 * math.pi * i / 24
        dx += int(round(2.2 * f * (0.5 - 0.5 * math.cos(ph)) * (0.85 + 0.15 * math.sin(3 * ph))))
    if V == 'arnold' and GILL_LAB[y, x]:
        k = GILL_LAB[y, x]
        dy += int(round(math.sin(2 * math.pi * i / 12 + k * 1.7) - math.sin(k * 1.7)))
    if V == 'rakah' and TAIL[y, x]:
        dy += wave(max(0, x - 18), 9, i, 0.8)
    if V == 'siphem':
        d = 13 - x if x <= 12 else (x - 23 if x >= 23 else 0)
        if d > 0:
            dy += wave(d, 13, i, 1.1)
    if V == 'asgore':
        if (x, y) in CAPE_L:
            dx -= billow(y, 15, 28, i)
        elif (x, y) in CAPE_R:
            dx += billow(y, 15, 28, i, period=16)
    if V == 'rhabi':
        t = i % 12
        up = 1 if t in (2, 3) else (2 if t in (8, 9) else 0)
        if ((x, y) in ARM_UL or (x, y) in ARM_LR) and up == 1:
            dy -= 1
        if ((x, y) in ARM_UR or (x, y) in ARM_LL) and up == 2:
            dy -= 1
    if V == 'tryse' and ARM[y, x] and x != ARM_FIRST[y]:   # die Kante am Gesicht bleibt stehen
        dx += sx
    return dx, dy


def frame(i, particles=True):
    s = SRC.copy()
    st = BLINK.get(i)
    if st and 'lid' in C:
        for (x, y), c in C['lid']:
            s[y, x] = rgb(c)
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
    if V == 'asgore' and i in LOOK and not st:       # Blick zum Dreizack
        s[8, 19], s[8, 20] = SRC[8, 20].copy(), SRC[8, 19].copy()
        s[9, 19], s[9, 20] = SRC[9, 20].copy(), SRC[9, 19].copy()
    if V == 'mender':                                # Dreizack pulsiert
        lvl = [0, 1, 2, 1][(i // 3) % 4]
        for y, x in zip(*np.nonzero(TRI)):
            k = GLOW.get(tuple(s[y, x]))
            if k is not None:
                s[y, x] = GLOW_COLS[min(4, k + lvl)]
    if V == 'rhabi':                                 # Lichtband über die goldene Krone
        for y in range(0, 6):
            for x in range(SW):
                c = tuple(s[y, x])
                if c in GOLD[:4]:
                    lv = sweep_level(x, y, i, N, speed=0.9, slope=0.8, offset=-6.0)
                    if lv:
                        s[y, x] = GOLD[min(4, GOLD.index(c) + lv)]
        for y, x in zip(*np.nonzero((SRC[:, :, :3] == (0x55, 0x08, 0x08)).all(2))):
            s[y, x] = EYE_GLOW[(i // 4) % 4]
    if V == 'rakah':                                 # grünes Blut fließt
        for y, x in zip(*np.nonzero(BLOOD)):
            if (y - i // 2) % 4 == 0:
                s[y, x] = BLOOD_HI
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12] if 'knee' in C else 0
    br = breath(i) if 'breath' in C else 0
    if V == 'saya':                                  # Flügel hinter ihr
        ph = 2 * math.pi * i / 16
        lift, sq = 0.3 * math.sin(ph), 0.9 + 0.1 * math.cos(ph)
        wing_img = np.zeros((H, W, 4), int)
        shear_flap(WINGS, WING_L, 6.0, -1, lift, sq, wing_img, (P, PT + b))
        shear_flap(WINGS, WING_R, 19.0, 1, lift, sq, wing_img, (P, PT + b))
        m = wing_img[:, :, 3] > 0
        out[m] = wing_img[m]
    sx = stab(i) if V == 'tryse' else 0
    arm_rows = {}
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            if V == 'saya' and WINGS[y, x, 3] and not (SRC[y, x] != WINGS[y, x]).any():
                continue                             # Flügelpixel schon gezeichnet
            dx, dy = extra(x, y, i, b, sx)
            dy += b if y < KNEE else 0
            if 'breath' in C and y <= C['breath']:
                dy += br
            if V == 'tryse' and ARM[y, x]:
                arm_rows.setdefault(y, []).append(x)
                if x != ARM_FIRST[y] and x + sx <= ARM_FIRST[y]:
                    continue                         # beim Ausholen hinter der Kante verschwinden
            out[y + PT + dy, x + P + dx] = s[y, x]
    if b < 0:                                        # Zeile über dem Knie dehnen – nur über den Beinen,
        y = KNEE - 1                                 # mit demselben Versatz wie das Pixel
        for x in range(SW):
            if s[y, x, 3] and KNEE < SH and s[KNEE, x, 3]:
                dx, dy = extra(x, y, i, b, sx)
                if not out[y + PT + dy, x + P + dx, 3]:
                    out[y + PT + dy, x + P + dx] = s[y, x]
    if br:                                           # Atmen: Zeile gedehnt
        y = C['breath']
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    if V == 'asgore':                                # Umhang: Innenkante nachziehen
        for cape, side, per in ((CAPE_L, -1, 24), (CAPE_R, 1, 16)):
            rows = {}
            for x, y in cape:
                rows[y] = max(rows.get(y, x), x) if side < 0 else min(rows.get(y, x), x)
            for y, xin in rows.items():
                d = billow(y, 15, 28, i, period=per)
                for k in range(d):
                    xx, yy = xin + P + side * k, y + PT + (b if y < KNEE else 0)
                    if not out[yy, xx, 3]:
                        out[yy, xx] = s[y, xin]
    if V == 'tryse':                                 # Kante am Gesicht immer obenauf und an ihrem Platz
        for y, x0 in ARM_FIRST.items():
            out[y + PT + (b if y < KNEE else 0), x0 + P] = s[y, x0]
    if V == 'tryse' and sx > 0:                      # Lücke hinter der festen Kante: Stoffgrau,
        top, bot = min(arm_rows), max(arm_rows)      # an Ober- und Unterkante schwarz weiter
        for y, xs in arm_rows.items():
            xs = sorted(xs)
            inner = [s[y, x] for x in xs[1:]] or [s[y, xs[0]]]
            grey = [v for v in inner if max(v[:3]) >= 0x10 and max(v[:3]) - min(v[:3]) < 0x14]
            for k in range(sx):
                if y in (top, bot):
                    c = s[y, xs[0]]
                else:
                    c = grey[min(k, len(grey) - 1)] if grey else inner[min(k, len(inner) - 1)]
                xx, yy = xs[0] + 1 + k + P, y + PT + (b if y < KNEE else 0)
                if not out[yy, xx, 3]:
                    out[yy, xx] = c
    fill_pinholes(out)
    if V == 'rakah':                                 # Tropfen lösen sich unten und fallen
        for x, ph in DRIPS:
            t = (i + ph) % 16
            ys = [y for y in range(SH) if BLOOD[y, x]]
            if not ys or t > 3:
                continue
            y = max(ys) + 1 + t
            yy = y + PT
            if 0 < yy < H - 1:
                out[yy, x + P] = BLOOD_COLS[1] if t < 3 else BLOOD_COLS[0]
    if V == 'rhabi':                                 # Krone glitzert
        for (x, y, start) in ((8, 2, 6), (13, 1, 22), (17, 2, 38)):
            for (px, py), c in sparkle_pixels(i, N, [(x + P, y + PT + b, start)], rgb('ffb418'), rgb('fff6ac')).items():
                assert 0 < px < W - 1 and 0 < py < H - 1, 'Glanz am Rand'
                out[py, px] = c
    if V == 'mender':                                # Funkeln an den Spitzen
        for (x, y, start) in ((16, 1, 6), (14, 3, 22), (18, 3, 38)):
            for (px, py), c in sparkle_pixels(i, N, [(x + P, y + PT + b, start)], rgb('fd51fe'), rgb('fbd8fe')).items():
                if 0 < px < W - 1 and 0 < py < H - 1:
                    out[py, px] = c
    if V == 'asgore':                                # Dreizack glitzert
        for (x, y, start) in ((4, 4, 4), (4, 12, 18), (4, 22, 30), (2, 29, 42)):
            for (px, py), c in sparkle_pixels(i, N, [(x + P, y + PT + b, start)], rgb('e2000c'), rgb('ffb0b0')).items():
                assert 0 < px < W - 1 and 0 < py < H - 1, 'Glanz am Rand'
                out[py, px] = c
    if particles and V in ('lolek', 'captain'):      # Scherben
        fig = cv2.dilate((out[:, :, 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0   # 1 px Abstand zur Figur
        for k, ax, ay, px, py, ph in PARTS:
            t = SHARDS[k % len(SHARDS)]
            x0 = ax + int(round(1.4 * math.sin(2 * math.pi * (i + ph) / px)))
            y0 = ay + int(round(1.8 * math.sin(2 * math.pi * (i + ph) / py)))
            th, tw = t.shape[:2]
            if x0 < 1 or y0 < 1 or x0 + tw > W - 1 or y0 + th > H - 1:
                continue
            m = t[:, :, 3] > 0
            if (fig[y0:y0 + th, x0:x0 + tw] & m).any():
                continue                             # ganz oder gar nicht
            region = out[y0:y0 + th, x0:x0 + tw]
            sh = t.copy()
            if (i + ph * 3) % 24 in (0, 1):          # funkeln
                sh[m] = np.array([255, 255, 255, 255])
            region[m] = sh[m]
            fig[y0:y0 + th, x0:x0 + tw] |= m
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=8, check_edges=True)
