# -*- coding: utf-8 -*-
"""Idle-Animation für „Inverted Centaur“ (Creature) — umgekehrter Zentaur: Pferdekopf auf Menschenleib, hält einen Speer quer vor sich; Ohren zucken.

PICK: [["MotiveGrailWar", 464, "Ebene „Inverted Centaur“ (30×21 px, ganze Ebene)"]]
Quelle vollständig (eine Figur). Für die Karte liegt keine Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (30×21): brauner Pferdekopf von vorn (x 7–16, y 0–9) mit zwei Spitzohren (x 7–9 und 14–16, y 0–2) und heller Blesse (x 10–13, y 3–9); menschliche Schultern und Arme
(Haut, y 9–12), dunkelroter Lendenschurz/Gürtel (y 12–18), zwei Menschenbeine mit Stiefeln (y 16–20). Beide Hände ((6–9,15) und (12–15,15)) halten einen Speer waagerecht (y 13–15,
Schaft x 3–22, Eisenspitzen links x 0–3 und rechts x 20–29). Ein dunkelgraues Teil auf der rechten Schulter (x 15–20, y 7–9) ist nicht sicher zu deuten (Schulterplatte?) → bleibt fest.
Der Speer ist starr und folgt den Händen (bewegt sich hier gar nicht). Kopf nie seitlich.

Ablauf (48 Frames à 75 ms = 3,6 s). Frame 0 = Original:
* Atmen (Periode 24): in der Brust (y 11) wird eine texturierte Zeile eingefügt (TX.streck_zeile), Kopf und Schultern heben sich 1 px; Hände, Speer, Beine bleiben.
* Ohrenzucken: das linke Ohr (Frames 9–11) und das rechte Ohr (Frames 33–35) kippen 1 px nach außen (starr; das frei werdende Pixel am Ohransatz bekommt die Umrissfarbe).
* Sparkle auf der großen Speerspitze (Eisen), Frames 20–23.
Ergänzungen: (9,1) bzw. (14,1) Umrissfarbe (49,24,0), nur während das Ohr gekippt ist.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 48, 75
sz = N7.Szene('inverted-centaur', (3, 3, 3, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
OHR_L_M = (xx >= 7) & (xx <= 9) & (yy <= 1)
OHR_R_M = (xx >= 14) & (xx <= 16) & (yy <= 1)
OBEN_M = (yy <= 11) & ~OHR_L_M & ~OHR_R_M
OHR_L, OHR_R, OBEN, UNTEN = sz.teil(OHR_L_M), sz.teil(OHR_R_M), sz.teil(OBEN_M), sz.teil(yy >= 12)
UMRISS, HELL = (49, 24, 0), (225, 225, 225)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N7.stufe(i, 24, 5, 10)
    oben = OBEN.copy()
    l = 1 if 9 <= i <= 11 else 0
    r = 1 if 33 <= i <= 35 else 0
    if l:
        oben[sz.PT + 1, sz.PL + 9] = UMRISS + (255,)
    if r:
        oben[sz.PT + 1, sz.PL + 14] = UMRISS + (255,)
    kopf = L.zusammen(sz.H, sz.W, [(oben, 0, 0), (OHR_L, -l, 0), (OHR_R, r, 0)])
    # Atmen: die Zeile y 11 wird im Oberteil eingefügt (darunter steht alles)
    ganz = L.zusammen(sz.H, sz.W, [(UNTEN, 0, 0), (kopf, 0, 0)])
    ganz = TX.streck_zeile(ganz, sz.PT + 11, n)
    if not nur:
        st = N7.funkel_folge(i, N, 20, (1, 2, 2, 1))
        if st:
            N7.funkel(ganz, sz.PL + 26, sz.PT + 14, st, HELL)
    return ganz


if __name__ == '__main__':
    N7.fertig('inverted-centaur', 'Inverted Centaur', frame, N, MS, spr, check=[0, 6, 10, 21, 34], zoom=12)
