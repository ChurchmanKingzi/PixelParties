# Fix-Welle 71 (W71b) – Cool Rescuer Monia reagiert auf JEDEN Effekt, der Kreaturen betrifft

Umgesetzt vom Agenten **W71b** (Zweig `wave71/W71b`) auf Wunsch von Al vom 25.10.2026 (Tester: „Racket Arrow und Dark Gear fehlen, wahrscheinlich noch viel mehr").
Kartentext (unverändert): „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures."

## Ausgangslage
Monia fragte nur an zwei Stellen: `beforeCreatureDamageBatch` (Schaden) und `beforeCreatureAffected` (Zerstören, Status, Heilung, `actionMoveCard`). Alles, was eine Kreatur auf anderen Wegen veränderte (Kontrollwechsel, Bounce über eigene Wege, Buffs/Zähler, Max-HP/HP-Tausch, Status entfernen, rohe Zonen-Schreibzugriffe in Kartenskripten), hatte kein Fenster.

## Zentrale Lösung (`cards/effects/_engine.js`)
* **`engine.kreaturBetroffen(inst, art, quelle, opts)`**: die EINE Frage „darf dieser Effekt diese Kreatur betreffen?" → Hook `beforeCreatureAffected` (Monia, Elusive Hind, Winged Skeleton …). Arten: `destroy`, `heal`, `status`, `move`, `control`, `buff`, `counter`, `stats`. `kreaturenVorab(...)` öffnet das Fenster vorab für mehrere Kreaturen (Iceage, Medusa's Curse: erst Helden, dann Kreaturen).
* **Ein Angebot je Karte/Effekt**: Buchführung `gs._kreaturFenster` (Kreatur|Art|Quelle, gleiche Auflösung) in `runHooks`; Monias eigene Buchführung `gs._moniaAngebote` je Seite; Ablehnung gilt je Seite, Annahme schützt die gefragte Seite.
* **Eingebaut in die Primitive** (NACH Immunität/Tor/Regeln, VOR der ersten Änderung): `actionTransferCreature` (Dark Gear, Diplomacy, Capture …), neu `actionStealCreatureGefragt` (Cute Conversion, Deepsea Succubus, Molinda, Lovely Teddy, Treacherous Crystal; `server.js`), `returnSupportCreatureToHand` (Racket Arrow, Kidnapping/Capture Net), `actionMoveCard` (jetzt MIT Quelle), Buff setzen/entfernen, `cleanseCreatureStatusesGefragt` (Beer, Juice, Cure, Tea, Exorcism …), `sendBoardCardToDiscard` mit `fenster` (Breakthrough). Kartenskripte, die den Zustand fremder Kreaturen direkt schreiben, rufen `kreaturBetroffen` selbst (siehe Matrix).
* **Nicht gefragt (dokumentierte Ausnahmen, Wächter-Liste `AUSNAHMEN`)**: Opfer/Tribut als Kosten, Selbst-Effekte, Zielwahl ohne Wirkung, natürliches Auslaufen (Status/Buff-Dauer), dauerhafte Auren (Sun Sword, War Counselor), Tearing Mountain (Ruling 23.10.), Erlaubnisse (Aligning Goals, Spy), Sirenen-Verknüpfung.
* **Regeln wie W13/Q144/W58a**: gefragt wird nur der aktuelle Kontrolleur, nur aktive Monia, Hand nicht leer, `moniaSchildBlockt` gilt, Kosten (Abwurf) erst nach Annahme, eigene Effekte sind ebenfalls negierbar. Aufforderung mit Titel „Cool Rescue!", Kartenbild und Name der auslösenden Karte; CPU (W58a): nimmt Kontrollwechsel/Bounce der eigenen Kreatur durch den Gegner an, lehnt Eigeneffekte, Kleinkram und unbekannte Quellen ab.

## Matrix: Karte | Effektart | Monia-Fenster vorher → nachher
(Quelle „vorher": Wächter-Sweep auf dem Ausgangsstand 4d4dcd46 + Repros b-01…b-07 auf dem Ausgangsstand rot.)

| Karte | Effektart | vorher | nachher |
|---|---|---|---|
| Racket Arrow | Bounce zur Hand des Besitzers | nein | ja (`returnSupportCreatureToHand`, `move`) |
| Kidnapping, Capture Net | Kreatur auf die Hand | nein | ja (`move`) |
| Dark Gear, Diplomacy, Capture | dauerhafte Übernahme | nein | ja (`actionTransferCreature`, `control`) |
| Cute Conversion, Deepsea Succubus, Molinda, Lovely Teddy, Treacherous Crystal | zeitweise Übernahme | nein | ja (`actionStealCreatureGefragt`, `control`) |
| Chasing the Legend | Kreatur zurück auf die Hand | nein | ja (`actionMoveCard` mit Quelle; Schadensabzug nur bei Negation nicht geblankt) |
| Hand of Death | besiegen (verzögert) | Angebot ohne Kartennamen | ja, mit Kartennamen |
| Decapitating Strike | besiegen (Reaktion) | zweites Angebot fehlte | ja (eigenes Angebot) |
| Missing People | Deckende | nein | ja (`move`) |
| Mass Routing | zurückmischen (beide Seiten) | nein | ja, 1 Angebot je Seite |
| Breakthrough | offene Surprise-Kreatur abwerfen | nein | ja (`destroy`) |
| Cloud Pillow, Disruption Ray, Golden Wings, Thicket, Perfect Disguise | Buff / Unzielbarkeit / Zähler | nein | ja (`buff`) |
| Anti Magic Zone, Pink Sky | Fläche: Silence / Negate | nein | ja (`fensterTrotzdem`, je Seite 1 Angebot) |
| Experimental Potion, Toxic Fumes, Iceage, Medusa's Curse | Status (Gift, Frost, Stein …) | teils falsche Zählung | ja, 1 Angebot je Seite (`kreaturenVorab`) |
| Life Serum, Voodoo Curse, Phoenix Bombardment, Maya, Steam Dwarf Brewer, Divine Gift of Equality, Barrier of Undying | Max-HP/HP setzen, tauschen, halbieren, auf 1 setzen | nein | ja (`stats`) |
| Beer, Juice, Cure, Tea, Exorcism, Elixir of Recovery, Divine Zeal, Light Ball, The Melting, Waitress, Candlestick Squire, Frost Breaker, Thaw Blader, Healing Potion | Status entfernen / heilen | nein / teils | ja (`cleanseCreatureStatusesGefragt`, `status`) |
| Guard Change, Ushabti, Slippery Ice, Slippery Skates, Slippery Pengu | Kreaturen verschieben / tauschen | nein | ja (`move`) |
| Wendy the Shy Girl, Moonlight Butterfly, Creepy Villager, Dark Deepsea God | Bounce / Bewegen (neue Karten, Anpassung an den Vertrag) | – | ja (`Bugfix-Skip`) |
| Cactus Creature | umgeleiteter Status auf die Zielkreatur | nein | ja (`status`; die Selbstbereinigung der Kreatur bleibt frei) |

## Gesamtbilanz Sweep (Wächter: „Kreatur wurde betroffen, ohne dass Monia gefragt wurde")
| Sweep | Karten | Läufe | Funde vorher | Funde nachher | Fenster vorher → nachher |
|---|---|---|---|---|---|
| Handkarten (echte Bretter) | 1188 | 4752 | 314 | 0 | 1091 → 2338 |
| Aktivierungen | 269 | 538 | 15 | 0 | 139 → 263 |
| Passive | 859 | 1718 | 4 | 0 | 13801 → 17337 |
| Reaktionen / Surprises | 191 | 3056 | 20 | 0 | 1544 → 1576 |

## Repros (`docs/niche-tests/repro/W71/`, alle auf dem neuen Stand grün, auf dem Ausgangsstand rot)
b-01 Racket Arrow + Chasing the Legend · b-02 Übernahmen (Dark Gear, Diplomacy, Capture, Kidnapping, Cute Conversion, Succubus, Treacherous Crystal) · b-03 Zerstören (Hand of Death, Decapitating Strike, Missing People, Mass Routing) · b-04 Buffs/Zähler/Status · b-05 Heilen/Werte · b-06 Verschieben · b-07 Flächeneffekte · b-08…b-12 Sweeps „kein Primitiv ohne Fenster" (Handkarten Sitz 0/1, Aktivierungen/Passive Sitz 0/1, Reaktionen/Surprises) · b-13 Gegenprobe (Kosten, Opfer, Selbst, Zielwahl, Auslaufen, Auren fragen NICHT) · b-14 ein Angebot je Effekt und Seite, Kosten erst nach Annahme, CPU.

## Rückfragen an Al (Ja/Nein, nicht geraten)
1. Ist ein **Opfer/Tribut als Kosten** (Teocuilatl, Suspicious Monster, Occultism …) ein „Effekt auf die Kreatur"? Jetzt: Nein (Ruling 1.8.).
2. Zählt **reine Zielwahl** (Anvisieren ohne Wirkung) als „betroffen"? Jetzt: Nein.
3. Schützt eine **angenommene Monia nur die gefragte Seite** (so jetzt bei Flächeneffekten: je Seite ein Angebot) — oder soll ein Abwurf beide Seiten gleichzeitig schützen („all Creatures")?
4. Soll **Tearing Mountain** (Ruling 23.10.: negiert jeden Schutz vor Brennen) weiter an Monia vorbei brennen? Jetzt: Ja.

## Ergebnis der Gesamtläufe
* **Repros W71/b-01 … b-14**: alle grün (Exit 0); auf dem Ausgangsstand 4d4dcd46 sind b-01 … b-07, b-13 und b-14 rot (z. B. b-02 135 von 273 Prüfungen, b-04 113 von 257), die Sweeps b-08 … b-12 finden dort 353 Verstöße (28 Karten).
* **Gesamtlauf** (`runall`, alle 1428 Repros inkl. `W71/b-*`; Zeitlimit je Datei 300 s): 1423 × „tritt NICHT auf" (= korrekt), 5 rot. Davon vorbestehend und nicht Teil dieser Welle: `W66/a-03`, `W67/a-01` (Inya-Token-Sweeps). Drei Altrepros brauchten eine Anpassung an den neuen Vertrag und sind danach grün: `N5-sonstige/01` und `W24/e-02` (laden `doTriggerTreacherousCrystal` aus `server.js`, das jetzt `async` ist), `W64/c-04` (Testaufbau übernahm ein Winged Skeleton ohne Verursacher — Winged Skeleton negiert die Übernahme jetzt selbst; Aufbau nutzt `_skipAffectedWindow`).
* `scripts/check-*.js`: alle grün außer `check-scope.js` (Altstellen, identisch zum Ausgangsstand). `node --test test/*.test.js`: 10/10 grün.
* E2E (`NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node-tools/node_modules`): `draw-cards`, `sacrifice`, `cards`, `artifacts` je grün.
