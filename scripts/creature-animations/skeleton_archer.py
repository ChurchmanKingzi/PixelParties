# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Archer“ (Creature) — Skelett-Bogenschütze im dunkelgrünen Kapuzenmantel, der Bogen steht rechts neben ihm.

Quelle: src/skeleton-archer.png (19×26 px, 32 Farben) — Ebene „Skele Archer #1“ (Motive.xcf, Ebene 83), Figur 1.
PICK: [["Motive", 83, 1]]
Die Quelle ist vollständig (alle Pixel deckend). Figur 2 derselben Ebene (24×7 px) ist der schon abgeschossene Pfeil (Geschoss, kein Teil der Kreatur) und der Grabstein „Skele Archer #2“
(Ebene 85) ist Kulisse — beides bleibt weg (nichts Verdecktes wird freigelegt, nichts erfunden).

Aufruf:   python3 skeleton_archer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-archer.png + .json

Was ist was (x, y im Sprite; unsichere Dinge bleiben fest):
* KAPUZE (x 6–13, y 2–9): dunkelgrüner Kapuzenmantel (0,12,0)/(23,30,14)/(39,43,28) mit grauer Stoffhöhe (92,104,80)/(148,162,145) oben; links oben eine grüne FEDER (0,90,0)/(0,135,0) bei (5,0), (5–6,1), (5–7,2);
  rechts oben ein Mantelzipfel (x 13–18, y 5–7), der hinter dem Bogen hervorsteht.
* GESICHT: der Totenschädel schaut rechts aus der Kapuze (x 9–11, y 8–11): weißer Kiefer (246,255,255)/(189,189,189) und ein einzelnes leuchtend grünes AUGE (35,255,0) bei (11,9).
* RIPPENKORB (x 4–10, y 11–17): weiße Rippenbögen (246,255,255) in Schwarz (26,26,26); Köcher mit grünen Federn (0,90,0)/(0,135,0)/(0,38,0) links unten (x 2–6, y 17–20);
  Beine/Füße (x 0–10, y 20–25): graue Knochen, links ein grauer Schuh (x 0–3, y 21–24), rechts brauner Stiefel (x 5–10, y 22–25).
* BOGEN (x 12–18, y 6–25): braunes Holz (26,14,0)/(102,55,0)/(77,41,0)/(51,27,0), graue Sehne (132,132,132)/(91,91,91) bei x 13, grüner Griffwickel (0,38,0)/(0,90,0)/(0,64,0) bei (15–17, 14–17).
Metall/Gold/Edelstein: keins (Knochen, Holz, Stoff). Kein Glanz (Regel 14), kein Feuer (Regel 15). Keine Partikel (nichts in der Figur, das raucht oder funkelt).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, zweimal pro Schleife, zweistufig 0 → 1 → 2 → 1 → 0): die Rippenzeile y 15 wird 0–2× eingefügt (mit Texturmischung `L.streck_zeile`), Rippenkorb, Kapuze und Feder steigen (bis 2 px); Beine und Köcher bleiben am Boden.
  Nur der Körper atmet; der Bogen (Layer für sich) wird NICHT gestreckt, sondern starr geführt: er folgt der Brust um 2 Frames verzögert (die Hand hält ihn).
* BOGEN (zusätzlich, Periode 16): der Bogen wird 1 px zusätzlich angehoben (Frames 4–11 jedes 16er-Taktes), als würde die Hand ihn nachführen (starr, nichts wird gestreckt; nie nach unten, weil sonst die Lücke im Mantel hinter dem Bogenkopf sichtbar würde).
* FEDER flattert (Periode 12): die Federspitze (5,0) springt zwischen x 5 und x 6 (bleibt über (5,1)/(6,1) 4-verbunden).
* MANTELZIPFEL weht (Periode 18, laufende Welle): der Zipfel rechts oben (x ≥ 16, y 5–6) hebt/senkt sich um 1 px (starr, bleibt über (15,5) und (15,6) angeschlossen).
* AUGE blinzelt (Frames 19–21 und 41–43): das grüne Augenpixel nimmt die Kapuzenfarbe (0,12,0) an (Lid).
* SCHUH tippt (Frames 8–11 und 32–35): die Zehen des linken Schuhs (x 0–3, y 23–24) heben sich 1 px, die Ferse bleibt am Boden.
Kein Kopfneigen, keine seitliche Verlagerung (Regel 17). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; fehlende Außenkante an bewegten Teilen schließt `U.kontur_schliessen` mit der Umrissfarbe der Quelle (Randpixel-Test).
"""
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('skeleton-archer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (26, 26, 26)
CAPE = {(0, 12, 0), (23, 30, 14), (39, 43, 28), (92, 104, 80), (148, 162, 145)}
AUGE = (11, 9)
assert col(*AUGE) == (35, 255, 0)
KAPUZE = (0, 12, 0)

# Teile (Masken im Sprite)
bogen = np.zeros((sh, sw), bool)
for y in range(sh):
    for x in range(sw):
        if vorhanden[y, x] and x >= 12 and y >= 6 and col(x, y) not in CAPE:
            bogen[y, x] = True
zipfel = vorhanden & (xx >= 16) & (yy >= 5) & (yy <= 6) & ~bogen
zeh_l = vorhanden & (xx <= 3) & (yy >= 23)
rest = vorhanden & ~bogen & ~zipfel & ~zeh_l
assert (rest | bogen | zipfel | zeh_l).sum() == vorhanden.sum()
TEST_EBENEN = 'koerper'


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)                                              # Atem 0 … 2 (Brust, Kapuze, Feder steigen)
    n_bogen = V.stufen(i - 2, 24, 2)                                    # der Bogen folgt 2 Frames später
    nach = 1 if (i % 16) in range(4, 12) else 0                         # Hand führt den Bogen 1 px nach (nur nach oben: dahinter liegt nichts, das sichtbar würde)
    dy_b = -(n_bogen + nach)
    k = teil(rest)
    if V.fenster(i, N, 19, 3) or V.fenster(i, N, 41, 3):                # Blinzeln: Auge → Kapuzenfarbe
        V.setze(k, {AUGE: KAPUZE}, OFF)
    if (i % 12) in range(3, 9):                                         # Federspitze (5,0) → (6,0)
        V.setze(k, {(5, 0): None, (6, 0): col(5, 0)}, OFF)
    dz = -V.fenster(i, 18, 4, 7)                                        # Mantelzipfel weht (starr, 1 px)
    dzeh = -(V.fenster(i, N, 8, 4) | V.fenster(i, N, 32, 4))            # Zehen tippen
    kb = V.streck_teil(k, k[..., 3] > 0, OFF[1] + 15, n)
    ebenen = [(kb, 0, 0), (teil(zeh_l), 0, dzeh), (teil(zipfel), 0, dz - n), (teil(bogen), 0, dy_b)]
    f = L.zusammen(H, W, ebenen)
    return U.kontur_schliessen(f, UMRISS, KONTUR)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-archer', 'Skeleton Archer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-archer-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
