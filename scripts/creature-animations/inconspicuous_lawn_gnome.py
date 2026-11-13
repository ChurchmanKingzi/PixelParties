# -*- coding: utf-8 -*-
"""Idle-Animation für „Inconspicuous Lawn Gnome“ (Creature) — der Gartenzwerg mit roter Zipfelmütze, weißem Bart und schwarzer Sonnenbrille.

Quelle: src/inconspicuous-lawn-gnome.png (15×24 px, 26 Farben).
PICK: [["MotiveMoe", 217, 1]] (Ebene „Inconspicuous Lawn Gnome“, komplett). Nachbarebenen 216/218 sind ganze Hintergrundbilder. Abgleich mit Inconspicuous_Lawn_Gnome.png: stimmt.

Was im Sprite ist (x, y im 15×24-Sprite):
* ZIPFELMÜTZE (y 0–8): rot (222,0,0)/(183,0,0)/(120,0,0), Lichtkante (255,68,68). Stoff, starr → bewegt sich nur mit dem Kopf.
* STIRN (x 5–9, y 8), SONNENBRILLE: schwarzer Balken (x 4–10, y 9) + Gläser (5–6,10) und (8–9,10), Bügelenden (3,10)/(11,10). Nase (7,10).
* BART weiß/hellgrau (y 11–17), MUND (6–8,13) rotbraun (135,78,78).
* ARME orange (x 0–4 / 10–14, y 13–16), Hände (y 17–18); Gürtel schwarz (y 17); HOSE beige (y 18–20); STIEFEL dunkel (y 21–23).
Kein Metall → kein Glanz; keine Partikel.

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos); Idee: „unauffällig“ — er steht wie eine Gartenfigur, schiebt dann heimlich die Sonnenbrille herunter, späht nach links und rechts
und schiebt sie schnell wieder hoch.
* Atmen (Periode 30, klein): Hosenzeile 19 wird einmal texturiert eingefügt (TX) — Oberkörper, Arme, Kopf und Mütze heben sich 1 px, die Stiefel bleiben stehen.
* Brille herunter (Frames 10–35): Balken und Gläser rutschen als Einheit 1 px tiefer; in der frei gewordenen Zeile 9 erscheinen Stirnhaut und zwei schwarze Augenpunkte.
  Die Augen schauen geradeaus (12–17), nach links (18–23), geradeaus (24–25), nach rechts (26–31), geradeaus (32–35) — nur die Augenpunkte wandern, der Kopf bleibt.
* Schnurren im Bart (Frames 44–47): der Mund schließt sich kurz (Bartfarbe).
Frame 0 = Original.
Ergänzungen (nur bei heruntergeschobener Brille sichtbar): Zeile 9, x 4–10: Stirnhaut in den Farben der Zeile 8/10 ((221,168,135) links, (247,188,151) Mitte, (247,203,175) rechts)
und zwei Augenpunkte in Schwarz (0,0,0).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 60, 75
F = G.Figur('inconspicuous-lawn-gnome', (2, 2, 3, 2))
spr = F.spr
E = (0, 0, 0)
H1, H2, H3 = F.f(4, 10), F.f(7, 10), F.f(10, 10)
BART = F.f(5, 13)
AUGEN = {'m': (6, 8), 'l': (5, 7), 'r': (7, 9)}


def blick(i):
    if 18 <= i <= 23:
        return 'l'
    if 26 <= i <= 31:
        return 'r'
    return 'm'


def frame(i):
    k = F.ebene(F.da)
    if 10 <= i <= 35:
        stirn = {4: H1, 5: H1, 6: H1, 7: H2, 8: H3, 9: H3, 10: H3}
        px = {(x, 9): c for x, c in stirn.items()}
        if i >= 12:
            for x in AUGEN[blick(i)]:
                px[(x, 9)] = E
        px.update({(x, 10): E for x in range(4, 11)})
        px.update({(x, 11): E for x in (5, 6, 8, 9)})
        F.setze(k, px)
    if 44 <= i <= 47:
        F.setze(k, {(6, 13): BART, (7, 13): BART, (8, 13): BART})
    return F.streck(k, 19, Hm.stufe(i, 30, 1))


if __name__ == '__main__':
    G.abschluss(F, 'Inconspicuous Lawn Gnome', [frame(i) for i in range(N)], MS)
