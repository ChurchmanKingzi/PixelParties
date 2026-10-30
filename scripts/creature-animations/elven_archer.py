# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Archer“ (Creature) — Muster für die Elfen und andere Humanoide mit Bogen/Stab.

Quelle: src/elven-archer.png — die sitzende Elfe mit Bogen (18×26 px, 33 Farben).
PICK: [["MotiveGrailWar", 554, 1]]      (Ebene „Elven Archer“, Figur 1; derselbe Sprite steckt gespiegelt in Ebene 555)

Aufruf:   python3 elven_archer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-archer.png + .json

Was im Sprite ist (Koordinaten x, y im 18×26-Sprite):
* Bogen (x 2–4, y 6/7–25): brauner Schaft mit dunklem Umriss, schwarz-grauer Griff y 14–17. Steht fest (Bogen am Boden/in der Hand).
* Linke Elfenohrspitze (0–1, 8–9): nur ein dunkler Keil, der Rest steckt hinter dem Bogen. Rechtes Ohr (14–17, 8–10).
* Pfeilspitze (13–15, 0–4): hellblau mit weißer Kante (Pfeil im Köcher hinter dem Kopf).
* Haar (x 4–13, y 3–14): gelb/orange, Pony y 7–9, zwei Seitenlocken (links x 5, rechts x 12–13). Gesicht y 9–13.
  Offenes Auge links (6–7, 9–11: schwarz, hellblaue Iris (6,10), weißer Glanz (6,11)); rechtes Auge ist zugekniffen (zwinkert,
  schwarzer Strich (10–11, 11)).
* Hand am Bogengriff (5–7, 15–18), grüne Tunika (8–13, 15–19), Beine/Schuhe braun-grau (5–13, 19–25).
* Orange/rotbraune Pixel (14,14), (15,14), (15,15) am rechten Rand der Schulter: nicht sicher zu deuten (Haarspitze/Köcherriemen)
  → bleiben fest mit dem Körper.

Ablauf (40 Frames à 90 ms = 3,6 s):
* Atmen (Periode 40): Der Oberkörper hebt sich um 1 px (die dunkle Gürtelzeile 18 wird einmal doppelt eingefügt: Brust, Hand
  und Kopf steigen, die Beine bleiben). Der Kopf läuft 4 Frames nach und steigt um ein weiteres px (Halszeile 14 verlängert) —
  insgesamt hebt sich der Kopf 0–2 px. Der Bogen steht fest (die Hand rutscht am Griff 1 px mit).
* Ohrenzucken: rechtes Ohr Frames 22–26 (Spitze (17,8) → (17,9), zweimal), linkes Ohr Frames 8–10 (Keil (0,8) → (0,9)); beide
  Umrisse bleiben 4-verbunden.
* Blinzeln (Frames 15–17): das offene linke Auge schließt sich über eine Zwischenstufe zum Strich wie das zwinkernde rechte.
* Pfeil funkelt (Frames 27–34): ein kleiner Glanzklecks (Punkt → 2×2 → Punkt, keine Kreuzform) schwebt mit 1 px Abstand über der
  Pfeilspitze; danach gleitet die weiße Kante der Spitze zweimal eine Diagonale tiefer und zurück.
* Haarglanz (Frames 2–9): ein heller Glanzpunkt wandert über den Haarscheitel (y 5) von links nach rechts.
Frame 0 = Original (Ruhepose); Kontrolle per anim_humanoide.ruhepose.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine nötig (Kopf/Hand fahren ohne Lücke, der Bogen bleibt stehen). Einzige neu gesetzte Pixel: Ohrspitzen (17,9)/(0,9)
in Umrissfarbe (49,24,0) und das schwebende Funkeln über dem Pfeil. Unter der Hand wird beim Atmen Zeile 19 statt Zeile 18 verdoppelt.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 40, 90
PAD_L, PAD_R, PAD_T, PAD_B = 4, 5, 9, 3

spr = L.lade('elven-archer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# Farben des Sprites
HAUT, SCHWARZ, HELLBLAU, WEISS = (246, 205, 139), (0, 0, 0), (172, 213, 255), (246, 255, 255)
UMRISS, HELLGELB = (49, 24, 0), (255, 246, 172)

# Teile: der Bogen steht fest, alles andere (Körper samt Kopf, Ohren, Pfeil) wird bewegt
bogen = vorhanden & (xx >= 2) & (xx <= 4) & (yy >= 7) | ((xx == 3) & (yy == 6))
koerper = vorhanden & ~bogen

# Blinzeln des offenen linken Auges: offen (6,9) schwarz, (6,10) Iris, (7,10) Pupille, (6,11) Glanz, (7,11) rotbraun.
# zu = Strich auf Zeile 11 wie beim zwinkernden rechten Auge (10–11, 11), darüber Haut.
AUGE_HALB = {(6, 9): HAUT, (6, 11): SCHWARZ}
AUGE_ZU = {(6, 9): HAUT, (6, 10): HAUT, (7, 10): HAUT, (6, 11): SCHWARZ, (7, 11): SCHWARZ}
# Ohren zucken nach unten (Spitze 1 px tiefer); die Umrisse bleiben 4-verbunden:
# rechts (17,8) → (17,9) (hängt über das schon vorhandene (16,9) an (16,8)); links (0,8) → (0,9) (hängt an (1,9))
OHR_R_RUNTER = {(17, 8): None, (17, 9): UMRISS}
OHR_L_RUNTER = {(0, 8): None, (0, 9): UMRISS}
# Arrow-Glanz: die weiße Kante gleitet diagonal von oben links nach unten rechts
PFEIL_D1 = [(15, 0), (14, 1), (13, 2)]; PFEIL_D2 = [(15, 1), (14, 2), (13, 3)]; PFEIL_D3 = [(14, 3), (13, 4)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def frame(i):
    k = teil(koerper)
    b = teil(bogen)
    # --- Pixel-Ereignisse am Körper (vor dem Atmen, damit sie mit dem Kopf steigen) ---
    bl = Hm.folge(i, 15, [AUGE_HALB, AUGE_ZU, AUGE_HALB], N)
    if bl:
        Hm.setze(k, bl, OFF)
    if Hm.folge(i, 22, [1, 1, 0, 1, 1], N):
        Hm.setze(k, OHR_R_RUNTER, OFF)
    if Hm.folge(i, 8, [1, 1, 1], N):
        Hm.setze(k, OHR_L_RUNTER, OFF)
    # Haarglanz: ein heller Punkt wandert über (5..12, 5)
    g = Hm.folge(i, 2, list(range(8)), N)
    if g is not None:
        Hm.setze(k, {(5 + g, 5): HELLGELB}, OFF)
    # Pfeilspitze: die weiße Kante gleitet eine Diagonale tiefer (2 Stufen), davor/danach ein Funkeln darüber
    w = Hm.folge(i, 30, [0, 1, 2, 1, 0], N)
    if w:
        Hm.setze(k, {**{p: HELLBLAU for p in PFEIL_D1}, **{p: (WEISS if w == 1 else HELLBLAU) for p in PFEIL_D2},
                     **{p: (WEISS if w == 2 else HELLBLAU) for p in PFEIL_D3}}, OFF)
    s = Hm.folge(i, 27, [1, 2, 2, 1], N)
    if s:
        Hm.klecks(k, 17, -3 if s == 2 else -2, s, WEISS, HELLBLAU, OFF)     # schwebt frei, 1 px Abstand zur Spitze
    # --- Atmen ---
    brust = Hm.stufe(i, N, 1)
    kopf = Hm.stufe(i - 4, N, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 14, brust, kopf)
    if brust:
        # Unter der Hand (x 5–7) soll nicht der dunkle Handumriss (Zeile 18) doppelt stehen, sondern der Saum (Zeile 19) —
        # die eingefügte Zeile 18 wird dort mit der Zeile 19 überschrieben (Hand bleibt einfach hoch, Umriss einfach dick).
        k[PAD_T + 18, PAD_L + 5:PAD_L + 8] = k[PAD_T + 19, PAD_L + 5:PAD_L + 8]
    return L.zusammen(H, W, [(k, 0, 0), (b, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('elven-archer', 'Elven Archer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-archer-strip.png', frames, spalten=10, scale=6)
