# -*- coding: utf-8 -*-
"""Idle-Animation für „Rosie, the School Idol“ (Creature) — das zwinkernde Idol mit der orange-blonden Löwenmähne, den cyanfarbenen Augen und dem gelbgrünen Oberteil.

Quelle: src/rosie-the-school-idol.png (16×22 px, 33 Farben).
PICK: [["MotiveArcanum", 184, 1]]      (Ebene „Ebene #7“, ganze Ebene = eine Figur; die Pose mit dem Zwinkern, wie auf der Karte)
Abgleich mit der Kartenkunst Rosie_the_School_Idol.png (76×51): Sprite sitzt dort bei (30,5), 97,5 % Pixeltreffer (die übrigen 2,5 % verdeckt der rotharige Junge im Vordergrund; nächstbester Treffer 35 %).
Auf der Karte stehen außerdem der Rotschopf von hinten (Ebene 182, ein anderes Wesen), drei rosa Herzen rechts neben ihr (Ebene 183), Regale und ein Schrank: nichts davon gehört zur Figur.
Die Ebene 185 „Ebene #5“ ist dieselbe Figur mit beiden Augen offen und anderen Beinen: Aus ihr stammen nur die Augenpixel für das Öffnen des zugekniffenen Auges (gleiche Palette, derselbe Künstler).

Aufruf:   python3 rosie_the_school_idol.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rosie-the-school-idol.png + .json

Was im Sprite ist (x, y im 16×22-Sprite):
* HAARE (y 0–15): Löwenmähne in Orange/Gold (192,124,9)/(219,140,9)/(214,97,7)/(255,180,23)/(253,223,85) mit Zopfspitze oben (7–8, 0–1), lange Seitenpartien bis y 14, braune Umrisse (91,57,0)/(115,41,13).
* GESICHT (y 5–11): Haut (247,188,151)/(245,206,136)/(252,231,214). Linkes Auge OFFEN: Cyan (0,252,253) bei (5,8), Dunkeltürkis (7,111,96) bei (6,8), Weiß (248,254,255) bei (5,9), Türkisgrün (13,206,179) bei (6,9), schwarze Lider bei
  (5–6,7) und (4,8). Rechtes Auge ZWINKERND: schwarze Wimpernlinie (9–10,9) unter Haut (9–10,8), Lid (9–10,7) schwarz. Rosa Wangen (255,149,149) bei (5,10) und (10,10).
* OBERTEIL (y 11–18): gelbgrün (222,255,74)/(158,181,53), dunkelgraue Träger (61,63,60)/(33,35,32); Hände (247,206,140)/(255,224,192) bei (3,15–16)+(4,16–17) und (12,15–16)+(11,16–17).
* ROCK/BEINE (y 18–21): schwarz (2,5,1) mit grauen Beinen (61,63,60)/(33,35,32) bei (5–6,19–20) und (9–10,19–20), schwarze Stiefelzeile y 21.
Metall/Gold/Edelsteine im Sprite: keine (die goldene Mähne ist Haar). Also kein Glanz (Regel 14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Rockzeile 18 wird einmal doppelt eingefügt: Oberteil, Hände, Mähne und Kopf steigen, Beine bleiben), der Kopf läuft 3 Frames nach und hebt sich um
  ein weiteres px (Halszeile 11): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–18) samt Mähnenpartien und Händen schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Beine und Stiefel bleiben stehen.
* Kopfneigen: Kopf (Zeilen 0–11) neigt sich 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31).
* Mähne schwingt: die linke Seitenpartie (x ≤ 3, y 5–14) schwingt zweimal 1 px nach außen (Frames 14–19), die rechte später (Frames 38–43); sie ist eine eigene Ebene und wird mit `Hm.rand_dehnen` gedehnt, innen bleibt
  alles am Kopf.
* Zwinkern/Blinzeln mit den echten Pixeln der Künstlerin: Frames 8–13 und 40–44: das zugekniffene Auge geht auf (Augenpixel der Ebene 185: beide Augen offen, Cyan über Weiß), danach kneift sie wieder; Frames 29–31:
  Blinzeln — das offene Auge schließt sich nach dem Muster des Zwinkerauges (Lid = Hautfarbe über schwarzer Wimpernlinie), beide Augen sind kurz zu. Kein Farbtausch, kein Augenglanz, nur diese drei Zustände.
* Händchen: die linke Hand rutscht 1 px nach innen (Frames 4–7), die rechte später (Frames 28–31); die Hand wandert samt Umriss, der alte Platz wird zu Umrisspixel, alles im Inneren der Silhouette.
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
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Mähne ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('rosie-the-school-idol')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAAR_UMRISS, KOERPER_UMRISS = f(2, 5), f(3, 18)                     # (91,57,0) / (2,5,1)
SCHWARZ, HAUT, HAARBRAUN = f(5, 7), f(9, 8), f(4, 7)                # (0,0,0), (247,188,151), (117,74,4)
CYAN, TUERKIS, WEISS = f(5, 8), f(6, 9), f(5, 9)                    # (0,252,253), (13,206,179), (248,254,255)
# Augenzustände (Spritekoordinaten). OFFEN = beide Augen offen (Pixel der Ebene 185), ZU = beide Augen zu (Muster des Zwinkerauges auf das offene Auge gespiegelt)
OFFEN = {(6, 7): HAARBRAUN, (9, 7): HAARBRAUN, (4, 8): HAARBRAUN, (6, 8): SCHWARZ, (9, 8): SCHWARZ, (10, 8): CYAN,
         (4, 9): HAUT, (9, 9): TUERKIS, (10, 9): WEISS, (11, 9): HAUT}
ZU = {(5, 8): HAUT, (6, 8): HAUT, (5, 9): SCHWARZ, (6, 9): SCHWARZ, (4, 8): HAARBRAUN}

haar_l = vorhanden & (((xx <= 3) & (yy >= 5) & (yy <= 12)) | ((xx <= 2) & (yy >= 13) & (yy <= 14)))
haar_r = vorhanden & (((xx >= 12) & (yy >= 5) & (yy <= 12)) | ((xx >= 13) & (yy >= 13) & (yy <= 14)))
fuss_l = vorhanden & (xx <= 7) & (yy >= 21)
fuss_r = vorhanden & (xx >= 8) & (yy >= 21)
rumpf = vorhanden & ~haar_l & ~haar_r & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def hand_innen(a, links):
    """Eine Hand (4 Pixel, schräg) rutscht 1 px zum Körper hin; der alte Platz wird Umrisspixel (Farbe von (4,15)/(11,15))."""
    if links:
        hand = {(3, 15): f(3, 15), (3, 16): f(3, 16), (4, 16): f(4, 16), (4, 17): f(4, 17)}
        d, umriss = 1, f(4, 15)
    else:
        hand = {(12, 15): f(12, 15), (12, 16): f(12, 16), (11, 16): f(11, 16), (11, 17): f(11, 17)}
        d, umriss = -1, f(11, 15)
    Hm.setze(a, {p: umriss for p in hand}, OFF)
    Hm.setze(a, {(x + d, y): c for (x, y), c in hand.items()}, OFF)


def frame(i):
    k, hl, hr = ebene(rumpf), ebene(haar_l), ebene(haar_r)
    # --- Augen: zugekniffenes Auge geht auf (Frames 8–13, 40–44), Blinzeln (Frames 29–31) ---
    if Hm.folge(i, 8, [1] * 6, N) or Hm.folge(i, 40, [1] * 5, N):
        Hm.setze(k, OFFEN, OFF)
    elif Hm.folge(i, 29, [1] * 3, N):
        Hm.setze(k, ZU, OFF)
    # --- Händchen rutschen nach innen ---
    if Hm.folge(i, 4, [1] * 4, N):
        hand_innen(k, True)
    if Hm.folge(i, 28, [1] * 4, N):
        hand_innen(k, False)
    # --- Mähne schwingt nach außen ---
    pat = [1, 1, 0, 0, 1, 1]
    if Hm.folge(i, 14, pat, N):
        Hm.rand_dehnen(hl, OFF, {y: 1 for y in range(6, 13)}, 'l')
    if Hm.folge(i, 38, pat, N):
        Hm.rand_dehnen(hr, OFF, {y: 1 for y in range(6, 13)}, 'r')
    # --- Kopfneigen (Zeilen 0–11 samt Mähne) und Gewichtsverlagerung (Zeilen 0–18 samt Mähne) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 12)}, -3, sw + 2)
        for h in (hl, hr):
            Hm.bereich_versatz(h, OFF, {y: kn for y in range(5, 12)}, -3, sw + 2)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 19)}, -3, sw + 2)
        for h in (hl, hr):
            Hm.bereich_versatz(h, OFF, {y: gv for y in range(5, 15)}, -3, sw + 2)
    # --- Auf und ab: Rockzeile 18 = Brust, Halszeile 11 läuft 3 Frames nach (Mähne steigt mit dem Kopf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 11, brust, kopf)
    hl = Hm.atmen(hl, PAD_T + 18, PAD_T + 11, brust, kopf)
    hr = Hm.atmen(hr, PAD_T + 18, PAD_T + 11, brust, kopf)
    # --- Fußtippen (die Stiefel liegen hinter den Beinen) ---
    pat2 = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 12, pat2, N) else 0
    ur = 1 if Hm.folge(i, 36, pat2, N) else 0
    fl, fr = ebene(fuss_l, -ul), ebene(fuss_r, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (hl, 0, 0), (hr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf/Mähne → Haarumriss, Körper → Schwarz)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 15 else KOERPER_UMRISS
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
    L.speichern('rosie-the-school-idol', 'Rosie, the School Idol', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/rosie-the-school-idol-strip.png', frames, spalten=12, scale=6)
