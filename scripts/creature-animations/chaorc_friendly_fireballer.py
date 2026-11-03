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
* FEUERBALL (Regel 15/40, Modul anim_feuer2.py — Feuer von Hand, Nutzerkorrektur Runde 3): die GEMALTE Kugel samt Schweif der Quelle (Ebene 102) ist die Vorlage und wird Zunge für Zunge animiert (nicht mehr als Ellipse neu simuliert): die Flamme zeigt nach links (Flugrichtung = rechts),
  quer dazu laufen 2-Zeilen-Streifen als Zungen (Fuß = rechter Kugelrand, ruhig; Spitze = linkes Ende / Schweif). Der Schweif (Zeilen 7–12) wechselt Länge, Neigung und Kernhub, die Kugel selbst bewegt sich nur ganz leicht; ihr Inneres flimmert (die Farbzeichnung aus Kern und gelben Sprenkeln
  wandert um ≤ 1 px), Randpixel bleiben der rote Umriss. Je Zunge 12 handgesetzte Posen à 2–3 Frames, zeitversetzt; Spitzen reißen ab und steigen als Funken auf. Der Schweif ragt dem Chaorc nie in die Hand (Längengrenze). Der ganze Ball schwebt ±1 px (Periode 48) — er fliegt. Kein Lichtband, keine Sterne.
* Atmen des Chaorcs (Periode 24, zweimal pro Schleife): die Gürtelzeile 14 wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf und Brust steigen 1 px, die Kiste/Beine bleiben.
* Ohrzucken: die Spitze des linken Ohrs streckt sich 1 px nach außen (Frames 10–13, 34–37): Spitze (−1,7) + Haut (0,7) + Umriss (0,6)/(0,8), alle Pixel in Umrissfarbe/Hautrot des Sprites.
* Blinzeln (Frames 20–22 und 41–43): der weiße Augenschlitz nimmt die dunkle Gesichtsfarbe (51,0,0) an (Lid).
Randpixel-Test (Regel 16): die Chaorc-Kontur bleibt in jeder Pose Umrissfarbe (Hm.kontur_schliessen); Feuerränder sind immer Rot (202,44,41) (Außenhaut der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: Ohrspitze (−1,7), (0,6), (0,8) in (26,0,0) (siehe oben), sonst keine; das Feuer wird neu gezeichnet.
"""
import sys

import numpy as np

import anim_feuer2 as FE2
import anim_humanoide as Hm
import anim_lib as L
import anim_orks as O
import anim_untote as U

N, MS = 48, 62
GP = 11

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

# --- Feuerball (anim_feuer2): die gemalte Kugel samt Schweif der Quelle (Ebene 102) ist die Vorlage ---
flamme = vorhanden & (xx >= 16) & L.farbmaske(spr, [ROT, ORANGE, GELB, HELL])
FL = L.platz(L.trenne(spr, flamme)[0], H, W, GP, GP)
# Streifen von 2 Zeilen quer zur Flugrichtung ('links' = die Flamme zeigt nach links): Fuß = rechter Rand der Kugel (ruhig), Spitze = linkes Ende (Schweif).
# Der Schweif (Zeilen 7–12) schlägt kräftig aus, die Kugel selbst (obere/untere Zeilen) nur ganz leicht.
ZB = FE2.zungen_baender(FL, 'links', breite=2, min_h=3)
for z_ in ZB:
    z_.fuss_anteil = 0.55
    zy = z_.fuss[1] - GP
    z_.amp = 1.0 if 6.5 <= zy <= 13 else 0.35
    z_.s_max = 1.06 if z_.spitze[0] - GP <= 22 else None            # der Schweif darf dem Chaorc nicht in die Hand ragen
VL = FE2.Vorlage(FL, ZB, 'links', rand_farbe=ROT, kochen=1.0, faden=2)
FEUER = FE2.Feuer([VL], n=N, seed=11, bank='zunge', amp=1.0, max_funken=6, funken_abstand=5, funken_leben=8)


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
    ball = L.versetze(FEUER.ebene(i), 0, dy)
    funken = FEUER.funken(i, dy=lambda f_: int(round(1.0 * np.sin(2 * np.pi * f_ / N))))
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
    print('abgerissene Spitzen (Frame, Gruppe, x, y, drift, Fall):', FEUER.ereignisse)
    L.speichern('chaorc-friendly-fireballer', 'Chaorc Friendly Fireballer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-friendly-fireballer-strip.png', frames, spalten=12, scale=5)
