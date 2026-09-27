# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveChina.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_china.py <pfad/zu/MotiveChina.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  junshi-the-tactical-genius      Junshi (ohne den Zeigestock „Junshi #2“)
  xiong-the-bamboo-guardian       Xiong mit Bambusstab
  zhigao-the-heavenly-emperor     Zhigao („Zhigao #2“) auf seinem Thron
                                  („Palace“); sein Schatten (25 % Schwarz)
                                  fällt auf den Thron

Nicht verwendet: die Varianten für Zauberkarten („Firework Cannon“,
„Bamboo Statt #1“, „Bamboo Staff“), Zauber/Objekte und Tushu (keine Karte).
"""
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument

OUT = 'src'


def layer(doc, layers, name):
    hits = [l for l in layers if l.name == name]
    assert len(hits) == 1, (name, len(hits))
    l = hits[0]
    im = l.image.convert('RGBA')
    if l.opacity < 255:                                   # Ebenen-Deckkraft übernehmen
        a = np.array(im)
        a[:, :, 3] = (a[:, :, 3].astype(int) * l.opacity // 255).astype(np.uint8)
        im = Image.fromarray(a)
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    c.paste(im, (l.xOffset, l.yOffset))
    return np.array(c)


def components(a):
    return cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)


def only(a, keep):
    return np.where(keep[:, :, None], a, 0).astype(np.uint8)


def biggest(a):
    n, lab = components(a)
    k = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    return only(a, lab == k)


def save_parts(slug, parts):
    """parts: [(teil, Leinwand-RGBA)] von unten nach oben."""
    comp = Image.new('RGBA', (parts[0][1].shape[1], parts[0][1].shape[0]), (0, 0, 0, 0))
    for _, a in parts:
        comp.alpha_composite(Image.fromarray(a))
    bb = comp.getbbox()
    if len(parts) > 1:
        for name, a in parts:
            Image.fromarray(a).crop(bb).save(f'{OUT}/{slug}-{name}.png')
    img = comp.crop(bb)
    img.save(f'{OUT}/{slug}.png')
    print(slug, img.size)


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    save_parts('junshi-the-tactical-genius', [('body', layer(doc, L, 'Junshi'))])
    save_parts('xiong-the-bamboo-guardian', [('body', layer(doc, L, 'Xiong'))])
    save_parts('zhigao-the-heavenly-emperor', [('throne', layer(doc, L, 'Palace')), ('body', layer(doc, L, 'Zhigao #2'))])


if __name__ == '__main__':
    main(sys.argv[1])
