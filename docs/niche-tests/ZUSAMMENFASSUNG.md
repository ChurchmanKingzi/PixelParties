# Nischenfall-Kampagne – Zusammenfassung für Al

**Es wurde nichts gefixt.** Alle Quellen unter `cards/`, `server.js`, `data/` sind unverändert; diese Kampagne hat nur Dokumente und Testskripte unter `docs/niche-tests/` angelegt.

## Zahlen

| | |
|---|---|
| Kartengruppen getestet | 28 (alle fertigen Kartenskripte; Archetypen A01–A09, Helden H01–H04, Kreaturen C01–C05, Zauber S01–S03, Reaktionen/Areas/Attachments/Surprises R01–R02, Artefakte F01–F03, Attacks/Abilities/Tränke M01–M02, dazu der Querschnittsbericht B) |
| Befunde gesamt | **681** – Stufe A (Fehler): **134** · B (wahrscheinlicher Fehler): **409** · C (Regelfrage): **138** |
| Repro-Skripte | **691**, jedes zeigt den Fehler (✗) und keines stürzt ab (Lauf am Ende der Kampagne) |
| Gegenprüfung der 134 A-Befunde | durch 6 unabhängige Prüfer: **132 bestätigt · 2 auf B abgestuft · 0 Fehlalarme** |
| Fragen an dich | **179** gesammelt in [FRAGEN-AN-AL.md](FRAGEN-AN-AL.md) |

Wo du anfängst:

1. [INDEX.md](INDEX.md) – alle Befunde in einer Tabelle (Stufe, Karten, Repro, Gegenprüfung).
2. Dieses Dokument – die wiederkehrenden Ursachen (ein Fix an einer Stelle erledigt oft Dutzende Befunde).
3. [FRAGEN-AN-AL.md](FRAGEN-AN-AL.md) – deine Entscheidungen; die meisten sind mit ja/nein beantwortbar.
4. Die Gruppenberichte (`A01-pollution.md` …) für Details; jeder Befund nennt Karten, Aufbau, Erwartung mit Textzitat, Beobachtung, Repro und vermutete Ursache.
5. [verif/](verif/) – die Begründungen der Gegenprüfung.

Ein Repro startest du mit `node docs/niche-tests/repro/<Gruppe>/<Datei>.js` (Exit 1 und „✗" = der Fehler tritt auf).

## Die wichtigsten wiederkehrenden Ursachen

Die meisten Befunde sind keine Einzelfehler, sondern wenige Muster, die in vielen Skripten stecken. Die Zahlen sind Fundstellen aus den Berichten, keine vollständigen Zählungen.

1. **Besitzer / Brettseite / Kontrolleur werden verwechselt** (mit Abstand die größte Klasse, gemeldet in fast allen Gruppen).
   Ziel-IDs und Zielsammler gehen von „die Kreatur steht in der Spalte des Besitzers" aus. Bei gestohlenen oder fremd beschworenen Kreaturen kollidieren die IDs oder es wird die falsche Seite getroffen. Zentrale Stellen: `getCreatureTargets` (`_engine.js` ~40250, F02-14, 39 Skripte), `collectAoeCreatureTargets` (S01-09, betrifft jede `aoeHit`-Karte), `physicalSide()` (C03-01), `promptDamageTarget`/`promptMultiTarget` (S02-17, M01-22). Das Muster `c.owner === target.owner` steht laut A08 in 65 Skripten. Beispiele: Poisoned Meat, Gravedigger, Monster Nest, Heal, Capture, Ushabti, Sun Beam, Healing Melody.

2. **Heldenverträge ohne Status-Prüfung (Frost / Betäubung / Negation / Tod).**
   Engine-gelesene Heldenpassive prüfen den Status nicht selbst: Baaliel, Beato, Damus, Inya, Tsu'Ki, Hel, Gobbo u. a. (H01-09/-10/-20/-21, H04-02/-09/-13/-21, H03-13/-16, B-09 Ghazma). Dazu gehören dauerhafte Effekte, die beim Stillegen nicht zurückgenommen werden (Cykyran, Censpartan, Toughness, Toras/Taio).

3. **`counters.currentHp ?? 0`** – Schaden gegen nie beschädigte Kreaturen bleibt aus oder zählt nichts (Wire Hatchling, Phoenix Bombardment, Forbidden Zone, Golden Exploding Skull u. a.; C05-01, S03-22, S02-09, C03-05). Ein grep fand 13 weitere Fundstellen außerhalb von `_engine.js`.

4. **Sperren werden nur auf einem Weg geprüft** (Hand-, Such-, Zieh-, Gold-, Artefakt-, Beschwörungssperre, Knight of Kings [B], Tuscan Artist).
   Karten, die „platzieren" statt „beschwören", Deck-Splices, Galerien und Zusatzaktions-Wege umgehen die Prüfung (A06-34, A07-04, R02-19, S03-24/-26, S02-21/-22, M01-24, F02-23/-24 u. v. m.). Auch das Gegenstück: Karten, die verpuffen, aber Kosten und „1 pro Zug" verbrauchen.

5. **Negation / Zugende-Räumung.**
   Die Zugende-Räumung entfernt jede `negated`-Markierung ohne `sourceBound` (C05-02); `negatedDuration` hat keinen Leser (H03-15); Ablauffristen sind um einen Zug verschoben (Mao, A07-28; Niu, A07-02); der Ablauf einer kurzen Negation löscht eine längere (A04-28, A09-21, M01-21). Folge: Stowaway, Decisive Defeat, Mao-Bestien, Sparky Slime u. a.

6. **„1 pro Zug / 1 pro Spiel"-Stempel bei Negation und Abbruch.**
   Eine negierte oder abgebrochene Karte stempelt nicht oder stempelt zu früh (S01-01, F01-19, A06-29, F02-10/-11, A09-17, C01-12).

7. **Karten verschwinden oder duplizieren sich** (Kartenbilanz ≠ 0): fehlgeschlagene Zonenbewegungen, Tokens in der Ablage statt im Gelöscht-Stapel, Ambush-the-Scout-Negation (Magic Lamp M02-18, Birthday Present F01-02), Geister-Instanzen bei Surprise-Kreaturen (M02-24), Chaos-Diamond (H01-23, 22 Zauber doppelt), Surprise Party (S03-20).

8. **Reaktions- und Zielfenster** öffnen nicht: `promptEffectTarget` ohne `sourceCard` (A06-33, nur 21 von 210 Skripten setzen es), `promptMultiTarget` ohne `_redirectSource` (R02-02), fehlende Kreaturenseite der Schadens-Hooks (F03-14, R02-12).

9. **Nicht (vollständig) umgesetzte Karten:** Bow of the Hunt Goddess (F01-17), Secret Lab Entrance (F02-02), Mana-Consuming Blade (F02-01), Cool Repair (F01-01, in `CARD_API.md` schon als „handgestrickt" vermerkt). Das sind Lücken, keine Zustandsfehler – du entscheidest, ob du sie getrennt führen willst.

10. **Skripte nach älterem Kartentext:** Phoenix Tackle (Niederlage-Klausel, B-08 = S03-21), Initiation Ritual (F02-17), Null Zone (+2 statt +3, A01-18), Letter (A08-03). Hier lohnt der Abgleich mit der Textänderung vom 9.10.

## Wie belastbar sind die Befunde?

- Jeder Befund hat ein ausgeführtes Repro; alle 691 Skripte wurden am Ende nochmals ausgeführt (alle ✗, keine Abstürze, keine Zeitüberschreitung).
- Die Stufe-A-Befunde wurden von einem zweiten, unabhängigen Prüfer gegen Kartentext, Rulings und Quelltext geprüft. Die 2 Abstufungen:
  - **A01-03** Mass Multiplication (Token bleibt nach Abbruch liegen) → B, weil der Kartentext den Token als Kosten nennt und `CARD_API.md` Z. 2361 Kosten bei Cold Coffin bewusst nicht erstattet. Deine Entscheidung.
  - **H04-07** Sas'Za (eigener Token wird auf die Hand geholt) → B, weil „Tokens nie in Hand/Deck" nur Engine-Konvention ist (gleiche Klasse wie M01-05, A05-02).
- Einschränkungen innerhalb bestätigter Befunde stehen in `verif/V01–V06.md` (z. B. M02-08: nur der negiert-Teil und das Abgangs-Leck zählen; A04-10: bei „place"-Karten Restunsicherheit; A07-03: „Stun-Immunität wird ignoriert" ist eher Auslegung).
- Die B- und C-Befunde wurden nicht einzeln gegengeprüft; B ist „sehr wahrscheinlich ein Fehler", C „unklar, ob so gewollt".

## Bekannte Grenzen der Messung

- Nur Zwei-Spieler-Partien im Normalmodus; kein Skill-Test-Modus, keine 3–4-Spieler-Tische, keine CPU-/MCTS-Wege, keine Client-Darstellung oder Animationen.
- Mehrere Handler in `server.js` sind headless nicht aufrufbar (`doActivatePermanent`, `doActivateDiscardEffect`, `doTriggerTreacherousCrystal`); dort wurden die Prädikate nachgebildet oder statisch gelesen (in den Berichten vermerkt).
- Harness-Fallen, die einzelne Messungen verfälschen können (README.md, Abschnitt Harness): `confirm=false` liefert ein wahrheitsfähiges Objekt, ein echtes „Nein" ist `null` (per `t.script`); nach `await actionSteal…` läuft ca. 100 ms eine Reaktionskette; Status verfallen beim Zugwechsel. Die Prüfer haben bei den A-Befunden keinen Fall gefunden, der dadurch erklärt wurde; bei B/C ist das nicht einzeln geprüft.
- Einige Gruppenberichte listen „bewusst nicht getestet" am Ende; die Abdeckungstabellen weisen je Karte L0 (nur gelesen), L1 (Standardlauf) oder L2 (gezielt getestet) aus. Die große Mehrheit ist L2.

## Aufräumen

Wenn dir die Repro-Skripte zu viel werden: `docs/niche-tests/` ist reine Doku und kann komplett gelöscht werden; die Spielquellen hängen nicht davon ab. Das Test-Harness liegt in `docs/niche-tests/lib/` und wird von den Repros benutzt.
