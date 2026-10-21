# Fix-Welle 37 – Bonded Companion: Beschwören und Platzieren (kritischer Bug)

Meldung von Al (22.10.2026): „Beschwört man einen Bonded Companion, egal ob normal von der Hand oder per Barkers Effekt, stirbt sofort der zugehörige Hero und der Companion geht … auf die *Hand*."

## Ursache

Nicht der HP-Pool: Der Companion sperrte beim Eintritt **seine eigene Spalte**. `_enforceSupportZoneLock` (läuft im `onCardEnterZone`-Verteiler und nimmt unerlaubte Platzierungen zurück) fragte `isSupportZoneLocked(…, { cardName, via: 'enter' })`, ohne die eintretende Instanz zu nennen. Die schon in der Spalte liegende Karte meldete sich dort über `companionZonenSperre` („A Hero can only have 1 Bonded Companion …") als *weiterer* Companion → Platzierung zurückgenommen, Karte auf die Hand → Abgang vom Brett → „defeat the corresponding Hero". Die vorhandene Ausnahme `opts.instId` in `companionZonenSperre` griff nie, weil kein Aufrufer `instId` übergab. Die älteren Repros setzten Companions direkt mit `t.put` und liefen deshalb am Eintrittsweg vorbei. Betroffen waren alle vier Companions (Humby, Mellvy, Orphy, Thuly) auf beiden Wegen (Hand und Barker-Platzierung).

## Behebung (`cards/effects/_engine.js`, drei kleine Hunks)

* `_enforceSupportZoneLock` und die Zonenprüfung in `actionMoveCard` übergeben `instId`.
* `isSupportZoneLocked` überspringt in der Kartenschleife die gefragte Instanz selbst: Eine Karte sperrt nie ihre eigene Spalte. Ein zweiter Companion in derselben Spalte bleibt weiterhin gesperrt.

Repro `W37/a-00` (4 Companions × 2 Sitze × Hand/Barker-Weg: bleibt auf dem Brett, Held lebt mit voller HP, nicht auf der Hand, HP-Pool geteilt, zweiter Companion gesperrt): Exit 1 auf der Basis (48 ✗), Exit 0 mit der Behebung.

## Ergebnis in Zahlen

* Repros: **alle 1174 Repros grün** (vorher 1173; 1 neues), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Nicht erneut gefahren: Skilltest-E2E und Dauerfeuer (kleine, lokale Engine-Änderung).
