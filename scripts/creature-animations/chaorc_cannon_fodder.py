# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Cannon Fodder“ (Creature) — der rotkapuzige Chaorc neben der Kanone, die Zündschnur brennt.

Quelle: src/chaorc-cannon-fodder.png (16×21 px, 17 Farben, 226 Pixel).
PICK: [["MotiveHawaii", 113, 2]]      (Ebene „Cannon Fodder“, Figur 2 (17×22); die Ebene enthält zwei Figuren: Figur 2 = der rote Chaorc, Figur 1 = der Kopf mit den spitzen Ohren aus der Kanone)
Abgleich mit der Kartenkunst Chaorc_Cannon_Fodder.png (76×51): Sprite sitzt dort bei (8,19), 100 % Pixeltreffer. Auf der Karte stehen außerdem die Kanone (Ebenen 114/108 „Ebene #70“/„Ebene #77“, ein schwarzes
Geschütz mit drei Stacheln und brennender Zündschnur), der Kopf aus dem Rohr (Figur 1 derselben Ebene), Holzkisten und die Schräge rechts — nichts davon gehört zur gewählten Figur.
Mehrdeutigkeit: Die Karte zeigt zwei Wesen der Ebene „Cannon Fodder“: den roten Chaorc (links) und den Spitzohrkopf, der aus dem Kanonenrohr schaut (Chaorc-Futter). Ich habe den roten Chaorc gewählt: er ist die
Chaorc-Standardfigur der Reihe (derselbe Sprite wie beim Pyre Grill Master) und eine ganze Figur; der Kopf ist nur ein Ausschnitt (Rumpf steckt im Rohr).

Aufruf:   python3 chaorc_cannon_fodder.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-cannon-fodder.png + .json

Was im Sprite ist (x, y im 16×21-Sprite):
* KAPUZE (y 0–9): rote Kapuze in (38,0,0)/(64,0,0)/(102,0,0)/(134,0,0)/(161,0,0) mit Umriss (26,0,0); spitzer Zipfel links (0–2, 4–6); die Gesichtsöffnung rechts ist schwarz (0,0,0) bei (9–10,2), (8,3), (9,4), (10–11,5), (9–11,8)
  — Augen sind nicht lesbar (schwarze Öffnung) → kein Blinzeln.
* KRAGEN (y 9): grauer Kragen (38,38,38) bei (6–9, 9).
* ROBE (y 10–15): rote Robe, rechts graue/silberne Teile (54,54,54)/(176,176,176)/(204,204,204) bei (11–15, 10–15) (Hand/Gerät), Gürtelband (38,38,38)/(40,40,40) bei y 15–16.
* SAUM (y 16–20): brauner Lederrock (58,37,23)/(73,51,33)/(35,17,5)/(5,0,0), unten roter Zipfel (102,0,0)/(134,0,0)/(161,0,0), Umriss (26,0,0).
Metall im Sprite: nur die 3 Silberpixel rechts (zu klein für ein Lichtband, würden isolierte Punkte): kein Glanz. Kein Feuer (die Zündschnur gehört zur Kanone), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Saumzeile 18, glatt braun, wird einmal doppelt eingefügt: Robe, Gerät und Kopf steigen, der untere Zipfel bleibt), die Kapuze läuft 3 Frames nach und hebt
  sich um ein weiteres px (Kragenzeile 9): Kapuze 0 → 1 → 2 → 1 → 0 px, Körper 0 → 1 → 0. Die entstehende zweite Kragenzeile (untere Kopie) läuft in die Robenfarbe darunter aus, damit kein doppelter grauer Block
  mitten im Oberkörper steht; der Kragen bleibt eine Zeile hoch.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–15) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Gürtel, Saum und Zipfel (Zeilen 16–20) bleiben stehen.
* Kapuzenneigen: Kapuze (Zeilen 0–9) neigt sich 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31), getrennt von der Verlagerung.
* Kapuzenzipfel schlägt aus: der spitze Zipfel links (Zeilen 4–6) streckt sich zweimal 1 px nach außen (Frames 14–19 und 28–33); das Innere des Zipfels bleibt, der Umriss wandert mit (`Hm.rand_dehnen_innen`).
* Lederrock schwingt: die Saumzeilen 17–19 rücken 1 px nach rechts (Frames 2–7) und 1 px nach links (Frames 24–29); in Zeitfenstern ohne Gewichtsverlagerung.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Zipfel ±1 px seitlich, Kapuzenhub 2 px oben, Randabstand ≥ 2

spr = L.lade('chaorc-cannon-fodder')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
UMRISS = (26, 0, 0)
KRAGEN, ROBE = (38, 38, 38), (102, 0, 0)                            # grauer Kragen / Robenrot der Quelle

zipfel = vorhanden & (xx <= 3) & (yy >= 4) & (yy <= 6)
saum = vorhanden & (yy >= 17) & (yy <= 19)
rumpf = vorhanden & ~zipfel & ~saum


def ebene(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i):
    k, zp, sa = ebene(rumpf), ebene(zipfel), ebene(saum)
    # --- Kapuzenzipfel schlägt nach außen aus (Umriss wandert mit) ---
    if Hm.folge(i, 14, [1] * 6, N) or Hm.folge(i, 28, [1] * 6, N):
        Hm.rand_dehnen_innen(zp, OFF, {y: 1 for y in range(4, 7)}, 'l')
    # --- Lederrock schwingt (Zeilen 17–19) ---
    sw_ = 1 if Hm.folge(i, 2, [1] * 6, N) else (-1 if Hm.folge(i, 24, [1] * 6, N) else 0)
    if sw_:
        Hm.bereich_versatz(sa, OFF, {y: sw_ for y in range(17, 20)}, -2, sw + 1)
    # --- Kapuzenneigen (Zeilen 0–9) und Gewichtsverlagerung (Zeilen 0–15) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 10)}, -2, sw + 1)
        Hm.bereich_versatz(zp, OFF, {y: kn for y in range(4, 7)}, -3, sw + 1)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 16)}, -2, sw + 1)
        Hm.bereich_versatz(zp, OFF, {y: gv for y in range(4, 7)}, -3, sw + 1)
    # --- Auf und ab: Saumzeile 18 = Brust, Kragenzeile 9 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 9, brust, kopf)
    zp = Hm.atmen(zp, PAD_T + 18, PAD_T + 9, brust, kopf)
    if kopf:
        # die untere Kopie der Kragenzeile läuft in die Robenfarbe darunter aus (kein doppelter grauer Kragenblock, nur Quellfarben)
        z = PAD_T + 9 - brust
        for x in range(W):
            if k[z, x, 3] and tuple(int(v) for v in k[z, x, :3]) == KRAGEN:
                for dy in (1, 2):
                    c = k[z + dy, x]
                    if c[3] and tuple(int(v) for v in c[:3]) != KRAGEN:
                        k[z, x, :3] = c[:3]
                        break
                else:
                    k[z, x, :3] = ROBE
    sa = Hm.atmen(sa, PAD_T + 18, PAD_T + 9, brust, 0)
    fig = L.zusammen(H, W, [(sa, 0, 0), (zp, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS
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
    L.speichern('chaorc-cannon-fodder', 'Chaorc Cannon Fodder', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-cannon-fodder-strip.png', frames, spalten=12, scale=6)
