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

## Idej Projection: kann nur durch den Effekt der Idej Lords an einen Hero gehängt werden („by its own effect“). Im Skill Test spawnen die Lords ihre Projections jetzt beim Aufstellen selbst (siehe skilltest/README.md); als Handkarte wäre sie ein Fremdkörper.

- Idej Projection

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
