# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Monstrosity“ (Creature).

Quelle: src/deepsea-monstrosity.png — Ebene „Monstrosity“ (60×60 px, 885 Pixel, 12 Farben) aus MotiveDeepsea.xcf (Ebene 339; Ebene 340 „Ebene #10“ ist dieselbe Figur, nur die RGB-Werte der leeren Pixel unterscheiden sich;
die Ebenen 337/338 „Monstrosity #2/#1“ sind größere Szenenkopien in anderer Drehung). Gegen die Kartenkunst (data/card-art/native/Deepsea_Monstrosity.png) abgeglichen: gleiche Form und Lage. Die Kunst ist
blau getönt, deshalb fand der Treffer-Suchlauf die Ebene nicht. Zwei isolierte Einzelpixel in den Ebenenecken ((0,59) und (30,52), ohne jeden Nachbarn) sind Ebenenreste und wurden weggelassen (die Figur ist 45×52).
Halbtransparenz: nur ein einziges Pixel hat Alpha 204 (sonst 255), Alpha ≥ 100 → deckend.
PICK: [["MotiveDeepsea", 339, 1]]

Aufruf:   python3 deepsea_monstrosity.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-monstrosity.png + .json

Was ist was (x/y im Sprite, 45×52):
* Ein baumartiges Tiefsee-Ungeheuer in Nachtblau (13,16,49)/(16,22,55)/(20,31,63)/(25,40,70): ein dicker, schachbrett-gerasterter Stamm (x 18–29, y 1–51), der oben zu einem Haken eingerollt ist (Bogen y 0–3, die Hakenspitze
  hängt links bei x 14–17, y 2–8), unten zu einem breiteren Fuß ausläuft. Am Bogen sitzt ein weißes 2×2-Licht (255,255,255) bei (23–24, 2–3) (Köderlicht des Anglers), mitten im Stamm ein zweites bei (26–27, 32–33).
* Zwei MÜNDER (Zähne weiß/grau (255,255,255)/(227,227,227)/(201,201,201), Inneres dunkelrot (57,0,0)/(11,0,0), schwarzer Rand (0,0,0)): ein großer senkrechter Mund im Stamm (x 20–23, y 27–36, Zähne zickzack in den
  zwei Innenspalten x 21–22) und ein kleiner rechts am Zweig (x 34–38, y 27–30, vier Zähne) — keine Augen (Regel 21), deshalb kein Blinzeln.
* Viele dünne 1-px-Linien: rote Tentakelfäden (70,10,10) (zwei Bündel: oben rechts x 31–44, y 3–26; links x 0–16, y 11–50) und dunkelblaue Haarlinien (13,16,49) (links neben dem Stamm, x 9–13, y 29–33 gestrichelt).
  Sie hängen nur DIAGONAL zusammen (4er-Komponenten: Kern 773 Pixel, 112 Pixel Ranken).
Fest bleiben: Mundform, Köderlichter (nur Helligkeit), der Fuß am Boden.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Partikel ausgenommen):
* Stamm wiegt sich: der Kern (alle 4-verbundenen Pixel) verschiebt sich zeilenweise waagerecht, der Versatz wächst vom Fuß (y 46, fest) nach oben (bis ±2 px an der Haken-Spitze), mit Nachlauf nach oben (Periode 24);
  benachbarte Zeilen unterscheiden sich um höchstens 1 px.
* Ranken wogen (Technik wie bei Deepsea Werewolf): alle 112 Rankenpixel werden von innen nach außen so versetzt, dass jedes 8er-Nachbar seines versetzten Elternpixels bleibt (reißt nichts, keine Brückenpixel); der Versatz wächst mit dem Abstand zum
  Kern und summiert sich entlang der Linie (bis ≈ 2–3 px waagerecht; waagerechte Linienstücke bleiben waagerecht), die Welle läuft von oben nach unten durch die Bündel (Periode 24, also zweimal pro Schleife).
* Köderlichter pulsieren auf der Grauleiter (255,255,255) → (227,227,227) → (201,201,201): das obere Licht Periode 16, das mittlere Periode 24 (kein Funkeln/Sterne, Regel 14).
* Mäuler kauen: im großen Mund tauschen alle acht Zahnpaare die Spalte (Zickzack kippt; Frame 3–5, 9–11, … alle 12 Frames), im kleinen Mund tauscht die Zahnreihe mit der Reihe darüber (Frame 6–9, 22–25, 38–41).
* Partikel (hinter der Figur): vier dunkelrote Sporen (Kern (70,10,10), Rand (57,0,0)), zwei steigen links oben, zwei rechts unten aus dem Bereich der Ranken auf; runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`).
Kein Glanz (Regel 14), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts.
Ergänzungen: keine gemalten Pixel außer Umrisspixeln an bewegten Kanten. Alle Farben aus der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Partikel höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import math

import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-monstrosity')
S = T.Szene('deepsea-monstrosity', 'Deepsea Monstrosity', spr, N, MS, rand=(8, 8, 8, 6))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
col = S.col
KONTUR = (13, 16, 49)
WEISS, GRAU1, GRAU2 = (255, 255, 255), (227, 227, 227), (201, 201, 201)
RAMPE = [WEISS, GRAU1, GRAU2]

R = T.Ranken(spr)
KERN = R.kern
LICHT_O = [(23, 2), (24, 2), (23, 3), (24, 3)]
LICHT_M = [(26, 32), (27, 32), (26, 33), (27, 33)]
assert all(col(x, y) == WEISS for x, y in LICHT_O + LICHT_M)
MUND_G = [(x, y) for y in range(28, 36) for x in (21, 22)]            # Innenspalten des großen Mundes
assert all(col(x, y) in ((57, 0, 0), WEISS, GRAU1, GRAU2) for x, y in MUND_G)
MUND_K = [(x, 28) for x in (35, 36, 37)]
MUND_K2 = [(x, 29) for x in (35, 36, 37)]
assert all(col(x, y) in ((57, 0, 0), GRAU1, GRAU2, WEISS) for x, y in MUND_K + MUND_K2)
KERN_A = S.teil(KERN)
FUSS_Y = 46


def zeile_dx(y, i):
    if y >= FUSS_Y:
        return 0
    g = ((FUSS_Y - y) / FUSS_Y) ** 1.2
    return int(round(2.0 * g * (math.sin(L.sinus(i, 24) - 1.4 * g) - math.sin(-1.4 * g))))


def kern_ebene(i):
    kb = KERN_A.copy()
    # Lichter pulsieren
    so = U.stufe(i, 16, 2)
    sm = U.stufe(i, 24, 2)
    for (x, y) in LICHT_O:
        kb[GPT + y, GPL + x, :3] = RAMPE[so]
    for (x, y) in LICHT_M:
        kb[GPT + y, GPL + x, :3] = RAMPE[sm]
    # großer Mund kaut: Zahnpaare tauschen die Spalte
    if (i % 12) in (3, 4, 5):
        for y in range(28, 36):
            a, b = kb[GPT + y, GPL + 21, :3].copy(), kb[GPT + y, GPL + 22, :3].copy()
            kb[GPT + y, GPL + 21, :3], kb[GPT + y, GPL + 22, :3] = b, a
    # kleiner Mund: Zahnreihe tauscht mit der Reihe darüber
    if (i % 16) in (6, 7, 8, 9):
        for x in (35, 36, 37):
            a, b = kb[GPT + 28, GPL + x, :3].copy(), kb[GPT + 29, GPL + x, :3].copy()
            kb[GPT + 28, GPL + x, :3], kb[GPT + 29, GPL + x, :3] = b, a
    # Wiegen: Zeilenversatz
    out = L.leer(H, W)
    for y in range(sh):
        dx = zeile_dx(y, i)
        for x in np.nonzero(kb[GPT + y, :, 3])[0]:
            if not 0 <= x + dx < W:
                raise L.ClipError('Stamm außerhalb')
            out[GPT + y, x + dx] = kb[GPT + y, x]
    return out


def wunsch_fn(i):
    A = 2.4
    ph = L.sinus(i, 24)

    def w(x, y, g):
        k = -0.05 * x - 0.14 * y
        wx = A * g * (math.sin(ph + k) - math.sin(k))
        return wx, 0.0
    return w


def frame_gross(i, nur=None):
    kb = kern_ebene(i)
    ra = R.ebene(i, H, W, GPL, GPT, wunsch_fn(i), kern_dx=lambda y: zeile_dx(y, i))
    f = L.zusammen(H, W, [(ra, 0, 0), (kb, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    rot = {'c': (70, 10, 10), 'r': (57, 0, 0)}
    p1 = U.wolke_ebene(H, W, i, 48, [dict(x=P(6, 27)[0], y=P(6, 27)[1], vx=1, vy=-14, off=0, wackeln=0.7),
                                      dict(x=P(3, 25)[0], y=P(3, 25)[1], vx=-1, vy=-14, off=24, wackeln=0.7),
                                      dict(x=P(37, 50)[0], y=P(37, 50)[1], vx=1, vy=-13, off=12, wackeln=0.7),
                                      dict(x=P(41, 48)[0], y=P(41, 48)[1], vx=0, vy=-13, off=36, wackeln=0.7)], rot)
    return L.zusammen(H, W, [(p1, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21])
