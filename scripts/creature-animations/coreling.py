# -*- coding: utf-8 -*-
"""Idle-Animation für „Coreling“ (Creature) — Runde 3: Kopf wackelt nicht mehr seitlich, der Mund schließt und öffnet sich periodisch, die Blitze kommen erratisch und teils gleichzeitig.

PICK: [["MotiveGrailWar", 574, 1]]   (Ebene „Coreling“, Sprite 24×27 px, 14 Farben, nur Alpha 0/255, src/coreling.png)
Nicht im Sprite: die blauen Blitzbögen der Kartenkunst (MotiveGrailWar.xcf, Ebene 572 „Ebene #12“: 154×28 px, nur zwei Farben — Kern Weiß (255,253,254) und Schein Türkis (169,255,234)), die Flammen und der Wald/Boden der Karte
(getrennte Ebenen). Die Blitzfarben stammen aus genau dieser Ebene der Kartenkunst (Blitz-Ebenen 572/577, Kern und Schein); die Palette (data/palette.json) kennt beide Töne nicht exakt, aber dies sind die Quellfarben des Künstlers —
sie sind in L.pruefe(erlaubt=…) bewusst freigegeben (EINZIGE Farben außerhalb des Sprites).

Aufruf:   python3 coreling.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/coreling.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Kopf (Zeilen 0–11, x 6–19): grau gepanzerter Wolfs-/Katzenkopf mit zwei spitzen Ohren (links (7–9, 0–2), rechts (16–18, 0–2)), zwei roten Augen
  J=(213,0,0) zu je 2×2 px bei (10–11, 3–4) und (14–15, 3–4), schwarzblauem Nasen-/Mundschlitz H=(7,8,26) (12–13, 4–9) mit weißem Zahn N=(255,255,255)
  bei (14, 7–8); Hals Zeilen 10–12.
* Rumpf und Arme (Zeilen 13–17): ein waagerechter Panzerbalken von x 0 bis 23 mit dunklem Umriss A=(82,81,82), Arm links x 0–8, Arm rechts x 15–23,
  die Armenden mit je einem schwarzblauen QUADRATISCHEN LOCH H bei (3–4, 15–16) und (21–22, 15–16) (die „Löcher vorne in den Armen“); Brust x 9–16.
* Beine/Räder (Zeilen 18–26): zwei schwarze Räder (x 6–8 und x 17–19, Reifen K=(51,51,51)/I=(26,26,26)/G=(0,0,0), je Rad 9 Zeilen hoch) neben grauen Streben (x 9–11 bzw. 12–16) und je zwei helle Radspikes nach außen — links bei (3–6, 19) / (4–5, 20)
  und (2–5, 22) / (4–5, 23), rechts bei (19–22, 19) / (20, 20) und (20–23, 22) / (20–21, 23).
* Material: kaltes Grau in sechs Stufen (F, E, D, B, C und der Umriss A) mit Schwarz für die Räder — gepanzert, also Metall (Regel 14: leichter Stahlglanz erlaubt).
Fest bleiben: Arme (komplett starr, Nutzerwunsch), Augenform, Zahn, Schlitz, Radkörper und Umriss.

Nutzerwunsch (Runde 3): „nicht den Kopf so hin und her wackeln lassen. Er soll außerdem periodisch den Mund schließen und öffnen und die Blitze sollen erratischer und teilweise gleichzeitig kommen.“

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Kopf: bleibt jetzt fest an seinem Platz (kein seitliches Wiegen mehr, kein Zeilenversatz). Es bewegen sich nur noch die Augenlider (Blinzeln) und, wie bisher, die beiden Ohren einzeln (1 px nach außen, je 2 Frames).
* Mund (neu, 24-Frame-Takt, also zweimal je Schleife; Frame 0 = offen = Original): das Mundloch (die Schlitze H bei (12–13, 7–9), darüber die Nase (12–13, 4–5) mit der dunklen Nasenfurche (12–13, 6)) schließt von unten nach oben:
  Frames 8–9 der Unterkiefer rückt hoch (Zeile 9 wird zur dunklen Kinnlinie L), 10–15 geschlossen (auch Zeile 7 wird zur Oberlippe D, übrig bleibt ein 2 Pixel breiter dunkler Mundstrich in Zeile 8, der Zahn (14, 7–8) steht daneben), 16–17 öffnet er sich wieder,
  18–23 offen. Die Füllfarben sind Farben des Kopfes (L und D aus dem Sprite). Der Mund bleibt auch in den geschlossenen Frames dunkel genug, um zu lesen.
* Blitze (erratisch, teils gleichzeitig): aus den beiden Armlöchern schießen sieben Blitzsalven mit unterschiedlicher Dauer (3–8 Frames) und unregelmäßigen Pausen (Frames 0–1, 11–13, 24–27, 36–37, 45–47 sind blitzfrei); fünf von ihnen überschneiden sich
  (links und rechts feuern zeitweise GLEICHZEITIG). Jeder Blitz ist in jedem Frame ein neues, zufällig (fest gewürfelt, nahtlos) gezacktes Zickzack-Pixelgebilde von 6–13 Pixeln Länge (Knickpunkte wechseln Richtung und Höhe stark), manchmal mit einer kurzen
  Abzweigung; die Länge schwankt von Frame zu Frame (Anfang und Ende der Salve kurz), 1 px breit in Weiß (255,253,254) mit türkisem Schein (169,255,234) an den Knicken. Das Loch blitzt dabei Weiß/Türkis auf, der Blitz überdeckt die letzten Pixel der Armspitze. Frame 0 = Original (kein Blitz).
* Radspikes (unverändert): die Räder „drehen“ sich — die zwei Spikes je Rad wandern zyklisch von oben nach unten am Rad entlang (ein Schritt = 1 Zeile alle 2 Frames, 6 Schritte = 1 Umdrehung = 12 Frames, 4 Umdrehungen je Schleife); oben wachsen sie aus dem Rad heraus
  (nur der Ansatz), unten schrumpfen sie wieder (nur der Ansatz) und verschwinden; oben beginnt der nächste. Beide Spikes eines Rads sind um 3 Schritte versetzt, beide Räder laufen gleich schnell. Frame 0 = Original (die Spikes stehen bei den Originalzeilen 19 und 22).
  Die Spike-Pixel sind die des Originals (obere Form bei Zeilen ≤ 20, untere Form bei Zeilen ≥ 21); die Radkante (6,19) bzw. (19,19), die im Original zum oberen Spike gehört, wird ohne Spike mit dem Reifengrau K gefüllt.
* Blinzeln: beide Augen (Frames 16–18 und 40–42, das linke einen Frame früher): rot → halb zu → zu; die Lidfarbe ist die umgebende Körperfarbe
  (je Pixel die häufigste Graustufe in 2 px Umkreis außerhalb der Augen). Kein Farbwechsel der Augen sonst.
* Stahlglanz (Regel 14): zweimal pro Schleife (Frames 4–15 und 28–39) zieht ein schmales diagonales Lichtband über die grauen Panzerflächen (eine Stufe
  heller auf der Grau-Rampe F→E→D→B→C); Umrisse, Schwarz, Augen, Schlitz und Zahn bleiben.
Ergänzungen: Kopfversatz/Spikes können Füllpixel frei am Rand legen — sie bekommen den Umriss A (umriss_ergaenzen, Regel 16); schräge Teile, die nur über
eine Ecke hängen, bekommen Brückenpixel (verbinde4/verbinde_luecken, Regel 11). Beides wird je Frame gezählt (Konsole).
Frame: Sprite plus 15 px links/rechts (Blitze), 3 px oben/unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel; Farben der Quelle plus die zwei Blitzfarben.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 15, 15, 3, 3
GLANZ = True

spr = L.lade('coreling')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN = (82, 81, 82), (185, 186, 185), (206, 207, 206), (151, 149, 151), (128, 126, 128), (102, 101, 102), \
    (0, 0, 0), (7, 8, 26), (26, 26, 26), (213, 0, 0), (51, 51, 51), (51, 50, 51), (90, 89, 90), (255, 255, 255)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN):
    assert _c in _farben, _c
BLITZ_KERN, BLITZ_SCHEIN = (255, 253, 254), (169, 255, 234)                           # Farben der Blitz-Ebene der Kartenkunst (MotiveGrailWar.xcf, Ebene 572); die einzigen Farben außerhalb des Sprites
RAND_FARBEN = A.umrissfarben(spr)
RAND0 = A.randpixel(spr)
HELLER = {CF: CE, CE: CD, CD: CB, CB: CC, CM: CF}                                     # Grau-Rampe (eine Stufe heller)
KOERPERGRAU = {CB, CC, CD, CE, CF, CM}                                                # Lid-/Glanzfarben (graue Flächen)


def _c(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile (Masken im Sprite) ──
HEAD = OPAK & (yy <= 11)
# Radspikes (Original): links obere Form (Zeilen 19–20; (6,19) ist der Ansatz am Reifen), untere Form (Zeilen 22–23); rechts gespiegelt (x' = 25 − x), die obere Form hat dort in Zeile 20 nur ein Pixel
SP_L_UP = OPAK & (((yy == 19) & (xx <= 6)) | ((yy == 20) & (xx <= 5)))
SP_L_LO = OPAK & (yy >= 22) & (yy <= 23) & (xx <= 5)
SP_R_UP = OPAK & (((yy == 19) & (xx >= 19)) | ((yy == 20) & (xx >= 20)))
SP_R_LO = OPAK & (yy >= 22) & (yy <= 23) & (xx >= 20)
SP_ALL = SP_L_UP | SP_L_LO | SP_R_UP | SP_R_LO
BODY = OPAK & ~(HEAD | SP_ALL)                                                        # Rumpf, ARME (starr!) und Radkörper
assert int((HEAD | SP_ALL | BODY).sum()) == int(OPAK.sum())


def _templ(maske, y_top):
    return [(int(x), int(y) - y_top, _c(int(y), int(x))) for y, x in zip(*np.nonzero(maske))]


TEMPL = {('L', 'up'): _templ(SP_L_UP, 19), ('L', 'lo'): _templ(SP_L_LO, 22), ('R', 'up'): _templ(SP_R_UP, 19), ('R', 'lo'): _templ(SP_R_LO, 22)}
RADKANTE = {'L': (6, 19), 'R': (19, 19)}                                               # im Original Teil des oberen Spikes; ohne Spike mit Reifengrau K gefüllt

# ── Augen (rot 2×2) ──
_red = OPAK & (spr[..., 0] == CJ[0]) & (spr[..., 1] == CJ[1]) & (spr[..., 2] == CJ[2])
_n, _lab = cv2.connectedComponents(_red.astype(np.uint8), connectivity=8)
AUGEN = sorted([[(int(y), int(x)) for y, x in np.argwhere(_lab == k)] for k in range(1, _n)], key=lambda p: min(x for y, x in p))   # links, rechts
assert [len(a) for a in AUGEN] == [4, 4], [len(a) for a in AUGEN]
_augpix = {p for a in AUGEN for p in a}
LID = {}
for (y, x) in _augpix:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in _augpix or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not OPAK[q]:
                continue
            c = _c(*q)
            if c not in KOERPERGRAU:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Löcher in den Armen (2×2, Farbe H) ──
LOCH = {'L': [(15, 3), (15, 4), (16, 3), (16, 4)], 'R': [(15, 21), (15, 22), (16, 21), (16, 22)]}                 # (y, x)
for _s in LOCH.values():
    for (y, x) in _s:
        assert _c(y, x) == CH, (y, x)

# ── Zeitachsen ──
EAR_L = {10: 1, 11: 1, 34: 1, 35: 1}                                              # linkes Ohr 1 px nach links
EAR_R = {20: 1, 21: 1, 44: 1, 45: 1}                                              # rechtes Ohr 1 px nach rechts
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
SWEEPS = [4, 28]
# Mund (Runde 3): Zustand je Frame (0 offen = Original, 1 Unterkiefer hoch, 2 geschlossen); 24-Frame-Takt
MUND_ZUSTAND = [0] * 8 + [1, 1] + [2] * 6 + [1, 1] + [0] * 6
MUND = [MUND_ZUSTAND[i % 24] for i in range(48)]
MUND_ZEILE9 = [(9, 12), (9, 13)]                                                      # (y, x) Kinn: wird mit L gefüllt (Zustand ≥ 1)
MUND_ZEILE7 = [(7, 12), (7, 13)]                                                      # Oberlippe: wird mit D gefüllt (Zustand 2)
for _p in MUND_ZEILE9 + MUND_ZEILE7:
    assert _c(*_p) == CH, _p

# ── Blitze (Runde 3: erratisch, teils gleichzeitig) ──
# Salven (Seite, erster Frame, Dauer in Frames); links/rechts überschneiden sich teilweise. Frame 0 und die Frames 45–47 sind blitzfrei (nahtlos).
BLITZ_SALVEN = [('L', 2, 8), ('R', 5, 6), ('R', 14, 8), ('L', 19, 5), ('L', 28, 8), ('R', 31, 3), ('R', 38, 7), ('L', 40, 3)]
BLITZ_ZEILE = {'L': 15, 'R': 16}                                                     # Lochzeile, in der der Blitz beginnt
BLITZ_X0 = {'L': 3, 'R': 22}                                                         # äußere Lochspalte (L: nach links, R: nach rechts)


def _linie(a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    return [(int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n))) for k in range(n + 1)] if n else [a]


def _pfad(vs):
    pts = []
    for a, b in zip(vs, vs[1:]):
        for p in _linie(a, b):
            if p not in pts:
                pts.append(p)
    return pts


def _wuerfle_blitz(seite, i):
    """Zufälliger (aber fest gewürfelter, also reproduzierbarer) Zickzack-Blitz für Frame i: (Pfad, Ecken, Abzweigung); u = Abstand nach außen (0…13), v = senkrechter Versatz (−6…6)."""
    import random
    rnd = random.Random((1 if seite == 'L' else 2) * 1000 + i * 7 + 3)
    umax = rnd.choice([9, 10, 11, 12, 13])
    ecken, u, v = [(0, 0)], 0, 0
    while u < umax:
        u = min(u + rnd.choice([1, 2, 2, 3]), umax)
        schritt = rnd.choice([-4, -3, -3, -2, 2, 3, 3, 4])
        if v * schritt > 0 and abs(v + schritt) > 5:                                    # nicht aus der Zone laufen: Richtung wechseln
            schritt = -schritt
        v = max(-5, min(5, v + schritt))
        ecken.append((u, v))
    pfad = _pfad(ecken)
    ast = []
    if rnd.random() < 0.55 and len(ecken) > 3:                                           # kurze Abzweigung ab einer mittleren Ecke
        k = rnd.randrange(1, len(ecken) - 2)
        (u0, v0) = ecken[k]
        d = rnd.choice([-1, 1])
        ast = _pfad([(u0, v0), (u0 + rnd.choice([1, 2]), v0 + d * rnd.choice([1, 2])), (u0 + rnd.choice([3, 4]), v0 + d * rnd.choice([2, 3]))])
        ast = [q for q in ast if abs(q[1]) <= 6 and q not in pfad]
    return pfad, ecken[1:-1], ast


BLITZ_FORMEN = {(sd, i): _wuerfle_blitz(sd, i) for sd in ('L', 'R') for i in range(48)}


def blitz_aktiv(i):
    """Liste (Seite, Längenanteil, Frame in der Salve) aller in Frame i feuernden Blitze (0, 1 oder 2)."""
    out = []
    for (seite, f0, dauer) in BLITZ_SALVEN:
        k = (i - f0) % N
        if k < dauer:
            if k == 0 or k == dauer - 1:
                anteil = 0.45
            elif k == 1 or k == dauer - 2:
                anteil = 0.75
            else:
                anteil = (1.0, 0.85, 1.0, 0.7, 1.0)[(k + f0) % 5]                         # Länge schwankt von Frame zu Frame
            out.append((seite, anteil, k))
    return out


def blitz_ebene(i):
    """Blitze (Weiß mit Türkis-Schein an den Knicken) und Aufleuchten der Löcher. Frames ohne Feuer: leer."""
    e = L.leer(H, W)
    for (seite, anteil, k) in blitz_aktiv(i):
        pfad, ecken, ast = BLITZ_FORMEN[(seite, i)]
        sgn = -1 if seite == 'L' else 1
        x0, y0 = BLITZ_X0[seite], BLITZ_ZEILE[seite]
        umax = max(2, int(round(max(u for (u, v) in pfad) * anteil)))
        core = [(u, v) for (u, v) in pfad if u <= umax] + [q for q in ast if q[0] <= umax]
        cset = set(core)
        schein = set()
        for (u, v) in ecken + ([ast[0]] if ast else []):
            if u > umax:
                continue
            for (du, dv) in ((1, 0), (0, 1), (0, -1)):
                q = (u + du, v + dv)
                if q not in cset and q[0] <= umax:
                    schein.add(q)

        def setze(u, v, c):
            X, Y = PAD_L + x0 + sgn * u, PAD_T + y0 + v
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Blitzpixel bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = c
            e[Y, X, 3] = 255
        for (u, v) in schein:
            setze(u, v, BLITZ_SCHEIN)
        for (u, v) in core:
            setze(u, v, BLITZ_KERN)
        # das Loch selbst blitzt auf: Weiß/Türkis im Schachbrett, wechselt jeden Frame
        for j, (y, x) in enumerate(LOCH[seite]):
            e[PAD_T + y, PAD_L + x, :3] = BLITZ_KERN if ((j + i) % 2 == (1 if j in (1, 2) else 0)) else BLITZ_SCHEIN
            e[PAD_T + y, PAD_L + x, 3] = 255
    return e


def sprite_mit_effekten(i):
    sp = spr.copy()
    if GLANZ:
        for s0 in SWEEPS:
            if 0 <= i - s0 <= 11:
                t = 5 * (i - s0) - 3
                m = OPAK & ~RAND0 & (xx + yy >= t) & (xx + yy < t + 4)
                sp = A.farb_schritt(sp, HELLER, m)
    if MUND[i] >= 1:
        for (y, x) in MUND_ZEILE9:
            sp[y, x, :3] = CL
    if MUND[i] >= 2:
        for (y, x) in MUND_ZEILE7:
            sp[y, x, :3] = CD
    for k, a in enumerate(AUGEN):
        b = (BLINZELN_L if k == 0 else BLINZELN_R).get(i, 0)
        if b:
            ys = sorted({y for y, x in a})
            zu = {p for p in a if p[0] in (set(ys[:len(ys) // 2]) if b == 1 else set(ys))}
            for (y, x) in zu:
                sp[y, x, :3] = LID[(y, x)]
    return sp


def _platz(sp, maske):
    return L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


def _kopf(sp, i):
    """Kopf: fest (Runde 3: kein Wiegen mehr); nur die Ohren (Zeilen 0–1) zucken einzeln."""
    layer = _platz(sp, HEAD)
    out = L.leer(H, W)
    piv = PAD_T + 12
    maxd = piv - PAD_T
    for y in range(PAD_T, piv):
        xs = np.nonzero(layer[y, :, 3])[0]
        if not len(xs):
            continue
        for x in xs:
            dx = 0                                                                      # Runde 3: kein seitliches Wiegen des Kopfes mehr
            if y - PAD_T <= 1:
                if x - PAD_L <= 11:
                    dx -= EAR_L.get(i, 0)
                elif x - PAD_L >= 14:
                    dx += EAR_R.get(i, 0)
            if not 0 <= x + dx < W:
                raise L.ClipError(f'Kopfzeile {y} würde um {dx} px aus der Leinwand')
            out[y, x + dx] = layer[y, x]
    return out


# ── Radspikes: zyklisch von oben nach unten (1 Zeile alle 2 Frames, 6 Zeilen = 1 Umdrehung) ──
SPIKE_SCHRITT, SPIKE_ZYKLUS = 2, 6
SPIKE_START = (1, 4)                                                                   # Positionsindex bei Schritt 0 (Zeilen 19 und 22 = Original); Position p = Zeile 18 + p


def _spike_pixel(seite, y_top):
    """Pixel (x, y, Farbe) eines Spikes mit oberer Zeile y_top (18…23) für die Seite 'L'/'R'."""
    form = 'up' if y_top <= 20 else 'lo'
    tp = TEMPL[(seite, form)]
    if y_top == 18:                                                                     # knospt aus dem Reifen: nur die zwei innersten Pixel der oberen Zeile
        row0 = sorted((p for p in tp if p[1] == 0), key=lambda p: -p[0] if seite == 'L' else p[0])
        keep = row0[:2]
        return [(x, y_top + dy, c) for (x, dy, c) in keep]
    if y_top == 23:                                                                     # taucht wieder ein: obere Zeile ohne das äußerste Pixel, untere Zeile bleibt
        row0 = sorted((p for p in tp if p[1] == 0), key=lambda p: -p[0] if seite == 'L' else p[0])
        keep = row0[:3] + [p for p in tp if p[1] == 1]
        return [(x, y_top + dy, c) for (x, dy, c) in keep]
    return [(x, y_top + dy, c) for (x, dy, c) in tp]


def spikes_ebene(i):
    out = L.leer(H, W)
    s = (i // SPIKE_SCHRITT) % SPIKE_ZYKLUS
    for seite in ('L', 'R'):
        for p0 in SPIKE_START:
            for (x, y, c) in _spike_pixel(seite, 18 + (p0 + s) % SPIKE_ZYKLUS):
                out[PAD_T + y, PAD_L + x, :3] = c
                out[PAD_T + y, PAD_L + x, 3] = 255
    return out


def _radkanten(sp):
    """Reifenfüllung an der Radkante, wo im Original der obere Spike ansetzt (wird von Spikes überdeckt, wenn einer dort steht)."""
    out = L.leer(H, W)
    for (x, y) in RADKANTE.values():
        out[PAD_T + y, PAD_L + x, :3] = CK
        out[PAD_T + y, PAD_L + x, 3] = 255
    return out


def figur(i):
    sp = sprite_mit_effekten(i)
    ebenen = [(_platz(sp, BODY), 0, 0), (_radkanten(sp), 0, 0), (_kopf(sp, i), 0, 0), (spikes_ebene(i), 0, 0)]
    fig = L.zusammen(H, W, ebenen)
    fig, brueck = A.verbinde4(fig)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    fig, brueck2 = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, neu=neu, brueck=brueck + brueck2, pfad=pfad, offen=offen)


TEST_EBENEN = 'figur'                                                                  # randtest.py: ohne Blitze prüfen


def frame(i, nur=None):
    f = figur(i)
    if nur:
        return f['fig']
    # Blitz über die Figur (er überdeckt die Armspitze und leuchtet im Loch)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (blitz_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())),
          '| Teile:', {n: int(m.sum()) for n, m in (('kopf', HEAD), ('rumpf+arme+räder', BODY), ('spike_l', SP_L_UP | SP_L_LO), ('spike_r', SP_R_UP | SP_R_LO))})
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    # Arme müssen in JEDEM Frame exakt der Quelle entsprechen (Zeilen 13–17 ohne Kopf)
    arm_ref = ref[PAD_T + 13:PAD_T + 18, PAD_L:PAD_L + sw]
    print('Arme/Brust (Zeilen 13–17) weichen in', sum(int((figs[i][PAD_T + 13:PAD_T + 18, PAD_L:PAD_L + sw] != arm_ref).any(axis=2).sum()) for i in range(N)), 'Pixel-Frames ab (Glanzband/Blinzeln ausgenommen)')
    n = L.pruefe(frames, quelle=spr, erlaubt=[BLITZ_KERN, BLITZ_SCHEIN])
    print('Pixel je Frame:', n)
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    A.ausdruck_pruefen(figs, spr, 'coreling')
    L.speichern('coreling', 'Coreling', frames, MS, prev)
    if prev:
        L.streifen(prev + '/coreling-strip.png', frames[::2], spalten=12, scale=6)
