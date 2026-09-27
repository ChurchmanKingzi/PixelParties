# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveMoe.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_moe.py <pfad/zu/MotiveMoe.xcf>
Schreibt src/<slug>.png (auf die Figur zugeschnitten).

Zuordnung (Ebenen-Index bzw. Name in MotiveMoe.xcf):
  cute-starlet-megu              Megu + Megu #1 (winkender Arm) + Megu #2 (Flügel)
  cute-nerd-magenta              Magenta + Magenta #2 (Fledermausflügel)
  cute-annoyance-mini            Mini #2 + Mini (acht Flügel)
  cute-ditz-monami               rechte Figur aus „Monami“ + das Flügelpaar aus
                                 „Monami #1“, das hinter ihr liegt
  molinda-the-cutest-being-in-the-sky   Figur aus „Ascended Molinda-Kopie“
  mirjam-the-fallen-cute-angel   Mirjam
  vena-the-bounty-huntress       Vena + Ebene #59 (abgefeuerte Raketenfaust)
  tarleinn-the-traveler          Tarleinn (nur die Figur, ohne Noten/Herzen)
  jenny-the-class-fairy          Jenny new
  fairy-queen-crestina-the-creation-fairy   CRESTINA
  cool-rescuer-monia             Monia, altes Düsenfeuer ersetzt durch Monia #2
  true-fairy-crestina-the-primordial-goddess
                                 Figur aus „Ascended Crestina“; die acht
                                 übertriebenen Strahlen-„Flügel“ werden durch
                                 neu gepixelte Flügel ersetzt (crestina_wings.py)
"""
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument

OUT = 'src'


def canvas_of(doc, layer):
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    im = layer.image
    if im is not None:
        c.paste(im.convert('RGBA'), (layer.xOffset, layer.yOffset))
    return c


def compose(doc, layers, keys):
    """keys: Ebenennamen; höherer Stapelindex liegt weiter unten."""
    idx = []
    for k in keys:
        hits = [i for i, l in enumerate(layers) if l.name == k]
        assert len(hits) == 1, (k, hits)
        idx.append(hits[0])
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    for i in sorted(idx, reverse=True):
        c.alpha_composite(canvas_of(doc, layers[i]))
    return c


def components(a):
    n, lab = cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    return n, lab


def layer(doc, layers, name):
    return np.array(compose(doc, layers, [name]))


def save_parts(slug, parts):
    """parts: [(teilname, Leinwand-RGBA)] von unten nach oben. Speichert das
    Gesamtbild und jedes Teil deckungsgleich zugeschnitten als <slug>-<teil>.png."""
    comp = Image.new('RGBA', Image.fromarray(parts[0][1]).size, (0, 0, 0, 0))
    for _, a in parts:
        comp.alpha_composite(Image.fromarray(a))
    bb = comp.getbbox()
    for name, a in parts:
        Image.fromarray(a).crop(bb).save(f'{OUT}/{slug}-{name}.png')
    save(comp, slug)


def save(img, slug):
    img = img.crop(img.getbbox())
    img.save(f'{OUT}/{slug}.png')
    print(slug, img.size)


# ---------------------------------------------------------------- True Crestina
def crestina_figure(doc, layers):
    """Figur aus „Ascended Crestina“ ohne die Strahlen (deren Palette wird entfernt)."""
    src = np.array(compose(doc, layers, ['Ascended Crestina']))
    ys, xs = np.nonzero(src[:, :, 3])
    cy, cx = (ys.min() + ys.max()) // 2, (xs.min() + xs.max()) // 2
    yy, xx = np.mgrid[0:src.shape[0], 0:src.shape[1]]
    far = (np.hypot(yy - cy, xx - cx) > 20) & (src[:, :, 3] > 0)
    ray = {tuple(c) for c in src[far]}
    box = src[cy - 10:cy + 17, cx - 9:cx + 9].copy()
    keep = np.array([[tuple(p) not in ray for p in row] for row in box]) & (box[:, :, 3] > 0)
    n, lab = cv2.connectedComponents(keep.astype(np.uint8), connectivity=8)
    big = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    fig = np.where((lab == big)[:, :, None], box, 0).astype(np.uint8)
    fy, fx = np.nonzero(fig[:, :, 3])
    return Image.fromarray(fig[fy.min():fy.max() + 1, fx.min():fx.max() + 1])


def main(path):
    doc = GimpDocument(path)
    layers = doc.raw_layers
    save_parts('cute-starlet-megu', [('wings', layer(doc, layers, 'Megu #2')),
                                     ('body', layer(doc, layers, 'Megu')),
                                     ('arm', layer(doc, layers, 'Megu #1'))])
    save_parts('cute-nerd-magenta', [('wings', layer(doc, layers, 'Magenta #2')),
                                     ('body', layer(doc, layers, 'Magenta'))])
    save_parts('cute-annoyance-mini', [('wings', layer(doc, layers, 'Mini')),
                                       ('body', layer(doc, layers, 'Mini #2'))])
    # Monami: rechte Figur + Flügelpaar dahinter
    fig = layer(doc, layers, 'Monami')
    n, lab = components(fig)
    ys, xs = np.nonzero(fig[:, :, 3]); mid = (xs.min() + xs.max()) / 2
    keep = np.zeros(fig.shape[:2], bool)
    for k in range(1, n):
        if np.nonzero(lab == k)[1].mean() > mid:
            keep |= lab == k
    fig = np.where(keep[:, :, None], fig, 0).astype(np.uint8)
    fy, fx = np.nonzero(fig[:, :, 3])
    wings = layer(doc, layers, 'Monami #1')
    n, lab = components(wings)
    wkeep = np.zeros(wings.shape[:2], bool)
    for k in range(1, n):
        wy, wx = np.nonzero(lab == k)
        if wx.min() <= fx.max() + 25 and wx.max() >= fx.min() - 25 and wy.min() <= fy.max() and wy.max() >= fy.min() - 25:
            wkeep |= lab == k
    # verirrter gelber Pixel am Fragezeichen entfernen
    qy, qx = np.nonzero(fig[:, :, 3])
    for y, x in zip(qy, qx):
        r, g, b = (int(v) for v in fig[y, x, :3])
        if r > 200 and g > 150 and b < 100 and y < fy.min() + 25:
            fig[y, x] = 0
    save_parts('cute-ditz-monami', [('wings', np.where(wkeep[:, :, None], wings, 0).astype(np.uint8)),
                                    ('body', fig)])
    # Ascended Molinda: die richtige Figur liegt in „Ascended Molinda-Kopie“
    # (neben einem großen Herz in derselben Ebene -> kleinere Komponente)
    mol = layer(doc, layers, 'Ascended Molinda-Kopie')
    n, lab = components(mol)
    sizes = [(lab == k).sum() for k in range(1, n)]
    big = [k + 1 for k, v in enumerate(sizes) if v > 100]
    fig_k = min(big, key=lambda k: sizes[k - 1])
    save(Image.fromarray(np.where((lab == fig_k)[:, :, None], mol, 0).astype(np.uint8)),
         'molinda-the-cutest-being-in-the-sky')
    save(compose(doc, layers, ['Mirjam']), 'mirjam-the-fallen-cute-angel')
    save_parts('vena-the-bounty-huntress', [('body', layer(doc, layers, 'Vena')),
                                            ('fist', layer(doc, layers, 'Ebene #59'))])
    t = np.array(compose(doc, layers, ['Tarleinn']))
    n, lab = components(t)
    big = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    save(Image.fromarray(np.where((lab == big)[:, :, None], t, 0).astype(np.uint8)), 'tarleinn-the-traveler')
    save(compose(doc, layers, ['Jenny new']), 'jenny-the-class-fairy')
    save(compose(doc, layers, ['CRESTINA']), 'fairy-queen-crestina-the-creation-fairy')
    # Monia: altes Düsenfeuer (orange Kegel unter den Düsen) raus, Monia #2 rein
    mo = np.array(compose(doc, layers, ['Monia']))
    fire = np.array(compose(doc, layers, ['Monia #2']))
    fy_min = np.nonzero(fire[:, :, 3])[0].min()
    r, g, b = mo[:, :, 0].astype(int), mo[:, :, 1].astype(int), mo[:, :, 2].astype(int)
    old = (mo[:, :, 3] > 0) & (r > 120) & (r > g + 30) & (b < 90)
    old[:fy_min] = False
    mo[old] = 0
    save_parts('cool-rescuer-monia', [('body', mo), ('flames', fire)])
    fig = crestina_figure(doc, layers)
    fig.save(f'{OUT}/true-fairy-crestina-the-primordial-goddess-figure.png')
    # die acht übertriebenen Strahlen werden durch neu gezeichnete Flügel ersetzt
    from crestina_wings import compose_true_crestina
    save(Image.fromarray(compose_true_crestina(np.array(fig))), 'true-fairy-crestina-the-primordial-goddess')


if __name__ == '__main__':
    main(sys.argv[1])
