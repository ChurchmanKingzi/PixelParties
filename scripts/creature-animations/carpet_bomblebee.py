# -*- coding: utf-8 -*-
"""Idle-Animation für „Carpet Bomblebee“ (Creature).

PICK: [["MotiveHawaii", 30, 1], ["MotiveHawaii", 28, 1], ["MotiveHawaii", 28, 2]]   — selbst zusammengesetzt (Position per Template-Matching in der Kartenkunst
Carpet_Bomblebee.png bestimmt): Teppich mit Hummel = Ebene 30 (47×18) bei Karten-Position (15, 17); Bombenpaar links = Ebene 28 Figur 1 (15×20) bei (17, 11);
Bombenpaar rechts = Ebene 28 Figur 2 (19×20) bei (43, 11). Der Ausschnitt (x 15–61, y 11–34) ist exakt die Karte (0 abweichende Pixel).
Quellen (alle in src/, 47×24 px, 22 Farben): carpet-bomblebee.png (Komposit, für die Farbprüfung), carpet-bomblebee-teppich.png (Teppich+Hummel),
carpet-bomblebee-bomben-l.png und -bomben-r.png (die beiden Bombenpaare) — die Ebenen liegen getrennt, deshalb ist unter den Bomben der ganze
Teppich vorhanden (nichts zu erraten). Alle Pixel deckend (Alpha 0/255).

Aufruf:   python3 carpet_bomblebee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/carpet-bomblebee.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Fliegender Teppich (x 0–46, y 6–23): rotes Gewebe (149,47,49)/(192,63,66)/(94,29,31) mit gelb-goldener Zickzack-Borte (234,229,48), (218,155,41),
  (237,195,67); unten eine Fransen-Spitzenreihe (y 21–23). Er läuft unter den Bomben und der Hummel durch.
* Hummel in der Mitte (x 16–30, y 6–20): oranger Kopf (21–25, 8–12) mit zwei roten Augen (22,10) und (24,10), schwarz-orange gestreifter Körper (y 12–20), links
  und rechts je ein kleiner beige/weiß/brauner Flügel (x 16–19 bzw. 27–30, y 10–14) mit gelben Funkelpixeln (255,255,0).
* Vier schwarze Bomben mit grauen Glanzpixeln in zwei Paaren (links x 2–16, rechts x 28–46, y 0–19), je eine kleine Lunte mit gelben Sternfunken
  (links (2–6, 0–4) und (3–6, 8–12), rechts (34–37, 2–5) und (29–34, 8–11)).
* Fest bleibt: das Grau der Bomben (kein Glanz, nur Gold/Gelb glänzt), der Rest der Hummel.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Flügel der Hummel schwirren: die kleinen Flügel schlagen bis 2 px nach unten und zurück (Periode 6 Frames, 8× pro Schleife); nur nach unten, weil darunter
  Körper/Teppich liegen (keine Lücke); die Nachbarspalten gleiten mit (Zusammenhang geprüft).
* Teppich wippt (Seitenwippe um die Mitte, Spalten als Ganzes, ±2 px an den Enden, Periode 16) und schwebt (Bob ±1 px, Periode 12). Die Fransen (y ≥ 21) flattern
  seitlich 1–2 px (Periode 24, nur Zeilen unter y 20).
* Bomben wippen mit dem Teppich und hüpfen zusätzlich 0…1 px nach oben (links/rechts versetzt, Periode 8); darunter liegt der vollständige Teppich.
* Glanz (nur Gold/Gelb): ein Lichtband läuft über Borte und Fransen (Goldrampe (228,147,40) … (254,214,104) … (255,255,203), Gelb (234,229,48) → (255,255,0) → hell),
  die gelben Sternfunken der Lunten und die Funkelpixel der Flügel pulsieren (Gelb ↔ hellgelb); vier vierzackige Glitzer-Sterne blitzen an Borte, Fransen und Flügel auf.
* Blinzeln (Frames 20–22 und 44–46): die roten Augen werden braun.
* Aufsteigende Funken (Partikel): zehn runde gelbe/orange Funken und Punkte steigen langsam von Lunten, Borte und Hummel auf.

Ergänzungen: keine nötig — Teppich, Hummel und Bomben liegen als getrennte Ebenen vor; der Teppich ist unter den Bomben vollständig.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 18, 9

spr = L.lade('carpet-bomblebee')                           # Komposit (nur für Farbprüfung und Rest)
tep = L.lade('carpet-bomblebee-teppich')
bol = L.lade('carpet-bomblebee-bomben-l')
bor = L.lade('carpet-bomblebee-bomben-r')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
ROT_A, ROT_B, ROT_D = (149, 47, 49), (192, 63, 66), (94, 29, 31)
GELB, GELB_C, GELB_HELL = (255, 255, 0), (234, 229, 48), (255, 255, 203)
G_R, G_F, G_T, G_M, G_O = (228, 147, 40), (218, 155, 41), (228, 174, 59), (237, 195, 67), (254, 214, 104)
AUGE, KOPF = (187, 10, 10), (150, 83, 36)
GOLDR = [G_R, G_F, G_T, G_M, G_O, GELB_HELL]
GELBR = [GELB_C, GELB, GELB_HELL]

# ── Masken (Sprite-Koordinaten; Teppich-Ebene ist um 6 Zeilen nach unten versetzt) ──────────────────────────────────────
tv = L.deckend(tep)
gold_m = L.farbmaske(tep, [G_R, G_F, G_T, G_M, G_O])
gelb_m = L.farbmaske(tep, [GELB_C])
flu_l = tv & (xx >= 16) & (xx <= 19) & (yy >= 8) & (yy <= 14) & ~L.farbmaske(tep, [ROT_D])
flu_r = tv & (xx >= 27) & (xx <= 30) & (yy >= 8) & (yy <= 14) & ~L.farbmaske(tep, [ROT_D])
rest = tv & ~flu_l & ~flu_r
FUNKEL_B = {'L1': L.farbmaske(bol, [GELB]) & (yy <= 5), 'L2': L.farbmaske(bol, [GELB]) & (yy >= 7),
            'R1': L.farbmaske(bor, [GELB]) & (yy <= 6), 'R2': L.farbmaske(bor, [GELB]) & (yy >= 7)}
funkel_t = L.farbmaske(tep, [GELB])
AUGEN = [(22, 10), (24, 10)]

PIVOT, MAXD = 23, 23
STERNE = [((3, 14), 3), ((23, 23), 15), ((43, 14), 27), ((19, 11), 39)]            # (x, y) im Sprite, Start-Frame


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


FUNKEN1 = {'c': GELB, 'r': G_R}
FUNKEN2 = {'c': GELB_HELL, 'r': G_O}
PUFFS1 = puffs([(4, 1, -1, -11, 0, 'k', 1), (5, 9, -1, -10, 10, 's', 1), (35, 3, 1, -11, 20, 'k', 1), (31, 9, 1, -10, 30, 's', 1),
                (3, 12, -1, -10, 40, 'k', 1), (43, 12, 1, -10, 6, 'k', 1), (23, 6, 0, -12, 26, 's', 1)])
PUFFS2 = puffs([(10, 0, 0, -12, 14, 'k', 1), (38, 0, 0, -12, 36, 'k', 1), (21, 20, 0, -9, 44, 'k', 1)])


def gold_licht(ebene, i):
    F.lichtband(ebene, gold_m, PAD_L, PAD_T, i, N // 2, 4, 14, GOLDR, stufen=1, breite=5.0, achse=(1.0, 0.25), kern_stufen=2)
    F.lichtband(ebene, gelb_m, PAD_L, PAD_T, i, N // 2, 4, 14, GELBR, stufen=1, breite=5.0, achse=(1.0, 0.25), kern_stufen=2)


def funkeln(ebene, maske, t, farbe=GELB):
    """Gelber Sternfunke pulsiert gelb → hellgelb → gelb über 6 Frames (t = Frames seit Start, sonst unverändert)."""
    if 0 <= t < 6:
        stufe = (0, 1, 2, 2, 1, 0)[t]
        for (x, y) in zip(*np.nonzero(maske)[::-1]):
            ebene[PAD_T + y, PAD_L + x, :3] = F.heller(ebene[PAD_T + y, PAD_L + x, :3], GELBR, stufe)


def schwirren(ebene, maske, xs, wurzel_x, s):
    """Flügelspalten xs (von innen nach außen) rutschen 0…2 px nach unten (dy ~ Abstand zur Wurzel · s). Hat eine Spalte nach dem Versatz kein
    gemeinsames Zeilenpixel mehr mit ihrer innen liegenden Nachbarspalte (obwohl sie vorher eines hatte), übernimmt sie deren Versatz."""
    out = L.leer(H, W)
    dys = {}
    for x in xs:
        frac = abs(x - wurzel_x) / 4.0
        dys[x] = int(round(2.0 * frac * s))
    vorher = None
    for x in xs:
        ys = [y for y in range(sh) if maske[y, x]]
        if vorher is not None and ys:
            alt = set(ys) & set(y for y in range(sh) if maske[y, vorher])
            neu = {y + dys[x] for y in ys} & {y + dys[vorher] for y in range(sh) if maske[y, vorher]}
            if alt and not neu:
                dys[x] = dys[vorher]
        for y in ys:
            out[PAD_T + y + dys[x], PAD_L + x] = ebene[PAD_T + y, PAD_L + x]
        if ys:
            vorher = x
    return out


def frame(i, partikel=True):
    pb = L.sinus(i, N / 4)                                    # Schweben: Periode 12
    bob = int(round(-1.3 * math.sin(pb)))
    kippen = L.sinus(i, N / 3)                                # Seitenwippe: Periode 16
    ph = L.sinus(i, N / 8)                                    # Flügelschwirren: Periode 6
    s_fl = (1 - math.cos(ph)) / 2

    # ── Teppich + Hummel ────────────────────────────────────────────────────────────────────────────────────────────
    T = F.ebene(tep, rest, H, W, PAD_L, PAD_T)
    wl = F.ebene(tep, flu_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(tep, flu_r, H, W, PAD_L, PAD_T)
    if i in (20, 22, 44, 46):                                 # Blinzeln: halb zu (Augen dunkler)
        F.setze(T, PAD_L, PAD_T, {p: KOPF for p in AUGEN[:1]})
    if i in (21, 45):                                         # ganz zu
        F.setze(T, PAD_L, PAD_T, {p: KOPF for p in AUGEN})
    # Glanz: Gold/Gelb am Teppich und an den Flügeln, Sternfunkel der Flügel
    gold_licht(T, i)
    t_fl = (i - 9) % N
    for e_ in (wl, wr):
        funkeln(e_, funkel_t & (flu_l | flu_r), t_fl)
    # Flügel schwirren (nur nach unten, 0…2 px); Spalten mit Zusammenhang (Nachbar zur Körpermitte hin)
    wl_ = schwirren(wl, flu_l, range(19, 15, -1), 20, s_fl)
    wr_ = schwirren(wr, flu_r, range(27, 31), 26, s_fl)
    # Fransen flattern, danach wippt der ganze Teppich samt Hummel
    T = F.zeilen_pendel(T, PAD_T + 20, 2.2, L.sinus(i, N / 2), 1.0)
    T = L.zusammen(H, W, [(T, 0, 0), (wl_, 0, 0), (wr_, 0, 0)])
    T = F.spalten_kippen(T, PAD_L + PIVOT, 1.6, kippen, MAXD)

    # ── Bomben: wippen mit, hüpfen zusätzlich 0…1 px nach oben; Sternfunken pulsieren ─────────────────────────────────────
    bl = F.ebene(bol, L.deckend(bol), H, W, PAD_L, PAD_T)
    br = F.ebene(bor, L.deckend(bor), H, W, PAD_L, PAD_T)
    for k, (name, m) in enumerate(FUNKEL_B.items()):
        e_ = bl if name[0] == 'L' else br
        funkeln(e_, m, (i - 2 - 11 * k) % N)
    hop_l = -int(round(1.2 * max(0.0, math.sin(L.sinus(i, N / 6)))))
    hop_r = -int(round(1.2 * max(0.0, math.sin(L.sinus(i, N / 6) - 3.0))))
    kd_l = F.kipp_dy(8, PIVOT, 1.6, kippen, MAXD)
    kd_r = F.kipp_dy(37, PIVOT, 1.6, kippen, MAXD)

    pol = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(pol, 0, 0), (T, 0, bob), (bl, 0, bob + kd_l + hop_l), (br, 0, bob + kd_r + hop_r)])

    # ── Glitzer-Sterne (bleiben AM Objekt) ──────────────────────────────────────────────────────────────────────────────
    for (cx, cy), start in STERNE:
        st = F.stern_stufe(i, N, start)
        if st is not None:
            F.stern(f, PAD_L + cx, PAD_T + cy + F.kipp_dy(cx, PIVOT, 1.6, kippen, MAXD) + bob, st, GELB_HELL, GELB, G_O)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('carpet-bomblebee', 'Carpet Bomblebee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/carpet-bomblebee-strip.png', frames, spalten=8, scale=4)
