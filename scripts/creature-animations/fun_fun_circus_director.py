# -*- coding: utf-8 -*-
"""Idle-Animation für „Fun-Fun Circus Director“ (Creature) — der rote Zirkusdirektor-Dämon: Zylinder mit roter Hutband, geschwungene Hörner, rotes Gesicht hinter einer Totenkopfmaske, roter Frack, weiße Fliege, schwarze Hose.

Quelle: src/fun-fun-circus-director.png (16×30 px, 38 Farben; Komposit) und die Einzelebenen src/fun-fun-circus-director-L26/L27/L28/L29.png (gleiches Raster).
PICK: [["MotiveMoe", 26, 1], ["MotiveMoe", 27, 1], ["MotiveMoe", 28, 1], ["MotiveMoe", 29, 1]]
  Ebenen der Datei MotiveMoe (niedriger Index = oben): 26 „Fun-Fun Director #2“ = Zylinder; 27 „#3“ = schwarzer Schatten der Hutkrempe im Gesicht; 28 „#1“ = Totenkopfmaske; 29 „Fun-Fun Director“ = Körper
  (Hörner, Kopf, Frack, Hose). Nur Ebene 26 kam aus der Treffersuche („Fun-Fun Director #2“, 100 %), die anderen drei aus den Nachbarebenen (Regel 20). Karte: Fun_Fun_Circus_Director.png (Figur bei (30,16), 94,8 % wegen des roten Glühens der Kunst).
  Die übrigen Ebenen (30–33: Bühne/Vorhang/Clown-Porträt/Blutmuster) sind Kulisse.

Aufruf:   python3 fun_fun_circus_director.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fun-fun-circus-director.png + .json

Was im Sprite ist (x, y im 16×30-Sprite):
* ZYLINDER (Ebene 26, x 0–15, y 0–11): schwarzer Hut (x 4–11) mit dunklen Grautönen, breites Hutband in Rot (y 8–9; drei Rotstufen (130,5,1)/(205,1,0)/(255,64,62)), Krempe (y 10–11).
* HÖRNER (Ebene 29, x 0–5 und 10–15, y 3–9): zwei geschwungene Hörner in Graugrün (118,129,113)/(160,172,160)/(70,70,58), hinter dem Hut, am Kopf angewachsen.
* KOPF (Ebene 29, x 4–11, y 8–16): rotes Gesicht (124,25,19), weiße Augen, kleine goldene Zahnspitzen (217,169,87) bei (4,16)/(11,16) und (5,17)/(10,17) (Gold!); darüber der SCHATTEN der Krempe (Ebene 27, y 12–13) und die TOTENKOPFMASKE (Ebene 28, x 4–11, y 10–19: grau/weiß/schwarz mit weißem Gebiss).
* FRACK (Ebene 29, y 17–26): schwarzer Rock, leuchtend roter Kragen/Ärmel (130,0,0)/(226,1,5): linker Ärmel x 2–4, rechter x 11–13 (y 18–23), weiße Fliege/Hemd (249,249,251) (x 6–9, y 18–23).
* HOSE/STIEFEL (y 24–29): schwarz mit grauen Lichtern.
Gold: nur die zwei Paar Zahnspitzen → ein kurzes Funkeln (Regel 14); Stoff, Hut, Horn, Maske glänzen nicht. Hörner/Maske/Gesicht bleiben fest (Regel 1/21: nicht geraten). Keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* ATMEN (Periode 24): die Hosenzeile 26 wird einmal eingefügt: Körper, Kopf, Maske, Hörner, Hut steigen 1 px, Stiefel bleiben.
* HUT LÜPFEN: der Zylinder (Ebene 26) hebt sich zusätzlich bis 2 px (Frames 8–12 hoch, 30–33 kurz 1 px) und senkt sich wieder — starr, der Kopf darunter (Hörner, Gesicht) bleibt (Verdecktes ist in Ebene 29 vollständig vorhanden: Kopfoberseite y 8).
* ÄRMEL: beide Frackärmel pendeln einwärts (starre Zeilenverschiebung der Ärmel-Enden um 1 px über den Rock; links Frames 14–23, rechts Frames 34–43).
* FUNKELN: die goldenen Zahnspitzen links blitzen weiß (Frames 20–21), rechts (Frames 40–41).
Frame 0 = Original (Ruhepose). Ergänzungen: keine; beim Hutlüpfen werden zwei vom Hut verdeckte Quellpixel sichtbar: (5,10) Maskenrand (187,187,187) aus Ebene 28 und (9,9) Wangenlicht (204,95,92) aus Ebene 29
(Farben der Quellebenen, in L.pruefe(erlaubt=…) freigegeben).
"""
import sys

import numpy as np
from PIL import Image

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 2

spr = L.lade('fun-fun-circus-director')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]


def lade_ebene(n):
    return np.array(Image.open(L.SRC + f'/fun-fun-circus-director-L{n}.png').convert('RGBA'))


E26, E27, E28, E29 = (lade_ebene(n) for n in (26, 27, 28, 29))
v29 = L.deckend(E29)
ARM_L = v29 & (xx <= 4) & (yy >= 18)
ARM_R = v29 & (xx >= 11) & (yy >= 18)
KOERPER = v29 & ~ARM_L & ~ARM_R
GOLD = L.farbmaske(E29, [(217, 169, 87)]) & v29
GOLD_L = GOLD & (xx <= 7)
GOLD_R = GOLD & (xx >= 8)
WEISS = (249, 249, 251)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (3, 3, 1)


def eb(a, m=None, dy=0):
    t = a if m is None else L.trenne(a, m)[0]
    return L.platz(t, H, W, OFF[0], OFF[1] + dy)


def frame(i, nur=None):
    hub = Hm.stufe(i, 24, 1)
    hop = 0
    w = Hm.folge(i, 8, [1, 2, 2, 2, 1], N)
    if w:
        hop = w
    w2 = Hm.folge(i, 30, [1, 1, 1, 1], N)
    if w2:
        hop = max(hop, w2)
    # Körper mit Gold (Funkeln: weißer Blitz auf den Zahnspitzen)
    kb = eb(E29, KOERPER)
    for s, m in ([] if nur else ((20, GOLD_L), (40, GOLD_R))):
        if Hm.folge(i, s, [1, 1], N):
            for y, x in zip(*np.nonzero(m)):
                kb[y + OFF[1], x + OFF[0], :3] = WEISS
    kb = Hm.atmen(kb, OFF[1] + 26, OFF[1] + 12, hub, 0)
    # Ärmel: Enden (y 21–24) pendeln einwärts
    al, ar = eb(E29, ARM_L), eb(E29, ARM_R)
    if Hm.folge(i, 14, [1] * 10, N):
        Hm.zeilen_versatz(al, OFF, {y: 1 for y in (21, 22, 23, 24)})
    if Hm.folge(i, 34, [1] * 10, N):
        Hm.zeilen_versatz(ar, OFF, {y: -1 for y in (21, 22, 23, 24)})
    al, ar = L.versetze(al, 0, -hub), L.versetze(ar, 0, -hub)
    mask = L.versetze(eb(E28), 0, -hub)
    schatten = L.versetze(eb(E27), 0, -hub)
    hut = L.versetze(eb(E26), 0, -hub - hop)
    return L.zusammen(H, W, [(kb, 0, 0), (al, 0, 0), (ar, 0, 0), (mask, 0, 0), (schatten, 0, 0), (hut, 0, 0)])


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne das Gold-Funkeln
FREIGELEGT = [(187, 187, 187), (204, 95, 92)]   # Pixel der Ebenen 28/29 unter dem Hut (beim Lüpfen sichtbar)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_director', 'Fun-Fun Circus Director', frames, MS, prev, spr, OFF, erlaubt=FREIGELEGT)
