# -*- coding: utf-8 -*-
"""Hero-Sprites aus MotiveJapan.xcf zusammensetzen (mit dem Nutzer abgeglichen).

* Champion, the Stormbringer: „Champion“, sein in den Boden gerammtes Schwert „Ebene #166“
  (Teil `-sword`) und darüber die Hand am Knauf „Ebene #167“ (Teil `-hand`).
* Idej Lord Nobunakin: der rote Samurai „Ebene #30“ mit Gesicht „Ebene #33“, das schlanke
  Laserschwert „Ebene #37“ (Teil `-sword`) und die Hand am Griff „Ebene #38“ (Teil `-hand`).
* Idej Lord Shoguwana: „Shoguwana“.
* Idej Lord Todugawin: der im Schneidersitz sitzende Ninja „Ebene #59“.
* Yukana, the Scholar on the Run: „Yukana“ (braunhaarig, mit Brille und Rankenstab).

Die Idej-Ebenen sind in der Datei teils halb ausgeblendet; sie werden hier voll deckend
übernommen, die 20 % Transparenz der Idej-Heroes setzt erst die Animation (japan.py).

Aufruf:  python3 assemble_japan.py <pfad/zu/MotiveJapan.xcf>
"""
import sys
import numpy as np
from gimpformats.gimpXcfDocument import GimpDocument
from assemble_hawaii import layer, layer_over, save_parts


def opaque(a):
    """Ebenen-Deckkraft zurücknehmen: jedes sichtbare Pixel voll deckend."""
    a = a.copy()
    a[:, :, 3] = np.where(a[:, :, 3] > 0, 255, 0)
    return a


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('champion-the-stormbringer', [
        ('body', g('Champion')), ('sword', g('Ebene #166')), ('hand', g('Ebene #167'))])
    save_parts('idej-lord-nobunakin', [
        ('body', opaque(layer_over(g('Ebene #30'), g('Ebene #33')))), ('hand', opaque(g('Ebene #38'))),
        ('sword', opaque(g('Ebene #37')))])
    save_parts('idej-lord-shoguwana', [('body', opaque(g('Shoguwana')))])
    save_parts('idej-lord-todugawin', [('body', opaque(g('Ebene #59')))])
    save_parts('yukana-the-scholar-on-the-run', [('body', g('Yukana'))])


if __name__ == '__main__':
    main(sys.argv[1])
