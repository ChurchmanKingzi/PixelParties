# -*- coding: utf-8 -*-
"""Natas, the Master of Hell aus Motive.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_natas.py <Motive.xcf>   (aus scripts/hero-animations)
Schreibt src/natas-the-master-of-hell.png und die Teile deckungsgleich als src/natas-the-master-of-hell-<teil>.png.

Im Motiv steht Natas vor einem Höllentor („Natas #4“), flankiert von zwei gehörnten Schattendämonen (in „Natas“
und „Natas #5“ mit enthalten). Für den Helden zählt nur der Ausschnitt um ihn selbst (x 276–293, y 58–81):
  body   „Natas“     (Anzug mit blauer Krawatte)
  arms   „Natas #1“  (links die Hand vor dem Bauch, rechts der ausgestreckte Arm)
  head   „Natas #2“  (Kopf mit Haartolle, rotem Auge und Monokel)
  glint  „Natas #3“  (Glanzkreuz auf dem Monokel – wird nur als Funkeln gezeigt)
  aura   „Natas #5“  (roter Höllenschatten; im xcf zu 10 % deckend, hier voll deckend abgelegt –
                      die Deckkraft setzt natas.py)
"""
import sys
import numpy as np
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument
from xcf_scan import patch_gimpformats

SLUG = 'natas-the-master-of-hell'
BOX = (276, 58, 294, 82)
PARTS = [('body', 'Natas'), ('arms', 'Natas #1'), ('head', 'Natas #2'), ('glint', 'Natas #3'), ('aura', 'Natas #5')]


def main(path):
    patch_gimpformats()
    D = GimpDocument(path)
    layers = {l.name: l for l in D.raw_layers}
    comp = Image.new('RGBA', (BOX[2] - BOX[0], BOX[3] - BOX[1]))
    for part, name in PARTS:
        l = layers[name]
        c = Image.new('RGBA', (D.width, D.height))
        c.paste(l.image.convert('RGBA'), (l.xOffset, l.yOffset))   # Ebenen-Deckkraft bewusst nicht übernommen
        im = c.crop(BOX)
        im.save(f'src/{SLUG}-{part}.png')
        if part in ('body', 'arms', 'head'):
            comp.alpha_composite(im)
    comp.save(f'src/{SLUG}.png')
    print(SLUG, comp.size)


if __name__ == '__main__':
    main(sys.argv[1])
