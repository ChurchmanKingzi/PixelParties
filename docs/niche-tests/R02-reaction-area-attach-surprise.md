# R02-reaction-area-attach-surprise – Nischenfall-Bericht
Stand/Autor: Agent R02-reaction-area-attach-surprise (Fortsetzung des Vorgängers ab R02-03), 13.10.2026. Karten: 43 in der Liste · 38 gezielt getestet (L2) · 21 mit Befund (23 Befunde: 22 aus der Liste + 1 Nebenbefund außerhalb).

## Zusammenfassung
Gesamteindruck: Die Reaktions-/Area-/Attachment-/Surprise-Karten sind im Normalfall solide (Auslösefenster für Helden, Einmal-pro-Zug-Buchhaltung, Area-Limit mit Crevice, Kontrolle statt Seite bei Siege/Light Ball/Royal Treasury, Surprise-Reihenfolge). Die Befunde bündeln sich in fünf Klassen:
1. **Kreaturen als Ziel/Quelle fehlen in Fenstern, die „target" sagen**: Mountain Tear River (R02-01), Umleiter bei Mehrfachziel-Pickern (R02-02), Spectral Armor (R02-16), Tarleinn's Floating Island (R02-17), Rioting Village ohne Rückstoß gegen Kreaturen (R02-12).
2. **Die gerade aufgelöste Spielkarte steht noch in der Hand** und zählt für Gegenzugriffe mit: Loot the Leftovers klaut sie, Spike Trap und Shamanic Curse zählen sie als bezahlbare Handkarte (R02-07, R02-15).
3. **Geliehene Helden (Charme/Übernahme) werden an der falschen Heldenreihe gelesen**: Rioting Village (R02-13), Zombified Assault (R02-20), Shamanic Curse (R02-22) und als Nebenbefund Burning Finger (R02-21). Die Rückschlag-Surprises Spike Trap, Toxic Trap, Mountain Tear River und Tharxian Horse sind dagegen korrekt (gemessen).
4. **Zustands-/Flaggenverträge**: Overheal Shock räumt `healReversed` nie auf (R02-03, Leave-Hook feuert vor dem Zonenwechsel), Prophecy of Tempeste wird von Cloudy/Petrification Break reduziert (R02-04), Unwanted Audience umgeht Light Ball (R02-05) und negiert die rein passive Bomb Mite (R02-06), No Retreat!/Distracting Crystal erkennen nur geflaggte Karten (R02-10), Very Special Prisoner spliced am Deck-Sperrvertrag vorbei (R02-19).
5. **Abbruchmarke**: Der optionale Zusatzziel-Prompt von Mountain Tear River setzt `_spellCancelled` und gibt dem GEGNER den Zauber samt Aktion zurück (R02-09) – der gefährlichste Befund.
Bewusst nicht (oder nur oberflächlich) getestet: Test Flight, The Melting, Surprising Opportunity, Triumphant Return, Trample Sounds (alte Kartentests existieren, nur Stichproben bzw. L1), Off Duty nur Standardfall, Weapon Absorption nur Stichprobe (Dauerfeuer-Lead „+2 Destruction Magic" ist ein Harness-Artefakt der Angriffskarte, kein Kartenverlust), Surprise-Hosts in der Zone gestohlener Helden nur grob, Mehrspieler (3/4 Sitze), Spielende-Gleichstand der Skull Carpet Bombing (durch B-08/Hauptlauf gedeckt). Harness-Falle (für Folgetester): `policy.confirm = false` liefert `{confirmed:false}`, ein wahrheitsfähiges Objekt – Fenster mit `if (!ja)` lesen das als Ja (Test Flight, Spatial Crevice); ein echtes „Nein" ist `null`.

| ID | Titel | Stufe |
|---|---|---|
| R02-01 | Mountain Tear River feuert nie auf Kreaturenwahl | A |
| R02-02 | Umleiter/Negierer sehen Mehrfachziel-Picker nie | A |
| R02-03 | Overheal Shock: `healReversed` bleibt nach Abgang der Karte | A |
| R02-04 | Prophecy of Tempeste: Cloudy/Petrification Break reduzieren trotz „cannot be reduced" | A |
| R02-05 | Unwanted Audience umgeht Light Ball | A |
| R02-06 | Unwanted Audience negiert Bomb Mite (passiv) | B |
| R02-07 | Aufgelöste Spielkarte zählt als Handkarte (Loot, Spike Trap) | A |
| R02-08 | Looting rüstet Control Device am eigenen Helden aus | C |
| R02-09 | Mountain Tear River: Zusatzziel-Abbruch gibt den Gegner-Zauber zurück | A |
| R02-10 | No Retreat!/Distracting Crystal erkennen Mischkarten nur per Flagge | A |
| R02-11 | Prayer unter Ziehsperre wirft ab, zieht nichts | C |
| R02-12 | Rioting Village: kein Rückstoß gegen Kreaturen | A |
| R02-13 | Rioting Village: Rückstoß trifft bei geliehenem Helden die falsche Reihe | A |
| R02-14 | Spatial Crevice bietet unter Siege die Suche an | B |
| R02-15 | Shamanic Curse + Wisdom (Spielkarte als Handkarte, Kosten nie gezahlt) | B |
| R02-16 | Spectral Armor schützt keine Kreaturen | B |
| R02-17 | Tarleinn's Floating Island: Kreaturenheilung löst nie aus | B |
| R02-18 | Toxic Trap öffnet nicht bei Flächen-Statuszauber | C |
| R02-19 | Very Special Prisoner umgeht die Deck-Sperre (Knight of Kings [B]) | A |
| R02-20 | Zombified Assault: Rückschlag trifft bei geliehenem Angreifer die falsche Reihe | A |
| R02-21 | Nebenbefund Burning Finger: Stufe eines geliehenen Wirkers falsch | B |
| R02-22 | Shamanic Curse: geliehener Wirker an falscher Reihe geprüft | B |
| R02-23 | Prophecy of Tempeste: Deckel entfällt unter CC des Wirts | C |

Zählung: A = 12 (R02-01, -02, -03, -04, -05, -07, -09, -10, -12, -13, -19, -20), B = 7 (R02-06, -14, -15, -16, -17, -21, -22), C = 4 (R02-08, -11, -18, -23).

## Befunde
### R02-01 · Mountain Tear River: „… or a Creature in one of its Support Zones is chosen" löst nie aus · Stufe A
- **Karten:** Mountain Tear River (`cards/effects/mountain-tear-river.js`), Engine `_checkSurpriseWindow`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Mountain Tear River in der Surprise Zone von Held 0 (Destruction Magic 1), eine Kreatur in Support Zone 1 von Held 0. Sitz 0: Burning Finger / Fireball / Pusher auf der Hand bzw. Cannon Tower auf dem Brett.
- **Schritte:** 1. Sitz 0 wählt die KREATUR von Sitz 1 mit (a) Burning Finger (Einzelziel-Spell), (b) Fireball, (c) Pusher (Attack), (d) Cannon Tower (Kreatureneffekt).
- **Erwartet** (Kartentext „Activate this Surprise when the user or a Creature in one of its Support Zones is chosen by an Attack, Spell or Creature effect. Burn the attacker."; Skriptkopf v703 `surpriseFiresOnSupportCreature`): in allen vier Fällen kommt die Frage „Mountain Tear River", der Angreifer (Held bzw. Cannon Tower) brennt.
- **Beobachtet:** nie eine Frage, nie ein Brand; der Seitenschaden an der Kreatur geschieht normal. Das Surprise-Fenster wird für das Kreaturenziel gar nicht geöffnet. Gegenprobe: wird der HELD gewählt, feuert die Karte.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/01-mountain-tear-river-kreatur-gewaehlt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Zielwahl-Eingänge (`promptDamageTarget`, `promptMultiTarget`, Dispatcher) liefern gewählte Kreaturen als `type: 'equip'` (`_engine.js` ~4927/5515), das Surprise-Fenster verlangt aber `type === 'creature'` (`_engine.js` ~34974) und die Eingänge filtern vor dem Aufruf auf `hero`/`creature` (~5353, ~5859). Nur der Flächen-Pfad (`aoeSurpriseVorab`) liefert `'creature'` – dort sperrt Mountain Tear River selbst („chosen" ⇒ keine Fläche). Die `surpriseFiresOnSupportCreature`-Klausel ist damit toter Code.

### R02-02 · Umleiter/Negierer (Martyry, Rolling Boulder) sehen Mehrfachziel-Wahlen nie (Fireball, Mr. Jiggles) · Stufe A
- **Karten:** Martyry (`martyry.js`), Rolling Boulder (`rolling-boulder.js`); betrifft jede Zielumleitung (Challenge, Anti-Magnet, Monia Bot …), soweit sie am `applyRedirectWindows` hängt.
- **Voraussetzungen / Aufbau:** (a) Sitz 1: Martyry auf der Hand (Held 1 mit Support Magic 1). Sitz 0 spielt Fireball und wählt GENAU EIN Ziel (Held 0 von Sitz 1). (b) Sitz 1: Rolling Boulder (Held 1). Sitz 0 aktiviert Mr. Jiggles („choose up to 2 targets … 100 damage") und wählt GENAU EIN Ziel.
- **Erwartet** (Martyry: „when a target you control is chosen by an Attack, Spell or Creature effect"; Rolling Boulder: „when your opponent chooses exactly 1 target you control with the effect of a Creature"; Ruling `_engine.js` ~29065 „ein Umleiter reagiert auf JEDES Ziel EINZELN", bindend 31.8.): (a) Martyry wird angeboten; (b) Rolling Boulder negiert und besiegt Jiggles.
- **Beobachtet:** (a) kein Angebot, Fireball trifft (650 HP), Martyry bleibt auf der Hand. (b) kein Angebot, Jiggles trifft (700 HP) und lebt. Gegenproben mit Einzelzielpicker (Burning Finger, Cannon Tower) lösen aus.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/02-umleiter-mehrfachziel-picker.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `promptMultiTarget` (`_engine.js` ~5799) ruft `promptEffectTarget` ohne `_redirectSource`/`sourceCard`; `_redirectSourceFor()` liefert dann `null` und `applyRedirectWindows` kehrt in der ersten Zeile zurück (`if (!sourceCard) return pickedIds`, ~29116). `promptDamageTarget` öffnet das Fenster selbst, deshalb funktionieren Einzelziel-Picker.

### R02-03 · Overheal Shock: `healReversed` bleibt am Helden, nachdem die Karte das Brett verlassen hat · Stufe A
- **Karten:** Overheal Shock (`cards/effects/overheal-shock.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 (Support Magic 2) legt Overheal Shock auf Held 0 von Sitz 1 (HP vorher auf 500). Danach verlässt die Karte das Brett auf je einem von drei Wegen: (a) `actionDestroyCard`, (b) `sendBoardCardToDiscard`, (c) `actionMoveCard(… 'hand')`.
- **Schritte:** 1. Karte anhängen (Status `healReversed` gesetzt ✓). 2. Karte vom Brett nehmen (a/b/c). 3. `actionHealHero(…, 100)` auf den Helden.
- **Erwartet** (Kartentext „Attach this card to a Hero your opponent controls. Any healing that Hero would receive is applied as damage instead."; Skriptkopf „Cleared when the card leaves the zone"): Karte weg ⇒ Status weg ⇒ Heilung hebt die HP (500 → 600).
- **Beobachtet:** In allen drei Wegen steht `hero.statuses.healReversed` weiter am Helden, die Heilung wird weiter als Schaden gebucht (500 → 400), obwohl die Karte in Ablage bzw. Hand liegt. Erst der Heldentod räumt den Status auf (`handleHeroDeathCleanup`, dort ✓). Auswirkung im Spiel: jede Entfernung der Karte (Zerstörung, Rücknahme auf die Hand) lässt den Gegner dauerhaft ohne Heilung zurück – ein „Fluch ohne Karte".
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/03-overheal-shock-status-bleibt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `overheal-shock.js` `onCardLeaveZone` (~Z. 398–418) prüft per `supportZones[fromHeroIdx].some(slot => slot.includes('Overheal Shock'))`, ob noch eine weitere Kopie liegt. Der Leave-Hook feuert aber VOR dem Zonenwechsel (gemessen: im Hook steht `supportZones[0] = [["Overheal Shock"],[],[]]`, `inst.zone === 'support'`) – er findet die gerade gehende Karte selbst, `stillHasShock` ist immer `true`, der Status wird nie gelöscht. Die Prüfung müsste die ausscheidende Instanz ausnehmen (oder zählen, ob es ≥ 2 Kopien gibt).

### R02-04 · Prophecy of Tempeste: „cannot be reduced or negated by other cards or effects" – Cloudy/Petrification Break halbieren trotzdem · Stufe A
- **Karten:** Prophecy of Tempeste (`prophecy-of-tempeste.js`); betroffen auch die Kombination mit Petrification Break (`petrification-break.js`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0, Held 0 (Magic Arts 3) trägt Prophecy of Tempeste. Variante A: Held 0 hat den Buff „cloudy" (halber Schaden aus allen Quellen). Variante B: Held 0 trägt zusätzlich Petrification Break („any damage it would take is halved"). Sitz 1 trifft (a) Held 0 direkt mit 300, (b) Held 1 mit 300 (Umleitung auf Held 0, Sitz 0 bestätigt).
- **Erwartet** (Kartentext „Damage this Hero would take cannot exceed 100. Damage this Hero takes cannot be reduced or negated by other cards or effects."; Skriptkopf „`cannotBeNegated: true` … which the engine reads to skip Cloudy / buff multipliers"): (a) 100, (b) 100 Schaden am Wirt.
- **Beobachtet:** (a) 50 und (b) 50 – in beiden Varianten halbiert die Reduktion den gedeckelten Betrag. Das Skript verspricht im Kopf, die Engine überspringe Cloudy/Multiplikatoren bei `cannotBeNegated`; das passiert aber nur für `hookCtx.cannotBeNegated`.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/04-prophecy-of-tempeste-unreduzierbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionDealDamage(…, { cannotBeNegated: true })` in `prophecy-of-tempeste.js` (~Z. 281–288, ~382): `_actionDealDamageImpl` (`_engine.js` ~8412–8660) übernimmt `opts.cannotBeNegated` nirgends in `hookCtx.cannotBeNegated` / `cannotBeReduced` (gelesen wird `opts.cannotBeNegated` nur für `heroSpellWardBlocks`, ~9799), sodass die Buff-Multiplikatoren (~8639) greifen. Bei direkten Treffern (a) gibt es keinerlei „unreduzierbar"-Marke für die Karte (das Gegenstück `_isHeroDamageUnstoppable`, ~8441, gilt nur für den HELDEN Tempeste).

### R02-05 · Unwanted Audience „counts as a negative status effect" – Light Ball schützt die Kreaturen trotzdem nicht · Stufe A
- **Karten:** Unwanted Audience (`unwanted-audience.js`), Light Ball (`light-ball.js`); betrifft jede Immunität, die nur in `canApplyCreatureStatus` sitzt (z. B. Buff `negative_status_immune`, Lunatic Golem).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Held 0 trägt Light Ball (Support Zone 2), Kreaturen Cannon Tower (Held 1) und Dummy (Held 2). Sitz 1: Unwanted Audience auf der Hand (Decay + Magic Arts). Sitz 1 beendet seinen Zug; zu Beginn des Zuges von Sitz 0 bietet sich die Karte an (Ja).
- **Erwartet** (Unwanted Audience: „… cannot activate their active effects this turn. This counts as a negative status effect."; Light Ball: „all other targets you control are immune to all negative status effects"): Light Ball schützt Cannon Tower; Kontrolle ohne Light Ball: Cannon Tower wird negiert.
- **Beobachtet:** Kontrolle ✓ (negiert). Mit Light Ball wird der Cannon Tower trotzdem negiert (`counters.negated = 1`, Buff `unwanted_audience_negated`). Gegenprobe: derselbe Schutz über `applyCreatureStatus(…, 'negated')` blockt korrekt – Light Ball funktioniert, nur Unwanted Audience umgeht ihn.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/05-unwanted-audience-light-ball.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `unwanted-audience.js` `sleepCreature` → `engine.actionNegateCreature` (`_engine.js` ~18146). Dieser Weg prüft weder `_lightBallProtects` noch `_creatureNegStatusImmune` (beides sitzt nur in `canApplyCreatureStatus`, ~18560–18575). Der Kommentar bei `actionNegateCreature` (v1444) sagt, nur `unpreventable`-Negationen (Dark Gear, Diplomacy) seien KEINE Statuseffekte – eine „normale" Negation wie die der Unwanted Audience ist also einer.

### R02-06 · Unwanted Audience negiert Bomb Mite (rein passive Kreatur) und verzögert damit die Detonation · Stufe B
- **Karten:** Unwanted Audience, Bomb Mite (`bomb-mite.js`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0 hat Bomb Mite (`turnPlayed 3`) auf dem Brett, Sitz 1 Unwanted Audience auf der Hand. Sitz 1 beendet Zug 5; zu Beginn von Zug 6 (Sitz 0) spielt Sitz 1 die Karte (Ja). Sitz 0 beendet Zug 6.
- **Erwartet** (Unwanted Audience: „Creatures your opponent controls cannot activate their ACTIVE effects"; Bomb Mite: „When you control this Creature at the end of your next turn after summoning it, send it to the discard pile and deal 100 damage to all Heroes your opponent controls." – kein aktiver Effekt): Die Mite bleibt unberührt und detoniert am Ende von Zug 6 (100 Schaden auf alle Helden von Sitz 1, Mite in der Ablage). Kontrolle ohne Unwanted Audience ✓.
- **Beobachtet:** Die Mite wird negiert (Zzz), detoniert nicht und bleibt auf dem Brett (Sitz 1 behält 800 HP).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/06-unwanted-audience-bomb-mite.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `bomb-mite.js` Z. 82 exportiert `creatureEffect: true`, obwohl es weder `onCreatureEffect` noch `canActivateCreatureEffect` gibt (Bomb Mite ist die EINZIGE Kreatur mit dieser Kombination, per Skript-Scan über alle Kreaturenskripte geprüft); `unwanted-audience.js creatureHasActiveEffect()` prüft nur `script.creatureEffect`. Zusätzlich: die Negation schaltet ALLE Effekte der Kreatur ab, nicht nur den aktiven – bei den 80 Kreaturen mit aktivem UND passivem Effekt (z. B. Coreling, Cute Familiar) ruhen so auch die passiven Hooks.
- **Frage an Al** (Teil „passive Effekte"): Soll Unwanted Audience bei Kreaturen mit aktivem und passivem Effekt NUR den aktiven sperren (Kartentext wörtlich) oder wie bisher die ganze Kreatur negieren?

### R02-07 · Die gerade aufgelöste Spielkarte zählt für Handzugriffe der Gegenseite als Handkarte (Loot the Leftovers klaut sie, Spike Trap lässt sie als Abwurfkosten zu) · Stufe A
- **Karten:** Loot the Leftovers (`loot-the-leftovers.js`, Helfer `actionStealFromHand` `_engine.js` ~24830), Spike Trap (`spike-trap.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. (A) Sitz 0 hat NUR [Fireball, Heal] auf der Hand und besiegt mit Fireball den Helden 0 von Sitz 1 (HP 100); Sitz 1 hält Loot the Leftovers (Held 1 mit Decay Magic). (B) Sitz 0 hat [Fireball, Heal], Sitz 1 hat Spike Trap (Decay Magic 2) verdeckt auf Held 0.
- **Schritte:** A: 1. Sitz 0 spielt Fireball auf Held 0 von Sitz 1. 2. Loot wird angeboten (Ja), blinde Wahl der Plätze 0 und 1. B: 1. Sitz 0 spielt Fireball auf Held 0. 2. Spike Trap feuert, Sitz 0 bekommt die Gegenzug-Frage „Discard 2 cards …" und wirft die Plätze 0 und 1 ab.
- **Erwartet** (Loot: „Choose 2 random cards from your opponent's hand"; Spike Trap: „Your opponent may discard 2 cards from their hand to negate this effect"; Engine-Konvention `_handOhneAufloesendeKarte`, v1405, und Wisdom-Abwurf `eligibleIndices` ohne die aufgelöste Karte, `server.js` ~8573): Die Karte, die gerade gespielt wird, ist keine Handkarte mehr. (A) Sitz 0 hat außer dem Fireball nur 1 Handkarte: Loot wird nicht angeboten oder nimmt höchstens „Heal"; der Fireball landet in der Ablage von Sitz 0. (B) Sitz 0 kann nur 1 weitere Karte abwerfen ⇒ keine Gegenzug-Frage, Spike Trap feuert (200 Schaden an Sitz 0).
- **Beobachtet:** Der Zauber bleibt während der Auflösung in `ps.hand` (`ps._resolvingCard`, damit ein Abbruch ihn zurücklegen kann). (A) Loot wird angeboten (die Bedingung „2+ Karten" zählt ihn mit) und stiehlt Heal UND den gerade gespielten Fireball: Fireball steht auf der Hand von Sitz 1, die Ablage von Sitz 0 bleibt leer (Instanz: Besitzer 1, Zone hand). (B) Die Gegenzug-Frage kommt trotz nur einer weiteren Handkarte; wirft Sitz 0 den laufenden Fireball + Heal ab, fällt Spike Trap aus und der Fireball trifft trotzdem (Sitz 1: 650 HP, Sitz 0 unversehrt). Die Kosten sind damit faktisch nur 1 echte Karte. Kartenbilanz bleibt ausgeglichen, `t.audit()` sauber.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/07-aufloesende-spielkarte-zaehlt-als-handkarte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionStealFromHand` (`_engine.js` ~24830) nimmt `oppPs.hand.length` und `oppPs.hand[idx]` ungefiltert; `loot-the-leftovers.js` `reactionCondition`/`resolve` prüft `(hand).length < 2` ungefiltert; `spike-trap.js` ~Z. 58–70 baut `eligibleIndices` aus ALLEN Handplätzen. Der Ausschluss `_istAufloesendeHandkarte` / `_handOhneAufloesendeKarte` (v1405) wird nur von Live Show und Bubbles benutzt. Mögliche weitere Verbraucher derselben Klasse (nicht einzeln geprüft): jede Gegner-Reaktion/Surprise, die während der Auflösung auf die Hand des aktiven Spielers zugreift (Abwurf, Raub, Zählen, Ansehen).

### R02-08 · Looting rüstet „Future Tech Control Device" am eigenen Helden aus, obwohl der Kartentext einen Gegnerhelden verlangt · Stufe C
- **Karten:** Looting (`looting.js`, Helfer `_equip-shared.js`), Future Tech Control Device (`future-tech-control-device.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 (Destruction Magic + Support Magic) besiegt mit Fireball Held 2 von Sitz 1 (HP 100) und spielt Looting. In der EIGENEN Ablage (Sitz 0) liegt nur die Control Device.
- **Schritte:** 1. Looting nach dem Tod anbieten (Ja). 2. In der Galerie die Control Device wählen. 3. Zugende von Sitz 0.
- **Erwartet** (Control Device: „Equip this card to a Hero your opponent controls. Your opponent may once per turn, during their turn, take control of this Hero …"; `_equip-shared.js`: „eine Ausrüstung ohne legalen Träger ist keine legale Wahl"): Die Karte steht für den Nutzer nicht zur Wahl (oder wird nicht an dessen Helden gelegt).
- **Beobachtet:** Die Galerie bietet sie an, sie liegt danach in der Support Zone von Held 0 des Wirkers; im Zug von Sitz 1 meldet `getActivatableEquipsCrossSide(1)` sie als aktivierbar, d. h. der Gegner darf den Helden des Looting-Spielers übernehmen. Am Zugende des Gegners geht die Karte wieder in die Ablage von Sitz 0. Stammt die Control Device aus der GEGNER-Ablage, ist dieselbe Lage stimmig (Looting-Spieler = Gegner des Kartenbesitzers) – auffällig ist nur der Weg aus der eigenen Ablage. Keine Engine-Fehler, `t.audit()` sauber.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/08-looting-control-device-eigener-held.js` (✗ = Abweichung tritt auf)
- **Vermutete Ursache:** `istAusruestTraeger` (`_equip-shared.js` ~64) kennt die Cross-Side-Klausel (`placesOnOpponentBoard` bzw. „your opponent controls") nicht; `looting.js kandidaten()` nimmt beide Ablagen ungeprüft. Gleicher Helfer: Weapon Collecting Wight, Future Tech Gunslinger Riffel, Treasure Hunter's Backpack (nicht geprüft).
- **Frage an Al:** Soll Looting (und die übrigen Stapel-Ausrüster) die Control Device nur zulassen, wenn der Nutzer ein Held des Gegners des Kartenbesitzers ist – also NICHT aus der eigenen Ablage anbieten? (Ja = nur Gegner-Ablage / Nein = wie bisher)

### R02-09 · Mountain Tear River: lehnt der Surprise-Besitzer die „additional targets" ab, gilt der Zauber des GEGNERS als abgebrochen (Karte zurück auf die Hand, Aktion erstattet, Schaden aber verursacht) · Stufe A
- **Karten:** Mountain Tear River (`mountain-tear-river.js`), betroffen ist jeder gegnerische Zauber/Attack, der die Surprise auslöst (hier Burning Finger)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Held 0 mit Destruction Magic 3, Mountain Tear River in dessen Surprise Zone. Sitz 0 spielt Burning Finger (100 Schaden) auf Held 0 von Sitz 1.
- **Schritte:** 1. Die Surprise feuert (Ja), brennt den Angreifer. 2. Die Frage „Choose up to 2 additional targets to Burn" (min 0, max 2, abbrechbar) wird mit (a) 0 Zielen, (b) Abbrechen (`null`, Mensch) beantwortet; Kontrolle (c) 1 Ziel.
- **Erwartet** (Kartentext „Burn up to 2 additional targets afterwards" – „up to" erlaubt 0; Skriptkopf „Mountain Tear River never cancels the triggering effect"): in allen drei Fällen derselbe Zauber-Ausgang: 100 Schaden, Burning Finger in der Ablage von Sitz 0, Aktion verbraucht.
- **Beobachtet:** Nur (c) korrekt. Bei (a)/(b) trifft Burning Finger (700 HP), landet aber wieder auf der HAND von Sitz 0, die Aktion ist erstattet (`heroesActedThisTurn` leer); ein zweiter Burning Finger geht ohne Aktions-Reset durch (600 HP). Für eine Karte und eine Aktion entstehen so beliebig viele Treffer, solange der Verteidiger ablehnt (oder auf „Abbrechen" klickt).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/09-mountain-tear-river-abbruch-gibt-spell-zurueck.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `promptMultiTarget` (`_engine.js` ~5844) setzt bei leerer/abgebrochener Wahl `gs._spellCancelled = true`, außer `config.noSpellCancel` ist gesetzt (Kommentar dort: „ein Abbruch ausserhalb eines Zaubers … darf keine Zauber-Abbruchmarke hinterlassen"). `mountain-tear-river.js` (~Z. 177–195, `ctx.promptMultiTarget({ … cancellable: true })`) setzt `noSpellCancel` nicht (Gegenstück: `toxic-trap.js` Z. 72 tut es). `doPlaySpell` wertet die Marke (~`_engine.js` 21888, `abgebrochen = _spellCancelled && !_spellNegatedByEffect`) als Abbruch des gerade laufenden Zaubers des Gegners. Klasse: jede Surprise/Reaktion, die in fremder Auflösung eine abbrechbare `ctx.promptMultiTarget`/`promptDamageTarget`-Wahl ohne `noSpellCancel` öffnet (in dieser Gruppe nur Mountain Tear River; Looting, Martyry, Spectral Armor, Surprising Opportunity und Weapon Absorption rufen `engine.promptEffectTarget` direkt auf, das die Marke nicht setzt; Toxic Trap setzt `noSpellCancel`).

### R02-10 · No Retreat! erkennt nur Karten mit Skript-Flagge – Brainstorming, Staff of the Teleporter (u. a.) mischen Karten ins Deck, tragen sie aber nicht (auch Distracting Crystal sperrt sie nicht) · Stufe A
- **Karten:** No Retreat! (`no-retreat.js`); betroffen: Brainstorming, Staff of the Teleporter (Wirkung durchgespielt), Meditation, Expedition, Mass Routing (nur „nicht angeboten" gemessen); Nebenbefund Distracting Crystal (nicht in der Gruppe)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 spielt die Karte (Aktionsphase), Sitz 1 hat No Retreat! auf der Hand (Held 0 mit Decay Magic 1) und sagt zu allem Ja. Brainstorming mit 4× Fireball in der Ablage von Sitz 0; Staff of the Teleporter mit 3 weiteren Handkarten.
- **Schritte:** 1. Sitz 0 spielt Guard Duty (Kontrolle), danach in frischen Spielen Brainstorming bzw. Staff of the Teleporter. 2. Beobachten, ob No Retreat! angeboten wird. 3. Nebenprobe: Brainstorming mit Distracting Crystal auf der Hand.
- **Erwartet** (No Retreat!: „Play this card immediately when your opponent activates a card or effect that would include shuffling cards from their hand, discard pile or side of the board back into the deck. Negate that card or effect."; Brainstorming: „shuffle 4 cards with the same name from your discard pile back into your deck"; Staff of the Teleporter: „Shuffle any number of cards from your hand into your deck"): No Retreat! wird in allen Fällen angeboten und negiert die Karte.
- **Beobachtet:** Guard Duty (Kontrolle) und Renewable Energy: Angebot ✓. Brainstorming (**kein** Angebot, Effekt läuft: Deck 20 → 23) und Staff of the Teleporter (**kein** Angebot, die Handkarten-Auswahl öffnet sich): nachgewiesen. Meditation, Expedition, Mass Routing: **kein** Angebot gemessen, die Wirkung selbst wurde nicht durchgespielt. Dieselbe Lücke macht Distracting Crystal wirkungslos („While this card is in your hand, you cannot activate effects that include adding cards from your hand or discard pile to your deck"): Guard Duty wird abgelehnt (✓), Brainstorming und Staff of the Teleporter laufen mit Distracting Crystal auf der Hand ungehindert (Deck 20 → 23).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/10-no-retreat-erkennung-flag.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `no-retreat.js` Z. 33–40 (und die Sperren in `_engine.js` ~28682/40898/41505, `_crystals-shared.js`) lesen nur `script.shufflesFromHandOrDiscardIntoDeck`. Das Skript-Flag tragen 15 Karten (Black Marketeer, Cosmic Manipulation, Deepsea Stein, Elana, Copy Device, Weathercock, Guard Duty, Horn in a Bottle, Kitsune Transformation, Leadership, Lunatic Cycle – Crescent Moon, Renewable Energy, Tanuki Escape, The Cosmic Depths, The Stormblade); im Kartentext-Scan (`shuffle … back into … deck`) bleiben 29 Karten ohne Flagge, darunter eindeutig passende: Brainstorming, Staff of the Teleporter, Meditation (Ablage → Deck), Expedition und Mass Routing (Brett → Deck), Motharch Squire, Priest of Luna/Tempeste (Kosten aus der Ablage), Anti Intruder System. Nicht jeder davon gehört dazu (Deck-intern gemischte Karten wie Amazing Finding, Time Distortion, Ghazma/Hatusbal-Lage, spätere Trigger wie Create Illusion), ihre Zuordnung ist ein Prüfauftrag. `Last Second Escape`/`Homecoming` (Reaktionen, mischen Kreaturen aus Support Zones ins Deck) sind ebenfalls ohne Flagge.

### R02-11 · Prayer unter Ziehsperre: Abilities werden abgeworfen, gezogen wird nichts · Stufe C
- **Karten:** Prayer (`prayer.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Main Phase. Sitz 0 legt Prayer an Held 0 und hält Fighting, Fighting, Toughness. Variante A: ohne Sperre (Kontrolle). Variante B: `ps.drawLocked = true` (Sacred Jewel / MOE Shield / Prayers eigene Extra-Karten-Sperre).
- **Schritte:** 1. Klick-Effekt von Prayer aktivieren (`activateEquip`). 2. Alle 3 Abilities zum Abwurf wählen. 3. Keine Extra-Karte.
- **Erwartet** (Kartentext „discard any number of Abilities from your hand to draw the same number of cards"): A: 3 abgeworfen, 3 gezogen ✓. B: offen – entweder ist die Aktivierung unter Ziehsperre nicht möglich, oder der Abwurf bleibt eine freie Entscheidung des Spielers.
- **Beobachtet:** B: Prayer lässt sich aktivieren, die 3 Abilities wandern in die Ablage, die Hand schrumpft von 3 auf 0, es wird nichts gezogen (`drawLocked` wird nur für die Extra-Karte geprüft, Skriptkopf: „Ist der Zieh-Lock schon gesetzt, entfällt die Nachfrage"). Keine Engine-Fehler.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/11-prayer-ziehsperre-wirft-ab.js` (✗ = Abweichung von meiner Erwartung)
- **Vermutete Ursache:** `prayer.js` `onEquipEffect`: kein Vorab-Check auf `ps.drawLocked` / `handLocked` vor dem Abwurf.
- **Frage an Al:** Soll Prayer unter einer Ziehsperre gar nicht aktivierbar sein (kein Abwurf ohne Zug) – Ja – oder bleibt es dem Spieler überlassen, die Abilities trotzdem abzuwerfen (z. B. um Abilities „loszuwerden") – Nein?

### R02-12 · Rioting Village: trifft der Attack eine KREATUR, gibt es keinen Rückstoß · Stufe A
- **Karten:** Rioting Village (`rioting-village.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Rioting Village liegt als Area von Sitz 0; Held 0 von Sitz 0 hat damit ATK 80 (40 × 2). Er spielt „Attack" („deal damage equal to the attacker's Attack stat"). (a) Ziel Held 0 von Sitz 1, (b) Ziel eine Kreatur (ZZ Dummy, 1000 HP) in Support Zone 0 von Held 0 von Sitz 1.
- **Erwartet** (Kartentext „when a Hero deals damage with an Attack, it takes half the damage dealt as recoil (rounded up)" – keine Einschränkung auf Heldenziele): in (a) und (b) 80 Schaden am Ziel und 40 Rückstoß am Angreifer (760 HP).
- **Beobachtet:** (a) ✓ (720 / 760). (b) Die Kreatur verliert 80 (920 HP), der Angreifer bleibt bei 800 HP – kein Rückstoß. Gegen Kreaturen sind Attacks unter Rioting Village damit „gratis" (verdoppelte ATK, keine Strafe).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/12-rioting-village-kreatur-kein-rueckstoss.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `rioting-village.js` hat nur einen `afterDamage`-Zweig (Heldenschaden). Kreaturenschaden läuft über `afterCreatureDamageBatch` (`_hooks.js` Z. 163), den das Skript nicht abonniert.

### R02-13 · Rioting Village: der Rückstoß eines geliehenen Helden trifft den falschen Helden · Stufe A
- **Karten:** Rioting Village (`rioting-village.js`); gleiche Fehlerklasse überall, wo `source.controller` + `source.heroIdx` zusammen aufgeschlagen werden
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Rioting Village liegt. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`); Sitz 0 spielt „Attack" mit diesem Helden (`charmedOwner: 1`, ATK 80) auf Held 0 von Sitz 1.
- **Erwartet:** Das Ziel verliert 80; der angreifende (geliehene) Held (Sitz 1, Held 1) erhält 40 Rückstoß (760 HP); alle anderen Helden bleiben unversehrt.
- **Beobachtet:** Ziel 720 ✓; der Angreifer bleibt bei 800 HP; stattdessen verliert **Held 1 von Sitz 0** (der gleichindizierte Held des Kontrolleurs) 40 HP (`s0 [800, 760, 800]`). Die Quelle des Treffers lautet `{ owner: 0, controller: 0, heroIdx: 1, heroOwner: 1, usesHeroAtk: true }` – `heroIdx` gilt für die Heldenreihe von `heroOwner`.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/13-rioting-village-rueckstoss-falscher-held.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `rioting-village.js` `afterDamage`: `pi = src.controller ?? src.owner; hi = src.heroIdx; gs.players[pi].heroes[hi]` – statt `src.heroOwner ?? pi` zu benutzen.

### R02-14 · Spatial Crevice bietet unter Siege (Such-Sperre) die Deck-Suche an – die Ja/Nein-Frage wird nicht unterdrückt · Stufe B
- **Karten:** Spatial Crevice (`spatial-crevice.js`), Siege (`siege.js`); gleiche Klasse: jede Suchkarte mit vorgeschalteter `confirm`-Frage ohne `searchToHand`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 trägt Siege an Held 0 (Magic Arts 3). Sitz 1 kontrolliert Spatial Crevice, sein Deck enthält Rioting Village und Stinky Stables. Sitz 1 beendet seinen Zug (Phase Main 2 → End).
- **Schritte:** 1. `engine._isSearchBlocked(1, {}, 'deck')` ⇒ `true` (Siege gilt außerhalb der Resource Phase von Sitz 1). 2. `t.endTurn()` – Crevice löst am Zugende für den Spieler am Zug aus.
- **Erwartet** (Engine-Vorgabe `_engine.js` ~30080, v1117/v1121, Al 15.9.: „Under siege sollten ALLE Search-Galerien/Dialoge unterdrückt sein … Karten wie Deepsea Witch sollten nicht mal ihren optionalen Effekt ANBIETEN"): Sitz 1 wird gar nicht gefragt, ob er sein Deck nach einer Area durchsuchen will.
- **Beobachtet:** Die Ja/Nein-Frage „Search your deck for an Area and add it to your hand?" kommt. Der direkte Aufruf der Klassenmethode `promptGeneric` zeigt: der `confirm` wird nicht unterdrückt (kein `search_prompt_suppressed`), die dahinter liegende Galerie (trägt `searchToHand`) schon. Folge: Der Spieler sagt „Ja", dann passiert nichts. Kartenbilanz unverändert, kein Fehler. (Hinweis: Die Harness-Hülle um `promptGeneric` umgeht die zentrale Unterdrückung, daher belegt das Repro nur das Angebot der Ja/Nein-Frage.)
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/14-spatial-crevice-siege-bietet-suche-an.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `spatial-crevice.js` `onTurnEnd` (~Z. 106): der `confirm` trägt weder `searchToHand` noch `searchPile` (nur die Galerie ab Z. 118 tut es); vorab geprüft wird nur `ps.handLocked`. `_suchQuelleDerAbfrage` (`_engine.js` ~29997) unterdrückt einen `confirm` nur mit `searchToHand: true`.

### R02-15 · Shamanic Curse + Wisdom: der laufende Zauber zählt als bezahlbare Handkarte, der zusätzliche Wisdom-Abwurf wird nie gezahlt · Stufe B (Teil b als Frage)
- **Karten:** Shamanic Curse (`shamanic-curse.js`), Wisdom (Ability)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0, Held 0 mit Destruction Magic 1 + Wisdom 1 spielt Burning Finger (Lv1, ohne Wisdom castbar) auf Held 0 von Sitz 1. Sitz 1 hält Shamanic Curse (Held 0 mit Decay Magic 3, Ja). Das Level steigt auf 2 ⇒ nur noch mit Wisdom castbar (Kosten laut `getWisdomDiscardCost` mit Override 2: 1 Handkarte). Variante A: die Hand von Sitz 0 besteht nur aus dem Burning Finger. Variante B: Burning Finger + 2 Heal.
- **Erwartet** (Kartentext „If the Spell's level is now too high for that Hero to use it, it is negated"; Skript: „Spell survives iff the caster CAN cover it AND has enough hand cards to pay"): A: Sitz 0 hat keine Karte zum Abwerfen (der laufende Zauber ist keine Handkarte) ⇒ Burning Finger wird negiert. B: die 1 Wisdom-Karte für das erhöhte Level wird tatsächlich abgeworfen (oder der Zauber negiert).
- **Beobachtet:** A: der Zauber „überlebt" und trifft (700 HP): `oppPs.hand.length` enthält den laufenden Zauber (gleiche Ursache wie R02-07). B: der Zauber überlebt, es wird nichts abgeworfen (beide Heal bleiben auf der Hand) – das Skript prüft die Bezahlbarkeit nur („we don't charge more").
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/15-shamanic-curse-wisdom.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `shamanic-curse.js` ~Z. 90–100: `affordable = coverable && (oppPs.hand?.length || 0) >= newCost` zählt die laufende Zauberkarte mit (`_handOhneAufloesendeKarte` fehlt) und wirft die Kosten nicht ab.
- **Frage an Al** (Teil b): Soll der durch Shamanic Curse erhöhte Level bei einem Wisdom-Helden den zusätzlichen Wisdom-Abwurf auch wirklich kosten (Ja) oder bleibt er nur eine Bedingung für das Überleben des Zaubers (Nein)?

### R02-16 · Spectral Armor: für eine KREATUR wird die Reaktion nie angeboten · Stufe B
- **Karten:** Spectral Armor (`spectral-armor.js`); verwandt M01-04 (Cloud in a Bottle, gleiche Lücke)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Spectral Armor auf der Hand (Held 0 mit Magic Arts 1 + Support Magic 1), eine Kreatur (1000 HP) in Support Zone 0 von Held 0. Sitz 0 spielt Burning Finger (100 Schaden) auf (a) Held 0, (b) die Kreatur.
- **Erwartet** (Kartentext „Play this card immediately when a target you control would take any damage. Halve that damage (rounded up)."; „target" umfasst Helden und Kreaturen – Strong Shield, „when a target you control would take 300 or more damage", wird für Kreaturen gemessen angeboten): in (a) und (b) die Frage „Spectral Armor" und 50 Schaden.
- **Beobachtet:** (a) ✓ (750 HP). (b) keine Frage, die Kreatur verliert die vollen 100 (900 HP), Spectral Armor bleibt auf der Hand. Gleiches Bild bei direktem `actionDealCreatureDamage` (400 Schaden: Strong Shield wird angeboten, Spectral Armor und Cloud in a Bottle nicht).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/16-spectral-armor-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `spectral-armor.js` sammelt nur Heldenziele (`_collectOwnedHeroTargets`, `postTargetResolve`, `isPreDamageReaction` für `heroIdx`); für Kreaturenschaden fehlt ein Zweig.

### R02-17 · Tarleinn's Floating Island: Heilung einer KREATUR löst „may draw 1 card" nie aus · Stufe B
- **Karten:** Tarleinn's Floating Island (`tarleinn-s-floating-island.js`); Engine `actionHealCreature`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Die Area liegt bei Sitz 0; Sitz 0 hat einen verletzten Helden (500/800) und eine verletzte Kreatur (100/200 HP). Ja auf alle Fragen. (a) `actionHealHero` 100 auf den Helden (Kontrolle), (b) in frischer Szene `actionHealCreature` 100 auf die Kreatur.
- **Erwartet** (Kartentext „Once per turn, when a TARGET a player controls has its HP healed, that player may draw 1 card"; Kreaturen sind Ziele): in (a) und (b) kommt die Frage „Draw 1 card …?" und der Spieler zieht 1 Karte.
- **Beobachtet:** (a) ✓. (b) Die Kreatur wird geheilt (200 HP), aber keine Frage, keine Karte. Das Skript sagt es selbst im Kopf: „Creature heals don't fire afterHeal in the engine, so this card effectively triggers off hero heals" – Kreaturenheiler (Skeleton Healer, Lamenting Knight …) lösen die Area also nie aus.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/17-tarleinn-island-kreaturenheilung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionHealCreature` (`_engine.js` ~10109) feuert `afterHeal` nicht (nur `actionHealHero` ~10093). Die Lücke betrifft jeden Heal-Beobachter, der „target" liest (nicht geprüft, welche außer dieser Area).

### R02-18 · Toxic Trap („is hit by …") öffnet bei einem reinen Flächen-Statuszauber (Poisoned Well) nicht · Stufe C
- **Karten:** Toxic Trap (`toxic-trap.js`); Poisoned Well (`poisoned-well.js`, nicht in der Gruppe)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Toxic Trap in der Surprise Zone von Held 0 (Decay Magic 1). Sitz 0 (Destruction + Decay Magic 3) spielt (a) Flame Avalanche (150 Schaden an alle Ziele des Gegners; Kontrolle) bzw. (b) Poisoned Well („Inflict 1 Stack of Poison to all targets your opponent controls").
- **Erwartet** (Toxic Trap: „Activate this Surprise when the user is hit by an Attack, Spell or Creature effect"; CARD_API (Flächenschlag): „„hit by"-Surprises (Booby Trap) [öffnen bei Flächenschlägen] schon"): in beiden Fällen kommt die Frage „Toxic Trap" und der Angreifer wird vergiftet.
- **Beobachtet:** (a) ✓ (Frage, Held 0 von Sitz 0 vergiftet). (b) keine Frage; Toxic Trap bleibt verdeckt liegen, obwohl alle Helden von Sitz 1 vergiftet werden. Poisoned Well vergibt den Status direkt über `addHeroStatus` (Z. 77) und nicht über `dealDamageToTargets`, das die „hit by"-Fenster öffnet.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/18-toxic-trap-flaechen-status.js` (✗ = Abweichung von meiner Erwartung)
- **Vermutete Ursache:** Statusflächenzauber ohne Schaden laufen an den AoE-Surprise-Fenstern vorbei (`poisoned-well.js` Z. 77–90).
- **Frage an Al:** Zählt „hit by a Spell" auch einen Spell, der nur einen Status verteilt (Poisoned Well) – Ja (Toxic Trap/Booby Trap sollen dann auslösen) oder nein (nur Schaden)?

### R02-19 · Very Special Prisoner holt „Divinity" per direktem Splice aus dem Deck – an der Stapel-Sperre von Knight of Kings [B] vorbei · Stufe A
- **Karten:** Very Special Prisoner (`very-special-prisoner.js`), Knight of Kings [B] (`knight-of-kings-b.js`, Vertrag `blocksOpponentPileOut`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Knight of Kings [B] + Rook of Kings [B] auf dem Brett, Board of Kings in der Area Zone (⇒ `engine.pileOutAllowed(0,'deck')` = `false`). Sitz 0 (Held 0 mit Magic Arts 1) hat Very Special Prisoner auf der Hand, ein Divinity im Deck (Variante A) bzw. auf der Hand (Variante B, Kontrolle) und übernimmt eine Kreatur von Sitz 1 (`actionStealCreature`).
- **Erwartet** (Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile to anywhere else (but they can still draw)"; CARD_API „Kein direktes Splicen an Deck und Ablage"): A: Das Deck ist als Quelle gesperrt – Divinity wird nicht aus dem Deck geholt (Karte nicht angeboten bzw. wirkungslos); B: Divinity von der Hand wird angehängt.
- **Beobachtet:** A: Very Special Prisoner wird angeboten, Divinity wird aus dem Deck gezogen (Deck 3 → 2) und an Held 0 gehängt, obwohl die Sperre gilt. B ✓.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/19-very-special-prisoner-deckklau-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `very-special-prisoner.js` `_availableDivinitySources` (reactionCondition) zählt das Deck ungeprüft, und `resolve` splict `ps.mainDeck` direkt (`removeFromPile`), statt über die Stapel-Schicht (`takeFromPile`/`pileOutAllowed`) zu gehen. Hinweis: gleiche Bauform steht laut Kommentar bei `sacrifice-to-divinity.js` (nicht geprüft).

### R02-20 · Zombified Assault: der Rückschlag trifft bei einem geliehenen Angreifer den falschen Helden · Stufe A
- **Karten:** Zombified Assault (`zombified-assault.js`); gleiches Muster wie R02-13
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Zombified Assault auf der Hand (Held 0, Decay Magic 2), Elven Archer (Lv1, 50 HP) in Support Zone 0 von Held 0. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`, Destruction Magic 2). Sitz 0 spielt mit diesem geliehenen Helden (`charmedOwner: 1`) Burning Finger auf den Archer (besiegt); Zombified Assault wird gespielt (Ja).
- **Erwartet** (Kartentext „… deal damage equal to 50 times the revived Creature's level to the attacking Hero"): Der Archer lebt wieder; der ANGREIFENDE Held (Sitz 1, Held 1) erleidet 50 Schaden (750 HP), alle anderen Helden bleiben unversehrt.
- **Beobachtet:** Der Archer kommt zurück; der Schaden trifft Held 1 von **Sitz 0** (`S0 [800, 750, 800]`), der Angreifer (Sitz 1, Held 1) bleibt bei 800 HP. Normalfall (eigener Held greift an) ✓ (Kontrolle: S0 `[750, 800, 800]`).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/20-zombified-assault-geliehener-angreifer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `zombified-assault.js` `schlageZurueck`: `seite = quellSeite(quelle)` (= `src.controller ?? src.owner`, also der Kontrolleur) und `players[seite].heroes[quelle.heroIdx]`; `heroIdx` gehört aber zur Heldenreihe von `source.heroOwner`. Richtig wäre `quelle.heroOwner ?? seite`.

### R02-21 · Nebenbefund (nicht aus der Kartenliste): Burning Finger liest die Stufe eines geliehenen Wirkers an der falschen Heldenreihe · Stufe B
- **Karten:** Burning Finger (`burning-finger.js`, Gruppe S0x); aufgefallen beim Test der Rückschlag-Karten (R02-13/-20) mit gecharmten Angreifern
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`, Destruction Magic 1). Der gleichindizierte eigene Held 1 von Sitz 0 hat Destruction Magic 3. Sitz 0 spielt Burning Finger („deal 100/160/240 damage") mit dem geliehenen Helden (`charmedOwner: 1`) auf Held 0 von Sitz 1.
- **Erwartet** (Engine-Vorgabe `_engine.js` ~43281, Styx 28.9.: Stufenabfragen lesen die Zonen des geliehenen Helden): Stufe 1 ⇒ 100 Schaden.
- **Beobachtet:** 240 Schaden (Stufe 3 des gleichindizierten eigenen Helden). Kontrolle Heal (Support Magic 1 geliehen / 3 eigen) liefert korrekt 150.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/21-burning-finger-geliehener-wirker-stufe.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doPlaySpell` stempelt `gs._wirkerSeite` nur um `executeCardWithChain` (finally ~Z. 8313); `runHooks('onPlay')` (~Z. 8397) läuft danach ohne Stempel. `burning-finger.js` Z. 27 ruft `effectiveSchoolLevelForCaster('Destruction Magic', pi, heroIdx)` ohne `heroOwner`, der Rückgriff auf `_wirkerSeite` greift nicht mehr. Dieselbe Aufrufform steht in ~24 weiteren Skripten (Liste im Repro-Kopf); ob sie das 4. Argument anders übergeben, wurde nicht einzeln geprüft. In meiner Gruppe nutzen Old Couple, Test Flight und The Melting diese Abfrage (für geliehene Reaktions-Wirker nicht getestet).

### R02-22 · Shamanic Curse prüft bei einem geliehenen Wirker die Stufe am gleichindizierten Helden des Kontrolleurs · Stufe B
- **Karten:** Shamanic Curse (`shamanic-curse.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`, Destruction Magic 1). Der gleichindizierte eigene Held 1 von Sitz 0 hat Destruction Magic 3 (Falle). Sitz 0 spielt mit dem geliehenen Helden (`charmedOwner: 1`) Burning Finger (Lv1) auf Held 0 von Sitz 1. Sitz 1 hält Shamanic Curse (Decay Magic 3) und sagt Ja.
- **Erwartet** (Kartentext „If the Spell's level is now too high for that Hero to use it, it is negated"): Der Wirker (Destruction Magic 1) kann einen Lv-2-Spell nicht wirken ⇒ Burning Finger wird negiert, Held 0 von Sitz 1 bleibt bei 800 HP.
- **Beobachtet:** Der Spell „überlebt" und trifft (560 HP; Höhe der Wirkung siehe R02-21).
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/22-shamanic-curse-geliehener-wirker.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `shamanic-curse.js` `resolve`: `oppIdx = targetLink.owner` (= Kontrolleur), `castingHero = oppPs.heroes[targetLink.heroIdx]` und `getWisdomDiscardCost(oppIdx, castingHi, …)` lesen die Heldenreihe des Kontrolleurs; das Kettenglied trägt `casterOwner` (Brettseite des Wirkers, gesetzt in `doPlaySpell`), das hier nicht verwendet wird.

### R02-23 · Prophecy of Tempeste: der 100-Deckel entfällt bei gefrorenem/betäubtem/negiertem Wirt · Stufe C
- **Karten:** Prophecy of Tempeste (`prophecy-of-tempeste.js` Z. 210 und Z. 324)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 legt Prophecy of Tempeste an Held 0; (a) Wirt ohne Status, (b) gefroren, (c) betäubt, (d) negiert. Sitz 1 trifft Held 0 direkt mit 300.
- **Erwartet** (Kartentext „Damage this Hero would take cannot exceed 100" – statische Regel; Konvention aus dem Light-Ball-Kopf: „Support-Zone Attachments aren't silenced by hero CC", Light Ball/Siege/Royal Treasury/Petrification Break wirken unter CC weiter): jeweils 100 Schaden.
- **Beobachtet:** (a) 100; (b)(c)(d) 300. Unter CC sind Deckel UND Umleitung ausgeschaltet (`if (host.statuses?.frozen || stunned || negated) return;` in beiden Hooks, Kommentar „Host must still be alive + functional"). Die Anweisung von Al vom 22.9. (v1280) nennt CC nicht.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/23-prophecy-of-tempeste-deckel-bei-status.js` (✗ = Abweichung von meiner Erwartung)
- **Frage an Al:** Soll der 100-Deckel (statische Regel) auch bei gefrorenem/betäubtem/negiertem Wirt gelten – Ja – und nur die Umleitung („you may") unter CC ruhen, oder soll der ganze Anhang unter CC ruhen (Nein, wie jetzt)?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Light Ball | L2 gezielt | Abwehr von Held-/Kreaturenstatus ✓, Reinigung beim Anlegen ✓ (unheilbare Negation bleibt), Wirt nicht geschützt ✓, geliehene Kreatur ✓ (Kontrolle-Logik `heroesControlledBy` nur gelesen, Frost/Übernahme des Wirts nicht dynamisch getestet); Unwanted Audience umgeht den Schutz ✗(→ -05); `healReversed` (Overheal Shock) wird nicht als Status gereinigt ✓ |
| Loot the Leftovers | L2 gezielt | Besitzer = Opfer / Killer ✓, Handgrößen 0–3, blinde Wahl ✓, Gifttod löst nicht aus (konsistent mit Ruling 1.9. „Status-Ticks haben keinen Verursacher"), Erst-Runden-Gate ✓; laufender Zauber wird mitgeklaut ✗(→ -07) |
| Looting | L2 gezielt | Auswahl beider Ablagen ✓, Equip landet beim Wirker, Tod des Trägers → Ablage des Ursprungsdecks ✓, Cutlass (nur Cecilia) wird gefiltert ✓, Race Boat/Flying Island wählbar; Control Device am eigenen Helden ✗/C(→ -08) |
| Martyry | L2 gezielt | Held/Kreatur gewählt ✓, User selbst gewählt ✓ (nicht angeboten), User gefroren/tot ✓, Kreatur des Users ✓; Mehrfachziel-Picker ✗(→ -02) |
| MOE Shield | L2 gezielt | Einzelziel-Sperre bis Ende des eigenen nächsten Zuges inkl. Resource Phase ✓ (echter Zugwechsel), Flächenzauber gratis ✓, Kreaturenziel ✓, kein Befund |
| Mountain Tear River | L2 gezielt | Heldenwahl ✓, DM3-Zusatzziele (0/1/2) ✓, DM2 kein Bonus ✓, Host gefroren ✓; Kreatur gewählt ✗(→ -01), Zusatz-Abbruch ✗(→ -09) |
| No Retreat! | L2 gezielt | Flaggenkarten (Guard Duty, Renewable Energy) ✓; ungeflaggte Mischkarten ✗(→ -10) |
| Off Duty | L1 Standard | Standardfall: Karte zurück ins Deck (+1), Ersatzaktion über `heroAction`-Fenster ✓, Kartenbilanz ✓; Zusatzaktions-Fall nicht sauber aufgebaut (nicht getestet) |
| Old Couple | L2 gezielt | Partner-Suche (anderer Name, gleiche Stufe), Sperre „no more summons" bis Zugende ✓ und danach aufgehoben ✓, kein Partner im Deck → nicht angeboten ✓ |
| Overheal Shock | L2 gezielt | Zusatzaktion bei Support 1 / Support 2 / Decay 1 ✓, tödliche Umkehrung (HP 50 + Heilung 100) ✓, Erst-Runden-Gate ✓, Karte → Ablage des Wirkers beim Heldentod ✓; Status nach Abgang der Karte ✗(→ -03) |
| Petrification Break | L2 gezielt | nur betäubt spielbar ✓, Halbierung aufgerundet (1→1, 5→3, 101→51) ✓, True Damage ungehalbiert, Status-Immunität ✓, volle Support Zones → nicht spielbar ✓, zwei Kopien → Viertel, Träger stirbt → Ablage ✓; Tempeste-Zusammenspiel ✗(→ -04) |
| Point-Blank Annihilation | L2 gezielt | zusätzlich zum alten Test: gestohlene Kreatur des Gegners wird besiegt und landet in der Ablage ihres Besitzers ✓ |
| Prayer | L2 gezielt | Abwurf = Zug, Extra-Karte + Ziehsperre ✓, einmal pro Zug ✓, Sperre fällt am Zugende ✓; Ziehsperre vorher ✗/C(→ -11) |
| Prophecy of Tempeste | L2 gezielt | 100-Deckel, Umleitung nur einmal pro Zug, Kreaturenschaden-Umleitung, Limit „1 in play" (je Spieler) ✓; Reduktion trotz „cannot be reduced" ✗(→ -04), Deckel unter CC C(→ -23) |
| Quest of the Chosen One | L2 gezielt | Ziehen max. 3 je Zug und Kopie ✓, Ability an anderem Helden zählt nicht ✓, neuer Zug setzt zurück ✓, Zusatzaktion gegen alle Abilities ✓; unter Ziehsperre wird trotzdem gefragt (kosmetisch, nicht gemeldet) |
| Rioting Village | L2 gezielt | ATK-Verdopplung beider Seiten ✓, Rückstoß ceil(Schaden/2) ✓, Attack-Limit 1/Zug ✓; Kreaturenziel ✗(→ -12), geliehener Angreifer ✗(→ -13) |
| Rolling Boulder | L2 gezielt | Kreatur gewählt/eigenes Brettziel ✓, gestohlene Kreatur → Ablage ihres Besitzers ✓, Host gefroren → keine Auslösung ✓; Mehrfachziel-Picker ✗(→ -02) |
| Royal Treasury | L2 gezielt | 4/6/8 nach Magic-Arts-Stufe, 3 Mal pro Zug, Reset im neuen Zug, Steal-Gold zählt, Gain 0 nicht, Wirt tot → kein Bonus, Level 0 zählt wie 1, übernommener Wirt → Kontrolleur bekommt den Bonus ✓ |
| Rusty Touch | L2 gezielt | Equip (Jetpack 4) und Artifact Creature (Powder Keg 4) ✓, Gold wird mit der WIRKSAMEN Kostenreduktion gezahlt (Laser Cannon 20) ✓, Kartenbilanz ✓; Normal-Artifact ohne Kosten (Renewable Energy) war im Aufbau nicht spielbar |
| Shamanic Curse | L2 gezielt | Stufe +1: DM1-Held bei Lv1-Spell negiert, DM2 bei Lv1 überlebt ✓, Zusatzaktion-Fenster ✓; Wisdom-Pfad ✗/B(→ -15), geliehener Wirker ✗(→ -22) |
| Shared Blood Tanks | L2 gezielt | Kettenschaden an andere blutende Ziele (Helden + Kreatur) ✓, Area beider Seiten (doppelte Kette, kein Kreisel) ✓, toter Held übersprungen ✓, Gegner-Bleed trifft Gegnerseite ✓ |
| Siege | L2 gezielt | Sperre nach Kontrolle (übernommener Träger) ✓, Resource-Phase-Ausnahme, Kartenbilanz unter Sperre ✓; Crevice-Frage ✗(→ -14) |
| Silence | L2 gezielt | Negation, genau ein Zusatz-Spell, danach gesperrt ✓, nächster Zug frei, einmal pro Spiel ✓; Attack danach nicht sauber aufgebaut (nicht getestet) |
| Skull Carpet Bombing | L2 gezielt | (Vorgänger-Messung) Gegnerseite / selbst gelegt (beide) / nach Schaden keine Auslösung / zwei Exemplare nur eins / Unentschieden → Nutzer gewinnt ✓; echter Frost/Betäubung am Host verhindert Auslösung ✓ |
| Spatial Crevice | L2 gezielt | Limit 3 / 4. Area abgelehnt ✓, Crevice weg → Wahl bis Limit 1 ✓, Gegner-Area-Limit 1 ✓, Suche für den Spieler am Zug (auch Gegner) ✓; Frage unter Such-Sperre ✗/B(→ -14) |
| Spectral Armor | L2 gezielt | Held 100 → 50 ✓; Kreatur ✗(→ -16) |
| Spike Trap | L2 gezielt | Gegenzug „2 Karten abwerfen" (nur bei ≥ 2 Handkarten angeboten; Fizzle statt Negation ✓), 200 Schaden an Angreifer ✓, geliehener Angreifer trifft den richtigen Helden ✓, Reihenfolge zweier Surprises ✓; laufende Spielkarte als Abwurfkarte ✗(→ -07) |
| Stealthy Pursuit | L2 gezielt | Karte wird gelöscht ✓, T+2-Frist, Anti-Lock (anderer wählbarer Held; die Wahl bietet den geschützten Helden nicht an) ✓; echter Flächenschaden und der Fall „alle anderen Helden tot" nicht getestet |
| Stinky Stables | L2 gezielt | vergifteter Held/Kreatur nicht heilbar, nicht vergiftete heilen ✓, Giftentfernung blockiert ✓ |
| Surprising Opportunity | L1 Standard | nur alte Tests (Besitzer-Reihenfolge, Token, fremde Kreaturen, Frostschutz); keine neue Nische |
| Tarleinn's Floating Island | L2 gezielt | Held-Heilung löst Frage und Ziehen aus ✓ (einmal-pro-Zug-Slot und Slot-Rückgabe bei Ablehnung nur im Skript gelesen); Kreaturenheilung ✗(→ -17) |
| Temple of Sacrifice | L2 gezielt | Action Phase / Main 1 / Main 2 × Opfer ja/nein, Karte zurück bei Ablehnung in Main Phase ✓, Zug-Beschwörung nicht opferbar ✓, Sacrifice to Divinity / Divine Gift of Sacrifice lösen Ziehen aus (beide Seiten) ✓ |
| Test Flight | L2 gezielt | Fenster bei 1 gewähltem Held ✓, 2 Ziele (nur der Geschützte wird negiert) ✓, Held ohne Magic Arts ✓; zweite Kopie wird nach erfolgreicher Negation noch einmal angeboten (kosmetisch, nicht gemeldet) |
| Tharxian Horse | L2 gezielt | Zielzahl-Schaden, toter Held zählt nicht, Wiederbeleben als Zusatzaktion ✓, einmal pro Spiel ✓, geliehener Angreifer ✓ (Vorgänger + eigene Messung) |
| The Master's Plan | L2 gezielt | Matrix Ability / Equip / Area / Creature / Artifact / Potion / Attack: Karte → Ablage, Aktion nur wo sie gekostet hat ✓; Surprise-Platzierung bleibt verdeckt (Bauart) |
| The Melting | L1 Standard | nur alte Tests (Front-Soldier-Zusammenspiel, Zug beenden); keine neue Nische |
| Toxic Trap | L2 gezielt | Host gefroren/betäubt/negiert/tot ✓, gewählt + Flächenschlag (Flame Avalanche) ✓, Angreifer geliehen ✓, Reihenfolge zweier Surprises ✓; Flächen-Statuszauber ✗/C(→ -18) |
| Trample Sounds in the Forest | L1 Standard | Aufstieg Dajan → Reaktion, zweite Kopie derselben Runde gesperrt ✓ |
| Triumphant Return | L1 Standard | nur alte Tests |
| Unwanted Audience | L2 gezielt | spät beschworene Kreatur ✓, übernommene Kreatur ✓, Ablauf am Ende des Gegnerzugs ✓; Light Ball ✗(→ -05), Bomb Mite ✗(→ -06) |
| Very Special Prisoner | L2 gezielt | Quelle Hand/Deck, Auswahl, Anhängen ohne Zusatz-Budget ✓; Deck-Sperre ✗(→ -19) |
| Weapon Absorption | L2 gezielt | Mehrfachabwurf + Heilkappung ✓, Kartenbilanz ✓ (der Dauerfeuer-Lead „+2 Destruction Magic" ist die Gratis-Schule des Angreifers im Testaufbau, kein Verlust) |
| Zombified Assault | L2 gezielt | Flächenschlag tötet drei Kreaturen → Wahl einer ✓, Rückschlag 50 × Stufe ✓, Zone belegt → Ausweichzone; geliehener Angreifer ✗(→ -20) |


## Getestet & in Ordnung (Auswahl)
- **Normalfälle sauber:** Alle Karten der Liste laufen im Standardaufbau ohne Engine-Fehler (`t.errors` leer) und mit sauberem `t.audit()`; Kartenbilanzen (`t.census()`) stimmen – auch bei Raub (Loot), Wiederbelebung (Zombified Assault), Negation (Master's Plan, Rusty Touch, Silence).
- **Sperren und Kontrolle:** Siege und Royal Treasury folgen dem Kontrolleur eines dauerhaft übernommenen Wirts (gemessen: Siege-Sperre wechselt die Seite, Royal-Treasury-Bonus geht an den neuen Kontrolleur); bei Light Ball nur der Code gelesen (`_lightBallProtects` zählt `heroesControlledBy`). Rückschlag-Surprises (Spike Trap, Toxic Trap, Mountain Tear River, Tharxian Horse) treffen bei einem geliehenen Angreifer den richtigen Helden.
- **Gestohlene Kreaturen sterben in die richtige Ablage:** Rolling Boulder und Point-Blank Annihilation legen eine übernommene Kreatur in die Ablage ihres Besitzers.
- **Einmal-pro-Zug/-Spiel:** Silence (einmal pro Spiel, genau ein Zusatz-Spell), Old Couple (Sperre bis Zugende, danach frei), MOE Shield (Ziehsperre bis zum Ende des eigenen nächsten Zuges, danach normal), Quest (3 Karten je Zug und Kopie), Royal Treasury (3 Auslösungen, Reset im neuen Zug), Tharxian Horse (einmal pro Spiel).
- **Areas:** Spatial Crevice (3 verschiedene Areas, 4. abgelehnt, Wegfall → Wahl bis Limit 1, Gegner behält Limit 1), Shared Blood Tanks (Area beider Seiten ohne Kettenkreisel), Stinky Stables (Heilung/Giftentfernung vergifteter Ziele blockiert, andere nicht).
- **Zeitfenster:** Surprise-Host gefroren/betäubt/negiert/tot löst Toxic Trap nicht aus; zwei Surprises auf verschiedenen Helden feuern in Heldenreihenfolge; negiert Spike Trap den Zauber, fällt der zweite Host aus dem Fenster.
- **Gewollt laut Ruling/Skript (kein Befund):** Gifttod löst Loot the Leftovers nicht aus (Status-Ticks haben keinen Verursacher, Ruling 1.9. bei Skull Carpet Bombing); Prophecy of Tempeste leitet bei CC des Wirts nicht um (Skriptentscheidung, nur die Deckel-Folge ist als -23 gemeldet); Royal Treasury zählt Magic Arts 0 wie 1.

