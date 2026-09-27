# -*- coding: utf-8 -*-
"""MotiveMoe.xcf, zweiter Durchgang: Skins (cards/skins, Zuordnung in
data/skins.json) und weitere Heroes – mit dem Nutzer abgeglichen.

Aufruf:  python3 assemble_moe_skins.py <pfad/zu/MotiveMoe.xcf>

  delusional-monia          (Skin)  Monia Skin – altes Düsenfeuer ersetzt durch
                                    das detaillierte Feuer aus Monia #2
  lightning-fast-monia      (Skin)  Lightning – ebenso
  cool-birthday-girl-monia          rechte Figur aus „Birthday Monia“ + #2 und das
                                    Feuer aus „Birthday Monia #1“
      (alle drei auf den Ausschnitt von cool-rescuer-monia – nur so weit
       vergrößert wie nötig –, damit die Koordinaten aus monia.py passen;
       der Versatz wird ausgegeben und steht in monia.py; Teile -body/-flames)
  absolute-moron-tempeste   (Skin)  Cirno
  sickly-mary               (Skin)  Mary skin
  sos-crestina              (Skin)  Haruhi
  space-huntress-vena       (Skin)  Ebene #143 + Jetpack (Düsen und Feuer aus
                                    „Vena“) + Flamme der Raketenhand (aus
                                    „Ebene #59“); Teile -body/-jet/-fistflame
  tapu-jenny                (Skin)  nur die Fee (linke 15 Spalten aus „Tapu Koko“;
                                    Fee und Gitarrenspieler berühren sich)
  cute-meanie-melissa               rechte Figur aus „Melissa“ (ohne Herzen) +
                                    Flügel „Melissa #1“ (1 px nach links, damit
                                    sie mittig sitzt); Teile -body/-wings
  cute-angel-molinda                linke Figur aus „Melissa“ (ohne Herzen)
"""
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument

OUT = 'src'


def layer(doc, L, name):
    hits = [l for l in L if l.name == name]
    assert len(hits) == 1, (name, len(hits))
    l = hits[0]
    a = np.array(l.image.convert('RGBA'))
    if l.opacity < 255:
        a[:, :, 3] = (a[:, :, 3].astype(int) * l.opacity // 255).astype(np.uint8)
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    c.paste(Image.fromarray(a), (l.xOffset, l.yOffset))
    return np.array(c)


def comps(a):
    return cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)


def only(a, keep):
    return np.where(keep[:, :, None], a, 0).astype(np.uint8)


def biggest(a, side=None):
    """Größte Komponente (optional nur linke/rechte Bildhälfte des Inhalts)."""
    n, lab = comps(a)
    xs = np.nonzero(a[:, :, 3])[1]
    mid = (xs.min() + xs.max()) / 2
    best, size = None, 0
    for k in range(1, n):
        m = lab == k
        cx = np.nonzero(m)[1].mean()
        if side == 'left' and cx > mid or side == 'right' and cx < mid:
            continue
        if m.sum() > size:
            best, size = m, m.sum()
    return best


def near(a, ref_mask, grow=3):
    """Komponenten von a, die die (vergrößerte) Referenzmaske berühren."""
    k = np.ones((2 * grow + 1, 2 * grow + 1), np.uint8)
    big = cv2.dilate(ref_mask.astype(np.uint8), k) > 0
    n, lab = comps(a)
    keep = np.zeros(a.shape[:2], bool)
    for j in range(1, n):
        if (big & (lab == j)).any():
            keep |= lab == j
    return keep


def composite(parts):
    c = Image.new('RGBA', (parts[0].shape[1], parts[0].shape[0]), (0, 0, 0, 0))
    for p in parts:
        c.alpha_composite(Image.fromarray(p))
    return c


def save_parts(slug, parts, box=None):
    comp = composite([a for _, a in parts])
    bb = box or comp.getbbox()
    for name, a in parts:
        Image.fromarray(a).crop(bb).save(f'{OUT}/{slug}-{name}.png')
    comp.crop(bb).save(f'{OUT}/{slug}.png')
    print(slug, comp.crop(bb).size, 'Box', bb)


def save(a, slug):
    im = Image.fromarray(a)
    im = im.crop(im.getbbox())
    im.save(f'{OUT}/{slug}.png')
    print(slug, im.size)


def union_box(box, bb):
    return (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))


def strip_old_fire(body, fire):
    """Altes Düsenfeuer (orange Kegel unterhalb der Oberkante des neuen Feuers)."""
    body = body.copy()
    top = np.nonzero(fire[:, :, 3])[0].min()
    r, g, b = (body[:, :, k].astype(int) for k in range(3))
    old = (body[:, :, 3] > 0) & (r > 120) & (r > g + 30) & (b < 90)
    old[:top] = False
    body[old] = 0
    return body


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    # --- Monia-Varianten auf den Ausschnitt der normalen Monia
    fire = layer(doc, L, 'Monia #2')
    base = strip_old_fire(layer(doc, L, 'Monia'), fire)
    box = composite([base, fire]).getbbox()
    for slug, body in (('delusional-monia', layer(doc, L, 'Monia Skin')),
                       ('lightning-fast-monia', layer(doc, L, 'Lightning'))):
        body = strip_old_fire(body, fire)
        vb = union_box(box, composite([body, fire]).getbbox())
        print('  Versatz gegenüber cool-rescuer-monia:', box[0] - vb[0], box[1] - vb[1])
        save_parts(slug, [('body', body), ('flames', fire)], vb)
    bm = layer(doc, L, 'Birthday Monia')
    fig = only(bm, biggest(bm, 'right'))
    fig = np.array(composite([fig, layer(doc, L, 'Birthday Monia #2')]))
    bfire = layer(doc, L, 'Birthday Monia #1')
    fig = strip_old_fire(fig, bfire)
    vb = union_box(box, composite([fig, bfire]).getbbox())
    print('  Versatz gegenüber cool-rescuer-monia:', box[0] - vb[0], box[1] - vb[1])
    save_parts('cool-birthday-girl-monia', [('body', fig), ('flames', bfire)], vb)
    # --- einfache Skins
    save(layer(doc, L, 'Cirno'), 'absolute-moron-tempeste')
    save(layer(doc, L, 'Mary skin'), 'sickly-mary')
    save(layer(doc, L, 'Haruhi'), 'sos-crestina')
    # --- Space Huntress Vena: Jetpack aus Vena, Flamme der Raketenhand aus Ebene #59
    sv = layer(doc, L, 'Ebene #143')
    vena = layer(doc, L, 'Vena')
    vy, vx = np.nonzero(vena[:, :, 3])
    x0, y0 = vx.min(), vy.min()
    jet = np.zeros_like(vena)
    for y, x in zip(vy, vx):
        if (x - x0 <= 6 or x - x0 >= 19) and y - y0 >= 9:
            jet[y, x] = vena[y, x]
    fist = layer(doc, L, 'Ebene #59')
    FL = {(0xa8, 0x5e, 0x00), (0xff, 0xa5, 0x00), (0x87, 0x44, 0x01), (0xff, 0x91, 0x00), (0xff, 0x68, 0x00),
          (0x9c, 0x38, 0x00)}
    ff = np.zeros_like(fist)
    for y, x in zip(*np.nonzero(fist[:, :, 3])):
        if tuple(fist[y, x, :3]) in FL:
            ff[y, x] = fist[y, x]
    save_parts('space-huntress-vena', [('jet', jet), ('body', sv), ('fistflame', ff)])
    # --- Tapu Jenny: nur die Fee (links)
    tk = layer(doc, L, 'Tapu Koko')
    xs = np.nonzero(tk[:, :, 3])[1]
    fee = np.zeros(tk.shape[:2], bool)
    fee[:, :xs.min() + 15] = True                    # Fee = linke 15 Spalten (orange Kontur);
    fee[:, xs.min() + 14] &= ~(tk[:, xs.min() + 14, :3] == 255).all(1)   # weiße Kontur des Nachbarn weg
    save(only(tk, fee & (tk[:, :, 3] > 0)), 'tapu-jenny')   # rechts beginnt der Gitarrenspieler
    # --- Melissa / Cute Angel Molinda (ohne die Herzen)
    me = layer(doc, L, 'Melissa')
    mel = biggest(me, 'right')
    wings = layer(doc, L, 'Melissa #1')
    # die (in sich symmetrischen) Flügel liegen im xcf 1 px zu weit rechts -> mittig unter sie
    wings = np.roll(only(wings, near(wings, mel, 6)), -1, axis=1)
    save_parts('cute-meanie-melissa', [('wings', wings), ('body', only(me, mel))])
    save(only(me, biggest(me, 'left')), 'cute-angel-molinda')


if __name__ == '__main__':
    main(sys.argv[1])
