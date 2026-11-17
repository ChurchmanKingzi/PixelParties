# -*- coding: utf-8 -*-
"""Idle-Animation für „Box Spider“ (Creature) — Runde 3 überarbeitet.

Nutzerfeedback Runde 3: „Box Spider: fehlt der Körper! Und das Monokel sollte glänzen.“

Quelle (neu): src/box-spider.png = die Kiste UND die Spinne darunter, zusammengesetzt wie auf der Karte (Abgleich mit data/card-art/native/Box_Spider.png: 0 von 227 Pixeln weichen ab).
PICK: [["MotiveGN", 274, "ganze Ebene"], ["MotiveGN", 280, "Ausschnitt Karte x 30–46, y 29–37 (Ebene 'SPODDERS')"]]
  src/box-spider-kiste.png    Ebene „Ebene #174“ (MotiveGN 274, 15×20 px): die Holzkiste mit Netz-Fenster und Spinnfäden — liegt VOR der Spinne (die Spinne steckt hinter der Kiste).
  src/box-spider-koerper.png  Ebene „SPODDERS“ (MotiveGN 280), Ausschnitt 17×9 px an Kartenposition (30,29): die Körperspinne (Kopf/Hinterleib, rote Augen, Beine) — die obere Hälfte
                              steckt hinter der Kiste, SICHTBAR sind Gesicht und Beine unter dem Kistenboden und die Beinspitzen links/rechts neben der Kiste. In Runde 2 fehlte diese Spinne ganz
                              (der damalige Abgleich fand sie nicht, weil sie von der Kiste größtenteils verdeckt wird); die Ebene 148 („Ebene #242“) enthält dieselbe Spinne in einer anderen Pose
                              (Augen eine Zeile höher) — die Karte zeigt die Pose der Ebene 280.
  Zusammensetzung: Spinne zuerst, Kiste darüber (Sprite 17×22 px, Kartenversatz (30,16)); die Pixel stimmen exakt mit der Karte überein.

Aufruf:   python3 box_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/box-spider.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Karte = Sprite + (30, 16)):
* Spinnfäden (Zeilen 1–2, weiß): fünf Fäden, die aus der Kistenöffnung ragen. Netz-Fenster (Zeilen 3–9, x 3–13): weißes Gitter über dunklem Inneren. Fenstersturz (Zeile 10), Holzbretter (Zeilen 11–15),
  Boden (Zeile 16, x 3–13). Alles fest an der Kiste.
* Spinne hinter der Kiste: Gesicht in Zeile 17–18 (dunkles Band x 5–12): LINKES AUGE rot (173,1,0) bei (6,18); RECHTS ein MONOKEL: dunkler Ring (25,26,25) um zwei beige Glaspixel (207,197,146)/(172,164,120)
  bei (10,18)/(11,18) (Ring: (10,17),(11,17),(9,18),(12,18),(10,19),(11,19)). Das Monokel ist Glas → darf glänzen (Regel 14: Glas/Metall).
* Beine (schwarz (0,0,0) bzw. grau (31,32,30)/(40,41,39)/(65,66,64)): zehn sichtbare Beinenden — vier „obere“ Beinspitzen, die links/rechts neben der Kiste herausschauen ((1,15), (2,17), (14,17), (15,15); ihre
  Ansätze stecken hinter der Kiste) und sechs untere Beine unter dem Kistenboden: links (3,19)+(2,20), (4,20)+(4,21), (6,19)+(6,20), rechts (10,20), (12,20)+(12,21), (13,19)+(14,20).

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Spinnfäden wehen und der Schatten wandert zweimal durchs Netz-Fenster (unverändert aus Runde 2).
* Beine: Standphase — jedes Bein zuckt für sich (je Bein eigene Zeitpunkte, 3 Frames, Fußspitze ±1 px, bleibt am Ansatz angewachsen); Laufphasen (Frames 8–20, 24–36, 40–47): Tetrapod-Gang mit
  Periode 6 Frames, die beiden Beingruppen gegenphasig; in den Laufphasen schaukelt die Kiste samt Spinne mit (Rütteln wie in Runde 2: Frames 10–15, 26–31, 41–46 ±1 px waagerecht, dazu kleines Heben 1 px).
* Blinzeln: nur das rote Auge (Frames 19–20 und 43–44, Lid = dunkles Gesichtsgrau (31,32,30)); das Monokel blinzelt nicht (Regel 21).
* Glanz am Monokel (Glas): zweimal pro Schleife (Frames 5 und 29) blitzt ein kleiner Glitzerstern auf dem Glas auf: Mitte (weiß) → Kreuz → Kreuz mit 2-px-Armen → Kreuz → weg (5 Frames, dann lange Pause); das
  Glaspixel (10,18) bleibt dabei weiß. Glitzer nur am Glas (Regel 14/34), kein Lichtband auf dem Holz.
Ergänzungen: keine gemalten Pixel außer den Glitzersternen (Weiß (255,255,255) aus den Fäden der Quelle) — die Beinpositionen sind Verschiebungen vorhandener Beinpixel, die mit dem Ansatz 8-verbunden bleiben.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 5, 5

kiste_src = L.lade('box-spider-kiste')                  # 15×20, Kartenversatz (31,16) → Sprite (1,0)
koerper_src = L.lade('box-spider-koerper')              # 17×9, Kartenversatz (30,29) → Sprite (0,13)
spr = L.lade('box-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
K_OFF, S_OFF = (1, 0), (0, 13)
yy, xx = np.mgrid[0:sh, 0:sw]

KISTE = L.platz(kiste_src, sh, sw, K_OFF[0], K_OFF[1])
KOERPER = L.platz(koerper_src, sh, sw, S_OFF[0], S_OFF[1])
_komp = L.zusammen(sh, sw, [(KOERPER, 0, 0), (KISTE, 0, 0)])
assert (_komp == spr).all(), 'Zusammensetzung weicht von src/box-spider.png ab'

vor = L.deckend(spr)
kiste_vor = L.deckend(KISTE)
fadenmaske = kiste_vor & (yy <= 2)
kistenrest = KISTE.copy()
kistenrest[fadenmaske] = 0
WEISS = (255, 255, 255)
RAMPE = [(65, 61, 56), (58, 50, 44), (46, 40, 35), (25, 26, 25)]       # J → H → F → I
netz = kiste_vor & (yy >= 5) & (yy <= 9) & (xx >= 3) & (xx <= 11) & L.farbmaske(spr, RAMPE[:3])
RUETTELN = ((10, (1, -1, 1, -1, 1, 0)), (26, (-1, 1, -1, 1, 0, 0)), (41, (1, -1, 1, -1, 0, 0)))
HEBEN = (0, -1, 0, 0, -1, 0)                                           # 1 px Heben im Takt des Rüttelns
STRAENGE = [  # (Spitzenpixel, Perioden je Schleife, zulässige Verschiebungen)
    dict(tip=[(0, 1)], per=3, erlaubt=(0, 1)),
    dict(tip=[(4, 1)], per=4, erlaubt=(-1, 0, 1)),
    dict(tip=[(7, 1), (7, 0)], per=3, erlaubt=(-1, 0, 1)),
    dict(tip=[(10, 1)], per=5, erlaubt=(-1, 0, 1)),
    dict(tip=[(14, 1)], per=4, erlaubt=(-1, 0)),
]

# ── Beine (Sprite-Koordinaten): Spitze in Ruhe + Alternativen (jede 8-verbunden mit dem Ansatz) ─────────────────────────────────────────────────
#   ansatz = Pixel, an dem die Spitze angewachsen bleiben muss (steckt oft hinter der Kiste, dann nicht sichtbar); optionen[0] = Ruhelage
BEINE = {
    'UL':  dict(optionen=[(1, 15), (1, 14)], ansatz=(2, 14), gruppe=0),
    'LL1': dict(optionen=[(2, 17), (3, 17)], ansatz=(3, 16), gruppe=1),
    'LL2': dict(optionen=[(2, 20), (3, 20), (2, 19)], ansatz=(3, 19), gruppe=0),
    'LL3': dict(optionen=[(4, 21), (3, 21), (5, 21)], ansatz=(4, 20), gruppe=1),
    'LL4': dict(optionen=[(6, 20), (5, 20), (7, 20)], ansatz=(6, 19), gruppe=0),
    'R1':  dict(optionen=[(10, 20), (11, 20), (9, 20)], ansatz=(10, 19), gruppe=1),
    'R2':  dict(optionen=[(12, 21), (13, 21), (11, 21)], ansatz=(12, 20), gruppe=0),
    'R3':  dict(optionen=[(14, 20), (14, 19), (13, 20)], ansatz=(13, 19), gruppe=1),
    'UR':  dict(optionen=[(15, 15), (15, 14)], ansatz=(14, 14), gruppe=0),
    'LR2': dict(optionen=[(14, 17), (14, 16), (13, 17)], ansatz=(13, 16), gruppe=1),
}
for _n, _b in BEINE.items():
    _b['farbe'] = tuple(int(v) for v in spr[_b['optionen'][0][1], _b['optionen'][0][0], :3])
    assert vor[_b['optionen'][0][1], _b['optionen'][0][0]], _n
    for (_x, _y) in _b['optionen'][1:]:
        assert not vor[_y, _x], f'Beinoption {_n} {(_x, _y)} liegt auf einem Spritepixel'
        assert max(abs(_x - _b['ansatz'][0]), abs(_y - _b['ansatz'][1])) == 1, f'{_n}: {(_x, _y)} nicht 8-verbunden mit dem Ansatz'
LAUF = [(8, 20), (24, 36), (40, 48)]                                  # Laufphasen (Frames)
ZUCKEN = {n: [(s, 3) for s in ((7 * j + 3) % 48, (7 * j + 29) % 48)] for j, n in enumerate(BEINE)}      # Standphase: je Bein zwei Zuckphasen à 3 Frames
BEINMASKE = np.zeros((sh, sw), bool)
for _b in BEINE.values():
    BEINMASKE[_b['optionen'][0][1], _b['optionen'][0][0]] = True
# die zweiteiligen Beine (Ansatz + Spitze): der Ansatz-Pixel bleibt, nur die Spitze wandert (Ansatz ist ein eigener Pixel der Quelle oder steckt hinter der Kiste)

# ── Monokel: dunkler Ring um zwei Glaspixel ────────────────────────────────────────────────────────────────────────────────────────────────────
GLAS = [(10, 18), (11, 18)]
GLANZ_START = (5, 29)
GLANZ_FOLGE = (0, 1, 2, 1, 0)                                          # Mitte → Kreuz → Kreuz mit 2-px-Armen → Kreuz → Mitte
AUGE_ROT, AUGE_LID = (6, 18), (31, 32, 30)
BLINZELN = (19, 20, 43, 44)


def laufphase(i):
    for a, b in LAUF:
        if a <= i < b:
            return i - a
    return None


def bein_pose(name, i):
    b = BEINE[name]
    n = len(b['optionen'])
    lp = laufphase(i)
    if lp is not None:
        seq = (0, 1, 1, 0, 2, 2)
        k = seq[(lp + (3 if b['gruppe'] else 0)) % 6]
        return min(k, n - 1) if n < 3 else k
    for s, d in ZUCKEN[name]:
        if 0 <= (i - s) % N < d and (i - s) % N == (i - s):
            return 1 + ((s // 5) % (n - 1))
    return 0


def zustand(i):
    dx = dy = 0
    rue = False
    for s, muster in RUETTELN:
        if 0 <= i - s < len(muster):
            dx = muster[i - s]
            dy = HEBEN[i - s]
            rue = True
    sw_ = []
    for k, st in enumerate(STRAENGE):
        a = math.sin(2 * math.pi * st['per'] * i / N + 0.0)
        if rue:
            a = math.copysign(1.0, a if a else 1.0) * min(1.0, abs(a) * 1.6)
        v = int(round(a * 1.0))
        v = min(st['erlaubt'], key=lambda e: abs(e - v))
        sw_.append(v)
    schatten = None
    for s in (4, 28):
        if 0 <= i - s < 14:
            schatten = 2.0 + (i - s) * 0.95               # Mittelachse u = x + 0,5·(y−5), läuft von 2 bis ~14
    return dx, dy, sw_, schatten


def frame(i, nur=None, effekte=True):
    dx, dy, sw_, schatten = zustand(i)
    ox, oy = PAD_L + dx, PAD_T + dy
    # Spinne (hinter der Kiste): Körper ohne die beweglichen Beinspitzen, dann die Beine in ihrer Pose
    kp = KOERPER.copy()
    for name, b in BEINE.items():
        x0, y0 = b['optionen'][0]
        kp[y0 - 0, x0] = 0                                  # Ruhespitze entfernen (liegt im Sprite-Koordinatensystem; KOERPER ist bereits auf sh×sw platziert)
    for name, b in BEINE.items():
        x, y = b['optionen'][bein_pose(name, i)]
        kp[y, x, :3] = b['farbe']
        kp[y, x, 3] = 255
    # Blinzeln des roten Auges (das Monokel blinzelt nicht)
    if i in BLINZELN:
        kp[AUGE_ROT[1], AUGE_ROT[0], :3] = AUGE_LID
    spinne = L.platz(kp, H, W, PAD_L, PAD_T)
    # Kiste: Netz-Schatten
    k = L.platz(kistenrest, H, W, PAD_L, PAD_T)
    if schatten is not None:
        for y, x in zip(*np.nonzero(netz)):
            u = x + 0.5 * (y - 5)
            d = abs(u - schatten)
            stufe = 2 if d < 0.8 else (1 if d < 1.8 else 0)
            if stufe:
                c = tuple(int(v) for v in spr[y, x, :3])
                j = min(len(RAMPE) - 1, RAMPE.index(c) + stufe)
                k[PAD_T + y, PAD_L + x, :3] = RAMPE[j]
    f_ = L.leer(H, W)
    for (px, py) in [(int(x), int(y)) for y, x in zip(*np.nonzero(fadenmaske))]:
        schieb = 0
        for st, v in zip(STRAENGE, sw_):
            if (px, py) in st['tip']:
                schieb = v
        f_[PAD_T + py, PAD_L + px + schieb, :3] = WEISS
        f_[PAD_T + py, PAD_L + px + schieb, 3] = 255
    # Monokel-Glanz (Glitzerstern auf dem Glas) — liegt über allem
    stern = L.leer(H, W)
    if effekte:
        for s0 in GLANZ_START:
            kk = (i - s0) % N
            if kk < len(GLANZ_FOLGE):
                st = GLANZ_FOLGE[kk]
                cx, cy = PAD_L + GLAS[0][0], PAD_T + GLAS[0][1]
                F.stern(stern, cx, cy, st, WEISS, WEISS)
                if st >= 1:                                         # das zweite Glaspixel strahlt mit
                    stern[cy, cx + 1, :3] = WEISS
                    stern[cy, cx + 1, 3] = 255
    ebenen = {'spinne': spinne, 'kiste': k, 'faeden': f_}
    wahl = nur or ('spinne', 'kiste', 'faeden')
    # Kiste, Spinne und Fäden bewegen sich gemeinsam um (dx, dy); der Glanz sitzt auf dem Glas (bewegt sich mit)
    teile = [(ebenen[n], dx, dy) for n in wahl]
    if effekte:
        teile.append((stern, dx, dy))
    return L.zusammen(H, W, teile)


def zuschneiden(frames):
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = int(xs.min()) - 2, int(xs.max()) + 2, int(ys.min()) - 2, int(ys.max()) + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    assert (frames[0][PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all(), 'Frame 0 ist nicht das Original'
    frames = zuschneiden(frames)
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('box-spider', 'Box Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/box-spider-strip.png', frames, spalten=12, scale=8)
