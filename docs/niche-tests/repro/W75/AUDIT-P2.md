# Audit P2 — Equip-Stapel (Darion) gegen Artefakte (ohne Equipment) und Tränke

Partition P2: 57 Effekt-Skripte (Normal-/Reaction-/Surprise-/Creature-Artefakte und Tränke), alle vollständig gelesen.
Annahme überall: „jede Karte ist eine eigene Karte, nur die Zone ist geteilt" (`_equip-stack-shared.js`). Klassen A–E wie im Auftrag; „irrelevant" = das Skript trifft/zählt/legt nie ein Nicht-Kreaturen-Artefakt in einer Support Zone (nur Helden, Kreaturen, Hand/Ablage/Deck).

Tests: `h-P2-01 … h-P2-05` (neu, alle vor dem Fix rot bzw. als Absicherung grün geprüft: 01/02/03/04 rot, 05 Absicherung), dazu der bestehende Sweep `g-02` über die ganze Partition (33 Kandidaten, 0 falsch).

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| acid-vial.js | irrelevant | Ziele nur Helden + Kreaturen (`getCreatureTargets`) | g-02 |
| anti-magnet.js | A/B | ok. Offene Lesart: „while you control other possible targets" zählt je Ziel-ID, ein Stapel (eine ID) ist EIN Ziel — weitere Karten desselben Stapels zählen nicht als anderes Ziel und werden nicht als Umleitungsziel angeboten (nur relevant bei Effekten, die Equips wählen) | – |
| arcane-lamp.js | irrelevant | Helden + Kreaturen | g-02 |
| beer.js | irrelevant | `getCreatureTargets` | g-02 |
| blood-soaked-coin.js | irrelevant | Creature-Filter | g-02 |
| bomb-arrow.js | irrelevant | nur Gegner-Kreaturen | – |
| book-of-doom.js | irrelevant | Helden + Kreaturen | g-02 |
| boomerang.js | irrelevant | Artefakt aus der Ablage auf die Hand, keine Brettzone | g-02 |
| bottled-lightning.js | irrelevant | Creature-Filter | g-02 |
| burned-contract.js | irrelevant | nur Kreaturen | g-02 |
| capture-net.js | irrelevant | nur Kreaturen | g-02 |
| cloud-pillow.js | irrelevant | Helden + Kreaturen | g-02 |
| cool-repair.js | A/B/C | behoben: die Endprüfung „Zone noch frei?" brach ab, sobald der Pflicht-Platz (Stapel) belegt war — das Equip blieb in der Ablage, Karte „gespielt" ohne Wirkung (ab dem 2. Equip) | h-P2-01 |
| dark-gear.js | irrelevant | Kreaturen; freie Zonen = leere Zonen (ein Stapel zählt zu Recht als belegt) | g-02 |
| debt-o-tron-model-missing-parts.js | irrelevant | Creature-Filter | – |
| difficulty-lever.js | irrelevant | Zauber aus der Hand | – |
| elixir-of-recovery.js | B | ok/Randfall: sammelt Support-Karten nach Status-Zählern ohne Creature-Filter; ein Equip trägt nie solche Status | g-02 |
| experimental-potion.js | irrelevant | Helden + Kreaturen | g-02 |
| field-standard.js | irrelevant | Creature-Filter | g-02 |
| fire-bomb.js | A/E | ok (Mehrfachwahl, g-06). Behoben: liegt ein Cloak of Edge (Equip, das im Support Zone als Ability gilt) im Stapel, bot die Rückfrage „welches Equip?" auch Club/Crown an → es wurde der Nachbar zerstört statt der Ability | h-P2-04, g-06, g-02 |
| future-tech-bomb.js | irrelevant | Helden + Kreaturen | – |
| future-tech-copy-device.js | B/C/E | behoben: (1) mit Equip-Stapel und ohne freie Zone war die Kopie einer Ausrüstung nicht spielbar; (2) mit freier Zone legte sie sich in einen ZWEITEN Platz statt auf den Stapel (Name „Future Tech Copy Device" ist kein Equip-Name, `equipPflichtPlatz` greift nicht). Zugende-Abfall prüft: nur die Karte verlässt den Stapel | h-P2-01 (3, 3b) |
| future-tech-prototypes.js | irrelevant | Ablage-Alias, keine Brettzone | – |
| gigantisaur-skull.js | irrelevant | Kreaturen | – |
| healing-potion.js | irrelevant | Creature-Filter | – |
| hive-s-crown.js | irrelevant | Sparkfly-Kreaturen, Opferzone | – |
| holy-cheese.js | irrelevant | Helden + Kreaturen | g-02 |
| idej-projector.js | irrelevant | hängt eine Projection (Anhängsel, kein Artefakt) an einen Idej-Helden mit freier Zone | – |
| initiation-ritual.js | C/D | behoben: der Gefallene wird „als Equip-Artifact" angelegt, verlangte aber eine freie Zone; bei Darion mit Stapel und vollen Zonen unspielbar, sonst eigener zweiter Platz statt Stapel. Jetzt: Pflicht-Platz = Stapel, Zielplatz ohne Rückfrage „welches Equip?" | h-P2-01 (4) |
| invisibility-cloak.js | irrelevant | zählt Helden + Kreaturen | – |
| javelin-throw.js | A/B | ok: je Instanz gezählt, die Rückfrage trifft die gewählte Karte | h-P2-05 (2), g-02 |
| juice.js | irrelevant | wie Elixir (Status-Zähler), Creature-Ziele | – |
| life-serum.js | irrelevant | Helden + Kreaturen | – |
| mana-absorbing-crystal.js | irrelevant | Handkarte, Held nimmt Schaden | – |
| perfect-disguise.js | A | offen: listet JEDE Support-Karte des Spielers (auch Equips) als „Ziel" (Text: Held oder Kreatur) — bei einem Stapel erscheint die Rückfrage, die gewählte Equip-Karte bekommt den (wirkungslosen) Zähler. Allgemeiner Fehler unabhängig von Darion, nicht geändert | g-02 |
| poison-vial.js | irrelevant | Creature-Filter (liest `slot[0]`, im Stapel also kein Treffer) | g-02 |
| poisoned-meat.js | irrelevant | nur Kreaturen | g-02 |
| pollution-spewer.js | irrelevant | Artifact-Creature (Kreatur, kein Equip); Auslöser Pollution-Token | – |
| powder-keg.js | B | ok: belegt nur freie Zonen des Gegners, Todes-Schaden nur auf Kreaturen | – |
| punch-in-the-box.js | irrelevant | Helden + Kreaturen | – |
| racket-arrow.js | irrelevant | nur Gegner-Kreaturen | – |
| remote-detonator.js | irrelevant | Helden + Kreaturen | g-02 |
| rocket-sneeze.js | irrelevant | verteilt Schaden auf Helden + Kreaturen | – |
| secret-spell-book.js | A/C/D | behoben: Platzangebot für zurückgeholte Ausrüstung kannte den Stapel nicht (Darion mit Stapel + volle Zonen: kein Platz angeboten, Karte blieb beim Gegner), und der Umzug in den „belegten" Stapelplatz wäre abgelehnt worden. Stapel des Gegners: nimmt nur die eigene Karte, Nachbarn bleiben | h-P2-03 |
| shield-of-wisdom.js | irrelevant | Umleitungsziele: Helden + Kreaturen | – |
| skull-necklace.js | irrelevant | Creature-Filter | – |
| slippery-fridge.js | A/C/D | behoben: (1) Mehrfach-Umhängen zu Darion: der erste Zielplatz galt für die zweite Karte als „reserviert" → zwei Equips landeten in zwei Zonen bzw. das zweite blieb liegen (Baustein `_equip-shared.umhaengFreieZonen`); (2) das Anklicken des Stapel-Zielplatzes löste die Rückfrage „welches Equip?" aus. Auswahl aus dem Stapel (Mitte + unterste, gleichnamige Kopien) war schon korrekt | h-P2-02 |
| snow-cannon.js | irrelevant | Creature-Filter | – |
| tea.js | irrelevant | `getCreatureTargets`; Anhängsel-Umzug betrifft Spells | – |
| teleportation-powder.js | D | ok: ganzer Stapel (Ids, Zähler, Reihenfolge, gleichnamige Kopien) geht mit und kommt unverändert zurück | h-P2-05 (1) |
| the-yeeting.js | A | ok: Rückfrage trifft die gewählte Karte (eigener und gegnerischer Stapel) | g-02 |
| thicket.js | irrelevant | Creature-Filter | – |
| tool-freezer.js | E | ok: negierte Ausrüstung für den Stapel landet in der Ablage, Stapel unverändert | h-P2-05 (3) |
| treasure-hunter-s-backpack.js | B/C | behoben: (1) `canActivate` verlangte eine freie Zone (Darion mit Stapel + volle Zonen: unspielbar); (2) die Endprüfung „Zone frei?" brach ab, sobald der Stapel belegt war (Karte gespielt, kein Equip) | h-P2-01 (2) |
| ushabti-of-the-great-pharaoh.js | irrelevant | Creature-Filter | – |
| weakening-crystal.js | irrelevant | Handkarte | – |
| weird-doll.js | A/E | behoben: Cloak of Edge (Ability im Support Zone) im Equip-Stapel — die Rückfrage „welches Equip?" bot die Nachbarn an, abgeworfen wurde aber immer das erste Cloak (bei zwei Cloaks nie die gewählte). Jetzt nur Ability-Karten wählbar, die gewählte geht | h-P2-04 |

## Geänderte Dateien
`cards/effects/`: `cool-repair.js`, `fire-bomb.js`, `future-tech-copy-device.js`, `initiation-ritual.js`, `secret-spell-book.js`, `slippery-fridge.js`, `treasure-hunter-s-backpack.js`, `weird-doll.js`, sowie der gemeinsame Baustein `_equip-shared.js` (`umhaengFreieZonen`: Darion-Stapel gilt auch bei mehreren Equips in einer Wahl; `waehleAusruestPlatz`: Zielplatz mit `_eigeneStapelWahl`). Test-Bibliothek `docs/niche-tests/lib/h.js`: `audit()` erkennt eine kopierende Copy-Device-Karte (`treatAsEquip`) im Stapel als Equip.

## Vorschläge für geteilte Dateien (nicht angefasst)
* `cards/effects/_engine.js`, `_disambiguateStackedTargets` (≈ Z. 33372): Ziele ohne Karte (`t.cardName` leer/`null` und kein `t.cardInstance`, also reine ZIELPLÄTZE wie in `waehleAusruestPlatz`, Looting, Treasure Theft, Swagdri, Dajan) sollten übersprungen werden (`if (!t.cardName && !t.cardInstance) continue;`) — sonst fragt die Engine beim Anklicken eines Stapel-Zielplatzes „welches Equip meinst du?". In P2 per `_eigeneStapelWahl: true` an den eigenen Zielplatz-Listen (Fridge, Initiation Ritual, `waehleAusruestPlatz`) gelöst; Looting (`looting.js` Z. 121), Treasure Theft (Z. 164) und die Helden-Skripte Swagdri (Z. 134) und Dajan (Z. 156) haben dieselbe Lücke und gehören zu anderen Partitionen (bzw. eine Zeile in der Engine behebt alle).
