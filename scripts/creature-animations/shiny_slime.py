# -*- coding: utf-8 -*-
"""Idle-Animation für „Shiny Slime“ (Creature).

PICK: [["Motive", 465, 1]]
Quelle: src/shiny-slime.png — Ebene „Shiny Slime“ (18×19 px, 21 Farben) aus Motive.xcf.

Aufruf:   python3 shiny_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shiny-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Krone, Zeilen 0–7: drei Zacken (Spitzen bei x 4–5, 8–9, 12–13), rotes Kreuz-Juwel (x 7–10, y 1–4), weißes Hermelinband
  (y 6–7, Endpunkte (4,6) und (13,6) sind weiß). Starres Teil, ohne Umriss nach unten — sie sitzt auf der Kopfoberkante (y 8).
* Schleimkörper, Zeilen 8–18: goldener Gelkörper mit dunklem Umriss (96,83,0); oben Kopfglanz (8–9, 8); Augen = gelbe Flecken
  (5–6, 10–11) und (11–12, 10–11) mit weißem Lichtpunkt (6,11)/(11,11) und dunkler Außenseite (4,10–11)/(13,10–11), Schatten
  darunter (5,12)/(12,12); bleichgrüner „Glaskern“ zwischen den Augen (x 6–11, y 9–13); Mund = dunkles Band (6–10, 14) mit
  Schatten (7–10, 15), schiefer Mundwinkel (11,13); unten die breite Schleimpfütze (y 14–18) mit hellen Glanzflecken
  (4–6, 16), (10–11, 17), (11, 15).
Fest bleiben (Bedeutung ungesichert oder Teil des Körpers): Glaskern, Mundwinkel, Kreuz-Juwel, Pfützenrand.

Ablauf (40 Frames à 75 ms = 3,0 s, nahtlos):
* Atmen (Frames 0–19, 32–39): Der Körper streckt sich um 1 Zeile (Zeile 12 wird verdoppelt: Augen heben sich, Krone steigt)
  bzw. staucht sich um 1 Zeile (Zeile 12 fällt weg, der Körper wird je Seite 1 px breiter).
* Hüpfer (Frames 20–31): Anlauf-Stauchung (−1, −2), Absprung gestreckt (+2), Aufstieg bis 3 px, Scheitel, Fallen gestreckt,
  Aufprall (−2: 2 Zeilen weniger, je Seite 2 px breiter), Nachfedern.
  Squash & Stretch: Zeilen 12 und 9 werden verdoppelt/entfernt; dazu je Zeile Spalten verdoppelt (Mitte, 8/9, 7/10) bzw. entfernt
  (3/14 am Rand zur Wange). Umriss und Augen werden nie verdoppelt, der Umriss wandert unverändert nach außen/innen.
* Wabbeln: Der Kopf lehnt sich 1–2 px nach links/rechts (Zeilen 8–13 mit abnehmendem Versatz, Pfütze fest; Zeilen mit schrägem
  Umriss teilen sich den Versatz mit der Nachbarzeile, damit keine Umrisslücke entsteht) — im Leerlauf langsam (Periode 20 Frames),
  nach der Landung schnell und abklingend.
* Krone: starr; sie folgt dem Kopf seitlich exakt und sinkt beim Absprung (22–23) und beim Aufprall (28) 1 px in den Kopf.
* Blinzeln: Frames 8–10 und 34–36 (Lid oben → Augenlinie → Lid oben).
* Lichtreflex: Frames 2–15 wandert ein diagonales Glanzband über Krone und Körper (Goldtöne eine bzw. zwei Stufen heller,
  Farben der Sprite-Rampe E→C→B→D→G).
* Goldstaub (Partikel, Farben des Sprites): vier winzige runde Glitzerpunkte steigen langsam neben Krone und Körper auf
  (wachsen/schrumpfen, hinter der Figur).
Ergänzungen: keine (alle Teile bleiben über Kanten verbunden; Krone und Kopf überlappen nur oder liegen genau aufeinander).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 40, 75
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 8, 3

spr = L.lade('shiny-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1                      # Leinwandzeile der Körper-Unterkante im Ruhezustand
KOERPER_Y0 = 8                              # erste Körperzeile im Sprite (darüber: Krone)

# ── Farben der Quelle ──
GOLD_E, GOLD_C, GOLD_B, GOLD_D, GOLD_G = (143, 132, 4), (152, 141, 26), (170, 161, 58), (184, 176, 86), (229, 227, 144)
DUNKEL_F = (79, 75, 14)                      # Augenlinie (Außenseite der Augen)
WEISS = (255, 252, 255)
RAMPE = {GOLD_E: GOLD_C, GOLD_C: GOLD_B, GOLD_B: GOLD_D, GOLD_D: GOLD_G}
for c in list(RAMPE) + list(RAMPE.values()) + [DUNKEL_F, WEISS]:
    assert c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, f'Farbe {c} nicht im Sprite'

AUGEN_L, AUGEN_R = [(5, 10), (6, 10), (5, 11), (6, 11)], [(11, 10), (12, 10), (11, 11), (12, 11)]

# ── Zeitachsen (Frame → Wert) ──
S = [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0,          # Atmen
     -1, -2, 2, 2, 1, 0, 1, 2, -2, -1, 1, 0,                                  # Hüpfer
     0, 0, 1, 1, 0, 0, 0, 0]                                                  # Ausklingen
LIFT = {22: 1, 23: 2, 24: 3, 25: 3, 26: 2, 27: 1}
SINK = {22, 23, 28}                                                           # Krone sinkt 1 px in den Kopf
BLINZELN = {8: 1, 9: 2, 10: 1, 34: 1, 35: 2, 36: 1}                           # 1 = Lid halb, 2 = zu
GLANZ = {i: 4 + 2 * (i - 2) for i in range(2, 16)}                            # Frame → Diagonale x+y des Lichtbands
assert len(S) == N

# Körperzeilen: Index 0 = Sprite-Zeile 8 … 10 = Zeile 18
GEWICHT = [1.0, 1.0, 0.8, 0.6, 0.4, 0.2, 0, 0, 0, 0, 0]
POSEN = {                                                                      # s → (löschen, doppeln, p)
    -2: ({1, 4}, (), 2), -1: ({4}, (), 1), 0: ((), (), 0), 1: ((), {4}, 0), 2: ((), {1, 4}, -1),
}
PAARE_BREIT = ((8, 9), (7, 10), (6, 11))
PAARE_SCHMAL = ((3, 14), (4, 13))
PAARE_ZEILE0 = [(5, 12), (6, 11)]                                              # Kopfzeile: neben dem Glanz (8,9)


def lehnen(i):
    """Seitliche Neigung des Kopfes (in Pixeln an der Oberkante, vor dem Runden)."""
    if i < 20:
        v = 1.0 * math.sin(2 * math.pi * i / 20)
    elif i < 32:
        v = 0.0
        if i >= 28:
            k = i - 28
            v = 1.6 * (1 - k / 12) * math.sin(2 * math.pi * k / 8)
    else:
        k = i - 28
        v = 1.6 * (1 - k / 12) * math.sin(2 * math.pi * k / 8)
    return max(-2.4, min(2.4, v))


def sprite_mit_augen(i):
    """Sprite mit Blinzeln und Lichtreflex (Quellkoordinaten), vor dem Umbau."""
    sp = spr.copy()
    b = BLINZELN.get(i, 0)
    if b:
        for (x, y) in AUGEN_L + AUGEN_R:
            if y == 10:
                sp[y, x, :3] = GOLD_B
            elif b == 2:
                sp[y, x, :3] = DUNKEL_F
    if i in GLANZ:
        t = GLANZ[i]
        sp = A.glanzband(sp, t, RAMPE, breite=2)
        sp = A.glanzband(sp, t, RAMPE, breite=1)
    return sp


GLITZER = [
    dict(x=PAD_L - 2, y=PAD_T + 12, vx=-1, vy=-7, off=0, form='s', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 9, vx=1, vy=-7, off=10, form='s', wackeln=1),
    dict(x=PAD_L - 1, y=PAD_T + 4, vx=-2, vy=-6, off=5, form='s', wackeln=1),
    dict(x=PAD_L + 17, y=PAD_T + 2, vx=2, vy=-6, off=15, form='s', wackeln=1),
]
STAUB = {'c': WEISS, 'r': GOLD_G}


def figur(i):
    """Körper + Krone (ohne Partikel) → (Frame, Körperebene, Körperoberkante)."""
    sp = sprite_mit_augen(i)
    s = S[i]
    loesch, dopp, p = POSEN[s]
    koerper = A.zeilen_von(sp, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p,
                               paare=PAARE_BREIT if p >= 0 else PAARE_SCHMAL,
                               paare_je_zeile={0: PAARE_ZEILE0}, x0=PAD_L)
    lean = lehnen(i)
    dxq = A.dx_zeilen(GEWICHT, lean, math.pi / 2)                              # sin(π/2) = 1 → round(lean · Gewicht)
    z = A.verschiebe_zeilen(z, quelle, dxq)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    # Krone: Zeilen 0–7 des Sprites; Unterkante liegt auf top−1 (bzw. top bei Einsinken)
    kr = L.platz(np.where((np.arange(sh)[:, None, None] < KOERPER_Y0), sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    kr = L.versetze(kr, dxq[0], top - KOERPER_Y0 - PAD_T + (1 if i in SINK else 0))
    return L.zusammen(H, W, [(kb, 0, 0), (kr, 0, 0)]), kb, top


def frame(i):
    fig, _, _ = figur(i)
    staub = L.puff_ebene(H, W, i, 20, GLITZER, STAUB)
    return L.zusammen(H, W, [(staub, 0, 0), (fig, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)[0] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    # Ruhepose = Original (Frame 0 ohne Partikel)
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    assert (figs[0] == ref).all(), 'Frame 0 weicht vom Original ab'
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    A.ausdruck_pruefen(figs, spr, 'shiny-slime', erlaubt=[GOLD_G])   # G: Glanzband hellt Kronenränder auf
    L.speichern('shiny-slime', 'Shiny Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shiny-slime-strip.png', frames[::2], spalten=10, scale=5)
