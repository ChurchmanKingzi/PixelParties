# -*- coding: utf-8 -*-
"""Skin-Sprite „Dr. Heinz N. Stein“ (Frankensteins Monster) für Visionary Genius Heinz.

Umbau von src/visionary-genius-heinz.png (22x26): gleiche Silhouette, Pose und Konturen, aber grüne
Haut, schwarze Flattop-Frisur mit Narbe, Nackenbolzen, dunkles Tweed-Sakko über Strickpulli, dunkle
Hose und schwere Stiefel. Kopf und Bolzen sind von Hand gezeichnet, der Körper wird anhand der
Farben der Vorlage umgefärbt (Kittel -> Sakko, Hände -> grün, Stiefel -> schwarz).
Erzeugt src/dr-heinz-n-stein.png.
Aufruf (aus scripts/hero-animations):  python3 dr_stein_sprite.py
"""
import os
import numpy as np
from PIL import Image
from anim_common import rgb

BASE = 'src/visionary-genius-heinz.png'
OUT = 'src/dr-heinz-n-stein.png'

PAL = {
    '#': '000000',
    'a': '2d2d2b', 'b': '41413f', 'c': '5f5f5c', 'd': '84847f',       # Haar (dunkel -> Glanz)
    'G': 'b9d395', 'g': '8fb06f', 'h': '6a894c', 'i': '49633b',       # grüne Haut (hell -> tief)
    'e': 'b3bd99', 'k': '10150e', 'S': 'd3cba9', 'm': '2c3827',       # Auge, Pupille, Narbe, Mund
    'M': 'b9bfc8', 'N': '6b7079', 'W': 'eef1f4',                                    # Bolzen (Metall)
    'K': '62666c', 'J': '4e5258', 'j': '3f4248', 'L': '2f3238', 'l': '212328',   # Sakko (hell -> dunkel)
    'P': '2a2c33', 'p': '1b1d22',                                    # Hose
    'T': '63604f', 't': '4c493d',                                    # Strickpulli
    '0': '1c1c1c', '1': '3b3b3b', '2': '5a5a5a', '3': '8c8c8c',      # Stiefel
}


def c(ch):
    return rgb(PAL[ch])


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def hexc(p):
    return '%02x%02x%02x' % tuple(int(v) for v in p[:3])


# Flattop-Frisur (Zeilen 0-5) mit unregelmäßigem Haaransatz (Zeile 6) und hoher Stirn (Zeilen 6-8)
def hair(a):
    a[:9, :] = 0
    for x in range(5, 17):
        a[0, x] = c('#')                                  # flache Oberkante
    for y in range(1, 4):                                 # Kopfseiten oben (x4/x17)
        a[y, 4] = c('#')
        a[y, 17] = c('#')
    for y in range(4, 9):                                 # Kopfseiten unten (x3/x18)
        a[y, 3] = c('#')
        a[y, 18] = c('#')
    rows = {1: (5, 17), 2: (5, 17), 3: (5, 17), 4: (4, 18), 5: (4, 18)}
    for y, (x0, x1) in rows.items():
        for x in range(x0, x1):
            a[y, x] = c('a')
    for x in range(5, 17):                                # oberste Haarreihe etwas heller
        a[1, x] = c('b')
    for (x, y), ch in {(5, 1): 'd', (6, 1): 'c', (7, 1): 'c', (5, 2): 'c', (6, 2): 'b', (9, 2): 'b', (12, 1): 'c',
                       (13, 1): 'c', (15, 2): 'b', (6, 4): 'b', (7, 4): 'b', (14, 4): 'b', (9, 3): 'b', (11, 5): 'b',
                       (16, 4): 'b', (5, 5): 'b', (13, 3): 'b', (8, 5): 'b', (10, 4): 'b', (4, 4): 'c', (4, 5): 'b'}.items():
        a[y, x] = c(ch)
    # Seitenhaar bis zur Stirn und Koteletten (Zeilen 6-8), dazwischen die Stirn (x7-14)
    for y in (6, 7, 8):
        for x in (4, 5, 16, 17):
            a[y, x] = c('a')
        a[y, 6] = c('#')
        a[y, 15] = c('#')
    a[6, 4], a[6, 17] = c('b'), c('b')
    for x in range(6, 16):                                # Haaransatz Zeile 6: Stirnfransen
        a[6, x] = c('a') if x in (6, 8, 11, 13, 15) else c('G')
    a[6, 6], a[6, 15] = c('#'), c('#')


def head_face(a, base):
    """Gesicht: Farben der Vorlage -> grüne Haut, Augen, Brauen, Narbe, Mund."""
    skin = {'f8bc77': 'h', 'ffe9d8': 'G', 'f5ce88': 'g', 'e6ad68': 'h', 'ce9b4f': 'i'}
    for y in range(9, 14):
        for x in range(4, 18):
            p = base[y, x]
            if not p[3]:
                continue
            k = hexc(p)
            if k in skin:
                a[y, x] = c(skin[k])
            elif k == '311800':
                a[y, x] = c('a')                           # Koteletten
            elif k in ('000200', '110203', '000000'):
                a[y, x] = c('#')
            elif lum(p) > 200:                             # Brillengläser -> Haut/Augen (unten gesetzt)
                a[y, x] = c('g')
            else:
                a[y, x] = c('b')
    # Stirn: Zeile 7 mit Narbe (helle Naht mit dunklen Stichen), Zeile 8 Schatten über den Brauen
    for x in range(7, 15):
        a[7, x] = c('G')
        a[8, x] = c('g')
    for x in range(8, 14):
        a[7, x] = c('S')
    for x in (8, 10, 12):
        a[6, x] = a[6, x] if tuple(a[6, x][:3]) == c('a')[:3] else c('g')
        a[8, x] = c('m')                                   # Stiche unter der Naht
    a[7, 7], a[7, 14] = c('g'), c('g')
    # Brauenwulst und tief liegende Augen (Zeilen 9-10)
    for x in (8, 9, 12, 13):
        a[9, x] = c('i')
    for x in (10, 11):
        a[9, x] = c('h')
    a[9, 7] = c('i')
    a[9, 14] = c('i')
    a[10, 8], a[10, 9] = c('e'), c('k')
    a[10, 12], a[10, 13] = c('e'), c('k')
    a[10, 7] = c('h')
    a[10, 14] = c('h')
    for x in (10, 11):
        a[10, x] = c('g')
    a[11, 7] = c('h')
    a[11, 14] = c('h')
    # Mund: schmale gerade Linie
    for x in (9, 10, 11, 12):
        a[12, x] = c('m')
    a[13, 10] = c('h')
    a[13, 11] = c('h')


def neck_bolts(a):
    """Zwei Metallbolzen links/rechts am Hals (Zeilen 13-14)."""
    for (x, y), ch in {(5, 13): '#', (6, 13): 'W', (7, 13): 'M', (5, 14): '#', (6, 14): 'M', (7, 14): 'N',
                       (14, 13): 'M', (15, 13): 'W', (16, 13): '#', (14, 14): 'N', (15, 14): 'M', (16, 14): '#'}.items():
        a[y, x] = c(ch)


def body(a, base):
    """Kittel -> Sakko, Hände -> grün, Hose, Stiefel."""
    for y in range(14, 26):
        for x in range(22):
            p = base[y, x]
            if not p[3]:
                continue
            k = hexc(p)
            if k in ('000000', '000200', '110203'):
                a[y, x] = c('#')
                continue
            if k in ('f8bc77', 'ce9b4f', 'e6ad68', 'ffe9d8', 'f5ce88'):    # Hände
                a[y, x] = c({'f8bc77': 'g', 'ce9b4f': 'h', 'e6ad68': 'h', 'ffe9d8': 'G', 'f5ce88': 'g'}[k])
                continue
            if y >= 23 and k in ('7a2a11', 'a64829', 'b0562d', 'f2ffff'):  # Stiefel
                a[y, x] = c({'7a2a11': '0', 'a64829': '1', 'b0562d': '2', 'f2ffff': '3'}[k])
                continue
            L = lum(p)
            if 15 <= y <= 21 and x in (10, 11):                            # Strickpulli zwischen den Revers
                a[y, x] = c('T' if (x + y) % 2 else 't')
            elif y >= 20 and 8 <= x <= 13:                                 # Hose
                a[y, x] = c('P' if L > 70 else 'p')
            else:                                                          # Sakko
                ch = 'K' if L >= 225 else 'J' if L >= 190 else 'j' if L >= 150 else 'L' if L >= 95 else 'l'
                if ch in 'Jj' and (x + y) % 2 == 0 and 0 < x < 21:   # Tweed: feines Schachbrett
                    ch = {'J': 'j', 'j': 'L'}[ch]
                a[y, x] = c(ch)


def build():
    base = np.array(Image.open(BASE).convert('RGBA')).astype(int)
    a = np.zeros_like(base)
    hair(a)
    head_face(a, base)
    body(a, base)
    neck_bolts(a)
    # Hals (Zeile 14) grün
    for x in (9, 10, 11, 12):
        if a[14, x, 3]:
            a[14, x] = c('h')
    return a


if __name__ == '__main__':
    a = build()
    Image.fromarray(a.astype(np.uint8)).save(OUT)
    base = Image.open(BASE).convert('RGBA')
    im = Image.fromarray(a.astype(np.uint8))
    S = 20
    o = Image.new('RGBA', ((base.width + im.width) * S + 16, base.height * S), (110, 110, 110, 255))
    x = 0
    for i in (base, im):
        b = Image.new('RGBA', i.size, (110, 110, 110, 255))
        b.alpha_composite(i)
        o.paste(b.resize((i.width * S, i.height * S), Image.NEAREST), (x, 0))
        x += i.width * S + 16
    o.save(os.environ.get('PREVIEW', '/tmp/stein_preview.png'))
