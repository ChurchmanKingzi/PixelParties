# -*- coding: utf-8 -*-
"""Idle-Animation für „Super Fan“ (Creature) — der Fan mit der grauen Stachelfrisur und der türkisen Brille, der mit dem Leuchtstab jubelt.

Quelle: src/super-fan.png (23×37 px, 38 Farben).
PICK: [["MotiveMoe", 441, 1]] (Ebene „Superfan“, komplett). Die Nachbarebene 442 („Ebene #99“) enthält die gelben Jubelstriche in zwei Stellungen
      (dieselben drei Striche, 3 px versetzt) — daraus stammt das Zucken der Striche. Abgleich mit Super_Fan.png: Figur und Striche stimmen überein.

Was im Sprite ist (x, y im 23×37-Sprite):
* JUBELSTRICHE (y 0–13, Gelb (255,193,0)): drei Striche über dem Kopf (Comic-Zeichen „Begeisterung“), kein Körperteil.
* HAARE (y 11–19): graue Stachelfrisur, schwarzer Umriss.
* BRILLE (y 20–21, x 5–6 und 9–10): türkise Gläser (153,255,255) → Brille blinzelt nicht.
* MUND (x 7–8, y 23–24): offen, dunkelrot (99,0,0)/(136,0,0)/(79,0,0) — er schreit/jubelt.
* RECHTER ARM (Bildseite rechts, x 13–15, y 20–25) hochgereckt, Hand (y 21–22) hält den LEUCHTSTAB (x 13–14, y 13–20, türkis, dunkler Griff y 20).
* OHREN (3,20) und (12,20). LINKER ARM hängt (x 0–3, y 25–32).
* HEMD blau/weiß (y 24–31), HOSE grün (y 30–34), SCHUHE (y 35–36).
Kein Metall, kein Feuer → kein Glanz, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos); Idee: er feuert im Takt an.
* Takt-Wippen (Periode 12): Hemdzeile 30 wird einmal texturiert eingefügt (TX) — Oberkörper, Kopf und Arme heben sich 1 px, Füße bleiben am Boden.
* Leuchtstab-Pumpen (Frames 0–35, Periode 12): Unterarm + Hand + Stab steigen als starre Einheit 0 → 1 → 2 → 1 → 0 px; der Oberarm wird dafür an Zeile 23
  senkrecht verlängert (TX, nicht breiter). In den Frames 36–47 hält er den Stab still und schreit durchgehend.
* Mund: im Takt auf/zu (zu = Hautfarbe über der dunklen Mundlinie), Frames 36–47 dauernd offen.
* Jubelstriche: springen im Takt zwischen der Originalstellung und 2 px weiter außen (oben) hin und her (Ebene 442 zeigt denselben Sprung um 3 px nach unten; nach oben und 2 px, damit sie
  die Haare nie berühren), beim Dauerschrei alle 3 Frames; sie liegen hinter der Figur.
* Der dunklere untere Stabteil bekommt die helle Stabfarbe, wo er beim Pumpen über die Haare hinausragt (freie linke Kante).
Frame 0 = Original. Ergänzungen: keine (der Arm legt nichts frei, er wird nur länger).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
F = G.Figur('super-fan', (2, 2, 4, 2))
spr = F.spr
GELB = (255, 193, 0)
striche = L.farbmaske(spr, [GELB])
arm = F.box(13, 13, 15, 24) & ~striche
rumpf = F.da & ~striche & ~arm
HAUT = F.f(6, 23)
STAB_DUNKEL, STAB_HELL = F.f(13, 17), F.f(13, 16)


def frame(i):
    k = F.ebene(rumpf)
    schrei = i >= 36
    if not schrei and i % 12 in (8, 9, 10):                         # Mund zu
        F.setze(k, {(7, 23): HAUT, (8, 23): HAUT})
    a = F.ebene(arm)
    hub = 0 if schrei else Hm.stufe(i, 12, 2)
    a = F.streck(a, 23, hub)                                        # Oberarm senkrecht länger, Hand + Stab starr nach oben
    fig = G.ueber(k, a)
    fig = F.streck(fig, 30, Hm.stufe(i, 12, 1))                     # Takt-Wippen
    # der dunklere untere Stabteil (67,139,136) lag im Original neben den Haaren; ragt er darüber hinaus, bekommt die freie Kante die helle Stabfarbe
    for y, x in zip(*np.nonzero(L.farbmaske(fig, [STAB_DUNKEL]))):
        if not fig[y, x - 1, 3]:
            fig[y, x, :3] = STAB_HELL
    raus = ((i // 3) % 2) if schrei else (1 if i % 12 in (3, 4, 5, 6, 7, 8) else 0)
    s = F.ebene(striche, 0, -2 * raus)
    return G.ueber(s, fig)


if __name__ == '__main__':
    G.abschluss(F, 'Super Fan', [frame(i) for i in range(N)], MS)
