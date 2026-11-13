# -*- coding: utf-8 -*-
"""Idle-Animation für „Pure Advantage Camel“ (Creature) — das braune Kamel mit weiß-grauer Mähne und Kettendecke über beiden Höckern, das mit offenem Maul kaut und spuckt.

Quelle: src/pure-advantage-camel.png (30×25 px, 10 Farben) = Kartenbild: Ebene 67 (Kamel, Maul zu) + Ebene 65 (Kopf mit OFFENEM Maul, liegt in der xcf deckungsgleich darüber).
  Zusatzdateien derselben Leinwand: src/pure-advantage-camel-zu.png (nur Ebene 67 = Maul geschlossen), src/pure-advantage-camel-maul.png (nur Ebene 65, 13×16).
PICK: [["MotiveEgypt", 67, 1], ["MotiveEgypt", 65, 1]]   (65: 100 % Treffer, 67: 94 % – der Rest ist vom offenen Maul verdeckt). Ebene 66 daneben ist die schwarz vermummte,
  umgeworfene Gestalt der Karte (das Opfer) – nicht Teil des Kamels. Die Quelle ist vollständig; zwei Maulstellungen liegen als Ebenen vor (Vorlage fürs Kauen).

Was im Sprite ist (x, y):
* KOPF (x 0–12, y 0–9), Blick nach links: weiß-graue Mähne/Stirnschopf (3–9, 1–3 und am Hals 2–8, 9–18), zwei AUGEN – Augenweiß (249,228,209) bei (3, 2–3) und (6, 2–3),
  Pupillen dunkel daneben; braune Schnauze (0–6, 4–6); braunes OHR (10–12, 3–5).
* MAUL: obere Schneidezähne weiß (0,7), (3,7), (0,8), (3,8); im offenen Zustand hängt der UNTERKIEFER (1–5, 10–13) mit zwei unteren Zähnen (1,10), (4,10) und Kinnbart (3–4, 14–15) herab.
  Weiße Pixel = Zähne, keine Partikel.
* KETTENDECKE über den zwei Höckern (x 10–29, y 5–15): weiß/grau mit schwarzem Maschenmuster – Stoff/Kettenmuster, kein blankes Metall → kein Glanz.
* BRUST/BEINE braun (x 4–26, y 12–24), vier Beine am Boden; SCHWANZ rechts (27–29, 11–15).

Idee: Das Kamel kaut gelangweilt (Maul auf – halb – zu, mit den beiden echten Maulstellungen der Quelle) und spuckt einmal je Schleife; dazu Atmen, Ohrzucken, Blinzeln.
Ablauf (64 Frames à 75 ms = 4,8 s, nahtlos):
* Kauen (Periode 8, durchgehend): offen (Ebene 65, = Frame 0) → halb (Unterkiefer als starre Einheit 1 px höher) → geschlossen (Ebene 67) → halb → offen.
* Spucken (Frames 33–41, Maul bleibt Frames 30–35 offen): bei weit offenem Maul fliegt ein Speichelklecks (2×2, weiß/hellgrau aus Zähnen/Mähne) im Bogen nach links unten weg.
* Atmen (Periode 32, 2×): Deckenzeile 13 (senkrechte Maschenlinien – sie werden nur länger, nicht dicker) wird einmal texturiert eingefügt (anim_textur, nur die Rumpfebene rechts vom Hals) – Höcker und Decke heben sich 1 px; Kopf, Hals und
  alle vier Beine bleiben stehen. Randpixel an der Naht werden Umriss (Regel 16).
* Ohr zuckt (Frames 10–12 und 44–46): das Ohr klappt als Einheit 1 px nach unten und zurück.
* Blinzeln (Frames 20–22 und 52–53): Augenweiß → Mähnengrau (187,187,187) (Lid in Fellfarbe).
Frame 0 = Original (Kartenbild mit offenem Maul).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6
import anim_textur as TX
TX.umleiten()

N, MS = 64, 75
G = N4.Figur('pure-advantage-camel', 9, 3, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
ZU = L.lade('pure-advantage-camel-zu')
MAUL = L.lade('pure-advantage-camel-maul')
f = G.f

UMRISS, FELL, AUGENWEISS = f(4, 0), f(4, 2), f(3, 2)
SPUCKE = {'c': f(0, 7), 'r': f(5, 1)}
RUMPF = (((G.yy == 5) & (G.xx >= 13)) | ((G.yy >= 6) & (G.yy <= 7) & (G.xx >= 12)) | ((G.yy >= 8) & (G.xx >= 10))) & (G.yy <= 13)   # Höcker + Decke (ohne Ohr, Hals, Brust)
OHR = L.rechteck(spr, 10, 3, 13, 6) & L.farbmaske(spr, [f(11, 3), f(11, 4)])
SPUCK = [dict(x=7, y=14, vx=-5, vy=5, off=N - 33, form='s', dauer=9)]
TEST_EBENEN = 'koerper'


def kopf(zustand):
    """2 = offen (Kartenbild), 1 = halb (Unterkiefer 1 px höher), 0 = geschlossen."""
    if zustand == 2:
        return spr.copy()
    if zustand == 0:
        return ZU.copy()
    a = ZU.copy()
    m = MAUL[:9, :, 3] > 0
    a[:9, :13][m] = MAUL[:9][m]
    kiefer = MAUL[10:16]
    k = kiefer[..., 3] > 0
    a[9:15, :13][k] = kiefer[k]
    return a


def frame(i, nur=None):
    q = kopf(2 if Hm.takt(i, N, 30, 6) else [2, 2, 1, 0, 0, 1, 2, 2][i % 8])     # vor dem Spucken bleibt das Maul weit offen
    k = L.platz(L.trenne(q, ~RUMPF)[0], H, W, G.PL, G.PT)
    r = L.platz(L.trenne(q, RUMPF)[0], H, W, G.PL, G.PT)
    if Hm.takt(i, N, 20, 3) or Hm.takt(i, N, 52, 2):
        Hm.setze(k, {(3, 2): FELL, (3, 3): FELL, (6, 2): FELL, (6, 3): FELL}, OFF)
    a = L.zusammen(H, W, [(r, 0, 0), (k, 0, 0)])
    if Hm.takt(i, N, 10, 3) or Hm.takt(i, N, 44, 3):
        rest, t = N4.starr(a, OFF, OHR, 0, 1); a = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
    if Hm.stufe(i, 32, 1):
        k2, r2 = L.trenne(a, np.pad(RUMPF, ((G.PT, G.PB), (G.PL, G.PR))) == 0)
        r2 = TX.streck_zeile(r2, G.PT + 13, 1)
        a = L.zusammen(H, W, [(r2, 0, 0), (k2, 0, 0)])
        a = G.schliessen(a, lambda x, y: UMRISS)
    if nur:
        return a
    return L.zusammen(H, W, [(a, 0, 0), (N6.woelkchen(H, W, i, N, SPUCK, SPUCKE, rand=0), 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Pure Advantage Camel', [frame(i) for i in range(N)], MS, sys.argv, scale=6)
