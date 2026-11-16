# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Ultimate Gun“ (Creature).

PICK: [["MotiveGrailWar", 576, 1], ["MotiveGrailWar", 579, 1]]
Quelle: src/spirit-of-the-ultimate-gun.png (33×34 px, 20 Farben, nur Alpha 0/255) = Ebene 576 „Gun Spirit“ (33×30) und DAHINTER Ebene 579 „Ebene #6“ (17×20, violetter Kristall, liegt in der xcf 8 px rechts und 4 px
über der Oberkante der Figur; nur seine Spitze schaut über dem Kopf heraus). Gegen die Kartenkunst abgeglichen (data/card-art/native/Spirit_of_the_Ultimate_Gun.png, Figur bei (22, 8)): Form und Lage stimmen, die violette
Spitze über dem Kopf ist auf der Karte zu sehen. NICHT übernommen (Effekte/Szene der Karte, eigene Ebenen): der rote Laserstrahl mit Zielring aus dem Maul (Ebenen 571/580, halbtransparent, über 100 px lang),
die türkisen Blitze (577/581), die Flammen (578) und der Boden.

Aufruf:   python3 spirit_of_the_ultimate_gun.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/spirit-of-the-ultimate-gun.png + .json

Was ist was (x/y im Sprite):
* Violetter Kristall (x 11–21, y 0–5): dunkler Kern (15–17) mit helleren Facetten links/rechts (J hell, N kräftig) — Edelstein, sitzt hinter dem Kopf.
* Kopf/Rumpf (x 8–24, y 4–21): grau gepanzerter Block (Metall, Grautöne (82,81,82) Umriss … (206,207,206)), zwei rote Augen (je 8 px, x 12–14 und 18–20, y 9–11, Rot in drei Stufen) unter schwarzen Brauen (y 8),
  schwarze Nase (15–17, 12–13), darunter das Maul = Mündung (x 13–19, y 15–20) schwarz mit weißen Zähnen (255,255,255).
* Fahrgestell (y 21–31): Brücke x 5–26 (y 21–25), darunter zwei graue Streben (x 8–11 und 21–24, y 26–31).
* Zwei schwarze Räder (x 3–7 und 25–29, y 22–33; Schwarz/(26,26,26)/(51,51,51)) mit je zwei hellen Spikes nach außen: links Zeilen 25–26 (x 0–3) und 28–29 (x 1–4), rechts gespiegelt.
Fest bleiben: Kopfform, Maul/Zähne, Nase, Brauen, Radkörper. Der Kopf bewegt sich nie seitlich.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos; Frame 0 = Original):
* [Runde 5: ERSETZT — die ganze Figur samt Rädern und Spikes hebt/senkt sich jetzt gleichmäßig 0–2 px (Periode 16 Frames, weich über eine Zwischenstufe), siehe GANZ_HUB; kein Rütteln des Aufbaus mehr]
  Früher: Fahr-Rütteln (Nutzerwunsch wie beim Coreling: „da er permanent fährt, soll er sich auch leicht auf und ab bewegen“): der ganze Aufbau (Kristall, Kopf, Brücke, Streben) wird in unregelmäßigen kurzen Stößen
  (2–3 Frames, sechsmal je Schleife) als starres Stück 1 px angehoben und fällt zurück; Räder und Spikes bleiben am Boden.
* Räder drehen sich (wie beim Coreling): die zwei Spikes je Rad wandern am Radrand von oben nach unten (1 Zeile alle 2 Frames, 6 Zeilen = 1 Umlauf = 12 Frames, 4 Umläufe je Schleife); oben knospt ein Spike
  (2 Pixel), unten taucht er ein (2 Pixel). Die Spike-Pixel sind die des Originals (Hauptzeile C-F-D-M, Nebenzeile E-M), verankert am Radrand der jeweiligen Zeile.
* Blinzeln: beide Augen, Frames 15–18 und 39–42 (linkes einen Frame früher): obere Augenzeile → Lid, dann ganz zu (Lid = umgebendes Panzergrau (128,126,128), untere Zeile als dunkle Lidlinie (82,81,82)).
* Stahlglanz (Metall, Regel 14): zweimal je Schleife (Start Frame 4 und 28, 12 Frames) läuft ein diagonales Lichtband über die grauen Panzerflächen (eine Stufe heller auf der Grau-Rampe); Umriss, Schwarz, Augen,
  Zähne, Kristall und Räder bleiben.
* Kristall (Edelstein, Regel 12c): pulsiert zweimal je Schleife leicht (Frames 20–25 und 44–47/0–1 … hier 44–47): die kräftigen Facetten (60,24,146) werden eine Stufe heller (101,79,153), die Saumpixel (43,17,105) kräftig.
ERGÄNZUNGEN (Farben der Quelle):
* Radrand unter den Spikes: wandert ein Spike weiter, wird der Radrand an seiner Originalstelle geschlossen — links (3,25), (3,26), (4,28), (4,29) Schwarz (0,0,0); rechts (29,25), (29,26), (28,28), (28,29) (26,26,26).
* Naht Aufbau/Rad im angehobenen Zustand: die frei werdenden Zellen an der Naht (x 5–7 bzw. 25–27) behalten die Pixel der Ruhepose (links (5,22), (6,22), (7,24); rechts (25,24), (26,21)) — keine Lücke zwischen Rad und Aufbau.
Keine Partikel, kein Feuer. Frame: Sprite plus 2 px links/rechts/unten, 3 px oben (1 px Hub). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2   # oben 4: 2 px Hub der ganzen Figur (Runde 5) + 2 px Rand

spr = L.lade('spirit-of-the-ultimate-gun')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = L.deckend(spr)

CA, CB, CC, CD, CE, CF, CG, CH, CK, CM = (82, 81, 82), (0, 0, 0), (206, 207, 206), (151, 149, 151), (128, 126, 128), (185, 186, 185), (26, 26, 26), (113, 112, 113), (51, 51, 51), (90, 89, 90)
VJ, VN, VS = (101, 79, 153), (60, 24, 146), (43, 17, 105)
ROT = [(213, 0, 0), (164, 0, 0), (108, 0, 0)]
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CK, CM, VJ, VN, VS, *ROT):
    assert _c in _farben, _c


def col(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile ──
RADFARBEN = L.farbmaske(spr, [CB, CG, CK])
SPIKE_M = OPAK & (yy >= 25) & (yy <= 29) & (yy != 27) & ((xx <= 3) | ((xx == 4) & (yy >= 28)) | (xx >= 29) | ((xx == 28) & (yy >= 28))) & ~RADFARBEN
assert int(SPIKE_M.sum()) == 24, int(SPIKE_M.sum())
RAEDER = OPAK & (yy >= 22) & ((xx <= 7) | (xx >= 25)) & RADFARBEN
AUFBAU = OPAK & ~RAEDER & ~SPIKE_M
KRISTALL = OPAK & (L.farbmaske(spr, [VJ, VN, VS]))

# Radrand (äußerste Radspalte je Zeile, vervollständigt; links, rechts gespiegelt x' = 32 − x) und Spike-Farben von außen nach innen
RAND_L = {23: 4, 24: 3, 25: 3, 26: 3, 27: 3, 28: 4, 29: 4, 30: 4}
HAUPT = [CM, CD, CF, CC]                                             # von innen (am Rad) nach außen
NEBEN = [CM, CE]
assert [col(x, 25) for x in (3, 2, 1, 0)] == HAUPT and [col(x, 26) for x in (3, 2)] == NEBEN
assert [col(x, 28) for x in (4, 3, 2, 1)] == HAUPT and [col(x, 29) for x in (4, 3)] == NEBEN
assert [col(x, 25) for x in (29, 30, 31, 32)] == HAUPT and [col(x, 29) for x in (28, 29)] == NEBEN
RADFUELL = [(3, 25, CB), (3, 26, CB), (4, 28, CB), (4, 29, CB), (29, 25, CG), (29, 26, CG), (28, 28, CG), (28, 29, CG)]

SPIKE_SCHRITT, SPIKE_ZYKLUS = 2, 6
SPIKE_START = (2, 5)                                                 # Position p = Zeile 23 + p; Schritt 0: Zeilen 25 und 28 (Original)


def spikes_ebene(i):
    out = L.leer(H, W)

    def px(x, y, c, seite):
        X = x if seite == 'L' else 32 - x
        out[PAD_T + y, PAD_L + X, :3] = c
        out[PAD_T + y, PAD_L + X, 3] = 255
    s = (i // SPIKE_SCHRITT) % SPIKE_ZYKLUS
    for seite in ('L', 'R'):
        for p0 in SPIKE_START:
            y = 23 + (p0 + s) % SPIKE_ZYKLUS
            if y == 23:                                              # knospt oben (2 Pixel) und taucht gleichzeitig unten ein (2 Pixel in Zeile 29)
                for k in range(2):
                    px(RAND_L[23] - k, 23, HAUPT[k], seite)
                    px(RAND_L[29] - k, 29, HAUPT[k], seite)
                continue
            for k, c in enumerate(HAUPT):
                px(RAND_L[y] - k, y, c, seite)
            for k, c in enumerate(NEBEN):
                px(RAND_L[y + 1] - k, y + 1, c, seite)
    return out


# ── Augen ──
AUGE_L = [(x, y) for y in (9, 10, 11) for x in range(11, 15) if col(x, y) in ROT]
AUGE_R = [(x, y) for y in (9, 10, 11) for x in range(18, 22) if col(x, y) in ROT]
assert len(AUGE_L) == 8 and len(AUGE_R) == 8, (len(AUGE_L), len(AUGE_R))
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}

# ── Glanz ──
HELLER = {CM: CH, CH: CE, CE: CD, CD: CF, CF: CC}
KANTE = np.zeros((sh, sw), bool)
for _y in range(sh):
    for _x in range(sw):
        if OPAK[_y, _x] and any(not (0 <= _y + dy < sh and 0 <= _x + dx < sw) or not OPAK[_y + dy, _x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            KANTE[_y, _x] = True
GLANZ_M = AUFBAU & ~KANTE & (yy >= 5)
SWEEPS = [4, 28]
PULS = set(range(20, 26)) | set(range(42, 47))

# ── Fahr-Rütteln ──
HUB_FRAMES = {4, 5, 6, 11, 12, 18, 19, 20, 26, 27, 32, 33, 34, 40, 41}
HUB = [0] * N                                                                          # Runde 5: kein Rütteln des Aufbaus mehr (Aufbau und Räder bleiben zueinander starr)
# ── Runde 5 (Nutzer: „sollten *als Ganze* auf und ab bewegt werden, nicht nur ‚wackeln‘ (also inklusive ihrer Reifen)“): die GANZE Figur samt Rädern und Spikes hebt und senkt sich gleichmäßig
# (weich über eine Zwischenstufe: 0 → 1 → 2 → 1 → 0 px, Periode 16 Frames, dreimal je Schleife); Frame 0 = Ruhe (Original).
GANZ_HUB = [int(round(1 - math.cos(2 * math.pi * i / 16))) for i in range(N)]
NAHT = AUFBAU & (yy >= 21) & (((xx >= 5) & (xx <= 7)) | ((xx >= 25) & (xx <= 27)))


def sprite_mit_effekten(i):
    sp = spr.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 11:
            t = 6 * (i - s0) - 3
            m = GLANZ_M & (xx + yy >= t) & (xx + yy < t + 4)
            for alt, neu in HELLER.items():
                sp[m & L.farbmaske(spr, [alt]), :3] = neu
    if i in PULS:
        sp[L.farbmaske(spr, [VN]), :3] = VJ
        sp[L.farbmaske(spr, [VS]), :3] = VN
    for auge, plan in ((AUGE_L, BLINZELN_L), (AUGE_R, BLINZELN_R)):
        b = plan.get(i, 0)
        for (x, y) in auge:
            if b == 1 and y == 9:
                sp[y, x, :3] = CE
            elif b == 2:
                sp[y, x, :3] = CA if y == 11 else CE
    return sp


def _platz(sp, maske):
    return L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


def figur(i):
    sp = sprite_mit_effekten(i)
    rad = _platz(sp, RAEDER)
    for (x, y, c) in RADFUELL:
        rad[PAD_T + y, PAD_L + x, :3] = c
        rad[PAD_T + y, PAD_L + x, 3] = 255
    ebenen = [(rad, 0, 0)]
    if HUB[i]:
        ebenen.append((_platz(sp, NAHT), 0, 0))                      # Naht: Ruhepixel bleiben unter dem angehobenen Aufbau stehen (keine Lücke zum Rad)
    sk = spikes_ebene(i)
    ebenen += [(_platz(sp, AUFBAU), 0, -HUB[i]), (sk, 0, 0)]
    fig = L.zusammen(H, W, ebenen)
    # Randpixel-Regel: das innerste Spike-Pixel (90,89,90) liegt im Original nie frei; wo es an einer anderen Radzeile am Rand zu liegen kommt, nimmt es die Spike-Randfarbe (151,149,151) an
    for y, x in zip(*np.nonzero(sk[..., 3])):
        if tuple(int(v) for v in fig[y, x, :3]) == CM and any(not fig[y + dy, x + dx, 3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            fig[y, x, :3] = CD
    return L.versetze(fig, 0, -GANZ_HUB[i])                         # Runde 5: die ganze Figur (samt Rädern) hebt/senkt sich


def frame(i, nur=None):
    return figur(i)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('Pixel je Frame:', L.pruefe(frames, quelle=spr))
    L.speichern('spirit-of-the-ultimate-gun', 'Spirit of the Ultimate Gun', frames, MS, prev)
    if prev:
        L.streifen(prev + '/spirit-of-the-ultimate-gun-strip.png', frames[::2], spalten=12, scale=6)
