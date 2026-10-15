# Fix-Welle 13 – Einzelfragen 115–147 und Rückfragen aus Welle 12

Al hat die 10 Rückfragen aus Welle 12 und die Einzelfragen 115–147 beantwortet; drei Agenten haben sie umgesetzt: W13a (`wave13/W13a` a067822: Aktionen, Negation, Zusatzaktionen), W13b (`wave13/W13b` 54b1d5a: Karten-Einzelregeln) und W13c (`wave13/W13c` 028c19d: Thep, Grimoire-Zähler, Karian). Alle Zweige sind zusammengeführt (einziger Konflikt: `CARD_API.md`).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Frage | Entscheidung / Umsetzung |
|---|---|
| Sandy Blob + Kreatur-Surprises | lösen nicht aus, außer der Text enthält ausdrücklich „When this Creature is summoned/placed, …"; `hatOnSummonText` kennt „place/placed" (derzeit hat keine der 18 Kreatur-Surprises einen solchen Satz). Cute Cat löst aus |
| Regel v619 | entfällt: nur effekt-negierter Held castet/beschwört normal (auch Surprises und Hand-Reaktionen); Abilities-negiert nur Lv 0; Frozen/Stunned/Webbed/Bound sperren; elf Einzeltore und vier Reaction-Creatures nachgezogen |
| Gigantisaur Skull | auch proaktiv; „only …"-Formulierungen definieren die reaktive Bedingung; Dive Down, Jump in the River, Unwanted Audience dagegen nur zu Beginn des Gegnerzugs |
| Thep | auf exakte Ablage-Instanz umgestellt (wie Teal Fishing Rod) |
| „Hard once per turn" | Texte „You can only activate/use this effect once per turn": insgesamt einmal, über alle Instanzen/Nutzer, auch geliehen (Grimoire/Kohta dürfen sie nicht zusätzlich nutzen); Lunatic Golem, Sleeping Beauty, Future Tech Fists auf spielerweites Limit korrigiert (`claimHOPT`) |
| Geliehene Verwendung | verbraucht den Zähler/das Limit der geliehenen Karte nicht (15 Karten, `ctx._borrowedUse`) |
| Karian | immun gegen die Hand-Negierung des Weakening Crystal (nicht gegen Petrification Break, nicht gegen Soul Transmitted) |
| Zi | ignoriert nur die Stufe; jede andere Bedingung lässt den Zauber sichtbar fizzeln; Einmal-pro-Spiel erst nach nicht abgebrochenem Guss |
| Flashbang | beendet den Zug nur bei Attack, Spell, Creature (inkl. place) und ausdrücklich action-kostenden Effekten (Adventurousness, Zi) |
| Gefrorene/betäubte Helden | verbrauchen durch nichts eine Aktion (Karian Ausnahme); Adventurousness gesperrt |
| Friendship Lv1 | bleibt gesperrt, wenn schon ein Support-Magic-Spell gewirkt wurde |
| Allgemeine Regel „automatische Zusatzaktionen" (Taio …) | Karte bleibt bis zum Commit in Hand/Deck/Ablage, Einmal-pro-Zug/-Spiel erst danach; Abbruch kostet nichts (Taio, Archibald, Learning, Rubin angeglichen; steht als Punkt 5 in „Zielende Karten sind immer abbrechbar") |
| Lethe | Kopierer (Shapeshifter, Pseudonia, Throne Robber) sind ab Annahme gesperrt, wenn die Bedingung erfüllt ist |
| Nicolas | Trank-Sperre entsteht auch, wenn er zwischen 1. und 2. Trank fällt |
| Pseudonia mit Damsel | bekommt das Extra-Leben |
| Doq | zufällige Gegnerkarte |
| Layn Defender | +100 HP nur für neu aufs Board kommende Kreaturen |
| Omikrons Illusion | löst „Creature placed"-Trigger aus (Nero, Maya, Pes'zet, Madame Guillotine) |
| Lolek | halbiert den aktuell wirksamen Preis |
| Cloud in a Bottle | schützt auch Kreaturen |
| Elixir of Strength | nur bei exakt einem Ziel; Mehrziel-Klammern lassen ihn unverbraucht; Ricochet (initial ein Ziel) feuert |
| Hammer Throw | Item Lock bei bloß verhindertem Schaden, nicht bei Ganz-Negierung |
| Ferocious Tiger Kick | heilt den tatsächlichen HP-Verlust |
| Weapon Storm | vor der ersten Karte abbrechbar |
| Resistance | blockt **jeden** Nicht-Schaden-Effekt (Prüfer `heroNonDamageEffectBlocked`: Max-HP-Gewinn, Teleportation Powder, Ability-Abwurf durch Effekte, dauerhafte Kontrolle, Status, Heilung, Buffs, Charme) |
| Overflowing Chalice, Pressed Skill | Auswahl nach aktueller Kontrolle |

## Zahlen (zusammengeführter Stand)

* Repros: **634 grün** von 878 (Welle 12: 582 von 846); 20 weitere Befunde behoben, **0 Rückschritte**, 0 Abstürze/Timeouts; die neuen W13-Repros (`W13/a-*`, `b-*`, `c-*`) sind grün.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target. Dauerfeuer über alle Karten: keine neu auffälligen Läufe.

## Rückfragen an Al (ja/nein)

**W13a:** (1) Sollen auch Creature-Effekte mit Action-Kosten (Spawn Mother, Creepy Clown, Plant Golem …) bei gefrorenem/betäubtem Wirtsheld gesperrt sein? (heute nicht; unklar, ob die Aktion dem Helden oder dem Spieler gehört) (2) Soll ein Wirker, dessen Abilities (harte Negierung) mitten in der Kette negiert werden, sein Kettenglied weiter fizzeln lassen? (so gelassen) (3) Soll die Nicolas-Sperre auch greifen, wenn Nicolas schon vor dem ersten Trank im selben Zug fiel? (so umgesetzt) (4) Zi: Soll ein Abbruch der Zielwahl des Sofort-Gusses die Karte aus dem Reveal behalten und den Zug-Stempel freigeben? (jetzt: Karte in die Ablage, „Einmal pro Spiel" bleibt frei)

**W13b:** (5) Soll Resistance auch den Spieler selbst blocken, wenn er den eigenen Helden ausrüstet, eine Ability anlegt (Pressed Skill) oder Buffs von Alliierten bekommt? (6) Sollen Insta-Kill-„Defeat"-Effekte (Midnight Assault, Decapitating Strike, `actionDefeatHero` ohne Schaden) an Resistance abprallen? (bisher nein) (7) Soll Resistance auch Heldenpassive blocken, die den eigenen Helden aufbauen (Max-HP-Gewinn von Goff, Wolflesia u. a., Luna Kiai, Maya)? (bisher nein) (8) Bekommt Omikrons Illusion Layns +100 HP (HP 1 plus 100)? (Folge von Q122, wie bei Staff of Illusions) (9) Soll Pressed Skill bei einem nur gecharmten Helden die Ability anlegen dürfen? (heute nur dauerhaft übernommene) (10) Soll Cloud in a Bottle auch einen tödlichen Treffer auf Kreaturen halbieren? (heute nicht, wie beim Helden-Fallback)

**W13c:** (11) A08-28: Soll der Träger von Petrification Break (Immunität gegen negative Status) auch von der Hand-Negierung des Weakening Crystal verschont bleiben („This counts as a negative status effect")? (heute negiert) (12) Sollen Karten mit „When …, …"-Triggertext plus „You can only activate this effect once per turn" (Bishop of Kings, Cloudy Slime, Exploding Skull) spielerweit auf einmal begrenzt sein? (sind sie schon; bitte bestätigen)
