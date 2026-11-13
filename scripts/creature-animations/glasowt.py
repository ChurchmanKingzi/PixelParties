# -*- coding: utf-8 -*-
"""Idle-Animation für „Glasowt“ (Creature) — der fleischrosa Koloss mit Glashelm, breitem Zahnmaul, leuchtendem Kern in der Brust und langen Armen, die sich auf Glasklauen stützen.

Quelle: src/glasowt.png (35×38 px, 26 Farben).
PICK: [["Motive", 837, 1]]   (Ebene „Glasowt“; 99,8 % Treffer mit der Kartenkunst, nur in dieser Karte; vollständig, Alpha nur 0/255. Nachbarebenen sind „Sichtbar“-Gesamtbilder.)

Was im Sprite ist (x, y):
* GLASHELM (x 10–24, y 0–9): graublaue Kuppel (159,172,180)/(188,202,205) mit dunkelgrauem Rahmen (96,102,100); darunter ein gelbes Wesen/Gesicht (15–19, 5–7) mit dunklen
  Pixeln (17,6), (16,7), (18,7) – nicht eindeutig (Augen? Gehirn?) → bleibt fest, blinzelt nicht (Regel: Helm/Visier blinzelt nicht).
* MAUL (x 10–24, y 9–14): rosa Lippen, dunkler Schlund (91,93,88), weiße ZÄHNE (224,219,215) bei (14,11), (16,11), (18,11), (20,11), (14,12), (20,12) – Zähne, keine Partikel.
* RUMPF (x 9–25, y 15–27): rosa; in der Brust der KERN (x 15–19, y 19–23): dunkle Raute mit hellem Kreuz – (17,20), (15,21), (17,21), (19,21), (17,22).
* ARME (links x 4–11, rechts x 23–30, y 19–30): lang, auf GLASKLAUEN gestützt (x 0–9 und x 25–34, y 31–36; graublau mit gelben Lichtern). Die Klauen stehen am Boden → völlig fest.
* BEINE (x 10–15 und x 19–24, y 28–34), dunkle FÜSSE (y 34–37).
Schwer → langsam (72 Frames à 80 ms = 5,8 s). Kein Feuer an der Figur (die Lava der Karte ist Szene).

Idee: Der Koloss stützt sich schwer auf seine Klauen – der Brustkorb hebt und senkt sich zwischen den fest stehenden Armen, das Maul klappt knurrend auf, der Kern in der Brust
blinzelt wie ein Auge (Doppelschlag).
Ablauf (nahtlos):
* Atmen (Periode 36, 2×): Rumpfmitte + Kopf (x 12–22 bis Zeile 26, darüber der ganze Kopf) heben sich 1 px – Zeile 26 wird texturiert eingefügt (anim_textur, nur diese Ebene).
  Arme, Klauen, Beine und Füße bleiben stehen. An der Schulternaht (Versatz 1 px) werden freiliegende Innenpixel zum Umriss (82,72,63) (Kontur bleibt geschlossen, Regel 16).
* Maul (Frames 28–33 und 38–43): der Unterkiefer (Zeilen 12–14) senkt sich 1 px; die neue Zeile dazwischen ist HANDGEZEICHNET (dunkler Schlund (91,93,88) zwischen den
  Lippenrändern) – keine kopierte Zeile, die Zähne bleiben oben bzw. gehen mit dem Unterkiefer nach unten.
* Kern (Periode 24, 3×, Doppelschlag): die vier Kreuzarme verlöschen kurz (→ Kern-Dunkel (81,76,70)) und leuchten wieder – nur innerhalb der Kernpixel.
* Glashelm: ein kurzer Sparkle (Mitte → Kreuz → Mitte, Frames 56–58) rechts auf der Kuppel bei (21,6). Glas ist hier als glänzendes Material behandelt
  (Annahme – falls unerwünscht: Zeile mit N4.funkeln streichen).
Frame 0 = Original.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 72, 80
G = N4.Figur('glasowt', 3, 3, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

UMRISS, SCHLUND, KERN_DUNKEL = f(10, 10), f(14, 10), f(16, 20)
GLAS_HELL, WEISS = f(21, 4), f(15, 11)
MITTE = (G.yy <= 14) | ((G.xx >= 12) & (G.xx <= 22) & (G.yy <= 26))
KREUZ = [(17, 20), (15, 21), (19, 21), (17, 22)]
NAHT = np.zeros((H, W), bool); NAHT[OFF[1] + 14:OFF[1] + 27] = True


def maul_auf(m):
    """Unterkiefer (Zeilen 12–14) 1 px tiefer; Zeile 12 neu: Lippenränder der alten Zeile 12, dazwischen dunkler Schlund."""
    out = m.copy()
    y12 = OFF[1] + 12
    out[y12 + 1:y12 + 4] = m[y12:y12 + 3]
    neu = m[y12].copy()
    xs = [x for x in range(W) if neu[x, 3]]
    for x in xs[3:-2]:
        neu[x, :3] = SCHLUND
    out[y12] = neu
    return out


def frame(i):
    mitte = G.ebene(MITTE & G.da)
    aussen = G.ebene(~MITTE & G.da)
    beat = [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][i % 24]
    if beat:
        Hm.setze(mitte, {p: KERN_DUNKEL for p in KREUZ}, OFF)
    N4.funkeln(mitte, 21, 6, Hm.folge(i, 56, [0, 1, 2], N), WEISS, GLAS_HELL, OFF)
    if Hm.takt(i, N, 28, 6) or Hm.takt(i, N, 38, 6):
        mitte = maul_auf(mitte)
    if Hm.stufe(i, 36, 1):
        mitte = TX.streck_zeile(mitte, G.PT + 26, 1)
    a = L.zusammen(H, W, [(aussen, 0, 0), (mitte, 0, 0)])
    return G.schliessen(a, lambda x, y: UMRISS, NAHT)


if __name__ == '__main__':
    N4.abschluss(G, 'Glasowt', [frame(i) for i in range(N)], MS, sys.argv, scale=5)
