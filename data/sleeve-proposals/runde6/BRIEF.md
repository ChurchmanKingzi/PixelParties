# Auftrag: CPU-Gegner-Sleeves für Pixel Parties (Runde 6, 44 Stück)

Jeder CPU-Gegner (= ein Sample-/Structure-Deck in /home/user/PixelParties/data/SampleDecks/) bekommt eine
**eigene, einzigartige Sleeve**, die der Spieler freischaltet, wenn er diesen Gegner fünfmal besiegt. Die Sleeve ist
also eine Trophäe: Man soll auf den ersten Blick erkennen, **welcher Gegner** das ist.

Es gelten ALLE Regeln aus `../runde4/BRIEF.md` (bitte vollständig lesen: nur vorhandene Grafik, Effekte selbst
zeichnen, kein Text, einheitliche Pixelgröße je Tiefenebene, vollständige Figuren, korrekte Positionierung/Logik,
ausgewogene Komposition, Transparenz/Fäden, Rahmenzone ~22 px frei, Abwechslung, Werkzeuge) und die Helden-Regeln
aus `../runde5/BRIEF.md`. Abweichungen/Ergänzungen unten gehen vor.

## Gegner-Regeln (VERBINDLICH)
1. **Hauptmotiv ist der Gegner-Charakter** = der mittlere Held des Decks (Spalte „Held“ unten; er ist im Spiel
   Porträt, Name und Stimme des Gegners). **Immer die Base-Version** des Helden – keine Ascended-Heroes, keine Skins,
   keine Umfärbungen/Kostüme/Varianten. Maßgeblich ist das Kartenbild der Base-Heldenkarte in
   /home/user/PixelParties/cards/<Name>.png (Heldenkarten: Bild etwa in x 100–650, y 130–590; `findcards.py` findet
   sie nicht immer – dann über Ebenennamen/Farben/`scenes_with` suchen). Den Helden pixelgenau vollständig aus den
   xcf-Ebenen zusammensetzen (Waffen, Umhänge, Effekte, Accessoires der Base-Karte gehören dazu) und gegen die
   „Sichtbar“-Szene seiner Karte prüfen. Groß und präsent (typisch 4×–6×), klar lesbar.
2. **Deck-Thema zeigen:** Umgebung, Requisiten und Nebenfiguren erzählen vom Deck – Cover-Karte (Spalte „Cover“),
   typische Karten der Deckliste (`data/SampleDecks/<Datei>.txt`, Kartentexte in data/cards.json), die Heimat/Welt
   des Helden. Die beiden anderen Helden des Decks dürfen als Nebenfiguren vorkommen (kleiner/weiter hinten, NICHT
   gleich groß neben dem Hauptmotiv) – müssen aber nicht.
3. **Stil des Nutzers respektieren:** Der Nutzer mag es, wenn vorhandene Kartenszenen/Sprites klug kombiniert und
   ergänzt werden. Selbst gezeichnete Ergänzungen (Wolken, Effekte, Böden) sparsam, schlicht und in Palette und
   Pixelgröße der umgebenden Grafik – verworfene Beispiele: eine selbst gemalte Tornado-„Mutterwolke“, die stilistisch
   nicht zum Tornado-Sprite passte; eine selbst gezeichnete Abgasflamme an Monias Füßen, die wie ein Raketenantrieb
   an den Füßen aussah; Bäume, die über der Horizontlinie schwebten statt auf dem Boden zu stehen. Keine Effekte
   an Stellen, an denen die Figur laut Kartenbild keine hat.
4. **Keine Doppelungen**, weder mit Shop-Sleeves noch untereinander. Aktuelle Shop-Namen: All-Seeing, Angel's Mirror, Autumn Tiger, Balloon Drift, Bamboo Sentinel, Birthday Wish, Black Tortoise, Blood Eclipse, Bone Wyrm, Breaking Free, Buried Giant, Class Photo, Close Encounter, Coolness Race, Count of the Deep, Cracked Keeper, Cybug Case, Cycling Demons, Deepsea Awakening, Detective Board, Divine Balance, Djinn's Lamp, Dolls in the Dark, Dragon's Hoard, Dwarf King, Earthrise, Ember Hooves, End of the Rainbow, Exploding Skull, Feathered Serpent, Fire and Storm, First Snowfall, Fox Pond, Frost Nest, Frozen Throne, Fun-Fun Circus, Garden of Gold, Gigantisaur Comic, Glacier Vault, Guardian Zodiac, Harvest Dusk, Heart Bow, Heart of the Hive, Heavenly Throne, Into the Deep, King of Kings, Kitten Escort, Ladder to the Sky, Last Round, Lava Diver, Life Serum, Loan Shark, Luau, Lunar New Year, Lure of the Abyss, Mimic's Lure, Night Watch, Nile Night, Odd One Out, Open Lead, Pharaoh's Tomb, Pixel Parties, Porthole, Projection, Puppet Theater, Rain Singer, Raise the Minions, Rise of the Phoenix, Root of All Presents, Rotten Mastermind, Siren's Song, Skulltop Storm, Slime Drive, Spider Nest, Spring Thunder, Stargazer, Steam Crest, Stormdraw, Summer Blaze, Sword in the Stone, T-Rex Breach, The Summoning, Threads of Fate, Trident Shrine, Trojan Gift, Under the Bed, Vanitas, Vials on the Vine, Weapon Storm, White Parade, Wingshadow, World on a Shell, Yokai Parade, Poison Dream, Pride of Diamond.
   Achtung, zu einigen Helden gibt es schon Sleeves – dann eine deutlich ANDERE Bildidee: Champion („Stormdraw“:
   Champion mit Karten im Tornado), Mini („Kitten Escort“: Mini vor Herz mit Katzen), Alice („Dolls in the Dark“),
   Broghan („Glacier Vault“), Kyli („Vials on the Vine“), Monia („Coolness Race“), Cooldin/Wowhalla („Wowhalla“ ist
   nicht mehr im Shop, trotzdem kein Hallen-Motiv), Blackstache („Wanted“), Siphem/Cthulhu („Deepsea Awakening“),
   Teppes („Count of the Deep“), Victorica? (prüfen), Argos („The Eye Sees You“ verworfen, trotzdem kein reines
   Riesenauge). Ausgereizte Motivtypen wie in Runde 4 (Konzert/Bühne, Bibliothek, Blutmond, Tierkreis, Pentagramm,
   Waage, Wanted-Plakat, Tarot, Spinnennetz). **Trage deine Ideen zuerst in `runde6/concepts.md` ein** (eine Zeile je
   Idee: `NN | Name | Idee`) und lies vorher, was die anderen eingetragen haben.
5. Abwechslung innerhalb deines Blocks: Porträt, Action-Szene, Ruhemoment, Blick durch Fenster, Silhouette, Draufsicht,
   Schaukasten … Kein Schema „Held mittig vor Hintergrund“ für alle.

## Gegnerliste (NN | Deck-ID | Gegner | Held = Hauptmotiv | weitere Helden | Cover-Karte)
01 | `sample-Heal Burn` | Heal Burn | **Nao, the Barrier Priestess** | Kazena, the Storming Rebel; Treasure Huntress Semi | Nao, the Barrier Priestess
02 | `sample-Suicide Bombers` | Suicide Bombers | **Bomb Berserker Bartas** | Ida, the Adept of Destruction; Treasure Huntress Semi | –
03 | `sample-Venom Swamp` | Venom Swamp | **Zsos'Ssar, the Serpent Warlord** | Medea, the Swamp Witch; Fiona, the Princess of Blackport | Poisoned Well
04 | `sample-Structure Deck Bamboo Warrior` | Bamboo Warrior | **Xiong, the Bamboo Guardian** | Cute Nerd Magenta; Nicolas, the Hidden Alchemist | Bamboo Staff
05 | `sample-Structure Deck Big Stomp` | Big Stomp! | **Kit, the Shark Researcher** | Güldefaber, the King of Dwarfs; Alex, Trainer of Heroes | Gigantisaur Chimera
06 | `sample-Structure Deck Bloody King Zi` | Bloody King Zi | **Timeless King Zi** | Cooldin, King of Coolness; Kazena, the Storming Rebel | Blood Rock
07 | `sample-Structure Deck Bone Rush` | Bone Rush | **Vacarn, the Dark Goblin Necromancer** | Cute Nerd Magenta; Alice, the Puppeteer Girl | Skeleton Necromancer
08 | `sample-Structure Deck Boom Boom Kaboom` | Boom Boom Kaboom! | **Andras, the Human Weapon** | Alex, Trainer of Heroes; Kazena, the Storming Rebel | Bomb Berserker Bartas
09 | `sample-Structure Deck Burning Inferno` | Burning Inferno | **Luna Pele, the Flame Dancer** | Alex, Trainer of Heroes; Barker, the Monster Tamer | Luna Kiai
10 | `sample-Structure Deck Cool Gang` | Cool Gang | **Thorad, Strength of Coolness** | Cooldin, King of Coolness; Freshya, Beauty of Coolness | Wowhalla, the Hall of the Cool
11 | `sample-Structure Deck Creepy Crawlies` | Creepy Crawlies | **Alleria, the Queen of Spiders** | Cooldin, King of Coolness; Alice, the Puppeteer Girl | Spider Hive
12 | `sample-Structure Deck Crystal Gifts` | Crystal Gifts | **Mary Crestmas** | Cooldin, King of Coolness; Arthor, the King of Blackport | Crystal Well
13 | `sample-Structure Deck Cute Commando` | Cute Commando | **Cute Annoyance Mini** | Visionary Genius Heinz; Cool Rescuer Monia | Cute Phoenix
14 | `sample-Structure Deck Dance of the Butterflies` | Dance of the Butterflies | **Beato, the Butterfly Witch** | Elana, the Rocky Rebel; Willy, the Valiant Leprechaun | Beato, the Eternal Butterfly
15 | `sample-Structure Deck Deepsea Terror` | Deepsea Terror | **Siphem, the Deepsea Demon** | Teppes, the Deepsea Vampire; Barker, the Monster Tamer | Siphem, the Deepsea Demon
16 | `sample-Structure Deck Depths of the Cosmos` | Depths of the Cosmos | **Argos, the Eye of the Cosmos** | Blackstache, Scourge of the Pixel Seas; Cooldin, King of Coolness | The Cosmic Depths
17 | `sample-Structure Deck Elven Vanguard` | Elven Vanguard | **Maya, the Nature Fairy** | Barker, the Monster Tamer; Tharx, the Never-Losing General | Elven Leader
18 | `sample-Structure Deck Flying Sparks` | Flying Sparks | **Lilly, the Charming Infiltrator** | Enigma, the Seller of Secrets; Alice, the Puppeteer Girl | Sparkfly Queen
19 | `sample-Structure Deck Gates to Hell` | Gates to Hell | **Silent Water Mizune** | Nicolas, the Hidden Alchemist; Treasure Huntress Semi | Demon's Gate
20 | `sample-Structure Deck Gather That Storm` | Gather That Storm! | **Tarleinn the Traveler** | Nicolas, the Hidden Alchemist; Treasure Huntress Semi | Gathering Storm
21 | `sample-Structure Deck Great Weapon Master` | Great Weapon Master | **Toras, Master of all Weapons** | Arthor, the King of Blackport; Fiona, the Princess of Blackport | Toras, Master of all Weapons
22 | `sample-Structure Deck Guardians of the Treasure Cave` | Guardians of the Treasure Cave | **Mao, the Vengeful Guardian** | Cooldin, King of Coolness; Alice, the Puppeteer Girl | Guardian Beast Zhu
23 | `sample-Structure Deck Hellfire Battery` | Hellfire Battery | **Baaliel, the Demon General** | Tempeste, the Weather Fairy; Thalia, the Fun Fairy | Horned Demon
24 | `sample-Structure Deck Idej Illusions` | Idej Illusions | **Idej Lord Daiyo** | Lizbeth, the Reaper of the Light; Elana, the Rocky Rebel | Idej Sword - Kogarasu
25 | `sample-Structure Deck Join our Cult` | Join our Cult! | **Klaus, the Cult Leader** | Tharx, the Never-Losing General; Ingo, Investor of Evil | Klaus, the Cult Leader
26 | `sample-Structure Deck Lightning Caller` | Lightning Caller | **Sol Rym, the Thunder Djinn** | Fiona, the Princess of Blackport; Nicolas, the Hidden Alchemist | Chain Lightning
27 | `sample-Structure Deck Mans Best Friends` | Man's Best Friends | **Orthos, the Loyal Guard Dog** | Ingo, Investor of Evil; Alice, the Puppeteer Girl | Loyal Pinpom
28 | `sample-Structure Deck Mawstruck` | Mawstruck | **Nero Zira, the Mastermind** | Ingo, Investor of Evil; Cool Rescuer Monia | Infected Greatmaw
29 | `sample-Structure Deck Morph and Kill` | Morph and Kill! | **Waflav, the Metamorphing Monstrosity** | Alice, the Puppeteer Girl; Cooldin, King of Coolness | Stormkissed Waflav
30 | `sample-Structure Deck Null and Void` | Null and Void | **Null, the Mage Slayer** | Luna Pele, the Flame Dancer; Elana, the Rocky Rebel | Stranglehold
31 | `sample-Structure Deck One-Two-Punch` | One-Two-Punch! | **Ghuanjun, the Undead Martial Artist** | Bill, the Angry Auctioneer; Elana, the Rocky Rebel | Ghuanjun, the Undead Martial Artist
32 | `sample-Structure Deck Parts of the Soul` | Parts of the Soul | **Thep, the Court Scribe** | Cute Nerd Magenta; Alice, the Puppeteer Girl | Soul Shard Sekhem
33 | `sample-Structure Deck Pew-Pew` | Pew-Pew! | **Bow Sniper Darge** | Kazena, the Storming Rebel; Treasure Huntress Semi | Angelfeather Arrow
34 | `sample-Structure Deck Poison Torture` | Poison Torture | **Reiza, the Chief Tormentor** | Fiona, the Princess of Blackport; Medea, the Swamp Witch | Reiza, the Chief Tormentor
35 | `sample-Structure Deck Sacrificial Demons` | Sacrificial Demons | **Calamitusk, the Chaorc War Chief** | Elana, the Rocky Rebel; Asriel, the Sapling Sacrificer | Asriel, the Sapling Sacrificer
36 | `sample-Structure Deck Shadows over Blackport` | Shadows over Blackport | **Arthor, the King of Blackport** | Bill, the Angry Auctioneer; Jenny, the Class Fairy | Arthor, Inheritor of the Barbarian Sword
37 | `sample-Structure Deck Shifting Sandlands` | Shifting Sandlands | **Bakhm, the Desert Digger** | Nomu, Wanderer of Worlds; Silent Water Mizune | Pure Advantage Camel
38 | `sample-Structure Deck Slimy Infestation` | Slimy Infestation | **Stellan, the Calm Cat** | Alice, the Puppeteer Girl; Barker, the Monster Tamer | Slime Rancher
39 | `sample-Structure Deck Slip n Slide` | Slip 'n Slide | **Hel, the Bound Specter** | Cooldin, King of Coolness; Ingo, Investor of Evil | Slippery Whoolmoth
40 | `sample-Structure Deck Spell Industrialization` | Spell Industrialization | **Victorica, the Eternal Empress** | Cooldin, King of Coolness; Ingo, Investor of Evil | Pollution Token
41 | `sample-Structure Deck Steam Dwarf Mines` | Steam Dwarf Mines | **Layn, Defender of Deri** | Cute Nerd Magenta; Alice, the Puppeteer Girl | Steam Dwarf Dragon Pilot
42 | `sample-Structure Deck Sun Fencer Frenzy` | Sun Fencer Frenzy | **Taio, the Sun Fencer** | Kazena, the Storming Rebel; Bill, the Angry Auctioneer | Taio, Absorber of the Mountain's Heart
43 | `sample-Structure Deck To Attain Divinity` | To Attain Divinity | **Archibald, the Archmage** | Barker, the Monster Tamer; Kazena, the Storming Rebel | Divinity
44 | `sample-Structure Deck_ Grand Rebellion` | Grand Rebellion! | **Champion, the Stormbringer** | Johanna, Crusader of Light; Cute Nerd Magenta | Rebelliokai Courtly Kirin

## Werkzeuge
Wie Runde 4, aber alles unter `runde6/`: Skripte in `runde6/generator/` mit `from common import *` (Sprite-Cache
`runde6/generator/sprites6/`, `save(cv, 'NN_name.png')` schreibt nach `runde6/`). Sprite-Keys mit Präfix `oNN_`.
Kontaktbögen aller Ebenen: /tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/cat/.
Karten in Szenen finden: `python3 /home/user/sprites_export/findcards.py <Datei> "<Kartenname>" …`
(zuerst die wahrscheinlichen xcf-Dateien probieren; Zuordnung Karte→Datei teils in /home/user/sprites_export/match_*.tsv).
Vorschau mit Rahmen: `sys.path.insert(0, '../../runde3/generator'); import frames2 as F;
F.apply('../NN_name.png', '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/x.png', 'ornate', 'gold', 'ruby')`.
**Jedes Sleeve mit dem Read-Tool ansehen (auch gerahmt) und mindestens einmal verbessern.**

## Ablieferung
- Pro Sleeve: `runde6/NN_kurzname.png` (750×1050, OHNE Rahmen) und `runde6/generator/sNN_kurzname.py`
  (reproduzierbar; Docstring nennt Gegner, Held, xcf-Dateien/Ebenen/Karten und die Skalierung jeder Tiefenebene).
- `runde6/notes_<Block>.md`: je Sleeve eine Zeile
  `NN | English Name | Gegner | Held | Idee | Skalierung | Quellen | Rahmen: form/palette/stein[/stein2]`.
  English Name: kurz, stimmungsvoll, ohne Nummer, keine Dopplung mit Shop-Namen oder anderen Einträgen.
  Rahmen-Bauformen: ornate, double, twist, industrial, arch, icicle, bamboo, moulding, card, bone, cosmic, meander,
  wave, stone, filigree. Paletten: gold, bronze, silver, lacquer, ebony, bamboo, brass, sea, wood, stone, iron, ice,
  gothic, cosmic, bone. Steine: ruby, emerald, sapphire, amethyst, amber, jade, pearl, topaz, rose, onyx, lava,
  cyan, lime, magenta.
- **Keine git-Befehle**, keine Dateien außerhalb von runde6/ ändern, fremde Dateien nicht anfassen (andere Agenten
  arbeiten parallel; concepts.md nur um eigene Zeilen ergänzen).
