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

RUNDE 3 (Nutzerfeedback: „darf sich gerne ein bisschen herumbewegen und laufen, die Beine sollten sich dabei etwas mehr bewegen“):
* Die Spinne läuft kleine Strecken (ganzzahlig, ±2 px waagerecht, 1 px nach oben/unten; Schleife kehrt zur Startlage zurück): Frames 26–35 nach rechts (2 Schritte), 38 ein Schritt „vorwärts“ (oben),
  40–52 nach links (4 Schritte), 55 zurück nach unten, 58–61 wieder zur Mitte; Frames 12–22 (Glitzerwelle) und der Rest stehen still. Diamant, Körper, Hälse, Kristallfüße und die Sterne wandern als EINE starre Ebene mit.
* Beine (acht, je mit Pfad Wurzel → Spitze, anim_spinne-Stil: Gelenke verschoben, dazwischen 8er-Linie, Wurzel bleibt am Körper): Tetrapod-Gang — Gruppe A (L1, R2, L3, R4) und B (R1, L2, R3, L4) schwingen
  gegenphasig; die Spitze schwingt bis ±2 px entlang der Körperachse (L4/R4 ±1) und hebt sich dabei 1–2 px zum Körper hin. Beim Laufen Periode 6 Frames, im Stand langsam (Periode 12, je Bein versetzt) — die Beine sind
  immer in Bewegung (vorher: ein 1-px-Schnipp alle 28 Frames).
RUNDE 4 (Nutzerfeedback: „sollte nicht so lange an einem Punkt stillstehen“): der Laufweg füllt jetzt die ganze Schleife (siehe SCHRITTE: Runde ±3 px waagerecht, ±1 px senkrecht, 22 Schritte), die Pausen
sind höchstens 5 Frames lang (vorher 48 Frames Stillstand am Stück); die Glitzerwelle (Frames 12–22) läuft während des Gehens mit.
Ergänzungen: zwei verdeckte Beinwurzeln (3,5) in (31,32,30) und (11,5) in (40,41,39): im Bild liegen dort die Arme der weißen Sterne (die Beine L1/R1 hängen sonst nur diagonal-lückig am Körper, wenn die Sterne
unsichtbar sind); die Sterne liegen weiter darüber.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_spinne as SP

N, MS = 84, 70
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 7, 7

spr = L.lade('diamond-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vorhanden = L.deckend(spr)

WEISS = (255, 255, 255)
sterne_maske = vorhanden & L.farbmaske(spr, [WEISS])
LEGS_MASKE = np.zeros(spr.shape[:2], bool)
for _p in ({'L1': [(2, 5), (1, 6), (0, 7)], 'L2': [(3, 7), (2, 8), (1, 9)], 'L3': [(3, 10), (2, 11), (1, 12)], 'L4': [(4, 11), (3, 12)],
            'R1': [(12, 5), (13, 6), (14, 7)], 'R2': [(11, 7), (12, 8), (13, 9)], 'R3': [(11, 10), (12, 11), (13, 12)], 'R4': [(10, 11), (11, 12)]}).values():
    for _x, _y in _p:
        LEGS_MASKE[_y, _x] = True
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

# Beine (Runde 3): Pfade Wurzel → Spitze (Sprite-Koordinaten). Die Wurzeln (3,5) und (11,5) liegen im Original unter den Armen der weißen Sterne (siehe Ergänzungen).
BEIN_PFADE = {'L1': [(3, 5), (2, 5), (1, 6), (0, 7)], 'L2': [(3, 7), (2, 8), (1, 9)], 'L3': [(3, 10), (2, 11), (1, 12)], 'L4': [(4, 11), (3, 12)],
              'R1': [(11, 5), (12, 5), (13, 6), (14, 7)], 'R2': [(11, 7), (12, 8), (13, 9)], 'R3': [(11, 10), (12, 11), (13, 12)], 'R4': [(10, 11), (11, 12)]}
ERGAENZT = {(3, 5): (31, 32, 30), (11, 5): (40, 41, 39)}
SEITE = {k: (-1 if k[0] == 'L' else 1) for k in BEIN_PFADE}
ORDNUNG = {'L1': 0, 'L2': 1, 'L3': 2, 'L4': 3, 'R1': 0, 'R2': 1, 'R3': 2, 'R4': 3}                # Reihenfolge von vorn (oben) nach hinten (unten): die Schrittwelle läuft über die Beine
# Schrittzyklus (Runde 3, überarbeitet): jedes Bein schiebt sich außer der Wurzel um dy (−1 nach vorn/oben, +1 zurück) — als STARRE Kette (Diagonale bleibt Diagonale, kein Verzerren), die Wurzel bleibt am
# Körper und wird per Linie mit dem verschobenen Rest verbunden; die Fußspitze der drei-/vierteiligen Beine schwingt dabei einen Pixel weiter (ein Knick wie ein Knie).
SCHRITT = [1, 0, -1, -1, 0, 1]
STAND = [0, 0, -1, -1, 0, 1, 0]                                                                  # Stand: 7 Posen à 3 Frames (84 = 4 · 21: nahtlos); alle Beine bei i = 0 in Ruhe → Frame 0 = Original
STAND_START = {'L1': 0, 'L2': 1, 'L3': 4, 'L4': 6, 'R1': 4, 'R2': 0, 'R3': 6, 'R4': 1}                  # Phase je Bein


# Laufweg (Körperversatz in Sprite-Pixeln): (Frame, x, y)-Haltepunkte, dazwischen springt der Versatz (ein Schritt = 1 px)
# Runde 4 (Nutzerfeedback: „sollte nicht so lange an einem Punkt stillstehen“): vorher stand die Spinne 48 Frames am Stück (Frames 62–25). Jetzt läuft sie fast die ganze Schleife in einer Runde umher
# (±3 px waagerecht, ±1 px senkrecht, ein Schritt alle 3–4 Frames) und hält nur noch kurz an (höchstens 5 Frames ≈ 0,35 s am selben Punkt).
SCHRITTE = [(3, 1, 0), (6, 2, 0), (9, 3, 0), (15, 3, -1), (18, 2, -1), (21, 1, -1), (24, 0, -1), (27, -1, -1), (33, -1, 0), (36, -2, 0), (39, -3, 0),
            (45, -3, 1), (48, -2, 1), (51, -1, 1), (54, 0, 1), (57, 1, 1), (60, 2, 1), (66, 2, 0), (70, 1, 0), (74, 0, 0), (79, 0, -1), (82, 0, 0)]
LAUF_FENSTER = [(1, 10), (13, 28), (31, 40), (43, 61), (64, 75), (77, 83)]                  # Frames, in denen die Beine laufen (Periode 6)


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
    return band, sterne, None


def versatz(i):
    x = y = 0
    for f, sx, sy in SCHRITTE:
        if i >= f:
            x, y = sx, sy
    return x, y


def laeuft(i):
    return any(a <= i <= b for a, b in LAUF_FENSTER)


def bein_zeichnen(ebene, name, i, ox, oy):
    pfad = BEIN_PFADE[name]
    n = len(pfad)
    if laeuft(i):
        dy = SCHRITT[(i + (3 if name[0] == 'R' else 0)) % len(SCHRITT)]                    # links/rechts gegenphasig, alle Beine einer Seite im Gleichtakt (kein Überkreuzen)
    else:
        dy = STAND[(i // 3 + STAND_START[name]) % len(STAND)]
    pos = []
    for j, (x, y) in enumerate(pfad):
        extra = dy if (j == n - 1 and n >= 3 and dy < 0) else 0                         # Fußspitze schwingt nach vorn noch einen Pixel weiter (Knie); nach hinten nicht (sonst verkleben benachbarte Beine)
        pos.append((x + ox, y + oy + (0 if j == 0 else dy) + extra))
    for j, (x, y) in enumerate(pfad):
        c = ERGAENZT.get((x, y)) or tuple(int(v) for v in spr[y, x, :3])
        pix = [pos[0]] if j == 0 else SP.linie(pos[j - 1], pos[j])[1:]
        for (px, py) in pix:
            ebene[PAD_T + py, PAD_L + px, :3] = c
            ebene[PAD_T + py, PAD_L + px, 3] = 255
    return ebene


def frame(i, nur=None):
    band, sterne, _ = zustand(i)
    ox, oy = versatz(i)
    k, _ = L.trenne(spr, koerper_maske & ~LEGS_MASKE)
    k = L.platz(k, H, W, PAD_L, PAD_T)
    if band is not None and (nur is None or 'glanz' in nur):          # Lichtband = Glanz (Edelstein); beim Randpixel-Test (nur=…) ohne
        for y, x in zip(*np.nonzero(STEIN)):
            if abs(x + y - band) <= BAND_BREITE:
                c = tuple(int(v) for v in spr[y, x, :3])
                k[PAD_T + y, PAD_L + x, :3] = STEIN_RAMPE[c]
    k = L.versetze(k, ox, oy)
    beine = L.leer(H, W)
    for nm in BEIN_PFADE:
        bein_zeichnen(beine, nm, i, ox, oy)
    stern = L.leer(H, W)
    for s, st in zip(STERNE, sterne):
        pix = s['voll'] if st == 2 else (s['innen'] if st == 1 else [])
        for (x, y) in pix:
            stern[PAD_T + y + oy, PAD_L + x + ox, :3] = WEISS
            stern[PAD_T + y + oy, PAD_L + x + ox, 3] = 255
    ebenen = {'beine': beine, 'koerper': k, 'sterne': stern}
    wahl = nur or ('beine', 'koerper', 'sterne')
    wahl = [n for n in wahl if n != 'glanz']
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl if n in ebenen])


TEST_EBENEN = ['beine', 'koerper', 'sterne']                                   # ohne Lichtband (der Glanz färbt nur vorhandene Steinpixel heller)


def zuschneiden(frames):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 2 px freier Rand (Regel 27/41)."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = int(xs.min()) - 2, int(xs.max()) + 2, int(ys.min()) - 2, int(ys.max()) + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = zuschneiden([frame(i) for i in range(N)])
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
