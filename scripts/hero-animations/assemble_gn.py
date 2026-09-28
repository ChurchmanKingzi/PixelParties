# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveGN.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_gn.py <pfad/zu/MotiveGN.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  andras-the-human-weapon           „Andras“ + die beiden Flammenwerfer-Strahlen
                                    „Andras #2“ (ohne die Rakete aus der Brust)
  friedhelm-the-misled-avenger      „Friedhelm“
  titan-slayer-friedhelm            Skin: „Friedhelm-Kopie“
  future-tech-gunslinger-riffel     die blonde Riffel mit zwei Pistolen (Teile aus
                                    „Riffel …“, links); die zwei abgefeuerten
                                    Kugeln „Riffel #11“ als Teil bullets, die Risse
                                    an der Einschlagstelle („Riffel #10“) entfallen
  riffel-master-of-the-ultimate-gun Ascended: die Riffel mit den zwei Pistolen;
                                    der Körper sitzt wie in „Sichtbar #146“ unter
                                    dem Kopf (+4/−3 gegenüber der Ebene), die nach
                                    vorne gerichtete Pistole vor ihr stammt aus
                                    diesem Szenenbild
  magical-girl-riffel               Skin: „Ebene #162“
  kassaran-seer-of-everything       „Kassaran“
  kent-the-indebted-apprentice      „Kent“ (die Pose rechts oben)
  koperniko-the-stargazer           „Ebene #325“ + Teleskop „Ebene #326“
  thunderstruck-waflav              Körper, Flügel und Blitze (einzeln als Teile)
  visionary-genius-heinz            „HEINZ“ (ohne Laserkanone)
  mad-scientist-heinz               Skin: „Ebene #165“ (ohne Laserkanone)
  wall-breaker-general-ralzish      Krummschwert „Ebene #227“ + „Ralzish-Kopie #1“
  blue-ralzish                      Skin: Schwert „Ebene #305“ + „Ralzish-Kopie“
  von-pixmarck-the-iron-chancellor  „Von Pixmarck“ + Pistole „Ebene #254“ + die
                                    Kugeln „Ebene #257“ des Skins (er schießt auch)
  dad-of-the-year-von-pixmarck      Skin: „Ebene #322“ + Pistole „Ebene #254“ +
                                    Schussstreifen „Ebene #257“
  nero-zira-the-mastermind          „Nero Zira“ + Roboterarme „Ebene #314“; die
                                    unten heraushängenden Kabel bekommen (wie beim
                                    Skin) abgerissene Enden mit Kupferlitzen
  normal-nero-zira                  Skin: „Normal Nero Zira“; die äußeren Schläuche
                                    werden bis zu den Schultern weitergeführt
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


def muzzle(snap, parts):
    """Ascended-Riffel: die nach vorne gerichtete Pistole vor ihrem Gesicht
    (dunkler Mündungsring) gibt es nur im Szenenbild „Sichtbar #146“ – dort,
    wo es vom zusammengesetzten Sprite abweicht, wird es übernommen."""
    comp = np.zeros_like(snap)
    for a in parts:
        m = a[:, :, 3] > 0
        comp[m] = a[m]
    diff = (np.abs(snap[:, :, :3].astype(int) - comp[:, :, :3].astype(int)).sum(2) > 12) & (comp[:, :, 3] > 0)
    return only(snap, diff)


def connect_hoses(a):
    """Normal Nero Zira: die äußeren Schläuche enden in der Ebene frei über den
    Schultern – sie werden (Querschnitt Umriss/dunkel/hell/dunkel/Umriss) bis
    zu den gelben Schulterpolstern weitergeführt, je Zeile 1 px zur Schulter."""
    ys, xs = np.nonzero(a[:, :, 3])
    x0, y0 = xs.min(), ys.min()
    out = a.copy()
    cross = [(0, 0, 0), (0x3b, 0x3b, 0x3b), (0x59, 0x59, 0x59), (0x3b, 0x3b, 0x3b), (0, 0, 0)]
    for y in range(25, 28):                              # loses Kabelstück rechts
        out[y0 + y, x0 + 49] = 0
    for k, y in enumerate(range(24, 29)):
        for cx in (10 + k, 48 - k):
            for j, c in enumerate(cross):
                out[y0 + y, x0 + cx - 2 + j] = (*c, 255)
            if y == 24:                                  # alte Endkappe (1 px breiter) entfernen
                out[y0 + y, x0 + (cx + 3 if cx < 30 else cx - 3)] = out[y0 + y, x0 + (cx + 3 if cx < 30 else cx - 3)] * 0
    return out


def torn_cables(a):
    """Die unten heraushängenden Kabel enden in der Ebene gerade abgeschnitten
    am Bildrand – sie bekommen ein abgerissenes Ende: der Mantel franst
    unregelmäßig aus, darunter stehen Kupferlitzen heraus."""
    ys, xs = np.nonzero(a[:, :, 3])
    yb = ys.max()
    out = a.copy()
    row = a[yb, :, 3] > 0
    runs, x = [], 0
    while x < len(row):
        if row[x]:
            x0 = x
            while x < len(row) and row[x]:
                x += 1
            runs.append((x0, x - 1))
        x += 1
    dark, mid = (0x2a, 0x2a, 0x2a, 255), (0x55, 0x55, 0x55, 255)
    cu0, cu1 = (0xc0, 0x6a, 0x2c, 255), (0xf0, 0xa8, 0x58, 255)
    for k, (x0, x1) in enumerate(runs):
        w = x1 - x0 + 1
        # Mantel: eine ausgefranste Zeile (Rand schwarz, innen dunkel, eine Kerbe)
        for x in range(x0, x1 + 1):
            if x == x0 + 1 + k % max(1, w - 2):
                continue
            out[yb + 1, x] = (0, 0, 0, 255) if x in (x0, x1) else dark
        out[yb + 2, x0] = (0, 0, 0, 255) if k % 2 else out[yb + 2, x0]
        # Kupferlitzen
        for j, (dx, ln) in enumerate(((1, 3), (w // 2, 2), (w - 2, 3 if k % 2 else 1))):
            xx = x0 + max(1, min(w - 2, dx))
            for d in range(ln):
                out[yb + 2 + d, xx + (d // 2) * (1 if j == 2 else -1 if j == 0 else 0)] = cu1 if d == ln - 1 else cu0
        out[yb + 1, x0 + w // 2] = mid
    return out


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('andras-the-human-weapon', [('body', g('Andras')), ('flames', g('Andras #2'))])
    save_parts('friedhelm-the-misled-avenger', [('body', g('Friedhelm'))])
    save_parts('titan-slayer-friedhelm', [('body', g('Friedhelm-Kopie'))])
    left = lambda n: box(g(n), 130, 300, 200, 345)
    rbody = left('Riffel')
    for n in ('Riffel #12', 'Riffel #8', 'Riffel #13', 'Riffel #9'):     # zwei Pistolen, Hand, Haare (von unten nach oben)
        a = left(n)
        m = a[:, :, 3] > 0
        rbody[m] = a[m]
    save_parts('future-tech-gunslinger-riffel', [('bullets', left('Riffel #11')), ('body', rbody)])
    body = shift(box(g('Riffel'), 240, 300, 300, 350), 4, -3)
    face, hair = g('Riffel #1'), g('Riffel #2')
    save_parts('riffel-master-of-the-ultimate-gun',
               [('body', body), ('face', face), ('hair', hair), ('guns', g('Riffel #6')),
                ('pistol', muzzle(g('Sichtbar #146'), [body, face, hair]))])
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
    save_parts('von-pixmarck-the-iron-chancellor', [('smoke', g('Ebene #257')), ('body', g('Von Pixmarck')), ('gun', g('Ebene #254'))])
    save_parts('dad-of-the-year-von-pixmarck', [('smoke', g('Ebene #257')), ('body', g('Ebene #322')), ('gun', g('Ebene #254'))])
    save_parts('nero-zira-the-mastermind', [('body', torn_cables(box(g('Nero Zira'), 170, 190, 265, 275))), ('arms', g('Ebene #314'))])
    save_parts('normal-nero-zira', [('body', torn_cables(connect_hoses(box(g('Normal Nero Zira'), 170, 190, 265, 275))))])
    save_parts('orthos-the-loyal-guard-dog', [('body', near(g('Orthos'), 302, 324))])
    save_parts('luna-the-flame-fairy', [('body', near(g('Luna'), 297, 239))])
    save_parts('tsu-ki-the-lunatic-princess', [('body', g('TsuKi')), ('mask', g('Ebene #208'))])


if __name__ == '__main__':
    main(sys.argv[1])
