# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug RHINOCEROS“ (Creature) — Kettenfahrzeug-Käfer mit goldenem Rammhorn (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveEgypt", 118, 1]]   (Ebene „Ebene #108“: Panzerkäfer + Horn. Das lose zweite Hornstück unten links in derselben Ebene, die schwarzen
Mauerrisse (Ebene 119), der Schatten (116) und der halbtransparente Glanzstreifen (117) der Karte gehören nicht zum Sprite.)
Quelle: src/cybug-rhinoceros.png (59×21), Blick nach links.

Identifikation (x, y): Panzerkuppel x 13–58, y 0–12 (grau gerastert, dunkle Plattenfugen), darin die blanke helle Stirnplatte x 24–38, y 1–9.
Gleiskette x 23–58, y 13–20: schwarzer Rahmen, oben eine Reihe Kettenglieder (y 14, graue Paare, Teilung 3 px), unten eine Reihe (y 19),
dazwischen Laufband (y 16–17). Goldenes Rammhorn x 0–23, y 10–19, läuft nach links spitz zu und liegt am Boden auf; auf seiner Oberkante eine
Reihe weißer Sägezähne (x 2–20, jeder zweite Pixel).

Ablauf (56 Frames à 70 ms ≈ 3,9 s) — schweres Fahrzeug, steht am Boden:
* Motor tuckert: die Kuppel (alles über der Kette, ohne Horn) sackt als Einheit kurz 1 px ein (hinter die Kette) und kommt zurück.
* Rammstoß: das GANZE Fahrzeug ruckt 3 px nach vorn (links), hält kurz und rollt langsam zurück. Die Kettenglieder laufen dabei richtig mit:
  die untere Reihe bleibt am Boden stehen (wandert im Sprite gegen die Fahrt), die obere läuft mit doppelter Fahrt nach vorn.
* Kurzes Funkeln an der goldenen Hornspitze beim Stoß (3 Frames: Punkt → Kreuz → Punkt; Gold/Metall).
Starr: Horn samt Zähnen (bewegt sich nur mit dem Fahrzeug), Plattenfugen. Nichts wird gestreckt. Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 56, 70
spr = L.lade('cybug-rhinoceros')
B = G.Buehne(spr, 7, 3, 3, 3)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
SCHWARZ, GLIED_O, GLIED_U, WEISS = (0, 0, 0), (77, 77, 77), (51, 51, 51), (255, 255, 255)
HORN = L.farbmaske(spr, [(71, 58, 26), (224, 184, 82), (245, 213, 90), (245, 219, 139)]) | (L.farbmaske(spr, [WEISS]) & (xx <= 22) & (yy >= 10))
kette = B.da & (yy >= 13) & (xx >= 23) & ~HORN
kuppel = B.da & (yy <= 12) & ~HORN
FAHRT = [0] * N
for i in range(N):
    if 16 <= i <= 18:
        FAHRT[i] = -(i - 15)
    elif 19 <= i <= 23:
        FAHRT[i] = -3
    elif 24 <= i <= 47:
        FAHRT[i] = -3 + (i - 24) // 8
FUNKE = {19: 0, 20: 1, 21: 0}


def kettenlauf(a, dx):
    """Kettenglieder umsetzen: Teilung 3 px; obere Reihe y = 14 (x 27–54, Fuge bei x ≡ 28 mod 3), untere Reihe y = 19 (x 25–55, Fuge bei x ≡ 27 mod 3)."""
    for x in range(27, 55):
        a[B.pt + 14, B.pl + x, :3] = SCHWARZ if (x - 28 - dx) % 3 == 0 else GLIED_O        # oben: läuft mit der Fahrt nach vorn
    for x in range(25, 56):
        a[B.pt + 19, B.pl + x, :3] = SCHWARZ if (x - 27 + dx) % 3 == 0 else GLIED_U        # unten: bleibt am Boden
    return a


def frame(i, funke=False):
    dx = FAHRT[i]
    tuck = 1 if (i % 8) in (4, 5) and not (14 <= i <= 24) else 0
    k = kettenlauf(B.teil(kette), dx)
    f = L.zusammen(H, W, [(B.teil(kuppel), dx, tuck), (k, dx, 0), (B.teil(HORN), dx, 0)])
    if funke and i in FUNKE:
        cx, cy = B.pl + 1 + dx, B.pt + 17
        for (ex, ey) in ([(0, 0)] if FUNKE[i] == 0 else [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-2, 0), (0, -2)]):
            f[cy + ey, cx + ex] = WEISS + (255,)
    return f


if __name__ == '__main__':
    G.fertig('cybug-rhinoceros', 'Cybug RHINOCEROS', lambda i: frame(i, True), N, MS, spr, sys.argv)
