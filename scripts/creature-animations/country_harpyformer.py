# -*- coding: utf-8 -*-
"""Idle-Animation für „Country Harpyformer“ (Creature) — Harpyie mit Strohhut und grünen Zöpfen sitzt in einem Heunest und spielt Banjo: der linke (vom Betrachter) Flügel schlägt die Saiten an, der erhobene Flügel greift den Hals.

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
* Gesicht (x 9–19, y 8–11): Haut (246,205,139) (238,156,123), Nasenglanz (255,230,213); Augen sind schwarze Striche (13,9) (16,9) (17,9); beidseits olivgrüne Haare/Zöpfe
  (132,133,30) (169,171,38) (84,84,19) mit sehr dunklem Umriss (21,21,4).
* Zöpfe: die grünen Strähnen fallen hinter den Flügeln neben dem Körper herab — links x 6–9, y 15–21; rechts x 21–25, y 13–21.
* BANJO (Nutzer: „spielt Banjo“): graue Trommel (177,185,188) (210,211,206) (118,116,117) (70,74,73) mit dunklem Rand (x 13–19, y 13–20); der HALS läuft von der Trommel schräg nach oben rechts
  unter dem erhobenen Flügel durch (er ist von den Federn verdeckt), sein dunkler Wirbelkasten mit weißen Stimmwirbeln ragt rechts oben aus dem Flügel (x 24–28, y 3–8). Der orange-gelbe Streifen
  rechts der Trommel (x 19–21, y 16–20) (230,131,16) (255,180,24) (255,222,90) ist wohl der Spannreif — bleibt starr und bekommt KEINEN Glanz (nicht sicher Metall, Regel 14).
* Linker Flügel (vom Betrachter; ihr RECHTER) (x 9–16, y 12–22): hängt hell-blau-weiß (246,255,255) (222,255,255) (180,246,255) (106,197,255) von der Schulter (x 9–12, y 12) schräg vor die
  linke Trommelhälfte; die Federspitze (x 14–16, y 19–22) liegt vor den Saiten/der Trommel. Er ist der SCHLAGFLÜGEL (Saiten anschlagen).
* Rechter Flügel (vom Betrachter; ihr LINKER) (x 18–28, y 3–15): Wurzel an der Schulter (x 18–22, y 10–15), das lange Federblatt ragt schräg nach oben rechts bis zur Spitze (x 25–28, y 3–8) — er ist
  erhoben und GREIFT den Hals; er bleibt deshalb fest. Der Umriss auf der Oberkante ist (26,13,7), (63,51,51) und Schwarz.
* Füße (x 9–14, y 21–25 und x 18–24, y 21–26): braune Krallenfüße (230,131,82) (189,90,57) (148,65,24) mit weißen Krallenspitzen (10,23) (13,24) (20,24) (23,25).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SITZT im Nest, nichts schwebt (Nutzer-Feedback „spielt Banjo“, Regel 18):
* Saiten anschlagen (Periode 24 Frames, zwei Schlagfolgen pro Schleife: kräftiger Abschlag – kleinerer Zweitschlag – Pause – kräftiger Abschlag): der linke Flügel pendelt um die Schulter — jede Zeile ab y 16
  wandert waagerecht nach rechts über die Trommel, je weiter unten desto mehr (Spitze bis 4 px, die Federtextur bleibt, nichts wird kopiert); die Schulter (y ≤ 15) bleibt. Dahinter frei werdende
  Zellen (y ≥ 18) zeigen das Heu (HEU_HINTEN), die Zellen y 16–17 den dunklen Umriss (21,21,4) (UNTER_FL).
* Der erhobene rechte Flügel (greift den Hals) und Trommel/Banjo-Hals/Wirbelkasten bleiben fest — keine Flügelschläge mehr.
* Kopfnicken im Takt: Hut und Gesicht (x ≤ 21, y ≤ 11, ohne Flügelfedern) senken sich beim Abschlag 1 px und kommen zurück (nur Heben/Senken, nie seitlich).
* Zöpfe schwingen: die unteren Zeilen pendeln ±1 px (links Periode 16, rechts 24 Frames, gegeneinander versetzt); das innere Ende bleibt am Körper.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe der Nachbarpixel.
* Federflöckchen (Partikel, 2×2): hell-blaue 2×2-Federchen lösen sich langsam von den Flügeln und sinken ab; zwei kleine Heustaub-Wölkchen steigen vom Nest auf. Keine 1-px-Punkte
  (`B.wolken_ebene`). Sie liegen hinter der Figur.
* Fest bleiben: Nest, Füße, Banjo, erhobener Flügel, Gesicht außer Blinzeln.

Ergänzungen: (1) Das Nest fehlt unter und hinter der Harpyie (die Ebene zeigt dort nur die Figur): hinter der Figur (x 6–25, y 18–27) wird das Heu aus der Spalte darunter nach oben fortgesetzt
(Farben der Heupixel darunter; nur dort, wo die Figur Heu verdeckt, siehe HEU_HINTEN, 104 Pixel) — in Frame 0 bleibt alles verdeckt (Ruhepose = Original). (2) Hinter dem Schlagflügel (y 16–17, die Zellen
x 10–13 des Flügels) liegt nichts; sie bekommen die Umrissfarbe (21,21,4) (UNTER_FL, 8 Pixel), damit der Flügel beim Schlag keine Lücke in die Figur reißt.
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
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 2                    # links/rechts: Schlagflügel wandert bis 3 px; oben: Kopfnicken geht nach unten, Rand 2 + 1

spr = L.lade('country-harpyformer')                        # Ebene 36 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

HAY_FARBEN = [(155, 125, 71), (123, 103, 60), (76, 63, 38), (186, 166, 107), (213, 191, 124), (102, 85, 48)]
FLUEGEL_FARBEN = [(106, 197, 255), (180, 246, 255), (222, 255, 255), (246, 255, 255)]
OLIV_FARBEN = [(132, 133, 30), (169, 171, 38), (84, 84, 19), (197, 199, 44), (21, 21, 4)]
WEISS = (255, 255, 255)

# ── Teile trennen (Farbe + Bereich) ────────────────────────────────────────────────────────────────────────────────
M_HEU = L.farbmaske(spr, HAY_FARBEN)
M_FIG = (spr[..., 3] > 0) & ~M_HEU
M_R_SPITZE = M_FIG & (xx >= 22) & (yy <= 11)
M_FUESSE = M_FIG & ((((xx <= 14) & (yy >= 22)) | ((xx >= 11) & (xx <= 12) & (yy == 21))) | ((xx >= 18) & (yy >= 21) & ~((xx == 24) & (yy == 21))))
M_L_FLUEGEL = M_FIG & L.farbmaske(spr, FLUEGEL_FARBEN) & (xx <= 16) & (yy >= 12) & (yy <= 22) & ~M_FUESSE
M_ZOPF_L = M_FIG & L.farbmaske(spr, OLIV_FARBEN) & (xx <= 9) & (yy >= 14)
M_ZOPF_R = M_FIG & L.farbmaske(spr, OLIV_FARBEN) & (xx >= 21) & (yy >= 13) & ~M_R_SPITZE
M_KOERPER = M_FIG & ~(M_R_SPITZE | M_FUESSE | M_L_FLUEGEL | M_ZOPF_L | M_ZOPF_R)
# Kopf (Hut + Gesicht): nickt im Takt; Flügelfedern und weiße Wirbel am Flügelansatz gehören nicht dazu
M_KOPF = M_KOERPER & (yy <= 11) & (xx <= 21) & ~L.farbmaske(spr, FLUEGEL_FARBEN + [WEISS])
M_REST = M_KOERPER & ~M_KOPF


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


HEU, KOERPER, FUESSE, KOPF = teil(M_HEU), teil(M_REST), teil(M_FUESSE), teil(M_KOPF)
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

# Ergänzung (verdeckt, Runde 3: „unter dem Flügel ist, wenn er sich bewegt, Heu/Hintergrund zu sehen, statt dass dort das Bein und Ende des Banjos gezeichnet wären“):
# Unter dem Schlagflügel liegen das linke BEIN (orange Wade (230,131,16) mit gelben Glanzpixeln (255,180,24) (255,222,90) und dunklem Umriss, spiegelbildlich zum rechten Bein x 19–21)
# und das untere linke ENDE der Banjo-Trommel (schwarze/dunkle Randpixel). Der Flügel gibt beim Schlag genau die Zellen frei, die hier stehen (Sprite-Koordinaten, 14 Pixel, alles Farben des Sprites);
# im Ruhebild bleiben alle verdeckt. Das Bein läuft von (11, 17) senkrecht nach unten, knickt in Zeile 20 um 1 px nach rechts und geht in den Fuß (12, 21) über — wie das rechte Bein (dort knickt es nach links).
DUNKEL, E_UMR = (26, 13, 7), (49, 24, 0)
ORANGE, GELB1, GELB2, SCHWARZ = (230, 131, 16), (255, 180, 24), (255, 222, 90), (0, 0, 0)
BEIN_BANJO = {(10, 16): DUNKEL, (10, 17): DUNKEL, (11, 17): ORANGE,
              (11, 18): ORANGE, (12, 18): DUNKEL,
              (11, 19): ORANGE, (12, 19): GELB1, (13, 19): SCHWARZ,
              (12, 20): ORANGE, (13, 20): GELB2, (14, 20): DUNKEL,
              (13, 21): E_UMR, (14, 21): DUNKEL, (15, 21): DUNKEL}
_unter = np.zeros((sh, sw, 4), np.uint8)
for (_x, _y), _c in BEIN_BANJO.items():
    assert M_L_FLUEGEL[_y, _x], (_x, _y)                    # nur Zellen, die der Flügel im Ruhebild verdeckt
    _unter[_y, _x, :3] = _c
    _unter[_y, _x, 3] = 255
UNTER_FL = L.platz(_unter, H, W, PAD_L, PAD_T)
ERGAENZT_UNTER = len(BEIN_BANJO)

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
AUGEN = {(13, 9): (246, 205, 139), (16, 9): (246, 205, 139), (17, 9): (238, 156, 123)}          # Augenpixel → Lid (Hautfarbe der Nachbarpixel)
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (76, 63, 38), 2: (76, 63, 38), 3: (21, 21, 4), 4: (21, 21, 4), 5: (49, 24, 0), 6: (49, 24, 0), 7: (180, 246, 255), 8: (180, 246, 255), 9: (21, 21, 4), 10: (21, 21, 4)}
FEDER = {'c': (222, 255, 255), 'r': (180, 246, 255)}
STAUB = {'c': (213, 191, 124), 'r': (186, 166, 107)}


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Saiten anschlagen ────────────────────────────────────────────────────────────────────────────────────────────────
# Schlagprofil je Frame einer 24er-Periode: 0 = Ruhepose (Flügel links), 1 = ganz über die Trommel geschwungen. Kräftiger Abschlag, kleinerer Zweitschlag, Pause, kräftiger Abschlag.
STRUM = [0.0, 0.0, 0.15, 0.6, 1.0, 0.9, 0.6, 0.3, 0.1, 0.0, 0.1, 0.45, 0.75, 0.5, 0.25, 0.05, 0.0, 0.0, 0.1, 0.5, 1.0, 0.85, 0.45, 0.15]
# Weg je Zeile bei vollem Schlag (Sprite-Zeilen): Schulter fest, Spitze 4 px; benachbarte Zeilen unterscheiden sich um höchstens 0,5 px → Flügel bleibt zusammenhängend
SCHLAG = {16: 1.0, 17: 1.5, 18: 2.1, 19: 2.7, 20: 3.3, 21: 3.8, 22: 4.2}


def strum(t):
    return STRUM[t % len(STRUM)]


def schlagfluegel(a, t):
    u = strum(t)
    return A.zeilen_versatz(a, lambda y: u * SCHLAG.get(y - PAD_T, 0.0))


def nick(t):
    """Kopf senkt sich 1 px beim Abschlag (Strum ≥ 0,5), sonst Ruhelage."""
    return 1 if strum(t) >= 0.5 else 0


# ── Zöpfe, Blinzeln ──────────────────────────────────────────────────────────────────────────────────────────────────
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
    schichten = []
    if 'figur' in ebenen:
        kopf = KOPF
        if blinzeln(i):
            kopf = kopf.copy()
            for (x, y), c in AUGEN.items():
                kopf[PAD_T + y, PAD_L + x, :3] = c
        schichten += [(HEU_HINTEN, 0, 0, 1), (HEU, 0, 0, 2), (UNTER_FL, 0, 0, 9), (zopf_links(ZOPF_L, i), 0, 0, 3), (zopf_rechts(ZOPF_R, i), 0, 0, 4),
                      (FUESSE, 0, 0, 5), (KOERPER, 0, 0, 6), (kopf, 0, nick(i), 10), (schlagfluegel(FL_L, i), 0, 0, 7), (FL_R, 0, 0, 8)]
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
