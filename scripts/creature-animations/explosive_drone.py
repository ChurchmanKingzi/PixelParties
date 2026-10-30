# -*- coding: utf-8 -*-
"""Idle-Animation für „Explosive Drone“ (Creature) — Regeln 14/15/16 (Metall glänzt, sonst nichts).

PICK: [["MotiveGN", 306, 1]]
Quelle: src/explosive-drone.png — kleine Sprengdrohne (22×9 px, 10 Farben) aus MotiveGN.xcf, Ebene 306 („Explosive Drone“), Figur 1; vollständig deckend (Alpha nur 255), nichts ging bei der Extraktion verloren.
(Die weiße Figur unter ihr auf der Karte gehört zu einer anderen Ebene und ist nicht Teil der Drohne.)

Aufruf:   python3 explosive_drone.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/explosive-drone.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Drohne von der Seite/oben, schwebend):
* Rote Kuppel (Sprengkopf, x 6–15, y 0–4): Rottöne (96,0,0)/(164,0,0)/(210,0,0)/(255,0,0)/(255,91,91), unten ein graues Band mit hellen Lichtern ((140,138,140)/(165,162,165)/(206,207,206)).
* Sockel (x 5–16, y 2–5): dunkles Metall (59,59,59).
* Beine: acht dünne schwarze Bögen (26,26,26), je vier links und rechts, die bis y 8 hinunterreichen (1-px-Diagonalketten).
* Es gibt kein Feuer und keine Flügel im Sprite (nichts ergänzt: ein Schubfeuer wäre eine Erfindung).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12). Die Beine baumeln dazu seitlich (nur Zeilen ab 6, je tiefer desto mehr, bis 1–2 px, Periode 24; die Diagonalketten bleiben 8-verbunden).
* „Scharf“-Blinken: die rote Kuppel wird im Takt der Bob-Periode (12 Frames) heller und dunkler (eine Stufe auf der Rot-Rampe), wie eine Warnlampe: 0 0 0 0 +1 +1 +1 0 −1 −1 0 0.
* Kurzes Zittern kurz vor dem Loop-Ende (Frames 40–43): die ganze Drohne bebt ±1 px seitlich (Sprengkopf „kocht“); Frame 0 bleibt das Original.
* Glanz nur auf dem Metall (Regel 14): ein dezentes Lichtband läuft alle 24 Frames über Sockel und graues Band (eine Stufe heller). Die Beine, die Kuppel und der Rand glänzen nicht. Keine Partikel.

Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Beinpendel legt Innenfarbe an Rändern frei → F.umranden setzt dort den Beinrand (26,26,26); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 8, 8                      # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('explosive-drone')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT = [(96, 0, 0), (164, 0, 0), (210, 0, 0), (255, 0, 0), (255, 91, 91)]         # dunkel → hell
METALL = [(59, 59, 59), (140, 138, 140), (165, 162, 165), (206, 207, 206)]
BEIN = (26, 26, 26)
kuppel = vorhanden & L.farbmaske(spr, ROT) & ~F.kanten(spr)                # nur das Innere der Kuppel blinkt (der Rand bleibt Umrissfarbe, Regel 16)
beine = vorhanden & L.farbmaske(spr, [BEIN]) & (yy >= 3)
koerper = vorhanden & ~beine
metall_maske = L.farbmaske(spr, METALL) & ~F.kanten(spr)
UMRISS = F.umriss_farben(spr)
BLINK = [0, 0, 0, 0, 1, 1, 1, 0, -1, -1, 0, 0]               # Warnlampe: Stufen auf der Rot-Rampe je Frame (Periode 12)
ZITTERN = {40: 1, 41: -1, 42: 1, 43: -1}                      # kurzes Beben (dx) vor dem Loop-Ende


def frame(i, partikel=True, effekte=True):
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                               # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    dx = ZITTERN.get(i, 0) if effekte else 0

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    bn = F.ebene(spr, beine, H, W, PAD_L, PAD_T)
    if effekte:
        st = BLINK[i % 12]
        if st:
            for y, x in zip(*np.nonzero(kuppel)):
                kp[PAD_T + y, PAD_L + x, :3] = F.heller(kp[PAD_T + y, PAD_L + x, :3], ROT, st)
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 5, 8, METALL, stufen=1, breite=3.0, achse=(1.0, 0.5))

    bn = F.zeilen_pendel(bn, PAD_T + 5, 1.5, L.sinus(i, N / 2), 1.0)          # Beine baumeln (Zeilen ab 6)
    kp, bn = (L.versetze(a, dx, bob) for a in (kp, bn))
    f = L.zusammen(H, W, [(bn, 0, 0), (kp, 0, 0)])
    F.umranden(f, [bn], UMRISS, BEIN, BEIN, BEIN)                                # Randpixel-Test (Regel 16)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('explosive-drone', 'Explosive Drone', frames, MS, prev)
    if prev:
        L.streifen(prev + '/explosive-drone-strip.png', frames, spalten=8, scale=8)
