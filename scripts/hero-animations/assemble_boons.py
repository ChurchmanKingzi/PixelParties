# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveBoons.xcf zusammensetzen (mit dem Nutzer
abgeglichen). Skins (cards/skins) werden unter dem Slug des Skin-Namens
abgelegt.

Aufruf:  python3 assemble_boons.py <pfad/zu/MotiveBoons.xcf>

  nomu-wanderer-of-worlds          Nomu (+ Portal „Nomu #1“ als Teil -portal)
  argos-the-eye-of-the-cosmos      Argos (Auge, Pupille schwarz gefüllt); der
                                   Schattenkörper ist neu gezeichnet (argos.py)
  the-eye-of-argos        (Skin)   Sauron
  kerthwack-the-reality-breaker    KerThwack
  w-d-kerthwack           (Skin)   KerThwack-Kopie
  lizbeth-the-hunter-of-souls (Skin) Ebene #16
  cuberto-supreme-lord-of-edges    Ebene #4  (ohne Erdwürfel)
  extra-edgy-cuberto      (Skin)   Ebene #5  (ohne Erdwürfel)
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
    a = np.array(l.image.convert('RGBA'))
    if l.opacity < 255:
        a[:, :, 3] = (a[:, :, 3].astype(int) * l.opacity // 255).astype(np.uint8)
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    c.paste(Image.fromarray(a), (l.xOffset, l.yOffset))
    return np.array(c)


def save(a, slug):
    im = Image.fromarray(a)
    im = im.crop(im.getbbox())
    im.save(f'{OUT}/{slug}.png')
    print(slug, im.size)


def fill_holes(a, color):
    """Innere Löcher (nicht mit dem Rand verbunden) mit color füllen."""
    inv = (a[:, :, 3] == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(inv, connectivity=4)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    for k in range(1, n):
        if k not in border:
            a[lab == k] = color
    return a


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    save(layer(doc, L, 'Nomu'), 'nomu-wanderer-of-worlds')
    # Portal hinter Nomu (halbtransparent) als eigenes Teil; Lage relativ zu Nomu
    nomu = Image.fromarray(layer(doc, L, 'Nomu')).getbbox()
    portal = Image.fromarray(layer(doc, L, 'Nomu #1'))
    pb = portal.getbbox()
    portal.crop(pb).save(f'{OUT}/nomu-wanderer-of-worlds-portal.png')
    print('Portal-Versatz zu Nomu:', pb[0] - nomu[0], pb[1] - nomu[1], 'Größe', portal.crop(pb).size)
    save(fill_holes(layer(doc, L, 'Argos'), (0, 0, 0, 255)), 'argos-the-eye-of-the-cosmos')
    save(layer(doc, L, 'Sauron'), 'the-eye-of-argos')
    save(layer(doc, L, 'KerThwack'), 'kerthwack-the-reality-breaker')
    save(layer(doc, L, 'KerThwack-Kopie'), 'w-d-kerthwack')
    save(layer(doc, L, 'Ebene #16'), 'lizbeth-the-hunter-of-souls')
    save(layer(doc, L, 'Ebene #4'), 'cuberto-supreme-lord-of-edges')
    save(layer(doc, L, 'Ebene #5'), 'extra-edgy-cuberto')


if __name__ == '__main__':
    main(sys.argv[1])
