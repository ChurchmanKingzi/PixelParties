# -*- coding: utf-8 -*-
"""Idle-Animation für „Black Marketeer“ (Creature) — der Schwarzhändler mit der schwarzen Stachelmähne, dem Halstuch vor dem Mund und dem aufgeschlagenen Mantel voller Ware.

Quelle: src/black-marketeer.png (16×25 px, 37 Farben).
PICK: [["MotiveMoe", 453, 1]]     (Ebene „Black Marketeer“, Figur 1; 100 % Treffer mit der Kartenkunst, kommt nur in dieser Karte vor; die Quelle ist vollständig –
  die übrigen Treffer sind Kleinteile anderer Karten)

Aufruf:   python3 black_marketeer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/black-marketeer.png + .json

Was im Sprite ist (x, y im 16×25-Sprite):
* HAAR (y 0–8): schwarze, stachelige Mähne (0,0,0) mit grauen Strähnen (48…90), zwei Spitzen oben bei (5,0) und (11,0–1); hängt bis über die Stirn.
* GESICHT (y 7–10): Haut (7–8, 7–8); zwei AUGEN je 1×2 px: hellblaue Iris (172,213,255) bei (5,9) und (10,9), Augenweiß (246,255,255) darunter (5,10), (10,10) – dieselbe Bauart wie beim Barkeeper;
  rotbraune Nase (6, 9–10); blaugraues HALSTUCH vor dem Mund (7–9, 9–10) mit weißem Pixel (8,10) (Zahn/Tuchfalte – bleibt fest), das Tuchende hängt über die Brust (9–11, 11–13).
* MANTEL (y 11–23): außen schwarz (19,19,19)/(48…90) (Ärmel x 1–3 und x 11–14), innen braunes Futter (63,31,15)…(175,127,64) mit der WARE: helle Klinge/Metallstück (181,195,199) bei (10, 12–13),
  weißes Metall (248,248,247) am linken Ärmel (2,15), ein blaugrauer HAKEN/Sichel rechts außen (13–15, 14–17), graues Stück (5,20), weiß-graues Stück am Saum (10–11, 23).
  Hautfarbene Pixel (3,14)/(12,14) und (3,18)/(12,18): Hände bzw. Mantelknöpfe – nicht eindeutig, deshalb werden die Arme NICHT einzeln bewegt (Regel 1).
* STIEFEL (y 22–24): schwarz.
Metall: nur die Ware (Klingen/Haken) → kurze Sparkles dort (Regel 34). Kein Feuer, keine Partikel.

Idee: Der Schwarzhändler hält den Mantel auf und „bietet an“ – seine Ware blitzt der Reihe nach kurz auf, er duckt sich dabei verstohlen (geht 1 px in die Knie und kommt wieder hoch) und blinzelt.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Atmen (Periode 20, 3× je Schleife): Mantelzeile 19 wird einmal texturiert eingefügt (anim_textur) – Oberkörper, Arme, Haken und Kopf steigen 1 px, Stiefel bleiben.
* Ducken (Frames 37–43, in der Atempause): Mantelzeile 21 wird entfernt (L.streck_zeile n = −1): die ganze Figur über den Stiefeln sinkt 1 px („in die Knie“) – verstohlenes Abtauchen, kein seitliches Kopfbewegen.
* Ware blitzt (Sparkle Mitte → Kreuz → Mitte, je 3 Frames): Klinge (10,12) ab Frame 6, Haken (14,15) ab Frame 16, Metallstück (2,15) ab Frame 28, Saumstück (11,23) ab Frame 50 (bleibt am Boden stehen).
  Kern = Weiß (255,255,255) aus dem Sprite, Arme = Klingenfarbe (181,195,199).
* Blinzeln (Frames 12–14 und 46–48): Iris und Augenweiß beider Augen nehmen die Hautfarbe (213,164,98) an.
Frame 0 = Original. Ergänzungen: keine (nichts wird freigelegt).
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
G = N4.Figur('black-marketeer', 3, 3, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

HAUT = f(3, 14)                       # (213,164,98)
WEISS, STAHL = f(8, 10), f(10, 12)    # (255,255,255), (181,195,199)
AUGEN = [(5, 9), (5, 10), (10, 9), (10, 10)]
HAAR_UMRISS, MANTEL_UMRISS = f(5, 0), f(1, 14)
FUNKEN = [(6, 10, 12), (16, 14, 15), (28, 2, 15)]      # (Startframe, x, y) – am Oberkörper (gehen mit dem Atmen mit)
FUNKE_SAUM = (50, 11, 23)                               # am Saum unten (steht still)


def frame(i):
    k = G.ebene()
    if Hm.folge(i, 12, [1] * 3, N) or Hm.folge(i, 46, [1] * 3, N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    for s, x, y in FUNKEN:
        N4.funkeln(k, x, y, Hm.folge(i, s, [0, 1, 2], N), WEISS, STAHL, OFF)
    brust = Hm.stufe(i, N / 3, 1)
    duck = Hm.takt(i, N, 37, 7)
    if brust and not duck:
        k = TX.atmen(k, G.PT + 19, 0, 1, 0)
    elif duck and not brust:
        k = L.streck_zeile(k, G.PT + 21, -1)
    N4.funkeln(k, FUNKE_SAUM[1], FUNKE_SAUM[2], Hm.folge(i, FUNKE_SAUM[0], [0, 1, 2], N), WEISS, STAHL, OFF)
    return G.schliessen(k, lambda x, y: HAAR_UMRISS if y < 9 else MANTEL_UMRISS)


if __name__ == '__main__':
    N4.abschluss(G, 'Black Marketeer', [frame(i) for i in range(N)], MS, sys.argv)
