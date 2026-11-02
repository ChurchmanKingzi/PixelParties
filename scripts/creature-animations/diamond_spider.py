# -*- coding: utf-8 -*-
"""Idle-Animation für „Diamond Spider“ (Creature).

Quelle: src/diamond-spider.png — Ebene „Ebene #181“ (15×19 px, 9 Farben) aus MotiveGN.xcf (Ebene 273): die Spinne mit Diamantkörper samt ihren sieben
Glitzersternen (die Sterne sind Teil der Ebene, nicht erfunden).
PICK: [["MotiveGN", 273, 1]]

Aufruf:   python3 diamond_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/diamond-spider.png + .json

Identifikation (Sprite 15×19, Spinne von oben/vorn, symmetrisch um x = 7):
* Diamant (Kopf-/Rückenstein, x 4–10, Zeilen 3–8): türkiser Rand B (44,147,156), Facetten D (67,224,231) / E (194,249,252) / I (166,226,227), unten spitz bei (7,8).
* Körper (x 4–10, Zeilen 7–11): schwarzgraue Fläche C (31,32,30) / F (40,41,39) / H (65,66,64) / G (0,0,0) unter dem Diamanten.
* Zwei Diamant-„Füße“ unten (links x 3–7, rechts x 7–11, Zeilen 12–14): türkise Kristalle B/D/E, über dünne Hälse (5,10) (5,11) bzw. (9,10) (9,11) am Körper.
* Acht Beine, als dünne 1-px-Diagonalen (diagonal verbunden, vom Künstler so gezeichnet), je Seite vier: links L1 (2,5) (1,6) (0,7), L2 (3,7) (2,8) (1,9), L3 (3,10) (2,11)
  (1,12), L4 (4,11) (3,12); rechts spiegelbildlich R1 (12,5) (13,6) (14,7), R2 (11,7) (12,8) (13,9), R3 (11,10) (12,11) (13,12), R4 (10,11) (11,12).
* Sieben weiße Glitzersterne (255,255,255) rund um den Stein, im Bild fest eingezeichnet: X-Stern links oben (Mitte (2,1)), Kreuz oben (Mitte (7,1), hohl), großes Kreuz rechts oben
  (Mitte (11,3), Arme 2 px, hohl), Kreuz links (Mitte (2,5), hohl), großes Kreuz links unten (Mitte (3,16), Arme 2 px, hohl), X-Stern unten (Mitte (8,16)), Kreuz rechts unten (Mitte (12,15), hohl).
* Keine Augen, kein Schwanz, kein Mund.
Bleibt fest: Diamant (außer Lichtband), Körper, Hälse, Kristallfüße, Beinansätze.

Ablauf (84 Frames à 70 ms = 5,88 s) — Runde 2, Nutzerfeedback „die weißen Sparkle-Elemente sollten *viel länger* nicht zu sehen sein“. Edelstein: Glanz und Glitzer sind erlaubt (Regel 14), aber nur noch selten:
* Glitzer-Welle: nur EINMAL pro Schleife (Frames 12–22) läuft ein schmales Lichtband (3 Schrägzeilen breit, 3 Schrägzeilen je Frame, links oben → rechts unten, eine Stufe heller auf der Rampe der Quelle: B → D → E → Weiß) über
  Diamant und Kristallfüße, und die sieben weißen Glitzersterne blitzen genau dann auf, wenn das Band ihre Schrägzeile (x + y) erreicht: klein → groß → klein (Muster 1-2-1, je 3 Frames; große Kreuze: Arme 1 px → 2 px → 1 px; X-Sterne:
  Mittelpixel → Stern → Mittelpixel; kleine Kreuze an/aus). Sonst sind die Sterne UNSICHTBAR: in 73 von 84 Frames ist KEIN weißes Sparkle-Pixel zu sehen (11 Frames sichtbar, 73 unsichtbar = 6,6-mal so lange unsichtbar wie sichtbar;
  jeder einzelne Stern ist 3 Frames sichtbar, 81 Frames unsichtbar = 27-mal). Frame 0 hat deshalb keine Sterne (in Runde 1 standen sie fast immer, Frame 0 = Original mit allen Sternen).
* Beinspiel: die Spitze jedes der acht Beine schnippt für 3 Frames ein Pixel nach oben (bleibt am Nachbarpixel angewachsen), reihum L1 → R1 → L2 → … , jedes Bein dreimal pro Schleife (alle 28 Frames); es ist fast immer ein Bein in Bewegung.
* Kein Schweben mehr (Regel 18: Bodenwesen, die Spinne stand in Runde 1 beim „Atmen“ 1 px in der Luft): Diamant, Körper und Hälse bleiben fest.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel.
"""
import sys

import cv2
import numpy as np

import anim_lib as L

N, MS = 84, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 2, 2

spr = L.lade('diamond-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vorhanden = L.deckend(spr)

WEISS = (255, 255, 255)
sterne_maske = vorhanden & L.farbmaske(spr, [WEISS])
koerper_maske = vorhanden & ~sterne_maske
STEIN_RAMPE = {(44, 147, 156): (67, 224, 231), (67, 224, 231): (194, 249, 252), (166, 226, 227): (194, 249, 252), (194, 249, 252): WEISS}   # B→D→E→Weiß, I→E
STEIN = L.farbmaske(spr, list(STEIN_RAMPE))

# Sterne: Komponenten der weißen Pixel, Stufen 2 (voll) / 1 (inner) / 0 (aus)
_n, _lab = cv2.connectedComponents(sterne_maske.astype(np.uint8), connectivity=8)
STERNE = []
for _k in range(1, _n):
    ys, xs = np.nonzero(_lab == _k)
    pix = sorted(zip(xs.tolist(), ys.tolist()))
    cx, cy = (int(xs.min()) + int(xs.max())) // 2, (int(ys.min()) + int(ys.max())) // 2
    innen = [p for p in pix if max(abs(p[0] - cx), abs(p[1] - cy)) <= 1]
    if len(innen) == len(pix):
        innen = [(cx, cy)] if (cx, cy) in pix else pix
    STERNE.append(dict(mitte=(cx, cy), voll=pix, innen=innen))
STERNE.sort(key=lambda s: (s['mitte'][1], s['mitte'][0]))

# Glitzer-Welle (einmal pro Schleife): das Lichtband läuft ab T0 mit 3 Schrägzeilen je Frame von x + y = 2 bis 29; jeder Stern blitzt, wenn das Band seine Schrägzeile erreicht
T0, BAND_SCHRITT, BAND_BREITE = 12, 3, 1
STERN_MUSTER = (1, 2, 1)
STERN_START = [T0 + int(round((s['mitte'][0] + s['mitte'][1] - 2) / BAND_SCHRITT)) for s in STERNE]
BAND_FRAMES = 10

# Beine: (Spitze, ausgelenkte Position), Startframes je Bein (dreimal pro Schleife, alle 28 Frames; reihum)
BEINE = [((0, 7), (0, 6)), ((14, 7), (14, 6)), ((1, 9), (1, 8)), ((13, 9), (13, 8)),
         ((1, 12), (1, 11)), ((13, 12), (13, 11)), ((3, 12), (3, 11)), ((11, 12), (11, 11))]
BEIN_START = [[2 + 3 * j + 28 * k for k in range(3)] for j in range(len(BEINE))]
BEIN_DAUER = 3


def zustand(i):
    band = None
    if 0 <= i - T0 < BAND_FRAMES:
        band = 2 + BAND_SCHRITT * (i - T0)                          # Schrägzeile x + y der Bandmitte
    sterne = []
    for start in STERN_START:
        st = 0
        if 0 <= i - start < len(STERN_MUSTER):
            st = STERN_MUSTER[i - start]
        sterne.append(st)
    beine = [any(0 <= i - s < BEIN_DAUER for s in starts) for starts in BEIN_START]
    return band, sterne, beine


def frame(i, nur=None):
    band, sterne, beine = zustand(i)
    k, _ = L.trenne(spr, koerper_maske)
    k = L.platz(k, H, W, PAD_L, PAD_T)
    if band is not None and (nur is None or 'glanz' in nur):          # Lichtband = Glanz (Edelstein); beim Randpixel-Test (nur=…) ohne
        for y, x in zip(*np.nonzero(STEIN)):
            if abs(x + y - band) <= BAND_BREITE:
                c = tuple(int(v) for v in spr[y, x, :3])
                k[PAD_T + y, PAD_L + x, :3] = STEIN_RAMPE[c]
    for (tx, ty), (nx, ny) in [b for b, f in zip(BEINE, beine) if f]:
        k[PAD_T + ny, PAD_L + nx] = k[PAD_T + ty, PAD_L + tx]
        k[PAD_T + ty, PAD_L + tx] = 0
    stern = L.leer(H, W)
    for s, st in zip(STERNE, sterne):
        pix = s['voll'] if st == 2 else (s['innen'] if st == 1 else [])
        for (x, y) in pix:
            stern[PAD_T + y, PAD_L + x, :3] = WEISS
            stern[PAD_T + y, PAD_L + x, 3] = 255
    ebenen = {'koerper': k, 'sterne': stern}
    wahl = nur or ('koerper', 'sterne')
    wahl = [n for n in wahl if n != 'glanz']
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


TEST_EBENEN = ['koerper', 'sterne']                                   # ohne Lichtband (der Glanz färbt nur vorhandene Steinpixel heller)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    # Sichtbarkeit der weißen Sparkle-Elemente (Nutzerwunsch: 5–10-mal länger unsichtbar als sichtbar)
    sichtbar = [any(st for st in zustand(i)[1]) or (zustand(i)[0] is not None) for i in range(N)]
    nv = sum(sichtbar)
    print(f'Glitzer sichtbar (Sterne oder Lichtband) in {nv} von {N} Frames, unsichtbar in {N - nv} → Verhältnis unsichtbar : sichtbar = {(N - nv) / nv:.1f} : 1')
    assert 5 <= (N - nv) / nv <= 10
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('diamond-spider', 'Diamond Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/diamond-spider-strip.png', frames, spalten=14, scale=8)
