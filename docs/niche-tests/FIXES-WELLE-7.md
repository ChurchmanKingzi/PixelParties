# Fix-Welle 7 – Grundsatzfrage „stillgelegte Passive", Server-Prüfung, Sperren

Al hat die Grundsatzfrage und die Vorschläge aus [FRAGEN-OFFEN.md](FRAGEN-OFFEN.md) entschieden. Zwei Agenten (W7a, W7b) haben sie umgesetzt; `wave7/W7a` und `wave7/W7b` sind zusammengeführt (einziger Konflikt: `CARD_API.md`, beide Abschnitte übernommen).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Thema | Entscheidung |
|---|---|
| Gefroren / betäubt / negiert | **Unterbrechen alle laufenden Passive** der Karte (Held: Heldeneffekt/Ability-Passive je nach Zustand „Effekt negiert" / „Abilities negiert"; Kreatur: ganzer Kartentext-Passiv). Bereits an andere vergebene Wirkungen, Anhänge am gefrorenen Träger und Zugende-Trigger nach Ablauf bleiben |
| Server prüft Client-Antworten nach | Ja (B-07, M02-25, S01-13, S01-22) |
| Sickly Cheese | Nur gesperrt, wenn es **gar keine** wählbaren Ziele gibt; giftimmune Helden sind nicht wählbar |
| Übrige Sperren-Vorschläge | Bestätigt: Camouflaged Kappa unter Knight of Kings [B], Hu, Mao, Spice Mortar, Saint Nicolas/Santa Klaus, Magnetic Potion/Elixir of Mana, Navigation/Trapping/Premonition/Training unter Such-Sperre, Shooting Star unter Hand-/Stabsperre; Shapeshifter/Throne Robber nicht von der Such-Sperre erfasst |

## W7a – stillgelegte Passive (`wave7/W7a`, b6d5f31)

* Neuer zentraler Prüfer `engine.isCardPassiveDormant(inst)` (Kreatur: `isCreatureEffectSuppressed`; Heldenkarte: `_isHeroEffectSilenced`; Ability: `_isHeroAbilityPassiveSilenced`, leichte Negation lässt Ability-Passive laufen). Ursache der Klasse: der Hook-Verteiler filterte die Zustände schon immer, es traf nur Passive, die die Engine direkt liest (Vertrags-Flag, Stempel).
* Behoben (14 Befunde): King Trex, Paraseed, The Thing in the Ship, Plant Golem, Elven Forager (+ alle `reduceCardLevel`-Senker), Ghazma, Ifrit, Water Golem, Junshi, Rescued Damsel Cecilia, Silent Water Mizune, Stealth, Terror, Prophecy of Tempeste (nur der Deckel).
* Weitere Karten derselben Klasse (eindeutig): Baaliel, Beato, Gobbo, Sol Rym/Sorin/Tsu'Ki, Sid, Taio, Damus, Heragas, Inya, Nicolas, Nomu; Wildur, Time Bomblebee, Creepy Villager, Doomed Town Guard, Horror Clown, Bishop [B], Censpartan, Cykyran, Smugbeth, Wolflesia, Lizbeth-Fighting, Gou, Choir (teilweise); Ability Resistance.
* Stempel-Karten (Paraseed, Water Golem, Bishop [B], Censpartan, Cykyran) tragen `bypassStatusFilter` und gleichen sich bei jedem Statuswechsel selbst ab; Trex/Wildur prüfen beim Lesen (`_heroLevelOverride`).
* Offen: A07-29 Choir – der erteilte Schutz überlebt den Tod des Choir nicht (bräuchte einen Eingriff in den Schadens-Batch; Repro rot).

## W7b – Server-Prüfung und Sperren (`wave7/W7b`, 7ad105f)

* Server prüft nach: Abschluss jeder Zielwahl (`_zielwahlAbschliessen`: doppelte Ids entfernen, auf `maxTotal` kappen), `doConfirmPotion` weist zu viele/zu wenige/doppelte Ids ab (Abbruch bleibt immer möglich), `promptChainTargets` (Anzahl, Eindeutigkeit, Heldenpflicht), `resolveSacrificeCost` (`[]` bei abbrechbarer Wahl = Abbruch), `validateActionPlay` (Wisdom-Kosten).
* Sperren: Spice Mortar, Trapping, Premonition `blockedBySearchLock`; Training zählt die Deck-Option unter Such-Sperre nicht; Saint Nicolas/Santa Klaus gesperrt bei Hand-/Such-Sperre der Gegnerhand; Sickly Cheese über `engine.heroBlocksStatusNow` (giftimmun = nicht wählbar); Hu nur aktivierbar, wenn die geschenkte Aktion stattfinden kann (`canPerformImmediateActionAnyHero`), sonst gehen die 5 Karten zurück; Mao nur mit aktivierbarer Bestie (`creatureEffectScriptAllows`); Camouflaged Kappa prüft Stapel- und Such-Sperre.
* Nicht geändert: Angry Cheese (Selbstschaden kann von Schilden absorbiert werden, kein Ineligible-Kriterium).
* Der Server erzwingt `maxPerType`, `exclusiveTypes`, `uniqueBy`, `maxBudget`, `maxNonOwnSupport`, `minSumMaxHp` bei Effekt-Zielwahlen weiterhin nicht.

## Ergebnis in Zahlen (zusammengeführter Stand)

* Repros: **403 grün** von 750 (Welle 5: 346 von 743); 50 weitere Befunde behoben; **0 Rückschritte**, 0 Abstürze/Timeouts; die 7 neuen Repros (`W7-a/01–03`, `W7-b/01–04`) sind grün und waren auf dem Ausgangsstand rot.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `cards.test.js` einmal unter Last rot, in drei Wiederholungen grün (bekannter Flake). Dauerfeuer über alle Karten (~2 440 Läufe): keine neu auffälligen Läufe.

## Offene Fragen an Al (ja/nein)

**Aus W7a**
1. Paraseed: Ist „Gift fällt, solange die Paraseed ruht; ein bereits vorhandenes fremdes Gift bleibt" richtig?
2. Prophecy of Tempeste: Soll bei gefrorenem Wirt auch die Umleitung („you may redirect") weiterlaufen? Bisher ist nur der Deckel freigegeben.
3. Sollen Toughness-HP und Fighting-ATK (Stempel) bei gefrorenem oder negiertem Helden stehen bleiben? Unverändert gelassen.
4. Sollen Heldenbeschränkungen und -pflichten bei Frost, Betäubung oder Negation ebenfalls ruhen (Mary „nur Cute", Mirjam „1 Attack pro Zug", Santa Klaus „2 Karten abgeben", Sol Rym „1 Aktion", Lethe, Kent, Logan)?
5. Sollen Bonded Companion (gemeinsamer HP-Pool, Zonensperre), Hell Fox/Cute Hydra (Selbstlöschung) und Estimate-Bonusse (Warhorse, Zsos'Ssar) bei Frost/Betäubung/Negation ebenfalls ruhen?
6. Soll der erteilte Choir-Schutz auch den Tod des Choir überleben (Eingriff in den Schadens-Batch)?

**Aus W7b**
7. Sollen Trapping und Training (Deck-Option) unter der Such-Sperre gesperrt bleiben, obwohl sie nichts auf die Hand legen (Alex, Ska, Greenhouse, Shapeshifter sind es nicht)? Gesperrt ist es jetzt auf Anweisung zu M02-23.
8. Sollen Navigation, Premonition und Trapping auch unter der reinen Hand-Sperre (Smuggler's Pier) gesperrt sein? Heute ja, weil die Hand-Sperre per Engine-Regel jede Suche sperrt.
9. Soll ein von Mao ausgelöster Effekt, den der Spieler in der Bestie selbst abbricht, die 5 Karten zurückgeben und die Bestie nicht negieren?
10. Soll der Server auch `maxPerType`, `exclusiveTypes` und die Summenregeln bei Zielwahl-Antworten erzwingen?
