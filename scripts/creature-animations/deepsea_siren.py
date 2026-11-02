# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Siren“ (Creature).

Quelle: src/deepsea-siren.png — zusammengesetzt aus drei Ebenen derselben Szene in MotiveDeepsea.xcf, an ihrer gemeinsamen Ebenenposition (alle Alpha 0/255, 38×54 px, 580 Pixel):
  Ebene 327 „Siren“ (25×28, die Sirene selbst), Ebene 325 „Ebene #164“ (29×35, dünne dunkelrote/dunkelblaue Haar-Ranken um sie; in der Kartenkunst dieselben Linien um den Kopf)
  und Ebene 324 „Ebene #167“ (37×46, sechs farbige Musiknoten, die sie singt). Der Treffer-Suchlauf (Kandidaten 3, 4, 5, 13, 15) fand nur die Noten und Ranken als „in 1 Karte“ — die Sirene selbst fehlt dort wegen der blauen Tönung.
  Gegen die Kartenkunst (data/card-art/native/Deepsea_Siren.png) abgeglichen: gleiche Anordnung von Noten, Ranken und Sirene. Stapelreihenfolge wie in der xcf (Noten oben, dann Sirene, Ranken unten).
PICK: [["MotiveDeepsea", 327, 1], ["MotiveDeepsea", 325, 1], ["MotiveDeepsea", 324, 1]]   (alle Ebenen komplett, Alpha ≥ 100 → deckend; kein Pixel halbtransparent)

Aufruf:   python3 deepsea_siren.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-siren.png + .json

Was ist was (x/y im Sprite, 38×54):
* Die Sirene (x 18–36, y 25–53): Kopf in Teal-Schachbrett (51,93,119)/(77,137,154) mit dunklem Umriss (13,16,49)/(30,48,81), zwei große weiße 2×2-Augen (246,255,255) bei (22–23, 31–32) und (26–27, 31–32), rosa Wangen
  (255,201,237)/(255,128,213) bei (21,33) / (28–29, 33–34), einem schwarz geöffneten Singmund (0,0,0) (23–25, 34–35), darunter ein schmaler Rumpf, der in einen Flossenschwanz (x 23–36, y 40–53) ausläuft.
* Haar-Ranken: dünne 1-px-Linien in Dunkelrot (70,10,10) und Dunkelblau (13,16,49) (rechts oben um den Kopf bis y 19, links hinunter bis (14,44), rechts unten bis (37,50)), nur diagonal mit dem Körper verbunden.
* Sechs Noten (Stiel 1 px + Notenkopf, je eine eigene Farbe): Marine (links oben, x 1–6, y 0–10), Blau (rechts oben, x 29–35, y 0–10), Flieder (Mitte, x 15–19, y 9–21), Rot (rechts, x 34–38, y 12–25), Gelb (links, x 5–11, y 25–35), Grün (mitte links, x 15–21, y 33–46).
  Die Notenfarben (36 Farben der Ebene 324) kommen nur dort vor; Noten sind keine Metall-/Edelstein-Glanzobjekte (kein Funkeln).
Fest bleiben: Gesichtsform, Augengröße, Wangen, Notenformen.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Schweben: die Sirene wiegt sich senkrecht ±1 px (Periode 24); der Flossenschwanz schlägt als Welle mit Nachlauf (Zeilenversatz ab y 40, bis ±2 px, Periode 16 und 24).
* Singen: der Mund öffnet sich weiter (3×3, eine Zeile länger) bzw. schmaler (2×2) im Wechsel (Frame 4–9, 16–21, 28–33, 40–45 abwechselnd weit/schmal), dabei hebt sich der Kopf mit.
* Blinzeln beider Augen (Lid = Haut im Schachbrett): Frame 12–14 und 36–38.
* Haar-Ranken wogen (Technik wie bei Deepsea Werewolf, `anim_tiefsee.Ranken`): von innen nach außen so versetzt, dass jedes Pixel 8er-Nachbar seines Elternpixels bleibt (bis ≈ 3 px waagerecht, Welle läuft von oben nach unten, Periode 24).
* Noten schweben je für sich (unterschiedliche Perioden 48/24/16/12/48/24, ±2 px senkrecht, ±1 px waagerecht); Pixel der Sirene bzw. der Ranken, die im Ruhebild von einer Note verdeckt sind (15 Pixel, siehe HIDDEN), sind aus den Originalebenen
  ergänzt, damit beim Wegschweben nichts fehlt.
Kein Feuer. Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts. Alle Farben aus der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, dazu 1 px leerer Rand). Keine Blasen (die Noten sind die „Partikel“).
"""
import math

import cv2
import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-siren')
S = T.Szene('deepsea-siren', 'Deepsea Siren', spr, N, MS, rand=(8, 8, 8, 7))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
col = S.col
KONTUR = (13, 16, 49)
SCHWARZ, WEISS = (0, 0, 0), (246, 255, 255)
HELL, DUNKEL = (77, 137, 154), (51, 93, 119)

NOTENFARBEN = [(13, 58, 14), (14, 39, 57), (15, 11, 42), (21, 59, 86), (23, 17, 64), (33, 142, 36), (36, 97, 141), (39, 29, 106), (41, 113, 164), (41, 172, 44), (44, 121, 177), (45, 33, 122), (48, 130, 189),
               (49, 36, 133), (51, 39, 140), (61, 46, 165), (64, 40, 72), (66, 69, 23), (69, 23, 23), (69, 150, 208), (77, 212, 80), (99, 103, 34), (128, 104, 160), (152, 128, 184), (158, 231, 159),
               (160, 168, 56), (168, 56, 56), (187, 195, 76), (195, 76, 76), (200, 176, 232), (201, 207, 112), (214, 219, 147), (219, 147, 147), (248, 248, 248), (249, 250, 241), (250, 241, 241)]
HIDDEN = {(34, 22): (13, 16, 49), (34, 23): (13, 16, 49), (34, 24): (13, 16, 49), (20, 35): (70, 10, 10), (20, 37): (13, 16, 49), (20, 38): (51, 93, 119), (20, 39): (13, 16, 49),
          (20, 40): (51, 93, 119), (20, 41): (77, 137, 154), (20, 42): (13, 16, 49), (19, 43): (13, 16, 49), (17, 44): (77, 137, 154), (18, 44): (13, 16, 49), (17, 45): (13, 16, 49), (18, 45): (13, 16, 49)}

notes = L.farbmaske(spr, NOTENFARBEN)
koerper = vorhanden & ~notes
n_n, lab_n = cv2.connectedComponents(notes.astype(np.uint8), connectivity=8)
NOTEN = [lab_n == k for k in range(1, n_n)]
assert len(NOTEN) == 6, len(NOTEN)
NOTEN.sort(key=lambda m: (np.nonzero(m)[1].min(), np.nonzero(m)[0].min()))       # nach Lage (oben zuerst)

AUGEN = [(22, 31), (23, 31), (22, 32), (23, 32), (26, 31), (27, 31), (26, 32), (27, 32)]
assert all(col(x, y) == WEISS for x, y in AUGEN)
MUND = [(x, y) for y in (34, 35) for x in (23, 24, 25)]
assert all(col(x, y) == SCHWARZ for x, y in MUND)
WANGEN = [(x, y) for y in range(sh) for x in range(sw) if col(x, y) in ((255, 201, 237), (255, 128, 213)) and vorhanden[y, x]]

# Körper mit den von Noten verdeckten Pixeln ergänzt
KOERPER_A = S.teil(koerper)
for (x, y), c in HIDDEN.items():
    assert not koerper[y, x] and notes[y, x], (x, y)
    KOERPER_A[GPT + y, GPL + x, :3] = c
    KOERPER_A[GPT + y, GPL + x, 3] = 255
# die ergänzten Pixel dürfen im Ruhebild nicht sichtbar sein (Note liegt darüber) — Note wird später darübergelegt
KORE = L.leer(H, W)                                       # Kern ohne Ranken für die Ranken-Technik
R = T.Ranken(np.where(koerper[..., None], spr, 0).astype(np.uint8))
KERN = R.kern
KERN_A = S.teil(KERN)
for (x, y), c in HIDDEN.items():
    if c in ((51, 93, 119), (77, 137, 154)) or (c == (13, 16, 49) and False):
        KERN_A[GPT + y, GPL + x, :3] = c
        KERN_A[GPT + y, GPL + x, 3] = 255
NOTEN_A = [S.teil(m) for m in NOTEN]
NOTE_PER = [(48, 2.0, 0.0, 48, 0.0), (24, 2.0, 1.3, 48, 1.7), (16, 2.0, 2.4, 48, 3.1), (12, 2.0, 0.7, 48, 4.4), (48, 2.0, 3.8, 48, 2.2), (24, 2.0, 5.1, 48, 5.3)]

FLOSSE_Y = 40


def haut(x, y):
    return HELL if (x + y) % 2 == 0 else DUNKEL


_c = [(x, y) for y in range(sh) for x in range(sw) if koerper[y, x] and col(x, y) in (HELL, DUNKEL) and 28 <= y <= 38 and 20 <= x <= 30]
if sum(1 for (x, y) in _c if col(x, y) == haut(x, y)) < len(_c) / 2:
    def haut(x, y):  # noqa: F811
        return DUNKEL if (x + y) % 2 == 0 else HELL


def flossen_dx(y, i):
    if y <= FLOSSE_Y:
        return 0
    g = ((y - FLOSSE_Y) / (sh - FLOSSE_Y)) ** 1.2
    w1 = 1.6 * g * (math.sin(L.sinus(i, 16) - 1.4 * g) - math.sin(-1.4 * g))
    w2 = 0.8 * g * (math.sin(L.sinus(i, 24) + 1.0 * g) - math.sin(1.0 * g))
    return int(round(w1 + w2))


def wunsch_fn(i):
    A = 2.2
    ph = L.sinus(i, 24)

    def w(x, y, g):
        k = -0.06 * x - 0.13 * y
        return A * g * (math.sin(ph + k) - math.sin(k)), 0.0
    return w


def frame_gross(i, nur=None):
    kb = KERN_A.copy()
    # Augen blinzeln
    if 12 <= i < 15 or 36 <= i < 39:
        for (x, y) in AUGEN:
            kb[GPT + y, GPL + x, :3] = haut(x, y)
    # Mund: weit / schmal im Wechsel
    fenster = {4: 'weit', 16: 'schmal', 28: 'weit', 40: 'schmal'}
    stufe = None
    for s0, art in fenster.items():
        if 0 <= i - s0 < 6 and (1 <= i - s0 <= 4):
            stufe = art
    hub = 0
    if stufe == 'weit':
        for x in (23, 24, 25):
            kb[GPT + 36, GPL + x, :3] = SCHWARZ
            kb[GPT + 36, GPL + x, 3] = 255
        hub = 1
    elif stufe == 'schmal':
        for (x, y) in ((23, 34), (25, 35)):
            kb[GPT + y, GPL + x, :3] = haut(x, y)
    # Flossenschwanz: Zeilenversatz
    out = L.leer(H, W)
    for y in range(sh):
        dx = flossen_dx(y, i)
        for x in np.nonzero(kb[GPT + y, :, 3])[0]:
            if not 0 <= x + dx < W:
                raise L.ClipError('Flosse außerhalb')
            out[GPT + y, x + dx] = kb[GPT + y, x]
    ra = R.ebene(i, H, W, GPL, GPT, wunsch_fn(i), kern_dx=lambda y: flossen_dx(y, i))
    # Wangen gehören zum Kern (sind Kernpixel) — Ranken unter dem Körper
    figur = L.zusammen(H, W, [(ra, 0, 0), (out, 0, 0)])
    bob = int(round(1.0 * T.sinz(i, 24)))
    figur = L.versetze(figur, 0, bob - hub)
    # Noten schweben je für sich
    ebenen = [(figur, 0, 0)]
    for na, (per, amp, ph, pdx, phx) in zip(NOTEN_A, NOTE_PER):
        dy = int(round(amp * math.sin(L.sinus(i, per, ph)))) - int(round(amp * math.sin(ph)))
        dx = int(round(1.0 * math.sin(L.sinus(i, pdx, phx)))) - int(round(1.0 * math.sin(phx)))
        ebenen.append((na, dx, dy))
    f = L.zusammen(H, W, ebenen)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    return f


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21], scale=8)
