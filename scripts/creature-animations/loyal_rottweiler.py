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

Ablauf (48 Frames à 70 ms = 3,36 s), alle Bewegungen unabhängig und öfter als in Version 1:
* Atmen (Periode 24, 2× pro Schleife; oben in Frames 4–15 und 28–39): Brustzeile 12 wird eingefügt — Kopf, Ohren, Halsband und Brust
  heben sich 1 px, die Füße bleiben am Boden.
* Schlappohren: links in Frames 3, 19, 35, rechts in Frames 11, 27, 40 (je 7 Frames) nach außen und zurück: erst nur die Spitzenzeile
  (Zeile 5), dann Zeilen 3–5 gemeinsam je 1 px; oben bleiben sie am Kopf, die Lücke zum Kopf wird mit dem Randpixel geschlossen.
* Blick: die Augen schauen 1 px nach links (Frames 14–21) und 1 px nach rechts (Frames 38–45); die hellbraunen Augenbrauen
  (4,2) und (7,2) wandern mit (die frei werdende Stelle bekommt die Gesichtsfarbe).
* Blinzeln, deutlich sichtbar (zweimal pro Schleife, alle 24 Frames ≈ 1,7 s: Frames 8–11 und 32–35): beide Augenpixel werden zu einem
  rosabraunen Lid (Farbe H des Halsbandglanzes, klar heller als das fast schwarze Gesicht und von den Brauen abgesetzt): erst oberes
  Pixel, dann beide, zwei Frames lang, dann wieder oberes Pixel.
* Pfoten tippen: die rechte Vorderpfote hebt sich um 1 px in Frames 12–13, 16–17 und 36–37, die linke in 26–27, 30 und 44–45
  (die untere Beinzeile 14 entfällt, die Fußlinie rückt hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
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
LID = (169, 90, 96)                                              # rosa-braunes Lid (Farbe des Halsband-Glanzes H) — klar abgesetzt vom schwarzen Gesicht und von den Brauen
BRAUE_L, BRAUE_R = (137, 84, 68), (163, 111, 98)                 # Augenbrauen (4,2) und (7,2)
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


PFOTE_R = (12, 13, 16, 17, 36, 37)
PFOTE_L = (26, 27, 30, 44, 45)


def zustand(i):
    atem = 1 if (i % 24) in range(4, 16) else 0
    ohr_li = max(T.huellkurve(i, N, s, 7) for s in (3, 19, 35))
    ohr_re = max(T.huellkurve(i, N, s, 7) for s in (11, 27, 40))
    blick = -1 if 14 <= i < 22 else (1 if 38 <= i < 46 else 0)
    lid = 0
    for s in (8, 32):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    return atem, ohr_li, ohr_re, blick, lid, 1 if i in PFOTE_R else 0, 1 if i in PFOTE_L else 0


def frame(i, nur=None):
    atem, ohr_li, ohr_re, blick, lid, tipp_r, tipp_l = zustand(i)
    z = PAD_T + BAUCHZEILE
    k = teil(koerper)
    # Blick (Augen und Augenbrauen wandern 1 px) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    ex = [x + blick for x in AUGEN_X]
    if blick:
        for x0, x1, c in zip(AUGEN_X, ex, (BRAUE_L, BRAUE_R)):
            k[PAD_T + 2, PAD_L + x0, :3] = KOPF                       # Braue geht, Augen gehen
            k[PAD_T + 3, PAD_L + x0, :3] = KOPF
            k[PAD_T + 4, PAD_L + x0, :3] = KOPF
            k[PAD_T + 2, PAD_L + x1, :3] = c                          # Braue und Augen kommen an
            k[PAD_T + 3, PAD_L + x1, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x1, :3] = AUGE_UNTEN
    if lid:
        for x in ex:
            k[PAD_T + 3, PAD_L + x, :3] = LID
            if lid == 2:
                k[PAD_T + 4, PAD_L + x, :3] = LID
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
