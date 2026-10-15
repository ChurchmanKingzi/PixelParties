# Fix-Welle 8 – Beschränkungen und Pflichten ruhen bei Frost, Betäubung, Negation

Al hat die Folgefragen aus [FIXES-WELLE-7.md](FIXES-WELLE-7.md) beantwortet; ein Agent (W8) hat sie umgesetzt, `wave8/W8` ist zusammengeführt.

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Thema | Entscheidung |
|---|---|
| Beschränkungen/Pflichten/Selbstlöschungen/geteilte Pools | „Sofern ein Effekt/eine Beschränkung nicht explizit nicht negiert/abgestellt werden kann, ja – dann ist er während Freeze/Stun/Negation deaktiviert." |
| Toughness-HP, Fighting-ATK (Stempel), fremdes Paraseed-Gift | „Ja, die bleiben bestehen." (keine Änderung, per Repro abgesichert) |
| Prophecy of Tempeste | Die Umleitung läuft bei Freeze/Stun **nicht** weiter; nur der 100-Deckel (statische Regel) bleibt |

## Umsetzung (`wave8/W8`, 3f305f6)

* Neue Prüfer in `_engine.js`: `isHeroPassiveDormant(pi, heroIdx)`, `heroActionCapReached`, `heroFlagsLive`; Heldenverträge (`canPlayCard`, `canPerformAction`, `goldOverdraft`, `blocksActions`, `goldStateRule`) werden nur noch bei nicht ruhendem Helden gelesen; Kreaturenverträge über `isCardPassiveDormant(inst)`.
* Behoben: Mary „nur Cute", Mirjam, Santa Klaus (Zahlbarkeitssperre), Sol Rym „1 Aktion" (und Friedhelm am selben Stempel), Lethe (Selbstabgleich), Kent (Kredit, Aktionssperre; ein bereits gesetzter Nachwirkungs-Stempel bleibt), Logan, Bonded Companion ×4 (HP-Pool, Zonen-/Umsetz-Sperre, „unaffected by …"), Hell Fox, Cute Hydra (Selbstlöschen), Zsos'Ssar (Schadensvorschau), Prophecy of Tempeste (zentraler Prüfer, gilt jetzt auch mit Chilly-Dog-Ausnahme/Webbed/Mumie).
* Weitere Karten derselben Klasse: Ida und Toras („never hit more than 1 target", alle Leser über `engine.heroFlagsLive`), Nao (Überheilung), Luna the Flame Fairy (Firewall), Ghuanjun/Archibald (`canPlayCard`), Learning, Rubin, Ash Worms.
* Unverändert: Warhorse (Ausrüstung = eigene Karte), Tri Fecta/Ad samt Puppet-Tokens, Alice, Carris, Fiona (eigener Kartentext macht sie ausgenommen), Choir und W7b-Fragen 7–10.

## Ergebnis in Zahlen (zusammengeführter Stand)

* Repros: **408 grün** von 755 (Welle 7: 403 von 750); **0 Rückschritte**, keine Abstürze/Timeouts; 5 neue Repros (`W8/01–05`).
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `cards.test.js` ist ein bekannter Zufalls-Flake (im Lauf rot, in drei Wiederholungen einmal rot und zweimal grün, auch auf der Basis zeitweise rot); `artifacts.test.js` Zufalls-Flake (zufällige Helden/Hände, auch auf der Basis). Dauerfeuer über alle Karten: keine neu auffälligen Läufe; zusätzlich 168 Läufe (28 Karten × beide Seiten × normal/gefroren/negiert) ohne Unterschied.

## Nachtrag (15.10.2026): Al hat Fragen 1, Chaos-Diamond/Pinta, Broghan und Xal beantwortet

| Thema | Entscheidung / Umsetzung (`wave8/W8`, c6b6d59) |
|---|---|
| Bonded Companion ohne Pool fällt bei jedem Treffer, Abgang besiegt den Helden nicht | „Ja, gewollt." – keine Änderung |
| Chaos-Diamond / Pinta „never draw from your Potion Deck" | „Nein, das Verbot bleibt bestehen." – Verbot ist der Spieler-Stempel `ps.potionDrawBanned`, Frost/Betäubung/Negation berühren ihn nicht; Repro `W8/06` |
| Broghan „cannot be Frozen" | „Broghan ja" – die Immunität entfällt, solange Broghans Heldeneffekt ruht (Frost/Betäubung/Negation), danach ist sie wieder da; nur Broghans eigener Stempel (`source === Broghan`), fremde Quellen (Heart of Ice, The Sun Sword, Embodiment of Biseria, SnowItAll) bleiben; Selbstabgleich über `bypassStatusFilter` wie bei Lethe. Grenze: eine leise abklingende Negation wird erst beim nächsten Phasen-/Zugbeginn nachgezogen |
| Xals Erlaubnis für Abilities in Support Zones | „Xal nein" – bleibt bei Negation/Frost/Betäubung bestehen, bereits liegende Abilities bleiben, neue dürfen sogar angelegt werden (war schon so, per Repro `W8/06` abgesichert) |

Stand danach: **409 Repros grün von 756**, 0 Rückschritte; `check-*.js` wie zuvor; E2E rot nur battle, lobby, prep, seats, target; Dauerfeuer 66 Läufe ohne Unterschied.

## Offene Fragen an Al (ja/nein) – Stand 15.10.2026: offen sind nur noch 2, 6 und 7 (die Fragen 1, 3, 4, 5 sind beantwortet)

1. Ein gefrorener/betäubter/negierter Bonded Companion hat ohne Pool seine gedruckten 0 HP und fällt bei jedem Treffer; sein Abgang besiegt den Helden dann nicht mehr, weil der Trigger ebenfalls ruht – so gewollt?
2. Bonded Companion „cannot be moved … in any way": soll auch diese Zonensperre ruhen (jetzt ja)?
3. Chaos-Diamond und Pinta „you can never draw cards from your Potion Deck": soll das Verbot bei Negation ruhen (jetzt nicht angefasst)?
4. Broghan „cannot be Frozen" (Stempel `freeze_immune`): soll die Immunität bei Negation von Broghan entfallen (jetzt nicht angefasst)?
5. Xals Erlaubnis für Abilities in den Support Zones: soll sie bei Negation ruhen (jetzt nicht angefasst)?
6. Eine Paraseed, die ein schon vorhandenes Gift übernommen hat (unheilbar, eigener Stempel), nimmt es beim Ruhen mit zurück: so gewollt, oder soll auch dieses Gift bleiben? (Hinweis: Al hat bestätigt, dass ein fremdes Gift bleibt; hier geht es um das von der Paraseed übernommene.)
7. Lethe: ihre 3 Necromancy-Einsätze und die Stufen-Welle ruhen jetzt ebenfalls – richtig?

Außerdem weiterhin offen aus Welle 7: Choir-Schutz über den Tod (Frage 6), W7b-Fragen 7–10.

## Nachtrag 2 (15.10.2026): Bonded Companion, Paraseed-Gift, Lethe

| Frage | Entscheidung / Umsetzung (`wave8/W8`, 371ae36) |
|---|---|
| Bonded Companion, Zonensperre | „Ja, die darf ruhen. Aber sobald der Freeze/Stun/Negate endet, muss der Companion mit exakt dem Hero gelinkt werden, in dessen Zone er ist! Ist dort kein oder ein toter Hero, bleibt er bei 0 HP *und stirbt sofort*." – der Pool hing schon an der aktuellen Spalte; neu: `engine._begleiterPoolAbgleich()` lässt die Kreatur beim Übergang ruhend → wirksam sofort sterben (regulär über `actionDestroyCard`, mit Todes-/Abgangs-Triggern), wenn in ihrer Spalte kein lebender Held steht; Puppet-Tokens ausgenommen; leises Abklingen holt der Zug-/Phasenbeginn nach. Repro `W8/08` (122 Prüfungen) |
| Paraseed, übernommenes Gift | „Das Paraseed-Gift sollte ruhen, aber bei reaktiviertem Paraseed sofort zurückkehren." – war schon so (Repro `W8/07`): das Gift fällt bei Frost/Negation der Paraseed und liegt bei Reaktivierung sofort wieder auf dem Wirt als unheilbares Paraseed-Gift; ein von Anfang an fremdes Gift bleibt |
| Lethe | „Ja" – Necromancy-Einsätze und Stufen-Welle ruhen, wenn Lethe ruht (war schon so, Repro `W8/07`) |

Hinweis zur Paraseed: Das Gift verschwindet während des Ruhens ganz. Soll es stattdessen als normales, heilbares Gift mit Restdauer weiterlaufen, wäre das eine Änderung in `syncParaseedPoison` (nicht gefragt, Ist-Zustand = verschwindet).

**Endstand nach den Nachträgen von Welle 7 und 8 (zusammengeführt):** 413 Repros grün von 759, 0 Rückschritte, 0 Abstürze; alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot); Skilltest-E2E rot nur battle, lobby, prep, seats, target; Dauerfeuer über alle Karten ohne neu auffällige Läufe.
