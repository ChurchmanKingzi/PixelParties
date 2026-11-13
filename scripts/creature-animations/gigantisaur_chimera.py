# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Chimera“ (Creature) — Mischwesen aus Langhals (Rumpf, Beine, Kopf), Spinosaurus-Segel, Stegosaurus-Platten und -Schwanzdornen: langsam, schwer.

PICK: [["Kartenkunst", "data/card-art/native/Gigantisaur_Chimera.png × Motiv-Maske (data/subject-masks.json)", "ganze Figur"]]
Quelle: src/gigantisaur-chimera.png (80×46 px, 40 Farben). Für die Chimäre gibt es in den xcf-Dateien KEINE Ebene (Suche über alle Ebenen aller Dateien ohne Treffer; die Maske nennt als Quelle nur
„Creature Batch 1“). Die Kartenkunst ist verrauscht (≈ 1300 Farbtöne im Motiv), deshalb wurde jedes Motivpixel auf die nächste Farbe der sauberen Dino-Ebenen (MotiveGrailWar 503/505/509/511/513)
gesetzt, fast gleiche Töne (Abstand < 6) zusammengelegt, 15 vereinzelte Fehlpixel an ihre Nachbarfarbe angeglichen und ein frei schwebendes Einzelpixel rechts neben dem Segel (52, 7) entfernt. Der Rumpf deckt sich danach mit der Brachion-Ebene 503 (Versatz +6, −7).
Ergänzt (am linken Kartenrand abgeschnitten): die Spitzen zweier Schwanzdornen, je 4 px in Dornfarbe – (3,29) (2,30) (1,30) (0,31) und (3,34) (3,35) (2,36) (2,37).
Die Füße sind in der Kunst vollständig (Unterkante Zeile 45). Am rechten Rand endet die Schnauze mit ihrem Umriss; zwei Zahnpixel (79, 15–16) liegen am Bildrand.

Aufruf:   python3 gigantisaur_chimera.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-chimera.png + .json

Identifikation (x, y im Sprite):
* Rückensegel (x 19–54, y 0–19): Haut gelb/creme mit braunen Knochenstrahlen – starr.
* Rückenplatten (dunkelrot F mit rosa Fläche d/W und dunkler Raute N/H): große Reihe vor dem Segel (x 22–48, y 9–24), kleine Platten auf dem Schwanz (x 9–22, y 20–26) und auf dem Hals (x 54–67, y 9–15) – starr.
* Hals (x 46–70, y 13–19) waagerecht nach rechts, Kopf (x 66–79, y 7–19): schwarzer Scheitelkamm (71–75, 7–9), zwei gelbe Augen mit dunkler Pupille (72–73, 11–12) und (76–77, 11–12),
  weiße Zähne (74–79, 15–17), beiger Unterkiefer (70–75, 15–19). Kiefer/Zähne bleiben fest (Aufbau am verrauschten Original nicht sicher lesbar).
* Rumpf grau (x 20–49, y 20–35) mit beigem Bauchfleck (30–39, 25–34) und Brustkante (46–48, 20–27).
* Schwanz (x 8–19, y 25–29) mit Dornenfächer: vier dünne helle Knochendornen (c/i) hängen nach links unten (x 0–14, y 27–40) – KEINE Partikel.
* Vier Beine wie beim Brachion: nah hinten (x 22–29), fern hinten (violettgrau, x 29–36), nah vorn (x 37–44), fern vorn (x 43–50), Füße bis y 45.

Idle-Idee: die Chimäre steht schwer atmend, pendelt mit Hals und Kopf, lässt den Dornenfächer am Schwanz schwingen und tritt von Bein zu Bein.
Ablauf (72 Frames à 80 ms = 5,76 s), alle Bewegungen unabhängig:
* Hals pendelt (1× je Schleife): spaltenweise Biegung (Gefälle ≤ 1 px), Kopf (x ≥ 66) starr an der Spitze, ±2 px.
* Dornenfächer schwingt (3× je Schleife): jeder der vier Dornen schwenkt als starre 1-px-Linie um seinen Fuß (≈ ±10°, Spitze ±2 px); die Linie wird dafür im Raster neu gesetzt
  (Z.dorn, Bresenham – keine Bilddrehung, nichts wird gedehnt); in der Ruhelage stehen die Originalpixel.
* Schwanzende wippt (2× je Schleife): die Spalten x ≤ 14 (Schwanzspitze samt Fächer und kleinen Platten) heben/senken sich 1 px.
* Atmen (2× je Schleife, oben in Frames 4–19 und 40–55): Rumpf, Segel, Hals, Kopf, Schwanz heben sich 1 px; die Beine werden in Zeile 39 texturiert um eine Zeile verlängert (anim_textur).
* Beine heben (je 10 Frames 1-1-1-2-2-2-2-1-1-1 px, Fuß unverändert): nah hinten ab Frame 2, fern vorn ab 20, nah vorn ab 38, fern hinten ab 56.
* Blinzeln (Frames 30–33 und 66–69): beide Augen, Lid in der Hautfarbe (89,80,81).
Offene Kanten schließt anim_tiere.umriss_schliessen (Umrissfarbe des Originals). Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_drache as D
import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 72, 80
PAD_L, PAD_R, PAD_T, PAD_B = 5, 3, 5, 3

spr = L.lade('gigantisaur-chimera')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

D_, T_, Y_, R_, X_, A_, F_ = (45, 28, 32), (89, 80, 81), (105, 92, 99), (79, 65, 81), (101, 83, 96), (145, 121, 98), (189, 154, 120)
DORN = [(159, 145, 122), (193, 178, 158)]
FUELL = [T_, Y_, R_, X_, A_, F_, (93, 81, 69)]
ALLE = sorted({tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]})
UMRISS = [c for c in ALLE if c not in FUELL]
REGEL = {c: D_ for c in FUELL}

bein_nh, bein_fh = Z.bein_paar(spr, Z.maske_farben(spr, [T_, Y_], 22, 36, 29, 45), Z.maske_farben(spr, [R_, X_], 29, 36, 36, 45), [D_], 36)
bein_nv, bein_fv = Z.bein_paar(spr, Z.maske_farben(spr, [T_, Y_], 37, 36, 44, 45), Z.maske_farben(spr, [R_, X_], 43, 36, 50, 45), [D_], 36)
faecher_m = L.farbmaske(spr, DORN) & (xx <= 14) & (yy >= 27) & ~((xx >= 8) & (yy <= 28))
schwanz_m = vorhanden & (xx <= 17) & (yy >= 20) & (yy <= 30) & ~faecher_m
faecher_m = faecher_m & ~((xx == 10) & (yy == 28))            # (10,28) ist der helle Dornfuß IM Schwanz: bleibt beim Schwanz
hals_m = vorhanden & (xx >= 50) & (yy <= 19)
koerper = vorhanden & ~bein_nh & ~bein_fh & ~bein_nv & ~bein_fv & ~faecher_m & ~schwanz_m & ~hals_m

HUB = [1, 1, 1, 2, 2, 2, 2, 1, 1, 1]
BEIN_START = {'nh': 2, 'fv': 20, 'nv': 38, 'fh': 56}
DORNEN = [((8, 27), (0, 31)), ((7, 29), (2, 37)), ((8, 30), (10, 40)), ((11, 29), (14, 37))]        # (Fuß, Spitze) der vier Schwanzdornen
AUGEN = [(72, 11), (73, 11), (72, 12), (73, 12), (76, 11), (77, 11), (76, 12), (77, 12)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 36) in range(4, 20) else 0
    bl = max(D.blinzeln(i, 30), D.blinzeln(i, 66))
    hals = -2.0 * Z.sinus(i, N)
    faecher = 0.17 * Z.sinus(i, N / 3)                         # Schwenkwinkel der Dornen (Bogenmaß, ≈ ±10°)
    wipp = int(round(Z.sinus(i, N / 2, -0.4) * 0.8))
    return atem, bl, hals, faecher, wipp


def frame(i, nur=None):
    atem, bl, hals, faecher, wipp = zustand(i)
    hl = teil(hals_m)
    if bl:
        for x, y in AUGEN:
            if bl == 2 or y == 11:
                hl[PAD_T + y, PAD_L + x, :3] = T_
    hl = Z.biegen(hl, Z.biegung(PAD_L + 52, PAD_L + 79, PAD_L + 66, hals, 1.2))
    sw_ = teil(schwanz_m)
    dy_f = 0
    if wipp:
        dys = Z.biegung(PAD_L + 17, 0, PAD_L + 14, wipp)
        sw_ = Z.biegen(sw_, dys)
        dy_f = wipp
    if abs(faecher) < 0.02:
        fa = teil(faecher_m)                                    # Ruhelage = Original
    else:
        fa = L.leer(H, W)
        for fuss, spitze in DORNEN:
            Z.dorn(fa, (PAD_L + fuss[0], PAD_T + fuss[1]), (PAD_L + spitze[0], PAD_T + spitze[1]), faecher, DORN[0], DORN[1])
    sw_ = L.zusammen(H, W, [(fa, 0, dy_f), (sw_, 0, 0)])
    beine = {}
    for name, m in (('fh', bein_fh), ('fv', bein_fv), ('nh', bein_nh), ('nv', bein_nv)):
        b = L.heben_unten(teil(m), PAD_T + 37, Z.hub(i, [BEIN_START[name]], HUB))
        beine[name] = TX.streck_zeile(b, PAD_T + 39, atem)
    ebenen = {'bein_fh': (beine['fh'], 0), 'bein_fv': (beine['fv'], 0), 'koerper': (teil(koerper), -atem), 'schwanz': (sw_, -atem), 'hals': (hl, -atem),
              'bein_nh': (beine['nh'], 0), 'bein_nv': (beine['nv'], 0)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    return T.umriss_schliessen(ganz, UMRISS, REGEL)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n), '| Original', int(vorhanden.sum()))
    print('Lücken je Frame (Original %d):' % Z.loecher(spr), sorted({Z.loecher(f) for f in frames}))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-chimera', 'Gigantisaur Chimera', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-chimera-strip.png', frames, spalten=12, scale=3)
