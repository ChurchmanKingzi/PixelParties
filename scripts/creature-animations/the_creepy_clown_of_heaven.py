# -*- coding: utf-8 -*-
"""Idle-Animation für „The Creepy Clown of Heaven“ (Creature) — Clown schwebt an Luftballons mit Clownsgesichtern.

PICK: [["MotiveMoe", 394, "Ebene „Creepy Clown“, nur x 61–97 (der Clown mit Ballons; rechts daneben liegt in derselben Ebene der verdeckte Rest des Mädchens → weggelassen)"]]
Abgleich mit data/card-art/native/The_Creepy_Clown_of_Heaven.png: Clown + Ballontraube + roter Ballon stimmen überein. Das Mädchen (Ebene 393) und der halbtransparente Bodenschatten
gehören nicht zur Figur.

Identifikation (Sprite 37×44):
* Ballontraube x 0–20, y 0–24: fünf Ballons mit Clownsgesichtern (lila oben, orange links, grün dahinter, blau rechts, gelb unten). Schnüre: gelber Ballon (10–11, 25–26) (10,27),
  blauer Ballon x 15, y 20–23 → (14,24), beide enden an der linken Faust (x 11–13, y 28–31).
* Roter Ballon x 26–36, y 13–24, Knoten (30–32,25), Schnur (31,26)…(28,33)/(27,34) zur rechten Hand (x 25–28, y 33–36).
* Clown: blauer Zipfelhut (x 13–27, y 19–25), Gesicht x 15–22, y 25–31 (Augen = schwarze Rauten mit rotem Kern bei (17,27) und (22,27), rote Nase 19–20/27–29), rotes Haar x 13 / 23–25,
  Kragen y 32, rote Weste y 33–37, grüne Hose y 38–42, schwarze Schuhe y 43.
Er schwebt (hängt an den Ballons, in der Karte mit Schatten am Boden) → Schwebebewegung ist erlaubt.

Ablauf (64 Frames à 70 ms): Frame 0 = Original.
* Schweben: die ganze Figur hebt/senkt sich ±1 px (Periode 32).
* Roter Ballon pendelt starr ±1 px waagerecht (Periode 32, versetzt); die Schnur knickt oberhalb der Hand mit (obere drei Schnurpixel gehen mit dem Ballon).
* Ballontraube driftet starr 1 px nach rechts und zurück (Periode 64; nur nach rechts, weil links kein Hut ist, hinter dem etwas frei würde); Schnüre gehen oben mit.
* Beine bleiben starr (ein Scheren der 5 px kurzen Beine verschmierte die Hose). Blinzeln (Lid = Gesichtsfarbe, Wimpernstrich schwarz) in Frame 22–24 und 50–51.
Ergänzungen (unter der blauen Schnur, sichtbar wenn die Traube rechts steht): (15,22) Hutblau (24,90,205), (15,23) und (14,24) Hutblau (0,32,123).
"""
import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 64, 70
sz = N7.Szene('the-creepy-clown-of-heaven', (4, 4, 4, 4))
spr = sz.spr
xx, yy = sz.xx, sz.yy
r, g, b = (spr[..., k].astype(int) for k in range(3))
blau = sz.da & (b > r + 40) & (b > g + 20)
SCHW = sz.ist((0, 0, 0))
trauben_farbe = sz.ist((181, 157, 0), (247, 214, 0), (247, 223, 74), (255, 255, 253), (0, 0, 0))
TRAUBE = sz.da & ((yy <= 18) & (xx <= 21) | (yy == 19) & (xx <= 16) | (yy >= 20) & (yy <= 23) & (xx <= 15) & trauben_farbe
                  | (yy == 24) & (xx <= 14) & trauben_farbe | (yy == 25) & (xx >= 10) & (xx <= 11))
ROTB = sz.da & (xx >= 26) & (yy <= 25) & ~blau | sz.da & (xx >= 30) & (yy >= 26) & (yy <= 28) & SCHW
BEINE = sz.da & (yy >= 38)
REST = sz.da & ~TRAUBE & ~ROTB & ~BEINE
rest_q = spr.copy()
for (x, y), c in {(15, 22): (24, 90, 205), (15, 23): (0, 32, 123), (14, 24): (0, 32, 123)}.items():
    rest_q[y, x] = c + (255,)
REST_E = np.zeros_like(REST); REST_E[[22, 23, 24], [15, 15, 14]] = True
L_TRAUBE, L_ROT, L_BEINE = sz.teil(TRAUBE), sz.teil(ROTB), sz.teil(BEINE)
L_REST = sz.teil(REST | REST_E, rest_q)
E, B_, A_ = (179, 179, 177), (255, 255, 253), (0, 0, 0)
LID = {(17, 26): E, (17, 28): B_, (22, 26): E, (22, 28): B_, (17, 27): A_, (22, 27): A_}


def frame(i, nur=None):
    bob = N7.sinus_px(i, 32, 1)
    sr = N7.sinus_px(i + 5, 32, 1) - N7.sinus_px(5, 32, 1)
    sr = max(-1, min(1, sr))
    st = N7.stufe(i, 64, 14, 26)
    rest = L_REST
    if i in (22, 23, 24, 50, 51):
        rest = rest.copy()
        for (x, y), c in LID.items():
            rest[sz.PT + y, sz.PL + x, :3] = c
    beine = L_BEINE
    f = L.zusammen(sz.H, sz.W, [(L_TRAUBE, st, 0), (L_ROT, sr, 0), (beine, 0, 0), (rest, 0, 0)])
    # die Schnüre liegen VOR Hut/Gesicht: schwarze Schnurpixel der Traube nachziehen
    schnur = np.where((sz.voll(TRAUBE & SCHW & (yy >= 19)))[..., None], L_TRAUBE, 0).astype(np.uint8)
    L.einsetzen(f, schnur, st, 0)
    return N7.starr(f, 0, bob)


if __name__ == '__main__':
    N7.fertig('the-creepy-clown-of-heaven', 'The Creepy Clown of Heaven', frame, N, MS, rest_q, check=[0, 8, 20, 23, 30, 44], zoom=9, )
