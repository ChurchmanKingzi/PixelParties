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
* Flügel der Hummel schlagen kräftiger: die kleinen Flügel schwirren bis 3 px nach unten und zurück (Periode 6 Frames, 8× pro Schleife); nur nach unten, weil darunter
  Körper/Teppich liegen (keine Lücke); die Nachbarspalten gleiten mit (Zusammenhang geprüft).
* Teppich wippt (Seitenwippe um die Mitte, Spalten als Ganzes, ±2 px an den Enden, Periode 16) und schwebt (Bob ±1 px, Periode 12). Die Fransen (y ≥ 21) flattern
  seitlich 1–2 px (Periode 24, nur Zeilen unter y 20).
* Bomben wippen mit dem Teppich und hüpfen zusätzlich 0…1 px nach oben (links/rechts versetzt, Periode 8); darunter liegt der vollständige Teppich.
* Die vier gelben Sternfunken an den Bomben sind das FEUER DER LUNTEN (Nutzerhinweis aus Bomblebee): sie brennen. Über jeder Marke wachsen Flammenzungen (0…3 px,
  Posen à 4 Frames, je Spalte eigene Zufallsfolge, nahtlos), die Farbe wandert mit: unten hellgold (254,214,104), Mitte gold (237,195,67), Spitze orange (228,147,40);
  der Kern blitzt bei hohen Zungen hellgelb. Die Marke selbst bleibt als Basis stehen. Von den Flammen reißen kleine runde Funken ab und steigen langsam auf (12 Partikel).
* KEIN Glanz, keine Glitzersterne (Regel 14): Teppich und Hummel sind Stoff/Fell, die Bomben schwarzes Eisen ohne Glanzeffekt.
* Blinzeln (Frames 20–22 und 44–46): die roten Augen werden braun.

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
ROT_D = (94, 29, 31)
GELB, GELB_HELL = (255, 255, 0), (255, 255, 203)
G_R, G_M, G_O = (228, 147, 40), (237, 195, 67), (254, 214, 104)             # Flamme: Spitze orange, Mitte gold, unten hellgold
KOPF = (150, 83, 36)

# ── Masken (Sprite-Koordinaten; Teppich-Ebene ist um 6 Zeilen nach unten versetzt) ──────────────────────────────────────
tv = L.deckend(tep)
flu_l = tv & (xx >= 16) & (xx <= 19) & (yy >= 7) & (yy <= 14) & ~L.farbmaske(tep, [ROT_D])
flu_r = tv & (xx >= 27) & (xx <= 30) & (yy >= 7) & (yy <= 14) & ~L.farbmaske(tep, [ROT_D])
rest = tv & ~flu_l & ~flu_r
AUGEN = [(22, 10), (24, 10)]

# Lunten: die gelben Sternfunken der vier Bomben (je Spalte die oberste Marke) sind das Feuer — sie brennen.
def _lunten(ebene, rows, xs):
    gelb = L.farbmaske(ebene, [GELB, GELB_HELL])
    res = []
    for x in range(sw):
        if not (xs[0] <= x <= xs[1]):
            continue
        ys = [y for y in range(rows[0], rows[1] + 1) if gelb[y, x]]
        if ys:
            res.append((x, min(ys)))
    return res


LUNTEN = {'L1': _lunten(bol, (0, 5), (0, 8)), 'L2': _lunten(bol, (7, 13), (0, 8)),
          'R1': _lunten(bor, (0, 6), (33, 40)), 'R2': _lunten(bor, (7, 12), (28, 34))}
_rng = np.random.RandomState(9)
_K = N // 4
FLAMMEN = {}
for _name, _sp in LUNTEN.items():
    for _x, _y in _sp:
        FLAMMEN[(_name, _x)] = ([int(_rng.randint(0, 4)) for _ in range(_K)], int(_rng.randint(0, _K)), _y)

PIVOT, MAXD = 23, 23


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


FUNKEN1 = {'c': GELB, 'r': G_R}
FUNKEN2 = {'c': GELB_HELL, 'r': G_O}
PUFFS1 = puffs([(4, 0, -1, -11, 0, 'k', 1), (5, 8, -1, -10, 10, 's', 1), (35, 1, 1, -11, 20, 'k', 1), (31, 7, 1, -10, 30, 's', 1),
                (3, 1, -1, -12, 24, 's', 1), (36, 2, 1, -12, 40, 'k', 1)])
PUFFS2 = puffs([(4, 7, 0, -11, 5, 'k', 1), (31, 8, 0, -11, 15, 'k', 1), (3, 0, -1, -12, 34, 'k', 1), (35, 0, 1, -12, 44, 'k', 1),
                (5, 9, -1, -10, 19, 'k', 1), (32, 8, 1, -10, 27, 'k', 1)])


def lunten_feuer(ebene, name, i):
    """Brennende Lunten (Regel 15) auf einer Bomben-Ebene: über der Marke wachsen Flammenzungen 0…3 px, Farbe wandert mit (unten hellgold, Mitte gold,
    Spitze orange); bei hohen Zungen blitzt die Marke hellgelb. Die Marke bleibt als Basis stehen."""
    for (nm, x), (tab, off, y0) in FLAMMEN.items():
        if nm != name:
            continue
        e = tab[((i // 4) + off) % _K]
        farben = {0: [], 1: [G_R], 2: [G_O, G_R], 3: [G_O, G_M, G_R]}[e]
        for k, c in enumerate(farben):
            ebene[PAD_T + y0 - 1 - k, PAD_L + x, :3] = c
            ebene[PAD_T + y0 - 1 - k, PAD_L + x, 3] = 255
        if e == 3:
            ebene[PAD_T + y0, PAD_L + x, :3] = GELB_HELL


def schwirren(ebene, maske, xs, wurzel_x, s):
    """Flügelspalten xs (von innen nach außen) rutschen 0…2 px nach unten (dy ~ Abstand zur Wurzel · s). Hat eine Spalte nach dem Versatz kein
    gemeinsames Zeilenpixel mehr mit ihrer innen liegenden Nachbarspalte (obwohl sie vorher eines hatte), übernimmt sie deren Versatz."""
    out = L.leer(H, W)
    dys = {}
    for x in xs:
        frac = abs(x - wurzel_x) / 4.0
        dys[x] = int(round(3.0 * frac * s))
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
    bob = int(round(-1.8 * math.sin(pb)))
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
    # Flügel schwirren (nur nach unten, 0…2 px); Spalten mit Zusammenhang (Nachbar zur Körpermitte hin)
    wl_ = schwirren(wl, flu_l, range(19, 15, -1), 20, s_fl)
    wr_ = schwirren(wr, flu_r, range(27, 31), 26, s_fl)
    # Fransen flattern, danach wippt der ganze Teppich samt Hummel
    T = F.zeilen_pendel(T, PAD_T + 20, 2.2, L.sinus(i, N / 2), 1.0)
    T = L.zusammen(H, W, [(T, 0, 0), (wl_, 0, 0), (wr_, 0, 0)])
    T = F.spalten_kippen(T, PAD_L + PIVOT, 2.2, kippen, MAXD)

    # ── Bomben: wippen mit, hüpfen zusätzlich 0…1 px nach oben; Sternfunken pulsieren ─────────────────────────────────────
    bl = F.ebene(bol, L.deckend(bol), H, W, PAD_L, PAD_T)
    br = F.ebene(bor, L.deckend(bor), H, W, PAD_L, PAD_T)
    for name in LUNTEN:                                       # Feuer der Lunten
        lunten_feuer(bl if name[0] == 'L' else br, name, i)
    hop_l = -int(round(1.2 * max(0.0, math.sin(L.sinus(i, N / 6)))))
    hop_r = -int(round(1.2 * max(0.0, math.sin(L.sinus(i, N / 6) - 3.0))))
    kd_l = F.kipp_dy(8, PIVOT, 2.2, kippen, MAXD)
    kd_r = F.kipp_dy(37, PIVOT, 2.2, kippen, MAXD)

    pol = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(pol, 0, 0), (T, 0, bob), (bl, 0, bob + kd_l + hop_l), (br, 0, bob + kd_r + hop_r)])

    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('carpet-bomblebee', 'Carpet Bomblebee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/carpet-bomblebee-strip.png', frames, spalten=8, scale=4)
