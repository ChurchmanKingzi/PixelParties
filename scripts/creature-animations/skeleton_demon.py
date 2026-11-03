# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Demon“ (Creature) — Runde 3: er FLIEGT, die schwarzen Streben sind seine Skelettflügel (wie beim Winged Skeleton); die Flügel bestehen NUR aus Knochen (Nutzer: „die Membran sieht nicht gut aus, entfern die, nur die Knochen sollen bleiben; die Hände an den Flügeln bitte schwarz“).

Nutzer-Korrektur: „soll fliegen, das Schwarze sind seine Skelettflügel. Ähnlich wie Winged Skeleton, aber mit dunkelgrauen Membranen.“
Vorlage (nicht verändert): winged_skeleton.py — gleicher Körper (die Demon-Ebene ist die umgefärbte „Winged Skele“-Ebene, Silhouette Pixel für Pixel gleich), gleiche Flugbewegung.

Quelle: src/skeleton-demon.png (20×24 px, 346 Pixel, 11 Farben) — UMGEFÄRBTE Ebene „Winged Skele“ (Motive.xcf, Ebene 297, spiegelsymmetrisch um x = 9,5). Die schwarz-rote Fassung selbst liegt in keiner Ebene der
xcf-Dateien; sie ist nur in der Kartenkunst data/card-art/native/Skeleton_Demon.png (drei Exemplare) vorhanden und daraus rekonstruiert (Farbe = Median der Kopien und des Spiegelpixels, 11 Farben).
PICK: [["Motive", 297, 1]] (Silhouette) + Farben aus data/card-art/native/Skeleton_Demon.png

Aufruf:   python3 skeleton_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-demon.png + .json

Was ist was (x/y im Sprite, linke Seite; die rechte ist gespiegelt x ↔ 19 − x):
* Hörner/Krallen oben (x 3–7, y 0–6): gebogene mauvefarbene Knochenspitzen (176,151,152) / (145,112,112) mit schwarzem Umriss — fest am Schädel.
* Schädel (x 6–13, y 3–9): schwarz (9,9,9). Schräge ROTE AUGEN (7,4) (7,5) (7,6) (8,6) (8,7) bzw. (12,4) (12,5) (12,6) (11,6) (11,7); darunter je zwei graue Wangenknochenpixel (7,7) (7,8) / (12,7) (12,8).
  Kiefer/Zähne als rotes Band y 8–9 (x 6–13). Rippenkorb y 10–14 (rote Rippen auf Schwarz), Becken y 15–18, Beine y 19–23, dunkelbraune Füße (47,27,6) bei (5–6,22) und (13–14,22).
* ARME (vorn, rot umrandet): schräge Röhre von der Schulter (4, 10–12) nach unten-außen, Ende = HAND x 0–4, y 15–18 mit rosaroten Fingern (207,64,64) bei (2–3,17).
* FLÜGEL (hinten): die senkrechten dunkelgrauen/schwarzen Streben x 1–4 / 15–18 neben dem Schädel, y 3–19 (Farbe (31,33,33) auf Schwarz) sind die zusammengefalteten SKELETTFLÜGEL (Armknochen + Fingerknochen
  mit Membran) — nach der Korrektur des Nutzers. Sie liegen hinter Arm und Körper und werden hier ausgebreitet neu gezeichnet. Das Schulterstück (4,5), (4,10)–(4,12) bleibt am Körper.
Fest bleiben: Schädelform, Hörner, Rippenmuster, Umrisse.

Ablauf (48 Frames à 65 ms = 3,12 s; die Figur FLIEGT, Frame 0 ist eine Flugpose):
* FLÜGEL schlagen durchgehend und gleichmäßig wie beim Winged Skeleton: ein Schlag = 12 Frames (780 ms), 4 Schläge pro Schleife, keine Pause. Abschlag (oben → waagerecht → unten) schnell, etwa 3,5 Frames; Aufschlag/Rückholen
  (Flügel heben sich, ziehen sich ein, Finger krümmen sich, öffnen sich wieder) etwa 8,5 Frames. Dieselben Schlüsselposen (Spline, Finger hinken 0,4 Frames je Finger nach, kleines Flattern der Spitzen; rechter Flügel 0,4 Frames später).
  Jeder Flügel = Armknochen vom Rücken (hinter dem Schädel) zum Handgelenk (3×3-Nubbel) und vier Fingerknochen (mit Knick) — alles SCHWARZ (9,9,9), auch die „Hände“ (Gelenkknubbel und Krallenspitzen, vorher mauve).
  Runde 3: die dunkelgraue Flughaut-Membran und ihr Hinterrand sind entfernt (`anim_skel2.knochen_fluegel`, gleiche Flügelposen wie vorher, nur die Knochenlinien).
* BOB: die ganze Figur (Schädel, Hörner, Rumpf, Arme, Flügelansatz) hebt und senkt sich im Takt der Schläge (±3 px): am höchsten kurz nach dem Abschlag unten (Beat-Frame 5), am tiefsten kurz vor dem Aufschlag oben (Beat-Frame 11).
  Die Füße baumeln nach (1,5 Frames verzögert, zu 60 %, nie höher als der Körper); die Lücke zwischen Becken und Beinen füllen doppelte Beinzeilen (Zeile 20).
* ARME (unabhängig von den Flügeln, eigene Perioden): hängen an der Schulter, fliegen mit dem Körper mit und pendeln zusätzlich leicht aus (links Periode 16, rechts 24, Hand bis 2 px nach außen / 1 px nach innen);
  die Hände zucken (Faust hebt sich 1 px, Fingerspitzen (207,64,64) → (172,2,3)): links ab Frame 7 und 31, rechts ab Frame 18 und 41.
* Rippenkorb atmet zweistufig bis 2 px (Zeile 13, dann zusätzlich Zeile 14 doppelt, L.streck_zeile mit Texturmischung), dreimal pro Schleife (Periode 16), unabhängig von den Schlägen.
* Glutwölkchen (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, 2×2 → 3×3 → 2×2): dunkle Rauchwölkchen (Kern (31,33,33), Rand (9,9,9)) und rote Glutwölkchen (Kern (172,2,3), Rand (114,2,2)) steigen
  neben dem Körper und von den Händen auf; alle Farben aus dem Sprite.
Kein Glanz (Knochen sind kein Metall), kein Feuer. Randpixel-Test (Regel 16): `B.umriss_schliessen` + schwarze Kontur der Membran in jeder Pose.
ERGÄNZUNG: alle Flügelposen sind neu gezeichnet (nur Knochenlinien und Nubbel in (9,9,9), Farbe des Sprites). Die gefalteten Streben des Originals entfallen,
Frame 0 ist darum nicht mehr das Original (Flugzyklus). Körper und Arme sind das Original ohne Streben; hinter der Hand steht Körperschwarz (9,9,9), soweit der Arm es freilegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger_b as B
import anim_skel as K
import anim_skel2 as K2
import anim_untote as U

N, MS = 48, 65
BEAT = 12.0                                               # Frames pro Flügelschlag (4 Schläge pro Schleife)
PAD_L, PAD_R, PAD_T, PAD_B = 17, 17, 11, 5

spr = L.lade('skeleton-demon')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
assert (vorhanden == vorhanden[:, ::-1]).all()
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
_alle = {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
SCHWARZ, GRAU = (9, 9, 9), (31, 33, 33)
MAUVE_D, MAUVE_H = (145, 112, 112), (176, 151, 152)
ROSA, ROT_D, ROT_M = (207, 64, 64), (172, 2, 3), (114, 2, 2)
assert all(c in _alle for c in (SCHWARZ, GRAU, MAUVE_D, MAUVE_H, ROSA, ROT_D, ROT_M))
UMRISS = U.umrissfarben(spr) | {SCHWARZ}
FLUEGEL_FARBEN = dict(knochen=SCHWARZ, nub=SCHWARZ, kralle=SCHWARZ)          # Runde 3: nur Knochen, keine Membran; „Hände“ (Gelenkknubbel, Krallenspitzen) schwarz

# ── Masken (linke Seite, rechts = gespiegelt): ARM (vorn), Rest = Körper (inkl. Hörner, Schulterstück); die gefalteten Flügelstreben entfallen ──────────
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
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


BODY = ebene(spr, koerper)
ARM_L0, ARM_R0 = ebene(spr, arm_l), ebene(spr, arm_r)
# Hinter dem Arm/der Hand steht Körperschwarz (der Arm liegt vor dem Rumpf): Maske des Rumpfes dahinter, damit der Arm nach außen schwingen kann
HAND_HINTER = [(x, y) for y in range(15, 19) for x in range(0, 5) if arm_l[y, x]]

# ── Schlüsselposen (linker Flügel; Winkel in Grad: 90° = unten, 180° = links, 270° = oben) — dieselben wie beim Winged Skeleton ─────────────────────────────
def pose(S, Wr, ang, ln, knick):
    return dict(S=S, W=Wr, ang=list(ang), len=list(ln), knick=knick)


S0 = (6.5, 8.5)                                           # Ansatz am Rücken, hinter dem Schädel/Schulterblatt (vom Körper verdeckt)
POSEN = {
    'oben':    pose(S0, (-1.5, 2), (228, 194, 162, 130),     (12.5, 12, 11, 10),     18),
    'weit':    pose(S0, (-1, 2.5),  (222, 190, 160, 128),    (12.5, 12, 11, 10),     14),
    'mitte':   pose(S0, (-1, 4.5),  (198, 168, 142, 114),    (12, 11.5, 10.5, 9.5),  18),
    'unten':   pose(S0, (-1, 7),    (150, 124, 102, 84),     (11.5, 11.5, 10.5, 9),  22),
    'halb':    pose(S0, (1, 4.5),   (168, 144, 120, 97),     (12.5, 12, 12, 11),     10),
    'ein':     pose(S0, (1.5, 5.5), (150, 128, 108, 92),     (11, 10.5, 10, 9.5),    28),
}
KEY = POSEN['oben']


def _v(name):
    return B.pose_vektor(POSEN[name])


SCHLAG = [(0, 'oben'), (1.5, 'mitte'), (3.5, 'unten'), (5.5, 'halb'), (7.5, 'ein'), (9.5, 'halb'), (11, 'weit')]
SCHLUESSEL = [(z, _v(nm), False) for (z, nm) in SCHLAG]
FINGER_LAG = 0.4
RECHTS_LAG = 0.4


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
BOB_AMP = 2.6
BOB_MAX_T = 5.0


def bob(t):
    """Versatz der ganzen Figur in px (negativ = oben): hoch beim Abschlag, sinkt beim Rückholen."""
    return -int(round(BOB_AMP * math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT)))


def fuss_versatz(t):
    """Füße baumeln nach: sie folgen dem Körper verzögert und nur zu 60 % (nie höher als der Körper)."""
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def koerper_ebene(n, dy_u, dy_f):
    """Körper um dy_u, Beine ab Zeile 19 um dy_f; die Lücke dazwischen (dy_f − dy_u ≥ 0) füllen doppelte Zeilen der Beine."""
    full = dehne(BODY, n)
    cut = PAD_T + 19
    oben = full.copy(); oben[cut:] = 0
    beine = full.copy(); beine[:cut] = 0
    if dy_f - dy_u > 0:
        beine = L.streck_zeile(beine, cut + 1, dy_f - dy_u)
    return L.zusammen(H, W, [(oben, 0, dy_u), (beine, 0, dy_f)])


# ── Arme: eigene, vom Flügelschlag unabhängige Pendelbewegung (hängen am Körper und fliegen mit ihm) ────────────────────
ARM_PERIODE = {True: 16.0, False: 24.0}
ARM_AMP = {True: 2.4, False: 2.0}
ZUCKEN_START = {True: (7, 31), False: (18, 41)}
ZUCKEN_FOLGE = (1, 1, 0, 1)


def arm_pendel(a, pivot_y, y_max, aus, links):
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
    if z:                                                  # Fingerspitzen (rosa, Zeile 17) werden dunkler: die Faust schließt sich
        m = (hand[..., 0] == ROSA[0]) & (hand[..., 1] == ROSA[1]) & (hand[..., 2] == ROSA[2]) & (hand[..., 3] > 0)
        hand[m, :3] = ROT_D
    rohr = arm_pendel(rohr, pivot, ymax, aus, links)
    hand = arm_pendel(hand, pivot, ymax, aus, links)
    if z:
        hand = L.versetze(hand, 0, -1)                     # Faust hebt sich 1 px
    return L.zusammen(H, W, [(rohr, 0, dy_u), (hand, 0, dy_u)])        # ganzer Arm fliegt mit dem Körper


# ── Flügel ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def fluegel_ebene(t, links, dy_u, n_atem):
    """Eine Flügelebene mit Flughaut (links gezeichnet; rechts = Spiegelung) zur Zeit t. Ansatz und Gelenk fliegen mit dem Körper (Bob + Rippenkorb)."""
    p = pose_zu(t, 0.0 if links else 0.7)
    pp = dict(p)
    pp['S'] = (PAD_L + p['S'][0], PAD_T + p['S'][1] + dy_u - n_atem)
    pp['W'] = (PAD_L + p['W'][0], PAD_T + p['W'][1] + dy_u - n_atem)
    a = K2.knochen_fluegel(H, W, pp, FLUEGEL_FARBEN)
    if not links:
        a = B.spiegeln(a)
    return a


# ── Partikel: Rauch und Glut (steigen langsam auf) ──────────────────────────────────────────────────────────────────────
RAUCH = {'c': GRAU, 'r': SCHWARZ}
GLUT = {'c': ROT_D, 'r': ROT_M}
px = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_RAUCH = [
    dict(x=px(4, 23)[0], y=px(4, 23)[1], vx=-2, vy=-9, off=0, wackeln=1),            # Rauch an den Füßen
    dict(x=px(15, 23)[0], y=px(15, 23)[1], vx=2, vy=-9, off=24, wackeln=1),
    dict(x=px(9, 24)[0], y=px(9, 24)[1], vx=0, vy=-9, off=12, wackeln=1),
]
PUFFS_GLUT = [
    dict(x=px(1, 19)[0], y=px(1, 19)[1], vx=-1, vy=-9, off=8, wackeln=1),            # von den Händen
    dict(x=px(18, 19)[0], y=px(18, 19)[1], vx=1, vy=-9, off=32, wackeln=1),
    dict(x=px(9, 22)[0], y=px(9, 22)[1], vx=0, vy=-8, off=40, wackeln=1),
]
TEST_EBENEN = ('koerper', 'arme', 'fluegel')               # für den Randpixel-Test: ohne Partikel


def frame_gross(i, nur=None):
    ebenen = nur if nur is not None else ('koerper', 'arme', 'fluegel', 'partikel')
    n = atem_stufe(i)
    dy_u, dy_f = bob(i), fuss_versatz(i)
    schichten = []
    if 'fluegel' in ebenen:
        schichten += [(fluegel_ebene(i, True, dy_u, n), 0, 0), (fluegel_ebene(i - RECHTS_LAG, False, bob(i - RECHTS_LAG), n), 0, 0)]   # Flügel hinten
    if 'koerper' in ebenen:
        schichten.append((koerper_ebene(n, dy_u, dy_f), 0, 0))
    if 'arme' in ebenen:
        # Körperschwarz hinter den Händen (der Arm liegt vor dem Rumpf; schwingt er nach außen, bleibt Körper stehen)
        stuetze = L.leer(H, W)
        for links in (True, False):
            for (x, y) in HAND_HINTER:
                xx_ = x if links else 19 - x
                if not BODY[PAD_T + y, PAD_L + xx_, 3]:
                    stuetze[PAD_T + y + dy_u, PAD_L + xx_, :3] = SCHWARZ
                    stuetze[PAD_T + y + dy_u, PAD_L + xx_, 3] = 255
        schichten += [(stuetze, 0, 0), (arm_ebene(True, i, n, dy_u), 0, 0), (arm_ebene(False, i, n, dy_u), 0, 0)]   # Arme vorn
    f = L.zusammen(H, W, schichten)
    B.umriss_schliessen(f, UMRISS, GRAU, SCHWARZ)
    if 'partikel' in ebenen:
        rauch = U.wolke_ebene(H, W, i, N, PUFFS_RAUCH, RAUCH)
        glut = U.wolke_ebene(H, W, i, N, PUFFS_GLUT, GLUT)
        f = L.zusammen(H, W, [(rauch, 0, 0), (glut, 0, 0), (f, 0, 0)])
    return f


def frame(i, partikel=True, nur=None):
    if nur is not None:
        return frame_gross(i, nur)
    return frame_gross(i) if partikel else frame_gross(i, TEST_EBENEN)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('skeleton-demon', 'Skeleton Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-demon-strip.png', frames, spalten=8, scale=5)
