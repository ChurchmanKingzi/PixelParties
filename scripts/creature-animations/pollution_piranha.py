# -*- coding: utf-8 -*-
"""Idle-Animation für „Pollution Piranha“ (Creature) — schwimmender, schnappender Piranha (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveBritain", 219, 1], ["MotiveBritain", 218, 1]]
Quelle: src/pollution-piranha.png (27×23) = obere Körperhälfte (Ebene 219 „Ebene #212“: Kopf, Auge, Rückenflosse, Schwanz) + untere Hälfte
(Ebene 218 „Ebene #213“: Unterkiefer, Bauch, Brustflosse – in der Karte unter der Wasserlinie und dort blau überlagert), passgenau untereinander.

Identifikation (x, y): Kopf links, Maul weit offen: obere Zähne (weiß) x 1/3/5 (y 11–12) und x 7 (y 12–13), untere Zähne x 6 (y 16–17),
x 2/4 (y 17–18); Unterkiefer-Keil x 1–8, y 16–22. Rotes Auge x 8–11, y 7–9 (schwarze Pupille (8–9, 8–9), rosa Lichtpunkt (11,7)). Zwei schwarze
Kiemenschlitze x 13 und 15, y 10–13. Rückenflosse x 13–22, y 0–9 (geschuppt). Schwanzflosse x 22–26, y 8–17, am Stiel (x 21, y 11–14) angewachsen.
Helle Brustflosse x 11–19, y 16–22.

Ablauf (48 Frames à 70 ms ≈ 3,4 s) — kleiner, flinker Fisch:
* Schwimmen: die GANZE Figur gleitet weich (±2 px waagerecht, ±1 px senkrecht).
* Schwanzflosse schlägt als Einheit (x ≥ 22, ±1 px, vier Schläge je Schleife, Posen gehalten); der Stiel bleibt am Körper.
* Brustflosse paddelt (untere Zeilen y ≥ 20 ±1 px, dem Schwanz nachlaufend).
* Schnappen: der Unterkiefer-Keil dreht um das Kiefergelenk (x = 9) bis 3 px an der Spitze zu – die unteren Zähne greifen zwischen die oberen –
  und wieder auf; je Schleife ein Doppelbiss und ein einzelner Biss.
* Auge glüht beim Biss auf (nur Augenpixel: dunkles Rot wird hellrot).
Starr: Kopf, obere Zähne, Kiemen, Rückenflosse. Nur ganze Pixel, nur Quellfarben; keine Ergänzungen.

RUNDE 8 (Nutzer: „Sollten BEIDE Kiefer bewegen und ihre Mäuler ganz schließen können“): Ober- UND Unterkiefer sind jetzt Posen um das Kiefergelenk (Spalte x = 8 bleibt stehen):
der Oberkiefer samt Stirn (x ≤ 7, y ≤ 13) senkt sich bis 3 px, der Unterkiefer (x ≤ 7, y ≥ 16) hebt sich bis 4 px, je Spalte starr (G.spalten_pose, Zieltabellen OBER_ZU/UNTER_ZU,
vier Posen 0…3 = offen … zu). In der Pose „zu“ ist das Maul vollständig geschlossen: zwischen Ober- und Unterlippe bleibt nur eine Zeile Gebiss; die oberen Zähne
(x 1/3/5/7) stehen mit ihrer Spitze vor der Unterlippe, die unteren (x 2/4/6) vor der Oberlippe – ein lückenlos verzahntes Sägezahn-Gebiss – kein Hintergrundpixel im Maul, keine Lücke am Gelenk. Bissfolge (Doppelbiss + einzelner Biss) wie bisher.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 48, 70
spr = L.lade('pollution-piranha')
B = G.Buehne(spr, 5, 5, 5, 5)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
RAND = G.rand_farben(spr)
UMRISS = (41, 83, 95)
schwanz = B.da & (xx >= 22) & (yy >= 8)
ZAHN = (255, 255, 255)
maul = B.da & (xx <= 7) & ((yy <= 13) | (yy >= 16))
zaehne = maul & L.farbmaske(spr, [ZAHN])
kiefer = maul & (yy >= 16) & ~zaehne                      # Unterkiefer
oberkiefer = maul & (yy <= 13) & ~zaehne                 # Oberkiefer mit Stirn (das Auge x 8–11 bleibt stehen)
OBER_ZU = {7: 1, 6: 2, 5: 3, 4: 3, 3: 3, 2: 3, 1: 3, 0: 3}
UNTER_ZU = {7: -2, 6: -3, 5: -4, 4: -4, 3: -4, 2: -4, 1: -4, 0: -4}
MAUL_STUFEN = 3
flosse = B.da & L.farbmaske(spr, [(88, 172, 172)])
flosse |= B.da & (yy >= 20) & (xx >= 13)
rumpf = B.da & ~schwanz & ~maul & ~flosse
BISS = {}
for s0, folge in ((8, [-1, -2, -3, -3, -3, -1, 0, -2, -3, -3, -2, -1]), (32, [-1, -2, -3, -3, -3, -2, -1])):
    for k, v in enumerate(folge):
        BISS[s0 + k] = v


def frame(i):
    dx, dy = G.gleiten(i, N, ax=1.8, ay=1.1, phx=0.0, phy=1.2)
    r = B.teil(rumpf)
    if BISS.get(i, 0) <= -2:
        r = L.tausche(r, {(193, 0, 3): (254, 21, 25)})
    s = G.stufen_spalten(B.teil(schwanz), [B.pl + 22], G.pose(i, N / 4, 1, scharf=1.6))
    f = G.stufen_zeilen(B.teil(flosse), [B.pt + 20], G.pose(i - 3, N / 4, 1, scharf=1.6) - G.pose(-3, N / 4, 1, scharf=1.6) if i else 0)
    zu = -BISS.get(i, 0) / MAUL_STUFEN
    oz = {B.pl + x: v for x, v in OBER_ZU.items()}
    uz = {B.pl + x: v for x, v in UNTER_ZU.items()}
    k = L.zusammen(H, W, [(G.spalten_pose(B.teil(oberkiefer), oz, zu), 0, 0), (G.spalten_pose(B.teil(kiefer), uz, zu), 0, 0),
                          (G.spalten_pose(B.teil(zaehne & (yy <= 13)), oz, zu), 0, 0), (G.spalten_pose(B.teil(zaehne & (yy >= 16)), uz, zu), 0, 0)])   # Zähne zuoberst
    ganz = L.zusammen(H, W, [(s, 0, 0), (r, 0, 0), (f, 0, 0), (k, 0, 0)])
    ganz = G.loecher_stopfen(ganz, RUHE)
    return L.versetze(G.umriss_flicken(ganz, RAND, UMRISS), dx, dy)


RUHE = B.teil(B.da)

if __name__ == '__main__':
    G.fertig('pollution-piranha', 'Pollution Piranha', frame, N, MS, spr, sys.argv)
