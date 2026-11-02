# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Stegon“ (Creature) — Regeln 14/16/17–31 (Haut, Knochenplatten, Krallen: kein Glanz, kein Feuer).

PICK: [["MotiveGrailWar", 511, "Stegosaurus (Figur der Sammelebene „Dinos“ bei Ebenenkoordinaten x 312–385, y 189–227, nur Pixel mit Alpha 255)"]]
Quelle: src/gigantisaur-stegon.png — Stegosaurus im Profil (74×39 px, 25 Farben), blickt nach links. Die Ebene 511 „Dinos“ (MotiveGrailWar.xcf, 438×306) ist ein Sammelbogen mehrerer Dinosaurier mit weichem Schatten (Alpha 3); die Figur wurde
über ihre vollständig deckenden Pixel herausgelöst und in der Kartenkunst (data/card-art/native/Gigantisaur_Stegon.png) bei (3,5) mit 100 % Übereinstimmung wiedergefunden (die automatische Suche hatte sie wegen der
Größe nicht gelistet). Die anderen Figuren der Ebene (Ankylos, Spinosaurus, Baumstumpf) gehören zu anderen Karten. Nichts fehlt: Kopf, Schwanz mit Dornenfächer und alle Platten sind in der Quelle komplett.

Aufruf:   python3 gigantisaur_stegon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-stegon.png + .json

Identifikation (x, y im Sprite):
* Kopf (x 0–10, y 10–20): kleiner Echsenkopf nach links, dunkle Stirn (N), rosa Wangen-/Stirnfleck (U/V, (3–8, 11–13)), Auge = zwei dunkle Pixel (7,12)(7,13), Nasenloch = zwei dunkle Pixel (3,12)(3,13); Maul leicht
  geöffnet: Maulinneres (T (110,79,73), (2–4, 16–17)) und Unterkiefer (x 2–8, y 16–20) mit hellem Kinn (D/R).
* Hals (x 5–16, y 14–23): olivgrün-beige, schräg nach unten rechts in den Rücken.
* Rücken (x 4–60, y 13–22): graugrüne Schachbrett-Rasterfläche (E/F/G), oben graue Rückenlinie (G); Bauch beige (D/A, y 21–28).
* Rückenplatten (x 9–57, y 0–20): neun rotbraune Dreiecksplatten (C Umriss (78,22,2), M/H/J Fleisch (201,128,100)/(134,71,49)/(108,57,39), je mit schwarzer Mittelraute (K/I/L)) plus schwarze Plattenreihe der Rückseite
  (L/I/N, z. B. x 17–21, y 6–12 und x 26–31, y 2–12).
* Beine (vier, als drei Fußgruppen sichtbar): vorn x 16–26 (Fuß (16–22, 35–37)), Mitte x 27–39 (zwei überlappende Beine, Füße (29–37, 36–37)), hinten x 40–49 (Fuß (41–47, 35–37)); Zehen: helle Pixel (R/P).
* Schwanz (x 52–73, y 13–22): steigt rechts leicht an, endet bei (60–64, 13–17) in einem Dornenfächer: dünne hellgraue/cremefarbene Dornen (O/P/R (159,145,122)/(196,178,161)/(227,211,187)) strahlen nach oben aus
  (x 59–73, y 2–16) — Knochendornen, KEINE Partikel.
Bleibt fest: Gesichtszeichnung (außer Blinzeln; der Unterkiefer ist starr am Kopf), Plattenmuster (Platten bewegen sich nur mit dem Rücken), Zehen (außer Fußheben), Dornenfächer (starr als Ganzes).

Ablauf (60 Frames à 70 ms = 4,2 s), alle Bewegungen unabhängig:
* Atmen (Periode 30, 2× pro Schleife; oben in Frames 3–16 und 33–46): Zeile 19 (Rückenmitte, Schachbrett-Textur) wird eingefügt (L.streck_zeile mit Texturmischung) — Rücken samt ALLEN Platten und Schwanzansatz
  heben sich 1 px, der Kopf hebt sich mit, die Beine bleiben am Boden.
* Kopf nickt/schnüffelt: zweimal pro Schleife (Frames 17–27 und 47–57, außerhalb der Atem-Hebung) senkt sich der ganze Kopf samt Unterkiefer starr 1 px unter die Ruhelage (eigene Ebene; die Körperebene darunter
  ist vollständig, es entsteht keine Lücke); beim Atmen hebt er sich mit dem Rücken 1 px.
* Schwanz wedelt: zweimal pro Schleife (Periode 30) biegt sich der Schwanz um die Spaltenachse x = 56 senkrecht (Spitze bis ±3 px, Gefälle ≤ 1 px je Spalte, die Spitze hinkt nach); der Dornenfächer bewegt sich
  starr mit der Schwanzspitze (D.schwanz_biegen mit spitze_ab).
* Beine treten: je Fußgruppe zweimal pro Schleife kurz (eine Fußzeile entfällt, der Fuß rückt 1 px hoch): vorn Frames 8–13 und 38–43, Mitte 20–25 und 50–55, hinten 2–7 und 32–37 (Gangwechsel).
* Blinzeln (Frames 24–27 und 54–57): das Auge schließt sich (Lid in Hautfarbe (193,125,94)/(143,80,62)).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine Pixel erfunden; Randpixel-Korrektur (Regel 16): fehlende Umrisspixel an verschobenen Teilen werden in der Umrissfarbe des Originals (anim_tiere.umriss_schliessen) ergänzt.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_drache as D

N, MS = 60, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 9, 4

spr = L.lade('gigantisaur-stegon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

kopf_m = vorhanden & (((xx <= 8) & (yy >= 10)) | ((xx >= 9) & (xx <= 10) & (yy == 11)))
faecher_m = vorhanden & (xx >= 59) & (yy <= 16)
schwanz_m = vorhanden & (xx >= 56) & ~faecher_m
bein_a = vorhanden & (xx <= 26) & (yy >= 30)
bein_b = vorhanden & (xx >= 27) & (xx <= 39) & (yy >= 30)
bein_c = vorhanden & (xx >= 40) & (xx <= 55) & (yy >= 30)
koerper = vorhanden & ~kopf_m & ~faecher_m & ~schwanz_m & ~bein_a & ~bein_b & ~bein_c

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 19                                         # Rückenmitte: hier wird beim Atmen eine Zeile eingefügt
FUSS_ZEILE = 33
AUGE = {(7, 12): (193, 125, 94), (7, 13): (143, 80, 62)}
assert all(c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]} for c in AUGE.values())


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 30) in range(3, 17) else 0
    nick = 1 if (17 <= i < 28 or 47 <= i < 58) else 0
    bl = 0
    for s in (24, 54):
        bl = max(bl, D.blinzeln(i, s))
    fuss = [1 if (i in range(8, 14) or i in range(38, 44)) else 0,
            1 if (i in range(20, 26) or i in range(50, 56)) else 0,
            1 if (i in range(2, 8) or i in range(32, 38)) else 0]
    return atem, nick, bl, fuss


def frame(i, nur=None):
    atem, nick, bl, fuss = zustand(i)
    k = teil(koerper)
    kopf = teil(kopf_m)
    if bl:
        for (x, y), c in AUGE.items():
            kopf[PAD_T + y, PAD_L + x, :3] = c
    schwanz = L.zusammen(H, W, [(teil(schwanz_m), 0, 0), (teil(faecher_m), 0, 0)])
    k = L.streck_zeile(k, PAD_T + ZEILE, atem)
    schwanz = L.streck_zeile(schwanz, PAD_T + ZEILE, atem)
    schwanz = D.schwanz_biegen(schwanz, PAD_L + 56, 3.0, L.sinus(i, N / 2), lauf=1.0, richtung=1, spitze_ab=PAD_L + 62)
    kopf = L.versetze(kopf, 0, -atem + nick)
    ba = L.heben_unten(teil(bein_a), PAD_T + FUSS_ZEILE, fuss[0])
    bb = L.heben_unten(teil(bein_b), PAD_T + FUSS_ZEILE, fuss[1])
    bc = L.heben_unten(teil(bein_c), PAD_T + FUSS_ZEILE, fuss[2])
    ebenen = {'schwanz': schwanz, 'bein_a': ba, 'bein_b': bb, 'bein_c': bc, 'koerper': k, 'kopf': kopf}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-stegon', 'Gigantisaur Stegon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-stegon-strip.png', frames, spalten=10, scale=3)
