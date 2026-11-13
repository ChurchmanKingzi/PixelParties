# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Exterminator“ (Creature) — vermummter Dampfzwerg mit Gasmaske, drei Dampfrohren auf dem Rücken und Flammenwerfer-Maske: ein Feuerstrahl
schießt aus der Maske nach unten (auf den Betrachter zu), aus den Rohren steigt Dampf.

PICK: [["MotiveSteamDwarfs", 434, "Ebene „Ebene #7“ (20×32): der Zwerg"], ["MotiveSteamDwarfs", 433, "Ebene „Ebene #10“ (16×28): gemalter Feuerstrahl, liegt bei (2,19) über dem Zwerg"]]
Abgleich mit data/card-art/native/Steam_Dwarf_Exterminator.png (Zwerg von vorn, Strahl aus der Maske nach unten). Nicht übernommen: Ebene 432 (brennendes Opfer), 431 (Rauchwolken
der Szene). Der Zwerg ist in der Quelle ohne Beine gemalt (unter dem Strahl liegt nichts; der Körper endet bei y 28) → der Strahl gehört zwingend zum Sprite, sonst wäre er unvollständig.
Zwei einzelne rote Pixel der Ebene 434 bei (5,31) und (14,31) (unter dem Strahl verborgen, Bedeutung unklar) sind weggelassen.
Quellen: src/steam-dwarf-exterminator.png (Zwerg, 20×29), src/steam-dwarf-exterminator-flamme.png (Vorlage für Form/Lage/Farben des Strahls, wird nicht direkt gezeigt).

Identifikation (20×29): drei graue Dampfrohre (x 0–4, 8–11, 15–19, y 0–7), dunkelrote Kapuze (y 7–13), Gasmaske: Augengläser weiß (7,16) und (12,16) mit Messingfassung
(ocker (6,16), (13,16), (7,14), (12,14), (9–10,15)) – Maske, blinzelt nicht; Maskenschnauze/Düse (x 8–11, y 17–20); dunkelroter Umhang (y 16–27), heller Metallbügel/Gürtel (x 3–16, y 24–26).

Ablauf (64 Frames à 65 ms = 4,2 s). Frame 0 = Original (Körper; der Strahl ist eine Posenfolge):
* Feuerstrahl (anim_feuer3, posen=16, halten=1 → 4 Zyklen): EIN zusammenhängender Strahl von der Düse (9–10,19) nach unten (schlanker Kegel, ~11 px breit); Mantel Rot → Orange →
  Gelb um den Creme-Kern; er läuft unten in drei eng beieinander liegenden Zungen aus (Auslauf des einen Strahls, keine seitlichen Nebenzungen, keine abgelösten Fetzen).
  Fuß lückenlos an der Düse. Farben nur aus der Flammenebene.
* Atmen (Periode 32): texturierte Zeile im Umhang bei y 22 (TX.streck_zeile); Kopf, Rohre und der Strahlansatz heben sich 1 px.
* Dampf: aus jedem der drei Rohre steigt reihum alle 2,1 s ein Wölkchen (2×2 → 5×3 → 2×2, hellgrau aus dem Metallbügel) langsam auf.
Ergänzungen: keine am Körper; der Strahl wird nach der gemalten Vorlage neu gezeichnet.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_feuer3 as F3
import anim_n9 as N9

SLUG = 'steam-dwarf-exterminator'
N, MS = 64, 65
sz = N9.Szene(SLUG, (5, 5, 12, 26))
spr = sz.spr
KOERPER = sz.teil(sz.da)
ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)      # Farben der Flammenebene 433
_X, _Y = sz.PL + 9.5, sz.PT + 19
# EIN zusammenhängender Strahl (Nutzer: keine „Extra-Flammen“ links/rechts): schlanker Kegel, dessen Ende in drei eng beieinander liegenden Zungen ausläuft (Füße im Kegel,
# keine seitlich abstehenden Zungen, fetzen=False → nichts schnürt sich ab und fliegt lose davon).
KEGEL = F3.Strahl(_X, _Y, 15, 1.2, 5.4, richtung=(0, 1), welle=10, bauch=0.12, schlag=0.5)
ENDE = [F3.Flamme(_X + dx, _Y + fy, l, b, richtung=(rx, 1), phase=ph, fuss=0, welle=9, fetzen=False, wiegen=0.3)
        for (dx, fy, l, b, rx, ph) in [(-2.2, 11, 9, 2.6, -0.05, 0.55), (0.0, 10, 15, 4.8, 0.0, 0.25), (2.2, 11, 9, 2.6, 0.05, 0.9)]]
FEUER = F3.Feuer(sz.H, sz.W, [KEGEL] + ENDE, [ROT, ORANGE, GELB, CREME], posen=16, halten=1)
DAMPF = {'c': (213, 213, 213), 'r': (189, 189, 189)}
PUFFS = [dict(x=sz.PL + x, y=sz.PT - 2, vx=vx, vy=-8, off=off, wackeln=1, leben=32)
         for (x, vx, off) in [(1, -2, 0), (9, 0, 11), (17, 2, 22)]]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N9.stufe(i, 32, 6, 14)
    k = TX.streck_zeile(KOERPER, sz.PT + 22, n)
    if nur:
        return k
    dampf = N9.dampf(sz.H, sz.W, i, N, PUFFS, DAMPF)
    return L.zusammen(sz.H, sz.W, [(dampf, 0, -n), (k, 0, 0), (FEUER.ebene(i, dy=-n), 0, 0)])


if __name__ == '__main__':
    N9.fertig(SLUG, 'Steam Dwarf Exterminator', frame, N, MS, spr, erlaubt=[ROT, ORANGE, GELB, CREME], check=[0, 3, 6, 9, 12, 20], zoom=7)
