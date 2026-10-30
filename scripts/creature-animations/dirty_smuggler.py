# -*- coding: utf-8 -*-
"""Idle-Animation für „Dirty Smuggler“ (Creature) — der Schmuggler mit der grauen Mütze, der eine große Holzkiste mit goldenem Siegel an der Seite trägt.

Quelle: src/dirty-smuggler.png (26×23 px, 47 Farben).
PICK: [["MotiveGrailWar", 125, 3]]      (Ebene „Ebene #467“, Figur 3; nur in dieser Karte)

Aufruf:   python3 dirty_smuggler.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/dirty-smuggler.png + .json

Was im Sprite ist (x, y im 26×23-Sprite):
* MÜTZE (x 12–25, y 0–8): graue Schirmmütze (D (37,37,37), E (73,73,73), H (111,111,111)); der Schirm ragt rechts als dunkler Streifen (x 22–25, y 6–8) heraus.
* GESICHT (x 13–18, y 5–9): Haut O (246,189,123)/(255,213,164); ein Auge: schwarzer Wimpernpixel (14,6), hellblaue Iris (172,213,255) (15,6) und weißer Pixel (246,246,246) (15,7);
  dunkelbrauner Bart J (148,65,24)/(123,41,16)/(90,32,0) y 7–11. Umriss C (49,24,0).
* JACKE (x 12–21, y 9–17): braun (J, P, W), die linke Hand-/Unterarmpartie in Hauttönen S (213,164,98)/(246,189,123) bei x 10–16, y 13–15 hält die Kiste; rechts ein dreifarbiger Streifen (Rot,
  Weiß, Blau) (19, 12–16) am Gürtel; dunkler Umriss N (49,8,0).
* KISTE (x 0–11, y 4–17): Holzkiste in Tan A (136,95,49)/L/I/F/S mit schwarzen Eisenbeschlägen G (18,18,18), D/E-grauen Ecken und einem GOLDENEN Siegelschild (x 4–9, y 11–15: K (225,165,0),
  Lichtkante (255,221,96), dunkler Rand (196,142,0), schwarzes Schlüsselloch (6–7, 13–14)); die Hände halten sie am rechten Rand (Haut bei (10–11, 14–15)).
* BEINE (y 16–21): blaue Hose (R (98,106–238), T (65,82,230), Q (0,16,74)), braune Stiefel (J, P, m), Sohle schwarz (y 22).
Metall im Sprite: nur das goldene Siegelschild (Regel 14: nur das glänzt; Mütze, Holz, Haut, Stoff nicht). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Gürtelzeile 17 der Figur wird einmal doppelt eingefügt: Oberkörper, Arme und Kopf steigen, Beine/Stiefel bleiben; die Kiste hebt
  sich starr um 1 px mit den Händen), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Halszeile 10, glatter Bart, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust/Kiste 0 → 1 → 0.
* Gewichtsverlagerung: der Oberkörper samt Kiste (Zeilen 0–15, Kiste ganz) verschiebt sich einmal pro Schleife 1 px nach rechts (Frames 8–19) und später 1 px nach links (Frames 32–43) — der Schmuggler
  verlagert das Gewicht der schweren Kiste; Hose und Stiefel bleiben stehen (4-verbunden), Randpixel werden in Umrissfarbe geschlossen.
* Blinzeln (Frames 22–24 und 43–45): hellblaue Iris (15,6) und weißer Pixel (15,7) nehmen die umgebende Hautfarbe O (246,189,123) an (Lid = Hautfarbe); kein Farbtausch, kein Augenglanz.
* Gold glänzt (Regel 12/14: nur das Siegelschild): ein Lichtband läuft zweimal pro Schleife diagonal über das Schild (Frames 5–18 und 29–42; 1–2 Stufen heller auf der Goldrampe (196,142,0) < (225,165,0) <
  (247,198,18) < (255,221,96), nur Innenpixel, Schlüsselloch und Rand bleiben), dazu ein vierzackiger Glitzer-Stern an der oberen linken Schildecke (Frames 10–13) und rechten Schildecke (Frames 34–37).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Kiste hängt an den Händen und hat unten keinen Halt, der freie Raum bleibt leer).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Gewichtsverlagerung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('dirty-smuggler')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


UMRISS = (0, 0, 0)
ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(13, 5)                                                     # O (246,189,123), Lidfarbe
GOLD = [(196, 142, 0), (225, 165, 0), (247, 198, 18), (255, 221, 96)]
WEISS, HELL, MITTEL = f(15, 7), (255, 221, 96), (247, 198, 18)             # Sternkern: Weiß des Auges (246,246,246)

kiste = vorhanden & (xx <= 11) & (yy <= 17)
person = vorhanden & ~kiste
KANTE0 = Hm.kantenmaske(spr)
m_gold = np.array([[bool(kiste[y, x] and f(x, y) in GOLD and 4 <= x <= 9 and 11 <= y <= 15 and not KANTE0[y, x]) for x in range(sw)] for y in range(sh)])


def frame(i):
    # --- Ebenen auf der vollen Leinwand ---
    t_k, _ = L.trenne(spr, kiste)
    ki = L.platz(t_k, H, W, PAD_L, PAD_T)
    t_p, _ = L.trenne(spr, person)
    pe = L.platz(t_p, H, W, PAD_L, PAD_T)
    gl = L.leer(H, W)                                               # Glitzer-Sterne (Effekt über der Figur)
    # --- Gold glänzt: Lichtband über das Siegelschild (Innenpixel) ---
    for start in (5, 29):
        Hm.lichtband(ki, m_gold, OFF, i, N, start, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Blinzeln: Iris und Weiß nehmen die Hautfarbe an ---
    if Hm.folge(i, 22, [1, 1, 1], N) or Hm.folge(i, 43, [1, 1, 1], N):
        Hm.setze(pe, {(15, 6): HAUT, (15, 7): HAUT}, OFF)
    # --- Gewichtsverlagerung: Oberkörper (Zeilen 0–15) und Kiste 1 px seitlich ---
    d = 1 if Hm.folge(i, 8, [1] * 12, N) else (-1 if Hm.folge(i, 32, [1] * 12, N) else 0)
    if d:
        Hm.bereich_versatz(pe, OFF, {y: d for y in range(0, 16)}, 0, sw - 1)
        ki = L.versetze(ki, d, 0)
    # --- Auf und ab: Gürtelzeile 17 = Brust (die Kiste hebt sich starr mit), Halszeile 10 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    pe = Hm.atmen(pe, PAD_T + 17, PAD_T + 10, brust, kopf)
    if brust:
        ki = L.versetze(ki, 0, -brust)
    # --- Glitzer-Sterne an den Schildecken (mit der Kiste mitbewegt) ---
    for (sx, sy, start) in ((4, 11, 10), (9, 11, 34)):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx + d, sy - brust, st, WEISS, HELL, MITTEL, OFF)
    fig = L.zusammen(H, W, [(ki, 0, 0), (pe, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)                      # Regel 16: Außenkante in jeder Pose in Umrissfarbe
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
    L.speichern('dirty-smuggler', 'Dirty Smuggler', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/dirty-smuggler-strip.png', frames, spalten=12, scale=6)
