# -*- coding: utf-8 -*-
"""Idle-Animation für „Sacred Cattle“ (Creature) — heilige Kuh von vorn mit schwebendem goldenem Heiligenschein; sie kaut wieder.

PICK: [["MotiveDeri", 177, "Ebene „Sacred Cattle“ (16×24 px, Kuh + Heiligenschein)"]]
Nicht verwendet: Ebene 176 (weißes Fragezeichen über dem Kopf = Schriftzeichen der Szene), Ebene 175 (zwei Männer), Ebene 178 (Hintergrund). Für die Karte liegt keine Kartenkunst-Datei
unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (16×24): Heiligenschein = gelber Ring (255,255,85), x 3–12, y 0–2 (schwebt 1 Zeile über den Hörnern). Zwei gelbe Hörner (x 4–6 und 9–11, y 4–7), Ohren seitlich (x 0–3 und
12–15, y 7–8), weißer Kopf mit schwarzen Brauenstrichen (y 9) und Augenpunkten (4,11) (9,11), rosa Flotzmaul (x 5–10, y 14–15), weiß-graue Vorderbeine außen (x 0–4 und 11–15, y 10–18),
Brust y 16–18, Hinterbeine mit Hufen y 19–23.
Der Heiligenschein ist Gold → Lichtpunkt erlaubt; sonst kein Glanz.

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Atmen (Periode 32): in der Brust (y 17) wird eine texturierte Zeile eingefügt (TX.streck_zeile), Kopf und Vorderkörper heben sich 1 px; die Hufe stehen.
* Heiligenschein schwebt ±1 px (Periode 32, gegenläufig) über dem Kopf und geht mit dem Atmen mit; ein heller Lichtpunkt (2 px, Fellweiß (246,246,246) der Quelle) läuft einmal je 32 Frames um den Ring.
* Wiederkäuen: die untere Maulzeile (y 15) schiebt sich im 4-Frame-Takt 1 px hin und her (Frames 8–31).
* Blinzeln (Frames 40–42): Augenpunkte → Fellweiß.
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('sacred-cattle', (3, 3, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
GOLD, WEISS, FELL = (255, 255, 85), (255, 255, 255), (246, 246, 246)
RING = sz.teil(yy <= 2)
KUH = sz.teil(yy >= 3)
# Umlaufweg des Lichtpunkts auf dem Ring (im Uhrzeigersinn)
WEG = [(x, 0) for x in range(4, 12)] + [(12, 1)] + [(x, 2) for x in range(11, 3, -1)] + [(3, 1)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N7.stufe(i, 32, 6, 13)
    kuh = KUH.copy()
    if 8 <= i < 32 and (i // 4) % 2 == 1:
        z = kuh[sz.PT + 15, sz.PL + 5:sz.PL + 10].copy()
        kuh[sz.PT + 15, sz.PL + 5:sz.PL + 10] = np.roll(z, 1, axis=0)
    if 40 <= i <= 42:
        for x in (4, 9):
            kuh[sz.PT + 11, sz.PL + x, :3] = FELL
    kuh = TX.streck_zeile(kuh, sz.PT + 17, n)
    ring = RING.copy()
    if not nur:
        k = (i % 32) * len(WEG) // 32
        for d in (0, 1):
            x, y = WEG[(k + d) % len(WEG)]
            ring[sz.PT + y, sz.PL + x, :3] = FELL
    hb = -N7.sinus_px(i, 32, 1)
    return L.zusammen(sz.H, sz.W, [(kuh, 0, 0), (ring, 0, hb - n)])


if __name__ == '__main__':
    N7.fertig('sacred-cattle', 'Sacred Cattle', frame, N, MS, spr, check=[0, 8, 12, 24, 41], zoom=13)
