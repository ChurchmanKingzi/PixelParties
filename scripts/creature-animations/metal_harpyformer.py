# -*- coding: utf-8 -*-
"""Idle-Animation für „Metal Harpyformer“ (Creature) — dunkelrote Harpyie mit grauen Fledermausflügeln und roter Gitarre, aus der eine Feuerkugel explodiert; schwebt.

PICK: [["MotiveMoe", 165, "Metal Harpyformer (28×49 px: Harpyie + Gitarre + Feuerkugel in einer Ebene)"]]
Quelle: MotiveMoe.xcf, Ebene 165 „Metal Harpyformer“ (Versatz (244, 349)); sie liegt unverändert als src/metal-harpyformer.png (28×49, 813 Pixel).
Abgleich mit der Kartenkunst (data/card-art/native/Metal_Harpyformer.png, 76×51; Ebene sitzt bei Kartenpixel (24, −9)): alle 728 Ebenenpixel, die in der Karte liegen, stehen dort genauso
(Farbvergleich, Toleranz 30). Die obersten 9 Zeilen der Feuerkugel (85 Pixel) ragen in der Karte über den oberen Rand hinaus und sind nur in der Ebene vollständig — sie gehören zur Figur.
Keine weitere Ebene der Karte gehört dazu: Blumen rechts, Busch unten und Bühne sind Szene. (Die dunkelrote Figur rechts in MotiveDeri 41 „Grunge Harpyformer #1“ ist dieselbe Harpyie ohne Gitarre und
Feuer; sie wurde nicht verwendet, die Metal-Ebene ist vollständig.)

Aufruf:   python3 metal_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/metal-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y; die Teile trennt das Skript per Farbe und Bereich):
* Feuerkugel (x 3–24, y 0–20, Farben Rot (202,44,41), Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184)): explodiert über der Gitarre; heller Kern in der Mitte (y 7–15), rote
  Außenhaut mit Zacken. Feuer — wird nach Regel 15 animiert.
* Gitarre (x 8–21, y 15–26): rote Korpus-Fläche (233,0,1) (210,0,1) (153,2,0) mit rosa Glanzpixel (233,114,114), diagonaler Hals mit schwarz-weißem Saitenmuster (26,33,39) (242,255,255) (172,177,179)
  nach rechts unten zur rechten Hand (x 18–22, y 23–26). Zählt als Instrument (Saiten/Metall), bleibt aber ohne Glanz (die weißen Pixel sind Griffbrett-Lichter, kein Metallglanz erkennbar).
* Harpyie (x 4–23, y 25–48): rotbraunes Haar/Gesicht (114,63,63) (147,80,80) (170,101,101) mit schwarzem Umriss (19,10,10); Gesicht x 9–18, y 29–34 mit Totenkopf-/Corpsepaint-Muster
  (weiß-hellblau (246,255,255) (199,218,227), rot (159,0,0) (123,8,24) (88,6,17), schwarz (4,19,25)); Augen = hellblaue Iris + dunkelrote Pupille (11,30) (12,30) und (15,30) (16,30) mit schwarzen Brauen (12,29) (15,29);
  weiß-blau-graue Brustplatte (x 10–17, y 35–40); Beine/Füße (x 8–19, y 43–48) mit hellen Zehen (9,47) (11,46) (18,46) (20,47).
* Flügel: große graue Fledermausflügel (Töne (125,125,125) (112,112,112) (89,89,89) (63,63,63) (45,45,45)), links x 0–9, y 21–37, rechts x 18–27, y 24–37; sie stehen wie hochgereckte Arme nach oben außen
  (Spitzen oben bei (0–2, 21–23) und (24–27, 24–28)).
* Lange Haarsträhnen/Umhang (x 4–8 und 19–23, y 37–44): braune Strähnen links und rechts neben dem Körper.

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend im festen Rhythmus: ein Schlag = 12 Frames (780 ms), 4 pro Schleife; Abschlag 5 Frames. Beide Fledermausflügel schlagen nach unten: jede Spalte wandert als Ganzes senkrecht,
  bis 6 px (Exponent 1,15, die Spitze hinkt 1 Frame nach, der rechte Flügel 0,3 Frames später); die Wurzeln am Körper bleiben fast fest. Flügelfläche und Rippen bleiben, nichts wird kopiert.
* Schwebe-Bob: Harpyie samt Gitarre, Feuerkugel und Flügeln hebt sich im Takt bis 2 px (am höchsten in der Schlagmitte); die Füße baumeln nach (60 %, 1,5 Frames verzögert, die Lücke füllen
  doppelte Zehenzeilen).
* Feuer (Regel 15): Die Zungen der Feuerkugel flackern unabhängig (`F.feuer_zungen`, Posen à 3 Frames), dazu schwanken die Farbschichten gegeneinander und der helle Kern wandert (`F.feuer_schichten`).
  Vom Rand der Kugel reißen orange und gelbe 2×2-Funken ab und steigen auf (`B.wolken_ebene`, keine 1-px-Punkte).
* Haarsträhnen unten schwingen ±1 px (links Periode 16, rechts 24 Frames); das innere Ende bleibt am Körper.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (114,63,63) auf Iris und Pupille.
* Kein Glanz: Gitarre und Saiten zeigen keinen erkennbaren Metallglanz — im Zweifel weggelassen.

Ergänzungen: keine nötig — die Ebene enthält die Figur vollständig (inklusive der in der Karte abgeschnittenen Feuerspitze).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 10, 2                   # oben: Feuer-Funken steigen auf, Hub 2 px

spr = L.lade('metal-harpyformer')                          # Ebene 165 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
KERN = [GELB, CREME]
HEISS = {ROT: 0, ORANGE: 1, GELB: 2, CREME: 3}
GRAU = [(45, 45, 45), (125, 125, 125), (89, 89, 89), (112, 112, 112), (63, 63, 63), (70, 68, 71), (0, 2, 0)]
LID = (114, 63, 63)
AUGEN = [(11, 30), (12, 30), (15, 30), (16, 30)]           # Iris + Pupille → Lid

# ── Teile trennen ─────────────────────────────────────────────────────────────────────────────────────────────────────
M_FEUER = fig & L.farbmaske(spr, [ROT, ORANGE, GELB, CREME]) & (yy <= 20)
M_FLUEGEL_L = fig & L.farbmaske(spr, GRAU) & (xx <= 9) & (yy >= 21) & (yy <= 37)
M_FLUEGEL_R = fig & L.farbmaske(spr, GRAU) & (xx >= 18) & (yy >= 21) & (yy <= 37)
M_FUESSE = fig & (yy >= 45) & ~M_FEUER
M_STRANG_L = fig & (xx <= 8) & (yy >= 38) & ~M_FLUEGEL_L & ~M_FUESSE
M_STRANG_R = fig & (xx >= 19) & (yy >= 38) & ~M_FLUEGEL_R & ~M_FUESSE
M_REST = fig & ~(M_FEUER | M_FLUEGEL_L | M_FLUEGEL_R | M_FUESSE | M_STRANG_L | M_STRANG_R)


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


FEUER, FL_L, FL_R, FUESSE, STR_L, STR_R, REST = (teil(m) for m in (M_FEUER, M_FLUEGEL_L, M_FLUEGEL_R, M_FUESSE, M_STRANG_L, M_STRANG_R, M_REST))
Y_ENDE = PAD_T + 15                                         # ab hier steht der Fuß der Feuerkugel ruhig (rote Gitarre beginnt)
GRUPPEN = F.schichten_gruppen(FEUER, HEISS, Y_ENDE)         # Zungeneinteilung der Ruhepose (bleibt fest)
SCHICHT_AMP = (2.0, 2.2, 2.0, 1.8)
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (45, 45, 45), 2: (45, 45, 45), 3: (19, 10, 10), 4: (19, 10, 10), 5: (49, 24, 0), 6: (19, 10, 10), 7: (153, 2, 0), 8: (202, 44, 41)}
# 1/2 Flügel, 3/4 Strähnen, 5 Füße, 6 Rest (Körper, Gitarre), 7 Gitarre-Rot (nicht getrennt), 8 Feuer
SPRITE = spr


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_L, A_R = 6.0, 6.0
X_L, MAXD_L = 9, 9                                         # linker Flügel: Wurzel x 9 → Spitze x 0
X_R, MAXD_R = 18, 9                                        # rechter Flügel: Wurzel x 18 → Spitze x 27


def welle(t):
    """Schlagphase 0 (Flügel oben = Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t, amp, versatz=0.0):
    def dy(f):
        return amp * (welle(t - versatz - LAG * f) - welle(-versatz - LAG * f)) * f ** POT
    return dy


# ── Schwebe-Bob, Füße, Strähnen, Blinzeln ───────────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


def _strang(a, y0, y1, t, periode, phase0):
    """Strähne schwingt (äußeres Ende = links im Bild von `a`), unten bis 1,4 px; zu schmale Zeilen bleiben stehen."""
    innen, breite = {}, {}
    for y in range(y0, y1 + 1):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if len(xs_):
            innen[y] = int(xs_.max()) + 1
            breite[y] = int(xs_.max() - xs_.min() + 1)
    ys = sorted(innen)
    s = math.sin(2 * math.pi * t / periode + phase0) - math.sin(phase0)

    def dx(y):
        d = -1.4 * s * ((y - ys[0]) / max(1, ys[-1] - ys[0])) ** 1.2
        return 0 if breite[y] - int(round(d)) < 2 or breite[y] < 3 else d
    return B.zeilen_dehnen_aussen(a, ys[0], ys[-1], innen, dx)


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


# ── Funken (2×2, abreißende Feuerspitzen) ─────────────────────────────────────────────────────────────────────────────
FUNKEN_ORANGE, FUNKEN_GELB = {'c': ORANGE, 'r': ROT}, {'c': GELB, 'r': ORANGE}
SP = F.zungen_spitzen(FEUER, KERN)                          # Zungenspitzen der Ruhepose (Leinwandkoordinaten)


def funken(ab, anzahl, farben_idx, vy):
    res = []
    spitzen = sorted(SP, key=lambda p: p[1])[:anzahl + 4]
    for k, (x, y) in enumerate(spitzen[:anzahl]):
        res.append(dict(x=x, y=y + 2, vx=(-1, 0, 1)[k % 3], vy=vy - (k % 2), off=(ab + k * 9) % N, form='s', wackeln=1))
    return res


PUFFS1 = funken(0, 4, 0, -7)
PUFFS2 = funken(5, 3, 1, -8)
TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Funken


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n, k = hub(i), fuss_hub(i)
    schichten = []
    if 'figur' in ebenen:
        rest = REST
        if blinzeln(i):
            rest = rest.copy()
            for (x, y) in AUGEN:
                rest[PAD_T + y, PAD_L + x, :3] = LID
        fuesse = FUESSE
        if n - k > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + 45, n - k)             # Füße: Lücke füllen doppelte oberste Zehenzeile
        fl_l = B.spalten_schub(FL_L, PAD_L + X_L, dy_fn(i, A_L), MAXD_L)
        fl_r = B.spalten_schub(FL_R, PAD_L + X_R, dy_fn(i, A_R, 0.3), MAXD_R)
        str_l = _strang(STR_L, PAD_T + 38, PAD_T + 41, i, 16.0, 0.0)
        str_r = _strang(STR_R[:, ::-1].copy(), PAD_T + 38, PAD_T + 40, i, 24.0, 1.0)[:, ::-1].copy()
        feuer = F.feuer_zungen(FEUER, i, N, KERN, pose_frames=3, seed=11, hub=0.34)
        feuer = F.feuer_schichten(feuer, i, N, HEISS, Y_ENDE, seed=53, amp=SCHICHT_AMP, neigung=0.5, gruppen=GRUPPEN)
        feuer = B.kleine_inseln_weg(feuer, 4)                              # abgerissene Einzelpixel am Feuerrand entfallen (keine 1-px-Punkte)
        schichten += [(fl_l, 0, -n, 1), (fl_r, 0, -n, 2), (str_l, 0, -n, 3), (str_r, 0, -n, 4), (fuesse, 0, -k, 5), (rest, 0, -n, 6), (feuer, 0, -n, 8)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if partikel:
        p = L.zusammen(H, W, [(B.wolken_ebene(H, W, i, N, PUFFS1, FUNKEN_ORANGE), 0, -n), (B.wolken_ebene(H, W, i, N, PUFFS2, FUNKEN_GELB), 0, -n)])
        f = L.zusammen(H, W, [(p, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('metal-harpyformer', 'Metal Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/metal-harpyformer-strip.png', frames, spalten=8, scale=5)
