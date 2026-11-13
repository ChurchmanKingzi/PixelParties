# -*- coding: utf-8 -*-
"""Idle-Animation für „Doctor Fester“ (Creature) — der unheimliche Arzt im weißen Kittel mit dem aufgerissenen, blutunterlaufenen Auge und der erhobenen Hand.

Quelle: src/doctor-fester.png (16×21 px, 24 Farben).
PICK: [["MotiveGrailWar", 379, 1]] (Ebene „Doctor Fester #7“, komplett). Die Karte zeigt daneben die blutende rothaarige Patientin (Ebene 378 „Doctor Fester #10“) sowie Blutspritzer
      (368, 375, 376), Wanne und Tisch — Szenenteile, nicht übernommen. Abgleich mit Doctor_Fester.png: Figur stimmt (in der Kunst zusätzlich mit Blut überzeichnet).

Was im Sprite ist (x, y im 16×21-Sprite):
* KOPF (y 0–9): graubraunes Haar/Haube (82,71,57)/(102,92,80), schwarze Strähnen über dem linken Auge (5–8, 3–4) und (11–12, 3–4).
* RECHTES AUGE (11–12, 5–6): weit aufgerissen, weiß (246,255,255) mit roter Pupille/Äderchen (123,8,24) bei (12,5).
* GESICHT (y 7–9): fahle Haut (204,185,160)/(236,215,190); MUND rot (9–10,8)/(9,9); der weiße Streifen (10,9)–(10,10) darunter ist nicht sicher deutbar (Zahn/Speichel) → bleibt fest.
* LINKER ARM erhoben: grauer Ärmel (x 4–6, y 9–12), HAND (x 0–3, y 9–14) mit fahler Haut.
* KITTEL grau/weiß (y 9–18), SCHUHE orange-rot (y 19–20).
Kein Metall → kein Glanz; keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: der irre Doktor — das Auge rollt, die Finger zucken, zwischendurch schüttelt ihn ein Kichern.
* Augenrollen: die rote Pupille wandert innerhalb der vier Augenpixel im Kreis ((12,5) → (11,5) → (11,6) → (12,6) → zurück; Frames 10–21), später noch ein kurzer Seitenblick (32–35).
  Nur die vier Augenpixel, nur deren zwei Quellfarben.
* Atmen/Kichern: Kittelzeile 13 wird einmal texturiert eingefügt (TX; nur Körperebene) — ein langsamer Atemzug (Frames 6–17), dann drei schnelle Kicher-Stöße (Frames 30–41, je 2 Frames
  oben/unten). Kopf und Arm heben sich mit, die Schuhe bleiben stehen.
* Fingerzucken: die erhobene Hand (x ≤ 3, starr) zuckt zweimal 1 px nach oben (Frames 8–9 und 12–13) und geht sonst mit dem Oberkörper mit.
Frame 0 = Original. Kopf nur senkrecht. Ergänzungen: keine.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('doctor-fester', (2, 2, 4, 2))
spr = F.spr
hand = F.box(0, 9, 3, 14)
rumpf = F.da & ~hand
WEISS, ROT = F.f(11, 5), F.f(12, 5)
HUB = [0] * 6 + [1] * 12 + [0] * 12 + [1, 1, 0, 0] * 3 + [0] * 6
PUPILLE = {**{i: (11, 5) for i in range(10, 14)}, **{i: (11, 6) for i in range(14, 18)}, **{i: (12, 6) for i in range(18, 22)}, **{i: (11, 5) for i in range(32, 36)}}
ZUCK = (8, 9, 12, 13)


def frame(i):
    k = F.ebene(rumpf)
    if i in PUPILLE:
        F.setze(k, {(12, 5): WEISS, PUPILLE[i]: ROT})
    k = F.streck(k, 13, HUB[i])
    h = F.ebene(hand, 0, -HUB[i] - (1 if i in ZUCK else 0))
    return G.ueber(k, h)


if __name__ == '__main__':
    G.abschluss(F, 'Doctor Fester', [frame(i) for i in range(N)], MS)
