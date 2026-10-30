# -*- coding: utf-8 -*-
"""Idle-Animation für „Horned Demon“ (Creature).

Quelle: src/horned-demon.png — Ebene „Horned Demon“ (16×29 px, 23 Farben) aus Motive.xcf.
PICK: [["Motive", 591, 1]]   (die drei Ebenen „Ebene #476“ Figur 1–3 sind pixelgleich)

Aufruf:   python3 horned_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/horned-demon.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Hörner: zwei nach innen gebogene Hörner, Kern 1 px breit (Knochenbraun G, Glanzpunkte H), Umriss D; links x 2–6 / y 0–6, rechts gespiegelt.
* Kopf: Stirn (R-Glanz bei 7,7/8,7), Gesicht A/C, Rand E; Augen = schräge Schlitze, je Auge Rand-/Brauenpixel (I) und
  leuchtendes Pfirsich (J): links I(5,9) J(5,10) I(6,10) J(6,11), rechts I(10,9) J(10,10) I(9,10) J(9,11).
  Nasenlöcher K (6,13/14 und 9,13/14) und die Mundlücke S (7,15/8,15) bleiben fest. Die weißen Hauer L (6,15/16 und 9,15/16) sitzen am Kiefer.
* Seitenlappen (Ohren): links x 1–3 / y 7–10, rechts x 12–14 / y 7–10 (dunkelrotbraun, B-Umriss).
* Rumpf: Schultern y 17–19, Bauch y 20–25, Beine y 24–25, Stiefel (grau/schwarz) y 26–28.
* Arme: stummelige Arme x 1–2 bzw. 13–14, y 20–23, mit goldenem Armreif (T/U) in y 21; Innenumriss x 3 bzw. 12 gehört zum Rumpf.
Fest bleiben: Nasenlöcher, Mundlücke, Hauer (am Kopf), Stiefel, Beine, Rumpffarben.

Ablauf (48 Frames à 70 ms = 3,36 s):
* Atmen (Periode 48): im Rumpf wird eine Bauchzeile (y 22) bis zu zweimal eingefügt — Brust, Kopf, Hörner, Schultern und Arme steigen bis
  zu 2 px, Beine/Stiefel bleiben stehen. Nur der Rumpf-Layer wird gestreckt (Arme/Kopf werden mitgehoben, nicht gedoppelt).
* Kopf reckt sich (Periode 24, versetzt): im Gesicht wird eine Zeile (y 12) bis zu einmal eingefügt — Stirn, Augen, Ohren, Hörner
  heben sich um 1 px gegenüber Kiefer/Hauern (die bleiben am Rumpf).
* Hörnerspitzen wiegen (Periode 16): die oberen Hornzeilen (y 0–3) neigen sich um ±1 px (Scherung um y 6), beide Hörner gleichgerichtet.
* Ohrenzucken: linkes Ohr Doppelzucken Frame 10–15, rechtes Frame 33–38 (Ohr klappt 1 px nach außen; Innenumriss wandert mit).
* Augenglühen (Periode 24): Pfirsich → Braunstufe der Augenrampe (H, I) und zurück; Blinzeln Frame 42–44 (zwei Stufen).
* Arme schwingen nach außen (Periode 48, links/rechts versetzt): Zeilenversatz wächst von der Schulter (y 19) zur Hand (bis 2 px).
* Armreife glänzen: dunkles und helles Gold tauschen kurz die Plätze (links Frame 6–9, rechts Frame 28–31).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 6, 4

spr = L.lade('horned-demon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Teile (Masken im Sprite-Koordinatensystem) ────────────────────────────────────────────────────────────────
horn_l = vorhanden & (yy <= 6) & (xx <= 5)
horn_r = vorhanden & (yy <= 6) & (xx >= 10)
horn = horn_l | horn_r
ohr_l_kern = vorhanden & (yy >= 7) & (yy <= 9) & (xx <= 2)             # Lappen ohne Innenumriss
ohr_r_kern = vorhanden & (yy >= 7) & (yy <= 9) & (xx >= 13)
ohr_l_kopie = ohr_l_kern | (vorhanden & (yy >= 8) & (yy <= 9) & (xx == 3))   # + Innenumriss (bleibt zusätzlich am Kopf stehen)
ohr_r_kopie = ohr_r_kern | (vorhanden & (yy >= 8) & (yy <= 9) & (xx == 12))
arm_l = vorhanden & (yy >= 20) & (yy <= 23) & (xx <= 3)                 # inkl. Innenumriss x 3 (Kopie, bleibt auch am Rumpf)
arm_r = vorhanden & (yy >= 20) & (yy <= 23) & (xx >= 12)
arm_l_kern = arm_l & (xx <= 2)
arm_r_kern = arm_r & (xx >= 13)
unten = vorhanden & (yy >= 24)                                           # Beine + Stiefel: fest
kopf_teil = vorhanden & (yy <= 15) & ~horn & ~ohr_l_kern & ~ohr_r_kern   # Kopf ohne Hörner/Ohrenlappen
rumpf = vorhanden & (yy >= 16) & (yy <= 23) & ~arm_l_kern & ~arm_r_kern  # Schultern + Bauch (+ Hauerspitzen y 16)

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────
c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
AUGE_HELL_FARBE = c(5, 10)           # J (244,190,144)
AUGE_RAND_FARBE = c(5, 9)            # I (138,84,48)
STUFE1 = c(4, 1)                     # H (157,112,91)   – Hornglanz, nächste Stufe der Pfirsich-Rampe
STUFE2 = AUGE_RAND_FARBE             # I (138,84,48)
LID = c(7, 8)                        # A (83,35,23)  Gesichtsfarbe
LID_DUNKEL = c(5, 11)                # C (64,22,10)
GOLD_DUNKEL, GOLD_HELL = c(1, 21), c(2, 21)

AUGEN = [
    dict(hell=[(5, 10), (6, 11)], rand=[(5, 9), (6, 10)]),
    dict(hell=[(10, 10), (9, 11)], rand=[(10, 9), (9, 10)]),
]
AUGEN_FARBEN = dict(glut=[STUFE1, STUFE2], lid=LID, lid_dunkel=LID_DUNKEL)


def cv(gruppen):                      # Sprite- → Leinwandkoordinaten
    return [dict(hell=[(PAD_L + x, PAD_T + y) for x, y in g['hell']], rand=[(PAD_L + x, PAD_T + y) for x, y in g['rand']]) for g in gruppen]


AUGEN_C = cv(AUGEN)


def teil(maske, extra=None):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def frame(i):
    # --- Parameter dieses Frames ---
    atem = U.stufe(i, N, 2)                                     # 0 … 2 zusätzliche Bauchzeilen
    recken = U.stufe(i, N / 2, 1, versatz=1.0)                  # 0 … 1 zusätzliche Gesichtszeile
    if i == 0:
        recken = 0
    horn_pend = math.sin(L.sinus(i, N / 3))                      # −1 … 1
    ohr_l = U.puls(i, 10, [1, 1, 0, 1, 1, 0])
    ohr_r = U.puls(i, 33, [1, 1, 0, 1, 1, 0])
    glut = U.stufe(i, N / 2, 2)
    blink = {42: 1, 43: 2, 44: 1}.get(i, 0)
    arm_l_aus = -2.0 * U.buckel(i, 2, 26)                      # nach links (außen), 0 … −2 px
    arm_r_aus = 2.0 * U.buckel(i, 22, 26)
    reif_l = U.puls(i, 6, [1, 0, 1, 0])
    reif_r = U.puls(i, 28, [1, 0, 1, 0])

    # --- Kopf (Hörner, Ohren, Gesicht) auf der vollen Leinwand ---
    kopf = teil(kopf_teil)
    kopf = U.augen(kopf, AUGEN_C, glut if not blink else 0, blink, AUGEN_FARBEN)
    h = U.haengen(teil(horn), PAD_T + 6, 1.0 * horn_pend, nach_unten=False)          # Hornspitzen y 0–5 (oberhalb des Pivots y 6)
    o_l = L.versetze(teil(ohr_l_kopie), -ohr_l, 0)
    o_r = L.versetze(teil(ohr_r_kopie), ohr_r, 0)
    kopf_ges = L.zusammen(H, W, [(kopf, 0, 0), (h, 0, 0), (o_l, 0, 0), (o_r, 0, 0)])
    kopf_ges = L.streck_zeile(kopf_ges, PAD_T + 12, recken)

    # --- Rumpf, Arme, Beine ---
    rp = L.streck_zeile(teil(rumpf), PAD_T + 22, atem)
    al = U.haengen(teil(arm_l), PAD_T + 19, arm_l_aus)
    ar = U.haengen(teil(arm_r), PAD_T + 19, arm_r_aus)
    if reif_l:
        al = L.tausche(al, {GOLD_DUNKEL: GOLD_HELL, GOLD_HELL: GOLD_DUNKEL})
    if reif_r:
        ar = L.tausche(ar, {GOLD_DUNKEL: GOLD_HELL, GOLD_HELL: GOLD_DUNKEL})
    bo = teil(unten)
    return L.zusammen(H, W, [(bo, 0, 0), (rp, 0, 0), (al, 0, -atem), (ar, 0, -atem), (kopf_ges, 0, -atem)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('horned-demon', 'Horned Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/horned-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 43)], spalten=4, scale=8)
