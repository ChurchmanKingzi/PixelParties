# -*- coding: utf-8 -*-
"""Idle-Animation für „Grunge Harpyformer“ (Creature) — helle Harpyie mit E-Gitarre steht am Boden, schlägt mit dem Flügel die Saiten an und bangt mit dem Kopf.

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
* Flügel (x 12–27, y 12–19): hell-blau-weiße Federn (246,255,255) (180,246,255) (139,213,255) (106,197,255) liegen wie ein Arm quer vor dem Oberkörper: Schulter/Wurzel rechts (x 21–27, y 12–17, rechts
  dunkelblauer Umriss (2,2,14) (40,42,55) (60,65,77)), die Federn laufen nach links über den Gitarrenkorpus bis zur Spitze (x 12–16, y 13–15) und ein weißer Federzipfel (242,255,255) zeigt von (17,17)
  über (16,18) nach (15,19) schräg nach unten links. Das ist der SCHLAGFLÜGEL: seine Spitze liegt über den Saiten am Korpus. Darunter ein gelb-oranger Gürtel/Anhänger (x 20–23, y 18–19) in Gold
  (255,180,24) (255,222,90) (230,131,16).
* E-Gitarre: Kopfplatte links oben (x 0–6, y 2–6) in Orange-Rot (254,83,27) (255,166,58) (120,42,2), Hals schräg nach unten rechts (x 3–12, y 5–15) grau-schwarz (172,177,179) (62,56,50) (102,81,74),
  Korpus (x 6–19, y 13–21) dunkelgrau-violett (98,77,82) (66,44,49) (26,33,39) (166,168,181). Dazu ein Gurt (x 6–15, y 6–13): dunkle Diagonale (66,44,49) (164,141,144) (206,185,190) von der Schulter zum Korpus.
  Die Gitarre hängt am Gurt und wird von der anderen (nicht sichtbaren) Hand am Hals gehalten — sie bleibt FEST (Regel 28: nichts bewegt sich unabhängig von den Händen).
* Beine/Füße (x 12–27, y 20–23): zwei braune Krallenfüße (230,131,82) (189,90,57) (148,65,24) mit weißen Krallenspitzen (13,23) (16,23) (23,23) (26,23).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie STEHT am Boden, nichts schwebt (Nutzer-Feedback „soll nicht schweben und mit dem Flügel Saiten anschlagen“):
* Saiten anschlagen (Periode 16 Frames, drei Doppelschläge pro Schleife: kräftiger Abschlag, 8 Frames später ein kleinerer): die Federn des Schlagflügels (x 12–20, y 12–19) wandern spaltenweise senkrecht nach
  unten über die Saiten (Spitze bis 3 px, die Schulter x ≥ 21 bleibt, die Federtextur bleibt, nichts wird kopiert), schnell hinunter (2 Frames), langsam zurück (5 Frames). Der weiße Federzipfel
  (15,19)/(16,18) wandert wie die Spalte x 17 mit, damit er an der Flügelkante hängen bleibt.
* Kopfbangen im Takt: Kopf (Haare, Gesicht, Ohren) senkt sich 1–2 px kurz nach dem Abschlag und kommt zurück — nur Heben/Senken, nie seitlich; er liegt dabei vor dem Hals/Gefieder.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (246,205,139).
* Kein Glanz: Haare, Federn, Haut sind kein Metall; Gitarre, Saiten und Gürtelanhänger sind nicht sicher als Metall/Gold zu erkennen (der Anhänger ist 4×2 px groß) — im Zweifel weggelassen.
* Fest bleiben: Gitarre samt Gurt, Füße, Flügelwurzel, Gürtel.

Nicht enthalten: die Flammenwand und das Glutleuchten der Karte (Szene, 70×37 px; mit ihr wäre der Frame mehr als doppelt so breit wie die Figur). Falls der Nutzer das Feuer als Teil der Figur will, steht die Ebene
bereit (MotiveDeri 40, Flammen nach Regel 15 animierbar) — das ist eine Entscheidung des Nutzers.
Ergänzungen: Der Schlagflügel gibt beim Abschlag seine oberen Zellen frei (x 12–20, y 13–14 und tiefer), dahinter ist in der Quelle nichts gezeichnet. Diese Zellen (FUELL, ca. 40 Pixel) bekommen die Farbe des ersten
sichtbaren Pixels darüber (Gurt (66,44,49) (206,185,190) bei x 13–16, Kinn-/Halshaut und Umriss bei x 17–20), der Gurt läuft also hinter dem Flügel weiter — in Frame 0 bleibt alles verdeckt (Ruhepose = Original).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B
import anim_harpyA as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 2                    # oben: Kopfbangen geht nach unten, Rand 2 + 1

spr = L.lade('grunge-harpyformer')                         # Figur (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

# ── Teile trennen (Farbe + Bereich; Koordinaten = Sprite) ────────────────────────────────────────────────────────────
STRAP_FARBEN = [(66, 44, 49), (164, 141, 144), (206, 185, 190)]
FLUEGEL_FARBEN = [(246, 255, 255), (242, 255, 255), (255, 255, 255), (226, 226, 226), (180, 246, 255), (172, 213, 255), (139, 213, 255), (106, 197, 255), (222, 255, 255)]
M_STRAP = fig & L.farbmaske(spr, STRAP_FARBEN) & (xx <= 15) & (yy >= 6) & (yy <= 13)
M_FUESSE = fig & (yy >= 22)
M_KOPF = fig & (yy <= 11) & (xx >= 13) & ~M_STRAP
M_FL = fig & (yy >= 12) & (yy <= 19) & (xx >= 12) & (xx <= 20) & L.farbmaske(spr, FLUEGEL_FARBEN) & ~M_KOPF      # Schlagflügel: Federn links der Schulter (x ≥ 21 bleibt)
M_REST = fig & ~(M_KOPF | M_FL | M_FUESSE)                                                                       # Gitarre, Gurt, Körper, Flügelwurzel
SPITZE = {(16, 18), (15, 19)}                                                                                    # weißer Federzipfel: wandert wie die Spalte x 17 mit


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


KOPF, FL, FUESSE, REST = teil(M_KOPF), teil(M_FL), teil(M_FUESSE), teil(M_REST)
HAUT = (246, 205, 139)
AUGEN = [(17, 8), (18, 8), (21, 8), (22, 8)]               # Pupille + Iris → Lid in Hautfarbe

# Ergänzung (verdeckt): die Zellen des Schlagflügels bekommen die Farbe des ersten sichtbaren Pixels darüber (Gurt läuft weiter, darunter Hals/Kinn), nur für die Zellen,
# die beim Abschlag frei werden können (alle Zellen des Flügels, die ein Pixel darüber haben)
_bezug = L.platz(np.where((M_REST | M_KOPF)[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
FUELL = A.unter_fuellen(L.leer(H, W), _bezug, L.platz(np.where(M_FL[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)[..., 3] > 0, richtung=(0, -1), weite=6)
ERGAENZT = int((FUELL[..., 3] > 0).sum())

_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (43, 4, 0), 2: (43, 4, 0), 3: (49, 24, 0), 4: (2, 2, 14), 5: (62, 56, 50), 6: (43, 4, 0), 7: (66, 44, 49)}     # 1 Rest, 2 Füße, 4 Flügel, 6 Kopf, 7 Füllung


# ── Saiten anschlagen ────────────────────────────────────────────────────────────────────────────────────────────────
STRUM = [0.0, 0.5, 1.0, 0.9, 0.6, 0.35, 0.15, 0.05,        # kräftiger Abschlag: schnell hinunter (2 Frames), langsam zurück
         0.0, 0.4, 0.75, 0.65, 0.4, 0.2, 0.08, 0.0]        # kleinerer Abschlag
A_TIEF = 3.0                                                # Weg der Federspitze (x 12) bei vollem Schlag, px
X_SCHULTER, MAXD = 21, 9                                    # Federspalten x 12…20: Abstand 9…1 von der Schulter


def strum(t):
    return STRUM[t % len(STRUM)]


def dy_spalte(x, u):
    return A.runde(A_TIEF * u * abs(x - (PAD_L + X_SCHULTER)) / float(MAXD))


def schlagfluegel(a, t):
    """Jede Federspalte wandert als Ganzes senkrecht nach unten (Schlag über die Saiten); die Zipfelpixel gehen mit der Spalte x 17."""
    u = strum(t)
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y, x in zip(*np.nonzero(a[..., 3] > 0)):
        x, y = int(x), int(y)
        xs = PAD_L + 17 if (x - PAD_L, y - PAD_T) in SPITZE else x
        dy = dy_spalte(xs, u)
        if not 0 <= y + dy < h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        out[y + dy, x] = a[y, x]
    return out


# Kopfbangen: folgt dem Abschlag mit 1–2 Frames Verzug (Frame 0 = Ruhelage); Hub 0…2 px
BANG = [0, 0, 1, 2, 2, 1, 1, 0,
        0, 0, 1, 1, 1, 0, 0, 0]


def bang(t):
    return BANG[t % len(BANG)]


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


TEST_EBENEN = ('figur',)


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    schichten = []
    if 'figur' in ebenen:
        kopf = KOPF
        if blinzeln(i):
            kopf = kopf.copy()
            for (x, y) in AUGEN:
                kopf[PAD_T + y, PAD_L + x, :3] = HAUT
        schichten += [(FUELL, 0, 0, 7), (REST, 0, 0, 1), (FUESSE, 0, 0, 2), (schlagfluegel(FL, i), 0, 0, 4), (kopf, 0, bang(i), 6)]
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
