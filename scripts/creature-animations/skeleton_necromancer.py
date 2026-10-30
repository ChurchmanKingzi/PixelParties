# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Necromancer“ (Creature).

Quelle: src/skeleton-necromancer.png — Ebene „Skeleton Necromancer“ (20×34 px, 15 Farben) aus Motive.xcf.
PICK: [["Motive", 813, 1], ["Motive", 813, 2]]
  Figur 1 = Kapuzenfigur mit Rippenring, Figur 2 = „Unterkörper“ (Knochen + schwarzer Zipfel). Figur 2 gehört dazu: gleiche Ebene,
  gleicher Name, exakt auf der Mittelachse (x 38/38,5 in der Kartenkunst) und 2 px unter dem Rippenring; der lila Grabkreuz-Hintergrund
  der Karte ist dagegen nicht Teil der Ebene.

Aufruf:   python3 skeleton_necromancer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-necromancer.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Kapuze: schwarzer Dom y 0–8, x 3–16 (Umriss A, helle Kante D bei y 2–3, Innenschatten F/G). Das Gesicht liegt tief im Schatten:
  nur matte Andeutungen (J bei (9/10,7), (8–11,8), (9/10,9), M/L darunter) — Augen/Kiefer sind NICHT sicher zu erkennen und bleiben fest.
* Ärmel: links x 0–4, rechts x 15–19, y 9–12 (schwarz A, graue Lichter C/N/D); darüber je ein brauner Punkt (2,8) und (17,8),
  dazwischen Robe/Körper. Braune Knochenpunkte (5,11) und (14,11) sitzen am Körper (Handgelenk/Knochen) und bleiben fest.
* Robe: y 9–12 (C, L dunkelviolett, M, A), Saum mit braunen Knochenkanten bei (6/7,12) und (12/13,12).
* Rippenring: y 13–20, Knochen E/H/I/K mit braunem Umriss B; Mitte (x 9–10, y 16–19) ist hohl, bei y 18 verbindet ein Steg die Hälften.
* Unterkörper (Figur 2): y 24–33 — Knochenknauf (B/E/H) y 24–27, Schaft (I) y 28–30, schwarze Raute A (breit bei y 29–30, Spitze y 33).
Fest bleiben: Kapuze samt Gesicht, Robe, Rippenring (starr mit dem Oberkörper), alle Knochenpunkte.

Ablauf (48 Frames à 75 ms = 3,6 s; Frame 0 = Original, die Wölkchen ausgenommen):
* Schweben (Periode 48): Oberkörper (Kapuze, Robe, Rippen) und Ärmel wiegen sich ±1 px senkrecht, starr (keine Naht reißt).
* Unterkörper hinkt hinterher (Periode 24, gegenläufig): ±1 px senkrecht, dazu pendelt die schwarze Spitze (y 32–33, Periode 16) ±1 px seitlich.
  Die Lücke zum Rippenring (3 Zeilen) bleibt immer ≥ 1 Zeile.
* Beschwörungsgeste: beide Ärmel heben sich langsam (Spitze bis 3 px, Spaltenversatz wächst von der Schulter x 5 / x 14 zur Hand),
  halten und senken sich wieder; links Frame 4–31, rechts Frame 14–41 (zeitversetzt).
* Seelenwölkchen (Partikel, hinter der Figur): 5 runde Wölkchen/Funken steigen langsam auf (Funke → Klecks → Wölkchen → Funke; Formen l, m, k),
  zwei große seitlich vom Unterkörper, zwei über den Ärmeln, ein Funke über der Kapuze. Kern Knochenweiß E (213,213,213) aus dem Sprite,
  Rand kaltes Violett (128,102,178) = #8066b2 aus data/palette.json (AUSNAHME: neue Farbe, in L.pruefe freigegeben; passt zum
  dunkelvioletten L des Sprites — mit SEELE_RAND schnell tauschbar).
ERGÄNZUNG: keine gemalten Pixel (nichts liegt unter bewegten Teilen). Pixelzahl der Figur 297–300: beim Heben legen sich die Ärmel
über bis zu 3 Kapuzenpixel an den Unterkanten ((4,8), (15,8) …), das ist gewollt (Arm vor der Kapuze).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 14, 6

spr = L.lade('skeleton-necromancer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
SEELE_KERN = c(6, 17)                     # E (213,213,213) Knochenweiß
SEELE_RAND = (128, 102, 178)              # #8066b2 aus data/palette.json (Ausnahme, kaltes Violett)

aermel_l = vorhanden & (xx <= 4) & (yy >= 8) & (yy <= 12)
aermel_r = vorhanden & (xx >= 15) & (yy >= 8) & (yy <= 12)
unterkoerper = vorhanden & (yy >= 24)
oberkoerper = vorhanden & (yy <= 20) & ~aermel_l & ~aermel_r
assert (aermel_l | aermel_r | unterkoerper | oberkoerper).sum() == vorhanden.sum()

SEELEN = {'c': SEELE_KERN, 'r': SEELE_RAND}
PUFFS = [
    dict(x=PAD_L + 2, y=PAD_T + 26, vx=-2, vy=-15, off=0, form='l', wackeln=1),       # links vom Unterkörper
    dict(x=PAD_L + 17, y=PAD_T + 28, vx=2, vy=-16, off=16, form='l', wackeln=1),      # rechts vom Unterkörper
    dict(x=PAD_L + 0, y=PAD_T + 8, vx=-1, vy=-10, off=30, form='m', wackeln=1),       # über dem linken Ärmel
    dict(x=PAD_L + 19, y=PAD_T + 8, vx=1, vy=-10, off=8, form='m', wackeln=1),        # über dem rechten Ärmel
    dict(x=PAD_L + 10, y=PAD_T - 3, vx=0, vy=-9, off=38, form='k', wackeln=1),        # Funke über der Kapuze
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def frame(i):
    ph = L.sinus(i, N)
    dy_ob = int(round(1.0 * math.sin(ph)))                       # Schweben des Oberkörpers (−1 … 1, + = nach unten)
    dy_un = int(round(-1.4 * math.sin(2 * ph)))                  # Unterkörper hinkt gegenläufig
    spitze = 1.4 * math.sin(L.sinus(i, N / 3))                    # Spitzenpendel (Periode 16), 0 bei Frame 0
    heben_l = -3.2 * U.buckel(i, 4, 28)                          # negativ = nach oben
    heben_r = -3.2 * U.buckel(i, 14, 28)

    ob = teil(oberkoerper)
    al = L.spalten_welle(teil(aermel_l), PAD_L + 5, heben_l, math.pi / 2, nur_rechts=False)
    ar = L.spalten_welle(teil(aermel_r), PAD_L + 14, heben_r, math.pi / 2, nur_rechts=True)
    un = U.haengen(teil(unterkoerper), PAD_T + 30, spitze)
    seelen = U.glut_ebene(H, W, i, N, PUFFS, SEELEN)
    return L.zusammen(H, W, [(seelen, 0, 0), (un, 0, dy_un), (ob, 0, dy_ob), (al, 0, dy_ob), (ar, 0, dy_ob)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=[SEELE_RAND])
    L.speichern('skeleton-necromancer', 'Skeleton Necromancer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-necromancer-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
