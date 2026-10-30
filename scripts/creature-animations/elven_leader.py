# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Leader“ (Creature) — die Elfe im Blätterumhang in der Mitte des Kartenmotivs.

Quelle: src/elven-leader.png (15×26 px, 21 Farben).
PICK: [["MotiveGrailWar", 555, 3]]      (Ebene „Elven Leader“, Figur 3; Figur 1 und 2 sind die beiden Bogenelfen links/rechts
                                         daneben = der „Elven Archer“, gespiegelt — gehören nicht zu diesem Sprite)

Aufruf:   python3 elven_leader.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-leader.png + .json

Was im Sprite ist (x, y im 15×26-Sprite):
* Blätterkapuze/-haar (y 0–14, links x 1–4, rechts x 10–14): Laubmuster in vier Grünstufen
  A (77,109,44) < C (94,149,21) < D (151,203,66) < E (175,232,91).
* Gesicht (y 7–13): Hautfarben H/L/I/P/M. Augen je 2×2: links (5–6, 9–10), rechts (9–10, 9–10): hellblau (5/10, 9), weiß (5/10, 10),
  schwarze Pupille (6/9, 9), grüne Iris (6/9, 10); schwarze Wimpern/Brauen (5,8) und (10,8). Mundwinkel/Kinnschatten dunkelbraun (5,12), (10,12).
* Spitze Ohren links (1,5–8)+(2,7–8) und rechts (13–14,7–8): dunkler Umriss mit Haut, schauen aus dem Laub (bleiben fest, weil sie
  größtenteils vom Laub verdeckt sind).
* Hals/Kragen (6–9, 13–14), Hände seitlich am Körper (links 1–2, 15–18; rechts 12–13, 16–17, mit dunklem Umriss), braune Riemen/Gürtel
  (dunkelbraun B (49,24,0), y 15–19), Hose braun-grau (4–10, 19–24) mit schwarzem Spalt zwischen den Beinen (7–8, 21–24), Stiefel F (46,45,36)
  (3–6 und 9–12, y 24–25), Laubsaum des Umhangs links (x 0–4) und rechts (x 11–14), y 19–23.

Ablauf (40 Frames à 90 ms = 3,6 s, nahtlos):
* Atmen (Periode 40): Oberkörper (Kapuze, Gesicht, Arme, Umhang) hebt sich 1 px (Hosenzeile 20 wird einmal doppelt eingefügt),
  Stiefel und Beine bleiben.
* Laubböen (zwei Windfronten, Frames 2–17 und 22–37): eine diagonale Front läuft von links oben nach rechts unten über Kapuze und
  Umhang. Wo sie vorbeikommt (a) wird das Laub eine Stufe heller, im Kern der Front zwei Stufen (Rascheln, nur Stufen der vorhandenen Grünrampe), (b) stehen
  einzelne Blattspitzen am Rand 2–3 Frames 1 px weiter draußen (14 Spitzen LAUBSPITZEN, jede 4-verbunden mit dem Rand, in A/C),
  (c) spreizt sich der Saum unten (9 Saumspitzen) — „Spitze hinterher“, weil die Front den Saum zuletzt erreicht.
* Blinzeln (Frames 19–21): Lid über der oberen Augenreihe, dann zu (schwarzer Strich auf Zeile 10).
* Blick: kurz nach links (Frames 24–29: linkes Auge tauscht Pupille/Iris mit Hellblau/Weiß) und später nach rechts (Frames 33–37, rechtes Auge).
* Zwei Blätter lösen sich vom Umhang und segeln langsam links bzw. rechts am Körper herab (L.puff_ebene, Dithering-frei,
  wachsen/schrumpfen, Farben D und C der Rampe, hinter der Figur, ein Blatt je Seite, 20 Frames versetzt).
Frame 0 = Original (Ruhepose), die Blätter ausgenommen. Kontrolle: anim_humanoide.ruhepose.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine nötig (nichts wird verschoben, nur Pixel am Rand/Saum dazugesetzt, Kopf/Arme fahren gemeinsam).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 40, 90
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 5, 3

spr = L.lade('elven-leader')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)

A, C, D, E = (77, 109, 44), (94, 149, 21), (151, 203, 66), (175, 232, 91)       # Laubrampe dunkel → hell
RAMPE = [A, C, D, E]
HAUT, SCHWARZ = (246, 189, 123), (0, 0, 0)
HELLBLAU, WEISS, IRIS = (172, 213, 255), (246, 255, 255), (41, 123, 0)

# Blinzeln: halb = obere Augenreihe von der Haut (Lid) bedeckt; zu = zusätzlich schwarzer Strich auf Zeile 10
LID = {(5, 9): HAUT, (6, 9): HAUT, (9, 9): HAUT, (10, 9): HAUT}
AUGE_ZU = {**LID, (5, 10): SCHWARZ, (6, 10): SCHWARZ, (9, 10): SCHWARZ, (10, 10): SCHWARZ}

# Blick zur Seite: im Ruhezustand liegen beide Pupillen innen (links x 6, rechts x 9). Blick nach links: linkes Auge tauscht die
# Spalten (Pupille + Iris nach außen auf x 5, Hellblau/Weiß nach innen); Blick nach rechts: rechtes Auge (Pupille auf x 10).
BLICK_LINKS = {(5, 9): SCHWARZ, (6, 9): HELLBLAU, (5, 10): IRIS, (6, 10): WEISS}
BLICK_RECHTS = {(9, 9): HELLBLAU, (10, 9): SCHWARZ, (9, 10): WEISS, (10, 10): IRIS}

# Blattspitzen am Rand (x, y, Farbe): je 1 px außen an einem vorhandenen Randpixel (4-verbunden), nur in Laubfarben
LAUBSPITZEN = [
    (5, 0, A), (8, 0, A), (10, 0, A), (12, 0, A),                       # Oberkante
    (2, 1, A), (1, 2, C), (1, 3, A), (0, 4, C),                         # links
    (13, 1, C), (13, 2, A), (14, 3, C), (14, 4, A), (15, 5, C), (15, 6, A),   # rechts
]
# Umhangsaum (Zeilen 19–23): äußere Blätter spreizen sich
SAUMSPITZEN_OBEN = [(-1, 20, A), (0, 21, A), (15, 19, A), (14, 20, C), (15, 21, A)]
SAUMSPITZEN = [(0, 22, A), (1, 23, A), (15, 22, A), (14, 23, A)]       # Umhangsaum spreizt sich nach außen
for (sx, sy, _) in LAUBSPITZEN + SAUMSPITZEN + SAUMSPITZEN_OBEN:
    assert not (0 <= sx < sw and 0 <= sy < sh and vorhanden[sy, sx]), ('Spitze liegt auf einem vorhandenen Pixel', sx, sy)
    nb = [(sx + dx, sy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    assert any(0 <= x < sw and 0 <= y < sh and vorhanden[y, x] for x, y in nb), ('Spitze ohne 4-Nachbarn', sx, sy)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, blaetter=True):
    k = teil(vorhanden)
    # --- Laubböen: zwei diagonale Fronten (s = x + 0,6·y von −3 bis 30), 16 Frames lang ---
    for start in (2, 22):
        mitte = Hm.boe_mitte(i, N, start, 16, -3.0, 30.0)
        if mitte is None:
            continue
        Hm.heller(k, lambda x, y: Hm.boe_aktiv(x, y, mitte, 1.6), RAMPE, OFF)
        Hm.heller(k, lambda x, y: Hm.boe_aktiv(x, y, mitte, 0.8), RAMPE, OFF)          # Kern der Front: zwei Stufen heller
        sp = {(x, y): c for (x, y, c) in LAUBSPITZEN + SAUMSPITZEN + SAUMSPITZEN_OBEN if Hm.boe_aktiv(x, y, mitte, 1.2)}
        Hm.setze(k, sp, OFF)
    # --- Blinzeln ---
    bl = Hm.folge(i, 19, [LID, AUGE_ZU, LID], N)
    if bl:
        Hm.setze(k, bl, OFF)
    # --- Blick: kurz nach links (Frames 24–29), später nach rechts (Frames 33–37) ---
    if Hm.takt(i, N, 24, 6):
        Hm.setze(k, BLICK_LINKS, OFF)
    if Hm.takt(i, N, 33, 5):
        Hm.setze(k, BLICK_RECHTS, OFF)
    # --- Atmen: Hosenzeile 20 einmal doppelt, Oberkörper steigt 1 px ---
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 14, Hm.stufe(i, N, 1), 0)
    ebenen = []
    if blaetter:
        ebenen.append((L.puff_ebene(H, W, i, N, [
            dict(x=PAD_L - 3, y=PAD_T + 4, vx=-1, vy=16, off=0, form='o', wackeln=1.5),
            dict(x=PAD_L + 17, y=PAD_T + 7, vx=1, vy=15, off=20, form='o', wackeln=1.5),
        ], {'c': D, 'r': C}), 0, 0))
    ebenen.append((k, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, blaetter=False), spr, OFF)
    print('Ruhepose (ohne Blätter) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('elven-leader', 'Elven Leader', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-leader-strip.png', frames, spalten=10, scale=6)
