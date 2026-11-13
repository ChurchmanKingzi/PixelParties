# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Heart Bow“ (Creature).

PICK: [["MotiveGrailWar", 667, 1]]
Quelle: src/spirit-of-the-heart-bow.png (26×27 px, 18 Farben) = Ebene 667 „Bow Spirit“, vollständig (Ebenen 672/674/252 zeigen dieselbe Figur in anderen Motiven). Gegen die Kartenkunst abgeglichen
(der Steinbrunnen ist Szene).

Was ist was (x/y im Sprite):
* Amor-Geist: kahler Kopf (x 10–16, y 4–9) mit schwarzer Sonnenbrille (y 7–9 → kein Blinzeln), einzelne graue Haarlocke obenauf (x 11–13, y 2–4), grauer Bart/Brusthaar (x 9–16, y 9–17, gewürfelt),
  schwarze Hose mit hellen Flicken (y 18–21), Füße (y 22–23).
* Zwei große rosa Engelsflügel: links x 0–4 (y 0–24), rechts x 19–25 (y 0–24), heller Kern, dunkler Umriss (116,33,116); die Innenseiten (rechts x 16–19, y 9–13) sitzen am Rücken.
* Herzbogen in der linken Hand (x 5–9): oberer Bogenarm y 4–13, Hand (x 5–8, y 14–17), unterer Bogenarm y 18–26 – kräftiges Pink; starr, geht mit der Hand.
* Rechter Arm (x 16–19, y 13–19) hängt.
Annahme: Die Figur schwebt (Amor mit Flügeln; in der Karte sind keine stehenden Füße am Boden zu sehen) → ruhiger Schwebeflug.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Flügelschlag (Periode 16, 3 Schläge je Schleife): jeder Flügel schlägt als Ganzes um sein Gelenk am Rücken (Spaltenversatz wächst vom Ansatz zur Spitze bis ±2 px, Ansatzspalten bleiben am Körper) –
  kein Knick, nichts wird gestreckt.
* Schweben: die ganze Figur (samt Bogen) hebt sich beim Abschlag 1 px und sinkt beim Aufschlag zurück (gleicher Takt, 4 Frames Nachlauf).
* Haarlocke wippt (Spitze 1 px nach links/rechts, Periode 24).
* Bart/Brust: ruhig (kein Strecken – die Würfelung würde leiden).
Keine Ergänzungen nötig (die innersten Flügelspalten bewegen sich nicht; alle Spalten bleiben in sich ganz). Kein Glanz, keine Partikel. Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_lib as L
import anim_n2 as N2

N, MS = 48, 70
FIG = N2.Figur('spirit-of-the-heart-bow', pad=(2, 2, 5, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

FL_L = FIG.op & (xx <= 4)
FL_R = FIG.op & (xx >= 20)
LOCKE = FIG.op & (yy <= 2) & (xx >= 10) & (xx <= 14)
KOERPER = FIG.op & ~FL_L & ~FL_R & ~LOCKE
VERSATZ = [0, 1, 1, 2, 2, 2]                                         # Spaltenversatz je Abstand vom Gelenk (Spitze = letzter Wert)


def fluegel(maske, gelenk, richtung, s):
    """Flügel als Ganzes um das Gelenk schwenken: Spalte im Abstand d bekommt round(s · VERSATZ[d] / 2) px (s = −2 … 2, positiv = abwärts)."""
    a = FIG.platz(maske)
    out = L.leer(H, W)
    for x in range(FIG.sw):
        if not maske[:, x].any():
            continue
        d = min(len(VERSATZ) - 1, abs(x - gelenk))
        dy = int(round(s * VERSATZ[d] / 2.0))
        X = x + FIG.pl
        col = a[:, X]
        ys = np.nonzero(col[:, 3])[0]
        out[ys + dy, X] = col[ys]
    return out


def frame(i, nur=None):
    s = 2.0 * math.sin(2 * math.pi * i / 16)
    ko = FIG.platz(KOERPER)
    lo = FIG.platz(LOCKE)
    lo = L.versetze(lo, N2.schwing(i, 24, 1), 0)
    fl = fluegel(FL_L, 5, -1, s)
    fr = fluegel(FL_R, 19, 1, s)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (ko, 0, 0), (lo, 0, 0)])
    hub = 1 if math.sin(2 * math.pi * (i - 4) / 16) > 0.35 else 0
    return L.versetze(fig, 0, -hub)


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Heart Bow')
