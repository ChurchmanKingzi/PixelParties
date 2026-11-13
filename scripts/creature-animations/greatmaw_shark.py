# -*- coding: utf-8 -*-
"""Idle-Animation für „Greatmaw Shark“ (Creature) — schwimmender Hai (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveDeepsea", 93, 1], ["MotiveDeepsea", 92, 1]]
Quelle: src/greatmaw-shark.png (59×29). Ebene 93 „Greatmaw Shawk“ ist der Hai der Karte (Blick nach links, rotes Auge, Maul offen), ihr Schwanz
läuft aber halbtransparent in die Höhle aus. Ebene 92 „Greatmaw Shawk-Kopie“ ist derselbe Hai um 180° gedreht und vollständig (der Wirt der
Remora-Karte). Der Sprite nimmt deshalb x < 36 aus Ebene 93 und den Schwanz (x ≥ 36) aus der zurückgedrehten Ebene 92 (Naht deckungsgleich;
6 fast deckende Pixel der Bauchkante bei (36–39, 18–19) auf Alpha 255 gesetzt). Der blaue Fisch der Karte ist Beute (eigene Ebene), kein Teil des Hais.

Identifikation (x, y): Schnauze/Oberkiefer x 0–10, y 8–17 mit weißen Zähnen (3,12)(5,13)(7,14)(9,16); Unterkiefer x 3–9, y 19–23 mit Zähnen
(8,19)(6,20)(4,21); die Maulöffnung dazwischen ist frei. Rotes Auge x 10–13, y 11–14 (weißer Lichtpunkt (12,12), schwarze Pupille (11,13)).
Drei Kiemenschlitze x 17–26, y 12–17. Rückenflosse x 24–33, y 0–11. Heller Bauch y 18–21. Brustflosse x 19–33, y 22–28 (zwei Lappen).
Schwanzstiel x 36–46, Schwanzflosse x 46–58, y 8–21.

Ablauf (64 Frames à 70 ms ≈ 4,5 s) — schwerer Hai, ruhig:
* Schwimmen: die GANZE Figur gleitet weich (±2 px waagerecht, ±1 px senkrecht, Lissajous, Frame 0 = Original).
* Schwanzschlag als saubere Posen: Schwanzstiel + Flosse (x ≥ 36) schwenken in fünf handgesetzten Posen (Flosse −2…+2 px, die Flosse selbst
  bleibt starr; die Stufen im Stiel liegen auf den Stufen des Umrisses, jede Spalte bleibt unverändert – nichts wird gestreckt), zwei Schläge je Schleife.
* Brustflosse paddelt: die Zeilen unter dem Ansatz (y ≥ 23) wandern an der Spitze ±1 px waagerecht, dem Schwanz nachlaufend.
* Unterkiefer (x ≤ 9, y ≥ 18) schnappt: dreht um das Kiefergelenk bei x = 10 bis 4 px an der Spitze zu und wieder auf (Zähne gehen mit ihren Spalten mit),
  ein langsames Schließen und ein schneller Biss je Schleife.
* Auge glüht kurz auf (nur innerhalb der Augenpixel, eine Rotstufe heller), kein Blinzeln (Hai).
Starr: Kopf, Zähne im Oberkiefer, Kiemen, Rückenflosse. Keine Partikel. Nur ganze Pixel, nur Quellfarben; keine Ergänzungen nötig.

RUNDE 8 (Nutzer: „Sollten BEIDE Kiefer bewegen und ihre Mäuler ganz schließen können“): Ober- UND Unterkiefer sind jetzt Posen um das Kiefergelenk (Spalte x = 10 bleibt stehen):
die Schnauze (x ≤ 9, y ≤ 17) senkt sich, der Unterkiefer (x ≤ 9, y ≥ 18) hebt sich, je Spalte starr (G.spalten_pose, Zieltabellen OBER_ZU/UNTER_ZU, fünf Posen 0…4 = offen … zu).
In der Pose „zu“ liegen die Lippenlinien lückenlos aufeinander (Oberlippe Zeile 16, Unterlippe Zeile 17, x 3–9) und die Zähne greifen ineinander: die oberen Zähne (x 3/5/7/9) stehen
vor der Unterlippe, die unteren (x 4/6/8) vor der Oberlippe – kein Hintergrundpixel mehr im Maul, keine Lücke am Gelenk (Spalte 9 schließt an Spalte 10 an). Zähne liegen immer zuoberst.
Ablauf wie bisher: ein langsames Schließen (Frames 8–22, vier Frames ganz zu) und ein schneller Biss (Frames 41–46).
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 64, 70
spr = L.lade('greatmaw-shark')
B = G.Buehne(spr, 6, 6, 7, 7)
H, W = B.H, B.W
xx, yy = B.xx, B.yy

schwanz = B.da & (xx >= 36)
ZAHN = (255, 255, 255)
maul = B.da & (xx <= 9)
zaehne = maul & L.farbmaske(spr, [ZAHN])
kiefer = maul & (yy >= 18) & ~zaehne                      # Unterkiefer
oberkiefer = maul & (yy <= 17) & ~zaehne                 # Schnauze/Oberkiefer
flosse = B.da & (yy >= 23) & (xx >= 14)
rumpf = B.da & ~schwanz & ~maul & ~flosse

RAND = G.rand_farben(spr)
UMRISS = (4, 13, 26)
AUGE_HELLER = {(0x25, 0, 0): (0x7d, 0, 0), (0x7d, 0, 0): (0x9f, 0, 0), (0x9f, 0, 0): (0xc4, 0, 0)}
AUGE = L.rechteck(spr, 10, 11, 14, 15)
# Runde 8: Kieferposen. Ziel-Versatz je Spalte in der Pose „zu“ (Sprite-x → dy): Schnauze senkt sich, Unterkiefer hebt sich; Gelenk = Spalte 10 (fest)
OBER_ZU = {9: 1, 8: 2, 7: 3, 6: 3, 5: 4, 4: 5, 3: 5, 2: 5, 1: 5, 0: 5}
UNTER_ZU = {9: -2, 8: -3, 7: -3, 6: -4, 5: -4, 4: -5, 3: -5}
MAUL_STUFEN = 4
KIEFER = {}                                                      # Frame → Pose 0 (offen, Original) … 4 (ganz zu)
for k, v in enumerate([1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 1, 1]):       # langsames Schließen
    KIEFER[8 + k] = v
for k, v in enumerate([2, 4, 4, 4, 2, 1]):                               # schneller Biss
    KIEFER[41 + k] = v
# Schwanzposen: Spalten, ab denen der Schwanz eine Stufe weiter wandert – auf die Stufen des Umrisses gelegt (Bauchkante stuft bei x = 41 und 49)
SCHWANZ = {0: ([], 0), 1: ([41], 1), 2: ([41, 45], 1), -1: ([49], -1), -2: ([38, 49], -1)}
GLUT = set(range(22, 28)) | set(range(50, 54))


def frame(i):
    dx, dy = G.gleiten(i, N, ax=2.0, ay=1.2, phx=0.0, phy=1.1)
    r = B.teil(rumpf)
    if i in GLUT:
        r = L.tausche(r, AUGE_HELLER, maske=L.platz(AUGE[..., None].repeat(4, 2).astype(np.uint8), H, W, B.pl, B.pt)[..., 0] > 0)
    st, sign = SCHWANZ[G.pose(i, N / 2, 2, scharf=1.25)]
    s = G.stufen_spalten(B.teil(schwanz), [B.pl + x for x in st], sign)
    f = G.scher_zeilen(B.teil(flosse), B.pt + 22, G.pose(i, N / 2, 1, ph=-1.0, scharf=1.25), seite=1)
    zu = KIEFER.get(i, 0) / MAUL_STUFEN
    oz = {B.pl + x: v for x, v in OBER_ZU.items()}
    uz = {B.pl + x: v for x, v in UNTER_ZU.items()}
    zo, zu_ = B.teil(zaehne & (yy <= 17)), B.teil(zaehne & (yy >= 18))
    k = L.zusammen(H, W, [(G.spalten_pose(B.teil(oberkiefer), oz, zu), 0, 0), (G.spalten_pose(B.teil(kiefer), uz, zu), 0, 0),
                          (G.spalten_pose(zo, oz, zu), 0, 0), (G.spalten_pose(zu_, uz, zu), 0, 0)])        # Zähne zuoberst
    return G.umriss_flicken(L.zusammen(H, W, [(f, dx, dy), (s, dx, dy), (r, dx, dy), (k, dx, dy)]), RAND, UMRISS)


if __name__ == '__main__':
    G.fertig('greatmaw-shark', 'Greatmaw Shark', frame, N, MS, spr, sys.argv)
