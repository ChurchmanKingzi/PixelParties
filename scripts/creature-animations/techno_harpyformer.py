# -*- coding: utf-8 -*-
"""Idle-Animation für „Techno Harpyformer“ (Creature) — Roboter-Harpyie mit Lautsprecherboxen auf den Schultern und Flammenflügeln (Düsenfeuer), schwebt im Bass-Takt.

PICK: [["MotiveGN", 508, "Ebene „Techno Harpyformer“, Figur 1 (x 208–239, y 231–261; 32×31 px, samt vier bunten Noten)"]]
Abgleich mit data/card-art/native/Techno_Harpyformer.png: Roboter, Flammen und Noten stimmen. Der Mann links in derselben Ebene (Zuhörer) gehört nicht dazu; Ebenen 504–507/509 sind
halbtransparente Rauch-/Lichtschleier der Szene.

Identifikation (32×31):
* Zwei Lautsprecherboxen (x 4–13 und 16–25, y 6–13; graues Metall, Membran als Schachbrett aus (97,97,99)/(72,72,74) bei x 6–10 bzw. 19–23, y 8–12).
* Kopf x 12–17, y 11–15 mit rotem Visier (13–14, 14–15; (238,0,0)) – Visier blinzelt nicht.
* Schwarze Arme schräg nach außen oben (y 14–19), grauer Metallrumpf x 9–20, y 16–25, Beine y 26–30 mit weißen Krallen (246,255,255).
* Flammenflügel links x 1–9, rechts x 20–28, y 16–29: hängen von den Armen nach unten (Rot (202,44,41) außen, Orange (244,123,34), Gelb (246,231,14), Kern (247,245,184)).
* Vier Noten: rot (x 4–5, y 0–5), blau (x 26–28, y 1–5), gelb (x 30–31, y 9–14), grün (x 0–2, y 13–17).
Er fliegt auf den Flammen (Düsen nach unten, in der Karte über dem Boden) → sanftes Schweben des GANZEN Sprites ist erlaubt.

Ablauf (64 Frames à 65 ms = 4,2 s). Frame 0 = Original, nur die Flammen sind neu gezeichnet (Feuer wird nie verzerrt, sondern als Zyklus gezeichnet):
* Flammenflügel: anim_feuer3 in der lebhaften Einstellung (posen=16, halten=1), je Seite drei nach unten gerichtete Zungen (breite Hauptzunge mit rundem Fuß hinter dem Arm + zwei schmalere),
  Farben der Quelle; die Flammenebene liegt HINTER der Figur, ihr Fuß lückenlos unter dem Arm; sie geht mit der Figur mit.
* Schweben: Figur samt Flammen ±1 px (Periode 32).
* Bass: die Membranen der Boxen „pumpen“ im Takt (Periode 8: die beiden Grautöne des Schachbretts tauschen für 3 Frames), das Visier glimmt im selben Takt eine Stufe dunkler
  ((238,0,0) → (178,11,0), nur innerhalb der Visierpixel).
* Noten: steigen langsam auf (5 px in 32 Frames, leichtes Pendeln), erscheinen/vergehen als Notenkopf; in Frame 0 am Ort der Vorlage.
Kein Metallglanz (die Figur ist klein und durch Feuer und Takt schon unruhig genug). Ergänzungen: keine (der Rumpf ist unter den Flammen vollständig, die Flammen lagen daneben).
"""
import math

import numpy as np
import cv2

import anim_lib as L
import anim_feuer3 as F3
import anim_n7 as N7

N, MS = 64, 65
sz = N7.Szene('techno-harpyformer', (5, 5, 9, 9))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ROT, ORANGE, GELB, KERN = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
feuer_m = sz.ist(ROT, ORANGE, GELB, KERN)
noten_m = sz.ist((193, 84, 77), (178, 11, 0), (99, 6, 0), (68, 97, 193), (111, 132, 207), (37, 54, 112), (186, 192, 43), (98, 100, 23), (69, 71, 16), (122, 205, 104), (172, 224, 162),
                 (71, 157, 52))
FIGUR = sz.teil(sz.da & ~feuer_m & ~noten_m)
MEMBRAN = sz.voll(sz.da & (yy >= 8) & (yy <= 12) & (((xx >= 5) & (xx <= 10)) | ((xx >= 18) & (xx <= 24))))
VISIER = sz.voll(sz.ist((238, 0, 0)))
J_, N_ = (97, 97, 99), (72, 72, 74)
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(noten_m.astype(np.uint8), connectivity=8)
NOTE = []
for k in range(1, _n):
    x, y, w, h, _a = _st[k]
    NOTE.append((int(x), int(y), np.where((_lab[y:y + h, x:x + w] == k)[..., None], spr[y:y + h, x:x + w], 0).astype(np.uint8)))
T0 = [0.2, 0.55, 0.8, 0.4]
X, Y = sz.PL, sz.PT


def zungen(cx, sp):
    s = -1 if sp else 1
    return [F3.Flamme(cx, Y + 18.5, 11, 4.2, richtung=(0, 1), phase=0.0 + 0.5 * sp, schlag=1.0),
            F3.Flamme(cx - 2.6 * s, Y + 20, 9.5, 2.1, richtung=(-0.12 * s, 1), phase=0.4 + 0.5 * sp),
            F3.Flamme(cx + 2.8 * s, Y + 20, 8.5, 2.1, richtung=(0.1 * s, 1), phase=0.75 + 0.5 * sp)]


FEUER = F3.Feuer(sz.H, sz.W, zungen(X + 5.0, False) + zungen(X + 24.5, True), [ROT, ORANGE, GELB, KERN], posen=16, halten=1)
TEST_EBENEN = ('figur',)


def pfad(t):
    return int(round(1.0 * math.sin(2 * math.pi * t))), -int(round(5 * t))


def frame(i, nur=None):
    bob = N7.sinus_px(i, 32, 1)
    fig = FIGUR
    if N7.stufe(i, 8, 4, 3):
        fig = N7.farbtausch(fig, MEMBRAN, {J_: N_, N_: J_})
        fig = N7.farbtausch(fig, VISIER, {(238, 0, 0): (178, 11, 0)})
    f = L.zusammen(sz.H, sz.W, [(FEUER.ebene(i), 0, bob), (fig, 0, bob)])
    if nur:
        return L.zusammen(sz.H, sz.W, [(fig, 0, bob)])
    for k, (nx, ny, bild) in enumerate(NOTE):
        t = (T0[k] + i / 32.0) % 1.0
        dx, dy = pfad(t); dx0, dy0 = pfad(T0[k])
        b = bild
        if t < 0.08 or t > 0.9:
            b = bild.copy(); b[:bild.shape[0] - 2] = 0
        L.einsetzen(f, b, X + nx + dx - dx0, Y + ny + dy - dy0)
    return f


if __name__ == '__main__':
    import sys
    N7.fertig('techno-harpyformer', 'Techno Harpyformer', frame, N, MS, spr, check=[0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28], zoom=8)
