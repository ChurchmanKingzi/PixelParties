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

### F01-04 · Blade of the Frostbringer: Kreaturen haben keine „nicht in 2 aufeinanderfolgenden Zügen"-Sperre · Stufe B
- **Karten:** Blade of the Frostbringer (`cards/effects/blade-of-the-frostbringer.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 trägt die Klinge an Held 0, Hand 3× Attack; Ziel A gegnerischer Held, Ziel B gegnerische Kreatur (ZZ Dummy Big).
- **Schritte:** 1. Zug 5: Angriff auf das Ziel (genau 1 Ziel) → gefroren. 2. Zwei Zugwechsel (Eis hält durch Zug 6, taut an dessen Ende). 3. Zug 7: gleicher Angriff.
- **Erwartet** (Kartentext: „A target cannot be Frozen in 2 consecutive turns by this effect."; Skriptkopf ③: „handled automatically by the existing thaw-immune system"): In Zug 7 wird das Ziel nicht erneut eingefroren.
- **Beobachtet:** Held: Status `immune` nach dem Auftauen, Zug 7 kein Einfrieren (in Ordnung). Kreatur: keine Immunität – in Zug 7 sofort wieder `frozen`; die Kreatur ist damit in den Zügen 5, 6, 7, 8 gefroren.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/04-frostbringer-kreatur-nie-immun.js` (✗ bei „Kreatur: Zug 7 nicht erneut gefroren")
- **Vermutete Ursache:** `blade-of-the-frostbringer.js` Z. ~104–126 (Kreaturenzweig) prüft nur `inst.counters.frozen`; die Auftau-Immunität ist Heldenlogik (`_engine.js` ~45143, `addHeroStatus(ap, hi, 'immune')`), für Kreaturen gibt es kein Gegenstück.

### F01-05 · Cool Cheese: das „doppelte Kosten"-Angebot gilt schon ab 4 Gold und kostet dann weniger als 8 · Stufe B
- **Karten:** Cool Cheese (`cards/effects/cool-cheese.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Cool Cheese], Deck [Attack, ZZ Dummy], Gold 4 / 5 / 7 / 8 / 9; das Angebot „Pay 4 more" wird angenommen.
- **Schritte:** 1. Cool Cheese spielen. 2. Attack aus der Galerie wählen. 3. „Pay 4" bestätigen.
- **Erwartet** (Kartentext: „Unless you double this Artifact's Cost, you cannot use Attacks with that name for the rest of this turn."): Kosten 4 → verdoppelt 8; wer keine 8 Gold hat, kann nicht verdoppeln, der Name ist gesperrt.
- **Beobachtet:** Bei 4, 5 und 7 Gold kommt das Angebot trotzdem; angenommen sinkt das Gold auf 0 (gezahlt 4 / 5 / 7) und der Name ist NICHT gesperrt. Ab 8 Gold stimmt es (8 gezahlt, 9 → 1 übrig).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/05-cool-cheese-doppelte-kosten-nicht-bezahlt.js` (✗ bei Gold 4, 5, 7)
- **Vermutete Ursache:** `cool-cheese.js` Z. 111 (`if ((ps.gold || 0) >= EXTRA_COST)`) prüft das Gold, bevor die Grundkosten abgebucht sind: `server.js doConfirmPotion` (Z. ~11376) bucht Artefakt-Kosten ohne `manualGoldCost` erst NACH `resolve`, `_payCardCost` klemmt bei 0. Geprüft werden müsste `gold >= 2 × Kosten` (oder `manualGoldCost`). Nebenbefund: Cute Camera ist davon nicht betroffen (gemessen: Gold 7 → 0, Gold 6 → 2, kein Angebot).

### F01-06 · Charm of Balance: zählt die gerade aufgelöste Karte zur Hand und übersieht Handzugänge ohne Hook · Stufe B
- **Karten:** Charm of Balance (`cards/effects/charm-of-balance.js`); auslösend: Boomerang, Capture Net, Cool Cheese, Cute Cheese (a) und Birthday Present (b)
- **Voraussetzungen / Aufbau:** (a) Seed 1234, Charm an Held 0, Hand = genau 7 Karten (die gespielte Artefaktkarte + 6 Füller), die Karte holt 1 Karte auf die Hand. (b) Charm-Besitzer hat 7 Karten, der Gegner spielt Birthday Present und schenkt ihm eine Karte.
- **Schritte:** (a) Artefakt spielen (Galerie/Ziel erste Wahl). (b) Birthday Present von Sitz 1 spielen, Geschenk annehmen.
- **Erwartet** (Kartentext: „If you ever have more than 7 cards in your hand, send this equipped card to the discard pile."; Engine-Konvention `handSizeWithoutResolving`, CARD_API.md Z. ~18110: „Handgroesse ohne die aufloesende Karte … Handlimit und Pollution rechnen jetzt ebenso"): (a) 6 + 1 = 7 Karten → Charm bleibt. (b) 8 Karten → Charm geht sofort in die Ablage.
- **Beobachtet:** (a) Alle vier Karten werfen den Charm ab (Hook-Zeitpunkt: Hand = 8, weil die gespielte Karte erst nach `resolve` die Hand verlässt); Endstand 7 Karten ohne Charm. (b) Hand 8, Charm bleibt liegen (erst der `onTurnStart`-Sweep würde ihn fangen).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/06-charm-of-balance-handlimit-zaehlt-gespielte-karte.js`
- **Vermutete Ursache:** (a) `charm-of-balance.js` Z. 58 `(ps.hand || []).length <= HAND_LIMIT` statt `engine.handSizeWithoutResolving(pi)`. (b) `birthday-present.js` Z. 215/220 schiebt per `handZugangSync` (ohne `onCardAddedToHand`/`onDraw`); der Charm-Kommentar („rare — the hand-grow primitives all funnel through them") unterstellt, dass alle Wege durch die Hooks laufen.

### F01-07 · Cloud Pillow / Beer / Dark Gear: „you control" / „your opponent controls" folgt der Brettspalte, nicht der Kontrolle (gestohlene Kreaturen) · Stufe B
- **Karten:** Cloud Pillow (`cards/effects/cloud-pillow.js` Z. 49), Beer (`beer.js` Z. 69), Dark Gear (`dark-gear.js` `getStealableCreatures` Z. ~87: „Choose a Creature your opponent controls" – eine mir vom Gegner gestohlene Kreatur in meiner Spalte ist nie wählbar, Zurückholen unmöglich); Quelle ist `engine.getCreatureTargets(pi)` – betrifft vermutlich jede Karte, die es für „you control" benutzt
- **Voraussetzungen / Aufbau:** Seed 1234, Sitz 0 am Zug mit Cloud Pillow bzw. Beer. (1) Sitz 0 hat die Kreatur von Sitz 1 gestohlen (`actionStealCreature(0, inst)`, wie Deepsea Succubus/Cute Conversion: Kreatur bleibt in der Spalte von Sitz 1, `controller` = 0). (2) Sitz 1 hat eine Kreatur von Sitz 0 gestohlen (steht weiter in Spalte 0, `controller` = 1).
- **Schritte:** Karte spielen, angebotene Kreaturen-Ziele mitschneiden, Zielwahl abbrechen.
- **Erwartet** (Kartentext „Choose a target you control" / „targets you control"; CARD_API.md Z. 18826 „Kontrolle statt Seite" – die Heldenzweige beider Karten halten sich bereits daran): (1) wird angeboten, (2) nicht.
- **Beobachtet:** Genau umgekehrt. (1) Zielliste leer – die von mir kontrollierte Kreatur fehlt; (2) die mir gestohlene, vom Gegner kontrollierte Kreatur wird als „target you control" angeboten (bei Cloud Pillow bekäme sie dann sogar meinen Cloudy-Schutz, die Instanz-Suche in `resolve` Z. ~90 nimmt `c.owner === pi`).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/07-cloud-pillow-beer-ziel-you-control-gestohlene-kreaturen.js` (5 × ✗, davon 1 × Dark Gear)
- **Vermutete Ursache:** `_engine.js` Z. 40250 `getCreatureTargets(playerIdx)` durchläuft nur `gs.players[playerIdx].supportZones`; der Filter `(c.owner === playerIdx || c.controller === playerIdx)` greift nur innerhalb der eigenen Spalte. Ein Sammler „Kreaturen unter Kontrolle von pi" (analog `heroesControlledBy`) fehlt.

### F01-08 · Anti-Magnet spielbar ohne weitere eigene Ziele (Umleitung auf den Angreifer) · Stufe C
- **Karten:** Anti-Magnet (`cards/effects/anti-magnet.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hat nur EINEN Helden (Atta, keine Kreaturen) und Anti-Magnet auf der Hand, 100 Gold; Sitz 0 (3 Helden) greift diesen Helden mit „Attack" an.
- **Schritte:** 1. Attack auf Sitz 1 Held 0. 2. Anti-Magnet-Angebot annehmen.
- **Erwartet** (Kartentext: „…is chosen by an Attack, Spell or Creature effect **while you control other possible targets**"): wörtlich gelesen darf Anti-Magnet nicht gespielt werden, wenn der Besitzer außer dem gewählten Ziel nichts weiter kontrolliert.
- **Beobachtet:** Das Angebot kommt, 2 Gold werden bezahlt, der Schlag geht auf einen Helden des ANGREIFERS (Sitz 0 Held 1 −40 HP, Sitz 1 −0). Das Skript liest die Bedingung bewusst als „≥ 1 anderes gültiges Ziel des Effekts auf beiden Seiten" (Kopfkommentar Z. ~49–53; `getOtherValidTargets`, Z. ~75) – ein bewusster Entwurf, aber vom Kartentext („you control") abweichend.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/08-anti-magnet-ohne-eigene-weitere-ziele.js`
- **Vermutete Ursache:** `anti-magnet.js` `canRedirect` (Z. ~99–104) zählt `validTargets` beider Seiten, nicht nur die vom Besitzer kontrollierten.
- **Frage an Al:** Soll Anti-Magnet nur spielbar sein, wenn der Besitzer **selbst** ein weiteres mögliches Ziel kontrolliert (wörtlich), oder genügt ein beliebiges anderes Ziel des Effekts (heutiges Verhalten)?

### F01-09 · Blood-Soaked Coin: dauerhaft übernommene Ziele sind keine „target you permanently control" · Stufe C
- **Karten:** Blood-Soaked Coin (`cards/effects/blood-soaked-coin.js`), Dark Gear (`dark-gear.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. (a) Sitz 0 spielt Dark Gear auf Albrecht (Sitz 1) – die Kreatur steht danach in Sitz 0 Spalte, `owner`/`controller` = 0, `originalOwner` = 1; dann Blood-Soaked Coin. (b) `actionTakeHeroPermanently(0, 1, 0)` (Held `permaControlBy` = 0), dann Blood-Soaked Coin.
- **Schritte:** Coin spielen, Zielliste mitschneiden, Zielwahl abbrechen.
- **Erwartet** (Kartentext Coin: „Choose a target you **permanently control**"; Dark Gear: „take **permanent control** of it"): Ein dauerhaft übernommenes Ziel ist wörtlich ein „target you permanently control".
- **Beobachtet:** (a) Die Dark-Gear-Kreatur wird nicht angeboten (`originalOwner !== pi`), (b) der dauerhaft übernommene Held ebenfalls nicht (Heldenschleife nur über `gs.players[pi].heroes`, nur `charmedBy` wird geprüft). Das Skript sagt es im Kommentar ausdrücklich (Z. 60–64: „Dark-Gear'd … correctly excluded — opp still owns the card in deck/discard terms") – bewusste Lesart „permanently control = permanently own", vom Wortlaut abweichend.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/09-blood-soaked-coin-dauerhaft-uebernommene-ziele.js` (2 × ✗)
- **Vermutete Ursache:** `blood-soaked-coin.js` Z. 51–75 (`permanentlyOwnedHero`/`permanentlyOwnedCreature`), Z. 108–131 (`getValidTargets`).
- **Frage an Al:** Soll ein per Dark Gear bzw. dauerhaft übernommenes Ziel für Blood-Soaked Coin wählbar sein (Wortlaut „permanently control") – ja oder nein (heute: nein, nur ursprünglich eigene Karten)?

### F01-10 · Deepsea Idol: Auslöser zählt Kreaturen der Brettseite, die Wirkung schützt nach Kontrolle · Stufe B
- **Karten:** Deepsea Idol (`cards/effects/deepsea-idol.js`), Book of Doom als Schadensquelle
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hält Deepsea Idol (100 Gold), Sitz 0 spielt Book of Doom (50 Schaden) auf zwei Kreaturen. (i) Beide stehen in der Spalte von Sitz 1; die zweite hat Sitz 0 gestohlen (`controller` = 0). (ii) Sitz 1 kontrolliert beide: eine in der eigenen Spalte, eine aus Spalte 0 gestohlen (`controller` = 1, `owner` = 0).
- **Schritte:** Book of Doom auf beide Kreaturen, Idol-Angebot bejahen.
- **Erwartet** (Kartentext: „…when 2 or more Creatures **you control** would take damage from a single source. Negate all effects that damage source would have on Creatures you control"): (i) kein Angebot (nur 1 kontrollierte Kreatur betroffen); (ii) Angebot, Schaden an beiden negiert.
- **Beobachtet:** (i) Idol wird gespielt (4 Gold + Karte) und schützt nur die eigene Kreatur (0 Schaden; die gestohlene nimmt 50). (ii) Kein Angebot, beide Kreaturen nehmen 50 Schaden.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/10-deepsea-idol-zaehlt-brettseite-statt-kontrolle.js` (2 × ✗)
- **Vermutete Ursache:** `_engine.js` Z. 34435–34437 (`_checkCreatureDamageBatchReactions`): `ownDmgEntries = entries.filter(… e.inst.owner === pi)` (Seite/Besitzer), während `deepsea-idol.js` Z. 74 beim Schützen `(controller ?? owner) === pi` verwendet – die Zählung müsste ebenfalls nach Kontrolle laufen.

### F01-11 · Coffee / Angry Cheese: „a Hero you control" folgt der Brettspalte (geliehene/übernommene Helden) · Stufe B
- **Karten:** Coffee (`cards/effects/coffee.js` Z. 44–45), Angry Cheese (`angry-cheese.js` Z. 37, 51–52)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1 hat sich Sitz 0s Helden 1 geliehen (`actionStealHero(1, 0, 1)`), Sitz 0 hat Sitz 1s Helden 0 dauerhaft übernommen (`actionTakeHeroPermanently(0, 1, 0)`); alle Helden tragen einen alten Status (burned, Zug 3); Sitz 0 spielt Coffee bzw. Angry Cheese (Deck mit Zerstörungszauber).
- **Schritte:** Karte spielen, Zielliste mitschneiden, Zielwahl abbrechen.
- **Erwartet** (Kartentext „a Hero you control" / „Choose a Hero you control"; CARD_API.md Z. ~6065 „Wer nach Seiten rechnet, fragt nie die Spalte, sondern `heroSideOf` / `heroesControlledBy`"; Cloud Pillow und Beer halten sich daran): Angebot = von Sitz 0 kontrollierte Helden 0/0, 0/2, **1/0**.
- **Beobachtet:** Beide Karten bieten 0/0, **0/1**, 0/2 an: der an den Gegner verliehene Held 0/1 ist wählbar (Coffee entfernt Gegner-kontrollierten Status samt Zusatzaktion für ihn; Angry Cheese fügt ihm 100 Schaden zu), der selbst dauerhaft kontrollierte Held 1/0 fehlt. (Gegenprobe: Beer und Cloud Pillow bieten exakt 0/0, 0/2, 1/0 an.)
- **Repro:** `docs/niche-tests/repro/F01-artifacts/11-coffee-angry-cheese-helden-ziele-nach-spalte.js` (2 × ✗)
- **Vermutete Ursache:** beide Skripte laufen über `gs.players[pi].heroes` statt `engine.heroesControlledBy(pi)`.

### F01-12 · Cool Tech Jetpack: nach abgelehntem Angebot wird im selben Zug erneut angeboten · Stufe C
- **Karten:** Cool Tech Jetpack (`cards/effects/cool-tech-jetpack.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 trägt das Jetpack an Held 0 (3 Handkarten); Sitz 1 greift im eigenen Zug zweimal mit Fireball auf diesen Helden an.
- **Schritte:** 1. Erster Fireball: Angebot „abwerfen und negieren?" ablehnen (Nein). 2. Zweiter Fireball im selben Zug.
- **Erwartet** (Kartentext: „The **first time** every turn when the equipped Hero is chosen by a card or effect, you may discard 1 card to negate that card or effect."): wörtlich ist nur das ERSTE Gewähltwerden pro Zug das Fenster – nach einem Nein ist es vorbei.
- **Beobachtet:** Das zweite Gewähltwerden im selben Zug bietet das Jetpack erneut an; angenommen wird der Fireball negiert (0 Schaden).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/12-cool-tech-jetpack-angebot-nach-ablehnen-erneut.js`
- **Vermutete Ursache:** `cool-tech-jetpack.js` Z. 62–63 setzt die Einmal-pro-Zug-Marke erst nach erfolgreichem Abwurf (Z. 40 prüft sie); beim Ablehnen bleibt sie frei.
- **Frage an Al:** Zählt ein abgelehntes Angebot als „das erste Mal" (dann kein zweites Angebot im Zug – wörtlich) oder bleibt das Fenster bis zum ersten tatsächlichen Abwurf offen (heutiges Verhalten)?

### F01-13 · Bamboo Shield / Boots of Hermes ignorieren die Artefakt-Sperre (Boomerang, Blood-Soaked Coin) · Stufe B
- **Karten:** Bamboo Shield (`cards/effects/bamboo-shield.js`), Boots of Hermes (`boots-of-hermes.js`); Gegenbeispiele, die es richtig machen: Deepsea Idol, Cute Camera (Engine-Fenster `_engine.js` Z. 34523 / 37807 prüfen `ps._artifactLockTurn`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 hat Hand [Boomerang, Pyroblast, Reaktionskarte], Ablage [Beer]; Sitz 1 trägt Magic Mirror (Surprise) vor Held 0.
- **Schritte:** 1. Boomerang spielen (Beer holen; setzt `_artifactLockTurn`). 2. Pyroblast auf Held 0 von Sitz 1: die Surprise aktiviert (Boots-Fenster), ihre Kopie trifft Held 0 von Sitz 0 (Bamboo-Shield-Fenster) in MEINEM Zug. 3. Angebote bejahen.
- **Erwartet** (Boomerang: „You cannot play any Artifacts for the rest of this turn."; Blood-Soaked Coin: „You cannot play other Artifacts for the rest of the turn afterwards"): Reaktionsartefakte sind Artefakte, „Play this card immediately …" ist ein Spielen – kein Angebot, keine Karte gespielt.
- **Beobachtet:** Ohne Boomerang werden beide Karten angeboten (Gegenprobe ✓). Nach Boomerang kommt das Angebot trotzdem, Boots negiert die Surprise (+1 Karte), das Schild negiert den Schaden; beide landen in der Ablage.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/13-reaktions-artefakte-ignorieren-artefakt-sperre.js` (2 × ✗)
- **Vermutete Ursache:** Beide Skripte prüfen `ps._artifactLockTurn` nicht; ihre Auslösewege (Boots: Hook `onSurpriseActivated` mit eigenem Hand-Abzug, Z. ~110; Bamboo Shield: Schadensfenster) laufen nicht durch die Engine-Fenster, die die Sperre kennen. Nebenbeobachtung: `itemLocked` (Hammer Throw) wird von keiner der gemessenen Reaktionskarten belastet – aber „during their next turn" gilt nur für Züge des Betroffenen, daher nicht als Befund gewertet.

### F01-14 · Gigantisaur Skull: im eigenen Zug proaktiv spielbar · Stufe C
- **Karten:** Gigantisaur Skull (`cards/effects/gigantisaur-skull.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 am Zug mit Skull auf der Hand und 100 Gold; Sitz 1 hat eine Kreatur; kein aktiver Kreatureneffekt des Gegners läuft.
- **Schritte:** Skull spielen, die gegnerische Kreatur wählen.
- **Erwartet** (Kartentext: „…You can only activate this card during your opponent's turn in reaction to an opponent's Creature activating its active effect, and if you do, you must choose that Creature."): wörtlich nur als Reaktion im Gegnerzug aktivierbar.
- **Beobachtet:** Der Skull wird aus der Hand wie ein Normal-Artefakt gespielt (4 Gold), die Kreatur ist 1 Zug gefroren. Das Skript führt das ausdrücklich als „Dual-mode (mirrors Juice's proactive/reactive artifact pattern)" – bewusste Auslegung, vom Wortlaut abweichend (die Reaktivform ist ✓, siehe Tabelle „Getestet & in Ordnung").
- **Repro:** `docs/niche-tests/repro/F01-artifacts/14-gigantisaur-skull-proaktiv-im-eigenen-zug.js`
- **Vermutete Ursache:** `gigantisaur-skull.js` Z. 86 `proactivePlay: true` + `canActivate`/`getValidTargets` (proaktiver Pfad).
- **Frage an Al:** Soll der Gigantisaur Skull NUR als Reaktion im Gegnerzug spielbar sein (wörtlich), oder auch proaktiv im eigenen Zug auf eine beliebige Kreatur (heute)?

### F01-15 · Flying Island in the Sky: Kreaturen in den Inselzonen werden ohne Todes-Hooks entfernt – stattdessen feuert `onHeroKO` mit einem Phantom-„Helden" · Stufe B
- **Karten:** Flying Island in the Sky (`cards/effects/flying-island-in-the-sky.js` → Engine `removeIslandZones`); betroffen z. B. Exploding Skull in der Inselzone
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 legt die Insel an Held 0 (Zonen 3 und 4 kommen dazu), Exploding Skull steht in Slot 3.
- **Schritte:** 1. Die Insel verlässt das Brett (a: `actionMoveCard(insel, 'discard')`; b: der Träger stirbt, `actionDealDamage` 5000). 2. Hooks und Gegner-HP mitschneiden.
- **Erwartet** (Kartentext: „When this card is removed from a Hero, any Creatures in those Support Zones are **defeated**."; Exploding Skull: „When this Creature is defeated, deal 80 damage to all targets your opponent controls."): Die Kreaturen werden wie jede besiegte Kreatur behandelt, `onCreatureDeath` feuert, der Skull verteilt 80 Schaden; für Nicht-Helden feuert kein `onHeroKO`.
- **Beobachtet:** Der Skull liegt in der Ablage, der Gegner verliert 0 HP. Mitgeschnitten wird `onHeroKO` mit `{name: 'Exploding Skull', hp: 0}` (und bei b zusätzlich dem echten Träger) – aber kein `onCreatureDeath`. Jeder „Hero defeated"-Hörer sieht damit einen Phantom-Helden namens der Kreatur.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/15-flying-island-abbau-ohne-todes-hooks.js` (4 × ✗)
- **Vermutete Ursache:** `_engine.js` `removeIslandZones` (Z. 47790 ff.), Hook-Aufruf Z. 47828 `runHooks(HOOKS.ON_HERO_KO, { hero: { name: cardName, hp: 0 }, source: null })`, danach `discardPile.push` + `cardInstances`-Filter – statt `actionDestroyCard(…, { fireCreatureDeath: true })`. (CARD_API.md Z. ~7100 regelt nur die Mehrzonen-Kreaturen ausdrücklich anders: Ablage ohne Tod; für Ein-Zonen-Kreaturen gilt der Inseltext „defeated".)

### F01-16 · Flying Island in the Sky: ein Token in der Inselzone landet beim Abbau in der Ablage · Stufe A
- **Karten:** Flying Island in the Sky (Engine `removeIslandZones`), betroffen jeder Token auf der Insel (Mummy Token, Biomancy Token, …)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Insel an Held 0 von Sitz 0, ein Mummy Token in Slot 3.
- **Schritte:** Die Insel geht in die Ablage (`actionMoveCard`).
- **Erwartet** (README §4 Familie 4 / Engine-Konvention „Tokens kommen nie in die Ablage"; Gegenprobe im Repro: derselbe Token stirbt durch Schaden → Gelöscht-Stapel ✓): Token im Gelöscht-Stapel, Ablage nur die Insel.
- **Beobachtet:** „Mummy Token" liegt in der Ablage von Sitz 0 (Phantomkarte, per Ablage-Rückholeffekt auf die Hand holbar).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/16-flying-island-abbau-token-in-ablage.js`
- **Vermutete Ursache:** `_engine.js` Z. 47831–47832 `islandDiscardPs.discardPile.push(cardName)` ohne Token-Weiche. Gleiche Klasse wie M01-08/H04 (Token über `actionDestroyCard`/`actionMoveCard` → Ablage), aber eigener Codepfad – ein Fix an `actionMoveCard` allein deckt ihn nicht ab.

### F01-17 · Bow of the Hunt Goddess: der Karteneffekt ist nirgends umgesetzt · Stufe A
- **Karten:** Bow of the Hunt Goddess (`cards/effects/bow-of-the-hunt-goddess.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Held 0 trägt den Bow, Deck [Flame Arrow, Poisoned Arrow, Füller], 100 Gold, Hand [Attack]; Sitz 1 ohne Reaktionen.
- **Schritte:** 1. Sitz 0 greift mit „Attack" Held 0 von Sitz 1 an.
- **Erwartet** (Kartentext: „Once per turn, when the equipped Hero performs an Attack, you may search your deck for an "Arrow" Artifact and play it directly from your deck in reaction to the Attack. You still need to pay its Cost."): Es erscheint das Angebot, einen Arrow aus dem Deck zu suchen und zu spielen.
- **Beobachtet:** Kein Prompt, Deck unverändert (5 Karten, beide Pfeile noch drin), nichts gespielt. Die Skriptdatei hat nur `isEquip`/`equipOwnSideOnly` und behauptet im Kopf „die Karte wirkt über ihre Kartendaten"; `grep -rn "Hunt Goddess"` findet den Namen sonst nur in `scripts/curate-skilltest-legal.js` – weder `_arrows-shared.js` noch `_engine.js`/`server.js` implementieren die Klausel (der alte Test `ui-secret-batch.js` nutzt den Bow nur als Requisit).
- **Repro:** `docs/niche-tests/repro/F01-artifacts/17-bow-of-the-hunt-goddess-effekt-fehlt.js`
- **Vermutete Ursache:** fehlende Umsetzung (Reaktionsfenster auf eigenen Attack, Deck-Suche nach Namensteil „Arrow", Einmal-pro-Zug, Kosten zahlen, Spielen aus dem Deck).

### F01-18 · Diver Helmet wird von „The Seventh Circle of Hell" und „Dark Ocean" ignoriert · Stufe B
- **Karten:** Diver Helmet (`cards/effects/diver-helmet.js`), The Seventh Circle of Hell (`the-seventh-circle-of-hell.js`), Dark Ocean (`dark-ocean.js` + Engine)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. (a) Sitz 0 trägt den Helm an Held 0 und hat eine Kreatur in dessen Zone; Seventh Circle liegt bei Sitz 1; Sitz 0 beendet seinen Zug. (b) Dark Ocean liegt; je eine Kreatur am Helm-Helden und am Helden ohne Helm erleidet 50 Schaden vom Typ `creature`.
- **Schritte:** (a) `t.endTurn()`, Zielwahl mitschneiden. (b) `actionDealCreatureDamage` auf beide.
- **Erwartet** (Kartentext Helm: „The equipped Hero and all cards in its Support Zones are unaffected by Areas."; CARD_API.md Z. 4976 „Areas — respect Diver Helmet (MANDATORY for every Area)" – ausdrücklich auch „being chosen/targeted by the Area's own optional action"): (a) Helm-Held und seine Kreatur stehen nicht in der Zielliste und nehmen keinen Schaden. (b) Die Helm-Kreatur nimmt den Schaden normal (die Area betrifft sie nicht), die andere nicht.
- **Beobachtet:** (a) Die Zielliste enthält `hero:0/0` und `equip:0/0/1`; mit Wahl auf den Helm-Helden verliert er 100 HP. (b) Beide Kreaturen bleiben unverletzt (Dark Ocean blockt auch bei Helm). Die übrigen 42 Areas sind in einer Differenzmessreihe (jede Area bei Sitz 0 und Sitz 1, Helm-Held + Kreatur, Schaden und zwei Zugwechsel, mit/ohne Area) unauffällig; Einschränkung: nur Areas, die in diesem Ablauf überhaupt eingreifen.
- **Repro:** `docs/niche-tests/repro/F01-artifacts/18-diver-helmet-seventh-circle-dark-ocean.js` (3 × ✗)
- **Vermutete Ursache:** (a) `the-seventh-circle-of-hell.js` Z. 58–62: `ziele = [...getHeroTargets(tp), ...getCreatureTargets(tp)]` ohne `heroHasDiverHelmet`/`isAreaImmuneInst`; dasselbe gilt für den Abgangs-Zweig (150 Schaden). (b) `_engine.js` Z. 46292 ff. (Dark-Ocean-Block der Kreaturen-Schadenssammlung) ruft `_isDiverHelmetProtectedTarget` nicht auf (Z. 27290 stellt es bereit).
- **Hinweis zur Einordnung:** Das Skript hält fest, dass der Zugspieler „seine eigenen Ziele selbst" wählt und Submerged/Stealth dann nicht schützen (Ruling 9.10., `festesZiel`). Der Helm ist aber keine Zielwahl-Sperre, sondern „unaffected by Areas" – das Ruling deckt ihn nicht ab.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
