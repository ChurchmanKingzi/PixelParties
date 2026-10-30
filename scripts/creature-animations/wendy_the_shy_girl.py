# -*- coding: utf-8 -*-
"""Idle-Animation für „Wendy, the Shy Girl“ (Creature) — das schüchterne Mädchen mit braunem Bob, rosa Wangen und gelbgrünem Oberteil, das hinter einer Säule hervorschaut.

Quelle: src/wendy-the-shy-girl.png (12×23 px, 23 Farben).
PICK: [["MotiveArcanum", 148, 1]]      (Ebene „Wendy“, ganze Ebene = eine Figur; die Säule davor ist die halbtransparente Ebene 147 „Ebene #33“, Deckkraft 80 %, gehört nicht zur Figur)
Abgleich mit der Kartenkunst Wendy_the_Shy_Girl.png (76×51): Sprite sitzt dort bei (32,16). Die Säule (Ebene 147) verdeckt 118 der 237 Pixel; die 119 sichtbaren Pixel stimmen zu 100 % mit der Kunst überein
(nächstbester Treffer 46 %). Auf der Karte stehen außerdem die Säule und der rote Vorhang daneben — beides gehört nicht zur Figur. (Im automatischen Treffervorschlag fehlte die Ebene, weil die Säule sie
zur Hälfte überdeckt; der Namensabgleich „Wendy“ in der xcf fand sie.)

Aufruf:   python3 wendy_the_shy_girl.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/wendy-the-shy-girl.png + .json

Was im Sprite ist (x, y im 12×23-Sprite):
* HAARE (y 0–11): brauner Pagenkopf (99,60,21)/(108,67,22)/(120,77,25)/(136,85,28)/(147,94,31)/(180,115,32), Umriss (78,48,12); Ponysträhnen über der Stirn, lange Seitensträhnen x 0–2 und 9–11 bis y 11.
* GESICHT (y 4–10): Haut (245,206,136)/(247,188,151)/(252,231,214); große Augen: weiße Pixel (248,254,255) bei (3,8) und (8,8), rötlich-braune Iris (149,64,24) bei (4,8) und (7,8) mit dunkler Iris-Oberseite
  (90,32,1) bei (4,7) und (7,7), Wimpern (65,55,4) bei (3,7), (8,7), (4,6), (7,6); rosa Wangen (255,149,149) bei (3,9) und (8,9).
* OBERTEIL (y 11–17): gelbgrün (222,255,74)/(158,181,53) mit dunkelgrauen Trägern (61,63,60)/(33,35,32); Hände (255,224,192)/(247,206,140) bei (1–2,15–16) und (7–8,15–16); schwarzer Saum y 18.
* BEINE/STIEFEL (y 19–22): Hautbeine (255,224,192)/(247,206,140) mit braunem Umriss (49,24,0), graue Stiefelspitzen (61,63,60)/(33,35,32), schwarze Sohle.
Metall/Gold/Edelsteine im Sprite: keine (Stoff, Haare, Haut). Also kein Glanz (Regel 14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (der schwarze Saum, Zeile 18, wird einmal doppelt eingefügt: Oberteil, Arme, Hände und Kopf steigen, Beine bleiben), der Kopf läuft 3 Frames nach
  und hebt sich um ein weiteres px (Kinnzeile 10): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–18) samt Haarsträhnen und Armen schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Beine und Stiefel bleiben stehen.
* Kopfneigen: Kopf und Haarsträhnen (Zeilen 0–10) neigen sich 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31) — das schüchterne Zur-Seite-Neigen.
* Haarsträhnen schwingen: die linke Seitensträhne (x 0–2, y 4–11) schwingt zweimal 1 px nach außen (Frames 14–19), die rechte später (Frames 38–43); die Zeile wird mit `Hm.rand_dehnen` gedehnt, innen
  bleibt alles am Kopf.
* Arme: der linke Arm (Zeilen 12–17) spreizt sich 1 px nach außen (Frames 22–33), der rechte (Frames 2–9 und 46–47).
* Händchen-Fummeln (schüchtern): die linke Hand (Frames 4–7) und die rechte Hand (Frames 28–31) rutschen 1 px hoch zur Brust (Spalte 1–2 bzw. 7–8, Zeilen 14–17: Hand, Hand, Umriss, Umriss statt Umriss, Hand, Hand, Umriss).
* Blinzeln (Frames 19–21 und 41–43): die Augenpixel (Weiß und Iris) nehmen die umgebende Hautfarbe an; die Wimpern bleiben als Lidlinie. Kein Farbtausch, kein Augenglanz, die Wangen bleiben unverändert.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter das Bein (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter den Beinen).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Strähne/Arm ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('wendy-the-shy-girl')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT_OBEN, HAUT_UNTEN = f(5, 7), f(4, 9)                            # (245,206,136) / (247,188,151): Lid = umgebende Hautfarbe
HAAR_UMRISS, KOERPER_UMRISS = f(0, 0), f(0, 11)                     # (78,48,12) / (2,5,1)
AUGEN = {(4, 7): HAUT_OBEN, (7, 7): HAUT_OBEN, (4, 8): HAUT_UNTEN, (7, 8): HAUT_UNTEN, (3, 8): HAUT_UNTEN, (8, 8): HAUT_UNTEN}

haar_l = vorhanden & (xx <= 2) & (yy >= 4) & (yy <= 11)
haar_r = vorhanden & (xx >= 9) & (yy >= 4) & (yy <= 11)
arm_l = vorhanden & (xx <= 2) & (yy >= 12) & (yy <= 17)
arm_r = vorhanden & (xx >= 9) & (yy >= 12) & (yy <= 17)
fuss_l = vorhanden & (xx <= 5) & (yy >= 21)
fuss_r = vorhanden & (xx >= 6) & (yy >= 21)
rumpf = vorhanden & ~haar_l & ~haar_r & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def hand_hoch(a, xs):
    """Hand in den Spalten xs rutscht 1 px nach oben (zur Brust): Zeilen 14–17 (Umriss, Hand, Hand, Umriss) → (Hand, Hand, Umriss, Umriss)."""
    for x in xs:
        Hm.setze(a, {(x, 14): f(x, 15), (x, 15): f(x, 16), (x, 16): f(x, 17), (x, 17): f(x, 14)}, OFF)


def frame(i):
    k, hl, hr, al, ar = ebene(rumpf), ebene(haar_l), ebene(haar_r), ebene(arm_l), ebene(arm_r)
    # --- Blinzeln: Weiß und Iris nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, AUGEN, OFF)
    # --- Händchen-Fummeln (die Hände rutschen 1 px hoch zur Brust) ---
    if Hm.folge(i, 4, [1] * 4, N):
        hand_hoch(al, (1, 2))
    if Hm.folge(i, 28, [1] * 4, N):
        hand_hoch(k, (7, 8))
    # --- Haarsträhnen schwingen nach außen ---
    pat = [1, 1, 0, 0, 1, 1]
    if Hm.folge(i, 14, pat, N):
        Hm.rand_dehnen(hl, OFF, {y: 1 for y in range(5, 11)}, 'l')
    if Hm.folge(i, 38, pat, N):
        Hm.rand_dehnen(hr, OFF, {y: 1 for y in range(5, 11)}, 'r')
    # --- Arme spreizen sich nach außen ---
    dl = 1 if Hm.folge(i, 22, [1] * 12, N) else 0
    dr = 1 if (Hm.folge(i, 2, [1] * 8, N) or Hm.folge(i, 46, [1, 1], N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(13, 18)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(13, 18)}, 'r')
    # --- Kopfneigen (Zeilen 0–10 samt Strähnen) und Gewichtsverlagerung (Zeilen 0–18 samt Strähnen/Armen) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 11)}, -3, sw + 2)
        for h in (hl, hr):
            Hm.bereich_versatz(h, OFF, {y: kn for y in range(4, 12)}, -3, sw + 2)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 19)}, -3, sw + 2)
        for h in (hl, hr):
            Hm.bereich_versatz(h, OFF, {y: gv for y in range(4, 12)}, -3, sw + 2)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(12, 18)}, -3, sw + 2)
    # --- Auf und ab: schwarzer Saum (Zeile 18) = Brust, Kinnzeile 10 läuft 3 Frames nach (Strähnen steigen mit dem Kopf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 10, brust, kopf)
    hl = Hm.atmen(hl, PAD_T + 18, PAD_T + 10, brust, kopf)
    hr = Hm.atmen(hr, PAD_T + 18, PAD_T + 10, brust, kopf)
    al = Hm.atmen(al, PAD_T + 18, PAD_T + 10, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 18, PAD_T + 10, brust, 0)
    # --- Fußtippen (die Stiefel liegen hinter den Beinen) ---
    pat2 = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 12, pat2, N) else 0
    ur = 1 if Hm.folge(i, 36, pat2, N) else 0
    fl, fr = ebene(fuss_l, -ul), ebene(fuss_r, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (hl, 0, 0), (hr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf/Haare → Haarumriss, Körper → Schwarz)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 11 else KOERPER_UMRISS
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
    L.speichern('wendy-the-shy-girl', 'Wendy, the Shy Girl', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/wendy-the-shy-girl-strip.png', frames, spalten=12, scale=6)
