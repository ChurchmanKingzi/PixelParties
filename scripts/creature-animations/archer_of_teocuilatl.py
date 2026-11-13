# -*- coding: utf-8 -*-
"""Idle-Animation für „Archer of Teocuilatl“ (Creature) — der Krieger mit den blauen Stachelhaaren, dem goldenen Brustband, dem Gras-Rock und dem langen Stab (Bogen).

Quelle: src/archer-of-teocuilatl.png (15×29 px, 43 Farben) = Komposit aus drei Ebenen derselben Datei (Positionen aus der Kartenkunst Archer_of_Teocuilatl.png abgeglichen):
PICK: [["MotiveSteamDwarfs", 165, 1], ["MotiveSteamDwarfs", 163, 1], ["MotiveSteamDwarfs", 164, 1]]
  * Ebene 165 (Figur 1, 14×29 px): der Krieger (Haare, Gesicht, nackter Oberkörper, Gras-Rock, Beine) bei (0, 0)
  * Ebene 163 (Figur 1, 14×5 px): das goldene Brustband bei (1, 15)
  * Ebene 164 (Figur 1, 3×20 px): der Stab/Bogen mit der Faust bei (11, 7)
  Nicht verwendet: die zwei Glitzersterne der Kunst (Ebene 162, 16×24) sind Beiwerk der Karte (Effekt-Ebene), die Treppe/Ziegel.
Aufruf:   python3 archer_of_teocuilatl.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/archer-of-teocuilatl.png + .json

Was im Sprite ist (x, y im 15×29-Sprite):
* HAARE (x 1–12, y 0–7): schwarz-dunkelblaue Stachelhaare (Blau (0,32,123), (0,8,74), Schwarz) mit Spitzen in Zeile 0–1 ((4,0), (10,0); (2,1), (4,1), (5,1), (7,1), (9,1), (10,1), (12,1)).
* GESICHT (y 8–14, x 2–10): Haut (180,123,49)/(189,131,57)/(205,156,82); schwarze Brauen (y 8–9); rechtes Auge: hellblaue Iris (172,213,255) (9,10) mit weißem Pixel (246,255,255) (9,11); links ein schwarzer
  Augenstrich (4–5, 11); ein oranger Pixel (249,142,24) (8,11) (Nasenring/Schmuck). Hals y 12–14.
* BRUSTBAND (x 1–10, y 15–19): GOLD/Orange (248,142,24)/(249,189,24)/(249,202,24)/(249,227,24) mit helleren Lichtern in der Mitte, darunter ein brauner Gurt.
* GRAS-ROCK (x 0–11, y 19–26): grüne Gräser (41,65,0) < (65,115,0) < (97,155,0) mit Fransen am Saum; Bein/Fuß (x 3–7, y 26–28, Haut mit Umriss (49,24,0)).
* STAB/BOGEN (x 11–13, y 7–26): dunkelbraune Stange (26,14,0)/(51,27,0)/(77,41,0)/(102,55,0), in Brusthöhe (y 15–18) von einer Faust mit goldenem Handschuh (249,142,24)/(249,189,24) bei (13–14, 15–18)
  und grauem Band (40,40,40) umfasst; oben mit dunkler Kappe (12,7).
Metall/Gold im Sprite: nur das goldene Brustband und der goldene Handschuh (Regel 14: nur das Brustband glänzt; Haare, Haut, Gras, Holz nicht). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Rockzeile 24 wird einmal doppelt eingefügt: Brustband, Oberkörper, Gesicht und Haare steigen, Saum und Fuß bleiben; die Faust steigt mit,
  der Stab wird dabei länger), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Halszeile 14, glatte Haut, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Stachelhaare wehen: die Haarspitzen (Zeilen 0–1) wehen als Welle 1 px nach links (Frames 6–11 und 28–33) bzw. rechts (Frames 17–22 und 39–44), die Spitzen in Zeile 0 bleiben über ihrem Stachel; Randpixel
  werden in Umrissfarbe (Schwarz) geschlossen.
* Gras-Rock weht: der linke Saum der zwei unteren Rockzeilen (24–25) spreizt sich zweimal pro Schleife sanft 1 px nach außen (Periode 24, `Hm.rand_dehnen`, Lücke in Grasfarbe), Randpixel in Umrissgrün geschlossen.
* Der Stab steht fest in der Faust (ein Kippen würde die Spitze nur über die Pixelecke an die Haare hängen und ist deshalb weggelassen): nur Atmen, die Faust steigt mit der Brust.
* Blinzeln (Frames 19–21 und 41–43): hellblaue Iris (9,10) und weißer Pixel (9,11) nehmen die umgebende Hautfarbe (180,123,49) an (Lid = Hautfarbe); kein Farbtausch, kein Augenglanz.
* GOLD GLÄNZT (Runde 8): Brustband + Faust sind EIN goldener Arm (er greift quer über die Brust zum Stab). Alle 1,5 s (Start Frame 5 und 29, je 10 Frames) wandert ein Lichtband
  schräg von der Schulter über den GANZEN Arm bis in die Faust (1 Stufe heller auf der Goldrampe des Sprites, im Kern 2 Stufen bis Augenweiß (246,255,255); anim_n5.goldglanz),
  am Ende je ein kurzer Sparkle (Mitte → kleines Kreuz → weg, 3 Frames) am linken bzw. rechten Armende.
  Arm und Faust heben sich in jedem Frame gemeinsam mit der Brust (gleicher Versatz) — keine Stufe zwischen Schulter, Arm und Faust.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; der Stab wird nur gestreckt, Haarspitzen und Saum verschieben sich in ihrer eigenen Zeile).
RUNDE 9 (Nutzer: „Sollten NICHT seitwärts blinzeln!“): Das Auge ist 1 px breit und 2 px hoch (Iris über Augenweiß) und sitzt zwischen dunklen Lidrand-Pixeln. Früher wurden beide Pixel hautfarben –
übrig blieb ein SENKRECHTER heller Spalt zwischen den schwarzen Randpixeln (las sich wie seitlich zugekniffen). Jetzt senkt sich das Oberlid von oben nach unten: erst deckt der dunkle Lidrand die
Iriszeile zu (Augenweiß darunter noch sichtbar), dann ist auch das Weiß vom Lid (Haut) bedeckt – geschlossen ist das Auge ein WAAGERECHTER dunkler Lidstrich; Öffnen in umgekehrter Reihenfolge.
Frames 19–22 und 41–44 (halb, zu, zu, halb).
RUNDE 10 (Nutzer: „Die Augen sind das Weiße UND das Goldene (weiße Sklera, goldene Iris/Pupille)!“): Das Auge ist 2 px breit – Sklera (hellblau beschattet oben, weiß unten) neben der GOLDENEN Iris
(Sklera (9,10)/(9,11), goldene Iris (8,11) links daneben, darüber der schwarze Lidrand (8,10); das linke Auge ist nur ein schwarzer Strich (4–5,11) und bleibt). Das Gold ist KEINE Gesichtsbemalung. Blinzeln: das Lid senkt sich von oben über Sklera UND Iris – halb: die obere Augenzeile wird zum dunklen
Lidrand (Weiß + Gold darunter noch sichtbar); zu: obere Zeile Lidhaut (180,123,49), untere Zeile (Weiß + Gold) ein waagerechter schwarzer Lidstrich (2 px). Frames wie zuvor (halb, zu, zu, halb).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G5
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2          # Figur knapp zugeschnitten: Kopfhub 2 px (oben), Randabstand 2

spr = L.lade('archer-of-teocuilatl')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
SCHWARZ, GRUEN = (0, 1, 0), (41, 65, 0)
HAUT = f(10, 11)                                                    # (180,123,49): Hautfarbe neben dem Auge (Lidfarbe)
GOLD = [(248, 142, 24), (249, 189, 24), (249, 202, 24), (249, 227, 24)]
LIDRAND = f(8, 10)                                                 # (0,0,0): dunkler Lidrand links/rechts neben der Iris
assert f(10, 10) == LIDRAND
WEISS, HELL, MITTEL = f(9, 11), (249, 227, 24), (249, 189, 24)      # Stern: Augenweiß, Hellgold

stab = vorhanden & (((xx >= 11) & (xx <= 13) & (yy >= 8)) | ((xx == 12) & (yy == 7)) | ((xx == 14) & (yy >= 15) & (yy <= 18)))
koerper = vorhanden & ~stab
KANTE0 = Hm.kantenmaske(spr)
m_gold = np.array([[bool(koerper[y, x] and 15 <= y <= 19 and 1 <= x <= 10 and f(x, y) in GOLD and not KANTE0[y, x]) for x in range(sw)] for y in range(sh)])
m_arm = np.array([[bool(vorhanden[y, x] and 15 <= y <= 19 and f(x, y) in GOLD) for x in range(sw)] for y in range(sh)])   # Band + Faust
RAMPE = G5.goldrampe(spr, m_arm, WEISS)

SPITZEN = [(x, y) for y in (0, 1) for x in range(sw) if koerper[y, x]]
ZEILE1 = {x for (x, y) in SPITZEN if y == 1}


def haare_wehen(k, s):
    """Haarspitzen (Zeilen 0–1) um s px versetzen; Zeile-0-Spitzen bleiben über ihrem Stachel (sonst unverändert)."""
    if not s:
        return k
    alt = {(x, y): k[y + PAD_T, x + PAD_L].copy() for (x, y) in SPITZEN}
    for (x, y) in SPITZEN:
        k[y + PAD_T, x + PAD_L] = 0
    neu1 = {x + s if 1 <= x + s <= 12 else x for x in ZEILE1}
    for (x, y), px in alt.items():
        nx = x + s if 1 <= x + s <= 12 else x
        if y == 0 and nx not in neu1:
            nx = x
        k[y + PAD_T, nx + PAD_L] = px
    return k


def frame(i):
    t, _ = L.trenne(spr, koerper)
    k = L.platz(t, H, W, PAD_L, PAD_T)
    ts, _ = L.trenne(spr, stab)
    st = L.platz(ts, H, W, PAD_L, PAD_T)
    gl = L.leer(H, W)                                               # Glitzer-Sterne (Effekt über der Figur)
    # --- Blinzeln: Iris und Weiß nehmen die Hautfarbe an ---
    lid = Hm.folge(i, 19, [1, 2, 2, 1], N) or Hm.folge(i, 41, [1, 2, 2, 1], N)   # 1 = Lid halb gesenkt, 2 = zu
    if lid == 1:                                                    # halb: Lidrand über der oberen Sklera, Weiß + goldene Iris noch sichtbar
        Hm.setze(k, {(9, 10): LIDRAND}, OFF)
    if lid == 2:                                                    # zu: Lidhaut oben, waagerechter Lidstrich über Gold UND Weiß (wie der Strich des linken Auges)
        Hm.setze(k, {(8, 10): HAUT, (9, 10): HAUT, (8, 11): LIDRAND, (9, 11): LIDRAND}, OFF)
    # --- Gold glänzt: Lichtband über das Brustband ---
    # (Lichtband über den ganzen goldenen Arm: nach dem Zusammensetzen, siehe unten)
    # --- Stachelhaare wehen ---
    s = -1 if (Hm.folge(i, 6, [1] * 6, N) or Hm.folge(i, 28, [1] * 6, N)) else (1 if (Hm.folge(i, 17, [1] * 6, N) or Hm.folge(i, 39, [1] * 6, N)) else 0)
    k = haare_wehen(k, s)
    # --- Gras-Rock weht (untere zwei Rockzeilen) ---
    rs = max(0, int(round(1.3 * math.sin(L.sinus(i, N / 2)))))        # 0 oder 1: der linke Saum spreizt sich 1 px nach außen (rechts liegt der Stab)
    if rs:
        Hm.rand_dehnen(k, OFF, {24: rs, 25: rs}, 'l')
    # --- Auf und ab: Rockzeile 24 = Brust, Halszeile 14 läuft 3 Frames nach (Stab: auch der obere Teil steigt mit dem Kopf, die Faust nur mit der Brust) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = TX.atmen(k, PAD_T + 24, PAD_T + 14, brust, kopf)
    st = TX.atmen(st, PAD_T + 24, PAD_T + 14, brust, kopf)
    # --- Glitzer-Sterne an den Bandenden (mit der Brust gehoben) ---
    for (sx, sy, start) in ((2, 16, 13), (9, 17, 37)):
        sstufe = Hm.folge(i, start, [0, 1, 0], N)
        Hm.stern4(gl, sx, sy - brust, sstufe, WEISS, HELL, MITTEL, OFF)
    fig = L.zusammen(H, W, [(st, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss: unten (Rock) Umrissgrün, oben (Haare, Gesicht) Schwarz
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = GRUEN if y - PAD_T >= 20 else SCHWARZ
    G5.goldglanz(fig, m_arm, (PAD_L, PAD_T - brust), i, N, (5, 29), 10, RAMPE)      # ganzer Arm inkl. Faust, geht mit der Brust
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
    L.speichern('archer-of-teocuilatl', 'Archer of Teocuilatl', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/archer-of-teocuilatl-strip.png', frames, spalten=12, scale=6)
