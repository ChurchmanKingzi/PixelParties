# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Ma“ (Creature, Archetyp Guardian Beasts) — der Pferde-Wächter (Zeichen „Ma“ = Pferd) mit weißer Mähne, dunkelviolettem Gewand, goldrotem Brustschmuck und goldenen Stiefeln.

Quelle: src/guardian-beast-ma.png (28×36 px, 24 Farben).
PICK: [["MotiveGuardianBeasts", 66, 1]]      (Ebene „Ma #3“, Figur 1; Ebene 67 „Ma #1“ ist ein goldener Trichter mit schwarzer runder Öffnung, der auf der Karte rechts hinter der Figur liegt)
Abgleich mit der Kartenkunst Guardian_Beast_Ma.png (76×51): Sprite sitzt dort bei (24,9), 100 % Pixeltreffer. Der goldene Trichter (Ebene 67) wird von keiner Hand gehalten und ist nicht eindeutig zu deuten (Horn? Tor?) → nicht übernommen und im Bericht erwähnt.
Die Quelle war damit vollständig (die Figur steht allein in der Ebene).

Aufruf:   python3 guardian_beast_ma.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-ma.png + .json

Identifikation (x, y im 28×36-Sprite):
* MÄHNE (x 5–21, y 0–15): weißes/hellgraues Haar (224,228,231)/(247,253,253)/(172,174,173)/(121,122,126); links und rechts hängen Strähnen bis y 13 bzw. y 15 (x 5–8 / x 18–21).
* GESICHT (x 9–17, y 10–15): im Schatten, fast schwarz/violett ((21,14,22)/(24,12,34)/(67,52,95)/(90,72,100)); es sind KEINE Augen erkennbar (nur dunkle Schattenflächen) → kein Blinzeln, nichts geraten.
* GEWAND (y 14–32): dunkelviolett (24,12,34)/(37,28,55)/(50,34,79)/(67,52,95); LINKER ÄRMEL (x 0–8, y 14–30) mit weißem/lavendelfarbenem Fellbesatz (253,249,252)/(199,180,218), weißer Saum bei (2–8,28–29);
  RECHTER ÄRMEL (x 19–27, y 14–31) mit weißer Kante (253,249,252)/(139,139,142) bei x 26–27 und goldenem Handschutz (180,148,35)/(218,197,92)/(245,236,157) bei (19–25,26–29), darunter weiß/grau (253,249,252)/(139,139,142) bei (22–26,30–31).
* BRUSTSCHMUCK (x 9–19, y 17–25): goldene Halskrause (98,78,15)/(144,135,56)/(213,191,72)/(218,197,92)/(234,213,120) mit roten Edelsteinen (189,40,34) bei (13,19), (16,19), (11,22), (15,22) (dunkelrote Fassungen (140,20,32)/(78,8,19)).
* GÜRTELSCHNALLE: weiße Pixel (253,249,252) bei (12–14,29) (Gürtelzipfel).
* BEINE/SAUM (y 30–32): zwei dunkle Gewandzipfel (x 5–11 und x 15–21); STIEFEL (y 33–35): Gold (180,148,35)/(218,197,92)/(245,236,157) mit Umriss (102,91,46).
Gold/Edelsteine: Halskrause, Handschutz, Stiefel, rote Steine → nur sie glänzen bzw. pulsieren (Regel 12/14); Haar, Stoff und Fell nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; bewusst ruhig und würdevoll):
* Atmen in zwei Stufen (Periode 30, zwei Atemzüge): der Rumpf (ab Zeile 14) steigt zuerst 1 px — die texturierte Gewandzeile 32 wird einmal doppelt eingefügt (mit Texturmischung), die Stiefel bleiben —, der Kopf mit Mähne
  folgt 4 Frames später um 1 px und sinkt wieder zuerst nach Einatmen (er steigt nie ohne den Rumpf, daher entsteht kein Spalt am Hals).
* (Runde 3, Nutzerwunsch „das seitliche Zucken am Kopf sieht wie ein Glitch aus, weg damit!“): das frühere seitliche Wehen der Mähnenspitzen (Zeilen 11–13, ±1–2 px nach außen) ist ENTFERNT — der Kopf
  bewegt sich nur noch senkrecht mit dem Atmen; keine seitliche Bewegung am Kopf.
* Rote Edelsteine pulsieren: die zwei oberen Steine (Frames 12–17) und die zwei unteren (Frames 42–47) werden eine Stufe dunkler ((189,40,34) → (140,20,32)) und wieder hell.
* Gold glänzt (Regel 12/14): Lichtband über Halskrause/Handschutz (Frames 18–29), später über die Stiefel und den Handschutz (Frames 48–59); Glitzersterne an der Halskrause (Frames 6–10), am Handschutz (Frames 36–40).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; steigt der Rumpf, überdeckt er die unteren Haarzeilen).
"""
import sys

import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten(nicht_holen=[(21, 14, 22), (24, 12, 34), (37, 28, 55), (78, 8, 19)])   # dunkle Umriss-/Nahtfarben werden nie in eine eingefügte Zeile geholt (keine verdickten Linien)

N, MS = 60, 70
sz = G.Szene('guardian-beast-ma', (2, 2, 3, 2))
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f

UMRISS = f(9, 10)                                                # (24,12,34)
GEM_HELL, GEM_DUNKEL = f(13, 19), f(9, 18)                       # (189,40,34) → (140,20,32)
GOLD = [(98, 78, 15), (144, 135, 56), (180, 148, 35), (213, 191, 72), (218, 197, 92), (234, 213, 120), (245, 236, 157)]
GEMS_OBEN = [(13, 19), (16, 19)]
GEMS_UNTEN = [(11, 22), (15, 22)]

kopf = sz.vorhanden & ((sz.yy <= 13) | ((sz.yy <= 15) & (sz.xx >= 9) & (sz.xx <= 22)))
rumpf = sz.vorhanden & ~kopf
stiefel = sz.maske(0, 33, 27, 35)
rumpf &= ~stiefel
m_gold = sz.vorhanden & L.farbmaske(spr, GOLD) & (sz.yy >= 17)


def frame(i):
    kp, rp, st = sz.ebene(kopf), sz.ebene(rumpf), sz.ebene(stiefel)
    # --- Edelsteine pulsieren (eine Stufe dunkler) ---
    if Hm.folge(i, 12, [1, 1, 1, 1, 1, 1], N):
        sz.setze(rp, {p: GEM_DUNKEL for p in GEMS_OBEN})
    if Hm.folge(i, 42, [1, 1, 1, 1, 1, 1], N):
        sz.setze(rp, {p: GEM_DUNKEL for p in GEMS_UNTEN})
    # --- Gold glänzt ---
    Hm.lichtband(rp, m_gold, OFF, i, N, 18, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(rp, m_gold, OFF, i, N, 48, 12, GOLD, stufen=1, breite=2.6, achse=(-1.0, 1.0), kern=2)
    Hm.lichtband(st, sz.maske(0, 33, 27, 35), OFF, i, N, 48, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 0.0), kern=2)
    for (x, y), start in (((13, 23), 6), ((22, 28), 36)):
        s = Hm.folge(i, start, [0, 1, 1, 0], N)
        if s is not None:
            Hm.stern4(rp, x, y, s, GOLD[6], GOLD[5], off=OFF)
    # --- Atmen: erst Rumpf (Gewandzeile 32 doppelt), Kopf folgt später und nur innerhalb des Rumpf-Hubs ---
    w = Hm.welle01(i, N / 2)
    rb = 1 if w > 0.35 else 0
    kb = 1 if w > 0.8 else 0
    rp, = TX.szene_atmen(sz, [rp], 32, rb)
    kp = L.versetze(kp, 0, -kb)
    fig = L.zusammen(H, W, [(st, 0, 0), (kp, 0, 0), (rp, 0, 0)])
    return sz.kontur(fig, UMRISS)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-ma', 'Guardian Beast Ma', MS, prev)
