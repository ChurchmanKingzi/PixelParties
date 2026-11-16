# -*- coding: utf-8 -*-
"""Idle-Animation für „Infected Greatmaw“ (Creature) — Hai, dessen Hinterleib zu einem Tentakelknäuel geworden ist (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveDeepsea", 91, 1], ["MotiveDeepsea", 90, 1], ["MotiveDeepsea", 90, 2]]
Quelle: src/infected-greatmaw.png (83×52) = Ebene 91 „Infected Greatmaw“ (Hai + Tentakel, src/infected-greatmaw-hai.png; der kleine Humanoid unten links
in derselben Ebene gehört nicht dazu) + die roten/dunkelblauen Adern über Rückenflosse und Kopf aus Ebene 90 (src/infected-greatmaw-adern.png),
Lage wie in der Kartenkunst. Der rote Lichtschein (Ebene 89, halbtransparent) ist Hintergrund.

Identifikation (x, y): Tentakelknäuel x 0–49, y 0–51: sieben Arme mit eigenem Umriss (16,30,38) und Schachbrett-Füllung aus zwei Türkistönen
(77,137,154)/(51,93,119) (Parität (x+y) gerade/ungerade, im ganzen Sprite einheitlich); am Hai angewachsen bei x 38–41, y 23–31.
Hai (Umriss (4,13,26), Blick nach rechts): Rumpf x 39–82, y 19–39; türkis befallene Rückenflosse x 49–58, y 11–22 und Brustflossen (starr),
drei Kiemenschlitze x 56–64, weißes, pupillenloses Auge x 69–72, y 23–25; Zähne oben (79,23)(77,24)(75,25)(73,27), unten (74,30)(76,31)(78,32);
Unterkiefer-Keil x 73–80, y 29–34. Adern: dünne dunkelrote (70,10,10) und dunkelblaue (13,16,49) Linien über Rückenflosse und Stirn.

Ablauf (72 Frames à 70 ms ≈ 5 s):
* Treiben: die GANZE Figur gleitet weich (±2 px waagerecht, ±1 px senkrecht).
* Tentakel winden sich: reine Scherungen (jede Spalte/Zeile bleibt unverändert, nichts wird gestreckt, kein Umriss dicker): eine laufende Welle
  hebt/senkt die Spalten (Ausschlag wächst vom Ansatz bei x = 40 bis knapp ±3 px an den Spitzen), dazu schwingen die nach oben (y < 22) und nach unten
  (y > 32) ragenden Arme zeilenweise seitlich (bis ±2 px, andere Perioden). Die Schachbrett-Füllung wird danach wieder im festen Raster gesetzt.
* Unterkiefer schnappt zweimal je Schleife (Keil dreht um das Gelenk, Zähne gehen mit).
* Adern pochen: kurz wechseln Dunkelrot und Dunkelblau (zweimal je Schleife).
Starr: Kopf, Auge (pupillenlos, blinzelt nicht), Kiemen, befallene Flossen. Nur ganze Pixel, nur Quellfarben.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 72, 70
spr = L.lade('infected-greatmaw')
hai = L.lade('infected-greatmaw-hai')
adern = L.lade('infected-greatmaw-adern')
B = G.Buehne(spr, 8, 6, 8, 8)
BH = G.Buehne(hai, 8, 6, 8, 8)
BA = G.Buehne(adern, 8, 6, 8, 8)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
TA, TB, TU = (77, 137, 154), (51, 93, 119), (16, 30, 38)
UMRISS = (4, 13, 26)
QUELLE = np.concatenate([spr, hai, adern], axis=0)
RAND = G.rand_farben(hai) | G.rand_farben(spr)

_t = L.farbmaske(hai, [TA, TB, TU]).astype(np.uint8)
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(_t, connectivity=4)
tentakel = _lab == (1 + int(np.argmax(_st[1:, 4])))            # das große Knäuel (die befallenen Flossen am Hai sind eigene, starre Flecken)
kiefer = BH.da & ~tentakel & (xx >= 73) & (yy >= 29)
rumpf = BH.da & ~tentakel & ~kiefer
ANSATZ = 40
BISS = {}
for s0 in (14, 50):
    for k, v in enumerate([-1, -2, -2, -1]):
        BISS[s0 + k] = v
POCHEN = set(range(26, 29)) | set(range(62, 65))


def winden(i):
    a = BH.teil(tentakel)
    out = L.leer(H, W)
    for x in range(W):                                          # 1) laufende Welle: Spalten senkrecht
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        d = abs((x - B.pl) - ANSATZ)
        f = lambda k: math.sin(2 * math.pi * k / (N / 2) - 0.15 * d)
        dy = int(round(2.6 * (d / 40.0) * (f(i) - f(0))))
        out[ys + dy, x] = a[ys, x]
    a, out = out, L.leer(H, W)
    for y in range(H):                                          # 2) aufragende/hängende Arme: Zeilen waagerecht
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        sy = y - B.pt
        dx = 0
        if sy < 22:
            d = 22 - sy
            f = lambda k: math.sin(2 * math.pi * k / (N / 3) - 0.2 * d)
            dx = int(round(1.6 * (d / 22.0) * (f(i) - f(0))))
        elif sy > 32:
            d = sy - 32
            f = lambda k: math.sin(2 * math.pi * k / (N / 2) + 1.3 - 0.2 * d)
            dx = int(round(1.8 * (d / 19.0) * (f(i) - f(0))))
        out[y, xs + dx] = a[y, xs]
    innen = L.farbmaske(out, [TA, TB])                          # Schachbrett wieder ins feste Raster (sonst entstehen an den Scherstufen Streifen)
    gy, gx = np.mgrid[0:H, 0:W]
    gerade = ((gx - B.pl + gy - B.pt) % 2) == 0
    out[innen & gerade, :3] = TA
    out[innen & ~gerade, :3] = TB
    return G.umriss_flicken(out, RAND, TU)


def frame(i):
    dx, dy = G.gleiten(i, N, ax=2.0, ay=1.2, phx=0.0, phy=1.0)
    k = G.scher_spalten(BH.teil(kiefer), B.pl + 72, BISS.get(i, 0), seite=1, ende=B.pl + 79)
    ad = BA.teil(BA.da)
    if i in POCHEN:
        ad = L.tausche(ad, {(70, 10, 10): (13, 16, 49), (13, 16, 49): (70, 10, 10)})
    ganz = L.zusammen(H, W, [(winden(i), 0, 0), (k, 0, 0), (BH.teil(rumpf), 0, 0)])
    ganz = G.umriss_flicken(ganz, RAND, lambda p: TU if tuple(int(v) for v in p[:3]) in (TA, TB) else UMRISS)
    ganz = L.zusammen(H, W, [(ganz, 0, 0), (ad, 0, 0)])
    return L.versetze(ganz, dx, dy)


if __name__ == '__main__':
    G.fertig('infected-greatmaw', 'Infected Greatmaw', frame, N, MS, QUELLE, sys.argv)
