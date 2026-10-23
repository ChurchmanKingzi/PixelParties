# Fix-Welle 65 – Beschwörungskosten vor dem Auftritt (Wechselwirkung W64a × W64b)

Umgesetzt vom Agenten **W65a** (Zweig `wave65/W65a`). Details, Audit-Tabelle und Pflichten für neue Karten: `cards/effects/CARD_API.md`, Abschnitt „Welle 65 / W65a" (und der Vertragsabsatz „★ AUFTRITT STREAMEN", Punkt „Karten, die selbst eine Kreatur beschwören").

Regel (Al): **Der Gegner sieht NICHTS, solange der Spieler die Opfer-/Tribut-Wahl noch abbrechen kann** (kein `card_reveal`, keine Protokollzeile, kein Kartenname im Zustand, keine Animation); erst nach der letzten Abbruchstelle kommt der Auftritt, dann Effekt/Animation. Bei Abbruch: nichts gesehen, Karte wieder in der Ablage, Zauber nicht verbraucht.

| Befund | Ursache | Umsetzung |
|---|---|---|
| Nach dem Merge waren `W64/b-01` (8 ✗) und `W63/d-07` (1 ✗) rot: Beim Abbruch der Opfer-/Tribut-Wahl der wiederbelebten Karte (Forceful Revival × 500 Piranhas, Blue-Ice Dragon, …) hatten Gegner/Zuschauer schon `card_reveal`, `spell_played`, `pile_take`. | Die W64b-Hülle committet vor jedem Primitiv aus `AUFTRITT_SCHRITT_PRIMITIVE`; dort standen `summonFromDiscard` und `summonCreatureWithHooks`, die ihre abbrechbare Kostenfrage (W64a) erst im Inneren stellen. Die Hülle sah „keine Frage offen" und zeigte den Auftritt beim Aufruf. | Beide aus der Liste gestrichen; neuer Baustein `engine._auftrittSchrittNachKosten`, gerufen hinter `_beschwoerungKostenVorAuftritt` (Pile-Wege) bzw. hinter dem `beforeSummon`-Block (Kern). |
| Dieselbe Lücke bei Deck-Beschwörungen (`summonFromDeck`, `summonFromPile('deck')`) mit Kosten – von `W65/a-01` gefunden. | Mischen in der Entnahme (`shuffleDeck` = Schritt-Primitiv, `deck_shuffle` = sichtbares Ereignis) committete vor der Kostenfrage; ebenso die Rückgabe nach einem Abbruch. | `opts._kostenVorlauf` (Entnahme/Rückgabe), `_shuffleKostenVorlauf`, Zähler `_auftrittSchrittAus`: Mischen committet im Vorlauf nicht, das Ereignis wartet im Auftritts-Puffer. |
| **Monster Nest**, **Psychic Scout**, **Mischief Militia - SnowItAll** (per Sweep `W65/a-02` gefunden): Aktivierung und Karte wurden vor der abbrechbaren Kostenfrage der gewählten Kreatur gezeigt (Flug bzw. `_firePendingCardReveal`), ein Abbruch verriet sie. | Eigenes Beschwörungsmuster: Commit/Flug zuerst, `summonCreatureWithHooks` (mit Kostenfrage) danach. | Kosten zuerst (`_beschwoerungKostenVorAuftritt`), bei Abbruch Karte zurück + Vormerkung gelöscht, erst dann Auftritt/Flug; Nest sinkt für die Kostenfrage logisch (kann nicht selbst Opfer sein). |

* **Nicht angefasst:** Kartentexte (`data/cards.json`), Client, CPU/MCTS. `W63/d-07`: `AUSNAHMEN = new Set([])` bleibt leer. W64a-Garantie (Kosten vor Animation) und W64b-Garantien (Abbruch → nichts; ohne abbrechbare Frage → Auftritt vor dem ersten Effektschritt) bleiben.
* **Rest, dokumentiert (unverändert):** Guardian Beast Hu (5 Karten werden vor der abbrechbaren Aktionswahl gelöscht; Rückfrage 2 aus W64b), Skullmael's Greatsword / Call of the Deepsea (Trigger: Banner + Einmal-Sperre vor der Kostenfrage der beschworenen Kreatur).
* `Bugfix-Note` (in den Commit-Nachrichten): `_engine` (Baustein: Beschwörungs-Primitive, Forceful Revival & Co.), Monster Nest, Psychic Scout, Mischief Militia - SnowItAll.

## Tests

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W65/a-01-beschwoerungskosten-vor-dem-auftritt-alle-pile-wege.js` | Teil A: Forceful Revival × 7 Kosten-Kreaturen × 2 Sitze (Abbruch an jeder Stelle: nichts gesehen; Durchlauf: Auftritt nach der Kostenwahl, vor Ramm-Anlauf). Teil B: alle Engine-Eintrittspunkte unter offener Vormerkung (summonFromDiscard ×2, -Deck, -Pile ×4, summonCreatureWithHooks) × 2 Kreaturen × 2 Sitze. Teil C: Gegenprobe ohne Kosten. | 450 | rot (52 ✗) |
| `repro/W65/a-02-sweep-alle-beschwoerungs-aufrufer-kostenwahl-abbruch.js` | Sweep: 33 Handkarten + 31 Kreatur-Aktivierungen mit Beschwörungs-Aufruf in einer Kosten-Szene, beide Sitze, Abbruch an jeder Stelle | 3 | rot (Forceful Revival, Monster Nest, Psychic Scout, SnowItAll) |

`W64/b-01` (162 Prüfungen) und `W63/d-07` sind wieder grün, ohne ihre Erwartungen abzuschwächen.

## Rückfragen an Al (Ja/Nein)

1. **Skullmael's Greatsword / Call of the Deepsea:** Bricht der Spieler die Opfer-/Tribut-Wahl der beschworenen Kreatur ab, ist die Einmal-Sperre schon verbraucht und der Banner gezeigt. Soll ein Abbruch die Einmal-Sperre zurückgeben und nichts zeigen (Skullmael: Kosten zuerst; Call of the Deepsea: erst nach der Kostenwahl löschen) – ja/nein?
2. **Guardian Beast Hu** (Löschkosten vor der abbrechbaren Aktionswahl): Folgeauftrag „Kosten erst nach der letzten Stufe bezahlen" – ja/nein? (Rückfrage 2 aus W64b, weiter offen.)
