# -*- coding: utf-8 -*-
"""Idle-Animation für „Cats of the Pharaoh“ (Creature).

Quelle: src/cats-of-the-pharaoh.png — eine der fünf grauen Katzen der Karte (16×13 px, 6 Farben) aus MotiveEgypt.xcf, Ebene 112 „Ebene #61“, Figur 3.
Die Ebene enthält vier Katzen (zwei von vorn sitzend 10×13, zwei im Profil 16×13), eine fünfte (von vorn) liegt in Ebene 151 „Ebene #63“; sie entsprechen den fünf Katzen
der Kartenkunst (data/card-art/native/Cats_of_the_Pharaoh.png: oben links von vorn, rechts nach links, links unten nach rechts, unten von vorn, eine vor dem Pharao).
Gewählt: die Profil-Katze, die auf der Karte links unten nach RECHTS schaut (Kopf rechts oben, Schwanz links, mit der Kartenkunst Pixel für Pixel abgeglichen) — sie hat als
einzige sichtbare Schwanz, Ohr, Rücken und beide Beinpaare; die Vorderansichten sind nur ~10 px breit und haben nichts Bewegliches.
PICK: [["MotiveEgypt", 112, 3]]   (Figur 3 der Ebene, bbox 16×13)

Aufruf:   python3 cats_of_the_pharaoh.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cats-of-the-pharaoh.png + .json

Identifikation (Sprite 16×13, graue Tabby-Katze im Profil, schaut nach rechts):
* Ohr (Zeilen 0–1): Spitze (12,0), darunter (11–13,1) — das einzige sichtbare Ohr, schwarzer Umriss A.
* Kopf (x 9–15, Zeilen 2–7): grau gestreift (B/C/D); die Stirnstufe (13–14,4) und (13,5) ist Umriss, Schnäuzchen (14,5)–(15,6); ein helles Pixel E (12,6) (Wange/Kinn).
  Es sind KEINE Augen gezeichnet (das schwarze Pixel (13,5) ist Umriss zwischen Stirn und Schnäuzchen) → kein Blinzeln, kein Blick.
* Rumpf (x 3–14, Zeilen 6–10): Rückenlinie (4–9,6), graue Streifen B/C, dunkler Fleck F (10–11,8) an der Brust, Bauchlinie (7–9,10).
* Schwanz (x 0–3, Zeilen 5–7): kurze waagerechte Röhre — Umriss oben (1–3,5), Fell (0–3,6) mit hellerer Spitze, Umriss unten (1–2,7) — setzt an der Hüfte (3,7) an.
* Beine: hinten (x 3–6, Zeilen 10–12), vorn (x 9–12, Zeilen 10–12).
* Kein Glanz (Fell, Regel 14); keine Partikel.
Bleibt fest: Kopf-/Rumpfmuster, hinteres Beinpaar.

Ablauf (48 Frames à 70 ms = 3,4 s), alle Bewegungen unabhängig:
* Schwanzwedeln (Periode 16, 3× pro Schleife, Hub wächst zur Mitte der Schleife von ±1 auf ±2 px): die drei Schwanzspalten links des Ansatzes (x 0–2) wandern senkrecht,
  je weiter vom Körper desto mehr; die Spalte am Ansatz (x 3) und die Hüfte bleiben stehen. Die äußerste Spalte bekommt den Anteil ihrer Nachbarin (Spitze bleibt am Schwanz hängen).
* Kopf hebt sich (Periode 24, Frames 6–17): Scheitel und Ohr steigen 1 px — in den Kopfspalten x ≥ 9 wird die Zeile 2 (Ohransatz) einmal eingefügt (anim_tiere.spalten_hub);
  da dort nur die vier Spalten x 10–13 Pixel haben, wächst nur der Ohransatz um 1 px, das Ohr geht mit. Gesicht, Hals, Rumpf, Hüfte, Bauch und Beine bleiben unverändert — die Rumpfhöhe ist in
  jedem Frame gleich (6 px an der Hüfte), die Silhouette bleibt die der Original-Katze. Die Bauchzeile wird NICHT verdoppelt (frühere Fassung machte den Rumpf zum Block, verworfen).
* Ohrzucken (Frames 5–7, 29–31 und 41–42): die zwei Ohrzeilen kippen 1 px nach hinten (links).
* Vorderpfote hebt sich (Frames 14–17 und 38–40): die Vorderbeinzeile 10 entfällt, die Pfote zieht 1 px nach oben (heben_unten); die Hinterbeine bleiben.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16, anim_tiere.umriss_schliessen: wo der Schwanz von der Hüfte wegrückt, bekommt die freigelegte Hüftkante einen Umrisspixel);
die eingefügte Ohransatz-Zeile beim Kopfheben (Zeile 2, Spalten x 10–13 — Duplikat vorhandener Pixel). Sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 2

spr = L.lade('cats-of-the-pharaoh')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (yy <= 1) & (xx >= 11)                                       # (12,0), (11–13,1)
schwanz = vorhanden & (((xx <= 3) & (yy <= 6)) | ((xx <= 2) & (yy == 7)))     # Spalte x = 3 (3,5) (3,6) steht fest (Ansatz)
pfote = vorhanden & (xx >= 9) & (yy >= 10)                                     # Vorderbein
koerper = vorhanden & ~ohr & ~schwanz & ~pfote

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

ATEM_ZEILE = 2                                                                 # Zeile, die in den Kopfspalten (x ≥ 9) eingefügt wird (Ohransatz)
ATMEN = [0] * 6 + [1] * 12 + [0] * 6                                           # Periode 24
OHR = {5, 6, 7, 29, 30, 31, 41, 42}
PFOTE = {14, 15, 16, 17, 38, 39, 40}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                                     # sofort auf die volle Leinwand


def biegen(a, pivot, amp, phase):
    """Wie L.spalten_welle (Spalte wandert um round(amp · sin(phase) · Abstandsanteil)), aber die äußerste Spalte bekommt den Anteil ihrer Nachbarspalte:
    das einzelne Spitzenpixel bliebe sonst bei einem Rundungsunterschied nur diagonal am Schwanz hängen."""
    out = L.leer(*a.shape[:2])
    h = a.shape[0]
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    maxd = max(abs(x - pivot) for x in cols)
    for x in cols:
        dy = int(round(amp * math.sin(phase) * min(abs(x - pivot), maxd - 1) / maxd))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def frame(i, nur=None):
    atmen = ATMEN[i % 24]
    amp = 1.6 + 0.8 * (0.5 - 0.5 * math.cos(2 * math.pi * i / N))               # Hub ±1 … ±2 px, nahtlos
    k = T.spalten_hub(teil(koerper), PAD_T + ATEM_ZEILE, lambda x: atmen if x >= PAD_L + 9 else 0)   # nur Scheitel/Ohr (Kopfspalten) heben sich 1 px; Rumpf bleibt
    o = teil(ohr)
    if i in OHR:
        o = T.zucken_zeilen(o, PAD_T + 2, -1.0, {PAD_T + 0: 1.0, PAD_T + 1: 1.0})
    s = biegen(teil(schwanz), PAD_L + 3, amp, L.sinus(i, 16))
    p = teil(pfote)
    if i in PFOTE:
        p = L.heben_unten(p, PAD_T + 10, 1)
    ebenen = {'koerper': (k, 0), 'ohr': (o, -atmen), 'schwanz': (s, 0), 'pfote': (p, 0)}
    wahl = nur or ('koerper', 'ohr', 'schwanz', 'pfote')
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                              # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cats-of-the-pharaoh', 'Cats of the Pharaoh', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cats-of-the-pharaoh-strip.png', frames, spalten=12, scale=8)
