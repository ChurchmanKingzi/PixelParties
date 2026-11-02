# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Bear Rider“ (Creature) — Schneemann im Spitzhelm auf einem gepanzerten Bären.

Quelle: src/mischief-militia-bear-rider.png (38×43 px, 30 Farben, deckend).
PICK: [["MotiveRussia", 93, 1]]      (Ebene „Ebene #104“, Figur 1 = Reiter + Bär; Ebene 76 ist derselbe Bär ohne Reiter — Vorlage für das Verdeckte; mit der Karte Mischief_Militia_Bear_Rider.png Pixel für Pixel gleich)

Aufruf:   python3 mischief_militia_bear_rider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-bear-rider.png + .json

Was im Sprite ist (x, y im 38×43-Sprite):
* EISDORN M/N (x 18–19, y 0–3 und weiter als Helmgrat durch beide Köpfe bis y 24): heller Dorn auf dem Reiterhelm; der Bärenhelm (y 17–24) hat denselben Grat.
* REITER (y 4–17): Schneemann im grauen Spitzhelm E/F/O (98,95,114)…, Visier/Umriss C/P schwarz, Gesicht T/Z/R/W Lavendel, blauer Schal S; Augen = zwei senkrechte braune Striche b (136,95,49)/V (104,64,32) bei x 16 und x 21, y 10–11.
* BÄR (y 17–41): grauer Panzerbär A/B/E/F mit Helm (y 18–24), gelben Augen c (255,204,0) + dunklen Pupillen U (20,20,20) bei (15–16, 25) und (21–22, 25), Brauen U bei (14–15, 24)/(22–23, 24), Nase Q (60,62,61) (y 26–29),
  Maul a/d dunkelrot (26,0,0)/(74,0,0) bei (17–20, 30–31) mit zwei weißen Fangzähnen I (255,255,255) an (17,31)/(20,31)/(17,32)/(20,32).
* SCHULTERPLATTEN (x 4–9 und 28–33, y 20–31): orangebraune Platten G/K/L/X (91,47,19)/(182,106,57)/(126,61,28)/(221,145,95) mit dunklem Rand; daraus ragen seitlich ELSBLATT-KLINGEN M/N (lavendel-weiß, x 0–4 und 33–37, y 25–26).
* BEINE/UNTERKÖRPER (y 32–41): graue Panzerplatten A/B/D, dunkle Innenseite Y/J, weiße Pixel I an den Füßen/Kanten bei (3–7, 38–42) und (30–35, 38–42): Schneespritzer/Krallen — unklar, bleiben FEST.
Material: Fell, Stoff, Schnee, Eisblätter — KEIN Glanz (Regel 14), kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos), alle Bewegungen unabhängig:
* Atmen des Bären (Periode 24, zweimal je Schleife): Zeile 34 des Bärenrumpfs wird einmal doppelt eingefügt (Mischtextur; keine Gesichtsmerkmale in dieser Zeile) — Bärenkopf, Schulterplatten, Klingen und Reiter steigen 1 px, Füße bleiben am Boden.
* Reiter läuft nach (Periode 24, 3 Frames später): Zeile 16 (Hals des Reiters, dunkles Band) einmal doppelt — der Reiter steigt ein weiteres px (Hut + Dorn).
* Eisklingen zittern (Perioden 20/28, gegenläufig): die Klingenspitzen (x 0–3 bzw. 34–37, y 25–26) verschieben sich als Ganzes um ±1 px senkrecht; die Wurzel (x 4 bzw. 33) bleibt in der Platte.
* Bär blinzelt (alle 2,5 s, 3 Frames): gelbe Augen + Pupillen werden zu Fellgrau A (123,125,124); Reiter blinzelt versetzt (2 Frames): braune Augenstriche → Gesichtsfarbe T/R.
* Bär knurrt (zweimal je Schleife, 5 Frames): (18,32)/(19,32) werden dunkelrot a — das Maul öffnet sich 1 px tiefer.
* Kalter Dunst: 7 Wölkchen ≥ 2×2 steigen langsam links/rechts der Beine auf.
Ergänzungen: keine gemalten Pixel außer Mund/Blinzeln (Farben des Sprites). Frame 0 = Original (Dunst ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 11, 11, 6, 3
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-bear-rider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

M_, N_ = (209, 213, 234), (176, 183, 208)
GRAU = (123, 125, 124)
T_, R_ = (223, 224, 246), (204, 204, 242)
AROT = (26, 0, 0)

KL_L = [(x, 25) for x in range(0, 4)] + [(2, 26), (3, 26)]
KL_R = [(x, 25) for x in range(34, 38)] + [(34, 26), (35, 26)]
for (x, y) in KL_L + KL_R:
    assert tuple(spr[y, x, :3]) in (M_, N_), (x, y)
klingen_maske = np.zeros((sh, sw), bool)
for (x, y) in KL_L + KL_R:
    klingen_maske[y, x] = True
BAER_AUGEN = [(15, 25), (16, 25), (21, 25), (22, 25)]
REITER_AUGEN = {(16, 10): T_, (16, 11): T_, (21, 10): R_, (21, 11): R_}


def koerper(i):
    rest, _ = L.trenne(spr, ~klingen_maske)             # rest = Klingen allein (trenne: erste = maskierter Teil)
    klingen = L.platz(rest, H, W, PAD_L, PAD_T)
    k = L.platz(L.trenne(spr, klingen_maske)[1], H, W, PAD_L, PAD_T)
    # Klingen zittern
    dl = E.wippen(i, 20, 0.0, 1.0)
    dr = E.wippen(i, 28, 0.0, -1.0)
    kl_l = L.leer(H, W); kr = L.leer(H, W)
    for (x, y) in KL_L:
        kl_l[y + PAD_T + dl, x + PAD_L] = spr[y, x]
    for (x, y) in KL_R:
        kr[y + PAD_T + dr, x + PAD_L] = spr[y, x]
    k = L.zusammen(H, W, [(kl_l, 0, 0), (kr, 0, 0), (k, 0, 0)])
    # Blinzeln / Knurren
    if Hm.folge(i, 22, [1, 1, 1], N):
        Hm.setze(k, {p: GRAU for p in BAER_AUGEN}, OFF)
    if Hm.folge(i, 40, [1, 1], N):
        Hm.setze(k, REITER_AUGEN, OFF)
    if Hm.folge(i, 6, [1] * 5, N) or Hm.folge(i, 30, [1] * 5, N):
        Hm.setze(k, {(18, 32): AROT, (19, 32): AROT}, OFF)
    # Atmen: Bär (Zeile 34) und Reiter (Zeile 16) mit Nachlauf
    brust = E.verlauf3(i, 24, 0.0, 1)
    reiter = Hm.stufe(i - 3, 24, 1)
    k = L.streck_zeile(k, PAD_T + 34, brust) if brust else k
    if reiter:
        k = L.streck_zeile(k, PAD_T + 16 - brust, reiter)
    Hm.kontur_schliessen(k, ERLAUBT, (27, 20, 18))
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + 41 + dy, vx=vx, vy=-17, off=o, form=f, wackeln=1.2, ph=p) for (x, dy, vx, o, f, p) in
         [(-4, 0, -2.0, 0, 'm', 0.0), (41, 0, 2.0, 7, 'o', 0.3), (-2, -3, -1.0, 14, 'o', 0.6), (39, -2, 1.5, 21, 'm', 0.1),
          (-5, 1, -1.5, 28, 'm', 0.8), (42, 1, 1.0, 35, 'o', 0.5), (0, -1, -2.0, 42, 'm', 0.2)]]
DUNST_FARBEN = {'c': T_, 'r': R_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'bear-rider')
    L.speichern('mischief-militia-bear-rider', 'Mischief Militia - Bear Rider', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-bear-rider-strip.png', frames[::2], spalten=12, scale=4)
