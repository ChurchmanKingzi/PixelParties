# -*- coding: utf-8 -*-
"""Idle-Animation für „Lovely Teddy“ (Creature) — kleiner orangefarbener Teddybär mit ausgebreiteten Armen; winkt/„will umarmt werden“, Ohren zucken.

PICK: [["Motive", 568, "Ebene „Lovely Teddy“, zusammenhängende Figur bei x 17–34, y 78–95 (der Teddy); die übrigen Figuren der Ebene (Mädchen, Sack, Kessel) und die Ebenen
        „Lovely Teddy #1–#4“ (Hasenkrieger mit Speer, Blutspuren, Schatten) sind Szene und gehören nicht zur Creature"]]
Abgleich mit data/card-art/native/Lovely_Teddy.png (Teddy rechts oben neben Sack und Hasenkrieger). Quelle vollständig.

Identifikation (18×18): großer Kopf (y 0–10) mit zwei runden Ohren (x 0–6 und 11–17, y 0–5; Ohrinneres hellgrau (2–3,3–4) und (14–15,3–4)), Augen als dunkle Pupille mit
rotem Rand ((4–6,7–8) und (9–11,7–8)) – bleiben fest (kein Farbspiel), helle Schnauze (x 5–10, y 9–10) mit schwarzer Nase (7–8,9); Ärmchen seitlich (links x 1–4, rechts
x 13–15, y 10–12), heller Bauch (x 6–11, y 12–14), Beinchen (y 15–17).

Ablauf (48 Frames à 80 ms = 3,84 s). Frame 0 = Original:
* Arme: beide Ärmchen heben sich zweimal zusammen 1 px (Frames 6–9, 12–15), später winkt nur der bildrechte Arm zweimal (Frames 30–33, 36–39) – starre Einheiten.
* Atmen (Periode 24): texturierte Zeile im Bauch bei y 14 (TX.streck_zeile), Kopf und Arme heben sich 1 px; Füße bleiben am Boden.
* Blinzeln (Frames 2–3 und 26–27, beide Augen): der rote Augenrand ((5,7), (6,8) bzw. (10,7), (11,8)) wird Fellfarbe, die beiden dunklen Pupillenpixel werden zur
  geschlossenen Lidlinie in der Umrissfarbe (128,56,0).
* Ohrzucken: linkes Ohr Frames 20–21, rechtes Ohr Frames 44–45 (die oberste Ohrzeile entfällt, die Zeile darunter wird Umriss).
Ergänzungen: nur während des Ohrzuckens Umrissfarbe (128,56,0) auf (2–4,1) bzw. (13–15,1); bei gehobenem Arm Umrissfarbe in der Achsel (4,12) bzw. (13,12).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 48, 80
sz = N9.Szene('lovely-teddy', (3, 3, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ARM_L_M = ((xx <= 4) & (yy >= 10) & (yy <= 12)) | ((xx == 3) & (yy == 13))
ARM_R_M = ((xx >= 13) & (yy >= 10) & (yy <= 12)) | ((xx == 14) & (yy == 13))
ARM_L, ARM_R = sz.teil(ARM_L_M), sz.teil(ARM_R_M)
REST = sz.teil(sz.da & ~ARM_L_M & ~ARM_R_M)
UMRISS = (128, 56, 0)
FELL, FELL2 = (224, 169, 70), (184, 128, 40)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N9.stufe(i, 24, 16, 8) if i >= 24 else N9.stufe(i, 24, 18, 6)
    beide = 1 if i in (6, 7, 8, 9, 12, 13, 14, 15) else 0
    rechts = 1 if i in (30, 31, 32, 33, 36, 37, 38, 39) else 0
    r = REST.copy()
    if i in (2, 3, 26, 27):                          # Blinzeln: Lid in Fellfarbe, geschlossene Lidlinie in Umrissfarbe
        for x0 in (4, 9):
            r[sz.PT + 7, sz.PL + x0 + 1, :3] = FELL
            r[sz.PT + 8, sz.PL + x0 + 2, :3] = FELL2
            r[sz.PT + 8, sz.PL + x0:sz.PL + x0 + 2, :3] = UMRISS
    if i in (20, 21):
        r[sz.PT + 0, sz.PL + 2:sz.PL + 6] = 0
        r[sz.PT + 1, sz.PL + 2:sz.PL + 5] = UMRISS + (255,)
    if i in (44, 45):
        r[sz.PT + 0, sz.PL + 13:sz.PL + 16] = 0
        r[sz.PT + 1, sz.PL + 13:sz.PL + 16] = UMRISS + (255,)
    f = L.zusammen(sz.H, sz.W, [(r, 0, 0), (ARM_L, 0, -beide), (ARM_R, 0, -max(beide, rechts))])
    if beide:                                        # Achsel: Umriss unter dem gehobenen Arm schließen
        f[sz.PT + 12, sz.PL + 4] = UMRISS + (255,)
    if beide or rechts:
        f[sz.PT + 12, sz.PL + 13] = UMRISS + (255,)
    return TX.streck_zeile(f, sz.PT + 14, n)


if __name__ == '__main__':
    N9.fertig('lovely-teddy', 'Lovely Teddy', frame, N, MS, spr, check=[0, 2, 7, 18, 20, 31, 44], zoom=18)
