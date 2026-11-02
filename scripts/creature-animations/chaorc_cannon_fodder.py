# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Cannon Fodder“ (Creature) — das KANONENFUTTER selbst: der Spitzohr-Kopf, der vorne in der Kanone sitzt (nicht der rote Chaorc, der die Kanone bedient).

Quelle: src/chaorc-cannon-fodder.png (17×16 px, 13 Farben).
PICK: [["MotiveHawaii", 113, 1]]      (Ebene „Cannon Fodder“, Figur 1 (18×17 px bei (266,101) der xcf): der Kopf mit den spitzen Ohren; die Ebene enthält links daneben auch den roten Chaorc = Figur 2, den die ALTE Fassung
  gewählt hatte; Nutzer: „Cannon Fodder ist der Sprite vorne in der Kanone, NICHT der, der sie bedient.“)
Abgleich mit der Kartenkunst Chaorc_Cannon_Fodder.png (76×51): der Kopf sitzt dort bei (52,15) rechts vor der Kanonenmündung, 100 % Pixeltreffer. Nicht zur Figur gehören: die Kanone (Ebenen 114/108, schwarzes Geschütz mit
drei Stacheln und brennender Zündschnur — eigene Karte „Field Cannon“), der rote Chaorc (Figur 2), Kisten und Schräge.
Aufruf:   python3 chaorc_cannon_fodder.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-cannon-fodder.png + .json

Was im Sprite ist (x, y im 17×16-Sprite):
* KOPF (x 1–15, y 0–8): runder Kopf, dunkelbraunes Haar/Umriss A (49,24,0) (oben Haarschopf y 0–2 mit Strähnenpixeln J (164,98,41), E (189,131,57)), Haut C (246,189,123), Schatten B (213,164,98), Licht D (255,213,164).
* SPITZE OHREN links (x 0–4, y 3–6) und rechts (x 12–16, y 3–6): Haut mit hellen Ohrspitzen D/C, dunkler Umriss.
* ZWEI AUGEN (y 4–5): weiße Augäpfel F (255,255,255) — links (8,4), (9,4), (9,5), rechts (11,4), (12,4), (12,5) — mit dunkelroten Pupillen L (90,8,0) bei (8,5) und (11,5) (blicken nach links); über den Augen dichte Brauen A.
* HALS/KRAGEN (x 6–11, y 9–13): brauner Kragen I (139,82,16), darunter Schulterstück in Haut-/Olivtönen K (131,123,65), E, B, grauer Pixel M (204,204,204) (11,11) und weißer Pixel F (7,12) (Kragenschnalle/Schultertuch).
* DUNKELROTER STREIFEN (x 4–5, y 9–15, G (50,0,0)/H (40,0,0)): hängt links unter dem Ohr herab (Tuch/Umhangrest?) — nicht eindeutig, bleibt FEST.
Metall im Sprite: nichts → KEIN Glanz (Regel 14); kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Atmen (Periode 24 = zweimal pro Schleife): die Kragenzeile 9 wird einmal doppelt eingefügt (L.streck_zeile): der Kopf mit Ohren und Haar steigt 1 px, das untere Schulterstück und der Streifen bleiben stehen (Kopf hebt/senkt, nie seitlich).
* Schreckzittern (Frames 14–19 und 38–43): der Kopf zittert in diesen Fenstern jeden zweiten Frame 1 px auf und ab (nur senkrecht).
* Augen wandern: die Pupillen blicken nach rechts (Frames 8–15 und 32–39): links (8,5) → (9,5), rechts (11,5) → (12,5) (Pupille und Weiß tauschen), sonst blicken sie nach links (Original).
* Blinzeln (Frames 20–22 und 44–46): beide Augen (Weiß und Pupillen) nehmen die umgebende Hautfarbe C (246,189,123) an (Lid = Hautfarbe), die Brauen bleiben.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('chaorc-cannon-fodder')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)

HAUT = (246, 189, 123)
PUPILLE = (90, 8, 0)
WEISS = (255, 255, 255)
ERLAUBT = Hm.umrissfarben(spr)


def frame(i, nur=None):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Augen: Blick nach rechts (Pupille und Weiß tauschen) bzw. Blinzeln (Hautfarbe) ---
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 44, [1, 1, 1], N):
        Hm.setze(k, {(x, y): HAUT for (x, y) in ((8, 4), (9, 4), (8, 5), (9, 5), (11, 4), (12, 4), (11, 5), (12, 5))}, OFF)
    elif Hm.folge(i, 8, [1] * 8, N) or Hm.folge(i, 32, [1] * 8, N):
        Hm.setze(k, {(8, 5): WEISS, (9, 5): PUPILLE, (11, 5): WEISS, (12, 5): PUPILLE}, OFF)
    # --- Atmen: Kragenzeile 9 wird einmal doppelt eingefügt, der Kopf steigt ---
    brust = Hm.stufe(i, N / 2, 1)
    if brust:
        k = L.streck_zeile(k, PAD_T + 9, brust)
    # --- Schreckzittern: Kopf jeden zweiten Frame 1 px höher (nur senkrecht) ---
    if (Hm.folge(i, 14, [1] * 6, N) or Hm.folge(i, 38, [1] * 6, N)) and i % 2 == 1:
        k = shift_kopf(k)
    Hm.kontur_schliessen(k, ERLAUBT, (49, 24, 0))
    return k


def shift_kopf(k):
    """Kopf (Zeilen 0…8 des Sprites, über der Kragenzeile) 1 px höher; darunter bleibt alles stehen. Die entstehende Lücke in Zeile 8 wird mit der Kragenfarbe
    der Zeile darunter nicht gefüllt — die Kragenzeile 9 liegt direkt an (Kopf endet in Zeile 8 − 1 = 7, Kinn hängt 4-verbunden an Zeile 9)."""
    out = k.copy()
    y0, y1 = PAD_T, PAD_T + 8                              # Zeilen 0…7 des Sprites steigen
    seg = k[y0:y1 + 1].copy()                              # Zeilen 0…8 (inkl. Kinnzeile 8) steigen, Zeile 8 wird zur Zeile 7
    out[y0 - 1:y1] = seg
    out[y1] = k[y1 + 1] * 0                                 # alte Kinnzeile 8 wird frei … wird gleich durch die Kopie von Zeile 9 überdeckt
    out[y1] = k[y1]                                         # Kinnzeile bleibt (das Kinn „dehnt“ sich nicht): Zeile 8 unverändert
    return out


TEST_EBENEN = ('figur',)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('chaorc-cannon-fodder', 'Chaorc Cannon Fodder', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-cannon-fodder-strip.png', frames, spalten=12, scale=8)
