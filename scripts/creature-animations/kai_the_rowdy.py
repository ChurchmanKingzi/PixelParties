# -*- coding: utf-8 -*-
"""Idle-Animation für „Kai, the Rowdy“ (Creature) — der Rowdy mit den roten Stachelhaaren, dem blauen Stirnband, der Neon-Jacke und dem Brecheisen quer vor dem Körper.

Quelle: src/kai-the-rowdy.png (26×27 px, 47 Farben).
PICK: [["MotiveArcanum", 179, 1]]      (Ebene 179, Figur 1; nur in dieser Karte; 88 % Übereinstimmung mit der Kunst, weil der Sack davor (Ebene 178) und das Mädchen daneben (Ebene 177, anderes Wesen) die Figur
überdecken — die Ebene selbst ist vollständig, auch Beine und Stiefel)
Ebene 178 (Jutesack, 15×15) und Ebene 177 (das orangehaarige Mädchen) sind Beiwerk der Kunst und nicht im Sprite.

Aufruf:   python3 kai_the_rowdy.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/kai-the-rowdy.png + .json

Was im Sprite ist (x, y im 26×27-Sprite):
* HAARE (x 3–13, y 0–6): rote Stachelhaare (Dunkelrot (97,0,0) … Rot (140,8,8), schwarze Schatten), Spitze (8,0).
* STIRNBAND (y 7–8): blaues Band (0,35,104)/(26,111,247) mit hellen Lichtern.
* GESICHT (y 9–13): gebräunte Haut (227,163,35)/(238,190,104)/(241,204,140); zwei Augen: hellblaue Iris (172,213,255) bei (7,10) und (12,10) mit weißem Pixel darunter ((7,11) und (12,11)), braune Lider/Wimpern (6,10–11), (8,10–11), (11,10–11), (13,10–11).
* JACKE (y 14–23): schwarz/dunkelgrau (33,35,32), (44,45,43), (61,63,60), mit blauem Kragen (0,35,104) bei (8–11, 15–16) und Neon-Limettenstreifen (182,255,0)/(222,255,74), dunkelgrüne Abnäher (79,108,5);
  Hände in Hautfarbe (227,163,35)/(232,182,83) bei (3–4, 17–18) und (14–15, 17).
* BRECHEISEN (Stahl: Umriss (38,49,49), Grau (80,82,79) < (120,127,135) < (151,159,167)): quer vor dem Körper (x 5–22, y 18–20), rechts in einem Haken nach oben (x 20–25, y 12–19), links schräg nach unten
  (x 0–4, y 19–23).
* STIEFEL (y 24–26): rotbraune Stiefel (122,42,17)/(90,32,1) mit schwarzem Umriss (10,12,8).
Metall im Sprite: nur das Brecheisen (Regel 14: nur das glänzt; Haare, Haut, Stoff nicht). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Jackensaum-Zeile 23, dunkel und glatt, wird einmal doppelt eingefügt: Jacke, Arme, Hände und Kopf steigen, Stiefel bleiben; das Brecheisen
  hebt sich starr mit den Händen um 1 px), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Halszeile 13 wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust/Brecheisen 0 → 1 → 0.
* Haarspitzen wehen: die obersten drei Haarzeilen (0–2) neigen sich 1 px nach links (Frames 6–11) und nach rechts (Frames 28–33); die Spitze (8,0) bleibt über ihrem Stachel.
* Gewichtsverlagerung: der Oberkörper samt Brecheisen (Zeilen 0–23) schiebt sich 1 px nach rechts (Frames 12–23) und später 1 px nach links (Frames 36–47); Stiefel bleiben stehen.
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — Iris und Weiß ((7,10), (7,11), (12,10), (12,11)) nehmen die umgebende Hautfarbe (238,190,104) an, die braunen Lider bleiben.
  Kein Farbtausch, kein Augenglanz.
* Stahl glänzt (Regel 12/14: nur das Brecheisen): ein Lichtband läuft zweimal pro Schleife diagonal über das Eisen (Frames 5–18 und 29–42; 1–2 Stufen heller auf der Rampe des Sprites, nur Innenpixel), dazu ein
  vierzackiger Glitzer-Stern an der Hakenspitze (Frames 22–25) und am linken Eisenende (Frames 44–47).
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter die Jacke (Frames 14–21), später der rechte (Frames 38–45).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter der Jacke).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('kai-the-rowdy')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(8, 12)                                                     # (238,190,104), Lidfarbe
HAAR_UMRISS, KOERPER_UMRISS, EISEN_UMRISS = f(5, 12), f(5, 22), f(5, 18)   # (0,2,0), (10,12,8), (38,49,49)
STAHL = [(38, 49, 49), (80, 82, 79), (120, 127, 135), (151, 159, 167)]
WEISS, HELL, MITTEL = f(7, 11), (151, 159, 167), (120, 127, 135)
AUGEN = [(7, 10), (7, 11), (12, 10), (12, 11)]

stange = np.zeros((sh, sw), bool)
for _y in range(sh):
    for _x in range(sw):
        if vorhanden[_y, _x] and f(_x, _y) in STAHL:
            stange[_y, _x] = True
fuss_l = vorhanden & ~stange & (xx <= 9) & (yy >= 24)
fuss_r = vorhanden & ~stange & (xx >= 10) & (yy >= 24)
rumpf = vorhanden & ~stange & ~fuss_l & ~fuss_r
KANTE0 = Hm.kantenmaske(spr)
m_stahl = stange & ~KANTE0 & np.array([[f(x, y) != STAHL[0] if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)])


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k, st = ebene(rumpf), ebene(stange)
    gl = L.leer(H, W)                                               # Glitzer-Sterne (Effekt über der Figur)
    # --- Blinzeln ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    # --- Stahl glänzt (Lichtband über das Brecheisen) ---
    for start in (5, 29):
        Hm.lichtband(st, m_stahl, OFF, i, N, start, 14, STAHL, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Haarspitzen wehen (Zeilen 0–2) ---
    hs = -1 if Hm.folge(i, 6, [1] * 6, N) else (1 if Hm.folge(i, 28, [1] * 6, N) else 0)
    if hs:
        Hm.bereich_versatz(k, OFF, {0: hs, 1: hs, 2: hs}, 2, 15)
    # --- Gewichtsverlagerung (Oberkörper Zeilen 0–23 samt Brecheisen) ---
    gv = 1 if Hm.folge(i, 12, [1] * 12, N) else (-1 if Hm.folge(i, 36, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 24)}, -2, sw + 1)
        st = L.versetze(st, gv, 0)
    # --- Auf und ab: Jackensaum 23 = Brust (Brecheisen starr mit), Hals 13 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 23, PAD_T + 13, brust, kopf)
    if brust:
        st = L.versetze(st, 0, -brust)
    # --- Glitzer-Sterne am Brecheisen (mit Eisen mitbewegt) ---
    for (sx, sy, start) in ((23, 14, 22), (1, 22, 44)):
        sstufe = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx + gv, sy - brust, sstufe, WEISS, HELL, MITTEL, OFF)
    # --- Fußtippen (die Stiefel liegen hinter der Jacke) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 14, pat, N) else 0
    hr = 1 if Hm.folge(i, 38, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0), (st, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Haare → Schwarz, Eisen → Eisenumriss, Körper → Stiefel-/Jackenumriss)
    kk = Hm.kantenmaske(fig)
    stahl_alle = set(STAHL)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = EISEN_UMRISS if c in stahl_alle else (HAAR_UMRISS if y - PAD_T < 14 else KOERPER_UMRISS)
    return L.zusammen(H, W, [(fig, 0, 0), (gl, 0, 0)])


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
    L.speichern('kai-the-rowdy', 'Kai, the Rowdy', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/kai-the-rowdy-strip.png', frames, spalten=12, scale=5)
