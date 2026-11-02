# -*- coding: utf-8 -*-
"""Idle-Animation für „Metal Harpyformer“ (Creature) — Runde 2: Die Harpyie steht am Boden und schwenkt die brennende E-Gitarre wie eine Fackel durch die Luft.

PICK: [["MotiveMoe", 165, "Metal Harpyformer (28×49 px: Harpyie + Gitarre + Feuerkugel in einer Ebene)"]]
Quelle: MotiveMoe.xcf, Ebene 165 „Metal Harpyformer“ (Versatz (244, 349)); sie liegt unverändert als src/metal-harpyformer.png (28×49, 813 Pixel).
Abgleich mit der Kartenkunst (data/card-art/native/Metal_Harpyformer.png, 76×51; Ebene sitzt bei Kartenpixel (24, −9)): alle in der Karte liegenden Ebenenpixel stehen dort genauso; die obersten 9 Zeilen der
Feuerkugel ragen in der Karte über den Rand hinaus und sind nur in der Ebene vollständig. Nachbarebenen im Bereich (Robird, Balloons, Ebene #148 …) sind unsichtbar/Szene; Blumen, Busch, Bühne = Szene.
Die dunkelrote Harpyie in MotiveDeri 41 („Grunge Harpyformer #1“) ist dieselbe Figur ohne Gitarre und Feuer — nicht benutzt.

Aufruf:   python3 metal_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/metal-harpyformer.png + .json  (auf die Figur zugeschnitten, um die Ruhefigur zentriert)

Identifikation (Sprite-Koordinaten x, y; die Teile trennt das Skript per Farbe und Bereich):
* Feuerball (x 3–24, y 0–20; Rot (202,44,41), Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184)): umhüllt das obere Gitarrenende; heller Kern in der Mitte. Wird NEU mit anim_feuer.py gezeichnet (Regel 15).
* Gitarre (x 8–23, y 14–28): rote Korpus-/Halsfläche (233,0,1) (210,0,1) (153,2,0) mit rosa Lichtpixeln (233,114,114); ein diagonaler Hals/Griffbrett-Streifen mit Schwarz-Weiß-Muster (26,33,39) (242,255,255)
  (172,177,179) läuft vom Feuer nach rechts unten zur rechten Hand; rotes Teil rechts (x 17–23, y 19–22); eine rote Säule (x 12–15, y 20–26) endet auf dem Kopf der Harpyie. Ohne Glanz (Saiten sind
  Schwarz-Weiß-Muster, kein erkennbares Metallglanz-Detail; im Zweifel weggelassen).
* Harpyie (x 4–23, y 25–48): rotbraunes Haar/Gesicht, schwarzer Umriss (19,10,10); Gesicht x 9–18, y 29–34 mit Totenkopf-/Corpsepaint-Muster; Augen = hellblaue Iris + dunkelrote Pupille (11,30) (12,30) und (15,30) (16,30);
  weiß-blau-graue Brustplatte (y 35–40); Haarsträhnen/Umhang (x 4–8 und 19–23, y 37–44); Beine/Füße (x 8–20, y 43–48).
* Flügel/Arme: graue Fledermausflügel (Töne (125,125,125) (112,112,112) (89,89,89) (63,63,63) (45,45,45)); sie stehen als hochgereckte Arme: links x 0–9, y 21–37 (Spitze frei bis y 28), rechts x 18–27, y 23–37; die
  rechte Handspitze (x 20–24, y 23–25) hält den Gitarrenhals.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Ruhepose bis auf das neu gezeichnete Feuer). Kein Flug, kein Hover-Bob: Körper, Kopf, Füße stehen fest am Boden.
* Fackel-Schwenk (3 pro Schleife, Periode 16 Frames = 1,04 s): die Gitarre samt Hand schwingt sinusförmig bis ±3 px nach links/rechts und kippt dabei oberhalb der Hand (Zeilenversatz, Gefälle ≤ 0,11 px je Zeile,
  der Kippwinkel hinkt dem Schwenk 0,7 rad nach → „Peitscheneffekt“); starr geschoben, nichts kopiert, 4er-Zusammenhang über `A.verbinde4`.
* Rechter Flügel (Hand): schwingt mit der Gitarre (Zeilen bis y 26 voll, bis y 31 abklingend; Schulter y ≥ 29 fest, die Wurzel steht als fester Unterbau darunter). Linker Flügel schwingt mit 90 %, 1 Frame verzögert, mit.
* Feuer (Regel 15, `anim_harpyb.WindFeuer` = anim_feuer.Feuer + Fahrtwind): 7 verschachtelte Zungen mit je 5 Farbschichten, je Zunge eigene Posenfolge (12 Posen à 2–3 Frames); Basis ruhig und breit am Gitarrenkopf, Spitzen
  züngeln; die Flamme neigt sich entgegen der Schwenkrichtung (Fahrtwind ±2,6 px an der Spitze) und folgt dem Kippen der Gitarre. Zungenspitzen reißen ab und steigen als Funken auf (1 px, gelb → orange → rot,
  12 pro Schleife, bleiben beim Aufsteigen in der Luft stehen, während die Fackel weiterzieht).
* Haarsträhnen unten schwingen ±1 px (Periode 16, gegenläufige Phase); das innere Ende bleibt am Körper.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (114,63,63) auf Iris und Pupille.

Ergänzungen (Sprite-Koordinaten): Haaransatz unter dem Gitarrenfuß, den die Gitarre sonst verdeckt: (13,25) (14,25) (15,25) = Umrissfarbe (19,10,10), (14,26) = Haarfarbe (168,97,97). Das Feuer wird komplett neu gezeichnet
(Farben der Quelle). Sonst nichts ergänzt: die Flügelwurzel steht unverschoben unter dem verschobenen Flügel.
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene; randtest: 0 Frames.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger_b as B
import anim_feuer as FEU
import anim_harpyb as HB
import anim_amorph as A

N, MS = 48, 65
SWING = 16                                                 # Frames je Schwenk (hin und her), 3 pro Schleife
A_SW = 3.0                                                 # Ausschlag der Gitarre (px)
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 16, 2

spr = L.lade('metal-harpyformer')                          # Ebene 165 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
FLAMMEN = [ROT, ORANGE, GELB, CREME]
GRAU = [(45, 45, 45), (125, 125, 125), (89, 89, 89), (112, 112, 112), (63, 63, 63), (70, 68, 71), (0, 2, 0)]
KOERPERFARBEN = [(73, 40, 40), (19, 10, 10), (114, 63, 63), (147, 80, 80), (170, 101, 101), (168, 97, 97)]
LID = (114, 63, 63)
AUGEN = [(11, 30), (12, 30), (15, 30), (16, 30)]           # Iris + Pupille → Lid

# ── Teile trennen ─────────────────────────────────────────────────────────────────────────────────────────────────────
M_FEUER = fig & L.farbmaske(spr, FLAMMEN) & (yy <= 20)
M_GITARRE = fig & ~L.farbmaske(spr, FLAMMEN + GRAU + KOERPERFARBEN) & (yy >= 14) & (yy <= 28) & (xx >= 8) & (xx <= 24)
M_FL_L = fig & L.farbmaske(spr, GRAU) & (xx <= 9) & (yy >= 21) & (yy <= 37)
M_FL_R = fig & L.farbmaske(spr, GRAU) & (xx >= 18) & (yy >= 21) & (yy <= 37)
M_STRANG_L = fig & (xx <= 8) & (yy >= 38) & ~M_FL_L & (yy <= 44)
M_STRANG_R = fig & (xx >= 19) & (yy >= 38) & ~M_FL_R & (yy <= 44)
M_REST = fig & ~(M_FEUER | M_GITARRE | M_FL_L | M_FL_R | M_STRANG_L | M_STRANG_R)


def teil(maske, quelle=spr):
    return L.platz(np.where(maske[..., None], quelle, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


GITARRE, FL_L, FL_R, STR_L, STR_R = (teil(m) for m in (M_GITARRE, M_FL_L, M_FL_R, M_STRANG_L, M_STRANG_R))
# Ergänzung: Kopf unter dem Gitarrenfuß (die Gitarre verdeckt dort Haaransatz, sobald sie wegschwingt)
ERG = {(13, 25): (19, 10, 10), (14, 25): (19, 10, 10), (15, 25): (19, 10, 10), (14, 26): (168, 97, 97)}
_rest_src = spr.copy()
for (x, y), c in ERG.items():
    assert not (M_REST[y, x])
    _rest_src[y, x, :3] = c
    _rest_src[y, x, 3] = 255
M_REST_ERG = M_REST.copy()
for (x, y) in ERG:
    M_REST_ERG[y, x] = True
REST = teil(M_REST_ERG, _rest_src)
UNTER_L = teil(M_FL_L & (yy >= 29))                         # Wurzel der Flügel steht fest unter dem verschobenen Flügel
UNTER_R = teil(M_FL_R & (yy >= 29))

_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (45, 45, 45), 2: (45, 45, 45), 3: (19, 10, 10), 4: (19, 10, 10), 5: (19, 10, 10), 6: (153, 2, 0), 7: (202, 44, 41), 8: (62, 56, 50)}
# 1/2 Flügel, 3/4 Strähnen, 5 Körper, 6 Gitarre (rot), 7 Feuer, 8 Gitarrenhals (Schwarz-Weiß-Muster/grau)
HALS_FARBEN = [(242, 255, 255), (172, 177, 179), (26, 33, 39), (62, 56, 50), (102, 81, 74)]

# ── Feuer (anim_feuer.py, eigene Windvariante) ────────────────────────────────────────────────────────────────────────
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
SPERRE = np.zeros((H, W), bool)
SPERRE[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = M_GITARRE & (yy <= 21)
ZUNGEN = [FEU.Zunge(PAD_L + x, PAD_T + b, h, br) for (x, b, h, br) in
          [(4, 12, 7, 2.0), (7, 15, 12, 2.7), (10, 15, 14, 2.8), (13, 14, 15, 3.0), (16, 15, 13, 2.8), (19, 17, 12, 2.7), (22, 16, 9, 2.2)]]
FEUER = HB.WindFeuer(H, W, ZUNGEN, RAMPE, n=N, seed=3, posen=12, amplitude=1.1, sperre=SPERRE)
ABRISSE = HB.abrisse(FEUER)
_gew = []
for ziel in range(2, N, 4):                                 # 12 Funken je Schleife, gleichmäßig über die Schleife verteilt (je Viertelzehntel der nächste hohe Abriss)
    frei = [e for e in ABRISSE if e not in _gew]
    _gew.append(min(frei, key=lambda e: (min((e[0] - ziel) % N, (ziel - e[0]) % N), e[2])))
ABRISSE = _gew


# ── Schwenk ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def schwenk(t):
    """Gitarre/Hand: Ausschlag in px (negativ = links), nahtlos über SWING Frames; bei t = 0 genau die Ruhepose."""
    return A_SW * math.sin(2 * math.pi * t / SWING)


def wind(t):
    """Fahrtwind: die Flamme hinkt der Bewegung nach (entgegen der Geschwindigkeit)."""
    return -1.6 * (schwenk(t + 0.5) - schwenk(t - 0.5))


Y_P = 28                                                   # Hand: hier hängt die Gitarre am Flügel; darüber kippt sie
B_T, T_LAG = 0.11, 0.7


def kippen(t):
    """Kippung der Gitarre in px je Zeile oberhalb der Hand (hinkt dem Schwenk nach, bei t = 0 genau 0)."""
    return B_T * (math.sin(2 * math.pi * t / SWING - T_LAG) + math.sin(T_LAG))


def schub_fn(a, b, fest=99):
    """Zeilenversatz der Gitarre/Flamme: Hand verschiebt um a, darüber kippt es um b px je Zeile (höchstens `fest` Zeilen)."""
    def f(y):
        sy = y - PAD_T
        return int(round(a + b * min(max(0, Y_P - sy), fest)))
    return f


def arm_dx(a, y_voll, y_null):
    """Zeilenversatz eines Flügelarms: Zeilen bis y_voll (Quellzeile) schwingen voll mit, bis y_null klingt es auf 0 ab (Schulter fest)."""
    def f(y):
        sy = y - PAD_T
        w = 1.0 if sy <= y_voll else max(0.0, (y_null - sy) / float(y_null - y_voll))
        return int(round(a * w))
    return f


def _strang(a, y0, y1, t, periode, phase0):
    """Strähne schwingt (äußeres Ende = links im Bild von `a`), unten bis 1,4 px; zu schmale Zeilen bleiben stehen."""
    innen, breite = {}, {}
    for y in range(y0, y1 + 1):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if len(xs_):
            innen[y] = int(xs_.max()) + 1
            breite[y] = int(xs_.max() - xs_.min() + 1)
    ys = sorted(innen)
    s = math.sin(2 * math.pi * t / periode + phase0) - math.sin(phase0)

    def dx(y):
        d = -1.4 * s * ((y - ys[0]) / max(1, ys[-1] - ys[0])) ** 1.2
        return 0 if breite[y] - int(round(d)) < 2 or breite[y] < 3 else d
    return B.zeilen_dehnen_aussen(a, ys[0], ys[-1], innen, dx)


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Funken


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    a = schwenk(i)
    dxg = int(round(a))
    schichten = []
    if 'figur' in ebenen:
        rest = REST
        if blinzeln(i):
            rest = rest.copy()
            for (x, y) in AUGEN:
                rest[PAD_T + y, PAD_L + x, :3] = LID
        fl_l = HB.zeilen_schub(FL_L, arm_dx(0.9 * (schwenk(i - 1.0) - schwenk(-1.0)), 26, 31))
        fl_r = HB.zeilen_schub(FL_R, arm_dx(a, 26, 31))
        str_l = _strang(STR_L, PAD_T + 38, PAD_T + 41, i, 16.0, 0.6)
        str_r = _strang(STR_R[:, ::-1].copy(), PAD_T + 38, PAD_T + 40, i, 16.0, 2.6)[:, ::-1].copy()
        feuer = FEUER.ebene(i, wind=wind(i))
        feuer = A.verbinde4(HB.zeilen_schub(feuer, schub_fn(a, kippen(i), 16)))[0]
        gitarre = A.verbinde4(HB.zeilen_schub(GITARRE, schub_fn(a, kippen(i))))[0]
        m_hals = L.farbmaske(gitarre, HALS_FARBEN)
        hals = np.where(m_hals[..., None], gitarre, 0).astype(np.uint8)                 # Hals getrennt: eigene Umrissfarbe beim Randpixel-Test
        gitarre = np.where(m_hals[..., None], 0, gitarre).astype(np.uint8)
        schichten += [(UNTER_L, 0, 0, 1), (UNTER_R, 0, 0, 2), (fl_l, 0, 0, 1), (fl_r, 0, 0, 2), (str_l, 0, 0, 3), (str_r, 0, 0, 4), (rest, 0, 0, 5),
                      (gitarre, 0, 0, 6), (hals, 0, 0, 8), (feuer, 0, 0, 7)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if partikel:
        fk = HB.funken_welt(FEUER, ABRISSE, i, lambda fr: (int(round(schwenk(fr) + kippen(fr) * 12)) + int(round(0.8 * wind(fr))), 0), leben=12, steigen=0.5, farben=[GELB, ORANGE, ORANGE, ROT])
        f = L.zusammen(H, W, [(fk, 0, 0), (f, 0, 0)])
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px, symmetrisch um die Ruhefigur."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    cx = PAD_L + (sw - 1) / 2.0
    half = int(math.ceil(max(cx - x0, x1 - cx)))
    x0, x1 = int(round(cx - half)), int(round(cx + half))
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()), '→ Ausschnitt x', x0, x1, 'y', y0, y1)
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('metal-harpyformer', 'Metal Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/metal-harpyformer-strip.png', frames, spalten=8, scale=5)
