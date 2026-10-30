# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Shepherd“ (Creature).

Quelle: src/loyal-shepherd.png — Ebene „Shepherd“ (14×17 px, 17 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 180, 2]]

Aufruf:   python3 loyal_shepherd.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-shepherd.png + .json

Identifikation (Sprite 14×17, Hund von vorn, schwarz-braun mit weißer Brust):
* Kopf (x 3–10, Zeilen 1–6): schwarzblaue Stirn (E/G/M), heller Stirnstreifen C (6–7, 1), zwei dunkle Augen als senkrechte 1×2-Pixel
  (links x 5, rechts x 8; oben N (62,59,68), unten O (38,36,41), je y 3–4) in braunen Fellflecken I/F (Rottweiler-artige Gesichtszeichnung),
  zwei braune Augenbrauenpunkte P (136,113,97) bei (5,2) und F (161,144,128) bei (8,2).
* Schnauze: hellblau-weiße Wangen C (4,5) (9,5) (4,6) (9,6) (5,7) (8,7) (6–7,8), Nase = fast schwarze Pixel L (6,6) (6–7,7) (Q (7,6) = Schimmer).
* Schlappohren (links x 0–2, rechts x 11–13, Zeilen 2–5): hängen schwarz-blau mit braunem Innenpunkt F an den Kopfseiten.
* Halsband: bordeauxrote U-Linie J (88,30,44) / K (101,49,61) unter dem Kinn (3,7) (4,8) (5,9) (6,10) (7,10) (8,9) (9,8) (10,7) — Leder,
  kein Metall (daher kein Glanz-Band).
* Brust: weiß (C) rechts (9–10, 9–12), links ein schwarzer Block (2–4, 9–12) mit blauem Glanzpixel G (3,10) und E (3,11): beleuchtete
  Seite rechts, Schattenseite links — ob Schulter oder gebeugtes Vorderbein ist nicht sicher: bleibt FEST.
* Zwei Vorderbeine (links x 3–5, rechts x 8–10, Zeilen 13–15, braun H/D) mit Fußlinie Zeile 16.
* Kein Schwanz, keine Zunge sichtbar — nichts davon erfunden.
Bleibt fest: Stirn, Schnauze/Nase, Halsband, Brust, der schwarze Block links, die Beine bis auf die Pfoten.

Ablauf (52 Frames à 70 ms = 3,64 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen, nur Augen und Brauen blicken:
* Atmen (Periode 26, 2× pro Schleife; oben in Frames 3–14 und 29–40): Zeile 14 wird eingefügt — Kopf, Ohren, Halsband und Brust heben sich
  1 px, die Füße bleiben am Boden.
* Schlappohren schwingen: links in Frames 2, 15, 28, 41, rechts in 8, 21, 34, 46 (je 6 Frames): erst nur die Spitzenzeile 5, dann die Zeilen
  4–5 gemeinsam je 1 px nach außen und zurück; oben (Zeilen 2–3) bleiben sie am Kopf, die Lücke zum Kopf wird mit dem Randpixel geschlossen.
* Blick: nur die dunklen Augen wandern 1 px — Frames 16–23 nach rechts, 28–34 nach links, 44–49 nach rechts —, die braunen Augenbrauenpunkte
  (5,2) und (8,2) wandern mit; frei werdende Stellen bekommen die Farbe des Fellnachbarn.
* Blinzeln, deutlich sichtbar (Frames 10–13 und 36–39, alle 26 Frames ≈ 1,8 s): die Augenpixel werden hell (C = Stirnstreifenfarbe): erst
  das obere, dann beide (zwei Frames), dann wieder das obere.
* Glanzblitz (Regel 12): der blaue Glanzpunkt G (3,10) am schwarzen Block links blitzt in Frames 22–24 und 48–50 kurz auf (G → D → C → D → G;
  im Maximum wird auch E (3,11) kurz zu G).
* Pfoten tippen: linker Fuß in Frames 5–6, 20–21 und 41–42, rechter Fuß in 13–14, 32–33 und 48–49 (die Beinzeile 15 des Fußes entfällt,
  die Fußlinie rückt 1 px hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 52, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-shepherd')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 2) & (yy >= 2) & (yy <= 5)
ohr_r = vorhanden & (xx >= 11) & (yy >= 2) & (yy <= 5)
koerper = vorhanden & ~ohr_l & ~ohr_r

HELL = (194, 203, 220)                                            # C: Stirnstreifen/Brust (Lid)
AUGE_OBEN, AUGE_UNTEN = (62, 59, 68), (38, 36, 41)                # N, O
AUGEN_X = (5, 8)
BRAUE = {5: (136, 113, 97), 8: (161, 144, 128)}                   # P bei (5,2), F bei (8,2)
STIRN = (45, 46, 64)                                              # E: Farbe der Stirnfläche neben den Brauenpunkten
# Frei werdende Augenpixel bekommen die Farbe des Nachbarn, von dem das Auge wegläuft:
FELL_LINKS = {(5, 3): (131, 103, 89), (5, 4): (45, 46, 64), (8, 3): (161, 144, 128), (8, 4): (161, 144, 128)}    # Auge ging nach links
FELL_RECHTS = {(5, 3): (131, 103, 89), (5, 4): (131, 103, 89), (8, 3): (161, 144, 128), (8, 4): (85, 87, 100)}   # Auge ging nach rechts
BAUCHZEILE = 14                                                   # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def ohr_profil(env, richtung):
    """Schlappohr schwingt nach außen: erst nur die Spitzenzeile (5), dann Zeilen 4–5 gemeinsam (glatte Kontur)."""
    stufe = 0 if env < 0.2 else (1 if env < 0.5 else 2)
    return {PAD_T + y: richtung for y in range(6 - stufe, 6)} if stufe else {}


PFOTE_L = (5, 6, 20, 21, 41, 42)
PFOTE_R = (13, 14, 32, 33, 48, 49)


def zustand(i):
    atem = 1 if (i % 26) in range(3, 15) else 0
    blick = 1 if 16 <= i < 24 else (-1 if 28 <= i < 35 else (1 if 44 <= i < 50 else 0))
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (2, 15, 28, 41))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (8, 21, 34, 46))
    lid = 0
    for s in (10, 36):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    glanz = -1                                                    # Glanzpunkt am schwarzen Block links: 0 = D, 1 = C (Maximum), 2 = D
    for s in (22, 48):
        if 0 <= i - s < 3:
            glanz = i - s
    return atem, blick, ohr_li, ohr_re, lid, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0, glanz


def frame(i, nur=None):
    atem, blick, ohr_li, ohr_re, lid, tipp_l, tipp_r, glanz = zustand(i)
    k = teil(koerper)
    # Blick (Augen und Brauenpunkte wandern 1 px) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    if blick:
        neben = FELL_LINKS if blick < 0 else FELL_RECHTS
        for x0 in AUGEN_X:
            for y in (3, 4):
                k[PAD_T + y, PAD_L + x0, :3] = neben[(x0, y)]
            k[PAD_T + 2, PAD_L + x0, :3] = STIRN
            x1 = x0 + blick
            k[PAD_T + 2, PAD_L + x1, :3] = BRAUE[x0]
            k[PAD_T + 3, PAD_L + x1, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x1, :3] = AUGE_UNTEN
    if lid:
        for x0 in AUGEN_X:
            x = x0 + blick
            k[PAD_T + 3, PAD_L + x, :3] = HELL
            if lid == 2:
                k[PAD_T + 4, PAD_L + x, :3] = HELL
    if glanz >= 0:                                                    # Glanzblitz auf dem schwarzen Block: (3,10) G → D → C → D, (3,11) E → G im Maximum
        k[PAD_T + 10, PAD_L + 3, :3] = ((171, 160, 156), HELL, (171, 160, 156))[glanz]
        if glanz == 1:
            k[PAD_T + 11, PAD_L + 3, :3] = (85, 87, 100)
    r = L.streck_zeile(k, PAD_T + BAUCHZEILE, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + 15) & (cols >= PAD_L + 3) & (cols <= PAD_L + 10)
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 5))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 8))
    fl = L.heben_unten(fl, PAD_T + 15, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + 15, tipp_r)
    ol = L.streck_zeile(T.ohr_haengend(teil(ohr_l), ohr_profil(ohr_li, -1), 'links'), PAD_T + BAUCHZEILE, atem)
    orr = L.streck_zeile(T.ohr_haengend(teil(ohr_r), ohr_profil(ohr_re, 1), 'rechts'), PAD_T + BAUCHZEILE, atem)
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-shepherd', 'Loyal Shepherd', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-shepherd-strip.png', frames, spalten=13, scale=8)
