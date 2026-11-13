# -*- coding: utf-8 -*-
"""Idle-Animation für „Traveler from the Future“ (Creature) — der vermummte Zeitreisende in der dunklen Rüstung mit Kapuze, schwarzem Visier und roten Augenlichtern.

Quelle: src/traveler-from-the-future.png (20×25 px, 18 Farben).
PICK: [["MotiveGN", 352, 1]] (Ebene „Traveler from the Future #1“, komplett). Die Karte zeigt links außerdem den braunhaarigen Helden (Ebene 353/356 „Kassaran“) — das ist der Held
      Kassaran, nicht die Creature; die Creature ist sein vermummtes Zukunfts-Ich rechts. Ebene 354 („Grasp the Future #2“, Bumerang-Gerät) gehört zu einer anderen Karte.

Was im Sprite ist (x, y im 20×25-Sprite):
* KAPUZE/HELM (y 0–8): dunkelgrau mit heller Stirnplatte (126,126,126)/(160,160,160). Stoff/mattes Material → kein Glanz.
* VISIER (y 7–8): schwarz, darin zwei rote Augenlichter (8,8) und (10,8) (128,0,0). Maske → kein Blinzeln; die Lichter glühen nur innerhalb ihrer zwei Pixel.
* GESICHT (y 6 und 9–11): Hautstreifen über dem Visier, Mund-/Kinnpartie darunter, dunkelbraune Mundwinkel (8,11)/(11,11).
* SCHULTERN (y 11–13): breite Schulterplatten mit hellen Enden (x 0–5 und 14–19), Arme in die Hüfte gestemmt (Ellbogen x 2–5 / 14–17, y 14–19).
* RUMPF/MANTEL (y 12–21), STIEFEL (y 22–24).

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: er steht regungslos-bedrohlich da, die Augenlichter pulsieren, und einmal je Schleife „flimmert“ er durch die Zeit.
* Atmen (Periode 24, langsam): Rumpfzeile 16 wird einmal texturiert eingefügt (TX) — Schultern, Arme und Kopf heben sich 1 px, die Stiefel bleiben stehen.
* Augenlichter (Periode 16): (128,0,0) → (200,0,0) → (255,26,26) → zurück; nur die zwei Augenpixel. Die beiden helleren Rottöne sind Palettenfarben (data/palette.json),
  dokumentierte Ausnahme (in L.pruefe freigegeben).
* Zeit-Flimmern (Frames 27–37): hinter der Figur erscheint links und rechts ein gerastertes Nachbild (Schachbrett-Dither der eigenen Pixel, kein Alpha), das 1 → 2 → 3 px
  auseinanderläuft und wieder zusammenfällt. Die Figur selbst bleibt vollständig und unverändert davor.
Frame 0 = Original. Ergänzungen: keine. Kopf bewegt sich nicht seitlich, nichts schwebt.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('traveler-from-the-future', (5, 5, 3, 2))
spr = F.spr
ROT = [(128, 0, 0), (200, 0, 0), (255, 26, 26)]
ERLAUBT = ROT[1:]
GLUT = [0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0]
ECHO = [1, 1, 2, 2, 3, 3, 3, 2, 2, 1, 1]
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    k = F.ebene(F.da)
    g = GLUT[i % 16]
    if g:
        F.setze(k, {(8, 8): ROT[g], (10, 8): ROT[g]})
    k = F.streck(k, 16, Hm.stufe(i, 24, 1))
    if nur:
        return k
    d = Hm.folge(i, 27, ECHO, N)
    if not d:
        return k
    yy, xx = np.mgrid[0:F.H, 0:F.W]
    raster = ((xx + yy) % 2) == 0
    out = L.leer(F.H, F.W)
    for dx in (-d, d):
        e = L.versetze(k, dx, 0)
        e[~raster] = 0
        out = G.ueber(out, e)
    return G.ueber(out, k)


if __name__ == '__main__':
    G.abschluss(F, 'Traveler from the Future', [frame(i) for i in range(N)], MS, erlaubt=ERLAUBT, rand=False)
