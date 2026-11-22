# -*- coding: utf-8 -*-
"""Idle-Animation für „Sky Archeologist“ (Creature) — der weißhaarige alte Archäologe im braunen Mantel steht ruhig da, die Spitzhacke über der Schulter.

Quelle: src/sky-archeologist.png (23×28 px, 30 Farben).
PICK: [["MotiveMoe", 466, 1]] (Ebene „Sky Archeologist“, komplett). Abgleich mit Sky_Archeologist.png: stimmt überein.

RUNDE 10 (Nutzer: „Sieht schrecklich aus. Mach den neu, wir nehmen keine Hack-Animation, sondern einfach nur eine generische Idle.“): Skript NEU und schlank. Die Schlag-Posen, die gedrehten Hacken,
der neu gesetzte Arm, die Steinsplitter und alle Ergänzungen der Runden 8/9 sind ersatzlos entfernt. Der Sprite bleibt in JEDEM Frame in Originalform (Hacke über der Schulter).

Was im Sprite ist (x, y im 23×28-Sprite), Figur im Profil nach rechts:
* HAAR (y 6–14, x 0–9) weiß/hellgrau, brauner Umriss (49,24,0). GESICHT (x 4–9, y 9–14); helle/graue Pixel (5–7, 11–12) = Brille/Schnurrbart, kein Auge sicher erkennbar → KEIN Blinzeln.
* SPITZHACKE: Stiel (3 px breit dunkel–braun–dunkel) vom Griffende (10,13) schräg nach oben rechts; Metallkopf (Umriss (45,45,45), Licht (160…201)) als rechter Winkel
  (waagerechter Schenkel y 0–2, senkrechter Schenkel x 20–22). HAND (8–9, 13–14) am Griffende.
* ARM: gelb-orange karierter Streifen (x 5–8, y 15–20), 2 px stark. MANTEL (y 15–22) dunkelbraun, Gürteltasche grau (y 20–21), dunkle Gürtellinie (y 22), Hose (y 23–24),
  STIEFEL rotbraun (y 25–27), schwarzer Schuh/Schatten (7–10, 26).
Metall: nur der Hackenkopf.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos, Frame 0 = Original):
* Ruhiges Atmen (Periode 16 = 1,3 s; je 8 Frames eingeatmet: Frames 3–10, 19–26, 35–42): die graue Taschenzeile 21 wird einmal texturiert eingefügt (anim_textur) – alles darüber (Mantel, Arm, Hand, Kopf und die
  ganze Hacke) steigt als EINE starre Einheit 1 px; Arm und Hacke liegen vollständig über der Streckzeile und bleiben pixelgleich (nichts wird dicker, die dunkle Gürtellinie 22 wird nicht verdoppelt).
  Hose, Stiefel und Schuh stehen still.
* Kurzer Sparkle am Metallkopf, zweimal je Schleife (je 3 Frames: Mitte → kleines Kreuz → Mitte): Frames 13–15 am waagerechten Schenkel (16,1), Frames 37–39 am senkrechten Schenkel (20,5);
  das Kreuz liegt ganz auf den Pixeln des Hackenkopfs, Farbe = hellstes Metallgrau (201,201,201) der Quelle.
Kein Blinzeln, keine Partikel, keine Posen. Ergänzungen: keine. Nur ganze Pixel, nur Farben der Quelle.
"""
import anim_humanoide as Hm
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 80
F = G.Figur('sky-archeologist', (2, 2, 3, 2))
spr = F.spr
HELL = F.f(16, 1)                                                   # (201,201,201): hellstes Metall des Hackenkopfs
ATEM = [0] * 3 + [1] * 8 + [0] * 5
FUNKEL = ((16, 1, 13), (20, 5, 37))                                 # (x, y, Startframe) – Kreuzarme liegen auf Pixeln des Hackenkopfs
for _x, _y, _ in FUNKEL:
    assert all(F.da[_y + dy, _x + dx] for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    at = ATEM[i % 16]
    fig = F.streck(F.ebene(F.da), 21, at)                            # ganzer Sprite; alles oberhalb der Taschenzeile steigt starr
    if not nur:
        for x, y, start in FUNKEL:
            Hm.stern4(fig, x, y - at, Hm.folge(i, start, [0, 1, 0], N), HELL, HELL, off=F.OFF)
    return fig


if __name__ == '__main__':
    G.abschluss(F, 'Sky Archeologist', [frame(i) for i in range(N)], MS)
