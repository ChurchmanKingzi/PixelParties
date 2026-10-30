# -*- coding: utf-8 -*-
"""Idle-Animation für „The Root of all Evil“ (Creature).

PICK: [["MotiveGrailWar", 534, 1]]   Ebene „Root of all Evil“ (MotiveGrailWar.xcf, Ebene 534, 32×60 px, 12 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/the-root-of-all-evil.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/The_Root_of_all_Evil.png, 76×51) abgeglichen: die Ebene sitzt dort bei (21,−7) mit 100 % Treffer — der Baum ist 60 Zeilen hoch, die Karte schneidet
oben 7 Zeilen (die dünne Wipfelspitze, Sprite-Zeilen 0–6) ab. Es wird die ganze Ebene verwendet (vollständige Figur). Nicht verwendet: Waldrand, Erde und Gras der Kartenkunst.

Aufruf:   python3 the_root_of_all_evil.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/the-root-of-all-evil.png + .json

Was im Sprite ist (Koordinaten im Sprite 32×60, x/y ab 0):
* Ein grauer, toter Baum (Graustufen A=(24,24,24) Umriss/Schatten, B, C, D, E; Zeilen 0–59): dünne Wipfelspitze (x 15–18, y 0–11), zerfetzte Äste links und rechts (Zeilen 12–40), Stamm (x 13–21),
  Wurzelballen (Zeilen 49–59, x 5–26).
* Gesicht: zwei rote Augen — ein schräges (links oben, x 8–16, y 21–25) und ein senkrechtes Schlitzauge (Mitte, x 15–20, y 34–44), Rottöne F=(23,0,0), G=(54,0,0), I=(116,0,0), K, Blassrosa H=(204,109,109),
  Schwarz L — und ein Maul mit weißen Zähnen J=(255,255,255) (x 11–20, y 49–52).
* Material: Holz/Rinde — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Rot sind nur Augen und Maul.
Fest bleiben: Umriss, Stamm, Wurzeln, Maul (nur Rindenzeilen werden versetzt).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Wiegen (Periode 48): der Baum neigt sich langsam — Zeilenversatz mit nach oben wachsendem Gewicht (Wipfelspitze ±3 px, Stamm in Augenhöhe ±1, Wurzeln fest); wo der Versatz zweier Nachbarzeilen
  sie nicht mehr 4-verbunden ließe, teilen sie sich den Versatz.
* Äste (Periode 24, links/rechts gegenläufig): die äußeren Astspalten (links x 0–7, rechts x 23–31, Zeilen 10–46) wippen senkrecht (bis ±2 px an den Astspitzen, die Spitze hinkt nach).
* Blinzeln (zweimal je Schleife, Frames 13–15 und 37–39: halb – zu – halb): die roten Augenpixel beider Augen nehmen die umgebende Rindenfarbe an (je Pixel häufigste Graustufe im Umkreis von 2 px, mitten im Auge bis 4 px); das Maul bleibt.
Ergänzungen: wo der Ast-/Wiegeversatz ein Astende nur noch über eine Pixelecke hängen lässt, ein Brückenpixel in der Farbe des Astendes (siehe `brueck`), und Umrisspixel A=(24,24,24) an freigelegten Kanten (siehe `ergaenzt`).
Frame: Sprite plus 4 px links/rechts, 2 px oben, 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 2, 2

spr = L.lade('the-root-of-all-evil')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (24, 24, 24)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


REDS = {(23, 0, 0), (54, 0, 0), (116, 0, 0), (38, 0, 0), (204, 109, 109), (0, 0, 0)}
GRAUS = {(24, 24, 24), (46, 46, 46), (66, 66, 66), (88, 88, 88), (78, 78, 78)}
# Augen: Pixel in Rottönen im Bereich des jeweiligen Auges (Sprite-Koordinaten (y, x))
AUGE1 = [(y, x) for y in range(0, 31) for x in range(sw) if OPAK[y, x] and _col(y, x) in REDS]                  # schräges Auge (oberhalb des Stammes)
AUGE2 = [(y, x) for y in range(31, 48) for x in range(sw) if OPAK[y, x] and _col(y, x) in REDS]                 # senkrechtes Schlitzauge (Maul beginnt erst bei y 49)
assert len(AUGE1) >= 15 and len(AUGE2) >= 15, (len(AUGE1), len(AUGE2))
AUGEN = [(AUGE1, 23), (AUGE2, 38)]                                                 # (Pixel, Mittelzeile): obere Hälfte = Zeilen ≤ Mitte
BLINK = {13: 1, 14: 2, 15: 1, 37: 1, 38: 2, 39: 1}

# ── Wiegen: Gewicht je Quellzeile (oben 1, unten 0) ──
AMP_SWAY = 3.0
GEWICHT = [((sh - 1 - y) / float(sh - 1)) ** 1.6 for y in range(sh)]
for _y in range(44, sh):
    GEWICHT[_y] = 0.0                                                              # Maul und Wurzeln bleiben fest

# ── Äste: Spaltenversatz ──
AST_ZEILEN = (10, 46)
AST_LINKS = (0, 7, 8)                                                              # (erste, letzte Spalte, Gelenkspalte)
AST_RECHTS = (23, 31, 22)
AMP_AST = 2.0
LAG = 0.8


def _ast_dy(i, seite):
    c0, c1, piv = AST_LINKS if seite == 'l' else AST_RECHTS
    phi = 0.0 if seite == 'l' else math.pi
    maxd = max(abs(c0 - piv), abs(c1 - piv))
    ph = 2 * math.pi * i / 24
    out = {}
    for x in range(c0, c1 + 1):
        frac = abs(x - piv) / float(maxd)
        out[x] = int(round(AMP_AST * frac * (math.sin(ph + phi - LAG * frac) - math.sin(phi - LAG * frac)) / 1.0))
    return out


def _aeste(sp, seite):
    out = sp.copy()
    y0, y1 = AST_ZEILEN
    for x, dy in _ast_dy(CUR_I[0], seite).items():
        col = sp[y0:y1 + 1, x].copy()
        out[y0:y1 + 1, x] = 0
        for k in np.nonzero(col[:, 3])[0]:
            Y = y0 + k + dy
            if not 0 <= Y < sh:
                raise L.ClipError('Ast aus dem Sprite')
            out[Y, x] = col[k]
    return out


CUR_I = [0]


def _augen_zu(sp, stufe):
    out = sp.copy()
    for pix, mitte in AUGEN:
        for (y, x) in pix:
            if stufe == 1 and y > mitte:
                continue
            for rad in (2, 3, 4):                                                    # Umkreis von 2 px, bei Bedarf (mitten im Auge) weiter
                cnt, dist = {}, {}
                for dy in range(-rad, rad + 1):
                    for dx in range(-rad, rad + 1):
                        yy, xx = y + dy, x + dx
                        if not (0 <= yy < sh and 0 <= xx < sw) or not sp[yy, xx, 3]:
                            continue
                        c = tuple(int(v) for v in sp[yy, xx, :3])
                        if c not in GRAUS or c == UMRISS:
                            continue
                        cnt[c] = cnt.get(c, 0) + 1
                        dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
                if cnt:
                    out[y, x, :3] = max(cnt, key=lambda q: (cnt[q], -dist[q]))
                    break
    return out


def _dx_zeilen(sp, i):
    """Versatz je Quellzeile: round(AMP · Gewicht · sin(2π i/48)); wo zwei Nachbarzeilen bei verschiedenem Versatz nicht 4-verbunden blieben, übernimmt die obere den Versatz der unteren."""
    ph = 2 * math.pi * i / 48
    dx = [int(round(AMP_SWAY * g * math.sin(ph))) for g in GEWICHT]
    for y in range(sh - 2, -1, -1):
        if dx[y] == dx[y + 1]:
            continue
        a = {int(x) + dx[y] for x in np.nonzero(sp[y, :, 3])[0]}
        b = {int(x) + dx[y + 1] for x in np.nonzero(sp[y + 1, :, 3])[0]}
        if not (a & b):
            dx[y] = dx[y + 1]
    return dx


def figur(i):
    CUR_I[0] = i
    sp = spr.copy()
    if i in BLINK:
        sp = _augen_zu(sp, BLINK[i])
    sp = _aeste(sp, 'l')
    sp = _aeste(sp, 'r')
    z = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    dx = _dx_zeilen(sp, i)
    z = A.verschiebe_ausgabezeilen(z, dx)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, top=top, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    frames = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergaenzt (Umrisspixel je Frame):', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(frames, spr, 'the-root-of-all-evil')
    L.speichern('the-root-of-all-evil', 'The Root of all Evil', frames, MS, prev)
    if prev:
        L.streifen(prev + '/the-root-of-all-evil-strip.png', frames[::2], spalten=12, scale=4)
