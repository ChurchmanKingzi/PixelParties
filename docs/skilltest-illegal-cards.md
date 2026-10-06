# Skill Test — vorerst gesperrte Karten

> Erzeugt von `node scripts/curate-skilltest-legal.js`. Das Feld `skilltestLegal` in `data/cards.json` ist die Quelle der Wahrheit;
> zur Freigabe einer Karte dort auf `true` setzen (Skript überschreibt nichts zurück).
> Zusätzlich gesperrt per Regel: Divinity, Performance, Attack, Flying Island in the Sky, alle Ascended Heroes, alle Tokens.

## Sofortiger Spielsieg („You win the game“): beendet die Partie für ALLE; im Skill Test gibt es dafür keine passende Wertung (Platzierung der Übrigen).

- Cardinal Beast Baihu
- Cardinal Beast Qinglong
- Cardinal Beast Xuanwu
- Cardinal Beast Zhuque
- The Final Trial
- Carris, the Time Keeper

## Doom-Clock-Familie: leitet Sieger/Verlierer als „der andere Spieler“ ab (`winnerIdx = byPi === 0 ? 1 : 0`); mit mehr als zwei Sitzen ist der Verlierer nicht gleich „Spielende“.

- Doom Clock
- Doom Prophecy
- Basketskull
- Ferocious Jaguar Warrior
- Swift Eagle Warrior
- Warrior of Teocuilatl

## Sieger/Verlierer-Ableitung als „der andere Spieler“ beim Ausscheiden bzw. Besitzer-Ableitung „Gegenseite des Wirts“ — braucht eine Regel für mehrere Gegner.

- Quetzahuitl, Receiver of Sacrifices
- The Golden Abomination
- Future Tech Control Device
