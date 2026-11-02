# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Hydra“ (Creature).

Quelle: src/cute-hydra.png — Ebene „Cute Hydra“ (48×44 px, 25 Farben) aus MotiveMoe.xcf (Ebene 195): die dreiköpfige, violette Hydra mit silbernen Flügeln, Zackenkronen und rosa Herz-Augen.
Vollständig (alle drei Köpfe, beide Flügel, Rumpf, Beine), ein Exemplar, kein Beiwerk. Die Karte zeigt sie vor blauem Himmel; der Sprite ist die eine Ebene.
PICK: [["MotiveMoe", 195, "ganze Ebene"]]

Aufruf:   python3 cute_hydra.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-hydra.png + .json

Identifikation (Sprite 48×44, symmetrisch um x = 23,5):
* Mittelkopf (x 19–29, Zeilen 0–19): große olivbraune Zackenkrone M (54,54,0) / P (54,42,0) / Q (72,72,0) / S (38,27,0) mit Umriss F (12,9,0) (Zeilen 0–10), violettes Gesicht aus D (64,40,119) / I (86,54,160) /
  E (37,20,76) im Rautenmuster, schwarzviolette Konturen A (14,8,29); zwei rosa Herz-Augen R (255,40,255) / T (213,40,213) / X (255,136,255): links (20–22,12–13), rechts (25–27,12–13).
* Seitenköpfe (links x 5–15, rechts x 32–42, Zeilen 5–23): je zwei kleinere Zackenkronen (links bei x 8–11 und 13–16, rechts spiegelbildlich) und je zwei Herz-Augen: links (6–8,17–19) und (12–14,17–19), rechts (33–35,17–19)
  und (39–41,17–19).
* Flügel (links x 0–15, rechts x 32–47): silbern H (214,227,230) / G (126,137,150) mit stahlblauem Umriss B (38,52,72); je ein hoher Außenstreifen (x 0–6, Zeilen 6–23) und ein breites unteres Federband (x 4–15, Zeilen 24–30).
* Rumpf (x 16–31, Zeilen 14–43): schwarzviolett C (22,12,45) / N / K, mit hellen Bauchplatten J (102,84,142) / L (129,111,169) (x 21–26, Zeilen 22–37) und O/U/V/W-Schatten.
* Beine (Zeilen 38–43): links x 15–20, rechts x 27–32, krallenartige dunkle Streifen, enden unten bei (14–18,43) bzw. (29–33,43).
* Weiße/silberne Pixel gehören zu den Flügeln (Federn), keine Partikel; Krone nur olivfarbener Stoff/Horn → kein Glanz, kein Glitzer (Regel 14).
Bleibt fest: Mittelkopf (er atmet nur mit dem Oberkörper), Rumpfmuster, Krallenansatz, Herzfarben.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Flügelschlag (Periode 16, 3× pro Schleife): jede Spalte der beiden Silberflügel wandert senkrecht, je weiter vom Körper desto mehr (Außenspitze ±3 px, am Ansatz 0); beide Flügel gegengleich/spiegelbildlich.
  Die Flügel liegen hinter den Köpfen; ihre Außenkante wird danach mit dem Stahlblau-Umriss nachgezogen (anim_tiere.umriss_schliessen, Regel 16).
* Kopfwiegen: die beiden Seitenköpfe heben und senken sich gegenläufig starr um 1 px (Perioden 24 bzw. 16; Spaltenverschiebung wäre an den kleinen Herz-Augen zerrissen — daher starr); der Mittelkopf nickt
  zweimal pro Schleife (Frames 18–26 und 42–47) 1 px nach unten (nach oben ginge am Hals eine Lücke auf). Naht-Umrisspixel werden mit anim_tiere.umriss_schliessen ergänzt.
* Atmen (2× pro Schleife, Frames 4–17 und 28–41): der Oberkörper samt Köpfen und Flügeln hebt sich um 1 px (Zeile 32 des Rumpfes wird mit Texturmischung dupliziert, anim_lib.streck_zeile), die Beine
  bleiben am Boden.
* Krallenwiegen (Periode 12): die Zehenpartien der vier Beine (Zeilen 38–43) pendeln gegengleich seitlich (Fuß ±2 px, Gefälle < 1 px je Zeile).
* Blinzeln: jeder Kopf blinzelt für sich (Mitte Frames 14–16 und 38–40, links 6–8 und 30–32, rechts 22–24 und 44–46): die Herzpixel werden für 3 Frames zur Gesichtsfarbe D (64,40,119) (kein Farbspiel).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: nur Umrisspixel in Quellfarben, wo die Spaltenverschiebung der Flügel/Seitenköpfe eine Füllfarbe an die Außenkante legt (anim_tiere.umriss_schliessen); sonst nichts gemalt.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 5, 3

spr = L.lade('cute-hydra')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

FLUEGEL_FARBEN = [(38, 52, 72), (126, 137, 150), (214, 227, 230)]
fluegel = vor & L.farbmaske(spr, FLUEGEL_FARBEN)
fl_l = fluegel & (xx <= 23)
fl_r = fluegel & (xx >= 24)
rest = vor & ~fluegel
bein_l = rest & (yy >= 38) & (xx <= 20)
bein_r = rest & (yy >= 38) & (xx >= 27)
kopf_l = rest & ~bein_l & ~bein_r & (yy <= 23) & (xx <= 15)
kopf_r = rest & ~bein_l & ~bein_r & (yy <= 23) & (xx >= 32)
kopf_m = rest & (xx >= 19) & (xx <= 28) & (yy <= 18)
kern = rest & ~bein_l & ~bein_r & ~kopf_l & ~kopf_r & ~kopf_m
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HERZ = [(255, 40, 255), (213, 40, 213), (255, 136, 255)]
herz_maske = vor & L.farbmaske(spr, HERZ)
AUGEN = {'m': herz_maske & (xx >= 19) & (xx <= 28) & (yy <= 14),
         'l': herz_maske & (xx <= 16) & (yy >= 16), 'r': herz_maske & (xx >= 31) & (yy >= 16)}
GESICHT = (64, 40, 119)
BLINK = {'m': (14, 38), 'l': (6, 30), 'r': (22, 44)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def lid(i):
    out = set()
    for key, starts in BLINK.items():
        if any(0 <= i - s < 3 for s in starts):
            out.add(key)
    return out


def frame(i, nur=None):
    ph_f = L.sinus(i, 16)
    s = math.sin(ph_f)
    schliessen = lid(i)
    k = teil(kern)
    km = teil(kopf_m)
    kl = teil(kopf_l); kr = teil(kopf_r)
    for key, e in (('m', km), ('l', kl), ('r', kr)):
        if key in schliessen:
            for y, x in zip(*np.nonzero(AUGEN[key])):
                e[PAD_T + y, PAD_L + x, :3] = GESICHT
    # Kopfwiegen: die Seitenköpfe heben/senken sich starr um 1 px (gegenläufig), der Mittelkopf nickt 1 px nach unten
    dl = int(round(math.sin(L.sinus(i, 24))))
    dr = int(round(math.sin(L.sinus(i, 16, math.pi))))
    dm = 1 if (18 <= i < 27 or 42 <= i < 48) else 0
    # Flügel (Außenspitze ±3 px)
    wl = T.biegen_spalten(teil(fl_l), PAD_L + 16, 3.0, ph_f, potenz=1.2)
    wr = T.biegen_spalten(teil(fl_r), PAD_L + 31, 3.0, ph_f, potenz=1.2)
    # Krallen
    bl = L.zeilen_welle(teil(bein_l), PAD_T + 37, 1.8, L.sinus(i, 12))
    br = L.zeilen_welle(teil(bein_r), PAD_T + 37, 1.8, L.sinus(i, 12, math.pi))
    ebenen = {'fl_l': (wl, 0), 'fl_r': (wr, 0), 'kern': (k, 0), 'kopf_m': (km, dm), 'kopf_l': (kl, dl), 'kopf_r': (kr, dr), 'bein_l': (bl, 0), 'bein_r': (br, 0)}
    wahl = nur or list(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)
    n1 = 1 if (4 <= i < 18 or 28 <= i < 42) else 0
    if n1:
        ganz = L.streck_zeile(ganz, PAD_T + 32, n1)
    return ganz


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-hydra', 'Cute Hydra', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-hydra-strip.png', frames, spalten=8, scale=4)
