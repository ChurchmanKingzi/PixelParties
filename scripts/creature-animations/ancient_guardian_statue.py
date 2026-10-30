# -*- coding: utf-8 -*-
"""Idle-Animation für „Ancient Guardian Statue“ (Creature) — der steinerne Wächterkopf mit Helm und goldenen Augen.

Quelle: src/ancient-guardian-statue.png (20×24 px, 9 Farben).
PICK: [["MotiveSteamDwarfs", 268, 1]]      (Ebene „Ancient Guard Statues“, Figur 1; Figur 2 derselben Ebene ist pixelgleich — die Karte zeigt beide Statuen)
Abgleich mit der Kartenkunst Ancient_Guardian_Statue.png (76×51): Sprite sitzt dort zweimal, bei (1,17) und bei (55,17), je 100 % Pixeltreffer (nächstbester Treffer 39 %). Auf der Karte stehen außerdem
Steinmauern und eine Treppe (Hintergrund), nichts davon gehört zur Figur. Weil beide Statuen dasselbe Bild sind, gibt es keine Alternative.

Aufruf:   python3 ancient_guardian_statue.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ancient-guardian-statue.png + .json

Was im Sprite ist (x, y im 20×24-Sprite):
* HELM (y 0–13): Stein in (51,43,45)/(81,69,71)/(113,96,88)/(136,116,105)/(162,137,126)/(198,168,154), Kamm oben, Seiten- und Bandzeilen; Unterkante y 12–13.
* AUGEN (y 15–16): zwei goldene Augen in dunklen Höhlen (51,43,45): links (4–7,15) und (5–7,16), rechts (12–15,15) und (12–14,16), Gold (147,122,30)/(205,170,42) mit hellem Kern (230,209,135).
* GESICHT (y 17–23): Wangen, Nase und Mundgitter in denselben Steinfarben, Kinn y 23.
Metall/Gold/Edelsteine im Sprite: nur die goldenen Augen. Sie bleiben farblich unverändert (kein Pulsieren, Regel „kein Augenglanz“); sie schließen sich nur beim Blinzeln und blicken zur Seite. Kein Feuer, kein
Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Helm hebt sich (Periode 24): die Bandzeile 12 wird einmal doppelt eingefügt, der Helm steigt 1 px über das Gesicht, Gesicht und Kinn bleiben stehen: 0 → 1 → 0 px.
* Helm gleitet seitlich: der Helm (Zeilen 0–13) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45), das Gesicht darunter bleibt — Stein, der aneinander reibt.
* Kamm wackelt: der Kamm (Zeilen 0–5) rückt 1 px nach rechts (Frames 24–29), getrennt vom Gleiten (kein Stapeln).
* Blick: beide Augen wandern gemeinsam 1 px nach rechts (Frames 3–8) und 1 px nach links (Frames 26–31), jeweils innerhalb der dunklen Augenhöhle.
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — die 14 Goldpixel nehmen die Höhlenfarbe (51,43,45) an (Lid = umgebende Körperfarbe). Kein Farbtausch, kein Leuchten.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 2          # Figur knapp zugeschnitten: Helmgleiten ±1 px seitlich, Helmhub 1 px oben, Randabstand ≥ 2

spr = L.lade('ancient-guardian-statue')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # nur (51,43,45) — alle Randpixel sind Umriss
HOEHLE = f(3, 15)                                                   # (51,43,45): dunkle Augenhöhle = Lid
AUGEN = {(4, 15): f(4, 15), (5, 15): f(5, 15), (6, 15): f(6, 15), (7, 15): f(7, 15), (5, 16): f(5, 16), (6, 16): f(6, 16), (7, 16): f(7, 16),
         (12, 15): f(12, 15), (13, 15): f(13, 15), (14, 15): f(14, 15), (15, 15): f(15, 15), (12, 16): f(12, 16), (13, 16): f(13, 16), (14, 16): f(14, 16)}

helm = vorhanden & (yy <= 13)
gesicht = vorhanden & (yy >= 14)


def ebene(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


def augen_setzen(a, dx):
    """Augen um dx px verschoben (dx = 0: Original); der alte Platz wird Höhlenfarbe."""
    Hm.setze(a, {p: HOEHLE for p in AUGEN}, OFF)
    Hm.setze(a, {(x + dx, y): c for (x, y), c in AUGEN.items()}, OFF)


def frame(i):
    hl, gs = ebene(helm), ebene(gesicht)
    # --- Augen: Blinzeln (zu) bzw. Blick nach rechts/links ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(gs, {p: HOEHLE for p in AUGEN}, OFF)
    elif Hm.folge(i, 3, [1] * 6, N):
        augen_setzen(gs, 1)
    elif Hm.folge(i, 26, [1] * 6, N):
        augen_setzen(gs, -1)
    # --- Kamm wackelt (Zeilen 0–5) und Helm gleitet (Zeilen 0–13) in getrennten Zeitfenstern ---
    if Hm.folge(i, 24, [1] * 6, N):
        Hm.bereich_versatz(hl, OFF, {y: 1 for y in range(0, 6)}, -2, sw + 1)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(hl, OFF, {y: gv for y in range(0, 14)}, -2, sw + 1)
    # --- Helm hebt sich: Bandzeile 12 doppelt, Gesicht bleibt ---
    hl = Hm.atmen(hl, PAD_T + 12, PAD_T + 5, Hm.stufe(i, N / 2, 1), 0)
    fig = L.zusammen(H, W, [(gs, 0, 0), (hl, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = (51, 43, 45)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('ancient-guardian-statue', 'Ancient Guardian Statue', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/ancient-guardian-statue-strip.png', frames, spalten=12, scale=6)
