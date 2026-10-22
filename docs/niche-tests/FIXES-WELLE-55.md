# Fix-Welle 55 – Cykyran War Counselor nach Formwechsel, Resistance vs. Teleportation Powder

Al hat die Rückfragen aus [FIXES-WELLE-54.md](FIXES-WELLE-54.md) beantwortet (22.10.2026). Ein Agent (**W55a**, Zweig `wave55/W55a`, zusammengeführt) hat sie umgesetzt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 55 / W55a" (neue Hooks-Tabelle „Hero Form Changes"); Repro `docs/niche-tests/repro/W55/a-01`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **Resistance gegen Teleportation Powder** | „Nein, Resistance schützt vor Powder." | Ist-Zustand bestätigt (W13/Q144), kein Code geändert (`resistancePruefung` bleibt `true`); als entschiedenes Ruling dokumentiert |
| **Cykyran War Counselor** | „Die Verdopplung muss neu berechnet werden!" | Ursache: `_atkNachFormwechsel` setzt `hero.baseAtk` auf den gedruckten Wert der neuen Form zurück, die Verdopplung war damit weg, die Buchung `hero._cykyranBonus` blieb mit dem alten Betrag stehen (40 → 80, nach dem Aufstieg 90 statt 180, nach dem nächsten Zugbeginn 100). Lösung in zwei Schichten: (1) neuer Hook `onFormChanged` (`engine.fireFormChanged`, gefeuert aus `performAscension`/`performDescend` direkt nach der Zustandsübertragung; Payload `kind`, `hero`, `heroOwner`, `controllerIdx`, `playerIdx`, `heroIdx`, `oldHeroName`, `newHeroName`, `oldBaseAtk`, `newBaseAtk`, `baseAtkReset`), an den sich Cykyran (und künftige Karten) über `hooks.onFormChanged` hängt; (2) Formwechsel-Zähler `hero._formGen` mit Stempel `_cykyranGen`: weicht er ab, zählt die alte Buchung als 0. Ergebnis: ATK = 2 × gedruckter ATK der neuen Form + überlebende Boni (Equip, Fighting, `permAtkDelta`, befristete Gaben werden nicht verdoppelt) |

## Ergebnis in Zahlen

* Repros: **alle 1261 grün** (vorher 1260; 1 neues mit 144 Prüfungen, auf dem alten Stand 84 rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts, start-hooks, status-renewal, duration, hand-rules, gained-cache, second-action, target-informed, mcts grün.
* `Bugfix-Note`-Zeilen: Cykyran War Counselor, `_engine`.

## Offene Rückfragen an Al

1. **Besiegte Helden** (`evenIfDefeated`-Aufstieg/Abstieg): Die Verdopplung läuft wie bisher weiter (besiegte Helden behalten ihre ATK samt Verdopplung; jetzt getestet). Passt das?

## Nachtrag Welle 56 (W56a, 22.10.2026): Formwechsel besiegter Helden

Al hat die Rückfrage zu besiegten Helden beantwortet: Der Abstieg eines besiegten Helden (`evenIfDefeated`: ???, the Throne Robber, Open Invitation) läuft „ganz normal wie jeder andere Abstieg, inklusive ATK-Neuberechnung"; Chuck, the Storyteller und Bloom, the Continent Corruptor (`ascendsFromDefeat`) sind gewollte Ausnahmen, auch dort wird die ATK normal neu berechnet. Ein besiegter Held steigt sonst nie auf (Engine weist `hp <= 0` ab; unverändert).

Befund des Agenten **W56a** (Zweig `wave56/W56a`, zusammengeführt): Beides war schon korrekt umgesetzt, keine Engine-Änderung. `_atkNachFormwechsel`/`_atkBoniNachFormwechsel` prüfen die HP nicht; neue ATK = (Cykyran ? 2 : 1) × gedruckter ATK der neuen Form + überlebende Boni; `onFormChanged` feuert genau einmal. Beim Tod legt der Held Ausrüstung ab und verliert den Fluch (`handleHeroDeathCleanup`), Chuck/Bloom steigen innerhalb von `onHeroKO` auf (vor dem Todes-Aufräumen). Repro `W56/a-01` (1176 Prüfungen, beide Sitze: Abstieg besiegt inkl. Open-Invitation-Weg, Chuck über den echten KO-Pfad, Bloom über Paraseed-Gift; Gegenprobe lebender Held). Repros jetzt **alle 1262 grün**.

Randfund (wird behoben, siehe nächste Welle): Ein verfluchter Held mit ATK-Ausrüstung behält beim Tod einen ATK-Überhang (Club +30: ATK 70 statt 40), weil `handleHeroDeathCleanup` `hero.statuses` zuerst leert und der Abzug der danach abgelegten Ausrüstung auf die sichtbare ATK statt auf `_cursedAtkSuppressed` gebucht wird.
