# NK · Neue Karten 23.10.2026 — Black-Thorn Dragon, Shimmering Dragonegg, Liquid Luck, Great Vanguard Demon

Regressionstests der drei neuen Karten auf der Harness `docs/niche-tests/lib/h.js` (echte Engine, echte `server.js`-Spielwege). Jede Datei läuft für sich:

```
node docs/niche-tests/repro/NK-neue-karten/01-shimmering-dragonegg.js
node docs/niche-tests/repro/NK-neue-karten/02-black-thorn-dragon.js
node docs/niche-tests/repro/NK-neue-karten/03-liquid-luck.js
node docs/niche-tests/repro/NK-neue-karten/04-batterien.js      # Dauerfeuer + Kaltstart über alle drei Karten
node docs/niche-tests/repro/NK-neue-karten/05-luck-reaction-surprise-revive.js   # Luck + Liquid Luck: Reactions, Surprise-Aktivierung, Wiederbelebung
node docs/niche-tests/repro/NK-neue-karten/07-great-vanguard-demon.js   # Great Vanguard Demon: Aufdecken, Stufensenkung, Counter, Schaden
node docs/niche-tests/repro/NK-neue-karten/06-cpu-luck.js       # CPU-Wähler und CPU-Entscheidung für Luck / Liquid Luck
node docs/niche-tests/repro/NK-neue-karten/08-puzzle-handstufe.js   # Puzzle-Creator: Stufe je Handkopie (Engine-Seite der Setzung)
```

Exit 1 bei einem ✗. Voraussetzung: `npm ci` (die Engine braucht `uuid`).

| Datei | Inhalt |
|---|---|
| `01` | Zusatzaktion nur ohne eigene Kreaturen, +8 Gold bei Tod in der eigenen Runde (Schaden jeder Art, Zerstörung, Opfer, Fläche, gestohlen, Brandtod), Gegnerrunde, Sperren (Gold-Lock, Tuscan Aristocrat, Negierung, Frost), Gold Trap, Golden Vermin, Bilanz |
| `02` | Opferkosten beider Wege (alle Kombinationen frisch/alt, Abbruch, belegter Platz, Green Dragoneer, Chosen Sacrifice; Weg b auch mit gegnerischen Drago in jeder Mischung, geschützte Gegner-Kreaturen zählen nicht), 200-Schaden-Effekt (HOPT, Abbruch, Starre), „unaffected by all Spells" gegen eine Batterie echter Spells mit Kontrollziel (Schaden, Fläche, Status, Heilung, Negierung, Zerstörung, Sperren), jeder Engine-Eingang einzeln, Ruhen bei Negierung/Frost/Betäubung, Piercing (Ida), Opfer-Kosten |
| `03` | Deklaration (Abbruch, ungültige Namen), Auslöser je Kartenart, Nicht-Auslöser, Lingering Effect (Trank gelöscht, Marker im Gelöscht-Stapel, Bild der deklarierten Karte an den Gegner), Ablauf zu Beginn des eigenen Zuges, Suche (leeres Deck, Such-/Hand-Sperre, Reveal, Mischen), mehrere Tränke, Wechselwirkung mit Luck, fremder Trank |
| `04` | breite Batterien (`lib/barrage.js`, `lib/coldplay.js`) für alle drei Karten |
| `05` | Luck und Liquid Luck (Entscheidung Al 23.10.): Reaction-/Surprise-Namen im Wähler, Reactions (Test Flight, Martyry, Anti-Magnet, Divine Gift of the Guardian) zählen genau einmal, Surprise nur bei Aktivierung (Spell- und Creature-Surprise), Wiederbelebung einer Creature zählt, eines Helden nicht |
| `06` | CPU-Heuristik: Wähler-Stufen (sicherer Play vor Reaction/Surprise, Muster aus aktivierten Surprises, verdeckte Surprise des Gegners, Fallbacks), Liquid Luck nur bei gefülltem Deck, CPU-Durchlauf mit installierter Heuristik |
| `07` | Great Vanguard Demon: Aufdecken auf jedem Weg, Stufensenkung je eigener Reaction (Spell, Attack, Creature; nicht Artefakt/gegnerische/normale), mehrere Kopien, Zurücksetzen auf 9 (Abwerfen, Löschen, Deck, Ausspielen), Untergrenze 0, Spielbarkeit nach Stufe, Demon Counter auf alle eigenen Creatures (Kontrolle), Horned Demon profitiert, 50 × Counter auf dem Brett, einmal pro Zug |
| `08` | Puzzle-Creator, Stufe je Handkopie (Linksklick auf eine Handkarte mit Level): absolute Setzung `counters.levelSet` auf dem Weg des Puzzle-Starts — gesenkt (spielbar mit niedrigerer Schulstufe, gedruckte Kopie nicht), erhöht, Stufe 0, Wirkung neben Handsenkungen (Basis + Senkung, nie unter 0), gleichnamige Kopien getrennt, Gegnerhand. Editor, Export und Anzeige im Browser geprüft (siehe `cards/effects/CARD_API.md`, Abschnitt „Puzzle-Creator: Stufe je Handkopie“) |
