# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Cat“ (Creature).

Quelle: src/cute-cat.png — die geflügelte Katze (23×13 px, 15 Farben) aus MotiveMoe.xcf,
Ebene 329 („Trial of Annoyance“), Figur 1; gefunden mit creature_scan.py.

Aufruf:   python3 cute_cat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-cat.png + .json

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht, je weiter vom Körper, desto mehr
  (Spitze ca. −1 … +3 px) — links und rechts gleichzeitig. Die Flügel liegen wie im Original vor dem Körper.
* Körper schaukelt gegenläufig (Abschlag → Katze hebt sich um 1 px).
* Hinterkörper ergänzt: Im Ausgangs-Sprite verdeckt der linke Flügel Hüfte, Hinterbein und Wangenumriss; diese
  Pixel sind fertiggezeichnet (ERGAENZUNG), damit die Katze auch bei hochgeschlagenem Flügel vollständig ist.
* Schwanzspitze (links unten): Im Original fehlen der Umriss oben (3,7) und rechts (4,8) der weißen Spitze, weil dort der
  Flügel liegt — fertiggezeichnet (SCHWANZ_ERG), sonst wirkt die Spitze bei hochgeschlagenem Flügel abgeschnitten.
  Die Spitze (Zeilen 7–8) wedelt um 1 px; der Ansatz an der Hüfte bleibt stehen.
* Blinzeln (Frames 15–17): die grünen Augenpixel schließen sich über zwei Zwischenstufen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

GRAU = [(63, 62, 64), (163, 161, 166), (196, 201, 204), (132, 130, 134)]
AUGE_OBEN, AUGE_UNTEN = (41, 123, 0), (24, 65, 0)
WEISS, UMRISS = (255, 246, 255), (57, 8, 32)
FELL, SCHATTEN = (238, 213, 255), (197, 156, 246)

spr = L.lade('cute-cat')                                    # Original: Flügel liegen über dem Körper
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
xs = np.arange(sw)[None, :]

fluegel = L.farbmaske(spr, GRAU)
links = fluegel & (xs <= 9)
rechts = fluegel & (xs >= 16)
rest = L.deckend(spr) & ~fluegel
schwanz = rest & (xs <= 5)
koerper = rest & ~schwanz

# Im Ausgangs-Sprite liegt der linke Flügel über Hüfte, Hinterbein und Wange: dort fehlen Körperpixel, sobald der
# Flügel wegschwingt. Fertiggezeichnet (nur Farben der Quelle; Fell lila-weiß, Umriss kastanienbraun).
# Rechts ist der Körper durch seine Umrisslinie (x 15/16) schon geschlossen.
ERGAENZUNG = {
    (8, 8): UMRISS, (9, 8): UMRISS,                         # Rücken-/Hüftkontur, setzt den Umriss (10,8) nach links fort
    (7, 9): UMRISS, (8, 9): FELL, (9, 9): WEISS,            # Hüfte
    (7, 10): SCHATTEN, (8, 10): FELL, (9, 10): FELL,        # Oberschenkel (Umriss (6,10) steht schon)
    (5, 10): UMRISS,                                        # schließt den Schwanz (3–4, 8–9) an die Hüfte an
    (9, 5): UMRISS, (9, 6): UMRISS,                         # Wangenumriss links (Gegenstück zu (17,6))
}
SCHWANZ_ERG = {(3, 7): UMRISS, (4, 8): UMRISS}              # Umriss um die weiße Schwanzspitze (3,8)
spr_k = spr.copy()                                          # Körper-Kopie mit Ergänzungen; die Flügel bleiben unverändert
koerper_k = koerper.copy()
for (ex, ey), c in ERGAENZUNG.items():
    spr_k[ey, ex, :3] = c
    spr_k[ey, ex, 3] = 255
    koerper_k[ey, ex] = True
spr_t = spr.copy()                                          # Schwanz-Kopie mit fertigem Spitzenumriss
schwanz_k = schwanz.copy()
for (ex, ey), c in SCHWANZ_ERG.items():
    spr_t[ey, ex, :3] = c
    spr_t[ey, ex, 3] = 255
    schwanz_k[ey, ex] = True
spitze = schwanz_k & (np.arange(sh)[:, None] <= 8)           # Zeilen 7–8: Spitze (wedelt), Zeile 9: Ansatz (steht)


def teil(quelle, maske):
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def frame(i):
    ph = L.sinus(i, N / 2)                                  # zwei Schläge pro Schleife
    fl = L.spalten_welle(teil(spr, links), PAD_L + 9.5, 2.2, ph, bias=0.8)
    fr = L.spalten_welle(teil(spr, rechts), PAD_L + 16.5, 2.2, ph, bias=0.8)
    kp = teil(spr_k, koerper_k)
    sz_spitze = L.versetze(teil(spr_t, spitze), int(round(math.sin(L.sinus(i, N)))), 0)
    sz_ansatz = teil(spr_t, schwanz_k & ~spitze)
    # Blinzeln
    if i in (15, 17):
        kp = L.tausche(kp, {AUGE_OBEN: WEISS})                  # halb zu
    if i == 16:
        kp = L.tausche(kp, {AUGE_OBEN: WEISS, AUGE_UNTEN: UMRISS})   # ganz zu
    koerper_dy = int(round(-0.8 * math.sin(ph)))
    # Reihenfolge: Schwanz, Körper, dann die Flügel obenauf (wie im Original)
    return L.zusammen(H, W, [(sz_ansatz, 0, koerper_dy), (sz_spitze, 0, koerper_dy), (kp, 0, koerper_dy), (fl, 0, 0), (fr, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-cat', 'Cute Cat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-cat-strip.png', frames)
