# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug BEE“ (Creature) — Regeln 14/15/16 (Metall glänzt, Chitin nicht).

PICK: [["Motive", 399, 1]]
Quelle: src/cybug-bee.png — Cyborg-Biene von oben (68×48 px, 24 Farben) aus Motive.xcf, Ebene 399 („Cybug BEE“), Figur 1; vollständig deckend (Alpha nur 255), nichts ging bei der Extraktion verloren.

Aufruf:   python3 cybug_bee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cybug-bee.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 33,5):
* Flügel: je ein großes grünes Vorderflügel-Paneel (links x 0–27, y 0–21, rechts x 40–67) und ein kleineres Hinterflügel-Paneel darunter (x 6–25, y 22–29 bzw. gespiegelt) im Platinen-Stil:
  Füllung (13,91,5)/(14,75,5), helle Leiterbahnen (0,126,9), dunkler Rand (9,41,0), weiße Knoten (253,239,252) an den Ecken.
* Kopf (x 29–38, y 10–21): graues Metall (51,51,51)/(137,137,137)/(160,160,160)/(205,205,205) mit zwei roten Leuchtaugen (x 30–31 und 36–37, y 13–17: (150,0,0)/(255,0,0)).
* Fühler (rotbraun (129,41,19)): zwei geschwungene Linien (x 23–30 und 37–44, y 6–12).
* Rumpf und Hinterleib (x 24–43, y 22–47): graue Metallsegmente mit bernsteinfarbenen Honigfenstern ((90,57,32)/(157,106,55)/(233,157,82)), gelbe Lampen (255,201,0) bei (34,29–30), (35,30), (33–34,35–36),
  rote Lampen rechts ((47,0,0)/(192,0,0)/(145,0,0)), blaue Anzeige links (15,29,76); der Stachel (x 33–34, y 44–47) ist dunkelgrau.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: sechsmal pro Schleife (Periode 8); jede Flügelspalte (Vorder- und Hinterflügel gemeinsam) wandert senkrecht, je weiter außen desto mehr, Spitze etwa −6 … +7 px, hinkt nach
  (F.fluegel_welle, Zusammenhang erzwungen). Die Wurzelspalten (links x ≥ 27, rechts x ≤ 40) stehen fest, die Platinen-Textur bleibt erhalten (ganze Spalten werden verschoben).
* Schwebe-Bob zweistufig bis 2 px (Periode 12): Kopf/Flügel zuerst, Hinterleib hinterher; der Unterschied wird in Zeile 37 (reine Metallzeile) durch Verdoppeln/Entfernen einer Zeile ausgeglichen.
  Der Hinterleib wedelt dazu seitlich (nur Zeilen ab 22, je tiefer desto mehr, bis 2 px, Periode 24, Verbindung bleibt 4-verbunden).
* Glanz nur auf dem Metall (Regel 14): ein dezentes Lichtband (eine Stufe heller) läuft alle 24 Frames über die grauen Metallflächen von Kopf und Rumpf. Die grünen Flügel, die Fühler und die Honigfenster glänzen nicht.
* Lampen: die gelben Lampen im Hinterleib blinken ((255,201,0) ↔ (233,157,82), Periode 12); die roten Leuchtaugen schließen sich in den Frames 38–39 (Lid = graues Metall des Kopfes (160,160,160)).

Ergänzungen: keine nötig — Flügel und Körper berühren sich nur an der Wurzel (nichts Verdecktes). Es gibt keine Partikel.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Spaltenversatz (Flügel) und Hinterleib-Wedeln (Zeilenversatz) legen an den Rändern Innenfarbe frei → F.umranden setzt dort den Flügelrand (9,41,0) bzw. den Metallrand (51,51,51); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 14, 12                    # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('cybug-bee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

GRUEN = [(13, 91, 5), (14, 75, 5), (0, 126, 9), (9, 41, 0), (253, 239, 252)]
gruen = L.farbmaske(spr, GRUEN)
wing_l = vorhanden & gruen & (xx <= 27) & (yy <= 29)
wing_r = vorhanden & gruen & (xx >= 40) & (yy <= 29)
koerper = vorhanden & ~wing_l & ~wing_r
assert int((wing_l | wing_r | koerper).sum()) == int(vorhanden.sum())

METALL = [(137, 137, 137), (160, 160, 160), (205, 205, 205)]
RAMPE = [(137, 137, 137), (160, 160, 160), (205, 205, 205), (253, 239, 252)]       # dunkel → hell (Metall)
metall_maske = L.farbmaske(spr, METALL) & koerper & (yy >= 10)
AUGEN = [(30, 13), (37, 13), (30, 14), (37, 14), (31, 15), (36, 15), (31, 16), (36, 16), (30, 15), (37, 15), (30, 16), (37, 16), (31, 17), (36, 17)]
KOPF_METALL = (160, 160, 160)
LAMPEN = [(34, 29), (34, 30), (35, 30), (33, 35), (33, 36), (34, 36)]
LAMPE_AN, LAMPE_AUS = (255, 201, 0), (233, 157, 82)
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (9, 41, 0)
METALLRAND = (51, 51, 51)
ZEILE = PAD_T + 37                                           # Metallzeile im Hinterleib: hier wird ausgeglichen


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 6)                                    # kräftiger Flügelschlag: sechsmal pro Schleife (Periode 8)
    pb = L.sinus(i, N / 4)                                    # Schwebe-Bob: Periode 12
    haupt = int(round(-1.3 * math.sin(pb)))                   # Kopf/Flügel zuerst …
    lag = int(round(-1.3 * (math.sin(pb - 0.9) + math.sin(0.9))))   # … Hinterleib hinterher (Frame 0 = Ruhe)
    n_str = max(-1, min(2, lag - haupt))

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wl = F.ebene(spr, wing_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(spr, wing_r, H, W, PAD_L, PAD_T)

    # Lampen blinken, Augen schließen sich (Lid = Metall des Kopfes)
    if effekte:
        aus = math.sin(L.sinus(i, N / 4)) > 0.6
        F.setze(kp, PAD_L, PAD_T, {p: (LAMPE_AUS if aus else LAMPE_AN) for p in LAMPEN})
    if i in (38, 39):
        F.setze(kp, PAD_L, PAD_T, {p: KOPF_METALL for p in AUGEN})
    # Glanz nur auf dem Metall
    if effekte:
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 4, 10, RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.8))

    # Hinterleib wedelt, Flügel schlagen
    kp = F.zeilen_pendel(kp, PAD_T + 21, 2.4, L.sinus(i, N / 2), 1.0)
    fl_amp, fl_pot, lauf = 6.7, 1.1, 0.1                       # Spitze etwa −6 … +7 px
    wl = F.fluegel_welle(wl, PAD_L + 27, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 40, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf, zusammenhang=True)

    # Bob zweistufig (an allen Ebenen gleich)
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, lag) for a in (kp, wl, wr))

    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0)])
    F.umranden(f, [wl, wr], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)       # Randpixel-Test (Regel 16)
    F.umranden(f, [kp], UMRISS, METALLRAND, METALLRAND, METALLRAND)             # Hinterleib-Wedeln legt Innenfarbe an die Kanten: Metallrand
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
    L.speichern('cybug-bee', 'Cybug BEE', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cybug-bee-strip.png', frames, spalten=8, scale=3)
