# -*- coding: utf-8 -*-
"""Idle-Animation für „Winged Skeleton“ (Creature) — Skelett-Flügelschlag, Arme getrennt (dritte Fassung).

PICK: [["Motive", 297, 1]]
Quelle: src/winged-skeleton.png — Ebene „Winged Skele“ (20×24 px, 17 Farben) aus Motive.xcf, Figur 1.

Aufruf:   python3 winged_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/winged-skeleton.png + .json

Identifikation (x, y; Figur ist spiegelsymmetrisch um x = 9,5, Spiegel x ↔ 19 − x; Angaben für die linke Seite):
* Schädel (x 5–14, y 3–9): weiße Kappe, schräge dunkle Augenhöhlen (7–8, 6–8) / (11–12, 6–8), brauner Oberrand (7–12, 3).
* Hörner/Krallen OBEN (x 3–7, y 0–4): dunkelgrau umrandete, gebogene Knochenspitzen — gehören FEST zum Schädel.
* Rippenkorb (y 10–14) mit schwarzen Lücken, Becken (y 15–18), Beine (y 19–23), tan Zehen (5–6, 22).
* ARM (vorn, braun umrandet, mit Binden): ein schräges Rohr von der Schulter (4, 10–12) nach unten-außen — Außenkante braun (3,10) (2,11) (2,12) (1,13) (1,14),
  Innenkante braun (4,10) (4,12) (3,13) (3,14), Knochen weiß/grau dazwischen ((3,11), (3,12), (2,13), (2,14)) — und die HAND (x 0–4, y 15–18):
  brauner Wulst (Manschette) mit tan Fingern (1–2, 15) (1–2, 16) (2–3, 17), Manschettenrand (0,15) (0,16) (4,16) (4,17) (1,17) (2,18) (3,18).
* FLÜGEL (hinten, grau/weiß, ohne braunen Umriss): senkrechte Knochenstreben hinter dem Arm, y 3–19: graue Außenkante x = 1 (y 6–12, am Arm vorbei, unten wieder
  sichtbar als Spitze (1,18) (1,19)), weißer Knochen x = 2 (y 6–10; oben graue Spitze (2,3–5)), grauer Schatten x = 3 (y 7–9) und innerer weißer
  Knochen x = 4 (y 7–9) neben dem Schädel. Hinter dem Arm/der Hand sind die Streben verdeckt (Beleg: die graue Kante x = 1 verschwindet hinter dem
  Arm (y 13–17) und taucht unter der Hand bei (1,18) wieder auf). Der Flügel entspringt am Rücken, hinter dem Schädel/Schulterblatt.
* Schulterstück am Körper: (4,5) dunkler Umriss und (4,10) (4,11) (4,12) (braun/weiß) bleiben am Körper (Schulter, Anschluss des Arms).

Ablauf (48 Frames à 65 ms = 3,12 s):
* FLÜGEL: nur Knochen (keine Haut, keine Hand, kein Wulst, keine tan Spitzen): schlagen zweimal pro Schleife (großer Schlag, dann kleiner Schlag); 12 Schlüsselposen
  (Posenblatt im Check-Bild: gefaltet = Original, lüften, fächern, halb offen, weit offen oben, Spitzen knicken, Abschlag Mitte, Abschlag unten, Rückholen,
  anklappen, kleiner Schlag Mitte/unten), dazwischen weicher Spline. Ein Armknochen läuft vom Rücken (hinter dem Schädel/Schulterblatt, vom Körper
  verdeckt) zum Gelenk des FLÜGELS (oben außen), dort sitzt ein 3×3-Gelenkknubbel; vier Fingerknochen fächern vom Gelenk auf (mit Knick, Spitzen hinken
  nach, flattern). Dazwischen ist Freiraum. Knochen: weißer Kern (246,255,255) mit grauer Kante (156,156,156) im ersten Stück und am ganzen Armknochen, danach
  graue Linien (4-verbunden, Stufenlinien); die Spitzen enden frei. Der Flügel liegt hinter Körper und Armen; der rechte schlägt ~1 Frame später als der linke.
* ARME (unabhängig von den Flügeln, eigene Perioden): hängen an der Schulter und pendeln leicht aus (linker Arm Periode 16 Frames, rechter 24 Frames,
  Hand schwingt bis 2 px nach außen / 1 px nach innen, Ansatz an der Schulter steht); die Hände zucken (Faust hebt sich 1 px, Fingerspitzen werden dunkler):
  links ab Frame 7 und 31, rechts ab Frame 18 und 41.
* Rippenkorb atmet zweistufig bis 2 px (Zeile 13, dann zusätzlich Zeile 14 verdoppelt; Gipfel bei Frame 13 und 37); Schädel samt Hörnern hebt sich
  starr mit, Arme (Schulter) und Flügelwurzeln heben sich mit, die Füße und Hände bleiben am Boden.
* Kein Glanz/Glitzer: Knochen sind kein Metall. Knochenstaub: runde, langsame Partikel ('k', 'o', 'm') steigen vom Boden auf.

Ergänzungen / Neugezeichnetes (nur Farben des Sprites):
* Verdecktes Flügelstück hinter dem Arm (in Ruhe vom Arm verdeckt, sichtbar sobald der Arm ausschwingt), siehe SUPP: (1,13)–(1,17) = (156,156,156);
  (2,11)–(2,14) = (246,255,255); (2,15)–(2,17) = (189,189,189); (3,10)–(3,14) = (156,156,156) (und gespiegelt x ↔ 19 − x).
* Alle Flügelposen außer der gefalteten sind neu gezeichnet: Armknochen, Fingerknochen und Gelenkknubbel nur in (246,255,255) und (156,156,156) (beide im Sprite);
  die Knochen beginnen bei Frame 4 aus den Quellspalten x = 1, 2, 2, 3 des gefalteten Flügels (roh → sauber pixelweise gedithert).
* Randpixel-Test (Regel 16): jedes Randpixel eines Frames hat eine Umrissfarbe der Quelle ((32,32,32), (49,24,0), (156,156,156)); wo ein bewegtes Teil eine
  andere Farbe an den Rand bringt, wird sie in `frame()` per `B.umriss_schliessen` zur nächsten Umrissfarbe (hell → grau, dunkel/braun → braun); bei den Knochenflügeln greift das nur noch in den Übergangsframes (0–13 Pixel).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 15, 15, 10, 3

spr = L.lade('winged-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
assert (vorhanden == vorhanden[:, ::-1]).all()

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
Q, P, Nn, Lg = (246, 255, 255), (213, 213, 213), (189, 189, 189), (156, 156, 156)
BR_D, BR_J, BR_M = (49, 24, 0), (150, 119, 88), (212, 178, 150)
DG = (32, 32, 32)
UMRISS = {DG, BR_D, Lg}                                    # Umrissfarben der Quelle (Randpixel-Test)

# ── Masken (linke Seite, rechts = gespiegelt): ARM (vorn), FLÜGEL (hinten), Rest = Körper (inkl. Hörner, Schulterstück) ──────
ARM_PTS = [(3, 10), (3, 11), (3, 12), (2, 11), (2, 12), (1, 13), (2, 13), (3, 13), (1, 14), (2, 14), (3, 14), (2, 18), (3, 18)]
arm_l = np.zeros_like(vorhanden)
for (x, y) in ARM_PTS:
    arm_l[y, x] = True
arm_l |= vorhanden & (yy >= 15) & (yy <= 17) & (xx <= 4)                       # Hand
KOERPER_BEHALT = [(4, 5), (4, 10), (4, 11), (4, 12)]                           # Schulterstück bleibt am Körper
strebe_l = vorhanden & (((yy >= 3) & (yy <= 4) & (xx <= 2)) | ((yy >= 5) & (yy <= 14) & (xx <= 4)) | ((yy >= 18) & (yy <= 19) & (xx <= 3)))
for (x, y) in KOERPER_BEHALT:
    strebe_l[y, x] = False
wing_l = strebe_l & ~arm_l
arm_r, wing_r = arm_l[:, ::-1] & vorhanden, wing_l[:, ::-1] & vorhanden
assert not (arm_l & wing_l).any() and not (arm_r & wing_r).any() and not (arm_l & arm_r).any() and not (wing_l & wing_r).any()
koerper = vorhanden & ~arm_l & ~arm_r & ~wing_l & ~wing_r
assert int((koerper | arm_l | arm_r | wing_l | wing_r).sum()) == int(vorhanden.sum())

# ── Verdecktes Flügelstück hinter dem Arm (Regel 2): in Ruhe vom Arm überdeckt, sichtbar wenn der Arm ausschwingt ─────────────
SUPP = {}
for y in range(13, 18):
    SUPP[(1, y)] = Lg
for y in range(11, 15):
    SUPP[(2, y)] = Q
for y in range(15, 18):
    SUPP[(2, y)] = Nn
for y in range(10, 15):
    SUPP[(3, y)] = Lg
spr_w = spr.copy()                                                             # Flügelquelle: Original + Ergänzung
supp_l = np.zeros_like(vorhanden)
for (x, y), c in SUPP.items():
    for xs_ in (x, 19 - x):
        spr_w[y, xs_, :3] = c
        spr_w[y, xs_, 3] = 255
    supp_l[y, x] = True
supp_r = supp_l[:, ::-1].copy()
# jede Ergänzung liegt im Ruhebild unter dem Arm/der Hand (Frame 0 bleibt Original)
_unter_arm = all(arm_l[y, x] for (x, y) in SUPP)
assert _unter_arm, 'Ergänzung läge sichtbar neben dem Arm'


def ebene(quelle, maske):
    return F.ebene(quelle, maske, H, W, PAD_L, PAD_T)


BODY = ebene(spr, koerper)
ARM_L0, ARM_R0 = ebene(spr, arm_l), ebene(spr, arm_r)
WING_L0, WING_R0 = ebene(spr_w, wing_l | supp_l), ebene(spr_w, wing_r | supp_r)

PAL = dict(knochen=[Q], schatten=Lg)               # Flügel nur aus Knochen: weißer Kern, graue Kante (156,156,156)
SPALTEN = [1, 2, 2, 3]            # Quellspalten der vier Fingerknochen (links; Leitfinger = Außenkante x = 1)


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Schlüsselposen (linker Flügel, Sprite-Koordinaten; Winkel in Grad: 90° = unten, 180° = links, 270° = oben) ──────────────
def pose(S, Wr, ang, ln, knick, rho=0.0, rein=1.0, knubbel=1.0):
    return dict(S=S, W=Wr, ang=list(ang), len=list(ln), knick=knick, rho=rho, rein=rein, knubbel=knubbel)


S0 = (6.5, 8.5)                                           # Ansatz am Rücken, hinter dem Schädel/Schulterblatt (vom Körper verdeckt)
POSEN = {
    'ruhe':    pose(S0, (3, 6),     (90, 90, 90, 90),        (13, 12, 12, 12),        0, rho=1.0, rein=0.0, knubbel=0.0),
    'lueften': pose(S0, (3, 5.5),   (100, 94, 88, 82),       (13, 12, 12, 12),        0, rho=0.8, rein=0.15, knubbel=0.0),
    'luft2':   pose(S0, (2.5, 5),   (118, 106, 94, 84),      (13, 12, 12, 11.5),      4, rho=0.5, rein=0.6, knubbel=0.0),
    'halb':    pose(S0, (1, 4.5),   (168, 144, 120, 97),     (12.5, 12, 12, 11),     10, rho=0.1),
    'weit':    pose(S0, (-1, 2.5),  (222, 190, 160, 128),    (12.5, 12, 11, 10),     14),
    'weit2':   pose(S0, (-1.5, 2), (228, 194, 162, 130),     (12.5, 12, 11, 10),     18),
    'mitte':   pose(S0, (-1, 4.5),  (198, 168, 142, 114),    (12, 11.5, 10.5, 9.5),  18),
    'unten':   pose(S0, (-1, 7),    (150, 124, 102, 84),     (11.5, 11.5, 10.5, 9),  22),
}
REST_VEC = B.pose_vektor(POSEN['ruhe'])


def _v(name):
    return B.pose_vektor(POSEN[name])


def _mix(a, b, t):
    return B.pose_vektor(B.pose_mix(POSEN[a], POSEN[b], t))


# Zeitleiste: (Frame, Vektor, Halt). Großer Schlag 0–28, kleiner Schlag 30–45.
SCHLUESSEL = [
    (0, _v('ruhe'), True), (2, _v('ruhe'), True),
    (4, _v('lueften'), False), (6, _v('luft2'), False), (8, _v('halb'), False), (11, _v('weit'), False), (13.5, _v('weit2'), False),
    (16, _v('mitte'), False), (18.5, _v('unten'), False), (21.5, _v('halb'), False), (24, _v('luft2'), False), (26, _v('lueften'), False),
    (28, _v('ruhe'), True), (29.5, _v('ruhe'), True),
    (32, _v('lueften'), False), (34, _v('halb'), False), (36.5, _mix('halb', 'mitte', 0.7), False), (39, _mix('halb', 'unten', 0.75), False),
    (41.5, _v('luft2'), False), (43, _v('lueften'), False), (44.5, _v('ruhe'), True),
]
FINGER_LAG = 0.4                  # Frames, um die jeder weiter außen liegende Finger der Wurzel hinterherhinkt (Wellenlauf)
RECHTS_LAG = 1.0                  # der rechte Flügel schlägt 1 Frame später als der linke


def pose_zu(t, finger_phase=0.0):
    """Flügelpose zur Zeit t (Frames). Finger k hinkt um FINGER_LAG·k hinterher, kleines Flattern der Spitzen (je Finger andere Phase)."""
    basis = B.vektor_pose(B.spline(SCHLUESSEL, t, N), POSEN['ruhe'])
    for k in range(4):
        v = B.vektor_pose(B.spline(SCHLUESSEL, t - FINGER_LAG * k, N), POSEN['ruhe'])
        basis['ang'][k] = v['ang'][k]
    basis['rho'] = min(1.0, max(0.0, basis['rho']))
    basis['rein'] = min(1.0, max(0.0, basis['rein']))
    offen = 1.0 - basis['rho']
    for k in range(4):
        basis['ang'][k] += 2.2 * offen * math.sin(L.sinus(t, N / 3.0, 1.1 * k + finger_phase))
    return basis


def ist_ruhe(p):
    v = B.pose_vektor(p)
    return max(abs(a - b) for a, b in zip(v, REST_VEC)) < 0.35


def atem_stufe(i):
    """0 / 1 / 2 Zeilen: zweimal pro Schleife (Periode 24), Gipfel (2) bei Frame 13 und 37 (Flügel weit offen = Einatmen; Frame 0 = Ruhe ohne Dehnung)."""
    s = math.cos(2 * math.pi * (i - 13) / (N / 2.0))
    return 2 if s > 0.55 else (1 if s > -0.45 else 0)


def dehne(a, n):
    """Rippenkorb atmet: n = 1 → Zeile 13 doppelt; n = 2 → zusätzlich Zeile 14 doppelt (alles darüber hebt sich, Füße bleiben)."""
    if n >= 1:
        a = L.streck_zeile(a, PAD_T + 14, 1) if n >= 2 else a
        a = L.streck_zeile(a, PAD_T + (12 if n >= 2 else 13), 1)
    return a


# ── Arme: eigene, vom Flügelschlag unabhängige Bewegung ────────────────────────────────────────────────────────────────
ARM_PERIODE = {True: 16.0, False: 24.0}                    # Frames je Pendelschwung (links schneller als rechts)
ARM_AMP = {True: 2.4, False: 2.0}                          # Auslenkung der Hand nach außen in px
ZUCKEN_START = {True: (7, 31), False: (18, 41)}            # Frames, ab denen die Hand zuckt
ZUCKEN_FOLGE = (1, 1, 0, 1)                                # 1 = Faust gehoben + Fingerspitzen dunkel


def arm_pendel(a, pivot_y, y_max, aus, links):
    """Der Arm hängt an der Schulter (Zeilen ≤ pivot_y bleiben stehen) und schwingt: Zeile y wandert um round(aus · ((y − pivot)/(ymax − pivot))^1,3)
    nach außen (aus < 0: nach innen, höchstens 1 px). Ansatz an der Schulter steht, die Hand schwingt am meisten."""
    out = L.leer(H, W)
    sg = -1 if links else 1
    for y in range(H):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        if y <= pivot_y:
            dx = 0
        else:
            f = ((y - pivot_y) / float(max(1, y_max - pivot_y))) ** 1.3
            dx = int(round(aus * f)) if aus >= 0 else -min(1, int(round(-aus * f)))
        dx *= sg
        if xs_.min() + dx < 0 or xs_.max() + dx >= W:
            raise L.ClipError(f'Arm-Zeile {y} würde um {dx} px aus der Leinwand')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def zucken(i, links):
    for s in ZUCKEN_START[links]:
        k = (i - s) % N
        if k < len(ZUCKEN_FOLGE):
            return ZUCKEN_FOLGE[k]
    return 0


def arm_ebene(links, i, n):
    a = dehne(ARM_L0 if links else ARM_R0, n)
    per = ARM_PERIODE[links]
    aus = ARM_AMP[links] * math.sin(L.sinus(i, per))
    pivot = PAD_T + 12 - n
    ymax = PAD_T + 18
    rohr = a.copy(); rohr[PAD_T + 15:] = 0
    hand = a.copy(); hand[:PAD_T + 15] = 0
    z = zucken(i, links)
    if z:                                                  # Fingerspitzen (tan, Zeile 17) werden dunkler: die Faust schließt sich
        m = (hand[..., 0] == BR_M[0]) & (hand[..., 1] == BR_M[1]) & (hand[..., 2] == BR_M[2]) & (hand[..., 3] > 0)
        hand[m, :3] = BR_J
    rohr = arm_pendel(rohr, pivot, ymax, aus, links)
    hand = arm_pendel(hand, pivot, ymax, aus, links)
    if z:
        hand = L.versetze(hand, 0, -1)                     # Faust hebt sich 1 px
    return L.zusammen(H, W, [(rohr, 0, 0), (hand, 0, 0)])


# ── Flügel ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def fluegel_ebene(t, links, n_atem):
    """Eine Flügelebene (links gezeichnet; rechts = Spiegelung) zur Zeit t. Wurzel (Rücken, Handgelenk) hebt sich mit dem Rippenkorb."""
    p = pose_zu(t, 0.0 if links else 0.7)
    if ist_ruhe(p):
        return dehne(WING_L0 if links else WING_R0, n_atem), None
    pp = dict(p)
    pp['S'] = (PAD_L + p['S'][0], PAD_T + p['S'][1] - n_atem)
    pp['W'] = (PAD_L + p['W'][0], PAD_T + p['W'][1] - n_atem)
    pp['knubbel'] = 1 if p['knubbel'] > 0.5 else 0
    a = B.knochenflügel(H, W, pp, PAL, spr_w, SPALTEN, 3, 6)
    if not links:
        a = B.spiegeln(a)
    return a, pp


# ── Partikel: Knochenstaub (steigt langsam auf) ─────────────────────────────────────────────────────────────────────────
STAUB = {'c': P, 'r': Lg}
PUFFS = [
    dict(x=px(4, 22)[0], y=px(4, 22)[1], vx=-3, vy=-9, off=0, form='m', wackeln=1),      # Bodenstaub an den Füßen
    dict(x=px(15, 22)[0], y=px(15, 22)[1], vx=3, vy=-9, off=24, form='m', wackeln=1),
    dict(x=px(-3, 21)[0], y=px(-3, 21)[1], vx=-1, vy=-10, off=8, form='o', wackeln=1),   # steigt neben dem Körper
    dict(x=px(22, 21)[0], y=px(22, 21)[1], vx=1, vy=-10, off=32, form='o', wackeln=1),
    dict(x=px(-7, 17)[0], y=px(-7, 17)[1], vx=-1, vy=-8, off=16, form='k', wackeln=1),
    dict(x=px(26, 17)[0], y=px(26, 17)[1], vx=1, vy=-8, off=40, form='k', wackeln=1),
    dict(x=px(9, 23)[0], y=px(9, 23)[1], vx=0, vy=-8, off=12, form='k', wackeln=1),
    dict(x=px(1, 23)[0], y=px(1, 23)[1], vx=-1, vy=-7, off=4, form='k', wackeln=1),
    dict(x=px(18, 23)[0], y=px(18, 23)[1], vx=1, vy=-7, off=28, form='k', wackeln=1),
]
TEST_EBENEN = ('koerper', 'arme', 'fluegel')               # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n = atem_stufe(i)
    schichten = []
    if 'fluegel' in ebenen:
        wl, _ = fluegel_ebene(i, True, n)
        wr, _ = fluegel_ebene(i - RECHTS_LAG, False, n)
        schichten += [(wl, 0, 0), (wr, 0, 0)]                          # Flügel hinten
    if 'koerper' in ebenen:
        schichten.append((dehne(BODY, n), 0, 0))
    if 'arme' in ebenen:
        schichten += [(arm_ebene(True, i, n), 0, 0), (arm_ebene(False, i, n), 0, 0)]   # Arme vorn
    f = L.zusammen(H, W, schichten)
    B.umriss_schliessen(f, UMRISS, Lg, BR_D)
    if partikel:
        staub = L.puff_ebene(H, W, i, N, PUFFS, STAUB)
        f = L.zusammen(H, W, [(staub, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('winged-skeleton', 'Winged Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/winged-skeleton-strip.png', frames, spalten=8, scale=5)
