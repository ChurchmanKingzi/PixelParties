# -*- coding: utf-8 -*-
"""Die letzten Skins zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_skins_last.py <verzeichnis mit den Motive*.xcf>   (aus scripts/hero-animations)
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als src/<slug>-<teil>.png.

Motive.xcf
  bills-worst-nightmare          „Bill“ (ohne die braunen Striche um ihn, wie beim Hero) mit der Bärenhaube
                                 samt Krone und Umhang aus „Ebene #430“ darüber
  creepy-villager-girl-semi      die Form von „Semi“ (ohne Schatten), Farben nach dem Skin-Kartenbild umgefärbt
                                 (grünes Haar, braun-rosa Kleid) – diese Farbversion gibt es im xcf nicht mehr
  non-believer-doq               nur in der Szene „Sichtbar #11“ vorhanden: Differenz zur leeren Szene
                                 „Sichtbar #61“
  thunder-god-sol-rym            „Ebene #425“ auf derselben Gewitterwolke „Ebene #639“ wie Sol Rym (Teile body, cloud)
  ultimate-despair-inya          „Ebene #308“, getrennt in das Mädchen (Teil girl) und den Bären darunter (Teil bear)
  mega-priestess-johanna         „Ebene #302“
  student-council-president-nao  „Kanade“ (nur die obere Figur, samt Stab) mit den Engelsflügeln „Ebene #583“
                                 (Teil wings)
MotiveDeepsea.xcf
  rhabi-the-human-hunter         „Papyrus“ (ohne die Bewegungsschlieren) mit den abgetrennten Knochenarmen aus
                                 „Ebene #151“ (Teile arml, armr oben, arml2, armr2 unten)
Kartenbild (in keiner Datei vorhanden)
  kasperov-the-king-of-the-east  Shogi-Stein mit Kasperovs Narrenkappe, aus cards/skins/ ausgeschnitten
                                 (gilt auch für „Kasperov the King of the East1“)
"""
import os
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument
from assemble_hawaii import layer, save_parts, only
from xcf_scan import patch_gimpformats

CARDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'cards', 'skins')


def comp_at(a, x, y, dil=0):
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


def fill_holes(m):
    h, w = m.shape
    f = np.zeros((h + 2, w + 2), np.uint8)
    f[1:-1, 1:-1] = m
    inv = (1 - f).astype(np.uint8)
    cv2.floodFill(inv, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 2)
    return inv[1:-1, 1:-1] != 2


def card_grid(name, sx=7.84, ox=-1.85, sy=7.84, oy=-2.05):
    """Skin-Kartenbild auf das Pixelraster zurückrechnen (Median der Zellmitte)."""
    a = np.array(Image.open(os.path.join(CARDS, name + '.png')).convert('RGB')).astype(int)
    h, w = a.shape[:2]
    nx, ny = int((w - ox) / sx), int((h - oy) / sy)
    o = np.zeros((ny, nx, 3), int)
    for j in range(ny):
        for i in range(nx):
            x0, y0 = ox + i * sx, oy + j * sy
            c = a[max(0, int(y0 + sy * 0.3)):int(y0 + sy * 0.7) + 1,
                  max(0, int(x0 + sx * 0.3)):int(x0 + sx * 0.7) + 1].reshape(-1, 3)
            o[j, i] = np.median(c, 0) if len(c) else 0
    return o


def recolor_semi(semi):
    """Jede Farbe des Semi-Sprites durch den Median der Kartenfarben an ihren Stellen ersetzen (Farben, die
    schon passen – Haut, Augen, Flügel, Kontur –, bleiben)."""
    c = card_grid('Creepy Villager Girl Semi')
    ys, xs = np.nonzero(semi[:, :, 3])
    y0, x0 = ys.min(), xs.min()
    DX, DY = 35, 30                                        # Lage des Sprites im Kartenraster
    samp = {}
    for y, x in zip(ys, xs):
        samp.setdefault(tuple(semi[y, x, :3]), []).append(c[y - y0 + DY, x - x0 + DX])
    out = semi.copy()
    for y, x in zip(ys, xs):
        col = tuple(semi[y, x, :3])
        med = np.median(np.array(samp[col]), 0).astype(int)
        if np.abs(med - np.array(col)).sum() >= 60 and max(col) > 0x30:
            out[y, x, :3] = med
    return out


def kasperov_east():
    """Shogi-Stein (fünfeckig, nach unten breiter) mit Narrenkappe aus dem Kartenbild."""
    a = card_grid('Kasperov the King of the East')
    H, W = a.shape[:2]
    sat = a.max(2) - a.min(2)
    m = np.zeros((H, W), bool)
    m[36:54, 36:60] = sat[36:54, 36:60] > 50                 # die bunte Kappe
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    m = lab == 1 + np.argmax(st[1:, 4])
    spans = {49: (46, 49), 50: (45, 50), 51: (44, 51), 52: (43, 52), 53: (42, 53),
             **{y: (41, 54) for y in range(54, 58)}, **{y: (40, 55) for y in range(58, 66)}}
    for y, (x0, x1) in spans.items():
        m[y, x0:x1 + 1] = True
    near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    rows = np.arange(H)[:, None]
    m |= (a.max(2) < 30) & near & (rows <= 51)               # Kontur der Kappe
    m |= (a.min(2) > 200) & near & (rows >= 49) & (rows <= 53)   # helle Schellen
    m[:, :37] = False
    edge = np.zeros_like(m)
    edge[:, 38] = edge[:, 57:] = True                         # Brettlinien am Rand
    m &= ~(edge & (sat < 30))
    for x, y in ((39, 53), (55, 53), (57, 52)):              # Schellen ohne Lücke zur Kappe
        m[y, x] = True
    o = np.zeros((H, W, 4), np.uint8)
    o[..., :3] = a
    o[..., 3] = m * 255
    return o


def main(d):
    patch_gimpformats()
    D = GimpDocument(os.path.join(d, 'Motive.xcf'))
    g = lambda n: layer(D, D.raw_layers, n)
    # ---- Bills Worst Nightmare
    bill = g('Bill')
    stray = np.isin(bill[:, :, 0].astype(int) * 65536 + bill[:, :, 1].astype(int) * 256 + bill[:, :, 2],
                    [0x6b5539, 0x312421])
    bill = only(bill, ~stray)
    mask = region(g('Ebene #430'), 0, 0, 272, 10000)         # nur die Haube über Bill, nicht der Bär daneben
    save_parts('bills-worst-nightmare', [('body', bill), ('mask', mask)])
    # ---- Creepy Villager Girl Semi
    semi = g('Semi')
    semi = comp_at(semi, 339, 230)                            # ohne den Schatten darunter
    save_parts('creepy-villager-girl-semi', [('body', recolor_semi(semi.astype(int)).astype(np.uint8))])
    # ---- Non-Believer Doq: Szene minus leere Szene
    sc, bg = g('Sichtbar #11').astype(int), g('Sichtbar #61').astype(int)
    diff = np.zeros(sc.shape[:2], bool)
    diff[172:212, 166:206] = (np.abs(sc[172:212, 166:206, :3] - bg[172:212, 166:206, :3]).sum(2) > 20)
    n, lab, st, _ = cv2.connectedComponentsWithStats(diff.astype(np.uint8), connectivity=8)
    diff = fill_holes(lab == 1 + np.argmax(st[1:, 4]))
    save_parts('non-believer-doq', [('body', only(sc.astype(np.uint8), diff))])
    # ---- Thunder God Sol Rym
    save_parts('thunder-god-sol-rym', [('cloud', g('Ebene #639')), ('body', g('Ebene #425'))])
    # ---- Ultimate Despair Inya: Mädchen und Bär (ab der weißen Kontur des Bären)
    inya = g('Ebene #308')
    ys = np.nonzero(inya[:, :, 3])[0]
    split = ys.min() + 22
    save_parts('ultimate-despair-inya', [('bear', region(inya, 0, split, 10000, 10000)),
                                         ('girl', region(inya, 0, 0, 10000, split))])
    # ---- Mega-Priestess Johanna, Student Council President Nao
    save_parts('mega-priestess-johanna', [('body', g('Ebene #302'))])
    save_parts('student-council-president-nao', [('wings', g('Ebene #583')),
                                                 ('body', comp_at(g('Kanade'), 378, 215, dil=1))])
    # ---- MotiveDeepsea.xcf: RhaBi the Human Hunter
    D = GimpDocument(os.path.join(d, 'MotiveDeepsea.xcf'))
    g = lambda n: layer(D, D.raw_layers, n)
    arms = g('Ebene #151')
    save_parts('rhabi-the-human-hunter', [('body', comp_at(g('Papyrus'), 172, 150)),
                                          ('arml', region(arms, 158, 140, 172, 150)),      # oben links
                                          ('armr', region(arms, 178, 134, 192, 146)),      # oben rechts
                                          ('arml2', region(arms, 145, 148, 158, 157)),     # unten links
                                          ('armr2', region(arms, 190, 148, 203, 157))])    # unten rechts
    # ---- Kasperov the King of the East (Kartenbild)
    save_parts('kasperov-the-king-of-the-east', [('body', kasperov_east())])


if __name__ == '__main__':
    main(sys.argv[1])
