# A05-skeletons – Nischenfall-Bericht
Stand/Autor: Agent A05-skeletons, 12.10.2026. Karten: 57 in der Liste · 26 gezielt getestet (L2) · 32 mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### A05-01 · Burning Fuse besiegt auch Bomblebees, die diesen Zug beschworen wurden · Stufe B
- **Karten:** Burning Fuse (`cards/effects/burning-fuse.js`), Dive Bomblebee / Bomblebee (`_bomblebee-shared.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Held 0 mit Summoning Magic 1, Hand [Burning Fuse]; Brett: eine alte Bomblebee (turnPlayed 1) und eine DIESEN Zug beschworene Dive Bomblebee; Gegner mit zwei Kreaturen.
- **Schritte:** 1. Burning Fuse im eigenen Zug spielen (proaktiver Weg: `proactivePlay`/`inherentAction`). 2. Ziel für die Payloads wählen.
- **Erwartet:** (Kartentext „Activate the effects of all "Bomblebee" Creatures you control that were not summoned this turn … Defeat all affected …") Nur die alte Bomblebee feuert und wird besiegt; die frische bleibt.
- **Beobachtet:** Beide feuern (`bypassHopt`) und beide werden besiegt (`burning_fuse_resolve count:2`). Der reaktive Weg (Gegner betritt Action Phase) ist unauffällig (getestet, ✓): dort stammen die eigenen Bees fast immer aus einem früheren Zug.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/01-burning-fuse-frisch-beschworen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/burning-fuse.js` `eligibleBomblebees()` ruft `findOwnBomblebees(engine, pi)` ohne `{ excludeSummonedThisTurn: true }` auf (der Kopfkommentar behauptet das Gegenteil: „and were not summoned this turn"). Option existiert in `_bomblebee-shared.js:findOwnBomblebees`.

### A05-02 · Dive Bomblebee legt einen Token unten ins Gegner-Deck · Stufe B
- **Karten:** Dive Bomblebee (`cards/effects/dive-bomblebee.js`)
- **Voraussetzungen / Aufbau:** Seed 1234; Seite 0: Dive Bomblebee; Seite 1: „Mummy Token" in Held 0 Slot 0 und eine 10-HP-Kreatur (Auslöser).
- **Schritte:** 1. Die 10-HP-Kreatur des Gegners besiegen (`actionDestroyCard`). 2. Im Dive-Ziel-Prompt den Mummy Token wählen.
- **Erwartet:** (Engine-Regel: Tokens verlassen das Brett nie in Ablage/Deck, sie werden gelöscht, vgl. `actionMoveCard`/Token → Deleted; CARD_API „Tokens … überall verboten") Token wird nicht angeboten oder verschwindet; im Deck liegt kein Token.
- **Beobachtet:** Der Token wird als Ziel angeboten und „Mummy Token" liegt danach als normale Karte unten im Deck des Gegners (später ziehbar).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/02-dive-bomblebee-token-ins-deck.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dive-bomblebee.js` `pickableOppCards()` filtert Tokens nicht heraus; `runOpponentDeathPayload` macht `ops.mainDeck.push(cardName)` ohne Token-Sonderfall.

### A05-03 · Dive Bomblebee auf gestohlene Kreatur: Karte bleibt im Slot ohne Instanz, Kopie im Gegner-Deck · Stufe A
- **Karten:** Dive Bomblebee (`cards/effects/dive-bomblebee.js`), Zusammenspiel mit jedem Kreatur-Diebstahl (`actionStealCreature`)
- **Voraussetzungen / Aufbau:** Seite 1 hat per `actionStealCreature` eine Kreatur von Seite 0 gestohlen (sie bleibt physisch in Seite 0 / Held 1 / Slot 0, `controller` = 1, `stolenBy` = 1). Seite 0 hat Dive Bomblebee, ein Gegner-Ziel stirbt.
- **Schritte:** 1. Gegner-Ziel besiegen. 2. Im Dive-Prompt die gestohlene Kreatur wählen (sie wird angeboten, weil der Filter nach `controller` läuft).
- **Erwartet:** (Kartentext „a card on your opponent's side of the board") Entweder wird die auf MEINER Seite liegende Kreatur nicht angeboten oder sie wird sauber vom Brett genommen; nie Name im Slot + getilgte Instanz + Kopie im Deck.
- **Beobachtet:** `supportZones[0][1][0]` zeigt weiter „ZZ Dummy Big", die Instanz ist getilgt (`audit`: „0 Instanzen"), und unten im Deck des Gegners liegt ein weiteres Exemplar (Kartenbilanz +1).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/03-dive-bomblebee-gestohlene-kreatur-duplikat.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dive-bomblebee.js` `pickableOppCards()` wählt per `controller === oi`; `runOpponentDeathPayload` spleißt aber aus `gs.players[oi].supportZones[...]` (Kontrollseite) statt aus `physicalSide(inst)`; danach `_untrackCard` + `mainDeck.push` auf Kontroll-Seite.

### A05-04 · Negierte Time Bomblebee bleibt schadens- und zerstörungsimmun · Stufe B
- **Karten:** Time Bomblebee (`cards/effects/time-bomblebee.js`), Engine `_engine.js` (`_damageDestroyImmune`)
- **Voraussetzungen / Aufbau:** Seed 1234; Time Bomblebee (turnPlayed 1) auf Seite 0, Gegner-Kreatur stirbt → 1 Bomb Counter; dann `actionNegateCreature(timeBomblebee)`.
- **Schritte:** 1. Counter auflegen lassen. 2. Time Bomblebee negieren (z. B. Sparky Slime, Skeleton Death Knight). 3. 500 Schaden auf sie.
- **Erwartet:** (Kartentext „While this Creature has Bomb Counters on it, it cannot take damage or be defeated" = statischer Effekt; Vorbild CARD_API v1357 „Egg of God": bei negiertem Effekt kommt Schaden durch) Eine negierte Time Bomblebee nimmt Schaden und kann besiegt werden.
- **Beobachtet:** Sie bleibt unversehrt (`currentHp` 50, zone support); die Immunität hängt allein am Counter-Flag `_damageDestroyImmune`.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/04-time-bomblebee-negiert-bleibt-immun.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ca. Z. 12285 (`actionDestroyCard`) und ca. Z. 46191 (Schadens-Batch) lesen `counters._damageDestroyImmune` ohne `isCreatureEffectSuppressed`/Negationsprüfung.

### A05-05 · Bomblebee Cluster beschwört Bomblebees über der Summoning-Magic-Stufe des Helden · Stufe B
- **Karten:** Bomblebee Cluster (`cards/effects/bomblebee-cluster.js`), Carpet Bomblebee (Lv 2)
- **Voraussetzungen / Aufbau:** Held 0 Summoning Magic 1, Held 1 Summoning Magic 2 (damit der Lv2-Cluster spielbar ist). Hand: Bomblebee, Bomblebee Cluster, Carpet Bomblebee, Dive Bomblebee.
- **Schritte:** 1. Mit Held 0 „Bomblebee" beschwören. 2. Cluster-Reaktion annehmen. 3. In der Galerie „Carpet Bomblebee" wählen.
- **Erwartet:** (Kartentext „… with the same Hero as additional Actions") nur die Aktion entfällt, die Schulstufe bleibt Pflicht (Engine-Konvention: `_spider-shared.js makeSurpriseCostSummon`, Brain/Box Spider) → Carpet Bomblebee (Lv 2) ist für Held 0 (SM 1) nicht beschwörbar bzw. nicht wählbar.
- **Beobachtet:** Carpet Bomblebee wird angeboten und steht danach bei Held 0 (Slot 1). Danach `summonLocked` wie vorgesehen.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/05-bomblebee-cluster-ignoriert-stufe.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `bomblebee-cluster.js` `bomblebeeNamesInHand` filtert nur nach Namen; es gibt keine `heroMeetsLevelReq`-Prüfung gegen den beschwörenden Helden (`summonCreatureWithHooks` prüft die Schulstufe nicht).

### A05-06 · Bomblebee Cluster: zweite Bomblebee mit gleichem Namen wie die auslösende? · Stufe C
- **Karten:** Bomblebee Cluster (`cards/effects/bomblebee-cluster.js`)
- **Voraussetzungen / Aufbau:** Hand: Bomblebee ×2, Bomblebee Cluster, Dive Bomblebee; Held 0 mit Summoning Magic 2.
- **Schritte:** 1. „Bomblebee" beschwören. 2. Cluster annehmen. 3. Galerie ansehen.
- **Erwartet:** Text: „Summon up to 2 "Bomblebee" Creatures with different names from your hand" – zwei Lesarten: (1) Skript: die Beschworenen müssen auch anders heißen als die auslösende; (2) Wortlaut: „different names" nur untereinander.
- **Beobachtet:** Die Galerie bietet nur „Dive Bomblebee"; die zweite „Bomblebee" bleibt in der Hand (usedNames enthält den Namen der auslösenden Karte).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/06-bomblebee-cluster-gleicher-name.js` (✗ = Wortlaut-Lesart wird nicht erfüllt)
- **Vermutete Ursache:** `bomblebee-cluster.js` Z. ~63 `const usedNames = new Set([triggerInst.name]);`
- **Frage an Al:** Darf Bomblebee Cluster eine zweite „Bomblebee" mit demselben Namen wie die gerade beschworene auslösende Karte holen (ja/nein)?

### A05-07 · Burning Fuse: im eigenen Zug spielbar; Time Bomblebee ausgeschlossen · Stufe C
- **Karten:** Burning Fuse (`cards/effects/burning-fuse.js`), Time Bomblebee
- **Voraussetzungen / Aufbau:** Hand [Burning Fuse], Held 0 Summoning Magic 1; Brett: alte Bomblebee und alte Time Bomblebee; Gegner mit Kreatur.
- **Schritte:** 1. Burning Fuse im eigenen Zug (Action Phase) spielen.
- **Erwartet:** Text: „You may activate this card when your opponent enters their Action Phase … all "Bomblebee" Creatures you control that were not summoned this turn … Defeat all affected afterwards." Zwei Fragen: (a) nur reaktiv? (b) gehört Time Bomblebee dazu (sie bekäme einen Counter und wäre dann unbesiegbar)?
- **Beobachtet:** (a) Die Karte ist im eigenen Zug gratis spielbar (`proactivePlay`/`inherentAction`, im Kopfkommentar als „Path 1" beschrieben). (b) Time Bomblebee wird bewusst ausgeschlossen (`eligibleBomblebees`), bleibt unberührt.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/07-burning-fuse-proaktiv-und-time-bomblebee.js` (✗ = jeweils die Textlesart wird nicht erfüllt)
- **Vermutete Ursache:** `burning-fuse.js` `proactivePlay: true`, `inherentAction: true`, `eligibleBomblebees()` (Filter `name !== "Time Bomblebee"`).
- **Frage an Al:** (a) Soll Burning Fuse im eigenen Zug spielbar bleiben (ja = wie jetzt) und (b) soll Time Bomblebee von Burning Fuse erfasst werden (ja/nein)?

### A05-08 · Sandy Blob feuert bei Spinnen, die keinen On-Summon-Effekt haben (Kosten-`beforeSummon` zählt als Effekt) · Stufe B
- **Karten:** Sandy Blob (`cards/effects/sandy-blob.js`), Baby/Box/Brain/Crimson Skull/Diamond Spider (`_spider-shared.js makeSurpriseCostSummon`, `baby-spider.js`)
- **Voraussetzungen / Aufbau:** Held 0 Summoning Magic 2, Sandy Blob auf dem Brett, Gegner mit Ziel; je eine Spinne aus der Hand beschwören (Abbruch nicht nötig, Standard-Antwort).
- **Schritte:** 1. Brain/Baby/Diamond/Box/Crimson Skull Spider normal beschwören. 2. Prüfen, ob Sandy Blob sein Zielfenster öffnet.
- **Erwartet:** (Kartentext „… when the on-summon effect of a Creature you control activates …") Diese fünf Spinnen haben keinen On-Summon-Effekt (nur Summon-Kosten bzw. Aktions-Buchung) → kein Fenster, keine der 3 Ladungen verbraucht.
- **Beobachtet:** Das Blob-Fenster öffnet für alle fünf (je 1 Ziel-Prompt).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/08-sandy-blob-spider-kosten-sind-kein-effekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sandy-blob.js` Z. ~105: `hasOnSummon` zählt jedes `typeof script.beforeSummon === "function"` (gedacht für Dark Deepsea God, dessen Effekt in `beforeSummon` läuft) – die Spinnen-Kostenhelfer nutzen denselben Haken für reine Kosten.

### A05-09 · Sandy Blob reagiert nicht auf die zusätzliche Aktivierung durch Slime Rancher · Stufe B
- **Karten:** Sandy Blob (`sandy-blob.js`), Slime Rancher (`slime-rancher.js`), Shiny Slime
- **Voraussetzungen / Aufbau:** Sandy Blob + Slime Rancher auf dem Brett, Hand: Shiny Slime, Gegner mit Ziel.
- **Schritte:** 1. Shiny Slime beschwören: Effekt aktiviert dank Rancher zweimal (Karten werden doppelt gezogen). 2. Blob-Fenster zählen.
- **Erwartet:** (Rancher: „… activated an additional time"; Blob: „when the on-summon effect of a Creature you control activates") Jede Aktivierung löst Blob aus → 2 Fenster (Obergrenze 3/Zug).
- **Beobachtet:** Shiny zieht 2×2 Karten, Blob öffnet nur 1 Fenster.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/09-sandy-blob-slime-rancher-zweite-aktivierung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Rancher löst die zweite Aktivierung als `runHooks("onPlay", {_onlyCard})` ohne neues Eintritts-Signal aus; Blob hört nur auf `onCardEnterZone`.

### A05-10 · Sandy Blob feuert, obwohl der On-Summon-Effekt (z. B. Cloudy Slime ohne Ziel) nichts tut · Stufe C
- **Karten:** Sandy Blob, Cloudy Slime (ebenso Shadowy Slime / Rocky Slime ohne Ziele)
- **Voraussetzungen / Aufbau:** Sandy Blob auf dem Brett; Hand sonst leer; Cloudy Slime beschwören.
- **Schritte:** 1. Cloudy Slime beschwören (kein Lv-0-Kandidat auf der Hand → Effekt tut nichts). 2. Blob-Fenster zählen.
- **Erwartet:** Lesart A (Skript): Eintritt einer Kreatur mit onPlay-Hook zählt als „aktiviert". Lesart B (Text „activates"): ohne Wirkung wird nichts aktiviert; der Mechanismus `summonEffectActivates` existiert dafür (nur Soul Shards nutzen ihn).
- **Beobachtet:** Blob öffnet das Fenster trotz leerem Effekt (Lesart A).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/10-sandy-blob-cloudy-slime-ohne-wirkung.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** `sandy-blob.js`: `summonEffectActivates` wird nur gefragt, wenn die Zielkarte es definiert; Cloudy/Shadowy/Rocky Slime definieren es nicht.
- **Frage an Al:** Soll Sandy Blob auch dann feuern, wenn der On-Summon-Effekt der Kreatur mangels Ziel/Kandidat nichts bewirkt (ja = wie jetzt / nein)?

### A05-11 · Sparkfly Attendant: Queen bleibt nach Tod/Negation des Attendants dauerhaft immun · Stufe A
- **Karten:** Sparkfly Attendant (`sparkfly-attendant.js`), Sparkfly Queen, `_sparkfly-shared.js refreshAttendantAura`
- **Voraussetzungen / Aufbau:** Attendant + Queen auf dem Brett (Attendant echt per `doPlayCreature` gespielt oder per `put` + onPlay); Aura gesetzt (`_oppEffectImmune`, `_oppDamageImmune`, `_sparkflyAttendantAura`).
- **Schritte:** 1. Attendant zerstören bzw. mit Schaden töten bzw. negieren. 2. Gegner schadet der Queen / wirkt auf sie. 3. optional: zwei Zugwechsel.
- **Erwartet:** (Kartentext „While you control this Creature, "Sparkfly Queen" Creatures you control are unaffected by your opponent's cards and effects") Ohne Attendant (oder bei negiertem Attendant) verliert die Queen den Schutz sofort.
- **Beobachtet:** Die Flags bleiben auf der Queen stehen, auch nach zwei Zugwechseln; sie nimmt 0 Gegnerschaden und ist gegen Gegnereffekte immun, obwohl kein Attendant mehr existiert.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/11-sparkfly-attendant-aura-bleibt.js` (✗ = Fehler tritt auf; Teil (b) Negation = B-Lesart)
- **Vermutete Ursache:** `refreshAttendantAura` wird nur aus Hooks des Attendants aufgerufen (`onPlay`, `onCardEnterZone`, `onCardLeaveZone`, `onGameStart`). Beim Abgang des Attendants zählt er im selben Hook noch als „auf dem Brett" bzw. sein Hook feuert nicht mehr, und die Negation prüft `hasAttendant` gar nicht.

### A05-12 · Sparkfly Worker nimmt einen Token als Karte auf die Hand · Stufe B
- **Karten:** Sparkfly Worker (`sparkfly-worker.js`), `_sparkfly-shared.js` (`collectNonHeroBoardTargets`, `stealBoardCardToHand`), Queen-Gabe „Worker" nutzt dieselbe Funktion
- **Voraussetzungen / Aufbau:** Queen im Spiel, Hand [Sparkfly Worker], Gegner mit „Mummy Token" in Held 0 Slot 0.
- **Schritte:** 1. Sparkfly Worker beschwören. 2. Im Zielfenster den Mummy Token wählen.
- **Erwartet:** (Engine-Konvention: Tokens kommen nie in Hand/Ablage/Deck, sondern werden gelöscht) Token wird nicht angeboten oder verschwindet.
- **Beobachtet:** Der Token wird angeboten, und „Mummy Token" liegt danach als Karte in meiner Hand.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/12-sparkfly-worker-token-in-die-hand.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_sparkfly-shared.js:collectNonHeroBoardTargets` filtert Tokens nicht; `stealBoardCardToHand` → `engine.handZugangSync(ps, cardName)` ohne Token-Sonderfall.

### A05-13 · Sparkfly Worker: dauerhaft übernommene Fremdkreatur landet beim Abwerfen in MEINER Ablage · Stufe B
- **Karten:** Sparkfly Worker (und Queen-Gabe „Worker"), `_sparkfly-shared.js:stealBoardCardToHand`
- **Voraussetzungen / Aufbau:** Seite 0 hat per `actionTransferCreature` (dauerhafte Übernahme, wie Dark Gear/Hunting/Chilly Wizard) eine Kreatur von Seite 1 übernommen (owner 0, originalOwner 1); Queen im Spiel.
- **Schritte:** 1. Sparkfly Worker beschwören, die übernommene Kreatur wählen. 2. Die Handkarte abwerfen.
- **Erwartet:** (Ruling CARD_API „GESTOHLENE KARTEN GEHEN IN DIE ABLAGE IHRES BESITZERS", Liste der getaggten Karten nennt „Sparkfly"; Brett-Übernahmen laufen über das eingefrorene `originalOwner`) Die Karte gehört weiter dem Deck von Seite 1 → Ablage von Seite 1.
- **Beobachtet:** Handinstanz trägt `originalOwner` 0 → die Karte landet in meiner Ablage.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/13-sparkfly-worker-uebernommene-kreatur-falsche-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_sparkfly-shared.js:stealBoardCardToHand` setzt `newInst.originalOwner = targetInst.owner` (nach Übernahme = Kontrolleur) statt `targetInst.originalOwner ?? targetInst.owner`.

### A05-14 · Raise the Minions! + Skeleton King Skullmael: Bonus hängt von der Wahlreihenfolge ab · Stufe C
- **Karten:** Raise the Minions! (`raise-the-minions.js`), Skeleton King Skullmael (`skeleton-king-skullmael.js`)
- **Voraussetzungen / Aufbau:** Ablage: Skeleton Archer + Skeleton King Skullmael; Raise the Minions! mit beiden.
- **Schritte:** 1. Zauber wirken, Auswahl Archer>Skullmael bzw. Skullmael>Archer.
- **Erwartet:** Text: „Choose up to 3 … place them into free Support Zones" – eine gemeinsame Platzierung; Skullmael: „While you control this Creature that was summoned from the discard pile, Skeleton Creatures summoned from the discard pile may use their active effects the turn they are summoned". Lesart A: nacheinander (Skript); Lesart B: gleichzeitig → Reihenfolge egal.
- **Beobachtet:** Archer>Skullmael: Archer ohne Eile. Skullmael>Archer: Archer mit Eile (`_hasHaste`).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/14-raise-the-minions-skullmael-reihenfolge.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** `raise-the-minions.js` legt die gewählten Karten in Wahlreihenfolge einzeln; Skullmaels Aura wirkt nur auf danach eintretende Skelette (`onCardEnterZone`).
- **Frage an Al:** Sollen bei Raise the Minions! alle im selben Wurf gelegten Skelette den Skullmael-Bonus bekommen, egal in welcher Reihenfolge (ja = gleichzeitig / nein = wie jetzt)?

### A05-15 · Vacarn + The Bonegrinder: Vacarns Löschen verdrängt das Bonegrinder-Ziehen · Stufe C
- **Karten:** Vacarn, the Dark Goblin Necromancer (`vacarn-the-dark-goblin-necromancer.js`), The Bonegrinder
- **Voraussetzungen / Aufbau:** Held 0 = Vacarn, Bonegrinder in der Area, ein Skelett in Vacarns Zone und eines in der Zone eines anderen Helden.
- **Schritte:** 1. Beide Skelette besiegen.
- **Erwartet:** Vacarn: „Creatures in this Hero's Support Zones that are defeated are deleted."; Bonegrinder: „when a Skeleton would be sent to your discard pile, you may delete it to draw 1". Zwei Ersetzungen – Lesart A: Vacarn zuerst, Bonegrinder entfällt; Lesart B: Spieler wählt die Reihenfolge, Bonegrinder darf ziehen (Ergebnis „gelöscht" ist dasselbe).
- **Beobachtet:** Skelett in Vacarns Zone: gelöscht, KEINE Bonegrinder-Abfrage, kein Ziehen. Skelett in anderer Zone: Abfrage + Ziehen.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/15-vacarn-bonegrinder-konkurrenz.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** Vacarn setzt `leaving._redirectToDeleted = true` in `onCardLeaveZone`; Bonegrinders Handler bricht bei gesetztem Flag ab (feste Hook-Reihenfolge).
- **Frage an Al:** Soll The Bonegrinder auch dann ziehen dürfen, wenn Vacarn das Skelett ohnehin löscht (ja/nein)?

### A05-16 · The Bonegrinder auf der Hand löst bereits Löschen+Ziehen aus · Stufe B
- **Karten:** The Bonegrinder (`the-bonegrinder.js`)
- **Voraussetzungen / Aufbau:** Hand [The Bonegrinder] (nicht gespielt); ein eigenes Skelett auf dem Brett.
- **Schritte:** 1. Skelett besiegen lassen. 2. Auf die Abfrage „Delete it instead and draw 1 card?" antworten.
- **Erwartet:** (Kartentext: Dauereffekt der Area „Up to 5 times per turn, when a Skeleton would be sent to your discard pile …") Eine nur auf der Hand liegende Bonegrinder reagiert nicht.
- **Beobachtet:** Die Hand-Kopie fragt, löscht das Skelett und lässt ziehen. Hand- und Area-Kopie haben je ein eigenes 5er-Limit pro Zug.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/16-bonegrinder-handkopie-wirkt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-bonegrinder.js` `activeIn: ['hand','area']` (für die Stufensenkung nötig); die Hooks `onCardLeaveZone`/`onDiscard`/`onMill` prüfen `ctx.cardZone` nicht.

### A05-17 · The Bonegrinder vergleicht den Kontrolleur statt die Ablage-Seite (gestohlene Skelette) · Stufe B
- **Karten:** The Bonegrinder (`the-bonegrinder.js` `onCardLeaveZone`)
- **Voraussetzungen / Aufbau:** Bonegrinder in meiner Area. (a) Mein Skelett, vom Gegner per `actionStealCreature` gestohlen, stirbt. (b) Ein Gegner-Skelett, von mir gestohlen, stirbt.
- **Schritte:** 1. Skelett besiegen (`actionDestroyCard`). 2. Abfrage beantworten.
- **Erwartet:** (Kartentext „sent to YOUR discard pile"; Ruling „Gestohlene Karten gehen in die Ablage ihres Besitzers") (a) geht in meine Ablage → Bonegrinder darf fragen; (b) geht in die Ablage des Gegners → keine Abfrage, ich ziehe nichts.
- **Beobachtet:** (a) keine Abfrage, Skelett liegt in meiner Ablage. (b) Abfrage; das Gegner-Skelett wird in den Gelöscht-Stapel des GEGNERS umgeleitet und ich ziehe 1.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/17-bonegrinder-gestohlene-skelette.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-bonegrinder.js` Z. ~197: `targetController = leaving.controller ?? leaving.owner; if (targetController !== myController) return;` – müsste die Ablage-Seite (`originalOwner`/`owner`) prüfen.

### A05-18 · Raise the Minions! beendet den Zug, der Kartentext nennt das nicht · Stufe C
- **Karten:** Raise the Minions! (`raise-the-minions.js`)
- **Voraussetzungen / Aufbau:** Hand [Raise the Minions!], Ablage [Skeleton Archer], Zug 5.
- **Schritte:** 1. Zauber wirken, ein Skelett wählen.
- **Erwartet:** Kartentext (`data/cards.json`): „Choose up to 3 "Skeleton" Creatures from your discard pile and place them into free Support Zones of the user." – keine Zugende-Klausel (anders als bei Tanuki Escape/Premonition: „Immediately end your turn afterwards"). CARD_API (v673, „Zugende aus einem Artefakt") führt „Raise the Minions" aber in der Liste der Karten, die den Zug beenden.
- **Beobachtet:** Nach der Auflösung ist der Zug beendet (Zug 5 → 6, Gegner aktiv). Das Skript-Kommentar behauptet „Card text: this Spell ends the caster's turn after resolving".
- **Repro:** `docs/niche-tests/repro/A05-skeletons/18-raise-the-minions-beendet-den-zug.js` (✗ = Text-Lesart nicht erfüllt)
- **Vermutete Ursache:** `raise-the-minions.js` letzte Zeilen: `gs._spellEndsTurn = true;`.
- **Frage an Al:** Soll Raise the Minions! den Zug beenden (ja = wie jetzt, Kartentext in cards.json wäre zu ergänzen / nein = Zeile entfernen)?

### A05-19 · Skeleton Bard: Zusatznutzung funktioniert auch für negierte oder diesen Zug beschworene Skelette · Stufe B
- **Karten:** Skeleton Bard (`cards/effects/skeleton-bard.js`) mit Skeleton Mage (Beispiel; gilt für jedes Skelett mit Kreatureneffekt)
- **Voraussetzungen / Aufbau:** Skeleton Bard (alt) + Skeleton Mage („draw 2, discard 1"), Hand 2 Karten, Main Phase. (a) Mage negiert; (b) Mage diesen Zug beschworen.
- **Schritte:** 1. Bard aktivieren, Mage wählen.
- **Erwartet:** (Kartentext „It may immediately use its once per turn effect an additional time"; Engine: negierte/eingefrorene/betäubte Kreaturen und am Beschwörungstag frische Kreaturen dürfen ihren Effekt nicht nutzen – `isCreatureEffectSuppressed`, `getActivatableCreatures`) Eine „zusätzliche" Nutzung setzt voraus, dass die Kreatur ihren Effekt überhaupt nutzen dürfte → nicht wählbar.
- **Beobachtet:** In beiden Fällen wird das Mage angeboten und zieht 2 / legt 1 ab (Hand +1). (b) ist die schwächere Lesart (Bard könnte absichtlich die Eile geben), (a) widerspricht dem Negations-Vertrag.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/19-skeleton-bard-umgeht-negation-und-sickness.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `skeleton-bard.js` `eligibleTargets()` prüft nur Kontrolle, Face-up, `creatureEffect` und das `canActivateCreatureEffect` des Ziels; `onCreatureEffect` ruft das Ziel-Skript direkt, ohne `engine.isCreatureEffectSuppressed(inst)` und ohne Summoning-Sickness-Prüfung.

### A05-20 · Winged Skeleton antwortet nicht auf Burn/Negate-Wahl und nicht auf Dive Bomblebee / Sparkfly Worker · Stufe B
- **Karten:** Winged Skeleton (`winged-skeleton.js`), Täter: Burning Skeleton, Skeleton Death Knight, Dive Bomblebee, Sparkfly Worker
- **Voraussetzungen / Aufbau:** Winged Skeleton + Skeleton Archer auf meiner Seite; Täter-Karte des Gegners wählt den Archer.
- **Schritte:** 1. Gegner aktiviert Burning Skeleton / Skeleton Death Knight auf den Archer. 2. Dive Bomblebee-Auslöser wählt den Archer. 3. Gegner beschwört Sparkfly Worker (Queen im Spiel) und wählt den Archer.
- **Erwartet:** (Kartentext „when a "Skeleton" Creature you control is chosen by an opponent's card or effect, you may return that Creature back to your hand to negate the card or effect") Bei jeder Wahl ein Angebot; Kontrolle Skeleton Reaper/Archer ✓.
- **Beobachtet:** Kein Angebot (0 Abfragen), die Wirkung landet: Archer ist verbrannt bzw. negiert, liegt unten im Deck bzw. in der Gegner-Hand.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/20-winged-skeleton-luecken.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `winged-skeleton.js` hört nur auf `beforeCreatureAffected` (Zerstören/Bewegen/Gift/Heilen, aus `actionDestroyCard`/`actionMoveCard`/`actionApplyCreaturePoison`/`actionHealCreature`) und `beforeCreatureDamageBatch` (Einzeltreffer). `applyCreatureStatus`/`actionNegateCreature` sowie die rohen Zonen-Wege in `dive-bomblebee.js` und `_sparkfly-shared.stealBoardCardToHand` rufen den Haken nie.

### A05-21 · Skeleton Demon zählt die angesagte statt der tatsächlich gezogenen Kartenzahl · Stufe B
- **Karten:** Skeleton Demon (`cards/effects/skeleton-demon.js` `beforeDrawBatch`)
- **Voraussetzungen / Aufbau:** Seite 0: Skeleton Demon; Seite 1: Skeleton Mage („draw 2 cards, discard 1"). (a) Gegner-Deck 1 Karte, (b) Gegner-Deck leer.
- **Schritte:** 1. Gegner aktiviert Skeleton Mage.
- **Erwartet:** (Kartentext „Whenever your opponent draws … cards … deal 50 damage times the number of cards") (a) 50 Schaden, (b) kein Auslöser (0 Karten).
- **Beobachtet:** (a) 100 Schaden, (b) 100 Schaden (Prompt „Deal 100 damage (50 × 2)").
- **Repro:** `docs/niche-tests/repro/A05-skeletons/21-skeleton-demon-zaehlt-angesagte-statt-gezogene-karten.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `skeleton-demon.js`: `beforeDrawBatch` → `offerDamage(ctx, ctx.amount)` nimmt die Ansage vor dem Ziehen (`amount`), nicht die Zahl der wirklich gezogenen Karten (Deckgröße, Sperren).

### A05-22 · Skeleton Necromancer: Abwerfen als Kosten vor der Wahl? (Wortlaut „discard a card to choose …") · Stufe C
- **Karten:** Skeleton Necromancer (`skeleton-necromancer.js`)
- **Voraussetzungen / Aufbau:** Hand [Skeleton Archer], Ablage ohne Skelette, Skeleton Necromancer (alt) auf dem Brett, Main Phase.
- **Schritte:** 1. Necromancer aktivieren.
- **Erwartet:** Text „You may once per turn discard a card to choose a "Skeleton" Creature … from your discard pile and place it …": Lesart B – Abwerfen ist die Kosten-Vorstufe, das abgeworfene Skelett wäre wählbar; Lesart A (Skript) – erst wählen, dann abwerfen; ohne Skelett in der Ablage nicht aktivierbar.
- **Beobachtet:** Nicht aktivierbar (`canActivateCreatureEffect` verlangt ein Skelett im Ablagestapel; Reihenfolge Wahl → Zone → Abwurf).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/22-skeleton-necromancer-kosten-vor-wahl.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** `skeleton-necromancer.js` `eligibleTutorTargets`/`onCreatureEffect` (Schritt 1 Galerie, Schritt 3 Abwurf).
- **Frage an Al:** Soll das als Kosten abgeworfene Skelett vom Skeleton Necromancer sofort wieder wählbar sein (ja/nein)?

### A05-23 · „Deepsea Skeleton" zählt für keine Skeleton-Karte als „Skeleton" Creature · Stufe C
- **Karten:** `_skeleton-shared.js:isSkeletonCreature` (alle Skeleton-Karten), Deepsea Skeleton (Archetyp „Deepsea")
- **Voraussetzungen / Aufbau:** Ablage [Deepsea Skeleton], Hand [Raise the Minions!, The Bonegrinder].
- **Schritte:** 1. Raise the Minions! spielen / Galerie ansehen.
- **Erwartet:** Text: „Skeleton" Creatures. Lesart A (Skript): „Skeleton" = Archetyp-Feld `Skeletons` (+ Loyal Bone Dog als ausdrückliche Ausnahme). Lesart B (Namensregel): jede Kreatur mit „Skeleton" im Namen ist ein „Skeleton" Creature, also auch „Deepsea Skeleton" (zugleich „Deepsea").
- **Beobachtet:** Raise the Minions! ist mit nur einem Deepsea Skeleton in der Ablage nicht spielbar; Bonegrinder-Stufenrabatt/-Löschung, Necromancer-Tutor, Skullmael-Aura, Bard, Winged Skeleton ignorieren ihn ebenfalls.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/23-deepsea-skeleton-zaehlt-nicht-als-skeleton.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** `_skeleton-shared.js` `isSkeletonCreature`: `cd.archetype === "Skeletons"` || `TREATED_AS_SKELETON` (nur Loyal Bone Dog).
- **Frage an Al:** Soll „Deepsea Skeleton" als „Skeleton" Creature zählen (ja/nein)?

### A05-24 · Hammer Skeleton kann ein an einen Helden angehängtes Crimson Web nicht wählen · Stufe B
- **Karten:** Hammer Skeleton (`hammer-skeleton.js` `collectTargets`), Crimson Web
- **Voraussetzungen / Aufbau:** Crimson Web hat durch einen Fire-Bolts-Angriff den Angreifer-Helden (Seite 0, Held 0) „webbed" und liegt in dessen Support Zone; Hammer Skeleton auf Seite 1.
- **Schritte:** 1. Hammer Skeleton aktivieren / `canActivateCreatureEffect` prüfen.
- **Erwartet:** (Kartentext „choose a Spell attached to a Hero or an Area in play and send it to the discard pile"; Crimson Web: „attach this card to the attacker", cardType Spell) Das angehängte Crimson Web ist ein wählbares Ziel; Held wird frei (webbed fällt, Karte in die Ablage ihres Besitzers).
- **Beobachtet:** Hammer Skeleton ist nicht aktivierbar (keine Ziele): der Filter lässt nur Spells mit Subtyp „Attachment" zu, Crimson Web hat Subtyp „Surprise".
- **Repro:** `docs/niche-tests/repro/A05-skeletons/24-hammer-skeleton-crimson-web.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `hammer-skeleton.js` `collectTargets()`: `inst.zone === "support" && sub === "attachment"`.

### A05-25 · Crimson Web hängt an den Wirtshelden, wenn ein Skeleton Priest den Zauber wirkt · Stufe B
- **Karten:** Crimson Web (`crimson-web.js` `surpriseTrigger`/`onSurpriseActivate`), Skeleton Priest / Skeleton Wizard (Kreatur als Wirker, `gs._spellCasterCreature`)
- **Voraussetzungen / Aufbau:** Seite 0: Skeleton Priest (Held 0), Ablage [Fire Bolts]; Seite 1: Held 0 mit verdecktem Crimson Web (Decay Magic 3).
- **Schritte:** 1. Priest wirkt Fire Bolts aus der Ablage auf Held 0 der Seite 1.
- **Erwartet:** (Kartentext „attach this card to the attacker, if possible"; Skript-Kopf „Source must be an opponent Hero"; Engine-Konvention bei Kreaturen-Würfen: der Angreifer ist die wirkende Kreatur, vgl. Booby Trap/Frost Rune gegen Demon's Gate) Der Zauber wird negiert; da der Angreifer eine Kreatur ist, kann das Web nicht anhängen (oder gar nicht erst auslösen) – der Wirtsheld bleibt frei.
- **Beobachtet:** Der Zauber wird negiert, das Web wird an den WIRTSHELDEN des Priests (Seite 0, Held 0) gehängt: `webbed` (dauerhaft, kann nicht handeln, Abilities negiert) – ein Held, der den Zauber gar nicht gewirkt hat.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/25-crimson-web-an-wirtsheld-bei-kreaturenwurf.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `crimson-web.js` liest `sourceInfo.owner`/`heroIdx` (Wirtsheld) und prüft `_creatureCasterForSource` nicht.

### A05-26 · Baby Spider: eine andere Baby Spider zählt nicht als „another Spider Creature" · Stufe B
- **Karten:** Baby Spider (`baby-spider.js` `controlsAnotherSpider`)
- **Voraussetzungen / Aufbau:** Main Phase 2 (keine Aktion mehr), Hand [Baby Spider], auf dem Brett nur eine Baby Spider (Kontrolle: Cute Spider).
- **Schritte:** 1. Zweite Baby Spider beschwören.
- **Erwartet:** (Kartentext „While you control another "Spider" Creature, summoning this Creature counts as an additional Action"; „only 1 Baby Spider with this effect per turn" setzt mehrere Baby Spiders voraus) Mit liegender Baby Spider ist sie als Zusatzaktion beschwörbar, wie mit liegender Cute Spider.
- **Beobachtet:** Mit Cute Spider ✓, mit Baby Spider wird die Beschwörung abgelehnt (`play` false).
- **Repro:** `docs/niche-tests/repro/A05-skeletons/26-baby-spider-andere-baby-spider-zaehlt-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `baby-spider.js` Z. ~51: `if (inst.name === CARD_NAME) continue;` schließt ALLE Baby Spiders aus (die zu beschwörende Karte liegt zu diesem Zeitpunkt ohnehin nicht auf dem Brett).

### A05-27 · Spinnen-Kosten „send N Surprises": offen liegende Spider Silk Bridge zählt nicht mit · Stufe C
- **Karten:** Box/Brain/Crimson Skull/Diamond Spider (`_spider-shared.js listOwnFaceDownSurprises`), Spider Silk Bridge (bleibt offen liegen)
- **Voraussetzungen / Aufbau:** Hand [Box Spider]; Surprise Zonen: eine offene Spider Silk Bridge + zwei verdeckte Booby Traps; Main Phase.
- **Schritte:** 1. Box Spider beschwören (3 Surprises als Kosten).
- **Erwartet:** Text: „send 3 Surprises you control". Lesart B (Wortlaut): jede kontrollierte Surprise, auch die offene Silk Bridge; Lesart A (Skript): nur verdeckte.
- **Beobachtet:** Nicht beschwörbar (nur 2 zahlbare Surprises), `listOwnFaceDownSurprises` lässt offene aus.
- **Repro:** `docs/niche-tests/repro/A05-skeletons/27-spinnenkosten-offene-surprise.js` (✗ = Lesart B nicht erfüllt)
- **Vermutete Ursache:** `_spider-shared.js:listOwnFaceDownSurprises` `if (!inst.faceDown) continue;`.
- **Frage an Al:** Darf eine offen liegende Spider Silk Bridge als Kosten für Box/Brain/Crimson Skull/Diamond Spider gesendet werden (ja/nein)?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Alleria, the Queen of Spiders | L0 gelesen | noch nicht bearbeitet |
| Baby Spider | L2 gezielt | Zusatzaktion mit anderer Spinne ✓; mit anderer Baby Spider ✗ (→ 26); Opfer → Spider Avalanche + Crimson Skull + Diamond ✓ (siehe OK-Liste); Blob-Auslösung (→ 08) |
| Bomblebee | L1 Standard | Zielwahl nach Gegnertod ✓, Hero-Treffer löst Jumper Spider aus ✓, Fuse-Lauf ✓ |
| Box Spider | L2 gezielt | Kosten 3 Surprises: Abbruch ✓, Bestätigen ✓; offene Silk Bridge (→ 27 C); Zugende-Tutor ✓; Blob (→ 08) |
| Brain Spider | L2 gezielt | Kontrolle vs. Besitzer: eigene ✓, gestohlene (Kontrolleur profitiert) ✓, negiert ✓, vom Angreifer kontrolliert ✓ |
| Burning Fuse | L2 gezielt | Frisch beschworene Bee ✗ (→ 01); reaktiver Weg ✓; proaktiv/Time Bomblebee (→ 07 C) |
| Burning Skeleton | L1 Standard | Burn auf Gegner-Skelett (Winged-Lücke → 20) |
| Carpet Bomblebee | L1 Standard | trifft alle 3 Helden mit 80 ✓ (Fuse-Lauf), Jumper-Spider-Surprise wird ausgelöst ✓ |
| Cloudy Slime | L1 Standard | Blob-Auslösung ohne Wirkung (→ 10) |
| Bomblebee Cluster | L2 gezielt | Stufe ✗ (→ 05), gleicher Name (→ 06 C), summonLocked danach ✓, zwei Beschwörungen ✓ |
| Cosmic Skeleton | L1 Standard | Treffer auf Held mit Jumper Spider löst Surprise aus ✓ (150 Schaden) |
| Crimson Skull Spider | L1 Standard | Blob-Auslösung ohne Effekt (→ 08) |
| Crimson Web | L2 gezielt | Held-Angriff: Web hängt am Angreifer, negiert den Zauber ✓; Priest-Wurf: hängt am Wirtsheld ✗ (→ 25); Hammer Skeleton (→ 24) |
| Cute Spider | L0 gelesen | noch nicht bearbeitet |
| Diamond Spider | L1 Standard | Blob-Auslösung ohne Effekt (→ 08) |
| Dive Bomblebee | L2 gezielt | Token ✗ (→ A05-02), gestohlene Kreatur ✗ (→ A05-03); Areas/Surprises/Permanents werden nie angeboten (Skriptkommentar: bewusst) |
| Fiery Slime | L0 gelesen | noch nicht bearbeitet |
| Hammer Skeleton | L2 gezielt | Crimson Web nicht wählbar ✗ (→ 24); Areas und Attachments sonst nicht gesondert |
| Hardy Slime | L0 gelesen | noch nicht bearbeitet |
| Skeleton Healer | L1 Standard | Heilung auf Held des Gegners öffnet das Surprise-Fenster (Jumper Spider) – Engine-Konvention „gewählt" |
| Hive's Crown | L2 gezielt | Hand-Queen ✓, Deck-Queen bei Opfer „nicht diesen Zug" ✓, Option Hand/Deck ✓, frisches Opfer + nur Deck-Queen nicht spielbar ✓, Gold/Ablage ✓ |
| Icy Slime | L0 gelesen | noch nicht bearbeitet |
| Infinitely Reproducing Slime | L0 gelesen | noch nicht bearbeitet |
| Jumper Spider | L2 gezielt | Aktivierung: zieht 2, landet im Support ✓; Ping-Pong über 4 echte Zugwechsel ✓ (owner/controller wechseln, originalOwner bleibt); kein freier Platz: bleibt ✓ |
| Raise the Minions! | L2 gezielt | Drei Skelette in drei Zonen ✓; beendet den Zug (Text sagt es nicht) → siehe C-Frage unten; Reihenfolge mit Skullmael (→ 14) |
| Rocky Slime | L0 gelesen | noch nicht bearbeitet |
| Sandy Blob | L2 gezielt | Fünf Spinnen lösen ohne Effekt aus ✗ (→ 08), Rancher-Doppelaktivierung ✗ (→ 09), Cloudy ohne Wirkung (→ 10 C), Cap 3/Zug nicht gesondert, Skeleton Archer (kein onPlay) löst korrekt nicht aus ✓ |
| Shadowy Slime | L0 gelesen | noch nicht bearbeitet |
| Shiny Slime | L0 gelesen | noch nicht bearbeitet |
| Skeleton Archer | L1 Standard | Treffer auf Held löst Surprise aus ✓ (50 Schaden); Winged-Skeleton-Angebot ✓ |
| Skeleton Bard | L2 gezielt | Negiert ✗ / frisch beschworen ✗ (→ 19); aktives Ziel ✓ |
| Skeleton Death Knight | L2 gezielt | Held (bound) und Kreatur (negated) bis zum Ende des nächsten Gegnerzugs per echtem Zugwechsel ✓; Winged-Lücke (→ 20) |
| Skeleton Demon | L2 gezielt | Regulärer Zug-Draw löst nicht aus ✓; 1 Fenster für 2 gezogene Karten ✓; Tiefe der Ansage statt echter Zahl ✗ (→ 21) |
| Skeleton King Skullmael | L2 gezielt | Aura bei Raise the Minions!/Necromancy ✓, Reihenfolgeabhängigkeit (→ 14) |
| Skeleton Mage | L0 gelesen | noch nicht bearbeitet |
| Skeleton Necromancer | L2 gezielt | Aktivierbarkeit nur mit Skelett in der Ablage; Kosten/Wahl-Reihenfolge (→ 22 C); Deepsea Skeleton (→ 23 C) |
| Skeleton Priest | L2 gezielt | 8 skalierende Destruction-Zauber (Lv ≤ 1) aus der Ablage: gleiches Ergebnis wie Held mit Destruction 1 ✓ (Fire Bolts, Burning Finger, Big Oopsie, Phoenix Tackle, Frost Breaker …); Priester stirbt am eigenen Rückstoß (Phoenix Tackle 50) wie erwartet; Anti Magic Shield reagiert auf den Priester-Wurf ✓ |
| Skeleton Reaper | L0 gelesen | noch nicht bearbeitet |
| Skeleton Skull Bat | L0 gelesen | noch nicht bearbeitet |
| Skeleton Wizard | L2 gezielt | Batterie über alle Magic-Arts-Zauber Lv ≤ 1 (Normal) aus der Hand: keine Ausnahmen/Hänger/Audit ✓ |
| Slime Rancher | L1 Standard | Shiny Slime doppelt ✓ (zieht 2×); Zusammenspiel mit Blob ✗ (→ 09) |
| Slimy Slime | L0 gelesen | noch nicht bearbeitet |
| Sparkfly Architect | L0 gelesen | noch nicht bearbeitet |
| Sparkfly Attendant | L2 gezielt | Aura beim Spielen ✓ (Gegnerschaden an Queen 0), Aura nach Tod/Zerstörung/Negation ✗ (→ 11) |
| Sparkfly Queen | L2 gezielt | Hive's-Crown-Lauf ✓, Haupteffekt (3 Sparkflies → 3 Karten, Rabatt −3 wandert beim Spielen anderer Karten mit) ✓, Necromancy/Hand-Spiel blockiert ✓, Gaben-Aura s. Attendant (→ 11) |
| Sparkfly Worker | L2 gezielt | Token → Hand ✗ (→ 12), übernommene Fremdkreatur: Ablage-Seite ✗ (→ 13), übernommene Kreatur sonst sauber ✓; Hoch-Zugriff auf eigene Fähigkeit „Summoning Magic" als Ziel wird angeboten (laut Text legal) |
| Sparky Slime | L0 gelesen | noch nicht bearbeitet |
| Spider Avalanche | L0 gelesen | noch nicht bearbeitet |
| Spider Dance | L0 gelesen | noch nicht bearbeitet |
| Spider Hive | L0 gelesen | noch nicht bearbeitet |
| Spider Silk Bridge | L1 Standard | siehe Spider-Silk-Abschnitt unten |
| Splashy Slime | L0 gelesen | noch nicht bearbeitet |
| The Bonegrinder | L2 gezielt | Hand-Kopie wirkt ✗ (→ 16), gestohlene Skelette ✗ (→ 17), Vacarn-Konkurrenz (→ 15) |
| Time Bomblebee | L2 gezielt | Counter je Gegnertod ✓, Schadens-/Zerstörungsimmunität ✓, Detonation zum Gegner-Zugbeginn per echtem endTurn ✓ (150 auf gewählte Kreatur, Counter weg), negiert ✗ (→ 04), Fuse-Ausschluss (→ 07) |
| Treasure Skeleton | L0 gelesen | noch nicht bearbeitet |
| Vacarn, the Dark Goblin Necromancer | L2 gezielt | Necromancy-Skelett nicht negiert & sofort aktiv ✓, löscht besiegte Kreaturen seiner Zonen ✓, Konkurrenz mit Bonegrinder (→ 15) |
| Winged Skeleton | L2 gezielt | Angebot bei Reaper/Archer (Einzeltreffer) ✓; kein Angebot bei Burn/Negate/Dive/Worker ✗ (→ 20) |

## Getestet & in Ordnung (Auswahl)
- Bomblebee/Carpet Bomblebee: Treffer auf Helden öffnen das Surprise-Fenster (Jumper Spider zieht 2 und landet im Support) – auch der Flächentreffer von Carpet Bomblebee.
- Burning Fuse (reaktiv, Gegner betritt Action Phase): Bomblebee 150, Carpet Bomblebee 3×80, beide besiegt, Time Bomblebee bleibt unberührt; keine Engine-Fehler.
- Time Bomblebee: 2 Gegnertode → 2 Counter, 500 Schaden und `actionDestroyCard` prallen ab; beim echten Gegner-Zugbeginn Counter weg und 150 auf die gewählte Kreatur.
- Sparkfly Queen Haupteffekt: bei 3 Sparkflies liefert der Gegner 3 passende Karten (Kategorie „Attack/Spell/Creature"), die abgebende Seite wählt, Handindex-Rabatt −3 für den Queen-Wirtshelden wandert korrekt mit, wenn eine frühere Handkarte gespielt wird.
- Necromancy kann die Sparkfly Queen aus dem Ablagestapel NICHT beschwören (canSummon greift), Spielen der Queen aus der Hand wird abgelehnt.
- Vacarn: per Necromancy gelegtes Skelett ist nicht negiert und sofort aktivierbar; sein Löschen betrifft nur die eigenen Zonen.
- Hive's Crown: Hand-Queen/Deck-Queen-Auswahl, Slot des Opfers wird belegt, Gabe des Opfers wird gestempelt; frisches Opfer + nur Deck-Queen → nicht spielbar.
- Skeleton Death Knight: Held bekommt „bound", Kreatur „negated" bis zum Ende des nächsten Gegnerzugs; zum eigenen nächsten Zug sind beide weg (Held danach `immune`).
- Skeleton Priest: Wurf aus der Ablage verhält sich wie der Wurf eines Helden mit Destruction Magic 1 (8 skalierende Zauber verglichen); Reaktionen des Gegners (Anti Magic Shield) greifen ebenfalls.
- Brain Spider: Kontrolleur, nicht Besitzer, profitiert (gestohlene Brain Spider → Seite des Kontrolleurs); negierte Brain Spider wirkt nicht; ohne sie löst die Surprise eines anderen Helden nicht aus.
- Jumper Spider: Ping-Pong über vier echte Zugwechsel (Zug 5→9) sauber, `originalOwner` bleibt 1; bei vollem Brett des neuen Zugspielers bleibt sie liegen (Log `jumper_spider_transfer_skipped`).
- Spinnen-Synergie: Baby Spider opfern aktiviert Spider Avalanche; mit Crimson Skull (+40 je Spinne) und Diamond Spider ergibt sich 20×2 + 40×2 = 120 auf alle Gegnerziele, Diamond zieht 2 – wie gerechnet.
- Box Spider: Abbruch des Kosten-Pickers lässt Hand/Surprises unverändert; Zugende-Tutor legt eine Surprise verdeckt in die leere Surprise Zone und mischt.
