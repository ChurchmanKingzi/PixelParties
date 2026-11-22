# -*- coding: utf-8 -*-
"""Idle-Animation für „Drill Sergeant“ (Creature) — kahler Ausbilder in schwarzer Rüstung, brüllt Befehle und zeigt mit dem ausgestreckten Arm.

PICK: [["MotiveDeri", 156, "Ebene „Drill Sergeant“, nur der Ausbilder (Ausschnitt x 59–80, y 0–22); die 18 grauen Rekruten (Rückenansicht) derselben Ebene sind Beiwerk"]]
Abgleich mit public/cardgen/art/Drill_Sergeant.webp (Ausbilder oben, Rekrutenreihen unten). Quelle vollständig.

Identifikation (22×23): kahler Kopf von vorn (x 4–15, y 0–9; Ohren (4–5,5–6) und (14–15,5–6)), Augen hellblau/weiß (7,4–5) und (12,4–5) mit schwarzem Rand, rote Narbe über dem
linken Bildauge ((8,3), (7,6), (7,7), (7,8)) – bleibt fest, zum Brüllen geöffneter Mund (dunkelrot, x 9–10, y 7–8); schwarze Rüstung mit hellblau/weißen Glanzkanten;
Bildlinks angewinkelter Arm mit Faust an der Hüfte (x 0–4, y 9–17); bildrechts ausgestreckter, zeigender Arm (x 15–21, y 9–14, Hand hellgrau (19–20, 10–12));
Beine mit Stiefeln (y 18–22).

Ablauf (48 Frames à 75 ms = 3,6 s). Frame 0 = Original:
* Brüllen: der Mund ist offen (Original) und schließt sich zwischen den Kommandos kurz (Frames 6–9, 18–21, 30–33, 42–45) zu einer schmalen Linie.
* Zeigearm: bei jedem zweiten Kommando (Frames 10–15 und 34–39) stößt der ausgestreckte Arm als Pose 1 px hoch, die Hand (x ≥ 18) 2 px (Stufenpose, keine Streckung).
* Atmen (Periode 24): texturierte Zeile in der Rüstung bei y 15 (nur Rumpfspalten x 5–14); Kopf und beide Arme heben sich als Ganzes mit, Beine/Stiefel stehen.
* Blinzeln beider Augen (Frames 26–27). Kopf nie seitlich.
Ergänzungen: keine dauerhaften; in der Arm-Pose entsteht kein freier Rand (Achsel (15,13)/(15,14) bleibt durch die Rumpfkontur x 14 geschlossen).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 48, 75
sz = N9.Szene('drill-sergeant', (3, 3, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ARM_L_M = (xx <= 4) & (yy >= 9)
ARM_R_M = (xx >= 15) & (yy >= 9) & (yy <= 14)
RUMPF_M = sz.da & ~ARM_L_M & ~ARM_R_M
ARM_L, RUMPF = sz.teil(ARM_L_M), sz.teil(RUMPF_M)
ARM_R1, ARM_R2 = sz.teil(ARM_R_M & (xx <= 17)), sz.teil(ARM_R_M & (xx >= 18))
HAUT, MUND = (213, 164, 98), (94, 0, 0)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N9.stufe(i, 24, 3, 11)
    zu = N9.stufe(i, 12, 6, 4)
    stoss = N9.huelle(i, 24, 10, (1, 2, 2, 2, 1, 1))
    r = RUMPF.copy()
    px = lambda x, y, c: r.__setitem__((sz.PT + y, sz.PL + x), tuple(c) + (255,))
    if zu:
        px(9, 7, HAUT); px(10, 7, HAUT); px(9, 8, MUND); px(10, 8, MUND)
    if 26 <= i <= 27:
        for x in (7, 12):
            px(x, 4, HAUT); px(x, 5, (0, 0, 0))
    r = TX.streck_zeile(r, sz.PT + 15, n)
    return L.zusammen(sz.H, sz.W, [(r, 0, 0), (ARM_L, 0, -n), (ARM_R1, 0, -n - (1 if stoss else 0)), (ARM_R2, 0, -n - stoss)])


if __name__ == '__main__':
    N9.fertig('drill-sergeant', 'Drill Sergeant', frame, N, MS, spr, check=[0, 5, 7, 11, 12, 26], zoom=16)
