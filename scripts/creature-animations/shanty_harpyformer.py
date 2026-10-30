# -*- coding: utf-8 -*-
"""Idle-Animation für „Shanty Harpyformer“ (Creature) — singende Piratenharpyie (Totenkopfhut, Stelzbein, goldene Ohrringe) mit weißem und hellblauem Flügel, Notenzeichen und Funkelsternen; schwebt.

PICK: [["MotiveGrailWar", 127, "Ebene „Shanty Harpyformer“ — nur die Figur oben Mitte (x 32–53, y 7–33 der 87×63 px großen Ebene) und drei Funkelsterne (x 27–36, y 0–9)"], ["MotiveGrailWar", 126, "Ebene „Shanty Harpyformer #1“: drei Notenzeichen (18×14 px)"]]
Quelle: MotiveGrailWar.xcf. Ebene 127 enthält die GANZE Szene: oben mittig die singende Harpyie, daneben/darunter vier fremde Figuren (Pirat links unten mit grauem Hut und blauer Hose, Pirat mit roter Mütze unten Mitte,
Figur mit rosa Haarkugel unten rechts, Cowboy-Goblin rechts) — sie sind Zuschauer des Kartenbildes und NICHT Teil dieser Creature. Abgleich mit der Kartenkunst (data/card-art/native/Shanty_Harpyformer.png, 76×51, Kartenursprung in der xcf
(281, 189), Ebene 127 sitzt bei Kartenpixel (−5, 2)): Die Harpyie (418 Pixel, zusammenhängende Insel), die drei Funkelsterne (16 Pixel) und die drei Noten der Ebene 126 (30 Pixel) stehen in der Karte alle 460 von 460
genauso (Toleranz 30). Die Zuschauer stehen ebenfalls in der Karte (teils angeschnitten), gehören aber zu anderen Karten/zur Szene und wurden ausgespart (425 ihrer Pixel liegen über den Kartenrand hinaus).
Aus der Ebene 127 ist die Harpyie als 8er-Komponente (> 100 px) im Bereich x 26–56, y 0–35 getrennt, die Sterne als die kleinen Komponenten im selben Bereich; die Noten kommen aus Ebene 126 (Versatz (311, 191) = Ebene-127-Koordinaten (35, 0)).
Sie liegen mit Ursprung Ebene-127 (27, 0) als 27×34-Sprite vor:
  src/shanty-harpyformer.png          Gesamtbild (Ruhepose, Referenz für den Randpixel-Test)
  src/shanty-harpyformer-harpyie.png  Harpyie (418 px)
  src/shanty-harpyformer-sterne.png   drei Funkelsterne
  src/shanty-harpyformer-noten.png    drei Notenzeichen

Aufruf:   python3 shanty_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shanty-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Piratenhut (x 9–21, y 8–16): schwarz-graue Töne (41,41,41) (50,50,50) (101,101,101), weißer Totenkopf in der Mitte (y 9–15), weiße Lichtkante oben (246,255,255); Hutkrempe unten (49,24,0).
* Gesicht (x 9–21, y 16–21): Haut (246,205,139) (255,230,213), rosa Wangen (238,156,123); geschlossene Augen = schwarze Striche (13,17) (14,17) und (17,17) (18,17); offener roter Mund (150,14,22) (179,16,26) (111,10,16)
  = 2×2 bei (15,19) (16,19) (15,20) (16,20) — sie singt; goldene Ohrringe (255,255,0) (255,210,0) bei (10,18) (11,19) und (21,18) (21,19).
* Linker Flügel (x 5–9, y 7–21): weiß-silbrige Federn (240,240,240) (223,223,223) (184,184,184) (199,199,199) mit weißer Bogenkante oben (x 5–9, y 7–9); rechter Flügel (x 22–26, y 9–21): hellblau (180,246,255) (139,213,255)
  (106,197,255) mit weißer Kante (246,255,255). Beide stehen aufrecht neben dem Kopf.
* Körper (x 8–19, y 22–29): dunkler Gehrock (0,0,0) (57,57,57) (85,85,85) (128,128,128), blaues Hemd/Weste (34,88,148) (40,106,174) (26,60,112), schwarze Armstümpfe/Handschuhe links x 5–9 und rechts x 20–25 (y 22–29).
* Beine (x 9–19, y 29–33): links Fuß in Beige-Orange (230,131,82) (189,90,57) mit weißen Krallenspitzen (10,32) (14,32); rechts ein hölzernes Stelzbein (82,48,16) (123,77,33) (156,113,57) (x 18–19, y 29–33).
* Notenzeichen: Lila (140,111,207) (189,172,227) (x 14–17, y 0–5), Gelb (222,246,71) (236,250,149) (x 22–25, y 4–9), Cyan (0,255,255) (0,204,204) (x 8–12, y 8–13).
* Funkelsterne (weiß): großes Plus (Arme 2 px, Mitte leer) bei (7,2), kleine Rauten (4 px) bei (12,6) und (1,8).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend im festen Rhythmus: ein Schlag = 12 Frames (780 ms), 4 pro Schleife; Abschlag 5 Frames. Beide aufrechten Flügel klappen nach außen: Jede Zeile oberhalb der Schulter (Zeile 19) wandert als Ganzes
  waagerecht, bis 3 px an der Spitze (Exponent 1,15, Spitze hinkt 1 Frame nach, der rechte Flügel 0,3 Frames später); die Wurzeln (y ≥ 19) bleiben fest. Federtextur bleibt, nichts wird kopiert.
* Schwebe-Bob: Harpyie samt Hut, Flügeln und Armen hebt sich im Takt bis 2 px (am höchsten in der Schlagmitte); Fuß und Stelzbein baumeln nach (60 %, 1,5 Frames verzögert, die Lücke füllen doppelte Beinzeilen).
* Singen: der Mund öffnet und schließt sich im Rhythmus (Periode 8 Frames, sechs Silben pro Schleife): offen → halb → zu → halb. Der zugemachte Mund ist Hautfarbe (246,205,139) / Lippe (238,156,123). Die Augen sind schon geschlossen (Striche) — kein Blinzeln.
* Notenzeichen schweben: jede Note wippt eigenständig (Ausschlag bis 2 px, Perioden 24 / 16 / 48 Frames) und schwankt leicht seitlich (1 px) — sie sind Teil der Kunst, keine Partikel; ganze Noten ohne Teilung.
* Funkelsterne: jeder wächst und vergeht in 24 Frames (Raute → X → Plus → X → Raute → aus), zwei Mal pro Schleife; Frame 0 = Stufe der Karte (STERNE_AN = False schaltet sie ab).
* Kein Glanz: Federn, Haut, Hut sind kein Metall. Die goldenen Ohrringe sind je 2 px groß und liegen vor/neben weißen Federn — ein Glitzerstern wäre dort nicht lesbar; im Zweifel weggelassen.

Ergänzungen: keine nötig — die Ebene enthält die Figur vollständig (die Karte verdeckt nur die Beine hinter der Holzkiste im Vordergrund, die in der Ebene gezeichnet sind).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 3, 5, 4, 2                    # links: Randstern wächst 1 px; rechts: rechter Flügel klappt bis 3 px nach außen; oben: Hub 2 px + Noten
STERNE_AN = True

spr = L.lade('shanty-harpyformer')                         # Gesamtbild (Ruhepose / Referenz für den Randpixel-Test)
harpyie = L.lade('shanty-harpyformer-harpyie')
noten_q = L.lade('shanty-harpyformer-noten')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = harpyie[..., 3] > 0

# ── Teile trennen ─────────────────────────────────────────────────────────────────────────────────────────────────────
M_FLUEGEL_L = fig & (((xx <= 8) & (yy <= 18)) | ((xx <= 9) & (yy <= 8)))
M_FLUEGEL_R = fig & (xx >= 23) & (yy <= 18)
M_FUESSE = fig & (yy >= 30)
M_KOERPER = fig & ~(M_FLUEGEL_L | M_FLUEGEL_R | M_FUESSE)


def teil(maske, quelle=harpyie):
    return L.platz(np.where(maske[..., None], quelle, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


FL_L, FL_R, FUESSE, KOERPER = teil(M_FLUEGEL_L), teil(M_FLUEGEL_R), teil(M_FUESSE), teil(M_KOERPER)
_n, _lab = cv2.connectedComponents((noten_q[..., 3] > 0).astype(np.uint8), connectivity=8)
NOTEN = [teil(_lab == k, noten_q) for k in range(1, _n)]            # drei einzelne Noten (Reihenfolge nach Position im Bild)
# Noten sortieren: 0 = Lila (oben Mitte), 1 = Gelb (rechts), 2 = Cyan (links)
NOTEN = sorted(NOTEN, key=lambda nt: (np.nonzero(nt[..., 3])[0].min(), np.nonzero(nt[..., 3])[1].min()))
NOTEN_PAR = [(24.0, 0.0, 2.0, 32.0, 1.0), (16.0, 1.3, 2.0, 24.0, 2.0), (48.0, 2.4, 2.0, 48.0, 0.7)]   # (Periode y, Phase y, Ausschlag y, Periode x, Phase x)

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
HAUT, LIPPE = (246, 205, 139), (238, 156, 123)
MUND = [(15, 19), (16, 19), (15, 20), (16, 20)]            # roter Mund 2×2
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (246, 255, 255), 2: (246, 255, 255), 3: (0, 0, 0), 4: (49, 24, 0)}      # 1/2 Flügel, 3 Körper, 4 Füße


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_FL = 3.0
Y_PIV = PAD_T + 19                                         # Schulter: alle Zeilen darüber klappen


def welle(t):
    """Schlagphase 0 (Original) … 1 (außen): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dx_fn(t, versatz=0.0):
    def dx(f):
        return A_FL * (welle(t - versatz - LAG * f) - welle(-versatz - LAG * f)) * f ** POT
    return dx


# ── Schwebe-Bob, Füße, Mund, Noten, Sterne ───────────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


def mund_stufe(t):
    """0 = offen (Original), 1 = halb, 2 = zu — Silbe alle 8 Frames."""
    return (0, 0, 0, 0, 1, 2, 2, 1)[int(t) % 8]


def note_versatz(k, t):
    py, fy, ay, px_, fx = NOTEN_PAR[k]
    dy = int(round(ay * math.sin(2 * math.pi * t / py + fy))) - int(round(ay * math.sin(fy)))
    dx = int(round(1.0 * math.sin(2 * math.pi * t / px_ + fx))) - int(round(1.0 * math.sin(fx)))
    return dx, dy


FOLGE = [1, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]       # eine Periode (24 Frames): aufblühen und vergehen
STERNE = [((7, 2), 3, 6), ((12, 6), 1, 11), ((1, 8), 1, 1)]


def sterne_ebene(i):
    e = L.leer(H, W)
    for (mx, my), form, k0 in STERNE:
        st = B.funkel_stufe(i, len(FOLGE), k0, FOLGE)
        if st:
            B.funkel_stern(e, PAD_L + mx, PAD_T + my, st, (246, 255, 255))
    return e


TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Noten und Sterne


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n, k = hub(i), fuss_hub(i)
    schichten = []
    if 'figur' in ebenen:
        koerper = KOERPER.copy()
        ms = mund_stufe(i)
        if ms >= 1:                                                         # halb: untere Mundzeile zu; zu: beide Zeilen zu (Hautfarbe, unten Lippe)
            for (x, y) in MUND:
                if ms == 2:
                    koerper[PAD_T + y, PAD_L + x, :3] = HAUT if y == 19 else LIPPE
                elif y == 20:
                    koerper[PAD_T + y, PAD_L + x, :3] = LIPPE
        fuesse = FUESSE
        if n - k > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + 30, n - k)             # Beine: Lücke füllen doppelte oberste Beinzeile
        fl_l = B.zeilen_klappen(FL_L, Y_PIV, dx_fn(i), richtung=-1, starr_oben=PAD_T + 9)      # der Federbogen oben (y 7–8) bleibt als Ganzes
        fl_r = B.zeilen_klappen(FL_R, Y_PIV, dx_fn(i, 0.3), richtung=1)
        schichten += [(fl_l, 0, -n, 1), (fl_r, 0, -n, 2), (koerper, 0, -n, 3), (fuesse, 0, -k, 4)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if partikel:
        ebenen_ = [(f, 0, 0)]
        for kk, nt in enumerate(NOTEN):
            dx, dy = note_versatz(kk, i)
            ebenen_.append((nt, dx, dy))
        f = L.zusammen(H, W, ebenen_)
        if STERNE_AN:
            f = L.zusammen(H, W, [(f, 0, 0), (sterne_ebene(i), 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('shanty-harpyformer', 'Shanty Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shanty-harpyformer-strip.png', frames, spalten=8, scale=6)
