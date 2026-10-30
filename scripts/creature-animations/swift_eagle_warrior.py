# -*- coding: utf-8 -*-
"""Idle-Animation für „Swift Eagle Warrior“ (Creature).

PICK: [["MotiveSteamDwarfs", 264, 1]]
Quelle: src/swift-eagle-warrior.png — Ebene „Swift Eagle Warrior“ (52×31 px, 71 Farben) aus MotiveSteamDwarfs.xcf, Figur 1.

Aufruf:   python3 swift_eagle_warrior.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/swift-eagle-warrior.png + .json

Identifikation (Sprite-Koordinaten x, y; Figur ist fast spiegelsymmetrisch um x = 25,5):
* Flügel: je ein großer dunkelbrauner Schwingenflügel mit schwarzem Umriss (links x 1–21, rechts x 30–50, y 13–24). Farben
  (26,17,23) Umriss, (43,25,12)/(69,43,23)/(91,63,41) Federn, am Ansatz (50,13,0) und (106,67,12). Er liegt NEBEN dem Körper,
  nirgends darüber (die Schulterspalten x 19–21 / 30–32 grenzen an den Körperumriss).
* Helmzier (y 0–8): weiße Mittelfeder (x 24–27, y 2–7) mit türkisen Spitzen, links und rechts davon je ein Büschel
  violetter Federn; darunter der graue Helmrand (23–28, 8).
* Kopf = goldener Adlerhelm (21–30, 9–19): Augen je 2×2 px (hellblau/weiß außen, dunkelrot innen) bei (23–24, 14–15) und
  (27–28, 14–15); schwarze Brauen (24,13), (27,13); orangebrauner Schnabelrücken (25–26, 14–16), heller Schnabel (24–27, 17–19).
* Hals/Kragen: schwarzes Band (22–29, 20–21) mit goldenen Pixeln (25–26, 20).
* Rumpf (21–30, 21–30): goldene Schulterpolster (21–23/28–30, 21–23), graubraune Rüstung, weiße Brustplatten, Gürtelschnalle
  mit türkisem Stein (25–26, 27–28), Schulter-Edelsteine (22, 24) und (29, 24). Die unteren Zeilen (29–30) sind der Rock/Rand der Kunst.

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht (Spitze etwa −2 … +5 px; Ruhepose = Original = angehobener Flügel), je weiter
  außen, desto mehr, die Spitze hinkt leicht nach (Wellenlauf). Die Schulterspalten am Körperumriss (links x ≥ 19, rechts x ≤ 32) bleiben stehen,
  sonst reißt zwischen Flügel und Körper eine Tasche auf. Beide Flügel gleichzeitig.
* Abschlag hebt den Oberkörper: Zeile 26 (Brustplatten) wird bei kräftigem Abschlag einmal verdoppelt; Kopf, Helmzier und Flügel
  heben sich starr um 1 px mit, der untere Rand (Rock) bleibt am Boden. Nichts wird doppelt gezeichnet, was woanders bewegt wird.
* Helmzier weht: die Federn (y 0–8 ohne Helmrand) lehnen sich zeilenweise 0 … 2 px zur Seite (Periode = Schleife), der Ansatz
  am Helmrand steht; ein Lichtreflex läuft an der weißen Mittelfeder herab (Frames 8–13).
* Blinzeln (Frames 16–18), Schulter-Edelsteine und Gürtelstein funkeln (Frames 4–6, 9–10, 14–15).
* Keine Partikel: braune Federflocken auf dunklem Grund sahen wie Krümel aus (verworfen), sonst gibt die Figur nichts her.

Ergänzungen: keine nötig — Flügel und Körper überlappen sich im Original nirgends (Körper allein: Umriss ringsum geschlossen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 7

spr = L.lade('swift-eagle-warrior')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
FLUEGEL_FARBEN = [(26, 17, 23), (43, 25, 12), (69, 43, 23), (91, 63, 41), (50, 13, 0), (106, 67, 12)]
LID, LID_STRICH = (181, 140, 31), (65, 9, 9)
FEDER_A, FEDER_U = (252, 254, 251), (255, 255, 255)        # Lichtreflex Mittelfeder
STEIN_DUNKEL, STEIN_HELL, STEIN_WEISS = (79, 135, 152), (157, 191, 192), (241, 242, 228)

# ── Masken ────────────────────────────────────────────────────────────────────────────────────────────────────────
fl_alle = L.farbmaske(spr, FLUEGEL_FARBEN)
fl_links = fl_alle & (xx <= 25)
fl_rechts = fl_alle & (xx >= 26)
helmrand = (yy == 8) & (xx >= 23) & (xx <= 28)
zier = vorhanden & (yy <= 8) & ~helmrand                     # Federbüschel + Mittelfeder
koerper = vorhanden & ~fl_alle & ~zier
assert int((fl_links | fl_rechts | zier | koerper).sum()) == int(vorhanden.sum())
assert not (fl_alle & (yy <= 8)).any()

AUGEN_L = [(23, 14), (24, 14), (23, 15), (24, 15)]
AUGEN_R = [(27, 14), (28, 14), (27, 15), (28, 15)]
FEDER_PFAD = [(y) for y in range(3, 8)]                      # Mittelfeder: Zeilen 3–7, Spalten 25/26


def frame(i):
    ph = L.sinus(i, N / 2)                                    # Flügelschlag: zweimal pro Schleife
    lift = 1 if math.sin(ph) > 0.45 else 0                    # kräftiger Abschlag → Oberkörper hebt sich
    zeile = PAD_T + 26

    # Körper (Kopf + Rumpf) mit Blinzeln und Edelstein-Funkeln, dann in Zeile 26 strecken
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    if i in (16, 18):                                         # halb zu: unteres Lid hoch
        F.setze(kp, PAD_L, PAD_T, {p: LID for p in (AUGEN_L[2], AUGEN_L[3], AUGEN_R[2], AUGEN_R[3])})
    if i == 17:                                               # zu: oben Lid, unten dunkler Wimpernstrich
        F.setze(kp, PAD_L, PAD_T, {**{p: LID for p in (AUGEN_L[0], AUGEN_L[1], AUGEN_R[0], AUGEN_R[1])},
                                   **{p: LID_STRICH for p in (AUGEN_L[2], AUGEN_L[3], AUGEN_R[2], AUGEN_R[3])}})
    if i in (4, 6):
        F.setze(kp, PAD_L, PAD_T, {(22, 24): STEIN_HELL})
    if i == 5:
        F.setze(kp, PAD_L, PAD_T, {(22, 24): STEIN_WEISS})
    if i in (9, 11):
        F.setze(kp, PAD_L, PAD_T, {(29, 24): STEIN_WEISS})
    if i == 10:
        F.setze(kp, PAD_L, PAD_T, {(29, 24): FEDER_U})
    if i in (14, 15):
        F.setze(kp, PAD_L, PAD_T, {(25, 28): STEIN_HELL, (26, 28): STEIN_WEISS})
    kp = L.streck_zeile(kp, zeile, lift)

    # Helmzier: Lichtreflex an der Mittelfeder, dann zeilenweise zur Seite lehnen (Ansatz = Helmrand, Zeile 8, steht)
    zr = F.ebene(spr, zier, H, W, PAD_L, PAD_T)
    for j in F.glanz_pfad(i, N, 8, FEDER_PFAD, 2):
        y = FEDER_PFAD[j]
        F.setze(zr, PAD_L, PAD_T, {(25, y): FEDER_A, (26, y): FEDER_U})
    zr = L.zeilen_welle(zr, PAD_T + 8, 2.4, L.sinus(i, N))
    zr = L.versetze(zr, 0, -lift)

    # Flügel: Schulterspalten stehen, weiter außen schlägt es aus; Spitze hinkt nach
    fl_amp, fl_pot, lauf = 3.4, 1.3, 0.5
    wl = F.fluegel_welle(F.ebene(spr, fl_links, H, W, PAD_L, PAD_T), PAD_L + 19, fl_amp, ph, potenz=fl_pot,
                         nur_rechts=False, lauf=lauf)
    wr = F.fluegel_welle(F.ebene(spr, fl_rechts, H, W, PAD_L, PAD_T), PAD_L + 32, fl_amp, ph, potenz=fl_pot,
                         nur_rechts=True, lauf=lauf)
    wl = L.versetze(wl, 0, -lift)
    wr = L.versetze(wr, 0, -lift)

    return L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0), (zr, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('swift-eagle-warrior', 'Swift Eagle Warrior', frames, MS, prev)
    if prev:
        L.streifen(prev + '/swift-eagle-warrior-strip.png', frames, spalten=6, scale=5)
