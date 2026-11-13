# -*- coding: utf-8 -*-
"""Idle-Animation für „Green Dragoneer“ (Creature) — Regeln 14/16/17–31 (Schuppen, Haut, Hörner: kein Glanz, kein Feuer).

PICK: [["MotiveMoe", 3, 1]]   (Ebene „Green Dragoneer #1“, Figur 1 — einzige Ebene der Figur, in der Kartenkunst pixelgenau wiedergefunden; die Ebene „Mini-Dragon“ (Ebene 7) ist ein anderes Wesen)
Quelle: src/green-dragoneer.png — grüner Drache, sitzend, von vorn mit eingerolltem Schwanz (28×30 px, 15 Farben) aus MotiveMoe.xcf. Die Karte zeigt ihn am Flussufer (Boden unter ihm).

Aufruf:   python3 green_dragoneer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/green-dragoneer.png + .json

Identifikation (x, y im Sprite):
* Hörner (links x 2–4, y 1–6; rechts x 11–13, y 1–6): schmal, beige/braun (F (246,205,139), E (213,164,98), H (189,131,57), G (148,90,24)) mit schwarzem Umriss; Ohr-/Kammbereich darunter (2–3, 8–9) und (12–13, 8–9).
* Kopf (x 1–14, y 6–14): schwarzes Stirnband (y 7, x 0–17), grüne Stirn, zwei rote Augen — links (5,8)(5,9) hellrot (255,108,108) + (6,9) dunkelrot (148,24,24), rechts (10,8)(9,9) hellrot + (10,9) dunkelrot —,
  beige Kieferplatte (6–9, 12–13) zwischen zwei WEISSEN Fangzähnen (4,12)(4,13) und (11,12)(11,13) (Zähne, KEINE Partikel); beige Wangen (4–5, 11–12) und (10–11, 11–12).
* Weiße Pixel (14,6) (17,6) (18,7) oberhalb der rechten Kopfseite: nicht eindeutig (Augenglanz/Dorn?) — bleiben fest.
* Rechter Arm/Kralle (x 17–21, y 8–16): beige-grüne Streifen, enden bei (19–20, 15–16) — bleibt fest (Funktion nicht sicher).
* Körper (x 6–19, y 10–28): dunkelgrüne Schuppenplatten (B/C/D), links unten die beigen Füße/Hände (x 7–12, y 21–27), zwei weiße Pixel (7,20) (9,20) (Zehenkrallen), unten (10–12, 28) hellblau/weiß (172,213,255)/(246,255,255)
  — Bodenglanz/Wasser, bleibt fest.
* Schwanz (x 19–27, y 14–28): rollt sich rechts vom Körper hoch (grüne Platten, beige Unterseite G/H/E/F, y 14–27) und endet bei (24–27, 14–16) in einer Hakenspitze (C/E/F beige); unten (19–24, 24–27) Ansatz am Körper.
Bleibt fest: Fangzähne, Kieferplatte, rechter Arm, Weißpixel, Fußspitzen, Bodenglanz.

Ablauf (60 Frames à 70 ms = 4,2 s), alle Bewegungen unabhängig:
* Atmen (Periode 30, 2× pro Schleife; oben in Frames 3–16 und 33–46): Zeile 20 (Körpermitte, Schuppentextur) wird eingefügt (L.streck_zeile mit Texturmischung) — Kopf, Hörner und Arm heben sich 1 px, Füße und Schwanzansatz bleiben.
* Schwanz wiegt sich: der aufgerollte Schwanz pendelt waagerecht um seinen Ansatz (y = 27): je höher, desto weiter (Spitze bis ±2 px), Periode 20 (3× pro Schleife), Zeilenversatz mit Gefälle ≤ 1 px je Zeile (L.zeilen_welle);
  der Umriss wird um den verschobenen Schwanz neu geschlossen.
* Hörner zucken: je ein Horn (links Frames 8–13, rechts Frames 38–43) kippt mit der Spitze 1 px nach außen und zurück (T.zucken_zeilen).
* Blinzeln (Frames 22–25 und 50–53): beide Augen schließen sich (Lid in Schuppengrün C (0,75,0), halb → zu → zu → halb).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine Pixel erfunden; Randpixel-Korrektur (Regel 16): fehlende Umrisspixel am verschobenen Schwanz/Horn werden in der Umrissfarbe des Originals (anim_tiere.umriss_schliessen) ergänzt.
"""
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_tiere as T
import anim_drache as D

N, MS = 60, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 5, 4, 3

spr = L.lade('green-dragoneer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

horn_l = vorhanden & (xx <= 4) & (yy <= 5)
horn_r = vorhanden & (xx >= 11) & (xx <= 13) & (yy <= 5)
schwanz_m = vorhanden & (((xx >= 21) & (yy >= 14)) | ((xx >= 20) & (yy >= 17)) | ((xx >= 19) & (yy >= 24)))
koerper = vorhanden & ~horn_l & ~horn_r & ~schwanz_m

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 20
LID = (0, 75, 0)
assert LID in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
AUGEN_OBEN = [(5, 8), (10, 8)]
AUGEN_REST = [(5, 9), (6, 9), (9, 9), (10, 9)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 30) in range(3, 17) else 0
    bl = 0
    for s in (22, 50):
        bl = max(bl, D.blinzeln(i, s))
    ha = D.huell(D.stufe(i, N, [(8, 14)]))
    hb = D.huell(D.stufe(i, N, [(38, 44)]))
    return atem, bl, int(round(ha)), int(round(hb))


def frame(i, nur=None):
    atem, bl, ha, hb = zustand(i)
    k = teil(koerper)
    if bl:
        for (x, y) in AUGEN_OBEN + (AUGEN_REST if bl == 2 else []):
            k[PAD_T + y, PAD_L + x, :3] = LID
    k = TX.streck_zeile(k, PAD_T + ZEILE, atem)
    sw_ = L.zeilen_welle(teil(schwanz_m), PAD_T + 27, 2.0, L.sinus(i, N / 3))
    hl = T.zucken_zeilen(teil(horn_l), PAD_T + 3, -ha, anteile={PAD_T: 1.0, PAD_T + 1: 1.0, PAD_T + 2: 0.0})
    hr = T.zucken_zeilen(teil(horn_r), PAD_T + 3, hb, anteile={PAD_T: 1.0, PAD_T + 1: 1.0, PAD_T + 2: 0.0})
    hl = L.versetze(hl, 0, -atem)
    hr = L.versetze(hr, 0, -atem)
    ebenen = {'schwanz': sw_, 'koerper': k, 'horn_l': hl, 'horn_r': hr}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('green-dragoneer', 'Green Dragoneer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/green-dragoneer-strip.png', frames, spalten=10, scale=4)
