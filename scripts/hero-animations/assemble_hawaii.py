# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveHawaii.xcf zusammensetzen (mit dem Nutzer abgeglichen).

* Tempeste, the Weather Fairy: „Tempeste“ (mit türkisem Leuchtrand).
* Taio, the Sun Fencer: „Taio“ (Schwertarm erhoben), die in dieser Ebene halb
  ausgeblendeten Beine aus „Taio-Kopie“; das Flammenschwert „Ebene #110“ als Teil `-sword`.
* Taio, Absorber of the Mountain's Heart (Ascended): Flammenhaar-Taio „Ebene #153“,
  Kette „Ebene #157“, Flasche „Ebene #155“, Stab „Ebene #154“, Flammen „Ebene #156“
  (ohne den losen Funken) und das große Feuer „Ebene #125“ darunter.
* Lizbeth, the Reaper of the Light: „Lizbeth“ (Sense samt Lichtstrahlen).
* Johanna, Crusader of Light: „Johanna“.
* Calamitusk, the Chaorc War Chief: „Calamitustk-Kopie“, der Arm „Calamitustk-Kopie #1“
  und das Banner „Ebene #53“ als Teile `-arm` / `-banner`.
* Grand Inquisitor Karian: „Karian“ (nur der Inquisitor mit dem Schwert).
* Flamebathed Waflav (Ascended): „Flamebathed Waflav“ und die Feuerflügel
  „Flamebathed Waflav #1“ als Teil `-wings`.
* Luna Pele, the Flame Dancer: die Tänzerin aus „Luna Tepe“ (ohne die Feuersäulen).
* Tempeste Moana, the Rain Singer: „Tempeste Moana“.
* Tempeluna, the Convergence Fairy (Ascended): „Tempeluna“.

Aufruf:  python3 assemble_hawaii.py <pfad/zu/MotiveHawaii.xcf>
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



def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('tempeste-the-weather-fairy', [('body', g('Tempeste'))])
    taio = g('Taio')
    legs = taio[:, :, 3] < 255                            # halb ausgeblendete Beine: aus der Kopie
    kopie = g('Taio-Kopie')
    rows_legs = np.nonzero(legs.any(1) & (taio[:, :, 3] > 0).any(1))[0]
    y0 = int(rows_legs[(taio[rows_legs, :, 3] < 255).any(1) & (taio[rows_legs, :, 3] > 0).any(1)].min())
    taio[y0:] = kopie[y0:]
    save_parts('taio-the-sun-fencer', [('body', taio), ('sword', g('Ebene #110'))])
    fl = g('Ebene #156')
    save_parts('taio-absorber-of-the-mountain-s-heart', [
        ('fire', g('Ebene #125')), ('body', g('Ebene #153')), ('staff', g('Ebene #154')), ('flask', g('Ebene #155')),
        ('flames', only(fl, biggest(fl)[:, :, 3] > 0)), ('chain', g('Ebene #157'))])
    save_parts('lizbeth-the-reaper-of-the-light', [('body', g('Lizbeth'))])
    save_parts('johanna-crusader-of-light', [('body', g('Johanna'))])
    save_parts('calamitusk-the-chaorc-war-chief', [('body', g('Calamitustk-Kopie')), ('arm', g('Calamitustk-Kopie #1')),
                                                   ('banner', g('Ebene #53'))])
    save_parts('grand-inquisitor-karian', [('body', g('Karian'))])
    save_parts('flamebathed-waflav', [('wings', g('Flamebathed Waflav #1')), ('body', g('Flamebathed Waflav'))])
    save_parts('luna-pele-the-flame-dancer', [('body', near(g('Luna Tepe'), 286, 452))])
    save_parts('tempeste-moana-the-rain-singer', [('body', g('Tempeste Moana'))])
    save_parts('tempeluna-the-convergence-fairy', [('body', g('Tempeluna'))])


if __name__ == '__main__':
    main(sys.argv[1])
