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

Ablauf (48 Frames à 65 ms = 3,12 s) — die Figur FLIEGT:
* FLÜGEL schlagen durchgehend und gleichmäßig: ein Schlag = 12 Frames (780 ms), 4 Schläge pro Schleife, keine Pause. Abschlag (oben → waagerecht → unten) schnell,
  etwa 3,5 Frames; Aufschlag/Rückholen (Flügel heben sich, ziehen sich ein, Finger krümmen sich, öffnen sich wieder) etwa 8,5 Frames. 6 Schlüsselposen
  (Posenblatt im Check-Bild: oben, weit, Abschlag Mitte, Abschlag unten, halb/Rückholen, eingezogen), dazwischen weicher Spline (periodisch, nahtlos).
  Die Flügel bestehen NUR aus Knochen (keine Haut, keine Hand, kein Wulst): ein Armknochen vom Rücken (hinter dem Schädel/Schulterblatt, vom Körper
  verdeckt) zum Gelenk des FLÜGELS (oben außen) mit 3×3-Gelenkknubbel (grauer Ring, weißer Kern) und vier Fingerknochen, die vom Gelenk auffächern (mit Knick,
  Spitzen hinken nach, flattern); dazwischen Freiraum. Knochen: weißer Kern (246,255,255) mit grauer Kante (156,156,156) am Armknochen und am ersten Stück
  der Vorderkante, sonst graue Stufenlinien (4-verbunden); die Spitzen enden frei. Der Flügel liegt hinter Körper und Armen; der rechte schlägt 0,4 Frames später.
* BOB: die ganze Figur (Schädel, Hörner, Rumpf, Arme, Flügelansatz) hebt und senkt sich im Takt der Schläge (±3 px, 6 px Hub): am höchsten kurz nach dem
  Abschlag unten (Beat-Frame 5), am tiefsten kurz vor dem Aufschlag oben (Beat-Frame 11). Die Füße baumeln nach: sie folgen 1,5 Frames verzögert und nur zu
  60 % (nie höher als der Körper); die Lücke zwischen Becken und Beinen füllen doppelte Zeilen der Beine (Zeile 20), also lange Beine beim Steigen.
* ARME (unabhängig von den Flügeln, eigene Perioden): hängen an der Schulter, fliegen mit dem Körper mit und pendeln zusätzlich leicht aus (linker Arm Periode
  16 Frames, rechter 24 Frames, Hand schwingt bis 2 px nach außen / 1 px nach innen, Ansatz an der Schulter steht); die Hände zucken (Faust hebt sich 1 px,
  Fingerspitzen werden dunkler): links ab Frame 7 und 31, rechts ab Frame 18 und 41.
* Rippenkorb atmet zweistufig bis 2 px (Zeile 13, dann zusätzlich Zeile 14 verdoppelt), dreimal pro Schleife (Periode 16), unabhängig von den Schlägen.
* Kein Glanz/Glitzer: Knochen sind kein Metall. Knochenstaub: runde, langsame Partikel ('k', 'o', 'm') steigen vom Boden auf.

Ergänzungen / Neugezeichnetes (nur Farben des Sprites):
* Die gefalteten Flügelstreben des Originals (graue/weiße Knochen hinter dem Arm) entfallen, da die Flügel immer ausgebreitet sind; alle Flügelposen sind neu
  gezeichnet (Armknochen, Fingerknochen, Gelenkknubbel nur in (246,255,255) und (156,156,156), beide im Sprite). Frame 0 ist nicht mehr das Original (Flugzyklus).
* Körper: Schulterstück (4,5), (4,10)–(4,12) (gespiegelt (15,…)) bleibt am Körper; Körper und Arme sind das Original ohne Streben (Umriss geschlossen).
* Randpixel-Test (Regel 16): jedes Randpixel eines Frames hat eine Umrissfarbe der Quelle ((32,32,32), (49,24,0), (156,156,156)); wo ein bewegtes Teil eine
  andere Farbe an den Rand bringt, wird sie in `frame()` per `B.umriss_schliessen` zur nächsten Umrissfarbe (hell → grau, dunkel/braun → braun).
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
BEAT = 12.0                                               # Frames pro Flügelschlag (4 Schläge pro Schleife)
PAD_L, PAD_R, PAD_T, PAD_B = 15, 15, 9, 5

spr = L.lade('winged-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
assert (vorhanden == vorhanden[:, ::-1]).all()

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
Q, P, Lg = (246, 255, 255), (213, 213, 213), (156, 156, 156)
BR_D, BR_J, BR_M = (49, 24, 0), (150, 119, 88), (212, 178, 150)
DG = (32, 32, 32)
UMRISS = {DG, BR_D, Lg}                                    # Umrissfarben der Quelle (Randpixel-Test)

# ── Masken (linke Seite, rechts = gespiegelt): ARM (vorn), Rest = Körper (inkl. Hörner, Schulterstück). Die gefalteten Flügelstreben
#    (graue/weiße Knochen hinter dem Arm) entfallen: die Flügel sind jetzt immer ausgebreitet und werden neu gezeichnet. ─────────
ARM_PTS = [(3, 10), (3, 11), (3, 12), (2, 11), (2, 12), (1, 13), (2, 13), (3, 13), (1, 14), (2, 14), (3, 14), (2, 18), (3, 18)]
arm_l = np.zeros_like(vorhanden)
for (x, y) in ARM_PTS:
    arm_l[y, x] = True
arm_l |= vorhanden & (yy >= 15) & (yy <= 17) & (xx <= 4)                       # Hand
KOERPER_BEHALT = [(4, 5), (4, 10), (4, 11), (4, 12)]                           # Schulterstück bleibt am Körper
strebe_l = vorhanden & (((yy >= 3) & (yy <= 4) & (xx <= 2)) | ((yy >= 5) & (yy <= 14) & (xx <= 4)) | ((yy >= 18) & (yy <= 19) & (xx <= 3)))
for (x, y) in KOERPER_BEHALT:
    strebe_l[y, x] = False
wing_l = strebe_l & ~arm_l                                                     # gefaltete Flügelstreben des Originals (werden nicht mehr gezeigt)
arm_r, wing_r = arm_l[:, ::-1] & vorhanden, wing_l[:, ::-1] & vorhanden
assert not (arm_l & wing_l).any() and not (arm_r & wing_r).any() and not (arm_l & arm_r).any() and not (wing_l & wing_r).any()
koerper = vorhanden & ~arm_l & ~arm_r & ~wing_l & ~wing_r


def ebene(quelle, maske):
    return F.ebene(quelle, maske, H, W, PAD_L, PAD_T)


BODY = ebene(spr, koerper)
ARM_L0, ARM_R0 = ebene(spr, arm_l), ebene(spr, arm_r)

PAL = dict(knochen=[Q], schatten=Lg)               # Flügel nur aus Knochen: weißer Kern, graue Kante (156,156,156)
SPALTEN = [1, 2, 2, 3]            # Quellspalten der vier Fingerknochen (nur für die Fingerlänge; Leitfinger = Außenkante x = 1)


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Schlüsselposen (linker Flügel, Sprite-Koordinaten; Winkel in Grad: 90° = unten, 180° = links, 270° = oben) ──────────────
def pose(S, Wr, ang, ln, knick, rho=0.1, rein=1.0, knubbel=1.0):
    return dict(S=S, W=Wr, ang=list(ang), len=list(ln), knick=knick, rho=rho, rein=rein, knubbel=knubbel)


S0 = (6.5, 8.5)                                           # Ansatz am Rücken, hinter dem Schädel/Schulterblatt (vom Körper verdeckt)
POSEN = {
    'oben':    pose(S0, (-1.5, 2), (228, 194, 162, 130),     (12.5, 12, 11, 10),     18),      # Flügel ganz oben (Ende Aufschlag)
    'weit':    pose(S0, (-1, 2.5),  (222, 190, 160, 128),    (12.5, 12, 11, 10),     14),
    'mitte':   pose(S0, (-1, 4.5),  (198, 168, 142, 114),    (12, 11.5, 10.5, 9.5),  18),      # Abschlag waagerecht
    'unten':   pose(S0, (-1, 7),    (150, 124, 102, 84),     (11.5, 11.5, 10.5, 9),  22),      # Abschlag unten
    'halb':    pose(S0, (1, 4.5),   (168, 144, 120, 97),     (12.5, 12, 12, 11),     10),      # Rückholen: Flügel heben sich
    'ein':     pose(S0, (1.5, 5.5), (150, 128, 108, 92),     (11, 10.5, 10, 9.5),    28),      # Rückholen: Flügel eingezogen, Finger gekrümmt
}
KEY = POSEN['oben']


def _v(name):
    return B.pose_vektor(POSEN[name])


# Ein Schlag = 12 Frames, gleichmäßig wiederholt (4 Schläge pro Schleife). Abschlag (oben → unten) schnell (~3,5 Frames), Aufschlag (Rückholen) etwa doppelt so lang.
SCHLAG = [(0, 'oben'), (1.5, 'mitte'), (3.5, 'unten'), (5.5, 'halb'), (7.5, 'ein'), (9.5, 'halb'), (11, 'weit')]
SCHLUESSEL = [(z, _v(nm), False) for (z, nm) in SCHLAG]
FINGER_LAG = 0.4                  # Frames, um die jeder weiter außen liegende Finger der Wurzel hinterherhinkt (Wellenlauf)
RECHTS_LAG = 0.4                  # der rechte Flügel schlägt einen Hauch später als der linke


def pose_zu(t, finger_phase=0.0):
    """Flügelpose zur Zeit t (Frames). Finger k hinkt um FINGER_LAG·k hinterher, kleines Flattern der Spitzen (je Finger andere Phase)."""
    basis = B.vektor_pose(B.spline(SCHLUESSEL, t, BEAT), KEY)
    for k in range(4):
        v = B.vektor_pose(B.spline(SCHLUESSEL, t - FINGER_LAG * k, BEAT), KEY)
        basis['ang'][k] = v['ang'][k]
    for k in range(4):
        basis['ang'][k] += 2.0 * math.sin(L.sinus(t, N / 3.0, 1.1 * k + finger_phase))
    return basis


def atem_stufe(i):
    """0 / 1 / 2 Zeilen Rippenkorb-Dehnung: dreimal pro Schleife (Periode 16), unabhängig vom Flügelschlag."""
    s = math.cos(2 * math.pi * (i - 4) / 16.0)
    return 2 if s > 0.55 else (1 if s > -0.45 else 0)


def dehne(a, n):
    """Rippenkorb atmet: n = 1 → Zeile 13 doppelt; n = 2 → zusätzlich Zeile 14 doppelt (alles darüber hebt sich, Füße bleiben)."""
    if n >= 1:
        a = L.streck_zeile(a, PAD_T + 14, 1) if n >= 2 else a
        a = L.streck_zeile(a, PAD_T + (12 if n >= 2 else 13), 1)
    return a


# ── Flug: die ganze Figur hebt und senkt sich im Takt der Schläge ────────────────────────────────────────────────────────
BOB_AMP = 2.6                     # px (±): Maximum etwa ±3 px
BOB_MAX_T = 5.0                   # Frame im Schlag, in dem die Figur am höchsten ist (kurz nach dem Abschlag unten)


def bob(t):
    """Versatz der ganzen Figur in px (negativ = oben): hoch beim Abschlag, sinkt beim Rückholen."""
    return -int(round(BOB_AMP * math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT)))


def fuss_versatz(t):
    """Füße baumeln nach: sie folgen dem Körper verzögert und nur zu 60 % (nie höher als der Körper)."""
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def koerper_ebene(n, dy_u, dy_f):
    """Körper (Schädel, Hörner, Rumpf, Becken) um dy_u, Beine ab Zeile 19 um dy_f; die Lücke dazwischen (dy_f − dy_u ≥ 0) füllen doppelte Zeilen der Beine."""
    full = dehne(BODY, n)
    cut = PAD_T + 19
    oben = full.copy(); oben[cut:] = 0
    beine = full.copy(); beine[:cut] = 0
    if dy_f - dy_u > 0:
        beine = L.streck_zeile(beine, cut + 1, dy_f - dy_u)
    return L.zusammen(H, W, [(oben, 0, dy_u), (beine, 0, dy_f)])


# ── Arme: eigene, vom Flügelschlag unabhängige Pendelbewegung (hängen am Körper und fliegen mit ihm) ────────────────────
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


def arm_ebene(links, i, n, dy_u):
    a = dehne(ARM_L0 if links else ARM_R0, n)
    aus = ARM_AMP[links] * math.sin(L.sinus(i, ARM_PERIODE[links]))
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
    return L.zusammen(H, W, [(rohr, 0, dy_u), (hand, 0, dy_u)])        # ganzer Arm fliegt mit dem Körper


# ── Flügel ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def fluegel_ebene(t, links, dy_u, n_atem):
    """Eine Flügelebene (links gezeichnet; rechts = Spiegelung) zur Zeit t. Ansatz und Gelenk fliegen mit dem Körper (Bob + Rippenkorb)."""
    p = pose_zu(t, 0.0 if links else 0.7)
    pp = dict(p)
    pp['S'] = (PAD_L + p['S'][0], PAD_T + p['S'][1] + dy_u - n_atem)
    pp['W'] = (PAD_L + p['W'][0], PAD_T + p['W'][1] + dy_u - n_atem)
    pp['knubbel'] = 1
    a = B.knochenflügel(H, W, pp, PAL, spr, SPALTEN, 3, 6)
    if not links:
        a = B.spiegeln(a)
    return a


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
    dy_u, dy_f = bob(i), fuss_versatz(i)
    schichten = []
    if 'fluegel' in ebenen:
        schichten += [(fluegel_ebene(i, True, dy_u, n), 0, 0), (fluegel_ebene(i - RECHTS_LAG, False, bob(i - RECHTS_LAG), n), 0, 0)]   # Flügel hinten
    if 'koerper' in ebenen:
        schichten.append((koerper_ebene(n, dy_u, dy_f), 0, 0))
    if 'arme' in ebenen:
        schichten += [(arm_ebene(True, i, n, dy_u), 0, 0), (arm_ebene(False, i, n, dy_u), 0, 0)]   # Arme vorn
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
