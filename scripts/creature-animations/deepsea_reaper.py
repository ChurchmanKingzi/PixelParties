# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Reaper“ (Creature).

Quelle: src/deepsea-reaper.png — Ebene „Reaper“ (32×30 px, 556 Pixel, alle deckend, 18 Farben) aus MotiveDeepsea.xcf (Ebene 298). Gegen die Kartenkunst abgeglichen (data/card-art/native/Deepsea_Reaper.png, 76×51,
Ebene liegt bei (22, 12)): gleiche Form, Position und Größe; die Karte ist sehr dunkel getönt, die Augen sind dort grün überlagert (Korrelation deshalb nur 0,68). Die Ebene „Ebene #15“ (299, blaue Flügelfläche) ist ein
Tönungs-/Overlay-Stück über den Flügeln und nicht Teil der Figur.
PICK: [["MotiveDeepsea", 298, 1]]

Aufruf:   python3 deepsea_reaper.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-reaper.png + .json

Was ist was (x/y im Sprite):
* Ein schwebender Sensenmann mit Fledermausflügeln in Teal-Karo (51,93,119)/(77,137,154) mit dunkelblauem Umriss (13,16,49): Kopf mit grauem Schädel (189,189,189)/(106,106,106)/(213,213,213) unter einer schwarzen Kapuze (x 8–23, y 3–13),
  zwei orangefarbene Hörner (123,41,16)/(230,131,82)/(189,90,57) links (x 9–12) und rechts (x 19–22), an den Kopfseiten (y 3–8); weiße Augen (246,255,255) in Winkelform bei (13–14, 12–13) und (17–18, 12–13)
  (in der Kartenkunst grün überlagert), dazu ein diagonaler heller Streifen auf dem Schädel (Knochenglanz, kein Metall);
  zwei Fledermausflügel links (x 0–8) und rechts (x 23–31) (y 0–11); Rumpf/Robe (y 12–23) mit einem Saum aus drei Fetzen (y 17–21);
  eine Sense waagerecht davor (Schaft y 22–23, x 1–29, schwarz/dunkelgrau; Klinge unten links x 2–12, y 24–29 in Stahlgrau (189,189,189)/(213,213,213)/(246,246,246)).
Fest bleiben: Kopf-/Schädelform, Hörner, Augenform im Ruhebild, Schaft der Sense, Karomuster.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Partikel ausgenommen):
* Flügelschlag: beide Flügel schlagen gleichzeitig, jeweils 2 Spalten gemeinsam bis ±2 px senkrecht (wächst mit dem Abstand zum Gelenk bei x 8 bzw. 23, die Gelenkspalten stehen); Periode 24, zweimal pro Schleife.
* Schweben: der ganze Körper (Kopf, Rumpf, Sense) hebt sich 1 px beim Abschlag der Flügel und sinkt beim Aufschlag zurück (gegenläufig).
* Saumfetzen: die drei Fetzen (y 17–21) pendeln unabhängig ±1 px zur Seite (Periode 16, versetzte Phasen).
* Sense: die Klinge (y ≥ 24) pendelt ±1 px, ihre untere Hälfte (y ≥ 27) mit Verzögerung (Periode 24). Stahlglanz (Regel 14: Metall): ein heller Lichtpunkt läuft an der Schneide (Weiß (246,255,255)) entlang; zweimal pro Schleife.
* Blinzeln (Lid = schwarz (0,0,0), die Farbe der Augenhöhle): beide Augen, zweimal (Frame 14–16 und 38–40).
* Partikel (hinter der Figur): graue Seelen-Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`), nie ein Einzelpixel; siehe PUFFS.
Kein Glanz außer der Klinge (Schädel/Hörner = Knochen, kein Metall), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts.
Keine gemalten Pixel außer Farben der Quelle.
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

spr = L.lade('deepsea-reaper')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
SCHWARZ, WEISS = (0, 0, 0), (246, 255, 255)
GREY = [(0, 0, 0), (24, 24, 24), (41, 41, 41), (82, 82, 82), (106, 106, 106), (123, 123, 123), (189, 189, 189), (213, 213, 213), (246, 246, 246)]
assert KONTUR in UMRISS

AUGEN = [(13, 12), (14, 12), (14, 13), (17, 12), (18, 12), (17, 13)]
assert all(col(x, y) == WEISS for (x, y) in AUGEN)
SCHNEIDE = [(5, 25), (5, 26), (6, 26), (6, 27), (7, 27), (8, 28), (9, 28), (10, 29), (11, 29), (12, 29)]      # helle Pixel der Klinge, von oben links nach unten rechts
assert all(col(x, y) in ((189, 189, 189), (213, 213, 213), (246, 246, 246)) for (x, y) in SCHNEIDE)

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {14: 1, 15: 2, 16: 1, 38: 1, 39: 2, 40: 1}                 # 1 = obere Zeile (y 12) zu, 2 = alles zu
GLANZ = {s0 + k: k for s0 in (8, 32) for k in range(len(SCHNEIDE))}  # Lichtpunkt läuft die Schneide entlang: Frame s0 + k → Pixel k

# Teile (Masken im Sprite)
FL_L = vorhanden & (xx <= 7) & (yy <= 11)
FL_R = vorhanden & (xx >= 24) & (yy <= 11)
greymask = np.zeros((sh, sw), bool)
for c in GREY:
    greymask |= (spr[..., 0] == c[0]) & (spr[..., 1] == c[1]) & (spr[..., 2] == c[2])
KLINGE1 = vorhanden & greymask & (xx <= 13) & (yy >= 24) & (yy <= 26)
KLINGE2 = vorhanden & greymask & (xx <= 13) & (yy >= 27)
sub = vorhanden.copy()
sub[:17] = False
sub[22:] = False
_n, _lab = cv2.connectedComponents(sub.astype(np.uint8), connectivity=4)
_teile = sorted(range(1, _n), key=lambda k: int(np.nonzero(_lab == k)[1].mean()))
assert len(_teile) == 3
SAUM = [vorhanden & (_lab == k) for k in _teile]                   # links, Mitte, rechts
rest = vorhanden & ~FL_L & ~FL_R & ~KLINGE1 & ~KLINGE2 & ~SAUM[0] & ~SAUM[1] & ~SAUM[2]

BLASE = {'c': (189, 189, 189), 'r': (106, 106, 106)}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = []


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


FLL_A, FLR_A, REST_A, K1_A, K2_A = teil(FL_L), teil(FL_R), teil(rest), teil(KLINGE1), teil(KLINGE2)
SAUM_A = [teil(m) for m in SAUM]


def fluegel(a, pivot_x, amp, ph, breite=2):
    """Flügelschlag wie `L.spalten_welle`, aber je `breite` Spalten (vom Gelenk aus gezählt) mit gleichem Versatz: so zerreißt keine 1-px-dünne Stelle im 4er-Zusammenhang."""
    out = L.leer(*a.shape[:2])
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    maxd = max(abs(x - pivot_x) for x in cols)
    for x in cols:
        d = abs(x - pivot_x)
        frac = min(1.0, ((d // breite) * breite + breite / 2.0) / maxd) if d >= breite else 0.0
        dy = int(round(amp * math.sin(ph) * frac))
        for y in np.nonzero(a[:, x, 3])[0]:
            out[y + dy, x] = a[y, x]
    return out


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def versatz(i, per, ph, amp=1.2):
    """Ganzzahliger Versatz ±1, bei Frame 0 genau 0 (Phasenkorrektur)."""
    return max(-1, min(1, int(round(amp * (sinz(i, per, ph) - sinz(0, per, ph))))))


def frame_gross(i, nur=None):
    ph = 2 * math.pi * i / 24
    kb = REST_A.copy()
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in AUGEN:
            if bl == 2 or y == 12:
                set_px(kb, x, y, SCHWARZ)
    fl = fluegel(FLL_A, GPL + 8, 2.5, ph)
    fr = fluegel(FLR_A, GPL + 23, 2.5, ph)
    # Sense: Klinge pendelt, Schneide glänzt
    k1, k2 = K1_A.copy(), K2_A.copy()
    g = GLANZ.get(i)
    if g is not None:
        x, y = SCHNEIDE[g]
        for kk in (k1, k2):
            if kk[GPT + y, GPL + x, 3]:
                kk[GPT + y, GPL + x, :3] = WEISS
    s1 = int(round(sinz(i, 24)))
    s2 = int(round(1.4 * (sinz(i, 24, -0.8) - sinz(0, 24, -0.8))))
    s2 = max(s1 - 1, min(s1 + 1, s2))
    saum = [(SAUM_A[0], versatz(i, 16, 0.0), 0), (SAUM_A[1], versatz(i, 16, 2.1), 0), (SAUM_A[2], versatz(i, 16, 4.2), 0)]
    bob = -int(round(1.0 * math.sin(ph)))
    koerper = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (kb, 0, 0)] + [(a, dx, dy) for (a, dx, dy) in saum] + [(k1, s1, 0), (k2, s2, 0)])
    koerper = L.versetze(koerper, 0, bob) if bob else koerper
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
    L.speichern('deepsea-reaper', 'Deepsea Reaper', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-reaper-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
