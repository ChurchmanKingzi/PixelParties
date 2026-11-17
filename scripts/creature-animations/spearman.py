# -*- coding: utf-8 -*-
"""Idle-Animation für „Spearman“ (Creature) — Speerträger in türkisblauer Vollrüstung auf Wache: stößt den Speer zweimal auf den Boden.

PICK: [["MotiveDeri", 227, "Ebene „Guarding the Gate“, linke Figur (x 0–21, y 0–29) – ein einzelner, vollständiger Speerträger; die Phalanx der Ebene 164 „Spearman“
        besteht aus genau diesem Sprite, dort aber gegenseitig überdeckt"]]
Abgleich mit data/card-art/native/Spearman.png (Phalanx aus diesen Speerträgern). Quelle vollständig.

Identifikation (22×30): Topfhelm mit drei Sehschlitzen (x 5–14, y 6–14; Schlitze x 8, 10, 12 … die hellen Balken x 9 und 11 sind die Stege) – Helm, blinzelt nicht;
Schulterplatten und Brust (y 15–24), Bildlinks hängender Arm mit Faust (x 0–4, y 16–24), bildrechts angewinkelter Arm (x 15–16), dessen Hand (x 17–21, y 16–20)
den Speer hält; Beine und Stiefel (y 25–29). Speer senkrecht bei x 20 (Holzschaft y 8–25, Eisenspitze x 18–21, y 0–9, Eisenschuh x 19–21, y 26–29), steht auf dem Boden.

Ablauf (60 Frames à 75 ms = 4,5 s). Frame 0 = Original:
* Atmen (Periode 30): texturierte Zeile im Rumpf bei y 22 (nur Spalten x 5–14, TX.streck_zeile); Helm, Schultern und der hängende Arm heben sich 1 px.
  Die Speerhand und der Speer bleiben stehen (der Speer steht auf dem Boden), nur der Oberarm (x 15–16) geht mit.
* Speerstoß (Frames 34–38 und 41–45): Hand + Speer heben sich als starre Einheit 1→2 px (Oberarm 1 px) und stoßen auf den Boden zurück; beim Aufprall je zwei
  kleine Staubwölkchen (2×2, Grau des Speerschuhs) links und rechts vom Speerfuß.
* Kurzes Sparkle an der Speerspitze (Frames 12–15) und am Helmscheitel (Frames 54–57) – Metall. Kopf nie seitlich.
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 60, 75
sz = N9.Szene('spearman', (3, 5, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ARM_L_M = (xx <= 4) & (yy >= 15) & (yy <= 24)
ARM_R_M = (xx >= 15) & (xx <= 16) & (yy >= 15) & (yy <= 21)
SPEER_M = (xx >= 17)
ARM_L, ARM_R, SPEER = sz.teil(ARM_L_M), sz.teil(ARM_R_M), sz.teil(SPEER_M)
RUMPF = sz.teil(sz.da & ~ARM_L_M & ~ARM_R_M & ~SPEER_M)
STAUB, WEISS = (153, 153, 153), (242, 255, 255)
STOSS = {34: 1, 35: 2, 36: 2, 37: 2, 41: 1, 42: 2, 43: 2, 44: 2}
BROCKEN = [dict(x=sz.PL + 17, y=sz.PT + 28, vx=-0.2, vy=-0.3, start=s, dauer=5) for s in (38, 45)] + \
          [dict(x=sz.PL + 22, y=sz.PT + 28, vx=0.4, vy=-0.25, start=s, dauer=5) for s in (38, 45)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N9.stufe(i, 30, 4, 14)
    st = STOSS.get(i, 0)
    r = TX.streck_zeile(RUMPF, sz.PT + 22, n)
    f = L.zusammen(sz.H, sz.W, [(r, 0, 0), (ARM_L, 0, -n), (ARM_R, 0, -max(n, 1 if st else 0)), (SPEER, 0, -st)])
    if not nur:
        f = L.zusammen(sz.H, sz.W, [(f, 0, 0), (N9.brocken(sz.H, sz.W, i, BROCKEN, STAUB), 0, 0)])
        s1 = N9.funkel_folge(i, N, 12, (1, 2, 2, 1))
        if s1:
            N9.funkel(f, sz.PL + 20, sz.PT + 2, s1, WEISS)
        s2 = N9.funkel_folge(i, N, 54, (1, 2, 2, 1))
        if s2:
            N9.funkel(f, sz.PL + 8, sz.PT + 7 - n, s2, WEISS)
    return f


if __name__ == '__main__':
    N9.fertig('spearman', 'Spearman', frame, N, MS, spr, check=[0, 6, 13, 34, 36, 38, 40, 55], zoom=14)
