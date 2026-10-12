# Nischenfall-Tests – Briefing und Harness-Spickzettel

Stand: 12.10.2026. Ziel der Kampagne: In **allen fertigen Kartenskripten** (`cards/effects/*.js`, 1214 Stück) Interaktionen und
Nischenfälle finden, die noch nicht gesondert getestet/dokumentiert sind, sie **in echten Spielsituationen simulieren** und
Fehler oder fragliche Fälle dokumentieren. **Es wird nichts gefixt** – nur gemessen und berichtet.

## 1 · Harte Regeln

1. **Keine Änderungen an Repo-Quellen.** Weder `cards/`, `server.js`, `public/`, `data/` noch `scripts/` anfassen. Kein `git commit`, kein
   `git push`, kein `git checkout/stash/reset`. Erlaubt: Dateien unter `docs/niche-tests/` (nur deine eigenen!) und im Scratchpad.
2. **Wo was liegt**
   * Explorative Tests (auch bestandene): `$SCRATCH/tests/<gruppe>/*.js` (Scratchpad, wird nicht committet).
   * **Repro-Skripte nur für Befunde** (Fehler und Unsichere): `docs/niche-tests/repro/<gruppe>/<id>-<kurzname>.js`.
   * **Bericht**: `docs/niche-tests/<gruppe>.md` (Format siehe §6).
3. **Belastung**: die Maschine hat 4 Kerne, mehrere Agenten laufen parallel. Höchstens **ein** Node-Prozess gleichzeitig, jeder Test
   mit `timeout 120 node …`. Nie `server.js` starten, nie Netzwerk, nie `npm install`.
4. **Schreibweise**: Berichte und Kommentare auf **Deutsch**. Dateien mit explizitem UTF-8 schreiben (Python: `open(p, 'w', encoding='utf-8')`,
   Node: `'utf8'`), deutsche Sonderzeichen und Emojis direkt als Zeichen, nicht als Escape-Folgen.
5. **Ehrlich berichten**: Was du nicht reproduzieren konntest, steht als „nicht reproduziert“ im Bericht, nicht als Fehler. Was du nicht
   getestet hast, steht als „nicht getestet“. Kein Befund ohne ausgeführten Repro.

## 2 · Was ein Befund ist (Beurteilungsmaßstab)

**Quelle der Wahrheit** (in dieser Reihenfolge):

1. Der **Kartentext** in `data/cards.json` (Feld `effect`) – er ist die Spezifikation.
2. **Rulings/Regeln** in `cards/effects/CARD_API.md` (`grep -n "<Kartenname>\|<Stichwort>" cards/effects/CARD_API.md`) und in den
   Kopfkommentaren der Skripte („Als Ruling/Vorgabe/Befund/Regel …“). Was dort ausdrücklich entschieden wurde, ist **gewollt** – das ist
   kein Befund (höchstens „bestätigt“).
3. Die Spielkonvention aus dem Rest des Codes (z. B. Abbruch = nichts passiert, Regel 23.9 in CARD_API.md).

**Schweregrade**

| Stufe | Bedeutung |
|---|---|
| **A – Fehler** | Absturz, Hänger/Endlosschleife, verschluckte Engine-Fehlermeldung, kaputter Zustand (Zone ↔ Instanz, NaN, verschwundene/duplizierte Karte), oder Verhalten, das dem Kartentext **eindeutig** widerspricht. |
| **B – Wahrscheinlicher Fehler** | Der Text lässt eine klare Lesart zu, das Skript weicht ab – kleine Restunsicherheit. |
| **C – Unsicher / Regelfrage** | Mehrere Lesarten plausibel, oder unklar, ob das Verhalten gewollt ist. Formuliere die Frage an Al so, dass er mit einem Wort antworten kann (z. B. „Soll X passieren oder Y?“). |

Kein Befund: Verhalten, das der Text hergibt, auch wenn es ungewöhnlich wirkt – das kommt in die Tabelle „Getestet & in Ordnung“.

## 3 · Der Harness (`docs/niche-tests/lib/h.js`)

Headless, **echte Engine** und die **echten Spielwege aus `server.js`** (`doPlaySpell`, `doPlayCreature`, `doUseArtifactEffect` …).
Normalspiel-Regeln (kein Skill-Test-Modus): Zugwechsel, Ziehen, Gold, Aktionsökonomie, Spielende wie im Online-Spiel.

```js
const H = require('../../lib/h.js');           // von docs/niche-tests/repro/<gruppe>/x.js aus; im Scratchpad: require('../../lib/h.js') (Symlink)
(async () => {
  const R = H.runner();                        // R.check(name, bedingung, info) · R.note(name, info) · R.section(titel) · R.finish()
  const t = await H.fresh({ hand: [['Fireball'], []] });   // Sitz 0 am Zug, Aktionsphase, 800 HP je Held, 100 Gold, 20er Deck
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];   // Zielwahl skripten
  const r = await t.play(0, 'Fireball', { hero: 0 });      // echter Spielweg; true = gespielt
  R.check('Gegner-Held 0 verliert 150 HP', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();                                  // Exit 1 bei ✗
})();
```

**Szene bauen** (`H.fresh(opts)`): `seats` (2 | 3 | 4), `heroes: [[h0,h1,h2],[…]]` (Standard: neutrale Platzhalter-Helden **ohne** Fähigkeiten:
Tushu/Rick/Zwei bzw. Atta/Hulijing/George), `hp`, `abilities: {seat: {hi: [[zone0…],[zone1…],[zone2…]]}}` (ein Stapel = Stufe),
`hand`, `deck`, `deckSize`, `discard`, `potionDeck`, `gold`, `turn` (5), `phase` (3 = Aktion; 2 = Main 1; 4 = Main 2), `active`, `confirm`
(Standardantwort auf Ja/Nein-Fragen, Standard `true`), `seed`.
Danach: `t.put(seat, hi, slot, name, {counters, statuses, controller, faceDown})` (Karte auf Brett, gibt die Instanz), `t.putSurprise(seat, hi, name)`,
`t.putArea(seat, name)`, `t.setHand(seat, [..])`, `t.addHand`, `t.setDeck`, `t.setDiscard`, `t.setGold`, `t.setHero(seat, hi, name, hp)`,
`t.setAbilities(seat, hi, zones)`, `t.grantFor(seat, hi, kartenname)` (gibt dem Helden die Schulen/Stufe, die der Spell/Attack/die Kreatur braucht),
`t.heroStatus(seat, hi, 'frozen')`. Dummies ohne Wirkung: `H.INERT.creature` (`'ZZ Dummy'`, 200 HP), `.big` (1000), `.frail` (10), `.filler` (Spell), `.artifact` – **immer über `H.INERT.*` ansprechen**. (Achtung: **`Test Dummy` ist eine ECHTE Karte** mit Redirect-Effekt und 1 HP – nicht als Füllkarte verwenden.)

**Spielen**: `t.play(seat, name, {hero, slot, zoneSlot, phase, keepActions, noGrant, extra, handIndex, targetOwner, charmedOwner})` wählt anhand des Kartentyps
den richtigen Handler (Spell/Attack → `doPlaySpell`, Creature → `doPlayCreature`, Equipment → `doPlayArtifact`, sonstiges Artifact → `doUseArtifactEffect`, Potion →
`doUsePotion`, Ability → `doPlayAbility`, Surprise → `doPlaySurprise`), legt die Karte bei Bedarf in die Hand, gibt dem Helden die nötigen Schulen, stellt die passende Phase ein
und setzt die Aktionszähler zurück. Weitere Wege: `t.activateCreature(seat, hi, slot)`, `t.activateHero(seat, hi, {effect})`, `t.activateEquip(seat, hi, slot)`,
`t.activateAbility(seat, hi, zoneIdx)`, `t.run(fn)` (beliebiger async-Aufruf mit Hänger-Wächter 8 s und Fehlerfang), `t.turnStart(seat)` (nur die Hook-Batterie),
**`t.endTurn()`** = echter Zugwechsel (End-Phase → Zugende-Hooks → Statusablauf → Zugbeginn des anderen mit Ziehen/Gold). Mehrfach aufrufen, um Dauern zu testen.
**Ziel-Tränke/-Artefakte**: öffnet der Server dabei `gs.potionTargeting` (Teleportation Powder & Co.), löst `t.play` die Zielwahl automatisch auf (`t.targetFn` bzw. erstes zulässiges Ziel; `t.policy.cancelTargets` = Abbruch-Knopf); mit `{noAutoConfirm: true}` und `t.resolveTargeting(seat, ids)` machst du es von Hand.
Rückgabe von `play`: `true` (vom Server **behandelt** – das schließt einen Abbruch ein, bei dem die Karte zurück in die Hand geht; prüfe also immer `t.pile(seat,'hand')`/Ablage/Zustand), `false` (vom Server abgelehnt: Bedingung, Sperre, Phase, Level …), `{threw}` (Ausnahme), `{hung}` (Hänger), `{runaway}` (Endlosschleife >300 Prompts).

**Antworten skripten**
* Zielwahl: `t.targetFn = (valid, config) => [id, …]` – `valid[i]` hat `id, type ('hero'|'equip'(=Kreatur/Ausrüstung)|…), owner, heroIdx, slotIdx, cardName`; `return null` = Abbruch (so meldet der Abbruch-Knopf
  eines Menschen); `[]` ist das **CPU-Signal** für „nichts gewählt“ (anders behandelt, siehe unten). Alle angebotenen Wahlmengen stehen in `t.targets`.
  `t.policy.cancelTargets = true` bricht jede Zielwahl ab (null).
* Alle übrigen Abfragen (`promptGeneric`: Ja/Nein, Galerien, Optionswahl, Zonenwahl …): `t.script.push({ match: d => …, answer: (d, pi, t) => …, once: true })`; mitgeschnitten in `t.prompts` (`{pi, d}`).
  Ja/Nein-Standard: `t.policy.confirm` (true/false); alles andere beantwortet die Engine-CPU-Politik (erste Option / bei abbrechbar: ablehnen). Antwortformen: Ja/Nein `{confirmed:true}`; Galerie `{cardName}` bzw. `{selectedCards:[…]}`;
  Option `{optionId}`; Zone `{heroIdx, slotIdx}` – am sichersten ist es, die Form im Skript der Karte nachzulesen.

**Beobachten**: `t.errors` (verschluckte Engine-Fehler: `console.error` – der wichtigste Rauchmelder; immer prüfen!), `t.warns`, `t.events` (`_broadcastEvent`: Animationen, Karten-Reveal), `t.evs(name)`,
`t.logs`/`t.lg(type)` (Spiel-Log), `t.prompts`, `t.targets`, `t.audit()` (Zustandsprüfung: NaN, ungültige Namen, Zone↔Instanz, HP>Max), `t.census()` + `t.censusDiff(vorher, nachher)` (Kartenbilanz),
`t.engine.over` (`{called, winnerIdx, reason}` bei Spielende), `t.hp(seat, hi)`, `t.zone(seat, hi, slot)`, `t.pile(seat, 'hand'|'mainDeck'|'discardPile'|'deletedPile')`, `t.find(name, zone)`, `t.inst(pred)`.
`t.reset()` leert die Beobachtungslisten. **Ausgabe immer über `R.check/R.note/t.say`** (die Engine ist stummgeschaltet).

**Engine-Primitive** (direkt aufrufbar, für Aufbauten und Auslöser): `engine.actionDealDamage(source, targetHero, amount, type)`, `actionDealCreatureDamage(source, inst, amount, type)`, `actionHealHero`, `actionDestroyCard(source, inst)`,
`addHeroStatus(pi, hi, 'frozen'|'stunned'|'burned'|'poisoned'|'negated', {duration, appliedBy})`, `applyCreatureStatus(inst, status, {sourceOwner})`, `actionNegateCreature(inst, source)`,
`actionStealCreature(pi, inst)`, `actionStealHero`, `actionTakeHeroPermanently`, `actionTransferCreature`, `actionDrawCards(pi, n)`, `actionDiscardCards`, `actionMillCards`, `actionGainGold/SpendGold/StealGold`,
`actionPlaceCreature(name, pi, hi, slot, opts)`, `summonCreatureWithHooks`, `actionReviveHero`, `actionDefeatHero`, `runHooks(name, ctx)`. Signaturen: `grep -n "^  async actionX(" cards/effects/_engine.js`.
Instanz-Felder: `inst.owner` (Besitzer), `inst.controller`, `inst.zone`, `inst.heroIdx`, `inst.zoneSlot`, `inst.counters`, `inst.statuses`, `inst.faceDown`, `inst.stolenBy`.

**Fallen**
* Spells/Surprises/Reactions brauchen die **Schulen/Stufe des Helden** (bei Surprises: des Helden, in dessen Surprise Zone sie liegen) – `t.grantFor(seat, hi, name)`.
* Eine Aktion pro Zug: nach `t.play` ist die Aktion verbraucht; `t.play` setzt sie sonst für jeden neuen Aufruf zurück (`keepActions: true` verhindert das, wenn du die Aktionsökonomie prüfen willst).
* Zug 1/Erst-Runden-Immunität: `fresh()` startet bei Zug 5 ohne Schutz. Für Immunitätstests `t.gs.firstTurnProtectedPlayer = 1` setzen.
* Beide Sitze sind „CPU“ markiert, damit Prompts durch die Harness laufen. Folge: der CPU-Abbruch einer **sofort abbrechbaren** Zielwahl ist `[]` (Engine-Standard) – ein Mensch liefert `null`. Teste Abbrüche mit `null`.
* `H.fresh()` setzt `Math.random` auf einen festen Seed (`opts.seed`, Standard 1234): Mischen/Zufall sind reproduzierbar. Teste Zufallskarten mit mehreren Seeds.
* Es lebt **ein** Spiel pro Prozess gleichzeitig (die Konsolen-Umleitung gehört dem zuletzt erzeugten `t`).
* Für Karten, die eine Gegenpartei brauchen (Surprises, Reaktionen), liegt die Gegenkarte auf Sitz 1 und Sitz 0 handelt; so löst du sie aus: wirke einen Spell/Attack auf den Helden (Fireball, siehe oben), beschwöre, lass Schaden entstehen, beende den Zug (`t.endTurn()`).
* Der Skill-Test-Modus ist **nicht** Gegenstand – `fresh({mode: 'skill'})` existiert, wird aber nicht benötigt.

**Idiome aus früheren Kartentests** (reichlich Vorbilder für Aufbau, Prompt-Skripting, Gegenproben; in der Git-Historie, nicht im Arbeitsstand):
`git show 4a5dcd4^:scripts/skilltest-e2e/<name>.test.js` – z. B. `mimic`, `frost-breaker`, `sky-archeologist`, `slave-trader`, `race-boats`, `secret-spell-book`, `pinta`, `idej`, `the-melting`.
Die Harness aus diesen Tests ist die Vorgängerin der hier benutzten; die Hilfsfunktionen (`fresh`, `lege`, `spiele`) sind dort lokal definiert.

## 4 · Methodik – Familien von Nischenfällen (Checkliste)

Gehe nicht jede Karte nach Schema F durch, sondern frage bei jeder Karte: *Welche dieser Familien trifft den Kartentext oder das Skript – und wie verhält sich die Karte dann?*

1. **Zahlen und Grenzen im Text**: „up to N“, „any number“, „at least“, „half (rounded down)“, Staffelwerte „X/Y/Z“ je Stufe/Schule, 0 Ziele, genau 1 Ziel, mehr Wünsche als Ziele, dasselbe Ziel doppelt, Maximalwerte, Mindestwerte (HP, Gold, Level), Rundung bei Gold/HP.
2. **Ziele**: Held vs. Kreatur vs. Attachment/Artifact/Surprise/Area; Ziel in der Zone eines toten/gefrorenen/betäubten Helden; Ziel verschwindet **zwischen Wahl und Auflösung** (Reaktion entfernt es); Selbstziel; „other than“/„except“; verdeckte Ziele; „cannot be targeted/chosen“-Schutz (Escape Device, Cloak, Submerged, Stealth …); geliehene/gestohlene Helden (Charme, Paraseed).
3. **Kosten und Verfügbarkeit**: Gold 0 oder negativ, Kostenreduktion, Opferkosten (Sacrifice), Abwurfkosten, „once per turn / per game“ (HOPT, `oncePerGame`) – auch nach **Abbruch** oder **Negierung**; „counts as an additional Action“; Held gefroren/betäubt/gebunden; Level-/Schulanforderung; leere Hand/Deck/Ablage; Kostenzahlung vor oder nach Zielwahl.
4. **Zonen und Bewegung**: Deck leer, Ablage leer, „hand, deck or discard pile“, Mischen, Reihenfolge (top/bottom), **kein freier Support Zone** (Fallbacks?), mehrere Kopien derselben Karte, „different names“, Karte verlässt die Zone **während** des Effekts, Karte landet nach Besitzer-/Kontrollwechsel im Stapel des **falschen** Spielers, Tokens (kommen nie in die Ablage), Karte wird gelöscht statt abgelegt.
5. **Kontrolle**: gestohlene Kreaturen/Helden, Charme, seitenfremd beschworene Kreaturen, „owner vs. controller“; „you/your opponent“ aus Sicht des Kontrolleurs; Rückgabe bei Tod/Zugende; Kreaturen des Gegners, die deine Support Zones belegen.
6. **Status und Negation**: gefroren, betäubt, negiert, verbrannt, vergiftet, Immunitäten, „cannot be healed“, Ablauf zu Zugende/Zugbeginn, Negation passiver Kreatureneffekte, Reihenfolge der Hooks, Status auf Kreatur vs. Held, Erneuerungsregeln.
7. **Timing und Reaktionen**: Ketten (Reaction/Surprise/Counter), mehrere Surprises gleichzeitig, Negierung eines Spells (wohin gehen Karte, Kosten, Once-Stempel?), Reaktion auf eigene Karte, „at the end of your turn“ bei Spielende, Zugbeginn-/Zugende-Hooks beider Spieler, Erst-Runden-Immunität, Doppelauslösung desselben Hooks.
8. **Schaden und Tod**: Schadenstypen (creature/spell/attack/status/true), Reduktion/Deckel/Immortal/„HP 1“, Überlauf, Mehrfachtreffer (Flächenklammer), Heilung über Max-HP, mehrere Helden sterben gleichzeitig, Spielende-Gleichstand („draw → you win“), letzter Held stirbt durch eigenen Effekt, Wiederbelebung, Tod während der eigenen Aktion.
9. **Wiederholung und Mehrfachbesitz**: derselbe Effekt zweimal pro Zug, zwei Kopien auf dem Brett, Aktivierung in Antwort auf sich selbst, Kettenreaktionen (Karte löst Karte aus), Endlosschleifen/Rekursion.
10. **Zustände über die Zeit**: „until the end of the turn / for the rest of the game / next turn“ – verhält sich das nach **echtem** `t.endTurn()` richtig? Held stirbt/wird ersetzt, Zähler/Counters beim Wegzug, Stehlen oder Neuspielen zurückgesetzt?
11. **Protokoll-Verträge, die headless prüfbar sind** (CARD_API.md, „★“-Abschnitte): Karte erscheint im Log (`t.logs`), getriggerter Passiv-Effekt zeigt seine Karte (`t.events`), Kartenbild-Reveal erst beim Auflösen (nach Abbruch **kein** Reveal), keine Animation vor dem Zusagepunkt.
12. **Wechselwirkung mit Querschnittskarten**: Anti-Magic/Negations-Karten, Escape Device, Magic Mirror, Spiegelungen/Kopierer (Copy-Device, Shapeshifter), Diebstahl, Umleitungen, Sperren (Hand-/Summon-/Such-/Zieh-/Aktionssperren), Kosten-Modifikatoren – jeweils mit **deiner** Karte als Opfer und als Täter.
13. **Synergien innerhalb des Archetyps** (nur Archetyp-Gruppen): die Karten deiner Gruppe auf demselben Brett, in typischer Reihenfolge ausgespielt; Mengen-/Zähl-Effekte („for each …“) mit 0, 1 und vielen; Fälle, in denen zwei Karten des Archetyps um dieselbe Ressource (freie Support Zones, Counters, Deckoberseite) konkurrieren.

**Vorgehen pro Gruppe**
1. Lies `$SCRATCH/groups/<gruppe>.json` (Kartenname, Typ, Stufe, Schulen, Text, Skriptpfad, Größe, Hinweise `oldTests`, `apiMentions`, `rulingMarkers`, `lead`).
   Lies **zuerst die Texte aller Karten** (das kostet wenig) und notiere pro Karte, welche Familien aus §4 sie berühren. Rangfolge: Nischenpotenzial × (noch nicht abgedeckt). `lead` = Hinweis aus der Vorrunde (breite Batterien liefen schon: Kaltstart in 10 Zuständen, Dauerfeuer mit 20 Ereignissen, Abbruch-Prüfung; die „lead“-Einträge sind **Hinweise**, keine Beweise – prüfe sie nach).
2. Lies nur die Skripte der Karten, die du gezielt testest (und die Hilfsmodule `_*-shared.js`, auf die sie sich stützen). Suche in `CARD_API.md` nach bereits entschiedenen Rulings zu der Karte, bevor du etwas als Fehler meldest.
3. Prüfe, was **schon abgedeckt** ist: `oldTests` in der Gruppendatei nennt alte Kartentests (`git show 4a5dcd4^:scripts/skilltest-e2e/<datei>`); was dort ausdrücklich geprüft wurde, nicht noch einmal prüfen – ergänze nur neue Winkel.
4. Schreibe für jeden Nischenfall einen kleinen Test **mit Erwartung aus dem Kartentext**, der durch den echten Spielweg läuft. Prüfe immer auch `t.errors`, `t.audit()`, Kartenbilanz und `t.hung`.
5. Bei Abweichung: **minimieren** (kleinster Aufbau), mit mehreren Seeds wiederholen, die Ursache im Skript/Engine lokalisieren (Datei:Zeile), prüfen ob ein Ruling es erklärt. Dann Repro-Skript nach `docs/niche-tests/repro/<gruppe>/` und Eintrag im Bericht.
6. Zeitbudget: lieber 15 gründlich getestete, nischenreiche Karten als 60 oberflächliche. Aber jede Karte deiner Liste bekommt im Bericht einen Status (§6, Tabelle „Abdeckung“).

## 5 · Dokumentation, in der du dich bedienen kannst

* `cards/effects/CARD_API.md` (groß; **gezielt suchen**, nicht lesen): ctx-API, Hooks, Rulings, „★“-Regeln. Wichtig für Befunde: „Zielende Karten sind immer abbrechbar“ (Abbruch = nichts ist passiert), „Schadenstypen“, „Aus dem Deck/Ablage aufs Feld – EINE Stelle“, „Gestohlene Karten gehen in die Ablage ihres Besitzers“, „Aktive Effekte kosten nur dann eine Aktion, wenn sie es sagen“, „Kein direktes Splicen an Deck und Ablage“, „Gegner-Index nie hart verdrahten“.
* `cards/effects/_engine.js` (50.000 Zeilen): `grep -n` auf Methodennamen. Die Kommentare dort sind ausführlich und nennen die Rulings.
* `cards/effects/_*-shared.js`: Archetyp-Bausteine (z. B. `_pollution-shared.js`, `_deepsea-shared.js`).
* `scripts/check-*.js`: statische Wächter (laufen vor jeder Auslieferung); sie decken Muster ab, keine Verhaltensfälle.

## 6 · Berichtsformat (`docs/niche-tests/<gruppe>.md`)

```markdown
# <Gruppe> – Nischenfall-Bericht
Stand/Autor: Agent <Gruppe>, <Datum>. Karten: N in der Liste · M gezielt getestet · K mit Befund.

## Zusammenfassung
(3–8 Zeilen: wichtigste Befunde, Gesamteindruck, was bewusst nicht getestet wurde)

## Befunde
### <Gruppe>-01 · Kurztitel · Stufe A|B|C
- **Karten:** Karte X (Skript), Karte Y …
- **Voraussetzungen / Aufbau:** Helden, Fähigkeiten, Brett, Hand, Phase, Zufallssamen
- **Schritte:** 1. … 2. …
- **Erwartet** (Quelle: Kartentext „…“ / Ruling CARD_API.md Z. 123): …
- **Beobachtet:** …
- **Repro:** `docs/niche-tests/repro/<gruppe>/01-kurzname.js` (`node docs/niche-tests/repro/<gruppe>/01-kurzname.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/x.js:123` …
- **Frage an Al** (nur Stufe C): …

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Karte X | L2 gezielt | HOPT nach Abbruch ✓, zwei Kopien ✓, Ziel stirbt in Reaktion ✗(→ -01) |
| Karte Y | L1 Standard | nur Batterie (Kaltstart/Dauerfeuer), keine Besonderheit erkannt |
| Karte Z | L0 gelesen | Text/Skript gelesen, keine Nische erkennbar |

## Getestet & in Ordnung (Auswahl)
(Stichpunkte der interessantesten bestandenen Nischenfälle – damit Al sieht, was jetzt gesichert ist)
```

Tiefenstufen: **L0** = Text (und ggf. Skript) gelesen, keine Nische erkennbar · **L1** = nur breite Batterie / ein Standardlauf · **L2** = gezielte Nischenfall-Tests.
Repro-Skript-Konvention: eigenständig, `require('../../lib/h.js')`, prüft die **erwartete** Lage mit `R.check` (ein Fehlschlag ✗ = der Fehler tritt auf), Exit-Code 1 bei Fehler, Kommentarkopf mit Kartentext, Erwartung, Beobachtung.

## 7 · Bereits gelaufene breite Batterien (Vorrunde)

* **Dauerfeuer** (`lib/barrage.js`): jede Karte in ihrer natürlichen Zone (Brett/Hand/Ablage/Deck/Ability/Held/Surprise/Area), beide Seiten, 20 Ereignisse (Schaden, Heilung, Beschwörung, Status, Gold, Ziehen, Mill, Kreaturentod, Heldentod, Wiederbelebung, 2 Zugwechsel, Spielende). Ergebnis: **keine** verschluckten Engine-Fehler, keine Hänger; ein paar Auffälligkeiten (`lead` in den Gruppendateien).
* **Kaltstart** (`lib/coldplay.js`): jede Hand-/Brettkarte in 10 Zuständen über den echten Spielweg (volles Brett, Nein-auf-alles, **Abbruch jeder Zielwahl**, letztes Ziel, Gegner leer, ich leer, Gegner fast tot, Deck 1, Gold 0, Gegner nur 1 Held). Keine Ausnahmen/Hänger; ein paar Abbruch-Auffälligkeiten (`lead`).
* Folge: Crash-/Hänger-Klassen sind für die „Standard“-Lage durchgemessen. Der Wert deiner Arbeit liegt in **semantischen** Nischenfällen (Text ↔ Verhalten), Karten-Zusammenspiel und seltenen Zuständen.
