# -*- coding: utf-8 -*-
"""Idle-Animation für „Undead Guardian Angel“ (Creature) — untoter Engel (Totenschädel, schwarzes Haar, violetter Heiligenschein, Knochenflügel) hinter einer Engelsstatue mit rotem Herzstein.

PICK: [["Motive", 747, "Ebene „Undead Guardian Angel“, Mittelfigur (Ebenenausschnitt x 25–46; 22×59 px)"], ["Motive", 748, "Ebene #396: Totenschädel (10×12), liegt unter 747 im Haarausschnitt"]]
Die Ebene 747 enthält drei Figuren; die beiden äußeren (x 0–19 und 52–71) sind gewöhnliche Engelsstatuen auf Sockeln = Kulisse → nicht verwendet. Die Mittelfigur hat den violetten Auraumriss.
Der Schädel (Ebene 748) gehört dazu: im zusammengesetzten Bild (Ebene 746 „Sichtbar #61“) schaut er aus dem Haarausschnitt. Für die Karte gibt es keine Kartenkunst unter
data/card-art/native (kein Abgleich möglich).

Identifikation (22×59): violetter Heiligenschein (Ring x 7–14, y 1–3). Schwarzes langes Haar (x 5–16, y 5–21), darin der Schädel (sichtbar x 8–13, y 9–16), rote Augen (7,12) und (14,12).
Knochenflügel links/rechts (x 0–3 und 18–21, y 11–23: senkrechte Knochenstäbe x 1, 3 bzw. 18, 20 mit Aura-Umriss), Gelenkknochen (4,13)/(17,13). Braun umrandete Knochenhände (x 3–6 und 15–18,
y 20–22) halten sich an der Statue fest → stationär. Engelsstatue: Kopf (x 5–16, y 21–33, geschlossene Augen y 27), Steinflügel (x 1–4 und 17–20, y 28–37). Davor ein violett gefasster roter
Herzstein (x 5–16, y 36–48), gehalten von zwei fahlen Händen (x 4–7 und 14–17, y 46–48), blaues Gewand (y 48–51), schwarzer Saum, graue Füße (y 54–55). Violetter Auraumriss (45,0,105).

Ablauf (72 Frames à 75 ms = 5,4 s). Frame 0 = Original. Die Figur steht (kein Schweben), die Statue ist Stein und bleibt starr:
* Knochenflügel (Periode 24): die äußeren Flügelteile (x 0–2 und 19–21) senken sich als starre Einheit 1 px und heben sich wieder (zweimal je Periode, kurzes Zucken) (Flügel werden nur nach unten geschoben; die inneren
  Knochenstäbe am Gelenk und die Hände bleiben fest → keine Lücke, nichts wird gestreckt).
* Herzstein pulsiert als Doppelschlag (alle 24 Frames: 2 Frames hell, 2 Pause, 2 Frames hell): die Rottöne des Steins rücken eine Stufe der Quell-Rampe heller (Edelstein → erlaubt).
  Die roten Augen glimmen im selben Takt eine Stufe heller (nur die beiden Augenpixel).
* Heiligenschein: ein heller Punkt (hellstes Ring-Violett der Quelle) läuft einmal je 24 Frames um den Ring.
* Seelenfetzen: fünf 2×2-Wölkchen in den Aura-Violetttönen steigen langsam neben der Figur auf (hinter der Figur).
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_n8 as N8

N, MS = 72, 75
sz = N8.Szene('undead-guardian-angel', (5, 5, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
AURA, AURA2, RING_HELL = (45, 0, 105), (70, 40, 149), (122, 94, 163)
ROT = [(79, 1, 2), (115, 0, 0), (128, 3, 0), (142, 3, 0), (176, 3, 0), (209, 0, 0)]        # Rampe des Herzsteins (dunkel → hell); der Rand (66,0,5) bleibt
AUGE, AUGE_HELL = (159, 0, 0), (209, 0, 0)
M_FLUEGEL = ((xx <= 2) | (xx >= 19)) & (yy >= 11) & (yy <= 23)
FLUEGEL = sz.teil(M_FLUEGEL)
REST = sz.teil(~M_FLUEGEL)
M_HERZ = sz.voll((yy >= 36) & (yy <= 48))
M_AUGEN = sz.voll((yy == 12) & ((xx == 7) | (xx == 14)))
RING_WEG = [(x, 1) for x in range(8, 14)] + [(14, 2)] + [(x, 3) for x in range(13, 7, -1)] + [(7, 2)]
TEST_EBENEN = ('figur',)
FETZEN = [dict(x=PL - 3, y=PT + 50, weg=-22, off=0, wackeln=1, leben=36), dict(x=PL + 23, y=PT + 44, weg=-24, off=13, wackeln=1, leben=36),
          dict(x=PL - 2, y=PT + 30, weg=-18, off=24, wackeln=1, leben=36), dict(x=PL + 22, y=PT + 20, weg=-16, off=30, wackeln=1, leben=36),
          dict(x=PL + 24, y=PT + 56, weg=-20, off=6, wackeln=1, leben=36)]
SENK = (0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0)


def frame(i, nur=None):
    a = SENK[i % 24]
    rest = REST
    k = (i - 6) % 24
    if k in (0, 1, 4, 5):
        rest = N8.farbtausch(REST, M_HERZ, {ROT[j]: ROT[j + 1] for j in range(len(ROT) - 1)})
        rest = N8.farbtausch(rest, M_AUGEN, {AUGE: AUGE_HELL})
    if not nur:
        if rest is REST:
            rest = REST.copy()
        p = (i % 24) * len(RING_WEG) // 24
        x, y = RING_WEG[p]
        rest[PT + y, PL + x, :3] = RING_HELL
    eb = []
    if not nur:
        eb.append((N8.blasen(sz.H, sz.W, i, N, FETZEN, AURA2), 0, 0))
    eb += [(FLUEGEL, 0, a), (rest, 0, 0)]
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N8.fertig('undead-guardian-angel', 'Undead Guardian Angel', frame, N, MS, spr, check=[0, 6, 8, 10, 20, 34], zoom=9)
