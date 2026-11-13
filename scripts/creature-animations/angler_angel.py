# -*- coding: utf-8 -*-
"""Idle-Animation für „Angler Angel“ (Creature) — rosa Engelchen mit Anglerlicht (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveMoe", 306, 5]]   (Ebene „Gangsta“, Figur bei x 269–301, y 146–168 – der schlichte Engel rechts neben dem Gangster Angel;
waagerecht gespiegelt wie in der Kartenkunst: Licht rechts.)
Quelle: src/angler-angel.png (33×23).

Identifikation (x, y): runder rosa Körper x 10–24, y 5–19 (Umriss (233,134,184)/(223,121,161)); zwei Augen (grün (91,169,88)/(104,181,98) mit
weißem Lichtpunkt, (16–17, 10–12) und (19–21, 10–12)); zwei dunkle Füße y 19–22. Flügel links x 0–10 und rechts x 22–32 (weiß/hellgrau, grauer
Umriss). Angel: graue Rute aus dem Scheitel (17,4–6) im Bogen nach rechts oben über (19–20,2), daran oben ein kleiner gelber Ring
(x 21–23, y 0–4), weiter als Schnur (23,2)(24,3)(25,4)(26,5)(26,6)(27,7)(27,8) hinab zum Köder: dem gelben ANGLERLICHT (x 24–29, y 7–12,
heller Kern (26–27, 9), gelber Hof) vor dem rechten Flügel.

Ablauf (48 Frames à 70 ms ≈ 3,4 s):
* Flügelschlag: BEIDE Flügel schlagen als Ganzes um den Körperansatz (linker Flügel Gelenk x = 10, rechter x = 22; Spalten wandern senkrecht,
  Spitze −2…+2 px in gehaltenen Posen, nichts wird gestreckt), drei Schläge je Schleife.
* Schweben: die ganze Figur hebt/senkt sich um 1 px, dem Flügelschlag nachlaufend. Rute, Schnur und Licht sind starr mit dem Körper verbunden.
* Anglerlicht pulsiert (nur seine eigenen Pixel: Kern wächst/schrumpft über die vier Gelbtöne).
* Blinzeln (Frames 20–23): Lid in Körperrosa.
Ergänzung: der rechte Flügel ist unter Licht und Schnur fertiggezeichnet (x 24–29, y 5–12: am Körperrand hellgrau (208), dann (245), sonst Weiß) –
er schlägt hinter dem Licht.
Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 48, 70
spr = L.lade('angler-angel')
B = G.Buehne(spr, 3, 3, 5, 5)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
WEISS4 = [(143, 143, 143), (208, 208, 208), (245, 245, 245), (255, 255, 255)]
LICHT = [(255, 251, 210), (255, 246, 145), (255, 234, 0), (228, 220, 100)]       # Hof, Schein, Kern, dunkleres Gelb
weiss = L.farbmaske(spr, WEISS4)
fl_l = weiss & (xx <= 10) & (yy >= 4)
fl_r_sichtbar = weiss & (yy >= 3) & ((xx >= 26) | ((xx >= 22) & (yy >= 5)))
# rechter Flügel vollständig: unter Schnur und Licht fertiggezeichnet (die Flügel sind nicht spiegelgleich, daher nach dem Aufbau der sichtbaren
# Zeilen: innen am Körper 1 px hellgrau, dann 1 px fast weiß, sonst weiß)
fl_r_bild = np.zeros_like(spr)
fl_r_bild[fl_r_sichtbar] = spr[fl_r_sichtbar]
verdeckt = B.da & ~weiss & (xx >= 24) & (xx <= 29) & (yy >= 5) & (yy <= 12) & ~L.farbmaske(spr, [(223, 121, 161), (233, 134, 184), (238, 181, 209)])
for _y, _x in np.argwhere(verdeckt):
    _innen = min(x for x in range(22, 33) if weiss[_y, x] or verdeckt[_y, x])          # erste Flügelspalte dieser Zeile
    fl_r_bild[_y, _x] = (WEISS4[1] if _x - _innen <= 1 else (WEISS4[2] if _x - _innen == 2 else WEISS4[3])) + (255,)
rest = B.da & ~fl_l & ~fl_r_sichtbar
ERGAENZT = [(int(x), int(y)) for y, x in np.argwhere(verdeckt)]
licht = L.farbmaske(spr, LICHT) & (yy >= 7)
RAND = G.rand_farben(spr)
RUHE = B.teil(B.da)
AUGEN = [(x, y) for y in range(9, 13) for x in range(15, 22) if tuple(int(v) for v in spr[y, x, :3]) in
         ((91, 169, 88), (104, 181, 98), (116, 139, 116), (254, 253, 253))]
LID = (238, 181, 209)
PULS = {1: {LICHT[1]: LICHT[2], LICHT[0]: LICHT[1]}, 3: {LICHT[2]: LICHT[1]}}       # 0/2 = Original


def frame(i):
    schlag = G.pose(i, N / 3, 2, scharf=1.2)
    bob = int(round(0.6 * (np.sin(2 * np.pi * (i - 3) / (N / 3)) - np.sin(2 * np.pi * (-3) / (N / 3)))))
    l = G.scher_spalten(B.teil(fl_l), B.pl + 10, schlag, seite=-1)
    r = G.scher_spalten(L.platz(fl_r_bild, H, W, B.pl, B.pt), B.pl + 22, schlag, seite=1)
    k = B.teil(rest)
    zustand = (i // 4) % 4
    if zustand in PULS:
        k = L.tausche(k, PULS[zustand], maske=L.platz(np.repeat(licht[..., None], 4, 2).astype(np.uint8) * 255, H, W, B.pl, B.pt)[..., 3] > 0)
    if i in (20, 21, 22, 23):
        for (x, y) in AUGEN:
            if i in (21, 22) or y <= 10:
                k[B.pt + y, B.pl + x, :3] = LID
    ganz = L.zusammen(H, W, [(l, 0, 0), (r, 0, 0), (k, 0, 0)])
    ganz = G.loecher_stopfen(ganz, RUHE)                       # 1-px-Kerbe zwischen Schnur und Flügeloberkante beim Abschlag
    ganz = G.umriss_flicken(ganz, RAND, WEISS4[0])
    return L.versetze(ganz, 0, bob)


if __name__ == '__main__':
    G.fertig('angler-angel', 'Angler Angel', frame, N, MS, spr, sys.argv)
