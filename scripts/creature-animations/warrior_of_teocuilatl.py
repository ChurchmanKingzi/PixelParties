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

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: er stößt den Speer im Atemrhythmus auf den Boden (Wachposten).
* Atmen (Periode 24): Rockzeile 24 wird einmal texturiert eingefügt (TX; nur Körperebene) — Oberkörper, Kopf und beide Arme heben sich 1 px (Frames 4–15 und 28–39).
* Speer-Stoß (zweimal je Schleife): Speer + goldener Arm heben sich als starre Einheit erst mit dem Atemzug 1 px, dann 2 px (Frames 7–14), und fahren in zwei Frames zurück auf den Boden.
  Der Speer wird nie gestreckt; die Schulter bleibt geschlossen (siehe Ergänzungen).
* Blinzeln (Frames 20–22 und 44–46): Iris und Augenweiß nehmen die Hautfarbe an.
* Aufblitzen: an der Stahlspitze (Frames 18–21) und am goldenen Handschuh (Frames 42–45): Mitte → kleines Kreuz → weg, jeweils während der Speer steht.
Frame 0 = Original. Kopf bewegt sich nur senkrecht.
Ergänzungen (Körperebene, unter dem goldenen Arm, sichtbar nur wenn der Arm 1 px höher steht als der Körper): (8,15) Hautschatten (164,98,41), (9,14) Umriss (49,24,0).
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
SCHATTEN, UMRISS = F.f(9, 15), F.f(10, 14)
WEISS, HELLGOLD = F.f(11, 12), F.f(5, 16)
ATEM = [0] * 4 + [1] * 12 + [0] * 8
SPEER = [0] * 4 + [1] * 3 + [2] * 8 + [1] + [0] * 8
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    at, sp = ATEM[i % 24], SPEER[i % 24]
    k = F.ebene(rumpf)
    F.setze(k, {(8, 15): SCHATTEN, (9, 14): UMRISS})
    if i in (20, 21, 22, 44, 45, 46):
        F.setze(k, {(11, 11): HAUT, (11, 12): HAUT, (16, 11): HAUT, (16, 12): HAUT})
    k = F.streck(k, 24, at)
    fig = G.ueber(G.ueber(k, F.ebene(arm, 0, -sp)), F.ebene(speer, 0, -sp))
    if not nur:
        Hm.stern4(fig, 3, 3, Hm.folge(i, 18, [0, 1, 1, 0], N), WEISS, WEISS, off=F.OFF)
        Hm.stern4(fig, 5, 17, Hm.folge(i, 42, [0, 1, 1, 0], N), WEISS, HELLGOLD, off=F.OFF)
    return fig


if __name__ == '__main__':
    G.abschluss(F, 'Warrior of Teocuilatl', [frame(i) for i in range(N)], MS)
