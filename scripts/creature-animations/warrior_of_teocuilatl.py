# -*- coding: utf-8 -*-
"""Idle-Animation für „Warrior of Teocuilatl“ (Creature) — der Krieger mit den blauen Stachelhaaren, dem Gras-Rock, dem goldenen Armschutz und dem Speer mit Stahlspitze.

Quelle: src/warrior-of-teocuilatl.png (25×30 px, 54 Farben).
PICK: [["MotiveSteamDwarfs", 186, 1]] (Ebene „Warrior of Teocuilatl“, komplett; 4 Pixel mit Alpha 253 wurden deckend gemacht). Nachbarebene 185 („Ebene #184“) = die zwei großen Glitzersterne
      der Kartenkunst (Effekt-Ebene) — nicht übernommen, aber Anlass für das kurze Aufblitzen an Stahlspitze und Gold. Abgleich mit Warrior_of_Teocuilatl.png: stimmt.

Was im Sprite ist (x, y im 25×30-Sprite):
* SPEER (x 0–4, y 0–29): Stahlspitze (grau/weiß, y 0–9), Holzschaft (x 2, braun mit grauen Bändern), Stahlschuh unten (y 26–29). Der Schaft liegt VOR der Faust.
* GOLDENER ARM (x 1–9, y 14–20): Armschutz/Handschuh gold-orange (249,142,24)…(249,229,24) von der Schulter (7–9,14) schräg zur Faust (1–6, 16–20) am Schaft.
* HAARE (x 8–19, y 2–10): schwarz-blaue Stacheln. GESICHT (y 9–13): Haut; Augen: hellblaue Iris (11,11)/(16,11) über weißem Pixel (11,12)/(16,12); daneben goldene Gesichtsbemalung (12,12)/(15,12).
* OBERKÖRPER nackt (y 14–20), rechter Arm hängt (x 19–24, y 15–23). GRAS-ROCK (y 20–27), Füße (y 27–29).
Metall/Gold: Stahlspitze und goldener Armschutz → nur dort je ein kurzes Aufblitzen. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: Wachposten am Speer — er atmet schwer, und sein goldener Arm (echtes Gold) glänzt regelmäßig.
* Atmen (Periode 24): Rockzeile 24 wird einmal texturiert eingefügt (TX; nur Körperebene) — Oberkörper, Kopf und beide Arme heben sich 1 px (Frames 4–15 und 28–39).
* Goldener Arm + Speer gehen FEST mit dem Oberkörper mit (gleicher Versatz in jedem Frame): der Arm sitzt in jedem Frame exakt wie im Original an der Schulter
  (Runde 8: „Arm wirkt disjointed“ — das frühere getrennte Anheben von Arm/Speer um 1–2 px gegenüber der Schulter ist entfernt). Der Speer wird starr von der Faust 1 px mitgenommen.
* GOLD GLÄNZT (Runde 8): alle 1,8 s (Frames 0–9 und 24–33 … Start 16 und 40) wandert ein Lichtband schräg von der Faust bis zur Schulter über den GANZEN goldenen Arm
  (1 Stufe heller auf der Goldrampe des Sprites, im Kern 2 Stufen bis Augenweiß (246,255,255)); am Ende ein kurzer Sparkle an der Faust (Mitte → kleines Kreuz → weg, 3 Frames).
* Blinzeln (Frames 20–22 und 44–46): Iris und Augenweiß nehmen die Hautfarbe an.
* Aufblitzen an der Stahlspitze (Frames 8–10): Mitte → kleines Kreuz → weg.
Frame 0 = Original. Kopf bewegt sich nur senkrecht.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('warrior-of-teocuilatl', (3, 2, 4, 2))
spr = F.spr
r, g, b = (spr[..., k].astype(int) for k in range(3))
gold = F.da & (r > 240) & (g > 130) & (g < 235) & (b < 30)
arm = gold & (F.xx <= 9) & (F.yy >= 14) & (F.yy <= 20)
speer = F.da & (F.xx <= 4) & ~arm
rumpf = F.da & ~arm & ~speer
HAUT = F.f(13, 11)
WEISS, HELLGOLD = F.f(11, 12), F.f(5, 16)
ATEM = [0] * 4 + [1] * 12 + [0] * 8
RAMPE = G.goldrampe(spr, arm, F.f(11, 12))
GLANZ, GLANZ_DAUER = (16, 40), 9
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    at = ATEM[i % 24]
    k = F.ebene(rumpf)
    if i in (20, 21, 22, 44, 45, 46):
        F.setze(k, {(11, 11): HAUT, (11, 12): HAUT, (16, 11): HAUT, (16, 12): HAUT})
    k = F.streck(k, 24, at)
    ar = F.ebene(arm, 0, -at)                                        # Arm und Speer immer mit dem Oberkörper (kein eigener Hub → keine Stufe an der Schulter)
    if not nur:
        G.goldglanz(ar, arm, (F.pl, F.pt - at), i, N, GLANZ, GLANZ_DAUER, RAMPE)
    fig = G.ueber(G.ueber(k, ar), F.ebene(speer, 0, -at))
    if not nur:
        Hm.stern4(fig, 3, 3 - at, Hm.folge(i, 8, [0, 1, 0], N), WEISS, WEISS, off=F.OFF)
        for st in GLANZ:
            Hm.stern4(fig, 5, 17 - at, Hm.folge(i, st + GLANZ_DAUER - 2, [0, 1, 0], N), WEISS, HELLGOLD, off=F.OFF)
    return fig


if __name__ == '__main__':
    G.abschluss(F, 'Warrior of Teocuilatl', [frame(i) for i in range(N)], MS)
