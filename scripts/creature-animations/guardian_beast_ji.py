# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Ji“ (Creature, Archetyp Guardian Beasts) — der Hahnen-Wächter (Zeichen „Ji“ = Hahn) mit rotem Kamm, goldenem Schnabel und goldenen Schwingen an den Armen.

Quelle: src/guardian-beast-ji.png (22×27 px, 31 Farben).
PICK: [["MotiveGuardianBeasts", 88, 1]]      (Ebene „Ji #1“, Figur 1; die Ebene wurde direkt aus dem Ebenen-Dump geholt, weil die Suche für diese Karte nur Fehltreffer lieferte: die Kartenkunst liegt unter
einem Blitz-Effekt. Ebene 89 „Ji“ = dieselbe Figur mit sechs goldenen Kugeln im V, Ebene 87 „Ji #2“ = cyanfarbene Blitzlinien, Ebene 86 „Ji #3“ = leuchtende Flügel-Aura)
Abgleich mit der Kartenkunst Guardian_Beast_Ji.png (76×51): die Figur steht dort in der Mitte vor einem grün-roten Muster mit cyanfarbenen Blitzlinien (halbtransparent darüber) und einer Aura. Blitze, Aura und Kugeln sind
Effekt-Beiwerk der Karte (Betäubung) und keine Teile der Figur → nicht übernommen; die Ebene „Ji #1“ enthält die Figur vollständig (inkl. goldener Schwingen).

Aufruf:   python3 guardian_beast_ji.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-ji.png + .json

Identifikation (x, y im 22×27-Sprite):
* KAMM (x 7–16, y 0–8): lachsroter Federkamm (229,111,84)/(239,118,89)/(247,144,120)/(152,75,54) mit dunkelbraunem Umriss (49,24,0); er neigt sich oben nach rechts.
* GESICHT (x 6–15, y 8–13): Federgesicht (152,75,54)/(198,97,73), AUGEN je eine weiße Spalte (207,215,215)/(246,255,255) bei (8,10–11) und (13,10–11) mit dunkler Braue (65,55,5) bei (8,9)/(13,9) und (9,10)/(12,10), rosa Wangenpixel (188,112,104) bei (9,11)/(12,11).
* SCHNABEL (x 9–12, y 10–16): goldener Schnabel/Maske (220,192,64)/(250,222,72)/(255,255,127)/(179,150,37) mit dunkelroter Öffnung (128,0,0)/(167,0,0)/(102,0,0) bei (10–11,14–15) — bleibt fest (keine Augen, kein Gesicht ratend).
* SCHWINGEN (x 0–4 und x 17–21, y 12–18): goldene Schwingen/Armschilde (153,128,31)/(220,192,64)/(250,222,72)/(255,255,127) mit dunklem Rand; sie sitzen an den blauen Armen (113,112,188)/(71,69,108) bei x 4–7 bzw. 14–17.
* RUMPF (y 16–22): blauer Waffenrock (113,112,188)/(86,91,148) mit orangebraunem Federkragen (185,98,56)/(124,61,45) und hellem Saum (213,212,239)/(151,153,176).
* BEINE/FÜSSE (y 23–26): goldene Zehen (153,128,31)/(250,222,72)/(255,255,127) mit schwarzen (0,0,0) und braunen (110,63,61) Krallen; sie stehen am Boden.
Gold: Schwingen und Zehen → nur die Schwingen glänzen (Lichtband + Glitzersterne, Regel 12/14); Federn/Haut nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Atmen (Periode 24, zwei Atemzüge): die glatte Waffenrockzeile 21 wird einmal doppelt eingefügt, Kopf, Kamm, Arme und Schwingen steigen 1 px, die Füße bleiben.
* Kamm wiegt sich: die oberen drei Kammzeilen (0–2) biegen sich nach rechts (Frames 4–15) und später nach links (Frames 28–39), je höchstens 1 px Gefälle, Nähte bleiben 4-verbunden.
* Schwingen schlagen: jede Schwinge hebt ihre Spitze bis zu 2 px (Spaltenversatz wächst mit dem Abstand zum Arm, Gelenk bleibt stehen): zwei schnelle Schläge (Frames 8–19), später zwei etwas langsamere (Frames 30–45); die rechte Schwinge
  läuft 1 Frame hinterher.
* Blinzeln (Frames 22–24 und 41–43): die weißen Augenpixel nehmen die Gesichtsfarbe (198,97,73) an, die dunklen Brauen bleiben als Lidlinie.
* Gold glänzt (Regel 12/14): ein Lichtband läuft diagonal über beide Schwingen (Frames 20–31), später ein zweites (Frames 36–45); Glitzersterne an der linken (Frames 24–27) und rechten Schwinge (Frames 40–43).
* Fußtippen: der linke Fuß hebt sich zweimal 1 px (Frames 26–33), später der rechte (Frames 2–9); er verschwindet teilweise hinter dem Waffenrock.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Schwingenkante wird bei Spaltenversatz in der Randfarbe geschlossen).
"""
import math
import sys

import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 64
sz = G.Szene('guardian-beast-ji', (2, 2, 3, 2))
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f

GESICHT = f(7, 10)                                               # (198,97,73)
UMRISS = f(10, 0)                                                # (49,24,0)
FLUEGEL_RAND = f(1, 12)                                          # (153,128,31)
GOLD = [(153, 128, 31), (179, 150, 37), (220, 192, 64), (250, 222, 72), (255, 255, 127)]
WEISS = f(8, 11)                                                 # (246,255,255)
AUGEN = [(8, 10), (8, 11), (13, 10), (13, 11)]

wing_farben = [(153, 128, 31), (220, 192, 64), (250, 222, 72), (255, 255, 127), (49, 24, 0)]
wing_l = sz.vorhanden & L.farbmaske(spr, wing_farben) & (sz.xx <= 4) & (sz.yy >= 12) & (sz.yy <= 18)
wing_r = sz.vorhanden & L.farbmaske(spr, wing_farben) & (sz.xx >= 17) & (sz.yy >= 12) & (sz.yy <= 18)
kamm = sz.maske(0, 0, 21, 2)
fuss_l = sz.maske(0, 23, 9, 26) & ~sz.punkte([(9, 23)])
fuss_r = sz.maske(12, 23, 21, 26) & ~sz.punkte([(12, 23)])
rumpf = sz.vorhanden & ~wing_l & ~wing_r & ~kamm & ~fuss_l & ~fuss_r
m_wing = wing_l | wing_r

KAMM_POSEN = {0: (0, 0, 0), 1: (1, 0, 0), 2: (1, 1, 0), 3: (1, 1, 1), -1: (-1, 0, 0), -2: (-1, -1, 0), -3: (-1, -1, -1)}
KAMM_ABLAUF = {}
for k, p in enumerate([1, 2, 2, 3, 3, 2, 3, 2, 1, 1, 0, 0]):          # Frames 4–15 nach rechts
    KAMM_ABLAUF[4 + k] = p
for k, p in enumerate([-1, -2, -2, -3, -3, -2, -3, -2, -1, -1, 0, 0]):  # Frames 28–39 nach links
    KAMM_ABLAUF[28 + k] = p


def hub(i, t0, periode, zyklen):
    """0…1 (Anteil des Schwingenhubs): ein Kosinus-Hub je Schlag, sonst 0."""
    k = i - t0
    if 0 <= k < periode * zyklen:
        return 0.5 - 0.5 * math.cos(2 * math.pi * k / periode)
    return 0.0


def schlag(a, pivot, amp, u):
    """Schwinge schlägt nach oben: Spaltenversatz −amp·u·(Abstand/maxAbstand), Gelenk (pivot) bleibt."""
    return L.spalten_welle(a, pivot + sz.PL, -amp * u, math.pi / 2)


def frame(i):
    k, wl, wr, km = sz.ebene(rumpf), sz.ebene(wing_l), sz.ebene(wing_r), sz.ebene(kamm)
    # --- Blinzeln ---
    if Hm.folge(i, 22, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, {p: GESICHT for p in AUGEN})
    # --- Gold der Schwingen glänzt (vor dem Schlag, auf der Ruheform) ---
    for start, dauer in ((20, 12), (36, 10)):
        Hm.lichtband(wl, wing_l, OFF, i, N, start, dauer, GOLD, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(wr, wing_r, OFF, i, N, start, dauer, GOLD, stufen=1, breite=2.4, achse=(-1.0, 1.0), kern=2)
    for (x, y), start, ebene in (((2, 14), 24, wl), ((19, 14), 40, wr)):
        s = Hm.folge(i, start, [0, 1, 1, 0], N)
        if s is not None:
            Hm.stern4(ebene, x, y, s, WEISS, WEISS, off=OFF)
    # --- Kamm wiegt sich ---
    d = KAMM_POSEN[KAMM_ABLAUF.get(i, 0)]
    sz.zeilen(km, {j: dx for j, dx in enumerate(d)})
    # --- Schwingen schlagen ---
    ul = max(hub(i, 8, 6, 2), hub(i, 30, 8, 2))
    ur = max(hub(i - 1, 8, 6, 2), hub(i - 1, 30, 8, 2))
    if ul:
        wl = schlag(wl, 4.5, 2.0, ul)
    if ur:
        wr = schlag(wr, 16.5, 2.0, ur)
    # --- Atmen ---
    brust = Hm.stufe(i, N / 2, 1)
    k, wl, wr, km = sz.atmen([k, wl, wr, km], 21, brust)
    # --- Fußtippen ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    ul_f = 1 if Hm.folge(i, 26, pat, N) else 0
    ur_f = 1 if Hm.folge(i, 2, pat, N) else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul_f), sz.ebene(fuss_r, 0, -ur_f)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (km, 0, 0), (k, 0, 0), (wl, 0, 0), (wr, 0, 0)])
    return sz.kontur_ebenen(fig, [(wl, FLUEGEL_RAND), (wr, FLUEGEL_RAND)], UMRISS)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-ji', 'Guardian Beast Ji', MS, prev)
