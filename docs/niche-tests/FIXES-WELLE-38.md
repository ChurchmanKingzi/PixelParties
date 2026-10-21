# Fix-Welle 38 – Wording „negative status effect", Layn × Surprise-Kreaturen

## Kartentext (`data/cards.json`, Auftrag von Al, 22.10.2026)

„This counts as a status effect." → **„This counts as a negative status effect."** bei Forbidden Curse of Aging, Null Zone, Null, the Mage Slayer und Skeleton Death Knight. Der Wächter `check-status-claims.js` akzeptierte „negative" schon. Nicht geändert: The Master's Orders („This is treated as a status effect", anderer Wortlaut) – bei Bedarf nachziehen.

## Layn, Defender of Deri: Surprise-Kreaturen mit Rest-Boost (Meldung von Al, alte Version)

Symptom: Eine Surprise-Kreatur (Pure Advantage Camel), die wieder verdeckt gesetzt und erneut beschworen wird, trat mit Basis-HP als aktuelle HP und erhöhtem Max-HP an (z. B. 80/180). Das war **nicht** durch die großen Fix-Wellen behoben:

* `_resetCreatureForSurpriseZone` löschte nur Status und `currentHp`, ließ aber `maxHp` und die Einmal-Marke `_laynBonus` stehen.
* Beim erneuten Antreten verhinderte die Marke die neue Vergabe; die Engine las ohne `currentHp` die Obergrenze (180), der Client las ohne `currentHp` die Basis-HP (80) – die Anzeige zeigte 80/180.

Behebung: Beim Zurücksetzen in die Surprise Zone werden zusätzlich `maxHp`, `_laynBonus` und `_circleBonus` (Summoning Circle, gleiches Muster) gelöscht – die Karte tritt wirklich frisch an und bekommt den +100-Bonus erneut (180/180). Zusätzlich liest der Client ohne `currentHp` jetzt wie die Engine die Obergrenze (`app-board.jsx`, `engine.creatureCurrentHp`). Repro `W38/a-00` (beide Sitze): Exit 1 auf der Basis, Exit 0 jetzt.

## Ergebnis in Zahlen

* Repros: **alle 1175 Repros grün** (vorher 1174; 1 neues), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
