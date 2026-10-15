# Fix-Welle 12 – Einzelfragen 86–114 und Rückfragen aus Welle 11

Al hat die 14 Rückfragen aus Welle 11 und die Einzelfragen 86–114 beantwortet; drei Agenten haben sie umgesetzt: W12a (`wave12/W12a` a46ad76: Korrekturen an Welle 11, Engine), W12b (`wave12/W12b` fa6acdc: Artefakte und Reaktionen) und W12c (`wave12/W12c` 54a2998: einzelne Kreaturen/Helden). Alle Zweige sind zusammengeführt (einziger Konflikt: `CARD_API.md`).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Frage | Entscheidung / Umsetzung |
|---|---|
| Sandy Blob | löst nur bei Kreaturen mit **On-Summon-Text im Kartentext** aus, der wirklich wirkt (`hatOnSummonText`); die ~45 Kreaturen mit technischem onPlay-Hook lösen nicht mehr aus |
| Beschwörer negiert | Effekt-negierter Held beschwört normal; Abilities-negiert (harte Form) nur noch Lv-0-Kreaturen (Summoning Magic weg); Hipdall-Ausnahme „Negated + Lv0" wieder gültig |
| Anti Magic Enchantment | Halter = Kontrolleur des Träger-Helden; das Artefakt wird „enchanted" und trägt den Effekt |
| Foresta-HP-Kosten | kein Opfer: lösen weder Thuly noch Temple of Sacrifice aus |
| Grimoire / Kohta | dürfen auch Effekte mit erschöpftem eigenem Limit nutzen (`_borrowedUse`; Ausnahmen mit ausdrücklich verschärftem Text, siehe Rückfrage) |
| Market Crash, Sacred Jewel, Rioting Village, Elven Leader, Piranhas | unverändert (Zug 1 unspielbar; Rioting Village gilt auch für Geschützte; nur erster Schlag; Ablage verbraucht Limit; Schaden am Zug des aktuellen Kontrolleurs) |
| B-06 | Karten mit komplett nutzlosem Effekt sind in Zug 1 nicht spielbar (Flag `blockedByFirstTurnProtection` an 16 Karten + Boulder in a Bottle); Grundsatz „Eine Karte, deren Effekt komplett nutzlos wäre, ist nicht spielbar" |
| Mausoleum Worm | Place-Effekte zählen ins Limit und sind danach gesperrt (`playLimitKey`) |
| Gleichstand | Rangfolge Klausel > Karten-Wirker > **Zugspieler** |
| Lawn Gnome | Einmal-Grenze gilt auch bei Rückkehr auf die Hand im selben Zug |
| Wire Hatchling | Zielwahl nicht abbrechbar (Pflichtwahl), Beschwörung wird nie zurückgenommen |
| Anti-Magnet | braucht ein zweites **eigenes** legales Ziel |
| Blood-Soaked Coin | dauerhafte Kontrolle (Dark Gear, Paraseed Control) zählt |
| Reactions allgemein (Gigantisaur Skull) | immer auch proaktiv, außer der Text schließt es aus („only") oder der Trigger ist sehr spezifisch; Prüfung aller 146 Reaction-Karten: keine weiteren eindeutigen Fälle |
| Item Lock | Kosten erst nach Commit der Karte (Vormerkung/Einforderung); bei Zieh-Artefakten (Wheels) vor dem Ziehen; Abbruch kostet nichts |
| Glass of Marbles | nur Karteneffekte, nicht das Handlimit |
| Heart-Shaped Bow | Einmal-pro-Zug des Love-Shot-Angebots entfernt |
| Rain Viola | sucht immer für den Spieler, dessen Held ausgerüstet ist |
| Shard of Chaos | unter harter Ablage-Sperre nicht spielbar; Text: „(Ability, Attack/Spell/Creature, Artifact, Potion, Hero)" |
| Sacrificial Dagger / Heart of Ice / Knife | Dagger auch bei Helden-Opfern; Heart of Ice friert auch bei tödlichem Gegentreffer; Knife-Kill zählt als „Held besiegt das Ziel" |
| Slippery Fridge | beliebig viele Ausrüstungen: erst alle Equips + Ziel-Zonen wählen, dann gleichzeitig verschieben |
| Teal Fishing Rod | nur Karten, die zu Zugbeginn schon in der Ablage lagen (Zeitstempel je Ablage-Eintrag) |
| Alice | blockbar durch Anti Magic, gilt als Stufe 0 (`treatedAsSpell`) |
| Chaos-Diamond / Pinta | Ziehsperre fällt mit temporärer geliehener Gestalt weg, permanente Quelle hält sie |
| Dajan / Ida | Ist-Zustand bestätigt (begonnener Effekt läuft durch; Cardinal Beasts immun gegen alle Effektarten) |
| Karian | wird durch Freeze/Stun/Negation an nichts gehindert (`ignoresHaltStatuses`) |

## Zahlen (zusammengeführter Stand)

* Repros: **582 grün** von 846 (Welle 11: 532 von 818); 22 weitere Befunde behoben, **0 Rückschritte**, 0 Abstürze/Timeouts; die neuen W12-Repros (`W12/a-*`, `b-*`, `c-*`) sind grün.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `cards` und `learn` unter Last rot, einzeln je zweimal grün (Lastflackern). Dauerfeuer über alle Karten: keine neu auffälligen Läufe.

## Rückfragen an Al (ja/nein)

**W12a:** (1) Sandy Blob löst bei Kreatur-Surprises (Pure Advantage Camel, Cybugs, Water Golem u. a.) nie aus (Text „Activate this Surprise …") – richtig? (2) Soll die v619-Regel „ein negierter Held castet keine Surprise/Hand-Reaktion" auch für Reaction-/Surprise-Creatures (Doomed Town Guard, Enhanced Guard Dog, Ethan, Explosive Drone, Chaorc Rider Warg) bestehen bleiben, obwohl ein Effekt-negierter Held sonst beschwören darf? (3) Soll Sandy Blob bei Cute Cat („When you summon this Creature, immediately send it to the discard pile") auslösen? (heute ja)

**W12b:** (4) Gigantisaur Skull: Der Text sagt „You can only activate this card during your opponent's turn …" – genau die Ausschlussformel aus der Q91-Antwort. Trotzdem proaktiv (so umgesetzt) oder nur als Reaktion im Gegnerzug? (5) Dive Down, Jump in the River, Unwanted Audience („Play this card at the beginning of your opponent's turn") sind nicht proaktiv, Cure, Juice, Deepsea Spores, Edge und Burning Fuse mit gleichem Zeitfenster schon – sollen die drei auch im eigenen Zug spielbar sein? (6) Thep, the Court Scribe prüft „not sent there this turn" am Namen – wie die Rod auf die exakte Ablage-Instanz umstellen? (7) Acht Reactions ohne Skript (Deadly Poison, Fake Legendary Sword, Rescue Mission, The Light Brigade Marches, Unlikely Encounter, Unwarranted Burst of Courage, You are the Chosen One!!!, You! Help!) sind unspielbar – sollen dafür Skripte entstehen (neue Kartenfunktionen)?

**W12c:** (8) Sollen Grimoire/Kohta auch Effekte mit ausdrücklich verschärftem Text („You can only activate/use this effect once per turn": Oblivious Oni, Skeleton Bard, Greatmaw Shark, The Spawn Mother) trotz erschöpftem Limit nutzen? (bewusst ausgenommen) (9) Soll eine geliehene Verwendung den Zähler der geliehenen Karte nicht verbrauchen? (heute verbraucht sie bei 3-Headed Giant eine Nutzung) (10) Soll Weakening Crystal bei Karian auch die Hand-Negierung wirkungslos lassen? (bei Petrification Break offen, A08-28)

Hinweis zu Lawn Gnome (Q14): Die Sperre wandert mit der Karte für die Deepsea-/Bounce-Rückwege; Rückwege über gold-trap.js (`actionAddCardToHand`), jenny-the-class-fairy.js, winged-skeleton.js, noble-mummy-guards.js und `_sparkfly-shared.js` tragen sie noch nicht mit (dort genügt `{ vonInst: inst }` am `handZugangSync`-Aufruf).
