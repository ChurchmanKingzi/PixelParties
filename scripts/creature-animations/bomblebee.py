# -*- coding: utf-8 -*-
"""Idle-Animation für „Bomblebee“ (Creature).

PICK: [["MotiveHawaii", 48, 2]]   — ABER mit eigener Extraktion (siehe unten), weil creature_show.py die halbtransparenten Flügel verliert.
Quelle: src/bomblebee.png — die schwarze Bombenhummel (64×33 px, 33 Farben) aus MotiveHawaii.xcf, Ebene 48 („Ebene #126“), Figur 2.
  Die Flügel haben in der Kunst Alpha 191 (durchscheinend); hier sind sie deckend übernommen (RGB unverändert, Alpha 191 → 255), ebenso wie
  der Rest der Hummel (zusammenhängende Komponente der Pixel mit Alpha ≥ 191, Bounding-Box x 108–171, y 85–117 der Ebene). Der
  Bodenschatten (Alpha 127) liegt außerhalb und wird nicht übernommen.

Aufruf:   python3 bomblebee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bomblebee.png + .json

Identifikation (Sprite-Koordinaten x, y; Figur spiegelsymmetrisch um x = 31,5 in der Form, Farben leicht verschieden):
* Flügel (die ehemals durchscheinenden Pixel, je Zeile ein Streifen): links x 0–21, rechts x 42–63, y 0–17; beige (213,197,146) mit braunen
  Adern (135,100,60), hellem Rand (235,231,232) und dunklem Oberrand (47,59,59); zur Wurzel (x 17–21 bzw. 42–46, y 8–13) grau-bräunlich.
* Körper: schwarzer, runder Hinterleib (x 15–48, y 1–25) mit grauem Glanzstreifen (59,59,59)/(72,72,72) rechts der Mitte; goldener Ring
  (x 26–37, y 7–17: orange (236,163,60), gold (224,195,67), hellgold (238,213,129)) vorn auf dem Körper — vermutlich Bombenmarke/Gesicht.
* Gelbe Funkelmarken (255,255,0)/(255,255,203): links (21–25, 6–9), oben (30–32, 2–4), rechts (38–40, 6–9).
* Sechs Beine: je drei links (x 14–24) und rechts (x 39–49), schwarz mit grauen Gelenkpixeln (72,72,72), Spitzen bis y 32.
* Nicht beweglich/unklar: der Ring selbst bleibt fest (nur Glanz), ebenso die Funkelmarken (nur Glanz/Stern).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: sechsmal pro Schleife (Periode 8 Frames); jede Flügelspalte wandert senkrecht (Spitze etwa −6 … +7 px), je weiter außen, desto mehr, die Spitze
  hinkt nach (F.fluegel_welle, Zusammenhang erzwungen). Die Wurzelspalten (links x ≥ 17, rechts x ≤ 46) stehen fest. Die Textur bleibt erhalten
  (ganze Spalten werden verschoben, keine Kopien).
* Schwebe-Bob zweistufig bis 2 px (Periode 12 Frames): Körper/Flügel zuerst, Hinterleib und Beine hinterher; der Unterschied wird an Zeile 19
  (reine Schwarzfläche) durch Verdoppeln/Entfernen einer Zeile ausgeglichen. Dazu driftet die ganze Hummel 1 px seitlich (Periode 24).
* Beine/Hinterleib pendeln (je tiefer, desto mehr, bis 2 px; Periode 24, nur Zeilen ab 19, Verbindung bleibt 4-verbunden).
* Die drei gelben Marken über dem Kopf sind das FEUER VON DREI LUNTEN (Nutzerhinweis): kein Glanz, sondern kleine Flammen. Über jeder Marke wachsen Zungen
  (0…3 px, Posen à 4 Frames, je Spalte eigene Zufallsfolge, nahtlos), die Farbe wandert mit: unten hellgold (238,213,129), Mitte gold (224,195,67), Spitze orange (236,163,60); der Kern (die Marke) blitzt bei langen Zungen hellgelb. Die Marke bleibt als Basis stehen (keine Löcher im Körper).
  Von den Flammen reißen kleine runde Funken ab und steigen langsam auf (12 Partikel, Formen k, s).
* Glanz nur am goldenen Ring (Metall): dezentes Lichtband (eine Stufe heller) alle 24 Frames. Chitin, Flügel und Beine glänzen nicht.

Ergänzungen: keine nötig — Flügel (die durchscheinenden Pixel) und Körper überlappen sich in der Ebene nirgends, die Flügelwurzel liegt am Körper an.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 17, 10

spr = L.lade('bomblebee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Flügelmaske: die in der Kunst durchscheinenden Pixel (je Zeile ein Streifen [lo, hi], rechts gespiegelt) ──────────
LO = [3, 2, 1, 0, 0, 0, 0, 1, 2, 3, 4, 6, 6, 6, 7, 8, 9, 10]
HI = [11, 13, 14, 15, 17, 18, 19, 21, 20, 20, 20, 19, 19, 18, 18, 17, 17, 14]
wing_l = np.zeros((sh, sw), bool)
for y_, (lo, hi) in enumerate(zip(LO, HI)):
    wing_l[y_, lo:hi + 1] = True
wing_r = wing_l[:, ::-1].copy()
wing_l &= vorhanden
wing_r &= vorhanden
koerper = vorhanden & ~wing_l & ~wing_r
assert int((wing_l | wing_r | koerper).sum()) == int(vorhanden.sum())

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
GELB, GELB_HELL = (255, 255, 0), (255, 255, 203)
ORANGE, GOLD, HELLGOLD = (236, 163, 60), (224, 195, 67), (238, 213, 129)
BEIGE = (213, 197, 146)

ring = L.farbmaske(spr, [ORANGE, GOLD, HELLGOLD]) & (yy >= 7) & (xx >= 26) & (xx <= 37)      # goldener Ring: Metall, glänzt dezent
RINGR = [ORANGE, GOLD, HELLGOLD, GELB_HELL]

# Die drei gelben Marken über dem Kopf sind das FEUER VON DREI LUNTEN: Spalten mit ihrer obersten Flammenzeile (x, y_oben).
LUNTEN = [[(21, 8), (22, 7), (23, 6), (24, 6), (25, 6)],     # links
          [(30, 3), (31, 2), (32, 3)],                       # oben
          [(38, 6), (39, 6), (40, 7)]]                       # rechts
ZEILE = PAD_T + 19


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


FUNKEN1 = {'c': GELB, 'r': ORANGE}
FUNKEN2 = {'c': GELB_HELL, 'r': HELLGOLD}
PUFFS1 = puffs([(22, 5, -1, -11, 0, 'k', 1), (31, 0, 0, -12, 4, 's', 1), (39, 4, 1, -11, 8, 'k', 1),
                (23, 4, -1, -12, 24, 's', 1), (32, 0, 0, -11, 28, 'k', 1), (40, 4, 1, -12, 32, 's', 1)])
PUFFS2 = puffs([(21, 6, -1, -10, 14, 'k', 1), (30, 1, 0, -12, 16, 'k', 1), (38, 5, 1, -10, 20, 'k', 1),
                (24, 4, 0, -11, 40, 'k', 1), (31, 0, 0, -10, 44, 'k', 1), (39, 4, 0, -11, 36, 'k', 1)])

# Flammen der Lunten: je Spalte eigene Pose-Tabelle (Zungenhöhe 0…3 px über der Marke, Posen à 4 Frames, nahtlos)
_rng = np.random.RandomState(5)
_K = N // 4
FLAMMEN = {}
for _c, _spalten in enumerate(LUNTEN):
    for _x, _y in _spalten:
        FLAMMEN[(_x, _y)] = ([int(_rng.randint(0, 4)) for _ in range(_K)], int(_rng.randint(0, _K)))


def lunten_feuer(kp, i):
    """Brennende Lunten (Regel 15): über der gelben Marke wachsen Flammenzungen, Farbe wandert mit: unten hellgold, Mitte gold, Spitze orange, Spitze dunkleres Orange;
    der Kern (die Marke selbst) flackert gelb ↔ hellgelb. Alles in Farben des Sprites; die Marke bleibt als Basis stehen (keine Löcher im Körper)."""
    for (x, y0), (tab, off) in FLAMMEN.items():
        e = tab[((i // 4) + off) % _K]
        farben = {0: [], 1: [ORANGE], 2: [HELLGOLD, ORANGE], 3: [HELLGOLD, GOLD, ORANGE]}[e]
        for k, c in enumerate(farben):
            kp[PAD_T + y0 - 1 - k, PAD_L + x, :3] = c
            kp[PAD_T + y0 - 1 - k, PAD_L + x, 3] = 255
        if e == 3:                                             # heiß: Kern blitzt hellgelb
            kp[PAD_T + y0, PAD_L + x, :3] = GELB_HELL


def frame(i, partikel=True):
    ph = L.sinus(i, N / 6)                                    # kräftiger Flügelschlag: sechsmal pro Schleife (Periode 8)
    pb = L.sinus(i, N / 4)                                    # Schwebe-Bob: Periode 12
    haupt = int(round(-1.3 * math.sin(pb)))                   # Körper/Flügel zuerst …
    lag = int(round(-1.3 * (math.sin(pb - 0.9) + math.sin(0.9))))   # … Hinterleib/Beine hinterher (Frame 0 = Ruhe)
    n_str = max(-1, min(2, lag - haupt))
    drift = int(round(math.sin(L.sinus(i, N / 2))))           # 1 px seitlich, Periode 24

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wl = F.ebene(spr, wing_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(spr, wing_r, H, W, PAD_L, PAD_T)

    # ── Glanz nur am goldenen Ring (Metall, dezent) und brennende Lunten ───────────────────────────────────────────────────
    F.lichtband(kp, ring, PAD_L, PAD_T, i, N // 2, 10, 9, RINGR, stufen=1, breite=3.0, achse=(1.0, 0.8))
    lunten_feuer(kp, i)

    # ── Bewegung: Beine/Hinterleib pendeln, Flügel surren ────────────────────────────────────────────────────────────
    kp = F.zeilen_pendel(kp, PAD_T + 18, 2.4, L.sinus(i, N / 2), 1.0)
    fl_amp, fl_pot, lauf = 6.7, 1.1, 0.1                       # Spitze etwa −6 … +7 px
    wl = F.fluegel_welle(wl, PAD_L + 17, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 46, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf, zusammenhang=True)

    # Bob zweistufig + seitliches Treiben (an allen Ebenen gleich)
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), drift, lag) for a in (kp, wl, wr))
    main_eff = lag - n_str

    pol = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(pol, 0, 0), (wl, 0, 0), (wr, 0, 0), (kp, 0, 0)])

    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('bomblebee', 'Bomblebee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bomblebee-strip.png', frames, spalten=8, scale=3)
