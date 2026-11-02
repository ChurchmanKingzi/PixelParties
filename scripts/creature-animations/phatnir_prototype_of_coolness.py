# -*- coding: utf-8 -*-
"""Idle-Animation für „Phatnir, Prototype of Coolness“ (Creature) — der Roboter-Wolf (Fenrir-Prototyp) mit goldener Irokesen-Krone, roten Augen, Goldkette und goldenem Brustzeichen.

Quelle: src/phatnir-prototype-of-coolness.png (33×34 px, 15 Farben).
PICK: [["MotiveCoolhalla", 202, 2]]      (Ebene „Ebene #82“ (xcf-Ebene 202), Figur 2; Figur 1 derselben Ebene ist ein Himmelsfetzen. Ebene 201 „#84“ zeigt denselben Roboter mit weißen Augen und einer Träne
                                          — eine Ausdrucks-Variante, ungenutzt.)
Abgleich mit der Kartenkunst Phatnir_Prototype_of_Coolness.png (76×51): Sprite sitzt dort vollständig; Fackeln, Flaggen, Regenbogen sind Kulisse. Die Quelle war vollständig.

Aufruf:   python3 phatnir_prototype_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/phatnir-prototype-of-coolness.png + .json

Was im Sprite ist (x, y im 33×34-Sprite):
* KRONE / IROKESE (x 11–21, y 0–4): goldene Zacken J (254,245,142)/G (255,216,79) mit braun-goldenem Mittelstreifen C (92,44,6)/K (160,101,0) — Gold.
* HELM/GESICHT (x 9–23, y 4–14): grauer Stahlhelm B (82,81,82)/D (128,126,128)/E (151,149,151)/F (206,207,206), schwarzes Visier (0,0,0), zwei ROTE LEUCHTAUGEN (164,0,0) bei (13,10) und (19,10),
  schwarzer Rachen mit hellem Gebiss F bei (15–17, 11–15).
* BRUSTZEICHEN (x 13–20, y 15–20): goldenes Emblem (K/G/J) auf Schwarz — Gold.
* SCHULTERN/ARME (x 8–25, y 12–24): graue Panzerplatten; GOLDKETTE (C/J/G/K) hängt von den Schultern (x 7–9 / 23–27) und bildet unten ein V (x 10–23, y 25–30) mit der Spitze bei (16–18, 29–30).
* DÜSEN-KLAUEN (x 3–8 und 25–29, y 22–33): schwarze Schubdüsen/Fäuste (26,26,26)/(51,51,51) mit je zwei goldenen Stacheln (x 0–3 bzw. 29–32, y 25 und 28) — Gold.
Metall (grauer Stahl) und Gold glänzen (Regel 12/14); keine Edelsteine, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; ein schwerer Roboter: ruhig, aber nie starr):
* ATMEN/SUMMEN (einmal je Schleife): die glatte untere Brustplattenzeile 23 wird 0–2× eingefügt (Texturmischung): Kopf, Krone, Schultern, Brustzeichen und oberer Kettenteil heben sich starr bis 2 px,
  Kettenspitze, Düsenstacheln und Boden bleiben stehen. (Einfügen an der Schulterzeile 13 hätte den schwarzen Rachen und das Kinn verlängert.)
* KRONENFLATTERN: die Außenspitzen der goldenen Zacken (links x 11–12, rechts x 20–21) heben sich 1 px (links Frames 4–8 und 28–32, rechts 16–20 und 40–44) — Spalten wandern als Block, 4-verbunden.
* LEUCHTAUGEN-BLINZELN (Frames 9–10 und 33–35): die roten Pixel werden schwarz (Visierfarbe).
* STACHELPULS: die goldene Spitze der vier Düsenstacheln fährt kurz 1 px ein (oben links 12–15, unten links 20–23, oben rechts 36–39, unten rechts 44–47).
* KETTENSPITZE: die untersten drei Kettenpixel samt Spitze schwingen 1 px nach links/rechts (Periode 24).
* GLANZ: Lichtband über den grauen Stahl (Frames 2–17, ohne Außenkante), Lichtband über das Gold (Frames 26–41); Glitzersterne: Krone (13,2) Frames 28–31, Brustzeichen (14,17) Frames 33–36,
  linker oberer Stachel (1,25) Frames 38–41.
Frame 0 = Original (Ruhepose). Alle Bewegungen laufen auf der vollen Leinwand; nur Farben der Quelle.
Ergänzungen: keine.
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 3

spr = L.lade('phatnir-prototype-of-coolness')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
f = lambda x, y: C.farbe(spr, x, y)

GOLD = [(92, 44, 6), (160, 101, 0), (255, 216, 79), (254, 245, 142)]
GRAU = [(51, 51, 56), (82, 81, 82), (113, 112, 113), (128, 126, 128), (151, 149, 151), (185, 186, 185), (206, 207, 206)]
GRAU = [c for c in GRAU if c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}]
GOLD_M = C.maske_farben(spr, GOLD, ohne_rand=False)
GRAU_M = C.maske_farben(spr, GRAU, ohne_rand=True)
SCHWARZ = f(10, 9)                                                    # (0,0,0) Visier
AUGEN = {(13, 10): SCHWARZ, (19, 10): SCHWARZ}
J, G = (254, 245, 142), (255, 216, 79)
FH, FI = (206, 207, 206), (185, 186, 185)

# Kronenzacken-Außenspitzen (Spalten als Block 1 px hoch)
KRONE_L = np.zeros((sh, sw), bool)
KRONE_L[1:4, 11:13] = True
KRONE_L &= C.maske_farben(spr, GOLD, ohne_rand=False)
KRONE_R = np.zeros((sh, sw), bool)
KRONE_R[1:4, 20:22] = True
KRONE_R &= C.maske_farben(spr, GOLD, ohne_rand=False)
# Düsenstacheln: Spitzenpixel
SPITZEN = {'ol': (0, 25), 'ul': (1, 28), 'or': (32, 25), 'ur': (31, 28)}
KETTE_SPITZE = np.zeros((sh, sw), bool)
KETTE_SPITZE[29, 15:19] = True
KETTE_SPITZE[30, 17] = True
KETTE_SPITZE &= C.maske_farben(spr, GOLD, ohne_rand=False)
TEST_EBENEN = None


def frame(i, nur=None):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Glanz: Stahl und Gold ---
    C.glanz(k, OFF, i, N, GRAU_M, GRAU, start=2, dauer=16, stufen=1, breite=3.0)
    C.glanz(k, OFF, i, N, GOLD_M, GOLD, start=26, dauer=16, stufen=1, breite=3.0, kern=2)
    C.funkel(k, OFF, i, 13, 2, 28, [0, 1, 1, 0], J, G, N)
    C.funkel(k, OFF, i, 14, 17, 33, [0, 1, 1, 0], J, G, N)
    C.funkel(k, OFF, i, 1, 25, 38, [0, 1, 1, 0], J, G, N)
    # --- Leuchtaugen blinzeln ---
    if Hm.folge(i, 9, [1, 1], N) or Hm.folge(i, 33, [1, 1, 1], N):
        Hm.setze(k, AUGEN, OFF)
    # --- Stachelpuls: Spitzenpixel fährt kurz ein ---
    for name, start in (('ol', 12), ('ul', 20), ('or', 36), ('ur', 44)):
        if Hm.folge(i, start, [1, 1, 1, 1], N):
            Hm.setze(k, {SPITZEN[name]: None}, OFF)
    # --- Kronenflattern ---
    if Hm.folge(i, 4, [1] * 5, N) or Hm.folge(i, 28, [1] * 5, N):
        k = C._verschieben(k, OFF, KRONE_L, lambda x, y: -1, 'y')
    if Hm.folge(i, 16, [1] * 5, N) or Hm.folge(i, 40, [1] * 5, N):
        k = C._verschieben(k, OFF, KRONE_R, lambda x, y: -1, 'y')
    # --- Kettenspitze schwingt ---
    sw_ = int(round(np.sin(L.sinus(i, 24))))
    if sw_:
        k = C._verschieben(k, OFF, KETTE_SPITZE, lambda x, y: sw_, 'x')
    # --- Atmen: glatte Brustplattenzeile 23 (Gesicht und Rachen werden nicht gedehnt) ---
    k = Hm.atmen(k, PAD_T + 23, PAD_T + 23, Hm.stufe(i, N, 2), 0)
    return k


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('phatnir-prototype-of-coolness', 'Phatnir, Prototype of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
