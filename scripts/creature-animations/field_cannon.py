# -*- coding: utf-8 -*-
"""Idle-Animation für „Field Cannon“ (Creature).

Quelle: src/field-cannon.png — Ebene „Ebene #48“ (21×48 px, 625 Pixel, alle deckend, 25 Farben) aus MotiveDeri.xcf (Ebene 170; der Treffer-Suchlauf führt sie als zwei „Figuren“, direkt aus dem Dump genommen).
Gegen die Kartenkunst abgeglichen (data/card-art/native/Field_Cannon.png, 96×65; die Ebene liegt bei (24, 27), Korrelation 0,9995): gleiche Form, Position und Größe.
PICK: [["MotiveDeri", 170, 1]]

Aufruf:   python3 field_cannon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/field-cannon.png + .json

Was ist was (x/y im Sprite):
* Rechts die KANONE (x 13–47, y 1–20): ein schwarz-grauer Eisenlauf (26,26,26)/(46,46,46)/(61,61,61)/(92,92,92) mit Rautenmuster oben rechts, dessen Mündung nach rechts zeigt (Lauf liegt leicht schräg, Heck links tiefer),
  davor ein braunes Rad (130,84,44)/(107,69,36)/(168,109,57) mit grauer Nabe (x 27–37, y 10–20).
* Am Heck links (x 14–19, y 3–13) sitzt die LUNTE: eine dünne dunkle Schnur (15,8)–(18,13), die oben brennt: eine kleine gelbe Flamme (255,255,0) mit hellem Kern (255,255,203) bei (14–16, 3–7) (Feuer, Regel 15).
* Links daneben steht ein eigenes Gerät (x 0–10, y 0–19, nicht mit der Kanone verbunden): oben ein runder grauer Kopf (x 1–9, y 1–8) mit „n“-Bogen, darunter ein schwarz-weißer Zickzack-Schaft — ich lese es als Ladestock/Wischer
  (Sponge/Rammer) der Kanone; es ist Zubehör, kein Lebewesen.
Fest bleiben: Rad, Lauf-Rumpf (x 18–38), Schaftform des Wischers, Lunten-Form (starr als Ganzes).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Flamme ausgenommen) — Runde 3 (Rückmeldung: „sollte sich ALS GANZES neigen/bewegen, nicht nur vorne das Kanonenrohr wie aus Gummi; die Lunte soll nicht wackeln, nur brennen“):
* Rohr kippt STARR um die Achse (Periode 48, einmal pro Schleife): das ganze Rohr samt Heck und Lunte wird als gerade Linie geschert (jede Spalte wandert als Ganzes um round(a·(x−28)/19) Zeilen; a = Weg der Mündung,
  bis +2 px hoch, bis −1 px runter); das Heck sinkt dabei entsprechend, das Rad (Achse) steht. Nichts wird gedehnt oder kopiert, die Kontur bleibt 1 px dick (Randpixel in Nicht-Umrissfarbe werden auf die Umrissfarbe (26,26,26) gesetzt, nichts angebaut).
* Die ganze Kanone (Rohr, Rad, Lunte, Flamme) rollt zusätzlich als starres Stück um 1 px zurück, wenn die Mündung steigt, und wieder vor, wenn sie sinkt (Rad = Kreis, die Drehung ist unsichtbar).
* Lunte: starr am Heck (sie geht nur mit dem Rohr mit, kein eigenes Wippen mehr), die Flamme darauf wird von Hand gezeichnet (Regel 15/40): 10 Posen (hoch, niedrig, nach links/rechts geneigt, breit, schlank, Spitze flackert),
  2–3 Frames je Pose, ungleichmäßig; reißt die Spitze beim Wechsel auf eine niedrigere Pose ab, steigt sie als einzelner gelber Funke 4 Frames auf (Pose 0 = die Original-Flamme). Nur die zwei Gelbtöne des Sprites.
* Der Wischer nickt (unverändert): der Kopf (y 0–8) schiebt sich als Block 1 px nach links/rechts (Periode 24, zweimal pro Schleife), der Schaft steht.
* Glanz auf dem Eisenrohr (Regel 14: Metall, unverändert): ein Lichtband läuft diagonal über das Rohr (zweimal pro Schleife, Start Frame 4 und 28, 14 Frames, zwei Stufen heller auf der Grau-Rampe), nur Innenpixel; Rad und Wischer glänzen nicht.
Keine zusätzlichen Partikel (nur die zur Flamme gehörenden Funken). Randpixel-Test (Regel 16): `B.umriss_je_ebene` (Rohr, Rad, Lunte) und `U.kontur_schliessen` (Wischer); die Flammenränder sind die Randfarbe Gelb der Quelle.
ERGÄNZUNG: (1) die neu gezeichnete Flamme (Farben der Quelle); (2) verdecktes Rohr hinter dem Rad (FUELL, Koordinaten x 27–38, y 10–17, nur dort, wo das Rad Rohr verdeckt): links der Mitte (x ≤ 31) das Schachbrett (46,46,46)/(61,61,61), rechts die Farbe des nächsten sichtbaren Rohrpixels rechts des Rades, die Unterkante (Umrissfarbe (26,26,26)) läuft von (27, 17) nach (38, 15) — sie wird nur sichtbar, wenn das Rohr kippt und an den Radecken Rohr hervorschaut.
Zuschnitt: der Frame ist auf die Figur (samt Flamme und abgerissenen Funken) zugeschnitten, symmetrisch um die Ruhefigur; die Funken vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_flieger_b as B

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 7, 10, 5

spr = L.lade('field-cannon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 0, 0)
GELB, HELL = (255, 255, 0), (255, 255, 203)
assert KONTUR in UMRISS

flamme_alt = np.array([[bool(vorhanden[y, x]) and col(x, y) in (GELB, HELL) for x in range(sw)] for y in range(sh)])
assert flamme_alt.sum() == 8
wischer = vorhanden & (xx <= 10)
wischer_kopf = wischer & (yy <= 8)
wischer_schaft = wischer & (yy >= 9)
kanone = vorhanden & (xx >= 11) & ~flamme_alt
heck = kanone & (xx <= 26)
mitte = kanone & (xx >= 27) & (xx <= 38)
front = kanone & (xx >= 39)
assert (wischer | kanone | flamme_alt).sum() == vorhanden.sum() and not (wischer & kanone).any()

# --- Flamme an der Lunte: von Hand gezeichnet (Regel 15/40). Der Sprite kennt nur Gelb (255,255,0) und helles Gelb (255,255,203); die Original-Flamme (Frame 0) ist ein 3 px breites, ~5 px hohes Züngelchen. ---
# Jede Pose: Zeilen von oben nach unten, 5 Spalten = x 13…17 (Mitte x 15 = Lunte), letzte Zeile = y 7 (direkt über der Lunte, y 8). R = Gelb, X = helles Gelb (Kern).
FL_POSEN = [
    ["...R.", "..R..", ".RXR.", "..XR.", "..R.."],                              # 0 Original-Ruhepose
    ["..R..", "..R..", ".RXR.", ".RXR.", "..XR.", "..R.."],                     # 1 hoch
    ["...R.", "..RR.", ".RXR.", ".RXR.", "..R.."],                               # 2 nach rechts geneigt
    ["..R..", ".RXR.", ".RXR.", "..R.."],                                        # 3 niedrig
    [".R...", ".RR..", ".RXR.", ".RXR.", "..XR.", "..R.."],                     # 4 nach links geneigt, hoch
    ["..R..", ".RXR.", "RRXRR", ".RXR.", "..R.."],                               # 5 breit
    ["..R..", "..R..", "..RR.", ".RXR.", "..XR.", "..R.."],                     # 6 schlank, hoch
    ["...R.", "...R.", "..RR.", ".RXR.", "..XR.", "..R.."],                     # 7 Spitze flackert nach rechts
    ["..R..", ".RRR.", ".RXR.", "..XR.", "..R.."],                               # 8 mittel
    [".R...", ".RR..", ".RXR.", "..XR.", "..R.."],                               # 9 Spitze flackert nach links
]
# Ablauf: (Pose, Frames) — 48 Frames, Frame 0 = Original; ungleichmäßige Haltedauer 2–3, nie zweimal dieselbe Pose hintereinander
FL_ABLAUF = [(0, 3), (3, 2), (2, 2), (1, 3), (5, 2), (8, 2), (4, 3), (6, 2), (3, 2), (7, 3), (9, 2), (2, 2), (5, 3), (1, 2), (8, 2), (9, 3), (6, 2), (3, 2), (4, 3), (0, 3)]
FL_FRAME = [p for p, d in FL_ABLAUF for _ in range(d)][:N]
while len(FL_FRAME) < N:
    FL_FRAME.append(0)
assert len(FL_FRAME) == N and FL_FRAME[0] == 0
FL_Y7 = 7


def flamme_ebene(i):
    """Flamme in Leinwandkoordinaten (ohne Lunten-Versatz): Pose des Frames."""
    e = L.leer(H, W)
    pose = FL_POSEN[FL_FRAME[i]]
    y0 = FL_Y7 - (len(pose) - 1)
    for k, zeile in enumerate(pose):
        for j, c in enumerate(zeile):
            if c in 'RX':
                e[GPT + y0 + k, GPL + 13 + j, :3] = GELB if c == 'R' else HELL
                e[GPT + y0 + k, GPL + 13 + j, 3] = 255
    return e


# Funken: reißt die Spitze beim Wechsel von einer hohen auf eine niedrigere Pose ab, steigt sie als einzelner gelber Funke 4 Frames auf (Feuerfunken: 1 px erlaubt)
def spitze(pose_nr):
    pose = FL_POSEN[pose_nr]
    y0 = FL_Y7 - (len(pose) - 1)
    return 13 + pose[0].index('R'), y0


FUNKEN = []
for _i in range(N):
    _a, _b = FL_FRAME[_i - 1], FL_FRAME[_i]
    if _a != _b and len(FL_POSEN[_a]) - len(FL_POSEN[_b]) >= 1 and len(FL_POSEN[_a]) >= 6 and N - 5 >= _i >= 1:
        FUNKEN.append((_i,) + spitze(_a))


def funken_ebene(i, dy=0):
    e = L.leer(H, W)
    for (f, x, y) in FUNKEN:
        a = (i - f) % N
        if a < 4:
            e[GPT + y - 1 - a + dy, GPL + x + (1 if (x + f) % 2 else -1) * (a // 2), :3] = GELB
            e[GPT + y - 1 - a + dy, GPL + x + (1 if (x + f) % 2 else -1) * (a // 2), 3] = 255
    return e


# --- Glanz auf dem Lauf (Eisen) ---
LAUF = kanone & (xx >= 18) & ~((xx >= 27) & (xx <= 37) & (yy >= 10)) & ~U.kanten(spr)     # ohne Lunte, ohne das Rad und ohne die Umrisspixel am Rand (sonst verliert der Umriss Kontrast)
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if LAUF[y, x] and col(x, y)[0] == col(x, y)[1] == col(x, y)[2]}, key=lambda c: sum(c))
RAMPE_B = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


# --- Teile der Kanone: Rad (steht, es ist die Achse), Lunte (starr am Heck), Rohr (kippt als Ganzes um die Achse) ---
BRAUN = {(130, 84, 44), (107, 69, 36), (168, 109, 57), (112, 72, 38)}
NABE = {(87, 87, 87), (122, 122, 122), (159, 159, 159)}
RAD_M = kanone & (xx >= 27) & (xx <= 38) & (yy >= 10) & np.array([[col(x, y) in BRAUN or col(x, y) in NABE if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)])
LUNTE_PX = [(15, 8), (16, 9), (16, 10), (17, 11)]
LUNTE_M = np.zeros((sh, sw), bool)
for (_x, _y) in LUNTE_PX:
    LUNTE_M[_y, _x] = True
assert (vorhanden & LUNTE_M).sum() == 4 and all(col(x, y) == (26, 26, 26) for (x, y) in LUNTE_PX)
ROHR_M = kanone & ~RAD_M & ~LUNTE_M
BARREL_B, BARREL_A, BARREL_D = (26, 26, 26), (61, 61, 61), (46, 46, 46)

# Ergänzung (verdeckt): Das Rad verdeckt einen Teil des Rohrs. Kippt das Rohr um die Achse, schauen an den Radecken Rohrpixel hervor — sie werden hier fertiggezeichnet:
# links der Mitte das Schachbrett aus (46,46,46)/(61,61,61) wie im sichtbaren Teil davor, rechts der Mitte die Farbe des nächsten sichtbaren Rohrpixels rechts vom Rad; die Unterkante
# des Rohrs liegt hinter dem Rad auf y = 17 (x ≤ 28) und steigt zu (38, 15) an, dort Umrissfarbe (26,26,26).
FUELL = []
for _y in range(10, 18):
    for _x in range(27, 39):
        if not RAD_M[_y, _x]:
            continue
        yb = 17 - int(math.floor((_x - 26) / 6.0 + 0.5))
        if _y > yb:
            continue
        if _y == yb:
            c = BARREL_B
        elif _x <= 31:
            c = BARREL_D if (_x + _y) % 2 == 1 else BARREL_A
        else:
            c = next((col(q, _y) for q in range(_x + 1, sw) if vorhanden[_y, q] and not RAD_M[_y, q]), BARREL_A)
        FUELL.append((_x, _y, c))
ROHR_SP = np.where(ROHR_M[..., None], spr, 0).astype(np.uint8)
for (_x, _y, _c) in FUELL:
    ROHR_SP[_y, _x, :3] = _c
    ROHR_SP[_y, _x, 3] = 255
FUELL_M = np.zeros((sh, sw), bool)
for (_x, _y, _c) in FUELL:
    FUELL_M[_y, _x] = True

KOPF_A, SCHAFT_A = teil(wischer_kopf), teil(wischer_schaft)
RAD_A, LUNTE_A = teil(RAD_M), teil(LUNTE_M)
ROHR_A = L.platz(ROHR_SP, H, W, GPL, GPT)

# Randfarben der Kanone (Quelle), für die Randpixel-Reparatur der Rohrkante nach dem Kippen
KAN_RAND = {col(x, y) for y, x in zip(*np.nonzero(U.kanten(spr))) if kanone[y, x]}
XP = GPL + 28                                                # Drehachse (Mitte des Rades, x der Nabe ≈ 32; 28 = Rohr hinter dem Rad, so bleibt das Heck ruhiger)
MUND_X = GPL + 47                                            # Mündung (Abstand zur Achse 19 px)


def neigung_dy(x, a):
    """Senkrechter Versatz (Leinwandzeile, positiv = abwärts) der Rohrspalte x, wenn die Mündung um `a` px steigt (a < 0: sinkt). Starre Scherung um die Achse: eine gerade Linie bleibt gerade."""
    v = -a * (x - XP) / float(MUND_X - XP)
    return int(math.copysign(math.floor(abs(v) + 0.5), v))


def kippen(a, dy_fn):
    """Jede Spalte wandert als Ganzes um dy_fn(x) (starr, keine Spalte wird kopiert oder gedehnt)."""
    out = L.leer(*a.shape[:2])
    for x in range(a.shape[1]):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = dy_fn(x)
        if ys.min() + dy < 0 or ys.max() + dy >= a.shape[0]:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def muendung(i):
    """Neigung des Rohrs (Mündung relativ zur Ruhe in px, positiv = hoch): langsam, eine Periode pro Schleife; nach oben bis 2 px, nach unten bis 1 px."""
    s = sinz(i, 48)
    return 2.0 * s if s > 0 else 1.0 * s


def frame_gross(i, nur=None):
    a = muendung(i)
    dy_l = neigung_dy(GPL + 18, a)                                  # Lunte sitzt starr am Heck (Rohrspalte x = 18)
    ro = ROHR_A.copy()
    # Lichtband über das Rohr (Eisen; zwei Stufen heller auf der Grau-Rampe), vor dem Kippen in Quellkoordinaten
    for start in (4, 28):
        j = i - start
        if 0 <= j <= 13:
            d = 24 + 3 * j
            for y in range(sh):
                for x in range(sw):
                    if LAUF[y, x] and not FUELL_M[y, x] and d <= x + y < d + 4 and col(x, y) in RAMPE_B:
                        ro[GPT + y, GPL + x, :3] = RAMPE_B[col(x, y)]
    ro = kippen(ro, lambda x: neigung_dy(x, a))
    lu = L.versetze(LUNTE_A, 0, dy_l)
    # Kanone: Rohr unten, Rad (Achse, steht) darüber, Lunte
    umriss_nr = {1: BARREL_B, 2: (107, 69, 36), 3: BARREL_B}
    kan, karte = B.zusammen_mit_karte(H, W, [(ro, 0, 0, 1), (RAD_A, 0, 0, 2), (lu, 0, 0, 3)])
    B.umriss_je_ebene(kan, karte, UMRISS, umriss_nr)
    kopf = L.versetze(KOPF_A, int(round(sinz(i, 24))), 0)
    geraet = L.zusammen(H, W, [(SCHAFT_A, 0, 0), (kopf, 0, 0)])
    geraet = U.kontur_schliessen(geraet, UMRISS, KONTUR)
    fl = L.versetze(flamme_ebene(i), 0, dy_l)
    funken = funken_ebene(i, dy_l)
    # Die ganze Kanone (Rohr, Rad, Lunte, Flamme) rollt als starres Stück 1 px zurück, wenn die Mündung steigt, und wieder vor, wenn sie sinkt (das Rad dreht sich dabei unsichtbar: Rad = Kreis)
    rs = 1.2 * sinz(i, 48, -0.3)
    rx = -int(math.copysign(math.floor(abs(rs) + 0.5), rs))
    return L.zusammen(H, W, [(geraet, 0, 0), (kan, rx, 0), (fl, rx, 0), (funken, rx, 0)])


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur (Funken dürfen den Frame höchstens 2 px vergrößern; sie gehören zur Flamme)
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('field-cannon', 'Field Cannon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/field-cannon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
