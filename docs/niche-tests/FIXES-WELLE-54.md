# Fix-Welle 54 – Dauerhafte ATK-Änderungen beim Formwechsel, Teleportation Powder

Al hat die Rückfragen aus [FIXES-WELLE-53.md](FIXES-WELLE-53.md) beantwortet (22.10.2026). Ein Agent (**W54a**, Zweig `wave54/W54a`, zusammengeführt) hat sie umgesetzt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 54 / W54a"; Repros `docs/niche-tests/repro/W54/a-01`, `a-02`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **Formwechsel (Aufstieg/Abstieg)** | „Nein, auch permanente Änderungen sollen überleben." | Neuer ATK = gedruckter ATK der neuen Form + alle fortbestehenden Buchungen (nicht der alte Stand kopiert). Neuer Baustein `engine.actionPermAtk(hero, owner, heroIdx, amount, source)` (über den ATK-Trichter `_applyHeroAtkDelta`, zusätzlich in `hero.permAtkDelta`); `_atkNachFormwechsel`/`_atkBoniNachFormwechsel` zählen Ausrüstungs-Stempel, Fighting, `permAtkDelta` und befristete Gaben (`_tempAtkGrants`). Umgestellt: Cloak of Edge, Nero Zira, Rakah, Mirjam (schrieb am Trichter vorbei: unter Fluch wuchs die sichtbare ATK), Chaorc Pyre Grill Master, Wavilion (weiterer Fund). Taio/Toras/Fighting-Aura-Anteile der alten Form fallen bewusst weg (die Aufstiegskarte trägt diesen Text nicht). Zusatzfunde: Form ohne ATK-Angabe (Styx) schlug Boni doppelt auf; verfluchter Held sprang beim Formwechsel sichtbar auf den gedruckten ATK; Aura-Buchführung (Rioting Village) wird vor dem Neuaufbau verworfen; Abstieg in eine 0-ATK-Form (Rakah) ließ die alte ATK stehen. HP/Max-HP: Fehlerklasse tritt nicht auf (Max-HP +230 überlebt beide Wechsel). `a-01` |
| **Teleportation Powder: Karte kann nicht zurück** | „Ja" (normaler Abgang) | Kann eine mitgenommene Karte nicht zurückkehren (Zone fremdbesetzt, kein Platz), verlässt sie den Helden wie bei jedem normalen Abgang: `onCardLeaveZone` nur an die Karte, dann `onEquipLost` mit `reason: 'teleportLost'` (Taio, Toras, Aufstiegs-Bereitschaft, Tempeluna rechnen neu); Zustand = „lag nie dort". Verschwinden, normales Auftauchen und Ausweichplatz bleiben hook-frei. `a-02` |
| **Teleportation Powder: Resistance beim Verschwinden** | „Nein" (keine Prüfung) — *W55: Al entschied „Nein, Resistance schützt vor Powder" (Ist-Zustand bleibt)* | **Nicht geändert** – widerspricht dem dokumentierten Ruling W13/Q144 („Resistance blockt jeden Nicht-Schaden-Effekt") und dem Kartentext von Resistance Lv3 („unaffected by all cards and effects, except damage"). Schalter `resistancePruefung` im Export von `teleportation-powder.js` (aktuell `true`) ist vorbereitet; bei `false` feuert das Verschwinden keinen einzigen Hook. Rückfrage 1 |

Angepasst: `W53/a-05` (D) (Taios Bonus für das verlorene Artifact rechnet mit neu); `scripts/check-atk-funnel.js` um die Ausnahme für `_atkNachFormwechsel` ergänzt.

## Ergebnis in Zahlen

* Repros: **alle 1260 grün** (vorher 1258; 2 neue, auf dem alten Stand rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts, start-hooks, status-renewal, duration, hand-rules, gained-cache, second-action, target-informed, mcts grün.
* `Bugfix-Note`-Zeilen: Cloak of Edge, Nero Zira, Rakah, Mirjam, Chaorc Pyre Grill Master, Wavilion, `_engine`, Teleportation Powder.

## Offene Rückfragen an Al

1. **Teleportation Powder und Resistance:** Soll Resistance (Lv1: erste Karte je Zug, Lv3: alles außer Schaden) gegen Teleportation Powder wirkungslos werden? Das würde W13/Q144 und den Resistance-Kartentext brechen. Wenn ja: eine Zeile umlegen und `W13/b-q144`, `M02/11`, `W53/a-05` anpassen.
   **→ Entschieden (Al, W55): „Nein, Resistance schützt vor Powder."** Ist-Zustand bleibt (W13/Q144; Schalter `resistancePruefung` in `teleportation-powder.js` bleibt `true`), keine Codeänderung; die Frage ist erledigt (siehe `CARD_API.md`, „Welle 55 / W55a").
2. **Cykyran War Counselor:** Nach einem Formwechsel fehlt die Verdopplung der Base-ATK (Held steht bei der gedruckten ATK der neuen Form, obwohl die Kreatur liegen bleibt; Test: 40 → 80, nach dem Aufstieg 90 statt 180, nach dem nächsten Zugbeginn 100). Soll die Verdopplung beim Formwechsel auf den neuen Grundwert neu gerechnet werden (neuer Hook `onFormChanged`)?
   **→ Entschieden (Al, W55): „Die Verdopplung muss neu berechnet werden!"** Umgesetzt in W55a (Hook `onFormChanged`, Formwechsel-Zähler `hero._formGen`, Repro `W55/a-01`).
