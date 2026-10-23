# Fix-Welle 63d – Auftritt erst nach dem Commit (zentraler Auftritts-Puffer)

Umgesetzt vom Agenten **W63d** (Zweig `wave63/W63d`). Befund von Al (Spieldesigner): „**Treasure Hunter's Backpack streamed sein Bild bereits an den Gegner, bevor die Karte committed ist.**"
Regel: Eine Karte streamed ihren Auftritt IMMER erst, nachdem es keine Cancel-Option mehr gibt (alle Auswahlen/Zielwahlen/Kostenwahlen abgeschlossen). Details, Audit-Tabelle und Vertragsabsatz: `cards/effects/CARD_API.md`,
Abschnitt „★ AUFTRITT STREAMEN — ERST NACH DEM COMMIT" und „Welle 63 / W63d".

| Befund | Ursache | Umsetzung |
|---|---|---|
| **Backpack:** Bild + Protokollzeile gingen mit dem „Unpack!"-Klick zum Gegner, vor Artefakt-Galerie und Träger-/Zonenwahl (beide abbrechbar). | Ziel-Artefakt ohne `deferReveal`: `doConfirmPotion` zeigte sofort; bei Abbruch öffnete sich die Zielwahl erneut und der Auftritt kam ein zweites Mal. | Artefakt- und Zonenwahl in `payArtifactCost` (vor dem Reaktionsfenster); Auftritt über den zentralen Puffer. Abbruch an jeder der drei Stellen: nichts gesehen, Karte auf der Hand. |
| **Bug-Klasse:** dasselbe bei JEDER Karte mit abbrechbaren Fragen (27 von 705 Karten + 10 Aktivierungen auf der Ereignisebene, 148 Karten im Zustand). | (a) erste bestätigte Antwort löste den Auftritt aus (mehrstufige Wahl), (b) Ankündigungs-Ereignisse/Protokollzeilen vor jeder Vormerkung (`hand_to_board_fly`, `ability_activated`, `potion_resolved`, `creature_fizzle`…), (c) Zustand (`potionTargeting`, `resolvingCard`, `effectPrompt`) mit Kartenname, (d) Früh-Auftritte in Accusation/Spreading Rumor, (e) Geisterkarte `pending_placement`. | **Auftritts-Puffer** in der Engine (`gs._pendingCardReveal.outbox`): hält alles Gegner-/Zuschauer-Gerichtete zurück; Commit bei erster sichtbarer Wirkung ohne offene Frage / Frage an den anderen Spieler / Ende der Auflösung / Phasenwechsel / `engine.commitAppearance()`; Abbruch löscht Vormerkung samt Puffer. Vormerkung auf ALLEN Wegen. Zustand maskiert. |
| **Zubehör:** verdeckte Surprise verriet den Namen im Flug-Ereignis; `targeting_blocked`-Zeile trug den Kartennamen. | `hand_to_board_fly` mit `cardName` auch bei `faceDown`; Server-Sitzungsebene schrieb `source`. | Name bei `faceDown` weggelassen; `source` entfernt. |

* **Nicht angefasst:** Kartentexte in `data/cards.json`; Client (`public/`) — die Maskierung braucht keine Client-Änderung, daher kein `build.js`-Lauf nötig (`check-bundles` grün). `deferReveal`/`deferBroadcast`/`_holdCardReveal` bleiben gültig.
* **Rest, dokumentiert:** Forceful Revival × wiederbelebte Karte mit abbrechbarer Opfer-/Tribut-Wahl (Animation vor der Wahl, `summonFromDiscard`); Rückfrage an Al unten.
* **Wichtig für alle Wellen:** `git stash` ist über ALLE Worktrees des Repos geteilt — gleichzeitige `stash`/`stash pop` zweier Agenten tauschen Änderungen aus (W63d/W63a, 23.10. 00:27; repariert, siehe Bericht).
* `Bugfix-Note` (stehen in der Commit-Nachricht): Treasure Hunter's Backpack, Accusation, Spreading Rumor. (Alles Übrige sind Engine-/Server-Änderungen ohne Skriptänderung.)

## Tests

Harness `docs/niche-tests/lib/wire.js` (Leitungs-Harness: jede Nachricht an Gegner-Sitz und Zuschauer, verschränkt mit den Fragen an den Spieler; MENSCH-Modus mit den echten `do*`-Handlern und dem echten Antwortweg).

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W63/d-01-backpack-auftritt-erst-nach-dem-commit.js` | Backpack, beide Sitze: Durchlauf (kein Auftritt/Zustandsname vor der letzten Wahl, danach Gegner + Zuschauer), Abbruch an allen 3 Stellen (nichts gesehen, Deck/Gold unverändert), Abbruch → erneut spielen | 54 | rot (16 ✗) |
| `repro/W63/d-02-zauber-und-angriffe-auftritt-erst-nach-dem-commit.js` | 14 Zauber/Angriffe (Attachments, Namens-Dialoge, mehrstufige Wahlen, Opferwahl) × Durchlauf + Abbruch je Stelle | 219 | rot (76 ✗) |
| `repro/W63/d-03-artefakte-und-traenke-auftritt-erst-nach-dem-commit.js` | 9 Artefakte/Tränke (Blood-Soaked Coin, Cool Repair, Difficulty Lever, Eye of Ren, Mysterious Core, Magic Cobalt/Ruby, Ladder to the Sky, Sword in a Bottle) | 138 | rot (36 ✗) |
| `repro/W63/d-04-kreaturen-auftritt-erst-nach-dem-commit.js` | 7 Kreaturen mit Opfer-/`beforeSummon`-Fragen (stumme Vormerkung) | 88 | rot (24 ✗) |
| `repro/W63/d-05-aktivierungen-auftritt-erst-nach-dem-commit.js` | 4 Heldeneffekte, 3 Area-Effekte, 3 freie Abilities (Abbruch = Rundensperre frei) | 152 | rot (50 ✗) |
| `repro/W63/d-06-reaktionsfenster-und-gegnerfragen-nach-dem-commit.js` | Backpack gegen Tool Freezer (Auftritt VOR der Gegnerfrage, NACH den 3 Wahlen; negiert/abgelehnt), Bottled Flame (Gegner zuerst) | 22 | rot (6 ✗) |
| `repro/W63/d-07-alle-handkarten-sweep-auftritt-erst-nach-dem-commit.js` | Sweep über alle 705 Karten mit möglicher Abbruchfrage: Durchlauf + Abbruch ab jeder Stelle, keine Karte zeigt sich vor dem Commit (Ausnahme Forceful Revival) | 4 | rot (27 Karten) |
| `repro/W63/d-08-verdeckte-karten-und-vorschau-bleiben-verdeckt.js` | verdeckte Surprise ohne Namen auf der Leitung (beide Sitze); `pending_placement` wird nicht weitergegeben (statische Prüfung) | 13 | rot (5 ✗) |

## Rückfragen an Al

1. **Geisterkarte der Zusatzaktions-Wahl** (`pending_placement`): der Gegner sah bisher die Creature halbtransparent im Zielplatz, während du den Geber wähltest — jetzt entfernt. Lieber eine **verdeckte** Geisterkarte (Rückseite)? – ja/nein?
2. **Auftritt-Zeitpunkt bei Zielwahl-Karten:** jetzt „erste sichtbare Wirkung" statt „Zielbestätigung" (praktisch gleich); eine Karte, die nach der letzten Wahl nur still den Zustand ändert, zeigt sich am Ende der Auflösung – in Ordnung?
3. **Forceful Revival** × Kreatur mit abbrechbarer Opfer-/Tribut-Wahl: Karte soll solche Kreaturen nicht anbieten (statt Animation vor der Wahl) – ja/nein?
4. **Bottled Flame/Lightning, Overflowing Chalice, Duel** (der Gegner antwortet zuerst): der Gegner sieht die Karte vor seiner Frage – gewollt – ja/nein?
