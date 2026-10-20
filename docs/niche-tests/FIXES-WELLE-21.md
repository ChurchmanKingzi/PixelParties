# Fix-Welle 21 – Restliche Kontrolleur-Regeln

Al hat die vier Rückfragen aus [FIXES-WELLE-20.md](FIXES-WELLE-20.md) beantwortet (20.10.2026). Ein Agent (**W21a**) hat sie umgesetzt; Zweig `wave21/W21a` ist zusammengeführt.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Divine Gift of Time, Unwanted Audience, Divine Gift of the Guardian | „ja" (einen Wirker mit passender Schule verlangen, auch über übernommene Helden) | Wirker-Held mit Schule/Stufe laut `data/cards.json`; eigener oder übernommener Held (Schule/Stufe von ihm, Hand/Gold/Wisdom vom Kontrolleur); ohne Wirker kein Angebot, Karte bleibt auf der Hand, Divine-Gift-Stempel bleibt frei; neue Helfer `hookReaktionWirkerVorhanden`, `hookReaktionWirkerWaehlen`, `hookReaktionWisdomZahlen`. Alle 108 Reaktionsskripte durchgesehen: nur Elven Rider hat dieselbe Lücke (siehe Rückfrage 1) |
| Platzieren in Zonen abgegebener Helden | „doch" – später klargestellt: „… dass der ursprüngliche Besitzer bei temporärer (aber nicht bei permanenter!) Kontrolle weiter in diesen Zonen placen darf" | `zonenRechtAmHeld`: Kontrolleur platziert wie bisher; Besitzer platziert bei temporärer Kontrolle (`charmedBy`) weiter, bei dauerhafter (`permaControlBy`) nicht; Beschwören nur der Kontrolleur; Deepsea-Tausch wird dem Besitzer bei temporärer Kontrolle angeboten; `server.js` `doPlayCreature`: Riegel `held-charmed` blockiert den Besitzer bei temporärer Übernahme nicht mehr |
| Helden-Effekt-Reaktionen (Key, the Cursed Thief) | „nur der aktuelle Kontrolleur" | Kettenfenster und Helden-Konterfenster bieten sie nur noch dem Kontrolleur an (`heroesControlledBy` statt Spalte); Key rechnet Gold und „your opponent" aus Sicht des Kontrolleurs |
| Seitenfremde Beschwörung (A09-15) | „nur der aktuelle Kontrolleur" | `heroAbgegeben`/`heroAgiert` für jede Spalte: Der Held der Zone muss vom Beschwörer kontrolliert werden (Elven Rider, Bomblebee Cluster, Elven Druid, Grave Worm, Hipdall, Old Couple, Orthos, Psychic Scout, The Cosmic Depths, Mischief Invasion, Cute Annoyance Mini; Cycling Demons setzen den Nachfolger nur in die Zone eines kontrollierten Helden) |

Umgestellte alte Repros: `W5-a/05` (A09-15, neue Varianten), `R01-reaction-area-attach-surprise/06`, `W14/b-q150`, `W15/a-r5` (Divine Gift of Time bekam einen Wirker mit Magic Arts ×2).

## Ergebnis in Zahlen

* Repros: **alle 1009 Repros grün** (Welle 20: 1005); 4 neue Repros, **0 Rückschritte**, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target (wie im Ausgangszustand).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe; die Agenten fuhren zusätzlich 180 Läufe über 18 Karten × 5 Kontrollzustände und 40 Läufe zu Time, Unwanted Audience, Guardian und Key ohne Befund.

## Offene Rückfragen an Al (Ja/Nein)

1. **Elven Rider (W21a):** Soll er (Summoning Magic 1; „You cannot summon this Creature, except with its own effect") wie Doomed Town Guard und andere Reaktionskreaturen einen Helden mit Summoning Magic 1 verlangen? (heute prüft er nur Aktionsfähigkeit; das Skript begründet es mit „except with its own effect")
2. **A09-15 (W21a):** Ist gemeint, dass „Kontrolleur" der Kontrolleur des Helden der Zone ist? Dann kann der Dieb den Nachfolger (Rider, Bomblebee Cluster, Cycling Demons) nur noch in die Zone eines Helden setzen, den er selbst kontrolliert. (Lesart des Agenten; hebt das Ruling vom 14.10. für „Held beim Besitzer" auf)
3. **Life-Searcher from the Cosmic Depths (W21a):** Soll er (geliehen, „place … into the same Support Zone") ebenfalls nur in die Zone eines vom Dieb kontrollierten Helden platzieren? (heute erlaubt, Ruling W3/W5a vom 14.10.)
4. **Karten mit „Hero you control" (W21a):** Soll der Besitzer bei temporärer Kontrolle auch bei Dark Deepsea God, Guard Change, Reincarnation, Deepsea Bats, Layn, Skeleton Necromancer platzieren dürfen? (heute nur der Kontrolleur; die zentralen Primitive lassen den Besitzer aber zu)

**Hinweis:** Die Hook-Reaktionen (Jump in the River, Dive Down u. ä.) melden ihr „performs an Action" weiterhin nicht (unverändert).
