# -*- coding: utf-8 -*-
"""Idle-Animation für „Brain Spider“ (Creature).

Quelle: src/brain-spider.png — Ebene „Ebene #…“ (19×49 px, 9 Farben) aus MotiveGN.xcf (Ebene 264): die an einem weißen Faden hängende schwarze Spinne mit rosa Gehirn auf dem
Rücken und zwei hellblauen Augen. Vollständig (Faden, Kopf, Gehirn, Augen, alle Beine). Die Ebene wurde per Farbsuche (Gehirn-Rosa) in allen Ebenen gefunden; der Sprite-Abgleich
(merged.json) lieferte für diese Karte nur kleine Boden-Spinnen und Laub.
PICK: [["MotiveGN", 264, "ganze Ebene"]]

Aufruf:   python3 brain_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/brain-spider.png + .json

Identifikation (Sprite 19×49, hängt KOPF NACH UNTEN am Faden, symmetrisch um x = 9):
* Faden (x = 9, Zeilen 0–31): reinweiß C (255,255,255); Zeile 32 ist ein grauer Knoten F (65,66,64) am Kopf. Im Spiel auf 9 Zeilen gekürzt (Original 32 px, ergäbe einen 49 px hohen
  schmalen Streifen); der Faden hört oben also im Bild auf.
* Kopf/Rücken (x 5–13, Zeilen 33–37): schwarzgraue Platten D (40,41,39) / F (65,66,64) / A (31,32,30).
* Gehirn (x 5–14, Zeilen 37–43): rosa Schachbrett aus G (246,117,122) hell, E (183,80,133) mittel, H (104,56,108) dunkel — in der Mitte zweigeteilt wie zwei Gehirnhälften.
* Augen (Zeilen 44–45): zwei hellblaue 2×2-Augen I (204,255,255), je mit weißem Glanzpunkt C (255,255,255) oben rechts: links (7,44) (8,44) (7,45) (8,45), rechts (10,44) (11,44) (10,45) (11,45).
* Beine: je Seite fünf Beine aus 1-px-Linien in B (0,0,0) / A / D: zwei nach oben geknickte „Kniebeine“ (L: (3,29)…(5,36); (0,31)…(4,38)), zwei nach außen unten hängende (L: (3,40)…(1,47);
  (5,41)…(4,47)) und ein kurzes Beinpaar unter den Augen ((6,46) (6,47) (7,48) bzw. (12,46) (12,47) (11,48)).
* Keine Edelsteine/Metall → kein Glanz/Glitzer (Regel 14); die weißen Augenpunkte sind Teil der Augen (Blinzeln), keine Partikel.
Bleibt fest: Kopfplatten, Musterverteilung des Gehirns (nur die Helligkeit wandert), Fadenfarbe.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original (mit gekürztem Faden):
* Abseilen: die ganze Spinne gleitet am Faden 2 px nach unten und wieder hinauf (Periode 48); der Faden wird dabei länger/kürzer (nur Fadenpixel, nichts verschoben).
* Beinpendeln: alle Beine einer Seite pendeln im Gleichtakt (Fuß ±1…2 px, Gelenke mit Gefälle ≤ 1 px), die Seiten spiegelbildlich (spreizen und schließen), dazu ein kleineres
  Eigenwippen je Bein (3 Perioden je Schleife, benachbarte Beine gegensinnig). Beine werden als Pfad neu gezeichnet (8er-Linie zwischen den Gelenken).
* Fußzucken: je Bein zieht die Fußspitze zweimal pro Schleife für 3 Frames an (1-2-1 px kürzer), reihum.
* Denkwelle: zweimal pro Schleife läuft eine Aufhellung (H→E→G, eine Rampenstufe) von oben nach unten durch das Gehirn (Zeile für Zeile, je Zeile 2 Frames), wie feuernde Nervenzellen.
* Blinzeln: beide Augen schließen sich 2× pro Schleife (erst die obere Zeile, dann beide; Lid = Gehirn-Dunkelviolett H bzw. Umrissschwarz B) für 4 Frames.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel — nur die Bein-Gelenklinien (8er-Linien zwischen verschobenen Gelenken) übernehmen die Farbe des jeweiligen Beinpixels.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_spinne as S

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 2, 5
FADEN0 = 9                     # sichtbare Fadenlänge in Frame 0 (Original: 32)
DRIFT = 2
KOERPER_OBEN = 32              # Original-Zeile der Körperoberkante (Knoten)

spr = L.lade('brain-spider')
sh, sw = spr.shape[:2]
H, W = PAD_T + FADEN0 + DRIFT + (sh - KOERPER_OBEN) + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

faden_maske = vor & (xx == 9) & (yy <= 31)
KOERPER_ZEILEN = {32: (9, 9), 33: (7, 11), 34: (6, 12), 35: (6, 12), 36: (6, 13), 37: (5, 13), 38: (4, 14), 39: (4, 14), 40: (4, 14), 41: (5, 13),
                  42: (5, 13), 43: (5, 13), 44: (6, 12), 45: (7, 11)}
koerper_maske = np.zeros_like(vor)
for y, (a, b) in KOERPER_ZEILEN.items():
    koerper_maske[y, a:b + 1] = True
koerper_maske &= vor
bein_maske = vor & ~koerper_maske & ~faden_maske
beine = S.zerlege_beine(spr, bein_maske, koerper_maske, mitte_x=9)
SCHWING = []
for k, b in enumerate(beine):
    nr = [bb for bb in beine if bb['seite'] == b['seite']].index(b)
    SCHWING.append(dict(seite=-1 if b['seite'] == 'l' else 1, alt=1 if nr % 2 == 0 else -1,
                        zuck=[(5 + 4 * k + 24 * m) % N for m in range(2)]))

ROSA_H, ROSA_E, ROSA_G = (104, 56, 108), (183, 80, 133), (246, 117, 122)
_p = np.pad(vor, 1)
rand_orig = vor & ~(_p[:-2, 1:-1] & _p[2:, 1:-1] & _p[1:-1, :-2] & _p[1:-1, 2:])           # Pixel mit 4er-Kante zum Hintergrund
hirn_maske = vor & koerper_maske & L.farbmaske(spr, [ROSA_H, ROSA_E, ROSA_G]) & (yy >= 37) & (yy <= 43) & ~rand_orig   # Umriss des Gehirns bleibt fest
AUGEN_OBEN = [(7, 44), (8, 44), (10, 44), (11, 44)]
AUGEN_UNTEN = [(7, 45), (8, 45), (10, 45), (11, 45)]
SCHWARZ = (0, 0, 0)
WELLEN = (4, 28)               # Startframes der Denkwellen


def zustand(i):
    d = int(round(DRIFT / 2.0 * (1 - math.cos(2 * math.pi * i / N))))
    wellenzeile = None
    welle = None
    for s in WELLEN:
        t = i - s
        if 0 <= t < 14:
            welle = 37 + t // 2          # Zeile 37…43, je 2 Frames
    lid = 0
    for s in (18, 38):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    return d, welle, lid


def frame(i, nur=None):
    d, welle, lid = zustand(i)
    yb = PAD_T + FADEN0 + d
    dy = yb - KOERPER_OBEN
    f = L.leer(H, W)
    for r in range(FADEN0 + d):
        f[PAD_T + r, PAD_L + 9, :3] = (255, 255, 255); f[PAD_T + r, PAD_L + 9, 3] = 255
    k, _ = L.trenne(spr, koerper_maske)
    k = L.platz(k, H, W, PAD_L, dy)
    if welle is not None:
        for y, x in zip(*np.nonzero(hirn_maske)):
            if y == welle:
                c = tuple(int(v) for v in spr[y, x, :3])
                k[y + dy, x + PAD_L, :3] = ROSA_E if c == ROSA_H else (ROSA_G if c == ROSA_E else c)
    if lid:
        for (x, y) in AUGEN_OBEN:
            k[y + dy, x + PAD_L, :3] = ROSA_H
        if lid == 2:
            for (x, y) in AUGEN_UNTEN:
                k[y + dy, x + PAD_L, :3] = SCHWARZ
    ebenen = [('faden', f), ('koerper', k)]
    bl = L.leer(H, W)
    for kk, b in enumerate(beine):
        s = SCHWING[kk]
        gross = math.sin(2 * math.pi * 2 * i / N)
        klein = math.sin(2 * math.pi * 3 * i / N)
        fl = max([(1, 2, 1)[(i - st) % N] for st in s['zuck'] if 0 <= (i - st) % N < 3] or [0])

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
    L.speichern('brain-spider', 'Brain Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/brain-spider-strip.png', frames, spalten=12, scale=8)
