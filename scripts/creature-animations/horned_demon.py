# -*- coding: utf-8 -*-
"""Idle-Animation für „Horned Demon“ (Creature) — Fassung 2 (lebendiger, Hörner starr, Glanz, mehr Glut).

Quelle: src/horned-demon.png — Ebene „Horned Demon“ (16×29 px, 23 Farben) aus Motive.xcf.
PICK: [["Motive", 591, 1]]   (die drei Ebenen „Ebene #476“ Figur 1–3 sind pixelgleich)

Aufruf:   python3 horned_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/horned-demon.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Hörner: zwei nach innen gebogene Hörner, Kern 1 px breit (Knochenbraun G, Glanzpunkte H), Umriss D; links x 2–6 / y 0–6, rechts gespiegelt.
  Sie bleiben STARR am Kopf (steigen nur mit Kopf/Atem mit, nie seitwärts).
* Kopf: Stirn (R-Glanz bei 7,7/8,7), Gesicht A/C, Rand E; Augen = schräge Schlitze, je Auge Rand-/Brauenpixel (I) und
  leuchtendes Pfirsich (J): links I(5,9) J(5,10) I(6,10) J(6,11), rechts I(10,9) J(10,10) I(9,10) J(9,11).
  Nasenlöcher K (6,13/14 und 9,13/14) und die Mundlücke S (7,15/8,15) bleiben fest. Die weißen Hauer L (6,15/16 und 9,15/16) sitzen am Kiefer.
* Seitenlappen (Ohren): links x 1–3 / y 7–10, rechts x 12–14 / y 7–10 (dunkelrotbraun, B-Umriss).
* Rumpf: Schultern y 17–19, Bauch y 20–25, Beine y 24–25, Stiefel (grau/schwarz) y 26–28; Stiefelglanz V bei (6,26) und (11,26).
* Arme: stummelige Arme x 1–2 bzw. 13–14, y 20–23, mit goldenem Armreif (T/U) in y 21; Innenumriss x 3 bzw. 12 gehört zum Rumpf.
Fest bleiben: Nasenlöcher, Mundlücke, Hauer (am Kiefer), Beine, Rumpffarben, Hörner (starr).

Ablauf (36 Frames à 65 ms = 2,34 s; Frame 0 = Original, die Partikel ausgenommen):
* Atmen zweistufig (Periode 36): Bauchzeile (y 22) im Rumpf-Layer 0 → 1 → 2 → 1 → 0 mal eingefügt — die Brust (Schultern, Arme) steigt zuerst,
  der Kopf samt Hörnern folgt 2 Frames später und nie höher als die Brust (er „sinkt“ höchstens 1 px in die Schultern, nie entsteht ein Hals-Spalt).
  Dazu drei kurze Hüpfer des Oberkörpers (Frame 2/3, 9/10, 27/28, 34): +1 px, bis höchstens 2 px. Beine/Stiefel bleiben stehen.
* Ohren zucken öfter: links Doppelzucken Frame 4 und 22, rechts Frame 13 und 31 (Lappen y 7–9 klappt 1 px nach außen, Innenumriss geht mit).
* Augen glühen schneller (Periode 12: Pfirsich → H → I → zurück), Blinzeln Frame 30–32; Glanz: Lichtblitz (L) und vierzackiger
  Glitzerstern (Mitte L, Arme J) am linken Auge Frame 18–20, am rechten Frame 24–26 — der Stern bleibt am Auge.
* Arme schwingen ruhig nach außen (nur noch bis 1 px, Spaltenversatz wächst von der Schulter zur Hand): beide Seiten synchron und gespiegelt,
  zweimal pro Schleife (Periode 24); Innenumriss geht als Kopie mit.
* Gold glänzt: Lichtband über jeden Armreif (links Frame 6–7, rechts Frame 22–23: das helle Pixel wandert von außen nach innen,
  Farben T/U/J aus dem Sprite) und Glitzerstern am Armreif (links Frame 12–14, rechts Frame 30–32, folgt dem Arm).
* Stiefelglanz: ein helles Pixel (V) wandert diagonal über jeden Stiefel (links Frame 14–19, rechts 28–33).
* Partikel (hinter der Figur, 11 Stück, Lebensdauer 36 Frames, langsam aufsteigend, leichtes Wabern): 7 Glutfunken (Formen k, o; Kern Pfirsich J,
  Rand Gold U) über Hörnern, Schultern und seitlich vom Körper, 4 kleine Rauchwölkchen (Form m; Kern H, Rand I) über Hörnern und Schultern.
  Alle Farben aus dem Sprite.
ERGÄNZUNG (1 Pixel je Seite): Deckelpixel (2,7) links und (13,7) rechts in Umrissfarbe B (31,9,1) — verhindert beim Ohrzucken ein
1-px-Loch zwischen Ohrumriss und Hornansatz (im Ruhebild liegt dort schon B, Frame 0 bleibt identisch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 36, 65
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 22, 4

spr = L.lade('horned-demon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Teile (Masken im Sprite-Koordinatensystem) ────────────────────────────────────────────────────────────────
ohr_l_kern = vorhanden & (yy >= 7) & (yy <= 9) & (xx <= 2)             # Lappen ohne Innenumriss
ohr_r_kern = vorhanden & (yy >= 7) & (yy <= 9) & (xx >= 13)
ohr_l_kopie = ohr_l_kern | (vorhanden & (yy >= 8) & (yy <= 9) & (xx == 3))   # + Innenumriss (bleibt zusätzlich am Kopf stehen)
ohr_r_kopie = ohr_r_kern | (vorhanden & (yy >= 8) & (yy <= 9) & (xx == 12))
arm_l = vorhanden & (yy >= 20) & (yy <= 23) & (xx <= 3)                 # inkl. Innenumriss x 3 (Kopie, bleibt auch am Rumpf)
arm_r = vorhanden & (yy >= 20) & (yy <= 23) & (xx >= 12)
arm_l_kern = arm_l & (xx <= 2)
arm_r_kern = arm_r & (xx >= 13)
unten = vorhanden & (yy >= 24)                                           # Beine + Stiefel: fest
hauer_unten = np.zeros_like(vorhanden); hauer_unten[16, 6] = hauer_unten[16, 9] = True   # untere Hauerpixel gehören zum Kopf
kopf_teil = (vorhanden & (yy <= 15) & ~ohr_l_kern & ~ohr_r_kern) | (vorhanden & hauer_unten)   # Kopf samt starren Hörnern + Hauerspitzen
rumpf = vorhanden & (yy >= 16) & (yy <= 23) & ~arm_l_kern & ~arm_r_kern & ~hauer_unten

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────
c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
AUGE_HELL_FARBE = c(5, 10)           # J (244,190,144)
AUGE_RAND_FARBE = c(5, 9)            # I (138,84,48)
STUFE1 = c(4, 1)                     # H (157,112,91)
STUFE2 = AUGE_RAND_FARBE             # I (138,84,48)
LID = c(7, 8)                        # A (83,35,23)  Gesichtsfarbe
LID_DUNKEL = c(4, 9)                 # E (38,14,12)  geschlossenes Lid = dunkler Strich
GOLD_DUNKEL, GOLD_HELL = c(1, 21), c(2, 21)     # T (115,67,19), U (177,122,42)
PFIRSICH = c(5, 10)                  # J
GLANZ = c(6, 15)                     # L (229,205,203) — hellste Farbe des Sprites (Hauer), Mitte der Glitzersterne
STIEFEL_GLANZ = c(6, 26)             # V (98,99,101)
OHR_UMRISS = c(1, 7)                 # B (31,9,1)
OHR_ERG = [(2, 7), (13, 7)]          # ERGÄNZUNG: Deckelpixel zwischen Ohrumriss und Hornansatz (sonst 1-px-Loch beim Ohrzucken)

AUGEN = [
    dict(hell=[(5, 10), (6, 11)], rand=[(5, 9), (6, 10)]),
    dict(hell=[(10, 10), (9, 11)], rand=[(10, 9), (9, 10)]),
]
AUGEN_FARBEN = dict(glut=[STUFE1, STUFE2], lid=LID, lid_dunkel=LID_DUNKEL)


def cv(gruppen):                      # Sprite- → Leinwandkoordinaten
    return [dict(hell=[(PAD_L + x, PAD_T + y) for x, y in g['hell']], rand=[(PAD_L + x, PAD_T + y) for x, y in g['rand']]) for g in gruppen]


AUGEN_C = cv(AUGEN)

GLUT = {'c': PFIRSICH, 'r': GOLD_HELL}          # Glutfunken: Kern Pfirsich, Rand Gold
RAUCH = {'c': c(4, 1), 'r': c(5, 9)}            # Rauch: Kern H (157,112,91), Rand I (138,84,48)
# Startpunkte in Sprite-Koordinaten (x, y); vx/vy = Weg über eine Lebensdauer (vy < 0 = aufwärts)
P = lambda x, y: (PAD_L + x, PAD_T + y)
GLUT_PUFFS = [
    dict(x=P(4, -3)[0], y=P(4, -3)[1], vx=-1, vy=-13, off=0, form='o', wackeln=1),       # über der linken Hornspitze
    dict(x=P(11, -3)[0], y=P(11, -3)[1], vx=1, vy=-14, off=18, form='k', wackeln=1),     # über der rechten Hornspitze
    dict(x=P(0, 16)[0], y=P(0, 16)[1], vx=-3, vy=-12, off=7, form='k', wackeln=1),       # von der linken Schulter
    dict(x=P(15, 16)[0], y=P(15, 16)[1], vx=3, vy=-12, off=25, form='o', wackeln=1),     # von der rechten Schulter
    dict(x=P(-1, 25)[0], y=P(-1, 25)[1], vx=-2, vy=-14, off=12, form='k', wackeln=1),    # seitlich vom Körper links
    dict(x=P(16, 25)[0], y=P(16, 25)[1], vx=2, vy=-14, off=30, form='k', wackeln=1),     # seitlich rechts
    dict(x=P(8, -4)[0], y=P(8, -4)[1], vx=0, vy=-12, off=9, form='k', wackeln=1),        # zwischen den Hörnern
]
RAUCH_PUFFS = [
    dict(x=P(3, -2)[0], y=P(3, -2)[1], vx=-2, vy=-12, off=5, form='m', wackeln=1),       # Rauch über der linken Hornspitze
    dict(x=P(12, -2)[0], y=P(12, -2)[1], vx=2, vy=-12, off=23, form='m', wackeln=1),
    dict(x=P(0, 17)[0], y=P(0, 17)[1], vx=-3, vy=-9, off=14, form='m', wackeln=1),       # Rauch von der Schulter
    dict(x=P(15, 17)[0], y=P(15, 17)[1], vx=3, vy=-9, off=32, form='m', wackeln=1),
]

GLOW12 = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0]       # Augenglühen (Periode 12), 0 = Original
HOPS = {2, 3, 9, 10, 27, 28, 34}                      # kurze Hüpfer des Oberkörpers (+1 px)
STIEFEL_PFAD = [(4, 27), (5, 27), (5, 26)]            # Glanzpixel wandert diagonal über den linken Stiefel (rechts: x + 5)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def brust(i):
    """Brusthöhe 0…2 (zweistufig: 0-1-2-1-0 über die Schleife) + Hüpfer, höchstens 2."""
    t = (i % N) / N
    basis = int(round(2 * (1 - abs(2 * t - 1))))
    return min(2, basis + (1 if i in HOPS else 0)), basis


def frame(i):
    # --- Atmen: Brust zuerst, Kopf hinterher (nie höher als die Brust, höchstens 1 px tiefer) ---
    r_b, _ = brust(i)
    _, basis_spaet = brust((i - 2) % N)
    r_k = max(min(r_b, basis_spaet), r_b - 1)
    # --- Zeitpläne ---
    ohr_l = max(U.puls(i, 4, [1, 1, 0, 1, 1, 0]), U.puls(i, 22, [1, 1, 0, 1, 1, 0]))
    ohr_r = max(U.puls(i, 13, [1, 1, 0, 1, 1, 0]), U.puls(i, 31, [1, 1, 0, 1, 1, 0]))
    glut_stufe = GLOW12[i % 12]
    blink = {30: 1, 31: 2, 32: 1}.get(i, 0)
    arm_l_aus = -1.0 * U.buckel(i, 0, 24, n=24)                  # nach links (außen), 0 … −1 px, zweimal pro Schleife
    arm_r_aus = 1.0 * U.buckel(i, 0, 24, n=24)                   # synchron und gespiegelt (Frame 0 = Ruhe)
    reif_l = {6: (PFIRSICH, GOLD_HELL), 7: (GOLD_HELL, PFIRSICH)}.get(i)     # (außen, innen): Lichtband
    reif_r = {22: (PFIRSICH, GOLD_HELL), 23: (GOLD_HELL, PFIRSICH)}.get(i)

    # --- Kopf (Hörner starr, Ohren, Gesicht) ---
    kopf = teil(kopf_teil)
    kopf = U.augen(kopf, AUGEN_C, glut_stufe if not blink else 0, blink, AUGEN_FARBEN)
    # Augenblitz (Lichtband): Auge hellt kurz auf; Stern siehe unten
    blitz_l = {18: 1, 19: 2, 20: 1}.get(i, 0)
    blitz_r = {24: 1, 25: 2, 26: 1}.get(i, 0)
    for g, b in ((AUGEN_C[0], blitz_l), (AUGEN_C[1], blitz_r)):
        if b:
            U.pixel_setzen(kopf, g['hell'], GLANZ)
    o_l = L.versetze(teil(ohr_l_kopie), -ohr_l, 0)
    o_r = L.versetze(teil(ohr_r_kopie), ohr_r, 0)
    for (o, (ex, ey)) in ((o_l, OHR_ERG[0]), (o_r, OHR_ERG[1])):
        o[PAD_T + ey, PAD_L + ex] = [*OHR_UMRISS, 255]
    kopf_ges = L.zusammen(H, W, [(kopf, 0, 0), (o_l, 0, 0), (o_r, 0, 0)])

    # --- Rumpf, Arme, Beine ---
    rp = L.streck_zeile(teil(rumpf), PAD_T + 22, r_b)
    al = U.haengen(teil(arm_l), PAD_T + 19, arm_l_aus)
    ar = U.haengen(teil(arm_r), PAD_T + 19, arm_r_aus)
    if reif_l:
        al = _reif(al, reif_l)
    if reif_r:
        ar = _reif(ar, reif_r)
    bo = teil(unten)
    for (px, p0, p1) in ((0, 14, 19), (5, 28, 33)):                # Stiefelglanz links / rechts
        if p0 <= i <= p1:
            k = min(len(STIEFEL_PFAD) - 1, (i - p0) // 2)
            x, y = STIEFEL_PFAD[k]
            bo[PAD_T + y, PAD_L + x + px, :3] = STIEFEL_GLANZ
    glut = U.glut_ebene(H, W, i, N, GLUT_PUFFS, GLUT)
    rauch = U.glut_ebene(H, W, i, N, RAUCH_PUFFS, RAUCH)

    # --- Glitzersterne (nach der Figur gelegt; sie bleiben an Auge bzw. Armreif) ---
    sterne = L.leer(H, W)
    st_aug_l = {18: 1, 19: 2, 20: 1}.get(i, 0)
    st_aug_r = {24: 1, 25: 2, 26: 1}.get(i, 0)
    for (st, ex, ey) in ((st_aug_l, 5, 10), (st_aug_r, 10, 10)):
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + ex, PAD_T + ey - r_k, st, GLANZ, PFIRSICH))
    sr_l = {12: 1, 13: 2, 14: 1}.get(i, 0)
    sr_r = {30: 1, 31: 2, 32: 1}.get(i, 0)
    for (st, bx, aus) in ((sr_l, 2, arm_l_aus), (sr_r, 13, arm_r_aus)):
        if st:
            dx = int(round(aus * 0.5))
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + bx + dx, PAD_T + 21 - r_b, st, GLANZ, PFIRSICH))

    return L.zusammen(H, W, [(rauch, 0, 0), (glut, 0, 0), (bo, 0, 0), (rp, 0, 0), (al, 0, -r_b), (ar, 0, -r_b), (kopf_ges, 0, -r_k), (sterne, 0, 0)])


def _reif(arm, farben):
    """Armreif einfärben: (außen, innen) — sucht die Reifpixel im (schon verschobenen) Armlayer an ihrer Farbe T/U."""
    t = np.array(GOLD_DUNKEL); u = np.array(GOLD_HELL)
    m_t = (arm[..., :3] == t).all(axis=2) & (arm[..., 3] > 0)
    m_u = (arm[..., :3] == u).all(axis=2) & (arm[..., 3] > 0)
    # T ist der äußere, U der innere Reifpixel (links: x 1 / x 2; rechts: x 14 / x 13)
    arm[m_t, :3] = farben[0]
    arm[m_u, :3] = farben[1]
    return arm


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('horned-demon', 'Horned Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/horned-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30)], spalten=3, scale=8)
