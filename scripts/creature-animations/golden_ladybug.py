# -*- coding: utf-8 -*-
"""Idle-Animation für „Golden Ladybug“ (Creature) — Regeln 14/15/16 (Gold: Glanz erlaubt).

PICK: [["MotiveGN", 150, 1]]
Quelle: src/golden-ladybug.png — goldener Marienkäfer (16×15 px, 6 Farben) aus MotiveGN.xcf, Ebene 150 („Ebene #188“), Figur 1; vollständig deckend (Alpha nur 255), nichts ging bei der Extraktion verloren.
Die weißen Glitzersterne der Karte (4-zackig, 3–5 px) gehören zur Szene, nicht zum Sprite; die Sterne unten sind meine Nachbildung im selben Stil (Weiß (255,255,255) wie in der Kunst).

Aufruf:   python3 golden_ladybug.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/golden-ladybug.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Marienkäfer von oben, Kopf rechts):
* Rückenschild (x 2–10, y 0–14): zwei goldene Flügeldecken (oben y 1–5, unten y 9–13) mit orangen Punkten (249,141,19) und Goldtönen (247,231,14)/(249,203,25)/(255,249,78)/(255,254,130);
  die Mittelnaht (y 6–8) ist dunkelorange (203,115,15), dazu zwei kurze Linien links (x 0–4, y 5 und y 9): Spitzen der Hinterflügel.
* Kopf (x 11–13, y 5–9) mit zwei orangen Augen (12,6) und (12,8); Fühler (x 11–15, y 4 und y 10), je zwei Pixel mit Lücke.
* Umriss: dunkelorange (203,115,15).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag: achtmal pro Schleife (Periode 6) klappen die Flügeldecken auf: die obere Hälfte steigt, die untere sinkt je 0 → 1 → 2 → 1 → 0 px, die Mittelnaht wird dabei breiter
  (ERGÄNZT: die Naht-Zeilen y 6 und y 8 werden verdoppelt, so entsteht kein Loch; die Hinterflügel-Linien wandern mit ihren Hälften mit). Der Kopf bleibt in der Mitte stehen.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12); die Fühlerspitzen krümmen sich im Takt 1 px zum Kopf hin.
* Glanz (Gold, Regel 14): ein dezentes Lichtband läuft alle 24 Frames über die goldenen Flächen (eine Stufe heller, nicht über Umriss/Naht), dazu zwei kleine weiße vierzackige Glitzersterne
  wechseln sich auf den Flügeldecken ab. Der Umriss, die Naht und die Fühler glänzen nicht.
* Kein Goldstaub (einzelne 1-px-Punkte neben der Figur wirken wie Fehlpixel): die Effekte sind nur Lichtband und Glitzersterne auf dem Gold.

Rahmen: auf die Figur zugeschnitten (Vereinigung der Körper-Frames + 2 px Rand, zentriert); die Sterne liegen auf dem Rücken und ragen nicht über die Figur hinaus.
Randpixel-Test (Regel 16): Das Auseinanderrücken der Hälften lässt den Umriss an den Rändern (die Naht-Zeilen sind dunkelorange); F.umranden prüft zusätzlich jedes Frame; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (außer dem Weiß der Glitzersterne), Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('golden-ladybug')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

RAND = (203, 115, 15)                                        # dunkelorange: Umriss/Naht
PUNKT = (249, 141, 19)
GOLD = [(247, 231, 14), (249, 203, 25), (255, 249, 78), (255, 254, 130)]
RAMPE = [PUNKT, (249, 203, 25), (247, 231, 14), (255, 249, 78), (255, 254, 130)]       # dunkel → hell
WEISS = (255, 255, 255)

m_kopf = vorhanden & (((xx >= 12) & (yy >= 4) & (yy <= 10)) | ((xx == 11) & (yy >= 5) & (yy <= 9)))
m_koerper = vorhanden & ~m_kopf
gold_maske = L.farbmaske(spr, [PUNKT] + GOLD) & m_koerper
UMRISS = F.umriss_farben(spr)
Y_NAHT_O, Y_NAHT_U = PAD_T + 6, PAD_T + 8                    # obere/untere Naht-Zeile (werden verdoppelt)
FUEHLER_O = [(14, 4), (15, 4)]
FUEHLER_U = [(14, 10), (15, 10)]
STERNE = [(4, 3, 'o'), (7, 11, 'u')]                         # Mittelpunkte der Sterne (Sprite-Koordinaten) auf der oberen/unteren Flügeldecke


def streck_unten(a, zeile, n):
    """Zeile `zeile` n-mal zusätzlich einfügen: alles oberhalb bleibt, alles darunter rückt nach unten."""
    if n == 0:
        return a.copy()
    h = a.shape[0]
    if a[h - n:, :, 3].any():
        raise L.ClipError('streck_unten würde belegte Zeilen am unteren Rand abschneiden')
    rows = list(range(zeile + 1)) + [zeile] * n + list(range(zeile + 1, h - n))
    return a[rows].copy()


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    s = 1 if math.cos(ph) < 0.35 else 0                         # Flügeldecken öffnen: 0 (Ruhe) ↔ 1 px je Hälfte (Frame 0: cos = 1 → 0)

    kp = F.ebene(spr, m_koerper, H, W, PAD_L, PAD_T)
    kopf = F.ebene(spr, m_kopf, H, W, PAD_L, PAD_T)

    if effekte:                                                # Glanz nur auf den goldenen Flächen
        F.lichtband(kp, gold_maske, PAD_L, PAD_T, i, N // 2, 8, 9, RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.8))

    # Flügeldecken öffnen: unten (ab Zeile 9) rückt nach unten, oben (bis Zeile 5) nach oben; die Naht-Zeilen werden verdoppelt
    kp = streck_unten(kp, Y_NAHT_U, s)
    kp = L.streck_zeile(kp, Y_NAHT_O, s)

    # Hinterflügel strecken sich: bei geöffneten Decken werden die zwei Linien links um 2 px länger (Umrissfarbe, bleiben 4-verbunden)
    if s:
        for yline in (5 - s, 9 + s):
            for dx in (-1, -2):
                kp[PAD_T + yline, PAD_L + dx] = (*RAND, 255)

    # Fühler zucken zum Kopf hin (Frame 0 = Ruhe)
    d = 1 if math.sin(L.sinus(i, N / 4)) > 0.4 else 0           # Fühlerspitzen krümmen sich zum Kopf hin (bleiben so mit ihm verbunden)
    for (x, y) in FUEHLER_O:
        kopf = _fuehler(kopf, x, y, d)
    for (x, y) in FUEHLER_U:
        kopf = _fuehler(kopf, x, y, -d)

    kp, kopf = (L.versetze(a, 0, bob) for a in (kp, kopf))
    f = L.zusammen(H, W, [(kp, 0, 0), (kopf, 0, 0)])
    F.umranden(f, [kp, kopf], UMRISS, RAND, RAND, RAND)       # Randpixel-Test (Regel 16)
    if effekte:                                                # zwei weiße Glitzersterne wechseln sich ab (nur auf Gold)
        for k, (sx, sy, teil) in enumerate(STERNE):
            st = F.stern_stufe(i, N // 2, 3 + 12 * k)
            if st is not None:
                F.stern(f, PAD_L + sx, PAD_T + sy + bob + (-s if teil == 'o' else s), st, WEISS, WEISS)
    return f


def _fuehler(a, x, y, d):
    """Fühlerpixel (Sprite-Koordinaten) um d (−1/0/1) senkrecht verschieben."""
    if d == 0:
        return a
    c = a[PAD_T + y, PAD_L + x].copy()
    a[PAD_T + y, PAD_L + x] = 0
    a[PAD_T + y + d, PAD_L + x] = c
    return a


def zuschneiden(frames, koerper_frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung der Körper-Frames + `rand` px; die Effekte (Sterne) müssen mit ≥ 1 px Abstand hineinpassen."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= rand - 1, f'Effekte ragen zu weit über die Figur: {ueber}'
    x0, y0, x1, y1 = bx0 - rand, by0 - rand, bx1 + rand, by1 + rand
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, False, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=[WEISS], min_rand=1)      # Weiß: die Glitzersterne der Karte
    print('Pixel je Frame:', n)
    L.speichern('golden-ladybug', 'Golden Ladybug', frames, MS, prev)
    if prev:
        L.streifen(prev + '/golden-ladybug-strip.png', frames, spalten=8, scale=8)
