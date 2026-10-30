# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Necromancer“ (Creature) — Fassung 2 (lebendiger, mit Glanz und mehr Seelenwölkchen).

Quelle: src/skeleton-necromancer.png — Ebene „Skeleton Necromancer“ (20×34 px, 15 Farben) aus Motive.xcf.
PICK: [["Motive", 813, 1], ["Motive", 813, 2]]
  Figur 1 = Kapuzenfigur mit Rippenring, Figur 2 = „Unterkörper“ (Knochen + schwarzer Zipfel). Figur 2 gehört dazu: gleiche Ebene,
  gleicher Name, exakt auf der Mittelachse (x 38/38,5 in der Kartenkunst) und 2 px unter dem Rippenring; der lila Grabkreuz-Hintergrund
  der Karte ist dagegen nicht Teil der Ebene.

Aufruf:   python3 skeleton_necromancer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-necromancer.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Kapuze: schwarzer Dom y 0–8, x 3–16 (Umriss A, helle Kante D bei y 2–3, Innenschatten F/G). Das Gesicht liegt tief im Schatten:
  nur matte Andeutungen (J bei (9/10,7), (8–11,8), (9/10,9), M/L darunter) — Augen/Kiefer sind NICHT sicher zu erkennen und bleiben fest.
* Ärmel: links x 0–4, rechts x 15–19, y 8–12 (schwarz A, graue Lichter C/N/D); darüber je ein brauner Punkt (2,8) und (17,8),
  dazwischen Robe/Körper. Braune Knochenpunkte (5,11) und (14,11) sitzen am Körper (Handgelenk/Knochen) und bleiben fest.
* Robe: y 9–12 (C, L dunkelviolett, M, A), Saum mit braunen Knochenkanten bei (6/7,12) und (12/13,12).
* Rippenring: y 13–20, Knochen E/H/I/K (Rampe K → H → E → I) mit braunem Umriss B; Mitte (x 9–10, y 16–19) ist hohl, bei y 18 verbindet ein Steg die Hälften.
* Unterkörper (Figur 2): y 24–33 — Knochenknauf (B/E/H) y 24–27, Schaft (I) y 28–30, schwarze Raute A (breit bei y 29–30, Spitze y 33).
Fest bleiben: Gesicht, Robe, alle Knochenpunkte (nur starr mit ihrem Teil).

Ablauf (40 Frames à 65 ms = 2,6 s; Frame 0 = Original, die Wölkchen und der Glanz ausgenommen):
* Schweben zweistufig (Periode 40, 0-1-2-1-0 px): der Rippenring (Brust) steigt zuerst, Kapuze + Robe + Ärmel folgen 3 Frames später und
  liegen nie höher als die Brust (der Saum taucht höchstens 1 px über den Rippenring, nie entsteht ein Spalt); der Unterkörper hinkt
  5 Frames hinterher und steigt ebenfalls bis 2 px — die Lücke zum Rippenring bleibt immer ≥ 1 Zeile.
* Kapuze atmet (Periode 20): die Zeile y 5 wird einmal eingefügt, die Kuppe hebt sich 1 px (Gesicht/Ärmel bleiben).
* Unterkörper stärker: dazu pendelt die schwarze Spitze (y 31–33) bis ±2 px (Periode 10).
* Ärmel-Geste größer und öfter (Periode 20, beide Seiten SYNCHRON und gespiegelt): Spitzen heben sich bis 4 px, dazu flattert eine Welle
  (Periode 10, Spitze hinkt hinterher) mit bis ±1,6 px → insgesamt bis ca. ±5 px; Spaltenversatz wächst von der Schulter (x 5 / x 14) zur Hand.
* Glanz (Regel 12): Lichtband wandert alle 20 Frames diagonal über den Rippenring (Knochenrampe K → H → E → I), alle 20 Frames über den
  Knochenknauf; vierzackige Glitzersterne (Mitte I, Arme E) blitzen für 3 Frames an Rippenpunkten (5,16) Frame 6–8, (14,19) Frame 26–28,
  am Knauf (9,25) Frame 16–18 und (10,28) Frame 36–38 auf und bleiben am Objekt.
* Seelenwölkchen (Partikel, hinter der Figur, 11 Stück, Lebensdauer 40 Frames, langsam aufsteigend, leichtes Wabern, Formen l, m, o, k):
  zwei große seitlich vom Unterkörper, zwei über den Ärmeln, zwei seitlich aus dem Rippenring, zwei kleine Kugeln neben der Rautenspitze,
  zwei Funken im hohlen Rippenring, ein Funke über der Kapuze. Kern Knochenweiß E (213,213,213) aus dem Sprite, Rand kaltes Violett
  (128,102,178) = #8066b2 aus data/palette.json (AUSNAHME: neue Farbe, in L.pruefe freigegeben; mit SEELE_RAND schnell tauschbar).
ERGÄNZUNG: keine gemalten Pixel (nichts liegt unter bewegten Teilen). Die Figur hat 296–301 Pixel: beim Heben legen sich Ärmel über
Kapuzenränder und der Rippenring taucht unter den Saum; das ist gewollt (Arm vor Kapuze, Saum vor Rippen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 40, 65
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 18, 6

spr = L.lade('skeleton-necromancer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
SEELE_KERN = c(6, 17)                     # E (213,213,213) Knochenweiß
SEELE_RAND = (128, 102, 178)              # #8066b2 aus data/palette.json (Ausnahme, kaltes Violett)
K_, H_, E_, I_ = c(7, 15), c(9, 14), c(7, 14), c(8, 14)    # Knochenrampe: (82,82,82) → (189,189,189) → (213,213,213) → (246,255,255)
RAMPE = {K_: H_, H_: E_, E_: I_}

aermel_l = vorhanden & (xx <= 4) & (yy >= 8) & (yy <= 12)
aermel_r = vorhanden & (xx >= 15) & (yy >= 8) & (yy <= 12)
haube = vorhanden & (yy <= 12) & ~aermel_l & ~aermel_r          # Kapuze + Robe
rippen = vorhanden & (yy >= 13) & (yy <= 20)
unterkoerper = vorhanden & (yy >= 24)
assert (aermel_l | aermel_r | haube | rippen | unterkoerper).sum() == vorhanden.sum()
knochen = [(x, y) for y in range(13, 21) for x in range(sw) if vorhanden[y, x] and tuple(spr[y, x, :3]) in RAMPE or (vorhanden[y, x] and tuple(spr[y, x, :3]) == I_ and 13 <= y <= 20)]
knauf = [(x, y) for y in range(24, 31) for x in range(sw) if vorhanden[y, x] and (tuple(spr[y, x, :3]) in RAMPE or tuple(spr[y, x, :3]) == I_)]

SEELEN = {'c': SEELE_KERN, 'r': SEELE_RAND}
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS = [
    dict(x=P(2, 27)[0], y=P(2, 27)[1], vx=-2, vy=-16, off=0, form='l', wackeln=1),        # groß, links vom Unterkörper
    dict(x=P(17, 29)[0], y=P(17, 29)[1], vx=2, vy=-17, off=14, form='l', wackeln=1),      # groß, rechts
    dict(x=P(0, 9)[0], y=P(0, 9)[1], vx=-2, vy=-10, off=26, form='m', wackeln=1),         # über dem linken Ärmel
    dict(x=P(19, 9)[0], y=P(19, 9)[1], vx=2, vy=-10, off=6, form='m', wackeln=1),         # über dem rechten Ärmel
    dict(x=P(3, 17)[0], y=P(3, 17)[1], vx=-3, vy=-11, off=20, form='o', wackeln=1),       # aus dem Rippenring nach links
    dict(x=P(16, 17)[0], y=P(16, 17)[1], vx=3, vy=-11, off=34, form='o', wackeln=1),      # … nach rechts
    dict(x=P(10, -3)[0], y=P(10, -3)[1], vx=0, vy=-9, off=38, form='k', wackeln=1),       # Funke über der Kapuze
    dict(x=P(8, 19)[0], y=P(8, 19)[1], vx=0, vy=-4, off=3, form='k', wackeln=0.5),        # Funken im hohlen Rippenring
    dict(x=P(11, 19)[0], y=P(11, 19)[1], vx=0, vy=-4, off=22, form='k', wackeln=0.5),
    dict(x=P(6, 34)[0], y=P(6, 34)[1], vx=-2, vy=-9, off=10, form='o', wackeln=1),        # neben der Rautenspitze
    dict(x=P(14, 33)[0], y=P(14, 33)[1], vx=2, vy=-9, off=30, form='o', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    """Zweistufiges Schweben 0-1-2-1-0 über die Schleife."""
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))


def frame(i):
    # --- Schweben: Rippenring (Brust) zuerst, Kapuze + Ärmel 3 Frames später (nie höher als die Brust, höchstens 1 px tiefer — der Saum
    #     taucht dann über den Rippenring, es entsteht nie ein Spalt), Unterkörper 5 Frames später ---
    r_r = stufe2(i)
    r_h = max(min(r_r, stufe2(i - 3)), r_r - 1)
    r_t = stufe2(i - 5)
    r_c = U.stufe(i, N / 2, 1)                                   # Kapuze atmet (0/1)
    spitze = 1.8 * math.sin(L.sinus(i, N / 4))                   # Spitzenpendel (Periode 10), 0 bei Frame 0
    hump = U.buckel(i, 0, 20, n=20)                              # Ärmel-Geste (Periode 20), Frame 0 = Ruhe
    ph = L.sinus(i, 10)

    hb = L.streck_zeile(teil(haube), PAD_T + 5, r_c)
    ri = teil(rippen)
    # Lichtband über den Rippenring (alle 20 Frames, diagonal von oben links nach unten rechts)
    k = i % 20
    U.band_diagonal(ri, knochen, RAMPE, 19 + k, 2, PAD_L, PAD_T)
    un = U.haengen(teil(unterkoerper), PAD_T + 30, spitze)
    if 10 <= k <= 18:                                            # Lichtband über den Knochenknauf (versetzt)
        U.band_diagonal(un, knauf, RAMPE, 33 + (k - 10), 2, PAD_L, PAD_T)
    al = L.spalten_welle(teil(aermel_l), PAD_L + 5, 1.6 * hump, ph, bias=-4.0 * hump, lauf=1.0, nur_rechts=False)
    ar = L.spalten_welle(teil(aermel_r), PAD_L + 14, 1.6 * hump, ph, bias=-4.0 * hump, lauf=1.0, nur_rechts=True)
    seelen = U.glut_ebene(H, W, i, N, PUFFS, SEELEN)

    # Glitzersterne (nach der Figur; bleiben am Knochen und gehen mit Rippen bzw. Unterkörper mit)
    sterne = L.leer(H, W)
    plan = [((5, 16), {6: 1, 7: 2, 8: 1}, r_r), ((14, 19), {26: 1, 27: 2, 28: 1}, r_r),
            ((9, 25), {16: 1, 17: 2, 18: 1}, r_t), ((10, 28), {36: 1, 37: 2, 38: 1}, r_t)]
    for (px, py), zeiten, r in plan:
        st = zeiten.get(i, 0)
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + px, PAD_T + py - r, st, I_, E_))

    return L.zusammen(H, W, [(seelen, 0, 0), (un, 0, -r_t), (ri, 0, -r_r), (hb, 0, -r_h), (al, 0, -r_h), (ar, 0, -r_h), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=[SEELE_RAND])
    L.speichern('skeleton-necromancer', 'Skeleton Necromancer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-necromancer-strip.png', [frames[k] for k in (0, 5, 10, 15, 20, 25, 30, 35)], spalten=4, scale=7)
