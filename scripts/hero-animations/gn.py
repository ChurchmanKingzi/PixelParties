# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGN-Heroes und -Skins.

Aufruf: python3 gn.py <tag> [ms] <variante>

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu je Variante:
* andras:    fliegt: schwebt sachte auf und ab, die Flammenwerfer lodern
             (Feuer-Flackern: Farbstufen wandern nach außen, die Spitzen
             zucken).
* friedhelm / titan: hängt an den Drähten seiner Manöver-Ausrüstung: zwei
             Drahtseile laufen von den Geräten schräg nach oben aus dem Bild
             (oben ausgeblendet), er pendelt daran sachte hin und her.
* ftriffel:  Future Tech Gunslinger Riffel: Federn, Blinzeln, die Rauchspur
             der Kanone flirrt.
* ascriffel: Riffel, Master of the Ultimate Gun: Federn, Blinzeln, die zwei
             schwebenden Pistolen wippen gegenläufig.
* mgriffel:  Magical Girl Riffel: Federn, Blinzeln, Glitzern am Hut.
* kassaran:  Federn, seine weißen Seher-Augen pulsieren.
* kent:      Federn, über seine Brillengläser huscht ein Lichtreflex.
* koperniko: Federn, Blinzeln, die Teleskop-Linse funkelt.
* waflav:    Thunderstruck Waflav schwebt, schlägt mit den Flügeln; die Blitze
             sind einzelne Partikel, die unabhängig flackern und zucken.
* heinz / madheinz: Federn, über die Brille bzw. den Hut huscht ein Reflex.
* ralzish / blueralzish: über die Klinge läuft ein Lichtreflex, der grüne Hieb
             bei Ralzish flackert.
* pixmarck:  Federn, Blinzeln, die Helmspitze blitzt.
* dad:       Dad of the Year: Federn, die Schussstreifen ziehen davon.
* nero:      Nero Zira hängt an seinen Schläuchen: er sackt sachte 1 px ab
             (die Schläuche oben bleiben fest und werden gedehnt), die Augen
             glimmen.
* normalnero: Normal Nero Zira hängt ebenso und blinzelt (die großen Augen
             schließen sich zu einem schwarzen Strich).
* orthos:    die Flammen auf den Köpfen lodern.
* luna:      die kleinen Flügel schlagen.
* tsuki:     leuchtet hellgelb bis weiß, leicht durchscheinend mit weichem
             Lichtsaum, und schwebt; das Leuchten pulsiert.
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
from flap_common import fill_pinholes, shear_flap

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
GOLD = ('ffe600', 'fff6ac')
WHITE2 = ('e8f4ff', 'ffffff')
N = 48

V_ = {
    'andras': dict(slug='andras-the-human-weapon', part='body', hover=True, pad=3,
                   lid=[((39, 11), 'f5ce88'), ((40, 11), 'f5ce88'), ((43, 11), 'f5ce88'), ((44, 11), 'f5ce88')],
                   line=[(39, 12), (40, 12), (43, 12), (44, 12)]),
    'friedhelm': dict(slug='friedhelm-the-misled-avenger', wires=((1, 8), (22, 8)), pt=12,
                      lid=[((9, 6), 'f5ce88'), ((10, 6), 'f5ce88')], line=[(9, 7), (10, 7)]),
    'titan': dict(slug='titan-slayer-friedhelm', wires=((1, 8), (22, 8)), pt=12,
                  lid=[((9, 7), 'f5ce88'), ((10, 7), 'f5ce88')], line=[(9, 8), (10, 8)]),
    'ftriffel': dict(slug='future-tech-gunslinger-riffel', knee=20,
                     lid=[((33, 8), 'f6bd98'), ((34, 8), 'f6bd98')], line=[(33, 9), (34, 9)]),
    'ascriffel': dict(slug='riffel-master-of-the-ultimate-gun', knee=22,
                      lid=[((23, 10), 'f6bd98'), ((24, 10), 'f6bd98')], line=[(23, 11), (24, 11)]),
    'mgriffel': dict(slug='magical-girl-riffel', knee=21, glint=(7, 1, 30, GOLD),
                     lid=[((5, 8), 'f6bd98'), ((6, 8), 'f6bd98')], line=[(5, 9), (6, 9)]),
    'kassaran': dict(slug='kassaran-seer-of-everything', knee=19),
    'kent': dict(slug='kent-the-indebted-apprentice', knee=20),
    'koperniko': dict(slug='koperniko-the-stargazer', knee=24, glint=(34, 1, 30, WHITE2),
                      lid=[((7, 12), 'f8bc77'), ((8, 12), 'f8bc77'), ((10, 12), 'ffd6a3'), ((11, 12), 'ffd6a3')],
                      line=[(7, 13), (8, 13), (10, 13), (11, 13)]),
    'waflav': dict(slug='thunderstruck-waflav', part='body', hover=True, pad=3),
    'heinz': dict(slug='visionary-genius-heinz', knee=21),
    'madheinz': dict(slug='mad-scientist-heinz', knee=20),
    'ralzish': dict(slug='wall-breaker-general-ralzish'),
    'blueralzish': dict(slug='blue-ralzish'),
    'pixmarck': dict(slug='von-pixmarck-the-iron-chancellor', knee=23, glint=(9, 1, 30, GOLD),
                     lid=[((7, 10), 'd5a462'), ((11, 10), 'd5a462')], line=[(6, 10), (7, 10), (10, 10), (11, 10)]),
    'dad': dict(slug='dad-of-the-year-von-pixmarck', knee=21),
    'nero': dict(slug='nero-zira-the-mastermind', hang=6),
    'normalnero': dict(slug='normal-nero-zira', hang=1),
    'orthos': dict(slug='orthos-the-loyal-guard-dog'),
    'luna': dict(slug='luna-the-flame-fairy'),
    'tsuki': dict(slug='tsu-ki-the-lunatic-princess', hover=True, pad=4),
}
V = next((v for v in sys.argv[2:] if v in V_), 'kent')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
P = C.get('pad', 3)
PT, PB = C.get('pt', 4), 2
if C.get('hover'):
    PT, PB = P + 1, P + 1
H, W = SH + PT + PB, SW + 2 * P
_ys, _xs = np.mgrid[0:SH, 0:SW]


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


# --- Feuer --------------------------------------------------------------------
def fire(part, i, dist, amp=0.22, cycles=3, k=0.45):
    """Flackerndes Feuer: die Hitze jedes Pixels (Rang seiner Helligkeit in
    der Palette des Teils) schwankt mit einer weichen Welle, die entlang dist
    (Abstand vom Ursprung der Flamme) nach außen läuft – die Farbbänder
    wandern also zur Spitze hin. Nur äußerste, kühle Spitzenpixel (außen kein
    Nachbar mehr) verlöschen kurz; es lösen sich keine Funken ab.
    Frame 0 = Originalbild."""
    m = part[:, :, 3] > 0
    cols = sorted({tuple(int(v) for v in part[y, x]) for y, x in zip(*np.nonzero(m))}, key=lambda c: lum(np.array(c)))
    rank = {c: j for j, c in enumerate(cols)}
    n = len(cols) - 1
    out = np.zeros_like(part)
    w = 2 * math.pi * cycles * i / N
    gy, gx = np.gradient(dist)
    for y, x in zip(*np.nonzero(m)):
        c = tuple(int(v) for v in part[y, x])
        h = rank[c] / n
        ph = 0.9 * math.sin(0.23 * x + 0.31 * y) + 0.7 * math.sin(0.17 * x - 0.26 * y)
        s = dist[y, x]
        h2 = h + amp * (math.sin(w - k * s + ph) - math.sin(-k * s + ph))
        if h2 < -0.05 and h < 0.3:
            nx, ny = int(round(x + np.sign(gx[y, x]))), int(round(y + np.sign(gy[y, x])))
            outer = not (0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx])
            if outer:
                continue                                 # Spitze verlischt kurz
        out[y, x] = cols[int(round(min(1.0, max(0.0, h2)) * n))]
    return out


# --- Varianten-Vorbereitung ---------------------------------------------------
if V == 'andras':
    FLAMES = load('flames')
    FL_DIST = np.hypot(_xs - 42.0, _ys - 20.0)
if V == 'orthos':
    FLAME_M = (SRC[:, :, 3] > 0) & (_ys <= 10) & (SRC[:, :, 0] > SRC[:, :, 2] + 40)
    FL_DIST = (10.0 - _ys).astype(float)
if V == 'waflav':
    WINGS = load('wings')
    BOLT = load('bolt')
    n_, LAB, ST, _ = cv2.connectedComponentsWithStats((BOLT[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    BOLTS = [(LAB == k) for k in range(1, n_)]
    # je Blitz: (Phase, Dauer aus) – jeder ist in Frame 0 sichtbar
    BOLT_OFF = [((7 + 11 * k) % 40 + 3, 2 + k % 3) for k in range(len(BOLTS))]
if V == 'luna':
    # die gelb-orangen Flügel (nicht der rote Schild dahinter)
    WING_M = (SRC[:, :, 3] > 0) & ((_xs <= 5) | (_xs >= 12)) & (_ys >= 5) & (_ys <= 16) \
        & (SRC[:, :, 1] >= 0x80) & (SRC[:, :, 0] > 0xf0) & (SRC[:, :, 2] < 0x40)
    SHIELD = rgb('ff0000')
if V == 'ascriffel':
    GUNS = load('guns')
if V == 'dad':
    SMOKE = load('smoke')
if V == 'ftriffel':
    SMOKE_M = (SRC[:, :, 3] > 0) & (SRC[:, :, 3] < 255)
if V in ('ralzish', 'blueralzish'):
    SWORD = load('sword')
    BLADE = (SWORD[:, :, 3] > 0) & (lum(SWORD) > 150)
    SLASH = (SRC[:, :, 3] > 0) & (SRC[:, :, 1] > 180) & (SRC[:, :, 2] < 140) if V == 'ralzish' else None
if V == 'tsuki':
    BODY = load('body').astype(float)
    MASK = load('mask')
    _op = BODY[:, :, 3] > 0
    _l = lum(BODY) / 255
    _f = np.clip((_l - _l[_op].min()) / (_l[_op].max() - _l[_op].min()), 0, 1)[:, :, None]
    _lo, _mid, _hi = (np.array(rgb(c)[:3], float) for c in ('f0d050', 'fff6b8', 'ffffff'))
    GLOW_RGB = np.where(_f < 0.5, _lo + (_mid - _lo) * (_f / 0.5), _mid + (_hi - _mid) * ((_f - 0.5) / 0.5))
if V in ('kent', 'heinz', 'madheinz'):
    # Reflex-Flächen: Brillengläser (Kent/Heinz) bzw. Hutkrempe (Mad Heinz)
    SHINE = {'kent': (SRC[:, :, 3] > 0) & (lum(SRC) > 200) & (_ys >= 7) & (_ys <= 10),
             'heinz': (SRC[:, :, 3] > 0) & (lum(SRC) > 200) & (_ys >= 9) & (_ys <= 10),
             'madheinz': (SRC[:, :, 3] > 0) & (lum(SRC) > 170) & (_ys <= 5)}[V]
if V == 'kassaran':
    EYES = (SRC[:, :, 3] > 0) & (lum(SRC) > 240) & (_ys >= 5) & (_ys <= 8)
if V == 'normalnero':
    _eye_cols = {rgb(c) for c in ('94837d', 'ede4e0', 'ffffff', 'cdc2bf', '01349e', '12316d')}
    EYE_M = np.array([[tuple(SRC[y, x]) in _eye_cols and 12 <= y <= 18 and (21 <= x <= 26 or 33 <= x <= 38)
                       for x in range(SW)] for y in range(SH)])
if V == 'nero':
    EYES = (SRC[:, :, 3] > 0) & (SRC[:, :, 0] > SRC[:, :, 1] + 25) & (_ys >= 10) & (_ys <= 20)


def hover(i):
    return int(round(math.sin(2 * math.pi * i / 24)))


def sweep(mask, i, start, speed=1.5, width=1.5):
    """Lichtreflex, der schräg über die Pixel von mask läuft (einmal pro Loop)."""
    t = (i - start) % N
    pos = t * speed - 4
    ys, xs = np.nonzero(mask)
    hit = {}
    for y, x in zip(ys, xs):
        d = abs((x + y * 0.6) - pos)
        if d < width:
            hit[(x, y)] = 1.0 if d < width / 2 else 0.5
    return hit


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st and 'lid' in C:
        for (x, y), c in C['lid']:
            s[y, x] = rgb(c)
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
    if V == 'normalnero' and st:                         # große Augen: Lid senkt sich
        for y, x in zip(*np.nonzero(EYE_M)):
            if st == 'zu' or y <= 14:
                s[y, x] = rgb('e6c6b8')
        if st == 'zu':
            for x in list(range(22, 26)) + list(range(34, 38)):
                s[16, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12] if 'knee' in C else 0
    hang = int(round(0.5 - 0.5 * math.cos(2 * math.pi * i / 24))) if 'hang' in C else 0
    hv = hover(i) if C.get('hover') else 0
    ox, oy = P, PT + hv

    # -- Effekte auf dem Sprite selbst --
    if V == 'kassaran':                                  # Seher-Augen pulsieren
        f = 0.5 - 0.5 * math.cos(2 * math.pi * i / 24)
        for y, x in zip(*np.nonzero(EYES)):
            s[y, x] = [int(255 - 40 * f), int(255 - 10 * f), 255, 255]
    if V == 'nero':                                      # Augen glimmen
        f = 0.5 - 0.5 * math.cos(2 * math.pi * i / 24)
        for y, x in zip(*np.nonzero(EYES)):
            s[y, x] = lighten(s[y, x], 0.35 * f)
    if V in ('kent', 'heinz', 'madheinz'):
        for (x, y), f in sweep(SHINE, i, 20, speed=1.2).items():
            s[y, x] = lighten(s[y, x], 0.8 * f)
    if V in ('ralzish', 'blueralzish'):
        sw = SWORD.copy()
        for (x, y), f in sweep(BLADE, i, 10, speed=1.6 if V == 'ralzish' else 2.0, width=2.0).items():
            sw[y, x] = lighten(sw[y, x], 0.85 * f)
        m = sw[:, :, 3] > 0
        s[m] = sw[m]
        if SLASH is not None:                            # grüner Hieb flackert
            f = 0.5 + 0.5 * math.sin(2 * math.pi * 4 * i / N)
            for y, x in zip(*np.nonzero(SLASH)):
                s[y, x] = lighten(s[y, x], 0.5 * f)
    if V == 'orthos':
        fl = fire(np.where(FLAME_M[:, :, None], s, 0), i, FL_DIST, amp=0.25, cycles=4, k=0.6)
        s[FLAME_M] = 0
        m = fl[:, :, 3] > 0
        s[m] = fl[m]
    if V == 'ftriffel':                                  # Rauchspur flirrt
        for y, x in zip(*np.nonzero(SMOKE_M)):
            f = 0.75 + 0.25 * math.sin(2 * math.pi * 2 * i / N - 0.5 * x)
            s[y, x, 3] = int(SRC[y, x, 3] * f)
    if V == 'tsuki':                                     # hell leuchtend, durchscheinend
        f = 0.5 - 0.5 * math.cos(2 * math.pi * i / 24)
        s = np.zeros_like(SRC)
        s[_op, :3] = np.clip(GLOW_RGB[_op] + 10 * f, 0, 255).astype(int)
        s[_op, 3] = 214
        mk = MASK[:, :, 3] > 0
        s[mk] = MASK[mk]
        d = cv2.distanceTransform((~_op).astype(np.uint8), cv2.DIST_L2, 3)
        halo = np.zeros((H, W, 4), int)
        for r, a in ((1.0, 110), (2.0, 55), (3.0, 22)):
            for y, x in zip(*np.nonzero((~_op) & (d <= r + 0.01))):
                if not halo[y + oy, x + ox, 3]:
                    halo[y + oy, x + ox] = [255, 248, 200, int(a * (0.8 + 0.4 * f))]
        # Lichtsaum liegt auch außerhalb des Sprites
        big = np.pad(_op, 3)
        d2 = cv2.distanceTransform((~big).astype(np.uint8), cv2.DIST_L2, 3)
        for y, x in zip(*np.nonzero((~big) & (d2 <= 3.01))):
            yy, xx = y - 3 + oy, x - 3 + ox
            if 0 <= yy < H and 0 <= xx < W and not halo[yy, xx, 3]:
                r = d2[y, x]
                a = 110 if r <= 1.01 else (55 if r <= 2.01 else 22)
                halo[yy, xx] = [255, 248, 200, int(a * (0.8 + 0.4 * f))]
        out[:] = halo

    # -- Teile hinter der Figur --
    if 'wires' in C:
        sway = math.sin(2 * math.pi * i / N)
        ox += int(round(sway))
        for (gx, gy), side in zip(C['wires'], (-1, 1)):
            ax, ay = gx + side * 16 + P, -40                 # Aufhängung weit oben außerhalb
            x0, y0 = gx + ox, gy + oy
            n = max(abs(ax - x0), abs(ay - y0))
            for k in range(n + 1):
                x = int(round(x0 + (ax - x0) * k / n))
                y = int(round(y0 + (ay - y0) * k / n))
                if 1 <= y < H - 1 and 1 <= x < W - 1 and not out[y, x, 3]:
                    a = 255 if y >= 5 else int(255 * (y - 1) / 4)
                    if a > 0:
                        out[y, x] = [0x9a, 0x9a, 0x9a, a]
    if V == 'andras':
        fl = fire(FLAMES, i, FL_DIST)
        m = fl[:, :, 3] > 0
        out[oy:oy + SH, ox:ox + SW][m] = fl[m]
    if V == 'waflav':
        lift = 0.12 * math.sin(2 * math.pi * i / 24)
        wl = np.zeros((SH, SW, 4), int)
        wm = WINGS[:, :, 3] > 0
        shear_flap(WINGS, wm & (_xs < 40), 34, -1, lift, 1.0 - 0.08 * max(0, lift) / 0.12, wl, curve=1.3)
        shear_flap(WINGS, wm & (_xs >= 40), 46, 1, lift, 1.0 - 0.08 * max(0, lift) / 0.12, wl, curve=1.3)
        m = wl[:, :, 3] > 0
        out[oy:oy + SH, ox:ox + SW][m] = wl[m]

    # -- Figur --
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = b if y < KNEE else 0
            if 'hang' in C and y >= C['hang']:
                dy = hang
            if V == 'koperniko' and x >= 16:              # das Teleskop steht fest
                dy = 0
            if V == 'luna' and WING_M[y, x]:
                out[y + oy, x + ox] = SHIELD                 # darunter liegt der rote Schild
                continue
            yy, xx = y + oy + dy, x + ox
            if s[y, x, 3] < 255 and out[yy, xx, 3]:      # halbtransparent über Hintergrund mischen
                f = s[y, x, 3] / 255
                out[yy, xx] = [*(np.round(s[y, x, :3] * f + out[yy, xx, :3] * (1 - f))).astype(int),
                               max(out[yy, xx, 3], s[y, x, 3])]
            else:
                out[yy, xx] = s[y, x]
    if b < 0 and KNEE < SH:                              # Zeile über dem Knie dehnen (nur über den Beinen)
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and s[KNEE, x, 3] and not out[y + oy, x + ox, 3] and not (V == 'koperniko' and x >= 16):
                out[y + oy, x + ox] = s[y, x]
    if hang:                                             # Schläuche oben dehnen
        y = C['hang'] - 1
        for x in range(SW):
            if s[y, x, 3] and s[y + 1, x, 3] and not out[y + 1 + oy, x + ox, 3]:
                out[y + 1 + oy, x + ox] = s[y, x]
    if V == 'luna':                                      # kleine Flügel schlagen
        lift = 0.5 * math.sin(2 * math.pi * 3 * i / N)
        wl = np.zeros((H, W, 4), int)
        shear_flap(s, WING_M & (_xs <= 5), 7, -1, lift, 1.0, wl, offset=(ox, oy))
        shear_flap(s, WING_M & (_xs >= 12), 10, 1, lift, 1.0, wl, offset=(ox, oy))
        m = (wl[:, :, 3] > 0) & (out[:, :, 3] > 0)         # nur innerhalb des Schilds
        out[m] = wl[m]

    # -- Teile vor der Figur --
    if V == 'ascriffel':                                 # Pistolen wippen gegenläufig
        for k, side in enumerate((-1, 1)):
            gy = int(round(math.sin(2 * math.pi * i / 24 + (0 if side < 0 else math.pi))))
            gm = (GUNS[:, :, 3] > 0) & ((_xs < SW // 2) if side < 0 else (_xs >= SW // 2))
            for y, x in zip(*np.nonzero(gm)):
                out[y + oy + gy, x + ox] = GUNS[y, x]
        # die Pistolen liegen im Sprite selbst schon – ihr Ruheplatz wird oben gelöscht
    if V == 'dad':                                       # Schussstreifen ziehen nach rechts davon
        t = (i % 24) / 24
        for y, x in zip(*np.nonzero(SMOKE[:, :, 3] > 0)):
            xx = x + int(round(3 * t)) + ox
            a = int(SMOKE[y, x, 3] * (1 - 0.6 * t))
            if xx < W - 1:
                out[y + oy + b, xx] = [*SMOKE[y, x, :3], a]
    if V == 'waflav':                                    # Blitze flackern einzeln
        for k, bm in enumerate(BOLTS):
            ph, off = BOLT_OFF[k]
            if 0 < (i - ph) % N < off + 1 and k > 0:
                continue
            jx = 0 if k == 0 else int(round(math.sin(2 * math.pi * (i + 5 * k) / 16)))
            main_flick = k == 0 and (i // 3) % 5 == 4
            for y, x in zip(*np.nonzero(bm)):
                c = BOLT[y, x]
                if main_flick:
                    c = lighten(c, 0.5)
                out[y + oy, x + ox + jx] = c
    fill_pinholes(out)
    if 'glint' in C:
        gx, gy, start, (t0, t1) = C['glint']
        gb = 0 if V == 'koperniko' else b
        for (px, py), c in sparkle_pixels(i, N, [(gx + ox, gy + oy + gb, start)], rgb(t0), rgb(t1)).items():
            assert 0 < px < W - 1 and 0 < py < H - 1, 'Glanz am Rand'
            out[py, px] = c
    return out


if V == 'ascriffel':                                     # Pistolen aus dem Sprite nehmen, sie werden extra gezeichnet
    _g = load('guns')[:, :, 3] > 0
    SRC[_g] = 0
if V == 'dad':
    _g = load('smoke')[:, :, 3] > 0
    SRC[_g] = 0
if V == 'waflav':
    pass


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
