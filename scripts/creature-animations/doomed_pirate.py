# -*- coding: utf-8 -*-
"""Idle-Animation für „Doomed Pirate“ (Creature) — untoter Pirat mit Dreispitz (Totenkopf-Emblem), rotem Glühauge und Enterhaken.

Quelle: src/doomed-pirate.png (24×26 px, 44 Farben).
PICK: [["MotiveGrailWar", 559, 1]]   (Ebene „Doomed Pirate“, vollständig deckend; Nachbarebenen 558 = Bombe eines anderen Motivs, 560/561 = andere Figuren → kein Beiwerk nötig)
Abgleich mit der Kartenkunst Doomed_Pirate.png: Figur dort identisch (Hut, Gesicht, Haken, gestreifte Manschetten). Die Quelle war vollständig.

Was im Sprite ist (x, y):
* HUT (x 2–15, y 0–7): schwarzer Dreispitz mit weißem Saum (246,255,255) und weißem Totenkopf-Emblem (x 7–10, y 3–6). Starr, geht nur mit dem Kopf.
* GESICHT (x 4–13, y 8–11): Schädel weiß/grau (229,229,229)/(207,207,207) bei x 6–11; links eine schwarze Augenhöhle/Klappe (x 6–7, y 8–9); rechts ein ROTES GLÜHAUGE
  (10,8) (42,4,5), (11,8) (253,25,25), (10,9) (191,20,21), (11,9) (222,23,23); braune Haare/Bart (x 5 und x 12, y 8–13). Kein Lid → kein Blinzeln; das Auge flackert nur INNERHALB dieser vier Pixel.
* ROTE SPRENKEL rechts vom Kopf (x 13–16, y 7–10; (124,58,59)/(159,73,72)/(140,65,64)): zerfetztes Ende des roten Kopftuchs (Annahme; rote Pixel (8–9, 7) sitzen ebenfalls unter dem Hutrand). Bleiben fest am Kopf.
* RECHTER ARM (x 14–16, y 13–16, dunkelgrauer Ärmel) → rot-weiß gestreifte MANSCHETTE (x 17, y 13–16) → ENTERHAKEN aus Metall (x 18–23, y 11–17; (67,64,73)/(138,148,154)/(157,168,174)/(184,197,204)).
* LINKER ARM hängt (x 0–4, y 12–17), rot-weiße Manschette (x 0–2, y 18), Knochenhand (x 0–3, y 19–21).
* RUMPF (x 4–13, y 12–19): Weste mit goldenen Borten und Totenkopf-Gürtelschnalle (Schachbrett weiß/braun); HOSE (y 20–22), STIEFEL mit Goldkante (y 23–25).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos, Frame 0 = Original):
* HAKEN-DROHEN (Idle-Idee): der rechte Arm hebt den Haken als POSE (Arm + Manschette + Haken; der Haken selbst bleibt starr, der Ärmel schwenkt spaltenweise ≤ 1 px Gefälle um die Schulter x 14):
  Frames 6–21 hoch auf 2 px, halten, kurz nachzucken (1 px ab/auf), ab; Frames 32–39 ein kleiner zweiter Ruck (1 px).
* SPARKLE am Haken (Metall, Regel 12/14/34): kurzer Stern an der Hakenspitze, wenn der Haken oben ankommt (Frames 11–14), sonst lange Pause.
* GLÜHAUGE flackert innerhalb der vier Augenpixel (Frames 2–4, 24–25, 28–30, 42–43: die hellen Rottöne tauschen/dunkeln eine Stufe ab).
* ATMEN/WIPPEN (zweimal je Schleife, 1 px): die Hosenzeile y 21 wird texturiert eingefügt (anim_textur) → Rumpf, Kopf, Hut und rechter Arm heben sich starr; der linke Arm (Spalten x 0–3) geht starr mit; Stiefel bleiben am Boden.
  Kopf und Hut bewegen sich nie seitlich.
Fest: Hut, Emblem, Schnalle, Kopftuch-Sprenkel, linker Arm (nur Mitheben). Keine Partikel, kein Feuer. Ergänzungen: keine (der Arm gibt beim Heben nichts Verdecktes frei – unter ihm ist Hintergrund).
"""
import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1
import anim_textur as TX
TX.umleiten(nicht_holen=[(0, 0, 0), (13, 13, 13)])

N, MS = 48, 70
spr = L.lade('doomed-pirate')
S = N1.Szene(spr, (4, 6, 4, 3))
H, W, OFF = S.H, S.W, S.OFF
xx, yy = S.xx, S.yy

ARM_R = S.da & (xx >= 14) & (yy >= 11) & (yy <= 17)
ARM_L = S.da & (xx <= 3) & (yy >= 12)
KOERPER = S.da & ~ARM_R & ~ARM_L
E_K, E_AR, E_AL = S.ebene(KOERPER), S.ebene(ARM_R), S.ebene(ARM_L)

HUB = {6: 1, 7: 1, 8: 2}
HEBEN = [1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1]           # ab Frame 6
RUCK = [1, 1, 1, 1, 1, 1, 1, 1]                                    # ab Frame 32
AUGE = {(11, 8): [(253, 25, 25), (222, 23, 23), (191, 20, 21)], (11, 9): [(222, 23, 23), (191, 20, 21), (152, 28, 28)],
        (10, 9): [(191, 20, 21), (222, 23, 23), (253, 25, 25)], (10, 8): [(42, 4, 5), (42, 4, 5), (142, 26, 27)]}
for (x, y), r in AUGE.items():
    assert S.col(x, y) == r[0], (x, y, S.col(x, y))
FLACKER = {2: 1, 3: 2, 4: 1, 24: 1, 25: 1, 28: 1, 29: 2, 30: 1, 42: 1, 43: 1}
WEISS, HELL = (246, 255, 255), (184, 197, 204)
TEST_EBENEN = 'koerper'


def arm_dy(k):
    """Spaltenversatz des rechten Arms bei Hubstufe k (Leinwandspalten)."""
    def f(x):
        sx = x - OFF[0]
        if k == 0 or sx <= 14:
            return 0
        if k == 1:
            return -1 if sx >= 16 else 0
        return -1 if sx <= 16 else -2
    return f


def frame(i, nur=None):
    kb = E_K.copy()
    st = FLACKER.get(i, 0)
    if st:
        for (x, y), r in AUGE.items():
            kb[OFF[1] + y, OFF[0] + x, :3] = r[st]
    k = N1.huelle(i, N, 6, HEBEN) or N1.huelle(i, N, 32, RUCK)
    arm = N1.spalten_dy(E_AR, arm_dy(k))
    f = L.zusammen(H, W, [(kb, 0, 0), (arm, 0, 0)])
    n = 1 if (i % 24) in range(12, 21) else 0
    f = TX.streck_zeile(f, OFF[1] + 21, n)
    f = L.zusammen(H, W, [(f, 0, 0), (E_AL, 0, -n)])
    fk = {11: 0, 12: 1, 13: 2, 14: 1, 15: 0}.get(i)
    if fk is not None and nur != 'koerper':
        px, py = S.P(22, 12)
        N1.funkel(f, px, py - 2 - n, fk, WEISS, HELL)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('doomed-pirate', 'Doomed Pirate', frames, MS, spr, OFF, C.vorschau_arg())
