# NK · Neue Karten 23.10.2026 — Black-Thorn Dragon, Shimmering Dragonegg, Liquid Luck

Regressionstests der drei neuen Karten auf der Harness `docs/niche-tests/lib/h.js` (echte Engine, echte `server.js`-Spielwege). Jede Datei läuft für sich:

```
node docs/niche-tests/repro/NK-neue-karten/01-shimmering-dragonegg.js
node docs/niche-tests/repro/NK-neue-karten/02-black-thorn-dragon.js
node docs/niche-tests/repro/NK-neue-karten/03-liquid-luck.js
node docs/niche-tests/repro/NK-neue-karten/04-batterien.js      # Dauerfeuer + Kaltstart über alle drei Karten
```

Exit 1 bei einem ✗. Voraussetzung: `npm ci` (die Engine braucht `uuid`).

| Datei | Inhalt |
|---|---|
| `01` | Zusatzaktion nur ohne eigene Kreaturen, +8 Gold bei Tod in der eigenen Runde (Schaden jeder Art, Zerstörung, Opfer, Fläche, gestohlen, Brandtod), Gegnerrunde, Sperren (Gold-Lock, Tuscan Aristocrat, Negierung, Frost), Gold Trap, Golden Vermin, Bilanz |
| `02` | Opferkosten beider Wege (alle Kombinationen frisch/alt, Abbruch, belegter Platz, Green Dragoneer, Chosen Sacrifice), 200-Schaden-Effekt (HOPT, Abbruch, Starre), „unaffected by all Spells" gegen eine Batterie echter Spells mit Kontrollziel (Schaden, Fläche, Status, Heilung, Negierung, Zerstörung, Sperren), jeder Engine-Eingang einzeln, Ruhen bei Negierung/Frost/Betäubung, Piercing (Ida), Opfer-Kosten |
| `03` | Deklaration (Abbruch, ungültige Namen), Auslöser je Kartenart, Nicht-Auslöser, Ablauf zu Beginn des eigenen Zuges, Suche (leeres Deck, Such-/Hand-Sperre, Reveal, Mischen), mehrere Tränke, Wechselwirkung mit Luck, fremder Trank |
| `04` | breite Batterien (`lib/barrage.js`, `lib/coldplay.js`) für alle drei Karten |
