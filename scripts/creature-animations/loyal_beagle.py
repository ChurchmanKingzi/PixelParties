# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Beagle“ (Creature).

Quelle: src/loyal-beagle.png — Ebene „Beagle“ (14×13 px, 11 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 184, 2]]

Aufruf:   python3 loyal_beagle.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-beagle.png + .json

Identifikation (Sprite 14×13, Hund von vorn, dunkel):
* Kopf (x 3–10, y 1–6): dunkle Stirn (E/B), zwei BLAUE Augen als senkrechte 1×2-Pixel (links x 5, rechts x 8; oben I (16,65,156),
  unten J (0,8,74), je y 3–4) mit grauen Fellflecken F/H daneben, Nase = zwei fast schwarze Pixel (6–7, 6) K, graue Schnauze (C/F).
* Schlappohren (links x 0–2, rechts x 11–13, Zeilen 1–4): hängen an den Kopfseiten nach unten, die Spitzen (Zeile 4) hängen frei.
* Hals/Kinn (Zeilen 7–9, x 4–9): schwarzes Maul-/Kinnband (6–7, 8) A, darunter hellgrauer Fleck (6–7, 9) G.
* Hellgraue U-förmige Linie (4,7) (5,8) (6–7,9) (8,8) (9,7) G unter dem Kinn: Halsband (gleiche U-Form wie beim Rottweiler, nur silbergrau).
* Brust (Zeilen 10–11) und zwei Vorderbeine (links x 3–5, rechts x 8–10); Füße = Zeile 12 (D) — kein Schwanz, keine Zunge sichtbar
  (nichts davon erfunden).
Bleibt fest: Nase, Schnauze, Kinn, Halsband, Brust, Beine.

Ablauf (36 Frames à 90 ms = 3,24 s), alle Bewegungen unabhängig (andere Perioden/Reihenfolge als beim Rottweiler):
* Atmen (Periode 36, Frames 4–21 oben): die Brustzeile 11 wird eingefügt; Kopf, Ohren und Halsband heben sich 1 px, die Füße bleiben.
* Kopf neigt sich (kleiner Kopfwackler): Frames 8–15 nach rechts, Frames 26–31 nach links. Die Zeilen 0–4 (Stirn, Augen, Ohren) wandern
  als Block 1 px seitlich, Schnauze/Kinn/Halsband bleiben stehen — die Naht liegt zwischen Zeile 4 und 5 (Zeile 5 ist 8 px breit
  und überlappt Zeile 4 vollständig, also 4-verbunden).
* Blick: die Augen schauen mit der Neigung mit (Frames 9–15 rechts, Frames 27–31 links), 1 px.
* Schlappohren: das linke schwingt in Frames 11–17, das rechte in Frames 29–35 nach außen und zurück (erst Zeile 4, dann Zeilen 3–4
  1 px, oben bleiben sie am Kopf; Lücke zum Kopf mit dem Randpixel des Ohres geschlossen).
* Blinzeln (Frames 20–22): oberes Augenpixel schließt sich, dann beide Augen zu (beide Augenpixel werden Fellfarbe), dann wieder halb offen.
* Pfote tippt: der linke Fuß hebt sich in Frames 1–2 und 5–6 um 1 px (die Beinzeile 11 des Fußes entfällt), der rechte in 31–32.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 36, 90
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 4, 3

spr = L.lade('loyal-beagle')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 2) & (yy >= 1) & (yy <= 4)
ohr_r = vorhanden & (xx >= 11) & (yy >= 1) & (yy <= 4)
kopf_o = vorhanden & (yy <= 4) & ~ohr_l & ~ohr_r                # Stirn/Augen/Wangen (Zeilen 0–4)
unten = vorhanden & (yy >= 5)                                    # Schnauze, Kinn, Halsband, Brust, Beine

AUGE_OBEN, AUGE_UNTEN = (16, 65, 156), (0, 8, 74)                # blau
FELL_F, FELL_H = (97, 95, 96), (78, 67, 61)
BRUSTZEILE = 11


def pz(x, y):
    return PAD_L + x, PAD_T + y


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                        # sofort auf die volle Leinwand


# Augen: Ruhelage x = 5 (links), 8 (rechts); beim Blick wandert das Paar um 1 px, die frei werdende Stelle bekommt die Farbe des
# Fellnachbarn auf der Seite, von der das Auge weggeht (keine neue Farbe).
FELL_NEBEN = {  # (x, y) → Farbe der Stelle, wenn dort kein Auge sitzt
    (5, 3): FELL_H, (5, 4): FELL_H, (8, 3): FELL_F, (8, 4): FELL_H,
}
FELL_RECHTS = {(5, 3): FELL_F, (5, 4): FELL_F, (8, 3): FELL_F, (8, 4): FELL_H}


def augen(k, blick, lid):
    """Blick: -1 links, 0 mittig, +1 rechts. lid: 0 offen, 1 halb, 2 zu."""
    if blick:
        neben = FELL_NEBEN if blick < 0 else FELL_RECHTS
        for x0 in (5, 8):
            for y in (3, 4):
                k[PAD_T + y, PAD_L + x0, :3] = neben[(x0, y)]
            x1 = x0 + blick
            k[PAD_T + 3, PAD_L + x1, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x1, :3] = AUGE_UNTEN
    if lid:
        for x0 in (5, 8):
            x1 = x0 + blick
            k[PAD_T + 3, PAD_L + x1, :3] = FELL_H if x0 == 5 else FELL_F
            if lid == 2:                                     # zu: beide Augenpixel werden Fell (kein schwarzer Punkt, der wie Pupille wirkt)
                k[PAD_T + 4, PAD_L + x1, :3] = FELL_H
    return k


def ohr_profil(env, richtung):
    """Schlappohr schwingt nach außen: erst nur die freie Spitze (Zeile 4), dann Zeilen 3–4 gemeinsam."""
    stufe = 0 if env < 0.2 else (1 if env < 0.5 else 2)
    return {PAD_T + y: richtung for y in range(5 - stufe, 5)} if stufe else {}


def zustand(i):
    atem = 1 if 4 <= i < 22 else 0
    neigung = 1 if 8 <= i < 16 else (-1 if 26 <= i < 32 else 0)
    blick = 1 if 9 <= i < 16 else (-1 if 27 <= i < 32 else 0)
    ohr_li = T.huellkurve(i, N, 11, 7)
    ohr_re = T.huellkurve(i, N, 29, 7)
    lid = {20: 1, 21: 2, 22: 1}.get(i, 0)
    tipp_l = 1 if i in (1, 2, 5, 6) else 0
    tipp_r = 1 if i in (31, 32) else 0
    return atem, neigung, blick, ohr_li, ohr_re, lid, tipp_l, tipp_r


def frame(i, nur=None):
    atem, neigung, blick, ohr_li, ohr_re, lid, tipp_l, tipp_r = zustand(i)
    # Kopf oben (Zeilen 0–4) und Ohren: Augen/Lider, Neigung, Atem-Hub
    ko = augen(teil(kopf_o), blick, lid)
    ko = L.versetze(ko, neigung, -atem)
    ol = L.versetze(T.ohr_haengend(teil(ohr_l), ohr_profil(ohr_li, -1), 'links'), neigung, -atem)
    orr = L.versetze(T.ohr_haengend(teil(ohr_r), ohr_profil(ohr_re, 1), 'rechts'), neigung, -atem)
    # Rumpf: Brustzeile 11 einfügen, danach die Füße (Zeilen ≥ 11 an den Beinen) einzeln heben
    r = L.streck_zeile(teil(unten), PAD_T + BRUSTZEILE, atem)
    fuss = (np.arange(H)[:, None] >= PAD_T + BRUSTZEILE) & ((np.arange(W)[None, :] <= PAD_L + 5) | (np.arange(W)[None, :] >= PAD_L + 8))
    fl, rest = L.trenne(r, fuss & (np.arange(W)[None, :] <= PAD_L + 5))
    fr_, rest = L.trenne(rest, fuss & (np.arange(W)[None, :] >= PAD_L + 8))
    fl = L.heben_unten(fl, PAD_T + BRUSTZEILE, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + BRUSTZEILE, tipp_r)
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'kopf': ko, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'kopf', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-beagle', 'Loyal Beagle', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-beagle-strip.png', frames, spalten=9, scale=8)
