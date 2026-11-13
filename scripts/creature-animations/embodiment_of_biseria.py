# -*- coding: utf-8 -*-
"""Idle-Animation für „Embodiment of Biseria“ (Creature) — das verkörperte Schneeland: eine riesige verschneite Kuppe mit zwei gleißenden Augen. Sie hebt und
senkt sich ganz langsam, die Lichtstrahlen der Augen ziehen sich zusammen und schießen wieder hinaus, Schneebrocken rutschen die Flanken hinab.

PICK: [["Kartenkunst + Motiv-Maske", "Embodiment_of_Biseria.png × data/subject-masks.json", "Kunst y 8–50 (die Kuppe füllt die Kunst bis zu allen drei Rändern)"]]
Keine freigestellte xcf-Ebene: Farbsuche über alle Ebenen aller Dateien → einziger Treffer MotiveRussia 055, und das ist die fertige (verrauschte) Kartenkunst als
Einschub in einer Szene. Die Kunst ist körnig gedithert (Schneeglitzern, 2292 Farben) – das ist die Textur der Figur, nichts wurde geglättet.
AUSSCHNITT/ERGÄNZT: Die Kunst zeigt nur Scheitel und Gesicht des Kolosses; links, rechts und unten läuft er aus dem Bild. Die Flanken erreichen bei y 35 den
Bildrand, darunter steht die Figur als gerader Sockel (untere Ecken um 2 px abgerundet) – ein „Brustbild“, nichts dazuerfunden. Weggelassen: die Strahlenstücke
oberhalb der Kuppe (Kunst y 0–7), drei lose Maskenpixel am Scheitel und die äußersten 3/2 px des waagerechten Strahls.

Identifikation (76×43, Sprite-y = Kunst-y − 8): lavendelfarbene Schneekuppe (Scheitel y 0–3, Flanken bis y 27), zwei Augen als weiße Lichtpunkte (31,21) und
(44,21) mit Schein (x 29–34 bzw. 42–46, y 19–25) und Strahlenkreuz: je ein senkrechter Strahl (x 31 und x 44) und ein gemeinsamer waagerechter (y 21);
darunter ein weißes Trapez mit grauem Rand und senkrechten Streifen (x 23–51, y 22–42; Bart/Zahnreihe/Eiszapfen – unklar, bleibt fest). Dunkelblaue Pixel am
rechten Rand (x 56–61, y 3–8) sind Reste der Tannen dahinter – fest.

Ablauf (64 Frames à 90 ms = 5,8 s; Koloss → sehr langsam). Frame 0 = Original:
* Atem (ein Hub je Schleife, Frames 20–45): alles oberhalb von Zeile 32 hebt sich 1 px (TX.streck_zeile; die körnige Zeile wird texturiert eingefügt).
* Augenstrahlen: die Strahlen oberhalb der Augen (x 31/44, y 0–18) und links/rechts außen (y 21) ziehen sich bis auf ein Viertel zusammen und wachsen wieder
  (Kosinus, 1 px je Schritt). Wo der Strahl weicht, steht Schneetextur (aus der übernächsten Spalte/Zeile, um 1 px verschoben – keine Kopie nebeneinander).
  Der Schein um die Augen und die Strahlen im Trapez (dort zugleich Streifen) bleiben.
* Schnee: je Flanke rutscht ein 2×2-Brocken (Weiß der Quelle) den Hang hinab (links ab Frame 6, rechts ab Frame 38; 1 Zeile je Frame) und verschwindet am Rand.
"""
import math

import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n11 as G

N, MS = 64, 90
sz = G.Szene('embodiment-of-biseria', (3, 3, 4, 2))
spr = sz.spr
WEISS = (254, 254, 254)
# Schneetextur unter den Strahlen
BASIS = spr.copy()
for x in (31, 44):
    BASIS[1:19, x] = spr[0:18, x - 2]
BASIS[21, 3:29] = spr[23, 4:30]
BASIS[21, 47:74] = spr[23, 46:73]
BASIS[~sz.da] = 0
_leer = sz.da & (BASIS[..., 3] == 0)
BASIS[_leer] = spr[_leer]                              # am Scheitel fehlt die Nachbarspalte → Strahlpixel bleibt
KANTE_L = [int(np.nonzero(sz.da[y])[0][0]) for y in range(sz.sh)]
KANTE_R = [int(np.nonzero(sz.da[y])[0][-1]) for y in range(sz.sh)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    s = 0.25 + 0.75 * (0.5 + 0.5 * math.cos(2 * math.pi * i / N))
    a = spr.copy()
    oben = 19 - int(round(19 * s))                     # Zeilen 0…oben-1 ohne Strahl
    for x in (31, 44):
        a[:oben, x] = BASIS[:oben, x]
    li = 29 - int(round(26 * s))                       # Spalten 3…li-1 ohne Strahl
    re = 46 + int(round(27 * s))                       # Spalten re+1…73 ohne Strahl
    a[21, 3:li] = BASIS[21, 3:li]
    a[21, re + 1:74] = BASIS[21, re + 1:74]
    f = L.platz(a, sz.H, sz.W, sz.PL, sz.PT)
    n = 1 if 20 <= i < 46 else 0
    f = TX.streck_zeile(f, sz.PT + 32, n)
    if not nur:
        for start, kante, d in ((6, KANTE_L, 1), (38, KANTE_R, -2)):
            t = i - start
            if 0 <= t < 24:
                y = 4 + t
                x = kante[y] + d
                for dy in (0, 1):
                    for dx in (0, 1):
                        f[sz.PT + y + dy - n, sz.PL + x + dx, :3] = WEISS
                        f[sz.PT + y + dy - n, sz.PL + x + dx, 3] = 255
    return f


if __name__ == '__main__':
    G.fertig('embodiment-of-biseria', 'Embodiment of Biseria', frame, N, MS, spr, check=[0, 12, 22, 32, 44, 56], zoom=5)
