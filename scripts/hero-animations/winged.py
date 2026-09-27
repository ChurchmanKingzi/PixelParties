# -*- coding: utf-8 -*-
"""Flügelschlag-Idles für MotiveMoe-Skins und -Heroes (gemeinsamer Aufbau).

Aufruf: python3 winged.py <tag> [ms] <variante>

  tempeste   Skin Absolute Moron Tempeste (Cirno): die Eiskristall-Flügel
             schlagen (spaltentreu geschert), sie schwebt; Schneeflocken
             rieseln um sie herum.
  mary       Skin Sickly Mary: die im Sprite angelegten Flügel spreizen sich,
             entfalten sich zu dazugezeichneten, ausgebreiteten Schwingen
             (molinda_wings.render_wing in Marys Palette, links gespiegelt),
             schlagen einmal hoch und runter und legen sich wieder an; die
             beiden Haarsträhnen oben wippen, sie schwebt.
  crestina   Skin SOS Crestina: die Flügelchen flattern, die lila Aura liegt
             in jedem Frame exakt 1 px um die Silhouette (wie bei Jenny),
             sie schwebt.
  molinda    Hero Cute Angel Molinda: wie Mary – die angelegten Flügel spreizen
             sich, entfalten sich zu dazugezeichneten Schwingen (ihre Palette),
             schlagen und legen sich wieder an; das Herz an ihrem Kopf pocht
             (Ba-bumm, 1 px größer); sie schwebt; Herzchen steigen als Partikel
             auf.
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
from molinda_wings import render_wing

V = next((v for v in sys.argv[2:] if v in ('tempeste', 'mary', 'crestina', 'molinda', 'melissa')), 'tempeste')
CFG = {
    'tempeste': dict(slug='absolute-moron-tempeste', prefix='tempeste_skin', mode='shear',
                     wing_cols=('92cde6', 'c1e2f5', '57a9da', '82b7d6'), left=8, right=17,
                     pivots={-1: 9, 1: 16}, period=8, amp=0.4, pad=5, parts='snow'),
    'mary': dict(slug='sickly-mary', prefix='sickly_mary', mode='drawn',
                 wing_cols=('f6ffff', 'd2d5d2', '586665', '292929'), left=5, right=16,
                 pivots={-1: (5.5, 6.0), 1: (15.5, 6.0)}, period=12, amp=0.30, pad=22, parts=None,
                 roots={-1: (6.5, 11.0), 1: (15.5, 11.0)}, crop=True,
                 palette=('292929', 'f6ffff', 'd2d5d2', '586665', 'd2d5d2'),
                 shape=(4.5, 5.0, 7.0, 5.0, 8, 2.6),
                 strands=[(7, 1), (8, 0), (14, 1), (13, 0)]),
    'crestina': dict(slug='sos-crestina', prefix='sos_crestina', mode='shear', aura='bb99ff',
                     wing_cols=('f6ffff', 'b4f6ff'), left=3, right=14,
                     pivots={-1: 4, 1: 13}, period=6, amp=0.4, pad=5, parts=None),
    'molinda': dict(slug='cute-angel-molinda', prefix='cute_angel_molinda', mode='drawn',
                    wing_cols=('9999ff', 'ccccff', 'f6ffff', '9966ff', '292929'), left=5, right=18,
                    pivots={-1: (5.0, 7.0), 1: (18.0, 7.0)}, period=12, amp=0.26, pad=22, parts='hearts',
                    roots={-1: (7.0, 12.0), 1: (17.0, 12.0)}, crop=True,
                    palette=('292929', 'f6ffff', 'ccccff', '9999ff', '9966ff'),
                    shape=(4.5, 5.0, 7.0, 5.0, 8, 2.6), head_heart=(18, 11), spread=0.2,
                    # Flügelspitzen oben und Flügelenden unten reichen bis x6–7 bzw. x16–17
                    wing_extra=[(6, 7, 0, 4, False), (16, 17, 0, 4, False),
                                (6, 7, 20, 26, True), (16, 17, 20, 26, True)]),
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
    for x0, x1, y0, y1, keep_outline in CFG.get('wing_extra', ()):   # (Kontur 292929 ggf. behalten)
        for y in range(y0, min(y1 + 1, SH)):
            for x in range(x0, x1 + 1):
                c = tuple(SRC[y, x])
                if SRC[y, x, 3] and c in cols and not (keep_outline and c == rgb('292929')):
                    WING[y, x] = True
    BODY = SRC.copy()
    BODY[WING] = 0
# Beim Spreizen der Original-Flügel dürfen dort, wo Arme/Hände davor liegen,
# keine Löcher mitwandern: diese Stellen im Flügel mit der Flügelfarbe von
# oben/unten füllen (die Arme werden ohnehin darübergezeichnet).
WING_FULL, WINGSRC_FULL = WING.copy(), WINGSRC.copy()
if CFG['mode'] == 'drawn':
    _gap = (SRC[:, :, 3] > 0) & ~WING & ((np.arange(SW)[None, :] <= CFG['left']) | (np.arange(SW)[None, :] >= CFG['right']))
    while _gap.any():
        _done = False
        for y, x in zip(*np.nonzero(_gap)):
            for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < SH and 0 <= xx < SW and WING_FULL[yy, xx]:
                    WINGSRC_FULL[y, x] = WINGSRC_FULL[yy, xx]
                    WING_FULL[y, x], _gap[y, x], _done = True, False, True
                    break
        assert _done
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
            cy = P + SH + 2 - t                     # unter den Füßen startend
            pts = [(cx + dx, cy + dy, c) for dx, dy, c in HEART]
            if any(not (1 <= x < W - 1 and 1 <= y < H - 1) or out[y, x, 3] for x, y, _ in pts) \
                    or out[cy - 1:cy + 4, cx - 2:cx + 3, 3].any():   # 1 px Abstand zur Figur
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


BIG_HEART = [(-2, -2), (-1, -2), (1, -2), (2, -2)] + [(dx, -1) for dx in range(-3, 4)] + \
    [(dx, 0) for dx in range(-3, 4)] + [(dx, 1) for dx in range(-2, 3)] + [(dx, 2) for dx in range(-1, 2)] + [(0, 3)]
H_MAIN, H_HI, H_DK = rgb('f75981'), rgb('f9a4b5'), rgb('dd4b76')


def draw_head_heart(out, i, off):
    """Pochen: in jeder Periode zwei Schläge (Ba-bumm), dann Ruhe (Original)."""
    if 'head_heart' not in CFG or i % CFG['period'] not in (0, 1, 3):
        return
    cx, cy = CFG['head_heart'][0] + off[0], CFG['head_heart'][1] + off[1]
    for dx, dy in BIG_HEART:
        c = H_HI if (dx, dy) in ((1, -1), (2, -1)) else \
            H_DK if (dx, dy) in ((-3, 0), (-2, 1), (-1, 2), (0, 3)) else H_MAIN
        out[cy + dy, cx + dx] = c


def strand_dx(x, y, i):
    """Mary: Spitzen der Haarsträhnen wippen seitlich."""
    if (x, y) not in CFG.get('strands', ()):
        return 0
    s = math.sin(2 * math.pi * i / 12 + (0 if x < SW / 2 else math.pi))
    return 1 if s > 0.5 else (-1 if s < -0.5 else 0)


def drawn_pose(i):
    """Mary, ein Schlag pro Periode: angelegt (Original) -> gespreizt ->
    entfaltet (gezeichnete Schwingen: tief, hoch, tief) -> gespreizt -> …
    ('orig', Spreizwinkel) bzw. ('drawn', Schlagwinkel, Spannweite)."""
    t = i % CFG['period']
    if t <= 1:
        return 'orig', 0.0, 0
    if t in (2, 11):
        return 'orig', CFG.get('spread', 0.4), 0
    # Aufschlag langsam, Abschlag kräftig; Spannweite: entfaltet sich, faltet zurück
    lift = (-0.5, -0.15, 0.2, 0.4, 0.2, -0.25, -0.55, -0.6)[t - 3]
    span = (0.72, 0.83, 0.9, 0.9, 0.9, 0.9, 0.86, 0.74)[t - 3]
    return 'drawn', lift, span


def draw_wings(out, i, off):
    kind, a, span = drawn_pose(i)
    cols = np.arange(SW)[None, :]
    if kind == 'orig':
        for side in (-1, 1):
            m = WING & ((cols < MID_X) if side < 0 else (cols >= MID_X))
            m = WING_FULL & ((cols < MID_X) if side < 0 else (cols >= MID_X))
            over(out, rotate_part(WINGSRC_FULL, m, CFG['pivots'][side], -side * a, (H, W), off))
        return
    pal = tuple(rgb(c)[:3] for c in CFG['palette'])
    for side in (-1, 1):
        rx, ry = CFG['roots'][side]
        rx, ry = rx + off[0], ry + off[1]
        if side > 0:
            render_wing(out, (rx, ry), a, span, palette=pal, shape=CFG['shape'])
        else:                                        # links: gespiegelt zeichnen
            tmp = np.zeros_like(out)
            render_wing(tmp, (W - rx, ry), a, span, palette=pal, shape=CFG['shape'])
            over(out, tmp[:, ::-1])


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    off = (P, P + dy)
    p = 2 * math.pi * i / CFG['period']
    cols = np.arange(SW)[None, :]
    if CFG['mode'] == 'drawn':
        draw_wings(out, i, off)
    for side in (-1, 1) if CFG['mode'] != 'drawn' else ():
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
    draw_head_heart(out, i, (P, P + dy))
    if AURA:
        for y, x in zip(*np.nonzero(ring8(out[:, :, 3] > 0))):
            out[y, x] = AURA
    particles(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    if CFG.get('crop'):                              # großzügiges Pad auf 2 px Rand kürzen
        a = np.any([f[:, :, 3] > 0 for f in frames], axis=0)
        ys, xs = np.nonzero(a)
        m = min(xs.min(), W - 1 - xs.max()) - 2      # links/rechts symmetrisch
        assert m >= 1 and ys.min() >= 3 and ys.max() <= H - 4, 'Pad zu klein – Flügel würden abgeschnitten'
        frames = [f[ys.min() - 2:ys.max() + 3, m:W - m] for f in frames]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 80
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=8, check_edges=True)
