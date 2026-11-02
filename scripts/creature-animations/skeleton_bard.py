# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Bard“ (Creature) — Runde 2: er spielt richtig Gitarre (nach Nutzer-Referenz ref5.png, mit mehr Frames).

Quelle: src/skeleton-bard.png — Ebene „Skeleton Bard“ (21×25 px, 339 Pixel, 25 Farben) aus Motive.xcf (Ebene 382, Figur 1, Treffer 1.0). Die bunten Musiknoten der Kartenkunst (Ebene 381)
sind eigene Ebenen weit um die Figur herum und NICHT Teil dieses Sprites.
PICK: [["Motive", 382, 1]]
Nutzer-Referenz: ref5.png (24×123 px, 4 Frames à 24×25 mit 8 px Abstand: die Figur an x = 2, y = 0 des Zellfelds; Frame 2 ist das Original). Die Referenz ändert nur zwei Dinge: den blauen
Handblock in der Brustmitte (dazu der braune Unterarm-Ärmel) und den blauen Handblock rechts oben am Gitarrenhals (samt Ärmelpixeln). Alle anderen Pixel sind in den vier Frames gleich.

Aufruf:   python3 skeleton_bard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-bard.png + .json

Was ist was (x/y im Sprite; Auswertung am Großbild + Vergleich der vier Referenzframes):
* Hut (x 0–14, y 0–9): schwarzer Schlapphut mit breiter Krempe und grauem Band; oben rechts eine blaue Feder (11–14, 0–3). Schädel (x 5–12, y 10–13): weißer Knochen unter der Krempe.
* GITARRE: der schwarz-weiß karierte Korpus (x 4–12, y 12–21) ist der Korpus der Knochengitarre, der diagonal nach rechts oben laufende dunkle Hals führt zum Kopf der Gitarre ganz rechts oben
  (x 16–20, y 4–8: grauer 2×2-Wirbelkasten (18–19, 5–6) mit weißen Wirbeln (17,4) (16,6) (20,7) (16,8) (18,8)). Er ist KEINE erhobene Hand; er bleibt fest.
* GRIFFHAND (rechter Arm, blauer Ärmel, vom Betrachter rechts): der blaue Block (5×4 px: Marine (0,6,32) mit Blauton (28,71,126)/(16,38,61), Kern (16,76,162)) liegt am Hals bei (13–17, 7–10);
  in der Referenz rutscht er diagonal nach links unten ((13,7) → (12,8) → (11,9)) und einmal nach (13,8). Dahinter hängen zwei braune Ärmelpixel ((16,10) (16,11) bzw. (15,11)).
* SCHLAGHAND (linker Arm, brauner Ärmel, vom Betrachter links): Oberarm x 1–3, y 11–16 hängt fest; der Unterarm (zwei braune Kanten mit weißem Kern) greift nach rechts zum blauen Block
  (4 px breit × 4 hoch bei (5–8, 17–20) unten), der über den Korpus streicht: Referenz unten (Ursprung (5,17)), Mitte (5,15) (zwei Frames), oben (6,13).
* Linke Seite: brauner Ärmel (49,24,0). Beine/Füße (y 19–24): Knochen, rechts unten blauer Stiefel (10–14, 22–24).
Fest bleiben: Hutform und Krempe, Gitarrenkorpus (die Hand streicht darüber), Hals und Wirbelkasten, Oberarm links.

BASIS: aus dem Original, aber die 67 Zellen, die die Referenz je Frame ändert, sind ohne Block/Unterarm aus den anderen Referenzframes ergänzt (BASIS_PATCH; 9 Zellen unter den Blöcken
in allen vier Frames verdeckt → Rippenschwarz (1,3,7) bzw. durchsichtig, das ist die einzige Ergänzung). Die vier Referenzposen werden von `pose_links` / `pose_rechts` pixelgenau
reproduziert (Prüfung im Skript: `selbsttest()`), Zwischenposen werden aus Block + Ärmelpixel gesetzt.

Ablauf (48 Frames à 65 ms = 3,12 s; Beat = 12 Frames):
* SCHLAGHAND: schlägt die Saiten an — der Block fährt in einem Zyklus von 6 Frames von oben (Ursprung y 13) über die Mitte nach unten (y 17) und zurück (je 4 Höhen dazwischen: 13, 14, 15, 16, 17),
  im zweiten Beat-Halbtakt kleiner (y 15–17); alle 4 Beats eine kurze Pause (Hand unten) vor dem nächsten großen Schlag. Der Unterarm folgt (Referenzposen oben/Mitte/unten).
* GRIFFHAND: wechselt „Griffe“ — der Block am Hals rutscht in 3-Frame-Stufen (24-Frame-Zyklus, 2× pro Schleife) von (13,7) über (12,8) nach (11,9) und zurück; einmal zusätzlich (13,8) (Referenzpose 4).
* Kopfnicken im Takt: Hut + Schädel sinken 1 px für 3 Frames (je Beat bei Frame 3–5). Fußwippen: der rechte Fuß (x 10–14, y 22–24) hebt sich 1 px für 3 Frames (je Beat bei Frame 9–11).
  Federspitze (12–13, 0): die oberste Federzeile pendelt −1/0 px (Periode 24). Kein Atmen (der Gitarrenkorpus wird nicht gedehnt).
* Klangwölkchen (Partikel, hinter der Figur, 4 Stück, Lebensdauer 48 Frames, langsam aufsteigend, 2×2 → 3×3 → 2×2): hellblau (Kern (100,156,213), Rand (59,115,172)), steigen vom Gitarrenkopf, der Feder und der linken Seite auf.
Kein Glanz (Knochen/Stoff/Holz kein Metall), kein Feuer. Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts.
ERGÄNZUNG: keine gemalten Pixel außer den oben genannten neun verdeckten Zellen. Zuschnitt: symmetrisch um die Ruhefigur; Wölkchen vergrößern ihn höchstens 2 px, dazu 1 px leerer Rand.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 8, 4

spr = L.lade('skeleton-bard')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
UMRISS = U.umrissfarben(spr)
SCHWARZ = (1, 3, 7)

# ── Referenzdaten (aus ref5.png; Zellen "x,y<Farbe>", '.' = durchsichtig) ──────────────────────────────────────────────
FARBE = {'J': (49, 24, 0), 'n': (0, 6, 32), 'g': (16, 38, 61), 'f': (28, 71, 126), 'I': (16, 76, 162), 'w': (255, 255, 255), 'k': (1, 3, 7), 'a': (9, 19, 20), 'u': (0, 6, 9), 'W': (246, 255, 255), 'c': (189, 189, 189), 'b': (213, 213, 213), 'm': (24, 20, 29), 'z': (0, 0, 0)}
BASIS_PATCH = "14,7a 15,7. 16,7k 13,8u 14,8. 15,8k 16,8w 17,8k 12,9W 13,9k 14,9k 15,9c 16,9k 17,9. 11,10W 12,10c 13,10k 14,10k 15,10k 16,10. 11,11z 12,11k 13,11c 14,11k 15,11w 16,11. 12,12w 13,12k 14,12c 2,13c 6,13b 7,13k 8,13k 2,14W 3,14k 5,14b 6,14k 7,14m 8,14W 9,14k 4,15b 5,15k 6,15m 7,15W 8,15k 9,15W 4,16w 5,16m 6,16W 7,16k 8,16W 4,17w 5,17W 6,17k 7,17W 8,17k 4,18W 5,18k 6,18W 7,18k 8,18W 5,19W 6,19k 7,19W 8,19m 6,20W 7,20m"
LINKS_F0 = "4,15J 5,15J 6,15n 7,15n 5,16n 6,16g 7,16f 8,16n 4,17J 5,17n 6,17I 7,17I 8,17n 6,18n 7,18n"
RECHTS_F0 = "13,8n 14,8n 15,8n 12,9n 13,9f 14,9g 15,9g 16,9n 12,10n 13,10I 14,10I 15,10n 16,10J 13,11n 14,11n 16,11J"
LINKS_F1 = "3,14J 4,16J 5,17J 6,17n 7,17n 4,18J 5,18n 6,18g 7,18f 8,18n 5,19n 6,19I 7,19I 8,19n 6,20n 7,20n"
RECHTS_F1 = "14,7n 15,7n 16,7n 13,8n 14,8f 15,8g 16,8g 17,8n 13,9n 14,9I 15,9I 16,9n 14,10n 15,10n 16,10J 16,11J"
LINKS_F2 = "4,15J 5,15J 6,15n 7,15n 5,16n 6,16g 7,16f 8,16n 4,17J 5,17n 6,17I 7,17I 8,17n 6,18n 7,18n"
RECHTS_F2 = "12,9n 13,9n 14,9n 11,10n 12,10f 13,10g 14,10g 15,10n 11,11n 12,11I 13,11I 14,11n 15,11J 12,12n 13,12n 14,12w"
LINKS_F3 = "6,13J 7,13n 8,13n 5,14J 6,14n 7,14g 8,14f 9,14n 4,15J 5,15w 6,15n 7,15I 8,15I 9,15n 5,16J 7,16n 8,16n 4,17J"
RECHTS_F3 = "14,8n 15,8n 16,8n 13,9n 14,9f 15,9g 16,9g 17,9n 13,10n 14,10I 15,10I 16,10n 14,11n 15,11n 16,11J"


def _lesen(text):
    d = {}
    for tok in text.split():
        xy, c = tok[:-1], tok[-1]
        x, y = (int(v) for v in xy.split(','))
        d[(x, y)] = None if c == '.' else FARBE[c]
    return d


BASIS = spr.copy()
for (x, y), c in _lesen(BASIS_PATCH).items():
    if c is None:
        BASIS[y, x] = 0
    else:
        BASIS[y, x, :3] = c
        BASIS[y, x, 3] = 255
vorhanden = L.deckend(BASIS)

# Blockvorlage der Schlaghand (links): Ursprung = obere linke Ecke der 4×4 Zellen; (dx, dy, Farbe)
_N, _G, _F, _I = FARBE['n'], FARBE['g'], FARBE['f'], FARBE['I']
BLOCK_L = {(1, 0): _N, (2, 0): _N, (0, 1): _N, (1, 1): _G, (2, 1): _F, (3, 1): _N, (0, 2): _N, (1, 2): _I, (2, 2): _I, (3, 2): _N, (1, 3): _N, (2, 3): _N}
_J = FARBE['J']
_W = FARBE['w']


def block_links(x0, y0):
    return {(x0 + dx, y0 + dy): c for (dx, dy), c in BLOCK_L.items()}


# Schlaghand: Höhe (Ursprung y) → Zellen. 17/15/13 = Referenzposen (unten/Mitte/oben), 16 und 14 sind Zwischenposen aus Block + Ärmelkante.
LINKS = {
    17: _lesen(LINKS_F1),
    15: _lesen(LINKS_F0),
    13: _lesen(LINKS_F3),
    16: {**block_links(5, 16), (4, 15): _J, (5, 16): _J, (4, 17): _J},
    14: {**block_links(6, 14), (4, 15): _J, (5, 14): _J, (5, 15): _W, (5, 16): _J, (4, 17): _J},
}
RECHTS = {'A': _lesen(RECHTS_F1), 'B': _lesen(RECHTS_F0), 'C': _lesen(RECHTS_F2), 'D': _lesen(RECHTS_F3)}
assert LINKS[15] == _lesen(LINKS_F2)
for _h in (13, 14, 15, 16):                       # Knochenschattierung am Oberarm kippt mit (Referenz: (2,13)/(2,14) in den drei oberen Posen vertauscht)
    LINKS[_h] = {**LINKS[_h], (2, 13): (246, 255, 255), (2, 14): (189, 189, 189)}

# ── Masken auf BASIS ───────────────────────────────────────────────────────────────────────────────────────────────────
kopf = vorhanden & ((yy <= 9) | ((yy <= 12) & (xx >= 5) & (xx <= 12)))
kopf &= ~((xx >= 14) & (yy >= 4)) & ~((xx == 13) & (yy >= 8))
fuss = vorhanden & (xx >= 10) & (yy >= 22)
rest = vorhanden & ~kopf & ~fuss
assert (kopf | fuss | rest).sum() == vorhanden.sum()
FEDER = [(x, y) for y in range(0, 2) for x in range(11, 15) if vorhanden[y, x]]
assert FEDER and all(y <= 1 for (x, y) in FEDER)

col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
_alle = {col(x, y) for y in range(sh) for x in range(sw) if spr[y, x, 3]}
HELLBLAU = {'c': (100, 156, 213), 'r': (59, 115, 172)}
assert all(v in _alle for v in HELLBLAU.values()) and all(v in _alle for v in FARBE.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS_BLAU = [
    dict(x=P(19, 6)[0], y=P(19, 6)[1], vx=1, vy=-7, off=0, wackeln=1),            # vom Gitarrenkopf
    dict(x=P(0, 20)[0], y=P(0, 20)[1], vx=-1, vy=-8, off=24, wackeln=0),           # links neben dem Arm (bleibt unter der Krempe)
    dict(x=P(20, 10)[0], y=P(20, 10)[1], vx=0, vy=-6, off=12, wackeln=0),          # am Hals der Gitarre
    dict(x=P(17, 14)[0], y=P(17, 14)[1], vx=1, vy=-8, off=36, wackeln=1),          # rechts neben dem Korpus
]

# ── Zeitplan ───────────────────────────────────────────────────────────────────────────────────────────────────────────
SCHLAG_TAKT = [13, 14, 16, 17, 16, 14, 15, 16, 17, 16, 15, 14]                 # ein Beat: großer Doppelschlag (oben → unten → oben), dann ein kleinerer, weicher
SCHLAG_PAUSE = [13, 14, 16, 17, 17, 17, 16, 15, 16, 17, 16, 15]                # jeder vierte Beat: unten ausklingen lassen


def schlag_hoehe(i):
    """Ursprungshöhe y (13…17) des Schlaghand-Blocks im Frame i."""
    beat, k = divmod(i % 48, 12)
    return (SCHLAG_PAUSE if beat == 3 else SCHLAG_TAKT)[k]


GRIFF_FOLGE = 'AAABBBCCCBBBAAADDDAAABBB'                          # 24 Frames, alle 3 Frames ein Griffwechsel


def griff_pos(i):
    return GRIFF_FOLGE[(i + 5) % 24]


def teil(maske):
    t, _ = L.trenne(BASIS, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def ueberlagern(ebene, zellen):
    for (x, y), c in zellen.items():
        if c is not None:
            ebene[GPT + y, GPL + x, :3] = c
            ebene[GPT + y, GPL + x, 3] = 255


def frame_gross(i, nur=None):
    nick = 1 if i % 12 in (3, 4, 5) else 0                       # Kopfnicken im Takt
    tapp = 1 if i % 12 in (9, 10, 11) else 0                     # Fußwippen
    feder = -1 if (i % 24) in range(6, 14) else 0                # oberste Federzeile pendelt

    kp = teil(kopf)
    if feder:                                                    # oberste Zeile y 0 der Feder (x 11–14) 1 px nach links; Zeile y 1 bleibt
        for (x, y) in FEDER:
            if y == 0:
                kp[GPT, GPL + x + feder] = kp[GPT, GPL + x]
                kp[GPT, GPL + x] = 0
    rp = teil(rest)
    fz = teil(fuss)
    koerper = L.zusammen(H, W, [(fz, 0, -tapp), (rp, 0, 0), (kp, 0, nick)])
    ueberlagern(koerper, LINKS[schlag_hoehe(i)])                 # Arme (Blöcke + Ärmel) über Hut/Korpus
    ueberlagern(koerper, RECHTS[griff_pos(i)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ)
    if nur == 'koerper':
        return koerper
    blau = _wolke(H, W, i, N, PUFFS_BLAU, HELLBLAU)
    return L.zusammen(H, W, [(blau, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]
TEST_EBENEN = 'koerper'


def _wolke(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('skeleton-bard', 'Skeleton Bard', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-bard-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
