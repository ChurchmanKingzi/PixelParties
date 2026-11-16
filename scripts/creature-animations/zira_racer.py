# -*- coding: utf-8 -*-
"""Idle-Animation für „Zira Racer“ (Creature) — der graue Renn-Roboter auf einem einzigen Rad (langer Kuppelkopf, kleiner Greifarm, gebogener Rumpf).

Quelle: src/zira-racer.png (30×39 px, 13 Farben).
PICK: [["MotiveGN", 302, 1]] (Ebene #171, die saubere Figur). Ebene 301 (#168) ist dieselbe Figur mit eingerechnetem Fahrtwind-Schweif (halbtransparent), Ebene 303 (#170) der lange
      Bewegungsschweif der Kartenkunst — beides Bewegungsunschärfe der Szene, nicht übernommen. Abgleich mit Zira_Racer.png: Figur stimmt (Kunst zusätzlich verwischt).

Was im Sprite ist (x, y im 30×39-Sprite), Blick nach links:
* KOPF (x 0–16, y 0–14): hellgraue Kuppel, dunkle Augen-/Maulhöhle (x 11–15, y 12–14); helle Pixel (1,8)–(2,11) unter der Schnauze = Fühler/Zahn, nicht sicher deutbar → fest.
* GREIFARM (x 3–13, y 15–21) vor der Brust, starr.
* RUMPF (x 14–28, y 6–27): gebogene Säule, gerades Stück y 22–26 direkt über dem Rad.
* RAD (x 15–29, y 27–38): Radkasten oben (hellgrau), dunkler Reifen (19,15,14), Felge (51,47,44) mit hellerem Glanzbogen (74,70,67) oben rechts.
Material: mattes graues Metall ohne Glanzlichter im Sprite → kein Glitzern. Kein Feuer, keine Partikel (die Karte zeigt Fahrtwind, keinen Staub).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos); Idee: er steht mit laufendem Motor am Start — das Rad dreht durch, der Rumpf federt.
* Rad dreht (Periode 16, Fahrtrichtung links → Drehung gegen den Uhrzeigersinn): der Glanzbogen der Felge wandert in 8 Schritten zu je 45° um die Radmitte (nur innerhalb der Felgenpixel,
  nur die zwei Felgenfarben). Der Reifen steht auf dem Boden und bleibt, wo er ist.
* Seitensätze (Runde 8, Nutzerwunsch „sehr ruckartig und schnell seitwärts hin und her“): der GANZE Sprite springt in harten Sätzen von 5–13 px waagerecht hin und her
  (Tabelle SATZ: jeder Satz dauert genau 1 Frame, kein Zwischenbild; dazwischen Halte von nur 2–3 Frames; Ausschlag ±7 px um die Mitte). Starr, nichts verformt sich.
* Federn (Periode 12): das gerade Rumpfstück (Zeile 24) wird einmal texturiert eingefügt (TX) — Rumpf, Arm und Kopf heben sich als Ganzes 1 px über dem Rad und sinken zurück.
Frame 0 = Original. Ergänzungen: keine.
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
F = G.Figur('zira-racer', (9, 9, 3, 2))
spr = F.spr
FELGE, GLANZ = (51, 47, 44), (74, 70, 67)
felge = L.farbmaske(spr, [FELGE, GLANZ]) & (F.yy >= 29)
glanz0 = L.farbmaske(spr, [GLANZ]) & (F.yy >= 29)
CX, CY = 22.5, 32.5
# Seitensätze: (Versatz in px, Haltedauer in Frames) — Summe der Halte = N; Frame 0 steht in der Mitte (Original).
SATZ = [(0, 2), (-6, 2), (5, 2), (-7, 3), (7, 2), (-4, 2), (6, 3), (-7, 2), (3, 2), (-5, 2), (7, 3), (-6, 2), (6, 2), (-7, 3),
        (4, 2), (-3, 2), (7, 2), (-6, 3), (5, 2), (-7, 2), (7, 3)]
DX = [d for d, n in SATZ for _ in range(n)]
assert len(DX) == N, len(DX)


def rad(k, schritt):
    if not schritt:
        return
    w = -schritt * math.pi / 4                                      # Bildschirm: gegen den Uhrzeigersinn
    c, s = math.cos(w), math.sin(w)
    for y, x in zip(*np.nonzero(felge)):
        dx, dy = x - CX, y - CY
        qx, qy = int(round(CX + c * dx + s * dy)), int(round(CY - s * dx + c * dy))   # Rückdrehung
        an = 0 <= qy < F.sh and 0 <= qx < F.sw and glanz0[qy, qx]
        F.setze(k, {(int(x), int(y)): GLANZ if an else FELGE})


def frame(i):
    k = F.ebene(F.da)
    rad(k, (i // 2) % 8)
    return G.schieb(F.streck(k, 24, Hm.stufe(i, 12, 1)), DX[i])


if __name__ == '__main__':
    G.abschluss(F, 'Zira Racer', [frame(i) for i in range(N)], MS)
