# -*- coding: utf-8 -*-
"""Idle-Animation für Mr. Jiggles (Creature).

Quelle: src/mr-jiggles.png — die Puppe (12×12 px, 8 Farben) aus der Ebene „Mr Jiggles“
von MotiveBritain.xcf, so wie sie `hero-animations/assemble_britain.py` für Alice
herausgelöst hat (dort „Puppe unten“). Hier steht sie allein.

Aufruf:   python3 mr_jiggles.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mr-jiggles.png + .json
          (Sheet-Format wie data/hero-animations: ein waagerechter Streifen, JSON mit Rahmenmaß)
          --preview legt zusätzlich ein GIF (8-fach) und den Streifen in <ordner> ab.

Ablauf (32 Frames à 80 ms = 2,56 s):
* Watscheln: die Puppe schiebt sich im Rhythmus um ±1 px hin und her.
* Atmen: zweimal pro Loop streckt sie sich um eine Zeile (Zeile 6 wird verdoppelt).
* Ohrenzucken: erst das linke, dann das rechte Ohr rückt die Spitze 1 px nach außen.
* Laser-Augen: die roten Augenpixel pulsieren (dunkel → Rot → hell) im 8er-Takt.
* Hüpfer (Frames 18–28): Anlauf-Stauchung (Zeile 6 fällt weg, die Puppe wird eine Spalte
  breiter), Streckung beim Absprung, Scheitel, Streckung beim Fallen, Aufprall-Stauchung,
  dann zwei Wackler links/rechts („Jiggle“) und ein kleines Nachfedern.
Nur ganze Pixel, nur die Farben der Quelle plus die zwei Rottöne ihrer Augen-Palette.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src', 'mr-jiggles.png')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'data', 'creature-animations'))

D = np.array(Image.open(SRC).convert('RGBA')).astype(int)          # 12×12
SH, SW = D.shape[:2]
N, MS = 32, 80
P, PT, PB = 4, 3, 2                                                   # Rand links/rechts, oben, unten
W, H = SW + 2 * P, 22
GROUND = H - PB - 1                                                   # unterste Sprite-Zeile im Ruhezustand
MID = 6                                                               # Zeile, die verdoppelt/entfernt wird

EYE = (209, 0, 0, 255)
EYE_BRIGHT, EYE_DIM = (236, 39, 65, 255), (159, 17, 30, 255)
EYE_CYCLE = [EYE, EYE, EYE_BRIGHT, EYE_BRIGHT, EYE_BRIGHT, EYE, EYE_DIM, EYE_DIM]

HOP = {18: ('sq', 0, 0), 19: ('sq', 0, 0), 20: ('st', 1, 0), 21: ('st', 3, 0), 22: ('n', 4, 0), 23: ('n', 3, 0),
       24: ('st', 1, 0), 25: ('sq', 0, 0), 26: ('sq', 0, 1), 27: ('n', 0, -1), 28: ('st', 0, 1)}
BREATH = {3, 4, 5, 6, 9, 10, 11}


def twitch(s, i):
    """Ohrspitzen (Zeile 0: Spalten 3,4 links / 7,8 rechts) rücken kurz nach außen."""
    if i in (13, 14):
        s[0, 3:5] = 0
        s[0, 2:4] = D[0, 3:5]
    if i in (15, 16):
        s[0, 7:9] = 0
        s[0, 8:10] = D[0, 7:9]
    return s


def frame(i):
    s = D.copy()
    s = twitch(s, i)
    eye = EYE_CYCLE[i % 8]
    for y in range(SH):
        for x in range(SW):
            if tuple(D[y, x]) == EYE:
                s[y, x] = eye
    mode, hop, dx_extra = HOP.get(i, ('st' if i in BREATH else 'n', 0, 0))
    rows = list(range(SH))
    if mode == 'st':                                                  # gestreckt: Zeile MID doppelt
        rows.insert(MID, MID)
    elif mode == 'sq':                                                # gestaucht: Zeile MID weg, eine Spalte breiter
        rows.remove(MID)
    cols = list(range(SW))
    if mode == 'sq':
        cols.insert(SW // 2, SW // 2)
    spr = s[np.ix_(rows, cols)]
    dx = int(round(math.sin(2 * math.pi * i / N))) + dx_extra
    out = np.zeros((H, W, 4), int)
    h, w = spr.shape[:2]
    y0 = GROUND - hop - (h - 1)
    x0 = P + dx - (w - SW) // 2
    out[y0:y0 + h, x0:x0 + w] = spr
    return out


def main():
    frames = [frame(i) for i in range(N)]
    for k, f in enumerate(frames):                                    # nichts darf am Rand kleben
        a = f[:, :, 3] > 0
        assert not (a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()), f'Frame {k} berührt den Rand'
    sheet = np.concatenate(frames, axis=1).astype(np.uint8)
    alpha = np.stack([f[:, :, 3] > 0 for f in frames])
    top = int(min(np.nonzero(a.any(axis=1))[0].min() for a in alpha))
    left = int(min(np.nonzero(a.any(axis=0))[0].min() for a in alpha))
    right = int(min(W - 1 - np.nonzero(a.any(axis=0))[0].max() for a in alpha))
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(sheet).save(os.path.join(OUT, 'mr-jiggles.png'))
    meta = {'creature': 'Mr. Jiggles', 'sheet': 'mr-jiggles.png', 'frameWidth': W, 'frameHeight': H, 'frames': N, 'frameMs': MS,
            'loop': True, 'layout': 'horizontal', 'padTop': top, 'padLeft': left, 'padRight': right, 'padBottom': PB, 'faceX': W / 2}
    with open(os.path.join(OUT, 'mr-jiggles.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print('geschrieben:', os.path.join(OUT, 'mr-jiggles.png'), sheet.shape, meta)
    if '--preview' in sys.argv:
        d = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(d, exist_ok=True)
        imgs = []
        for f in frames:
            im = Image.fromarray(f.astype(np.uint8)).resize((W * 8, H * 8), Image.NEAREST)
            b = Image.new('RGBA', im.size, (40, 30, 70, 255)); b.alpha_composite(im); imgs.append(b.convert('RGB'))
        imgs[0].save(os.path.join(d, 'mr-jiggles-idle.gif'), save_all=True, append_images=imgs[1:], duration=MS, loop=0, disposal=2)
        strip = Image.new('RGB', (W * 4 * N // 2, H * 4 * 2), (40, 30, 70))
        for k, f in enumerate(frames):
            im = Image.fromarray(f.astype(np.uint8)).resize((W * 4, H * 4), Image.NEAREST)
            b = Image.new('RGBA', im.size, (40, 30, 70, 255)); b.alpha_composite(im)
            strip.paste(b.convert('RGB'), ((k % (N // 2)) * W * 4, (k // (N // 2)) * H * 4))
        strip.save(os.path.join(d, 'mr-jiggles-idle-strip.png'))


if __name__ == '__main__':
    main()
