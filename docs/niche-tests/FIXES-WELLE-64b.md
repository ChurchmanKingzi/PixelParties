# Fix-Welle 64b – Auftritt VOR dem ersten Effektschritt (Auftritts-Puffer + Zustandspuffer)

Umgesetzt vom Agenten **W64b** (Zweig `wave64/W64b`). Rückfrage an Al zu W63d („Auftritt kommt jetzt mit der ersten sichtbaren Wirkung; Karten, die danach nur still den Zustand ändern, zeigen sich erst am Ende der Auflösung – in Ordnung?"), Antwort:
„**Nein, Auftritte sollten allgemein VOR BEGINN der Effekte gestreamed werden (aber nach dem Confirm), nicht erst an deren Ende.** […] Aktiviere eine Karte, wähle ggf. ihre Ziele, bestätige ggf., dass sie feuern soll, DANN streame den Auftritt, dann feuere den Effekt durch."
Vertragsabsatz, Audit-Tabelle, Prüfliste für neue Karten: `cards/effects/CARD_API.md`, Abschnitt „★ AUFTRITT STREAMEN — ERST NACH DEM COMMIT, VOR DEM ERSTEN EFFEKT" und „Welle 64 / W64b".

| Befund | Ursache | Umsetzung |
|---|---|---|
| Der Gegner sah den **neuen Zustand** (Hand, Ablage, Gold, Status, Anhang am Helden, Sperren) und die **Effekt-Protokollzeilen** vor dem Auftritt – bei 157 von 813 Handkarten mit Auftritt (171 inkl. Zeilen/Zuschauer) und 19 Aktivierungen. | W63d committete erst bei der ersten SICHTBAREN Wirkung/am Ende der Auflösung; `game_state` und die ersten `action_log`-Zeilen eines stillen Effekts kamen davor, die Auslieferung stellte den Puffer vor das `card_reveal`. | **Schritt-Erkennung:** Commit VOR jedem `engine.action…`, den wichtigsten Nicht-`action`-Primitiven (Status, Beschwören, Fläche, Mischen …) und jeder Pflichtfrage an den Besitzer; abbrechbare Fragen committen nie (auch nicht nach der bestätigten Antwort). **Zustandspuffer:** ohne offene Frage geht kein `game_state` an Gegner/Zuschauer, mit offener abbrechbarer Frage der Zustand von VOR der Karte + Hülle der Frage; der Commit liefert `card_reveal` → Zeile der Karte → Zurückgehaltenes → Zustand. |
| 13 Karten mit `deferBroadcast` zeigten sich selbst: nur dem Gegner, nicht den Zuschauern; teils gar nicht (nur die Protokollzeile am Ende). **Staff of Illusions** zeigte sich VOR der abbrechbaren Galerie, und der Abbruch verbrauchte die Karte (`{ aborted: true }` im Nicht-Ziel-Weg). Chain Lightning und Pillage zeigten sich doppelt. | Vormerkung fehlte für `deferBroadcast`; eigene `engine.io.to(oppSid).emit('card_reveal')` umgehen den Puffer. | Server merkt jede Karte vor (`deferBroadcast` ohne Wirkung); Skripte markieren ihre Zusagestelle mit `engine.commitAppearance()`; Staff of Illusions: Auftritt hinter der Wahl, Abbruch mit `{ cancelled: true }`. |
| Steam Dwarf Engineer: Dampfstoß-Animation lief VOR der abbrechbaren Galerie (Abbruch verriet die Aktivierung). | Vorschau-Animation vor der Wahl. | Animation nach der Wahl. |
| **Staff of Uncontrollable Destruction** (Als Beispiel). | Im Ausgangszustand kam der Auftritt mit dem ersten Abwurf-Glimmen (erste sichtbare Wirkung) — und in der stillen Lage (nur der Stab, Zieh-Sperre) erst am Ende der Auflösung, NACH dem Zustand. | Auftritt vor Abwurf bzw. Sperren/Zeile/Zustand, beide Sitze, Gegner und Zuschauer (`W64/b-01`). |

* **Nicht angefasst:** Kartentexte in `data/cards.json`; Client (`public/`, daher kein `build.js`-Lauf nötig); CPU-/MCTS-Pfad; Reaktionsfenster (Tool Freezer & Co. bekommen den Auftritt weiter VOR seiner Frage).
* **Falle (gefunden und behoben):** `engine._delay` als Auslöser — die Spielwege warten nach der Auflösung (`_delay(100)`), bevor sie zwischen Abbruch und Erfolg unterscheiden; ein Commit dort verriet Abbrüche. `_delay` ist daher KEIN Auslöser (steht im Vertragsabsatz).
* **Rest, dokumentiert (unverändert):** Kreaturen mit Beschwörungskosten (Auftritt = Landung, Kosten davor), Guardian Beast Hu / Monster Nest (Kosten vor einer späteren abbrechbaren Stufe), Forceful Revival (W63d).
* `Bugfix-Note` (stehen in den Commit-Nachrichten): Alchemic Journal, Birthday Present, Boomerang, Chain Lightning, Elixir of Immortality, Hive's Crown, Horn in a Bottle, Magic Lamp, Monster in a Bottle, Pillage, Planet in a Bottle, Shard of Chaos, Staff of Illusions, Steam Dwarf Engineer, The Yeeting. (Engine-/Server-/Harness-Änderungen ohne Skriptänderung brauchen keine.)

## Tests

Harness `docs/niche-tests/lib/wire.js` (jetzt mit „Auftritt vor dem ersten Effekt-Ereignis / Effektzeile / Zustandswechsel" je Empfänger in `W.pruefeDurchlauf`). Alle sechs Dateien waren auf dem Stand vor W64b rot.

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W64/b-01-staff-of-uncontrollable-destruction-auftritt-vor-dem-effekt.js` | Staff, beide Sitze, normal + still: Auftritt vor Abwurf/Zeile/Zustand, Gegner + Zuschauer | 70 | rot (8 ✗, stille Lage) |
| `repro/W64/b-02-stille-karten-auftritt-vor-dem-ersten-effekt.js` | 15 stille Karten (Buff, Sperre, Gold, Ziehen, Anhang, Trank), Durchlauf + Abbruch | 247 | rot (38 ✗) |
| `repro/W64/b-03-auftritts-puffer-ausloeser-und-zustandspuffer.js` | Auslöser/Nicht-Auslöser, Zustand von vor der Karte, Reihenfolge, Abbruch, Resync, beitretender Zuschauer | 60 | rot (28 ✗) |
| `repro/W64/b-04-aktivierungen-auftritt-vor-dem-ersten-effekt.js` | 20 Aktivierungen (Held, Area, Kreatur, freie/Aktions-Ability), Steam Dwarf Engineer | 309 | rot |
| `repro/W64/b-05-alle-handkarten-sweep-auftritt-vor-dem-ersten-effekt.js` | Sweep über alle Handkarten (Reihenfolge, Gegner + Zuschauer) | 3 | rot (171 Karten) |
| `repro/W64/b-06-karten-mit-eigenem-auftritt-zentral-statt-deferbroadcast.js` | 11 Ex-`deferBroadcast`-Karten: ein Auftritt, vor dem Effekt, Abbruch → nichts | 186 | rot |

Angepasst: `repro/W63/d-04` (Kreaturen: Beschwörungskosten laufen vor der Landung → `ohneEffektOrdnung`). `W63/d-01 … d-08` unverändert grün.

## Rückfragen an Al

1. **Kreaturen mit Beschwörungskosten** (Opfer, Schaden, Bleed): der Auftritt ist die Landung, die Kosten laufen davor (Opfer-Animation, Schaden). Soll der Flug der Kreatur VOR dem Zahlen der Kosten kommen – ja/nein?
2. **Guardian Beast Hu / Monster Nest** (Kosten bezahlt, danach noch eine abbrechbare Stufe mit Rückerstattung): der Gegner sieht die Karte vor dem Abbruch. Folgeauftrag „Kosten erst nach der letzten Stufe" – ja/nein?
3. **Stille Effekte ohne Engine-Primitive** zeigen sich – wie ihr neuer Zustand – am Ende der Auflösung in einem Zug (Auftritt → Zeilen → Zustand). Reicht das – ja/nein?
