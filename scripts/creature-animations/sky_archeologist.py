# -*- coding: utf-8 -*-
"""Idle-Animation für „Sky Archeologist“ (Creature) — der weißhaarige alte Archäologe im braunen Mantel mit gelbem Schal, die Spitzhacke über der Schulter.

Quelle: src/sky-archeologist.png (23×28 px, 30 Farben).
PICK: [["MotiveMoe", 466, 1]] (Ebene „Sky Archeologist“, komplett). Nachbarebene 465 („Amazing Finding“) zeigt denselben Mann mit gesenkter Hacke und Fragezeichen — andere Karte,
      nur als Lesehilfe benutzt (Hacke = starres Werkzeug mit grauem Metallkopf). Abgleich mit Sky_Archeologist.png: stimmt überein.

Was im Sprite ist (x, y im 23×28-Sprite), Figur im Profil nach rechts:
* HAAR (y 6–14, x 0–9): weiß (246,246,246)/(213,213,213), brauner Umriss (49,24,0).
* GESICHT (x 4–9, y 9–14): Haut (246,189,123)/(255,213,164); helles Pixel (6,11)/(5,12) und graue Pixel (6–7,12) = Auge/Brille, nicht sicher deutbar → bleibt fest, kein Blinzeln.
* SPITZHACKE: Stiel (dunkelbraun (24,16,13)/(47,28,24)/(80,48,41)) diagonal von der Hand (10,13) nach oben rechts (18,3); Metallkopf (grau (45,45,45)/(160…201)) als Bogen von (10,0) über (20,2) bis (22,12).
* HAND (8–9, 13) am Stiel, Ärmel (8–9, 14).
* MANTEL (y 15–24) dunkelbraun, gelb-oranger SCHAL (x 5–7, y 15–20), Gürteltasche grau (y 20–21), STIEFEL rotbraun (y 25–27), schwarzer Schuh/Schatten (7–10, 26).
Metall: nur der Hackenkopf → dort (und nur dort) ein kurzes Aufblitzen. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: er rückt die schwere Hacke auf der Schulter zurecht.
* Atmen (Periode 24): die einfarbige Mantelzeile 22 wird einmal eingefügt (TX) — Oberkörper, Kopf und Hacke heben sich als Einheit 1 px, die Stiefel bleiben stehen.
* Hacke hochwuchten (Frames 12–17 und 21–24): die Hacke (Stiel + Kopf, starr) hebt sich 0 → 1 → 2 → 1 → 0 px und fällt zurück auf die Schulter; der Stiel rutscht dabei durch die Hand
  (Hand bleibt stehen, darunter bleibt der Stiel sichtbar).
* Aufblitzen (Frames 33–36): kurzer Glitzer an der Hackenspitze (21,7): Mitte → kleines Kreuz → Mitte → weg (Farbe (246,255,255) aus der Quelle).
Frame 0 = Original. Kopf bewegt sich nur senkrecht.
Ergänzungen: (10,12) und (10,13) dunkelbraun (24,16,13) unter der Hacke in der Körperebene — das Stielstück, das beim Hochwuchten unter der Hand sichtbar bleibt.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('sky-archeologist', (2, 4, 5, 2))
spr = F.spr
hacke = F.da & (F.xx >= 10) & (F.yy <= 13)
rumpf = F.da & ~hacke
STIEL = F.f(10, 13)
BLITZ = F.f(6, 11)
HUB = {12: 1, 13: 1, 14: 2, 15: 2, 16: 2, 17: 1, 21: 1, 22: 2, 23: 2, 24: 1, }
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    k = F.ebene(rumpf)
    F.setze(k, {(10, 12): STIEL, (10, 13): STIEL})
    fig = G.ueber(k, F.ebene(hacke, 0, -HUB.get(i, 0)))
    st = Hm.folge(i, 33, [0, 1, 1, 0], N)
    if st is not None and not nur:
        Hm.stern4(fig, 21, 7 - HUB.get(i, 0), st, BLITZ, BLITZ, off=F.OFF)
    return F.streck(fig, 22, Hm.stufe(i, 24, 1))


if __name__ == '__main__':
    G.abschluss(F, 'Sky Archeologist', [frame(i) for i in range(N)], MS)
