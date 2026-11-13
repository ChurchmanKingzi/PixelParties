# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Wizard“ (Creature) — Skelett mit blauem Sternenhut, breitet die Knochenarme aus und lässt Zauberfunken steigen.

PICK: [["Motive", 810, "Ebene „Skeleton Wizard“ (20×29 px, ganze Ebene)"]]
Abgleich mit data/card-art/native/Skeleton_Wizard.png: die Figur ist die Ebene (Ebene 809 ist ein halbtransparenter Schein und wird nicht verwendet).

Identifikation (20×29): spitzer blauer Zaubererhut mit breiter Krempe (y 0–12; Blau (13,27,44)…(141,170,207)) und acht gelben Sternpunkten (252,252,3); Schädel y 13–15 (weiße Stirn,
schwarze Augenhöhlen (6–7,15) (12–13,15)); waagerecht ausgestreckte Knochenarme (y 16–19) mit blauen Stulpen/Händen (x 0–4 und 15–19, y 17–20); grauer Brustkorb (x 6–13, y 15–21),
Becken y 22–23, Beine mit blauen Stiefeln y 24–28. Kein Kiefer zu sehen → kein Klappern; leere Augenhöhlen → kein Blinzeln. Hut = Stoff (kein Glanz).

Ablauf (64 Frames à 70 ms = 4,5 s). Frame 0 = Original:
* Knochen federn (Periode 32): in der Wirbelsäule (y 21) wird eine texturierte Zeile eingefügt (TX.streck_zeile), Brustkorb, Arme, Kopf und Hut heben sich 1 px; Becken und Beine stehen.
  Der Kopf bewegt sich nie seitlich, der Hut geht starr mit dem Kopf.
* Beschwörungsgeste (Periode 32, versetzt): beide Unterarme mit Hand (x ≤ 4 bzw. x ≥ 15) heben sich als starre Einheit 1 px.
* Die Sterne auf dem Hut verlöschen reihum für 3 Frames (Gelb → Hutblau (51,102,170)): das Muster „wandert“, kein Glanz/keine Sparkles.
* Zauberfunken: neben jeder Hand steigt ein gelber 2×2-Punkt 7 px auf und vergehen (Lebensdauer 32 Frames, versetzt; Farbe der Hutsterne).
Ergänzungen: Umrisspixel (5,15)/(14,15) (49,24,0) neben der gehobenen Hand (Kopie des Rumpfpixels darunter).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 70
sz = N7.Szene('skeleton-wizard', (4, 4, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
GELB, BLAU = (252, 252, 3), (51, 102, 170)
ARM_L = sz.teil((xx <= 4) & (yy >= 15) & (yy <= 20) | (xx == 5) & (yy == 16))          # (5,16)/(14,16): Umrisspixel des Rumpfs doppelt, schließt die Kontur der gehobenen Hand
ARM_R = sz.teil((xx >= 15) & (yy >= 15) & (yy <= 20) | (xx == 14) & (yy == 16))
RUMPF = sz.teil(~(((xx <= 4) | (xx >= 15)) & (yy >= 15) & (yy <= 20)))
STERNE = [(int(x), int(y)) for y, x in zip(*np.nonzero(sz.ist(GELB)))]
FUNKEN = [dict(x=sz.PL - 2, y=sz.PT + 16, weg=-7, off=0, leben=32, wackeln=1), dict(x=sz.PL + 20, y=sz.PT + 16, weg=-7, off=16, leben=32, wackeln=1)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N7.stufe(i, 32, 4, 14)
    g = N7.stufe(i, 32, 14, 12)
    rumpf = RUMPF
    k = (i // 4) % 16
    if k < len(STERNE) and i % 4 < 3 and i >= 4:
        rumpf = rumpf.copy()
        x, y = STERNE[k]
        rumpf[sz.PT + y, sz.PL + x, :3] = BLAU
    rumpf = TX.streck_zeile(rumpf, sz.PT + 21, n)
    f = L.zusammen(sz.H, sz.W, [(rumpf, 0, 0), (ARM_L, 0, -n - g), (ARM_R, 0, -n - g)])
    if nur:
        return f
    return L.zusammen(sz.H, sz.W, [(N7.blasen(sz.H, sz.W, i, N, FUNKEN, GELB), 0, 0), (f, 0, 0)])


if __name__ == '__main__':
    N7.fertig('skeleton-wizard', 'Skeleton Wizard', frame, N, MS, spr, check=[0, 6, 16, 22, 40], zoom=12)
