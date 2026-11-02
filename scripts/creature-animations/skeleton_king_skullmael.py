# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton King Skullmael“ (Creature) — Skelettkönig mit goldener Flammenkrone, goldenen Schulterstücken und seinem Greatsword.

Quelle: src/skeleton-king-skullmael.png (29×23 px, 30 Farben) = Ebene „Skullmael“ (Motive.xcf, Ebene 428, 20×23, Figur 1) + Ebene „Ebene #590“ (Ebene 429, 19×16, Figur 1 = das Schwert);
beide Ebenen zusammen ergeben genau die Figur der Kartenkunst (Skeleton_King_Skullmael.png, Pixelabgleich 100 %). Das Schwert liegt UNTER dem König (die linke Hand verdeckt den Griff bei (9–10, 5–8),
der Schritt die Klingenspitze bei (16–18, 16–18)). Damit beim Heben nichts Verdecktes fehlt, liegen die beiden Ebenen zusätzlich einzeln in src/ (…-koenig.png, 20×23, Versatz (9,0); …-schwert.png, 19×16, Versatz (0,3)).
PICK: [["Motive", 428, 1], ["Motive", 429, 1]]
Nicht benutzt: Ebene 420 „Skullmaels Greatsword“ (47×22, das Seitenprofil-Schwert einer anderen Pose), Ebene 427, Totenkopf-und-Knochen-Haufen der Kunst (Kulisse).

Aufruf:   python3 skeleton_king_skullmael.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-king-skullmael.png + .json

Was ist was (x, y im 29×23-Sprite):
* KRONE (x 14–24, y 0–5): goldene Flammenzacken (213,98,16)/(255,180,24)/(255,222,90) auf dunklem Braun (115,41,16); SCHÄDEL (x 15–23, y 3–9): dunkle Augenhöhlen (15,15,15), zwei ROTE AUGEN (163,0,0) bei (17,6) und (20,6),
  weißes Nasenbein (217,217,217) (18–19,6), dunkelroter offener MUND (79,0,0)/(125,0,0)/(163,0,0)/(102,0,0) bei (17–20, 8–9).
* SCHULTERSTÜCKE: goldene Sonnenpauldrons links (x 9–12, y 3–6) und rechts (x 25–28, y 3–6) (braun/orange/gelb), darunter die ARME als weiße Knochenstreifen (x 10–13 bzw. 24–27, y 7–10), die nach unten an den
  Rumpf anschließen. Die linke Hand hält das Schwert am Griff (verdeckt es bei (9–10, 5–8)).
* RUMPF (x 13–25, y 10–18): Rippenbögen (169…229,229,229) in Schwarz (31,31,31), Becken y 18–19, Beine/Füße y 19–22 mit goldenen STIEFELN (255,180,24)/(213,98,16) (x 14–18 bzw. 20–24, y 19–22).
* SCHWERT (x 0–18, y 3–18): großer goldener Sonnenknauf/Parierstange (108,46,17)/(255,198,0)/(255,219,0) mit rotem Edelstein (172,0,0)/(131,0,0) bei (5–6, 8–9) (x 0–9, y 3–13), weiße Klinge (218,218,206)/(229,229,229)/
  (255,255,255) diagonal nach rechts unten bis (17, 18).
Glanz/Glitzer (Regel 12/14) NUR bei Gold und Metall: Krone, Schulterstücke, Stiefel, Knauf (Gold), Klinge (Stahl), roter Edelstein im Knauf. Knochen, Schädel und Rippen glänzen nicht. Kein Feuer.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, zweimal pro Schleife, 0 → 1 → 2 → 1 → 0 px): die Halszeile y 10 des Königs wird 0–2× eingefügt (Texturmischung); Krone, Schädel, Schulterstücke und die oberen Arme steigen, Rippen/Becken/Beine bleiben.
  Das SCHWERT steigt starr mit der haltenden Hand mit (Regel 28); nichts wird gestreckt außer der Halszeile.
* SCHWERTSPITZE pendelt (Periode 36): die Klinge schwingt unterhalb der Hand (y ≥ 9) bis 1 px nach links/rechts (Zeilenversatz mit Gefälle ≤ 1, Griff und Knauf bleiben bei der Hand).
* LICHTBAND (Periode 48, zweimal pro Schleife versetzt): ein diagonales Band wandert über das GOLD (Krone, Pauldrons, Knauf, Stiefel), danach ein zweites über die KLINGE; eine Stufe heller auf der Farbrampe des Sprites.
* GLITZERSTERNE (kleine Vierzack-Sterne, Mitte weiß, Arme hellgelb, 1 → 2 → 2 → 1 → 0 Stufen, am Objekt): Krone (22,2), linkes Schulterstück (11,4), Knauf (4,5)… der Stern an der Klingenspitze (16,15); rechter Pauldron (27,5), Stiefel (15,21).
* AUGEN blinzeln (Frames 12–14 und 35–37): die roten Augenpixel nehmen die Farbe der Augenhöhle (15,15,15) an.
Kein Kopfneigen, keine seitliche Verlagerung (Regel 17); die Füße bleiben am Boden (Regel 18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 6, 3
KOENIG_OFF, SCHWERT_OFF = (9, 0), (0, 3)

spr = L.lade('skeleton-king-skullmael')
koenig = L.lade('skeleton-king-skullmael-koenig')
schwert = L.lade('skeleton-king-skullmael-schwert')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (31, 31, 31)
AUGEN = [(17, 6), (20, 6)]
assert all(col(x, y) == (163, 0, 0) for (x, y) in AUGEN)
HOEHLE = (15, 15, 15)

GOLD = {(213, 98, 16): (255, 161, 0), (255, 161, 0): (255, 180, 24), (255, 180, 24): (255, 198, 0), (255, 198, 0): (255, 219, 0), (255, 219, 0): (255, 222, 90)}
STAHL = {(193, 193, 197): (218, 218, 206), (218, 218, 206): (229, 229, 229), (229, 229, 229): (255, 255, 255), (169, 169, 169): (188, 188, 188)}


def layer_pts(a, off, farben):
    """Pixel (Sprite-Koordinaten) einer Teil-Ebene, deren Farbe in `farben` steht."""
    pts = []
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] and tuple(int(v) for v in a[y, x, :3]) in farben:
                pts.append((x + off[0], y + off[1]))
    return pts


GOLD_K = layer_pts(koenig, KOENIG_OFF, GOLD)
GOLD_S = layer_pts(schwert, SCHWERT_OFF, GOLD)
STAHL_S = layer_pts(schwert, SCHWERT_OFF, {(193, 193, 197), (218, 218, 206), (229, 229, 229)})
TEST_EBENEN = 'koerper'


def ebene(a, off):
    return L.platz(a, H, W, OFF[0] + off[0], OFF[1] + off[1])


def stern_folge(i, start):
    return V.folge(i, N, start, [1, 2, 2, 1])


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = ebene(koenig, KOENIG_OFF)
    s = ebene(schwert, SCHWERT_OFF)
    # Lichtbänder (Sprite-Koordinaten, Diagonale x + y): Gold in den ersten 20 Frames, Klinge später
    d_gold = -4 + 2 * ((i - 2) % 24) if 0 <= (i - 2) % 24 < 18 else None
    d_klinge = 8 + 2 * ((i - 14) % 24) if 0 <= (i - 14) % 24 < 12 else None
    if d_gold is not None:
        V.glanz_band(k, GOLD_K, GOLD, d_gold, 3, OFF)
        V.glanz_band(s, GOLD_S, GOLD, d_gold, 3, OFF)
    if d_klinge is not None:
        V.glanz_band(s, STAHL_S, STAHL, d_klinge, 3, OFF)
    if V.fenster(i, N, 12, 3) or V.fenster(i, N, 35, 3):                     # Blinzeln
        V.setze(k, {(x + 0, y): HOEHLE for (x, y) in AUGEN}, OFF)
    kb = L.streck_zeile(k, OFF[1] + 10, n)
    # Schwertspitze pendelt unterhalb der Hand (Zeile 9), Schwert steigt starr mit der Hand
    aus = 1.4 * math.sin(2 * math.pi * i / 36)
    s = U.haengen(s, OFF[1] + 9, aus, 1.0)
    f = L.zusammen(H, W, [(s, 0, -n), (kb, 0, 0)])
    if nur is None:                                                          # Glitzersterne am Gold (nach der Figur, am Objekt)
        for (sx, sy, st0, dy_) in ((22, 2, 4, -n), (11, 4, 16, -n), (4, 5, 26, -n), (27, 5, 36, -n), (15, 21, 9, 0), (16, 15, 31, -n)):
            st = stern_folge(i, st0)
            if st:
                V.stern(f, sx, sy + dy_, st, (255, 255, 255), (255, 222, 90), OFF)
    return U.kontur_schliessen(f, UMRISS, KONTUR) if nur else f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-king-skullmael', 'Skeleton King Skullmael', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-king-skullmael-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
