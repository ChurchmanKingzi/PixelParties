# Fix-Welle 58 – Core/Gun-Ablage, Rioting-Village-Aura, Cool Rescuer Monia

Drei Entscheidungen von Al (22.10.2026), umgesetzt vom Agenten **W58a** (Zweig `wave58/W58a`). Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 58 / W58a"; Repros `docs/niche-tests/repro/W58/a-01` … `a-03` (beide Sitze, auf dem alten Stand rot: 104 / 7 / 36 Prüfungen).

| Punkt | Al | Umsetzung |
|---|---|---|
| Ancient Tech Infinite Energy Core / Future Tech Gun | „Wird Energy Core oder Gun entfernt, sollen die ATK des Heroes danach exakt so hoch sein, wie sie wären, wäre nie ein Energy Core oder eine Gun an sie angelegt gewesen!" Technische Lösung dem Agenten überlassen | Neuer Baustein `engine.dynamischeAtkBuchen` (Skript liefert nur `atkZiel`) + `_dynamischeAtkNachrechnen` bei jedem `sync()` und `runHooks()`: der Bonus wird aus der **Ist-Ablage** abgeleitet, nicht aus Ereignissen. Das Todes-Aufräumen und die ~60 Direktzugriffe auf `discardPile` brauchen keinen Hook mehr; Hook-Reihenfolge unverändert. Verworfen: `onDiscard` im Todes-Aufräumen feuern (ändert die Reihenfolge für alle Ablage-Lauscher, löst nur einen Weg) |
| Rioting Village | „Beim Sterben soll der ATK-Boost erhalten bleiben, aber verschwindet Village oder wird negiert, wird der Bonus von ALLEN Heroes entfernt, lebend wie tot … keine Differenzierung" | W57a-Verhalten bestätigt (Differenztest, 70 Zufallsfolgen). Zwei Lücken geschlossen: Teleportation Powder (Dorf kam/ging während der Abwesenheit) und Quetzahuitl (freier Heldenplatz) — `engine._atkAurenAbgleichen()` bei jedem `sync()` |
| Cool Rescuer Monia | Neuer Text „Whenever 1 or more Creatures …" (ohne „Once per turn") | Sperre `monia-protect` entfällt; jede Karte/jeder Effekt öffnet das Angebot erneut (jede Annahme 1 Karte), je Karte/Effekt und Kontrolleur nur EIN Angebot (`gs._moniaAngebote`); CPU entscheidet über `cpuResponse` (nur bei echtem Nutzen) |

* `Bugfix-Note`: Ancient Tech Infinite Energy Core, Future Tech Gun, Rioting Village, Cool Rescuer Monia (Ablehnung fragt nicht mehr für jede weitere Kreatur desselben Effekts). Die Textänderung an Monia ist Balancing (nur Patchnotes).

## Offene Rückfragen an Al

1. **Diver Helmet / Rioting Village:** ein Held mit Diver Helmet („unaffected by Areas") wird heute trotzdem vom Dorf verdoppelt und erleidet den Rückstoß. Ausnehmen — ja/nein?
2. **Zwei Monias:** die Monia des Zugspielers wird zuerst gefragt (Kreaturen beider Seiten sind schützbar). So lassen — ja/nein?
