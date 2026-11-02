# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Pteranos“ (Creature) — Regeln 14/15/16 (Fleisch/Haut/Knochen: kein Metall, kein Feuer → kein Glanz, keine Funken).

PICK: [["MotiveGrailWar", 239, 1]] + Kopf, Haube und Flügel aus der Kartenkunst (siehe Quelle)
Quelle: src/gigantisaur-pteranos.png — der ganze Flugsaurier (73×49 px, 14 Farben), zusammengesetzt aus zwei Teilen:
* Körper mit Schnabel, Rumpf und Füßen = Ebene 239 („Ebene #276“) aus MotiveGrailWar.xcf, 52×20 px (Original als src/gigantisaur-pteranos-ebene239.png abgelegt), sitzt bei Kartenposition (1,29);
  in der Kartenkunst pixelgenau wiedergefunden (Farbabstand ≈ 5 = Kartenrauschen).
* Kopf mit Haube und Horn sowie der große Flügel (rechts oben, bis zum Kartenrand) stehen in KEINER xcf-Ebene (alle 748 Ebenen von MotiveGrailWar und alle anderen Dateien nach den Farben durchsucht: keine Treffer) — sie wurden
  aus der Kartenkunst herausgelöst: Pixel mit dunklem Umriss (≈(25,4,3)) oder rosabrauner Füllung (G − B ≤ 30, R ≥ 45) im oberen Teil (y ≤ 31), Komponenten ≥ 10 px, jedes Pixel auf die nächste Palettenfarbe
  der Figur gerastet: (25,4,3)/(77,46,43)/(57,27,25)/(111,67,66)/(122,84,73) stammen aus Ebene 239, dazu aus der Kunst die Haut-Lichtfarbe (151,100,81) und die Augenfarben (158,82,80)/(86,14,12) (bei der Prüfung `erlaubt`:
  Farben der Kartenkunst). Danach: Löcher gefüllt (5 px), 3 verstreute Pixel entfernt, die Flügelspitze am Kartenrand mit zwei Umrisspixeln (71–72, 0) geschlossen.

RUNDE 2 (Nutzer: „fehlt ein Stück vom Gesicht? Und die Flügelanimation (die nur einen Flügel animiert…) sieht schrecklich aus“):
* GESICHT: Beim Herauslösen aus der Kartenkunst waren die hellen Schnabelfarben und das Gesichtsbraun am Schnabelansatz durchs Raster gefallen: unter dem Auge fehlte das Stück zwischen Kopf und Schnabel.
  Ergänzt (Pixel aus der Kartenkunst, auf die Figurfarben gerastet; src/gigantisaur-pteranos.png neu): (19,26)(18,27) Kopfbraun (111,67,66); (20,26)(19,27)(17,28)(18,28) Creme (255,240,202);
  (21,26)(20,27)(21,27)(19,28) Pfirsich (255,190,151); (20,28)(21,28) Hellbraun (223,165,117); (16,28)(22,28) Schnabelumriss (59,34,4). Auf Nachbarebenen liegt nichts davon (die Kopf-/Flügelpixel stehen in keiner xcf-Ebene).
* FLÜGEL: Die Figur hat ZWEI Flügel in Flügelhautfarbe (122,84,73)/(151,100,81): den langen Flügel rechts oben UND das rosabraune Blatt links über dem Schnabel (x 13–19, y 11–26; vorher „Haube“ genannt).
  Das dunkle Horn daneben (x 21–26, y 11–22, Kopffarbe) ist KEIN Flügel. Beide Flügel schlagen jetzt gemeinsam. Statt die Flügel als starre Stäbe zu drehen, BIEGT sich jeder entlang seiner Mittellinie (Rückwärtsabbildung
  um eine gekrümmte Achse: Spitze schlägt am weitesten und hinkt der Wurzel nach, die Wurzel bleibt am Rumpf) — die Textur wird nicht kopiert, nur Pixel der Quelle neu abgetastet.

Aufruf:   python3 gigantisaur_pteranos.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-pteranos.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Kopf (x 12–28, y 10–30): gestreckter Kopf mit großer blattförmiger Haube links (x 12–20, y 11–27), einem Horn (x 21–26, y 11–22), rotem Auge bei (22–23, 23); der Schnabel (hell, zwei Zinken, (255,190,151)/(223,165,117)/(255,240,202))
  geht nach links unten (x 0–22, y 28–41).
* Rumpf (x 22–45, y 28–48): braun mit hellgrauem Bauchstreifen, Rückenlinie, unten rechts die Füße/der Schwanzansatz (x 38–51, y 40–48).
* Flügel (x 39–72, y 0–33): ein langer schmaler Flügel schräg nach rechts oben (≈ 45°), dunkler Umriss (25,4,3) auf beiden Seiten, Füllung in vier Brauntönen; Wurzel am Rücken bei (39–45, 26–33).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag BEIDER Flügel (Periode 16 = 960 ms, dreimal pro Schleife; Abschlag 6 Frames, Aufschlag 8 Frames, 2 Frames Ruhe oben, Cosinus-weich): der lange Flügel rechts biegt sich von der Ausgangshaltung (46° über der Waagerechten, Frame 0 = Original)
  bis zu 60° nach unten (Spitze dann ca. 14° UNTER der Waagerechten), das Flügelblatt links biegt sich gegen den Uhrzeigersinn um bis zu 95° nach außen/unten (Spitze zeigt dann nach links). Beide schlagen gemeinsam (das linke 0,5 Frames später).
  Die Biegung wächst von der Wurzel zur Spitze (erste 4 px des Flügels rechts bzw. 2 px des Blatts links bleiben fest am Rumpf bzw. Kopf), die Spitze hinkt der Wurzel um 2 (rechts) bzw. 1,5 (links) Frames nach (Wellenlauf, wie ein biegsamer Flügel). Technik: Rückwärtsabbildung um eine gekrümmte Mittellinie
  (jedes Zielpixel holt sich das Quellpixel an derselben Stelle der Bogenlänge und desselben Querabstands, Nächster-Nachbar, keine Mischfarben, keine Löcher, die Breite des Flügels bleibt erhalten); Umrisslinien bleiben als Linien lesbar.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0), das ganze Tier hebt sich kurz nach dem Abschlag.
* Das Horn (dunkle Spitze neben dem Auge, y ≤ 18) wippt mit Verzögerung leicht nach (bis 1 px, Periode 16). Die Füße am Rumpf schwingen leicht nach (bis 1–2 px an den Spitzen, Periode 16).
* Blinzeln: das Auge schließt sich für 3 Frames (Frame 32–34), das Lid ist die Kopffarbe (111,67,66).
* Kein Glanz, kein Feuer, keine Partikel.

Ergänzungen: keine verdeckten Teile nötig. Wo die Drehung den Flügel von der Wurzel lösen würde, schließt ein Umrisspixel (25,4,3) die Lücke (8-verbunden), liegt der Flügel hinter dem Rumpf.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Drehung und Pendel legen nur Umriss-/Randfarben der Quelle an die Ränder (alle Randfarben der Quelle sind erlaubt); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (plus die drei Farben aus der Kartenkunst), Alpha nur 0/255.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_r2 as R2

N, MS = 48, 60
BEAT, DOWN, UP = 16, 6, 8                                      # Frames je Flügelschlag: Abschlag 6, Aufschlag 8, 2 Frames Ruhe oben (damit Frame 0 trotz Spitzenverzögerung = Original)
PAD_L, PAD_R, PAD_T, PAD_B = 10, 20, 8, 10                    # Arbeitsleinwand (am Ende zugeschnitten); rechts Platz für den abgesenkten Flügel

spr = L.lade('gigantisaur-pteranos')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

AUSSEN = (25, 4, 3)                                            # dunkler Umriss
KOPF = (111, 67, 66)                                           # Kopffarbe (Lid)
AUGEN_FARBEN = [(158, 82, 80), (86, 14, 12)]
KUNST_FARBEN = [(151, 100, 81), (158, 82, 80), (86, 14, 12)]    # nur in der Kartenkunst (nicht in Ebene 239)

e239 = L.lade('gigantisaur-pteranos-ebene239')
m239 = np.zeros((sh, sw), bool)
m239[29:29 + e239.shape[0], 0:e239.shape[1]] = e239[..., 3] > 0
assert (spr[m239] == np.concatenate([e239[e239[..., 3] > 0]])).all()
# Das Gesichts-Stück (Schnabelansatz, 14 px) ist im Quell-Sprite ergänzt (siehe Kopf der Datei); es liegt NICHT in Ebene 239, gehört also zum Kopf.
m_fluegel = vorhanden & ~m239 & (xx >= 39)                     # langer Flügel rechts
m_kopf = vorhanden & ~m239 & (xx < 39)
m_blatt = m_kopf & (xx <= 19) & (yy <= 26)                     # zweiter Flügel links (rosabraunes Blatt)
m_horn = m_kopf & (xx >= 21) & (yy <= 18)                      # dunkles Horn neben dem Auge
m_koerper = vorhanden & m239
m_auge = vorhanden & L.farbmaske(spr, AUGEN_FARBEN)
m_fuss = m_koerper & (xx >= 38) & (yy >= 40)                    # Füße am Rumpf
m_wurzel = m_fluegel & ((xx - 42.0) ** 2 + (yy - 31.0) ** 2 <= 5.6 ** 2)      # Schulter: bleibt am Rumpf (der Flügel biegt sich dahinter heraus)
m_rumpf = (m_koerper & ~m_fuss) | m_wurzel
m_kopf_rest = m_kopf & ~m_blatt & ~m_horn
assert int(m_auge.sum()) == 3, int(m_auge.sum())


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


P_FL, P_BLATT, P_RUMPF, P_FUSS, P_KOPF, P_HORN = ebene(m_fluegel), ebene(m_blatt), ebene(m_rumpf), ebene(m_fuss), ebene(m_kopf_rest), ebene(m_horn)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_FL, P_BLATT, P_RUMPF, P_FUSS, P_KOPF, P_HORN)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
UMRISS = F.umriss_farben(spr)

Y_FUSS = PAD_T + 40                                            # Füße pendeln unterhalb dieser Zeile
Y_HORN = PAD_T + 18                                            # Horn wippt oberhalb dieser Zeile
BLINZ = {32, 33, 34}

# ── Flügel biegen: Rückwärtsabbildung um eine gekrümmte Mittellinie ──────────────────────────────────────────────────────────
#                 Wurzelpunkt (Sprite)  Richtung zur Spitze (rad, y nach unten)   Länge   Drehsinn · Ausschlag   Wurzelzone  Verzögerung der Spitze
FLUEGEL_R = dict(p0=(42.0, 31.0), ang0=math.atan2(-29.5, 28.5), laenge=41.0, A=math.radians(+60.0), s0=4.0, lag=2.0, versatz=0.0)
FLUEGEL_L = dict(p0=(17.0, 25.0), ang0=math.atan2(-14.0, -1.0), laenge=15.0, A=math.radians(-95.0), s0=2.0, lag=1.5, versatz=0.5)


def welle(t):
    """Schlagphase 0 (Flügel oben = Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in UP Frames, danach 2 Frames Ruhe oben; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    if u < DOWN + UP:
        return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / UP)
    return 0.0


def delta(fl, s, t):
    """Zusatzwinkel der Mittellinie an der Bogenlänge s (0 an der Wurzel) zum Zeitpunkt t: wächst zur Spitze, die Spitze hinkt nach; bei t = 0 überall 0 (Ruhepose = Original)."""
    if s <= fl['s0']:
        return 0.0
    f = min(1.0, (s - fl['s0']) / (fl['laenge'] - fl['s0']))
    a = welle(t - fl['versatz'] - fl['lag'] * f) - welle(-fl['versatz'] - fl['lag'] * f)
    return fl['A'] * a * f


def biege(a, fl, t):
    """Ebene `a` (Leinwand) entlang der gebogenen Mittellinie des Flügels `fl` zum Zeitpunkt t neu abtasten (Rückwärtsabbildung, siehe anim_flieger_r2.biege)."""
    return R2.biege(a, (PAD_L + fl['p0'][0], PAD_T + fl['p0'][1]), fl['ang0'], fl['laenge'], lambda s: delta(fl, s, t))


def bruecken8(f, start):
    """Teile, die nach dem Biegen nicht mehr (8-verbunden) am Hauptteil hängen, bekommen Umrisspixel entlang der kürzesten Strecke."""
    for _ in range(8):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)
        if n <= 2:
            break
        hl = lab_[start[1], start[0]]
        hp = np.argwhere(lab_ == hl)
        best = None
        for k in range(1, n):
            if k == hl:
                continue
            cp = np.argwhere(lab_ == k)
            d = np.abs(cp[:, None, :] - hp[None, :, :]).max(axis=2)
            i, j = np.unravel_index(int(d.argmin()), d.shape)
            if best is None or d[i, j] < best[0]:
                best = (int(d[i, j]), cp[i], hp[j])
        _, a, b = best
        y, x = int(a[0]), int(a[1])
        while max(abs(b[0] - y), abs(b[1] - x)) > 1:
            y += int(np.sign(b[0] - y))
            x += int(np.sign(b[1] - x))
            f[y, x, :3] = AUSSEN
            f[y, x, 3] = 255
    return f


def verbinde4(f):
    """Teile, die nur über eine Pixelecke am Hauptteil hängen (4er-Nachbarschaft), bekommen ein Eckpixel in der Farbe ihres Randpixels."""
    for _ in range(6):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=4)
        if n <= 2:
            break
        gr = [int((lab_ == k).sum()) for k in range(n)]
        haupt = int(np.argmax(gr[1:])) + 1
        gefunden = False
        for k in range(1, n):
            if k == haupt or gefunden:
                continue
            for y, x in np.argwhere(lab_ == k):
                for dy, dx in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
                    qy, qx = y + dy, x + dx
                    if 0 <= qy < f.shape[0] and 0 <= qx < f.shape[1] and lab_[qy, qx] == haupt:
                        for cy, cx in ((y, qx), (qy, x)):
                            if not f[cy, cx, 3]:
                                f[cy, cx, :3] = f[y, x, :3]
                                f[cy, cx, 3] = 255
                                gefunden = True
                                break
                    if gefunden:
                        break
                if gefunden:
                    break
        if not gefunden:
            break
    return f


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, BEAT)
    bob = -int(round(2.0 * welle(i - 1.5)))                    # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig), hebt sich kurz nach dem Abschlag

    fl = biege(P_FL, FLUEGEL_R, i)
    blatt = biege(P_BLATT, FLUEGEL_L, i)
    kopf = P_KOPF.copy()
    if effekte and i in BLINZ:
        for y, x in zip(*np.nonzero(m_auge)):
            kopf[PAD_T + y, PAD_L + x, :3] = KOPF
    # Horn wippt (Zeilen oberhalb Y_HORN), kopfüber gespiegelt, damit zeilen_pendel (nur Zeilen UNTER dem Pivot) greift
    hf = P_HORN[::-1].copy()
    hf = F.zeilen_pendel(hf, H - 1 - Y_HORN, 1.2, ph, 1.0, lauf=1.0)
    horn = hf[::-1].copy()
    fuss = F.zeilen_pendel(P_FUSS, Y_FUSS, 1.8, ph, 1.0, lauf=1.0)
    rumpf = P_RUMPF.copy()

    ganz = L.zusammen(H, W, [(fl, 0, 0), (blatt, 0, 0), (rumpf, 0, 0), (fuss, 0, 0), (kopf, 0, 0), (horn, 0, 0)])
    start = (PAD_L + 30, PAD_T + 38)
    mit = verbinde4(bruecken8(ganz.copy(), start))
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(ganz[..., 3] > 0)
    brk[neu] = mit[neu]
    fl, blatt, rumpf, fuss, kopf, horn, brk = (L.versetze(a, 0, bob) for a in (fl, blatt, rumpf, fuss, kopf, horn, brk))
    f = L.zusammen(H, W, [(brk, 0, 0), (fl, 0, 0), (blatt, 0, 0), (rumpf, 0, 0), (fuss, 0, 0), (kopf, 0, 0), (horn, 0, 0)])
    F.umranden(f, [fl, blatt, rumpf, fuss, horn], UMRISS, AUSSEN, AUSSEN, AUSSEN)           # Randpixel-Test (Regel 16): freigelegte Innenfarben → Umriss
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=KUNST_FARBEN)
    print('Pixel je Frame:', n)
    L.speichern('gigantisaur-pteranos', 'Gigantisaur Pteranos', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-pteranos-strip.png', frames, spalten=8, scale=4)
