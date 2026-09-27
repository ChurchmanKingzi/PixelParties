# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveDeri-Heroes und den Skin Layn Summonr of
Weapons.

Aufruf: python3 deri.py <tag> [ms] <variante>
Varianten: shapeshifter robber darge jean layn summoner ascended tharx

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu:
* shapeshifter: ???, the Shapeshifter – seine grauen Tentakel schlackern
            (weiches Verschiebungsfeld, rückwärts abgetastet: dünne Linien
            reißen nicht; am Körper fest, zur Spitze hin stärker); sein
            weißes Monsterauge glimmt.
* robber:   ???, the Throne Robber sitzt auf dem Thron (der steht fest): die
            Tentakel unter dem Gewand und rechts schlackern ebenso, der
            Tentakel mit der Hellebarde hält still; er blinzelt, die Krone
            blitzt.
* darge:    Bow Sniper Darge mit Bogen: die drei Geschosse (gefiederter Pfeil,
            Feuerpfeil, Bombe) werden einzeln zu verschiedenen Zeiten
            abgeschossen – jedes erscheint an seinem Platz aus der Karte
            (hinter Darge) und fliegt in seine eigene Richtung davon (links
            unten, unten, rechts unten), bis es ausgeblendet ist.
* jean:     der Ritter federt, seine Geldsäcke bleiben liegen; auf den Münzen
            der vier Säcke blitzt es nacheinander auf.
* layn:     Layn hinter den Zinnen (Zinnen, Hände und Schultern fest): der
            Kopf hebt sich beim Atmen um 1 px, sie blinzelt, der Helm blitzt.
* summoner: Layn Summonr of Weapons: Federn, Blinzeln, der Kopfschmuck blitzt.
* ascended: Layn, Master of Deri's Relic: Federn, Blinzeln, der Edelstein der
            Hellebarde funkelt.
* tharx:    Tharx (stehend): die Spitzen seines Schulterumhangs flattern
            hoch, er federt und blinzelt.
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
from flap_common import fill_pinholes

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
GOLD = ('ffe600', 'fff6ac')
V_ = {
    'shapeshifter': dict(slug='the-shapeshifter'),
    'robber': dict(slug='the-throne-robber', glint=(23, 1, 30, GOLD),
                   lid=[((30, 12), 'b3b3b3'), ((31, 12), 'b3b3b3')], line=[(30, 13), (31, 13)]),
    'darge': dict(slug='bow-sniper-darge', knee=23,
                  lid=[((13, 9), 'd5a462'), ((14, 9), 'd5a462')], line=[(13, 10), (14, 10)]),
    'jean': dict(slug='jean-the-pillaging-knight', knee=22,
                 lid=[((24, 10), 'f6bd7b'), ((25, 10), 'f6bd7b'), ((28, 10), 'f6bd7b'), ((29, 10), 'f6bd7b')],
                 line=[(24, 11), (25, 11), (28, 11), (29, 11)]),
    'layn': dict(slug='layn-defender-of-deri', head=17, glint=(8, 4, 30, GOLD),
                 lid=[((14, 12), 'f5ce88'), ((15, 12), 'f5ce88')], line=[(14, 13), (15, 13)]),
    'summoner': dict(slug='layn-summonr-of-weapons', knee=25, glint=(10, 0, 30, GOLD),
                     lid=[((12, 12), 'f5ce88'), ((13, 12), 'f5ce88')], line=[(12, 13), (13, 13)]),
    'ascended': dict(slug='layn-master-of-deri-s-relic', knee=34, glint=(6, 6, 30, ('b2f6ff', 'e0ffff')),
                     lid=[((13, 21), '125acf'), ((14, 21), 'acd6ff')], line=[(13, 21), (14, 21)]),
    'tharx': dict(slug='tharx-the-never-losing-general', knee=24,
                  lid=[((12, 7), 'f5ce88'), ((13, 7), 'f5ce88')], line=[(12, 8), (13, 8)]),
}
V = next((v for v in sys.argv[2:] if v in V_), 'tharx')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
N = 48
KNEE = C.get('knee', SH)
_ys, _xs = np.mgrid[0:SH, 0:SW]
OPAQUE = SRC[:, :, 3] > 0

# --- Tentakel ----------------------------------------------------------------
TENT = None
if V == 'shapeshifter':
    ARM = load('arm')[:, :, 3] > 0
    TENT = OPAQUE & ~ARM & ((_xs <= 24) | (_ys <= 10))
if V == 'robber':
    THRONE = load('throne')
    SRC = load('body')                               # der Thron wird extra gezeichnet
    OPAQUE = SRC[:, :, 3] > 0
    TENT = OPAQUE & (((_ys >= 24) & (_xs >= 16)) | ((_xs >= 39) & (_ys >= 17)))
if TENT is not None:
    # Stärke je Pixel: 0 am Körper, wächst mit dem Abstand zu ihm
    _body = (OPAQUE & ~TENT).astype(np.uint8)
    DIST = cv2.distanceTransform((1 - _body).astype(np.uint8), cv2.DIST_L2, 5)
    STRENGTH = np.clip((DIST - 1) / (12 if V == 'shapeshifter' else 5), 0, 1)
    CENTER = (30.0, 21.0) if V == 'shapeshifter' else (29.0, 21.0)   # Körpermitte
    SWING = 1.1

# --- Darge: Geschosse ----------------------------------------------------------
if V == 'darge':
    SHOTS = [load(f'shot{k}') for k in range(3)]
    # (linke obere Ecke im Sprite wie in der Karte, Flugrichtung, Startframe)
    SHOT_PLAN = [((-4, 22), (-0.65, 0.76), 4), ((17, 17), (0.0, 1.0), 20), ((26, 23), (0.72, 0.70), 34)]
    SHOT_LIFE, SHOT_SPEED = 9, 1.8

    def shot_state(k, i):
        """(x, y, Deckkraft) des Geschosses k in Frame i oder None."""
        (sx, sy), (vx, vy), start = SHOT_PLAN[k]
        t = (i - start) % N
        if t >= SHOT_LIFE:
            return None
        d = SHOT_SPEED * t
        alpha = [0.6, 1, 1, 1, 1, 1, 0.75, 0.5, 0.25][t]
        return sx + int(round(vx * d)), sy + int(round(vy * d)), alpha

    _bx0, _by1, _bx1 = 0, SH, SW
    for k in range(3):
        for i in range(N):
            st = shot_state(k, i)
            if st:
                h, w = SHOTS[k].shape[:2]
                _bx0, _bx1, _by1 = min(_bx0, st[0]), max(_bx1, st[0] + w), max(_by1, st[1] + h)
    PL, PR, PT, PB = 2 - _bx0, _bx1 - SW + 2, 4, _by1 - SH + 2
else:
    PL = PR = 3
    PT, PB = 4, 2

# --- Jean: Säcke liegen fest ---------------------------------------------------
if V == 'jean':
    BAG_COLS = {rgb(c) for c in ('9d6a37', '5a3920', 'e99d52', '7b532b', 'ba8700', 'ffc900', 'ffe600')}
    BAGS = np.array([[bool(SRC[y, x, 3]) and tuple(SRC[y, x]) in BAG_COLS for x in range(SW)]
                     for y in range(SH)])
    COINS = [(15, 14, 4), (34, 10, 16), (7, 29, 28), (42, 29, 40)]   # (x, y, Start) je Sack

H, W = SH + PT + PB, SW + PL + PR


def tentacle_offset(x, y, i):
    """Verschiebung (dx, dy) an (x, y): die Tentakel schwingen quer zur
    Richtung vom Körper weg, als Welle, die zur Spitze hinausläuft (peitschend);
    Frame 0 = Ruhelage."""
    f = STRENGTH[y, x]
    if not f:
        return 0.0, 0.0
    cx, cy = CENTER
    rx, ry = x + 0.5 - cx, y + 0.5 - cy
    r = math.hypot(rx, ry) or 1.0
    ph = 2 * math.pi * i / 24
    amp = SWING * f * (math.sin(ph - 0.2 * r) + math.sin(0.2 * r))
    return -ry / r * amp, rx / r * amp


def warp_tentacles(s, i, out, ox, oy):
    """Tentakel rückwärts abtasten (keine Löcher, dünne Linien reißen nicht)."""
    ys, xs = np.nonzero(TENT)
    for qy in range(max(0, ys.min() - 3), min(SH, ys.max() + 4)):
        for qx in range(max(0, xs.min() - 3), min(SW, xs.max() + 4)):
            dx, dy = tentacle_offset(qx, qy, i)
            px, py = int(round(qx - dx)), int(round(qy - dy))
            if 0 <= px < SW and 0 <= py < SH and TENT[py, px]:
                out[qy + oy, qx + ox] = s[py, px]


def tharx_lift(x, i):
    """Umhangspitzen (Spalten 0–3 und 26–29) heben sich zweimal pro Loop."""
    d = 4 - x if x <= 3 else (x - 25 if x >= 26 else 0)
    if d <= 0:
        return 0
    return -int(round(1.6 * (d / 4) * (0.5 - 0.5 * math.cos(2 * math.pi * i / 24))))


def put(out, y, x, c, a=1.0):
    if a >= 1 or not out[y, x, 3]:
        out[y, x] = [*c[:3], int(c[3] * a)]
    else:
        f = c[3] / 255 * a
        out[y, x] = [*(np.round(np.array(c[:3]) * f + out[y, x, :3] * (1 - f))).astype(int), 255]


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st and 'lid' in C:
        for (x, y), c in C['lid']:
            s[y, x] = rgb(c)
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
    if V == 'shapeshifter':                          # Monsterauge glimmt
        glow = rgb(['ffffff', 'eef8ff', 'd4eaff', 'eef8ff'][(i // 3) % 4])
        for x, y in ((26, 18), (27, 18), (26, 19), (27, 19)):
            s[y, x] = glow
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12] if 'knee' in C else 0
    if V == 'darge':                                 # Geschosse hinter Darge
        for k in range(3):
            stt = shot_state(k, i)
            if not stt:
                continue
            x0, y0, a = stt
            img = SHOTS[k]
            for yy, xx in zip(*np.nonzero(img[:, :, 3])):
                if img[yy, xx, 3] * a >= 20:
                    put(out, y0 + yy + PT, x0 + xx + PL, img[yy, xx], a)
    if V == 'robber':
        m = THRONE[:, :, 3] > 0
        out[PT:PT + SH, PL:PL + SW][m] = THRONE[m]
    head = C.get('head')
    breath = -1 if head and (i % 16) in range(5, 12) else 0
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3] or (TENT is not None and TENT[y, x]):
                continue
            if V == 'jean' and BAGS[y, x]:
                dy = 0
            else:
                dy = b if y < KNEE else 0
            if head and y < head:
                dy = breath
            if V == 'tharx' and 7 <= y <= 12:
                dy += tharx_lift(x, i)
            out[y + PT + dy, x + PL] = s[y, x]
    if TENT is not None:
        warp_tentacles(s, i, out, PL, PT)
    if b < 0 and KNEE < SH:                          # Zeile über dem Knie dehnen (nur über den Beinen)
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and s[KNEE, x, 3] and not out[y + PT, x + PL, 3] \
                    and not (V == 'jean' and BAGS[y, x]):
                out[y + PT, x + PL] = s[y, x]
    if breath:                                       # Hals/Kinnzeile nachziehen
        y = head - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + PL, 3]:
                out[y + PT, x + PL] = s[y, x]
    fill_pinholes(out)
    glints = [(x, y, t, GOLD) for x, y, t in COINS] if V == 'jean' else ([C['glint']] if 'glint' in C else [])
    for gx, gy, start, (t0, t1) in glints:
        oy = 0 if V == 'jean' else (breath if head else b)
        for (px, py), c in sparkle_pixels(i, N, [(gx + PL, gy + PT + oy, start)], rgb(t0), rgb(t1)).items():
            assert 0 < px < W - 1 and 0 < py < H - 1, 'Glanz am Rand'
            out[py, px] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=8, check_edges=True)
