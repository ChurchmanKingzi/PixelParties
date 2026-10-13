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

### H02-heroes-13 · Fiona (Empty Vessel): der „−3"-Rabatt gilt für jede Kopie derselben Karte, nicht nur für die geholte · Stufe B
- **Karten:** Fiona, the Empty Vessel of a Forgotten Sorceress (`fiona-the-empty-vessel-of-a-forgotten-sorceress.js`); Engine-Stelle, die auch Rocky Slime, Sparkfly Queen u. a. Kopien-Rabatte trägt
- **Voraussetzungen / Aufbau:** Fiona als Held 0 (ohne Destruction Magic), Hand [Fireball], Deck mit Fireball; Fionas Heldeneffekt holt den zweiten Fireball (Rabatt −3 auf Handindex 1).
- **Schritte:** 1. Heldeneffekt, Fireball wählen. 2. Die UNverbilligte Kopie (handIndex 0) spielen.
- **Erwartet** (Kartentext: „That Spell's level is reduced by 3 for the rest of the turn."; Skriptkopf „Die Reduktion gilt NUR fuer die eine geholte Kopie (Als Ruling 30.8.)"): die Kopie ohne Rabatt bleibt für einen Helden ohne Schule unspielbar.
- **Beobachtet:** die Kopie ohne Rabatt wird gespielt (Gegner −150); der gerabattete Fireball bleibt in der Hand zurück (Rabatt-Map `{"0":-3}` nach dem Rebase). Kontrolle ohne Fiona: nicht spielbar.
- **Repro:** `docs/niche-tests/repro/H02-heroes/13-fiona-vessel-rabatt-gilt-fuer-jede-kopie.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `validateActionPlay` (~20690) ruft `heroMeetsLevelReq(heroOwner, heroIdx, cardData)` ohne `{ handIdx }`; der Offset-Scan (~43649) nimmt „die günstigste Kopie nach NAMEN" („if any copy is summon-eligible, the gate passes"). Der Kommentar dort verspricht, der Spielweg löse die konkrete Kopie beim Splice auf – tut er für die Stufenprüfung nicht. Folge in der Praxis: Hand mit zwei gleichen Zaubern, einer gerabattet – der Spieler kann beide mit dem Rabatt wirken.

### H02-heroes-14 · Friedhelm: die Deck-Galerie bietet Reaction-Spells, Surprises und Karten mit Helden-Gate an – die Wahl verbrennt Karte und Aktion ohne Wirkung · Stufe B
- **Karten:** Friedhelm, the Misled Avenger (`friedhelm-the-misled-avenger.js`, `spielbareDeckkarten`); betroffen u. a. Anti Magic Shield, Teleport, Silence (Reaction), Frost Rune, Magic Mirror, Gold Trap (Surprise), Breaking Strike, Knife Throw, Weapon Storm, Weapon Unleashing (`canPlayWithHero`)
- **Voraussetzungen / Aufbau:** Friedhelm als Held 0 (`onGameStart` ausgeführt, damit `_maxActionsPerTurn = 1` steht), nötige Schulen vergeben, Action Phase; Deck mit der Testkarte; Galerie-Antwort = die Testkarte.
- **Schritte:** 1. Heldeneffekt aktivieren (`t.activateHero(0, 0, {effect, phase: 3})`), die Karte wählen. 2. Ablage, Deck und `hero._actionsThisTurn` prüfen. Kontrolle: dieselbe Karte aus der HAND über den echten Spielweg in der Action Phase.
- **Erwartet** (Kartentext: „use an Attack or Spell from your deck with this Hero **as if you played it from your hand**"; Skriptkopf: „Ohne [die Prüfung] bietet die Karte Zuege an, die `validateActionPlay` danach ablehnt – und die Karte waere aus dem Deck heraus und die Aktion weg"): was aus der Hand in der Action Phase nicht spielbar ist, steht nicht in der Galerie.
- **Beobachtet:** Kontrolle: aus der Hand lehnt der Server alle drei ab (Reaction: nicht proaktiv spielbar; Surprise nur in Main 1/2, `server.js` `doPlaySurprise`; `canPlayWithHero` ungültig). Friedhelm bietet sie an (Batterie über alle 452 Attacks/Spells im Deck: 343 angeboten, davon 67 Reaction-Spells, 9 Reaction-Attacks, 23 Surprises, 4 Gate-Karten ohne Hand-Pendant). **Reaction/Surprise:** die Karte geht ohne jede Wirkung in die Ablage, `_actionsThisTurn` = 1 – Karte und Aktion verloren (Zustandsvergleich vor/nach: nichts außer Ablage + Aktion). **`canPlayWithHero`-Karten:** fizzeln folgenlos (Karte bleibt im Deck, Aktion nicht verbraucht) – toter Eintrag, kein Verlust.
- **Repro:** `docs/niche-tests/repro/H02-heroes/14-friedhelm-bietet-unspielbare-karten-an.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `friedhelm-the-misled-avenger.js:50-90` `spielbareDeckkarten` filtert über `engine.getBlockedSpells` (kennt weder Reaction-Subtyp noch Surprise-Phasenregel noch `canPlayWithHero`) und `heroMeetsLevelReq`. Der Kopf des Skripts verlangt dieselben „inhärenten Sperren wie beim Handspiel" – die drei fehlen. (Nebenbefund ohne Wirkung auf Friedhelm: der Deck-Weg `_castSpellImmediately` pflegt `ps._spellsResolvedThisGame` und `hero._attacksThisTurn` nicht – `_spellsResolvedThisGame` liest Chaos Magic, `_attacksThisTurn` die Berserk-Obergrenze; für Friedhelm selbst folgenlos, da er nur 1 Aktion hat.)

### H02-heroes-15 · Ghazma: besiegte Tokens werden am Zugende als Karten ins Deck gemischt und zählen fürs Ziehen · Stufe B
- **Karten:** Ghazma, the Worm Feeder (`ghazma-the-worm-feeder.js` `onTurnEnd`); Tokens Mummy/Invader/Leprochaun/Biomancy Token
- **Voraussetzungen / Aufbau:** Sitz 0: Ghazma (Held 0); Sitz 1 am Zug mit einem Token auf dem Brett, Deck 5 Karten. Der Token wird im Schadensweg besiegt (`actionDealCreatureDamage`).
- **Schritte:** 1. Token besiegen (liegt korrekt im Gelöscht-Stapel von Sitz 1). 2. `t.endTurn()` dreimal (Zugende Sitz 1, Sitz 0, Sitz 1). 3. Deck und Hand von Sitz 1 prüfen. Kontrolle: derselbe Ablauf ohne Ghazma.
- **Erwartet** (Kartentext: „the turn player's deleted **Creatures** … are shuffled back into their owner's deck. Then, the turn player draws that many cards"; Engine-Konvention „Tokens sind keine Karten, kommen nie in Hand/Deck/Ablage" – vgl. A05-02, A05-12, R01-02, M01-05): der Token bleibt gelöscht; es wird nichts gemischt und nichts gezogen.
- **Beobachtet:** Kontrolle ohne Ghazma: Token bleibt im Gelöscht-Stapel. Mit Ghazma: der Token liegt danach als Karte im Deck von Sitz 1 (bei allen vier Token-Arten), der Gelöscht-Stapel ist leer, und Ghazma zieht dafür (2 Karten statt 1 in der Kontrolle).
- **Repro:** `docs/niche-tests/repro/H02-heroes/15-ghazma-mischt-tokens-ins-deck.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `ghazma-the-worm-feeder.js:~58` filtert den Gelöscht-Stapel mit `hasCardType(cd, 'Creature')`; der Typ „Token/Creature" (Subtyp Creature) fällt darunter. Ein Ausschluss `hasCardType(cd, 'Token')` fehlt (Vorbild: Garius' Galerie, `garius-the-great-reformer.js:122`).
- **Nebenbefund außerhalb der Gruppe (Engine, nicht mit Ghazma verknüpft):** Ein Token, der über `engine.actionDestroyCard` (Nicht-Schadensweg) stirbt, landet in der ABLAGE seines Besitzers statt im Gelöscht-Stapel (`_engine.js:13731` `_actionMoveCardKern` schiebt den „Kadaver" vor den Todes-Hooks unbedingt auf `discardPile`, ohne die Token-Umleitung von `_addCardToState` ~48530). Mit echten Karten nicht beobachtet (Trial of Dominance, Hole in the Sky, Forbidden Zone gehen den Löschweg); Kohta Master und Garius laufen über diesen Weg (s. dort).

### H02-heroes-16 · Ghuanjun: „Attacks deal damage equal to base Attack" – die Differenzkorrektur macht drei Karten schwächer und lässt fünf weitere zu stark · Stufe A
- **Karten:** Ghuanjun, the Undead Martial Artist (`ghuanjun-the-undead-martial-artist.js` `beforeDamage`/`beforeCreatureDamageBatch`); betroffen: Blow of the Venom Snake, Ferocious Tiger Kick, Strong Ox Headbutt, Critical Strike, Surefire Shot, Massacre, Shattering Strike
- **Voraussetzungen / Aufbau:** Ghuanjun als Held 0 (`onGameStart` ausgeführt); Fighting 1 über den echten Spielweg angelegt (ATK 80 → 90, wie in jedem normalen Spiel, denn Fighting ist seine Startfähigkeit); Gegner-Held 1000 HP bzw. eine 1000-HP-Kreatur; Combo-Rückfrage mit „Nein".
- **Schritte:** Jede Attack einzeln über `doPlaySpell` wirken, Schaden am Ziel messen.
- **Erwartet** (Kartentext Ghuanjun: „This Hero's Attacks deal damage equal to this Hero's **base Attack stat**."): jede Attack richtet den Schaden an, den ihre Formel mit ATK := Grund-ATK (80) ergibt – Attack/Venom Snake/Tiger Kick/Ox Headbutt/Surefire 80, Critical Strike („twice the attacker's Attack stat") 160, Massacre (ATK + 50×Kreaturen) 130, Shattering Strike auf Kreatur 80.
- **Beobachtet (ATK 90):** Blow of the Venom Snake, Ferocious Tiger Kick, Strong Ox Headbutt **70** (Kartentext dieser drei: „damage equal to the user's base Attack stat"; ihre Quelle trägt `usesHeroAtk: true`, obwohl sie `baseAtk` rechnen → Ghuanjuns Hook zieht die Differenz 10 noch einmal ab; bei einem ATK-Bonus ≥ 80 wären es 0); Critical Strike **170** (nur 1× Differenz abgezogen, die Formel vervielfacht sie); Surefire Shot **90** („damage cannot be reduced" – der Abzug läuft leer); Massacre **140** (Quelle ohne `usesHeroAtk`); Shattering Strike gegen Kreatur **90**. Nur „Attack" selbst stimmt (80). Der Kopfkommentar des Skripts behauptet: „Attacks that already use baseAtk (Strong Ox, Tiger Kick, Venom Snake) don't set the flag" – sie setzen es doch.
- **Repro:** `docs/niche-tests/repro/H02-heroes/16-ghuanjun-basis-atk-korrektur.js` (✗ = Fehler tritt auf; 7 ✗)
- **Vermutete Ursache:** Die Normalisierung ist ein flacher Abzug `modifyAmount(-(atk−baseAtk))` an Attacken mit `usesHeroAtk` (Z. 206-213, 253-257). Sauberer wäre, `hero.atk` für die Dauer des Treffers auf `baseAtk` zu setzen (oder die Attack-Formel `baseAtk` lesen zu lassen) bzw. die drei „base ATK"-Karten ohne `usesHeroAtk` zu führen (Z. `blow-of-the-venom-snake.js:~63`, `ferocious-tiger-kick.js`, `strong-ox-headbutt.js`).
- **Gegenproben (in Ordnung):** Combo (Attack + 2 verschiedene Zusatz-Attacks, gleiche Attack-Namen gesperrt, vierte abgelehnt), HP-Deckel (Ziel/Kreatur bleibt bei 1 HP, auch bei Folgeschaden im selben Zug), Immortal-Buff fällt am Zugende – auch wenn Ghuanjun danach gefroren/negiert ist.

### H02-heroes-17 · Gobbo (negiert): die Level-Freigabe bleibt, die HP-Kosten entfallen – Lv-3-Attack ohne Fighting, gratis · Stufe B
- **Karten:** Gobbo, Chief of Goblin (`gobbo-chief-of-goblin.js`, `canBypassLevelReqForCard`); Messkarte Critical Strike (Lv 3)
- **Voraussetzungen / Aufbau:** Gobbo als Held 0 (600 HP, keine Fähigkeiten), Critical Strike auf der Hand, Status `negated`; Kontrolle: derselbe Aufbau ohne Status.
- **Schritte:** Critical Strike über den echten Spielweg wirken (`noGrant`: keine Schulen vergeben).
- **Erwartet** (Konvention B-09 / `_isHeroEffectSilenced`: negierte Helden verlieren ihren Heldeneffekt; Kartentext Gobbo: „This Hero can use Attacks regardless of their levels"): negiert gilt die Freigabe nicht – wie ein beliebiger Held ohne Fighting 3 kann er die Karte nicht spielen.
- **Beobachtet:** Kontrolle ohne Status: gespielt, Gobbo zahlt 300 (HP/Max 300/300). Negiert: **gespielt** (Gegner −180), Gobbos HP/Max-HP bleiben 600/600 – die Freigabe wirkt, der Kostenhaken `afterSpellResolved` ist (durch die Negation) still. Ergebnis: eine Lv-3-Attack ohne Fighting, kostenlos.
- **Repro:** `docs/niche-tests/repro/H02-heroes/17-gobbo-negiert-spielt-weiter-gratis.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:~43819` (`heroMeetsLevelReq`, Heldenzweig) und ~40004 (Spielbarkeitsliste) rufen `heroScript.canBypassLevelReqForCard(...)` ohne `_isHeroEffectSilenced(hero)`; im Gegensatz zum Zwilling `grantsInherentActionForCard` (nur lebender Held). Betrifft jeden Helden mit diesem Vertrag (Sorin, Luna …), Gobbo ist wegen der gekoppelten Kosten der sichtbarste Fall. Gehört zur Klasse B-01…B-09 (Dauereffekt/Vertrag ohne Status-Prüfung). Frozen/Stunned: der Held kann ohnehin nicht handeln; Tod: Dead-Hero-Zweig sperrt.

### H02-heroes-18 · Crestina: Tokens stehen im „von außerhalb des Spiels"-Angebot und landen als tote Karte auf der Hand · Stufe B
- **Karten:** Fairy Queen Crestina, the Creation Fairy (`fairy-queen-crestina-the-creation-fairy.js`, Kandidatenpool über `loadCardEffect(name)`); betroffene Namen: Biomancy Token, Invader Token, Mummy Token, Pollution Token
- **Voraussetzungen / Aufbau:** Crestina als Held 0 von Sitz 0; Sitz 1 am Zug; `t.endTurn()` → Resource Phase von Sitz 0; Galerie-Antworten geskriptet (Mummy/Pollution/Biomancy Token als 3 Namen, Gegner wählt Mummy Token).
- **Erwartet** (Konvention A05-02/A05-12, CARD_API „Tokens … überall verboten": Tokens sind keine Karten): kein Token im Angebot, keine Token-Karte auf der Hand.
- **Beobachtet:** alle vier Token-Namen stehen in der Galerie; der gewählte „Mummy Token" liegt auf der Hand (Ziehen ausgefallen) und ist dort unspielbar (`doPlayCreature` → `false`) – eine tote Handkarte; die beiden anderen Namen sind „aus dem Spiel entfernt" und für Crestina gesperrt. Der Gegner kann so (absichtlich) die Wahl treffen, Crestina eine tote Karte zu geben (Karte statt Ziehen). Unspielbar bleiben auch die 170 Nicht-Ascended-Heldenkarten im Pool (Nebenbeobachtung, nicht gesondert gemeldet).
- **Repro:** `docs/niche-tests/repro/H02-heroes/18-crestina-token-im-angebot.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `fairy-queen-crestina-the-creation-fairy.js:~85-92`: Pool-Filter nur `loadCardEffect(name)`, kein `Token`-Ausschluss (Vorbild Garius' Galerie, `garius-the-great-reformer.js:122`).

### H02-heroes-19 · Shapeshifter nach dem Abfallen: Ida-Deckel, Fiedel-Rabatt und Friedhelm-Aktionsgrenze bleiben (Erweiterung von H01-02/-14) · Stufe A
- **Karten:** ???, the Shapeshifter (`the-shapeshifter.js`); verursachend: Ida (`ida-the-adept-of-destruction.js`), Fiedel (`fiedel-the-mercenary-mage.js`), Friedhelm (`friedhelm-the-misled-avenger.js`) – H01-14 nennt diese drei als „nicht gemessen"
- **Voraussetzungen / Aufbau:** Shapeshifter auf Held 0 (`onGameStart` gefeuert), Gestalt aus der Hand per echtem Heldeneffekt, `t.endTurn()` ×2 (Gestalt fällt am Ende des Gegnerzuges ab; Held heißt wieder Shapeshifter). Kontrolle: nie verwandelter Shapeshifter.
- **Schritte / Erwartet** (Kartentext Shapeshifter, Skript-Ruling ② „nach dem Abfallen gilt wieder nur der eigene Effekt"): (a) Ida: Explosion trifft alle 3 Gegnerhelden; (b) Fiedel: Reaction Spectral Armor (Lv 1) ohne Schule nicht spielbar; (c) Friedhelm: mit einer Zusatzaktion (`ps.bonusActions`) darf der Held ein zweites Mal handeln.
- **Beobachtet:** (a) 1 Treffer statt 3 (`gs.heroFlags['0-0'] = {forcesSingleTarget: true}` bleibt); (b) Spectral Armor wird gespielt (150 → 75; `hero.levelOverrideCards` mit allen Reaction-Zaubern −1 bleibt); (c) zweite Aktion abgelehnt (`hero._maxActionsPerTurn = 1` bleibt). Alle Kontrollen grün. Weitere Reste dieser Klasse bei meinen Helden **nicht** gefunden: ein Zustands-Diff des Heldenobjekts, der `gs.heroFlags` und der Spielerflags vor/nach (alle 37 Gestalten) zeigt außer diesen drei nur harmlose Marken (`ghuanjunAttacksUsed`, `_ghazmaZugende`, `_lastTurnEndTick` bei Heragas) und die Karian-Immunitäten (= H01-14). (Hel: ein in Hel verwandelter Shapeshifter wird am Zugende besiegt, weil er „sein" Artefakt nicht hat – laut Text zulässig, kein Befund.)
- **Repro:** `docs/niche-tests/repro/H02-heroes/19-shapeshifter-reste-ida-fiedel-friedhelm.js` (✗ = Fehler tritt auf; 3 ✗)
- **Vermutete Ursache:** wie H01-14: `initGainedHeroEffect` führt die Anfangsroutine der Gestalt aus, `loseHeroEffect` → `onIdentityLost` fehlt bei Ida (`heroFlags` geschlüsselt nach Seite/Slot), Fiedel (`levelOverrideCards` am Heldenobjekt) und Friedhelm (`_maxActionsPerTurn`).

### H02-heroes-20 · Heragas (negiert) zieht weiter 1 Karte je besiegter Kreatur · Stufe B
- **Karten:** Heragas, the Monster Slayer (`heragas-the-monster-slayer.js`, `bypassStatusFilter: true`)
- **Voraussetzungen / Aufbau:** Heragas als Held 0 (Status `negated`), Hand [Attack], eine 10-HP-Kreatur auf Sitz 1; Kontrolle ohne Status.
- **Schritte:** 1. „Attack" (Lv 0, ohne Fähigkeiten spielbar) auf die Kreatur. 2. Deck-Länge vor/nach.
- **Erwartet** (Kartentext „Whenever this Hero defeats a Creature, draw 1 card."; Konvention B-09: negierte Helden verlieren ihren Heldeneffekt, der Heldeneffekt-Knopf ist unter Negation korrekt gesperrt): negiert keine Karte ziehen.
- **Beobachtet:** Kreatur besiegt, Deck 20 → 19 (Hand: gespielte Karte ersetzt). Kontrolle ohne Status zieht ebenfalls 1 (richtig). Unter Frost/Betäubung kann Heragas nicht angreifen, dort ohne Folge.
- **Repro:** `docs/niche-tests/repro/H02-heroes/20-heragas-negiert-zieht-weiter.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `heragas-the-monster-slayer.js:70` `bypassStatusFilter: true` hebt den zentralen Statusfilter für ALLE Hooks des Skripts auf (gedacht für `onTurnEnd`→`stampTurnEnd`, damit die Zeitmarke auch unter Status läuft); die Reaktion `onCreatureDeath` prüft `_isHeroEffectSilenced` nicht selbst.

### H02-heroes-21 · Lethe: die Aktionssperre hält Necromancy („as an additional Action") nicht auf · Stufe B
- **Karten:** Lethe, the Forgetful Fixer (`lethe-the-forgetful-fixer.js` `lockLethe`/`_actionLockedTurn`), Necromancy (`necromancy.js`); Engine-Weg `doActivateFreeAbility` (`server.js:9501`)
- **Voraussetzungen / Aufbau:** Lethe auf Held 0 mit Necromancy ×3 (Held 0, Zone 0), Hand [Fireball], Ablage mit 2 Dummys; eigene Kreatur auf Held 1 stirbt im Gegnerzug (`t.endTurn()`, Schaden, `t.endTurn()`).
- **Schritte:** 1. In Lethes Zug Fireball (Aktion) versuchen. 2. Necromancy per `doActivateFreeAbility` aktivieren (Galerie: erste Karte, Zone: erste freie).
- **Erwartet** (Kartentext Lethe: „This Hero cannot perform Actions if a target you control was defeated since the end of your last turn."; Necromancy: „summon it with this Hero as an additional Action"; Skriptkopf Lethe: die Sperre „covers … AND the alt-summon below, which is itself an Action"): Lethe kann weder zaubern noch per Necromancy beschwören.
- **Beobachtet:** Fireball ist gesperrt ✓, die Necromancy-Beschwörung läuft aber durch (Dummy auf dem Brett). Kontrolle ohne Tod: beschwört (richtig). Der Tracker selbst ist sauber gemessen: Tod im Gegnerzug / im eigenen Zug / eines anderen eigenen Helden / einer gestohlenen Kreatur / eines Tokens sperrt, ein Tod vor zwei Runden nicht (bestanden).
- **Repro:** `docs/niche-tests/repro/H02-heroes/21-lethe-gesperrt-necromancy-laeuft.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `doActivateFreeAbility` (`server.js:9501-9570`) prüft `hero._actionLockedTurn` und `areActionsBlocked` nicht (nur Stunned/Webbed/Frozen, Thing in the Ship, Boris, HOPT); `necromancy.js` `canFreeActivate` auch nicht. Dieselbe Lücke gilt damit für jede andere Aktionssperre (Treasure Hunter's Backpack, Chalice, Kent) bei Necromancy – nicht gesondert gemessen.
- **Nebenbefund (in Ordnung):** Lethes Stempel-Welle: 5 Lv-1-Dummys in der Ablage, Necromancy 3× → Stempel 1/2/3, vierte Nutzung abgelehnt; die beschworenen Kreaturen tragen `_letheLevelBonus` (1 und 2).

### H02-heroes-22 · Kazena: unter Ziehsperre oder bei leerem Deck wird der Effekt angeboten und der Einsatz ohne Wirkung verbraucht · Stufe C
- **Karten:** Kazena, the Storming Rebel (`kazena-the-storming-rebel.js` `canActivateHeroEffect`/`onHeroEffect`)
- **Voraussetzungen / Aufbau:** Kazena auf Held 0, Hand 2 Karten; (a) `ps.drawLocked = true` (Sacred Jewel); (b) Deck 0.
- **Erwartet** (Kartentext „draw until you have 7 cards … If you do, you cannot draw …"; das Skript sperrt die Aktivierung bei `handLocked`/≥ 7 Handkarten): bei unmöglichem Ziehen nicht aktivierbar bzw. Einsatz nicht verbraucht.
- **Beobachtet:** Rückfrage „Draw 5 cards (to 7)?" erscheint, nach „Ja" werden 0 Karten gezogen (Hand 2), die Sperre „kein Ziehen" greift korrekt nicht (kein Zug von Karten), der Heldeneffekt ist für den Zug verbraucht (`hero-effect:Kazena…`). Normalfall ✓ (Hand → 7, Sperre, zweite Nutzung abgelehnt, Sperre fällt am Zugwechsel; Deck 3 → zieht 3).
- **Repro:** `docs/niche-tests/repro/H02-heroes/22-kazena-ziehsperre-verbrennt-einsatz.js` (✗ = Einsatz verbraucht)
- **Vermutete Ursache:** `kazena-the-storming-rebel.js` `canActivateHeroEffect` prüft `handLocked` und `hand < 7`, aber weder `drawLocked` noch `mainDeck.length > 0`; `onHeroEffect` gibt nach dem Ziehen von 0 Karten trotzdem `true` zurück (verbraucht den Einsatz).
- **Frage an Al:** Soll Kazena unter Ziehsperre/leerem Deck gar nicht aktivierbar sein (Einsatz bleibt) – ja oder nein? (Der Spieler kann den Verbrauch selbst vermeiden, indem er die Rückfrage verneint.)

### H02-heroes-23 · Junshi (gefroren/betäubt): die Stufensenkung der Magic-Arts-Zauber gilt weiter · Stufe B
- **Karten:** Junshi, the Tactical Genius (`junshi-the-tactical-genius.js` `reduceCardLevel`/`heldWirkt`); Messkarte Detection (Magic Arts Lv 1)
- **Voraussetzungen / Aufbau:** Junshi auf Held 0 mit 1 eigener Kreatur; Held 1 ohne Schulen; Detection auf der Hand, gegnerische Surprise auf dem Brett (sonst ist Detection unspielbar); Status gefroren / betäubt / negiert auf Junshi.
- **Schritte:** Detection mit Held 1 über den echten Spielweg wirken.
- **Erwartet** (Kartentext „Magic Arts Spells in your hand have their levels reduced by the number of Creatures you control."; Konvention `_isHeroEffectSilenced`, `_engine.js:6446`: gefroren/betäubt/negiert/tot ⇒ Heldeneffekt aus; Kontrolle ohne Junshi: unspielbar): Detection ist nur mit gesunder Junshi spielbar.
- **Beobachtet:** ohne Status spielbar ✓; **gefroren ✗ und betäubt ✗: spielbar** (Lv 1 → 0); negiert und tot: gesperrt ✓. Weiter ✓: gegnerische Kreaturen zählen nicht, eine gestohlene eigene Kontrollkreatur zählt.
- **Repro:** `docs/niche-tests/repro/H02-heroes/23-junshi-gefroren-senkt-weiter.js` (✗ = Fehler tritt auf; 2 ✗)
- **Vermutete Ursache:** `junshi-the-tactical-genius.js` `heldWirkt` prüft nur `hero.statuses.negated` (Kommentar behauptet „jede Form der Negation"); die Engine liest `reduceCardLevel` ohne Status-Filter (wie B-01…B-03, nur für Helden). Gleiche Klasse bei jedem Helden-Stufensenker – dieselbe Prüfung für Layn/Fiedel sinngemäß ausgeführt (s. Abdeckung).
- **Frage an Al:** (Konvention) Soll ein gefrorener/betäubter Held seine Handkarten-Stufensenkung verlieren – ja oder nein?

### H02-heroes-24 · Krates (dauerhaft übernommen): die Such-Umleitung hängt an der Spalte, nicht am Kontrolleur · Stufe B
- **Karten:** Krates, the Smartass (`krates-the-smartass.js`, Vertrag `interceptsOppDeckSearch`); Engine `_checkOppDeckSearchInterceptors`; Messkarte Brilliant Idea. Gehört zur Klasse H01-03/-04/-15/-16 („Spalte statt Kontrolleur").
- **Voraussetzungen / Aufbau:** Krates als Held 0 von Sitz 0; Sitz 1 übernimmt ihn per `actionTakeHeroPermanently(1, 0, 0)`; beide Decks 5 Zauber + 5 Dummys; Antworten geskriptet.
- **Schritte:** (b) Sitz 1 (Kontrolleur) wirkt Brilliant Idea; (c) Sitz 0 (Alt-Besitzer) wirkt Brilliant Idea.
- **Erwartet** (Kartentext „Whenever an effect would allow **your opponent** to search their deck …"; Regel „Übernommene Helden gelten als Helden des Kontrolleurs", CARD_API.md Z. 6046): (b) die eigene Suche des Kontrolleurs wird nicht umgeleitet; (c) die Suche des Alt-Besitzers wird von Sitz 1 (Krates-Spieler) umgeleitet (3 Karten aufdecken, Sitz 1 wählt).
- **Beobachtet:** genau umgekehrt – (b) Sitz 1 muss 3 Karten aufdecken, und SITZ 0 (der Alt-Besitzer, der Krates nicht mehr kontrolliert) wählt, welche Karte er selbst bekommt (hand0 [Fireball], hand1 [Burning Finger]); (c) die Suche von Sitz 0 läuft ungestört durch. Kontrolle (Krates beim Gegner, nicht übernommen): Umleitung ✓.
- **Repro:** `docs/niche-tests/repro/H02-heroes/24-krates-uebernommen-spalte-statt-kontrolleur.js` (✗ = Fehler tritt auf; 2 ✗)
- **Vermutete Ursache:** `_engine.js:25102-25116` `_checkOppDeckSearchInterceptors`: `holder = opponentOf(searcher)` und `gs.players[holder].heroes` – die Spalte, nicht `heroesControlledBy`; `krates-the-smartass.js` übergibt `holder` als „Krates-Spieler" (`k`), obwohl der Kontrolleur ein anderer sein kann.

### H02-heroes-25 · Layn, Master of Deri's Relic: „Heroes you control" – die Zonenliste folgt der Spalte, nicht der Kontrolle · Stufe B
- **Karten:** Layn, Master of Deri's Relic (`layn-master-of-deri-s-relic.js` `collectFreeZones`/`canActivateHeroEffect`); Klasse H01-03/-04/-15/-16
- **Voraussetzungen / Aufbau:** Layn Master als Held 0 von Sitz 0; Ablage 3× Treasure Skeleton (Lv 1); (b) Sitz 1 übernimmt Held 2 von Sitz 0 dauerhaft; (c) Sitz 0 übernimmt Held 1 von Sitz 1 dauerhaft (`actionTakeHeroPermanently`).
- **Schritte:** Heldeneffekt aktivieren, Skeleton wählen, die angebotenen Zonen mitschneiden.
- **Erwartet** (Kartentext „place them into the free Support Zones of Heroes **you control**"; Regel „Übernommene Helden gelten als Helden des Kontrolleurs", CARD_API.md Z. 6046): (b) Held 2 (an Sitz 1 verloren) wird nicht angeboten; (c) die 3 Zonen des übernommenen Gegnerhelden werden zusätzlich angeboten.
- **Beobachtet:** in beiden Fällen dieselben 9 Zonen der eigenen Spalte – (b) die Zonen von Held 2 stehen zur Wahl (bei Wahl landen die Skeletons bei einem Gegnerhelden), (c) der übernommene Gegnerheld fehlt.
- **Repro:** `docs/niche-tests/repro/H02-heroes/25-layn-master-uebernommene-helden-zonen.js` (✗ = Fehler tritt auf; 2 ✗)
- **Vermutete Ursache:** `collectFreeZones(ps)` und `canActivateHeroEffect` laufen über `ps.heroes`/`ps.supportZones` (Spalte); vorgesehen wäre `engine.heroesControlledBy(pi)` mit Brettseite (vgl. Jenny -09).

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
