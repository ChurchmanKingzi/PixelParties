# C03-creatures – Nischenfall-Bericht
Stand/Autor: Agent C03-creatures, 12.10.2026. Karten: 21 in der Liste · (wird am Ende gezählt) gezielt getestet · (wird am Ende gezählt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde

### C03-01 · Gravedigger (gestohlen/geliehen) mahlt das EIGENE Deck des Aktivierenden · Stufe A
- **Karten:** Gravedigger (`cards/effects/gravedigger.js`); Weg: jeder Kontrollwechsel einer Kreatur (`actionStealCreature`: Lovely Teddy, Deepsea Succubus, Cute Conversion …).
- **Voraussetzungen / Aufbau:** Sitz 0 besitzt Gravedigger (Held 0 / Slot 0, nicht frisch); Sitz 1 stiehlt ihn und aktiviert ihn (`doActivateCreatureEffect` mit `charmedOwner = 0`). Decks: Sitz 0 = 20× Fireball, Sitz 1 = 20× Slow. Seed 1234.
- **Schritte:** 1. `actionStealCreature(1, gd)`. 2. Sitz 1 aktiviert den Gravedigger (Main Phase).
- **Erwartet** (Kartentext „You may once per turn send the top card of your opponent's deck to the discard pile."): „your opponent" ist der Gegner des Kontrolleurs (Sitz 1) = Sitz 0; Deck 0: 19, Deck 1: 20.
- **Beobachtet:** Deck 0: 20 (unberührt), Deck 1 (der Dieb selbst!): 19. Der Dieb mahlt sich selbst und der Besitzer verliert nichts.
- **Repro:** `docs/niche-tests/repro/C03-creatures/01-gravedigger-gestohlen-mahlt-eigenes-deck.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/gravedigger.js` `onCreatureEffect`: `const pi = engine.physicalSide(ctx.card) ?? ctx.cardOwner;` – `physicalSide()` (`_engine.js` ~19466) liefert für eine geliehene Kreatur den BESITZER; `opponentOf(pi)` ist dann der Kontrolleur. (Der Einsatz-Teil in `onPlay` benutzt korrekt `ctx.cardOwner`.)

### C03-02 · Inconspicuous Lawn Gnome (gestohlen): die Stufenwahl geht an den Besitzer, nicht an den Aktivierenden · Stufe B
- **Karten:** Inconspicuous Lawn Gnome (`cards/effects/inconspicuous-lawn-gnome.js`).
- **Voraussetzungen / Aufbau:** wie C03-01 (Gnom von Sitz 0, von Sitz 1 gestohlen, Sitz 1 aktiviert).
- **Erwartet** (Kartentext „You may once per turn change this card's level in your hand or on your side of the board to any level from 0 to 3."): Der Aktivierende (Kontrolleur) trifft die Wahl. (Zusatzfrage: ob ein gestohlener Gnom „auf deiner Seite des Bretts" liegt, s. u.)
- **Beobachtet:** Der `optionPicker` „Inconspicuous Lawn Gnome" geht an Sitz 0 (Besitzer); der Gegner entscheidet über die Stufe der Karte, die der Dieb gerade aktiviert hat.
- **Repro:** `docs/niche-tests/repro/C03-creatures/02-lawn-gnome-gestohlen-prompt-an-besitzer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `inconspicuous-lawn-gnome.js` `onCreatureEffect`: `const pi = engine.physicalSide(ich) ?? ctx.cardOwner;` (gleiche Ursache wie C03-01).
- **Frage an Al:** Darf der Dieb/Borger eines Gnoms dessen Stufe ändern (ja = Prompt an den Dieb) oder nicht, weil der Gnom nicht „auf seiner Seite des Bretts" liegt (nein = Aktivierung sperren)?

### C03-03 · Land Sharks (gestohlen): Zielzahl nach dem Helden des Diebes in derselben Spalte statt nach dem Wirtsheld · Stufe B
- **Karten:** Land Sharks (`cards/effects/land-sharks.js`).
- **Voraussetzungen / Aufbau:** Haie auf Sitz 0 / Held 0 (Slots 1–2 `_ZoneBlocked`). Fall 1: Sitz 0 Held 0 Summoning Magic 3, Sitz 1 Held 0 ohne Summoning Magic. Fall 2: umgekehrt. Sitz 1 stiehlt die Haie und aktiviert (`charmedOwner = 0`).
- **Erwartet** (Text „up to 1/2/3 targets … depending on the corresponding Hero's current Summoning Magic level"; Skript-Ruling im Kopf: „Massgeblich ist der Held, in dessen Zonen die Kreatur sitzt."): Wirtsheld SM 3 ⇒ 3 Ziele; Wirtsheld SM 0 ⇒ 1 Ziel.
- **Beobachtet:** Fall 1: 1 Ziel, Fall 2: 3 Ziele – es zählt der Held des Diebes mit demselben Index.
- **Repro:** `docs/niche-tests/repro/C03-creatures/03-land-sharks-gestohlen-stufe-vom-falschen-helden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `land-sharks.js` `zielzahl(engine, pi, heroIdx)` wird mit `pi = ctx.cardOwner` (Kontrolleur) und `heroIdx = ctx.cardHeroIdx` (Spalte des Wirtes) aufgerufen – gemischt aus zwei Seiten. Richtig wäre die Brettseite (`ctx.cardHeroOwner`).
- Unsicherheit: Ob bei einem gestohlenen Hai der Wirtsheld („corresponding Hero") oder ein Held des Kontrolleurs zählt, sagt der Text nicht; die Mischung (Dieb-Held an der Spalte des Opfers) ist aber in keiner Lesart gewollt.

### C03-04 · Monster Nest (geliehen/gestohlen): Karte danach doppelt auf dem Brett (Geister-Name, Bilanz +1) · Stufe A
- **Karten:** Monster Nest (`cards/effects/monster-nest.js`, `_nest-shared.js`), Weg über Lovely Teddy (echter Spielweg), ebenso jeder andere Kontrollwechsel.
- **Voraussetzungen / Aufbau:** Sitz 0: Lovely Teddy; Sitz 1: Monster Nest (Held 1 / Slot 1); Decks mit Kreaturen. Seed 1234.
- **Schritte:** 1. Sitz 0 aktiviert Lovely Teddy auf das Nest. 2. Sitz 0 aktiviert das geliehene Nest und wählt eine Kreatur aus dem eigenen Deck. 3. `t.endTurn()`.
- **Erwartet** (Text „…place it on top of this card … At the end of your turn, remove any Creature placed on top of this one and delete it"; Teddy: „as if you controlled it for the rest of the turn"): Die Kreatur liegt auf dem Nest (Brettseite 1), wird zum Zugende gelöscht, das Nest ist danach wieder normal da und gehört wieder Sitz 1. Kartenbilanz und Zustand unverändert.
- **Beobachtet:** Die Kreatur wird in Held 1 / Slot 1 der SEITE DES BORGENDEN (Sitz 0) gelegt; das Nest bleibt als verdeckter Name auf Sitz 1 stehen. Zum Zugende taucht das Nest (Kontrolleur = Sitz 0) in Sitz 0 Held 1 / Slot 1 auf, während der Name in Sitz 1 Held 1 / Slot 1 ohne Instanz zurückbleibt: `Monster Nest: +1` in der Kartenbilanz, `audit`: „seat0.support[1][1] \"Monster Nest\": 0 Instanzen" (bzw. Geister-Instanz bei belegtem Platz). Variante mit belegtem Dieb-Platz: das Nest landet im ersten freien Platz des Diebes, die Kreatur dort davor – ebenfalls Geister-Zonen.
- **Repro:** `docs/niche-tests/repro/C03-creatures/04-monster-nest-gestohlen-karte-dupliziert.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `monster-nest.js` `onCreatureEffect` ruft `summonCreatureWithHooks(chosen, pi = ctx.cardOwner, heroIdx, zoneSlot, …)` mit der Kontroll-Seite; `_nest-shared.js` `surface()`, `nestedUnder()`, `coveringInstance()` rechnen alle mit `inst.controller ?? inst.owner` statt mit `engine.physicalSide(inst)`. Der „Normalfall" in `surface()` (Name liegt noch im Platz) greift dadurch nicht, der „Ausnahmefall" schreibt den Namen ein zweites Mal in die falsche Seite.

### C03-05 · Golden Exploding Skull zählt unversehrte Kreaturen beim Gold nicht mit · Stufe A
- **Karten:** Golden Exploding Skull (`cards/effects/golden-exploding-skull.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: 3 Helden à 800 HP, zwei ZZ Dummy (über den echten Spielweg `doPlayCreature` beschworen, nie beschädigt), der Skull; 100 Gold. Skull wird mit `actionDestroyCard` besiegt.
- **Erwartet** (Text „deal 50 damage to all targets you control. You gain 5 Gold for each target hit by this effect."): 5 getroffene Ziele (3 Helden + 2 Kreaturen) ⇒ +25 Gold.
- **Beobachtet:** Die Kreaturen verlieren je 50 HP (200 → 150), aber das Gold steigt nur um 15 (3 Helden).
- **Repro:** `docs/niche-tests/repro/C03-creatures/05-golden-exploding-skull-zaehlt-unversehrte-kreaturen-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `golden-exploding-skull.js` `zieleAufnehmen()`: `const hp = inst.counters?.currentHp; if (!Number.isFinite(hp)) continue;` – `counters.currentHp` ist bei einer Kreatur ohne bisherigen Treffer nicht gesetzt (die Engine initialisiert es erst beim ersten Schaden, `_engine.js` ~46382; sonst gilt `currentHp ?? baseHp`, vgl. Z. 10142/45522). Unversehrte Kreaturen fallen aus der Zählliste, nur bereits beschädigte werden gezählt.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
