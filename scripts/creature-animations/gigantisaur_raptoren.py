# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Raptoren“ (Creature) — zwei Raptoren, die lauern und schnappen.

PICK: [["MotiveGrailWar", 505, "ganze Ebene „Raptoren“ (44×56 px, beide Raptoren, nur Alpha 0/255)"]]
Quelle: src/gigantisaur-raptoren.png (17 Farben). Die Ebene zeigt beide Tiere vollständig (in der Kartenkunst sind beim unteren die Füße abgeschnitten). Das untere Tier ist das gespiegelte obere.
Nichts ergänzt.

Aufruf:   python3 gigantisaur_raptoren.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-raptoren.png + .json

Identifikation (x, y im Sprite; oberer Raptor „A“ blickt nach links unten, unterer „B“ = Spiegelbild, blickt nach rechts unten):
* Kopf A (x 20–29, y 7–20): zwei Stirnhöcker (21–22 und 27–28, y 7), Nasenlöcher (schwarz, (21,11) (23,11)), Auge = 1 gelbbraunes Pixel (27,10) im blauen Streifen,
  weit offenes Maul (21–28, 12–20): obere Zähne (beige P, y 13), dunkelroter Rachen (E), rosa Zunge (O), untere Zähne (P, y 17–19), Kinnumriss (22–25, 20).
* Rücken/Hals A (x 29–40, y 7–14) mit blauem Rückenstreifen (C); Schwanz A (x 34–43, y 0–7): steigt senkrecht auf (x 40–43) und knickt oben nach links (34–40, 0–2).
* Gliedmaßen A (x 25–38, y 21–31): drei dünne Läufe mit weißen Krallen (Q) bei (27,27), (30,27) und (34–37, 29–30).
* Raptor B: Kopf (x 14–23, y 31–44), Auge (16,34), Schwanz (x 0–9, y 24–31), Läufe (x 5–18, y 45–55).
Bleibt fest: Zähne, Krallen, Streifenmuster (bewegen sich nur mit ihrem Körperteil).

Idle-Idee: die zwei lauern nebeneinander, schnappen abwechselnd mit dem Maul, peitschen mit dem Schwanz und richten sich beim Atmen auf.
Ablauf (60 Frames à 75 ms = 4,5 s); B läuft um eine halbe Schleife versetzt zu A:
* Schnappen (je Tier zwei schnelle Bisse, A ab Frame 6, B ab Frame 36): der Unterkiefer als Pose – aus dem Maul entfallen 1–2 Zungenzeilen, Kinn, Zunge und untere Zähne rücken unverändert hoch
  (offen → halb → zu → halb → offen). Der Kopf stößt dabei 1 px nach unten (Kopf starr, Hals biegt sich über drei Spalten).
* Schwanz peitscht (2× je Schleife, A und B gegenläufig): das senkrechte Stück neigt sich zeilenweise (Gefälle ≤ 1 px je Zeile), die abgeknickte Spitze wandert starr ±2 px seitlich.
* Atmen/Aufrichten (2× je Schleife, versetzt): eine Zeile der Läufe (A: Zeile 22, B: Zeile 46) wird texturiert eingefügt (anim_textur) – der ganze Körper hebt sich 1 px, die Krallen bleiben am Boden.
* Blinzeln (A Frames 44–47, B 14–17): das Augenpixel nimmt die Farbe des blauen Streifens an.
Offene Kanten schließt anim_tiere.umriss_schliessen (Umrissfarbe des Originals). Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import cv2
import numpy as np

import anim_drache as D
import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 60, 75
PAD = 5

spr = L.lade('gigantisaur-raptoren')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
_, lab = cv2.connectedComponents(vorhanden.astype(np.uint8), connectivity=8)
assert lab.max() == 2, 'erwartet: genau zwei Raptoren'

D_, B_, A_, C_ = (30, 39, 34), (28, 10, 6), (2, 3, 0), (9, 42, 59)
MAUL_FARBEN = [B_, (65, 42, 36), (178, 138, 136), (182, 176, 154), (116, 90, 93)]
UMRISS = [D_, B_, A_]
REGEL = T.umriss_regeln(spr, UMRISS)[2]
KAU = [1, 2, 2, 1, 0, 0, 1, 2, 2, 1]


class Raptor:
    def __init__(self, kern, spiegel, y0, versatz):
        """kern: ein Pixel des Tiers; spiegel: False = blickt nach links (A), True = nach rechts (B); y0: Zeilenversatz gegenüber A; versatz: Phasenversatz in Frames."""
        self.m = lab == lab[kern[1], kern[0]]
        self.sp, self.y0, self.versatz = spiegel, y0, versatz
        fx = (lambda x: 43 - x) if spiegel else (lambda x: x)            # Spalten von A auf dieses Tier abbilden
        self.fx = fx
        xs = self.fx
        box = lambda xa, xb, ya, yb: (xx >= min(xs(xa), xs(xb))) & (xx <= max(xs(xa), xs(xb))) & (yy >= ya + y0) & (yy <= yb + y0)
        self.maul = self.m & ((L.farbmaske(spr, MAUL_FARBEN) & box(20, 28, 12, 20)) | (box(20, 20, 13, 15)))
        self.kopf = self.m & box(0, 31, 0, 20) & ~self.maul                # Kopf + Halsansatz (biegt sich an x 29–31)
        self.schwanz = self.m & box(34, 43, 0, 6)
        self.rest = self.m & ~self.maul & ~self.kopf & ~self.schwanz
        self.auge = (xs(27), 10 + y0)
        self.atem_zeile = 22 + y0
        self.maul_zeile = 18 + y0
        self.s = -1 if spiegel else 1

    def teil(self, maske):
        t, _ = L.trenne(spr, maske)
        return L.platz(t, H, W, PAD, PAD)

    def ebene(self, i):
        j = (i + self.versatz) % N
        kau = Z.hub(j, [6], KAU)
        nick = 1 if kau else 0
        atem = 1 if ((j + 8) % 30) in range(0, 13) else 0
        bl = D.blinzeln(j, 44)
        # Schwanz: Zeilen 0…6 (relativ), Fuß bei Zeile 6
        amp = 2.0 * Z.sinus(j, N / 2) * self.s
        dxs = Z.gefaelle({PAD + self.y0 + y: int(round(amp * min(1.0, (6 - y) / 3.0))) for y in range(0, 8)}, PAD + self.y0 + 7)
        sw_ = Z.zeilen_dx(self.teil(self.schwanz), dxs)
        kp = self.teil(self.kopf)
        if bl:
            kp[PAD + self.auge[1], PAD + self.auge[0], :3] = C_
        ml = L.heben_unten(self.teil(self.maul), PAD + self.maul_zeile, kau)
        kp = L.zusammen(H, W, [(kp, 0, 0), (ml, 0, 0)])
        if nick:
            x_fest, x_starr = PAD + self.fx(32), PAD + self.fx(29)
            x_ende = PAD + self.fx(20) - (2 if not self.sp else -2)
            kp = Z.spalten_dy(kp, Z.biegung(x_fest, x_ende, x_starr, nick))
        f = L.zusammen(H, W, [(self.teil(self.rest), 0, 0), (sw_, 0, 0), (kp, 0, 0)])
        f = T.umriss_schliessen(f, UMRISS, REGEL)
        return TX.streck_zeile(f, PAD + self.atem_zeile, atem)


A = Raptor((30, 10), False, 0, 0)
B = Raptor((13, 34), True, 24, 30)


def frame(i, nur=None):
    return L.zusammen(H, W, [(A.ebene(i), 0, 0), (B.ebene(i), 0, 0)])


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n), '| Original', int(vorhanden.sum()))
    print('Lücken je Frame (Original %d):' % Z.loecher(spr), sorted({Z.loecher(f) for f in frames}))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-raptoren', 'Gigantisaur Raptoren', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-raptoren-strip.png', frames, spalten=10, scale=4)
