# -*- coding: utf-8 -*-
"""Idle-Animation für „Ferocious Jaguar Warrior“ (Creature) — der Krieger in goldener Rüstung mit Jaguarhelm (sein Gesicht schaut aus dem Jaguarmaul) und hohem rotem Federkamm.

Quelle: src/ferocious-jaguar-warrior.png (16×34 px, 35 Farben).
PICK: [["MotiveSteamDwarfs", 262, 1]] (Ebene „Ferocious Jaguar Warrior“, komplett). Die Nachbarebenen 261/263 sind ganze Hintergrundbilder. Abgleich mit Ferocious_Jaguar_Warrior.png: stimmt.

Was im Sprite ist (x, y im 16×34-Sprite):
* FEDERKAMM (y 0–12): rote Federn (161,27,15)/(124,15,18)/(44,0,6) mit goldbraunen Kielen/Spitzen (101,65,3)/(201,124,46). Federn = weich; nur die Spitzen (y 0–5) wiegen sich.
* JAGUARHELM (y 11–21): gold (213,174,19)/(255,223,59); im schwarzen Maul die weißen Fangzähne (6,16–17) und (9,16–17) (Zähne, bleiben fest!), darunter das Gesicht des Kriegers:
  Augen = hellblaue Iris (5,17)/(10,17) über Augenweiß (5,18)/(10,18) (gleiche Augen wie Warrior/Guardian/Archer of Teocuilatl), Haut (164,98,41)/(187,112,47) y 18–20.
  Die Augen liegen frei im Helmmaul → sie blinzeln (Lid = Hautfarbe (139,82,16)).
* RÜSTUNG: Schulterstücke (y 22–23), goldene Armschienen (x 0–3 / 12–15, y 24–26), Fäuste (y 27–28), Brustpanzer mit grauem Gurt (y 22–23), Beinschienen (y 28–31), Füße (y 31–33).
Gold: Helm und Rüstung → ein kurzes Aufblitzen am Helm. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos); Idee: Kriegstanz auf der Stelle — er stampft abwechselnd auf, der Federkamm wippt nach.
* Stampfen: linker Fuß (Frames 6–8 und 30–32), rechter Fuß (18–20 und 40–42): der Fuß (3 Zeilen, starr) hebt sich 1 px vor die Beinschiene und fällt zurück. Der andere Fuß bleibt am Boden.
* Federkamm: nach jedem Stampfer biegen sich die Federspitzen (Zeilen 0–5 als Block) 4 Frames lang 1 px zur Seite (abwechselnd links/rechts). Der Helm selbst bleibt starr; kein Kopfneigen.
* Atmen (Periode 24): Beinzeile 29 wird einmal texturiert eingefügt (TX) — Rumpf, Arme, Kopf und Kamm heben sich 1 px.
* Blinzeln (Frames 26–28): Iris und Augenweiß → Hautfarbe.
* Aufblitzen am goldenen Helm (Frames 14–17, Stirn (4,14)): Mitte → kleines Kreuz → weg.
Frame 0 = Original. Ergänzungen: keine (der gehobene Fuß verdeckt nur die unterste Beinzeile).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
F = G.Figur('ferocious-jaguar-warrior', (3, 3, 3, 2))
spr = F.spr
fuss_l = F.box(2, 31, 5, 33)
fuss_r = F.box(10, 31, 13, 33)
rumpf = F.da & ~fuss_l & ~fuss_r
HAUT = F.f(5, 19)
WEISS, GOLD = F.f(5, 18), F.f(3, 14)
KAMM = {**{i: -1 for i in (9, 10, 11, 12)}, **{i: 1 for i in (21, 22, 23, 24)}, **{i: -1 for i in (33, 34, 35, 36)}, **{i: 1 for i in (43, 44, 45, 46)}}
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    k = F.ebene(rumpf)
    if i in (26, 27, 28):
        F.setze(k, {(5, 17): HAUT, (5, 18): HAUT, (10, 17): HAUT, (10, 18): HAUT})
    dx = KAMM.get(i, 0)
    if dx:
        Hm.zeilen_versatz(k, F.OFF, {y: dx for y in range(0, 6)})
    if not nur:
        Hm.stern4(k, 4, 14, Hm.folge(i, 14, [0, 1, 1, 0], N), WEISS, GOLD, off=F.OFF)
    k = F.streck(k, 29, Hm.stufe(i, 24, 1))
    fl = F.ebene(fuss_l, 0, -1 if i in (6, 7, 8, 30, 31, 32) else 0)
    fr = F.ebene(fuss_r, 0, -1 if i in (18, 19, 20, 40, 41, 42) else 0)
    return G.ueber(G.ueber(k, fl), fr)


if __name__ == '__main__':
    G.abschluss(F, 'Ferocious Jaguar Warrior', [frame(i) for i in range(N)], MS)
