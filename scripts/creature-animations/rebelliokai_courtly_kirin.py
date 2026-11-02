# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Courtly Kirin“ (Creature) — der von vorn gesehene Kirin: Geweih, dunkles Gesicht mit türkiser Nasenbahn, weißer Rumpf, grüne Blattschwingen, zwei dünne weiße Schnurrbänder.

Quelle: src/rebelliokai-courtly-kirin.png (26×31 px, 25 Farben).
PICK: [["MotiveJapan", 138, 1]]      (Ebene „Ebene #97“, Figur 1, same 0,908: die Kirschblüten der Kunst liegen über der Figur und verdecken Pixel, der Sprite selbst stammt sauber aus der Ebene;
die Kirschblüten-Ebenen (142) und der Nebel-/Aura-Schein der Karte gehören nicht zur Figur)
Quelle vollständig: ja (links/rechts fast symmetrische Frontansicht, nichts Verdecktes; unten stehen die Hufe).

Aufruf:   python3 rebelliokai_courtly_kirin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-courtly-kirin.png + .json

Was im Sprite ist (x, y im 26×31-Sprite):
* GEWEIH (x 4–9 und 16–21, y 0–7): zwei verzweigte Geweihe in Braun (92,67,71)/(50,28,15) mit hellen Beigespitzen (207,197,162)/(177,166,136); der Stamm sitzt oben auf dem Kopf (x 9–16, y 6–8).
* KOPF (x 8–17, y 8–16): dunkelgraues Gesicht (37,36,44), türkise Nasenbahn (68,137,116)/(101,178,158) in der Mitte (x 12–13, y 9–15), links und rechts davon je ein cremefarbener Strich (238,222,232)/(239,228,208) über Oliv (127,130,109)
  (x 11 und 14, y 10–12) und weiße Pixel (255,255,255) an den Kopfseiten (10,9)/(15,9) — ich lasse diese Gesichtsmerkmale FEST (ob Augen, Nüstern oder Schmuck, ist nicht eindeutig; Regel 1/21).
* BLATTSCHWINGEN (grün (0,36,32)/(3,89,64)/(92,201,134)/(141,240,150)): zwei große Blätter an den Schultern (x 4–10, y 8–18) und zwei kleinere an den Hüften (x 4–9 und 16–21, y 22–28).
* RUMPF (x 7–18, y 15–28): weiß/lavendel (255,255,255)/(230,222,235)/(209,216,226)/(159,162,171) mit dunklem Umriss (37,36,44); unten zwei Beine mit dunklen Streifen (11,31,6) und rosa/braunen Hufen (156,123,116)/(207,176,171)/(25,4,0) bei y 26–30.
* SCHNURRBÄNDER: je eine dünne, 1 px breite Linie aus Weiß/Lavendel/Grau (255,255,255)/(238,222,232)/(171,176,195)/(209,216,226) links (1,10)→(0,14)→(2,17)→(7,19) und rechts (24,10)→(25,14)→(23,17)→(18,19), die am Rumpf ansetzt.
Kein Metall, Gold oder Edelstein (Geweih und Fell glänzen nicht) → KEIN Glanz (Regel 14); kein Feuer, keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos; Frame 0 = Original):
* ATMEN (2× je Schleife): die Fellzeile 21 des Rumpfes wird einmal doppelt eingefügt (Texturmischung): Kopf, Geweih, Schulterblätter und Bänder steigen starr 1 px, Hüftblätter und Beine bleiben.
* BLATTSCHWINGEN FLATTERN: jedes der vier Blätter schwingt um seinen Ansatz am Körper (Spaltenversatz wächst mit dem Abstand, bis 1 px an der Außenkante, Gefälle ≤ 1 px je Spalte, Umriss bleibt als Stapel zusammen);
  obere und untere, linke und rechte Blätter in verschiedenen Perioden (2–3 je Schleife) und Phasen — nie im Gleichschritt.
* GEWEIH WIEGT: beide Geweihe neigen die Spitzen unabhängig 1–2 px zur Seite (Zeilenversatz wächst von 0 am Ansatz y 7 bis zur Spitze y 0, Gefälle ≤ 1 px je Zeile); links eine Welle je Schleife, rechts zwei.
* SCHNURRBÄNDER WEHEN: beide Linien werden als Pixelkette neu gezeichnet; die Spitzen schwingen 1–2 px seitlich (Anker am Rumpf fest), die Kette bleibt zusammenhängend (Brückenpixel), Wellenlauf von der Spitze zum Ansatz.
Fest: Gesichtszüge, Nasenbahn, Rumpf, Hufe. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel außer den Brückenpixeln der Bänder (Farbe des benachbarten Bandpixels).
"""
import math
import sys

import cv2
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 2

spr = L.lade('rebelliokai-courtly-kirin')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = set(Hm.umrissfarben(spr))
# --- Blätter (zusammenhängende Grünkomponenten) ---
GRUEN = {(0, 36, 32), (3, 89, 64), (92, 201, 134), (141, 240, 150)}
gm = np.zeros((sh, sw), np.uint8)
for y in range(sh):
    for x in range(sw):
        if vorhanden[y, x] and f(x, y) in GRUEN:
            gm[y, x] = 1
_n, lab = cv2.connectedComponents(gm, connectivity=8)
def _komp(x, y):
    return lab == lab[y, x]
blatt_ol, blatt_or = _komp(6, 12), _komp(19, 12)
blatt_ul, blatt_ur = _komp(6, 25), _komp(19, 25)
# --- Schnurrbänder (Pixelketten, Spitze → Anker) ---
BAND_L = [(1, 10), (1, 11), (0, 12), (0, 13), (0, 14), (1, 15), (1, 16), (2, 17), (3, 18), (4, 19), (5, 19), (6, 19), (7, 19)]
BAND_R = [(24, 10), (24, 11), (25, 12), (25, 13), (25, 14), (24, 15), (24, 16), (23, 17), (22, 18), (21, 19), (20, 19), (19, 19), (18, 19)]
band_l = np.zeros((sh, sw), bool)
band_r = np.zeros((sh, sw), bool)
for (x, y) in BAND_L:
    band_l[y, x] = True
for (x, y) in BAND_R:
    band_r[y, x] = True
FREI = 9                                                            # die ersten 10 Punkte (bis (4,19)/(21,19)) schwingen, der Rest ist der feste Ansatz
# --- Geweih ---
antler_l = vorhanden & (xx <= 11) & (yy <= 7)
antler_r = vorhanden & (xx >= 14) & (yy <= 7)
kern = vorhanden & ~blatt_ol & ~blatt_or & ~blatt_ul & ~blatt_ur & ~band_l & ~band_r & ~antler_l & ~antler_r
oben = [antler_l, antler_r, blatt_ol, blatt_or, band_l, band_r]


def schnur(a, band, pts, i, per, vers, amp, lauf, aussen):
    """Band neu zeichnen: dx je Punkt = w_k·s·(A_außen bzw. A_innen), s = (sin(φ − lauf·w) − sin(versatz − lauf·w))/2 ∈ [−1, 1], w_k wächst von 0 (Ansatz) zur Spitze auf 1.
    Nach außen (aussen = −1 links, +1 rechts) bis `amp`·1,6, nach innen höchstens `amp`·0,7 (die Bänder dürfen die Blätter nicht berühren)."""
    farben = [f(x, y) for (x, y) in pts]
    vs = []
    for k, (x, y) in enumerate(pts):
        w = max(0.0, (FREI - k) / float(FREI)) if k <= FREI else 0.0
        phi = L.sinus(i, per)
        s = (math.sin(phi + vers - lauf * w) - math.sin(vers - lauf * w)) / 2.0
        dx = w * (s * amp * 1.6 if s * aussen > 0 else s * amp * 0.7 * 1.0)
        vs.append((int(round(dx)), 0))
    pix = R.kette(pts, farben, vs)
    out = L.leer(H, W)
    Hm.setze(out, pix, OFF)
    return out


LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))                          # Löcher im Original (Ruhepose)


def frame(i):
    b = Hm.stufe(i, N / 2, 1)
    k = R.teil(spr, kern, H, W, OFF)
    # Geweih: Zeilenversatz (Spitze stärker), Ansatz y 7
    al = R.teil(spr, antler_l, H, W, OFF)
    ar = R.teil(spr, antler_r, H, W, OFF)
    sa = math.sin(L.sinus(i, N)); sb = math.sin(L.sinus(i, N / 2))
    da = -1 if sa > 0.35 else 0                                     # Geweihspitzen spreizen nur nach außen (links −1, rechts +1), nie zur Mitte: sonst verschmelzen die Geweihe
    db = 1 if sb > 0.35 else 0
    Hm.zeilen_versatz(al, OFF, {0: da, 1: da})
    Hm.zeilen_versatz(ar, OFF, {0: db, 1: db})
    # Blätter: Spaltenversatz um den Ansatz (innere Kante)
    bol = R.spalten_pendel(R.teil(spr, blatt_ol, H, W, OFF), PAD_L + 9, 1.5, L.sinus(i, N / 2), ruhe0=True, versatz=0.6)
    bor = R.spalten_pendel(R.teil(spr, blatt_or, H, W, OFF), PAD_L + 16, 1.5, L.sinus(i, N / 3), ruhe0=True, versatz=2.1)
    bul = R.spalten_pendel(R.teil(spr, blatt_ul, H, W, OFF), PAD_L + 8, 1.5, L.sinus(i, N / 3), ruhe0=True, versatz=1.3)
    bur = R.spalten_pendel(R.teil(spr, blatt_ur, H, W, OFF), PAD_L + 17, 1.5, L.sinus(i, N / 2), ruhe0=True, versatz=3.0)
    # Bänder
    bl = schnur(None, band_l, BAND_L, i, N / 2, 0.0, 1.5, 1.6, -1)
    br = schnur(None, band_r, BAND_R, i, N / 2, 2.0, 1.5, 1.6, +1)
    # Ansatz der Bänder (feste Pixel) zusätzlich
    for (pts, a_) in ((BAND_L, bl), (BAND_R, br)):
        Hm.setze(a_, {p: f(*p) for p in pts[FREI + 1:]}, OFF)
    # Atmen: Kern dehnen (Zeile 21), obere Teile starr 1 px hoch
    if b:
        k = L.streck_zeile(k, PAD_T + 21, 1)
        al, ar, bol, bor, bl, br = (L.versetze(e, 0, -1) for e in (al, ar, bol, bor, bl, br))
    fig, etik = R.schichten(H, W, [(k, 'kern'), (bul, 'blatt'), (bur, 'blatt'), (bol, 'blatt'), (bor, 'blatt'), (bl, 'band'), (br, 'band'), (al, 'geweih'), (ar, 'geweih')])
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT)
    R.kontur_je_teil(fig, etik, ERLAUBT, {'kern': f(9, 8), 'blatt': f(8, 8), 'geweih': f(6, 5), 'band': f(1, 10)})
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-courtly-kirin', 'Rebelliokai Courtly Kirin', frames, MS, spr, OFF, prev)
