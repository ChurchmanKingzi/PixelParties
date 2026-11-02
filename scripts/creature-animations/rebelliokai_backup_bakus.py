# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Backup Bakus“ (Creature) — das kleine grüne Baku mit den gefiederten Fächer-Ohren.

Quelle: src/rebelliokai-backup-bakus.png (20×20 px, 15 Farben).
PICK: [["MotiveJapan", 30, 1]]      (Ebene „Backup Bakus“, Figur 1 = das mittlere der drei Bakus der Karte; Ebene 135 „Ebene #124“ enthält dasselbe Baku sauber, Ebene 136 nur seine linke Hälfte —
Figur 1 ist links/rechts symmetrisch. Die beiden äußeren Bakus (Figur 2/3) sind weitgehend dieselbe Zeichnung. Die Knochen/Blut-Ebene unter den Bakus gehört nicht zur Figur.)
Quelle vollständig: ja (komplette Figur samt Füßen, nichts verdeckt).

Aufruf:   python3 rebelliokai_backup_bakus.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-backup-bakus.png + .json

Was im Sprite ist (x, y im 20×20-Sprite):
* FÄCHER-OHREN (x 0–6 links, 13–19 rechts, y 0–10): je ein grüner Blattfächer mit drei grauvioletten Federrippen (147,146,180)/(89,84,107)/(70,59,73) und dunkelblauem Umriss (23,24,42):
  eine obere Rippe (x 2–5, y 0–2), eine mittlere (x 0–4, y 3–5), eine untere (x 2–5, y 8–10). Der grüne Blattgrund sitzt am Kopf (x 5–8, y 2–9).
* KOPF (x 6–13, y 5–10): mittelgrüne Stirn; AUGEN: je ein dreipixeliger dunkler Winkel (23,12,0) mit dunkelblauem Pixel (6,66,102) bei (8,8)(7,9)(8,9) und (11,8)(12,9)(11,9).
* CYANFARBENE PIXEL (7,10)(7,11) und (12,10)(12,11) direkt unter den Augen, je hell (170,255,255) über (0,255,255). Ich lese sie als Glanz-/Tränenstrich und lasse sie bewusst FEST (Regel 1/21: nichts raten).
* STOSSZÄHNE/ZÄHNE: je zwei cremefarbene Pixel (218,207,179)/(243,241,220) bei (7,13)(7,14) und (12,13)(12,14) — fest.
* RÜSSEL/SCHNAUZE (x 8–11, y 10–17): grün schattierte Mittelbahn (95,142,100)/(120,160,126)/(78,118,91), fest.
* KÖRPER (x 5–14, y 11–19) dunkelgrün mit dunklem Umriss (28,34,20); zwei Füße unten (6–7, 19) und (12–13, 19).
Kein Metall, Gold oder Edelstein im Sprite (die grauen Rippen sind Federn/Knochen) → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; ein Bodenwesen: die Füße bleiben am Boden, kein Schweben):
* OHRFLATTERN: jeder Fächer (x ≤ 4 bzw. x ≥ 15, y ≤ 10) bewegt sich als starrer Block um höchstens ±1 px (nach Test: gestaffelte oder 2-px-Versätze reißen die dünnen Rippen/den Umriss ab). Das linke Ohr flattert viermal in den Frames 3–20, das rechte viermal in den Frames 27–44 (nie im Gleichschritt); dazu pendelt das Paar langsam (eine Welle je Schleife) um 1 px.
* ATMEN: zweimal je Schleife (je 12 Frames) wird die Zeile 16 (Körper) einmal doppelt eingefügt (Texturmischung): Kopf und Ohren steigen 1 px, die Füße bleiben stehen.
* BLINZELN (Frames 17–19 und 38–40): die dunklen Augenpixel nehmen die Stirnfarbe an, ein 2-px-Lidstrich (23,12,0) bleibt bei (7–8,9) und (11–12,9); die cyanfarbenen Striche bleiben.
Frame 0 = Original (Ruhepose). Kontrolle: Ruhepose / Eckkontakte / Randpixel-Test (Regel 16). Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2          # Ohrhub 1 px + Atemhub 1 px oben, Randabstand ≥ 2

spr = L.lade('rebelliokai-backup-bakus')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = Hm.umrissfarben(spr)
UMRISS_G = f(8, 6)                                                  # (28,34,20)
UMRISS_B = f(2, 0)                                                  # (23,24,42)
STIRN = f(9, 8)                                                     # (120,160,126), Lidfarbe
AUGEN = [(8, 8), (7, 9), (8, 9), (11, 8), (12, 9), (11, 9)]
UMRISS_AUGE = f(8, 8)                                               # (23,12,0), Lidstrich

ohr_l = vorhanden & (xx <= 4) & (yy <= 10)
ohr_r = vorhanden & (xx >= sw - 5) & (yy <= 10)
rumpf = vorhanden & ~ohr_l & ~ohr_r


STAFFEL = [0, 1, 1, 1, 1, 1]                                   # Abstand 0…5 vom Gelenk → Anteil der Amplitude (Spalten gruppiert, keine 1-px-Zacken)


def frame(i, nur=None):
    k = R.teil(spr, rumpf, H, W, OFF)
    ol = R.teil(spr, ohr_l, H, W, OFF)
    orr = R.teil(spr, ohr_r, H, W, OFF)
    # Blinzeln: dunkle Augenpixel → Stirnfarbe
    if Hm.folge(i, 17, [1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1], N):
        Hm.setze(k, {p: STIRN for p in AUGEN}, OFF)
        Hm.setze(k, {(7, 9): UMRISS_AUGE, (8, 9): UMRISS_AUGE, (11, 9): UMRISS_AUGE, (12, 9): UMRISS_AUGE}, OFF)     # geschlossenes Lid = dunkler Strich
    # Ohrflattern (positiv = nach unten): Bursts + langsames Pendeln
    slow = 1.0 * math.sin(L.sinus(i, N))
    a_l = max(-1.0, min(1.0, 1.5 * R.burst(i, N, 3, 18, 4) + 0.5 * slow))        # starre Verschiebung höchstens ±1 px (größere Versätze reißen die Rippen ab)
    a_r = max(-1.0, min(1.0, 1.5 * R.burst(i, N, 27, 18, 4) + 0.5 * slow))
    ol = R.spalten_staffel(ol, PAD_L + 5, STAFFEL, a_l)
    orr = R.spalten_staffel(orr, PAD_L + sw - 6, STAFFEL, a_r)
    # Atmen (Zeile 17), zweimal je Schleife
    b = Hm.stufe(i, N / 2, 1)
    k, ol, orr = (L.streck_zeile(e, PAD_T + 16, b) if b else e for e in (k, ol, orr))
    fig = L.zusammen(H, W, [(k, 0, 0), (ol, 0, 0), (orr, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe → Umriss (oben/Ohren navy, Körper dunkelgrün)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS_B if (x - PAD_L <= 4 or x - PAD_L >= sw - 5) else UMRISS_G
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-backup-bakus', 'Rebelliokai Backup Bakus', frames, MS, spr, OFF, prev,
                nahaufnahmen=[('ohr', None, [0, 6, 9, 12, 15, 33, 36, 39])])
