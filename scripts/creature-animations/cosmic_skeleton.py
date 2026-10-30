# -*- coding: utf-8 -*-
"""Idle-Animation für „Cosmic Skeleton“ (Creature) — Fassung 3 (stehend, Augenhöhle glüht tiefrot, ohne Glanz: Kosmos-Fläche ist kein Metall, Regel 14).

Quelle: src/cosmic-skeleton.png — Ebene „Cosmic Skele“ (20×21 px, 7 Farben) aus Motive.xcf. Die Ebene ist vollständig deckend (Alpha nur 0/255,
nichts fehlt). Der große sternförmige Violett-Schein, der helle Lila-Schädel links oben und die vielen gelben Sternpunkte der Karte sind eigene Ebenen
und NICHT Teil dieses Sprites (nur drei Sternpixel gehören dazu; sie bleiben fest).
PICK: [["Motive", 805, 1]]

Aufruf:   python3 cosmic_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cosmic-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Farben: violette Rampe A (21,0,33) < D (46,0,74) < C (77,0,122) < B (111,0,176); drei gelbe Sternpixel E (255,255,9) bei (6,6), F (255,255,99) bei (16,9),
  G (255,255,164) bei (3,13) (feste Sterne im Körper).
* Kopf y 0–6, x 5–14: dunkler Schädel mit zwei hellvioletten Flecken oben (B bei (7–9,1) und (11–12,1), Deutung unsicher), linke Gesichtshälfte D,
  Loch (transparent) bei (11–12, 4–5) = vermutlich Augenhöhle. Augen werden NICHT animiert (Deutung unsicher).
* Rumpf y 7–15 (Schulterzeile y 7–9, Rippenmuster aus B/C auf A, Becken y 15), Arme: oben an den Schultern (y 7–9), darunter frei hängend
  (x 1–3 links, x 16–18 rechts, y 10–15), Hände bei y 12–14.
* Beine y 16–20 (x 4–8 und 11–15), Füße y 19–20.
Fest bleiben: Schädelform, Rippenmuster, Umrisse A, die drei Sternpixel.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Staub ausgenommen) — kein Lichtband, kein Funkeln, keine Glitzersterne (Regel 14):
* STEHENDE Figur (Fassung 3): kein Schweben, kein Wallen, keine Gesamt- oder Zeilenwelle; die Füße bleiben fest am Boden. Einzige Gesamtbewegung: Atmen (s. u.).
* Augenhöhle (11–12, 4–5; vier transparente Pixel, ringsum deckend) glüht dreimal pro Schleife TIEFROT (je 8 Frames ab Frame 7, 23, 39, mit Anlauf
  dunkelrot (91,1,2) → (120,0,0) → tiefrot (143,0,0) → … → dunkelrot): die Höhlenpixel werden gefüllt, danach wieder transparent. Die drei Rottöne stammen aus
  data/palette.json (Ausnahme: nicht im Sprite, in L.pruefe freigegeben). Kein Glanz, kein Stern.
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 3 px, wächst von der Schulter y 9 zur Hand), die Unterarme pendeln zusätzlich
  mit einer Welle (Periode 12, Spitze hinkt hinterher, ±1 px, nur während der Schwingung).
* Beine baumeln: beide Beine pendeln gleichgerichtet (Periode 16, ±1,6 px, wächst vom Becken y 15 zum Fuß); die Naht zum Becken bleibt über Kanten verbunden.
* Atmen (Periode 24, 0/1 px, einzige Gesamtbewegung): im Rumpf-Layer wird Zeile y 12 einmal eingefügt; Schultern, Kopf und Arme heben sich 1 px über Becken und Beine. Kopf und Rumpf
  bleiben sonst starr (kein Wallen/Scheren mehr, das hatte den Kopf neben die Schultern gekippt).
* Sternenstaub (Partikel, hinter der Figur, 12 Stück, Lebensdauer 48 Frames, langsam aufsteigend, Formen k, o): gelbe Funken (Kern F, Rand E) und
  violette Kugeln (Kern B, Rand C) rund um die Figur. Alle Farben aus dem Sprite.
ERGÄNZUNG: keine gemalten Pixel (Kopf sinkt nur über Rumpfpixel; Arme/Beine lösen sich nur seitlich bei überlappender Naht).
Randpixel-Test (Regel 16): `U.kontur_schliessen` ergänzt in jeder Pose fehlende Umrisspixel (Schwarzviolett A) an Armen, Beinen und Wallkanten; im Ruhebild
ändert es nichts.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Körperrand hinaus, dazu 1 px leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (außer den drei Rottönen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
GPL, GPR, GPT, GPB = 8, 8, 16, 4

spr = L.lade('cosmic-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, D_, C_, B_ = (21, 0, 33), (46, 0, 74), (77, 0, 122), (111, 0, 176)
GE_, GF_, GG_ = (255, 255, 9), (255, 255, 99), (255, 255, 164)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (A_, D_, C_, B_, GE_, GF_, GG_))

UMRISS = U.umrissfarben(spr)
HOEHLE = [(11, 4), (12, 4), (11, 5), (12, 5)]                 # transparente Augenhöhle im Kopf (ringsum deckend, kein Randpixel)
assert all(not spr[y, x, 3] for (x, y) in HOEHLE)
ROT_STUFEN = [(91, 1, 2), (120, 0, 0), (143, 0, 0)]           # dunkelrot → tiefrot aus data/palette.json (Ausnahme: nicht im Sprite)
GLUEH = [0, 1, 2, 2, 2, 2, 1, 0]                              # Anlauf dunkelrot → tiefrot → dunkelrot (Index in ROT_STUFEN; 0 = erste Stufe), 8 Frames
AUGE_GLUT = {}
for _start in (7, 23, 39):                                    # dreimal pro Schleife, Frame 0 = Ruhe (Höhle transparent)
    for _k, _st in enumerate(GLUEH):
        AUGE_GLUT[_start + _k] = ROT_STUFEN[_st]
arm_l = vorhanden & (xx <= 4) & (yy >= 10) & (yy <= 15)
arm_r = vorhanden & (xx >= 15) & (yy >= 10) & (yy <= 15)
kopf = vorhanden & (yy <= 6)
rumpf = vorhanden & (yy >= 7) & (yy <= 15) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 16)
assert (arm_l | arm_r | kopf | rumpf | beine).sum() == vorhanden.sum()

STAUB = {'c': GF_, 'r': GE_}                          # Sternenstaub gelb
PURPUR = {'c': B_, 'r': C_}                           # violette Kugeln
P = lambda x, y: (GPL + x, GPT + y)
# Partikel bleiben nah an der Figur: der Frame ist auf die Figur zugeschnitten, Effekte dürfen ihn höchstens 2 px über den Körperrand hinaus vergrößern
PUFFS_GELB = [
    dict(x=P(-1, 12)[0], y=P(-1, 12)[1], vx=-1, vy=-10, off=0, form='k', wackeln=1),
    dict(x=P(20, 12)[0], y=P(20, 12)[1], vx=1, vy=-11, off=14, form='k', wackeln=1),
    dict(x=P(9, 3)[0], y=P(9, 3)[1], vx=1, vy=-5, off=27, form='k', wackeln=1),
    dict(x=P(5, 20)[0], y=P(5, 20)[1], vx=-2, vy=-11, off=36, form='o', wackeln=1),
    dict(x=P(14, 21)[0], y=P(14, 21)[1], vx=2, vy=-11, off=8, form='k', wackeln=1),
    dict(x=P(12, 8)[0], y=P(12, 8)[1], vx=3, vy=-9, off=21, form='k', wackeln=1),
]
PUFFS_PURPUR = [
    dict(x=P(1, 15)[0], y=P(1, 15)[1], vx=-2, vy=-12, off=20, form='o', wackeln=1),
    dict(x=P(18, 15)[0], y=P(18, 15)[1], vx=2, vy=-12, off=40, form='o', wackeln=1),
    dict(x=P(6, 3)[0], y=P(6, 3)[1], vx=-2, vy=-5, off=32, form='o', wackeln=1),
    dict(x=P(13, 3)[0], y=P(13, 3)[1], vx=2, vy=-5, off=6, form='o', wackeln=1),
    dict(x=P(10, 21)[0], y=P(10, 21)[1], vx=0, vy=-11, off=44, form='o', wackeln=1),
    dict(x=P(3, 6)[0], y=P(3, 6)[1], vx=-3, vy=-8, off=12, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                       # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    hump = U.buckel(i, 0, 24, n=24)
    aus = 3.0 * hump
    bein = 1.6 * math.sin(L.sinus(i, 16))
    ph = L.sinus(i, 12)

    atem = U.stufe(i, N / 2, 1)                                  # Atmen: 0/1 px (Periode 24) — die einzige Gesamtbewegung, kein Schweben, kein Wallen
    kp = teil(kopf)
    rot = AUGE_GLUT.get(i)                                       # Augenhöhle (11–12, 4–5): tiefrote Füllung in drei kurzen Glühphasen
    if rot:
        for (x, y) in HOEHLE:
            kp[GPT + y, GPL + x, :3] = rot
            kp[GPT + y, GPL + x, 3] = 255
    rp = L.streck_zeile(teil(rumpf), GPT + 12, atem)             # Zeile y 12 wird eingefügt: Schultern/Kopf heben sich über Becken und Beine
    al, ar = teil(arm_l), teil(arm_r)
    al = L.spalten_welle(al, GPL + 4, 1.0 * hump, ph, lauf=1.0, nur_rechts=False)     # Unterarmwelle (Periode 12)
    ar = L.spalten_welle(ar, GPL + 15, 1.0 * hump, ph, lauf=1.0, nur_rechts=True)
    al = U.haengen(al, GPT + 9, -aus)
    ar = U.haengen(ar, GPT + 9, aus)
    bn = U.haengen(teil(beine), GPT + 15, bein)
    koerper = L.zusammen(H, W, [(bn, 0, 0), (rp, 0, 0), (al, 0, -atem), (ar, 0, -atem), (kp, 0, -atem)])
    koerper = U.kontur_schliessen(koerper, UMRISS, A_)             # Regel 16: Umriss an allen bewegten Kanten in jeder Pose geschlossen
    if nur == 'koerper':
        return koerper
    gelb = U.glut_ebene(H, W, i, N, PUFFS_GELB, STAUB)
    purpur = U.glut_ebene(H, W, i, N, PUFFS_PURPUR, PURPUR)
    return L.zusammen(H, W, [(purpur, 0, 0), (gelb, 0, 0), (koerper, 0, 0)])


# Zuschnitt auf die Figur (Nutzerwunsch): symmetrisch um die Ruhefigur, Effekte höchstens +2 px über den Körperrand hinaus
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=ROT_STUFEN, min_rand=1)
    L.speichern('cosmic-skeleton', 'Cosmic Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cosmic-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
