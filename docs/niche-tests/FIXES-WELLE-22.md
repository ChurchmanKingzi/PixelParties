# Fix-Welle 22 – Elven Rider, A09-15 bestätigt, „Hero you control"

Al hat die vier Rückfragen aus [FIXES-WELLE-21.md](FIXES-WELLE-21.md) beantwortet (20.10.2026). Ein Agent (**W22a**) hat sie umgesetzt; Zweig `wave22/W22a` ist zusammengeführt.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Elven Rider verlangt Summoning Magic 1 | „Ja, soll er" | `heldBeschwoertRider` in `elven-rider.js`: Aktionsfähigkeit (`heroAgiert`) plus Level-/Schulanforderung (`heroMeetsLevelReq`, harte Negation sperrt weiter), vor dem Angebot und nach der Bestätigung. Ohne tauglichen Helden kein Angebot: Rider bleibt auf der Hand, Gold, Aktion und Einmal-Marke unberührt. Repro `W22/a-1` (88 Prüfungen) |
| Seitenfremder Nachfolger gestohlener Kreaturen (A09-15) | „Das Ruling vom 14. Applied." (Rückfrage: nur Zonen eigener kontrollierter Helden – Lesart A – oder der Dieb darf wie am 14.10. seitenfremd setzen – Lesart B) | **Lesart B, W21a-Regel zurückgenommen:** Stirbt eine gestohlene/kontrollierte Kreatur, darf ihr aktueller Kontrolleur (der Dieb) den Nachfolger seitenfremd in die Zone setzen, die sie belegte (Elven Rider, Bomblebee Cluster, Elven Druid, Cycling Demons, Grave Worm, Hipdall, Old Couple, Orthos, Psychic Scout, The Cosmic Depths, Mischief Invasion, Cute Annoyance Mini); der Besitzer der Zone ohne Kontrolle über die Kreatur bekommt keinen. Der Beschwörer braucht weiterhin einen tauglichen eigenen Helden. Life-Searcher from the Cosmic Depths unverändert (erlaubt). `_summon-eligibility.js` und `_cycling-demons-shared.js` auf den Stand vor W21a |
| Karten mit „Hero you control" | „Nur der aktuelle Kontrolleur, inklusive eines temporären Kontrolleurs" | Ist-Zustand für Skeleton Necromancer, Layn, Deepsea Bats, Guard Change, Reincarnation, Lone Survivor (Repro `W22/a-2`, 204 Prüfungen). Abweichler behoben: **Dark Deepsea God** (`_landingAllowed` ließ die Zone eines abgegebenen Helden zu; bei dauerhafter Abgabe lagen Gott und Tribute danach auf der Hand), **Staff of Illusions** und **Cloudy Slime** (boten die ganze eigene Spalte, auch abgegebene Helden, und fehlten bei übernommenen Gegnerhelden; jetzt `heroesControlledBy`, seitenfremd über `markiereSeitenfremd`) |

Die W21a-Regeln zu Beschwören (nur Kontrolleur) und Platzieren (Besitzer bei temporärer Kontrolle ja, bei dauerhafter nein) bleiben bestehen. Umgestellte alte Repros: `W5-a/05` (zurück auf das Ruling vom 14.10., plus Gegenprobe „Besitzer der Zone: kein Nachfolger"), `W21/a-4`.

## Ergebnis in Zahlen

* Repros: **alle 1011 Repros grün** (Welle 21: 1009); 2 neue Repros, **0 Rückschritte**, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target (wie im Ausgangszustand).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe; die Agenten fuhren zusätzlich 162 Läufe über 27 Karten × 3 Kontrollzustände ohne Befund.

## Offene Rückfragen an Al

Keine. Hinweise: Wendy, the Shy Girl ist eine Reaktionskreatur ohne Skript (keine Wirkung). Teal Fishing Rod und The Master's Key lesen bereits `heroesControlledBy` (nur im Code geprüft, nicht per Repro).
