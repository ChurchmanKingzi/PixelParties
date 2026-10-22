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
