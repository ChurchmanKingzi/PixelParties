# A06-rebelliokai – Nischenfall-Bericht
Stand/Autor: Agent A06-rebelliokai, 12.10.2026. Karten: 67 in der Liste · (wird fortlaufend ergänzt) · (wird fortlaufend ergänzt).

## Zusammenfassung
(Arbeitsstand – wird am Ende zusammengefasst. Bisher bestätigt: siehe Befunde.)

## Befunde

### A06-rebelliokai-01 · Sculpture Theft bietet auch früher gefrorene Kreaturen an · Stufe B
- **Karten:** Sculpture Theft (`cards/effects/sculpture-theft.js`), The White Army (Auslöser)
- **Voraussetzungen / Aufbau:** Sitz 0 hält The White Army und zwei Dummy-Kreaturen (Level 0), Sitz 1 hält Sculpture Theft (Held 0 mit Magic Arts 1). Auf Sitz 1 steht eine bereits früher gefrorene Dummy-Kreatur und eine frische Loyal Beagle. Seed 1234.
- **Schritte:** 1. Sitz 0 spielt The White Army und wählt die Beagle (Freeze 1 Zug). 2. Sitz 1 nimmt die Reaktion Sculpture Theft an.
- **Erwartet** (Quelle: Kartentext „Play this card immediately when one or more Creatures are Frozen. Choose one of **those** Creatures and add it to your hand."): wählbar sind nur die durch das auslösende Ereignis gefrorenen Kreaturen (hier nur die Beagle).
- **Beobachtet:** Die Zielwahl bietet beide gefrorenen Kreaturen an, auch die schon vorher gefrorene Dummy-Kreatur.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/01-sculpture-theft-alte-ziele.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sculpture-theft.js:86-100` (`resolve` sammelt alle `inst.counters.frozen` des Bretts statt der Ziele aus `chainCtx.hookCtx.targets`/`target`).

### A06-rebelliokai-02 · Loyal Bone Dog wird bei Zerstören/Opfer nicht angeboten · Stufe C
- **Karten:** Loyal Bone Dog (`loyal-bone-dog.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Bone Dog auf der Hand, Held 0 mit Summoning Magic 1, Loyal Beagle auf dem Brett. Gegner zerstört die Beagle (`actionDestroyCard`, kein Schaden).
- **Erwartet** (Quelle: Kartentext „When a "Loyal" or "Skeleton" Creature you control is **defeated**, you may discard this card from your hand to revive that Creature immediately …"): „defeated" ist nicht auf Schaden beschränkt (Chess-Ruling 6.9 zählt Opfer als defeated; CARD_API „v1360" will auch den Zerstörungsweg für `_reviveAfterDeath`).
- **Beobachtet:** Bei tödlichem Schaden fragt Bone Dog und belebt wieder (✓). Bei einem Zerstören-Effekt kommt kein Angebot, die Beagle bleibt tot, Bone Dog bleibt auf der Hand.
- **Ursache / Kontext:** `_engine.js:32905` – Nicht-Schadens-Tode öffnen das Fenster nur für Karten mit `preDefeatOnDestroy` (CARD_API.md ab Zeile 6559: „die bisherigen Retter bleiben reine Schadens-Reaktionen"); Bone Dog trägt es nicht. Das ist dokumentiert, aber nicht ausdrücklich für Bone Dog entschieden.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/02-bone-dog-zerstoeren.js`
- **Frage an Al:** Soll Loyal Bone Dog auch gegen Zerstören-Effekte und Opfer (nicht nur tödlichen Schaden) angeboten werden – Ja oder Nein?

### A06-rebelliokai-03 · Bone Dog + Loyal Shepherd: Bone Dog wird bezahlt, die Wiederbelebung fizzelt · Stufe C
- **Karten:** Loyal Bone Dog, Loyal Shepherd
- **Aufbau:** Sitz 0: Bone Dog auf der Hand, Beagle (Slot 0) und Loyal Shepherd (Slot 1) auf dem Brett, Terrier im Deck. Gegner fügt der Beagle tödlichen Schaden zu.
- **Schritte:** 1. Bone Dog „Ja". 2. Shepherd „Ja", Terrier wählen.
- **Erwartet:** „revive that Creature **immediately** into the same Support Zone" – Bone Dog sollte seine Wirkung bekommen, wenn man ihn bezahlt.
- **Beobachtet:** Bone Dog wird abgeworfen (Kosten bezahlt), aber die Wiederbelebung läuft erst NACH den Todes-Listenern; der Shepherd besetzt den Slot zuerst, die Wiederbelebung fizzelt (`creature_revive_fizzle`, reason `zone_taken`). Ergebnis: Beagle tot, Bone Dog verbraucht, Terrier im Slot. Der Spieler wird vor der Bezahlung nicht gewarnt.
- **Ursache / Kontext:** `_engine.js` `_wiederbelebungNachTod` (v1360 „Platz belegt → fizzelt sichtbar") – bewusst, aber die Reihenfolge Bone-Dog-Kosten → Shepherd-Trigger → Revive ist nicht entschieden.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/03-bone-dog-shepherd-slot.js`
- **Frage an Al:** Soll die Bone-Dog-Wiederbelebung VOR den Todes-Triggern anderer Karten (Shepherd, Terrier …) aufgelöst werden („immediately") – Ja oder Nein?

### A06-rebelliokai-04 · The White Army ignoriert das Level-Delta („level 0 Creatures") · Stufe B
- **Karten:** The White Army (`the-white-army.js`, `_mischief-militia-shared.js`), Calamitusk, the Chaorc War Chief (Level-Senkung), Chaorc Cannon Fodder
- **Aufbau:** Sitz 0: eine Dummy-Kreatur (Level 0) und Chaorc Cannon Fodder (gedruckt Lv1, `counters.level = -1` wie nach Calamitusks Effekt), Sitz 1: eine Dummy-Kreatur als Freeze-Ziel; The White Army in der Aktionsphase.
- **Erwartet** (Quelle: Kartentext „If you control at least 2 level 0 Creatures, this counts as an additional Action"; Calamitusk: „that Creature has its level reduced by 1"; Board of Kings rechnet `gedrucktes Level + counters.level`, `engine.kreaturLevelJetzt`): Cannon Fodder ist jetzt Level 0 → zwei Level-0-Kreaturen → Zusatzaktion (Phase bleibt Aktion).
- **Beobachtet:** Phase wechselt (normale Aktion verbraucht); Gegenprobe mit zwei echten Level-0-Kreaturen ist eine Zusatzaktion (✓).
- **Vermutete Ursache:** `_mischief-militia-shared.js` `countOwnLv0Creatures` liest nur `cd.level` (`(cd.level ?? -1) !== 0`).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/04-white-army-level-delta.js`

### A06-rebelliokai-05 · „Cannot be chosen"-Schutz (Censpartan, Board of Kings) greift nicht bei Karten mit `promptEffectTarget` · Stufe A
- **Karten:** Censpartan War Counselor, Board of Kings (Schutzgeber); Mischief Militia - Thaw Blader (belegt), Bear Rider, Heli Troopers, The White Army, Mischief Invasion, Tengu Windstorm, Kappa Sword Slash (Area-Wahl) – alle bauen die Zielliste selbst und rufen `engine.promptEffectTarget`.
- **Aufbau:** Sitz 1 spielt Censpartan und danach Gorinthian War Counselor (Schirm `untargetable_by_opponent` liegt am Gorinthian), Gorinthian wird eingefroren. Sitz 0 hat einen Thaw Blader (Haste) und aktiviert ihn.
- **Erwartet** (Quelle: Censpartan-Text „Other "War Counselor" Creatures you control cannot be chosen by your opponent's cards and effects"; Board of Kings „Creatures you control can't be chosen …"): der geschützte Gorinthian taucht in der Zielwahl nicht auf.
- **Beobachtet:** Der Gorinthian wird angeboten und fällt dem Thaw Blader (200 Schaden) zum Opfer. Dasselbe mit dem von Board of Kings gedeckten Rook of Kings.
- **Ursache:** `_engine.js:5063-5089` und `:5646-5664` werten Schirm und `guardsCreatureChoice` nur in `promptDamageTarget`/`promptMultiTarget` aus; der gemeinsame Flaschenhals `promptEffectTarget` (`_engine.js:27934ff.`) kennt Thicket (`untargetable_all`), `blocksTargeting` und den Great-Wall-Schutz, aber nicht `untargetable_by_opponent` (Golden Wings, Censpartan) und nicht den Board-Vertrag. (Betrifft über diese Gruppe hinaus jede Karte mit eigener Zielliste.)
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/05-zielschutz-promptEffectTarget.js`

### A06-rebelliokai-06 · Tengu Windstorm umgeht den Area-Schutz von Pawn of Kings [B] · Stufe A
- **Karten:** Tengu Windstorm (`tengu-windstorm.js`), Pawn of Kings [B] (`pawn-of-kings-b.js`), Board of Kings
- **Aufbau:** Sitz 1: Board of Kings (Area) + Pawn of Kings [B] auf dem Brett. Sitz 0: Tengu Windstorm auf der Hand, Rebelliokai Terror Tengu in der Ablage.
- **Erwartet** (Quelle: Pawn of Kings [B] „While Board of Kings is on the board, Areas cannot be removed from the board by cards or effects of the opponent of the player who played them"): die Area bleibt liegen; die Gegenprobe `engine.removeArea` mit Quelle Sitz 0 wird tatsächlich verhindert (✓).
- **Beobachtet:** Windstorm legt Board of Kings oben auf das Deck von Sitz 1.
- **Vermutete Ursache:** `tengu-windstorm.js` `_bounceToDeck` (≈Z. 176-250) ruft nie `engine.tryAreaProtection` (`_engine.js:48119`); gilt auch für Guardian of Teocuilatl und Wowhalla.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/06-windstorm-area-schutz.js`

### A06-rebelliokai-07 · Tengu Windstorm trifft „unaffected" Kreaturen (Board of Kings) · Stufe B
- **Karten:** Tengu Windstorm, Board of Kings, Rook of Kings [W], Pawn of Kings [W]
- **Aufbau:** Board of Kings (Area von Sitz 0, das Board beider Seiten zählt); Sitz 1: Rook of Kings [W] (Lv3) neben Pawn of Kings [W] (Lv0) → Rook ist gedeckt. Sitz 0 spielt Tengu Windstorm auf den Rook.
- **Erwartet** (Quelle: Board of Kings „… are unaffected by your opponent's cards and effects"): Rook bleibt auf dem Brett. Gegenprobe: gegnerischer Schaden trifft den gedeckten Rook nicht (✓).
- **Beobachtet:** Rook wird auf das Deck von Sitz 1 gelegt (ein Teil der Ursache ist A06-rebelliokai-05: die Auswahl ist nicht gesperrt; hier fehlt zusätzlich jede Immunitätsprüfung bei der Ausführung).
- **Vermutete Ursache:** `tengu-windstorm.js` `_bounceToDeck` fragt `isOppEffectImmuneFrom` & Co. nicht.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/07-windstorm-unaffected.js`

### A06-rebelliokai-08 · Rebelliokai-Karten mit „Delete X from your discard pile to play this card" wirken unter Knight of Kings [B] ohne Kosten · Stufe A
- **Karten:** Kirin Firebreath, Kappa Sword Slash, Tengu Windstorm, Tanuki Escape (alle über `payRebelliokaiCost`, `_rebelliokai-shared.js`), Knight of Kings [B], Rook of Kings [B], Board of Kings
- **Aufbau:** Sitz 1: Board of Kings (Area), Knight of Kings [B] und Rook of Kings [B] auf dem Brett. Sitz 0: je Karte der Zauber/Angriff auf der Hand, die Kostenkarte (Courtly Kirin / Camouflaged Kappa / Terror Tengu / Timid Tanuki) in der Ablage (plus weitere Rebelliokai für Skalierung).
- **Erwartet** (Quelle: Kartentexte „Delete 1 "…" from your discard pile to play this card" und Knight [B] „your opponent cannot move cards from their deck or discard pile to anywhere else"; CARD_API „Stapel-Ausgangssperre"): die Kosten sind nicht zahlbar → Karte nicht spielbar oder zumindest ohne Wirkung.
- **Beobachtet:** `engine.pileOutAllowed(0,'discard')` ist `false`, die Kosten werden nicht gelöscht (`pile_out_blocked`), aber alle vier Karten wirken voll: Kirin Firebreath 150 Schaden, Kappa Sword Slash 300 Schaden, Tengu Windstorm legt die Kreatur ins Deck, Tanuki Escape beendet den Zug. Die Kostenkarte bleibt unverändert in der Ablage und kann wieder benutzt werden.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/08-ablage-kosten-unter-knight-sperre.js`
- **Vermutete Ursache:** `payRebelliokaiCost` (`_rebelliokai-shared.js`) gibt bei gesperrter Entnahme `undefined` zurück; `kirin-firebreath.js`, `kappa-sword-slash.js`, `tengu-windstorm.js`, `tanuki-escape.js` werten das Ergebnis nicht aus, und `spellPlayCondition` prüft nur „liegt in der Ablage".

### A06-rebelliokai-09 · Calamitusk und Friendly Fireballer ignorieren die Knight-[B]-Stapelsperre · Stufe B
- **Karten:** Calamitusk, the Chaorc War Chief (`calamitusk-the-chaorc-war-chief.js:139`), Chaorc Friendly Fireballer (`chaorc-friendly-fireballer.js:266/281`), Knight of Kings [B] (+ Rook [B], Board of Kings)
- **Aufbau:** Sitz 1: Board of Kings + Knight [B] + Rook [B]. Sitz 0: (a) Calamitusk tributiert eine Dummy-Kreatur, Cannon Fodder liegt im Deck; (b) Friendly Fireballer + Pyre Grill Master (Opfer), Fireball in Deck und Ablage.
- **Erwartet** (Quelle: Knight [B]-Text; CARD_API „MANDATORY für direkte Splices"): Deck/Ablage dürfen nicht verlassen werden.
- **Beobachtet:** (a) Cannon Fodder wird aus dem gesperrten Deck beschworen. (b) Ein Fireball kommt aus Deck/Ablage auf die Hand.
- **Hinweis:** bekannte Altlast (die beiden Dateien stehen in `scripts/no-splice-baseline.json`, „Sweep-Aufgabe" in CARD_API) – hier nur konkret belegt.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/09-chaorc-stapel-sperre.js`

### A06-rebelliokai-10 · Camouflaged Kappa opfert sich unter der Knight-[B]-Sperre für nichts · Stufe C
- **Karten:** Rebelliokai Camouflaged Kappa (`rebelliokai-camouflaged-kappa.js`), Knight of Kings [B]
- **Aufbau:** wie 08, Kappa (nicht diesen Zug beschworen) auf dem Brett, Fireball im Deck, Aktivierung in Main 1.
- **Beobachtet:** `canActivateCreatureEffect` prüft nur „Deck nicht leer, Hand nicht gesperrt". Kappa wird geopfert (Ablage), die Suche scheitert an `pile_out_blocked`, es kommt nichts auf die Hand. Vergleich: Bishop of Kings [W] und Pawn Sacrifice prüfen `pileOutAllowed` vorab und bieten nichts an; Loyal Rottweiler verpufft bewusst mit sichtbarem Fizzle (`deck_locked`, v1360).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/10-kappa-opfer-unter-sperre.js`
- **Frage an Al:** Soll ein Opfer-Effekt, dessen Hauptwirkung durch die Stapelsperre unmöglich ist, gar nicht aktivierbar sein (Opfer bleibt erspart) oder verpuffen? – „gesperrt" oder „verpuffen"?

### A06-rebelliokai-11 · Bishop of Kings [B], stummgeschaltet: die Negation der Gegner-Helden bleibt liegen · Stufe B
- **Karten:** Bishop of Kings [B] (`bishop-of-kings-b.js`), Snowstorm Mischief (natürliche Quelle: friert alle Kreaturen), Knight of Kings [W], Board of Kings
- **Aufbau:** Board (Area), Knight [W] und Bishop [B] auf Sitz 0 → die drei Helden von Sitz 1 sind `negated`. Sitz 0 spielt Snowstorm Mischief und friert damit auch den eigenen Bishop ein.
- **Erwartet** (Quelle: Kartentext „While you control at least 1 Knight … the effects of all Heroes your opponent controls are negated"; Header des Skripts: „Fällt weg, sobald … der Bishop stummgeschaltet ist"; ein gefrorenes Creature hat keine Wirkung): die Gegner-Helden sind wieder nicht negiert.
- **Beobachtet:** `negated` bleibt auf allen drei Helden, auch nach einem vollen Zugumlauf (Bishop noch gefroren).
- **Ursache:** `syncBishopNegation` hängt nur an den EIGENEN Hooks des Bishop (`onCardEnterZone`, `onTurnStart` …); die Engine filtert die Hooks einer stummgeschalteten Kreatur (`isCreatureEffectSuppressed`), der Abgleich läuft nie. (Der Gegner kann wegen der Negation selbst keinen Zauber wirken, daher ist Snowstorm vom eigenen Spieler der natürliche Auslöser; dasselbe gilt für Negation/Betäubung durch Kreatureneffekte.)
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/11-bishop-b-eingefroren.js`

### A06-rebelliokai-12 · Censpartan War Counselor, stummgeschaltet: der Schutzschirm der anderen Ratgeber bleibt · Stufe B
- **Karten:** Censpartan War Counselor (`censpartan-war-counselor.js`); Auslöser z. B. Snowstorm Mischief / Freeze
- **Aufbau:** Sitz 0 spielt Censpartan und Gorinthian War Counselor (Schirm `untargetable_by_opponent` liegt am Gorinthian), Censpartan wird eingefroren; der Gegner spielt Fireball.
- **Erwartet:** ohne wirksamen Censpartan kein Schirm (Fireball kann den Gorinthian wählen).
- **Beobachtet:** Schirm bleibt (Zähler unverändert), Fireball-Zielwahl enthält den Gorinthian nicht.
- **Ursache:** wie 11 – `resyncShield` läuft nur über Censpartans eigene Hooks (`onPlay`, `onCardEnterZone`, `onTurnStart` …), die bei Stummschaltung nicht feuern.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/12-censpartan-eingefroren.js`

### A06-rebelliokai-13 · Cykyran War Counselor, stummgeschaltet: die Verdopplung der Basis-Angriffswerte bleibt · Stufe B
- **Karten:** Cykyran War Counselor (`cykyran-war-counselor.js`), Censpartan, Gorinthian (Zähler der drei Ratgeber)
- **Aufbau:** Cykyran + Gorinthian + Censpartan auf Sitz 0, Held mit ATK 90 wird auf 180 verdoppelt; Cykyran wird eingefroren.
- **Erwartet:** Held-ATK wieder 90 (kein wirksamer Cykyran).
- **Beobachtet:** ATK bleibt 180 (`_cykyranBonus` = 90).
- **Ursache:** wie 11/12 – `resync` hängt an den eigenen Hooks.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/13-cykyran-eingefroren.js`

### A06-rebelliokai-14 · Gorinthian War Counselor: der Schadensschutz endet einen Zug vor der Betäubung · Stufe B
- **Karten:** Gorinthian War Counselor (`gorinthian-war-counselor.js`)
- **Aufbau:** Gorinthian + Cykyran (zweiter Ratgeber) auf Sitz 0, Zug 5: Gegner-Held 0 wird betäubt (2 Züge). Probeschaden von 10 in Zug 5, 6, 7, 8 (jeweils nach `endTurn`).
- **Erwartet** (Quelle: Kartentext „Stun it for 2 turns. Any damage targets Stunned by this effect would take becomes 0"): Schaden 0, solange die Betäubung dieses Effekts liegt.
- **Beobachtet:** Zug 5–7 Schaden 0; in Zug 8 (Gegnerzug) ist der Held noch betäubt, nimmt aber 10 Schaden. Gleiches Bild bei einer Kreatur als Ziel.
- **Vermutete Ursache:** `shieldUntil = gs.turn + 2` (Z. ~66) – der Stun läuft bis zu Beginn von Zug 9, der Marker nur bis Zug 7.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/14-gorinthian-schutz-dauer.js`

### A06-rebelliokai-15 · Tanuki Escape: die aufgelöste Karte selbst ist als „Handkarte" zum Zurückmischen wählbar · Stufe B
- **Karten:** Tanuki Escape (`tanuki-escape.js`), Engine `shuffleBackEligibleHandSlots`
- **Aufbau:** Hand: Tanuki Escape, Fireball; Ablage: Timid Tanuki, Kind Kitsune, Backup Bakus; Deck mit Beagle/Terrier/Dummys.
- **Erwartet** (Quelle: Kartentext „Shuffle up to as many cards from your hand …"; Befund 28.8. in `_hand-resolve.js`: die gerade benutzte Karte ist keine Handkarte mehr): Index 0 (der Zauber) ist nicht wählbar.
- **Beobachtet:** `eligibleIndices` = `[0, 1]`; wählt man den Zauber, wird er ins Deck gemischt statt in die Ablage (und zählt als eine der Karten). Karten­bilanz ist sauber (kein Verlust/Duplikat), aber ein bezahlter Zauber kehrt ins Deck zurück.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/15-tanuki-escape-eigene-karte.js`

### A06-rebelliokai-16 · Kitsune Transformation: der Zauber selbst zählt als eine der abzuwerfenden Karten · Stufe B
- **Karten:** Kitsune Transformation (`kitsune-transformation.js`)
- **Aufbau:** Hand: Kitsune Transformation, 2× Fireball; Ablage: Kind Kitsune, Bakus, Timid Tanuki (alle drei zurückmischen → N = 3); Deck mit Beagle, Terrier, Pinpom.
- **Erwartet** (Quelle: „Then, discard the same number of cards"; `eligibleIndicesWithoutResolving`-Konvention): 3 andere Karten werden abgeworfen.
- **Beobachtet:** `actionPromptForceDiscard` wird ohne `eligibleIndices` gerufen; der Zauber steht beim Abwurf noch in der Hand und ist wählbar. Gewählt: der Zauber + 2 Fireballs → es werden nur 2 andere Karten abgeworfen. Die CPU/Harness-Standardwahl (Index 0) trifft genau diesen Fall.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/16-kitsune-transformation-eigene-karte.js`

### A06-rebelliokai-17 · Tanuki Escape schließt zurückgemischte Namen von der Suche aus · Stufe C
- **Karten:** Tanuki Escape
- **Beobachtet:** Die Suchgalerie lässt jeden Namen weg, der eben zurückgemischt wurde (`tanuki-escape.js` `shuffledSet`). Der Kartentext sagt nur „search your deck for up to that many cards with different names" (anders als Kitsune Transformation: „…and from the Creatures you shuffled back").
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/17-tanuki-escape-namen.js`
- **Frage an Al:** Darf Tanuki Escape eine Karte suchen, deren Name der einer eben zurückgemischten Karte ist – Ja oder Nein?

### A06-rebelliokai-18 · Cykyran War Counselor verlässt das Feld: die verdoppelte Basis-ATK bleibt dauerhaft · Stufe A
- **Karten:** Cykyran War Counselor (`cykyran-war-counselor.js`), Gorinthian/Censpartan als weitere Ratgeber
- **Aufbau:** Calamitusk (ATK 90) als Held 0; Cykyran, Gorinthian, Censpartan auf Sitz 0 → ATK 180. Der Gegner zerstört Cykyran (alternativ: tödlicher Schaden). Danach zwei Zugwechsel.
- **Erwartet** (Quelle: „While you control at least 3 different "War Counselor" Creatures, your Heroes' Base Attack stats are doubled"): nach Cykyrans Tod wieder 90.
- **Beobachtet:** ATK bleibt 180 (`_cykyranBonus` = 90), auch nach den Zugwechseln. Stirbt dagegen ein ANDERER Ratgeber (Gorinthian), gleicht Cykyran korrekt auf 90 ab.
- **Ursache:** `resync` läuft nur über Cykyrans eigene Hooks. Im `onCardLeaveZone` steht er noch auf dem Brett und zählt sich selbst mit (Bedingung „erfüllt"); `onCreatureDeath` wird von `resyncFromCtx` wegen `inst.zone !== 'support'` verworfen. Danach gibt es keinen Zuhörer mehr.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/18-cykyran-tod.js`

### A06-rebelliokai-19 · Censpartan War Counselor verlässt das Feld: der Schirm der anderen Ratgeber bleibt dauerhaft · Stufe A
- **Karten:** Censpartan War Counselor (`censpartan-war-counselor.js`)
- **Aufbau:** Censpartan und Gorinthian auf Sitz 0, Gorinthian trägt den Schirm (`untargetable_by_opponent`). Censpartan wird zerstört bzw. per `actionMoveCard` auf die Hand gebounct; zwei Zugwechsel.
- **Erwartet** (Quelle: Kartentext „Other "War Counselor" Creatures you control cannot be chosen by your opponent's cards and effects" – Wirkung von Censpartan auf dem Brett): ohne Censpartan kein Schirm.
- **Beobachtet:** Der Gorinthian trägt den Schirm weiter (`_censpartanShield`), auch nach den Zugwechseln – für den Rest des Spiels nicht wählbar für Karten, die `untargetable_by_opponent` lesen (Fireball usw.).
- **Ursache:** wie 18 – `resyncShield` berechnet beim Verlassen „alle ANDEREN Ratgeber unter meiner Kontrolle" (die bleiben), der Abgleich nach dem Tod wird verworfen.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/19-censpartan-tod.js`

### A06-rebelliokai-20 · Chilly Wizard: gespiegelter Status bleibt auf dem Wirt, wenn der Wizard ihn verliert oder stirbt · Stufe C
- **Karten:** Mischief Militia - Chilly Wizard (`mischief-militia-chilly-wizard.js`), Thaw Blader (Heilung), Snowstorm Mischief (Auslöser)
- **Beobachtet:** Der Status wird einmal gespiegelt und lebt dann mit eigener Dauer auf dem Wirt. Heilt man den Wizard vom Freeze oder stirbt er, bleibt der Wirt gefroren (bis zum eigenen Ablauf).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/20-chilly-wizard-spiegel-bleibt.js`
- **Frage an Al:** Soll der gespiegelte Status enden, sobald der Wizard ihn nicht mehr trägt oder das Feld verlässt („gebunden"), oder läuft er allein ab – „gebunden" oder „läuft ab"?

### A06-rebelliokai-21 · Pawn Sacrifice unter Handsperre (Ice Sculpture Garden): Pawn wird geopfert, das Ziehen entfällt · Stufe C
- **Karten:** Pawn Sacrifice (`pawn-sacrifice.js`), Ice Sculpture Garden (setzt `handLocked`)
- **Beobachtet:** Kitsune Transformation und Tanuki Escape sperren sich bei `ps.handLocked` über `spellPlayCondition` (ausgegraut). Pawn Sacrifice prüft die Sperre nicht: der Zauber ist spielbar, der Pawn wird geopfert/gelöscht, `drawWouldBeBlocked` überspringt das Ziehen. Der Loader sperrt Spells bewusst nicht automatisch als „draw-only" (`_loader.js` ≈ Z. 410: „eine Verhaltensänderung, die Al entscheiden sollte").
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/21-pawn-sacrifice-handsperre.js`
- **Frage an Al:** Soll Pawn Sacrifice (Nutzen nur Ziehen) bei aktiver Handsperre gesperrt sein wie Kitsune Transformation/Tanuki Escape – Ja oder Nein?

### A06-rebelliokai-22 · Tengu Windstorm feuert `onCardLeaveZone` vor dem Entfernen der Karte · Stufe B
- **Karten:** Tengu Windstorm (`tengu-windstorm.js` `_bounceToDeck`), Bishop of Kings [B], Knight of Kings [W], Board of Kings
- **Aufbau:** Bishop [B], Knight [W] und Board auf Sitz 0 → Gegner-Helden negiert. Windstorm bounct das Board bzw. den Knight.
- **Erwartet:** wie bei `removeArea`/Tod/Sculpture Theft wird die Karte beim Leave-Hook bereits nicht mehr als „auf dem Brett" gezählt → die Negation endet sofort.
- **Beobachtet:** `_bounceToDeck` ruft den Leave-Hook, solange die Karte noch im Zustand steht; Bishop [B] sieht Board/Knight weiter und lässt die Negation bis zum nächsten Zugbeginn/-ende liegen.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/22-windstorm-leave-reihenfolge.js`

### A06-rebelliokai-23 · Tengu Windstorm und Sculpture Theft holen Token ins Deck bzw. auf die Hand · Stufe B
- **Karten:** Tengu Windstorm, Sculpture Theft (+ The White Army als Freeze-Quelle)
- **Aufbau:** Mummy Token (auch Invader/Pollution Token) auf Sitz 1. Windstorm wählt ihn; bzw. er wird gefroren und Sculpture Theft nimmt ihn.
- **Erwartet** (Konvention: Tokens gehen nie in Hand/Deck/Ablage, sondern in den Gelöscht-Stapel, z. B. `_enforceSupportZoneLock`): Token wird gelöscht oder ist nicht wählbar.
- **Beobachtet:** „Mummy Token" liegt oben im Deck von Sitz 1 bzw. auf der Hand von Sitz 1 (der Audit bleibt still, weil der Token-Name in der DB steht).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/23-token-in-deck-hand.js`

### A06-rebelliokai-24 · Thebinxan War Counselor unter Handsperre: Ansage erzwungen, Karte kommt nicht, Nutzung verbraucht · Stufe C
- **Karten:** Thebinxan War Counselor (`thebinxan-war-counselor.js`), Ice Sculpture Garden (Handsperre)
- **Beobachtet:** `canActivateCreatureEffect` prüft nur „Deck nicht leer". Unter Handsperre scheitert `actionAddCardFromDeckToHand`, der Effekt endet mit `return true` (Log `thebinxan_fizzle`): der Gegner hat umsonst angesagt, kein Schaden fällt (auch bei falscher Ansage), die Einmal-Nutzung ist weg. Camouflaged Kappa und Timid Tanuki sperren sich bei Handsperre vorab.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/24-thebinxan-handsperre.js`
- **Frage an Al:** Soll Thebinxan bei Handsperre gesperrt (nicht aktivierbar) sein – oder soll der Schaden bei falscher Ansage trotzdem fallen, weil die Karte aufgedeckt wurde? – „gesperrt" oder „Schaden trotzdem"?

### A06-rebelliokai-25 · SnowItAll beschwört ohne Beschwörer-Eignung (Schule/Level, Frozen/Stunned, summonLocked, Aktionssperre) · Stufe A
- **Karten:** Mischief Militia - SnowItAll (`mischief-militia-snowitall.js` `_findFreeOwnSupportSlots`/`onCreatureEffect`)
- **Voraussetzungen / Aufbau:** Sitz 0: SnowItAll (nicht diesen Zug beschworen) auf Held 0, Loyal Beagle (Lv1) auf der Hand, ein gefrorenes Ziel auf dem Brett; nur Held 1 hat eine freie Zone. Varianten: Held 1 ohne Summoning Magic · Held 1 mit Summoning Magic Lv1 aber gefroren / betäubt / negiert · `summonLocked` · `_actionLockedTurn` am Host.
- **Schritte:** 1. `t.activateCreature(0, 0, 0)` (SnowItAll in Main 1).
- **Erwartet** (Kartentext „summon a level 1 or lower Creature from your hand as an additional Action"; spielweites Ruling 8.8. im Kopf von `_summon-eligibility.js` und CARD_API „BESCHWÖRUNGSSPERREN": „summon as an additional Action" ist eine ganz normale Beschwörung – tauglicher Beschwörer Pflicht, `summonLocked` sperrt JEDE echte Beschwörung, Aktionssperren sperren auch Zusatzaktionen): in allen Varianten wird nichts beschworen. Kontrolle (gesunder Host mit Summoning Magic Lv1) beschwört (✓).
- **Beobachtet:** Der Beagle landet in jeder Variante bei Held 1 (und wird eingefroren): ohne Summoning Magic, bei gefrorenem/betäubtem/negiertem Host, unter `summonLocked`, bei Aktionssperre. Der Zustand bleibt sonst sauber.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/25-snowitall-beschwoerer-eignung.js` (✗ = Fehler tritt auf; 6 von 8 Prüfungen ✗)
- **Vermutete Ursache:** `mischief-militia-snowitall.js` baut die Zonenliste selbst (`_findFreeOwnSupportSlots`, alle lebenden Helden, freie Zone) statt `eligibleSummonZones(engine, pi, name, { nachKontrolle: true })` aus `_summon-eligibility.js` zu benutzen; `canActivateCreatureEffect` kennt deshalb keine Sperre. (Die Level-≤1-Prüfung gilt nur der Handkarte, nicht dem Beschwörer.)

### A06-rebelliokai-26 · Loyal Pinpom: Zweitbeschwörung über gefrorenen/betäubten/aktionsgesperrten Helden · Stufe B
- **Karten:** Loyal Pinpom (`loyal-pinpom.js` ≈ Z. 82–135)
- **Voraussetzungen / Aufbau:** Hand: Pinpom, Beagle; Held 0 und Held 1 haben Summoning Magic Lv1, Held 0 hat nur den Slot 0 frei, Held 2 ist voll; Held 1 ist gefroren / betäubt bzw. hat `_actionLockedTurn`.
- **Schritte:** 1. Pinpom auf Held 0 / Slot 0 spielen, Pinpom-Frage bejahen.
- **Erwartet** (Kartentext „immediately summon another "Loyal" Creature from your hand as an additional Action"; Ruling 8.8., siehe -25): ein gefrorener/betäubter Held kann nicht beschwören, ein aktionsgesperrter auch nicht als Zusatzaktion → der Beagle bleibt auf der Hand.
- **Beobachtet:** Der Beagle wird bei Held 1 beschworen (gefroren ✗, betäubt ✗, Aktionssperre ✗). Ein negierter Held 1 wird korrekt abgelehnt (✓).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/26-pinpom-beschwoerer-status.js`
- **Vermutete Ursache:** Beide Wirtsschleifen in `loyal-pinpom.js` prüfen `hp > 0`, freie Zone und `heroMeetsLevelReq`, aber weder `statuses.frozen/stunned/webbed/bound` noch `heroActionLocked`; die Hilfen in `_summon-eligibility.js` (`eligibleSummonZones`) werden nicht benutzt. (Gleiche Lücke bei Orthos' Zweitbeschwörung ist nicht geprüft: Orthos beschwört immer in seine eigene Spalte, ein gefrorener Orthos ruht ohnehin.)

### A06-rebelliokai-27 · Mischief Invasion beschwört trotz Beschwörungssperre und Host-Aktionssperre · Stufe B
- **Karten:** Mischief Invasion (`mischief-invasion.js` `_heroCanHostCreature`, ≈ Z. 55–70)
- **Voraussetzungen / Aufbau:** Hand: Mischief Invasion, Chilly Dog (Lv1); ein gefrorenes Ziel auf dem Brett; nur Held 1 (Summoning Magic Lv1) hat freie Zonen. Variante A: `ps.summonLocked`; Variante B: `_actionLockedTurn` an Held 1.
- **Erwartet** (Kartentext „summon them as additional Actions"; Ruling 8.8./CARD_API „BESCHWÖRUNGSSPERREN": `summonLocked` sperrt jede Beschwörung, Aktionssperren auch Zusatzaktionen): nichts wird beschworen.
- **Beobachtet:** Chilly Dog wird in beiden Varianten bei Held 1 beschworen (Kontrolle ohne Sperre ✓). Die Statusprüfung (frozen/stunned/negated/bound) ist vorhanden, `_heroCanHostCreature` kennt aber weder `summonLocked` noch `heroActionLocked`.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/27-invasion-summonlocked.js`
- **Nebenbefund (Frage, Stufe C):** Der Skriptkopf nimmt Lv-0-Kreaturen von der Statusprüfung aus („not Frozen / Stunned / Negated / Bound for Lv > 0 Creatures"): ein gefrorener oder betäubter Held bekommt über Invasion z. B. Heli Troopers (Lv0) beschworen (gemessen, ✗ gegen die Regel). In `validateActionPlay` (`_engine.js` ≈ 20712) gilt das Frost-/Betäubungs-Tor dagegen für alle Stufen. **Frage an Al:** Darf ein gefrorener/betäubter Held eine Lv-0-Kreatur über Mischief Invasion beherbergen – Ja oder Nein?

### A06-rebelliokai-28 · Gorinthian War Counselor: der Schadensschutz hängt am Merker, nicht an der tatsächlichen Betäubung · Stufe B
- **Karten:** Gorinthian War Counselor (`gorinthian-war-counselor.js` `onCreatureEffect` ≈ Z. 150-160, `isShielded`)
- **Voraussetzungen / Aufbau:** Sitz 0: Gorinthian + Cykyran (zwei Ratgeber), Main 1; Ziel: Gegner-Held 0. (a) der Held trägt `buffs.negative_status_immune` (Betäubung wird abgewehrt); (b) die Betäubung wird gelungen angebracht und danach vorzeitig geheilt (`engine.cleanseHeroStatuses(…, ['stunned'])`, der Weg von Coffee/Cure/Elixir of Recovery).
- **Schritte:** 1. Gorinthian aktivieren. 2. Probeschaden 10 (`actionDealDamage`, Typ creature) auf den Helden.
- **Erwartet** (Kartentext „Any damage targets Stunned by this effect would take becomes 0"; Skriptkopf: „Laeuft der Stun aus, ist auch der Schutz vorbei – beides endet zusammen"): nur ein tatsächlich von diesem Effekt betäubter, noch betäubter Held ist geschützt. Kontrolle (normal betäubt → Schaden 0) ✓.
- **Beobachtet:** (a) Betäubung abgewehrt (`stunned` = false), `hero._gorinthianStun` trotzdem gesetzt → Schaden 0 bis Zug+2. (b) Betäubung geheilt, Merker bleibt → Schaden 0 bis Zug+2. (Bei Kreaturen wird `applied` ausgewertet – dort kein Fall (a).)
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/28-gorinthian-schutz-ohne-stun.js`
- **Vermutete Ursache:** Für Helden stempelt `onCreatureEffect` den Merker direkt nach `await engine.addHeroStatus(...)` ohne dessen Ergebnis zu prüfen; `isShielded` liest nur den Zug-Stempel, nie `statuses.stunned`. (Ergänzt -14, das die Dauer betrifft.)

### A06-rebelliokai-29 · Negierter Pawn Sacrifice / negierte Mischief Invasion zählen nicht gegen „You can only play 1 … per turn" · Stufe C
- **Karten:** Pawn Sacrifice (`pawn-sacrifice.js:136`), Mischief Invasion (`mischief-invasion.js:287`); gleiche Klasse wie S01-02, A01-pollution-04/-14, F01-19 (dort Prüfauftrag), M02. Pawn Chain (`pawn-chain.js:50`, ebenfalls „only play 1 per turn") stempelt im selben Muster, wurde nicht per Negierung gemessen.
- **Voraussetzungen / Aufbau:** Sitz 0: zwei Kopien auf der Hand (Pawn Sacrifice mit Pawn of Kings [W] auf dem Brett bzw. Invasion mit Heli Troopers in der Hand und einem gefrorenen Ziel); Sitz 1: Silence (Decay Magic Lv2).
- **Schritte:** 1. Erste Kopie spielen, Sitz 1 negiert sie (Karte in der Ablage). 2. Im selben Zug (Aktionsphase, `resetActions`) die zweite Kopie spielen.
- **Erwartet** (Kartentext „You can only play 1 "…" per turn"; Ruling CARD_API.md ~Z. 11433 „Der Stempel sitzt dort, wo die Karte die Hand verlässt … unabhängig davon, ob ein Gegenzug sie später negiert"; Lesart A „gespielt = gezählt"): die zweite Kopie ist nicht spielbar.
- **Beobachtet:** Lesart B (wie bei den Vorläufern): beide Zauber stempeln erst im `onPlay` (nach den Wahlen); ein negierter Zauber erreicht ihn nie. Die zweite Kopie wird gespielt und wirkt (Pawn Sacrifice zieht 3 Karten, die Invasion beschwört Heli Troopers).
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/29-einmal-pro-zug-negiert.js`
- **Frage an Al:** Soll ein von Silence negierter „only play 1 per turn"-Zauber den Zug-Slot verbrauchen (Lesart A, wie die Divine Gifts) – Ja oder Nein? (Gilt dann für alle Karten dieser Klasse einheitlich.)

### A06-rebelliokai-30 · Pawn Sacrifice und Timid Tanuki unter Tuscan Artist: nicht ausgegraut, Opfer und Einmal-Nutzung gehen verloren · Stufe B
- **Karten:** Pawn Sacrifice (`pawn-sacrifice.js` `spellPlayCondition` Z. 52, `onPlay` Z. 139), Rebelliokai Timid Tanuki (`rebelliokai-timid-tanuki.js` `canActivateCreatureEffect` Z. 130); Tuscan Artist (Sperrkarte, `_draw-block-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 1 hat Tuscan Artist auf dem Brett. Sitz 0: (a) Pawn Sacrifice auf der Hand, Pawn of Kings [W] (nicht neu) + Knight of Kings [W] auf dem Brett; (b) Timid Tanuki (alt) mit 3 verschieden benannten Rebelliokai in der Ablage (Ziehen von genau 3).
- **Schritte:** (a) `t.play(0, 'Pawn Sacrifice')`; (b) `t.activateCreature(0, 0, 0)` in Main 1.
- **Erwartet** (Kartentext Tuscan Artist „any effect that would allow your opponent to draw 2 or 3 cards is negated"; verbindliches Ruling 16.8. im Kopf von `_draw-block-shared.js`: „Ist der Zug der einzige Nutzen – auch wenn dafür Kosten anfallen – dann ist die Karte bzw. der aktive Effekt GESPERRT und wird ausgegraut. Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT."): Pawn Sacrifice (zieht immer 3 oder 2) ist nicht spielbar, der Tanuki (zieht 3) nicht aktivierbar.
- **Beobachtet:** (a) Der Zauber wird gespielt, der Pawn geopfert, `drawWouldBeBlocked` überspringt das Ziehen erst im `onPlay` – Pawn und Karte weg, nichts gezogen, `hoptUsed['pawn-sacrifice:0']` gesetzt. (b) Der Tanuki wird aktiviert, zieht 0 Karten, die Einmal-Nutzung des Zuges ist verbraucht.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/30-tuscan-artist-ziehkarten-nicht-gesperrt.js`
- **Vermutete Ursache:** Die beiden Gates rufen `drawWouldBeBlocked(engine, pi, n)` nicht auf (das Ruling nennt „rund zwölf betroffene Karten, mit EINER Zeile in ihrem eigenen Gate"). Verwandt mit -21 (Handsperre) und -24 (Thebinxan/Handsperre), dort ohne ausdrückliches Ruling als Frage; hier gilt das Ruling 16.8. direkt. Ice Sculpture Garden (zieht N = Anzahl Gefrorener, bei N = 2/3 negiert, behält aber die Zusatzaktion) wurde nicht als Fehler gewertet.

### A06-rebelliokai-31 · Bear Rider: Handstufen-Senkung gilt nur für Sitz 0 und 1 (3-/4-Spieler-Partien) · Stufe B
- **Karten:** Mischief Militia - Bear Rider (`mischief-militia-bear-rider.js` Hooks, `_mischief-militia-shared.js:325` `recomputeBearRiderHandLevelAllPlayers`)
- **Voraussetzungen / Aufbau:** 3 Sitze; Sitz 0 spielt Snowstorm Mischief (Sitz 1 und 2 haben je eine Dummy-Kreatur → 2 gefrorene Ziele); je ein Bear Rider auf der Hand von Sitz 1 bzw. Sitz 2.
- **Erwartet** (Kartentext „This card's level in your hand is reduced by 1 for every Frozen target on the board. While this Creature's level is 0, you may summon it as an additional Action"; CARD_API „Gegner-Index nie hart verdrahten"): in der Hand jedes Sitzes Stufe 0 bei 2 gefrorenen Zielen.
- **Beobachtet:** Sitz 1: Stufe 0 ✓. Sitz 2: bleibt Stufe 2 (`_handLevelOffsetsTransient` leer); `t.play(2, Bear Rider, noGrant)` wird mit `validate-nein` abgelehnt, während derselbe Aufbau auf Sitz 1 gelingt.
- **Repro:** `docs/niche-tests/repro/A06-rebelliokai/31-bear-rider-dritter-sitz.js` (✗ nur für Sitz 2)
- **Vermutete Ursache:** `recomputeBearRiderHandLevelAllPlayers` ruft nur `recomputeBearRiderHandLevel(engine, 0)` und `(engine, 1)`; alle Frost-/Tod-/Zug-Hooks hängen daran. Nur `onCardEnterZone` (Karte kommt in die Hand) rechnet für den betroffenen Sitz, danach wird die Senkung nie nachgeführt – umgekehrt bleibt eine einmal gesetzte Senkung auf Sitz 2/3 auch nach dem Auftauen stehen.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| (wird am Ende vollständig gefüllt) | | |

## Getestet & in Ordnung (Auswahl)
- Pawn of Kings [W] mit Board: erste Beschwörung gratis, zweite kostet die Aktion; ohne Board normale Aktion.
- Kasperov [B] platziert Rook [W] aus der Hand auf den Platz des geopferten Pawn; Platzierung zählt nicht als Beschwörung (`_creaturesSummonedThisTurn`), wie bei Knight/Queen-Stempeln.
- Bone Dog rettet bei tödlichem Schaden; Terrier trifft bei der Rettung weiter (50 Schaden).
