# H02-heroes – Nischenfall-Bericht
Stand/Autor: Agent H02-heroes, 12.10.2026. Karten: 37 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird fortlaufend ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – Arbeitsstand: Bericht wächst mit jedem bestätigten Befund)

## Befunde

### H02-heroes-01 · Jean: Mill im Lösch-Modus löst den Bonus-Mill aus · Stufe B
- **Karten:** Jean, the Pillaging Knight (`cards/effects/jean-the-pillaging-knight.js`); Auslöser z. B. Golem Smash, Dante, Wheels, Acid Rain (alle `actionMillCards(…, {deleteMode: true})`)
- **Voraussetzungen / Aufbau:** Sitz 0: Jean als Held 0; Sitz 1 am Zug mit Golem Smash auf der Hand, Deck mit 10 Karten, Aktionsphase.
- **Schritte:** 1. Sitz 1 spielt Golem Smash (echter Spielweg) und löscht 1 Karte von seinem Deck. 2. Ablage und Deck des Gegners prüfen.
- **Erwartet** (Kartentext: „Whenever 1 or more cards are sent from your opponent's deck to the discard pile …"): gelöschte Karten gehen in den Gelöscht-Stapel, nicht in die Ablage – Jean löst nicht aus (Ablage enthält nur Golem Smash selbst, Deck −1).
- **Beobachtung:** Deck −3, zwei zusätzliche Deckkarten liegen in der Ablage (Jean hat gemillt).
- **Repro:** `docs/niche-tests/repro/H02-heroes/01-jean-loesch-mill-loest-aus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `jean-the-pillaging-knight.js` onMill prüft `ctx.deleteMode` nicht; `_engine.js:14400` feuert `onMill` auch im Lösch-Modus (Payload trägt `deleteMode`). Auch ein Mill, bei dem 0 Karten tatsächlich in die Ablage kamen (alles in den Gelöscht-Stapel umgeleitet), löst aus.

### H02-heroes-02 · Jean: „your opponent must choose 2 additional cards" – das Skript mill't die obersten 2 · Stufe B
- **Karten:** Jean, the Pillaging Knight
- **Voraussetzungen / Aufbau:** Jean auf Sitz 0; Gegnerdeck mit 10 unterscheidbaren Karten.
- **Schritte:** 1. `actionMillCards(1, 1)` auf das Gegnerdeck. 2. Prompts und Ablage prüfen.
- **Erwartet** (Kartentext: „your opponent must **choose** 2 additional cards from their deck and send them to the discard pile"): der Gegner bekommt eine Auswahl und bestimmt die 2 Karten selbst.
- **Beobachtung:** kein Prompt; die obersten 2 Karten wandern automatisch in die Ablage. (Kopfkommentar des Skripts nennt noch die ältere Fassung „must also send 2 additional cards".)
- **Repro:** `docs/niche-tests/repro/H02-heroes/02-jean-gegner-waehlt-nicht.js`
- **Vermutete Ursache:** `jean-the-pillaging-knight.js:65` `actionMillCards(oppIdx, BONUS_MILL, …)` statt Auswahl-Prompt.

### H02-heroes-03 · Gon: Freeze-Verlängerung hängt am aktiven Spieler statt am eigenen Effekt · Stufe A
- **Karten:** Gon, the Frostbringer (`cards/effects/gon-the-frostbringer.js`); Auslöser Frost Rune (Surprise), allgemein jeder Freeze auf der „falschen" Zugseite
- **Voraussetzungen / Aufbau:** Sitz 0: Gon als Held 0; (a) Sitz 1: Frost Rune in der Surprise Zone von Held 0 (Decay Magic 3 vergeben), Sitz 0 am Zug, Fireball von Held 1 auf Sitz-1-Held 0; (b) umgekehrt: Frost Rune bei Sitz 0, Sitz 1 am Zug und greift an.
- **Schritte:** 1. Fireball wird gewirkt, Frost Rune löst aus und friert den Angreifer 2 Züge. 2. Dauer des Frozen-Status am Angreifer prüfen.
- **Erwartet** (Kartentext: „All **your** effects that Freeze one or more targets Freeze them for an additional turn."): (a) Frost Rune des Gegners → Dauer 2 (kein Gon-Bonus, Fremdeffekt); (b) Frost Rune des Gon-Besitzers → Dauer 3.
- **Beobachtet:** (a) Dauer **3** – Gon verlängert den Freeze, den der GEGNER auf Gon-Besitzers eigenen Helden legt (Nachteil für den Besitzer); (b) Dauer **2** – der eigene Effekt bekommt den Bonus nicht.
- **Repro:** `docs/niche-tests/repro/H02-heroes/03-gon-aktiver-spieler-statt-eigener-effekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `gon-the-frostbringer.js:49` prüft `gs.activePlayer !== ctx.cardOwner` als Ersatz für „your effects". Der Kommentar nimmt an, Surprises feuerten „while their owner is the active player" – stimmt nicht (Surprises und Reaktionen feuern im Zug des Gegners). Der Auslöser steht in `ctx.opts.appliedBy` bzw. `opts.sourceOwner` (Hero-Status: `_engine.js:44954`, Kreatur: `applyCreatureStatus`).
- **Nebenbefund (in Ordnung):** Normalfall (Icy Grave, Gon-Besitzer am Zug) → Dauer 3, über echte `endTurn()` 3 Gegnerzüge gefroren (ohne Gon 2); Zweit-Freeze auf einen schon gefrorenen Helden verlängert nicht.

### H02-heroes-04 · Ida: Hole in the Sky (nur Creatures) wird unter Ida zum Heldentreffer · Stufe A
- **Karten:** Ida, the Adept of Destruction (`cards/effects/ida-the-adept-of-destruction.js`), Hole in the Sky (`cards/effects/hole-in-the-sky.js`); Ursache in der Engine (`actionAoeHit`)
- **Voraussetzungen / Aufbau:** Ida als Held 0 (Sitz 0, `onGameStart` ausgeführt), Hole in the Sky auf der Hand, je eine Dummy-Kreatur auf beiden Seiten, Aktionsphase.
- **Schritte:** 1. Hole in the Sky wirken. 2. Angebotene Ziele ansehen, einen gegnerischen Helden wählen.
- **Erwartet** (Kartentext: „All Creatures both players control take 999 damage." + Ida: „can never hit more than 1 target with a Destruction Spell"): Einzelziel-Wahl nur unter den Creatures; Helden sind nie Ziel.
- **Beobachtet:** die Einzelziel-Wahl bietet alle 6 Helden und 2 Kreaturen an; der gewählte gegnerische Held nimmt 999 Schaden (800 → 0, besiegt).
- **Repro:** `docs/niche-tests/repro/H02-heroes/04-ida-hole-in-the-sky-trifft-helden.js`
- **Vermutete Ursache:** `_engine.js` (`actionAoeHit`, ~Z. 45664): `types: types.includes('creature') ? ['hero', 'creature'] : ['hero']` – ein Zauber mit `types: ['creature']` bekommt unter Idas Einzelziel-Modus zusätzlich Helden. (Gilt für jeden reinen Creature-Flächenzauber der Art Destruction.)

### H02-heroes-05 · Ida: fünf Destruction-Flächenzauber umgehen den Einzelziel-Deckel · Stufe A
- **Karten:** Ida, the Adept of Destruction; Pyroblast, Dance of the Flame Pillars, Laser Volley, Cataclysm, Armageddon
- **Voraussetzungen / Aufbau:** Ida (Sitz 0, `onGameStart` ausgeführt) wirkt je einen Zauber; Gegner mit 3 Helden und 2 großen Kreaturen; Ablage mit 4 verschiedenen Destruction-Zaubern (für Dance).
- **Schritte:** 1. Zauber über den echten Spielweg wirken, Zielwahl wählt so viele Ziele wie angeboten. 2. Verwundete Ziele zählen.
- **Erwartet** (Kartentext: „This Hero can never hit more than 1 target with a Destruction Spell"; Ruling CARD_API.md Z. 11832 „Ida macht aus einem Flächenzauber einen Einzelzauber"): höchstens 1 Treffer je Zauber.
- **Beobachtet:** Fireball, Explosion, Boiling Oil, Chain Lightning, Flame Avalanche, Rain of Arrows sind gedeckelt (1 Treffer). **Nicht gedeckelt:** Pyroblast (5 Ziele), Dance of the Flame Pillars (4), Laser Volley (5), Cataclysm (8, auch eigene Helden), Armageddon (8).
- **Repro:** `docs/niche-tests/repro/H02-heroes/05-ida-flaechenzauber-ohne-deckel.js`
- **Vermutete Ursache:** Der Deckel in `_engine.js` (~5786) greift nur bei `config.damageType === 'destruction_spell'`; Pyroblast (`pyroblast.js:51`) und Dance (`dance-of-the-flame-pillars.js:136`) rufen `promptMultiTarget` ohne `damageType`. Laser Volley/Cataclysm/Armageddon haben einen eigenen Schadensweg ohne Idas Flagge. (Dance verlangt `min: N` – Deckel müsste `min` mitsenken.)
- **Offen (Stufe C, nicht Teil der Repro):** Sun Beam („choose up to 3 cards … send them to the discard pile") und Trial of Dominance („defeat all Creatures your opponent controls") sind Destruction-Zauber, die ohne Schaden mehrere Ziele „treffen" – gilt Idas Deckel dort? Beide treffen unter Ida weiter 3 bzw. 4 Kreaturen.

### H02-heroes-06 · Ida: nach Tod und Wiederbelebung im selben Zug fehlt der Einzelziel-Deckel · Stufe B
- **Karten:** Ida, the Adept of Destruction
- **Voraussetzungen / Aufbau:** Ida (`onGameStart` ausgeführt), Fireball auf der Hand; Ida wird besiegt und mit `actionReviveHero(0, 0, 300)` wiederbelebt (wie Golden Ankh/Styx), danach im selben Zug Fireball.
- **Erwartet** (Kartentext „can never hit more than 1 target"): Fireball trifft 1 Ziel.
- **Beobachtet:** `gs.heroFlags` bleibt leer, Fireball trifft 2 Ziele (bis zum nächsten Zugbeginn).
- **Repro:** `docs/niche-tests/repro/H02-heroes/06-ida-nach-wiederbelebung-ohne-deckel.js`
- **Vermutete Ursache:** `ida-the-adept-of-destruction.js` löscht die Flagge in `onHeroKO` und setzt sie nur in `onGameStart`/`onPlay`/`onTurnStart` wieder (Kommentar Z. 46-49 behauptet, das reiche „for revives") – ein `onHeroRevive`-Hook fehlt.

### H02-heroes-07 · Ida: Durchschlag ignoriert „unaffected" nicht bei Cardinal Beasts · Stufe C
- **Karten:** Ida, the Adept of Destruction; Cardinal Beast Baihu (Qinglong/Xuanwu/Zhuque gleich), Golden Wings (setzt `_cardinalImmune`)
- **Aufbau / Schritte:** Ida wirkt Burning Finger bzw. Rockfall auf Baihu des Gegners (mit und ohne Ida identisch).
- **Beobachtet:** kein Schaden (unabhängig von Ida). Ida's Text: „The damage this Hero's Destruction Spells deal to your opponent's targets … ignore any effects that make a target unaffected by them." Cardinal Beasts: „This Creature is unaffected by all cards and effects." Der Engine-Kommentar nennt die Cardinal-Immunität „source-blind by design" (`_engine.js` ~17877).
- **Frage an Al:** Soll Idas Zauberschaden Cardinal Beasts (absolute Immunität) trotzdem treffen – ja oder nein?
- **Repro:** `docs/niche-tests/repro/H02-heroes/07-ida-cardinal-beast-unaffected.js` (zeigt: Schaden 0)

### H02-heroes-08 · Grisgar: Zweitwurf von Goldify zahlt die Pollution-Token-Kosten ein zweites Mal · Stufe B
- **Karten:** Grisgar, Emissary of the Demon Lord (`grisgar-emissary-of-the-demon-lord.js`), Goldify (`goldify.js`)
- **Voraussetzungen / Aufbau:** Grisgar auf Held 0 mit Decay Magic 3; Goldify auf der Hand; zwei gegnerische Kreaturen; Grisgars „zweites Ziel?" wird bejaht; Aktionsphase.
- **Schritte:** 1. Goldify wirken, ersten Gegner wählen. 2. Grisgar fragt nach einem zweiten Ziel – ja, zweite Kreatur wählen. 3. Pollution Tokens auf dem eigenen Brett zählen.
- **Erwartet** (Goldify: „Place 1 Pollution Token … **to use this Spell**" = Kosten; Grisgar-Kopfkommentar „Re-cast skips costs but re-runs onPlay"): 1 Token, beide Kreaturen besiegt.
- **Beobachtet:** beide Kreaturen besiegt, aber **2** Pollution Tokens (der Zweitwurf läuft den ganzen `onPlay` erneut, und Goldify setzt das Token dort nach der Zielwahl). Cold Coffin (Kosten vor dem Wurf) setzt auch im Zweitwurf nur 2 Tokens.
- **Repro:** `docs/niche-tests/repro/H02-heroes/08-grisgar-goldify-kosten-doppelt.js`
- **Vermutete Ursache:** `goldify.js` `placePollutionTokens(engine, pi, 1, …)` mitten im `onPlay`. Kosten im `onPlay` werden vom Zweitwurf erneut gezahlt; andere Decay-Magic-Zauber mit Kosten im `onPlay` wären gleich betroffen (Batterie über die 41 normalen Decay-Zauber < Stufe 3: bei den ~12, die Grisgars Zweitwurf auslösten, fiel nur Goldify auf; unspielbare ohne passenden Aufbau blieben ungeprüft).

### H02-heroes-09 · Jenny: Abilities eines dauerhaft übernommenen Gegnerhelden nicht wählbar · Stufe B
- **Karten:** Jenny, the Class Fairy (`jenny-the-class-fairy.js`); Übernahme per `actionTakeHeroPermanently` (Paraseed Control & Co.)
- **Voraussetzungen / Aufbau:** Sitz 0: Jenny; Sitz 1 Held 0 mit „Fighting ×2"; Sitz 0 übernimmt (1,0) dauerhaft.
- **Erwartet** (Kartentext: „Abilities from Heroes you **permanently control**"; Ruling CARD_API.md Z. 6046: ein dauerhaft gestohlener Held zählt wie ein von Anfang an beherrschter): Jenny kann die zwei Fighting-Karten zurückholen.
- **Beobachtet:** `activateHero` liefert `false` (kein Ziel); die Hand bleibt leer.
- **Repro:** `docs/niche-tests/repro/H02-heroes/09-jenny-dauerhaft-uebernommener-held.js`
- **Vermutete Ursache:** `permanentlyControlledHeroIndices` (Z. 55-63) und `recallAbilityCopy` arbeiten nur auf `players[pi].heroes`/`abilityZones` der EIGENEN Spalte; der übernommene Held liegt in der Gegnerspalte (`engine.heroesControlledBy(pi, { permanentOnly: true })` wäre die vorgesehene Quelle).  Der Ausschluss `charmedBy != null` ist für den eigenen, vom Gegner übernommenen Helden richtig.

### H02-heroes-10 · Jenny: die Sperre ist breiter als „from your deck" · Stufe B
- **Karten:** Jenny, the Class Fairy
- **Voraussetzungen / Aufbau:** Jenny, eine Fighting-Karte auf Held 1, Ablage mit Fireball.
- **Erwartet** (Kartentext: „You cannot draw or add cards **from your deck** to your hand for the rest of the turn afterwards"): Ziehen und Deck→Hand gesperrt; Ablage→Hand möglich.
- **Beobachtet:** Ziehen ✓ gesperrt, Deck→Hand ✓ gesperrt, **Ablage→Hand ebenfalls gesperrt** (`addCardFromDiscardToHand` liefert null). Kreatur→Hand per `actionMoveCard` bleibt offen.
- **Repro:** `docs/niche-tests/repro/H02-heroes/10-jenny-sperre-breiter-als-text.js`
- **Vermutete Ursache:** `jenny-the-class-fairy.js` setzt `ps.handLocked = true` (die volle Sperre, wörtlich Kazena: „draw or add cards to your hand"). Mit `drawLocked` + `searchLocked` (nur Deck, `_engine.js` ~10627) träfe die Sperre genau den Text.

### H02-heroes-11 · Karian: gefroren/betäubt im Gegnerzug – Reaktions-Spell nicht spielbar · Stufe C
- **Karten:** Grand Inquisitor Karian (`grand-inquisitor-karian.js`); Spectral Armor (Reaction, Support Magic) als Messkarte
- **Voraussetzungen / Aufbau:** Karian (Support Magic 2 + Magic Arts 2) auf Sitz 0, `onGameStart` ausgeführt, Spectral Armor auf der Hand; Sitz 1 am Zug wirkt Fireball auf Karian; Variante: Karian mit Status frozen bzw. stunned (Dauer 2).
- **Beobachtet:** ohne Status wird Spectral Armor gespielt (150 → 75 Schaden); gefroren und betäubt: keine Reaktion, Karian nimmt 150 (gleiches Verhalten wie ein beliebiger gefrorener Held). Das Skript hebt die Starre nur in den eigenen Handlungsphasen (MAIN1/ACTION/MAIN2) auf (`onPhaseStart`, `grand-inquisitor-karian.js:194`).
- **Kartentext:** „While this Hero is Stunned or Frozen, you may perform a second Action with it during your Action Phase and it is **otherwise not affected** by those effects."
- **Frage an Al:** Soll eine gefrorene/betäubte Karian auch im Gegnerzug (und in Start-/Resource-/End-Phase) Reaktionen und Fähigkeiten nutzen können („otherwise not affected") – ja oder nein?
- **Repro:** `docs/niche-tests/repro/H02-heroes/11-karian-gefroren-keine-reaktion-im-gegnerzug.js` (✗ = Reaktion gesperrt)

### H02-heroes-12 · Karian: „Soul Transmitted" (negativer Status) wirkt trotz „Other negative status effects don't affect this Hero" · Stufe C
- **Karten:** Grand Inquisitor Karian; Soul Transmigration Ritual (`soul-transmigration-ritual.js`, setzt `soul_transmitted` direkt; `_hooks.js:398` – `negative: true`, ohne `immuneKey`)
- **Aufbau / Schritte:** Karian besiegt, Ritual (3 Stufe-0-Kreaturen geopfert) belebt sie wieder (800 HP, Status haftet); beim zweiten Besiegen wird sie samt Ability gelöscht.
- **Kartentext:** „Other negative status effects don't affect this Hero." – Soul Transmitted hat die Wirkung „beim nächsten Besiegen löschen" und ist als negativ geführt.
- **Frage an Al:** Soll Karians Immunität auch den Lösch-Ersatz von Soul Transmitted aufheben (sie bleibt dann beim zweiten Tod unversehrt) – ja oder nein?
- **Repro:** `docs/niche-tests/repro/H02-heroes/12-karian-soul-transmitted.js` (✗ = Karian wird gelöscht)

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
