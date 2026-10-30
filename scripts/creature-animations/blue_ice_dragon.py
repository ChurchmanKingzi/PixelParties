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
* Kalte Luft (Partikel, Farben des Drachen): runde Dunstwölkchen steigen langsam rund um den Körper auf (auch vom Maul), mit
  leichtem Wabern; entstehen und zerfallen per Dithering, Lebensdauer = Schleifenlänge (nahtlos). Sie liegen hinter dem Drachen.
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


# Kalte Luft: runde Dunstwölkchen steigen langsam auf (≈ 11–15 px pro Schleife, leichtes Wabern), aus verschiedenen Höhen rund um
# den Körper; Phasen gleichmäßig über die Schleife verteilt. Kein radiales Wegfliegen, keine Kreuzformen.
START = [(2, 26), (9, 29), (15, 27), (22, 30), (28, 25), (34, 28), (-3, 22), (6, 31), (19, 29), (26, 24), (38, 26), (12, 30)]
FORMEN = ['m', 'o', 's', 'l', 'm', 'o', 'm', 's', 'o', 'l', 'm', 's']
PUFFS = [dict(x=px(x0, y0)[0], y=px(x0, y0)[1], vx=(2 if k % 2 else -2), vy=-(11 + (k * 5) % 5), off=2 * k, form=FORMEN[k], wackeln=1)
         for k, (x0, y0) in enumerate(START)]
PUFFS += [dict(x=px(35, 11)[0], y=px(35, 11)[1], vx=3, vy=-7, off=5, form='s', wackeln=1),      # Atem am Maul steigt ebenfalls auf
          dict(x=px(35, 12)[0], y=px(35, 12)[1], vx=2, vy=-6, off=17, form='o', wackeln=1)]


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
