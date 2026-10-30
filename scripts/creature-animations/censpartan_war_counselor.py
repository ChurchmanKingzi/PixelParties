# -*- coding: utf-8 -*-
"""Idle-Animation für „Censpartan War Counselor“ (Creature) — der spartanische Krieger mit rotem Helmbusch, grauem Brustpanzer, rotem Umhang und Speer.

Quelle: src/censpartan-war-counselor.png (19×34 px, 39 Farben, 417 Pixel).
PICK: [["MotiveSteamDwarfs", 388, 1]]      (Ebene „Censpartan“, ganze Ebene = eine Figur, 19×34 px; nur in dieser Karte)
Abgleich mit der Kartenkunst Censpartan_War_Counselor.png (76×51): Sprite sitzt dort bei (29,9), 100 % Pixeltreffer (nächstbester Treffer 48 %). Auf der Karte stehen außerdem die Steinmauer links (Hintergrund) und Gras/Sand — nichts davon gehört
zur Figur. Die anderen War Counselors (Cykyran, Gorinthian, Harpthenean, Minocrete, Thebinxan) sind eigene Karten mit eigenen Figuren; in der xcf liegen „Minocrete War Counsellor“ (SteamDwarfs 391) und
„Harpthenean War Counsellor“ (SteamDwarfs 393) in derselben Datei, werden hier aber nicht berührt.

Aufruf:   python3 censpartan_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/censpartan-war-counselor.png + .json

Was im Sprite ist (x, y im 19×34-Sprite):
* SPEER (x 0–4, y 0–33): Stahlspitze (225,225,225)/(205,205,205)/(183,183,183)/(153,153,153)/(119,119,119) bei y 0–11, Schaft (x 2) in Brauntönen (179,144,96)/(163,127,76)/(145,113,68)/(120,93,56) mit grauen
  Zwischenpixeln, Fußspitze aus Stahl bei y 30–33. Die linke Hand (Umriss (49,24,0), Haut (204,150,88)/(246,189,123)) umfasst den Schaft bei (0–3, 17–20).
* HELM (y 1–12): roter Helmbusch (156,0,0)/(214,0,0)/(255,0,0)/(113,0,0) bei (8–17, 1–7), Busch-Fahne an der rechten Seite bis y 19; Stahlhelm in (66,66,66)/(112,112,112)/(194,194,194)/(76,74,93) mit schwarzem Rand.
* GESICHT (y 12–16): Haut (246,189,123)/(246,205,139)/(255,230,213)/(204,150,88). Augen: links dunkles Pixel (54,54,54) bei (8,14), graues (108,108,108) bei (8,15), Weiß (246,255,255) bei (9,15); rechts hellblaues
  (172,213,255) bei (13,14), graues bei (12,15), Weiß bei (13,15). Schwarze Wimpernpixel bei (9,14) und (12,14).
* ORNAT (y 17–24): grauer Metallpanzer (66,66,66)/(112,112,112)/(194,194,194), roter Ärmel/Umhang an beiden Schultern (113,0,0)/(156,0,0)/(214,0,0), rechte Hand (246,189,123)/(204,150,88) bei (16–17, 21–23); Gürtel y 24 mit
  gelben Nieten (255,238,0) bei (9,24) und (12,24).
* BEINE (y 25–32): braune Beinlinge (148,65,24)/(189,90,57)/(164,74,41)/(205,115,57), graue Stiefel (106,106,106) bei y 31.
Metall im Sprite: Speerspitze und Speerfuß, Stahlhelm und Brustpanzer. Nur sie glänzen (Regel 14); Stoff (Umhang, Beinlinge), Haut und Haare nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (die Beinzeile 27 wird einmal doppelt eingefügt: Rumpf, Arme, Hand und Kopf steigen, Stiefel bleiben; der Speer bekommt eine zusätzliche Schaftzeile, sodass Hand und
  Speer zusammen steigen und der Speerfuß am Boden bleibt), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Kinnzeile 16): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: der Körper (Zeilen 0–24) samt Speer schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Beine und Stiefel bleiben stehen.
* Kopfneigen: Helm samt Busch und Gesicht (Zeilen 0–16) neigen sich zweimal 1 px nach rechts (Frames 2–7 und 24–31), vom Speer weg; nach links würde der Helmrand die Speerspitze nur diagonal berühren.
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — die sechs Augenpixel nehmen die umgebende Hautfarbe an, die Wimpernpixel bleiben als Lidlinie. Kein Farbtausch, kein Augenglanz.
* Metall glänzt (Regel 14): ein Lichtband läuft einmal von oben nach unten über die Speerspitze (Frames 6–13), später über das Helmband (Frames 28–35).
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter das Beinling (Frames 12–19), später der rechte (Frames 36–43).
* Keine Armspreizung: die Arme bewegen sich nur mit dem Körper, daher keine Umrissblöcke am Rand.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter den Beinlingen).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 2          # Figur knapp zugeschnitten: Verlagerung ±1 px seitlich, Speerhub 1 px oben (Helm: 2 px bei 1 px tieferem Busch), Randabstand ≥ 2

spr = L.lade('censpartan-war-counselor')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT, HAUT_HELL, HAUT_DUNKEL = f(9, 13), f(10, 14), f(10, 13)       # (246,189,123), (246,205,139), (204,150,88)
NASE = f(10, 15)                                                    # (255,230,213)
AUGEN = {(8, 14): HAUT_HELL, (13, 14): HAUT_HELL, (8, 15): HAUT_HELL, (12, 15): HAUT_HELL, (9, 15): NASE, (13, 15): NASE}
STAHL_SPEER = [(119, 119, 119), (153, 153, 153), (205, 205, 205), (225, 225, 225)]
STAHL_HELM = [(66, 66, 66), (112, 112, 112), (194, 194, 194), (225, 225, 225)]

hand_l = vorhanden & (xx <= 6) & (yy >= 17) & (yy <= 20) & (xx != 2)
speer = vorhanden & (xx <= 4) & ~hand_l
fuss_l = vorhanden & ~speer & (xx <= 10) & (yy >= 31)
fuss_r = vorhanden & ~speer & (xx >= 11) & (yy >= 31)
rumpf = vorhanden & ~speer & ~fuss_l & ~fuss_r
m_spitze = np.zeros((sh, sw), bool)
for y in range(sh):
    for x in range(sw):
        if speer[y, x] and f(x, y) in STAHL_SPEER:
            m_spitze[y, x] = True
m_helm = np.zeros((sh, sw), bool)
for y in range(7, 13):
    for x in range(7, 16):
        if rumpf[y, x] and f(x, y) in STAHL_HELM:
            m_helm[y, x] = True


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k, sp = ebene(rumpf), ebene(speer)
    # --- Blinzeln: die Augenpixel nehmen die Hautfarbe an (Wimpernpixel bleiben) ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, AUGEN, OFF)
    # --- Metall glänzt (Regel 14): Speerspitze/-fuß, später das Helmband ---
    Hm.lichtband(sp, m_spitze, OFF, i, N, 6, 8, STAHL_SPEER, stufen=1, breite=3.0, achse=(0.0, 1.0), kern=2)
    Hm.lichtband(k, m_helm, OFF, i, N, 28, 8, STAHL_HELM, stufen=1, breite=2.4, achse=(1.0, 0.0), kern=2)
    # --- Kopfneigen (Zeilen 0–16) und Gewichtsverlagerung (Zeilen 0–24 samt ganzem Speer) in getrennten Zeitfenstern ---
    kn = 1 if (Hm.folge(i, 2, [1] * 6, N) or Hm.folge(i, 24, [1] * 8, N)) else 0       # nur nach rechts: nach links würde der Helmrand die Speerspitze diagonal berühren
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 17)}, -2, sw + 2)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 25)}, -2, sw + 2)
        Hm.bereich_versatz(sp, OFF, {y: gv for y in range(0, sh)}, -2, sw + 2)
    # --- Auf und ab: Beinzeile 27 = Brust (Speer: Schaftzeile 22), Kinnzeile 16 läuft 3 Frames nach (nur Körper) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 27, PAD_T + 16, brust, kopf)
    sp = Hm.atmen(sp, PAD_T + 22, PAD_T + 16, brust, 0)
    # --- Fußtippen (die Stiefel liegen hinter den Beinlingen) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 12, pat, N) else 0
    ur = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -ul), ebene(fuss_r, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (sp, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Brauner Umriss (49,24,0))
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = (49, 24, 0)
    return fig


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
    L.speichern('censpartan-war-counselor', 'Censpartan War Counselor', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/censpartan-war-counselor-strip.png', frames, spalten=12, scale=6)
