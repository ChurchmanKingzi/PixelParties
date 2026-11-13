# -*- coding: utf-8 -*-
"""Idle-Animation für „Hydrogen Demon“ (Creature, Archetyp Cycling Demons — Element: Wasser/Dampf).

Quelle: src/hydrogen-demon.png — Ebene „Ebene #133“ (17×31 px, 31 Farben) aus MotiveDeepsea.xcf (Ebene 152, Figur 2; Treffer 1.0). Die Kartenkunst (data/card-art/native/Hydrogen_Demon.png) zeigt genau diese Figur.
PICK: [["MotiveDeepsea", 152, 2]]
Die Quelle war vollständig (ein Dämon, kein Beiwerk in der Nachbarebene „Ebene #128“ = Serpentous Demon, dort anders gefärbt).

Aufruf:   python3 hydrogen_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hydrogen-demon.png + .json

Was ist was (x/y im Sprite):
* Zwei lange, gekrümmte Ohren/Fühler (links x 0–7, rechts x 9–16, y 0–10): blaue Röhren ((0,74,159)/(4,86,179)/(2,120,186)) mit dunklem Umriss (14,37,34); jedes Ohr endet oben in einer Schlaufe
  (links Spitze (3–4,0), rechts (12–13,0)) und hat unten einen Büschel (links (0–5,8–10), rechts (11–16,8–11)).
* Kopf (x 4–12, y 11–18): cyanblau ((1,171,204)/(3,141,190)/(4,204,229)) mit hellem Stirnglanz (4,204,229)/(2,230,253) bei (7–9,11–12); dunkelteal (0,43,47) Augen-/Brauenschlitze ((5,13) (6,14) (10–11,13) (9,14)) und
  hellcyan Lichtpunkte (10–11,14); dunkelblauer Mund-/Kinnstreifen (1,51,88)/(5,76,121) (6–9,17–18). Was genau Auge und was Braue ist, ist nicht eindeutig — die Augen bleiben deshalb fest (kein Blinzeln geraten).
* Rumpf (x 4–11, y 19–29) cyan, dunkelblauer Bauchfleck (2,120,186)/(0,74,159) bei (7–9,20–22), Beine/Füße (y 25–29) mit hellcyanen Füßen ((41,235,252)/(134,246,246)).
* Arme: links (x 0–3, y 20–23) und rechts (x 9–14, y 19–27) in hellem Wasserblau/Weiß ((187,243,253)/(157,224,217)/(129,177,187)) — Wassertropfen-/Schaumhände. Sie hängen frei am Körper.
Fest bleiben: Gesicht (Augen/Mund), Beine, Füße (stehen am Boden).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Tropfen/Dampf ausgenommen):
* Ohren schwingen unabhängig (links Periode 24, rechts Periode 16): die Zeilen über y 10 wandern seitlich, bis ±2 px an der Schlaufe, mit Wellenlauf (Spitze hinkt nach); bleiben 4-verbunden.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 23 des Rumpfs wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Kopf samt Ohren und beide Arme steigen, Beine/Füße
  bleiben am Boden. Der Kopf folgt der Brust 2 Frames später (nie höher als die Brust).
* Wasserhände schwingen leicht nach außen (je ≤ 1 px, gegengleich, links Periode 24, rechts Periode 16).
* Füße wippen starr im Wechsel (rechter Frame 5–7 und 29–31, linker Frame 17–19 und 41–43): das Bein wird 1 px kürzer (Zeile 27 entfällt, Fuß hebt sich), Beine y 25–29.
* Wasser (Partikel, hinter der Figur): zwei Dampfwölkchen steigen von den Ohrschlaufen langsam auf (hell (187,243,253), Rand (129,177,187), 2×2 → 4×4 → 2×2, leichtes Wabern); je ein Tropfen (2×2, (4,212,240)/(187,243,253))
  löst sich von der linken und rechten Hand und fällt 5–6 px; ein Wölkchen am Boden neben den Füßen. Alle Farben aus dem Sprite.
Kein Glanz/Glitzer (Wasser, kein Metall — Regel 14), kein Feuer.
ERGÄNZUNG: keine gemalten Pixel nötig. Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Partikel höchstens 2 px darüber hinaus).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 7, 6

spr = L.lade('hydrogen-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (14, 37, 34)
BLAU = {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

blass = L.farbmaske(spr, [(187, 243, 253), (157, 224, 217), (129, 177, 187), (97, 133, 119), (144, 196, 181)])
ohr_l = vorhanden & (yy <= 9) & (xx <= 7)
ohr_r = vorhanden & (yy <= 9) & (xx >= 9)
kopf = vorhanden & (yy >= 10) & (yy <= 18) & ~ohr_l & ~ohr_r
arm_l = vorhanden & (yy >= 19) & (yy <= 24) & (xx <= 3)
arm_r = vorhanden & (yy >= 19) & (yy <= 27) & (((xx >= 12)) | (blass & (xx >= 9)))
rumpf_alles = vorhanden & (yy >= 19) & ~arm_l & ~arm_r
beine = rumpf_alles & (yy >= 25)
rumpf = rumpf_alles & (yy <= 24)
assert (ohr_l | ohr_r | kopf | arm_l | arm_r | beine | rumpf).sum() == vorhanden.sum()

DAMPF = {'c': (187, 243, 253), 'r': (129, 177, 187)}
TROPFEN = {'c': (187, 243, 253), 'r': (4, 212, 240)}
assert all(v in BLAU for v in list(DAMPF.values()) + list(TROPFEN.values()))
P = lambda x, y: (GPL + x, GPT + y)
DAMPF_P = [
    dict(x=P(3, 1)[0], y=P(3, 1)[1], vx=-1, vy=-5, off=4, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(13, 1)[0], y=P(13, 1)[1], vx=1, vy=-5, off=28, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(8, 28)[0], y=P(8, 28)[1], vx=0, vy=-9, off=16, wackeln=1, formen=('s', 'o', 's')),
]
TROPF_P = [
    dict(x=P(1, 23)[0], y=P(1, 23)[1], vx=0, vy=6, off=10, wackeln=0, formen=('s', 's', 's')),
    dict(x=P(13, 27)[0], y=P(13, 27)[1], vx=0, vy=3, off=34, wackeln=0, formen=('s', 's', 's')),
]

_OHNE_PARTIKEL = [False]


def partikel(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return D.klekse_ebene(*a, **k)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_OL, T_OR, T_KOPF, T_AL, T_AR, T_RUMPF = (teil(m) for m in (ohr_l, ohr_r, kopf, arm_l, arm_r, rumpf))
T_FUSS_L, T_FUSS_R = teil(beine & (xx <= 7)), teil(beine & (xx >= 8))


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    n_kopf = max(min(n, U.stufe(i - 2, 24, 2)), n - 1)
    ol = D.oben_pendel(T_OL, GPT + 10, 2.0, L.sinus(i, 24), potenz=1.0, lauf=1.2)
    orr = D.oben_pendel(T_OR, GPT + 10, 2.0, -L.sinus(i, 16), potenz=1.0, lauf=1.2)
    rp = TX.streck_zeile(T_RUMPF, GPT + 23, n)
    bl = 1 if (i % 24) in (17, 18, 19) else 0                      # Füße wippen starr im Wechsel (linker Fuß Frame 17–19, rechter 5–7)
    br = 1 if (i % 24) in (5, 6, 7) else 0
    fl_ = L.heben_unten(T_FUSS_L, GPT + 27, bl) if bl else T_FUSS_L
    fr_ = L.heben_unten(T_FUSS_R, GPT + 27, br) if br else T_FUSS_R
    beine_ = L.zusammen(H, W, [(fl_, 0, 0), (fr_, 0, 0)])
    al = U.haengen(T_AL, GPT + 19, -1.0 * U.buckel(i, 0, 24, n=24), 1.0)
    ar = U.haengen(T_AR, GPT + 19, 1.0 * U.buckel(i, 0, 16, n=16), 1.0)
    f = L.zusammen(H, W, [(beine_, 0, 0), (rp, 0, 0), (al, 0, -n), (ar, 0, -n), (T_KOPF, 0, -n_kopf), (ol, 0, -n_kopf), (orr, 0, -n_kopf)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    dampf = partikel(H, W, i, N, DAMPF_P, DAMPF)
    tropf = partikel(H, W, i, N, TROPF_P, TROPFEN)
    return L.zusammen(H, W, [(dampf, 0, 0), (tropf, 0, 0), (f, 0, 0)])


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('hydrogen-demon', 'Hydrogen Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hydrogen-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=10)
