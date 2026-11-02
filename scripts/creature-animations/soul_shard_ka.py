# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ka“ (Creature).

PICK: [["MotiveEgypt", 208, 1]]   Ebene „Ka“ (MotiveEgypt.xcf, Ebene 208, 24×22 px, 19 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ka.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ka.png, 76×51) abgeglichen: die Ebene sitzt dort bei (26,5) mit 98,5 % Treffer. (Die 4 abweichenden Pixel sind Farbtönungen der Karte.)

Aufruf:   python3 soul_shard_ka.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ka.png + .json

Was im Sprite ist (Koordinaten im Sprite 24×22, x/y ab 0):
* Ein Skelett (Mumie) mit rotem Widderkopf: Gesicht in Rot-/Maroon-Tönen (B, C, E, L, N, O, P, R, S; Zeilen 4–13) mit zwei weißen Augen Q=(252,254,255) bei (9–10,7) und (13–14,7) und schwarzen Nasenlöchern,
  oben dünne türkisfarbene Zierstränge H/M mit Sockelkappe (Zeilen 0–3), darunter Mumienkörper in Grau/Schwarz (F, G, K, A; Zeilen 12–21; Bandagenstreifen, schwarze Umrisse).
* Die „Arme“ (Nutzer: „die verschränkten Arme … hoch bewegen und darunter den Mumienkörper freilegen“): zwei rote Bögen (Farben I=(201,54,33), J=(162,40,33), D=(73,17,27); links 23 px, rechts 23 px) legen sich
  vom Kopfscheitel (6–8,4) außen um die Wange und enden unten bei (7,12–13) / (16,12–13) an den Schultern. Sie sind genau die Pixel dieser drei Farben (kein Gesichtspixel hat sie). Annahme: das sind die Arme.
* Material: Knochen, Stoff, Horn — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Umriss, Kopfform, Gesicht, Zierstränge. NICHTS wird verbreitert: Kein Spaltendoppeln, die Bögen behalten ihre Form.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 15, in der Spitze zusätzlich 18 — zwei getrennte Zeilen statt zweier aufeinanderfolgender, damit die senkrechten Bandagenstreifen nicht zu langen Balken werden; Textur der Nachbarzeile eingemischt) — Kopf,
  Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Arme heben (zweimal je Schleife, Frames 9–14 und 33–38; 1–2 px nach oben, mit Zwischenstufe): die Bögen werden starr als Ganzes angehoben (alle 46 Armpixel gleich, nichts wird gestreckt). Unter den Armenden
  wird der Mumienkörper (Schultern) prozedural fertiggezeichnet: freiliegend werden (7,13) und (16,13) in Bandagenfarbe F, ihr schwarzer Außenumriss (6,13)/(17,13) und (bei 2 px Hub) der obere Umriss (7,12)/(16,12).
* Blinzeln (zweimal je Schleife, Frames 22–23 und 46–47, je 2 Frames zu): die weißen Augenpixel (je 2×1) werden zur Kopffarbe. Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Farbe im Umkreis von 2–3 px).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen und Armhub), 2 px unten, Figur zentriert.
Ergänzte Pixel (Sprite-Koordinaten): (7,13)/(16,13) = F (187,187,187) Bandage, (6,13)/(17,13) und (7,12)/(16,12) = A (12,12,12) Umriss — nur sichtbar, wenn der Arm sie freigibt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_shard as SH

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('soul-shard-ka')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (12, 12, 12)
KOPF_UMRISS = (58, 12, 28)                                        # Kopfumriss (B): Randpixel des Gesichts, die der Arm freigibt, werden damit eingefasst

# ── Ebenen: Arme (rote Bögen I/J/D) und Körper (alles andere) ──
ARM_FARBEN = [(201, 54, 33), (162, 40, 33), (73, 17, 27)]
ARM = SH.maske_farben(spr, *ARM_FARBEN)
assert int(ARM.sum()) == 46, int(ARM.sum())
ARME = spr.copy(); ARME[~ARM] = 0
KOERPER = spr.copy(); KOERPER[ARM] = 0
ARM_PIX = [(int(y), int(x)) for y, x in zip(*np.nonzero(ARM))]
assert all(y <= 13 for y, x in ARM_PIX)                       # alle Armpixel liegen oberhalb der Einfügezeilen (15, 18): sie heben sich mit der Brust

# ── Ergänzung: Schultern unter den Armenden (nur sichtbar, wenn frei) ──
BANDAGE = (187, 187, 187)
SCHULTER = {'l': dict(band=(13, 7), aussen=(13, 6), oben=(12, 7)), 'r': dict(band=(13, 16), aussen=(13, 17), oben=(12, 16))}      # (y, x) im Sprite
for _s in SCHULTER.values():
    assert not spr[_s['aussen'][0], _s['aussen'][1], 3]

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {15: 1}, 2: {15: 1, 18: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes; zwei GETRENNTE Zeilen, damit die senkrechten Bandagenstreifen nicht zu langen Balken werden)
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert max(abs(_ext[_y][0] - _ext[_y - 1][0]), abs(_ext[_y][1] - _ext[_y - 1][1])) <= 1, ('Einfügezeile mit Randstufe', _y)

HUB = [0] * N                                                                                 # Armhub je Frame (px nach oben)
for _s0 in (9, 33):
    for _k, _d in enumerate([1, 2, 2, 2, 2, 1]):
        HUB[_s0 + _k] = _d

# ── Augen und Lidfarben ──
AUGEN = [(7, 9), (7, 10), (7, 13), (7, 14)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(252, 254, 255), UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {22: 2, 23: 2, 46: 2, 47: 2}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


def figur(i):
    ebene, top, quelle = SH.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    d = HUB[i]
    arme = L.leer(H, W)
    belegt = set()
    for (y, x) in ARM_PIX:
        yy, xx = top + y - d, PAD_L + x
        arme[yy, xx] = spr[y, x]
        belegt.add((yy, xx))
    fig = ebene.copy()
    # Schultern: nur dort, wo der Arm das Feld freigibt
    for s in SCHULTER.values():
        yb, xb = s['band']
        if (top + yb, PAD_L + xb) not in belegt:
            fig[top + yb, PAD_L + xb, :3] = BANDAGE; fig[top + yb, PAD_L + xb, 3] = 255
            ya, xa = s['aussen']
            fig[top + ya, PAD_L + xa, :3] = UMRISS; fig[top + ya, PAD_L + xa, 3] = 255
            yo, xo = s['oben']
            if (top + yo, PAD_L + xo) not in belegt:
                fig[top + yo, PAD_L + xo, :3] = UMRISS; fig[top + yo, PAD_L + xo, 3] = 255
    fig = L.zusammen(H, W, [(fig, 0, 0), (arme, 0, 0)])
    if i in BLINK:
        ymin = min(y for (y, x) in AUGEN)
        pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if BLINK[i] == 2 or y == ymin]
        fig = SH.lid(fig, pix, LID_AUS, eigen={(top + y, PAD_L + x) for (y, x) in AUGEN})
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: KOPF_UMRISS if y - top <= 12 else UMRISS)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, top=top, quelle=quelle, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs], '| Pfadpixel:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-ka')
    L.speichern('soul-shard-ka', 'Soul Shard Ka', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-ka-strip.png', frames[::2], spalten=12, scale=6)
