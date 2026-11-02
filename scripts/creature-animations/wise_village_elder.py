# -*- coding: utf-8 -*-
"""Idle-Animation für „Wise Village Elder“ (Creature) — der weise Dorfälteste: weißer Bart und Haarzacken, grüner Gürtel, am linken Arm ein langer brauner Stab, rechts ein grüner Ärmel mit Hand.

Quelle: src/wise-village-elder.png (16×24 px, 24 Farben, 258 Pixel).
PICK: [["MotiveCoolhalla", 44, 1]]      (Ebene „Ebene #179“, ganze Ebene = eine Figur samt Stab, 16×25 px; nur in dieser Karte — die Treffer der Ebenen „Ebene #460“/„Ebene #212“ (16×15, 16×13 …) sind Büsche)
Abgleich mit der Kartenkunst Wise_Village_Elder.png (76×51): Sprite sitzt dort bei (30,5), 99,6 % pixelgleich. Auf der Karte stehen außerdem das Pflaster, zwei Büsche, Gras und ein Held (schwarzer Haarschopf, blaues Gewand)
unten im Bild — nichts davon gehört zum Ältesten.

Aufruf:   python3 wise_village_elder.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/wise-village-elder.png + .json

Was im Sprite ist (x, y im 16×24-Sprite):
* HAARZACKEN (x 5–11, y 0–4): sieben dünne graue/weiße Haarspitzen (189,189,189)/(213,213,213) über der Stirn.
* KOPF (x 4–12, y 4–9): Stirn und Gesicht in Hauttönen (246,189,123)/(255,213,164)/(213,164,98), weißes Haar an den Seiten (213,213,213)/(246,255,255)/(189,189,189), braune Ränder (49,24,0)/(148,90,24);
  die zwei dunkelgrauen Striche (123,123,123) bei (5–6,9) und (9–10,9) sind Augenbrauen/Augen (schmale Schlitze, keine Iris sichtbar) — KEIN Blinzeln (nicht eindeutig).
* BART (x 4–11, y 10–23): langer Bart in senkrechten Streifen (123,123,123)/(213,213,213)/(246,246,246)/(189,189,189), läuft unten spitz zu (Spitze x 7–8, y 21–23).
* STAB (x 0–3, y 8–23): brauner Wanderstab (90,32,0)/(164,74,41)/(205,115,57)/(238,156,123)/(123,41,16) mit Krümmung oben bei (1–4, 8–9); die linke Hand (246,189,123)/(213,164,98)/(180,123,49) umfasst ihn bei (0–2, 14–15).
* RECHTER ARM (x 11–15, y 12–15): grüner Ärmel (82,131,0)/(41,65,0)/(8,32,0), braune Manschette (148,90,24), Hand (246,189,123)/(213,164,98)/(180,123,49) bei (13–14, 14–15).
* GÜRTEL/ROBE (x 3–14, y 19–23): hell- und dunkelgrüner Gürtel (123,172,16)/(65,115,0)/(131,189,24)/(8,32,0)/(41,65,0) und braune Robe (205,115,57)/(123,41,16)/(49,8,0), schwarze Sohle (0,0,0).
Metall/Gold/Edelsteine im Sprite: keine. Es glänzt nichts (Regel 14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Gürtelzeile 20 wird einmal doppelt eingefügt (Texturmischung): Kopf, Haarzacken, Bart, Arme und Hände steigen 1 px; Stab-Oberteil und Hand steigen mit
  (der Stab bekommt dabei eine Schaftzeile mehr, sein Fuß bleibt am Boden); Robe und Sohle bleiben. Der Kopf bleibt starr (kein seitliches Neigen).
* Haarzacken wehen (Zeilen 0–1): sie biegen sich zweimal pro Schleife 1 px nach rechts (Frames 6–11 und 30–35) bzw. nach links (Frames 18–23 und 42–47), Zeile 2 bleibt starr (die Zacken sind in Zeile 3 verankert).
* Bartspitze pendelt (Zeilen 21–23, Kern x 7–8): die Spitze schwingt zweimal pro Schleife 1 px nach rechts (Frames 8–15 und 32–39) und dazwischen nach links (Frames 20–27 und 44–47); der freigewordene Hintergrund wird mit der
  Nachbarfarbe (Gürtelgrün) ergänzt (anim_krieger.schieben_fuellen), Frame 0 = Ruhe.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: beim Pendeln der Bartspitze werden die freigelegten Pixel hinter der Spitze mit der Farbe des Nachbarpixels ergänzt (nur Quellfarben, Grünton des Gürtels bzw. Robenbraun).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('wise-village-elder', (3, 3, 3, 2))               # Haarzacken ±1 px, Wippen 1 px, Randabstand ≥ 2
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur',)
    k = sz.ebene(sz.vor)
    # --- Haarzacken wehen (Zeilen 0–1) ---
    d = 1 if (K.fenster(i, N, 6, 6) is not None or K.fenster(i, N, 30, 6) is not None) else (
        -1 if (K.fenster(i, N, 18, 6) is not None or K.fenster(i, N, 42, 6) is not None) else 0)
    if d:
        Hm.bereich_versatz(k, OFF, {0: d, 1: d}, 0, 10)           # das Pixel (11,1) bleibt: es hängt nur diagonal an (10,2)
    # --- Bartspitze pendelt (Zeilen 21–23, Kern) ---
    b = 1 if (K.fenster(i, N, 8, 8) is not None or K.fenster(i, N, 32, 8) is not None) else (
        -1 if (K.fenster(i, N, 20, 8) is not None or K.fenster(i, N, 44, 4) is not None) else 0)
    if b:
        K.schieben_fuellen(k, OFF, {21: b, 22: b}, 7, 8)
        K.schieben_fuellen(k, OFF, {23: b}, 7, 7)
    # --- Auf und ab: Gürtelzeile 20 doppelt ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 20, brust)
    Hm.kontur_schliessen(k, sz.ERLAUBT, (49, 24, 0))               # Regel 16
    return k


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Wise Village Elder', 'wise-village-elder', K.vorschau_pfad())
