# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Familiar“ (Creature).

Quelle: src/cute-familiar.png — der rosa geflügelte Wicht (22×15 px, 16 Farben) aus MotiveArcanum.xcf, Ebene 92 „Ebene #52“, Figur 1; mit der Kartenkunst
(data/card-art/native/Cute_Familiar.png: oben in der Mitte, Pixel für Pixel gleich) abgeglichen. Das Mädchen unten auf der Karte (Ebene 96, 23×24) ist ein Held, keine Creature.
PICK: [["MotiveArcanum", 92, 1]]

Aufruf:   python3 cute_familiar.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-familiar.png + .json

Identifikation (Sprite 22×15, symmetrisch um x = 10,5; rosa Wicht von vorn mit grauen Flügeln):
* Flügel (grau): links x 0–6, rechts x 15–21, Zeilen 1–5; Rippen/Fläche D (186) J (164) G (131) K (108) L (142) M (86), dunkler Umriss E (56) schräg unten außen.
* Goldhörnchen (je 6 px): links F (7,0) (6,1) (8,1) (7,2) + H (7,1) (8,2); rechts F (14,0) (13,1) (15,1) (14,2) + H (14,1) (13,2) — H = helles Gold (255,200,0), F = dunkles Gold (146,115,0).
* Kopf (x 6–15, Zeilen 1–6): rosa B (255,196,255) / C (207,159,207), Umriss A (102,78,102). Augen: je ein schwarzes Oberlid I (7–8,3) und (11–12,3) mit rotem Augapfel N (8,4) und (11,4);
  am rechten Auge eine Träne: helles Cyan O (13,3) über türkisem P (13,4). Mund: kleines schwarzes I (9–10,6).
* Körper (x 8–13, Zeilen 7–14): schmaler rosa Rumpf mit dunklem Umriss; unten zwei Goldfüßchen H (9,13) (12,13) mit Beinspitzen A (9,14) (12,14).
* Glanz: Gold (Hörner, Füße) — Regel 12/14 erlaubt. Keine Partikel.
Bleibt fest: Gesicht (außer Augäpfel/Träne), Rumpf (außer Hover), Mund.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Flügelschlag (Periode 12, 4× pro Schleife): jede Flügelspalte wandert senkrecht, je weiter vom Kopf desto mehr (Spitze ca. −3 … +4 px), beide Flügel gleichzeitig; Ansatz am Kopf bleibt.
* Schweben: der ganze Wicht hebt sich beim Abschlag um 1 px, die Flügel gehen mit.
* Beine baumeln (Periode 16, 3× pro Schleife): die beiden Beinspitzen (Zeile 14) pendeln gemeinsam 1 px nach links/rechts, die Goldfüßchen darüber bleiben.
* Blinzeln (Frames 10–12 und 34–36): die roten Augäpfel verschwinden in der Fellfarbe B (Lid = Fell), das schwarze Oberlid bleibt als geschlossene Linie.
* Blick (Frames 20–27 nach rechts, 42–47 nach links): beide Augäpfel wandern 1 px zur Seite; nie während eines Blinzelns.
* Träne rinnt (Frames 16–21 und 40–45): der Tropfen (Cyan + Türkis) rutscht die Wange 1–2 px hinab, ist kurz weg und bildet sich oben neu.
* Goldglanz (Regel 12/14): auf den Hörnern wandert je ein kurzes Lichtband (hellere Goldstufe, dann ein Glanzpixel), links bei Frame 5–9, rechts bei 27–31; die Goldfüßchen blitzen bei 17–19 und 41–43 auf.
  Glanzfarbe (247,247,173) = Gold-Glanz der Spielpalette (data/palette-fest.json) — als einzige Farbe außerhalb der Quelle freigegeben.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen (wo der Flügelschlag eine Füllfläche am Rand freilegt, kommt ein Umrisspixel dazu).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.

Ergänzungen: Randpixel-Korrektur (Regel 16); Goldglanz-Pixel (Palette-Gold); sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 3

spr = L.lade('cute-familiar')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

GRAU = [(186, 186, 186), (164, 164, 164), (131, 131, 131), (108, 108, 108), (142, 142, 142), (86, 86, 86), (56, 56, 56)]
fluegel = vorhanden & L.farbmaske(spr, GRAU)
fl_l = fluegel & (xx <= 6)
fl_r = fluegel & (xx >= 15)
koerper = vorhanden & ~fluegel

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

FELL = (255, 196, 255)                                          # B
GOLD_H, GOLD_F = (255, 200, 0), (146, 115, 0)
GLANZ = (247, 247, 173)                                         # Gold-Glanz der Spielpalette
TRAENE_O, TRAENE_P = (142, 255, 255), (71, 255, 255)
PUPILLE = (145, 3, 11)                                          # N
AUGEN = [(8, 4), (11, 4)]                                       # Position der Augäpfel in Ruhe
BLINK = {10, 11, 12, 34, 35, 36}
BLICK = {**{i: 1 for i in range(20, 28)}, **{i: -1 for i in range(42, 48)}}
TRAENE = {16: 0, 17: 1, 18: 2, 19: 3, 20: 4, 21: 0, 40: 0, 41: 1, 42: 2, 43: 3, 44: 4, 45: 0}   # 0 Ruhe, 1–2 rutscht, 3 weg, 4 oben neu
BEINE = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0]   # Periode 16: s = Versatz der Beinspitzen

# Gold-Lichtband: Frame-Offset → {Pixel: Farbe}
BAND_L = {0: {(7, 0): GOLD_H}, 1: {(7, 1): GLANZ, (7, 0): GOLD_H}, 2: {(8, 2): GLANZ, (7, 1): GOLD_H}, 3: {(8, 2): GOLD_H, (7, 2): GOLD_H}}
BAND_R = {0: {(14, 0): GOLD_H}, 1: {(14, 1): GLANZ, (14, 0): GOLD_H}, 2: {(13, 2): GLANZ, (14, 1): GOLD_H}, 3: {(13, 2): GOLD_H, (14, 2): GOLD_H}}
FUSS = {17: {(9, 13): GLANZ}, 18: {(12, 13): GLANZ}, 41: {(9, 13): GLANZ}, 42: {(12, 13): GLANZ}}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def orig(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def gesicht(k, i):
    blick = BLICK.get(i, 0)
    lid = i in BLINK
    if blick or lid:
        for (x, y) in AUGEN:
            setze(k, x, y, FELL)                                 # Ruheposition der Augäpfel → Fellfarbe
        if not lid:
            for (x, y) in AUGEN:
                setze(k, x + blick, y, PUPILLE)
    t = TRAENE.get(i)
    if t:
        for (x, y) in ((13, 3), (13, 4), (13, 5), (13, 6)):
            setze(k, x, y, FELL if (x, y) in ((13, 3), (13, 4)) else orig(x, y))
        if t == 1:
            setze(k, 13, 4, TRAENE_O); setze(k, 13, 5, TRAENE_P)
        elif t == 2:
            setze(k, 13, 5, TRAENE_O); setze(k, 13, 6, TRAENE_P)
        elif t == 4:
            setze(k, 13, 3, TRAENE_O)


def beine(k, s):
    if not s:
        return
    for (x, y) in ((9, 14), (12, 14)):
        farbe = orig(x, y)
        k[PAD_T + y, PAD_L + x] = 0
        setze(k, x + s, y, farbe)


def glanz(f, i):
    out = f.copy()
    for (start, band) in ((5, BAND_L), (27, BAND_R)):
        d = i - start
        if d in band:
            for (x, y), c in band[d].items():
                out[PAD_T + y + f_hover[0], PAD_L + x] = (*c, 255)
    for (x, y), c in FUSS.get(i, {}).items():
        out[PAD_T + y + f_hover[0], PAD_L + x] = (*c, 255)
    return out


f_hover = [0]                                                    # Hover-Versatz des aktuellen Frames (für den Glanz)


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = int(round(-0.9 * math.sin(ph)))                         # Schweben: Abschlag → Körper hebt sich
    f_hover[0] = dy
    k = teil(koerper)
    gesicht(k, i)
    beine(k, BEINE[i % 16])
    fl = L.spalten_welle(teil(fl_l), PAD_L + 7, 3.6, ph, potenz=1.1, bias=0.45)
    fr_ = L.spalten_welle(teil(fl_r), PAD_L + 14, 3.6, ph, potenz=1.1, bias=0.45)
    ebenen = {'koerper': k, 'fl_l': fl, 'fl_r': fr_}
    wahl = nur or ('koerper', 'fl_l', 'fl_r', 'glanz')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl if n in ebenen])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                # Flügelumriss nachziehen, wo die Spaltenverschiebung eine Füllfarbe freilegt
    if 'glanz' in wahl:
        ganz = glanz(ganz, i)
    return ganz


TEST_EBENEN = ('koerper', 'fl_l', 'fl_r')                        # Randpixel-Test ohne Goldglanz


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[GLANZ])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-familiar', 'Cute Familiar', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-familiar-strip.png', frames, spalten=12, scale=7)
