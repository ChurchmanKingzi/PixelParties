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
* Wiegen (Periode 24, zwei Wiegen je Schleife): die ganze Blume neigt sich um den festen Stängelfuß hin und her (Zeilenversatz wächst nach oben, Spitze bis ±2 px; Nachbarzeilen unterscheiden sich um höchstens
  1 px, der Stängel biegt sich dabei in einer weichen Kurve), darüber eine zweite, schnellere Neigung der Knospe (Periode 12, ±1 px, nur Zeilen 0–3), so dass die Blüte nicht starr mitschwingt.
* Blütenblätter (Periode 16 = drei Zyklen): die beiden äußeren Blütenblatt-Spitzen heben sich 1 px (Umrisspixel (0,0) und (6,0) kommen dazu, die Spitzen werden länger) und senken sich wieder — die Blüte
  öffnet und schließt sich leicht.
* Atmen (Periode 24, Frames 2–10 und 26–34): der Kelch streckt sich 1 px (Zeile 4 verdoppelt, Texturmischung der Nachbarzeile via `A.koerper_pose`, die Knospe steigt), Zeile 9 bleibt am Boden.
* Sporen (Partikel): drei kleine runde 2×2-Pollenwölkchen (Hellrosa/Rosa des Sprites) lösen sich über der Knospe und steigen langsam auf (24 Frames Lebenszeit, leicht pendelnd).
Ergänzungen: Umrisspixel A bei den Blütenblatt-Spitzen (0,0)/(6,0) (nur in den „offenen“ Frames), sonst nur ggf. `umriss_ergaenzen` an freiliegenden Kelchkanten (0–2 Pixel je Frame).
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

spr = L.lade('paraseed')
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


assert _col(0, 3) == CE and _col(1, 0) == CA and _col(1, 6) == CA and _col(9, 2) == CA

# ── Zeitachsen ──
STRECK = [1 if math.sin(2 * math.pi * i / 24) >= 0.3 else 0 for i in range(N)]
assert STRECK[0] == 0
SPITZEN = [1 if math.sin(2 * math.pi * i / 16) > 0.35 else 0 for i in range(N)]       # 1 = Blütenblattspitzen gehoben
assert SPITZEN[0] == 0
SPORENFARBEN = {'c': CE, 'r': CC}
PUFFS = [
    dict(x=PAD_L + 3, y=PAD_T - 3, vx=-1, vy=-7, off=0, form="s", wackeln=1),
    dict(x=PAD_L + 3, y=PAD_T - 3, vx=2, vy=-7, off=8, form='s', wackeln=1),
    dict(x=PAD_L + 4, y=PAD_T - 3, vx=0, vy=-7, off=16, form='s', wackeln=1),
]


def lean_dx(i, y_aus, h_aus):
    """Seitlicher Versatz der Ausgabezeile y (0 = oberste Zeile der Blume, h_aus − 1 = Stängelfuß): Neigung um den festen Fuß.
    f = Abstand zum Fuß / Höhe (0…1); die Knospe (f ≈ 1) bewegt sich am stärksten, der Stängel kaum."""
    f = (h_aus - 1 - y_aus) / float(h_aus - 1)
    grund = 2.2 * (f ** 1.25) * math.sin(2 * math.pi * i / 24)
    zweit = 0.9 * (f ** 3) * math.sin(2 * math.pi * i / 12)
    return int(round(grund + zweit))


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
    n = z.shape[0]
    dxs = [lean_dx(i, j, n) for j in range(n)]
    z = A.verschiebe_ausgabezeilen(z, dxs)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    return dict(fig=fig, top=top, neu=neu, dxs=dxs)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    sporen = L.puff_ebene(H, W, i, 24, PUFFS, SPORENFARBEN)
    return L.zusammen(H, W, [(sporen, 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('größter Zeilenversatz-Sprung zwischen Nachbarzeilen:', max(max(abs(d[k + 1] - d[k]) for k in range(len(d) - 1)) for d in (f['dxs'] for f in fs)))
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, 'paraseed')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('paraseed', 'Paraseed', frames, MS, prev)
    if prev:
        L.streifen(prev + '/paraseed-strip.png', frames[::2], spalten=12, scale=8)
