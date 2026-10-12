# A04-cute – Nischenfall-Bericht
Stand/Autor: Agent A04-cute, 12.10.2026. Karten: 62 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird fortlaufend ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – Arbeitsstand: Bericht wächst mit jedem bestätigten Befund)

## Befunde

### A04-cute-01 · Wowhalla seedet beim Ausspielen ZWEI Karten auf den Coolness Stack · Stufe A
- **Karten:** Wowhalla, the Hall of the Cool (`cards/effects/wowhalla-the-hall-of-the-cool.js`)
- **Voraussetzungen / Aufbau:** Standard-Helden, Wowhalla auf der Hand, Deck mit ≥ 4 Karten, Aktionsphase, Seeds 1/7/99 (identisch).
- **Schritte:** 1. Wowhalla über den echten Spielweg (`doPlaySpell`) ausspielen. 2. Stack und Deckgröße prüfen. 3. Zug beenden.
- **Erwartet** (Kartentext: „When this card comes into play, place the top card of your deck face-up in front of you. It becomes your Coolness Stack. At the end of each of your turns, place the top card of your deck … onto your Coolness Stack."): nach dem Ausspielen genau 1 Karte im Stack, nach dem ersten Zugende 2.
- **Beobachtet:** nach dem Ausspielen liegen 2 Karten im Stack (Deck −2), nach dem ersten Zugende 3. Log: zwei `coolness_stack_push` mit Quelle Wowhalla.
- **Repro:** `docs/niche-tests/repro/A04-cute/01-wowhalla-doppelsaat.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `wowhalla-the-hall-of-the-cool.js:46-53` – `onPlay` ruft zuerst `engine.placeArea(...)`; `placeArea` feuert `onCardEnterZone`, und Wowhallas eigener Hook (Z. 89-94, gedacht für Puzzle-/Nicht-Hand-Platzierung) sieht noch keinen Stack und seedet; danach seedet `onPlay` (Z. 53) ein zweites Mal. Der Kommentar „Doppelbefüllung ist ausgeschlossen: onPlay legt den Stack an, bevor dieser Hook läuft" stimmt nicht – die Reihenfolge ist umgekehrt.

### A04-cute-02 · Verlässt eine ANDERE eigene Area das Brett, wird der ganze Coolness Stack gelöscht · Stufe A
- **Karten:** Wowhalla, the Hall of the Cool; Spatial Crevice (Auslöser des Mehr-Area-Falls); jede andere Area
- **Voraussetzungen / Aufbau:** Sitz 0: Wowhalla + Spatial Crevice (Limit 3) + Slippery Ice in der Area-Zone, Coolness Stack mit 3 Karten.
- **Schritte:** 1. Slippery Ice per `engine.removeArea` entfernen (so wie The Yeeting / Hammer Skeleton / Coolness Overcharge es tun).
- **Erwartet** (Kartentext: „If this card is removed from the board, delete all cards in your Coolness Stack."): Stack bleibt, solange Wowhalla selbst liegt.
- **Beobachtet:** der gesamte Stack (3 Karten) landet im Gelöscht-Stapel, Wowhalla liegt weiter.
- **Repro:** `docs/niche-tests/repro/A04-cute/02-wowhalla-andere-area.js`
- **Vermutete Ursache:** `wowhalla-the-hall-of-the-cool.js:124` `onCardLeaveZone` prüft nur `fromZone === 'area'` und `fromOwner`, nicht ob die gehende Area Wowhalla selbst ist (`ctx.leavingCard.id === ctx.card.id`).

### A04-cute-03 · Swagdri spielt Golden Bananas von der Stack-Spitze – der Gold-Gewinn verpufft · Stufe A
- **Karten:** Swagdri, Forger of Coolness; Golden Bananas (Monkees); (Cool × Monkees)
- **Voraussetzungen / Aufbau:** Sitz 0: Wowhalla (Area), Swagdri auf dem Brett (ohne Beschwörungsschlaf), Coolness Stack `[Cute Bunny, Golden Bananas]`, 10 Gold, Main Phase 1.
- **Schritte:** 1. Swagdris Kreatureneffekt aktivieren (`doActivateCreatureEffect`).
- **Erwartet** (Swagdri: „play it without paying its Cost as if it was part of your hand"; Bananas: „Gain 4 Gold three times"): 22 Gold, Bananas gelöscht.
- **Beobachtet:** Bananas liegen im Gelöscht-Stapel, Gold bleibt 10 (die 12 Gold werden wieder abgezogen).
- **Repro:** `docs/niche-tests/repro/A04-cute/03-swagdri-bananas.js`
- **Vermutete Ursache:** `swagdri-forger-of-coolness.js` (Nicht-Ausrüstungs-Zweig, nach `script.resolve`): „Kosten umgehen" per Gold sichern/zurücksetzen (`ps.gold = origGold`) löscht jede Goldänderung des Artefakts, auch Gewinne – und ebenso die Gold-Auszahlungen/-Zahlungen der durch die Bananas ausgelösten Monkees.

### A04-cute-04 · Swagdri rüstet „Lunatic Cycle - Crescent Moon" ohne New Moon aus · Stufe B
- **Karten:** Swagdri; Lunatic Cycle - Crescent Moon (ebenso Half/Gibbous/Full Moon, Cute Crown mit gleicher Mechanik)
- **Voraussetzungen / Aufbau:** Wowhalla, Swagdri auf dem Brett, Stack-Spitze = Crescent Moon, **kein** New Moon auf dem Brett.
- **Schritte:** Swagdri aktivieren.
- **Erwartet** (Crescent Moon: „You can only play this card while there is at least 1 New Moon on the board"; Swagdri hebt nur die *Kosten* auf): keine Ausrüstung.
- **Beobachtet:** Crescent Moon wird ausgerüstet, Stack leer.
- **Repro:** `docs/niche-tests/repro/A04-cute/04-swagdri-crescent-ohne-newmoon.js`
- **Vermutete Ursache:** `swagdri-forger-of-coolness.js` Ausrüstungs-Zweig baut Held-/Zonenziele selbst; `canEquipToHero`/`canPlayCard` des Artefakts werden nicht gefragt (nur tot/gefroren). Restunsicherheit (daher B): ob Swagdri auch Spielbedingungen ausschaltet, sagt der Text nicht ausdrücklich, „as if it was part of your hand" spricht dagegen.

### A04-cute-05 · Abbruch der Zielwahl verbraucht Swagdris Einmal-pro-Zug-Nutzung · Stufe B
- **Karten:** Swagdri, Forger of Coolness (Ziel-Artefakt hier: Angry Cheese)
- **Voraussetzungen / Aufbau:** Swagdri auf dem Brett, Stack-Spitze Angry Cheese, Main Phase 1, Zielwahl wird abgebrochen (`targetFn → null`).
- **Schritte:** 1. Swagdri aktivieren, Zielwahl abbrechen. 2. Im selben Zug erneut aktivieren und ein Ziel wählen.
- **Erwartet** (Konvention CARD_API „Abbruch = nichts ist passiert", Kartentext „you may"): zweiter Versuch gelingt.
- **Beobachtet:** Karte bleibt zwar auf dem Stack, aber der zweite Versuch wird abgelehnt (Einmal-pro-Zug verbraucht, HOPT-Stempel steht auf Zug 5).
- **Repro:** `docs/niche-tests/repro/A04-cute/05-swagdri-abbruch-hopt.js`
- **Vermutete Ursache:** `swagdri-forger-of-coolness.js` stempelt `counters.swagdriPlayedArtifactThisTurn` schon vor den Abbruchstellen und gibt bei Abbruch `undefined` (nicht `false`) zurück, sodass auch die Engine-HOPT (`creature-effect:<id>`) gestempelt wird.

### A04-cute-06 · Cute Hydra wird auf dem Coolness Stack gelöscht, ohne dass die Löschrettung angeboten wird · Stufe A
- **Karten:** Cute Hydra; Wowhalla/Coolness Stack (Bifab, String of Fine, Ragnarock, Wowhalla-Schutz, Yolomungandr, Wowhalla-Abgang als Löschwege)
- **Voraussetzungen / Aufbau:** Hand ≥ 3 Karten, Held mit Hydra-Schulen, Hydra auf dem Coolness Stack; (A) Stack-Spitze löschen, (B) ganzen Stack löschen.
- **Erwartet** (Hydra: „If this Creature would be deleted from anywhere while you control a Hero that can summon it and have at least 3 cards in your hand, you may immediately summon this deleted Creature"): Rettungs-Abfrage wie bei jedem Löschweg.
- **Beobachtet:** kein Prompt, Hydra im Gelöscht-Stapel. Gegenprobe (Hydra im Deck, `deleteFromPile`): Rettung greift.
- **Repro:** `docs/niche-tests/repro/A04-cute/06-hydra-loeschrettung-stack.js`
- **Vermutete Ursache:** `_engine.js` `actionPopCoolnessStackTo` (dest `'delete'`) und `actionDeleteCoolnessStack` schieben direkt in `deletedPile`; `_tryBeforeDelete` wird nur von den anderen Löschwegen gerufen (u. a. Z. 13536, 13662, 14282, 16623/16663, 16918, 19227, 24709, 47228).  Ash Worms (gleiche „deleted from anywhere"-Klausel) ist hier nicht getestet.

### A04-cute-07 · Cute Cat: Ablegen vom Coolness Stack löst den Mill nicht aus · Stufe B
- **Karten:** Cute Cat; Coolness Overcharge / Coolness Stack (Cool × Cute)
- **Voraussetzungen / Aufbau:** Stack-Spitze Cute Cat, Deck ≥ 3; `actionPopCoolnessStackTo(…,'discard')` (so schickt Coolness Overcharge die Stack-Spitze in die Ablage).
- **Erwartet** (Cat: „The first time every turn a Cute Cat is sent to the discard pile from anywhere, send the top 3 cards of your deck to the discard pile"): Deck −3.
- **Beobachtet:** Cat liegt in der Ablage, Deck unverändert. Gegenprobe Abwurf aus der Hand: Deck −3.
- **Repro:** `docs/niche-tests/repro/A04-cute/07-cat-coolness-stack.js`
- **Vermutete Ursache:** `cute-cat.js` `onDiscard` verlangt `ctx._fromHand`; die Stack-Variante feuert ON_DISCARD mit `_fromCoolnessStack`.

### A04-cute-08 · Wildurs Umleitung fällt nach „Guard Duty" dauerhaft aus · Stufe A
- **Karten:** Wildur, the Shining Coolness; Guard Duty (Guardian Beasts, nur als Auslöser)
- **Voraussetzungen / Aufbau:** Wowhalla + Stack, Wildur auf dem Brett, Zugbeginn-Hook gelaufen, Guard Duty in der Hand (oder: Gegner spielt Guard Duty, Wildur-Besitzer nimmt das Zurückmischen an).
- **Schritte:** 1. Guard Duty spielen. 2. Eine weitere Karte (z. B. gestorbene Kreatur) in die Ablage schicken.
- **Erwartet** (Wildur: „The first card that would be sent to your discard pile every turn … is placed on top of your Coolness Stack instead"): wie in der Gegenprobe (ohne Guard Duty) landet die erste Ablage-Karte des Zuges auf dem Stack – Guard Duty selbst bzw. danach jede erste Karte eines Zuges.
- **Beobachtet:** Guard Duty und alle weiteren Karten gehen in die Ablage; Wildur wirkt für den Rest des Spiels nicht mehr.
- **Repro:** `docs/niche-tests/repro/A04-cute/08-wildur-nach-guard-duty.js`
- **Vermutete Ursache:** `wildur-the-shining-coolness.js` überschreibt `ps.discardPile.push` auf der *Array-Instanz* und merkt nur ein Flag (`_wildurRedirectInstalled`); `guard-duty.js` Z. 52/77 ersetzt `ps.discardPile = []`. Das Flag verhindert die Neuinstallation (auch in `onTurnStart`). Anfällig ist jede Stelle, die das Array ersetzt (gefunden: Guard Duty; CPU-Proben stellen das Original wieder her).

### A04-cute-09 · Hipdall: Rückholung einer vom Coolness Stack entfernten Karte funktioniert nie (Ablage/Gelöscht) · Stufe A
- **Karten:** Hipdall, Protector of Coolness (Auslöser: Coolness Overcharge, Bifab, String of Fine, Ragnarock, Wowhalla-Schutz …)
- **Voraussetzungen / Aufbau:** Hipdall auf dem Brett, Stack `[Cute Bunny, Cute Dog]`, Deckoberseite Fireball; oberste Karte wird nach Ablage / Gelöscht / Hand entfernt; Antwort „Ja".
- **Erwartet** (Hipdall: „Once per turn, when a card is removed from your Coolness Stack, you may add it to your hand, and if you do, place the top card of your deck on top of your Coolness Stack"): Cute Dog auf der Hand, Fireball oben auf dem Stack.
- **Beobachtet:** Abfrage lautet „*Hipdall, Protector of Coolness* is leaving your Coolness Stack. Add it to your hand …" (falsche Karte); nach „Ja" passiert bei Ablage und Gelöscht nichts (Karte bleibt dort, Stack unverändert, Einmal-pro-Zug verbraucht). Nur bei Ziel „Hand" läuft der Deck-Teil.
- **Repro:** `docs/niche-tests/repro/A04-cute/09-hipdall-rueckholung.js`
- **Vermutete Ursache:** `hipdall-protector-of-coolness.js` `onCardLeaveZone`: `const cardName = ctx.cardName;` ist in der Hook-Ctx der *Zuhörer* (Hipdall), nicht die gehende Karte; `takeFromPile(ps,'discard'|'deleted', 'Hipdall…')` findet nichts. Die gehende Karte reicht `actionPopCoolnessStackTo` zwar als `card`/`cardName` mit, beides wird aber von der Kontext-Erzeugung überschrieben.

### A04-cute-10 · „You can only control 1 …" wird nur beim Ausspielen aus der Hand durchgesetzt – Army, Glorious Rebirth, Cute Bird, Annoyance Mini, Molinda · Stufe A
- **Karten:** Cute Phoenix, Cute Familiar (Klausel) · Army of the Cute, Glorious Rebirth (Cool × Cute), Cute Bird, Cute Annoyance Mini, Cute Angel Molinda (Verursacher)
- **Voraussetzungen / Aufbau:** Ein Cute Phoenix (bzw. Familiar) liegt schon beim eigenen Helden 1. (a) Army wählt das zweite Exemplar aus der Hand (Summoning Magic 3); (b) Glorious Rebirth mit Phoenix auf der Stack-Spitze; (c) Cute Bird stirbt, 2 Abwürfe werden bezahlt, Phoenix im Deck; (d) Annoyance Mini tutort einen Familiar und zahlt den Rider; (e) Molinda trifft den gegnerischen Phoenix und übernimmt ihn.
- **Erwartet** („You can only control 1 …"; die normale Beschwörung eines zweiten Exemplars wird verweigert, Gegenprobe ✓): kein zweites Exemplar; bei Bird/Mini wenigstens keine Kosten für nichts.
- **Beobachtet:** In allen fünf Wegen liegen danach 2 Exemplare unter eigener Kontrolle. Bei Bird und Mini sind die Abwurfkosten bezahlt (Bird-Kommentar im Skript: „canSummon refused (already control 1 Phoenix) … fizzles" – das tritt nie ein).
- **Repro:** `docs/niche-tests/repro/A04-cute/10-eindeutigkeit-army-rebirth.js`
- **Vermutete Ursache:** `cute-phoenix.js` / `cute-familiar.js` prüfen die Klausel nur in `canSummon`; das fragt nur der Hand-Weg (`isCreatureSummonable`). `summonCreatureWithHooks` (Bird, Mini-Rider) und die direkten Platzierungen (Army, Rebirth, `actionTransferCreature` bei Molinda) fragen es nicht. Restunsicherheit nur bei den „place"-Karten (Army, Rebirth, Bird, Molinda), ob Platzieren die Dauerklausel umgehen darf; Mini sagt ausdrücklich „summon" → klar. Cute Conversion (Diebstahl des gegnerischen Phoenix) ist nicht getestet.

### A04-cute-11 · Was zählt als „Cute" Creature? Name (Crown, Mary, Monami) gegen Archetyp (Army, Pink Sky, Conversion, Mini) · Stufe C
- **Karten:** Cute Crown, Cute Princess Mary, Cute Ditz Monami (Namensbezug, ganzes Wort) · Army of the Cute, Pink Sky, Cute Conversion, Cute Annoyance Mini (Archetyp „Cute") · Cuteness Sensor (Namens-Präfix) · Auslöser: „Cute Spider" (Archetyp Spiders, Name enthält Cute)
- **Voraussetzungen / Aufbau:** Cute Spider auf dem Brett/in der Hand; Pink Sky spielen; Army of the Cute; Princess Mary summonen lassen.
- **Erwartet:** Ein einheitlicher Begriff (CARD_API: Anführungszeichen = „zählt als").
- **Beobachtet:** Pink Sky negiert Cute Spider (kein „Cute"); Army bietet ihn nicht an; Princess Mary beschwört ihn als „Cute" ohne Schule (Name). Gegenstück: Karten mit Cute-Archetyp ohne das Wort im Namen (Cuteness Sensor, Pink Sky, „Molinda, the Cutest …") zählen für Namens-Karten nicht.
- **Repro:** `docs/niche-tests/repro/A04-cute/11-cute-begriff-spider.js`
- **Vermutete Ursache:** zwei Definitionen in `_cute-shared.js` (`hasCuteInName` / `isCuteCreatureInst`) und eigene Prüfungen in `army-of-the-cute.js`, `cute-conversion.js`, `cute-annoyance-mini.js` (`archetype === 'Cute'`), `cuteness-sensor.js` (Regex-Präfix).
- **Frage an Al:** Soll „Cute" Creature immer der **Name** (Wort „Cute") sein – ja (dann zählt Cute Spider überall) oder der **Archetyp** (dann zählt Cute Spider nirgends)?

### A04-cute-12 · Elephant wird per Cool Rescue (Stack → Hand) nicht dauerhaft aufgedeckt · Stufe B
- **Karten:** Fun-Fun Circus Elephant; Cool Rescue (Coolness Stack)
- **Voraussetzungen / Aufbau:** Elephant auf der Stack-Spitze, Cool Rescue auf der Hand.
- **Schritte:** 1. Cool Rescue spielen. 2. Aufdeck-Status der Elephant-Handkarte prüfen (Gegenproben: Ziehen, Bifab-Suche).
- **Erwartet** („When you draw this card or add it to your hand, reveal it permanently"): aufgedeckt.
- **Beobachtet:** Ziehen und Bifab-Suche decken auf, Cool Rescue nicht. Der Elephant zählt in der Hand trotzdem Applause mit (`collectsApplauseInHand` fragt die Aufdeckung nicht ab) – der Gegner sieht ihn nie.
- **Repro:** `docs/niche-tests/repro/A04-cute/12-elephant-aufdecken-cool-rescue.js`
- **Vermutete Ursache:** `_engine.js` `actionPopCoolnessStackTo` (dest `'hand'`) legt per `ps.hand.push` auf die Hand, ohne `handZugang`/`_autoRevealOnEnterHand`.

### A04-cute-13 · Clown legt Applause Counter auf eine per Cute Conversion geliehene Kreatur · Stufe B
- **Karten:** Fun-Fun Circus Clown (ebenso Strongman/Director-Zähler), Cute Conversion
- **Voraussetzungen / Aufbau:** Sitz 0: Clown auf dem Brett, Cute Conversion gespielt (Magic Arts 2); Sitz 1: Strongman → geliehen. Clown wählt „1 Counter auf jede andere Circus-Kreatur".
- **Erwartet** (Conversion: „Creatures controlled by this effect are unaffected by all cards and effects while they are controlled"): kein Counter auf der geliehenen Kreatur (Schaden und Status werden blockiert, ✓ Gegenprobe).
- **Beobachtet:** Der geliehene Strongman bekommt 1 Applause Counter.
- **Repro:** `docs/niche-tests/repro/A04-cute/13-clown-geliehene-kreatur.js`
- **Vermutete Ursache:** `_applause-shared.js` `placeApplause` prüft keine Omni-Immunität; Restunsicherheit: ob „all cards and effects" auch eigene Effekte des Kontrolleurs einschließt.

### A04-cute-14 · Thorad: „single target" wird bei Helden nicht geprüft, bei Kreaturen schon · Stufe B
- **Karten:** Thorad, Strength of Coolness (mit Fireball, Flame Avalanche, Icebolt als Auslöser)
- **Voraussetzungen / Aufbau:** Thorad (Held 0), Coolness Stack 3 Karten (+120), Gegner mit Dummy-Kreaturen bzw. Helden.
- **Erwartet** („Any damage this Hero deals to a single target with Attacks or Spells is increased by 40 × cards in your Coolness Stack"): Einzelziel-Spell +120; Mehrziel-Spell einheitlich (Kreaturen- und Heldenzweig gleich).
- **Beobachtet:** Fireball auf 1 Held 270 ✓ · auf 2 Helden je 270 (Bonus) · auf 2 Kreaturen je 150 (kein Bonus) · Flame Avalanche auf alle 3 Helden je 270. Icebolt (Decay Magic, `destruction_spell`) 240 ✓.
- **Repro:** `docs/niche-tests/repro/A04-cute/14-thorad-einzelziel.js`
- **Vermutete Ursache:** `thorad-strength-of-coolness.js`: `beforeDamage` (Heldenzweig) ohne Einzelziel-Tor, `beforeCreatureDamageBatch` mit `entries.length !== 1`-Tor.

### A04-cute-15 · Wildur (Lv1) lässt sich vom Coolness Stack ohne Summoning Magic beschwören · Stufe C
- **Karten:** Wildur, the Shining Coolness (Hipdall/Swagdri sind Lv0 und unauffällig)
- **Voraussetzungen / Aufbau:** Held ohne Fähigkeiten, Wildur auf der Stack-Spitze.
- **Beobachtet:** Beschwörung über `actionPlayTopOfCoolnessStack` gelingt; aus der Hand wird derselbe Versuch abgelehnt (Summoning Magic 1 fehlt). `summonFromStack` prüft weder Schul-Stufe noch `canPlayCard`/`canSummon` des Helden (Cute Crown, Princess Mary).
- **Repro:** `docs/niche-tests/repro/A04-cute/15-wildur-vom-stack-ohne-schule.js`
- **Vermutete Ursache:** `hipdall-protector-of-coolness.js` `summonFromStack` (gemeinsamer Helfer für Hipdall/Wildur/Swagdri).
- **Frage an Al:** Soll die Beschwörung vom Coolness Stack die Stufe des Helden verlangen (Wildur: Summoning Magic 1) – ja oder nein?

### A04-cute-16 · Cute Bunny reagiert nicht auf die Mehrfach-Abwürfe von Cute Hydra und Cute Dog · Stufe B
- **Karten:** Cute Bunny; Cute Hydra, Cute Dog (Gegenprobe: Cute Phoenix/Cute Bird über `actionPromptForceDiscard`, Cute Annoyance Mini über `withDiscardBatch`)
- **Voraussetzungen / Aufbau:** Bunny auf dem Brett; (a) Dog-Tutor mit 2 Abwürfen und 2 gesuchten Karten; (b) Hydra aus der Hand beschworen, 2 Pflichtabwürfe.
- **Erwartet** (Bunny: „Whenever you discard or delete 2 or more cards from your hand through an effect, draw 1 card"; Hand-Variante: „… at the same time"): Bunny zieht 1.
- **Beobachtet:** Kein Zug, kein Angebot der Hand-Variante. Mit `actionPromptForceDiscard(2)` direkt zieht Bunny (Gegenprobe ✓).
- **Repro:** `docs/niche-tests/repro/A04-cute/16-bunny-hydra-dog-abwurf.js`
- **Vermutete Ursache:** `cute-hydra.js` (onPlay-Schleife) und `cute-dog.js` (onCreatureEffect-Schleife) werfen einzeln über `actionDiscardHandCard` ab, ohne `engine.withDiscardBatch(...)` (Mini tut das ausdrücklich, damit Bunny reagiert). Restunsicherheit (B): ob „at the same time" bei einer Klick-Schleife gilt; „through an effect" spricht dafür. Das „delete"-Gegenstück (≥ 2 Karten gelöscht) ist nicht getestet.

### A04-cute-17 · Wildur + Cute Phoenix: Phoenix steht nach dem Revive doppelt im Spiel (Brett und Coolness Stack) · Stufe A
- **Karten:** Wildur, the Shining Coolness; Cute Phoenix (ebenso jede Wiederbelebung nach dem Tod: Loyal Bone Dog, Trial of Coolness, Extra Life – nicht einzeln getestet)
- **Voraussetzungen / Aufbau:** Wowhalla + Stack, Wildur auf dem Brett (Zugbeginn-Hook gelaufen), Cute Phoenix, Hand mit 3 Karten; Phoenix erleidet tödlichen Gegnerschaden, Revive wird bezahlt (2 Abwürfe).
- **Erwartet:** genau 1 Cute Phoenix im Spiel (wiederbelebt). Gegenprobe ohne Wildur: ✓ (Kartenbilanz 0).
- **Beobachtet:** Wildur legt die Leiche (erste Ablage-Karte des Zuges) auf den Coolness Stack; der Revive beschwört trotzdem eine frische Instanz → Phoenix auf dem Brett UND auf dem Stack. Kartenbilanz „Cute Phoenix: +1".
- **Repro:** `docs/niche-tests/repro/A04-cute/17-wildur-phoenix-duplikat.js`
- **Vermutete Ursache:** `_engine.js:26674` `_wiederbelebungNachTod` nimmt die Leiche nur aus der Ablage, falls sie dort liegt („Liegt die Karte nicht in der Ablage (Token → Deleted), wird wie bisher trotzdem zurückgeholt"); liegt sie durch Wildurs `discardPile.push`-Umleitung auf dem Coolness Stack, bleibt diese Kopie dort stehen.

### A04-cute-18 · Cute Familiar: Rückkehr am Zugende scheitert, wenn Wildur die Leiche auf den Coolness Stack gelegt hat · Stufe B
- **Karten:** Cute Familiar; Wildur
- **Voraussetzungen / Aufbau:** Held 1 mit Charme 2, Wildur und Stack wie oben; Familiar stirbt, Zug endet.
- **Erwartet** („place it into the free Support Zone of a Hero … with at least Charme 2 at the end of the turn, if possible"): Familiar kehrt zurück (Gegenprobe ohne Wildur ✓; Gegner-Zug-Variante ✓; kein Charme-2-Held → bleibt liegen, kein Fehler ✓).
- **Beobachtet:** Familiar bleibt auf dem Coolness Stack, Rückkehr tut nichts.
- **Repro:** `docs/niche-tests/repro/A04-cute/18-familiar-wildur-rueckkehr.js`
- **Vermutete Ursache:** `cute-familiar.js` onTurnEnd nimmt die Leiche per `ablageEntnahme` aus der Ablage; „place it" nennt die Ablage nicht als Voraussetzung. Restunsicherheit (B): ob die Karte nach der Umleitung als „it" noch verfügbar sein soll.

### A04-cute-19 · Modnir: der +100-ATK-Bonus verschwindet, sobald irgendeine Karte eine Support Zone verlässt · Stufe A
- **Karten:** Modnir, Hammer of Coolness (Coolness Stack)
- **Voraussetzungen / Aufbau:** Wowhalla, Modnir auf der Stack-Spitze, Held 0 (ATK 40); Modnir über `actionPlayTopOfCoolnessStack` ausrüsten (ATK 140). Danach stirbt irgendeine Kreatur (z. B. eine gegnerische).
- **Erwartet** („The equipped Hero's Attack stat is increased by 100"): Bonus bleibt, solange Modnir ausgerüstet ist.
- **Beobachtet:** Held steht wieder auf ATK 40, Modnir liegt weiter am Helden (`counters.atkGranted = 0`). Zwei Modnir: gehen beide leer, sobald EIN Modnir (oder eine beliebige Karte) geht.
- **Repro:** `docs/niche-tests/repro/A04-cute/19-modnir-atk-verschwindet.js`
- **Vermutete Ursache:** `modnir-hammer-of-coolness.js:31-34` `onCardLeaveZone`: `if (ctx.fromZone !== 'support') return; ctx.revokeAtk();` – keine Prüfung, dass die gehende Karte Modnir selbst ist (Vergleich: `lunatic-cycle-full-moon.js` prüft Held/Slot, `_second-action-shared.js` prüft `leavingCard.id`).

### A04-cute-20 · Lunar Eclipse: der abzulegende „Lunatic Cycle" ist nicht wählbar · Stufe B
- **Karten:** Lunar Eclipse; Lunatic Cycle (alle fünf), Lunatic Golem/Hawk (Stufen hängen an der Zahl verschiedener Cycles)
- **Voraussetzungen / Aufbau:** Eclipse verdeckt bei Held 0 (Magic Arts 1), New Moon (Held 1) und Full Moon (Held 2) auf dem Brett; Gegner spielt Fireball aus der Hand.
- **Erwartet** („by sending a 'Lunatic Cycle' card from your side of the board to the discard pile"): der Spieler wählt.
- **Beobachtet:** Rückfrage nur „Activate Lunar Eclipse?"; abgelegt wird immer der erste Cycle der Instanzliste (hier New Moon). Negation + Löschen (Fireball, Cute Bunny, Golden Bananas) laufen korrekt.
- **Repro:** `docs/niche-tests/repro/A04-cute/20-eclipse-kosten-ohne-wahl.js`
- **Vermutete Ursache:** `lunar-eclipse.js:93` `actionMoveCard(insts[0], 'discard')`; der Kommentar „All five moons satisfy the cost equally" trifft nicht zu (New Moon = Tutor, Half Moon = Schadensdeckel, …).

### A04-cute-21 · Cooldin ist bei jeder liegenden Area gesperrt – auch mit Spatial Crevice (Limit 3) · Stufe B
- **Karten:** Cooldin, King of Coolness; Spatial Crevice
- **Voraussetzungen / Aufbau:** Cooldin (Held 0), Wowhalla auf der Hand, Spatial Crevice liegt in der Area-Zone, Main Phase 1.
- **Erwartet** („play it as an additional Action"; Crevice: „up to 3 different Areas"): Cooldin kann Wowhalla legen, solange `canPlaceAnotherArea` Platz meldet (hier `true`).
- **Beobachtet:** Heldeneffekt nicht aktivierbar (Gegenprobe mit leerer Area-Zone: klappt, Zug endet).
- **Repro:** `docs/niche-tests/repro/A04-cute/21-cooldin-spatial-crevice.js`
- **Vermutete Ursache:** `cooldin-king-of-coolness.js:215` `canActivateHeroEffect`: `(gs.areaZones?.[pi] || []).length > 0` → `false` statt `engine.canPlaceAnotherArea(pi, name)`.

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
