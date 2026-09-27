# -*- coding: utf-8 -*-
"""Flügelschlag-Idles für MotiveMoe-Skins und -Heroes (gemeinsamer Aufbau).

Aufruf: python3 winged.py <tag> [ms] <variante>

  tempeste   Skin Absolute Moron Tempeste (Cirno): die Eiskristall-Flügel
             schlagen (spaltentreu geschert), sie schwebt; Schneeflocken
             rieseln um sie herum.
  mary       Skin Sickly Mary: die weißen Flügel schlagen (Drehung um die
             Schultern), die beiden Haarsträhnen oben wippen, sie schwebt.
  crestina   Skin SOS Crestina: die Flügelchen flattern, die lila Aura liegt
             in jedem Frame exakt 1 px um die Silhouette (wie bei Jenny),
             sie schwebt.
  molinda    Hero Cute Angel Molinda: die Flügel schlagen (Drehung um die
             Schultern), sie schwebt; Herzchen steigen als Partikel auf.
  melissa    Hero Cute Meanie Melissa: die schwarzen Flügel (eigene Ebene)
             schlagen, sie schwebt; Herzchen steigen als Partikel auf.

Flügel werden über Farbe + Lage (außerhalb der Körpermitte) vom Körper
getrennt. Herzchen und Schnee werden nur ganz und nur ins Bild gezeichnet.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, ring8
from flap_common import shear_flap, rotate_part, over, fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('tempeste', 'mary', 'crestina', 'molinda', 'melissa')), 'tempeste')
CFG = {
    'tempeste': dict(slug='absolute-moron-tempeste', prefix='tempeste_skin', mode='shear',
                     wing_cols=('92cde6', 'c1e2f5', '57a9da', '82b7d6'), left=8, right=17,
                     pivots={-1: 9, 1: 16}, period=8, amp=0.4, pad=5, parts='snow'),
    'mary': dict(slug='sickly-mary', prefix='sickly_mary', mode='rotate',
                 wing_cols=('f6ffff', 'd2d5d2', '586665', '292929'), left=5, right=16,
                 pivots={-1: (5.5, 6.0), 1: (15.5, 6.0)}, period=12, amp=0.30, pad=6, parts=None,
                 strands=[(7, 1), (8, 0), (14, 1), (13, 0)]),
    'crestina': dict(slug='sos-crestina', prefix='sos_crestina', mode='shear', aura='bb99ff',
                     wing_cols=('f6ffff', 'b4f6ff'), left=3, right=14,
                     pivots={-1: 4, 1: 13}, period=6, amp=0.4, pad=5, parts=None),
    'molinda': dict(slug='cute-angel-molinda', prefix='cute_angel_molinda', mode='rotate',
                    wing_cols=('9999ff', 'ccccff', 'f6ffff', '9966ff', '292929'), left=4, right=19,
                    pivots={-1: (5.0, 7.0), 1: (18.0, 7.0)}, period=12, amp=0.26, pad=7, parts='hearts'),
    'melissa': dict(slug='cute-meanie-melissa', prefix='cute_meanie_melissa', mode='rotate', wing_file=True,
                    pivots={-1: (12.0, 9.0), 1: (17.0, 9.0)}, period=12, amp=0.26, pad=7, parts='hearts'),
}[V]

SRC = np.array(Image.open(f"src/{CFG['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
if CFG.get('wing_file'):
    WINGSRC = np.array(Image.open(f"src/{CFG['slug']}-wings.png").convert('RGBA')).astype(int)
    BODY = np.array(Image.open(f"src/{CFG['slug']}-body.png").convert('RGBA')).astype(int)
    WING = WINGSRC[:, :, 3] > 0
else:
    WINGSRC = SRC
    cols = {rgb(c) for c in CFG['wing_cols']}
    xs = np.arange(SW)[None, :].repeat(SH, 0)
    WING = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in cols for x in range(SW)] for y in range(SH)]) \
        & ((xs <= CFG['left']) | (xs >= CFG['right']))
    BODY = SRC.copy()
    BODY[WING] = 0
AURA = rgb(CFG['aura']) if CFG.get('aura') else None
if AURA:                                             # Aura wird pro Frame neu gelegt
    BODY[(BODY[:, :, :3] == AURA[:3]).all(2)] = 0
    WING &= ~(SRC[:, :, :3] == AURA[:3]).all(2)
P = CFG['pad']
H, W = SH + 2 * P, SW + 2 * P
N = 48 if CFG['period'] in (6, 8, 12, 16) and V in ('tempeste', 'crestina') else 36
MID_X = SW / 2
PINK, PINK_HI, PINK_DK = rgb('ff66cc'), rgb('ffb3e6'), rgb('d13a9a')
HEART = [(-1, 0, PINK_HI), (1, 0, PINK), (-1, 1, PINK), (0, 1, PINK), (1, 1, PINK_DK), (0, 2, PINK_DK)]
SNOW = [rgb('ffffff'), rgb('e0f4ff'), rgb('b8e2f8')]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def bob(i):
    return int(round(math.sin(2 * math.pi * i / N * 2)))      # schweben, 2 Wellen pro Loop


def particles(out, i):
    kind = CFG['parts']
    if kind == 'hearts':
        per = N // 2
        for k in range(4):
            t = (i + k * per // 4) % per
            if t >= per - 4:
                continue
            gen = ((i + k * per // 4) // per) % 2
            side = -1 if k % 2 else 1
            cx = int(round(W / 2 + side * (SW / 2 + 1 - rnd(k, gen) * 3) + math.sin(t * 0.5 + k)))
            cy = H - 5 - t
            pts = [(cx + dx, cy + dy, c) for dx, dy, c in HEART]
            if any(not (1 <= x < W - 1 and 1 <= y < H - 1) or out[y, x, 3] for x, y, _ in pts):
                continue
            a = 255 if t < per - 9 else int(255 * (per - 4 - t) / 5)
            for x, y, c in pts:
                out[y, x] = (*c[:3], a)
    elif kind == 'snow':
        for k in range(8):
            per = N
            t = (i + k * per // 8) % per
            x = int(round(2 + rnd(k, 3) * (W - 4) + math.sin(t * 0.4 + k) * 1.2))
            y = int(round(1 + t * (H - 3) / per))
            if 1 <= x < W - 1 and 1 <= y < H - 1 and out[y, x, 3] == 0:
                out[y, x] = SNOW[k % 3]


def strand_dx(x, y, i):
    """Mary: Spitzen der Haarsträhnen wippen seitlich."""
    if (x, y) not in CFG.get('strands', ()):
        return 0
    s = math.sin(2 * math.pi * i / 12 + (0 if x < SW / 2 else math.pi))
    return 1 if s > 0.5 else (-1 if s < -0.5 else 0)


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    off = (P, P + dy)
    p = 2 * math.pi * i / CFG['period']
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = WING & ((cols < MID_X) if side < 0 else (cols >= MID_X))
        if CFG['mode'] == 'shear':
            lift, sq = CFG['amp'] * math.sin(p), 0.8 + 0.2 * math.cos(p)
            shear_flap(WINGSRC, m, CFG['pivots'][side], side, lift, sq, out, off, curve=1.0)
        else:
            amp = CFG['amp']
            ang = lambda r, s=side: -s * amp * (0.5 - 0.5 * math.cos(p - 0.03 * r))   # nach außen spreizen
            over(out, rotate_part(WINGSRC, m, CFG['pivots'][side], ang, (H, W), off))
    for y in range(SH):
        for x in range(SW):
            if BODY[y, x, 3]:
                out[y + P + dy, x + P + strand_dx(x, y, i)] = BODY[y, x]
    fill_pinholes(out)
    if AURA:
        for y, x in zip(*np.nonzero(ring8(out[:, :, 3] > 0))):
            out[y, x] = AURA
    particles(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 80
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=8, check_edges=True)
