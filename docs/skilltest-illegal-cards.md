# Skill Test — vorerst gesperrte Karten

> Erzeugt von `node scripts/curate-skilltest-legal.js`. Das Feld `skilltestLegal` in `data/cards.json` ist die Quelle der Wahrheit;
> zur Freigabe einer Karte dort auf `true` setzen (Skript überschreibt nichts zurück).
> Zusätzlich gesperrt per Regel: Divinity, Performance, Attack, Flying Island in the Sky, alle Ascended Heroes, alle Tokens.

## Sofortiger Spielsieg („You win the game“) ohne passende Wertung bei mehreren Spielern. (Die vier Cardinal Beasts sind NICHT gesperrt: je Partie fehlt eine zufällige von ihnen, siehe CONFIG.CARDINAL_BEASTS — so sind nie alle vier gleichzeitig im Spiel.)

- The Final Trial
- Carris, the Time Keeper

## Doom-Clock-Familie: leitet Sieger/Verlierer als „der andere Spieler“ ab (`winnerIdx = byPi === 0 ? 1 : 0`); mit mehr als zwei Sitzen ist der Verlierer nicht gleich „Spielende“.

- Doom Clock
- Doom Prophecy
- Basketskull
- Ferocious Jaguar Warrior
- Swift Eagle Warrior
- Warrior of Teocuilatl

## Zählen/löschen aus BEIDEN Ablagen (`players[0]` / `players[1]`): mit mehr als zwei Sitzen unvollständig, die Auswahl über alle Ablagen braucht eine eigene Oberfläche.

- Guardian Beast Gou
- Guardian Beast Hou
- Guardian Beast Hu
- Guardian Beast Ji
- Guardian Beast Long
- Guardian Beast Ma
- Guardian Beast Niu
- Guardian Beast She
- Guardian Beast Shu
- Guardian Beast Tu
- Guardian Beast Yang
- Guardian Beast Zhu
- Mao, the Vengeful Guardian

## Curse: setzt die ATK des Ziels auf 0 — ein Held ohne Angriff kann in diesem Modus nichts mehr bewirken und führt zu unschönen, kaum lösbaren Lagen.

- Curse

## Gorinthian War Counselor: betäubt ein Ziel für 2 Turns und setzt allen Schaden an ihm auf 0; wird der Stun vor dem Ablauf erneuert (in Skill-Test-Rounds immer möglich), heilt das Ziel nie, und der eingebaute Schutz „Immune nach Ablauf des Stuns" greift nie — der letzte Gegner ist dauerhaft gesperrt, die Partie endet nie (Nachttraining, Seed 233).

- Gorinthian War Counselor

## Tri Ad und Tri Fecta (Puppet Mistress / Puppet Master): Tri Fecta spawnt zu Spielbeginn Puppet-Tokens in seine Support Zones (geteilter HP-Pool, sonst keine Karten dort erlaubt), Tri Ad darf kein Start-Hero sein und stapelt sich auf Tri Fecta — das ist im Skill Test nicht abgebildet (auf Wunsch aus dem Pool genommen).

- Tri Ad, the Puppet Mistress
- Tri Fecta, the Puppet Master

## Reine Zieh-/Such-Karten: ihre einzigen Effekte sind Ziehen, Suchen, Tutoren oder „oberste Karten aufdecken und auf die Hand nehmen“. Der Skill Test hat kein Deck, die Karten wären wirkungslos (oder schaden, z. B. „Hand ablegen und gleich viele ziehen“). Erkannt über die Zieh-/Such-Sperren der Engine (`blockedByHandLock`, `blockedByDrawLock`, `blockedBySearchLock`) und über den Zieh-Block-Helfer (Wheels, Haste, …), von Hand geprüft. NICHT gesperrt: Karten, die auch etwas anderes bewirken, sowie reine Ablage-Rückholer (Shooting Star, Boomerang, Relic in the Sky, Magic Sapphire, Elixir of Mana, Shard of Chaos, Spontaneous Reappearance …) — die Ablage gibt es im Skill Test.

- Alchemic Journal
- Alchemy
- Angry Cheese
- Aurora Borealis
- Bifab, Bridge to Coolness
- Birthday Present
- Brainstorming
- Brilliant Idea
- Cool Cheese
- Cute Cheese
- Cuteness Sensor
- Divine Gift of Creation
- Elixir of Quickness
- Graveyard Gathering
- Heart of Cards
- Heart of the Mountain
- Holy Cheese
- Horn in a Bottle
- Idol of Crestina
- Magic Lamp
- Magnetic Glove
- Magnetic Potion
- Mass Multiplication
- Navigation
- Nerdy Cheese
- Perilous Journey
- Philosopher's Stone
- Potion of Greed
- Sickly Cheese
- Staff of the Teleporter
- Staff of Uncontrollable Destruction
- Tanuki Escape
- Teleportal
- The Sacred Jewel
- The Sacred Mirror
- Trial of Loyalty
- Haste
- Supply Chain
- Voice in your Head
- Wheels
- Glimpse of the Future
- Grasp the Future
- Prophecy of Coolness
- Cool Rescue
- Pawn Sacrifice
- Mystery Box
- Glass of Marbles
- Ice Sculpture Garden
- Divine Gift of Balance
- Divine Gift of Edge
- Crushing Defeat
- Unlikely Encounter
- Spatial Crevice
- Premonition
- Inventing
- Leadership
- Creativity
- Luck
- Amazing Finding
- Draw
- Deepsea Treasure
- Charm of Balance
- Prayer
- Smuggler's Pier
- Wanted Poster
- The Brewer's Blade
- Bluff
- Spider Silk Bridge
- Cell Escape
- Infiltration
- Spice Mortar
- Salute to the Fallen
- Crystal Well
- Pillar of Light
- Tarleinn's Floating Island
- Temple of Sacrifice
- Snake Race Boat
- Rain Viola
- Lunatic Cycle - New Moon
- Lunatic Cycle - Crescent Moon
- Bow of the Hunt Goddess

## Coolness-Stack-Karten: wirken nur aus dem Coolness Stack („This card has no effect, unless you play it from your Coolness Stack“) oder verlangen dessen Inhalt. Der Skill Test hat keinen Coolness Stack (in 6 Probepartien an allen 24 Sitzen immer leer) — die Karten sind unspielbar (Nachttraining: 0 % Nutzung bei 80–165 behaltenen Exemplaren je Karte).

- Coolness Overcharge
- Glorious Rebirth
- String of Fine
- Modnir, Hammer of Coolness
- Swellpnir, Mount of Coolness
- Ragnarock

## Deckbau-Regelkarten („Für je 2 Exemplare in deinem Deck darf dein Deck …“, „Hast du 4 Exemplare in deinem Deck …“): ihre einzige Wirkung ist eine Deckbau-Regel; der Skill Test hat kein Deck.

- Secret Blue Spice
- Secret Golden Spice
- Secret Green Spice
- Secret Red Spice
- Secret Spice Jar
- The Sacred Blade

## Karten, deren Wirkung aus dem Deck kommt (Suchen, Aufdecken, Karte aus dem Deck ausrüsten/beschwören): der Skill Test hat kein Deck, die Karten sind wirkungslos oder kosten nur (Opfer, Zugende). In den Probepartien nie erfolgreich ausspielbar, im Nachttraining 0–2 % Nutzung.

- Arrival from the Cosmic Depths
- Create Illusion
- Living Illusion
- Surprise Party
- Overcharge
- Ladder to the Sky
- Treasure Hunter's Backpack
- The Eye of Ren
- Muscle Training
- Lesson in the Arts
- Kitsune Transformation
- Ultimate Weapon Experiment

## Karten für Ascended Heroes (im Skill Test gesperrt): ohne Ascended Hero auf dem Brett oder in der Hand haben sie kein Ziel.

- Audience with a hostile King
- Open Invitation

## Helden mit Spielbeginn-Effekt vor dem Ziehen der Starthand („At the start of the game, before both players draw their starting hands …“): Bill (Artifacts aus dem Deck ausrüsten), Hel (Artifact aus dem Deck ausrüsten), Sid (Deck des Gegners ansehen), Kassaran (drei Kartennamen erklären). Der Skill Test hat weder Deck noch Starthand-Ziehen — auf Wunsch aus dem Pool genommen. (Die Idej Lords haben denselben Text, bekommen ihre Karten aber über die Spawn-Regel.)

- Bill, the Angry Auctioneer
- Hel, the Bound Specter
- Sid, the King of Thieves
- Kassaran, Seer of Everything

## Anti Magic Enchantment: Anhänger-Zauber, der „sofort beim Ausrüsten eines Artifacts durch einen Pollution Token“ gespielt werden muss und sonst nichts bewirkt — im Skill Test praktisch nie spielbar (Nachttraining: 0 % Nutzung bei 52 behaltenen Exemplaren). Auf Wunsch aus dem Pool genommen.

- Anti Magic Enchantment

## Hat of Madness: „Whenever the equipped Hero performs an Action, its controller must add a card from their hand to their opponent's hand“ — mit mehr als zwei Sitzen gibt es nicht DEN Gegner, an den die Karte geht. Auf Wunsch aus dem Pool genommen.

- Hat of Madness

## Idej Projection: kann nur durch den Effekt der Idej Lords an einen Hero gehängt werden („by its own effect“). Im Skill Test spawnen die Lords ihre Projections jetzt beim Aufstellen selbst (siehe skilltest/README.md); als Handkarte wäre sie ein Fremdkörper.

- Idej Projection

## Bottom-100-Auswertung (docs/skilltest-bottom100.md), vom Nutzer am 7.10. aussortiert: schwache Standalone-Karten ohne brauchbare Wirkung im Modus. Behalten wurden Flame Arrow, Cardinal Beast Baihu, Moonlight Butterfly, Greatmaw Shark, Soul Shard Sekhem, Deepsea Werewolf, Fireball, Iceage und Forbidden Curse of Aging.

- 500 Piranhas in a Monster Suit
- Paraseed
- Golden Exploding Skull
- Stowaway
- Plant Golem
- Jumpscare
- Dream Dust
- Market Crash
- The Stormblade
- Magic Mirror
- Afflicted Vermin
- Soul Shard Ren
- Ellie, the Class President
- The Fourth Circle of Hell
- Tuscan Prisoner
- Slippery Pengu
- Adventurousness
- Shapeshift
- Cosmic Malfunction
- Bamboo Staff
- Cottage at the Forest's Edge
- Elven Forager
- Wowhalla, the Hall of the Cool

## Alle Karten, die den Coolness Stack ausdrücklich referenzieren (Nutzer 7.10.): der Skill Test hat keinen Coolness Stack.

- Freshya, Beauty of Coolness
- Hipdall, Protector of Coolness
- Lolki, Trickstar of Coolness
- Phatnir, Prototype of Coolness
- Swagdri, Forger of Coolness
- The Nornstellar, Foretellers of Coolness
- Thrysh, Robber of Coolness
- Wildur, the Shining Coolness
- Wowkyrie, Bringer of Coolness
- Yolomungandr, Ender of Coolness

## Crystals (Nutzer 7.10.): Artefakte, die nur als aufgedeckte Handkarte wirken und beim Ausspielen nichts tun.

- Mana Absorbing Crystal
- Weakening Crystal
- Distracting Crystal
- Rusting Crystal
- Treacherous Crystal

## Debt-O-Tron (Nutzer 7.10.): brauchen negatives Gold bzw. erlauben das Ausspielen ohne Gold — im Modus nicht erreichbar.

- Debt-O-Tron Damage Fees
- Debt-O-Tron Model Backup Duplicator
- Debt-O-Tron Model Loan Shredder
- Debt-O-Tron Model Missing Parts
- Debt-O-Tron Model Money Printer
- Debt-O-Tron Model Scrap Plow

## Reine Discard-Karten (Nutzer 7.10.): „This card has no effect when you play it from your hand“, wirken nur beim Abwerfen.

- Skull Necklace
- Letter of Misinformations

## Sparkflies (Nutzer 7.10.): die Königin ist nur über Hive's Crown beschwörbar, der Rest hängt an ihr bzw. an Deck-Suche.

- Hive's Crown
- Sparkfly Architect
- Sparkfly Attendant
- Sparkfly Queen
- Sparkfly Worker

## Monkees (Nutzer 7.10.): bis auf Cheeky Monkee (macht Schaden) gesperrt — sie hängen an Gold-Gewinn-Ereignissen.

- Golden Bananas
- Nimble Monkee
- Resilient Monkee
- Criminal Monkee
- Non-Fungible Monkee

## Crusader-Waffen (Nutzer 7.10.): nur für Cecilia ausrüstbar.

- Crusader's Arm-Cannon
- Crusader's Cutlass
- Crusader's Flintlock
- Crusader's Hookshot

## Lunatic (Nutzer 7.10.): Hawk und Golem raus. Half/Gibbous/Full Moon sind wieder frei (8.10.): in der Vorbereitung lassen sie sich bedingungslos ausrüsten, auch ohne die gesperrten New/Crescent Moon.

- Lunatic Hawk
- Lunatic Golem

## Archetyp „of Kings“ (Chess), komplett inklusive beider Kasperovs (Nutzer 7.10.).

- Bishop of Kings [B]
- Bishop of Kings [W]
- Board of Kings
- Castling
- Kasperov, the King of Kings [B]
- Kasperov, the King of Kings [W]
- Knight of Kings [W]
- Knight of Kings [B]
- Pawn Chain
- Pawn of Kings [B]
- Pawn of Kings [W]
- Queen of Kings [B]
- Queen of Kings [W]
- Rook of Kings [B]
- Rook of Kings [W]

## Alles mit Ascension (Nutzer 8.10.): Ascended Heroes sind im Skill Test gesperrt, diese Karten setzen einen Ascended Hero voraus oder lösen eine Ascension aus.

- Disgruntled Forest Warden
- Divine Awakening
- Smugness
- Trident Spirit - Hammer Absorbed

## Dragsparov, the King of Dragons: hat keinen Karteneffekt-Skript (kein Anlegen möglich) und sein Partner Kasperov ist mit „of Kings“ gesperrt.

- Dragsparov, the King of Dragons

## Bloom, the Maniacal Botanist (Nutzer 8.10.): lebt von Paraseed, einer rein schädlichen Karte, die man dem Gegner geben müsste — im Skill Test kaum spielbar.

- Bloom, the Maniacal Botanist

## Hell Circles (Nutzer 8.10.): die „Circles of Hell“-Kette aus Areas wird im Skill Test nicht gebraucht.

- The First Circle of Hell
- The Second Circle of Hell
- The Third Circle of Hell
- The Fifth Circle of Hell
- The Sixth Circle of Hell
- The Seventh Circle of Hell
- The Eighth Circle of Hell

## Bonded Companions (Nutzer 8.10.).

- Bonded Companion Humby
- Bonded Companion Mellvy
- Bonded Companion Orphy
- Bonded Companion Thuly

## Chaos-Diamond, the Cracked Keeper (Nutzer 8.10.).

- Chaos-Diamond, the Cracked Keeper

## Reaktionen mit extrem engen, seltenen oder unwahrscheinlichen Bedingungen (Nutzer 7.10., nach eigenem Ermessen): hängen an bestimmten Karten/Archetypen, am Deck, an Surprises, Freeze, Ascend, Heldenstufen oder Sonderlagen, die im Skill Test praktisch nie eintreten.

- Arrow Slit
- Bomblebee Cluster
- Burning Fuse
- Chaorc Interception
- Cosmic Manipulation
- Paraseed Control
- Paraseed Zombie
- Rebelliokai Courtly Kirin
- Idej Projector
- Elven Rider
- Old Couple
- First Contact
- Wendy, the Shy Girl
- Deepsea Encounter
- Deepsea Spores
- Homecoming
- No Retreat!
- Troop Annihilation
- Anti Intruder System
- Local Idol
- Boots of Hermes
- See through the Ruse
- Teleport
- Front Soldier
- Cute Camera
- Sinister Idol
- Blessing of the Sun
- Balloons
- Unguarded Gate
- Cheat Chair
- Fans in High Positions
- Accidental Dodge
- Test Flight
- Anti Magic Shield
- Stubborn Getaway
- REVENGE!!!
- Drowned Remains
- Strong Shield
- Homerun!
- Sculpture Guards
- Sculpture Theft
- The Melting
- Trample Sounds in the Forest
- Triumphant Return
- Very Special Prisoner
- Rescue Mission
- Explosion Toss
- Gigantisaur Skull
- Ambush the Scout
- Control Monitors
- Vampire on Fire
- Furious Anger
- Point-Blank Annihilation
- Dream World Switcheroo
- Flesh-Eating Swarm Trap
- Party Crasher
- Inverted Levitation
- Enhanced Guard Dog

## Alle Future-Tech-Karten (Archetyp „Future Tech“): sie brauchen eine gefüllte Ablage, um gut zu funktionieren — im Skill Test gibt es keine Decks und kaum Ablage.

- Blueprints
- Future Tech Barrage
- Future Tech Battery
- Future Tech Bazooka
- Future Tech Bomb
- Future Tech Control Device
- Future Tech Copy Device
- Future Tech Database
- Future Tech Doomsday Bomb
- Future Tech Doping
- Future Tech Drone
- Future Tech Escape Device
- Future Tech Fists
- Future Tech Gear
- Future Tech Gun
- Future Tech Gunslinger Riffel
- Future Tech Jetpack
- Future Tech Lamp
- Future Tech Laser Cannon
- Future Tech Magic Modifier
- Future Tech Mech
- Future Tech Organnon
- Future Tech Potion Launcher
- Future Tech Prototypes
- Future Tech Weathercock
- Iterative Testing
- Misfire
- Mysterious Core
- The Core's Awakening
