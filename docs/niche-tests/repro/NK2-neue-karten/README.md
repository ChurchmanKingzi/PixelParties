# NK2 · Neue Karten 23.10.2026 (zweite Runde) — Secret Entrance, Mine! Mine! Mine!, See through the Ruse, Mind Control, Spy in the Enemy's Camp

Regressionstests auf der Harness `docs/niche-tests/lib/h.js` (echte Engine, echte `server.js`-Spielwege). Jede Datei läuft für sich, Exit 1 bei einem ✗:

```
node docs/niche-tests/repro/NK2-neue-karten/01-secret-entrance.js
node docs/niche-tests/repro/NK2-neue-karten/02-mine-mine-mine.js
```

| Datei | Inhalt |
|---|---|
| `01` | Secret Entrance: Anzahl 1/2/3 nach Magic Arts (geklemmt), „up to", Abbruch, ungültige Indizes, Zusatzaktion bei Gegnerhand ≥ 2× eigene weitere Karten (Grenzfälle, Main Phase, zwei Kopien), Spielbarkeit (leere Hand, Erstrunden-Schutz, Hand-Sperre, Spreading Rumor, Boris), Eigentum der gestohlenen Karte, Hook, Ambush the Scout, CPU-Sitz, Zustandsprüfung |
| `02` | Mine! Mine! Mine!: Wegnehmen ohne Charme (Hand, ATK-Abzug, Eigentum, Aktion), Charme 1–3 (Zusatzaktion, kostenloses Anlegen, ATK-Bonus am Nutzer, Eigentum), Ablehnen, kein Träger/keine Zone, Zonenwahl, Zielfilter (Kontrolle statt Spalte, eigene/immovable ausgeschlossen), Spielbarkeit (keine Ausrüstung, Hand-Sperre, Erstrunden-Schutz, Boris), Resistance, Defending the Gate, verschwundenes Ziel, CPU |
