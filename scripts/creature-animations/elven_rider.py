# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Rider“ (Creature) — die silberhaarige Elfe im grünen Umhang auf ihrem nachtblauen Pferd.

Quelle: src/elven-rider.png (40×32 px, 41 Farben) = Ausschnitt x 50–95 (ohne den braunen Zweig ganz links) der Ebene „Elven Rider“ (96×32 px).
PICK: [["MotiveGrailWar", 142, 1]]      (Ebene „Elven Rider“, 96×32 px: links ein kleiner brauner Stab (x 0–6, y 14–18) = Beiwerk, rechts Reiterin und Pferd samt Schweifsträhnen (x 56–95); Abgleich mit der Kartenkunst
                                          Elven_Rider.png: 98 % Pixeltreffer bei (15,10). Blumen/Büsche der Kunst gehören nicht dazu.) Die Quelle ist vollständig.
Aufruf:   python3 elven_rider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-rider.png + .json

Was im Sprite ist (x, y im 40×32-Sprite):
* REITERIN (x 13–29, y 0–19): langes silbergrünes Haar (229,231,192)/(188,191,162)/(151,149,110)/(97,102,79)/(66,70,53) mit dunklem Umriss (8,18,0), die Haarmasse fällt über den Rücken nach links (x 13–21, y 9–16);
  Gesicht (x 23–28, y 5–10) in Dreiviertelansicht mit schwarzer Braue (24–27,6), EIN sichtbarem Auge 2×2 bei (25,7),(26,7),(25,8),(26,8) (hellblau + schwarz über weiß + grau), grünem Umhang (15,32,0)/(68,76,17)/(93,98,31)/(112,118,46) (x 15–27, y 11–17),
  ein hellcyanes Pixel (180,246,255) bei (26,15) (unsicher: Handschuh/Schmuck → fest); Stiefel/Fuß braun (115,41,16)/(164,74,41)/(189,90,57) bei (22–26, 18–19).
* PFERD (x 15–39, y 6–31): nachtblaues Pferd in (110,130,176)/(124,144,188)/(68,88,132)/(53,73,121), Umriss (26,45,81); Kopf rechts oben (x 29–37, y 9–17) mit goldenem Auge (205,180,68) bei (33,13),(33,14), Stirnschopf (x 30–36, y 6–9)
  und fliegender Mähne (x 35–39, y 6–12; dunkles Marineblau (18,28,63)/(30,23,69)/(67,66,119) mit zwei hellen Pixeln (212,213,247)/(246,246,246) = Sterne in der Mähne), vier Beine (x 15–17, 18–20, 27–29, 31–33) mit schwarzen Hufen (5,22,18) bei y 28–31;
  der Schweif zieht als dunkelblaue Strähnen (18,28,63) nach links (x 0–17, y 18–30).
Metall/Edelstein: nichts eindeutig (goldenes Pixelpaar am Pferdekopf = Auge → nur Blinzeln, kein Glanz; die hellen Pixel in der Mähne bleiben Teil der Mähne) → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos):
* Atmen des Pferdes (Periode 24, zweimal pro Schleife): die Rumpfzeile 23 von Pferd+Reiterin wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Rumpf, Hals, Kopf, Reiterin steigen 1 px, die Beine/Hufe bleiben am Boden.
* Schweif weht (Periode 24, zweimal pro Schleife): die Schweifsträhnen (nur die dunkelblauen Pixel (18,28,63) bei y ≥ 18, x ≤ 17) laufen als Welle (L.spalten_welle mit Phasenlauf, Gelenk x 17, Ausschlag bis ±3 px am Ende); der Umriss des Schweifs ist
  die dunkelblaue Strähne selbst, darunter liegt der Pferdekörper unverändert.
* Mähne weht: der Stirnschopf (x 30–35, y 6–9) und die fliegenden Strähnen rechts (x 35–39, y 6–12) pendeln waagerecht (L.zeilen_welle, Gelenk y 10 bzw. y 12, Ausschlag bis ±1,5 px; Periode 16 bzw. 12), die beiden Sternpixel wandern mit den Strähnen.
* Haar der Reiterin weht (Periode 24, einmal pro Schleife je Böe): die unteren Zeilen des Haarvorhangs (y 12–16, nur Haarfarben) wehen bis 2 px nach links vom Umhang weg und zurück; die dadurch frei liegenden Umhangkanten bekommen die Umrissfarbe (Regel 16).
* Blinzeln der Reiterin (Frames 20–22 und 41–43): die vier Augenpixel nehmen die Hautfarbe (246,205,139) an. Das Pferd blinzelt versetzt (Frames 7–8 und 30–31): die zwei goldenen Augenpixel nehmen die Fellfarbe (110,130,176) an.
* Hufscharren (Frames 10–13 und 33–36, Hufe versetzt): das vordere linke Bein (x 31–33) bzw. das hintere linke Bein (x 15–17) hebt sich ab Zeile 26 starr um 1 px (Huf kurz angehoben) und setzt wieder auf.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Flächen; freigelegte Umhangkanten (x 21–22, y 12–16) werden zu Umrisspixeln (8,18,0) umgefärbt.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_orks as O
import anim_untote as U

N, MS = 48, 66
GP = 7

spr = L.lade('elven-rider')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (8, 18, 0)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


NAVY_A, NAVY_B, NAVY_O, NAVY_Y = (18, 28, 63), (26, 45, 81), (30, 23, 69), (67, 66, 119)
STERN1, STERN2 = (212, 213, 247), (246, 246, 246)
HAARF = [(8, 18, 0), (97, 102, 79), (151, 149, 110), (66, 70, 53)]

schweif = L.farbmaske(spr, [NAVY_A]) & (yy >= 18) & (xx <= 17)
stirn = L.farbmaske(spr, [NAVY_A, NAVY_B]) & (xx >= 30) & (xx <= 35) & (yy >= 6) & (yy <= 9)
maehne = L.farbmaske(spr, [NAVY_A, NAVY_O, NAVY_Y, STERN1, STERN2]) & (yy <= 12) & (((yy >= 10) & (xx >= 35)) | ((yy <= 9) & (xx >= 36)))
haar = L.farbmaske(spr, HAARF) & (xx <= 21) & (yy >= 12) & (yy <= 16)
bein_v = vorhanden & (xx >= 31) & (xx <= 33) & (yy >= 26)
bein_h = vorhanden & (xx >= 15) & (xx <= 17) & (yy >= 26) & ~schweif
teile = [schweif, stirn, maehne, haar, bein_v, bein_h]
for a_ in range(len(teile)):
    for b_ in range(a_ + 1, len(teile)):
        assert not (teile[a_] & teile[b_]).any(), (a_, b_)
rest = vorhanden.copy()
for t_ in teile:
    rest &= ~t_

AUGE_R = [(25, 7), (26, 7), (25, 8), (26, 8)]
LID = (246, 205, 139)
AUGE_P = [(33, 13), (33, 14)]
assert f(33, 13) == (205, 180, 68) and f(33, 14) == (205, 180, 68)
FELL = (110, 130, 176)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    r = teil(rest)
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(r, {p: LID for p in AUGE_R}, OFF)
    if Hm.folge(i, 7, [1, 1], N) or Hm.folge(i, 30, [1, 1], N):
        Hm.setze(r, {p: FELL for p in AUGE_P}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    # Beine (starr 1 px hoch, Huf scharrt)
    lv = 1 if Hm.folge(i, 10, [1, 0, 1, 1], N) else 0
    lh = 1 if Hm.folge(i, 33, [1, 0, 1, 1], N) else 0
    bv = L.versetze(teil(bein_v), 0, -lv)
    bh = L.versetze(teil(bein_h), 0, -lh)
    # Haar der Reiterin: Zeilen 12–16 wehen nach links (0 … −2), Frame 0 = Ruhe
    s = Hm.welle01(i, N)
    ha = teil(haar)
    dxz = {y: -int(round(2.0 * ((y - 11) / 5.0) * s)) for y in range(12, 17)}
    ha = Hm.zeilen_versatz(ha, OFF, dxz)
    # Atmen: Rumpf + Reiterin (ohne Beine/Schweif)
    if b:
        r = L.streck_zeile(r, GP + 23, b)
    # Schweif und Mähne
    sc = O.spalten_welle0(teil(schweif), GP + 17, 2.8, i, 24, lauf=1.4)
    st = L.zeilen_welle(teil(stirn), GP + 10, 1.5, L.sinus(i, 16))
    mh = L.zeilen_welle(teil(maehne), GP + 12, 1.5, L.sinus(i, 12))
    fr = L.zusammen(H, W, [(sc, 0, 0), (r, 0, 0), (ha, 0, -b), (st, 0, -b), (mh, 0, -b), (bv, 0, 0), (bh, 0, 0)])
    return Hm.kontur_schliessen(fr, ERLAUBT, UMRISS)


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', len(neu), 'Frames')
    L.speichern('elven-rider', 'Elven Rider', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-rider-strip.png', frames, spalten=12, scale=5)
