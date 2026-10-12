# B – Querschnitts-Bericht (Engine-Verträge und Regeln, die jede Karte betreffen)

Stand/Autor: Hauptlauf, 12.10.2026. Dieser Bericht sammelt Befunde, die nicht zu einer einzelnen Karte gehören, sondern zu einem **Vertrag der Engine**, den viele Karten
benutzen (Statusfilter für Dauereffekte, Sperren, Erst-Runden-Immunität, Abbruch-Regel). Gemessen wurde mit den breiten Batterien (Kaltstart ×10 Zustände ×1100 Karten,
Dauerfeuer ×20 Ereignisse ×1205 Karten) und gezielten Wächter-Lücken-Prüfungen. Alle Repros: `docs/niche-tests/repro/B-querschnitt/`.

## Zusammenfassung

| ID | Titel | Stufe | Repro |
|---|---|---|---|
| B-01 | The Thing in the Ship sperrt Ability-Aktivierungen auch gefroren/betäubt/negiert | B/C | `01-thing-in-the-ship-gefroren.js` |
| B-02 | Plant Golem sperrt den Wirtsheld auch gefroren/betäubt (nur „negiert" hebt auf) | B/C | `02-plant-golem-gefroren.js` |
| B-03 | Elven Forager senkt Stufen auch gefroren/betäubt/negiert | B/C | `03-elven-forager-gefroren.js` |
| B-04 | Debt-O-Tron Model Backup Duplicator unter Such-Sperre unspielbar (Artifact/Creature fällt durch die Kreaturen-Ausnahme) | B | `04-debt-o-tron-duplicator-such-sperre.js` |
| B-05 | Erste-Runden-Immunität: 7 Karten wirken trotzdem auf den geschützten Spieler | B | `05-erstrunden-immunitaet-luecken.js` |
| B-06 | Erste-Runden-Gate fehlt: ≥ 16 reine Gegner-Karten werden in Zug 1 verbraucht, ohne zu wirken (auch Einmal-pro-Spiel-Kontingente) | B | `06-erstrunden-gate-verbrauchte-karten.js` |
| B-07 | `resolveSacrificeCost`: CPU-Abbruch `[]` = Endlosschleife (nur CPU-Sitz im Normalspiel; latent) | C | `07-opferwahl-cpu-abbruch-endlosschleife.js` |
| B-08 | **Phoenix Tackle**: Niederlage-Klausel fehlt – bei Gleichstand gewinnt der Wirker statt zu verlieren | **A** | `08-phoenix-tackle-niederlage-klausel.js` |
| B-09 | Ghazma: „defeated Creatures are deleted" gilt auch bei gefrorenem/betäubtem Ghazma (nur negiert/tot ruhen) | B/C | `09-ghazma-passiv-bei-gefroren.js` |

Zusätzliche Querschnittsbeobachtungen (Abbruch-Konformität, Sperren-Auto-Erkennung, Einmal-pro-Spiel-Stempel) stehen unten unter „Gemessen".

---

## Befunde

### B-01 · The Thing in the Ship – Ability-Sperre trotz Stilllegung · Stufe B/C
- **Karten:** The Thing in the Ship (`blocksAbilityActivation`).
- **Aufbau:** Sitz 1 hat die Kreatur auf dem Brett; sie wird gefroren / betäubt / negiert (`applyCreatureStatus`, `actionNegateCreature`). Prüfung: `engine.abilityActivationBlocked()`.
- **Erwartet:** Die Konvention der Engine ist, dass eine gefrorene/betäubte/negierte Kreatur ihre Effekte verliert (`engine.isCreatureEffectSuppressed(inst)`, zentrale Aussage; wird von den Hook-Verteilern, `blocksOpponentPileOut`, `protectsCreatureEffects`, Duigno u. a. beachtet). Kartentext: „While this Creature remains on the board, NEITHER PLAYER can activate the active effects of their Abilities." – wörtlich „solange sie auf dem Brett liegt"; nach der Konvention sollte eine stillgelegte Kreatur aber nicht mehr sperren.
- **Beobachtet:** `abilityActivationBlocked()` = `true` in allen vier Zuständen (`isCreatureEffectSuppressed` ist dabei `true`). Die Methode (`_engine.js` ~10729) prüft nur „liegt eine offene Kreatur mit dem Flag auf dem Brett".
- **Frage an Al:** Soll die Sperre von Frost/Betäubung/Negation aufgehoben werden (Konvention) oder gilt „liegt auf dem Brett" wörtlich?

### B-02 · Plant Golem – Heldensperre trotz Frost/Betäubung · Stufe B/C
- **Karten:** Plant Golem (`blocksHostHeroActions`).
- **Aufbau:** echte Beschwörung (Golem landet auf der Seite des Gegners), danach Golem gefroren / betäubt / negiert; Prüfung `engine.canHeroPerformAction(1, 0)` (Wirtsheld).
- **Erwartet:** wie B-01 – ein stillgelegter Golem sperrt nicht.
- **Beobachtet:** normal: gesperrt ✓. **negiert: frei ✓.** **gefroren und betäubt: Wirtsheld bleibt gesperrt.** `canHeroPerformAction` (_engine.js ~43410) prüft nur `inst.counters.negated`, nicht die übrigen Zustände von `isCreatureEffectSuppressed` (frozen/stunned/nulled/magic_silenced; Chilly-Dog-Ausnahme; Negations-Wächter).
- **Frage an Al:** Soll ein gefrorener/betäubter Golem den Helden freigeben?

### B-03 · Elven Forager – Stufensenkung trotz Stilllegung · Stufe B/C
- **Karten:** Elven Forager (`reduceCardLevel`), betrifft denselben Weg: Chaorc Ruin Mourner, Embodiment of Biseria, Ethan the Prodigy, Phatnir, Queen of Kings [W], Slippery Whoolmoth, The Weather Orchestra, Thrysh (alle `reduceCardLevel`-Kreaturen) – nur Forager ließ sich mit der generischen Sonde sichtbar machen, die anderen brauchen eigene Szenen.
- **Aufbau:** Held 0 mit Summoning Magic Lv1, „Elven Leader" (Lv2) auf der Hand, Forager auf dem Brett: normal ⇒ Leader beschwörbar (Lv2−1). Forager gefroren/betäubt/negiert ⇒ erwartet nicht beschwörbar.
- **Beobachtet:** Leader wird in allen drei Zuständen beschworen. Der Stufensenker-Weg (`_applyCardLevelReductions`, _engine.js ~43930) schaut nur auf `inst.isActiveIn()` (Zone), nicht auf `isCreatureEffectSuppressed`.
- **Frage an Al:** wie B-01. Hier ist die Folge spielentscheidend (Beschwören/Zaubern über die eigene Stufe hinaus mit stillgelegter Kreatur).

> **Einordnung B-01…B-03:** Dieselbe Klasse. Die Engine hat *eine* zentrale Aussage zur Stilllegung, aber jeder Vertrag, der Dauereffekte außerhalb des Hook-Verteilers liest, muss sie selbst abfragen.
> Gezählt (statische Prüfung der Verbraucher, `grep` im Umkreis ±18 Zeilen): **mit** Status-Prüfung: `protectsCreatureEffects`, `blocksOpponentPileOut`, `liftsFrozenSilenceForOwnSide`, `isCreatureReaction`,
> `isGerrymander`, teilweise `blocksHostHeroActions` (nur negated) und Duigno (`sperrtZusatzaktionenNachVerbrauch`, dynamisch bestätigt: respektiert Frost/Betäubung/Negation).
> **Ohne** Prüfung: `blocksAbilityActivation`, `reduceCardLevel`/`globalReduceCardLevel` (Kreaturen-Senker), `immuneToSourceNames` (Ifrit), `isDestroyReaction`/`isCreaturePreDefeatReaction`
> (Enhanced Guard Dog / Loyal Bone Dog), `takesControlOfTargets`, `selfDeleteOnExternalDiscard`, `deletesSelfOnDeath`, `cannotBeRevived`. Nicht jeder davon ist ein Fehler (manche sind statische Eigenschaften);
> die Liste ist als Prüfauftrag gedacht. Alle Hook-basierten Kreatureneffekte laufen über den zentralen Verteiler und waren im Dauerfeuer (1200 Karten) fehlerfrei.

### B-04 · Debt-O-Tron Model Backup Duplicator – unter Such-Sperre unspielbar · Stufe B
- **Karten:** Debt-O-Tron Model Backup Duplicator (Artifact/Creature).
- **Aufbau:** Sitz 0 hat −20 Gold, die Karte und eine Handkarte; `ps.searchLocked = true` (Cats of the Pharaoh u. ä., Stufe „Deck").
- **Erwartet:** Karte spielbar. Die Engine nimmt Kreaturen von der Such-Sperren-Auto-Erkennung aus, ausdrücklich weil „eine Kreatur auf dem Brett Körper, HP und Trigger über ihren Such-Effekt hinaus" hat (`_cardBlockedBySearchLock`, _engine.js ~10770). Der Duplicator sucht nicht beim Ausspielen, sondern per Trigger.
- **Beobachtet:** `doPlayArtifact`/`doPlayCreature`/`doUseArtifactEffect` lehnen ab. Ursache: Die Ausnahme prüft `cardData.cardType === 'Creature'`; die Karte hat `cardType: 'Artifact'`, Subtyp `Creature`. Der Lader hat sie als `blockedBySearchLock` markiert (sie ist die einzige Artifact/Creature mit Sperr-Marke).

### B-05 · Erste-Runden-Immunität: Karten wirken auf den geschützten Spieler · Stufe B (zwei C-Randfälle)
- **Regel:** CARD_API.md „Turn-1 Immunity": „during turn 1, every card belonging to the non-turn player is completely immune to anything the turn player can do." `engine.startGame()` setzt dazu `firstTurnProtectedPlayer` und den Status `shielded` auf alle Helden des zweiten Spielers.
- **Aufbau:** echter Spielstart (`engine.startGame()`), Sitz 0 spielt in Zug 1 die Karte, Sitz 1 hat 5 Handkarten, 20 Deckkarten, 20 Gold, leeres Brett.
- **Beobachtet (✗ im Repro):**
  * **Love Shot** zieht eine Karte aus dem Deck des geschützten Spielers („Draw a card from your opponent's deck").
  * **Plant Golem** und **Elusive Hind** werden in eine Support Zone des geschützten Helden gesetzt (der Golem sperrt dessen Aktionen – über Zug 1 hinaus in den eigenen ersten Zug des Gegners).
  * **Future Tech Control Device** wird an einen geschützten Helden ausgerüstet („Equip this card to a Hero your opponent controls").
  * **Market Crash**: setzt das Gold des geschützten Spielers auf 0.
  * **Pillar of Light**: zwingt den geschützten Spieler zur Deck-Suche, Karte kommt auf seine Hand.
  * **Birthday Present**: schenkt dem geschützten Spieler eine Handkarte.
- **C-Randfälle** (nur im Aufbau mit künstlichem Brett aufgefallen, nicht mit echter Startlage geprüft): *The Sacred Jewel* („make both players draw 1 card") zieht auch für den Geschützten; *Medusa's Curse* legt den Puffer „medusa_petrified" (Schaden 0) auf alle geschützten Helden, obwohl die Betäubung abgewehrt wird; *Rioting Village* verdoppelt als globale Area auch den ATK der geschützten Helden.
- **Frage an Al:** Gilt die Immunität auch gegen *vorteilhafte* oder *zustandsändernde Nicht-Schadens*-Effekte (Karte schenken, Gold zurücksetzen, Karte hinlegen)? Die Engine schützt Schaden/Status/Discard/Mill/Ziele, nicht Platzierung, Deck-Zug, Gold, Geschenke.

### B-06 · Erste-Runden-Gate fehlt bei reinen Gegner-Karten · Stufe B
- **Regel:** CARD_API.md „Turn-1 Immunity" verlangt ausdrücklich ein *Spielgate* („If EVERY mode of your card targets the opponent, gate the whole card off … Fizzling mid-resolution instead is worse").
- **Aufbau:** wie B-05; Sitz 0 spielt in Zug 1 eine Karte, die nur den Gegner trifft.
- **Beobachtet (16 Karten, alle ✗):** Butterfly Cloud, Flame Avalanche, Boiling Oil, Rain of Arrows, Forbidden Zone, Future Tech Bomb, Laser Volley, Poisoned Well, Smoke Vial, Iceage, Trial of Dominance, Trial of Annoyance,
  Divine Gift of Forgetting, Slow, Chain Lightning, Big Oopsie: die Karte ist spielbar, verlässt die Hand, die Aktion ist verbraucht – es passiert nichts. **Bei Trial of Dominance, Trial of Annoyance und Divine Gift of Forgetting
  ist zusätzlich das „once per game"-Kontingent verbraucht** (`_oncePerGameUsed`), bei den Trials gilt außerdem „You cannot play other Attacks or Spells the turn you play this card".
  Zum Vergleich: **Fireball** (Zielwahl) ist korrekt gegated – bleibt auf der Hand, weil kein Ziel wählbar ist. Die Lücke betrifft Karten *ohne* Zielwahl (Flächen- und Gegner-Karten).
- Weitere Kandidaten der Vorrunde (Text nennt Gegner, in Zug 1 verbraucht, Seite 1 unverändert) stehen in der Liste der Durchläufe (`scratchpad/out/wasted-*.jsonl`); einige davon haben legitime Eigenwirkung und sind hier absichtlich nicht aufgeführt.

### B-07 · `resolveSacrificeCost`: CPU-Abbruch ist eine Endlosschleife (latent) · Stufe C
- **Karten:** alle Karten, die über `engine.resolveSacrificeCost(… cancellable: true)` eine Opferwahl öffnen (z. B. Sacrifice to Divinity).
- **Beobachtet:** Der CPU-Standard antwortet auf abbrechbare Zielwahlen mit `[]`; `resolveSacrificeCost` wertet nur `null` als Abbruch, `[]` als „zu wenig gewählt" und fragt unbegrenzt neu. Die Notbremse `_cpuGibtAuf` ist an `gs.isSkillTest` gekoppelt (nur Skill-Test-Modus). Mensch: `null` ⇒ sauberer Abbruch ✓. Im Test: > 300 Wiederholungen.
- **Relevanz:** nur, wenn ein CPU-Sitz im Normalspiel (Einzelspieler/Puzzle) eine abbrechbare Opferwahl bekommt und sein Brain `[]` liefert. Der CPU-Pilot (`installCpuBrain`) ersetzt `_getCpuTargetResponse` vermutlich mit Wahl-Logik – nicht geprüft.
- **Frage an Al:** Soll `[]` bei `cancellable: true` ebenfalls als Abbruch gelten (Engine-seitig)?

### B-08 · Phoenix Tackle – die Niederlage-Klausel ist nicht umgesetzt · Stufe A
- **Karten:** Phoenix Tackle (Spell, Destruction Magic Lv1).
- **Aufbau:** Beide Seiten haben nur einen Helden (Wirker 40 HP, Gegner 50 HP). Der Wirker zielt mit Lv1 (100 Schaden) auf den Gegner-Helden und erleidet 50 Rückstoß.
- **Erwartet** (Kartentext: „Then, the user receives 50/100/150 recoil damage. If all Heroes both players control are defeated after this Spell resolves, you lose the game."): beide letzten Helden fallen ⇒ der Wirker **verliert** (Sieger Sitz 1).
- **Beobachtet:** Sieger ist Sitz 0 (`all_heroes_dead`). Das Skript kennt die Klausel nicht (kein „lose", kein `_deferGameOverCheck`): der Tod des Gegner-Helden entscheidet das Spiel zugunsten des Wirkers, bevor der Rückstoß kommt; der Rückstoß tötet den Wirker erst danach. Die Klausel kam mit der Kartentextänderung im Commit 4db2f97 („Structure Deck End of the World", 9.10.) – das Skript wurde damals nicht angepasst (Skriptkopf: „Caster CAN die to recoil").
- **Repro:** `docs/niche-tests/repro/B-querschnitt/08-phoenix-tackle-niederlage-klausel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/phoenix-tackle.js` (Rückstoß am Ende von `onPlay`, ~Z. 118–123): ohne Aufschieben der Spielende-Prüfung (`gs._deferGameOverCheck`, Vorbild `last-resort.js`/`bunny-bombs.js`) und ohne Auswertung „alle Helden beider Seiten besiegt ⇒ Wirker verliert".
- **Gegenprobe:** Die übrigen Karten mit Spielende-Klauseln verhalten sich laut Text: Armageddon (4 Varianten inkl. Gleichstand ⇒ Wirker verliert), Last Resort, Bunny Bombs (Gleichstand ⇒ Besitzer verliert), Duel (Gleichstand ⇒ Wirker gewinnt, auch bei weiteren lebenden Helden – im Skriptkopf als Lesart dokumentiert), Skull Carpet Bombing (4 Varianten), Carris (3. Zeitmarke ⇒ Niederlage, kein Schaden), Teleportation Powder (Spieler verliert nicht, Held kehrt zum Beginn des nächsten Zuges zurück). Doom Clock und Cardinal Beasts (Sieg mit 4 Bestien) haben ihren Spielende-Code in den Shared-Modulen (von den Gruppenberichten geprüft). Clash of Champions hat kein Skript.

### B-09 · Ghazma – „Creatures that are defeated are deleted" gilt auch bei gefrorenem/betäubtem Ghazma · Stufe B/C
- **Karten:** Ghazma, the Worm Feeder (`defeatedCreaturesAreDeleted`, ausgewertet in `_gefalleneKreaturenGeloescht`, `_engine.js` ~12690).
- **Aufbau:** Ghazma als Held 0 von Sitz 0; eine Kreatur von Sitz 1 wird besiegt (`actionDestroyCard`). Ghazma normal / tot / negiert / gefroren / betäubt.
- **Erwartet:** Konvention der Engine: gefrorene, betäubte, negierte und tote Helden verlieren ihre Heldeneffekte (`_isHeroEffectSilenced`, zentrales Tor im Hook-Verteiler ~3250). Nur bei arbeitendem Ghazma wird gelöscht.
- **Beobachtet:** normal ✓ (gelöscht), tot ✓ (Ablage), negiert ✓ (Ablage); **gefroren ✗ und betäubt ✗: die Kreatur wird weiterhin gelöscht.** Die Funktion prüft nur `hp > 0` und `statuses.negated`. Der Kommentar dort sagt ausdrücklich „LEBENDER, nicht negierter Held" – möglicherweise Absicht; die Lücke zu Frost/Betäubung ist nicht kommentiert.
- **Repro:** `docs/niche-tests/repro/B-querschnitt/09-ghazma-passiv-bei-gefroren.js` (✗ = Fehler tritt auf)
- **Frage an Al:** Soll ein gefrorener/betäubter Ghazma das Löschen einstellen (wie alle anderen Heldenpassive)?
- **Einordnung:** Dieselbe Klasse wie B-01…B-03 für Helden. Der Differenztest „Fähigkeit/Heldenpassiv eines toten/gefrorenen/betäubten/negierten Helden bleibt stumm" (Dauerfeuer, 195 Helden und 35 Abilities, je 4 Zustände, gegen Grundlinie ohne X) fand außer Ghazma **keine** weitere Abweichung bei den Hook-Passiven; Karten mit `bypassStatusFilter` (Resistance, Tri Fecta/Ad, Carris, Karian, Fiona, Beato, ???, Rha'Bi, Wall Breaker, Heragas, Inya) ruhen erwartungsgemäß nicht. Nicht abgedeckt (kein Auslöser im Dauerfeuer): die übrigen engine-gelesenen Heldenverträge ohne Status-Prüfung in der Nähe der Verbraucher – `equipCostReduction`, `canBypassLevelReqForCard`/`canPlayCard`, `goldStateRule`/`goldOverdraft` (Kent/Logan), `waivesDiscardCosts`/`offerDiscardSkip` (Boris), `immuneToSourceNames` (Damus), `chargesPerTurn`; sie gehören zu den Heldengruppen H01–H04.

---

## Gemessen (ohne Befund) und Beobachtungen

* **Dauerfeuer** (`lib/barrage.js`): 1205 Skript-Karten (ohne Tokens) × (beide Seiten; Abilities in Stufe 1 und 3), je 20 Ereignisse. **Keine** verschluckten Engine-Fehler, kein Hänger, kein NaN. Zustandsprüfer meldete nur Fehlalarme
  (`_ZoneBlocked`-Platzhalter, seitenfremd beschworene Kreaturen zählen physisch auf der Gegnerseite, Pseudonia-Heldeninstanzen). Kartenbilanz ohne Verlust (außer Tokens).
* **Kaltstart** (`lib/coldplay.js`): 1009 Karten (alles außer Helden/Tokens) × 10 Zustände. Keine Ausnahme, kein Hänger. Spielbarkeit im Zustand »volles Brett« je Typ: Creature/Normal 300 von 337; Spell/Normal 112 von 172; Equipment 73 von 91;
  die nicht spielbaren brauchen Bedingungen (Zustand, Reaktionsfenster, Ziel-Voraussetzungen).
* **Abbruch-Konformität** (Regel 23.9 „Abbruch heißt: nichts ist passiert"), Abbruch jeder Zielwahl mit `null`: Spells 41/44 konform, Attacks 23/25, Attachments 7/7. Abweichler:
  Cold Coffin & Eraser Beam (Kosten-Tokens bleiben liegen, Eraser Beam stempelt zusätzlich „once per game" – dann ist die Karte nie wieder spielbar), Love Shot (Teilauflösung), Duel (Abbruch auch der Gegnerwahl künstlich),
  Weapon Storm (40 Wiederholungen), Alliance. **Kreaturen mit Zielwahl im Einsatz-Effekt: 11 von 12 bleiben nach Abbruch auf dem Brett** (Deepsea Werewolf/Mummy/Reaper/Siren/Succubus, Fiery/Icy/Slimy/Sparky Slime, Sleeping Beauty,
  Wire Hatchling); nur „500 Piranhas in a Monster Suit" nimmt die Beschwörung vollständig zurück. Absicht oder Lücke ist offen – die Gruppenberichte A02/A05 gehen darauf ein.
* **Einmal-pro-Spiel-Stempel bei Abbruch** (33 Karten, Abbruch → erneut spielen → Zweitkopie): bei **32 von 33 sauber** (kein Stempel bei Abbruch, danach spielbar, nach Erfolg gesperrt). Einzige Ausnahme: **Eraser Beam** – stempelt bei Abbruch.
* **Sperren-Auto-Erkennung des Laders** (`blockedByHandLock/PileLock/SummonLock/SearchLock`, Regex über den Quelltext) – 5 Fehlmarkierungen gefunden, aber **ohne beobachtbare Folge**, weil die betroffenen Karten nicht über die auswertenden Wege laufen:
  Rainbow's Arrow (zieht *und* +10 Schaden; als `blockedByHandLock` markiert – als Reaktion trotz Hand-Lock angeboten, +10 gilt, Ziehen entfällt ✓), Anti Magic Enchantment und Divine Gift of the Guardian (als
  `blockedByPileLock` markiert, weil `takeFromPileSync(ps,'hand',…)` die Zeichenkette `takeFromPile` enthält – sie laufen über Hand-Hooks, die das Flag nicht lesen), Heart of Cards (Hand-Lock-Marke trotz „delete top card"-Zweig).
  Nur B-04 hat eine sichtbare Folge.
* **Stand der „pro Zug"-Flags**: statische Suche nach `…Turn…`-Flags auf Spieler/Held in allen Skripten – fast alle mit Zugnummern-Stempel (selbstverfallend) oder im Zugbeginn zurückgesetzt. Offen: `hero._maxActionsPerTurn` (Friedhelm) – Heldengruppe prüft.
