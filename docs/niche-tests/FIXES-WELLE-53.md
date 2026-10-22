# Fix-Welle 53 – Fee/Ceremony, Artifact-Beobachter, ATK-Boni der Equips, Teleportation Powder

Al hat die Rückfragen aus [FIXES-WELLE-52.md](FIXES-WELLE-52.md) beantwortet (22.10.2026). Ein Agent (**W53a**, Zweig `wave53/W53a`, zusammengeführt) hat sie umgesetzt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 53 / W53a"; Repros `docs/niche-tests/repro/W53/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **Ceremony und Tempelunas Fee** | „Nein." (Ceremony soll die Fee nicht mitnehmen) | Ceremony bietet die Fee nicht an und bewegt sie nicht. Wegeaudit schloss weitere Wege: `actionTransferAttachment` (`feeBlocked`), `actionMoveCard` Support→Support (auf main konnte die Fee damit sogar auf die Gegenseite wandern; Zerstören/Ablegen bleibt möglich), Secret Spell Book fragt für Fee und Nicht-Kreatur-Tokens keinen Platz mehr ab. `a-01` |
| **RHINOCEROS-Platzierungsfenster bei Initiation-Helden** | „Ja, was als Artifact gezählt wird, feuert on-artifact-equipped." | Keine Code-Änderung; Differenztest Initiation-Held == Club für Pests, LOCUST, RHINOCEROS, AME und Lunatic Hawk 2+ auf den Wegen Hand, Fridge, Ceremony (Gegenprobe Fee: keiner feuert). Allgemeines Ruling in CARD_API: Neue Beobachter nutzen `engine.istEquipArtifact`. `a-02` |
| **ATK-gebende Equips** | „Der ATK-Bonus soll nur exakt der aktuelle Träger haben und pro Equip-Instanz exakt einmal hinzugefügt sein – für alle ATK-gebenden Equips." | 21 Equips plus Cloak und Taio/Toras geprüft (Differenztest über Hand, Fridge hin/zurück, Ceremony, zerstört + neu, zwei Kopien, Wirt besiegt + wiederbelebt, Seitenwechsel, Gegnerheld). Future Tech Gun +40 beim Riffel-Anlegen ist der Kartentext (eine zweite Gun aus dem Deck), kein Doppelbuchen. Behobene Fehler: (a) Gun und Infinite Energy Core ließen unter Charme den Bonus stehen, wenn der Charme vor dem Zerstören endete; (b) Aufstieg/Abstieg setzte `hero.atk` auf den gedruckten Wert, die Buchungen liegender Equips/Abilities blieben stehen und wurden beim Abgang doppelt abgezogen (`engine._atkBuchungenNachFormwechsel`); (c) doppeltes `onPlay` buchte den Bonus ein zweites Mal (alle 19 Festbonus-Equips); (d) Teleportation verlor die Fighting-Buchung. Zentraler Baustein: `engine.actionSetAtkGrant(inst, amount)` bucht auf den Zielwert und stempelt den Träger (`counters._atkTraeger`); `ctx.grantAtk` hat Zielwert-Semantik, Core, Gun und Laser Cannon nutzen ihn; Sicherheitsnetze in `sync()`, Fridge, `actionTransferAttachment`. „ATK als abgeleiteter Wert" verworfen (ein Dutzend Einzahler). `a-03`, `a-04` |
| **Teleportation Powder** | „Das Verschwinden und Wiederauftauchen soll keinerlei Hooks feuern, danach soll alles *exakt* so sein wie vor dem Verschwinden." | Hooks: schon vorher feuerte nichts (jetzt per Wächter über alle `runHooks`-Namen und Fensterverteiler belegt; einzige Ausnahme: die Resistance-Prüfung `beforeHeroEffect` beim Verschwinden). Zustand wich ab und ist behoben: Instanz-IDs, Zähler von Abilities, Held-Instanz und Surprises (Fighting-`atkGranted`, `_taioAtkTotal`, `torasAtkBonus`), `turnPlayed`, Reihenfolge der Instanzliste, JSON-Klon des Heldenobjekts, unsichtbare Träger gewonnener Effekte (Tempelunas Grundfeen), `isActiveIn`-Überschreibung, `_teleportedAway`. Die Potion merkt jede mitgehende Instanz mit vollem Zustand in `gs._teleportPending[].instanzen` (serialisierbar, Rewind/MCTS-tauglich). `a-05` |

Angepasste alte Repros: `W51/b-03`, `W52/a-02`.

## Ergebnis in Zahlen

* Repros: **alle 1258 grün** (vorher 1253; 5 neue, auf dem alten Stand rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts, start-hooks, status-renewal, duration, hand-rules, gained-cache, second-action, target-informed, mcts grün.
* `Bugfix-Note`-Zeilen: Inheritance Ceremony, Secret Spell Book, Ancient Tech Infinite Energy Core, Future Tech Gun, Future Tech Laser Cannon, Teleportation Powder, `_equip-shared`, `_engine`.

## Offene Rückfragen an Al

1. **Aufstieg/Abstieg:** Boni der Karten, die am Helden bleiben (Ausrüstung, Fighting), überleben jetzt den Formwechsel. Dauerhafte Zuwächse ohne Karte (Cloak of Edge, Nero Zira, Rakah, Mirjam, Chaorc Pyre Grill Master) werden weiter auf den gedruckten Wert zurückgesetzt. So lassen?
2. **Teleportation Powder, Karte kann nicht zurück** (Zone fremdbesetzt, kein freier Platz): Aktuell kein Hook, nur ihr ATK-Bonus wird abgezogen; Taio/Toras rechnen nicht neu. Soll das wie ein normaler Abgang behandelt werden (`onEquipLost`)?
3. **Resistance-Prüfung** (`beforeHeroEffect`, W13) läuft beim Verschwinden weiter. So lassen?
4. **Crash Landing** („Play this card immediately when an Artifact is equipped …") hat kein Skript und bleibt außerhalb des Scopes.
