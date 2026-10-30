# -*- coding: utf-8 -*-
"""Idle-Animation für „Infected Squirrel“ (Creature).

Quelle: src/infected-squirrel.png — das Eichhörnchen (25×19 px, 14 Farben) der Ebene 430 „Eichhörnchen“ aus MotiveGN.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Infected_Squirrel.png, Mitte der Karte, Pixel für Pixel gleich) abgeglichen. Die blauen Spore-Pünktchen der Karte stehen auf einer anderen Ebene (429) und
gehören nicht zur Figur; die dünnen dunklen Fäden (siehe unten) sind Teil dieser Ebene und hängen am Tier.
PICK: [["MotiveGN", 430, 1]]

Aufruf:   python3 infected_squirrel.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/infected-squirrel.png + .json

Identifikation (Sprite 25×19, orangebraunes Eichhörnchen im Profil, schaut nach RECHTS, mit blauen Infektionsflecken und dünnen Fäden):
* Fell: orange I/F/H, dunkelbraun D/J (Schatten), Umriss dunkelnavy A (13,16,49) / C (8,10,32); blaue Infektionsflecken E (77,137,154) / G (51,93,119) auf Schwanz, Rücken, Ohr und Kopf.
* Schwanz (x 1–6, Zeilen 8–12): buschig links hinten, nach oben-links gekrümmt, durch die Naht (5–6,10) vom Rumpf abgesetzt.
* Rumpf (x 7–17, Zeilen 8–16): Rücken (Zeile 10 von x 1 bis 22 durchlaufend), Hinterkeule (9–14, 11–16) mit Pfote K/L (12–13,14) hellrosa, Vorderbein (16–20, 12–16) mit Pfote (15,13) (16,14).
* Kopf (x 17–24, Zeilen 7–13): Ohr (17–20, 7–8) mit blauem Fleck, Auge = weißer Glanzpunkt M (21,10) neben E (20,10), Nase = schwarzes N (23,11) an der Schnauzenspitze.
* Fäden (1 px, wellig): S1 (dunkelrot B) vom Schwanz nach oben-links (4,0)…(5,7); S5 (navy C) vom Schwanzansatz nach unten-links (6,13)…(3,15); S2 (C) (13,2)…(14,9), S3 (B) (17,2)…(17,9),
  S4 (B) (22,2)…(22,9) steigen vom Rücken/Kopf nach oben (≈ 7 px); S6 (C) hängt zwischen den Beinen nach unten (16,13)…(16,18). Sie sind Teil der Kunst (Infektion/Parasitenfäden).
* Kein Glanz (Fell, Regel 14; das weiße Pixel ist ein Augenglanz im Fell, keine Metall-/Edelsteinfläche) — bleibt fest. Keine Partikel.
Bleibt fest: Kopfmuster (Auge, Nase), Beine/Pfoten, Infektionsflecken. Keine Blinzel-/Blickbewegung (Auge nicht eindeutig lesbar).

Ablauf (48 Frames à 70 ms = 3,4 s), alle Bewegungen unabhängig:
* Schwanzwippen (Periode 16, 3× pro Schleife): die Schwanzspalten links der Naht (x 0–5) wandern senkrecht, je weiter außen desto mehr (bis ±2 px); die beiden Fäden S1/S5 am Schwanz
  gehen mit derselben Spaltenverschiebung mit.
* Hüpfer (Periode 24, 2× pro Schleife): das ganze Tier (mit allen Fäden) hebt 1–2 px ab und landet wieder; kurzes „Zucken“ des Eichhörnchens.
* Fäden wiegen (je ein Fenster von 18–20 Frames, 1,5 Schwingungen, Hüllkurve sin(πu); S2 ab Frame 2, S3 ab 14, S4 ab 26, S6 ab 28): die Fäden S2/S3/S4 pendeln oben bis ±2 px seitlich
  (der Ansatz am Körper bleibt), S6 unten; eine Laufwelle (Phasenverzug zur Spitze) lässt sie wellen. Reißt die Kette durch den Versatz auf, wird ein Pixel in Fadenfarbe nachgezogen (siehe unten).
* Ohrzucken (Frames 10–12 und 30–32): die oberste Ohrzeile (17–19, 7) kippt 1 px nach vorn (rechts).
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16) und Verbindungspixel in Fadenfarbe, wo die Fäden durch das Wiegen sonst abreißen würden (je Frame 0–3 Pixel).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 3, 5, 2

spr = L.lade('infected-squirrel')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# Fäden: Kette von (x, y), der Ansatz am Körper steht VORNE (Gewicht 0), die freie Spitze zuletzt
S1 = [(5, 7), (4, 7), (3, 6), (2, 5), (1, 5), (0, 4), (1, 3), (2, 2), (3, 1), (4, 0)]
S5 = [(6, 13), (5, 13), (4, 14), (3, 15)]
S2 = [(14, 9), (13, 8), (12, 7), (11, 6), (12, 5), (12, 4), (13, 3), (13, 2)]
S3 = [(17, 9), (16, 8), (15, 7), (15, 6), (16, 5), (16, 4), (17, 3), (17, 2)]
S4 = [(22, 9), (23, 8), (24, 7), (24, 6), (23, 5), (23, 4), (22, 3), (22, 2)]
S6 = [(16, 13), (15, 14), (15, 15), (14, 16), (15, 17), (16, 18)]
FAEDEN = {'S1': S1, 'S5': S5, 'S2': S2, 'S3': S3, 'S4': S4, 'S6': S6}
ALLE = {p for k in FAEDEN.values() for p in k}
for (x, y) in ALLE:
    assert vorhanden[y, x], (x, y)
faden_m = np.zeros((sh, sw), bool)
for (x, y) in ALLE:
    faden_m[y, x] = True

ohr = vorhanden & (yy == 7) & (xx >= 17) & (xx <= 19)
schwanz = vorhanden & ~faden_m & (xx <= 5)
koerper = vorhanden & ~faden_m & ~schwanz & ~ohr

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HUEPFER = [0, 0, 0, 0, 1, 2, 2, 1, 0] + [0] * 15                        # Periode 24
FENSTER = {'S2': (2, 20), 'S3': (14, 20), 'S4': (26, 20), 'S6': (28, 18)}   # (Start, Länge) in Frames
OHR = {10, 11, 12, 30, 31, 32}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def schwanz_dy(x, amp, ph):
    """Spaltenhub des Schwanzes: Naht bei x = 6, je weiter links desto mehr; äußerste Spalte nimmt den Anteil der Nachbarin."""
    return int(round(amp * math.sin(ph) * min(6 - x, 5) / 6.0))


def linie(k, a, b, farbe):
    """Pixel zwischen a und b (Bresenham), Endpunkte ausgenommen."""
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    for s in range(1, n):
        x = int(round(x0 + (x1 - x0) * s / n))
        y = int(round(y0 + (y1 - y0) * s / n))
        k[y, x, :3] = farbe
        k[y, x, 3] = 255


def kette(pix, versatz, dy_all):
    """Faden zeichnen: pix = Kette in Sprite-Koordinaten, versatz[i] = (dx, dy) je Pixel, dy_all = Versatz des ganzen Tiers.
    Abgerissene Stellen (Abstand > 1 px zum Vorgänger) werden mit Pixeln in Fadenfarbe überbrückt."""
    k = L.leer(H, W)
    pos = []
    for (x, y), (dx, dy) in zip(pix, versatz):
        px, py = PAD_L + x + dx, PAD_T + y + dy + dy_all
        if not (0 <= px < W and 0 <= py < H):
            raise L.ClipError(f'Fadenpixel ({px},{py}) außerhalb der Leinwand')
        k[py, px] = spr[y, x]
        pos.append((px, py))
    for i in range(1, len(pos)):
        (ax, ay), (bx, by) = pos[i - 1], pos[i]
        if max(abs(ax - bx), abs(ay - by)) > 1:
            linie(k, pos[i - 1], pos[i], tuple(int(v) for v in spr[pix[i][1], pix[i][0], :3]))
    return k


def wiegen(i, name, pix):
    """Seitliches Pendeln eines hängenden Fadens, nur im Fenster; Ansatz fest, Spitze bis ±2 px, Laufwelle zur Spitze."""
    start, laenge = FENSTER[name]
    u = ((i - start) % N) / float(laenge)
    if u >= 1.0:
        return [(0, 0)] * len(pix)
    env = math.sin(math.pi * u)
    ya = pix[0][1]
    maxd = max(1, max(abs(y - ya) for _, y in pix))
    out = []
    for (x, y) in pix:
        w = abs(y - ya) / float(maxd)
        dx = int(round(1.9 * w * env * math.sin(2 * math.pi * 1.5 * u - 1.1 * w)))
        out.append((dx, 0))
    return out


def frame(i, nur=None):
    hub = HUEPFER[i % 24]
    amp = 1.8 + 0.6 * (0.5 - 0.5 * math.cos(2 * math.pi * i / N))        # Hub des Schwanzes ±1,8 … ±2,4
    ph = L.sinus(i, 16)
    ebenen = {}
    ebenen['koerper'] = teil(koerper)
    o = teil(ohr)
    if i in OHR:
        o = L.versetze(o, 1, 0)
    ebenen['ohr'] = o
    sw_ = L.leer(H, W)
    t = teil(schwanz)
    cols = [x for x in range(W) if t[:, x, 3].any()]
    for x in cols:
        dy = schwanz_dy(x - PAD_L, amp, ph)
        for y in np.nonzero(t[:, x, 3])[0]:
            ny = y + dy
            if not 0 <= ny < H:
                raise L.ClipError(f'Schwanzspalte {x} würde aus der Leinwand geschoben')
            sw_[ny, x] = t[y, x]
    ebenen['schwanz'] = sw_
    for name in ('S1', 'S5'):                                     # Schwanzfäden: gleiche Spaltenverschiebung wie der Schwanz
        pix = FAEDEN[name]
        ebenen[name] = kette(pix, [(0, schwanz_dy(x, amp, ph)) for (x, y) in pix], 0)
    for name in ('S2', 'S3', 'S4', 'S6'):
        pix = FAEDEN[name]
        ebenen[name] = kette(pix, wiegen(i, name, pix), 0)
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, -hub) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('infected-squirrel', 'Infected Squirrel', frames, MS, prev)
    if prev:
        L.streifen(prev + '/infected-squirrel-strip.png', frames, spalten=12, scale=6)
