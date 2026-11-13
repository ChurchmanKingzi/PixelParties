# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Poltergeister“ (Creature).

Quelle: src/deepsea-poltergeister.png — Ebene „Poltergeister“ (61×42 px, 474 Pixel, 4 Farben) aus MotiveDeepsea.xcf (Ebene 331; in der Kartenkunst blau getönt, deshalb vom
Treffer-Suchlauf nur als „getönt“ geführt, direkt aus dem Dump genommen). Gegen die Kartenkunst (data/card-art/native/Deepsea_Poltergeister.png) abgeglichen: dieselben drei Geister in derselben Anordnung.
Die Ebene hat 70 % Ebenendeckkraft (Ebenen-Opacity 179) und 59 Pixel mit Alpha 204; für die Animation voll deckend gemacht (Regel 22: Alpha ≥ 100 → 255); eine zusätzliche halbtransparente Darstellung im
Spiel ist NICHT eingetragen (das hat der Nutzer nicht verlangt) — falls gewünscht: `extra={'deckkraft': 0.7}` in `L.speichern`.
PICK: [["MotiveDeepsea", 331, 1]]

Aufruf:   python3 deepsea_poltergeister.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-poltergeister.png + .json

Was ist was (x/y im Sprite):
* Drei Gespenster („Poltergeister“) in Teal-Schachbrett (51,93,119)/(77,137,154) mit hellem Rand rechts (159,222,211) und dunklem Umriss (30,48,81): Geist 1 oben (x 15–30, y 0–14, glockenförmig), Geist 2 rechts (x 47–60, y 8–24, gleiche Form),
  Geist 3 links unten (x 0–11, y 23–41, schmaler und länger). Jeder hat in seiner Maske drei durchsichtige AUSSPARUNGEN (keine Pixel): zwei senkrechte Augenschlitze und einen Mundschlitz darunter
  (Geist 1: Augen (20–21, 4–6) und (24–25, 4–6), Mund (22–23, 7–9); Geist 2: Augen (51–52, 12–15) und (55–56, 12–15), Mund (53–54, 16–19); Geist 3: Augen (3–4, 27–30) und (7–8, 27–30), Mund (5–6, 31–36)).
Fest bleiben: Form der Köpfe, Lage der Augen-/Mundschlitze im Ruhebild.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Blasen ausgenommen). Jeder Geist bewegt sich unabhängig von den anderen:
* Schweben (Geister fliegen): senkrecht ±2 px (Geist 1 Periode 24, Geist 2 Periode 16, Geist 3 Periode 12) plus ein langsames waagerechtes Treiben ±1 px (Periode 48, gegeneinander versetzt).
* Schleppe weht: die unteren Zeilen jedes Geistes (Geist 1 ab y 9, Geist 2 ab y 17, Geist 3 ab y 31) schwingen waagerecht (≤ 2 px, wächst nach unten, Nachlauf; Periode 24 bzw. 16).
* Strecken: jeder Geist reckt sich zweimal pro Schleife um 1 px nach oben (eine texturgemischte Zeile am Unterkörper wird eingefügt, `L.streck_zeile`; Geist 1 Zeile 11, Geist 2 Zeile 21, Geist 3 Zeile 38; unten bleibt alles stehen).
* Blinzeln: die zwei Augenschlitze eines Geistes schließen sich 3 Frames (Füllung im Schachbrett des Körpers (51,93,119)/(77,137,154)) — Geist 1 Frame 14–16, Geist 2 Frame 26–28 und 40–42, Geist 3 Frame 8–10 und 32–34.
* Mundschlitz klappt von unten zu und wieder auf (stufenweise gefüllt, jeder Geist zu anderer Zeit): Geist 1 Frame 20–27, Geist 2 Frame 4–11, Geist 3 Frame 36–43.
* Blasen (hinter den Geistern, Wölkchen 2×2 → 3×3 → 2×2 mit `U.wolke_ebene`): drei Teal-Blasen steigen in der Mitte zwischen den Geistern auf (Kern (77,137,154), Rand (51,93,119)).
Kein Glanz (Regel 14: Geister, kein Metall/Edelstein), kein Feuer. Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose.
Ergänzungen: Lid-/Mundfüllungen nur im Schachbrettmuster der Körperfarben (51,93,119)/(77,137,154), Umrisspixel (30,48,81) an bewegten Kanten.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Blasen höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import math

import cv2
import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-poltergeister')
S = T.Szene('deepsea-poltergeister', 'Deepsea Poltergeister', spr, N, MS, rand=(6, 6, 7, 6))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
KONTUR = (30, 48, 81)
# Löcher (Augen/Mund) je Geist
_n, _lab = cv2.connectedComponents((~vorhanden).astype(np.uint8), connectivity=4)
_rand = set(_lab[0, :]) | set(_lab[-1, :]) | set(_lab[:, 0]) | set(_lab[:, -1])
LOECHER = []
for k in range(1, _n):
    if k in _rand:
        continue
    ys, xs = np.nonzero(_lab == k)
    LOECHER.append(sorted(zip(xs.tolist(), ys.tolist())))
assert len(LOECHER) == 9
GEISTER = [dict(name='G1', maske=vorhanden & (xx <= 33) & (yy <= 16), per_bob=24, ph=0.0, dph=0.0, tail_y=9, tail_per=24, streck=11, st=(4, 28), blink=[14], mund=20),
           dict(name='G2', maske=vorhanden & (xx >= 45), per_bob=16, ph=1.6, dph=2.1, tail_y=17, tail_per=16, streck=21, st=(18, 36), blink=[26, 40], mund=4),
           dict(name='G3', maske=vorhanden & (xx <= 14) & (yy >= 22), per_bob=12, ph=3.1, dph=4.2, tail_y=31, tail_per=24, streck=38, st=(10, 34), blink=[8, 32], mund=36)]
assert sum(int(g['maske'].sum()) for g in GEISTER) == int(vorhanden.sum())
for g in GEISTER:
    ys_, xs_ = np.nonzero(g['maske'])
    mine = [l for l in LOECHER if all(xs_.min() <= x <= xs_.max() and ys_.min() <= y <= ys_.max() for x, y in l)]
    assert len(mine) == 3, (g['name'], len(mine))
    mine.sort(key=lambda l: sum(p[1] for p in l) / len(l))            # zwei Augen (höher), Mund (tiefer)
    g['augen'] = mine[:2]
    g['mundloch'] = sorted(mine[2], key=lambda p: (-p[1], p[0]))        # von unten nach oben
    g['layer'] = S.teil(g['maske'])


def haut(x, y):
    # Schachbrett der Körperfarben (aus dem Ruhebild: (51,93,119) bei (x + y) gerade, (77,137,154) bei ungerade — hier gegen das Sprite geprüft)
    return CH if (x + y) % 2 == 0 else CD


# Parität aus dem Sprite ablesen
_h = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and tuple(int(v) for v in spr[y, x, :3]) in ((51, 93, 119), (77, 137, 154))]
_p0 = sum(1 for (x, y) in _h if tuple(int(v) for v in spr[y, x, :3]) == (77, 137, 154) and (x + y) % 2 == 0)
_p1 = sum(1 for (x, y) in _h if tuple(int(v) for v in spr[y, x, :3]) == (77, 137, 154) and (x + y) % 2 == 1)
CH, CD = ((77, 137, 154), (51, 93, 119)) if _p0 >= _p1 else ((51, 93, 119), (77, 137, 154))


def ghost_frame(g, i):
    a = g['layer'].copy()
    # Blinzeln
    for s in g['blink']:
        if s <= i < s + 3:
            for l in g['augen']:
                for (x, y) in l:
                    a[GPT + y, GPL + x, :3] = haut(x, y)
                    a[GPT + y, GPL + x, 3] = 255
    # Mund klappt von unten zu / wieder auf
    k = i - g['mund']
    if 0 <= k < 8:
        stufe = [1, 2, 3, 3, 3, 3, 2, 1][k]
        for (x, y) in g['mundloch'][:stufe]:
            a[GPT + y, GPL + x, :3] = haut(x, y)
            a[GPT + y, GPL + x, 3] = 255
    # Schleppe weht
    a = T.wehen(a, GPT + g['tail_y'], 1.8, i, g['tail_per'], lag=1.2, potenz=1.1)
    # Strecken
    n = 1 if max(U.buckel(i, g['st'][0], 12, N), U.buckel(i, g['st'][1], 12, N)) >= 0.5 else 0
    if n:
        a = TX.streck_zeile(a, GPT + g['streck'], n)
    # Schweben
    dy = int(round(2.0 * math.sin(L.sinus(i, g['per_bob'], g['ph'])))) - int(round(2.0 * math.sin(g['ph'])))
    dx = int(round(1.0 * math.sin(L.sinus(i, 48, g['dph'])))) - int(round(1.0 * math.sin(g['dph'])))
    return L.versetze(a, dx, dy)


def frame_gross(i, nur=None):
    f = L.zusammen(H, W, [(ghost_frame(g, i), 0, 0) for g in GEISTER])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    blase = {'c': (77, 137, 154), 'r': (51, 93, 119)}
    p = U.wolke_ebene(H, W, i, 48, [dict(x=P(22, 40)[0], y=P(22, 40)[1], vx=1, vy=-13, off=0, wackeln=0.8),
                                     dict(x=P(30, 41)[0], y=P(30, 41)[1], vx=-1, vy=-13, off=16, wackeln=0.8),
                                     dict(x=P(38, 40)[0], y=P(38, 40)[1], vx=1, vy=-13, off=32, wackeln=0.8)], blase)
    return L.zusammen(H, W, [(p, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21], scale=8)
