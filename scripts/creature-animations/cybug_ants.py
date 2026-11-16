# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug ANTS“ (Creature) — Trupp gepanzerter Cyber-Ameisen mit Geschützen: sie marschieren im Laufschritt seitwärts hin und her,
die Fühler zucken, die roten Augen pulsieren, ein kurzer Glanz läuft über die Geschützrohre.

PICK: [["MotiveEgypt", 142, "ganze Ebene 113×19: drei vollständige, identische Ameisen im 38-px-Raster (die Kartenkunst zeigt denselben Trupp, links/rechts angeschnitten)"]]
Abgleich mit data/card-art/native/Cybug_ANTS.png und der Motiv-Maske (src nennt Ebene 142). Die vom Nutzer genannte „Ebene #73“ ist im Dump als Index 73 ein
8×14-Kleinteil – gemeint ist offenbar der Ebenenname; die Ameisen liegen auf Index 142. Die Ebene enthält DREI Ameisen (nicht vier); alle drei verwendet.

Identifikation (je Ameise, 37 px breit, Koordinaten der ersten): rostrote Fühler (x 8–15, y 1–4), Kopf (x 10–14, y 3–6) mit zwei roten Augen (10,6), (13,6)
(Hellrot (255,0,0), darüber Dunkelrot), zwei Geschützrohre nach links (x 0–13, y 5–11), Geschützturm nach rechts (zwei Kästen x 23–36, y 1–10, der Punkt (27,0)
ist die Turmspitze), karierter Metallleib (x 14–27, y 5–15) mit braunen Gelenken, zwei Beine: Stiel (3 px breit, y 15–16) und Kreuzfuß (5 px, y 17–18). Die drei Ameisen
unterscheiden sich in der Ebene nur in der Beinstellung (Stiel/Fuß um −1…+2 px versetzt) – diese Grundstellungen bleiben erhalten.

Ablauf (64 Frames à 70 ms = 4,5 s). Frame 0 = Original:
* SEITWÄRTSMARSCH (Nutzer, Runde 12): der ganze Trupp (alle drei Ameisen gemeinsam, Leib + Geschütze + Fühler) verschiebt sich waagerecht in ganzen Pixeln:
  3 px nach bildlinks, 6 px nach bildrechts, 3 px zurück (1 px je 4 Frames, an den Wendepunkten und am Anfang 4 Frames Halt). OHNE Spiegeln – die Ameisen
  tragen links die Rohre und rechts den Turm; rückwärts gesetzt wirkt wie ein Trupp, der in Stellung hin- und herrückt, gespiegelt würden Rohre/Turm umspringen.
* Laufschritt: je Ameise Vorder- und Hinterbein im Wechsel, die mittlere Ameise im Gegentakt. Ein aufgesetzter Fuß bleibt am Boden stehen (wandert unter dem
  Leib durch, kein Rutschen); beim eigenen Schritt hebt er sich 2 Frames um 1 px (der Stiel verkürzt sich um seine untere Zeile) und setzt 1 px in
  Marschrichtung vor. Der Stiel-Ansatz bleibt am Leib; das Bein stellt sich dabei höchstens 1 px je Stielzeile schräg (so stehen die Beine auch in der Quelle). Im Halt setzen die Beine in die Grundstellung zurück.
* Fühler: die obere Fühlerhälfte (Zeilen 1–2) zuckt 1 px nach vorn (je Ameise versetzt, 3 Frames).
* Augen: das Hellrot dimmt kurz auf das Dunkelrot der Quelle (2 Frames, je Ameise versetzt) – nur in den Augenpixeln.
* Geschütz: kurzes Sparkle (Punkt → Kreuz → Punkt, 4 Frames) an einer Rohrkante je Ameise, nacheinander – Metall.
Leib und Geschütze bleiben in sich starr (kein Hub – die Rohre bleiben ruhig im Anschlag) und wandern nur mit dem Trupp.
"""
import numpy as np

import anim_lib as L
import anim_n11 as G

N, MS = 64, 70
sz = G.Szene('cybug-ants', (8, 8, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ROT, DROT, WEISS = (255, 0, 0), (150, 0, 0), (205, 205, 205)
# Marsch: 16 Schritte à 4 Frames; Richtung des Trupps je Schritt (−1 = nach bildlinks, 0 = Halt). Lage: 0 → −3 → +3 → 0.
SCHRITT = 4
RICHT = [0, -1, -1, -1, 0, 1, 1, 1, 1, 1, 1, 0, -1, -1, -1, 0]
assert len(RICHT) * SCHRITT == N and sum(RICHT) == 0
LAGE = list(np.cumsum(RICHT))                                                   # Truppversatz während Schritt k
# Die drei Ameisen der Ebene stehen schon in leicht verschiedenen Schrittstellungen: Grundversatz (Stiel Zeile 16 + Fuß) je Bein gegenüber der ersten Ameise
GRUND = [(0, 0), (-1, 2), (1, 1)]
GRUND15 = [(0, 0), (0, 1), (0, 1)]                                               # … und der oberen Stielzeile 15 (Beine stehen in der Quelle bis 1 px je Zeile schräg)
TAKT = [0, 1, 0]                                                                 # mittlere Ameise im Gegentakt
STIEL_X = ((13, 15), (23, 25))                                                   # Stiel (3 px breit) des Vorder-/Hinterbeins der ersten Ameise
bein_m = sz.da & (yy >= 16)
stiel15_m = np.zeros_like(sz.da)
for _k in range(3):
    for _n in range(2):
        _a = 38 * _k + STIEL_X[_n][0] + GRUND15[_k][_n]
        stiel15_m[15, _a:_a + 3] = True
assert (stiel15_m & sz.da).sum() == 18
kan = sz.spr.copy(); kan[~(sz.da & (xx <= 37))] = 0
BEIN = [np.where(((xx >= a - 1) & (xx <= b + 1) & (yy >= 15) & (xx <= 37) & ((yy >= 16) | ((xx >= a) & (xx <= b))))[..., None], kan, 0).astype(np.uint8)
        for (a, b) in STIEL_X]                                                   # Bein der ersten Ameise: Stielzeilen 15–16 + Kreuzfuß 17–18
fuehler_m = sz.da & sz.ist((129, 41, 19)) & (yy <= 2)
RUMPF = sz.teil(sz.da & ~bein_m & ~stiel15_m & ~fuehler_m)
TEST_EBENEN = ('figur',)


def _gang(k_ameise, n):
    """Je Frame (Beinversatz gegenüber dem Leib, gehoben?) für Bein n der Ameise. Der Fuß steht in der WELT still, solange er aufgesetzt ist
    (er wandert also gegen die Marschrichtung unter dem Leib durch) – kein Rutschen; beim eigenen Schritt hebt er sich 2 Frames und setzt vor."""
    g = GRUND[k_ameise][n]
    lo, hi = -2 - g, 2 - g                                                       # Bein höchstens 1 px je Stielzeile schräg (wie in der Quelle): Gesamtversatz −2…+2
    welt, out = 0, []
    for k, d in enumerate(RICHT):
        x = int(LAGE[k])
        dran = (k + n + TAKT[k_ameise]) % 2 == 0
        ziel = x + max(lo, min(hi, d))
        rel = welt - x
        neu, wann = welt, None
        if d == 0:
            if rel != 0:
                neu, wann = x, (0, 1) if n == 0 else (2, 3)                      # im Halt setzen die Beine nacheinander in die Grundstellung zurück
        elif (dran and ziel != welt) or not (lo <= rel <= hi):
            neu, wann = ziel, (0, 1)
        for j in range(SCHRITT):
            if wann and j < wann[0]:
                out.append((max(lo, min(hi, rel)), 0))
            else:
                out.append((neu - x, 1 if (wann and j in wann) else 0))
        welt = neu
    assert welt == 0
    return out


GANG = [[_gang(k, n) for n in range(2)] for k in range(3)]
assert all(GANG[k][n][0] == (0, 0) for k in range(3) for n in range(2))


def bein(k, n, dx, hoch):
    """Bein n der Ameise k als starre Teile: obere Stielzeile, untere Stielzeile, Kreuzfuß – je Zeile höchstens 1 px versetzt (Schrägstellung der Quelle).
    Gehoben: die untere Stielzeile entfällt, der Fuß rückt unverändert 1 px hoch."""
    t = GRUND[k][n] + dx                                                         # Versatz von Stielzeile 16 + Fuß
    t15 = GRUND15[k][n] if dx == 0 else (1 if t >= 2 else -1 if t <= -2 else (1 if (t == 1 and GRUND15[k][n] == 1) else 0))
    b = BEIN[n]
    out = L.leer(sz.sh, sz.sw + 8)
    def lege(zq, zz, off):
        xs = np.nonzero(b[zq, :, 3])[0]
        out[zz, xs + 4 + off] = b[zq, xs]
    lege(15, 15, t15)
    if hoch:
        lege(17, 16, t); lege(18, 17, t)
    else:
        lege(16, 16, t); lege(17, 17, t); lege(18, 18, t)
    return out


def frame(i, nur=None):
    f = RUMPF.copy()
    for k in range(3):
        x0 = 38 * k
        # Fühler
        zuck = 1 if (i - 5 - 14 * k) % N < 3 or (i - 37 - 14 * k) % N < 3 else 0
        fm = fuehler_m & (xx >= x0) & (xx < x0 + 38)
        f = G.ueber(f, G.starr(sz.teil(fm), -zuck, 0))
        # Augen
        if (i - 18 - 9 * k) % 32 < 2:
            am = sz.voll(sz.ist(ROT) & (xx >= x0) & (xx < x0 + 38))
            f = G.farbtausch(f, am, {ROT: DROT})
        if not nur:
            s = G.funkel_folge(i, N, 10 + 18 * k, (1, 2, 2, 1))
            if s:
                G.funkel(f, sz.PL + x0 + 3, sz.PT + 6, s, WEISS)
    X = int(LAGE[i // SCHRITT])
    f = G.starr(f, X, 0)                                                         # der ganze Trupp marschiert seitwärts (ohne Spiegeln)
    for k in range(3):
        x0 = 38 * k
        for n in range(2):
            dx, hoch = GANG[k][n][i]
            f = G.ueber(f, L.platz(bein(k, n, int(dx), hoch), sz.H, sz.W, sz.PL + x0 + X - 4, sz.PT))
    return f


if __name__ == '__main__':
    G.fertig('cybug-ants', 'Cybug ANTS', frame, N, MS, spr, check=[0, 4, 5, 6, 8, 12, 16, 20, 24, 40, 44, 60], zoom=5, box=None)
