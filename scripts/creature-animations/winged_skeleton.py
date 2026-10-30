# -*- coding: utf-8 -*-
"""Idle-Animation für „Winged Skeleton“ (Creature) — Skelett-Flügelschlag (zweite Fassung).

PICK: [["Motive", 297, 1]]
Quelle: src/winged-skeleton.png — Ebene „Winged Skele“ (20×24 px, 17 Farben) aus Motive.xcf, Figur 1.

Aufruf:   python3 winged_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/winged-skeleton.png + .json

Identifikation (x, y; Figur ist spiegelsymmetrisch um x = 9,5, Spiegel x ↔ 19 − x):
* Schädel (x 5–14, y 3–9): weiße Kappe, schräge dunkle Augenhöhlen (7–8, 6–8) / (11–12, 6–8), brauner Oberrand (7–12, 3).
* Hörner/Krallen OBEN (x 3–7, y 0–4, gespiegelt 12–16): dunkelgrau umrandete, gebogene Knochenspitzen — gehören FEST zum Schädel
  (bewegen sich nur mit dem Schädel, nie mit den Flügeln).
* Rippenkorb / Wirbelsäule (y 10–14) mit schwarzen Lücken, Becken (y 15–18), Beine (y 19–23), tan Zehen (5–6, 22) / (13–14, 22).
* Schultergürtel: die innere Knochenspalte x = 4 (y 5–14, gespiegelt x = 15) mit braunen Binden liegt eng am Rippenkorb und bleibt am Körper.
* Flügel (gefaltet, x 0–3 / 16–19, y 3–19; bei x 4 / 15 nur die Hand y 15–17): senkrechtes Bündel aus Knochen — graue Außenkante (x 1),
  weißer Knochen (x 2), grauer Schatten (x 3), braune Binden, unten Hand = brauner Wulst mit tan Fingern (y 15–17), darunter graue Spitze.
  Die Flügel liegen NEBEN dem Körper, nirgends darüber.

Ablauf (48 Frames à 65 ms = 3,12 s):
* Skelettflügel schlagen zweimal pro Schleife: erst ein großer Schlag (gefaltet → gelüftet → halb offen → weit offen oben → Abschlag
  waagerecht → Abschlag unten → Rückholen → gefaltet), dann ein kleinerer. Die Posen sind Schlüsselposen (Posenblatt im Check-Bild),
  dazwischen läuft ein weicher Spline. Der Flügel besteht aus Armknochen (Schulter → Handgelenk), vier Fingerknochen, die vom
  Handgelenk fächerförmig auseinanderlaufen (mit Knick, die Spitzen hinken nach), und gezackter, zerrissener Flügelhaut dazwischen.
  Die Fingerknochen tragen die Farben der gefalteten Spalten (Knochen weiß/grau, tan Hand-Spitze, braune Binden am Arm/Handgelenk).
  Gefaltet (Ruhe) sind es exakt die Originalpixel; beim Aufklappen werden die Fingerpixel aus den Originalspalten x = 1, 2, 2, 3 gezogen
  und pixelweise (Dithering) zu sauberen Knochen. Der rechte Flügel schlägt ~1 Frame später als der linke.
* Rippenkorb atmet zweistufig bis 2 px (Zeile 13, dann Zeile 14 wird zusätzlich verdoppelt); Schädel samt Hörnern hebt sich starr mit, die
  Füße bleiben am Boden; die Flügelwurzeln (Schulter, Handgelenk) heben sich mit.
* Glanz: zweimal pro Schleife wandert ein Lichtband diagonal über Knochen, Binden und Flügelhaut (Pixel eine/zwei Stufen heller auf der
  Grau- bzw. Braunrampe des Sprites); an den Hornspitzen, am Schädel und an den Handgelenken blitzen vierzackige Glitzer-Sterne auf.
* Knochenstaub: runde, langsame Partikel ('k', 'o', 'm') rieseln von den Flügeln, am Boden wölkt flach Staub.

Ergänzungen (fertiggezeichnet, nur Farben des Sprites): siehe ERG unten — Körper wird ohne Flügelspalten gerendert; alle Flügelposen außer
der gefalteten sind neu gezeichnet (Arm, Finger, Haut, Handgelenkswulst).
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

# ── Masken: gefaltete Flügel (links/rechts), Rest = Körper (inkl. Hörner, Schulterspalte x = 4/15) ─────────────────────
wing_l = vorhanden & (((yy >= 3) & (yy <= 4) & (xx <= 2)) | ((yy >= 5) & (yy <= 14) & (xx <= 3))
                      | ((yy >= 15) & (yy <= 17) & (xx <= 4)) | ((yy >= 18) & (yy <= 19) & (xx <= 3)))
wing_l[6, 3] = False                    # (3,6) = dunkler Schädelumriss (32,32,32) bleibt am Körper (gespiegelt (16,6)); in Ruhe identisch zum Original
wing_r = vorhanden & wing_l[:, ::-1]
assert not (wing_l & wing_r).any()
koerper = vorhanden & ~wing_l & ~wing_r

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
Q, P, Nn, Lg = (246, 255, 255), (213, 213, 213), (189, 189, 189), (156, 156, 156)
KG, IG = (123, 123, 123), (106, 106, 106)
BR_D, BR_E, BR_F, BR_J, BR_M = (49, 24, 0), (63, 46, 26), (88, 66, 42), (150, 119, 88), (212, 178, 150)
PAL = dict(knochen=[Q, P, Nn], schatten=Lg, haut=(BR_F, BR_E, BR_D, BR_E), binde=(BR_D, BR_F),
           rein=dict(knochen=[Q, P, Nn], manschette=(Lg, BR_J, BR_M)))
DG, GG = (32, 32, 32), (82, 82, 82)
RAMPE_KNOCHEN = [DG, GG, IG, KG, Lg, Nn, P, Q]
RAMPE_BRAUN = [BR_D, BR_E, BR_F]            # Binden/Umrisse glänzen; die Flügelhaut (F) bleibt oben auf der Rampe


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Schlüsselposen (linker Flügel, Sprite-Koordinaten; Winkel in Grad: 90° = unten, 180° = links, 270° = oben) ──────────────
def pose(S, Wr, ang, ln, knick, hueft, zacke=0.3, rho=0.0, rein=1.0, wulst=1.0, haut=1.0):
    return dict(S=S, W=Wr, ang=list(ang), len=list(ln), knick=knick, hueft=hueft, zacke=zacke, rho=rho, rein=rein, wulst=wulst, haut=haut)


S0, HUEFT = (3, 8), (6.5, 16.5)
POSEN = {
    'ruhe':    pose(S0, (3, 6),     (90, 90, 90, 90),        (13, 12, 12, 12),        0, HUEFT, rho=1.0, rein=0.0, wulst=0.0, haut=0.0),
    'lueften': pose(S0, (3, 5.5),   (100, 94, 88, 82),       (13, 12, 12, 12),        0, HUEFT, rho=0.8, rein=0.15, wulst=0.0, haut=0.0),
    'luft2':   pose(S0, (2.5, 5),   (118, 106, 94, 84),      (13, 12, 12, 11.5),      4, HUEFT, rho=0.5, rein=0.6, wulst=0.0, haut=1.0),
    'halb':    pose(S0, (1, 4.5),   (168, 144, 120, 97),    (12.5, 12, 12, 11),     10, HUEFT, rho=0.1),
    'weit':    pose(S0, (-1, 2.5),  (222, 190, 160, 128),    (12.5, 12, 11, 10),     14, HUEFT),
    'weit2':   pose(S0, (-1.5, 2), (228, 194, 162, 130),     (12.5, 12, 11, 10),     18, HUEFT),
    'mitte':   pose(S0, (-1, 4.5),  (198, 168, 142, 114),    (12, 11.5, 10.5, 9.5),  18, HUEFT),
    'unten':   pose(S0, (-1, 7),    (150, 124, 102, 84),     (11.5, 11.5, 10.5, 9),  22, HUEFT, zacke=0.25),
}
SPALTEN = [1, 2, 2, 3]            # Quellspalten der vier Fingerknochen (Leitfinger = Außenkante x = 1)
RISSE = [(0.45, 0.8), (0.75, 0.7)]
REST_VEC = B.pose_vektor(POSEN['ruhe'])


def _v(name, **kw):
    p = dict(POSEN[name]); p.update(kw)
    return B.pose_vektor(p)


def _mix(a, b, t):
    return B.pose_vektor(B.pose_mix(POSEN[a], POSEN[b], t))


# Zeitleiste: (Frame, Vektor, Halt). Großer Schlag 0–27, kleiner Schlag 28–47.
SCHLUESSEL = [
    (0, _v('ruhe'), True), (2, _v('ruhe'), True),
    (4, _v('lueften'), False), (6, _v('luft2'), False), (8, _v('halb'), False), (11, _v('weit'), False), (13.5, _v('weit2'), False),
    (16, _v('mitte'), False), (18.5, _v('unten'), False), (21.5, _v('halb'), False), (24, _v('luft2'), False), (26, _v('lueften'), False),
    (28, _v('ruhe'), True), (29.5, _v('ruhe'), True),
    (32, _v('lueften'), False), (34, _v('halb'), False), (36.5, _mix('halb', 'mitte', 0.7), False), (39, _mix('halb', 'unten', 0.75), False),
    (41.5, _v('luft2'), False), (43, _v('lueften'), False), (44.5, _v('ruhe'), True),
]
ZEIT_VORLAGE = POSEN['ruhe']
FINGER_LAG = 0.4                  # Frames, um die jeder weiter außen liegende Finger der Wurzel hinterherhinkt (Wellenlauf)
RECHTS_LAG = 1.0                  # der rechte Flügel schlägt 1 Frame später


def pose_zu(t, finger_phase=0.0):
    """Pose zur Zeit t (Frames). Finger k hinkt um FINGER_LAG·k hinterher, kleines Flattern der Spitzen (je Finger andere Phase)."""
    basis = B.vektor_pose(B.spline(SCHLUESSEL, t, N), ZEIT_VORLAGE)
    for k in range(4):
        v = B.vektor_pose(B.spline(SCHLUESSEL, t - FINGER_LAG * k, N), ZEIT_VORLAGE)
        basis['ang'][k] = v['ang'][k]
    basis['hueft'] = (basis['hueft'][0], basis['hueft'][1] + 0.55 * math.sin(L.sinus(t, N / 3.0, 0.4 + finger_phase)) * (1.0 - basis['rho']))  # Hautansatz wogt
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


# ── Körper ───────────────────────────────────────────────────────────────────────────────────────────────────────────
def dehne(a, n):
    """Rippenkorb atmet: n = 1 → Zeile 13 doppelt; n = 2 → zusätzlich Zeile 14 doppelt (alles darüber hebt sich, Füße bleiben)."""
    if n >= 1:
        a = L.streck_zeile(a, PAD_T + 14, 1) if n >= 2 else a
        a = L.streck_zeile(a, PAD_T + (12 if n >= 2 else 13), 1)
    return a


def ebene(maske):
    return F.ebene(spr, maske, H, W, PAD_L, PAD_T)


BODY = ebene(koerper)
WING_L0, WING_R0 = ebene(wing_l), ebene(wing_r)

# ── Glanz: Sterne (Ort, Frame-Start, Teil) ────────────────────────────────────────────────────────────────────────────
STERNE = [((6, 1), 5, 'kopf'), ('hand_l', 12, 'hand'), ((13, 1), 17, 'kopf'), ((12, 4), 21, 'kopf'), ('hand_r', 36, 'hand'), ((7, 4), 41, 'kopf')]

# ── Partikel: Knochenstaub ────────────────────────────────────────────────────────────────────────────────────────────
STAUB = {'c': P, 'r': Lg}
PUFFS = [
    dict(x=px(3, 22)[0], y=px(3, 22)[1], vx=-5, vy=-3, off=0, form='m', wackeln=0),     # Bodenstaub, flach, driftet nach außen
    dict(x=px(16, 22)[0], y=px(16, 22)[1], vx=5, vy=-3, off=24, form='m', wackeln=0),
    dict(x=px(-5, 12)[0], y=px(-5, 12)[1], vx=-2, vy=8, off=8, form='o', wackeln=1),    # rieselt von den Flügeln
    dict(x=px(24, 12)[0], y=px(24, 12)[1], vx=2, vy=8, off=32, form='o', wackeln=1),
    dict(x=px(-9, 5)[0], y=px(-9, 5)[1], vx=-1, vy=9, off=16, form='k', wackeln=1),
    dict(x=px(28, 5)[0], y=px(28, 5)[1], vx=1, vy=9, off=40, form='k', wackeln=1),
    dict(x=px(2, 15)[0], y=px(2, 15)[1], vx=-2, vy=7, off=4, form='k', wackeln=1),
    dict(x=px(17, 15)[0], y=px(17, 15)[1], vx=2, vy=7, off=28, form='k', wackeln=1),
]


def fluegel_ebene(t, links, n_atem):
    """Eine Flügelebene (links gezeichnet; rechts = Spiegelung) zur Zeit t. Die Wurzel (Schulter, Handgelenk) hebt sich mit dem Rippenkorb."""
    p = pose_zu(t, 0.0 if links else 0.7)
    if ist_ruhe(p):
        w0 = WING_L0 if links else WING_R0
        return dehne(w0, n_atem), None
    pp = dict(p)
    pp['S'] = (PAD_L + p['S'][0], PAD_T + p['S'][1] - n_atem)               # Wurzel hebt sich mit dem Rippenkorb
    pp['W'] = (PAD_L + p['W'][0], PAD_T + p['W'][1] - n_atem)
    pp['hueft'] = (PAD_L + p['hueft'][0], PAD_T + p['hueft'][1])
    pp['haut'] = 1 if p['haut'] > 0.5 else 0
    pp['wulst'] = 1 if p['wulst'] > 0.5 else 0
    a = B.knochenflügel(H, W, pp, PAL, spr, SPALTEN, 3, 6, risse=RISSE)
    if not links:
        a = B.spiegeln(a)
    return a, pp


def frame(i, partikel=True, glanz=True):
    n = atem_stufe(i)
    body = dehne(BODY, n)
    wl, pl = fluegel_ebene(i, True, n)
    wr, pr = fluegel_ebene(i - RECHTS_LAG, False, n)
    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (body, 0, 0)])           # Flügel hinter dem Körper
    if glanz:
        B.band_hell(f, i, N, 22, 12, [RAMPE_KNOCHEN, RAMPE_BRAUN], stufen=2, kern=3, breite=3.4, achse=(1.0, 0.7), x_bereich=(PAD_L - 12 + 0.7 * PAD_T, PAD_L + 32 + 0.7 * (PAD_T + 24)))
        B.band_hell(f, i, N, 1, 12, [RAMPE_KNOCHEN, RAMPE_BRAUN], stufen=2, kern=3, breite=3.4, achse=(1.0, 0.7), x_bereich=(PAD_L - 12 + 0.7 * PAD_T, PAD_L + 32 + 0.7 * (PAD_T + 24)))
        for (ort, start, teil) in STERNE:
            st = F.stern_stufe(i, N, start)
            if st is None:
                continue
            if teil == 'kopf':
                x, y = PAD_L + ort[0], PAD_T + ort[1] - n
            else:
                q = pl if ort == 'hand_l' else pr
                if q is None:
                    continue
                wx, wy = int(round(q['W'][0])), int(round(q['W'][1]))
                x, y = (wx - 1, wy) if ort == 'hand_l' else (W - 1 - (wx - 1), wy)
            F.stern(f, x, y, st, Q, P, Nn)
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
