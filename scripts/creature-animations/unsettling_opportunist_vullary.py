# -*- coding: utf-8 -*-
"""Idle-Animation für „Unsettling Opportunist Vullary“ (Creature).

PICK: [["MotiveRussia", 215, 1]]
Quelle: src/unsettling-opportunist-vullary.png (20×31 px, 31 Farben) = Ebene 215 („MARY“ benannt, zeigt aber den Geier der Karte), vollständig; Ebene 101 enthält dieselbe Figur und eine Variante mit
nach rechts gedrehtem Kopf und offenem Schnabel (nicht verwendet: Köpfe drehen sich nicht seitlich). Gegen die Kartenkunst abgeglichen; Tannen und Schnee sind Szene.

Was ist was (x/y im Sprite):
* Geier, in der Quelle stehend mit angelegten Flügeln: dunkelviolette Flügel links und rechts (x 0–5 und 14–19, y 3–23) mit rosa Krallen an den Flügelenden (x 2–4 bzw. 15–17, y 20–21).
* Kahler rosa Kopf (x 5–14, y 3–14) mit Schopffedern (y 0–3, dunkel), schwarzen Brauen, Augen (hellrosa/weiß (6, 8) und (13, 8), gelbe Iris (6, 9) und (12, 9), rot daneben (7, 9), (13, 9)),
  orangefarbenem Hakenschnabel (x 9–10, y 11–14), darunter rosa Hals (x 9–10, y 15–17).
* Weißlich-rosa Halskrause (x 6–13, y 15–18), dunkler olivgrauer Rumpf (x 3–16, y 15–27), dunkelrote Krallenfüße (y 26–30).

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos). Runde 8 („sollte mit ihren Geierflügeln fliegen“): Die Figur FLIEGT – Frame 0 weicht deshalb vom Original (angelegte Flügel) ab.
* Flügel: In keiner Ebene gibt es ausgebreitete Flügel (MotiveRussia 101/215 zeigen nur die angelegten) → ein ausgebreiteter Flügel ist von Hand gezeichnet (FLUEGEL_POSE, 16×9 px, Farben und
  senkrechte Federstreifen der Quellflügel: heller Armrand oben, darunter Federn mit dunklen Trennlinien, gezackte Hinterkante, rosa Kralle am Flügelbug wie in der Quelle; an den Treppenstufen des Schwenks wird der 1-px-Umriss neu geschlossen), rechts gespiegelt.
  Schlag (Periode 12 Frames, 5 Schläge je Schleife): der GANZE Flügel schwenkt um das Schultergelenk hinter dem Rumpf (Spaltenversatz wächst linear vom Gelenk zur Spitze, Spitze −6 … +5 px;
  Spalten bleiben in sich ganz, nichts wird gestreckt, kein Knick).
* Der ganze Sprite steigt beim Abschlag und sinkt beim Aufschlag (±2 px, tiefster Punkt kurz nach Beginn des Abschlags, höchster kurz nach seinem Ende). Kein Atem-Strecken mehr (die Figur steht nicht).
* Lauern: Der Kopf reckt sich als starre Einheit (Kopf, Schopf, Schnabel) 1 px aus der Halskrause (Frames 18–37) und sinkt zurück; nie seitlich. Der Hals wird dabei um eine Zeile sichtbar
  (Fortsetzung der Halspixel), die Flügelkante neben dem Kopf wird fortgesetzt.
* Krächzen bei gerecktem Kopf (Frames 24–26 und 30–32): der Schnabel öffnet sich (dunkler Spalt zwischen Ober- und Unterschnabel).
* Blinzeln beider Augen (Frames 8–10 und 46–48): Auge → Rosa der Kopfhaut.
* Schopffedern zucken (Frames 40–43 und 54–56): die Federspitzen (y 0–1) kippen 1 px nach rechts.
ERGÄNZUNGEN: Rumpfseiten, die in der Quelle hinter den angelegten Flügeln/Krallen lagen (Zeilen 19–23, x 3–5 und 14–16): Umrissschwarz und die beiden Rumpffarben, links/rechts spiegelgleich.
Wo der gereckte Kopf unten eine Zelle freigibt und darunter Flügel oder Hals liegt, wird diese Zelle mit dem Pixel darunter fortgesetzt (Hals (9, 14) und (10, 14); Flügelkante an x 5 und 14).
Keine Partikel, kein Glanz (nichts Metallisches). Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_lib as L
import anim_n2 as N2

N, MS = 60, 75
PL, PR, PT, PB = 13, 13, 9, 5
FIG = N2.Figur('unsettling-opportunist-vullary', pad=(PL, PR, PT, PB))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

FL_FARBEN = [(32, 22, 37), (63, 54, 66), (13, 0, 0), (50, 41, 53), (25, 15, 30), FIG.f(1, 21)]
KRALLE = [FIG.f(2, 20), FIG.f(3, 20), FIG.f(4, 20)]                       # dunkelrot, rosa, mittel
FLUEGEL = FIG.maske(FL_FARBEN) | (FIG.maske(KRALLE) & (yy >= 19) & (yy <= 22) & ((xx <= 5) | (xx >= 14)))
KOPF = FIG.op & ~FLUEGEL & (yy <= 14) & (xx >= 5) & (xx <= 14)
REST = FIG.op & ~KOPF & ~FLUEGEL
HAUT = FIG.f(8, 9)
SPALT = FIG.f(9, 0)
AUGEN = [(6, 8), (6, 9), (7, 9), (13, 8), (12, 9), (13, 9)]
FEDERN = [(9, 0), (9, 1), (12, 0), (12, 1)]
Q, S_, V_, W_ = FIG.f(5, 15), FIG.f(4, 19), FIG.f(5, 19), FIG.f(6, 21)      # Umrissschwarz, Rumpf hell, Rumpf mittel, Rumpf dunkel
# Rumpfseite hinter den (jetzt ausgebreiteten) Flügeln, linke Seite; rechts gespiegelt (x → 19 − x)
SEITE = {(3, 19): Q, (4, 19): S_, (5, 19): V_, (4, 20): Q, (5, 20): V_, (4, 21): Q, (5, 21): V_, (4, 22): Q, (5, 22): W_, (4, 23): Q}
SEITE.update({(19 - x, y): c for (x, y), c in list(SEITE.items())})

# Ausgebreiteter linker Flügel, waagerechte Pose (Zeichen → Quellfarbe); Spalte 15 = Sprite-x 5 (Gelenk, hinter dem Rumpf), Zeile 1 = Sprite-y 15
FLUEGEL_POSE = [
    ".....CC.........",
    "....bzybbbbbbbbb",
    "..bbeeeeeeeeeeee",
    ".beejjjjjjjjjjje",
    "beejdjjdjjdjjdjj",
    "bejdbjdbjdbjdbjd",
    ".bjdbjdbjdbjdbjd",
    "..bbbjdbjdbjdbjd",
    ".....bb.bb.bb.bd",
]
ZEICHEN = {'b': (13, 0, 0), 'e': (63, 54, 66), 'j': (50, 41, 53), 'd': (32, 22, 37), 'z': KRALLE[2], 'y': KRALLE[1], 'C': (43, 7, 15)}
FL_L = L.leer(H, W)
for _r, _z in enumerate(FLUEGEL_POSE):
    for _c, _ch in enumerate(_z):
        if _ch != '.':
            FL_L[PT + 14 + _r, PL + _c - 10, :3] = ZEICHEN[_ch]
            FL_L[PT + 14 + _r, PL + _c - 10, 3] = 255
FL_R = FL_L[:, ::-1].copy()                                             # Leinwand ist spiegelsymmetrisch (PL == PR, Sprite 20 px breit)
GELENK_L, GELENK_R = PL + 5, PL + 14


def schlag(ebene, gelenk, s):
    """Ganzen Flügel um das Gelenk schwenken: Spalte im Abstand d wandert um round(s · d / 15) px (positiv = abwärts)."""
    out = L.leer(H, W)
    for x in range(W):
        ys = np.nonzero(ebene[:, x, 3])[0]
        if len(ys):
            dy = int(round(s * abs(x - gelenk) / 15.0))
            out[ys + dy, x] = ebene[ys, x]
    return out


def umriss(fl, vorn):
    """Nach dem Schwenken: Flügelpixel (Federfarben), die an einer Treppenstufe frei am Hintergrund liegen, werden Umrissfarbe – der Umriss bleibt geschlossen und 1 px dick."""
    belegt = (fl[..., 3] > 0) | (vorn[..., 3] > 0)
    p = np.pad(belegt, 1)
    frei = ~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:]
    feder = np.zeros(belegt.shape, bool)
    for c in (ZEICHEN['e'], ZEICHEN['j'], ZEICHEN['d']):
        feder |= (fl[..., 0] == c[0]) & (fl[..., 1] == c[1]) & (fl[..., 2] == c[2]) & (fl[..., 3] > 0)
    fl[feder & frei, :3] = ZEICHEN['b']
    return fl


# Zellen, die der gereckte Kopf unten freigibt und unter denen etwas liegt → Fortsetzung
FORT = {}
for x in range(FIG.sw):
    ys = np.nonzero(KOPF[:, x])[0]
    if len(ys) and ys.max() + 1 < FIG.sh and REST[ys.max() + 1, x]:
        FORT[(x, int(ys.max()))] = FIG.f(x, int(ys.max()) + 1)


def frame(i, nur=None):
    re = FIG.platz(REST)
    N2.setze(re, OFF, SEITE, neu=True)
    ko = FIG.platz(KOPF)
    if N2.fenster(i, N, 8, [1, 1, 1]) or N2.fenster(i, N, 46, [1, 1, 1]):
        N2.setze(ko, OFF, {p: HAUT for p in AUGEN})
    if N2.fenster(i, N, 40, [1, 1, 1, 1]) or N2.fenster(i, N, 54, [1, 1, 1]):
        farbe = FIG.f(9, 0)
        N2.loesche(ko, OFF, FEDERN)
        N2.setze(ko, OFF, {(x + 1, y): farbe for x, y in FEDERN}, neu=True)
    if N2.fenster(i, N, 24, [1, 1, 1]) or N2.fenster(i, N, 30, [1, 1, 1]):
        N2.setze(ko, OFF, {(9, 13): SPALT, (10, 13): SPALT})
    hoch = 1 if 18 <= i <= 37 else 0
    if hoch:
        N2.setze(re, OFF, FORT, neu=True)
        ko = L.versetze(ko, 0, -1)
    ph = 2 * math.pi * i / 12.0
    s = -0.5 - 5.5 * math.cos(ph)                                      # Frame 0: Flügel oben (−6), Frame 6: unten (+5)
    fl, fr = schlag(FL_L, GELENK_L, s), schlag(FL_R, GELENK_R, s)
    vorn = L.zusammen(H, W, [(re, 0, 0), (ko, 0, 0)])
    fl, fr = umriss(fl, vorn), umriss(fr, vorn)
    if nur == 'fluegel':
        return L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0)])
    if nur == 'koerper':
        return L.zusammen(H, W, [(re, 0, 0), (ko, 0, 0)])
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (re, 0, 0), (ko, 0, 0)])
    return L.versetze(fig, 0, int(round(2.0 * math.cos(2 * math.pi * (i - 1) / 12.0))))    # steigt während des Abschlags, sinkt beim Aufschlag


if __name__ == '__main__':
    print('Fortsetzungen:', FORT)
    N2.haupt(__import__(__name__), 'Unsettling Opportunist Vullary')
