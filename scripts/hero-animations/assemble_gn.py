# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveGN.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_gn.py <pfad/zu/MotiveGN.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  andras-the-human-weapon           „Andras“ + die beiden Flammenwerfer-Strahlen
                                    „Andras #2“ (ohne die Rakete aus der Brust)
  friedhelm-the-misled-avenger      „Friedhelm“
  titan-slayer-friedhelm            Skin: „Friedhelm-Kopie“
  future-tech-gunslinger-riffel     die blonde Riffel mit der großen Kanone samt
                                    Rauchspur (Teile aus „Riffel …“, links)
  riffel-master-of-the-ultimate-gun Ascended: die Riffel mit den zwei Pistolen;
                                    der Körper sitzt wie in „Sichtbar #146“ unter
                                    dem Kopf (+4/−3 gegenüber der Ebene)
  magical-girl-riffel               Skin: „Ebene #162“
  kassaran-seer-of-everything       „Kassaran“
  kent-the-indebted-apprentice      „Kent“ (die Pose rechts oben)
  koperniko-the-stargazer           „Ebene #325“ + Teleskop „Ebene #326“
  thunderstruck-waflav              Körper, Flügel und Blitze (einzeln als Teile)
  visionary-genius-heinz            „HEINZ“ (ohne Laserkanone)
  mad-scientist-heinz               Skin: „Ebene #165“ (ohne Laserkanone)
  wall-breaker-general-ralzish      Krummschwert „Ebene #227“ + „Ralzish-Kopie #1“
  blue-ralzish                      Skin: Schwert „Ebene #305“ + „Ralzish-Kopie“
  von-pixmarck-the-iron-chancellor  „Von Pixmarck“ + Pistole „Ebene #254“
  dad-of-the-year-von-pixmarck      Skin: „Ebene #322“ + Pistole „Ebene #254“ +
                                    Schussstreifen „Ebene #257“
  nero-zira-the-mastermind          „Nero Zira“ + Roboterarme „Ebene #314“
  normal-nero-zira                  Skin: „Normal Nero Zira“
  orthos-the-loyal-guard-dog        der zweiköpfige Hund aus „Orthos“ (mit den
                                    Flammen auf den Köpfen)
  luna-the-flame-fairy              die kleine Fee im Flammenschild aus „Luna“
  tsu-ki-the-lunatic-princess       „TsuKi“ + Maske „Ebene #208“
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


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('andras-the-human-weapon', [('body', g('Andras')), ('flames', g('Andras #2'))])
    save_parts('friedhelm-the-misled-avenger', [('body', g('Friedhelm'))])
    save_parts('titan-slayer-friedhelm', [('body', g('Friedhelm-Kopie'))])
    left = lambda n: box(g(n), 130, 300, 200, 345)
    save_parts('future-tech-gunslinger-riffel',
               [('body', left(n)) for n in ('Riffel', 'Riffel #9', 'Riffel #13', 'Riffel #8', 'Riffel #12', 'Riffel #11', 'Riffel #10')])
    body = shift(box(g('Riffel'), 240, 300, 300, 350), 4, -3)
    save_parts('riffel-master-of-the-ultimate-gun',
               [('body', body), ('face', g('Riffel #1')), ('hair', g('Riffel #2')), ('guns', g('Riffel #6')), ('mouth', g('Riffel #5'))])
    save_parts('magical-girl-riffel', [('body', g('Ebene #162'))])
    save_parts('kassaran-seer-of-everything', [('body', near(g('Kassaran'), 213, 242))])
    save_parts('kent-the-indebted-apprentice', [('body', near(g('Kent'), 289, 260))])
    save_parts('koperniko-the-stargazer', [('scope', g('Ebene #326')), ('body', g('Ebene #325'))])
    save_parts('thunderstruck-waflav', [('wings', g('Thunder-Struck Waflav #1')), ('body', g('Thunder-Struck Waflav')),
                                        ('bolt', g('Thunder-Struck Waflav #4'))])
    save_parts('visionary-genius-heinz', [('body', g('HEINZ'))])
    save_parts('mad-scientist-heinz', [('body', g('Ebene #165'))])
    save_parts('wall-breaker-general-ralzish', [('body', g('Ralzish-Kopie #1')), ('sword', g('Ebene #227'))])
    save_parts('blue-ralzish', [('body', g('Ralzish-Kopie')), ('sword', g('Ebene #305'))])
    save_parts('von-pixmarck-the-iron-chancellor', [('body', g('Von Pixmarck')), ('gun', g('Ebene #254'))])
    save_parts('dad-of-the-year-von-pixmarck', [('smoke', g('Ebene #257')), ('body', g('Ebene #322')), ('gun', g('Ebene #254'))])
    save_parts('nero-zira-the-mastermind', [('body', box(g('Nero Zira'), 170, 190, 265, 275)), ('arms', g('Ebene #314'))])
    save_parts('normal-nero-zira', [('body', box(g('Normal Nero Zira'), 170, 190, 265, 275))])
    save_parts('orthos-the-loyal-guard-dog', [('body', near(g('Orthos'), 302, 324))])
    save_parts('luna-the-flame-fairy', [('body', near(g('Luna'), 297, 239))])
    save_parts('tsu-ki-the-lunatic-princess', [('body', g('TsuKi')), ('mask', g('Ebene #208'))])


if __name__ == '__main__':
    main(sys.argv[1])
