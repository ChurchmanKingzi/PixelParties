# -*- coding: utf-8 -*-
"""Idle-Animation für „Phatnir, Prototype of Coolness“ (Creature) — der Roboter-Wolf (Fenrir-Prototyp) mit goldener Irokesen-Krone, roten Augen, Goldkette und goldenem Brustzeichen.

Quelle: src/phatnir-prototype-of-coolness.png (33×34 px, 15 Farben).
PICK: [["MotiveCoolhalla", 202, 2]]      (Ebene „Ebene #82“ (xcf-Ebene 202), Figur 2; Figur 1 derselben Ebene ist ein Himmelsfetzen. Ebene 201 „#84“ zeigt denselben Roboter mit weißen Augen und einer Träne
                                          — eine Ausdrucks-Variante, ungenutzt.)
Abgleich mit der Kartenkunst Phatnir_Prototype_of_Coolness.png (76×51): Sprite sitzt dort vollständig; Fackeln, Flaggen, Regenbogen sind Kulisse. Die Quelle war vollständig.

Aufruf:   python3 phatnir_prototype_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/phatnir-prototype-of-coolness.png + .json

Was im Sprite ist (x, y im 33×34-Sprite):
* KRONE / IROKESE (x 11–21, y 0–4): goldene Zacken J (254,245,142)/G (255,216,79) mit braun-goldenem Mittelstreifen C (92,44,6)/K (160,101,0) — Gold.
* HELM/GESICHT (x 9–23, y 4–14): grauer Stahlhelm B (82,81,82)/D (128,126,128)/E (151,149,151)/F (206,207,206), schwarzes Visier (0,0,0), zwei ROTE LEUCHTAUGEN (164,0,0) bei (13,10) und (19,10),
  schwarzer Rachen mit hellem Gebiss F bei (15–17, 11–15).
* BRUSTZEICHEN (x 13–20, y 15–20): goldenes Emblem (K/G/J) auf Schwarz — Gold.
* SCHULTERN/ARME (x 8–25, y 12–24): graue Panzerplatten; GOLDKETTE (C/J/G/K) hängt von den Schultern (x 7–9 / 23–27) und bildet unten ein V (x 10–23, y 25–30) mit der Spitze bei (16–18, 29–30).
* DÜSEN-KLAUEN (x 3–8 und 25–29, y 22–33): schwarze Schubdüsen/Fäuste (26,26,26)/(51,51,51) mit je zwei goldenen Stacheln (x 0–3 bzw. 29–32, y 25 und 28) — Gold.
Metall (grauer Stahl) und Gold glänzen (Regel 12/14); keine Edelsteine, kein Feuer.

Runde 3 — Nutzerwunsch: „soll sich nicht das Goldene auf seinem Kopf unabhängig von ihm bewegen! Seine Goldkette hat teilweise Lücken, und die Räder sollen sich genauso drehen wie beim Coreling.“
Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; ein schwerer Roboter: ruhig, aber nie starr):
* ATMEN/SUMMEN (einmal je Schleife): die glatte untere Brustplattenzeile 23 wird 0–2× eingefügt (Texturmischung): Kopf, Krone, Schultern, Brustzeichen und oberer Kettenteil heben sich starr bis 2 px,
  Kettenspitze, Räder und Boden bleiben stehen. (Einfügen an der Schulterzeile 13 hätte den schwarzen Rachen und das Kinn verlängert.) Die Krone bewegt sich dabei NUR mit dem Kopf (starr).
  Die Goldkette läuft durch die Einfügezeile: dort wird sie NICHT texturgemischt, sondern pixelgenau kopiert (die Texturmischung hatte Kettenpixel durch Grau ersetzt = Lücken); zusätzlich prüft das Skript in jedem Frame,
  dass die Kette genauso viele zusammenhängende Teile hat wie im Original.
* RÄDER DREHEN (wie beim Coreling, Technik aus coreling.py): die schwarzen Räder links (x 3–8) und rechts (x 24–29) haben je zwei goldene Radspikes (Original bei Zeile 25 und 28, drei Zeilen Abstand). Sie wandern zyklisch von oben nach unten am Rad entlang
  (ein Schritt = 1 Zeile alle 2 Frames, 6 Schritte = 1 Umdrehung = 12 Frames, 4 Umdrehungen je Schleife; beide Räder gleich schnell, beide Spikes eines Rads um 3 Schritte versetzt): oben wachsen sie aus dem Rad heraus (nur der Ansatz),
  unten tauchen sie wieder ein und verschwinden; oben beginnt der nächste. Die Spikes sind die Originalpixel (obere Form für Zeilen 24–26, untere Form für 27–29); die vom Spike im Original verdeckten Radpixel
  ((3,25) (3,26) (3,28) (4,28) (4,29) und gespiegelt) sind mit den Radfarben aus den Nachbarzeilen gefüllt, wenn kein Spike dort steht. Ersetzt den früheren „Stachelpuls“.
* LEUCHTAUGEN-BLINZELN (Frames 9–10 und 33–35): die roten Pixel werden schwarz (Visierfarbe).
* GLANZ: Lichtband über den grauen Stahl (Frames 2–17, ohne Außenkante), Lichtband über das Gold (Frames 26–41); kurze Glitzersterne: Krone (13,2) Frames 28–31, Brustzeichen (14,17) Frames 33–36,
  Kettenglied rechts (24,17) Frames 38–41.
ENTFALLEN gegenüber Runde 2: das Kronenflattern (die Außenzacken der Krone bewegten sich unabhängig vom Kopf), das Schwingen der Kettenspitze (riss Lücken in die Kette) und der Stachelpuls (durch die drehenden Räder ersetzt).
Frame 0 = Original (Ruhepose). Alle Bewegungen laufen auf der vollen Leinwand; nur Farben der Quelle.
Ergänzungen: nur die Radfüllung (siehe oben) und die pixelgenauen Kettenkopien in den Atem-Einfügezeilen.
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 3

spr = L.lade('phatnir-prototype-of-coolness')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
f = lambda x, y: C.farbe(spr, x, y)

GOLD = [(92, 44, 6), (160, 101, 0), (255, 216, 79), (254, 245, 142)]
GRAU = [(51, 51, 56), (82, 81, 82), (113, 112, 113), (128, 126, 128), (151, 149, 151), (185, 186, 185), (206, 207, 206)]
GRAU = [c for c in GRAU if c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}]
GOLD_M = C.maske_farben(spr, GOLD, ohne_rand=False)
GRAU_M = C.maske_farben(spr, GRAU, ohne_rand=True)
SCHWARZ = f(10, 9)                                                    # (0,0,0) Visier
AUGEN = {(13, 10): SCHWARZ, (19, 10): SCHWARZ}
J, G = (254, 245, 142), (255, 216, 79)
FH, FI = (206, 207, 206), (185, 186, 185)

# ── Räder (Runde 3): Spikes wandern von oben nach unten, wie beim Coreling ──
SPIKE_SCHRITT, SPIKE_ZYKLUS = 2, 6
SPIKE_START = (1, 4)                                                                   # Positionsindex bei Schritt 0 (Zeilen 25 und 28 = Original); Position p = Zeile 24 + p
SP_UP = {(0, 25), (1, 25), (2, 25), (3, 25), (2, 26), (3, 26)}                          # Originalspike oben (links), obere Zeile 25
SP_LO = {(1, 28), (2, 28), (3, 28), (4, 28), (3, 29), (4, 29)}                          # Originalspike unten (links), obere Zeile 28
K_, I_, M_ = (26, 26, 26), (0, 0, 0), (51, 51, 51)
RAD_FUELL = {(3, 25): K_, (3, 26): I_, (3, 28): I_, (4, 28): K_, (4, 29): I_}           # vom Spike verdeckte Radpixel (links); (x, y) im Sprite
for _p in SP_UP | SP_LO:
    assert spr[_p[1], _p[0], 3], _p
for _p, _c in RAD_FUELL.items():
    assert _p in SP_UP | SP_LO
SPX = {(x, y): f(x, y) for (x, y) in SP_UP | SP_LO}


def _spiegel(p):
    return (32 - p[0], p[1])


def spike_pixel(y_top):
    """Pixel (x, y, Farbe) eines linken Spikes mit oberer Zeile y_top (24…29): obere Form (Zeilen ≤ 26), untere Form (≥ 27); oben knospt er (nur der Ansatz), unten taucht er ein."""
    if y_top <= 26:
        dy, form, y0 = y_top - 25, SP_UP, 25
    else:
        dy, form, y0 = y_top - 28, SP_LO, 28
    pix = sorted(((x, y + dy, SPX[(x, y)]) for (x, y) in form), key=lambda t: (t[1], t[0]))
    if y_top == 24:                                                                     # knospt aus dem Rad: nur die zwei innersten Pixel der oberen Zeile
        row0 = [p for p in pix if p[1] == y_top]
        return sorted(row0, key=lambda t: -t[0])[:2]
    if y_top == 29:                                                                     # taucht wieder ein: obere Zeile ohne das äußerste Pixel, untere Zeile bleibt
        row0 = [p for p in pix if p[1] == y_top]
        rest = [p for p in pix if p[1] != y_top]
        return sorted(row0, key=lambda t: t[0])[1:] + rest
    return pix


def raeder(k, i):
    """Räder mit drehenden Spikes auf die Leinwand k (in Sprite-Koordinaten + OFF) legen: Originalspikes entfernen, verdeckte Radpixel füllen, Spikes an ihren Stellen des Zyklus zeichnen."""
    s_ = (i // SPIKE_SCHRITT) % SPIKE_ZYKLUS
    for mir in (False, True):
        sp = _spiegel if mir else (lambda p: p)
        for p in SP_UP | SP_LO:
            q = sp(p)
            k[q[1] + OFF[1], q[0] + OFF[0]] = 0
        for p, c in RAD_FUELL.items():
            q = sp(p)
            k[q[1] + OFF[1], q[0] + OFF[0], :3] = c
            k[q[1] + OFF[1], q[0] + OFF[0], 3] = 255
        for p0 in SPIKE_START:
            for (x, y, c) in spike_pixel(24 + (p0 + s_) % SPIKE_ZYKLUS):
                X, Y = (32 - x if mir else x) + OFF[0], y + OFF[1]
                k[Y, X, :3] = c
                k[Y, X, 3] = 255
    return k


# ── Goldkette: Maske der Kettenpixel (ohne Krone, Brustzeichen, Spikes) ──
KETTE = C.maske_farben(spr, [(92, 44, 6), (160, 101, 0), (255, 216, 79), (254, 245, 142)], ohne_rand=False)
KETTE[:16, :] = False                                                                  # Krone und Helm
KETTE[:, :6] = False                                                                   # Radspikes links
KETTE[:, 27:] = False                                                                  # Radspikes rechts
KETTE[22:, 5:9] &= False                                                               # Spikebasis am Rad
KETTE[15:21, 12:21] = False                                                            # Brustzeichen
TEST_EBENEN = None


def frame(i, nur=None):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Glanz: Stahl und Gold ---
    C.glanz(k, OFF, i, N, GRAU_M, GRAU, start=2, dauer=16, stufen=1, breite=3.0)
    C.glanz(k, OFF, i, N, GOLD_M, GOLD, start=26, dauer=16, stufen=1, breite=3.0, kern=2)
    # --- Leuchtaugen blinzeln ---
    if Hm.folge(i, 9, [1, 1], N) or Hm.folge(i, 33, [1, 1, 1], N):
        Hm.setze(k, AUGEN, OFF)
    # --- Räder drehen (Runde 3): Spikes wandern von oben nach unten ---
    raeder(k, i)
    # --- Atmen: glatte Brustplattenzeile 23 (Gesicht und Rachen werden nicht gedehnt); Krone, Kopf, Schultern und Kette heben sich starr ---
    z = PAD_T + 23
    vorher = k[z].copy()
    n = Hm.stufe(i, N, 2)
    k = TX.atmen(k, z, z, n, 0)
    if n:                                                                               # die Kette läuft durch die Einfügezeilen: dort pixelgenau kopieren (keine Texturmischung → keine Lücken)
        for j in range(z - n, z + 1):
            for x in np.nonzero(KETTE[23] & (vorher[OFF[0]:OFF[0] + sw, 3] > 0))[0]:
                k[j, OFF[0] + x] = vorher[OFF[0] + x]
    # --- Glitzersterne (kurz, Gold): Krone, Brustzeichen, Kettenglied rechts — nach dem Atmen, damit sie auf dem gehobenen Objekt sitzen ---
    dy = n
    C.funkel(k, (OFF[0], OFF[1] - dy), i, 13, 2, 28, [0, 1, 1, 0], J, G, N)
    C.funkel(k, (OFF[0], OFF[1] - dy), i, 14, 17, 33, [0, 1, 1, 0], J, G, N)
    C.funkel(k, (OFF[0], OFF[1] - dy), i, 24, 17, 38, [0, 1, 1, 0], J, G, N)
    return k


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('phatnir-prototype-of-coolness', 'Phatnir, Prototype of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
