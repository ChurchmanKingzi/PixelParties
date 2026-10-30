# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug LOCUST“ (Creature) — Regeln 14/15/16 (Metall glänzt, Flügel nicht).

PICK: [["MotiveEgypt", 63, 1]]
Quelle: src/cybug-locust.png — Cyborg-Heuschrecke von der Seite (44×27 px, 18 Farben) aus MotiveEgypt.xcf, Ebene 63 („Ebene #131“), Figur 1; vollständig deckend (Alpha nur 255), nichts ging bei der Extraktion verloren.

Aufruf:   python3 cybug_locust.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cybug-locust.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Heuschrecke nach links gewandt, sprungbereit geduckt):
* Kopf (x 1–8, y 5–12) aus grauem Metall mit rotem Leuchtauge ((255,0,0)/(142,0,0) bei (4,6), (3,7), (4,7), (2,8), (3,8)); zwei rotbraune Fühler (129,41,19) (x 0–6, y 0–5).
* Rumpf und Hinterleib (x 1–39, y 7–22): graue Metallplatten (51,51,51)/(137,137,137)/(160,160,160)/(205,205,205)/(183,183,183), diagonale Schienen.
* Flügel (x 20–34, y 5–11): ein heller Flügel/Deckflügel (183,183,183)/(211,211,211)/(247,247,247)/(125,125,125)/(103,103,103), der über einem dunklen braunen Fenster liegt ((90,32,1)/(149,64,24)/(33,31,0), x 20–31, y 10–14).
* Beine: ein Vorderbein links unten (x 9–15, y 20–25) und das lange Hinterbein rechts (x 29–43, y 13–26), das als schräge Schienen im Rumpf endet.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag: achtmal pro Schleife (Periode 6); jede Flügelspalte (ab der Wurzel bei x = 21) wandert senkrecht, je weiter hinten desto mehr, Spitze etwa −4 … +4 px, hinkt nach (F.fluegel_welle,
  Zusammenhang erzwungen). ERGÄNZT (Regel 2): Unter dem Flügel liegt im Original der obere Rand des braunen Fensters (y 10–11, x 22–31). Er wird als Metallrand (51,51,51) + Braun (90,32,1)/(149,64,24) gezeichnet,
  damit nichts Hohles sichtbar wird, wenn sich der Flügel hebt.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12); Vorderfuß und Hinterfuß pendeln dazu mit Verzögerung seitlich (je tiefer, desto mehr, bis 2 px, Periode 24, nur Zeilen unterhalb ihrer Aufhängung).
* Glanz nur auf dem Metall (Regel 14): ein dezentes Lichtband (eine Stufe heller) läuft alle 24 Frames über die grauen Metallflächen von Kopf, Rumpf und Beinen. Flügel, Fenster und Fühler glänzen nicht.
* Das rote Leuchtauge schließt sich in den Frames 38–39 (Lid = graues Metall des Kopfes (160,160,160)). Keine Partikel.

Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Spaltenversatz (Flügel) und Fußpendel legen an den Rändern Innenfarbe frei → F.umranden setzt den Flügelrand (103,103,103) bzw. den Metallrand (51,51,51); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 12, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('cybug-locust')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

HELL = [(183, 183, 183), (211, 211, 211), (247, 247, 247), (125, 125, 125), (103, 103, 103)]
wing = vorhanden & L.farbmaske(spr, HELL) & (xx >= 20) & (xx <= 35) & (yy <= 11)
fuss_l = vorhanden & ~wing & (xx >= 9) & (xx <= 15) & (yy >= 20)
fuss_r = vorhanden & ~wing & (xx >= 37) & (yy >= 22)
koerper = vorhanden & ~wing & ~fuss_l & ~fuss_r
assert int((wing | fuss_l | fuss_r | koerper).sum()) == int(vorhanden.sum())

# Ergänzung unter dem Flügel: oberer Fensterrand (Zeile 10 Metallrand, Zeile 11 braun) — nur Farben des Sprites
METALLRAND, BRAUN, BRAUN_H = (51, 51, 51), (90, 32, 1), (149, 64, 24)
ERGAENZUNG = {}
for x in range(22, 32):
    ERGAENZUNG[(x, 10)] = METALLRAND
for x in range(22, 31):
    ERGAENZUNG[(x, 11)] = BRAUN_H if x in (24, 25) else BRAUN
ERGAENZUNG = {p: c for p, c in ERGAENZUNG.items() if wing[p[1], p[0]]}      # nur dort, wo im Original der Flügel davor liegt (Frame 0 bleibt Original)

AUGE = [(4, 6), (3, 7), (4, 7), (2, 8), (3, 8)]
LID = (160, 160, 160)
METALL = [(137, 137, 137), (160, 160, 160), (183, 183, 183), (205, 205, 205), (211, 211, 211)]
RAMPE = [(137, 137, 137), (160, 160, 160), (183, 183, 183), (205, 205, 205), (211, 211, 211), (247, 247, 247)]
metall_maske = L.farbmaske(spr, METALL) & koerper
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (103, 103, 103)


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 8)                                    # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                               # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    fl = F.ebene(spr, wing, H, W, PAD_L, PAD_T)
    fl_l = F.ebene(spr, fuss_l, H, W, PAD_L, PAD_T)
    fl_r = F.ebene(spr, fuss_r, H, W, PAD_L, PAD_T)
    F.setze(kp, PAD_L, PAD_T, ERGAENZUNG)                     # verdecktes Fenster ergänzen (liegt hinter dem Flügel)

    if i in (38, 39):                                         # Blinzeln: Lid = Metall des Kopfes
        F.setze(kp, PAD_L, PAD_T, {p: LID for p in AUGE})
    if effekte:                                                # Glanz nur auf dem Metall
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 4, 11, RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.8))

    fl = F.fluegel_welle(fl, PAD_L + 21, 3.8, ph, potenz=1.0, nur_rechts=True, lauf=0.12, zusammenhang=True)       # Spitze etwa −4 … +4 px
    fl_l = F.zeilen_pendel(fl_l, PAD_T + 19, 2.4, L.sinus(i, N / 2), 1.0, lauf=0.5)
    fl_r = F.zeilen_pendel(fl_r, PAD_T + 21, 2.4, L.sinus(i, N / 2) + math.pi, 1.0, lauf=0.5)

    kp, fl, fl_l, fl_r = (L.versetze(a, 0, bob) for a in (kp, fl, fl_l, fl_r))
    f = L.zusammen(H, W, [(kp, 0, 0), (fl_l, 0, 0), (fl_r, 0, 0), (fl, 0, 0)])
    F.umranden(f, [fl], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)         # Randpixel-Test (Regel 16)
    F.umranden(f, [fl_l, fl_r, kp], UMRISS, METALLRAND, METALLRAND, METALLRAND)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cybug-locust', 'Cybug LOCUST', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cybug-locust-strip.png', frames, spalten=8, scale=5)
