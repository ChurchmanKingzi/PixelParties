# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Brewer“ (Creature) — der Dampfzwerg mit den drei Dampfrohren auf dem Kopf.

Quelle: src/steam-dwarf-brewer.png (24×28 px, 25 Farben).
PICK: [["MotiveSteamDwarfs", 441, 1]]      (Ebene „Ebene #88“, Figur 1; Fässer/Kessel daneben (Ebene 443) und Flammen (Ebene 440) sind Beiwerk
                                            und nicht Teil dieses Sprites)

Aufruf:   python3 steam_dwarf_brewer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-brewer.png + .json

Was im Sprite ist (x, y im 24×28-Sprite):
* DREI DAMPFROHRE (grau: G (62,62,62) < B (81,81,81) < I (108,108,108)): links schräg (x 1–5, y 0–10), Mitte senkrecht (x 9–12, y 0–8), rechts schräg
  (x 15–20, y 0–10); sie wachsen aus dem Helm/den Kopfseiten. Oben sind die Rohre offen (Dampf käme dort heraus).
* KOPF: kahl, Haut E (246,189,123)/J/P/T; dunkelbraune Haarkranz-/Mützenkante L (49,24,0) in Zeile 8 (x 8–13), seitlich Haarbüschel P (x 7–8 und 13–14).
* GESICHT: ein grauer Metallstreifen (Helm-/Brillenband F/M/R/C, y 13–15, x 4–8 und 13–17) quer über die Augen; die Augen sind zwei schwarze
  „^“-Bögen (A (0,0,0): (8,14)+(7,15)+(9,15) und (13,14)+(12,15)+(14,15)) mit je einem Hautpixel (8,15)/(13,15) darunter, d. h. zugekniffene/fröhliche Augen —
  KEINE offenen Augen, also kein Blinzeln. Zwischen den Augen Nase/Nasensteg (9–12, 13–15: E/F/J/U).
* BART: großer weißer Bart (D (246,255,255), K (213,213,213), M (189,189,189), F (156,156,156); y 16–26, x 6–15) mit grauem Schnauzbandschatten (y 17–19), dunkelgrauem
  Umriss C (106,106,106) links/rechts und einer Unterkante C (y 26) + schwarzem Umriss (y 27) mit Lücke in der Mitte.
* UMHANG/ÄRMEL: links (x 0–5, y 16–26) und rechts (x 16–23, y 16–23) dunkelrot (O (23,0,0) < X < Y < N (61,0,0) < H (84,0,0) < S (110,0,0)) mit schwarzem Umriss A;
  hängt neben dem Bart herab (Deutung unsicher: Schulterpartie/Mantel/Ärmel).
Fest bleiben: Kopf-Haut, Augen, Nase, Bartform (außer Atmen/Glanz), Haarkranzkante.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Bartzeile 21 wird einmal doppelt eingefügt: Kopf, Rohre, Bart, Umhang steigen, Bartspitze/Unterkante
  bleibt), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Kinnzeile 16 verlängert, der Umhang bleibt in dieser Stufe unten und hängt am Rand der
  Kinnzeile fest). Kopf mit Rohren 0 → 1 → 2 → 1 → 0 px, Bart/Umhang 0 → 1 → 0.
* Dampfrohre zittern (Dampfdruck): die oberen Rohrzeilen (0–2) jedes Rohrs schlagen seitlich ±1 px aus, jedes Rohr mit eigener Periode (links/rechts 12 Frames gegenphasig,
  Mitte 16); die Zeilen 0–2 verschieben sich gemeinsam, daher bleibt jedes Rohr 4-verbunden.
* Umhang weht: der Umhang (links Zeilen 18–26, rechts Zeilen 18–23) spreizt sich abwechselnd links/rechts nach außen (bis 2 px am unteren Ende, Periode 24): der innerste
  Umhangpixel jeder Zeile bleibt am Bartumriss angewachsen, alles Äußere rückt hinaus, die Lücke wird mit der Umhangfarbe gefüllt (`Hm.rand_dehnen`) — der Umhang reißt also nie
  vom Bart ab. Nach innen geht nichts (da liegt der Bart).
* Dampf steigt aus allen drei Rohren auf (Partikel): neun runde Dampfwolken ('m' Wölkchen, 'o' Oval, 'k' Funke) in Weiß/Hellgrau steigen langsam auf (16–19 px pro Schleife),
  mit leichtem Wackeln, wachsen/schrumpfen (L.puff_ebene), hinter der Figur.
* Metall glänzt (Regel 12/14: nur Metall): ein Lichtband läuft zweimal pro Schleife (Frames 3–16 und 27–40) diagonal über Rohre und Metallstreifen, 1–2 Stufen heller auf der Rampe des Sprites
  (Bart, Umhang und Dampf glänzen nicht); je ein vierzackiger Glitzer-Stern an der linken Rohrspitze (Frames 10–13), an der rechten (Frames 26–29) und am Metallstreifen
  rechts (Frames 40–43).
Frame 0 = Original (Ruhepose), der Dampf ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (es wird nichts verschoben, was Verdecktes freilegt; Umhang schwingt frei am oberen Ansatz).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 22, 3

spr = L.lade('steam-dwarf-brewer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


PIPE_RAMPE = [(62, 62, 62), (81, 81, 81), (108, 108, 108), (156, 156, 156), (189, 189, 189)]
BAND_RAMPE = [(106, 106, 106), (156, 156, 156), (189, 189, 189), (213, 213, 213)]
BART_RAMPE = [(156, 156, 156), (189, 189, 189), (213, 213, 213), (246, 255, 255)]
UMHANG_RAMPE = [(23, 0, 0), (47, 0, 0), (52, 0, 0), (61, 0, 0), (84, 0, 0), (110, 0, 0)]
WEISS, HELLGRAU, MITTELGRAU = (246, 255, 255), (213, 213, 213), (189, 189, 189)
UMHANG_FARBEN = {(0, 0, 0), (84, 0, 0), (61, 0, 0), (23, 0, 0), (110, 0, 0), (47, 0, 0), (52, 0, 0), (32, 24, 0), (27, 27, 27)}

# Teile
arm_l = vorhanden & (((xx <= 4) & (yy == 16)) | ((xx <= 5) & (yy >= 17)))
arm_r = vorhanden & (((xx >= 17) & (yy == 16)) | ((xx >= 16) & (yy >= 17)))
for m in (arm_l, arm_r):                                   # nur dunkle Umhangfarben (Bartumrisse C/F bleiben beim Kopfteil)
    for (y, x) in zip(*np.nonzero(m)):
        if f(x, y) not in UMHANG_FARBEN:
            m[y, x] = False
kopfteil = vorhanden & ~arm_l & ~arm_r

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                   # Farben der Außenkante im Original (Regel 16)

# Masken für das Lichtband
def maske(bed):
    return np.array([[bool(vorhanden[y, x] and bed(x, y)) for x in range(sw)] for y in range(sh)])


m_rohr = maske(lambda x, y: y <= 10 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x])            # nur Innenpixel (Randpixel = Umriss bleiben)
m_band = maske(lambda x, y: 13 <= y <= 16 and f(x, y) in BAND_RAMPE and x not in range(9, 13) and not KANTE0[y, x])
m_bart = maske(lambda x, y: y >= 16 and 6 <= x <= 15 and f(x, y) in BART_RAMPE)
m_tuch = maske(lambda x, y: (arm_l[y, x] or arm_r[y, x]) and f(x, y) in UMHANG_RAMPE)

# Rohre: x-Bereich je Rohr und seitlicher Ausschlag (Zeilen 0–3; benachbarte Zeilen ≤ 1 Unterschied)
ROHRE = {'l': (0, 6), 'm': (8, 13), 'r': (14, 22)}               # x-Bereich je Rohr (Rohre sind zeilenweise getrennt)
ROHR_STUFE = {1: {0: 1, 1: 1, 2: 1}, 2: {0: 1, 1: 1, 2: 1}}


def rohr_stufe(i, name):
    if name == 'l':
        v = 2.0 * math.sin(L.sinus(i, N / 4))
    elif name == 'r':
        v = -2.0 * math.sin(L.sinus(i, N / 4))
    else:
        v = 1.5 * math.sin(L.sinus(i, N / 3))
    return max(-1, min(1, int(round(v))))                      # nur ±1 px (bei ±2 sahen die dünnen Rohrspitzen ausgefranst aus)


def umhang_dx(y, y0, ymax, v):
    return int(round(2.0 * (y - y0) / (ymax - y0) * v))


def teil(maske_):
    t, _ = L.trenne(spr, maske_)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, dampf=True):
    kp = teil(kopfteil)
    al = teil(arm_l)
    ar = teil(arm_r)
    # --- Metallglanz (Regel 14: nur Metall = Rohre und Metallstreifen; Bart, Umhang und Dampf glänzen NICHT) ---
    for start in (3, 27):
        Hm.lichtband(kp, m_rohr, OFF, i, N, start, 14, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(kp, m_band, OFF, i, N, start, 14, BAND_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Dampfrohre zittern (je Rohr eigener Ausschlag) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a:
            tab = ROHR_STUFE[min(2, abs(a))]
            Hm.bereich_versatz(kp, OFF, {y: int(math.copysign(d, a)) for y, d in tab.items()}, x0, x1)
    # --- Umhang weht (spreizt sich nur nach außen, am Bart bleibt er angewachsen): links Zeilen 18–26, rechts Zeilen 18–23 ---
    vl = max(0.0, math.sin(L.sinus(i, N / 2)))
    vr = max(0.0, math.sin(L.sinus(i, N / 2) + math.pi))
    Hm.rand_dehnen(al, OFF, {y: umhang_dx(y, 17, 26, vl) for y in range(18, 27)}, 'l')
    Hm.rand_dehnen(ar, OFF, {y: umhang_dx(y, 17, 23, vr) for y in range(18, 24)}, 'r')
    # --- Auf und ab: Brust zuerst (Bartzeile 21), Kopf 3 Frames später (Kinnzeile 16, nur Kopfteil) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    if brust:
        kp = L.streck_zeile(kp, PAD_T + 21, brust)
        al = L.streck_zeile(al, PAD_T + 21, brust)
        ar = L.streck_zeile(ar, PAD_T + 21, brust)
    if kopf:
        kp = L.streck_zeile(kp, PAD_T + 16 - brust, kopf)
    hub = brust + kopf
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (kp, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, (0, 0, 0))                 # Regel 16: Außenkante in jeder Pose in Umrissfarbe (z. B. am Umhang)
    # --- Glitzer-Sterne an den Rohrspitzen und am Metallstreifen (Effekt über der Figur, mit dem Kopf mitgehoben) ---
    gl = L.leer(H, W)
    for (sx, sy, start) in ((2, 1, 10), (19, 1, 26), (16, 13, 40)):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - hub, st, WEISS, HELLGRAU, MITTELGRAU, OFF)
    ebenen = []
    if dampf:
        px, py = PAD_L, PAD_T - 1
        spec = [dict(x=px + 2, y=py, vx=-1, vy=-17, off=0, form='m', wackeln=1.2),
                dict(x=px + 3, y=py, vx=0, vy=-15, off=16, form='o', wackeln=1.0),
                dict(x=px + 2, y=py, vx=-1, vy=-18, off=32, form='k', wackeln=1.5),
                dict(x=px + 10, y=py, vx=0, vy=-19, off=8, form='m', wackeln=1.2),
                dict(x=px + 11, y=py, vx=1, vy=-16, off=24, form='o', wackeln=1.0),
                dict(x=px + 10, y=py, vx=-1, vy=-18, off=40, form='k', wackeln=1.5),
                dict(x=px + 19, y=py, vx=1, vy=-17, off=4, form='m', wackeln=1.2),
                dict(x=px + 18, y=py, vx=0, vy=-15, off=20, form='o', wackeln=1.0),
                dict(x=px + 19, y=py, vx=1, vy=-18, off=36, form='k', wackeln=1.5)]
        ebenen.append((L.puff_ebene(H, W, i, N, spec, {'c': WEISS, 'r': HELLGRAU}), 0, 0))
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
    L.speichern('steam-dwarf-brewer', 'Steam Dwarf Brewer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-brewer-strip.png', frames, spalten=12, scale=4)
