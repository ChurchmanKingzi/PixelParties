# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveDeri.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_deri.py <pfad/zu/MotiveDeri.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  the-shapeshifter                  ???, the Shapeshifter: die Tentakel-Figur aus
                                    „??? #1“ + linker Arm „??? #7“
  the-throne-robber                 ???, the Throne Robber: die gekrönte Figur mit
                                    Hellebarde aus „Ascended ???“ auf dem „Thron“
  bow-sniper-darge                  „Darge“ + Bogen (das mittlere Stück aus
                                    „Darge #1“), ohne Pfeile
  jean-the-pillaging-knight         „Jean“ mit seinen Geldsäcken
  layn-defender-of-deri             die Figur aus „Layn“ + Hände „Layn #1“ + ein
                                    schmales Stück Zinnen („Layn“/„Zinnen“, 2 px
                                    breiter als sie)
  layn-summonr-of-weapons           Skin („Layn Summonr of Weapons“ in skins.json):
                                    „Ebene #62“
  layn-master-of-deri-s-relic       „Ascended Layn“ (ohne Aura)
  tharx-the-never-losing-general    „Tharx“ (stehend)
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


def near(a, x, y):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt."""
    n, lab = components(a)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    k = lab[ys[d.argmin()], xs[d.argmin()]]
    return only(a, lab == k)


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('the-shapeshifter', [('arm', g('??? #7')), ('body', near(g('??? #1'), 470, 400))])
    save_parts('the-throne-robber', [('throne', g('Thron')), ('body', near(g('Ascended ???'), 260, 210))])
    save_parts('bow-sniper-darge', [('bow', near(g('Darge #1'), 246, 290)), ('body', g('Darge'))])
    save_parts('jean-the-pillaging-knight', [('body', g('Jean'))])
    fig = near(g('Layn'), 237, 285)
    ys, xs = np.nonzero(fig[:, :, 3])
    x0, x1 = xs.min() - 2, xs.max() + 2
    wall = g('Layn').copy()
    wall[fig[:, :, 3] > 0] = 0
    zin = g('Zinnen').copy()
    for a in (wall, zin):
        a[:, :x0] = 0
        a[:, x1 + 1:] = 0
        a[:296] = 0
    save_parts('layn-defender-of-deri', [('hands', g('Layn #1')), ('body', fig), ('wall', wall), ('zinnen', zin)])
    save_parts('layn-summonr-of-weapons', [('body', g('Ebene #62'))])
    save_parts('layn-master-of-deri-s-relic', [('body', g('Ascended Layn'))])
    save_parts('tharx-the-never-losing-general', [('body', g('Tharx'))])


if __name__ == '__main__':
    main(sys.argv[1])
