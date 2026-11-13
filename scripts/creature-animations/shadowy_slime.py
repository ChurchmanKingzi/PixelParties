# -*- coding: utf-8 -*-
"""Idle-Animation für „Shadowy Slime“ (Creature) — Runde 3: er HÜPFT (Hocke → Absprung → Flug → Landung) statt breiter zu werden.

Nutzerkorrektur (wörtlich): „Shadowy Slime sollte lieber hüpfen statt breiter zu werden.“ — Maßstab: Hardy/Rocky/Infinitely Reproducing Slime.

PICK: [["Motive", 553, 1], ["Motive", 552, 0]]
  Ebene „Darky Slime“ (Motive.xcf, Ebene 553, 15×13 px, Kopf + Oberkörper, voll deckend) UND die Ebene „Ebene #497“ (Ebene 552, 18×5 px, bbox (369,159)): das ist die UNTERE KÖRPERHÄLFTE
  (der breite, ausgefranste Schleimsockel). Sie liegt in der xcf auf einer eigenen Ebene mit Deckkraft 50 % (deshalb erscheint sie auf der Karte halbtransparent). Für die Animation wird sie
  voll deckend (Alpha 255) mit 553 zu EINER Figur vereinigt (Regel 22) → src/shadowy-slime.png (18×17 px, 16 Farben); gebaut mit anim_slime.py (`python3 anim_slime.py shadowy-slime`).
  Die Zeile y=159 liegt in beiden Ebenen und ergänzt sich schachbrettartig — zusammen eine geschlossene Zeile.
  Nicht verwendet: die halbtransparente Pfütze der Nachbarschleime (Ebene 551 gehört zum Infinitely Reproducing Slime), der violette Boden, die Nachbarschleime (550 Sparky, 554 Infinitely Reproducing).

Aufruf:   python3 shadowy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shadowy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×17, x/y ab 0):
* Ein nachtvioletter Schleim mit sehr dunklem Umriss A=(10,0,41)/B=(18,1,43), oben zwei gerundete „Ohren“-Wülste (x 3–7 und x 10–14, y 0–4) mit hellen Lichtpunkten L=(165,84,212) bei (5, 1) und
  (12, 1), dazwischen ein hellviolettes „V“ (E=(143,41,203), F=(113,6,182)) bei (6–12, 2–7), darunter (Zeilen 8–11) der Oberkörper in dunklem Violett mit zwei helleren
  Lichtpunkten O=(139,75,171) bei (6, 9) und (11, 9); darunter (Zeilen 12–16) die untere Körperhälfte: ein breiter, nach unten ausladender Sockel (Zeile 13 ist die breiteste, x 0–17) mit
  dunkler Mulde in der Mitte (D/H) und unten ausgefranstem Rand (Zeile 15 mit helleren Stücken, Zeile 16 = Bodenumriss x 7–13).
* Zwei einzelne durchsichtige Pixel (6, 2) und (11, 2) zwischen Ohren und „V“ sind Lücken der Originalebene und bleiben unverändert.
* Augen sind im Sprite nicht eindeutig zu erkennen → keine Augeneffekte (kein Blinzeln).
* Material: Schleim (Gel) — kein Metall/Gold/Edelstein: KEIN Glanz (Regel 14); kein Flammenfeuer (Regel 15 trifft nicht zu).
Fest bleiben: Umriss, Ohren, „V“ (die Kopfzeilen 0–1 werden nie verformt), Lichtpunkte der Ohren, Bodenumriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos; Frame 0 = Original), Hüpfen wie bei Hardy/Rocky/Infinitely Reproducing Slime (anim_hupf.py):
* Großer Sprung (Frames 3–22): Hocke (Körperzeilen 10, 11, 8 werden entfernt — der Schleim wird bis 3 Zeilen niedriger, aber NICHT breiter), Absprung (gestreckt: Zeilen 10, 11, 8
  werden mit Texturmischung der Nachbarzeile eingefügt, ebenfalls ohne Breitenänderung), Flug (der Schleim ist 1–6 px über dem Boden, Parabel, Scheitel 3 Frames), Aufprall (tiefste Hocke),
  Nachfedern. Kleiner Sprung (Frames 27–38, 3 px hoch). Dazwischen Ruhe.
* Die Sockelzeilen 12–15 bleiben als ruhiger Block mit dem Körper (keine seitliche Wabbelbewegung mehr, der Schleim wird nicht breiter, sondern hebt ab und landet).
* Keine Partikel (Regel 25: keine isolierten 1-px-Punkte).
Ergänzungen: wo ein Randpixel durch Stauchen/Strecken ohne Umriss frei liegt, bekommen die leeren Nachbarfelder den Umriss A=(10,0,41) (umriss_ergaenzen, Regel 16).
Frame: Sprite plus Platz für Sprung und Streckung nach oben (aus dem Ablauf berechnet), 3 px Rand — Figur zentriert. Alle Bewegungen laufen auf der vollen Leinwand. Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_amorph as A
import anim_hupf as Hu

N, MS = 48, 65

spr = L.lade('shadowy-slime')
sh, sw = spr.shape[:2]
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (10, 0, 41)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
LICHT_K = (165, 84, 212)
LICHT_O = (139, 75, 171)
TEST_EBENEN = ('fig',)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


def _lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


# ── Spaltenpaare je Zeile: je ein Pixel neben dem Umriss (nie der Umriss selbst, kein Lichtpunkt) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    links = [x for x in (l + 2, l + 1, l + 3, l + 4) if OPAK[y, x] and _lum(_col(y, x)) > 20 and x < r - 3 and _col(y, x) != LICHT_K]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4) if OPAK[y, x] and _lum(_col(y, x)) > 20 and x > l + 3 and _col(y, x) != LICHT_K]
    PAARE_ZEILE[y] = [(links[0] if links else l + 2, rechts[0] if rechts else r - 2)]
    if PAARE_ZEILE[y][0][0] >= PAARE_ZEILE[y][0][1]:
        PAARE_ZEILE[y] = [(l + 1, r - 1)]

# Kopfzeilen 2–6: die Spalten werden in der Mitte (am „V“) verdoppelt/entfernt statt am Rand, damit Ohrränder und dunkle Flächen nie dicker werden
for _y, _pr in ((2, (8, 9)), (3, (8, 9)), (4, (8, 9)), (5, (8, 10)), (6, (8, 9))):
    PAARE_ZEILE[_y] = [_pr]
    assert OPAK[_y, _pr[0]] and OPAK[_y, _pr[1]]

# ── Posen (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite): Körperzeilen 8, 10, 11 (Oberkörper, ohne Lichtpunktzeile 9 und Sockel) ──
POSEN = {
    'R': ((), {}, 0),
    'D1': ({10}, {}, 0),
    'D2': ({10, 11}, {}, 0),
    'D3': ({10, 11, 8}, {}, 0),
    'T1': ((), {10: 1}, 0),
    'T2': ((), {10: 1, 11: 1}, 0),
    'T3': ((), {10: 1, 11: 1, 8: 1}, 0),
}
ABLAUF = Hu.ablauf(N, gross=6, klein=3)
assert ABLAUF[0] == ('R', 0)


def _zeilen(pose):
    lo, do, _ = POSEN[pose]
    return sh - len(lo) + sum(do.values() if isinstance(do, dict) else [1] * len(do))


PAD_L, PAD_R = 3, 3
PAD_T = max(_zeilen(p) + d for p, d in ABLAUF) - sh + 3
PAD_B = 2
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1


def figur(i):
    pose, dy = ABLAUF[i]
    fig, top, quelle = TX.hupf_figur(spr, pose, dy, POSEN, PAARE_ZEILE, (), H, W, PAD_L, PAD_T, BODEN)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i, nur=None):
    return figur(i)['fig']


if __name__ == '__main__':
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    frames = [frame(i) for i in range(N)]
    figs = frames
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, 'shadowy-slime')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    print('Höhe über dem Boden je Frame:', [d for _, d in ABLAUF])
    L.speichern('shadowy-slime', 'Shadowy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shadowy-slime-strip.png', frames[::2], spalten=12, scale=6)
