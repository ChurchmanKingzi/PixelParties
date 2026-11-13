# -*- coding: utf-8 -*-
"""Idle-Animation für „Swagdri, Forger of Coolness“ (Creature) — der rotbärtige Zwerg mit Sonnenbrille, Kettenhemd und erhobenem Schmiedehammer, daneben sein Amboss.

Quelle: src/swagdri-forger-of-coolness.png (38×32 px, 29 Farben), aus vier xcf-Ebenen zusammengesetzt (Ebenen sitzen wie in der Kunst).
PICK: [["MotiveCoolhalla", 123, 1], ["MotiveCoolhalla", 124, 1], ["MotiveCoolhalla", 125, 1], ["MotiveCoolhalla", 138, 1]]
      (xcf-Ebenen „Ebene #104“ = erhobener Panzerhandschuh/Unterarm, „#103“ = Hammer (Kopf und Stiel), „#100“ = der Zwerg, „#91“ = Amboss; Rechteck x 208–246, y 201–233 der xcf. Nicht genutzt:
      Ebene 133/134/136/137 (#96/#97/#53/#92) sind weitere Posen: Hammer schräg, Zwerg seitlich, ein Strich.) Der Zwerg allein wäre zu wenig — Hammer und Amboss gehören in der Kunst zu ihm
      und liegen im xcf in derselben Ebenengruppe; Quelle vollständig. Kulisse (Zahnräder, Kisten, Eis) ist Hintergrund und nicht dabei.

Aufruf:   python3 swagdri_forger_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/swagdri-forger-of-coolness.png + .json

Was im Sprite ist (x, y im 38×32-Sprite):
* HAMMERKOPF (x 11–26, y 0–6): dunkler Stahl, Dithering aus (43,43,43)/(59,59,59)/(19,19,19) mit schwarzem Umriss — METALL.  HAMMERSTIEL (x 17–20, y 7–22): braunes Holz (40,24,3)/(62,36,5)/(77,45,6).
* ARM/HANDSCHUH (x 16–20, y 14–23): graues Kettenhemd (156,156,156)/(189,189,189)/(123,123,123)/(213,213,213), fasst den Stiel und läuft diagonal zur linken Schulter (20,22).
* AMBOSS (x 0–18, y 13–24): blaugrauer Stahl (139,155,180)/(90,105,136)/(58,68,102)/(38,43,68) mit Umriss (21,24,38) — METALL, steht am Boden.
* ZWERG (x 20–37, y 10–31): Haar/Zopfspitze (x 25–28, y 10–11) rot-orange (139,20,6)/(189,57,8)/(213,98,16) mit dunklem Umriss (41,8,0); Gesicht Haut (246,189,123)/(213,164,98) bei (24–29, 16–18);
  ein roter Pixel (197,32,41) bei (28,17) (Hautfleck/Mal — bleibt fest); SONNENBRILLE (x 20–32, y 19–20) schwarz mit grauen Glanzpixeln (38,38,38), zwischen den Gläsern der helle Nasenrücken (255,230,213) bei (26–27, 20)
  (Brille blinzelt nicht, Regel 21); BART (x 21–33, y 21–27) orange; Rüstung/Kettenhemd (x 20–37, y 21–31) in Grautönen, Gürtel schwarz (y 28), Beine y 29–31.
Metall (Hammerkopf, Amboss, Rüstung) glänzt (Regel 12/14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; der Zwerg ist klein — ruhig, aber nie starr):
* ATMEN (einmal je Schleife): die schwarze Gürtelzeile 28 wird einmal eingefügt (glatte Zeile): Kopf, Bart, Schultern steigen 1 px, Beine/Boden und Amboss bleiben.
* HAMMERARM: Hand, Stiel und Hammerkopf sind EINE Gruppe (Regel 28): sie steigt mit dem Atem und hebt sich zusätzlich zweimal je Schleife (Frames 13–23 und 37–47) 1 px (Hammer „wiegt“), so folgt die Waffe immer der Hand.
  Die Gruppe liegt vor Zwerg und Amboss; freigelegte Pixel darunter (Amboss-Rand bei (16–18, 14–16), Zwergen-Schulterkante bei (20, 17–22)) stammen aus den Quell-Ebenen (s. Ergänzungen).
* ZOPFSPITZE: die zwei obersten Haarpixel (26–27, 10) schwanken 1 px nach rechts (Frames 10–19) bzw. links (34–43) — an der Haarzeile 11 angeschlossen (4-verbunden).
* GLANZ: Lichtband über den Amboss (Frames 2–15) mit Stern auf der Ambossplatte (9,15) Frames 7–10; Lichtband über den Hammerkopf (Frames 20–33) mit Stern (13,3) Frames 26–29;
  Lichtband über das Kettenhemd des Zwergs (Frames 34–45).
Frame 0 = Original (Ruhepose).
Ergänzungen: aus den Quell-Ebenen (xcf 123–125, 138) wiederhergestellte, im Sprite vom Handschuh/Stiel verdeckte Pixel (x, y → Farbe): Amboss (16,14) B, (17,14) B, (16,15) D, (17,15) L, (18,15) B, (16,16) B, (17,16) B
  (Umriss (21,24,38) bzw. (90,105,136)/(38,43,68)); Zwerg-Schulterkante (20,17) (41,8,0), (20,18) (0,0,0), (20,19) (32,32,32), (20,20) (189,189,189), (20,21) (156,156,156), (20,22) (106,106,106).
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 3

spr = L.lade('swagdri-forger-of-coolness')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
f = lambda x, y: C.farbe(spr, x, y)

# --- Teile: Hammergruppe (Kopf, Stiel, Handschuh), Amboss, Zwerg ---
GRUPPE = np.zeros((sh, sw), bool)
GRUPPE[0:7, 11:27] = True
GRUPPE[7:23, 16:21] = True
GRUPPE[23, 19] = True
GRUPPE &= L.deckend(spr)
ANVIL_X = np.zeros((sh, sw), bool)
ANVIL_X[:, 0:19] = True
ANVIL_X &= L.deckend(spr) & ~GRUPPE
ZWERG_M = L.deckend(spr) & ~GRUPPE & ~ANVIL_X
ERG_AMBOSS = {(16, 14): (21, 24, 38), (17, 14): (21, 24, 38), (16, 15): (90, 105, 136), (17, 15): (38, 43, 68), (18, 15): (21, 24, 38), (16, 16): (21, 24, 38), (17, 16): (21, 24, 38)}
ERG_ZWERG = {(20, 17): (41, 8, 0), (20, 18): (0, 0, 0), (20, 19): (32, 32, 32), (20, 20): (189, 189, 189), (20, 21): (156, 156, 156), (20, 22): (106, 106, 106)}

RAMPE_AMBOSS = [(21, 24, 38), (38, 43, 68), (58, 68, 102), (90, 105, 136), (139, 155, 180)]
RAMPE_HAMMER = [(19, 19, 19), (32, 32, 32), (43, 43, 43), (59, 59, 59), (65, 65, 65), (106, 106, 106)]
RAMPE_RUESTUNG = [(32, 32, 32), (65, 65, 65), (106, 106, 106), (123, 123, 123), (156, 156, 156), (189, 189, 189), (213, 213, 213)]
M_AMBOSS = C.maske_farben(spr, RAMPE_AMBOSS[1:], region=(0, 13, 15, 24)) & ANVIL_X
M_HAMMER = C.maske_farben(spr, RAMPE_HAMMER, region=(11, 0, 26, 6)) & GRUPPE
M_RUESTUNG = C.maske_farben(spr, RAMPE_RUESTUNG, region=(20, 19, 37, 31)) & ZWERG_M
S_HELL, S_ARM, S_ARM2 = (213, 213, 213), (156, 156, 156), (189, 189, 189)
TEST_EBENEN = None


def teil(maske, erg=None):
    a = np.zeros_like(spr)
    a[maske] = spr[maske]
    a = L.platz(a, H, W, PAD_L, PAD_T)
    if erg:
        Hm.setze(a, erg, OFF)
    return a


def frame(i, nur=None):
    amboss = teil(ANVIL_X, ERG_AMBOSS)
    zwerg = teil(ZWERG_M, ERG_ZWERG)
    gruppe = teil(GRUPPE)
    # --- Glanz (Metall) ---
    C.glanz(amboss, OFF, i, N, M_AMBOSS, RAMPE_AMBOSS, start=2, dauer=14, stufen=1, breite=2.6, kern=2)
    C.funkel(amboss, OFF, i, 9, 15, 7, [0, 1, 1, 0], S_HELL, S_ARM2, N)
    C.glanz(gruppe, OFF, i, N, M_HAMMER, RAMPE_HAMMER, start=20, dauer=14, stufen=2, breite=3.0, kern=3)
    C.funkel(gruppe, OFF, i, 13, 3, 26, [0, 1, 1, 0], S_HELL, S_ARM, N)
    C.glanz(zwerg, OFF, i, N, M_RUESTUNG, RAMPE_RUESTUNG, start=34, dauer=12, stufen=1, breite=3.0, kern=2)
    # --- Zopfspitze ---
    dx = 1 if Hm.folge(i, 10, [1] * 10, N) else (-1 if Hm.folge(i, 34, [1] * 10, N) else 0)
    if dx:
        Hm.bereich_versatz(zwerg, OFF, {10: dx}, 26, 27)
        Hm.setze(zwerg, {(26, 11) if dx > 0 else (27, 11): f(25, 11)}, OFF)       # freigelegtes Haarpixel bekommt den dunklen Haarumriss (41,8,0)
    # --- Atmen: Gürtelzeile 28 (nur der Zwerg) ---
    n = Hm.stufe(i, N, 1)
    wieg = 1 if Hm.welle01(i - 6, 24) > 0.6 else 0
    if wieg:                                                        # Arm hebt sich: die Schulterkante (20,23) liegt frei und bekommt den Rüstungsumriss (32,32,32)
        Hm.setze(zwerg, {(20, 23): f(24, 27)}, OFF)
    zwerg = TX.streck_zeile(zwerg, PAD_T + 28, n)
    # --- Hammergruppe folgt der Hand: Atem + eigenes Wiegen ---
    dy = -(n + wieg)
    gruppe = L.versetze(gruppe, 0, dy) if dy else gruppe
    return L.zusammen(H, W, [(amboss, 0, 0), (zwerg, 0, 0), (gruppe, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('swagdri-forger-of-coolness', 'Swagdri, Forger of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
