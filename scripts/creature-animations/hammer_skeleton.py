# -*- coding: utf-8 -*-
"""Idle-Animation für „Hammer Skeleton“ (Creature) — Runde 3: KEIN seitliches Schlackern mehr (Nutzer: „soll nicht nach links und rechts schlackern“); stattdessen atmet die Rüstung nur senkrecht.

Quelle: src/hammer-skeleton.png — Ebene „Ebene #40“ (22×34 px, 350 Pixel, 27 Farben) aus MotiveCoolhalla.xcf (Ebene 191, Figur 1, Treffer 1.0; Kunst: eine gepanzerte Gestalt, die mit
der Spitze im Eis steckt).
PICK: [["MotiveCoolhalla", 191, 1]]

Aufruf:   python3 hammer_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hammer-skeleton.png + .json

Was ist was (x/y im Sprite):
* Stahlhelm (x 4–15, y 0–5): graue Metallkuppel (Töne (140,140,140)/(122,122,122)/(163,163,163)) mit schwarzem Rahmen (Zeile 5, x 6–13).
* Skibrille/Visier (x 6–13, y 6–8): orange Verlauf (204,112,45) → (236,170,118), Rand schwarz — eine Skibrille, die der Kopf trägt (kein Edelstein, kein Glanz, kein Blinzeln).
* Schulterplatten (y 8–11): zwei flache Spitzen, links x 1–5, rechts x 14–19, hellgrau.
* Rumpf (x 5–15, y 11–25): langer, nach unten spitz zulaufender Metallkörper (Hammerkopf/Schild) in Grautönen (122,127,124) … (171,179,174) mit dunkler Kontur (69,72,70), in der Mitte
  ein Schlosskasten (dunkler Rahmen (69,72,70), x 8–11, y 14–19); an den Seiten helle Metallkanten (213,213,213)/(246,255,255)/(221,221,221) bei (4–5, 12–14) und (15–16, 12–14).
* Die Spitze (10, 25) steckt im Eis; von ihr gehen schwarze EISRISSE aus (reines Schwarz (0,0,0), y 21–33, x 0–21) — liegen am Boden und bleiben fest.
Fest bleiben: Risse, Helmform, Rumpfform, Spitze am Boden.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel und Glanz ausgenommen):
* ATMEN (Runde 3, ersetzt das Wackeln; nur SENKRECHT, nie seitlich): die Zeile y 16 (Panzerseite mit hellen Kantenstreifen x 5 und 15, 4 px über der Spitze) wird 0–1× zusätzlich eingefügt (L.streck_zeile, Texturmischung),
  Helm, Brille, Schulterplatten und Brustpanzer heben sich dabei starr um bis zu 1 px (Periode 24, 2× pro Schleife; die Zeile sitzt unter den Schulterplatten und über dem Schlosskasten-Ende, nichts wird breiter);
  die Spitze (10, 25) im Eis und die Risse bleiben fest. Die Glitzersterne gehen mit dem Oberkörper mit.
* VISIER = SKIBRILLE (orange Verlauf (204,112,45) → (236,170,118), schwarzer Rahmen, x 6–13, y 6–8): bleibt starr, kein Blinzeln, kein Glühen (Regel 21: Brillen/Visiere blinzeln nicht).
* Glanz (Metall — Regel 12/14): ein Lichtband läuft diagonal (x + y) über die grauen Metallflächen (Visier und Risse ausgenommen), jede getroffene Farbe zwei Stufen heller auf der Rampe der
  Grautöne des Sprites; zweimal pro Schleife (Start Frame 4 und 28, 15 Frames). Beim Vorbeilaufen blitzen vierzackige Glitzersterne (3 Frames, Arme 1 → 2 → 1 px; Mitte (246,255,255),
  Arme (213,213,213)) an der hellen Kante links (4,13), am Helm (11,2) und an der hellen Kante rechts (16,13); sie gehen mit dem Atmen mit.
* Frostnebel (Partikel, hinter der Figur, 7 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, 2×2 → 3×3 → 2×2): helle Dunstwölkchen (Kern (213,213,213),
  Rand (171,179,174)) steigen aus den Eisrissen neben dem Körper auf. Sie bleiben nah an der Figur (Zuschnitt, s. u.).
Regel 14: Glanz nur auf Metall; Regel 15 entfällt (Runde 2: Wölkchen nie kleiner als 2×2, Regel 25). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Farbe Schwarz) in jeder Pose; im Ruhebild nichts.
ERGÄNZUNG: keine gemalten Pixel. Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel und Sterne vergrößern ihn höchstens 2 px über den Figurenrand hinaus,
dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 8, 8, 8, 4

spr = L.lade('hammer-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
SCHWARZ = (0, 0, 0)
schwarz = vorhanden & (spr[..., :3] == np.array(SCHWARZ)).all(axis=2)

# --- Risse: schwarze Pixel unterhalb y 21, die nicht zur Kontur des Rumpfes gehören (Kontur = je Zeile das schwarze Pixel direkt links/rechts der grauen Rumpfpixel) ---
risse = np.zeros_like(schwarz)
for y in range(21, sh):
    nicht_schwarz = [x for x in range(sw) if vorhanden[y, x] and not schwarz[y, x]]
    lo, hi = (min(nicht_schwarz), max(nicht_schwarz)) if nicht_schwarz else (None, None)
    for x in range(sw):
        if schwarz[y, x] and not (nicht_schwarz and x in (lo - 1, hi + 1)):
            risse[y, x] = True
figur = vorhanden & ~risse
assert (figur | risse).sum() == vorhanden.sum()
UMRISS = U.umrissfarben(spr)
KANTE = U.kanten(spr)                                            # Randpixel des Sprites: das Lichtband hellt sie nicht auf (sonst entstünden Nasen an der Kontur)

VISIER_FARBEN = {(204, 112, 45), (222, 152, 101), (236, 170, 118), (216, 132, 62), (156, 64, 13)}
VISIER = [(x, y) for y in range(6, 9) for x in range(sw) if vorhanden[y, x] and col(x, y) in VISIER_FARBEN]
assert len(VISIER) == 20

# Metall-Rampe: die Grautöne des Sprites nach Helligkeit; ein Lichtband hebt jede Farbe um zwei Stufen
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and col(x, y) not in VISIER_FARBEN and col(x, y) != SCHWARZ}, key=lambda c: sum(c))
RAMPE = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}
BAND_START = (4, 28)
STERNE = [((4, 13), 5), ((11, 2), 3), ((16, 13), 11)]        # (Position im Sprite, Frames nach Bandstart, an denen der Stern aufblitzt)
STERN_MITTE, STERN_ARM = (246, 255, 255), (213, 213, 213)
assert col(4, 13) == STERN_MITTE and STERN_ARM in GRAU

FROST = {'c': (213, 213, 213), 'r': (171, 179, 174)}
assert all(v in GRAU for v in FROST.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(3, 24)[0], y=P(3, 24)[1], vx=-1, vy=-12, off=0, wackeln=1),          # links aus dem Riss
    dict(x=P(17, 24)[0], y=P(17, 24)[1], vx=1, vy=-12, off=14, wackeln=1),        # rechts
    dict(x=P(5, 27)[0], y=P(5, 27)[1], vx=-1, vy=-10, off=28, wackeln=1),
    dict(x=P(15, 27)[0], y=P(15, 27)[1], vx=1, vy=-10, off=42, wackeln=1),
    dict(x=P(2, 22)[0], y=P(2, 22)[1], vx=-1, vy=-8, off=7, wackeln=1),
    dict(x=P(19, 22)[0], y=P(19, 22)[1], vx=1, vy=-8, off=33, wackeln=1),
    dict(x=P(10, 30)[0], y=P(10, 30)[1], vx=0, vy=-9, off=21, wackeln=1),
]
ZEILE_ATMEN = 16                                                # Zeile, die beim Atmen zusätzlich eingefügt wird (Brustpanzer unter den Schulterplatten)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def atem(i):
    """0 oder 1 zusätzliche Zeile (Periode 24, 2× pro Schleife), 0 bei i = 0."""
    return U.stufe(i, 24, 1)


def frame_gross(i, nur=None):
    n = atem(i)
    fg = teil(figur)
    for start in BAND_START:                                      # Lichtband diagonal über das Metall (ohne Visier, ohne Schwarz)
        j = i - start
        if 0 <= j <= 14:
            d = 6 + 2 * j
            for y in range(sh):
                for x in range(sw):
                    if figur[y, x] and not KANTE[y, x] and d <= x + y < d + 3:
                        c = col(x, y)
                        if c in RAMPE and c not in VISIER_FARBEN:
                            fg[GPT + y, GPL + x, :3] = RAMPE[c]
    fg = TX.streck_zeile(fg, GPT + ZEILE_ATMEN, n)
    ri = teil(risse)
    koerper = L.zusammen(H, W, [(ri, 0, 0), (fg, 0, 0)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ)
    if nur == 'koerper':
        return koerper
    sterne = L.leer(H, W)
    for (pos, nach) in STERNE:
        for start in BAND_START:
            k = i - (start + nach)
            if 0 <= k <= 2:
                L.einsetzen(sterne, U.stern_ebene(H, W, GPL + pos[0], GPT + pos[1] - n, (2, 3, 2)[k], STERN_MITTE, STERN_ARM))
    frost = _glut(H, W, i, N, PUFFS, FROST)
    return L.zusammen(H, W, [(frost, 0, 0), (koerper, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]
TEST_EBENEN = 'koerper'                              # Randpixel-Test: nur Figur (ohne Frostnebel/Sterne)


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel und Sterne dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh), rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('hammer-skeleton', 'Hammer Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hammer-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
