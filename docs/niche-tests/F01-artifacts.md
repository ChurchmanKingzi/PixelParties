# F01-artifacts – Nischenfall-Bericht
Stand/Autor: Agent F01-artifacts, 13.10.2026. Karten: 50 in der Liste · 0 gezielt getestet (wird fortlaufend ergänzt) · 0 mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde

### F01-01 · Cool Repair ignoriert die Ausrüstregeln der geholten Ausrüstung · Stufe A
- **Karten:** Cool Repair (`cards/effects/cool-repair.js`), betroffen: Crusader's Arm-Cannon / Cutlass / Flintlock / Hookshot, Forbidden Grimoire of a Forgotten Sorceress, Cloak of Edge (jede Ausrüstung mit `canEquipToHero`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 mit 100 Gold, Hand [Cool Repair], Ausrüstung in der Ablage, Zielheld Tushu (Cecilia nur in Fall D).
- **Schritte:** 1. Cool Repair spielen. 2. In der Galerie die Ausrüstung wählen. 3. Zielheld/Zone wählen.
- **Erwartet** (Kartentext Crusader's: „You can only equip this card to "Cecilia, the Harrowing Crusader". A Hero can only be equipped with 1 "Crusader's" Artifact."; Grimoire: „A Hero can only be equipped with 1 …"; Cloak-Ruling im Skriptkopf: höchstens eine Cloak je Held; Cool Repair: „equip it to a Hero you control" – Ausrüsten, nur ohne Kostenzahlung): Die Ausrüstregeln bleiben in Kraft; die Karte wird dort nicht angeboten bzw. nicht angelegt (Handweg `doPlayArtifact` fragt `canEquipToHero`; Engine-Gate `engine.canEquipCardToHero`).
- **Beobachtet:** (A) Crusader's Cutlass liegt danach bei Tushu (kein Cecilia). (B) Ein zweites Forbidden Grimoire liegt am selben Helden (zwei Stufensenkungen −2). (C) Eine zweite Cloak of Edge liegt am selben Helden. (D) An Cecilia liegen Cutlass und Hookshot zugleich.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/01-cool-repair-ignoriert-ausruestregeln.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/cool-repair.js`, Schritt 3 (`destTargets`): prüft nur lebend/nicht eingefroren/freie Zone, nie `canEquipToHero`. CARD_API.md (Z. 3793) vermerkt Cool Repair ausdrücklich als „noch handgestrickt — bei der nächsten Berührung umstellen" (Helfer `equipDestinations`/`engine.canEquipCardToHero` stehen bereit).

### F01-02 · Birthday Present: bei negierter Gabe verschwinden die 3 aufgedeckten Karten · Stufe A
- **Karten:** Birthday Present (`cards/effects/birthday-present.js`), Ambush the Scout (`ambush-the-scout.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Sitz 0: Hand [Birthday Present], Deck [Fireball, Beer, Coffee, ZZ Dummy, ZZ Dummy]; Sitz 1: Hand [Ambush the Scout, 3 Füller], Held 0 mit Decay Magic 1.
- **Schritte:** 1. Birthday Present spielen. 2. Sitz 1 wählt eine der 3 Karten (Standard), die Gabe an den Gegner öffnet das Hand-Interaktions-Fenster. 3. Sitz 1 antwortet mit Ambush the Scout (Ja).
- **Erwartet** (Kartentext Ambush: „Negate that effect." – nach Skriptkopf wird „NUR DER TEILEFFEKT" negiert; Birthday Present: „add the other 2 cards to your hand"): Keine Karte geht verloren. Entweder legen sich die 3 Karten zurück aufs Deck, oder die beiden eigenen gehen auf die Hand und nur die Gabe entfällt.
- **Beobachtet:** Fireball, Beer und Coffee sind danach in keiner Zone mehr (Kartenbilanz −3; Deck −3, Hand unverändert, Ablage nur „Birthday Present"). Log: `birthday_present_negated`.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/02-birthday-present-negiert-karten-weg.js`
- **Vermutete Ursache:** `birthday-present.js` Schritt 7 (Z. 209): nach `checkHandInteractionReaction(oppIdx, 'insert', …)` folgt `return`, ohne die per `engine.takeTop` entnommenen `revealed`-Karten zurückzulegen (der frühe Abbruch bei zu kleinem Deck, Z. 103, macht es mit `engine.returnToPile` richtig).

### F01-03 · Bamboo Shield: der Angebots-Merker bleibt stehen – das Schild wird nach dem ersten Angebot nie wieder angeboten · Stufe A
- **Karten:** Bamboo Shield (`cards/effects/bamboo-shield.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Sitz 1: Hand [Bamboo Shield ×2], 300 Gold; Sitz 0: „Attack" auf Held 0 von Sitz 1.
- **Schritte:** 1. Zug 5: Angriff, das Schild wird angeboten (Variante a: Ja, Variante b: Nein). 2. Zwei Zugwechsel (`t.endTurn()` ×2). 3. Zug 7: derselbe Angriff.
- **Erwartet** (Kartentext: „You can only play 1 "Bamboo Shield" per turn."): Einmal je Zug – in Zug 7 wird das Schild erneut angeboten (und im Ja-Fall negiert es den Schaden).
- **Beobachtet:** In Zug 7 kommt keine Abfrage (`t.prompts` leer), der Held verliert die vollen Trefferpunkte. `gs._bsPromptedFor = {1:true}` steht seit Zug 5 (nach Einsatz wie nach Ablehnung). Das Schild ist damit für den Rest der Partie tot, bis zufällig eine alte `_resolveChain` läuft.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/03-bamboo-shield-merker-bleibt-stehen.js`
- **Vermutete Ursache:** `bamboo-shield.js` `_markPrompted` (Z. ~260) setzt den Merker, abgeräumt wird er nur im Hook `onChainResolve` (Z. 247) – den die Engine nur aus der alten `_resolveChain` feuert (`_engine.js:6193`). Die Schwesterkarte Spectral Armor hatte genau diesen Fehler und wurde in v1378 mit zusätzlichen Aufräumern in `onAnyActionResolved` / `afterSpellResolved` / `onTurnStart` repariert (`spectral-armor.js` Z. 268–285); Bamboo Shield wurde dabei vergessen.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
