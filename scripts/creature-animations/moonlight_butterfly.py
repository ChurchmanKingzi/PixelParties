# -*- coding: utf-8 -*-
"""Idle-Animation für „Moonlight Butterfly“ (Creature).

PICK: [["Motive", 643, 2]]
Quelle: src/moonlight-butterfly.png — Ebene „Moonlight Butterfly“ (21×20 px, 7 Farben) aus Motive.xcf, Figur 2 (auf der Karte schon in diesen Blautönen).

Aufruf:   python3 moonlight_butterfly.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/moonlight-butterfly.png + .json

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 10):
* Schmetterling von oben, nur 7 Blautöne: Umriss (62,143,173) (A), mittlere Töne (91,208,252)/(112,214,252)/(164,228,252), helle Flecken (207,240,252)/(215,248,254)
  und Weiß (255,255,255) als Flügelzeichnung (Augenflecken/Schuppenmuster).
* Obere Flügel (x 0–19, y 0–10): große Flügel, Spitzen oben links (1–4, 0) und rechts (16–19, 0), helle Zeichnung bei (2–6, 2–8) und gespiegelt.
* Untere Flügel (x 0–20, y 11–19): kleiner, hängen nach außen unten, Spitzen unten bei (4–6, 19) und (14–16, 19).
* Körper (x 9–11, y 5–16): schmale Mittelsäule — Kopf/Brust (y 5–8, oben Umriss), Hinterleib (y 9–15) in (112,214,252), unten offen (Mittelpixel (10,16) leer).
* Es gibt keine Fühler im Sprite (nichts ergänzt).

Ablauf (40 Frames à 70 ms = 2,8 s):
* Flügelschlag: viermal pro Schleife (Periode 10 Frames) klappen die Flügel zur Körpermitte zu und wieder auf (Zeilen um x = 10 gestaucht, Faktor bis 0,5, Nächster-Nachbar,
  keine Textur kopiert). Der Faktor läuft mit Verzögerung von oben nach unten durch den Flügel: die oberen Flügel schlagen vor, die unteren hinterher (Welle),
  linker und rechter Flügel leicht gegeneinander versetzt. Ruhepose = ganz aufgeklappt = Original.
* Körper bleibt fest in der Mitte (Säule x 9–11) und liegt über den Flügeln; hebt sich beim Zuklappen um bis 2 px, dazu langsame Seitenwippe (±1 px, Periode 20).
* Mondstaub (Partikel): zehn kleine runde helle Punkte steigen langsam auf und schwanken (Formen k, s). Kein Glanz/Glitzer (Schuppen sind kein Metall).

Ergänzungen: keine nötig — die Flügel überdecken den Körper nicht (er liegt als Säule dazwischen). Beim Zuklappen schieben sich die inneren Flügelränder unter den Körper (er wird obenauf gelegt).
Randpixel-Test (Regel 16): Spaltenstauchung kann an der Außenkante Innenfarbe freilegen; solche Randpixel werden in Umrissblau (62,143,173) gesetzt (F.umranden).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 16, 9

spr = L.lade('moonlight-butterfly')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS_BLAU = (62, 143, 173)
UMRISS = F.umriss_farben(spr)
koerper = vorhanden & (xx >= 9) & (xx <= 11) & (yy >= 5) & (yy <= 16)
fluegel = vorhanden & ~koerper
ACHSE = PAD_L + 10                                           # Körpermitte (Leinwand-Spalte)


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


MONDSTAUB = {'c': (255, 255, 255), 'r': (164, 228, 252)}
MONDSTAUB2 = {'c': (215, 248, 254), 'r': (91, 208, 252)}
PUFFS1 = puffs([(3, 2, -1, -12, 0, 'k', 2), (17, 2, 1, -12, 8, 's', 2), (10, 4, 0, -13, 16, 'k', 2), (-1, 12, -2, -11, 24, 's', 2), (21, 12, 2, -11, 32, 'k', 2)])
PUFFS2 = puffs([(6, 1, -1, -12, 4, 'k', 2), (14, 1, 1, -12, 12, 'k', 2), (4, 14, -1, -10, 20, 'k', 2), (16, 14, 1, -10, 28, 'k', 2), (10, 8, 0, -12, 36, 'k', 2)])


def frame(i, partikel=True):
    ph = L.sinus(i, N / 4)                                    # viermal pro Schleife
    bob = int(round(-1.8 * (1 - math.cos(ph)) / 2 * 1.0))     # beim Zuklappen hebt sich der Körper (0 … −2), Frame 0 = Ruhe

    s_l = np.ones(H)
    s_r = np.ones(H)
    for y in range(sh):
        frac = y / (sh - 1.0)
        for (arr, versatz) in ((s_l, 0.0), (s_r, 0.0)):             # links und rechts GLEICH (synchron, spiegelsymmetrisch)
            w0 = (1 - math.cos(-1.1 * frac - versatz)) / 2    # Ruhelage dieser Zeile (Frame 0 → Faktor 1)
            w1 = (1 - math.cos(ph - 1.1 * frac - versatz)) / 2
            arr[PAD_T + y] = min(1.0, 1.0 - 0.5 * (w1 - w0))
    fl = F.ebene(spr, fluegel, H, W, PAD_L, PAD_T)
    # linke Hälfte (x < Achse) und rechte Hälfte getrennt stauchen
    links = fl.copy(); links[:, int(ACHSE):] = 0
    rechts = fl.copy(); rechts[:, :int(ACHSE)] = 0
    links = F.zeilen_stauchen(links, ACHSE, s_l, symmetrisch=True)
    rechts = F.zeilen_stauchen(rechts, ACHSE, s_r, symmetrisch=True)
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    f = L.zusammen(H, W, [(links, 0, 0), (rechts, 0, 0), (kp, 0, 0)])
    # nur senkrechtes Heben der ganzen Figur (symmetrisch) — keine Seitenwippe
    f = L.versetze(f, 0, bob)
    # Randpixel-Test (Regel 16): freigelegte Innenfarbe an der Außenkante → Umrissblau
    F.umranden(f, [f], UMRISS, UMRISS_BLAU, UMRISS_BLAU, UMRISS_BLAU)
    if partikel:
        stau = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, MONDSTAUB), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, MONDSTAUB2), 0, 0)])
        f = L.zusammen(H, W, [(stau, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('moonlight-butterfly', 'Moonlight Butterfly', frames, MS, prev)
    if prev:
        L.streifen(prev + '/moonlight-butterfly-strip.png', frames, spalten=8, scale=6)
