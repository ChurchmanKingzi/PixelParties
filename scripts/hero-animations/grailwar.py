# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGrailWar-Heroes und -Skins.

Aufruf: python3 grailwar.py <tag> [ms] <variante>

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu je Variante:
* asriel:    Asriel, the Sapling Sacrificer: lacht in der Loop-Mitte manisch
             (der Mund reißt im Takt auf – mal Zähne über dunklem Rachen, mal
             2 px hoch offen – der Oberkörper bebt dabei); Blut läuft die
             Messerklinge hinab und tropft unter der Faust vom Knauf zu Boden.
* barker:    Barker, the Monster Tamer: Federn, Blinzeln (die Augen reichen bis
             in die rote Zeile darunter), die rote Bemalung glimmt auf und ab;
             Peitsche und Metallarmband samt Hand federn als Ganzes mit dem Arm.
* alleria:   Alleria, the Queen of Spiders: nur ganzzahlige Verschiebungen,
             nichts wird neu gerastert: der Körper hebt und senkt sich um
             1 px (die Beinspitzen bleiben stehen, die Beine biegen sich mit),
             jedes der acht Beine hebt und senkt seine Spitze einzeln
             (Gangbild über Kreuz, eigene Phasen), der Spinnenkopf wippt
             eigenständig auf und ab, die Spinnenaugen glühen, sie blinzelt.
* blackstache: der Geisterpirat federt, blinzelt mit den gelben Augen, sein
             durchscheinender Körper flackert leicht; den Säbel neigt er
             leicht auf und ab (Drehung um die Faust), über die Klinge läuft
             ein Lichtreflex und sie funkelt; an den Enden seiner acht Lunten
             sprühen Funken.
* chuck:     Federn, Blinzeln, er redet ununterbrochen (Mund unter dem
             Schnauzbart); die Schaumkrone brodelt ständig (Blasen wogen,
             die Oberkante wölbt sich, Schaumflocken spritzen auf), im Bier
             steigen Bläschen auf.
* codumbus:  Federn; der Globus dreht sich (Land und Meer wandern, das Licht
             bleibt stehen, der Rand bleibt fest); seine zwei türkisen
             Schweißtropfen rinnen ständig über den Globus-Kopf herab.
* devlin / mmdevlin: Federn; von den Krallen tropft Blut (Tropfen bildet
             sich, fällt, zerplatzt am Boden), der Schweißtropfen an der
             Stirn rinnt herab und bildet sich neu.
* enigma:    das Kind in der Kutte erzählt: schnelles Squash-and-Stretch auf
             der Stelle, es schwingt den Arm, der Mund geht auf und zu. Das
             weiße Glitzern (vor dem schwarzen Gesicht, wandert senkrecht mit,
             und daneben) funkelt unabhängig von ihr.
* krates:    Federn, Blinzeln; sein Jo-Jo schnellt am Faden hoch und fällt
             wieder, und dreht sich dabei.
* key:       Federn, Blinzeln; die goldenen Armreifen glitzern, die
             abstehenden Haarsträhnen wandern um ihre Haarwurzel (bleiben
             immer mindestens diagonal mit ihr verbunden).
* kyli:      Squash-and-Stretch in der Senkrechten (die Füße bleiben), die
             schwarzen Äste wiegen sich (oben stärker), die roten Augen
             glühen auf und blinzeln.
* brackle / leonardo: das Katapult auf dem Panzer spannt (Arm kippt nach
             hinten, ein Schädel liegt in der Schale), schnellt vor und
             schleudert den Schädel in hohem Bogen vor die Schildkröte; er
             überschlägt sich, schlägt am Boden auf und explodiert (Feuerkuppel,
             Knochensplitter, aufsteigender Rauch). Beim Abschuss sackt der
             Panzer kurz ein, die Schildkröte blinzelt.
* broghan:   federt, das rote Auge glüht periodisch auf, die Ketten an den Handgelenken schwingen, Eiswolken
             (Nebelballen aus drei Kugeln) quellen neben ihm hervor und treiben
             davon – nie halb hinter der Figur.
* golem:     Ancient Gear Golem: federt, das rote Auge glüht periodisch auf
             (mit Leuchtschein), das Zahnrad an der rechten Schulter (von der
             Kante gesehen) dreht sich, Eiswolken wie bei Broghan.
* clown:     Cecilia the Clown: federt, blinzelt, die blauen Haarschlaufen
             wippen (außen stärker, links und rechts versetzt).
* bbg:       Bad Birthday Girl Cecilia: federt, blinzelt (nur rechts – links
             die Augenklappe), die Partyhut-Spitze wippt nach, die Hakenhand
             blitzt.
* fern / fernelf: Fern putzt sein Schwert: der Lappen gleitet entlang der
             Klinge vor und zurück (zur Schulter hin unbewegt), nach jedem
             Strich läuft ein Glanz über die Klinge; der Elf blinzelt.
* fairy:     Ascended Fern schwebt, die Schmetterlingsflügel flattern
             (spaltenweise Scherung), die pinke Aura flimmert am Rand, pinke
             Funken rieseln als Schweif herab.
* fiona:     Fiona auf dem Thron blinzelt, ihre Krone und der Thron funkeln.
* boarding / chosen: Gabby hängt am Seil und schwingt kräftig daran (das Bild
             ist der Ausschlag nach rechts; jede Zeile rückt als Ganzes seitlich,
             unten stärker – nichts wird neu gerastert), die Haare hängen dem
             Schwung nach, sie blinzelt; beim Chosen Girl läuft ein Glanz
             über das goldene Schwert.
* zombie:    Zombie-Gabby torkelt (Oberkörper schwankt), sackt ab und zu ein,
             blinzelt mit den leeren Augen.
* moon:      Moonlight Warrior: federt, blinzelt, die langen Zöpfe schwingen.
* garius:    federt, blinzelt; Schild und Speer heben und senken sich unabhängig
             voneinander, der rote Helmbusch weht, über die Rüstung läuft ein
             Lichtblitz (samt Funkeln).
* vader:     Dark Garius federt; das rote Lichtschwert leuchtet (pulsierender
             Saum, flackernder Kern), fährt ein, bleibt kurz aus und zündet neu.
* gobbo:     federt, blinzelt, schwenkt den Knüppel (spaltenweise Scherung um die Faust),
             die roten Augen glimmen.
* hatusbal / jack: federt, blinzelt, der Rüssel pendelt (zur Spitze hin
             stärker); Hatusbals roter Umhang weht (Wind von links, unten
             stärker, ohne Lücken), die Krone funkelt; bei Ancient Hatusbal weht
             der Helmbusch.
* hulijing:  federt, blinzelt; das blaue Fuchsfeuer strömt als Partikelfeuer aus
             ihrer Hand (Flammenballen wachsen, kühlen ab, züngeln: weiß,
             hellblau, türkis, blau, dunkelblauer Rand).
* ingo:      vom Base-Sprite aus (ohne Kapuze): er hebt die Arme, die Kapuze aus
             Ingos eigenen Frames kommt aus dem Nacken über den Kopf, die Arme
             sinken; später wieder hoch und die Kapuze zurück in den Nacken.
             Squash-and-Stretch der ganzen Figur (Kopf 2 px, Rumpf 1 px, Füße
             fest), Blinzeln, das Monokel blitzt.
* eingo:     Elegant Ingo: federt, blinzelt, das Monokel blitzt.
* madame:    Madame Guillotine hält eine Rede (Mund auf und zu), federt,
             blinzelt; von der roten Beilschneide bilden sich an mehreren
             Stellen Tropfen und fallen zu Boden, an den Blutfäden unter dem abgeschlagenen Kopf rinnt
             es hinab (Kopf und Lache liegen fest).
* marianne:  federt, blinzelt; die Mistgabel federt mit und liegt ganz vorn; sie
             streichelt die Katze
             (Hand und Katzenkopf gehen zusammen, der Arm biegt sich zwischen
             federndem Körper und Hand), die Katze schließt dabei die Augen und
             wedelt mit dem Schwanz.
* santa:     federt, über die Zuckerstange läuft ein Glanz.
* nicolas / edward / saintnic: federn; das Gelbe in den Flaschen ist ein Blitz:
             die Flaschen sind leer, darin zucken kleine Blitze; Fullmetal
             Nicolas blinzelt (die dunkelgelben Augen).
* stellan / bunny: atmen ruhig (1 px), ab und zu zuckt ein Ohr hoch (wird dabei
             länger, reißt nicht ab).
* tazune / bakugo: brüllen in der Loop-Mitte, nur per Mimik (der schon offene
             Mund unter den Augen reißt weiter auf, die Lider senken sich); aus den Ohren pufft kleinteilig
             Rauch (über allem, beim Brüllen mehr), die Dampfwolken des
             Kartenbilds stehen in Frame 0 und lösen sich in Fetzen auf. Bei
             Tazune lodern die Flammen: jede Flammensäule streckt und staucht
             sich, die Zungen wiegen, Fetzen reißen ab; beim Skin kein Feuer.
* zi:        Timeless King Zi schwebt langsam auf und ab, der Umhang wogt majestätisch
             (Welle von oben nach unten, der Saum kräuselt sich nach außen, hängt dem
             Schweben nach), rundherum funkeln viele Sterne (nie halb hinter der Figur).
* waflav:    brüllt einmal pro Loop: Anlauf (Kopf duckt sich, das Maul schließt sich), dann
             reißt der Oberkiefer drei Zeilen auf (dunkler Rachen), die Augen glühen; sonst atmet es.
* wahflav / ash / zetsu: federn, blinzeln; bei Kyli, the True Mastermind öffnen sich
             die Fliegenfallen-Blätter beim Atmen.
* xal / axal: atmen (1 px), der Umhang weht leicht nach außen, die Augen glühen.
* octo:      Octo-Alleria: die acht Tentakel bewegen sich einzeln (glattes, ganzzahliges
             Verschiebungsfeld je Arm mit eigener Phase, zur Spitze hin stärker), der Körper
             atmet, sie blinzelt.
* dreemurr:  Monster Prince Asriel federt, blinzelt; Blut rinnt die Messerklinge hinab und
             tropft vom Knauf zu Boden.
"""
import math
import os
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12, ring8
from flap_common import fill_pinholes, rotate_part, shear_flap

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
N = 48
OUT = os.environ.get('GW_OUT', '.')

V_ = {
    'asriel': dict(slug='asriel-the-sapling-sacrificer', knee=18, pads=(3, 3, 3, 2),
                   lid=[((7, 7), 'f6cd8b'), ((8, 7), 'f6cd8b'), ((11, 7), 'f6cd8b'), ((12, 7), 'f6cd8b')],
                   line=[(7, 8), (8, 8), (11, 8), (12, 8)]),
    'barker': dict(slug='barker-the-monster-tamer', knee=22,
                   blink={'halb': [((7, 10), 'f8bc77'), ((12, 10), 'f8bc77'),
                                   ((7, 11), '000000'), ((12, 11), '000000')],
                          'zu': [((7, 10), 'f8bc77'), ((12, 10), 'f8bc77'),
                                 ((6, 11), 'd5a464'), ((7, 11), 'd5a464'), ((8, 11), 'd5a464'),
                                 ((11, 11), 'd5a464'), ((12, 11), 'd5a464'), ((13, 11), 'd5a464'),
                                 ((7, 12), '000000'), ((8, 12), '000000'), ((11, 12), '000000'), ((12, 12), '000000')]}),
    'blackstache': dict(slug='blackstache-scourge-of-the-pixel-seas', part='body', crop=(0, 2, 47, 29), knee=20,
                        pads=(3, 11, 7, 2),
                        line=[(33, 10), (34, 10), (37, 10), (38, 10)]),
    'chuck': dict(slug='chuck-the-crazy-veteran', knee=18, pads=(3, 3, 5, 2), line=[(13, 6), (17, 6)]),
    'codumbus': dict(slug='codumbus-the-clueless-voyager', knee=21, pads=(3, 3, 5, 2)),
    'devlin': dict(slug='devlin-the-masked-butcher', knee=20),
    'mmdevlin': dict(slug='mass-murderer-devlin', knee=20),
    'enigma': dict(slug='enigma-the-seller-of-secrets', knee=15, pads=(6, 7, 5, 2)),
    'krates': dict(slug='krates-the-smartass', knee=23,
                   lid=[((7, 10), 'f6cd8b'), ((8, 10), 'f6cd8b'), ((11, 10), 'f6cd8b'), ((12, 10), 'f6cd8b')],
                   line=[(7, 11), (8, 11), (11, 11), (12, 11)]),
    'key': dict(slug='key-the-cursed-thief', knee=20,
                lid=[((5, 9), 'f6cd8b'), ((6, 9), 'f6cd8b'), ((9, 9), 'f6cd8b')],
                line=[(5, 10), (6, 10), (9, 10)]),
    'alleria': dict(slug='alleria-the-queen-of-spiders', pads=(3, 3, 3, 2),
                    lid=[((16, 9), 'f5ce88'), ((17, 9), 'f5ce88')], line=[(16, 10), (17, 10)]),
    'brackle': dict(slug='brackle-the-catapulting-turtle', knee=34, pads=(33, 12, 17, 2), anchor='sprite',
                    lid=[((2, 19), '8baf65'), ((3, 19), '8baf65'), ((6, 19), '8baf65')],
                    line=[(2, 20), (3, 20), (5, 20), (6, 20)]),
    'leonardo': dict(slug='mutated-teenager-brackle', knee=34, pads=(33, 12, 17, 2), anchor='sprite',
                     lid=[((2, 19), '114368'), ((3, 19), '114368'), ((5, 19), '114368'), ((6, 19), '114368')],
                     line=[(2, 20), (3, 20), (5, 20), (6, 20)]),
    'broghan': dict(slug='broghan-the-frozen-guardian-of-the-north', knee=25, pads=(14, 14, 5, 2)),
    'golem': dict(slug='broghan-the-ancient-golem', knee=28, pads=(14, 14, 5, 2)),
    'clown': dict(slug='cecilia-the-clown', knee=24, lid=[((16, 11), 'f6bd98'), ((17, 11), 'f6bd98')],
                  line=[(16, 12), (17, 12)]),
    'bbg': dict(slug='bad-birthday-girl-cecilia', knee=29, pads=(3, 3, 4, 2),
                lid=[((10, 16), 'f6cd8b')], line=[(9, 17), (10, 17)]),   # links: Augenklappe
    'fern': dict(slug='fern-the-ship-slave', pads=(3, 3, 3, 2)),
    'fernelf': dict(slug='fern-the-elf-slave', pads=(3, 3, 3, 2),
                    lid=[((8, 2), 'd98a79'), ((9, 2), 'd98a79'), ((12, 2), 'd98a79'), ((13, 2), 'd98a79')],
                    line=[(8, 3), (9, 3), (12, 3), (13, 3)]),
    'fairy': dict(slug='fern-the-liberated-fairy', pads=(3, 3, 4, 4)),
    'fiona': dict(slug='fiona-the-princess-of-blackport', pads=(3, 3, 4, 2),
                  lid=[((14, 14), 'ffe6d5'), ((15, 14), 'ffe6d5'), ((18, 14), 'ffe6d5'), ((19, 14), 'ffe6d5')],
                  line=[(14, 15), (15, 15), (18, 15), (19, 15)]),
    'boarding': dict(slug='gabby-the-boarding-broad', pads=(12, 6, 3, 2),
                     lid=[((12, 39), 'f6cd8b'), ((13, 39), 'f6cd8b')], line=[(12, 38), (13, 38)]),
    'chosen': dict(slug='gabby-the-chosen-girl', pads=(12, 6, 3, 2),
                   lid=[((11, 39), 'f1b7a2'), ((12, 39), 'f1b7a2')], line=[(11, 40), (12, 40)]),
    'zombie': dict(slug='gabby-the-pirate-zombie', knee=18,
                   lid=[((5, 7), 'b6c7b2'), ((6, 7), 'b6c7b2'), ((9, 7), 'b6c7b2'), ((10, 7), 'b6c7b2')],
                   line=[(5, 8), (6, 8), (9, 8), (10, 8)]),
    'moon': dict(slug='gabby-the-moonlight-warrior', knee=19,
                 lid=[((8, 7), 'b6c7b2'), ((9, 7), 'b6c7b2'), ((12, 7), 'b6c7b2'), ((13, 7), 'b6c7b2')],
                 line=[(8, 8), (9, 8), (12, 8), (13, 8)]),
    'garius': dict(slug='garius-the-great-reformer', knee=31, pads=(3, 3, 6, 3),
                   lid=[((12, 16), 'cc9658'), ((13, 16), 'cc9658'), ((16, 16), 'cc9658'), ((17, 16), 'cc9658')],
                   line=[(12, 17), (13, 17), (16, 17), (17, 17)]),
    'vader': dict(slug='dark-garius', knee=38, pads=(3, 3, 4, 2)),
    'gobbo': dict(slug='gobbo-chief-of-goblin', knee=17, pads=(3, 3, 4, 2),
                  blink={'halb': [((7, 3), '3d0a0c'), ((11, 3), '3d0a0c')],
                         'zu': [((6, 3), '000000'), ((7, 3), '000000'), ((10, 3), '000000'), ((11, 3), '000000')]}),
    'hatusbal': dict(slug='hatusbal-the-leader-of-tusca', knee=25, pads=(3, 4, 4, 2),
                     lid=[((9, 8), 'a19390'), ((10, 8), 'a19390'), ((13, 8), 'a19390'), ((14, 8), 'a19390')],
                     line=[(9, 9), (10, 9), (13, 9), (14, 9)]),
    'jack': dict(slug='ancient-hatusbal', knee=27, pads=(3, 4, 4, 2)),
    'hulijing': dict(slug='hulijing-the-foxdemon', knee=29, pads=(8, 3, 4, 2),
                     lid=[((31, 16), 'ffe6d5'), ((34, 16), 'ffe6d5'), ((35, 16), 'ffe6d5')],
                     line=[(30, 17), (31, 17), (34, 17), (35, 17)]),
    'ingo': dict(slug='ingo-investor-of-evil'),
    'eingo': dict(slug='elegant-ingo', knee=22, line=[(7, 7), (8, 7), (11, 7), (12, 7)]),
    'madame': dict(slug='madame-guillotine-the-great-equalizer', knee=27, pads=(3, 3, 4, 2),
                   lid=[((20, 11), 'f6bd98'), ((21, 11), 'f6bd98'), ((24, 11), 'f6bd98'), ((25, 11), 'f6bd98')],
                   line=[(20, 12), (21, 12), (24, 12), (25, 12)]),
    'marianne': dict(slug='marianne-the-cocky-caretaker', knee=21,
                     lid=[((8, 11), 'efb075'), ((9, 11), 'efb075'), ((12, 11), 'efb075'), ((13, 11), 'efb075')],
                     line=[(8, 12), (9, 12), (12, 12), (13, 12)]),
    'santa': dict(slug='santa-klaus', knee=25),
    'nicolas': dict(slug='nicolas-the-hidden-alchemist', knee=22),
    'edward': dict(slug='fullmetal-nicolas', knee=21,
                   blink={'halb': [((10, 9), '563300'), ((14, 9), '563300')],
                          'zu': [((10, 9), '000000'), ((14, 9), '000000')]}),
    'saintnic': dict(slug='saint-nicolas', knee=27),
    'stellan': dict(slug='stellan-the-calm-cat', knee=22),
    'bunny': dict(slug='stellan-the-calm-easter-bunny', knee=23),
    'tazune': dict(slug='tazune-the-angry-hot-blood', knee=30, pads=(12, 12, 12, 2)),
    'bakugo': dict(slug='explosive-tazune', knee=30, pads=(12, 12, 12, 2)),
    'kyli': dict(slug='kyli-the-deceptive-sapling', knee=28, pads=(3, 3, 5, 2),
                 blink={'halb': [((9, 16), '636363'), ((10, 16), '636363'), ((13, 16), '636363'), ((14, 16), '636363')],
                        'zu': [((9, 16), '636363'), ((10, 16), '636363'), ((13, 16), '636363'), ((14, 16), '636363'),
                               ((9, 17), '000000'), ((10, 17), '000000'), ((13, 17), '000000'), ((14, 17), '000000')]}),
    'zi': dict(slug='timeless-king-zi', pads=(7, 7, 7, 6)),
    'waflav': dict(slug='waflav-the-metamorphing-monstrosity', pads=(3, 3, 5, 2)),
    'wahflav': dict(slug='wahflav-the-uninvited-fighter', knee=27,
                    blink={'halb': [((8, 9), 'bd8339'), ((13, 9), 'bd8339')],
                           'zu': [((8, 9), 'bd8339'), ((13, 9), 'bd8339'), ((8, 10), '000000'), ((9, 10), '000000'),
                                  ((12, 10), '000000'), ((13, 10), '000000')]}),
    'ash': dict(slug='barker-the-monster-trainer', knee=20,
                blink={'halb': [((7, 11), '6b4a2a'), ((10, 11), '6b4a2a')],
                       'zu': [((7, 11), 'd5a464'), ((10, 11), 'd5a464'), ((7, 12), '000000'), ((10, 12), '000000')]}),
    'zetsu': dict(slug='kyli-the-true-mastermind', knee=24,
                  blink={'halb': [((5, 12), '7d7149'), ((9, 12), '7d7149')],
                         'zu': [((4, 12), '000000'), ((5, 12), '000000'), ((8, 12), '000000'), ((9, 12), '000000')]}),
    'xal': dict(slug='xal-the-animated-armor', knee=27, pads=(4, 4, 3, 2)),
    'axal': dict(slug='alchemic-xal', knee=28, pads=(4, 4, 3, 2)),
    'octo': dict(slug='alleria-the-octo-princess', pads=(4, 4, 3, 4),
                 blink={'halb': [((14, 9), '000200'), ((15, 9), '000200')],
                        'zu': [((14, 8), 'f8bc77'), ((15, 8), 'f8bc77'), ((14, 9), '000000'), ((15, 9), '000000')]}),
    'dreemurr': dict(slug='monster-prince-asriel', knee=20,
                     blink={'halb': [((7, 8), 'f6eeff'), ((8, 8), 'f6eeff'), ((11, 8), 'f6eeff'), ((12, 8), 'f6eeff')],
                            'zu': [((7, 8), 'f6eeff'), ((8, 8), 'f6eeff'), ((11, 8), 'f6eeff'), ((12, 8), 'f6eeff'),
                                   ((7, 9), '000000'), ((8, 9), '000000'), ((11, 9), '000000'), ((12, 9), '000000')]}),
}
V = next((v for v in sys.argv[2:] if v in V_), 'asriel')
C = V_[V]
SLUG = C['slug']


def load(part=None, slug=None):
    n = f'src/{slug or SLUG}-{part}.png' if part else f'src/{slug or SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
if 'crop' in C:
    _cx0, _cy0, _cx1, _cy1 = C['crop']
    SRC = SRC[_cy0:_cy1, _cx0:_cx1]
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def blink(s, i):
    """Lider (Hautfarbe) und geschlossenes Auge (schwarzer Strich) nach BLINK;
    oder je Zustand eigene Pixelliste (C['blink'])."""
    st = BLINK.get(i)
    if not st:
        return
    if 'blink' in C:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)
        return
    for (x, y), c in C.get('lid', []):
        s[y, x] = rgb(c)
    if st == 'zu' or 'lid' not in C:
        for x, y in C.get('line', []):
            s[y, x] = BLACK


def put(out, s, ox, oy, dy_fn=None, dx_fn=None):
    """s in out malen; dy_fn/dx_fn(x, y) = zusätzliche Verschiebung je Pixel."""
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy = y + oy + (dy_fn(x, y) if dy_fn else 0)
        xx = x + ox + (dx_fn(x, y) if dx_fn else 0)
        if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
            out[yy, xx] = s[y, x]


def knee_put(out, s, b, knee=None, ox=PL, oy=PT, moves=None, dx_fn=None):
    """Federn: Zeilen über dem Knie um b verschoben, die Beine bleiben stehen;
    beim Strecken (b < 0) wird die Zeile über dem Knie gedehnt.
    moves(x, y): Pixel, die unabhängig von der Zeile mitfedern."""
    knee = KNEE if knee is None else knee
    up = lambda x, y: y < knee or (moves is not None and moves(x, y))
    put(out, s, ox, oy, dy_fn=lambda x, y: b if up(x, y) else 0, dx_fn=dx_fn)
    if b < 0:
        y = knee - 1
        for x in range(s.shape[1]):
            if s[y, x, 3] and s[knee, x, 3] and not out[y + oy, x + ox, 3]:
                dx = dx_fn(x, y) if dx_fn else 0
                out[y + oy, x + ox + dx] = s[y, x]


def sweep(mask, i, start, speed=1.5, width=1.5):
    """Lichtreflex, der schräg über die Pixel von mask läuft (einmal pro Loop)."""
    t = (i - start) % N
    pos = t * speed - 4
    hit = {}
    for y, x in zip(*np.nonzero(mask)):
        d = abs((x + y * 0.6) - pos)
        if d < width:
            hit[(x, y)] = 0.8 if d < width / 2 else 0.4
    return hit


def draw_px(out, pix, only_empty=True):
    for (x, y), c in pix.items():
        assert 0 < x < out.shape[1] - 1 and 0 < y < out.shape[0] - 1, f'Partikel am Rand: {(x, y)}'
        if not only_empty or not out[y, x, 3]:
            out[y, x] = c


def stars(out, i, sparkles, t0='fff6ac', t1='ffffff', only_empty=False):
    """Glitzersterne [(x, y, Startframe)] in Ausgabe-Koordinaten; mit
    only_empty wird ein Stern, der die Figur berühren würde, ganz weggelassen."""
    for st in sparkles:
        pix = sparkle_pixels(i, N, [st], rgb(t0), rgb(t1))
        if only_empty and any(out[y, x, 3] for x, y in pix):
            continue
        draw_px(out, pix, only_empty=False)


def talk_track(units, seed):
    """Sprechspur über 48 Frames: Silben (offen/weit) mit kurzen Pausen."""
    rng = np.random.default_rng(seed)
    tr = []
    while len(tr) < N:
        u = units[rng.integers(len(units))]
        tr += list(u)
    return tr[:N]


# --- Bluttropfen ---------------------------------------------------------------
BLOOD = (rgb('5c0000'), rgb('9a0000'), rgb('d42a2a'))       # dunkel, mittel, Glanz


def drop_pixels(t, x, y, ground, cols=BLOOD):
    """Ein Tropfen, der bei (x, y) unter einer Spitze hängt: t = 0..3 bildet
    er sich, dann löst er sich und fällt beschleunigt; am Boden (Zeile
    ground) zerplatzt er zwei Frames lang. Liefert {(x, y): Farbe}."""
    dk, md, hl = cols
    if t < 0:
        return {}
    if t < 2:
        return {(x, y): md}
    if t < 4:
        return {(x, y): md, (x, y + 1): hl}
    k = t - 4
    yd = y + 2 + (k * (k + 1)) // 2
    if yd < ground:
        return {(x, yd - 1): dk, (x, yd): md} if k else {(x, yd - 1): md, (x, yd): hl}
    k_hit = next(k2 for k2 in range(40) if y + 2 + (k2 * (k2 + 1)) // 2 >= ground)
    if k - k_hit == 0:
        return {(x, ground): md, (x - 1, ground): dk, (x + 1, ground): dk}
    if k - k_hit == 1:
        return {(x - 1, ground): dk, (x + 1, ground): dk}
    return {}


# --- Varianten ----------------------------------------------------------------
def f_asriel(i):
    s = SRC.copy()
    laugh = 16 <= i < 40
    if not laugh:
        blink(s, i)
    b = BOUNCE12[i % 12]
    if laugh:                                            # „HA – HA – HA“: 4 Frames je Lacher
        k = (i - 16) % 4
        mouth = ['hoch', 'hoch', 'weit', 'halb'][k] if (i - 16) // 4 % 2 == 0 else ['weit', 'weit', 'hoch', 'halb'][k]
        if i in (16, 39):
            mouth = 'halb'
        b = -1 if k < 2 else 0
        if mouth == 'weit':                              # Zähne über dunklem Rachen
            s[9, 9] = s[9, 10] = rgb('f6f6f6')
            s[10, 9] = s[10, 10] = rgb('5b0300')
        elif mouth == 'hoch':                            # 2 px hoch aufgerissen
            s[9, 9] = s[9, 10] = rgb('3a0000')
            s[10, 9] = s[10, 10] = rgb('8a1414')
        else:
            s[10, 9] = s[10, 10] = rgb('5b0300')
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Blut: rinnt links an der Klinge herab (Spalte 1, Zeile 10 → 13), dann unter der Faust
    # verborgen, bildet sich am Knauf (1, 18) als Tropfen und fällt auf den Boden (Zeile 24)
    for t0 in (2, 26):
        t = (i - t0) % N
        if t < 8:
            y = 10 + t // 2
            out[y + PT + b, 1 + PL] = BLOOD[1] if t % 2 else BLOOD[2]
        elif 11 <= t < 30:
            draw_px(out, drop_pixels(t - 11, 1 + PL, 18 + PT + (b if t < 15 else 0), 24 + PT))
    return out


BARKER_MARK = None


def f_barker(i):
    global BARKER_MARK
    if BARKER_MARK is None:
        BARKER_MARK = load('mark')[:, :, 3] > 0
    s = SRC.copy()
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(BARKER_MARK)):
        c = s[y, x]
        s[y, x] = [min(255, int(c[0] + 50 * f)), int(c[1] + 14 * f), int(c[2] + 14 * f), c[3]]
    blink(s, i)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12], moves=lambda x, y: (x <= 4 and y < 26) or (x >= 13 and y <= 24))   # Peitsche links, Armband + Hand rechts: hängen am Arm
    fill_pinholes(out)
    return out


BS_PIVOT = (24.0, 12.5)                                  # Faust am Säbelgriff
FUSES = None


def f_blackstache(i):
    global FUSES
    s = SRC.copy()
    if FUSES is None:                                    # Lunten (Ebene #229) in Körper-Koordinaten
        fu = load('fuses')
        cx, cy = C['crop'][:2]
        line, spark = [], []
        for y, x in zip(*np.nonzero(fu[:, :, 3])):
            (line if hexc(fu[y, x]) == '000000' else spark).append((x - cx, y - cy, fu[y, x].copy()))
        m = np.zeros(fu.shape[:2], np.uint8)
        for x, y, _ in spark:
            m[y + cy, x + cx] = 1
        n, lab = cv2.connectedComponents(m, connectivity=8)
        tips = []                                        # je Funkenbüschel: Mitte = weißer Kern
        for k in range(1, n):
            pts = [(x, y, c) for x, y, c in spark if lab[y + cy, x + cx] == k]
            core = [(x, y) for x, y, c in pts if hexc(c) == 'ffffff'] or [(x, y) for x, y, _ in pts]
            tips.append((core[0], pts))
        FUSES = (line, tips)
    line, tips = FUSES
    blink(s, i)
    ghost = (s[:, :, 3] > 0) & (s[:, :, 3] < 255)
    f = math.sin(2 * math.pi * 3 * i / N)
    s[ghost, 3] = np.clip(s[ghost, 3] + int(round(22 * f)), 0, 255)
    sword_m = (s[:, :, 3] > 0) & (_xs <= 24)
    blade = sword_m & (s[:, :, 3] == 255) & (_ys <= 17) & (np.abs(s[:, :, 0] - s[:, :, 2]) < 30) \
        & (s[:, :, 0] > 0x50) & (_xs <= 19)
    for (x, y), a in sweep(blade, i, 6, speed=1.2).items():
        s[y, x] = lighten(s[y, x], a)
    b = BOUNCE12[i % 12]
    k_tilt = 0.06 * math.sin(2 * math.pi * 2 * i / N)     # Spitze ± ~1,5 px
    tilt = lambda x: int(round(k_tilt * (BS_PIVOT[0] - x)))   # spaltenweise Scherung, nichts neu gerastert
    out = np.zeros((H, W, 4), int)
    sword = s.copy()
    sword[~sword_m] = 0
    put(out, sword, PL, PT + b, dy_fn=lambda x, y: -tilt(x))
    body = s.copy()
    body[sword_m] = 0
    knee_put(out, body, b)
    fill_pinholes(out)
    # Lunten federn mit; die Funken an ihren Enden sprühen (Frame 0 = Bild)
    fuse_px = set()
    for x, y, c in line:
        out[y + PT + b, x + PL] = c
        fuse_px.add((x, y))
    Y_, W_, O_ = rgb('ffff00'), rgb('ffffff'), rgb('ff9a1f')
    for k, ((cx, cy), pts) in enumerate(tips):
        if i == 0:
            for x, y, c in pts:
                out[y + PT + b, x + PL] = c
            continue
        rng = np.random.default_rng(1000 * k + i)
        pix = {(cx, cy): W_ if rng.random() < 0.6 else Y_}
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            r = rng.random()
            if r < 0.45:
                pix[(cx + dx, cy + dy)] = Y_ if r < 0.3 else O_
        if rng.random() < 0.5:                           # einzelner Funke fliegt weg
            dx, dy = [(2, -1), (-2, -1), (1, -2), (-1, -2), (2, 0), (-2, 0)][rng.integers(6)]
            pix[(cx + dx, cy + dy)] = W_ if rng.random() < 0.5 else Y_
        for (x, y), c in pix.items():
            if (x, y) in fuse_px:
                continue
            out[y + PT + b, x + PL] = c
    # Funkeln auf der Klinge (Punkte drehen mit)
    sp = [(x + PL, y - tilt(x) + PT + b, t0) for (x, y), t0 in (((4, 10), 4), ((11, 11), 20), ((16, 12), 34))]
    stars(out, i, sp, 'e8f4ff', 'ffffff')
    return out


FOAM = None
CHUCK_TALK = talk_track(['oo', 'ooc', 'ww', 'wwo', 'oc', 'c', 'owc'], 7)


def f_chuck(i):
    global FOAM
    s = SRC.copy()
    if FOAM is None:
        m = (s[:, :, 3] > 0) & (_xs <= 7) & (_ys >= 5) & (_ys <= 13)
        m &= np.array([[lum(s[y, x]) > 200 for x in range(SW)] for y in range(SH)])
        cols = sorted({hexc(s[y, x]) for y, x in zip(*np.nonzero(m))}, key=lambda h: lum(rgb(h)))
        rank = {h: k / (len(cols) - 1) for k, h in enumerate(cols)}
        tops = {x: int(np.nonzero(m[:, x])[0].min()) for x in range(SW) if m[:, x].any()}
        FOAM = (m, cols, rank, tops)
    m, cols, rank, tops = FOAM
    blink(s, i)
    # Reden: c = zu (Schnauzbart schließt), o = offen (Original), w = weit (Zunge)
    st = CHUCK_TALK[i] if i else 'o'
    if st == 'c':
        s[10, 15] = s[10, 16] = rgb('d5d5d5')
        s[11, 15] = s[11, 16] = rgb('330000')
    elif st == 'w':
        s[11, 15] = s[11, 16] = rgb('b01818')
    # Schaum brodelt: jede Blase wogt mit eigener Phase heller/dunkler
    w = 2 * math.pi * i / N
    for y, x in zip(*np.nonzero(m)):
        ph = (x * 1.7 + y * 2.9) % 6.283
        r = rank[hexc(s[y, x])] + 0.4 * (math.sin(3 * w + ph) - math.sin(ph))
        s[y, x] = rgb(cols[int(round(min(1.0, max(0.0, r)) * (len(cols) - 1)))])
    for x, ty in tops.items():                           # Oberkante wölbt sich
        ph = x * 2.1
        g = math.sin(4 * w + ph) - math.sin(ph)
        if g > 0.9 and ty - 1 >= 0 and not s[ty - 1, x, 3]:
            s[ty - 1, x] = rgb(cols[-1])
        elif g < -1.2 and ty + 1 < SH and m[ty + 1, x]:
            s[ty, x] = 0
    beer = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in ('ce9a10', 'dea610', 'b58a00', 'c69608'):
            beer[y, x] = True
    for x0, t0 in ((3, 0), (5, 9), (4, 20), (3, 31), (5, 40)):   # Bläschen steigen im Bier auf
        t = (i - t0) % N
        y = 17 - t // 2
        if t < 10 and beer[y, x0]:
            s[y, x0] = rgb('ffe89a')
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Schaumflocken spritzen auf (starten 2 px über der Krone, berühren sie nie)
    xs = sorted(tops)
    for k, t0 in enumerate(range(1, 45, 5)):
        x = xs[(k * 3) % len(xs)]
        t = (i - t0) % N
        if t < 4:
            y = tops[x] - 3 - t + PT + b
            xx = x + (1 if k % 2 else -1) * (t // 2) + PL
            if 0 < xx < W - 1 and not out[y, xx, 3] and not out[y + 1, xx, 3]:
                out[y, xx] = rgb('fffbe8') if t < 2 else rgb('f7ebc6')
    return out


GLOBE = None
SWEAT = ['a4ffff', '41ffff', '00e6e6']                   # die zwei türkisen Tropfen (oben hell)
SWEAT_AT = [(10, 1), (5, 5)]


def f_codumbus(i):
    global GLOBE
    s = SRC.copy()
    for x, y in SWEAT_AT:                                # Tropfen weg, darunter Globus (rechter Nachbar)
        for k in range(3):
            s[y + k, x] = s[y + k, x + 1]
    # Land ↔ Meer je Helligkeitsrolle; die Randpixel stehen fest
    to_sea = {'92d14f': '0071c1', '6d9d3b': '005591', '53772d': '005591', '3e5921': '005591',
              'acdc7a': '3f94d0', '7d9860': '3f6683'}
    to_land = {'0071c1': '92d14f', '005591': '6d9d3b', '3f94d0': 'acdc7a', '3f6683': '7d9860'}
    if GLOBE is None:
        runs = []
        gm = np.zeros((SH, SW), bool)
        for y in range(0, 10):
            xs = [x for x in range(4, SW) if s[y, x, 3] and hexc(s[y, x]) in list(to_sea) + list(to_land)]
            if len(xs) < 4:
                continue
            gm[y, xs[0]:xs[-1] + 1] = True
            xs = list(range(xs[0] + 1, xs[-1]))
            hs = [hexc(s[y, x]) for x in xs]
            runs.append((y, xs, hs))
        GLOBE = (runs, gm)
    runs, gm = GLOBE
    for y, xs, hs in runs:
        n = len(xs)
        sh = int(round(i * n / N))
        for j, h in enumerate(hs):
            if h not in to_sea and h not in to_land:
                continue
            hsrc = hs[(j - sh) % n]
            land_src = hsrc in to_sea or (hsrc not in to_land and h in to_sea)
            if land_src and h in to_land:
                s[y, xs[j]] = rgb(to_land[h])
            elif not land_src and h in to_sea:
                s[y, xs[j]] = rgb(to_sea[h])
    # Schweißtropfen rinnen über den Globus herab und tauchen oben wieder auf (2 Runden pro Loop)
    for x, y0 in SWEAT_AT:
        top = int(np.nonzero(gm[:, x])[0].min())
        bot = int(np.nonzero(gm[:, x])[0].max())
        ymin = top - 2
        L = bot - ymin + 1
        yt = ymin + ((y0 - ymin) + (i * L * 2) // N) % L
        for k, c in enumerate(SWEAT):
            if 0 <= yt + k < SH and gm[yt + k, x]:
                s[yt + k, x] = rgb(c)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    return out


def f_devlin(i):
    s = SRC.copy()
    sweat = [(y, x) for y, x in zip(*np.nonzero(s[:, :, 3])) if hexc(s[y, x]) in ('8bffff', 'beffff') and y < 8]
    for y, x in sweat:                                   # Stirn darunter freilegen (Farbe vom linken Nachbarn)
        s[y, x] = s[y, x - 1]
    sx, sy = sweat[0][1], min(y for y, _ in sweat)
    b = BOUNCE12[i % 12]
    # Schweißtropfen: bildet sich an der Stirn, rinnt die Wange herab, zweimal pro Loop
    t = i % 24
    if t < 4:
        drop = [(sy + (1 if t < 2 else 0), 'beffff')] + ([(sy + 1, '8bffff')] if t >= 2 else [])
    else:
        yy = sy + (t - 4) // 3
        drop = [(yy, 'beffff'), (yy + 1, '8bffff')] if yy + 1 <= 8 else []
    for y, c in drop:
        s[y, sx] = rgb(c)
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Blut-Tropfen unter den Krallenspitzen, zeitversetzt
    for (x, y), t0 in (((1, 20), 3), ((16, 20), 15), ((0, 19), 27), ((17, 19), 38)):
        t = (i - t0) % N
        # hängend federt der Tropfen mit der Kralle, fallend nicht mehr
        draw_px(out, drop_pixels(t, x + PL, y + PT + (b if t < 4 else 0), 22 + PT))
    return out


ENIGMA_TALK = talk_track(['oo', 'oc', 'ww', 'wo', 'occ', 'c'], 11)
ARM_PIVOT = (6.0, 12.5)


B8 = [0, -1, -1, -1, 0, 1, 1, 1]


def f_enigma(i):
    s = SRC.copy()
    for x, y in ((8, 6), (8, 7), (6, 8), (7, 8), (9, 8), (10, 8), (8, 9), (8, 10)):   # Glitzern kommt eigenständig
        s[y, x] = rgb('1a0c12')
    st = ENIGMA_TALK[i] if i else 'o'                    # Mund: roter Strich, darunter Rachen
    if st == 'c':
        s[12, 9] = s[12, 10] = rgb('0a0a0a')
    elif st == 'w':
        s[12, 9] = s[12, 10] = rgb('5b0000')
        s[13, 9] = s[13, 10] = rgb('300000')
    arm_m = (s[:, :, 3] > 0) & (_xs <= 5) & (_ys >= 11) & (_ys <= 14)
    w = 2 * math.pi * i / N
    b = B8[i % 8]                                        # schnelles Wippen: 1-px-Hub an der Naht
    k_arm = 0.32 * math.sin(3 * w)                       # Arm schwingt beim Erzählen (spaltenweise Scherung)
    arm_dy = lambda x, y: b - int(round(k_arm * (ARM_PIVOT[0] - x))) if arm_m[y, x] else b if y < KNEE else 0
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=arm_dy)
    if b < 0:                                            # Naht dehnen
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    # Glitzern vor dem Gesicht wandert senkrecht mit ihr mit (Frame 0 = volles Kreuz wie im Bild)
    fy = 8 + PT + b
    stars(out, i, [(8 + PL, fy, 46), (8 + PL, fy, 22)], 'e8e8ff', 'ffffff')
    stars(out, i, [(PL - 3, 5 + PT, 8), (SW + 2 + PL, 4 + PT, 30), (SW + 2 + PL, 16 + PT, 14),
                   (PL - 3, 18 + PT, 36), (PL + 17, PT - 2, 40)], 'e8e8ff', 'ffffff', only_empty=True)
    return out


YOYO = None


def f_krates(i):
    global YOYO
    s = SRC.copy()
    if YOYO is None:
        yo = np.zeros((5, 5, 4), int)
        blk = s[25:29, 0:5].copy()
        keep = np.array([[blk[y, x, 3] > 0 and hexc(blk[y, x]) in
                          ('ad0000', 'c54c4c', 'ffc54c', '790000', 'ffad00', 'b37900') for x in range(5)]
                         for y in range(4)])
        blk[~keep] = 0
        yo[:4] = blk
        YOYO = (yo, keep)
    yo0, keep = YOYO
    blk = s[25:29, 0:5]
    blk[keep] = 0
    s[21:25, 2] = 0                                      # Faden (wird neu gezogen)
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    t = i % 24                                           # zwei Würfe pro Loop
    d = -int(round(4 * math.sin(math.pi * t / 24) ** 0.7))
    yo = np.rot90(yo0, k=(i // 2) % 4) if i % 24 else yo0
    top = 25 + d
    for y in range(21 + b, top):                         # Faden von der Hand bis zum Jo-Jo
        out[y + PT, 2 + PL] = rgb('cccccc') if (y - b) % 2 else rgb('ffffff')
    for y in range(5):
        for x in range(5):
            if yo[y, x, 3]:
                out[top + y + PT, x + PL] = yo[y, x]
    return out


KEY_STRAYS = [((9, 0), (8, 1), []), ((3, 2), (4, 3), [(2, 2)]), ((13, 3), (12, 4), []),
              ((0, 8), (1, 7), []), ((15, 11), (14, 10), [])]   # (Strähne, Wurzel, angehängte Pixel)
RING = [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]


def f_key(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    # abstehende Strähnen wehen: sie wandern um ihre Haarwurzel herum (bleiben immer mindestens
    # diagonal mit ihr verbunden), angehängte Pixel folgen mit demselben Abstand
    moved = {}
    base = s.copy()
    for (p, r, chain), ph in zip(KEY_STRAYS, (0.0, 1.3, 2.6, 4.0, 5.1)):
        for q in [p] + chain:
            base[q[1], q[0]] = 0
    for (p, r, chain), ph in zip(KEY_STRAYS, (0.0, 1.3, 2.6, 4.0, 5.1)):
        step = int(round(0.8 * (math.sin(w + ph) - math.sin(ph))))
        k = RING.index((p[0] - r[0], p[1] - r[1]))
        np_ = p
        for st in ([step, 0] if step else [0]):
            d = RING[(k + st) % 8]
            cand = (r[0] + d[0], r[1] + d[1])
            if 0 <= cand[0] < SW and 0 <= cand[1] < SH and not base[cand[1], cand[0], 3]:
                np_ = cand
                break
        off = (np_[0] - p[0], np_[1] - p[1])
        for q in [p] + chain:
            moved[(q[0] + off[0], q[1] + off[1])] = s[q[1], q[0]].copy()
    for (x, y), c in moved.items():
        if 0 <= x < SW and 0 <= y < SH:
            base[y, x] = c
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, base, b)
    fill_pinholes(out)
    stars(out, i, [(1 + PL, 19 + PT + b, 10), (14 + PL, 19 + PT + b, 22),
                   (2 + PL, 19 + PT + b, 34), (13 + PL, 19 + PT + b, 46)], 'ffe300', 'fff6ac')
    return out


B24 = [0, 0, 0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]


def f_kyli(i):
    s = SRC.copy()
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        c = s[y, x]
        if c[0] > 0x80 and c[1] < 0x20 and c[2] < 0x20:             # rote Augen glühen
            s[y, x] = [min(255, int(c[0] + 60 * f)), int(90 * f), int(90 * f), 255]
    blink(s, i)
    w = 2 * math.pi * 2 * i / N

    def dx(x, y):
        if y < 15:                                       # gleiche Phase: der dünne Stamm reißt nicht
            return int(round(1.6 * ((15 - y) / 15) ** 1.5 * math.sin(w)))
        return 0

    def dy(x, y):
        if y < 15 and (x <= 4 or x >= 17):
            d = (4.5 - x) / 4.5 if x <= 4 else (x - 16.5) / 7
            return int(round(1.0 * d * math.sin(w + (0 if x <= 4 else math.pi))))
        return 0
    # Squash-and-Stretch als 1-px-Hub an der Naht über den Beinen (nichts wird neu gerastert)
    hb = B24[(i + 20) % 24] - B24[20]
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=lambda x, y: dy(x, y) + (hb if y < KNEE else 0), dx_fn=dx)
    if hb < 0:
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    return out


# Beine links (von außen oben nach innen unten) als Linienzüge ab der Wurzel; rechts gespiegelt
LEGS_L = [[(12, 10), (8, 9.5), (5, 11), (3, 13), (1, 15), (0, 19)],
          [(12, 13.5), (8, 14), (6, 16), (4, 19), (3, 22)],
          [(12, 16), (9, 18), (7, 21), (5, 24), (5, 27)],
          [(13, 20.5), (11, 23), (10, 26), (9, 29)]]
LEG_SEG = None


def leg_pos(px, py, L):
    """(Abstand, Anteil t entlang des Linienzugs: 0 = Wurzel, 1 = Spitze) des nächsten Punkts."""
    segs = list(zip(L, L[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    tot, acc, best = sum(lens), 0.0, (1e9, 0.0)
    for (a, b), ln in zip(segs, lens):
        dx, dy = b[0] - a[0], b[1] - a[1]
        u = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / (ln * ln)))
        d = math.hypot(px - a[0] - u * dx, py - a[1] - u * dy)
        if d < best[0]:
            best = (d, (acc + u * ln) / tot)
        acc += ln
    return best


def close_gaps(part, mask):
    """Einzelne Lücken im Bein (oben und unten Beinpixel) mit der Farbe darüber schließen."""
    op = part[:, :, 3] > 0
    for y in range(1, part.shape[0] - 1):
        for x in range(part.shape[1]):
            if not op[y, x] and op[y - 1, x] and op[y + 1, x] and mask[y - 1, x] and mask[y + 1, x]:
                part[y, x] = part[y - 1, x]


def f_alleria(i):
    global LEG_SEG
    s = SRC.copy()
    legs = LEGS_L + [[(SW - 1 - x, y) for x, y in L] for L in LEGS_L]
    if LEG_SEG is None:                                  # jedes Beinpixel: nächster Linienzug + Anteil t
        lab = np.full((SH, SW), -1)
        tt = np.zeros((SH, SW))
        for y, x in zip(*np.nonzero(s[:, :, 3])):
            if y >= 9 and (x <= 12 or x >= SW - 13):
                best = min((leg_pos(x, y, L) + (k,) for k, L in enumerate(legs)))
                lab[y, x], tt[y, x] = best[2], best[1]
        LEG_SEG = (lab, tt)
    lab, tt = LEG_SEG
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)    # Spinnenaugen glühen
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if y >= 19 and hexc(s[y, x]) in ('ff0200', 'ad0100'):
            c = s[y, x]
            s[y, x] = [255, int(c[1] + 110 * f), int(c[2] + 90 * f), 255]
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    # Nur ganzzahlige Verschiebungen (nichts wird neu gerastert, die Pixel bleiben scharf):
    # b = Squash/Stretch – der Körper hebt/senkt sich um 1 px, die Beinspitzen bleiben stehen;
    # jedes Bein hebt/senkt dazu seine Spitze einzeln (Gangbild über Kreuz, eigene Phasen)
    b = B24[i % 24]
    phases = [0.0, 3.3, 0.4, 3.0, 3.1, 0.2, 2.9, 0.5]
    legl = np.zeros((H, W, 4), int)
    legm = np.zeros((H, W), bool)
    for k in range(8):
        lift = max(0.0, 1.6 * (math.sin(w + phases[k]) - math.sin(phases[k])))   # nur anheben, nie unter den Boden
        for y, x in zip(*np.nonzero(lab == k)):
            t = tt[y, x]
            dy = int(round(b * (1 - t) - lift * t))
            legl[y + PT + dy, x + PL] = s[y, x]
            legm[y + PT + dy, x + PL] = True
    close_gaps(legl, legm)
    body = s.copy()
    body[lab >= 0] = 0
    head = body.copy()                                   # Spinnenkopf (ab Zeile 19) wippt eigenständig
    head[:19] = 0
    body[19:] = 0
    hd = int(round(0.8 * (math.sin(w + 1.2) - math.sin(1.2))))
    out = np.zeros((H, W, 4), int)
    m = legl[:, :, 3] > 0
    out[m] = legl[m]
    put(out, head, PL, PT + b + hd)
    if hd > 0:                                           # Lücke unter den Händen: oberste Kopfzeile dehnen
        for x in range(SW):
            if head[19, x, 3]:
                out[19 + PT + b, x + PL] = head[19, x]
    put(out, body, PL, PT + b)
    fill_pinholes(out)
    return out


# --- Etappe 2 -------------------------------------------------------------------
CAT_PIVOT = (22.0, 16.5)                                 # Nabe des Katapultarms
CAT_CUP = (32.5, 3.0)                                    # Mitte der Schale in Ruhe
# Armwinkel (im Uhrzeigersinn positiv): Ruhe, Spannen nach hinten, Abschuss nach vorn-oben, Nachfedern
CAT_ANG = [0.0] * 4 + [0.6 * (0.5 - 0.5 * math.cos(math.pi * k / 9)) for k in range(1, 11)] + \
          [0.1, -0.5, -0.85, -0.6, -0.3, -0.05, 0.1, 0.08, 0.03, 0.0] + [0.0] * 24
CAT_LOAD, CAT_FIRE = 6, 16                               # Schädel liegt ab 6 in der Schale, fliegt ab 16
SKULL = None
EXPL = None


def rot_pt(p, piv, a):
    dx, dy = p[0] - piv[0], p[1] - piv[1]
    return (piv[0] + dx * math.cos(a) - dy * math.sin(a), piv[1] + dx * math.sin(a) + dy * math.cos(a))


def skull_flight():
    """Flugbahn des Schädels ab dem Abschuss: [(Frame, Mitte x, Mitte y)] bis zum Aufschlag."""
    sx, sy = rot_pt(CAT_CUP, CAT_PIVOT, CAT_ANG[CAT_FIRE])
    hh = SKULL.shape[0] / 2
    ground = SH - 1
    vx, vy, g = -4.4, -3.2, 1.9
    path, t = [], 0
    while True:
        x, y = sx + vx * t, sy + vy * t + 0.5 * g * t * t
        if y + hh >= ground:
            return path, (int(round(x)), ground)
        path.append((CAT_FIRE + t, x, y))
        t += 1


def explosion_px(t, cx, gy):
    """Explosion am Boden (Frame t = 0.. 11): Blitz, wachsende Feuerkuppel (weiß, gelb,
    orange, rot, unregelmäßiger Rand), Knochensplitter fliegen weg, danach steigen
    Rauchballen auf und zerfasern. Nur über dem Boden."""
    rng = np.random.default_rng(7)
    edge = rng.uniform(0.84, 1.16, 24)                   # feste Randzacken je Richtung
    layers = {0: [(2.5, 'ffffff'), (4.5, 'fff45c'), (5.5, 'ffa22a')],
              1: [(3.5, 'ffffff'), (6.0, 'fff45c'), (8.0, 'ffa22a'), (9.0, 'd8321a')],
              2: [(3.5, 'ffffff'), (6.5, 'fff45c'), (9.0, 'ff8a1c'), (10.5, 'd8321a')],
              3: [(5.0, 'fff45c'), (8.0, 'ff8a1c'), (10.0, 'd8321a'), (11.0, '4e4644')],
              4: [(3.5, 'ffa22a'), (7.0, 'd8321a'), (10.0, '4e4644')],
              5: [(3.0, 'b04020'), (8.0, '5e5654')]}
    pix = {}
    cy = gy - 1
    if t in layers:
        rmax = layers[t][-1][0] * 1.2
        for y in range(int(cy - rmax) - 1, gy + 1):
            for x in range(int(cx - rmax) - 1, int(cx + rmax) + 2):
                d = math.hypot(x - cx, (y - cy) * 1.15)
                k = int((math.atan2(y - cy, x - cx) + math.pi) / (2 * math.pi) * 24) % 24
                for r, c in layers[t]:
                    if d <= r * edge[k]:
                        pix[(x, y)] = rgb(c)
                        break
    if 1 <= t <= 4:                                      # Knochensplitter
        for ang, sp in ((-2.6, 3.2), (-2.0, 3.8), (-1.3, 4.2), (-0.7, 3.6), (-0.3, 3.0), (-2.9, 2.6)):
            d = 4 + sp * t
            x, y = int(round(cx + math.cos(ang) * d)), int(round(cy + math.sin(ang) * d + 0.4 * t * t))
            if y <= gy and (x, y) not in pix:
                pix[(x, y)] = rgb('f6ffff' if t < 3 else 'bdbdbd')
    if 6 <= t <= 11:                                     # Rauchballen steigen auf und zerfasern
        k = t - 6
        for ox, oy, r in ((-4, -3, 4.0), (3, -4, 3.6), (0, -8, 3.4), (-6, -1, 2.6), (6, -1, 2.4)):
            rr = r - 0.45 * k
            if rr < 0.8:
                continue
            yy = cy + oy - 1.4 * k
            for y in range(int(yy - rr) - 1, int(yy + rr) + 2):
                for x in range(int(cx + ox - rr) - 1, int(cx + ox + rr) + 2):
                    d = math.hypot(x - cx - ox, y - yy)
                    if d <= rr and y <= gy and (k < 2 or (x * 7 + y * 3 + k) % 4):
                        c = '9a9290' if d < rr * 0.5 else '7a7270' if d < rr * 0.85 else '5e5654'
                        pix[(x, y)] = rgb(c, int(230 - 30 * k))
    return pix


def f_brackle(i):
    global SKULL, EXPL
    s = SRC.copy()
    if SKULL is None:
        sk = load(slug='brackle-skull')
        m = sk[:, :, 3] == 255
        ys, xs = np.nonzero(m)
        sk[~m] = 0
        SKULL = sk[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        EXPL = skull_flight()
    path, (lx, gy) = EXPL
    hit = path[-1][0] + 1                                # Frame des Aufschlags
    blink(s, i)
    # Rückstoß beim Abschuss: der Panzer sackt kurz ein (Beine bleiben stehen)
    b = 1 if CAT_FIRE - 1 <= i <= CAT_FIRE + 1 else 0
    arm_m = (s[:, :, 3] > 0) & (_ys <= 16) & (_xs >= 21)
    body = s.copy()
    body[arm_m] = 0
    ang = CAT_ANG[i]
    out = np.zeros((H, W, 4), int)
    knee_put(out, body, b)
    if ang == 0.0:
        put(out, np.where(arm_m[:, :, None], s, 0), PL, PT + b)
    else:                                                # großer Winkel: Drehung ist hier in Ordnung
        arm = rotate_part(s, arm_m, CAT_PIVOT, ang, (H, W), offset=(PL, PT + b))
        am = arm[:, :, 3] > 0
        out[am] = arm[am]
        # Armfuß neu an die Nabe anschließen (die Drehung reißt sonst Lücken): 3 px breites
        # Band vom Drehpunkt 5 px entlang der aktuellen Armrichtung
        ux, uy = rot_pt((CAT_PIVOT[0] + 0.56, CAT_PIVOT[1] - 0.83), CAT_PIVOT, ang)
        ux, uy = ux - CAT_PIVOT[0], uy - CAT_PIVOT[1]
        for k in range(0, 11):
            d = k * 0.5
            for side, c in ((0, '502307'), (-1, '290e00'), (1, '290e00')):
                x = int(round(CAT_PIVOT[0] + ux * d - uy * side)) + PL
                y = int(round(CAT_PIVOT[1] + uy * d + ux * side)) + PT + b
                if side == 0 or not out[y, x, 3]:
                    out[y, x] = rgb(c)
    fill_pinholes(out)
    sh_, sw_ = SKULL.shape[:2]

    def draw_skull(cx, cy, k):
        sk = np.rot90(SKULL, k=k)
        oy, ox = int(round(cy - sk.shape[0] / 2)) + PT, int(round(cx - sk.shape[1] / 2)) + PL
        for y, x in zip(*np.nonzero(sk[:, :, 3])):
            out[oy + y, ox + x] = sk[y, x]
    if CAT_LOAD <= i < CAT_FIRE:                         # liegt in der Schale
        cx, cy = rot_pt(CAT_CUP, CAT_PIVOT, ang)
        draw_skull(cx, cy + b - 2, 0)
    for f, cx, cy in path:                               # Flug, überschlägt sich
        if f == i:
            draw_skull(cx, cy, ((i - CAT_FIRE) // 3) % 4)
    if i == hit:                                         # Aufschlag: Schädel liegt am Boden, darüber der Blitz
        draw_skull(lx, gy - sh_ / 2 + 1, ((i - CAT_FIRE) // 3) % 4)
    if hit <= i < hit + 12:
        draw_px(out, {(x + PL, y + PT): c for (x, y), c in explosion_px(i - hit, lx, gy).items()}, only_empty=False)
    return out


ICE = [('f4faff', 210), ('dcecff', 180), ('b9d3f5', 140)]


def ice_clouds(out, i, spots):
    """Eiswolken: kleine Nebelballen, die an spots [(x, y, dx, Start)] entstehen, nach außen und
    oben treiben, wachsen und verblassen. Eine Wolke, die die Figur berühren würde, entfällt
    in diesem Frame ganz (nie halb dahinter)."""
    for x0, y0, dx, t0 in spots:
        t = (i - t0) % N
        if t >= 16:
            continue
        cx, cy = x0 + dx * t * 0.3, y0 - t * 0.3
        r = 1.0 + 0.2 * t if t < 10 else 3.0 - 0.3 * (t - 10)
        fade = 1.0 if t < 10 else 1 - (t - 10) / 7
        pix = {}
        for bx, by, bs in ((-0.9, 0.2, 0.85), (0.9, 0.4, 0.8), (0.1, -0.7, 0.9)):   # drei Ballen = Wolke
            rb = r * bs
            ox, oy = cx + bx * r * 0.7, cy + by * r * 0.7
            for y in range(int(oy - rb) - 1, int(oy + rb) + 2):
                for x in range(int(ox - rb) - 1, int(ox + rb) + 2):
                    d = math.hypot(x - ox, (y - oy) * 1.25) / rb
                    if d <= 1:
                        lvl = 0 if d < 0.45 else 1 if d < 0.8 else 2
                        if (x, y) not in pix or pix[(x, y)][0] > lvl:
                            pix[(x, y)] = (lvl, None)
        for k, (lvl, _) in list(pix.items()):
            c, a = ICE[lvl]
            pix[k] = rgb(c, int(a * fade))
        if not pix or any(out[y, x, 3] for x, y in pix):
            continue
        for (x, y), c in pix.items():
            assert 0 < x < W - 1 and 0 < y < H - 1, f'Eiswolke am Rand: {(x, y)}'
            out[y, x] = c


def f_broghan(i):
    s = SRC.copy()
    b = BOUNCE12[i % 12]
    w = 2 * math.pi * 2 * i / N
    chain = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in ('a0a0a0', '898989', '595959') and y >= 18:
            chain[y, x] = True

    def cdx(x, y):                                       # Ketten schwingen, unten stärker
        if chain[y, x]:
            side = -1 if x < SW / 2 else 1
            return int(round(1.2 * (y - 18) / 12 * (math.sin(w + (0 if side < 0 else 1.7)) - math.sin(0 if side < 0 else 1.7))))
        return 0
    eye = glow_eye(s, i, ('be0000', '9c0000'))
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b, moves=lambda x, y: chain[y, x], dx_fn=cdx)
    fill_pinholes(out)
    glow_halo(out, i, eye, PL, PT + b)
    ice_clouds(out, i, [(-3 + PL, 27 + PT, -1, 0), (SW + 2 + PL, 26 + PT, 1, 8), (17 + PL, 28 + PT, 0, 16),
                        (-2 + PL, 22 + PT, -1, 24), (SW + 1 + PL, 22 + PT, 1, 32), (-3 + PL, 28 + PT, -1, 40),
                        (SW + 2 + PL, 28 + PT, 1, 44)])
    return out


def eye_f(i):
    return max(0.0, math.sin(2 * math.pi * 2 * i / N - math.pi / 2) * 0.5 + 0.5) ** 2   # leuchtet periodisch


def glow_eye(s, i, reds):
    """Rote Augenpixel (reds, heller zuerst) aufhellen; liefert ihre Positionen."""
    f = eye_f(i)
    eye = [(y, x) for y, x in zip(*np.nonzero(s[:, :, 3])) if hexc(s[y, x]) in reds and y < 15]
    for y, x in eye:
        if hexc(s[y, x]) == reds[0]:
            s[y, x] = lighten([255, 40, 30, 255], 0.55 * f)
        else:
            c = s[y, x]
            s[y, x] = [min(255, int(c[0] + 0x60 * f)), int(20 * f), int(20 * f), 255]
    return eye


def glow_halo(out, i, eye, ox, oy):
    """Roter Leuchtschein (1 px) um das leuchtende Auge."""
    f = eye_f(i)
    if f <= 0.25:
        return
    em = np.zeros(out.shape[:2], bool)
    for y, x in eye:
        em[y + oy, x + ox] = True
    for y, x in zip(*np.nonzero(ring8(em))):
        c = out[y, x]
        if not c[3]:
            continue
        a = f * 0.55
        out[y, x] = [int(c[0] * (1 - a) + 255 * a), int(c[1] * (1 - a) + 50 * a), int(c[2] * (1 - a) + 40 * a), c[3]]


def draw_gear(s, i):
    """Zahnrad an der rechten Schulter, von der Kante gesehen (Spalte 19, Zeilen 11-18): die
    hellen Zähne wandern nach unten – das Rad dreht sich auf den Betrachter zu."""
    sh = (i // 2) % 3
    for y in range(11, 19):
        s[y, 19] = rgb('76948b' if (y - 13 - sh) % 3 == 0 else '556867')


def f_golem(i):
    s = SRC.copy()
    eye = glow_eye(s, i, ('c10000', '9f0000'))
    draw_gear(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    glow_halo(out, i, eye, PL, PT + b)
    ice_clouds(out, i, [(-3 + PL, 28 + PT, -1, 4), (SW + 2 + PL, 27 + PT, 1, 12), (13 + PL, 30 + PT, 0, 20),
                        (-2 + PL, 23 + PT, -1, 28), (SW + 1 + PL, 23 + PT, 1, 36), (SW + 2 + PL, 29 + PT, 1, 44)])
    return out


CLOWN_HAIR = ('273a59', '2c7494', '25283e', '5dcbe1', '084969')


def f_clown(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    hair = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in CLOWN_HAIR and (x <= 10 or x >= SW - 11):
            hair[y, x] = True

    def hdy(x, y):                                       # Haarschlaufen federn, außen stärker (spaltenweise)
        if not hair[y, x]:
            return 0
        t = min(1.0, max(0.0, (abs(x - (SW - 1) / 2) - 4) / 10))
        ph = 0.0 if x < SW / 2 else 1.6
        return int(round(1.6 * t * (math.sin(w + ph) - math.sin(ph))))
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    hook = lambda x, y: x <= 10 and 20 <= y <= 24 and hexc(s[y, x]) in ('969696', 'ffffff')
    put(out, s, PL, PT, dy_fn=lambda x, y: hdy(x, y) + (b if (y < KNEE or (x <= 9 and y < 24) or hook(x, y)) else 0))
    if b < 0:
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    stars(out, i, [(7 + PL, 22 + PT + b, 10), (8 + PL, 24 + PT + b, 34)], 'e8f4ff', 'ffffff')   # Hakenhand blitzt
    return out


def f_bbg(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    tip = lambda x, y: int(round(1.0 * (4 - y) / 4 * math.sin(w))) if y < 4 else 0   # Hutspitze wippt nach
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    hook = lambda x, y: x <= 2 and 25 <= y <= 29 and hexc(s[y, x]) in ('969696', 'ffffff')
    knee_put(out, s, b, moves=lambda x, y: (x <= 1 and y < 29) or hook(x, y), dx_fn=tip)
    fill_pinholes(out)
    stars(out, i, [(0 + PL, 27 + PT + b, 10), (1 + PL, 29 + PT + b, 34)], 'e8f4ff', 'ffffff')   # Hakenhand blitzt
    return out


# Fern putzt sein Schwert: der Lappen gleitet entlang der Klinge (Verschiebungsfeld, zur Schulter hin null)
FERN_RAG = {'fern': ('arm', (6.0, 13.0)), 'fernelf': ('hand', (5.0, 8.0))}
BLADE_U = (0.92, -0.39)                                  # Richtung Heft -> Spitze


def f_fern(i):
    part, root = FERN_RAG[V]
    s = SRC.copy()
    body, sword, rag = load('body'), load('sword'), load(part)
    if 'lid' in C:
        blink(body, i)
    st = math.sin(2 * math.pi * 4 * i / N)               # vier Striche pro Loop
    out = np.zeros((H, W, 4), int)
    put(out, body, PL, PT)
    # Klinge glänzt kurz nach jedem Strich (Lichtreflex läuft zur Spitze)
    blade = (sword[:, :, 3] > 0) & (np.array([[lum(sword[y, x]) > 150 for x in range(SW)] for y in range(SH)]))
    sw = sword.copy()
    for (x, y), a in sweep(blade, i * 4 % N, 2, speed=1.6).items():
        sw[y, x] = lighten(sw[y, x], a * 0.8)
    put(out, sw, PL, PT)
    m = rag[:, :, 3] > 0
    ys, xs = np.nonzero(m)
    for y in range(max(0, ys.min() - 3), min(SH, ys.max() + 4)):
        for x in range(max(0, xs.min() - 3), min(SW, xs.max() + 4)):
            t = max(0.0, min(1.0, ((x - root[0]) * BLADE_U[0] + (y - root[1]) * BLADE_U[1]) / 10))
            dx, dy = int(round(2.4 * st * t * BLADE_U[0])), int(round(2.4 * st * t * BLADE_U[1]))
            sx, sy_ = x - dx, y - dy
            if 0 <= sx < SW and 0 <= sy_ < SH and m[sy_, sx]:
                out[y + PT, x + PL] = rag[sy_, sx]
    fill_pinholes(out)
    return out


FAIRY = None
PINK = rgb('e600e6', 127)


def f_fairy(i):
    global FAIRY
    s = SRC.copy()
    if FAIRY is None:
        pink = (s[:, :, 3] > 0) & (s[:, :, 3] < 200)
        fig = (s[:, :, 3] > 0) & ~pink
        wing = np.zeros((SH, SW), bool)
        for y, x in zip(*np.nonzero(fig)):
            if (x <= 8 or x >= SW - 9) and y <= 12 and hexc(s[y, x]) in ('5c31ca', '1e8a10', '107caa', 'c80000',
                                                                          '109eaa'):
                wing[y, x] = True
        near = np.zeros((SH, SW), int)                   # Aura: 1 = dicht an der Figur, 2 = Außenrand
        fy, fx = np.nonzero(fig)
        for y, x in zip(*np.nonzero(pink)):
            d = np.min(np.abs(fy - y) + np.abs(fx - x))
            if d <= 3:
                near[y, x] = 1 if d <= 1 else 2
        FAIRY = (pink, fig, wing, near)
    pink, fig, wing, near = FAIRY
    hv = int(round(math.sin(2 * math.pi * 2 * i / N)))   # schwebt
    body = s.copy()
    body[pink | wing] = 0
    out = np.zeros((H, W, 4), int)
    put(out, body, PL, PT + hv)
    # Schmetterlingsflügel: spaltenweise Scherung (außen stärker), schnelles Flattern
    ph = 2 * math.pi * 6 * i / N
    lift = 0.45 * math.sin(ph)
    squeeze = 1 - 0.3 * (0.5 - 0.5 * math.cos(ph))
    wl = wing & (_xs < SW / 2)
    shear_flap(s, wl, int(np.nonzero(wl)[1].max()) + 1, -1, lift, squeeze, out, offset=(PL, PT + hv))
    wr = wing & (_xs >= SW / 2)
    shear_flap(s, wr, int(np.nonzero(wr)[1].min()) - 1, 1, lift, squeeze, out, offset=(PL, PT + hv))
    fill_pinholes(out)
    # pinke Partikel: flimmernde Aura dicht an der Figur, dazu fallende Funken als Schweif
    rng = np.random.default_rng(i)
    for y, x in zip(*np.nonzero(near)):
        yy, xx = y + PT + hv, x + PL
        if not out[yy, xx, 3] and (near[y, x] == 1 or rng.random() < 0.55):
            out[yy, xx] = PINK if rng.random() < 0.9 else rgb('ff7bff', 200)
    prng = np.random.default_rng(3)
    for k in range(46):
        life = [12, 16, 24][k % 3]
        off = int(prng.integers(life))
        x0 = prng.uniform(1, SW - 2)
        y0 = prng.uniform(10, 26)
        vy = prng.uniform(0.4, 0.9)
        t = (i + off) % life
        x = int(round(x0 + 0.8 * math.sin(t * 0.5 + k)))
        y = int(round(y0 + vy * t))
        if y >= SH + 2:
            continue
        yy, xx = y + PT, x + PL
        if 0 < yy < H - 1 and 0 < xx < W - 1 and not out[yy, xx, 3]:
            a = int(190 * (1 - t / life)) + 40
            out[yy, xx] = rgb('ff7bff' if k % 5 == 0 else 'e600e6', a)
    return out


def f_fiona(i):
    s = SRC.copy()
    blink(s, i)
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT)
    stars(out, i, [(14 + PL, 9 + PT, 6), (19 + PL, 9 + PT, 18), (16 + PL, 8 + PT, 30), (17 + PL, 9 + PT, 42)],
          'ffe600', 'fff6ac')
    stars(out, i, [(9 + PL, 1 + PT, 0), (22 + PL, 1 + PT, 12), (4 + PL, 13 + PT, 24), (27 + PL, 13 + PT, 36),
                   (8 + PL, 23 + PT, 3), (25 + PL, 23 + PT, 27), (15 + PL, 3 + PT, 15), (1 + PL, 21 + PT, 39)],
          'fdfd7c', 'fff6ac')                            # Thron funkelt
    return out


# --- Etappe 3 -------------------------------------------------------------------
SWING = 3                                                # Schwünge pro Loop


def pendulum(i, amp=9.0):
    """Schwingen am Seil (Aufhängung oben): jede Zeile rückt als Ganzes seitlich, unten stärker.
    Das Bild zeigt schon den Ausschlag nach rechts – von dort schwingt sie nach links und zurück."""
    s_ = 0.5 * (math.cos(2 * math.pi * SWING * i / N) - 1)
    return lambda x, y: int(round(amp * s_ * y / (SH - 1)))


def f_gabbyrope(i):
    s = SRC.copy()
    blink(s, i)
    sw = pendulum(i)
    # Haare hängen dem Schwung nach: gegen die Bewegungsrichtung, zur Spitze hin stärker
    # (schwingt sie nach rechts, fliegen sie nach links). Rückwärts abgetastet: jedes Zielpixel
    # holt sich sein Quellpixel – die Haare dehnen sich stetig, es reißen keine Lücken.
    v = math.sin(2 * math.pi * SWING * i / N)            # > 0: sie schwingt gerade nach links
    if V == 'boarding':
        hair = np.array([[x >= 19 and 33 <= y <= 46 and s[y, x, 3] > 0 and hexc(s[y, x]) in
                          ('bd39ac', 'f68bee', 'ffacff', 'd552c5', 'ac319c', '620852', '310062', '6a20ac')
                          for x in range(SW)] for y in range(SH)])      # samt dunklen Schattenpixeln im Schopf
        lagf = lambda x, y: 3.0 * v * min(1.0, max(0.0, (x - 19) / 5))
    else:                                                # Chosen Girl: langer blonder Zopf nach rechts unten
        hair = np.array([[x >= 17 and 31 <= y <= 47 and s[y, x, 3] > 0 and hexc(s[y, x]) in
                          ('402200', 'd5b11e', 'f0f329', '947116', 'eecd2d') for x in range(SW)] for y in range(SH)])
        lagf = lambda x, y: 5.0 * v * min(1.0, max(0.0, (y - 37) / 10))   # erst unterhalb des Kopfes
    # Seil oberhalb der Hände: jede Frame als gerade Linie von der Aufhängung zur Hand neu legen
    # (Muster je Zeile bleibt), sonst entstehen durch das zeilenweise Schieben kleine Knicke
    RY = 32
    rope = s.copy()
    rope[RY + 1:] = 0
    rest = s.copy()
    rest[:RY + 1] = 0
    rows = {y: sorted(x for x in range(SW) if rope[y, x, 3]) for y in range(RY + 1)}
    x0, x1 = rows[0][0], rows[RY][0] + sw(0, RY)
    out = np.zeros((H, W, 4), int)
    for y, xs in rows.items():
        if not xs:
            continue
        xs0 = xs[0] if sw(0, RY) == 0 else int(round(x0 + (x1 - x0) * y / RY))
        for x in xs:
            out[y + PT, xs0 + (x - xs[0]) + PL] = rope[y, x]
    body = rest.copy()
    body[hair] = 0
    put(out, body, PL, PT, dx_fn=sw)
    hy, hx = np.nonzero(hair)
    for y in range(hy.min(), hy.max() + 1):
        row = np.nonzero(hair[y])[0]
        if not len(row):
            continue
        if V == 'boarding':
            # Schopf: die zwei Wurzelspalten bleiben am Kopf, der Rest rückt als Ganzes um lag;
            # die Lücke dazwischen füllt die erste Innenspalte (pinke Haarfarbe, nicht der Schatten)
            r0 = row[0]
            lag = int(round(3.0 * v * min(1.0, (y - 33) / 4 + 0.25)))
            for x in range(r0 - 4, row[-1] + 5):
                if x <= r0 + 1:
                    sx = x
                elif lag > 0 and x <= r0 + 1 + lag:
                    sx = r0 + 2
                else:
                    sx = x - lag
                if 0 <= sx < SW and hair[y, sx]:
                    out[y + PT, x + sw(x, y) + PL] = s[y, sx]
        else:
            for x in range(hx.min() - 6, hx.max() + 7):
                sx = int(round(x - lagf(x, y)))
                if 0 <= sx < SW and hair[y, sx]:
                    out[y + PT, x + sw(x, y) + PL] = s[y, sx]
    fill_pinholes(out)
    if V == 'chosen':                                    # Lichtreflex über das goldene Schwert
        gold = (s[:, :, 3] > 0) & (_xs >= 17) & (_ys >= 32) & np.array(
            [[hexc(s[y, x]) in ('f0f329', 'eecd2d', 'd5b11e', 'fff6bd', 'ffe600') for x in range(SW)] for y in range(SH)])
        for (x, y), a in sweep(gold, i, 30, speed=1.4).items():
            out[y + PT, x + PL + sw(x, y)] = lighten(out[y + PT, x + PL + sw(x, y)], a)
    return out


def f_zombie(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * i / N
    lurch = lambda x, y: int(round(1.2 * (KNEE - y) / KNEE * math.sin(2 * w))) if y < KNEE else 0   # torkelt
    b = [0, 0, 1, 1, 0, 0][i % 6] if (i // 12) % 2 else 0                                          # sackt ab und zu ein
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b, dx_fn=lurch)
    fill_pinholes(out)
    return out


def f_moon(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    tails = lambda x, y: (x <= 3 or x >= SW - 4) and y >= 8                                         # Zöpfe
    dx = lambda x, y: int(round(1.0 * (y - 8) / 11 * (math.sin(w - 0.3 * y) - math.sin(-0.3 * y)))) if tails(x, y) else 0
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, BOUNCE12[i % 12], moves=tails, dx_fn=dx)
    fill_pinholes(out)
    return out


def f_garius(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    shield = (s[:, :, 3] > 0) & (_xs <= 10) & (_ys >= 15)
    spear = (s[:, :, 3] > 0) & (_xs >= 23)
    plume = (s[:, :, 3] > 0) & (_ys <= 13) & np.array(
        [[hexc(s[y, x]) in ('d60000', '9c0000', '710000', 'ff0000', 'e61010') for x in range(SW)] for y in range(SH)])
    armour = (s[:, :, 3] > 0) & ~shield & ~spear & ~plume & np.array(
        [[max(s[y, x, :3]) - min(s[y, x, :3]) < 24 and lum(s[y, x]) > 55 for x in range(SW)] for y in range(SH)])
    for (x, y), a in sweep(armour, i, 22, speed=1.2).items():                # Rüstung blitzt
        s[y, x] = lighten(s[y, x], a)
    b = BOUNCE12[i % 12]
    sh_dy = int(round(1.0 * (math.sin(w) - 0)))                              # Schild hebt/senkt sich
    sp_dy = int(round(1.4 * (math.sin(w * 1.5 + 2.0) - math.sin(2.0))))     # Speer eigenständig
    pl_dx = lambda y: int(round(0.9 * (13 - y) / 9 * (math.sin(w - 0.4 * y) - math.sin(-0.4 * y))))

    def dy(x, y):
        if shield[y, x]:
            return b + sh_dy
        if spear[y, x]:
            return b + sp_dy
        return b if y < KNEE else 0
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[shield | spear] = 0
    put(out, np.where(spear[:, :, None], s, 0), PL, PT, dy_fn=dy)
    put(out, body, PL, PT, dy_fn=dy, dx_fn=lambda x, y: pl_dx(y) if plume[y, x] else 0)
    if b < 0:
        for x in range(SW):
            if body[KNEE - 1, x, 3] and body[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = body[KNEE - 1, x]
    put(out, np.where(shield[:, :, None], s, 0), PL, PT, dy_fn=dy)
    fill_pinholes(out)
    stars(out, i, [(7 + PL, 17 + PT + b, 22)], 'e8f4ff', 'ffffff')           # Helm funkelt beim Blitzen
    return out


def f_vader(i):
    s = SRC.copy()
    blade = (s[:, :, 3] > 0) & (_ys <= 19) & (_xs >= 16)
    # Klinge fährt ein (20-25), bleibt kurz aus, zündet wieder (32-37)
    if 20 <= i < 26:
        L = int(round(20 * (1 - (i - 19) / 6)))
    elif 26 <= i < 32:
        L = 0
    elif 32 <= i < 38:
        L = int(round(20 * (i - 31) / 6))
    else:
        L = 20
    s[blade & (_ys < 20 - L)] = 0
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    if L > 0:                                             # Leuchten: halbtransparenter roter Saum, pulsierend
        f = 0.5 + 0.5 * math.sin(2 * math.pi * 4 * i / N)
        bm = np.zeros((H, W), bool)
        for y, x in zip(*np.nonzero(blade & (_ys >= 20 - L))):
            bm[y + PT + b, x + PL] = True
        ring = ring8(bm)
        for y, x in zip(*np.nonzero(ring)):
            if not out[y, x, 3]:
                out[y, x] = rgb('ff3a3a', int(70 + 50 * f))
        for y, x in zip(*np.nonzero(bm)):                 # Kern flackert
            if hexc(out[y, x]) == 'fcfcf9' and (y + i) % 7 == 0:
                out[y, x] = rgb('ffd0d0')
    return out


def f_gobbo(i):
    s = SRC.copy()
    blink(s, i)
    club = (s[:, :, 3] > 0) & (_xs >= 14) & (_ys <= 16) & np.array(
        [[s[y, x, 0] > s[y, x, 1] + 10 or lum(s[y, x]) < 40 for x in range(SW)] for y in range(SH)]) & (_xs + _ys * 0.0 >= 14)
    k = 0.16 * math.sin(2 * math.pi * 2 * i / N)          # Knüppel schwenkt (spaltenweise Scherung um die Faust)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[club] = 0
    knee_put(out, body, b)
    put(out, np.where(club[:, :, None], s, 0), PL, PT + b, dy_fn=lambda x, y: -int(round(k * (x - 15))))
    fill_pinholes(out)
    f = 0.5 - 0.5 * math.cos(2 * math.pi * 3 * i / N)     # rote Augen glimmen
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) == '7b0818' and y < 6:
            out[y + PT + b, x + PL] = [int(0x7b + 0x70 * f), int(8 + 30 * f), int(24 + 20 * f), 255]
    return out


CAPE_RED = ('4f0000', '6b0000', '8a0000', 'a50000', '3a0000', '5a0808', '7b1010', '940000', '310000', '2d0000')


def f_hatusbal(i):
    s = SRC.copy()
    blink(s, i)
    w = 2 * math.pi * 2 * i / N
    op = s[:, :, 3] > 0
    if V == 'hatusbal':
        cape = op & ((_xs <= 4) | (_xs >= SW - 5)) & (_ys >= 9) & np.array(
            [[s[y, x, 0] > 2 * s[y, x, 1] + 20 for x in range(SW)] for y in range(SH)])
        y0, y1 = 9, 24
        skin = ('f5cba1', '9c693e', 'efa15f')
        trunk = op & (((_xs >= 9) & (_xs <= 14) & (_ys >= 11) & (_ys <= 16)) |
                      ((_xs >= 9) & (_xs <= 19) & (_ys >= 17) & (_ys <= 19)))
        trunk &= np.array([[hexc(s[y, x]) not in skin for x in range(SW)] for y in range(SH)])
        tr0, tr1, behind = 11, 19, '302c2d'
    else:                                                # Ancient Hatusbal: der Helmbusch weht
        cape = op & (_ys <= 6)
        y0, y1 = 6, 0
        trunk = op & (((_xs >= 8) & (_xs <= 12) & (_ys >= 12) & (_ys <= 22)) |
                      ((_xs >= 12) & (_xs <= 19) & (_ys >= 23) & (_ys <= 26)))
        tr0, tr1, behind = 12, 26, '403530'

    def cdx(x, y):                                       # Wind von links: nur nach rechts, unten stärker
        if V == 'jack':
            return int(round(1.2 * (6 - y) / 6 * (0.5 - 0.5 * math.cos(w - 0.6 * y)) -
                             1.2 * (6 - y) / 6 * (0.5 - 0.5 * math.cos(-0.6 * y))))
        t = (y - y0) / (y1 - y0)
        return int(round(1.3 * t * (0.5 - 0.5 * math.cos(w - 0.5 * y)) - 1.3 * t * (0.5 - 0.5 * math.cos(-0.5 * y))))
    # Rüssel pendelt seitlich, zur Spitze hin stärker (zeilenweise, nichts neu gerastert)
    tdx = lambda y: int(round(1.4 * min(1.0, max(0.0, (y - tr0) / (tr1 - tr0))) * math.sin(w * 0.5 * 2)))
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[cape | trunk] = 0
    for y, x in zip(*np.nonzero(trunk)):                  # was der Rüssel freigibt: dunkler Körper
        body[y, x] = rgb(behind)
    if V == 'hatusbal':                                   # Umhang: Original bleibt liegen, der Wind legt nach
        put(out, np.where(cape[:, :, None], s, 0), PL, PT, dy_fn=lambda x, y: b if y < KNEE else 0)
    put(out, np.where(cape[:, :, None], s, 0), PL, PT, dy_fn=lambda x, y: b if y < KNEE else 0,
        dx_fn=lambda x, y: cdx(x, y) if cape[y, x] else 0)
    legs = body.copy()
    legs[:KNEE] = 0
    upper = body.copy()
    upper[KNEE:] = 0
    put(out, legs, PL, PT)                                # Oberkörper vor den Beinen (Rüsselkante bleibt sichtbar)
    put(out, upper, PL, PT + b)
    if b < 0:
        for x in range(SW):
            if body[KNEE - 1, x, 3] and body[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = body[KNEE - 1, x]
    put(out, np.where(trunk[:, :, None], s, 0), PL, PT + b, dx_fn=lambda x, y: tdx(y))
    fill_pinholes(out)
    if V == 'hatusbal':
        stars(out, i, [(11 + PL, 1 + PT + b, 30)], 'ffe600', 'fff6ac')   # Krone
    return out


class BlueFire:
    """Blaues Fuchsfeuer aus der Hand: jedes Frame strömen zwei Flammenballen nach links
    (Richtung der Original-Flamme), wachsen, kühlen ab und züngeln leicht nach oben; die
    Hitze ergibt die Farbe (weiß, hellblau, türkis, blau, dunkelblau am Rand). Loop nahtlos."""
    COLS = [(0.86, rgb('ffffff')), (0.64, rgb('c8f8ff')), (0.42, rgb('49dff2')), (0.26, rgb('45c6ed')),
            (0.14, rgb('41b0e2')), (0.07, rgb('2d7fcf'))]

    def __init__(self, nozzle):
        self.n0 = np.array(nozzle, float)
        self.puffs = []
        for e in range(N):
            for k in range(2):
                rng = np.random.default_rng(e * 31 + k + 5)
                ang = math.pi + rng.uniform(-0.16, 0.12)
                self.puffs.append(dict(e=e, v=np.array([math.cos(ang), math.sin(ang)]) * rng.uniform(1.9, 2.3),
                                       life=rng.uniform(10.0, 12.0), r0=rng.uniform(1.0, 1.5),
                                       r1=rng.uniform(4.5, 6.0), buoy=rng.uniform(0.03, 0.08),
                                       h0=rng.uniform(0.95, 1.1), fl=rng.uniform(0, 6.28)))

    def render(self, out, i, ox, oy):
        H_, W_ = out.shape[:2]
        heat = np.zeros((H_, W_))
        for p in self.puffs:
            a = (i - p['e']) % N
            if a >= p['life']:
                continue
            u = a / p['life']
            cx = self.n0[0] + p['v'][0] * a + ox
            cy = self.n0[1] + p['v'][1] * a - 0.5 * p['buoy'] * a * a + oy
            r = p['r0'] + (p['r1'] - p['r0']) * u ** 0.8
            h = p['h0'] * (1 - u) ** 0.7 * (1 + 0.12 * math.sin(2 * math.pi * 6 * i / N + p['fl']))
            for y in range(max(0, int(cy - r) - 1), min(H_, int(cy + r) + 2)):
                for x in range(max(0, int(cx - r) - 1), min(W_, int(cx + r) + 2)):
                    q = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r)
                    if q < 1:
                        heat[y, x] = max(heat[y, x], h * (1 - q) ** 0.6)
        for y, x in zip(*np.nonzero(heat > self.COLS[-1][0])):
            if out[y, x, 3]:
                continue
            for th, c in self.COLS:
                if heat[y, x] > th:
                    out[y, x] = c
                    break


FIRE = None


def f_hulijing(i):
    global FIRE
    s = load('body')
    if FIRE is None:
        FIRE = BlueFire((22.5, 21.0))
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    FIRE.render(out, i, PL, PT + b)
    return out


# --- Etappe 4 -------------------------------------------------------------------
# Ingo: das Base-Sprite zeigt ihn ohne Kapuze (die graue Kappe sind seine Haare). Die Kapuze selbst
# stammt Pixel für Pixel aus Ingos eigenen Frames (src/user/ingo-hood-frames.png, deckungsgleich:
# Frame-Pixel (x, y) = Base (x - 3, y - 8)): aufgesetzt aus f2 (nur die Kapuzenfarben, das Gesicht
# darin bleibt das des Base-Sprites), in den Nacken gefallen aus f6.
#   B = ohne Kapuze (Base), N = Kapuze liegt im Nacken, S = Kapuze rutscht (halb auf), K = Kapuze auf.
INGO_SEQ = ['B'] * 12 + ['N', 'N', 'S', 'S'] + ['K'] * 18 + ['S', 'S', 'N', 'N'] + ['B'] * 10
# Arme heben sich zur Kapuze (Hub der Ärmelenden in px) – vorher, beim Greifen, danach wieder runter
INGO_LIFT = {10: 1, 11: 2, 12: 3, 13: 3, 14: 3, 15: 3, 16: 2, 17: 1,
             32: 1, 33: 2, 34: 3, 35: 3, 36: 3, 37: 3, 38: 2, 39: 1}
INGO_BLINK = {5: 'B', 24: 'K', 42: 'B'}
INGO_STAR = [(11, 7, 8), (11, 7, 27)]                    # Monokel blitzt (ohne und mit Kapuze)
INGO_POSES = None
INGO_TOP = 2                                             # Luft oben für die Kapuze


def ingo_poses():
    fr = np.array(Image.open('src/user/ingo-hood-frames.png').convert('RGBA')).astype(int)
    user = lambda k: fr[(k // 2) * 32:(k // 2 + 1) * 32, (k % 2) * 24:(k % 2 + 1) * 24]
    base = np.zeros((SH + INGO_TOP, SW, 4), int)
    base[INGO_TOP:] = SRC

    def hood_from(k, cols, y_max, dy=0, keep=None):
        out = base.copy()
        f = user(k)
        for fy in range(32):
            for fx in range(24):
                x, y = fx - 3, fy - 8 + INGO_TOP + dy
                if not (0 <= x < SW and 0 <= y < out.shape[0]) or fy - 8 > y_max:
                    continue
                if f[fy, fx, 3] and hexc(f[fy, fx]) in cols and (keep is None or keep(x, y - INGO_TOP)):
                    out[y, x] = f[fy, fx]
        return out
    hood_k = ('191919', '525252', '2a2a2a', '414141', '323232', '202020', '000000')
    hood_n = ('191919', '525252', '323232', '202020', '2a2a2a')
    head = SRC[:, :, 3] > 0
    K = hood_from(2, hood_k, 8)                          # aufgesetzt
    N = hood_from(6, hood_n, 9, keep=lambda x, y: not (0 <= y < SH and head[y, x]) or y >= 9)   # im Nacken
    # halb: die Kapuze 1 px höher, nur ihr oberer Teil (bis Augenhöhe); auf dem Kopf nur die Haube,
    # das Gesicht bleibt frei – die unteren Seiten fehlen noch (sonst schweben sie über den Schultern)
    S = hood_from(2, hood_k, 6, dy=-1, keep=lambda x, y: y <= 2 or not (0 <= y < SH and head[y, x]))
    return dict(B=base, N=N, S=S, K=K)


INGO_ARM = None


def f_ingo(i):
    global INGO_POSES, INGO_ARM
    if INGO_POSES is None:
        INGO_POSES = ingo_poses()
        INGO_ARM = (SRC[:, :, 3] > 0) & ((_xs <= 3) | (_xs >= SW - 4)) & (_ys >= 9) & (_ys <= 15)   # samt Unterkontur
    key = INGO_SEQ[i]
    f = INGO_POSES[key].copy()
    if INGO_BLINK.get(i):                                # linkes Auge (weiß + rot) schließt sich
        f[7 + INGO_TOP, 6] = f[7 + INGO_TOP, 7] = BLACK
    T = INGO_TOP
    b = BOUNCE12[i % 12] if INGO_LIFT.get(i, 0) == 0 else 0
    lift = INGO_LIFT.get(i, 0)

    def dy(x, y):                                        # y in Pose-Koordinaten (T Zeilen Luft oben)
        ys = y - T
        d = b * ((ys < 17) + (ys < 9))                   # ganze Figur: Kopf 2 px, Rumpf 1 px, Füße fest
        if 0 <= ys < SH and INGO_ARM[ys, x] and lift:    # Ärmel heben sich, außen stärker
            d -= int(round(lift * min(1.0, max(0.0, (abs(x - (SW - 1) / 2) - 4.5) / 4))))
        return d
    out = np.zeros((f.shape[0] + 4, f.shape[1] + 6, 4), int)
    put(out, f, 3, 2, dy_fn=dy)
    if b < 0:                                            # Nähte dehnen (Hals und Beine)
        for seam in (9 + T, 17 + T):
            for x in range(SW):
                if f[seam - 1, x, 3] and f[seam, x, 3] and not out[seam - 1 + 2 + dy(x, seam), x + 3, 3]:
                    out[seam - 1 + 2 + dy(x, seam), x + 3] = f[seam - 1, x]
    fill_pinholes(out)
    if lift:                                             # angehobene Ärmel: Unterkante als 1-px-Kontur
        for x in list(range(0, 3 + 7)) + list(range(3 + SW - 7, 3 + SW)):
            for y in range(9 + T + 2 - 4, 17 + T + 2):
                if out[y, x, 3] and not out[y + 1, x, 3]:
                    out[y, x] = rgb('191919')
    stars(out, i, [(x + 3, y + T + 2 + 2 * b, t0) for x, y, t0 in INGO_STAR], 'e8f4ff', 'ffffff')
    return out


def f_eingo(i):
    s = SRC.copy()
    blink(s, i)
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    knee_put(out, s, b)
    fill_pinholes(out)
    stars(out, i, [(12 + PL, 7 + PT + b, 10), (12 + PL, 7 + PT + b, 34)], 'e8f4ff', 'ffffff')   # Monokel blitzt
    return out


MADAME_TALK = talk_track(['oo', 'oc', 'ww', 'wo', 'occ', 'wwc', 'c'], 23)
MADAME_STRANDS = None


def f_madame(i):
    global MADAME_STRANDS
    s = SRC.copy()
    blink(s, i)
    st = MADAME_TALK[i] if i else 'o'                     # Rede: Mund auf und zu
    if st == 'c':
        s[14, 22] = s[14, 23] = rgb('740000')
        s[15, 22] = s[15, 23] = rgb('f7bd7b')
    elif st == 'w':
        s[16, 22] = s[16, 23] = rgb('660000')
    head = (s[:, :, 3] > 0) & (_xs >= 28)                 # abgeschlagener Kopf samt Blutlache liegt fest
    blade = (s[:, :, 3] > 0) & (_ys <= 13) & (_xs <= 15) & np.array(
        [[max(s[y, x, :3]) - min(s[y, x, :3]) < 20 and lum(s[y, x]) > 100 for x in range(SW)] for y in range(SH)])
    if MADAME_STRANDS is None:                            # Blutfäden unter dem Kopf: je Spalte von oben nach unten
        MADAME_STRANDS = []
        for x in range(28, SW):
            ys = [y for y in range(22, 30) if s[y, x, 3] and hexc(s[y, x]) in ('660000', '740000', '800000')]
            if len(ys) >= 3:
                MADAME_STRANDS.append((x, ys))
    for k, (x, ys) in enumerate(MADAME_STRANDS):          # Blut rinnt die Fäden hinab (heller Tropfen)
        t = (i * 2 + k * 5) % 24
        if t < len(ys):
            s[ys[t], x] = rgb('c01818')
            if t > 0:
                s[ys[t - 1], x] = rgb('9a0000')
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    fig = s.copy()
    fig[head] = 0
    for y, x in zip(*np.nonzero(head)):                   # Kopf und Lache federn nicht mit
        out[y + PT, x + PL] = s[y, x]
    knee_put(out, fig, b)
    fill_pinholes(out)
    stars(out, i, [(7 + PL, 3 + PT + b, 20)], 'e8f4ff', 'ffffff')              # Beil blitzt kurz auf
    # Blut tropft von der roten Schneide: an mehreren Stellen bildet sich unter der Kante ein
    # Tropfen, löst sich und fällt bis zum Boden (dort zerplatzt er)
    red = ('660000', '740000', '800000')
    for x, t0 in ((3, 2), (7, 14), (10, 26), (13, 38), (5, 32), (12, 8)):
        ys = [y for y in range(0, 15) if SRC[y, x, 3] and hexc(SRC[y, x]) in red]
        if not ys:
            continue
        t = (i - t0) % N
        draw_px(out, drop_pixels(t, x + PL, max(ys) + 1 + PT + (b if t < 4 else 0), SH - 1 + PT))
    return out


def f_marianne(i):
    parts = {p: load(p) for p in ('fork', 'cat', 'body', 'hair', 'arm', 'hat')}
    body = np.zeros_like(parts['body'])
    for p in ('body', 'hair', 'arm', 'hat'):
        m = parts[p][:, :, 3] > 0
        body[m] = parts[p][m]
    blink(body, i)
    cat = parts['cat']
    # Streicheln: die Hand drückt sanft auf den Katzenkopf und streicht (2 Striche pro Takt),
    # der Kopf der Katze geht mit, sie schließt dabei genießerisch die Augen
    stroke = [0, 0, 1, 1, 1, 1, 0, 0][i % 8] if (i // 8) % 3 != 2 else 0
    if stroke:
        cat[17, 22] = rgb('fff6ff')
        cat[18, 22] = rgb('000000')
    catdy = lambda x, y: stroke if (x <= 27 and y <= 19) else 0
    w = 2 * math.pi * i / N
    tail = lambda x, y: -int(round(1.0 * (x - 31) / 4 * math.sin(6 * w))) if x >= 32 and y <= 21 else 0
    b = BOUNCE12[i % 12]
    arm = np.zeros((SH, SW), bool)                        # ausgestreckter Arm (Unterarm + Hand)
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        if x >= 18 and 12 <= y <= 17:
            arm[y, x] = True

    def dy(x, y):
        if arm[y, x]:                                    # zur Schulter hin Körper, zur Hand hin Streichbewegung
            t = min(1.0, max(0.0, (x - 17) / 4))
            return int(round(b * (1 - t) + stroke * t))
        return b if y < KNEE else 0
    out = np.zeros((H, W, 4), int)
    put(out, cat, PL, PT, dy_fn=lambda x, y: catdy(x, y) + tail(x, y))
    put(out, body, PL, PT, dy_fn=dy)
    if b < 0:
        for x in range(SW):
            if body[KNEE - 1, x, 3] and body[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = body[KNEE - 1, x]
    fill_pinholes(out)
    put(out, parts['fork'], PL, PT + b)                   # Mistgabel in der Hand: federt mit, ganz vorn
    return out


def f_santa(i):
    s = SRC.copy()
    cane = (s[:, :, 3] > 0) & (_xs <= 11) & (_ys <= 20)
    for (x, y), a in sweep(cane & np.array([[lum(s[y, x]) > 150 for x in range(SW)] for y in range(SH)]),
                           i, 8, speed=1.2).items():
        s[y, x] = lighten(s[y, x], a)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    stars(out, i, [(4 + PL, 6 + PT + b, 30)], 'ffe0e0', 'ffffff')
    return out


YELLOW = ('ffff7a', 'f6f675', 'eded71', 'f4f474', 'fefe79', 'ffffaf')


def bolt_in(out, mask, i, ox, oy, seed):
    """Kleine Blitze innerhalb von mask (Glasinneres): alle 2 Frames ein neuer Zickzack aus
    3-6 Pixeln (weißer Kern, gelbe Enden), manchmal Pause; nie außerhalb der Flasche."""
    rng = np.random.default_rng(seed * 1000 + i)
    if rng.random() < 0.1:
        return
    ys, xs = np.nonzero(mask)
    k = rng.integers(len(ys))
    x, y = int(xs[k]), int(ys[k])
    pts = [(x, y)]
    for _ in range(int(rng.integers(3, 7))):
        x += int(rng.choice([-1, 0, 1]))
        y += int(rng.choice([-1, 1]))
        if not (0 <= y < mask.shape[0] and 0 <= x < mask.shape[1] and mask[y, x]):
            break
        pts.append((x, y))
    for j, (x, y) in enumerate(pts):
        c = 'ffffff' if 0 < j < len(pts) - 1 else 'ffff7a'
        out[y + oy, x + ox] = rgb(c)


def glass_interior(comp):
    """Glasinneres: Blitz-(Gelb-)Pixel und halbtransparentes Glas."""
    return np.array([[comp[y, x, 3] > 0 and (hexc(comp[y, x]) in YELLOW or comp[y, x, 3] < 200)
                      for x in range(comp.shape[1])] for y in range(comp.shape[0])])


def f_alchemist(i):
    body = load('body')
    potion = load('potions' if V == 'saintnic' else 'flask')
    blink(body, i)
    comp = body.copy()
    m = potion[:, :, 3] > 0
    comp[m] = potion[m]
    inner = glass_interior(comp)
    if V == 'saintnic':                                  # rote Tränke: nur das Gelbe ist Blitz
        inner = np.array([[potion[y, x, 3] > 0 and (hexc(potion[y, x]) in YELLOW + ('691e1e', '8a2929', 'b93636'))
                           for x in range(SW)] for y in range(SH)])
    for y, x in zip(*np.nonzero(comp[:, :, 3])):          # Flasche leeren: Blitz raus
        if hexc(comp[y, x]) in YELLOW:
            comp[y, x] = rgb('8a2929') if V == 'saintnic' else rgb('d6deef', 150)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, comp, b)
    fill_pinholes(out)
    if V == 'saintnic':                                  # je Trank zwei eigene Blitze
        half = inner & (_xs < SW / 2)
        for sd in (1, 3):
            bolt_in(out, half, i, PL, PT + b, sd)
            bolt_in(out, inner & ~half, i, PL, PT + b, sd + 1)
    else:
        for sd in (1, 2, 3):
            bolt_in(out, inner, i, PL, PT + b, sd)
    return out


def f_stellan(i):
    s = SRC.copy()
    b = B24[i % 24]                                       # ruhiges Atmen
    ear_t = (i % 24) in (16, 17)                          # Ohrzucken ab und zu
    if V == 'stellan':
        ears = lambda x, y: (y <= 2 and (x <= 6 or x >= 11))
    else:
        ears = lambda x, y: (y <= 4 and (x <= 6 or x >= 12))
    dy = lambda x, y: (-1 if ear_t and ears(x, y) and x < SW / 2 else 0)
    out = np.zeros((H, W, 4), int)
    put(out, s, PL, PT, dy_fn=lambda x, y: (b if y < KNEE else 0))
    if ear_t:                                            # Ohr zuckt hoch: gedehnt, nicht abgelöst
        ear = s.copy()
        ear[~np.array([[ears(x, y) and x < SW / 2 for x in range(SW)] for y in range(SH)])] = 0
        put(out, ear, PL, PT, dy_fn=lambda x, y: b - 1)
    if b < 0:
        for x in range(SW):
            if s[KNEE - 1, x, 3] and s[KNEE, x, 3] and not out[KNEE - 1 + PT, x + PL, 3]:
                out[KNEE - 1 + PT, x + PL] = s[KNEE - 1, x]
    fill_pinholes(out)
    return out


FLAME_COLS = ('ca2c29', 'f47b22', 'f6e70e', 'f7f5b8')
STEAM_COLS = ('899ba7', 'bdc7cc', 'd8e3e9', 'e3eef5')
TAZ_EARS = {'tazune': [((11, 16), -1), ((24, 16), 1)], 'bakugo': [((11, 16), -1), ((24, 16), 1)]}


def live_flames(out, fx, fl, i, ox, oy):
    """Lodernde Flammen mit der Silhouette der Original-Flammen: jede Flammensäule (Lauf je
    Spalte) streckt und staucht sich mit eigener Welle (rückwärts abgetastet, der Fuß bleibt),
    die Zungen wiegen zur Spitze hin seitlich, die Farbstufen wogen nach oben; ab und zu löst
    sich über einer Spitze ein Flammenfetzen."""
    w = 2 * math.pi * i / N
    rank = {c: k for k, c in enumerate(FLAME_COLS)}
    for x in range(fl.shape[1]):
        ys = np.nonzero(fl[:, x])[0]
        if not len(ys):
            continue
        runs, start = [], ys[0]
        for a_, c_ in zip(ys, list(ys[1:]) + [None]):
            if c_ is None or c_ != a_ + 1:
                runs.append((start, a_))
                start = c_
        for top, base in runs:
            h0 = base - top + 1
            sc = 1 + 0.25 * math.sin(0.8 * x + 6 * w) + 0.12 * math.sin(1.9 * x - 4 * w)
            hh = h0 * sc
            for y in range(int(base - hh) - 1, base + 1):
                sy = int(round(base - (base - y) / sc))
                if sy < top or sy > base or not fl[sy, x]:
                    continue
                c = hexc(fx[sy, x])
                rel = (base - y) / max(1.0, hh)
                r = rank.get(c, 1) / 3 + 0.3 * math.sin(4 * w + 0.7 * y - 0.2 * x)
                col = FLAME_COLS[int(round(min(1.0, max(0.0, r)) * 3))]
                dx = int(round(0.9 * rel * math.sin(4 * w - 0.6 * y + 0.35 * x)))
                yy, xx = y + oy, x + dx + ox
                if 0 < yy < out.shape[0] - 1 and 0 < xx < out.shape[1] - 1:
                    out[yy, xx] = rgb(col)
            # Flammenfetzen reißt ab und steigt auf
            ph = (i + x * 5) % 12
            if h0 >= 3 and ph < 4 and math.sin(1.3 * x + 2.0) > 0.3:
                yy, xx = int(base - hh) - 2 - ph + oy, x + ox
                if 0 < yy < out.shape[0] - 1 and 0 < xx < out.shape[1] - 1 and not out[yy, xx, 3]:
                    out[yy, xx] = rgb('f47b22' if ph < 2 else 'ca2c29')


def ear_smoke(out, i, ears, ox, oy, strong):
    """Rauch aus den Ohren, kleinteilig: alle 2 Frames (beim Brüllen jeden Frame) puffen aus
    jedem Ohr einzelne Wölkchen, jedes mit eigener Richtung und eigenem Tempo; sie treiben nach
    außen und oben auseinander, blähen sich auf, werden grauer und blassen aus. Über allem."""
    H_, W_ = out.shape[:2]
    for (ex, ey), side in ears:
        for e in range(N):
            if e % 2 and not strong(e):
                continue
            rng = np.random.default_rng(e * 13 + (0 if side < 0 else 500))
            life = rng.uniform(8, 13)
            a = (i - e) % N
            if a >= life:
                continue
            u = a / life
            ang = rng.uniform(-0.45, 0.45)
            sp = rng.uniform(0.9, 1.4)
            vx = side * sp * math.cos(0.35 + ang)
            vy = -sp * math.sin(0.35 + ang)
            cx = ex + ox + side * 0.8 + vx * a + 0.5 * math.sin(a * 0.7 + e)
            cy = ey + oy - 0.5 + vy * a
            r = 0.5 + 1.3 * u ** 0.7
            col = STEAM_COLS[3 - min(3, int(u * 4))]
            alpha = int(235 * (1 - u) ** 0.5) + 15
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                for x in range(int(cx - r) - 1, int(cx + r) + 2):
                    if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and 0 < x < W_ - 1 and 0 < y < H_ - 1:
                        if not out[y, x, 3] or hexc(out[y, x]) not in STEAM_COLS or out[y, x, 3] < alpha:
                            out[y, x] = rgb(col, alpha)


def f_tazune(i):
    body, fx = load('body'), load('fx')
    fl = np.array([[fx[y, x, 3] > 0 and hexc(fx[y, x]) in FLAME_COLS for x in range(SW)] for y in range(SH)])
    stm = np.array([[fx[y, x, 3] > 0 and hexc(fx[y, x]) in STEAM_COLS for x in range(SW)] for y in range(SH)])
    if (i % 16) in (6, 7, 8, 9):                          # der offene Mund schließt sich kurz
        if V == 'tazune':
            for (x, y), c in {(17, 19): 'a90000', (18, 19): 'a90000',
                              (17, 20): 'e75b38', (18, 20): 'e75b38'}.items():
                body[y, x] = rgb(c)
        else:
            for (x, y), c in {(17, 18): 'ff2d2d', (18, 18): 'ff2d2d',          # Mund = nur die vier
                              (17, 19): 'a90000', (18, 19): 'a90000'}.items():    # mittleren Pixel
                body[y, x] = rgb(c)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, body, b)
    fill_pinholes(out)
    if V == 'tazune':                                     # das Feuer lodert über ihr (beim Skin entfällt es)
        live_flames(out, fx, fl, i, PL, PT + b)
    # Dampfwolken des Kartenbilds: in Frame 0 vollständig, lösen sich danach in Fetzen auf (die nach
    # außen und oben wegtreiben) und bauen sich zum Loop-Ende wieder auf
    f = 1.0 if i == 0 else max(0.0, 1 - i / 9) if i < 24 else max(0.0, (i - 38) / 10)
    for y, x in zip(*np.nonzero(stm)):
        hsh = 0.5 + 0.25 * math.sin(0.9 * x + 1.3 * y) + 0.25 * math.sin(0.55 * x - 0.8 * y + 1.0)   # Fetzen statt Raster
        if hsh >= f:
            continue
        side = -1 if x < SW / 2 else 1
        d = int(round((1 - f) * 2.5))
        yy, xx = y + PT + b - d, x + PL + side * d
        a = int(255 * (0.55 + 0.45 * f))
        if 0 < yy < H - 1 and 0 < xx < W - 1:
            out[yy, xx] = rgb(hexc(fx[y, x]), a)
    # Rauch aus den Ohren – über allem
    ear_smoke(out, i, TAZ_EARS[V], PL, PT + b, lambda e: False)
    return out


# --- Etappe 5 -------------------------------------------------------------------
def warp(s, mask, dfn, margin=4):
    """Teil (mask) rückwärts abbilden: Ausgabepixel p nimmt das Quellpixel p - d(p) mit ganzzahligem
    d – keine Löcher, nichts wird neu gerastert (nur Blockverschiebungen mit Nähten).
    Liefert ein Bild in Sprite-Koordinaten, ringsum um margin erweitert."""
    h, w = s.shape[:2]
    out = np.zeros((h + 2 * margin, w + 2 * margin, 4), int)
    for yo in range(-margin, h + margin):
        for xo in range(-margin, w + margin):
            dx, dy = dfn(xo, yo)
            x, y = xo - dx, yo - dy
            if 0 <= x < w and 0 <= y < h and mask[y, x]:
                out[yo + margin, xo + margin] = s[y, x]
    return out


def put_m(out, img, ox, oy, margin=4):
    put(out, img, ox - margin, oy - margin)


def row_remap(s, off):
    """Zeilen verschieben (off(y) = ganzzahliger Versatz der Quellzeile y); wo eine Lücke aufreißt,
    wird die Quellzeile darunter wiederholt (nur wo darüber und darunter Pixel sind)."""
    h, w = s.shape[:2]
    m = 4
    out = np.zeros((h + 2 * m, w, 4), int)
    filled = np.zeros(h + 2 * m, bool)
    pos = [y + off(y) for y in range(h)]
    for y in range(h):
        out[pos[y] + m] = np.where(s[y, :, 3:4] > 0, s[y], out[pos[y] + m])
        filled[pos[y] + m] = True
    for y in range(1, h):
        for g in range(pos[y - 1] + 1, pos[y]):          # Lücke zwischen den Zeilen y-1 und y
            both = (s[y - 1, :, 3] > 0) & (s[y, :, 3] > 0)
            out[g + m][both] = s[y][both]
    return out, m


# Zi: der blaue Dschinn schwebt, der Umhang wogt majestätisch (Welle von oben nach unten, der Saum
# kräuselt sich nach außen), viele Glitzersterne
ZI_CAPE = ('04304a', '096ca4', '1e7ebd', '1582d5')
ZI_STARS = [(1, 2, 0), (23, 3, 5), (3, 16, 10), (22, 17, 15), (0, 23, 20), (24, 24, 25), (4, 6, 30), (21, 8, 35),
            (-2, 12, 40), (27, 13, 44), (4, 28, 3), (20, 28, 13), (0, 27, 23), (25, 27, 33), (12, 28, 42),
            (-3, 5, 18), (28, 6, 28), (-3, 19, 8), (28, 21, 38)]


def f_zi(i):
    s = SRC.copy()
    op = s[:, :, 3] > 0
    cape = op & (_ys >= 13) & np.array([[hexc(s[y, x]) in ZI_CAPE for x in range(SW)] for y in range(SH)])
    w = 2 * math.pi * 2 * i / N - 0.9                    # der Umhang hängt dem Schweben nach
    cx = 12.5

    def d(x, y):
        t = min(1.0, max(0.0, (y - 13) / 14)) ** 1.2
        side = -1 if x < cx else 1
        w0 = -0.9                                        # Frame 0 = Ruhepose
        dx = side * int(round(1.6 * t * (math.cos(w0 - 0.55 * y) - math.cos(w - 0.55 * y)) / 2))
        dy = int(round(1.3 * t * (math.sin(w - 0.6 * abs(x - cx)) - math.sin(w0 - 0.6 * abs(x - cx)))))
        return dx, dy
    hv = int(round(2 * math.sin(2 * math.pi * i / N)))  # schwebt langsam auf und ab
    body = s.copy()
    body[cape] = 0
    out = np.zeros((H, W, 4), int)
    inner = cape & (np.abs(_xs - cx) <= 7)               # am Körper: Original darunter (keine Lücken)
    put(out, np.where(inner[:, :, None], s, 0), PL, PT - hv)
    put_m(out, warp(s, cape, d), PL, PT - hv)
    put(out, body, PL, PT - hv)
    fill_pinholes(out)
    stars(out, i, [(x + PL, y + PT - hv, st) for x, y, st in ZI_STARS], 'c8f8ff', 'ffffff', only_empty=True)
    return out


# Waflav brüllt: Anlauf (Kopf duckt sich, das Maul schließt sich), dann reißt der Oberkiefer auf
# (die Zeile unter den oberen Reißzähnen wird wiederholt: dunkler Rachen), die Augen glühen
WAF_ROAR = {17: -1, 18: -1, 19: 1, 20: 2, 21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3, 27: 3, 28: 3, 29: 3,
            30: 3, 31: 2, 32: 1}


def f_waflav(i):
    s = SRC.copy()
    o = WAF_ROAR.get(i, 0)
    if o >= 2:
        fl = 1.0 if i % 4 < 2 else 0.6
        for y, x in zip(*np.nonzero(s[:, :, 3])):
            if hexc(s[y, x]) == 'e62931':
                s[y, x] = lighten([255, 70, 40, 255], 0.5 * fl)
    b = B24[i % 24] if not o else -1
    img, m = row_remap(s, lambda y: (b if y < 17 else 0) - (o if y <= 6 else 0))
    out = np.zeros((H, W, 4), int)
    put(out, img, PL, PT - m)
    fill_pinholes(out)
    return out


def f_bounce_blink(i):
    """Wahflav, Ash (Barker), Zetsu (Kyli): federn, blinzeln; Zetsus Fliegenfallen-Blätter atmen."""
    s = SRC.copy()
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    if V == 'zetsu':                                     # die Blätter öffnen sich (Zeilen 4-12 nach außen)
        leaf = (s[:, :, 3] > 0) & ((_xs <= 2) | (_xs >= SW - 3)) & (_ys >= 3) & (_ys <= 13)
        o = 1 if 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N) > 0.5 else 0

        def d(x, y):
            if o and 4 <= y <= 12:
                return (-1 if x < SW / 2 else 1), 0
            return 0, 0
        img = warp(s, leaf, d)
        body = s.copy()
        body[leaf] = 0
        # was das Blatt beim Öffnen freigibt: die Spalte daneben wird gedehnt
        if o:
            for y in range(4, 13):
                for x in (2, SW - 3):
                    if not img[y + 4, x + 4, 3]:
                        img[y + 4, x + 4] = s[y, x]
        body[img[4:4 + SH, 4:4 + SW, 3] > 0] = 0
        whole = np.zeros_like(s)
        whole[:] = body
        m = img[4:4 + SH, 4:4 + SW, 3] > 0
        whole[m] = img[4:4 + SH, 4:4 + SW][m]
        side = img.copy()
        side[4:4 + SH, 4:4 + SW] = 0
        knee_put(out, whole, b)
        put_m(out, side, PL, PT + b)
    else:
        knee_put(out, s, b)
    fill_pinholes(out)
    return out


def f_xal(i):
    """Xal / Alchemic Xal: atmet (1 px), der Umhang weht leicht nach außen (Welle von oben nach
    unten, das Original bleibt darunter liegen), die Augen glühen."""
    s = SRC.copy()
    if V == 'xal':
        eye = glow_eye(s, i, ('ff111c', 'bc000d'))
        cols, y0, xl, xr = ('39090c', 'a51a22', '7b0815', '852323', 'f63342'), 11, 6, SW - 7
    else:
        f = eye_f(i)
        for y, x in zip(*np.nonzero(s[:, :, 3])):
            if y < 12 and hexc(s[y, x]) in ('9a9b98', 'fefffc'):
                s[y, x] = lighten(s[y, x] if hexc(s[y, x]) == 'fefffc' else rgb('9fd8e6'), 0.6 * f)
        eye = []
        cols, y0, xl, xr = ('050921', '6e7589', '96a1bb'), 13, 3, SW - 4
    cape = (s[:, :, 3] > 0) & (_ys >= y0) & ((_xs <= xl) | (_xs >= xr)) & np.array(
        [[hexc(s[y, x]) in cols for x in range(SW)] for y in range(SH)])
    w = 2 * math.pi * 2 * i / N

    def d(x, y):
        t = min(1.0, max(0.0, (y - y0) / (SH - y0)))
        side = -1 if x < SW / 2 else 1
        return side * int(round(1.4 * t * (math.cos(-0.5 * y) - math.cos(w - 0.5 * y)) / 2)), 0
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)                                  # Original (samt Umhang) darunter
    body = s.copy()
    body[cape] = 0
    img = warp(s, cape, d)
    top = img.copy()
    top[KNEE + 4:] = 0
    bot = img.copy()
    bot[:KNEE + 4] = 0
    put_m(out, top, PL, PT + b)
    put_m(out, bot, PL, PT)
    knee_put(out, body, b)
    fill_pinholes(out)
    if eye:
        glow_halo(out, i, eye, PL, PT + b)
    return out


# Octo-Alleria: die acht Tentakel bewegen sich einzeln – ein glattes Verschiebungsfeld (je Tentakel
# ein Winkelbereich um den Körper mit eigener Phase, zur Spitze hin stärker, als Welle entlang des
# Arms), rückwärts und ganzzahlig abgebildet; der Körper atmet, sie blinzelt
OCTO_C = (16.5, 11.0)
OCTO_ARMS = [(math.radians(a), ph) for a, ph in ((100, 0.0), (130, 2.1), (160, 4.0), (190, 1.2))] + \
            [(math.radians(180 - a), ph) for a, ph in ((100, 3.3), (130, 5.3), (160, 0.9), (190, 2.8))]


def octo_d(i):
    w = 2 * math.pi * 2 * i / N

    def d(x, y):
        rx, ry = x - OCTO_C[0], y - OCTO_C[1]
        r = math.hypot(rx, ry)
        u = min(1.0, max(0.0, (r - 6) / 14)) ** 1.2
        if u == 0:
            return 0, 0
        th = math.atan2(ry, rx) % (2 * math.pi)
        tan = sw = rad = 0.0
        for a, ph in OCTO_ARMS:
            da = (th - a + math.pi) % (2 * math.pi) - math.pi
            g = math.exp(-(da / 0.28) ** 2)
            sw += g
            tan += g * (math.sin(w + ph - 0.3 * r) - math.sin(ph - 0.3 * r))   # Frame 0 = Ruhepose
            rad += g * (math.cos(w + ph) - math.cos(ph))
        if sw < 1e-6:
            return 0, 0
        tan, rad = 0.8 * u * tan / sw, 0.35 * u * rad / sw
        ux, uy = rx / r, ry / r
        return int(round(-uy * tan + ux * rad)), int(round(ux * tan + uy * rad))
    return d


def f_octo(i):
    s = SRC.copy()
    blink(s, i)
    tent = (s[:, :, 3] > 0) & ((_ys >= 15) | ((_ys >= 13) & (np.abs(_xs - OCTO_C[0]) > 8)))
    body = s.copy()
    body[tent] = 0
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    put_m(out, warp(s, tent, octo_d(i)), PL, PT)
    put(out, body, PL, PT + b)
    if b < 0:                                            # Körper hebt sich: unterste Körperzeile dehnen
        for x in range(SW):
            if body[14, x, 3] and not out[14 + PT, x + PL, 3]:
                out[14 + PT, x + PL] = body[14, x]
    fill_pinholes(out)
    return out


def f_dreemurr(i):
    s = SRC.copy()
    blink(s, i)
    b = BOUNCE12[i % 12]
    out = np.zeros((H, W, 4), int)
    knee_put(out, s, b)
    fill_pinholes(out)
    # Blut rinnt von der Messerspitze links an der Klinge herab (Spalte 1, Zeile 11 → 14), verschwindet
    # unter der Faust und tropft vom Knauf (1, 19) zu Boden (Zeile 25)
    for t0 in (2, 26):
        t = (i - t0) % N
        if t < 8:
            y = 11 + t // 2
            out[y + PT + b, 1 + PL] = BLOOD[1] if t % 2 else BLOOD[2]
        elif 11 <= t < 30:
            draw_px(out, drop_pixels(t - 11, 1 + PL, 19 + PT + (b if t < 15 else 0), 25 + PT))
    return out


FRAME = dict(asriel=f_asriel, barker=f_barker, blackstache=f_blackstache, chuck=f_chuck, codumbus=f_codumbus,
             devlin=f_devlin, mmdevlin=f_devlin, enigma=f_enigma, krates=f_krates, key=f_key, kyli=f_kyli, alleria=f_alleria,
             brackle=f_brackle, leonardo=f_brackle, broghan=f_broghan, golem=f_golem,
             clown=f_clown, bbg=f_bbg, fern=f_fern, fernelf=f_fern, fairy=f_fairy, fiona=f_fiona,
             boarding=f_gabbyrope, chosen=f_gabbyrope, zombie=f_zombie, moon=f_moon, garius=f_garius,
             vader=f_vader, gobbo=f_gobbo, hatusbal=f_hatusbal, jack=f_hatusbal, hulijing=f_hulijing,
             ingo=f_ingo, eingo=f_eingo, madame=f_madame, marianne=f_marianne, santa=f_santa,
             nicolas=f_alchemist, edward=f_alchemist, saintnic=f_alchemist, stellan=f_stellan, bunny=f_stellan,
             tazune=f_tazune, bakugo=f_tazune, zi=f_zi, waflav=f_waflav, wahflav=f_bounce_blink,
             ash=f_bounce_blink, zetsu=f_bounce_blink, xal=f_xal, axal=f_xal, octo=f_octo, dreemurr=f_dreemurr)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
