# -*- coding: utf-8 -*-
"""Skin Captain-Commander Damus aus Motive.xcf zusammensetzen.

Aufruf:  python3 assemble_damus_skin.py <Motive.xcf>   (aus scripts/hero-animations)
Schreibt src/captain-commander-damus.png und die Teile deckungsgleich als src/captain-commander-damus-<teil>.png.

  body    „Damos Skin“     (Damus im Kapitänsmantel mit erhobenem Schwert)
  flames  „Damos Skin #1“  (die Flammen auf Haar und Schwert; liegen im Motiv über dem Körper)
Die alte, ausgeblendete Ebene „Damos“ ist der Hero selbst und wird nicht gebraucht.
"""
import sys
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument
from xcf_scan import patch_gimpformats

SLUG = 'captain-commander-damus'
BOX = (154, 166, 174, 196)


def main(path):
    patch_gimpformats()
    D = GimpDocument(path)
    layers = {l.name: l for l in D.raw_layers}
    comp = Image.new('RGBA', (BOX[2] - BOX[0], BOX[3] - BOX[1]))
    for part, name in (('body', 'Damos Skin'), ('flames', 'Damos Skin #1')):
        l = layers[name]
        c = Image.new('RGBA', (D.width, D.height))
        c.paste(l.image.convert('RGBA'), (l.xOffset, l.yOffset))
        im = c.crop(BOX)
        im.save(f'src/{SLUG}-{part}.png')
        comp.alpha_composite(im)
    comp.save(f'src/{SLUG}.png')
    print(SLUG, comp.size)


if __name__ == '__main__':
    main(sys.argv[1])
