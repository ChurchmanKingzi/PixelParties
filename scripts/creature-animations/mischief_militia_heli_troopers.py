# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Heli Troopers“ (Creature) — der Schneemann mit Hubschrauber-Rotor.

Quelle: src/mischief-militia-heli-troopers.png (13×20 px, 15 Farben) — Schneemann samt Rotorscheibe. Die Scheibe ist in der xcf-Ebene halbtransparent (Alpha 204–245, Rotor-Unschärfe) und
wurde deshalb von creature_show.py nicht mitgenommen; sie ist hier von Hand deckend gemacht (Regel 22), die Grautöne sind die der Ebene (128/178/190/230/255).
PICK: [["MotiveRussia", 123, 1]]  (Ebene „Ebene #86“, Figur 1: Rumpf 275,2; Rotorscheibe Zeilen 0–4 der Ebene; Karte Mischief_Militia_Heli_Troopers.png zeigt vier solche Schneemänner)

Aufruf:   python3 mischief_militia_heli_troopers.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-heli-troopers.png + .json

Was im Sprite ist (x, y im 13×20-Sprite):
* ROTORSCHEIBE (x 2–10, y 0–4): flache graue Ellipse (Umriss F (128,128,128), innen G/I/J/L weiß/hellgrau), darunter der Rotormast M/N/O (6, 5–7), der im Kopf steckt.
* KOPF (y 5–12): Schnee B/D/E mit blauem Umriss C/A; Augen = zwei senkrechte braune 2-Pixel-Striche K/H (136,95,49)/(104,64,32) bei x 4 und x 8, y 9–10.
* SCHAL: blaue Linie C (y 12–13); ZWEIGARME H (104,64,32): links (0,13)/(1,14), rechts (12,12)/(11,13)/(10,14); KÖRPER (y 13–19): Schneeball B/D/E mit blauem Umriss C.
Material: Schnee und Rotor — KEIN Glanz (Regel 14), kein Feuer.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos), alle Bewegungen unabhängig:
* Rotor dreht (6 Bilder je Blattdurchgang): die Scheibe behält ihre Ellipsenform und ihren Rand; zwei helle Blattschatten wandern um die Ellipse (12 Schritte/Umlauf-Viertel, 4 Umläufe je Schleife).
* Schweben (Periode 24, zwei Schwünge): der Rotor trägt ihn — der ganze Schneemann hebt/senkt sich um bis zu ±2 px (er FLIEGT, daher kein Bodenkontakt); der Rotor läuft 1 Bild nach.
* Atmen/Strecken (Periode 16): die Zeile 16 des Schneeballs wird einmal doppelt eingefügt (Mischtextur), Kopf, Rotor und Arme steigen 1 px mit.
* Blinzeln (alle 2 s, 2 Frames): die braunen Augenstriche werden zu Schneefarbe (Lid in umgebender Körperfarbe).
* Kalter Dunst: 5 Wölkchen ≥ 2×2 steigen langsam seitlich vom Schneemann auf (Farben E/D).
Ergänzungen: keine gemalten Pixel außer der Rotorfärbung (Farben des Sprites). Frame 0 = Original (Dunst ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 6, 5
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-heli-troopers')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

RING = [(x, y) for y in range(5) for x in range(sw) if spr[y, x, 3]]
RING_FARBEN = {'dunkel': (128, 128, 128), 'mittel': (190, 190, 190), 'hell': (230, 230, 230), 'weiss': (255, 255, 255), 'dunkel2': (178, 178, 178)}
MITTE = (6, 2)
AUGEN = {(4, 9): (136, 95, 49), (4, 10): (104, 64, 32), (8, 9): (136, 95, 49), (8, 10): (104, 64, 32)}
LID = {(4, 9): (214, 213, 244), (4, 10): (214, 213, 244), (8, 9): (214, 213, 244), (8, 10): (214, 213, 244)}
E_, D_ = (223, 224, 246), (204, 204, 242)


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    ph = 2 * math.pi * 4 * i / N
    E.rotor_faerben(k, OFF, RING, MITTE, ph, RING_FARBEN, rx=3.8, ry=1.7)
    blink = Hm.folge(i, 30, [1, 1], N)
    if blink:
        Hm.setze(k, LID, OFF)
    # Atmen: Zeile 16 doppelt
    k = Hm.atmen(k, PAD_T + 16, PAD_T + 12, E.verlauf3(i, 16, 0.0, 1), 0)
    # Schweben: ganze Figur
    hub = E.wippen(i, 24, 0.0, 2.0)
    k = L.versetze(k, 0, hub)
    Hm.kontur_schliessen(k, ERLAUBT, (85, 117, 169))
    return k


_rnd = random.Random(11)
DUNST = [dict(x=PAD_L + x, y=PAD_T + 17 + dy, vx=vx, vy=-12, off=o, form=f, wackeln=1.0, ph=p) for (x, dy, vx, o, f, p) in
         [(-2, 0, -1.5, 0, 'm', 0.0), (14, 1, 1.5, 10, 'o', 0.3), (-3, -2, -1.0, 20, 'o', 0.6), (15, -1, 1.0, 29, 'm', 0.1), (-1, 2, -2.0, 39, 'm', 0.8)]]
DUNST_FARBEN = {'c': E_, 'r': D_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'heli-troopers')
    L.speichern('mischief-militia-heli-troopers', 'Mischief Militia - Heli Troopers', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-heli-troopers-strip.png', frames[::2], spalten=12, scale=6)
