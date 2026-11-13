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
* Flügelschlag (Runde 8: „mehr mit den Flügeln schlagen, damit es wirklich nach Fliegen aussieht“; Periode 12, 4 Schläge je Schleife): jeder Flügel schwingt als GANZES um sein Gelenk am Rücken
  auf und zu (kleine Drehung −0,08 … +0,32 rad als Doppel-Scherung aus anim_r5_fluegel: nur ganze Zeilen-/Spaltenverschiebungen, nichts wird gestreckt, kein Knick): die Flügelspitzen oben schwenken
  bis 4 px nach außen/unten und wieder zum Kopf hin, die unteren Federn gegenläufig hinter den Körper. Der Umriss wird nach dem Schwenk an den Treppenstufen neu geschlossen (1 px, Umrissfarbe der Quelle).
  Der rechte Flügel ist jetzt vollständig beweglich (alle rosa Pixel ab x 16 außer dem Arm); eine ruhende Kopie seiner Innenseite liegt dahinter, damit am Rücken nie Hintergrund durchscheint.
* Schweben: die ganze Figur (samt Bogen) steigt während des Abschlags 2 px und sinkt beim Aufschlag zurück (gleicher Takt, weich über 0/1/2 px).
* Haarlocke wippt (Spitze 1 px nach links/rechts, Periode 24).
* Bart/Brust: ruhig (kein Strecken – die Würfelung würde leiden).
ERGÄNZUNG: (4, 4–12) Umrissfarbe (116,33,116) hinter dem linken Flügel = linker Rand der Bogenspitze/Schulter, sichtbar, wenn der Flügel aufschwingt (sonst schiene dort Hintergrund durch). Hinter dem rechten Flügel liegt seine ruhende Innenseite. Kein Glanz, keine Partikel. Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_lib as L
import anim_n2 as N2
import anim_r5_fluegel as R5

N, MS = 48, 70
FIG = N2.Figur('spirit-of-the-heart-bow', pad=(5, 5, 5, 4))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

ROSA = FIG.farbe((116, 33, 116), (188, 54, 189), (254, 192, 255), (147, 42, 147), (254, 73, 255), (254, 121, 255))
UMRISS = ROSA[0]
FL_L = FIG.op & (xx <= 4)
FL_R = FIG.maske(ROSA) & (xx >= 16)
LOCKE = FIG.op & (yy <= 2) & (xx >= 10) & (xx <= 14)
KOERPER = FIG.op & ~FL_L & ~FL_R & ~LOCKE
INNEN_R = FL_R & (xx <= 19)                                          # ruhende Kopie der Flügelinnenseite (liegt hinter dem beweglichen Flügel)
GEL_L = (FIG.pl + 5.0, FIG.pt + 13.0)                                # Gelenke (Leinwand): linker Flügel hinter Bogen/Schulter, rechter an der Innenseite am Rücken
GEL_R = (FIG.pl + 19.0, FIG.pt + 12.0)
PHI = math.asin(0.6)


def winkel(i):
    """Öffnungswinkel des rechten Flügels (links gespiegelt): 0 in Frame 0, −0,08 (zu) … +0,32 (offen)."""
    return 0.12 + 0.2 * math.sin(2 * math.pi * i / 12.0 - PHI)


def frame(i, nur=None):
    w = winkel(i)
    ko = FIG.platz(KOERPER)
    lo = FIG.platz(LOCKE)
    lo = L.versetze(lo, N2.schwing(i, 24, 1), 0)
    rand_l = N2.setze(L.leer(H, W), OFF, {(4, y): UMRISS for y in range(4, 13)}, neu=True)       # Ergänzung: linker Umriss der Bogenspitze, frei sobald der Flügel aufschwingt
    vorn = L.zusammen(H, W, [(FIG.platz(INNEN_R), 0, 0), (rand_l, 0, 0), (ko, 0, 0)])
    vm = vorn[..., 3] > 0
    fl = R5.umriss_ziehen(R5.scher_drehung(FIG.platz(FL_L), GEL_L[0], GEL_L[1], -w), vm, UMRISS)
    fr = R5.umriss_ziehen(R5.scher_drehung(FIG.platz(FL_R), GEL_R[0], GEL_R[1], w), vm, UMRISS)
    if nur == 'fluegel':
        return L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0)])
    fig = L.zusammen(H, W, [(rand_l, 0, 0), (fl, 0, 0), (FIG.platz(INNEN_R), 0, 0), (fr, 0, 0), (ko, 0, 0), (lo, 0, 0)])
    hub = lambda k: int(round(1.0 - math.cos(2 * math.pi * (k - 4) / 12.0)))      # 0 … 2, höchster Punkt am Ende des Abschlags
    return L.versetze(fig, 0, hub(0) - hub(i))


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Heart Bow')
