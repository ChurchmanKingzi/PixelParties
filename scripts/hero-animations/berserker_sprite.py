# -*- coding: utf-8 -*-
"""Skin-Sprite „Berserker“ (Fate/Zero) für Null, the Mage Slayer.

Basis ist Nulls eigene Rüstung (src/null-the-mage-slayer-body.png): sie wird in
schwarz-violetten Berserker-Stahl umgefärbt, die drei roten Kerne weichen einem
roten Sichel-Visier, und die lila Klinge wird durch Berserkers langes, grobes,
blutiges Plattenschwert ersetzt. Die Leinwand ist größer als bei Null (Platz für
die längere Klinge, die Hörner und Berserkers wehende Bänder).

Erzeugt (alle gleich groß, deckungsgleich):
  src/berserking-null-body.png    Körper (ohne Bänder, die kommen in der Animation)
  src/berserking-null-blade.png   das blutige Schwert
  src/berserking-null.png         beides zusammen (Vorschau/Kartenbild)
Aufruf (aus scripts/hero-animations):  python3 berserker_sprite.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from anim_common import rgb

W, H = 64, 38
OX, OY = 9, 7                                    # Nulls Körper (53x30) sitzt hier in der größeren Leinwand
OL = rgb('05040a')

# Null-Grau -> Berserker-Stahl (Stufen bleiben erhalten)
RECOLOR = {
    '000000': '05040a', '292929': '15122b', '414141': '221e42', '525252': '34305c',
    '6a6a6a': '48437a', '7b7b7b': '5c5796', '9c9c9c': '8a85c6',
}
BLOOD = [rgb(h) for h in ('2e0000', '6e0505', 'a80d0d', 'd92b24', 'ff7a66')]   # dunkel -> hell
VISOR = {'edge': rgb('8a0010'), 'core': rgb('ff2438'), 'hot': rgb('ffb8a8')}
CORES = [(36, 9), (36, 14), (36, 19)]            # 2x2, Koordinaten im Null-Körper


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def shift(m, dx, dy):
    o = np.zeros_like(m)
    h, w = m.shape
    o[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = \
        m[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return o


def body():
    src = np.array(Image.open('src/null-the-mage-slayer-body.png').convert('RGBA')).astype(int)
    for y, x in zip(*np.nonzero(src[:, :, 3])):
        k = hexc(src[y, x])
        if k in RECOLOR:
            src[y, x] = rgb(RECOLOR[k])
    for cx, cy in CORES[1:]:                                    # untere Kerne -> dunkle Plattenmitte
        src[cy:cy + 2, cx:cx + 2] = rgb('0b0916')
    src[CORES[0][1]:CORES[0][1] + 2, CORES[0][0]:CORES[0][0] + 2] = rgb('05040a')
    out = np.zeros((H, W, 4), int)
    out[OY:OY + src.shape[0], OX:OX + src.shape[1]] = src
    return out


def visor(out):
    """Rotes Sichel-Visier (Lächeln) im schwarzen Gesicht, in Leinwandkoordinaten."""
    c = (OX, OY)
    pix = {
        (34, 9): 'edge', (35, 10): 'core', (36, 11): 'core', (37, 11): 'hot', (38, 11): 'hot', (39, 11): 'hot',
        (40, 11): 'core', (41, 11): 'core', (42, 10): 'core', (43, 9): 'edge',
        (35, 9): 'edge', (42, 9): 'edge', (37, 12): 'edge', (38, 12): 'edge', (39, 12): 'edge', (40, 12): 'edge',
        (36, 10): 'edge', (41, 10): 'edge',
    }
    for (x, y), k in pix.items():
        out[y + c[1], x + c[0]] = VISOR[k]


def blade():
    """Berserkers Plattenschwert: breit, grob, kantig, nach links gestreckt (Heft rechts bei x=27)."""
    img = np.zeros((H, W, 4), int)
    top = {x: 14 for x in range(5, 27)}
    # Oberkante mit Kerben (grob geschlagen)
    for x in range(5, 27):
        top[x] = 14 + (1 if x in (9, 15, 21) else 0)
    bot = {x: 21 for x in range(8, 27)}
    for x in range(8, 27):
        bot[x] = 21 - (1 if x in (11, 18) else 0)
    m = np.zeros((H, W), bool)
    for x in range(5, 27):
        lo = bot.get(x, 20 - (8 - x) * 1)
        hi = top[x]
        if x < 8:                                                # Spitze: Unterkante steigt nach links an
            lo = 19 - max(0, 7 - x) // 1 * 0 - (8 - x) // 1 + 2
        for y in range(hi, lo + 1):
            m[y, x] = True
    # Spitze (diagonal)
    for x, (y0, y1) in {4: (15, 18), 3: (16, 18), 2: (17, 18), 1: (18, 18)}.items():
        m[y0:y1 + 1, x] = True
    # Schattierung: oben hell, unten dunkel, Rinne in der Mitte
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        t = (y - top.get(x, 15)) / max(1, (bot.get(x, 19) - top.get(x, 15)))
        lv = 4 if y == top.get(x, 15) else (3 if t < 0.35 else (2 if t < 0.7 else 1))
        img[y, x] = BLOOD[lv]
    for x in range(8, 25):                                        # Blutrinne
        img[18, x] = BLOOD[0] if x % 2 else BLOOD[1]
    for x in (7, 12, 19):                                         # Glanzpunkte
        img[15, x] = BLOOD[4]
    ring = shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    img[ring & ~m] = OL
    # Heft: Parierstange und Griffband
    for y in range(12, 24):
        img[y, 27] = rgb('15122b')
        img[y, 28] = rgb('34305c') if y not in (12, 23) else rgb('15122b')
    img[11, 27:29] = OL
    img[24, 27:29] = OL
    img[12:24, 26] = np.where((img[12:24, 26, 3] > 0)[:, None], img[12:24, 26], OL)
    return img


def save(a, n):
    Image.fromarray(a.astype(np.uint8)).save(f'src/{n}.png')


def comp(*layers):
    c = np.zeros_like(layers[0])
    for l in layers:
        m = l[:, :, 3] > 0
        c[m] = l[m]
    return c


if __name__ == '__main__':
    b = body()
    visor(b)
    s = blade()
    al = comp(b, s)[:, :, 3] > 0
    ys, xs = np.nonzero(al)
    print('Inhalt x', xs.min(), xs.max(), 'y', ys.min(), ys.max())
    save(b, 'berserking-null-body')
    save(s, 'berserking-null-blade')
    c = comp(s, b)
    save(c, 'berserking-null')
    im = Image.fromarray(c.astype(np.uint8))
    bg = Image.new('RGBA', im.size, (120, 120, 120, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 10, im.height * 10), Image.NEAREST).save(
        os.environ.get('PREVIEW', 'berserker_preview.png'))
