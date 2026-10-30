# -*- coding: utf-8 -*-
"""Idle-Animation für „Bishop of Kings [W]“ (Creature) — der weiße Schachbischof mit Mitra und goldenem Krummstab.

Quelle: src/bishop-of-kings-w.png (19×26 px, 9 Farben).
PICK: kein eigener Ebenen-Treffer nötig: Die Figur steckt in den Ebenen „Chess“ (Motive 639) und „Schachfiguren“ (Motive 656, pixelgleich), Komponente bei x 98–118, y 0–26 der Ebene (dieselbe Ebenenfigur wie bei [B]).
      Die Karte [W] zeigt sie praktisch unverändert; der einzige Unterschied ist der Umriss: Schwarz (0,0,0) der Ebene wird auf der Karte zu (26,26,26). Grautöne und Gold bleiben (Median der Kartenpixel je Quellfarbe,
      Streuung ≤ 3,7; Gold weicht im Median um höchstens 4 vom Ebenenwert ab, das ist Kartenrauschen und wird nicht übernommen). Der Sprite ist die Ebenenfigur mit genau dieser einen Ersetzung.
Abgleich mit der Kartenkunst Bishop_of_Kings_1.png (76×51): fertiger Sprite sitzt dort bei (26,14), 99,6 % Pixeltreffer (Toleranz 20; nächstbester Treffer 33 %). Auf der Karte stehen außerdem das Schachbrett und die
Steinmauer, nichts davon gehört zur Figur. Die schwarze Schwester [B] ist Bishop_of_Kings.png (gleiche Ebenenfigur, Grau um 127,5 abgedunkelt).

Aufruf:   python3 bishop_of_kings_w.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bishop-of-kings-w.png + .json

Was im Sprite ist (x, y im 19×26-Sprite):
* MITRA (y 0–10): Umriss (26,26,26), Stoff in Grautönen (153,153,153)/(179,179,179)/(204,204,204)/(230,230,230)/(255,255,255); Goldspitze (255,198,0)/(210,145,0) bei (11–12, 0–1); goldene Zierpunkte bei (9,8–9) und (12,8–9).
* KRUMMSTAB (gold, x 0–5 oben, x 3 unten): Spirale (0–5, 2–7), Stab (3, 8–25) in (255,198,0)/(210,145,0)/(181,125,0); er verschwindet hinter der Hand bei (2–6, 11–15).
* KÖRPER (y 11–22): heller Rock mit dunkler Bandzeile (26,26,26) bei y 18, linker Arm mit Hand am Stab (2–8, 11–15), rechter Ärmel (15–18, 12–21).
* FÜSSE (y 23–25): zwei helle Stiefel (7–10) und (13–17) mit dunkler Sohle.
Metall/Gold: nur der Krummstab und die goldenen Zierpunkte/Spitze der Mitra. Nur sie glänzen (Regel 14); der helle Stoff nicht (auch die weißen Pixel sind Stoff, kein Glanz). Kein Feuer, kein Dampf, keine Partikel. Keine Augen (Schachfigur): kein Blinzeln.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos) — identisch zu Bishop of Kings [B]:
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (die dunkle Bandzeile 18 wird einmal doppelt eingefügt, auch der Stab bekommt eine zusätzliche Stabzeile, sodass Spirale und Hand steigen, der Stabfuß
  bleibt am Boden), die Mitra läuft 3 Frames nach und steigt um ein weiteres px (Halszeile 10): Mitra 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: Körper (Zeilen 0–21) samt Stab schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); die Stiefel bleiben stehen.
* Mitra neigt sich (Zeilen 0–10): 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31), getrennt von der Verlagerung.
* Stab neigt sich: die Spirale mit dem oberen Stab (Zeilen 0–10) rückt 1 px nach rechts (Frames 38–43), also nur zur Hand hin, dort bleibt der Kontakt in 4er-Nachbarschaft.
* Gold glänzt (Regel 14): ein Lichtband läuft einmal von oben nach unten über den Stab (Frames 6–19), später ein kurzes Aufblitzen der Zierpunkte und Spitze an der Mitra (Frames 30–35).
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter den Rocksaum (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter dem Saum).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung ±1 px seitlich, Mitrahub 2 px oben, Randabstand ≥ 2

spr = L.lade('bishop-of-kings-w')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

GOLD = [(181, 125, 0), (210, 145, 0), (255, 198, 0)]


def farbe(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
ist_gold = np.zeros((sh, sw), bool)
for y in range(sh):
    for x in range(sw):
        if vorhanden[y, x] and farbe(x, y) in GOLD:
            ist_gold[y, x] = True
stab = ist_gold & (xx <= 6)                                         # Krummstab (Spirale + Stab)
zier = ist_gold & (xx >= 8)                                         # goldene Zierpunkte/Spitze der Mitra
fuss_l = vorhanden & ~stab & (xx <= 10) & (yy >= 24)
fuss_r = vorhanden & ~stab & (xx >= 11) & (yy >= 24)
rumpf = vorhanden & ~stab & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k, st = ebene(rumpf), ebene(stab)
    # --- Gold glänzt (Regel 14): Stab von oben nach unten, später die Zierpunkte der Mitra ---
    Hm.lichtband(st, stab, OFF, i, N, 6, 14, GOLD, stufen=1, breite=3.0, achse=(0.0, 1.0), kern=2)
    Hm.lichtband(k, zier, OFF, i, N, 30, 6, GOLD, stufen=1, breite=3.0, achse=(0.0, 1.0), kern=2)
    # --- Stab neigt sich zur Hand hin (Zeilen 0–10 nur nach rechts, 4er-Kontakt zur Hand bleibt) ---
    if Hm.folge(i, 38, [1] * 6, N):
        Hm.bereich_versatz(st, OFF, {y: 1 for y in range(0, 11)}, -2, sw + 1)
    # --- Mitra neigt sich (Zeilen 0–10) und Gewichtsverlagerung (Zeilen 0–21 samt ganzem Stab) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 11)}, -2, sw + 2)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 22)}, -2, sw + 2)
        Hm.bereich_versatz(st, OFF, {y: gv for y in range(0, sh)}, -2, sw + 2)
    # --- Auf und ab: schwarze Bandzeile 18 = Brust (Stab: Stabzeile 20), Halszeile 10 läuft 3 Frames nach (nur Körper/Mitra) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 10, brust, kopf)
    st = Hm.atmen(st, PAD_T + 20, PAD_T + 10, brust, 0)
    # --- Fußtippen (die Stiefel liegen hinter dem Saum) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 12, pat, N) else 0
    ur = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -ul), ebene(fuss_r, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (st, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Dunkelgrau (26,26,26))
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = (26, 26, 26)
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
    L.speichern('bishop-of-kings-w', 'Bishop of Kings [W]', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/bishop-of-kings-w-strip.png', frames, spalten=12, scale=6)
