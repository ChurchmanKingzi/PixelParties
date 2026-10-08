# -*- coding: utf-8 -*-
"""Skin-Sprite „Contract-bound Orthos“ (Kyubey aus Madoka Magica) für Orthos, the Loyal Guard Dog.

Gleiche Leinwand (18x24) und gleiche Flammenform wie src/orthos-the-loyal-guard-dog.png: zwei weiße
Kyubey-Köpfe mit Katzenohren (innen rosa), großen roten Augen, goldenen Reifen und Kyubeys rotem Kreis
am Körper. Die Flammen auf den Köpfen brennen in höllischem Rot (kein Orange); die Flammen RUNDHERUM
auf dem Spielfeld gehören nicht zur Figur.
Erzeugt src/contract-bound-orthos.png.   Aufruf (aus scripts/hero-animations):  python3 contract_orthos_sprite.py
"""
import numpy as np
from PIL import Image
from anim_common import rgb

PAL = {
    'O': '0e0e0e',                                   # Kontur
    'W': 'f6f8f8', 'w': 'd9e4e5', 'v': 'aebfc3',     # Fell: weiß, helles und mittleres Graugrün (Schatten)
    'P': 'f0a0ac',                                   # Ohr innen rosa
    'E': 'd0103c', 'e': 'ff7088',                    # Augen: tiefes Rot, Glanzlicht
    'Y': 'e8b830', 'y': 'a87818',                    # goldener Reif
    'M': 'b01030',                                   # roter Kreis (Kyubeys Zeichen)
    'd': '5a0000', 'R': 'a00000', 'F': 'd80808', 'f': 'ff2828',   # Flammen, höllisches Rot
}
FLAME_CHARS = 'dRFf'
L9 = [   # linker Kopf samt Flamme und Ohren (x0-8), Zeilen 0-16; der rechte ist gespiegelt
    '....d....',
    '....d....',
    '...dRd...',
    '...dRd...',
    '..dRFRd..',
    '..dRFRd..',
    '..dFfFd..',
    '.OdFfFdO.',
    'OPOFfFOPO',
    'OPOFfFOPO',
    'OWOOOOOWO',
    'OWWWWWWWO',
    'yWeWWWeWO',
    'YWEWWWEWO',
    'ywWWOWWwO',
    '.OvwwwvO.',
    '..OOwwwOO',
]
ROWS_BODY = [
    '....OOwWWWWwOO....',
    '....OWWWWWWWWO....',
    '.....OwWMMWwO.....',
    '.....OwMWWMwO.....',
    '.....OvWMMWvO.....',
    '.....OvvWWvvO.....',
    '.....OOO..OOO.....',
]


def mirror(r):
    return r[::-1]


def build():
    rows = []
    for r in L9:
        rows.append(r + mirror(r))
    rows += ROWS_BODY
    # rechter Kopf: gespiegelt; der Reif sitzt außen
    assert len(rows) == 24 and all(len(r) == 18 for r in rows), [len(r) for r in rows]
    a = np.zeros((24, 18, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                a[y, x] = rgb(PAL[ch])
    return a


if __name__ == '__main__':
    a = build()
    Image.fromarray(a).save('src/contract-bound-orthos.png')
    im = Image.fromarray(a)
    bg = Image.new('RGBA', im.size, (110, 110, 110, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 14, im.height * 14), Image.NEAREST).save('/tmp/claude-0/-home-user-PixelParties/04e3aa12-4e29-5cc1-93c8-60d55541b155/scratchpad/orthos_new.png')
    print('ok')
