# Fix-Welle 66b – Kosten und Limits erst nach dem Commit · Fantasy Buddys teilen EINE Zone

Umgesetzt vom Agenten **W66b** (Zweig `wave66/W66b`). Entscheidungen von Al (23.10.2026):

1. „Wird einer der Effekte abgebrochen, werden dadurch alle Limits nicht verbraucht. Außerdem werden eventuelle Kosten wie Opfer oder Gold **generell** immer erst bezahlt, wenn committed ist und nicht mehr abgebrochen werden kann!"
   (Skullmael's Greatsword, Call of the Deepsea, Guardian Beast Hu: JA.)
2. Kosten bei Kreaturen (Opfer, Schaden, Bleed): „Nein, die Reihenfolge dort ist aktuell richtig" – unverändert; geprüft, dass „bezahlt" nie VOR der letzten Abbruchstelle der Kostenwahl passiert.
3. Fantasy Buddys teilen eine Zone mit ALLEN Fantasy Buddys, unabhängig vom Spell-Namen.

Vertragsabsatz mit Prüfliste für neue Karten: `cards/effects/CARD_API.md`, Abschnitt „★ KOSTEN UND LIMITS ERST NACH DEM COMMIT"; Details, Verstoß-Tabelle und Rückfragen: Abschnitt „Welle 66 / W66b".

## Befunde und Umsetzung

| Befund | Umsetzung |
|---|---|
| **Skullmael's Greatsword**: Einmal-Sperre, Banner und Animation VOR der Opfer-/Tributwahl der beschworenen Kreatur; Abbruch ließ Sperre verbraucht, Gegner sah Banner + Animation. | `summonFromPile(…, { nachKostenAnim })`: Kostenwahl zuerst, danach HOPT → Banner → Animation → Landung. |
| **Call of the Deepsea**: HOPT, Banner, Strudel und das LÖSCHEN der besiegten Karte vor der Kostenwahl. | Wie Skullmael; „delete it" erst in `nachKostenAnim`. |
| **Guardian Beast Hu**: Aktivierung und 5 Löschkosten samt Animation gingen beim Öffnen der Aktionswahl an den Gegner. | Kosten im unsichtbaren Kosten-Vorlauf (`engine.imKostenVorlauf`), Abbruch gibt exakt zurück; `performImmediateAction(AnyHero)` kein Schritt-Primitiv mehr. |
| **Terror-Zähler** zählte abgebrochene Kreaturen-/Trank-Spiele mit (14 Handkarten im Sweep) und konnte den Zug beenden. | `engine.beiCommit(fn)` (neu): Zählung beim Commit. |
| Absichts-Marken `_requestedNormalSummonSlot` / `_requestedBouncePlaceSlot` blieben nach Abbruch stehen. | `finally` in `doPlayCreature`. |
| **Monster Nest**, `summonFromDeck`, `summonFromPile('deck')`: Deck wurde schon vor der Kostenwahl bzw. beim Abbruch gemischt. | Entnahme ohne Mischen, exakte Rückgabe an den Index (`deckRueckgabe`), Mischen erst nach der letzten Abbruchstelle. |
| **Locke, the Unseen Saboteur**: HOPT vor der abbrechbaren Zielwahl. | Stempel nach bestätigter Zielwahl. |
| Pile-Wege × sich selbst legende Kreaturen (**500 Piranhas in a Monster Suit**): Karte doppelt, Sperre offen, falsche Handkopie genommen. | `kernOpts._selbstGelegt`; Piranhas nimmt nur bei Beschwörung von der Hand eine Handkarte. |
| **Fantasy Buddys** verschiedener Zauber bekamen getrennte Zonen. | `_alice-shared.js`: `FANTASY_BUDDY_TEILNAME`, `teilName`, `canShareInto` über Teil-Namen; Inya, Guard Change, Slippery Skates, Paraseed Greenhouse angepasst. Client unverändert. |

* **Harness:** `lib/zustand.js` (Vollzustands-Schnappschuss/-Diff), `lib/zustands-sweep.js`, `lib/abbruch-waechter.js`; `W.pruefeDurchlauf` prüft jetzt „Zustandsdifferenz nach Abbruch = 0" und „an Abbruchstellen ist noch nichts bezahlt".
* **Sweep:** 1184 Handkarten und 257 Aktivierungen, beide Sitze: Differenz 0 nach Abbruch bei allen außer den oben korrigierten.
* **Nicht angefasst:** Kartentexte in `data/cards.json`; Client (`public/`, daher kein `build.js`-Lauf); `repro-status.json`/Index (W66a/W66c parallel).
* **Dokumentierte Reservierungen** (unsichtbar, exakt zurück): Guardian Beast Hu (Löschkarten), Monster Nest, Entnahme der gespielten Karte vor der Kostenwahl, HOPT-Vorstempel der Aktivierungswege. Letter of Misinformations verbraucht bewusst auch bei „Take none" (Trigger hat schon Hand aufgedeckt/gemischt).
* `Bugfix-Note` stehen in den Commit-Nachrichten.

## Tests

`docs/niche-tests/repro/W66/b-01 … b-14` (alle auf dem Stand vor W66b rot, außer b-14 als Wächter-Test); Ergebnisse der Läufe: siehe CARD_API.md „Welle 66 / W66b", Abschnitt 5.
