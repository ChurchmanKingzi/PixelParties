# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ka“ (Creature).

PICK: [["MotiveEgypt", 208, 1]]   Ebene „Ka“ (MotiveEgypt.xcf, Ebene 208, 24×22 px, 19 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ka.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ka.png, 76×51) abgeglichen: die Ebene sitzt dort bei (26,5) mit 98,5 % Treffer. (Die 4 abweichenden Pixel sind Farbtönungen der Karte.)

Aufruf:   python3 soul_shard_ka.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ka.png + .json

Was im Sprite ist (Koordinaten im Sprite 24×22, x/y ab 0):
* Ein Skelett (Mumie) mit rotem Widderkopf: Gesicht in Rot-/Maroon-Tönen (B, C, E, L, N, O, P, R, S; Zeilen 4–13) mit zwei weißen Augen Q=(252,254,255) bei (9–10,7) und (13–14,7) und schwarzen Nasenlöchern,
  oben dünne türkisfarbene Zierstränge H/M mit Sockelkappe (Zeilen 0–3), darunter Mumienkörper in Grau/Schwarz (F, G, K, A; Zeilen 12–21; Bandagenstreifen, schwarze Umrisse).
* Die roten Hörner (Nutzer-Feedback Runde 3: „die roten Hörner sollen sich nicht unabhängig vom Kopf bewegen“ — die Widderhörner, die frühere Annahme „Arme“ war falsch): zwei rote Bögen (Farben I=(201,54,33),
  J=(162,40,33), D=(73,17,27); links 23 px, rechts 23 px) legen sich vom Kopfscheitel (6–8,4) außen um die Wange und enden unten bei (7,12–13) / (16,12–13) an den Schultern. Sie sind genau die Pixel dieser drei Farben.
  Sie sind Teil des Kopfes: sie bewegen sich starr und ausschließlich mit dem Kopf (dem Atmen), nie eigenständig.
* Material: Knochen, Stoff, Horn — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Umriss, Kopfform, Gesicht, Zierstränge; die Hörner relativ zum Kopf. NICHTS wird verbreitert: Kein Spaltendoppeln, die Bögen behalten ihre Form.

Runde 4 (Nutzer: „die schwarzen Linien unter dem Kopf stellen gekreuzte Arme dar; NICHT vertikal stretchen, als Einheit auf und ab“): Zeilen 13–19 (Brust mit den schwarzen Kreuzlinien, Ellbogen/Hände bei (5,18), (18,18–19))
sind die gekreuzten Arme. Sie werden nie gestreckt; Kopf + Hörner + Arme (Zeilen 0–19) heben sich als starre Einheit.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): die Einheit Kopf/Hörner/Arme hebt sich um 1 px; nur in den Beinen (Quellzeile 20, unter den Armen) wird dafür eine Zeile eingefügt (Textur der Nachbarzeile eingemischt), die Füße bleiben fest am Boden.
* Kleiner zweiter Atemzug (Frames 15–19 und 39–43: dieselbe Einheit 1 px hoch).
* Blinzeln (zweimal je Schleife, Frames 22–23 und 46–47, je 2 Frames zu): die weißen Augenpixel (je 2×1) werden zur Kopffarbe. Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Farbe im Umkreis von 2–3 px).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten, Figur zentriert.
Ergänzte Pixel: keine (seit Runde 3 gibt es keinen Armhub mehr, also keine freigelegten Schultern).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
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
KOPF_UMRISS = (58, 12, 28)                                        # Kopfumriss (B): Randpixel des Gesichts werden damit eingefasst

# ── Ebenen: Hörner (rote Bögen I/J/D) und Körper (alles andere). Beide hängen am Kopf und teilen die Bewegung (top). ──
HORN_FARBEN = [(201, 54, 33), (162, 40, 33), (73, 17, 27)]
HORN = SH.maske_farben(spr, *HORN_FARBEN)
assert int(HORN.sum()) == 46, int(HORN.sum())
HORNER = spr.copy(); HORNER[~HORN] = 0
KOERPER = spr.copy(); KOERPER[HORN] = 0
HORN_PIX = [(int(y), int(x)) for y, x in zip(*np.nonzero(HORN))]
assert all(y <= 13 for y, x in HORN_PIX)                       # alle Hornpixel liegen oberhalb der Einfügezeile (20): sie heben sich exakt wie der Kopf

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(1 if _v >= 0.35 else 0)                                                                    # Runde 4: nur noch 1 px Hub (die gekreuzten Arme werden nicht mehr gestreckt)
for _i in range(N):                                                                                      # Ausgleich für den entfallenen Armhub: kleiner zweiter Atemzug (Kopf samt Hörnern 1 px hoch), damit kein Fenster > 8 Frames ohne Bewegung bleibt
    if _i % 24 in (15, 16, 17, 18, 19):
        S[_i] = 1
POSEN = {0: {}, 1: {20: 1}}                                                                      # s → eingefügte Zeile: NUR in den Beinen (Zeile 20, unterhalb der gekreuzten Arme, Zeilen 13–19). Kopf, Hörner und Arme heben sich als starre Einheit.
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _y >= 20, ('Einfügezeile in Armen/Kopf', _y)                                               # Runde 4: gekreuzte Arme (Zeilen 13–19) und Kopf nie strecken; die Kopie von Zeile 20 hat dieselbe Breite wie Zeile 20 (keine neue Randstufe)

# ── Augen und Lidfarben ──
AUGEN = [(7, 9), (7, 10), (7, 13), (7, 14)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(252, 254, 255), UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {22: 2, 23: 2, 46: 2, 47: 2}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


def figur(i):
    ebene, top, quelle = TX.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    horner = L.leer(H, W)
    for (y, x) in HORN_PIX:
        horner[top + y, PAD_L + x] = spr[y, x]                      # exakt dieselbe Verschiebung wie der Kopf (top)
    fig = L.zusammen(H, W, [(ebene, 0, 0), (horner, 0, 0)])
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
