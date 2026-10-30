# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Rottweiler“ (Creature).

Quelle: src/loyal-rottweiler.png — Ebene „Rottweiler“ (12×16 px, 12 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 176, 2]]

Aufruf:   python3 loyal_rottweiler.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-rottweiler.png + .json

Identifikation (Sprite 12×16, Hund von vorn, fast schwarz):
* Kopf (x 3–8, y 1–10): schwarzer Kopf (A/B/C), zwei bläulich-graue Augen als senkrechte 1×2-Pixel (links x 4, rechts x 7; oben I
  (66,61,83), unten J (50,47,68), je y 3–4), darüber zwei braune Fleckchen = Rottweiler-Augenbrauen (4,2) D und (7,2) F,
  Nase = (5,6) A / (6,6) L (fast schwarz), braune Wangen-/Schnauzenflecken (3–4, 6–7) und (7–8, 6–7), braunes Kinn (4–7, 8).
* Schlappohren (links x 0–2 / 3 oben, rechts x 9–11 / 8 oben, Zeilen 0–5): hängen an den oberen Kopfecken nach unten.
* Halsband (rot, U-förmig unter dem Kinn, Zeilen 8–10): dunkelrot links (2,8) (3,9) (4,10) G, Mitte (5–6,10) K, hell rosa rechts
  (9,8) (8,9) (7,10) H.
* Brust (Zeilen 11–12), zwei Vorderbeine (links x 2–4, rechts x 7–9; Zeilen 13–15) mit braunen Söckchen/Brustflecken (3–4, 13)
  D/E und (7–8, 13) D/F; schwarze Innenlinien (5–6, 13–14) zwischen den Beinen; Fußlinie Zeile 15.
* Kein Schwanz, keine Zunge und kein Hecheln im Sprite sichtbar — nichts davon erfunden.
Bleibt fest: Augenbrauen, Nase, Schnauze/Kinn, Halsband, Brust.

Ablauf (40 Frames à 80 ms = 3,2 s), alle Bewegungen unabhängig:
* Atmen (Periode 40, Frames 8–27 oben): Brustzeile 12 wird eingefügt — Kopf, Ohren, Halsband und Brust heben sich 1 px, die Füße
  bleiben am Boden.
* Schlappohren: das linke schwingt in Frames 4–11, das rechte in Frames 22–29 nach außen und zurück: erst nur die Spitzenzeile
  (Zeile 5), dann die Zeilen 3–5 gemeinsam je 1 px (so entsteht keine Beule an der verjüngten Spitze). Oben am Ansatz (Zeilen 0–2)
  bleiben sie am Kopf; die Lücke zum Kopf wird mit dem inneren Randpixel der Zeile geschlossen.
* Blick: die Augen wandern 1 px nach links (Frames 14–21) und 1 px nach rechts (Frames 32–36); beide Augen gemeinsam.
* Blinzeln (Frames 25–27): oberes Augenpixel verschwindet, dann beide Augen zu (Fellfarbe, unten dunkler Lidstrich), dann halb offen.
* Pfote tippt: die rechte Vorderpfote hebt sich zweimal um 1 px (Frames 12–13 und 16–17), die linke einmal (Frames 33–34) —
  die untere Beinzeile 14 entfällt, die Fußlinie rückt hoch.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 40, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-rottweiler')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (((xx <= 2) & (yy >= 2) & (yy <= 5)) | ((xx <= 3) & (yy <= 1)))
ohr_r = vorhanden & (((xx >= 9) & (yy >= 2) & (yy <= 5)) | ((xx >= 8) & (yy <= 1)))
pfote_r = vorhanden & (xx >= 7) & (xx <= 9) & (yy >= 14)
pfote_l = vorhanden & (xx >= 2) & (xx <= 4) & (yy >= 14)
koerper = vorhanden & ~ohr_l & ~ohr_r & ~pfote_r & ~pfote_l

AUGE_OBEN, AUGE_UNTEN = (66, 61, 83), (50, 47, 68)               # bläuliches Grau
KOPF, KOPF_DUNKEL = (36, 35, 40), (25, 23, 28)                   # Gesichtsfläche / dunklere Fläche
AUGEN_X = (4, 7)                                                 # Ruhelage der Augen (links, rechts)
BAUCHZEILE = 12                                                  # hier wird beim Atmen eine Zeile eingefügt


def px(x, y):
    return PAD_L + x, PAD_T + y


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                        # sofort auf die volle Leinwand


def ohr_profil(env, richtung):
    """Schlappohr schwingt nach außen: erst nur die Spitzenzeile (5), dann Zeilen 3–5 gemeinsam (keine Beule an der verjüngten Spitze)."""
    stufe = 0 if env < 0.2 else (1 if env < 0.5 else 3)
    return {PAD_T + y: richtung for y in range(6 - stufe, 6)} if stufe else {}


def zustand(i):
    atem = 1 if 8 <= i < 28 else 0
    ohr_li = T.huellkurve(i, N, 4, 8)
    ohr_re = T.huellkurve(i, N, 22, 8)
    blick = -1 if 14 <= i < 22 else (1 if 32 <= i < 37 else 0)
    lid = {25: 1, 26: 2, 27: 1}.get(i, 0)
    tipp_r = 1 if i in (12, 13, 16, 17) else 0
    tipp_l = 1 if i in (33, 34) else 0
    return atem, ohr_li, ohr_re, blick, lid, tipp_r, tipp_l


def frame(i, nur=None):
    atem, ohr_li, ohr_re, blick, lid, tipp_r, tipp_l = zustand(i)
    z = PAD_T + BAUCHZEILE
    k = teil(koerper)
    # Blick (Augen wandern 1 px) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    ex = [x + blick for x in AUGEN_X]
    if blick:
        for x0, x1 in zip(AUGEN_X, ex):
            k[PAD_T + 3, PAD_L + x0, :3] = KOPF
            k[PAD_T + 4, PAD_L + x0, :3] = KOPF
            k[PAD_T + 3, PAD_L + x1, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x1, :3] = AUGE_UNTEN
    if lid:
        for x in ex:
            k[PAD_T + 3, PAD_L + x, :3] = KOPF
            if lid == 2:
                k[PAD_T + 4, PAD_L + x, :3] = KOPF_DUNKEL
    k = L.streck_zeile(k, z, atem)
    ol = L.streck_zeile(T.ohr_haengend(teil(ohr_l), ohr_profil(ohr_li, -1), 'links'), z, atem)
    orr = L.streck_zeile(T.ohr_haengend(teil(ohr_r), ohr_profil(ohr_re, 1), 'rechts'), z, atem)
    pr = L.heben_unten(teil(pfote_r), PAD_T + 14, tipp_r)
    pl = L.heben_unten(teil(pfote_l), PAD_T + 14, tipp_l)
    ebenen = {'koerper': k, 'ohr_l': ol, 'ohr_r': orr, 'pfote_r': pr, 'pfote_l': pl}
    wahl = nur or ('koerper', 'pfote_l', 'pfote_r', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-rottweiler', 'Loyal Rottweiler', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-rottweiler-strip.png', frames, spalten=10, scale=8)
