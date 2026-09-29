# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveIndia.xcf zusammensetzen (mit dem Nutzer abgeglichen).

* Madaga, the Forsaken Seafarer: „Madaga“ (mit vier Tentakeln, ohne die über dem Kopf
  schwebenden aus „Ebene #5“).
* Logan, the Investment Monkee: der Affe „Wuki #1“ mit Sonnenbrille, Zigarre samt Rauch und
  Goldkette aus „Wuki“ (ohne den Tisch).
* Tri Fecta, the Puppet Master: „TriFecta“ (ohne die Tribüne).
* Tri Ad, the Puppet Mistress: „Triad“ (ohne die Tribüne).
* Zamorin, the Spice Rajah: „Zamorin“, in der einen Hand die Glasschale aus „Ebene #8“ (Teil
  `-bowl`), in der anderen den Sack „Ebene #10“ samt Knoten-Pixel „Ebene #13“ (Teil `-sack`).

Aufruf:  python3 assemble_india.py <pfad/zu/MotiveIndia.xcf>
"""
import sys
from gimpformats.gimpXcfDocument import GimpDocument
from assemble_hawaii import layer, near, layer_over, save_parts


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('madaga-the-forsaken-seafarer', [('body', g('Madaga'))])
    save_parts('logan-the-investment-monkee', [('body', layer_over(g('Wuki #1'), g('Wuki')))])
    save_parts('tri-fecta-the-puppet-master', [('body', g('TriFecta'))])
    save_parts('tri-ad-the-puppet-mistress', [('body', g('Triad'))])
    save_parts('zamorin-the-spice-rajah', [
        ('body', g('Zamorin')), ('sack', layer_over(g('Ebene #10'), g('Ebene #13'))),
        ('bowl', near(g('Ebene #8'), 185, 194))])


if __name__ == '__main__':
    main(sys.argv[1])
