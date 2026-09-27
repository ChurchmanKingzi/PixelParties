# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveArcanum.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_arcanum.py <pfad/zu/MotiveArcanum.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  alice-the-transfer-student          Transfer Alice
  lord-mithuru-the-rotten-mastermind  Mithuru + Glas (Ebene #29) + Wein (Ebene #30)
  thalia-the-fun-fairy                Thalia + Maske (Thalia #1)
  null-the-mage-slayer                Null-Kopie + rote Kerne (Null #1) + Kanonenarm
                                      (Null #2) + lila Klinge (aus Null #3, nur das
                                      Stück an seinem Arm) + Partikel (Null #5)
  maho-the-cute-magical-girl          rechte Figur aus Ebene #49, gespiegelt
  atta-speaker-of-desires             Atta (für eine künftige Hero-Karte)
  dark-maho                           Skin Dark Maho: linke Figur aus Ebene #72
                                      (nicht gespiegelt – so zeigt sie die Karte)
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


def only(a, keep):
    return np.where(keep[:, :, None], a, 0).astype(np.uint8)


def components(a):
    return cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)


def save_parts(slug, parts, mirror=False):
    """parts: [(teil, Leinwand-RGBA)] von unten nach oben."""
    comp = Image.new('RGBA', (parts[0][1].shape[1], parts[0][1].shape[0]), (0, 0, 0, 0))
    for _, a in parts:
        comp.alpha_composite(Image.fromarray(a))
    bb = comp.getbbox()
    fix = (lambda im: im.transpose(Image.FLIP_LEFT_RIGHT)) if mirror else (lambda im: im)
    if len(parts) > 1:
        for name, a in parts:
            fix(Image.fromarray(a).crop(bb)).save(f'{OUT}/{slug}-{name}.png')
    img = fix(comp.crop(bb))
    img.save(f'{OUT}/{slug}.png')
    print(slug, img.size)


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    save_parts('alice-the-transfer-student', [('body', layer(doc, L, 'Transfer Alice'))])
    glass = layer(doc, L, 'Ebene #29')
    wine = layer(doc, L, 'Ebene #30')
    g = Image.fromarray(glass); g.alpha_composite(Image.fromarray(wine))
    save_parts('lord-mithuru-the-rotten-mastermind', [('body', layer(doc, L, 'Mithuru')), ('glass', np.array(g))])
    save_parts('thalia-the-fun-fairy', [('body', layer(doc, L, 'Thalia')), ('mask', layer(doc, L, 'Thalia #1'))])
    # Null: Klinge = Stück aus „Null #3“, das an seinem Arm liegt
    body = Image.fromarray(layer(doc, L, 'Null-Kopie'))
    for n in ('Null #2', 'Null #1'):
        body.alpha_composite(Image.fromarray(layer(doc, L, n)))
    body = np.array(body)
    by, bx = np.nonzero(body[:, :, 3])
    n3 = layer(doc, L, 'Null #3')
    n, lab = components(n3)
    keep = np.zeros(n3.shape[:2], bool)
    for k in range(1, n):
        ys, xs = np.nonzero(lab == k)
        if xs.max() >= bx.min() - 6 and by.min() <= ys.mean() <= by.max():
            keep |= lab == k
    save_parts('null-the-mage-slayer', [('particles', layer(doc, L, 'Null #5')), ('blade', only(n3, keep)),
                                        ('body', body)])
    # Maho: rechte Figur aus „Ebene #49“, gespiegelt
    m = layer(doc, L, 'Ebene #49')
    n, lab = components(m)
    xs_all = np.nonzero(m[:, :, 3])[1]
    mid = (xs_all.min() + xs_all.max()) / 2
    keep = np.zeros(m.shape[:2], bool)
    for k in range(1, n):
        if np.nonzero(lab == k)[1].mean() > mid:
            keep |= lab == k
    save_parts('maho-the-cute-magical-girl', [('body', only(m, keep))], mirror=True)
    save_parts('atta-speaker-of-desires', [('body', layer(doc, L, 'Atta'))])
    # Skin Dark Maho: linke Figur aus „Ebene #72“
    m = layer(doc, L, 'Ebene #72')
    n, lab = components(m)
    xs_all = np.nonzero(m[:, :, 3])[1]
    mid = (xs_all.min() + xs_all.max()) / 2
    keep = np.zeros(m.shape[:2], bool)
    for k in range(1, n):
        if np.nonzero(lab == k)[1].mean() < mid:
            keep |= lab == k
    save_parts('dark-maho', [('body', only(m, keep))])


if __name__ == '__main__':
    main(sys.argv[1])
