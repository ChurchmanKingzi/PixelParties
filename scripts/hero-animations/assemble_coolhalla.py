# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveCoolhalla.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_coolhalla.py <pfad/zu/MotiveCoolhalla.xcf>
Schreibt src/<slug>.png.

  freshya-beauty-of-coolness          Freshya („Ebene #5“)
  thorad-strength-of-coolness         Thorad („Ebene #197“); Mund und
                                      Zigarettenstiel eine Zeile höher gesetzt,
                                      darunter Bart ergänzt
  cooldin-king-of-coolness            Cooldin in seiner Kartenpose auf dem
                                      Skateboard: gibt es nur in den Szenen –
                                      ausgeschnitten als Unterschied zwischen
                                      „Sichtbar #10“ und der leeren Halle
                                      „Sichtbar“ (Boden zwischen den Beinen
                                      bleibt frei)
  lolki-trickstar-of-coolness         Lolki = der Junge mit Krone („Ebene #31“),
                                      ohne das Skelett
  peter-r-ll-the-protagonist          Peter Röll („Peter Röll“)
  shrunken-prodigy-peter-r-ll         Skin: „Ebene #159“ + Brille „Ebene #133“
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


def bbox(a):
    ys, xs = np.nonzero(a[:, :, 3])
    return xs.min(), ys.min()


def fix_thorad(a):
    """Mund (dunkelrot) und Zigarettenstiel eine Zeile höher, darunter Bart."""
    x0, y0 = bbox(a)
    a = a.copy()
    for x in (10, 11, 12, 13):
        a[y0 + 11, x0 + x] = a[y0 + 12, x0 + x]
    for x, c in ((10, (0x98, 0x27, 0x15)), (11, (0xbc, 0x33, 0x09)), (12, (0x98, 0x27, 0x15)), (13, (0x98, 0x27, 0x15))):
        a[y0 + 12, x0 + x] = (*c, 255)
    return a


def cut_from_scene(scene, empty, box):
    """Figur = was sich in box zwischen Szene und leerer Szene unterscheidet."""
    x0, y0, x1, y1 = box
    out = np.zeros_like(scene)
    d = (scene[y0:y1, x0:x1] != empty[y0:y1, x0:x1]).any(2)
    out[y0:y1, x0:x1][d] = scene[y0:y1, x0:x1][d]
    return out


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    save_parts('freshya-beauty-of-coolness', [('body', layer(doc, L, 'Ebene #5'))])
    save_parts('thorad-strength-of-coolness', [('body', fix_thorad(layer(doc, L, 'Ebene #197')))])
    cooldin = cut_from_scene(layer(doc, L, 'Sichtbar #10'), layer(doc, L, 'Sichtbar'), (236, 192, 266, 234))
    save_parts('cooldin-king-of-coolness', [('body', biggest(cooldin))])
    save_parts('lolki-trickstar-of-coolness', [('body', layer(doc, L, 'Ebene #31'))])
    save_parts('peter-r-ll-the-protagonist', [('body', layer(doc, L, 'Peter Röll'))])
    save_parts('shrunken-prodigy-peter-r-ll', [('body', layer(doc, L, 'Ebene #159')), ('glasses', layer(doc, L, 'Ebene #133'))])


if __name__ == '__main__':
    main(sys.argv[1])
