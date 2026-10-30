# -*- coding: utf-8 -*-
"""Idle-Animation für „Creepy Villager“ (Creature) — der unheimliche Dörfler mit der bleichen, blau bemalten Glatze und den leeren weißen Augen.

Quelle: src/creepy-villager.png (12×21 px, 22 Farben).
PICK: [["MotiveDeepsea", 276, 1]]      (Ebene „Gloomy Villager“, Figur 1; in 2 Karten)

Aufruf:   python3 creepy_villager.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/creepy-villager.png + .json

Was im Sprite ist (x, y im 12×21-Sprite):
* KOPF (x 1–10, y 0–10): glatzköpfig, bleiche Haut B (188,172,154)/M (209,196,181)/J (159,146,129) mit blauer Bemalung/Flecken E (77,137,154) und D (51,93,119) auf Stirn und Wangen; schwarzer Umriss
  C (22,22,22). Brauen/Lider als schwarze Balken G (0,0,0) bei (3–4, 4), (7–8, 4) und (3–4, 6), (7–8, 6); darunter leere weiße Augen (P (185,187,187), Q (228,238,238)) bei (3–4, 7) und (7–8, 7);
  Nase M (5–6, 7); Mund/Kinn dunkelgrau L/N (4–7, 9); Hals (5–6, 10).
* KÖRPER (x 0–10, y 11–17): olivgrünes Hemd F (65,75,47)/I (93,104,70)/K (44,51,31) mit dunklem Gürtel (y 14); linker Arm (x 0–2, y 11–14) blau bemalt E/D, rechter Arm nur als dunkler Umriss mit Hand (10,14)
  (188,172,154) und (9,11) (159,146,129).
* BEINE/STIEFEL (y 18–20): braune Stiefel (S (51,38,31), O (77,59,53), T (138,118,104), J (159,146,129)) mit Umriss H (28,19,18).
Kein Metall, Gold oder Edelstein → KEIN Glanz (Regel 14); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos; bewusst ruckelig-unheimlich):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Hemdzeile 16, glatt, wird einmal doppelt eingefügt: Oberkörper, Arme und Kopf steigen, Stiefel bleiben), der Kopf läuft 3 Frames nach und hebt sich um
  ein weiteres px (Halszeile 10 wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–17) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Stiefel bleiben stehen.
* Kopfzucken: der Kopf (Zeilen 0–9) zuckt kurz (je 2 Frames) 1 px zur Seite: nach links (Frames 14–15 und 44–45), nach rechts (Frames 26–27) — ein ruckartiges, unheimliches Zucken (4-verbunden über den Hals).
* Arme schwingen: der linke Arm (Zeilen 12–14) spreizt sich 1 px nach außen (Frames 2–9 und 22–33), der rechte (Frames 24–33 und 40–45); nie in derselben Richtung wie die Gewichtsverlagerung.
* Blinzeln (Frames 16–19 und 38–41, langsam): die weißen Augen schließen sich — die vier Augenpixel (3–4, 7), (7–8, 7) nehmen die umgebende Hautfarbe (188,172,154) an; schwarze Lider bleiben.
  Kein Farbtausch, kein Augenglanz.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Gewichtsverlagerung/Armspreizung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('creepy-villager')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(3, 5)                                                      # B (188,172,154), Lidfarbe
KOPF_UMRISS, KOERPER_UMRISS = f(1, 0), f(0, 6)                      # C (22,22,22), A (28,23,18)
AUGEN = [(3, 7), (4, 7), (7, 7), (8, 7)]

arm_l = vorhanden & (xx <= 2) & (yy >= 12) & (yy <= 14)
arm_r = vorhanden & (xx >= 9) & (yy >= 12) & (yy <= 14)
rumpf = vorhanden & ~arm_l & ~arm_r


def frame(i):
    t, _ = L.trenne(spr, rumpf)
    k = L.platz(t, H, W, PAD_L, PAD_T)
    tl, _ = L.trenne(spr, arm_l)
    al = L.platz(tl, H, W, PAD_L, PAD_T)
    tr, _ = L.trenne(spr, arm_r)
    ar = L.platz(tr, H, W, PAD_L, PAD_T)
    # --- Blinzeln (langsam, 4 Frames) ---
    if Hm.folge(i, 16, [1, 1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    # --- Kopfzucken (Zeilen 0–9, je 2 Frames) ---
    kz = -1 if (Hm.folge(i, 14, [1, 1], N) or Hm.folge(i, 44, [1, 1], N)) else (1 if Hm.folge(i, 26, [1, 1], N) else 0)
    if kz:
        Hm.bereich_versatz(k, OFF, {y: kz for y in range(0, 10)}, -2, sw + 1)
    # --- Arme schwingen (nach außen) ---
    dl = 1 if (Hm.folge(i, 2, [1] * 8, N) or Hm.folge(i, 22, [1] * 12, N)) else 0
    dr = 1 if (Hm.folge(i, 24, [1] * 10, N) or Hm.folge(i, 40, [1] * 6, N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(12, 15)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(12, 15)}, 'r')
    # --- Gewichtsverlagerung (Zeilen 0–17 samt Armen) ---
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 18)}, -2, sw + 1)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(12, 15)}, -2, sw + 1)
    # --- Auf und ab: Hemdzeile 16 = Brust (alle Ebenen), Halszeile 10 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 16, PAD_T + 10, brust, kopf)
    al = Hm.atmen(al, PAD_T + 16, PAD_T + 10, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 16, PAD_T + 10, brust, 0)
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf → C, Körper → A)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = KOPF_UMRISS if y - PAD_T < 10 else KOERPER_UMRISS
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
    L.speichern('creepy-villager', 'Creepy Villager', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/creepy-villager-strip.png', frames, spalten=12, scale=6)
