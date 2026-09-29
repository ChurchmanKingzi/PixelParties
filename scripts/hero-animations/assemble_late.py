# -*- coding: utf-8 -*-
"""Nachzügler aus mehreren xcf-Dateien zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_late.py <verzeichnis mit den Motive*.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als src/<slug>-<teil>.png.

Motive.xcf
  styx-the-opened-gate          nur der Ausschnitt um das Tor (x 118–226, y 157–240): der Schatten-
                                block aus „Ascended Styx“ (Teil shadow) mit den Schattenarmen
                                „Ebene #661“ (Teil tendrils), die lila Tore „Ebene #662“ (Teil gates),
                                das Auge im großen Tor aus „Ebene #669“ (Teil eye); die kleinen
                                Geisterköpfe aus „Ebene #672“ sind Partikel-Vorlagen (-heads)
MotiveChina.xcf
  tushu-the-knowledge-keeper    „Tushu“; Buch und Schriftrollen aus „Tushu #3“ schweben (Teil scrolls)
MotiveCoolhalla.xcf
  patty-the-ninja-of-revenge    nur das Mädchen aus „Patty“ (ohne Schleim und Shuriken)
MotiveSteamDwarfs.xcf
  rool-the-troll-guard          „Rool“ mit dem ausgestreckten Arm „Ebene #36“ (Teil arm) und dem Bart
                                „Ebene #43“ (Teil beard)
MotiveHawaii.xcf
  champion-the-eye-of-the-storm „Ascended Champion“ + „Ebene #161“
MotiveMoe.xcf
  stormkissed-waflav            die kleine Figur aus „Stormkissed Waflav-Kopie“, die Kristallflügel
                                aus „Stormkissed Waflav #4“ (Teil wings)
MotiveGrailWar.xcf
  klaus-the-cult-leader         die Kapuzenfigur mit Messer und Geisel aus „Kultisten“
  kohta-master-of-super-killing Kohta mit erhobenem Messer aus „Summoning Instructions“
"""
import os
import sys
import numpy as np
import cv2
from gimpformats.gimpXcfDocument import GimpDocument
from assemble_hawaii import layer, save_parts, only
from xcf_scan import patch_gimpformats


def comp_at(a, x, y, dil=0):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt (dil: vorher wachsen lassen)."""
    m = (a[:, :, 3] > 0).astype(np.uint8)
    if dil:
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=dil)
    n, lab = cv2.connectedComponents(m, connectivity=8)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    return only(a, (lab == lab[ys[d.argmin()], xs[d.argmin()]]) & (a[:, :, 3] > 0))


def region(a, x0, y0, x1, y1):
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return only(a, m)


def small_parts(a, max_px):
    """Nur die kleinen Zusammenhangskomponenten (z. B. Geisterköpfe statt großer Gespenster)."""
    n, lab, st, _ = cv2.connectedComponentsWithStats((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    return only(a, np.isin(lab, [k for k in range(1, n) if st[k][4] <= max_px]))


def main(d):
    patch_gimpformats()
    doc = lambda f: GimpDocument(os.path.join(d, f))
    # ---- Motive.xcf: Styx, the Opened Gate
    D = doc('Motive.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    R = (118, 157, 226, 240)
    save_parts('styx-the-opened-gate', [('shadow', region(g('Ascended Styx'), *R)),
                                        ('tendrils', region(g('Ebene #661'), *R)),
                                        ('gates', region(g('Ebene #662'), *R)),
                                        ('eye', region(g('Ebene #669'), *R))])
    heads = small_parts(region(g('Ebene #672'), 118, 180, 226, 240), 150)
    from assemble_hawaii import save_single
    save_single('styx-the-opened-gate-heads', heads)
    # ---- MotiveChina.xcf: Tushu
    D = doc('MotiveChina.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    save_parts('tushu-the-knowledge-keeper', [('body', g('Tushu')), ('scrolls', g('Tushu #3'))])
    # ---- MotiveCoolhalla.xcf: Patty
    D = doc('MotiveCoolhalla.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    save_parts('patty-the-ninja-of-revenge', [('body', comp_at(g('Patty'), 283, 62))])
    # ---- MotiveSteamDwarfs.xcf: Rool
    D = doc('MotiveSteamDwarfs.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    save_parts('rool-the-troll-guard', [('body', g('Rool')), ('arm', g('Ebene #36')), ('beard', g('Ebene #43'))])
    # ---- MotiveHawaii.xcf: Champion, the Eye of the Storm
    D = doc('MotiveHawaii.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    body = g('Ascended Champion')
    extra = g('Ebene #161')
    body[extra[:, :, 3] > 0] = extra[extra[:, :, 3] > 0]
    save_parts('champion-the-eye-of-the-storm', [('body', body)])
    # ---- MotiveMoe.xcf: Stormkissed Waflav
    D = doc('MotiveMoe.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    save_parts('stormkissed-waflav', [('wings', g('Stormkissed Waflav #4')),
                                      ('body', comp_at(g('Stormkissed Waflav-Kopie'), 290, 235, dil=1))])
    # ---- MotiveGrailWar.xcf: Klaus, Kohta
    D = doc('MotiveGrailWar.xcf')
    g = lambda n: layer(D, D.raw_layers, n)
    save_parts('klaus-the-cult-leader', [('body', comp_at(g('Kultisten'), 290, 150, dil=1))])
    save_parts('kohta-master-of-super-killing', [('body', g('Summoning Instructions'))])


if __name__ == '__main__':
    main(sys.argv[1])
