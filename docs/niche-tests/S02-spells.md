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

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
