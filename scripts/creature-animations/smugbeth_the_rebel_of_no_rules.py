# -*- coding: utf-8 -*-
"""Idle-Animation für „Smugbeth, the Rebel of no Rules“ (Creature).

PICK: [["MotiveRussia", 204, 1], ["MotiveRussia", 205, 1]]
Quelle: src/smugbeth-the-rebel-of-no-rules.png (28×25 px, 24 Farben) = Ebene 204 „SMUGBETH“ (Figur, 17×23) vor Ebene 205 (Sense mit violetter Klinge und aufsteigenden Lichtpunkten, 28×25), Lage wie in der
xcf/Kartenkunst. Gegen die Kartenkunst abgeglichen (obere Figur; die untere Figur ist „Lizbeth“ – Ebene 203 u. a. –, die blauen Sicheln und das Eis sind Szene).

Was ist was (x/y im Sprite):
* Figur (x 10–25, y 2–24): langes, welliges, cremefarbenes Haar bis zum Boden, lächelnd geschlossene Augen (schwarze Bögen, y 6–8 → kein Blinzeln), graue Schnauze/Mundpartie (x 15–20, y 8–13) mit rosa Wangen
  und roter Zunge (16–17, y 11–12), hellgrüne Hände/Manschetten links und rechts (x 10–11 und 24–25, y 13–15), dunkle Füße (y 23–24).
* Weißes Funkel-Kreuz links am Kopf (x 10–14, y 8–12) = Sparkle (das „smug“-Blitzen; auf der Partnerkarte ebenfalls weiße Sparkles).
* Sense HINTER der Figur: schwarzer Stiel diagonal von (6, 13) bis (27, 24), hinter dem Körper verdeckt; am linken Ende hängt die violette, leuchtende Klinge (x 3–8, y 12–23, dunkles Band y 13–14, schwarzer Fuß
  y 24 auf Bodenhöhe); darüber drei gestrichelte violette Strahlen aus Lichtpunkten (x 0–8, y 0–11). Klinge und Stielende stehen auf Bodenhöhe → die Sense bleibt völlig still.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Lichtpunkte steigen: die Striche der drei Strahlen wandern entlang ihrer eigenen Bahnen nach oben (1 Zelle je 2 Frames, Bahn = 12 Zellen, oben verschwinden sie, unten an der Klinge entstehen sie neu).
* Klinge leuchtet: ein heller Streifen (das Hellviolett der Quelle) läuft die Klinge hinunter (2 Durchläufe je Schleife) – magisches Leuchten, bleibt in der Klinge.
* Figur atmet und kichert: Haarzeile 20 wird texturiert eingefügt (0–1 px) – ein ruhiger Atemzug (Frames 4–15), dann drei kurze Kicher-Hüpfer des Oberkörpers (Frames 26–27, 30–31, 34–35); Füße bleiben am
  Boden, der Kopf bewegt sich nie seitlich.
* Sparkle am Kopf blitzt: Kreuz → kleines Kreuz → aus → kleines Kreuz → Kreuz (zweimal je Schleife), sitzt am Kopf und geht mit ihm.
ERGÄNZUNGEN (Farben der Quelle):
* Unter dem Sparkle (sichtbar, wenn er aus ist): Haar/Gesichtsrand gespiegelt von der rechten Kopfseite – (12, 8) Creme, (12, 9), (11, 10), (13, 10), (12, 11) Haarbraun, (14, 10) Dunkelbraun, (12, 12) Haar hell.
* Stiel hinter der linken Hand: (10, 15) und (11, 15) Schwarz des Stiels (werden frei, wenn sich der Oberkörper 1 px hebt).
Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('smugbeth-the-rebel-of-no-rules', pad=(2, 2, 3, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

HELL, VIO, V_D1, V_D2 = FIG.farbe((199, 151, 255), (168, 102, 247), FIG.f(3, 13), (51, 0, 146))
STIEL = FIG.farbe((7, 9, 5), (25, 25, 25), FIG.f(25, 23))
WEISS = FIG.farbe((255, 255, 255))
CREME, HAAR, BRAUN, HAAR_H = FIG.f(23, 8), FIG.f(23, 9), FIG.f(21, 10), FIG.f(23, 12)

SENSE = FIG.maske([HELL, VIO, V_D1, V_D2] + list(STIEL))
STRAHL = SENSE & (yy <= 11)
FIGUR = FIG.op & ~SENSE
KREUZ = {(12, 8), (12, 9), (10, 10), (11, 10), (13, 10), (14, 10), (12, 11), (12, 12)}
for p in KREUZ:
    assert FIG.f(*p) == WEISS, p
UNTER = {(12, 8): CREME, (12, 9): HAAR, (11, 10): HAAR, (13, 10): HAAR, (14, 10): BRAUN, (12, 11): HAAR, (12, 12): HAAR_H}

# Bahnen der drei Strahlen, von der Klinge (y 11) nach oben (y 0)
BAHN_M = [(4, y) for y in range(11, -1, -1)]
BAHN_L = [(3, 11), (2, 10), (2, 9), (1, 8), (1, 7), (1, 6), (1, 5), (0, 4), (0, 3), (0, 2), (0, 1), (0, 0)]
BAHN_R = [(8 - x, y) for x, y in BAHN_L]
BAHNEN = [BAHN_M, BAHN_L, BAHN_R]
MUSTER = [[bool(STRAHL[y, x]) for x, y in b] for b in BAHNEN]
assert sum(sum(m) for m in MUSTER) == int(STRAHL.sum()), (sum(sum(m) for m in MUSTER), int(STRAHL.sum()))

BLITZ = [2] * 8 + [1] * 2 + [0] * 10 + [1] * 2 + [2] * 2                    # 24 Frames
HEBEN = {**{k: 1 for k in range(4, 16)}, 26: 1, 27: 1, 30: 1, 31: 1, 34: 1, 35: 1}


def frame(i, nur=None):
    se = FIG.platz(SENSE & ~STRAHL)
    N2.setze(se, OFF, {(10, 15): STIEL[0], (11, 15): STIEL[0]}, neu=True)
    # Lichtpunkte wandern die Bahnen hinauf
    s = (i // 2) % 12
    for bahn, mu in zip(BAHNEN, MUSTER):
        for k, (x, y) in enumerate(bahn):
            if mu[(k - s) % 12]:
                N2.setze(se, OFF, {(x, y): HELL}, neu=True)
    # Leuchtstreifen läuft die Klinge hinunter (Zeilen 15–23)
    z = 13 + (i % 24) // 2
    for y in (z, z + 1):
        if 15 <= y <= 23:
            for x in range(3, 9):
                if FIG.op[y, x] and FIG.f(x, y) == VIO:
                    N2.setze(se, OFF, {(x, y): HELL})
    # Figur
    fi = FIG.platz(FIGUR)
    b = BLITZ[i % 24]
    if b < 2:
        N2.loesche(fi, OFF, [(10, 10)])
        N2.setze(fi, OFF, UNTER)
        if b == 1:
            N2.setze(fi, OFF, {(12, 10): WEISS, (12, 9): WEISS, (11, 10): WEISS, (13, 10): WEISS, (12, 11): WEISS})
    fi = TX.streck_zeile(fi, FIG.pt + 20, HEBEN.get(i, 0))
    return L.zusammen(FIG.H, FIG.W, [(se, 0, 0), (fi, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Smugbeth, the Rebel of no Rules')
