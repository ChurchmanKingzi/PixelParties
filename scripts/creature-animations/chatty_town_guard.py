# -*- coding: utf-8 -*-
"""Idle-Animation für „Chatty Town Guard“ (Creature) — der Stadtwächter mit der schwarzen Schirmmütze und der lila Uniform, der sich mit den anderen unterhält.

Quelle: src/chatty-town-guard.png (13×22 px, 27 Farben).
PICK: kein eigener Ebenen-Treffer. Der Wächter ist in der Hintergrund-Ebene „Ebene #254“ (Motive 900, Bildschirmfoto der Stadt mit der Brücke) eingebacken und wurde per Farbmaske von dort herausgelöst
      (Brückenholz/Wasser = Hintergrund; Sprite-Fenster x 160–172, y 89–110 der Ebene; die zwei losen schwarzen Pixel (162,100)/(162,101) links daneben sind Brückenschatten und gehören nicht dazu: der zweite
      Wächter derselben Ebene — der kahle am unteren Kartenrand — hat dieselbe Uniform ohne sie).
Abgleich mit der Kartenkunst Chatty_Town_Guard.png: Sprite sitzt dort bei (57,22), 89 % Pixeltreffer (die Kunst hat Rauschen). Auf der Karte stehen außerdem das Mädchen mit Herz, das blonde Mädchen mit dem roten Auge
      und der grünhaarige Junge mit der „…“-Sprechblase (Ebene „Chatty Town Guard“, Motive 899): Das ist die Gesprächsgruppe, die der Wächter anschaut (er steht nach links gedreht). Die Ebene 899 selbst
      ist keine saubere Einzelfigur (der Junge wird vom blonden Mädchen überdeckt), deshalb wurde der Wächter gewählt — siehe Bericht.

Aufruf:   python3 chatty_town_guard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chatty-town-guard.png + .json

Was im Sprite ist (x, y im 13×22-Sprite):
* MÜTZE (y 0–4): schwarze Schirmmütze mit grauem Schirm: Umriss (0,0,0), Stoff (41,40,41)/(66,65,66)/(107,105,107), hellster Rand links (189,190,189)/(156,158,156). Stoff, kein Metall: kein Glanz.
* GESICHT (y 5–9): Haut (247,190,123)/(214,166,99)/(181,121,49), schwarze Augen (5,6) und (6,7) (schräg versetzt, weil der Kopf nach links gedreht ist), schwarzes Haar rechts, braune Umrisslinie links (49,24,0);
  dunkelrotes Maul (68,0,0)/(139,0,0)/(40,0,0) bei (4–5, 9–10) — der Wächter redet.
* UNIFORM (y 10–18): lila (66,16,123)/(82,16,156)/(49,0,99) mit weißen/lavendelfarbenen Streifen (247,247,247)/(239,215,255)/(214,182,255); Hand (247,190,123)/(214,166,99) auf der Brust bei (5, 13–14).
* HOSE/STIEFEL (y 19–21): schwarz mit weißen/grauen Stiefelspitzen (247,247,247)/(214,215,214)/(107,105,107).
Metall oder Gold im Sprite: keines (Mütze = Stoff, Stiefel = Leder) — also kein Glanz (Regel 14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Tunikazeile 15, glatt dunkel, wird einmal doppelt eingefügt: Tunika, Hand und Kopf steigen, Stiefel bleiben), der Kopf läuft 3 Frames nach und hebt sich
  um ein weiteres px (Zeile 8 unter den Augen wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Kein Kopfneigen, keine seitliche Gewichtsverlagerung (Rückmeldung des Spielgestalters).
* SPRECHEN: das rote Maul (2×2, x 4–5, y 9–10 — kein Halstuch, sondern der offene Mund) öffnet und schließt sich durchgehend (offen → halb → zu → …, 24-Frame-Muster, zweimal je Schleife).
* Erzählgeste (Frames 4–7 und 28–31): die Hand auf der Brust hebt sich 1 px (Spalte 5, Zeilen 12–14 rotieren: Dunkel, Hand, Hand → Hand, Hand, Dunkel) — der Wächter redet mit den Händen.
* Blinzeln (Frames 19–21 und 41–43): die beiden Augenpixel nehmen die umgebende Hautfarbe (247,190,123) an. Kein Farbtausch, kein Augenglanz.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter den Saum (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter der Hose).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('chatty-town-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(5, 7)                                                      # (247,190,123): Lid = umgebende Hautfarbe
HAAR_UMRISS, KOERPER_UMRISS = (0, 0, 0), (0, 0, 24)

fuss_l = vorhanden & (xx <= 7) & (yy >= 20)
fuss_r = vorhanden & (xx >= 8) & (yy >= 20)
rumpf = vorhanden & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


MAUL = [0, 0, 1, 2, 2, 1, 0, 1, 2, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 1, 2, 2, 1, 0]   # 0 offen, 1 halb, 2 zu (24 Frames, 2× je Schleife)


def frame(i):
    k = ebene(rumpf)
    # --- Sprechen: das rote 2×2-Maul (4–5, 9–10) geht durchgehend auf und zu (offen → halb → zu); Frame 0 = offen (Original) ---
    st = MAUL[i % len(MAUL)]
    if st == 1:
        Hm.setze(k, {(5, 10): f(6, 10)}, OFF)
    elif st == 2:
        Hm.setze(k, {(4, 9): f(4, 10), (5, 9): f(5, 10), (5, 10): f(6, 10)}, OFF)
    # --- Blinzeln: beide Augenpixel nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {(5, 6): HAUT, (6, 7): HAUT}, OFF)
    # --- Erzählgeste: die Hand auf der Brust (5,13)/(5,14) steigt 1 px (die drei Pixel der Spalte 5 rotieren, nur Quellfarben) ---
    if Hm.folge(i, 4, [1] * 4, N) or Hm.folge(i, 28, [1] * 4, N):
        Hm.setze(k, {(5, 12): f(5, 13), (5, 13): f(5, 14), (5, 14): f(5, 12)}, OFF)
    # --- Kopfneigen (Zeilen 0–9) und Gewichtsverlagerung (Zeilen 0–18) in getrennten Zeitfenstern ---
    kn = 0                                                          # Köpfe von Humanoiden bewegen sich nicht seitlich (Rückmeldung)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 10)}, -2, sw + 1)
    gv = 0                                                          # keine seitliche Gewichtsverlagerung
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 19)}, -2, sw + 1)
    # --- Auf und ab: Tunikazeile 15 = Brust, Zeile 8 (unter den Augen) läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 15, PAD_T + 8, brust, kopf)
    # --- Fußtippen (die Stiefel liegen hinter der Hose) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf → Schwarz, Körper → Dunkelblau)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 10 else KOERPER_UMRISS
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
    L.speichern('chatty-town-guard', 'Chatty Town Guard', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chatty-town-guard-strip.png', frames, spalten=12, scale=6)
