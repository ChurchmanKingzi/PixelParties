# M01-attacks-abilities-potions – Nischenfall-Bericht
Stand/Autor: Agent M01-attacks-abilities-potions, 13.10.2026. Karten: 53 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### M01-01 · Flashbang: Tränke und Normal-Artefakte des Betroffenen beenden seinen Zug sofort · Stufe B
- **Karten:** Flashbang (`cards/effects/flashbang.js`); betroffen sind alle Karten, die über `doUsePotion` / `doConfirmPotion` / `doUseArtifactEffect` laufen (Healing Potion, Elixir of Strength, Cloud Pillow … getestet).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 hat Flashbang auf der Hand; Sitz 1 hat einen Trank bzw. ein Normal-Artefakt auf der Hand (Healing Potion mit verwundetem Helden / Elixir of Strength / Cloud Pillow), 100 Gold.
- **Schritte:** 1. Sitz 0 spielt Flashbang, `t.endTurn()` (Sitz 1 beginnt Zug 6 in Main Phase 1, Flashbang scharf). 2. Sitz 1 spielt in der Main Phase 1 den Trank / das Artefakt (keine Aktion).
- **Erwartet** (Kartentext „Your opponent's next turn immediately ends after they perform their first Action."; Engine-Konvention `_engine.js:2733` `_bleedTriggersForAction`: „equipment, artifact, potion, area …" sind keine Aktionen): Der Zug von Sitz 1 läuft weiter; er hat noch keine Aktion ausgeführt.
- **Beobachtet:** Sofort nach dem Trank (bzw. Normal-Artefakt) ist Sitz 0 am Zug (Zug 7). Sitz 1 verliert seine komplette Action Phase, ohne eine Aktion ausgeführt zu haben. Ein echter Attack in der Action Phase beendet den Zug wie vorgesehen; ohne Flashbang bleibt Sitz 1 nach dem Trank am Zug; freie Ability-Aktivierung (Leadership) und Equip (Club of Gobbo) beenden den Zug nicht.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/01-flashbang-trank-beendet-zug.js` (`node docs/niche-tests/repro/M01-attacks-abilities-potions/01-flashbang-trank-beendet-zug.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `flashbang.js` `hooks.onAnyActionResolved` (Z. 158) prüft nur `ctx.playerIdx === targetIdx` und den Scharf-Stempel, nicht `ctx.actionType`. `server.js` feuert `onAnyActionResolved` auch mit `actionType: 'potion'` (Z. 12036) bzw. `'artifact'`/Potion-Typ in `doConfirmPotion` (Z. 11588) und `doUseArtifactEffect` (Z. 12377) – Bleed filtert dort mit `_bleedTriggersForAction`, Flashbang nicht.
- **Frage an Al:** Zählt das Spielen eines Tranks / Normal-Artefakts in der Main Phase als „Action" für Flashbang (ja = wie jetzt, nein = nur Spell/Attack/Creature/Ability-mit-Aktion/Heldeneffekt)?

### M01-02 · Elixir of Immortality: bei nicht wiederbelebbarem letztem Helden endet die Partie nie · Stufe A
- **Karten:** Elixir of Immortality (`cards/effects/elixir-of-immortality.js`), Mirjam, the Fallen Cute Angel (`hpCannotBeHealed`); gleiche Klasse für jeden Helden mit 0 max HP bzw. mit „Curse of Aging" (alles, was `engine.canReviveHero(hero, {heilt:true})` verneint).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 hat als einzigen Helden Mirjam (100 HP) und spielt Elixir of Immortality (liegt als Permanent); Sitz 1 hat einen Helden.
- **Schritte:** 1. Elixir spielen. 2. Mirjam durch 500 Zauberschaden töten (`actionDealDamage`). 3. Danach `t.endTurn()` viermal, weiterer Schaden.
- **Erwartet** (Ruling v1466/v1467, `_revive-shared.js` Kopf: „Immortality sollte für 0-max-HP-Heroes … nie triggern"; `elixir-of-immortality.js:149` verwirft so einen Helden bewusst; Spielregel: alle Helden einer Seite besiegt ⇒ diese Seite verliert): Das Elixir löst nicht aus, Sitz 0 hat keinen lebenden Helden mehr ⇒ Sitz 1 gewinnt (`all_heroes_dead`).
- **Beobachtet:** Mirjam bleibt tot (hp 0), das Elixir bleibt als Permanent liegen, `onGameOver` wird **nie** gerufen – auch nach vier Zugwechseln und weiterem Schaden nicht. Kontrolle ohne Elixir: Spiel endet sofort mit Sieger Sitz 1. Der Spieler ohne lebenden Helden spielt unbegrenzt weiter („Zombie-Partie"), nur ein Deck-Out o. Ä. könnte sie noch beenden.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/02-elixir-of-immortality-unheilbar-spiel-endet-nie.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:48356-48362` (`checkAllHeroesDead`): `hasLossSuspender` prüft nur, ob irgendein Permanent mit `preventsAllHeroesDeadLoss` (Elixir, `elixir-of-immortality.js:56`) auf der Seite liegt, nicht ob es für einen der toten Helden überhaupt auslösen kann bzw. vorgemerkt ist (`_pendingHeroes`). Das Elixir überspringt Mirjam in `onHeroKO` (Z. 149), die Niederlage bleibt aber ausgesetzt.

### M01-03 · Cloud in a Bottle: „Activate?" im Zielfenster beantwortet, aber nichts passiert · Stufe A
- **Karten:** Cloud in a Bottle (`cards/effects/cloud-in-a-bottle.js`, einzige Potion mit `isPostTargetReaction`), Engine `_checkPostTargetHandReactions`.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 800 HP je Held; Sitz 0: Fireball (Hand, Zielwahl auf Sitz 1 Held 0); Sitz 1: Cloud in a Bottle auf der Hand, Standardantwort „Ja".
- **Schritte:** 1. Sitz 0 spielt Fireball auf den Helden von Sitz 1. 2. Sitz 1 bekommt den Prompt „Fireball is targeting … Activate Cloud in a Bottle?" und bestätigt.
- **Erwartet** (Kartentext „Play this card immediately when a target you control takes any damage. Halve any damage that target would take for the rest of the turn (including that damage) (rounded up)."): Cloud wird gespielt (Hand leer, Gelöscht-Stapel), der Held verliert 75 statt 150 (725 HP), Buff „cloudy".
- **Beobachtet:** Der Prompt erscheint, nach „Ja" passiert nichts: Held verliert die vollen 150 (650 HP), Cloud bleibt auf der Hand, kein Buff, kein Log, keine zweite Abfrage – auch keine Fehlermeldung. Gleiches Ergebnis mit „Nein". Der Fallback-Pfad (Schaden ohne Zielfenster, z. B. direkter `actionDealDamage`) halbiert korrekt (Kontrolle im Repro) – im echten Spiel greift er hinter einem Zauber/Attack mit Zielwahl aber nie, weil `postTargetCondition` schon beim Anbieten `_cibPromptedFor` setzt und damit `afterDamageCondition` sperrt.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/03-cloud-in-a-bottle-zielfenster-wirkt-nie.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:35940-35945`: nach der Zusage ruft das Fenster für jede Nicht-Artefakt-Reaktion `_rxCastWirkerWaehlen` mit `{ casterIdx: castingHeroIdx }`; `_rxCastKandidaten` (Z. 36431-36432) liefert für Karten ohne Wirker (Potion) `null`; `_rxCastWirkerWaehlen` (Z. 36495-36498) macht daraus `[]` und gibt `kandidaten.length === 1` = `false` zurück ⇒ `continue`, ohne Hand-Abgang und ohne Wirkung. Die Variante `_rxCastPlan` (Z. 36349) behandelt `null` korrekt (`casterIdx: null`), `_rxCastWirkerWaehlen` kennt diesen Fall nur über `plan.casterIdx == null`.

### M01-04 · Cloud in a Bottle schützt nur Helden, nicht Kreaturen · Stufe B
- **Karten:** Cloud in a Bottle (`cards/effects/cloud-in-a-bottle.js`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1: 200-HP-Kreatur (ZZ Dummy) auf dem Brett, Cloud in a Bottle auf der Hand; Sitz 0 trifft die Kreatur (a) mit Fireball (150), (b) direkt per `actionDealCreatureDamage` mit 100.
- **Erwartet** (Kartentext „… when a **target you control** takes any damage. Halve any damage that target would take …"): Cloud wird angeboten, die Kreatur nimmt nur die Hälfte.
- **Beobachtet:** Kein Prompt, Cloud bleibt auf der Hand, die Kreatur nimmt den vollen Schaden (Fireball: 50 HP übrig statt 125; direkt: 100 statt 150 HP übrig).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/04-cloud-in-a-bottle-kreaturen-nicht-geschuetzt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cloud-in-a-bottle.js:246-260` (`_collectOwnedHeroTargets`, Kommentar: „CIB's text 'any target you control' technically includes Creatures, but the current implementation is hero-only"); es gibt keinen `isAfterCreatureDamageReaction`-Zweig. Der Skriptautor kennt die Lücke; ein Ruling, das sie als gewollt festschreibt, fand ich nicht (`grep` in `CARD_API.md`).
- **Frage an Al:** Soll Cloud in a Bottle auch Kreaturen schützen („target you control", ja) oder bleibt es bei Helden?

### M01-05 · Hunting Lv1 nimmt einen besiegten gegnerischen Token als Karte auf die Hand · Stufe B
- **Karten:** Hunting (`cards/effects/hunting.js`), Mummy Token (jeder Token: Invader/Leprochaun/Mummy), Critical Strike als Auslöser.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 mit Hunting (1 Kopie, Lv1); Sitz 1 hat einen Mummy Token (50 HP) in einer Support Zone; Sitz 0 spielt Critical Strike (2 × 40 = 80) darauf, Hunting-Frage „Ja".
- **Erwartet** (Kartentext „… you may add it to your hand **instead of sending it to the discard pile**"; Regel: Tokens kommen nie in Ablage oder Hand, sie werden gelöscht – vgl. A05-02): Der Token wird nicht angeboten bzw. nicht zur Handkarte; die Hand enthält keinen „Mummy Token".
- **Beobachtet:** Die Frage „Add Mummy Token to your hand …?" erscheint, nach „Ja" liegt die Karte „Mummy Token" (cardType Token) auf der Hand von Sitz 0. Eine normale Kreatur (ZZ Dummy Frail) landet korrekt auf der Hand und – später abgeworfen – in der Ablage des Besitzers (Sitz 1, `originalOwner`). Lv2/Lv3 (Übernahme auf das Brett) funktionieren auch mit dem Token (volle 50 HP, Lv2 negiert).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/05-hunting-lv1-token-auf-die-hand.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `hunting.js` Stufe-1-Zweig (~Z. 128-148): setzt `inst._deathClaim = { to: 'hand', name: tot.name … }` ohne Token-Prüfung (`tot.name` ist der Kartenname des Tokens, kein `_cardDataOverride`-/Token-Filter).
- **Frage an Al:** Soll Hunting Lv1 einen Token ignorieren (keine Frage, Token wird wie sonst gelöscht)?

### M01-06 · Friendship Lv1: Zusatzaktion gesperrt, wenn vorher schon ein Support-Magic-Spell gewirkt wurde · Stufe C
- **Karten:** Friendship (`cards/effects/friendship.js`), getestet mit Haste (Support Magic, Lv1).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 mit Support Magic Lv1 + Friendship (Lv1 bzw. Lv2), 3× Haste auf der Hand, Zugbeginn-Hook gezündet (Zusatzaktion bereitgestellt).
- **Schritte:** 1. Haste als normale Aktion. 2. Mit der Friendship-Zusatzaktion ein zweites Haste.
- **Erwartet** (Kartentext 1): „You may once per turn use a Support Magic Spell as an additional Action with this Hero. If you do, you cannot use any other Support Magic Spells this turn."): zwei Lesarten – (A) „other … this turn" gilt auch rückwirkend, das Friendship-Spell muss das einzige des Zuges sein (Skript); (B) Wortlaut „If you do, you cannot use any other" sperrt nur NACH dem Einsatz, das zweite Haste wäre erlaubt, danach ist gesperrt.
- **Beobachtet:** Lv1 lehnt das zweite Haste ab (`false`), die Sperre gilt rückwirkend (`friendship.js` `buildFilter`: „Lv1 restriction: no Support Spells used yet this turn", `ps.supportSpellUsedThisTurn`). Lv2 erlaubt es (+Ziehen). Die Gegenrichtung (erst Friendship, dann normal) ist durch `supportSpellLocked` korrekt gesperrt.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/06-friendship-lv1-reihenfolge.js` (✗ = Lesart B wird nicht erfüllt)
- **Vermutete Ursache:** `friendship.js` `buildFilter` (`if (level <= 1) { if (ps.supportSpellUsedThisTurn || ps.supportSpellLocked) return false; }`).
- **Frage an Al:** Darf ein Friendship-Lv1-Held die Zusatzaktion nutzen, nachdem in diesem Zug schon ein anderer Support-Magic-Spell gewirkt wurde (ja = Wortlaut / nein = wie jetzt)?

### M01-07 · Biomancy + Boulder in a Bottle: dieselbe Potion wird zu Fels UND zu Token (Kartenverdopplung) · Stufe A
- **Karten:** Biomancy (`cards/effects/biomancy.js`), Boulder in a Bottle (`cards/effects/boulder-in-a-bottle.js`); gleiche Klasse für jede Potion, die sich in `afterPotionUsed` selbst auf dem Brett hält (Elixir of Immortality ist nicht betroffen: `placed`-Zweig im Server).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Held 0 mit Biomancy Lv1, Boulder in a Bottle auf der Hand; Sitz 1: Helden mit freien Support Zones; Biomancy-Frage „Ja".
- **Schritte:** 1. Boulder in a Bottle spielen (Ziel: Held 0 von Sitz 1). 2. Die Biomancy-Frage „Convert the spent Potion into a Biomancy Token …?" bestätigen.
- **Erwartet** (Kartentext Biomancy: „place a Potion you play … as a Biomancy Token … **instead of deleting it**"; Boulder: „Place this card into the free Support Zone of a Hero your opponent controls"): Die Potion bleibt genau einmal auf dem Brett – Biomancy bietet nichts an, weil die Potion nicht gelöscht wird, sondern schon liegt.
- **Beobachtet:** Biomancy fragt trotzdem; nach „Ja" liegen **zwei** Objekte auf dem Brett: der Fels bei Sitz 1 (Held 0, belegt dessen freie Zonen) und ein Biomancy Token „Boulder in a Bottle" (40 HP) bei Sitz 0. Eine Karte, zwei Brettobjekte. Beim Verlassen des Bretts wandert nur eines in den Gelöscht-Stapel.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/07-biomancy-boulder-in-a-bottle-dupliziert.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Reihenfolge der `afterPotionUsed`-Hörer: `biomancy.js:46` prüft nur `ctx.placed` und kommt als ältere Instanz vor dem Fels an die Reihe; `boulder-in-a-bottle.js:205` setzt `ctx.setFlag('placed', true)` erst danach (nur auf der Brettinstanz des Felsens). Folge: beide Hörer legen dieselbe Potion.

### M01-08 · Biomancy Token / Boulder in a Bottle, die per „defeat/destroy" sterben, landen in der Ablage (statt gelöscht) und sind zurückholbar · Stufe A
- **Karten:** Biomancy (Token), Boulder in a Bottle; auslösend: Burned Contract, Decapitating Strike (Kreaturen-Zweig), allgemein jeder `engine.actionDestroyCard`-Aufrufer. (Der Engine-Teil ist als Nebenbefund schon in `H02-heroes.md` notiert, dort ohne reale Karte; hier mit realen Karten und Textverstoß.)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; A) Sitz 0: Held 0 Biomancy Lv1, Healing Potion → Biomancy Token (40 HP); Sitz 1: Burned Contract (100 Gold). B) Sitz 0 spielt Boulder in a Bottle auf Sitz 1 Held 0; Sitz 1 zerstört ihn mit Burned Contract.
- **Schritte:** A) 1. Healing Potion spielen, Biomancy-Frage „Ja". 2. Sitz 1 spielt Burned Contract auf den Token. B) analog mit dem Felsen.
- **Erwartet** (Kartentext Biomancy: „… as a Biomancy Token … **When it leaves the board, delete it.**"; Skriptkopf `boulder-in-a-bottle.js`: „soll beim Verlassen des Bretts in den GELOESCHT-Stapel gehen, nicht in die Ablage"; Potions werden nie abgelegt): Gelöscht-Stapel, nichts in der Ablage.
- **Beobachtet:** A) „Healing Potion" liegt in der Ablage von Sitz 0 (nicht gelöscht). B) „Boulder in a Bottle" liegt in der Ablage von Sitz 1. Die Karte ist damit wieder verfügbar: `Shooting Star` holte die Healing Potion aus der Ablage zurück auf die Hand (getestet) – Potion-Recycling. Kontrolle: stirbt derselbe Token durch SCHADEN, geht er korrekt in den Gelöscht-Stapel (Schadenspfad `_engine.js` ~47686-47706).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/08-biomancy-token-boulder-zerstoert-in-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `actionDestroyCard` (Z. 12248 ff., Pile-Wahl Z. 12479 `_zielPile = _redirectToDeleted || _selbstLoeschend ? 'deleted' : 'discard'`) kennt keine Token-Umleitung; der Kadaver wird in `_actionMoveCardKern` (~Z. 13731) unbedingt auf `discardPile` geschoben. Echte Tokens (Mummy/Invader Token) trifft es genauso (`actionDestroyCard` ⇒ Ablage, `t.put` + `actionDestroyCard` getestet).

### M01-09 · Inventing Lv3 wird verweigert, obwohl eine Handkarte mit anderem Namen als ein Deck-Treffer existiert · Stufe B
- **Karten:** Inventing (`cards/effects/inventing.js`, Lv3).
- **Voraussetzungen / Aufbau:** Held 0 mit Inventing ×3; Hand [Fireball, Heal], Deck [Heal, Heal, Heal] (sowie Hand [Fireball, Heal] / Deck [Fireball, Heal]).
- **Schritte:** 1. Freie Aktivierung (`doActivateFreeAbility`) im Main Phase 1.
- **Erwartet** (Kartentext 3): „You may once per turn discard a card to search your deck for a card with a different name, reveal it and add it to your hand."; das Skript selbst vergleicht in `onFreeActivate` mit dem **abgeworfenen** Namen): aktivierbar – Fireball abwerfen, Heal (anderer Name) suchen.
- **Beobachtet:** Die Aktivierung wird abgelehnt (`false`), Hand und Deck bleiben unverändert. Kontrollen laufen richtig: Hand [Fireball] / Deck [Heal] ⇒ aktivierbar; Hand [Fireball] / Deck [Fireball] ⇒ nicht aktivierbar.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/09-inventing-lv3-gate-zu-streng.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `inventing.js:36-37` `canFreeActivate` (Lv3): `(ps.mainDeck).some(cn => !handNames.has(cn) || cn !== cn)` verlangt eine Deckkarte, deren Name auf **keiner** Handkarte steht (`|| cn !== cn` ist immer falsch); richtig wäre „es gibt eine Handkarte H und eine Deckkarte D mit `D ≠ H`".

### M01-10 · Inventing Lv3: Namenssperre „You cannot play cards with that name this turn" gilt serverseitig nicht für Equipment, Abilities, Surprises · Stufe B
- **Karten:** Inventing (Lv3, `ps._creationLockedNames`), betroffene Wege `doPlayArtifact` (Equipment), `doPlayAbility`, `doPlaySurprise` (`server.js`). Dieselbe Sperre setzen auch Divine Gift of Creation / Alchemic Journal.
- **Voraussetzungen / Aufbau:** Held 0 mit Inventing ×3; Hand [ZZ Filler]; Deck [<Karte>, ZZ Dummy, ZZ Dummy]; Inventing: ZZ Filler abwerfen, <Karte> suchen, danach <Karte> im selben Zug spielen. Getestet: Heal, Healing Potion, Cloud Pillow, Club of Gobbo, Fighting, Bluff.
- **Erwartet** (Kartentext: „You cannot play cards with that name this turn."; Engine-Vertrag CARD_API ~Z. 1970): Spielen wird für jeden Kartentyp abgelehnt.
- **Beobachtet:** Spell, Trank und Normal-Artefakt werden abgelehnt (✓); **Club of Gobbo (Equipment), Fighting (Ability) und Bluff (Surprise) werden gespielt** (`true`, Karte verlässt die Hand). Der Client graut die Karten aller Typen aus (`app-board.jsx:33974`), die Lücke trifft also den CPU-Sitz bzw. einen veränderten Client.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/10-inventing-namenssperre-ausruestung-ability-surprise.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Prüfung `ps._creationLockedNames?.has(cardName)` steht in `doUsePotion` (`server.js:11863`) und `doUseArtifactEffect` (Z. 12058) sowie in `validateActionPlay`, aber nicht in `doPlayArtifact`, `doPlayAbility` (ab Z. 7162) und `doPlaySurprise`.

### M01-11 · Adventurousness (Action-Ability) ist trotz gefrorenem/betäubtem/verstricktem Wirtsheld aktivierbar · Stufe B
- **Karten:** Adventurousness (`cards/effects/adventurousness.js`, einzige `actionCost`-Ability der Gruppe); gleiche Klasse für jede künftige `actionCost`-Ability.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Aktionsphase; Held 0 mit Adventurousness Lv1, 50 Gold; Held 0 gefroren / betäubt / `webbed`.
- **Schritte:** 1. `t.activateAbility(0, 0, 0, {phase: 3})`. Kontrolle: derselbe Held mit Fighting + Attack in der Hand versucht anzugreifen.
- **Erwartet** (Client-Tooltips `app-shared.jsx:7705/7731`: „Frozen/Stunned: Cannot act and has its effects and Abilities negated."; Kartentext „use your Action"; Engine-Konvention: freie Ability-Aktivierung dieser Helden wird abgelehnt, `server.js:9535-9537`): Aktivierung abgelehnt, Gold unverändert.
- **Beobachtet:** Attack und Fireball des gefrorenen/betäubten/webbed Helden werden abgelehnt (`false`) und die freien Abilities (Leadership, Alchemy, Inventing, Infiltration) ebenfalls – **Adventurousness liefert `true` und +10 Gold** in allen drei Zuständen (Lv1; auch negiert und gebunden erlaubt, das ist bei Negation/Bound laut Kommentar `server.js:9531` gewollt).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/11-adventurousness-gefroren-betaeubt-aktiv.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doActivateAbility` (Z. 10332 ff.) prüft – anders als `doActivateFreeAbility` (Z. 9535-9537) und die Held-Effekt-Aktivierung (Z. 10733) – weder `statuses.stunned/webbed` noch `statuses.frozen` (Chilly-Dog-Ausnahme); `canHeroPerformAction` (Engine) kennt nur Plant Golem und Heldenskripte.
- **Frage an Al:** Darf ein gefrorener/betäubter Held seine Action-Ability (Adventurousness) nutzen (ja = wie jetzt / nein = wie bei Spells und freien Abilities)?

### M01-12 · Elixir of Strength feuert auch bei Attacks mit mehreren Zielen und wird dabei verbraucht · Stufe B
- **Karten:** Elixir of Strength (`cards/effects/elixir-of-strength.js`, Engine `_applyEmpoweredStrikeIfApplicable`); getestet mit Whirlwind Strike und Ricochet als Auslöser (nicht Teil der Gruppe).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 (ATK 40) trinkt Elixir of Strength; Gegner hat 3 Helden à 800 HP und zwei Kreaturen; Held 0 spielt Whirlwind Strike auf 2 Helden (trifft damit 2 Helden + 2 Kreaturen).
- **Schritte:** 1. Elixir auf Held 0. 2. Whirlwind Strike auf zwei Helden.
- **Erwartet** (Kartentext „The next time that Hero hits **exactly 1 target** with an Attack, that Attack's damage is increased by 100 …"; Buff-Tooltip `_hooks.js:472` gleichlautend): bei einer Attack mit mehreren Zielen keine +100, der Buff bleibt für die nächste Ein-Ziel-Attack stehen.
- **Beobachtet:** Der erste Treffer macht 140 (40 + 100, unreduzierbar), die übrigen 40; der Buff ist weg. Mit Ricochet identisch (140 / 10 / 3, Buff weg). Kontrollen: normale Attack auf 1 Ziel = 140 ✓ Buff verbraucht ✓; ein Spell (Fireball) verbraucht den Buff nicht ✓.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/12-elixir-of-strength-mehrfachziel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:35515-35540` (`_applyEmpoweredStrikeIfApplicable`) prüft nur `hookCtx.type === 'attack'` und die Quelle, nicht die Zielzahl der Attack; der Kommentar (Z. 35528-35531) nennt das ausdrücklich „first match gets the boost" für Mehrfachtreffer. Ein Ruling dazu steht nicht in `CARD_API.md`.
- **Frage an Al:** Soll der Elixir nur bei Attacks mit genau einem Ziel feuern (Text, Buff bleibt sonst) oder am ersten Treffer jeder Attack (wie jetzt)?

### M01-13 · Hammer Throw (Item Lock): ein Normal-Artefakt kann sich selbst als „Item Lock Cost" löschen · Stufe B
- **Karten:** Hammer Throw (`cards/effects/hammer-throw.js`, setzt `ps.itemLocked`); betroffen ist der Server-Weg `doUseArtifactEffect` (alle Normal-Artefakte: Treasure Chest, Cloud Pillow getestet), vermutlich auch `doConfirmPotion`/Artifact (`server.js:11323`).
- **Voraussetzungen / Aufbau:** Seed 1234; Sitz 1 `itemLocked` (Folge eines Hammer Throws, direkt gesetzt), Hand [Treasure Chest, ZZ Filler, ZZ Filler], 100 Gold. Die „Item Lock Cost"-Abfrage wird mit der Artefaktkarte selbst beantwortet.
- **Schritte:** 1. Treasure Chest spielen (`doUseArtifactEffect`). 2. Auf die Abfrage „You must delete 1 card from your hand to use an Artifact." die Chest selbst wählen.
- **Erwartet** (Kartentext „The target's controller must delete a card from their hand whenever they play an Artifact during their next turn."; Muster im Ausrüstungs-Zweig, `server.js:7811-7823`: „… koennte der Spieler ausgerechnet sie selbst loeschen" ⇒ `eligibleIndicesWithoutResolving`): die gerade gespielte Karte ist nicht wählbar; die Sperre kostet eine zusätzliche Karte (Hand danach 1, Chest in der Ablage, +10 Gold).
- **Beobachtet:** Die Abfrage hat `eligibleIndices === undefined`, die Chest liegt dabei noch in der Hand (`beginHandResolve`), und die Antwort „Chest" wird angenommen: Chest geht in den **Gelöscht-Stapel** (statt Ablage), die Hand verliert nur 1 Karte, die 10 Gold werden trotzdem gutgeschrieben. Der Item Lock kostet in diesem Fall nichts. Der CPU-Pilot schließt die Karte defensiv aus (`_cpu.js` ~Z. 8463, Kommentar: „Scripts should still pass eligibleIndices explicitly for correctness against the human player too"), ein Mensch nicht. Der Ausrüstungs-Zweig ist unauffällig (Karte ist bei der Abfrage schon aus der Hand).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/13-hammer-throw-itemlock-kosten-mit-eigenem-artefakt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js:12226-12232` (`doUseArtifactEffect`) und `server.js:11323-11329` rufen `actionPromptForceDiscard` ohne `eligibleIndices`; der Zweig bei `server.js:7815` (Ausrüstung) tut es mit `eligibleIndicesWithoutResolving(ps)`.
- **Hinweis:** Ob der Client die in Auflösung befindliche Karte als wählbar anzeigt, habe ich nicht geprüft (headless); der Server nimmt sie an.

### M01-14 · Hammer Throw auf eine gestohlene Kreatur sperrt den Angreifer selbst statt des Kontrolleurs · Stufe B
- **Karten:** Hammer Throw (`cards/effects/hammer-throw.js`); gleiche Klasse für jedes Ziel, dessen Kontrolleur nicht der Besitzer der Brettseite ist (gestohlene Kreatur, übernommener Held).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hat eine Kreatur von Sitz 0 gestohlen (`actionStealCreature(1, inst)`: Besitzer 0, Kontrolleur 1, physisch weiter bei Sitz 0 / Held 1); Sitz 0 spielt Hammer Throw auf diese Kreatur.
- **Erwartet** (Kartentext „The target's **controller** must delete a card from their hand whenever they play an Artifact during their next turn."): Sitz 1 (Kontrolleur) ist `itemLocked`, Sitz 0 nicht.
- **Beobachtet:** Sitz 0, der Angreifer selbst, ist `itemLocked` (er muss in seinem nächsten Zug bei jedem Artefakt eine Karte löschen), Sitz 1 nicht. Normalfall (Held des Gegners als Ziel) korrekt, ebenso das Intervall „every other turn" (Würfe in Zug 5 / 7 / 9: gesperrt / frei / gesperrt).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/14-hammer-throw-gestohlene-kreatur-sperrt-falschen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `hammer-throw.js` (~Z. 140): `const oppIdx = tgtOwner;` – `target.owner` ist die physische Brettseite; der Kontrolleur wäre `inst.controller ?? inst.owner` bzw. `engine.heroSideOf` für Helden (Muster „Kontrolle statt Seite", Styx 28.9.).
- **Hinweis zum Harness:** `actionStealCreature` von außen aufgerufen hinterlässt `gs._chainResolvingLock = true`; ohne `delete t.gs._chainResolvingLock` lehnt der Server danach jede Karte ab (reiner Harness-Effekt, kein Befund).

### M01-15 · Charme Lv1 kann „Infiltration" (und Necromancy) des Gegners nie ausleihen · Stufe B
- **Karten:** Charme (`cards/effects/charme.js`, `_getOpponentActivatableAbilities`), Infiltration (`cards/effects/infiltration.js`); gleiche Klasse: Necromancy (nicht in der Gruppe, gemessen: direkt aktivierbar, über Charme nicht).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Main Phase 1; Sitz 0 Held 0: Charme Lv1; Sitz 1 Held 0: Infiltration Lv1, Gegner-Deck 10 Karten. Kontrollen im selben Aufbau: Leadership, Inventing, Alchemy.
- **Schritte:** 1. `doActivateFreeAbility` auf die Charme-Zone von Sitz 0.
- **Erwartet** (Kartentext „choose an Ability attached to an opponent's Hero and use it as if it was attached to this Hero"; Infiltration ist freie Aktivierung wie Leadership/Inventing): Infiltration steht im Picker; die oberste Gegner-Deckkarte kommt auf Sitz 0, der Gegner zieht 1.
- **Beobachtet:** Charme Lv1 wird abgelehnt (`false`), kein Picker. Mit Leadership / Inventing / Alchemy als Gegner-Ability aktiviert Charme normal. Direkt aktiviert funktioniert Infiltration (`true`).
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/15-charme-lv1-infiltration-nie-ausleihbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `charme.js` (~Z. 255-275) prüft die geliehene Ability über `script.canFreeActivate.call(script, ctx, level)` mit einem Kontext **ohne `cardHeroIdx`** (Kommentar: „bleibt bewusst offen"); nur ein explizites `false` schließt aus. `infiltration.js:34-38` liest `heroes[ctx.cardHeroIdx]`, findet keinen Helden und gibt `false` zurück. Die Prüfung `Nur ein explizites false` fängt das nicht ab, weil „kein Held" selbst als `false` zurückkommt. Weitere `canFreeActivate`, die `cardHeroIdx` lesen: `necromancy.js` (bestätigt), `occultism.js`, `singing.js`, `training.js`, `trapping.js` (Direkt-Aktivierung im Testaufbau schon `false`, daher nicht gemessen).
- **Nebenbeobachtung (ohne Befund):** Charme Lv1 leiht Adventurousness in der Aktionsphase aus (+10/+30 Gold, verbraucht die Aktion, Phase 3 → 4). Bei gefrorenem Charme-Helden wird das – anders als die Direktaktivierung (M01-11) – abgelehnt.

### M01-16 · Charme Lv2: die gestohlene Handkarte landet beim Abwerfen/Spielen in der Ablage des Diebes · Stufe A
- **Karten:** Charme (`cards/effects/charme.js` `_activateLv2`); Kontrolle: Infiltration (korrekt).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Main Phase 1; Sitz 0 Held 0: Charme Lv2; Sitz 1 Hand [Fireball], Sitz 0 Hand [ZZ Filler].
- **Schritte:** 1. Charme Lv2 aktivieren (Gegner gibt Fireball). 2a. Fireball erzwungen abwerfen (`actionPromptForceDiscard`, Abfrage mit Fireball beantwortet) oder 2b. Fireball regulär spielen.
- **Erwartet** (CARD_API.md ~Z. 4252-4264 „Herkunft (v692/v693) — ALLGEMEINE REGEL (Al 1.9.)": „… Abwerfen, Spielen, Mulligan und Hand→Deck lesen das — die Karte kehrt in Ablage bzw. Deck des URSPRUENGLICHEN Besitzers zurück. Getaggt sind: Key, Infiltration (alle Stufen), …, **Charme**, …"; Kartentext Charme 2) „make your opponent add a card from their hand to yours"): Fireball liegt danach in der Ablage von Sitz 1.
- **Beobachtet:** In beiden Wegen liegt Fireball in der **Ablage von Sitz 0** (dem Dieb), Ablage von Sitz 1 leer, kein Log `stolen_card_returned`. Kontrolle Infiltration Lv1 (Karte vom Gegner-Deck): landet in beiden Wegen korrekt in der Ablage von Sitz 1. Die Hand-Instanz trägt nach Charme `originalOwner = 1` und `_handCardPileOwner(0, 'Fireball')` liefert 1 **solange die Karte in der Hand liegt**; nach dem Entfernen ist die Herkunft weg.
- **Repro:** `docs/niche-tests/repro/M01-attacks-abilities-potions/16-charme-lv2-gestohlene-karte-falsche-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `charme.js:520-530` legt die Karte mit `handZugangSync(…, {ohneInstanz: true})` und `_moveHandInstanceOwner` in die Hand, ruft aber nicht `_tagHandCardOrigin` (`_engine.js:~16190`) auf. Die Entnahme-Wege (`actionPromptForceDiscard` ~Z. 16650/16668, Spielen) lesen die Herkunft inzwischen über die Platz-Tabelle `_handOriginals` (`_handCardPileOwner`, Z. 24820) bzw. den Entfernungs-Merker; ohne `_tagHandCardOrigin` fehlt beides, die Instanz ist beim Splice schon weg. Gleiche Wirkung beim Rückmischen: Leadership mischt die von Charme gestohlene Fireball in das Deck des **Diebes** (Sitz 0), bei Infiltration korrekt in das Deck des Besitzers (Sitz 1) – gemessen (Scratch `c19-charme-shuffle.js`).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|

## Getestet & in Ordnung (Auswahl)
