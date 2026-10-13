# C03-creatures – Nischenfall-Bericht
Stand/Autor: Agent C03-creatures, 12./13.10.2026 (Fortsetzung nach Abbruch durch API-Limit). Karten: 21 in der Liste · 21 gezielt getestet (L2) · 13 mit Befund. Befunde: 20 (Stufe A: 4 · B: 10 · C: 6).

## Zusammenfassung
20 Befunde (A: 4 · B: 10 · C: 6), alle mit ausgeführtem Repro unter `docs/niche-tests/repro/C03-creatures/`.

| ID | Titel | Stufe |
|---|---|---|
| C03-01 | Gravedigger (gestohlen) mahlt das EIGENE Deck des Aktivierenden | A |
| C03-04 | Monster Nest (geliehen/gestohlen): Karte danach doppelt auf dem Brett, Bilanz +1 | A |
| C03-05 | Golden Exploding Skull zählt unversehrte Kreaturen beim Gold nicht mit (`currentHp`-Rückfall, Prüfauftrag C05-01) | A |
| C03-06 | Grave Worm: zweiter Wurm auf dem Brett verliert seine Instanz (Platzhalter-Name bleibt) | A |
| C03-02/-03 | Lawn Gnome / Land Sharks (gestohlen): Wahl bzw. Stufe vom falschen Spieler/Helden | B |
| C03-07 | Grave Worm erkennt „in die Ablage gesendet" nur am Namen | B |
| C03-08/-09 | Golden Vermin: Zieh-/Handsperre vergisst, Rundeneinkommen wird abgefangen | B |
| C03-11 | Monster Nest bietet Ifrit (nur von der Hand) an, Wahl scheitert still und mischt | B |
| C03-12 | Ifrit gefroren/betäubt/negiert: Bonus und Immunität bleiben (Klasse B-01…B-03) | B/C |
| C03-14 | Lovely Teddy: Koordinatenkollision im Zielsammler (Wurzel F02-14) | B |
| C03-16 | Jiggles / Land Sharks mit Angler Angel: nur das erste Ziel +50 (Klasse C01-10) | B |
| C03-19 | Monster Nest legt Land Sharks auch bei belegten Nachbarzonen (Hai mit einer Zone) | B |
| C03-10/-13/-15/-17/-18/-20 | Regelfragen (Jiggles bietet sich selbst an; Gnom je Ort; Mausoleum-Limit; Demon geliehen/gefroren; Falter gestohlen) | C |

Gesamteindruck: Die meisten Karten verhalten sich sauber; die Fehler konzentrieren sich auf (1) **Kontrolle statt Besitzer/Brettseite bei gestohlenen Kreaturen** (C03-01/-02/-03/-04/-10/-20, Klasse C01-05/-06), (2) **Zustand-Zonen-Abgleich bei Mehrfachkopien und Nest** (C03-04/-06/-19) und (3) **Rückfall `currentHp`** (C03-05). Alle stillgelegten Kreaturen (Frost/Betäubung/Negation) ruhen dynamisch korrekt – Ausnahmen Ifrit (C03-12) und die Reihenfolge Statusablauf vor Zugende-Hooks (C03-18). Die Prüfaufträge sind beantwortet: C05-01 → C03-05 (nur dieses Skript in meiner Gruppe); C01-05/-06 → C03-01/-02/-03/-10/-20; C01-10 → C03-16; F02-14 → C03-14; C01-12 („up to N" + negierte erste Aktivierung) – in dieser Gruppe nicht anwendbar (Golden Vermin ist ein Hook mit Verbrauchszähler, keine Aktivierung; alle aktiven Effekte sind „once per turn"); C05-02 (Zugende-Räumung `negated` ohne `sourceBound`) – keine Karte dieser Gruppe negiert Helden/Anhänge, Kreaturennegation (Ifrit/Demon) überlebt mehrere echte Zugwechsel ✓.
Bewusst NICHT getestet: Skill-Test-Modus; Mehrspieler-Sitze (3/4); CPU-Antworten (`cpuResponse`); Animationen/Client; Karten-Reveals nur soweit sie Zustand ändern; `doActivateDiscardEffect` (Server-Gate, Harness-Host exportiert es nicht – Mountain Boars Ablage-Weg über `onDiscardEffect` direkt gemessen); Erst-Runden-Immunität (aktivierbare Kreaturen sind in Zug 1 nicht „alt", Klasse B-05/-06 nicht erreichbar).

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

### C03-12 · Ifrit: gefroren/betäubt/negiert gibt er Armageddon weiter +100 Schaden und bleibt unverwundbar (Klasse B-01…B-03) · Stufe B/C
- **Karten:** Ifrit (`cards/effects/ifrit.js`: `armageddonBonus`, `immuneToSourceNames`), Armageddon (`armageddon.js`, `_apocalypse-shared.js`).
- **Voraussetzungen / Aufbau:** Sitz 1: Ifrit (nicht frisch) + ZZ Dummy Big; Ifrit gesund / negiert (`actionNegateCreature`) / gefroren / betäubt (`applyCreatureStatus`, **await**); Sitz 0 wirkt Armageddon (Destruction 3 gewährt) über den echten Weg.
- **Erwartet** (Text „The damage of all Armageddon Spells … is increased by 100. This Creature is unaffected by Armageddon."; Engine-Konvention `isCreatureEffectSuppressed`, B-01…B-03): gesund 150 Schaden, Ifrit unverwundbar; stillgelegt nur 50 Schaden und Ifrit nimmt 50.
- **Beobachtet:** gesund ✓. Negiert, gefroren, betäubt: weiter 150 Schaden auf den Helden und Ifrit bleibt bei 80 HP. Die Prüfliste in B-querschnitt nennt `immuneToSourceNames (Ifrit)` als „ohne Prüfung" (statisch); hier dynamisch bestätigt, und der Aufschlag (`armageddonBonus`) gehört ebenfalls dazu.
- **Repro:** `docs/niche-tests/repro/C03-creatures/12-ifrit-stillgelegt-bonus-und-immunitaet-bleiben.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_apocalypse-shared.js` `ifritsOf()` (Z. 38–47: Zone/Kontrolleur, kein `isCreatureEffectSuppressed`), gelesen in `armageddon.js` `schaden()`; Immunität in `_engine.js` ~46122/46140.
- **Frage an Al:** Wie B-01: Soll ein gefrorener/betäubter/negierter Ifrit Aufschlag und Immunität verlieren (ja) oder gelten beide als statische Eigenschaft der Karte (nein)?

### C03-13 · Inconspicuous Lawn Gnome: „once per turn" gilt getrennt für Hand und Brett – im selben Zug zweimal umstellbar · Stufe C
- **Karten:** Inconspicuous Lawn Gnome (`cards/effects/inconspicuous-lawn-gnome.js`, Hand-Weg `doHandActivate` in `_engine.js` ~40678).
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 mit Summoning Magic 3, Gnom auf der Hand. (1) in der Hand auf Stufe 2 stellen, (2) Gnom spielen, (3) auf dem Brett auf Stufe 3 stellen – alles im selben Zug.
- **Erwartet** (Text „You may once per turn change this card's level in your hand or on your side of the board"): Lesart A: ein Kontingent je Zug und Karte, Schritt (3) gesperrt; Lesart B: je Ort.
- **Beobachtet:** Alle drei Schritte gelingen (Hand-Stempel `_revealedThisTurn` und Brett-Stempel `creature-effect:<id>` sind getrennt); die gesetzte Hand-Stufe 2 wirkt nach dem Spielen nicht weiter (Brettstufe wieder Basis), die zweite Änderung setzt dann 3. (Gegenprobe: zwei Aktivierungen auf dem Brett im selben Zug – die zweite wird abgewiesen; Lv-3-Gnom aus der Hand ist mit Summoning Magic 1 nicht spielbar – beides in Ordnung.)
- **Repro:** `docs/niche-tests/repro/C03-creatures/13-lawn-gnome-stufe-erst-hand-dann-brett.js` (✗ = Lesart A wird verletzt)
- **Vermutete Ursache:** zwei getrennte Einmal-Stempel (`_revealedThisTurn` an der Hand-Instanz, `creature-effect:<instId>` am Brett).
- **Frage an Al:** Eine Stufenänderung je Zug und Karte insgesamt (Lesart A) oder je Ort, also einmal in der Hand und einmal auf dem Brett (Lesart B = jetzt)?

### C03-14 · Lovely Teddy: eine geklaute Kreatur an derselben (Held, Slot)-Stelle der anderen Seite macht die gegnerische Kreatur unborgbar (Wurzel F02-14) · Stufe B
- **Karten:** Lovely Teddy (`cards/effects/lovely-teddy.js`, nutzt `engine.getCreatureTargets`). Gleiche Wurzel wie F02-14 (Poisoned Meat u. a.); hier nur der Teddy-Weg belegt.
- **Voraussetzungen / Aufbau:** Sitz 0: Teddy (Held 0 / Slot 0) und Haressassin Y (Held 1 / Slot 0); Sitz 1 stiehlt Y (`actionStealCreature`: Besitzer 0, Kontrolle 1, Brettseite 0). Sitz 1: Mr. Jiggles X (Held 1 / Slot 0), nach Y angelegt. Sitz 0 aktiviert Teddy.
- **Erwartet** (Text „choose a Creature your opponent controls … use that Creature's active effects as if you controlled it"): X ist borgbar.
- **Beobachtet:** Teddy ist nicht aktivierbar (keine Ziele). Die Instanzsuche in `getCreatureTargets(1)` liefert für die Stelle (Held 1 / Slot 0) die geklaute Y (hat `stolenBy` ⇒ von Teddys Filter ausgeschlossen); X fällt mit heraus. Mit vertauschter Anlegereihenfolge (X vor Y) funktioniert es. (Gegenproben in Ordnung: geborgte Kreatur stirbt ⇒ Ablage des Besitzers; Rückgabe zum Zugende; geborgte Haressassin trifft per Teddy-Weg.)
- **Repro:** `docs/niche-tests/repro/C03-creatures/14-lovely-teddy-zielsammler-koordinatenkollision.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~40263 `getCreatureTargets` (ohne Brettseite in der Instanzsuche), vgl. F02-14.

### C03-15 · Mausoleum Worm: „You can only play 1 Mausoleum Worm per turn" begrenzt nur die Platzierung aus der Ablage, nicht das Spielen aus der Hand · Stufe C
- **Karten:** Mausoleum Worm (`cards/effects/mausoleum-worm.js`).
- **Voraussetzungen / Aufbau:** Sitz 0 am Zug; Worm in der Hand und in der Ablage; Held mit Summoning Magic 3. Fall A: Worm von der Hand spielen, danach fällt im selben Zug ein Held von Sitz 0 durch eine Gegnerquelle (`actionDealDamage` mit Quelle von Sitz 1). Fall B: umgekehrte Reihenfolge.
- **Erwartet** (Text „You can only play 1 \"Mausoleum Worm\" per turn", kein „this way" wie bei Grave Worm): Lesart A: ein Worm je Zug über alle Wege; Lesart B: nur der Ablage-Weg ist gedeckelt (jetzt).
- **Beobachtet:** In beiden Reihenfolgen stehen zwei Mausoleum Worms im selben Zug auf dem Brett (A: Rückfrage erscheint, zweite Platzierung + Nachziehen auf 8; B: das Handspiel gelingt nach dem Stempel). Der Stempel `hoptUsed['mausoleum-worm:<pi>']` wird nur im Ablage-Haken gesetzt und gelesen. (Gegenproben in Ordnung: zwei Worms in der Ablage, zwei Helden fallen im selben Zug ⇒ nur eine Platzierung; alle drei Zonen belegt ⇒ kein Angebot; Selbstschaden ⇒ kein Angebot.)
- **Repro:** `docs/niche-tests/repro/C03-creatures/15-mausoleum-worm-eine-pro-zug-gilt-nur-fuer-ablage.js` (✗ = Lesart A wird verletzt)
- **Vermutete Ursache:** Stempel/Gate nur in `discardHooks.onHeroDefeatFinal`; die Hand-Beschwörung kennt keine Sperre.
- **Frage an Al:** Gilt „play 1 per turn" für jeden Weg aufs Brett (Hand und Ablage zusammen = A) oder nur für den Ablage-Weg (B = jetzt)?

### C03-16 · Mr. Jiggles und Land Sharks mit Angler Angel: bei mehreren Zielen wird nur das erste um +50 erhöht (Bestätigung von C01-10) · Stufe B
- **Karten:** Mr. Jiggles (`mr-jiggles.js`), Land Sharks (`land-sharks.js`); Angler Angel (`angler-angel.js`). Gleiche Klasse wie C01-10 (Cavalry, Yuki-Onna, Assault Eagle).
- **Voraussetzungen / Aufbau:** Sitz 0: Angler Angel (Held 0) + Täter (Held 1, nicht frisch); Sitz 1: Helden und große Kreatur. Jiggles: Ziele Held 0 + Held 1 (auch Variante Held + Kreatur, zwei Kreaturen); Land Sharks (Summoning Magic 3): Held 0, Held 1, Kreatur.
- **Erwartet** (Text „All damage your other Creatures inflict with their effects is increased by 50"; Ruling im Kopf von `angler-angel.js`/C01-10: ein Schlag auf mehrere Ziele ist EINE Schadensinstanz): alle Ziele 150.
- **Beobachtet:** Jiggles: Ziel 1 = 150, Ziel 2 = 100 (bei allen Zielkombinationen: Held+Held, Held+Kreatur, Kreatur+Kreatur). Land Sharks: Ziel 1 = 150, Ziele 2 und 3 = 100.
- **Repro:** `docs/niche-tests/repro/C03-creatures/16-jiggles-land-sharks-angler-angel-nur-erstes-ziel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** wie C01-10 (Rundensperre `angler-boost:<id>` wird vom ersten Treffer gebucht); Jiggles/Sharks bauen für jeden Treffer eine neue Quelle `{ name, owner, heroIdx }` bzw. rufen `ctx.dealDamage` einzeln, ohne gemeinsame Schlag-Kennung. Nicht erneut gefragt: Frage an Al steht bei C01-10.

### C03-17 · Horned Demon (von Lovely Teddy geliehen): der Leiher legt am Ende SEINES Zuges einen Demon Counter auf die Gegner-Kreatur · Stufe C
- **Karten:** Horned Demon (`cards/effects/horned-demon.js`), Lovely Teddy (`lovely-teddy.js`); gilt für jeden passiven Hook einer per `actionStealCreature` geliehenen Kreatur (Aligning Goals, Deepsea Succubus …).
- **Voraussetzungen / Aufbau:** Sitz 0: Lovely Teddy (alt); Sitz 1: Horned Demon (alt) mit 2 Demon Countern. Sitz 0 leiht den Demon (echter Aktivierungsweg), danach `t.endTurn()`.
- **Erwartet** (Demon: „At the end of each of your turns, place a Demon Counter on this Creature."; Teddy: „You may use that Creature's active effects as if you controlled it for the rest of the turn."): Teddy leiht nur AKTIVE Effekte; „your turns" des Demons sind die Züge von Sitz 1 ⇒ Zähler bleibt 2.
- **Beobachtet:** Zähler = 3. Der Leiher füttert am Ende seines eigenen Zuges den Demon des Gegners (der danach 150 statt 100 Schaden macht). Der Demon geht wie vorgesehen zurück an Sitz 1. Gegenproben in Ordnung: Golden Vermin ist nicht borgbar (kein aktiver Effekt), geliehener Giant Exploding Skull lässt sich sprengen (Ablage des Besitzers).
- **Repro:** `docs/niche-tests/repro/C03-creatures/17-horned-demon-geliehen-zaehler-fuer-den-leiher.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `horned-demon.js` `onTurnEnd`: `if (!ctx.isMyTurn) return;` – `isMyTurn` folgt dem (geliehenen) Kontrolleur (`_engine.js` ~3867); CARD_API „Lovely Teddy" (Z. 19392) regelt nur „Rundensperre je Kreatur", nichts zu Passiv-Hooks.
- **Frage an Al:** Soll ein von Lovely Teddy/Aligning Goals geliehener Demon am Zugende des Leihers einen Counter bekommen (jetzt) oder nur am Ende der Züge seines Besitzers (nein)?

### C03-18 · Horned Demon (gefroren/betäubt): bekommt am Ende des eigenen Zuges trotzdem den Counter (Eis fällt vor den Zugende-Hooks) · Stufe C
- **Karten:** Horned Demon; gleiche Reihenfolge betrifft jede Kreatur mit `onTurnEnd`-Effekt („At the end of your turn …": Monster Nest-Räumung, Moonlight Butterfly …), hier nur der Demon belegt.
- **Voraussetzungen / Aufbau:** Sitz 0: Horned Demon (alt, 1 Counter). Sitz 1 friert bzw. betäubt ihn in seinem Zug (`applyCreatureStatus`, **await**); der Status hält über den ganzen folgenden Zug von Sitz 0. Dort: Aktivierung (abgewiesen ✓), dann `t.endTurn()`.
- **Erwartet** (Konvention B-01…B-03: gefrorene/betäubte Kreatur verliert ihre Effekte): Zähler unverändert.
- **Beobachtet:** Zähler +1 – obwohl der Demon den ganzen Zug gefroren/betäubt war. Reihenfolge der End-Phase: `processStatusExpiry('END')` (`_engine.js` ~22923) entfernt Frost/Betäubung, DANACH läuft `ON_TURN_END` (~23479). Gegenprobe: ein gefrorener Mimic (Zugbeginn-Hook) klaut nicht; Giant/Golden Exploding Skull, Hell Fox, Golden Vermin, Golden Ladybug, Luna Kiai und die Aktivierungen aller Karten dieser Gruppe ruhen bei Frost/Betäubung/Negation korrekt (negiert: auch der Demon legt keinen Counter).
- **Repro:** `docs/niche-tests/repro/C03-creatures/18-horned-demon-gefroren-zaehler-am-zugende.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Engine-Reihenfolge in der End-Phase, nicht das Kartenskript.
- **Frage an Al:** Soll ein im eigenen Zug gefrorener/betäubter Demon am Zugende noch seinen Counter bekommen (jetzt, weil der Status vorher abläuft) oder nicht?

### C03-19 · Monster Nest legt Land Sharks auch bei belegten Nachbarzonen – ein Hai mit nur einer Zone · Stufe B
- **Karten:** Monster Nest (`cards/effects/monster-nest.js`), Land Sharks (`land-sharks.js`, `multiZone: 3`, `canSummon` verlangt drei freie Plätze); gleiche Lücke zu erwarten bei Populated Island Turtle (nicht meine Gruppe, nicht geprüft).
- **Voraussetzungen / Aufbau:** Sitz 0 / Held 0: Monster Nest (Slot 0, alt), ZZ Dummy in Slot 1 und 2; Deck: Land Sharks + Füller. Nest aktivieren, Land Sharks wählen.
- **Erwartet** (Land Sharks: „This Creature occupies 3 Support Zones."): Land Sharks steht nicht in der Galerie bzw. lässt sich nicht legen, solange die Nachbarzonen von Kreaturen belegt sind – oder die Nachbarn werden vom Hai verdrängt. Jedenfalls kein Hai mit nur einer Zone neben zwei fremden Kreaturen.
- **Beobachtet:** Land Sharks steht in der Galerie und wird auf das Nest gelegt (`["Land Sharks","Monster Nest"]` in Slot 0), die beiden Dummys bleiben in Slot 1/2. (Zugende räumt sauber auf: Hai gelöscht, Nest zurück.) Gegenprobe: bei leeren Nachbarzonen setzt die Engine korrekt zwei `_ZoneBlocked`-Platzhalter. Weitere Nest-Ziele ohne Befund: Nest legt Monster Nest, Mountain Boars (keine Area-Löschung, da kein normaler Einsatz), Golden Vermin, Mimic, Luna Kiai, Horned Demon, Hell Fox, beide Skulls, Grave Worm – Aufräumen zum Zugende und Bilanz sauber.
- **Repro:** `docs/niche-tests/repro/C03-creatures/19-monster-nest-land-sharks-bei-belegten-nachbarzonen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `monster-nest.js` ruft `summonCreatureWithHooks(…, { coverNested: true })`; die Nest-Galerie (`eligibleFromDeck`) und der Einsatz prüfen nicht `canSummon`/`multiZone`; `_multizone-shared.js` `claimZones` setzt nur in leere Zonen (`gesetzt === 0` ⇒ stilles `false`).

### C03-20 · Moonlight Butterfly (dauerhaft gestohlen): Falter fliegt auf die Hand des Besitzers, der 150-Schaden trifft dessen Wirtsheld · Stufe C
- **Karten:** Moonlight Butterfly (`cards/effects/moonlight-butterfly.js`); Weg: dauerhafter Kontrollwechsel (`actionStealCreature` ohne Rückgabe).
- **Voraussetzungen / Aufbau:** Sitz 0: Falter in Held 1 / Slot 0 (alt); Sitz 1 stiehlt ihn; Zugende von Sitz 0 (= Zug des Gegners des Kontrolleurs), Sitz 1 sagt Ja.
- **Erwartet** (Text „At the end of your opponent's turn, you may add this Creature you control back to your hand, and if you do, deal 150 damage to the opponent's Hero in the same position as the corresponding Hero."): „your hand" ist die Hand des Kontrolleurs; „the opponent's Hero in the same position" ist aus Sicht des Kontrolleurs (Sitz 1) ein Held von Sitz 0 – der Wirtsheld selbst steht aber schon auf Sitz 0, es gibt also keinen eindeutigen „gegenüberliegenden" Helden.
- **Beobachtet:** Rückfrage an Sitz 1 (Kontrolleur) ✓; der Falter landet auf der Hand des BESITZERS (Sitz 0, +1 Karte für das Opfer des Diebstahls), und die 150 Schaden treffen Sitz 0 Held 1, also genau den Helden, in dessen Zone der Falter stand (650 HP).
- **Repro:** `docs/niche-tests/repro/C03-creatures/20-moonlight-butterfly-gestohlen-besitzer-haelt-karte-und-schaden.js` (✗ = Lesart A wird verletzt)
- **Vermutete Ursache:** `moonlight-butterfly.js` `onTurnEnd`: `oi = opponentOf(ctx.cardOwner)` + `heroIdx = inst.heroIdx` (Spalte des Wirtes, der auf der Seite des Besitzers steht); `returnSupportCreatureToHand` (`_deepsea-shared.js`) legt in die Besitzerhand.
- **Frage an Al:** Bei einem gestohlenen Falter: Karte auf die Hand des Diebes (A) oder des Besitzers (B = jetzt)? Und welcher Held ist „gegenüber" – der Held des Besitzers in derselben Spalte (jetzt) oder der gegenüberliegende des Diebes?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Giant Exploding Skull | L2 gezielt | Selbstsprengung (Ja/Nein, HOPT) ✓, Wischer beide Seiten inkl. eigener ✓, zwei Skulls je Seite (Kette endet, Ablage korrekt) ✓, gestohlen ⇒ Ablage des Besitzers ✓, Hell Fox im Wischer (2 Füchse gelöscht, Suche je Fuchs) ✓, Nest-Räumung löst nicht aus ✓, Skull gefroren/betäubt/negiert stirbt an Kreatur-Schaden ⇒ kein Wischer ✓, Aktivierung gefroren/betäubt/negiert abgewiesen ✓, Tod durch Kreatur-Effekt (Haressassin) ⇒ Wischer ✓ |
| Golden Exploding Skull | L2 gezielt | unversehrte Kreaturen zählen nicht ✗(→ C03-05); gestohlen ⇒ Gold an Kontrolleur, eigene Ziele des Kontrolleurs ✓; Held auf 30 HP/Kreatur stirbt ✓; stillgelegt ⇒ kein Effekt ✓; Nest-Räumung ✓ |
| Golden Ladybug | L2 gezielt | Resource-Phase: Gold/Karte-Wahl, zwei Ladybugs (zwei Fragen), gestohlen (Bonus nur im Zug des Kontrolleurs), goldLocked/drawLocked/beide/leeres Deck (Leerlauf-Regel greift) ✓, Wirtsheld gefroren ✓, Kreatur gefroren/betäubt/negiert ✓; Hand-Reaktion auf Surprise (Bluff) inkl. Zonenwahl und Wirtsheld gefroren ✓ |
| Golden Vermin | L2 gezielt | Zieh-/Handsperre ✗(→ C03-08), Rundeneinkommen ✗(→ C03-09), 5er-Grenze (6. Gewinn ohne Frage) ✓, zwei Vermins ⇒ nur eine Frage ✓, gestohlen ⇒ Frage an Kontrolleur ✓, stillgelegt ✓, Ja-Weg (Gold ±0, Karte +1) ✓; Nein-Weg nicht gemessen |
| Grave Worm | L2 gezielt | zweiter Wurm verliert Instanz ✗(→ C03-06), Namenserkennung/Besitzer ✗(→ C03-07); Einsatz zieht 1 Karte ✓; Nest-Räumung löst nicht aus ✓ |
| Gravedigger | L2 gezielt | gestohlen ⇒ falsches Deck ✗(→ C03-01); Einsatz: Ablage 7/8/9, Deck 2/leer, Wahl Mill/Löschen, Bilanz ✓ (7 Karten ⇒ erzwungener Mill); Aktivierung gegen leeres Deck wirkt nicht und verbraucht nichts (Beobachtung); stillgelegt ✓ |
| Haressassin | L2 gezielt | 150 auf Held/Kreatur (200-HP-Kreatur unversehrt ⇒ 50 ✓), Selbstziel, HOPT ✓, gestohlen ⇒ Ablage des Besitzers ✓, `untargetable`/`invisible`-Helden nicht wählbar ✓, Frost/Betäubung/Negation ✓ |
| Hell Fox | L2 gezielt | Such-Sperre (Prompt unterdrückt, kein Mischen) ✓, Handsperre ✓, negiert/gefroren/betäubt ⇒ Ablage statt Löschen, keine Suche ✓, gestohlen (Dieb sucht im eigenen Deck, Löschstapel des Besitzers) ✓, zwei Füchse gleichzeitig + alter Fuchs in der Ablage ✓, Nest-Räumung ✓ |
| Horned Demon | L2 gezielt | Aktivierung ohne Zähler gesperrt ✓, 50 × n ✓, Zähler nur zum eigenen Zugende ✓, dauerhaft gestohlen ✓, negiert ⇒ kein Zähler ✓; geliehen ✗(→ C03-17), gefroren/betäubt ✗(→ C03-18) |
| Ifrit | L2 gezielt | Armageddon gesund ✓; stillgelegt ✗(→ C03-12); in Nest-Galerie ✗(→ C03-11) |
| Inconspicuous Lawn Gnome | L2 gezielt | gestohlen ✗(→ C03-02), Hand/Brett ✗(→ C03-13); zweite Brettaktivierung abgewiesen ✓, Lv-3-Gnom mit SM 1 nicht spielbar ✓, stillgelegt ✓ |
| Informant | L2 gezielt | Gegnerdeck 1/3/5/8 Karten, Reorder-Antwort (2 oben umgekehrt, Rest unten), Kartenbilanz/Audit ✓, Deck 0 nicht aktivierbar ✓, Zug-1-Schutz im Skript, stillgelegt ✓; gestohlen nur gelesen (nutzt `ctx.cardOwner`) |
| Land Sharks | L2 gezielt | gestohlen ✗(→ C03-03), Angler Angel ✗(→ C03-16), Nest ✗(→ C03-19); Zielzahl 1/2/3 nach Summoning Magic, Frost/Betäubung/Negation ✓ |
| Lovely Teddy | L2 gezielt | Koordinatenkollision ✗(→ C03-14); Rückgabe zum Zugende, geliehene Kreatur stirbt ⇒ Ablage des Besitzers, geliehene Haressassin/Skull/Demon aktivierbar ✓; Passiv-Hooks des Geliehenen ✗(→ C03-17) |
| Luna Kiai | L2 gezielt | Burn-Tick mit 0/1/2 Luna (+60/+120 Max-HP inkl. Heilen) ✓, Held stirbt am Tick bleibt tot ✓, Hand-Reveal (zweites Reveal im Zug abgewiesen) ✓, alle Helden verbrannt ⇒ Beschwörung als Zusatzaktion ✓, Nest-Einsatz ✓, stillgelegt ⇒ kein Bonus ✓ |
| Mausoleum Worm | L2 gezielt | „1 pro Zug" nur für Ablage-Weg ✗/C(→ C03-15); zwei Würmer/zwei Helden ⇒ eine Platzierung ✓, alle Zonen belegt ⇒ kein Angebot ✓, Selbstschaden ⇒ kein Angebot ✓ |
| Mimic | L2 gezielt | zwei Mimics gegen 15 Gold (Klau begrenzt auf Vorhandenes), Gegner 0/negativ ⇒ kein Klau, dauerhaft gestohlen ⇒ Dieb profitiert, eigene Mimics klauen nicht im Gegnerzug ✓, gefroren/betäubt (Status aus Gegnerzug) und negiert ⇒ kein Klau ✓ |
| Monster Nest | L2 gezielt | gestohlen ✗(→ C03-04), Ifrit ✗(→ C03-11), Land Sharks ✗(→ C03-19); Nest legt Monster Nest, Mountain Boars, Golden Vermin, Mimic, Luna Kiai, Horned Demon, Hell Fox, beide Skulls, Grave Worm: Zugende-Räumung ohne Todes-Auslösung, Bilanz ✓ |
| Moonlight Butterfly | L2 gezielt | normal (Hand +1, Held gegenüber −150) ✓, Held gegenüber tot ⇒ Hinweis, kein Schaden ✓, stillgelegt (Frost/Betäubung/Negation) ⇒ keine Frage ✓; gestohlen ✗(→ C03-20) |
| Mountain Boars | L2 gezielt | Hand: freie Aktion + Area (Wahl special/normal), erzwungen ohne Aktionsplatz, Area dieses Zuges nicht löschbar (Karte bleibt auf Hand) ✓; Ablage-Weg (direkt über `onDiscardEffect`): Area gelöscht, Zusatzaktion bleibt frei, Zone gewählt ✓; als Nest-Einsatz keine Area-Löschung ✓ |
| Mr. Jiggles | L2 gezielt | gestohlen bietet sich selbst an ✗/C(→ C03-10), Angler Angel ✗(→ C03-16); Held+Kreatur / zwei Kreaturen (je 100) ✓, `untargetable`/`invisible`-Helden nicht wählbar ✓, Frost/Betäubung/Negation ✓ |

## Getestet & in Ordnung (Auswahl)
* **Stilllegung (Dauer- und Hook-Effekte)**: Giant/Golden Skull, Hell Fox, Golden Vermin, Golden Ladybug, Luna Kiai, Mimic, Moonlight Butterfly und alle aktiven Effekte (Haressassin, Jiggles, Informant, Gravedigger, Gnom, Giant Skull) ruhen bei Frost, Betäubung und Negation – dynamisch bestätigt. (Ausnahmen: Ifrit C03-12; Horned Demon C03-18.) Hell Fox (`deletesSelfOnDeath`) ruht ebenfalls: gefrorener Fuchs geht in die Ablage, keine Suche.
* **Sperren**: Hell Fox unter Such-Sperre (Prompt unterdrückt, `_skipNextShuffle`) und Handsperre; Golden Ladybug unter Gold-/Zieh-Sperre/leerem Deck (kein Auftritt, wenn nichts wirken kann).
* **Zielschutz**: `untargetable`/`invisible`-Helden erscheinen bei Haressassin, Jiggles, Land Sharks, Horned Demon nicht in der Zielliste (solange ein anderer Held wählbar ist).
* **Tod und Ablage**: gestohlene Kreaturen (Haressassin, Giant Skull, Hell Fox) landen in Ablage/Löschstapel des Besitzers; Ketten-Wischer zweier Giant Skulls endet nach einem Durchlauf ohne Kopien.
* **Zähl-/Staffelwerte**: Horned Demon 50 × Zähler über mehrere echte Zugwechsel; Informant bei 1/3/5/8 Gegnerkarten; Land Sharks 1/2/3 Ziele nach Summoning Magic; Gravedigger-Einsatz bei Ablage 7/8/9.
* **Nest-Zugende**: neun verschiedene Nest-Ziele verschwinden ohne Todes-Auslösung (Hell Fox, Skulls, Grave Worm), Bilanz und Audit sauber.
* **Harness-Hinweis für Nachfolger**: `t.policy.confirm = null` wird als „Ja" (Standard) behandelt – ein echtes „Nein" braucht ein `t.script`-Eintrag mit `answer: () => null`; `actionNegateCreature(inst, source)` erwartet für `source` einen **String** (ein Objekt wirft `toLowerCase`-Fehler).
