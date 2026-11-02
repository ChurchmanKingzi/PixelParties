# -*- coding: utf-8 -*-
"""Idle-Animation für „Paraseed“ (Creature) — Runde 2: die BLUME, die aus dem Kopf des Soldaten wächst.

PICK: [["MotiveSteamDwarfs", 144, 2]]   Ebene „Ebene #220“ (MotiveSteamDwarfs.xcf, Ebene 144 = die roten Tulpen der Karte; Figur 2 = die Tulpe mit der rosa Knospe, die in der Kartenkunst
(data/card-art/native/Paraseed.png, Position (37,10)) direkt über der Kapuzenspitze des Soldaten steht — das ist das Paraseed). Nutzerkorrektur: „Paraseed ist die Blume, die aus dem Kopf des Soldaten
wächst!“ — der frühere Sprite (der Soldat mit Kapuze, Ebene 145) war falsch und entfällt. Die Blume liegt auf einer eigenen Ebene (nicht auf der des Soldaten), deshalb wird NUR die Blume extrahiert:
`python3 creature_show.py extract "Paraseed" 1 paraseed`, danach aus dem Ergebnis entfernt: die fünf schwarzen Pixel (0,0,0) unten links (das sind dunkle Pixel der Kapuze, die in derselben Ebene mitliegen),
das Pixel (1,10) (diagonal fortgesetzter Stängelrest, nur eckverbunden) → src/paraseed.png (7×10 px, 6 Farben, nur Alpha 0/255). Der Soldat ist nicht Teil des Sprites (Annahme: Paraseed = die Blume).

Aufruf:   python3 paraseed.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/paraseed.png + .json

Was im Sprite ist (Koordinaten im Sprite 7×10, x/y ab 0):
* Tulpenblüte (Zeilen 0–6): rosa Knospe aus C=(254,107,151), hellrosa E=(255,174,181) (Spitze bei (3,0) und Mitte (3,2)) und dem violetteren Schatten F=(190,72,130); darum ein roter Kelch mit
  dunkelrotem Umriss A=(102,0,0) und den Rotstufen B=(128,0,0), D=(181,0,0); links (0–1, 1) und rechts (6, 1) stehen die Blütenblatt-Spitzen.
* Stängel (Zeilen 7–9, x 2): ein dünner roter Stängel B=(128,0,0), unten (2, 9) dunkel A — er führt in der Karte in die Kapuze des Soldaten.
* Material: Pflanze — KEIN Glanz, keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15).
Fest bleiben: der Stängelfuß (Zeile 9) und der Umriss, soweit er sich nicht mit der Pflanze neigt.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Wiegen (Periode 24, zwei Wiegen je Schleife, dazu eine schnellere Nachschwingung der Periode 12): die ganze Blüte (Kelch samt Knospe und Blütenblättern, starr) wandert bis ±2 px hin und her; der Stängel
  darunter BIEGT sich in einer weichen Kurve (Zeilenversatz wächst vom festen Fuß nach oben, Nachbarzeilen unterscheiden sich um höchstens 1 px, der Stängelkopf folgt der Blüte).
* Blütenblätter (Periode 16 = drei Zyklen): die beiden äußeren Blütenblatt-Spitzen heben sich 1 px (Umrisspixel (0,0) und (6,0) kommen dazu) und senken sich wieder — die Blüte öffnet und schließt sich leicht.
* Atmen (Periode 24, Frames 2–10 und 26–34): der Kelch streckt sich 1 px (Zeile 4 verdoppelt, Texturmischung der Nachbarzeile via `A.koerper_pose`, die Knospe steigt), der Stängelfuß bleibt am Boden.
* Sporen (Partikel): drei kleine runde 2×2-Pollenwölkchen (Hellrosa/Rosa des Sprites, nie 1-px-Einzelpunkte) lösen sich über der Knospe und steigen langsam auf (24 Frames Lebenszeit, leicht pendelnd).
Ergänzungen: (0) Brückenpixel (Stängelfarbe B bzw. A) dort, wo der schräg stehende 1-px-Stängel nur über eine Pixelecke hängt (A.verbinde4, 0–3 Pixel je Frame); (1) der Stängel ist um 3 Zeilen verlängert (Zeilen 10–12 des Skript-Sprites: B=(128,0,0) in Zeile 10–11 des Stängels, der dunkle Stängelfuß A=(102,0,0) rückt von Zeile 9 nach 12), damit er sich beim Wiegen
sichtbar biegen kann; in der Kartenkunst verschwindet der Stängel hinter der Kapuze, die Verlängerung ist die dort verdeckte Fortsetzung. Frame 0 weicht deshalb vom extrahierten src-Sprite nur um diese 3 Stängelzeilen ab.
(2) Umrisspixel A bei den Blütenblatt-Spitzen (0,0)/(6,0) in den „offenen“ Frames; sonst nur ggf. `umriss_ergaenzen` an freiliegenden Kelchkanten.
Frame: Sprite plus 5 px links/rechts (Neigung), 12 px oben (Strecken + Sporen), 2 px unten — Figur zentriert. Alle Bewegungen laufen auf der vollen Leinwand. Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 12, 2
TEST_EBENEN = ('fig',)

spr0 = L.lade('paraseed')                                                                 # extrahierter Sprite 7×10
STAENGEL_PLUS = 3                                                                         # Ergänzung: Stängel um 3 Zeilen verlängert (siehe oben)
_h0, _w0 = spr0.shape[:2]
spr = np.zeros((_h0 + STAENGEL_PLUS, _w0, 4), np.uint8)
spr[:_h0] = spr0
spr[_h0 - 1:_h0 - 1 + STAENGEL_PLUS + 1, 2, :3] = (128, 0, 0)                                # Stängelzeilen 9–12 in B
spr[_h0 - 1:_h0 - 1 + STAENGEL_PLUS + 1, 2, 3] = 255
spr[_h0 - 1 + STAENGEL_PLUS, 2, :3] = (102, 0, 0)                                            # dunkler Fuß A ganz unten
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
CA, CB, CC, CD, CE, CF = (102, 0, 0), (128, 0, 0), (254, 107, 151), (181, 0, 0), (255, 174, 181), (190, 72, 130)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF):
    assert _c in _farben, _c


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


assert _col(0, 3) == CE and _col(1, 0) == CA and _col(1, 6) == CA and _col(sh - 1, 2) == CA and _col(9, 2) == CB
KELCH_UNTEN = 6                                                                           # Quellzeilen 0–6 = Blüte (starr), 7… = Stängel (biegt sich)

# ── Zeitachsen ──
STRECK = [1 if math.sin(2 * math.pi * i / 24) >= 0.3 else 0 for i in range(N)]
assert STRECK[0] == 0
SPITZEN = [1 if math.sin(2 * math.pi * i / 16) > 0.35 else 0 for i in range(N)]       # 1 = Blütenblattspitzen gehoben
assert SPITZEN[0] == 0
SPOREN = [dict(x=3, vx=-1, off=0), dict(x=3, vx=2, off=8), dict(x=4, vx=0, off=16)]     # 2×2-Pollen über der Knospe (Sprite-Koordinaten)
SPORENFARBEN = {'c': CE, 'r': CC}


def bluete_dx(i):
    """Seitlicher Versatz der ganzen Blüte (starr) im Frame i: Wiegen (Periode 24) + schnellere Nachschwingung (Periode 12), 0 in Frame 0."""
    p = 2 * math.pi * i / 24
    return int(round(2.0 * math.sin(p) + 0.7 * math.sin(2 * p)))


def staengel_dx(i, quelle_zeile):
    """Versatz einer Stängelzeile (Quellzeile ≥ 7): wächst vom festen Fuß (Zeile sh−1: 0) zur Blüte hin bis fast zum Versatz der Blüte."""
    f = (sh - 1 - quelle_zeile) / float(sh - 1 - (KELCH_UNTEN + 1) + 1)                   # Fuß 0 … Stängelkopf < 1
    return int(round(bluete_dx(i) * f ** 1.3))


def sporen_ebene(i):
    e = L.leer(H, W)
    for sp in SPOREN:
        t = ((i + sp['off']) % 24) / 24.0
        if t > 0.92:
            continue
        cx = PAD_L + sp['x'] + int(round(sp['vx'] * t + math.sin(2 * math.pi * t) * 1.0))
        cy = PAD_T - 4 - int(round(7 * t))
        for (dx, dy, k) in L.PUFF_FORMEN['s']:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Spore bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = SPORENFARBEN[k]
            e[Y, X, 3] = 255
    return e


def sprite_mit_effekten(i):
    sp = spr.copy()
    if SPITZEN[i]:
        for (x, y) in ((0, 0), (6, 0)):
            sp[y, x, :3] = CA
            sp[y, x, 3] = 255
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln={4: 1} if STRECK[i] else {}, p=0, x0=PAD_L)
    dxs = [bluete_dx(i) if q <= KELCH_UNTEN else staengel_dx(i, q) for q in quelle]
    z = A.verschiebe_ausgabezeilen(z, dxs)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    fig, brueck = A.verbinde4(fig)                                                         # schräg stehender 1-px-Stängel: Brückenpixel machen ihn 4-verbunden
    return dict(fig=fig, top=top, neu=neu, dxs=dxs, brueck=brueck)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    return L.zusammen(H, W, [(sporen_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs])
    print('größter Zeilenversatz-Sprung zwischen Nachbarzeilen:', max(max(abs(d[k + 1] - d[k]) for k in range(len(d) - 1)) for d in (f['dxs'] for f in fs)))
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, 'paraseed')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('paraseed', 'Paraseed', frames, MS, prev)
    if prev:
        L.streifen(prev + '/paraseed-strip.png', frames[::2], spalten=12, scale=8)
