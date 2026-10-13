# M02-attacks-abilities-potions – Nischenfall-Bericht
Stand/Autor: Agent M02-attacks-abilities-potions, 13.10.2026. Karten: 53 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### M02-01 · Stranglehold zählt nur 5 von 17 negativen Status · Stufe B
- **Karten:** Stranglehold (`cards/effects/stranglehold.js`); betroffen sind alle Status, die andere Karten dieser Gruppe vergeben (Smoke Vial, Trunk Sand → Blinded)
- **Voraussetzungen / Aufbau:** `H.fresh()`, Sitz 0 Held 1 (Rick, ATK 80, keine Fighting-Stufe) spielt Stranglehold; Ziel Held 0 von Sitz 1 mit genau einem negativen Status (per `addHeroStatus`), 800 HP. Dasselbe mit einer Kreatur (Counter auf der Instanz).
- **Schritte:** 1. Status setzen. 2. Stranglehold über den echten Spielweg (`doPlaySpell`) auf das Ziel.
- **Erwartet** (Kartentext „deal 50 damage to it times the number of negative status effects it is inflicted with"): 50 Schaden je negativem Status. Die Engine führt 17 Status mit `negative: true` (`getNegativeStatuses()` in `_hooks.js`: frozen, stunned, negated, burned, poisoned, bleeding, nulled, bound, blinded, blinded_hit, webbed, magic_silenced, frightened, berserked, cursed, aged, soul_transmitted). Der Kartentext schränkt nicht auf eine Teilmenge ein.
- **Beobachtet:** Nur frozen/stunned/negated/burned/poisoned liefern 50. Bleeding, Nulled, Bound, Blinded, Blinded (Trunk Sand), Webbed, Magic Silenced, Frightened, Berserked, Cursed, Aged, Soul Transmitted liefern **0 Schaden** (Held mit Frozen + Bleeding + Blinded erleidet nur 50 statt 150). Bei Kreaturen zählen ebenfalls nur die fünf; Blinded (Trunk Sand), Bleeding, Bound, Nulled, Webbed, Magic Silenced → 0.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/01-stranglehold-zaehlt-nur-5-status.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/stranglehold.js:19` `NEGATIVE_STATUSES = ['frozen','stunned','burned','poisoned','negated']` (eigene Liste statt `getNegativeStatuses()`), `countNegativeStatuses` Z. 26–44. Anhänge, die als negativer Status zählen (`countsAsNegativeStatus`: Decisive Defeat, Stowaway; `engine.cleansableHeroEntries`) werden ebenfalls nicht gezählt. Rückfrage: Poison-Stapel (2 Stacks aus Poison Vial) zählen als 1 Status – das ist textgemäß.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|

## Getestet & in Ordnung (Auswahl)
