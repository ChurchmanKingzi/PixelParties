# -*- coding: utf-8 -*-
"""Idle-Animation für „Sky Shaman“ (Creature) — der im Schneidersitz sitzende Schamane mit dem großen schwarz-weiß-roten Federschmuck, der singt und sich dazu auf die Knie trommelt.

Quelle: src/sky-shaman.png (18×24 px, 26 Farben).
PICK: [["MotiveMoe", 386, 1]] (Ebene #33). Die 18 halbtransparenten schwarzen Pixel am unteren Rand der Ebene (Alpha 179; y 23–25) sind der Schlagschatten auf der Säule, auf der er in der
      Kartenkunst sitzt — Szenenteil, weggelassen. Die Säule (Hintergrund) gehört nicht zur Figur. Abgleich mit Sky_Shaman.png: stimmt überein.

Was im Sprite ist (x, y im 18×24-Sprite):
* FEDERSCHMUCK (y 0–14, um den ganzen Kopf): schwarze Federn mit weißen (255,255,255), grauen und roten (168,51,51)/(117,0,0) Spitzen. Starrer Kopfschmuck → bewegt sich nur mit dem Kopf.
* GESICHT (x 5–12, y 8–14): Haut (213,164,98)/(246,189,123); Augen = schwarze Striche (6–7,10) und (10–11,10) (geschlossen, Trance) → kein Blinzeln; rote Kriegsbemalung auf den Wangen
  (5–6,11)/(11–12,11); heller Nasenrücken (8–9, 10–11); MUND (8–9, 12–13) offen, rot (116,0,0)/(147,0,0)/(96,0,0) — er singt.
* WESTE/Schulterpolster grau (y 14–18), nackte Arme links (x 1–4) und rechts (x 13–16) y 15–21, Hände auf den Knien.
* Beine im Schneidersitz (y 19–23): dunkle Hose, braune Knie (75,26,9).
Kein Metall → kein Glanz; keine Partikel (die Rauchwolke der Ebene 387 liegt an anderer Stelle der xcf und gehört nicht dazu).

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: Trance-Gesang mit Knietrommeln.
* Singen: der Mund geht im Rhythmus auf und zu (zu = Hautfarbe in der oberen Mundzeile, die dunkle Mundlinie bleibt).
* Knietrommeln: abwechselnd hebt sich die linke und die rechte Hand 1 px vom Knie und fällt zurück (der hängende Unterarm wird um eine seiner drei gleichen Zeilen kürzer —
  L.heben_unten, nichts wird kopiert oder verbreitert); je Schleife 4 Schläge links, 4 rechts.
* Atmen (Periode 24, tief): Westenzeile 17 wird einmal texturiert eingefügt (TX) — Brust, Kopf und Federschmuck heben sich als Einheit 1 px; er sitzt, nichts schwebt.
Frame 0 = Original. Ergänzungen: keine (die Trennlinie Arm/Knie bei x 4 bzw. x 13 bleibt in der Körperebene stehen, daher entsteht unter der gehobenen Hand keine Lücke).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('sky-shaman', (2, 2, 3, 2))
spr = F.spr
arm_l = F.box(0, 18, 3, 21)
arm_r = F.box(14, 18, 17, 21)
rumpf = F.da & ~arm_l & ~arm_r
HAUT = F.f(7, 12)
MAUL = [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0]   # 0 offen (Original), 1 zu


def arm(m, hoch):
    a = F.ebene(m)
    return L.heben_unten(a, F.pt + 19, 1) if hoch else a


def frame(i):
    k = F.ebene(rumpf)
    if MAUL[i % 24]:
        F.setze(k, {(8, 12): HAUT, (9, 12): HAUT})
    fig = G.ueber(G.ueber(k, arm(arm_l, i % 12 in (2, 3, 4))), arm(arm_r, i % 12 in (8, 9, 10)))
    return F.streck(fig, 17, Hm.stufe(i, 24, 1))


if __name__ == '__main__':
    G.abschluss(F, 'Sky Shaman', [frame(i) for i in range(N)], MS)
