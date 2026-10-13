# S02-spells – Nischenfall-Bericht
Stand/Autor: Agent S02-spells, 12.10.2026. Karten: 41 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird ergänzt) mit Befund.

## Zusammenfassung
(Entwurf – wird am Ende ausgefüllt. Arbeitsstand: Befunde werden nach jedem bestätigten Fall ergänzt.)

## Befunde
### S02-01 · Healing Melody heilt nach Besitz statt nach Kontrolle · Stufe A
- **Karten:** Healing Melody (`cards/effects/healing-melody.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Healing Melody], Held 0 bekommt per `grantFor` Support Magic 2 (150 HP). (a) Kreatur „ZZ Dummy" auf Sitz 1 mit 100/200 HP, per `actionStealCreature(0, …)` gestohlen (controller 0, owner 1); (b) eigene Kreatur auf Sitz 0 mit 100/200 HP, per `actionStealCreature(1, …)` vom Gegner gestohlen; (c) eigener Held 1 (300 HP) per `actionStealHero(1, 0, 1)` vom Gegner kontrolliert.
- **Schritte:** 1. Szene aufbauen. 2. Healing Melody mit Held 0 spielen (Bestätigung = Ja).
- **Erwartet** (Kartentext „Heal all targets you control for 100/150/200 HP."; CARD_API.md „Kontrolle statt Seite" und „Übernommene Helden gelten als Helden des Kontrolleurs"): (a) die gestohlene Kreatur, die ich kontrolliere, wird geheilt; (b) meine Kreatur unter Gegnerkontrolle wird nicht geheilt; (c) mein Held unter Gegnerkontrolle wird nicht geheilt.
- **Beobachtet:** (a) ✗ bleibt bei 100 HP; (b) ✗ wird auf 200 geheilt – der Gegner profitiert; (c) ✗ Held 1 wird auf 450 geheilt. (Umgekehrt: ein vom mir per Charme kontrollierter Gegnerheld wird geheilt ✓, weil dafür eine `charmedBy`-Sonderschleife existiert.)
- **Repro:** `docs/niche-tests/repro/S02-spells/01-healing-melody-besitz-statt-kontrolle.js` (`node …`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/healing-melody.js` Z. 101–128: Helden aus `gs.players[pi].heroes` (ohne `heroesControlledBy`), Kreaturen über `c.owner === pi` aus `ps.supportZones`; nur Gegnerhelden mit `charmedBy === pi` kommen dazu. Die Schwesterkarten Energy Drain / Forbidden Zone / Laser Volley nutzen bereits `heroesControlledBy` und `controller ?? owner`.

### S02-02 · Howling in the Night trifft Helden unter Gegnerkontrolle nicht · Stufe B
- **Karten:** Howling in the Night (`cards/effects/howling-in-the-night.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Howling in the Night]; Gegnerheld 0 per `actionTakeHeroPermanently(0, 1, 0)` dauerhaft von Sitz 0 kontrolliert, MEIN Held 2 per `actionTakeHeroPermanently(1, 0, 2)` dauerhaft von Sitz 1 kontrolliert.
- **Schritte:** 1. Howling mit Held 0 spielen.
- **Erwartet** (Kartentext „Heroes your opponent controls cannot use Spells until the beginning of your next turn"; Skriptkopf „nach KONTROLLE, nicht Besitz"; CARD_API „Kontrolle statt Seite"): `frightened` auf Gegnerheld 1 und 2 UND auf meinem Held 2 (ihn kontrolliert der Gegner); nicht auf dem von mir kontrollierten Gegnerheld 0.
- **Beobachtet:** Gegnerheld 1/2 ✓ frightened, Gegnerheld 0 (von mir kontrolliert) ✓ frei – aber mein vom Gegner kontrollierter Held 2 ✗ bleibt ohne Status und kann für den Gegner weiter Spells wirken. (Standardablauf ✓: Status bis Zugbeginn Zug 7, Spell-Versuch des Gegners im Zug 6 wird abgelehnt.)
- **Repro:** `docs/niche-tests/repro/S02-spells/02-howling-held-unter-gegnerkontrolle.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `howling-in-the-night.js` Z. 88–104 iteriert `gs.players[oi].heroes` und überspringt dort nur `permaControlBy/charmedBy === pi`; es fehlt `heroesControlledBy(oi)` (auch `spellPlayCondition` Z. 51–55 prüft die physische Spalte).

### S02-03 · Divine Gift of The Light löst auch bei heilenden Support-Zaubern aus (Energy Drain, Inheritance Ceremony) · Stufe B
- **Karten:** Divine Gift of The Light (`divine-gift-of-the-light.js`), Energy Drain (`energy-drain.js`), Inheritance Ceremony (`inheritance-ceremony.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Hand [Divine Gift of The Light] → liegt als Permanent; danach der zweite Zauber mit Held 0 (`grantFor`), Held 0 auf 500 HP (Energy Drain) bzw. Held 1 auf 300 HP und Regler „60 HP" (Inheritance Ceremony).
- **Schritte:** 1. Gift spielen. 2. Energy Drain bzw. Inheritance Ceremony spielen. 3. Mitzählen, ob das Gift-Heilfenster („Choose a target to heal for 100 HP") aufgeht.
- **Erwartet** (Kartentext „… the first time every turn a Hero uses a Support Magic Spell that does not heal the HP of one or more targets …"): Energy Drain („Heal the user for 100 HP") und Inheritance Ceremony (mit übertragenen HP: „heal the target's HP") heilen HP → kein Gift-Fenster. Kontrollproben: Heal (heilt) löst nicht aus ✓, Divine Zeal (heilt nicht) löst aus ✓.
- **Beobachtet:** Beide Zauber öffnen das Fenster (je 1 Ziel-Prompt), obwohl sie geheilt haben (Held 1: 300 → 360).
- **Repro:** `docs/niche-tests/repro/S02-spells/03-divine-gift-light-heilende-zauber.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `divine-gift-of-the-light.js` Z. 218–219 liest nur das statische Skript-Flag `includesHealing`. Es steht nur auf Cure, Heal, Healing Melody; es fehlt auf Energy Drain, Inheritance Ceremony (dort hängt das Heilen zudem an der Reglerwahl), Refreshing Night, Light Ball u. a. Zahlenprobe: von 14 Support-Zaubern, deren Text „heal" enthält, tragen nur 3 das Flag.

### S02-04 · Divine Gift of The Light: „the first time every turn" – je Held oder einmal je Zug? · Stufe C
- **Karten:** Divine Gift of The Light
- **Voraussetzungen / Aufbau:** Gift als Permanent; Helden 0 und 1 brennen; Divine Zeal mit Held 0, danach (neue Aktion) Divine Zeal mit Held 1 im selben Zug.
- **Erwartet** (Kartentext „the first time every turn a Hero uses a Support Magic Spell …"): wörtlich EIN Heilfenster je Zug. Das Skript (Kopfkommentar „Per-hero HOPT", Z. 230–232 `gift-of-light:${caster}:${hero}`) gibt eines je Held.
- **Beobachtet:** nach dem zweiten Zauber (anderer Held, selber Zug) öffnet sich das zweite Fenster (2 Fenster in einem Zug).
- **Repro:** `docs/niche-tests/repro/S02-spells/04-divine-gift-light-je-held-statt-je-zug.js` (✗ = die Lesart „einmal je Zug" wird nicht erfüllt)
- **Frage an Al:** Soll das Heilfenster einmal je Zug (egal welcher Held) oder einmal je Held und Zug aufgehen? (je Zug / je Held)

### S02-05 · Flame Avalanche / Last Resort: Schadenssperre misst Besitz/Spalte statt Kontrolle · Stufe B
- **Karten:** Flame Avalanche (`flame-avalanche.js`, setzt `ps.damageLocked`), Last Resort (`last-resort.js`, gleicher Mechanismus); Fehler sitzt in der Engine.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Flame Avalanche], Held 0 bekommt per `grantFor` Destruction Magic 3. Kreatur X (Besitzer 0) per `actionStealCreature(1, X)` vom Gegner kontrolliert, Kreatur Y (Besitzer 1) per `actionStealCreature(0, Y)` von mir kontrolliert, normale Gegnerkreatur Z (je 1000 HP). Zweiter Aufbau mit Helden: mein Held 2 und Gegnerheld 2 per `actionTakeHeroPermanently` (dauerhafte Kontrolle, damit der Charme-Schadensschutz nicht stört) vertauscht.
- **Schritte:** 1. Flame Avalanche spielen (trifft alles, was der Gegner kontrolliert, also auch X: 850). 2. Danach mit Sitz 0 als Quelle je 100 `destruction_spell`-Schaden direkt (`actionDealCreatureDamage` / `actionDealDamage`) auf Z, X, Y bzw. die Helden.
- **Erwartet** (Kartentext „You cannot deal any other damage to targets your opponent controls this turn."; CARD_API.md „Kontrolle statt Seite"): Z und X (vom Gegner kontrolliert) gesperrt (0 Schaden), Y (von mir kontrolliert) NICHT gesperrt.
- **Beobachtet:** Z ✓ gesperrt; X ✗ nimmt 100 (850 → 750); Y ✗ wird gesperrt (850 → 850). Bei Helden dasselbe: mein vom Gegner kontrollierter Held 2 ✗ nimmt 100, der von mir kontrollierte Gegnerheld 2 ✗ ist gesperrt.
- **Repro:** `docs/niche-tests/repro/S02-spells/05-schadenssperre-besitz-statt-kontrolle.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~8790–8800 (Heldenpfad: `targetOwner` = Spalte per `players[pi].heroes.includes(target)`) und ~46709 (Kreaturenpfad: `e.inst.owner !== e.sourceOwner`). Beide müssten `controller ?? owner` bzw. `heroSideOf` lesen. Folge in der Praxis: Der Sperrriegel der beiden Zauber hat ein Loch (Zusatzschaden an übernommenen Zielen) und sperrt zu viel (Schaden an eigenen übernommenen Zielen).

### S02-06 · Last Resort: gilt „any other damage" auch für eigene Ziele und für Vorab-Schaden? · Stufe C
- **Karten:** Last Resort (`last-resort.js` Z. 83–87, 190)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Last Resort]; eigene Kreatur (1000 HP) auf Held 1, Gegnerkreatur (1000 HP), Zielwahl Gegnerheld 0.
- **Schritte:** 1. Last Resort spielen (Ziel 1600 Schaden, Nutzer fällt ✓). 2. Danach 100 Schaden auf Gegnerkreatur, eigene Kreatur und eigenen Held 1. 3. Zweiter Aufbau: vor dem Zauber nur 50 Schaden an einem EIGENEN Helden, dann Last Resort.
- **Erwartet** (Kartentext „You cannot deal any other damage the turn you activate this card." – anders als Flame Avalanche steht dort nicht „to targets your opponent controls"): Zusatzschaden an eigenen Zielen ebenfalls gesperrt; ob Vorab-Schaden die Karte unspielbar macht, ist Lesart.
- **Beobachtet:** Gegnerkreatur gesperrt ✓; eigene Kreatur −100 und eigener Held −100 gehen durch (✗ nach wörtlicher Lesart); Last Resort bleibt nach reinem Eigenschaden spielbar (Gate liest `dealtDamageToOpponent`, nicht `dealtDamageAnyTarget`).
- **Repro:** `docs/niche-tests/repro/S02-spells/06-last-resort-schadenssperre-eigene-ziele.js` (✗ = wörtliche Lesart nicht erfüllt)
- **Frage an Al:** Soll Last Resort wie Flame Avalanche nur Schaden an Gegnerzielen sperren (wie jetzt) oder wörtlich ALLEN weiteren Schaden, auch an eigenen Zielen? (nur Gegner / alles)

### S02-07 · Laser Volley: gleichnamige Ziele sind nicht unterscheidbar wählbar – es wird immer das erste verschont · Stufe B
- **Karten:** Laser Volley (`laser-volley.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand Sitz 0 [Laser Volley], Sitz 1 [Füllkarte]; Gegner kontrolliert zwei gleichnamige Kreaturen („ZZ Dummy Big", je 1000 HP) auf Held 0 und Held 1.
- **Schritte:** 1. Laser Volley spielen. 2. Gegner wirft die Füllkarte ab. 3. In der Spar-Galerie klickt er den ZWEITEN Eintrag (Kreatur auf Held 1) an – Antwort in der Form, die der Client schickt (`{cardName, source}`, `public/dist/app-board.js` ~62130).
- **Erwartet** (Kartentext „… they choose that many of their targets. The chosen targets take no damage from this Spell."): die angeklickte Kreatur bleibt bei 1000, die andere nimmt 200.
- **Beobachtet:** Die ERSTE gleichnamige Kreatur (Held 0) wird verschont, die angeklickte (Held 1) nimmt die 200 (1000/800).
- **Repro:** `docs/niche-tests/repro/S02-spells/07-laser-volley-gleichnamige-ziele.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `laser-volley.js` Z. 126–131: `remaining.find(t => t.cardName === sparePick.cardName)` – der Kommentar darüber verspricht „Match by name AND slot", verglichen wird nur der Name. Die Client-Antwort enthält keine Slotangabe (Galerie-Eintrag trägt `heroIdx`, die Antwort nicht), die Galerie ist also für gleichnamige Ziele grundsätzlich nicht eindeutig. Relevant, sobald der Gegner zwei Kopien derselben Kreatur auf verschiedenen Helden hat (z. B. Tokens/Skelette) und eine davon geschont werden soll.

### S02-08 · Heat Wave nach Flame Avalanche: Schadenssperre gilt auch für EIGENE vorverbrannte Ziele · Stufe C
- **Karten:** Heat Wave (`heat-wave.js`), Flame Avalanche (`flame-avalanche.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Flame Avalanche, Heat Wave] (zwei Aktionen über das Zurücksetzen des Harness); vorverbrannt: eine eigene Kreatur (Held 1), eigener Held 2, eine Gegnerkreatur, Gegnerheld 2.
- **Schritte:** 1. Flame Avalanche spielen (`ps.damageLocked`). 2. Heat Wave mit Held 0 spielen.
- **Erwartet** (Flame Avalanche „You cannot deal any other damage to targets your opponent controls this turn."; Heat Wave „Targets that are already Burned take 150 damage instead."): Gegnerziele 0 Schaden; eigene vorverbrannte Ziele nehmen 150 (die Sperre betrifft nur Gegnerziele).
- **Beobachtet:** Gegnerziele ✓ gesperrt, aber auch die eigenen vorverbrannten Ziele (Kreatur 1000 → 1000, Held 2 800 → 800) bleiben ohne Schaden.
- **Repro:** `docs/niche-tests/repro/S02-spells/08-heat-wave-schadenssperre-eigene-ziele.js` (✗ = die Lesart „nur Gegnerziele gesperrt" wird nicht erfüllt)
- **Vermutete Ursache:** `heat-wave.js` Z. ~204: `amount = (preBurned[i] && !damageLocked) ? DAMAGE : 0`; der Kopfkommentar (Z. 19–24) beschreibt das ausdrücklich als „damage branch suppressed". Die Engine (`_engine.js` ~8790) sperrt dagegen nur Gegnerziele; das Skript nullt vorab für alle.
- **Frage an Al:** Soll Heat Wave unter der Flame-Avalanche-Sperre nur den Schaden an Gegnerzielen weglassen oder (wie jetzt) jeden Schaden? (nur Gegnerziele / alles)

### S02-09 · Forbidden Zone negiert eine UNVERSEHRTE Gegnerkreatur nicht (Rückfall `currentHp ?? 0`) · Stufe A
- **Karten:** Forbidden Zone (`forbidden-zone.js`); Muster-Verwandtschaft: C05-01 (Wire Hatchling). Die statische Suche über die 41 Karten dieser Gruppe fand `currentHp ?? 0` nur hier.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1 beschwört per echtem Spielweg „ZZ Dummy" (200 HP, `counters = {}`); zweite Gegnerkreatur vorbeschädigt (currentHp 150). Sitz 0 spielt Forbidden Zone.
- **Erwartet** (Kartentext „Inflict 50 damage to all targets your opponent controls. … Creatures have their effects negated until the end of your opponent's turn."): beide Kreaturen nehmen 50 Schaden und sind negiert.
- **Beobachtet:** Die unversehrte Kreatur nimmt 50 Schaden (200 → 150), wird aber **nicht negiert**; die vorbeschädigte wird negiert. Helden: alle gebunden ✓ (`bound`, läuft Zug 7 aus). Im Normalfall (frisch beschworene Kreatur) negiert Forbidden Zone also keine Kreatur beim ersten Schlag.
- **Repro:** `docs/niche-tests/repro/S02-spells/09-forbidden-zone-unversehrte-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `forbidden-zone.js` Z. 127 `hpVorher.set(…, counters?.currentHp ?? 0)` und Z. 143 `hpJetzt = counters?.currentHp ?? 0`: für nie getroffene Kreaturen ist „vorher" 0 und „nachher" 150 ⇒ `!(hpJetzt < hpVorher)` ⇒ „Schaden verpufft" ⇒ keine Negierung. Richtig wäre ein Rückfall auf die gedruckten HP (wie `_engine.js:45522`).

### S02-10 · Hymn of Rebirth: Zielwahl nicht abbrechbar (Regel 23.9) – abgebrochen wird die Einmal-Karte in die Ablage verbrannt · Stufe B
- **Karten:** Hymn of Rebirth (`hymn-of-rebirth.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Hymn of Rebirth]; Held 1 von Sitz 0 besiegt; Held 0 mit Magic Arts 3 + Singing 1 (Stufe 4 − 1). Zielwahl wird per `targetFn` mit `null` (Abbruch-Knopf) beantwortet.
- **Erwartet** (Ruling CARD_API.md Z. 367–390 „Zielende Karten sind immer abbrechbar … Jede Zielwahl hat einen Cancel-Button … Ausnahme: Pflichtwahl, die der Kartentext erzwingt – dann steht der Grund als Kommentar daneben"; „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand"): Zielwahl `cancellable: true`; nach Abbruch liegt die Karte auf der Hand, Held bleibt tot, kein Once-Stempel.
- **Beobachtet:** Die Zielwahl wird mit `cancellable: false` angeboten (kein Begründungskommentar im Skript); kommt trotzdem eine Abbruch-Antwort an, geht die Karte in die Ablage (Hand leer, Ablage [Hymn of Rebirth]), der Held bleibt tot. Ein Mensch hat ohne Cancel-Knopf keinen Rückweg: wer die Stufe-4-Einmal-Karte ausspielt, muss einen Helden wiederbeleben. (Once-Stempel wird bei Nicht-Wirkung nicht gesetzt ✓; Stufenstaffel Singing 0–3, volle Max-HP beim Wiederbeleben, Gegnerhelden als Ziel, zweite Kopie gesperrt ✓.)
- **Repro:** `docs/niche-tests/repro/S02-spells/10-hymn-of-rebirth-zielwahl-nicht-abbrechbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `hymn-of-rebirth.js` Z. 66–71: `promptEffectTarget(… cancellable: false …)` und `if (!chosen || chosen.length === 0) return;` ohne `gs._spellCancelled = true` (Regel: „wer `promptEffectTarget` roh benutzt, setzt es von Hand – auf JEDEM Abbruchweg").

### S02-11 · Hand of Death: der verzögerte Effekt verfällt, wenn die Karte vor Zugende aus der Ablage geholt wird · Stufe C
- **Karten:** Hand of Death (`hand-of-death.js`); Auslöser der Lage: Magic Sapphire (auch Meditation, Klaus' Mom für Decay Magic).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Hand of Death, Magic Sapphire]; Hand of Death spielen (liegt in der Ablage, `ps._handOfDeathArmed` gesetzt), dann Magic Sapphire spielen und Hand of Death aus der Ablage zurück auf die Hand holen; zwei Zugwechsel (Ende des Gegnerzugs 6).
- **Erwartet** (Kartentext „… at the end of your opponent's next turn, you may choose any target and defeat it."): der Zauber hat einen Effekt für das Ende des nächsten Gegnerzugs gestartet; wörtlich feuert er auch dann.
- **Beobachtet:** Kein Zielprompt, Gegnerheld bleibt bei 800 HP; `_handOfDeathArmed` bleibt als Leiche stehen. (Gegenprobe: bleibt die Karte in der Ablage, besiegt der Zauber am Ende des Gegnerzugs den Gegnerheld 0 ✓ und überspringt den nächsten eigenen Zug ✓; gefrorener Nutzer ⇒ Fizzle ohne Zugsperre ✓; zweite Kopie im selben Zug gesperrt ✓.)
- **Repro:** `docs/niche-tests/repro/S02-spells/11-hand-of-death-karte-aus-ablage-geholt.js` (✗ = Effekt feuert nicht)
- **Vermutete Ursache:** `hand-of-death.js` Z. 143 `if (ctx.card.zone !== 'discard') return;` – der Auslöser ist der Zugende-Listener einer Instanz IN DER ABLAGE (Kopfkommentar: „ANY Hand of Death instance … in either player's discard pile fires"); ohne Karte dort gibt es keinen Listener.
- **Frage an Al:** Soll der Todeshand-Effekt auch kommen, wenn die Karte zwischenzeitlich aus der Ablage genommen wurde (Magic Sapphire/Meditation), oder verfällt er (wie jetzt)? (kommt trotzdem / verfällt)

### S02-12 · Guard Change bietet gestohlene Kreaturen an, kann sie aber nicht bewegen (stille Fehlzüge, Abfrage wiederholt sich bis zu 64-mal) · Stufe B
- **Karten:** Guard Change (`guard-change.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Guard Change]; eine Kreatur von Sitz 1 per `actionStealCreature(0, …)` von Sitz 0 gestohlen (controller 0, owner 1 – sie bleibt physisch in der Zone von Sitz 1). Mensch-Pfad (`engine.isCpuPlayer = () => false`; mit der Harness-Standardeinstellung „beide Sitze CPU" nimmt das Skript den CPU-Kurzweg, der denselben Fehlzug macht und die Karte zurückgibt).
- **Schritte:** 1. Guard Change spielen. 2. In der `guardChangeMove`-Abfrage die gestohlene Kreatur mit dem angebotenen Ziel wählen.
- **Erwartet** (Kartentext „Choose any number of Creatures you control … place them into free Support Zones of other Heroes you control"; Konvention „Kontrolle statt Seite"): entweder wird die gestohlene Kreatur nicht angeboten oder sie lässt sich bewegen.
- **Beobachtet:** Sie wird mit 6 Zielzonen angeboten; der Zug scheitert still, die Abfrage öffnet sich erneut (hier 64 Abfragen bis zur Schleifenbremse), Position unverändert; am Ende „guard_change_fizzle", Karte bleibt auf der Hand. Die Karte ist mit nur einer gestohlenen Kreatur auf dem Brett als spielbar markiert (`spellPlayCondition` zählt sie mit).
- **Repro:** `docs/niche-tests/repro/S02-spells/12-guard-change-gestohlene-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `guard-change.js` Z. 52–61 wählt Kreaturen nach `controller ?? owner`, `moveCreature` (Z. 105–109) und `swapCreatures` arbeiten aber in `players[Kontrolleur].supportZones` – dort liegt die gestohlene Kreatur nicht (`sArr.indexOf(inst.name) < 0` ⇒ `false`), und der Aufrufer wertet das nicht als Fehler.

### S02-13 · Great Offensive lässt gefrorene/betäubte Kreaturen ihren aktiven Effekt benutzen · Stufe B
- **Karten:** Great Offensive (`great-offensive.js`); Engine-Weg `reactivateCreatureEffect` (`_engine.js` ~25180) wird auch von Kohta und Spirit of the Forbidden Grimoire benutzt (nicht gemessen).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Great Offensive]; „Skeleton Mage" (Lv1, „You may once per turn draw 2 cards and discard 1 card afterwards") auf dem Brett seit Zug 1 (`turnPlayed = 1`), gefroren bzw. betäubt (3 Züge).
- **Schritte:** 1. Kontrolle: reguläre Aktivierung der gefrorenen/betäubten Mage (`t.activateCreature`) – abgelehnt ✓ (server.js ~9042 `isCreatureEffectSuppressed`). 2. Great Offensive spielen.
- **Erwartet** (Kartentext „All level 2 and lower Creatures you control use their active effects an additional time (even if they were summoned this turn)"): die Parenthese hebt nur den Beschwörungs-Schlaf auf; eine gefrorene/betäubte Kreatur kann ihren Effekt auch hier nicht benutzen.
- **Beobachtet:** Die gefrorene und die betäubte Mage ziehen/werfen ab (Netto +2 Handkarten); eine negierte Mage tut nichts ✓. Der Zug endet danach wie vorgesehen ✓; schon per Hand benutzter Effekt (HOPT verbraucht) wird erneut gefeuert ✓.
- **Repro:** `docs/niche-tests/repro/S02-spells/13-great-offensive-gefrorene-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `reactivateCreatureEffect` Z. 25184 prüft nur `counters.negated/nulled` (`_creatureNegationProof`), nicht das zentrale Prädikat `isCreatureEffectSuppressed` (frozen/stunned/magic_silenced …); `great-offensive.js` `eigeneAktivKreaturen` (Z. ~11–28) filtert nicht nach Status. Gleiche Klasse wie B-01…B-03 (Status-Prüfung fehlt beim Verbraucher).

### S02-14 · Holy Selection mit Ida: erzwungene Einzelzielwahl ohne Abbruch-Knopf (Regel 23.9) · Stufe B (geringe Auswirkung)
- **Karten:** Holy Selection (`holy-selection.js`), Ida, the Adept of Destruction (Flagge `forcesSingleTarget`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Ida als Held 0 von Sitz 0 (Flagge per Zugbeginn-Hook), zwei Helden mit Necromancy (eigener Held 1, Gegnerheld 0) ⇒ mehr als ein Ziel. Holy Selection mit Ida spielen, Zielwahl mit `null` beantworten.
- **Erwartet** (Ruling CARD_API.md Z. 367ff.: „Jede Zielwahl hat einen Cancel-Button … Ausnahme: Pflichtwahl, die der Kartentext erzwingt – dann steht der Grund als Kommentar daneben"): Ida-Zielwahl `cancellable: true`.
- **Beobachtet:** `cancellable: false`, kein Begründungskommentar; die Abbruch-Antwort selbst wird sauber behandelt (Karte bleibt auf der Hand, kein Schaden ✓), nur ein Mensch hat keinen Knopf dafür. Grundlauf ohne Ida ✓ (alle Necromancy-Helden beider Seiten und alle `_summonedByNecromancy`-Kreaturen inkl. gestohlener −200, andere unversehrt).
- **Repro:** `docs/niche-tests/repro/S02-spells/14-holy-selection-ida-zielwahl-nicht-abbrechbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `holy-selection.js` Z. 175 `cancellable: false` im Ida-Zweig von `onPlay`.

### S02-15 · Love Shot: Heldenwahl liest die Gegnerspalte statt „Held, den dein Gegner kontrolliert" · Stufe B
- **Karten:** Love Shot (`love-shot.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Love Shot, Fireball]; Gegnerheld 0 per `actionTakeHeroPermanently(0, 1, 0)` dauerhaft von Sitz 0 kontrolliert, MEIN Held 2 per `actionTakeHeroPermanently(1, 0, 2)` vom Gegner kontrolliert.
- **Schritte:** 1. Love Shot mit Held 0 spielen. 2. Die angebotene Heldenliste mitschneiden (Abbruch).
- **Erwartet** (Kartentext „choose a Hero your opponent controls"; CARD_API.md „Kontrolle statt Seite"): angeboten werden Gegnerheld 1, 2 und mein vom Gegner kontrollierter Held 2; nicht der von mir kontrollierte Gegnerheld 0.
- **Beobachtet:** Angeboten werden die drei physischen Helden der Gegnerspalte (1:0, 1:1, 1:2); der von mir kontrollierte Gegnerheld 0 steht zur Wahl (Love Shot würde dann mit meinem eigenen Helden als „Zusatzaktion" gewirkt), mein vom Gegner kontrollierter Held 2 fehlt. Sind die übrigen Gegnerhelden tot/gefroren, bleibt nur der eigene Held als „Gegnerheld" übrig.
- **Repro:** `docs/niche-tests/repro/S02-spells/15-love-shot-heldenwahl-nach-besitz.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `love-shot.js` Z. 158 `for (hi …) ops.heroes[hi]` ohne `engine.heroesControlledBy(oi)` (gleiche Klasse wie S02-01/-02). Gegenprobe: gefrorene/betäubte/gebundene/negierte Gegnerhelden werden korrekt nicht angeboten ✓.

### S02-16 · Divine Zeal: Statuswahl (2. Stufe) nicht abbrechbar – ein Abbruch verbrennt die Karte · Stufe B
- **Karten:** Divine Zeal (`divine-zeal.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Divine Zeal]; Gegnerheld 0 brennt und ist vergiftet. Ziel wählen, die folgende `statusSelect`-Abfrage mit `null` abbrechen.
- **Erwartet** (Ruling CARD_API.md Z. 367ff.: „… jede Stufe einer mehrstufigen Auswahl: `cancellable: true` … Abbruch heißt: nichts ist passiert"): die Statuswahl ist abbrechbar, nach Abbruch liegt die Karte auf der Hand, Status unverändert.
- **Beobachtet:** `statusSelect` kommt mit `cancellable: false` (kein Begründungskommentar); die Abbruch-Antwort zählt als „0 Effekte gewählt": Karte in der Ablage, nichts entfernt. Ein Mensch kann nach der Zielwahl nicht mehr zurück (bei mehreren Zielen: n Folgefenster, alle ohne Abbrechen). Grundlauf ✓: 4 Effekte auf 3 Zielen (Helden und Kreatur) entfernt, 2 Karten gezogen.
- **Repro:** `docs/niche-tests/repro/S02-spells/16-divine-zeal-statuswahl-nicht-abbrechbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `divine-zeal.js` Z. 169–176 `statusSelect … cancellable: false`, Z. ~178 `result?.selectedStatuses || []` (Abbruch = leere Wahl).

### S02-17 · Einzelzielwahl (Magic Hammer, Icebolt, Heal u. a.): zwei gegenseitig gestohlene Kreaturen an derselben (Held, Slot)-Stelle lösen beide zur selben Instanz auf – die vom Wirker kontrollierte ist nicht wählbar · Stufe B
- **Karten:** Magic Hammer (`magic-hammer.js`), Icebolt (`icebolt.js`), Heal (`heal.js`) – alle über `ctx.promptDamageTarget`; ebenso Fireball/Explosion (`promptMultiTarget`, dort nur „enemy"). Engine-Fehler; die Stelle ist die Schwester von F02-14 (dort `getCreatureTargets`), nicht dieselbe Funktion.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Magic Hammer] bzw. [Heal]; Sitz 0 besitzt X (Held 0, Slot 0), Sitz 1 besitzt Y (Held 0, Slot 0); `actionStealCreature(1, X)`, `actionStealCreature(0, Y)` (beide bleiben physisch in der Zone ihres Besitzers, also je eine Spalte, dieselbe Koordinate). Beide 500/1000 HP.
- **Schritte:** 1. Zauber spielen, die Zielliste mitschneiden. 2. Die Kachel „Gegnerspalte, Held 0, Slot 0" wählen (id `equip-1-0-0`; dort liegt physisch Y, die ich kontrolliere).
- **Erwartet** (Kartentext „Choose a target and deal 300 damage to it." / „Choose a target and heal it for 150/200/300 HP."; Konvention „Kontrolle statt Seite", CARD_API.md): zwei verschiedene Ziele X und Y; die Wahl der Kachel mit Y trifft Y.
- **Beobachtet:** Beide Listeneinträge (`equip-1-0-0` und `equip-0-0-0`) tragen dieselbe `cardInstance` X; Y kommt in der Liste nie vor und ist damit unwählbar. Hammer: X −300 (500 → 200), Y unversehrt; Heal: X, die der **Gegner** kontrolliert, wird um 150 geheilt (650), die eigene Kreatur Y bleibt bei 500. Bei Fireball/Explosion („opponent controls") bekommt der Gegner-Eintrag ebenfalls die Instanz X (richtiges Ziel, aber die hervorgehobene Kachel ist Y).
- **Repro:** `docs/niche-tests/repro/S02-spells/17-einzelzielwahl-gestohlene-kreaturen-gleiche-koordinate.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `promptDamageTarget` ~Z. 4917 und `promptMultiTarget` ~Z. 5507: `engine.cardInstances.find(c => (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si)` prüft nicht, in WELCHER Spalte die Instanz liegt (`physicalSide`); `find` liefert für beide Spalten den ersten Treffer. Tritt nur bei einem Überkreuz-Diebstahl an gleicher Koordinate auf (z. B. beide Seiten Slot 0 des ersten Helden), dort aber für jede Einzelzielwahl der Engine.

### S02-18 · Xals Support-Zonen-Ability-Stapel zählen bei Haste, Heal, Healing Melody und Instant Cryo Stasis nicht (Prüfauftrag S01-20 auf diese Gruppe angewandt) · Stufe B
- **Karten:** Haste (`haste.js` Z. 24/40), Heal (`heal.js` Z. 99), Healing Melody (`healing-melody.js` Z. 81), Instant Cryo Stasis (`instant-cryo-stasis.js` Z. 36 `inherentAction`); gleiche Zeile steht in Guard Change (`guard-change.js` Z. 45, SM ≥ 2 ⇒ Zusatzaktion) und Hymn of Rebirth (`reduceCardLevel`, Singing) – diese beiden nicht gemessen. Gleiche Klasse wie S01-20 (dort Divine Gift of Death, Create Illusion); hier die Karten dieser Gruppe.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Xal, the Animated Armor als Held 0 von Sitz 0, die Schule ×3 (Cryo: Decay Magic ×2) als Stapel in Xals erster Support Zone, Ability-Zonen leer. Vergleich: derselbe Stapel in der Ability-Zone.
- **Schritte:** 1. Zauber mit Xal spielen (`noGrant`).
- **Erwartet** (Kartentexte „Draw 2/3/4 cards." / „heal it for 150/200/300 HP." / „Heal all targets you control for 100/150/200 HP." / „If the user has at least Decay Magic 2, this counts as an additional Action."; Xal „You may place Abilities into the Support Zones of this Hero"; `effectiveSchoolLevelForCaster` zählt die Stapel ausdrücklich, `_engine.js` ~Z. 43290): Stufe 3 wie in der Ability-Zone: Haste 4 Karten, Heal +300, Healing Melody +200, Cryo als Zusatzaktion.
- **Beobachtet:** Der Zauber wird gespielt (Level-Vertrag sieht den Stapel), wirkt aber auf Stufe 1: Haste zieht 2, Heal +150, Healing Melody +100, Cryo ohne Zusatzaktion. Gegenprobe Draw (nutzt `effectiveSchoolLevelForCaster`): Stapel zählt ✓ (ich 6, Gegner 3).
- **Repro:** `docs/niche-tests/repro/S02-spells/18-xal-support-zonen-stapel-staffel-spells.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `engine.countAbilitiesForSchool(school, ps.abilityZones[heroIdx])` direkt; richtig wäre `effectiveSchoolLevelForCaster(school, pi, heroIdx, heroOwner)` (Vorbild Draw `draw.js` Z. 35, Aurora Borealis). Zusätzlich blendet der direkte Aufruf „as if"-Effekte (`_castSchoolOverride`, z. B. Demon's Gate) aus – nicht gemessen.

### S02-19 · Fire Bolts: beide Zielwahlen („opponent controls" / „you control") lesen die Brettspalte statt der Kontrolle (weiterer Betroffener der Wurzel von S03-06) · Stufe B
- **Karten:** Fire Bolts (`fire-bolts.js` Z. 183 `side: 'enemy'`, Engine `promptDamageTarget`). Gleiche Engine-Wurzel wie S03-06 (Missing People); hier nur als gemessener weiterer Betroffener, keine neue Ursache. Gegenproben: Fireball/Explosion (`promptMultiTarget`) und Instant Cryo Stasis bieten X richtig an und Y nicht an (t10/t33).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Fire Bolts]; Sitz 0 besitzt X (vom Gegner gestohlen: Besitzer 0, Kontrolle 1) und M (eigene); Sitz 1 besitzt Y (von Sitz 0 gestohlen: Besitzer 1, Kontrolle 0) und Z (normale); jeweils 1000 HP.
- **Schritte:** 1. Fire Bolts spielen, beide Zielwahlen mitschneiden.
- **Erwartet** (Kartentext „Choose a target your opponent controls and deal 100 damage to it. Then, choose a target you control and deal 50 damage to it."; „Kontrolle statt Seite"): Liste 1: Gegnerhelden, Z, X – nicht Y; Liste 2: eigene Helden, M, Y – nicht X.
- **Beobachtet:** Liste 1 = Gegnerhelden, Z, **Y** (meine eigene Kreatur wird als „Gegnerziel" angeboten, die vom Gegner kontrollierte X fehlt); Liste 2 = eigene Helden, X, M, Y (**X**, die der Gegner kontrolliert, steht als „eigenes Ziel" zur Wahl, Y steht in beiden Listen).
- **Repro:** `docs/niche-tests/repro/S02-spells/19-fire-bolts-zielwahl-nach-brettspalte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `promptDamageTarget` ~Z. 4880–4940: `addCreatures(opponentsOf(pi))` / `side: 'my'` laufen über die physische Spalte; vgl. S03-06.

### S02-20 · Draw: die gerade gespielte Draw-Karte zählt als „abgeworfene Handkarte" (Cute Bunny, Archibald-Nachwurf) – bei Boris dagegen nicht · Stufe C
- **Karten:** Draw (`draw.js`), Cute Bunny (`cute-bunny.js`), Archibald, the Archmage (`archibald-the-archmage.js`). Prüfauftrag R02-07 („aufgelöste Karte bleibt in `ps.hand`") auf diese Gruppe angewandt: Draw ist die einzige Karte der Gruppe, die „deine ganze Hand" abwirft.
- **Voraussetzungen / Aufbau:** (a) Seed 1234, Zug 5; Cute Bunny im Support, Hand [Draw, 1 weitere Karte], Gegner ohne Karten, Decay Magic 1. (b) Held 0 = Archibald mit Decay Magic 2, Hand [Draw, 2 weitere], Gegner 2 Karten.
- **Schritte:** 1. Draw spielen.
- **Erwartet** (Kartentext „Both players discard their entire hands."; Lesart „die gespielte Karte hat die Hand schon verlassen", Boris-Zählung im Skript selbst `hand.length - 1 // Draw selbst liegt noch drin`): (a) nur EINE Karte wird abgeworfen ⇒ Cute Bunny („2 or more cards") zieht nicht (Hand danach 4); (b) Archibald bietet die gerade gespielte Draw nicht an.
- **Beobachtet:** (a) `onForcedDiscardBatchEnd.countByPlayer[0] = 2` (Draw zählt mit) ⇒ Bunny zieht 1 (Hand 5); (b) `onDiscard` feuert für die Draw-Karte selbst, Archibald fragt „Draw was just discarded — cast it as an additional Action?"; bei Ja wird Draw verschachtelt ein zweites Mal gewirkt (Hand 10 statt 5, Gegner 8 statt 4). Kein Zustandsfehler (Kartenbilanz ✓, Draw liegt genau einmal in der Ablage).
- **Repro:** `docs/niche-tests/repro/S02-spells/20-draw-zaehlt-sich-selbst-als-abgeworfene-handkarte.js` (✗ = die Lesart „zählt nicht" wird nicht erfüllt)
- **Vermutete Ursache:** `draw.js` Z. 18–26 (Kopfkommentar: Draw „as part of your entire hand … is safe") + `dumpHandsTogether` Z. 56–95 wirft `me.hand[0]` bis die Hand leer ist, inklusive der auflösenden Draw (`getResolvingHandIndex → -1`); die Boris-Frage Z. ~113 zählt dagegen `hand.length - 1`.
- **Frage an Al:** Soll die gerade gespielte Draw als abgeworfene Handkarte gelten (Bunny-Schwelle, Archibald-Nachwurf, wie jetzt) oder nicht? (zählt / zählt nicht)

### S02-21 · Haste (reine Zieh-Karte): unter Zieh-/Hand-Sperre spielbar und wirkungslos verbraucht – gegen Tuscan Artist korrekt gesperrt · Stufe B
- **Karten:** Haste (`haste.js` `canPlayWithHero` Z. 20–26). Prüfauftrag A07-19/C01-15 (Zauber mit negiertem Ziehen) auf die Gruppe angewandt; Schwester von S03-24 (Supply Chain).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Haste, 2 Füllkarten], Deck 30. (a) `ps.drawLocked = true` (Zustand nach Sacred Jewel), (b) `ps.handLocked = true` (nach Rain of Spores), (c) Kontrolle: Tuscan Artist auf Sitz 1, Support Magic 1 (Zug von genau 2).
- **Schritte:** 1. Haste spielen. 2. Rückgabe, Hand, Ablage, Aktion lesen.
- **Erwartet** (Kartentext „Draw 2/3/4 cards."; CARD_API.md ~Z. 1944 „Draw-only unter Hand-Sperre ⇒ GAR NICHT spielbar"; `_draw-block-shared.js` Ruling 16.8.: Karten, deren Zug der einzige Nutzen ist, sind gesperrt): (a)/(b) Haste nicht spielbar, bleibt auf der Hand, Aktion frei.
- **Beobachtet:** (a)/(b) `play` ⇒ true, Haste in der Ablage, nichts gezogen (Deck 30 → 30), Aktion verbraucht. (c) gesperrt ✓ (Haste fragt `drawWouldBeBlocked`, aber weder `drawLocked` noch `handLocked`). Unter `searchLocked` zieht Haste regulär ✓ (Draws bleiben frei).
- **Repro:** `docs/niche-tests/repro/S02-spells/21-haste-ziehsperren.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** kein `blockedByHandLock` auf `haste.js`; der Loader markiert reine Zieh-Karten nur bei `resolve`-Modulen (`_loader.js` ~Z. 442) und lässt `hooks.onPlay`-Spells bewusst aus („eine Verhaltensänderung, die Al entscheiden sollte", `_loader.js` ~Z. 456). Wo die Ausnahme für Spells ausdrücklich offen ist, ist Haste das klarste Beispiel (Zug ist der gesamte Inhalt, und das Tuscan-Artist-Gate besteht schon).

### S02-22 · Gate to the Armory ignoriert die Such-Sperre (Deck-Suche und Hand-Zugang) · Stufe B
- **Karten:** Gate to the Armory (`gate-to-the-armory.js` `_getEligibleArtifacts` Z. 52–72, Entnahme Z. 267–270). Fällt unter die in CARD_API.md genannte „Altlast: Skripte splicen das Deck/die Ablage direkt, ohne das Gate" (`pileOutAllowed`); hier als gemessener Einzelfall.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [Gate to the Armory, Füllkarte]; Deck [Glass Sword, Gravedigger's Shovel, Füllkarten]; Ablage [ZZ Trinket]. (a) `ps.searchLocked = true`, (b) zusätzlich `searchLockedIncludesDiscard = true`, (c) `ps.handLocked = true`.
- **Schritte:** 1. Gate spielen (Antwort auf „Zusatzaktion?" = Nein), den ersten Eintrag der Galerie wählen.
- **Erwartet** (Kartentext „Choose an Artifact from your deck or discard pile and add it to your hand."; `_engine.js` ~Z. 10618–10660: `searchLocked` sperrt Deck-Suche und Adds, `searchLockedIncludesDiscard` zusätzlich die Ablage, `handLocked` „sperrt ALLES: Draws UND Suchen/Tutoren/Adds"; Gegenprobe Graveyard Gathering ist unter `searchLocked`/`handLocked` korrekt nicht spielbar): (a) keine Deck-Einträge in der Galerie; (b)/(c) nichts wählbar.
- **Beobachtet:** In (a), (b) und (c) bietet Gate die volle Galerie an (Glass Sword/deck, Gravedigger's Shovel/deck, ZZ Trinket/discard), nimmt Glass Sword aus dem Deck (Deck 4 → 3) und legt es auf die Hand.
- **Repro:** `docs/niche-tests/repro/S02-spells/22-gate-to-the-armory-such-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `gate-to-the-armory.js` trägt weder `blockedBySearchLock` noch fragt es `engine.searchLockLevel`/`pileOutAllowed`; die Loader-Erkennung (`_loader.js` ~Z. 462) sieht nur „reine" Such-Skripte, Gate hat zwei Zweige (Add oder Ausrüsten).

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
