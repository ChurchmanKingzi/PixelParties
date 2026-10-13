# R01-reaction-area-attach-surprise – Nischenfall-Bericht
Stand/Autor: Agent R01-reaction-area-attach-surprise, 13.10.2026. Karten: 44 in der Liste · 0 gezielt getestet · 0 mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde

### R01-01 · Gold Trap fängt das automatische Rundeneinkommen des Gegners ab · Stufe A
- **Karten:** Gold Trap (`cards/effects/gold-trap.js`), Engine `actionGainGold`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold je Seite; Sitz 0 hat verdeckt Gold Trap in der Surprise Zone von Held 0 (Decay Magic 1 per `grantFor`).
- **Schritte:** 1. `t.endTurn()` – Sitz 0 beendet den Zug, bei Sitz 1 läuft die Resource Phase (Rundeneinkommen +4 Gold).
- **Erwartet** (Kartentext „Activate this Surprise when your opponent would gain Gold **through an effect**."; Ruling CARD_API.md Z. ~18137 (24.9.) und der Kommentar in `actionGainGold` (Z. ~24069): das Rundeneinkommen trägt `_isResourceGain` und ist ausdrücklich KEIN „effect"): Gold Trap bleibt verdeckt, Sitz 1 hat 104 Gold, Sitz 0 100.
- **Beobachtet:** Das Surprise-Fenster geht auf („Activate Gold Trap?"), die Falle löst aus: Sitz 0 hat 104, Sitz 1 100 – die Falle ist beim allerersten Einkommen des Gegners verbraucht (samt Kreaturen-Bounce-Angebot).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/01-gold-trap-rundeneinkommen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `actionGainGold` (~Z. 24089) ruft `_checkSurpriseOnResourceGain(playerIdx, hookCtx.amount)` ohne `opts._isResourceGain` zu beachten; weder `_checkSurpriseOnResourceGain` (~Z. 31806) noch `gold-trap.js` `surpriseTrigger` filtern das Einkommen. (Gegenstück beim Ziehen: dort gibt es `_isResourceDraw` und „outside Resource Phase".)

### R01-02 · Gold Trap legt einen Token („Mummy Token") als Karte in die Hand · Stufe B
- **Karten:** Gold Trap (`gold-trap.js` `_bounceCreatureToHand`)
- **Voraussetzungen / Aufbau:** Sitz 0: verdeckt Gold Trap. Sitz 1: „Mummy Token" in Held 0 / Slot 0.
- **Schritte:** 1. Sitz 1 gewinnt per Effekt 30 Gold (`engine.actionGainGold(1, 30)`). 2. Gold Trap annehmen, im Kreaturen-Prompt den Mummy Token wählen.
- **Erwartet** (Kartentext „choose any Creature on the board and add it to your hand"; Engine-Konvention Tokens verlassen das Brett nie als Karte, vgl. A05-02/A05-12): Token wird nicht angeboten bzw. verschwindet, in der Hand liegt keine Token-Karte.
- **Beobachtet:** Der Token wird als Ziel angeboten und „Mummy Token" liegt danach als normale Karte in der Hand von Sitz 0 (später spielbar/ablegbar).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/02-gold-trap-token-in-die-hand.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `gold-trap.js` Z. ~99 sammelt alle `engine.getCreatureTargets(p)` ohne Token-Filter; `_bounceCreatureToHand` → `engine.actionAddCardToHand(trapperIdx, cardName)` ohne Token-Sonderfall. (Mehrzonen-Kreaturen – Populated Island Turtle, Land Sharks – werden dagegen sauber vom Brett genommen, alle `_ZoneBlocked`-Zonen frei, `audit` leer.)

### R01-04 · Chasing the Legend legt einen Token („Mummy Token") als Karte in die Hand · Stufe B
- **Karten:** Chasing the Legend (`cards/effects/chasing-the-legend.js` `rettung()`), Engine `actionMoveCard`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Fireball auf der Hand; Sitz 1: Chasing the Legend auf der Hand (Summoning Magic 1 per `grantFor`), „Mummy Token" in Held 1 / Slot 0.
- **Schritte:** 1. Sitz 0 wirkt Fireball auf den Token. 2. Sitz 1 antwortet mit Chasing the Legend.
- **Erwartet** (Kartentext „Add that Creature to its owner's hand before the damage is applied"; Engine-Konvention Tokens werden nie zur Handkarte – `_enforceSupportZoneLock` schickt Tokens ins Deleted, der Ablage-Weg ebenfalls (`_engine.js` ~47686); gleiche Klasse wie A05-02/A05-12 und R01-02): Der Token verschwindet, die Hand bleibt token-frei.
- **Beobachtet:** „Mummy Token" liegt als normale Karte in der Hand von Sitz 1 (Kartenbilanz unverändert, `audit` leer).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/04-chasing-the-legend-token-in-die-hand.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionMoveCard(inst, 'hand', …)` (`_engine.js` ~13308) kennt die Token-Umleitung nur für „Ablage → Deleted"; `chasing-the-legend.js` ruft es ohne Token-Prüfung. Dieselbe Lücke betrifft jeden Bounce-Weg (Gold Trap → R01-02).
- **Gegenprobe (ohne Befund):** gewöhnliche Kreatur: wandert vor dem Schaden zur Hand des BESITZERS (auch bei gestohlener Kreatur: Besitzer Sitz 0, Kontrolle Sitz 1 → Hand von Sitz 0, egal wer reagiert); zweites Fireball-Ziel nimmt weiter Schaden; Held des Reagierenden gefroren → keine Reaktion.

### R01-05 · Divine Gift of Rain negiert die GANZE Karte, nicht nur die Wirkung auf die eigenen Ziele · Stufe B
- **Karten:** Divine Gift of Rain (`cards/effects/divine-gift-of-rain.js`); getestet mit Armageddon und Cataclysm (treffen beide Seiten)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 hat Armageddon („Deal 50 damage to all targets, including the user") bzw. Cataclysm, Sitz 1 Divine Gift of Rain (Magic Arts 2 per `grantFor`); auf beiden Seiten je eine Kreatur.
- **Schritte:** 1. Sitz 0 spielt Armageddon. 2. Sitz 1 antwortet mit Divine Gift of Rain.
- **Erwartet** (Kartentext „Negate any effects that card or effect would have on **targets you control**."; Vorbild im selben Fenster: Barrier of Faith / Glass Wall nutzen `grantEffectImmunity` nur für den eigenen Helden – gemessen: dort nimmt Sitz 0 weiter 50): Sitz 1 bleibt bei 800/800/800, die Ziele des Wirkers (Sitz 0) nehmen weiter 50 (750/750/750).
- **Beobachtet:** Beide Seiten bleiben bei 800/800/800, auch die Kreaturen beider Seiten sind unberührt – der Zauber des Gegners ist komplett negiert (ebenso bei Cataclysm).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/05-divine-gift-of-rain-negiert-auch-eigene-ziele-des-wirkers.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `divine-gift-of-rain.js` `postTargetResolve` liefert `{ effectNegated: true }` (Kopfkommentar: „Negates the effect entirely") statt `engine.grantEffectImmunity(pi, heroIdx, sourceCard)` je eigenem Ziel. Für Einzelziel-Zauber des Gegners (der Hauptfall) macht das keinen Unterschied; sichtbar wird es nur bei Karten, die beide Seiten treffen (Armageddon, Cataclysm, Heat Wave, Voodoo Curse …).

### R01-03 · Jumpscare betäubt nur Helden – Kreaturen werden als „any target on the board" nicht angeboten · Stufe B
- **Karten:** Jumpscare (`cards/effects/jumpscare.js`), Vergleich Thunderstruck Waflav (`thunderstruck-waflav.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1: verdeckt Jumpscare auf Held 0; je eine „ZZ Dummy"-Kreatur auf dem Brett von Sitz 0 und Sitz 1; Sitz 0 hat Fireball.
- **Schritte:** 1. Sitz 0 wirkt Fireball auf Held 0 von Sitz 1. 2. Jumpscare annehmen; nach der Auflösung öffnet sich die Zielwahl „Choose any target to Stun for 2 turns!".
- **Erwartet** (Kartentext „choose any target on the board and Stun it for 2 turns"; in diesem Spiel sind „targets" Helden UND Kreaturen; Waflav setzt denselben Wortlaut ausdrücklich für beide um, Kopfkommentar Z. 21-24, und Kreaturen sind betäubbar: `applyCreatureStatus(…, 'stunned')`, `stunnedDuration`): Die Kreaturen beider Seiten stehen unter den Zielen.
- **Beobachtet:** Es werden nur die 6 Helden angeboten; eine Kreatur lässt sich mit Jumpscare nie betäuben (`if (!picked || picked.type !== 'hero') return;`).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/03-jumpscare-nur-helden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `jumpscare.js` baut `allTargets` nur aus `eng.gs.players[…].heroes` (Z. ~52-62) und `onSurpriseActivate`/`execute` bricht bei `picked.type !== 'hero'` ab.
- **Gegenprobe (ohne Befund):** Das Betäuben der Helden dauert 2 Runden, Jumpscare feuert nicht bei eigenen Zauber auf den eigenen Helden und nicht bei Flächenschaden; stirbt der Träger am auslösenden Zauber, kommt das Betäuben trotzdem; wird der Zauber von einer anderen Surprise (Flooding) negiert, bleibt `_deferredSurprises` leer und es wird nicht betäubt.

### R01-06 · Divine Gift of Time reagiert nur auf Mill, Abwurf und Kreaturentod – nicht auf zerstörte Attachments oder ausgelöste Surprises · Stufe C
- **Karten:** Divine Gift of Time (`cards/effects/divine-gift-of-time.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 hält Divine Gift of Time + eine Füllkarte; (a) Mill 2, (b) ein Attachment (Curse) von Sitz 0 wird per `actionDestroyCard` zerstört, (c) eine verdeckte Booby Trap von Sitz 0 löst aus und geht in die Ablage.
- **Erwartet** (Kartentext „Play this card immediately when 1 or more cards are sent to your discard pile **from anywhere**. Add those cards to your hand instead."): Lesart A (wörtlich) – jeder Weg in die Ablage öffnet die Abfrage; Lesart B (Skript-Kopf: „Triggering paths covered: Mill, Discard, Creature death") – nur diese drei Wege.
- **Beobachtet:** (a) und der Kreaturentod öffnen die Abfrage „Use Divine Gift of Time …?" ✓. (b) zerstörtes Attachment und (c) ausgelöste Surprise: keine Abfrage, die Karte liegt in der Ablage, Time bleibt auf der Hand. Ebenso ohne Abfrage: gespielte Zauber (Fireball → Ablage) und zerstörte Ausrüstung (nicht gesondert getestet, gleicher Hook-Satz).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/06-divine-gift-of-time-deckt-nur-drei-wege-ab.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `divine-gift-of-time.js` hängt nur an `hooks.onMill`, `hooks.onDiscard`, `hooks.onCreatureDeath`; ein generischer Weg wäre der `onCardLeaveZone`-Hook (feuert laut CARD_API v925 für jede Karte) bzw. `actionMoveCard(…, 'discard')`.
- **Frage an Al:** Soll Divine Gift of Time auch dann zurückholen, wenn ein Attachment/eine Ausrüstung zerstört oder eine Surprise ausgelöst wird und in die Ablage geht (ja = „from anywhere" wörtlich / nein = nur Mill, Abwurf, Kreaturentod wie jetzt)?

### R01-07 · Divine Gift of the Guardian macht ALLE eigenen Kreaturen immun, nicht nur „those Creatures" · Stufe B
- **Karten:** Divine Gift of the Guardian (`cards/effects/divine-gift-of-the-guardian.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1: drei Kreaturen (Held 0/1/2) und Divine Gift of the Guardian auf der Hand; Sitz 0: zwei Fireball.
- **Schritte:** 1. Fireball auf die Kreatur an Held 0 → Sitz 1 reagiert. 2. Im selben Zug Fireball auf die Kreatur an Held 1.
- **Erwartet** (Kartentext „Play this card immediately when 1 or more Creatures you control would take damage. Negate any damage **those** Creatures would take until the beginning of your next turn."): Nur die Kreatur(en), die Schaden erleiden würden, sind bis zum Beginn des nächsten eigenen Zuges immun; der zweite Fireball auf eine andere Kreatur trifft (HP 50).
- **Beobachtet:** Alle drei Kreaturen bekommen `_guardianImmune`; der zweite Fireball prallt ab (HP 200).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/07-divine-gift-of-the-guardian-schuetzt-alle-kreaturen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `divine-gift-of-the-guardian.js` Z. ~139-175: die Schleife über `engine.cardInstances` stempelt `_guardianImmune`/`buffs.guardian` auf jede offene Creature des Spielers, nicht nur auf `myEntries`. Der Skriptkopf beschreibt „grants ALL the player's Creatures" ausdrücklich – möglicherweise ein Rest einer älteren Kartentext-Fassung.
- **Frage an Al:** Alle Kreaturen schützen (wie jetzt) oder nur die, die den Schaden erleiden würden?

### R01-08 · Dark Deal bietet sich bei Mr. Jiggles und Land Sharks nicht an (Zielwahl-Erkennung per Regex) · Stufe B
- **Karten:** Dark Deal (`cards/effects/dark-deal.js` `waehltZiel()`), Mr. Jiggles, Land Sharks
- **Voraussetzungen / Aufbau:** Sitz 0 hat die Kreatur (alt) auf dem Brett, Main Phase 1; Sitz 1 hat Dark Deal (Decay Magic 1 per `grantFor`), eine eigene Kreatur als Ziel.
- **Schritte:** 1. Sitz 0 aktiviert den Kreatureneffekt (`t.activateCreature`). Kontrolle: Gigantisaur Ankylos.
- **Erwartet** (Kartentext „Play this card immediately when your opponent activates the active effect of one of their Creatures that chooses a target"; Mr. Jiggles: „choose up to 2 targets your opponent controls and inflict 100 damage"; Land Sharks: „choose up to 1/2/3 targets on the board … deal 100 damage"): Sitz 1 bekommt in allen drei Fällen das Fenster „Dark Deal".
- **Beobachtet:** Ankylos ✓ (Prompt „Dark Deal"); bei Mr. Jiggles und Land Sharks gibt es kein Fenster, Dark Deal bleibt auf der Hand. (Ist das Fenster offen, verhält sich Dark Deal richtig: der Dark-Deal-Spieler zahlt die Kosten, wählt, und die Ziele sind die Karten des Aktivierers; `stolenBy` wird danach zurückgesetzt – gemessen mit Ankylos.)
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/08-dark-deal-erkennt-mr-jiggles-land-sharks-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dark-deal.js` `waehltZiel()`: `script.requiresTarget` oder die Regex `/prompt(Damage|Effect)?Target\s*\(|promptTarget\s*\(|promptZonePick|zonePick/` über den Skript-Quelltext. Beide Kreaturen wählen mit `promptMultiTarget(` (nicht erfasst) und tragen kein `requiresTarget`. Statischer Scan über alle Kreaturen mit `onCreatureEffect`: nur diese zwei (plus der Cardinal Beast Qinglong mit `promptChainTargets`, der ohnehin „unaffected by all cards and effects" ist) fallen heraus.

### R01-09 · Corpse Explosion reagiert nicht, wenn die Kreatur an Butterfly Cloud (Zauber mit Schadenstyp 'other') stirbt · Stufe B
- **Karten:** Corpse Explosion (`cards/effects/corpse-explosion.js` `defeatedByAttackOrSpell`), Butterfly Cloud (`butterfly-cloud.js:82`); Querverweis S01-03
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Butterfly Cloud bzw. Boiling Oil (Kontrolle) auf der Hand, eine eigene Kreatur; Sitz 1: Corpse Explosion (Destruction Magic 2 per `grantFor`), eine 10-HP-Kreatur.
- **Schritte:** 1. Sitz 0 wirkt den Flächenzauber, die 10-HP-Kreatur stirbt.
- **Erwartet** (Kartentext „Play this card immediately when a target is defeated by an Attack **or Spell**. Deal 50 damage to all targets the opponent of the defeated target controls."): Fenster „Corpse Explosion", Sitz 0 verliert 50 je Held.
- **Beobachtet:** Boiling Oil ✓ (750/750/750); bei Butterfly Cloud (Zauber, Schadenstyp `'other'`) kein Fenster, Sitz 0 bleibt bei 800. Das Skript erkennt „Spell" nur an `type === 'attack'` bzw. `type.includes('spell')`.
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/09-corpse-explosion-butterfly-cloud-typ-other.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Dieselbe Wurzel wie S01-03: `butterfly-cloud.js` (und die Haupt-Schadenswege von „The Seventh Circle of Hell", `victory-phoenix-cannon.js` 200 Eigenschaden) laufen mit Typ `'other'` statt `'<school>_spell'` – für Corpse Explosion zählt das nicht als Zauber. Die Behebung von S01-03 (Typ `'decay_spell'`/`'destruction_spell'` für den Zauberschaden) würde dieses Problem mit beheben; Fireshield/Anti Magic Shield sind nicht betroffen (sie prüfen Quelle bzw. Kartentyp).

### R01-10 · Flächen-Statuszauber ohne Schaden (Iceage, Poisoned Well, Medusa's Curse) öffnen kein Post-Target-Reaktionsfenster · Stufe B
- **Karten:** Iceage (`iceage.js`), Poisoned Well (`poisoned-well.js`), Medusa's Curse (`medusas-curse.js`) als Täter; betroffene Reaktionen: Divine Gift of Rain, Barrier of Faith, Anti Magic Shield (getestet), vermutlich jede `isPostTargetReaction` (Escape Device, Invisibility Cloak, Energy Aura …)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 spielt den Flächenzauber; Sitz 1 hält die Reaktionskarte (Held 0 mit Support Magic 3 / Magic Arts 3 für Barrier of Faith bzw. Anti Magic Shield).
- **Schritte:** 1. Iceage / Poisoned Well / Medusa's Curse spielen. 2. Kontrolle: Boiling Oil (Fläche MIT Schaden).
- **Erwartet** (Kartentexte: Divine Gift of Rain „… when one or more targets you control would be affected by an opponent's card or effect"; Barrier of Faith „… when a Hero you control would be affected by a card or effect"; Anti Magic Shield „… hit by an opponent's Spell"; CARD_API-Kommentar `preDamageMultiTargetWindow` ~Z. 35563: Karten mit eigener Zielschleife MÜSSEN das Fenster vor der Schleife öffnen): Das Reaktionsfenster geht bei allen vier Zaubern auf.
- **Beobachtet:** Boiling Oil: in allen drei Reaktionen ✓. Iceage, Poisoned Well und Medusa's Curse: **kein** Fenster, alle drei Helden sind eingefroren / vergiftet / betäubt, die Reaktionskarte bleibt auf der Hand (9 von 9 Kombinationen ✗).
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/10-flaechen-statuszauber-ohne-post-target-fenster.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die drei Zauber laufen über eine eigene Schleife (`einfrieren()`/`addHeroStatus`) ohne `engine.preDamageMultiTargetWindow(source, targets, opts)` und ohne `actionAoeHit`; statische Suche nach weiteren Flächenkarten ohne Fenster-Aufruf: u. a. auch Smoke Vial (Trank), Anti Magic Zone, Trial of Dominance, Cute Conversion (nicht einzeln getestet).

### R01-11 · Ein Berserk-Held löst weiter Surprises aus und spielt Hand-Reaktionen, obwohl er „cannot use any Spells" · Stufe B
- **Karten:** Berserk (`cards/effects/berserk.js`, Status `berserked`); Engine `_canHeroActivateSurprise` (`_engine.js` ~Z. 36636); gleiche Lücke beim Status `nulled` (Null Zone)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1: Held 0 (Magic Arts 3, Destruction Magic 1) trägt Berserk (Anhang + Status `berserked`), in seiner Surprise Zone liegt verdeckt Booby Trap, Anti Magic Shield auf der Hand; Sitz 0 hat Fireball.
- **Schritte:** 1. Sitz 0 wirkt Fireball auf diesen Helden. (Kontrolle: derselbe Aufbau mit `magic_silenced`.)
- **Erwartet** (Kartentext „The Hero this Spell is attached to cannot use any Spells or summon Creatures"; Engine-Regel v880 im Kommentar von `_canHeroActivateSurprise`: „SPELL-SPERREN GELTEN AUCH HIER … Surprises und Hand-Reaktionen sind Spells"): Kein Surprise-Fenster, keine Hand-Reaktion; Fireball trifft (650), Sitz 0 bleibt bei 800.
- **Beobachtet:** `magic_silenced` ✓ (kein Prompt). `berserked` (und `nulled`): Booby Trap löst aus (Angreifer 700) und Anti Magic Shield negiert den Fireball (Held 800) – der gesperrte Held zaubert weiter.
- **Repro:** `docs/niche-tests/repro/R01-reaction-area-attach-surprise/11-berserk-held-reagiert-mit-surprise-und-reaktion.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_canHeroActivateSurprise` prüft für Spell-Karten nur `hero.statuses.magic_silenced || frightened` (Z. ~36672); `validateActionPlay` sperrt Spells zusätzlich für `nulled` (Z. ~20763) und `berserked` (Z. ~20801) – die beiden fehlen im Surprise-/Reaktions-Gate.
- **Gegenprobe (ohne Befund):** Berserk-Held kann im Zug weder Spells noch Kreaturen spielen; Attack #1 zählt als zusätzliche Aktion (`_actionsPlayedThisPhase` bleibt 0), Attack #2 verbraucht die normale Aktion, Attack #3 wird abgelehnt (max 2).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Ambush the Scout | L0 gelesen | noch nicht bearbeitet |
| Anti Magic | L0 gelesen | noch nicht bearbeitet |
| Anti Magic Shield | L0 gelesen | noch nicht bearbeitet |
| Barrier of Faith | L0 gelesen | noch nicht bearbeitet |
| Barrier of Undying | L0 gelesen | noch nicht bearbeitet |
| Berserk | L0 gelesen | noch nicht bearbeitet |
| Booby Trap | L0 gelesen | noch nicht bearbeitet |
| Call of the Deepsea | L0 gelesen | noch nicht bearbeitet |
| Chasing the Legend | L0 gelesen | noch nicht bearbeitet |
| Core Explosion | L0 gelesen | noch nicht bearbeitet |
| Corpse Explosion | L0 gelesen | noch nicht bearbeitet |
| Cottage at the Forest's Edge | L0 gelesen | noch nicht bearbeitet |
| Crushing Defeat | L0 gelesen | noch nicht bearbeitet |
| Cure | L0 gelesen | noch nicht bearbeitet |
| Curse | L0 gelesen | noch nicht bearbeitet |
| Dark Deal | L0 gelesen | noch nicht bearbeitet |
| Dark Ocean | L0 gelesen | noch nicht bearbeitet |
| Decisive Defeat | L0 gelesen | noch nicht bearbeitet |
| Defending the Gate | L0 gelesen | noch nicht bearbeitet |
| Dichotomy of Luna and Tempeste | L0 gelesen | noch nicht bearbeitet |
| Dive Down | L0 gelesen | noch nicht bearbeitet |
| Divine Awakening | L0 gelesen | noch nicht bearbeitet |
| Divine Gift of Edge | L0 gelesen | noch nicht bearbeitet |
| Divine Gift of Rain | L0 gelesen | noch nicht bearbeitet |
| Divine Gift of the Guardian | L0 gelesen | noch nicht bearbeitet |
| Divine Gift of Time | L0 gelesen | noch nicht bearbeitet |
| Divine Punishment | L0 gelesen | noch nicht bearbeitet |
| Emergency Spell Armor | L0 gelesen | noch nicht bearbeitet |
| Energy Aura | L0 gelesen | noch nicht bearbeitet |
| Fireshield | L0 gelesen | noch nicht bearbeitet |
| Firewall | L0 gelesen | noch nicht bearbeitet |
| Flooding | L0 gelesen | noch nicht bearbeitet |
| Forbidden Curse of Aging | L0 gelesen | noch nicht bearbeitet |
| Frost Rune | L0 gelesen | noch nicht bearbeitet |
| Furious Anger | L0 gelesen | noch nicht bearbeitet |
| Gathering Storm | L0 gelesen | noch nicht bearbeitet |
| Glass Wall | L0 gelesen | noch nicht bearbeitet |
| Gold Trap | L0 gelesen | noch nicht bearbeitet |
| Graveyard of Limited Power | L0 gelesen | noch nicht bearbeitet |
| Guardian Angel | L0 gelesen | noch nicht bearbeitet |
| Idej Projection | L0 gelesen | noch nicht bearbeitet |
| Intrude | L0 gelesen | noch nicht bearbeitet |
| Invisibility | L0 gelesen | noch nicht bearbeitet |
| Jumpscare | L0 gelesen | noch nicht bearbeitet |

## Getestet & in Ordnung (Auswahl)
