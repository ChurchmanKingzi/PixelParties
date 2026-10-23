# NK2 · Neue Karten 23.10.2026 (zweite Runde) — Secret Entrance, Mine! Mine! Mine!, See through the Ruse, Mind Control, Spy in the Enemy's Camp

Regressionstests auf der Harness `docs/niche-tests/lib/h.js` (echte Engine, echte `server.js`-Spielwege). Jede Datei läuft für sich, Exit 1 bei einem ✗:

```
node docs/niche-tests/repro/NK2-neue-karten/01-secret-entrance.js
node docs/niche-tests/repro/NK2-neue-karten/02-mine-mine-mine.js
node docs/niche-tests/repro/NK2-neue-karten/03-see-through-the-ruse.js
node docs/niche-tests/repro/NK2-neue-karten/03b-see-through-the-ruse-sicht.js   # Zustandsversand (wire.js)
node docs/niche-tests/repro/NK2-neue-karten/04-mind-control.js
```

| Datei | Inhalt |
|---|---|
| `01` | Secret Entrance: Anzahl 1/2/3 nach Magic Arts (geklemmt), „up to", Abbruch, ungültige Indizes, Zusatzaktion bei Gegnerhand ≥ 2× eigene weitere Karten (Grenzfälle, Main Phase, zwei Kopien), Spielbarkeit (leere Hand, Erstrunden-Schutz, Hand-Sperre, Spreading Rumor, Boris), Eigentum der gestohlenen Karte, Hook, Ambush the Scout, CPU-Sitz, Zustandsprüfung |
| `02` | Mine! Mine! Mine!: Wegnehmen ohne Charme (Hand, ATK-Abzug, Eigentum, Aktion), Charme 1–3 (Zusatzaktion, kostenloses Anlegen, ATK-Bonus am Nutzer, Eigentum), Ablehnen, kein Träger/keine Zone, Zonenwahl, Zielfilter (Kontrolle statt Spalte, eigene/immovable ausgeschlossen), Spielbarkeit (keine Ausrüstung, Hand-Sperre, Erstrunden-Schutz, Boris), Resistance, Defending the Gate, verschwundenes Ziel, CPU |
| `03` | See through the Ruse: Handfalle (negiert Flooding / Pure Advantage Camel, abgelehnt, kein Wirker, eigene Aktivierung, Hand-Spielsperre, mehrere Kopien, Ruse im Kettenfenster negiert, CPU) und proaktives Aufdecken (alle verdeckten Gegner-Surprises, Bakhm-Creature, eigene/offene unberührt, keine Aktion, Phase bleibt, aufgedeckte Surprise bleibt aktivierbar, nicht spielbar ohne Ziel) |
| `03b` | See through the Ruse: Zustandsversand an Wirker und Besitzer (`?` → Name, `surpriseKnown`, `surpriseFaceDown`) |
| `04` | Mind Control: Grundfall (Anlegen, dauerhafte Kontrolle, Status, Besitzer), Spielbedingung (2 eigene besiegt, Gegner dauerhaft > 1 unbesiegt, Charme zählt nicht, Erstrunden-Schutz, Boris, keine freie Zone), Heilen/Cleanse gibt Kontrolle zurück, jeder andere Austritt (Zerstörung, Heldentod), Obergrenze > 2 Helden (Wiederbelebung, Charme-Held; kein Rekursions-Loop beim Abräumen), Schutz (Resistance, Flooding, Black-Thorn Dragon), zwei Kopien, Puzzle-Aufbau, CPU |
