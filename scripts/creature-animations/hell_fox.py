# -*- coding: utf-8 -*-
"""Idle-Animation für „Hell Fox“ (Creature).

Quelle: src/hell-fox.png — Ebene „Hell Fox“ (48×32 px, 17 Farben) aus Motive.xcf.
PICK: [["Motive", 848, 1]]

Aufruf:   python3 hell_fox.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hell-fox.png + .json

Identifikation (Sprite 48×32, Fuchs im Profil nach links, Kopf links):
* Kopf (x 0–15, y 0–16): hellbeige Schnauze/Gesicht (G/I/J/M), zwei Ohren oben (links x 4–7, rechts x 10–14, Zeilen 0–4, rot mit
  dunklem Umriss), zwei rote Augen (je 3 Pixel: links (3,10) (3,11) (4,11), rechts (8,10) (7,11) (8,11); Farben O/Q = leuchtendes
  Rot), Nase = fast schwarze Pixel an der Schnauzenspitze (0–2, 14–16), braune Mähne/Wangenfell (D) an der Kopfrückseite
  (x 13–16), rosa-rote Fellmarke (9,9) (9,10) neben dem rechten Auge.
* Schwarzer Fleck unter dem Kinn (9–15, 15–19; K/N/L): Schatten/Halsansatz zwischen Kinn und Vorderbein — bleibt fest.
* Rumpf: roter Körper mit dunklem Umriss (A), hellbeige Bauchfellpartie (20–29, 18–21), vier Beine (zwei vorn: x 6–13 und 15–20;
  zwei hinten: x 25–35), dunkelrote Schattierung (E/H) an den Füßen.
* Schwanz (x ≥ 37, Zeilen 15–31): hängt vom Rücken diagonal nach rechts unten und endet in einer hellbeigen Spitze (45–47, 22–30);
  die dunklen Pixel bei (43–44, 23) und (45, 22) sind die Binnenlinie zwischen rotem Schwanz und beiger Spitze (Füllung, kein Umriss).

Ablauf (40 Frames à 70 ms = 2,8 s):
* Atmen (Periode 40): Der Rumpf hebt sich um 1 px (eine Zeile oberhalb der Beinmitte, Zeile 22, wird eingefügt), die Füße bleiben am
  Boden. Kopf, Ohren und der Schwanzansatz steigen mit. Der Schwanz bekommt dieselbe eingefügte Zeile.
* Kopfnicken (Periode 40, versetzt): der Kopf senkt sich um 1 px relativ zum Rumpf (schnüffeln) und hebt sich wieder.
* Ohrzucken: linkes Ohr (Frames 6–9) und rechtes Ohr (Frames 22–25) schnippen je 1 px nach außen und zurück (Zeilen 0–2 weichen aus).
* Schwanz pendelt (Periode 20, Nachlauf der Spitze): jede Schwanzzeile wandert seitlich (Spitze bis ±3 px), die Amplitude blendet
  über die Schleife ein/aus (Frame 0 = Ruhe = Original). Der Außenumriss wird nach der Verschiebung neu um die Füllung gezogen
  (4-verbunden), die Lücke zum Rumpf wird geschlossen.
* Augenglühen (Periode 20): die Augen glühen heller (alle drei Pixel hellrot) bzw. dunkler.
* Blinzeln (Frames 30–32): oberes Augenpixel wird Fell, dann beide Augen als dunkler Lidstrich, dann halb offen.
* Glut: vier einzelne Glutfunken (1 px, hellrot/rosarot aus dem Fell) steigen langsam vom Rücken auf (≈ 0,3 px/Frame), verglimmen
  flackernd und sind am Schleifenende aus (anim_tiere.funken_ebene); sie liegen hinter dem Fuchs. Keine Kreuz-/Rautenformen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel nötig — Kopf liegt über dem Rumpf (Senken verdeckt nur), der Schwanzumriss entsteht aus Quellfarben
(A/D), siehe anim_tiere.haengend_schwingen.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 8, 7, 3

spr = L.lade('hell-fox')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
dunkel = L.farbmaske(spr, [(0, 0, 0), (26, 26, 26), (14, 8, 8)])

kopf_alles = vorhanden & (xx <= 15) & (yy <= 16) & ~(dunkel & (xx >= 9) & (yy >= 15))
ohr_l = kopf_alles & (xx <= 8) & (yy <= 4)
ohr_r = kopf_alles & (xx >= 10) & (xx <= 14) & (yy <= 4)
kopf = kopf_alles & ~ohr_l & ~ohr_r
schwanz = vorhanden & (xx >= 37)
rumpf = vorhanden & ~kopf_alles & ~schwanz

UMRISS_A, UMRISS_D = (37, 10, 10), (104, 84, 58)
HELL, DUNKEL = (232, 193, 152), UMRISS_D                         # Fell (Lid) / brauner Lidstrich
AUGEN_O, AUGEN_Q = (196, 26, 26), (255, 34, 34)
AUGE_L = [(3, 10), (3, 11), (4, 11)]
AUGE_R = [(8, 10), (7, 11), (8, 11)]
GLUT = {'c': (255, 34, 34), 'r': (227, 76, 76)}

BAUCHZEILE = 22                                                    # hier wird beim Atmen eine Zeile eingefügt
PIVOT_SCHWANZ = 14


def px(x, y):
    return PAD_L + x, PAD_T + y


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                          # sofort auf die volle Leinwand


GLUTFUNKEN = [                                                    # Start = Rückenlinie (liegt zuerst hinter dem Körper)
    dict(x=px(19, 10)[0], y=px(19, 10)[1], vx=-1, vy=-11, off=0, farbe='c', wackeln=1),
    dict(x=px(26, 11)[0], y=px(26, 11)[1], vx=1, vy=-12, off=10, farbe='r', wackeln=1),
    dict(x=px(31, 13)[0], y=px(31, 13)[1], vx=2, vy=-11, off=20, farbe='c', wackeln=1),
    dict(x=px(23, 11)[0], y=px(23, 11)[1], vx=-1, vy=-10, off=30, farbe='r', wackeln=1),
]


def zustand(i):
    """Alle Steuergrößen eines Frames."""
    atem = 1 if 6 <= i < 26 else 0                                   # Rumpf gehoben
    nicken = 1 if 17 <= i < 23 else 0                                # Kopf relativ zum Rumpf gesenkt
    ohr_li = [0, 1, 1, 0][i - 6] if 6 <= i < 10 else 0
    ohr_re = [0, 1, 1, 0][i - 22] if 22 <= i < 26 else 0
    ph20 = L.sinus(i, 20)
    glueh = 1 if 4 <= i % 20 < 9 else (-1 if 12 <= i % 20 < 17 else 0)
    lid = {30: 1, 31: 2, 32: 1}.get(i, 0)
    env = 0.5 - 0.5 * math.cos(L.sinus(i, N))                        # Schwanzamplitude: 0 bei Frame 0
    return atem, nicken, ohr_li, ohr_re, ph20, glueh, lid, env


def frame(i, nur=None):
    atem, nicken, ohr_li, ohr_re, ph20, glueh, lid, env = zustand(i)
    z = PAD_T + BAUCHZEILE
    r = L.platz(L.trenne(spr, rumpf)[0], H, W, PAD_L, PAD_T)
    r = L.streck_zeile(r, z, atem)
    s = L.streck_zeile(teil(schwanz), z, atem)
    s = T.haengend_schwingen(s, L.deckend(r), PAD_T + PIVOT_SCHWANZ - atem, 3.8, ph20, [UMRISS_A, UMRISS_D],
                             lauf=1.6, potenz=1.1, huelle=env)
    k = teil(kopf)
    # Augen: Glühen, Blinzeln
    farbe = AUGEN_Q if glueh > 0 else (AUGEN_O if glueh < 0 else None)
    if farbe:
        k = T.pixel_tauschen(k, {px(*p): farbe for p in AUGE_L + AUGE_R})
    if lid >= 1:
        k = T.pixel_tauschen(k, {px(*AUGE_L[0]): HELL, px(*AUGE_R[0]): HELL})
    if lid == 2:
        k = T.pixel_tauschen(k, {px(*p): DUNKEL for p in (AUGE_L[1], AUGE_L[2], AUGE_R[1], AUGE_R[2])})
    dy_kopf = -atem + nicken
    k = L.versetze(k, 0, dy_kopf)
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 5, -1.2 * ohr_li), 0, dy_kopf)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 5, 1.2 * ohr_re), 0, dy_kopf)
    glut = T.funken_ebene(H, W, i, N, GLUTFUNKEN, GLUT)
    ebenen = {'glut': glut, 'schwanz': s, 'rumpf': r, 'kopf': k, 'ohr_l': ol, 'ohr_r': orr}
    if nur is not None:
        return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in nur])
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in ('glut', 'schwanz', 'rumpf', 'kopf', 'ohr_l', 'ohr_r')])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    quelle = np.zeros((H, W, 4), np.uint8)
    quelle[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = spr
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('hell-fox', 'Hell Fox', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hell-fox-strip.png', frames, spalten=10, scale=4)
