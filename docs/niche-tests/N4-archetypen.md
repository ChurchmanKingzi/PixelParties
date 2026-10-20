# N4-archetypen – Nischenfall-Bericht
Stand/Autor: Agent N4-archetypen (Welle 23, W23d), 20.10.2026. Karten: 42 in der Liste · 42 gezielt getestet (L2) · 15 Karten mit Befund (18 Befunde).

## Zusammenfassung
* **18 Befunde:** Stufe A: 2 · Stufe B: 13 · Stufe C: 3. Alle mit ausgeführtem Repro unter `docs/niche-tests/repro/N4-archetypen/` (✗ = Fehler tritt auf, Gegenprobe jeweils grün).
* **Die 5 wichtigsten:** (1) **N4-08** Rebelliokai Backup Bakus räumt bei der Rückkehr aus der Ablage die Instanz einer *anderen* Bakus (Brett/Hand) ab – Zone behält den Namen, Instanz fehlt (A, kaputter Zustand). (2) **N4-14** Sandy Blob feuert für abgelehnte/abgebrochene Cloudy- und Shadowy-Slime-Effekte sowie für Deepsea Witch/Sparkfly Architect unter Such-Sperre – gegen Al-Ruling Welle 11 R4 (A). (3) **N4-01** Eine offen liegende Spider Silk Bridge löst nach jedem weiteren schadenlosen Gegnerzug erneut aus (Ziehen 2, zusammen 3 Karten pro Runde); die Engine nimmt offene Surprises im Treffer-Fenster ausdrücklich aus, im Zugende-Fenster nicht (B). (4) **N4-02** Alleria: Umleitung eines Effekts ohne Schaden (Burn/Freeze/Negate) lässt die Engine-Marke „nicht verringer-/negierbar" stehen; der nächste fremde Heldentreffer (hier gegen Carris: 150 statt 0) wird davon erfasst (B). (5) **N4-05/06/07** Fremdkontrolle (gestohlen/seitenfremd): Skeleton Healer heilt sich selbst („different target"), Reaper bietet sich selbst an, Hardy Slime spottet nicht (Ziel-ID aus Kontrolleur statt Brettseite) (B).
* Gesamteindruck: Die Slime-Familie (Rancher-Verdopplung 0/1/2 Rancher, Zählkarten Shiny/Splashy, Rocky, Icy/Fiery/Slimy/Sparky, Level-Wachstum, IRS-Verdopplung über echte Zugwechsel), die Bomblebee-/Carpet-Mechanik, die Deepsea-Bounce-Lage mit Infected Squirrel (Sperre, Folgezug), Courtly Kirin ↔ Backup Bakus, Minocrete (Verdopplung/Deckel), The Thing in the Ship und Cuteness Sensor sind sauber. Das Dauerfeuer (`lib/barrage.js`, alle 42 Karten × beide Sitze = 84 Läufe) blieb ohne Fehler/Hänger/Audit-Funde.
* Muster der Befunde: (a) **Brettseite ↔ Kontrolleur** bei seitenfremd/gestohlen (05, 06, 07, 18); (b) **globale Einmal-Marken, die nur der nächste Treffer löscht** (02); (c) **Hook-Hörer ist nicht die gemeinte Kopie** (08, vgl. Hook `activeIn` mit mehreren Zonen); (d) **R4-Stempel an jedem Ausstieg ohne Wirkung** fehlt bei Cloudy/Shadowy (14).
* Bewusst nicht getestet: 3-/4-Spieler-Partien, Skill-Test-Modus, Animationen/Reveal-Verträge, Deepsea-Swap-Wege (Shapeshift/Castle) über die A02-Tests hinaus, die Sparkfly-Queen-Modi (A05 hat sie), CPU-Entscheidungen.

## Befunde

### N4-01 · Spider Silk Bridge: die offen liegende Bridge löst bei jedem weiteren schadenlosen Gegnerzug erneut aus · Stufe B
- **Karten:** Spider Silk Bridge (`cards/effects/spider-silk-bridge.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Sitz 1 am Zug (Zug 5), Sitz 0 hat die Bridge verdeckt in Held 0 (Support Magic), beide Seiten haben je eine Kreatur; nie wird Schaden zugefügt.
- **Schritte:** 1. Sitz 1 beendet den Zug (`t.endTurn()`) → Bridge aktiviert, Sitz 0 zieht 2, Bridge bleibt offen. 2. Sitz 0 beendet seinen Zug, Sitz 1 beendet wieder einen schadenlosen Zug.
- **Erwartet** (Kartentext: „Activate this Surprise when your opponent ends their turn without dealing damage … Draw 2 cards. Additionally, this card remains face-up … until your opponent deals damage to a target you control. If this card is face-up … at the beginning of your turn, draw 1 card."; Konvention `_engine.js:37158`, 12.10.: „eine OFFEN liegende Surprise wurde schon ausgelöst – sie ist kein Kandidat dieses Fensters mehr"): Das Aktivieren (Ziehen 2) geschieht einmal. Danach liefert die offene Bridge nur noch das Ziehen von 1 zu Beginn des eigenen Zuges, bis der Gegner Schaden macht.
- **Beobachtet:** Das Zugende-Fenster (`_checkSurpriseOnTurnEnd` → `_scanSurpriseEntriesForPlayer`) bietet die offene Bridge erneut an: nach JEDEM schadenlosen Gegnerzug wieder „Draw 2" (Log `spider_silk_bridge_draw phase:activation` bei Zug 6, 8, 10 …), zusätzlich +1 zu Beginn des eigenen Zuges = 3 Karten pro Runde. Das Zug-1-Ziehen („beginning of your turn") wäre bei dieser Lesart überflüssig.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/01-silk-bridge-offen-loest-erneut-aus.js`
- **Vermutete Ursache:** `_engine.js:33378 _scanSurpriseEntriesForPlayer` / `:34035 _checkSurpriseOnTurnEnd` filtern offene Surprises nicht (`verdeckt()` gibt es nur im Treffer-Fenster, `_engine.js:37158`); `spider-silk-bridge.js:109 surpriseTurnEndTrigger` prüft `faceDown` nicht.

### N4-02 · Alleria: Umleitung ohne Schaden lässt die Marke „nicht verringer-/negierbar" stehen · Stufe B
- **Karten:** Alleria, the Queen of Spiders (`alleria-the-queen-of-spiders.js`); Carris, the Time Keeper (Messhelfer), Burning Skeleton (auslösender Effekt)
- **Voraussetzungen / Aufbau:** Sitz 0: Alleria (Held 0), Surprise in Held 1. Sitz 1: Burning Skeleton; Sitz 1 hat Carris („Any damage this Hero would take becomes 0") als Held 0.
- **Schritte:** 1. Sitz 1 aktiviert Burning Skeleton auf Alleria; Alleria leitet auf Held 1 um (Burn, kein Schaden). 2. Sitz 0 greift danach mit „Attack" (150) Carris an.
- **Erwartet** (Kartentext: „…redirect that Attack, Spell or effect … If you do, that Attack's or Spell's damage cannot be reduced or negated, except by a Surprise"): Die Sperre gilt nur für den Schaden *dieser* Attacke/dieses Zaubers. Ein Effekt ohne Schaden hinterlässt nichts; die spätere Attacke wird von Carris auf 0 gesetzt (Gegenprobe ohne Umleitung: 0 Schaden).
- **Beobachtet:** `gs._redirectedOnlyReducibleBySurprise` bleibt nach der Burn-Umleitung `true` und wird erst vom nächsten Heldenschaden irgendwo gelöscht → die spätere Attacke trifft Carris „nicht negierbar" und richtet 150 Schaden an.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/02-alleria-umleitung-ohne-schaden-laesst-sperre-stehen.js`
- **Vermutete Ursache:** `alleria-the-queen-of-spiders.js:146` setzt die globale Marke beim Umleiten; Löschung nur in `_engine.js:8688-8691` (`actionDealDamage`). Ein nicht verbrauchter Marker (Effekt ohne Schaden, abgebrochen, Ziel stirbt davor) wird nie am Ende der Auflösung geräumt.

### N4-03 · Cute Spider: der Regel-Abwurf des Handlimits löst „discard … through an effect" aus · Stufe B
- **Karten:** Cute Spider (`cute-spider.js`), Spider Avalanche (Surprise zum Messen)
- **Voraussetzungen / Aufbau:** Sitz 0: Cute Spider auf dem Brett, Held mit Destruction Magic, Hand mit 9 Karten inkl. Spider Avalanche; Phase Main 2.
- **Schritte:** 1. `t.endTurn()` → Handlimit-Abwurf, Spieler wählt die Spider Avalanche. 2. Gegenprobe: derselbe Abwurf per Effekt (`actionDiscardHandCard` mit `source`).
- **Erwartet** (Kartentext: „…when you discard a Surprise one of your Heroes can use through an effect…"; Ruling CARD_API.md Z. 20443, Welle 12 Q93, Al zu Glass of Marbles „by an effect": „NUR Karteneffekte, nicht das Hand-Size-Limit"): Beim Handlimit-Abwurf bietet Cute Spider nichts an.
- **Beobachtet:** Bei der Handlimit-Abwurf-Wahl erscheint „Activate the discarded Spider Avalanche for free?"; bestätigt aktiviert Cute Spider die Surprise und löscht sie (Log `cute_spider_force_activate`).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/03-cute-spider-handlimit-ist-kein-effekt.js`
- **Vermutete Ursache:** `cute-spider.js:87` (`onDiscard`) prüft `ctx._handLimitRegel` nicht (der Hook liefert die Marke seit Welle 12, `_engine.js:17927`; nur `glass-of-marbles.js` nutzt sie).

### N4-04 · Alleria zieht, wenn Cute Spider eine aus der Hand abgeworfene Surprise aktiviert · Stufe B
- **Karten:** Alleria, the Queen of Spiders; Cute Spider; Spider Avalanche
- **Voraussetzungen / Aufbau:** Sitz 0: Alleria als Held 0 (Destruction Magic), Cute Spider auf dem Brett, Spider Avalanche auf der Hand.
- **Schritte:** 1. Ein Effekt wirft die Avalanche von der Hand ab; Cute Spider aktiviert sie (bestätigt).
- **Erwartet** (Alleria: „When a Surprise **in this Hero's Surprise Zone** activates, draw 1 card."): Die Surprise lag nie in einer Surprise Zone (Hand → Ablage → gelöscht) → kein Alleria-Zug. Ohne Alleria ist die Handgröße −1 (nur der Abwurf).
- **Beobachtet:** Log `alleria_surprise_draw`; Handgröße ±0 (Alleria zieht 1).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/04-alleria-zieht-bei-cute-spider-aktivierung.js`
- **Vermutete Ursache:** `alleria-the-queen-of-spiders.js:161` (`onSurpriseActivated`) vergleicht nur Seite und Index des *aktivierenden* Helden (`ctx.heroIdx === ctx.cardHeroIdx`), nicht, ob die Karte in dessen Zone lag. (Der Brain-Spider-Weg „as if placed in theirs" ist davon getrennt und wurde nicht beanstandet.)

### N4-05 · Skeleton Healer: unter Fremdkontrolle bietet sie sich selbst als „different target" an · Stufe B
- **Karten:** Skeleton Healer (`skeleton-healer.js`); Zusammenspiel mit jedem Diebstahl (`actionStealCreature`: Dark Deal, Cute Conversion, Deepsea Succubus …) und seitenfremder Beschwörung (`markiereSeitenfremd`)
- **Voraussetzungen / Aufbau:** (a) Sitz 1 stiehlt Sitz 0s Healer; (b) Sitz 1 übernimmt Held 0 von Sitz 0 und beschwört dort eine Healer. Sitz 1 aktiviert sie.
- **Schritte:** 1. Aktivierung; 2. Zielliste lesen (`t.targets`).
- **Erwartet** (Kartentext: „choose a **different** target and heal it for 100 HP"): Die Healer steht nie in ihrer eigenen Zielliste (Gegenprobe normal: steht nicht drin).
- **Beobachtet:** In (a) und (b) enthält die Liste `equip:0:0:0` = die Healer selbst; wählbar → sie heilt sich.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/05-skeleton-healer-fremdkontrolle-kann-sich-selbst-heilen.js`
- **Vermutete Ursache:** `skeleton-healer.js:47`: `t.owner === pi && t.heroIdx === heroIdx && t.slotIdx === zoneSlot` vergleicht Brettseite (`t.owner`) mit dem handelnden Spieler `pi` (Kontrolleur); bei Fremdkontrolle sind beide verschieden. Richtig wäre der Vergleich mit der Brettseite der eigenen Instanz (`ctx.cardHeroOwner`).

### N4-06 · Skeleton Reaper: seitenfremd beschworen bietet sie sich selbst als Ziel an · Stufe B
- **Karten:** Skeleton Reaper (`skeleton-reaper.js`); `promptDamageTarget` (`_engine.js:~5002`)
- **Voraussetzungen / Aufbau:** Sitz 1 übernimmt Held 0 von Sitz 0, beschwört dort die Reaper (Brettseite 0, Kontrolleur Sitz 1); Sitz 0 hat eine weitere Kreatur (Held 1). Sitz 1 aktiviert die Reaper (`side: 'enemy'`).
- **Schritte:** Aktivierung; Zielliste lesen.
- **Erwartet** („Choose a Creature **your opponent controls**"): nur die Kreatur von Sitz 0 (Held 1); die Reaper (von Sitz 1 kontrolliert) steht nicht in der Liste (Gegenprobe normal / gestohlen: korrekt; Burning Skeleton in derselben Lage ebenfalls korrekt).
- **Beobachtet:** Liste `[equip:0:0:0 (= die Reaper selbst), equip:0:1:0]`. Wählt man die Reaper, passiert nichts Sichtbares (kein Schadensaufruf, kein Log) – das Angebot ist eine Falle.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/06-skeleton-reaper-seitenfremd-bietet-sich-selbst-an.js`
- **Vermutete Ursache:** Gemessen: während der Aktivierung liefert `engine.kreaturAnBrett(0,0,0)` für die seitenfremde Reaper `undefined` (vorher/nachher die Instanz). `addCreatures` (`_engine.js:5002-5029`) prüft `kreaturPasstZurSeite` nur `if (inst && …)` – ohne Instanz wird der Kontroll-Filter übersprungen und der Eintrag trotzdem angelegt. Warum `kreaturAnBrett` (über `physicalSide`, `_engine.js:20715`) hier nichts findet, wurde nicht weiter verfolgt.

### N4-07 · Hardy Slime: seitenfremd beschworen erzwingt keine Zielwahl · Stufe B
- **Karten:** Hardy Slime (`hardy-slime.js`), Zielfilter `_applyForcesTargetingFilter` (`_engine.js:~284`)
- **Voraussetzungen / Aufbau:** Sitz 0 übernimmt Held 0 von Sitz 1 (`actionStealHero(0,1,0)`) und spielt dort Hardy Slime (`charmedOwner:1`); Sitz 1 greift mit „Attack" (Held 2) an. Gegenprobe: Hardy normal auf der eigenen Seite.
- **Erwartet** („your opponent has to choose it with all Attacks and Spells they use until your next turn, if possible"): Sitz 1 kann keinen anderen von Sitz 0 kontrollierten Helden wählen (Normalfall: Helden von Sitz 0 fehlen in der Liste).
- **Beobachtet:** Seitenfremd steht die Zielliste ungefiltert (3 Helden von Sitz 0 wählbar); der Spott greift nicht.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/07-hardy-slime-seitenfremd-spottet-nicht.js`
- **Vermutete Ursache:** `_engine.js:367`: `forcerTargetId = equip-${forcerSide}-…` mit `forcerSide = controller ?? owner`, während Ziel-IDs die BRETTSEITE tragen (`equip-<owner>-…`, vgl. `kreaturZiel`); die ID wird nicht gefunden (`if (!targets.find(...)) continue`). Dieselbe Stelle trägt Deepsea Horror Clown und Doomed Town Guard.

### N4-08 · Rebelliokai Backup Bakus: die Rückkehr aus der Ablage räumt die Instanz einer anderen Kopie ab · Stufe A
- **Karten:** Rebelliokai Backup Bakus (`rebelliokai-backup-bakus.js`); Kind Kitsune (Abwurfopfer)
- **Voraussetzungen / Aufbau:** (a) Bakus in der Ablage + eine zweite Bakus auf dem Brett; (b) zweite Bakus auf der Hand. Sitz 0 wirft Kind Kitsune per Effekt ab; „Recur" bestätigt.
- **Schritte:** 1. `actionDiscardHandCard` (Effekt) → Bakus-Angebot → ja. 2. `t.audit()`; Instanzen zählen.
- **Erwartet** (Kartentext: „…you may add this card from your discard pile to your hand, and if you do, draw 1 card"): Die Ablage-Kopie wandert auf die Hand (+1 Karte), die anderen Kopien bleiben unverändert (jede Karte in einer Zone hat genau eine Instanz).
- **Beobachtet:** (a) Audit: `seat0.support[0][0] "Rebelliokai Backup Bakus": 0 Instanzen` – die Brett-Bakus steht noch im Zonen-Array, ihre Instanz ist abgeräumt (nicht mehr bedienbar/zielbar). (b) Zwei Bakus-Namen auf der Hand, nur eine Hand-Instanz. Gegenprobe (nur die Ablage-Kopie): sauber.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/08-backup-bakus-entfernt-instanz-der-brett-oder-handkopie.js`
- **Vermutete Ursache:** `rebelliokai-backup-bakus.js:222` `engine._untrackCard(ctx.card.id)`: `ctx.card` ist der *Hörer* des Hooks. Mit `activeIn: ['hand','support','discard','deleted','deck']` kann das eine Hand-/Brett-/Deck-Kopie sein (der erste Hörer in `cardInstances` gewinnt), nicht die Ablage-Kopie, die gemeint ist.

### N4-09 · Bomblebee: die soeben besiegte Kreatur steht noch in der Zielliste des 150-Schadens · Stufe B
- **Karten:** Bomblebee (`bomblebee.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Bomblebee; Sitz 1: eine 10-HP-Kreatur (Auslöser) und eine zweite Kreatur. Tod per `actionDestroyCard` bzw. per Kreaturenschaden.
- **Schritte:** Auslöser besiegen; Zielliste der Bomblebee lesen.
- **Erwartet** („when a target your opponent controls is defeated, you may choose a target your opponent controls…"): Die besiegte Kreatur ist nicht mehr auf dem Brett und steht nicht zur Wahl (vgl. Heli Troopers: `inst.id === ctx.card.id` ausgeschlossen).
- **Beobachtet:** Liste `[hero:1:0,1:1,1:2, equip:1:0:0 (= die gerade besiegte), equip:1:1:0]`. Wird sie gewählt, verpufft der Schlag („bomblebee_strike" auf die tote Kreatur), das Einmal-pro-Zug-Recht ist verbraucht.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/09-bomblebee-bietet-die-gefallene-kreatur-als-ziel-an.js`
- **Vermutete Ursache:** `bomblebee.js:31 opponentTargets()` liest `engine.cardInstances` mit `inst.zone === 'support'`; im Todes-Hook ist die Instanz noch `support` (nur der Zonen-Eintrag ist leer). Es fehlt der Ausschluss der Todes-ID (`ctx.creature.instId`).

### N4-10 · Skeleton Reaper: die „use this effect again"-Kette läuft eingefroren weiter · Stufe B
- **Karten:** Skeleton Reaper (`skeleton-reaper.js`); Mischief Militia - Heli Troopers
- **Voraussetzungen / Aufbau:** Sitz 0: Reaper. Sitz 1: Heli Troopers + zwei 10-HP-Kreaturen. Troopers frieren beim Tod die Reaper ein.
- **Schritte:** Reaper aktivieren, zuerst die Troopers wählen.
- **Erwartet** (Kartentext: „If this damage defeats that Creature, you may immediately use this effect again."; Ruling Welle 7: gefroren/negiert/betäubt unterbrechen die laufenden Effekte der Karte): Die Reaper tötet die Troopers, ist danach gefroren und kann den Effekt nicht erneut nutzen; die beiden anderen Kreaturen leben.
- **Beobachtet:** Die Schleife läuft weiter, beide weiteren Kreaturen sterben (3 Tote). Gegenprobe (Troopers frieren einen Helden): Kette über alle drei (legal).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/10-skeleton-reaper-kette-laeuft-eingefroren-weiter.js`
- **Vermutete Ursache:** `skeleton-reaper.js:58 while (true)` prüft nach dem Tod weder `isCreatureEffectSuppressed(ctx.card)` noch ob die Reaper selbst noch auf dem Brett steht.

### N4-11 · Cloudy Slime: eine per Rocky Slime auf Stufe 0 gesenkte Handkreatur zählt nicht als „level 0 Creature" · Stufe B
- **Karten:** Cloudy Slime (`cloudy-slime.js`), Rocky Slime; (Shadowy Slime liest ebenso die gedruckte Stufe, dort aber für die Ablage)
- **Voraussetzungen / Aufbau:** Hand [Rocky Slime, Cloudy Slime, Bomblebee (Lv1), Fiery Slime (Lv0)]; Rocky Slime senkt die Bomblebee dauerhaft auf 0 (Hand-Offset −1); danach Cloudy Slime.
- **Schritte:** Rocky wirkt; Cloudy beschwören; Galerie lesen.
- **Erwartet** („place a level 0 Creature from your hand"; Konvention `psychic-scout.js:58`: „level 0" in der Hand = `effectiveCardLevel(cd, pi, { handIdx })`): Galerie = Fiery Slime **und** die gesenkte Bomblebee.
- **Beobachtet:** Galerie nur `["Fiery Slime"]`. (Gegenprobe ohne Rocky-Wirkung: `["Rocky Slime","Fiery Slime"]`, Bomblebee Lv1 fehlt zu Recht.)
- **Repro:** `docs/niche-tests/repro/N4-archetypen/11-cloudy-slime-handstufe-nach-rocky-slime.js`
- **Vermutete Ursache:** `cloudy-slime.js:49` und `:118` filtern `(c.level || 0) === 0` auf den gedruckten Kartendaten statt `engine.effectiveCardLevel`.

### N4-12 · Alleria bietet die Umleitung auch bei MEHREREN gewählten Zielen an · Stufe B
- **Karten:** Alleria, the Queen of Spiders; Pyroblast (Messzauber „any number of targets")
- **Voraussetzungen / Aufbau:** Sitz 0: Alleria, Surprise in Held 2. Sitz 1 wirkt Pyroblast auf (a) Held 0, (b) Held 0 + Held 1 von Sitz 0.
- **Schritte:** Zauber spielen, Alleria-Angebot zählen.
- **Erwartet** („when your opponent chooses **exactly 1** target you control"): (a) gefragt; (b) 2 gewählte Ziele → nicht gefragt.
- **Beobachtet:** (b) wird gefragt und umgeleitet (auch mit 3 Zielen). (a) korrekt.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/12-alleria-umleitung-bei-mehrfachwahl.js`
- **Vermutete Ursache:** `alleria-the-queen-of-spiders.js:72 canHeroRedirect` liest `config._redirectPickCount` nicht (das Fenster setzt es, `_engine.js:31155`).

### N4-13 · Alleria: Umleitung bei genau 1 gewählten KREATUR? · Stufe C
- **Karten:** Alleria, the Queen of Spiders
- **Voraussetzungen / Aufbau:** Sitz 0: Alleria, Surprise in Held 2, eine Kreatur. Sitz 1 wirkt Fireball auf genau diese Kreatur.
- **Schritte:** Zauber spielen.
- **Erwartet / Lesarten:** Text: „exactly 1 **target** you control". A (Wortlaut, „target" = Held oder Kreatur): auch die Kreatur darf auf einen Helden mit Surprise umgeleitet werden. B (heute): nur Helden.
- **Beobachtet:** Alleria wird nicht gefragt; die Kreatur nimmt 150 (Lesart B).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/13-alleria-umleitung-kreatur-als-einziges-ziel.js` (✗ = heutiges Verhalten, Lesart B)
- **Vermutete Ursache:** `alleria-the-queen-of-spiders.js:85` `selected.type !== 'hero'`.
- **Frage an Al:** Darf Alleria auch umleiten, wenn der Gegner genau 1 Kreatur von mir wählt (Ja = Lesart A, Nein = heutiges Verhalten, nur Helden)?

### N4-14 · Sandy Blob feuert für abgelehnte/abgebrochene Cloudy-/Shadowy-Effekte und für Witch/Architect unter Such-Sperre · Stufe A
- **Karten:** Cloudy Slime, Shadowy Slime, Deepsea Witch, Sparkfly Architect; Sandy Blob (Messkarte)
- **Voraussetzungen / Aufbau:** Sitz 0: Sandy Blob (alt); Sitz 0 beschwört die jeweilige Karte und (a) lehnt das „you may" ab, (b) bricht die Kartenwahl ab, (c) bricht die Zonenwahl ab, bzw. (d) hat `searchLocked`.
- **Schritte:** Karte beschwören; `t.targets` auf Sandy-Blob-Angebote auswerten. Gegenprobe: Cloudy platziert wirklich → 2 Angebote (Cloudy + platzierte Fiery Slime).
- **Erwartet** (Ruling CARD_API.md Z. 20472, Welle 11 R4, Al: „Nein, die sollen auch nicht auslösen. Nur ein wirklich feuernder Effekt löst Sandy Blob aus!"; „Ein abgelehntes ‚you may‘ und ein leeres Suchen/Wählen (… Wahl abgebrochen) sind kein feuernder On-Summon-Effekt … Neue On-Summon-Effekte mit ‚you may‘/Suche/Wahl stempeln an jedem Ausstieg ohne Wirkung"): in allen sieben Fällen KEIN Blob-Angebot.
- **Beobachtet:** In allen sieben Fällen genau 1 Blob-Angebot (das der beschworenen Karte selbst). Alle übrigen Ausstiege der Liste (Rocky/Werewolf-Abbruch, Witch/Architect-Ablehnung/Abbruch, Zombie ohne Gegnerhand) stempeln korrekt (0 Angebote, geprüft). Zusatz: Sparkfly Architect fragt unter Such-Sperre noch nach der Karte und tut danach nichts.
- **Repro:** `docs/niche-tests/repro/N4-archetypen/14-sandy-blob-feuert-bei-abgelehntem-cloudy-shadowy-und-suchsperre.js`
- **Vermutete Ursache:** `cloudy-slime.js:90` (`if (!confirmed) return;`), `:130` (`if (!selected) return;`), `:142/:145` (Zonenwahl-`continue` bis `MAX_RUNDEN`); `shadowy-slime.js:98`, `:120`, `:131`; `deepsea-witch.js:58` (`search_offer_skipped` ohne `summonEffektFizzelt`); `sparkfly-architect.js` (keine Prüfung der Such-Sperre vor der Kartenwahl). Es fehlt jeweils `engine.summonEffektFizzelt(ctx.card, name, { stumm: true })`.

### N4-15 · Sparky Slime: der EIGENE Held ist nur bis zum Ende des laufenden Zuges negiert · Stufe B
- **Karten:** Sparky Slime (`sparky-slime.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 beschwört Sparky Slime (Zug 5) und wählt (a) eine eigene Kreatur, (b) den gegnerischen Helden, (c) den eigenen Helden 1.
- **Schritte:** `t.endTurn()` ×2; Status zu Beginn von Zug 6 und 7 lesen.
- **Erwartet** („negate its effects and Abilities **until your next turn**"): Z5 negiert, Z6 (Gegnerzug) negiert, Z7 frei – für jedes Ziel.
- **Beobachtet:** (a) und (b) wie erwartet; (c) der eigene Held ist nur in Z5 negiert, zu Beginn von Z6 schon frei (der Heldenstatus tickt am Zugende des Kontrolleurs, hier sofort).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/15-sparky-slime-eigener-held-nur-bis-zugende.js`
- **Vermutete Ursache:** `sparky-slime.js:56` ruft `addHeroStatus('negated', { appliedBy })` ohne Dauer; Icy Slime löst dieselbe Lage mit `frostDauer(ctx.cardOwner, target.owner)` (eigenes Ziel 2, fremdes 1), Sparky Slime kennt für Helden nichts Entsprechendes (Kreaturen: `expiresAtTurn/expiresForPlayer`, korrekt).

### N4-16 · Slime Rancher: nur eigene oder auch gegnerische Slimes verdoppeln? · Stufe C
- **Karten:** Slime Rancher (`slime-rancher.js`), Icy Slime (Messkarte)
- **Voraussetzungen / Aufbau:** Sitz 0: Slime Rancher. Sitz 1 beschwört einen Icy Slime.
- **Schritte:** Zielwahlen des Icy Slime zählen.
- **Erwartet / Lesarten:** Text: „While you control this Creature, the effects of "Slime" Creatures that activate when they are summoned are activated an additional time." – ohne „you control" bei den Slimes (anders als Sandy Blob: „a Creature you control"). A (Wortlaut): auch die Slimes des Gegners werden doppelt aktiviert (2 Zielwahlen für Sitz 1). B (heute): nur Slimes, die der Rancher-Kontrolleur kontrolliert.
- **Beobachtet:** 1 Zielwahl (Lesart B).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/16-slime-rancher-gegnerische-slimes.js` (✗ = heutiges Verhalten, Lesart B)
- **Vermutete Ursache:** `slime-rancher.js:49` `(entering.controller ?? entering.owner) !== ctx.cardOwner`.
- **Frage an Al:** Soll Slime Rancher auch die Einsatz-Effekte von Slimes verdoppeln, die der Gegner beschwört (Ja = Wortlaut, Nein = heute: nur eigene)?

### N4-17 · Heli Troopers: „Freeze it for 1 turn" bei Tod im Gegnerzug · Stufe C
- **Karten:** Mischief Militia - Heli Troopers (`mischief-militia-heli-troopers.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Heli Troopers; Sitz 1 ist am Zug (Zug 5), tötet sie und Sitz 0 friert dessen Held 0 ein.
- **Schritte:** `t.endTurn()` ×2, Frostzustand zu Beginn von Zug 6 und 7.
- **Erwartet / Lesarten:** A (heute): „1 turn" = bis zum Ende des Zuges, in dem das Ziel steht – hier nur der Rest von Zug 5; der Held ist zu Beginn von Zug 6/7 frei, es wird kein ganzer Zug des Gegners behindert (wohl aber sein restlicher Zug). B: der **nächste volle Zug** des Ziels (Zug 7) ist gesperrt (wie Icy Slime: „bis zum Ende deines nächsten Zuges"; wie Iceage bei Wirkung im eigenen Zug).
- **Beobachtet:** Z5 gefroren, Z6 frei, Z7 frei (Lesart A). Stirbt die Troopers im EIGENEN Zug, friert der gegnerische Held in dessen nächsten Zug (beide Lesarten gleich).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/17-heli-troopers-frost-im-gegnerzug.js` (✗ = heutiges Verhalten, Lesart A)
- **Vermutete Ursache:** `mischief-militia-heli-troopers.js:104` `applyFreezeToTarget(engine, target, 1, pi)` – feste Dauer 1 ohne Seiten-/Zugprüfung (anders als `icy-slime.js frostDauer`).
- **Frage an Al:** Soll der Frost der Heli Troopers beim Tod im Zug des Gegners dessen **nächsten vollen Zug** sperren (Ja = Lesart B) statt nur den Rest des laufenden Zuges (Nein = heute)?

### N4-18 · Spider Silk Bridge: Schaden an einem von mir übernommenen Helden zählt nicht als „target you control" · Stufe B
- **Karten:** Spider Silk Bridge
- **Voraussetzungen / Aufbau:** Sitz 0: Bridge verdeckt, Sitz 0 hat Held 1 von Sitz 1 übernommen (`actionStealHero(0,1,1)`). Sitz 1 (am Zug) schadet genau diesem Helden (50) und beendet den Zug.
- **Schritte:** `t.endTurn()`; Log `spider_silk_bridge_draw phase:activation` prüfen.
- **Erwartet** („…without dealing damage to any target **you control**"; Kontroll-Regeln „Wer ist du"): Schaden an dem Helden, den ich kontrolliere, verhindert die Aktivierung (Gegenproben: eigener Held → verhindert; kein Schaden → aktiviert). Für Kreaturen funktioniert das (gestohlene Kreatur verhindert), die offen liegende Bridge verwirkt über `surpriseKontrolleur` ebenfalls korrekt.
- **Beobachtet:** Die Bridge aktiviert und zieht 2 (Marke `dealtDamageToOpponent` bleibt `false`).
- **Repro:** `docs/niche-tests/repro/N4-archetypen/18-silk-bridge-schaden-an-uebernommenem-helden.js`
- **Vermutete Ursache:** `_engine.js:9372-9376` (und `:9505-9512`): die Marke wird gesetzt, wenn der Zielheld im `heroes`-Array eines anderen Spielers steht (Brettseite), nicht nach `heroSideOf`/Kontrolle.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Alleria, the Queen of Spiders | L2 gezielt | Umleitung 1/2/3 Ziele ✗(→12), Kreaturen-Ziel (→13 C), Marke ohne Schaden ✗(→02), Zustände Frozen/Stunned/Negated(hart+leicht)/tot/gestohlen ✓ (keine Umleitung), Zug-Trigger via Cute Spider ✗(→04), Surprise in Nachbarzone via Brain Spider („as if they were placed in theirs") zieht → vom Text gedeckt, nicht beanstandet |
| Bomblebee | L2 gezielt | Zielliste nach Tod ✗(→09), Schutz-Filter (untargetable) ✓, HOPT je Instanz ✓, Abbruch ohne HOPT ✓ |
| Burning Skeleton | L2 gezielt | Aktivierung/HOPT ✓, gestohlen + seitenfremd Zielliste ✓ (kein Selbstangebot), Bard-Zweitnutzung ✓ |
| Carpet Bomblebee | L2 gezielt | zwei Carpets × drei Tode (je 80 pro Carpet und Zug = 160), toter Held bleibt 0 ✓, HOPT-Reset im nächsten Zug ✓, vom Dieb kontrollierte Kreatur löst nicht aus ✓ |
| Cloudy Slime | L2 gezielt | HOPT/Rancher-Ausschluss ✓, Ablehnung/Abbruch ✗(→14), Stufe der Handkarte ✗(→11), Sperre durch Squirrel ✓ |
| Cosmic Skeleton | L2 gezielt | Aktivierung, HOPT, gestohlen (Brettseite-Held) ✓, Bard-Zweitnutzung ✓ |
| Crimson Skull Spider | L2 gezielt | Singleton (Diebstahl der zweiten) ✓, Zahlen mit Spider Avalanche (20×n + 40×Spinnen) ✓ |
| Cute Spider | L2 gezielt | Hand-Abwurf per Effekt ✓, Handlimit ✗(→03), Silk Bridge/Glass Wall/Firewall aus der Ablage ✓, Alleria-Folge ✗(→04) |
| Diamond Spider | L2 gezielt | Ziehen 2 bei Gegner-Surprise ✓, zwei Diamonds ✓, negiert ✓ |
| Fiery Slime | L2 gezielt | Burn bleibt über 4 Zugwechsel (Held/Kreatur) ✓, Rancher 1/2 ✓, Blob-Stempel ✓ |
| Hardy Slime | L2 gezielt | Spott normal ✓, seitenfremd ✗(→07), Rancher (idempotent) ✓ |
| Skeleton Healer | L2 gezielt | Selbstausschluss normal ✓, gestohlen/seitenfremd ✗(→05) |
| Icy Slime | L2 gezielt | Dauer eigenes/fremdes Ziel Held/Kreatur über echte Zugwechsel ✓ (Autor-Entscheidung), Rancher ✓ |
| Infinitely Reproducing Slime | L2 gezielt | Verdopplung über 3 Eigenzüge (2→4→8, negiert bis Beginn des nächsten Zuges) ✓, Hand/Deck-Quelle ✓ |
| Rocky Slime | L2 gezielt | Hand-Offset ✓ (Folge →11), Brett-Ziele inkl. Gegner, Abbruch ✓, Rancher 1/2 (Ziele schrumpfen) ✓ |
| Shadowy Slime | L2 gezielt | Platzierung aus Ablage, Beschwörungssperre + Aufhebung nächster Zug ✓, Ablehnung/Abbruch ✗(→14) |
| Shiny Slime | L2 gezielt | Zählen 0/1/viele, gleiche Namen, gewachsener Slime (original Lv0), Rancher 1/2 ✓ |
| Skeleton Archer | L2 gezielt | Aktivierung/HOPT, gestohlen (Selbstziel = „a target" erlaubt), Bard ✓ |
| Skeleton Mage | L2 gezielt | Deck 5/1/0, Hand 0/1, Zieh-/Handsperre ✓, Bard (+2 Hand) ✓ |
| Skeleton Reaper | L2 gezielt | Kette 3 schwache Ziele ✓, seitenfremd ✗(→06), eingefroren in der Kette ✗(→10) |
| Skeleton Skull Bat | L2 gezielt | Gegner −1 Karte, gestohlen/seitenfremd (Gegner des Kontrolleurs) ✓, Bard (−2) ✓ |
| Slime Rancher | L2 gezielt | alle 10 Slimes × 0/1/2 Rancher ✓ (Cloudy/Shadowy/Rancher ausgenommen), gegnerische Slimes (→16 C) |
| Slimy Slime | L2 gezielt | Heilung Held/Kreatur, Rancher 1/2 ✓ |
| Sparkfly Architect | L2 gezielt | Suche Gallerie/Abbruch ✓, leeres Deck ✓, Such-Sperre (→14) |
| Sparky Slime | L2 gezielt | Ziele Gegner-Held/-Kreatur/eigene Kreatur ✓, eigener Held ✗(→15) |
| Spider Avalanche | L2 gezielt | Zahlen 20×Kreaturen, + Crimson Skull ✓, Auslöser Alleria/Brain ✓ |
| Spider Dance | L2 gezielt | Deckel = Spinnen 0/1/2/3 und distinct Surprises ✓, anschließende Spinnen-Beschwörung ✓ |
| Spider Hive | L2 gezielt | Stufensenkung Area (eigene/gegnerische Spinnen), keine Wirkung beim Setzen aus der Hand ✓ |
| Spider Silk Bridge | L2 gezielt | Aktivierung/Zugende, Kreatur-Schaden, offen/erneut ✗(→01), übernommener Held ✗(→18) |
| Splashy Slime | L2 gezielt | Zählen wie Shiny, Gold ×2/×3 mit Rancher ✓ |
| Treasure Skeleton | L2 gezielt | +6 Gold, Bard +12 ✓, gestohlen ✓ |
| The Thing in the Ship | L2 gezielt | Sperre aktiv, gefroren/negiert/verdeckt ruht, gestohlen/Tote Spalte wirkt weiter ✓ |
| Deepsea Werewolf | L2 gezielt | Zielwahl-Abbruch (Blob-Stempel) ✓, 1 pro Zug ✓ |
| Deepsea Witch | L2 gezielt | Suche/Ablehnung/Abbruch/leer ✓, Such-Sperre (→14) |
| Deepsea Zombie | L2 gezielt | Gegner verwirft 1, 1 pro Zug (2. Kopie abgelehnt) ✓, Gegnerhand leer fizzelt ✓ |
| Infected Squirrel | L2 gezielt | Bounce am Beschwörungstag mit Zombie + Beschwörungssperre (Witch/Cloudy abgelehnt), Sperre fällt im nächsten Zug ✓ |
| Cuteness Sensor | L2 gezielt | Kosten 4 Gold, Such-/Hand-/Goldsperre, Namenspräfix „Cute" (Ruling Q24) ✓ |
| Minocrete War Counselor | L2 gezielt | Verdopplung Harpthenean (Deckel 300) ✓, Wiederholung nach Vorschaden, HOPT ✓ |
| Mischief Militia - Chilly Dog | L2 gezielt | gefrorene, am selben Tag beschworene Kreatur (Treasure Skeleton) aktivierbar: mit Hund ✓, Hund selbst gefroren ✓, Hund negiert → nein ✓, Hund vom Gegner gestohlen → nein ✓ (Aura live nach Kontrolleur) |
| Mischief Militia - Heli Troopers | L2 gezielt | Todes-Frost im eigenen/Gegnerzug (→17 C), Selbstausschluss ✓, Kette mit Reaper ✓ (→10) |
| Rebelliokai Backup Bakus | L2 gezielt | Recur/Draw/HOPT ✓, Mill → gelöscht ✓, Brett-Tod → Ablage ✓, gestohlene Bakus ✓, zweite Kopie ✗(→08) |
| Rebelliokai Courtly Kirin | L2 gezielt | Reaktion auf Tharx, Kosten, Bakus-Recur im selben Fenster ✓, kein anderer Rebelliokai/gefrorener Held → nicht angeboten ✓ |

## Getestet & in Ordnung (Auswahl)
* **Slime Rancher × Slimes:** 0/1/2 Rancher → 1/2/3 Aktivierungen für Fiery, Icy, Sparky, Slimy; Shiny zieht 1/2/3; Splashy +4/+8/+12 Gold; Cloudy/Shadowy/Rancher bleiben bewusst ausgenommen.
* **Shiny/Splashy:** Zählen mit 0, 1, vielen: gleiche Namen einmal, auf Stufe 1 gewachsener Fiery Slime („original level 0") zählt, durch Rocky gesenkte Stufe-1-Kreatur nicht, gestohlener Slime zählt für den Dieb, eigener gestohlener nicht mehr.
* **Infinitely Reproducing Slime:** vermehrt sich über drei Eigenzüge 2→4→8 (der neue ist bis zum Beginn des nächsten eigenen Zuges negiert und feuert dann), Hand/Deck als Quelle, sauberer Zustand.
* **Icy Slime / Fiery / Sparky über echte Zugwechsel:** Frost eigene Ziele 2 Zugenden, fremde 1 (Autorentscheidung), Burn bleibt für den Rest des Spiels, Negierung der Kreatur „until your next turn" stimmt.
* **Skeleton-Familie:** alle acht aktiven Skelette aktivierbar, HOPT, mit Skeleton Bard doppelt nutzbar (Mage +2 Hand, Treasure +12 Gold, Bat −2 Karten, Archer 2 Schüsse), seitenfremd/gestohlen: Gegner relativ zum Kontrolleur korrekt (Bat, Burning, Treasure, Mage).
* **Bomblebee:** HOPT je Instanz, Abbruch der Zielwahl verbraucht nichts, Schutz-Filter (`untargetable_*`) greifen im Effekt-Picker.
* **Deepsea:** Zombie/Witch/Werewolf 1 pro Zug (zweite Kopie abgelehnt), Infected Squirrel am Beschwörungstag per Zombie-Bounce → Beschwörungssperre (Witch/Cloudy abgelehnt), Sperre fällt im nächsten eigenen Zug.
* **Courtly Kirin:** negiert Tharx' Heldeneffekt (keine Karte gezogen), Kosten Kind Kitsune, Bakus-Recur im selben Fenster (Bilanz sauber); mit gefrorenem Summoner/nur zwei Kirins nicht angeboten.
* **Backup Bakus:** Mill → gelöscht; Tod auf dem Brett → Ablage des Besitzers (auch gestohlen).
* **Spider Dance:** Deckel = Anzahl Spinnen und distinct Surprises (0/1/2/3), danach Spinnen-Beschwörung als zusätzliche Aktion.
* **Spider Hive / Crimson Skull / Avalanche / Diamond:** Zahlen 20×n + 40×Spinnen; Singleton schützt auch gegen Diebstahl; Diamond zieht auch bei Gegner-Surprise, zwei Diamonds je 2.
* **Minocrete:** Harpthenean doppelt, Deckel 300 bleibt (Gold 30/50/70 → 300).
* **The Thing in the Ship:** wirkt für beide Spieler, ruht gefroren/negiert/verdeckt, bleibt bei Diebstahl.
* **Cuteness Sensor:** Gold 4, Such-/Hand-/Goldsperre sperren korrekt.
* **Dauerfeuer:** 42 Karten × Sitz 0/1 = 84 Läufe ohne verschluckte Engine-Fehler, Hänger oder Audit-Funde.
