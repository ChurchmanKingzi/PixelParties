# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Priest“ (Creature) — schwarz gewandeter Skelett-Priester mit goldenem Gürtel und goldenen Stiefeln, im Lichtstrahl.

Quelle: src/skeleton-priest.png (12×21 px, 15 Farben) — Ausschnitt x 57–69, y 79–99 der Ebene „Skeleton Priest“ (MotiveGrailWar.xcf, Ebene 466, 128×109). Der automatische Treffer-Suchlauf fand
die Figur nicht (die Kartenkunst überlagert sie mit Lichtschein); ich habe sie über den Ebenennamen gefunden und von Hand ausgeschnitten.
PICK: [["MotiveGrailWar", 466, 0]]   (Ausschnitt x 57–69, y 79–99 der Ebene; Figur 0 = „von Hand“)
Weggelassen (gehört nicht zur Kreatur): die goldene Lichtsäule (x 62–65, y 0–70) mit dem Zickzack-Blitz an ihrem Ende (y 70–78) und die beiden Lichtvorhänge links/rechts (Kulisse/Strahlenzauber der Karte) —
der Strahl trifft den Priester von oben. Die Quelle ist sonst vollständig (alles deckend).

Aufruf:   python3 skeleton_priest.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-priest.png + .json

Was ist was (x, y im 12×21-Sprite; die Figur ist von vorn gesehen und fast spiegelsymmetrisch um x = 5,5):
* SOUTANE: schwarze Mittelbahn (x 4–6, y 0–16) mit grauer Naht (76,76,76)/(37,37,37); links und rechts davon weiße Schulter-/Armknochen (246,255,255)/(213,213,213)/(189,189,189) in braunem Umriss (49,24,0)
  (x 1–3 bzw. 8–10, y 1–7); unten zwei weiße Beinknochenstreifen (y 12–17).
* GÜRTEL (x 3–7, y 8–11): breite goldene Schnalle (214,161,0) mit gelben Lichtpunkten (255,255,0)/(234,215,0) bei (4,9), (6,9), (4,10), (6,10); die Unterarme/Hände (Knochen mit braunem Umriss) gehen bei y 9–11 nach außen
  (x 0–2 bzw. 9–11). Ein einzelnes goldenes Pixel (5,0) ganz oben (Rest der Lichtsäule bzw. Haubenspitze) bleibt als Spitze stehen.
* STIEFEL (x 0–3 und 8–11, y 17–20): goldene Stiefel (214,161,0)/(234,215,0)/(255,255,0)/(255,255,147).
Einen Kopf zeigt der Sprite nicht (die schwarze Bahn oben ist die Kapuze); Gesicht/Augen gibt es nicht → kein Blinzeln.
Gold = Metall: Glanz/Glitzer erlaubt (Regel 12/14) nur an Gürtel und Stiefeln und der Spitze; Knochen/Stoff glänzen nicht. Kein Feuer. Keine Partikel.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, 0 → 1 → 2 → 1 → 0 px): die Schulterzeile y 5 (weiße Knochen, schwarze Bahn, braune Kanten) wird 0–2× eingefügt (Texturmischung mit den Nachbarzeilen); Kapuzenspitze und Schultern steigen,
  Gürtel, Arme, Beine und Stiefel bleiben am Boden (die Brust hebt sich, nichts wird verbreitert).
* ARME/HÄNDE (unabhängig, starr): linke Hand (x 0–2, y 9–11) hebt sich 1 px in den Frames 8–19 und 32–43, die rechte in 20–31 und 44–47 (immer 4-verbunden mit der Schnalle (x 3 bzw. 8)).
* GOLDGLANZ: ein diagonales Lichtband läuft über Gürtel und Stiefel (Frames 0–11 und 24–35, eine Stufe heller auf der Rampe (214,161,0) → (234,215,0) → (255,255,0) → (255,255,147));
  Glitzersterne (Mitte weiß, Arme hellgelb) am Gürtel (4,9) bzw. (6,10) und an den Stiefeln (2,19), (9,19), 1 → 2 → 2 → 1.
Kein Kopfneigen; die Füße bleiben am Boden (Regel 17/18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('skeleton-priest')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (49, 24, 0)
GOLD = {(214, 161, 0): (234, 215, 0), (234, 215, 0): (255, 255, 0), (255, 255, 0): (255, 255, 147)}
GOLD_PTS = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and col(x, y) in GOLD]

hand_l = vorhanden & (xx <= 2) & (yy >= 9) & (yy <= 11)
hand_r = vorhanden & (xx >= 9) & (yy >= 9) & (yy <= 11)
rest = vorhanden & ~hand_l & ~hand_r
TEST_EBENEN = 'koerper'


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = teil(rest)
    d = -3 + 2 * (i % 24) if (i % 24) < 14 else None                         # Band läuft in Frames 0–13 (d startet vor dem Sprite)
    if d is not None and i % 24 >= 1:
        V.glanz_band(k, GOLD_PTS, GOLD, d, 3, OFF)
    kb = L.streck_zeile(k, OFF[1] + 5, n)
    up_l = V.fenster(i, N, 8, 12) | V.fenster(i, N, 32, 12)
    up_r = V.fenster(i, N, 20, 12) | V.fenster(i, N, 44, 4)
    ebenen = [(kb, 0, 0), (teil(hand_l), 0, -up_l), (teil(hand_r), 0, -up_r)]
    f = L.zusammen(H, W, ebenen)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur is None:                                                          # Sterne am Gold
        for (sx, sy, st0) in ((4, 9, 6), (6, 10, 30), (2, 19, 15), (9, 19, 39)):
            st = V.folge(i, N, st0, [1, 2, 2, 1])
            if st:
                dy_ = -n if sy < 12 else 0
                V.stern(f, sx, sy + dy_, st, (246, 255, 255), (255, 255, 147), OFF)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-priest', 'Skeleton Priest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-priest-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=10)
