# -*- coding: utf-8 -*-
"""Idle-Animation für „3-Headed Giant“ (Creature).

Quelle: src/3-headed-giant.png — Ebene „3-Headed GIant“ (36×32 px, 28 Farben) aus Motive.xcf.

Aufruf:   python3 three_headed_giant.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/3-headed-giant.png + .json

Ablauf (32 Frames à 90 ms = 2,88 s):
* Atmen: im Körper wird eine Bauchzeile (Zeile 21) bis zu zweimal eingefügt — der Oberkörper hebt sich um bis zu 2 px, die
  Füße bleiben stehen; Arme, Hauer und Keule steigen mit dem Brustkorb. Die Köpfe bewegen sich NICHT seitlich (kein Lehnen).
* Rechter Arm (vom Betrachter): Hand und Krallen heben sich bis zu 4 px — aus der Armmitte (Zeile 23) werden Zeilen
  entfernt, die obere Hälfte bleibt an der Schulter, der Arm wird kürzer, die Hand steigt.
* Linke Hand mit der Keule: Unterarm und Finger fahren per Scherung bis zu ±3 px auf und ab (am Körper 0, an der Hand
  voll), die Keule folgt starr und pendelt zusätzlich leicht (±1 px) um die Hand. Die weißen Hauer über dem Unterarm
  bleiben vorn stehen.
* Jeder Kopf blinzelt zu eigener Zeit: leuchtendes Augenpixel → dunkelrot → Lid (3 Stufen).
Der rote Fleck (30,17), alle Hauer und die Fußkrallen sind fest. Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 32, 90
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 10, 8
BAUCHZEILE = 21

spr = L.lade('3-headed-giant')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def neutral_dunkel(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return abs(r - g) <= 3 and abs(g - b) <= 3 and r <= 140


# Keule: Der Keulenkopf (Zeilen 0–14) besteht aus neutral dunkelgrauen Pixeln und ist über sie zusammenhängend
# (die Stachelspitzen reichen bis x = 11); die Köpfe haben braune Umrisse. Griff/Zwinge ab Zeile 15: x ≤ 7.
kopf = np.zeros((sh, sw), bool)
stapel = [(5, 3)]
while stapel:
    x, y = stapel.pop()
    if not (0 <= x < sw and 0 <= y <= 14) or kopf[y, x] or not vorhanden[y, x] or not neutral_dunkel(spr[y, x, :3]):
        continue
    kopf[y, x] = True
    stapel += [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
keule = kopf | (vorhanden & (yy >= 15) & (xx <= 7))

weiss = vorhanden & (spr[..., :3].min(axis=2) >= 170)
arm_l = vorhanden & ~keule & ~weiss & (xx >= 8) & (xx <= 13) & (yy >= 18) & (yy <= 22)     # Unterarm der Keulenhand
arm_r = vorhanden & (xx >= 29) & (yy >= 19) & (yy <= 28)                                      # rechter Arm samt Krallen
koerper = vorhanden & ~keule & ~arm_l & ~arm_r

HELL, DUNKELROT, LID = (225, 92, 69), (94, 20, 0), (37, 20, 10)
AUGEN = [(9, 14), (14, 14), (18, 11), (23, 11), (27, 14), (32, 14)]
BLINZELN = {0: (20, 21, 22), 1: (20, 21, 22), 2: (8, 9, 10), 3: (8, 9, 10), 4: (14, 15, 16), 5: (14, 15, 16)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def blinzeln(t, i):
    for k, (cx, cy) in enumerate(AUGEN):
        a, b, c = BLINZELN[k]
        if i not in (a, b, c):
            continue
        gx, gy = PAD_L + cx, PAD_T + cy
        gruppe = [(gx, gy)] + [(x, y) for x, y in ((gx - 1, gy), (gx + 1, gy), (gx, gy - 1), (gx, gy + 1))
                               if t[y, x, 3] and tuple(t[y, x, :3]) == DUNKELROT]
        for (x, y) in gruppe:
            t[y, x, :3] = LID if i == b else (DUNKELROT if (x, y) == (gx, gy) else t[y, x, :3])
    return t


def frame(i):
    ph = L.sinus(i, N)
    atem = int(round(1 - math.cos(ph)))                            # 0 … 2 zusätzliche Bauchzeilen
    # linke Hand: Unterarm schert auf/ab (am Körper x=14: 0, an der Keule x=8: voll), Keule folgt starr
    hoch_runter = 3.0 * math.sin(ph + 0.6)
    arm = L.spalten_welle(teil(arm_l), PAD_L + 14, 3.0, ph + 0.6)
    dyk = int(round(hoch_runter))
    kl = L.zeilen_welle(teil(keule), PAD_T + 20, 1.2, ph - 1.0, signiert=True)
    # rechte Hand: Arm wird kürzer, Hand hebt sich (0 … 4 px)
    k = int(round(2 - 2 * math.cos(ph + 1.0)))
    ar = L.heben_unten(teil(arm_r), PAD_T + 23, k)
    # Atmen nur am Körper (Zeile einfügen); Arme, Hauer und Keule steigen mit dem Brustkorb (Hände hängen an den Schultern) —
    # würde man die fertige Gesamtzeile duplizieren, vervielfachte sich z. B. die dunkle Unterkante des angehobenen Unterarms.
    kb = L.streck_zeile(blinzeln(teil(koerper), i), PAD_T + BAUCHZEILE, atem)
    hauer_l = teil(weiss & (xx >= 8) & (xx <= 14) & (yy >= 17) & (yy <= 22))
    return L.zusammen(H, W, [(kl, 0, dyk - atem), (kb, 0, 0), (arm, 0, -atem), (hauer_l, 0, -atem), (ar, 0, -atem)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('3-headed-giant', '3-Headed Giant', frames, MS, prev)
    if prev:
        L.streifen(prev + '/3-headed-giant-strip.png', [frames[k] for k in (0, 4, 8, 12, 16, 20, 24, 28)], spalten=4, scale=8)
