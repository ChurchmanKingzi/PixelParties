# -*- coding: utf-8 -*-
"""Idle-Animation für „Ghoul Guard“ (Creature) — bleicher Ghul mit glatter Glatze und roten Augen in schwarzer Kluft mit goldener Gürtelschnalle.

Quelle: src/ghoul-guard.png (18×23 px, 23 Farben) — Ebene „Ghoul #1“ (MotiveDeepsea.xcf, Ebene 67), Figur 1; stimmt mit der Kartenkunst Ghoul_Guard.png (Sprite bei x 15–32) zu 100 % überein.
PICK: [["MotiveDeepsea", 67, 1]]
Die Quelle ist vollständig (alles deckend). Der Rest der Kartenkunst (Pflaster mit den vier farbigen Rüstungshelmen = andere Kreaturen/Kulisse, tote Bäume) gehört nicht zur Figur.

Aufruf:   python3 ghoul_guard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ghoul-guard.png + .json

Was ist was (x, y im Sprite):
* KOPF (x 3–13, y 0–9): glatte weiße Glatze (228,228,228)/(238,238,238)/(247,247,247) mit schwarzem Umriss (24,24,24); braune Pixel (49,24,0) an den Kopfseiten bei (2,5), (2,6), (3,7), (13,5), (13,6), (12,7) (Ohren/Haarfransen — bleiben fest).
* AUGEN (y 5–7): schwarze Höhlen/Brauen (0,0,0) bei (4–6, 5–6) und (9–11, 5–6); linkes Auge: rosa Lichtpunkt (255,150,150) (5,6), weiß (246,255,255) (5,7), rote Pupille (255,0,0) (6,7);
  rechtes Auge: dunkelrot (153,0,0) (10,6), rote Pupille (255,0,0) (10,7), weiß (9,7). Nase/Mund: nichts gezeichnet, nur der Kiefer/Kinn (y 8–9, hell).
* RUMPF (y 10–17): schwarzer Kittel mit Grautönen (32…156), graue Schulterstücke (123,123,123) bei (1,11)/(14,11); Gürtel y 14 mit rotbrauner Kante (106,32,0)/(123,41,16) und goldener SCHNALLE (255,205,49)/(255,180,24) bei (7,14)–(8,14);
  Beine y 17–22 (zwei Beine x 3–7 und 10–13, Lücke dazwischen), schwarze Stiefel.
* ARME: links hängt der Arm (x 0–3, y 10–14) und die Hand (x 0–3, y 15–16: hell (217,217,217)/(228,228,228) mit braunen Fingerrändern (49,24,0)); rechts hält die Hand (x 15–17, y 10–13) etwas Braunes (49,24,0) senkrecht
  (Stab/Schaft, nur das Stück im Sprite) — die rechte Hand bleibt fest (hält fest, Regel 28), steigt nur mit der Brust.
Metall/Gold: die goldene Schnalle (Gold = Metall → Glanz erlaubt, Regel 12/14). Sonst Haut/Stoff/Knochen: kein Glanz. Kein Feuer.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, 0 → 1 → 2 → 1 → 0 px): die Brustzeile y 13 wird 0–2× eingefügt (Texturmischung mit der Nachbarzeile); Schultern, Hals, Kopf, Arme steigen, Gürtel, Beine und Stiefel bleiben am Boden.
* LINKE HAND schlenkert (Pendel ±1 px waagerecht, Periode 28); sie hängt am Unterarm (y 14) und bleibt über ≥ 2 Pixel angeschlossen.
* AUGEN blinzeln (Frames 17–19 und 40–42): die Augenpixel (rosa, weiß, rot, dunkelrot) nehmen die Farbe der Augenhöhle (0,0,0) an.
* SCHNALLE: goldener Glanz (die zwei Schnallenpixel tauschen eine Stufe heller/dunkler: (255,180,24) ↔ (255,205,49)) in Frames 4–8 und 28–32 und ein Glitzerstern (weiß/hellgelb, 1 → 2 → 2 → 1) in Frames 6–9 und 30–33 an der Schnalle.
Kein Kopfneigen, keine seitliche Verlagerung (Regel 17), Füße bleiben am Boden (Regel 18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('ghoul-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (24, 24, 24)
AUGEN = [(5, 6), (5, 7), (6, 7), (10, 6), (9, 7), (10, 7)]
assert [col(x, y) for (x, y) in AUGEN] == [(255, 150, 150), (246, 255, 255), (255, 0, 0), (153, 0, 0), (246, 255, 255), (255, 0, 0)]
LID = (0, 0, 0)
SCHNALLE = [(7, 14), (8, 14)]
assert [col(x, y) for (x, y) in SCHNALLE] == [(255, 205, 49), (255, 180, 24)]
HELL, DUNKEL = (255, 205, 49), (255, 180, 24)

hand_l = vorhanden & (xx <= 3) & (yy >= 15)
rest = vorhanden & ~hand_l
TEST_EBENEN = 'koerper'


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def pendel(i, per, ph=0.0):
    return int(round(1.0 * (math.sin(2 * math.pi * i / per + ph) - math.sin(ph))))


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = teil(rest)
    if V.fenster(i, N, 17, 3) or V.fenster(i, N, 40, 3):                     # Blinzeln
        V.setze(k, {p: LID for p in AUGEN}, OFF)
    g = V.folge(i, N, 4, [1, 1, 2, 2, 1]) or V.folge(i, N, 28, [1, 1, 2, 2, 1]) or 0            # Schnalle glänzt (eine Stufe)
    if g == 1:
        V.setze(k, {SCHNALLE[1]: HELL}, OFF)
    elif g == 2:
        V.setze(k, {SCHNALLE[0]: DUNKEL, SCHNALLE[1]: HELL}, OFF)
    kb = L.streck_zeile(k, OFF[1] + 13, n)
    f = L.zusammen(H, W, [(kb, 0, 0), (teil(hand_l), pendel(i, 28), 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur is None:
        st = V.folge(i, N, 6, [1, 2, 2, 1]) or V.folge(i, N, 30, [1, 2, 2, 1])
        if st:
            V.stern(f, 8, 14, st, (246, 255, 255), (255, 205, 49), OFF)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('ghoul-guard', 'Ghoul Guard', frames, MS, prev)
    if prev:
        L.streifen(prev + '/ghoul-guard-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=10)
