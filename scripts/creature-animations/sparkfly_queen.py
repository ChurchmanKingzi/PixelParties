# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparkfly Queen“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveRussia", 178, 2], ["MotiveRussia", 177, 1], ["MotiveRussia", 176, 1], ["MotiveRussia", 172, 1]]
Eigenes Sprite (Mehrebenen-Bau): Die Königin der Karte „Sparkfly Queen“ ist NICHT die Fliege aus Ebene 157 (die steht dort links als Nebenfigur, Abgleich 0,96), sondern die große Mittelfigur:
  src/sparkfly-queen-ruestung.png  Ebene 178, Figur 2 (Rüstung/Thron: Kuppel, Mittelplatte, zwei Seitenplatten; 35×25 px) an Kartenposition (22,13), Abgleich 0,69 (Dunst der Kunst darüber)
  src/sparkfly-queen-koerper.png   Ebene 177 (Körper: Kopf mit grünen Augen und Fühlern, Brust, gestreifter Hinterleib; 14×25 px) an (32,14), Abgleich der Unterhälfte 0,77
  src/sparkfly-queen-beine.png     Ebene 176 (Beine als schwarze Bögen; 22×19 px) an (28,18), Abgleich 0,88
  src/sparkfly-queen-krone.png     Ebene 172 (goldene Krone mit zwei roten Edelsteinen; 12×8 px) an (33,9) (Position nach den Edelsteinen der Karte: die „rosa Augen“ der Königin)
  src/sparkfly-queen.png           das fertige Sprite (34×30 px, 20 Farben, 4-verbunden) = alle Ebenen übereinander
Die weichen Teile der Kunst (Lichthof/Strahlen/Dunst: Ebenen 170, 171, 173, 174, 183 mit Alphaverlauf) sind nicht als Pixelart darstellbar und fehlen; die Köni­gin hat KEINE Flügel
(die olivgrünen Fliegen auf der Karte sind andere Figuren).

Aufruf:   python3 sparkfly_queen.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparkfly-queen.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Krone (x 11–22, y 0–7): Gold (150,116,28)/(184,142,34), Umriss (56,49,7), zwei rote Edelsteine (104,9,33)/(200,19,67) am unteren Rand.
* Körper (x 10–23, y 5–29): Kopf mit zwei grünen Augen ((72,83,0)/(140,159,0), Glanzpixel (189,200,108)/(166,181,59)) und Fühlern, dunkle Brust (42,27,14)/(17,11,5)/(22,14,6),
  gestreifter Hinterleib in Olivgrün (72,83,0)/(140,159,0) unten.
* Rüstung (x 0–34, y 4–29): Kuppel mit weißen Perlen (255,255,255) (y 5–14), Dachlinie y 15, darunter Mittelplatte (x 9–24) und zwei orangene Seitenplatten (links x 0–8, rechts x 25–34, y 16–28),
  Farben (185,69,29)/(232,138,54)/(97,39,33)/(65,39,33), Umriss (45,27,30).
* Beine: schwarze Bögen links und rechts der Brust (x 6–27, y 9–27).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12), die Krone folgt etwas später.
* Die beiden Seitenplatten (Arme/Schilde) schwingen gegenläufig: die Unterkante wandert −1 … +2 px (Periode 24; in einer Füllzeile werden Zeilen verdoppelt/entnommen, Oberkante, Umriss
  und Muster bleiben, F.heben_unten bzw. Zeileneinschub).
* Der Hinterleib pulsiert: er wird beim Einatmen 1 px länger (Periode 24, eine Streifenzeile wird verdoppelt).
* Blinzeln (Frames 33–34): die Augen werden zur Körperfarbe (42,27,14) (Lid = Körperfarbe).
* Glanz NUR an Metall/Gold/Edelsteinen: Krone — dezentes Lichtband über das Gold (eine Stufe heller, alle 24 Frames), die Edelsteine pulsieren (dunkelrot ↔ rot), zwei vierzackige weiße
  Glitzersterne wechseln sich an den Kronenspitzen ab. Rüstung, Körper, Fühler und Beine glänzen nicht.
* Funken: drei kleine runde goldene Punkte (k, s) steigen langsam von der Krone auf und schwinden.

Ergänzungen: keine nötig — die Ebenen sind vollständig (Körper unter Krone/Rüstung, Platten komplett).
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 1 px freier Rand), Sterne/Funken ragen höchstens 3 px über die Figur hinaus.
Randpixel-Test (Regel 16): Zeileneinschub und Hinterleib lassen die Umrissfarbe an den Rändern; F.umranden prüft zusätzlich jedes Frame; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('sparkfly-queen')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]


def spriteteil(name):
    return L.lade('sparkfly-queen-' + name)


S_RUESTUNG, S_KOERPER, S_BEINE, S_KRONE = (spriteteil(n) for n in ('ruestung', 'koerper', 'beine', 'krone'))
m_pl = (S_RUESTUNG[..., 3] > 0) & (xx <= 8) & (yy >= 16)               # linke Seitenplatte
m_pr = (S_RUESTUNG[..., 3] > 0) & (xx >= 25) & (yy >= 16)              # rechte Seitenplatte


def ebene(a, maske=None):
    t = a if maske is None else np.where(maske[..., None], a, 0).astype(np.uint8)
    return L.platz(t, H, W, PAD_L, PAD_T)


P_MITTE = ebene(S_RUESTUNG, (S_RUESTUNG[..., 3] > 0) & ~m_pl & ~m_pr)
P_PL, P_PR = ebene(S_RUESTUNG, m_pl), ebene(S_RUESTUNG, m_pr)
P_KOERPER, P_BEINE, P_KRONE = ebene(S_KOERPER), ebene(S_BEINE), ebene(S_KRONE)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_MITTE, P_PL, P_PR, P_KOERPER, P_BEINE, P_KRONE)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
KOERPER = (42, 27, 14)
GRUEN = [(72, 83, 0), (140, 159, 0), (189, 200, 108), (166, 181, 59)]
GOLD_D, GOLD_H = (150, 116, 28), (184, 142, 34)
GEM_D, GEM_H = (104, 9, 33), (200, 19, 67)
WEISS = (255, 255, 255)
AUGEN = [(int(x), int(y)) for y, x in zip(*np.nonzero(L.farbmaske(S_KOERPER, GRUEN)))]       # Augenpixel in Sprite-Koordinaten
AUGEN = [(x, y) for (x, y) in AUGEN if y <= 11]                          # nur Kopf (die Streifen des Hinterleibs sind auch grün)
UMRISS = F.umriss_farben(spr)
RUESTRAND = (45, 27, 30)
gold_maske = L.farbmaske(S_KRONE, [GOLD_D])
gem_pix = [(int(x), int(y)) for y, x in zip(*np.nonzero(L.farbmaske(S_KRONE, [GEM_D, GEM_H])))]
STERNE = [(12, 1), (21, 1)]                                              # Kronenspitzen (Sprite-Koordinaten)


def px(x, y):
    return PAD_L + x, PAD_T + y


FUNKEN = {'c': GOLD_H, 'r': GOLD_D}
PUFFS = [dict(x=px(14, 0)[0], y=px(14, 0)[1], vx=-1, vy=-4, off=0, form='k', wackeln=1),
         dict(x=px(19, 0)[0], y=px(19, 0)[1], vx=1, vy=-4, off=16, form='s', wackeln=1),
         dict(x=px(17, 0)[0], y=px(17, 0)[1], vx=0, vy=-4, off=32, form='k', wackeln=1)]


def streck_unten(a, zeile, n):
    """Füllzeile `zeile` n-mal zusätzlich einfügen (n < 0: |n| Zeilen bis einschließlich `zeile` entnehmen): alles oberhalb bleibt, alles darunter rückt (nach unten bzw. oben)."""
    if n == 0:
        return a.copy()
    if n < 0:
        return L.heben_unten(a, zeile, -n)
    h = a.shape[0]
    if a[h - n:, :, 3].any():
        raise L.ClipError('streck_unten würde belegte Zeilen am unteren Rand abschneiden')
    rows = list(range(zeile + 1)) + [zeile] * n + list(range(zeile + 1, h - n))
    return a[rows].copy()


def frame(i, partikel=True, effekte=True):
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    kron = -int(round(2 * u(i - 1.3))) + int(round(2 * u(-1.3)))   # Krone folgt später (Frame 0 = Ruhe)
    ph = L.sinus(i, N / 2)
    arm_l = int(round(1.5 * math.sin(ph))) - 0
    arm_r = int(round(1.5 * math.sin(ph + math.pi)))
    bauch = int(round(1.2 * (1 - math.cos(ph)) / 2))           # Hinterleib 0 … 1 px länger

    mitte, pl, pr = P_MITTE.copy(), P_PL.copy(), P_PR.copy()
    koerper, beine, krone = P_KOERPER.copy(), P_BEINE.copy(), P_KRONE.copy()

    if i in (33, 34):                                          # Blinzeln: Lid = Körperfarbe
        F.setze(koerper, PAD_L, PAD_T, {p: KOERPER for p in AUGEN})
    if effekte:
        F.lichtband(krone, gold_maske, PAD_L, PAD_T, i, N // 2, 6, 8, [GOLD_D, GOLD_H], stufen=1, breite=3.0, achse=(1.0, 0.8))
        for (x, y) in gem_pix:                                 # Edelsteine pulsieren
            c = GEM_H if F.puls(i, N, x, y, periode=4, versatz=0.9) else GEM_D
            krone[PAD_T + y, PAD_L + x, :3] = c

    # Seitenplatten: Unterkante wandert, Oberkante/Umriss bleiben (Füllzeile y 19 wird verdoppelt/entnommen)
    pl = streck_unten(pl, PAD_T + 19, arm_l)
    pr = streck_unten(pr, PAD_T + 19, arm_r)
    koerper = streck_unten(koerper, PAD_T + 26, bauch)         # Hinterleib atmet (Streifenzeile)

    mitte, pl, pr, koerper, beine = (L.versetze(a, 0, bob) for a in (mitte, pl, pr, koerper, beine))
    krone = L.versetze(krone, 0, bob + kron)
    f = L.zusammen(H, W, [(mitte, 0, 0), (pl, 0, 0), (pr, 0, 0), (koerper, 0, 0), (beine, 0, 0), (krone, 0, 0)])
    F.umranden(f, [pl, pr], UMRISS, RUESTRAND, RUESTRAND, RUESTRAND)             # Randpixel-Test (Regel 16)
    F.umranden(f, [beine, koerper], UMRISS, (0, 0, 0), (0, 0, 0), (0, 0, 0))     # freiliegende Beinspitzen/Körperränder: Schwarz
    if effekte:
        for k, (sx, sy) in enumerate(STERNE):                  # Glitzersterne nur an der Gold-Krone
            st = F.stern_stufe(i, N // 2, 4 + 12 * k)
            if st is not None:
                F.stern(f, PAD_L + sx, PAD_T + sy + bob + kron, st, WEISS, WEISS)
    if partikel:
        pol = L.puff_ebene(H, W, i, N, PUFFS, FUNKEN)
        f = L.zusammen(H, W, [(f, 0, 0), (pol, 0, 0)])
    return f


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 1 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 1, ey0 - 1, ex1 + 1, ey1 + 1
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, False, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=1)
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-queen', 'Sparkfly Queen', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-queen-strip.png', frames, spalten=8, scale=5)
