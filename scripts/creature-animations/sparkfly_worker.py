# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparkfly Worker“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveRussia", 165, 3], ["MotiveRussia", 165, 1], ["MotiveRussia", 167, 1]] + Körper aus der Kartenkunst (siehe unten)
Eigenes Sprite (creature_show.py findet nur Beutel/Teile): Die Karte zeigt vier gleiche Fliegen (je 17×22 px, aus mehreren Ebenen von MotiveRussia.xcf zusammengesetzt, die Flügel
durchscheinend über der Wabe). Ich habe die obere linke Fliege gewählt (vollständig sichtbar, Komponente der Karte x 18–34, y 3–24) und so gebaut:
  * Flügel: die zwei sauberen Blattflügel aus Ebene 165 (Figur 3 links, Figur 1 rechts; je 9×13 px, 80 Pixel, Farben (58,56,6)/(147,151,11)/(160,160,21)) an ihrer Kartenposition
    (Abgleich der Silhouette mit der Fliege der Karte; die Flügel der Karte sind durch die Wabe getönt, die Ebenenfarben sind die sauberen).
  * Beutel: Ebene 167, Figur 1 (10×8, 42 Pixel), exakt an Kartenposition (22,18) (Farbabweichung ~9, also exakt bis auf das Rauschen der Kunst).
  * Körper (Kopf/Brust mit grünen Augen, Beine): aus den Pixeln der Karte (Silhouette per Abstand zur Wabenfarbe), jede Farbe auf die nächste Farbe der Körperebenen
    (Ebene 155/177: (42,27,14)/(17,11,5)/(51,33,16)/…, Augen (140,159,0)/(166,181,59)) eingerastet — keine Farbe erfunden, keine Rauschpixel.
  src/sparkfly-worker.png            das fertige Sprite (17×22 px, 19 Farben) = alle Teile übereinander
  src/sparkfly-worker-fluegel-l / -r  die Blattflügel (hinter dem Körper)
  src/sparkfly-worker-koerper         Kopf und Brust mit Augen
  src/sparkfly-worker-beutel          Beine und Beutel (hängen am Körper)

Aufruf:   python3 sparkfly_worker.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparkfly-worker.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Flügel: links x 0–8, y 0–12 (Blatt, Spitze oben links), rechts x 8–16, y 1–13 (Blatt, Spitze oben rechts); Rand (58,56,6), Füllung (147,151,11)/(160,160,21).
* Körper: Kopf und Brust (x 6–14, y 5–13), dunkelbraun (17,11,5)/(42,27,14)/(51,33,16); zwei Augen grün (140,159,0) mit hellem Glanzpixel (166,181,59) bei (11,8–9) und (13,8–9).
* Beine: fünf kurze Striche (x 3–11, y 14–15); Beutel (x 5–12, y 15–21) hängt darunter, braun (85,46,11)/(105,63,25), Rand (33,20,7), zwei graue Schnallen (83,81,79).
* Die Flügel der Karte sind weich durchscheinend; hier deckend (wie bei den Bomblebees und dem Sparkfly Architect).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: achtmal pro Schleife (Periode 6): jedes Blatt dreht sich als Ganzes um seine Wurzel (links (6,12), rechts (9,13)), die Spitze beschreibt einen großen Bogen:
  Aufschlag bis fast senkrecht (+35°), Abschlag bis unter die Waagerechte (−70°), Abschlag schneller als Aufschlag, Ruhepose (Frame 0) = Original. Drehung per Rückrechnung
  (Nächster-Nachbar, keine Mischfarben, Alpha 0/255, Kanten geglättet), die Blätter bleiben vollständig und liegen hinter dem Körper. Beide Flügel schlagen gleichzeitig (gespiegelt).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12); der Beutel schwingt mit Verzögerung: Beine und Beutel pendeln unterhalb des Körpers bis 2 px
  (F.zeilen_pendel, Aufhängung fest).
* Blinzeln (Frames 33–34): die Augen schließen sich — Lid in Körperfarbe (42,27,14), die Augenpixel werden zu Körper.
* Kein Glanz, keine Partikel (Fell/Stoff/Chitin glänzen nicht; es gibt kein Feuer oder Staub).

Ergänzungen: keine nötig — die Flügel liegen vollständig hinter dem Körper (die ganzen Blätter sind in der Ebene vorhanden), nichts Verdecktes fehlt.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 1 px freier Rand), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Die Drehung kann Innenfarbe an die Kanten legen → F.umranden setzt den Flügelrand (58,56,6); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('sparkfly-worker')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R


def teil(name):
    return L.platz(L.lade('sparkfly-worker-' + name), H, W, PAD_L, PAD_T)


P_WL, P_WR, P_KP, P_BEUTEL = teil('fluegel-l'), teil('fluegel-r'), teil('koerper'), teil('beutel')
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_KP, P_BEUTEL)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

KOERPER = (42, 27, 14)
AUGEN = [(11, 8), (13, 8), (11, 9), (13, 9)]
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (58, 56, 6)
BEUTELRAND = (33, 20, 7)
THETA_C, THETA_A = math.radians(-17.5), math.radians(52.5)    # Drehwinkel −70° … +35° (Ruhe 0°)
THETA_P0 = math.asin(-THETA_C / THETA_A)
Y_AUFH = PAD_T + 13                                          # Körperunterkante: darunter hängen Beine und Beutel


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    wl, wr, kp, bt = P_WL.copy(), P_WR.copy(), P_KP.copy(), P_BEUTEL.copy()
    if i in (33, 34):                                          # Blinzeln: Lid = Körperfarbe
        F.setze(kp, PAD_L, PAD_T, {p: KOERPER for p in AUGEN})

    # Flügelschlag: jedes Blatt dreht sich um seine Wurzel (Spitze beschreibt einen Bogen): Aufschlag fast senkrecht, Abschlag bis unter die Waagerechte
    ph2 = ph + 0.4 * math.sin(ph)                              # Abschlag schneller als Aufschlag
    theta = THETA_C + THETA_A * math.sin(ph2 + THETA_P0)       # links: im Uhrzeigersinn (+) = Spitze richtet sich auf; Ruhe (Frame 0) = 0
    wl = F.drehen(wl, PAD_L + 6.5, PAD_T + 12, theta, glatt=True)
    wr = F.drehen(wr, PAD_L + 9.5, PAD_T + 13, -theta, glatt=True)
    # Beine und Beutel pendeln an der Aufhängung
    bt = F.zeilen_pendel(bt, Y_AUFH, 2.2, L.sinus(i, N / 2) , 1.0, lauf=0.5)

    wl, wr, kp, bt = (L.versetze(a, 0, bob) for a in (wl, wr, kp, bt))
    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0), (bt, 0, 0)])
    F.umranden(f, [wl, wr], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)       # Randpixel-Test (Regel 16)
    F.umranden(f, [bt], UMRISS, BEUTELRAND, BEUTELRAND, BEUTELRAND)
    return f


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 1 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 1, ey0 - 1, ex1 + 1, ey1 + 1
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=[(33, 30, 5)], min_rand=1)      # (33,30,5): dunkler Flügelrand aus Ebene 165, im Ruhebild vom Körper verdeckt
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-worker', 'Sparkfly Worker', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-worker-strip.png', frames, spalten=8, scale=6)
