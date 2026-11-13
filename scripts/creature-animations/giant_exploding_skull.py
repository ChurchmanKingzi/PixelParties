# -*- coding: utf-8 -*-
"""Idle-Animation für „Giant Exploding Skull“ (Creature).

PICK: [["MotiveArcanum", 56, 1]]   Ebene „Giant Exploding Skull“ (MotiveArcanum.xcf, Ebene 56, 64×53 px, 19 Farben, nur Alpha 0/255) → src/giant-exploding-skull.png
(ganze Ebene, ein einziges 8-verbundenes Teil). Nicht verwendet: das Gewölbe/der Eingangsraum der Karte (andere Ebenen).

Aufruf:   python3 giant_exploding_skull.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/giant-exploding-skull.png + .json

Was im Sprite ist (Koordinaten im Sprite 64×53, x/y ab 0):
* Riesenschädel (x 17–46, y 12–44): Knochen links Weiß/Hellgrau F=(246,255,255), C=(213,213,213), rechts Grau D=(123,123,123), B=(82,82,82); brauner Umriss E=(49,24,0) (Oberkante Zeile 12,
  Unterkante Zeile 44). Zwei zornige Augen mit schwarzem Rand und gelb-oliver Füllung (H, O, P, Q, R, S, I, N) links bei (22–28, 20–28) und rechts bei (38–44, 20–28);
  unten ein breiter, gelb glühender Mund mit schwarzem Rand bei (23–40, 33–40).
* Beine: dicke schwarze A=(0,0,0) Spinnenbeine (3–4 px stark): links bei (0–18, 17–44) mit drei senkrechten Füßen (x 0–3 bis Zeile 31, x 5–7 bis Zeile 37, x 12–14 bis Zeile 44),
  rechts spiegelbildlich (x 60–63, 56–58, 49–51), dazu zwei Standbeine unten bei (20–22, 45–52) und (41–43, 45–52).
* Zündschnur: schwarzer, 3–4 px dicker Bogen von der Schädeldecke (29–32, 4–11) über (19–31, 1–5) nach links unten; am Ende brennt eine große gelb-weiße Funkengarbe
  G=(255,255,0), L=(255,255,255) bei (8–21, 3–14) (Kern 4×5 px weiß).
* Drei dünne Zünddrähte (1 px) rechts oben: ein blauer K=(0,25,128) von (39–42, 0–1) bis zur Schnurbasis (33, 11); ein olivfarbener (J, I, N) von (46–49, 0–5) bis zum Schädel bei (41–43, 13–14);
  ein roter M=(128,0,0) von (45–46, 6) bis zum Schädelrand bei (44, 18).
* Es gibt keine Flammen im Sprite (Gelb/Weiß = Funken, Rot nur ein Draht); `anim_feuer.py` wird daher nicht verwendet (Modul unverändert): die Garbe flackert als Funkenposen wie bei den anderen Skulls.
Hinweis Verbund: Das Sprite ist 8-verbunden (dünne Drähte und Funkengarbe hängen über Pixelecken); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden Teil besteht
und dass es keine offenen Randpixel gibt.
Fest bleiben: Schädelform, Umriss, Augenform, Mundform, die starken Beinbögen.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos) — Konventionen der Basiskarte, langsamer wegen der Größe:
* Schwerer Hüpfer: der ganze Riese hebt sich 1 px (Frames 4–20, ein langsamer Zyklus), sonst steht er (Frame 0 = Original).
* Beine (Runde 6, ersetzt das frühere „Scharren“ der Fußspitzen): acht Spinnenbeine als eigene Ketten Hüfte → Knie → Fuß; sie tippeln in einer Tetrapod-Welle (je Bein 6 Frames: Oberschenkel schwenkt um die
  Hüfte hoch, Fuß hebt sich 2–3 px, Fußspitze schwenkt 1 px aus, setzt wieder auf; 2 Frames Versatz von Bein zu Bein, zwei Wellen je Schleife). Hüften bleiben am Schädel, Beine überall so dick wie gemalt
  (siehe BEINE/bein_pixel).
* Zünddrähte: die drei Drähte schwingen im Luftzug (Zeilenversatz wächst zum freien Ende bis ±2 px, Nachlauf, Perioden 24/16/48 — die Brückenpixel gegen Lücken (verbinde_luecken8) kommen in der Farbe des Drahts).
* Zündfunke: die Garbe am Schnurende flackert zwischen acht Posen (Pose 0 = Original, Posen 2–3 Frames; weißer Kern, unregelmäßige gelbe Strahlen von 2–6 px), dazu steigen zwölf
  1-px-Funken (Weiß → Gelb → Olivgelb) 3–5 px auf und kreiseln leicht (Partikel).
* Mundglühen: das Gelb im Mund flackert (vier Zustände, 2–3 Frames: eine bzw. zwei Stufen heller/dunkler auf der Gelb-Oliv-Rampe der Quelle); die Augen glühen nicht.
* Blinzeln: beide Augen (Frames 14–17 und 38–41, das linke einen Frame früher): zornig → halb zu → zu; die Lidfarbe ist die umgebende Knochenfarbe (je Pixel die häufigste Knochenstufe im
  3-px-Umkreis außerhalb der Augen), der schwarze Augenrand bleibt.
* KEIN Glanz (Regel 14): Knochen glänzen nicht, keine Glitzersterne.
Ergänzungen: Durch den Drahtversatz entstehen Lücken zwischen den 1-px-Drähten: `anim_amorph.verbinde_luecken8` setzt Pfadpixel (≤ 3 px) in der Drahtfarbe; die Funkengarbe wird je Pose neu
gezeichnet (nur auf freien Feldern, nie über Schnur oder Schädel), daher weicht Frame 0 nur bei Pose 0 nicht ab.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Garbe + Hüpfer), 2 px unten — Figur zentriert; Funken liegen in der 2-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_feuer3 as F3

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 12, 2

spr = L.lade('giant-exploding-skull')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF = (0, 0, 0), (82, 82, 82), (213, 213, 213), (123, 123, 123), (49, 24, 0), (246, 255, 255)
CG, CH, CI, CJ, CK, CL = (255, 255, 0), (250, 255, 127), (128, 128, 0), (128, 119, 0), (0, 25, 128), (255, 255, 255)
CM, CN, CO, CP, CQ, CR, CS = (128, 0, 0), (152, 139, 0), (189, 189, 61), (234, 234, 106), (222, 222, 94), (205, 205, 77), (168, 168, 40)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO, CP, CQ, CR, CS):
    assert _c in _farben, _c
RAND0 = A.randpixel(spr)
KNOCHEN = {CF, CC, CD, CB}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


def _farbmaske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2) & OPAK
    return m


# ── Teile ──
FUNKE = _farbmaske(CG, CL) & (xx <= 22) & (yy <= 15)                                 # Funkengarbe am Schnurende
DRAHT_B = _farbmaske(CK)
DRAHT_M = _farbmaske(CM)
DRAHT_O = _farbmaske(CJ, CI, CN) & (xx >= 33) & (yy <= 19)
GELB = _farbmaske(CH, CO, CP, CQ, CR, CS, CI, CN, CG) & (yy >= 20) & ~FUNKE
_n, _lab = cv2.connectedComponents(GELB.astype(np.uint8), connectivity=8)
_teile = sorted([np.argwhere(_lab == k) for k in range(1, _n)], key=lambda p: (-len(p) if False else p[:, 0].min() // 10, p[:, 1].min()))
AUGE_L = [(int(y), int(x)) for y, x in _teile[0]]
AUGE_R = [(int(y), int(x)) for y, x in _teile[1]]
MUND = [(int(y), int(x)) for y, x in _teile[2]]
assert len(_teile) == 3, [len(t) for t in _teile]
AUGEN = [AUGE_L, AUGE_R]
# ── Runde 6: ACHT SPINNENBEINE als eigene Ketten (Nutzer: „Anatomie einer Spinne mit den acht dicken schwarzen Beinen; die Beine sollen sich bewegen wie Spinnenbeine“) ──
# Je Seite vier Beine (links; rechts spiegelbildlich, x → 63 − x), jedes = Hüfte (am Schädel, fest) → Oberschenkelbogen → Knie → Unterschenkel (senkrecht) → Fuß:
#   Bein 1: Hüfte (15–16, 20–23), Bogen Zeilen 17–19 über x 3–15, Knie-Ecke (0–5, 17–22), Unterschenkel x 0–3 bis Fuß Zeile 31
#   Bein 2: Hüfte (13–16, 26–28), Bogen Zeilen 25–28 über x 6–14, Unterschenkel x 5–9 bis Fuß Zeile 37
#   Bein 3: Hüfte (18–22, 31–36), Bogen Zeilen 34–36 über x 13–21, Unterschenkel x 12–15 bis Fuß Zeile 44
#   Bein 4: Hüfte unter dem Schädel (20–25, 42–44, fest), Bein x 20–24 Zeilen 45–52 (zeigt nach vorn/unten)
# Schritt (Tippeln): der Oberschenkel schwenkt starr um die Hüfte nach oben (Spaltenversatz, Gefälle ≤ 1 px je Spalte, Hüftspalten bleiben am Schädel), Knie und Unterschenkel gehen als Ganzes mit (Fuß hebt sich
# 2–3 px vom Boden), am höchsten Punkt schwenkt die Fußspitze 1 px nach außen (Zeilenversatz der untersten Zeilen), dann setzt der Fuß wieder auf. Nichts wird gestreckt oder gestaucht: jede Spalte/Zeile
# behält ihre Pixel, das Bein bleibt überall so dick wie gemalt. Bein 4 (senkrecht, kein Bogen, zeigt zum Betrachter) winkelt stattdessen ab Zeile 47 schräg nach außen ab (Zeilenversatz 1–2 px, weiter 3 px dick) und hebt
# den Fuß 1–2 px (das nach vorn gehobene Bein erscheint entsprechend kürzer). Frame 0 = Original (alle acht Füße am Boden).
SCHWARZ = _farbmaske(CA)
_BEIN_L = {
    1: SCHWARZ & (((yy >= 17) & (yy <= 24) & (xx <= 16)) | ((yy >= 25) & (yy <= 31) & (xx <= 2))),
    2: SCHWARZ & (((yy >= 25) & (yy <= 28) & (xx >= 6) & (xx <= 16)) | ((yy >= 29) & (yy <= 37) & (xx >= 5) & (xx <= 9))),
    3: SCHWARZ & (((yy >= 31) & (yy <= 36) & (xx >= 13) & (xx <= 22)) | ((yy >= 37) & (yy <= 44) & (xx >= 12) & (xx <= 15))),
    4: SCHWARZ & (yy >= 45) & (xx >= 20) & (xx <= 24),
}
# je Bein: Hüftspalte x0 (ab dort Versatz 0), Spannweite des Schwenks in Spalten, größter Hub, Unterschenkel (x ≤ …, y ≥ …), Fußspitze (y ≥ …: schwenkt 1 px nach außen)
_BEIN_PAR = {1: dict(x0=15, spann=9, hub=3, us=(3, 22), spitze=27), 2: dict(x0=14, spann=5, hub=2, us=(9, 30), spitze=34), 3: dict(x0=17, spann=3, hub=2, us=(15, 38), spitze=41), 4: dict(hub=2)}
BEINE = {}
for _nr, _m in _BEIN_L.items():
    BEINE['l%d' % _nr] = (_m, _nr, False)
    BEINE['r%d' % _nr] = (_m[:, ::-1], _nr, True)
_alle = np.zeros((sh, sw), bool)
for _k, (_m, _nr, _sp) in BEINE.items():
    assert int(_m.sum()) > 20 and not (_alle & _m).any(), _k
    assert cv2.connectedComponents(_m.astype(np.uint8), connectivity=4)[0] == 2, ('Bein nicht 4-verbunden', _k)
    _alle |= _m
assert (_alle <= SCHWARZ).all() and int((SCHWARZ & (yy >= 45) & ~_alle).sum()) == 0
BEWEGT = FUNKE | DRAHT_B | DRAHT_M | DRAHT_O | _alle
BASIS = OPAK & ~BEWEGT

# Schrittfolge (Tetrapod-Welle: es heben nie zwei Nachbarbeine derselben Seite zugleich; je Bein 6 Frames, 2 Frames versetzt, zwei Wellen je Schleife, dazwischen kurze Ruhe)
SCHRITT_HUB = {3: [1, 2, 3, 3, 2, 1], 2: [1, 2, 2, 2, 2, 1]}
SCHRITT_AUS = [0, 0, 1, 1, 0, 0]
FOLGE_BEINE = [['l1', 'r2', 'l3', 'r4', 'r1', 'l2', 'r3', 'l4'], ['r1', 'l2', 'r3', 'l4', 'l1', 'r2', 'l3', 'r4']]
SCHRITT = {k: {} for k in BEINE}                                                      # Bein → {Frame: (Hub, Ausschwenken)}
for _w, _folge in enumerate(FOLGE_BEINE):
    for _j, _k in enumerate(_folge):
        _hub = SCHRITT_HUB[_BEIN_PAR[BEINE[_k][1]]['hub']]
        for _t in range(6):
            SCHRITT[_k][_w * 24 + 1 + 2 * _j + _t] = (_hub[_t], SCHRITT_AUS[_t])
assert all(max(v) < N and 0 not in v for v in SCHRITT.values())
BEIN4_KNICK = {0: None, 1: [0, 1, 1, 1, 1], 2: [1, 1, 2, 2]}                           # Ausweichen der 3-px-Zeilen ab Zeile 47 nach außen (Liste = verbleibende Zeilen; Fuß 1 bzw. 2 px höher)


def bein_pixel(nr, d, aus):
    """Pixel (x, y im Sprite, LINKE Seite) von Bein nr beim Hub d (Fuß d px über dem Boden) und Ausschwenken der Fußspitze um `aus` px."""
    ys, xs = np.nonzero(_BEIN_L[nr])
    pts = list(zip(xs.tolist(), ys.tolist()))
    if not d:
        return pts
    out = []
    if nr == 4:
        knick = BEIN4_KNICK[d]
        for (x, y) in pts:
            if y <= 46:
                out.append((x, y))
            elif y - 47 < len(knick):
                out.append((x - knick[y - 47], y))
        return out
    par = _BEIN_PAR[nr]
    for (x, y) in pts:
        s = int(round(d * min(1.0, max(0.0, (par['x0'] - x) / float(par['spann'])))))
        nx = x - (aus if (x <= par['us'][0] and y >= par['spitze']) else 0)
        out.append((nx, y - s))
    return out


def _bein(name, i):
    maske, nr, spiegel = BEINE[name]
    d, aus = SCHRITT[name].get(i, (0, 0))
    out = L.leer(H, W)
    for (x, y) in bein_pixel(nr, d, aus):
        X, Y = PAD_L + (sw - 1 - x if spiegel else x), PAD_T + y
        if not (0 <= X < W and 0 <= Y < H):
            raise L.ClipError(f'Bein {name}: Pixel ({X},{Y}) außerhalb der Leinwand')
        out[Y, X] = (0, 0, 0, 255)
    return out


# Drähte: (Maske, Pivot-Zeile (Ansatz), Amplitude, Periode, Phase)
DRAEHTE = {'blau': (DRAHT_B, 11, 2.2, 24, 0.0), 'oliv': (DRAHT_O, 14, 2.2, 16, 1.7), 'rot': (DRAHT_M, 18, 2.2, 48, 3.0)}

# ── Lidfarben ──
_augpix = {p for a in AUGEN for p in a}
LID = {}
for (y, x) in _augpix:
    cnt, dist = {}, {}
    for dy_ in range(-3, 4):
        for dx_ in range(-3, 4):
            q = (y + dy_, x + dx_)
            if q in _augpix or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not OPAK[q]:
                continue
            c = _col(*q)
            if c not in KNOCHEN:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Zeitachsen ──
HOP = [0] * N                                                                         # Nutzer-Feedback: der Riese schwebt/hüpft nicht, er steht
BLINZELN_L = {14: 1, 15: 2, 16: 2, 17: 1, 38: 1, 39: 2, 40: 2, 41: 1}
BLINZELN_R = {15: 1, 16: 2, 17: 2, 18: 1, 39: 1, 40: 2, 41: 2, 42: 1}
MUND_RAMPE = [CI, CS, CO, CR, CQ, CP, CH]                                             # dunkel → hell (Oliv → Pastellgelb)
MUND_ZUSTAND = ([0, 0, 0] + [1, 1, 2, 2, 2, -1, -1, 1, 1, 0, 2, 2, -1, -1, -1, 0, 0, 1, 1, 2, 2, 0, 0, 0, -1, -1, 1, 1, 2, 2, 0, 0, 1, 1, -1, -1, 0, 0] + [0] * N)[:N]
assert HOP[0] == 0 and MUND_ZUSTAND[0] == 0 and 0 not in BLINZELN_L

_rnd = random.Random(2468)
FUNKEN_POSE = [None] + [A.strahlenfunke(_rnd, (16, 8), CL, CG, kern_pixel=[(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2)],
                                         n_strahlen=(8, 10), laenge=(3, 6), box=(7, 1, 22, 15), dick=0.85) for _ in range(7)]
FOLGE_F = A.pose_folge(random.Random(21), 8, tempo=(2, 3))
ZUENDFUNKEN = [(2, -1), (6, 0), (10, 1), (14, -1), (18, 0), (22, 1), (26, -1), (30, 0), (34, 1), (38, -1), (42, 0), (46, 1)]       # Startframe, seitlicher Weg


def _draht(sp_ebene, name, i):
    maske, pivot, amp, P, phi = DRAEHTE[name]
    layer = L.platz(np.where(maske[..., None], sp_ebene, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    out = L.leer(H, W)
    piv = PAD_T + pivot
    maxd = max(abs(y - piv) for y in range(H) if layer[y, :, 3].any())
    for y in range(H):
        xs = np.nonzero(layer[y, :, 3])[0]
        if not len(xs):
            continue
        frac = abs(y - piv) / float(maxd)
        dx = int(round(amp * frac * (math.sin(2 * math.pi * i / P + phi - 0.8 * frac) - math.sin(phi - 0.8 * frac))))
        if xs.min() + dx < 0 or xs.max() + dx >= W:
            raise L.ClipError(f'Draht {name}: Zeile {y} würde um {dx} px aus der Leinwand')
        for x in xs:
            out[y, x + dx] = layer[y, x]
    return out


def sprite_mit_effekten(i):
    sp = spr.copy()
    if True:                                                                       # Runde 5: Funkengarbe → Flamme (siehe flamme_ebene)
        sp[FUNKE] = 0
        for (x, y), c in {}.items():
            if 0 <= x < sw and 0 <= y < sh and not (OPAK[y, x] and not FUNKE[y, x]):
                sp[y, x, :3] = c
                sp[y, x, 3] = 255
    z = MUND_ZUSTAND[i]
    if z:
        for (y, x) in MUND:
            c = _col(y, x)
            if c in MUND_RAMPE:
                k = MUND_RAMPE.index(c)
                sp[y, x, :3] = MUND_RAMPE[min(len(MUND_RAMPE) - 1, max(0, k + z))]
    for k, a in enumerate(AUGEN):
        b = (BLINZELN_L if k == 0 else BLINZELN_R).get(i, 0)
        if b:
            ys = sorted({y for y, x in a})
            zu = set(ys[:(len(ys) + 1) // 2]) if b == 1 else set(ys)
            for (y, x) in a:
                if y in zu:
                    sp[y, x, :3] = LID[(y, x)]
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    dyb = HOP[i]
    ebenen = [(L.platz(np.where(BASIS[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T), 0, dyb)]
    for name in BEINE:
        ebenen.append((_bein(name, i), 0, dyb))
    for name in DRAEHTE:
        ebenen.append((_draht(sp, name, i), 0, dyb))
    neu = FUNKE | (~OPAK & (sp[..., 3] > 0))                                      # Funkengarbe (Original und neu gesetzte Pixel)
    ebenen.append((L.platz(np.where(neu[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T), 0, dyb))
    fig = L.zusammen(H, W, ebenen)
    fig, pfad, offen = A.verbinde_luecken8(fig, 3)                                  # nur wenn ein Teil auch über eine Ecke nicht mehr hängt (das Original ist nur 8-verbunden)
    brueck = []
    return dict(fig=fig, brueck=brueck, pfad=pfad, offen=offen)


# Runde 5 (neues Feuer-System anim_feuer3): statt der zufälligen Funkengarbe brennt am Schnurende (19,7) eine Flamme mit Aufwärtsfluss (Sockel + zwei phasenversetzte Zungen, 16 Posen à 1 Frame);
# Farben der Quelle: Gelb (255,255,0) außen → Hellgelb (250,255,127) → weißer Kern. Fuß am Schnurende, die Flamme liegt HINTER der Schnur (lückenloser Anschluss).
FLAMME3 = F3.Feuer(H, W, [F3.Flamme(PAD_L + 16.5, PAD_T + 9.5, 6, 4.6, fuss=2.6, bauch=0.2, schlag=0.3, phase=0.3, puls=0.08, wiegen=0.1),
                          F3.Flamme(PAD_L + 15.0, PAD_T + 8.0, 12, 3.2, richtung=(-0.15, -1), phase=0.0),
                          F3.Flamme(PAD_L + 18.0, PAD_T + 8.0, 10, 3.0, richtung=(0.1, -1), phase=0.55)], [CG, CH, CL], posen=16, halten=1)


def flamme_ebene(i):
    return FLAMME3.ebene(i, dy=HOP[i])


def funken_ebene(i):
    e = L.leer(H, W)

    def pix(x, y, c):
        X, Y = PAD_L + x, PAD_T + y + HOP[i]
        if not (2 <= X < W - 2 and 2 <= Y < H - 2):
            return
        e[Y, X, :3] = c
        e[Y, X, 3] = 255

    for (f0, drift) in ZUENDFUNKEN:                                               # steigen 10 Frames von der Garbe auf
        a = (i - f0) % N
        if a >= 10:
            continue
        x = 14 + drift * (a // 3) + int(round(0.8 * math.sin(2 * math.pi * a / 7.0)))
        y = 3 - int(round(0.45 * a))
        pix(x, y, CL if a < 3 else (CG if a < 7 else CI))
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(flamme_ebene(i), 0, 0), (f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], 'Mund:', len(MUND), '| Lidfarben:', sorted(set(LID.values())), '| Funke:', int(FUNKE.sum()),
          '| Drähte (blau/oliv/rot):', int(DRAHT_B.sum()), int(DRAHT_O.sum()), int(DRAHT_M.sum()), '| Beine:', {k: int(v[0].sum()) for k, v in BEINE.items()})
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    k8 = [int(cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)[0] - 1) for f in figs]
    k4 = [A.komponenten4(f[..., 3] > 0) for f in figs]
    print('8-Komponenten je Frame (soll überall 1):', sorted(set(k8)), '| 4-Komponenten (Original', A.komponenten4(OPAK), '):', sorted(set(k4)))
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    schlecht = A.ausdruck_pruefen(figs, spr, 'giant-exploding-skull')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('giant-exploding-skull', 'Giant Exploding Skull', frames, MS, prev)
    if prev:
        L.streifen(prev + '/giant-exploding-skull-strip.png', frames[::2], spalten=8, scale=4)
