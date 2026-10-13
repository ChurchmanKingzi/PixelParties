# A03-futuretech – Nischenfall-Bericht
Stand/Autor: Agent A03-futuretech, 12.10.2026. Karten: 52 in der Liste · (wird am Ende gezählt) gezielt getestet · (wird am Ende gezählt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – der Bericht wächst fortlaufend, die Befunde stehen schon)

## Befunde

### A03-futuretech-01 · Copy Device als Laser Cannon / Gun: Attack-Bonus bleibt nach Zugende dauerhaft · Stufe A
- **Karten:** Future Tech Copy Device (`cards/effects/future-tech-copy-device.js`), Future Tech Laser Cannon (`future-tech-laser-cannon.js`), Future Tech Gun (`future-tech-gun.js`)
- **Voraussetzungen / Aufbau:** Standardhelden, Seed 1234, Sitz 0 am Zug; Hand `Future Tech Copy Device`; Ablage Sitz 0: 3× Laser Cannon (zweiter Lauf: 3× Gun); 100 Gold.
- **Schritte:** 1. Copy Device spielen, in der Galerie Laser Cannon (bzw. Gun) wählen, Zone wählen (wird ausgerüstet, Held 0: ATK 40 → 140 bzw. 120). 2. `t.endTurn()` (Zugende des Besitzers).
- **Erwartet** (Quelle: Kartentext „… become that Artifact's original name, Cost and effect **for the rest of the turn**“ + Skript-Kommentar „Als Ausrüstung fällt sie sofort ab und geht sichtbar in die Ablage“): Nach dem Zugende liegt Copy Device in der Ablage, der Held hat wieder seinen Basis-ATK (40).
- **Beobachtet:** Copy Device liegt korrekt in der Ablage, der Held behält den Bonus **dauerhaft**: ATK 140 (Laser Cannon, +100) bzw. 120 (Gun, +80), auch im darauffolgenden eigenen Zug. Zerstört man die kopierte Ausrüstung dagegen mitten im Zug (`actionDestroyCard`), wird der Bonus korrekt zurückgenommen; die reguläre Laser Cannon ebenso. Bei jeder Wiederholung (Copy Device wieder auf Laser Cannon) würde der Bonus erneut aufgestockt.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/01-copy-device-atk-leak.js` (`node docs/niche-tests/repro/A03-futuretech/01-copy-device-atk-leak.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/future-tech-copy-device.js:553-562` (`onIdentityExpire`) löscht `_effectOverride` **vor** `actionDestroyCard`; beim Abgang liest `getHook` dann die (leeren) Hooks der Copy Device statt des `onCardLeaveZone` der kopierten Karte, das `revokeAtk()` bzw. den `atkGranted`-Abzug machen würde. Betroffen sind alle kopierbaren Ausrüstungen mit „Abzug beim Verlassen“ (Laser Cannon, Gun; weitere siehe Folgebefunde).

### A03-futuretech-02 · Escape Device: Effekt-Immunität überdauert die Auflösung und schluckt fremden Schaden im selben Zug · Stufe A
- **Karten:** Future Tech Escape Device (`cards/effects/future-tech-escape-device.js`), Future Tech Weathercock (`future-tech-weathercock.js`, gleicher Mechanismus, im Repro mitgeprüft), Engine `_engine.js` (`grantEffectImmunity`/`hasEffectImmunity`); Gegenstück zur Vorrunden-„lead“ (Dauerfeuer: auf Seite 1 kein Spielende nach Tod aller Helden)
- **Voraussetzungen / Aufbau:** Standardhelden, Seed 1234, Sitz 0 am Zug. Sitz 1: Hand `Future Tech Escape Device`, Ablage 2× Escape Device. Sitz 0: `Bomb Mite` auf Held 1, Slot 0 (`turnPlayed` = Zug−2, zündet am Ende des eigenen Zugs).
- **Schritte:** 1. Sitz 0 spielt Fireball (Lv 2) auf gegnerischen Held 0; Escape Device wird gespielt und negiert den Fireball für Held 0. 2. Sitz 0 beendet den Zug (`t.endTurn()`); die Bomb Mite zündet.
- **Erwartet** (Quelle: Kartentext „Negate all effects (including damage) **the Attack or Spell** has on that Hero“): Nur Effekte des negierten Fireballs fallen aus. Die Bomb Mite („deal 100 damage to all Heroes your opponent controls“) trifft alle drei gegnerischen Helden → Held 0 = 700.
- **Beobachtet:** Held 1 und 2 verlieren 100, Held 0 bleibt bei 800 – die Bomb Mite geht an dem „entkommenen“ Helden vorbei. Allgemein: bis zum nächsten Zielfenster oder Zugbeginn ist der Held gegen **jede** Quelle immun (Schaden, Statuswerte, Insta-Kill). Das erklärt die Vorrunden-„lead“: im Dauerfeuer wurde nach dem negierten Fireball (Escape in Hand/Ablage/Deck-Oben) das Töten aller Helden per Direktschaden verschluckt → kein Spielende. Dasselbe mit Weathercock (Fireball auf Held 0+1, Weathercock an Held 0): Held 0 bleibt danach auch gegen die Bomb Mite (800 statt 700) immun. Gegenprobe: ohne Escape-Auslösung (Karte nur in der Hand/Ablage) endet das Spiel normal (`all_heroes_dead`); Statusticks (burned/poisoned) nach dem Zugwechsel wirken normal (Liste ist dann geleert); ein zweites **zielendes** Spiel/Kreatureneffekt (Mech) auf denselben Helden wirkt normal (neues Zielfenster leert die Liste).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/02-escape-immunity-leak.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_engine.js:8023-8044` (`hasEffectImmunity` prüft nur Besitzer + Heldenindex, bewusst ohne Quelle – Kommentar „Befund 21.8.: Quick Attack geht durch Escape Device durch“) und Leerung der Liste nur in `_checkPostTargetHandReactions` (~35789) bzw. `startTurn` (~22615), **nicht** am Ende der Auflösung des negierten Spells/Angriffs. Der Kommentar nimmt an „Lebensdauer der Liste = laufende Auflösung“, das stimmt nur, solange danach ein neues Zielfenster aufgeht. Gleicher Mechanismus betrifft vermutlich Castling und Rook of Kings [B] (andere Gruppen).

### A03-futuretech-03 · Magic Modifier: Stufensenkung gilt für alle gleichnamigen Zauber, nicht nur den aufgedeckten · Stufe B
- **Karten:** Future Tech Magic Modifier (`cards/effects/future-tech-magic-modifier.js`)
- **Voraussetzungen / Aufbau:** Sitz 0, Held 0 mit Destruction Magic Lv 1; Hand: Magic Modifier, Fireball, Fireball (Fireball = Lv 2); Ablage: 1× Magic Modifier. Seed 1234.
- **Schritte:** 1. Kontrolle: Fireball ohne Aufdecken spielen → abgelehnt. 2. Magic Modifier spielen, die **erste** Fireball aufdecken. 3. Die **zweite**, nicht aufgedeckte Fireball spielen.
- **Erwartet** (Quelle: „Reveal **a** Spell … **That Spell's** level is reduced … while it stays revealed“): nur die aufgedeckte Kopie ist Lv 1; die zweite bleibt Lv 2 und ist mit Destruction Lv 1 nicht spielbar.
- **Beobachtet:** Die zweite (nie aufgedeckte) Fireball wird gewirkt (150 Schaden). Die Senkung hängt am Kartennamen: jede gleichnamige Karte in dem Zug, auch später gezogene, ist betroffen.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/03-magic-modifier-by-name.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-magic-modifier.js:103-105` schreibt `{ cardName, amount }` in `ps._magicLevelReductions`; `_engine.js:43967-43970` vergleicht nur den Namen (gleiche Bauform wie Divine Gift of Magic). Die Engine kennt `_revealedHandIndices` (Zugstart räumt sie auf), dort ist die Aufdeckung je Handplatz modelliert.

### A03-futuretech-04 · Tri Fecta: gestohlene Tokens zählen nicht als „in its Support Zones“ – Held wird besiegt, obwohl Tokens in der Spalte stehen · Stufe B
- **Karten:** Tri Fecta, the Puppet Master (`cards/effects/tri-fecta-the-puppet-master.js`), `_puppets-shared.js`; analog Tri Ad, the Puppet Mistress; die Puppet-Tokens (Shishi, Brammi, Vinny …)
- **Voraussetzungen / Aufbau:** Sitz 1: Held 0 = Tri Fecta (400 HP) mit den drei Start-Tokens Shishi/Brammi/Vinny (über `placePuppetToken`). Sitz 0 am Zug. Seed 1234.
- **Schritte:** 1. Sitz 0 stiehlt Shishi und Brammi (`actionStealCreature` – Kontrolle wechselt, die Tokens bleiben in der Spalte stehen). 2. Das dritte, nicht gestohlene Token (Vinny) wird zerstört.
- **Erwartet** (Quelle: „When this Hero has no Tokens in its Support Zones, it is immediately defeated“): Zwei Tokens stehen noch in den Support Zones von Tri Fecta (nur unter fremder Kontrolle) → der Held lebt.
- **Beobachtet:** Tri Fecta wird sofort besiegt (HP 0), die beiden gestohlenen Tokens stehen weiter in der Spalte. Entsprechend könnte schon das Stehlen aller drei Tokens beim nächsten Prüfpunkt (Token-Abgang, Zugbeginn-Hook des Helden) den Helden töten. Die Rückgabe der Tokens am Zugbeginn ändert daran nichts mehr.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/04-puppet-stolen-token-defeat.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_puppets-shared.js:218-224` `puppetTokensInColumn` filtert auf `(c.controller ?? c.owner) === pi`, `checkPuppetHeroDefeat` (Z. 232-243) nutzt das. Die Frage „steht ein Token in der Support Zone“ ist physisch (Zone), nicht Kontrolle. (Styx-Konvention „Kontrolle statt Seite“ gilt für Effekte wie „your discard pile“, nicht für Zonenbelegung.)

### A03-futuretech-05 · Steam Dwarf Engineer: Ifrit wird angeboten, die Beschwörung scheitert, der Ifrit ist verschwunden · Stufe A
- **Karten:** Steam Dwarf Engineer (`cards/effects/steam-dwarf-engineer.js`), Ifrit (`ifrit.js`, `summonOnlyFromHand`); Gegenprobe Slave Trader (läuft sauber)
- **Voraussetzungen / Aufbau:** Sitz 0: Engineer (current/max HP 150, nicht im Legezug) auf Held 0, Slot 1; Deck: Ifrit (80 HP) + 2 Dummys. Main Phase 1. Seed 1234.
- **Schritte:** 1. Engineer-Effekt aktivieren (`t.activateCreature`). 2. In der Galerie Ifrit wählen.
- **Erwartet** (Quelle: Engineer „place any Creature from your deck whose max HP is ≤ …“; Ifrit „cannot be summoned from anywhere, except your hand“; Ruling im Engine-Kommentar: Damus' „place“ ist keine Beschwörung): Entweder wird Ifrit gar nicht angeboten, oder er wird platziert. Eine verschwundene Karte ist in keiner Lesart gewollt.
- **Beobachtet:** Die Galerie bietet Ifrit an; nach der Wahl lehnt `summonCreatureWithHooks` ab (Log `summon_blocked` / `hand_only`), der Engineer ist trotzdem geopfert (liegt in der Ablage), der Ifrit ist aus dem Deck entfernt und nirgends mehr (Kartenbilanz „Ifrit: −1“). Das Log nennt irreführend `steam_engineer_fizzle … no_free_slot`.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/05-engineer-hand-only-creature-lost.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `steam-dwarf-engineer.js:53/79` filtert mit `isSummonablePileCreature` (`_hooks.js:642`), das `summonOnlyFromHand` nicht kennt; die Karte wird per `deckEntnahme` (Z. 115) aus dem Deck genommen, bevor die Beschwörung (Z. 129) scheitern kann; der Fehlerzweig (Z. 143-149) gibt sie nicht zurück. Verwandt: jede Karte, die über denselben Pool-Bauer holt (andere Gruppen).

### A03-futuretech-06 · Steam Dwarf Diver: Kosten „current and max HP by 100“ senken nur das Maximum · Stufe B
- **Karten:** Steam Dwarf Diver (`cards/effects/steam-dwarf-diver.js`), `_steam-dwarf-shared.js` (`decreaseCreatureMaxHp`)
- **Voraussetzungen / Aufbau:** Sitz 0: Diver auf Held 0, Slot 1 mit max/aktuell HP 200/150 (Variante 200/80, 150/40); Deck: Future Tech Gun. Main Phase 1.
- **Schritte:** Diver-Effekt aktivieren, Gun wählen.
- **Erwartet** (Quelle: „reduce this Creature's **current and max** HP by 100“; gleicher Wortlaut bei Rha'Bi/Gobbo, dort mit Befund 20.9. ausdrücklich „aktuelle HP − Betrag“, siehe `rha-bi-the-living-skeleton.js:240-249`, `gobbo-chief-of-goblin.js:108-120`): 200/150 → 100/50.
- **Beobachtet:** 100/100 (die aktuellen HP wurden nur auf das neue Maximum gestutzt, also nur 50 statt 100 bezahlt). Ein beschädigter Diver kann den Preis so teilweise umgehen: 200/80 → 100/80 (Text: 80−100 < 0 → besiegt; Variante nur beobachtet, nicht als Befund gezählt, weil das Skript nur `maxHp > 100` fordert und die Frage „darf der Diver an den Kosten sterben“ offen ist).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/06-diver-current-hp-cost.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `steam-dwarf-diver.js:88` ruft `decreaseCreatureMaxHp` (`_steam-dwarf-shared.js`, Klemme `if (curHp > newMax) currentHp = newMax`), nicht „aktuelle HP vorher − 100“.

### A03-futuretech-07 · Steam Dwarf Dragon Pilot: ein Abwurf von 3 Karten löst dreimal aus · Stufe B
- **Karten:** Steam Dwarf Dragon Pilot (`cards/effects/steam-dwarf-dragon-pilot.js`); Vergleich Steam-Engine-Passive der anderen Steam Dwarfs (`_steam-dwarf-shared.js`, durch HOPT geschützt)
- **Voraussetzungen / Aufbau:** Sitz 0: Dragon Pilot auf Held 0, Slot 1 (nicht im Legezug); Hand 4× Fireball; Gegner 800 HP je Held. Seed 1234.
- **Schritte:** Ein einzelner Abwurfvorgang über 3 Handkarten (`actionPromptForceDiscard(0, 3)`; mit `actionDiscardCardsAnimated(0, 3)` identisch).
- **Erwartet** (Quelle: „Up to 3 times per turn, when you discard **1 or more cards** from your hand, choose a target and deal 100 damage“; Konvention CARD_API.md ~7486 „Effekte mit ‚… 1 or more cards‘ antworten je VORGANG genau einmal“): eine Rückfrage, 100 Schaden, zwei Auslöser bleiben für den Zug.
- **Beobachtet:** Drei Rückfragen, 300 Schaden (Held 0: 800 → 500), alle drei Zugladungen mit einem Vorgang verbraucht. Kontrolle: Abwurf von 1 Karte → 1 Rückfrage, 100 Schaden.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/07-dragon-pilot-per-card.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `steam-dwarf-dragon-pilot.js:311` (`hooks.onDiscard`) hängt am Hook `ON_DISCARD`, den die Engine **je Karte** feuert (`_engine.js` ~11447 `actionDiscardCardsAnimated`, ~16467 `actionPromptForceDiscard`); eine Vorgangs-Kennung wie bei `onDraw` (`_drawBatch`) fehlt für Abwürfe.

### A03-futuretech-08 · Future Tech Gear: mahlt schon beim Pflicht-Ziehen der Ressourcen-Phase und verbraucht damit die Rundensperre · Stufe B
- **Karten:** Future Tech Gear (`cards/effects/future-tech-gear.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Gear an Held 0 ausgerüstet, 2× Gear in der Ablage; Sitz 1: Deck 20 Karten. Seed 1234.
- **Schritte:** 1. Sitz 0 beendet den Zug (`t.endTurn()`), Sitz 1 beginnt und zieht seine Karte der Ressourcen-Phase. 2. Danach zieht Sitz 1 per Effekt eine Karte (`actionDrawCards`).
- **Erwartet** (Quelle: „The first time every turn when your opponent draws or adds a card from their deck to their hand **via an effect** …“; Konvention: das Pflicht-Ziehen trägt `_isResourceDraw` und zählt nicht als „via an effect“ – Cute Meanie Melissa Z. 34, Dirty Smuggler Z. 45): Das Pflicht-Ziehen mahlt nichts (Deck 19, Ablage 0); das erste Effekt-Ziehen danach mahlt 4.
- **Beobachtet:** Schon das Pflicht-Ziehen löst die Gear aus (Deck 15 = 1 gezogen + 4 gemahlen, Ablage 4). Die Rundensperre `ft-gear-fired` ist damit verbraucht – das echte Effekt-Ziehen danach mahlt 0 Karten.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/08-gear-resource-draw.js` (✗ = Fehler tritt auf; beide Prüfungen schlagen fehl)
- **Vermutete Ursache:** `future-tech-gear.js:109` `ausloesen()` (Hooks Z. 103-104) prüft `ctx._isResourceDraw` nicht (`_engine.js` ~10983 reicht das Flag im `ON_DRAW`-Kontext durch). Nebenwirkung: Gear trifft jeden Gegner-Zug sicher beim ersten Ziehen und macht die „first time“-Klausel zu einem Mühlefresser des Pflicht-Ziehens.

### A03-futuretech-09 · Gun: Attack-Bonus rechnet nach Prototypes-Umbenennung nicht nach – der nächste Angriff trifft mit dem alten Wert · Stufe B
- **Karten:** Future Tech Gun (`cards/effects/future-tech-gun.js`), Future Tech Prototypes (`future-tech-prototypes.js`), gemeinsame Zählung `_future-tech-shared.js`
- **Voraussetzungen / Aufbau:** Sitz 0: Gun an Held 0 (aus der Hand), Ablage: Prototypes + 1 Gun; Hand: Attack; Held ATK 40, Gegner 800 HP je Held. Seed 1234.
- **Schritte:** 1. Ausgangslage ATK 80. 2. Prototypes in der Ablage aktivieren (Main Phase 1), Name „Future Tech Gun“. 3. Attack spielen (Schaden = ATK des Helden).
- **Erwartet** (Quelle: Gun „Increase the equipped Hero's Attack stat by 40 times the number of Gun cards in your discard pile“; Prototypes „change its name to that of any other card until the end of this turn“): 2 Gun zählen → ATK 120, Attack = 120 Schaden.
- **Beobachtet:** `zaehleInAblage` meldet 2, `hero.atk` bleibt 80, der Attack richtet 80 an; erst nach der Aktion (Hook `onAnyActionResolved`) springt ATK auf 120. Der Bonus kommt also einen Zug zu spät – ein Kernkombo des Archetyps (Prototypes → Gun, Angriff) verpufft.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/09-prototypes-gun-atk-stale.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Gun rechnet nur an Hooks nach (`future-tech-gun.js` `hooks`: onPlay, afterSpellResolved, onAnyActionResolved, onDiscard, onMill, onCreatureDeath, onTurnStart). Weder `onDiscardEffect` der Prototypes (Alias setzen) noch Copy Devices Alias lösen davon einen aus. Der Alias-Ablauf am Zugende ist unkritisch (nächster `onTurnStart` rechnet nach).

### A03-futuretech-10 · Escape Device greift nicht, wenn ein Spell ein Puppet-Token wählt, obwohl der Held den Schaden trägt · Stufe C
- **Karten:** Future Tech Escape Device (`future-tech-escape-device.js`), Tri Fecta, the Puppet Master (+ Tri Ad), Puppet-Tokens (`_puppets-shared.js`, `sharesHpWithHero`)
- **Voraussetzungen / Aufbau:** Sitz 1: Tri Fecta (400 HP) mit Start-Tokens; Hand 1× Escape Device, Ablage 2× Escape Device. Sitz 0: Fireball (Lv 2). Seed 1234.
- **Schritte:** Fireball wählt (a) Tri Fecta selbst, (b) das Token „Destructive Puppet Shishi“.
- **Erwartet** (Quelle: „… when a Hero you control would be affected by an Attack or Spell …“ + „This Hero and Tokens … share 1 HP pool“): unklar, ob ein auf das Token gerichteter Spell den Helden „affectet“.
- **Beobachtet:** (a) Escape Device wird angeboten, Held bleibt bei 400. (b) kein Angebot; der Schaden am Token wird auf den Helden gebucht (400 → 250, laut CARD_API.md v704 „OHNE Zielwahl-Surprise-Fenster“), Escape Device bleibt ungenutzt in der Hand. Da in Tri Fectas/Tri Ads Support Zones nichts platziert werden darf, ist Escape Device die einzige Held-Schutzkarte des Archetyps für diese Helden – wer das Token wählt, umgeht sie.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/10-escape-puppet-token-target.js` (✗ = Variante (b) schützt den Helden nicht)
- **Vermutete Ursache:** `_engine.js` `_reroutePooledCreatureDamage` / `processCreatureDamageBatch` bucht Token-Schaden am Zielfenster vorbei auf den Helden; das Post-Target-Fenster (`_checkPostTargetHandReactions`) sieht nur Heldenziele (`targetedHeroes`, `t.type === 'hero'`).
- **Frage an Al:** Soll Escape Device (und andere Hand-Reaktionen auf „Held wird gewählt“) auch auslösen, wenn der Spell/Attack ein Token von Tri Fecta/Tri Ad wählt – ja oder nein?

### A03-futuretech-11 · Iterative Testing: „up to 2“ sendet immer die Höchstzahl, keine Wahl · Stufe C
- **Karten:** Iterative Testing (`cards/effects/iterative-testing.js`); Vergleich Mysterious Core („up to 3“, abbrechbar)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand Iterative Testing + Future Tech Gun; Deck 3× Gun + Füller; Magic Arts 1. Seed 1234.
- **Schritte:** Iterative Testing spielen, in der Galerie „Future Tech Gun“ wählen.
- **Erwartet** (Quelle: „send **up to 2** cards with the same name“): Der Spieler darf (mindestens implizit) 1 oder 2 Kopien wählen.
- **Beobachtet:** Es gibt nur die Namenswahl; danach werden automatisch `min(2, Kopien im Deck)` Karten gesendet (2 von 3 Gun). Eine Abfrage 0/1/2 gibt es nicht. Auswirkung: bei Karten, von denen man eine Kopie im Deck halten will (Doomsday Bomb – einmal pro Spiel; knappes Deck), ist die Höchstzahl erzwungen.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/11-iterative-testing-up-to.js` (✗ = keine Mengenwahl)
- **Vermutete Ursache:** `iterative-testing.js:103` `Math.min(MAX_SENDS, …)` ohne Abfrage.
- **Frage an Al:** Soll Iterative Testing den Spieler wählen lassen, ob 1 oder 2 Kopien gesendet werden – oder immer die Höchstzahl (ja = Wahl / nein = immer max)?

### A03-futuretech-12 · Gunslinger Riffel übersieht eine Copy Device, die gerade eine Gun ist („no copies equipped“) · Stufe B
- **Karten:** Future Tech Gunslinger Riffel (`cards/effects/future-tech-gunslinger-riffel.js`), Future Tech Copy Device, Future Tech Gun
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 = Riffel; Hand: Copy Device; Ablage: 2× Gun; Deck: 1× Gun + Füller; 100 Gold. Seed 1234.
- **Schritte:** 1. Copy Device spielen, Gun kopieren und an Riffel ausrüsten (Zone zeigt „Future Tech Copy Device“, wirksame Identität Gun). 2. Riffels Heldeneffekt aktivieren.
- **Erwartet** (Quelle: „… an equippable Artifact in your discard pile that this Hero has **no copies of equipped** to it yet“; Copy Device: „name … become that Artifact's original name“): Gun wird nicht angeboten – der Held trägt schon eine „Gun“. Kontrolle mit echter Gun: korrekt nicht angeboten.
- **Beobachtet:** Gun wird angeboten und ein zweites Mal ausgerüstet (Zonen: Copy Device-als-Gun + Gun).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/12-riffel-copy-device-as-copy.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-gunslinger-riffel.js:59-64` `schonAngelegt()` vergleicht Zonennamen (`slot.includes(name)`); eine Karte mit geliehener Identität liegt unter ihrem eigenen Namen in der Zone (Regel „A card must not look for ITSELF by name“, CARD_API.md ~5590). Der Aufstiegs-Check in `_riffel-shared.js` (`hasEquipped`, nach `_effectOverride`) macht es richtig.

### A03-futuretech-13 · Doomsday Bomb: „negate that Attack“ setzt nur den Schaden auf 0 – Zusatzeffekte (Stun, Blind, Gift, Abwurf) wirken weiter · Stufe B
- **Karten:** Future Tech Doomsday Bomb (`cards/effects/future-tech-doomsday-bomb.js`), getestet mit Heavy Hit, Trunk Sand, Blow of the Venom Snake, Strong Ox Headbutt, Ferocious Tiger Kick
- **Voraussetzungen / Aufbau:** Sitz 0: Doomsday Bomb an Held 0 ausgerüstet (aus der Hand), 1× Doomsday Bomb in der Ablage, Held-ATK 100; Sitz 1 mit 800 HP je Held. Seed 1234.
- **Schritte:** Sitz 0 spielt je einen der genannten Angriffe auf gegnerischen Held 0.
- **Erwartet** (Quelle: „… would hit 1 or more targets your opponent controls with an Attack, **negate that Attack**. If you do, all targets … take damage …“; Kopfkommentar des Skripts: die Attacke „löst sich auf, richtet aber nichts aus“): Der negierte Angriff hat keinerlei Wirkung – nur die Doomsday-Explosion (50 pro Karte) trifft.
- **Beobachtet:** Der Hauptschaden ist 0 und die Explosion trifft (Held 0: 750), aber die Nebeneffekte des Angriffs laufen: Heavy Hit / Ferocious Tiger Kick → gestunnt, Trunk Sand → geblendet, Blow of the Venom Snake → vergiftet, Strong Ox Headbutt → Gegner wirft eine Karte ab.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/13-doomsday-bomb-negation-riders.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-doomsday-bomb.js:143` `ctx.setAmount(0)` im `onAttackDeclare`-Fenster, das nur den Schaden kennt (CARD_API.md ~7920: „Doomsday Bomb macht genau das über setAmount(0)“). Nebenbei: bei `ctx.amount === 0` (Held mit ATK 0) zündet die Bombe nie (`if (!(ctx.amount > 0)) return;`, Z. 131, im Repro als letzte Prüfung enthalten: Heavy Hit mit ATK 0 stunnt, die Bombe bleibt auf dem Brett), obwohl der Angriff Ziele „hits“.

### A03-futuretech-14 · Jetpack vs. Escape Device: „Stufe ≤ Anzahl“ bei 0 Kopien in der Ablage unterschiedlich ausgelegt · Stufe C
- **Karten:** Future Tech Jetpack (`future-tech-jetpack.js:61`), Future Tech Escape Device (`future-tech-escape-device.js`)
- **Voraussetzungen / Aufbau:** (a) Sitz 0 Organnon (Lv 0, Inventing 3, 2 Organnon in Ablage), Sitz 1 Escape Device in der Hand, 0 in der Ablage. (b) Sitz 1: Jetpack an Held 0, 0 Jetpack in der Ablage; Sitz 0 spielt die Stufe-0-Attacke „Attack“ (Held-ATK 100). Seed 1234.
- **Erwartet** (Quelle: Jetpack „levels are lower than or equal to the number …“; Escape Device „level is equal to or lower than the number …“; beide Kopfkommentare: „Mit leerer Ablage schützt sie gegen NICHTS (Stufe ≤ 0 trifft nur stufenlose …)“): gleiche Zählweise bei beiden Karten.
- **Beobachtet:** (a) Escape Device negiert den Lv-0-Zauber für einen Helden (0 ≤ 0). (b) Jetpack lässt die Stufe-0-Attacke durch (Held wählbar, 800 → 700), weil `return (src.level || 0) <= kopien && kopien > 0;` bei 0 Kopien nie schützt. Es gibt 14 Attacken der Stufe 0.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/14-jetpack-level-zero.js` (✗ = Jetpack schützt bei 0 Kopien nicht)
- **Vermutete Ursache:** zusätzliche Bedingung `kopien > 0` in Jetpack (Z. 61); Escape Device hat sie nicht.
- **Frage an Al:** Soll Jetpack bei 0 Kopien in der Ablage Stufe-0-Attacken abwehren (wie Escape Device Stufe-0-Zauber) – ja oder nein?

### A03-futuretech-15 · Copy Device als Control Device: Unterhalt am Zugende löscht eine echte Control Device, obwohl die Kopie gleichzeitig abfällt · Stufe C
- **Karten:** Future Tech Copy Device (`future-tech-copy-device.js`), Future Tech Control Device (`future-tech-control-device.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand Copy Device; Ablage 3× Control Device; Sitz 1 am Gegner. Seed 1234.
- **Schritte:** 1. Copy Device spielen, Control Device kopieren (liegt als Control Device an Sitz 1, Held 0). 2. `t.endTurn()`.
- **Erwartet:** unklar – mehrere Lesarten: (a) die Kopie zahlt den Unterhalt des Zugendes noch (`onTurnEnd` läuft vor dem Identitäts-Ablauf) und fällt danach ab, oder (b) die Identität „für den Rest des Zuges“ endet zuerst, es gibt keinen Unterhalt.
- **Beobachtet:** Variante (a): Der Unterhalt wird bezahlt – eine **echte** Control Device wandert aus der Ablage in den Löschstapel –, anschließend fällt die Kopie ab und geht in die Ablage. Das Ergebnis ist ein sicherer Kartenverlust für nichts (die Kopie hätte nicht überlebt, auch wenn der Unterhalt nicht bezahlt worden wäre).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/15-copy-control-device-upkeep.js` (✗ = echte Control Device gelöscht)
- **Vermutete Ursache:** Reihenfolge am Zugende: Hooks (`future-tech-control-device.js` `onTurnEnd`, Unterhalt) vor `_expireBorrowedIdentities` (`_engine.js` ~29948, `switchTurn` ~23548).
- **Frage an Al:** Soll eine als Control Device kopierte Copy Device am Zugende noch Unterhalt zahlen (Karte aus der Ablage löschen) – „zahlen“ oder „abfallen“?

### A03-futuretech-16 · Scrap Plow: „any card on the board that is not a Hero“ – Areas (und verdeckte Surprises) fehlen in der Zielliste · Stufe B
- **Karten:** Debt-O-Tron Model Scrap Plow (`cards/effects/debt-o-tron-model-scrap-plow.js`); Vergleich Destructive Puppet Shishi / The Yeeting (`_targeting-shared.js:61` `collectNonHeroBoardTargets`)
- **Voraussetzungen / Aufbau:** Sitz 0: Kent (Held 0), Scrap Plow auf Held 2 Slot 2, Gold 0, Hand: Fists (20); Sitz 1: Area „Rioting Village“, ein Dummy. (Im explorativen Lauf zusätzlich: verdeckte Surprise Cybug ANTS und Ability Fighting.) Seed 1234.
- **Schritte:** Fists mit Kent bezahlen (0 → −20, Überziehung 20 → Scrap Plow löst aus); die Zielliste des Scrap Plow ansehen.
- **Erwartet** (Quelle: „choose **any card on the board** that is not a Hero and send it to the discard pile“; derselbe Satz wird bei Shishi/Yeeting über den gemeinsamen Sammler gelesen): Die Area ist wählbar. (Verdeckte Surprises: Regelfrage – die gemeinsame Hilfsfunktion bietet sie an.)
- **Beobachtet:** Liste = `Scrap Plow`, `ZZ Dummy`; die Area „Rioting Village“ fehlt (Repro); im explorativen Lauf fehlte ebenso die verdeckte Surprise; Permanents und Coolness-Stack-Spitze fehlen laut Code ebenfalls (nicht getestet). Außerdem erscheint ein Ability-Stapel Lv2 doppelt mit identischer ID (`ability-1-1-0` ×2, harmlos – die Wahl funktioniert).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/16-scrap-plow-board-cards.js` (✗ = Area fehlt)
- **Vermutete Ursache:** `debt-o-tron-model-scrap-plow.js:60` baut die Liste selbst und lässt alles außer `support`/`ability` weg; statt `collectNonHeroBoardTargets` zu nutzen.

### A03-futuretech-17 · Future Tech Database: Abbruch der ersten Wahl verbraucht Karte und 10 Gold · Stufe B
- **Karten:** Future Tech Database (`cards/effects/future-tech-database.js`); Gegenprobe Mysterious Core, Blueprints (beide korrekt)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand Database, Ablage 2× Database, Deck mit Gun/Jetpack/Lamp; 100 Gold. Seed 1234.
- **Schritte:** Database spielen, die erste Galerie („Add a Future Tech card …“, 1/3) mit dem Abbruch-Knopf (`{cancelled:true}`) schließen.
- **Erwartet** (Quelle: CARD_API.md Z. 367-390 „Zielende Karten sind immer abbrechbar … Galerie … Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand“; Blueprints und Mysterious Core halten sich daran): Database wieder auf der Hand, Gold 100.
- **Beobachtet:** `t.play` meldet „behandelt“, die Database liegt in der Ablage (3 Stück), 10 Gold sind bezahlt, nichts wurde geholt. Ein Abbruch erst in der zweiten Galerie (nach einer gewählten Karte) ist dagegen unkritisch (die erste Karte bleibt).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/17-database-cancel-consumed.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-database.js` `resolve`: `if (!name) break;` und am Ende immer `return { ok: true }`; beim Abbruch ohne bisherige Wahl müsste `{ cancelled: true }` zurückgehen.

### A03-futuretech-18 · Future Tech Fists: „once per turn" gilt je Kopie statt je Kartenname · Stufe B
- **Karten:** Future Tech Fists (`cards/effects/future-tech-fists.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Fists auf Held 0 und auf Held 1 ausgerüstet, 2× Fists in der Ablage; Gegner 800 HP je Held. Seed 1234.
- **Schritte:** `t.activateEquip(0, 0, 0)` (Ziel: Gegner-Held 0), danach im selben Zug `t.activateEquip(0, 1, 0)` (gleiches Ziel).
- **Erwartet** (Quelle: „… once per turn … **You can only activate the effect of "Future Tech Fists" once per turn.**“ – der zweite Satz nennt den Kartennamen und wäre sonst überflüssig): zweite Aktivierung abgelehnt.
- **Beobachtet:** Beide Aktivierungen laufen; Gegner-Held 0 verliert 40 (Basis-ATK Held 0) + 80 (Held 1) = 120.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/18-fists-name-level-once.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Engine stempelt das Einmal-pro-Zug je Instanz (`_engine.js` ~42332 `hoptUsed['equip-effect:' + inst.id]`); das Skript hat keine Namenssperre (vgl. die Debt-O-Tron-Modelle, `_debt-o-tron-shared.js` `modelBase`, die ihre Namens-Sperren über `gs.hoptUsed` mit dem Kartennamen im Schlüssel führen).

### A03-futuretech-19 · Future Tech Bomb und Steam Dwarf Brewer: Kreaturen-Sammler nach Brettseite statt nach Kontrolle (gestohlene Kreaturen) · Stufe B
- **Karten:** Future Tech Bomb (`cards/effects/future-tech-bomb.js`), Steam Dwarf Brewer (`steam-dwarf-brewer.js`); Klasse wie M02-22 (Ricochet), S02-01 (Healing Melody); der Engine-Sammler `collectAoeCreatureTargets` (S01-09) ist davon getrennt (hier nicht erneut gemeldet)
- **Voraussetzungen / Aufbau:** Seed 1234. Kreatur A gehört Sitz 1, steht auf Seite 1, von Sitz 0 gestohlen (`actionStealCreature(0, A)`); Kreatur B gehört Sitz 0, steht auf Seite 0, von Sitz 1 gestohlen; Kreatur C normal beim Gegner. Bomb: 2 verschiedene Future-Tech-Karten in Ablage (40 Schaden). Brewer: Sitz 0, Held 0 Slot 0, 150/150 HP.
- **Schritte:** (Bomb) Future Tech Bomb aus dem Trank-Deck spielen. (Brewer) Brewer-Effekt aktivieren und die Zielliste ansehen.
- **Erwartet** (Quelle: Bomb „all targets **your opponent controls**“, Brewer „another Creature **you control**“; CARD_API.md „Kontrolle statt Seite", Kreaturen = `controller ?? owner`): Bomb trifft B und C, nicht A. Brewer bietet A an, B nicht.
- **Beobachtet:** Bomb trifft A (200 → 160, die Kreatur, die ich kontrolliere) und verfehlt B (200; die Kreatur, die der Gegner kontrolliert); C 160. Brewer bietet nur B an (die Kreatur des Gegners würde auf 150/150 gesetzt, ein Geschenk) und nicht A.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/19-bomb-brewer-side-not-control.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-bomb.js:65` `getHeroTargets(oi)` + `getCreatureTargets(oi)` und `steam-dwarf-brewer.js:30` `getCreatureTargets(pi)`; `_engine.js:40250` `getCreatureTargets` iteriert die physischen Support Zones der Seite. (Helden-Teil der Bomb nicht gemessen.)

### A03-futuretech-20 · Gunslinger Riffel rüstet die Future Tech Control Device an sich selbst aus – der Gegner übernimmt Riffel (Prüfauftrag H03-17, für Riffel bestätigt) · Stufe B
- **Karten:** Future Tech Gunslinger Riffel (`cards/effects/future-tech-gunslinger-riffel.js`), Future Tech Control Device (`future-tech-control-device.js`, `placesOnOpponentBoard`); gleiche Klasse wie H03-17 (Lolek, dort erneut gelaufen: ✗ unverändert)
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 = Riffel; Ablage 1× Control Device, Deck 1× Control Device + Füller; Sitz 1 hat 1× Control Device in der Ablage. Seed 1234.
- **Schritte:** 1. Riffels Heldeneffekt, Galerie → Control Device. 2. `t.endTurn()` (Sitz 1 am Zug). 3. Sitz 1 aktiviert die Ausrüstung (`doActivateEquipEffect(room, 1, {heroIdx: 0, zoneSlot: 0, charmedOwner: 0})`).
- **Erwartet** (Quelle: Riffel „equip it to **this Hero**“, Control Device „Equip this card to a Hero **your opponent** controls“ – nicht gleichzeitig erfüllbar; Spielweg legt sie ausschließlich auf die Gegenseite): die Control Device wird Riffel nicht angeboten; jedenfalls hängt sie nicht an Riffels eigenem Helden.
- **Beobachtet:** Sie wird angeboten und liegt an Riffel (Sitz 0, Held 0, Slot 0); Sitz 1 darf sie im eigenen Zug aktivieren und Riffel übernehmen (`charmedBy` 1, Heldseite 1) – der Gegner bekommt Riffels Held für den Zug.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/20-riffel-control-device-on-self.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-gunslinger-riffel.js` `kandidaten()` (Z. ~63-80) lässt jede Equipment-Karte mit Deck-Kopie zu und prüft das Cross-Side-Flag `placesOnOpponentBoard` nicht (`istAusruestTraeger` in `_equip-shared.js` kennt es offenbar ebenfalls nicht).

### A03-futuretech-21 · Future Tech Barrage: Abbruch der Zielwahl verbraucht die Rundensperre „1 pro Zug" · Stufe B
- **Karten:** Future Tech Barrage (`cards/effects/future-tech-barrage.js`); Gegenprobe Iterative Testing (beansprucht erst nach der Zusage)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand 2× Barrage, Ablage 2× Barrage, Held 0 mit Destruction 3 (`grantFor`); Gegner 800 HP. Seed 1234.
- **Schritte:** 1. Barrage spielen, Zielwahl abbrechen (`t.policy.cancelTargets`). 2. Im selben Zug die zweite Barrage spielen (Ziel Gegner-Held 0).
- **Erwartet** (Quelle: CARD_API.md Z. 367-390 „Abbruch heißt: nichts ist passiert"; Skriptkonvention von Iterative Testing Z. 90-100 „erst nach der Zusage beansprucht – ein Abbruch soll den Zug nicht verbrennen"): nach dem Abbruch ist die Karte auf der Hand und im selben Zug erneut spielbar (360 Schaden).
- **Beobachtet:** Der Abbruch gibt die Karte zurück, aber `gs.hoptUsed['future-tech-barrage:0']` steht auf dem Zug; das zweite Spielen wird abgelehnt (`play` = false, Held 800). Der Spieler kann sich so (z. B. nach einem versehentlichen Klick) den Barrage-Einsatz des ganzen Zuges nehmen.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/21-barrage-cancel-burns-hopt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `future-tech-barrage.js` `hooks.onPlay`: `engine.claimHOPT('future-tech-barrage', pi)` steht VOR `ctx.promptDamageTarget`; der Abbruchzweig (`gs._spellCancelled = true`) setzt die Sperre nicht zurück.

### A03-futuretech-22 · The Core's Awakening: die Staffel „1/2/3" folgt dem ersten tauglichen Helden, nicht dem gewählten Wirker · Stufe B
- **Karten:** The Core's Awakening (`cards/effects/the-core-s-awakening.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 und Held 1 mit unterschiedlicher Support Magic (a: 1 / 3, b: 3 / 1), Hand: Future Tech Gun + The Core's Awakening, Deck: 4× Gun. Seed 1234.
- **Schritte:** 1. Gun auf Held 2 ausrüsten. 2. Reaktion bestätigen; im Auswahlfenster „Cast The Core's Awakening with …“ Held 1 wählen (`optionPicker`, Option `hero-1`).
- **Erwartet** (Quelle: „Choose up to **1/2/3** copies …“; CARD_API-Hausnotation: Stufe der geforderten Schule des Wirkers): (a) Held 1 hat Support Magic 3 → 3 Kopien in die Ablage; (b) Held 1 hat Stufe 1 → 1 Kopie.
- **Beobachtet:** (a) nur 1 Kopie, (b) 3 Kopien – die Stufe von Held 0 zählt, egal wen der Spieler wählt (Kettenglied trägt `casterHeroIdx: 1`, wird ignoriert). Bei zwei Helden mit verschiedener Stufe hängt das Ergebnis damit von der Aufstellung ab, nicht von der Wahl des Spielers. Nebenbei: es gibt keine Mengenwahl („up to"): es werden immer `min(Stufe, Kopien im Deck)` gesendet (gleiche Lage wie -11, dort als Frage an Al).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/22-core-awakening-caster-level.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-core-s-awakening.js` `resolve`: `const heroIdx = wirkenderHeld(gs, pi, engine)` (erster Held, der Stufe/Status erfüllt) statt `chain[myIndex].casterHeroIdx`.

### A03-futuretech-23 · Debt-O-Tron Model Backup Duplicator: unter Such-/Handsperre wird die Suche angeboten, nichts geholt – die Rundenladung ist trotzdem weg · Stufe B
- **Karten:** Debt-O-Tron Model Backup Duplicator (`cards/effects/debt-o-tron-model-backup-duplicator.js`), Kent (Überziehung); verwandt B-04 (Spielbarkeit unter Such-Sperre), dort nicht diese Stelle
- **Voraussetzungen / Aufbau:** Sitz 0: Kent auf Held 0, Duplicator auf dem Brett (Held 2, Slot 1, nicht im Legezug), Hand: Gun, Gold 0; Deck: 2× Damage Fees + Füller. (a) `ps.searchLocked = true`, (b) `ps.handLocked = true`. Seed 1234.
- **Schritte:** Gun spielen (10 Gold bei 0 Gold → −10, Überziehung 10 → Duplicator-Auslöser); die Galerie „Add up to 1 Debt-O-Tron Artifact …“ bestätigen.
- **Erwartet** (Quelle: „you may **search your deck** … and **add them to your hand**“; Konvention: Such-/Hand-Sperren verhindern Suchen und Adds, der Auslöser hat dann keinen Anlass): keine Abfrage, die einmal-pro-Zug-Ladung bleibt.
- **Beobachtet:** Die Galerie (`cardGalleryMulti`) erscheint in beiden Fällen; die gewählte Karte landet nicht in der Hand; `remainingCharges` = 0/1 (Ladung verbraucht).
- **Repro:** `docs/niche-tests/repro/A03-futuretech/23-backup-duplicator-locks.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `debt-o-tron-model-backup-duplicator.js` `afterResourceSpend`: keine Prüfung von `ps.searchLocked`/`ps.handLocked`; `treffer.verbuche()` steht vor `takeFromPile`, dessen Fehlschlag (`return`) still bleibt.

### A03-futuretech-24 · Future Tech Drone / Debt-O-Tron Model Money Printer unter Zieh-Sperre: Karte weg bzw. Ladung verbraucht, gezogen wird nichts · Stufe C
- **Karten:** Future Tech Drone (`cards/effects/future-tech-drone.js`), Debt-O-Tron Model Money Printer (`debt-o-tron-model-money-printer.js`)
- **Voraussetzungen / Aufbau:** (a) Drone auf dem Brett, 1× Drone in der Ablage, Hand 2× Fireball, `ps.drawLocked = true`. (b) Kent, Money Printer auf dem Brett, Gold 0, `ps.drawLocked = true`. Seed 1234.
- **Schritte:** (a) Drone aktivieren, 1 Karte abwerfen. (b) Gun spielen (Überziehung 10 → Printer-Auslöser).
- **Erwartet** (Quelle: Drone „discard … **and draw the same number**“, Printer „you may draw 1 card …“; Konvention CARD_API.md ~Z. 19118: Karten mit Ziehen als Kern sperren sich bei `handLocked`/`drawLocked`, „sonst würde man … löschen, ohne zu ziehen“; Gegenläufig: Leadership lässt den Menschenpfad bewusst offen): unklar, ob die Aktivierung gesperrt sein soll.
- **Beobachtet:** (a) Aktivierung läuft, 1 Karte abgeworfen, nichts gezogen (Hand 2 → 1). (b) Printer fragt „Draw 1 card?", die Ladung geht auf 2/3, gezogen wird nichts.
- **Repro:** `docs/niche-tests/repro/A03-futuretech/24-drone-printer-draw-lock.js` (✗ = Ist-Zustand)
- **Vermutete Ursache:** Drone hat kein `canActivateCreatureEffect` mit Sperrprüfung; Printer prüft nur `mainDeck.length` (Golden Ladybug/Chuck prüfen `handLocked || drawLocked`).
- **Frage an Al:** Soll die Drone (und der Money Printer) unter Zieh-Sperre gar nicht erst aktivierbar bzw. auslösbar sein – „sperren" oder „darf ins Leere laufen"?

### A03-futuretech-25 · Kent: der Kreditrahmen bleibt beim Besitzer, wenn der Gegner Kent übernimmt · Stufe B
- **Karten:** Kent, the Indebted Apprentice (`cards/effects/kent-the-indebted-apprentice.js`), Engine `goldOverdraftLimit`
- **Voraussetzungen / Aufbau:** Sitz 0: Kent auf Held 0; beide 50 Gold. Seed 1234.
- **Schritte:** 1. `goldOverdraftLimit(0)` / `(1)` lesen (20 / 0). 2. `actionStealHero(1, 0, 0)` (Sitz 1 übernimmt Kent). 3. Beide Werte erneut lesen.
- **Erwartet** (Quelle: Kartentext „If **you** spend Gold …“; CARD_API.md ~Z. 18862 „Übernommene Helden gelten als Helden des Kontrolleurs … ‚you/your‘ = Kontrolleur (Hand, Deck, Ablage, Gold …)“): Sitz 1 hat den Kredit (20), Sitz 0 nicht mehr (0).
- **Beobachtet:** Unverändert 20 / 0: der Besitzer überzieht weiter mit dem Helden, den der Gegner gerade kontrolliert; der Kontrolleur bekommt nichts. (Das Gleiche gilt vermutlich für Kents Aktionssperre `blocksActions`, die ebenfalls an `players[pi].heroes` hängt – nicht einzeln gemessen.)
- **Repro:** `docs/niche-tests/repro/A03-futuretech/25-kent-overdraft-stolen-hero.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~24227 `goldOverdraftLimit(playerIdx)` iteriert die Helden der physischen Seite (`ps.heroes`) und fragt `heroSideOf` nicht (vgl. `heroesControlledBy`); `kentAlive` in `kent-the-indebted-apprentice.js` ebenso.

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
