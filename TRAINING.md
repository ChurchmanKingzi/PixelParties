# CPU Deck Training (ML) — Pipeline-Dokumentation

Trainiert ein **deck-spezifisches Profil** aus Self-Play-Daten und speist es
zur Laufzeit in das CPU-Gehirn ein. Erste Zieldeck: **Suicide Bombers**.
Das Verfahren ist generisch — jedes Sample-Deck kann mit denselben Befehlen
trainiert werden.

## Was gelernt wird (und was bewusst nicht)

Gelernt werden **Werte, keine Policies** — die Zahlen fließen in die
bestehende MCTS-/Eval-Maschinerie ein, die weiterhin das echte Board liest:

| Profil-Feld | Bedeutung | Läuft ein in |
|---|---|---|
| `cardValues` | Handwert pro Karte (was ist diese Karte für den Plan dieses Decks wert?) | `estimateHandCardValueFor` → Tutor-Picks (Magnetic Glove!), Discard-Entscheidungen, Hand-Term der Eval, Gallery-Sortierung |
| `timing` | Early/Mid/Late-Multiplikator pro Karte | dito, rundenabhängig |
| `pairBonuses` | Combo-Synergie zweier Karten (Same-Turn-Co-Plays, die mit Siegen korrelieren) | Handwert steigt, solange der Partner in der Hand liegt → Tutoren holen die zweite Combo-Hälfte, Discards verschonen sie |
| `abilityPriors` | (Ability → Held)-Prior für Stack-Platzierung | `scoreAbilityPlacement` |
| `equipPriors` | (Equip → Held)-Platzierungs-Prior, Semantik wie abilityPriors (Recorder: onCardEnterZone support + subtype Equipment + toHeroIdx) | `pickHeroForEquip` — NACH Ascension-Priorität und kartenseitigen Hooks (`cpuPrefersEquipTarget`/`cpuEquipTargetScore`); ein klar positiver Prior (≥4 nach Confidence) übernimmt die Wahl, negative Priors verlieren den Vergleich. Ergänzende Hard-Regeln: (1) Ascension-Equips (Arthors Sword/Circle etc.) weichen NIE auf andere Helden aus, wenn der Ziel-Held nur volle Slots hat — halten statt verbrennen. (2) Slippery Fridge hat einen eigenen cpuResponse-Intercept: Vollender-Move (Equip zum Helden, der es für die Ascension braucht) hat Top-Priorität, gegnerische Ascension-Items werden bevorzugt vom Träger weggezogen (Sabotage), eigene Ascension-Items NIE vom nicht-aufgestiegenen Träger wegbewegt (Träger-Schutz via `ascensionItems`-Export der Heldenmodule, siehe Arthor/Layn); Rest-Ziele per gelerntem equipPlacementBonus |
| `lockPenalties` | Lock-Ordering: "Karte\|lockTyp@heldBucket" — Kontext beim Ausspielen einer Lock-Karte (Boomerang, Kazena-Effekte …): Wie viele Karten des gesperrten Typs lagen noch in der Hand? Recorder erkennt Locks generisch über Flag-/Zugstempel-Diffs (itemLocked, potionLocked, creatureLocked, _artifactLockTurn, _spellLockTurn, _skillLockTurn — handLocked bewusst NICHT: transiente Resolutionssperre) | Zentral in `mctsGatedActivation`: Negativ gelerntes Gewicht → Gate-Schwellen-Aufschlag (Cap +25); ab +10 wird auch `alwaysCommit` ausgesetzt. „Spiele Boomerang zuletzt" entsteht emergent: Früh im Zug ist der Bucket hoch (Strafe aktiv), nach dem Abarbeiten der anderen Artefakte fällt er auf 0-1 und die Karte committet normal |
| `reviveTargets` / `reviveAbilities` | Zustandsbedingter Wert von Revive-Karten: WER wiederbelebt wird (Identität) und WAS er dann casten kann (Ability-Stacks zum Revive-Zeitpunkt, anteilig zum Level) | `estimateHandCardValueFor`, aber NUR wenn gerade ein eigener Held besiegt ist — mit vollem Team bleibt Golden Ankh niedrig bewertet und discardbar, mit toter Nao samt Support Magic 3 wird er zum Top-Tutor-Ziel |

**Gegner-Identität ist absichtlich KEIN Feature.** Das Profil beschreibt,
wie man das eigene Deck pilotiert — nicht, wie man Deck X schlägt. Deshalb
generalisiert es auf menschliche Gegner mit unbekannten Decks.

Ein Profil aktiviert sich nur, wenn das **Helden-Trio** der CPU exakt zum
Profil passt (reihenfolge-unabhängig). Menschliche Spieler triggern nie ein
Profil für ihre Seite.

## Die drei Schritte

### 1. Daten sammeln (Self-Play, Profile AUS)

```bash
PP_TRAIN=1 PP_TRAIN_GAMES=400 node --max-old-space-size=6144 --expose-gc server.js
```

Kein Socket-Server, keine Datenbank-Zugriffe — läuft komplett headless.
Rotiert das gepinnte Deck round-robin gegen **alle anderen Sample-Decks**
(37 Gegner), wechselt Sitzplatz und Startspieler. Output:
`data/training/<deck>-<timestamp>.jsonl`, eine Zeile pro Spiel.

Env-Optionen:

| Variable | Default | Zweck |
|---|---|---|
| `PP_TRAIN_DECK` | `Suicide Bombers` | Zu trainierendes Deck (Namens-Substring reicht) |
| `PP_TRAIN_GAMES` | `200` | Anzahl Spiele |
| `PP_TRAIN_HORIZON` | `2` | Rollout-Horizont während Training (niedriger = schneller) |
| `PP_MCTS_BUDGET_MS` | `20000` | MCTS-Budget pro Entscheidung; `4000` ≈ 3–4× Durchsatz bei leicht schwächerem Piloten |
| `PP_MCTS_PULLS` | `80` | UCB1-Pull-Cap; `24` passend zu 4000ms |
| `PP_TRAIN_OUT` | auto | Expliziter Output-Pfad |

Mehrere Läufe sind **konkatenierbar** — dem Trainer einfach mehrere
JSONL-Dateien übergeben. Richtwert: 300–500 Spiele für ein brauchbares
erstes Profil, 1000+ für stabile Pair-Bonuses (Paare brauchen Support).
Ein Overnight-Lauf mit Default-Budget liefert die sauberste Datenbasis.

### 2. Profil trainieren

```bash
node scripts/train-deck-profile.js data/training/suicidebombers-*.jsonl
```

L2-regularisierte logistische Regression: Spielausgang gegen das, was das
Deck im Spiel getan hat (Plays pro Turn-Bucket, Same-Turn-Paare, finale
Ability-Platzierung; `wentFirst` und Spiellänge als absorbierte
Kovariaten). Features mit zu wenig Support (< max(6, 3 % der Spiele))
werden verworfen — ein Modell mit so wenigen Parametern *kann* keine
Matchup-Exploits auswendig lernen.

Output: `data/cpu-profiles/<deck-slug>.json` + Konsolen-Report
(Top-Karten, gelernte Combos, Platzierungs-Prioren, Win-Rates pro Gegner).

### 3. Verifizieren — Spiegel-A/B (Profil vs Baseline, empfohlen)

```bash
PP_TRAIN=1 PP_TRAIN_AB=1 PP_TRAIN_GAMES=100 node --max-old-space-size=6144 --expose-gc server.js
```
(oder im Orchestrator: `--ab 100` — läuft dann automatisch nach jedem
Deck-Training.)

Der härteste Wirksamkeits-Test: **gleiches Deck auf beiden Seiten**,
eine Seite pilotiert mit dem Profil, die andere mit dem nackten
MCTS-Baseline-Gehirn (seitengetrennte Profil-Maske,
`engine._profileAllowedSide`). Deckstärke und Matchup-Glück kürzen sich
komplett heraus — gemessen wird reine Pilotenqualität. Profil-Seite und
Startspieler alternieren pro Spiel. Am Ende druckt der Lauf die Bilanz
mit 95-%-Konfidenzintervall; A/B-Spiele werden mit `abMode` gestempelt
und vom Trainer hart aus Trainingsdaten gefiltert.

Statistik-Ehrlichkeit: Bei n=100 ist das CI ±~10 Punkte — ein
+5-Punkte-Effekt ist damit nicht „beweisbar", nur indiziert. Neben der
Winrate lohnt der Blick auf **Struktur-Metriken** (z. B. Wincon-
Erreichungsrate): Erste Messung Dance of the Butterflies: Profil 57 %
Spiegel-Winrate (±9,7), aber **cardinal_beast-Siege 43:19** — das
Profil gewinnt nicht nur etwas öfter, es spielt den Deck-Plan mehr als
doppelt so konsequent zu Ende, und dieser Unterschied ist auch bei
n=100 hochsignifikant (p≈0,001).

### 3b. Alternativ: Feld-Eval (PP_TRAIN_EVAL)

```bash
PP_TRAIN=1 PP_TRAIN_EVAL=1 PP_TRAIN_GAMES=150 node --max-old-space-size=6144 --expose-gc server.js
```

Identischer Batch, aber das Profil ist aktiv. Win-Rate gegen den
Datensammel-Lauf vergleichen. Eval-Output (`...-EVAL-...jsonl`) **nicht**
zurück ins Training füttern (off-baseline Policy).

Danach ist das Profil automatisch live: `_deck-profile.js` lädt beim
Serverstart alle `data/cpu-profiles/*.json`; sobald ein Spieler gegen
Suicide Bombers antritt, greift es. Neu trainieren → JSON ersetzen →
Server neu starten (oder `reloadProfiles()`).

## Architektur / geänderte Dateien

```
cards/effects/_train-recorder.js   NEU — Hook-Observer, zeichnet Plays/Paare/Ability-Endstand auf
cards/effects/_deck-profile.js     NEU — Laufzeit-Loader + Lookup-API
scripts/train-deck-profile.js      NEU — Trainer (Logistic Regression, dependency-frei)
server.js                          PP_TRAIN-Batch-Runner (Modul-Scope, ohne DB);
                                   afterArtifactUsed-Hook in doUseArtifactEffect
                                   (One-Shot-Artefakte wie Magnetic Glove waren
                                   vorher für Observer unsichtbar)
cards/effects/_cpu.js              Profil-Integration in estimateHandCardValueFor
                                   (70/30-Blend + Pair-Bonus) und
                                   scoreAbilityPlacement (additiver Prior);
                                   PP_MCTS_BUDGET_MS/PP_MCTS_PULLS Env-Knobs;
                                   DEBUG_FORCE_YEETING_ON_CPU_TURN_2 → false (!)
```

Der Yeeting-Debug-Flag stand noch auf `true` — jede CPU bekam in Runde 2
ein The Yeeting in die Hand gedrückt. Für Training UND Live-Spiele jetzt
deaktiviert.

## ε-Exploration: Nie gespielte Karten lernbar machen

Das fundamentale Limit der On-Policy-Datensammlung: Die Regression kann
nur Linien bewerten, die der Pilot tatsächlich geht. Der Extremfall
Depths of the Cosmos: Die namensgebende Engine-Karte **The Cosmic
Depths** wurde in 100 Baseline-Spielen dreimal gespielt, ein Drittel
des Decks nie — egal wie viele Spiele man sammelt, das Profil bleibt
über diese Karten stumm.

**Aktivierung:** `PP_TRAIN_EXPLORE=0.15` (bzw. `--explore 0.15` im
Orchestrator). Wirkt an zwei Stellen:

- **Action Phase:** Mit Wahrscheinlichkeit ε wird der
  *Novelty-Kandidat* an die Spitze der Rangliste gezogen — die legale
  Karte mit den wenigsten historischen Versuchen — statt des
  MCTS-Favoriten. Die restliche Rangliste bleibt als Fallback-Kette.
- **Main-Phase-Gates:** Mit Wahrscheinlichkeit ε wird eine Aktivierung
  committed, die das Gate sonst geskippt hätte (Engine-/Setup-Karten
  ohne Sofort-Payoff).

Drei Zutaten, die sich empirisch alle als notwendig erwiesen haben
(jede Zwischenstufe wurde getestet und war unzureichend):

1. **Novelty-Gewichtung statt Uniform:** Uniformes ε verpufft an den
   ohnehin gut erforschten Karten (Test: TCD trotz ε=0.2 weiterhin 0
   Plays in 25 Spielen).
2. **Historisches Seeding:** Der Batch-Runner liest beim Start die
   Resume-JSONL und seedet die Versuchszähler mit den Play-Summen des
   gesamten Datensatzes. Ohne Seeding sind nach jedem Prozessstart
   *alle* Karten „novel" und die häufigen fressen die Explores wieder
   auf. Die Zähler werden NUR mit Live-Versuchen fortgeschrieben —
   MCTS-Rollout-Tries zählen nicht (sonst spiegeln die Zähler binnen
   eines Spiels die Policy-Frequenz und das Signal ist zerstört).
3. **Defizit-Boost:** Enthält die Kandidatenliste eine massiv
   unter-explorierte Karte (≤ max(2, 5 % des Maximums)), steigt die
   Explorationswahrscheinlichkeit auf min(0.5, 3ε) — sonst verstreicht
   die seltene Phase, in der die tote Karte überhaupt castbar in der
   Hand liegt, meist ungenutzt.

Messreihe (Depths of the Cosmos, The Cosmic Depths, % der Spiele):
Baseline 3 % → uniform ε=0.2: 0 % → Novelty ohne Seeding: 0 % →
Novelty + Seeding: 4 % → + Defizit-Boost: **11 %**. Hochgerechnet auf
300 Sammel-Spiele: ~30+ Spiele mit der Karte → Support-Filter sicher
überschritten, echte „gespielt → Ausgang"-Gewichte.

**Regeln für den Einsatz:**

- Explorations-Spiele sind off-policy und werden im Record mit
  `exploreEps` gestempelt. Sie gehören ins **Training**, niemals in
  **Eval-Läufe** — in `PP_TRAIN_EVAL=1` ist Exploration hart
  deaktiviert (mit Warnung).
- Ehrliche Grenze: Exploration erschließt Karten, die *legal spielbar,
  aber nie gewählt* sind. Bedingungsgebundene Karten (Coffee braucht
  einen eigenen Helden mit Debuffs, Reactions brauchen ihre Trigger)
  bleiben bei 0 — korrekt, denn ihre Bedingung tritt in diesen
  Matchups schlicht nicht ein. Solche Karten brauchen `cpuMeta`-Hints
  oder Regel-Anpassungen, keine Statistik.
- Debug-Werkzeuge: `PP_DEBUG_FORCE_CARD="Kartenname"` zwingt eine
  Karte in Runde 2 in die CPU-Hand und aktiviert einen Filter-Trace in
  der Kandidaten-Enumeration (loggt bei `PP_TRAIN_VERBOSE=1`, an
  welchem Filter die Karte stirbt). `PP_TRAIN_VERBOSE=1` schaltet das
  CPU-Log in Trainingsläufen ein. `PP_TRAIN_OPP="Name1,Name2"`
  beschränkt die Gegner-Rotation auf bestimmte Decks
  (Substring-Match) — für gezielte Matchup-Tests und
  Bug-Reproduktion. `PP_DMG_CAP=3000` senkt den Per-Turn-Damage-Cap
  der Engine, um Kaskaden-Trips gezielt zu provozieren.

## Shrinkage: Wie stark das Profil eingreifen darf

Das Laufzeitmodul gewichtet jedes Profil mit einem **Konfidenzfaktor nach
Stichprobengröße**: `confidence = min(0.75, games / (games + 300))`.
Ein 107-Spiele-Profil verschiebt die Heuristiken also nur um ~26 %,
ein 1000-Spiele-Profil um ~77 % (gekappt bei 75 %). Pair-Bonuses sind
zusätzlich pro Karte auf +15 gedeckelt, egal wie viele Partner in der
Hand liegen.

Das ist keine Vorsichts-Kosmetik, sondern **empirisch erzwungen** — der
erste A/B-Lauf (gleicher Gegner-Pool, gleiche Budgets, je ~40 Spiele):

| Bedingung | Win-Rate |
|---|---|
| Baseline (Profil AUS, 107 Spiele) | 61,7 % |
| Profil AN, ungeschrumpft | **43,6 %** ⚠️ |
| Profil AN, mit Shrinkage | **64,1 %** |

Das ungeschrumpfte Profil hat aktiv geschadet: gelernte Handwerte von
8–91 plus stapelbare Pair-Bonuses (bis +60 pro Karte) haben den
Hand-Term der Eval gegenüber Board- und HP-Termen aufgeblasen — die CPU
hortete Karten und verzog Discards/Tutoren. Mit Shrinkage liegt das
Profil bei diesem kleinen Datensatz auf Baseline-Niveau (±15 %-CI bei 40
Spielen — 64,1 vs. 61,7 ist statistisch Gleichstand). Der Mechanismus
skaliert von selbst: Der Overnight-Lauf mit 1000+ Spielen bekommt
automatisch mehr Einfluss zugestanden.

**Merksatz für spätere Decks:** Nach jedem Training den Eval-Lauf
(Schritt 3) machen. Der Harness hat genau diese Regression in 15 Minuten
sichtbar gemacht — ohne ihn wäre ein schädliches Profil live gegangen.


## Castability-Gate: Gelernte Werte gelten nur für castbare Karten

Gelernte cardValues stammen ausschließlich aus Spielen, in denen die
Karte gespielt wurde — sie tragen also implizit die Annahme „castbar".
Ohne Korrektur übertönte ein hoher gelernter Wert die Heuristik auch
dann, wenn aktuell KEIN Held die nötige Schule/Stufe hat: Tutoren
fetchten hochbewertete Spells als tote Bricks (live beobachtet: 2 Züge
Handleiche, bis die Ability nachkam). Deshalb wird der Profil-Einfluss
(learnedCardValue + heldPairBonus) in `estimateHandCardValueFor` für
Spells, Attacks und Creatures situativ gegated:

| Zustand | Gate |
|---|---|
| Jetzt castbar (`listEligibleHeroesForActionCard` > 0) | 1.0 |
| Enabler-Schul-Ability liegt in der Hand | 0.5 |
| Weder noch (Brick) | 0.15 — die Heuristik dominiert |

Abilities, Artefakte und Potions haben keine Schul-Anforderung und
bleiben ungegated; der Revive-Bonus ist bereits zustandsbedingt.

## Hero-Effekt-Timing-Lernkanal

Neuer Profil-Baustein `heroEffectTiming` ("Held@hand:Bucket" → Delta,
Buckets 0-1 / 2-3 / 4+):

- **Recorder:** `doActivateHeroEffect` (server.js) stempelt jede
  Aktivierungs-ENTSCHEIDUNG (auch wenn der Gegner negiert) mit dem
  Handgrößen-Bucket des Aktivierers auf `engine._heroEffectLog`; der
  Recorder aggregiert pro Record.
- **Trainer:** Winrate-Delta der Spiele mit ≥1 Aktivierung dieses
  Schlüssels vs Baseline; n ≥ 15, Clip ±15, Kanal ab 30 Records.
- **Laufzeit:** `heroEffectTimingPrior` verschiebt zentral in
  `mctsGatedActivation` die Gate-Schwelle für `hero-effect hN`
  (threshold −= Prior; confidence-skaliert, ±12). Kazena mit voller
  Hand → gelernt negativer Wert → Schwelle steigt → das Gate wartet,
  bis die Hand leer gespielt ist. Es bleibt ein PRIOR, kein Verbot:
  ein starker Sofort-Nutzen im MCTS-Score (z. B. gezielt fischen,
  BEVOR gespielt wird) überstimmt die Verschiebung weiterhin.

## Board-Paar-Lernkanal (Same-Hero-Synergien)

Neuer Profil-Baustein `boardPairs` ("A|B" sortiert → Delta):

- **Recorder:** Endstand-Snapshot des gepinnten Boards — jedes
  Kartenpaar (Support-Slots + Ability-Zonen) landet je Spiel einmal in
  `boardPairsSame` (beide am SELBEN Helden) oder `boardPairsSplit`
  (beide gelegt, aber getrennt).
- **Trainer:** Kern ist der KONTRAST Winrate(same) − Winrate(split) —
  gleiche Karten, gleicher Spielkontext, nur die Ko-Lokation
  unterscheidet sich. Das trennt echte Interaktionen (Shield of Life
  heilt → Lifeforce Howitzer am selben Helden feuert) von "beide
  Karten sind halt gut". Dazu ein SIGNIFIKANZ-Gate: |Δ| ≥ max(3,
  1,65 × Standardfehler) — im 5-Seed-Synthetik-Test wurde das echte
  Paar 5/5-mal gelernt und ein outcome-unabhängiges Zufallspaar
  5/5-mal verworfen. Fallback ohne Split-Daten (n_same ≥ 20): Delta
  gegen Baseline, ×0,6 gedämpft, gleiches Signifikanz-Gate.
- **Laufzeit:** `boardPairBonus(engine, pi, cardName, heroIdx)` =
  Σ gelernter Paarwerte zwischen der Karte und allem, was an diesem
  Helden liegt (confidence-skaliert, −10..+20). Eingehängt in BEIDE
  Platzierungs-Pfade: pickHeroForEquip (Howitzer zieht zum
  Shield-of-Life-Träger) und scoreAbilityPlacement. Kreaturen-
  Platzierung nutzt den Kanal noch nicht (deren Held-Wahl läuft über
  die MCTS-Bewertung, die Synergien teils selbst im Rollout sieht) —
  Kandidat für später, falls Trainingsdaten dort Lücken zeigen.
- **Bias-Hinweis:** Der Endstand-Snapshot untererfasst früh zerstörte
  Paare; der Same/Split-Kontrast ist dagegen weitgehend symmetrisch
  betroffen. Bei Auffälligkeiten wäre ein "Paar-entstand"-Stempel beim
  Anlegen die nächste Ausbaustufe.

## Starthand-Lernkanal (Mulligan)

Neuer Profil-Baustein `startHandValues` + `mulliganStats`:

- **Recorder:** Der PP_TRAIN-Runner stempelt nach der Mulligan-Phase
  die FINALE Starthand + Entscheidung auf `engine._startHandInfo`;
  der Recorder schreibt `startHand` (Array) und `mulliganed` (0/1) in
  jeden Record. Alt-Sammlungen ohne Stempel: Felder sind null, der
  Trainer überspringt sie für diesen Kanal. Achtung: server.js hat
  DREI Mulligan-Blöcke (vs Mensch ~11967, Self-Play ~12390,
  PP_TRAIN-Runner ~14115) — die letzten beiden stempeln.
- **Trainer:** Pro Karte Winrate-Delta (Spiele mit Karte in der
  Starthand vs Baseline) in Prozentpunkten, Clip ±20, Support n ≥ 15
  Vorkommen, Kanal ab 30 gestempelten Records. `mulliganStats`
  (mullRate, winAfterMull, winAfterKeep) ist reine Diagnose.
- **Laufzeit:** `deckProfile.startHandScore(engine, pi, hand)` liefert
  { score, covered } — Summe der Werte über die Handkarten, skaliert
  mit der Profil-Confidence (games/(games+300), Cap 0,75).
  `shouldMulliganStartingHand` nutzt den Kanal nur bei Abdeckung
  ≥ 50 % der Handkarten; Schwellen: score ≤ −10 → Mulligan,
  ≥ +8 → Keep, dazwischen generische Spielbarkeits-Regel.
  Präzedenz: Helden-cpuMulliganAdvice > Profil > generisch.
  Konservativ by design: Bei conf 0,49 (≈300 Spiele) löst erst eine
  Hand mit ~−20 Roh-Summe den Mulligan aus — mehr Daten machen den
  Kanal automatisch mutiger.
- **Log:** Die `[mulligan]`-Zeile zeigt `profil=<score|—>`.

## PP_DEBUG_SCENARIO — konstruierte Test-Szenarien

Kommaseparierte Szenarien, angewandt im selben Moment wie
PP_DEBUG_FORCE_CARD (CPU-Zug 2, live): `summonLv3` (alle Helden →
Summoning Magic Lv3), `status` (Held 0 → 2 alte Poison-Stacks),
`gold` (30 Gold), `school:NAME:LEVEL` (beliebige Ability auf allen
Helden, Slot 1). Für Karten, deren Spielbedingungen in Testspielen
selten natürlich eintreten (Lv3-Kreaturen in kurzen Spielen,
Status-Cleanser, teure Artifacts). Referenz: deck-audit-cc-cg-vs.md.

## Protection-Lernkanal (protectionRules)

Negate-/Redirect-Confirms (Idej Projection, Gigantisaur Brachion,
Prophecy of Tempeste) feuern nicht mehr pauschal: Der Hook legt
`protMeta: { d, hp, pi }` (Schaden, Ziel-HP, Spieler) in den Prompt,
der Karten-cpuResponse ruft `protectionDecision()` (_deck-profile.js).
Entscheidungshierarchie: gelernte Regel (protectionRules[card]:
confirm ⇔ lethal, sofern lethalConfirm ≠ false, oder ratio = d/hp ≥
ratioThreshold) > 50/50-Exploration im Training > Accept-Default live.
Jede Entscheidung landet auf engine._protLog; der Recorder übernimmt
sie als record.protectionDecisions; der Trainer regressiert beide Arme
in Ratio-Buckets (lethal / ≥0.5 / ≥0.25 / <0.25) gegen den Ausgang
(Gates: n≥8 je Arm, Δ≥3pp) und schreibt protectionRules ins Profil.
Neue Protection-Karten: nur protMeta im Prompt + cpuResponse-Dreizeiler.
7/7 Unit-Tests; Live-Beweis: 5 Entscheidungen/Spiel mit gemischten
Armen in Idej Illusions.

## Deck-Telemetrie: PP_DECK_MONITOR=1

Env-gated Ressourcen-Log am Ende jedes CPU-Zugs (in _cpu.js vor dem
Main2→End-Übergang): `[MONITOR] mid=<Held1-Präfix> pi= turn= gold=
hand= spells= artifacts= unplayable=`. "unplayable" = Spells/Attacks
ohne eligible Hero plus unbezahlbare Artifacts. mid= trägt die ersten
4 Zeichen des Mittel-Helden zur Seiten-Zuordnung in Self-Play-Logs.
Für Deck-Ratio-Tuning: mehrere Matchups laufen lassen, mid=-Zeilen
der eigenen Seite aggregieren (Ø/Spätspiel ab Zug 10).

## Plague Court v30: Potion-Consistency-Set (Stand der Gauntlet-Kampagne)

Potion-Deck (8) nach Als Vorgabe: 2 Poison Vial, 2 Magnetic Potion
(Universal-Tutor — kann Golden Ankh holen, wenn Rafflesia fällt; die
ZIEL-Wahl sollte langfristig das ML-Training garantieren), 2 Elixir
of Quickness, 1 Elixir of Immortality (Auto-Revive-Versicherung gegen
den Rafflesia-Single-Point-of-Failure), 1 Resuscitation Potion.
Wirkung sofort sichtbar: 25-Züge-Attrition-Krieg mit Doppel-Revive
(Ankh+Resuscitation Zug 20), Bamboo auf 110 Gesamt-HP gedrückt;
erstmals Ökonomie-Führung (Ø 4.5 vs 4.4). Gauntlet-Stand nach 30
Versuchen: 0 Siege, aber 7 der letzten 8 Bamboo-Spiele eng
(Gegner-Rest 110-750 von 1400) — Matchup real um 45-50%. Die
Sandbox-Einzelwürfe sind ab hier reine Geduld; 20er-Serien auf dem
Zielrechner sind der effiziente Weg zum Dreier-Lauf.

## Plague Court v29: Ökonomie-Architektur (Als Formel, validiert)

Kern-Erkenntnis der Gauntlet-Kampagne: Die Top-Decks gewinnen über
POWER-UP-ÖKONOMIE (Ø 6-8 Aktionen/Runde: Additionals, free-ability-
Aktivierungen, Potions, Artifacts, Hero-Effekte) — Plague Court alt
lag bei Ø 2.7. Umbau nach der Formel Chain(2) + Abilities(1-2) +
Alchemy(1) + Potion(1) + Artifacts(1-2): 15 Artifacts (3 Snow Cannon,
2 The Yeeting [!Board-Removal, entfernt Divine Gift], 2 Book of Doom,
2 Ankh, 1 Ruby, 1 White Eye, 3 Juice), 14 Abilities (6 Decay, 5
Support, 3 Alchemy), 10 Potions, kompakter Chain-Kern. Gemessen
(Runden-Vollprotokoll, beide Seiten): Ø 5.5-5.8/Runde in guten
Spielen = Augenhöhe mit Bamboo; Matchup von hoffnungslos auf ~50/50
(Gegner-Carry bis auf 110 HP gedrückt). Muster: Rafflesias Tod
kollabiert die Ökonomie auf 1-2/Runde — sie ist der Single Point of
Failure (Guardian Angel ×4 als Antwort). Auswertungs-Snippet für
Runden-Protokolle (PLAYLOG+Gate-COMMITs+MONITOR-Segmentierung) siehe
data/pc/-Historie. Gauntlet-Stand: 26 Versuche, 0 Siege (Cool Gang
15×, strukturell übel: Alpha-Strike + Status-Immunität; Bamboo 11×,
davon die letzten 6 eng). 

## Plague Court: Gauntlet-Kampagne (Top-3) — Pilotierungs-Fixes + Forensik

Gauntlet-Protokoll (nur Cool Gang/Bamboo/Sandlands, Iteration je
Niederlage, PP_PLAYLOG=1 je Versuch): 21 Versuche, 0 Siege — aber
vier fundamentale Funde, alle im Code:
1. **PP_PLAYLOG=1** (im Recorder, an der plays-Zählquelle):
   chronologisches Log echter Plays. **[HPLOG]** (Teil von
   PP_DECK_MONITOR=1): HP-Kurven beider Seiten je Zugende.
2. **Chain-Gate-Fix (_cpu.js):** Das Additional-Gate ließ Rafflesias
   GRATIS-Folgezauber bei marginal negativem Score verfallen. Jetzt:
   overrideThreshold −60, wenn der castende Held einen aktiven
   rafflesia_chain-Grant trägt (typeId-Check → alte Decks unberührt).
3. **Johanna-Redirect (johanna-crusader-of-light.js):** Pauschal-
   Accept → Protection-Kanal + kartenlokaler Vernunft-Default
   (lethalen Redirect nie annehmen: ceil(d/2) ≥ eigene HP → decline).
   Forensik zeigte: sie redirectete sich bis Zug 5 zu Tode.
   WICHTIG: Im Datensammelmodus explorieren Redirects 50/50 —
   Einzelspiel-Bewertungen daher immer mit PP_TRAIN_EVAL=1 fahren!
4. **Selbst-Mill-Gefahr:** "No cards to draw = lose" + Willy(+5)/
   Haste/Supply/Melody millte uns in langen Spielen selbst aus
   (mind. 2 Gauntlet-Niederlagen bei 3 lebenden Helden!). Smuggler's
   Pier (Gold→Draw) ist in diesem Deck doppelt gefährlich — das
   CPU-Gate skippte ihn (skip-Score > play), was sich als Schutz
   erwies. Draw-Dichte ist ein Balance-Seil: 0 Draw = Handhunger
   (Versuch 20), voller Motor = Mill-Tod.

Matchup-Forensik: **Cool Gang** = Alpha-Strike-Combo (Coolness Stack:
+40 dmg × Stackgröße auf Thorads Hits, Overcharge ab 6 Stack;
Divine Gift = Status-Immunität auf dem Carry → unsere Poison-Uhr
läuft dort ins Leere; 15 Versuche, alle verloren, Kills oft alle
Helden in EINEM Zug). **Bamboo Warrior** = pendelt (5 Spiele, 12-16
Züge, Gegner-Rest bis runter auf 435/1400 — gewinnbar, braucht
Serien statt Einzelspiele). Gauntlet-Mathematik: bei geschätzten
Matchup-Raten (~25-40%) ist P(3 Siege in Folge) < 5% pro Durchlauf —
in der Sandbox nicht sinnvoll erwürfelbar; Profil-Training +
100er-Serien auf dem Zielrechner sind die Hebel.

## Plague Court: Dead-Card-Analyse + Varianz-Befund (v10-v11 + v9-Replikation)

Dead-Card-Messung (MONITOR-HAND-Zeile ergänzt: Hand-Inhalte je
Zugende; Auswertung plays/Spiel vs. Hold-Präsenz je Kopie über 41
Spiele + 66 Snapshots): Smuggler's Pier 0 Plays (höchste
Hand-Präsenz — Area-Slot-Konflikt), Golden Ankh 0.02 Plays/Kopie
(Versicherungskarte: Durchschnittsmetrik unterschätzt Tail-Value!),
The White Eye 0.68 Plays = Top-Performer. ABER: Die daraus
abgeleiteten Swaps (v10: +Snow Cannon/Book of Doom, v11: konservativ)
fielen beide mit 5er-/10er-Streaks durch, und die REPLIKATION der
exakten v9-Liste ergab 15-20 (42.9%) statt 60%. Kombiniert über 4
nahezu identische Listen: 54-62 = 46.6% (116 Spiele).

**Kernbefund:** 35er-Serien haben ±16pp-Konfidenz — Feintuning auf
3-Karten-Ebene ist damit NICHT auflösbar; v6/v9-„Bestehen" und
v7/v8/v11-„Durchfallen" lagen im selben Rauschband um real ~47-50%.
Gesichert (mechanisch/repliziert) sind nur: die Struktur-Fixes aus dem
Regelstudium, die Pilotierungs-Verträge (Chain 2→13/Spiel), die
Telemetrie-Verbesserungen (unspielbar 2.4→0.6/Zug) und die
Play-Raten-Fakten. Nächste Hebel in dieser Reihenfolge: (1) reguläres
Profil-Training für Plague Court (alle Serien liefen mit
Baseline-CPU! `node scripts/train-all-decks.js --only "Plague Court"
--games 1500 --ab 100`), (2) 100-200er-Serien je Kandidat auf dem
Zielrechner, (3) dokumentierte Karten-Kandidaten: Friendship Lv2/3
auf Rafflesia (Support-Additional + Draw — Lv1 kollidiert mit dem
Chain: "cannot use any other Support Spells"!), Snow Cannon (5g
Freeze), Dark Gear (Kreaturen-Klau), Tea/Beer/Juice (Status-Konter,
Juice 0g quasi-Reaction).

## Plague Court: Ratio-Optimierung v6 → v9 (Telemetrie-Kampagne)

Telemetrie v6 bestätigte die Vermutung: Gold Ø77.5 ab Zug 10
(monoton +8/Zug, max 144), Ø4.6 Zauber konkurrieren um 1-2 Aktionen,
Ø2.4 unspielbare Karten/Zug. Aber die Serien zeigten: v7 (−7 Zauber,
+7 Artifacts inkl. Draw-Sinks) ❌ 5er-Streak — Draw-Sinks verschärfen
die Aktions-Konkurrenz statt sie zu lösen; v8 (Wirkungs-Sinks statt
Draw) ❌ 5er-Streak — die geschnittene Kontrolle fehlte in der
Aggro-Zone. **v9 = v6-Substanz + minimal-invasiver Einbau** (−1 Haste,
−1 Poisoned Well, −1 Toxic Fumes; +1 Smuggler's Pier, +1 Strong
Shield, +1 The White Eye): **21-14 = 60.0% über 35 Matchups,
maxStreak 3** (v6: 52.8%). Endtelemetrie: unspielbar 0.6/Zug,
Zauber-Konkurrenz 1.7 — Bestwerte; Gold bleibt hoch (83.9), was die
Winrate nicht bremst. Lektion: Der Hebel war Hand-QUALITÄT
(unspielbare Karten raus), nicht Gold-Verbrauch. Burning Inferno ist
mit v7+ ebenfalls nicht mehr sandbox-messbar (dritter SKIP-Kandidat
neben Big Stomp/Slip). Artifact-Sharing: Smuggler's Pier/Strong
Shield/White Eye-Familie berührt Big Stomp und Gather That Storm
(Karten unverändert). Aktuelle Deckliste: data/SampleDecks/Plague
Court.txt.

## Neues Deck: Plague Court (Rafflesia) + Held-Pilotierungs-Verträge

Selbst konstruiertes Deck um Rafflesia (Mitte): Willy (passiver
Kartenmotor) | Rafflesia | Johanna (Passiv-Tank). Poison-Attrition mit
Doppelzauber-Kern; kein Potion-Deck (kein Alchemy-Zugang im Lineup —
Regel!). Testserie v6: 19-17 (52.8%) über 36 Matchups, max
Verluststreak 3. Big Stomp und Slip 'n Slide sind als
Attrition-Spiegel nicht sandbox-messbar (>155s/Spiel selbst mit
Mini-MCTS) — auf dem Zielrechner nachspielen; historisch (v1) waren
beide Sieg-Matchups. Chain-Rate: ~0.40 Grants/eigene Runde.

Zwei NEUE Held-Verträge im Brain (Default 0 → alte Decks unberührt;
aktuell exportiert sie NUR Rafflesia, die in keinem anderen
Sample-Deck steht): `cpuCasterPriority(engine, pi, heroIdx, cardData)`
sortiert die Kandidaten-Helden einer Karte (Rafflesia +100 für
Decay/Support-Spells — sie wird Default-Caster und bekommt die
MCTS-Rollouts, ihr Chain-Grant feuert), und
`cpuAbilityAttachBonus(engine, pi, heroIdx, abilityName)` (+150 für
Decay/Support Magic auf ihr — die Schulen stapeln sich auf die
Casterin). Wirkung gemessen: Chain-Grants 2 → 13 Registrierungen pro
Spiel nach Einbau. Außerdem neu: PP_TRAIN_SKIP_OPP (kommasepariert)
schließt Gegner aus dem Round-Robin aus.

## Game-Start-Pick-Kanal (gameStartPicks) — Bill, Barker, Sid

Start-of-Game-Sucheffekte lernen ihre besten Ziele. Zentrale Auswahl:
`gameStartPickDecision(engine, pi, cardName, options, {count, budget})`
in _deck-profile.js — gelerntes Ranking (profile.gameStartPicks[card]
.values = WR-Delta je Pick, marginal) > uniforme Exploration im
Datensammelmodus > null (Karte nutzt ihre bestehende Heuristik).
Multi-Picks entstehen greedy aus Marginalwerten (distinct-Namen +
Budget); Kombinationen werden bewusst nicht gelernt. Recorder:
record.gameStartPicks + oppHeroKey (Matchup-Schlüssel des Gegners).
Trainer-Gates: ≥20 Spiele je Quellkarte, n≥8 je Pick, |Δ|≥3pp.
`isCollecting()` stellt sicher, dass NUR im Datensammelmodus
exploriert wird — EVAL/AB-Läufe zeigen Regeln bzw. Defaults.

Pro Karte: **Bill** (cardGalleryMulti, Budget ≤20) und **Barker**
(cardGallery; options deck-first sortiert — Deck-Quelle ist bei
Namens-Gleichstand dominant und wird nicht gelernt) sind volle
Lern-Teilnehmer, live verifiziert (explore-Picks in Records).
**Sid** lernt NICHT selbst: sein Wert ist matchup-abhängig, und die
Information existiert bereits — er konsumiert via
`profileForHeroes(oppHeroNames)` (read-only, maskenfrei) die
cardValues des GEGNER-Profils und klaut die Top-2 der Galerie
(verifiziert: src=oppProfile gegen Heal Burn). Im Datensammelmodus
exploriert er uniform; die Logs (× oppHeroKey) erlauben spätere
Validierung der Konsum-These. Crestina bleibt bewusst ohne
CPU-Unterstützung (Riesen-Optionsraum, BANNED); Idej-Lords haben
keine echte Wahl (immer Maximum) und bleiben Default. Hinweis: Sid
ist derzeit in KEINEM Sample-Deck — Trainingsdaten für ihn entstehen
erst, wenn er in einem Deck spielt.

## Protection-Kanal: Redirect-Familie (Alleria + Engine-Prompts)

Beide Engine-Redirect-Prompts (Hand-Redirect: Martyry/Challenge/
Anti-Magnet; Hero-Redirect: Alleria) tragen jetzt protMeta
{ d: config.baseDamage, hp: Ziel-HP, pi } — damit kann JEDE
Redirect-Karte den Lernkanal nutzen. Alleria ist umgestellt
(Accept-by-default → protectionDecision, live verifiziert: 6
Entscheidungen mit gemischten Armen in 2 Creepy-Crawlies-Spielen).
Martyry/Challenge/Anti-Magnet laufen weiter über cpuReactionDecision;
bei Bedarf genügt derselbe cpuResponse-Dreizeiler wie bei Alleria.
Hinweis: ratio=0-Einträge entstehen, wenn der Quell-Effekt kein
baseDamage trägt (Kreatur-Effekte) — der Trainer bucketed sie als r00.

## Trainiertes Profil evaluieren (PP_TRAIN_EVAL / PP_TRAIN_AB)

Frisches Profil-JSON nach data/cpu-profiles/ legen (ALTE Version
desselben Decks vorher ersetzen — der Loader matcht über die Helden,
nicht den Dateinamen). Dann:
1. **PP_TRAIN_EVAL=1** (+ PP_TRAIN=1, PP_TRAIN_DECK, PP_TRAIN_GAMES):
   identisches 37-Gegner-Feld wie beim Training, aber Profil AN und
   ε automatisch aus. Die W-L-T-Zeile am Ende direkt gegen die
   trainWinRate im Profil-JSON vergleichen = echter Vorher/Nachher-
   Effekt des Trainings. Eval-JSONL NIE ins Training zurückfüttern
   (off-baseline policy).
2. **PP_TRAIN_AB=1**: Spiegel-Match (Deck vs sich selbst), eine Seite
   MIT Profil, eine Baseline — Deckstärke kürzt sich raus, gemessen
   wird reine Pilotenqualität. Ideal als Signifikanztest (≥100 Spiele).
3. **PP_TRAIN_OPP_PROFILES=1** (nächste Generation): Gegner pilotieren
   mit ihren Profilen, die Sammel-Seite bleibt Baseline+ε — härtere
   Trainingsdaten für Iteration 2.

## Slip'n'Slide/Big-Stomp-Langsamkeit (Diagnose, bewusst ungefixt)

V8-Profil: Heißester Pfad ist loadCardEffect → String.replace —
der Loader slugified den Kartennamen per Regex VOR jedem Cache-Hit.
Hauptaufrufer: _applyCardLevelReductions → _testLevelReqForZones
(Level-Reduktions-/Coverage-Verträge), die in beiden Decks
(Slippery-Stack bzw. Gigantisaur-coverLevelGap) pro Handkarte × Zone ×
Rollout-Schritt laufen. Delays sind unschuldig (_delay no-opt im
fastMode); auch Mini-MCTS-Budget ändert nichts. Beide Quick-Wins UMGESETZT und per V8-Profil
bewiesen: (1) Raw-Name-Cache im Loader — loadCardEffect fiel von 259
Ticks (Platz 1) auf 14 (0.3%); (2) Monster in a Bottle las cards.json
bei JEDEM getEligibleCreatures-Aufruf synchron von Platte und parste
die komplette DB (nach Fix 1 der größte Einzelfresser, 19% —
canActivate läuft in jedem Potion-Scan der Planung); jetzt engine-DB
bzw. Modul-Cache. Rest-Profil ist gesund: Top ist engine.snapshot
(legitime MCTS-Planungsarbeit). Slip/Big Stomp bleiben dennoch
>160s/Spiel in der Sandbox — die Spiele sind strukturell lang (viele
Züge × große Boards × Kandidaten-Snapshots); auf einer Maschine ohne
Zeitfenster sind die Läufe einfach entsprechend schneller. Die
Coverage-Nachmessung beider Decks bleibt fürs erste reguläre Training
empfohlen.

## Deepsea-Bats-Forensik (+ Bypass-Fix in der Brain-Enumeration)

Dreischichtige Ursache, warum Bats nie gespielt wurde: (1) HAUPTBUG,
GEFIXT: listEligibleHeroesForActionCard prüfte für Kreaturen nur
freeCount>0 ohne den canBypassFreeZoneRequirement-Vertrag — der
Bounce-Place-Pfad (Swap in volle Zonen, DER Teppes/Siphem-Trigger) war
für die CPU unsichtbar, obwohl Engine+UI ihn Menschen erlauben. Nach
Fix: 16× KANDIDAT bei vollen Zonen, mit ε=0.6 gespielt (onPlay ×2,
fehlerfrei). Betrifft die ganze Bounce-Klasse (Bats, Horror Clown …).
(2) Früh scored Bats nur als 50-HP-Body (−551, "(heuristic)", nie
MCTS-Variationen — Budget-Vorsortierung + unerfüllter on-summon-Guard),
während Pirate/JackO mit explorierten Zielen gewinnen. (3) Der
Recursion-/Synergiewert ist reines Trainings-Thema: ε-Exploration
spielt Bats jetzt gelegentlich, cardValues/pairBonuses lernen den
Kontextwert. Merkregel: `effect`-Feld in cards.json ist die Wahrheit —
Spec-Kommentare in Kartendateien können veraltet sein (Bats' Kommentar
beschreibt nur den halben Effekt).

Audit-4 (verbleibende 29 Decks, skaliert): 9 Karten-Fixes (4 Confirms
accept, 5 SoL-Ziel-Intercepts) + Engine-Dispatch-Erweiterung
`config.source` für Karten mit dynamischen Prompt-Titeln (Cool
Repair). Big Stomp + Slip 'n Slide sind >160s/Spiel und haben keine
Live-Coverage (beim ersten regulären Training mit PP_COVERAGE=1
nachmessen). Details: deck-audit-rest29.md.

Audit-3-Bugfund (systemisch): Der Target-Redirect-Confirm der Engine
(Martyry/Challenge/Anti-Magnet) trug kein showCard und fiel am
CPU-Reaction-Router vorbei in den Decline-Default — Redirect-Reactions
feuerten für die CPU nie. Fix: showCard am Engine-Prompt. Merkregel
erweitert: JEDER engine-seitig gestellte Karten-Aktivierungs-Confirm
braucht showCard (oder "Activate"-confirmLabel), sonst verfehlt er den
Reaction-Router. Karten-Sweeps sehen solche Prompts NICHT (sie stehen
nicht in der Kartendatei) — der Decline-Log im Brain (temporär
aktivierbar an der cancellable-Decline-Zeile) ist das Findewerkzeug.

Audit-2-Bugfunde (Details im Audit-Bericht): afterPotionUsed feuert
jetzt auch für selbst-splicende Potions (Elixir-of-Quickness-Klasse —
vorher Recorder + Karten-Listener blind); playPotions-Erfolgskriterium
auf Kopien-Verbrauch umgestellt (Draw-Potions loggten falsch FAILED
und wurden via tried gesperrt); Dauer-Nutzen-Artifacts (Magic Amber,
Mana Absorbing/Weakening Crystal) via cpuMeta.alwaysCommit von der
Equipment-Bugklasse befreit; Recorder stempelt Potion-plays.
Surprises (set face-down) fehlen weiterhin in plays — bekanntes
Recorder-Blindfeld.

## PP_COVERAGE=1 — Effekt-Coverage-Audit

Env-Flag für Deck-Audits: zählt jede LIVE-Hook-Feuerung (nicht MCTS)
pro Karte+Hook in global.__ppCoverage; der Trainingsrunner dumpt nach
<PP_TRAIN_OUT>.coverage.json (nur bei regulärem DONE — timeout-gekillte
Läufe dumpen NICHT). Kombiniert mit plays/equips/heroEffects aus den
JSONL-Records ergibt das pro Deck eine Karten-Lebenszeichen-Matrix;
Karten ohne Signal per PP_DEBUG_FORCE_CARD + PP_TRAIN_VERBOSE
([trace]-Zeilen zeigen Enumeration/Filter) einzeln nachtesten.
Referenz-Audit: deck-audit-3decks.md (55 Karten, 12+13 Testspiele).

## Prompt-Typ-Taxonomie: Was der CPU-Default mit cancellable macht

Der entscheidende Diskriminator zwischen "Effekt feuert" und "Effekt
stirbt still" ist der PROMPT-TYP — nicht promptGeneric vs andere API:

1. **type 'confirm'** (promptConfirmEffect, promptGeneric-confirm),
   cancellable: Default = DECLINE. Fragen nach dem OB sterben. Deckung
   nur durch (a) Proaktiv-Cast-Gate (Titel == gerade resolvende eigene
   Karte) oder (b) karteneigenes cpuResponse. → Barker-Klasse.
2. **type 'optionPicker' / 'cardGallery'**: Default = PICK (erste
   Option). Fragen nach dem WAS überleben immer — aber prüfe, ob
   First-Pick klug ist (Argos wählte stur Lv1 statt max Counter).
3. **Target-Prompts** (promptDamageTarget/EffectTarget): Ziel-Picker
   klassifiziert die Karte — Attack, Spell mit Schaden oder Artifact
   MIT durchgereichtem `baseDamage` laufen durch die Damage-Logik
   (Archer 7/7, Howitzer nach Fixes 4/4 verifiziert). Nur was durch
   alle Klassifikationen fällt (Heil-/Utility-Ziele ohne baseDamage),
   landet im cancellable-Decline des Engine-Fallbacks →
   Shield-of-Life-Klasse.

Zweite Achse: der KONTEXT — präzisiert nach Live-Tests (Cute
Commando): Der MCTS-Plan deckt Hook-Confirms auch dann, wenn der
Trigger während einer EIGENEN geplanten Aktion feuert (Discard als
Kosten, eigenes Opfern → Cute Dogs Discard-Summon kam 2/2 als
confirmed:true aus dem Plan). Plan-los — und damit dem rohen
Typ-Default ausgeliefert — sind nur: Turn-Grenzen außerhalb Aktionen
(onTurnStart/End: Barker), Trigger im GEGNER-Zug (onHeroKO,
afterDamage/afterHeal durch Gegner: Shield of Life), und
Gegner-verursachte Trigger im eigenen Zug.

Design-Merkregel für neue Karten: confirm+cancellable im Hook →
cpuResponse Pflicht; Schaden → baseDamage durchreichen genügt;
Heilung/Utility mit Ziel → cpuResponse; optionPicker → First-Pick-
Tauglichkeit prüfen.

## Tote !showCard-Bedingung in Confirm-Intercepts (Barker-Bugklasse)

Vier Karten (Barker, Andras, Bomb Berserker Bartas, Charm of Balance)
hatten cpuResponse-Intercepts mit dem Muster
`type === 'confirm' && !promptData.showCard → confirmed`. Diese
Bedingung ist TOT: `promptConfirmEffect` defaultet `showCard`
inzwischen IMMER auf den Kartennamen — der Intercept griff nie, der
Default-Brain declinte den cancellable Confirm, und der Effekt
fizzelte still (Barkers Zug-1-Beschwörung feuerte z. B. gar nicht,
obwohl Hook, Guards und Kartenauswahl einwandfrei liefen: 7 eligible
Kreaturen, confirmed=false). Zweite Regression ÜBER dem ursprünglichen
Decline-Fix. Alle vier auf `type === 'confirm' → confirmed` reduziert —
sicher, weil der generic-Dispatch das Skript nur für Prompts mit dem
eigenen Kartentitel lädt. Regel für neue Confirm-Intercepts: NIE auf
showCard-Abwesenheit prüfen; der Titel-Dispatch ist die Scoping-Ebene.

Nach der Plan-Deckungs-Kalibrierung wurden die 8 verbleibenden
plan-losen Confirm-Karten auf Accept-by-Default umgestellt (Muster:
cpuResponse → type 'confirm' → confirmed): Fairy Queen Crestina
(onPhaseStart), Yolomungandr (onTurnEnd), Styx (onHeroKO), Tarleinn's
Floating Island (afterHeal), Idej Projection + Gigantisaur Brachion
(beforeDamage), Guardian of Teocuilatl (onAreaWouldBeAffected) und
Cute Bird (onCreatureDeath — der Hook prüft Kosten/Payoff bereits vor
dem Prompt, Confirm heißt "sofern möglich, feuern"; kritisch war der
Gegner-Kill-Fall, der plan-los declined wurde).

Vollständiger Sweep über alle 741 Kartendateien fand danach 18 WEITERE
Instanzen desselben Copy-Paste-Musters (darunter Kazena, Johanna,
Divine Gift of Time/Guardian, mehrere Slippery-/Steam-Dwarf-Karten) —
alle identisch reduziert; 0 Vorkommen verbleiben. Separates
Decline-Default-Audit (cancellable Prompts ohne cpuResponse-Deckung)
in decline-audit.md: 79 Karten mit klarem Hook-Kontext + 141 mit
unklarem Kontext, bewusst NICHT gefixt — accept/decline ist dort
kartenabhängig zu entscheiden. Archer-Livetest kalibriert die Liste:
Der Decline-Default trifft primär CONFIRM-Prompts; Target-Prompts mit
Zielen wählt der Brain-Picker normal (Archers 40-Schaden-Trigger und
Alternativ-Summon feuerten 7/7 bzw. 2/2 ohne eigenen cpuResponse).
Sichtungspriorität: promptGeneric/ConfirmEffect in Hooks > Heil-/
Utility-Targets ohne baseDamage > Schadens-Targets (gedeckt).

## Karten-Vertrag cpuPlayVeto (Nutzlos-Play-Filter)

Kartenlokale Prüfung `cpuPlayVeto(engine, pi, heroIdx, { additional })`
→ true = diesen Play gar nicht erst enumerieren. Hintergrund: MCTS-
Eval-Rauschen lässt wirkungslose Plays (Heal für 0 auf ein Voll-HP-Ziel)
gelegentlich über den Pass-Vergleich rutschen. Der Veto greift in
BEIDEN Enumerations-Pfaden: reguläre Action-Phase (additional:false)
und fireAdditionalActions (additional:true).

Referenz-Implementierungen: **Heal** vetot nur, wenn ALLE Nutzenquellen
fehlen — kein heilbares eigenes Ziel, kein healReversed-Gegner
(Overheal Shock macht Heal zum Damage-Spell) und — nur im
Additional-Pfad — kein Friendship ≥ 2 am Caster (der Draw-Rider hängt
am Additional-Action-Grant; reguläre Plays bekommen ihn NIE).
"Heilbar" ist caster-abhängig: Naos Overheal-Passiv ist KEIN
Freifahrtschein — die Engine erlaubt Overheal nur auf Ziele mit
hp ≤ maxHp (Helden) bzw. currentHp ≤ baseHp (Kreaturen); ein bereits
over-healtes Ziel bekommt auch von Nao nichts (live beobachteter
Fall). Ohne Nao braucht es ein echtes HP-Defizit. **Healing Melody**
identisch inkl. Nao-Klausel — Naos Passiv sitzt zentral in
actionHealHero und wirkt daher auch dort. Cure braucht kein Veto
(Ziel-Anforderung erzwingt Status, Cleanse hat Eigenwert), Divine
Gifts sind Permanents.
Neue Heil-/Utility-Karten mit möglichem Null-Effekt: Veto mitliefern.

## Reaktiv-Equipment: cancellable-Prompt-Bugklasse

Shield of Life, Shield of Death und Lifeforce Howitzer prompten alle
cancellable aus Hooks — der generische CPU-Responder lehnt cancellable
ab, d. h. OHNE karteneigenes cpuResponse verzichtet die CPU stumm auf
den Effekt. Alle drei haben jetzt Intercepts (Heilung: bestes eigenes
verletztes Ziel; Schaden: Kill-Priorität, dann Gegner-Held mit
wenigsten HP). Beim Anlegen NEUER reaktiver Karten mit cancellable
Prompts: cpuResponse mitliefern, sonst ist die Karte für die CPU tot.

Anzeige-Hinweis: Der Client rendert HP-Popups als Diff zwischen zwei
Syncs. Reaktive Heilung im selben Hook-Fenster wie der auslösende
Schaden verschmilzt zu EINER Netto-Zahl — Shield of Life ruft deshalb
engine.sync() ZWISCHEN Schaden und Heilung (Popup-Split). Neue
Client-Animation `equip_flash` (play_zone_animation, Feld `color`)
lässt die Equip-Karte beim Feuern aufleuchten (grün Heilung, rot
Vergeltung).

## Multi-Action-Züge: gedeckte Caster in fireAdditionalActions

`fireAdditionalActions` (Main Phase) prüfte pro Karte nur den EINEN
Helden aus `pickHeroForActionCard` — einer reinen Schul-Level/Atk-
Heuristik, die weder Inherent-Bedingungen (Overheal Shock: frei nur
bei Support Magic ≥2 / Decay ≥1 auf dem CASTER) noch heldengebundene
Additional-Action-Deckung kennt (Friendship ist `heroRestricted` und
deckt nur Zauber seines Träger-Helden). Lag die Deckung auf einem
anderen Helden, wurde die Karte komplett verworfen: Friendships
Frei-Zauber verfiel jede Runde, und Overheal Shock verbrannte in der
Action Phase die Haupt-Aktion, statt in MP1 frei zu feuern.

Fix: Der Kandidaten-Loop prüft jetzt den Heuristik-Helden zuerst und
danach alle übrigen legalen Helden auf Deckung (inherent ODER
findAdditionalActionForCard). Wirkung im Heal-Burn-Smoke: 10
committete Additional Actions in einem Spiel (Overheal Shock über
beide Caster, Divine Gifts, Friendship-gedeckte Heals); Skips darüber
hinaus stammen vom MCTS-Gate (Nutzlos-Plays wie Heal bei vollen HP).
Nebenwirkung: mehr Gate-Bewertungen pro Zug → CPU-Züge etwas
langsamer; im Training sinkt der Durchsatz leicht.

## Karten-Intercepts (cpuResponse): Payload & Vorrang

Zwei Laufzeit-Erkenntnisse aus dem Shield-of-Life-Fall, die für ALLE
Karten-Intercepts gelten:

1. **playerIdx im Payload.** `_getCpuTargetResponse` reicht den
   GEPROMPTETEN Spieler jetzt als `payload.playerIdx` durch. Intercepts,
   die aus Hooks fremder Resolutionen prompten (Shield of Life feuert
   in `afterDamage` während der Aktion des Gegners), können den
   Spieler nicht aus `engine._cpuPlayerIdx` ableiten — vorher fehlte
   das Feld, und Intercepts mit playerIdx-Guard waren live wirkungslos.

2. **Karten-Vertrag schlägt MCTS-Plan.** Die CPU-Override von
   `promptEffectTarget` (_cpu.js) konsultiert für Prompts, deren
   `config.title` zu einem Modul mit `cpuResponse` auflöst, ZUERST die
   Karte — deren Antwort überstimmt den `_mctsTargetPlan`. Grund: Die
   MCTS-Variation-Enumeration probiert alle Ziele durch; ein
   verrauschter Rollout konnte so live absurde Picks transportieren
   (beobachtet: Shield of Life heilte einen GEGNER-Helden). Ein
   explizites cpuResponse ist ein deterministischer Domänen-Vertrag
   und kein Suchraum.

Außerdem als Diagnose-Falle notiert: `engine.log(...)` schreibt im
Headless-Training NICHT nach stdout — Effekt-Feuerungen lassen sich
dort nur über eigene console-Instrumentierung oder Recorder-Kanäle
nachweisen, nie über grep auf Game-Log-Einträge.

## Kontext-Verträge: cpuStatusSelfValue mit Ressourcen-Kontext

Der Self-Status-Picker (`scoreSelfStatusTarget`) reicht seit dem
Venom-Swamp-Befund Ressourcen-Kontext an alle Karten-Verträge durch:
`ctx.goldDemand` und `ctx.goldSurplus` stammen aus demselben
Demand-Modell wie `evaluateState` (Gold bis Bedarf 2×, Überschuss 0,2×).
Hintergrund: Der Picker wählt Selbst-Status-Ziele deterministisch VOR
jeder Rollout-Bewertung — eine Karte mit konstantem Selbstwert (Fiona:
pauschal 40 für "+20 Gold pro Status") hebelte damit das Demand-Modell
komplett aus, und Venom Swamp vergiftete die eigene Fiona statt des
Gegners, selbst bei vollem Goldbeutel.

Fiona als Referenz-Implementierung: Wert 40 × linear fallendem
Sättigungsfaktor (ab ~40 Gold Überschuss → 0), zusätzlich 0 bei
kritischen HP (≤80 — der Status-Schaden ist dann teurer als das Gold).
Ohne ctx (Alt-Aufrufer) konservativer Fallback auf 40. Neue Karten mit
Selbst-Status-Nutzen sollten den Kontext von Anfang an verwenden.

## Deck-spezifische Mulligan-Regeln (cpuMulliganAdvice)

`shouldMulliganStartingHand` konsultiert die Skripte der Lineup-Helden:
Exportiert ein Heldenmodul `cpuMulliganAdvice(engine, pi, hand)`, kann es
`'mulligan'`, `'keep'` oder `null` liefern. Präzedenz: `'mulligan'`
schlägt alles, `'keep'` überstimmt den generischen Spielbarkeits-Check,
`null` → generische Regel. Kartenspezifische Logik bleibt damit im
Kartenmodul (Architektur-Regel).

Erste Anwendung: **Beato, the Butterfly Witch** — Messung: 66 % Win-Rate
mit Ascension vs. 21 % ohne. Die Regel zählt distinct Spell-Schulen über
alle Lv1-castbaren Spells und Creatures der Starthand: ≤1 Schule →
Mulligan (Plan nicht startbar), ≥3 → Keep (auch gegen den generischen
Mulligan), 2 → neutral.

## Self-Play-Iteration: Sammeln gegen trainierte Gegner

`PP_TRAIN_OPP_PROFILES=1` (Orchestrator: `--opp-profiles 1`) lässt die
GEGNER mit ihren trainierten Profilen pilotieren — die gepinnte
Sammel-Seite bleibt Baseline + Exploration (Seiten-Maske wie im
Spiegel-A/B). Stärkere Gegner → härtere Trainingsdaten; quarantänisierte
Profile sind als Gegner automatisch ausgeschlossen.

Regeln: (1) Records tragen den Stempel `oppProfiles` — pro Generation
eine frische Ausgabedatei verwenden, Gen-0- und Gen-1-Daten nicht in
einer Resume-Datei mischen. (2) Bewusst NUR gegner-seitig: Die eigene
Seite mit Profil sammeln zu lassen (echte Policy-Iteration) würde
Konfundierungs-Bias über Generationen verstärken statt korrigieren.
(3) Der Nutzen wächst mit der Zahl der Decks, die ihren A/B-Test
bestehen — bei aktuell 2 klar verbesserten von 37 Feld-Decks ist der
Effekt auf die Datenverteilung noch klein.

## Lehren aus dem 1000-Spiele-Lauf (7 Decks, je 100 A/B-Spiegel)

Feldergebnis: Heal Burn & Venom Swamp ≈66 % (echte Verbesserung),
Suicide Bombers / Pew-Pew / Shadows over Blackport / Deepsea ≈50 %
(kein Effekt), **Dance of the Butterflies ≈33 % — das trainierte Profil
schadete messbar.** Drei Mechanismen, drei Konsequenzen:

1. **Mehr Daten senken Varianz, nicht Bias.** Confidence skaliert mit
   games/(games+300): 100 Spiele → Gewicht ~0,25 (Profil stupst), 1000
   Spiele → 0,75 (Profil ersetzt die Heuristik weitgehend). Konfundierte
   Werte (Payoff-Karten erben den Credit der Setup-Karten) werden bei
   n=1000 nicht richtiger — nur einflussreicher. Butterflies traf es am
   härtesten: hochgewichtete Beast-Werte + fehlendes Castability-Gate →
   Tutoren fetchten uncastbare Bomben statt der Schulen-Spells, die die
   Ascension tragen. Das Castability-Gate (siehe oben) entschärft genau
   diesen Kanal — zur Laufzeit, ohne Neutraining.
2. **A/B-gated Deployment (Quarantäne).** Der Spiegeltest ist der
   Akzeptanztest der Pipeline — jetzt setzt sie ihn auch durch: Der
   A/B-Lauf schreibt sein Ergebnis als `abResult` ins Profil-JSON; der
   Loader lädt Profile mit Winrate <48 % (n≥50) NICHT und meldet die
   Quarantäne. Override für Experimente: `PP_FORCE_PROFILES=1`. Neues
   Training überschreibt das Profil samt abResult → frischer Test nötig.
3. **50/50 heißt „kein Hebel", nicht „kaputt".** Das Profil greift nur
   bei Handwert-Entscheidungen (Tutoren, Discards) und Ability-
   Platzierung. Aggro-Decks mit wenigen solchen Entscheidungen bieten
   der Statistik schlicht keine Angriffsfläche; ressourcenlastige Decks
   (Heal Burn, Venom Swamp) sind die natürlichen Gewinner.

Empfohlener Workflow nach diesem Befund: Butterflies-A/B auf dem
aktuellen Build (mit Castability-Gate) einfach WIEDERHOLEN — gleiches
Profil, kein Neutraining. Erwartung: deutliche Erholung; das Ergebnis
landet automatisch im Profil und hebt bzw. bestätigt die Quarantäne.

## Bekannte Grenzen (ehrlich)

- **Aufzeichnungs-Abdeckung** (Stand nach den Recorder-Fixes): Erfasst
  werden proaktive Spells/Attacks (`afterSpellResolved`), Creatures und
  Equips (`onCardEnterZone` support), **Ability-Attachments inkl.
  Performance** (`onCardEnterZone` ability — der Instanzname ist dort
  noch „Performance", vor der visuellen Transformation), One-Shot- und
  Targeting-Artefakte (`afterArtifactUsed`, gefeuert sowohl in
  `doUseArtifactEffect` als auch im `doConfirmPotion`-Targeting-Flow),
  Potions (`afterPotionUsed`), **Reactions** (`onReactionActivated`),
  **Redirect-Karten wie Martyry/Challenge** (dedizierter
  `afterTargetRedirect`-Hook in `_checkTargetRedirect` — bewusst NICHT
  `onReactionActivated`, damit bestehende Konsumenten dieses Hooks keine
  Events aus einem Codepfad bekommen, gegen den sie nie geschrieben
  wurden; ein Fire über `onReactionActivated` hat in Tests reproduzierbar
  Event-Loop-Freezes im Matchup Heal Burn vs Big Stomp ausgelöst),
  Surprises (`onSurpriseActivated`), **Ascensions** (`onAscension` —
  Ascended-Hero-Karten sind Hand-Plays, laufen aber über
  `performAscension`; ohne den Listener wäre der Pivot-Moment eines
  Ascension-Decks unsichtbar) sowie **Revive-Kontext**
  (`onHeroRevive`: Quellkarte → wiederbelebter Held + dessen
  Ability-Stacks zum Revive-Zeitpunkt).
  Letzter bekannter blinder Fleck: **Potion-Plays haben keine
  Exploration** — der Potion-Play-Pfad läuft an den instrumentierten
  Entscheidungspunkten vorbei (Elixir of Quickness: 0 Plays über alle
  Testdecks hinweg).
  Datensätze, die VOR diesen Fixes gesammelt wurden, haben blinde
  Flecken bei Artefakten, Abilities und Reactions — für saubere Profile
  solcher Decks die Sammlung neu laufen lassen (Resume-Datei vorher
  umbenennen oder löschen).

- **Confounding**: „Karte X wurde oft gespielt" korreliert mit Gewinnen
  auch, weil Gewinner mehr Runden haben. Die Turn-Bucket-Kappung und die
  Spiellängen-Kovariate dämpfen das, eliminieren es nicht. Bei kleinen
  Datensätzen die Top-Werte auf Plausibilität prüfen.
- **Pair-Bonuses brauchen Daten**: Unter ~300 Spielen überleben nur die
  häufigsten Paare den Support-Filter. Das ist Absicht (Rauschen), heißt
  aber: seltene Combos lernt erst ein großer Lauf.
- **Trainings-Pilot ≠ Live-Pilot**: Mit reduziertem MCTS-Budget gesammelte
  Daten spiegeln einen etwas schwächeren Piloten. Für die erste Iteration
  unkritisch (Deck-Eigenschaften dominieren); der Overnight-Lauf mit
  Default-Budget ist die sauberere Basis.
- **Iterieren erlaubt, aber frisch sammeln**: Nach Einspielen eines Profils
  neue Trainingsdaten immer mit `PP_TRAIN` (Profile automatisch AUS)
  sammeln — sonst lernt Iteration 2 aus Daten, die Iteration 1 schon
  verzerrt hat.
