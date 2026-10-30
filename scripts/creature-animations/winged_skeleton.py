# -*- coding: utf-8 -*-
"""Idle-Animation für „Winged Skeleton“ (Creature).

PICK: [["Motive", 297, 1]]
Quelle: src/winged-skeleton.png — Ebene „Winged Skele“ (20×24 px, 17 Farben) aus Motive.xcf, Figur 1.

Aufruf:   python3 winged_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/winged-skeleton.png + .json

Identifikation (x, y; Figur ist spiegelsymmetrisch um x = 9,5, Spiegel x ↔ 19 − x):
* Skelett von vorn, braune (49,24,0) Umrisse/Bandagen, Knochen weiß/hellgrau.
  - Schädel: Stirn (8–11, 4), weiße Schädelkappe (7–12, 5), schräge dunkle Augenhöhlen (7–8, 6–8) / (11–12, 6–8), brauner
    Oberrand (7–12, 3), Seitenumriss braun bei x = 5 / 14 (y 7–9).
  - Rippenkorb / Wirbelsäule (y 10–14, x 5–14): schwarze Lücken (6,10), (7,11), (9–10, 11–12), (12,11), (13,10) zwischen den Rippen.
  - Becken und Beine (y 15–22), Zehen tan (5–6, 22) / (13–14, 22).
* Flügel/Arm-Bänder links (x 1–4, y 5–19) und rechts (x 15–18): senkrechte Streifen aus grauer Außenkante (x 1), zwei weißen Knochen/
  Falten und braunen Binden, unten Hand mit tan Fingern (1–3, 15–18) und brauner Manschette; oben setzen sich die Flügel als
  dunkle Krallenspitzen (3–7, 0–4) fort, deren Innenkante (6, 2–4) knapp neben dem Schädeloberrand liegt. Die Bänder liegen NEBEN dem Körper
  (Trennlinie: brauner Umriss bei x = 5 / 14), nirgends darüber; unten ist zwischen Hand und Becken eine Lücke (x = 5, y 15–17).

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügel spreizen sich: zweimal pro Schleife klappen die beiden Bänder nach außen auf (Zeilenversatz wächst mit dem Abstand zur
  Pivotzeile 14: Krallenspitzen oben bis 2 px, Hand unten bis 1 px) und wieder an — Ruhe = angelegt = Original. Die Zeilen wandern
  ganze Zeilen, der Anschluss an Zeile 14 bleibt stehen.
* Rippenkorb atmet: einmal pro Schleife wird Zeile 13 (nur Rippen, keine Lücken) verdoppelt; Schädel und Krallenspitzen heben sich
  dabei starr mit, die Füße bleiben am Boden. Körper UND Bänder werden gemeinsam gestreckt (nichts doppelt gezeichnet, was woanders bewegt wird).
* Knochenstaub (Partikel): wenige graue Staubkörner rieseln langsam von den Flügelenden (Klekse/Funken, wachsen und schrumpfen).

Ergänzungen: keine nötig — Körper und Bänder überlappen sich im Original nirgends (Körper allein: Umriss ringsum geschlossen,
siehe Kontrollbild). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 5, 8

spr = L.lade('winged-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Masken: Bänder (Flügel/Arm) links und rechts, Rest = Körper ──────────────────────────────────────────────────────
band_l = vorhanden & (((yy <= 2) & (xx <= 7)) | ((yy >= 3) & (yy <= 4) & (xx <= 6)) | ((yy >= 5) & (yy <= 17) & (xx <= 4))
                      | ((yy >= 18) & (yy <= 19) & (xx <= 3)))      # Zeile 18–19: x = 4 ist schon das Bein (Umriss), nicht Hand/Flügel
band_r = vorhanden & band_l[:, ::-1]                                           # Spiegel x ↔ 19 − x
assert not (band_l & band_r).any()
koerper = vorhanden & ~band_l & ~band_r
# Symmetrie-Kontrolle: Form (Alpha) des Sprites ist spiegelsymmetrisch
assert (vorhanden == vorhanden[:, ::-1]).all()

STAUB = {'c': (213, 213, 213), 'r': (156, 156, 156)}


def px(x, y):
    return PAD_L + x, PAD_T + y


PUFFS = [
    dict(x=px(0, 19)[0], y=px(0, 19)[1], vx=-1, vy=7, off=0, form='s', wackeln=1),
    dict(x=px(19, 19)[0], y=px(19, 19)[1], vx=1, vy=7, off=12, form='s', wackeln=1),
    dict(x=px(2, 17)[0], y=px(2, 17)[1], vx=-1, vy=6, off=6, form='k', wackeln=1),
    dict(x=px(17, 17)[0], y=px(17, 17)[1], vx=1, vy=6, off=18, form='k', wackeln=1),
]


def frame(i, partikel=True):
    ph = L.sinus(i, N / 2)
    s = (1 - math.cos(ph)) / 2                                # 0 … 1: Flügel spreizen sich, in Frame 0 angelegt
    atem = 1 if math.sin(L.sinus(i, N, -0.6)) > 0.2 else 0    # Rippenkorb atmet (eine Zeile)
    zeile = PAD_T + 13

    hand = int(round(1.2 * s))                                # Hand/Unterarm (Zeile ≥ 15) schwingt starr 0…1 px nach außen
    kopf_l = band_l & (yy <= 14)
    kopf_r = band_r & (yy <= 14)
    wl = F.zeilen_schub(F.ebene(spr, kopf_l, H, W, PAD_L, PAD_T), PAD_T + 14, -2.4, s, 1.3)
    wr = F.zeilen_schub(F.ebene(spr, kopf_r, H, W, PAD_L, PAD_T), PAD_T + 14, 2.4, s, 1.3)
    hl = L.versetze(F.ebene(spr, band_l & (yy >= 15), H, W, PAD_L, PAD_T), -hand, 0)
    hr = L.versetze(F.ebene(spr, band_r & (yy >= 15), H, W, PAD_L, PAD_T), hand, 0)
    wl = L.zusammen(H, W, [(wl, 0, 0), (hl, 0, 0)])
    wr = L.zusammen(H, W, [(wr, 0, 0), (hr, 0, 0)])
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wl, wr, kp = (L.streck_zeile(a, zeile, atem) for a in (wl, wr, kp))
    staub = L.puff_ebene(H, W, i, N, PUFFS, STAUB) if partikel else L.leer(H, W)
    return L.zusammen(H, W, [(staub, 0, 0), (wl, 0, 0), (wr, 0, 0), (kp, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('winged-skeleton', 'Winged Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/winged-skeleton-strip.png', frames, spalten=6, scale=8)
