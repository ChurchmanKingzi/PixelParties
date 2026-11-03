# -*- coding: utf-8 -*-
"""Idle-Animation für „Serpentous Demon“ (Creature, Archetyp Cycling Demons — Element: Schlangenleiber).

Quelle: src/serpentous-demon.png — Ebene „Ebene #128“ (17×31 px, 7 Farben) aus MotiveDeepsea.xcf (Ebene 151, Figur 1; Treffer 1.0). Die Kartenkunst (data/card-art/native/Serpentous_Demon.png) zeigt genau diese Figur.
PICK: [["MotiveDeepsea", 151, 1]]
Die Quelle war vollständig (ein Dämon; die Nachbarebene „Ebene #133“ ist der Hydrogen Demon in anderer Färbung und kein Beiwerk).

Aufruf:   python3 serpentous_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/serpentous-demon.png + .json

Was ist was (x/y im Sprite):
* Zwei lange, gekrümmte Schlangenleiber als „Ohren“ (links x 0–7, rechts x 9–16, y 0–9): blaue Röhren ((0,74,159)/(2,120,186)/(0,48,83)) mit dunklem Umriss (14,37,34), die oben in eine Schlaufe laufen
  (links Spitze (2–3,0), rechts (11–12,0)) und unten (y 8–10) in den Kopf münden.
* Kopf (x 5–12, y 9–16): fast schwarz (Umrissfarbe (14,37,34)) mit blauen Lichtkanten ((2,120,186) bei (7,10) (7,11) (12,11) (10,10)) und zwei hellteal Pixeln (94,182,192) bei (9–10,11) (Auge/Mundglanz — unklar, bleibt fest);
  darunter ein blauer Kragen (0,74,159)/(0,48,83) (6–12,13–16).
* Rumpf (x 5–12, y 17–29) in Teal (45,164,183)/(3,140,153) mit zwei Schlangenarmen: links (x 0–4, y 17–26) und rechts (x 13–16, y 17–24), dünne blaue Röhren mit hellerer Kante (2,120,186); zwei Füße (links x 5–8, rechts x 9–12, y 26–29).
Fest bleiben: Kopf/Gesicht, Beine/Füße.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* Schlangenwellen: beide Ohren und beide Arme wellen als echte Schlangenleiber — die Zeilen wandern seitlich, bis ±2 px an der Spitze, mit starkem Wellenlauf (die Welle läuft von der Wurzel zur Spitze, S-Kurve);
  Ohren und linker Arm wie bisher (anim_flieger.zeilen_pendel). Wurzeln (Ansatz am Kopf bzw. an der Schulter) stehen fest.
  RECHTER ARM (Nutzerkorrektur Runde 3: „zuckt sehr seltsam“): die frühere zeilen_pendel-Bewegung (Periode 16) ließ die unteren Zeilen auf einmal um bis zu 2 px springen. Jetzt anim_daemon.schlange_aussen: der Arm schwingt Periode 24 weich nach rechts aus und zurück, die Welle
  läuft Zeile für Zeile von der Schulter zur Spitze (Spitze bis +2 px, die Zeilen wechseln zeitversetzt, nie springen Nachbarzeilen um mehr als 1 px), 4-verbunden, Frame 0 = Ruhe.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 23 des Rumpfs wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Kopf samt Ohren und beide Arme steigen,
  Beine/Füße bleiben am Boden. Der Kopf folgt der Brust 2 Frames später (nie höher als die Brust).
* Füße wippen starr im Wechsel (rechter Frame 5–7 und 29–31, linker Frame 17–19 und 41–43): das Bein wird 1 px kürzer.
Keine Partikel, kein Glanz (Schlangenhaut, kein Metall — Regel 14), kein Feuer.
ERGÄNZUNG: keine gemalten Pixel nötig. Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 6, 4

spr = L.lade('serpentous-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (14, 37, 34)

ohr_l = vorhanden & (yy <= 8) & (xx <= 8)
ohr_r = vorhanden & (yy <= 8) & (xx >= 9)
kopf = vorhanden & (yy >= 9) & (yy <= 16) & ~ohr_l & ~ohr_r & (xx >= 4) & (xx <= 13)
arm_l = vorhanden & (yy >= 17) & (xx <= 3)
arm_r = vorhanden & (yy >= 17) & (xx >= 13)
rest = vorhanden & ~(ohr_l | ohr_r | kopf | arm_l | arm_r)
beine = rest & (yy >= 25)
rumpf = rest & (yy <= 24)
assert (ohr_l | ohr_r | kopf | arm_l | arm_r | beine | rumpf).sum() == vorhanden.sum()


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_OL, T_OR, T_KOPF, T_AL, T_AR, T_RUMPF = (teil(m) for m in (ohr_l, ohr_r, kopf, arm_l, arm_r, rumpf))
T_FUSS_L, T_FUSS_R = teil(beine & (xx <= 8)), teil(beine & (xx >= 9))


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    n_kopf = max(min(n, U.stufe(i - 2, 24, 2)), n - 1)
    ol = D.oben_pendel(T_OL, GPT + 9, 2.2, L.sinus(i, 24), potenz=1.0, lauf=3.2)
    orr = D.oben_pendel(T_OR, GPT + 9, 2.2, -L.sinus(i, 16), potenz=1.0, lauf=3.2)
    al = D.unten_pendel(T_AL, GPT + 17, 1.8, L.sinus(i, 24), potenz=1.0, lauf=2.6)
    ar = D.schlange_aussen(T_AR, GPT + 17, 1.9, i, 24, lauf=2.4, potenz=1.5)      # rechter Arm: gleichmäßige Wellenbewegung nach außen und zurück (kein Zucken)
    rp = L.streck_zeile(T_RUMPF, GPT + 23, n)
    bl = 1 if (i % 24) in (17, 18, 19) else 0
    br = 1 if (i % 24) in (5, 6, 7) else 0
    fl_ = L.heben_unten(T_FUSS_L, GPT + 27, bl) if bl else T_FUSS_L
    fr_ = L.heben_unten(T_FUSS_R, GPT + 27, br) if br else T_FUSS_R
    beine_ = L.zusammen(H, W, [(fl_, 0, 0), (fr_, 0, 0)])
    f = L.zusammen(H, W, [(beine_, 0, 0), (rp, 0, 0), (al, 0, -n), (ar, 0, -n), (T_KOPF, 0, -n_kopf), (ol, 0, -n_kopf), (orr, 0, -n_kopf)])
    return U.kontur_schliessen(f, UMRISS, KONTUR)


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh), rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('serpentous-demon', 'Serpentous Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/serpentous-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=10)
