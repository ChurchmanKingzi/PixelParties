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

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
