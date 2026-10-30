# -*- coding: utf-8 -*-
"""Idle-Animation für „Shroomasaur“ (Creature).

Quelle: src/shroomasaur.png — der blau-violette Saurier mit offenem Maul (53×33 px, 31 Farben, 676 px) aus der Ebene 549 „Shroomasaur“ von MotiveGrailWar.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Shroomasaur.png: Mitte, vor dem Baumstamm; Pixel für Pixel gleich) abgeglichen. Die roten/gelben und blauen Blumen am Boden vor seinen Füßen sind andere Ebenen (Beiwerk, nicht
Teil der Figur).
PICK: [["MotiveGrailWar", 549, 1]]

Aufruf:   python3 shroomasaur.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shroomasaur.png + .json

Identifikation (Sprite 53×33, Saurier im Profil, schaut nach RECHTS):
* Kopf (x 33–52, Zeilen 0–16): hellblau (B/F/M) mit dunkelblauem Umriss A (65,117,139); zwei rosa Hörner (41–42, 0–2) und (46–47, 0–2); zwei dunkle Pixel c (45,5) und (49,5) — das hintere ist das Auge,
  das vordere die Nase (Annahme: Auge bei 60 % der Kopflänge). Offenes Maul: oben Oberkiefer (Zeilen 6–7) mit weißen Zähnen Q (40,8) (43,8) (46,8–9) (49,8–9) und violettem Gaumen O; unten Unterkiefer
  (x 39–52, Zeilen 10–16, schräg nach unten rechts) mit Zähnen (40,10) (43,11) (45,11) (47,12) (49,12). Zwischen den Kiefern ist Luft (transparent).
* Körper (x 20–32, Zeilen 7–22): violett/lavendel (E/L/N/G), Rückenlinie H (dunkelgraue Umrisse); vorn ein blauer Arm mit Krallen (x 30–39, Zeilen 13–21).
* Schwanz (x 0–19, Zeilen 12–20): lang, nach links, lavendel/rosa (C/G/P) mit dunklem Umriss H.
* Beine: hinten lavendel (x 17–25, Zeilen 17–32), vorn blau (x 25–32, Zeilen 21–31).
* Rückenaufsätze: kleiner blaugrüner Pilzspross (21–23, 7–10) (Kreuzform R/S/V) und rosa Stacheln (26–27, 9–10) (29–31, 8–9).
* Kein Glanz (Haut/Fell, Regel 14), keine Partikel (im Zweifel weglassen; Sporen wären nur 1-px-Punkte).
Bleibt fest: Beine/Füße, Körper-/Kopfmuster.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Brüllen (Periode 24, 2× pro Schleife): der Unterkiefer wandert spaltenweise senkrecht, je weiter vom Kiefergelenk (x = 39) desto mehr (Kinnspitze bis +3 px, beim Schließen bis −1 px);
  die Zähne gehen mit. Das Maul ist hinten offen (Luft), es muss nichts ergänzt werden.
* Atmen/Heben (Periode 24, Frames 6–17): Kopf, Rumpf und Schwanzansatz heben sich 1 px — Zeile 21 (Beinansatz) wird einmal eingefügt (die Beine werden 1 px länger, nichts wird zum Block).
* Schwanz schlägt (Periode 16, 3× pro Schleife): die Schwanzspalten (x ≤ 17) wandern senkrecht, je weiter vom Körper desto mehr (Spitze ca. ±3 px); der Ansatz bleibt.
* Pilzsprosse wiegen (Periode 12, 4× pro Schleife): die Zeilen 7–9 des Sprosses und der Stacheln wandern waagerecht um höchstens 1 px (Zeile 10 bleibt).
* Hörner zucken (Frames 12–14 und 36–38): die Hornzeilen 0–1 kippen 1 px nach hinten.
* Blinzeln (Frames 18–20 und 42–44): das Augenpixel (45,5) wird kurz zur Gesichtsfarbe (Lid = Körperfarbe).
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16) und die eingefügte Beinzeile beim Heben (Duplikat vorhandener Pixel); sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 4

spr = L.lade('shroomasaur')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

FARBEN_SPROSS = [(77, 149, 181), (43, 103, 125), (25, 134, 178), (208, 165, 215), (161, 112, 167), (203, 167, 207), (120, 98, 124)]   # V R S W X a d
kiefer = vorhanden & (xx >= 40) & (yy >= 10) & (yy <= 16)
schwanz = vorhanden & (xx <= 17) & (yy >= 12) & (yy <= 21)
spross = vorhanden & L.farbmaske(spr, FARBEN_SPROSS) & (xx <= 31) & (yy >= 7) & (yy <= 9)
horn = vorhanden & (xx >= 41) & (yy <= 1)
koerper = vorhanden & ~kiefer & ~schwanz & ~spross & ~horn

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

GESICHT = (131, 194, 228)                                        # F
AUGE = (45, 5)
HEBEN = [0] * 6 + [1] * 12 + [0] * 6                             # Periode 24
HORN = {12, 13, 14, 36, 37, 38}
BLINK = {18, 19, 20, 42, 43, 44}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def kiefer_biegen(a, pivot, amp, phase):
    """Unterkiefer: Spalte x wandert um round(amp · sin · (x − pivot)/größter Abstand), nach oben (Schließen) höchstens 1 px."""
    out = L.leer(*a.shape[:2])
    h = a.shape[0]
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    maxd = max(x - pivot for x in cols)
    v = math.sin(phase)
    for x in cols:
        dy = int(round(amp * v * (min(x - pivot, maxd - 1) / float(maxd))))
        dy = max(-1, dy)
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def frame(i, nur=None):
    heben = HEBEN[i % 24]
    k = teil(koerper)
    if i in BLINK:
        setze(k, AUGE[0], AUGE[1], GESICHT)
    k = L.streck_zeile(k, PAD_T + 21, heben)                       # Beinansatz verlängern → Oberkörper hebt sich, Füße bleiben
    kf = kiefer_biegen(teil(kiefer), PAD_L + 39, 3.0, L.sinus(i, 24))
    sw_ = T.biegen_spalten(teil(schwanz), PAD_L + 18, 3.2, L.sinus(i, 16))
    sp = T.scherung_zeilen(teil(spross), PAD_T + 7, PAD_T + 9, PAD_T + 10, 1.4, math.sin(L.sinus(i, 12)))
    ho = teil(horn)
    if i in HORN:
        ho = L.versetze(ho, -1, 0)
    ebenen = {'koerper': (k, 0), 'kiefer': (kf, -heben), 'schwanz': (sw_, -heben), 'spross': (sp, -heben), 'horn': (ho, -heben)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('shroomasaur', 'Shroomasaur', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shroomasaur-strip.png', frames, spalten=12, scale=5)
