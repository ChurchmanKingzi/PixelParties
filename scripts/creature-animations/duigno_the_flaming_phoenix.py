# -*- coding: utf-8 -*-
"""Idle-Animation für „Duigno, the Flaming Phoenix“ (Creature) — zweiköpfiger Feuerphönix im Flug: ruhiger Flügelschlag, Flammen lodern an Flügelkanten und Kopfkämmen.

PICK: [["MotiveMoe", 298, "Ebene „Duino New“ (92×50 px, ganze Figur)"]]
Die Kartenkunst (data/card-art/native/Duigno_the_Flaming_Phoenix.png) zeigt genau diese orange-rote Fassung. Die Ebene 301 „Duigno“ (64×53) ist eine ältere, schwarze Fassung
derselben Figur und passt NICHT zur Karte → nicht verwendet. Ebenfalls nicht verwendet: 297/299/300 (Feuerwand und Feuerball der Szene, Blitzlinien), 296, 302 (Schatten).

Identifikation (92×50): linker Flügel x 0–41, rechter x 50–91 (y 14–41; rote Flügeldecken oben, darunter Schwungfedern mit dunklen Kielen, gezackte Hinterkante y 36–41).
Rumpf x 38–53 (y 24–40) mit roter Brust. Zwei Hälse (x 42–45 und 46–50, y 13–25). Linker Kopf (x 32–43, y 9–14) schaut nach links unten, gelber Schnabel x 28–36, y 14–19,
Auge dunkel (33,12)/(37,14). Rechter Kopf (x 46–57, y 4–13) schaut nach oben, Schnabel x 51–54, y 0–6, Auge dunkel x 55–57, y 5–7. Lose gelb-orange Pixel über/neben beiden
Köpfen (y 5–15) = Flammenkamm. Unten: Schwanzfedern (x 31–37 und 54–60, y 39–45), gelbe Beine mit Krallen (x 37–44 und 47–54, y 40–49).

Ablauf (72 Frames à 70 ms = 5,0 s). Frame 0 = Original (plus Feuer):
* Flügelschlag (Periode 36, großes Wesen → ruhig): beide Flügel schlagen als GANZE Fläche um das Schultergelenk (x 38 bzw. 53; Spaltenversatz wächst mit dem Abstand, höchstens
  1 px je Spalte, Spitzen ±5 px). Nichts wird gestreckt; Federn, Kiele und Hinterkante gehen starr mit. Wo an einer
  Versatzstufe ein Innenpixel frei läge, bekommt es die Umrissfarbe (100,17,19) – der Umriss bleibt geschlossen und 1 px stark.
* Der ganze Vogel hebt und senkt sich gegenläufig um 1 px (Abschlag → Körper steigt).
* Feuer (anim_feuer3, posen=16, halten=1): Flammensaum HINTER den oberen Flügelkanten (Füße liegen 2 px im Flügel → lückenlos; der Saum macht den Flügelschlag spaltengenau mit),
  je eine größere Flamme hinter den beiden Kopfkämmen. Farben nur aus der Quelle (Rot, Orange, Gelb).
Kein Glanz (Feuer/Federn). Augen bleiben fest (2–3 dunkle Pixel, kein Lid erkennbar).
Ergänzungen: keine.
"""
import math

import numpy as np

import anim_lib as L
import anim_feuer3 as F3
import anim_n8 as N8

N, MS = 72, 70
sz = N8.Szene('duigno-the-flaming-phoenix', (6, 6, 18, 7))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
ROT, ORANGE, GELB, HELL = (205, 55, 38), (210, 113, 24), (248, 174, 37), (249, 201, 37)
GL, GR = 38, 53                                             # Schultergelenke (Sprite-x)
M_KOPF = (xx >= 28) & (xx <= 58) & (yy <= 19)
M_FL = ((xx < GL) & ~M_KOPF) & (yy <= 41)
M_FR = ((xx > GR) & ~M_KOPF) & (yy <= 41)
FL_L, FL_R = sz.teil(M_FL), sz.teil(M_FR)
RUMPF = sz.teil(~(M_FL | M_FR))
TEST_EBENEN = ('figur',)
DUNKEL = (100, 17, 19)
UMRISS = [(45, 4, 2), DUNKEL, (161, 47, 24), ROT, (240, 126, 41), GELB]

# Flammensaum entlang der oberen Flügelkanten (2 px innerhalb der Kante)
KANTE_L = [(3, 31), (12, 23), (21, 17), (28, 22)]
KANTE_R = [(91 - x, y) for x, y in KANTE_L]
LAENGE = F3.stuetz((0, 9), (0.6, 13), (1, 9))
fl = (F3.saum(KANTE_L, 6, LAENGE, 3.6, richtung=(-0.2, -1), phase=0.0, versatz=(PL, PT)) + F3.saum(KANTE_R, 6, LAENGE, 3.6, richtung=(0.2, -1), phase=0.55, dphase=0.41, versatz=(PL, PT)))
SAUM = F3.Feuer(sz.H, sz.W, fl, [ROT, ORANGE, GELB, HELL], posen=16, halten=1)
KAMM = F3.Feuer(sz.H, sz.W, [F3.Flamme(PL + 37, PT + 11, 11, 3.5, phase=0.2), F3.Flamme(PL + 47, PT + 9, 12, 3.5, richtung=(-0.25, -1), phase=0.7)],
                [ROT, ORANGE, GELB, HELL], posen=16, halten=1)


def schlag(i):
    return math.sin(L.sinus(i, 36))


def versatz(s):
    def f(x):
        xs = x - PL
        d = GL - xs if xs < GL else xs - GR
        frac = min(1.0, max(0.0, (d - 5) / 33.0))
        return int(math.floor(5.0 * s * frac ** 1.3 + 0.5))
    return f


def frame(i, nur=None):
    s = schlag(i)
    f = versatz(s)
    hub = -N8.sinus_px(i, 36, 1, -0.6)
    eb = []
    if not nur:
        eb.append((N8.spalten_versatz(SAUM.ebene(i), f), 0, hub))
        eb.append((KAMM.ebene(i), 0, hub))
    vogel = L.zusammen(sz.H, sz.W, [(N8.spalten_versatz(FL_L, f), 0, 0), (N8.spalten_versatz(FL_R, f), 0, 0), (RUMPF, 0, 0)])
    vogel = N8.kontur_schliessen(vogel, UMRISS, DUNKEL)            # Versatzstufen an den Flügelkanten schließen
    eb.append((vogel, 0, hub))
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N8.fertig('duigno-the-flaming-phoenix', 'Duigno, the Flaming Phoenix', frame, N, MS, spr, check=[0, 5, 9, 14, 27, 31], zoom=5, spalten=3)
