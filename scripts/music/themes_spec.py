# -*- coding: utf-8 -*-
"""Vorgaben der Archetyp-Themes: (Archetyp laut cards.json, Slug, Titel, Vorgabe).

Slug = Teil des Dateinamens: public/music/bgm_theme_<slug>.ogg, Track-ID `theme_<slug>`.
Aus dieser Liste entstehen data/battle-tracks.json (Namen für die Auswahl) und die
Kompositionsaufträge. Die Vorgabe ist ein Anstoß — die Karten des Archetyps
(data/cards.json) liefern das eigentliche Flair.
"""
THEMES = [
 ('Future Tech', 'futuretech', 'Prototype Protocol', 'Cyberpunk-/Industrial-Labor: kalte Synths, Sequenzer-Bass, maschinelle Präzision, Alarm-Signale; 148 BPM, d-Moll oder fis-Moll.'),
 ('Deepsea', 'deepsea', 'Lullaby of the Abyss', 'KLASSISCHER HORROR: verstimmte Spieluhr (glock/celesta-artig), tiefe Orgel, gleitende Streicher-Cluster, langsam lauernder Puls mit plötzlichen Schocks; Clown-Motiv als schiefer Jahrmarkt-Walzer im Hintergrund; ~104 BPM, Tritonus und kleine Sekunden. Trotzdem Kampf: Pauken/Toms treiben.'),
 ('Pollution', 'pollution', 'Acid Rain Requiem', 'Giftige Industrie-Ödnis: schmutziger Saw-Bass, hämmernde Fabrik-Rhythmen, säuerliche Dissonanzen, Sirenen, Sci-Fi-Pads; ~132 BPM, verschmutzt/heruntergekommen, aber mit trauriger Melodie darüber.'),
 ('Cute', 'cute', 'Sugar Rush Showdown', 'Kawaii-Chiptune-Kampf: hüpfende Square-/Glockenspiel-Melodie, Pizzicato, Xylophon, quietschig-süß, dabei hohes Tempo (~168 BPM) und trotzdem echter Beat; Dur, überdreht.'),
 ('Cool', 'cool', 'Too Cool to Lose', 'Funk/Acid-Jazz-Battle: Slap-Bass-Groove (bass/sbass), Wah-artige Clean-Gitarre, Sax-Riffs, Bläser-Stabs, lässige Überlegenheit; ~112 BPM mit Swing/16tel-Funk, e-Moll/dorisch.'),
 ('Skeletons', 'skeletons', 'Dance of Dry Bones', 'Danse macabre im Kampf: klappernde Xylophon-Knochen, Pizzicato, Geige-Solo, Moll-Walzer-Feeling im 4/4-Gewand (Triolen-Swing), Grabesglocke, ~126 BPM; makaber-verspielt.'),
 ('Chess', 'chess', 'Checkmate Gambit', 'Großmeister-Duell: Cembalo/Klavier, Kontrapunkt (Schwarz/Weiß = zwei Stimmen im Dialog), tickende Schachuhr (Wood Block/Marimba), strenge Streicher; ~120 BPM, d-Moll, kalte Berechnung mit dramatischen Zügen.'),
 ('Guardian Beasts', 'guardianbeasts', 'Temple Guardians\' Oath', 'Chinesische Tempelwächter: Pentatonik, Taiko/Toms, Dan Tranh/Koto, Gong-artige Bell-Schläge, Dudelsack-/Sheng-Farbe (bagpipe sparsam), würdevoll und wuchtig; ~118 BPM.'),
 ('Mischief Militia', 'mischiefmilitia', 'Frostbite Foolery', 'Freche Winterarmee: schräger Kinder-Marsch mit Glöckchen (glock), Tuba-Oompah, Piccolo/Flöte, Kazoo-artige Clarinet, Schneekanonen-Hits; ~138 BPM, verschmitzt aber militärisch organisiert.'),
 ('Spiders', 'spiders', 'The Weaver\'s Web', 'Lauernde Spinnenjagd: flirrende Tremolo-Streicher, huschende Pizzicato-16tel (Beine), Fäden aus Harfen-Glissandi, Königin-Motiv tief in Fagott/Kontrabass; ~136 BPM, phrygisch, klaustrophobisch.'),
 ('Slimes', 'slimes', 'Gelatinous Groove', 'Glibbrig-hüpfender Kampf: wabbelnder Synth-Bass (acidbass/sbass), blubbernde Marimba, Fifths-Lead, springender Beat mit Elektro-Toms; ~124 BPM, verspielt aber drückend.'),
 ('Idej', 'idej', 'Way of the Blade', 'Samurai-Duell: Taiko-Toms, Koto, Shakuhachi (flute/whistle), Hira-joshi-Tonleiter, viel Stille und plötzliche Schwertschläge (Snare-Hits/hit), Fluss aus Ruhe und Angriff; ~110 BPM.'),
 ('Crystals', 'crystals', 'Shards of Radiance', 'Funkelnde Kristallmagie: Glockenspiel/Vibraphon/Crystal-Arpeggien, hoher Chor, Harfen, strahlendes Dur/lydisch, Grinsekatze-Verspieltheit als schräger Nebenton; ~144 BPM.'),
 ('Dream Landers', 'dreamlanders', 'Lucid Collision', 'Traumwelt-Kampf: schwebende Pads (newage/halo), verzerrte Rückwärts-Effekte (Reverse-Cymbal), unerwartete Taktwechsel-Gefühle (Betonungsverschiebung im 4/4), surreal, Moll/Dur-Kippen; ~120 BPM.'),
 ('Rebelliokai', 'rebelliokai', 'Yokai Uprising', 'Japanische Yokai-Rebellion: Matsuri-Festival-Energie, Taiko-Toms, Shamisen (koto/guitar), Flöten, Kappa-Tanz, Kitsune-Läufe, Yo-Tonleiter; ~150 BPM, wild und maskenhaft.'),
 ('Gigantisaurs', 'gigantisaurs', 'Stampede of Giants', 'Dinosaurier-Ansturm: gewaltige Toms/Timpani-Stampfen, Tuba/Posaune/Fagott-Brüller, primitive Ostinati, Erdbeben-Bass (contra); ~100 BPM, schwer und massiv, halbzeit-Feel mit Wucht.'),
 ('Cosmic Depths', 'cosmicdepths', 'Whispers Beyond the Void', 'Kosmischer Horror/Science-Fiction: Echoes/Atmos/Scifi-Drones, pulsierende Sub-Basslinie, fremdartige Ganzton-Motive, langsam wachsende Bedrohung durch etwas Unbegreifliches; ~96 BPM (Half-Time-Wucht), leere Weite.'),
 ('Arrows', 'arrows', 'The Archer\'s Journey', 'HELDENREISE: beginnt mit einsamer Flöte/Horn, wächst zu einer weiten, gallopierenden Abenteuer-Hymne (Streicher, Horn, Harfe, Pauken), Aufbruch – Prüfung – Triumph als Dramaturgie; Dur/mixolydisch, ~132 BPM.'),
 ('Harpyformers', 'harpyformers', 'Harpy Jam Session', 'Die Harpyformer sind eine Band mit den Genres Ballad, Classical, Country, Grunge, Metal: der Track wandert zwischen diesen Stilen (Klavier-Ballade, Streicher-Klassik, Country-Twang/Gitarre/Harmonica, Grunge-Riff, Metal-Galopp) mit gemeinsamem Motiv; ~130 BPM.'),
 ('Hell Circles', 'hellcircles', 'Descent Through Nine Circles', 'Dantes Abstieg: absteigende chromatische Linien, Pfeifenorgel, Chor, Glocken, jeder Abschnitt tiefer/finsterer, Schreie in Streicher-Glissandi; ~112 BPM, f-Moll, infernalisch-feierlich.'),
 ('Loyals', 'loyals', 'Faithful to the End', 'Treue Hunde: warmherziger, mutiger Marsch mit Akkordeon, Gitarre, Pfeifen, Streichern, Bellen-Rhythmen (Toms/Pizzicato); heroisch-warm, Dur, ~128 BPM, Loyalität bis zum Schluss.'),
 ('Slippery', 'slippery', 'Slip \'n\' Slide Showdown', 'Eis und Pinguine: glasklare Vibraphon/Glocken, Schlittschuh-Walzer-Schwung im 4/4 (Triolen), Schlittenglöckchen, rutschende Glissandi, hüpfende Bässe; ~140 BPM, frostig-verspielt.'),
 ('Soul Shards', 'soulshards', 'Weighing of the Souls', 'Altägyptische Seelenlehre (Ba, Ka, Ren, Sah, Ib, Khet): phrygisch-dominant (Harmonisch Moll), Sistrum/Toms-Rhythmen, Oboe/Klarinette-Melodie, Chor, Zeremonie; ~116 BPM, mystisch-rituell.'),
 ('PACMAN', 'pacman', 'Curse of the Dunes', 'Wüste, Mumien, Kakteen, Sandgräber (lies die Karten für den Sinn von PACMAN): arabisch-phrygische Skala, Darbuka-artige Toms, Oboe/Sax-Melodie, Verfolgungsjagd-Gefühl im Sand; ~134 BPM.'),
 ('Doom Clock', 'doomclock', 'The Jaguar\'s Countdown', 'Aztekischer Krieg gegen die Zeit: Ticken der Uhr (Wood Block/Marimba), Kriegstrommeln, Flöten-/Okarina-Rufe, unerbittlich beschleunigender Countdown, Jaguar-Prowl; ~128 BPM, d-Moll.'),
 ('Race Boats', 'raceboats', 'Regatta Rush', 'Bootsrennen: Seemannslied-Shanty im Kampftempo (~158 BPM), Akkordeon, Fiddle, Ruder-Rhythmus in Toms, Wellenbewegung, Zielgeraden-Steigerung; Dur, fröhlich-hektisch.'),
 ('Drago', 'drago', 'Dragoneer\'s Ascent', 'Drachenreiter: weite, aufsteigende Fantasy-Fanfare, Hörner, Pauken, Chor, Feuer-Läufe in Trompete/Brass, Flügelschlag-Ostinato; ~136 BPM, d-Mixolydisch, majestätisch und feurig.'),
 ('Chaorcs', 'chaorcs', 'Calamitusk\'s Rampage', 'Chaotischer Orkkrieg: primitive Trommeln, schepperndes Blech (Tuba/Posaune), Rockorgel/verzerrte Gitarre-Riffs, Gebrüll-Chöre (choir tief), bewusst schief-brutal, Kanonen (Timpani/Hit); ~146 BPM.'),
 ('War Counselors', 'warcounselors', 'Council of War', 'Antike griechische Stadtstaaten: Aulos-artige Oboe/Flöte, Lyra (Harfe), Marschtrommeln, Phalanx-Rhythmen, Strategie-Rat-Würde, dorisch/phrygisch; ~122 BPM.'),
 ('Puppets', 'puppets', 'Strings of Fate', 'Marionettentheater: klimpernde Spieluhr/Cembalo/Celesta-artige Klänge, ruckartige Streicher, Kinder-Lied-Melodie im Moll, Fäden-Zupfen (Pizzicato/Harfe), unheimlich-verspielt; ~118 BPM, abgehackte Rhythmik.'),
 ('Cybug', 'cybug', 'Chrome Swarm', 'Cybernetische Insekten: Sägezahn-Schwarm, Bitcrush-artige Square-Läufe, schnelle robotische 16tel-Sequenzen, metallischer Beat, Summen als Modulation; ~156 BPM, kalt-elektronisch (NICHT organisch – das ist Sparkfly).'),
 ('Lunatic', 'lunatic', 'Moonstruck Madness', 'Mondphasen-Wahnsinn: Zyklus in Abschnitten (Neumond leise → Vollmond ekstatisch), Walzer-artiger 3+3+2-Swing, Theremin-artige Synth-Stimme (fifths/synvoice), Wolfsheulen in Streichern, Kirchenglocke; ~130 BPM, fahl und wahnsinnig.'),
 ('Monkees', 'monkees', 'Banana Brawl', 'Dschungel-Chaos: Bongo/Tom-Grooves, Marimba/Xylophon-Geplapper, freches Sax/Posaune, Funk-Bass, Affenschrei-Läufe (flute/whistle), NFT/Kriminelle als ironische Ganoven-Zitate; ~144 BPM.'),
 ('Debt-O-Tron', 'debtotron', 'Interest Rate Inferno', 'Habgierige Inkasso-Roboter: mechanischer Büro-Marsch, Kassen-/Münzklänge (Marimba, Cowbell, Glocken), Sequenzer, bedrohliche Firmen-Fanfare in Brass, bürokratisch-kalt; ~140 BPM, gnadenlos getaktet.'),
 ('Paraseed', 'paraseed', 'Spore Symphony', 'Verseuchte Botanik: wuchernde, organische Ostinati (Marimba/Kalimba/Harfe), feuchte Bässe, Zombie-Chor, Sporenwolken in Pads, schleichende Ansteckung – jede Wiederholung bekommt eine Stimme mehr; ~120 BPM.'),
 ('Bomblebees', 'bomblebees', 'Buzzbomb Blitz', 'Bienenbomber: rasende Hummelflug-Läufe (Violine/Klarinette/Saw), Sturzflug-Glissandi, Bomben-Einschläge (Timpani/Hit/Kick), Lunte brennt (steigendes Ticken); ~172 BPM, hektisch-explosiv.'),
 ('Waflav', 'waflav', 'Shapeshifter\'s Fury', 'Gestaltwandelndes Monster mit fünf Elementen (Wasser, Feuer, Sturm, Sumpf, Donner): der Track verwandelt sich Abschnitt für Abschnitt (Tonart/Klangfarbe/Rhythmus je Element) um ein durchgehendes Bassmotiv; ~130 BPM.'),
 ('Spices', 'spices', 'Spice Bazaar Standoff', 'Orientalischer Gewürzbasar-Kampf (Zamorin, Spice Rajah): Sitar-artige Gitarre/Koto, Tabla-Toms, Doppel-Harmonisch-Skala, Oboe/Sax-Schlangenbeschwörer, Marktgewusel, würzige Steigerung; ~138 BPM.'),
 ('Steam Dwarfs', 'steamdwarfs', 'Boiler Room Brawl', 'Steampunk-Zwergenwerkstatt: Kolben-/Zahnrad-Rhythmen (Wood Block/Toms/Snare-Shuffle), Akkordeon, Blech, keltisch-zwergische Melodie, Dampfpfeifen (whistle), Hammerschläge; ~126 BPM, e-Moll dorisch, schwer schuftend.'),
 ('Trials', 'trials', 'The Final Trial', 'Zeremonielle Prüfung/Gauntlet: feierliche Hörner, Chor, Prüfungs-Fanfaren, Steigerung durch immer schwerere Ebenen (6 Prüfungen = 6 Abschnitte), Ernst und Würde, große Pauken; ~124 BPM, Es-Dur/c-Moll.'),
 ('Cycling Demons', 'cyclingdemons', 'Infernal Carousel', 'Fünf Dämonen im Kreislauf: unheimlicher Karussell-/Orgel-Walzer im Kampftempo, drehende Ostinato-Zyklen die sich verschieben (Polyrhythmus), Rockorgel, Kirchenglocken, dämonischer Chor; ~132 BPM, Moll.'),
 ('Elven', 'elven', 'Song of the Silverwood', 'Elfenwald: elegante Flöte/Oboe/Harfe, Chor-Oohs, fließende Bogenmelodien, leichtfüßiger Galopp (Streicher-Pizzicato), Bogenschützen-Rhythmen; ~140 BPM, lydisch/D-Dur, anmutig aber schnell und gefährlich.'),
 ('Tuscan', 'tuscan', 'Duel in Tusca', 'Italienische Renaissance: Tarantella-Rhythmus (6/8-Gefühl als Triolen), Mandoline (guitar/pizz), Cembalo, Streicher, Adelsintrigen, Kunst und Mystik; ~150 BPM, a-Moll/A-Dur-Wechsel, theatralisch.'),
 ('Sparkfly', 'sparkfly', 'The Hive Awakens', 'INSEKTENNEST: organisches, wärmeres Summen (Bowed/Warm/Tremolo, Harmonica/Accordion-Schwärme), funkelnde Funken (Crystal/Glock), Bauarbeiter-Ostinato, Königin-Fanfare, Schwarm-Crescendi; ~124 BPM. Anders als Cybug (kalt-robotisch) ist dies lebendig und wachsend.'),
 ('Bonded Companions', 'bondedcompanions', 'Bonds Unbroken', 'Band der Freundschaft: emotionale, weit tragende Heldenhymne (Streicher, Horn, Klavier, Chor), Motive der vier Gefährten die sich zu einem vereinen (Kanon), Tränen und Entschlossenheit; ~126 BPM, B-Dur/g-Moll.'),
 ('Greatmaw', 'greatmaw', 'Jaws of the Deep', 'Hai-Jagd + Sirenengesang: kreisendes Cello-Ostinato (contra/violin tief, Jaws-artige Halbton-Pulse), anschwellende Angriffe, Sirenen-Stimme (synvoice/oohs), Blechschläge; ~118 BPM. Räuberisch statt Horror (Deepsea ist Horror).'),
 ('Cardinal Beasts', 'cardinalbeasts', 'Four Winds Convergence', 'Vier Himmelsbestien (Baihu, Qinglong, Xuanwu, Zhuque): vier Abschnitte je eigenes Element/Himmelsrichtung (Metall/Holz/Wasser/Feuer) über gemeinsamem majestätischem Thema, chinesische Pentatonik, Gongs, Erhu-artige Violine, Chor; ~112 BPM.'),
 ('Fun-Fun Circus', 'funfuncircus', 'Big Top Bedlam', 'Zirkus außer Kontrolle: Calliope-Orgel, Tuba-Oompah, Piccolo, Xylophon, Zirkusdirektor-Fanfare, halsbrecherischer Galopp im 4/4 (Can-Can-artig) mit Clown-Slapstick-Stopps; ~176 BPM. Muss klar anders klingen als battle10 (Schelmenstück, g-Moll-Swing).'),
]
# Eigene Titel für Helden-Themes (bgm_<slug>.ogg, Slug = Heldenname ohne Titel). Ohne Eintrag
# heißt ein Helden-Theme in der Auswahl „<Held>'s Theme“.
HERO_TITLES = {
    'chaosdiamond': ('Chaos-Diamond, the Cracked Keeper', 'Critical Meltdown'),
    'bubbles': ('Bubbles, the Bouncy Bunny', 'Big Bunny Bounce'),
    'damus': ('Damus, the Prophet of Apocalypse', 'The Hour of Ashes'),
}

# Skill Test (bis zu 8 Spieler, zufällige Layouts): fünf gleichwertige Kampfmusiken `bgm_skilltest1…5.ogg`,
# je Partie zufällig gewählt (BGM_SETS in public/app-main.jsx). Der Modus muss nur `gs.isSkillTest = true` setzen.
SKILLTEST_TITLES = {
    'skilltest1': 'Eight-Way Scramble', 'skilltest2': 'Randomized Reality', 'skilltest3': 'Dice of Destiny',
    'skilltest4': 'Last Seat Standing', 'skilltest5': 'Pandemonium Protocol',
}

if __name__ == '__main__':
    import json, os
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
    # Namen für die Auswahl (Laufzeit) — zusammen mit den benannten Allgemein-Tracks
    out = {'generic': {'battle1': 'First Blood', 'battle2': 'Shadow Duel', 'battle3': 'Full Tilt', 'battle4': 'Heroic Charge', 'battle5': 'Dark Cathedral', 'battle6': 'Cyber Chase',
                       'battle7': 'Arena Rock', 'battle8': 'Mystic Grove', 'battle9': 'Epic Finale',
                       'battle10': "Trickster's Game"},
           'cpu': {slug: title for slug, (_, title) in HERO_TITLES.items()},
           'themes': [{'id': 'theme_' + s, 'name': t, 'archetype': a} for a, s, t, _ in THEMES]}
    with open(os.path.join(root, 'data', 'battle-tracks.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2); f.write('\n')
    print(len(THEMES), 'Themes')
