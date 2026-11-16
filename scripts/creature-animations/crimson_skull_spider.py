# -*- coding: utf-8 -*-
"""Idle-Animation für „Crimson Skull Spider“ (Creature).

Quelle: src/crimson-skull-spider.png — Ebene „Ebene #…“ (19×37 px, 10 Farben) aus MotiveGN.xcf (Ebene 272): die an einem roten Faden hängende schwarze Spinne mit
rotem Totenkopfmuster auf dem Hinterleib. Vollständig (Faden, Hinterleib, Kopf mit Augen, alle Beine) — die Ebene wurde per Farbsuche in allen Ebenen gefunden, weil der
Sprite-Abgleich (merged.json) nur die kleinen Boden-Spinnen derselben Karte lieferte.
PICK: [["MotiveGN", 272, "ganze Ebene"]]

Aufruf:   python3 crimson_skull_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/crimson-skull-spider.png + .json

Identifikation (Sprite 19×37, Spinne hängt KOPF NACH UNTEN am Faden, symmetrisch um x = 9):
* Faden (x = 9, Zeilen 0–20): zwei Rottöne im Wechsel D (108,1,0) / E (156,1,0) — Schachbrett-Dithering des Fadens. Im Spiel wird er auf 9 Zeilen gekürzt (die Original-
  länge von 21 px ergäbe einen 49 px hohen, schmalen Streifen); der Faden hört oben also im Bild auf.
* Hinterleib (x 4–14, Zeilen 21–30): schwarzgrau A (31,32,30) / B (40,41,39) / F (65,66,64) (Glanzstelle rechts oben), mit dem Totenkopf-Muster aus dunkleren/helleren Rotpixeln
  G (71,1,0) / D (108,1,0) / E (156,1,0) / H (173,1,0) / J (255,1,0) in den Zeilen 24–28.
* Kopf (x 7–11, Zeilen 31–33): dunkel, mit zwei Augen unten: links H (173,1,0) bei (7,32) + (8,33), rechts I (255,2,0) bei (11,32) + (10,33).
* Beine: je Seite vier lange Beine (spiegelbildlich um x = 9) aus 1-px-Linien in C (0,0,0) / A / B: zwei nach oben geknickte „Kniebeine“ (L: (3,17)…(3,22); (0,21)…(3,26)),
  zwei nach unten hängende (L: (3,28)…(1,35); (4,30)…(4,35)); dazu unter dem Kopf je ein kurzes Beinpaar ((7,34) (7,35) (8,36) bzw. (11,34) (11,35) (10,36)).
* Keine Edelsteine/Metall → kein Glanz, kein Glitzer (Regel 14).
Bleibt fest: Muster der Zeichnung, Kopf/Hinterleib (außer Auf/Ab am Faden), Fadenfarben.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original (mit gekürztem Faden):
* Abseilen: die ganze Spinne gleitet am Faden 2 px nach unten und wieder hinauf (Periode 48), der Faden wird dabei im Farbwechsel länger/kürzer (nur Fadenpixel, nichts verschoben).
* Beinpendeln: jedes der Beine pendelt für sich seitlich (Fuß ±2 px, Gelenke mit Gefälle ≤ 1 px; jedes Bein 2- oder 3-mal pro Schleife, die Seiten gegenläufig, benachbarte
  Beine gegenphasig = Krabbelgang auf der Stelle). Die Beine werden als Pfad neu gezeichnet (8er-Linie zwischen den Gelenken), nie als Spalten-/Zeilenkopie.
* Fußzucken: je Bein knickt die Fußspitze zweimal pro Schleife für 3 Frames ab (reihum).
* Totenkopf-Pulsschlag: das rote Muster hellt sich zweimal pro Schleife kurz um eine Stufe der eigenen Rampe auf (G→D→E→H→J), wie ein Herzschlag (nur Rotstufen des Sprites).
* Blinzeln: beide Augen schließen sich 2× pro Schleife für 2 Frames (Lid = Körperfarbe A).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel — nur die Bein-Gelenklinien (8er-Linien zwischen verschobenen Gelenken) übernehmen die Farbe des jeweiligen Beinpixels.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_spinne as S

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 3
FADEN0 = 9                     # sichtbare Fadenlänge in Frame 0 (Original: 21)
DRIFT = 2                      # so weit gleitet die Spinne am Faden nach unten

spr = L.lade('crimson-skull-spider')
sh, sw = spr.shape[:2]
H, W = PAD_T + FADEN0 + DRIFT + (sh - 21) + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

FADEN = [(108, 1, 0), (156, 1, 0)]
faden_maske = vor & (xx == 9) & (yy <= 20)
KOERPER_ZEILEN = {21: (7, 11), 22: (6, 12), 23: (4, 14), 24: (4, 14), 25: (4, 14), 26: (4, 14), 27: (5, 13), 28: (4, 14), 29: (6, 12),
                  30: (5, 13), 31: (7, 11), 32: (7, 11), 33: (8, 10)}
koerper_maske = np.zeros_like(vor)
for y, (a, b) in KOERPER_ZEILEN.items():
    koerper_maske[y, a:b + 1] = True
koerper_maske &= vor
bein_maske = vor & ~koerper_maske & ~faden_maske
beine = S.zerlege_beine(spr, bein_maske, koerper_maske, mitte_x=9)
# Pendel-Eigenschaften je Bein: alle Beine einer Seite pendeln im Gleichtakt (keine Überschneidungen), die Seiten spiegelbildlich (spreizen/schließen);
# dazu ein kleineres, eigenes Wippen je Bein (3 Perioden je Schleife, benachbarte Beine gegensinnig) und das Fußzucken reihum.
SCHWING = []
for k, b in enumerate(beine):
    nr = [bb for bb in beine if bb['seite'] == b['seite']].index(b)
    SCHWING.append(dict(seite=-1 if b['seite'] == 'l' else 1, alt=1 if nr % 2 == 0 else -1,
                        zuck=[(5 + 4 * k + 24 * m) % N for m in range(2)]))

# Totenkopf: Rampe und Pixel
RAMPE = [(71, 1, 0), (108, 1, 0), (156, 1, 0), (173, 1, 0), (255, 1, 0)]
rot_maske = vor & koerper_maske & L.farbmaske(spr, [(71, 1, 0), (108, 1, 0), (156, 1, 0), (173, 1, 0), (255, 1, 0)]) & (yy >= 24) & (yy <= 28)
AUGEN = [(7, 32), (8, 33), (11, 32), (10, 33)]
LID = (31, 32, 30)


def zustand(i):
    d = int(round(DRIFT / 2.0 * (1 - math.cos(2 * math.pi * i / N))))
    puls = 0
    for s in (8, 29):
        if 0 <= i - s < 5:
            puls = (1, 1, 1, 1, 0)[i - s]
    lid = any(0 <= i - s < 2 for s in (18, 38))
    return d, puls, lid


def frame(i, nur=None):
    d, puls, lid = zustand(i)
    yb = PAD_T + FADEN0 + d                  # Zeile der Körperoberkante (Original-Zeile 21)
    dy = yb - 21
    f = L.leer(H, W)
    # Faden
    for r in range(FADEN0 + d):
        f[PAD_T + r, PAD_L + 9, :3] = FADEN[r % 2]; f[PAD_T + r, PAD_L + 9, 3] = 255
    # Körper
    k, _ = L.trenne(spr, koerper_maske)
    k = L.platz(k, H, W, PAD_L, dy)
    if puls:
        for y, x in zip(*np.nonzero(rot_maske)):
            c = tuple(int(v) for v in spr[y, x, :3])
            if c in RAMPE and RAMPE.index(c) < len(RAMPE) - 1 and c != (255, 1, 0):
                k[y + dy, x + PAD_L, :3] = RAMPE[RAMPE.index(c) + 1]
    if lid:
        for (x, y) in AUGEN:
            k[y + dy, x + PAD_L, :3] = LID
    ebenen = [('faden', f), ('koerper', k)]
    # Beine
    bl = L.leer(H, W)
    for kk, b in enumerate(beine):
        s = SCHWING[kk]
        gross = math.sin(2 * math.pi * 2 * i / N)
        klein = math.sin(2 * math.pi * 3 * i / N)
        fl = max([(1, 2, 1)[(i - st) % N] for st in s['zuck'] if 0 <= (i - st) % N < 3] or [0])      # Fuß zieht an: 1-2-1 px kürzer

        def wirk(n, s=s, gross=gross, klein=klein):
            dx = n['anteil'] * (1.4 * gross * s['seite'] + 0.7 * klein * s['alt'])
            return round(dx), 0
        S.zeichne_bein(bl, b, wirk, PAD_L, dy, kuerzen=fl)
    ebenen.append(('beine', bl))
    wahl = nur or [n for n, _ in ebenen]
    return L.zusammen(H, W, [(e, 0, 0) for n, e in ebenen if n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('crimson-skull-spider', 'Crimson Skull Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/crimson-skull-spider-strip.png', frames, spalten=12, scale=8)
