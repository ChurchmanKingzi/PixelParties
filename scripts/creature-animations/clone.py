# -*- coding: utf-8 -*-
"""Idle-Animation für „Clone“ (Creature) — die blass-violette Eis-Kopie der Magierin (spiegelbildlich zum Original, das in der Karte rechts daneben steht).

Quelle: src/clone.png (13×22 px, 11 Farben).
PICK: [["Motive", 1591, 2]]   (Ebene „Ebene“, Figur 2 = die helle Kopie links; Figur 3 derselben Ebene ist das farbige ORIGINAL-Mädchen – nicht die Creature; die Eiskristalle
  derselben Ebene gehören zu anderen Karten). Die Kopie ist in der Ebene voll deckend (Alpha 255) und vollständig.

Was im Sprite ist (x, y) – abgelesen am spiegelbildlichen Original (Figur 3):
* HAAR (y 0–6, und links am Hinterkopf bis y 10): helle Strähnen.
* GESICHT (x 6–10, y 6–10), Blick nach rechts (Dreiviertelprofil): EIN sichtbares Auge – Pupille (8,7) dunkel (137,136,204), Augenweiß (7,8) hell (223,224,246).
* ARM/HAND (y 11–14): Unterarm vor dem Körper, Hand rechts (9–10, 13). Bleibt fest (im einfarbigen Sprite nicht sauber vom Rumpf zu trennen – Regel 1).
* KLEID (y 14–19) mit heller Saumborte (y 18, grau-weiß), FÜSSE (y 20–21).
Material: Eis/Schnee → kein Glanz, keine Sparkles (Regel 14).

Idee: Die Eis-Kopie steht da und „lebt“ wie ihr Vorbild – ihr Atem ist in der Kälte sichtbar, kalte Luft sinkt von ihr zu Boden.
Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos):
* Atmen (Periode 30, 2×): Kleidzeile 17 wird einmal texturiert eingefügt (anim_textur) – Oberkörper und Kopf steigen 1 px, Füße bleiben am Boden.
* Atemwolke (2× je Schleife, beim Ausatmen): vor dem Mund (rechts, y ≈ 9) entsteht ein 2×2-Wölkchen, wächst zum 4×4-Kreis, treibt nach rechts oben und schrumpft
  wieder (nie kleiner als 2×2). Farben (223,224,246)/(193,193,230) aus dem Sprite.
* Kalte Luft: 3 kleine Wölkchen sinken hinter der Figur seitlich an Kleid und Füßen langsam zu Boden (Kaltluft sinkt).
* Blinzeln (Frames 20–22 und 50–51): nur das eine sichtbare Auge – Pupille und Augenweiß nehmen die Gesichtsfarbe (193,193,230) an.
Frame 0 = Original. Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6
import anim_textur as TX
TX.umleiten()

N, MS = 60, 75
G = N4.Figur('clone', 4, 7, 4, 3)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

GESICHT = f(7, 7)                                   # (193,193,230)
HAUCH = {'c': f(4, 3), 'r': f(3, 2)}                # (223,224,246) / (193,193,230)
ATEM = [dict(x=16, y=13, vx=4, vy=-6, off=N - 15, form='o', dauer=14), dict(x=16, y=13, vx=4, vy=-5, off=N - 45, form='o', dauer=14)]
KALT = [dict(x=4, y=17, vy=7, vx=-1, off=N - 4, form='s', dauer=22), dict(x=15, y=19, vy=5, vx=2, off=N - 24, form='s', dauer=20),
        dict(x=5, y=20, vy=4, vx=-2, off=N - 40, form='s', dauer=18)]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    a = G.ebene()
    if Hm.takt(i, N, 20, 3) or Hm.takt(i, N, 50, 2):
        Hm.setze(a, {(8, 7): GESICHT, (7, 8): GESICHT}, OFF)
    if Hm.stufe(i, N / 2, 1):
        a = TX.atmen(a, G.PT + 17, 0, 1, 0)
    if nur:
        return a
    hinten = N6.woelkchen(H, W, i, N, KALT, HAUCH)
    vorn = N6.woelkchen(H, W, i, N, ATEM, HAUCH)
    return L.zusammen(H, W, [(hinten, 0, 0), (a, 0, 0), (vorn, 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Clone', [frame(i) for i in range(N)], MS, sys.argv, scale=8)
