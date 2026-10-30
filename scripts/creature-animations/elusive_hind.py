# -*- coding: utf-8 -*-
"""Idle-Animation für „Elusive Hind“ (Creature).

Quelle: src/elusive-hind.png — die goldene Hirschkuh (24×23 px, 9 Farben, 270 px) aus der Ebene 48 „Ebene #298“ von MotiveSteamDwarfs.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Elusive_Hind.png: Mitte, auf Steinpflaster, nach rechts schauend; Pixel für Pixel gleich) abgeglichen. Die gelben Glitzersterne rings um das Tier (Ebene 43 „Ebene #299“, drei Figuren
9×8 / 8×9 / 9×8, je 17 px) sind eigene Ebenen (Beiwerk), nicht Teil der Figur — sie sind für Fell kein Metall/Gold/Edelstein und bleiben deshalb ohne Animation (Regel 14).
PICK: [["MotiveSteamDwarfs", 48, 1]]

Aufruf:   python3 elusive_hind.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elusive-hind.png + .json

Identifikation (Sprite 24×23, goldgelbe Hirschkuh im Profil, schaut nach RECHTS):
* Fell: orange A (187,79,31) Umriss/Schatten, B (218,138,55), gelb C (225,192,66), hellgelb D (222,222,86), cremefarben E (222,222,156).
* Ohr (x 12–15, Zeilen 0–2) über dem Kopf; Kopf (x 14–23, Zeilen 2–8) mit hellem Halsstreifen (14–15, 3–9).
* Auge: weiß F (18,4) (19,4) (19,5) mit grüner Iris H (0,230,79) (18,5); Schnauze rot: G (193,0,0) (22,6) (22–23,7), I (255,0,0) (23,6) — die rote Nase der Hirschkuh.
* Rumpf (x 1–17, Zeilen 8–14): Rückenlinie A (4–12, 8), Fell B/C/D; Hinterteil links mit hellen Pixeln D (0–2, 10–13).
* Beine: hinten (x 0–6, Zeilen 13–21) zwei, vorn (x 12–19, Zeilen 15–22) zwei.
* Kein Glanz (Fell, Regel 14), keine Partikel.
Bleibt fest: Rumpf, Hinterbeine, Nase, Halsstreifen.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Ohr zuckt (Frames 4–6, 20–22 und 36–38): die Ohrzeilen 0–1 kippen 1 px nach hinten (links); Ohr (Zeile 2) und Kopf bleiben.
* Blinzeln (Frames 12–15 und 30–33): die Augenpixel (weiß + grün) schließen sich in der Fellfarbe (oben D, unten C) — Lid = Fellfarbe; erst die untere Augenzeile, dann beide, dann wieder auf.
* Schreckhüpfer (Frames 8–10 und 26–28): das ganze Tier hebt kurz 1–2 px ab (Pattern 1-2-1) und landet wieder; „elusive“ = scheu.
* Vorderbein tippt (Frames 16–19 und 40–43): das rechte Vorderbein (x 16–19) verkürzt sich um eine Zeile (hebt sich 1 px); keine Scherung an den Beinen.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16); sonst keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2

spr = L.lade('elusive-hind')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (xx <= 15) & (yy <= 1)
bein_v = vorhanden & (xx >= 16) & (yy >= 16)
koerper = vorhanden & ~ohr & ~bein_v

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

FELL_O, FELL_U = (222, 222, 86), (225, 192, 66)                  # D (oben), C (unten)
AUGE = [(18, 4), (19, 4), (18, 5), (19, 5)]
BLINK = {12: 1, 13: 2, 14: 2, 15: 1, 30: 1, 31: 2, 32: 2, 33: 1}
HUEPF = {8: 1, 9: 2, 10: 1, 26: 1, 27: 2, 28: 1}
OHR = {4, 5, 6, 20, 21, 22, 36, 37, 38}
BEIN = {16, 17, 18, 19, 40, 41, 42, 43}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def gesicht(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        for (x, y) in AUGE:
            if lid == 2 or y == 5:
                setze(k, x, y, FELL_O if y == 4 else FELL_U)


def frame(i, nur=None):
    hub = HUEPF.get(i, 0)
    k = teil(koerper)
    gesicht(k, i)
    o = teil(ohr)
    if i in OHR:
        o = L.versetze(o, -1, 0)
    bv = teil(bein_v)
    if i in BEIN:
        bv = L.heben_unten(bv, PAD_T + 16, 1)
    ebenen = {'koerper': k, 'ohr': o, 'bein_v': bv}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, -hub) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('elusive-hind', 'Elusive Hind', frames, MS, prev)
    if prev:
        L.streifen(prev + '/elusive-hind-strip.png', frames, spalten=12, scale=6)
