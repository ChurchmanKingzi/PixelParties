# -*- coding: utf-8 -*-
"""Idle-Animation für „Empty Armor“ (Creature) — leere, spukende Rüstung: der Helm klappert auf dem hohlen Rumpf, die roten Augen glimmen.

PICK: [["Motive", 935, "Ebene „Empty Armor“ (16×24 px, ganze Ebene)"]]
Quelle vollständig (eine Figur, 14 Farben). Für die Karte liegt keine Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (16×24): graublauer Helm (x 3–12, y 0–6) mit goldener Gesichtsmaske (Gold (255,247,99)/(239,170,66), y 4–8), darin zwei rote Augen (6,6) (9,6) unter schwarzen Brauen
und ein schwarzer Nasen-/Mundschlitz (x 7–8, y 5–8); Kinn bis y 9. Schulterplatten (y 7–9), Arme mit goldenen Handschuhen (x 0–3 und 12–15, y 10–15), brauner Lederharnisch (x 5–10, y 10–15),
Beinschienen und Stiefel (y 16–23).
Rüstungsteile sind starr → nichts wird gestreckt. Helm/Visier blinzelt nicht.

Ablauf (48 Frames à 75 ms = 3,6 s). Frame 0 = Original:
* Helm klappert: der Helm (samt Maske und Kinn) hüpft als starre Einheit 1 px hoch und fällt zurück (Frames 6–7, 10–11, 30–31). Darunter wird das HOHLE Innere sichtbar – die frei werdenden
  Pixel sind schwarz (0,0,0) bzw. am Rand Umrissfarbe (57,77,74) (Ergänzung, s. u.), kein Hintergrund scheint durch.
* Augen glimmen: die zwei roten Augenpixel wechseln im 6-Frame-Takt zwischen Rot (255,0,0) und Orange (239,170,66) – nur innerhalb der Augenpixel.
* Sparkle auf der Schulterplatte (Metall): kurz bei Frame 20–23 (links) und 40–43 (rechts).
Ergänzungen (nur während der Helm oben ist): (6–9, 9) schwarz (hohler Hals); (3,6) (4,6) (11,6) (12,6) (5,8) (10,8) Umrissfarbe.
"""
import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 48, 75
sz = N7.Szene('empty-armor', (3, 3, 3, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
HELM_M = (yy <= 6) | ((yy <= 9) & (xx >= 6) & (xx <= 9)) | ((yy >= 7) & (yy <= 8) & ((xx == 5) | (xx == 10)))
HELM = sz.teil(HELM_M)
REST = sz.teil(~HELM_M)
SCHWARZ, UMRISS, ROT, ORANGE, WEISS = (0, 0, 0), (57, 77, 74), (255, 0, 0), (239, 170, 66), (255, 255, 255)
HOHL = [(6, 9), (7, 9), (8, 9), (9, 9)]
RAND = [(3, 6), (12, 6), (5, 8), (10, 8), (4, 6), (11, 6)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    hoch = 1 if i in (6, 7, 10, 11, 30, 31) else 0
    rest = REST.copy()
    if hoch:
        for (x, y) in HOHL:
            rest[sz.PT + y, sz.PL + x] = SCHWARZ + (255,)
        for (x, y) in RAND:
            rest[sz.PT + y, sz.PL + x] = UMRISS + (255,)
    helm = HELM
    if N7.stufe(i, 12, 6, 6):
        helm = N7.farbtausch(helm, helm[..., 3] > 0, {ROT: ORANGE})
    f = L.zusammen(sz.H, sz.W, [(rest, 0, 0), (helm, 0, -hoch)])
    if not nur:
        for start, (x, y) in ((20, (2, 8)), (40, (13, 8))):
            st = N7.funkel_folge(i, N, start, (1, 2, 2, 1))
            if st:
                N7.funkel(f, sz.PL + x, sz.PT + y, st, WEISS)
    return f


if __name__ == '__main__':
    N7.fertig('empty-armor', 'Empty Armor', frame, N, MS, spr, check=[0, 6, 8, 21], zoom=14)
