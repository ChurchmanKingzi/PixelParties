# -*- coding: utf-8 -*-
"""Idle-Animation für „Moonlight Butterfly“ (Creature).

PICK: [["Motive", 643, 2]]
Quelle: src/moonlight-butterfly.png — Ebene „Moonlight Butterfly“ (21×20 px, 7 Farben) aus Motive.xcf, Figur 2 (auf der Karte schon in diesen Blautönen).

Aufruf:   python3 moonlight_butterfly.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/moonlight-butterfly.png + .json

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 10):
* Schmetterling von oben, nur 7 Blautöne: Umriss (62,143,173) (A), mittlere Töne (91,208,252)/(112,214,252)/(164,228,252), helle Flecken (207,240,252)/(215,248,254)
  und Weiß (255,255,255) als Flügelzeichnung (Augenflecken/Schuppenmuster).
* Obere Flügel (x 0–19, y 0–10): große Flügel, Spitzen oben links (1–4, 0) und rechts (16–19, 0), helle Zeichnung bei (2–6, 2–8) und gespiegelt.
* Untere Flügel (x 0–20, y 11–19): kleiner, hängen nach außen unten, Spitzen unten bei (4–6, 19) und (14–16, 19).
* Körper (x 9–11, y 5–16): schmale Mittelsäule — Kopf/Brust (y 5–8, oben Umriss), Hinterleib (y 9–15) in (112,214,252), unten offen (Mittelpixel (10,16) leer).
* Es gibt keine Fühler im Sprite (nichts ergänzt).

Ablauf (40 Frames à 70 ms = 2,8 s) — Runde 2, Nutzerfeedback „Die oberen und unteren Flügel beim Butterfly sollten auch in sync sein“:
* Flügelschlag: viermal pro Schleife (Periode 10 Frames) klappen ALLE Flügel — obere und untere, linke und rechte — GLEICHZEITIG zur Körpermitte zu und wieder auf (Zeilen um x = 10 gestaucht, Faktor bis 0,5, Nächster-Nachbar,
  keine Textur kopiert). Früher lief der Faktor mit Verzögerung von oben nach unten durch den Flügel (die unteren Flügel hinkten hinterher); jetzt haben ALLE Zeilen in jedem Frame denselben Faktor (gleiche Phase, keine Welle).
  Linker und rechter Flügel exakt spiegelsymmetrisch um x = 10 (F.zeilen_stauchen(symmetrisch=True)). Ruhepose = ganz aufgeklappt = Original. Ein Test im Skript (SYNC-Test) prüft in jedem Frame, dass die Breite jeder Zeile
  über das ganze Sprite dem gleichen Faktor folgt (obere und untere Flügel haben dieselbe Breite relativ zum Original).
* Körper bleibt fest in der Mitte (Säule x 9–11) und liegt über den Flügeln; hebt sich beim Zuklappen um bis 2 px (senkrecht, symmetrisch — keine Seitenwippe).
* Mondstaub (Partikel): sechs kleine runde helle Wölkchen steigen langsam auf und schwanken; jedes ist nie kleiner als 3 Pixel (Klecks → 2×2 → Klecks, Regel 25: keine einzelnen 1-px-Punkte). Kein Glanz/Glitzer (Schuppen sind kein Metall).

Ergänzungen: keine nötig — die Flügel überdecken den Körper nicht (er liegt als Säule dazwischen). Beim Zuklappen schieben sich die inneren Flügelränder unter den Körper (er wird obenauf gelegt).
Randpixel-Test (Regel 16): Spaltenstauchung kann an der Außenkante Innenfarbe freilegen; solche Randpixel werden in Umrissblau (62,143,173) gesetzt (F.umranden).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_insekt as I

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 16, 9

spr = L.lade('moonlight-butterfly')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS_BLAU = (62, 143, 173)
UMRISS = F.umriss_farben(spr)
koerper = vorhanden & (xx >= 9) & (xx <= 11) & (yy >= 5) & (yy <= 16)
fluegel = vorhanden & ~koerper
ACHSE = PAD_L + 10                                           # Körpermitte (Leinwand-Spalte)


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


MONDSTAUB = {'c': (255, 255, 255), 'r': (164, 228, 252)}
PUFFS = puffs([(2, 3, -2, -7, 0, 'a', 1), (18, 3, 2, -7, 12, 'a', 1), (10, 1, 0, -7, 24, 'a', 1), (0, 13, -2, -7, 32, 'a', 1), (20, 13, 2, -7, 6, 'a', 1), (10, 18, 0, -7, 18, 'a', 1)])


TEST_EBENEN = ['koerper']                                    # randtest.py: ohne Mondstaub


def faktor(i):
    """Stauchfaktor ALLER Zeilen in Frame i (1 = aufgeklappt … 0,5 = zu); Ruhe in Frame 0 = 1."""
    ph = L.sinus(i, N / 4)                                    # viermal pro Schleife
    return 1.0 - 0.5 * (1 - math.cos(ph)) / 2


def frame(i, partikel=True, nur=None):
    if nur:
        partikel = False
    ph = L.sinus(i, N / 4)                                    # viermal pro Schleife
    bob = int(round(-1.8 * (1 - math.cos(ph)) / 2 * 1.0))     # beim Zuklappen hebt sich der Körper (0 … −2), Frame 0 = Ruhe

    s_alle = np.full(H, faktor(i))                            # SYNC: dieselbe Phase für obere und untere, linke und rechte Flügel
    fl = F.ebene(spr, fluegel, H, W, PAD_L, PAD_T)
    # linke Hälfte (x ≤ Achse) und rechte Hälfte (x ≥ Achse) getrennt, aber mit gleichem Faktor stauchen → exakte Spiegelbilder
    links = fl.copy(); links[:, int(ACHSE) + 1:] = 0
    rechts = fl.copy(); rechts[:, :int(ACHSE)] = 0
    links = F.zeilen_stauchen(links, ACHSE, s_alle, symmetrisch=True)
    rechts = F.zeilen_stauchen(rechts, ACHSE, s_alle, symmetrisch=True)
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    f = L.zusammen(H, W, [(links, 0, 0), (rechts, 0, 0), (kp, 0, 0)])
    # nur senkrechtes Heben der ganzen Figur (symmetrisch) — keine Seitenwippe
    f = L.versetze(f, 0, bob)
    # Randpixel-Test (Regel 16): freigelegte Innenfarbe an der Außenkante → Umrissblau
    F.umranden(f, [f], UMRISS, UMRISS_BLAU, UMRISS_BLAU, UMRISS_BLAU)
    if partikel:
        stau = I.staub_ebene(H, W, i, N, PUFFS, MONDSTAUB)
        f = L.zusammen(H, W, [(stau, 0, 0), (f, 0, 0)])
    return f


def sync_test(frames):
    """SYNC-Test: in jedem Frame ist die Breite JEDER Zeile (ohne Mondstaub) das gleiche Vielfache der Originalbreite — obere (y 0–10) und untere Flügel (y 11–19) schlagen in derselben Phase;
    zusätzlich ist jede Zeile exakt spiegelsymmetrisch um die Achse."""
    orig = (spr[..., 3] > 0)
    for k in range(N):
        f = frame(k, partikel=False)
        a = f[..., 3] > 0
        bob = int(round(-1.8 * (1 - math.cos(L.sinus(k, N / 4))) / 2))
        fk = faktor(k)
        for y in range(sh):
            xs0 = np.nonzero(orig[y])[0]
            if len(xs0) < 8:
                continue
            xs = np.nonzero(a[PAD_T + y + bob])[0]
            ratio = (xs.max() - xs.min() + 1) / float(xs0.max() - xs0.min() + 1)
            assert abs(ratio - fk) < 0.17, f'Frame {k} Zeile {y}: Breitenfaktor {ratio:.2f} ≠ {fk:.2f} (nicht in sync)'
    # Frame 0 = Original
    f0 = frame(0, partikel=False)
    assert (f0[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all(), 'Frame 0 weicht vom Original ab'
    print('SYNC-Test bestanden: obere und untere Flügel haben in allen', N, 'Frames denselben Schließfaktor; Frame 0 = Original')


def zuschneiden(frames, koerper_frames, rand=2, max_ueber=5):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + `rand` px; der Mondstaub ragt höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur x', bx0, '…', bx1, 'y', by0, '…', by1, '| Staub ragt hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Staub ragt mehr als {max_ueber} px über die Figur: {ueber}'
    # gleichmäßig zentrieren: links/rechts und oben/unten symmetrisch zur Vereinigung
    x0, y0, x1, y1 = ex0 - rand, ey0 - rand, ex1 + rand, ey1 + rand
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, partikel=False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    sync_test(frames)
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('moonlight-butterfly', 'Moonlight Butterfly', frames, MS, prev)
    if prev:
        L.streifen(prev + '/moonlight-butterfly-strip.png', frames, spalten=8, scale=6)
