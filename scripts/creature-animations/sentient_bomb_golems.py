# -*- coding: utf-8 -*-
"""Idle-Animation für „Sentient Bomb Golems“ (Creature) — drei lebende Bomben-Golems mit brennender Lunte.

PICK: [["Motive", 1315, "ganze Ebene „Sentient Bomb Golems“ (73×32 px, alle drei Golems)"]]
Quelle vollständig (Abgleich mit data/card-art/native/Sentient_Bomb_Golems.png: gleiche drei Golems, gleiche Anordnung). Die Nachbarebenen 1316/1317 sind nur weiche
Bodenschatten (halbtransparent) und werden nicht verwendet. Die Karte heißt im Plural, die drei Golems stehen in einer Ebene → alle drei bilden die Figur.

Identifikation (Sprite-Koordinaten):
* Golem 1 (x 0–21, y 12–31, olivgrün): Kopf x 8–13, y 14–17 mit türkiser Lampe (9,15) (9,16) und rotem Auge (11–12,17); Stachelschultern y 18–21, roter Kern (11–12, 22–23),
  Arme x 1–5 / 16–20 (y 24–27) mit Krallen (x 0, 2, 19, 21; y 27–29), Beine x 5–16, y 27–31. Lunte = schwarzer Bogen (8–9,12) (7,13) (10,13) (6,14); an ihrem Ende der
  Funkenstern (gelb/hellgelb, x 3–6, y 13–16).
* Golem 2 (x 27–46, y 8–28, rotglühend): gleiche Gestalt, Auge und Kern sind schwarze Löcher (36–37, 13–14 und 19–20); Funkenstern direkt auf dem Kopf (x 35–37, y 8–10).
* Golem 3 (x 51–72, y 0–21, olivgrün): wie Golem 1 (Lampe (62,5) (62,6), Auge (60–61,7), Kern (60–61, 12–13)); Lunte (61,3), Funken darüber (y 0–2).
Fest bleiben: Beine/Füße (stehen am Boden), alle Umrisse.

Ablauf (64 Frames à 80 ms = 5,1 s; schwere Golems → langsam). Frame 0 = Original, nur die Funkensterne sind durch die Luntenflamme ersetzt:
* Lunten brennen: handgezeichneter 8-Bilder-Zyklus `F3.klein('lunte')` (halten 1, je Golem versetzt/gespiegelt), Farben der Quelle (Gelb, Hellgelb, Weiß), Fuß direkt am Luntenende
  (hinter der Figur → lückenloser Anschluss). Die Flamme geht mit dem Kopf mit.
* Schweres Atmen (Periode 32, je Golem versetzt): im Rumpf (nur Mittelteil zwischen den Armen) wird eine texturierte Zeile eingefügt (TX.streck_zeile); Kopf, Schultern und die Arme
  heben sich als starre Einheit 1 px (Arme werden nicht gestreckt), Beine bleiben stehen.
* Rotes Auge und Kern glimmen (Farbwechsel nur innerhalb der roten Pixel, zwei Rottöne der Quelle), türkise Lampe blinkt (zwei Türkistöne tauschen).
Ergänzungen: keine (es wird nichts freigelegt: Arme und Rumpf heben sich gemeinsam).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_feuer3 as F3
import anim_n7 as N7

N, MS = 64, 80
sz = N7.Szene('sentient-bomb-golems', (4, 4, 8, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
GELB, HELL, WEISS = (255, 255, 0), (255, 255, 203), (255, 255, 255)
funke = sz.ist(GELB, HELL, WEISS)
ROT1, ROT2, ROT3 = (130, 0, 0), (181, 0, 0), (82, 0, 0)
TUERK1, TUERK2 = (190, 255, 255), (51, 255, 255)

# je Golem: x-Bereich, Mittelteil (c0, c1), Streckzeile, Flammenfuß, Phasenversatz, Spiegelung der Flamme
GOLEMS = [dict(x=(0, 21), c=(6, 15), r=26, fuss=(5, 14), off=0, sp=False),
          dict(x=(27, 46), c=(33, 40), r=23, fuss=(36, 10), off=11, sp=True),
          dict(x=(51, 72), c=(57, 66), r=15, fuss=(61, 2), off=21, sp=False)]
for g in GOLEMS:
    m = sz.da & ~funke & (xx >= g['x'][0]) & (xx <= g['x'][1])
    mitte = m & (xx >= g['c'][0]) & (xx <= g['c'][1])
    g['mitte'] = sz.teil(mitte)
    g['seite'] = sz.teil(m & ~mitte)
    g['rot'] = sz.voll(m & sz.ist(ROT1, ROT2, ROT3))
    g['lampe'] = sz.voll(m & sz.ist(TUERK1, TUERK2))


def atem(i, off):
    return N7.stufe(i, 32, 8 + off, 14)


def frame(i, nur=None):
    ebenen = []
    for k, g in enumerate(GOLEMS):
        n = atem(i, g['off'])
        mitte = g['mitte']
        if N7.stufe(i, 16, 4 + 5 * k, 6):                                  # Kern/Auge glimmen
            mitte = N7.farbtausch(mitte, g['rot'], {ROT1: ROT2, ROT2: ROT1, ROT3: ROT1})
        if N7.stufe(i, 16, 9 + 3 * k, 4):                                  # Lampe blinkt
            mitte = N7.farbtausch(mitte, g['lampe'], {TUERK1: TUERK2, TUERK2: TUERK1})
        mitte = TX.streck_zeile(mitte, sz.PT + g['r'], n)
        fl = F3.klein(sz.H, sz.W, sz.PL + g['fuss'][0], sz.PT + g['fuss'][1] - n, i, [GELB, HELL, WEISS], 'lunte', spiegel=g['sp'], versatz=3 * k)
        ebenen += [(fl, 0, 0), (N7.starr(g['seite'], 0, -n), 0, 0), (mitte, 0, 0)]
    return L.zusammen(sz.H, sz.W, ebenen)


if __name__ == '__main__':
    N7.fertig('sentient-bomb-golems', 'Sentient Bomb Golems', frame, N, MS, spr, check=[0, 5, 12, 20, 28, 36], zoom=8)
