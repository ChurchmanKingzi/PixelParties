# -*- coding: utf-8 -*-
"""Idle-Animation für „Shiny Slime“ (Creature).

PICK: [["Motive", 465, 1]]
Quelle: src/shiny-slime.png — Ebene „Shiny Slime“ (18×19 px, 21 Farben) aus Motive.xcf.

Aufruf:   python3 shiny_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shiny-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Krone, Zeilen 0–7: drei Zacken (Spitzen bei x 4–5, 8–9, 12–13), rotes Kreuz-Juwel (x 7–10, y 1–4; Rottöne S/L/M), helle Goldpixel
  (3,1), (5,1), (12,1), (14,1), weißes Band (y 6–7, Endpunkte (4,6) und (13,6) weiß; wohl Hermelinbesatz). Starres Teil.
* Schleimkörper, Zeilen 8–18: goldener Gelkörper mit dunklem Umriss (96,83,0); oben Kopfglanz (8–9, 8); Augen = gelbe Flecken
  (5–6, 10–11) und (11–12, 10–11) mit weißem Lichtpunkt (6,11)/(11,11) und dunkler Außenseite (4,10–11)/(13,10–11); bleichgrüner
  „Glaskern“ (x 6–11, y 9–13); Mund = dunkles Band (6–10, 14) mit Schatten (7–10, 15), Mundwinkel (11,13); breite Pfütze (y 14–18)
  mit hellen Glanzflecken (4–6, 16), (10–11, 17), (11, 15). Fest: Glaskern, Mundwinkel, Pfützenrand.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (0–15, 24–31): Körper streckt sich/staucht sich um 1 Zeile (Zeile 12 verdoppelt/entfernt; Augen und Krone heben sich, bei der
  Stauchung wird der Körper je Seite 1 px breiter). Kopf lehnt sich 1–2 px (Zeilen 8–13, Pfütze fest), Periode 24 Frames.
* Kleiner Hüpfer (16–23, 1 px) und großer Hüpfer (32–47, 3 px) mit Anlauf-Stauchung, gestrecktem Absprung/Fallen, Aufprall (−2 Zeilen,
  je Seite 2 px breiter) und abklingendem Nachwabbeln. Die Krone sinkt bei schnellen Sprüngen 1 px in den Kopf.
* Blinzeln: Frames 13–15 und 44–46.
* **Glanz der Krone und des Körpers** (Regel 12):
  - Lichtband: zweimal pro Schleife (Frames 2–12 und 26–36) wandert ein diagonales Band über den Sprite; auf der Krone 1–2 Stufen
    heller (Goldrampe E→C→B→D→G, Glanzflecken G→Weiß, Juwel S→L→M), am Goldkörper sanft 1 Stufe.
  - Vierzackige Glitzersterne (Mitte + 4 Arme, 5 Frames: Punkt → Kreuz → lang → Kreuz → Punkt) blitzen an Kronenzacken, Kronenohren,
    Juwel, Hermelinband und an den Glanzflecken des Körpers auf, jeweils wenn das Lichtband vorbeizieht, dazwischen einzeln.
    Sie bleiben AM Objekt (Krone: mit der Krone, Körperstellen: durch den Umbau verfolgt) und werden vor die Figur gezeichnet.
  - Juwel pulsiert (Periode 16 Frames): eine Stufe heller/dunkler. Augen-Glanzpunkte funkeln (Frames 10–12 und 37–39: dunkel → hell → Mini-Stern).
* Goldstaub (Partikel, runde Punkte 1–2 px, Farben des Sprites): acht Glitzerpunkte steigen langsam neben Krone und Körper auf.
Ergänzungen: Ist der Kopf (Stauchung) breiter als die Krone, läge seine Oberkante neben der Krone ohne Umriss frei. Dann wird die
Umrissfarbe (96,83,0) in die Zeile über der Kopfoberkante gesetzt (1–2 px beiderseits der Krone, 4-verbunden an Kopf und Kronenumriss).
Nähte (Regel 11): Krone und Kopf bewegen sich seitlich immer um denselben Wert und liegen vertikal 4-verbunden aufeinander; je Frame
prüft das Skript, dass die Figur aus genau einem 4-zusammenhängenden Teil besteht und kein Randpixel außer der Umrissfarbe frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 10, 3

spr = L.lade('shiny-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1                      # Leinwandzeile der Körper-Unterkante im Ruhezustand
KOERPER_Y0 = 8                              # erste Körperzeile im Sprite (darüber: Krone)

# ── Farben der Quelle ──
GOLD_E, GOLD_C, GOLD_B, GOLD_D, GOLD_G = (143, 132, 4), (152, 141, 26), (170, 161, 58), (184, 176, 86), (229, 227, 144)
ROT_S, ROT_L, ROT_M = (187, 37, 36), (207, 27, 38), (213, 49, 56)
DUNKEL_F = (79, 75, 14)                      # Augenlinie
WEISS, WEISS_N, AUGEN_U = (255, 252, 255), (244, 242, 243), (243, 255, 230)
UMRISS = (96, 83, 0)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for c in (GOLD_E, GOLD_C, GOLD_B, GOLD_D, GOLD_G, ROT_S, ROT_L, ROT_M, DUNKEL_F, WEISS, WEISS_N, AUGEN_U, UMRISS):
    assert c in _farben, f'Farbe {c} nicht im Sprite'
GOLDRAMPE = {GOLD_E: GOLD_C, GOLD_C: GOLD_B, GOLD_B: GOLD_D, GOLD_D: GOLD_G}
KRONE_RAMPE = {**GOLDRAMPE, GOLD_G: WEISS, ROT_S: ROT_L, ROT_L: ROT_M}        # Krone: Gold, Glanzpunkte, Juwel
KOERPER_RAMPE = {**GOLDRAMPE, GOLD_G: WEISS}
JUWEL_HELL, JUWEL_DUNKEL = {ROT_S: ROT_L, ROT_L: ROT_M}, {ROT_M: ROT_L, ROT_L: ROT_S}
STERN_FARBEN = {'m': WEISS, 'a': WEISS_N, 's': GOLD_G}

AUGEN_L, AUGEN_R = [(5, 10), (6, 10), (5, 11), (6, 11)], [(11, 10), (12, 10), (11, 11), (12, 11)]
AUSSEN_OBEN = [(4, 10), (13, 10)]            # dunkle Augenaußenseite oben (fällt beim Schließen weg)
GLINT = [(6, 11), (11, 11)]                  # weiße Augen-Lichtpunkte

# ── Zeitachsen (Frame → Wert), N = 48 ──
S = [0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0,                       # 0–15 Atmen
     -1, -1, 1, 1, -1, 1, 0, 0,                                                # 16–23 kleiner Hüpfer
     0, 0, 1, 1, 1, 1, 0, 0,                                                   # 24–31 Atmen
     -1, -2, -2, 2, 2, 1, 0, 1, 2, 2, -2, -1, 1, 0, 0, 0]                      # 32–47 großer Hüpfer
LIFT = {18: 1, 19: 1, 35: 1, 36: 2, 37: 3, 38: 3, 39: 3, 40: 2, 41: 1}
BLINZELN = {13: 1, 14: 2, 15: 1, 44: 1, 45: 2, 46: 1}                          # 1 = Lid halb, 2 = zu
JUWEL_PULS = [int(round(math.sin(2 * math.pi * i / 16))) for i in range(N)]    # −1, 0, +1
SWEEPS = [2, 26]                                                                # Startframes der Lichtbänder (je 11 Frames)
assert len(S) == N

# Körperzeilen: Index 0 = Sprite-Zeile 8 … 10 = Zeile 18
GEWICHT = [1.0, 1.0, 0.8, 0.6, 0.4, 0.2, 0, 0, 0, 0, 0]
POSEN = {                                                                       # s → (löschen, doppeln, p)
    -2: ({1, 4}, (), 2), -1: ({4}, (), 1), 0: ((), (), 0), 1: ((), {4}, 0), 2: ((), {1, 4}, -1),
}
PAARE_BREIT = ((8, 9), (7, 10), (6, 11))
PAARE_SCHMAL = ((3, 14), (4, 13))
PAARE_ZEILE0 = [(5, 12), (6, 11)]                                              # Kopfzeile: neben dem Glanz (8,9)


def lehnen(i):
    """Seitliche Neigung des Kopfes (in Pixeln an der Oberkante, vor dem Runden)."""
    if 16 <= i <= 19 or 32 <= i <= 41:
        v = 0.0                                                                  # in der Luft kein Lehnen
    elif 20 <= i <= 23:
        k = i - 20
        v = 1.8 * (1 - k / 5) * math.sin(2 * math.pi * k / 6)                    # Nachwabbeln nach dem kleinen Hüpfer
    elif i >= 42:
        k = i - 42
        v = 2.4 * (1 - k / 7) * math.sin(2 * math.pi * k / 6)                    # Nachwabbeln nach dem großen Hüpfer
    else:
        v = 1.4 * math.sin(2 * math.pi * i / 24)                                 # Leerlauf
    return max(-2.4, min(2.4, v))


# ── Glitzer: Orte (Sprite-Koordinaten), Lebenslauf und Zeitplan ──
ORTE = {'ohr_l': (3, 1), 'zack_l': (5, 1), 'juwel': (9, 1), 'zack_r': (12, 1), 'ohr_r': (14, 1),
        'band_l': (4, 6), 'band_m': (9, 7), 'band_r': (13, 6),
        'kopf': (8, 8), 'glanz_u': (5, 16), 'glanz_r': (10, 17), 'glanz_m': (11, 15), 'auge_l': (6, 11), 'auge_r': (11, 11)}
STERN_LAUF = [0, 1, 2, 1, 0]                                                    # 5 Frames: Punkt → Kreuz → lang → Kreuz → Punkt


def _stern_zeitplan():
    plan = []
    for sw0, orte in ((2, ['ohr_l', 'zack_l', 'band_l', 'zack_r', 'ohr_r', 'band_r', 'kopf', 'glanz_u']),
                      (26, ['zack_r', 'zack_l', 'band_m', 'ohr_r', 'kopf', 'glanz_r', 'glanz_m'])):
        for o in orte:
            d = sum(ORTE[o])                                                    # Diagonale x + y des Ortes
            peak = sw0 + (d - 4) / 3.0 + 0.5                                    # Frame, in dem das Band (Breite 4) den Ort trifft
            plan.append((int(round(peak)) - 2, o))
    plan += [(16, 'juwel'), (22, 'ohr_l'), (24, 'band_r'), (40, 'band_l'), (43, 'zack_l'), (46, 'ohr_r'), (19, 'zack_r'), (30, 'juwel')]
    return plan


STERNE = _stern_zeitplan()
AUGEN_FUNKELN = {10: 0, 11: 1, 12: 2, 37: 0, 38: 1, 39: 2}                      # Frame → Stufe (0 dunkel, 1 hell, 2 Mini-Stern)


def aktive_sterne(i):
    """[(ort, stufe)] aller Glitzersterne dieses Frames."""
    out = []
    for (start, ort) in STERNE:
        k = (i - start) % N
        if k < len(STERN_LAUF):
            out.append((ort, STERN_LAUF[k]))
    if AUGEN_FUNKELN.get(i) == 2 and not BLINZELN.get(i):                         # Mini-Stern auf beiden Augen-Lichtpunkten
        out += [('auge_l', 1), ('auge_r', 1)]
    return out


def sprite_mit_effekten(i):
    """Sprite (Quellkoordinaten) mit Blinzeln, Juwelpuls, Lichtband und Augenfunkeln — vor dem Umbau."""
    sp = spr.copy()
    yy = np.arange(sh)[:, None]
    krone = np.broadcast_to(yy < KOERPER_Y0, (sh, sw)).copy()
    # Juwel pulsiert
    if JUWEL_PULS[i] > 0:
        sp = A.farb_schritt(sp, JUWEL_HELL, krone)
    elif JUWEL_PULS[i] < 0:
        sp = A.farb_schritt(sp, JUWEL_DUNKEL, krone)
    # Lichtband (Krone kräftig: 1–2 Stufen, Körper sanft: 1 Stufe)
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 10:
            t = 2 + 3 * (i - s0)
            kr = np.zeros((sh, sw), bool)
            for y in range(sh):
                for x in range(sw):
                    kr[y, x] = t <= x + y < t + 4
            sp = A.farb_schritt(sp, KRONE_RAMPE, krone & kr)
            kern = np.zeros((sh, sw), bool)
            for y in range(sh):
                for x in range(sw):
                    kern[y, x] = t + 1 <= x + y < t + 3
            sp = A.farb_schritt(sp, GOLDRAMPE, krone & kern)
            ko = np.zeros((sh, sw), bool)
            for y in range(sh):
                for x in range(sw):
                    ko[y, x] = t <= x + y < t + 3
            sp = A.farb_schritt(sp, KOERPER_RAMPE, ~krone & ko)
    # Blinzeln
    b = BLINZELN.get(i, 0)
    if b:
        for (x, y) in AUGEN_L + AUGEN_R:
            if y == 10:
                sp[y, x, :3] = GOLD_B
            elif b == 2:
                sp[y, x, :3] = DUNKEL_F
        if b == 2:
            for (x, y) in AUSSEN_OBEN:
                sp[y, x, :3] = GOLD_B
    # Augen-Lichtpunkte funkeln
    f = AUGEN_FUNKELN.get(i)
    if f is not None and not b:
        for (x, y) in GLINT:
            sp[y, x, :3] = GOLD_D if f == 0 else WEISS
    return sp


GOLDSTAUB = [
    dict(x=PAD_L - 2, y=PAD_T + 12, vx=-1, vy=-7, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 9, vx=1, vy=-7, off=3, form='s', wackeln=1),
    dict(x=PAD_L - 1, y=PAD_T + 4, vx=-2, vy=-6, off=6, form='k', wackeln=1),
    dict(x=PAD_L + 17, y=PAD_T + 2, vx=2, vy=-6, off=9, form='s', wackeln=1),
    dict(x=PAD_L - 3, y=PAD_T + 16, vx=-1, vy=-8, off=12, form='k', wackeln=1),
    dict(x=PAD_L + 20, y=PAD_T + 14, vx=1, vy=-7, off=15, form='k', wackeln=1),
    dict(x=PAD_L + 6, y=PAD_T - 1, vx=-1, vy=-6, off=18, form='s', wackeln=1),
    dict(x=PAD_L + 12, y=PAD_T - 1, vx=1, vy=-6, off=21, form='k', wackeln=1),
]
STAUB = {'c': WEISS, 'r': GOLD_G}


def figur(i, tops=None):
    """Körper + Krone (ohne Partikel/Sterne) → dict(fig, kr, top, kb, cdx, cdy, orte)."""
    sp = sprite_mit_effekten(i)
    s = S[i]
    loesch, dopp, p = POSEN[s]
    # Körperorte der aktiven Sterne mit Markierfarben verfolgen
    marken = {}
    for k, (ort, stufe) in enumerate(aktive_sterne(i)):
        x, y = ORTE[ort]
        if y >= KOERPER_Y0:
            m = (1, 2, 10 + k)
            marken[ort] = (m, tuple(int(v) for v in sp[y, x, :3]))
            sp[y, x, :3] = m
    koerper = A.zeilen_von(sp, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p,
                               paare=PAARE_BREIT if p >= 0 else PAARE_SCHMAL,
                               paare_je_zeile={0: PAARE_ZEILE0}, x0=PAD_L)
    dxq = A.dx_zeilen(GEWICHT, lehnen(i), math.pi / 2)                          # sin(π/2) = 1 → round(lean · Gewicht)
    z = A.verschiebe_zeilen(z, quelle, dxq)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    orte = {}
    for ort, (m, orig) in marken.items():
        pos = A.suche_marke(kb, m)
        orte[ort] = pos
        kb[L.farbmaske(kb, [m]), :3] = orig
    # Krone: Zeilen 0–7 des Sprites; Unterkante liegt auf top−1 (bzw. top bei Einsinken)
    prev_top = (tops or {}).get('prev')
    sink = 0
    if prev_top is not None:
        if prev_top - top >= 2 or top - prev_top >= 3:
            sink = 1                                                              # schneller Sprung/Aufprall: Krone sinkt 1 px ein
    kr = L.platz(np.where((np.arange(sh)[:, None, None] < KOERPER_Y0), sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    cdx, cdy = dxq[0], top - KOERPER_Y0 - PAD_T + sink
    kr = L.versetze(kr, cdx, cdy)
    fig = L.zusammen(H, W, [(kb, 0, 0), (kr, 0, 0)])
    # Ergänzung: ist der Kopf (Stauchung) breiter als die Krone, braucht seine Oberkante neben der Krone einen Umriss — Umrissfarbe
    # (96,83,0) in die Zeile über der Kopfoberkante, 4-verbunden an Kopf und Kronenumriss.
    for x in np.nonzero(kb[top, :, 3])[0]:
        if tuple(int(v) for v in kb[top, x, :3]) != UMRISS and not fig[top - 1, x, 3]:
            fig[top - 1, x, :3] = UMRISS
            fig[top - 1, x, 3] = 255
    return dict(fig=fig, kr=kr, top=top, kb=kb, cdx=cdx, cdy=cdy, orte=orte)


def _tops():
    """Körperoberkante je Frame (für das Einsinken der Krone: schnelle Sprünge)."""
    out = []
    for i in range(N):
        loesch, dopp, p = POSEN[S[i]]
        n = 11 - len(loesch) + (sum(dopp.values()) if isinstance(dopp, dict) else len(dopp))
        out.append(BODEN - LIFT.get(i, 0) - n + 1)
    return out


TOPS = _tops()


def figur_i(i):
    return figur(i, {'prev': TOPS[(i - 1) % N]})


def sterne_ebene(i, f):
    """Glitzersterne dieses Frames (vor der Figur): Kronenorte folgen der Krone, Körperorte dem verfolgten Pixel."""
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        if y < KOERPER_Y0:
            cx, cy = PAD_L + x + f['cdx'], PAD_T + y + f['cdy']
        else:
            pos = f['orte'].get(ort)
            if pos is None:
                continue
            cx, cy = pos
        A.stern(e, cx, cy, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur_i(i)
    staub = L.puff_ebene(H, W, i, 24, GOLDSTAUB, STAUB)
    return L.zusammen(H, W, [(staub, 0, 0), (f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur_i(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    # Ruhepose = Original (Frame 0 ohne Partikel/Sterne)
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    f0 = figs[0]
    diff = int((f0 != ref).any(axis=2).sum())
    print('Frame 0 weicht vom Original in', diff, 'Pixeln ab (Juwel-Puls/Lichtband zulässig)')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = []
    for i in range(N):
        f = figur_i(i)
        offen += [(i, o) for o in A.offene_koerperkanten(f['fig'], f['kr'][..., 3] > 0, f['top'], UMRISS)]
    print('offene Körperkanten (Frame, (x, y, Farbe)):', offen if offen else 'keine')
    A.ausdruck_pruefen(figs, spr, 'shiny-slime', erlaubt=[GOLD_G, WEISS, ROT_S, ROT_M, ROT_L])
    L.speichern('shiny-slime', 'Shiny Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shiny-slime-strip.png', frames[::2], spalten=12, scale=5)
