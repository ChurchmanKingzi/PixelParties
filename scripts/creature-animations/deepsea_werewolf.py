# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Werewolf“ (Creature).

Quelle: src/deepsea-werewolf.png — Ebene „Werewolf“ (34×34 px, 448 Pixel, 7 Farben, alle deckend) aus MotiveDeepsea.xcf (Ebene 329). Gegen die Kartenkunst abgeglichen
(data/card-art/native/Deepsea_Werewolf.png ist 152×102, also doppelt aufgelöst; auf 76×51 heruntergerechnet liegt die Ebene bei (21, 9) mit Helligkeits-Korrelation 0,995: gleiche Form und Größe).
PICK: [["MotiveDeepsea", 329, 1]]

Aufruf:   python3 deepsea_werewolf.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-werewolf.png + .json

Was ist was (x/y im Sprite):
* Ein kleiner stämmiger Werwolf in SCHACHBRETT-GERASTERTEM Teal (51,93,119)/(77,137,154) mit dunkelblauem Umriss (13,16,49) und Schattenpixeln (30,48,81): zwei Ohren (links x 11–14, rechts x 19–22, je y 9–11),
  Kopf (x 11–24, y 11–19) mit zwei weißen 2×2-Augen (246,255,255) bei (14–15, 13–14) und (18–19, 13–14), dazu ein dunkler offener Mund (7,8,26) mit blauschwarzer Mitte bei (15–18, 17–19);
  Schultern/Arme (y 19–26, links bis x 6, rechts bis x 26), Rumpf (x 11–22, y 20–29), zwei kurze Beine (x 11–15 und 18–22, y 30–33).
* Um die Figur laufen dünne, gekrümmte 1-px-Linien in Dunkelrot (70,10,10) und Dunkelblau (13,16,49) (Fesseln/Ranken; links und rechts je ein Bündel, oben eine rote Schnur, die zwischen den Ohren zur Stirn
  (17, 11–13) läuft). Diese Linien hängen nur DIAGONAL zusammen (8er-Nachbarschaft: 1 Komponente, 4er-Nachbarschaft: 27). 384 ihrer Pixel liegen im 4-verbundenen Körper-Kern, 64 äußere Linienenden hängen frei.
Fest bleiben: Kopf-/Körperform, Augen-/Mundform im Ruhebild, die Linien im Kern, Schachbrettmuster.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Partikel ausgenommen):
* Atmen: alles oberhalb der Hüfte (Kopf, Ohren, Arme, Rumpf, die oberen Linienteile) hebt sich 1 px (Zeile y 28 wird einmal wiederholt — dort kreuzen die Linien nur einzeln, die Linien bleiben durchgehend und werden nicht dicker), die Beine bleiben am Boden;
  Periode 24, zweimal pro Schleife (oben in Frame 7–18 und 31–42).
* Ohren zucken: linkes Ohr (Zeile 9–10) 1 px nach links (Frame 3–5) bzw. 1 px nach rechts (Frame 22–24); rechtes Ohr 1 px nach rechts (Frame 10–12 und 33–35) — die rote Schnur bleibt unverändert.
* Blinzeln (Lid = Schachbrett-Haut): erst die obere Augenzeile, dann beide Zeilen; zweimal (Frame 6–8 und 27–29).
* Heulen: der Mund öffnet sich weit (2 Zeilen länger, Frame 14–19), danach klappt er von unten zu (erst Zeile 19, dann 18–19 werden Haut; Frame 36–39: nur ein dünner Mundstrich bleibt).
* Ranken wogen: die freien Linienenden (64 Pixel abseits des Kerns) verschieben sich waagerecht um höchstens 1 px, das Gewicht wächst mit dem Abstand zum Kern (0 am Kern, voll ab 4 px), die Welle läuft
  spaltenweise von links nach rechts (Periode 24, zweimal pro Schleife). Von innen nach außen wird jedes Pixel so gesetzt, dass es 8er-Nachbar seines verschobenen Elternpixels bleibt — es reißt nichts, es entstehen keine Brücken- oder Klumpenpixel;
  bleibt die 8er-Verbindung in allen 48 Frames bei 1 Komponente.
* Beine heben abwechselnd 1 px (je 3 Frames, Periode 16: links Frame 3–5, rechts Frame 11–13).
* Partikel (hinter der Figur): vier Teal-Blasen (Kern (77,137,154), Rand (51,93,119)), runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`), nie ein Einzelpixel; in jeder Pose ≥ 2 px Abstand zur Figur und nie teilweise verdeckt
  (per Skript über alle 48 Frames geprüft): zwei steigen links oben schräg auf (13 px, Lebensdauer 48 Frames, um 24 versetzt), zwei außen rechts senkrecht (18 px, versetzt).
Kein Glanz (Regel 14: Fell/Haut), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle
(Lider/Mundzuklappung im Haut-Karo, Mundöffnung in den vorhandenen Mundfarben).
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-werewolf')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
MUNDK, MUNDI = (7, 8, 26), (13, 16, 49)
TL_, TD_ = (77, 137, 154), (51, 93, 119)
WEISS = (246, 255, 255)
haut = lambda x, y: TL_ if (x + y) % 2 == 0 else TD_                   # Schachbrett der Haut
assert KONTUR in UMRISS

AUGE_L = [(14, 13), (15, 13), (14, 14), (15, 14)]
AUGE_R = [(18, 13), (19, 13), (18, 14), (19, 14)]
assert all(col(x, y) == WEISS for (x, y) in AUGE_L + AUGE_R)
MUND_RING = [(15, 17), (16, 17), (17, 17), (18, 17), (15, 18), (18, 18), (16, 19), (17, 19)]
MUND_MITTE = [(16, 18), (17, 18)]
assert all(col(x, y) == MUNDK for (x, y) in MUND_RING) and all(col(x, y) == MUNDI for (x, y) in MUND_MITTE)

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {6: 1, 7: 2, 8: 1, 27: 1, 28: 2, 29: 1}                   # 1 = obere Zeile zu, 2 = beide Zeilen zu
HEUL = set(range(14, 20))                                          # Mund weit auf
MUNDZU = {36: 1, 37: 2, 38: 2, 39: 1}
OHR_L = {**{i: -1 for i in range(3, 6)}, **{i: 1 for i in range(22, 25)}}
OHR_R = {**{i: 1 for i in range(10, 13)}, **{i: 1 for i in range(33, 36)}}

# Teile (Masken im Sprite)
OHRL = vorhanden & (xx >= 11) & (xx <= 14) & (yy >= 9) & (yy <= 10)
OHRR = np.zeros((sh, sw), bool)
for (x, y) in [(20, 9), (21, 9), (22, 9), (19, 10), (20, 10), (21, 10), (22, 10)]:
    OHRR[y, x] = True
OHRR &= vorhanden
BEIN_L = vorhanden & (xx >= 11) & (xx <= 15) & (yy >= 30)
BEIN_R = vorhanden & (xx >= 18) & (xx <= 22) & (yy >= 30)
# Kern = größte 4-verbundene Fläche (Körper samt anliegendem Linienansatz); Ranken = die übrigen, nur diagonal hängenden Linienstücke
_n, _lab = cv2.connectedComponents(vorhanden.astype(np.uint8), connectivity=4)
_gr = [int((_lab == k).sum()) for k in range(1, _n)]
KERN = _lab == (1 + int(np.argmax(_gr)))
RANKEN = vorhanden & ~KERN
ABST = cv2.distanceTransform((~KERN).astype(np.uint8), cv2.DIST_C, 3)         # Schachbrett-Abstand zum Kern
rest = KERN & ~OHRL & ~OHRR & ~BEIN_L & ~BEIN_R
assert not (BEIN_L & BEIN_R).any() and OHRR.sum() == 7 and OHRL.sum() == 7 and int(RANKEN.sum()) == 64

BLASE = {'c': TL_, 'r': TD_}
P = lambda x, y: (GPL + x, GPT + y)
# Die Figur samt Ranken füllt ihr Feld fast ganz: nur zwei freie Bahnen (Abstand ≥ 2 px in jeder Pose, Partikel höchstens +2 px über den Körper-Rand hinaus): links oben (schräg aufsteigend) und rechts außen (senkrecht).
PUFFS = [
    dict(x=P(-2, 11)[0], y=P(-2, 11)[1], vx=5, vy=-13, off=0, wackeln=0.4),
    dict(x=P(-2, 11)[0], y=P(-2, 11)[1], vx=5, vy=-13, off=24, wackeln=0.4),
    dict(x=P(34, 17)[0], y=P(34, 17)[1], vx=0, vy=-18, off=10, wackeln=0.4),
    dict(x=P(34, 17)[0], y=P(34, 17)[1], vx=0, vy=-18, off=34, wackeln=0.4),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


REST_A, OHRL_A, OHRR_A, BEINL_A, BEINR_A = teil(rest), teil(OHRL), teil(OHRR), teil(BEIN_L), teil(BEIN_R)


RP = [(x, y) for y in range(sh) for x in range(sw) if RANKEN[y, x]]                 # Rankenpixel (x, y)
RGEW = {p: min(1.0, max(0.0, (ABST[p[1], p[0]] - 1) / 3.0)) for p in RP}              # Gewicht: 0 am Kern, 1 ab 4 px Abstand


def _reihenfolge():
    """Breitensuche vom Kern nach außen über 8er-Nachbarn der Ranken (gleichfarbige Nachbarn zuerst): Liste (Pixel, Elternpixel); Eltern am Kern sind Kernpixel (bleiben stehen)."""
    rest_ = set(RP)
    fertig, ordnung = set(), []
    front = []
    for (x, y) in sorted(RP):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (x + dx, y + dy)
                if (dx, dy) != (0, 0) and 0 <= q[0] < sw and 0 <= q[1] < sh and KERN[q[1], q[0]]:
                    front.append(((x, y), q))
                    break
            else:
                continue
            break
    while front:
        nxt = []
        for (p, par) in front:
            if p in fertig:
                continue
            fertig.add(p)
            ordnung.append((p, par))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (p[0] + dx, p[1] + dy)
                    if (dx, dy) != (0, 0) and q in rest_ and q not in fertig:
                        nxt.append((q, p))
        # gleichfarbige Eltern zuerst: stabil nach (Farbgleichheit, Lage) sortieren
        nxt.sort(key=lambda t: (col(*t[0]) != col(*t[1]), t[0][1], t[0][0]))
        front = nxt
    assert len(ordnung) == len(RP) and fertig == rest_
    return ordnung


RORD = _reihenfolge()


def ranken(i):
    """Ranken-Enden wogen (nur die Pixel abseits des Kerns): waagerechter Versatz ≤ 1 px, Gewicht wächst mit dem Abstand zum Kern, die Welle läuft spaltenweise von links nach rechts (Phase 0,12 rad je Spalte).
    Von innen nach außen wird jedes Pixel so versetzt, dass es 8er-Nachbar seines (verschobenen) Elternpixels bleibt — so reißt nichts, und es entstehen keine Brückenpixel/Klumpen."""
    a = L.leer(H, W)
    pos = {}
    for (p, par) in RORD:
        x, y = p
        wunsch = RGEW[p] * (math.sin(2 * math.pi * i / 24 - 0.12 * x) - math.sin(-0.12 * x))
        wunsch = max(-1, min(1, int(round(wunsch))))
        pp = pos.get(par, par)                                    # verschobenes Elternpixel (Kernpixel stehen)
        ok = [o for o in (-1, 0, 1) if max(abs(x + o - pp[0]), abs(y - pp[1])) <= 1 and (x + o, y) != pp]
        o = wunsch if wunsch in ok else (0 if 0 in ok else min(ok, key=lambda v: abs(v - wunsch)))
        pos[p] = (x + o, y)
    for p in RP:
        set_px(a, pos[p][0], pos[p][1], col(*p))
    return a


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def frame_gross(i, nur=None):
    kb = REST_A.copy()
    # Blinzeln (Lid = Haut-Karo)
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in AUGE_L + AUGE_R:
            if bl == 2 or y == 13:
                set_px(kb, x, y, haut(x, y))
    # Mund: weit auf (Heulen) / von unten zu
    if i in HEUL:
        for (x, y) in [(15, 19), (18, 19)] + [(16, 20), (17, 20)]:
            set_px(kb, x, y, MUNDK)
        for (x, y) in [(16, 19), (17, 19)]:
            set_px(kb, x, y, MUNDI)
    st = MUNDZU.get(i, 0)
    if st:
        for (x, y) in MUND_RING + MUND_MITTE:
            if y >= 19 - (st - 1):
                set_px(kb, x, y, haut(x, y))
    dl, dr = OHR_L.get(i, 0), OHR_R.get(i, 0)
    oben = L.zusammen(H, W, [(ranken(i), 0, 0), (kb, 0, 0), (OHRL_A, dl, 0), (OHRR_A, dr, 0)])
    # Atmen: alles oberhalb der Hüfte hebt sich 1 px (Zeile y 28 wird einmal wiederholt)
    if U.stufe(i, 24, 1) == 1:
        oben = L.streck_zeile(oben, GPT + 28, 1)
    bl_ = 1 if (i % 16) in (3, 4, 5) else 0
    br_ = 1 if (i % 16) in (11, 12, 13) else 0
    koerper = L.zusammen(H, W, [(oben, 0, 0), (BEINL_A, 0, -bl_), (BEINR_A, 0, -br_)])
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
    L.speichern('deepsea-werewolf', 'Deepsea Werewolf', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-werewolf-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
