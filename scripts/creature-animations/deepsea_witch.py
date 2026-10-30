# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Witch“ (Creature).

Quelle: src/deepsea-witch.png — Ebene „Witch #1“ (19×31 px, 375 Pixel, 22 Farben, alle deckend) aus MotiveDeepsea.xcf (Ebene 309). Gegen die Kartenkunst abgeglichen (data/card-art/native/Deepsea_Witch.png):
gleiche Form, Position und Größe, Helligkeits-Korrelation 0,98. Die Ebene „Witch“ (347, 24×28, halbtransparent) ist eine andere Figur und passt nicht zur Karte. Die blaue Kugel rechts neben dem Hut
in der Kartenkunst gehört nicht zu dieser Ebene (eigene Dekoebene) und bleibt unberührt.
PICK: [["MotiveDeepsea", 309, 1]]

Aufruf:   python3 deepsea_witch.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-witch.png + .json

Was ist was (x/y im Sprite):
* Eine kleine Hexe in Teal-Karo-Haut (51,93,119)/(77,137,154) mit dunkelblauem Umriss (13,16,49): spitzer, oben nach links eingerollter Hut (graue Töne, schwarzer Umriss (0,0,0), Krone y 0–8, Krempe y 9–11 mit
  goldenem Hutband (255,180,24)/(255,222,90)/(255,246,172) bei x 6–13, y 9), darunter rosa/violettes Haar (131,8,115)/(172,49,156)/(213,82,197)/(246,139,238)/(255,205,255) (y 12–17, x 3–18),
  zwei weiße 2×2-Augen (246,255,255) bei (7–8, 13–14) und (11–12, 13–14), darunter ein schwarzer Mund (2×3 bei (9–10, 15–17)) mit weißen Zahnpixeln (8 und 11, y 16–17), Rumpf mit kleinem Arm (y 18–24)
  und zwei Beinen/Füßen (x 6–8 und 11–13, y 25–28).
* Links hält sie einen Besen: Stiel (109,51,13)/(137,65,17) bei x 2 (y 9–22, über Hand und Hut-Krempe), unten Borsten (240,204,66)/(254,227,50) bei x 0–4, y 23–30 (mit Bindering y 24).
Fest bleiben: Kopfform, Augen-/Mundform im Ruhebild, Gesichtshaut, Rumpf, Stielspalte.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Partikel ausgenommen):
* Atmen: alles oberhalb der Hüfte (Hut, Haar, Gesicht, Hand, Stiel) hebt sich 1 px (Zeile y 21 wird einmal wiederholt), Beine und Borsten bleiben am Boden; Periode 24, zweimal pro Schleife.
* Hutkrone schwingt: die Spitze neigt sich nach links/rechts, bis ±2 px an der Spitze, in Zeilengruppen (0–1, 2–4, 5–6, 7–8 — die Einrollung (Loch bei (8,3)) bleibt heil), die Krempe steht;
  benachbarte Gruppen unterscheiden sich um höchstens 1 px (runde Spitze); Periode 16, dreimal pro Schleife.
* Hutband (Gold): das Licht wandert langsam hin und her (der helle Streifen verschiebt sich um bis zu ±1 px); Periode 24. Nur auf dem Band, nicht auf Haar, Stoff oder Besen.
* Haar treibt: die äußeren Haarsträhnen links (x 3–6) und rechts (x 13–18) wogen spaltenweise ±1 px senkrecht als Welle (hinter der Krempe, der Stiel steht davor; die Gesichtsspalten x 7–12 stehen fest). Unter der Krempe ist das Haar
  ergänzt (verdeckt, Kopie der obersten Haarzeile), damit beim Senken keine Lücke entsteht.
* Besen: die Borsten (y ≥ 23) pendeln ±1 px (Periode 24), die unteren zwei Reihen (y 29–30) mit Verzögerung; der Stiel bleibt in der Hand.
* Beine/Füße heben abwechselnd 1 px (je 3 Frames, Periode 16: links Frame 3–5, rechts 11–13).
* Blinzeln (Lid = Gesichtshaut im Karomuster): erst die obere Augenzeile, dann beide Zeilen; zweimal (Frame 9–11 und 34–36).
* Mund: schließt sich von unten (Zeile y 17, dann y 16–17 werden Haut inkl. Zahnpixel — wie ein Lippenschluss), dreimal pro Schleife (Frame 20–23, 28–31, 44–47... je 4 Frames, siehe MUNDZU).
* Partikel (hinter der Figur): runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`), nie ein Einzelpixel, nie verdeckt; siehe PUFFS/ZAUBER.
Glanz nur auf dem Gold des Hutbands (Regel 14; Besenborsten sind Stroh, Haar/Stoff/Haut kein Metall), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts.
Keine gemalten Pixel außer Farben der Quelle (Lider/Mundzuklappung im Haut-Karo, verdecktes Haar aus vorhandenen Haarfarben).
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-witch')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
SCHWARZ = (0, 0, 0)
TL_, TD_ = (77, 137, 154), (51, 93, 119)                           # Haut-Karo hell / dunkel
WEISS = (246, 255, 255)
GOLD_U, GOLD_V, GOLD_S = (255, 180, 24), (255, 222, 90), (255, 246, 172)
HAARFARBEN = [(131, 8, 115), (172, 49, 156), (213, 82, 197), (246, 139, 238), (255, 205, 255)]
BRAUN = [(109, 51, 13), (137, 65, 17)]
STROH = [(240, 204, 66), (254, 227, 50)]
assert KONTUR in UMRISS
haut = lambda x, y: TL_ if (x + y) % 2 else TD_                    # Karo der Gesichts-/Körperhaut

AUGE_L = [(7, 13), (8, 13), (7, 14), (8, 14)]
AUGE_R = [(11, 13), (12, 13), (11, 14), (12, 14)]
MUND = [(9, 15), (10, 15), (9, 16), (10, 16), (9, 17), (10, 17)]
ZAEHNE = [(8, 16), (8, 17), (11, 16), (11, 17)]
assert all(col(x, y) == WEISS for (x, y) in AUGE_L + AUGE_R + ZAEHNE) and all(col(x, y) == SCHWARZ for (x, y) in MUND)
BAND = [(x, 9) for x in range(6, 14)]
assert [col(x, y) for (x, y) in BAND] == [GOLD_U, GOLD_V, GOLD_S, GOLD_S, GOLD_S, GOLD_S, GOLD_V, GOLD_U]

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {9: 1, 10: 2, 11: 1, 34: 1, 35: 2, 36: 1}                  # 1 = obere Zeile zu, 2 = beide Zeilen zu
MUNDZU = {}
for s0 in (18, 26, 42):
    for k, st in enumerate((1, 2, 2, 1)):
        MUNDZU[s0 + k] = st

# Teile (Masken im Sprite)
haarfarbe = np.zeros((sh, sw), bool)
for c in HAARFARBEN + [KONTUR]:
    haarfarbe |= (spr[..., 0] == c[0]) & (spr[..., 1] == c[1]) & (spr[..., 2] == c[2])
HAAR_L = vorhanden & haarfarbe & (xx >= 3) & (xx <= 6) & (yy >= 12) & (yy <= 17)
HAAR_R = vorhanden & haarfarbe & (xx >= 13) & (xx <= 18) & (yy >= 12) & (yy <= 17)
borst = np.zeros((sh, sw), bool)
for c in BRAUN + STROH:
    borst |= (spr[..., 0] == c[0]) & (spr[..., 1] == c[1]) & (spr[..., 2] == c[2])
BESEN_U = vorhanden & borst & (xx <= 4) & (yy >= 23)                # Borsten samt Bindering
BEIN_L = vorhanden & (xx >= 6) & (xx <= 8) & (yy >= 25)
BEIN_R = vorhanden & (xx >= 11) & (xx <= 13) & (yy >= 25)
rest = vorhanden & ~HAAR_L & ~HAAR_R & ~BESEN_U & ~BEIN_L & ~BEIN_R
assert not (BEIN_L & BEIN_R).any()


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def haar_ebene(maske, xs):
    """Haarspalten als Ebene auf der vollen Leinwand, samt verdecktem Haar unter der Krempe (y 11 = Kopie der obersten Haarzeile der Spalte, y 12 falls die Spalte erst tiefer beginnt bleibt leer)."""
    a = teil(maske)
    for x in xs:
        ys = [y for y in range(sh) if maske[y, x]]
        if ys and min(ys) == 12:
            a[GPT + 11, GPL + x] = a[GPT + 12, GPL + x]          # hinter der Krempe (y 11) — im Ruhebild von der Krempe verdeckt
    return a


HAAR_LA = haar_ebene(HAAR_L, range(3, 7))
HAAR_RA = haar_ebene(HAAR_R, range(13, 19))
REST_A, BESEN_A, BEIN_LA, BEIN_RA = teil(rest), teil(BESEN_U), teil(BEIN_L), teil(BEIN_R)
OBEN_GRUPPEN = [(0, 1), (2, 4), (5, 6), (7, 8)]                    # Hutkrone: Zeilengruppen (die Einrollung y 2–4 bleibt heil)


def spalten_senkrecht(a, xs, dys):
    """Jede Haarspalte x um dys[x] senkrecht versetzen (auf der vollen Leinwand)."""
    out = L.leer(*a.shape[:2])
    for x in xs:
        cx = GPL + x
        for y in np.nonzero(a[:, cx, 3])[0]:
            out[y + dys[x], cx] = a[y, cx]
    return out


def hut_neigen(a, aus):
    """Hutkrone (y 0–8) neigt sich: Versatz je Zeilengruppe wächst zur Spitze (0 an der Krempe), benachbarte Gruppen ≤ 1 px verschieden."""
    out = a.copy()
    out[GPT:GPT + 9] = 0
    dxs = [int(round(aus * (9 - (y0 + y1 + 1) / 2.0) / 9.0)) for (y0, y1) in OBEN_GRUPPEN]
    for k in range(1, len(dxs)):
        dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
    for (y0, y1), dx in zip(OBEN_GRUPPEN, dxs):
        for y in range(y0, y1 + 1):
            for x in np.nonzero(a[GPT + y, :, 3])[0]:
                out[GPT + y, x + dx] = a[GPT + y, x]
    return out


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


BLASE = {'c': TL_, 'r': TD_}
ZAUBER = {'c': (213, 82, 197), 'r': (131, 8, 115)}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = []
ZPUFFS = []


def frame_gross(i, nur=None):
    kb = REST_A.copy()
    # Augen: Blinzeln (Lid = Gesichtshaut im Karomuster)
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in AUGE_L + AUGE_R:
            if bl == 2 or y == 13:
                kb[GPT + y, GPL + x, :3] = haut(x, y)
    # Mund schließt sich von unten (Zähne mit)
    st = MUNDZU.get(i, 0)
    if st:
        for (x, y) in MUND + ZAEHNE:
            if y >= 17 - (st - 1):
                kb[GPT + y, GPL + x, :3] = haut(x, y)
    # Hutband: Lichtstreifen wandert (nur Gold)
    c = 9.5 + 1.0 * sinz(i, 24)
    for (x, y) in BAND:
        d = abs(x - c)
        kb[GPT + y, GPL + x, :3] = GOLD_S if d <= 1.5 else (GOLD_V if d <= 2.5 else GOLD_U)
    # Hutkrone schwingt
    kb = hut_neigen(kb, 2.2 * sinz(i, 16))
    # Haar treibt: Welle je Spalte (links / rechts getrennte Phase)
    dl = {x: int(round(0.9 * sinz(i, 24, 0.0 - 0.7 * (x - 3)))) - int(round(0.9 * sinz(0, 24, -0.7 * (x - 3)))) for x in range(3, 7)}
    dr = {x: int(round(0.9 * sinz(i, 16, 1.5 - 0.6 * (x - 13)))) - int(round(0.9 * sinz(0, 16, 1.5 - 0.6 * (x - 13)))) for x in range(13, 19)}
    hl = spalten_senkrecht(HAAR_LA, range(3, 7), dl)
    hr = spalten_senkrecht(HAAR_RA, range(13, 19), dr)
    oben = L.zusammen(H, W, [(hl, 0, 0), (hr, 0, 0), (kb, 0, 0)])
    # Atmen: alles oberhalb der Hüfte hebt sich 1 px (Zeile y 21 wird einmal wiederholt)
    if U.stufe(i, 24, 1) == 1:
        oben = L.streck_zeile(oben, GPT + 21, 1)
    # Beine heben abwechselnd, Besenborsten pendeln
    bl_ = 1 if (i % 16) in (3, 4, 5) else 0
    br_ = 1 if (i % 16) in (11, 12, 13) else 0
    bx1 = int(round(sinz(i, 24)))
    bx2 = int(round(1.4 * sinz(i, 24, -0.8) - 1.4 * sinz(0, 24, -0.8)))
    bx2 = max(bx1 - 1, min(bx1 + 1, bx2))
    besen = BESEN_A
    b_oben, b_unten = besen.copy(), besen.copy()
    b_oben[GPT + 29:] = 0
    b_unten[:GPT + 29] = 0
    koerper = L.zusammen(H, W, [(oben, 0, 0), (BEIN_LA, 0, -bl_), (BEIN_RA, 0, -br_), (b_oben, bx1, 0), (b_unten, bx2, 0)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    zauber = _glut(H, W, i, N, ZPUFFS, ZAUBER)
    blasen = _glut(H, W, i, N, PUFFS, BLASE)
    return L.zusammen(H, W, [(blasen, 0, 0), (zauber, 0, 0), (koerper, 0, 0)])


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
    L.speichern('deepsea-witch', 'Deepsea Witch', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-witch-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
