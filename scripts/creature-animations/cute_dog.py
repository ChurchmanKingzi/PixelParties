# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Dog“ (Creature).

Quelle: src/cute-dog.png — zwei Ebenen aus MotiveMoe.xcf an ihrer Kartenposition zusammengesetzt (21×21 px, 18 Farben): Ebene 430 „Cute Dog“ (21×21: der nach links blickende cremefarbene Hund
mit grauem Flügel und Ringelschwanz) und Ebene 431 „Cute Dog #3“ (10×20: der zweite, dahinter liegende graue Flügel; unter 430 gelegt wie in der Kartenkunst). Die übrigen „Cute Dog“-
Ebenen (428 Steine/Stumpf, 429 Haare der Nebenfigur Molinda) gehören nicht zur Figur. Dies ist der einzige karten-eigene Sprite der Karte.
PICK: [["MotiveMoe", 431, "ganze Ebene"], ["MotiveMoe", 430, "ganze Ebene"]]   (431 an (5,0), 430 an (0,0) im Sprite)

Aufruf:   python3 cute_dog.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-dog.png + .json

Identifikation (Sprite 21×21, Hund nach links, Koordinaten im Sprite):
* Kopf (x 0–9, Zeilen 2–10): Ohr/Hinterkopf mit braunem Umriss E (102,90,62) bei (2–3,2)…(5,4); cremefarbenes Gesicht C (238,230,180) / D (205,197,148) / H (172,164,123), Schnauze links;
  Auge: weiße Pixel (5,5) (5,6) mit schwarzen Randpixeln K (21,18,11) (4,6) (6,6) und dunkelblauem Pixel P (58,69,87) bei (4,5); Nase rosa Q (215,115,158) bei (5,8); offenes Maul: dunkelrote
  Pixel (102,0,0) (0,9) (2,9), (122,0,0) (1,9), (62,0,0) (1,10) (2,10) (Zunge/Maulinneres); Schnauzenumriss K bei (0,6) (1,6) (0,7).
* Rumpf und Vorderbeine (x 4–9, Zeilen 10–20): cremefarben mit braunem Umriss E/A links.
* Grauer Flügel (x 5–14, Zeilen 0–19, zwei Ebenen übereinander): Federfläche F (85,85,85) / I (111,111,111) / G (55,55,55) / J (35,35,35), schwarzer Umriss (0,0,0) — er sitzt vor dem Rücken des
  Hundes und verdeckt dessen Mittelteil; Wurzel oben links bei (5–10,0).
* Hinterbein (x 15–17, Zeilen 11–20) und Ringelschwanz (x 15–20, Zeilen 4–10): cremefarben mit dunkelbraunem Umriss A (65,49,0); der Schwanz biegt sich oben nach rechts und endet bei (15–18,4).
* Der Rücken-/Bauchteil zwischen Vorderkörper und Hinterbein ist im Original vom Flügel verdeckt (nicht gezeichnet).
* Kein Metall/Gold/Edelstein → kein Glanz/Glitzer (Regel 14).

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Flügelschlag (Periode 24, 2× pro Schleife): jede Spalte des Flügels wandert senkrecht, je weiter vom Ansatz (x 6) desto mehr (Spitze −3 px nach oben, +1 px nach unten; Wurzel fest). Der verdeckte Rücken wird dabei von einem
  fertiggezeichneten Rumpfstück hinter dem Flügel ergänzt (siehe Ergänzungen).
* Atmen mit Nachlauf: die Brust hebt sich 1 px (Zeile 15 wird mit Texturmischung dupliziert, anim_lib.streck_zeile — alles darüber rückt hoch, Füße bleiben am Boden); mit 3 Frames Verzögerung
  folgt der Kopf noch 1 px (Zeile 12, nur Hundeebene). Flügel, Hinterbein und Schwanz heben sich mit der Brust. Zweimal pro Schleife (Brust Frames 3–14 und 27–38, Kopf 6–13 und 30–37).
* Schwanzwedeln (Periode 16, 3× pro Schleife): die Zeilen des Schwanzes oberhalb der Hüfte (4–9) weichen nach rechts (bis 3 px an der Spitze) und ein wenig nach links (1 px) aus, Hinterbein fest.
* Hecheln: zweimal pro Schleife (Frames 4–11 und 28–35) hängt die Zunge im Wechsel 1 px tiefer (zwei Zungenpixel (1,11) (2,11) in (62,0,0), nur bestehende Farbe).
* Blinzeln: zweimal pro Schleife (Frames 17–19 und 40–42): erst die obere Augenzeile (Lid = Gesichtsfarbe C), dann das Auge als dunkle Linie (alle drei Pixel der unteren Zeile K).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen (gemalt, nur in Farben des Sprites): Rumpfstück hinter dem Flügel, x 10–14, Zeilen 10–16 des Sprites — Rückenlinie Zeile 10 und Bauchlinie Zeile 16 in A (65,49,0), Fläche Zeilen 11–15 in D (205,197,148)
mit H (172,164,123) im Schachbrett in Zeile 14–15 (Bauchschatten). Es liegt hinter dem Flügel und ist in Frame 0 (Original) vollständig verdeckt; sichtbar wird es nur, wenn der Flügel anhebt.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 6, 4, 3

spr = L.lade('cute-dog')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

FL_FARBEN = [(0, 0, 0), (85, 85, 85), (111, 111, 111), (55, 55, 55), (35, 35, 35)]
wing = vor & L.farbmaske(spr, FL_FARBEN)
tail = vor & ~wing & (xx >= 15)
dog = vor & ~wing & ~tail

BRAUN, CREME_D, CREME_H = (65, 49, 0), (205, 197, 148), (172, 164, 123)
ROT_DUNKEL = (62, 0, 0)
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

AUGE_OBEN = [(4, 5), (5, 5)]
AUGE_UNTEN = [(4, 6), (5, 6), (6, 6)]
CREME_C = (238, 230, 180)
SCHWARZ_K = (21, 18, 11)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def torso():
    """Hinter dem Flügel verdeckter Rumpf (x 10–14, Zeilen 10–16)."""
    e = L.leer(H, W)
    for x in range(10, 15):
        e[PAD_T + 10, PAD_L + x, :3] = BRAUN; e[PAD_T + 10, PAD_L + x, 3] = 255
        e[PAD_T + 16, PAD_L + x, :3] = BRAUN; e[PAD_T + 16, PAD_L + x, 3] = 255
        for y in range(11, 16):
            c = CREME_H if (y >= 14 and (x + y) % 2 == 0) else CREME_D
            e[PAD_T + y, PAD_L + x, :3] = c; e[PAD_T + y, PAD_L + x, 3] = 255
    return e


def in_fenster(i, start, laenge):
    return start <= i < start + laenge


def zustand(i):
    n1 = 1 if (in_fenster(i, 3, 12) or in_fenster(i, 27, 12)) else 0          # Brust
    n2 = 1 if (in_fenster(i, 6, 8) or in_fenster(i, 30, 8)) else 0            # Kopf (zusätzlich)
    hechel = (in_fenster(i, 4, 8) and (i - 4) % 4 < 2) or (in_fenster(i, 28, 8) and (i - 28) % 4 < 2)
    lid = 0
    for s in (17, 40):
        if 0 <= i - s < 3:
            lid = (1, 2, 1)[i - s]
    return n1, n2, hechel, lid


def frame(i, nur=None):
    n1, n2, hechel, lid = zustand(i)
    sn = math.sin(L.sinus(i, 24))
    ph = math.asin(sn if sn < 0 else 0.45 * sn)                               # nach oben voll (bis −3 px), nach unten nur bis +1 px (Flügelspitze bleibt über dem Boden)
    fl = T.biegen_spalten(teil(wing), PAD_L + 6, 2.8, ph)
    sw_ = math.sin(L.sinus(i, 16))
    dx_oben = 3.0 * max(0.0, sw_) + 0.8 * min(0.0, sw_)
    ta = T.zucken_zeilen(teil(tail), PAD_T + 10, dx_oben)
    d = teil(dog)
    if hechel:
        for x in (1, 2):
            d[PAD_T + 11, PAD_L + x, :3] = ROT_DUNKEL; d[PAD_T + 11, PAD_L + x, 3] = 255
    if lid:
        for (x, y) in AUGE_OBEN:
            d[PAD_T + y, PAD_L + x, :3] = CREME_C
        if lid == 2:
            for (x, y) in AUGE_UNTEN:
                d[PAD_T + y, PAD_L + x, :3] = SCHWARZ_K
    ebenen = {'torso': torso(), 'fluegel': fl, 'hund': d, 'schwanz': ta}
    if n2:
        ebenen['hund'] = L.streck_zeile(ebenen['hund'], PAD_T + 12, n2)
    if n1:
        for k in ebenen:
            ebenen[k] = L.streck_zeile(ebenen[k], PAD_T + 15, n1)
    wahl = nur or ('torso', 'fluegel', 'hund', 'schwanz')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-dog', 'Cute Dog', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-dog-strip.png', frames, spalten=12, scale=8)
