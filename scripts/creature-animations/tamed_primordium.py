# -*- coding: utf-8 -*-
"""Idle-Animation für „Tamed Primordium“ (Creature).

Quelle: src/tamed-primordium.png — zwei Ebenen derselben Szene aus MotiveDeepsea.xcf an ihrer gemeinsamen Ebenenposition (63×31 px, 781 Pixel, alle Alpha 0/255):
  Ebene 314 „Tamed Primordium“ (35×29, der gehörnte Dämonen-Krieger mit der Waffe/Kette in der Hand) über Ebene 316 „Primordium-Kopie“ (42×14, das Primordium mit schwarzem Schwanzstrich und anderen Augenquadraten
  als bei „Deepsea Primordium“). Stapelreihenfolge wie in der xcf (Dämon oben). Gegen die Kartenkunst (data/card-art/native/Tamed_Primordium.png) abgeglichen: Dämon links, Primordium rechts am Boden, die Waffe/Kette
  liegt auf seinem Rücken. NICHT übernommen sind die roten Effektebenen derselben Szene (313 „Tamed Primordium #6“ roter Dunst Alpha 204, 315 „#3“ rote Adern bei 30 % Ebenendeckkraft, 318 „#7“ roter Verlauf):
  das sind Beleuchtungs-/Blutüberlagerungen der Kartenkunst, keine Figurenteile (sie wären nur als Alpha-Überblendung darstellbar).
PICK: [["MotiveDeepsea", 314, 1], ["MotiveDeepsea", 316, 1]]   (beide Ebenen komplett; Alpha ≥ 100 → deckend)

Aufruf:   python3 tamed_primordium.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tamed-primordium.png + .json

Was ist was (x/y im Sprite, 63×31):
* Dämon (x 0–25, y 0–28): zwei schwarz-rote Hörner (x 1–5 und 16–21, y 0–8), roter Helm/Kopf (x 4–16, y 5–16) mit pelzigem hellem Gesicht, schwarzen Augenhöhlen mit roten Pupillen (145,0,0) und hellgrauem Kiefer (175,163,153),
  Brust mit braunen Gurten (49,24,0)/(81,41,22)/(208,139,64), rechter Arm waagerecht nach rechts (x 15–25, y 15–21) mit grauem Handgriff (131,133,130)/(198,200,197), linker Arm hängend (x 0–5, y 14–26) mit grauem Handschuh
  (65,66,64)/(131,133,130)/(198,200,197) (y 21–25), grüne Hose (0,57,31)/(0,85,46)/(5,26,0) (y 21–26), braune Stiefel (57,16,0)/(98,49,8)/(132,66,24) (y 26–27) und graue Fußspitzen (y 27–28). Er hat 100 Farben.
* Waffe/Kette (x 21–34, y 16–23): dunkle Stahlfarben (17,18,26)/(37,40,57)/(70,79,110); sie geht von der Hand aus nach rechts auf den Rücken des Primordiums und endet in einzelnen Gliedern bis (34,23) — Metall.
* Primordium (x 21–62, y 17–30): flaches Wesen aus Buckeln in Teal-Schachbrett (51,93,119)/(77,137,154), Umriss (30,48,81)/(13,16,49), NEUN weiße Quadrate (255,255,255) = Augen/Mal (acht 2×2 und ein 1×2 am Schwanz bei (57,18–19)),
  am Schwanz ein dünner schwarzer Strich (0,0,0) (60, 20–25).
Fest bleiben: Hörner (starr, wie beim Horned Demon), Gesicht samt Augen (Pupillen unklar → nicht geraten), Beine, Stiefel, der schwarze Schwanzstrich.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Dämon atmet in zwei Schritten (Periode 24, Kopf 3 Frames Nachlauf): im Gürtel (y 22) werden zwei Zeilen eingefügt (`L.streck_zeile`, texturgemischt; Beine, Stiefel stehen), Brust, Arme, Kopf und Hörner steigen zusammen (bis 2 px); der Kopf bewegt sich nie
  seitlich, Hals/Kinn werden nicht verlängert (Einfügung liegt unter den Armen/Gurten).
* Waffe/Kette folgt der Hand (Regel 28): sie hebt sich mit dem Arm; ihre Glieder am Ende (x ≥ 31) pendeln zusätzlich ±1 px (Periode 12); ein Lichtband (eine Stufe heller auf der Rampe (17,18,26) → (37,40,57) → (70,79,110)) läuft
  von der Hand bis zum Ende (Frame 8–19, nur Metall, Regel 14).
* Primordium kriecht: drei Buckel (x ≤ 35, 36–49, ≥ 50) heben sich nacheinander (je 10 Frames, zweimal pro Schleife) — die zwei vorderen durch eine eingefügte, texturgemischte Zeile in einer augenfreien Zeile (Unterkante bleibt am Boden),
  der hintere starr um 1 px; die Schwanzspitze (x ≥ 55, y ≤ 22) neigt sich waagerecht (≤ 2 px, Periode 16).
* Die neun weißen Quadrate blinzeln nacheinander (Lid = Körperkaro (51,93,119)/(77,137,154), 3 Frames je Auge, von links nach rechts, Frame 2–47).
* Zwei Teal-Blasen steigen über dem Primordium auf (`U.wolke_ebene`, Kern (77,137,154), Rand (51,93,119)).
Kein Feuer (der Dämon trägt keine Flamme), Glanz nur auf der Waffe (Metall). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose.
Ergänzungen: 6 vom Dämon im Ruhebild verdeckte Primordium-Pixel (HIDDEN: (26–28,18), (26,19) Umriss (30,48,81); (33,22), (34,23) Körper (77,137,154)) aus Ebene 316, sonst nur Lider im Körperkaro und Umrisspixel.
Annahme: der Dämon gehört zur Karte (er hält das Primordium an der Leine und liegt in derselben Szene).
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Blasen höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import cv2
import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('tamed-primordium')
S = T.Szene('tamed-primordium', 'Tamed Primordium', spr, N, MS, rand=(6, 6, 7, 6), erlaubt=())
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
col = S.col
HELL, DUNKEL, WEISS = (77, 137, 154), (51, 93, 119), (255, 255, 255)
KONTUR = (13, 16, 49)
PCOLS = [(13, 16, 49), (30, 48, 81), (51, 93, 119), (77, 137, 154), (255, 255, 255)]
HIDDEN = {(26, 18): (30, 48, 81), (27, 18): (30, 48, 81), (28, 18): (30, 48, 81), (26, 19): (30, 48, 81), (33, 22): (77, 137, 154), (34, 23): (77, 137, 154)}

prim = L.farbmaske(spr, PCOLS) | (L.farbmaske(spr, [(0, 0, 0)]) & (xx >= 55))
demon_all = vorhanden & ~prim
WAFFE_C = [(17, 18, 26), (37, 40, 57), (70, 79, 110)]
waffe = demon_all & L.farbmaske(spr, WAFFE_C) & (xx >= 21) & (yy >= 16) & (yy <= 23)
demon = demon_all & ~waffe
# Primordium samt verdeckten Pixeln
prim_spr = np.where(prim[..., None], spr, 0).astype(np.uint8)
for (x, y), c in HIDDEN.items():
    assert demon_all[y, x] or waffe[y, x], (x, y)
    prim_spr[y, x, :3] = c
    prim_spr[y, x, 3] = 255
P_ALL = prim_spr[..., 3] > 0

# --- Dämon ---
DEMON_A = S.teil(demon)
WAFFE_A = S.teil(waffe)
# --- Primordium: Buckel ---
SCHWANZ = P_ALL & (xx >= 55) & (yy <= 22)
LI = P_ALL & ~SCHWANZ & (xx <= 35)
MI = P_ALL & ~SCHWANZ & (xx >= 36) & (xx <= 49)
RE = P_ALL & ~SCHWANZ & (xx >= 50)


def layer_prim(m):
    return L.platz(L.trenne(prim_spr, m)[0], H, W, GPL, GPT)


LI_A, MI_A, RE_A, SW_A = (layer_prim(m) for m in (LI, MI, RE, SCHWANZ))
# weiße Quadrate (Augen)
_w = (L.farbmaske(prim_spr, [WEISS])).astype(np.uint8)
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(_w, connectivity=8)
AUGEN = sorted([[(int(x), int(y)) for y, x in zip(*np.nonzero(_lab == k))] for k in range(1, _n)], key=lambda l: min(p[0] for p in l))
assert len(AUGEN) == 9, len(AUGEN)


def haut(x, y):
    return HELL if (x + y) % 2 == 0 else DUNKEL


_c = [(x, y) for y in range(sh) for x in range(sw) if P_ALL[y, x] and col(x, y) in (HELL, DUNKEL)]
if sum(1 for (x, y) in _c if col(x, y) == haut(x, y)) < len(_c) / 2:
    def haut(x, y):  # noqa: F811
        return DUNKEL if (x + y) % 2 == 0 else HELL


def einfuege_zeile(m, bevorzugt):
    """augenfreie Zeile des Buckels (Maske m) nahe der Höhe `bevorzugt`, die breit genug ist"""
    ys = [y for y in range(sh) if m[y].any()]
    weiss = {y for l in AUGEN for (x, y) in l if m[y, x]}
    cand = [y for y in ys if y not in weiss and y > min(ys) + 1 and y < max(ys) - 2 and m[y].sum() >= 0.6 * max(m[yy_].sum() for yy_ in ys)]
    return min(cand, key=lambda y: abs(y - bevorzugt))


Z_LI = einfuege_zeile(LI, 23)
Z_MI = einfuege_zeile(MI, 22)
WELLEN = {'li': (14, 38), 'mi': (2, 26), 're': (8, 32)}
RAMPE = {(17, 18, 26): (37, 40, 57), (37, 40, 57): (70, 79, 110)}
WAFFE_PTS = sorted([(x, y) for y in range(sh) for x in range(sw) if waffe[y, x]], key=lambda p: p[0] + 0.01 * p[1])


def hebt(i, starts):
    return 1 if any(0 <= i - s < 10 for s in starts) else 0


def frame_gross(i, nur=None):
    # Dämon: Atmen in zwei Schritten (Gürtel y 22; Kopf 3 Frames später) — beide Einfügungen in derselben Zeile
    n_brust = U.stufe(i, 24, 1)
    n_kopf = U.stufe(i, 24, 1, versatz=-L.sinus(3, 24))
    d = DEMON_A.copy()
    n = n_brust + n_kopf
    if n:
        d = TX.streck_zeile(d, GPT + 22, n)
    hub = n
    # Waffe folgt der Hand, Endglieder pendeln, Lichtband
    w = WAFFE_A.copy()
    k = i - 8
    if 0 <= k < 12:
        d0 = 21 + k * 1.2
        for (x, y) in WAFFE_PTS:
            if d0 <= x < d0 + 3:
                c = tuple(int(v) for v in w[GPT + y, GPL + x, :3])
                if c in RAMPE:
                    w[GPT + y, GPL + x, :3] = RAMPE[c]
    ende = w.copy()
    ende[:, :GPL + 31] = 0
    w[:, GPL + 31:] = 0
    dy_e = int(round(1.0 * T.sinz(i, 12)))
    w = L.zusammen(H, W, [(w, 0, -hub), (ende, 0, -hub + dy_e)])
    # Primordium
    layers = {'li': LI_A.copy(), 'mi': MI_A.copy(), 're': RE_A.copy(), 'sw': SW_A.copy()}
    for ki, pts in enumerate(AUGEN):
        s0 = 2 + ki * 5
        if 0 <= i - s0 < 3:
            for (x, y) in pts:
                for lz in layers.values():
                    if lz[GPT + y, GPL + x, 3]:
                        lz[GPT + y, GPL + x, :3] = haut(x, y)
    li, mi = layers['li'], layers['mi']
    if hebt(i, WELLEN['li']):
        li = TX.streck_zeile(li, GPT + Z_LI, 1)
    if hebt(i, WELLEN['mi']):
        mi = TX.streck_zeile(mi, GPT + Z_MI, 1)
    dre = -hebt(i, WELLEN['re'])
    s = T.sinz(i, 16)
    tail = T.gruppen_scher(layers['sw'], [(GPT + 17, GPT + 18), (GPT + 19, GPT + 20), (GPT + 21, GPT + 22)],
                           [int(round(2.0 * s)), int(round(1.0 * s)), 0])
    # Dämon liegt über dem Primordium (Stapel wie in der xcf) — Reihenfolge ist wegen der verdeckten Pixel wichtig
    f = L.zusammen(H, W, [(li, 0, 0), (mi, 0, 0), (layers['re'], 0, dre), (tail, 0, dre), (w, 0, 0), (d, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    blase = U.wolke_ebene(H, W, i, 48, [dict(x=P(44, 14)[0], y=P(44, 14)[1], vx=1, vy=-10, off=0, wackeln=0.8),
                                         dict(x=P(52, 14)[0], y=P(52, 14)[1], vx=-1, vy=-10, off=24, wackeln=0.8)],
                          {'c': HELL, 'r': DUNKEL})
    return L.zusammen(H, W, [(blase, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21], scale=8)
