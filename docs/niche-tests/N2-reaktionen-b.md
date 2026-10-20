# N2-reaktionen-b – Nischenfall-Bericht (Welle 23, Tiefentest)
Stand/Autor: Agent N2-reaktionen-b, 20.10.2026 (Basis 3ebcbee, Zweig `wave23/W23b`). Karten: 22 in der Liste · 22 gezielt getestet (L2) · 14 Befunde (A: 2 · B: 7 · C: 5). Nichts gefixt, keine Quellen geändert.

Kartenliste (R01, bisher L0): Divine Gift of Edge · Divine Gift of Rain · Divine Gift of the Guardian · Divine Gift of Time · Divine Punishment · Emergency Spell Armor · Energy Aura · Fireshield · Firewall · Flooding · Forbidden Curse of Aging · Frost Rune · Furious Anger · Gathering Storm · Glass Wall · Gold Trap · Graveyard of Limited Power · Guardian Angel · Idej Projection · Intrude · Invisibility · Jumpscare.

## Zusammenfassung
* Die klassischen Schwerpunkte (Surprise-Host gefroren/betäubt/negiert/tot/abgegeben, Kontrollwechsel des Hosts, Negation des Auslösers samt Einmal-Stempel, Selbstschaden, Flächenschaden, Statusschaden, Abbruch) sind in den Wellen 1–22 gründlich bereinigt: alle 22 Karten bestanden diese Prüfungen (Tabelle „Getestet & in Ordnung"). Die Dauerfeuer-Batterie (`lib/barrage.js`, beide Sitze) lief für alle 22 Karten ohne verschluckte Engine-Fehler, Hänger oder Zustandsauffälligkeiten.
* Die Befunde liegen deshalb an den **Rändern**: (1) *Quellenarten* — „als Spell/Attack geltende" Heldeneffekte (Alice, Broghan) und gewöhnliche Heldeneffekte (Siphem) werden von den Karten uneinheitlich behandelt (N2-02, -07, -08); (2) *Umhängen von Anhängseln* über Inheritance Ceremony umgeht Ein-pro-Held-/Nur-Idej-Regeln (N2-10, -11); (3) *Tick-Spells ohne „Gewirkt"-Haken* (Gathering Storm) und Energy Aura (N2-13); (4) *Einkommens-Zuschlag* (Wealth) und Gold Trap (N2-09); (5) *Brett → Ablage durch Effekt* ohne Fenster bei Detection (N2-03); (6) Wirkung von Forbidden Curse of Aging auf das natürliche Auslaufen von Status (N2-04) — das ist die stärkste Auswirkung (dauerhafte Frost-/Betäubungs-Sperre mit zwei Karten).
* Fünf Regelfragen für Al (Stufe C): N2-04, -05, -06, -12, -14.
* Nicht getestet: siehe „Bewusst nicht getestet".

## Befunde

### N2-01 · Invisibility wird abgeworfen, wenn eine Kreatur des Trägers Schaden austeilt · Stufe B
- **Karten:** Invisibility (`cards/effects/invisibility.js`), Mr. Jiggles (Auslöser)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Main Phase 1. Held 0 trägt (per echtem `t.play`) Invisibility; Mr. Jiggles (Summoning Magic 2 per `grantFor`, kein Summoning Sickness) steht in der Support Zone desselben Helden 0. Gegner: Held bzw. eine „ZZ Dummy"-Kreatur als Ziel. Beide Sitze.
- **Schritte:** 1. Jiggles aktivieren (`t.activateCreature`), 100 Schaden auf Held oder Kreatur des Gegners. 2. Zustand der Invisibility prüfen.
- **Erwartet** (Kartentext: „If the **Hero** chooses a target your opponent controls with an Attack or Spell, **deals damage** to 1 or more targets your opponent controls, … send this card to your discard pile."): Nur der HELD (Attack, Spell, Heldeneffekt) wirft die Karte ab. Der Effekt einer Kreatur ist ihr eigener, auch wenn sie in der Zone des Helden steht. Invisibility bleibt liegen.
- **Beobachtet:** Invisibility liegt danach in der Ablage (3 von 3 Läufen: Held-Ziel, Kreatur-Ziel, Sitz 1). Gegenproben: dieselbe Kreatur unter Held 1 → Invisibility bleibt; ein Zauber des Trägers gegen ein gegnerisches Ziel wirft sie ab (Text) ✓.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/01-invisibility-kreaturenschaden-wirft-ab.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `invisibility.js:243-247` (`afterDamage`) benutzt `engine.quelleIstHeld` (`_engine.js:27349`), das nur Brettseite + `heroIdx` vergleicht — das Quellobjekt einer Kreatur trägt den `heroIdx` ihres Wirts; `invisibility.js:264-275` (`afterCreatureDamageBatch`) vergleicht `e.source.heroIdx` ohne zu prüfen, dass die Quelle ein Held ist. Folge: ein Invisibility-Held mit Kreaturen im Support verliert seinen Schutz sofort, sobald eine seiner Kreaturen schadet.

### N2-02 · Fireshield reagiert auch auf Schaden aus einem aktiven Heldeneffekt · Stufe A
- **Karten:** Fireshield (`cards/effects/fireshield.js`), Siphem, the Deepsea Demon (Auslöser, Schadenstyp `'hero'`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz X: Siphem mit 2 Deepsea Counters (`hero.deepseaCounters`), aktiviert den Heldeneffekt (`t.activateHero`) gegen Held 0 des Gegners. Gegner: Fireshield auf der Hand (Destruction Magic 1 per `grantFor`). Beide Sitzverteilungen.
- **Schritte:** 1. Siphem-Effekt aktivieren, Zielheld des Gegners wählen. 2. Fenster „Fireshield" annehmen (Skript beantwortet Ja).
- **Erwartet** (Kartentext: „… takes damage from an opponent's **Attack, Spell or Creature effect** …"; Vorgabe v665/666 Als Befund 30.8., `isAttackSpellOrCreatureSource` in `_hooks.js`: „Helden-/Artefakt-/Trank-Effekte als Quelle lösen NICHT aus" — gilt für Frost Rune, Firewall, Flooding, Glass Wall; Schadenstyp `'hero'` = Heldeneffekt, CARD_API „Schadenstyp 'hero'" v905): Kein Fireshield-Fenster, kein Rückstoß.
- **Beobachtet:** Das Fenster geht auf, der Siphem-Held erhält 50 Rückstoß (Hälfte von 100). Gegenproben: ein Zauber (Burning Finger) öffnet das Fenster ✓ (Text); Frost Rune bleibt bei demselben Heldeneffekt verdeckt ✓. Artefakt- (Book of Doom), Trank- (Acid Vial) und Gift-Schaden öffnen es nicht ✓ (nur Quellen mit `heroIdx` kommen durch, daher trifft es genau die Heldeneffekte).
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/02-fireshield-heldeneffekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `fireshield.js:32` `afterDamageCondition` prüft nur `source.owner`, `source.heroIdx` und dass der Angreifer lebt, nicht die Art der Quelle; der `else`-Zweig behandelt jede Quelle mit `heroIdx` als „Hero-cast Spell/Attack". Fehlt: `isAttackSpellOrCreatureSource(engine, { …source, damageType: type })`. (Hinweis: Broghans Effekt „is treated as an Attack" und Alices „treated as … Spell" sind legitime Auslöser — `damageType` 'attack' bzw. `*_spell`.)

### N2-03 · Detection legt Surprises in die Ablage, ohne das „Brett → Ablage durch Effekt"-Fenster zu öffnen (Furious Anger, Water Golem) · Stufe B
- **Karten:** Furious Anger (`furious-anger.js`), Water Golem (Zweitbeleg), Detection (`detection.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Halter der Reaktion: Furious Anger + Burning Finger (Spell Lv 1) auf der Hand, Held mit Magic Arts/Destruction per `grantFor`; Booby Trap (Held 0) und Frost Rune (Held 1) verdeckt in den Surprise Zones; der Gegner spielt Detection. Beide Sitze.
- **Schritte:** 1. Gegner spielt Detection → beide Surprises gehen in die Ablage des Halters. 2. Prüfen, ob „Furious Anger" angeboten wird. Kontrolle: derselbe Aufbau, aber Goldify besiegt eine Kreatur des Halters. Zweitbeleg: Water Golem auf Held 1, Booby Trap auf Held 0 (liegt zuerst in der Ablage).
- **Erwartet** (Kartentext Furious Anger: „… when a **Surprise** or Creature you control is **sent to the discard pile by an opponent's card or effect** (but not by taking damage)."; Water Golem: „Activate this Surprise when a Surprise on your side of the board is sent to the discard pile by an effect."; CARD_API v697/v1336 „Brett → Ablage durch Effekt"): Detection schickt die Surprises tatsächlich in die Ablage → Furious Anger wird angeboten; Water Golem löst auf die erste abgelegte Surprise aus.
- **Beobachtet:** Kein Fenster. Die Gegenprobe (Goldify auf Kreatur) öffnet das Furious-Anger-Fenster ✓; bei Water Golem gibt es keine Abfrage. Die Surprises liegen korrekt in der Ablage des Besitzers.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/03-furious-anger-detection.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `detection.js:253` schiebt den Namen direkt per `discardPile.push` und `_untrackCard`; es ruft weder `actionMoveCard(…,'discard')` noch `engine._fireBoardSentToDiscard(…)` (`_engine.js:13860-13885`: dort hängen `_checkSurpriseOnSurpriseDiscarded` und `_checkBoardSentToDiscardHandReactions`). (Water Golem ist nur ein Zweitbeleg: er wird von Detection selbst mit abgelegt, das Fenster müsste beim ersten Ablegen offen sein, solange er noch liegt.)

### N2-04 · Forbidden Curse of Aging: befristete Status (Freeze „for 1 turn") laufen nie aus · Stufe C
- **Karten:** Forbidden Curse of Aging (`forbidden-curse-of-aging.js`), Icebolt; Engine `processStatusExpiry` / `removeHeroStatus`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz X legt Aging auf Held 0 des Gegners (echter Spielweg, `aged`-Status), dann Icebolt („Freeze it for 1 turn") auf denselben Helden. Beide Sitze.
- **Schritte:** 1. Aging, Icebolt. 2. Vier echte Zugwechsel (`t.endTurn()` ×4 = zwei volle Runden). 3. Status des Helden lesen. Kontrolle ohne Aging.
- **Erwartet** (Kartentext: „… its other status effects **cannot be removed**."; Lesart A, Standard: „entfernt" = durch einen Effekt weggenommen — Cure, Heal, Cleanse; ein befristeter Status läuft nach seiner Dauer von selbst aus): Frost endet nach seiner Dauer. Lesart B: Aging friert alle Status ein (dann dürfte aber nach dem „Auftauen" kein Frost-Schutz `immune` entstehen).
- **Beobachtet:** Der Held bleibt unbegrenzt gefroren (`["aged","frozen","immune"]` nach vier Zugwechseln) — gleichzeitig legt dieselbe Ablaufstelle den Schutzstatus `immune` an („gefroren UND frostimmun"). Kontrolle ohne Aging: taut nach seinem Zug auf ✓. Damit sind Aging + ein Freeze/Stun eine Dauer-Sperre des Helden mit zwei Karten (Aging selbst ist heilbar: „OTHER").
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/04-aging-statusablauf.js` (✗ = Fehler tritt auf; erwartet Lesart A)
- **Vermutete Ursache:** `_engine.js:~48057` (`processStatusExpiry`, End Phase) ruft `removeHeroStatus(ap, hi, 'frozen')` ohne `bypassUnhealable`; `removeHeroStatus` (`_engine.js:47960`) sperrt über `_heroStatusRemovalBlocked` (`_engine.js:6783`) auch das natürliche Auslaufen; der `immune`-Zweig läuft unbedingt. Nicht angefasst von den Rulings v1096/v1143 (dort nur Cure/Cleanse-Listen).
- **Frage an Al:** Soll Forbidden Curse of Aging nur das *Entfernen durch Effekte* sperren (Frost/Betäubung laufen nach ihrer Dauer ab, wie ohne die Karte) — ja = Lesart A, nein = Lesart B (heute: die Status bleiben bis die Karte fällt)?

### N2-05 · Divine Gift of the Guardian schützt nur die Kreaturen, die beim Ausspielen auf dem Brett stehen · Stufe C
- **Karten:** Divine Gift of the Guardian (`divine-gift-of-the-guardian.js` Z. ~139-175)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Halter: Divine Gift of the Guardian auf der Hand, Held 0 mit Summoning Magic 1; drei „ZZ Dummy"-Kreaturen; der Gegner hat Fireballs. Beide Sitze.
- **Schritte:** 1. Fireball auf Kreatur a → Reaktion. 2. (a) im selben Zug eine neue Kreatur b beschwören, Fireball darauf. (b) Der Gegner stiehlt eine geschützte Kreatur (`actionStealCreature`), Schaden darauf. (c) Der Halter stiehlt eine fremde Kreatur, Schaden darauf.
- **Erwartet** (Kartentext seit Q151, 16.10.2026: „Negate any damage **Creatures you control** would take **until the beginning of your next turn**."): Der Zeitraum gilt laufend für die Kreaturen, die der Halter kontrolliert: (a) neu beschworene und (c) erbeutete Kreaturen sind geschützt, (b) eine gestohlene nicht mehr (Lesart A). Lesart B (heute): Momentaufnahme beim Ausspielen.
- **Beobachtet:** (a) die neue Kreatur nimmt 150 (HP 50); (b) die gestohlene Kreatur (Kontrolle jetzt beim Gegner) behält die Immunität (HP 200 nach 100 Schaden); (c) die erbeutete Kreatur nimmt Schaden (HP 100). Die Immunität hängt als `counters._guardianImmune` an der Kreatur, nicht am Spieler.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/05-divine-gift-guardian-geltungsbereich.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `divine-gift-of-the-guardian.js` stempelt in einer einmaligen Schleife über `engine.cardInstances` (Z. ~139-175) `_guardianImmune`/`buffs.guardian` auf die Kreaturen, die dem Spieler zu diesem Zeitpunkt gehören; keine Kopplung an den aktuellen Kontrolleur, kein Spieler-Zustand „bis zum Beginn deines nächsten Zuges".
- **Frage an Al:** Soll Divine Gift of the Guardian laufend für alle Kreaturen gelten, die der Halter bis zum Beginn seines nächsten Zuges kontrolliert (auch später beschworene/erbeutete; gestohlene nicht mehr) — ja = Lesart A, nein = Momentaufnahme wie heute?

### N2-06 · Spell-Anhängsel an gefrorenem/betäubtem/negiertem Träger: zwei Karten still, drei aktiv · Stufe C
- **Karten:** Gathering Storm (`gathering-storm.js:216`), Intrude (`intrude.js:129`) — still; Energy Aura, Guardian Angel, Idej Projection — aktiv (Invisibility, Forbidden Curse of Aging, Light Ball laut Skript ebenfalls ohne Statusprüfung, nicht einzeln gemessen)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Je Karte: Anhängsel am Helden, dann `frozen` mit Dauer 3 auf den Träger; passender Auslöser (Gathering Storm: Zugbeginn des Gegners; Intrude: Effekt-Ziehen des Gegners; Energy Aura / Idej Projection: Burning Finger; Guardian Angel: tödlicher Burning Finger).
- **Erwartet** (Ruling Welle 7, Al: „Freeze, Stun und Negated unterbrechen *alle* laufende passive Effekte!", CARD_API ~Z. 20256; für Spell-Anhängsel keine Entscheidung; Kommentar `_lightBallProtects`: der Schutz bleibe bei gefrorenem Träger): eine einheitliche Regel.
- **Beobachtet:** `{"Gathering Storm":"still","Intrude":"still","Energy Aura":"aktiv","Guardian Angel":"aktiv","Idej Projection":"aktiv"}`. Gathering Storm und Intrude haben die Prüfung `host.statuses.frozen|stunned|negated → return` (aus den ersten Sets), die übrigen Anhängsel nicht.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/06-anhaengsel-am-gefrorenen-traeger.js` (✗ = uneinheitlich; keine Aussage, welche Seite „richtig" ist)
- **Vermutete Ursache:** Historisch (Commit 4db2f97 „Structure Deck End of the World"): zwei Skripte prüfen den Träger selbst, es gibt keinen Engine-Prüfer für Anhängsel (`isCardPassiveDormant` kennt Kreaturen/Heldenkarten/Abilities).
- **Frage an Al:** Sollen Spell-Anhängsel (Energy Aura, Guardian Angel, Idej Projection, Invisibility …) bei Frost/Betäubung/Negierung des Trägers still liegen wie Gathering Storm und Intrude heute — ja = alle still (dann Energy Aura & Co. nachziehen), nein = alle aktiv (dann die Prüfung aus Gathering Storm und Intrude entfernen)?

### N2-07 · Emergency Spell Armor erkennt einen als Spell geltenden Heldeneffekt (Alice) nicht · Stufe B
- **Karten:** Emergency Spell Armor (`emergency-spell-armor.js:41`), Alice, the Puppeteer Girl
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Wirker: Alice mit 3 „ZZ Dummy"-Kreaturen (`turnPlayed = 1`) → 150 Schaden. Halter: Emergency Spell Armor auf der Hand (Support Magic 1 per `grantFor`), Zielheld mit 100 HP. Beide Sitze.
- **Schritte:** 1. Alice-Effekt aktivieren (`t.activateHero`), Ziel Held 0. 2. Gegenprobe: Burning Finger (echter Zauber) gleich tödlich.
- **Erwartet** (Kartentext: „… would be defeated by a **Spell** or Creature effect. Your Hero's current and max HP drop to 1 instead …"; Alice: „This is treated as this Hero hitting the target with a Destruction Magic **Spell**"; Ruling Q108 Welle 12: Alices Effekt gilt als Spell der Stufe 0): Die Karte wird angeboten, der Held bleibt mit 1 HP.
- **Beobachtet:** Kein Fenster, Held bei 0 HP. Gegenprobe Burning Finger ✓ (1 HP). Das Heldeneffekt-Schadenstyp-`'hero'` (Siphem) löst die Karte nicht aus ✓ (richtig). Frost Rune, Firewall, Jumpscare und Fireshield erkennen Alice über `damageType *_spell` als Spell.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/07-emergency-spell-armor-treated-as-spell.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `emergency-spell-armor.js:41` `spellOrCreatureSource` typt die Quelle nur über den Namen in der Kartendatenbank (Alice = Held). `isAttackSpellOrCreatureSource(engine, { …source, damageType: type })` (`_hooks.js:832`) bzw. `engine._spellLevelAlsQuelle` täten es richtig.

### N2-08 · Flooding und Glass Wall erkennen „als Attack/Spell geltende" Heldeneffekte (Alice, Broghan) nicht · Stufe B
- **Karten:** Flooding (`flooding.js`), Glass Wall (`glass-wall.js:44`); Referenz: Frost Rune, Firewall, Jumpscare
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Surprise verdeckt auf Held 0 des Gegners. Wirker: Alice (3 Kreaturen) bzw. Broghan (500 − 10 × Deckgröße, „treated as an Attack"), Heldeneffekt auf Held 0. Beide Sitze.
- **Schritte:** 1. Heldeneffekt aktivieren. 2. Prüfen, ob die Surprise gefragt wird; Referenz Frost Rune.
- **Erwartet** (Kartentext Flooding: „… chosen by an **Attack or Spell**. Negate …"; Glass Wall: „… chosen by a **level 1 or lower** Attack, Spell or Creature effect …"; Alice „treated as … a Destruction Magic Spell", Q108 „als lv 0 gelten"; Broghan „This is treated as an Attack"): Flooding öffnet sich bei beiden; Glass Wall bei Alice (Stufe 0 ≤ 1).
- **Beobachtet:** Frost Rune ✓, Firewall ✓, Jumpscare ✓ bei beiden Heldeneffekten; Flooding ✗ (Alice und Broghan) und Glass Wall ✗ (Alice). Der Kopf von `flooding.js` (Z. 18-22) schließt „treated as"-Effekte bewusst aus („per card text 'an Attack or Spell'"); das widerspricht Q108 und den vier Schwesterkarten.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/08-flooding-glass-wall-treated-as.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `flooding.js` `surpriseTrigger` prüft nur den Kartentyp der Quelle (`hasCardType(cd, 'Attack'|'Spell')`) statt `isAttackSpellOrCreatureSource(…, { kinds: ['attack','spell'] })`; `glass-wall.js:44` `quellStufe` liest die Stufe nur aus der Kartendatenbank (Held → `null` → keine Auslösung; Alices `treatedAsSpell: { level: 0 }` wird nicht gelesen).

### N2-09 · Gold Trap sieht den Einkommens-Zuschlag (Wealth) nicht, Golden Vermin schon · Stufe B
- **Karten:** Gold Trap (`gold-trap.js`), Wealth, Golden Vermin (Vergleich); Engine `actionGainGold`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz X hat Wealth Stufe 1 an Held 0; der andere Sitz hält Gold Trap verdeckt (Decay Magic 1). Zugbeginn von Sitz X (Resource Phase, +4 Grundeinkommen, +4 Wealth).
- **Schritte:** 1. Zugwechsel (`t.endTurn()`). 2. Prompts und Goldstand lesen. Kontrolle: statt Gold Trap besitzt Sitz X Golden Vermin.
- **Erwartet** (Ruling Welle 11, Q76 Al: „das normale Einkommen sollte unberührt sein. Aber andere Einkommensquellen in der Resource Phase, etwa Wealth oder Semi, dürfen ihn triggern!"; Kartentext Gold Trap „… would gain Gold **through an effect**", Golden Vermin „… when you would gain Gold **through an effect**"): Der Zuschlag (4) ist Effekt-Gold → Gold Trap wird gefragt und leitet nur diese 4 Gold um; das Grundeinkommen (4) bleibt.
- **Beobachtet:** Gold Trap bleibt verdeckt; der Gegner erhält 108 (4 + 4). Golden Vermin wird beim selben Zuschlag gefragt ✓ (`onIncomeBonusGain`).
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/09-gold-trap-wealth-zuschlag.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:25679` `const surpriseResult = hookCtx._isResourceGain ? null : …` — der R01-01-Fix überspringt das Surprise-Fenster für die ganze Resource-Phasen-Buchung; die Zuschläge laufen vorher durch `onIncomeBonusGain` (Z. 25663-25667), das nur Hook-Karten (Golden Vermin) kennt.

### N2-10 · Idej Projection lässt sich per Inheritance Ceremony auf einen Nicht-Idej-Helden umhängen · Stufe B
- **Karten:** Idej Projection (`idej-projection.js`), Inheritance Ceremony (`inheritance-ceremony.js`), Idej Sword (Vergleich)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Idej Lord Daiyo (Held 0) trägt Idej Projection und Idej Sword – Kogarasu; Held 1 ist kein Idej; Inheritance Ceremony auf der Hand, Ziel Held 1. Beide Sitze.
- **Schritte:** 1. Ceremony spielen, Ziel Held 1. 2. Auswahlliste der zu verschiebenden Karten lesen, alle wählen.
- **Erwartet** (Kartentext: „This Spell can only be attached to an "Idej" Hero **by its own effect**."; Skriptkopf: „only ever ATTACHED … into a Support Zone slot of an Idej Hero by the Idej Lords' start-of-game effect or by Idej Projector"; die acht Idej-Equips tragen `canEquipToHero`, `_idej-shared.js:246-268`): Die Projection wird nicht angeboten/verschoben (wie der Sword).
- **Beobachtet:** Der Sword ist nicht in der Liste ✓, die Projection schon; sie hängt danach am Nicht-Idej-Helden 1 (und schützt ihn dort).
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/10-idej-projection-umhaengen-auf-nicht-idej.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `idej-projection.js` exportiert kein `canEquipToHero`; `inheritance-ceremony.js` filtert Ziel-Tauglichkeit über `engine.canEquipCardToHero` (`_engine.js:16585`). (Transmission hat noch kein Skript und ist nicht betroffen.)

### N2-11 · Inheritance Ceremony hängt eine Energy Aura auf einen Helden um, der schon eine trägt · Stufe A
- **Karten:** Energy Aura (`energy-aura.js`), Inheritance Ceremony
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Per echtem Spielweg Energy Aura an Held 0 und Held 1 desselben Spielers (legal: eine je Held); Inheritance Ceremony von Held 0 auf Held 1, Aura wählen. Beide Sitze.
- **Schritte:** 1. Aura an Held 0 und 1. 2. Gegenprobe: eine dritte Aura regulär an Held 1 spielen (scheitert). 3. Ceremony: Aura von Held 0 nach Held 1.
- **Erwartet** (Kartentext: „A Hero can only have 1 "Energy Aura" attached to it at a time."): Held 1 trägt höchstens eine Aura; die Verschiebung wird nicht angeboten bzw. nicht ausgeführt.
- **Beobachtet:** Held 1 trägt danach zwei Auren (`["Energy Aura","Energy Aura",""]`); das reguläre Anlegen einer zweiten Aura wird (zu Recht) verweigert.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/11-energy-aura-nur-eine-je-held-umhaengen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `energy-aura.js:70-90` `hatBereitsAura`/`hostOpts()` gilt nur beim Anlegen (`attachmentHosts`, `spellPlayCondition`, `onPlay`); das Skript hat kein `canEquipToHero`, das `engine.canEquipCardToHero` (`_engine.js:16585`) für das Umhängen auswerten könnte. Gleiche Lücke für jedes „ein je Held"-Anhängsel, das über Ceremony laufen darf (Intrude/Guardian Angel haben bereits spielweite Grenzen und ließen sich legal nicht doppeln, so nicht messbar).

### N2-12 · Mehrere Surprises auf verschiedenen Zielen eines Zaubers: die Zielreihenfolge entscheidet, ob Firewall/Jumpscare verbraucht werden · Stufe C
- **Karten:** Firewall, Jumpscare, Flooding (`_checkSurpriseWindow`, `_engine.js:37082`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Pyroblast (Lv 0, „Choose any number of targets … 100 damage") auf Held 0 und 1 des Gegners; Held 0/1 tragen Firewall bzw. Jumpscare und Flooding in beiden Reihenfolgen. Beide Sitze.
- **Schritte:** 1. Pyroblast mit beiden Helden als Ziel. 2. Reihenfolge A: Firewall (Held 0), Flooding (Held 1); Reihenfolge B: Flooding (Held 0), Firewall (Held 1). Zonen und Angreifer-Status vergleichen.
- **Erwartet:** unabhängig von der Zielreihenfolge. Lesart A: ein „hit by"-Effekt (Firewall) bzw. „After the … effect resolves" (Jumpscare) feuert nicht für einen Zauber, der durch Flooding gar nicht trifft; Negierer laufen zuerst. Lesart B (heute): in Zielreihenfolge.
- **Beobachtet:** A: Firewall feuert (Angreifer −100, `burned`) und ist verbraucht, danach negiert Flooding den Zauber; B: Flooding negiert zuerst, Firewall bleibt verdeckt, Angreifer unversehrt. Jumpscare: A verbraucht (ohne Betäuben, weil negiert), B bleibt verdeckt. Es zählt also die Klick-Reihenfolge des Wirkers.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/12-surprise-reihenfolge-mehrfachziel.js` (✗ = Verbrauch hängt von der Reihenfolge ab)
- **Vermutete Ursache:** `_engine.js:37082-37300`: eine Schleife über die Ziele, je Ziel höchstens eine Aktivierung, beim ersten `effectNegated` Abbruch; es gibt keine Rangfolge „chosen by" (Negierer) vor „hit by".
- **Frage an Al:** Sollen bei mehreren Zielen eines Zaubers zuerst die Negierer („is chosen by … negate": Flooding, Frost Rune, Glass Wall) auflösen und „hit by"-/„after it resolves"-Surprises (Firewall, Jumpscare, Booby Trap) nur noch für einen Zauber feuern, der tatsächlich trifft — ja/nein (heute: Zielreihenfolge)?

### N2-13 · Energy Aura gegen Gathering Storm: Aura bleibt bis Zugende liegen, Ziehen verspätet, und sie wehrt den zweiten gleichnamigen Tick ab · Stufe B
- **Karten:** Energy Aura (`energy-aura.js`), Gathering Storm (`gathering-storm.js`); Engine `heroSpellWardBlocks` (`_engine.js:7490`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz X hat Gathering Storm an Held 0 (und im zweiten Lauf an Held 1 einen zweiten); Sitz Y trägt Energy Aura an Held 0 (Y wählt jeweils die 3 ersten Ziele). Beide Sitzverteilungen.
- **Schritte:** 1. Zugwechsel: Zugbeginn von Y, Gathering-Storm-Tick(s). 2. Zustand von Held 0 (HP, Support), Hand von Y.
- **Erwartet** (Kartentext Energy Aura: „Negate the **next time** the Hero … would be affected by a Spell, and if you do, send this attached card to your discard pile and draw 2 cards."; Rulings 14.9.: Aura räumt nach der Auflösung ab): Nach dem ersten Treffer liegt die Aura sofort in der Ablage, Y hat 2 Karten mehr; ein zweiter Gathering Storm trifft Held 0 (70).
- **Beobachtet:** Held 0 bleibt bei 800 (auch nach dem zweiten Tick, obwohl die anderen Helden 140 nehmen), die Aura liegt noch am Helden (erst am Zugende abgeräumt: Hand +2 dort), die Karten kommen nicht sofort.
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/13-energy-aura-gathering-storm.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Das Aufräumen hängt an `afterSpellResolved` (Karte wird gewirkt), der Rückfall an `onTurnEnd`/`onTurnStart` (Kopfkommentar „höchstens einen halben Zug"); Gathering Storm tickt im Zugbeginn-Hook ohne diesen Haken. Bis dahin blockt die verbrauchte Aura jeden weiteren Spell mit demselben NAMEN (`counters._wardSpentOn === spell`, `_engine.js:7515-7526`) — zwei Gathering Storms teilen sich daher eine Aura.

### N2-14 · Guardian Angel + Forbidden Curse of Aging: Held überlebt mit 1 HP, Engel verbraucht · Stufe C
- **Karten:** Guardian Angel (`guardian-angel.js`), Forbidden Curse of Aging
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz X legt Guardian Angel und Aging auf Held 0 des Gegners (HP 100), dann Burning Finger (240 Schaden). Beide Sitze.
- **Schritte:** 1. Beide Anhängsel, 2. tödlicher Zauber.
- **Erwartet** (Kartentext Guardian Angel: „If the Hero … would be defeated, **fully heal its HP** instead and delete this card."; Aging: „The HP … **cannot be healed**"): Lesart A (heute): Niederlage ersetzt, Heilung scheitert, Held mit 1 HP am Leben, Engel gelöscht. Lesart B: ohne mögliche Heilung tritt der Ersatz nicht ein → Held besiegt, Engel bleibt (Kartentexte lassen beides zu).
- **Beobachtet:** Held bei 1 HP am Leben, Guardian Angel im Gelöscht-Stapel (einmal pro Spiel weg); die „volle Heilung" bleibt aus. (`hero.hp = 1` wird vor dem Heilen gesetzt.)
- **Repro:** `docs/niche-tests/repro/N2-reaktionen-b/14-guardian-angel-gealtert.js` (✗ = weder Lesart B noch „voll geheilt"; reine Fragen-Repro)
- **Vermutete Ursache:** `guardian-angel.js` `onHeroKO`: löscht die Karte, setzt `hero.hp = 1` und ruft dann `actionHealHero`; die Heilsperre (`_heroHealBlocked`) lässt nur den 1-HP-Rest.
- **Frage an Al:** Soll Guardian Angel gegen einen Helden mit Forbidden Curse of Aging den Helden mit 1 HP am Leben lassen und sich verbrauchen (heute) — ja = Lesart A, nein = der Held wird besiegt und der Engel bleibt liegen?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Divine Gift of Edge | L2 gezielt | Reaktion zwischen den Phasen (2 Fenster je Zugwechsel), nur auf Gegnerzug ✓; Held gefroren ✗-erwartet ✓; proaktiv: Abbruch der Galerie → Karte zurück, kein Stempel, keine Aktion ✓, Pick → Stempel + Reveal ✓; Stempel-Schlüssel mit den anderen Divine Gifts ✓ |
| Divine Gift of Rain | L2 gezielt | Kreaturen-, Heldeneffekt-, Attack-, Artefakt-Quelle, Zwei-Ziele-Fireball (beide eigene) ✓, Piercing (Rockfall) wie Flooding/Frost Rune ✓, Gathering-Storm-Tick ✓, Einmal-Stempel ✓; Rulings W18/W20 nicht neu gemeldet |
| Divine Gift of the Guardian | L2 gezielt | Reaktion auf Gegnerzug und eigenen Zug (Ablauf `expiresAtTurn` ✓), Wirker-Pflicht (W21) nicht neu; Geltungsbereich bei später beschworenen/gestohlenen Kreaturen ✗ (→ N2-05) |
| Divine Gift of Time | L2 gezielt | Mill (3 Karten, ein Fenster), Hand-Limit-Abwurf (Rettung, Zustand sauber), Kreaturentod (eigener Gestohlener ✓; durch mich gestohlen/Gegner-Ablage: kein Angebot ✓), Wirker-Bedingung W21 nicht neu |
| Divine Punishment | L2 gezielt | Negation eines Heldeneffekts, Rundensperre wird zurückgegeben (zweite Aktivierung geht) ✓; Wirker gefroren/betäubt/tot/ohne Schule → keine Reaktion ✓; `negated` hart (Abilities weg) keine Reaktion, leicht (`effectOnly`) Reaktion ✓ (Ruling W13) |
| Emergency Spell Armor | L2 gezielt | zwei Karten/zwei Helden lethal ✓, Attack-Karte keine Reaktion ✓, Kreatureneffekt ✓, Heldeneffekt (Typ hero) keine Reaktion ✓, Wirker gefroren/betäubt/negiert ✓, „Draw 2" ablehnen ✓; Alice-Typ ✗ (→ N2-07) |
| Energy Aura | L2 gezielt | zwei Auren/Fireball auf beide ✓, Icebolt (Schaden + Frost, 1× ziehen) ✓, Flooding auf anderem Ziel, Rückfall am Zugende ✓, Attack unberührt ✓, gefrorener Träger aktiv ✓, eigenes Heal verbraucht ✓, Piercing (Rockfall) ✓; Gathering Storm ✗ (→ N2-13), Umhängen ✗ (→ N2-11) |
| Fireshield | L2 gezielt | Spell/Attack-Pfad ✓, Kreaturenquelle ✓ (Rückstoß 50 auf Kreatur), Flächenschaden (nur ein Fenster, ein Exemplar) ✓, Artefakt/Trank/Gift keine Reaktion ✓; Heldeneffekt ✗ (→ N2-02) |
| Firewall | L2 gezielt | Host-Status-Tabelle (frozen/stunned/negated/magic_silenced/tot) ✓, Kreaturenangreifer stirbt, Effekt läuft weiter ✓, Kontrollwechsel (perm./temp.) ✓, eigener Zauber auf eigenen Host kein Auslöser ✓; Reihenfolge ✗ (→ N2-12) |
| Flooding | L2 gezielt | Statuszauber ohne Schaden (Disruption Ray, Overheal Shock, Petrifier, Warlord's Bite, Cold Coffin, Icebolt, Heal) ✓, Einmal-Stempel nach Negation ✓, Host-Tabelle ✓, Kontrollwechsel ✓; „treated as" ✗ (→ N2-08) |
| Forbidden Curse of Aging | L2 gezielt | Anlegen, Statussperre, Tod des Trägers (Karte in Ablage des Wirkers) ✓; Ablauf von Frost ✗ (→ N2-04), Kombination Guardian Angel ✗ (→ N2-14) |
| Frost Rune | L2 gezielt | Freeze-Dauer über 4 Zugwechsel ✓, Kreaturenangreifer (Jiggles) eingefroren, Aktivierung danach gesperrt ✓, Einmal-Stempel nach Negation ✓, Heldeneffekt ohne Typ nicht ✓, Host-Tabelle ✓, Kontrollwechsel ✓ |
| Furious Anger | L2 gezielt | per echtem Goldify besiegte Kreatur → Angebot ✓, Schadenstod kein Angebot ✓, Trial of Dominance (löscht statt abzulegen) kein Angebot ✓, gestohlene Kreatur → Angebot geht an den Kontrolleur, Kreatur liegt in der Ablage des Besitzers ✓; Abbruch der Spellwahl verbraucht die Karte (heute so, nicht gemeldet); Detection ✗ (→ N2-03). Nicht belastbar gemessen: Token und eigener Effekt (Goldify lehnt Token als Ziel ab, synthetische Quellen liefern kein `sourceOwner`) |
| Gathering Storm | L2 gezielt | 3 Ziele (Helden + Kreaturen), nur 1 Ziel am Leben ✓, White Eye auf Host ×2 / auf anderem Helden ×1 ✓, Kontrollwechsel des Hosts (perm. → Wirkung kehrt sich um, temp. endet) ✓, Rain-Fenster ✓; gefrorener Host still (→ N2-06) |
| Glass Wall | L2 gezielt | erste Aktivierung (Stufe 1, bleibt offen/Ablage), zweite Aktivierung gegen Attack (Einzel- und Flächenziel) ✓, Tod des Trägers (Karte bleibt), zweite Surprise in belegte Zone verweigert ✓, Host-Tabelle ✓; Alice-Stufe ✗ (→ N2-08) |
| Gold Trap | L2 gezielt | Host-Tabelle ✓, Kontrollwechsel (perm./temp.: W19/20 nicht neu), Abbruch einer Gold-Karte (Book of Doom) erzeugt kein Gold-Ereignis ✓; Resource-Phase-Zuschlag ✗ (→ N2-09) |
| Graveyard of Limited Power | L2 gezielt | Gleichstand keine Wirkung, Spitzenreiter-Seite hängt vom Ablagestapel ab, Held und Kreatur als Ziel +50, Spell-Quelle keine Wirkung, zwei Areas (je Spieler) addieren, Petrifying Potion (Schaden 0 bleibt 0) ✓ |
| Guardian Angel | L2 gezielt | Anlegen am Gegner, tödlicher Zauber/Gifttick/Defeat-Effekt, AoE (nur ein Engel), zweiter Engel pro Spiel verweigert ✓, Engel im Gelöscht-Stapel des Besitzers ✓; Aging ✗ (→ N2-14) |
| Idej Projection | L2 gezielt | Icebolt (Frost mitnegiert, zwei Projections → eine Abfrage), AoE (je Held), Gifttick, gefrorener Träger aktiv ✓, geklauter Held (Abfrage an den Kontrolleur) ✓; Umhängen ✗ (→ N2-10) |
| Intrude | L2 gezielt | Resource-Phase-Draw ohne Angebot ✓, Negieren/Kopieren (Hauptdeck und Trankdeck) ✓, Abbruch brennt den Stempel nicht ✓, zweite Ziehung desselben Zuges ohne Angebot ✓, Host gefroren/tot ✓, Ziehen des Gegners im Zug des Intrude-Besitzers ohne Angebot ✓; gefrorener Host still (→ N2-06) |
| Invisibility | L2 gezielt | unwählbar für Fireball/Jiggles, AoE trifft ✓, abgeworfen bei Zauber mit Gegnerziel (Disruption Ray, Bite, Petrifier, Heal, Icebolt) ✓, Tod beider anderer Helden → abgeworfen ✓, Zerstörung/Revive löschen Status ✓; Kreaturenschaden ✗ (→ N2-01) |
| Jumpscare | L2 gezielt | Statuswirkung auf Held und Kreatur (Dauer 2 über echte Zugwechsel) ✓, veralteter Negationsmerker kein Fehler ✓, Host-Tabelle ✓, Kontrollwechsel ✓, Heldeneffekt (Typ hero) kein Auslöser ✓; Reihenfolge ✗ (→ N2-12) |

## Getestet & in Ordnung (Auswahl)
* Surprise-Host-Tabelle (6 Surprises × frozen/stunned/negated/magic_silenced/tot/gesund): alle feuern nur beim gesunden Host.
* Abgegebener Host (permanent und temporär) für Frost Rune, Flooding, Firewall, Jumpscare, Glass Wall: nur der Kontrolleur wird gefragt, die Karte geht in die Ablage ihres Besitzers.
* Einmal-Stempel nach Negation: Flooding und Glass Wall geben `Pyroblast` (1/Zug) zurück (zweiter Pyroblast spielbar); bei Frost Rune bleibt `hoptUsed` leer (die zweite Probe scheiterte nur am eingefrorenen Wirker).
* Divine Punishment: Heldeneffekt negiert, Rundensperre zurückgegeben; Wirker-Bedingungen laut W13/W20.
* Hand-Limit-Abwurf mit Divine Gift of Time (3 Karten, ein Fenster, Zustand sauber).
* Furious Anger: kein Angebot bei Schadenstod und bei „defeat and delete" (Trial of Dominance); gestohlene Kreatur → Angebot an den Kontrolleur, Kreatur in der Ablage des Besitzers.
* Gathering Storm bei Kontrollwechsel des Hosts: dauerhaft → Wirkung wechselt zum neuen Kontrolleur; temporär endet mit dem Zug.
* Dauerfeuer (`lib/barrage.js`) für alle 22 Karten, beide Sitze: keine Fehler/Hänger/Auffälligkeiten.

## Bewusst nicht getestet
* Rulings aus Wellen 15/19/20/21 (Hand-Reaktionen über kontrollierte Helden, Schulprüfung des Wirkers bei Time/Guardian/Unwanted Audience): nur Stichproben, keine Wiederholung.
* Dark Ocean / Defending the Gate / Erst-Runden-Immunität in Kombination mit diesen 22 Karten.
* Drei- und Vier-Spieler-Partien (Gewinner bei Gleichstand, „player with more cards" in Graveyard of Limited Power bei Mehrspielern).
* Zugriffe über die echte Client-Ansicht (Animationen, Kartenbild-Reveal-Zeitpunkte, Klänge): Protokollverträge nur stichprobenartig.
* Transmission und Trap Sabotage haben kein Skript (kein Test möglich).
* Jumpscare-Aufschub bei Auslösern ohne Aufräumhaken (Kreaturen-Einsatzeffekte): es fand sich kein passender einfacher Auslöser.
