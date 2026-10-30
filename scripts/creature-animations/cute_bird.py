# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Bird“ (Creature) — Harpyien-Mädchen mit Federflügeln, fliegt (Dauerschlag + Bob).

PICK: [["MotiveMoe", 440, "Flügelpaar (Komponente x 0–75, y 0–47)"], ["MotiveMoe", 439, 1], ["MotiveMoe", 437, 1], ["MotiveMoe", 438, "Hut-Vogel (Ausschnitt x 116–129, y 132–143)"]]
Quelle (alle aus MotiveMoe.xcf; die Ebenen heißen „Cute Bird #1“ = Flügel, „#2“ = Mädchen, „#3“ = Haare/Arme, „Cute Bird“ = Sammelblatt kleiner Vögel; auf der Karte
liegen sie 1:1 übereinander, die Kunst ist 76×51 px). Die Teile wurden mit ihren Ebenen-Versätzen auf eine 76×48-Leinwand gelegt und liegen als
  src/cute-bird.png            Gesamtbild (Ruhepose, Referenz für den Randpixel-Test)
  src/cute-bird-fluegel.png    Flügelpaar (voll, auch der unter dem Mädchen verdeckte Teil — die Ebene enthält die ganzen Flügel)
  src/cute-bird-maedchen.png   Mädchen ohne Flügel/Hut/Arme (voll, auch der unter Hut und Armen verdeckte Teil)
  src/cute-bird-hut.png        kleiner weißer Vogel auf ihrem Kopf
  src/cute-bird-arme.png       Haarsträhnen/Arme an ihren Seiten
vor. (Die übrigen kleinen Vögel auf der Karte — weiß-lavendel rechts, zwei dunkelgraue unten — sind eigene Tiere der Kunst und nicht Teil dieser Figur.)

Aufruf:   python3 cute_bird.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-bird.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Linker Flügel: lavendel-weiß (x 0–37, y 0–47): Federn mit violetter Schattierung (153,102,255), dunkelviolettem Umriss (70,46,116), weißen Lichtern. Die Spitzen zeigen
  nach oben-links, der Ansatz sitzt unten am Mädchen. Rechter Flügel: grau (x 38–75): Federn (122,122,122) mit schwarzem Umriss (0,0,0), hellgrauen Lichtern. Beide Flügel
  stoßen hinter dem Mädchen (x 34–41) aneinander; die Ebene enthält sie vollständig.
* Mädchen (x 32–43, y 25–47): braune Haare (hell (170,85,0), Umriss (49,24,0)), Gesicht (x 34–42, y 29–38) mit je zwei 2×2-Augen (35–36, 31–32) und (39–40, 31–32) (weiß,
  braune Iris), rosa Wangen (35,33) (40,33), Lächeln mit weißen Zähnen (37–38, 35), Kleid rosabraun (y 37–43), Gürtel mit goldener Schnalle (37–38, 42), nackte Beine/Füße (y 44–47).
  Graue/schwarze Pixel (36–39, 29–30) am Haaransatz gehören zum Kopfschmuck (unklar) — bleiben fest am Kopf.
* Hut-Vogel (x 31–44, y 19–30): kleiner weißer Vogel von vorn mit Federbüscheln (34,19) (39,19), Körper lavendel (204,204,255) mit dunklem Umriss (85,85,139), schwarzen Augen
  (37,28) (39,28) und rosa Wangen (36,28) (40,28).
* Haare/Arme (x 32–34 und 40–43, y 28–37): Haarsträhnen mit den dünnen Armen, hängen an den Seiten.

Ablauf (48 Frames à 65 ms = 3,12 s) — sie FLIEGT:
* Flügelschlag, durchgehend und gleichmäßig: ein Schlag = 16 Frames (1,04 s), 3 Schläge pro Schleife. Abschlag (Spitzen oben → unten) schnell, 6 Frames; Aufschlag 10 Frames.
  Jede Federspalte der Flügel wandert als Ganzes senkrecht (nichts wird kopiert oder gestreckt, die Federtextur bleibt Pixel für Pixel): Verschiebung ≈ 13 px · Schlagphase · Abstand^1,15
  (Spitzen am weitesten), die Spitzen hinken der Wurzel 1,2 Frames nach (Wellenlauf); am Aufschlag-Ende heben sich die Spitzen 2 px über die Ruhelage. Der rechte Flügel
  schlägt 0,35 Frames später. Die Spalten an der Naht unter dem Mädchen (x 34–41) bewegen sich kaum.
* Bob: die ganze Figur hebt und senkt sich im Takt (±2 px): am höchsten kurz nach dem Abschlag unten, am tiefsten am Ende des Aufschlags. Die Füße baumeln nach (60 %, 1,5 Frames
  verzögert; die Lücke zum Kleid füllen doppelte Beinzeilen). Haare/Arme pendeln zusätzlich leicht (links Periode 16, rechts 24 Frames, bis 1 px).
* Hut-Vogel: flattert mit den Seiten und Büscheln (sechs Mal pro Schleife, bis 1 px) und blinzelt (Frames 30–32).
* Mädchen blinzelt (Frames 19–21 und 41–42, Lid = Hautfarbe).
* Goldene Gürtelschnalle (Metall): zweimal pro Schleife blitzt ein kleiner Glitzerstern auf (Frames 10–12 und 34–36). Sonst kein Glanz (Federn, Haare, Haut sind kein Metall).
* Federflocken (Partikel): kleine lavendelfarbene und graue Punkte sinken langsam von den Flügeln, nahtlos.

Ergänzungen: keine nötig — die Ebenen enthalten die verdeckten Teile (Flügel unter dem Mädchen, Mädchen unter Hut und Armen).
Randpixel-Test (Regel 16): verschobene Federspalten und die Arme können an der Außenkante Innenfarbe freilegen; solche Randpixel werden in der Umrissfarbe ihrer Ebene gesetzt
(linker Flügel (70,46,116), rechter Flügel (0,0,0), Mädchen (49,24,0), Hut (85,85,139)) — in `frame()` per `B.umriss_je_ebene`.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 16, 6                                         # Frames je Schlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 7, 6

spr = L.lade('cute-bird')                                  # Gesamtbild (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R

# ── Ebenen auf die volle Leinwand legen (Regel 3) ───────────────────────────────────────────────────────────────────
fl = L.lade('cute-bird-fluegel')
FL_L = L.platz(np.where((np.arange(sw) <= 37)[None, :, None], fl, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
FL_R = L.platz(np.where((np.arange(sw) >= 38)[None, :, None], fl, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
MAED = L.platz(L.lade('cute-bird-maedchen'), H, W, PAD_L, PAD_T)
HUT = L.platz(L.lade('cute-bird-hut'), H, W, PAD_L, PAD_T)
arme = L.lade('cute-bird-arme')
ARM_L = L.platz(np.where((np.arange(sw) <= 37)[None, :, None], arme, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
ARM_R = L.platz(np.where((np.arange(sw) >= 38)[None, :, None], arme, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
CUT = PAD_T + 44                                           # ab dieser Zeile beginnen die Beine des Mädchens
MAED_OBEN = MAED.copy(); MAED_OBEN[CUT:] = 0
MAED_BEINE = MAED.copy(); MAED_BEINE[:CUT] = 0

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
UMRISS_VIOLETT, UMRISS_SCHWARZ, UMRISS_HUT, UMRISS_HAAR = (70, 46, 116), (0, 0, 0), (85, 85, 139), (49, 24, 0)
ERLAUBT = {UMRISS_VIOLETT, UMRISS_SCHWARZ, UMRISS_HUT, UMRISS_HAAR}        # Umrissfarben der Quelle (Randpixel-Test)
HAUT_A, HAUT_B = (246, 205, 139), (246, 189, 152)                          # Lid = Hautfarbe
HUT_LID = (204, 204, 255)                                                  # Lid des Hut-Vogels = Federfarbe
EBENEN_FARBE = {1: UMRISS_VIOLETT, 2: UMRISS_SCHWARZ, 3: UMRISS_HAAR, 4: UMRISS_HUT}
AUGE_L = [(35, 31), (36, 31), (35, 32), (36, 32)]
AUGE_R = [(39, 31), (40, 31), (39, 32), (40, 32)]
HUT_AUGEN = [(37, 28), (39, 28)]


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
FL_AMP, FL_POT, FL_HEBEN, FL_LAG = 13.0, 1.15, 2.2, 1.2


def welle(t):
    """Schlagphase 0 (Flügel oben) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich (Cosinus)."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def fluegel(ebene, pivot_x, t):
    """Flügel schlagen: Spalte mit Abstandsanteil f wandert um FL_AMP·s·f^POT nach unten (s = verzögerte Schlagphase) und am oberen Wendepunkt bis FL_HEBEN px nach oben."""
    def dy(f):
        s = welle(t - FL_LAG * f)
        return FL_AMP * s * f ** FL_POT - FL_HEBEN * (1.0 - s) * f
    return B.spalten_schub(ebene, pivot_x, dy)


# ── Flug: ganze Figur hebt/senkt sich im Takt ─────────────────────────────────────────────────────────────────────────
BOB_AMP, BOB_MAX_T = 2.4, 7.0                              # px; Frame im Schlag, in dem die Figur am höchsten ist


def bob(t):
    """Versatz der Figur in px (negativ = oben): hoch kurz nach dem Abschlag unten, tief am Ende des Aufschlags."""
    return -int(round(BOB_AMP * math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT)))


def fuss_versatz(t):
    """Füße baumeln nach: 1,5 Frames verzögert und zu 60 % (nie höher als der Körper)."""
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def blinzeln(i, starts, folge=(1, 2, 1)):
    for s in starts:
        k = (i - s) % N
        if k < len(folge):
            return folge[k]
    return 0


# ── Partikel: Federflocken, sinken langsam ─────────────────────────────────────────────────────────────────────────────
FED_LAVENDEL = {'c': (204, 204, 255), 'r': (153, 102, 255)}
FED_GRAU = {'c': (158, 158, 158), 'r': (122, 122, 122)}
PUFFS_L = [
    dict(x=px(2, 20)[0], y=px(2, 20)[1], vx=-2, vy=15, off=0, form='k', wackeln=2),
    dict(x=px(8, 34)[0], y=px(8, 34)[1], vx=1, vy=12, off=16, form='s', wackeln=2),
    dict(x=px(20, 8)[0], y=px(20, 8)[1], vx=-1, vy=16, off=32, form='k', wackeln=2),
    dict(x=px(-1, 30)[0], y=px(-1, 30)[1], vx=-1, vy=12, off=8, form='k', wackeln=1),
]
PUFFS_R = [
    dict(x=px(73, 20)[0], y=px(73, 20)[1], vx=2, vy=15, off=24, form='k', wackeln=2),
    dict(x=px(67, 34)[0], y=px(67, 34)[1], vx=-1, vy=12, off=40, form='s', wackeln=2),
    dict(x=px(55, 8)[0], y=px(55, 8)[1], vx=1, vy=16, off=8, form='k', wackeln=2),
    dict(x=px(76, 30)[0], y=px(76, 30)[1], vx=1, vy=12, off=0, form='k', wackeln=1),
]
TEST_EBENEN = ('fluegel', 'figur')                         # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    dy_u, dy_f = bob(i), fuss_versatz(i)
    schichten = []
    if 'fluegel' in ebenen:
        schichten += [(fluegel(FL_L, PAD_L + 37, i), 0, dy_u, 1), (fluegel(FL_R, PAD_L + 38, i - 0.35), 0, dy_u, 2)]
    if 'figur' in ebenen:
        # Mädchen: Körper um dy_u, Beine um dy_f, Lücke dazwischen füllen doppelte Beinzeilen
        maed = MAED_OBEN.copy()
        bz = lambda e: e
        bl = (i, )
        beine = MAED_BEINE
        if dy_f - dy_u > 0:
            beine = L.streck_zeile(beine, CUT + 1, dy_f - dy_u)
        # Blinzeln: Lid = Hautfarbe
        b = blinzeln(i, (19, 41), (1, 2, 1))
        if b:
            for (x, y) in AUGE_L + AUGE_R:
                if b == 2 or y == 31:
                    maed[PAD_T + y, PAD_L + x, :3] = HAUT_A if y == 31 else HAUT_B
        # Hut-Vogel: Seiten flattern (sechs Mal pro Schleife), Lid = Federfarbe
        s_h = 0.5 - 0.5 * math.cos(2 * math.pi * i / 8.0)
        hut = B.spalten_schub(HUT, PAD_L + 37, lambda f: 1.4 * s_h * f)
        if blinzeln(i, (30,), (1, 1, 1)):
            for (x, y) in HUT_AUGEN:
                hut[PAD_T + y, PAD_L + x, :3] = HUT_LID
        # Haare/Arme pendeln leicht (links Periode 16, rechts 24)
        arm_l = L.zeilen_welle(ARM_L, PAD_T + 29, 1.3, L.sinus(i, 16.0, 0.5))
        arm_r = L.zeilen_welle(ARM_R, PAD_T + 29, 1.3, L.sinus(i, 24.0, 2.0))
        # Gürtelschnalle (Metall): kleiner Glitzerstern
        schichten += [(maed, 0, dy_u, 3), (beine, 0, dy_f, 3), (hut, 0, dy_u, 4), (arm_l, 0, dy_u, 3), (arm_r, 0, dy_u, 3)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    if 'figur' in ebenen:
        for start in (10, 34):
            st = F.stern_stufe(i, N, start, (0, 1, 0))
            if st is not None:
                F.stern(f, PAD_L + 38, PAD_T + 42 + dy_u, st, (246, 255, 255), (207, 207, 0))
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel:
        p_l = L.puff_ebene(H, W, i, N, PUFFS_L, FED_LAVENDEL)
        p_r = L.puff_ebene(H, W, i, N, PUFFS_R, FED_GRAU)
        f = L.zusammen(H, W, [(p_l, 0, 0), (p_r, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-bird', 'Cute Bird', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-bird-strip.png', frames, spalten=8, scale=4)
