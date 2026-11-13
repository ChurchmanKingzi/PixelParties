# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Niu“ (Creature) — gehörnte Kriegerin (Ochse) mit zwei langen Klingen; Runde 3: die Klingen SCHWINGEN, die weißen Streifen sind nur der Schwung.

Quelle: src/guardian-beast-niu.png (26×45 px, 41 Farben).
PICK: [["MotiveGuardianBeasts", 80, 1]]      (Ebene „Niu #3“, Figur 1; Ebene 82 „Niu #1“ ist eine kleinere Pose derselben Figur, Ebene 83 „Niu“ hält die Klingen waagerecht,
Ebene 81 „Niu #2“ sind schwarze Bodenrisse — Szenenteil, nicht Teil der Figur)
Quelle vollständig: ja (Kopf, Hörner, Rumpf, Arme, beide Klingen in einer Ebene). Die Karte zeigt zusätzlich Bodenrisse (Ebene 81) und das dunkle Gestein — beides Szene.

Aufruf:   python3 guardian_beast_niu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-niu.png + .json

NUTZER-KORREKTUR (Runde 3, mit Referenzbild img4 „Bewegungseffekt-Prinzip“): „Die weißen, drei Pixel dicken Linien über seinen Klingen sind wieder Bewegungseffekte.“
Die ECHTEN Klingen sind lavendelfarben; der weiße Streifen (x 0–2 / 23–25, y 6–33, oben 1 px Spitze) im Quell-Sprite ist die Schwungspur eines Schlags von oben nach unten (so wie die große Bogenspur beim
Skeleton Reaper). Im Quell-Sprite stehen die Klingen unten (lavendelfarbener Teil y 34–44, 3 px breit, 1-px-Spitze unten), darüber der weiße Schwung. Die Referenz zeigt das Prinzip in vier Posen:
Klingen oben (lavendel, lang) → Schwung beginnt (Klinge kürzer/tiefer, weißer Streifen darüber) → Klinge unten + voller weißer Streifen → Klingen unten (lavendel, kurz, kein Streifen).
Konsequenz: Klingen und Streifen werden NEU gezeichnet (Frame für Frame, Pixel aus Länge/Richtung/Streifen bestimmt), der weiße Streifen kommt nur noch im Schwung vor.

Identifikation (x, y im 26×45-Sprite):
* KLINGEN (x 0–2 links, 23–25 rechts): lavendelfarbener Teil y 34–44 (Rand (150,122,153), Mitte (239,219,242)/(213,179,214), Spitze (197,160,201) bei (1,44)/(24,44)), darüber der WEISSE Schwung (249,254,255)
  y 6–33 (3 px breit) mit 1 px Spitze y 0–5. Die Hände (x 3–6, y 30–38) liegen daneben (Haut (246,189,123)/(213,164,98)/(166,128,76), Umriss (77,59,35)); die Arme kommen unter dem grauen Schulterband hervor.
* HÖRNER (x 4–9 / 16–22, y 3–19): oliv-goldene Hörner (144,134,67)/(198,189,92) mit dunklem Rand (91,76,45), je mit einem dünnen Aufsatz bis y 3.
* HELM/HAAR: dunkelgrauer Helm (y 11–17), schwarze Haarsträhnen seitlich des Gesichts (x 3–6 / 19–22, y 20–23), die diagonal nach außen hängen.
* GESICHT (x 8–17, y 17–24): Haut (213,164,98); Augen je 2 px breit/3 px hoch: links (9–10, 18–20), rechts (15–16, 18–20) in Rot (89,10,29) mit schwarzem/dunkelrotem Innenpixel
  und rosa Unterpixel; Mund y 20–23 mit hellen Fangzähnen (255,230,213)/(255,255,255) und dunkelrotem Rachen (113,0,0)/(156,0,0).
* SCHULTERBAND/HALS (y 25–29): grauer Schal/Schulterschutz (80,74,72)/(123,123,123) über die ganze Breite, V-förmiger Ausschnitt mit Haut bis y 27.
* RUMPF/ARME (y 29–41): dunkelroter Kittel (60,24,24)/(79,33,33) mit schrägem grauem Gurt (y 30–36), orange Gürtelschnallen (137,65,30)/(183,81,31) bei y 36–37, braune Ärmel, Hände (hautfarben).
* STIEFEL (y 37–41): dunkel (62,55,53)/(53,46,46) mit weißem Fleck (255,255,255) bei y 38–40 (Schnalle).
Nicht bewegt bleiben: Gesicht (außer Blinzeln), Hörner, Stiefel. Kein Feuer, keine Partikel.

KLINGENZEICHNUNG (alles Farben des Sprites): Rand (150,122,153) links/rechts, Mitte als Verlauf hell (239,219,242) → mittel (213,179,214) → dunkel (197,160,201) von der Parierstange (Kappe, 3 px Rand) zur
Spitze (1 px, (197,160,201)); die Länge hängt von der Pose ab (oben 32 px, im Schwung 20 → 11 → 6 px zur Betrachterin gekippt, unten 11 px wie im Quell-Sprite). Der weiße Streifen (3 px) füllt den Raum zwischen alter
Spitzenhöhe (y ≈ 10, oben 2 px Spitze) und der Klinge und wächst/schrumpft im Schwung (hinterher löst er sich von oben her auf).

RUNDE 4 (Rückmeldung „sollte VIEL HÄUFIGER seine Klingen bewegen“): der unten beschriebene Schlag (Ausholen → Schwung → unten → Heben) läuft jetzt im 24-Frame-Takt dreimal je Schleife (alle 1,6 s) mit nur
3–4 Frames Pause oben und unten; das Kopfnicken entfällt, Lichtband (links ab Frame 19, rechts ab 43) und Glitzersterne (Frames 70–72 bzw. 46–48) liegen in den kurzen Oben-Phasen. Die Frame-Nummern im folgenden Abschnitt
beschreiben den alten Einzelschlag (Posen unverändert).

Ablauf (72 Frames à 66 ms = 4,75 s, nahtlos; Frame 0 = Ruhepose mit Klingen OBEN — dort ist Frame 0 NICHT mehr der Quell-Sprite, denn der zeigt mitten im Schwung):
* Frames 62–25 (Klingen oben, 36 Frames Ruhe): lange Klingen aufrecht, Arme etwas gehoben (die Hände steigen 2 px, die Unterarme verschwinden unter dem Schulterband); ein Lichtband läuft die linke (Frames 64–73) und die rechte
  Klinge (Frames 4–13) hinauf (Metall, Regel 12/14); ein Glitzerstern blitzt kurz auf (Mitte → Kreuz → Mitte, 3 Frames) an der linken (Frames 15–17) und der rechten Klinge (Frames 20–22).
* Frames 26–27 Ausholen: Hände +1 px höher, Klingen 1–2 px länger, Körper streckt sich (Atemzeile).
* Frames 28–35 SCHWUNG: 28 Klinge 20 px (Spitze y 17) + weißer Streifen darüber; 29 Klinge 11 px; 30 Klinge 6 px (fast auf die Betrachterin gerichtet); 31–32 Klinge unten (11 px) mit vollem weißen Streifen;
  33–35 der Streifen löst sich von oben her auf. Arme sinken mit (2 → 1 → 0 px). Körper federt nach dem Schlag 1 px ein (Atemzeile entfernt) und kommt wieder hoch.
* Frames 36–55 Klingen unten (20 Frames): Kopfnicken in die Schale (Frames 40–49), Blinzeln, Haarsträhnen.
* Frames 56–62 Klingen heben sich wieder (kein Streifen): Länge 6 → 11 → 17 → 23 → 28 → 31 → 33 → 32 px, die Arme steigen mit.
* DURCHGEHEND: Atmen (2 Atemzüge je Schleife, Oberkörper 1 px, Zeile 27 doppelt/entfernt, mit Texturmischung), Blinzeln (Frames 8–10 und 50–52), Haarspitzen pendeln 1 px nach innen (Periode 24, links/rechts gegenläufig).
RUNDE 5 (Nutzer: „wenn Nius Klingen am Boden ankommen, sollte das einen spürbaren Impact haben“): im Aufschlag-Frame (Takt 7) fährt die ganze Klinge 1 px in den Boden, prallt im nächsten Frame 1 px zurück und liegt dann auf;
der Körper sackt im selben Frame ein (Zeile 27 entfernt, 3 Frames), kommt hoch und federt ein zweites Mal nach (Takt 11–12); an beiden Seiten jeder Klingenspitze stieben Staubwölkchen auf (2×2 → 3×3 → 2×2, Grau (123,123,123)
mit einem weißen Glanzpixel, treiben 5 Frames lang seitlich weg und steigen; hinter der Figur). Streckzeilen über anim_textur (Regel 49).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (alle Klingenfarben stehen im Sprite).
Ergänzungen (neu gezeichnet statt Sprite-Pixel): Klingen in den Oben-Posen und den Schwungposen, weißer Schwungstreifen in allen Längen; die Arme werden unter dem Schulterband weitergeführt (verschoben, nicht verlängert), dadurch
keine Lücken. Arme/Hände/Klingenkappe: Randpixel werden nicht geändert; Umriss nie dicker als im Original (1 px).
"""
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)

N, MS = 72, 66
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 3, 3         # Runde 5: seitlich 7 (Staubwölkchen des Aufschlags treiben bis 5 px neben die Klingen)

spr = L.lade('guardian-beast-niu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


HAUT = f(8, 18)                                   # (213,164,98) Gesichtshaut
WEISS = f(1, 10)                                  # (249,254,255) Schwungstreifen
RAND = f(0, 34)                                   # (150,122,153) Klingenrand
HELL, MITTEL, DUNKEL = f(1, 40), f(1, 42), f(1, 44)   # (239,219,242) / (213,179,214) / (197,160,201)
UMRISS = (0, 0, 0)
RAMPE = [RAND, DUNKEL, MITTEL, HELL, WEISS]       # Lichtband: je Stufe eine Farbe heller

klinge_l = vorhanden & (xx <= 2)
klinge_r = vorhanden & (xx >= 23)
arm_l = vorhanden & (xx >= 3) & (xx <= 6) & (yy >= 30) & (yy <= 38)
arm_r = vorhanden & (xx >= 19) & (xx <= 22) & (yy >= 30) & (yy <= 38)
kopf_m = vorhanden & ~klinge_l & ~klinge_r & (yy <= 24)
rumpf_m = vorhanden & ~klinge_l & ~klinge_r & ~arm_l & ~arm_r & (yy > 24)

AUGE_L = [(9, 18), (10, 18), (9, 19), (10, 19), (9, 20), (10, 20)]
AUGE_R = [(15, 18), (16, 18), (15, 19), (16, 19), (15, 20), (16, 20)]

# ── Zeitplan der Klingen: Frame → (Richtung, Länge, Armhub (negativ = Hände höher), Streifen (Spitzenanfang, Blockanfang, Blockende) oder None)
SP, BL = 8, 10                      # Streifen: Spitze ab y 8 (2 px), Block ab y 10
OBEN = ('hoch', 32, -2, None)
UNTEN = ('runter', 11, 0, None)
# Runde 4 (Rückmeldung: „Niu sollte VIEL HÄUFIGER seine Klingen bewegen“): statt eines Schlags je Schleife (mit 36 Frames Ruhe oben und 20 Frames unten) läuft der ganze Schlag jetzt in einem 24-Frame-Takt
# (1,6 s) DREIMAL je Schleife, fast ohne Pause: Takt-Frame 0–1 oben, 2–3 Ausholen, 4–11 Schwung (Posen wie bisher), 12–14 unten, 15–22 Heben (Posen wie bisher), 23 oben.
TAKT = 24
ZYKLUS = {
    2: ('hoch', 33, -3, None),                  # Ausholen
    3: ('hoch', 34, -3, None),
    4: ('hoch', 20, -2, 'bis_spitze'),          # Schwung
    5: ('hoch', 11, -1, 'bis_spitze'),
    6: ('hoch', 6, 0, 'bis_spitze'),
    7: ('runter', 11, 0, (SP, BL, 33)),
    8: ('runter', 11, 0, (SP, BL, 33)),
    9: ('runter', 11, 0, (12, 14, 33)),         # Streifen löst sich von oben her auf
    10: ('runter', 11, 0, (20, 22, 33)),
    11: ('runter', 11, 0, (28, 29, 33)),
    12: UNTEN, 13: UNTEN, 14: UNTEN,
    15: ('hoch', 6, 0, None),                   # Klingen heben sich wieder
    16: ('hoch', 11, -1, None),
    17: ('hoch', 17, -1, None),
    18: ('hoch', 23, -2, None),
    19: ('hoch', 28, -2, None),
    20: ('hoch', 31, -2, None),
    21: ('hoch', 33, -2, None),                 # kleiner Überschwinger
}
zeitplan = {i: ZYKLUS.get(i % TAKT, OBEN) for i in range(N)}
# Körperfeder (zusätzlich zum Atmen): +1 beim Ausholen, −1 nach dem Schlag
# Runde 5 („wenn die Klingen am Boden ankommen, sollte das einen spürbaren Impact haben“): der Körper sackt GENAU im Aufschlag-Frame (Takt 7) ein, kommt kurz hoch und federt ein zweites Mal nach.
_EX = {2: 1, 3: 1, 4: 1, 5: 1, 7: -1, 8: -1, 9: -1, 11: -1, 12: -1}
# Aufschlag der Klingen (Takt-Frame → Versatz der ganzen Klinge in px nach unten): Takt 7 schlägt die Spitze 1 px in den Boden, Takt 8 prallt sie 1 px zurück, ab Takt 9 liegt sie auf.
KLINGE_DY = {7: 1, 8: -1}
# Staub-/Schlagwölkchen an beiden Seiten jeder Klingenspitze (Takt-Frame → Pixel (Abstand von der Klingenmitte nach außen/innen, Zeile, Farbe-Index)); ≥ 2×2, treiben seitlich weg und steigen, hinter der Figur.
STAUB_C = [(123, 123, 123), (249, 254, 255)]      # Grau des Schulterbands, Weiß der Schwungspur (beides Quellfarben)
STAUB = {
    7: [(2, 43, 1), (3, 43, 0), (2, 44, 0), (3, 44, 0)],
    8: [(2, 42, 0), (3, 42, 1), (4, 42, 0), (2, 43, 0), (3, 43, 0), (4, 43, 0), (3, 44, 0), (4, 44, 0)],
    9: [(3, 41, 0), (4, 41, 1), (5, 41, 0), (3, 42, 0), (4, 42, 0), (5, 42, 0), (4, 43, 0)],
    10: [(4, 40, 0), (5, 40, 0), (4, 41, 0), (5, 41, 0)],
    11: [(5, 39, 0), (6, 39, 0), (5, 40, 0), (6, 40, 0)],
}


def staub_ebene(i):
    a = L.leer(H, W)
    for (u, y, ci) in STAUB.get(i % TAKT, ()):
        for c in (1, 24):
            for sgn in (-1, 1):
                X, Y = PAD_L + c + sgn * u, PAD_T + y
                if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                    raise L.ClipError(f'Staubpixel ({X},{Y}) zu nah am Rand')
                a[Y, X, :3] = STAUB_C[ci]
                a[Y, X, 3] = 255
    return a

EXTRA = {i: _EX[i % TAKT] for i in range(N) if i % TAKT in _EX}


def brust_reihe():
    b = []
    for i in range(N):
        atem = Hm.stufe(i, N / 2, 1, 0.0)
        b.append(max(-1, min(1, atem + EXTRA.get(i, 0))))
    for _ in range(4):                                         # nie mehr als 1 px Sprung zwischen zwei Frames (zyklisch)
        for i in range(N):
            d = b[i] - b[i - 1]
            if abs(d) > 1:
                b[i] = b[i - 1] + (1 if d > 0 else -1)
    return b


BRUST = brust_reihe()


def klinge_pixel(links, richtung, laenge, ybasis, streifen):
    """Pixel {(x, y): Farbe} einer Klinge (Sprite-Koordinaten). ybasis = Kappenzeile (Parierstange, bei 'hoch' unten, bei 'runter' oben)."""
    x0 = 0 if links else 23
    c = x0 + 1
    pix = {}
    if richtung == 'hoch':
        ys = list(range(ybasis, ybasis - laenge, -1))             # von der Kappe zur Spitze
    else:
        ys = list(range(ybasis, ybasis + laenge))
    spitze = ys[-1]
    if streifen == 'bis_spitze':
        streifen = (SP, BL, spitze - 1)
    if streifen:
        sp, b0, b1 = streifen
        for y in range(sp, b0):
            pix[(c, y)] = WEISS
        for y in range(b0, b1 + 1):
            for x in (x0, x0 + 1, x0 + 2):
                pix[(x, y)] = WEISS
    for k, y in enumerate(ys):
        if k == 0:
            for x in (x0, x0 + 1, x0 + 2):
                pix[(x, y)] = RAND
        elif k == laenge - 1:
            pix[(c, y)] = DUNKEL
        else:
            t = k / (laenge - 1)
            pix[(x0, y)] = RAND
            pix[(x0 + 2, y)] = RAND
            pix[(c, y)] = HELL if t < 0.45 else (MITTEL if t < 0.8 else DUNKEL)
    return pix, ys


def auf_ebene(pix):
    a = L.leer(H, W)
    for (x, y), c in pix.items():
        X, Y = x + PAD_L, y + PAD_T
        if not (0 <= X < W and 0 <= Y < H):
            raise L.ClipError(f'Klingenpixel ({x},{y}) außerhalb der Leinwand {W}×{H}')
        a[Y, X, :3] = c
        a[Y, X, 3] = 255
    return a


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def blinzeln(i):
    k = Hm.folge(i, 8, [1, 2, 1], N) or Hm.folge(i, 50, [1, 2, 1], N)
    return k or 0


def glanz(fig, i, links, ys, x0):
    """Lichtband (läuft von der Kappe zur Spitze) und Glitzerstern auf der Klinge, nur wenn sie lang aufrecht steht. Direkt auf die fertige Figur."""
    if len(ys) < 25:
        return
    c = x0 + 1
    start, dauer = (19, 10) if links else (43, 10)                       # Runde 4: in die kurzen Oben-Phasen gelegt (Heben → oben → Ausholen)
    k = (i - start) % N
    if k < dauer:
        u = (k + 0.5) / dauer
        yc = ys[0] + (ys[-1] - ys[0]) * u
        for y in ys[1:-1]:
            d = abs(y - yc)
            if d <= 1.5:
                for x in (x0, c, x0 + 2):
                    X, Y = x + PAD_L, y + PAD_T
                    cur = tuple(int(v) for v in fig[Y, X, :3])
                    if cur in RAMPE:
                        st = (2 if (x == c and d <= 0.8) else 1)
                        if x != c:
                            st = 1
                        fig[Y, X, :3] = RAMPE[min(len(RAMPE) - 1, RAMPE.index(cur) + st)]
    s0 = 70 if links else 46
    st = Hm.folge(i, s0, [0, 1, 0], N)
    if st is not None:
        y = ys[0] + (ys[-1] - ys[0]) * (0.38 if links else 0.55)
        y = int(round(y))
        pts = {(c, y): WEISS}
        if st >= 1:
            pts.update({(x0, y): WEISS, (x0 + 2, y): WEISS, (c, y - 1): WEISS, (c, y + 1): WEISS})
        Hm.setze(fig, pts, OFF)


def frame(i):
    richtung, laenge, arm_dy, streifen = zeitplan[i]
    brust = BRUST[i]
    nick = 0                                                             # Runde 4: kein Kopfnicken mehr (die lange Phase „Klingen unten“ gibt es nicht mehr; der Körper federt nach jedem Schlag ein)
    # ── Körper (Schulterband abwärts): Atmen durch eine eingefügte/entfernte Zeile 27 ──
    rumpf = ebene(rumpf_m)
    rumpf = TX.streck_zeile(rumpf, PAD_T + 27, brust)
    # ── Arme: kommen unter dem Schulterband hervor; beim Heben wandern sie nach oben unter das Band (Band liegt darüber) ──
    al, ar = ebene(arm_l, 0, arm_dy), ebene(arm_r, 0, arm_dy)
    # ── Kopf ──
    kopf = ebene(kopf_m)
    k = blinzeln(i)
    if k:
        zeilen = (18, 19) if k == 1 else (18, 19, 20)
        Hm.setze(kopf, {p: HAUT for p in AUGE_L + AUGE_R if p[1] in zeilen}, OFF)
    s = int(round(np.sin(L.sinus(i, 24)) + 0.0001))                      # Haarspitzen: −1/0/+1
    if s > 0:
        Hm.bereich_versatz(kopf, OFF, {23: 1}, 3, 6)
        Hm.bereich_versatz(kopf, OFF, {23: -1}, 19, 22)
    kopf = L.versetze(kopf, 0, -brust + nick)
    # ── Klingen (neu gezeichnet) ──
    yb = (38 + arm_dy) if richtung == 'hoch' else (34 + arm_dy)
    if KLINGE_DY.get(i % TAKT, 0) > 0 and isinstance(streifen, tuple):
        streifen = (streifen[0], streifen[1], streifen[2] + KLINGE_DY[i % TAKT])   # Schwungstreifen reicht bis an die tiefer stehende Klinge (keine Lücke)
    yb += KLINGE_DY.get(i % TAKT, 0)                                     # Runde 5: Aufschlag (1 px in den Boden) und Rückprall (1 px hoch); die Klinge bleibt starr (ganze Klinge versetzt)
    pl, ys_l = klinge_pixel(True, richtung, laenge, yb, streifen)
    pr, ys_r = klinge_pixel(False, richtung, laenge, yb, streifen)
    kl, kr = auf_ebene(pl), auf_ebene(pr)
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (rumpf, 0, 0), (kl, 0, 0), (kr, 0, 0), (kopf, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    fig = L.zusammen(H, W, [(staub_ebene(i), 0, 0), (fig, 0, 0)])        # Staub hinter der Figur
    if richtung == 'hoch' and not streifen:
        glanz(fig, i, True, ys_l, 0)
        glanz(fig, i, False, ys_r, 23)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    # Ruhepose: Körper (ohne Arme/Klingen) entspricht dem Quell-Sprite
    diff = [p for p in Hm.ruhepose(frames[0], spr, OFF) if 3 <= p[0] <= 22 and not (p[1] >= 28 and (p[0] <= 6 or p[0] >= 19))]
    print('Ruhepose (Körper ohne Arme/Klingen) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('guardian-beast-niu', 'Guardian Beast Niu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-niu-strip.png', frames, spalten=12, scale=4)
