# N1-reaktionen-a – Nischenfall-Bericht (Welle 23, Tiefentest)
Stand/Autor: Agent N1-reaktionen-a, 20.10.2026 (Basis 3ebcbee, Zweig `wave23/W23a`). Karten: 22 in der Liste (Reaktionen / Areas / Attachments / Surprises, bisher L0) · 22 gezielt getestet (L2) · 16 Befunde (1 A · 10 B · 5 C) an 16 der 22 Karten. Es wurde nichts gefixt; alle Befunde haben ein ausgeführtes Repro (Exit 1 + „✗“ = Fehler tritt auf, jeweils mit Gegenprobe).

## Zusammenfassung
16 belegte Befunde (1 × A, 10 × B, 5 × C), jeder mit ausgeführtem Repro und Gegenprobe (`docs/niche-tests/repro/N1-reaktionen-a/01…16`; Exit 1 + „✗" = Fehler tritt auf). Dauerfeuer (`lib/barrage.js`) für alle 22 Karten, beide Sitze: keine verschluckten Engine-Fehler, keine Hänger, keine Zustandsauffälligkeiten.
Die Reaktions-/Surprise-Fenster selbst (Auslösen bei Flächen-/Mehrfachtreffern, Selbst-/Statusschaden, Reihenfolge mehrerer Surprises, Host-Held gefroren/betäubt/tot, Abbruch/HOPT) verhalten sich sauber; die Fehler sitzen an den **Rändern**: Zustand beim Wegzug des Trägers (Curse), Kontrolle statt Seite (Corpse Explosion, Cottage, Anhänge), Handsammlungen mit eigener Zählung statt Engine-Helfer (Anti Magic Shield, Cure, Curse), Direktschreiber am Status vorbei (Decisive Defeat) und Ketten mit Doppelkopien (Dark Deal).

**Die 5 wichtigsten:**
1. **N1-01 (A)** Curse: Stirbt der Träger, bleibt der ATK-Wert nach der Wiederbelebung dauerhaft 0 (Statusreset vor dem Abfall-Hook).
2. **N1-04 (B)** Corpse Explosion trifft bei einem übernommenen gefallenen Helden die eigenen Helden des Spielers (Brettseite statt Kontrolleur).
3. **N1-08 (B)** Barrier of Faith „negiert" Decisive Defeat nicht (Status liegt trotzdem), Curse/Berserk bleiben als tote Karten hängen.
4. **N1-07 (B)** Cottage: der Besitzer (nicht der Kontrolleur) belebt einen abgegebenen Ascended Hero wieder – Gegenstück zum W22-Ruling „Hero you control".
5. **N1-05 (B)** Corpse Explosion reagiert nicht auf direktes Besiegen durch Attack/Spell (Trial of Dominance, Goldify) – Core Explosion/Crushing Defeat tun es.

**Bewusst nicht getestet:** Hand-Reaktionen über kontrollierte Helden, Schulprüfung des Wirkers, Rain/Guardian/Time/Unwanted Audience (W15/19/20/21 – nur gemeldet, was dort nicht steht); Telekinesis-Modus von Booby Trap; Cottage mit zwei Areas gleichen Namens; Ambush the Scout gegen unimplementierte Karten (Secret Entrance, I Found You!, At the Source of the Light, Vampire on Fire, Control Monitors haben kein Skript); 3-/4-Sitz-Partien; Pillar of Light gegen Ambush (Ambush-Fenster öffnet sich nicht, wenn der Gegner eine Karte per eigener Suche auf die Hand nimmt – als mögliche Regelfrage notiert, nicht belegt).

## Befunde

### N1-01 · Curse: stirbt der Träger, bleibt sein Attack-Wert nach der Wiederbelebung auf 0 · Stufe A
- **Karten:** Curse (`cards/effects/curse.js`), Engine `handleHeroDeathCleanup`
- **Voraussetzungen / Aufbau:** Seed 1234; Held 1:0 hat ATK 60; Sitz 0 legt Curse an (ATK 0, `_cursedAtkSuppressed` 60); Held wird mit einem Angriff besiegt (900 Schaden) und per `actionReviveHero` mit 300 HP wiederbelebt.
- **Schritte:** 1. Curse an Held 1:0. 2. Held besiegen (die Karte geht in die Ablage von Sitz 0, alle Status werden gelöscht). 3. Held wiederbeleben.
- **Erwartet** (Kartentext „While this card is attached to a Hero, its Attack stat is always 0"): Nach dem Wegfall der Karte hat der Held wieder seine 60 ATK (Gegenprobe: Curse wird per Anti Magic abgeworfen → ATK wieder 60; Tod + Wiederbelebung ohne Curse → ATK 60).
- **Beobachtet:** ATK bleibt 0, `hero._cursedAtkSuppressed` bleibt mit 60 liegen. Die Karte liegt längst in der Ablage, der Held ist dauerhaft entwaffnet.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/01-curse-heldentod-atk-bleibt-null.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:50660` `handleHeroDeathCleanup` leert zuerst `hero.statuses` (Z. ~50665) und feuert danach `onCardLeaveZone` der Anhänge; der „Last-copy safety"-Zweig `curse.js:399` (`if (hero.statuses?.cursed)`) findet den Status nicht mehr und stellt die ATK nicht zurück.

### N1-02 · Berserk-Held „cannot … summon Creatures", doch Effekt-Beschwörungen (Call of the Deepsea & Co.) setzen eine Kreatur in seine Zone · Stufe B
- **Karten:** Berserk (`berserk.js`), Call of the Deepsea (`call-of-the-deepsea.js`), `_summon-eligibility.js` (`canHeroSummon`; gleiche Prüfung nutzen Albrecht, Ellie, die Monkees, Green Dragoneer, Golden Ladybug, `_of-kings-shared`)
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 mit Berserk (Anhang + Status `berserked`) und einer Kreatur in Zone 0; Call of the Deepsea liegt an Held 1; auf der Hand eine Kreatur. Die Kreatur wird besiegt.
- **Schritte:** 1. Kreatur im Support des Berserk-Helden besiegen. 2. Call of the Deepsea bietet „delete it and summon … into the same Support Zone as an additional Action" an, Ja.
- **Erwartet** (Kartentext Berserk: „cannot use any Spells or summon Creatures"; Ruling `_summon-eligibility.js` 8.8.: „‚summon as an additional Action' ist eine ganz normale Beschwörung … ein tauglicher Caster ist Pflicht"): kein Angebot, die Zone bleibt leer (wie bei Frozen/Stunned – Gegenprobe ✓; der normale Spielweg lehnt das Beschwören durch den Berserk-Helden ebenfalls ab – Gegenprobe ✓).
- **Beobachtet:** Das Angebot kommt, die Kreatur steht danach in der Zone des Berserk-Helden.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/02-berserk-held-beschwoert-per-effekt.js`
- **Vermutete Ursache:** `_summon-eligibility.js:76` `canHeroSummon` prüft `frozen/stunned/webbed/bound`, nicht `berserked` (`validateActionPlay` kennt den Status nur im Hand-Weg).

### N1-03 · Dark Deal: zwei Kopien in derselben Kette – die Kreatur bleibt bis Zugende unter der Kontrolle des Dark-Deal-Spielers · Stufe B
- **Karten:** Dark Deal (`dark-deal.js`, `engine.beendeDarkDeal`)
- **Voraussetzungen / Aufbau:** Sitz 0 aktiviert Burning Skeleton (wählt ein Ziel); Sitz 1 hält zwei Dark Deal und spielt beide in die Kette (Policy „ja").
- **Schritte:** 1. Skelett aktivieren. 2. Beide Dark Deal bestätigen.
- **Erwartet** (Kartentext „For that moment only, the Creature is treated as being controlled by you"): nach dem Effekt ist `stolenBy` leer, Kontrolleur wieder Sitz 0 (Gegenprobe mit einer Kopie ✓).
- **Beobachtet:** `stolenBy` bleibt 1, `engine.effektiveSeiten(inst)` meldet Kontrolleur 1 – bis der Rückgabelauf für vorübergehenden Diebstahl am Zugende aufräumt. Die zuerst gelegte Kopie löst als zweite auf und merkt sich das vom ersten Lauf gesetzte `stolenBy = 1` als „Vorher".
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/03-dark-deal-zwei-kopien-kontrolle-bleibt.js`
- **Vermutete Ursache:** `dark-deal.js:81` `resolve` setzt `inst._darkDealVorher = inst.stolenBy ?? null` ohne Prüfung, ob `_darkDealVon` schon gesetzt ist; `engine.beendeDarkDeal` (`_engine.js:3841`) stellt dann `stolenBy = 1` wieder her.

### N1-04 · Corpse Explosion richtet sich nach der Brettseite des Gefallenen, nicht nach seinem Kontrolleur – trifft bei übernommenem Helden die eigenen Helden · Stufe B
- **Karten:** Corpse Explosion (`corpse-explosion.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 besitzt Corpse Explosion (Destruction Magic 2) und hat Held 1:0 dauerhaft übernommen (`actionTakeHeroPermanently`, 100 HP); Sitz 1 beschießt ihn mit 200 Schaden (destruction_spell).
- **Schritte:** 1. Der übernommene Held fällt. 2. Sitz 0 spielt Corpse Explosion.
- **Erwartet** (Kartentext „Deal 50 damage to all targets the opponent of the defeated target controls"; „Kontrolle statt Seite", Styx 28.9.; W19–W22): der Gegner des gefallenen Ziels (kontrolliert von Sitz 0) ist Sitz 1 → die übrigen Helden von Sitz 1 verlieren je 50, Sitz 0 bleibt bei 800. (Gegenprobe ohne Übernahme: korrekt; der Kreaturenzweig nutzt `controller ?? owner`.)
- **Beobachtet:** Sitz 1 bleibt bei 800/800, **Sitz 0 verliert an allen drei Helden 50** (er schlägt sich selbst).
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/04-corpse-explosion-uebernommener-held-richtung.js`
- **Vermutete Ursache:** `corpse-explosion.js:117` `afterDamageResolve`: `defeatedControllerSide = players.findIndex(p => p.heroes.includes(target))` = physische Spalte statt `engine.heroSideOf(...)`.

### N1-05 · Corpse Explosion reagiert nicht, wenn eine Attack/ein Spell ein Ziel direkt „besiegt" (ohne Schaden) · Stufe B
- **Karten:** Corpse Explosion; Auslöser: Trial of Dominance, Goldify (ebenso Hand of Death u. ä.)
- **Voraussetzungen / Aufbau:** Sitz 1 hält Corpse Explosion, hat eine 10-HP-Kreatur; Sitz 0 wirkt Trial of Dominance („Defeat all Creatures your opponent controls") bzw. Goldify („Choose a Creature and defeat it").
- **Erwartet** (Kartentext „Play this card immediately when a target is defeated by an Attack or Spell"): Fenster, Sitz 0 verliert 50 je Held – wie bei Tod durch Schaden (Gegenprobe Boiling Oil ✓). Core Explosion und Crushing Defeat melden „Besiegen ohne Schaden" ausdrücklich (Ruling 23.9.).
- **Beobachtet:** Kein Fenster, kein Schaden (Kreatur ist tot). (Midnight Assault bewusst nicht als Beleg genutzt: „Your opponent cannot react to this Attack".)
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/05-corpse-explosion-besiegen-ohne-schaden.js`
- **Vermutete Ursache:** `corpse-explosion.js` hängt nur an `isAfterDamageReaction` / `isAfterCreatureDamageReaction` (`defeatedByAttackOrSpell(type)` auf dem Schadenstyp); Spell-/Attack-Niederlagen ohne Schadenseintrag laufen über das Defeated-Fenster (`isCreatureDefeatedReaction` wie bei Core Explosion), das Corpse Explosion nicht nutzt.

### N1-06 · Cure ist im eigenen Zug nicht spielbar, wenn das einzige Ziel mit negativem Status eine Kreatur ist · Stufe B
- **Karten:** Cure (`cure.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 (Support Magic 1) hält Cure; auf dem Brett von Sitz 1 steht eine gefrorene bzw. vergiftete Kreatur, kein Held hat einen Status.
- **Erwartet** (Kartentext „Choose any target on the board, except the user, and heal it from all negative status effects"; Skript kennt Kreaturen in `getValidTargets`/`onPlay`): Cure spielbar, Status der Kreatur weg, +100 HP je entferntem Status. Gegenprobe: gefrorener Held als Ziel → spielbar ✓.
- **Beobachtet:** `t.play` → false, Karte bleibt auf der Hand; die Zielwahl öffnet nie. (Der Reaktionsweg im Gegnerzug bietet Kreaturen an.)
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/06-cure-proaktiv-nur-kreatur-als-ziel.js`
- **Vermutete Ursache:** `cure.js:164` `spellPlayCondition` prüft nur `hero.statuses` auf heilbare Status.

### N1-07 · Cottage at the Forest's Edge: der Besitzer belebt einen abgegebenen Ascended Hero wieder, der Kontrolleur nicht · Stufe B
- **Karten:** Cottage at the Forest's Edge (`cottage-at-the-forest-s-edge.js`)
- **Voraussetzungen / Aufbau:** Cottage liegt im Spiel; Sitz 0 besitzt einen gefallenen Ascended Hero in 0:0, den Sitz 1 dauerhaft übernommen hat.
- **Erwartet** (Kartentext „both players may once per turn choose one of **their** Ascended Heroes and revive it"; Ruling Welle 22 „Hero you control: nur der aktuelle Kontrolleur"): Sitz 1 (Kontrolleur) kann den Helden in seinem Zug wiederbeleben, Sitz 0 nicht.
- **Beobachtet:** genau umgekehrt – Sitz 0 belebt ihn wieder (100 HP), Sitz 1 sieht kein Ziel (`activateAreaEffect` → false). Gegenprobe ohne Übernahme: Besitzer belebt den eigenen Ascended Hero ✓.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/07-cottage-abgegebener-held-kontrolleur.js`
- **Vermutete Ursache:** `cottage-at-the-forest-s-edge.js:54` `revivableHeroes` liest nur `gs.players[activator].heroes` (physische Spalte), nicht `engine.heroesControlledBy`.

### N1-08 · Barrier of Faith negiert Anhänge-Zauber nur halb: Decisive Defeat wirkt trotzdem, Curse/Berserk bleiben als tote Karten am Helden · Stufe B
- **Karten:** Barrier of Faith (`barrier-of-faith.js`, `engine.grantEffectImmunity`), Decisive Defeat (`decisive-defeat.js`), Curse, Berserk
- **Voraussetzungen / Aufbau:** Sitz 1 hält Barrier of Faith, Held 1:0 hat Support Magic 3 (kostet 1 Ability) und Fighting 2; Sitz 0 wirkt Decisive Defeat / Curse / Berserk auf diesen Helden.
- **Erwartet** (Kartentext „negate any effects that card or effect would have on the Hero"): Held trägt keinen Status `negated`/`cursed`/`berserked`, die Karte hängt nicht am Helden (Gegenprobe: Anti Magic Shield lässt alle drei vollständig verpuffen ✓).
- **Beobachtet:** Decisive Defeat: Status `negated` liegt trotz Barrier am Helden (Karte hängt auch an). Curse/Berserk: Status wird abgewehrt, aber die Karten stecken in der Support Zone des Helden (wirkungslos, belegen eine Zone). Die Ability wurde bezahlt.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/08-barrier-of-faith-anhaenge-wirken-oder-haengen-trotzdem.js`
- **Vermutete Ursache:** `decisive-defeat.js:121` schreibt `wirt.statuses.negated` direkt (an `addHeroStatus` und damit an der Effekt-Immunität vorbei); Curse/Berserk legen die Karte vor dem Status-Aufruf an (`placeAttachment`) und prüfen die Immunität nicht dafür.

### N1-09 · Decisive Defeat: eine zweite, befristete Negierung überschreibt den Eintrag der Karte; läuft sie ab, wird die Karte verworfen · Stufe B
- **Karten:** Decisive Defeat (`decisive-defeat.js`, `anhaengselStatusHooks`)
- **Voraussetzungen / Aufbau:** Decisive Defeat an Held 1:0 (`negated` mit `permanent` / `_fromAttachment`); danach `addHeroStatus('negated', {duration: 1})` einer anderen Quelle (so setzen Null, Crusader's Hookshot, Locke, Sparky Slime ihn).
- **Erwartet** (Kartentext „While this card is attached to a Hero, that Hero's effect is negated"): die befristete Negierung läuft für sich ab; Decisive Defeat bleibt am Helden, der Held bleibt negiert (Gegenprobe: ohne Zweitnegierung bleibt die Karte über 4 Zugwechsel ✓).
- **Beobachtet:** Der Statuseintrag wird durch den befristeten ersetzt; nach Ablauf verschwindet der Status, und Decisive Defeat wird – ohne Heilung – in die Ablage gelegt („Anhängsel folgen ihrem Status"). Umgekehrt (Teil 2): trägt der Held schon eine befristete fremde Negierung (Dauer 3), löscht das Zerstören der Karte den `negated`-Eintrag ganz, obwohl die fremde Negierung noch liefe.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/09-decisive-defeat-zweite-negierung-ueberschreibt.js`
- **Vermutete Ursache:** Es gibt genau EINEN `negated`-Eintrag je Held ohne Quellenliste; `decisive-defeat.js:121` überschreibt, `addHeroStatus` ersetzt; der Anhänge-Hook koppelt die Karte an das Vorhandensein des Eintrags.

### N1-10 · Curse: „afflicted by at least 1 status effect" ignoriert den Status der Null Zone (`nulled`) · Stufe B
- **Karten:** Curse (`curse.js`), Null Zone („This counts as a status effect")
- **Voraussetzungen / Aufbau:** Sitz 0 spielt Curse in der Main Phase 1 (dort nur als inhärente Zusatzaktion spielbar) auf Held 1:0 mit Status X.
- **Erwartet** (Kartentext „If the target is afflicted by at least 1 status effect and does not have a Spell attached to it, this counts as an additional Action"; Null Zone: „This counts as a status effect"): X = `frozen` (Gegenprobe) und X = `nulled` → spielbar; X = keiner → nicht spielbar ✓.
- **Beobachtet:** `nulled` → abgelehnt, Karte bleibt auf der Hand (auch `soul_transmitted` fällt heraus).
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/10-curse-zusatzaktion-null-zone-status.js`
- **Vermutete Ursache:** `curse.js:82` `_heroQualifiesForCurse` nutzt `getCleansableStatuses()` (nur heilbare Status; `nulled` hat `cleansable: false`, `_hooks.js:310`).

### N1-11 · „Attach this Spell to a Hero you control": Divine Awakening / Call of the Deepsea bieten abgegebene eigene Helden an, Divine Awakening schließt übernommene Gegnerhelden aus · Stufe C
- **Karten:** Divine Awakening (`divine-awakening.js`), Call of the Deepsea (`call-of-the-deepsea.js`), `candidateHosts` (`_attachment-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 hat Fern, the Ship Slave (hat eine Ascended-Form) in 0:0 – dauerhaft an Sitz 1 abgegeben (`actionTakeHeroPermanently(1,0,0)`) bzw. Sitz 0 hat einen Fern von Sitz 1 übernommen.
- **Erwartet** (Ruling Welle 22 „Hero you control: nur der aktuelle Kontrolleur"): der abgegebene 0:0 ist kein Wirt; der übernommene 1:0 ist ein Wirt (Divine Awakening: hat Ascended-Form).
- **Beobachtet:** Der abgegebene Held 0:0 wird bei beiden Karten als Wirt (Drop-Ziel) angeboten und nimmt die Karte auf; Divine Awakening bietet den übernommenen Helden 1:0 nicht an (`heroFilter … side === pi`), Call of the Deepsea schon.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/11-anhaenge-hero-you-control-abgegebener-held.js`
- **Vermutete Ursache:** `_attachment-shared.js:72` `candidateHosts` nimmt ohne `opts.sides` die komplette physische Eigenspalte (auch Helden, die der Gegner kontrolliert); `divine-awakening.js:115/145` filtern hart auf `side === pi`.
- **Frage an Al:** Soll „Attach … to a Hero you control" (Divine Awakening, Call of the Deepsea und alle Anhänge mit diesem Wortlaut) wie bei den W22-Karten nur den aktuellen Kontrolleur zulassen – also einen an den Gegner abgegebenen eigenen Helden NICHT mehr als Wirt anbieten und einen von mir übernommenen Gegnerhelden anbieten (heute: umgekehrt bzw. gemischt)? Heutiges Verhalten: Eigenspalte komplett (inkl. Abgegebene), bei Divine Awakening übernommene Helden ausgeschlossen. Die Q9-Aussage („Attachments per Effekt können alle eigenen Heroes betreffen") spräche für die heutige Lesart.

### N1-12 · Dark Ocean sperrt Surprises nicht: Booby Trap löst gegen den Effekt einer gegnerischen Kreatur aus und negiert ihn · Stufe C
- **Karten:** Dark Ocean (`dark-ocean.js`, `darkOceanBlocksReaction`), Booby Trap (`booby-trap.js`); Engine `_checkSurpriseWindow`
- **Voraussetzungen / Aufbau:** Dark Ocean liegt; Sitz 1 hat Booby Trap verdeckt an Held 1:0; Sitz 0 aktiviert Burning Skeleton (50 HP) auf Held 1:0.
- **Erwartet** (Kartentext „neither player can react to or negate the effects of their opponent's Creatures"; Ruling 5.8.: Sperre hängt an jedem Hand-Reaktionsfenster einzeln): Lesart A – auch Surprises sind „react to"/„negate" und gesperrt: kein Fenster, Held 1:0 verbrannt. Lesart B – nur Hand-/Ketten-Reaktionen: Surprise löst aus.
- **Beobachtet:** Booby Trap löst aus, tötet das Skelett, negiert den Effekt (Held nicht verbrannt) – wie ohne Dark Ocean.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/12-dark-ocean-surprise-gegen-kreatureneffekt.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** `darkOceanBlocksReaction` hängt an den Hand-Fenstern (`_engine.js:13585 … 40169`), nicht an `_checkSurpriseWindow` (`_engine.js:37082`).
- **Frage an Al:** Sollen Surprises (z. B. Booby Trap, Spike Trap) unter Dark Ocean nicht gegen Effekte gegnerischer Kreaturen auslösen dürfen – ja (sperren wie Hand-Reaktionen) oder nein (Surprises sind keine „Reaktionen" im Sinne der Karte)?

### N1-13 · Core Explosion / Crushing Defeat: Tod durch Burn-/Gift-Tick eines vom Gegner aufgelegten Status wird nicht als „by an opponent's card or effect" gemeldet · Stufe C
- **Karten:** Core Explosion (`core-explosion.js`), Crushing Defeat (`crushing-defeat.js`); Engine `processBurnDamage` / `_vermerkeNiederlage` (ebenso Rewrite History `_rewriteProtokoll`)
- **Voraussetzungen / Aufbau:** Sitz 1 hält die Reaktion, hat eine 10-HP-Kreatur (Level 2, Core Explosion) mit Burn bzw. Gift, aufgelegt von Sitz 0 (`applyCreatureStatus(…, {sourceOwner: 0})`; Zähler `burnAppliedBy` / `poisonAppliedBy` = 0). Der Tick am Zugbeginn von Sitz 1 tötet sie.
- **Erwartet** (Kopfkommentar `core-explosion.js`: „Ohne bekannte Quelle (Status-Ticks ohne Verursacher) kein Angebot" – das liest sich so, dass ein Tick MIT bekanntem Verursacher zählt): Lesart A – der Gegner hat den Status aufgelegt, der Tod geht auf seine Karte zurück → Fenster. Lesart B – ein Tick ist keine direkte Karten-/Effektwirkung → kein Fenster.
- **Beobachtet:** In allen vier Fällen (Core Explosion / Crushing Defeat × Burn / Gift) kein Fenster. Der Tick-Eintrag trägt `source: { name: 'Burn' }` ohne `owner`; der Verursacher steht nur im Nebenfeld `sourceOwner` des Batch-Eintrags, das `quellSeite(source)` nicht liest.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/13-core-explosion-status-tick-mit-bekanntem-verursacher.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** `_engine.js` ~Z. 50485 (`source: { name: 'Burn' }, sourceOwner: inst.counters.burnAppliedBy`) gibt den Verursacher nicht an `hookCtx.source` weiter.
- **Frage an Al:** Soll ein Kreaturentod durch Burn/Gift, den der Gegner aufgelegt hat, für Core Explosion und Crushing Defeat als „defeated by an opponent's card or effect" zählen – ja oder nein?

### N1-14 · Dichotomy of Luna and Tempeste: „cannot be reduced further" sperrt eine Vor-Schaden-Surprise (Aquatic Shield −100) nicht · Stufe C
- **Karten:** Dichotomy of Luna and Tempeste (`dichotomy-of-luna-and-tempeste.js`), Aquatic Shield (`aquatic-shield.js`)
- **Voraussetzungen / Aufbau:** Held 1:0 ist Burned, Dichotomy liegt an Held 1:1 (Sitz 1), Aquatic Shield verdeckt an Held 1:0; Sitz 0 trifft Held 1:0 mit 200 Schaden (Typ attack).
- **Erwartet** (Kartentext „take half damage … but damage they take cannot be reduced further"): Lesart A – nach der Halbierung keine weitere Reduktion → 100 (so verhält sich Stoneskin −80 in der Gegenprobe: 100). Lesart B – Reihenfolge der Fenster: Surprise zuerst (−100 → 100), dann Halbierung → 50.
- **Beobachtet:** 50. Aquatic Shield wirkt im Vor-Schaden-Fenster VOR den `beforeDamage`-Hooks, die Dichotomys Sperre (`lockReduction`) erst danach setzen; „Echter Schaden läuft an diesem Fenster vorbei" greift nur bei schon gesetztem `cannotBeReduced`.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/14-dichotomy-reduktion-vor-dem-schloss.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** Reihenfolge in `_actionDealDamageImpl` (Surprise-/Hand-Fenster vor `beforeDamage`); `dichotomy-of-luna-and-tempeste.js` `beforeDamage` setzt Halbierung + Sperre zu spät für Fenster-Reduktionen.
- **Frage an Al:** Soll Dichotomy auch Reduktionen aus Vor-Schaden-Surprises/-Reaktionen (Aquatic Shield, Mischief Militia Banner Bearer) für Burned-Ziele verhindern – ja oder nein?

### N1-15 · Anti Magic Shield: die Stufenprüfung zählt Magic Arts in Support Zones (Xal) nicht mit · Stufe B
- **Karten:** Anti Magic Shield (`anti-magic-shield.js`), Xal, the Animated Armor
- **Voraussetzungen / Aufbau:** Sitz 1: Xal mit Magic Arts 2 als Ability-Stapel in einer Support Zone (Gegenprobe: dieselben 2 Magic Arts in den Ability-Zonen); Anti Magic Shield auf der Hand; Sitz 0 wirkt Fire Bolts (Level 1).
- **Erwartet** (Kartentext „If that Spell's level is not higher than the user's Magic Arts level, negate it"; Engine: `effectiveSchoolLevelForCaster` zählt Support-Zonen-Abilities, `heroMeetsLevelReq` ebenso): Xal wirkt AMS und negiert den Level-1-Zauber.
- **Beobachtet:** Support-Zonen-Variante: `_canHeroActivateSurprise` und `effectiveSchoolLevelForCaster` (=2) sagen „ja", die Reaktion wird aber nie angeboten, Fire Bolts trifft (700). Ability-Zonen-Variante ✓.
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/15-anti-magic-shield-zaehlt-support-abilities-nicht.js`
- **Vermutete Ursache:** `anti-magic-shield.js:62` zählt `maLevel` selbst aus `abilityZones` (+Performance) statt `engine.effectiveSchoolLevelForCaster('Magic Arts', …)` (das auch Xal-Stapel, geliehene Zonen und die Negations-Blankung kennt).

### N1-16 · „Cannot use any Spells" (Berserk, Howling in the Night, Null Zone): der gesperrte Held kann trotzdem eine Surprise verdeckt setzen · Stufe C
- **Karten:** Berserk (`berserk.js`), Booby Trap (als Beispiel-Surprise); Engine/Server `doPlaySurprise` (server.js ~Z. 11774)
- **Voraussetzungen / Aufbau:** Sitz 0, Main Phase 1, Hand [Booby Trap]; Held 0 trägt `berserked` (bzw. `magic_silenced` / `nulled`).
- **Erwartet** (Kartentext Berserk „cannot use any Spells"; Engine-Regel v880: „Surprises und Hand-Reaktionen sind Spells", dort für das Aktivieren): Lesart A – auch das Ausspielen (verdeckt Setzen) einer Surprise ist „einen Spell benutzen" → abgelehnt, Karte bleibt auf der Hand; Lesart B – nur Wirken/Aktivieren ist gesperrt, das Legen ist keine Benutzung (heutiges Verhalten; auch frozen/stunned/negated/webbed Helden können Surprises ansetzen).
- **Beobachtet:** Die Surprise wird gesetzt, während derselbe Held Fireball, Dark Ocean, Anti Magic und Cure nicht spielen darf (Kontrolle ✓). Die Surprise bleibt danach unbenutzbar (Aktivierung gesperrt, R01-11 behoben).
- **Repro:** `docs/niche-tests/repro/N1-reaktionen-a/16-spell-sperre-surprise-setzen.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** `server.js:11774` `doPlaySurprise` hat kein Gegenstück zu den Spell-Sperren aus `validateActionPlay` (`magic_silenced`, `nulled`, `berserked`, `frightened`).
- **Frage an Al:** Darf ein Held, der „cannot use any Spells" ist (Berserk, Howling in the Night, Null Zone), trotzdem eine Surprise verdeckt setzen – ja (nur Wirken ist gesperrt) oder nein (auch das Setzen)?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Ambush the Scout | L2 gezielt | Fenster bei Gather Intel, Live Show, Birthday Present, Cool Presents, Magic Amber, Slow, Rain of Spores, Accusation, Spreading Rumor, Trial of Annoyance, Draw, Skeleton Skull Bat ✓; Zwangsabwurf 2 Karten ✓; zwei Kopien in einer Kette: beide lösen auf (Kettenlogik, nicht gemeldet); Einmal-Slot der Kreatur bleibt verbraucht (Ruling W3) ✓; Pillar of Light öffnet kein Fenster (nur notiert) |
| Anti Magic | L2 gezielt | Immunität Stufe X (SM 2/3), Flächenzauber, Anhänge-Zauber (Curse) blockiert ✓, Heilzauber auf den Träger blockiert ✓, Detach von Berserk/Decisive Defeat/Light Ball/Curse/Call/Dichotomy inkl. Status-/ATK-Rückgabe ✓, Stufe-4-Anhang bleibt ✓, Tod/Wiederbelebung des Trägers ✓, Teleportation Powder ✓ |
| Anti Magic Shield | L2 gezielt | Wisdom-Kosten ✓, Lv0-Zauber via Wisdom ✓, Anhänge-Zauber (Curse/Berserk/DD) werden negiert ✓, zwei Reaktionen in der Hand ✓, Reihenfolge mit Booby Trap ✓; Magic Arts in Support Zone (Xal) ✗ (→ N1-15) |
| Barrier of Faith | L2 gezielt | Kosten 3/2/1 nach Support Magic, Flächenzauber (nur gewählter Held geschützt) ✓, Fireball/Boiling Oil ✓, Wisdom; Anhänge-Zauber ✗ (→ N1-08) |
| Barrier of Undying | L2 gezielt | Flächenschaden mit 2 Karten ✓, Burn-Tick ✓, zweiter Treffer nach Rettung ✓, gestohlene Kreatur (Löschung zum Zug des Besitzers) ✓, Held eingefroren (kein Angebot) ✓, Trial of Dominance / Goldify (Effekt fizzelt) ✓, Löschung nach echtem `endTurn` ✓ |
| Berserk | L2 gezielt | Zauber-/Surprise-/Reaktionssperre (W16g, Repro R01-11 grün) ✓, Surprise-Setzen (→ N1-16, C), Cure/Anti Magic entfernen Anhang + Status ✓, Tod/Wiederbelebung ✓, Teleportation Powder ✓; Effekt-Beschwörung ✗ (→ N1-02); negierter Angriff verbraucht den Gratis-Angriff (im Code ausdrücklich so gewollt) – nicht gemeldet |
| Booby Trap | L2 gezielt | Spell/Attack/Kreatureneffekt als Quelle ✓, Angreifer stirbt → Effekt negiert + Einmal-Stempel ✓, zwei Fallen am selben/an zwei Helden ✓ (zweite bleibt liegen), Zwei-Ziel-Fireball (je Held eine Falle) ✓, Dark Ocean ✗ (→ N1-12), Anhänge-Zauber lösen aus ✓; Setzen unter Zauber-Sperre (→ N1-16, C) |
| Call of the Deepsea | L2 gezielt | Eigene/gegnerische/gestohlene Kreatur im eigenen Slot ✓ (Löschen aus Ablage des Besitzers), Gegnerzug ✓, Frozen/Stunned-Zonenheld ✓, Anhänge-Wirt ✗ (→ N1-11), Berserk-Zonenheld ✗ (→ N1-02) |
| Chasing the Legend | L2 gezielt | Dark Ocean (nur attack/Spells) ✓, Flächenschaden + 2 Kopien ✓, gestohlene Kreatur (Hand des Besitzers) ✓, Kartenbilanz/Audit ✓ |
| Core Explosion | L2 gezielt | 30 × Level, HOPT je Spieler (zwei Kopien, ein Fenster) ✓, Burn-Tick ohne Quelle ✓; Tick mit bekanntem Verursacher (→ N1-13, C) |
| Corpse Explosion | L2 gezielt | Held/Kreatur tot durch Schaden ✓, Richtung bei übernommenem Held ✗ (→ N1-04), Besiegen ohne Schaden ✗ (→ N1-05), Butterfly Cloud (bereits behoben) |
| Cottage at the Forest's Edge | L2 gezielt | Revive 100 HP + Tod am Zugende ✓, Gegner nutzt Area im eigenen Zug ✓, zweite Nutzung/zwei Helden (1×/Zug) ✓, maxHp-0-Grenze ✓; abgegebener Held ✗ (→ N1-07) |
| Crushing Defeat | L2 gezielt | Letzte Kreatur (AoE, einzeln, gleichzeitig) ✓, zwei Kreaturen/eine stirbt → kein Fenster ✓, Gift-Tick/eigener Tod → kein Fenster ✓, alle Helden eingefroren ✓, Held ohne Schule ✓; Tick mit Verursacher (→ N1-13, C) |
| Cure | L2 gezielt | Heilmenge 100 × Status (frozen+burned+poisoned = 300; Decisive Defeat zählt) ✓, Reaktion im Phasenfenster (Held und Kreatur) ✓, Curse/Berserk-Anhänge werden mit entfernt (zeitversetzt) ✓; proaktiv nur Kreatur ✗ (→ N1-06) |
| Curse | L2 gezielt | ATK-Buchhaltung (Equipment kommt/geht) ✓, Cleanse/Anti Magic stellen ATK zurück ✓, Teleportation Powder ✓, Zusatzaktion-Bedingung: frozen/negated ✓, `nulled` ✗ (→ N1-10); Heldentod ✗ (→ N1-01) |
| Dark Deal | L2 gezielt | Einzelne Kopie: Kontrolle endet nach dem Effekt ✓, Zielliste aus Sicht des neuen Kontrolleurs ✓, Dark Ocean sperrt ✓; zwei Kopien ✗ (→ N1-03) |
| Dark Ocean | L2 gezielt | Schadenstypen attack / alle `*_spell` durch, creature/status/artifact/other geblockt ✓ (Chasing-Fenster folgt), Hand-Reaktionen gesperrt ✓; Surprise gegen Kreatureneffekt (→ N1-12, C) |
| Decisive Defeat | L2 gezielt | Heilung/Anti Magic werfen die Karte ab ✓, Heldentod ✓, Teleportation Powder ✓; zweite Negierung ✗ (→ N1-09), Barrier of Faith ✗ (→ N1-08) |
| Defending the Gate | L2 gezielt | Flächenzauber (Heldenschaden bleibt, Kreatur geschützt) ✓, Fireball nur auf Held → kein Fenster ✓, zweiter Zauber im selben Zug (Tor verbraucht) ✓, Disarm gegen Ausrüstung ✓, eigene Zauber/Kreatureneffekte auf eigene Zonen ✓, Burning Skeleton auf eigene Kreatur ✓; Host eingefroren/betäubt/tot → kein Fenster ✓ |
| Dichotomy of Luna and Tempeste | L2 gezielt | Aufrunden (25 → 13), Burn-Tick ausgenommen, Gift-Tick halbiert, Kreaturenpfad, zwei Kopien (nur einmal), Stoneskin/Cloud Pillow/Interference gesperrt ✓, Anhang an Gegnerheld wirkt für die Trägerseite ✓ (laut Skript gewollt); Aquatic Shield (→ N1-14, C) |
| Dive Down | L2 gezielt | Schutz greift gegen Fireball (Held nicht anbietbar) und Flächenzauber ✓, Anti-Lock (keine anderen Ziele → trefferbar) ✓, Schutz endet mit dem Zug (Fireball im Zug 7 bietet den Helden wieder an) ✓, durch Silence negiert → Karte wird gelöscht (`deleteOnUse`, Ruling v1327) ✓ |
| Divine Awakening | L2 gezielt | Aufstieg ohne Bedingung (Kohta) ✓, ohne Karte ✗ wie erwartet ✓, Wirt eingefroren/betäubt/negiert (Aufstieg weiter möglich), Anti Magic X≥… Level 4 bleibt ✓, Zuordnung aller Ascended Heroes zu Basisformen ✓; Wirt abgegeben/übernommen (→ N1-11, C) |



## Getestet & in Ordnung (Auswahl)
- **Fenster / Auslöser:** Booby Trap (Spell, Attack, Kreatureneffekt, Anhänge-Zauber, Zwei-Ziel-Flächenschlag je Held eine Falle, zwei Fallen an einem Helden: zweite bleibt liegen, wenn die erste den Angreifer tötet); Anti Magic Shield / Barrier of Faith / Booby Trap in derselben Hand bzw. am selben Treffer – nach der ersten Negation keine weitere Frage; Defending the Gate nur bei echtem Effekt auf Support-Karten (Fireball auf den Helden: kein Fenster), nur gegen den Gegner, verbraucht sich pro Auflösung; Dark Ocean lässt `attack` und alle `*_spell`-Typen durch (Chasing-Fenster folgt dem).
- **Kosten / Stempel:** Core Explosion „1 pro Zug" je Spieler, gestempelt erst beim Auflösen; Dive Down: Ablehnen kostet nichts; Call of the Deepsea: Ablehnen/Abbruch stempelt nicht (weiche HOPT je Instanz); Wisdom-Kosten bei Anti Magic Shield / Barrier of Faith werden aus der richtigen Hand gezahlt.
- **Wegzug des Trägers:** Anti Magic, Berserk, Decisive Defeat, Dichotomy, Call of the Deepsea, Divine Awakening gehen beim Heldentod in die Ablage ihres Wirkers/Besitzers, Status und Immunität verschwinden; Teleportation Powder bringt Status, Buffs und Anhänge unverändert zurück (nur Curse beim Heldentod ✗ → N1-01).
- **Kontrolle:** Chasing the Legend schickt eine gestohlene Kreatur in die Hand des Besitzers; Barrier of Undying löscht zum Zug des Besitzers; Call of the Deepsea löscht aus der Ablage des Besitzers; Dark Deal (eine Kopie) gibt die Kontrolle nach dem Effekt zurück.
- **Mehrfachfenster:** Boiling Oil auf 3 Kreaturen mit 2 Barrier of Undying / 2 Chasing the Legend – genau zwei Rettungen, dritte Kreatur stirbt; zwei Core Explosion beim Doppeltod – ein Fenster (HOPT).
- **Zeit:** Barrier of Undying löscht nach echtem `endTurn()` zum Zugende des Besitzers (Eigenzug: übernächster Zug) und legt die Karte in den Gelöscht-Stapel; Cottage-Held stirbt am Zugende; Dive-Down-Schutz endet mit dem Zug.

