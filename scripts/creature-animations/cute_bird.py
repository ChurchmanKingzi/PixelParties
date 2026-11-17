# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Bird“ (Creature) — NUR der kleine weiße Vogel (ohne das Engel-Mädchen, auf dessen Kopf er sitzt). Er fliegt auf der Stelle.

PICK: [["MotiveMoe", 438, "Hut-Vogel (Ausschnitt x 116–129, y 132–143 der Ebene „Cute Bird“ = Sammelblatt kleiner Vögel)"]]
RUNDE 2 (Nutzer: „NUR den kleinen weißen Vogel anzeigen, ohne den Engel, auf dessen Kopf er liegt!“): Die Kartenkunst „Cute Bird“ zeigt ein Mädchen mit Flügelpaar; der kleine weiße Vogel auf
ihrem Kopf ist ein eigenes 14×12-px-Sprite in der Ebene 438 von MotiveMoe.xcf. Der Sprite ist vollständig (auch die Schwanzfedern oben und die Flügelspitzen unten, nichts wird vom Mädchen verdeckt)
und wird als src/cute-bird.png neu abgelegt. Die früheren Teilbilder (Flügel, Mädchen, Arme, Hut) entfallen.

Aufruf:   python3 cute_bird.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-bird.png + .json

Identifikation (Sprite-Koordinaten x, y; 14×12 px, 6 Farben):
* Der Vogel ist von OBEN gesehen (Flügel seitlich ausgebreitet, Kopf unten): Umriss (85,85,139), Federn (204,204,255) mit Schattierung (165,165,207) und weißen Lichtern (246,255,255).
* Schwanzfedern oben: zwei kleine Spitzen — links (3, 0)–(3, 1)–(4, 1), rechts (8, 0)–(7, 1)–(8, 1); darunter der Rumpf (y 2–9, x 3–10).
* Flügel: links x 0–3 und rechts x 10–13, y 5–11 (Federn mit Umrissstufen an den Spitzen (0–1, 8–9) / (12–13, 8–9) und (1–2, 10–11) / (11–12, 10–11)); die Flügelwurzel trennt ein dunkler Umriss vom Rumpf.
* Gesicht (y 9): schwarze Augen (6, 9) und (8, 9) (0,0,0), rosa Wangen (5, 9) und (9, 9) (255,118,255), Schnabel (7, 9) (165,165,207); darunter Brust/Bauch (7, 10–11).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Flügelschlag (RUNDE 3, Nutzer: „sollte richtig mit den Flügeln schlagen“): vorher nur ±2 px Spaltenversatz an den Flügelspitzen. Jetzt eigene, von Hand festgelegte Flügelposen (je Pose die Zeilen-Spannen
  des linken Flügels, Umriss/Schattierung/Wurzelglanz werden daraus erzeugt, der rechte Flügel ist das Spiegelbild): D0 (hängend = Originalpose), D1 (leicht nach außen), M (waagerecht ausgebreitet, Spitze bei x −4),
  U1 (schräg nach oben), U2 (hoch erhoben, Spitze bis y −1). Ein Schlag = 12 Frames (720 ms), 4 Schläge pro Schleife; Posenfolge D0 D0 D1 M U1 U2 U2 U2 U1 M D1 D0 (weich über die Phase, nie auf einer Pose verharrend).
  Die Wurzelspalte (x 3 / x 10, y 5–10) gehört fest zum Rumpf und bleibt in allen Posen stehen (Flügel bleibt am Körper angewachsen, keine Lücke); Umriss immer genau 1 px.
* Schweben: der ganze Vogel hebt sich beim Abschlag (Frames 8–10 jedes Schlags) 1 px, dazu pendelt er langsam waagerecht ±1 px (Periode 24, Schwebeflug) und ein zweites, langsames Auf und Ab ±1 px (Periode 24).
* Schwanzfedern zucken: beide Spitzen wandern unabhängig 1 px nach innen/außen (Perioden 12 und 16 bzw. 16 und 24), sie bleiben über die Zeile darunter 4-verbunden.
* Blinzeln (Frames 14–16 und 38–40): Lid = Federfarbe (204,204,255) auf den beiden schwarzen Augenpixeln (Rule 21: Lid in umgebender Körperfarbe); die rosa Wangen bleiben.
Keine Partikel (zu klein, Regel 25), kein Glanz (Federn, Regel 14).

Ergänzungen: keine — der Sprite ist vollständig. Randpixel-Test (Regel 16): verschobene Flügelspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel werden in der Umrissfarbe (85,85,139) gesetzt (B.umriss_je_ebene).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 8, 7                    # großzügige Leinwand: Flügelposen (bis 5 px nach außen, 1 px über den Rumpf) + Schweben; am Ende auf die Vereinigung aller Frames + 2 px zugeschnitten

spr = L.lade('cute-bird')                                  # 14×12: der kleine weiße Vogel
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS = (85, 85, 139)
FEDER = (204, 204, 255)                                    # Lid beim Blinzeln = Federfarbe
ERLAUBT = F.umriss_farben(spr)                             # Umrissfarben der Quelle (Randpixel-Test)
AUGEN = [(6, 9), (8, 9)]
assert all(tuple(spr[y, x, :3]) == (0, 0, 0) for x, y in AUGEN)

# ── Teile (alle sofort auf die volle Leinwand legen, Regel 3) ──────────────────────────────────────────────────────────────
fl_l = vorhanden & (xx <= 3) & (yy >= 5)
fl_r = vorhanden & (xx >= 10) & (yy >= 5)
tuft_l = vorhanden & (xx <= 4) & (yy <= 1)
tuft_r = vorhanden & (xx >= 7) & (yy <= 1)
wurzel = vorhanden & ((xx == 3) | (xx == 10)) & (yy >= 5)        # Flügelwurzel (x 3 / x 10): bleibt in jeder Pose am Rumpf
rumpf = vorhanden & ~fl_l & ~fl_r & ~tuft_l & ~tuft_r


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


FL_L0, FL_R0, TF_L, TF_R = teil(fl_l), teil(fl_r), teil(tuft_l), teil(tuft_r)
RUMPF = teil(rumpf | wurzel)
assert (L.zusammen(H, W, [(a, 0, 0) for a in (RUMPF, FL_L0, FL_R0, TF_L, TF_R)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

# ── Handgezeichnete Flügelposen (linker Flügel; Spannen x0..x1 je Zeile y in Sprite-Koordinaten, nur x ≤ 2; x 3 = Wurzel gehört zum Rumpf) ─────────────────
POSEN = {
    'D1': {5: (2, 2), 6: (1, 2), 7: (0, 2), 8: (-1, 2), 9: (-2, 2), 10: (-1, 2), 11: (1, 2)},
    'M': {5: (1, 2), 6: (-2, 2), 7: (-4, 2), 8: (-3, 2), 9: (-1, 2), 10: (1, 2)},
    'U1': {10: (2, 2), 9: (1, 2), 8: (0, 2), 7: (-1, 2), 6: (-2, 2), 5: (-3, 2), 4: (-4, 2), 3: (-5, 1), 2: (-5, -2), 1: (-4, -3)},
    'U2': {10: (2, 2), 9: (1, 2), 8: (0, 2), 7: (-1, 2), 6: (-2, 2), 5: (-3, 2), 4: (-3, 2), 3: (-3, 2), 2: (-4, 1), 1: (-4, 0), 0: (-3, -1), -1: (-3, -3)},
}
SCHLAG = ['D0', 'D0', 'D1', 'M', 'U1', 'U2', 'U2', 'U2', 'U1', 'M', 'D1', 'D0']          # 12 Frames je Schlag
WURZEL_GLANZ = (246, 255, 255)


def fluegel_pose(name):
    """Linker + rechter Flügel (volle Leinwand) der Pose: Umriss = Randpixel der Flügelmaske (die Silhouette von Rumpf + Wurzel zählt dabei als „belegt“),
    Schatten (165,165,207) = Innenpixel mit Umriss links oder darunter, Wurzelglanz (246,255,255) = Innenpixel x = 2 in y 5–7, sonst Federfarbe (204,204,255). Rechts = Spiegelbild um x = 6,5."""
    if name == 'D0':
        return FL_L0, FL_R0
    m = np.zeros((H, W), bool)
    for y, (a, b) in POSEN[name].items():
        m[PAD_T + y, PAD_L + a:PAD_L + b + 1] = True
    stuetze = L.deckend(RUMPF) | m
    p = np.pad(stuetze, 1)
    leer4 = ~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:]
    rand = m & leer4
    a_ = L.leer(H, W)
    a_[m, :3] = FEDER
    a_[m, 3] = 255
    for y, x in zip(*np.nonzero(m & ~rand)):
        links = x > 0 and m[y, x - 1] and rand[y, x - 1]
        unten = y + 1 < H and m[y + 1, x] and rand[y + 1, x]
        if links or unten:
            a_[y, x, :3] = (165, 165, 207)
        elif x == PAD_L + 2 and PAD_T + 5 <= y <= PAD_T + 7:
            a_[y, x, :3] = WURZEL_GLANZ
    a_[rand, :3] = UMRISS
    r = L.leer(H, W)
    for x in range(W):
        xm = 2 * PAD_L + 13 - x
        if 0 <= xm < W:
            r[:, xm] = a_[:, x]
    return a_, r


POSE_FL = {n: fluegel_pose(n) for n in ('D0', 'D1', 'M', 'U1', 'U2')}

BEAT = 12                                                  # Flügelschlag: 4 Schläge pro Schleife (720 ms je Schlag)


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def tuft_dx(i, per, ph):
    """Schwanzfeder zuckt: −1 / 0 / +1 px (nur ganze Pixel); Frame 0 steht still."""
    s = sinz(i, per, ph) - sinz(0, per, ph)
    return 0 if abs(s) < 0.7 else (1 if s > 0 else -1)


def blinz(i):
    return i % 24 in (14, 15, 16)


def frame_gross(i):
    pose = SCHLAG[i % BEAT]
    fl_l_, fl_r_ = POSE_FL[pose]
    rumpf_ = RUMPF.copy()
    if blinz(i):
        for (x, y) in AUGEN:
            rumpf_[PAD_T + y, PAD_L + x, :3] = FEDER
    tl = L.versetze(TF_L, tuft_dx(i, 12, 0.0), 0)
    tr = L.versetze(TF_R, tuft_dx(i, 16, 1.3), 0)
    f = L.zusammen(H, W, [(fl_l_, 0, 0), (fl_r_, 0, 0), (tl, 0, 0), (tr, 0, 0), (rumpf_, 0, 0)])
    # Schweben: der Abschlag (Frames 8–10 des Schlags) hebt den Vogel 1 px; dazu langsames Pendeln waagerecht ±1 (Periode 24) — alles ganze Pixel, Frame 0 = Ruhe
    dy = -1 if i % BEAT in (8, 9, 10) else 0
    dx = int(round(sinz(i, 24)))
    f = L.versetze(f, dx, dy)
    B.umriss_je_ebene(f, np.ones((H, W), np.int16), ERLAUBT, {1: UMRISS})        # Randpixel-Test (Regel 16)
    return f


_ALLE = [frame_gross(i) for i in range(N)]
_u = np.stack([f[..., 3] > 0 for f in _ALLE]).any(axis=0)
_ys, _xs = np.nonzero(_u)
BOX = (int(_xs.min()) - 2, int(_ys.min()) - 2, int(_xs.max()) + 3, int(_ys.max()) + 3)       # Vereinigung aller Frames + 2 px Rand (nie abschneiden, Regel 3/27)
assert BOX[0] >= 0 and BOX[1] >= 0 and BOX[2] <= W and BOX[3] <= H, BOX


def frame(i, partikel=True, effekte=True):
    x0, y0, x1, y1 = BOX
    return frame_gross(i)[y0:y1, x0:x1].copy()


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-bird', 'Cute Bird', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-bird-strip.png', frames, spalten=12, scale=8)
