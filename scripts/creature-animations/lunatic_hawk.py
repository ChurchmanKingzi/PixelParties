# -*- coding: utf-8 -*-
"""Idle-Animation für „Lunatic Hawk“ (Creature) — goldener Falke mit fünf Lunatic-Kugeln, fliegt (Dauerschlag + Bob).

PICK: [["MotiveGN", 213, "Lunatic Hawk (Falke)"], ["MotiveGN", 212, "Ebene #262 (die fünf Kugeln)"]]
Quelle: src/lunatic-hawk.png — Falke (Ebene „Lunatic Hawk“, 47×42 px) + Kugeln (Ebene „Ebene #262“, 45×25 px) aus MotiveGN.xcf, mit ihren Ebenen-Versätzen auf eine 47×43-Leinwand
gelegt (Alpha 253/255 des Falken → 255; die Ebene hat in der xcf 50 % Deckkraft, das ist ein Karteneffekt). Zusätzlich liegen die Teile einzeln vor:
  src/lunatic-hawk-falke.png   Falke ohne Kugeln (vollständig, auch unter den Kugeln)
  src/lunatic-hawk-orbs.png    die fünf Kugeln
Nicht verwendet: die weichen Leucht-Ebenen der Karte (Ebene #261/#234/#141, Alphaverläufe) — Glow-Hintergrund, kein Sprite.

Aufruf:   python3 lunatic_hawk.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/lunatic-hawk.png + .json

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 23):
* Falke von vorn mit nach oben gespreizten Flügeln (V-Form), nur 11 Gelbtöne: Umriss (213,170,33), Federn (244,214,66)/(249,238,103)/(249,243,174), Lichter (249,247,224).
  - Flügel: links x 0–19, rechts x 27–46 (y 0–32), Spitzen oben außen (x 2–4 / 42–44, y 0), Ansatz an den Schultern bei x 19 / 27 (y 14–31).
  - Kopf/Brust (x 20–26, y 21–33): Kopf oben (y 21–27) mit dunkleren Schnabel-/Augenstrichen (22,26) (24,26) (23,27–28) — keine eindeutigen Augen, deshalb kein Blinzeln.
  - Beine/Krallen und Schwanz (y 34–42, x 16–30): zwei Fänge mit Krallen, Mitte Schwanz.
* Fünf goldene Kugeln (Lunatic Cycle, Edelstein-artig, Plusform 4×4 / 5×4, Farben (244,196,38) (244,214,66) (249,238,103) (250,242,130) (249,246,199)):
  an den Flügelspitzen (1–4, 0–3) und (42–45, 0–3), an den Schultern (16–19, 14–17) und (27–30, 14–17), auf dem Kopf (21–25, 21–24).

Ablauf (48 Frames à 65 ms = 3,12 s) — er FLIEGT; Frame 0 = Originalpose (Flügel oben):
* Flügelschlag (RUNDE 2, Nutzer: „langsamere, dafür aber kraftvollere, weitere Flügelschläge“): ein Schlag = 24 Frames (1,56 s statt vorher 0,78 s), 2 Schläge pro Schleife; kräftiger Abschlag in 10 Frames
  (650 ms), langsamerer Aufschlag in 14 Frames, an den Wendepunkten weich. Jeder Flügel dreht sich als Ganzes um die Schulter (Leinwand x 18 / 28, y 23; F.drehen, Nächster-Nachbar, glatt=True; Rückwärtsabbildung,
  keine Löcher) um bis zu 80°: von der V-Stellung (Spitze 54° über der Waagerechten) bis etwa 26° UNTER die Waagerechte — die Spannweite wächst dabei von 47 auf rund 66 px (vorher nur ein Spaltenversatz um 8 px,
  der die Flügel nur bis zur Waagerechten brachte). Die Leinwand ist entsprechend breiter (71 px). Beide Flügel schlagen gleichzeitig, die Flügel liegen hinter dem Körper (Kopf/Brust). Frame 0 = Original.
  Die ältere Spaltenverschiebung wurde verworfen: bei 19 px Hub zerfiel die Feder-Textur in Rauschen und die Flügel wurden zu Rechtecken.
* Die Kugeln an Flügelspitzen/Schultern bleiben starre 4×4-/5×4-Sprites und wandern mit dem gedrehten Mittelpunkt ihres Flügels (ganzzahlig gerundet, nicht gedreht, damit die Plusform bleibt).
* Bob: die ganze Figur hebt sich im Takt bis 5 px über die Ruhelage (am höchsten kurz nach dem Abschlag, Frame 0 = Original). Fänge und Schwanz baumeln nach (60 %, 1,5 Frames verzögert; die Lücke füllen doppelte Zeilen).
* Kugeln (Edelsteine, Gold): pulsieren — je Pixel eine Stufe heller auf der Kugelrampe, die Hellphase wandert (Facetten); reihum blitzt an jeder Kugel ein kleiner Glitzerstern auf
  (Frame 2–5, 12–15, 21–24, 31–34, 40–43), er folgt der Kugel. Die Federn glänzen nicht.
* Goldstaub-Partikel (1-px-Punkte) entfernt (Regel 25: keine isolierten 1-px-Punkte; im Zweifel weglassen).
* RUNDE 3 (Nutzer: „passt, könnte aber noch ein paar Mondlicht-Particles brauchen“): acht blasse Mondlicht-Klekse (2×2 / 4×4 / 5×3, nie kleiner als 2×2; Farben (249,247,224) Kern, (249,243,174) Rand — beide aus dem Sprite),
  die langsam aufsteigen und dabei leicht hin und her schweben (Lebensdauer = Schleife, wachsen/schrumpfen, nahtlos). Sie liegen HINTER dem Falken (verschwinden hinter Flügeln/Körper). Sonst ist alles unverändert.

Ergänzungen: keine nötig — die Falken-Ebene ist vollständig (auch unter den Kugeln).
Randpixel-Test (Regel 16): verschobene Federspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel (und Sternarme am Rand) werden in der Umrissfarbe ihrer Ebene gesetzt:
Federn (213,170,33), Kugeln/Stern (244,214,66) (B.umriss_je_ebene).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 24, 10                                        # Frames je Schlag (1,56 s), davon Abschlag (650 ms)
PAD_L, PAD_R, PAD_T, PAD_B = 12, 12, 2, 2

spr = L.lade('lunatic-hawk')                               # Falke + Kugeln (Ruhepose / Referenz für den Randpixel-Test)
falke = L.lade('lunatic-hawk-falke')
orbs = L.lade('lunatic-hawk-orbs')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
xx = np.arange(sw)
yy = np.arange(sh)
CUT = 34                                                   # ab dieser Zeile beginnen Fänge und Schwanz


def teil(a, maske_x, y0=0, y1=sh):
    m = maske_x[None, :, None] & ((yy >= y0) & (yy < y1))[:, None, None]
    return L.platz(np.where(m, a, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


FL_L, FL_R = teil(falke, xx <= 19, 0, CUT), teil(falke, xx >= 27, 0, CUT)
KOERPER = teil(falke, (xx >= 20) & (xx <= 26), 0, CUT)
BEINE = teil(falke, xx >= 0, CUT, sh)
OB = {'tl': teil(orbs, xx <= 10), 'sl': teil(orbs, (xx >= 11) & (xx <= 19)), 'sr': teil(orbs, (xx >= 27) & (xx <= 35)), 'tr': teil(orbs, xx >= 36)}
OB_C = teil(orbs, (xx >= 20) & (xx <= 26))

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
OUTLINE, ORB_GELB = (213, 170, 33), (244, 214, 66)
ERLAUBT = {(213, 170, 33), (244, 214, 66), (244, 196, 38)}                 # Umrissfarben der Quelle (Randpixel-Test)
EBENEN_FARBE = {0: ORB_GELB, 1: OUTLINE, 2: OUTLINE, 3: OUTLINE, 4: OUTLINE, 5: ORB_GELB}
RAMPE = [(244, 196, 38), (244, 214, 66), (249, 238, 103), (250, 242, 130), (249, 246, 199)]    # Kugelrampe (dunkel → hell)
STERN_KERN, STERN_ARM = (249, 247, 224), (249, 246, 199)
STERNE = [((2, 1), 2, 'tl'), ((17, 15), 12, 'sl'), ((23, 22), 21, 'K'), ((28, 15), 31, 'sr'), ((43, 1), 40, 'tr')]    # Mitte (Sprite), Startframe, Kugel


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag (RUNDE 2: langsamer, weiter, kraftvoller) ────────────────────────────────────────────────────────────────
SWING = math.radians(80.0)                                 # Gesamtausschlag: von der V-Stellung (Spitze 54° über der Waagerechten) bis ca. 26° UNTER die Waagerechte
PIV_L = (PAD_L + 18, PAD_T + 23)                           # Schultergelenk links (Leinwand); rechts gespiegelt um x = 23
PIV_R = (PAD_L + 28, PAD_T + 23)
ORB_MITTE = {'tl': (2.5, 1.5), 'sl': (17.5, 15.5), 'sr': (28.5, 15.5), 'tr': (43.5, 1.5)}      # Mittelpunkte der Kugeln (Sprite) — wandern starr mit dem Flügel


def welle(t):
    """Schlagphase 0 (Flügel oben = Original) … 1 (unten): kräftiger Abschlag in DOWN Frames, langsamer Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def winkel(t):
    """Drehwinkel des linken Flügels (negativ = gegen den Uhrzeigersinn = Flügel schlägt nach unten); der rechte bekommt das Spiegelbild."""
    return -SWING * welle(t)


def dreh_punkt(p, piv, ang):
    """Wohin ein Punkt p (Leinwand) bei Drehung um piv um ang wandert (wie F.drehen: positiv = im Uhrzeigersinn)."""
    dx, dy = p[0] - piv[0], p[1] - piv[1]
    return piv[0] + dx * math.cos(ang) - dy * math.sin(ang), piv[1] + dx * math.sin(ang) + dy * math.cos(ang)


def orb_versatz(name, t):
    """Ganzzahliger Versatz (dx, dy) einer Flügelkugel zum Frame t: die Kugel bleibt ein starres 4×4/5×4-Sprite und folgt nur ihrem Mittelpunkt."""
    ang = winkel(t)
    links = name in ('tl', 'sl')
    piv = PIV_L if links else PIV_R
    mx, my = ORB_MITTE[name]
    c = (PAD_L + mx, PAD_T + my)
    n = dreh_punkt(c, piv, ang if links else -ang)
    return int(round(n[0] - c[0])), int(round(n[1] - c[1]))


# ── Flug ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
BOB_AMP, BOB_MAX_T = 2.5, 11.0


def bob(t):
    """Versatz in px (negativ = oben): Frame 0 = tiefste Lage (Original), am höchsten (−4) kurz nach dem Abschlag unten."""
    return -int(round(BOB_AMP * (1.0 + math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT))))


def bein_versatz(t):
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def kugeln(a, i):
    """Pulsieren: je Kugelpixel eine Stufe heller auf der Kugelrampe, wenn die wandernde Hellphase ihn trifft."""
    out = a.copy()
    ys, xs = np.nonzero(a[..., 3])
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in RAMPE and i % N and F.puls(i, N, x, y, 4, 0.9):
            out[y, x, :3] = RAMPE[min(len(RAMPE) - 1, RAMPE.index(c) + 1)]
    return out


TEST_EBENEN = ('fluegel', 'koerper')                        # für den Randpixel-Test: ohne Partikel

# ── Mondlicht (Runde 3): blasse Klekse, steigen langsam auf ────────────────────────────────────────────────────────────
MOND = {'c': (249, 247, 224), 'r': (249, 243, 174)}
MOND_PUFFS = [
    dict(x=6, y=40, vx=1, vy=-17, off=0, form='o', wackeln=1),
    dict(x=64, y=38, vx=-1, vy=-16, off=8, form='m', wackeln=1),
    dict(x=14, y=42, vx=-2, vy=-20, off=16, form='s', wackeln=1),
    dict(x=58, y=43, vx=2, vy=-22, off=24, form='o', wackeln=1),
    dict(x=35, y=11, vx=0, vy=-6, off=32, form='s', wackeln=1),
    dict(x=9, y=26, vx=-1, vy=-14, off=40, form='m', wackeln=1),
    dict(x=62, y=24, vx=1, vy=-13, off=4, form='s', wackeln=1),
    dict(x=29, y=44, vx=-2, vy=-12, off=20, form='o', wackeln=1),
]


def mondlicht(i):
    """Wie L.puff_ebene, aber ohne 1-px-Stufe (Regel 25): unsichtbar → 2×2 → volle Form → 2×2 → unsichtbar."""
    ebene = L.leer(H, W)
    for pf in MOND_PUFFS:
        t = ((i + pf['off']) % N) / N
        if t < 0.12 or t >= 0.88:
            continue
        form = pf['form'] if 0.3 <= t < 0.7 else 's'
        cx = int(round(pf['x'] + pf['vx'] * t + pf['wackeln'] * math.sin(2 * math.pi * t)))
        cy = int(round(pf['y'] + pf['vy'] * t))
        for dx, dy, k in L.PUFF_FORMEN[form]:
            if not (0 <= cy + dy < H and 0 <= cx + dx < W):
                raise L.ClipError('Mondlicht außerhalb der Leinwand')
            ebene[cy + dy, cx + dx, :3] = MOND[k]
            ebene[cy + dy, cx + dx, 3] = 255
    return ebene


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    dy_u, dy_f = bob(i), bein_versatz(i)
    ang = winkel(i)
    schichten = []
    if 'fluegel' in ebenen:
        # Flügel drehen sich starr um die Schulter (Rückwärtsabbildung, Nächster-Nachbar; einzelne Spitzenpixel/Kerben der Drehkante werden bereinigt)
        fl = F.drehen(FL_L, PIV_L[0], PIV_L[1], ang, glatt=True)
        fr = F.drehen(FL_R, PIV_R[0], PIV_R[1], -ang, glatt=True)
        schichten += [(fl, 0, dy_u, 1), (fr, 0, dy_u, 2)]
    if 'koerper' in ebenen:
        beine = BEINE
        if dy_f - dy_u > 0:
            beine = L.streck_zeile(beine, PAD_T + CUT, dy_f - dy_u)          # schmale Zeile 34 (Schwanzansatz) doppelt: Fänge hängen tiefer
        schichten += [(KOERPER, 0, dy_u, 3), (beine, 0, dy_f, 4)]
    if 'fluegel' in ebenen:
        for name in ('tl', 'sl', 'sr', 'tr'):
            dx, dy = orb_versatz(name, i)
            schichten += [(kugeln(OB[name], i), dx, dy + dy_u, 5)]
    if 'koerper' in ebenen:
        schichten += [(kugeln(OB_C, i), 0, dy_u, 5)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    if 'fluegel' in ebenen:
        for (mx, my), start, name in STERNE:                  # Glitzerstern an der Kugel (Edelstein), folgt Kugel und Bob
            st = F.stern_stufe(i, N, start, (0, 1, 2, 1))
            if st is None:
                continue
            dx, dy = orb_versatz(name, i) if name != 'K' else (0, 0)
            F.stern(f, PAD_L + mx + dx, PAD_T + my + dy + dy_u, st, STERN_KERN, STERN_ARM)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel and nur is None:                              # Mondlicht HINTER dem Falken
        hint = mondlicht(i)
        m = f[..., 3] > 0
        hint[m] = f[m]
        f = hint
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('lunatic-hawk', 'Lunatic Hawk', frames, MS, prev)
    if prev:
        L.streifen(prev + '/lunatic-hawk-strip.png', frames, spalten=8, scale=5)
