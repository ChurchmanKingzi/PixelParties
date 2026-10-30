# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Necromancer“ (Creature) — Fassung 5 (stehende Figur am Loch im Boden mit Arm, schwarzmagische Partikel, kein Knochenglanz).

Quelle: src/skeleton-necromancer.png — Ebene „Skeleton Necromancer“ (20×34 px, 15 Farben) aus Motive.xcf.
PICK: [["Motive", 813, 1], ["Motive", 813, 2]]
  Figur 1 = Kapuzenfigur mit Rippenring (steht, Standlinie = Ringunterkante), Figur 2 = LOCH IM BODEN, aus dem ein ARM ragt (Kartenbild: schwarze Raute am Boden, darin ein
  Knochenarm mit Faust, der nach oben zeigt). Gleiche Ebene, Mittelachse, 2 px unter dem Rippenring; der lila Grabkreuz-Hintergrund der Karte ist nicht Teil der Ebene.

Aufruf:   python3 skeleton_necromancer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-necromancer.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Kapuze: schwarzer Dom y 0–8, x 3–16 (Umriss A, helle Kante D bei y 2–3, Innenschatten F/G). Das Gesicht liegt tief im Schatten:
  nur matte Andeutungen (J bei (9/10,7), (8–11,8), (9/10,9), M/L darunter) — Augen/Kiefer sind NICHT sicher zu erkennen und bleiben fest.
* Ärmel: links x 0–4, rechts x 15–19, y 8–12 (schwarz A, graue Lichter C/N/D); darüber je ein brauner Punkt (2,8) und (17,8),
  dazwischen Robe/Körper. Braune Knochenpunkte (5,11) und (14,11) sitzen am Körper (Handgelenk/Knochen) und bleiben fest.
* Robe: y 9–12, Saum mit braunen Knochenkanten bei (6/7,12) und (12/13,12). Rippenring: y 13–20, Knochen E/H/I/K mit braunem Umriss B,
  Mitte (x 9–10, y 16–19) hohl.
* LOCH (Figur 2, schwarz A): Raute y 28–33, breit bei y 29–30 (x 6–14), Spitze y 33 — sitzt fest am Boden (bleibt in jedem Frame unverändert).
* ARM (Figur 2, nicht-schwarze Pixel y 24–30): Faust y 24–27 (Umriss B, Fläche E/H; 4 px breit, rundlich) auf dem Unterarmknochen y 28–30
  (B I B, 1 px weißer Knochen I mit braunem Umriss), dessen unteres Ende (10,30) im Loch steckt.
Fest bleiben: Gesicht, Robe, alle Knochenpunkte (nur starr mit ihrem Teil), das Loch.

Ablauf (40 Frames à 65 ms = 2,6 s; Frame 0 = Original, Partikel ausgenommen):
* Die Figur STEHT (kein Schweben, keine Gesamtverschiebung): Standlinie = Unterkante des Rippenrings (y 20, die „Füße“ der Figur — der Sprite hat keine
  Füße; sie bleibt in jedem Frame an derselben Stelle über dem Loch). Atmen (Periode 20) = die Rippenzeile y 16 wird einmal eingefügt: Oberkörper
  (obere Rippen, Robe, Kapuze, Ärmel) hebt sich 1 px, die untere Rippenhälfte y 17–20 bleibt stehen.
* Kapuze: die Kuppe atmet 3 Frames später zusätzlich (Zeile y 5 wird einmal eingefügt, Kuppe 1 px höher); die Spitzenzeile y 0 pendelt −1/0/+1 px seitwärts
  (Periode 40, bleibt an Zeile y 1 hängen).
* Ärmel-Geste größer und öfter (Periode 20, beide Seiten SYNCHRON und gespiegelt): Spitzen heben sich bis 4 px, dazu flattert eine Welle
  (Periode 10, Spitze hinkt hinterher) mit bis ±1,6 px → insgesamt bis ca. ±5–6 px; Spaltenversatz wächst von der Schulter (x 5 / x 14) zur Hand.
* ARM aus dem Loch: er reckt sich (Periode 40, 0-1-2-1-0 px, dazu kurze Zuckungen +1 px bei Frame 6–7, 17–18, 31–32; höchstens 3 px): im Arm-Layer
  wird die Unterarmzeile y 29 eingefügt, die Faust steigt, das Armende (10,30) bleibt im Loch. Die Faust öffnet und schließt sich (dreimal pro Schleife,
  Frame 9–11, 23–25, 35–37): die Faustzeile y 26 wird einmal eingefügt (Faust 1 px höher, Umrissenden wandern mit). Das Loch hinter dem Arm ist schwarz A
  (ERGÄNZUNG, siehe unten).
* Schwarzmagische Wölkchen (Partikel, hinter der Figur, 11 Stück, Lebensdauer 40 Frames, langsam aufsteigend, leichtes Wabern, wachsen und schrumpfen, Formen l, m, o, k):
  Kern fast schwarz (18,6,20) (Dunkelviolett-Schwarz aus dem Sprite), schmaler Rand kaltes Violett (128,102,178) = #8066b2 aus data/palette.json (AUSNAHME: neue Farbe,
  in L.pruefe freigegeben; mit SEELE_RAND schnell tauschbar). Keine weißen Wölkchen mehr. Sie steigen aus Rippenring und Ärmeln auf (nicht aus dem Loch) und bleiben
  nah an der Figur (Zuschnitt, s. u.).
Kein Glanz an Knochen (Regel 14): Lichtband und Glitzersterne sind entfallen.
Randpixel-Test (Regel 16): `U.kontur_schliessen` ergänzt in jedem Frame fehlende Umrisspixel an Ärmeln und Armkanten (Farbe: häufigste Randfarbe der
Umgebung, meist Schwarz A); im Ruhebild ändert es nichts.
ERGÄNZUNG: 7 schwarze Pixel (A) im Loch hinter dem Arm bei (9,28) (10,28) (11,28) (9,29) (10,29) (11,29) (10,30) — im Ruhebild liegen dort die Armpixel,
sie werden erst sichtbar, wenn der Arm steigt. Sonst nichts gemalt.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Körperrand hinaus, dazu 1 px leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 40, 65
GPL, GPR, GPT, GPB = 9, 9, 18, 6

spr = L.lade('skeleton-necromancer')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
SEELE_KERN = c(6, 17)                     # E (213,213,213) Knochenweiß
SEELE_RAND = (128, 102, 178)              # #8066b2 aus data/palette.json (Ausnahme, kaltes Violett)
SCHWARZ = c(10, 33)                       # A (0,0,0): Loch

schwarz = vorhanden & (spr[..., :3] == np.array(SCHWARZ)).all(axis=2)
aermel_l = vorhanden & (xx <= 4) & (yy >= 8) & (yy <= 12)
aermel_r = vorhanden & (xx >= 15) & (yy >= 8) & (yy <= 12)
haube = vorhanden & (yy <= 12) & ~aermel_l & ~aermel_r          # Kapuze + Robe
rippen = vorhanden & (yy >= 13) & (yy <= 20)
arm = vorhanden & (yy >= 24) & ~schwarz                          # Faust + Unterarmknochen aus dem Loch
loch = vorhanden & (yy >= 24) & schwarz                          # schwarze Raute am Boden
assert (aermel_l | aermel_r | haube | rippen | arm | loch).sum() == vorhanden.sum()
UMRISS = U.umrissfarben(spr)
LOCH_ERG = [(9, 28), (10, 28), (11, 28), (9, 29), (10, 29), (11, 29), (10, 30)]    # ERGÄNZUNG: schwarz hinter dem Arm

SCHATTEN_KERN = (18, 6, 20)               # Dunkelviolett-Schwarz aus dem Sprite (I)
assert SCHATTEN_KERN in {tuple(int(v) for v in q[:3]) for q in spr.reshape(-1, 4) if q[3]}
SEELEN = {'c': SCHATTEN_KERN, 'r': SEELE_RAND}     # schwarzmagische Wölkchen: Kern fast schwarz, schmaler violetter Rand (Fassung 4)
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [                                          # nah an der Figur (Zuschnitt: Effekte höchstens +2 px über den Körperrand); nichts aus dem Loch (y ≥ 24)
    dict(x=P(3, 18)[0], y=P(3, 18)[1], vx=-1, vy=-12, off=0, form='l', wackeln=1),        # groß, links vom Rippenring
    dict(x=P(16, 19)[0], y=P(16, 19)[1], vx=1, vy=-12, off=14, form='l', wackeln=1),      # groß, rechts
    dict(x=P(2, 10)[0], y=P(2, 10)[1], vx=0, vy=-8, off=26, form='m', wackeln=1),         # über dem linken Ärmel
    dict(x=P(17, 10)[0], y=P(17, 10)[1], vx=0, vy=-8, off=6, form='m', wackeln=1),        # über dem rechten Ärmel
    dict(x=P(4, 20)[0], y=P(4, 20)[1], vx=-1, vy=-10, off=20, form='o', wackeln=1),       # aus dem Rippenring nach links
    dict(x=P(15, 20)[0], y=P(15, 20)[1], vx=1, vy=-10, off=34, form='o', wackeln=1),      # … nach rechts
    dict(x=P(10, 1)[0], y=P(10, 1)[1], vx=0, vy=-5, off=38, form='k', wackeln=1),         # Funke über der Kapuze
    dict(x=P(8, 19)[0], y=P(8, 19)[1], vx=0, vy=-4, off=3, form='k', wackeln=0.5),        # Funken im hohlen Rippenring
    dict(x=P(11, 19)[0], y=P(11, 19)[1], vx=0, vy=-4, off=22, form='k', wackeln=0.5),
    dict(x=P(4, 22)[0], y=P(4, 22)[1], vx=-2, vy=-9, off=10, form='o', wackeln=1),        # an den unteren Rippen
    dict(x=P(15, 22)[0], y=P(15, 22)[1], vx=2, vy=-9, off=30, form='o', wackeln=1),
]
ZUCK = {6, 7, 17, 18, 31, 32}                                    # kurze Zuckungen des Arms (+1 px)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                       # sofort auf die volle Leinwand


def stufe2(i):
    """Zweistufiges Schweben 0-1-2-1-0 über die Schleife."""
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))


def frame_gross(i, nur=None):
    # --- Die Figur STEHT am Loch: Standlinie = Unterkante des Rippenrings (y 20), sie bleibt in jedem Frame fest. Atmen = eine Zeile (y 16) im Rippenring
    #     wird eingefügt, Oberkörper (Rippen oben, Robe, Kapuze, Ärmel) hebt sich um dieses 1 px, die untere Rippenhälfte (y 17–20) bleibt stehen ---
    r_b = U.stufe(i, N / 2, 1)                                   # Atem (0/1), Periode 20
    r_c = U.stufe(i - 3, N / 2, 1)                               # Kapuzenspitze atmet 3 Frames später zusätzlich (0/1)
    tip = U.stufe(i, N, 2, form='sin') - 1                       # Kapuzenspitze (Zeile y 0) pendelt −1/0/+1 px (Periode 40; 0 bei Frame 0)
    hump = U.buckel(i, 0, 20, n=20)                              # Ärmel-Geste (Periode 20), Frame 0 = Ruhe
    ph = L.sinus(i, 10)
    n_arm = min(3, stufe2(i) + (1 if i in ZUCK else 0))          # Arm reckt sich aus dem Loch (0 … 3 px)
    griff = 1 if i in {9, 10, 11, 23, 24, 25, 35, 36, 37} else 0     # Faust öffnet/schließt sich

    hb0 = teil(haube)
    if tip:                                                      # Spitzenzeile y 0 (x 7–12) rutscht um tip nach links/rechts; bleibt an Zeile 1 (x 6–13) hängen
        zeile = hb0[GPT, :, :].copy()
        hb0[GPT, :, :] = 0
        hb0[GPT, GPL + tip:GPL + sw + tip, :] = zeile[GPL:GPL + sw, :]
    hb = L.streck_zeile(hb0, GPT + 5, r_c)
    ri = L.streck_zeile(teil(rippen), GPT + 16, r_b)
    al = L.spalten_welle(teil(aermel_l), GPL + 5, 1.6 * hump, ph, bias=-4.0 * hump, lauf=1.0, nur_rechts=False)
    ar = L.spalten_welle(teil(aermel_r), GPL + 14, 1.6 * hump, ph, bias=-4.0 * hump, lauf=1.0, nur_rechts=True)
    # Loch fest am Boden (mit schwarzer Ergänzung hinter dem Arm), Arm wächst aus dem Loch
    lo = teil(loch)
    for (x, y) in LOCH_ERG:
        lo[GPT + y, GPL + x, :3] = SCHWARZ
        lo[GPT + y, GPL + x, 3] = 255
    am = L.streck_zeile(teil(arm), GPT + 26, griff)                     # Faustzeile y 26 wird eingefügt: Faust öffnet sich (1 px höher)
    am = L.streck_zeile(am, GPT + 29, n_arm)                            # Unterarmzeile y 29 wird eingefügt: Arm wird länger, Faust steigt
    koerper = L.zusammen(H, W, [(lo, 0, 0), (am, 0, 0), (ri, 0, 0), (hb, 0, -r_b), (al, 0, -r_b), (ar, 0, -r_b)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ)               # Regel 16: Umriss an Ärmeln/Armkanten in jeder Pose geschlossen
    if nur == 'koerper':
        return koerper
    seelen = U.glut_ebene(H, W, i, N, PUFFS, SEELEN)
    return L.zusammen(H, W, [(seelen, 0, 0), (koerper, 0, 0)])


# Zuschnitt auf die Figur (Nutzerwunsch): symmetrisch um die Ruhefigur, Effekte höchstens +2 px über den Körperrand hinaus
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=[SEELE_RAND], min_rand=1)
    L.speichern('skeleton-necromancer', 'Skeleton Necromancer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-necromancer-strip.png', [frames[k] for k in (0, 5, 10, 15, 20, 25, 30, 35)], spalten=4, scale=7)
