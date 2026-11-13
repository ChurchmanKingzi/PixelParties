# -*- coding: utf-8 -*-
"""Idle-Animation für „The Spawn Mother“ (Creature) — weißer, prall gefüllter Brutsack mit dunkelgrünem Panzer, der pulsiert und Laichtröpfchen ausstößt.

PICK: [["MotiveIndia", 400, "Ebene „a“, Figur 2 (x 355–377, y 327–354; 23×28 px)"]]
Abgleich mit data/card-art/native/The_Spawn_Mother.png: der Körper samt Tröpfchenkranz stimmt (92 %). NICHT verwendet (in der Karte zu sehen, aber als Sprite unbrauchbar): der violette
Fangarm (Ebene 401, halbtransparent mit Verlauf ins Nichts) und die sechs roten Ringe in der schwarzen Masse (Ebene 402, halbtransparente Szenenebene). Rechts in Ebene 400 liegt das Schiff
(Szenerie). → Die Figur ist der Körper allein; Annahme im Bericht genannt.

Identifikation (23×28): dunkelgrüner Kopfpanzer (y 0–8) mit zwei weißen Flecken (x 5–8 und 13–16, y 3–5) und Mittelrippe (x 10–11); weißer, quer gerippter Brutsack (y 8–18, Weiß/Grau);
dunkelgrüne Blattspitze unten (y 18–27). 19 hellblaue Pixel (217,255,255) im Kranz um die untere Hälfte = Laichtröpfchen (1 px, Teil der Vorlage).
Keine sicheren Augen → kein Blinzeln. Kein Metall → kein Glanz.

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Brutsack pulsiert (Periode 32): der Sack schwillt um 1 und dann 2 Zeilen an (TX.streck_zeile bei y 14 und y 10, texturiert), der Kopfpanzer hebt sich mit; die Blattspitze bleibt stehen.
* Laichtröpfchen: jedes Tröpfchen der Vorlage ruht an seinem Platz und wird einmal je 32 Frames ausgestoßen (wandert in 6 Frames 3 px radial nach außen, verschwindet 2 Frames, sitzt wieder am Platz);
  reihum versetzt, so dass immer ein paar unterwegs sind. Es bleiben die 1-px-Tröpfchen der Kunst (keine neuen Partikel).
Ergänzungen: Pixel unter den Tröpfchen, die auf dem Körper liegen (FILL im Skript), Farbe = Nachbarpixel.
"""
import math

import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('the-spawn-mother', (5, 5, 5, 5))
spr = sz.spr
G = (217, 255, 255)
tropf = sz.ist(G)
koerper = spr.copy(); koerper[tropf] = 0
FILL = []
for _ in range(3):
    op = koerper[..., 3] > 0
    for y, x in zip(*np.nonzero(tropf & ~op)):
        nb = [(yy, xx) for yy, xx in ((y, x - 1), (y, x + 1), (y - 1, x), (y + 1, x)) if 0 <= yy < sz.sh and 0 <= xx < sz.sw and op[yy, xx]]
        if len(nb) >= 2:
            koerper[y, x] = koerper[nb[0]]; FILL.append((int(x), int(y)))
koerper[23, 16, :3] = (12, 26, 33); koerper[23, 6, :3] = (20, 39, 49)      # Randpixel wie die spiegelbildliche Seite
KOERPER = sz.teil(koerper[..., 3] > 0, koerper)
TROPFEN = []
for k, (y, x) in enumerate(zip(*np.nonzero(tropf))):
    w = math.atan2(y - 13.5, x - 11.0)
    TROPFEN.append((int(x), int(y), math.cos(w), math.sin(w), 1 + (k * 7) % 23))
TEST_EBENEN = ('figur',)


def puls(i):
    k = i % 32
    return 1 if 4 <= k < 8 or 16 <= k < 20 else 2 if 8 <= k < 16 else 0


def frame(i, nur=None):
    n = puls(i)
    a = KOERPER
    if n >= 1:
        a = TX.streck_zeile(a, sz.PT + 14, 1)
    if n >= 2:
        a = TX.streck_zeile(a, sz.PT + 9, 1)
    f = a.copy()
    if nur:
        return f
    for (x, y, cx, cy, start) in TROPFEN:
        k = (i - start) % 32
        if k >= 8:
            d = 0
        elif k >= 6:
            continue
        else:
            d = k // 2 + 1
        px, py = sz.PL + x + int(round(cx * d)), sz.PT + y + int(round(cy * d)) - (n if y < 10 else 0)
        f[py, px] = G + (255,)
    return f


if __name__ == '__main__':
    N7.fertig('the-spawn-mother', 'The Spawn Mother', frame, N, MS, spr, check=[0, 5, 10, 14, 18, 26], zoom=12)
