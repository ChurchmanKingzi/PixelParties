# -*- coding: utf-8 -*-
"""Idle-Animation für „Greatmaw Siren“ (Creature) — singende Hai-Sirene mit Anglerlicht (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveDeepsea", 84, 1]]   (Ebene „Greatmaw Siren“ enthält dieselbe Figur zweimal, pixelgleich; genommen ist die obere rechte.
13 fast deckende Pixel in Spalte 53 auf Alpha 255 gesetzt.) Der kleine Fisch der Karte (Ebene 85) und der rote Lichtschein (Ebene 83) sind Beiwerk.
Quelle: src/greatmaw-siren.png (62×45).

Identifikation (x, y): Angel: dünne dunkle Rute vom Scheitel (19,10) im Bogen über (8–12,0) nach vorn unten bis (3,3); daran der rote Köder
(Raute x 0–4, y 3–7, zwei Rottöne) – das Anglerlicht. Kopf: Schnauze links (x 1–12, y 9–19) mit weißen Zähnen im Oberkiefer (4,13)(6,14)(8,15)(10,17);
Unterkiefer als Keil x 5–9, y 20–24 mit Zähnen (5,20)(7,20)(9,20); dazwischen offenes Maul. Rotes Auge x 11–15, y 12–15 (weißer Lichtpunkt (14,13)).
Haare: beige/braune Strähnen (fünf Farben) von x 9–34, y 9–30, fallen schräg nach hinten über Nacken und Rücken. Heller Kehl-/Bauchstreifen
x 10–24, y 20–38. Rosa Muschel-Oberteil x 10–18, y 27–38. Arm/Seitenflosse dunkelblau x 21–29, y 28–33. Rückenflosse x 31–36, y 16–22.
Bauchflossen x 23–36, y 39–44 (zwei Lappen). Schwanzstiel x 38–48, Schwanzflosse x 46–61, y 26–40.

Ablauf (64 Frames à 70 ms ≈ 4,5 s):
* Schwimmen: die GANZE Figur gleitet weich (±2 px waagerecht, ±1 px senkrecht).
* Schwanzschlag in fünf handgesetzten Posen (Flosse −2…+2 px, starr; Stufen im Stiel auf den Stufen des Umrisses), zwei Schläge je Schleife.
* Bauchflossen paddeln: die unteren Zeilen (y ≥ 41) ±1 px, dem Schwanz nachlaufend.
* Anglerrute wippt: der Faden biegt sich (Spitze federt 0…3 px nach oben, ±1 px waagerecht), der Köder hängt starr an der Spitze und leuchtet regelmäßig auf (die dunkleren Punkte werden hellrot).
* Sirene singt: der Unterkiefer-Keil dreht um das Kiefergelenk (Spitze −2…+1 px) in Phrasen; Zähne gehen mit.
* Haare wehen: die Strähnen unterhalb von y = 21 laufen als Welle zeilenweise ±1 px; der Körper darunter ist ergänzt (Farbe des Nachbarpixels derselben
  Zeile, nie Umrissfarbe), frei hängende Kanten bleiben frei.
* Blinzeln (Frames 30–33): Lid in der umgebenden Kopffarbe.
Starr: Oberkiefer mit Zähnen, Muschel-Oberteil, Arm, Rückenflosse. Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 64, 70
spr = L.lade('greatmaw-siren')
B = G.Buehne(spr, 7, 6, 7, 7)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
UMRISS = (4, 13, 26)
RAND = G.rand_farben(spr)

HAARFARBEN = [(94, 70, 66), (116, 91, 84), (169, 145, 132), (232, 208, 178), (252, 228, 200)]
haar = L.farbmaske(spr, HAARFARBEN)
KOEDER = [(183, 63, 63), (149, 49, 49)]
koeder = L.farbmaske(spr, KOEDER)
RUTE = [(19, 10), (19, 9), (18, 8), (18, 7), (17, 6), (17, 5), (16, 4), (15, 3), (14, 2), (13, 1), (12, 0), (11, 0), (10, 0), (9, 0), (8, 0),
        (7, 1), (6, 1), (5, 2), (4, 2), (3, 3)]
rute = np.zeros_like(B.da)
for (x, y) in RUTE[2:]:
    assert tuple(int(v) for v in spr[y, x, :3]) == UMRISS, (x, y)
    rute[y, x] = True
schwanz = B.da & (xx >= 38) & ~haar
bauchfl = B.da & (yy >= 40) & (xx < 45)
kiefer = B.da & (xx <= 9) & (yy >= 20) & (yy <= 24) & ~koeder
rumpf = B.da & ~haar & ~koeder & ~rute & ~schwanz & ~bauchfl & ~kiefer
GRUND = G.grund_unter(spr, haar, UMRISS)

RUHE = B.teil(B.da & ~koeder)
SCHWANZ = {0: ([], 0), 1: ([44], 1), 2: ([40, 44], 1), -1: ([45], -1), -2: ([41, 45], -1)}
ROT = (r := spr[..., 0].astype(int), g := spr[..., 1].astype(int))
auge = B.da & (xx >= 10) & (xx <= 16) & (yy >= 11) & (yy <= 16) & ((r > 2 * g + 20) | ((r < 10) & (g < 10)) | ((r > 250) & (g > 250)))
LID = (58, 128, 255)
SINGEN = [0, 0, -1, -2, -2, -2, -1, 0, 1, 1, 0, -1, -2, -2, -1, 0, 0, 0, 0, 0, -1, -1, -2, -2, -2, -2, -1, 0, 1, 1, 1, 0]


def haare(i):
    dxs = {}
    for y in range(21, B.sh):
        amp = 1.25 * min(1.0, (y - 20) / 5.0)
        f = lambda k: np.sin(2 * np.pi * k / (N / 2) - 0.45 * (y - 21))
        dxs[y] = int(round(amp * f(i))) if i else 0
    return L.platz(G.ebene_ueber_grund(None, haar, spr, dxs), H, W, B.pl, B.pt)


def frame(i):
    dx, dy = G.gleiten(i, N, ax=2.0, ay=1.3, phx=0.0, phy=0.9)
    st, sign = SCHWANZ[G.pose(i, N / 2, 2, scharf=1.25)]
    s = G.stufen_spalten(B.teil(schwanz), [B.pl + x for x in st], sign)
    f = G.stufen_zeilen(B.teil(bauchfl), [B.pt + 41], G.pose(i - 5, N / 2, 1, scharf=1.3) if i else 0)
    k = G.scher_spalten(B.teil(kiefer), B.pl + 11, SINGEN[i % 32], seite=-1, ende=B.pl + 5)
    grund = L.platz(np.where((rumpf | haar)[..., None], GRUND, 0).astype(np.uint8), H, W, B.pl, B.pt)
    if i in (30, 31, 32, 33):
        for y, x in np.argwhere(auge):
            if i in (31, 32) or y <= 13:
                grund[B.pt + y, B.pl + x, :3] = LID
    ru = -int(round(1.5 * (1 - np.cos(2 * np.pi * i / (N / 2)))))        # Rute federt nur nach oben (0 … −3 px): der Köder berührt den Kopf nie
    rx = G.pose(i, N, 1)
    fd, (tx, ty) = G.faden(H, W, [(B.pl + x, B.pt + y) for (x, y) in RUTE], UMRISS, (rx, ru))
    ko = B.teil(koeder)
    if (i // 4) % 4 == 2:                                # Köder leuchtet auf: die dunkleren Punkte nehmen das helle Rot an
        ko = L.tausche(ko, {KOEDER[1]: KOEDER[0]})
    unten = L.zusammen(H, W, [(f, 0, 0), (s, 0, 0), (grund, 0, 0), (k, 0, 0)])
    ganz = L.zusammen(H, W, [(unten, 0, 0), (haare(i), 0, 0), (fd, 0, 0)])
    ganz = G.loecher_stopfen(ganz, RUHE)                 # 1-px-Lücken zwischen verschobenen Haarzeilen/Schwanzstufe: Pixel der Ruhepose
    ganz[G.loecher(ganz)] = HAARFARBEN[0] + (255,)       # die Kerbe zwischen Haarspitze und Rücken schließt sich beim Wehen: Haarkontur statt Loch
    ganz = G.umriss_flicken(ganz, RAND, lambda p: HAARFARBEN[0] if tuple(int(v) for v in p[:3]) in HAARFARBEN else UMRISS)
    ganz = L.zusammen(H, W, [(ganz, 0, 0), (L.versetze(ko, tx, ty), 0, 0)])
    return L.versetze(ganz, dx, dy)


if __name__ == '__main__':
    G.fertig('greatmaw-siren', 'Greatmaw Siren', frame, N, MS, spr, sys.argv)
