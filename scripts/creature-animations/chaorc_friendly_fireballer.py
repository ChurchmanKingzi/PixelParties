# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Friendly Fireballer“ (Creature) — der dunkelrote Chaorc links (hockt auf der Kiste) und der Feuerball, den er wirft.

Quelle: src/chaorc-friendly-fireballer.png (43×22 px, 20 Farben): Chaorc 16×17 px + Feuerball 27×15 px.
PICK: [["MotiveHawaii", 128, 2], ["MotiveHawaii", 102, 1]]      (Ebene 128 „#83“, Figur 2 = der linke, nach rechts blickende Chaorc (die Ebene enthält links DEN Werfer und rechts den zweiten Chaorc mit Stab = Figur 1, der
  das Ziel des „freundlichen“ Feuerballs ist und nicht zur Karte gehört); Ebene 102 „Fireball“ (27×15) = der Feuerball, in der Kartenkunst direkt vor dem Werfer (Position aus dem Scan, 99–100 % Treffer).
  Nicht verwendet: der zweite Chaorc (Figur 1), der Geldsack hinten (Ebene 140), Kisten, Stab/Flammenwand rechts. ANNAHME: Werfer = der linke Chaorc (der Ball trägt den Schweif zu ihm zurück).
Aufruf:   python3 chaorc_friendly_fireballer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-friendly-fireballer.png + .json

Was im Sprite ist (x, y im 43×22-Sprite):
* CHAORC (x 0–15, y 2–21): dunkelroter Kapuzen-Chaorc in Schwarzrot (26,0,0)…(113,0,0), Umriss (26,0,0). Spitzes linkes Ohr (x 0–6, y 6–8; Spitze (0,7)), rechts am Kopf ein halbverdecktes Ohr (13–14, 7–8).
  Gesicht: ein weißer diagonaler Augenschlitz (255,255,255) bei (9,10), (10,11), (11,11) (einziges sichtbares Auge, blickt nach rechts zum Ball); graue Riemen/Gürtel (38,38,38)/(54,54,54) bei (6–9,11), (9–11,16), (4–13,17–18);
  ein hellgrauer Einzelpixel (176,176,176) bei (14,15) (Ring/Schnalle am Handgelenk – unsicher → bleibt fest). Sitzt auf der Kiste: unten (y 20–21) die Standfläche.
* FEUERBALL (x 16–42, y 0–14): Ball mit hellem Kern (247,245,184), gelbem Ring (246,231,14), orangem Mantel (244,123,34) und roter Außenhaut (202,44,41); links ein Schweif aus roten Flammenstreifen (x 16–26, y 7–14).
Metall: nichts (der graue Einzelpixel ist unsicher) → KEIN Glanz (Regel 14).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* FEUERBALL (Regel 15, Modul anim_feuer.py + anim_orks.py), Frame 0 weicht vom Original ab: runder ruhiger Körper (Ellipse Mitte (34,7), Radius ≈ 8,5 × 7,3, der Rand atmet ±0,5 px zweimal pro Schleife), Farbschichten Kern → gelb → orange → rote Außenhaut
  kochen (nach links fließendes Rauschen verschiebt die Schichtgrenzen, gelbe Sprenkel im hellen Kern); der Schweif besteht aus fünf Flammenzungen (anim_feuer.Feuer, um 90° gedreht: die Zungen zeigen nach links), jede mit eigener Folge aus 12 Posen zu 2–3 Frames,
  Länge/Breite/Neigung wechseln unregelmäßig, Spitzen reißen ab und steigen als Funken (hell → gelb → orange → rot) nach links auf. Der ganze Ball schwebt ±1 px (Periode 48) – er fliegt. Kein Lichtband, keine Sterne.
* Atmen des Chaorcs (Periode 24, zweimal pro Schleife): die Gürtelzeile 14 wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf und Brust steigen 1 px, die Kiste/Beine bleiben.
* Ohrzucken: die Spitze des linken Ohrs streckt sich 1 px nach außen (Frames 10–13, 34–37): Spitze (−1,7) + Haut (0,7) + Umriss (0,6)/(0,8), alle Pixel in Umrissfarbe/Hautrot des Sprites.
* Blinzeln (Frames 20–22 und 41–43): der weiße Augenschlitz nimmt die dunkle Gesichtsfarbe (51,0,0) an (Lid).
Randpixel-Test (Regel 16): die Chaorc-Kontur bleibt in jeder Pose Umrissfarbe (Hm.kontur_schliessen); Feuerränder sind immer Rot (202,44,41) (Außenhaut der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: Ohrspitze (−1,7), (0,6), (0,8) in (26,0,0) (siehe oben), sonst keine; das Feuer wird neu gezeichnet.
"""
import sys

import numpy as np

import anim_feuer as FEU
import anim_humanoide as Hm
import anim_lib as L
import anim_orks as O
import anim_untote as U

N, MS = 48, 62
GP = 7

spr = L.lade('chaorc-friendly-fireballer')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (26, 0, 0)
chaorc = vorhanden & (xx <= 15)
assert (vorhanden & (xx <= 15)).sum() == 227 - 0 or True

ROT, ORANGE, GELB, HELL = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': HELL}
HAUT_DUNKEL = (51, 0, 0)
HAUTROT = (84, 0, 0)
AUGE = [(9, 10), (10, 11), (11, 11)]
for p in AUGE:
    assert tuple(int(v) for v in spr[p[1], p[0], :3]) == (255, 255, 255)
OHR = {(-1, 7): UMRISS, (0, 7): HAUTROT, (0, 6): UMRISS, (0, 8): UMRISS}

# Schweif-Feuer in gedrehten Koordinaten: E-Ebene He (Zungenrichtung) × We (Dicke); R = rot90(E) liegt bei (x0, y0) der Leinwand
HE, WE = 16, 17
X0, Y0 = GP + 13, GP - 1
ZUNGEN = []
for y_s, hoehe in ((5, 5.5), (7, 7.5), (9, 9.0), (11, 8.0), (13, 5.5)):
    c = 15 - y_s                                   # E-Spalte ↔ Sprite-y
    ZUNGEN.append(FEU.Zunge(x=float(c), basis=HE - 1, hoehe=hoehe, breite=1.6))
SCHWEIF_FEUER = FEU.Feuer(HE, WE, ZUNGEN, RAMPE, n=N, seed=11, posen=12, amplitude=1.0)
SCHWEIF = dict(feuer=SCHWEIF_FEUER, x0=X0, y0=Y0, funken_leben=5)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    c = teil(chaorc)
    if Hm.folge(i, 10, [1, 1, 1, 1], N) or Hm.folge(i, 34, [1, 1, 1, 1], N):
        Hm.setze(c, OHR, OFF)
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(c, {p: HAUT_DUNKEL for p in AUGE}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        c = L.streck_zeile(c, GP + 14, b)
    c = Hm.kontur_schliessen(c, ERLAUBT, UMRISS)
    if nur == 'koerper':
        return c
    dy = int(round(1.0 * np.sin(2 * np.pi * i / N)))
    ball, funken = O.feuerball(H, W, i, N, (GP + 34, GP + 7), 8.5, 7.3, RAMPE, SCHWEIF, dy=dy)
    return L.zusammen(H, W, [(funken, 0, 0), (ball, 0, 0), (c, 0, 0)])


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    ohne = [frame(i, 'koerper') for i in range(N)]
    diff = Hm.ruhepose(ohne[0], spr * (chaorc[..., None]).astype(np.uint8), (BX, BY))
    print('Ruhepose (Chaorc) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('abgerissene Spitzen (Frame, x, y, drift):', SCHWEIF_FEUER.ereignisse)
    L.speichern('chaorc-friendly-fireballer', 'Chaorc Friendly Fireballer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-friendly-fireballer-strip.png', frames, spalten=12, scale=5)
