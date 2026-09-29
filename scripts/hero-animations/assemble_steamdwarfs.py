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

Nachzügler (zweite Runde):

  quetzahuitl-receiver-of-sacrifices  Quetza + Flügel (Ebene #101 links, #102 rechts),
                                      oben abgeschnitten und per quetza_wings
                                      vervollständigt (Teile -wingl, -wingr)
  quetzahuitl-the-emerald-dragon      Skin: Rayquaza
  little-lyta-the-amazon-princess     die rechte Figur (mit Speer) aus Little Lyta
  monsieur-pete-the-booty-raider      die Figur mit den gelben Freude-Strichen aus
                                      Monsieur Pete (ohne den fliegenden Deckel
                                      Ebene #310), die dunkle Fassöffnung Ebene #309
                                      und das Fass aus Shipwrecked (dorthin versetzt)
  sparrow-the-bumbling-buffoon        Sparrow
  pinta-the-singing-ship              Pinta + ihr Gesicht aus Ebene #315; die Noten aus
                                      #315 sind Partikel-Vorlagen (-notes)
  don-quisto-the-gold-seeker          die linke, menschliche Figur aus Don Quisto
                                      (ohne die zerstörte Statue)
  diamond-the-bulwark-of-peace        Golem aus Ascended Diamond (+ #7 und #8/#6, nur der
                                      Teil ab x 200), Gaswolke #1, Feuer #5; ohne die
                                      feuerspeiende Figur (#3, #4)
  rescued-damsel-cecilia              Seil (Ebene #239), Ascended Cecilia, der Ritter
                                      (Ebene #240) und nur das Erröten aus Ebene #242
  bloom-the-continent-corruptor       die große Blume aus Ebene #268, Blätter #279 (ohne die
                                      kleinen Blumen links), der von ihr berührte Teil
                                      von #271, Leuchten #277; Pollen #282 als
                                      Partikel-Vorlage (-pollen)

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


def comp_at(a, x, y, dil=0):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt (dil: vorher so oft um 1 px
    wachsen lassen, damit knapp getrennte Teile einer Figur zusammenbleiben)."""
    m = (a[:, :, 3] > 0).astype(np.uint8)
    if dil:
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=dil)
    n, lab = cv2.connectedComponents(m, connectivity=8)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    return only(a, (lab == lab[ys[d.argmin()], xs[d.argmin()]]) & (a[:, :, 3] > 0))


def xmask(a, f):
    """Nur die Pixel, deren Leinwand-Koordinaten f(x, y) erfüllen."""
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    return only(a, f(xs, ys))


def over(*arrs):
    out = np.zeros_like(arrs[0])
    for a in arrs:
        m = a[:, :, 3] > 0
        out[m] = a[m]
    return out


def save_single(name, a):
    ys, xs = np.nonzero(a[:, :, 3])
    Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(f'{OUT}/{name}.png')


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
    stragglers(doc, L)


def stragglers(doc, L):
    import quetza_wings
    g = lambda n: layer(doc, L, n)
    wl, wr = quetza_wings.complete(g('Ebene #101'), g('Ebene #102'))
    save_parts('quetzahuitl-receiver-of-sacrifices', [('wingl', wl), ('wingr', wr), ('body', g('Quetza'))])
    save_parts('quetzahuitl-the-emerald-dragon', [('body', g('Rayquaza'))])
    save_parts('little-lyta-the-amazon-princess', [('body', comp_at(g('Little Lyta'), 294, 255, dil=1))])
    barrel = np.zeros_like(wl)                            # das Fass aus Shipwrecked, unter Pete versetzt
    barrel[407:420, 253:267] = g('Shipwrecked')[218:231, 253:267]
    save_parts('monsieur-pete-the-booty-raider', [('barrel', barrel), ('hole', g('Ebene #309')),
                                                  ('body', comp_at(g('Monsieur Pete'), 259, 401, dil=1))])
    save_parts('sparrow-the-bumbling-buffoon', [('body', g('Sparrow'))])
    notes = g('Ebene #315')                               # Gesicht (Auge, Mund) + drei Noten
    face = lambda xs, ys: (xs >= 290) | ((xs >= 282) & (xs <= 285) & (ys >= 271))
    save_parts('pinta-the-singing-ship', [('body', over(g('Pinta'), xmask(notes, face)))])
    save_single('pinta-the-singing-ship-notes', xmask(notes, lambda xs, ys: ~face(xs, ys)))
    save_parts('don-quisto-the-gold-seeker', [('body', comp_at(g('Don Quisto'), 181, 320, dil=1))])
    right = lambda xs, ys: xs >= 200                      # links liegt ein loser Arm der Szene
    golem = over(xmask(g('Ascended Diamond'), right), xmask(g('Ascended Diamond #7'), right),
                 g('Ascended Diamond #8'), g('Ascended Diamond #6'))
    save_parts('diamond-the-bulwark-of-peace', [('gas', g('Ascended Diamond #1')), ('body', golem),
                                                ('fire', g('Ascended Diamond #5'))])
    save_parts('rescued-damsel-cecilia', [('rope', g('Ebene #239')), ('body', g('Ascended Cecilia')),
                                          ('knight', g('Ebene #240')),
                                          ('blush', comp_at(g('Ebene #242'), 290, 210))])
    leaves = g('Ebene #279')                              # ohne die Gruppe kleiner Blumen links
    m = cv2.dilate((leaves[:, :, 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    leaves = only(leaves, np.isin(lab, [k for k in range(1, n) if st[k][0] >= 200]) & (leaves[:, :, 3] > 0))
    save_parts('bloom-the-continent-corruptor', [('stem', comp_at(g('Ebene #271'), 212, 433)),
                                                 ('leaves', leaves),
                                                 ('flower', comp_at(g('Ebene #268'), 220, 420, dil=2)),
                                                 ('glow', g('Ebene #277'))])
    save_single('bloom-the-continent-corruptor-pollen', g('Ebene #282'))


if __name__ == '__main__':
    main(sys.argv[1])
