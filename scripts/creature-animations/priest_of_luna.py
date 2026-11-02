# -*- coding: utf-8 -*-
"""Idle-Animation für „Priest of Luna“ (Creature) — der Priester im roten Zackenhut mit weißem Stirnband, schmalen schwarzen Augenschlitzen, orangerotem Brustjuwel, blauer Gürtelschnalle und betend gefalteten Händen.

Quelle: src/priest-of-luna.png (16×24 px, 20 Farben, 295 Pixel).
PICK: [["MotiveHawaii", 200, 1]]      (Ebene „Ebene #13“ in MotiveHawaii, Deckkraft der Ebene 70 %, ganze Ebene = eine Figur, 16×24 px; kein Treffer von creature_show.py, weil die Karte sie halbtransparent mischt)
Halbtransparente Quelle (Regel 22): die Ebenenpixel selbst sind voll deckend (Alpha 255), erst die Ebene hat 70 % Deckkraft; der Sprite ist daher voll deckend. Im Spiel soll die Figur nicht halbtransparent
erscheinen (kein deckkraft-Feld), da der Nutzer das nicht verlangt hat.
Abgleich mit der Kartenkunst Priest_of_Luna.png (76×51): die Büste steht dort bei (30,5) (im Bild ausgeblichen, weil 70 % über der Lava) — darunter liegt ein rot umrandetes Flügelwappen („Ebene #15“, MotiveHawaii 196,
18×23 px) mit einer Rückenfigur und goldenen Flügeln: ein eigener, von der Büste getrennter Teil der Szene (eigene Aura/Flügel); er wurde NICHT als Teil der Creature genommen. Falls der Nutzer die Flügelfigur dazu haben möchte,
ist Ebene 196 der Kandidat. Die Ebene „Ebene #16“ (Flamme) und „Ebene #14“ (brauner Fels) gehören zum Hintergrund.

Aufruf:   python3 priest_of_luna.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/priest-of-luna.png + .json

Was im Sprite ist (x, y im 16×24-Sprite):
* HUT (x 0–15, y 0–10): roter Zackenhut in (63,9,9)/(125,33,33)/(171,49,49)/(179,51,51)/(152,42,42)/(224,98,71), oben drei Zacken (x 2–3, 7/9, 13–14); um die Krone liegt ein weißes Stirnband (246,255,255)/(213,213,213) bei y 8;
  zwei graue Metallnieten (189,189,189) sitzen auf der Krempe bei (4,7) und (11,7).
* GESICHT (x 3–12, y 10–15): Haut (246,189,123)/(255,213,164)/(213,164,98)/(180,123,49), graue Brauen (123,123,123) bei (5–6,10) und (9–10,10), zwei schwarze Augenschlitze (0,0,0) bei (5–6,12) und (9–10,12)
  (geschlossene Augen bzw. Visier — nicht eindeutig, deshalb KEIN Blinzeln); Hals (7–8, 14–15).
* KRAGEN/ROBE (x 2–13, y 15–18): rot (125,33,33)/(171,49,49)/(179,51,51)/(63,9,9); in der Mitte das orangerote BRUSTJUWEL (x 7–8, y 17–18): (224,98,71)/(219,72,40).
* ÄRMEL/HÄNDE (x 3–12, y 19–21): weiße Manschetten (246,255,255)/(189,189,189), gefaltete Hände (246,189,123)/(213,164,98)/(180,123,49), braunes Band (49,24,0) bei y 21.
* GÜRTELSCHNALLE (x 6–8, y 22): blau (21,91,176) und türkis (0,176,234) — als Edelstein/Schnalle gelesen.
Edelsteine im Sprite: Brustjuwel und Schnalle; Metall: die zwei Krempennieten. Nur sie glänzen (Regel 14); Stoff (Hut/Robe), Haut und Stirnband nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife), zweistufig: erst hebt sich die Brust (die einfarbig rote Robenzeile 16 wird einmal unverändert wiederholt — Texturmischung würde den Halspixel (7–8,15) hineinziehen:
  Kopf, Gesicht, Hut, Kragen steigen 1 px; Juwel, Manschetten und Hände bleiben unten), 3 Frames später läuft der Hut nach (Hutzeile 5 — Stoff, kein Gesicht — wird einmal doppelt eingefügt, der Hut steigt 1 px weiter):
  Hut 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0. Gesicht und Hals werden nicht gestreckt; der Kopf bleibt starr.
* Krempe flattert: die äußerste Spalte der linken Krempe senkt sich 1 px (Frames 8–15), später die der rechten (Frames 32–39) — 4-verbunden mit der Nachbarspalte.
* Brustjuwel funkelt (Regel 14, Edelstein): ein heller Facettenpunkt (246,255,255) wandert im Kreis über die vier Juwelpixel (je 2 Frames, Frames 3–18), dazu ein vierzackiger Glitzerstern auf dem Juwel (Frames 20–23); die Arme
  liegen auf der Robe, innerhalb der Silhouette. Die blaue Gürtelschnalle bekommt später denselben wandernden Facettenpunkt (Frames 27–38, drei Pixel).
* Metallnieten blitzen: die graue Niete links wird in den Frames 12–13, die rechte in 36–37 kurz hell (Rampe (189,189,189) → (213,213,213) → (246,255,255) des Sprites).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('priest-of-luna', (4, 4, 4, 2))                   # Hut 2 px nach oben, Randabstand ≥ 2
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)

JUWEL = [(7, 17), (8, 17), (8, 18), (7, 18)]
SCHNALLE = [(6, 22), (7, 22), (8, 22)]
WEISS = sz.f(6, 8)                                             # (246,255,255)
GRAU2 = sz.f(5, 8)                                             # (213,213,213)
ARM1, ARM2 = sz.f(7, 17), sz.f(8, 18)                          # (224,98,71), (219,72,40)


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(sz.vor)
    # --- Brustjuwel: Facettenpunkt wandert; Schnalle später ---
    if 3 <= i <= 18:
        Hm.setze(k, {JUWEL[((i - 3) // 2) % 4]: WEISS}, OFF)
    if 27 <= i <= 38:
        Hm.setze(k, {SCHNALLE[((i - 27) // 4) % 3]: WEISS}, OFF)
    # --- Krempennieten blitzen ---
    for (x, start) in ((4, 12), (11, 36)):
        s = Hm.folge(i, start, [1, 2], N)
        if s:
            Hm.setze(k, {(x, 7): GRAU2 if s == 1 else WEISS}, OFF)
    # --- Krempe flattert: äußerste Spalte senkt sich ---
    if K.fenster(i, N, 8, 8) is not None:
        Hm.spalten_versatz(k, OFF, {0: (1, 8, 10)})
    if K.fenster(i, N, 32, 8) is not None:
        Hm.spalten_versatz(k, OFF, {15: (1, 8, 10)})
    # --- Auf und ab: erst Hutzeile 5 (läuft nach), dann Robenzeile 16 (Brust) ---
    hut = Hm.stufe(i - 3, N / 2, 1)
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 5, hut)
    k = K.bob(k, PT + 16, brust, mischen=False)
    K.kontur(k, sz.ERLAUBT, lambda c, x, y: (63, 9, 9) if y < 14 + PT + 1 else (49, 24, 0))   # Regel 16
    out = k if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        Hm.stern4(gl, 8, 17, Hm.folge(i, 20, [0, 1, 2, 1], N), WEISS, ARM1, ARM2, OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Priest of Luna', 'priest-of-luna', K.vorschau_pfad())
