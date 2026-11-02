# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Spider“ (Creature).

Quelle: src/cute-spider.png — zwei Ebenen aus MotiveGN.xcf zusammengesetzt (21×20 px, 8 Farben): Ebene 279 „Ebene #…“ (21×20, die Engelsflügel samt Mittelbalken) an der Position,
an der sie auf der Karte liegt, plus Ebene 277 (7×6, die rosa Herz-Augen) an ihrer Kartenposition. Dies ist der einzige karten-eigene Sprite der Karte; der Abgleich (merged.json) fand die
Figur nur über die Nebenebene 277 — die Flügelebene 279 steht dort als Kandidat Nr. 22 (außerhalb der 16er-Liste von creature_show.py), die Kunst zeigt genau diese Kombination.
PICK: [["MotiveGN", 279, "ganze Ebene"], ["MotiveGN", 277, "ganze Ebene"]]   (277 an (7,8) im Sprite)

Aufruf:   python3 cute_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-spider.png + .json

Identifikation (Sprite 21×20, symmetrisch um x = 10; es gibt keinen Spinnenkörper in der Mitte — die Spalte x = 10 ist leer, wie auf der Karte):
* Zwei große weiß-hellblaue Engelsflügel (links x 0–9, rechts x 11–20, Zeilen 0–19): Federfläche C (246,255,255) weiß / B (172,213,255) hellblau, lila Randlinien D (153,102,255) / G (153,153,255),
  dunkler Umriss A (41,41,41); Spitzen oben bei (3–4,0) und (16–17,0), unten laufen die Flügel in drei Federspitzen aus (x 0–4, Zeilen 15–19 bzw. x 16–20).
* Mittelbalken (x 9–11, Zeile 7): drei dunkle Pixel A, verbinden die Flügel.
* Herz-Augen (x 7–9 und 11–13, Zeilen 8–13): je Seite zwei rosa Herzen aus E (255,133,255) / F (255,94,255) / H (255,198,255) mit dunklen Pupillenpixeln A, über den inneren Flügelfedern.
* Die Figur trägt keinen Metallglanz/Edelstein → kein Lichtband, kein Glitzer (Regel 14).
Bleibt fest: Mittelbalken, Herz-Augen (bewegen sich nur mit dem ganzen Wesen; keine Farbspiele in den Augen, Regel 21), Federfarben.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original. Das Wesen fliegt (Flügel, auf der Karte mit Schatten darunter) — das Schweben ist deshalb gewollt:
* Flügelschlag (Periode 12, 4× pro Schleife): beide Flügel öffnen und schließen sich spiegelbildlich, wie um den Ansatz (Herzen) gedreht: jede Zeile des Flügels wandert waagerecht um
  Abstand-zum-Ansatz · Winkel (Spitze ±3 px, die unteren Federspitzen entgegengesetzt ±1 px, Gefälle < 1 px je Zeile). Der Ansatz bleibt am Mittelbalken angewachsen (die Lücke zu den
  Herzen/dem Balken wird mit dem inneren Federpixel der Zeile geschlossen).
* Flattern der Federspitzen (Periode 16 bzw. 24 je Flügel): die untersten drei Federspitzen (Zeilen 15–19) pendeln zusätzlich 1 px.
* Schweben: das ganze Wesen hebt sich beim Flügelöffnen um 1 px und sinkt beim Schließen (Periode 12), plus langsames Auf und Ab um 1 px (Periode 48).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine festen gemalten Pixel; Lücken am Flügelansatz werden mit dem Nachbarpixel der gleichen Zeile geschlossen (siehe oben), und wo die Zeilenverschiebung eine Füllfarbe an die
Außenkante legt, wird dort ein Umrisspixel in der Umrissfarbe der Quelle ergänzt (anim_tiere.umriss_schliessen; Regel 16) — das betrifft nur Posen mit weit geöffneten/geschlossenen Flügeln.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 3, 3
PIVOT_Y = 13

spr = L.lade('cute-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
balken = vor & (yy == 7) & (xx >= 9) & (xx <= 11)
kern = vor & (yy >= 8) & (yy <= 13) & (xx >= 7) & (xx <= 13)
fl_l = vor & (xx <= 9) & ~balken & ~kern
fl_r = vor & (xx >= 11) & ~balken & ~kern


def fluegel_schieben(maske, seite, shift_fn):
    """Zeilenversatz des Flügels (seite 'l' oder 'r'); Lücke am Ansatz (Zeilen 7–13) wird mit dem inneren Pixel der Zeile gefüllt."""
    t, _ = L.trenne(spr, maske)
    out = L.leer(H, W)
    for y in range(sh):
        xs_ = np.nonzero(t[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = int(shift_fn(y))
        for x in xs_:
            out[PAD_T + y, PAD_L + x + dx] = t[y, x]
        if 7 <= y <= 13:
            xi = int(xs_.max()) if seite == 'l' else int(xs_.min())
            if seite == 'l' and dx < 0:
                for x in range(xi + dx + 1, xi + 1):
                    out[PAD_T + y, PAD_L + x] = t[y, xi]
            if seite == 'r' and dx > 0:
                for x in range(xi, xi + dx):
                    out[PAD_T + y, PAD_L + x] = t[y, xi]
    return out


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    s = math.sin(ph)
    # Schweben: beim Öffnen hebt sich das Wesen, plus langsames Auf und Ab
    dy = int(round(-0.7 * s - 0.55 * math.sin(L.sinus(i, 48))))
    sp = math.sin(L.sinus(i, 16)); sp_r = math.sin(L.sinus(i, 24))

    def schieb(seite, flat):
        sg = -1 if seite == 'l' else 1                  # außen = links bzw. rechts

        def f(y):
            d = 3.2 * s * (PIVOT_Y - y) / float(PIVOT_Y)             # Drehung um den Ansatz: oberhalb nach außen, unterhalb nach innen
            if y >= 15:
                d += 1.0 * flat * (y - 14) / 5.0
            return round(sg * d)
        return f
    wl = fluegel_schieben(fl_l, 'l', schieb('l', sp))
    wr = fluegel_schieben(fl_r, 'r', schieb('r', sp_r))
    k, _ = L.trenne(spr, kern)
    b, _ = L.trenne(spr, balken)
    ebenen = {'fl_l': wl, 'fl_r': wr, 'balken': L.platz(b, H, W, PAD_L, PAD_T), 'kern': L.platz(k, H, W, PAD_L, PAD_T)}
    wahl = nur or ('fl_l', 'fl_r', 'balken', 'kern')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)             # Randpixel-Test: wo die Zeilenverschiebung eine Füllfarbe an die Kante legt, Umrisspixel ergänzen


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-spider', 'Cute Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-spider-strip.png', frames, spalten=12, scale=8)
