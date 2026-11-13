# -*- coding: utf-8 -*-
"""Idle-Animation für „Great Vanguard Demon“ (Creature) — großer gehörnter Dämon mit gespreizten Armen, Archetyp-Verwandter der Cycling Demons.

Quelle: src/great-vanguard-demon.png — Ebene „Great Vanguard Demon“ (MotiveGrailWar.xcf, Ebene 94; 40×56 px, 24 Farben). Die Ebene enthält DREI Posen desselben Dämons (links Arme unten, oben nur Oberkörper, rechts unten Arme gespreizt mit Stiefeln);
sie steht NICHT in der Treffersuche, weil die Ebene zu 75 % transparent (Alpha 191) ist. Gewählt: die Pose rechts unten (Rechteck x 201–241, y 88–144 der Ebene; Arme gespreizt, volle Beine) — sie passt zur Kartenkunst
(data/card-art/native/Great_Vanguard_Demon.png: gespreizte Arme mit goldenen Armreifen, Hauer über der Brust). Alpha 191 → 255 (Regel 22; im Spiel soll die Figur deckend sein).
PICK: [["MotiveGrailWar", 94, "Figur rechts unten (x 201–241, y 88–144)"]]
Die Quelle war vollständig (Hörner, Kopf, Arme, Torso, Stiefel). Die kleinen roten Dämonen und die Flammen der Kartenkunst sind andere Ebenen/Beiwerk und gehören nicht zu dieser Figur.

Aufruf:   python3 great_vanguard_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/great-vanguard-demon.png + .json

Was ist was (x/y im Sprite):
* Hörner (x 8–18 links, x 21–31 rechts, y 0–15): knochenbraun (157,112,91)/(97,65,40)/(78,47,26), dunkler Umriss (43,0,0) — starr am Kopf (Horn glänzt nicht, Regel 14).
* Kopf (x 6–34, y 11–30): rotbraunes Gesicht (83,35,23) mit hellerer Stirn (115,51,24); Augen: je ein heller Schlitz (244,190,144) ((14–15,19) (15,20) bzw. (24–25,19) (24,20)) mit rotem Glimmen (176,0,0)/(100,0,0)
  ((16,21) (17,22) bzw. (23,21) (22,22)) in einer dunklen Höhle (38,14,12); schwarzer Mund (8,4,1) (16–23,29–30).
* Hauer (weiß (229,205,203)): zwei lange Zähne (17,30–34) und (22,30–34), sie hängen vom Mund über die Brust.
* Arme (waagerecht gespreizt, y 31–36): links x 0–9, rechts x 30–39, dunkler Umriss (31,9,1) mit goldenem Armreif ((177,122,42)/(115,67,19)) bei (3–4,32–35) und (35–36,32–35) (Gold = glänzt, Regel 14).
* Torso (x 10–29, y 31–50): gerippte Brust/Bauch (64,22,10)/(83,35,23)/(38,14,12), schwarzer Gürtel (0,0,0) (19–22,49–51); Beine/Stiefel y 51–55: graue Stiefel ((29,30,32)/(40,41,43)/(49,49,49)/(98,99,101)) — Metallstiefel.
Fest bleiben: Hörner, Gesichtsform, Mund/Hauer (am Kopf), Gürtel.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Funkeln/Staub ausgenommen):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Rippenzeile y 42 des Torsos wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Kopf, Arme und Brust steigen, Beine/Stiefel bleiben am Boden.
  Der Kopf folgt der Brust 2 Frames später (nie höher als die Brust, sinkt höchstens 1 px in die Schultern); die Hauer gehören zum Kopf.
* Arme federn SYNCHRON (Nutzer-Feedback Runde 3: beide Arme heben und senken sich gleichzeitig, spiegelsymmetrisch; Periode 24): jede Spalte des Arms wandert senkrecht, je weiter vom Körper, desto mehr (Spitze bis ±1,6 px), Zusammenhang 4-verbunden
  (anim_flieger.fluegel_welle); die Armreife wandern als Spalten mit (nichts wird gestreckt oder verbreitert).
* Blinzeln beider Augen (die hellen Schlitze und das rote Glimmen werden zur dunklen Augenhöhle (38,14,12)) Frame 14–16 und 38–40.
* Gold glänzt (Regel 12/14): ein Lichtband läuft diagonal über jeden Armreif (links Frame 2–8, rechts Frame 26–32; eine Stufe heller auf der Rampe Dunkelgold → Gold → Pfirsich (244,190,144)), dazu je ein Glitzerstern am oberen Eck
  des Reifs (links Frame 12–16, rechts Frame 36–40; Mitte (229,205,203), Arme (244,190,144), folgt dem Arm). Metallstiefel: ein Lichtband eine Stufe heller läuft diagonal über jeden Stiefel (links Frame 20–25, rechts Frame 44–47).
* Füße wippen starr im Wechsel (linker Stiefel Frame 6–8 und 30–32, rechter Frame 18–20 und 42–44): der Stiefel wird 1 px kürzer (Zeile 53 entfällt).
* Staub an den Füßen (hinter der Figur, 3 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, 2×2 → 4×4 → 2×2; Farben (98,99,101)/(49,49,49) aus dem Sprite).
ERGÄNZUNG (8 Pixel): unter den Hauern fehlt im Torso-Layer die Brust, weil die Hauer (17/22, 31–34) im Original darüberliegen und sich beim Nicken des Kopfes gegen die Brust verschieben; die Löcher werden mit den
  Nachbarfarben der Brust gefüllt: (17,31) (22,31) (17,32) = (64,22,10); (22,32) (17,33) (22,33) (17,34) (22,34) = (83,35,23). Im Ruhebild überdecken die Hauer sie wieder (Frame 0 = Original).
Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Staub/Stern höchstens 2 px darüber hinaus).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U
import anim_flieger as F
import anim_daemon as D

N, MS = 48, 70
GPL, GPR, GPT, GPB = 5, 5, 7, 5

spr = L.lade('great-vanguard-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (31, 9, 1)
GOLD_D, GOLD, PFIRSICH, WEISS = (115, 67, 19), (177, 122, 42), (244, 190, 144), (229, 205, 203)
SOCKEL = (38, 14, 12)
AUGEN = [(14, 19), (15, 19), (15, 20), (24, 19), (25, 19), (24, 20), (16, 21), (23, 21), (17, 22), (22, 22)]
assert all(col(x, y) in {PFIRSICH, (176, 0, 0), (100, 0, 0)} for (x, y) in AUGEN)
HAUER = [(17, y) for y in range(31, 35)] + [(22, y) for y in range(31, 35)]
assert all(col(x, y) == WEISS for (x, y) in HAUER)
LUECKE = {(17, 31): (64, 22, 10), (22, 31): (64, 22, 10), (17, 32): (64, 22, 10), (22, 32): (83, 35, 23), (17, 33): (83, 35, 23), (22, 33): (83, 35, 23), (17, 34): (83, 35, 23), (22, 34): (83, 35, 23)}
REIF_L = [(3, 32), (4, 32), (3, 33), (4, 33), (3, 34), (4, 34), (3, 35), (4, 35)]
REIF_R = [(35, 32), (36, 32), (35, 33), (36, 33), (35, 34), (36, 34), (35, 35), (36, 35)]
GOLD_RAMPE = {GOLD_D: GOLD, GOLD: PFIRSICH}
STIEFEL_FARBEN = [(29, 30, 32), (40, 41, 43), (49, 49, 49), (98, 99, 101)]
STIEFEL_RAMPE = {STIEFEL_FARBEN[k]: STIEFEL_FARBEN[k + 1] for k in range(3)}

hauer = np.zeros_like(vorhanden)
for (x, y) in HAUER:
    hauer[y, x] = True
kopf = (vorhanden & (yy <= 30)) | hauer
boot_l = vorhanden & (yy >= 51) & (xx <= 19)
boot_r = vorhanden & (yy >= 51) & (xx >= 20)
arm_l = vorhanden & (yy >= 31) & (yy <= 36) & (xx <= 9)
arm_r = vorhanden & (yy >= 31) & (yy <= 36) & (xx >= 30)
torso = vorhanden & ~kopf & ~boot_l & ~boot_r & ~arm_l & ~arm_r
assert (kopf | boot_l | boot_r | arm_l | arm_r | torso).sum() == vorhanden.sum()

STAUB = {'c': (98, 99, 101), 'r': (49, 49, 49)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in STAUB.values())
P = lambda x, y: (GPL + x, GPT + y)
STAUB_P = [
    dict(x=P(6, 54)[0], y=P(6, 54)[1], vx=-1, vy=-8, off=0, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(33, 54)[0], y=P(33, 54)[1], vx=1, vy=-8, off=24, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(20, 55)[0], y=P(20, 55)[1], vx=0, vy=-5, off=12, wackeln=1, formen=('s', 'o', 's')),
]

_OHNE_PARTIKEL = [False]


def partikel(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return D.klekse_ebene(*a, **k)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_KOPF, T_AL, T_AR, T_BL, T_BR = (teil(m) for m in (kopf, arm_l, arm_r, boot_l, boot_r))
T_TORSO = teil(torso)
for (x, y), c in LUECKE.items():                                # ERGÄNZUNG: Brust unter den Hauern
    T_TORSO[GPT + y, GPL + x, :3] = c
    T_TORSO[GPT + y, GPL + x, 3] = 255


def band(a, punkte, rampe, d, breite=2):
    """Lichtband (Sprite-Koordinaten) auf einer Leinwandebene: Pixel mit x+y in [d, d+breite) werden eine Stufe der Rampe heller."""
    return U.band_diagonal(a, punkte, rampe, d, breite, GPL, GPT)


def stiefel_punkte(maske):
    return [(x, y) for y in range(sh) for x in range(sw) if maske[y, x] and col(x, y) in STIEFEL_RAMPE]


PT_BL, PT_BR = stiefel_punkte(boot_l), stiefel_punkte(boot_r)


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    n_kopf = max(min(n, U.stufe(i - 2, 24, 2)), n - 1)
    kp = T_KOPF.copy()
    if i in (14, 15, 16, 38, 39, 40):
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = SOCKEL
    al, ar = T_AL.copy(), T_AR.copy()
    jl, jr = i - 2, i - 26                                       # Lichtband über die Armreife
    if 0 <= jl <= 6:
        band(al, REIF_L, GOLD_RAMPE, 34 + jl)
    if 0 <= jr <= 6:
        band(ar, REIF_R, GOLD_RAMPE, 66 + jr)
    ph = L.sinus(i, 24)
    al_dy = lambda f: 1.6 * math.sin(ph) * f
    al = F.fluegel_welle(al, GPL + 10, 1.6, ph, potenz=1.0, nur_rechts=False, lauf=0.0, zusammenhang=True)
    ar = F.fluegel_welle(ar, GPL + 29, 1.6, ph, potenz=1.0, nur_rechts=True, lauf=0.0, zusammenhang=True)       # synchron mit dem linken Arm (Nutzer-Feedback Runde 3)
    tr = TX.streck_zeile(T_TORSO, GPT + 42, n)
    bl, br = T_BL.copy(), T_BR.copy()
    if 20 <= i <= 25:
        band(bl, PT_BL, STIEFEL_RAMPE, 51 + 2 * (i - 20) + 0)
    if 44 <= i <= 47:
        band(br, PT_BR, STIEFEL_RAMPE, 60 + 2 * (i - 44))
    hl = 1 if (i % 24) in (6, 7, 8) else 0
    hr = 1 if (i % 24) in (18, 19, 20) else 0
    if hl:
        bl = L.heben_unten(bl, GPT + 53, 1)
    if hr:
        br = L.heben_unten(br, GPT + 53, 1)
    f = L.zusammen(H, W, [(bl, 0, 0), (br, 0, 0), (tr, 0, 0), (al, 0, -n), (ar, 0, -n), (kp, 0, -n_kopf)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    f2 = f.copy()
    # Glitzersterne an den Armreifen (folgen dem Arm)
    for (start, ox, oy, sgn) in ((12, 3, 32, -1), (36, 36, 32, 1)):
        j = i - start
        if 0 <= j <= 4:
            stufe = (1, 2, 3, 2, 1)[j]
            cx = GPL + ox
            # Spalte der Armreif-Ecke: Versatz des Arms an dieser Spalte
            dy = _arm_dy(i, ox, 'l' if sgn < 0 else 'r')
            L.einsetzen(f2, U.stern_ebene(H, W, cx, GPT + oy - n + dy, stufe, WEISS, PFIRSICH))
    return L.zusammen(H, W, [(partikel(H, W, i, N, STAUB_P, STAUB), 0, 0), (f2, 0, 0)])


def _arm_dy(i, x, seite):
    """Senkrechter Versatz der Armspalte x (Sprite) im Frame i (wie fluegel_welle: round(amp · sin(phase) · (Abstand/maxAbstand)))."""
    ph = L.sinus(i, 24)                                          # beide Arme synchron
    piv = 10 if seite == 'l' else 29
    maxd = max(abs(xx_ - piv) for xx_ in range(sw) if (arm_l if seite == 'l' else arm_r)[:, xx_].any())
    return int(round(1.6 * math.sin(ph) * abs(x - piv) / maxd))


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('great-vanguard-demon', 'Great Vanguard Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/great-vanguard-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
