# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Spinor“ (Creature) — riesiger Spinosaurus (Fischjäger): langsam, schwer.

PICK: [["MotiveGrailWar", 511, "Spinosaurus der Sammelebene „Dinos“ (Ebenenkoordinaten x 363–437, y 80–122), Pixel mit Alpha ≥ 127"]]
Quelle: src/gigantisaur-spinor.png (75×43 px, 65 Farbtöne – die Ebene selbst hat fein abgestufte Brauntöne). Kopf, Segel, Rumpf, Arme und Krallen sind in der Ebene deckend; die HINTERBEINE und das SCHWANZENDE
(x ≥ 62, y 27) haben dort Alpha 127 (auf der Karte stehen sie unter Wasser) und wurden deckend gemacht (Brief: Halbtransparentes deckend). Der weiche Schatten der Ebene (Alpha < 127) gehört nicht zur Figur.
Die Kartenkunst zeigt dieselbe Figur (Abgleich mit der zusammengerechneten Ebene „Sichtbar #60“). Nichts ergänzt.

Aufruf:   python3 gigantisaur_spinor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-spinor.png + .json

Identifikation (x, y im Sprite; blickt nach links):
* Kopf (x 0–20, y 10–22): zwei gelbe Augen mit dunklem Rand – (4, 12–13) und (9–10, 12–13); lange Schnauze, offenes Maul mit weißen Zähnen (x 0–7, y 17–20), Unterkiefer (x 3–12, y 20–22);
  kleine Nackenzacken (x 12–20, y 11–13).
* Rückensegel (x 21–58, y 0–22): gelb/creme mit braunen Knochenstrahlen (jede dritte Spalte) – starr; niedriger Kamm läuft auf dem Schwanz aus (x 59–68, y 22–24).
* Rumpf (x 12–62, y 14–30), braunes Schachbrett-Raster (q/f); Schwanz nach rechts (x 60–74, y 22–27).
* Zwei Arme mit je drei grauweißen Krallen: (x 17–23, y 23–30) und (x 24–30, y 23–30).
* Hinterbeine: fernes Bein (dunkleres Raster T/f, x 35–47, y 28–39, Fuß nach links), nahes Bein (x 40–51, y 28–42).
Bleibt fest: Segel, Zähne (nur starr mit dem Kiefer), Füße.

Idle-Idee: der Fischjäger lauert – schnappt mit dem Maul, greift mit den Krallen, der Schwanz pendelt.
Ablauf (60 Frames à 80 ms = 4,8 s), alle Bewegungen unabhängig:
* Schnappen (Frames 10–15 und 40–45, je zwei Bisse): die Kieferspitze (x ≤ 7, ab Zeile 20, samt der unteren Zähne (3, 19–20) (5, 19–20)) hebt sich als Pose 1 px – die Zähne greifen ineinander.
* Krallen greifen (Frames 20–29 und 50–59): erst der vordere, dann der hintere Arm hebt sich als starre Pose 1 px (eine Armzeile entfällt, Hand und Krallen unverändert).
* Schwanz pendelt (2× je Schleife): spaltenweise Biegung ab x 60 (Gefälle ≤ 1 px, Raster wird fortgeführt), Spitze ±2 px.
* Atmen (2× je Schleife, oben in Frames 3–15 und 33–45): Zeile 33 (nur die Beine) wird texturiert eingefügt (anim_textur) – der ganze Körper hebt sich 1 px, die Füße bleiben stehen.
* Blinzeln (Frames 34–37): das Gelb beider Augen wird zur Hautfarbe.
Offene Kanten schließt anim_tiere.umriss_schliessen (Umrissfarbe des Originals). Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_drache as D
import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 60, 80
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 5

spr = L.lade('gigantisaur-spinor')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

M_, Q_, F_, T_ = (93, 62, 41), (163, 118, 89), (138, 91, 61), (118, 76, 52)
HAUT = [Q_, F_, T_, (160, 116, 87), (136, 89, 60), (137, 90, 60), (161, 117, 88), (162, 117, 88), (135, 89, 60), (159, 115, 87)]
ALLE = sorted({tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]})
UMRISS = [c for c in ALLE if c not in HAUT]
REGEL = {c: M_ for c in HAUT}
LID = (136, 89, 60)
AUGEN_GELB = [(4, 12), (4, 13), (10, 12), (9, 13)]

kiefer_m = vorhanden & (xx <= 7) & ((yy >= 20) | ((yy == 19) & ((xx == 3) | (xx == 5))))
arm1_m = vorhanden & (xx >= 17) & (xx <= 23) & (yy >= 24) & (yy <= 30)
arm2_m = vorhanden & (yy >= 24) & (yy <= 30) & (((yy == 24) & (xx >= 26) & (xx <= 28)) | ((yy == 25) & (xx >= 26) & (xx <= 29)) | ((yy >= 26) & (xx >= 24) & (xx <= 29)))
schwanz_m = vorhanden & (xx >= 60) & (yy >= 22)
koerper = vorhanden & ~kiefer_m & ~arm1_m & ~arm2_m & ~schwanz_m

BISS = [1, 1, 0, 0, 1, 1]
GRIFF = [1, 1, 1, 1, 1, 1]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 30) in range(3, 16) else 0
    biss = Z.hub(i, [10, 40], BISS)
    arm1 = Z.hub(i, [20, 50], GRIFF)
    arm2 = Z.hub(i, [24, 54], GRIFF)
    bl = D.blinzeln(i, 34)
    schwanz = 2.0 * Z.sinus(i, N / 2)
    return atem, biss, arm1, arm2, bl, schwanz


def frame(i, nur=None):
    atem, biss, arm1, arm2, bl, schwanz = zustand(i)
    k = teil(koerper)
    if bl:
        for x, y in AUGEN_GELB:
            k[PAD_T + y, PAD_L + x, :3] = LID
    a1 = L.heben_unten(teil(arm1_m), PAD_T + 24, arm1)
    a2 = L.heben_unten(teil(arm2_m), PAD_T + 24, arm2)
    dys = Z.biegung(PAD_L + 60, PAD_L + 74, PAD_L + 74, schwanz, 1.0)
    sw_ = Z.biegen(teil(schwanz_m), dys, [(Q_, F_)])
    ebenen = {'koerper': (k, 0), 'schwanz': (sw_, 0), 'arm2': (a2, 0), 'arm1': (a1, 0), 'kiefer': (teil(kiefer_m), -biss)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    ganz = T.umriss_schliessen(ganz, UMRISS, REGEL)
    return TX.streck_zeile(ganz, PAD_T + 33, atem)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n), '| Original', int(vorhanden.sum()))
    print('Lücken je Frame (Original %d):' % Z.loecher(spr), sorted({Z.loecher(f) for f in frames}))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-spinor', 'Gigantisaur Spinor', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-spinor-strip.png', frames, spalten=12, scale=3)
