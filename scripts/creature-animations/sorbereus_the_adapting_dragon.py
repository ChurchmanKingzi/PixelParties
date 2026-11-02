# -*- coding: utf-8 -*-
"""Idle-Animation für „Sorbereus, the Adapting Dragon“ (Creature) — Regeln 14/16/17–31 (Haut, Schuppen, Krallen: kein Glanz; die zwei rosa Pixel sind klein, bleiben fest).

PICK: [["MotiveMoe", 304, 1]]   (Ebene „Sorbereus“, Figur 1 — einzige Ebene mit der Figur; die Ebenen 135 „Ebene #141“ und 296 „Ebene #363“, die die Suche ebenfalls meldete, sind blaue Wasserstücke bzw.
schmale Streifen anderer Kunst, nicht Teil des Drachen; die Kartenkunst zeigt dieselbe Figur pixelgleich)
Quelle: src/sorbereus-the-adapting-dragon.png — weiß-grüner Flugdrache von vorn (45×21 px, 14 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 sorbereus_the_adapting_dragon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sorbereus-the-adapting-dragon.png + .json

Identifikation (x, y im Sprite, Achse x = 21):
* Flügel (links x 0–16, rechts x 25/26–44, y 2–12): Fledermausflügel nach außen gespannt; Haut weiß/hellgrau (B (231,232,234), C (196,199,204)), grüne Randstreifen (D/E/G/H), weiße Lichter (F (255,255,255)) an der
  Oberkante bei (10–14, 4–5) und (33–36, 4–6); dunkler Umriss A (77,79,90); außen am Flügelende je eine Kralle (weiße Pixel F bei (9,10) bzw. (35,10)) — Krallen, KEINE Partikel.
* Kopf (x 17–25, y 0–13): zwei lange, spitze Ohren/Hörner (links x 18–20, y 0–3, rechts x 22–24, y 0–3; Kern grau/weiß), Gesicht weiß mit grünen Wangen (H (141,194,127)/I/J), zwei Augen (links (19,7)(19,8),
  rechts (21,7)(21,8); K (86,104,91) / L (75,88,82)), Kinn/Hals grün (D/E/G, x 18–22, y 9–13).
* zwei rosa Pixel (21,13) und (20,14) (N (207,152,198)) an der Brust — kleiner Edelstein/Zunge, bleibt fest (nicht eindeutig).
* Füße (x 16–25, y 14–17): zwei Füße mit je einer weißen Kralle (links (17,15)(17,16)? C, rechts (24,14)(24,15)(25,16) F).
* Schwanz (x 26–35, y 12–20): schmaler Schwanz schräg nach rechts unten, endet in einem grünen Blatt (E/G/D, x 29–33, y 16–19).
Bleibt fest: Gesicht (außer Blinzeln), Ohren (außer Zucken), die Flügellichter (bewegen sich nur mit dem Flügel), Krallenpixel, rosa Pixel.

Ablauf (48 Frames à 70 ms = 3,36 s), alle Bewegungen unabhängig:
* Flügelschlag: viermal pro Schleife (Periode 12); beide Flügel schlagen gleichzeitig; Versatz wächst mit dem Abstand zum Körper (Spitze hebt sich bis 4 px, senkt sich bis 3 px), die Spitze hinkt nach
  (D.fluegel_asym, Spalten bleiben ganz, Zusammenhang erzwungen, Ruhepose = Frame 0). Die vier Krallenfinger am unteren Flügelrand (x 0–4, 5–10 bzw. 34–39, 40–44) schlagen je als Gruppe
  (alle Spalten einer Gruppe bekommen denselben Versatz), damit sie nie vom Flügel abreißen.
* Schwebe-Bob: der Körper steigt beim Abschlag bis 1 px (hinkt dem Flügel 0,6 rad hinterher); Füße und Schwanz hinken dem Körper nach (zweistufig, Füße baumeln mit Gefälle ≤ 1 px je Zeile).
* Schwanz schwingt: das Blatt am Ende schwingt senkrecht (Spalten wandern mit wachsendem Abstand zum Ansatz, bis ±2 px, Gefälle ≤ 1 px je Spalte), Periode 16 (3× pro Schleife).
* Ohren zucken: je ein Ohr kippt kurz mit der Spitze 1 px nach außen und zurück (links Frames 6–11, rechts Frames 30–35).
* Blinzeln (Frames 20–23 und 44–47): beide Augen schließen sich (Lid in Gesichtsweiß, halb → zu → zu → halb).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine Pixel erfunden; Randpixel-Korrektur (Regel 16): fehlende Umrisspixel an verschobenen Flügel-/Ohr-/Fußkanten werden in der Umrissfarbe des Originals ergänzt
(anim_tiere.umriss_schliessen), Teile, die nur über eine Ecke hängen, werden mit Brückenpixeln 4-verbunden (anim_amorph.verbinde4).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_amorph as A
import anim_drache as D

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 9, 9

spr = L.lade('sorbereus-the-adapting-dragon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

fl_l = vorhanden & (xx <= 16)
fl_r = vorhanden & (((xx >= 26) & (yy <= 11)) | ((xx == 25) & (yy >= 9) & (yy <= 11)) | ((xx >= 34) & (yy <= 13)))
schwanz_m = vorhanden & (xx >= 26) & (yy >= 12) & ~fl_r
fuss_l = vorhanden & (xx >= 17) & (xx <= 21) & (yy >= 14)
fuss_r = vorhanden & (xx >= 22) & (xx <= 25) & (yy >= 14)
ohr_l = vorhanden & (xx >= 18) & (xx <= 20) & (yy <= 3)
ohr_r = vorhanden & (xx >= 22) & (xx <= 24) & (yy <= 3)
koerper = vorhanden & ~fl_l & ~fl_r & ~schwanz_m & ~fuss_l & ~fuss_r & ~ohr_l & ~ohr_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
WEISS = (231, 232, 234)
AUGEN = [(19, 7), (21, 7), (19, 8), (21, 8)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    ph = L.sinus(i, N / 4)
    bob = -int(round(0.7 * (math.sin(ph - 0.6) + math.sin(0.6))))
    nach = -int(round(0.7 * (math.sin(ph - 1.5) + math.sin(1.5))))          # Füße/Schwanz hinken nach
    bl = 0
    for s in (20, 44):
        bl = max(bl, D.blinzeln(i, s))
    ohr_a = 1 if 6 <= i < 12 else 0
    ohr_b = 1 if 30 <= i < 36 else 0
    return ph, bob, nach, bl, ohr_a, ohr_b


def frame(i, nur=None):
    ph, bob, nach, bl, oa, ob = zustand(i)
    k = teil(koerper)
    if bl:
        for (x, y) in AUGEN:
            if bl == 2 or y == 8:
                k[PAD_T + y, PAD_L + x, :3] = WEISS
    wl, _ = D.fluegel_asym(teil(fl_l), PAD_L + 17, ph, 4.0, 3.0, lauf=0.7, nur_rechts=False, gruppen=[(PAD_L + 0, PAD_L + 4), (PAD_L + 5, PAD_L + 10)])
    wr, _ = D.fluegel_asym(teil(fl_r), PAD_L + 25, ph, 4.0, 3.0, lauf=0.7, nur_rechts=True, gruppen=[(PAD_L + 34, PAD_L + 39), (PAD_L + 40, PAD_L + 44)])
    sz = D.schwanz_biegen(teil(schwanz_m), PAD_L + 26, 2.0, L.sinus(i, N / 3), lauf=1.2, richtung=1)
    fa = L.zeilen_welle(teil(fuss_l), PAD_T + 15, 1.3, L.sinus(i, N / 4, 0.3))
    fb = L.zeilen_welle(teil(fuss_r), PAD_T + 15, 1.3, L.sinus(i, N / 4, 0.3 + math.pi))
    oal = T.zucken_zeilen(teil(ohr_l), PAD_T + 2, -oa, anteile={PAD_T: 1.0, PAD_T + 1: 0.0})
    oar = T.zucken_zeilen(teil(ohr_r), PAD_T + 2, ob, anteile={PAD_T: 1.0, PAD_T + 1: 0.0})
    ebenen = {'schwanz': (sz, nach), 'fuss_l': (fa, nach), 'fuss_r': (fb, nach), 'koerper': (k, bob), 'ohr_l': (oal, bob), 'ohr_r': (oar, bob),
              'fluegel_l': (wl, bob), 'fluegel_r': (wr, bob)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    ganz, _ = A.verbinde4(ganz)
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('sorbereus-the-adapting-dragon', 'Sorbereus, the Adapting Dragon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sorbereus-the-adapting-dragon-strip.png', frames, spalten=12, scale=3)
