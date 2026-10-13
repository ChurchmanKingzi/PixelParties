# M02-attacks-abilities-potions – Nischenfall-Bericht
Stand/Autor: Agent M02-attacks-abilities-potions (Fortsetzung eines Vorgängers, der bei Befund 10 abbrach), 13.10.2026. Karten: 53 in der Liste · 53 gezielt getestet (L2) · 33 mit Befund · 25 Befunde (A 5 · B 14 · B/C 2 · C 4).

## Zusammenfassung
Die Gruppe (53 Karten: 16 Attacks, 18 Abilities, 19 Potions) hat 25 Befunde ergeben (A 5 · B 14 · B/C 2 · C 4); die Befunde 01–10 stammen vom Vorgänger (jetzt alle erneut ausgeführt und im Bericht ausgeschrieben), 11–25 sind neu.
Die wichtigsten Muster:
* **Kartenverlust / kaputter Zustand (A):** Muscle Training (voller Fighting-Stapel, -02), Magic Lamp (Negierung durch Ambush the Scout, -18), Singing auf Surprise-Kreaturen (Geister-Instanz, -24), Luck zieht bei Areas/Attachments doppelt (-13), Toughness gegen „cannot be negated" (-08).
* **Dauer-Verträge ohne Status-Prüfung (Klasse B-01…B-09):** Stealth (-05), Terror (-12), Thieving Strike (-03), Toughness/Fighting (-08), freie Ability-Aktivierung negierter Helden (-09).
* **„Held/Ziel, das du kontrollierst" nach physischer Seite statt Kontrolle:** Tears of Creation (-16), Overflowing Chalice / Pressed Skill (-20), Ricochet (-22); Gegenprobe: Smoke Vial, Sword in a Bottle, Punch in the Box, Shattering Strike machen es richtig.
* **Sperren:** Such-Sperre wird von Magic Lamp (-19), Navigation/Trapping/Premonition/Training (-23) und serverseitig von Magnetic Potion (-17) nicht beachtet; Blinded-Sperre fehlt bei Rocket Fist/Whirlwind (-04); Wisdom-Material wird serverseitig nicht geprüft (-25).
* **Einmal-Stempel bei Negierung** fehlt bei Tränken (-10, gleiche Klasse wie S01-01); Resistance lässt Life Serum und Teleportation Powder durch (-11); Planet in a Bottle kennt Spatial Crevice nicht (-21); Punch in the Box übersieht Kreaturenschaden (-15).
Gesamteindruck: Die Attacks (Schaden/ATK-Rechnung, Zusatzaktions-Buchhaltung, Stufensenkung, Ketten) sind sauber; die Befunde liegen fast ausschließlich in den Randverträgen (Sperren, Kontrolle, Negierung, Status). Bewusst NICHT getestet: CPU-/MCTS-Pfade, Client-/UI-Ausgrauung (nur Server-Seite), Elixir-/Heldengruppen-Karten außer als Gegenprobe, Petrifying-Potion-Klick-Heilung, Singing/Megu-Eigenpfad, Mehrspieler >2 Sitze, Wisdom × Learning-Zweitguss, Reaktionsketten mit mehreren gleichzeitigen Reaktoren auf Punch in the Box.

## Befunde
### M02-01 · Stranglehold zählt nur 5 von 17 negativen Status · Stufe B
- **Karten:** Stranglehold (`cards/effects/stranglehold.js`); betroffen sind alle Status, die andere Karten dieser Gruppe vergeben (Smoke Vial, Trunk Sand → Blinded)
- **Voraussetzungen / Aufbau:** `H.fresh()`, Sitz 0 Held 1 (Rick, ATK 80, keine Fighting-Stufe) spielt Stranglehold; Ziel Held 0 von Sitz 1 mit genau einem negativen Status (per `addHeroStatus`), 800 HP. Dasselbe mit einer Kreatur (Counter auf der Instanz).
- **Schritte:** 1. Status setzen. 2. Stranglehold über den echten Spielweg (`doPlaySpell`) auf das Ziel.
- **Erwartet** (Kartentext „deal 50 damage to it times the number of negative status effects it is inflicted with"): 50 Schaden je negativem Status. Die Engine führt 17 Status mit `negative: true` (`getNegativeStatuses()` in `_hooks.js`: frozen, stunned, negated, burned, poisoned, bleeding, nulled, bound, blinded, blinded_hit, webbed, magic_silenced, frightened, berserked, cursed, aged, soul_transmitted). Der Kartentext schränkt nicht auf eine Teilmenge ein.
- **Beobachtet:** Nur frozen/stunned/negated/burned/poisoned liefern 50. Bleeding, Nulled, Bound, Blinded, Blinded (Trunk Sand), Webbed, Magic Silenced, Frightened, Berserked, Cursed, Aged, Soul Transmitted liefern **0 Schaden** (Held mit Frozen + Bleeding + Blinded erleidet nur 50 statt 150). Bei Kreaturen zählen ebenfalls nur die fünf; Blinded (Trunk Sand), Bleeding, Bound, Nulled, Webbed, Magic Silenced → 0.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/01-stranglehold-zaehlt-nur-5-status.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/stranglehold.js:19` `NEGATIVE_STATUSES = ['frozen','stunned','burned','poisoned','negated']` (eigene Liste statt `getNegativeStatuses()`), `countNegativeStatuses` Z. 26–44. Anhänge, die als negativer Status zählen (`countsAsNegativeStatus`: Decisive Defeat, Stowaway; `engine.cleansableHeroEntries`) werden ebenfalls nicht gezählt. Rückfrage: Poison-Stapel (2 Stacks aus Poison Vial) zählen als 1 Status – das ist textgemäß.

### M02-02 · Muscle Training: Held mit vollem Fighting-Stapel (Lv3) – die gesuchte Fighting-Karte verschwindet aus dem Deck · Stufe A
- **Karten:** Muscle Training (`cards/effects/muscle-training.js`)
- **Voraussetzungen / Aufbau:** `H.fresh()`, Sitz 0 Held 1 (Rick) mit Fighting ×3 in Zone 0 (Zonen 1+2 frei), Deck beginnt mit `Fighting`; Hand: Muscle Training (Fighting Lv0).
- **Schritte:** 1. `t.play(0, 'Muscle Training', {hero: 1, noGrant: true})`. 2. Kartenbilanz (`t.census()`) vor/nach.
- **Erwartet** („Search your deck for a copy of Fighting and attach it to the user as an additional attachment" + Regel 23.9 „Abbruch = nichts ist passiert"): entweder wird die Karte gar nicht angeboten/abgebrochen (Karte zurück auf die Hand, Deck unverändert), oder Fighting wird angehängt. Keinesfalls geht eine Karte verloren.
- **Beobachtet:** Das Fighting-Exemplar ist weg: weder Hand, Deck, Ablage, Gelöscht noch Brett (Bilanz „Fighting: −1"). Muscle Training geht in die Ablage, die Aktion ist verbraucht, keine Fehlermeldung.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/02-muscle-training-fighting-3-verschluckt-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `muscle-training.js:31` `heroCanAcceptFighting` akzeptiert jede freie Zone, auch wenn der Held schon einen vollen Fighting-Stapel hat (`engine.abilityZielZone` liefert dann −1). `onPlay` nimmt Fighting trotzdem per `takeFromPile` aus dem Deck (Z. 135) und kehrt bei `targetZone < 0` (Z. 143) kommentarlos zurück.

### M02-03 · Thieving Strike: Das Thieving eines (hart) NEGIERTEN Helden senkt die Stufe weiterhin auf 0 · Stufe B
- **Karten:** Thieving Strike (`cards/effects/thieving-strike.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 Held 1 mit Thieving (1 Kopie), Status `negated` (Standardform = HART: „Heldeneffekt UND Ability-Zonen ausgeblendet", CARD_API.md ~Z. 14265). Thieving Strike (Lv2) auf der Hand, kein Fighting-Schulwert nötig, da Stufe 0.
- **Schritte:** 1. Held negieren. 2. `t.play(0, 'Thieving Strike', {hero: 1, noGrant: true})`. Kontrollen: negierter Held mit Fighting 1 kann Quick Attack (Lv1) nicht spielen ✓; negierter Held ohne Thieving kann Thieving Strike nicht spielen ✓.
- **Erwartet** („If the user has the Thieving Ability, this Attack's level becomes 0" + Engine-Regel `heroMeetsLevelReq`: „Hard Negation blanks ability zones: only Lv0 cards without a school requirement remain playable"): ein negierter Held hat keine wirksame Thieving-Ability ⇒ Thieving Strike (Lv2) nicht spielbar.
- **Beobachtet:** Die Karte wird gespielt und richtet 80 Schaden an (HP 720).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/03-thieving-strike-negierter-held.js`
- **Vermutete Ursache:** `thieving-strike.js:27` `_heroHasThieving()` liest die Ability-Zonen direkt, ohne Heldenstatus; `canBypassLevelReq` (Z. 82) wird in `_testLevelReqForZones` (~_engine.js 43807) nach dem Schul-Check unabhängig von den „blanken" Zonen ausgewertet. Gleiche Klasse wie B-01…B-03 (Dauer-Vertrag liest Stilllegung nicht). Nicht geprüft: gefroren/betäubt (dort ist der Held ohnehin handlungsunfähig).

### M02-04 · Rocket Fist und Whirlwind Strike sind für geblendete Helden spielbar (Blinded-Sperre greift nicht) · Stufe B
- **Karten:** Rocket Fist (`rocket-fist.js`), Whirlwind Strike (`whirlwind-strike.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 Held 1 mit Status `blinded` bzw. `blinded_hit` (Smoke Vial / Trunk Sand), Gegner mit einer Kreatur; Karte auf der Hand.
- **Schritte:** 1. Status setzen. 2. `t.play(0, karte, {hero: 1})` für Quick Attack (Kontrolle), Rocket Fist, Whirlwind Strike.
- **Erwartet** (Regel `_hooks.js` STATUS_EFFECTS.blinded ~Z. 312: „`blinded` prevents the bearer from using Attacks, Spells, or activated effects that need to pick one or more targets"; Kartentexte „Choose a target …" / „Choose up to 2 Heroes …"): geblendeter Held kann beide nicht spielen (wie Quick Attack, Pusher, Ricochet, Shattering Strike ✓).
- **Beobachtet:** Beide werden gespielt und schaden (blinded und blinded_hit); Quick Attack wird korrekt abgelehnt.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/04-rocket-fist-whirlwind-blinded.js`
- **Vermutete Ursache:** Weder `rocket-fist.js` noch `whirlwind-strike.js` tragen `requiresTarget: true` (Quick Attack: `quick-attack.js:20`); die Engine gatet nur auf diese Marke (_engine.js ~20845, ~40876). Statisch auf das ganze Repo ausdehnbar: jede zielende Karte ohne die Marke.

### M02-05 · Stealth schützt den Helden weiter, wenn er gefroren / betäubt / (hart) negiert ist · Stufe B/C
- **Karten:** Stealth (`stealth.js`, `blocksTargeting`)
- **Voraussetzungen / Aufbau:** Sitz 1 Held 0 mit Stealth Lv3, Held 1/2 sind frei wählbar; Sitz 0 spielt Quick Attack (Lv1). Held 0 von Sitz 1 wahlweise `frozen`/`stunned`/`negated`.
- **Schritte:** 1. Zustand setzen. 2. `t.play(0, 'Quick Attack', {hero: 1})`, angebotene Ziele aus `t.targets[0].valid` lesen.
- **Erwartet** (Konvention CARD_API.md ~Z. 4364 / B-querschnitt B-01…B-03, B-09: Abilities eines gefrorenen/betäubten/negierten Helden sind stillgelegt; Kartentext „This Hero cannot be chosen …"): Stealth ist stillgelegt, der Held wird wählbar.
- **Beobachtet:** In allen drei Zuständen bleibt Held 0 unwählbar (angeboten: [1, 2]).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/05-stealth-gefroren-betaeubt-negiert.js`
- **Vermutete Ursache:** `stealth.js` `blocksTargeting` prüft keinen Heldenstatus; der Dauer-Vertrag läuft nicht über `runHooks` (gleiche Klasse wie B-01…B-03/B-09, nur andere Karte).
- **Frage an Al:** Soll ein gefrorener/betäubter/negierter Stealth-Held wählbar werden (Konvention) – oder ist „bleibt geschützt" gewollt (etwa wie bei „Resistance")?

### M02-06 · Weapon Storm lässt sich vor der ersten gesendeten Karte nicht abbrechen (Schwesterkarte Breaking Strike schon); Abbruch-Knopf = 40 Wiederholungen, Karte verbraucht · Stufe C
- **Karten:** Weapon Storm (`weapon-storm.js`); Vorrunden-`lead`, Abbruch-Konformität-Abweichler in B-querschnitt („Weapon Storm (40 Wiederholungen)") – hier die Ursache.
- **Voraussetzungen / Aufbau:** Sitz 0 Held 1 mit Fighting ×2, Toughness, ausgerüstet Blade of the Swamp Witch; `t.policy.cancelTargets = true` (Abbruch-Knopf).
- **Schritte:** 1. `t.play(0, 'Weapon Storm', {hero: 1})`. 2. Vergleich mit Breaking Strike.
- **Erwartet** (Regel 23.9 / CARD_API.md „Zielende Karten sind immer abbrechbar", Breaking Strike hat `cancelAtZero`): erster Wähler hat einen Abbruch, Karte bleibt auf der Hand, Aktion bleibt.
- **Beobachtet:** Weapon Storm stellt 40 Prompts, die erste Wahl ist `cancellable: false` („✓ Done"), danach landet die Karte **ohne Wirkung in der Ablage** (Phase 4, Aktion verbraucht). Ein Mensch kann nur „Done" mit 0 Karten wählen – das ist nach „any number" zulässig und verbraucht die Karte ebenfalls.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/06-weapon-storm-kein-abbruch-vor-erster-karte.js`
- **Vermutete Ursache:** `weapon-storm.js:66` `sendCardsLoop(…)` ohne `cancelAtZero: true`.
- **Frage an Al:** Soll Weapon Storm wie Breaking Strike vor der ersten abgelegten Karte abbrechbar sein (Karte bleibt auf der Hand) – ja oder nein?

### M02-07 · Monster in a Bottle: die beschworene Kreatur zählt nicht für „diesen Zug beschworen" · Stufe B
- **Karten:** Monster in a Bottle (`monster-in-a-bottle.js`); betroffen sind alle „erste Kreatur diesen Zug"-Tore (Aggressive Town Guard, Pawn/Rook of Kings, Harpyformer, Ska …).
- **Voraussetzungen / Aufbau:** Sitz 0: Monster in a Bottle + 2× Aggressive Town Guard auf der Hand; die Flasche beschwört Town Guard (Skript der Galerie-/Zonenwahl), danach wird die zweite Town Guard in der Aktionsphase gespielt (`keepActions`).
- **Erwartet** (Engine-Konvention: jede auf das Brett gebrachte Kreatur erhöht `ps._creaturesSummonedThisTurn`, z. B. `necromancy.js`, `create-illusion.js`; Town Guard: „If this is the first Creature you summon this turn, … counts as an additional Action"): nach der Flasche ist der Zähler ≥ 1, die zweite Town Guard ist **keine** Zusatzaktion.
- **Beobachtet:** Zähler bleibt 0; die zweite Town Guard bleibt Gratis-Zusatzaktion (Phase 3 statt 4).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/07-monster-in-a-bottle-zaehlt-nicht-als-beschwoerung.js`
- **Vermutete Ursache:** `monster-in-a-bottle.js:252` `engine._trackCard(…)` stellt die Kreatur direkt aufs Brett, ohne `_creaturesSummonedThisTurn` zu erhöhen.

### M02-08 · Toughness: HP-Bonus wird bei negiertem / gefrorenem / betäubtem Helden weder vergeben noch zurückgenommen · Stufe A (negiert: Textwiderspruch „cannot be negated“; gefroren/betäubt: Konventionsklasse B-01…B-09)
- **Karten:** Toughness (`toughness.js`); gleiche Wirkung bei Fighting (ATK-Bonus; Fighting gehört nicht zu dieser Liste, nur als Gegenprobe).
- **Voraussetzungen / Aufbau:** (a) Held 0 mit 800 HP bekommt Toughness (Hand → Zone 0) im Zustand negated/frozen/stunned. (b) Held mit Toughness ×2 (bzw. Fighting ×2), Zustand setzen, `engine.discardAbilityTopCopy`.
- **Erwartet** (Kartentext „The Hero's current and max HP are increased by 100/200/400. This Ability cannot be negated."): (a) Bonus auch bei negiertem Helden; (b) beim Verlassen der Kopie wird der Bonus in **jedem** Heldenzustand wieder abgezogen.
- **Beobachtet:** (a) Anlegen an negierten/gefrorenen/betäubten Helden: Max-HP/HP bleiben 800 (statt 900) – bei **negated widerspricht das dem Text „cannot be negated"**. (b) Abwurf bei solchem Helden: Max-HP bleibt 1000 (statt 900), Fighting-ATK bleibt 50 (statt 40) – der Bonus einer nicht mehr vorhandenen Karte bleibt dauerhaft.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/08-toughness-negiert-gefroren-bilanz.js`
- **Vermutete Ursache:** `runHooks` filtert Hooks von Abilities negierter/gefrorener/betäubter Helden heraus (_engine.js ~3191, ~3250); `toughness.js` trägt (anders als Resistance, `resistance.js:30`) kein `bypassStatusFilter`; `onPlay` und `onCardLeaveZone` (Z. 81) feuern darum nicht.

### M02-09 · Ein (hart) NEGIERTER Held kann die freien Aktivierungen seiner Abilities weiter nutzen (Pillage, Thieving, Trade) · Stufe B
- **Karten:** Pillage, Thieving, Trade (`freeActivation`); gilt für jede frei aktivierbare Ability.
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Pillage / Thieving / Trade in den drei Zonen, Status `negated` (Standardform = hart); Aktivierung per `server.doActivateFreeAbility` in Phase 2. Kontrollen: unversehrter Held ✓ (Gegnerdeck −1, +9 Gold), gefrorener und betäubter Held aktivieren nichts ✓.
- **Erwartet** (Engine-Regel: `_isHeroEffectSilenced` (_engine.js ~6447: stunned/webbed/frozen/negated/mummified), `heroMeetsLevelReq` „Hard Negation blanks ability zones", `doActivateHeroEffect` sperrt „Stunned / negated"): ein hart negierter Held verliert seine Ability-Effekte, kann also nichts aktivieren.
- **Beobachtet:** Alle drei laufen und wirken (Gegnerdeck 9, +9 Gold).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/09-negierter-held-aktiviert-abilities.js`
- **Vermutete Ursache:** `server.js:9501` `doActivateFreeAbility` (Prüfung Z. ~9536 nur stunned/webbed/frozen) und `getFreeActivatableAbilities` (_engine.js ~42456) prüfen `negated` nicht. Die leichte Negation (Decisive Defeat / Weakening Crystal, „Abilities still work") ist davon ausgenommen und nicht gemeint.

### M02-10 · Ein NEGIERTER Trank stempelt seine Einmal-Grenze nicht (Teleportation Powder, Resuscitation Potion: pro Spiel; Magnetic Potion, Sword in a Bottle: pro Zug) · Stufe B
- **Karten:** Teleportation Powder, Resuscitation Potion, Magnetic Potion, Sword in a Bottle (`server.js` `doUsePotion`/`doConfirmPotion`)
- **Voraussetzungen / Aufbau:** Sitz 0: zwei Kopien des Tranks auf der Hand; Sitz 1 hat „The Master's Plan" (Decay Magic Lv3) und negiert die erste Kopie.
- **Schritte:** 1. Erste Kopie spielen, negieren lassen (Trank → Ablage, `_oncePerGameUsed` leer, HOPT nur `masters_plan`). 2. Zweite Kopie im selben Zug spielen.
- **Erwartet** (Ruling CARD_API.md ~Z. 11433 „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …, unabhängig davon, ob ein Gegenzug sie später negiert"; Kartentexte „You can only play 1 … per game/turn"): die zweite Kopie ist nicht mehr spielbar.
- **Beobachtet:** Alle vier: die zweite Kopie wird ohne Weiteres gespielt (Magnetic Potion holt Fighting, Teleportation Powder/Resuscitation Potion/Sword in a Bottle verlassen die Hand). Gleiche Klasse wie S01-01.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/10-negierter-trank-stempelt-nicht.js`
- **Vermutete Ursache:** `server.js` ~11533 und ~11990: `_markOncePerGamePotion(ps, script, cardName)` steht nur im Nicht-Negations-Zweig (`else if (cardType === 'Potion')` bzw. `else`); der `chainResult.negated`-Zweig ruft nur `routeNegatedInitialCard` auf. Gleiches gilt für den HOPT-Stempel der „pro Zug"-Tränke (im `resolve`).

### M02-11 · Resistance schützt nicht vor Life Serum (+150 Max-HP) und Teleportation Powder (Entfernen aus dem Spiel) · Stufe B
- **Karten:** Resistance (`resistance.js`), Life Serum (`life-serum.js`), Teleportation Powder (`teleportation-powder.js`)
- **Voraussetzungen / Aufbau:** Sitz 1 Held 0 (800 HP) mit Resistance Lv1 bzw. Lv3; Sitz 0 spielt Poison Vial (Kontrolle), Life Serum, Teleportation Powder auf diesen Helden (`t.play`, Ziel per `targetFn`).
- **Erwartet** (Resistance Lv1 „The first card or effect every turn that would affect this Hero, except damage, doesn't affect it", Lv3 „unaffected by all cards and effects, except damage"): beide Tränke wirken nicht auf den Helden (Lv1: jeweils die erste Karte des Zuges).
- **Beobachtet:** Poison Vial wird abgewehrt ✓. Life Serum erhöht Max-HP/HP auf 950, Teleportation Powder entfernt den Helden (Name leer, HP 0) – in Lv1 **und** Lv3.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/11-resistance-luecken-life-serum-teleportation.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `resistance.js` fängt nur Status-Anwendungen (`onStatusApplied`) und `beforeHeroEffect` ab; letzterer feuert nur in `actionHealHero` (vgl. Kommentar `_engine.js:6606`). `engine.increaseMaxHp` (`_engine.js:10484`) und der Entfernen-Weg des Powders fragen ihn nie. Klasse: „Schutz-Fähigkeit mit Teilabdeckung" – jede nicht-statusartige Wirkung auf den Helden geht an Resistance vorbei.
- **Frage an Al:** Soll Resistance auch „nicht-Schaden"-Wirkungen ohne Status (Max-HP-Buffs eigener Karten, Entfernen aus dem Spiel, Ability-Abwurf) abfangen – oder ist der Schutz bewusst auf Status/Heilung beschränkt?

### M02-12 · Terror erzwingt das Zugende auch bei gefrorenem / betäubtem Träger (nur „negiert" legt es still) · Stufe B/C
- **Karten:** Terror (`terror.js`, Engine `terrorSchwelle`)
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Terror ×3 (Schwelle 5), Status wahlweise keiner / negated / frozen / stunned; Sitz 0 spielt 5 Tränke mit verschiedenen Namen (Smoke Vial, Tears of Creation, Life Serum, Poison Vial, Magnetic Potion), `keepActions`.
- **Erwartet** (Kartentext „After a player has resolved a total of 5 cards or effects with different names during their turn, their turn immediately moves to the End Phase" + Konvention B-querschnitt B-01…B-03/B-09: Abilities gefrorener/betäubter/negierter Helden sind stillgelegt): bei gefrorenem/betäubtem Terror-Träger kein erzwungenes Zugende.
- **Beobachtet:** unversehrt ✓ (Zugende nach der 5. Karte), negiert ✓ (Schwelle `Infinity`), **gefroren ✗ und betäubt ✗: `gs._terrorForceEndTurn = 0` nach der 5. Karte.**
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/12-terror-gefroren-betaeubt.js`
- **Vermutete Ursache:** `_engine.js:28557` in `terrorSchwelle()` prüft nur `hero.hp <= 0` und `hero.statuses?.negated`, nicht frozen/stunned. Terror läuft als Engine-Passiv, nicht über `runHooks`. Gleiche Klasse wie B-09 (Ghazma).
- **Frage an Al:** Soll ein gefrorener/betäubter Terror-Held aufhören zu zählen (wie alle Ability-Passive) – oder gilt der Zähler als „Brett-Eigenschaft"?

### M02-13 · Luck zieht doppelt, wenn der Gegner einen Area- oder Attachment-Zauber spielt (4/6/8 statt 2/3/4 Karten) · Stufe A
- **Karten:** Luck (`luck.js`); betroffen sind alle Area- und die meisten Attachment-Zauber (getestet: Slippery Ice, Dark Ocean, Invisibility).
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Luck Lv1/2/3, Sitz 0 deklariert den Kartennamen (`doActivateFreeAbility`, Wähler skripten), `t.endTurn()`, Sitz 1 spielt die deklarierte Karte aus der Hand (Gegenkarte auf Sitz 1, Sitz 0 zieht aus einem 10er-Deck).
- **Erwartet** (Kartentext „Whenever your opponent plays a card of that name … draw 2/3/4 cards"): ein Ausspielen = ein Auslösen = 2/3/4 Karten (Kontrolle Fireball: ✓ 2/3/4).
- **Beobachtet:** Slippery Ice (Area), Dark Ocean (Area), Invisibility (Attachment): **4 / 6 / 8** gezogene Karten. (Regeneration, ebenfalls Attachment, zieht korrekt 2: andere Zone-Eintrittsform.)
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/13-luck-doppelt-bei-area-und-attachment.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `luck.js:144` (`afterSpellResolved`) **und** `luck.js:161` (`onCardEnterZone`) rufen beide `_triggerLuck`; Areas und Attachments erzeugen beide Ereignisse (Stacktrace-Probe: je 2 Aufrufe), es gibt keine Entdoppelung (z. B. eine Marke je Spielvorgang).

### M02-14 · Luck löst nicht aus, wenn der Gegner ein Normal-Artefakt spielt · Stufe B
- **Karten:** Luck (`luck.js`); Normal-Artefakte (Treasure Chest, Golden Bananas, Snow Cannon, Magic Cobalt getestet).
- **Voraussetzungen / Aufbau:** wie M02-13, deklariert wird ein Normal-Artefakt (der Namens-Wähler bietet es an: `allNames` schließt nur Token/Reaction/Surprise aus).
- **Erwartet** (Kartentext „Whenever your opponent plays a card of that name … draw"): Gegner spielt Treasure Chest ⇒ 2 Karten gezogen (Kontrolle Life Serum/Trank: ✓).
- **Beobachtet:** 0 Karten gezogen, in allen vier Fällen. Zauber, Attacken, Tränke, Ausrüstung, Fähigkeiten, Kreaturen lösen aus.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/14-luck-sieht-normale-artefakte-nicht.js`
- **Vermutete Ursache:** `luck.js` hat Hooks für `afterSpellResolved`, `onCardEnterZone`, `afterPotionUsed` – aber keinen für `afterArtifactUsed` (`server.js:11562`, `:12284`). Normal-Artefakte betreten keine Zone.

### M02-15 · Punch in the Box wird nur bei Heldenschaden angeboten, nicht wenn eine eigene Kreatur Schaden nimmt · Stufe B
- **Karten:** Punch in the Box (`punch-in-the-box.js`)
- **Voraussetzungen / Aufbau:** Sitz 1 hat Punch in the Box auf der Hand (Ja-Antwort per `t.policy.confirm`), eine ZZ-Dummy-Big-Kreatur (1000 HP) auf dem Brett; Sitz 0 spielt Fireball (150) auf diese Kreatur. Kontrolle: derselbe Fireball auf Sitz-1-Held 0.
- **Erwartet** (Kartentext „Play this card immediately when a **target** you control takes damage from an opponent's card or effect. Choose a target your opponent controls and deal half that damage to it (rounded up)"; „target" heißt in diesem Spiel Held oder Kreatur, Punch wählt selbst Kreaturen als Rückschlag-Ziel): Fenster öffnet auch bei Kreaturenschaden, Rückschlag 75.
- **Beobachtet:** Held ⇒ Fenster, Rückschlag 75 ✓. Kreatur verliert 150 HP (850/1000), **kein Fenster**, Punch bleibt auf der Hand.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/15-punch-in-the-box-ignoriert-kreaturenschaden.js`
- **Vermutete Ursache:** `punch-in-the-box.js` trägt nur `isAfterDamageReaction` (Helden-Nach-Schadens-Fenster, `_engine.js` ~33700); für Kreaturen gibt es das getrennte Fenster `isAfterCreatureDamageReaction` (nutzen nur corpse-explosion.js, decapitating-strike.js, spiky-armor.js). Hinweis: „nur bei Überleben" (Punch feuert nicht bei tödlichem Heldenschaden) ist laut Kommentar `_engine.js:33645` bewusste „long-standing semantics" und hier nicht gemeint.

### M02-16 · Tears of Creation zählt einen eigenen, vom Gegner gecharmten Helden mit · Stufe B
- **Karten:** Tears of Creation (`tears-of-creation.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 mit 3 lebenden Helden und 20 Gold; Held 1 von Sitz 0 ist vom Gegner gecharmt (`hero.charmedBy = 1` + Status `charmed`); `engine.heroesControlledBy(0)` liefert 2.
- **Erwartet** (Kartentext „Gain 5 Gold for every target you control"; Kontrolle hängt an `charmedBy`, CARD_API.md Charme-Abschnitt): 2 Ziele ⇒ 10 Gold.
- **Beobachtet:** 15 Gold (der vom Gegner kontrollierte Held zählt weiter). Gegenprobe: ein vom Spieler gecharmter Gegnerheld zählt mit (20 Gold) ✓.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/16-tears-of-creation-zaehlt-gecharmten-eigenen-helden.js`
- **Vermutete Ursache:** `tears-of-creation.js:38–39` zählt `ps.heroes` mit `hp > 0` ohne `charmedBy`-Prüfung; nur die Gegnerseite wird auf `charmedBy === pi` geprüft. Statt dessen `engine.heroesControlledBy(pi)` (wie Punch in the Box).

### M02-17 · Magnetic Potion ist unter der Such-Sperre auf dem Server spielbar und verbraucht sich ohne Wirkung (gleiche Ursache: Elixir of Mana) · Stufe C
- **Karten:** Magnetic Potion (`blockedBySearchLock`), Elixir of Mana (`blockedBySearchLockDiscard`, nicht in dieser Gruppe)
- **Voraussetzungen / Aufbau:** Sitz 0 `searchLocked = true` (Elixir of Mana: zusätzlich `searchLockedIncludesDiscard`), Trank + 1 Handkarte, Deck mit 4 Karten; `t.play(0, name, {noGrant: true, handIndex: 0})`.
- **Erwartet** (Ruling `_engine.js` ~10690, v1069, Al 14.9.: „Karten, die NUR suchen, sollen gar nicht erst spielbar sein"): Trank nicht spielbar (`false`), bleibt auf der Hand, kein Stempel.
- **Beobachtet:** `true`; der Trank landet im Löschstapel, der Zug-Stempel `magnetic-potion:0` sitzt, die Galerie öffnet sich, **keine** Karte kommt auf die Hand. Der Client graut den Trank aus (`searchLockBlockedCards`, `server.js` ~5025), der Server-Weg lehnt nicht ab.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/17-magnetic-potion-such-sperre-server-tor.js`
- **Vermutete Ursache:** `server.js` `doUsePotion` (~11886) prüft nur `blockedByHandLock`/`PileLock`/`SummonLock`, nicht `engine._cardBlockedBySearchLock(script, cardData, ps, pi)` – der Zauber-/Attackenweg hat die Prüfung (`_engine.js:20963`). Nur über einen manipulierten Client oder die CPU erreichbar.
- **Frage an Al:** Soll der Potion-Server-Weg wie `validateActionPlay` die Such-Sperre prüfen (ja/nein)? Aktuell hängt der Schutz allein am Client.

### M02-18 · Magic Lamp: negiert „Ambush the Scout" den Einfüge-Schritt, verschwinden die drei gewählten Karten aus dem Spiel · Stufe A
- **Karten:** Magic Lamp (`magic-lamp.js`), Ambush the Scout (Gegner-Reaktion „effect that would interact with your hand")
- **Voraussetzungen / Aufbau:** Sitz 0 spielt Magic Lamp (Deck: Fighting, Toughness, Wealth, ZZ Dummy; Wahl Fighting/Toughness/Wealth); Sitz 1 hat Ambush the Scout (Decay Magic Lv1) + 3 Füllkarten auf der Hand, `policy.confirm = true`, Zug 5.
- **Erwartet** (Kartentext „Add that card to your opponent's hand and the other 2 to your hand"; Ambush „Negate that effect"; Kartenbilanz-Regel): Negierung verliert keine Karte – entweder bleiben die drei im Deck, oder die zwei eigenen kommen auf die Hand.
- **Beobachtet:** Ambush negiert den Einfüge-Schritt ✓, aber Fighting, Toughness und Wealth sind weder im Deck noch auf einer Hand noch in einer Ablage (Bilanz −1 je Karte). Ohne Ambush läuft alles sauber (Gegner nimmt Fighting, ich bekomme Toughness + Wealth).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/18-magic-lamp-ambush-karten-verschwinden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `magic-lamp.js:95` entnimmt die drei Karten per `takeFromPile` dem Deck, bevor das Fenster `checkHandInteractionReaction(oppIdx, 'insert', …)` (Z. 150) öffnet; bei Negierung folgt nur `return` – ohne Rückgabe ins Deck und ohne die zwei Karten für den Spieler. (Zu prüfen: gleiche Bauform in anderen „insert"-Fenstern; Birthday Present und Live Show haben je eigene Aufrufe.)

### M02-19 · Magic Lamp ignoriert die Such-Sperre (durchsucht das Deck und fügt der eigenen Hand Karten hinzu) · Stufe B
- **Karten:** Magic Lamp (`magic-lamp.js`); Such-Sperre aus Cats of the Pharaoh
- **Voraussetzungen / Aufbau:** Sitz 0 `searchLocked = true`, Magic Lamp auf der Hand (Zug 5), Deck Fighting/Toughness/Wealth/ZZ Dummy; Kontrolle Magnetic Potion.
- **Erwartet** (Cats of the Pharaoh: „you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)"; `_engine.js` ~10630: `searchLocked` „sperrt NUR Suchen und Adds"): Magic Lamp ist wie Magnetic Potion unter der Sperre wirkungslos/gesperrt – die eigene Hand bekommt keine Deck-Karten.
- **Beobachtet:** Magic Lamp läuft vollständig: Galerie öffnet sich, der Gegner bekommt eine Karte, die eigene Hand bekommt zwei Karten aus dem Deck. Kontrolle Magnetic Potion: nichts hinzugefügt ✓ (aber M02-17).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/19-magic-lamp-ignoriert-such-sperre.js`
- **Vermutete Ursache:** `magic-lamp.js` trägt kein `blockedBySearchLock` (die Auto-Erkennung des Laders erkennt `takeFromPile(ps,'deck',…)` + `handZugangSync` nicht, vgl. B-querschnitt „Sperren-Auto-Erkennung") und ruft kein `engine._isSearchBlocked` auf. Außerdem greift die Sperre bei `engine.handZugangSync` nicht.

### M02-20 · Overflowing Chalice und Pressed Skill: „a Hero you control" nutzt die physische Heldenreihe statt der Kontrolle (gecharmte Helden) · Stufe C
- **Karten:** Overflowing Chalice (`overflowing-chalice.js`), Pressed Skill (`pressed-skill.js:45–52` `eligibleHeroIdxs` läuft ebenfalls über `ps.heroes`; Prompt `abilityAttachTarget` bietet den vom Gegner gecharmten eigenen Held 1 als Ziel an, der von mir gecharmte Gegnerheld fehlt)
- **Voraussetzungen / Aufbau:** Sitz 0 spielt Chalice; (a) eigener Held 1 vom Gegner gecharmt (`charmedBy = 1`), (b) Gegnerheld 0 von mir gecharmt.
- **Erwartet** (Kartentext „Your opponent chooses a Hero you control. That Hero may immediately perform an additional Action"; Kontrolle = `engine.heroesControlledBy`): (a) der vom Gegner gecharmte Held steht nicht zur Wahl, (b) der von mir gecharmte Gegnerheld steht zur Wahl.
- **Beobachtet:** Die Optionsliste ist in beiden Fällen immer meine drei physischen Helden. Gewählt wird (a) der vom Gegner kontrollierte Held (der Gegner kann damit die Zusatzaktion „verfallen" lassen – Prompt `heroAction` für Rick erscheint), (b) der gecharmte Gegnerheld fehlt.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/20-overflowing-chalice-heldenkontrolle.js`
- **Vermutete Ursache:** `overflowing-chalice.js:33` `lebendeHelden(ps)` läuft über `ps.heroes`; dieselbe Klasse wie M02-16 (Tears of Creation). Ob `engine.performImmediateAction` für einen Held auf der Gegnerseite überhaupt ausgelegt ist, ist unklar.
- **Frage an Al:** Soll Overflowing Chalice die Helden nach Kontrolle (`heroesControlledBy`) anbieten – ja oder nein (Charme-Helden sind ein Randfall)?

### M02-21 · Planet in a Bottle ist mit Spatial Crevice (Area-Limit 3) gesperrt, obwohl die Engine eine weitere Area erlaubt · Stufe B
- **Karten:** Planet in a Bottle (`planet-in-a-bottle.js`), Spatial Crevice (hebt das Limit auf 3)
- **Voraussetzungen / Aufbau:** Sitz 0 mit Planet in a Bottle auf der Hand, Dark Ocean (Area Lv1) im Deck; Brett: (a) keine Area, (b) Spatial Crevice, (c) Slippery Ice.
- **Erwartet** (Kartentext „bring it directly into play"; CARD_API.md ~Z. 11950: `canPlaceAnotherArea(pi, name)` ist das eine Gate, Crevice erlaubt „up to 3 DIFFERENT Areas"): (b) spielbar – Dark Ocean kommt als zweite Area dazu.
- **Beobachtet:** (a) ✓ spielbar, (c) korrekt gesperrt (Limit 1), **(b) nicht spielbar** (`false`, Karte bleibt auf der Hand), obwohl `engine.canPlaceAnotherArea(0, 'Dark Ocean') === true`.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/21-planet-in-a-bottle-spatial-crevice.js`
- **Vermutete Ursache:** `planet-in-a-bottle.js:53` `playerControlsArea(gs, pi)` = „liegt irgendeine Area" (hartes Limit 1), benutzt in `canActivate` (Z. 102) und `resolve` (Z. 117), statt `engine.canPlaceAnotherArea`.

### M02-22 · Ricochet wählt Ziele nach physischer Seite statt nach Kontrolle (eigene gestohlene Kreatur wird zum „Ziel des Gegners") · Stufe B
- **Karten:** Ricochet (`ricochet.js`); Gegenprobe Shattering Strike (filtert korrekt nach Kontrolle)
- **Voraussetzungen / Aufbau:** Sitz 1 hat eine Kreatur (1000 HP), die Sitz 0 gestohlen hat (`owner 1`, `controller 0`, liegt auf Seite 1); alle Helden außer Rick (Sitz 0, ATK 100) sind tot; Sitz 0 spielt Ricochet, Zielwahl = erstes angebotenes Ziel.
- **Erwartet** (Kartentext „choosing targets their opponent controls"; Konvention Kontrolle statt Seite): Der Gegner kontrolliert nichts ⇒ Sitz 0 hat kein wählbares Ziel; die eigene gestohlene Kreatur wird nicht getroffen (HP 1000).
- **Beobachtet:** Der erste Wähler bekommt `equip-1-0-0` (seine eigene gestohlene Kreatur) angeboten und fügt ihr 100 Schaden zu (HP 900); die zweite Wahl (Gegner) sieht nur `hero-0-1`. Spiegelbildlich würden vom Gegner gestohlene Kreaturen auf meiner Seite dem Gegner als „Ziele, die ich kontrolliere" angeboten, und meine auf Gegnerseite liegenden fehlen.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/22-ricochet-gestohlene-kreatur.js`
- **Vermutete Ursache:** `ricochet.js:71–76` `zieleAuf(engine, seite)` → `engine.getHeroTargets(seite)` + `getCreatureTargets(seite)` (`_engine.js:40250`) = PHYSISCHE Seite. Die Gate-Funktion `spellPlayCondition` (Z. ~96) hat dieselbe Lücke. (Whirlwind Strike „all Creatures in their Support Zones" trifft gestohlene Kreaturen in diesen Zonen – das ist dort textgemäß.)

### M02-23 · Such-Sperre: Navigation zahlt die Abwurf-Kosten und bekommt nichts; Trapping, Premonition, Training (Deck-Option) laufen trotz Sperre ganz durch · Stufe B
- **Karten:** Navigation (`navigation.js`), außerdem Trapping, Premonition, Training Lv2/3 Option B (gleiche Ursache, nur beobachtet)
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Navigation ×2; Hand: Fireball ×2 + Füllkarte; Deck mit 4 Karten; `ps.searchLocked = true` (Cats of the Pharaoh); Aktivierung per `doActivateFreeAbility`. Kontrolle ohne Sperre: Navigation liefert eine Karte.
- **Erwartet** (Cats of the Pharaoh „you cannot search or add cards to your hand … (but you can still draw)"; Ruling v1069/Al 14.9. „Karten, die NUR suchen, sollen gar nicht erst spielbar sein"): Navigation ist unter der Sperre nicht aktivierbar – nichts abgeworfen, Once-per-turn frei.
- **Beobachtet:** `true`; die zwei Fireball werden abgeworfen (Kosten bezahlt), Galerie öffnet sich, keine Karte kommt auf die Hand, HOPT `free-ability:Navigation:0` ist gestempelt, die Handsperre-Folge greift. Trapping legt „Booby Trap" trotz Sperre aus dem Deck ins Spiel, Premonition legt die Karte trotz Sperre obenauf, Training Lv3 durchsucht das Deck trotz Sperre.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/23-navigation-such-sperre-kosten-verloren.js`
- **Vermutete Ursache:** Keine der 41 Abilities trägt `blockedBySearchLock` (Loader-Auto-Erkennung; Navigation nur `blockedByHandLock`), und der Free-Ability-Weg (`server.js:9501 doActivateFreeAbility`, `_engine.js:42456 getFreeActivatableAbilities`, dort nur Hand-/Pile-/Summon-Sperre ~Z. 42515–42523) fragt `_cardBlockedBySearchLock` nie; nur die Aktions-Ability-Liste (`_engine.js:40890`) tut es.
- **Frage an Al:** Sollen Ability-Aktivierungen, die nur ins Deck greifen (Navigation, Trapping, Premonition, Training-Deck-Option), unter der Such-Sperre ausgegraut sein (wie Magnetic Potion) – ja oder nein? Navigation verliert die Kosten in jedem Fall.

### M02-24 · Singing auf eine Surprise-Kreatur (Pure Advantage Camel & Co.) hinterlässt eine Geister-Instanz · Stufe A
- **Karten:** Singing (`singing.js`), betroffen: Pure Advantage Camel, Cactus Creature, Afflicted Pests, Afflicted Vermin, Mummy Maker Machine, Noble Mummy Guards (alle haben „move this Creature … into the Hero's Surprise Zone" als aktiven Effekt)
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Singing Lv3; Sitz 1 hat die Surprise-Kreatur (Support Zone 0, nicht frisch gespielt); Aktivierung per `doActivateFreeAbility`, Bestätigungen mit Ja. Kontrolle: derselbe Effekt von seinem Besitzer aktiviert (`activateCreature`). Zur Auswirkung danach Massacre gespielt. Batterie: alle 149 Kreaturen Lv ≤ 3 mit aktivem Effekt als Singing-Ziel – nur diese sechs fielen auf.
- **Erwartet** („use its active effect as if you controlled it"; Zonen-Arrays und Instanz müssen übereinstimmen): nach dem Effekt liegt das Kamel face-down in der Surprise Zone und ist keine Brett-Kreatur mehr; `t.audit()` leer.
- **Beobachtet:** `surpriseZones[0] = ['Pure Advantage Camel']`, `supportZones[0]` leer – die Instanz hat aber weiter `zone: 'support'`, `faceDown: false` (Audit: „Geister-Instanz … Zone leer/anders"). Folge: Massacre („increased by 50 times the number of Creatures on the board") zählt das Kamel mit – **130 statt 80** Schaden. Eigene Aktivierung (Kontrolle): konsistent, 80.
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/24-singing-geisterinstanz-surprise-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `singing.js:71–108` `_makeBorrowInst` übergibt dem Effekt eine Schatten-Instanz („Mutations on the shim never reach the original creature"); `engine.surpriseCreatureReset` (`_engine.js:36789`) schreibt die Zonen-Arrays der realen Seite (`ps.supportZones`/`ps.surpriseZones`), setzt `zone/heroIdx/faceDown` aber nur auf `ctx.card` (= Schatten). Rückfrage: Soll Singing diese sechs Kreaturen ausschließen (Effekt verschiebt die Kreatur des Gegners; Nutznießer ist der Gegner) – oder die echte Instanz mitführen?

### M02-25 · Wisdom: der Server lässt einen Zauber über der eigenen Stufe ohne Abwurfmaterial zu (Zauber wirkt gratis) · Stufe C
- **Karten:** Wisdom (`wisdom.js`), Fireball (Lv2) als Probekarte
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Destruction Magic 1 und Wisdom 1; Hand nur Fireball (bzw. Fireball + Füllkarte als Kontrolle); `t.play(0, 'Fireball', {noGrant: true})`.
- **Erwartet** (Kartentext „discard as many cards as the Spell's level is too high"; CARD_API.md ~Z. 17916/18115: Wisdom-Abwurf braucht Material, `handFodderFor`): ohne Füllkarte ist der Fireball nicht spielbar.
- **Beobachtet:** Kontrolle ✓ (wirkt, Füllkarte abgeworfen). Ohne Füllkarte: `true`, Fireball wirkt (150 Schaden), die Kosten entfallen stillschweigend (kein Abwurf möglich).
- **Repro:** `docs/niche-tests/repro/M02-attacks-abilities-potions/25-wisdom-kosten-ohne-abwurfmaterial.js`
- **Vermutete Ursache:** `_engine.js` `validateActionPlay` (Z. 20598 ff.) enthält keine Wisdom-Prüfung; die Material-Prüfung `handFodderFor` steht nur in `getHeroPlayableCards` (Z. 19713/20083/20274, UI-Liste). Der Client graut die Karte aus, ein manipulierter Client oder die CPU-Wege ohne Liste umgehen das. Gleiche Klasse wie M02-17 (Server-Tor fehlt, nur UI sperrt).
- **Frage an Al:** Soll `validateActionPlay` die Wisdom-Kosten selbst prüfen (authoritativer Server) – ja oder nein?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Learning | L2 gezielt | Lv3: Zweitzauber (Meteor Crash, Boiling Oil, Fire Bolts) ✓; Lv1 ohne Magic-Arts-Auslöser: kein Trigger ✓; gleichnamige Zauber ausgeschlossen ✓; Zweitzauber zählt als Zusatzaktion (Phase 4 danach) ✓; Abbruch der Auswahl/Zielwahl verbraucht HOPT (laut Skriptkommentar gewollt) ✓ |
| Life Serum | L2 gezielt | Resistance lässt es durch ✗(→ -11); Max-HP-Deckel (Resuscitation-Held) ✓; Negierung ohne Bilanz-Abweichung ✓ |
| Luck | L2 gezielt | Area/Attachment doppelt ✗(→ -13); Normal-Artefakte ✗(→ -14); Zauber/Attacke/Trank/Ausrüstung/Ability Lv1–3 ✓; Reaction-/Surprise-Namen fehlen im Wähler (Beobachtung) |
| Magic Lamp | L2 gezielt | Ambush-Negierung verliert 3 Karten ✗(→ -18); Such-Sperre ✗(→ -19); <3 Namen nicht spielbar ✓; Zug 1 gesperrt ✓; eigene Hand-Sperre ✓ |
| Magnetic Potion | L2 gezielt | Negierung ohne Stempel ✗(→ -10); Such-Sperre serverseitig ✗(→ -17); HOPT nach Erfolg ✓; Galerie nicht abbrechbar (Absicht) |
| Mana Mining | L1 Standard | Flag `placesPollutionTokens` gegen alle 19 Kartentexte mit „Pollution Token“ geprüft: konsistent (Mana Beacon/Big Gwen bewusst ohne); die Pollution-Wirkung selbst gehört zu A01 |
| Massacre | L2 gezielt | 0 / 2 offene + 1 verdeckte Kreatur, Token, Cursed-Angreifer ✓ |
| Midnight Assault | L2 gezielt | Held mit 150/151/1 HP ✓; Stufensenkung durch eigene Kreatur ✓, gestohlene zählt nicht ✓, gefrorene zählt ✓; ignoriert immune/shielded/damage_proof ✓ |
| Monster in a Bottle | L2 gezielt | Zähler „diesen Zug beschworen“ ✗(→ -07); Galerie-/Zonenabbruch, Hand und Ablage, Negierung ✓; Summon-Sperre ✓ |
| Muscle Training | L2 gezielt | voller Fighting-Stapel verschluckt Karte ✗(→ -02); Equip-Zusatzaktion nur beim 1. Angriff des Helden ✓; ohne Fighting im Deck nicht spielbar ✓ |
| Navigation | L2 gezielt | Such-Sperre zahlt Kosten ✗(→ -23); Lv1/2 Hand-Sperre danach, Lv3 keine ✓; Hand-Sperre sperrt ✓ |
| Necromancy | L2 gezielt | Batterie: 406 Kreaturen Lv ≤ 3 aus der Ablage beschworen (377 landen), keine Fehler/Audit/Bilanz-Abweichung; Negierung endet zu Beginn des eigenen nächsten Zugs (echter `endTurn`) ✓; Phase bleibt 2 (Zusatzaktion) ✓ |
| Occultism | L2 gezielt | frisch gespielte Kreatur nicht opferbar ✓; gestohlenes Opfer → Ablage des Besitzers ✓; Kosten erst nach beiden Wahlen ✓; Beobachtung: das Opfer steht in der Schadens-Zielwahl noch als Ziel (Nutzerfehler, kein Befund) |
| Overflowing Chalice | L2 gezielt | Heldenkontrolle (Charme) ✗(→ -20); Nachteil immer ✓; Negierung ohne Kartenverlust ✓ |
| Performance | L2 gezielt | auf Toughness/Fighting/Wealth: Stufe +1, 50 Schaden, Bonus-Rücknahme beim Abwurf ✓; Held mit 50 HP stirbt (textgemäß) |
| Petrifying Potion | L1 Standard | Dauer 3 Besitzer-Runden (Verlauf über Zugwechsel) ✓; Negierung ✓; Heil-Klick nicht getestet |
| Pillage | L2 gezielt | negierter Held aktiviert ✗(→ -09); Lv1/2/3 = 1/3/5 Karten in die Ablage des Gegners ✓ |
| Planet in a Bottle | L2 gezielt | Spatial Crevice (Limit 3) ✗(→ -21); Limit 1 gesperrt ✓; Hand-Sperre egal ✓ |
| Poison Vial | L2 gezielt | Held und Kreatur, 2 Stapel, 2. Vial → 4 Stapel, Tick 30 je Stapel ✓; Resistance blockt ✓ |
| Potion of Greed | L1 Standard | Potion Deck 5/1/0, volle Hand ✓; nur in Main 1 ✓; Beobachtung: bei leerem Potion Deck bleibt reiner Nachteil spielbar (Ruling „Tuscan Artist“ nennt nur Zieh-Sperren) |
| Premonition | L2 gezielt | Lv1–3, 0 Karten bei Lv2/3 (Zugende trotzdem), Reihenfolge-Dialog, Mehrfach-Namen ✓; unter Such-Sperre läuft es durch ✗(→ -23); Beobachtung: Server prüft die Galerie-Antwort nicht gegen die Auswahl (nur manipulierter Client) |
| Pressed Skill | L2 gezielt | Heldenkontrolle ✗(→ -20); Negierung ✓; Hand-Sperre ✓ |
| Punch in the Box | L2 gezielt | Kreaturenschaden öffnet kein Fenster ✗(→ -15); Heldenschaden: Rückschlag ceil(Schaden/2) ✓; tödlicher Schaden ohne Fenster (laut Kommentar gewollt) |
| Pusher | L2 gezielt | alle Kopien aus Hand und Deck in die Ablage ✓; gestohlene Kreatur ✓; Stealth-Gate ✓ |
| Quick Attack | L2 gezielt | Basis-ATK trotz Buffs/Cursed ✓; 1. Angriff Zusatzaktion, 2. kostet Aktion, 3. nicht spielbar ✓ (3 Helden, gleicher Held) |
| Resistance | L2 gezielt | Life Serum / Teleportation Powder gehen durch ✗(→ -11); Budget-Reset zu Zugbeginn auch im Gegnerzug ✓; Status (Poison/Stun/Blind) wird abgewehrt ✓ |
| Resuscitation Potion | L2 gezielt | Negierung ohne Stempel ✗(→ -10); Max-HP 50 gegen Life Serum/Toughness/Heilung gedeckelt ✓; zweite Kopie gesperrt ✓ |
| Ricochet | L2 gezielt | Ziele nach physischer Seite ✗(→ -22); Kette 100/50/25/13/7/4 ✓; Stealth/Zielschutz ✓ |
| Rocket Fist | L2 gezielt | Blinded-Gate fehlt ✗(→ -04); Rückkehr auf die Hand bei Tötung (Held/Kreatur) ✓, sonst Ablage ✓ |
| Shattering Strike | L2 gezielt | Kettenkill (2 Frail + Big) ✓; vom Spieler kontrollierte Kreatur nicht Ziel ✓ |
| Singing | L2 gezielt | Geister-Instanz bei 6 Surprise-Kreaturen ✗(→ -24); Batterie über 149 Kreaturen Lv ≤ 3 mit aktivem Effekt: sonst keine Fehler/Audit-Abweichung |
| Smoke Vial | L1 Standard | Dauer bis Ende des nächsten Zugs des Wirkers ✓; nutzt `heroesControlledBy` ✓; Erste-Runden-Gate fehlt (B-06 bekannt) |
| Smugness | L2 gezielt | Lv1–3 = 75/150/300 Rückschlag auf 150 Schaden ✓; nur an Aufgestiegene anhängbar ✓ |
| Stealth | L2 gezielt | gefroren/betäubt/negiert ✗(→ -05); Lv1/2/3-Schwellen ✓; Zirkelfälle (alle Helden mit Stealth, Mitstreiter tot/unwählbar) ✓ |
| Stranglehold | L2 gezielt | zählt nur 5 Status ✗(→ -01); Fighting-3-Bonus (+Basis-ATK, auch bei 0 Status) ✓ |
| Strong Ox Headbutt | L2 gezielt | 1./2./3. Angriff = 1 / 2 / 1 Karte (+ Ability beim 3.) ✓ |
| Surefire Shot | L2 gezielt | Stealth, untargetable, damage_proof, Silence in der Gegnerhand ✓ |
| Sword in a Bottle | L2 gezielt | Negierung ohne Zug-Stempel ✗(→ -10); Abbruch stempelt nicht ✓; 2. Kopie im Zug gesperrt ✓; Angreifer in jedem Status wählbar (Beobachtung) |
| Tears of Creation | L2 gezielt | gecharmter eigener Held zählt mit ✗(→ -16); Kreaturen/Charme-Gegnerheld ✓ |
| Teleportation Powder | L2 gezielt | Negierung ohne Stempel ✗(→ -10); Resistance ✗(→ -11); Rückkehr zu Beginn des nächsten Zuges mit Statuses/Equip/Abilities/Bilanz ✓; Platzieren in den entfernten Slot gesperrt ✓ |
| Terror | L2 gezielt | gefroren/betäubt ✗(→ -12); Schwelle 5/6/7 nach verschiedenen Namen ✓; Gegner-Terror zählt für beide ✓ |
| Thieving | L2 gezielt | negierter Held ✗(→ -09); 4/8/12, Deckel bei 5 Gold ✓ |
| Thieving Strike | L2 gezielt | negierter Held spielt Lv2 als Lv0 ✗(→ -03); Zufallskarte/Treffer ✓ |
| Toughness | L2 gezielt | negiert/gefroren/betäubt ✗(→ -08); Max-HP-Deckel (Resuscitation) ✓; Performance-Rücknahme ✓ |
| Trade | L2 gezielt | negierter Held ✗(→ -09); 5/10/20, Löschen statt Ablage, <5 Karten Deck gesperrt ✓ |
| Training | L2 gezielt | Lv1–3 Hand-Option (verbraucht den Heldenanhang nicht) ✓, Deck-Option ✓; Deck-Option unter Such-Sperre ✗(→ -23) |
| Transdimensional Stab | L2 gezielt | Negierung bei leerer Hand (Hand 2/ATK 120), 2 Discards bei Hand 3 ✓; Entwurf nach nominalem ATK (Skriptkommentar), nicht nach tatsächlichem Schaden gegen 10-HP-Kreatur (Beobachtung) |
| Trapping | L2 gezielt | legt Surprise trotz Such-Sperre ✗(→ -23); Stufe/Zonenwahl ✓ |
| Trunk Sand | L2 gezielt | Blinded_hit endet bei Schaden/Burn-/Poison-Tick ✓, nicht bei Heilung/Zugende ✓; Kreatur ✓; damage_proof-Ziel wird nicht geblendet (Beobachtung) |
| Wealth | L2 gezielt | Lv1–3, zwei Helden summieren, toter Held ✓ |
| Weapon Storm | L2 gezielt | kein Abbruch vor der ersten Karte ✗(→ -06); 40/50/60 nach Fighting-Stufe nach dem Senden ✓ |
| Whirlwind Strike | L2 gezielt | Blinded-Gate fehlt ✗(→ -04); 1/2 Helden, gestohlene Kreaturen in den Zonen treffen ✓; Abbruch (null / []) ✓ |
| Wisdom | L2 gezielt | Server-Tor ohne Abwurfmaterial ✗(→ -25); Abbruch der Zielwahl: kein Abwurf ✓; negierter Held: nicht spielbar ✓ |

## Getestet & in Ordnung (Auswahl)
* **Rechenwege der Attacks:** Quick Attack nutzt Basis-ATK (auch bei Buffs/Cursed), Surefire/Massacre/Stranglehold den laufenden ATK; Massacre zählt offene + verdeckte Kreaturen und Token; Ricochet-Kette 100/50/25/13/7/4 (je Seite); Strong Ox Headbutt 1/2/1 Discards und Ability-Abwurf beim 3. Angriff; Trunk Sand-Blind endet bei jedem Schaden (auch Brand/Gift-Tick), nicht bei Heilung oder Zugende.
* **Zusatzaktions-Buchhaltung:** Quick Attack / Muscle Training nur als erster Angriff (des Helden bzw. des Spielers) Zusatzaktion, danach nicht spielbar; Learning-Zweitguss und Necromancy zählen als Zusatzaktion.
* **Stealth-Zirkel:** alle Helden mit Stealth, Mitstreiter tot oder unwählbar: Engine löst auf (kein leeres Ziel-Fenster).
* **Teleportation Powder:** Rückkehr zu Beginn des eigenen nächsten Zuges inkl. Status, Equip, Ability-Stapel; Kartenbilanz ±0; Platzieren in den entfernten Heldenslot gesperrt.
* **Negierung (The Master's Plan) von 14 Tränken:** keine Kartenverluste, keine Fehler (Ausnahme Magic Lamp mit Ambush -18, Einmal-Stempel -10).
* **Premonition / Navigation / Trade / Thieving / Pillage / Wealth:** Zahlenwerte Lv1–3 stimmen mit dem Text überein.
* **Resuscitation Potion:** Max-HP 50 bleibt gegen Life Serum, Toughness und Heilung bestehen.
* **Resistance:** Budget (1/2/∞) wird zu jedem Zugbeginn zurückgesetzt, auch nach einer Wirkung im eigenen Zug.
* **Necromancy-Batterie (406 Kreaturen) und Singing-Batterie (149 Kreaturen):** keine verschluckten Fehler; einzige Auffälligkeit sind die sechs Surprise-Kreaturen (-24).
