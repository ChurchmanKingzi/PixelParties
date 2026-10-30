# -*- coding: utf-8 -*-
"""Idle-Animation für „Blue-Ice Dragon“ (Creature).

Quelle: src/blue-ice-dragon.png — Ebene „Blue-Ice Dragon“ (36×28 px, 34 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 blue_ice_dragon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/blue-ice-dragon.png + .json

Ablauf (24 Frames à 75 ms = 1,8 s):
* Flügelschlag: zweimal pro Schleife; Spaltenversatz wächst zur Flügelspitze hin, die Lücke zum Rumpf wird
  beim Anheben geschlossen.
* Schwebe-Bob: der Körper hebt sich beim Abschlag um 1 px.
* Kopf nickt an den Umkehrpunkten um 1 px, Schwanz schwingt mit Verzögerung, die Beine baumeln.
* Die weißen Pixel im Maul sind Zähne: sie sitzen fest am Kiefer und gehen nur mit dem Kopf mit.
* Eiswölkchen (Partikel, Farben des Drachen): Frostatem aus dem Maul, Dunst an Flügel, Schwanz und Beinen — entstehen und
  zerfallen per Dithering, Lebensdauer = Schleifenlänge (nahtlos). Sie liegen hinter dem Drachen.
* Blinzeln (Frames 17–19): beide Augen schließen sich über einen Zwischenschritt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 75
PAD_L, PAD_R, PAD_T, PAD_B = 12, 20, 12, 10

spr = L.lade('blue-ice-dragon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

fluegel = vorhanden & (xx <= 16) & (yy <= 9)
kopf = vorhanden & (xx >= 19) & (yy <= 13)                       # inkl. Zähne
schwanz = vorhanden & (xx <= 8) & (yy >= 12) & ~fluegel
beine = vorhanden & (yy >= 20) & ~schwanz & ~fluegel & ~kopf
rumpf = vorhanden & ~fluegel & ~kopf & ~schwanz & ~beine

# Augen: zwei Pixelpaare je Auge (oben Pupille/Iris, unten Glanz)
AUGEN = [(28, 6), (29, 6), (31, 6), (32, 6), (28, 7), (29, 7), (31, 7), (32, 7)]
HAUT = tuple(int(v) for v in spr[6, 30, :3])
UMRISS = tuple(int(v) for v in spr[6, 33, :3])

# Eiswölkchen: Kern = hellstes Weiß des Drachen, Rand = sein helles Eisblau
WOLKE = {'c': tuple(int(v) for v in spr[9, 32, :3]), 'r': (188, 255, 255)}
assert (188, 255, 255) in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, 'Randfarbe nicht in der Quelle'


def px(x, y):
    return PAD_L + x, PAD_T + y


PUFFS = [
    dict(x=px(34, 10)[0], y=px(34, 10)[1], vx=13, vy=4, off=0, form='m'),         # Frostatem aus dem Maul
    dict(x=px(33, 12)[0], y=px(33, 12)[1], vx=11, vy=7, off=8, form='s'),
    dict(x=px(34, 11)[0], y=px(34, 11)[1], vx=15, vy=1, off=16, form='l'),
    dict(x=px(8, 3)[0], y=px(8, 3)[1], vx=-7, vy=-8, off=4, form='m', wackeln=1),  # Dunst über dem Flügel
    dict(x=px(12, 2)[0], y=px(12, 2)[1], vx=-3, vy=-9, off=15, form='s'),
    dict(x=px(2, 16)[0], y=px(2, 16)[1], vx=-10, vy=3, off=10, form='m', wackeln=1),  # am Schwanz
    dict(x=px(4, 19)[0], y=px(4, 19)[1], vx=-7, vy=6, off=21, form='s'),
    dict(x=px(13, 27)[0], y=px(13, 27)[1], vx=-3, vy=7, off=2, form='m'),         # kalte Luft unter den Beinen
    dict(x=px(11, 26)[0], y=px(11, 26)[1], vx=3, vy=7, off=14, form='s'),
    dict(x=px(21, 11)[0], y=px(21, 11)[1], vx=3, vy=-9, off=19, form='k'),        # Funken über dem Nacken
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                           # sofort auf die volle Leinwand


def frame(i):
    ph = L.sinus(i, N / 2)
    dy_koerper = int(round(-math.sin(ph)))
    rest = rumpf | beine | schwanz | kopf
    fl = L.spalten_welle(teil(fluegel), PAD_L + 16, 3.4, ph, bias=0.8, fuell=L.platz(rest.astype(np.uint8)[..., None].repeat(4, 2) * 255, H, W, PAD_L, PAD_T)[..., 3] > 0)
    kp = L.versetze(teil(kopf), 0, int(round(0.6 * math.sin(ph - 0.9))))
    sz = L.spalten_welle(teil(schwanz), PAD_L + 9, 2.3, ph - 1.3)
    bn = L.zeilen_welle(teil(beine), PAD_T + 19, 1.1, L.sinus(i, N / 2, 0.8))
    rp = teil(rumpf)
    # Blinzeln
    if i in (17, 19) or i == 18:
        for (x, y) in AUGEN[:4]:
            kp[PAD_T + y + int(round(0.6 * math.sin(ph - 0.9))), PAD_L + x, :3] = HAUT
    if i == 18:
        for (x, y) in AUGEN[4:]:
            kp[PAD_T + y + int(round(0.6 * math.sin(ph - 0.9))), PAD_L + x, :3] = UMRISS
    wolken = L.puff_ebene(H, W, i, N, PUFFS, WOLKE)
    return L.zusammen(H, W, [(wolken, 0, 0), (bn, 0, dy_koerper), (sz, 0, dy_koerper), (rp, 0, dy_koerper),
                             (kp, 0, dy_koerper), (fl, 0, dy_koerper)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('blue-ice-dragon', 'Blue-Ice Dragon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/blue-ice-dragon-strip.png', [frames[k] for k in (0, 4, 8, 12, 16, 20)], spalten=3, scale=7)
