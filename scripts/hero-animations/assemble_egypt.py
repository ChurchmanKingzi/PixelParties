# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveEgypt.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_egypt.py <pfad/zu/MotiveEgypt.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  thep-the-court-scribe             Thep
  lethe-the-forgetful-fixer         Lethe + Haar (Ebene #117) + Sense (Ebene #116)
  reaping-lethe                     Skin: Lethe-Kopie + Haar (Ebene #117) + Sense
  pharaoh-the-lone-living-being     Pharaoh
  gamer-champion-pharaoh            Skin: Yugi
  bakhm-the-desert-digger           Bakhm #4 + Bakhm #1
  world-eater-bakhm                 Skin: Ebene #82
  serket-dread-of-the-desert        Serket (Hero-Karte noch ohne Bild)
  extraterrestrial-serket           Skin: Serket-Kopie
"""
import sys
import numpy as np
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


def merged(doc, L, names):
    """Ebenen übereinanderlegen; names von unten nach oben."""
    c = Image.fromarray(layer(doc, L, names[0]))
    for n in names[1:]:
        c.alpha_composite(Image.fromarray(layer(doc, L, n)))
    return np.array(c)


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
    save_parts('thep-the-court-scribe', [('body', layer(doc, L, 'Thep'))])
    scythe = layer(doc, L, 'Ebene #116')
    hair = layer(doc, L, 'Ebene #117')
    save_parts('lethe-the-forgetful-fixer', [('scythe', scythe), ('hair', hair), ('body', layer(doc, L, 'Lethe'))])
    save_parts('reaping-lethe', [('scythe', scythe), ('hair', hair), ('body', layer(doc, L, 'Lethe-Kopie'))])
    save_parts('pharaoh-the-lone-living-being', [('body', layer(doc, L, 'Pharaoh'))])
    save_parts('gamer-champion-pharaoh', [('body', layer(doc, L, 'Yugi'))])
    save_parts('bakhm-the-desert-digger', [('body', merged(doc, L, ['Bakhm #1', 'Bakhm #4']))])
    save_parts('world-eater-bakhm', [('body', layer(doc, L, 'Ebene #82'))])
    save_parts('serket-dread-of-the-desert', [('body', layer(doc, L, 'Serket'))])
    save_parts('extraterrestrial-serket', [('body', layer(doc, L, 'Serket-Kopie'))])


if __name__ == '__main__':
    main(sys.argv[1])
