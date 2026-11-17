# -*- coding: utf-8 -*-
"""Idle-Animation für „Slave Trader“ (Creature) — der grauhaarige Händler im roten Mantel mit dem selbstzufriedenen Lächeln, der eine KETTE in der Hand hält (an ihr hängt in der Kunst die Gefangene).

Quelle: src/slave-trader.png (25×23 px, 35 Farben).
PICK: [["MotiveMoe", 416, 1]]     (Ebene „Slave Trader“, obere Figur = Händler samt Kette (Zeilen 0–22 der Ebene); die untere Figur derselben Ebene (schwarzes Wesen von hinten, Zeilen 25–49) steht in der Kunst
  am unteren Bildrand und gehört nicht dazu. Der xcf-Abgleich fand nur Kleinteile (Kettenglieder „Slave Trader #4“ 415, die geflügelte Gefangene „Slave Trader #5“ 418 – das ist die Ware, nicht der Händler);
  die Figur wurde über einen Gesichtsausschnitt der Kartenkunst gefunden (Abweichung 3/255). Vollständig; die Kette endet links am Ebenenrand (sie führt zur Gefangenen).)

Aufruf:   python3 slave_trader.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slave-trader.png + .json

Was im Sprite ist (x, y im 25×23-Sprite):
* HAAR (x 11–22, y 0–10): grau (153…207), schwarze Brauen (13–15,4)/(18–20,4). GESICHT (y 5–10): Haut; die Augen sind zwei lachende Bögen „^ ^“ ((14,6),(13,7),(15,7) und (19,6),(18,7),(20,7)) –
  geschlossen-lächelnd → kein Blinzeln (Regel 21: nicht raten).
* MANTEL (y 11–17): weinrot (134,8,30)/(90,7,25)/(192,50,72), weißes Hemd in der Mitte (16–17, 12–17). Rechte Hand (vom Betrachter aus) bei (22–24, 14–16) in die Hüfte gestützt.
* KETTENHAND (x 9–12, y 14–17): Faust (10–11,16) Haut, Kettenglied in der Faust (10–11,15), das lose Kettenende hängt darunter (10–11,17).
* KETTE (x 0–8, y 10–17): zwei gepunktete Diagonalen (helle Glieder (145…198), dunkle (99,99,99)) von der Faust nach links oben.
* HOSE hellgrau (y 18–20), SCHUHE schwarz mit weißen Gamaschen (y 21–22).
Metall: die Kette – sie bekommt Bewegung statt Glanz. Keine Partikel.

Idee: Er RUCKT an der Kette (Faust samt Kette 1 px nach unten), die Kette klirrt nach (eine Welle läuft durch die Glieder) – und er lacht in sich hinein (kurzes schnelles Schulterwippen).
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Ruck (Frames 8–10 und 38–40): Faust + Kette (alles x ≤ 12 ab y 14 sowie die ganze Kette x ≤ 8) als Einheit 1 px nach unten; die Kette wird nie gestreckt.
* Nachklirren (je 12 Frames nach dem Ruck): die Kettenspalten (x ≤ 8) schwingen als laufende Welle ±1 px senkrecht, an der Faust fest, ausklingend (L.spalten_welle).
* Lachen (Frames 24–34): Hosenzeile 19 wird im 2-Frame-Wechsel einmal texturiert eingefügt (anim_textur) – Oberkörper, Arme, Kette und Kopf wippen 1 px; ein ruhiger Atemzug in den Frames 48–56.
  Der Kopf bewegt sich nicht seitlich.
Frame 0 = Original. Ergänzungen (Quellfarben, nur während des Rucks sichtbar): über der abgesenkten Faust (10,14) → Umriss (49,24,0), (11,14) und (12,14) → Mantelrot (134,8,30) (der Ärmel reicht weiter).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
G = N4.Figur('slave-trader', 2, 2, 3, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
UMRISS, ROT = f(9, 14), f(11, 14)
kette = G.da & (G.xx <= 8)
faust = G.da & (G.xx >= 9) & (G.xx <= 12) & (G.yy >= 14) & (G.yy <= 17)
rumpf = G.da & ~kette & ~faust
G.erlaubt = G.erlaubt | {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(kette))}


def frame(i):
    k = G.ebene(rumpf)
    ruck = 1 if (Hm.takt(i, 30, 8, 3)) else 0
    if ruck:
        Hm.setze(k, {(10, 14): UMRISS, (11, 14): ROT, (12, 14): ROT}, OFF)
    ke = G.ebene(kette)
    j = (i - 11) % 30
    if j < 12:
        ke = L.spalten_welle(ke, G.PL + 9, 1.4 * (1 - j / 12.0), L.sinus(j, 6), potenz=0.6, lauf=2.5)
    fa = G.ebene(faust)
    fig = L.zusammen(H, W, [(k, 0, 0), (ke, 0, ruck), (fa, 0, ruck)])
    hub = (((i - 24) // 2) % 2 if 24 <= i <= 34 else 0) or (1 if 48 <= i <= 56 else 0)
    if hub:
        fig = TX.streck_zeile(fig, G.PT + 19, 1)
    return G.schliessen(fig, lambda x, y: UMRISS)


if __name__ == '__main__':
    N4.abschluss(G, 'Slave Trader', [frame(i) for i in range(N)], MS, sys.argv)
