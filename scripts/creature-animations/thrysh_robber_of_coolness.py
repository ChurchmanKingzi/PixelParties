# -*- coding: utf-8 -*-
"""Idle-Animation für „Thrysh, Robber of Coolness“ (Creature) — der blaue Eisriese mit Sonnenbrille, Eiskrone, Goldkette und Beutelchen, der vor seinem Eisthron steht.

Quelle: src/thrysh-robber-of-coolness.png (45×46 px, 18 Farben).
PICK: [["MotiveCoolhalla", 142, 1]]      (Ebene „Ebene #86“ (xcf-Ebene 142), Figur 1: Riese UND Eisthron sind in der Ebene zusammenhängend und werden hier getrennt behandelt.)
Abgleich mit der Kartenkunst Thrysh_Robber_of_Coolness.png (76×51): Riese und Thron sitzen dort vollständig; der braune Felsen und der Schnee der Kunst sind Kulisse. Die Quelle war vollständig.

Aufruf:   python3 thrysh_robber_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/thrysh-robber-of-coolness.png + .json

Was im Sprite ist (x, y im 45×46-Sprite):
* ISTHRON (weiß/hellblau (255,255,255)/(215,227,250)/(199,210,232)): zwei hohe Eisscherben links (x 0–9) und rechts (x 35–44), eine Rückwand hinter dem Riesen (ab y ≈ 11) und der Boden (y 44–45); die Lücke zwischen
  Arm und Hüfte (x 15–21, y 18–24) und zwischen den Beinen (x 17–27, y 38–45) zeigt den Thron. Eis bleibt fest (kein Glanz, Regel 14).
* RIESE (Blautöne (14,44,102)…(176,190,218)): Eiskrone mit drei Zacken (x 23/27/32, y 0–6), Gesicht (y 6–12) mit schwarzer SONNENBRILLE (0,0,0) mit grauen Linsenpunkten (74,74,74) bei (24–25,8) und (29–30,8) (Brille blinzelt nicht),
  breite Schultern (y 10–14), linker Arm in die Hüfte gestützt (Ellbogen x 9–13, y 17–24), rechter Arm angewinkelt am Kinn (x 33–37, y 10–26), Beine breitbeinig (y 26–43) mit Füßen y 41–44.
* GOLDKETTE (251,242,54) von (22,11) schräg bis (25,16) und (27–28,16), daran ein braunes BEUTELCHEN (Riemen (138,34,0) bei (26,16–19), Beutel (138,34,0)/(71,17,0)/(165,78,27) bei (23–28, 20–22) mit goldenen Münz-
  pixeln (255,231,153)/(228,162,78)) — Gold: Lichtband + Glitzerstern.
Kein Feuer. Der Riese ist ein Humanoider: Kopf bewegt sich nicht seitlich (Regel 17).

Ablauf (60 Frames à 80 ms = 4,8 s, nahtlos; schwerer Riese, langsam):
* ATMEN zweistufig (Regel 13): erst steigt die Brust (eine Schienbeinzeile 35 wird 0–2× eingefügt, Texturmischung — Beine unterhalb und Füße bleiben), danach (6 Frames Nachlauf) hebt sich der Kopf mit den Schultern 1 px mehr
  (Schulterzeile 14 wird 0–1× eingefügt). Der Thron bleibt fest; was der Riese freigibt (Unterkanten von Armen, Hüftlücke), wird aus dem Thron ergänzt: hinter dem Riesen ab y ≥ 11 liegt eine weiße Rückwand (255,255,255).
* GLANZ (Gold, Regel 12): Lichtband über Kette und Münzpixel (Frames 30–41) und ein Glitzerstern an der Kette bei (24,15) (Frames 34–37).
* KALTER DUNST: vier kleine Wölkchen (2×2 → 3×3 → 2×2, Farben (215,227,250)/(199,210,232)) steigen langsam an den Thronscherben links und rechts auf (Überstand ≤ 2 px).
Frame 0 = Original. Der Thron wird nie bewegt.
Ergänzungen: Rückwand hinter dem Riesen: alle Pixel, die im Sprite vom Riesen bedeckt sind und bei y ≥ 11 liegen, bekommen als Hintergrundebene Weiß (255,255,255) — sichtbar nur, wenn sich der Riese hebt.
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L

N, MS = 60, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('thrysh-robber-of-coolness')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
EIS = [(255, 255, 255), (215, 227, 250), (199, 210, 232)]
THRON_M = C.maske_farben(spr, EIS, ohne_rand=False)
RIESE_M = L.deckend(spr) & ~THRON_M
HINTEN = np.zeros((sh, sw), bool)
HINTEN[11:, :] = True
HINTEN &= RIESE_M
GOLD = [(228, 162, 78), (251, 242, 54), (255, 231, 153), (255, 255, 255)]
GOLD_M = C.maske_farben(spr, GOLD[:3], ohne_rand=False) & RIESE_M
GOLD_M &= ~C.maske_farben(spr, [(255, 255, 255)], ohne_rand=False)
WOLKE = {'c': (215, 227, 250), 'r': (199, 210, 232)}
WOLKEN = [dict(s=2, L=34, x0=6, y0=41, x1=5, y1=33, wackeln=1.0), dict(s=26, L=34, x0=39, y0=40, x1=40, y1=32, wackeln=-1.0),
          dict(s=14, L=34, x0=3, y0=34, x1=2, y1=26, wackeln=0.8), dict(s=22, L=34, x0=42, y0=33, x1=41, y1=25, wackeln=-0.8)]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    riese = np.zeros_like(spr)
    riese[RIESE_M] = spr[RIESE_M]
    g = L.platz(riese, H, W, PAD_L, PAD_T)
    thron = np.zeros_like(spr)
    thron[THRON_M] = spr[THRON_M]
    thron[HINTEN] = (255, 255, 255, 255)
    t = L.platz(thron, H, W, PAD_L, PAD_T)
    # --- Glanz auf Kette und Münzen ---
    C.glanz(g, OFF, i, N, GOLD_M, GOLD, start=30, dauer=12, stufen=1, breite=2.6, kern=2)
    C.funkel(g, OFF, i, 24, 15, 34, [0, 1, 1, 0], (255, 255, 255), (255, 231, 153), N)
    # --- Atmen: Brust (Schienbeinzeile 35), danach Kopf/Schultern (Zeile 14) ---
    n1 = Hm.stufe(i, N, 2)
    n2 = Hm.stufe(i - 6, N, 1)
    g = L.streck_zeile(g, PAD_T + 35, n1)
    if n2:
        g = L.streck_zeile(g, PAD_T + 14 - n1, n2)
    fig = L.zusammen(H, W, [(t, 0, 0), (g, 0, 0)])
    if nur == 'koerper':
        return fig
    return L.zusammen(H, W, [(fig, 0, 0), (C.wolken(H, W, i, N, WOLKEN, WOLKE, OFF), 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('thrysh-robber-of-coolness', 'Thrysh, Robber of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
