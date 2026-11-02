# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Colored Snow“ (Creature) — der Rotor-Schneemann mit schwarzen Augenstrichen und rotem Mund.

Quelle: src/mischief-militia-colored-snow.png (14×20 px, 19 Farben) — Schneemann samt Rotorscheibe. Die Scheibe ist in der xcf-Ebene halbtransparent (Alpha 204–245, Rotor-Unschärfe) und
wurde deshalb von creature_show.py nicht mitgenommen; sie ist hier von Hand deckend gemacht (Regel 22), die Grautöne sind die der Ebene (128/178/190/230/255).
PICK: [["MotiveRussia", 83, 1]]  (Ebene „Ebene #145“, Figur 1, Ausschnitt x 64–79, y 0–19; Rotorscheibe Zeilen 0–4 der Ebene mit; die Karte Mischief_Militia_Colored_Snow.png zeigt dieselben Rotor-Schneemänner links oben/rechts oben; die Farbspritzer (Ebene 80/81) in der Kartenmitte sind eigene Teile und nicht Teil dieses Sprites)

Aufruf:   python3 mischief_militia_colored_snow.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-colored-snow.png + .json

Was im Sprite ist (x, y im 14×20-Sprite):
* ROTORSCHEIBE (x 3–13, y 0–4): flache graue Ellipse (Umriss D (128,128,128), innen weiß/hellgrau N/O/I/J/L/P), darunter der Rotormast Q/R/S (8, 5–7).
* KOPF (y 5–11): Schnee B/C/E mit Umriss A/F; GESICHT: schwarze Augenlider G (x 5–6 und 10–11, y 7 und y 9) mit weißem Auge E dazwischen (y 8), braune Punkte H (6,10)/(10,10) (Wangen/Nase — nicht eindeutig,
  deshalb KEIN Blinzeln); roter Mund K (79,0,0) bei (6,12), (7–8,13).
* SCHAL F (blau, y 11–13); ZWEIGARME H (104,64,32): links (0,11)/(1,12)/(2,13), rechts (13,12)/(12,13); KÖRPER (y 12–19): Schneeball B/C/E mit blauem Umriss F.
Material: Schnee und Rotor — KEIN Glanz (Regel 14), kein Feuer.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos), alle Bewegungen unabhängig:
* Rotor dreht (4 Umläufe je Schleife): die Scheibe behält Ellipsenform und Rand, zwei helle Blattschatten wandern um die Ellipse.
* Schweben (Periode 24): der Rotor trägt ihn — der ganze Schneemann hebt/senkt sich um bis zu ±2 px (er FLIEGT, kein Bodenkontakt).
* Atmen/Strecken (Periode 16): Zeile 16 des Schneeballs wird einmal doppelt eingefügt (Mischtextur), Kopf, Rotor und Arme steigen 1 px mit.
* Zweigarme schlenkern (Perioden 24/32, gegenläufig): die Spitze wandert zwischen y 8 und 13 (links) bzw. y 9 und 14 (rechts), die Linie wird 4-verbunden neu gezogen (nur auf leere Felder).
* Kalter Dunst: 5 Wölkchen ≥ 2×2 steigen langsam seitlich vom Schneemann auf.
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
PAD_L, PAD_R, PAD_T, PAD_B = 8, 9, 6, 5
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-colored-snow')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

RING = [(x, y) for y in range(5) for x in range(sw) if spr[y, x, 3]]
ZWEIG = (104, 64, 32)
ARM_L = [(0, 11), (1, 12)]          # frei werdende Pixel des linken Arms (Basis (2,13) bleibt)
ARM_R = [(13, 12)]                # rechter Arm: Basis (12,13) bleibt
RING_FARBEN = {'dunkel': (128, 128, 128), 'mittel': (190, 190, 190), 'hell': (230, 230, 230), 'weiss': (255, 255, 255), 'dunkel2': (178, 178, 178)}
MITTE = (8, 2)
E_, D_ = (223, 224, 246), (204, 204, 242)
FARBEN_RING = RING_FARBEN


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    ph = 2 * math.pi * 4 * i / N
    E.rotor_faerben(k, OFF, RING, MITTE, ph, RING_FARBEN, rx=5.2, ry=1.8)
    tl = 11 + int(round(2.6 * math.sin(L.sinus(i, 24))))
    tr = 12 + int(round(2.4 * math.sin(L.sinus(i, 32))))
    if tl != 11:
        E.zweig_loeschen(k, OFF, ARM_L)
        E.zweig_zeichnen(k, OFF, (2, 13), (0, tl), ZWEIG)
    if tr != 12:
        E.zweig_loeschen(k, OFF, ARM_R)
        E.zweig_zeichnen(k, OFF, (12, 13), (13, tr), ZWEIG)
    # Atmen: Zeile 16 doppelt
    k = Hm.atmen(k, PAD_T + 16, PAD_T + 12, E.verlauf3(i, 16, 0.0, 1), 0)
    # Schweben: ganze Figur
    hub = E.wippen(i, 24, 0.0, 2.0)
    k = L.versetze(k, 0, hub)
    Hm.kontur_schliessen(k, ERLAUBT, (85, 117, 169))
    return k


_rnd = random.Random(11)
DUNST = [dict(x=PAD_L + x, y=PAD_T + 17 + dy, vx=vx, vy=-12, off=o, form=f, wackeln=1.0, ph=p) for (x, dy, vx, o, f, p) in
         [(-2, 0, -1.5, 0, 'm', 0.0), (15, 1, 1.5, 10, 'o', 0.3), (-3, -2, -1.0, 20, 'o', 0.6), (16, -1, 1.0, 29, 'm', 0.1), (-1, 2, -2.0, 39, 'm', 0.8)]]
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
    A.ausdruck_pruefen(ohne, spr, 'colored-snow')
    L.speichern('mischief-militia-colored-snow', 'Mischief Militia - Colored Snow', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-colored-snow-strip.png', frames[::2], spalten=12, scale=6)
