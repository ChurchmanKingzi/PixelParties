# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveSteamDwarfs.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_steamdwarfs.py <pfad/zu/MotiveSteamDwarfs.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  teocuilatl-the-embodiment-of-gods   Teocuilatl (Glitzersterne werden in der
                                      Animation entfernt und neu animiert)
  teocuilatl-the-platinum-star        Skin: Platinum Star
  idej-lord-daiyo                     Geist (Ebene #28) + Schwert (Ebene #22); das
                                      hellgrüne Leuchten (Ebene #23) liegt versetzt
                                      und wird in der Animation neu berechnet
  heragas-the-monster-slayer          Ebene #64 + blutiger Hydrakopf (Ebene #66)
  pseudonia-the-skill-devourer        Pseudonia
  imperfect-pseudonia                 Skin: Pseudonia-Kopie + Schwanzspitze
                                      (Ebene #95) + Schwanzring (rechter Teil
                                      von Ebene #92, liegt vor ihr)
  bloom-the-maniacal-botanist         Bloom-Kopie #1 + Blutblumen (Ebene #37)
  maya-the-nature-fairy               mittlere Figur (weiße Flügel) aus Maya #5
  diamond-the-keeper-of-peace         Diamond

Die Datei enthält alte GIMP-Farbmesspunkte, die gimpformats nicht lesen kann
(siehe xcf_scan.patch_gimpformats).
"""
import sys
import numpy as np
import cv2
from PIL import Image
from xcf_scan import patch_gimpformats

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
    patch_gimpformats()
    from gimpformats.gimpXcfDocument import GimpDocument
    doc = GimpDocument(path)
    L = doc.raw_layers
    save_parts('teocuilatl-the-embodiment-of-gods', [('body', layer(doc, L, 'Teocuilatl'))])
    save_parts('teocuilatl-the-platinum-star', [('body', layer(doc, L, 'Platinum Star'))])
    save_parts('idej-lord-daiyo', [('sword', layer(doc, L, 'Ebene #22')), ('ghost', layer(doc, L, 'Ebene #28'))])
    save_parts('heragas-the-monster-slayer', [('hydra', layer(doc, L, 'Ebene #66')),
                                              ('body', layer(doc, L, 'Ebene #64'))])
    save_parts('pseudonia-the-skill-devourer', [('body', layer(doc, L, 'Pseudonia'))])
    ring = layer(doc, L, 'Ebene #92')                     # rechter Teil: der Schwanzring
    n, lab = components(ring)
    keep = np.zeros(ring.shape[:2], bool)
    for k in range(1, n):
        if 320 < np.nonzero(lab == k)[1].mean() < 370:   # der Ring um sie (x334–358)
            keep |= lab == k
    save_parts('imperfect-pseudonia', [('tip', layer(doc, L, 'Ebene #95')), ('body', layer(doc, L, 'Pseudonia-Kopie')),
                                       ('ring', only(ring, keep))])
    save_parts('bloom-the-maniacal-botanist', [('body', layer(doc, L, 'Bloom-Kopie #1')),
                                               ('roses', layer(doc, L, 'Ebene #37'))])
    maya = layer(doc, L, 'Maya #5')                       # Varianten: die mit weißen Flügeln (rechts)
    n, lab = components(maya)
    big = [k for k in range(1, n) if (lab == k).sum() > 150]
    k = max(big, key=lambda k: np.nonzero(lab == k)[1].mean())
    save_parts('maya-the-nature-fairy', [('body', only(maya, lab == k))])
    save_parts('diamond-the-keeper-of-peace', [('body', layer(doc, L, 'Diamond'))])


if __name__ == '__main__':
    main(sys.argv[1])
