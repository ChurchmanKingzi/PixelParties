# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveBritain.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_britain.py <pfad/zu/MotiveBritain.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  carris-the-time-keeper          Carris + Taschenuhr (Ebene #24)
  little-carris                   Skin: Little Carris
  willy-the-valiant-leprechaun    Figur aus „Willy“ (ohne Regenbogen und Geldsäcke)
  george-the-mad-tyrant-king      George (Hero-Karte noch ohne Bild)
  hatmaker-george                 Skin: George Skin
  victorica-the-eternal-empress   Victorica
  empress-of-hearts-victorica     Skin: Victorica Skin
  alice-the-puppeteer-girl        Alice mit Puppenfäden aus „Alice #6“ (richtiges
                                  Gesicht) + die drei Puppen (Mr Jiggles) aus
                                  „Mr Jiggles“ als eigene Teile; der einzelne rote
                                  Pixel über ihrem Kopf entfällt
  jack-the-crooked-killer         Jack + langes Messer (Ebene #80) in der linken
                                  Hand, gespiegelt ein zweites in der rechten
                                  (Hero-Karte noch ohne Bild)
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
    save_parts('carris-the-time-keeper', [('body', layer(doc, L, 'Carris')), ('watch', layer(doc, L, 'Ebene #24'))])
    save_parts('little-carris', [('body', layer(doc, L, 'Little Carris'))])
    w = layer(doc, L, 'Willy')                            # Figur in der Mitte (ohne Regenbogen/Säcke)
    n, lab = components(w)
    xs_all = np.nonzero(w[:, :, 3])[1]
    mid = (xs_all.min() + xs_all.max()) / 2
    small = [k for k in range(1, n) if (lab == k).sum() > 50 and np.ptp(np.nonzero(lab == k)[1]) < 30]
    k = min(small, key=lambda k: abs(np.nonzero(lab == k)[1].mean() - mid))   # nicht der Regenbogen
    save_parts('willy-the-valiant-leprechaun', [('body', only(w, lab == k))])
    save_parts('george-the-mad-tyrant-king', [('body', layer(doc, L, 'George'))])
    save_parts('hatmaker-george', [('body', layer(doc, L, 'George Skin'))])
    save_parts('victorica-the-eternal-empress', [('body', layer(doc, L, 'Victorica'))])
    save_parts('empress-of-hearts-victorica', [('body', layer(doc, L, 'Victorica Skin'))])
    # Alice: Figur aus „Alice #6“ (richtiges Gesicht), Puppen aus „Mr Jiggles“ (dort 24 px
    # weiter rechts, 3 px höher gezeichnet)
    a6 = biggest(layer(doc, L, 'Alice #6'))
    al = a6[:, :, 3] > 0                                  # roter Einzelpixel über dem Kopf
    nb = np.zeros_like(al)
    nb[1:] |= al[:-1]; nb[:-1] |= al[1:]; nb[:, 1:] |= al[:, :-1]; nb[:, :-1] |= al[:, 1:]
    a6[al & ~nb] = 0
    jig = biggest(layer(doc, L, 'Mr Jiggles'))
    jig = np.roll(np.roll(jig, -24, axis=1), 3, axis=0)
    puppets = only(jig, (jig[:, :, 3] > 0) & (a6[:, :, 3] == 0))
    n, lab = components(puppets)                          # nur die drei Puppen (keine Fadenreste)
    keep = np.zeros(lab.shape, bool)
    for k in range(1, n):
        if (lab == k).sum() >= 20:
            keep |= lab == k
    puppets = only(puppets, keep)
    save_parts('alice-the-puppeteer-girl', [('puppets', puppets), ('body', a6)])
    knife = layer(doc, L, 'Ebene #80')
    jack = layer(doc, L, 'Jack')
    xs = np.nonzero(jack[:, :, 3])[1]
    cx2 = xs.min() + xs.max()                             # Spiegelachse = Körpermitte
    knife_r = np.zeros_like(knife)
    ys, xk = np.nonzero(knife[:, :, 3])
    knife_r[ys, cx2 - xk] = knife[ys, xk]
    save_parts('jack-the-crooked-killer', [('body', jack), ('knife_l', knife), ('knife_r', knife_r)])


if __name__ == '__main__':
    main(sys.argv[1])
