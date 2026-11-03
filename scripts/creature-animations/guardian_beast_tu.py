# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Tu“ (Creature) — die Hasen-Göttin (Tu): lange rosa Schlappohren, weißes Gesicht mit roten Augen, goldene Kette, fliederfarbenes Kleid.
Runde 3: Tu SPRINGT wirklich (Hocke → Absprung → Flug mit schlagenden Ohren → Landung), eigene Frames nach der Nutzer-Referenz img5.

Quelle: src/guardian-beast-tu.png (26×27 px, 38 Farben).
PICK: [["MotiveGuardianBeasts", 109, 1]]      (Ebene „Tu-Kopie“, Figur 1)
Quelle vollständig: ja für die Figur selbst. NICHT verwendet: Ebene 110 „Tu“ (Schleier/Flügel, 70 % durchsichtig, weich verlaufend, 26×37) und Ebene 111 (Schattenfleck am Boden) — beides sind
Weichzeichner-/Alpha-Effekte der Kartenkunst und würden gegen die Pixelart-Regel (kein Alpha, keine weichen Verläufe) verstoßen.

Aufruf:   python3 guardian_beast_tu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-tu.png + .json (mit `kern` = Körper in der Ruhepose am Boden, ohne den Sprungraum)

Identifikation (x, y im 26×27-Sprite):
* OHREN (links x 0–5, rechts x 20–25, y 2–8): lange rosa Schlappohren (225,147,163)/(208,135,150)/(198,127,142) mit dunkelbraunem Umriss (97,57,58), vom Kopf schräg nach außen unten hängend.
* KOPF (x 6–19, y 0–10): weißes/cremefarbenes Gesicht (241,232,215), schwarze Brauen (0,0,0) bei (9–11, 3) und (15–17, 3); AUGEN je 2×2: links (10–11, 4–5), rechts (14–15, 4–5): weiß (242,242,242)/(255,255,255)
  außen, dunkelrote Iris (113,32,41)/(156,59,67) innen; Mund (55,49,37) bei (12–13, 7); Haar/Fell rosabraun (173,139,140)/(189,151,148) mit Umriss (101,80,79) an den Kopfseiten.
* SCHULTERN/KRAGEN (x 7–18, y 10–14): graue Schulterrüschen (177,173,183), lila Kragen (122,102,161)/(93,70,114).
* GOLDKETTE (x 9–16, y 12–15): V-förmige Kette aus Gold (143,130,52)/(191,174,68) mit Anhänger bei (12–13, 13–15) und weißem Glanzpunkt (12,14); darüber/darunter dunkelrote Zierstücke (104,42,47)/(143,61,67).
* ARME (links x 3–7, rechts x 18–22, y 14–20): rosabraune Arme mit dunklem Umriss, hängen schräg nach außen.
* KLEID (x 8–17, y 15–22): flieder/weiß (225,209,238)/(203,172,229) mit Falten, dunkler Spalt in der Mitte (ab y 19); BEINE (y 23–26): lila Strümpfe, braune Stiefel (101,80,79).
Nicht bewegt bleiben: Gesicht (außer Blinzeln), Kleid-Muster. Kein Feuer, keine Partikel.

Ablauf (72 Frames à 70 ms = 5,04 s, nahtlos; Frame 0 = Ruhepose = Original):
* GROSSER SPRUNG (Frames 10–30): Hocke (10–13: Kleid verliert bis 4 Zeilen, Kopf/Ohren/Arme sinken, Ohren hängen tiefer, Arme nach unten; Füße bleiben am Boden) → Absprung (14: Körper streckt sich um 3 Zeilen (Kleid/Beine
  bekommen Zeilen), Füße verlassen den Boden, die Ohren hängen noch nach unten (Trägheit), Arme schwingen hoch) → Flug (15–24: parabelförmig bis 13 px Höhe, Körper komplett in der Luft, die Ohren schlagen nach oben (Frames 16–19), nach unten
  (20), wieder nach oben (21–22) und fallen; Arme hoch, beim Fallen strecken sich die Beine) → Landung (25–26: Quetschung um bis zu 4 Zeilen, Ohren kippen träge nach unten) → Nachwippen (27–30, kleiner Überschwinger).
* KLEINER HÜPFER (Frames 45–55): kurze Hocke, 6 px hoch, Ohren schlagen einmal, Landung mit leichter Quetschung.
* IDLE zwischendurch: Atmen (1 px, Zeile 17 doppelt), Ohrenschlagen (gegenläufig, Periode 24, ±18° um den Ruhewinkel), Arme schlackern nach außen (links Periode 24, rechts 18 — beide teilen die Schleifenlänge 72, damit der Loop nahtlos ist), Blinzeln (Frames 4–6 und 38–40), Goldkette glänzt (Lichtband Frames 56–69,
  Glitzerstern Frames 34–37 am Anhänger, nur Gold).
Technik: Der Körper (Kopf, Kleid, Beine) ist EINE Ebene; Strecken = Zeile 22 (Saum, die Zeilen 21 und 22 sind gleich) bzw. Zeile 25 (Bein) wird eingefügt, Quetschen = bis zu 4 Kleidzeilen (19–22) entfallen, die obere Hälfte rückt nach;
Ohren und Arme sind eigene Ebenen: sie wandern starr mit der oberen Körperhälfte und werden als Spaltenscherung um den Ansatz (Ohr x 6/19, Schulter x 8/17) nach oben (Betrag in px an der Spitze) bzw. unten geschwenkt.
Danach wird die ganze Figur um die Flughöhe angehoben. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError); nur ganze Pixel, nur Quellfarben, keine Umrisse dicker als im Original (Spaltenscherung und Zeileneinfügen am Saum
wiederholen nie Randspalten).
Ergänzungen: keine Pixel hinzugemalt; fehlende Umrisspixel am Rand schließen `A.verbinde4`/`G.rand_schliessen` (Regel 16).
"""
import os
import sys

import numpy as np

import anim_amorph as A
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 72, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 21, 3

spr = L.lade('guardian-beast-tu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (97, 57, 58)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


GESICHT = f(12, 4)                                                              # (241,232,215)
GOLD = [(143, 130, 52), (191, 174, 68), (204, 204, 170)]
GOLD_M = vorhanden & L.farbmaske(spr, GOLD[:2])
AUGEN = {'o': [(10, 4), (11, 4), (14, 4), (15, 4)], 'u': [(10, 5), (11, 5), (14, 5), (15, 5)]}

ohr_l = vorhanden & (xx <= 5) & (yy >= 2) & (yy <= 8) & ~((xx == 5) & (yy == 2))      # (5,2)/(20,2) = Kopfumriss (65504f), gehört zum Kopf
ohr_r = vorhanden & (xx >= 20) & (yy >= 2) & (yy <= 8) & ~((xx == 20) & (yy == 2))
arm_l = vorhanden & (((xx <= 7) & (yy >= 14) & (yy <= 17)) | ((xx <= 6) & (yy >= 18) & (yy <= 20)))
arm_r = vorhanden & (((xx >= 18) & (yy >= 14) & (yy <= 17)) | ((xx >= 19) & (yy >= 18) & (yy <= 20)))
koerper_m = vorhanden & ~ohr_l & ~ohr_r & ~arm_l & ~arm_r

# ── Sprungplan: Frame → (Höhe in der Luft, Streckung s (>0 Zeilen eingefügt, <0 Zeilen entfernt), Ohrenhub (px an der Spitze, + = hoch), Armhub (px an der Spitze, + = hoch))
FLUG = {}
SPRUNG_GROSS = [
    # (Frame, Höhe, s, Ohr, Arm hoch, Arme seitlich aus 0…1)
    (10, 0, -1, -1.0, 0, 0.25), (11, 0, -2, -2, 0, 0.5), (12, 0, -4, -2, 0, 0.5), (13, 0, -4, -2, 0, 0.5),     # Hocke
    (14, 3, 3, -2, 2, 0),                                                                                # Absprung
    (15, 7, 3, -1, 4, 0), (16, 10, 2, 3, 5, 0), (17, 12, 1, 6, 6, 0), (18, 13, 0, 8, 6, 0), (19, 13, 0, 5, 6, 0),   # Aufstieg, Scheitel, Ohren schlagen
    (20, 12, 0, 2, 5, 0), (21, 10, 0, 6, 4, 0), (22, 7, 0, 4, 3, 0), (23, 4, 1, 1, 1, 0), (24, 1, 1, -1, 0, 0),     # Abstieg
    (25, 0, -3, -2, 0, 0.5), (26, 0, -4, -2, 0, 0.5), (27, 0, -2, -1, 0, 0.25), (28, 0, -1, 1, 0, 0), (29, 0, 0, 1.5, 0, 0), (30, 0, 0, 0.5, 0, 0),   # Landung, Nachwippen
]
SPRUNG_KLEIN = [
    (45, 0, -1, -1, 0, 0.25), (46, 0, -2, -1.5, 0, 0.5),
    (47, 2, 2, -1.5, 2, 0), (48, 5, 1, 3, 3, 0), (49, 6, 0, 5, 3, 0), (50, 5, 0, 2, 2, 0), (51, 2, 1, -1, 0, 0),
    (52, 0, -2, -2, 0, 0.5), (53, 0, -1, 0, 0, 0.25), (54, 0, 0, 1, 0, 0), (55, 0, 0, 0.5, 0, 0),
]
PLAN = {fr: (h, s, o, a, aus) for fr, h, s, o, a, aus in SPRUNG_GROSS + SPRUNG_KLEIN}
# Gewicht der Idle-Bewegungen (Atmen, Armschlackern, Ohrenwackeln): 0 mitten im Sprung, 1 sonst, Übergang 0,5
IDLE_W = [1.0] * N
for fr in range(11, 30):
    IDLE_W[fr] = 0.0
for fr in range(46, 55):
    IDLE_W[fr] = 0.0
for fr in (10, 30, 45, 55):
    IDLE_W[fr] = 0.5


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


OHR_BASIS = (4.75, 3.5)                                                          # Ohransatz (Sprite-Koordinaten, linkes Ohr)
OHR_LAENGE, OHR_RUHE = 5.0, 45.0                                                # Kapsel-Achse (px) und Ruhewinkel (Grad unter der Waagerechten)
OHR_FARBEN = {'g': f(0, 5), 'h': f(1, 5), 'i': f(2, 5), 'l': f(3, 5)}           # Umriss (97,57,58), hell (225,147,163), mittel (208,135,150), dunkel (198,127,142)


def ohr_winkel(a):
    """Winkel (Grad unter der Waagerechten) aus dem Ohrenhub a (px, den die Spitze gegenüber der Ruhe steigt; + = hoch)."""
    sinw = float(np.clip(np.sin(np.radians(OHR_RUHE)) - a / OHR_LAENGE, -0.62, 0.92))
    return float(np.degrees(np.arcsin(sinw)))


def ohr_ebene(theta, rechts):
    """Schlappohr als Kapsel um die Achse (Ansatz → Spitze, Länge 5, Winkel `theta`) — Pixel für Pixel gezeichnet, Umriss immer genau 1 px (Kapsel minus 4er-Erosion), Füllung hell/mittel/dunkel nach Lage zur Achse.
    Bei theta = 45° und Halbbreite 1,7 (Ansatz (4,75; 3,5)) ist das exakt das Ohr des Quell-Sprites (geprüft: 26 von 26 Pixeln, alle Farben)."""
    t = np.radians(theta)
    d = (-np.cos(t), np.sin(t))
    n = (np.sin(t), np.cos(t))
    fl = 1 - min(1.0, abs(np.sin(t)) / np.sin(np.radians(OHR_RUHE)))                # 0 bei ≥ 45° (diagonal), 1 bei waagerecht: Achse 0,5 px tiefer, 0,2 px breiter → 4 Zeilen statt 5
    wd = 1.7 + 0.2 * fl + 1e-9
    Y, X = np.mgrid[0:H, 0:W]
    sx, sy = X - PAD_L, Y - PAD_T
    px, py = sx + 0.5 - OHR_BASIS[0], sy + 0.5 - (OHR_BASIS[1] + 0.5 * fl)
    tt = np.clip(px * d[0] + py * d[1], 0, OHR_LAENGE)
    m = (np.hypot(px - tt * d[0], py - tt * d[1]) <= wd) & (sx <= 5)
    p = np.pad(m, 1)
    innen = m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    vv = px * n[0] + py * n[1]
    a = L.leer(H, W)
    for y, x in zip(*np.nonzero(m)):
        c = OHR_FARBEN['g'] if not innen[y, x] else (OHR_FARBEN['h'] if vv[y, x] < -0.35 else (OHR_FARBEN['l'] if vv[y, x] >= 0.35 else OHR_FARBEN['i']))
        a[y, x, :3] = c
        a[y, x, 3] = 255
    return a[:, ::-1].copy() if rechts else a


def arm_scher(a, pivot_x, hub, links):
    """Arm schwenkt um die Schulter: Spaltenversatz wächst mit dem Abstand zum Ansatz (hub px an der Spitze, + = hoch); benachbarte Spalten unterscheiden sich um höchstens 1 px (G.kappe), damit keine Zacken entstehen."""
    cols = [x for x in range(W) if a[:, x, 3].any() and ((x < pivot_x) if links else (x > pivot_x))]
    if not cols or not hub:
        return a
    maxd = max(abs(x - pivot_x) for x in cols)
    dys = G.kappe({x: -int(round(hub * abs(x - pivot_x) / maxd)) for x in sorted(cols)})
    return G.spalten_dy(a, dys)


def streck_bein(kp, n):
    """Beinzeile 25 (aEa..aEa) n-mal einfügen: die Beine werden länger, alles darüber (auch bereits gestreckt) rückt hoch. Wird NACH dem Kleid angewendet (Zeile 25 liegt darunter, bleibt am Platz)."""
    return L.streck_zeile(kp, PAD_T + 25, n) if n else kp


def frame(i):
    hoehe, s, ohr, arm_h, aus = PLAN.get(i, (0, 0, 0, 0, 0))
    w = IDLE_W[i]
    r = int(round(0.5 - 0.5 * np.cos(L.sinus(i, 36)) + 0.0)) if w >= 1.0 else 0     # Atemhub 0/1 (2 Atemzüge je Schleife)
    # ── Körper ──
    kp = ebene(koerper_m)
    Hm.lichtband(kp, GOLD_M, OFF, i, N, 56, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0))
    st = Hm.folge(i, 34, [0, 1, 1, 0], N)
    if st is not None:
        Hm.stern4(kp, 12, 13, st, (255, 255, 237), GOLD[1], GOLD[1], OFF)
    k = Hm.folge(i, 4, [1, 2, 1], N) or Hm.folge(i, 38, [1, 2, 1], N)
    if k:
        Hm.setze(kp, {p: GESICHT for p in (AUGEN['o'] + (AUGEN['u'] if k == 2 else []))}, OFF)
    s_k = max(-4, s)                                                              # Kleid: bis 4 Zeilen weniger
    s_dress = min(s, 2)
    kp = L.streck_zeile(kp, PAD_T + 17, r)                                        # Atmen
    if s_k < 0:
        kp = L.streck_zeile(kp, PAD_T + 22, s_k)
    elif s_dress > 0:
        kp = L.streck_zeile(kp, PAD_T + 22, s_dress)
    if s > 2:
        kp = streck_bein(kp, s - 2)
    hub = r + s                                                                   # Verschiebung der oberen Hälfte (+ = hoch)
    # ── Ohren: Kapselzeichnung, der Winkel folgt Sprungplan (w = 0) bzw. dem Idle-Flattern (w = 1) ──
    th_plan = ohr_winkel(ohr)
    th_l = (1 - w) * th_plan + w * (OHR_RUHE + 18.0 * np.sin(L.sinus(i, 24)))
    th_r = (1 - w) * th_plan + w * (OHR_RUHE + 18.0 * np.sin(L.sinus(i, 24, np.pi)))
    ol, orr = ohr_ebene(th_l, False), ohr_ebene(th_r, True)
    ol, orr = L.versetze(ol, 0, -hub), L.versetze(orr, 0, -hub)
    # ── Arme ──
    al, ar = ebene(arm_l), ebene(arm_r)
    s_l = w * (0.5 - 0.5 * np.cos(L.sinus(i, 24))) + aus * (1 - w)             # Idle: Schlackern; Hocke/Landung: Arme seitlich aus
    s_r = w * (0.5 - 0.5 * np.cos(L.sinus(i, 18))) + aus * (1 - w)
    al = L.streck_zeile(al, PAD_T + 17, r)
    ar = L.streck_zeile(ar, PAD_T + 17, r)
    dl = G.kappe({PAD_T + y: -int(round(2.0 * s_l * (y - 17) / 3.0)) for y in range(17, 21)})
    dr = G.kappe({PAD_T + y: int(round(2.0 * s_r * (y - 17) / 3.0)) for y in range(17, 21)})
    al, ar = G.zeilen_dx(al, dl), G.zeilen_dx(ar, dr)
    if arm_h:
        al = arm_scher(al, PAD_L + 8, arm_h, True)
        ar = arm_scher(ar, PAD_L + 17, arm_h, False)
    al, ar = L.versetze(al, 0, -s), L.versetze(ar, 0, -s)
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (ol, 0, 0), (orr, 0, 0), (kp, 0, 0)])
    fig, _ = A.verbinde4(fig)
    G.rand_schliessen(fig, ERLAUBT, UMRISS)
    if hoehe:
        fig = L.versetze(fig, 0, -hoehe)
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
    L.speichern('guardian-beast-tu', 'Guardian Beast Tu', frames, MS, prev,
                extra={'kern': {'x': PAD_L, 'y': PAD_T, 'w': sw, 'h': sh}})
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-tu-strip.png', frames, spalten=12, scale=4)
