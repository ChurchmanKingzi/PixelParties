# -*- coding: utf-8 -*-
"""Idle-Animation für „Dragolfin“ (Creature) — Regeln 14/16/17–31 (Haut/Flossen/Zähne: kein Glanz; Wasserblasen aus dem Maul).

PICK: [["MotiveDeepsea", 134, 1]]   (Ebene „Ebene #144“, Figur 1 — einzige Ebene mit der Figur, 48×32 px, in der Kartenkunst pixelgenau wiedergefunden)
Quelle: src/dragolfin.png — blauer Drachendelfin im Profil, blickt nach links (48×32 px, 42 Farben), aus MotiveDeepsea.xcf.

Aufruf:   python3 dragolfin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/dragolfin.png + .json

Identifikation (x, y im Sprite):
* Kopf (x 0–19, y 4–17): Schnauze links (x 0–9, y 13–17) mit Maul — hellgraue Zähne (182,212,223) bei (1,14)(3,14)(5,14)(2,15)(4,15)(6,15) und je ein rosa Zahnfleischpixel (142,117,139) bei (3,15)(5,15);
  ein Auge: grün gestreift (56,113,58)/(98,154,93) bei (6–9, 12) unter einem schwarzen Lidstrich (7–9, 10); Kopfhaube mit dunklem Umriss bei (3–13, 4–9).
* Federkamm (x 3–14, y 0–3): zwei dünne weiße Linien (203,240,249)/(224,252,255) laufen V-förmig auf die Kopfhaube zu (links von (4,0) nach (6,3), rechts von (12,0) nach (10,3)) und setzen sich als weiße
  Flecken auf der Haube fort (x 3–6, y 4–8) — Kamm/Federn, KEINE Partikel.
* Schulter (x 14–21, y 8–17): runde Schulterkugel mit dunklem Umriss.
* Flügel (x 21–47, y 3–20): großer, schräg nach rechts oben ragender Schwingenblatt-Flügel (hellblaue Federbahnen mit dunklen Federrippen D/J/P), am rechten Ende ein Krallenfinger (x 38–46, y 11–20).
* Körper (x 10–40, y 13–24): Rumpf mit dunkler Rückenlinie (y 18) und hellblauem Bauchband.
* Brustflosse (x 10–26, y 19–29): hell-graugrüne/weiße Flosse unter Kopf und Rumpf (Farben (111,143,140), (183,206,207), (204,230,231), (84,108,106) …).
* Hinterflosse/Schwanz (x 22–36, y 23–31): blaue Schwanzflosse mit dunklem Schachbrettmuster (B/E) und Umriss.
Bleibt fest: Kopf samt Maul und Zähnen (alles starr als Ganzes, Unterkiefer nie unabhängig), Schulterkugel, Federrippen (bewegen sich nur mit dem Flügel).

Ablauf (48 Frames à 70 ms = 3,36 s), alle Bewegungen unabhängig:
* Flügelschlag: viermal pro Schleife (Periode 12); Spaltenversatz wächst zur Flügelspitze (hebt sich bis 4 px, senkt sich bis 3 px), Spitze hinkt nach; der Krallenfinger rechts schlägt als Gruppe (D.fluegel_asym,
  Lücke zum Körper wird beim Heben mit dem untersten Flügelpixel gefüllt).
* Schwebe-/Schwimm-Bob: ganze Figur steigt beim Abschlag bis 1 px (hinkt dem Flügel 0,6 rad hinterher); die Brustflosse hinkt dem Körper nach.
* Brustflosse paddelt: die unteren Zeilen schwingen waagerecht bis ±1,5 px (Periode 16), oben am Ansatz fest (L.zeilen_welle).
* Schwanzflosse wedelt: die Zeilen unterhalb der Rumpflinie schwingen waagerecht bis ±2 px (Periode 24, anderer Takt).
* Federkamm wiegt sich: die beiden Kammlinien neigen sich an der Spitze 1 px nach außen und zurück (Frames 4–15, 28–39, links/rechts versetzt).
* Blinzeln (Frames 20–23 und 44–47): das grüne Auge schließt sich (Lid in Hautblau (85,149,209), halb → zu → zu → halb).
* Luftblasen: kleine runde Blasen steigen aus dem Maul langsam auf (3 Stück à 4×4/2×2, weißblau (203,240,249)/(224,252,255)); sie liegen hinter der Figur, Lebensdauer = Schleife (nahtlos).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine Pixel erfunden; Randpixel-Korrektur (Regel 16): fehlende Umrisspixel an verschobenen Teilen werden in der Umrissfarbe des Originals (anim_tiere.umriss_schliessen) ergänzt; 
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_drache as D

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 8, 6, 9, 6

spr = L.lade('dragolfin')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
r, g, b = (spr[..., k].astype(int) for k in range(3))

kamm = vorhanden & (yy <= 3) & (xx <= 20)
fluegel = vorhanden & (((xx >= 21) & (yy <= 17)) | ((xx >= 38) & (yy <= 21)))
grau = (b - r < 40) & (g >= r) & ~((r < 60) & (g < 70))                      # hell-graugrüne Flossenfarben (nicht das Blau des Körpers, nicht der dunkle Umriss)
dunkel = (r < 60) & (g < 70) & (b < 90)
flosse = vorhanden & (xx <= 26) & (yy >= 19) & (grau | (dunkel & (((xx <= 13) & (yy >= 19)) | (yy >= 25)))) & ~fluegel
schwanz = vorhanden & (xx >= 22) & (yy >= 23) & ~fluegel & ~flosse
koerper = vorhanden & ~kamm & ~fluegel & ~flosse & ~schwanz
kamm_l = kamm & (xx <= 7)
kamm_r = kamm & (xx >= 8)

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
AUGE = [(6, 12), (7, 12), (8, 12), (9, 12)]
HAUT = (85, 149, 209)
assert HAUT in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
BLASE = {'c': (224, 252, 255), 'r': (203, 240, 249)}
assert all(c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]} for c in BLASE.values())
PUFFS = [dict(x=PAD_L + 0, y=PAD_T + 14, vx=-2, vy=-14, off=0, form='o', wackeln=1),
         dict(x=PAD_L + 1, y=PAD_T + 15, vx=-3, vy=-12, off=16, form='s', wackeln=1),
         dict(x=PAD_L + 0, y=PAD_T + 14, vx=-2, vy=-13, off=32, form='o', wackeln=1)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    ph = L.sinus(i, N / 4)
    bob = -int(round(0.7 * (math.sin(ph - 0.6) + math.sin(0.6))))
    nach = -int(round(0.7 * (math.sin(ph - 1.6) + math.sin(1.6))))
    bl = 0
    for s in (20, 44):
        bl = max(bl, D.blinzeln(i, s))
    return ph, bob, nach, bl


def kamm_neigen(a, links, i, start):
    """Kammlinie: nur die obersten zwei Zeilen kippen mit der Spitze 1 px nach außen (links: nach links)."""
    u = D.stufe(i, N, [(start, start + 12)])
    d = int(round(D.huell(u)))
    return T.zucken_zeilen(a, PAD_T + 2, -d if links else d, anteile={PAD_T: 1.0, PAD_T + 1: 0.0})


def frame(i, nur=None):
    ph, bob, nach, bl = zustand(i)
    k = teil(koerper)
    if bl:
        for (x, y) in AUGE:
            if bl == 2 or x in (6, 7):
                k[PAD_T + y, PAD_L + x, :3] = HAUT
    rest = L.platz((koerper | flosse | schwanz).astype(np.uint8)[..., None].repeat(4, 2) * 255, H, W, PAD_L, PAD_T)[..., 3] > 0
    fl_, _ = D.fluegel_asym(teil(fluegel), PAD_L + 22, ph, 4.0, 3.0, lauf=0.7, nur_rechts=True, gruppen=[(PAD_L + 38, PAD_L + 46)], fuell=rest)
    fo = L.zeilen_welle(teil(flosse), PAD_T + 19, 1.5, L.sinus(i, N / 3))
    sw_ = L.zeilen_welle(teil(schwanz), PAD_T + 22, 2.0, L.sinus(i, N / 2))
    ka = kamm_neigen(teil(kamm_l), True, i, 4)
    kb = kamm_neigen(teil(kamm_r), False, i, 28)
    ebenen = {'schwanz': (sw_, 0), 'flosse': (fo, nach), 'koerper': (k, 0), 'fluegel': (fl_, 0), 'kamm_l': (ka, 0), 'kamm_r': (kb, 0)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1] + bob) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


def puffs(i):
    return L.puff_ebene(H, W, i, N, PUFFS, BLASE)


TEST_EBENEN = None


def frame_mit_blasen(i):
    return L.zusammen(H, W, [(puffs(i), 0, 0), (frame(i), 0, 0)])


if __name__ == '__main__':
    frames = [frame_mit_blasen(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('dragolfin', 'Dragolfin', frames, MS, prev)
    if prev:
        L.streifen(prev + '/dragolfin-strip.png', frames, spalten=12, scale=3)
