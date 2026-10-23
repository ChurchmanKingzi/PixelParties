# Fix-Welle 64c – „Karten gehen IMMER in die Stapel ihres permanenten Besitzers" · Bounce → Kontrolleur · Unterkarten

Agent **W64c** (Zweig `wave64/W64c`), Entscheidungen von Al (23.10.2026). Details, Tabellen und Verträge: `cards/effects/CARD_API.md` (Vertragsabsatz ganz oben + Abschnitt „Welle 64 / W64c").

## Entscheidungen
1. **Allgemeine Regel ohne Ausnahmen:** Ablage, Löschstapel, Deck, Potion Deck gehören dem permanenten Besitzer — durch alles (Charme, Hunting, Diebstahl, Kontrollwechsel, Gegner-Zugriffe, Unterkarten). Als Vertrag mit Helfer-Tabelle, verbotenen Mustern und Prüfliste in der CARD_API festgehalten.
2. **Bounce (Brett → Hand) geht an den aktuellen KONTROLLEUR**, die Herkunft (Platzmarke) bleibt → späterer Austritt aus der Hand geht zum Stapel des Besitzers. Nimmt „Bounce → Hand des Besitzers" (W63c, Rückfrage 1) zurück. Texte mit „(original) owner's hand" (Racket Arrow, Chasing the Legend) bleiben wörtlich beim Besitzer.
3. **Selbst-Bounce-Kreaturen** und **Deepsea-Kosten/Dark Deepsea God:** nur der aktuelle Kontrolleur löst aus bzw. gibt zurück — Ist-Zustand war richtig (Repro `c-04`), nur die fehlende Herkunft beim Deepsea-Tausch war ein Fehler.
4. **Core/Gun** (Ablage des aktuellen Kontrolleurs) als entschieden dokumentiert, keine Änderung. **Coolness Stack** per Repro bestätigt (`c-08`).

## Der Wächter (`docs/niche-tests/lib/besitzer.js` → `waechter(t)`, `PP_OWNER_GUARD=1`)
Instrumentiert die vier Stapel jedes Sitzes, führt Buch über den Besitzer jeder Karte (Eigentum wandert nie) und meldet jede Karte, die in einem Stapel eines Nicht-Besitzers landet (mit Aufrufweg und Metadaten-Belegen). `strict` → Exit 1; `PP_OWNER_GUARD_OUT=<datei>` sammelt über die Suite. Künstliche Aufbauten (`t.put` + nachträglich gesetzter `originalOwner`) werden als „test-aufbau" markiert.
* **Alle 1299 Repros mit Wächter:** 3 Treffer, alle „test-aufbau" (`W19/b-1`, `A02-deepsea/03`, `M01/08`), 0 echte.
* **Sweeps** `W64/c-02` (jede Karte als gestohlene Handkarte) und `c-05` (jede Karte gegen Gegnerhand/-brett/-stapel und eine übernommene Kreatur): vorher 4 Treffer (Forbidden Zone, Liberation × 2 Sitze), nachher 0.

## Verstöße und Behebung (Weg/Karte | Verstoß | Behebung)
| Weg / Karte | Verstoß | Behebung |
|---|---|---|
| Forbidden Zone, Liberation (gestohlen, gespielt) | Löschstapel des Diebs | `handKartenBesitzerPs` |
| Magic Topaz, Rebelliokai Courtly Kirin, Front Soldier (`skipPostResolveDiscard`/Fallback) | Ablage des Halters | `handKartenBesitzerPs` |
| negierte Handkarte (Ablage / Lunar Eclipse Löschstapel / Off Duty Deck), negierte Platzierung | Stapel des Halters | zentral in `routeNegatedInitialCard` / `_negatedPlacementRoute` |
| Staff of Illusions / Create Illusion (Rückmischen) | Deck des Diebs | Deck des Besitzers |
| Unterkarte angelegter Held (Goff, Clausss, Smug…, Dream Lander) | Ablage des Kreatur-Besitzers statt des Heldenkarten-Besitzers | `counters.attachedHeroOwner` |
| Rain of Death (Ability löschen), Quetzahuitl (Zonen löschen), Crimson Web | Stapel der Brettseite / des Nutzers / des Legers | `kartenBesitzerVon(inst)` |
| Deepsea-Tausch (Jack O' Lantern, Poltergeister, Skeleton, Stein, Monstrosity, Infected Squirrel, Shapeshift) | übernommene Kreatur kam ohne Herkunft in die Kontrolleur-Hand → später dessen Ablage | Herkunft (`originalOwner`) mitgegeben |
| Deepsea Encounter (Rückgabe der Ersatzkarte) | Herkunft verloren | `handZugangRueckgabe` |
| Winged Skeleton (Bounce) | Hand über Brettseite | Hand des Kontrolleurs + Herkunft |
| `returnSupportCreatureToHand` / `actionMoveCard` Brett → Hand | Hand des Besitzers (W63c) | Hand des Kontrolleurs, Herkunft bleibt |
Geändert: `_engine.js`, `_deepsea-shared`, `_dream-lander-shared`, `winged-skeleton`, `deepsea-encounter`, `racket-arrow`, `chasing-the-legend`, `forbidden-zone`, `liberation`, `magic-topaz`, `rebelliokai-courtly-kirin`, `front-soldier`, `rain-of-death`, `quetzahuitl-receiver-of-sacrifices`, `crimson-web`. Kartentexte (`data/cards.json`) und `public/` unverändert.

## Diplomacy ↔ Dark Gear
Gleiche Primitive (`actionTransferCreature` + `actionNegateCreature` bis Zugende), nur Kosten/Zugang verschieden. Von W63c nicht einzeln geprüft; Repro `c-03` (Diplomacy UND Dark Gear, beide Sitze, 7 Abgänge) ist grün — die Primitive war schon richtig.

## Tests (Exit 0 = korrekt)
| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `W64/c-02-diebstahl-sweep-alle-karten-spielen-und-zerstoeren.js` | Sweep gestohlene Handkarte, Wächter | 2 + Abdeckungsnotiz | 2 Karten rot |
| `W64/c-03-diplomacy-und-dark-gear-uebernahme-stapel-des-besitzers.js` | Diplomacy/Dark Gear × 7 Abgänge | 126 | Bounce-Teil rot |
| `W64/c-04-bounce-geht-an-den-kontrolleur-herkunft-bleibt.js` | Bounce, Deepsea-Tausch, Moonlight Butterfly, Winged Skeleton, Dark Deepsea God, Deepsea-Kosten | 114 | 20 ✗ |
| `W64/c-05-gegner-und-uebernahme-sweep-alle-karten-….js` | Sweep Gegner-/Übernahme-Zugriffe | 2 + Notiz | grün (Grenze: Szenen-Abdeckung) |
| `W64/c-06-angelegter-held-unterkarte-folgt-seinem-besitzer.js` | Unterkarte Held | 36 | 16 ✗ |
| `W64/c-07-negierte-und-zurueckgemischte-fremde-karten-besitzer-stapel.js` | Negation, Staff of Illusions | 52 | 26 ✗ |
| `W64/c-08-coolness-stack-stapel-des-besitzers-hand-bleibt-eigentum.js` | Coolness Stack | 84 | W63c-Basis 16 ✗ |
Angepasst: `W63/c-02`. Sweeps im Vollmodus: `VOLL=1 ART=<Kartenart> node …/c-02-….js` bzw. `…/c-05-….js` (~10 Min je Datei).

`Bugfix-Note`s stehen in den Commit-Nachrichten.

## Rückfragen an Al (Ja/Nein)
1. Racket Arrow / Chasing the Legend („owner's hand"): weiter wörtlich Hand des **Besitzers**, obwohl ein allgemeiner Bounce an den Kontrolleur geht — ja/nein? (Bounce Trap: gleicher Text, noch kein Skript.)
2. **Plant Golem** (Ruling 29.8.: Bounce → Hand des Besitzers): jetzt landet er nach einem Bounce in der Hand des Gegners. Ausnahme „Plant Golem → Hand des Besitzers" — ja/nein?
3. Reaktionskarten aus fremder Hand: Sweep löst sie nicht auf (Bedingungen); zentrale Kette ist geprüft. Reaktions-Szenenbauer pro Karte (~80) gewünscht — ja/nein?
