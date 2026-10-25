# Audit P4a — Kreaturen (erste Hälfte) × Darions geteilte Equip-Zone

Partition P4a: 44 Effekt-Skripte unter `cards/effects/`. Alle vollständig gelesen; jede Interaktion mit Artefakten in Support Zonen mit einem Darion-Stapel (Club of Gobbo / Blade of the Frostbringer / Cute Crown, teils Duplikate) im Simulator durchgespielt.
Annahme (Lesart aus dem Auftrag): jede Karte des Stapels ist eine eigene Karte, nur die Zone ist geteilt.
Klassen: A Auswahl/Entfernen/…, B Zählen/Bedingungen, C Anlegen per Effekt, D ganze Zonen verschieben, E Equip-Skript selbst/Hooks. „irrelevant“ = das Skript wählt, zählt und bewegt nur Helden/Kreaturen (Zielfilter `Creature`, `isChoosableAsCreature`, `getCreatureTargets`, `promptDamageTarget` mit `types: ['hero','creature']`) — Equips sind dort nie Ziel.

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| 500-piranhas-in-a-monster-suit.js | irrelevant | Opfer nur gegnerische Kreaturen; Ersatzzone über `getFreeSupportZones` (Stapelzone gilt als belegt). ok | — |
| afflicted-vermin.js | irrelevant | Ziele = `getCreatureTargets`; Platz für die Kreatur über die Engine (freie Zone; der Stapel belegt genau eine). ok | — |
| archer.js | irrelevant | Arrow-Artefakte kommen aus der Hand (Reaktionen), Schaden nur auf Helden/Kreaturen. ok | — |
| bomblebee.js | irrelevant | Ziele Helden/Kreaturen; ein abgeworfenes Equip ist nicht „defeated“. ok | — |
| cactus-creature.js | B | Schleifen lesen `slot[0]`/erste Instanz je Platz, filtern aber über `isChoosableAsCreature` — ein Equip-Stapel fällt sauber heraus, keine Kreatur teilt sich einen Platz mit Equips. ok | — |
| cardinal-beast-baihu.js | irrelevant | nur Helden/Kreaturen. ok | — |
| cardinal-beast-zhuque.js | irrelevant | Ziele nur Kreaturen (`hasCardType Creature`); Brand für „alle Kreaturen des Helden“ ohne Equips. (`canActivateCreatureEffect` zählt jede nicht brennende Support-Instanz — allgemein, nicht Darion-spezifisch, s. Bericht.) ok | — |
| clone.js | A | **behoben**: die Kopie „gegen dieselben Ziele“ traf bei einem Stapel eine ANDERE Karte (die Platz-ID bleibt gültig, solange der Stapel nicht leer ist; bei getrennten Zonen ist das Ziel erloschen). Der Klon merkt sich jetzt (`onCardLeaveZone`, nur während der Aufzeichnung des Originals), aus welchen Plätzen eine Ausrüstung abgegangen ist, und lässt solche Ziele bei der Kopie fallen. | h-P4a-07 |
| cosmic-skeleton.js | irrelevant | `promptDamageTarget` hero/creature. ok | — |
| cybug-locust.js | C | **behoben**: verlangte immer ZWEI freie Zonen beim Träger. Ist der Träger Darion mit Stapel, kommt die umgeleitete Ausrüstung in den Stapel — der Surprise wurde trotz Platz nie angeboten. Jetzt genügt eine freie Zone für die Kreatur (`equipPflichtPlatz`). Gegner-Darion als Anleger (nur die neue Karte wird umgehängt, Stapel unversehrt) ok; Darion ohne Stapel braucht weiter zwei. | h-P4a-01 |
| cykyran-war-counselor.js | irrelevant | zählt Kreaturen nach Namen; „Equip“ steht nur im Kommentar. ok | — |
| deepsea-poltergeister.js | A | Wahl der gemeinten Karte funktionierte (Engine-Rückfrage), aber der Stapel stand drei Mal mit derselben Ziel-ID in der Zielliste. **Bereinigt**: ein Ziel je Platz. Beide Seiten, mittlere Karte gewählt → nur sie in die Ablage. | h-P4a-02 |
| embodiment-of-biseria.js | B | Stufenzählung überspringt Equips (`isEquipInZone`); zählt Kreaturen, nicht Zonen. ok | — |
| exploding-skull.js | irrelevant | `getCreatureTargets` filtert Equipment heraus. ok | — |
| gangster-angel.js | irrelevant | Ziele Helden/Kreaturen, freie Plätze über `eligibleSummonZones`. ok | — |
| ghoul-guard.js | irrelevant | Bluten-Ziele aus `collectPlayerTargets` (Helden/Kreaturen). ok | — |
| grunge-harpyformer.js | irrelevant | Brand-Ziele hero/creature. ok | — |
| hammer-skeleton.js | irrelevant | Ziele nur `cardType === 'Spell'` (Anhängsel/Areas), nie Artefakte. ok | — |
| harpyformer-choir.js | B | „eigene Kreaturen“ über Instanzen mit `isEquipInZone`-Ausschluss. ok | — |
| icy-slime.js | irrelevant | `promptMultiTarget` hero/creature. ok | — |
| invader-from-the-cosmic-depths.js | B | freie Zonen = leere Zonen (Stapel = belegt); Schadensziele nur Helden/Kreaturen. ok | — |
| land-sharks.js | B | drei freie Zonen nötig (`canSummonMultiZone`); mit Darion-Stapel eine Zone belegt, wie bei jedem Equip. ok | — |
| loyal-hountriever.js | irrelevant | reagiert nur auf einlaufende „Loyal“-Kreaturen. ok | — |
| lunatic-golem.js | B/E | zählt verschiedene Lunatic-Cycle-Karten über Instanzen; fünf Karten im Stapel = Stufe 5; Abgang einer Karte nach der anderen verläuft (Zählung, Immunität ab 2) identisch zu einzeln liegenden Karten. ok | h-P4a-05 |
| mischief-militia-bear-rider.js | irrelevant | „Frozen target“ = Held/Kreatur. ok | — |
| mischief-militia-thaw-blader.js | irrelevant | dito. ok | — |
| pet-snake.js | irrelevant | vergiftete Helden/Kreaturen. ok | — |
| resilient-monkee.js | irrelevant | Monkee-Kreaturen, Invest Counter am Helden. ok | — |
| rook-of-kings-b.js | irrelevant | Post-Target-Fenster, Gewährung an Helden/Kreaturen. ok | — |
| skeleton-archer.js | A (offen, nicht Darion) | Gewählte Karte wird getroffen (Rückfrage, beide Seiten). **Auffällig, unabhängig von Darion**: `collectArcherTargets` bietet JEDE Support-Instanz als Schadensziel an, auch Ausrüstung; 50 Schaden zerstören ein Equip (Blade: `currentHp -50`, wandert in die Ablage), auch bei normal liegender Ausrüstung. Unverändert gelassen (Frage an Al). | — (Einzelprobe, kein Testskript: offener Punkt) |
| skeleton-death-knight.js | irrelevant | Ziele Helden/Kreaturen. ok | — |
| sky-archeologist.js | C | gratis ausgespieltes Equip kommt in den Stapel: ohne weitere freie Zone keine Zonenwahl; mit freier Zone bei einem anderen Helden Zonenwahl, Stapelplatz wählbar. ok (über `_orchestra-shared`/`_free-artifact-shared`) | h-P4a-04 |
| slippery-narw.js | D | zieht in die FREIE Zone eines Nachbarn; Stapelzonen sind belegt. ok | — |
| slippery-whoolmoth.js | B | „Kreatur in jeder Zone“ über `kreaturAnBrett` + Kreaturenprüfung: ein Equip-Stapel zählt nicht als Kreatur. ok | — |
| sparkfly-queen.js | A | Worker-Geschenk: der Gegner wählt die Karte im Stapel, genau diese geht auf die Hand. Der Sammler `_sparkfly-shared.collectNonHeroBoardTargets` listete den Stapel dreifach (gleiche ID) — **bereinigt**: ein Ziel je Platz. Hauptmodus (Typ „Artifact“) wirkt nur auf das Deck. | h-P4a-08 |
| sparky-slime.js | irrelevant | hero/creature. ok | — |
| spirit-of-the-forbidden-grimoire.js | B/E | Beschwörungssperre über Instanzen (`hasGrimoire`): Grimoire an jeder Stapelstelle, ohne Grimoire gesperrt; Kandidatenliste nur Kreaturen. ok | h-P4a-06 |
| spirit-of-the-relic-hammer.js | B/E | Sperre über Instanzen (Hammer an jeder Stapelstelle). Aura nur für einlaufende Kreaturen. ok | h-P4a-06 |
| spirit-of-the-super-killing-knife.js | B/D/E | Sperre über Instanzen; fällt Darion mit liegendem Spirit, wird er gelöscht (`deleteHero`): Stapel mit doppeltem Namen sauber abgebaut, alle Karten in der Ablage, Instanzen konsistent (wie bei getrennten Zonen). ok | h-P4a-06 |
| steam-dwarf-brewer.js | irrelevant | `getCreatureTargets`. ok | — |
| swift-eagle-warrior.js | irrelevant | Doom Clock ist ein Area-Spell, kein Equip. ok | — |
| the-weather-orchestra.js | A/C | **behoben (zwei Fehler)**: (1) Der Deckel „freie Zonen der eigenen Helden“ zählte Darions Stapel nicht — mit Stapel und sonst belegten Zonen feuerte der Effekt gar nicht, obwohl der Stapel beliebig viele Equips aufnimmt. Jetzt zählt ein Held mit Stapel (oder mit freier Zone zum Eröffnen) als unbegrenzt (Deckel 3). (2) Die Platzwahl (Zielliste mit `type:'equip'`, `cardName:''`) löste bei Darions Stapel die Rückfrage „welches Equip?“ aus — jetzt `_eigeneStapelWahl`. Zusätzlich: der aktive Effekt („Artefakt in die Ablage“) bietet einen Stapel als EIN Ziel je Platz (`_erlaubteInstanzen`), vorher drei Ziele mit unterschiedlichen IDs. Beide Seiten, mittlere Karte → nur sie weg. | h-P4a-03 |
| time-bomblebee.js | irrelevant | nur Kreaturen. ok | — |
| water-golem.js | irrelevant | Ziele Helden/Kreaturen. ok | — |
