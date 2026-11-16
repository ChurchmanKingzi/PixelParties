# -*- coding: utf-8 -*-
"""Idle-Animation für „Greatmaw Remora“ (Creature) — zwei Remoras, die sich an einem treibenden Hai festgebissen haben (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveDeepsea", 92, 1], ["MotiveDeepsea", 88, 2], ["MotiveDeepsea", 88, 3], ["MotiveDeepsea", 87, 1], ["MotiveDeepsea", 87, 2]]
Quelle: src/greatmaw-remora.png (58×32) = Kartenkomposition aus drei Ebenen: der Wirt (Ebene 92 „Greatmaw Shawk-Kopie“, Hai bauchoben, Kopf rechts,
src/greatmaw-remora-wirt.png – vollständig, auch unter den Remoras), die beiden Remoras (Ebene 88 „Greatmaw Remora“, Figuren 2 und 3) samt roten
Augen (Ebene 87) in src/greatmaw-remora-fische.png. Lage wie in der Kartenkunst (dort zusätzlich abgedunkelt). Der zweite Hai oben links in Ebene 88
gehört nicht zur Karte.

Identifikation (x, y): Wirt: Schwanzflosse links x 0–12, y 11–24; Rumpf mit drei Kiemenschlitzen x 30–40, y 15–20; heller Bauch (oben, da bauchoben)
y 10–13; Rückenflosse nach unten x 24–33, y 22–31; Maul rechts mit weißen Zähnen (48,11)(49,13)(48,15)(50,17)(52,18)(54,20); kein Auge.
Linke Remora (x 6–28, y 3–17, blickt nach rechts): Schwanz/Flossen links x 6–13, rotes Auge x 20–23, y 8–10, heller Kiefer y 11–14, lange weiße Zähne
nach unten in den Wirt (x 16–26, y 13–17). Rechte Remora (x 33–54, y 0–13, blickt nach links): Auge x 36–39, y 4–6, Zähne x 33–45, y 9–13, Schwanz rechts x 49–54.

Ablauf (64 Frames à 75 ms = 4,8 s):
* Treiben: die GANZE Gruppe gleitet weich (±2 px waagerecht, ±1 px senkrecht), der Wirt bleibt in sich starr bis auf die Schwanzflosse
  (x ≤ 12 senkt/hebt sich als Einheit um 1 px, langsam).
* Remoras zerren: jede Remora reißt abwechselnd am Wirt – 1 px zur Seite (die linke beißt sich vor, die rechte zerrt zurück; so öffnet sich nirgends
  eine Lücke zum Wirt), 1 px hoch, zurück, wieder zubeißen (starr als ganze Figur mit Zähnen;
  der Wirt darunter ist vollständig vorhanden). Links ab Frame 6 und 38, rechts ab Frame 22 und 54.
* Schwanzflossen der Remoras schlagen in sauberen Posen (äußere Spalten ±1 px, links Periode 16, rechts 21⅓ Frames).
* Augen der Remoras glühen beim Zerren kurz auf (nur innerhalb der Augenpixel, eine Rotstufe heller).
Nur ganze Pixel, nur Quellfarben, keine Ergänzungen (freigelegte Innenpixel an Scherstufen werden zur Umrissfarbe, anim_n3.umriss_flicken).
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 64, 75
spr = L.lade('greatmaw-remora')
wirt = L.lade('greatmaw-remora-wirt')
fische = L.lade('greatmaw-remora-fische')
B = G.Buehne(spr, 6, 6, 6, 6)
BW = G.Buehne(wirt, 6, 6, 6, 6)
BF = G.Buehne(fische, 6, 6, 6, 6)
H, W = B.H, B.W
xx = B.xx

QUELLE = np.concatenate([spr, wirt, fische], axis=0)          # Farben aller drei Quellebenen (der Wirt hat unter den Remoras eigene Pixel)
RAND = G.rand_farben(spr)
UMRISS = (4, 13, 26)
AUGE_HELLER = {(0x25, 0, 0): (0x7d, 0, 0), (0x7d, 0, 0): (0x9f, 0, 0)}
ZERREN = [(0, -1), (0, -1), (1, -1), (1, -1), (1, -1), (1, -1), (0, -1), (0, -1), (0, -1), (0, 0)]      # (seitwärts, hoch) je Frame; erst lösen, dann zerren
START = {'l': (6, 38), 'r': (22, 54)}


def zerr(i, seite):
    for s in START[seite]:
        if s <= i < s + len(ZERREN):
            return ZERREN[i - s]
    return None


def remora(i, seite):
    m = (xx <= 30) if seite == 'l' else (xx >= 31)
    a = BF.teil(BF.da & m)
    if seite == 'l':
        a = G.stufen_spalten(a, [-(B.pl + 12)], G.pose(i, 16, 1, scharf=1.5))
    else:
        a = G.stufen_spalten(a, [B.pl + 49], -G.pose(i, N / 3, 1, scharf=1.5))
    a = G.umriss_flicken(a, RAND, UMRISS)
    z = zerr(i, seite)
    if z is None:
        return a, 0, 0
    a = L.tausche(a, AUGE_HELLER)
    return a, z[0], z[1]           # beide rücken nach rechts: die linke beißt sich vor (über die Brustflosse des Wirts), die rechte zerrt zurück


def frame(i):
    dx, dy = G.gleiten(i, N, ax=2.0, ay=1.2, phx=0.6, phy=2.0)
    w = G.stufen_spalten(BW.teil(BW.da), [-(B.pl + 12)], G.pose(i, N, 1))
    w = G.umriss_flicken(w, RAND, UMRISS)
    ebenen = [(w, dx, dy)]
    for seite in ('l', 'r'):
        a, ax, ay = remora(i, seite)
        ebenen.append((a, dx + ax, dy + ay))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    G.fertig('greatmaw-remora', 'Greatmaw Remora', frame, N, MS, QUELLE, sys.argv)
