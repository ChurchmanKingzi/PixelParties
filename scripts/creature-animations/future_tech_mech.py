# -*- coding: utf-8 -*-
"""Idle-Animation für „Future Tech Mech“ (Creature).

Quelle: src/future-tech-mech.png — Ebene „Future Tech Mech“ (18×23 px, 266 Pixel, alle deckend, 11 Farben) aus MotiveGN.xcf (Ebene 523). Gegen die Kartenkunst abgeglichen (data/card-art/native/Future_Tech_Mech.png,
76×51; die Ebene liegt bei (29, 16), Korrelation 0,98): gleiche Form, Position und Größe; die Karte ist hell überstrahlt.
PICK: [["MotiveGN", 523, 1]]

Aufruf:   python3 future_tech_mech.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/future-tech-mech.png + .json

Was ist was (x/y im Sprite):
* Ein kleiner grauer Kampfroboter (Metall: Grautöne (23,24,22) … (187,189,186)): gewölbter Helm (x 3–14, y 0–8) mit schwarzem Visier (0,1,0) bei (5–12, 5–7) und einem roten Sensorauge, 2×2 bei (8–9, 6–7)
  (dunkelrot (130,0,0) links, hellrot (190,0,0) rechts); breite Schulterpanzer (y 9–11), Brustpanzer mit hellen Platten (y 11–13), Taille (y 14), die Arme hängen seitlich (Kolben x 1–3 / 14–16, y 10–15, Fäuste
  x 0–4 / 13–17, y 16–19), Becken (x 6–11, y 15–18) und zwei Beine mit Füßen (x 4–8 und 9–14, y 19–22).
Fest bleiben: Helm-/Visierform, Augengröße, Brustpanzer, Becken, Ruhepose.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Scannerblick: das rote Auge wandert im schwarzen Visier hin und her (Frame 0 → 12 rechts, 24 zurück in der Mitte, 36 links; Versatz 0/±1/±2 px, einmal pro Schleife), der Kopf (y 0–8) dreht sich dabei als Block 1 px mit
  (nur bei Versatz ±2: Frame 8–16 nach rechts, 32–40 nach links). Das Auge besteht nur aus den Quellfarben (130,0,0)/(190,0,0), der frei gewordene Platz wird wieder Visier-Schwarz (0,1,0).
* KEIN Blinzeln (Rückmeldung des Spielgestalters); der Scannerblick (Auge wandert) bleibt.
* Arme: Fäuste/Kolben (x ≤ 4 bzw. ≥ 13, y ≥ 9) heben und senken sich im Gegentakt ±1 px (Periode 16, dreimal pro Schleife) — wie Servos.
* KEIN Fußheben (Rückmeldung des Spielgestalters): beide Füße bleiben am Boden.
* Metallglanz (Regel 14: der ganze Roboter ist Metall): ein diagonales Lichtband läuft über den Körper (zweimal pro Schleife, Start Frame 6 und 30, 14 Frames, zwei Stufen heller auf der Rampe der Grautöne); Umrisspixel am Rand,
  das Visier und das Auge glänzen nicht.
Keine Partikel (Roboter: im Zweifel weglassen). Kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 6, 6, 6, 4

spr = L.lade('future-tech-mech')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (64, 65, 63)
VISIER = (0, 1, 0)
ROT_D, ROT_H = (130, 0, 0), (190, 0, 0)
assert KONTUR in UMRISS

AUGE = [(8, 6), (9, 6), (8, 7), (9, 7)]
assert [col(x, y) for (x, y) in AUGE] == [ROT_D, ROT_H, ROT_D, ROT_H]
VISIER_PX = {(x, y) for y in (6, 7) for x in range(5, 13) if vorhanden[y, x] and col(x, y) == VISIER}
assert len(VISIER_PX) == 10

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {17: 1, 18: 2, 19: 1, 41: 1, 42: 2, 43: 1}                  # 1 = obere Zeile (y 6) zu, 2 = beide Zeilen zu


def blick(i):
    """Augenversatz −2…+2: Frame 0 Mitte, 12 rechts (+2), 24 Mitte, 36 links (−2), kontinuierlich gerundet."""
    return int(round(2.0 * math.sin(2 * math.pi * i / 48)))


# Teile (Masken im Sprite)
ARM_L = vorhanden & (((xx <= 3) & (yy >= 9) & (yy <= 19)) | ((xx == 4) & (yy >= 16) & (yy <= 19)))
ARM_R = vorhanden & (((xx >= 14) & (yy >= 9) & (yy <= 19)) | ((xx == 13) & (yy >= 16) & (yy <= 19)))
BEIN_L = vorhanden & (xx <= 8) & (yy >= 19) & ~ARM_L
BEIN_R = vorhanden & (xx >= 9) & (yy >= 19) & ~ARM_R
KOPF = vorhanden & (yy <= 8)
rest = vorhanden & ~ARM_L & ~ARM_R & ~BEIN_L & ~BEIN_R & ~KOPF
assert not (ARM_L & BEIN_L).any() and not (ARM_R & BEIN_R).any()

# Glanz: Rampe der Grautöne
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and col(x, y) not in (ROT_D, ROT_H, VISIER)}, key=lambda c: sum(c))
RAMPE_B = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}
GLANZ_M = vorhanden & ~U.kanten(spr)
for (x, y) in AUGE:
    GLANZ_M[y, x] = False
for y in range(sh):
    for x in range(sw):
        if col(x, y) == VISIER:
            GLANZ_M[y, x] = False

P = lambda x, y: (GPL + x, GPT + y)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def _gross(m):
    g = np.zeros((H, W), bool)
    g[GPT:GPT + sh, GPL:GPL + sw] = m
    return g


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def frame_gross(i, nur=None):
    ganz = L.platz(spr, H, W, GPL, GPT)
    # Lichtband (Metall) in Quellkoordinaten, bevor die Teile versetzt werden
    for start in (6, 30):
        j = i - start
        if 0 <= j <= 13:
            d = 4 + 3 * j
            for y in range(sh):
                for x in range(sw):
                    if GLANZ_M[y, x] and d <= x + y < d + 4 and col(x, y) in RAMPE_B:
                        ganz[GPT + y, GPL + x, :3] = RAMPE_B[col(x, y)]
    kopf, arml, armr, beinl, beinr, kb = (L.trenne(ganz, _gross(m))[0] for m in (KOPF, ARM_L, ARM_R, BEIN_L, BEIN_R, rest))
    # Auge: Scannerblick und Blinzeln (auf dem Kopf)
    e = blick(i)
    bl = 0                                                       # kein Blinzeln (Rückmeldung: der Mech blinzelt nicht)
    for (x, y) in AUGE:
        set_px(kopf, x, y, VISIER)
    farben = {(8, 6): ROT_D, (9, 6): ROT_H, (8, 7): ROT_D, (9, 7): ROT_H}
    for (x, y), f in farben.items():
        if bl == 2 or (bl == 1 and y == 6):
            continue
        set_px(kopf, x + e, y, f)
    hk = (1 if e > 1 else (-1 if e < -1 else 0))
    # Arme (Servos im Gegentakt)
    dyl = int(round(sinz(i, 16)))
    dyr = -dyl
    bl_ = br_ = 0                                                # kein Fußheben (Rückmeldung: beide Füße bleiben am Boden)
    koerper = L.zusammen(H, W, [(kb, 0, 0), (kopf, hk, 0), (arml, 0, dyl), (armr, 0, dyr), (beinl, 0, -bl_), (beinr, 0, -br_)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    return koerper


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur (keine Partikel)
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('future-tech-mech', 'Future Tech Mech', frames, MS, prev)
    if prev:
        L.streifen(prev + '/future-tech-mech-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
