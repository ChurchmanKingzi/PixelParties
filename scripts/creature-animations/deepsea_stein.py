# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Stein“ (Creature) — Runde 2: Hand/Arm verbunden, Blitz-Partikel.

Quelle: src/deepsea-stein.png — Ebene „Deepsea Stein“ (17×25 px, 274 Pixel, alle deckend, 15 Farben) aus MotiveDeepsea.xcf (Ebene 362). Gegen die Kartenkunst abgeglichen (data/card-art/native/Deepsea_Stein.png,
76×51; Ebene liegt bei (31, 18)): gleiche Form, Position und Größe; die Karte zeigt ihn im Gewitter — ein großer Blitz (Ebene 361, Farben (255,255,255), (227,243,255), (162,211,255)) schlägt von oben in den Kopf und kleine
Nebenblitze züngeln links, rechts und über ihm; die Nachbarebenen (355–364) enthalten keine Teile der Figur.
PICK: [["MotiveDeepsea", 362, 1]]

Aufruf:   python3 deepsea_stein.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-stein.png + .json

Nutzerfeedback (Runde 2, wörtlich): „die gehobene Hand ist teilweise vom Arm abgetrennt? Außerdem braucht er Blitz-Particles.“

Was ist was (x/y im Sprite):
* Ein kleines Frankenstein-Monster in Teal-Karo (51,93,119)/(77,137,154) mit schwarzem (0,0,0)/(0,8,24) Umriss: flacher Kopf mit schwarzem Haar und drei aufgestellten Haarspitzen (je zwei diagonale Pixel: (5,1)+(6,0), (9,1)+(10,0),
  (13,1)+(14,0); y 0–3), darunter die Stirn (y 4–6) mit drei Metallklammern (hellgrau (204,204,204) über (128,128,128) bei x 6, 9, 12, y 4–5), zwei schwarze 2×2-Augen bei (5–6, 7–8) und (9–10, 7–8), Schultern (y 9–12)
  mit zwei grauen Metallbolzen am Hals ((2–5, 10–11) und (12–14, 10–11)), der linke Arm ist nach oben angewinkelt: Oberarm = Schulter (x 1–5, y 10–11), Unterarm/Hand = 2 px breite Teal-Säule (x 1–2, y 8–10) mit
  Umriss (x 0 und x 3, Oberkante y 7); der rechte Arm hängt (x 13–16, y 14–19); Rumpf (y 12–22) mit dunklen Schattenpixeln und Gürtel (y 13/19), zwei Beine mit Metallstiefeln (grau (189,189,189)/(156,156,156), x 4–8 und 10–14, y 19–24).
Fest bleiben: Kopfform, Augen-/Klammerform im Ruhebild, Karomuster, Stiefel.

Korrekturen dieser Runde:
* Der erhobene linke Arm: früher wurde nur der Handblock (x 0–3, y 7–9) um ±1 px verschoben, die Säule darunter (1–2, 10) blieb stehen → die Hand riss vom Arm ab. Jetzt wird die Hand samt Umriss prozedural neu gezeichnet
  (`hand_pixel`): die Oberkante (Umriss) wandert um dy ∈ {−1, 0, +1}, die Teal-Säule darunter bis zur Schulter wird mit dem Karomuster (gerade/ungerade Zeile) verlängert bzw. verkürzt, der seitliche Umriss (x 0, x 3) läuft
  durch. Die Hand hängt in JEDER Pose über Kanten (4-verbunden) am Arm (Prüfung `verbunden4` je Frame: eine Komponente für Figur + Hand).
* Der Kopf wackelt nicht mehr seitlich (Regel 17) und der Körper zuckt nicht mehr seitlich (Regel 17/18).

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Atmen: alles oberhalb der Hüfte (Kopf, Arme, Rumpf) hebt sich 1 px (`L.streck_zeile` an Zeile 16 mit Texturmischung), die Beine bleiben am Boden; Periode 24, zweimal pro Schleife.
* Hand: der erhobene Unterarm hebt/senkt die Hand ±1 px (Periode 24: oben Frame 3–9 und 27–33, unten 15–21 und 39–45; Säule verlängert/verkürzt sich, siehe oben); der rechte hängende Arm pendelt 0…1 px nach außen (Periode 16).
* Blinzeln (Lid = Haut im Karomuster): die schwarzen Augen werden erst oben, dann ganz zu Haut; zweimal (Frame 11–13 und 35–37, jeweils im Moment des Blitzeinschlags — er zuckt die Augen zu).
* Beine heben abwechselnd 1 px (Füße, y 23–24, je 3 Frames, Periode 16).
* Metall glänzt (Regel 14: Klammern, Halsbolzen, Stiefel sind Metall): ein Lichtstreifen läuft über die drei Stirnklammern (unteres Pixel hellgrau, dann oberes Pixel weiß (255,255,255)), Frame 17–22 und 41–46.
* BLITZ-PARTIKEL (neu): kleine Zickzack-Blitze (2 px dicke, 4-verbundene Zacken aus Bitmaps `KOPF` 8×5 und `HAND` 6×4, 15–19 Pixel; weiß (255,255,255) mit hellblauen Kanten (229,245,250)/(179,216,249) — das sind die zur Blitz-Ebene
  der Karte (255,255,255), (227,243,255), (162,211,255) nächstliegenden Farben aus data/palette.json, in `L.pruefe(erlaubt=…)` freigegeben) schlagen in 4 Frames an (erste Hälfte → ganz → ganz → erlischt in der zweiten Hälfte),
  siebenmal je Schleife: zweimal von oben in die Haare (Frame 10–13 und 34–37; dabei richten sich die drei Haarspitzen um 1 px auf (schwarz (0,0,0)) und der Körper sackt 1 px zusammen (Zusammenzucken, Zeile 16 entfällt für 2 Frames),
  er blinzelt dazu), zweimal über der erhobenen Hand (Frame 4–7 und 28–31, wenn die Hand oben ist), zweimal rechts (Schulter Frame 24–27, neben dem Kopf Frame 41–44) und einmal als Überschlag zwischen den beiden Halsbolzen über
  die Brust (Frame 18–21; die Bolzenköpfe (3,10)/(14,10) leuchten dabei eine Stufe heller (189,189,189)). Nie mehr als zwei Blitze gleichzeitig, jeder Blitz ≥ 3 sichtbare Pixel, nie isolierte 1-px-Punkte.
Kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts.
Zuschnitt: Vereinigung aller Frames + 2 px Rand, waagerecht symmetrisch um die Ruhefigur. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_misc as M

N, MS = 48, 70
GPL, GPR, GPT, GPB = 9, 10, 10, 6

spr = L.lade('deepsea-stein')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 8, 24)
SCHWARZ = (0, 0, 0)
TL_, TD_ = (77, 137, 154), (51, 93, 119)
KL_HELL, KL_DUNKEL, WEISS = (204, 204, 204), (128, 128, 128), (255, 255, 255)
BOLZEN_HELL = (189, 189, 189)
BLITZ_W, BLITZ_A1, BLITZ_A2 = (255, 255, 255), (229, 245, 250), (179, 216, 249)     # Palettenfarben nahe der Blitz-Ebene der Karte
haut = lambda x, y: TL_ if (x + y) % 2 == 0 else TD_                   # Schachbrett der Haut
assert KONTUR in UMRISS

AUGEN = [(5, 7), (6, 7), (5, 8), (6, 8), (9, 7), (10, 7), (9, 8), (10, 8)]
assert all(col(x, y) == SCHWARZ for (x, y) in AUGEN)
KLAMMERN = [6, 9, 12]
assert all(col(x, 4) == KL_HELL and col(x, 5) == KL_DUNKEL for x in KLAMMERN)
SPITZEN = [(7, -1), (11, -1), (15, -1)]                            # Haarspitzen richten sich auf: je ein Pixel in der Verlängerung der Diagonale (5,1)-(6,0)

# Blitze als kleine Bitmaps (2 px dicke Zickzack-Zacken, 4-verbunden): 'W' weiß, 'a' (229,245,250), 'b' (179,216,249); x0/y0 = linke obere Ecke im Sprite-Koordinatensystem
KOPF = [
    "..Wb.",
    ".Wb..",
    "Wb...",
    ".WWb.",
    "...Wb",
    "..Wb.",
    ".Wb..",
    ".W...",
]
HAND = [
    "..Wb",
    ".Wb.",
    "WWWb",
    "..Wb",
    ".Wb.",
    ".W..",
]
BLITZE = {
    # Name: (x0, y0, Zeilen, Wachstumsrichtung)
    'kopf_a': (7, -6, KOPF, 1),                                     # von oben in die Haare; letztes Pixel (8, 1) liegt auf dem Haar (8, 2)
    'kopf_b': (9, -6, M.spiegel_x(KOPF), 1),                        # gespiegelt; letztes Pixel (12, 1) über dem Haar (12, 2)
    'hand_a': (-1, 0, M.spiegel_x(HAND), -1),                       # an der Hand nach oben (unterstes Pixel (1, 5) direkt über der Handkante (1, 6))
    'hand_b': (-1, 0, HAND, -1),                                    # zweite Variante (gespiegelt), unterstes Pixel (0, 5) über dem linken Handumriss
    'rechts_a': (14, 5, HAND, -1),                                  # vom rechten Halsbolzen (14, 10) nach rechts oben; unterstes Pixel (15, 10)
    'rechts_b': (14, 2, M.spiegel_y(HAND), 1),                      # rechts neben dem Kopf, wächst nach unten
    'bogen': None,                                                  # Überschlag über die Brust (Pfad, s. u.)
}
BOGEN = [(6, 10), (7, 10), (7, 11), (8, 11), (9, 11), (9, 10), (10, 10), (11, 10)]          # zwischen den Halsbolzen (liegt auf der Brust)
FARBEN = {'W': BLITZ_W, 'a': BLITZ_A1, 'b': BLITZ_A2}
# Ereignisse: (Start-Frame, Name) — jedes dauert 4 Frames
EREIGNISSE = [(4, 'hand_a'), (10, 'kopf_a'), (18, 'bogen'), (24, 'rechts_a'), (28, 'hand_b'), (34, 'kopf_b'), (41, 'rechts_b')]
KOPF_EREIGNISSE = [(10, 'kopf_a'), (34, 'kopf_b')]
SCHOCK = {f for s, _ in KOPF_EREIGNISSE for f in (s + 1, s + 2)}          # Zusammenzucken (Körper −1 px)
SPITZEN_FRAMES = {f for s, _ in KOPF_EREIGNISSE for f in (s + 1, s + 2, s + 3)}
BOGEN_FRAMES = {s + k for s, p in EREIGNISSE if p == 'bogen' for k in (1, 2)}

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {11: 1, 12: 2, 13: 1, 35: 1, 36: 2, 37: 1}                # 1 = obere Zeile zu, 2 = beide Zeilen zu
GLANZ = {}                                                         # Frame → (Klammer-Index, Stufe)
for s0 in (17, 41):
    for k in range(3):
        GLANZ[s0 + 2 * k] = (k, 1)                                 # unteres Pixel hell
        GLANZ[s0 + 2 * k + 1] = (k, 2)                             # oberes Pixel weiß, unteres hell
assert max(GLANZ) < N and 0 not in GLANZ

# Teile (Masken im Sprite)
HAND_BLOCK = vorhanden & (xx <= 3) & (yy >= 6) & (yy <= 9)         # Hand samt Umriss (Oberkante y 7, Haut y 8–9, Seitenumriss x 0 / x 3)
ARM_R = vorhanden & (xx >= 14) & (yy >= 14) & (yy <= 19)
FUSS_L = vorhanden & (xx <= 8) & (yy >= 23)
FUSS_R = vorhanden & (xx >= 10) & (yy >= 23)
rest = vorhanden & ~HAND_BLOCK & ~ARM_R & ~FUSS_L & ~FUSS_R


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


ARMR_A, FUSSL_A, FUSSR_A, REST_A = teil(ARM_R), teil(FUSS_L), teil(FUSS_R), teil(rest)


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def hand_pixel(dy):
    """Pixel der erhobenen linken Hand samt Umriss bei Versatz dy ∈ {−1, 0, +1} (Sprite-Koordinaten). Oberkante (Umriss) bei y 7 + dy, darunter die Haut im Karomuster bis Zeile 9 (Zeile 10 = Arm,
    bleibt stehen), seitlich Umriss x 0 und x 3. dy = 0 reproduziert das Original exakt."""
    yt = 7 + dy
    px = {(x, yt): KONTUR for x in (0, 1, 2)}
    for y in range(yt + 1, 10):
        px[(0, y)] = KONTUR
        px[(3, y)] = KONTUR
        px[(1, y)], px[(2, y)] = (TL_, TD_) if y % 2 == 0 else (TD_, TL_)           # Karomuster wie in Zeile 8/9 des Originals
    return px


# Kontrolle: dy = 0 ist das Original (nur x 0–3, y 6–9)
_orig = {(x, y): col(x, y) for y in range(6, 10) for x in range(4) if vorhanden[y, x]}
assert hand_pixel(0) == _orig, (hand_pixel(0), _orig)


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def hand_dy(i):
    return -int(round(sinz(i, 24)))                                  # −1 = Hand oben (Frame 3–9 und 27–33), +1 = Hand unten (15–21, 39–45); Frame 0 = Ruhe


def frame_gross(i, bolts=True):
    bl = BLINZ.get(i, 0)
    oben = REST_A.copy()
    if bl:
        for (x, y) in AUGEN:
            if bl == 2 or y == 7:
                set_px(oben, x, y, haut(x, y))
    g = GLANZ.get(i)
    if g is not None:
        x = KLAMMERN[g[0]]
        set_px(oben, x, 5, KL_HELL)
        if g[1] == 2:
            set_px(oben, x, 4, WEISS)
    if i in BOGEN_FRAMES:                                          # Halsbolzen leuchten beim Überschlag
        set_px(oben, 3, 10, BOLZEN_HELL)
        set_px(oben, 14, 10, BOLZEN_HELL)
    for (x, y), c in hand_pixel(hand_dy(i)).items():
        set_px(oben, x, y, c)
    if i in SPITZEN_FRAMES:
        for (x, y) in SPITZEN:
            set_px(oben, x, y, SCHWARZ)
    dxr = max(0, int(round(sinz(i, 16))))                            # rechter Arm: 0 oder 1 px nach außen
    oben = L.zusammen(H, W, [(oben, 0, 0), (ARMR_A, dxr, 0)])
    c = -1 if i in SCHOCK else U.stufe(i, 24, 1)                      # Atmen 0/1; Zusammenzucken −1
    if c:
        oben = L.streck_zeile(oben, GPT + 16, c)
    bl_ = 1 if (i % 16) in (3, 4, 5) else 0
    br_ = 1 if (i % 16) in (11, 12, 13) else 0
    koerper = L.zusammen(H, W, [(oben, 0, 0), (FUSSL_A, 0, -bl_), (FUSSR_A, 0, -br_)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if bolts:
        for s, name in EREIGNISSE:
            st = M.ereignis_stufe(i, s, N, 4)
            if name == 'bogen':
                M.blitz_zeichnen(koerper, GPL, GPT - c, BOGEN, st, BLITZ_W, BLITZ_A1)
            else:
                x0, y0, zeilen, ordnung = BLITZE[name]
                M.bitmap_blitz(koerper, GPL + x0, GPT - c + y0, zeilen, st, FARBEN, ordnung)
    return koerper


def frame_roh(i, nur=None):
    return frame_gross(i, bolts=(nur != 'koerper'))


def zuschneiden(frames, rand=2):
    """Union aller Frames + `rand` px, waagerecht symmetrisch um die Ruhefigur (Mitte x = GPL + sw/2)."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    mitte = GPL + (sw - 1) / 2.0
    br = max(mitte - xs.min(), xs.max() - mitte)
    x0, x1 = int(math.floor(mitte - br)) - rand, int(math.ceil(mitte + br)) + rand
    y0, y1 = int(ys.min()) - rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()), '→ Box', x0, y0, x1, y1)
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames], (x0, y0)


# Für randtest.py: Körper ohne Blitze
def frame(i, nur=None):
    return frame_gross(i, bolts=(nur != 'koerper'))


TEST_EBENEN = 'koerper'


if __name__ == '__main__':
    gross = [frame_gross(i) for i in range(N)]
    frames, (bx, by) = zuschneiden(gross)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=[WEISS, BLITZ_A1, BLITZ_A2])
    # Zusammenhang der Figur (ohne Blitze) in jedem Frame: genau eine 4-verbundene Komponente
    # (Ausnahme: die drei Haarspitzen sind schon im Original diagonale Einzelpixel (6,0), (10,0), (14,0) und ihre Verlängerungen (7,-1), (11,-1), (15,-1) — gewollter Zeichenstil)
    for i in range(N):
        m = frame_gross(i, bolts=False)[..., 3] > 0
        zus = M.komponenten4(m)
        gross_ = [k for k in zus if len(k) > 1]
        assert len(gross_) == 1, f'Frame {i}: Figur zerfällt in {len(gross_)} große Teile'
    print('Zusammenhang: in jedem Frame (ohne Blitze) bildet die Figur samt Hand genau 1 großes 4-verbundenes Teil; nur die Haarspitzen sind (wie im Original) diagonale Einzelpixel')
    L.speichern('deepsea-stein', 'Deepsea Stein', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-stein-strip.png', [frames[k] for k in (0, 5, 8, 12, 14, 20, 27, 34)], spalten=4, scale=8)
