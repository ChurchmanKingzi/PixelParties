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
