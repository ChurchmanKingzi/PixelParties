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

### C03-06 · Grave Worm: ein zweiter Grave Worm auf dem Brett verliert seine Instanz, wenn der Ablage-Wurm wiederbelebt wird · Stufe A
- **Karten:** Grave Worm (`cards/effects/grave-worm.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: Grave Worm in der Ablage, ein zweiter Grave Worm auf dem Brett (Held 1 / Slot 0), eine eigene Kreatur (Held 0 / Slot 1) stirbt (`actionDestroyCard`); Rückfrage „Crawl out!" mit Ja. Seed 1234.
- **Erwartet** (Text „you may summon this Creature into the same Support Zone from your discard pile"): Der Ablage-Wurm kommt in den Platz der gestorbenen Kreatur; der Brett-Wurm bleibt unberührt (Zone ↔ Instanz konsistent).
- **Beobachtet:** Der Ablage-Wurm wird korrekt eingesetzt, aber der Brett-Wurm verliert seine Instanz: `audit`: „seat0.support[1][0] \"Grave Worm\": 0 Instanzen". Der Name bleibt als unzerstörbarer Platzhalter im Platz (wird als Ziel angeboten, Schaden wirkt nicht). Liegt der zweite Wurm stattdessen auf der Hand, verliert auch er seine Instanz (Folge dort harmlos: Spielen aus der Hand legt eine neue Instanz an, `audit` sauber).
- **Repro:** `docs/niche-tests/repro/C03-creatures/06-grave-worm-zweiter-wurm-verliert-instanz.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `grave-worm.js` Z. 259–260: `const listenerId = ctx.card?.id; … engine._untrackCard(listenerId);` – `activeIn` enthält neben der Ablage auch Brett/Hand; die Instanz, die den Haken zuerst ausführt, räumt sich ab. Das ist bei zwei Würmern nicht zwingend der Ablage-Wurm.

### C03-07 · Grave Worm: „sent to the discard pile" wird nur am Namen in der eigenen Ablage erkannt · Stufe B
- **Karten:** Grave Worm (`cards/effects/grave-worm.js`); Gegenkarten Hell Fox, Lovely Teddy/jede geliehene Kreatur.
- **Voraussetzungen / Aufbau:** Fall A: Ablage Sitz 0 = Grave Worm + Hell Fox, Hell Fox steht auf dem Brett und wird zerstört. Fall B: Ablage Sitz 0 = Grave Worm + ZZ Dummy Frail; Sitz 0 stiehlt eine ZZ Dummy Frail von Sitz 1 (`actionStealCreature`), diese wird zerstört.
- **Erwartet** (Text „is defeated and sent to the discard pile while this Creature is in your discard pile"): Kreatur wurde gelöscht (Hell Fox: „delete it") bzw. ging in die Ablage des Besitzers (Gegner) ⇒ keine Rückfrage des Wurms.
- **Beobachtet:** Fall A: Hell Fox landet im Gelöscht-Stapel, der Wurm fragt trotzdem „Hell Fox just hit your discard pile" und wird in den Platz gesetzt (der alte Hell Fox in der Ablage genügt). Fall B: der Wurm fragt ebenfalls und setzt sich in Held/Slot-Nummer der Gegnerseite auf die EIGENE Seite (Held 2 / Slot 2 von Sitz 0).
- **Repro:** `docs/niche-tests/repro/C03-creatures/07-grave-worm-ablage-nur-am-namen-erkannt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `grave-worm.js` Z. 182: `if (!(ps.discardPile || []).includes(death.name)) return;` prüft nur, ob IRGENDEIN Exemplar des Namens in der Ablage liegt, nicht ob DIESE Karte dort ankam; zusätzlich `dyingController`-Prüfung (Kontrolleur) gegen Ablage des Besitzers.

### C03-08 · Golden Vermin: „1 Karte statt Gold" wird auch bei Zieh-/Handsperre angeboten – Gold UND Karte gehen verloren · Stufe B
- **Karten:** Golden Vermin (`cards/effects/golden-vermin.js`); Sperren: `ps.drawLocked` (The Sacred Jewel), `ps.handLocked`.
- **Voraussetzungen / Aufbau:** Sitz 0: Golden Vermin; Zieh- bzw. Handsperre gesetzt; Sitz 0 gewinnt per Effekt 10 Gold (`actionGainGold`); Rückfrage mit Ja. Deck 30. Seed 1234.
- **Erwartet** (Text „you may draw 1 card instead"; Vorbild-Ruling in `golden-ladybug.js`: „Leerlauf – eine Option, die nichts bewirken kann, entfällt (Zieh-/Handsperre …)"): Tausch wird nicht angeboten (Gold +10) oder die Karte kommt wirklich.
- **Beobachtet:** Rückfrage „Draw 1 card instead of gaining 10 Gold? (1/5 uses this turn)" erscheint; mit Ja entfällt das Gold, das Ziehen wird von der Sperre verschluckt: Gold ±0, Hand ±0 (und der Verbrauch 1/5 ist gebucht). (Bei leerem Deck verliert der Spieler mit Ja per Deck-out – das ist seine Entscheidung, aber auch dort wird es nicht gewarnt.)
- **Repro:** `docs/niche-tests/repro/C03-creatures/08-golden-vermin-zieh-sperre-gold-weg.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `golden-vermin.js` `onResourceGain`: vor dem Angebot keine Prüfung auf `drawLocked`/`handLocked`/leeres Deck (so wie `kannZiehen()` in `golden-ladybug.js`); `ctx.cancel()` läuft vor dem Zug.

### C03-09 · Golden Vermin fängt das automatische Rundeneinkommen (4 Gold) ab, obwohl der Text „through an effect" sagt · Stufe B
- **Karten:** Golden Vermin (`cards/effects/golden-vermin.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: Golden Vermin; zwei `t.endTurn()` bis zum Zugbeginn von Sitz 0; Rückfrage mit Ja.
- **Erwartet** (Text „when you would gain Gold through an effect"; Ruling Als 8.8. in `_engine.js` `actionGainGold`: „through an effect schließt das Rundeneinkommen (`_isResourceGain`) ausdrücklich aus" – Monkees, Humby, Royal Treasury, Golden Ladybug prüfen das): keine Vermin-Rückfrage beim Einkommen, 4 Gold kommen an.
- **Beobachtet:** Rückfrage „Draw 1 card instead of gaining 4 Gold? (1/5 uses this turn)" zu Beginn jedes eigenen Zuges (mit Ja: Karte statt 4 Gold Einkommen; Gold ±0).
- **Repro:** `docs/niche-tests/repro/C03-creatures/09-golden-vermin-faengt-rundeneinkommen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `golden-vermin.js` `onResourceGain` prüft `ctx._isResourceGain` nicht (vgl. `wealth.js:32`, `royal-treasury.js:71`).
- **Frage an Al:** Soll Golden Vermin das automatische Rundeneinkommen ersetzen dürfen (ja = jetziges Verhalten) oder nur Effekt-Gold wie die Monkees (nein)?

### C03-10 · Mr. Jiggles (gestohlen): die geliehene Kreatur selbst wird als „Ziel, das dein Gegner kontrolliert" angeboten · Stufe C
- **Karten:** Mr. Jiggles (`cards/effects/mr-jiggles.js`); Weg: jeder Kontrollwechsel (Lovely Teddy …).
- **Voraussetzungen / Aufbau:** Sitz 0: Mr. Jiggles (Held 0 / Slot 0) + ZZ Dummy; Sitz 1 stiehlt Jiggles (`actionStealCreature`) und aktiviert ihn (`charmedOwner = 0`).
- **Erwartet** (Text „up to 2 targets your opponent controls"): Jiggles wird jetzt von Sitz 1 kontrolliert; er ist kein Ziel „des Gegners". Angeboten werden nur Held und Kreaturen von Sitz 0 ohne Jiggles.
- **Beobachtet:** Zielliste: alle Helden von Sitz 0, `Mr. Jiggles` selbst und ZZ Dummy. Der Dieb kann seine geliehene Kreatur (90 HP) mit 100 Schaden selbst zerstören (und sie kommt in die Ablage des Besitzers) – die Zielseite `'enemy'` wird nach Brettseite aufgelöst, nicht nach Kontrolle. (Die übrigen Karten dieser Gruppe mit `side: 'any'`/Zielwahl ohne Kontroll-Text sind davon nicht betroffen.)
- **Repro:** `docs/niche-tests/repro/C03-creatures/10-mr-jiggles-gestohlen-bietet-sich-selbst-als-gegnerziel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `mr-jiggles.js` `ctx.promptMultiTarget({ side: 'enemy', … })` – kein Filter auf `inst.controller`; verwandt mit C01-05/-07 (Brettseite statt Kontrolle).
- **Frage an Al:** Darf eine geliehene Kreatur ihren eigenen Wirtsplatz als Gegnerziel wählen (ja = Brettseite zählt) oder soll sie herausgefiltert werden (nein = Kontrolle zählt)?

### C03-11 · Monster Nest bietet Ifrit aus dem Deck an (nur von der Hand beschwörbar); die Wahl scheitert still und mischt das Deck · Stufe B
- **Karten:** Monster Nest (`cards/effects/monster-nest.js`), Ifrit (`ifrit.js`, `summonOnlyFromHand`).
- **Voraussetzungen / Aufbau:** Sitz 0: Monster Nest (nicht frisch); Deck = [Ifrit, Fireball, Slow]; Nest aktivieren, in der Galerie Ifrit wählen.
- **Erwartet** (Ifrit: „This Creature cannot be summoned from anywhere, except your hand."; Nest-Kommentar: „die Galerie soll gar nicht erst lügen"; Pinta/Slave Trader filtern `summonOnlyFromHand`): Ifrit steht nicht in der Galerie; ist er die einzige taugliche Karte, ist das Nest nicht aktivierbar.
- **Beobachtet:** Ifrit steht in der Galerie (auch als einzige Karte ist das Nest „aktivierbar"). Die Wahl wird vom Engine-Riegel abgewiesen (Log `summon_blocked`/`hand_only`), das Nest hebt sich wieder, die Karte kehrt ins Deck zurück und das Deck wird dabei neu gemischt (Ifrit, Fireball, Slow → Fireball, Slow, Ifrit): ein wirkungsloser Zug, der ein freies Mischen erlaubt. Bilanz/Zustand sauber, keine Fehler.
- **Repro:** `docs/niche-tests/repro/C03-creatures/11-monster-nest-bietet-ifrit-an.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `monster-nest.js` `eligibleFromDeck()` (Filter: `isPileCreature`, kein Artifact-Creature, Level ≤ 3) ohne `loadCardEffect(cn)?.summonOnlyFromHand` (und ohne `cannotBeRevived`-/Bedingungs-Prüfung); `canActivateCreatureEffect` hängt an derselben Liste.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
