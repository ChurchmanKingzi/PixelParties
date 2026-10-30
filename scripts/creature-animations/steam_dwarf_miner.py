# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Miner“ (Creature) — der kleine Dampfzwerg mit der dunkelroten Kapuze, den drei Dampfrohren auf dem Kopf und dem weißen Bart.

Quelle: src/steam-dwarf-miner.png (22×28 px, 28 Farben).
PICK: [["MotiveSteamDwarfs", 439, 1]]      (Ebene „Ebene #2“, Figur 1; nur in dieser Karte)

Aufruf:   python3 steam_dwarf_miner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-miner.png + .json

Was im Sprite ist (x, y im 22×28-Sprite, symmetrisch):
* DREI DAMPFROHRE (grau: E (62,62,62) < B (81,81,81) < G (108,108,108)): links schräg (x 1–6, y 0–7), Mitte senkrecht (x 9–12, y 0–7), rechts schräg (x 15–20, y 0–7); oben offen und flach abgeschnitten,
  unten im Umriss der Kapuze. (Gleicher Bautyp wie beim Steam Dwarf Brewer.)
* KAPUZE (y 8–13): dunkelrote Mütze (F (75,8,8), M (23,0,0), L (61,0,0)) mit schwarzem Umriss A (0,0,0); darunter ein dunkelgraues Brillenband K/Q/P (y 11–13).
* GESICHT (y 14–17, x 7–14): braune Brillenfassung N (180,123,49) ((7–8,14), (13–14,14), Band (9–12,15), (7,17), (14,17)), Haut T (246,205,139)/(246,189,123)/(255,230,213), zwei verschiedene Augen: links ein hellblaues
  (172,213,255) Auge (8,16) mit weißem Pixel (8,17) darunter, rechts ein rotes Pixel (197,32,41) (12,17) — zwei Linsen/Augen; seitlich graue Ohr-/Brillenbügel O/H (6,15), (15,15), (6,16), (15,16).
* BART: weiß (C (246,255,255), J (213,213,213), H (156,156,156), O (189,189,189)); y 17–26, x 7–14, grauer Umriss D (106,106,106) seitlich, Unterkante schwarz mit Lücke in der Mitte (y 27).
* UMHANG/ÄRMEL: links (x 0–5, y 16–26) und rechts (x 16–21, y 16–26) dunkelrot (I (84,0,0), L, M, R, U …) mit schwarzem Umriss; hängt neben dem Bart herab (Schulterpartie/Mantel).
Fest bleiben: Kapuze, Gesicht (außer Blinzeln), Bartform (außer Atmen).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Bartzeile 22 wird einmal doppelt eingefügt: Kopf, Rohre, Bart, Umhang steigen, Bartspitze/Unterkante bleibt), der Kopf läuft
  3 Frames nach und hebt sich um ein weiteres px (die braune Brillenband-Zeile 15 wird verlängert, nur Kopfteil: Kapuze und Rohre steigen, das Gesicht samt Augen bleibt auf Brusthöhe, der Umhang hängt fest).
  Kapuze und Rohre 0 → 1 → 2 → 1 → 0 px, Gesicht/Bart/Umhang 0 → 1 → 0.
* Dampfrohre zittern (Dampfdruck): die obersten drei Rohrzeilen (0–2) jedes Rohrs schlagen gemeinsam ±1 px seitlich aus (links/rechts Periode 12 gegenphasig, Mitte Periode 16), jedes Rohr bleibt 4-verbunden.
* Umhang weht (ruhig): der Umhang spreizt sich abwechselnd links/rechts nach außen (höchstens 1 px, nur am unteren Ende, eine Welle pro Schleife, Periode 48); der innerste Umhangpixel jeder Zeile
  bleibt am Bartumriss angewachsen, die Lücke wird mit dem inneren Umhangpixel gefüllt (`Hm.rand_dehnen_innen`: der Umriss wandert mit, kein Umrissblock neben dem Umhang).
* Blinzeln (Frames 19–21 und 40–42): beide Augen schließen sich — Iris/Weiß/Rot nehmen die umgebende Hautfarbe an (links (8,16) und (8,17) → Haut T (246,205,139), rechts (12,17) → Haut (246,189,123)).
  Kein Farbtausch, kein Augenglanz.
* Dampf steigt aus allen drei Rohren auf (Partikel): sechs runde Dampfwolken ('m' Wölkchen und 'o' Oval) in Weiß/Hellgrau steigen langsam bis 4 px auf (Periode 24 Frames, je Rohr zwei Wölkchen um eine
  halbe Periode versetzt), wachsen und schrumpfen (L.puff_ebene) und liegen hinter der Figur. Sie ragen bis 4 px über die Figur hinaus.
* Metall glänzt (Regel 12/14: nur Metall): ein Lichtband läuft zweimal pro Schleife diagonal über die Rohre (Frames 3–16 und 27–40), 1–2 Stufen heller auf der Rohrrampe (Bart, Umhang, Kapuze, Haut und
  Dampf glänzen nicht); je ein vierzackiger Glitzer-Stern an der linken Rohrspitze (Frames 10–13), an der rechten (26–29) und an der mittleren (40–43) — keiner liegt über dem Gesicht.
Frame 0 = Original (Ruhepose), der Dampf ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (es wird nichts verschoben, was Verdecktes freilegt; Umhang schwingt frei am oberen Ansatz).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 8, 2          # Figur knapp zugeschnitten und zentriert; oben Platz für Kopfhub (2 px) + Dampf (bis 4 px über der Figur)

spr = L.lade('steam-dwarf-miner')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


PIPE_RAMPE = [(62, 62, 62), (81, 81, 81), (108, 108, 108), (156, 156, 156), (189, 189, 189)]
WEISS, HELLGRAU, MITTELGRAU = (246, 255, 255), (213, 213, 213), (189, 189, 189)
HAUT_L, HAUT_R = (246, 205, 139), (246, 189, 123)                 # Hautfarben neben dem linken bzw. rechten Auge
UMHANG_FARBEN = {(0, 0, 0), (84, 0, 0), (61, 0, 0), (23, 0, 0), (110, 0, 0), (47, 0, 0), (32, 24, 0), (27, 27, 27)}

# Teile
arm_l = vorhanden & (xx <= 5) & (yy >= 16)
arm_r = vorhanden & (xx >= 16) & (yy >= 16)
for m in (arm_l, arm_r):                                          # nur dunkle Umhangfarben (graue Bügel/Bartumrisse bleiben beim Kopfteil)
    for (y, x) in zip(*np.nonzero(m)):
        if f(x, y) not in UMHANG_FARBEN:
            m[y, x] = False
kopfteil = vorhanden & ~arm_l & ~arm_r

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                    # Farben der Außenkante im Original (Regel 16)
m_rohr = np.array([[bool(vorhanden[y, x] and y <= 7 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x]) for x in range(sw)] for y in range(sh)])

ROHRE = {'l': (0, 6), 'm': (8, 13), 'r': (15, 21)}               # x-Bereich je Rohr für das Zittern (Zeilen 0–2)


def rohr_stufe(i, name):
    if name == 'l':
        v = 2.0 * math.sin(L.sinus(i, N / 4))
    elif name == 'r':
        v = -2.0 * math.sin(L.sinus(i, N / 4))
    else:
        v = 1.5 * math.sin(L.sinus(i, N / 3))
    return max(-1, min(1, int(round(v))))                          # nur ±1 px


def umhang_dx(y, y0, ymax, v):
    return int(round(1.0 * (y - y0) / (ymax - y0) * v))           # höchstens 1 px (nur am unteren Ende, wenn die Welle fast voll ist)


def teil(maske_):
    t, _ = L.trenne(spr, maske_)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, dampf=True):
    kp = teil(kopfteil)
    al = teil(arm_l)
    ar = teil(arm_r)
    # --- Blinzeln: Augenpixel nehmen die umgebende Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(kp, {(8, 16): HAUT_L, (8, 17): HAUT_L, (12, 17): HAUT_R}, OFF)
    # --- Metallglanz (Regel 14: nur die Rohre) ---
    for start in (3, 27):
        Hm.lichtband(kp, m_rohr, OFF, i, N, start, 14, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Dampfrohre zittern (je Rohr eigener Ausschlag) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a:
            Hm.bereich_versatz(kp, OFF, {y: a for y in (0, 1, 2)}, x0, x1)
    # --- Umhang weht (spreizt sich nur nach außen, am Bart bleibt er angewachsen) ---
    vl = max(0.0, math.sin(L.sinus(i, N)))
    vr = max(0.0, math.sin(L.sinus(i, N) + math.pi))
    Hm.rand_dehnen_innen(al, OFF, {y: umhang_dx(y, 17, 26, vl) for y in range(18, 27)}, 'l')
    Hm.rand_dehnen_innen(ar, OFF, {y: umhang_dx(y, 17, 26, vr) for y in range(18, 27)}, 'r')
    # --- Auf und ab: Brust zuerst (Bartzeile 22), Kopf 3 Frames später (Brillenband-Zeile 15, nur Kopfteil) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    if brust:
        kp = L.streck_zeile(kp, PAD_T + 22, brust)
        al = L.streck_zeile(al, PAD_T + 22, brust)
        ar = L.streck_zeile(ar, PAD_T + 22, brust)
    if kopf:
        kp = L.streck_zeile(kp, PAD_T + 15 - brust, kopf)
    hub = brust + kopf
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (kp, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, (0, 0, 0))                  # Regel 16: Außenkante in jeder Pose in Umrissfarbe (z. B. am Umhang)
    # --- Glitzer-Sterne an den Rohrspitzen (Effekt über der Figur) ---
    gl = L.leer(H, W)
    for (sx, sy, start, dy) in ((2, 1, 10, hub), (19, 1, 26, hub), (10, 1, 40, hub)):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - dy, st, WEISS, HELLGRAU, MITTELGRAU, OFF)
    ebenen = []
    if dampf:
        py = PAD_T - 2                                             # Dampf startet 1–2 px über der Rohrspitze, steigt bis 4 px auf
        spec = []
        for cx, off0, form in ((PAD_L + 2, 0, 'm'), (PAD_L + 11, 8, 'o'), (PAD_L + 19, 16, 'm')):
            spec.append(dict(x=cx, y=py, vx=0, vy=-4, off=off0, form=form, wackeln=0.8))
            spec.append(dict(x=cx, y=py, vx=0, vy=-4, off=off0 + 12, form='o' if form == 'm' else 'm', wackeln=-0.8))
        ebenen.append((L.puff_ebene(H, W, i % 24, 24, spec, {'c': WEISS, 'r': HELLGRAU}), 0, 0))
    ebenen += [(fig, 0, 0), (gl, 0, 0)]
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, dampf=False), spr, OFF)
    print('Ruhepose (ohne Dampf) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, dampf=False) for i in range(N)]
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Dampf) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('steam-dwarf-miner', 'Steam Dwarf Miner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-miner-strip.png', frames, spalten=12, scale=4)
