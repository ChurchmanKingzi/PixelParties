# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus Motive.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Heroes:
* Alex, Trainer of Heroes: „Alex“.
* Great Detective Doq: die Figur aus der Szene „Doq“.
* Grisgar, Emissary of the Demon Lord: „Grisgar #2“ (mit den großen Dämonenflügeln).
* Nieht, the Blitz Blade: „Nieht-Kopie“.
* Kohta, the Silent Observer: „Kohta #1“ ohne den unteren Stuhl.
* Bill, the Angry Auctioneer: „Bill“ ohne die Striche rund um die Figur.
* Sabrina, the Psychic Witch: „Sabrina #1“.
* Silent Water Mizune: „Mizune #2“ mit den Armen aus „Mizune #3“.
* Bomb Berserker Bartas: „Bartas“.
* Gon, the Frostbringer: „Gon-Kopie“.
* Ida, the Adept of Destruction: „Ida“.
* Vacarn, the Dark Goblin Necromancer: der Goblin mit offenem Mund aus „Vacarn“.
* Sol Rym, the Thunder Djinn: „Sol Rym“ auf der schwarzen Wolke „Ebene #639“ (Teil `-cloud`).
* Legendary Explorer Dajan: die Figur aus „Dajan #1“ mit „Dajan #4“ und dem Edelstein in seiner Hand
  aus „Dajan #3“.
* Omikron, the Faceless Illusionist: die Figur aus der Szene „Omikron“.

Skins:
* Ida the Fire Princess: „Ebene #203“.
* One Chuck Man: „Mizune und Chuck-Kopie“, die OK-Sprechblase als Teil `-bubble`.
* Duke Omikron: „Duke Omikron“.
* Alice the Wonderous Girl: „Ebene #571“, darüber ihre Puppe „Ebene #572“.
* Mega-Warrior Karian: „Ebene #301“.
* Sett Dunking on You: „SETT-Kopie“ (Base-Sett = „SETT“ ist schon animiert).
* Emperor Arthor: die Robe „Ebene #294“ über dem Arthor aus „Arthor“ (Gesicht, Edelstein, Beine).
* Nieht the Yellow Flash: „Minato“.
* Beato the Golden Witch: „Beatrice“.
* Elana the Digital Diva: „MIKU ELANA“, Gitarre „Ebene #557“ (Teil `-guitar`), Arme „Ebene #556“
  (Teil `-arms`).
* Fiona the Ghost Princess: „Perona“.
* Overlord Baaliel: „Overlord“.
* Grey Mage Archibald: „Gandalf“.
* Toras the Battle Maniac: „Ebene #26“ ohne die zerschnittene Trainingspuppe.
* ZsosSsar the Worm Soldier: „Worms“ mit der Gaswaffe „Ebene #569“ (Teil `-gun`).
* Holy Styx: „Styx Skin“.
* Kaito Sid the Phantom Thief: der Dieb aus „Sid Skin“ (ohne die Geldsäcke).
* Gon the Half-Frozen: „Ebene #309“.
* Dead Singer Molinda: die Sängerin aus „Molinda skin“ (ohne die Herzen), Flügel „Ebene #23“
  (Teil `-wings`).
* The Little Seaserpent: die orangehaarige Meerjungfrau aus „Arielle“.
* Nomu of the Dawn: „Obito“.
* Alien Invader Bartas: „Bartas skin“.
* Tharx the King of Conquerors: „Ebene #286“.

Nachzügler:
* Sas'Za, the Snaka Adventurer: die mittlere Figur (blaue Haare) aus „Sas'Za“, dahinter ihr Bogen
  „Sas'Za #1“ (Teil `-bow`).

Aufruf:  python3 assemble_motive.py <pfad/zu/Motive.xcf>
"""
import sys
import numpy as np
import cv2
from gimpformats.gimpXcfDocument import GimpDocument
from assemble_hawaii import layer, layer_over, save_parts, only, shift
from xcf_scan import patch_gimpformats


def near(a, x, y, dil=0):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt (dil: vorher so oft um 1 px
    wachsen lassen, damit knapp getrennte Teile einer Figur zusammenbleiben)."""
    m = (a[:, :, 3] > 0).astype(np.uint8)
    if dil:
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=dil)
    n, lab = cv2.connectedComponents(m, connectivity=8)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    k = lab[ys[d.argmin()], xs[d.argmin()]]
    return only(a, (lab == k) & (a[:, :, 3] > 0))


def biggest(a):
    n, lab = cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    k = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    return only(a, lab == k)


def opaque(a):
    a = a.copy()
    a[:, :, 3] = np.where(a[:, :, 3] > 0, 255, 0)
    return a


def box(a, x0, y0, x1, y1, keep=True):
    """Nur (keep) bzw. ohne (keep=False) den Ausschnitt [x0, x1) x [y0, y1)."""
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return only(a, m if keep else ~m)


def top_left(a):
    ys, xs = np.nonzero(a[:, :, 3])
    return int(xs.min()), int(ys.min())


def main(path):
    patch_gimpformats()                                   # sonst werden manche Ebenen falsch dekodiert
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: opaque(layer(doc, L, n))
    one = lambda slug, a: save_parts(slug, [('body', a)])
    # ---- Heroes
    one('alex-trainer-of-heroes', g('Alex'))
    one('great-detective-doq', near(g('Doq'), 145, 190, dil=1))
    one('grisgar-emissary-of-the-demon-lord', g('Grisgar #2'))
    one('nieht-the-blitz-blade', g('Nieht-Kopie'))
    one('kohta-the-silent-observer', box(g('Kohta #1'), 0, 0, 10000, 196))
    bill = g('Bill')                                       # ohne die Striche um ihn herum (zwei Brauntöne)
    stray = np.isin(bill[:, :, 0].astype(int) * 65536 + bill[:, :, 1].astype(int) * 256 + bill[:, :, 2],
                    [0x6b5539, 0x312421])
    one('bill-the-angry-auctioneer', biggest(only(bill, ~stray)))
    one('sabrina-the-psychic-witch', g('Sabrina #1'))
    one('silent-water-mizune', layer_over(g('Mizune #2'), g('Mizune #3')))
    one('bomb-berserker-bartas', g('Bartas'))
    one('gon-the-frostbringer', g('Gon-Kopie'))
    one('ida-the-adept-of-destruction', g('Ida'))
    one('vacarn-the-dark-goblin-necromancer', near(g('Vacarn'), 330, 207, dil=1))
    save_parts('sol-rym-the-thunder-djinn', [('cloud', g('Ebene #639')), ('body', g('Sol Rym'))])
    one('legendary-explorer-dajan', layer_over(near(g('Dajan #1'), 280, 205, dil=1), g('Dajan #4'),
                                               near(g('Dajan #3'), 271, 218)))
    one('omikron-the-faceless-illusionist', near(g('Omikron'), 245, 90, dil=1))
    # ---- Skins
    one('ida-the-fire-princess', g('Ebene #203'))
    chuck = g('Mizune und Chuck-Kopie')
    top = top_left(chuck)[1]                              # die Blase: die obersten 11 Zeilen (mit Schwanz)
    bubble = box(chuck, 0, 0, 10000, top + 11)
    body = box(chuck, 0, top + 11, 10000, 10000)
    save_parts('one-chuck-man', [('body', body), ('bubble', bubble)])
    one('duke-omikron', g('Duke Omikron'))
    one('alice-the-wonderous-girl', layer_over(g('Ebene #571'), g('Ebene #572')))
    one('mega-warrior-karian', g('Ebene #301'))
    one('sett-dunking-on-you', g('SETT-Kopie'))
    robe = layer(doc, L, 'Ebene #294')                    # Robe über Arthor (Gesicht, Edelstein, Beine);
    base = near(layer(doc, L, 'Arthor'), 285, 195, dil=1)
    (rx, ry), (bx, by) = top_left(robe), top_left(base)   # Arthor liegt 1 px rechts der linken Robenkante
    robe = only(robe, robe[:, :, 3] == 255)               # gemalt werden nur die deckenden Pixel
    base = only(base, base[:, :, 3] == 255)
    one('emperor-arthor', layer_over(shift(base, rx - bx + 1, ry - by), robe))
    one('nieht-the-yellow-flash', g('Minato'))
    one('beato-the-golden-witch', g('Beatrice'))
    save_parts('elana-the-digital-diva', [('body', g('MIKU ELANA')), ('guitar', g('Ebene #557')),
                                          ('arms', g('Ebene #556'))])
    one('fiona-the-ghost-princess', g('Perona'))
    one('overlord-baaliel', g('Overlord'))
    one('grey-mage-archibald', g('Gandalf'))
    one('toras-the-battle-maniac', box(g('Ebene #26'), 0, 119, 284, 10000, keep=False))
    save_parts('zsosssar-the-worm-soldier', [('body', g('Worms')), ('gun', g('Ebene #569'))])
    one('holy-styx', g('Styx Skin'))
    sid = g('Sid Skin')                                   # die Geldsäcke links und rechts (warme Brauntöne) weg
    ys, xs = np.mgrid[0:sid.shape[0], 0:sid.shape[1]]
    r, gg, b = (sid[:, :, k].astype(int) for k in range(3))
    warm = (r > gg + 15) & (r > b + 40)
    sid = only(sid, ~(((xs >= 273 + 30) | (xs <= 273 + 17)) & warm) & (xs < 273 + 34))
    one('kaito-sid-the-phantom-thief', biggest(sid))
    one('gon-the-half-frozen', g('Ebene #309'))
    save_parts('dead-singer-molinda', [('wings', g('Ebene #23')), ('body', near(g('Molinda skin'), 232, 135))])
    mer = near(g('Arielle'), 340, 130)                  # ohne den lila Schleim rechts neben ihr
    x0 = top_left(mer)[0]
    xs = np.mgrid[0:mer.shape[0], 0:mer.shape[1]][1]
    r, gg, b = (mer[:, :, k].astype(int) for k in range(3))
    one('the-little-seaserpent', biggest(only(mer, ~((xs >= x0 + 18) & (b > r) & (b > gg)))))
    one('nomu-of-the-dawn', g('Obito'))
    one('alien-invader-bartas', g('Bartas skin'))
    one('tharx-the-king-of-conquerors', g('Ebene #286'))
    save_parts('sasza-the-snaka-adventurer', [('bow', g("Sas'Za #1")), ('body', near(g("Sas'Za"), 336, 143))])


if __name__ == '__main__':
    main(sys.argv[1])
