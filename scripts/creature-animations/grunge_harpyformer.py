# -*- coding: utf-8 -*-
"""Idle-Animation für „Grunge Harpyformer“ (Creature) — helle Harpyie mit E-Gitarre, bangt mit dem Kopf und schwebt im Takt.

PICK: [["MotiveDeri", 41, "Ebene „Grunge Harpyformer #1“, linke Figur (Harpyie mit Gitarre, x 0–27 der 99 px breiten Ebene)"]]
Quelle: MotiveDeri.xcf, Ebene 41 „Grunge Harpyformer #1“ (Versatz (268, 351)); die Ebene enthält zwei Figuren nebeneinander. Verwendet ist nur die LINKE (x 0–27, y 5–28 → src/grunge-harpyformer.png,
28×24). Die rechte (x 70–98: dunkelrote Harpyie mit grauen Flügeln, ohne Gitarre) steht NICHT in der Kartenkunst und wurde nicht verwendet.
Abgleich mit der Kartenkunst (data/card-art/native/Grunge_Harpyformer.png, 76×51; Kartenursprung in der xcf (250, 342)): Die Feuerebene „#7“ (MotiveDeri 40) trifft bei Kartenpixel (2, 12), die Figur sitzt an Kartenpixel
(18, 14) — dort liegt in der Karte die helle Harpyie mit der Gitarre (Kopf und Wangen sind in der Karte durch Feuerglut-Dither und Flammenspitzen überdeckt, deshalb stimmt der Farbvergleich nur zu ~36 %).
Die übrigen Ebenen der Karte sind Szene und gehören nicht zur Creature: Bühnenhintergrund (Ebene 46 „Grunge Harpyformer“: grüner Vorhang + Holzboden), die Flammenwand im Vordergrund
(Ebene 40 „#7“, 70×37 px), das Glutleuchten (Ebene 28 „#2“, ganzflächig, weiche Alpha) und das Publikum unten (schwarzer Hut, grüner Haarschopf: Ebene 39 „#4“).

Aufruf:   python3 grunge_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/grunge-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y; Ursprung = Ebene (268, 356)):
* Harpyie (x 11–27, y 0–23): helle Haare (254,237,216) (254,249,239) (212,175,146) mit dunkelbraunem Umriss (43,4,0) und Ohren rechts (x 25–27, y 7–9); Gesicht mit rosa Wangen
  (176,82,114) (238,176,197), schwarze Brauen (17–18,6) (21–22,6), Augen: schwarze Pupille + hellblaue Iris (17,8) (18,8) und (21,8) (22,8).
* Flügel (x 14–27, y 12–19): hell-blau-weiße Federn (246,255,255) (180,246,255) (139,213,255) (106,197,255) liegen wie Arme/Brustgefieder vor dem Oberkörper und halten die Gitarre; rechts dunkelblauer
  Umriss (2,2,14) (40,42,55) (60,65,77). Darunter ein gelb-oranger Gürtel/Anhänger (x 20–23, y 18–19) in Gold (255,180,24) (255,222,90) (230,131,16).
* E-Gitarre: Kopfplatte links oben (x 0–6, y 2–6) in Orange-Rot (254,83,27) (255,166,58) (120,42,2), Hals schräg nach unten rechts (x 3–12, y 5–15) grau-schwarz (172,177,179) (62,56,50) (102,81,74),
  Korpus (x 6–17, y 14–21) dunkelgrau-violett (98,77,82) (66,44,49) (26,33,39) (166,168,181). Dazu ein Gurt (x 6–15, y 6–13): dunkle Diagonale (66,44,49) (164,141,144) (206,185,190) von der Schulter zum Korpus.
* Beine/Füße (x 12–27, y 20–23): zwei braune Krallenfüße (230,131,82) (189,90,57) (148,65,24) mit weißen Krallenspitzen (13,23) (16,23) (23,23) (26,23).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend im festen Rhythmus: ein Schlag = 12 Frames (780 ms), 4 pro Schleife; Abschlag 5 Frames. Die Federspalten des Brustgefieders (x 19–27, y 12–17) wandern als Ganzes senkrecht,
  bis 2 px nach unten (Exponent 1,15, rechter Rand zuletzt, 1 Frame Nachlauf); die oben frei werdenden Zellen füllt das oberste Federpixel der Spalte (bleibt am Hals). Federtextur bleibt, nichts wird kopiert.
* Schwebe-Bob: die ganze Figur (samt Gitarre) hebt sich im Takt bis 2 px (am höchsten in der Schlagmitte); die Füße baumeln nach (60 %, 1,5 Frames verzögert, die Lücke füllen doppelte Fußzeilen).
* Kopfbangen: Kopf (Haare, Gesicht, Ohren) nickt schnell nach unten und zurück, bis 2 px, Periode 8 Frames (sechs Mal pro Schleife) — gegen den Flügelschlag versetzt; er liegt dabei vor dem Hals/Gefieder.
* Gitarre schwingt: Kopfplatte und Hals (Spalten x ≤ 11) pendeln um den Korpus, Kopfplatte bis 2 px nach unten und zurück, Periode 16 Frames.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (246,205,139).
* Kein Glanz: Haare, Federn, Haut sind kein Metall; Gitarre und Gürtelanhänger sind nicht sicher als Metall/Gold zu erkennen (der Anhänger ist 4×2 px groß) — im Zweifel weggelassen.

Nicht enthalten: die Flammenwand und das Glutleuchten der Karte (Szene, 70×37 px; mit ihr wäre der Frame mehr als doppelt so breit wie die Figur). Falls der Nutzer das Feuer als Teil der Figur will, steht die Ebene
bereit (MotiveDeri 40, Flammen nach Regel 15 animierbar) — das ist eine Entscheidung des Nutzers.
Ergänzungen: keine nötig — die Ebene enthält die Figur vollständig (die Karte verdeckt sie nur durch das Feuer davor).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2                    # oben: Hub 2 px + Rand 2

spr = L.lade('grunge-harpyformer')                         # Figur (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

# ── Teile trennen (Farbe + Bereich; Koordinaten = Sprite) ────────────────────────────────────────────────────────────
STRAP_FARBEN = [(66, 44, 49), (164, 141, 144), (206, 185, 190)]
FLUEGEL_FARBEN = [(246, 255, 255), (242, 255, 255), (255, 255, 255), (226, 226, 226), (180, 246, 255), (172, 213, 255), (139, 213, 255), (106, 197, 255),
                  (255, 246, 172), (2, 2, 14), (40, 42, 55), (60, 65, 77), (166, 168, 181)]
M_STRAP = fig & L.farbmaske(spr, STRAP_FARBEN) & (xx <= 15) & (yy >= 6) & (yy <= 13)
M_FUESSE = fig & (yy >= 22)
M_KOPF = fig & (yy <= 11) & (xx >= 13) & ~M_STRAP
M_FLUEGEL = fig & (yy >= 12) & (yy <= 17) & (xx >= 19) & L.farbmaske(spr, FLUEGEL_FARBEN) & ~M_KOPF
M_GITARRE = fig & (xx <= 11) & ~M_STRAP & ~M_KOPF
M_REST = fig & ~(M_KOPF | M_FLUEGEL | M_GITARRE | M_FUESSE)


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


KOPF, FLUEGEL, GITARRE, FUESSE, REST = teil(M_KOPF), teil(M_FLUEGEL), teil(M_GITARRE), teil(M_FUESSE), teil(M_REST)
HAUT = (246, 205, 139)
AUGEN = [(17, 8), (18, 8), (21, 8), (22, 8)]               # Pupille + Iris → Lid in Hautfarbe

_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (43, 4, 0), 2: (43, 4, 0), 3: (49, 24, 0), 4: (2, 2, 14), 5: (62, 56, 50), 6: (43, 4, 0)}     # 1 Rest, 2 Füße, 3 Gitarre/Gurt…, 4 Flügel, 5 Gitarre, 6 Kopf


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_FL = 2.0
X_FL, MAXD_FL = 18, 9                                      # Gefieder x 19–27 (Abstand 1…9 von x 18)


def welle(t):
    """Schlagphase 0 (Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t, amp):
    def dy(f):
        return amp * (welle(t - LAG * f) - welle(-LAG * f)) * f ** POT
    return dy


# ── Schwebe-Bob, Füße, Kopf, Gitarre, Blinzeln ───────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    """Anhebung in px (0 = Original), am höchsten in der Schlagmitte."""
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    """Füße baumeln nach: 1,5 Frames verzögert, zu 60 % (nie höher als der Körper)."""
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


def kopf_nick(t):
    """Kopf senkt sich relativ zum Körper um 0…2 px (Periode 8 Frames, sechs Mal pro Schleife), Frame 0 = Ruhelage."""
    return int(round(1.0 * (1.0 - math.cos(2 * math.pi * t / 8.0))))


def gitarre_dy(t):
    """Kopfplatte senkt sich um bis 2 px (Periode 16), Frame 0 = Ruhelage."""
    s = 0.5 - 0.5 * math.cos(2 * math.pi * t / 16.0)

    def dy(f):
        return 2.2 * s * f
    return dy


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


TEST_EBENEN = ('figur',)


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    n, k = hub(i), fuss_hub(i)
    schichten = []
    if 'figur' in ebenen:
        kopf = KOPF
        if blinzeln(i):
            kopf = kopf.copy()
            for (x, y) in AUGEN:
                kopf[PAD_T + y, PAD_L + x, :3] = HAUT
        fuesse = FUESSE
        if n - k > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + 22, n - k)             # Füße: Lücke füllen doppelte oberste Fußzeile
        gitarre = B.spalten_schub(GITARRE, PAD_L + 12, gitarre_dy(i), 12)
        fl = B.spalten_schub_gefuellt(FLUEGEL, PAD_L + X_FL, dy_fn(i, A_FL), MAXD_FL)
        schichten += [(REST, 0, -n, 1), (fuesse, 0, -k, 2), (gitarre, 0, -n, 5), (fl, 0, -n, 4), (kopf, 0, -n + kopf_nick(i), 6)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('grunge-harpyformer', 'Grunge Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/grunge-harpyformer-strip.png', frames, spalten=8, scale=8)
