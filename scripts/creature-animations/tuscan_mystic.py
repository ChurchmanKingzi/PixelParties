# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Mystic“ (Creature) — die vermummte Gestalt im magentafarbenen Umhang mit schwarzem Gesicht, roten Augen und einem Totenschädel in der Hand.

Quelle: src/tuscan-mystic.png (25×24 px, 27 Farben).
PICK: [["MotiveGrailWar", 202, 1]]      (Ebene „Tuscan Mystic“, 78×74 px: sie enthält die Gestalt unten links (x 0–24, y 50–73) UND den cyanfarbenen Blitz rechts daneben (x ≥ 22, Farben (108,255,255)/(255,255,255)/(246,255,255));
      der Blitz ist ein Zauber-Effekt und wurde entfernt: aus den Randpixeln x ≥ 22 sind nur Blitzfarben gelöscht, schwarze Pixel (0,0,0) bei x ≥ 25 gehören zum Blitz und liegen außerhalb des Zuschnitts.
      Der automatische Treffer-Lauf (merged.json) fand keine Figur (nur den Schädel L184 aus MotiveJapan und andere Totenköpfe), weil die Ebene so groß wie die Karte ist; die Figur stammt direkt aus dem Dump.)
Abgleich mit der Kunst (data/card-art/native/Tuscan_Mystic.png, 76×51): Figur und Schädel dort bei (31,18)…; die zweite Ebene „Ebene #318“ (L201) ist nur ein verschwommener cyanfarbener Schein des Blitzes.
Quelle vollständig: ja (Kopf, Hände, Schädel, Umhang, Stiefel; nichts verdeckt außer dem entfernten Blitz).

Aufruf:   python3 tuscan_mystic.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-mystic.png + .json

Was im Sprite ist (x, y im 25×24-Sprite):
* KAPUZE (x 2–23, y 0–5): magentafarben (41,22,42)/(107,56,107)/(180,80,137) mit schwarzem Umriss (23,21,22); links und rechts je ein graues, hornartiges Kapuzenstück (124,112,112)/(161,147,144)/(91,82,83) (x 3–8 und 19–24, y 1–5).
* GESICHT (x 9–17, y 5–12): schwarze Leere (18,16,16)/(24,22,22)/(4,4,4)/(9,8,9); zwei rote AUGEN je ein Pixel: (236,29,28) bei (11,7) und (208,4,4) bei (15,7).
* SCHÄDEL (x 0–9, y 5–16) in braunem Rahmen (49,24,0): weiß (246,255,255)/(213,213,213)/(189,189,189)/(156,156,156) mit schwarzen Augenhöhlen/Nase/Zähnen (0,0,0); die LINKE HAND hält ihn von unten (orange (156,105,62)/(239,161,95)/(245,203,161), (8–9, 13–15)).
* RECHTE HAND/ÄRMEL (x 18–24, y 10–16): Ärmel magenta, Hand braun (156,105,62) bei (19–22, 12–13), graue Manschette.
* GRAUER BOGEN quer vor der Brust (x 12–19, y 13–17; (124,112,112)/(161,147,144)/(91,82,83)) — ich lese ihn als Sichel-/Kragenstück und lasse ihn fest.
* UMHANG (x 8–19, y 17–23): magenta mit rosa Falte (180,80,137), unten zwei graue Stiefel (124,112,112)/(189,189,189) bei (9–11, 22) und (16–18, 22) und der Saum (23,21,22).
Kein Metall/Gold/Edelstein sicher erkennbar (die grauen Teile könnten Eisen sein, sind aber nicht eindeutig) → KEIN Glanz (Regel 14, im Zweifel weglassen). Der Blitz fehlt bewusst. Keine Partikel.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos; Frame 0 = Original; Bodenwesen: die Stiefel bleiben am Boden):
* ATMEN (2× je Schleife): die Umhangzeile 19 wird einmal doppelt eingefügt (Texturmischung): Kapuze, Schädel, Hände und Brust steigen 1 px, Saum und Stiefel bleiben.
* SAUM WEHT: die Umhangzeilen 17–21 (x 8–19) pendeln waagerecht, je weiter unten, desto mehr (bis ±1 px), links und rechts gegenläufig; die Stiefel (y 22–23) stehen fest.
* SCHÄDEL WIPPT: der Schädel samt Hand sinkt zweimal je Schleife für je 3 Frames um 1 px und kommt zurück (die frei werdende Rahmenspalte (9,8–11) wird mit dem Umhangumriss (41,22,42) gefüllt).
* BLINZELN (Frames 20–22 und 40–42): die roten Augenpixel werden schwarz (24,22,22) und kommen zurück — kein Glühen, kein Farbspiel.
Fest: Gesicht, Hörner, Bogen, Ärmel, Stiefel. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: nur die Rahmenspalte (9,8–11) neben dem Schädel (Umhangumriss (41,22,42)), wenn der Schädel sinkt.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 2

spr = L.lade('tuscan-mystic')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = set(Hm.umrissfarben(spr))
UMHANG_UMRISS = f(9, 6)                                             # (41,22,42)
SCHWARZ_AUGE = f(10, 7)                                             # (24,22,22)
UMRISS = f(6, 0)                                                    # (23,21,22)
AUGEN = [(11, 7), (15, 7)]
skull = vorhanden & (xx <= 8) & (yy >= 5) & (yy <= 16)
for p in [(9, 8), (9, 9), (9, 10), (9, 11), (9, 14), (9, 15)]:
    skull[p[1], p[0]] = True
skull &= vorhanden
hem = vorhanden & (xx >= 8) & (xx <= 19) & (yy >= 17) & (yy <= 21)
koerper = vorhanden & ~skull & ~hem
LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))


def frame(i):
    b = Hm.stufe(i, N / 2, 1)
    k = R.teil(spr, koerper, H, W, OFF)
    sk = R.teil(spr, skull, H, W, OFF)
    sa = R.teil(spr, hem, H, W, OFF)
    # Blinzeln
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(k, {p: SCHWARZ_AUGE for p in AUGEN}, OFF)
    # Saum weht (links/rechts gegenläufig, Frame 0 neutral)
    w = math.sin(L.sinus(i, N / 2))
    left = R.zeilen_pendel(R.teil(spr, hem & (xx <= 13), H, W, OFF), PAD_T + 16, 1.4, L.sinus(i, N / 2), ruhe0=True, lauf=0.6)
    right = R.zeilen_pendel(R.teil(spr, hem & (xx >= 14), H, W, OFF), PAD_T + 16, -1.4, L.sinus(i, N / 2), ruhe0=True, lauf=0.6)
    # Schädel sinkt 1 px (zweimal je Schleife, je 3 Frames)
    sink = 1 if (Hm.folge(i, 10, [1, 1, 1], N) or Hm.folge(i, 34, [1, 1, 1], N)) else 0
    if sink:
        sk = L.versetze(sk, 0, 1)
        Hm.setze(k, {(9, y): UMHANG_UMRISS for y in (8, 9, 10, 11)}, OFF)
    if b:
        k, sk, left, right = (L.streck_zeile(e, PAD_T + 19, 1) for e in (k, sk, left, right))
    fig, etik = R.schichten(H, W, [(left, 'umhang'), (right, 'umhang'), (k, 'umhang'), (sk, 'schaedel')])
    fig, _br = R.verbinde(fig)
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT)
    R.kontur_je_teil(fig, etik, ERLAUBT, {'schaedel': f(0, 5), 'umhang': UMHANG_UMRISS}, standard=UMRISS)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('tuscan-mystic', 'Tuscan Mystic', frames, MS, spr, OFF, prev)
