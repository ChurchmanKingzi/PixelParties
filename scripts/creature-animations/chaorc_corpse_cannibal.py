# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Corpse Cannibal“ (Creature) — der kahle, rotäugige Chaorc, der im Schneidersitz neben einer toten Gestalt (Helm, Blutlache) hockt.

Quelle: src/chaorc-corpse-cannibal.png (32×26 px, 58 Farben).
PICK: [["MotiveHawaii", 119, 1]]      (Ebene „Corpse Cannibal“ (32×26 px), Figur 1 = Chaorc + Leiche + Blutlache in EINER Ebene, vollständig; Abgleich mit der Kartenkunst
                                        Chaorc_Corpse_Cannibal.png: 100 % Pixeltreffer. Kisten und Treppe der Kunst sind Kulisse und gehören nicht dazu.)
Aufruf:   python3 chaorc_corpse_cannibal.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-corpse-cannibal.png + .json

Was im Sprite ist (x, y im 32×26-Sprite):
* CHAORC (x 14–31, y 0–19): kahler runder Kopf (y 0–10, Umriss (49,24,0), Haut (246,189,123)/(213,164,98)/(189,131,57), Licht (255,213,164)), spitze Ohren links (x 14–18, y 3–6) und rechts (x 27–31, y 3–6),
  zwei zornige rote Augenstriche (90,8,0) bei (20,3),(20,4),(21,4) und (25,3),(24,4),(25,4); ein dunkelroter Streifen (88,0,0) von (24–26,7) schräg nach links unten bis (20–21,10) = Blut (Maul/Kinn) — bleibt FEST,
  ein schwarzer 2×2-Block (27–28, 9–10) rechts daneben (nicht eindeutig: Bissstück/Loch → bleibt FEST). Schultern/Arme y 11–13 (Haut), Gürtel y 14/16 mit brauner Schnalle (139,82,16),
  Beine im Schneidersitz y 15–19 (Haut), dunkelgraue Armschienen/Schuhe links (x 15–17, y 13–18) und rechts (x 28–30, y 15–18).
* LEICHE (x 0–14, y 14–25): Kopf/Oberkörper einer toten Gestalt mit Eisenhelm links (Grautöne (52,52,52)/(74,74,74)/(121,121,121), x 1–4, y 15–23), olivfarbenem Polster (131,123,65)/(82,74,8) und Haut; Blutlache (dunkle Rottöne bis (21,0,0), x 6–17, y 19–25).
Metall: nur der Eisenhelm der Leiche (Grautöne) glänzt (Regel 14); Haut, Blut, Stoff nicht. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Ebenen: Leiche (starr), Chaorc-KÖRPER samt gehaltenem Leichenteil (Zeilen ≥ 7 des Chaorc, starr), Chaorc-KOPF (Zeilen 0–6 samt Ohren)):
* Nutzerkorrektur Runde 3: Das Leichenteil, das der Chaorc hält und frisst (der blutige Streifen/Bissrest und die Hände davor, Zeilen 7–13), wird NIE gestreckt oder bewegt sich gegen den Körper — nur der Kopf kaut.
* Kauen (Frames 12–19 und 36–43): NUR der Kopf (Zeilen 0–6 mit Ohren und Augen) taucht im Takt von 4 Frames je 2 Frames um 1 px nach unten (er beißt in das Leichenteil, Kinnzeile überdeckt dessen Oberkante, nur innerhalb von dessen Umriss)
  und kommt wieder hoch; Körper und Leichenteil bleiben dabei starr. Es wird keine Zeile eingefügt oder entfernt.
* Atmen (Periode 24, zweimal pro Schleife): der ganze Oberkörper (Kopf + Körper samt Leichenteil + Arme) hebt sich STARR um 1 px; die dadurch entstehende Lücke schließt die Unterarmzeile 13 (einmal doppelt eingefügt, L.streck_zeile mit Texturmischung),
  die Beine und die Leiche bleiben. Das Leichenteil wandert dabei nur mit, es wird nicht verlängert.
* Ohrzucken (nie gleichzeitig mit dem Kauen): das rechte Ohr (Frames 6–9, 30–33) bzw. das linke Ohr (Frames 22–25, 44–47) knickt an der Spitze 1 px nach unten (Spitze + Umriss wandern mit, Kontur bleibt in Umrissfarbe geschlossen).
* Blinzeln (Frames 19–21 und 35–37): die roten Augenstriche nehmen die Hautfarbe (246,189,123) an (Lid = Hautfarbe), ein Augenschlag über zwei Frames.
* Eisenhelm der Leiche glänzt (Regel 12/14, Metall): zweimal pro Schleife läuft ein diagonales Lichtband (eine bzw. zwei Stufen heller auf der Grau-Rampe (51,51,51) → (74,74,74) → (121,121,121)) über die Grau-Pixel des Helms.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): Kontur in jeder Pose in Umrissfarbe (Hm.kontur_schliessen), zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Flächen (nur Umrisspixel an den Ohrspitzen: (14,5), (15,6) bzw. (31,5), (30,6) in (49,24,0) und das Umwidmen von Haut ↔ Umriss an der Ohrspitze).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GP = 6                                            # großzügige Arbeitsleinwand (wird danach auf die Figur zugeschnitten)

spr = L.lade('chaorc-corpse-cannibal')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)
HAUT = (246, 189, 123)
chaorc = vorhanden & (xx >= 14) & (yy <= 19)
leiche = vorhanden & ~chaorc
kopf_m = chaorc & (yy <= 6)                      # Kopf samt Ohren (kaut)
rumpf_m = chaorc & (yy >= 7)                     # Körper samt gehaltenem Leichenteil (Zeilen 7–13) und Beinen (starr)

AUGEN = [(20, 3), (20, 4), (21, 4), (25, 3), (24, 4), (25, 4)]
# Ohrspitzen: Spitze (Haut + Umriss) rutscht 1 px nach unten
OHR_R = {(31, 4): None, (30, 4): UMRISS, (30, 5): (213, 164, 98), (31, 5): UMRISS, (30, 6): UMRISS}
OHR_L = {(14, 4): None, (15, 4): UMRISS, (15, 5): (213, 164, 98), (14, 5): UMRISS, (15, 6): UMRISS}
assert tuple(int(v) for v in spr[4, 30, :3]) == (213, 164, 98) and tuple(int(v) for v in spr[4, 15, :3]) == (213, 164, 98)

# Eisenhelm (Grautöne der Leiche) für das Lichtband
GRAU = [(51, 51, 51), (74, 74, 74), (121, 121, 121)]
helm = L.farbmaske(spr, GRAU) & leiche & (xx <= 9)
assert helm.sum() >= 12


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def kauen(i):
    """0 oder 1: Kopf 1 px tiefer (nur in den Kau-Fenstern, Takt 4 Frames)."""
    for start in (12, 36):
        j = i - start
        if 0 <= j < 8 and (j // 2) % 2 == 0:
            return 1
    return 0


def frame_gross(i, nur=None):
    kopf = teil(kopf_m)
    rumpf = teil(rumpf_m)
    # --- Ohrzucken, Blinzeln (auf dem Kopf, Spritekoordinaten) ---
    if Hm.folge(i, 6, [1] * 4, N) or Hm.folge(i, 30, [1] * 4, N):
        Hm.setze(kopf, OHR_R, OFF)
    if Hm.folge(i, 22, [1] * 4, N) or Hm.folge(i, 44, [1] * 4, N):
        Hm.setze(kopf, OHR_L, OFF)
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 35, [1, 1, 1], N):
        Hm.setze(kopf, {p: HAUT for p in AUGEN}, OFF)
    # --- Kauen: nur der Kopf senkt sich; er überdeckt die Oberkante des Körpers nur innerhalb von dessen Umriss ---
    k = kauen(i)
    if k:
        kopf = L.versetze(kopf, 0, k)
        zeile = GP + 7
        for x in range(W):
            if kopf[zeile, x, 3] and not rumpf[zeile, x, 3]:
                kopf[zeile, x] = 0
    c = L.zusammen(H, W, [(rumpf, 0, 0), (kopf, 0, 0)])
    # --- Atmen: Oberkörper (Kopf + Körper + Leichenteil) hebt sich starr, die Unterarmzeile 13 schließt die Lücke ---
    if Hm.welle01(i, 24) > 0.5:
        c = L.streck_zeile(c, GP + 13, 1)
    c = Hm.kontur_schliessen(c, ERLAUBT, UMRISS)
    # --- Leiche (fest) mit glänzendem Eisenhelm ---
    l = teil(leiche)
    for start in (4, 28):
        Hm.lichtband(l, helm, OFF, i, N, start, 12, GRAU, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    return L.zusammen(H, W, [(l, 0, 0), (c, 0, 0)])


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('chaorc-corpse-cannibal', 'Chaorc Corpse Cannibal', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-corpse-cannibal-strip.png', frames, spalten=12, scale=5)
