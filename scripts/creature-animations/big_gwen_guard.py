# -*- coding: utf-8 -*-
"""Idle-Animation für „Big Gwen Guard“ (Creature) — zwei gespiegelte Gwen-Wachen mit Bärenfellmützen, lila Uniformen und Hellebarden.

Quelle: src/big-gwen-guard.png (48×34 px, 49 Farben).
PICK: [["MotiveBritain", 189, 1]]      (Ebene „Big Gwen Guards“, Figur 1; nur in dieser Karte)
Die Ebene enthält BEIDE Wachen (links x 0–22, rechts x 25–47; die zwei Hellebardenblätter berühren sich nicht: Lücke x 23–24). Sie sind bis auf die Hutschattierung spiegelgleich.
Die Karte zeigt beide nebeneinander, also werden beide animiert (mit versetzten Takten, damit sie nicht synchron wie ein Spiegelbild wirken).

Aufruf:   python3 big_gwen_guard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/big-gwen-guard.png + .json

Was im Sprite ist (linke Wache; die rechte ist x → 47 − x):
* BÄRENFELLMÜTZE (x 2–13, y 4–15): hohe schwarze Mütze (A (55,57,64) … E (33,34,38) … B (0,0,2)) mit diagonaler Fellschattierung.
* GESICHT (y 16–19): Haut (246,205,139)/(255,230,213), zwei Augen: hellblaue Iris (172,213,255) bei (5,16) und (9,16), weißer Pixel (246,255,255) bei (5,17) und (9,17), braune Brauen/Pupillen (6,16–17), (10,16–17);
  seitlich Backenhaut (255,240,216); Kinn y 18–19.
* UNIFORM (y 20–29): lila Rock C (65,16,123)/P (82,16,156)/(49,0,98) mit hellvioletten Kreuzgurten (238,213,255)/(213,180,255); Gürtel y 24 mit goldener Schnalle (255,180,24)/(255,205,49) bei (7–8, 24); Beine y 28–30
  schwarz/grau, weiße Stiefelspitzen (246,246,246) bei (4,30) und (11,30).
* ARM/HAND: der rechte Arm (dunkelgrau/lavendel, x 13–15, y 20–23) greift hinter die Stange; die Hand (213,164,98)/(246,189,123) umfasst sie bei (17, 21–22).
* HELLEBARDE (x 14–23, y 0–19; Stange x 16, y 4–33; Schaftfuß x 15–17, y 31–33): Stahlblatt (J (117,117,117), I (163,163,163), N (172,172,172), L (201,201,201), Q (205,205,205), S (225,225,225)) mit Spitze,
  dünner Holzschaft (179,144,96)/(163,127,76).
Metall im Sprite: die zwei Hellebardenblätter und die goldenen Gürtelschnallen (Regel 14: nur das glänzt; Mütze, Stoff, Haut, Holz nicht). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos; beide Wachen laufen mit unterschiedlichen Takten):
* Auf und ab (zweistufig): Brust zuerst 1 px (Rockzeile 28 wird einmal doppelt eingefügt: Oberkörper, Arme, Kopf und Mütze steigen, Beine/Stiefel bleiben; die Hand gleitet mit dem Arm 1 px an der feststehenden Stange hoch),
  der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Kinnzeile 18 wird verlängert). Linke Wache atmet zweimal pro Schleife (Periode 24), die rechte einmal (Periode 48) — die zwei sind also nicht im Gleichtakt.
  Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Kopfwiegen: der Kopf samt Mütze (Zeilen 4–17) neigt sich 1 px zur Seite: links Frames 8–19 nach links, rechts Frames 32–43 nach rechts (nach außen), der Kinn-/Halsansatz bleibt 4-verbunden.
* Blinzeln: links Frames 17–19 und 40–42, rechts Frames 25–27 und 6–8: Iris und Weiß nehmen die umgebende Hautfarbe an ((246,205,139) bzw. (255,230,213)); die braunen Brauen bleiben. Kein Farbtausch, kein Augenglanz.
* Hellebardenspitze zuckt: die zwei obersten Spitzenzeilen (0–1) kippen 1 px zur Seite und zurück (links Frames 22–25 nach rechts, rechts Frames 44–47 nach links).
* Metall glänzt (Regel 12/14): ein Lichtband läuft zweimal pro Schleife diagonal über jedes Hellebardenblatt (links Frames 5–18 und 29–42, rechts 18–31 und 34–47) und je einmal über die Goldschnalle
  (1 Stufe heller auf der Rampe des Sprites, nur Innenpixel); dazu je ein vierzackiger Glitzer-Stern an der Blattspitze (links Frames 10–13, rechts Frames 36–39).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (die Stangen stehen fest, die Hand gleitet an ihnen; nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 2, 2          # Figuren knapp zugeschnitten: Hellebarden stehen fest (Oberkante y 0), Kopf hebt sich innerhalb ihrer Höhe

spr = L.lade('big-gwen-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


UMRISS = (0, 0, 0)
ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT_R16, HAUT_R17 = (246, 205, 139), (255, 230, 213)               # umgebende Hautfarben der Augenzeilen
STAHL = [(117, 117, 117), (163, 163, 163), (172, 172, 172), (201, 201, 201), (205, 205, 205), (225, 225, 225)]
GOLD = [(255, 180, 24), (255, 205, 49)]
WEISS, HELL, MITTEL = (246, 255, 255), (225, 225, 225), (172, 172, 172)   # Sterne an der Stahlspitze (Farben des Blatts)

# Hellebarden (fest) und Wachen (beweglich); rechte Wache gespiegelt (x → 47 − x)
hb_l = vorhanden & (((xx >= 14) & (xx <= 23) & (yy <= 19)) | ((xx == 16) & (yy >= 20)) | ((xx >= 15) & (xx <= 17) & (yy >= 31)))
hb_r = vorhanden & (((xx >= 24) & (xx <= 33) & (yy <= 19)) | ((xx == 31) & (yy >= 20)) | ((xx >= 30) & (xx <= 32) & (yy >= 31)))
wache_l = vorhanden & (xx <= 23) & ~hb_l
wache_r = vorhanden & (xx >= 24) & ~hb_r
KANTE0 = Hm.kantenmaske(spr)


def stahl_maske(hb):
    return np.array([[bool(hb[y, x] and f(x, y) in STAHL and not KANTE0[y, x] and y <= 17) for x in range(sw)] for y in range(sh)])


m_blatt_l, m_blatt_r = stahl_maske(hb_l), stahl_maske(hb_r)
m_schnalle_l = np.zeros((sh, sw), bool)
m_schnalle_l[24, 7:9] = True
m_schnalle_r = np.zeros((sh, sw), bool)
m_schnalle_r[24, 39:41] = True

# Seiten: Augen, Kopf-/Brustzeilen, Takte
SEITEN = {
    'l': dict(wache=wache_l, hb=hb_l, blatt=m_blatt_l, schnalle=m_schnalle_l, augen=[(5, 16), (9, 16), (5, 17), (9, 17)],
              atem=N / 2, blink=(17, 40), kopf_dx=-1, kopf_start=8, blatt_start=(5, 29), schnalle_start=12, stern=(16, 2, 10),
              spitze=(22, 1), spitze_x=(15, 16, 17)),
    'r': dict(wache=wache_r, hb=hb_r, blatt=m_blatt_r, schnalle=m_schnalle_r, augen=[(42, 16), (38, 16), (42, 17), (38, 17)],
              atem=N, blink=(25, 6), kopf_dx=1, kopf_start=32, blatt_start=(18, 34), schnalle_start=36, stern=(31, 2, 36),
              spitze=(44, -1), spitze_x=(30, 31, 32)),
}


def seite(i, s, gl):
    p = SEITEN[s]
    # --- Ebenen ---
    t, _ = L.trenne(spr, p['wache'])
    g = L.platz(t, H, W, PAD_L, PAD_T)
    th, _ = L.trenne(spr, p['hb'])
    hb = L.platz(th, H, W, PAD_L, PAD_T)
    # --- Blinzeln: Iris (Zeile 16) und Weiß (Zeile 17) nehmen die umgebende Hautfarbe an ---
    if Hm.folge(i, p['blink'][0], [1, 1, 1], N) or Hm.folge(i, p['blink'][1], [1, 1, 1], N):
        Hm.setze(g, {(x, y): (HAUT_R16 if y == 16 else HAUT_R17) for (x, y) in p['augen']}, OFF)
    # --- Glanz: Hellebardenblatt (Stahl) und Goldschnalle (Regel 14) ---
    for start in p['blatt_start']:
        Hm.lichtband(hb, p['blatt'], OFF, i, N, start, 14, STAHL, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(g, p['schnalle'], OFF, i, N, p['schnalle_start'], 6, GOLD, stufen=1, breite=2.0, achse=(1.0, 0.0), kern=1)
    # --- Kopfwiegen (Zeilen 4–17 seitlich 1 px, Kinn/Hals bleibt) ---
    if Hm.folge(i, p['kopf_start'], [1] * 12, N):
        Hm.bereich_versatz(g, OFF, {y: p['kopf_dx'] for y in range(4, 18)}, 0, sw - 1)
    # --- Hellebardenspitze zuckt (Zeilen 0–1 kippen 1 px) ---
    start, d = p['spitze']
    if Hm.folge(i, start, [1, 1, 0, 1], N):
        Hm.bereich_versatz(hb, OFF, {0: 1 if d > 0 else -1, 1: 1 if d > 0 else -1}, p['spitze_x'][0], p['spitze_x'][2])
    # --- Auf und ab: Rockzeile 28 = Brust, Kinnzeile 18 läuft 3 Frames nach ---
    brust = Hm.stufe(i, p['atem'], 1)
    kopf = Hm.stufe(i - 3, p['atem'], 1)
    g = Hm.atmen(g, PAD_T + 28, PAD_T + 18, brust, kopf)
    # --- Glitzer-Stern an der Blattspitze (feststehend wie die Hellebarde) ---
    sx, sy, sstart = p['stern']
    st = Hm.folge(i, sstart, [0, 1, 2, 1], N)
    Hm.stern4(gl, sx, sy, st, WEISS, HELL, MITTEL, OFF)
    return g, hb


def frame(i):
    gl = L.leer(H, W)
    gl_, hbl = seite(i, 'l', gl)
    gr_, hbr = seite(i, 'r', gl)
    fig = L.zusammen(H, W, [(hbl, 0, 0), (hbr, 0, 0), (gl_, 0, 0), (gr_, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe (z. B. an der gekippten Hellebardenspitze) werden Umriss: Stahl → dunkelstes Stahlgrau, sonst Schwarz
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = STAHL[0] if c in STAHL else UMRISS
    return L.zusammen(H, W, [(fig, 0, 0), (gl, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('big-gwen-guard', 'Big Gwen Guard', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/big-gwen-guard-strip.png', frames, spalten=8, scale=4)
