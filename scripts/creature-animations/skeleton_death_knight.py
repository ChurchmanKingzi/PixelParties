# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Death Knight“ (Creature) — schwarzer Skelettritter mit spitzer Kapuze, roten Augen und einem grünen Edelstein auf der Stirn.

Quelle: src/skeleton-death-knight.png (20×28 px, 20 Farben, fast nur Schwarz/Dunkelgrau) — Ebene „Skeleton Death Knight“ (Motive.xcf, Ebene 812), Figur 1; die Kartenkunst zeigt dieselbe Figur
(Karte Skeleton_Death_Knight.png bei x 33–52). Die Quelle ist vollständig (alles deckend, nichts verdeckt).
PICK: [["Motive", 812, 1]]   (Figur 2/5 „Slow“ (34×7) und die übrigen Treffer sind Fels/Gras der Kulisse)

Aufruf:   python3 skeleton_death_knight.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-death-knight.png + .json

Was ist was (x, y im Sprite):
* KAPUZE (x 5–13, y 0–6): spitz zulaufend, dunkles Blauviolett (9,6,20)/(17,12,37) mit schwarzem Umriss; auf der Stirn ein grüner EDELSTEIN (22,68,13) bei (9,4)–(9,5).
* SCHÄDEL/HELM (x 7–12, y 7–16): dunkelgraue Stirnplatte (38,38,38)/(64,64,64) y 7–10, zwei rote AUGEN (128,0,0) bei (8,12) und (11,12) mit grauen Wangenpixeln (125,125,125) darunter (y 13), Kiefer/Zähne y 14–16.
* SCHULTERSPITZEN (x 3–4 und 15–16, y 7–10): graue Stege am Kapuzenrand. ARME (x 1–4 bzw. 15–18, y 11–18): schwarze Ärmel mit grauer Kante; die FÄUSTE hängen frei darunter (x 0–4 bzw. 15–19, y 19–22).
* RUMPF (y 11–22): Rippen/Brustplatte in Schwarz mit Grautönen (78…125), unten ein helleres Becken-/Gürtelband (94…125, y 19–22); BEINE/FÜSSE y 23–27.
Metall/Gold/Edelstein: der grüne Stein (kein hellerer Grünton im Sprite, also nur Dimmen); die grauen Teile sind Knochen/Stoff, nicht erkennbar Metall → kein Lichtband, keine Sterne (Regel 14). Kein Feuer.
Keine Partikel (nichts im Sprite, das raucht).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, zweimal pro Schleife, 0 → 1 → 2 → 1 → 0 px): die Rippenzeile y 17 wird 0–2× eingefügt (Texturmischung); Kapuze, Schädel, Schultern und Brust steigen, Becken und Beine bleiben am Boden.
  Nur der Rumpf atmet; die Arme (Schulterspitzen bleiben beim Rumpf) steigen starr um denselben Betrag mit (nichts wird gestreckt).
* FÄUSTE schwingen aus (Pendel ±1 px waagerecht, links Periode 28, rechts Periode 40; sie hängen dabei am Unterarm (y 18) und bleiben über ≥ 2 Pixel angeschlossen).
* AUGEN blinzeln (Frames 14–16 und 38–40): das rote Pixel nimmt die Schwarz-Farbe der Augenhöhle (0,0,0) an (Lid); die grauen Wangenpixel bleiben.
* EDELSTEIN pulsiert (Periode 16, dreimal pro Schleife): oberes Pixel dunkelt auf (31,34,30), dann das untere, dann wieder beide hell — eine Stufe, keine neuen Farben.
Kein Kopfneigen, keine seitliche Gewichtsverlagerung (Regel 17); Füße bleiben am Boden (Regel 18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; die Randpixel an bewegten Teilen schließt `U.kontur_schliessen` mit der Umrissfarbe der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('skeleton-death-knight')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 0, 0)
AUGEN = [(8, 12), (11, 12)]
assert all(col(x, y) == (128, 0, 0) for (x, y) in AUGEN)
LID = (0, 0, 0)
STEIN = [(9, 4), (9, 5)]
assert all(col(x, y) == (22, 68, 13) for (x, y) in STEIN)
DIMM = (31, 34, 30)

# Teile
arm_l = vorhanden & (xx <= 3) & (yy >= 11)
arm_r = vorhanden & (xx >= 16) & (yy >= 11)
faust_l = arm_l & (yy >= 19)
faust_r = arm_r & (yy >= 19)
fore_l, fore_r = arm_l & ~faust_l, arm_r & ~faust_r
rest = vorhanden & ~arm_l & ~arm_r
assert (rest | arm_l | arm_r).sum() == vorhanden.sum()
TEST_EBENEN = None


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def pendel(i, per, ph=0.0):
    """Faust: ±1 px, 0 bei i = 0."""
    return int(round(1.0 * (math.sin(2 * math.pi * i / per + ph) - math.sin(ph))))


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    lift = n                                                                 # Arme sind starr mit den Schultern verbunden (nichts wird gestreckt)
    ex_l = ex_r = 0
    k = teil(rest)
    if V.fenster(i, N, 14, 3) or V.fenster(i, N, 38, 3):                     # Blinzeln
        V.setze(k, {p: LID for p in AUGEN}, OFF)
    ph = i % 16                                                              # Edelstein: oben dunkel, unten dunkel, beide hell
    if ph in (4, 5, 6):
        V.setze(k, {STEIN[0]: DIMM}, OFF)
    elif ph in (8, 9, 10):
        V.setze(k, {STEIN[1]: DIMM}, OFF)
    kb = V.streck_teil(k, k[..., 3] > 0, OFF[1] + 17, n)
    dy_l, dy_r = -(lift + ex_l), -(lift + ex_r)
    dxl, dxr = pendel(i, 28), -pendel(i, 40, 0.0)
    ebenen = [(kb, 0, 0),
              (teil(fore_l), 0, dy_l), (teil(faust_l), dxl, dy_l),
              (teil(fore_r), 0, dy_r), (teil(faust_r), dxr, dy_r)]
    f = L.zusammen(H, W, ebenen)
    return U.kontur_schliessen(f, UMRISS, KONTUR)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-death-knight', 'Skeleton Death Knight', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-death-knight-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
