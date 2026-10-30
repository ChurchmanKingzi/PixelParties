# -*- coding: utf-8 -*-
"""Idle-Animation für „Albrecht, the Nerd“ (Creature) — der Schüler mit der weißen Brille, der Neonstreifen-Jacke und dem roten Buch an der Seite.

Quelle: src/albrecht-the-nerd.png (16×23 px, 49 Farben).
PICK: [["MotiveArcanum", 166, 1]]      (Ebene „Albrecht“, Figur 1; nur in dieser Karte)

Aufruf:   python3 albrecht_the_nerd.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/albrecht-the-nerd.png + .json

Was im Sprite ist (x, y im 16×23-Sprite):
* HAAR (x 1–12, y 0–6): dunkelgraue Mütze/Pilzkopf (Grautöne (25,27,24) … (101,102,100)) mit schwarzem Umriss A (0,2,0); hört in Zeile 6 mit dem Pony über der Stirn auf.
* GESICHT (y 6–10): Stirn (5–6, 6) und Wangen in Hautfarbe K (248,188,119); in Zeile 7–8 ein breites WEISSES Brillenband H (229,231,228) (x 3–4 und 7–9) mit einer schwarzen Brücke (5–6, 7) und Nasenpartie
  (252,231,214) (5–6, 8). Die Augen sind hinter dem Brillenglanz NICHT zu erkennen (weiße Gläser) → kein Blinzeln, kein Blick. Unterhalb Wangen und Kinn (y 9–10), Umriss braun E (49,24,0).
* JACKE (y 11–18): dunkelgrau (J/P/C …) mit Neon-Limettenstreifen O (182,255,0)/R (222,255,74) und dunkelgrünen Abnähern B (79,108,5); Ärmel links (x 0–3) und rechts, Hände in Hautfarbe bei (1,16) und (11–12,16).
* BUCH (x 9–15, y 11–20): rotes Buch D (138,36,31)/N (176,38,37)/S (242,109,42) mit hellen Seitenkanten, das er mit der rechten Hand an der Seite hält (die Lage zum Sprite-Rand ist ein Ausschnitt der Ebene).
* SCHUH (x 3–7, y 19–22): weißer Turnschuh mit roten Details, schwarzer Umriss, dunkelrote Sohle T (17,2,3); nur der linke Schuh ist sichtbar (der rechte steckt hinter dem Buch).
Ohne Metall, Gold oder Edelsteine im Sprite → KEIN Glanz (Regel 14); kein Feuer, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Jackensaumzeile 17 wird einmal doppelt eingefügt: Brust, Arme, Hände, Buch oben und Kopf steigen, Beine/Schuh und die untere
  Buchkante bleiben am Boden), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Halszeile 10, glatte Haut, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Kopfwiegen: der Kopf (Zeilen 0–9: Haar, Brille, Gesicht) neigt sich einmal pro Schleife 1 px nach rechts (Frames 6–13) und später 1 px nach links (Frames 30–37); Hals (Zeile 10) bleibt stehen, der Halsansatz
  bleibt 4-verbunden, Randpixel werden in Umrissfarbe geschlossen.
* Fußtippen: der linke Turnschuh hebt sich dreimal um 1 px (Frames 24–35, je 2 Frames oben, 2 unten) hinter den Jackensaum und senkt sich wieder — wie ein ungeduldiges Warten.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Schuh wird nur hinter den Saum geschoben, der Hals bleibt; nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2          # Figur knapp zugeschnitten: Kopfhub 2 px (oben), Randabstand 2

spr = L.lade('albrecht-the-nerd')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS = tuple(int(v) for v in spr[0, 4, :3])                      # A (0,2,0)
ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)

fuss = vorhanden & (xx >= 3) & (xx <= 7) & (yy >= 19)             # linker Turnschuh
rumpf = vorhanden & ~fuss


def frame(i):
    k, _ = L.trenne(spr, rumpf)
    k = L.platz(k, H, W, PAD_L, PAD_T)
    # --- Kopfwiegen: Zeilen 0–9 gemeinsam 1 px seitlich (Hals Zeile 10 bleibt) ---
    dx = 1 if Hm.folge(i, 6, [1] * 8, N) else (-1 if Hm.folge(i, 30, [1] * 8, N) else 0)
    if dx:
        Hm.bereich_versatz(k, OFF, {y: dx for y in range(0, 10)}, 0, sw - 1)
    # --- Auf und ab: Jackensaum (Zeile 17) = Brust, Hals (Zeile 10) läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 17, PAD_T + 10, brust, kopf)
    # --- Fußtippen: der Schuh liegt hinter dem Saum und hebt sich 1 px ---
    hoch = 1 if (Hm.folge(i, 24, [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0], N)) else 0
    f, _ = L.trenne(spr, fuss)
    f = L.platz(f, H, W, PAD_L, PAD_T - hoch)
    fig = L.zusammen(H, W, [(f, 0, 0), (k, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)                      # Regel 16: Außenkante in jeder Pose in Umrissfarbe
    return fig


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
    L.speichern('albrecht-the-nerd', 'Albrecht, the Nerd', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/albrecht-the-nerd-strip.png', frames, spalten=12, scale=6)
