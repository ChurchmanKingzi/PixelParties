# -*- coding: utf-8 -*-
"""Idle-Animation für Bakhm, the Desert Digger und den Skin World Eater Bakhm
(MotiveEgypt.xcf: „Bakhm #4“ + „Bakhm #1“ bzw. „Ebene #82“).

Aufruf: python3 bakhm.py <tag> [ms] [hero|worm]

Beide kommen „aus dem Boden“: die untersten Zeilen laufen in die Transparenz
aus. Der Übergang ist am Bild fest (der Boden bewegt sich nicht), so taucht
beim Heben etwas mehr von ihnen auf.
* Der Körper besteht aus einzelnen Segmenten (hero: Schädel mit Hals, drei
  Wirbel; worm: Kopf, drei Körperringe; das unterste Segment steckt im
  Boden). Jedes bewegt sich in eigenem Takt: es staucht sich um bis zu 2 px
  in das Segment darunter (die Stauchungen addieren sich nach oben) und
  pendelt seitlich – benachbarte Segmente höchstens 1 px gegeneinander.
  Obere Segmente liegen über den unteren.
* Er hebt und senkt sich um 1 px (taucht ein Stück auf und wieder ein).
* Der Unterkiefer klappt zweimal pro Loop auf und zu (vorne weiter als am
  Gelenk).
* worm: das Auge blinzelt einmal pro Loop; über die Stoßzähne läuft zweimal
  pro Loop ein Blitz zur Spitze, dort blinkt ein Glitzerstern auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'worm')), 'hero')


def seg_hero(x, y):
    """Schädel+Hals, drei Wirbel, Boden (Startzeilen 0, 24, 32, 42, 54)."""
    return sum(y >= y0 for y0 in (24, 32, 42, 54))


def seg_worm(x, y):
    """Kopf (samt Hals-Übergang), drei Körperringe, Boden."""
    if y <= 13 or (y <= 23 and x < 27):
        return 0
    return 1 + sum(y >= y0 for y0 in (24, 31, 38))


CFG = {
    'hero': dict(slug='bakhm-the-desert-digger', prefix='bakhm', P=3,
                 jaw=lambda x, y: 17 <= y <= 23 and x <= 22, hinge=22, seg=seg_hero, head_follows=False),
    # die Zähne, die vom Oberkiefer über die Maulkante hängen, bleiben am Kopf:
    # der dünne vorn (x5–7, bis Zeile 15) und der hintere (x13–16, bis Zeile 14)
    'worm': dict(slug='world-eater-bakhm', prefix='world_eater_bakhm', P=7,
                 jaw=lambda x, y: 13 <= y <= 22 and x <= 24 and not (x <= 7 and y <= 15)
                 and not (13 <= x <= 16 and y <= 14), hinge=24,
                 seg=seg_worm, head_follows=True),
}[V]
SRC = np.array(Image.open(f"src/{CFG['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = CFG['P'], 3, 1
H, W = SH + PT + PB, SW + 2 * P
N = 48
FADE = 8                                             # so viele Zeilen laufen unten aus
GROUND = PT + SH                                     # Bodenlinie im Bild (fest)
SEG = np.array([[CFG['seg'](x, y) for x in range(SW)] for y in range(SH)])
NSEG = 5
SEG_PERIOD, SEG_PHASE = 12, [0.0, 1.2, 2.4, 3.6]    # Stauchtakt je Segment (oben zuerst)
SEG_SWAY = [2.0, 1.5, 1.0, 0.5]                     # seitliches Pendeln je Segment
# worm: Auge (x10–15, Zeilen 4–8) – Lid in Hautfarbe, Wimpernlinie dunkel
EYE_COLS = {rgb(c) for c in ('707c26', '393f19', '2e321b', '141416')}
EYE = [(x, y) for y in range(4, 9) for x in range(9, 16) if SRC[y, x, 3] and tuple(SRC[y, x]) in EYE_COLS]
LID, LID_LINE = rgb('755f62'), rgb('1f0d0d')
BLINK = {30: 'halb', 31: 'zu', 32: 'zu', 33: 'halb'}
# worm: Stoßzähne blitzen (ein helles Band läuft von der Wurzel zur Spitze)
TUSK_COLS = {rgb(c) for c in ('b6a47c', '806a45')}
TUSK_FLASH = [16, 40]                                # Startframes
TUSK_STAR = (-2, 17)                                 # Glitzerstern links vor der Spitze
WHITE = np.array([255, 250, 230])


def seg_motion(i):
    """(dy, dx) je Segment; das unterste (im Boden) bleibt stehen."""
    own = [int(round(1 + math.sin(2 * math.pi * i / SEG_PERIOD - SEG_PHASE[k]))) for k in range(NSEG - 1)] + [0]
    dys = [sum(own[k:]) for k in range(NSEG)]        # Stauchungen addieren sich nach oben
    dxs = [int(round(SEG_SWAY[k] * math.sin(2 * math.pi * i / 24 - 0.6 * k))) for k in range(NSEG - 1)] + [0]
    for k in range(NSEG - 2, -1, -1):                # höchstens 1 px gegen das Segment darunter
        dxs[k] = max(dxs[k + 1] - 1, min(dxs[k + 1] + 1, dxs[k]))
    if CFG['head_follows']:                          # senkrechter Schnitt Kopf|Ring: gleich seitlich
        dxs[0] = dxs[1]
    return dys, dxs


def rise(i):
    return -1 if (i % 24) in range(6, 18) else 0


def jaw_open(i):
    t = i % 24
    return (0, 0.5, 1, 1, 1, 0.5)[t - 8] if 8 <= t < 14 else 0


def tusk_flash(x, y, i):
    """Helligkeit des Blitzes auf den Stoßzähnen (0..1)."""
    for t0 in TUSK_FLASH:
        t = i - t0
        if 0 <= t < 8:
            g = 26 - t * 3.5                         # Band wandert nach links zur Spitze
            d = abs(x + (y - 18) * 0.5 - g)
            if d < 2.5:
                return 0.7 if d < 1.2 else 0.35
    return 0.0


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i) if V == 'worm' else None
    if st:
        top = min(y for _, y in EYE)
        for x, y in EYE:
            if st == 'zu' or y <= top + 1:
                s[y, x] = LID_LINE if (st == 'halb' and y == top + 1) or (st == 'zu' and y == 7) else LID
    if V == 'worm':
        for y in range(SH):
            for x in range(SW):
                if s[y, x, 3] and tuple(s[y, x]) in TUSK_COLS:
                    a = tusk_flash(x, y, i)
                    if a:
                        s[y, x, :3] = (s[y, x, :3] * (1 - a) + WHITE * a).astype(int)
    out = np.zeros((H, W, 4), int)
    oy = PT + rise(i)
    op = jaw_open(i)
    dys, dxs = seg_motion(i)
    for k in range(NSEG - 1, -1, -1):                # unten zuerst, obere liegen darüber
        for y in range(SH):
            for x in range(SW):
                if not s[y, x, 3] or SEG[y, x] != k:
                    continue
                dy = int(round(op * 2 * (CFG['hinge'] - x) / CFG['hinge'])) if CFG['jaw'](x, y) else 0
                out[y + oy + dy + dys[k], x + P + dxs[k]] = s[y, x]
    fill_pinholes(out)
    if V == 'worm':                                  # Glitzerstern an der Zahnspitze
        sx, sy = TUSK_STAR
        for t0 in TUSK_FLASH:
            for (x, y), c in sparkle_pixels(i, N, [(sx + P + dxs[0], sy + oy + dys[0], t0 + 6)],
                                            rgb('fff8e0'), rgb('e0d0a0')).items():
                assert 1 <= x < W - 1 and 1 <= y < H - 1, 'Glitzerstern ragt an den Rand'
                out[y, x] = c
    for y in range(GROUND - FADE, GROUND):           # unten in den Boden auslaufen lassen
        f = (GROUND - y) / (FADE + 1)
        out[y, :, 3] = (out[y, :, 3] * f).astype(int)
    out[GROUND:, :, :] = 0
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=6, check_edges=True)
