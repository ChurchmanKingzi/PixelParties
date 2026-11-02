# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparkfly Architect“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveRussia", 157, 5]]   — mit eigener Extraktion: die Flügel haben in der Kunst Alpha 179/232 (durchscheinend) und gingen bei creature_show.py verloren.
Quelle: src/sparkfly-architect.png — die ganze Fliege (25×17 px, 42 Farben) aus MotiveRussia.xcf, Ebene 157 („Ebene #65“), Figur unten links (x 0–24, y 84–100 der Ebene);
jedes Pixel mit Alpha > 0 deckend übernommen (RGB unverändert, Alpha 179/232 → 255). Dieselbe Fliege steht auf der Karte „Sparkfly Queen“ (Abgleich 0,96) und in
„Sparkfly Architect“ (Abgleich 0,82, Hintergrund stört). Warum diese Karte zuerst: Worker/Queen setzen sich aus 3–5 Ebenen (Flügel, Körper, Beutel) zusammen und sind in der Kunst
mehrfach/halbtransparent; der Architect ist ein einzelnes, vollständiges Sprite.

Aufruf:   python3 sparkfly_architect.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparkfly-architect.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Fliege von vorn, spiegelsymmetrisch um x = 10):
* Flügel (die ehemals durchscheinenden Pixel, je Flügel ein olivgrünes Paneel): links x 0–6, rechts x 14–20, y 0–9; Olivtöne (160,160,21)/(147,151,11)/(157,157,18) mit dunklem
  Rand (58,56,6) und Geäder (52,50,5)/(78,77,7); der untere Flügelansatz (x 3–6 bzw. 14–17, y 7–9) ist in der Kunst deckend.
* Körper (x 5–16, y 2–16): schwarzbrauner Brustkorb (17,11,5)/(42,27,14)/(51,33,16) mit gelbem Band oben (191,186,24) (y 2–3), olivem Pelz (y 4–9);
  Kopf unten mit zwei Augen: weiß (255,255,255) + grün (140,159,0)/(110,125,0) bei (8,12–13), (9,13–14) und (11,13–14), (12,12–13).
* Beine: schwarze Pixelketten links (x 2–7, y 11–15) und rechts (x 14–19, y 11–15).
* Werkzeug (rechts, x 17–24, y 9–16): kleine Spitzhacke — roter Kopf (212,18,18)/(134,12,10) von (19,9) nach (24,14), grauer Stiel (58,63,60)/(42,46,40) von (22,11) nach (17,16).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: achtmal pro Schleife (Periode 6); jede Flügelspalte wandert senkrecht, je weiter außen desto mehr (Spitze etwa −4 … +4 px, hinkt nach), Textur bleibt,
  Spalten bleiben ganz (F.fluegel_welle, Zusammenhang erzwungen). Die Wurzelspalte steht fest, beide Flügel schlagen gleichzeitig (spiegelsymmetrisch).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12) — die Biene schwebt als Ganzes.
* Die Spitzhacke ist FEST mit der Biene verbunden (Nutzerfeedback Runde 2: „soll NICHT unabhängig von der Biene sein“): sie wird von der rechten unteren Beinspitze gehalten (Beinspitze (17,14) berührt
  den Stiel bei (18,15)) und bekommt in jedem Frame EXAKT denselben Versatz wie Körper, Beine und Flügelwurzeln (Bob), kein eigener Nachlauf, kein Klopfen, kein Seitenschwingen. Hand (Bein) und Werkzeug
  verlassen einander nie; ein Test im Skript (HALTE-Test) prüft in jedem Frame, dass Beinspitze und Stiel noch Nachbarn (8-verbunden, wie im Original) sind.
* Blinzeln (Frames 33–34): die Augen schließen sich (Brauntöne des Gesichts).
* Keine Partikel (die Fliege hat nichts, was Funken/Staub abgäbe; ein Pollenstaub aus Olivpunkten sah wie Pixelfehler aus). Kein Glanz (Chitin/Flügel sind kein Metall).

Ergänzungen: keine nötig — Flügelpaneele und Körper liegen nebeneinander, nichts verdeckt etwas Wichtiges.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand); es gibt keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Spaltenversatz legt an den Flügelkanten Innenfarbe frei → F.umranden setzt dort den Flügelrand (58,56,6); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('sparkfly-architect')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ROT_D, GRAU, GRAU_D = (212, 18, 18), (134, 12, 10), (58, 63, 60), (42, 46, 40)
werkzeug = L.farbmaske(spr, [ROT, ROT_D, GRAU, GRAU_D]) & (xx >= 17)
wing_l = vorhanden & ~werkzeug & (xx <= 6) & (yy <= 9)
wing_r = vorhanden & ~werkzeug & (xx >= 14) & (xx <= 20) & (yy <= 9)
koerper = vorhanden & ~werkzeug & ~wing_l & ~wing_r
assert int((wing_l | wing_r | koerper | werkzeug).sum()) == int(vorhanden.sum())

BODY_E, BODY_G = (42, 27, 14), (51, 33, 16)
AUGEN = [(8, 12), (8, 13), (9, 13), (9, 14), (11, 13), (11, 14), (12, 12), (12, 13)]
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (58, 56, 6)


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    wl = F.ebene(spr, wing_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(spr, wing_r, H, W, PAD_L, PAD_T)
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wz = F.ebene(spr, werkzeug, H, W, PAD_L, PAD_T)

    if i in (33, 34):                                          # Blinzeln
        F.setze(kp, PAD_L, PAD_T, {p: (BODY_E if (p[0] + p[1]) % 2 else BODY_G) for p in AUGEN})

    # Flügelschlag: Spitze etwa −4 … +4 px
    wl = F.fluegel_welle(wl, PAD_L + 6, 4.4, ph, potenz=1.0, nur_rechts=False, lauf=0.12, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 14, 4.4, ph, potenz=1.0, nur_rechts=True, lauf=0.12, zusammenhang=True)
    wl, wr, kp = (L.versetze(a, 0, bob) for a in (wl, wr, kp))
    # Werkzeug: starr (Drehung zerreißt die dünnen Diagonalen) und fest mit der Biene verbunden: derselbe Versatz wie der Körper (die Hand ist die rechte untere Beinspitze)
    wz = L.versetze(wz, 0, bob)

    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0), (wz, 0, 0)])
    F.umranden(f, [wl, wr], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)       # Randpixel-Test (Regel 16)
    return f


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 2 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 2, ey0 - 2, ex1 + 2, ey1 + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


def halte_test(frames):
    """Die Spitzhacke gehört zur Biene: in JEDEM Frame ist der Versatz des Werkzeugs (rote/graue Pixel) gleich dem Versatz des Körpers (weiße Augenpixel bzw. bei geschlossenen
    Augen das gelbe Band) gegenüber Frame 0 — und die Beinspitze (17,14) bleibt Nachbar (8-verbunden) des Stiels (18,15)."""
    def lage(f, farben):
        m = L.farbmaske(f, farben)
        ys, xs = np.nonzero(m)
        return int(ys.min()), int(xs.min())
    tool0 = lage(frames[0], [ROT, GRAU])
    band0 = lage(frames[0], [(191, 186, 24)])
    for k, f in enumerate(frames):
        dt = (lage(f, [ROT, GRAU])[0] - tool0[0], lage(f, [ROT, GRAU])[1] - tool0[1])
        db = (lage(f, [(191, 186, 24)])[0] - band0[0], lage(f, [(191, 186, 24)])[1] - band0[1])
        assert dt == db, f'Frame {k}: Werkzeug-Versatz {dt} != Körper-Versatz {db}'
        tip = (PAD_L + 17, PAD_T + 14 + db[0]); stiel = (PAD_L + 18, PAD_T + 15 + db[0])
        assert tuple(f[tip[1], tip[0], :3]) == (19, 12, 6) and tuple(f[stiel[1], stiel[0], :3]) == (42, 46, 40), f'Frame {k}: Hand und Stiel getrennt'
    print('HALTE-Test bestanden: Werkzeug und Körper haben in allen', len(frames), 'Frames denselben Versatz; Beinspitze und Stiel bleiben Nachbarn')


if __name__ == '__main__':
    koerper_frames = [frame(i, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    halte_test(frames)
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-architect', 'Sparkfly Architect', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-architect-strip.png', frames, spalten=8, scale=6)
