# -*- coding: utf-8 -*-
"""Idle-Animation für „Frolake“ (Creature) — der knochige graue See-Drache mit der leuchtenden Angler-Laterne vor dem Maul, der an der Uferwand hängt (Schwanz im Wasser).

Quelle: src/frolake.png (39×52 px, 20 Farben).
PICK: [["Motive", 841, "Ausschnitt x 297–335 der Ebene „Frolake“ (die ganze Figur; links davon ist die Ebene leer)"]]
  Die Kartenkunst ist doppelt vergrößert (Maßstab 2). Ebene 843 (Eiskristalle/Tropfen mit weißen Sternen) und 842 (halbtransparenter Schatten) sind Szenen-Effekte der Karte,
  nicht Teil der Figur – nicht übernommen. Die Figur ist vollständig.

Was im Sprite ist (x, y):
* FLÜGEL/RÜCKENFLOSSE (x 5–34, y 0–18): graue Knochenstreben (61/158/186) mit beiger Flughaut (147,137,102)…(186,178,155), gezackter Hinterrand rechts.
* LATERNE (x 2–9, y 21–23): weiß-gelber Leuchtkörper (Kern (246,248,255), Hülle (255,230,213), Enden (246,205,139)) an einem rosa-dunklen STIEL (x 9–14, y 22–27), der aus der
  Stirn wächst – Anglerfisch-Köder. Licht, kein Metall → pulsiert, aber KEIN Sparkle.
* KOPF (x 0–14, y 24–32): grauer Schädel, Blick nach links unten; Auge (3,27)/(6,27)/(3,28)/(6,28) dunkel (im Schädel, nicht eindeutig → bleibt fest, kein Blinzeln);
  weiße ZÄHNE (5,31), (7,31), (3,32) am Oberkiefer; UNTERKIEFER = beiger Span (6–9, 32–35) mit Zahn (6,34). Die weißen Pixel sind Zähne, keine Partikel.
* RUMPF (x 11–29, y 17–36) mit beigen Flossenlappen (20–29, 29–33), SCHWANZ (y 36–51): Seitenflosse (20–30, 37–41), gegabelte Schwanzspitze (25–38, 42–51).
Schwer und groß → langsam (72 Frames à 80 ms = 5,8 s).

Idee: Der Angler lauert – die Laterne wippt und pulsiert lockend, der Kiefer schnappt langsam zu, die Schwanzspitze pendelt im Wasser, die Flügel heben sich mit dem Atem.
Ablauf (nahtlos):
* Laterne wippt (Periode 24, 3×): Leuchtkörper + vorderer Stiel (x ≤ 11) heben sich als starre Einheit 1 px, der Stielansatz (x 12–14) bleibt am Kopf. Die frei werdenden
  Pixel am Kopf werden mit dem Schädelumriss (61,62,64) fertiggezeichnet.
* Laterne pulsiert (Periode 18, 4×): nur INNERHALB des Leuchtkörpers – Kern weiß → hautweiß, Hülle → gelb (eine Stufe dunkler auf der Rampe des Sprites) und zurück.
* Kiefer (Frames 40–45 und 50–55): der Unterkiefer-Span (y 33–35) hebt sich als starres Teil 1 px (Maul schnappt zu), dann wieder auf.
* Schwanz (Periode 36, 2×): die gegabelte Spitze pendelt – Zeilen 42–45 um ±1 px, Zeilen 46–51 um ±2 px (ganze Zeilen starr versetzt, Gefälle ≤ 1 px je Stufe).
* Atmen (Periode 36, 2×): Zeile 16 (unter den Flügelstreben) wird einmal texturiert eingefügt (anim_textur) – der Flügelfächer hebt sich 1 px; Kopf, Laterne, Schwanz bleiben.
Frame 0 = Original.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6
import anim_textur as TX
TX.umleiten()

N, MS = 72, 80
G = N4.Figur('frolake', 3, 5, 4, 3)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

UMRISS = f(7, 24)                                   # (61,62,64)
KERN, HUELLE, ENDE = f(4, 22), f(4, 21), f(3, 21)   # (246,248,255), (255,230,213), (246,205,139)
STIELFARBEN = [f(10, 22), f(10, 23), f(11, 23)]     # dunkel, rosa, grau-rosa
LATERNE = L.farbmaske(spr, [KERN, HUELLE, ENDE]) & L.rechteck(spr, 2, 21, 10, 24)
STIEL_VORN = L.farbmaske(spr, STIELFARBEN) & L.rechteck(spr, 9, 22, 12, 26)
KIEFER = L.rechteck(spr, 6, 33, 10, 36)


def frame(i):
    a = G.ebene()
    # Laterne pulsiert
    p = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0][i % 18]
    if p:
        m = np.zeros((H, W), bool); m[OFF[1]:OFF[1] + G.sh, OFF[0]:OFF[0] + G.sw] = LATERNE
        a = L.tausche(a, {KERN: HUELLE} if p == 1 else {KERN: HUELLE, HUELLE: ENDE}, m)
    # Laterne wippt
    if Hm.stufe(i, 24, 1):
        rest, teil = N4.starr(a, OFF, LATERNE | STIEL_VORN, 0, -1)
        b = L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])
        for y, x in zip(*np.nonzero((a[..., 3] > 0) & (b[..., 3] == 0))):
            if x - OFF[0] >= 9:
                b[y, x, :3] = UMRISS; b[y, x, 3] = 255
        a = b
    # Kiefer schnappt
    if Hm.takt(i, N, 40, 6) or Hm.takt(i, N, 50, 6):
        rest, teil = N4.starr(a, OFF, KIEFER, 0, -1)
        a = L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])
    # Schwanz pendelt
    s = math.sin(L.sinus(i, 36))
    Hm.zeilen_versatz(a, OFF, {**{y: int(round(1.2 * s)) for y in range(42, 46)}, **{y: int(round(2.2 * s)) for y in range(46, 52)}})
    unten = np.zeros((H, W), bool); unten[OFF[1] + 42:] = True
    a = G.schliessen(a, lambda x, y: UMRISS, unten)           # Stufen im Schwanz: helle Randpixel werden Umriss (Regel 16)
    # Atmen: Flügelfächer hebt sich
    if Hm.stufe(i, 36, 1, math.pi / 3) - Hm.stufe(0, 36, 1, math.pi / 3) > 0:
        a = TX.streck_zeile(a, G.PT + 16, 1)
    return a


if __name__ == '__main__':
    N4.abschluss(G, 'Frolake', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
