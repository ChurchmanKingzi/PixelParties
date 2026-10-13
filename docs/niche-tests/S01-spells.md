# S01-spells – Nischenfall-Bericht
Stand/Autor: Agent S01-spells, 12.10.2026. Karten: 41 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### S01-01 · Negiertes Divine Gift verbraucht die gemeinsame Einmal-pro-Spiel-Grenze nicht · Stufe B
- **Karten:** alle Normal-Zauber „Divine Gift of …" der Liste (Balance, Biseria, Creation, Death, Equality, Fire, Forgetting, Magic, Sacrifice, Skill, the Deepsea); getestet mit Divine Gift of Fire (`cards/effects/divine-gift-of-fire.js`) und Divine Gift of Skill, Server `doPlaySpell`.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Divine Gift of Fire + Divine Gift of Skill auf der Hand; Sitz 1: Silence auf der Hand (Held 0 mit Magic Arts, Silence = Reaktion, negiert einen Zauber).
- **Schritte:** 1. Sitz 0 spielt Divine Gift of Fire (Spielerwahl Sitz 1), Sitz 1 antwortet mit Silence. 2. Sitz 0 spielt im selben Zug Divine Gift of Skill.
- **Erwartet** (Quelle: Kartentext „You can only activate 1 "Divine Gift" card per game."; Ruling `CARD_API.md` ~Z. 11418-11440, v1031: „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …, **unabhängig davon, ob ein Gegenzug sie später negiert**."): Das negierte Gift stempelt `divineGift`; das zweite Gift ist nicht mehr spielbar.
- **Beobachtet:** Das erste Gift landet negiert in der Ablage, `_oncePerGameUsed` bleibt **leer**, das zweite Gift wird gespielt und wirkt voll (4 Bonus-Anhänge für Held 0); erst danach steht `divineGift` im Set. Damit lässt sich die „1 Divine Gift pro Spiel"-Regel aushebeln, indem der Gegner das erste Gift negiert – oder umgekehrt: ein Spieler, dessen Gift negiert wurde, hat es „umsonst" aktiviert und darf trotzdem ein weiteres spielen.
- **Repro:** `docs/niche-tests/repro/S01-spells/01-divine-gift-negiert-stempelt-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doPlaySpell`: der Stempel `ps._oncePerGameUsed.add(opgKey)` steht erst am Ende des Normalzweigs (ca. Z. 8948-8952); der Negierungs-Zweig `if (chainResult.negated) { … return true; }` (ca. Z. 8324-8374) kehrt davor zurück. Die Reaktions-Fenster (`executeCardWithChain`) stempeln dagegen beim Verlassen der Hand (Ruling v1031).
- **Verwandt (nicht gesondert getestet):** dieselbe Lücke gilt für jeden Normal-Spell mit `oncePerGame` (z. B. Eraser Beam, Silence selbst – `A07-12` hatte sie bei Guard Duty gesehen).

### S01-02 · Negiertes Big Oopsie / Butterfly Cloud zählt nicht gegen „1 pro Zug" bzw. „nicht 2 Züge hintereinander" · Stufe C
- **Karten:** Big Oopsie (`cards/effects/big-oopsie.js`), Butterfly Cloud (`cards/effects/butterfly-cloud.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Big Oopsie bzw. 2× Butterfly Cloud auf der Hand; Sitz 1: Silence (negiert den ersten Zauber).
- **Schritte:** 1. Erster Zauber wird von Silence negiert. 2a. Big Oopsie: zweites Big Oopsie im selben Zug. 2b. Butterfly Cloud: zwei Zugwechsel, dann Butterfly Cloud im nächsten eigenen Zug.
- **Erwartet** (Kartentext Big Oopsie: „You can only play 1 "Big Oopsie" per turn." / Butterfly Cloud: „You cannot play "Butterfly Cloud" on 2 consecutive turns."): Lesart A „gespielt = gezählt" (analog Ruling v1031 bei den Divine Gifts): das negierte Big Oopsie verbraucht den Zug-Slot, die negierte Butterfly Cloud sperrt den Folgezug. Lesart B (Skript): erst der wirkende Zauber zählt.
- **Beobachtet:** Lesart B. Big Oopsie stempelt `claimHOPT` erst im Effekt (Ruling in `CARD_API.md` „BIG OOPSIE": „gestempelt, sobald der Effekt wirklich läuft"; dort ist nur der Abbruch bedacht, nicht die Negierung) – nach der Negierung trifft ein zweites Big Oopsie (Held −150). Butterfly Cloud setzt `_butterflyCloudUsedThisTurn` erst am Ende von `onPlay` – nach einer negierten Butterfly Cloud ist sie im nächsten eigenen Zug wieder spielbar und trifft (−50).
- **Repro:** `docs/niche-tests/repro/S01-spells/02-big-oopsie-butterfly-cloud-negiert-zaehlt-nicht.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `big-oopsie.js:121` (`claimHOPT` im `onPlay`) bzw. `butterfly-cloud.js:90` (Flag im `onPlay`); ein negierter Zauber führt `onPlay` nie aus.
- **Frage an Al:** Soll ein von einer Reaktion **negierter** Zauber das „pro Zug"/„nicht in 2 aufeinanderfolgenden Zügen"-Limit von Big Oopsie und Butterfly Cloud trotzdem verbrauchen (ja = wie bei den Divine Gifts / nein = wie jetzt)?

### S01-03 · Butterfly Cloud (ein Zauber) schadet Kreaturen unter Dark Ocean nicht · Stufe B
- **Karten:** Butterfly Cloud (`cards/effects/butterfly-cloud.js`), Dark Ocean (Engine `_engine.js` ca. Z. 46286).
- **Voraussetzungen / Aufbau:** Dark Ocean liegt als Area; Sitz 1 hat eine 200-HP-Kreatur; Sitz 0 hat Butterfly Cloud (Kontrolle: Boiling Oil).
- **Schritte:** 1. Boiling Oil spielen → Kreatur verliert 80. 2. (frisches Spiel) Butterfly Cloud spielen.
- **Erwartet** (Kartentext Dark Ocean: „Creatures take no damage, except from Attacks and **Spells**."; Butterfly Cloud: „Deal 50 damage to all targets your opponent controls."): Die Kreatur verliert 50.
- **Beobachtet:** Boiling Oil trifft (120 HP), Butterfly Cloud nicht (200 HP, Log `dark_ocean_damage_blocked`, `damageType: 'other'`). Gegenprobe ohne Dark Ocean: −50. (Helden-Surprises wie Firewall öffnen trotz Typ `'other'` normal – nur die Dark-Ocean-Weiche ist betroffen.)
- **Repro:** `docs/niche-tests/repro/S01-spells/03-butterfly-cloud-dark-ocean.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `butterfly-cloud.js:82` schlägt mit `damageType: 'other'` zu; die Dark-Ocean-Weiche (`_engine.js` ca. Z. 46286-46300) lässt laut Ruling 5.8. nur `attack` und `destruction_spell` durch. Der Zauber gehört in die Zauber-Schublade (CARD_API „Schadenstypen": `'destruction_spell'` = „Schaden eines Zaubers").
- **Hinweis:** Dieselbe Weiche blockiert vermutlich auch den Schaden von `'decay_spell'` (Forbidden Zone) – nicht getestet, gehört in die Gruppe der Karte.

### S01-04 · Divine Gift of Skill: „unless the user has at least Magic Arts 1" wird auf den GEWÄHLTEN Helden gelesen · Stufe B
- **Karten:** Divine Gift of Skill (`cards/effects/divine-gift-of-skill.js`), `engine.isHeroSkillLocked` (`_engine.js:43381`).
- **Voraussetzungen / Aufbau:** (A) Held 0 Magic Arts 1 (Nutzer), Held 1 Destruction Magic 1 ohne Magic Arts (gewählt). (B) Held 0 ohne Schule (Lv-0-Zauber, Nutzer), Held 1 Magic Arts 2 + Destruction Magic (gewählt).
- **Schritte:** Divine Gift of Skill mit Held 0 spielen und Held 1 wählen; `isHeroSkillLocked(0, 1)` bzw. Burning Finger mit Held 1.
- **Erwartet** (Kartentext: „That Hero cannot perform an Action for the rest of the turn unless **the user** has at least Magic Arts 1." – „the user" = der wirkende Held, vgl. Big Oopsie „If the user is an Ascended Hero"): (A) Held 1 nicht gesperrt, (B) Held 1 gesperrt.
- **Beobachtet:** Das Skript prüft die Magic-Arts-Stufe des **gesperrten** Helden (Kopfkommentar noch mit der alten Fassung „unless they have at least Magic Arts 1"): (A) Held 1 gesperrt (Burning Finger wird abgelehnt), (B) Held 1 frei.
- **Repro:** `docs/niche-tests/repro/S01-spells/04-divine-gift-of-skill-der-nutzer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:43381-43388` (`isHeroSkillLocked`) kennt den Nutzer nicht; `divine-gift-of-skill.js:123` stempelt nur `hero._skillLockTurn = gs.turn`. Die Magic-Arts-Stufe des Nutzers müsste beim Wirken festgehalten werden.
- **Restunsicherheit (daher B):** Falls die alte Fassung („they") gewollt war, ist der Kartentext zu ändern.

### S01-05 · Dance of the Flame Pillars: Vollflächen-Zweig trifft nur die Gegnerseite · Stufe A
- **Karten:** Dance of the Flame Pillars (`cards/effects/dance-of-the-flame-pillars.js`), Engine `aoeTargetPlayers` (`_engine.js:45462`).
- **Voraussetzungen / Aufbau:** je Seite 1 Held + 1 Kreatur (4 Ziele); Ablage Sitz 0: 5 Destruction-Magic-Zauber mit verschiedenen Namen (5 > 4).
- **Schritte:** 1. Dance of the Flame Pillars spielen.
- **Erwartet** (Kartentext: „If there are more different Destruction Magic Spells in your discard pile than targets on the board, deal 150 damage to **all targets** instead."; Skript-Kopf: „(both sides included)"): Alle 4 Ziele verlieren 150, auch der eigene Held und die eigene Kreatur.
- **Beobachtet:** Nur Gegner-Held (650) und Gegner-Kreatur (50) werden getroffen; der eigene Held bleibt bei 800, die eigene Kreatur unverletzt.
- **Repro:** `docs/niche-tests/repro/S01-spells/05-dance-of-the-flame-pillars-flaeche-nur-gegnerseite.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dance-of-the-flame-pillars.js:118` übergibt `side: 'any'` an `ctx.aoeHit`; `aoeTargetPlayers` (`_engine.js:45462-45467`) kennt nur `'own'` / `'both'` / `'enemy'`, alles andere (auch `'any'`) fällt auf den Gegner zurück. Es ist die einzige Karte mit `side: 'any'` an `aoeHit` (alle 48 Aufrufer geprüft). Richtig wäre `'both'`.

### S01-06 · Dance of the Flame Pillars zählt Ausrüstung als „Ziel auf dem Brett" · Stufe B
- **Karten:** Dance of the Flame Pillars (`cards/effects/dance-of-the-flame-pillars.js:57`).
- **Voraussetzungen / Aufbau:** je Seite 1 Held und 1 Artefakt in der Support Zone (`ZZ Trinket`); Ablage Sitz 0: 3 Destruction-Magic-Zauber mit verschiedenen Namen (N = 3).
- **Schritte:** 1. Dance of the Flame Pillars spielen, in der Wahl alles anklicken, was angeboten wird.
- **Erwartet** (Kartentext: „…more different Destruction Magic Spells … than targets on the board → 150 to all targets"; Ziele der Karte sind Helden und Kreaturen – so auch die eigene Zielwahl `types: ['hero','creature']`): 2 Helden = 2 Ziele < 3 Zauber → Vollfläche, Gegner-Held 650.
- **Beobachtet:** Das Skript zählt 4 „Ziele" (2 Helden + 2 Artefakte), 3 ≤ 4 → Wahlmodus mit `minRequired: 3`, aber nur 2 wählbaren Helden; beide Helden verlieren nur 100 (700). Das Kommentar-Versprechen „hier unten stehen also immer mindestens N Ziele zur Verfügung" stimmt bei Ausrüstung/Anhängen nicht.
- **Repro:** `docs/niche-tests/repro/S01-spells/06-dance-of-the-flame-pillars-ausruestung-zaehlt-als-ziel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `countAllValidTargets` zählt jede belegte Support Zone (`slot.length > 0`), nicht nur Kreaturen (Kartentyp prüfen wie in der Wahl).

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
