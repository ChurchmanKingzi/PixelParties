# -*- coding: utf-8 -*-
"""Idle-Animation für „Motharch Squire“ (Creature) — die große orange-braune Motte mit gefiederten Fühlern, Pelzkragen und vier gebänderten, grau-rosa Flügeln (sitzend, von oben gesehen).

Quelle: src/motharch-squire.png (77×70 px, 22 Farben).
PICK: [["MotiveMoe", 162, "ganze Ebene #171"]]   (über Farbsuche gefunden: die Kartenkunst zeigt nur den oberen Teil der Motte stark vergrößert/verrauscht, daher kein Treffer im
  automatischen Abgleich. Die Ebene enthält die ganze Motte, Alpha nur 0/255.)

Was im Sprite ist (x, y):
* FÜHLER (y 0–12): links von der Spitze (24,0) schräg zum Kopf (33–37, 12), rechts von (51,0) zum Kopf (40–44, 11); orange mit dunklem Kamm.
* KOPF (x 28–48, y 11–23): helle Gesichtsplatte (35–42, 13–22); AUGEN = dunkle Schlitze (33, 17–20) und (42–43, 18–20) – Facettenaugen, blinzeln nicht.
* PELZKRAGEN/THORAX (x 24–52, y 21–37): orange oben, heller Bauchpelz (31–48, 28–34); sechs dünne BEINE (dunkle Linien mit braunem Kern, x 28–30, 33–35, 43–45, 47–50, bis y 49).
* VORDERFLÜGEL außen (links x 0–28, rechts x 48–76, y 24–69) und HINTERFLÜGEL innen (x 24–37 und x 39–53, y 37–68): graubraun gebändert mit hellen rosa Flecken und Bändern.
* Vier Hintergrund-LÖCHER im linken Hinterflügel der Quelle: (28,59), (29,59), (31,60), (32,60) → mit der Bandfarbe (223,186,164) geschlossen (einzige Abweichung vom Original).
Kein Metall → kein Glanz. Groß → langsam.

Idee: Die Motte sitzt und „fächelt“ – die Vorderflügel spreizen sich langsam ab der Schulter und schließen sich wieder, die Fühler tasten abwechselnd, beim Schließen rieselt Flügelstaub.
Ablauf (72 Frames à 75 ms = 5,4 s, nahtlos):
* Vorderflügel (Periode 36, 2×): jeder Vorderflügel schwenkt als GANZER Flügel um den Schulteransatz nach außen – Zeilen bis y 41 bleiben, y 42–53 rücken 1 px, y 54–69 2 px nach außen
  (Zwischenstufe: 0/0/1). Starre Zeilenversätze (Gefälle ≤ 1 px), nichts wird gestreckt. Der dabei frei werdende Streifen des Hinterflügels wird mit dessen Bandfarbe der
  jeweiligen Zeile fertiggezeichnet (Verdecktes ergänzt); wo die Flügel schon im Original getrennt sind, öffnet sich nur der Spalt. Stufenecken im Umriss werden geschlossen (Regel 16).
* Fühler (Periode 24, 3×): beide Fühler schwingen als Ketten seitlich – am Kopf fest, zur Spitze hin bis ±2 px, rechts gegenläufig.
* Flügelstaub: 4 kleine Flocken (2×2, rosa-beige (223,186,164)/(214,173,154)) lösen sich beim Schließen von den Flügelunterkanten und sinken (je 18–20 Frames).
Frame 0 = Original (bis auf die vier geschlossenen Löcher).
"""
import math
import sys

import cv2
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6

N, MS = 72, 75
G = N4.Figur('motharch-squire', 5, 5, 3, 8)
H, W, OFF = G.H, G.W, G.OFF
f = G.f
UMRISS = f(24, 0)
BAND = f(28, 58)
spr = G.spr.copy()
for (x, y) in [(28, 59), (29, 59), (31, 60), (32, 60)]:            # Löcher der Quelle schließen
    spr[y, x, :3] = BAND; spr[y, x, 3] = 255
G.spr = spr; G.da = L.deckend(spr); G.erlaubt = Hm.umrissfarben(spr)


def fluegelmaske(saat):
    """Vorderflügel = zusammenhängende Nicht-Umriss-Fläche um die Saat (y ≥ 24) plus die direkt anliegenden Umrisspixel."""
    innen = (G.da & ~L.farbmaske(spr, [UMRISS, f(26, 2)])).astype(np.uint8)
    innen[:24] = 0
    n, lab = cv2.connectedComponents(innen, connectivity=4)
    m = lab == lab[saat[1], saat[0]]
    rand = cv2.dilate(m.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)).astype(bool) & G.da & ~innen.astype(bool)
    return m | rand


VF_L, VF_R = fluegelmaske((10, 50)), fluegelmaske((66, 50))
FUEHLER_L = G.da & (G.yy <= 10) & (G.xx <= 38)
FUEHLER_R = G.da & (G.yy <= 10) & (G.xx >= 39)
STAUB = {'c': f(28, 58), 'r': f(32, 30)}
FLOCKEN = [dict(x=14, y=70, vy=6, vx=-1, off=N - 20, form='s', dauer=20, wackeln=1), dict(x=70, y=70, vy=6, vx=1, off=N - 24, form='s', dauer=18),
           dict(x=34, y=70, vy=6, vx=1, off=N - 50, form='s', dauer=20, wackeln=-1), dict(x=57, y=70, vy=6, vx=-1, off=N - 53, form='s', dauer=18)]
TEST_EBENEN = 'koerper'


def spreizen(a, maske, st, richtung):
    if not st:
        return a
    rest, teil = N4.starr(a, OFF, maske, 0, 0)
    weg = {y: richtung * (0 if y < 42 else (1 if y < 54 else st)) for y in range(24, 70)}
    if st == 1:
        weg = {y: richtung * (0 if y < 54 else 1) for y in range(24, 70)}
    Hm.zeilen_versatz(teil, OFF, weg)
    # frei gewordenen Streifen des Hinterflügels fertigzeichnen: Farbe des nächsten Hinterflügelpixels derselben Zeile (zur Körpermitte hin)
    for y, x in zip(*np.nonzero((a[..., 3] > 0) & (rest[..., 3] == 0) & (teil[..., 3] == 0))):
        nx = x - richtung
        while 0 <= nx < W and not rest[y, nx, 3] and abs(nx - x) < 3:
            nx -= richtung
        if 0 <= nx < W and rest[y, nx, 3] and tuple(rest[y, nx, :3]) != UMRISS:
            rest[y, x] = rest[y, nx]
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def fuehler(a, maske, phase):
    rest, teil = N4.starr(a, OFF, maske, 0, 0)
    teil = L.zeilen_welle(teil, OFF[1] + 11, 2.2, phase, potenz=1.3)
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def frame(i, nur=None):
    a = G.ebene()
    st = Hm.stufe(i, 36, 2)
    a = spreizen(a, VF_L, st, -1)
    a = spreizen(a, VF_R, st, 1)
    a = fuehler(a, FUEHLER_L, L.sinus(i, 24))
    a = fuehler(a, FUEHLER_R, L.sinus(i, 24) + math.pi)
    a = G.schliessen(a, lambda x, y: UMRISS)
    if nur:
        return a
    return L.zusammen(H, W, [(a, 0, 0), (N6.woelkchen(H, W, i, N, FLOCKEN, STAUB), 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Motharch Squire', [frame(i) for i in range(N)], MS, sys.argv, scale=3, spalten=8)
