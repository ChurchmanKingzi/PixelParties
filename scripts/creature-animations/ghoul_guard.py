# -*- coding: utf-8 -*-
"""Idle-Animation für „Ghoul Guard“ (Creature) — bleicher Ghul mit glatter Glatze und roten Augen in schwarzer Kluft mit goldener Gürtelschnalle.

Quelle: src/ghoul-guard.png (18×23 px, 23 Farben) — Ebene „Ghoul #1“ (MotiveDeepsea.xcf, Ebene 67), Figur 1; stimmt mit der Kartenkunst Ghoul_Guard.png (Sprite bei x 15–32) zu 100 % überein.
PICK: [["MotiveDeepsea", 67, 1]]
Die Quelle ist vollständig (alles deckend). Der Rest der Kartenkunst (Pflaster mit den vier farbigen Rüstungshelmen = andere Kreaturen/Kulisse, tote Bäume) gehört nicht zur Figur.

Aufruf:   python3 ghoul_guard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ghoul-guard.png + .json

Was ist was (x, y im Sprite):
* KOPF (x 3–13, y 0–9): glatte weiße Glatze (228,228,228)/(238,238,238)/(247,247,247) mit schwarzem Umriss (24,24,24); braune Pixel (49,24,0) an den Kopfseiten bei (2,5), (2,6), (3,7), (13,5), (13,6), (12,7) (Ohren/Haarfransen — bleiben fest).
* AUGEN (y 5–7): schwarze Höhlen/Brauen (0,0,0) bei (4–6, 5–6) und (9–11, 5–6); linkes Auge: rosa Lichtpunkt (255,150,150) (5,6), weiß (246,255,255) (5,7), rote Pupille (255,0,0) (6,7);
  rechtes Auge: dunkelrot (153,0,0) (10,6), rote Pupille (255,0,0) (10,7), weiß (9,7). Nase/Mund: nichts gezeichnet, nur der Kiefer/Kinn (y 8–9, hell).
* RUMPF (y 10–17): schwarzer Kittel mit Grautönen (32…156), graue Schulterstücke (123,123,123) bei (1,11)/(14,11); Gürtel y 14 mit rotbrauner Kante (106,32,0)/(123,41,16) und goldener SCHNALLE (255,205,49)/(255,180,24) bei (7,14)–(8,14);
  Beine y 17–22 (zwei Beine x 3–7 und 10–13, Lücke dazwischen), schwarze Stiefel.
* ARME: links hängt der Arm (x 0–3, y 10–14) und die Hand (x 0–3, y 15–16: hell (217,217,217)/(228,228,228) mit braunen Fingerrändern (49,24,0)); rechts ragt die Hand (x 15–17, y 10–13) mit brauner Kontur (49,24,0) nach rechts — sie steigt nur mit der Brust (starr, nicht gedehnt).
Metall/Gold: die goldene Schnalle (Gold = Metall → Glanz erlaubt, Regel 12/14). Sonst Haut/Stoff/Knochen: kein Glanz. Kein Feuer.

RUNDE 4 (Nutzer: „hat beim Stretching einfach kopierte Zeilen. Hier solltest du etwas passende Textur/Schattierung hinzufügen!“, Regel 43): die beim Atmen über der Brustzeile y 13 eingefügten Zeilen sind jetzt
HANDGEZEICHNET (STRECK_A direkt über y 13, STRECK_B darüber bei 2 px): die helle Brustplatte läuft nach oben schmaler und dunkler aus (156 → 123 → 65), der Oberarm bekommt wechselnde Schattierung; keine Zeile ist mehr
Kopie ihrer Nachbarin. Hub, Takt und alles andere unverändert.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, 0 → 1 → 2 → 1 → 0 px): die Brustzeile y 13 wird 0–2× eingefügt (Texturmischung mit der Nachbarzeile); Schultern, Hals, Kopf, linker Oberarm steigen (die ausgestreckte rechte Hand starr mit), Gürtel, Beine und Stiefel bleiben am Boden.
* LINKE HAND (Runde 3, Nutzer: „teilweise Lücken, wenn er ganz nach links gestretcht wird“): die Hand besteht nur noch aus ihren 6 Pixeln ((0–3,15), (1–2,16): Knochen mit brauner Kontur). Vorher maskierte `xx <= 3 & yy >= 15` auch den linken
  Beinrand (x 3, y 17–22), der beim Schlenkern nach links mitwanderte und Lücken sowie einen losen schwarzen Streifen riss. Jetzt schiebt sich die Hand nur 0–1 px ZUM Körper hin (Periode 16, 3× pro Schleife, nahtlos; nie nach außen,
  denn dort bliebe ein Loch zwischen Hand und Körper stehen). Geprüft für alle 48 Frames: ein einziger 4-verbundener Fleck wie im Original, keine eingeschlossenen Löcher.
* RECHTE HAND (ausgestreckt, x 15–17, y 10–13, Knochen mit brauner Kontur; Runde 3: „du streckst die braune Outline seiner ausgestreckten Hand“): sie hebt sich STARR um 0–2 px mit der Brust, ihre Kontur wird nicht mehr durch die
  eingefügte Zeile y 13 vervielfacht (die Zeile wird nur im Körper eingefügt).
* AUGEN blinzeln (Frames 17–19 und 40–42): die Augenpixel (rosa, weiß, rot, dunkelrot) nehmen die Farbe der Augenhöhle (0,0,0) an.
* SCHNALLE: goldener Glanz (die zwei Schnallenpixel tauschen eine Stufe heller/dunkler: (255,180,24) ↔ (255,205,49)) in Frames 4–8 und 28–32 und ein Glitzerstern (weiß/hellgelb, 1 → 2 → 2 → 1) in Frames 6–9 und 30–33 an der Schnalle.
Kein Kopfneigen, keine seitliche Verlagerung (Regel 17), Füße bleiben am Boden (Regel 18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('ghoul-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (24, 24, 24)
AUGEN = [(5, 6), (5, 7), (6, 7), (10, 6), (9, 7), (10, 7)]
assert [col(x, y) for (x, y) in AUGEN] == [(255, 150, 150), (246, 255, 255), (255, 0, 0), (153, 0, 0), (246, 255, 255), (255, 0, 0)]
LID = (0, 0, 0)
SCHNALLE = [(7, 14), (8, 14)]
assert [col(x, y) for (x, y) in SCHNALLE] == [(255, 205, 49), (255, 180, 24)]
HELL, DUNKEL = (255, 205, 49), (255, 180, 24)

# Runde 3: die linke Hand besteht nur aus 6 Pixeln (früher maskierte `xx <= 3 & yy >= 15` auch den linken Beinrand — das riss beim Schlenkern nach links Lücken und einen schwarzen Streifen)
HAND_L_PTS = [(0, 15), (1, 15), (2, 15), (3, 15), (1, 16), (2, 16)]
assert [col(x, y) for (x, y) in HAND_L_PTS] == [(49, 24, 0), (217, 217, 217), (228, 228, 228), (49, 24, 0), (49, 24, 0), (49, 24, 0)]
hand_l = np.zeros_like(vorhanden)
for (_x, _y) in HAND_L_PTS:
    hand_l[_y, _x] = True
# Die ausgestreckte rechte Hand (x 15–17, y 10–13, Knochen mit brauner Kontur) hebt sich STARR mit der Brust; ihre Kontur wird nicht mehr durch die eingefügte Zeile gedehnt
hand_r = vorhanden & (xx >= 15) & (yy <= 13)
rest = vorhanden & ~hand_l & ~hand_r
TEST_EBENEN = 'koerper'

# Runde 4: handgezeichnete Einfügezeilen (Grauwerte der Quelle, x 0–14); Reihenfolge von oben: y 12, [B], A, y 13
_G = lambda v: (v, v, v)
STRECK_A = [0, 65, 41, 0, 41, 41, 123, 156, 156, 123, 41, 41, 41, 24, 0]
STRECK_B = [0, 41, 123, 0, 41, 65, 41, 123, 123, 41, 65, 41, 65, 24, 0]
_farben = {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}
assert all(_G(v) in _farben for v in STRECK_A + STRECK_B)
assert [int(spr[13, x, 0]) for x in range(15)] == [0, 41, 65, 0, 41, 41, 156, 156, 156, 156, 41, 41, 41, 24, 0]


def strecken(k, n):
    """Brust n px strecken: alles oberhalb von y 13 rückt n px hoch, dazwischen stehen die handgezeichneten Zeilen (B oben, A unten) statt Kopien."""
    out = L.streck_zeile(k, OFF[1] + 13, n)
    zeilen = [STRECK_A] if n == 1 else [STRECK_B, STRECK_A][:n]
    for j, werte in enumerate(zeilen):
        y = OFF[1] + 13 - len(zeilen) + j
        out[y] = 0
        for x, v in enumerate(werte):
            out[y, OFF[0] + x] = _G(v) + (255,)
    out[OFF[1] + 13] = k[OFF[1] + 13]
    return out


def teil(m):
    return V.ebene(spr, m, H, W, OFF)


def pendel(i):
    """Linke Hand schiebt sich 0–1 px zum Körper hin (nie nach außen: dort entstünde ein Loch zwischen Hand und Körper), Periode 16 (3× pro Schleife, nahtlos)."""
    return U.stufe(i, 16, 1)


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = teil(rest)
    if V.fenster(i, N, 17, 3) or V.fenster(i, N, 40, 3):                     # Blinzeln
        V.setze(k, {p: LID for p in AUGEN}, OFF)
    g = V.folge(i, N, 4, [1, 1, 2, 2, 1]) or V.folge(i, N, 28, [1, 1, 2, 2, 1]) or 0            # Schnalle glänzt (eine Stufe)
    if g == 1:
        V.setze(k, {SCHNALLE[1]: HELL}, OFF)
    elif g == 2:
        V.setze(k, {SCHNALLE[0]: DUNKEL, SCHNALLE[1]: HELL}, OFF)
    kb = strecken(k, n) if n else k
    f = L.zusammen(H, W, [(kb, 0, 0), (teil(hand_r), 0, -n), (teil(hand_l), pendel(i), 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur is None:
        st = V.folge(i, N, 6, [1, 2, 2, 1]) or V.folge(i, N, 30, [1, 2, 2, 1])
        if st:
            V.stern(f, 8, 14, st, (246, 255, 255), (255, 205, 49), OFF)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('ghoul-guard', 'Ghoul Guard', frames, MS, prev)
    if prev:
        L.streifen(prev + '/ghoul-guard-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=10)
