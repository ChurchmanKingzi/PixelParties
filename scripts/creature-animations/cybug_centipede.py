# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug CENTIPEDE“ (Creature) — mechanischer Tausendfüßler auf Wagenrädern (Neubau Welle 3, Gruppe n3).

PICK: [["Motive", 402, 1]]   (Ebene „Cybug CENTIPEDE“; die Figur unten rechts, waagerecht gespiegelt wie in der Kartenkunst. Die weißen Kreuze
derselben Ebene sind Beiwerk. Das Schwanzende endet in der Ebene mit einem runden Glied – vollständig.)
Quelle: src/cybug-centipede.png (74×47).

Identifikation (x, y): Körper aus grau gerasterten Kugelgliedern, vom Schwanz oben links (x 0–10, y 0–13) in Bögen bis zum Kopf unten rechts.
Drei Wagenräder in Seitenansicht (13×13, braune Achteck-Felge, Speichenkreuz, graue Nabe; zwischen den Speichen durchsichtig): Mitte (17,24),
(32,31), (48,19). Dahinter zwei verdeckte Räder der anderen Seite (Bögen bei x 18–25, y 10–15 und x 41–46, y 6–9). Am Vorderkörper vier Räder
von vorn (senkrechte braune Balken x 53–55/65–67, y 28–41 und x 56–58/69–71, y 18–30) mit grauen Achsstummeln. Auf den Gliedern kleine Zapfen mit
schwarzer Kappe. Kopf x 55–65, y 34–46: zwei rote Augen (2×2, x 57–58 und 62–63, y 39–40), darunter zwei Kieferzangen (y 42–46).

Ablauf (48 Frames à 70 ms ≈ 3,4 s) — Maschine steht am Boden, kein Schweben:
* Die drei Seitenräder drehen sich auf der Stelle (Leerlauf): Speichenkreuz wechselt zwischen + (Original) und × (handgesetzt), je 3 Frames,
  Felge und Nabe starr. Hinter den Speichen ist der Durchblick ergänzt (nächster durchsichtiger Innenpixel).
* Schwanz zuckt: das Endglied (starr, als Einheit) schiebt sich 1 px schräg unter das zweite Glied und wieder heraus (Teleskop; nichts wird
  freigelegt, weil es hinter dem Nachbarglied verschwindet).
* Kieferzangen schnappen (Zeilen y ≥ 44 je 1 px nach innen, zweimal kurz hintereinander).
* Augen glühen auf (nur die vier Augenpixel: dunkles Rot wird hellrot).
Starr: alle übrigen Glieder, Zapfen, Vorderräder. Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 48, 70
spr = L.lade('cybug-centipede')
B = G.Buehne(spr, 4, 4, 5, 4)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
RAND = G.rand_farben(spr)
UMRISS = (38, 38, 38)
HOLZ = [(26, 16, 0), (50, 30, 0), (70, 43, 0), (95, 58, 0), (123, 75, 0), (147, 90, 0)]
RAEDER = [G.Speichenrad(spr, cx, cy, HOLZ, HOLZ[0], HOLZ[5], HOLZ[4]) for (cx, cy) in ((17, 24), (32, 31), (48, 19))]
_GRENZE = {0: 11, 1: 11, 2: 11, 3: 11, 4: 8, 5: 7, 6: 6, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5}     # Endglied: je Zeile alles links vom Umriss des zweiten Glieds
schwanz = np.zeros_like(B.da)
for _y, _x in _GRENZE.items():
    schwanz[_y, :_x + 1] = B.da[_y, :_x + 1]
zange_l = B.da & (yy >= 44) & (xx <= 58)
zange_r = B.da & (yy >= 44) & (xx >= 60)
rumpf = B.da & ~schwanz & ~zange_l & ~zange_r
ZANGE = {20: 1, 21: 1, 22: 1, 26: 1, 27: 1, 28: 1}
GLUT = set(range(8, 14)) | set(range(32, 38))
ZUCKEN = set(range(4, 9)) | set(range(14, 17)) | set(range(40, 45))


def frame(i):
    r = B.teil(rumpf)
    for k, rad in enumerate(RAEDER):
        rad.zeichne(r, i // 3, B.pl, B.pt)
    if i in GLUT:
        r = L.tausche(r, {(150, 0, 0): (255, 0, 0)})
    e = 1 if i in ZUCKEN else 0
    z = ZANGE.get(i, 0)
    ganz = L.zusammen(H, W, [(B.teil(schwanz), e, e), (r, 0, 0), (B.teil(zange_l), z, 0), (B.teil(zange_r), -z, 0)])
    return G.umriss_flicken(ganz, RAND, UMRISS)


if __name__ == '__main__':
    G.fertig('cybug-centipede', 'Cybug CENTIPEDE', frame, N, MS, spr, sys.argv)
