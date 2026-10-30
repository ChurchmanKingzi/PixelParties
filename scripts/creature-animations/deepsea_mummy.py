# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Mummy“ (Creature).

Quelle: src/deepsea-mummy.png — Ebene „Mummy“ (18×25 px, 300 Pixel, 5 Farben, alle deckend) aus MotiveDeepsea.xcf (Ebene 304; in der Kartenkunst dunkelblau getönt, deshalb vom Treffer-Suchlauf nicht
als Figur geführt; direkt aus dem Dump genommen und gegen die Kunst abgeglichen: gleiche Form, Position und Größe, Helligkeits-Korrelation 0,997).
PICK: [["MotiveDeepsea", 304, 1]]

Aufruf:   python3 deepsea_mummy.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-mummy.png + .json

Was ist was (x/y im Sprite):
* Eine aufrecht stehende Mumie, ganz in Teal-Binden (51,93,119)/(77,137,154) mit dunkelblauem Umriss (13,16,49) gewickelt: Kopf y 2–8 (flach gewickelt), an der Kopfoberseite ein Binden-Wulst/Haken
  (Zeile 0–1 bei x 10–14, dazu ein hängendes Ende bei (14–15, 2–3)), zwei weiße Augen (246,255,255): ein großes 2×2 bei (9–10, 6–7) in einer schwarzen Augenhöhle (0,0,0) und ein kleines 2×1 bei (5–6, 7),
  Schultern y 9–10, Rumpf x 5–13 (y 11–18), kurze Arme als Stummel: links x 0–4, rechts diagonal nach rechts unten (x 13–17, y 11–13), unten ein Binden-Rock (y 19–23) mit drei „Zehen“ (y 24) und einem
  nachschleppenden Binden-Ende rechts (x 14–17, y 21–23). Ein einzelnes schwarzes Pixel (11,23) im Rock gehört zum Bindenmuster.
* Die hellen B/C-Pixel sind die Binden (Streifen); Muster innerhalb jeder Zeile bleibt unverändert (nur ganze Zeilen/Teile schieben sich).
Fest bleiben: Kopfform, Augengröße, Augenhöhle, Rock/Füße (y ≥ 19), Streifenmuster.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Blasen ausgenommen):
* Steifes Pendeln: der Körper kippt langsam um die Füße (Periode 48, einmal pro Schleife; Zeilenversatz in Gruppen, wächst mit dem Abstand zu den Füßen, Kopf bis ±2 px, Zeilen 0–3 gleich — der Kopfscheitel
  bleibt rund, Augen (y 6–7), Arme (y 10–13) bilden je eine Gruppe und werden nicht verscheert; Rock y ≥ 19 steht).
* Aufrichten: der Kopf hebt sich 1 px (die Schulterzeile y 9 wird einmal wiederholt, Rock und Arme bleiben), zweimal pro Schleife je 8 Frames (Frame 10–17 und 33–40).
* Binden-Wulst flattert: Zeile 1 samt hängendem Ende pendelt ±1 px, die Spitze (Zeile 0) mit Verzögerung, nie mehr als 1 px gegen die Zeile darunter (Periode 12).
* Arme: der linke Arm hebt/senkt sich ±1 px (Periode 24), der rechte gegenläufig (Periode 16).
* Das nachschleppende Binden-Ende rechts unten wellt sich: die Spitze (x ≥ 16) hebt/senkt sich ±1 px (Periode 12, hängt dabei immer am Ende fest).
* Blinzeln (Lid = Binden-Farbe (13,16,49)): große Auge zuerst oben, dann ganz zu, kleines Auge zu; zweimal (Frame 19–21 und 42–44).
* Blick: beide Augen wandern 1 px in der Höhle (Frame 4–9 nach links, 25–31 nach rechts); der frei gewordene Platz wird zur Augenhöhle (0,0,0) bzw. zu Binde (13,16,49).
* Blasen (Partikel, hinter der Figur, 4 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern): runde Teal-Blasen, 2×2 → 3×3 → 2×2 (nie ein einzelner Punkt), Kern (77,137,154), Rand (51,93,119); `U.wolke_ebene`.
Kein Glanz (Regel 14: Binden/Stoff), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (13,16,49)) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer den Farben der Quelle.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Blasen vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen
Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-mummy')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
B_, C_, W_, S_ = (51, 93, 119), (77, 137, 154), (246, 255, 255), (0, 0, 0)
assert KONTUR in UMRISS and UMRISS == {KONTUR}

# Augen: großes 2×2 in schwarzer Höhle, kleines 2×1 links in der Binde
AUGE_R = [(9, 6), (10, 6), (9, 7), (10, 7)]
AUGE_L = [(5, 7), (6, 7)]
assert all(col(x, y) == W_ for (x, y) in AUGE_R + AUGE_L) and int((spr[..., :3] == W_).all(-1).sum()) == 6
HOEHLE = {(7, 6), (8, 6), (11, 6), (7, 7), (8, 7), (11, 7), (12, 7), (9, 8), (10, 8), (11, 8), (12, 8), (11, 9), (12, 9)}
assert all(col(x, y) == S_ for (x, y) in HOEHLE)

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {19: 1, 20: 2, 21: 1, 42: 1, 43: 2, 44: 1}               # 1 = große Auge oben zu, 2 = alles zu
BLICK = {i: -1 for i in range(4, 10)}
BLICK.update({i: 1 for i in range(25, 32)})
AUF = set(range(10, 18)) | set(range(33, 41))                     # Kopf 1 px höher

# Teile (Masken im Sprite)
P0 = vorhanden & (yy == 0)                                         # Spitze des Wulstes
P1 = vorhanden & (((yy == 1)) | ((yy >= 2) & (yy <= 3) & (xx >= 14)))   # Wulst Zeile 1 + hängendes Ende
AL = vorhanden & (xx <= 4) & (yy >= 11) & (yy <= 13)               # linker Armstummel
AR = vorhanden & (xx >= 13) & (yy >= 11) & (yy <= 13) & ~((xx == 13) & (yy == 13))     # rechter Arm (diagonal)
TT = vorhanden & (xx >= 16) & (yy >= 21) & (yy <= 23)              # Spitze des nachschleppenden Endes
rest = vorhanden & ~P0 & ~P1 & ~AL & ~AR & ~TT
assert not (P0 & P1).any() and not (AL & AR).any()

BLASE = {'c': C_, 'r': B_}
P = lambda x, y: (GPL + x, GPT + y)
# Die Figur füllt ihr Feld fast ganz (18 px breit, Arme/Wulst/Ende schlagen aus): Partikel dürfen sie nie berühren und nie teilweise verdecken (kein „Splitter“), und Effekte dürfen den Frame nur 2 px vergrößern.
# Freie Bahnen (aus der Vereinigung aller Körperposen, Abstand ≥ 2 px): links oben neben dem Kopf (Blase steigt auf) und rechts unten neben dem Binden-Ende (Staub sinkt).
BLASEN_N = 24                                                   # Lebensdauer 24 Frames, zweimal pro Schleife
PUFFS = [dict(x=P(-2, 5)[0], y=P(-2, 5)[1], vx=1, vy=-7, off=0, wackeln=0)]
STAUB_N = 24
STAUB = [dict(x=P(19, 18)[0], y=P(19, 18)[1], vx=0, vy=8, off=2), dict(x=P(19, 18)[0], y=P(19, 18)[1], vx=0, vy=8, off=14)]
STAUBFARBE = {'c': C_, 'r': B_}


def _staub(h, w, i, n, puffs, farben, rand=0.08):
    """Staubflöckchen: bleiben 2×2 (Kern + 3 Randpixel), sinken langsam; am Anfang/Ende ihrer Lebensdauer unsichtbar (nie ein Einzelpixel)."""
    out = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        if t < rand or t > 1 - rand:
            continue
        cx, cy = int(round(pf['x'] + pf.get('vx', 0) * t)), int(round(pf['y'] + pf.get('vy', 0) * t))
        for (dx, dy, k) in U.WOLKE_FORMEN['s']:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Staub bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            out[y, x, :3] = farben[k]
            out[y, x, 3] = 255
    return out


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


GRUPPEN = [(0, 3), (4, 5), (6, 7), (8, 9), (10, 13), (14, 16), (17, 18)]      # Zeilengruppen mit gleichem Versatz: Scheitel (0–3), Augen (6–7), Arme (10–13) werden nicht verscheert


def wiegen(a, aus):
    """Kippen um die Füße (Zeile y 19): der Versatz wächst mit dem Abstand der Zeilengruppe zu den Füßen; die Zeilen einer Gruppe verschieben sich gleich (Zeilen über dem Sprite laufen mit der obersten Gruppe).
    Rock/Füße (y ≥ 19) stehen."""
    out = L.leer(*a.shape[:2])
    dxg = [int(round(aus * (19 - (y0 + y1) / 2.0) / 19.0)) for (y0, y1) in GRUPPEN]
    for cy in range(0, GPT + 19):
        y = cy - GPT
        k = 0 if y < 0 else next(j for j, (y0, y1) in enumerate(GRUPPEN) if y0 <= y <= y1)
        for x in np.nonzero(a[cy, :, 3])[0]:
            out[cy, x + dxg[k]] = a[cy, x]
    out[GPT + 19:] = a[GPT + 19:]
    return out


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def frame_gross(i, nur=None):
    aus = 1.7 * sinz(i, 48)                                         # Pendeln (0 bei Frame 0)
    kb = teil(rest)
    # Augen: Blick, Blinzeln
    g = BLICK.get(i, 0)
    bl = BLINZ.get(i, 0)
    er = [(x + g, y) for (x, y) in AUGE_R]
    el = [(x + g, y) for (x, y) in AUGE_L]
    if g:
        for (x, y) in AUGE_R:
            kb[GPT + y, GPL + x, :3] = S_
        for (x, y) in AUGE_L:
            kb[GPT + y, GPL + x, :3] = KONTUR
        for (x, y) in er:
            kb[GPT + y, GPL + x, :3] = W_
            kb[GPT + y, GPL + x, 3] = 255
        for (x, y) in el:
            kb[GPT + y, GPL + x, :3] = W_
            kb[GPT + y, GPL + x, 3] = 255
    if bl:
        for (x, y) in er:
            if bl == 2 or y == 6:
                kb[GPT + y, GPL + x, :3] = KONTUR
        if bl == 2:
            for (x, y) in el:
                kb[GPT + y, GPL + x, :3] = KONTUR
    # Binden-Wulst: Zeile 1 + hängendes Ende pendeln, die Spitze (Zeile 0) mit Verzögerung (≤ 1 px gegen Zeile 1)
    dx1 = int(round(sinz(i, 12)))
    dx0 = int(round(1.4 * (sinz(i, 12, -0.9) - sinz(0, 12, -0.9))))
    dx0 = max(dx1 - 1, min(dx1 + 1, dx0))
    # Arme (rigide Stummel, Abstand zum Rumpf bleibt über die Überlappung erhalten)
    dyl = int(round(sinz(i, 24)))
    dyr = -int(round(sinz(i, 16)))
    tip = int(round(sinz(i, 12, 0.0)))
    oben = L.zusammen(H, W, [(kb, 0, 0), (teil(AL), 0, dyl), (teil(AR), 0, dyr), (teil(P1), dx1, 0), (teil(P0), dx0, 0)])
    oben = wiegen(oben, aus)
    if i in AUF:
        oben = L.streck_zeile(oben, GPT + 9, 1)
    koerper = L.zusammen(H, W, [(oben, 0, 0), (teil(TT), 0, tip)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    blasen = _glut(H, W, i, BLASEN_N, PUFFS, BLASE)
    staub = L.leer(H, W) if _OHNE_PARTIKEL[0] else _staub(H, W, i, STAUB_N, STAUB, STAUBFARBE)
    return L.zusammen(H, W, [(blasen, 0, 0), (staub, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Blasen dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('deepsea-mummy', 'Deepsea Mummy', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-mummy-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
