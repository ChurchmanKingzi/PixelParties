#!/usr/bin/env node
'use strict';
// Setzt in data/cards.json `skilltestLegal: false` für Karten, die im Skill Test
// (N Spieler, kein „der Gegner") vorerst nicht sinnvoll funktionieren, und schreibt
// die Begründungen nach docs/skilltest-illegal-cards.md. Idempotent; arbeitet auf
// dem Rohtext (kleiner Diff). Spätere Freigabe: Feld in cards.json wieder auf true.
//
//   node scripts/curate-skilltest-legal.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'cards.json');
const DOC = path.join(__dirname, '..', 'docs', 'skilltest-illegal-cards.md');

const cardsAll = JSON.parse(fs.readFileSync(FILE, { encoding: 'utf-8' }));
const futureTech = cardsAll.filter(c => (c.archetype || '') === 'Future Tech').map(c => c.name);

// Von Hand gesperrte Gruppen (Begründung → Karten).
const GROUPS = [
  { why: 'Sofortiger Spielsieg („You win the game“) ohne passende Wertung bei mehreren Spielern. (Die vier Cardinal Beasts sind NICHT gesperrt: je Partie fehlt eine zufällige von ihnen, siehe CONFIG.CARDINAL_BEASTS — so sind nie alle vier gleichzeitig im Spiel.)',
    cards: ['The Final Trial', 'Carris, the Time Keeper'] },
  { why: 'Doom-Clock-Familie: leitet Sieger/Verlierer als „der andere Spieler“ ab (`winnerIdx = byPi === 0 ? 1 : 0`); mit mehr als zwei Sitzen ist der Verlierer nicht gleich „Spielende“.',
    cards: ['Doom Clock', 'Doom Prophecy', 'Basketskull', 'Ferocious Jaguar Warrior', 'Swift Eagle Warrior', 'Warrior of Teocuilatl'] },
  { why: 'Zählen/löschen aus BEIDEN Ablagen (`players[0]` / `players[1]`): mit mehr als zwei Sitzen unvollständig, die Auswahl über alle Ablagen braucht eine eigene Oberfläche.',
    cards: ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu', 'Guardian Beast Ji', 'Guardian Beast Long', 'Guardian Beast Ma', 'Guardian Beast Niu', 'Guardian Beast She', 'Guardian Beast Shu', 'Guardian Beast Tu', 'Guardian Beast Yang', 'Guardian Beast Zhu', 'Mao, the Vengeful Guardian'] },
  { why: 'Curse: setzt die ATK des Ziels auf 0 — ein Held ohne Angriff kann in diesem Modus nichts mehr bewirken und führt zu unschönen, kaum lösbaren Lagen.',
    cards: ['Curse'] },
  { why: 'Gorinthian War Counselor: betäubt ein Ziel für 2 Turns und setzt allen Schaden an ihm auf 0; wird der Stun vor dem Ablauf erneuert (in Skill-Test-Rounds immer möglich), heilt das Ziel nie, und der eingebaute Schutz „Immune nach Ablauf des Stuns" greift nie — der letzte Gegner ist dauerhaft gesperrt, die Partie endet nie (Nachttraining, Seed 233).',
    cards: ['Gorinthian War Counselor'] },
  { why: 'Tri Ad und Tri Fecta (Puppet Mistress / Puppet Master): Tri Fecta spawnt zu Spielbeginn Puppet-Tokens in seine Support Zones (geteilter HP-Pool, sonst keine Karten dort erlaubt), Tri Ad darf kein Start-Hero sein und stapelt sich auf Tri Fecta — das ist im Skill Test nicht abgebildet (auf Wunsch aus dem Pool genommen).',
    cards: ['Tri Ad, the Puppet Mistress', 'Tri Fecta, the Puppet Master'] },
  { why: 'Reine Zieh-/Such-Karten: ihre einzigen Effekte sind Ziehen, Suchen, Tutoren oder „oberste Karten aufdecken und auf die Hand nehmen“. Der Skill Test hat kein Deck, die Karten wären wirkungslos (oder schaden, z. B. „Hand ablegen und gleich viele ziehen“). Erkannt über die Zieh-/Such-Sperren der Engine (`blockedByHandLock`, `blockedByDrawLock`, `blockedBySearchLock`) und über den Zieh-Block-Helfer (Wheels, Haste, …), von Hand geprüft. NICHT gesperrt: Karten, die auch etwas anderes bewirken, sowie reine Ablage-Rückholer (Shooting Star, Boomerang, Relic in the Sky, Magic Sapphire, Elixir of Mana, Shard of Chaos, Spontaneous Reappearance …) — die Ablage gibt es im Skill Test.',
    cards: [
      // per Sperr-Flag erkannt (Hand-/Zieh-/Such-Sperre)
      'Alchemic Journal', 'Angry Cheese', 'Aurora Borealis', 'Bifab, Bridge to Coolness', 'Birthday Present', 'Brainstorming',
      'Brilliant Idea', 'Cool Cheese', 'Cute Cheese', 'Cuteness Sensor', 'Divine Gift of Creation', 'Graveyard Gathering',
      'Heart of Cards', 'Holy Cheese', 'Idol of Crestina', 'Magic Lamp', 'Magnetic Glove',
      'Magnetic Potion', 'Mass Multiplication', 'Navigation', 'Nerdy Cheese', 'Perilous Journey', "Philosopher's Stone", 'Potion of Greed',
      'Sickly Cheese', 'Tanuki Escape', 'Teleportal', 'The Sacred Jewel',
      'The Sacred Mirror', 'Trial of Loyalty',
      // ohne Flag, aber ebenfalls nur Ziehen/Suchen
      'Voice in your Head', 'Glimpse of the Future', 'Grasp the Future', 'Prophecy of Coolness', 'Cool Rescue',
      'Pawn Sacrifice', 'Mystery Box', 'Glass of Marbles', 'Divine Gift of Balance', 'Divine Gift of Edge', 'Crushing Defeat',
      'Unlikely Encounter', 'Spatial Crevice', 'Premonition', 'Inventing', 'Luck', 'Amazing Finding', 'Draw',
      'Deepsea Treasure', 'Charm of Balance', 'Prayer', "Smuggler's Pier", 'Spider Silk Bridge',
      'Cell Escape', 'Infiltration', 'Spice Mortar', 'Salute to the Fallen', 'Crystal Well', 'Pillar of Light', "Tarleinn's Floating Island",
      'Temple of Sacrifice', 'Snake Race Boat', 'Rain Viola', 'Lunatic Cycle - New Moon', 'Bow of the Hunt Goddess',
    ] },
  { why: 'Coolness-Stack-Karten: wirken nur aus dem Coolness Stack („This card has no effect, unless you play it from your Coolness Stack“) oder verlangen dessen Inhalt. Der Skill Test hat keinen Coolness Stack (in 6 Probepartien an allen 24 Sitzen immer leer) — die Karten sind unspielbar (Nachttraining: 0 % Nutzung bei 80–165 behaltenen Exemplaren je Karte).',
    cards: ['Coolness Overcharge', 'Glorious Rebirth', 'String of Fine', 'Modnir, Hammer of Coolness', 'Swellpnir, Mount of Coolness', 'Ragnarock'] },
  { why: 'Deckbau-Regelkarten („Für je 2 Exemplare in deinem Deck darf dein Deck …“, „Hast du 4 Exemplare in deinem Deck …“): ihre einzige Wirkung ist eine Deckbau-Regel; der Skill Test hat kein Deck.',
    cards: ['Secret Blue Spice', 'Secret Golden Spice', 'Secret Green Spice', 'Secret Red Spice', 'Secret Spice Jar', 'The Sacred Blade'] },
  { why: 'Karten, deren Wirkung aus dem Deck kommt (Suchen, Aufdecken, Karte aus dem Deck ausrüsten/beschwören): der Skill Test hat kein Deck, die Karten sind wirkungslos oder kosten nur (Opfer, Zugende). In den Probepartien nie erfolgreich ausspielbar, im Nachttraining 0–2 % Nutzung.',
    cards: ['Arrival from the Cosmic Depths', 'Create Illusion', 'Living Illusion', 'Surprise Party', 'Overcharge', 'Ladder to the Sky', "Treasure Hunter's Backpack", 'The Eye of Ren', 'Muscle Training', 'Lesson in the Arts', 'Kitsune Transformation', 'Ultimate Weapon Experiment'] },
  { why: 'Karten für Ascended Heroes (im Skill Test gesperrt): ohne Ascended Hero auf dem Brett oder in der Hand haben sie kein Ziel.',
    cards: ['Audience with a hostile King', 'Open Invitation'] },
  { why: 'Helden mit Spielbeginn-Effekt vor dem Ziehen der Starthand („At the start of the game, before both players draw their starting hands …“): Bill (Artifacts aus dem Deck ausrüsten), Hel (Artifact aus dem Deck ausrüsten), Sid (Deck des Gegners ansehen), Kassaran (drei Kartennamen erklären). Der Skill Test hat weder Deck noch Starthand-Ziehen — auf Wunsch aus dem Pool genommen. (Die Idej Lords haben denselben Text, bekommen ihre Karten aber über die Spawn-Regel.)',
    cards: ['Bill, the Angry Auctioneer', 'Hel, the Bound Specter', 'Sid, the King of Thieves', 'Kassaran, Seer of Everything'] },
  { why: 'Anti Magic Enchantment: Anhänger-Zauber, der „sofort beim Ausrüsten eines Artifacts durch einen Pollution Token“ gespielt werden muss und sonst nichts bewirkt — im Skill Test praktisch nie spielbar (Nachttraining: 0 % Nutzung bei 52 behaltenen Exemplaren). Auf Wunsch aus dem Pool genommen.',
    cards: ['Anti Magic Enchantment'] },
  { why: 'Hat of Madness: „Whenever the equipped Hero performs an Action, its controller must add a card from their hand to their opponent\'s hand“ — mit mehr als zwei Sitzen gibt es nicht DEN Gegner, an den die Karte geht. Auf Wunsch aus dem Pool genommen.',
    cards: ['Hat of Madness'] },
  { why: 'Idej Projection: kann nur durch den Effekt der Idej Lords an einen Hero gehängt werden („by its own effect“). Im Skill Test spawnen die Lords ihre Projections jetzt beim Aufstellen selbst (siehe skilltest/README.md); als Handkarte wäre sie ein Fremdkörper.',
    cards: ['Idej Projection'] },
  { why: 'Bottom-100-Auswertung (docs/skilltest-bottom100.md), vom Nutzer am 7.10. aussortiert: schwache Standalone-Karten ohne brauchbare Wirkung im Modus. Behalten wurden Flame Arrow, Cardinal Beast Baihu, Moonlight Butterfly, Greatmaw Shark, Soul Shard Sekhem, Deepsea Werewolf, Fireball, Iceage und Forbidden Curse of Aging.',
    cards: ['500 Piranhas in a Monster Suit', 'Paraseed', 'Golden Exploding Skull', 'Stowaway', 'Plant Golem', 'Jumpscare', 'Dream Dust', 'Market Crash', 'The Stormblade',
      'Magic Mirror', 'Afflicted Vermin', 'Soul Shard Ren', 'Ellie, the Class President', 'The Fourth Circle of Hell', 'Tuscan Prisoner', 'Slippery Pengu', 'Adventurousness',
      'Shapeshift', 'Cosmic Malfunction', 'Bamboo Staff', "Cottage at the Forest's Edge", 'Elven Forager', 'Wowhalla, the Hall of the Cool'] },
  { why: 'Alle Karten, die den Coolness Stack ausdrücklich referenzieren (Nutzer 7.10.): der Skill Test hat keinen Coolness Stack.',
    cards: ['Freshya, Beauty of Coolness', 'Hipdall, Protector of Coolness', 'Lolki, Trickstar of Coolness', 'Phatnir, Prototype of Coolness', 'Swagdri, Forger of Coolness',
      'The Nornstellar, Foretellers of Coolness', 'Thrysh, Robber of Coolness', 'Wildur, the Shining Coolness', 'Wowkyrie, Bringer of Coolness',
      'Yolomungandr, Ender of Coolness'] },
  { why: 'Crystals (Nutzer 7.10.): Artefakte, die nur als aufgedeckte Handkarte wirken und beim Ausspielen nichts tun.',
    cards: ['Mana Absorbing Crystal', 'Weakening Crystal', 'Distracting Crystal', 'Rusting Crystal', 'Treacherous Crystal'] },
  { why: 'Debt-O-Tron (Nutzer 7.10.): brauchen negatives Gold bzw. erlauben das Ausspielen ohne Gold — im Modus nicht erreichbar.',
    cards: ['Debt-O-Tron Damage Fees', 'Debt-O-Tron Model Backup Duplicator', 'Debt-O-Tron Model Loan Shredder', 'Debt-O-Tron Model Missing Parts', 'Debt-O-Tron Model Money Printer', 'Debt-O-Tron Model Scrap Plow'] },
  { why: 'Reine Discard-Karten (Nutzer 7.10.): „This card has no effect when you play it from your hand“, wirken nur beim Abwerfen.',
    cards: ['Skull Necklace', 'Letter of Misinformations'] },
  { why: 'Sparkflies (Nutzer 7.10.): die Königin ist nur über Hive\'s Crown beschwörbar, der Rest hängt an ihr bzw. an Deck-Suche.',
    cards: ["Hive's Crown", 'Sparkfly Architect', 'Sparkfly Attendant', 'Sparkfly Queen', 'Sparkfly Worker'] },
  { why: 'Monkees (Nutzer 7.10.): bis auf Cheeky Monkee (macht Schaden) gesperrt — sie hängen an Gold-Gewinn-Ereignissen.',
    cards: ['Golden Bananas', 'Nimble Monkee', 'Resilient Monkee', 'Criminal Monkee', 'Non-Fungible Monkee'] },
  { why: 'Crusader-Waffen (Nutzer 7.10.): nur für Cecilia ausrüstbar.',
    cards: ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"] },
  { why: 'Lunatic (Nutzer 7.10.): Hawk und Golem raus. Half/Gibbous/Full Moon sind wieder frei (8.10.): in der Vorbereitung lassen sie sich bedingungslos ausrüsten, auch ohne die gesperrten New/Crescent Moon.',
    cards: ['Lunatic Hawk', 'Lunatic Golem'] },
  { why: 'Archetyp „of Kings“ (Chess), komplett inklusive beider Kasperovs (Nutzer 7.10.).',
    cards: ['Bishop of Kings [B]', 'Bishop of Kings [W]', 'Board of Kings', 'Castling', 'Kasperov, the King of Kings [B]', 'Kasperov, the King of Kings [W]', 'Knight of Kings [W]', 'Knight of Kings [B]',
      'Pawn Chain', 'Pawn of Kings [B]', 'Pawn of Kings [W]', 'Queen of Kings [B]', 'Queen of Kings [W]', 'Rook of Kings [B]', 'Rook of Kings [W]'] },
  { why: 'Alles mit Ascension (Nutzer 8.10.): Ascended Heroes sind im Skill Test gesperrt, diese Karten setzen einen Ascended Hero voraus oder lösen eine Ascension aus.',
    cards: ['Disgruntled Forest Warden', 'Divine Awakening', 'Smugness', 'Trident Spirit - Hammer Absorbed'] },
  { why: 'Dragsparov, the King of Dragons: hat keinen Karteneffekt-Skript (kein Anlegen möglich) und sein Partner Kasperov ist mit „of Kings“ gesperrt.',
    cards: ['Dragsparov, the King of Dragons'] },
  { why: 'Bloom, the Maniacal Botanist (Nutzer 8.10.): lebt von Paraseed, einer rein schädlichen Karte, die man dem Gegner geben müsste — im Skill Test kaum spielbar.',
    cards: ['Bloom, the Maniacal Botanist'] },
  { why: 'Hell Circles (Nutzer 8.10.): die „Circles of Hell“-Kette aus Areas wird im Skill Test nicht gebraucht.',
    cards: ['The First Circle of Hell', 'The Second Circle of Hell', 'The Third Circle of Hell', 'The Fifth Circle of Hell', 'The Sixth Circle of Hell', 'The Seventh Circle of Hell', 'The Eighth Circle of Hell'] },
  { why: 'Bonded Companions (Nutzer 8.10.).',
    cards: ['Bonded Companion Humby', 'Bonded Companion Mellvy', 'Bonded Companion Orphy', 'Bonded Companion Thuly'] },
  { why: 'Chaos-Diamond, the Cracked Keeper (Nutzer 8.10.).',
    cards: ['Chaos-Diamond, the Cracked Keeper'] },
  { why: 'Reaktionen mit extrem engen, seltenen oder unwahrscheinlichen Bedingungen (Nutzer 7.10., nach eigenem Ermessen): hängen an bestimmten Karten/Archetypen, am Deck, an Surprises, Freeze, Ascend, Heldenstufen oder Sonderlagen, die im Skill Test praktisch nie eintreten.',
    cards: [
      // an bestimmte Karten / Archetypen gebunden
      'Arrow Slit', 'Bomblebee Cluster', 'Burning Fuse', 'Chaorc Interception', 'Cosmic Manipulation', 'Paraseed Control', 'Paraseed Zombie', 'Rebelliokai Courtly Kirin', 'Idej Projector',
      'Elven Rider', 'Old Couple', 'First Contact', 'Wendy, the Shy Girl', 'Deepsea Encounter', 'Deepsea Spores',
      // Deck-Bezug
      'Homecoming', 'No Retreat!', 'Troop Annihilation', 'Anti Intruder System',
      // Surprise / Reaction / Potion des Gegners
      'Local Idol', 'Boots of Hermes', 'See through the Ruse', 'Teleport', 'Front Soldier', 'Cute Camera', 'Sinister Idol', 'Blessing of the Sun', 'Balloons', 'Unguarded Gate',
      // Heldenstufen / Sonderbedingungen
      'Cheat Chair', 'Fans in High Positions', 'Accidental Dodge', 'Test Flight', 'Anti Magic Shield', 'Stubborn Getaway', 'REVENGE!!!', 'Drowned Remains', 'Strong Shield', 'Homerun!',
      // Freeze / Ascend / Wiederbelebung / Kontrollwechsel
      'Sculpture Guards', 'Sculpture Theft', 'The Melting', 'Trample Sounds in the Forest', 'Triumphant Return', 'Very Special Prisoner', 'Rescue Mission', 'Explosion Toss', 'Gigantisaur Skull',
      // Hand-/Zieh-Eingriffe des Gegners, Selbstziel-Karten, Sonderlagen
      'Ambush the Scout', 'Control Monitors', 'Vampire on Fire', 'Furious Anger', 'Point-Blank Annihilation', 'Dream World Switcheroo', 'Flesh-Eating Swarm Trap', 'Party Crasher',
      'Inverted Levitation', 'Enhanced Guard Dog',
    ] },
  { why: 'Search-Karten (Nutzer 8.10.): Karten, deren Effekt ausdrücklich ein Suchen im Deck ist („search your deck for …“) — Spider Dance, Masterpiece, Aufdeck-/Such-Creatures wie die zehn Harpyformer, Hell Fox, Pinaxolotl, The Egg of God und Helden, deren Effekt das Suchen ist (Alex, Garius, Madaga, Monsieur Pete, Sabrina, Cute Annoyance Mini). Der Skill Test hat kein Deck, das Suchen findet nie etwas. NICHT gesperrt: die Idej Lords (ihr Paket kommt über die Spawn-Regel), Karten, die Suchen nur einschränken oder verändern (Krates, Koperniko, Cats of the Pharaoh, Cybug BEE).',
    cards: [
      'Alex, Trainer of Heroes', 'Cute Annoyance Mini', 'Garius, the Great Reformer', 'Madaga, the Forsaken Seafarer', 'Monsieur Pete, the Booty Raider',
      'Sabrina, the Psychic Witch', 'Aquanian Orkallion', 'Ballad Harpyformer', 'Classical Harpyformer', 'Country Harpyformer', 'Grunge Harpyformer',
      'Harpyformer Choir', 'Metal Harpyformer', 'Rap Harpyformer', 'Shanty Harpyformer', 'Ska Harpyformer', 'Techno Harpyformer', 'Box Spider', 'Cute Dog',
      'Deepsea Witch', 'Elusive Hind', 'Hell Fox', 'Life-Searcher from the Cosmic Depths', 'Loyal Shepherd', 'Motharch Squire', 'Pinaxolotl',
      'Rebelliokai Camouflaged Kappa', 'Soul Shard Ka', 'Steam Dwarf Diver', 'Tamed Hell Fox', 'The Egg of God', 'Masterpiece', 'Spider Dance',
      'The Cosmic Depths',
    ] },
  { why: 'Reine Mill-Karten (Nutzer 8.10.): ihr Effekt ist ausschließlich, Karten vom Deck in die Ablage zu schicken (Pillage, Dead Guardian, Magic Emerald, Gravedigger\'s Shovel, Sky Shaman, Cute Nerd Magenta, Jean, Cute Cat, Gravedigger). Der Skill Test hat kein Deck. NICHT gesperrt: Karten, die nur nebenbei mill’en (Deepsea Skeleton, Guardian\'s Appearance, Soul Shard Shut, Codumbus) und Trade (löscht oberste Karten nur als Preis für Gold).',
    cards: ['Pillage', 'Dead Guardian', 'Magic Emerald', "Gravedigger's Shovel", 'Sky Shaman', 'Cute Nerd Magenta', 'Jean, the Pillaging Knight', 'Cute Cat', 'Gravedigger'] },
  { why: 'Alle Paraseed-Karten (Nutzer 8.10.): Paraseed, Paraseed Control und Paraseed Zombie waren schon gesperrt, jetzt auch Paraseed Greenhouse (und damit die ganze Paraseed-Familie samt Bloom).',
    cards: ['Paraseed Greenhouse'] },
  { why: 'Tanuki (Nutzer 8.10.): Rebelliokai Timid Tanuki und Tanuki Escape. Das Tanuki-Paket hängt an der Ablage und am Zurückmischen ins Deck.',
    cards: ['Rebelliokai Timid Tanuki', 'Tanuki Escape'] },
  { why: 'Cycling Demons (Nutzer 8.10.): alle fünf (Bouldor, Herbithorn, Hydrogen, Infernous, Serpentous Demon) — jeder holt beim Fallen den nächsten der Kette aus dem DECK, das es im Skill Test nicht gibt.',
    cards: ['Bouldor Demon', 'Herbithorn Demon', 'Hydrogen Demon', 'Infernous Demon', 'Serpentous Demon'] },
  { why: 'Sandy Blob (Nutzer 8.10.).',
    cards: ['Sandy Blob'] },
  { why: 'Festive Werz (Nutzer 8.10.): zahlt „deinem Gegner“ Gold — mit mehreren Gegnern gibt es nicht DEN Gegner.',
    cards: ['Festive Werz'] },
  { why: 'Alle Future-Tech-Karten (Archetyp „Future Tech“): sie brauchen eine gefüllte Ablage, um gut zu funktionieren — im Skill Test gibt es keine Decks und kaum Ablage.',
    cards: futureTech },
];

// Freigegeben (einmalig von Hand in cards.json auf true gesetzt, das Skript schreibt nie zurück): Quetzahuitl, The Golden Abomination
// und die vier Cardinal Beasts (je Partie fehlt zufällig eines davon, siehe skilltest/config.js CARDINAL_BEASTS).

let raw = fs.readFileSync(FILE, { encoding: 'utf-8' });
const cards = JSON.parse(raw);
const byName = new Map(cards.map(c => [c.name, c]));
let changed = 0;
for (const g of GROUPS) for (const name of g.cards) {
  const c = byName.get(name);
  if (!c) { console.error('Karte nicht gefunden:', name); process.exitCode = 1; continue; }
  if (c.skilltestLegal === false) continue;
  const key = `"name": ${JSON.stringify(name)},`;
  const at = raw.indexOf(key);
  if (at < 0) { console.error('Namenszeile nicht gefunden:', name); process.exitCode = 1; continue; }
  const from = raw.indexOf('"skilltestLegal": true', at);
  const nextName = raw.indexOf('"name":', at + key.length);
  if (from < 0 || (nextName >= 0 && from > nextName)) { console.error('skilltestLegal-Zeile fehlt bei', name); process.exitCode = 1; continue; }
  raw = raw.slice(0, from) + '"skilltestLegal": false' + raw.slice(from + '"skilltestLegal": true'.length);
  changed++;
}
if (changed) fs.writeFileSync(FILE, raw, { encoding: 'utf-8' });
JSON.parse(raw);   // Sicherheitsnetz: bleibt gültiges JSON

const md = ['# Skill Test — vorerst gesperrte Karten',
  '',
  '> Erzeugt von `node scripts/curate-skilltest-legal.js`. Das Feld `skilltestLegal` in `data/cards.json` ist die Quelle der Wahrheit;',
  '> zur Freigabe einer Karte dort auf `true` setzen (Skript überschreibt nichts zurück).',
  '> Zusätzlich gesperrt per Regel: Divinity, Performance, Attack, Flying Island in the Sky, alle Ascended Heroes, alle Tokens.',
  ''];
for (const g of GROUPS) { md.push('## ' + g.why, '', ...g.cards.map(n => '- ' + n), ''); }
fs.writeFileSync(DOC, md.join('\n'), { encoding: 'utf-8' });
console.log(`✓ ${changed} Karte(n) auf skilltestLegal:false gesetzt, ${path.relative(process.cwd(), DOC)} geschrieben.`);
