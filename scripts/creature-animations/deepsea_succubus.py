# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Succubus“ (Creature).

Quelle: src/deepsea-succubus.png — Ebene „Succubus“ (46×27 px, 571 Pixel, alle deckend) aus MotiveDeepsea.xcf (Ebene 294) PLUS die kleine Ebene „Ebene #4“ (293, 3×3 px, 6 rosa Pixel: ein Herz), die in der
Kartenkunst genau bei (26–28, 9–11) im Gesicht liegt und sonst als Teil der Figur fehlen würde. Gegen die Kartenkunst abgeglichen (data/card-art/native/Deepsea_Succubus.png ist 152×102, also doppelt aufgelöst; auf
76×51 heruntergerechnet liegt die Ebene bei (17, 15)): gleiche Form, Position und Größe; die Karte zeigt zusätzlich einen hellen Schein hinter dem Kopf (eigene Glühebene) und tönt alles blau, deshalb nur
Korrelation 0,84. Zwei weitere Ebenen in der Nähe („Ebene #3“, „Ebene #147“) sind blaue Funken/Deko und nicht Teil der Figur.
PICK: [["MotiveDeepsea", 294, 1], ["MotiveDeepsea", 293, 1]]

Aufruf:   python3 deepsea_succubus.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-succubus.png + .json

Was ist was (x/y im Sprite):
* Ein schwebender Succubus mit zwei großen Fledermausflügeln in Teal-Karo (51,93,119)/(77,137,154) mit dunkelblauen Flächen (13,16,49)/(24,39,65)/(30,48,81): Flügel links x 0–14, rechts x 31–45 (y 2–22,
  Knochen als dunkle Streben, Membran im Karo), dunkler Kopf/Haarmasse mit Hornspitzen oben (x 15–29, y 0–9), im Haar rechts ein blassgrüner Edelstein (159,222,211) 2×2 bei (25–26, 3–4);
  Gesicht bei y 9–12 mit zwei Augen: links ein weißes 2×2-Auge (246,255,255) bei (20–21, 10–11), rechts (statt eines zweiten Auges) ein rosa Herz (255,147,208)/(255,176,221)/(210,82,154) bei (26–28, 9–11), das KEIN Auge ist;
  schmaler Rumpf (x 17–28, y 11–22) und kurze Beine mit Füßen (x 19–26, y 23–26).
Fest bleiben: Kopf-/Haarmasse, Rumpf, Augen-/Herzform im Ruhebild, Karomuster der Membran/Haut.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Partikel ausgenommen):
* Flügelschlag (RUNDE 2, Nutzer: „die Flügel sollen deutlich mehr schlagen“): beide Flügel (links x 0–14, rechts x 31–45, y 2–22: Knochenstreben + Karo-Membran) schlagen jetzt kräftig gleichzeitig: Periode 16 Frames (1,12 s, dreimal pro Schleife; vorher ±3 px, Periode 24).
  Jeder Flügel BIEGT sich entlang seiner waagerechten Mittellinie um die Schulter (x 15 bzw. 30, y 12; anim_flieger_r2.biege = Rückwärtsabbildung um eine gekrümmte Achse: jedes Zielpixel holt sich das Quellpixel an derselben Bogenlänge/Querstelle, Nächster-Nachbar,
  keine Löcher, keine Mischfarben, Knochen und Membran bleiben zusammen, die Schulter bleibt am Rumpf): die Flügelspitze schlägt von der Ruhelage bis ca. 50° nach oben und ca. 20° nach unten (Spitze ca. −9 … +4 px), die Spitze hinkt der Wurzel um 0,5 rad nach. Frame 0 = Original.
* Brüste bouncen (RUNDE 3, Nutzer: „aktuell bewegt sich der komplette Oberkörper hoch und runter, statt dass nur die Brüste bouncen“): das Schweben des ganzen Körpers (±1 px) ist ENTFALLEN — Kopf, Rumpf, Flügelansätze und Füße
  stehen fest. Nur die beiden Brusthügel (links x 19–22, rechts x 23–26, je y 15–20; Lichtpunkte (21,17)/(25,17) mit Schatten darunter) federn als Blöcke um −2…+2 px (Periode 16 Frames, zwei Harmonische für das Nachschwingen: dy = round(1,5·sin φ + 0,7·sin 2φ));
  die frei werdenden Zeilen oben/unten werden mit den Hautzeilen darüber/darunter gefüllt (Quellfarben, nichts gestreckt, kein Umriss verdickt). Frame 0 = Original.
* Füße baumeln: die beiden Fußzeilen (y 26) versetzen sich abwechselnd 1 px zur Seite (Periode 16).
* Blinzeln (Lid = dunkle Umgebungsfarbe (13,16,49)): NUR das weiße Auge (das einzige Auge) blinzelt — erst die obere Zeile, dann alles; zweimal (Frame 11–13 und 35–37). Das rosa Herz (26–28, 9–11) ist kein Auge und bleibt IMMER offen/unverändert (Nutzer: „das Herz soll nicht blinzeln, sie hat nur ein offenes Auge“).
* Edelstein im Haar glitzert (Regel 14: nur Edelstein): ein weißer Lichtpunkt läuft diagonal über die 2×2-Fläche, dann die Gegendiagonale; zweimal pro Schleife (Frame 20–22 und 44–46).
* Partikel (hinter der Figur): vier rosa runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`), Kern (255,147,208), Rand (210,82,154) (= Farben des Herzens), nie ein Einzelpixel; sie steigen links und rechts unterhalb der
  Flügel je 11 px auf (Lebensdauer 48 Frames, je zwei um 24 Frames versetzt; links und rechts um 12 versetzt). Nur diese Bahnen sind frei: in jeder Pose ≥ 2 px Abstand zur Figur und nie teilweise verdeckt (per Skript über alle 48 Frames geprüft).
Kein Glanz außer dem Edelstein, kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_flieger_r2 as R2

N, MS = 48, 70
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-succubus')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
WEISS, EDEL = (246, 255, 255), (159, 222, 211)
PINK_K, PINK_R = (255, 147, 208), (210, 82, 154)
assert KONTUR in UMRISS

AUGE = [(20, 10), (21, 10), (20, 11), (21, 11)]
HERZ = [(26, 9), (28, 9), (26, 10), (27, 10), (28, 10), (27, 11)]
GEM = [(25, 3), (26, 3), (25, 4), (26, 4)]
assert all(col(x, y) == WEISS for (x, y) in AUGE) and all(col(x, y) == EDEL for (x, y) in GEM)
assert all(tuple(spr[y, x, :3]) in ((255, 147, 208), (255, 176, 221), (210, 82, 154)) for (x, y) in HERZ)

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {11: 1, 12: 2, 13: 1, 35: 1, 36: 2, 37: 1}                # 1 = obere Zeile zu, 2 = alles zu
GLITZ = {20: [(25, 3), (26, 4)], 21: GEM, 22: [(26, 3), (25, 4)], 44: [(25, 3), (26, 4)], 45: GEM, 46: [(26, 3), (25, 4)]}

# Teile (Masken im Sprite)
FLUEGEL_L = vorhanden & (xx <= 14)
FLUEGEL_R = vorhanden & (xx >= 31)
FUSS_L = vorhanden & (yy == 26) & (xx <= 21)
FUSS_R = vorhanden & (yy == 26) & (xx >= 24)
rest = vorhanden & ~FLUEGEL_L & ~FLUEGEL_R & ~FUSS_L & ~FUSS_R

BLASE = {'c': PINK_K, 'r': PINK_R}
P = lambda x, y: (GPL + x, GPT + y)
# Die Flügel füllen das Feld: freie Bahnen (Abstand ≥ 2 px in jeder Pose, Partikel höchstens +2 px über den Körper-Rand hinaus) liegen links und rechts unterhalb der Flügel.
PUFFS = [
    dict(x=P(4, 28)[0], y=P(4, 28)[1], vx=0, vy=-11, off=0, wackeln=0.4),
    dict(x=P(4, 28)[0], y=P(4, 28)[1], vx=0, vy=-11, off=24, wackeln=0.4),
    dict(x=P(41, 28)[0], y=P(41, 28)[1], vx=0, vy=-11, off=12, wackeln=0.4),
    dict(x=P(41, 28)[0], y=P(41, 28)[1], vx=0, vy=-11, off=36, wackeln=0.4),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


FL_A, FR_A, REST_A, FUSSL_A, FUSSR_A = teil(FLUEGEL_L), teil(FLUEGEL_R), teil(rest), teil(FUSS_L), teil(FUSS_R)


# ── Flügelschlag: Biegung entlang der Mittellinie (Schulter → Spitze) ───────────────────────────────────────────────────────────
FL_PERIODE = 16
A_FL = math.radians(34.0)                                     # Ausschlag (Spitze: ca. +50° nach oben, −20° nach unten gegenüber der Ruhelage)
LAUF = 0.5
FL_L = dict(p0=(15.0, 12.0), ang0=math.pi, laenge=15.0, seite=+1)       # linker Flügel: Achse zeigt nach links; „oben“ = im Uhrzeigersinn
FL_R = dict(p0=(30.0, 12.0), ang0=0.0, laenge=15.0, seite=-1)           # rechter Flügel: Achse zeigt nach rechts; „oben“ = gegen den Uhrzeigersinn


def fluegel(a, fl, ph):
    def delta(s):
        f = min(1.0, max(0.0, (s - 1.0) / (fl['laenge'] - 1.0)))
        v = math.sin(ph - LAUF * f) - math.sin(-LAUF * f)       # 0 bei Frame 0 (Ruhe = Original); die Spitze hinkt der Wurzel nach
        return fl['seite'] * v * A_FL * f ** 0.5                # Biegung früh (nah an der Schulter): die Spitze bewegt sich fast wie bei einer Drehung
    return R2.biege(a, (GPL + fl['p0'][0], GPT + fl['p0'][1]), fl['ang0'], fl['laenge'], delta)


BRUST_L = (19, 22)                                            # linker Brusthügel (x0, x1 einschließlich; Sprite-Koordinaten): Lichtpunkt (21,17), Schatten darunter (y 18–20)
BRUST_R = (23, 26)                                            # rechter Brusthügel: Lichtpunkt (25,17)
BRUST_Y0, BRUST_Y1 = 15, 20


def brust(kb, dy, x0_, x1_):
    """Einen Brusthügel (Block x0_..x1_, y 15–20) als Ganzes um dy ∈ {−2…+2} px versetzen; die frei werdenden Zeilen werden mit den Hautzeilen darüber bzw. darunter gefüllt (Quellfarben, nichts wird gestreckt)."""
    if dy == 0:
        return kb
    out = kb.copy()
    x0, x1 = GPL + x0_, GPL + x1_ + 1
    y0, y1 = GPT + BRUST_Y0, GPT + BRUST_Y1 + 1
    block = kb[y0:y1, x0:x1].copy()
    out[y0 + dy:y1 + dy, x0:x1] = block
    if dy > 0:
        out[y0:y0 + dy, x0:x1] = kb[y0 - dy:y0, x0:x1]            # oben: Zeilen über dem Block
    else:
        out[y1 + dy:y1, x0:x1] = kb[y1:y1 - dy, x0:x1]            # unten: Zeilen unter dem Block
    return out


def brust_dy(i):
    """Brust-Bounce (RUNDE 3): nur die Brüste federn (Periode 16 Frames, zwei Harmonische → Nachschwingen), Rumpf/Kopf/Flügelansatz bleiben stehen; Frame 0 = 0."""
    ph = 2 * math.pi * i / FL_PERIODE
    return int(round(1.5 * math.sin(ph) + 0.7 * math.sin(2 * ph)))


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def frame_gross(i, nur=None):
    ph = 2 * math.pi * i / FL_PERIODE
    kb = REST_A.copy()
    # Blinzeln (Lid = dunkle Umgebung)
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in AUGE:                                      # nur das weiße Auge; das Herz (kein Auge) bleibt unverändert
            if bl == 2 or y <= 10:
                set_px(kb, x, y, KONTUR)
    # Edelstein glitzert
    for (x, y) in GLITZ.get(i, []):
        set_px(kb, x, y, WEISS)
    # Flügelschlag (Spalte für Spalte)
    fl = fluegel(FL_A, FL_L, ph)
    fr = fluegel(FR_A, FL_R, ph)
    # RUNDE 3: kein Schweben des Oberkörpers mehr — nur die Brüste bouncen
    kb = brust(kb, brust_dy(i), *BRUST_L)
    kb = brust(kb, brust_dy(i), *BRUST_R)
    fb_l = 1 if (i % 16) in (3, 4, 5) else (-1 if (i % 16) in (11, 12, 13) else 0)
    fb_r = -fb_l
    koerper = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (kb, 0, 0), (FUSSL_A, fb_l, 0), (FUSSR_A, fb_r, 0)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    blasen = _glut(H, W, i, N, PUFFS, BLASE)
    return L.zusammen(H, W, [(blasen, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('deepsea-succubus', 'Deepsea Succubus', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-succubus-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
