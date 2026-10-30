# -*- coding: utf-8 -*-
"""Idle-Animation für „Cheering Rabbit“ (Creature).

Quelle: src/cheering-rabbit.png — der linke von drei Jubel-Hasen (30×24 px, 28 Farben) aus MotiveMoe.xcf, Ebene 447 „Cheering Rabbit“ (72×27 px; die Ebene zeigt drei Hasen nebeneinander, wie
auf der Karte). Die drei Exemplare sind zusammengebacken (die Pompons zwischen ihnen überlappen sich); ich habe den linken ausgeschnitten, die wenigen Pixel der mittleren Figur (Ohr-/Körperumriss
bei x ≥ 27) entfernt und den Pompon rechts von ihm (x 22–29), den er mit dem Nachbarn teilt, behalten. Linker und rechter Hase der Ebene sind gleich gezeichnet; der mittlere ist eine tiefere
Pose desselben Hasen (nicht verwendet).
PICK: [["MotiveMoe", 447, 1]]   (Figur = linker Hase der Ebene, bbox (0,0)–(29,23))

Aufruf:   python3 cheering_rabbit.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cheering-rabbit.png + .json

Identifikation (Sprite 30×24, lavendelweißer Hase von vorn in Cheerleader-Kleid, mit zwei cyanfarbenen Pompons, Stil wie der Cute Bunny):
* Ohren (Zeilen 0–4, links x 5–11, rechts x 14–22): lange Schlappohren mit braunem Umriss A (49,24,0) und lavendelweißer Fläche B (210,210,248) / J, nach außen hängend.
* Gesicht (x 9–18, Zeilen 4–11): lavendelweiß mit schwarzen Zeichnungspixeln (K) für die geschlossenen, lachenden Augen, rosa Wangenpunkten (10,9) (17,9), rosa/lila offenem Mund U (217,0,255) (13–14,11).
* Körper (x 8–20, Zeilen 11–23): Kleid in Lila/Rosa/Blau (H, N, P, Q, L, I, M …), Füße unten lavendelweiß (9–11, 22) (15–18, 22).
* Arme (lavendelweiß B/D): links (6–8, 12–14), rechts (19–21, 12–14), jeweils am Pompon: links ein Pompon (x 0–7, Zeilen 7–14), rechts ein größerer Pompon (x 22–29, Zeilen 7–17) in Cyan F (0,217,255) /
  Türkis G (0,96,134) / I mit dunkelblauem Umriss C (0,0,38).
* Kein Glanz (Stoff/Fell, Regel 14); die Pompons sind Stoff, kein Metall — kein Lichtband/Stern. Keine Partikel.
Bleibt fest: Gesicht (bis auf die Hüpfbewegung), Kleid, Füße.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Hüpfen (Periode 12, 4× pro Schleife): der ganze Hase springt 2 px hoch (Pattern 0-1-2-2-1-0) und landet wieder; die Füße verlassen den Boden.
* Pompon-Wippen: beide Arme samt Pompon (links x ≤ 8, rechts x ≥ 19, Zeilen 7–18) wandern im Gegentakt bis ±2 px auf und ab (Periode 12, rechts gegenläufig) — der Hase jubelt.
* Ohrenwippen: die Ohrspitzen (Spalten außen, Zeilen 0–4) heben/senken sich bis ±1 px (Periode 24, 2 Wellen pro Schleife); der Ohransatz bleibt.
* Randpixel-Korrektur (Regel 16): wo ein Arm samt Pompon vom Rumpf wegrückt, entsteht eine Lücke; dort wird ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16, siehe oben); sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2

spr = L.lade('cheering-rabbit')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

einheit_l = vorhanden & (yy >= 7) & (yy <= 16) & ((xx <= 7) | ((xx == 8) & (yy >= 13) & (yy <= 14)))
einheit_r = vorhanden & (yy >= 7) & (yy <= 18) & ((xx >= 20) | ((xx == 19) & (yy >= 13) & (yy <= 14)))
ohr_l = vorhanden & (yy <= 4) & (xx <= 9)
ohr_r = vorhanden & (yy <= 4) & (xx >= 17)
rest = vorhanden & ~einheit_l & ~einheit_r & ~ohr_l & ~ohr_r
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
HOPS = (0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0)                        # Hüpfhöhe je Frame der Periode 12


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    hop = HOPS[i % 12]
    arm = int(round(2.0 * math.sin(2 * math.pi * i / 12.0)))
    return hop, arm, i


def ohr_wippen(t, pivot, i, seite):
    """Ohrspalten wandern senkrecht um round(1,4 · f · sin(φ − 0,4 f)), f = Abstand vom Ansatz / größter Abstand (Spitze am meisten, Frame 0 = Original)."""
    out = L.leer(H, W)
    ph = 2 * math.pi * i / 24.0 + 0.2 + (math.pi if seite < 0 else 0.0)
    xs_all = [x for x in range(W) if t[:, x, 3].any()]
    maxd = max(abs(x - pivot) for x in xs_all)
    for x in xs_all:
        f = abs(x - pivot) / float(maxd)
        dy = int(round(1.4 * f * math.sin(ph - 0.4 * f)))
        ys_ = np.nonzero(t[:, x, 3])[0]
        for y in ys_:
            out[y + dy, x] = t[y, x]
    return out


def frame(i, nur=None):
    hop, arm, _ = zustand(i)
    ebenen = {
        'rest': teil(rest),
        'ohr_l': ohr_wippen(teil(ohr_l), PAD_L + 10, i, -1),
        'ohr_r': ohr_wippen(teil(ohr_r), PAD_L + 16, i, 1),
        'arm_l': L.versetze(teil(einheit_l), 0, arm),
        'arm_r': L.versetze(teil(einheit_r), 0, -arm),
    }
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, -hop) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cheering-rabbit', 'Cheering Rabbit', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cheering-rabbit-strip.png', frames, spalten=12, scale=6)
