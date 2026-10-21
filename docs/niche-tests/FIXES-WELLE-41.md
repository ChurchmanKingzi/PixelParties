# Fix-Welle 41 – Antworten auf die W40a-Rückfragen

Al hat die sechs Rückfragen aus [FIXES-WELLE-40.md](FIXES-WELLE-40.md) beantwortet (22.10.2026) und die Folgerung zu Attack-Limits bestätigt. Ein Agent (**W41a**) hat sie umgesetzt; Zweig `wave41/W41a` ist zusammengeführt (keine Konflikte). Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 41 / W41a"; Repros `docs/niche-tests/repro/W41/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Hardy Slime (Taunt) bei Alluring Light | „Der Taunt greift in beiden Fällen NICHT … Effekte, die nur Heroes treffen können, werden von Hardy Slime nicht abgedeckt (das ‚if possible' in seinem Text)." | Ist-Zustand bleibt; die Engine setzt das „if possible" überall gleich um (Taunt filtert nur, wenn der Slime selbst in der Zielliste steht). `a-01`: Attack und Fireball zwingen auf den Slime, Memory Wipe, Whirlwind Strike und Alluring Light bleiben frei |
| Kunagi: Kosten der Wiederholung | „In jedem Fall müssen die Kosten wiederholt werden! Natürlich darf der Spieler das auch ablehnen, dann triggert Kunagi nicht und seine Ladung wird nicht verbraucht (gilt generell)." | Sacrificial Dagger (weiteres Opfer, eine Kreatur), Bamboo Staff (erneut eine Karte aus der Ablage) und Kohta, Master („spend your Action": eine Zusatzaktion) zahlen bei jeder Wiederholung erneut; Brackle, Infected Greatmaw, Javelin Throw wie in W40a. Ablehnen = Abbrechen der Kosten-/Zielwahl; ohne zahlbare Kosten kein Angebot; ein abgelehntes Angebot lässt Einmal-Stempel, Weich-Stempel und Aktion unberührt (und markiert die auflösende Karte nicht mehr als abgebrochen). `a-02` |
| Kunagi × Alluring Light | „Ja" | Ist-Zustand: Der Kunagi-Besitzer wählt das neue Opfer unter den Zielen des Light-Spielers (`a-05` Teil A) |
| Schutz-Effekte (Butterfly Cloud …) | „Der Clouded-Hero ist solange geschützt, wie sein Beherrscher andere Heroes als mögliche Ziele kontrolliert. … es geht nur darum, dass ein gegebener Effekt noch andere Heroes des Cloud-Spielers wählen kann – DANN gilt Cloud, sonst nicht." | Schutzrechnung gegen die **Zielmenge des konkreten Effekts**: Alluring Light rechnet über die angriffsfähigen Gegnerhelden (sind alle anderen wegen Frozen/Stunned nicht wählbar, ist der Clouded-Held wählbar; vorher unspielbar – Korrektur zu W40a); `promptDamageTarget`/`promptMultiTarget` mit `dimUnmetCondition` zählen ausgegraute Helden nicht mehr als „anderes mögliches Ziel"; `heroStatusSchutzFilter`/`heroStatusGeschuetztGegen` (Sword in a Bottle) rechnen ohne bereits ausgeschlossene Helden und markieren reihenfolgeunabhängig. Unverändert (rechneten schon über die Effekt-Liste): Icy Slime, Warlord's Bite, Frost Breaker, Mischief Invasion, `blocksTargeting` (Stealth, Dive Down, Alliance, Stealthy Pursuit, Jetpack). Gewöhnliche Spells/Attacks: Frozen/Stunned-Helden bleiben mögliche Ziele, Cloud schützt weiter. `a-04` |
| Duel-Pfeile | „Der Pfeil-Bonus geht in jedem Fall an den ‚Schaden, der ausgeführt wird'." | Ist-Zustand: Der Bonus gehört dem Duellanten, auch wenn Held 1 die Karte spielt, und gilt nur für den ersten Schlag (`a-05` Teil B) |
| Kunagi-Wiederholung als Attack | „Ja, das sollen in jedem Fall eigene Attacken-Instanzen sein!" – Folgerung bestätigt: „hat z. B. eine Mirjam schon ihre maximale Anzahl Attacken ausgereizt, kann Kunagi schlicht nicht für sie triggern." | Jede Wiederholung (Effekt UND gespielte Attack-Karte) ist eine eigene Attack-Instanz, zählt in allen Attack-Zählern und unterliegt den Attack-Limits (Mirjam, Berserk, Rioting Village, Knife Throw …): gesperrt = kein Angebot, nichts bezahlt, nichts verbraucht (`zaehleAlsArt` mit Vormerkung `gs._attackVorgezaehlt`). `a-03` |

Umgestellte alte Repros: `W40/a-03` (Dagger, Bamboo, Kohta bekommen die nötigen Opfer/Ablagekarten/Zusatzaktionen), `W40/a-04` (Cloud-Held bei frozen/stunned übrigen Helden jetzt spielbar und wählbar; ergänzt: „alle drei eingefroren: unspielbar"). `W39/a-*` unverändert grün.

**Beobachtung, nicht geändert:** Der Taunt (Hardy Slime) sitzt nur in `promptDamageTarget`, `promptMultiTarget` und `normalizeValidTargets`; Karten, die eine gemischte Helden-und-Kreaturen-Liste selbst bauen und direkt an `promptEffectTarget` reichen, umgehen ihn.

## Ergebnis in Zahlen

* Repros: **alle 1204 Repros grün** (vorher 1199; 5 neue), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice, keepmodel.
* Dauerfeuer: 14 Karten × 2 Seiten, Fingerabdrücke identisch zur Basis, 0 Fehler.

## Offene Rückfragen an Al

Alle fünf sind beantwortet und in [FIXES-WELLE-42.md](FIXES-WELLE-42.md) umgesetzt (dort stehen die neuen Rückfragen).
