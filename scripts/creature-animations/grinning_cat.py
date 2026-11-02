# -*- coding: utf-8 -*-
"""Idle-Animation für „Grinning Cat“ (Creature).

Quelle: src/grinning-cat.png — Ebene „Ebene #13“ (25×26 px, 23 Farben) aus MotiveBritain.xcf (Ebene 230): das grinsende Katzengesicht mit gelben Augen, rosa „Gitter“-Stirn und vier rosa
Diagonalstrichen in den Ecken (vom Sprite-Abgleich als Figur 1 [Gesicht, 25×21 inkl. oberer Striche] und Figuren 2/3 [die unteren Striche, 7×7] gefunden — hier die ganze Ebene). Es ist der
einzige karten-eigene Sprite der Karte. Die Karte zeigt zusätzlich blauviolette Büsche (Kulissen, nicht Teil der Figur) und eine violett-rosa Zunge (Ebene 229 „Umriss+Zunge“, 21×31 px mit anderen Farben
als in der Kunst — nicht eindeutig zuzuordnen; nicht übernommen, im Bericht erwähnt).
PICK: [["MotiveBritain", 230, "ganze Ebene"]]

Aufruf:   python3 grinning_cat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/grinning-cat.png + .json

Identifikation (Sprite 25×26, symmetrisch um x = 12; Koordinaten im Sprite):
* Stirn-/Grinsbogen (x 7–17, Zeilen 3–9): rosa Bogen aus D (183,117,142) / F (209,152,178) / H / I (220,167,196) / K, darin senkrechte graue und weißlila Balken E (64,64,64) / L (197,190,218) / M (227,225,237) /
  N (203,198,225) — wie ein Gitter bzw. eine Zahnreihe; in der Mitte (11–13,8–9) dunkelrosa Q (102,57,93) / P (169,49,110) (Nasenwulst).
* Gesicht (x 5–19, Zeilen 10–16): Karminrot B (127,38,63) / C (101,21,34) / G (150,45,74) / J (70,11,24).
* Augen: links (9–10,11–13), rechts (14–15,11–13): oben ein graues U (195,197,201) und ein schwarzes V (17,19,19) Pixel (Pupille/Lichtpunkt), darunter gelb R (215,196,43) / S (239,222,91).
* Mund (Zeilen 15–19): zwei dunkelblaue Balken O (18,18,43) bei (8–10,15) und (14–16,15), darunter die Kinnleiste (Zeile 16) und zwei rosa Fänge/Zipfel T (164,94,116) / W (125,54,71) bei (8,17) (8,18) und (16,17) (16,18).
* Vier rosa Diagonalstriche A (26,26,53)-umrandet in den Ecken ((1–5,0–5), (19–23,0–5), (0–4,20–25), (20–24,20–25)): sie liegen auf zwei Geraden durch das Gesicht (gekreuzte „Knochen“ oder Schnurrhaare?) —
  nicht eindeutig, bleiben fest.
* Kein Metall/Gold/Edelstein → kein Glanz/Glitzer (Regel 14); die weißen Balken der Stirn sind Teil der Zeichnung (keine Partikel, nicht bewegt).
Bleibt fest: Eckstriche, Mundbalken, Fänge, Kinn.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Ducken/Schnurren (Squash, ohne Zeilenkopie): zweimal pro Schleife (Frames 6–16 und 30–40) sinkt der ganze Oberkopf (Stirn + Augen) um 1 px, indem die einheitliche Wangenzeile 14 entfernt wird
  (anim_lib.streck_zeile mit n = −1: Mund und Fänge bleiben stehen, nichts wird dupliziert).
* Blinzeln: zweimal pro Schleife (Frames 20–22 und 43–45): obere Augenzeile → Gesichtsfarbe B, dann beide Augen als schwarze Linie V (Lid = Gesichtsfarbe).
* Blick: die Pupille wechselt die Seite (Pixel U und V tauschen): beide Augen blicken nach links (Frames 8–14: linkes Auge getauscht) bzw. nach rechts (Frames 28–34: rechtes Auge getauscht); die Grundstellung
  ist ein leichtes Schielen zur Mitte (wie gezeichnet).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

spr = L.lade('grinning-cat')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]
ECKEN = vor & (((yy <= 5) & ((xx <= 5) | (xx >= 19))) | ((yy >= 20) & ((xx <= 4) | (xx >= 20))))
gesicht = vor & ~ECKEN
GESICHTSFARBE = (127, 38, 63)
SCHWARZ_V = (17, 19, 19)
GRAU_U = (195, 197, 201)
AUGEN_OBEN = [(9, 11), (10, 11), (14, 11), (15, 11)]
AUGEN_MITTE = [(9, 12), (10, 12), (14, 12), (15, 12)]
AUGEN_UNTEN = [(9, 13), (10, 13), (14, 13), (15, 13)]


def in_fenster(i, s, n):
    return s <= i < s + n


def zustand(i):
    duck = in_fenster(i, 6, 11) or in_fenster(i, 30, 11)
    lid = 0
    for s in (20, 43):
        if 0 <= i - s < 3:
            lid = (1, 2, 1)[i - s]
    blick_l = in_fenster(i, 8, 7)
    blick_r = in_fenster(i, 28, 7)
    return duck, lid, blick_l, blick_r


def frame(i, nur=None):
    duck, lid, bl, br = zustand(i)
    g, _ = L.trenne(spr, gesicht)
    g = L.platz(g, H, W, PAD_L, PAD_T)
    e, _ = L.trenne(spr, ECKEN)
    e = L.platz(e, H, W, PAD_L, PAD_T)

    def setze(x, y, c):
        g[PAD_T + y, PAD_L + x, :3] = c
    if bl:                                                # linkes Auge: Pupille nach links
        setze(9, 11, SCHWARZ_V); setze(10, 11, GRAU_U)
    if br:                                                # rechtes Auge: Pupille nach rechts
        setze(14, 11, GRAU_U); setze(15, 11, SCHWARZ_V)
    if lid:
        for (x, y) in AUGEN_OBEN:
            setze(x, y, GESICHTSFARBE)
        if lid == 2:
            for (x, y) in AUGEN_MITTE:
                setze(x, y, SCHWARZ_V)
            for (x, y) in AUGEN_UNTEN:
                setze(x, y, GESICHTSFARBE)
    if duck:
        g = L.streck_zeile(g, PAD_T + 14, -1)
    ebenen = {'gesicht': g, 'ecken': e}
    wahl = nur or ('gesicht', 'ecken')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('grinning-cat', 'Grinning Cat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/grinning-cat-strip.png', frames, spalten=12, scale=8)
