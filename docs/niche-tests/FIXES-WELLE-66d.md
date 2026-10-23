# Fix-Welle 66d – Plant Golem: Racket Arrow / Chasing the Legend → Hand des ursprünglichen Owners

Agent **W66d** (Zweig `wave66/W66d`), Entscheidung von Al (23.10.2026), Ergänzung zu W64c. Details, Wegetabelle und Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 66 / W66d".

## Entscheidung
* **Racket Arrow** und **Chasing the Legend** (Texte „original owner's hand" / „its owner's hand") schicken auch den **Plant Golem** auf die Hand des **ursprünglichen Owners** (= Beschwörer; `owner`/`originalOwner`), nicht des Kontrolleurs (= Gegner, bei dem er liegt).
* **Allgemeiner Bounce** (alle anderen Effekte) bleibt W64c: Hand des Kontrolleurs, Herkunft/Platzmarke = Besitzer, späterer Abgang aus der Hand → Stapel des Besitzers.

## Befund und Behebung
Der Golem liegt auf dem Brett des Gegners: `controller` = Gegner = Brettseite, `owner` = Beschwörer. Zwei Stellen verwechselten `inst.owner` mit der Brettseite bzw. mit dem Kontrolleur:

| Weg | Verstoß | Behebung |
|---|---|---|
| Racket Arrow, allgemeiner Bounce (`returnSupportCreatureToHand`) | Zone über `inst.owner` geleert (falsches Brett): der Name blieb als **Geister-Eintrag** in der Support Zone des Gegners stehen | `engine.physicalSide(inst)` (`_deepsea-shared.js`) |
| Kidnapping, Capture Net, Sparkfly Worker/Queen (`stealBoardCardToHand`) | dasselbe: falsche Seite geleert → Geister-Name (gilt auch für Crimson Web am Angreifer) | `_brettSeite` = `physicalSide` (`_sparkfly-shared.js`); Capture-Net-Animation auf dem richtigen Brett |
| Chasing the Legend, Surprising Opportunity (`actionMoveCard … toPlayer`) | `toPlayer` wurde nur gelesen, wenn es von `inst.owner` abwich; beim Golem ist `owner` = Besitzer = `toPlayer` → verworfen, der Golem landete in der Hand des Kontrolleurs | Vergleich mit dem **Kontrolleur** (Standardziel des Bounce) in `_engine.js` |
| `actionMoveCard` Brett → Hand (Animation/Hooks) | Flug (`fromOwner`), `creature_zone_move` und `onCardLeaveZone.fromOwner` nannten den Beschwörer statt der Brettseite | `physicalSide` (für jede gewöhnliche Kreatur derselbe Wert) |

**Ohne Befund** (Spielweg, beide Sitze): Beschwörung über `host.doPlayCreature` mit Server-Hinweis-Zone und per Zonenabfrage; Aktionssperre (`blocksHostHeroActions`) nur am Wirtsheld und nach jedem Bounce weg; kein Geister-Eintrag/Geister-Instanz im Normalfall; Zielwahl Racket Arrow (Golem nur für seinen Besitzer wählbar, nicht für den Kontrolleur); Besitzer-Wächter ohne Verstoß; Abwerfen aus der Hand → Ablage des Besitzers; erneutes Ausspielen nach dem Bounce.

Geändert: `_engine.js`, `_deepsea-shared.js`, `_sparkfly-shared.js`, `capture-net.js`. Kartentexte (`data/cards.json`) und `plant-golem.js` unverändert. `Bugfix-Note` in der Commit-Nachricht: Racket Arrow, Chasing the Legend, Kidnapping, Capture Net, `_engine`.

## Tests (Exit 0 = korrekt)
| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W66/d-01-plant-golem-bounce-racket-arrow-chasing-ursprungs-owner-sonst-kontrolleur.js` | Beschwörung (Hinweis/Abfrage) · Racket Arrow (Besitzer-Nutzer; erneut spielbar; Kontrolleur: kein Ziel; vom Kontrolleur ausgespielter Golem) · Chasing the Legend (Verursacher × Halter, 4 Fälle) · allgemeiner Bounce (`returnSupportCreatureToHand`, `actionMoveCard`, Kontrolleur spielt ihn selbst, Abwerfen → Besitzer) · Kidnapping · Capture Net (Besitzer und Kontrolleur als Nutzer) · `toPlayer`-Empfänger; je beide Sitze | 330 | rot (46 ✗) |

## Rückfrage an Al (Ja/Nein)
1. Spielt der Kontrolleur O einen allgemein gebounceten Golem selbst aus, liegt er bei S (`controller` = S, `originalOwner` = S, `owner` = O). Racket Arrow/Chasing schicken ihn dann an S (ursprünglicher Owner) — gewollt (so umgesetzt) oder an O (zuletzt ausgespielt)?
