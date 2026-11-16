# -*- coding: utf-8 -*-
"""Idle-Animation für „Ash Worms“ (Creature) — ein Aschewurm: dunkelgrauer Kopf mit zwei Zangenarmen, der aus seinem gerippten, aschfarbenen Leib/Kokon ragt.

Quelle: src/ash-worms.png (17×19 px, 15 Farben).
PICK: [["Motive", 786, 2]]   (Ebene „Ash Worm“; Figur 2 enthält ZWEI Würmer und einen losen Fühler – genommen ist EIN Exemplar: der untere linke Wurm,
  Ebenenausschnitt x 257–273, y 167–185, größte zusammenhängende Komponente. Die losen, eingerollten Fühler der Karte (eigene Kleinfiguren) und der große graue Wurm
  derselben Ebene (andere Karte) gehören nicht dazu. Die Quelle des Exemplars ist vollständig.)

Was im Sprite ist (x, y):
* KOPF (x 4–10, y 0–8), Dunkelgrau (26/51/77/89): Scheitelkamm (5–8, 0–3); rote AUGEN (136,0,0) bei (5,2) und (8,2); MAUL in Zeile 4: zwei weiße Fangzähne (5,4), (8,4)
  mit schwarzem Schlund (6–7, 4) dazwischen (Weiß = Zähne, keine Partikel).
* LINKE ZANGE (x 0–3, y 4–9): Arm nach links unten, rotes Gelenk (1,6), weiße Klaue (2, 8–9).
* RECHTE ZANGE (x 10–16, y 2–7): Arm nach rechts oben, rotes Gelenk (15,5), weiße Klaue (13–14, 7).
* LEIB/KOKON (x 3–12, y 7–18): gerippt, Asche-Beige (links dunkel, rechts hell) mit fast schwarzen Lücken, dunkelbrauner Umriss (30,12,8); steckt im Boden.
Kein Metall → kein Glanz; kein Feuer (Asche ist kalt).

Idee: Der Wurm lauert im Kokon – klappert mit den Zangen, schnappt mit den Fangzähnen, zieht sich ruckartig 1 px zurück und kommt wieder hervor; Ascheflocken rieseln vom Leib.
Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos):
* Zangen (Periode 16, 3×): äußere Zangenhälften als STARRE Spaltenblöcke (links x 0–2, rechts x 13–16, jeweils mit Gelenk und Klaue) – links 1 px hoch / rechts 1 px tief,
  dann umgekehrt, dazwischen Ruhe. Nichts wird gestreckt; freiliegende Innenpixel an der Stufe werden Umriss (Regel 16).
* Schnappen (Frames 8–9 und 12–13): die Fangzähne schließen sich – der schwarze Schlund (6–7, 4) wird weiß, die Zahnpixel außen nehmen die graue Kopffarbe an.
* Zurückzucken (Frames 30–37): Kopf samt Zangen sinkt als Einheit 1 px in den Kokon (liegt HINTER dem Kokonrand – keine Lücke) und kommt wieder hoch.
* Blinzeln (Frames 22–23 und 42–43): rote Augen → dunkles Kopfgrau (26,26,26).
* Asche: 4 Flocken (2×2; Asche-Beige (149,131,107)/(124,102,91) aus dem Leib) lösen sich links/rechts vom Kokon und sinken langsam (je 20 Frames sichtbar).
Frame 0 = Original. Ergänzungen: keine (der Kopf verschwindet hinter dem Kokonrand, nichts wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6

N, MS = 48, 75
G = N4.Figur('ash-worms', 4, 4, 3, 3)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

DUNKEL, ROT, WEISS = f(6, 0), f(5, 2), f(5, 4)
KOKON = L.rechteck(spr, 3, 9, 13, 19) | L.farbmaske(spr, [f(4, 8)]) & L.rechteck(spr, 3, 7, 13, 9)
KOPF = G.da & ~KOKON
ASCHE = {'c': f(7, 10), 'r': f(4, 10)}
FLOCKEN = [dict(x=5, y=14, vy=6, vx=-2, off=46, form='s', dauer=18), dict(x=17, y=13, vy=7, vx=2, off=34, form='s', dauer=20, wackeln=1),
           dict(x=4, y=16, vy=5, vx=-1, off=22, form='s', dauer=20, wackeln=-1), dict(x=18, y=16, vy=5, vx=1, off=30, form='s', dauer=18)]
OBEN = np.zeros((H, W), bool); OBEN[:OFF[1] + 8] = True
TEST_EBENEN = 'koerper'


def block(a, x0, x1, dy):
    if not dy:
        return a
    m = np.zeros((H, W), bool); m[:OFF[1] + 10, OFF[0] + x0:OFF[0] + x1 + 1] = True
    rest, teil = N6.teil_schieben(a, m, 0, dy)
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def frame(i, nur=None):
    kopf = G.ebene(KOPF)
    kokon = G.ebene(KOKON)
    z = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0][i % 16]
    kopf = block(kopf, 0, 2, -z)
    kopf = block(kopf, 13, 16, z)
    if Hm.takt(i, N, 8, 2) or Hm.takt(i, N, 12, 2):
        Hm.setze(kopf, {(5, 4): f(4, 4), (8, 4): f(9, 4), (6, 4): WEISS, (7, 4): WEISS}, OFF)
    if Hm.takt(i, N, 22, 2) or Hm.takt(i, N, 42, 2):
        Hm.setze(kopf, {(5, 2): DUNKEL, (8, 2): DUNKEL}, OFF)
    kopf = G.schliessen(kopf, lambda x, y: DUNKEL, OBEN)
    duck = Hm.takt(i, N, 30, 8)
    a = L.zusammen(H, W, [(kopf, 0, duck), (kokon, 0, 0)])
    if nur:
        return a
    return L.zusammen(H, W, [(a, 0, 0), (N6.woelkchen(H, W, i, N, FLOCKEN, ASCHE), 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Ash Worms', [frame(i) for i in range(N)], MS, sys.argv, scale=8)
