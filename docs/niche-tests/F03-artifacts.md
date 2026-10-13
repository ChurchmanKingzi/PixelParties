# F03-artifacts – Nischenfall-Bericht
Stand/Autor: Agent F03-artifacts, 13.10.2026. Karten: 48 in der Liste · (wird am Ende gezählt) gezielt getestet · (wird am Ende gezählt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### F03-01 · The White Eye kehrt beim Heldentod nicht auf die Hand zurück · Stufe B
- **Karten:** The White Eye (`cards/effects/the-white-eye.js`), Engine `handleHeroDeathCleanup`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 spielt The White Eye auf Held 0 (Slot 0); Hand sonst leer.
- **Schritte:** 1. Kontrollprobe: Ausrüstung per Effekt zerstören (`actionDestroyCard`). 2. Neu aufbauen, den Träger-Held durch 5000 Schaden töten.
- **Erwartet** (Kartentext „When this card is sent to your discard pile, except because you discarded it from your hand, add it to your hand immediately."): Beim Heldentod wandert die Ausrüstung in die Ablage – das ist „sent to your discard pile" – also landet die Karte auf der Hand.
- **Beobachtet:** Kontrollprobe ✓ (Hand). Heldentod ✗: The White Eye liegt in der Ablage, die Hand bleibt leer.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/01-white-eye-heldentod.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-white-eye.js` `onCardLeaveZone` verlangt `ctx.toZone === 'discard'`; `handleHeroDeathCleanup` (`_engine.js` ~47650) feuert den Hook ohne `toZone` und legt die Karte selbst in `discardPile` (der `_returnToHand`-Pfad von `actionMoveCard` ~13482 wird dort nicht durchlaufen). Die Instrument-Karten (`_orchestra-shared.instrumentDiscardTrigger`) behandeln „kein toZone = Discard" ausdrücklich.

### F03-02 · The Sun Sword: Frost-Immunität ist ein Momentstempel statt eines Dauerprädikats · Stufe B
- **Karten:** The Sun Sword (`cards/effects/the-sun-sword.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 spielt The Sun Sword auf Held 0; je Fall ein Zusatzaufbau (siehe Schritte).
- **Schritte:** E) Gegner-Kreatur nach dem Schwert per `actionStealCreature(0, …)` stehlen, dann einfrieren. F) eigene (immune) Kreatur von Sitz 1 stehlen lassen, dann einfrieren. G) Held 1 sterben und wiederbeleben, dann einfrieren. H) Gegner-Held per `actionTakeHeroPermanently(0, 1, 1)` übernehmen, dann einfrieren.
- **Erwartet** (Kartentext „… targets you control cannot be Frozen …"): Solange das Schwert liegt, ist jedes Ziel, das Sitz 0 *gerade* kontrolliert, nicht einfrierbar; was Sitz 0 nicht mehr kontrolliert, ist es nicht mehr.
- **Beobachtet (alle ✗):** E) gestohlene Kreatur ist einfrierbar. F) die von Sitz 1 gestohlene Kreatur trägt weiter `freeze_immune` (Gegner bekommt Gratis-Immunität). G) wiederbelebter Held ist einfrierbar. H) übernommener Held ist einfrierbar. Normalfälle (Anlegen taut alles auf, neue Kreaturen sind immun, zweites Schwert hält die Immunität, Verlust des letzten Schwerts nimmt sie weg, Brand „rest of the game" überlebt den Schwertverlust) ✓.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/02-sun-sword-frost-immunitaet-momentstempel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-sun-sword.js` `applyFreezeImmunity()` läuft nur in `onPlay`/`onGameStart` und `onCardEnterZone` (neue Kreaturen); kein Haken für Wiederbelebung (`onRevive`), Kontrollwechsel (`onTakeControl`) oder Rückgabe. Die Immunität steht als Stempel (`statuses.freeze_immune` / `counters.freeze_immune`) und wird beim Tod geleert bzw. beim Diebstahl mitgegeben.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| (wird ergänzt) | | |

## Getestet & in Ordnung (Auswahl)
(wird ergänzt)
