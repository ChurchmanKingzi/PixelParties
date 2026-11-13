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

RUNDE 4 (Nutzer: „Flug-Animation sieht immer noch sehr schlecht aus … der linke Flügel müsste KOMPLETT bewegt werden, da schaut nur die Spitze raus, das Gelenk sitzt viel weiter unten, und der andere Flügel hat
sein Gelenk beim Übergang zum Körper; aktuell knickt dieser mitten drin ab“): Beide Flügel werden nicht mehr gebogen/umgetastet, sondern je Schlüsselpose NEU GEZEICHNET (anim_r4_fluegel.band_fluegel: Fläche um die
Mittellinie, Umriss immer 1 px, Längsstreifen wie im Original). 12 Posen je Schlag (16 Frames = 960 ms, Abschlag 4 Frames, Aufschlag 8):
* naher Flügel (rechts): Gelenk (39,32) im Rumpf unter der Rückenlinie; der GANZE Flügel schlägt von 63° über bis 18° unter der Waagerechten (pixelsaubere Steigungen 2:1, 3:2, 1:1, 2:3, 1:2, 1:3, 0), die Spitze läuft in einem
  weichen Bogen ≤ 10° nach (kein Knick). Er kommt hinter der (ergänzten) Rückenlinie (37…42, 31) hervor. Frame 0 = Originalpixel.
* ferner Flügel (links, „Blatt“): die sichtbare Spitze hängt an einem verdeckten Arm (Gelenk (26,34) hinter dem Hals, Handgelenk (17,25) hinter dem Kopf); Arm + Blatt drehen sich als Ganzes bis 42° nach außen/unten,
  das Blatt verschwindet dabei hinter Kopf und Schnabel (Sichtgrenze = Oberkante von Kopf/Schnabel). Nach oben über die Originalstellung hinaus schlägt er nicht (dort stünde er hinter dem Horn).
Die folgenden Abschnitte zu RUNDE 2/3 und „Ablauf“ beschreiben beim Flügelschlag den früheren Stand (ersetzt); Bob, Horn, Füße, Blinzeln sind unverändert.

RUNDE 3 (Nutzer: „muss viel stärker mit den Flügeln schlagen, zeichne hier eigene Frames für!“): der Flügelschlag wurde komplett neu aufgebaut (Schlag 16 Frames = 960 ms, 3 Schläge je Schleife, Abschlag 6 Frames, Aufschlag 10, kein Ruhefenster):
* langer Flügel: schwingt als GANZES um die Schulter (innen 78 %, an der Spitze 100 % des Hubs von 150°, Spitze hinkt 1,6 Frames nach und biegt sich durch) — von fast senkrecht nach oben (≈ 80° über der Waagerechten, Original = 46°)
  bis weit nach hinten unten (ca. 50° UNTER der Waagerechten; vorher nur bis knapp unter die Waagerechte, weil sich nur die Spitze bog). Frame 0 liegt auf dem Aufschlag bei 23 % des Hubs und ist die Originalpose.
* Blatt links (zweiter Flügel): schlägt mit, klappt aber nach oben nur wenig (25 %), nach unten/außen um bis zu ca. 115°, damit es nicht über Auge und Horn klappt. Körper hebt sich beim Abschlag bis 3 px.
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
import anim_r4_fluegel as R4

N, MS = 48, 60
BEAT, DOWN, UP = 16, 5, 11                                     # Frames je Flügelschlag (nur noch für den Schwebe-Bob; die Flügel laufen über die Posenfolge FOLGE)
P0 = 2.0                                                       # oberer Umkehrpunkt 2 Frames vor Frame 0 (Frame 0 = Originalpose, schon im Abschlag)
PAD_L, PAD_R, PAD_T, PAD_B = 14, 26, 18, 40                    # Arbeitsleinwand (am Ende zugeschnitten); rechts Platz für den abgesenkten Flügel

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
m_fluegel = vorhanden & ~m239 & (xx >= 39) & (yy <= 34)        # langer Flügel rechts (das einzelne Kartenpixel (42,43) am Fuß gehört zum Fuß, nicht zum Flügel)
m_kopf = vorhanden & ~m239 & (xx < 39)
m_blatt = m_kopf & (xx <= 19) & (yy <= 26)                     # Spitze des FERNEN (vom Betrachter linken) Flügels, die hinter dem Kopf hervorschaut
m_horn = m_kopf & (xx >= 21) & (yy <= 18)                      # dunkles Horn neben dem Auge
m_koerper = vorhanden & (m239 | (~m239 & (xx >= 39) & (yy > 34)))   # Rumpf + Fuß (Ebene 239) und das Kartenpixel (42,43) am Fuß
m_auge = vorhanden & L.farbmaske(spr, AUGEN_FARBEN)
m_fuss = m_koerper & (xx >= 38) & (yy >= 40)                    # Füße am Rumpf
# RUNDE 4: Der Flügelansatz (in Ebene 239 mitgezeichnet: Zeilen 29–31 ab x = 37) gehört zum Flügel. Der Rumpf bekommt dort seine Rückenlinie zurück (Ergänzung: (37…42, 31) Umriss),
# der Flügel kommt in jeder Pose HINTER dieser Linie aus dem Rücken (Gelenk (39,32) liegt verdeckt im Rumpf) → kein Knick, keine Lücke am Ansatz.
m_ansatz = m239 & (xx >= 37) & (yy >= 29) & (yy <= 31)
# Umrisspixel, die Flügelspitze und Kopf sich teilen, bleiben am Kopf: (19, 22…24), (18,25), (16…17, 26)
m_kopfrand = m_blatt & (((xx == 19) & (yy >= 22) & (yy <= 26)) | ((xx == 18) & (yy >= 25)) | ((yy == 26) & (xx >= 16) & (xx <= 17)))      # dazu die Kopfpixel (19,25)(18,26)(19,26)
m_blatt = m_blatt & ~m_kopfrand
m_rumpf = m_koerper & ~m_fuss & ~m_ansatz
m_kopf_rest = m_kopf & ~m_blatt & ~m_horn
assert int(m_auge.sum()) == 3, int(m_auge.sum())
RUECKEN = [(x, 31) for x in range(37, 43)]                     # ergänzte Rückenlinie unter dem Flügelansatz


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


P_FL, P_BLATT, P_RUMPF, P_FUSS, P_KOPF, P_HORN, P_ANSATZ = ebene(m_fluegel), ebene(m_blatt), ebene(m_rumpf), ebene(m_fuss), ebene(m_kopf_rest), ebene(m_horn), ebene(m_ansatz)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_FL, P_BLATT, P_RUMPF, P_FUSS, P_KOPF, P_HORN, P_ANSATZ)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
for (x, y) in RUECKEN:
    P_RUMPF[PAD_T + y, PAD_L + x] = AUSSEN + (255,)
UMRISS = F.umriss_farben(spr)

Y_FUSS = PAD_T + 40                                            # Füße pendeln unterhalb dieser Zeile
Y_HORN = PAD_T + 18                                            # Horn wippt oberhalb dieser Zeile
BLINZ = {32, 33, 34}


def welle(t):
    """Schlagphase 0 (oben) … 1 (unten) für den Schwebe-Bob."""
    u = (t + P0) % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / UP)


# ── RUNDE 4: Flügel als neu GEZEICHNETE Schlüsselposen (anim_r4_fluegel.band_fluegel), keine gedrehte/gebogene Abtastung mehr ──────────────────────────────────
# Naher Flügel (rechts): Gelenk G_NAH = (39,32) liegt verdeckt im Rumpf direkt unter der Rückenlinie; die Mittellinie des Originals (x + y = 71) läuft genau hindurch. Der GANZE Flügel (45,5 px) schlägt um dieses Gelenk.
# Querschnitt wie im Original: Umriss · dunkles Vorderkantenband · Innenlinie · Haut · helle Hinterkante (2 px) · Umriss; Spitze läuft zu; Flügelkralle an der Vorderkante bei s ≈ 30–34.
HAUT_D, HAUT_M, HAUT_H, BAND_D = (111, 67, 66), (122, 84, 73), (151, 100, 81), (77, 46, 43)
G_NAH, L_NAH = (39.0, 32.0), 45.5
G_FERN, ELLE, SPITZE = (26.0, 34.0), (17.2, 25.5), (18.2, 10.8)   # ferner Flügel: Gelenk hinter dem Hals verdeckt, „Handgelenk“ hinter dem Kopf, Spitze des sichtbaren Blatts
L_ARM = math.hypot(ELLE[0] - G_FERN[0], ELLE[1] - G_FERN[1])
L_BLATT = math.hypot(SPITZE[0] - ELLE[0], SPITZE[1] - ELLE[1])


def _halb_nah(s):
    return 3.2 if s <= 37 else max(0.7, 3.2 - (s - 37) / (L_NAH - 37) * 2.6)


def _kralle(s, d):
    return 29.6 <= s <= 34.4 and -4.7 + max(0.0, 31 - s) * 0.9 <= d <= 0


def _farbe_nah(s, d=None, schritt=None, k=None):
    if s == 'rand':
        return AUSSEN
    n = int(round(5.66 / schritt))                             # Pixelschritte quer über den Flügel (8 bei 45°, 6 bei 0°)
    if d < -n * schritt / 2 - 0.01:
        return BAND_D if int(s) % 2 else HAUT_D                # Flügelkralle
    idx = int(math.floor((d + n * schritt / 2) / schritt + 0.5))
    if idx <= 0 or idx == 2:
        return AUSSEN                                          # Vorderkante / Innenlinie
    if idx == 1:
        return HAUT_D
    return HAUT_H if idx >= n - 2 else HAUT_M


def nah_pose(a_wurzel, a_spitze=None):
    """Naher Flügel, Winkel über der Waagerechten (rad). a_spitze ≠ a_wurzel: die äußere Hälfte läuft in einem weichen Bogen (6 Teilstücke) nach — kein Knick."""
    a_spitze = a_wurzel if a_spitze is None else a_spitze
    pts = [(PAD_L + G_NAH[0], PAD_T + G_NAH[1])]
    stuecke = [(16.0, a_wurzel)] + [((L_NAH - 16.0) / 6, a_wurzel + (a_spitze - a_wurzel) * (j + 1) / 6) for j in range(6)]
    if a_spitze == a_wurzel:
        stuecke = [(L_NAH, a_wurzel)]
    for ln, a in stuecke:
        x, y = pts[-1]
        pts.append((x + ln * math.cos(a), y - ln * math.sin(a)))
    return R4.band_fluegel(H, W, pts, _halb_nah, _farbe_nah, extra=_kralle)


def _halb_fern(s):
    if s <= L_ARM:
        return 2.6
    t = s - L_ARM
    hw = min(3.3, 2.6 + 0.35 * t)
    rest = L_BLATT - t
    if rest < 8:
        hw = min(hw, 1.0 + 2.3 * (max(rest, 0.0) / 8) ** 0.7)
    return hw


def _farbe_fern(s, d=None, schritt=None, k=None):
    if s == 'rand':
        return AUSSEN
    return HAUT_H if d >= _halb_fern(s) - 1.95 else HAUT_M      # helle Kante auf der Körperseite wie im Original


def fern_pose(phi, nach=0.0):
    """Ferner Flügel: Arm + Blatt als Ganzes um G_FERN gedreht NEU gezeichnet (phi > 0 = Abschlag, gegen den Uhrzeigersinn); nach = Zusatzwinkel des Blatts am Handgelenk (Spitze hängt nach)."""
    def dreh(p, um, w):
        dx, dy = p[0] - um[0], p[1] - um[1]
        c, s_ = math.cos(w), math.sin(w)
        return (um[0] + dx * c + dy * s_, um[1] - dx * s_ + dy * c)
    e = dreh(ELLE, G_FERN, phi)
    t = dreh(dreh(SPITZE, G_FERN, phi), e, nach)
    pts = [(PAD_L + q[0], PAD_T + q[1]) for q in (G_FERN, e, t)]
    a = R4.band_fluegel(H, W, pts, _halb_fern, _farbe_fern)
    a[~FERN_SICHTBAR] = 0                                      # der ferne Flügel verschwindet hinter der Oberkante von Kopf und Schnabel (auch nicht durch den offenen Schnabel/unter dem Hals sichtbar)
    # Winzige Hintergrundtaschen (≤ 2 px), die zwischen Flügel und Kopf/Schnabel eingeschlossen wären, gehören zum Flügel (er läuft dort hinter dem Kopf weiter)
    frei = (~((a[..., 3] > 0) | _vorn | (P_HORN[..., 3] > 0))).astype(np.uint8)
    n, lab = cv2.connectedComponents(frei, connectivity=4)
    for c in range(1, n):
        ys, xs = np.nonzero(lab == c)
        if len(ys) <= 2 and not ORIG_LOCH[ys, xs].any():
            a[ys, xs] = HAUT_M + (255,)
    # Schnittkante sauber schließen: jedes Flügelpixel mit freiem Nachbarn (weder Flügel noch Kopf/Schnabel/Rumpf) ist Umriss
    belegt = (a[..., 3] > 0) | _vorn | (P_HORN[..., 3] > 0)
    for y, x in zip(*np.nonzero(a[..., 3])):
        if not (belegt[y - 1, x] and belegt[y + 1, x] and belegt[y, x - 1] and belegt[y, x + 1]):
            a[y, x, :3] = AUSSEN
    return a


# Sichtbarkeitsgrenze des fernen Flügels: je Spalte alles oberhalb des obersten Pixels von Kopf/Schnabel/Rumpf (ohne Horn — der Flügel kommt nie dahinter)
FERN_SICHTBAR = np.zeros((H, W), bool)
_vorn = (P_RUMPF[..., 3] > 0) | (P_KOPF[..., 3] > 0)
for _x in range(W):
    _ys = np.nonzero(_vorn[:, _x])[0]
    FERN_SICHTBAR[:(_ys.min() if len(_ys) else H), _x] = True

_frei0 = (~(L.zusammen(H, W, [(q, 0, 0) for q in (P_FL, P_BLATT, P_RUMPF, P_FUSS, P_KOPF, P_HORN, P_ANSATZ)])[..., 3] > 0)).astype(np.uint8)
_n0, _lab0 = cv2.connectedComponents(_frei0, connectivity=4)
ORIG_LOCH = (_lab0 != _lab0[0, 0]) & (_frei0 > 0)               # Hintergrundpixel, die schon in der Quelle eingeschlossen sind (offener Schnabel …) — bleiben frei

W63, W56, W45, W34, W27, W18 = math.atan(2), math.atan(1.5), math.atan(1), math.atan(2 / 3), math.atan(0.5), math.atan(1 / 3)     # pixelsaubere Steigungen 2:1, 3:2, 1:1, 2:3, 1:2, 1:3
GRAD = math.radians
#        Name    naher Flügel (Wurzel, Spitze)     ferner Flügel (phi, Nachhängen)
POSEN = {'O': None,                                                    # Original (45°) — Pixel der Quelle
         'M': ((W27, W27 + GRAD(10)), (GRAD(12), GRAD(-6))),           # Abschlag: Spitze hängt nach oben nach
         'H': ((0.0, GRAD(10)), (GRAD(27), GRAD(-6))),
         'D': ((-W18, -W18), (GRAD(42), 0.0)),                         # unten (18° unter der Waagerechten: der Flügel bleibt frei von den Füßen)
         'a1': ((GRAD(-9), GRAD(-19)), (GRAD(38), GRAD(6))),           # Aufschlag: Spitze hängt nach unten nach
         'a2': ((0.0, GRAD(-10)), (GRAD(30), GRAD(8))),
         'a3': ((W18, W18 - GRAD(10)), (GRAD(20), GRAD(8))),
         'a4': ((W27, W27 - GRAD(8)), (GRAD(13), GRAD(6))),
         'a5': ((W34, W34 - GRAD(6)), (GRAD(7), GRAD(4))),
         'a6': ((W45, W45 - GRAD(4)), (GRAD(2), GRAD(2))),
         'a7': ((W56, W56), (0.0, 0.0)),
         'U': ((W63, W63), (0.0, 0.0))}                                # oben
FOLGE = ['O', 'M', 'H', 'D', 'D', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'U', 'U', 'U', 'a7']      # 16 Frames je Schlag: Abschlag 4 Frames, Aufschlag 8, oben/unten kurz gehalten
assert len(FOLGE) == BEAT


def posen_bauen():
    nah, fern = {'O': L.zusammen(H, W, [(P_FL, 0, 0), (P_ANSATZ, 0, 0)])}, {'O': P_BLATT}
    for name, wert in POSEN.items():
        if wert is None:
            continue
        nah[name] = nah_pose(*wert[0])
        fern[name] = P_BLATT if wert[1] == (0.0, 0.0) else fern_pose(*wert[1])
    return nah, fern


NAH, FERN = posen_bauen()


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, BEAT)
    bob = -int(round(3.0 * (welle(i - 1.5) - welle(-1.5))))      # bis 3 px nach oben (zweistufig), hebt sich kurz nach dem Abschlag; Frame 0 = Original

    name = R4.takt(FOLGE, i)
    fl, blatt = NAH[name], FERN[name]
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

    # Schichtung: ferner Flügel ganz hinten, naher Flügel hinter dem Rumpf (kommt hinter der Rückenlinie hervor), davor Rumpf, Füße, Kopf, Horn.
    vorn = L.zusammen(H, W, [(rumpf, 0, 0), (fuss, 0, 0), (kopf, 0, 0), (horn, 0, 0)])
    F.umranden(vorn, [rumpf, fuss, horn], UMRISS, AUSSEN, AUSSEN, AUSSEN)                   # Randpixel-Test (Regel 16) für pendelnde Füße/Horn
    ebenen = [(blatt, 0, bob), (fl, 0, bob), (vorn, 0, bob)]
    if name == 'O':
        ebenen.append((P_ANSATZ, 0, bob))                                                   # Originalpose: der Flügelansatz liegt wie in der Quelle über der Rückenlinie (Frame 0 = Quelle)
    f = L.zusammen(H, W, ebenen)
    # einzelne Hintergrundpixel, die zwischen abgesenktem Flügel, Rumpf und Fuß eingeschlossen wären, schließt die Umrissfarbe (keine Löcher in der Figur)
    frei = (f[..., 3] == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(frei, connectivity=4)
    orig = np.roll(ORIG_LOCH, bob, axis=0)
    for c in range(1, n):
        ys, xs = np.nonzero(lab == c)
        if len(ys) <= 2 and not orig[ys, xs].any() and c != lab[0, 0]:
            f[ys, xs] = AUSSEN + (255,)
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
