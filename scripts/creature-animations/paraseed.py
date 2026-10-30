# -*- coding: utf-8 -*-
"""Idle-Animation für „Paraseed“ (Creature).

PICK: [["MotiveSteamDwarfs", 145, 1]]   Ebene „Paraseed“ (MotiveSteamDwarfs.xcf, Ebene 145, 79×26 px mit zwei Figuren; Figur 1 = die vordere, 16×24 px, 33 Farben, nur Alpha 0/255)
→ src/paraseed.png. Die zweite Figur derselben Ebene (rechts, Arme seitlich) ist ein anderes Bild derselben Creature (Pose), die roten Tulpenpflanzen der Ebene 144 sind der Wald der Karte — beide
nicht verwendet.

Aufruf:   python3 paraseed.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/paraseed.png + .json

Was im Sprite ist (Koordinaten im Sprite 16×24, x/y ab 0):
* Kapuze (Zeilen 0–11, x 1–14): spitze Kapuze in kaltem Grau/Weiß (F=(68,68,68), B=(119,120,124), H, I, K, N, T bis Weiß), oben als Spitze (Zeile 0: 2 px), breiter werdend bis Zeile 11.
  Darunter im Gesicht zwei dunkle Augenhöhlen und Haut P=(255,230,213) bei (7–8, 10) — die Augen sind im Sprite nicht eindeutig zu erkennen (kein Blinzeln).
* Umhang (Zeilen 12–19): schwarz/dunkelgrau (A, C, O, R, S, J, M), Schultern (Zeile 12 schmaler: x 2–13), Ärmel mit weißen Lichtern T bei (2, 13), (13, 13) und braunen Hautpixeln L=(49,24,0) an den
  Händen (x 0–1/14–15, Zeilen 17–19); durch die Mitte laufen rote Stränge (D=(102,0,0), E=(181,0,0), G=(128,0,0)) vom Mund (Zeile 12) bis zum Saum (Zeile 19).
* Wurzeln (Zeilen 20–23, x 4–10): ein roter Wurzelballen unter dem Saum, der Creature „Samen“.
* Material: Stoff und Fleisch — KEIN Glanz (Regel 14); kein Flammenfeuer (Regel 15).
Fest bleiben: Gesicht, Ärmel/Hände, Umhangzeichnung, Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): der Umhang streckt sich 1–2 px nach oben (Frames 2–10 und 26–34 eine Körperzeile 16, in der Spitze 4–8 und 28–32 zusätzlich Zeile 15 verdoppelt; alle Ränder
  der verdoppelten Zeilen sind gleich, es entsteht keine offene Kante); die Wurzeln bleiben am Boden.
* Kapuzenspitze: die oberen fünf Kapuzenzeilen neigen sich seitlich (Zeilenversatz wächst zur Spitze, bis ±1 px, Periode 24, Nachlauf); Frame 0 = Quellform.
* Wurzeln: der Wurzelballen (Zeilen 20–23) wiegt sich unter dem Saum (Zeilenversatz wächst zur Wurzelspitze bis ±1 px, Periode 16, Nachlauf).
* Sporen (Partikel): acht kleine runde Rot-Punkte (Formen k/s, Farben E und G des Sprites) steigen links und rechts von der Gestalt langsam auf (Samenflug, 24 Frames Lebenszeit).
Ergänzungen: falls beim Neigen der Kapuze ein Innenpixel am Rand frei liegt, bekommt sein leeres Nachbarfeld den Umriss F=(68,68,68) (umriss_ergaenzen, Regel 16; 0–4 Pixel je Frame).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken + Sporen), 2 px unten — Figur zentriert; Sporen liegen in der 2-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('paraseed')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (68, 68, 68)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
SPOREN = {'c': (181, 0, 0), 'r': (128, 0, 0)}
for _c in SPOREN.values():
    assert _c in _farben, _c

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.3 else 0)
POSEN = {0: {}, 1: {16: 1}, 2: {15: 1, 16: 1}}                                          # s → Körperzeilen verdoppeln
assert S[0] == 0
KOPF_PIVOT = 5                                                                          # Zeilen 0–4 neigen sich
WURZEL_Y0 = 20                                                                          # Zeilen 20–23 = Wurzelballen

PUFFS = [
    dict(x=PAD_L + 1, y=PAD_T + 19, vx=-1, vy=-8, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 14, y=PAD_T + 18, vx=1, vy=-8, off=3, form='s', wackeln=1),
    dict(x=PAD_L + 1, y=PAD_T + 14, vx=-1, vy=-8, off=6, form='k', wackeln=1),
    dict(x=PAD_L + 14, y=PAD_T + 13, vx=1, vy=-8, off=9, form='k', wackeln=1),
    dict(x=PAD_L + 2, y=PAD_T + 22, vx=-1, vy=-8, off=12, form='s', wackeln=0),
    dict(x=PAD_L + 13, y=PAD_T + 22, vx=1, vy=-8, off=15, form='k', wackeln=0),
    dict(x=PAD_L + 2, y=PAD_T + 9, vx=-1, vy=-7, off=18, form='k', wackeln=1),
    dict(x=PAD_L + 13, y=PAD_T + 9, vx=1, vy=-7, off=21, form='k', wackeln=1),
]


def zeilen_dx(i):
    """Zeilenversatz je Quellzeile: Kapuzenspitze (Zeilen 0–4) und Wurzelballen (Zeilen 20–23); Frame 0 = 0 (Phasenversatz abgezogen)."""
    out = [0] * sh
    for k in range(KOPF_PIVOT):
        frac = (KOPF_PIVOT - k) / float(KOPF_PIVOT)
        ph = 2 * math.pi * i / 24
        out[k] = int(round(1.2 * frac * (math.sin(ph - 0.5 * frac) - math.sin(-0.5 * frac))))
    for k in range(WURZEL_Y0, sh):
        frac = (k - WURZEL_Y0 + 1) / float(sh - WURZEL_Y0)
        ph = 2 * math.pi * i / 16 + 1.0
        out[k] = int(round(1.4 * frac * (math.sin(ph - 0.8 * frac) - math.sin(1.0 - 0.8 * frac))))
    return out


def figur(i):
    doppeln = POSEN[S[i]]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=doppeln, p=0, x0=PAD_L)
    z = A.verschiebe_zeilen(z, quelle, zeilen_dx(i))
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i):
    f = figur(i)
    sporen = L.puff_ebene(H, W, i, 24, PUFFS, SPOREN)
    return L.zusammen(H, W, [(sporen, 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Farben im Sprite:', len(_farben), '| Randfarben:', sorted(RAND_FARBEN))
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'paraseed')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('paraseed', 'Paraseed', frames, MS, prev)
    if prev:
        L.streifen(prev + '/paraseed-strip.png', frames[::2], spalten=12, scale=8)
