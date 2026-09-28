# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveGuardianBeasts.xcf zusammensetzen (mit dem
Nutzer abgeglichen). Die Datei enthält vor allem die zwölf Wächter-Kreaturen;
Heroes sind nur:

* Mao, the Vengeful Guardian: Ebene „Mao“ (ohne den losen Blutstreifen links),
  Skin Vengeful Hunter Mao: Ebene „Mao-Kopie“ (ohne den Blutfleck links).
  Der dunkelrote Bogen unten ist die Schlitzspur ihrer Klauen (links nach
  rechts): er wird als eigener Teil `-slash` gespeichert, der Körper darunter
  (`-body`) wird dort ergänzt, wo der Bogen ihn verdeckt.
* Dajan, Conqueror of the Treasure Cave (Ascended-Form): der Dajan mit Hut aus
  „Ebene #42“ (pixelgleich in „Ascended Dajan #2“), der Dolch aus „Ebene #43“
  und das Blut aus „Ebene #44“, soweit es auf ihm liegt (Gittertor und
  Wandflecken gehören zur Szene).

Aufruf:  python3 assemble_guardianbeasts.py <pfad/zu/MotiveGuardianBeasts.xcf>
Schreibt src/<slug>.png und die beweglichen Teile deckungsgleich als
src/<slug>-<teil>.png.
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


def box(a, x0, y0, x1, y1):
    """Nur den Ausschnitt [x0, x1) × [y0, y1) behalten."""
    out = np.zeros_like(a)
    out[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    return out


def shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def rows(a, y0=None, y1=None):
    """Nur Zeilen [y0, y1) behalten (Leinwand-Koordinaten)."""
    out = np.zeros_like(a)
    out[y0:y1] = a[y0:y1]
    return out


def layer_over(*arrs):
    """Ebenen von unten nach oben zusammenlegen."""
    out = np.zeros_like(arrs[0])
    for a in arrs:
        m = a[:, :, 3] > 0
        out[m] = a[m]
    return out


def save_single(name, a):
    ys, xs = np.nonzero(a[:, :, 3])
    Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(f'{OUT}/{name}.png')


SLASH = ('990000', '730000', '4d0000', '6c0000')       # Schlitzspur der Klauen


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def split_slash(a, outline):
    """Schlitzbogen vom Körper trennen. Wo der Bogen innerhalb des Körpers liegt (links und
    rechts in der Zeile oder oben und unten in der Spalte Körperpixel in höchstens 6 px), wird
    der Körper mit der Farbe des nächsten Körperpixels ergänzt; am Rand zur Leere mit Kontur."""
    op = a[:, :, 3] > 0
    sl = op & np.array([[hexc(a[y, x]) in SLASH for x in range(a.shape[1])] for y in range(a.shape[0])])
    body = only(a, op & ~sl)
    bm = op & ~sl
    by, bx = np.nonzero(bm)
    fill = []
    for y, x in zip(*np.nonzero(sl)):
        row, col = bm[y, max(0, x - 6):x + 7], bm[max(0, y - 6):y + 7, x]
        inside = (row[:min(6, x)].any() and row[min(6, x) + 1:].any()) or \
                 (col[:min(6, y)].any() and col[min(6, y) + 1:].any())
        if inside:
            d = (bx - x) ** 2 + (by - y) ** 2
            k = d.argmin()
            fill.append((y, x, body[by[k], bx[k]]))
    for y, x, c in fill:
        body[y, x] = c
    fm = np.zeros_like(bm)
    for y, x, _ in fill:
        fm[y, x] = True
    full = body[:, :, 3] > 0
    for y, x in zip(*np.nonzero(fm)):                     # ergänzte Pixel am Rand: Kontur
        if any(not full[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            body[y, x] = (int(outline[0:2], 16), int(outline[2:4], 16), int(outline[4:6], 16), 255)
    return body, only(a, sl)


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    body, slash = split_slash(box(g('Mao'), 136, 0, 320, 240), '080808')
    save_parts('mao-the-vengeful-guardian', [('body', body), ('slash', slash)])
    body, slash = split_slash(box(g('Mao-Kopie'), 137, 0, 320, 240), '4a4949')
    save_parts('vengeful-hunter-mao', [('body', body), ('slash', slash)])
    dajan = near(g('Ebene #42'), 152, 58)
    on = dajan[:, :, 3] > 0
    blood = only(g('Ebene #44'), on)
    save_parts('dajan-conqueror-of-the-treasure-cave', [('body', dajan), ('dagger', g('Ebene #43')), ('blood', blood)])


if __name__ == '__main__':
    main(sys.argv[1])
