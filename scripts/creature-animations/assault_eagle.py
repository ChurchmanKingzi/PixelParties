# -*- coding: utf-8 -*-
"""Idle-Animation für „Assault Eagle“ (Creature) — schwarzer Adler, fliegt (Dauerschlag + Bob).

PICK: [["MotiveSteamDwarfs", 298, "größte Figur unten links (Ausschnitt x 0–46, y 63–89)"]]
Quelle: src/assault-eagle.png — Ebene „Assault Eagle“ (47×27 px, 7 Farben) aus MotiveSteamDwarfs.xcf. Die Ebene enthält außerdem drei kleine Seitenansichten
des Adlers (24×16 px, Flug-/Sturzposen) — sie sind auf der Karte nicht zu sehen und werden nicht verwendet. Die Karte zeigt zusätzlich eine halbtransparente
Bewegungsspur („Ebene #285“, 71×22 px, weiche Alphaverläufe) an den Flügelspitzen; sie ist kein Sprite (Alpha) und bleibt weg.

Aufruf:   python3 assault_eagle.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/assault-eagle.png + .json

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 23 in der Form, die Federstriche sind leicht verschieden):
* Schwarzer Adler von vorn/oben, schwarz (0,0,0) mit dunkelgrauen (63,63,63), mittelgrauen (127,127,127) und hellgrauen (191,191,191) Federstrichen. Alles ist schwarz umrandet.
* Flügel: links x 0–17, rechts x 29–46 (y 0–21): sieben Reihen waagerechter Federstriche; der Ansatz sitzt an den Schultern bei x 17 / 29.
* Körper/Kopf (x 18–28, y 0–21): Kopf oben (y 0–10) mit hellgrauem Schnabelstrich (21–25, 3) und gelben Augen — je ein L aus drei Pixeln: links (21,6), (21,7), (22,7), rechts (25,6), (25,7), (24,7)
  in (238,238,172), (238,238,0), (193,193,0); darunter die Brust mit grauen Federn.
* Krallen/Beine: zwei schwarze Läufe mit grauem Fuß (18–20, 22–26) und (26–28, 22–26).

Ablauf (48 Frames à 65 ms = 3,12 s) — er FLIEGT:
* Flügelschlag, durchgehend: ein Schlag = 12 Frames (0,78 s), 4 Schläge pro Schleife; Abschlag 5 Frames, Aufschlag 7 Frames. Jede Flügelspalte wandert als Ganzes senkrecht
  (Federtextur bleibt, nichts kopiert): Spitze 6 px hoch bis 5 px tief, der Betrag wächst mit dem Abstand vom Ansatz; die Spitzen hinken 1 Frame nach. Der rechte Flügel schlägt 0,3 Frames später.
* Bob: die ganze Figur hebt und senkt sich im Takt um ±2 px (oben kurz nach dem Abschlag unten). Die Krallen baumeln nach (60 %, 1,5 Frames verzögert, Lücke füllen doppelte Zeilen).
* Der Adler blinzelt zweimal pro Schleife (Frames 14–16 und 38–40): die gelben Augenpixel werden schwarz (Lid = Körperfarbe).
* Federflocken (Partikel): graue Punkte sinken langsam unter den Flügeln, nahtlos. Kein Glanz (Federn sind kein Metall).

Ergänzungen: keine nötig — Flügel und Körper berühren sich nur an der Naht (x 17/18 und 28/29); die Flügel überdecken nichts.
Randpixel-Test (Regel 16): verschobene Federspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel werden in Umrissschwarz (0,0,0) gesetzt (B.umriss_je_ebene).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Schlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 6, 5

spr = L.lade('assault-eagle')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
xx = np.arange(sw)

# ── Teile auf die volle Leinwand legen (Regel 3) ──────────────────────────────────────────────────────────────────────
def teil(maske):
    t = np.where(maske[None, :, None], spr, 0).astype(np.uint8)
    return t


FL_L = L.platz(teil(xx <= 17), H, W, PAD_L, PAD_T)
FL_R = L.platz(teil(xx >= 29), H, W, PAD_L, PAD_T)
KOERPER = teil((xx >= 18) & (xx <= 28))
CUT = 22                                                    # ab dieser Zeile (Sprite) beginnen die Krallen
KOERPER_OBEN = L.platz(KOERPER.copy(), H, W, PAD_L, PAD_T); KOERPER_OBEN[PAD_T + CUT:] = 0
KRALLEN = L.platz(KOERPER.copy(), H, W, PAD_L, PAD_T); KRALLEN[:PAD_T + CUT] = 0

SCHWARZ = (0, 0, 0)
ERLAUBT = {SCHWARZ}                                         # Umrissfarben der Quelle (alle Randpixel sind schwarz)
EBENEN_FARBE = {1: SCHWARZ, 2: SCHWARZ, 3: SCHWARZ}
AUGEN = [(21, 6), (21, 7), (22, 7), (25, 6), (25, 7), (24, 7)]
assert all(int(spr[y, x, 0]) > 150 for (x, y) in AUGEN)    # gelbe Augenpixel


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
A_UNTEN, A_OBEN, POT, LAG = 5.0, 6.0, 1.15, 1.0


def welle(t):
    """Schlagphase 0 (Flügel oben) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def fluegel(ebene, pivot_x, t):
    def dy(f):
        w = welle(t - LAG * f)
        return (A_UNTEN * w - A_OBEN * (1.0 - w)) * f ** POT
    return B.spalten_schub(ebene, pivot_x, dy)


# ── Flug: ganze Figur hebt/senkt sich im Takt ──────────────────────────────────────────────────────────────────────────
BOB_AMP, BOB_MAX_T = 2.4, 5.5


def bob(t):
    """Versatz in px (negativ = oben): hoch kurz nach dem Abschlag unten, tief am Ende des Aufschlags."""
    return -int(round(BOB_AMP * math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT)))


def kralle_versatz(t):
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def blink(i):
    for s in (14, 38):
        if 0 <= (i - s) % N < 3:
            return True
    return False


# ── Partikel: graue Federflocken, sinken langsam ────────────────────────────────────────────────────────────────────────
FEDER = {'c': (127, 127, 127), 'r': (63, 63, 63)}
PUFFS = [
    dict(x=px(1, 8)[0], y=px(1, 8)[1], vx=-1, vy=14, off=0, form='k', wackeln=1),
    dict(x=px(10, 22)[0], y=px(10, 22)[1], vx=1, vy=7, off=12, form='k', wackeln=2),
    dict(x=px(36, 22)[0], y=px(36, 22)[1], vx=-1, vy=7, off=24, form='k', wackeln=2),
    dict(x=px(45, 8)[0], y=px(45, 8)[1], vx=1, vy=14, off=36, form='k', wackeln=1),
    dict(x=px(2, 16)[0], y=px(2, 16)[1], vx=-1, vy=12, off=18, form='k', wackeln=1),
    dict(x=px(44, 16)[0], y=px(44, 16)[1], vx=1, vy=12, off=42, form='k', wackeln=1),
]
TEST_EBENEN = ('fluegel', 'koerper')                        # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    dy_u, dy_k = bob(i), kralle_versatz(i)
    schichten = []
    if 'fluegel' in ebenen:
        schichten += [(fluegel(FL_L, PAD_L + 17, i), 0, dy_u, 1), (fluegel(FL_R, PAD_L + 29, i - 0.3), 0, dy_u, 2)]
    if 'koerper' in ebenen:
        oben = KOERPER_OBEN.copy()
        if blink(i):
            for (x, y) in AUGEN:
                oben[PAD_T + y, PAD_L + x, :3] = SCHWARZ              # Lid = Körperfarbe
        krallen = KRALLEN
        if dy_k - dy_u > 0:
            krallen = L.streck_zeile(krallen, PAD_T + CUT + 1, dy_k - dy_u)
        schichten += [(oben, 0, dy_u, 3), (krallen, 0, dy_k, 3)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel:
        f = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS, FEDER), 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('assault-eagle', 'Assault Eagle', frames, MS, prev)
    if prev:
        L.streifen(prev + '/assault-eagle-strip.png', frames, spalten=8, scale=5)
