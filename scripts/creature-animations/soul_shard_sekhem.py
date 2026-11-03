# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Sekhem“ (Creature).

PICK: [["MotiveEgypt", 226, 1]]   Ebene „Sekhem“ (MotiveEgypt.xcf, Ebene 226, 19×25 px, 25 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-sekhem.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Sekhem.png, 76×51) abgeglichen: die Ebene sitzt dort bei (28,17); der Kopf trifft zu 100 %, im Körper liegt in der Kartenkunst über Brust und Armen
ein rötliches, halbtransparentes Lavalicht, das die grauen Knochen rosa färbt — dieses Licht gehört nicht zur Figur und wird nicht übernommen; die Ebene selbst ist pixelsauber.

Aufruf:   python3 soul_shard_sekhem.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-sekhem.png + .json

Was im Sprite ist (Koordinaten im Sprite 19×25, x/y ab 0):
* Ein Skelett mit Löwenkopf: dunkelrote Mähne/Umhang (B, C, E, F, G, H, O; Zeilen 0–19), Gesicht in Pfirsich J/M/P mit zwei gelben Augen Q=(255,255,12) bei (7–8,7) und (11–12,7), weißen Reißzähnen K/U und roter Zunge R/V;
  darunter Skelettkörper in Grau (D, I, K, T; Zeilen 13–24).
* Die Arme (Nutzer: „die von den Armen hängenden Bandagen sollen sich mit den Armen mitbewegen“): links Zeilen 13–16 bei x 1–4 (Umriss A oben, Knochen I/D/K), rechts bei x 15–18; von der Unterkante jedes Arms hängt ein
  schräger Bandagenstreifen herab (links (1–3,17), (0–2,18), (0–1,19); rechts (15–17,17), (16–18,18), (17–18,19); Mitte I bzw. D, Umriss A). Arm + Bandage sind je ein starres Teil (24 Pixel zusammen).
* Material: Knochen, Stoff, Fell/Schuppen — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
* Das rote Maul (Nutzer-Feedback Runde 3: „sollte periodisch das rote Maul schließen und öffnen“): zwischen den beiden Reißzähnen (links (8,11)/(8,12), rechts (11,11)/(11,12); Grau O bzw. Weiß R) liegt eine rote 2×2-Öffnung:
  (9,11)=P (111,0,5) und (10,11)=Q (196,0,9) oben, (9,12)=(10,12)=P unten. Darüber liegt die dunkelbraune Maullinie H (49,24,0) bei (9–10,10), darunter Mähne C (59,11,11).
Fest bleiben: Umriss, Kopfform, Gesicht, Mähne, Zähne (Zunge/Zähne bleiben starr; nur die rote Öffnung wird dunkel gefüllt).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb der Arme werden im Umhang/Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 17, in der Spitze zusätzlich 20 — zwei getrennte Zeilen, damit die Bandenstruktur erhalten bleibt; nur im Rumpf, Textur der Nachbarzeile eingemischt) — Kopf, Rumpf UND beide Arme samt
  Bandagen heben sich starr um 1–2 px mit (die Arme bleiben unverformt, die Bandagen werden nicht gestreckt), die Füße bleiben am Boden.
* Armheben (links Frames 6–11 und 30–35, rechts Frames 18–23 und 42–47; 1 px zusätzlich nach oben): Arm und Bandage wandern als Ganzes; was der Arm freigibt (Umhangkante), bleibt Körper, offene Kanten werden
  mit der Umrissfarbe geschlossen.
* Maul schließen/öffnen (zweimal je Schleife, Periode 24 Frames, ab Frame 4 bzw. 28): Frame +0 offen (Original), +1 halb zu (untere rote Zeile (9–10,12) wird zur Mähnenfarbe C), +2…+7 geschlossen (obere rote Zeile (9–10,11) wird
  zur dunkelbraunen Maullinie H, untere Zeile C — die Zähne bleiben stehen), +8 halb auf, +9 offen. Nur Pixel im Gesicht; das Maul bewegt sich mit dem Kopf (Atmen). Nur Quellfarben (C, H).
* Blinzeln (zweimal je Schleife, Frames 13–14 und 37–38, je 2 Frames zu): die gelben Augenpixel (je 2×1) werden zur Gesichts-/Mähnenfarbe. Lidfarbe = umgebende Körperfarbe.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten, Figur zentriert.
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

spr = L.lade('soul-shard-sekhem')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (12, 12, 12)
MAHNE_UMRISS = (14, 2, 2)

# ── Arme + hängende Bandagen als starre Teile (Sprite-Koordinaten (y, x)) ──
ARM_L = [(13, 2), (13, 3), (13, 4), (14, 1), (14, 2), (14, 3), (14, 4), (15, 1), (15, 2), (15, 3), (16, 2), (16, 3)]
BAND_L = [(17, 1), (17, 2), (17, 3), (18, 0), (18, 1), (18, 2), (19, 0), (19, 1)]
ARM_R = [(13, 15), (13, 16), (13, 17), (14, 15), (14, 16), (14, 17), (14, 18), (15, 16), (15, 17), (15, 18), (16, 16), (16, 17)]
BAND_R = [(17, 15), (17, 16), (17, 17), (18, 16), (18, 17), (18, 18), (19, 17), (19, 18)]
TEILE = {'l': ARM_L + BAND_L, 'r': ARM_R + BAND_R}
for _k, _p in TEILE.items():
    for (_y, _x) in _p:
        assert OPAK[_y, _x], (_k, _y, _x)
KOERPER = spr.copy()
for _p in TEILE.values():
    for (_y, _x) in _p:
        KOERPER[_y, _x] = 0

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {17: 1}, 2: {17: 1, 20: 1}}                                                                      # s → eingefügte Zeilen (nur Rumpf, unterhalb der Arme; zwei GETRENNTE Zeilen, damit die Rippenbänder erhalten bleiben)
assert S[0] == 0
_ext = [(int(np.nonzero(KOERPER[y, :, 3])[0].min()), int(np.nonzero(KOERPER[y, :, 3])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert abs(_ext[_y][0] - _ext[_y - 1][0]) <= 2 and abs(_ext[_y][1] - _ext[_y - 1][1]) <= 2, ('Einfügezeile mit Randstufe', _y, _ext[_y - 1:_y + 2])

HUB = {'l': [0] * N, 'r': [0] * N}                                                                                 # zusätzlicher Armhub je Frame (px nach oben)
for _k, _starts in (('l', (6, 30)), ('r', (18, 42))):
    for _s0 in _starts:
        for _d in range(6):
            HUB[_k][_s0 + _d] = 1

# ── Maul: rote Öffnung (Sprite-Koordinaten (y, x)) ──
MUND_C, MUND_H = (59, 11, 11), (49, 24, 0)
MUND_ROT = {(11, 9): (111, 0, 5), (11, 10): (196, 0, 9), (12, 9): (111, 0, 5), (12, 10): (111, 0, 5)}
for (_y, _x), _c in MUND_ROT.items():
    assert tuple(int(v) for v in spr[_y, _x, :3]) == _c, (_y, _x)
assert tuple(int(v) for v in spr[13, 9, :3]) == MUND_C and tuple(int(v) for v in spr[10, 9, :3]) == MUND_H
MUND_POSE = {1: {(12, 9): MUND_C, (12, 10): MUND_C},                                                    # halb: untere Zeile dunkel
             2: {(11, 9): MUND_H, (11, 10): MUND_H, (12, 9): MUND_C, (12, 10): MUND_C}}              # zu
MUND = [0] * N                                                                                          # Frame → Stufe (0 offen, 1 halb, 2 zu)
for _s0 in (4, 28):
    MUND[_s0 + 1] = 1
    for _k in range(2, 8):
        MUND[_s0 + _k] = 2
    MUND[_s0 + 8] = 1

# ── Augen und Lidfarben ──
AUGEN = [(7, 7), (7, 8), (7, 11), (7, 12)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 255, 12), MAHNE_UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {13: 2, 14: 2, 37: 2, 38: 2}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


def figur(i):
    ebene, top, quelle = SH.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    teile = L.leer(H, W)
    for k, pix in TEILE.items():
        for (y, x) in pix:
            teile[top + y - HUB[k][i], PAD_L + x] = spr[y, x]
    # Arm über dem Umhang (Arm liegt vor der Mähnenkante); Körper darunter
    fig = L.zusammen(H, W, [(ebene, 0, 0), (teile, 0, 0)])
    for (y, x), c in MUND_POSE.get(MUND[i], {}).items():
        fig[top + y, PAD_L + x, :3] = c
    if i in BLINK:
        ymin = min(y for (y, x) in AUGEN)
        pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if BLINK[i] == 2 or y == ymin]
        fig = SH.lid(fig, pix, LID_AUS, eigen={(top + y, PAD_L + x) for (y, x) in AUGEN})
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: MAHNE_UMRISS if y < top + 13 else UMRISS)
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
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-sekhem')
    L.speichern('soul-shard-sekhem', 'Soul Shard Sekhem', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-sekhem-strip.png', frames[::2], spalten=12, scale=6)
