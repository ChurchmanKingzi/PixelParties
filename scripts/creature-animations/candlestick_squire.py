# -*- coding: utf-8 -*-
"""Idle-Animation für „Candlestick Squire“ (Creature).

Quelle: src/candlestick-squire.png — Ebene „Candlestick Squire“ (23×36 px, 401 Pixel, 38 Farben) aus Motive.xcf (Ebene 727, Figur 1, Treffer 0.995).
PICK: [["Motive", 727, 1]]

Aufruf:   python3 candlestick_squire.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/candlestick-squire.png + .json

Was ist was (x/y im Sprite):
* ZWEI FLAMMEN (Regel 15): (1) die Kerzenflamme auf dem Helmdorn (x 7–15, y 0–7; sie sitzt auf einer dünnen dunklen Stange (8–10, 8–12), die oben am Helm (9, 12) beginnt) und
  (2) die Fackelflamme am Stab rechts (x 15–22, y 2–12; der Stab ist ein cremefarbener Stiel x 16–17, y 13–35 mit dunkler Kappe (17,13)). Farben: Rot (202,44,41), Orange (244,123,34),
  Gelb (246,231,14), Hellgelb (247,245,184).
* Helm (x 3–12, y 13–18): grauer Metallhelm mit senkrechten Sehschlitzen; Gesicht (y 18–21) mit zwei roten Augen (6,19) (10,19) (202,44,41)/(211,58,58) und hellen Pupillen (6,20) (10,20)
  (247,245,184); Haut orange-braun (187,104,49)/(215,123,62).
* Rumpf (x 3–13, y 22–33): rote/braune Tuchrüstung (85,33,33)/(158,61,61)/(184,71,71), goldene Gürtelschnalle (217,217,64)/(241,241,71) bei (7–8, 29) (Metall: darf glänzen); Arme: links (1–3, 24–28),
  rechts (12–15, 23–24) mit Hand am Stab (16–18, 23–24); Beine/Stiefel y 31–35.
Fest bleiben: Stab, Helmform, Rumpfform, Stiefel.

Ablauf (48 Frames à 65 ms = 3,12 s):
* Beide Flammen werden mit dem wiederverwendbaren Modul anim_feuer.py NEU gezeichnet (verschachtelte Zungen: rote Außenhaut, orange Körper, gelber und heller Kern, jede Schicht mit eigener Höhe,
  Kerne wandern, Spitzen neigen sich und reißen als Funken ab). Zwei Zungen je Flamme, Fuß fest auf Dorn bzw. Stab. Frame 0 weicht deshalb in den Flammen vom Original ab; der Rest ist exakt das Original.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): die Rumpfzeile y 26 wird 1–2× eingefügt, Helm, Dorn samt Kerzenflamme, Schultern und rechte Hand heben sich, Beine/Stiefel und Stab bleiben stehen
  (die Hand gleitet am Stab).
* Blinzeln (Lid = Hautfarbe (187,104,49)): die roten Augen samt Pupillen werden 3 Frames zu Haut, zweimal pro Schleife (Frame 15–17 und 38–40). Kein Glühen und kein Farbwechsel sonst.
* Glanz nur auf Metall (Regel 12/14): ein Lichtband läuft diagonal über den grauen Helm (zweimal pro Schleife, Start Frame 6 und 30, 10 Frames), dazu blitzt ein vierzackiger Glitzerstern an der
  goldenen Gürtelschnalle (Mitte (241,241,71), Arme (217,217,64); 3 Frames, Frame 10–12 und 34–36). Feuer glänzt nicht (kein Stern/Band auf den Flammen).
* Glutpünktchen (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen k, o): runde orange/gelbe Funken (Kern (246,231,14),
  Rand (244,123,34)) und rote Glutkugeln (Kern (244,123,34), Rand (202,44,41)) bei den Flammen und am Rumpf; dazu die vom Feuermodul abgerissenen Funken (Teil der Flammen).
Randpixel-Test (Regel 16): `U.kontur_schliessen` am Körper (Umrissfarbe aus dem Sprite); die Flammenränder sind immer die Außenhautfarbe (202,44,41) = eine Randfarbe der Quelle.
ERGÄNZUNG: keine gemalten Pixel außer der neu gezeichneten Flamme (Farben der Quelle). Zuschnitt: der Frame ist auf die Figur (samt Flammen und abgerissenen Funken) zugeschnitten,
symmetrisch um die Ruhefigur; die runden Partikel vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer as FEU

N, MS = 48, 65
GPL, GPR, GPT, GPB = 8, 8, 14, 4

spr = L.lade('candlestick-squire')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)

ROT, ORANGE, GELB, HELL = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
FLAMMENFARBEN = {ROT, ORANGE, GELB, HELL}
fl = np.array([[bool(vorhanden[y, x]) and col(x, y) in FLAMMENFARBEN and y <= 12 for x in range(sw)] for y in range(sh)])
flamme1 = fl & (xx <= 15) & (yy <= 7)
flamme2 = fl & (xx >= 15) & (yy >= 2)
assert (flamme1 | flamme2).sum() == fl.sum()
staerke_nicht = flamme1 | flamme2
STAB = vorhanden & (xx >= 16) & (xx <= 17) & (yy >= 13) & ~np.array([[col(x, y) in {(187, 104, 49), (215, 123, 62), (207, 130, 78), (164, 103, 62)} if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)])
koerper_m = vorhanden & ~flamme1 & ~flamme2 & ~STAB
HELM = vorhanden & (yy >= 13) & (yy <= 17) & (xx >= 3) & (xx <= 13)

RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': HELL}
SPERRE1 = np.zeros((H, W), bool)
SPERRE1[GPT + 8, GPL + 10] = True                       # Dornspitze unter der Kerzenflamme (fest, zählt als Material)
SPERRE2 = np.zeros((H, W), bool)
SPERRE2[GPT + 13, GPL + 17] = True                      # Stabkappe unter der Fackelflamme
assert vorhanden[8, 10] and vorhanden[13, 17]
# Zungen (x, Fußzeile, Höhe, Halbbreite am Fuß): breite Basis wie im Original (Helmflamme ~8 px, Fackelflamme ~7 px), je drei Zungen mit Halbbreite ≥ 1,5 (Fuß ≥ 3 px);
# Seeds und Amplitude sind so gewählt, dass in allen 48 Frames (a) kein Flammenteil dünner als 2 px über 2 px Länge hinausgeht, (b) die beiden Flammen sich nie berühren (auch nicht diagonal),
# (c) die Flamme im Frame 0 dem Original möglichst nahe liegt (Überdeckung ~0,75).
Z1 = [FEU.Zunge(7.6 + GPL, 7 + GPT, 6.0, 1.7), FEU.Zunge(9.8 + GPL, 7 + GPT, 7.5, 2.0), FEU.Zunge(12.0 + GPL, 7 + GPT, 5.5, 1.7)]
Z2 = [FEU.Zunge(17.0 + GPL, 12 + GPT, 7.0, 1.7), FEU.Zunge(19.2 + GPL, 12 + GPT, 10.0, 2.0), FEU.Zunge(21.0 + GPL, 11 + GPT, 6.5, 1.5)]
FEUER1 = FEU.Feuer(H, W, Z1, RAMPE, n=N, seed=26, posen=12, amplitude=0.6, sperre=SPERRE1)
FEUER2 = FEU.Feuer(H, W, Z2, RAMPE, n=N, seed=28, posen=12, amplitude=0.6, sperre=SPERRE2)

HAUT = (187, 104, 49)
AUGEN = [(6, 19), (10, 19), (6, 20), (10, 20)]
assert all(col(x, y) in {(211, 58, 58), (202, 44, 41), (247, 245, 184)} for (x, y) in AUGEN)
assert HAUT in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}
BLINZ = {15, 16, 17, 38, 39, 40}

# Metall-Rampe des Helms: die Grautöne des Helms, ein Lichtband hebt jede Farbe zwei Stufen
HELMGRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if HELM[y, x]}, key=lambda c: sum(c))
RAMPE_HELM = {c: HELMGRAU[min(len(HELMGRAU) - 1, k + 2)] for k, c in enumerate(HELMGRAU)}
SCHNALLE = (8, 29)
assert col(7, 29) == (217, 217, 64) and col(8, 29) == (241, 241, 71)
STERN_MITTE, STERN_ARM = (241, 241, 71), (217, 217, 64)

GLUT1 = {'c': GELB, 'r': ORANGE}
GLUT2 = {'c': ORANGE, 'r': ROT}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(12, 3)[0], y=P(12, 3)[1], vx=1, vy=-7, off=0, form='k', wackeln=1),            # an der Kerzenflamme
    dict(x=P(20, 6)[0], y=P(20, 6)[1], vx=1, vy=-9, off=20, form='k', wackeln=1),           # an der Fackel
    dict(x=P(6, 4)[0], y=P(6, 4)[1], vx=-1, vy=-6, off=34, form='k', wackeln=1),
]
PUFFS2 = [
    dict(x=P(5, 8)[0], y=P(5, 8)[1], vx=-1, vy=-6, off=10, form='k', wackeln=1),            # links neben dem Helm
    dict(x=P(2, 22)[0], y=P(2, 22)[1], vx=-1, vy=-10, off=26, form='k', wackeln=1),         # an der linken Schulter
    dict(x=P(13, 24)[0], y=P(13, 24)[1], vx=1, vy=-9, off=42, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0
    kb = teil(koerper_m)
    b = 1 if i in BLINZ else 0
    if b:
        for (x, y) in AUGEN:
            kb[GPT + y, GPL + x, :3] = HAUT
    for start in (6, 30):                                         # Lichtband über den Metallhelm
        j = i - start
        if 0 <= j <= 9:
            d = 14 + 2 * j
            for y in range(sh):
                for x in range(sw):
                    if HELM[y, x] and d <= x + y < d + 3:
                        c = col(x, y)
                        if c in RAMPE_HELM:
                            kb[GPT + y, GPL + x, :3] = RAMPE_HELM[c]
    if n:
        kb = L.streck_zeile(kb, GPT + 26, n)
    stab = teil(STAB)
    f1 = FEUER1.ebene(i)
    f2 = FEUER2.ebene(i)
    f1 = L.versetze(f1, 0, -n)                                   # Kerzenflamme steigt mit dem Helm
    funken = L.zusammen(H, W, [(FEUER1.funken(i, dy=-n, leben=8), 0, 0), (FEUER2.funken(i, leben=8), 0, 0)])
    koerper = L.zusammen(H, W, [(stab, 0, 0), (kb, 0, 0)])
    koerper = U.kontur_schliessen(koerper, UMRISS, (26, 26, 26))
    figur = L.zusammen(H, W, [(koerper, 0, 0), (f2, 0, 0), (f1, 0, 0), (funken, 0, 0)])
    if nur == 'koerper':
        return figur
    sterne = L.leer(H, W)
    for start in (10, 34):
        k = i - start
        if 0 <= k <= 2:
            L.einsetzen(sterne, U.stern_ebene(H, W, GPL + SCHNALLE[0], GPT + SCHNALLE[1], (2, 3, 2)[k], STERN_MITTE, STERN_ARM))
    g1 = _glut(H, W, i, N, PUFFS1, GLUT1)
    g2 = _glut(H, W, i, N, PUFFS2, GLUT2)
    return L.zusammen(H, W, [(g1, 0, 0), (g2, 0, 0), (figur, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur (samt Flammen und abgerissenen Funken): symmetrisch um die Ruhefigur; runde Partikel und der Glitzerstern dürfen den Frame höchstens 2 px darüber hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('candlestick-squire', 'Candlestick Squire', frames, MS, prev)
    if prev:
        L.streifen(prev + '/candlestick-squire-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
