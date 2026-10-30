# -*- coding: utf-8 -*-
"""Idle-Animation für „Country Harpyformer“ (Creature) — Harpyie mit Strohhut und grünen Zöpfen in einem Heunest, winkt mit dem erhobenen Flügel und schwebt.

PICK: [["MotiveGrailWar", 36, "Country Harpy (30×34 px, Harpyie + Heunest in einer Ebene)"]]
Quelle: MotiveGrailWar.xcf, Ebene 36 „Country Harpy“ (Versatz (255, 245)); sie liegt unverändert als src/country-harpyformer.png (30×34).
Abgleich mit der Kartenkunst (data/card-art/native/Country_Harpyformer.png, Ursprung der Karte in der xcf = (218, 234), Sprite sitzt an Kartenpixel (37, 11)): alle 700 Pixel der Ebene
stehen in der Karte genauso (Farbvergleich, Toleranz 30; die Kartenkunst ist auf die Palette gerastet, daher nicht bitgleich). Die Ebenen „Marianne #1–#9“ in derselben xcf gehören zur Bauernmädchen-
Figur links im Kartenbild (Heugabel, nicht Teil dieser Creature) und wurden nicht verwendet. Es gibt keine weitere Ebene dieser Figur (kein Zubehör, keine Sterne).

Aufruf:   python3 country_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/country-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y; die Teile werden im Skript per Farbe und Bereich aus der einen Ebene getrennt):
* Heunest (317 Pixel, Farben (155,125,71) (123,103,60) (76,63,38) (186,166,107) (213,191,124) (102,85,48)): Wulst links (x 0–6, y 16–32), rechts (x 23–29, y 16–32) und das Heu vor/unter der Harpyie.
* Strohhut (x 8–23, y 0–7): braun-orange Töne, grau-schwarzes Hutband (99,99,99) (70,74,73) (x 12–17, y 3–5).
* Gesicht (x 12–19, y 8–12): Haut (246,205,139) (238,156,123), Nasenglanz (255,230,213); Augen sind schwarze Striche (13,9) (16,9) (17,9); beidseits olivgrüne Haare/Zöpfe
  (132,133,30) (169,171,38) (84,84,19) mit sehr dunklem Umriss (21,21,4).
* Zöpfe: die grünen Strähnen fallen hinter den Flügeln neben dem Körper herab — links x 6–9, y 15–21; rechts x 21–25, y 13–21.
* Linker Flügel (x 9–16, y 12–22): hängt hell-blau-weiß (246,255,255) (222,255,255) (180,246,255) (106,197,255) vor der Brust.
* Rechter Flügel (x 18–28, y 3–15): Wurzel an der Schulter (x 18–22, y 12–15), das lange Federblatt ragt schräg nach oben rechts bis zur Spitze (x 25–28, y 3–8) — er ist zum Winken erhoben.
  Der Umriss auf der Oberkante ist (26,13,7), (63,51,51) und Schwarz.
* Grauer Gegenstand (x 13–18, y 13–20): graues Blatt (177,185,188) (210,211,206) (118,116,117) (70,74,73) mit dunklem Rand, hängt vor dem Bauch; daneben ein orange-gelber Streifen (x 19–21, y 16–20)
  (230,131,16) (255,180,24) (255,222,90). Was beides ist (Schaufelblatt/Banjo/Laterne), lässt sich aus der Kunst nicht sicher sagen — beides bleibt starr und bekommt KEINEN Glanz (Regel 14, im Zweifel weglassen).
* Füße (x 9–14, y 21–25 und x 18–24, y 21–26): braune Krallenfüße (230,131,82) (189,90,57) (148,65,24) mit weißen Krallenspitzen (10,23) (13,24) (20,24) (23,25).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend im festen Rhythmus: ein Schlag = 12 Frames (780 ms), 4 Schläge pro Schleife; Abschlag 5 Frames, Aufschlag 7 Frames. Der erhobene rechte Flügel schlägt nach unten:
  die Spalten der Federspitze (x 22–28) wandern als Ganzes senkrecht, bis 6 px (Exponent 1,15, die Spitze hinkt 1 Frame nach, Wurzel x ≤ 21 fest). Der linke Flügel macht den Gegenschlag:
  seine Spitze (Spalten x 9–13) hebt sich in derselben Zeit bis 2 px. Federtextur bleibt, nichts wird kopiert.
* Schwebe-Bob: Harpyie samt Hut, Gesicht, Flügeln, Zöpfen und Gegenstand hebt sich im Takt bis 2 px vom Nest (am höchsten in der Schlagmitte); die Füße baumeln nach (60 %, 1,5 Frames
  verzögert, die Lücke füllen doppelte Beinzeilen). Das Heunest bleibt am Boden.
* Zöpfe schwingen: die unteren Zeilen pendeln ±1 px (links Periode 16, rechts 24 Frames, gegeneinander versetzt); das innere Ende bleibt am Körper.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe der Nachbarpixel.
* Federflöckchen (Partikel, 2×2): vier hell-blaue 2×2-Federchen lösen sich langsam von den Flügeln und sinken ab; zwei kleine Heustaub-Wölkchen steigen vom Nest auf. Keine 1-px-Punkte
  (`B.wolken_ebene`). Sie liegen hinter der Figur.
* Fest bleiben: Nest, grauer Gegenstand, orange-gelber Streifen, Gesicht außer Blinzeln.

Ergänzungen: Das Nest fehlt unter und hinter der Harpyie (die Ebene zeigt dort nur die Figur). Damit beim Schweben kein Loch im Heu entsteht, wird hinter der Figur (x 6–25, y 18–27) das Heu aus der Spalte
darunter nach oben fortgesetzt (Farben der Heupixel darunter; nur dort, wo die Figur Heu verdeckt, siehe HEU_HINTEN) — in Frame 0 bleibt alles verdeckt (Ruhepose = Original).
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

spr = L.lade('country-harpyformer')                        # Ebene 36 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

HAY_FARBEN = [(155, 125, 71), (123, 103, 60), (76, 63, 38), (186, 166, 107), (213, 191, 124), (102, 85, 48)]
FLUEGEL_FARBEN = [(106, 197, 255), (180, 246, 255), (222, 255, 255), (246, 255, 255)]
OLIV_FARBEN = [(132, 133, 30), (169, 171, 38), (84, 84, 19), (197, 199, 44), (21, 21, 4)]

# ── Teile trennen (Farbe + Bereich) ────────────────────────────────────────────────────────────────────────────────
M_HEU = L.farbmaske(spr, HAY_FARBEN)
M_FIG = (spr[..., 3] > 0) & ~M_HEU
M_R_SPITZE = M_FIG & (xx >= 22) & (yy <= 11)
M_FUESSE = M_FIG & ((((xx <= 14) & (yy >= 22)) | ((xx >= 11) & (xx <= 12) & (yy == 21))) | ((xx >= 18) & (yy >= 21) & ~((xx == 24) & (yy == 21))))
M_L_FLUEGEL = M_FIG & L.farbmaske(spr, FLUEGEL_FARBEN) & (xx <= 16) & (yy >= 12) & (yy <= 22) & ~M_FUESSE
M_ZOPF_L = M_FIG & L.farbmaske(spr, OLIV_FARBEN) & (xx <= 9) & (yy >= 14)
M_ZOPF_R = M_FIG & L.farbmaske(spr, OLIV_FARBEN) & (xx >= 21) & (yy >= 13) & ~M_R_SPITZE
M_KOERPER = M_FIG & ~(M_R_SPITZE | M_FUESSE | M_L_FLUEGEL | M_ZOPF_L | M_ZOPF_R)


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


HEU, KOERPER, FUESSE = teil(M_HEU), teil(M_KOERPER), teil(M_FUESSE)
FL_L, FL_R = teil(M_L_FLUEGEL), teil(M_R_SPITZE)
ZOPF_L, ZOPF_R = teil(M_ZOPF_L), teil(M_ZOPF_R)

# Ergänzung (verdeckt): Heu hinter/unter der Figur — nur dort, wo die Figur (nicht Heu) steht, Farbe aus der Spalte darunter
_hinten = np.zeros((sh, sw, 4), np.uint8)
for _x in range(6, 26):
    for _y in range(18, 28):
        if M_FIG[_y, _x]:
            _y2 = next((q for q in range(_y + 1, sh) if M_HEU[q, _x]), None)
            if _y2 is not None:
                _hinten[_y, _x] = spr[_y2, _x]
            else:                                          # Spalte hat darunter kein Heu: nächstes Heupixel in der Zeile
                _x2 = min((q for q in range(sw) if M_HEU[_y, q]), key=lambda q: abs(q - _x))
                _hinten[_y, _x] = spr[_y, _x2]
HEU_HINTEN = L.platz(_hinten, H, W, PAD_L, PAD_T)
ERGAENZT = int((_hinten[..., 3] > 0).sum())

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
AUGEN = {(13, 9): (246, 205, 139), (16, 9): (246, 205, 139), (17, 9): (238, 156, 123)}          # Augenpixel → Lid (Hautfarbe der Nachbarpixel)
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (76, 63, 38), 2: (76, 63, 38), 3: (21, 21, 4), 4: (21, 21, 4), 5: (49, 24, 0), 6: (49, 24, 0), 7: (180, 246, 255), 8: (180, 246, 255)}
FEDER = {'c': (222, 255, 255), 'r': (180, 246, 255)}
STAUB = {'c': (213, 191, 124), 'r': (186, 166, 107)}


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_R, A_L = 6.0, 2.0
X_R, MAXD_R = 21, 7                                        # Spitze x 22–28, Wurzel x ≤ 21 fest
X_L, MAXD_L = 15, 6                                        # linke Spitze x 9–13 hebt sich


def welle(t):
    """Schlagphase 0 (rechte Spitze oben = Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t, amp):
    """Spaltenverschiebung als Funktion des Abstandsanteils f (positiv = nach unten); Frame 0 = Original."""
    def dy(f):
        return amp * (welle(t - LAG * f) - welle(-LAG * f)) * f ** POT
    return dy


# ── Schwebe-Bob, Füße, Zöpfe, Blinzeln ─────────────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    """Anhebung in px (0 = Original), am höchsten in der Schlagmitte."""
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    """Füße baumeln nach: 1,5 Frames verzögert, zu 60 % (nie höher als der Körper)."""
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


def _zopf(a, y0, y1, t, periode, phase0):
    """Zopf schwingt (äußeres Ende = links im Bild von `a`; Zeilen y0…y1): unten bis 1,4 px, oben nichts; zu schmale Zeilen (< 3 px) bleiben stehen."""
    innen, breite = {}, {}
    for y in range(y0, y1 + 1):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if len(xs_):
            innen[y] = int(xs_.max()) + 1
            breite[y] = int(xs_.max() - xs_.min() + 1)
    ys = sorted(innen)
    s = math.sin(2 * math.pi * t / periode + phase0) - math.sin(phase0)                  # Frame 0 = Ruhelage

    def dx(y):
        d = -1.4 * s * ((y - ys[0]) / max(1, ys[-1] - ys[0])) ** 1.2
        return 0 if breite[y] - int(round(d)) < 2 or breite[y] < 3 else d
    return B.zeilen_dehnen_aussen(a, ys[0], ys[-1], innen, dx)


def zopf_links(a, t):
    return _zopf(a, PAD_T + 14, PAD_T + 21, t, 16.0, 0.0)


def zopf_rechts(a, t):
    """Wie links, an der senkrechten Mittelachse gespiegelt (das äußere Ende ist rechts)."""
    return _zopf(a[:, ::-1].copy(), PAD_T + 18, PAD_T + 21, t, 24.0, 1.0)[:, ::-1].copy()


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


# ── Partikel (2×2, hinter der Figur) ─────────────────────────────────────────────────────────────────────────────────
PUFFS_FEDER = [
    dict(x=px(27, 8)[0], y=px(27, 8)[1], vx=1, vy=13, off=0, form='s', wackeln=1),
    dict(x=px(24, 5)[0], y=px(24, 5)[1], vx=-1, vy=13, off=24, form='s', wackeln=1),
    dict(x=px(8, 14)[0], y=px(8, 14)[1], vx=-1, vy=9, off=12, form='s', wackeln=1),
    dict(x=px(11, 12)[0], y=px(11, 12)[1], vx=1, vy=9, off=36, form='s', wackeln=1),
]
PUFFS_STAUB = [
    dict(x=px(5, 24)[0], y=px(5, 24)[1], vx=-1, vy=-9, off=6, form='o', wackeln=1),
    dict(x=px(27, 26)[0], y=px(27, 26)[1], vx=1, vy=-9, off=30, form='o', wackeln=1),
]
TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n, k = hub(i), fuss_hub(i)
    schichten = []
    if 'figur' in ebenen:
        koerper = KOERPER
        if blinzeln(i):
            koerper = koerper.copy()
            for (x, y), c in AUGEN.items():
                koerper[PAD_T + y, PAD_L + x, :3] = c
        fuesse = FUESSE
        if n - k > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + 21, n - k)             # Füße: Lücke füllen doppelte oberste Beinzeile
        spitze = B.spalten_schub(FL_R, PAD_L + X_R, dy_fn(i, A_R), MAXD_R)
        links = B.spalten_schub(FL_L, PAD_L + X_L, dy_fn(i, -A_L), MAXD_L)
        schichten += [(HEU_HINTEN, 0, 0, 1), (HEU, 0, 0, 2), (zopf_links(ZOPF_L, i), 0, -n, 3), (zopf_rechts(ZOPF_R, i), 0, -n, 4),
                      (fuesse, 0, -k, 5), (koerper, 0, -n, 6), (links, 0, -n, 7), (spitze, 0, -n, 8)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if partikel:
        p = L.zusammen(H, W, [(B.wolken_ebene(H, W, i, N, PUFFS_STAUB, STAUB), 0, 0), (B.wolken_ebene(H, W, i, N, PUFFS_FEDER, FEDER), 0, 0)])
        f = L.zusammen(H, W, [(p, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('country-harpyformer', 'Country Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/country-harpyformer-strip.png', frames, spalten=8, scale=6)
