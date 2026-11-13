# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Priest“ (Creature) — schwarz gewandeter Skelett-Priester mit goldenem Gürtel und goldenen Stiefeln, im Lichtstrahl.

Quelle: src/skeleton-priest.png (12×30 px, 17 Farben) — Ausschnitt x 58–69, y 70–99 der Ebene „Skeleton Priest“ (MotiveGrailWar.xcf, Ebene 466, 128×109). Der automatische Treffer-Suchlauf fand
die Figur nicht (die Kartenkunst überlagert sie mit Lichtschein); ich habe sie über den Ebenennamen gefunden und von Hand ausgeschnitten.
PICK: [["MotiveGrailWar", 466, 0]]   (Ausschnitt x 58–69, y 70–99 der Ebene; Figur 0 = „von Hand“)
Runde 3 (Nutzer: „fehlt die blitzförmige Spitze seines Stabs“): der Ausschnitt reicht jetzt 9 Zeilen höher (y 70–78 der Ebene) und enthält den goldenen ZICKZACK-BLITZ, der den schwarzen Stab oben abschließt
(die Zeilen 0–8 des neuen Sprites; der Körper liegt gegenüber Runde 2 9 Zeilen tiefer). Weggelassen bleibt (gehört nicht zur Kreatur): die darüberliegende Lichtsäule (x 62–65, y 0–69) und die beiden Lichtvorhänge links/rechts
(Kulisse/Strahlenzauber der Karte). Die Quelle ist sonst vollständig (alles deckend).

Aufruf:   python3 skeleton_priest.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-priest.png + .json

Was ist was (x, y im 12×30-Sprite; die Figur ist von vorn gesehen und fast spiegelsymmetrisch um x = 5,5; Zeilenangaben im Folgenden NACH dem Zusatz der Blitzspitze, also alter Wert + 9):
* STABSPITZE (Zeilen 0–8, x 3–8): goldener Zickzack-Blitz (214,161,0)/(255,255,0)/(255,255,147)/(227,195,74)/(255,250,199) auf dem Stab; Licht, kein Metall (kein Glanz), bewegt sich als Ganzes mit dem Kopf.
* SOUTANE (alte Zeilenangaben, +9 für den neuen Sprite): schwarze Mittelbahn (x 4–6, y 0–16) mit grauer Naht (76,76,76)/(37,37,37); links und rechts davon weiße Schulter-/Armknochen (246,255,255)/(213,213,213)/(189,189,189) in braunem Umriss (49,24,0)
  (x 1–3 bzw. 8–10, y 1–7); unten zwei weiße Beinknochenstreifen (y 12–17).
* GÜRTEL (x 3–7, y 8–11): breite goldene Schnalle (214,161,0) mit gelben Lichtpunkten (255,255,0)/(234,215,0) bei (4,9), (6,9), (4,10), (6,10); die Unterarme/Hände (Knochen mit braunem Umriss) gehen bei y 9–11 nach außen
  (x 0–2 bzw. 9–11). Ein einzelnes goldenes Pixel (5,0) ganz oben (Rest der Lichtsäule bzw. Haubenspitze) bleibt als Spitze stehen.
* STIEFEL (x 0–3 und 8–11, y 17–20): goldene Stiefel (214,161,0)/(234,215,0)/(255,255,0)/(255,255,147).
AUGEN (nach Nutzerhinweis): die geschlossenen Augen sind die zwei schwarzen Schlitze mit grauem Lid in den alten Zeilen 4–5 (links (3–4, 5), rechts (6–8, 5), Lider (3,4) und (7–8,4)); sie werden NICHT mehr gedehnt (Runde 3, siehe Atmen).
Kein Blinzeln (die Augen sind zu).
Gold = Metall: Glanz/Glitzer erlaubt (Regel 12/14) nur an Gürtel und Stiefeln und der Spitze; Knochen/Stoff glänzen nicht. Kein Feuer. Keine Partikel.

RUNDE 4 (Nutzer: „sollte ein paar kleine Blitz-Particles um sich haben“): acht kleine ZICKZACK-BLITZE (3×4 px, 4-verbunden, Farben der Stabspitze: (255,255,147) Spitze, (255,255,0) Kern, (214,161,0) Ende)
zucken links und rechts neben der Figur kurz auf: 4 Frames (obere Hälfte hell → ganzer Blitz → ganzer Blitz → untere Hälfte in Gold), dann weg; über die Schleife verteilt (BLITZE), abwechselnd gespiegelt.
Sie liegen hinter der Figur und bewegen sich nicht (kein Wegfliegen). Dafür ist die Leinwand links/rechts je 5 px breiter (PAD 9 statt 4); die Figur selbst ist Frame für Frame unverändert.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, 0 → 1 → 2 → 1 → 0 px; Runde 3, Nutzer: „du stretchst gerade die geschlossenen Augen“): die eingefügte Zeile ist jetzt die Zeile UNTER den Augen (alte Zeile 6 = neue Zeile 15: weiße Schulter-/Armknochen mit braunem Umriss, keine Augenpixel),
  0–2× eingefügt (Texturmischung L.streck_zeile; geprüft: kein Augenpixel gelangt in die neue Zeile). Die Augen, die Kapuze und die Blitzspitze steigen dabei starr mit (nichts an ihnen wird gedehnt); Gürtel, Arme, Beine und Stiefel bleiben am Boden.
* ARME/HÄNDE (unabhängig, starr): linke Hand (x 0–2, y 9–11) hebt sich 1 px in den Frames 8–19 und 32–43, die rechte in 20–31 und 44–47 (immer 4-verbunden mit der Schnalle (x 3 bzw. 8)).
* GOLDGLANZ: ein diagonales Lichtband läuft über Gürtel und Stiefel (Frames 0–11 und 24–35, eine Stufe heller auf der Rampe (214,161,0) → (234,215,0) → (255,255,0) → (255,255,147));
  Glitzersterne (Mitte weiß, Arme hellgelb) am Gürtel (4,9) bzw. (6,10) und an den Stiefeln (2,19), (9,19), 1 → 2 → 2 → 1.
Kein Kopfneigen; die Füße bleiben am Boden (Regel 17/18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 5, 3
SPITZE = 9                                                                 # Zeilen der Stabspitze (Blitz) über dem alten Sprite: alle Koordinaten des Körpers liegen 9 Zeilen tiefer als in Runde 2

spr = L.lade('skeleton-priest')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (49, 24, 0)
GOLD = {(214, 161, 0): (234, 215, 0), (234, 215, 0): (255, 255, 0), (255, 255, 0): (255, 255, 147)}
GOLD_PTS = [(x, y) for y in range(SPITZE, sh) for x in range(sw) if vorhanden[y, x] and col(x, y) in GOLD]       # nur Gürtel und Stiefel (der Blitz ist Licht, kein Metall)

hand_l = vorhanden & (xx <= 2) & (yy >= 9 + SPITZE) & (yy <= 11 + SPITZE)
hand_r = vorhanden & (xx >= 9) & (yy >= 9 + SPITZE) & (yy <= 11 + SPITZE)
rest = vorhanden & ~hand_l & ~hand_r
TEST_EBENEN = 'koerper'

# ── Runde 4: kleine Zickzack-Blitze um die Figur ──
BLITZ_H, BLITZ_K, BLITZ_E = (255, 255, 147), (255, 255, 0), (214, 161, 0)
assert all(c in {col(x, y) for y in range(SPITZE) for x in range(sw) if vorhanden[y, x]} for c in (BLITZ_H, BLITZ_K, BLITZ_E))
BLITZ_FORM = [(1, 0, BLITZ_H), (2, 0, BLITZ_H), (1, 1, BLITZ_K), (0, 2, BLITZ_K), (1, 2, BLITZ_K), (0, 3, BLITZ_E)]     # .XX / .X. / XX. / X..
# (x, y) = linke obere Ecke in Sprite-Koordinaten, Startframe, gespiegelt
BLITZE = [(-6, 3, 2, False), (14, 10, 7, True), (-7, 17, 13, True), (15, 22, 19, False), (13, 1, 25, False), (-6, 10, 31, True), (15, 15, 37, True), (-7, 23, 43, False)]


def blitz_ebene(i):
    e = L.leer(H, W)
    for (bx, by, st, spiegel) in BLITZE:
        k = (i - st) % N
        if k >= 4:
            continue
        for (dx, dy, c) in BLITZ_FORM:
            if (k == 0 and dy > 1) or (k == 3 and dy < 2):
                continue
            if k == 3:
                c = BLITZ_E
            x, y = OFF[0] + bx + ((2 - dx) if spiegel else dx), OFF[1] + by + dy
            e[y, x] = c + (255,)
    return e


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = teil(rest)
    d = -3 + SPITZE + 2 * (i % 24) if (i % 24) < 14 else None                # Band läuft in Frames 0–13 (d startet vor dem Sprite)
    if d is not None and i % 24 >= 1:
        V.glanz_band(k, GOLD_PTS, GOLD, d, 3, OFF)
    kb = L.streck_zeile(k, OFF[1] + SPITZE + 6, n)                          # Zeile 6 des Körpers = unter den Augen (Zeilen 4–5 des Körpers), siehe Docstring
    up_l = V.fenster(i, N, 8, 12) | V.fenster(i, N, 32, 12)
    up_r = V.fenster(i, N, 20, 12) | V.fenster(i, N, 44, 4)
    ebenen = [(kb, 0, 0), (teil(hand_l), 0, -up_l), (teil(hand_r), 0, -up_r)]
    f = L.zusammen(H, W, ebenen)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur is None:                                                          # Sterne am Gold
        for (sx, sy, st0) in ((4, 9 + SPITZE, 6), (6, 10 + SPITZE, 30), (2, 19 + SPITZE, 15), (9, 19 + SPITZE, 39)):
            st = V.folge(i, N, st0, [1, 2, 2, 1])
            if st:
                dy_ = -n if sy < 12 + SPITZE else 0
                V.stern(f, sx, sy + dy_, st, (246, 255, 255), (255, 255, 147), OFF)
        f = L.zusammen(H, W, [(blitz_ebene(i), 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-priest', 'Skeleton Priest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-priest-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=10)
