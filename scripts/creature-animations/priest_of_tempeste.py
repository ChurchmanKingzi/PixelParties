# -*- coding: utf-8 -*-
"""Idle-Animation für „Priest of Tempeste“ (Creature) — der Priester im blauen Spitzhut mit weißem Stirnband, schmalen schwarzen Augenschlitzen, hellblauem Brustjuwel und betend gefalteten Händen.

Quelle: src/priest-of-tempeste.png (16×25 px, 20 Farben, 258 Pixel).
PICK: [["MotiveJapan", 117, 1]]      (Ebene „Priester“, ganze Ebene = eine Figur, 16×25 px; bei creature_show.py als Kandidat 1 mit 87 % Treffer — die Ebene gehört zur Karte, die Kunst hat dort leicht verrauschte Farben)
RUNDE 3 (Nutzer: „fehlt der Unterkörper; er sollte einen sehr ähnlichen Umriss haben wie Priest of Luna“): Die Ebene 117 hat 25 Zeilen; die untersten drei (y 22–24: Robenrand/Gürtel mit türkiser Schnalle und Saumumriss) liegen in der Quelle
halbtransparent (Alpha 127, wie bei Priest of Luna die Ebene mit 70 %) und waren deshalb beim ersten Extrahieren weggefallen (nur die 6 braunen Pixel der Zeile 22 blieben). Jetzt (Regel 22) wird die ganze Ebene voll deckend übernommen
(Alpha 255): 24 Pixel dazu — y 22: (3,22) (4,22) (11,22) (12,22) [Robenrand], y 23: x 3–12 [Robenrand, Gürtelschnalle (21,91,176)/(0,176,234) bei x 6–8], y 24: x 3–12 [Saum (3,17,37)]. Der Umriss gleicht damit dem
von Priest of Luna (dort 3 Zeilen: Gürtel + Schnalle + Saum, ebenfalls x 3–12). Neue Farbe im Sprite (aus der Ebene selbst): (0,176,234) türkis, Gürtelschnalle (wie bei Priest of Luna).
Abgleich mit der Kartenkunst Priest_of_Tempeste.png (76×51): der Priester sitzt dort bei (30,5) (Priesterbüste) — direkt darunter hängt die Ebene „Ebene #70“ (MotiveJapan 116, 18×22 px bei (29,28)): ein türkis umrandetes
Flügelwappen mit einem blauen Hutträger von HINTEN (der Held Tempeste als Rückenfigur mit Aura, Flügeln und Füßchen). Diese Rückenfigur ist ein eigener, von der Büste getrennter Teil der Kartenszene (sie hat eigene Aura,
eigene Flügel und liegt in der Ebenenreihenfolge davor); sie wurde NICHT als Teil der Creature genommen. Falls der Nutzer die Flügelfigur dazu haben möchte, ist Ebene 116 der Kandidat.

Aufruf:   python3 priest_of_tempeste.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/priest-of-tempeste.png + .json

Was im Sprite ist (x, y im 16×23-Sprite):
* HUT (x 0–15, y 0–10): breitkrempiger blauer Hut in (3,17,37)/(21,47,102)/(18,66,131)/(21,91,176)/(39,79,152)/(47,115,218); die Spitze (x 8–14, y 0–4) hängt nach rechts herab; um die Krone liegt ein weißes
  Stirnband (246,255,255)/(213,213,213) bei y 9; zwei graue Metallnieten (189,189,189) sitzen auf der Krempe bei (4,8) und (11,8).
* GESICHT (x 3–12, y 11–15): Haut (246,189,123)/(255,213,164)/(213,164,98)/(180,123,49), graue Brauen (123,123,123) bei (5–6,11) und (9–10,11), zwei schwarze Augenschlitze (0,0,0) bei (5–6,13) und (9–10,13)
  (geschlossene Augen bzw. Visier — nicht eindeutig, deshalb KEIN Blinzeln); Mund nicht gezeichnet.
* KRAGEN/ROBE (x 2–13, y 16–19): blau (21,47,102)/(18,66,131)/(47,115,218)/(21,91,176) mit dunklem Umriss; in der Mitte das hellblaue BRUSTJUWEL (x 7–8, y 18–19): (140,215,246) und (101,203,243).
* ÄRMEL/HÄNDE (x 3–12, y 20–22): weiße Manschetten (246,255,255)/(189,189,189), gefaltete Hände (246,189,123)/(213,164,98), braune Unterkante (49,24,0).
Edelstein im Sprite: nur das Brustjuwel; Metall: die zwei Krempennieten. Nur sie glänzen (Regel 14); Stoff (Hut/Robe), Haut und Stirnband nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife), zweistufig: erst hebt sich die Brust (die einfarbig blaue Robenzeile 17 wird einmal unverändert wiederholt — Texturmischung würde den Halspixel (7–8,16) hineinziehen: Kopf, Gesicht, Hut, Kragen steigen 1 px; Jewel, Manschetten und Hände bleiben unten),
  3 Frames später läuft der Hut nach (Hutzeile 6 — Stoff, kein Gesicht — wird einmal doppelt eingefügt, der Hut steigt 1 px weiter): Hut 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0. Gesicht und Hals werden nicht gestreckt.
* Gürtelschnalle (Runde 3, wie bei Priest of Luna): ein heller Facettenpunkt (246,255,255) wandert in den Frames 27–38 über die drei Schnallenpixel (x 6–8, y 23). Der neue Unterkörper (y 22–24) bleibt beim Atmen unten (Füße-/Saumseite).
* Hutspitze schwingt (Zeilen 0–3): die herabhängende Spitze pendelt zwei Wellen (3 s und 1 s) bis ±2 px, nach unten auslaufend (Gefälle ≤ 1 px je Zeile); die Spitze bleibt über Zeile 4 verbunden.
* Krempe flattert: die äußerste Spalte der linken Krempe senkt sich 1 px (Frames 8–15), später die der rechten (Frames 32–39) — Spitze der Krempe, 4-verbunden mit der Nachbarspalte.
* Brustjuwel funkelt (Regel 14, Edelstein): ein weißer Facettenpunkt (246,255,255) wandert achtmal pro Schleife (je 2 Frames) im Kreis über die vier Juwelpixel (Frames 3–18 und 27–42), und ein vierzackiger
  Glitzerstern liegt in den Frames 20–23 auf dem Juwel (die Arme liegen auf der blauen Robe, innerhalb der Silhouette).
* Metallnieten blitzen: die graue Niete links wird in den Frames 12–13, die rechte in 36–37 kurz hell (Rampe (189,189,189) → (213,213,213) → (246,255,255) des Sprites).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: der Unterkörper (siehe RUNDE 3 oben); sonst wird nichts Verdecktes freigelegt.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('priest-of-tempeste', (4, 4, 4, 2))              # Hutspitze ±2 px, Hut 2 px nach oben, Randabstand ≥ 2
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)

JUWEL = [(7, 18), (8, 18), (8, 19), (7, 19)]
SCHNALLE = [(6, 23), (7, 23), (8, 23)]
WEISS, GRAU1, GRAU2 = sz.f(7, 9), sz.f(4, 8), sz.f(5, 9)       # (246,255,255), (189,189,189), (213,213,213)
HELL1, HELL2 = sz.f(7, 18), sz.f(7, 19)                         # (140,215,246), (101,203,243)


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(sz.vor)
    # --- Juwel: weißer Facettenpunkt wandert ---
    for (a, b) in ((3, 18), (27, 42)):
        if a <= i <= b:
            idx = ((i - a) // 2) % 4
            Hm.setze(k, {JUWEL[idx]: WEISS}, OFF)
    if 27 <= i <= 38:
        Hm.setze(k, {SCHNALLE[((i - 27) // 4) % 3]: WEISS}, OFF)
    # --- Krempennieten blitzen ---
    for (x, start) in ((4, 12), (11, 36)):
        s = Hm.folge(i, start, [1, 2], N)
        if s:
            Hm.setze(k, {(x, 8): GRAU2 if s == 1 else WEISS}, OFF)
    # --- Hutspitze schwingt (Zeilen 0–3, nur rechts der Mitte) ---
    d = int(round(1.4 * np.sin(2 * np.pi * i / N) + 0.8 * np.sin(2 * np.pi * 3 * i / N)))
    Hm.bereich_versatz(k, OFF, K.gefaelle(list(range(0, 4)), d), 8, 15)
    # --- Krempe flattert: äußerste Spalte senkt sich ---
    if K.fenster(i, N, 8, 8) is not None:
        Hm.spalten_versatz(k, OFF, {0: (1, 8, 11)})
    if K.fenster(i, N, 32, 8) is not None:
        Hm.spalten_versatz(k, OFF, {15: (1, 8, 11)})
    # --- Auf und ab: erst Hutzeile 6 (läuft nach), dann Robenzeile 17 (Brust) ---
    hut = Hm.stufe(i - 3, N / 2, 1)
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 6, hut)
    k = K.bob(k, PT + 17, brust, mischen=False)       # Robenzeile ohne Textur; Mischen würde den Halspixel (7–8,16) in die Robe ziehen
    K.kontur(k, sz.ERLAUBT, lambda c, x, y: (3, 17, 37) if c[2] > c[0] else (49, 24, 0))
    out = k if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        Hm.stern4(gl, 8, 18, Hm.folge(i, 20, [0, 1, 2, 1], N), WEISS, HELL1, HELL2, OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Priest of Tempeste', 'priest-of-tempeste', K.vorschau_pfad())
