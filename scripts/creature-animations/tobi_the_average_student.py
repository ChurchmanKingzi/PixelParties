# -*- coding: utf-8 -*-
"""Idle-Animation für „Tobi, the Average Student“ (Creature) — der Schüler mit den blonden Stachelhaaren, der dunklen Neon-Jacke und dem schwebenden Fragezeichen.

Quelle: src/tobi-the-average-student.png (16×40 px, 35 Farben): die ganze Ebene „Tobi“ (zwei Figuren derselben Ebene mit ihrer Originallage: oben das Fragezeichen, darunter der Schüler).
PICK: [["MotiveArcanum", 134, 2], ["MotiveArcanum", 134, 1]]      (Ebene „Tobi“, Figur 2 = Schüler (16×25), Figur 1 = Fragezeichen (10×14); nur in dieser Karte)

Aufruf:   python3 tobi_the_average_student.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tobi-the-average-student.png + .json

Was im Sprite ist (x, y im 16×40-Sprite):
* FRAGEZEICHEN (x 4–11, y 0–12): weißes Fragezeichen (255,255,255) als kleines Sprite (Bogen y 0–9, Punkt y 11–12), das über dem Kopf schwebt (3 Zeilen Abstand); gehört zur Figur („Tobi weiß es nicht“).
* HAARE (x 2–13, y 16–23): hellblonde Stachelhaare (H (245,246,128), I (255,255,197), C (211,212,51), J (178,180,0), B (158,156,0)); ein einzelner Haarstachel (Ahoge) bei (7,16).
* GESICHT (y 23–26): Haut G (248,188,119)/(252,231,214); zwei Augen: links 2×2 (5–6, 23–24) mit hellblauer Iris (172,214,255) (5,23), dunklem Pupillenpixel (38,71,99) (6,23), weißem Pixel
  (242,255,255) (5,24) und blauem Pixel (81,152,212) (6,24); rechts ein Auge (9, 23–24) mit hellblauer Iris und weißem Pixel plus blauem Pixel (10,24) (das rechte obere Pixel (10,23) ist Haar).
* JACKE (y 28–36): dunkelgrau-schwarze Schuluniform (F (44,45,43), N (61,63,60), P (33,35,32)) mit Neon-Limettenstreifen M (182,255,0)/O (222,255,74) und dunkelgrünen Abnähern A (79,108,5);
  Arme und Hände links (0–3, 30–33) und rechts (12–15, 30–33), Hände in Hautfarbe (248,188,119)/(213,164,100) bei (1–2,32) und (13–14,32).
* HOSE/SCHUHE (y 36–39): dunkle Hose, rotbraune Schuhe R (122,42,17)/(90,32,1) bei (4–5, 37) und (10–11, 37).
Kein Metall, Gold oder Edelstein im Sprite → KEIN Glanz (Regel 14; Haare glänzen nicht); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (die dunkle Jackensaumzeile 36 wird einmal doppelt eingefügt: Jacke, Arme, Kopf steigen, Beine/Schuhe bleiben), der Kopf läuft 3 Frames
  nach und hebt sich um ein weiteres px (Halszeile 26, glatte Haut, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Fragezeichen schwebt: es hebt und senkt sich zweimal pro Schleife um 1 px (Periode 24) und pendelt einmal pro Schleife 1 px nach links/rechts; es bleibt immer mindestens 1 px vom Kopf entfernt.
* Haarstachel wippt: der einzelne Stachel (7,16) kippt 1 px nach links (Frames 8–11) und rechts (Frames 30–33), bleibt über der Haarzeile 17.
* Gewichtsverlagerung: der Oberkörper (Zeilen 16–35 samt Armen) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Hose und Schuhe bleiben stehen.
* Arme schwingen: der linke Arm (Zeilen 30–33) spreizt sich 1 px nach außen (Frames 22–33), der rechte (Frames 2–9 und 46–47) — nie in derselben Richtung wie die Gewichtsverlagerung.
* Blinzeln (Frames 19–21 und 40–42): beide Augen schließen sich — Iris, Weiß und Blau nehmen die Hautfarbe (248,188,119) an, der dunkle Pupillenpixel (6,23) bleibt als Wimper. Kein Farbtausch, kein Augenglanz.
* Fußtippen: der linke Schuh hebt sich zweimal 1 px hinter die Hose (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; der Schuh liegt beim Heben hinter der Hose).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 2          # Figur knapp zugeschnitten: Armspreizung/Verlagerung ±1 px seitlich, Fragezeichen ±1 px oben, Randabstand ≥ 2

spr = L.lade('tobi-the-average-student')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(6, 25)                                                     # (248,188,119), Lidfarbe
HAAR_UMRISS, KOERPER_UMRISS = f(3, 21), f(3, 33)                    # Haarumriss (158,156,0), Körperumriss (10,12,8)
AUGEN_ZU = [(5, 23), (5, 24), (6, 24), (9, 23), (9, 24), (10, 24)]    # (6,23) bleibt als Wimper

frage = vorhanden & (yy <= 14)
arm_l = vorhanden & (xx <= 3) & (yy >= 30) & (yy <= 33)
arm_r = vorhanden & (xx >= 12) & (yy >= 30) & (yy <= 33)
fuss_l = vorhanden & (xx >= 3) & (xx <= 6) & (yy >= 37)
fuss_r = vorhanden & (xx >= 9) & (xx <= 12) & (yy >= 37)
rumpf = vorhanden & ~frage & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k = ebene(rumpf)
    al, ar = ebene(arm_l), ebene(arm_r)
    # --- Blinzeln: Augenpixel nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN_ZU}, OFF)
    # --- Haarstachel wippt ---
    hs = -1 if Hm.folge(i, 8, [1] * 4, N) else (1 if Hm.folge(i, 30, [1] * 4, N) else 0)
    if hs:
        Hm.bereich_versatz(k, OFF, {16: hs}, 6, 8)
    # --- Arme schwingen ---
    dl = 1 if Hm.folge(i, 22, [1] * 12, N) else 0
    dr = 1 if (Hm.folge(i, 2, [1] * 8, N) or Hm.folge(i, 46, [1, 1], N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(31, 34)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(31, 34)}, 'r')
    # --- Gewichtsverlagerung (Zeilen 16–35 samt Armen) ---
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(16, 36)}, -2, sw + 1)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(30, 34)}, -2, sw + 1)
    # --- Auf und ab: Jackensaum 36 = Brust (alle Ebenen), Hals 26 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 36, PAD_T + 26, brust, kopf)
    al = Hm.atmen(al, PAD_T + 36, PAD_T + 26, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 36, PAD_T + 26, brust, 0)
    # --- Fußtippen (der Schuh liegt hinter der Hose) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    # --- Fragezeichen schwebt (nur 0 oder 1 px hoch, ±1 px seitlich) ---
    hoch = int(round(Hm.welle01(i, N / 2)))
    seit = int(round(math.sin(L.sinus(i, N))))
    q = ebene(frage, -hoch)
    if seit:
        Hm.bereich_versatz(q, OFF, {y: seit for y in range(-2, 15)}, -2, sw + 1)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Haare → Haarumriss, Körper → Schwarzgrau)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 27 else KOERPER_UMRISS
    return L.zusammen(H, W, [(fig, 0, 0), (q, 0, 0)])


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
    L.speichern('tobi-the-average-student', 'Tobi, the Average Student', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tobi-the-average-student-strip.png', frames, spalten=12, scale=5)
