# -*- coding: utf-8 -*-
"""Idle-Animation für „Gravedigger“ (Creature) — vermummter Totengräber, kniet nach rechts gewandt und sticht mit dem Spaten in die Erde.

PICK: [["MotiveDeri", 161, "Ebene „Gravedigger“, nur die Figur mit Spaten (Ausschnitt x 0–24, y 5–26); die acht Grabkreuze derselben Ebene sind Beiwerk"]]
Abgleich mit public/cardgen/art/Gravedigger.webp (Kartenkunst: dieselbe Figur links neben den Gräbern). Quelle vollständig.

Identifikation (25×22): schwarze Kapuze (x 5–9, y 0–10), Gesicht im Profil nach rechts (Haut x 8–13, y 1–9), EIN sichtbares Auge (hellblau (11,6), weiß (11,7), Pupille (12,6)/(12,7),
Braue (11,5)); graue Kutte, kniend (x 0–14, y 8–21, helle Faltenlichter); Spatenstiel dunkelbraun diagonal von der Kutte (15,11) nach rechts unten bis (19,16);
Spatenblatt (Eisen, x 16–24, y 13–19). Hände sind nicht gezeichnet (der Stiel kommt aus der Kutte) → der Spaten ist eine starre Einheit, die sich nur entlang
ihrer eigenen Diagonale verschiebt und dem Oberkörper folgt.

Ablauf (60 Frames à 70 ms = 4,2 s; zwei Spatenstiche je Schleife, Periode 30). Frame 0 = Original:
* Graben: Ausholen (Spaten 1 px zurück/hoch, Oberkörper streckt sich 1 px) → Stich (Spaten 1 px vor/runter, Oberkörper duckt sich 1 px: Zeile y 13 entfällt) →
  halten → zurück → Aushub wegwerfen (Spaten 2 px zurück/hoch, Oberkörper gestreckt → Blatt 3 px über dem Boden und VOLLSTÄNDIG sichtbar), dabei fliegen drei Erdbrocken
  (2×2) im Bogen nach rechts. Das Blatt wird an der Bodenlinie (y 19) abgeschnitten: beim Stich versinkt es, beim Herausziehen kommt das fertiggezeichnete Blattende zum Vorschein.
* Oberkörper strecken = texturierte Zeile bei y 13 (TX.streck_zeile); Kopf geht nur senkrecht mit.
* Blinzeln (das eine sichtbare Auge), Frames 28–29.
Ergänzungen: Blattende (in der Quelle im Boden, nicht gezeichnet): Zeilen y 19–21 des Blatts (x 17–24 → Spitze x 19–22) in Blattfarben und Blattumriss fertiggezeichnet.
Der Stiel ist unter der Kutte um 2 px nach links oben verlängert (Stielfarben (23,8,11)/(37,17,10)), damit beim Vorstoßen keine Lücke zur Kutte entsteht
(liegt in Ruhe vollständig unter der Kutte). Erdbrocken in der Erdfarbe (63,31,15) der Grabhügel derselben Ebene (dokumentierte Ausnahme, erlaubt=…), Unterkante Stielfarbe.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 60, 70
sz = N9.Szene('gravedigger', (3, 9, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
STIEL = sz.ist((23, 8, 11), (37, 17, 10))
BLATT = (xx >= 16) & (yy >= 13) & sz.da
SPATEN_M = STIEL | BLATT
ERDE, ERDE2 = (63, 31, 15), (37, 17, 10)
HAUT, LID = (246, 189, 123), (0, 0, 0)
TEST_EBENEN = ('figur',)

_sp = np.where(SPATEN_M[..., None], spr, 0).astype(np.uint8)
_ext = np.zeros_like(_sp)
for k in (1, 2):                                   # Stiel unter der Kutte verlängern (Stielstück um k nach links oben wiederholt)
    for y in range(11, 14):
        for x in range(14, 18):
            if STIEL[y, x] and not SPATEN_M[y - k, x - k] and not _ext[y - k, x - k, 3]:
                _ext[y - k, x - k] = spr[y, x]
_sp = np.where(_sp[..., 3:] > 0, _sp, _ext)
# Blattende, das in der Quelle im Boden steckt (dort endet das Blatt mit der geraden Schnittlinie y 19): selbst fertiggezeichnet – Blattfläche bis y 20 fortgesetzt,
# gerundete Spitze y 21, Umriss (18,18,16), Flächenfarben des Blatts. In Ruhe verdeckt der Boden (Zeilen > 19) das Ende wieder → Frame 0 = Original.
_O, _A, _B, _C = (18, 18, 16), (62, 62, 53), (110, 111, 95), (44, 43, 38)
_sp = np.pad(_sp, ((0, 3), (0, 0), (0, 0)))
for y, zeile in ((19, {17: _O, 18: _A, 19: _A, 20: _B, 21: _C, 22: _B, 23: _B, 24: _O}), (20, {18: _O, 19: _A, 20: _A, 21: _B, 22: _B, 23: _O}),
                 (21, {19: _O, 20: _O, 21: _O, 22: _O})):
    for x, c in zeile.items():
        _sp[y, x] = c + (255,)
SPATEN = L.platz(_sp, sz.H, sz.W, sz.PL, sz.PT)
BODEN = sz.PT + 19                                 # Bodenlinie des Blatts: was tiefer liegt, steckt in der Erde


def spaten(dx, dy):
    """Spaten starr verschoben; unter der Bodenlinie abgeschnitten, die Schnittzeile wird Umriss (wie in der Quelle)."""
    a = N9.starr(SPATEN, dx, dy).copy()
    schnitt = (a[BODEN + 1, :, 3] > 0) & (a[BODEN, :, 3] > 0)
    a[BODEN, schnitt, :3] = _O
    a[BODEN + 1:] = 0
    return a
KOERPER = sz.teil(~SPATEN_M)

#           0  1  2  3   4   5   6  7  8  9 10 11 12 13 14 15 16 17 18 19 20  21  22  23  24  25 26 27 28 29
D_FOLGE = [0, 0, 0, 0, -1, -1, -1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 0, 0]
B_FOLGE = [0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0]
BROCKEN = [dict(x=sz.PL + 21, y=sz.PT + 11, vx=0.55, vy=-1.0, g=0.17, start=s + 21, dauer=11) for s in (0, 30)] + \
          [dict(x=sz.PL + 19, y=sz.PT + 12, vx=0.30, vy=-1.2, g=0.18, start=s + 22, dauer=11) for s in (0, 30)] + \
          [dict(x=sz.PL + 22, y=sz.PT + 12, vx=0.85, vy=-0.7, g=0.15, start=s + 22, dauer=10) for s in (0, 30)]


def frame(i, nur=None):
    d, b = D_FOLGE[i % 30], B_FOLGE[i % 30]
    k = KOERPER
    if 28 <= i <= 29:
        k = k.copy()
        k[sz.PT + 6, sz.PL + 11, :3] = HAUT; k[sz.PT + 7, sz.PL + 11, :3] = LID; k[sz.PT + 6, sz.PL + 12, :3] = (221, 170, 110)
    k = TX.streck_zeile(k, sz.PT + 13, -b)        # b = +1 ducken (Zeile entfällt), b = −1 strecken (texturierte Zeile)
    f = L.zusammen(sz.H, sz.W, [(spaten(d, d + b), 0, 0), (k, 0, 0)])
    if not nur:
        f = L.zusammen(sz.H, sz.W, [(f, 0, 0), (N9.brocken(sz.H, sz.W, i, BROCKEN, ERDE, ERDE2), 0, 0)])
    return f


if __name__ == '__main__':
    N9.fertig('gravedigger', 'Gravedigger', frame, N, MS, spr, erlaubt=[ERDE], check=[0, 5, 13, 22, 24, 27, 29], zoom=14)
