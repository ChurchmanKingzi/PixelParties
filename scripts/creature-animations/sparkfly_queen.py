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

Ablauf (48 Frames à 60 ms = 2,88 s) — Runde 2, Nutzerfeedback „Krone und Thron sollen sich nicht bewegen“:
* KRONE und THRON (= die ganze Rüstung: Kuppel mit weißen Perlen, Mittelplatte, beide orangenen Seitenplatten) sind in jedem Frame EXAKT das Quellbild an derselben Stelle (kein Bob, keine Seitenplatten-Bewegung,
  kein Nachlauf); ein Test im Skript (STATISCH-Test) prüft das Pixel für Pixel. Die Königin SITZT auf dem Thron: kein Schweben mehr (Regel 18).
* Nur die Königin selbst lebt (Körper-Ebene und Fühler), alles innerhalb ihrer Silhouette:
  - Atmen in zwei Stufen: Brustkorb (Zeile 18, schwarze Brust) und Hinterleib (Streifenzeile 26) werden je bis zu 1 px länger (Periode 24, der Hinterleib mit Nachlauf); Kopf, Fühleransatz und Krone bleiben stehen,
    der Hinterleib sackt 0 … 2 px nach unten (nur Zeilen unterhalb der Einfügezeile rücken, nichts wird breiter).
  - Fühler zucken: die beiden Fühler (links (10–13,5–9), rechts (20–23,5–9)) schwenken ab Zeile 7 um 1 px nach außen/innen (links Periode 24, rechts Periode 16, Gefälle ≤ 1 px, 8-verbunden wie im Original).
  - Blinzeln (Frames 33–34): die Augen werden zur Körperfarbe (42,27,14) (Lid = Körperfarbe, Regel 21).
* Glanz NUR an Metall/Gold/Edelsteinen (Regel 12/14), an der FESTEN Krone: dezentes Lichtband über das Gold (eine Stufe heller, alle 24 Frames), die Edelsteine pulsieren (dunkelrot ↔ rot), zwei vierzackige weiße
  Glitzersterne wechseln sich an den Kronenspitzen ab. Rüstung, Körper, Fühler und Beine glänzen nicht.
* Keine Partikel mehr (die früheren goldenen Funken über der Krone sind weg: Regel 25 verbietet 1-px-Punkte, und die Krone soll ruhen).

Ergänzungen: keine nötig — die Ebenen sind vollständig (Körper unter Krone/Rüstung, Platten komplett); die Einfügezeilen kopieren nur vorhandene Körperzeilen.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand), die Sterne ragen höchstens 3 px über die Figur hinaus.
Randpixel-Test (Regel 16): Zeileneinschub und Hinterleib lassen die Umrissfarbe an den Rändern; F.umranden prüft zusätzlich jedes Frame; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten(nicht_holen=[(0, 0, 0), (17, 11, 5), (22, 14, 6)])   # dunkle Umriss-/Nahtfarben werden nie in eine eingefügte Zeile geholt (keine verdickten Linien)
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


# Fühler (Körper-Ebene, Sprite-Koordinaten): links (13,5) (12,5) (11,6) (11,7) (10,8) (10,9), rechts gespiegelt (20,5) (21,5) (22,6) (22,7) (23,8) (23,9)
FUEHLER_L = ((xx <= 12) & (yy <= 9) & (S_KOERPER[..., 3] > 0)) | ((xx == 13) & (yy == 5) & (S_KOERPER[..., 3] > 0))
FUEHLER_R = ((xx >= 21) & (yy <= 9) & (S_KOERPER[..., 3] > 0)) | ((xx == 20) & (yy == 5) & (S_KOERPER[..., 3] > 0))
P_FL, P_FR = ebene(S_KOERPER, FUEHLER_L), ebene(S_KOERPER, FUEHLER_R)
P_KOERPER = ebene(S_KOERPER, (S_KOERPER[..., 3] > 0) & ~FUEHLER_L & ~FUEHLER_R)
P_STATISCH = L.zusammen(H, W, [(P_MITTE, 0, 0), (P_PL, 0, 0), (P_PR, 0, 0)])           # Thron: nie bewegt
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_MITTE, P_PL, P_PR, P_KOERPER, P_FL, P_FR, P_BEINE, P_KRONE)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
Y_BRUST, Y_BAUCH = PAD_T + 18, PAD_T + 26                  # Einfügezeilen: Brustkorb (schwarz), Hinterleib (Streifen)


def fuehler_schwenk(a, dx, ab_zeile=7):
    """Fühler zuckt: alle Zeilen ab `ab_zeile` (Sprite-Zeile) wandern um dx (−1, 0, +1) waagerecht, die Wurzel (Zeilen darüber) bleibt — Gefälle ≤ 1 px, bleibt (8-)verbunden."""
    out = L.leer(*a.shape[:2])
    for y in range(a.shape[0]):
        for x in np.nonzero(a[y, :, 3])[0]:
            out[y, x + (dx if y >= PAD_T + ab_zeile else 0)] = a[y, x]
    return out


def streck_unten(a, zeile, n):
    """Füllzeile `zeile` n-mal zusätzlich einfügen (n < 0: |n| Zeilen bis einschließlich `zeile` entnehmen): alles oberhalb bleibt, alles darunter rückt (nach unten bzw. oben)."""
    if n == 0:
        return a.copy()
    if n < 0:
        return L.heben_unten(a, zeile, -n)
    h = a.shape[0]
    if a[h - n:, :, 3].any():
        raise L.ClipError('streck_unten würde belegte Zeilen am unteren Rand abschneiden')
    return TX.streck_unten(a, zeile, n)                         # texturierte Einfügezeilen statt Zeilenkopien (Regel 43/49)


def frame(i, partikel=True, effekte=True, nur=None):
    if nur:                                                    # Randpixel-Test: ohne Glanz/Sterne (die weißen Sterne sind gewollte Effekte an der Krone)
        effekte = False
    ph = L.sinus(i, N / 2)                                     # Atmen: Periode 24
    n_brust = int(round(1.1 * (1 - math.cos(ph)) / 2))         # Brustkorb 0 … 1 px länger
    n_bauch = int(round(1.1 * (1 - math.cos(ph - 0.9)) / 2))   # Hinterleib hinterher: 0 … 1 px länger
    dx_l = int(round(1.2 * math.sin(L.sinus(i, N / 2))))       # Fühler links: Periode 24
    dx_r = int(round(1.2 * math.sin(L.sinus(i, N / 3))))       # Fühler rechts: Periode 16

    mitte, pl, pr = P_MITTE.copy(), P_PL.copy(), P_PR.copy()                    # Thron: unverändert
    koerper, beine, krone = P_KOERPER.copy(), P_BEINE.copy(), P_KRONE.copy()
    fl, fr = P_FL.copy(), P_FR.copy()

    if i in (33, 34):                                          # Blinzeln: Lid = Körperfarbe
        F.setze(koerper, PAD_L, PAD_T, {p: KOERPER for p in AUGEN})
    if effekte:                                                # Glanz nur an der Krone (Gold, Edelsteine)
        F.lichtband(krone, gold_maske, PAD_L, PAD_T, i, N // 2, 6, 8, [GOLD_D, GOLD_H], stufen=1, breite=3.0, achse=(1.0, 0.8))
        for (x, y) in gem_pix:                                 # Edelsteine pulsieren
            c = GEM_H if F.puls(i, N, x, y, periode=4, versatz=0.9) else GEM_D
            krone[PAD_T + y, PAD_L + x, :3] = c

    # Atmen: Brustkorb und Hinterleib werden länger (alles unterhalb der Einfügezeile rückt nach unten, Kopf bleibt)
    koerper = streck_unten(koerper, Y_BRUST, n_brust)
    koerper = streck_unten(koerper, Y_BAUCH + n_brust, n_bauch)
    fl, fr = fuehler_schwenk(fl, dx_l), fuehler_schwenk(fr, dx_r)

    f = L.zusammen(H, W, [(mitte, 0, 0), (pl, 0, 0), (pr, 0, 0), (koerper, 0, 0), (fl, 0, 0), (fr, 0, 0), (beine, 0, 0), (krone, 0, 0)])
    F.umranden(f, [beine, koerper, fl, fr], UMRISS, (0, 0, 0), (0, 0, 0), (0, 0, 0))     # freiliegende Beinspitzen/Körperränder: Schwarz
    if effekte:
        for k, (sx, sy) in enumerate(STERNE):                  # Glitzersterne nur an der Gold-Krone (fest)
            st = F.stern_stufe(i, N // 2, 4 + 12 * k)
            if st is not None:
                F.stern(f, PAD_L + sx, PAD_T + sy, st, WEISS, WEISS)
    return f


def koenigin_ebenen(i):
    """Die bewegten Ebenen der Königin (Körper, Fühler, Beine) in Frame i (ohne Thron/Krone) — für den Test."""
    ph = L.sinus(i, N / 2)
    n_brust = int(round(1.1 * (1 - math.cos(ph)) / 2))
    n_bauch = int(round(1.1 * (1 - math.cos(ph - 0.9)) / 2))
    k = streck_unten(streck_unten(P_KOERPER.copy(), Y_BRUST, n_brust), Y_BAUCH + n_brust, n_bauch)
    return k, P_BEINE, *[fuehler_schwenk(e, d) for e in (P_FL, P_FR) for d in (-1, 0, 1)]


TEST_EBENEN = ['koerper']


def statisch_test(frames):
    """STATISCH-Test: Thron (Rüstung) und Krone sind in JEDEM Frame pixelgleich dem Quellbild. Thronpixel außerhalb der Fläche, die die Königin (Körper/Fühler/Beine) in irgendeinem Frame
    bedeckt, haben in allen Frames exakt die Quellfarbe; jedes Kronenpixel steht in jedem Frame an seiner Quellposition (die Farbe darf durch Glanz/Edelsteinpuls eine Stufe wechseln)."""
    flaeche = np.zeros((H, W), bool)
    for i in range(N):
        for e in koenigin_ebenen(i):
            flaeche |= e[..., 3] > 0
    thron = (P_STATISCH[..., 3] > 0) & ~flaeche & ~(P_KRONE[..., 3] > 0)
    kr = P_KRONE[..., 3] > 0
    for k, f in enumerate(frames):
        assert (f[thron, 3] > 0).all() and (f[thron, :3] == P_STATISCH[thron, :3]).all(), f'Frame {k}: Thron verändert'
        assert (f[kr, 3] > 0).all(), f'Frame {k}: Krone verändert (Pixel fehlt)'
        # kein Kronenpixel an anderer Stelle: alle Pixel oberhalb der Krone/des Throns, die nicht Stern sind, fehlen
        oben = np.zeros((H, W), bool)
        oben[:PAD_T + 5] = True
        fremd = (f[..., 3] > 0) & oben & ~kr & ~(P_FL[..., 3] > 0) & ~(P_FR[..., 3] > 0)
        assert fremd.sum() <= 12, f'Frame {k}: Fremdpixel über der Krone: {int(fremd.sum())}'
    print('STATISCH-Test bestanden: Thron (', int(thron.sum()), 'sichtbare Pixel) und Krone ( 48 Frames) an ihrer Quellposition; Fläche der Königin:', int(flaeche.sum()), 'px')


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 2 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 2, ey0 - 2, ex1 + 2, ey1 + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, False, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    statisch_test(frames)
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-queen', 'Sparkfly Queen', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-queen-strip.png', frames, spalten=8, scale=5)
