# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ba“ (Creature).

PICK: [["MotiveEgypt", 205, 1]]   Ebene „Ba“ (MotiveEgypt.xcf, Ebene 205, 40×35 px, 21 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ba.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ba.png, 76×51) abgeglichen: die Ebene sitzt dort bei (18,11), die Form trifft zu 100 %. In der Kartenkunst liegt über der Kobrahaube eine rote,
halbtransparente Tönung samt Schein (Ebene „Ebene #35“, Deckkraft 80 %), die die graue Haube rot färbt und nicht pixelgenau übernommen werden kann; die Ebene „Ba“ selbst ist pixelsauber und zeigt die Haube in Grau.

Aufruf:   python3 soul_shard_ba.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ba.png + .json

Was im Sprite ist (Koordinaten im Sprite 40×35, x/y ab 0):
* Ein Skelett mit Kobrakopf: aufgestellte graue Kobrahaube (Zeilen 0–19) mit zwei roten Augen R=(255,0,0)/S=(130,0,0) bei (15,5–6) und (23–24,5–6), weißen Giftzähnen Q und offenem dunkelrotem Maul P/J;
  darunter ein kleiner Rippenkorb (Zeilen 20–31, x 13–24) mit sechs dünnen, schwarz umrandeten hellen Bändern („Bandagen“, Nutzer: „die vielen einzelnen Bandagen“), die an Haube und Rumpf hängen:
  1 = linker Bogen an der Haube (Zeilen 9–15, x 0–5), 2 = rechter Bogen (x 34–39), 3 = langer linker Schulterbogen (vom Schlüsselbein (12,23) nach links unten, hoch über den Scheitel (3–4,19) und hinunter zu (1,24)),
  4 = langer rechter Schulterbogen (von (25,23) über den Scheitel (31–33,19) hinunter zu (35,24)), 5 = linker Hängeschwanz (ab (13,28) bis (11,34)), 6 = kleiner rechter Haken (ab (24,26) bis (23,31)).
  Jedes Band hat 1–2 px hellen Kern (E/F/G/K) und 1 px Umriss (12,12,12).
* Material: Knochen, Stoff, Fell/Schuppen — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Haubenform, Gesicht, Fänge, Rippenkorb-Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb der Schultern werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 28, in der Spitze zusätzlich 27; nur Rumpf/Haube, die Bänder sind eigene Ebenen; Textur der Nachbarzeile eingemischt) — Kopf,
  Bänder und Oberkörper heben sich um 1–2 px, der untere Rippenkorb bleibt am Boden.
* Schlangenbänder: jedes der sechs Bänder bewegt sich als laufende Welle mit eigener Phase, eigener Periode (3×, 2× bzw. 4× je Schleife) und eigener Wellenlänge. Wurzel (am Körper) bleibt fest, die Amplitude wächst bis zur Spitze auf
  1,6–2,4 px. Der helle Kern wird in Wellenfronten (Breitensuche ab der Wurzel) senkrecht zum Bandverlauf verschoben, Lücken zwischen Nachbarfronten werden mit Kernpixeln geschlossen und der Umriss (4 Nachbarn, wie im Original) neu
  gezogen → jedes Band bleibt 4-verbunden und lückenlos. In Ruhe (alle Versätze 0, z. B. Frame 0) wird das Original-Band gezeichnet.
* Blinzeln (zweimal je Schleife, Frames 13–15 und 37–39: halb – zu – halb): die roten Augenpixel (je 3) werden zur Haubenfarbe. Lidfarbe = umgebende Körperfarbe.
Frame: Sprite plus 4 px links/rechts/unten, 4 px oben, Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_shard as SH

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 4

spr = L.lade('soul-shard-ba')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (0, 0, 0)
BAND_UMRISS = (12, 12, 12)

# ── Zerlegung: sechs Bänder + Körper (Haube + Rippenkorb) ──
_Y, _X = np.mgrid[0:sh, 0:sw]
LAB = np.zeros((sh, sw), int)


def _put(k, m):
    LAB[m & OPAK & (LAB == 0)] = k


_put(1, (_Y >= 9) & (_Y <= 15) & (_X <= 5))
_put(2, (_Y >= 9) & (_Y <= 15) & (_X >= 34))
_put(5, ((_Y >= 28) & (_X <= 13)) | ((_Y == 27) & (_X >= 12) & (_X <= 13)))
_put(3, (_Y >= 18) & (_Y <= 27) & (_X <= 12) & ~((_Y <= 20) & (_X >= 11)))
_put(4, (_Y >= 18) & (_Y <= 25) & (_X >= 25) & ~((_Y <= 20) & (_X <= 28)))
_put(6, (_Y >= 26) & (_X >= 24))
WURZEL = {1: (10, 5), 2: (10, 34), 3: (23, 12), 4: (23, 25), 5: (28, 13), 6: (26, 24)}        # (y, x) eines Kernpixels am Körper
GLIEDER = {k: SH.Glied(spr, [(int(y), int(x)) for y, x in zip(*np.nonzero(LAB == k))], WURZEL[k], umriss=BAND_UMRISS) for k in WURZEL}
# Welle je Band: (Amplitude px, Wellen je Schleife, Phase, Wellenzahl je Front)
WELLE = {1: (1.3, 3, 0.0, 0.7), 2: (1.3, 3, 2.1, 0.7), 3: (1.7, 2, 1.0, 0.45), 4: (1.7, 2, 3.6, 0.5), 5: (1.5, 3, 4.2, 0.8), 6: (1.2, 4, 0.7, 0.8)}
KOERPER = spr.copy(); KOERPER[LAB > 0] = 0

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {28: 1}, 2: {27: 1, 28: 1}}                                                                      # s → eingefügte Zeilen (Rippenkorb, unterhalb der Schultern)
assert S[0] == 0
_ext = [(int(np.nonzero(KOERPER[y, :, 3])[0].min()), int(np.nonzero(KOERPER[y, :, 3])[0].max())) for y in range(sh) if KOERPER[y, :, 3].any()]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y] in (_ext[_y - 1], _ext[_y + 1]), ('Einfügezeile mit Randstufe', _y, _ext[_y - 1:_y + 2])

# ── Augen und Lidfarben ──
AUGEN = [(5, 15), (6, 15), (6, 16), (5, 24), (6, 24), (6, 23)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 0, 0), (130, 0, 0), (0, 0, 0), (12, 12, 12)}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {13: 1, 14: 2, 15: 1, 37: 1, 38: 2, 39: 1}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


def baender(i, top):
    """Alle sechs Bänder (RGBA-Ebene): jedes eine laufende Welle mit eigener Phase."""
    e = L.leer(H, W)
    for k, g in GLIEDER.items():
        amp, per, ph0, kap = WELLE[k]
        v = g.versatz(amp, 2 * math.pi * per * i / N + ph0, kap)
        if i == 0:
            v = [(0, 0)] * len(v)
        e = L.zusammen(H, W, [(e, 0, 0), (g.zeichne(H, W, top, PAD_L, v), 0, 0)])
    return e


def figur(i):
    ebene, top, quelle = SH.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    fig = L.zusammen(H, W, [(baender(i, top), 0, 0), (ebene, 0, 0)])
    if i in BLINK:
        ymin = min(y for (y, x) in AUGEN)
        pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if BLINK[i] == 2 or y == ymin]
        fig = SH.lid(fig, pix, LID_AUS, eigen={(top + y, PAD_L + x) for (y, x) in AUGEN})
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
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
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-ba')
    L.speichern('soul-shard-ba', 'Soul Shard Ba', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-ba-strip.png', frames[::2], spalten=12, scale=6)
