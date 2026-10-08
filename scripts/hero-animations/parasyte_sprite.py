# -*- coding: utf-8 -*-
"""Skin-Sprite „Parasytic ???“ (Parasyte) für ???, the Shapeshifter.

Basis ist src/the-shapeshifter.png (48x40, Teile -body/-arm aus MotiveDeri.xcf): der Mensch bleibt wie
er ist; die grauen Tentakel (und der graue Auswuchs mit dem weißen Auge) werden zu „Fleischwaffen“
der Parasiten: rote Muskelstränge mit hellen Fasern, an den freien Spitzen sitzen silberne Klingen.
Die Leinwand ist größer (Platz für die Klingen).

Erzeugt (alle gleich groß, deckungsgleich):
  src/parasytic-shapeshifter.png         das ganze Sprite
  src/parasytic-shapeshifter-tent.png    nur die Tentakel samt Klingen (beweglicher Teil)
  src/parasytic-shapeshifter-blades.png  nur die Klingen
Aufruf (aus scripts/hero-animations):  python3 parasyte_sprite.py
"""
import math
import os
import numpy as np
import cv2
from PIL import Image
from anim_common import rgb

OX, OY = 14, 16                      # Lage des Original-Sprites in der größeren Leinwand
W2, H2 = 76, 68

OUTLINE = rgb('3a1117')                                   # dunkles Blutrot statt Grau
FLESH = [rgb(c) for c in ('8e2a35', 'b8454d', 'd9696f', 'efb0a8')]   # tief, Muskel, hell, Faser
STEEL = {'edge': rgb('1c2026'), 'dark': rgb('78808b'), 'mid': rgb('b4bbc4'), 'light': rgb('e8ecf0'), 'hi': rgb('ffffff')}

# Klingen: (Name, Spitze des Tentakels im Original-Sprite, Richtung (x, y), Länge, Basisbreite/2, Krümmung in rad)
BLADES = [
    ('top',    (32, 1),  (-0.16, -0.99), 15, 2.4, -1.0),
    ('horn',   (23, 7),  (0.35, -0.94), 12, 2.1, -0.8),
    ('loop',   (17, 22), (0.45, -0.89), 11, 2.1, 0.9),
    ('arm',    (46, 23), (0.97, -0.24), 11, 2.0, -0.8),
    ('left',   (1, 32),  (-0.86, 0.51), 14, 2.3, 0.9),
    ('bottom', (16, 38), (-0.8, 0.6), 13, 2.1, -0.9),
]


def hexc(p):
    return '%02x%02x%02x' % tuple(int(v) for v in p[:3])


def tent_masks(src, arm):
    h, w = src.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    op = src[:, :, 3] > 0
    growth = arm & (xs >= 41) & (ys <= 24)
    tent = op & ((~arm & ((xs <= 24) | (ys <= 10))) | growth)      # wie deri.py: der schwingende Teil
    grays = {'333333', '969696', 'b3b3b3', '595b58', '3b3d3a', '606060', '535353', '484848', '3d3d3d', '717171', '898989', '2b2b2b', '222222'}
    isgray = np.array([[op[y, x] and hexc(src[y, x]) in grays for x in range(w)] for y in range(h)])
    recolor = isgray & (tent | (xs <= 30))                            # auch der graue Auswuchs am Kopf
    return tent, recolor


def flesh(src, recolor):
    """Graue Röhren -> Muskelstränge: Kontur dunkelrot, Füllung mit diagonalen Fasern."""
    out = src.copy()
    for y, x in zip(*np.nonzero(recolor)):
        k = hexc(src[y, x])
        if k in ('333333', '2b2b2b', '222222', '3b3d3a', '484848', '3d3d3d'):
            out[y, x] = OUTLINE
        else:
            band = (x + 2 * y) % 6
            tone = {0: 1, 1: 1, 2: 3, 3: 1, 4: 2, 5: 1}[band]       # Muskel, Muskel, Faser, Muskel, hell, Muskel
            out[y, x] = FLESH[tone]
    return out


def blade_mask(tip, d, length, hw, curv):
    """Klinge als Maske in Original-Koordinaten (größerer Bereich): Mittellinie mit Krümmung, nach vorn spitz."""
    h, w = H2, W2
    mask = np.zeros((h, w), np.uint8)
    cl = []                                                          # Mittellinie
    ang0 = math.atan2(d[1], d[0])
    x, y = tip[0] + OX + 0.5 + d[0] * 0.8, tip[1] + OY + 0.5 + d[1] * 0.8
    steps = int(length * 4)
    for s in range(steps + 1):
        t = s / steps
        ang = ang0 + curv * t * t                                    # Krümmung nimmt zur Spitze zu (Sichel)
        cl.append((x, y, ang, hw * (1 - t) ** 0.75 + 0.2))
        x += math.cos(ang) * length / steps
        y += math.sin(ang) * length / steps
    for cx, cy, ang, r in cl:
        cv2.circle(mask, (int(round(cx - 0.5)), int(round(cy - 0.5))), max(0, int(round(r - 0.2))), 1, -1)
    return mask > 0, cl


def draw_blade(img, mask, cl, hw):
    """Stahlfarben nach Seite zur Mittellinie: eine Kante hell, Mitte mittel, andere Seite dunkel; dunkle Kontur."""
    ys, xs = np.nonzero(mask)
    pts = np.array([[c[0], c[1]] for c in cl])
    for y, x in zip(ys, xs):
        d2 = (pts[:, 0] - (x + 0.5)) ** 2 + (pts[:, 1] - (y + 0.5)) ** 2
        k = int(d2.argmin())
        cx, cy, ang, r = cl[k]
        side = -math.sin(ang) * (x + 0.5 - cx) + math.cos(ang) * (y + 0.5 - cy)      # >0: links der Laufrichtung
        t = k / (len(cl) - 1)
        if side < -0.45 * max(r, 0.6):
            c = STEEL['light']
        elif side > 0.45 * max(r, 0.6):
            c = STEEL['dark']
        else:
            c = STEEL['mid']
        if t < 0.18 and c is STEEL['dark']:
            c = STEEL['mid']
        img[y, x] = c
    for (x, y) in ((int(round(cl[int(len(cl) * 0.35)][0] - 0.5)), int(round(cl[int(len(cl) * 0.35)][1] - 0.5))),):
        if mask[y, x]:
            img[y, x] = STEEL['hi']


def outline(img, mask, others):
    ring = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    ring &= ~mask
    ring &= ~others
    img[ring] = STEEL['edge']


def build():
    src = np.array(Image.open('src/the-shapeshifter.png').convert('RGBA')).astype(int)
    arm = np.array(Image.open('src/the-shapeshifter-arm.png').convert('RGBA'))[:, :, 3] > 0
    tent, recolor = tent_masks(src, arm)
    fl = flesh(src, recolor)
    canvas = np.zeros((H2, W2, 4), int)
    canvas[OY:OY + src.shape[0], OX:OX + src.shape[1]] = fl
    tent_big = np.zeros((H2, W2), bool)
    tent_big[OY:OY + src.shape[0], OX:OX + src.shape[1]] = tent | recolor
    occupied = canvas[:, :, 3] > 0
    blades = np.zeros((H2, W2, 4), int)
    allm = np.zeros((H2, W2), bool)
    for name, tip, d, ln, hw, curv in BLADES:
        m, cl = blade_mask(tip, d, ln, hw, curv)
        m &= ~occupied
        draw_blade(blades, m, cl, hw)
        allm |= m
    outline(blades, allm, occupied)
    ring = (blades[:, :, 3] == 0)
    blades[blades[:, :, 3] == 0] = 0
    for y, x in zip(*np.nonzero(allm | (cv2.dilate(allm.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0))):
        if blades[y, x, 3] == 0 and (blades[y, x, :3] != 0).any():
            blades[y, x, 3] = 255
    # Alpha der Klingenpixel setzen
    for y, x in zip(*np.nonzero((blades[:, :, :3] != 0).any(2))):
        blades[y, x, 3] = 255
    whole = canvas.copy()
    bm = blades[:, :, 3] > 0
    whole[bm & ~occupied] = blades[bm & ~occupied]
    tent_layer = np.zeros_like(whole)
    tm = (tent_big & (canvas[:, :, 3] > 0)) | (bm & ~occupied)
    tent_layer[tm] = whole[tm]
    return whole, tent_layer, blades


def save(a, n):
    Image.fromarray(a.astype(np.uint8)).save(f'src/{n}.png')


if __name__ == '__main__':
    whole, tent, blades = build()
    save(whole, 'parasytic-shapeshifter')
    save(tent, 'parasytic-shapeshifter-tent')
    save(blades, 'parasytic-shapeshifter-blades')
    im = Image.fromarray(whole.astype(np.uint8))
    bg = Image.new('RGBA', im.size, (110, 110, 110, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 10, im.height * 10), Image.NEAREST).save(os.environ.get('PREVIEW', '/tmp/parasyte_preview.png'))
    print('Größe', im.size, 'Inhalt', im.getbbox())
