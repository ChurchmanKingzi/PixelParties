# Fix-Welle 47 – Surprise-Aktivierung als Kettenfenster und Zähler, Spike Trap, Mountain Tear River

Al hat die sieben Rückfragen aus [FIXES-WELLE-46.md](FIXES-WELLE-46.md) beantwortet (22.10.2026). Ein Agent (**W47a**) hat sie umgesetzt; Zweig `wave47/W47a` ist zusammengeführt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 47 / W47a"; Repros `docs/niche-tests/repro/W47/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| 1–3: Creature-Surprise als Angreifer, Rolling Boulder, Shield of Wisdom | „Ja, das ist in Ordnung." / „Passt" / „Passt." | Ist-Zustand bleibt, abgesichert (`a-05`) |
| Kettenfenster „Hero performs" bei Surprise-Aktivierung | „Ja!" | Zentral in `engine._activateSurprise`: Eine aktivierte Spell-/Attack-Surprise öffnet über `executeCardWithChain` ein Fenster nach ihrem cardType (Besitzer = Steuerer, Wirker = Wirt-Held, Herkunft Brett, keine Aktion/Zusatzaktion); Negation in der Kette gilt als negierte Surprise; Pfeile, die das Fenster bewaffnet hat, räumt `clearArmedArrows` ab. Kein zweites Fenster mitten in einer offenen Kette und im MCTS-Rollout; Per-Hero-Sperre und Tiefenkappe bleiben. Reagieren jetzt: Stealthy Pursuit, Angelfeather/Bomb/Flame/Golden/Hydra Blood/Poisoned/Racket/Rainbow's Arrow, Magic Topaz, Bow of the Hunt Goddess (nur Attack-Surprise), Silence und Shamanic Curse des Gegners (Spell-Surprise); Creature- und Artifact-Surprises öffnen kein Fenster. `a-01` (356 ok; Basis 52 ✗) |
| Spike Trap | „Ja, soll Spell-Schaden sein" | Rückstoß-Schaden jetzt Spell-Schadenstyp (`decay_spell`). Folgen: Corpse Explosion reagiert auf das Besiegen des Angreifers, Surprises des Angreifers („hit by a Spell", z. B. Booby Trap) öffnen auf den Rückschlag, Spell-Schadensboni greifen, Anti Magic blockt weiter. Das alte Rückstoß-Ruling „ohne Reaktionsfenster" hing allein am Typ `other` (`SURPRISE_SKIP_TYPES`) und fällt damit zwingend weg. `a-03` (Basis 8 ✗) |
| Zähler | „Eine aktivierte, ja" | Eine aktivierte Spell-/Attack-Surprise ruft einmal `zaehleAlsArt` auf (neuer Parameter `schule`, Log `effect_counted_as_spell` trägt die Zauberschule). Zählt jetzt: `spellsPlayedThisTurn`, `attacksPlayedThisTurn`, `heroesAttackedThisTurn`, `hero._attacksThisTurn`; Mirjam, Güldefaber, Brewer's Blade, Teleportal („first Spell"), Fire Bolts (Destruction-Magic-Surprises), Silence-Bonus (wird verbraucht), Berserk, Rioting Village, Quick Attack, Amazing Finding, Knife Throw, Trials, Muras, Muscle Training, Punch in the Box; Eraser Beam (aktivierte Spell-Surprise stempelt, Bluff nie, negierte nicht). Auch negiert wird gezählt; nur gesetzte und Creature-Surprises zählen nie; kein Doppelzählen; auch die Kettenaktivierung von Lunar Eclipse zählt. `a-02` (Basis 38 ✗) |
| Mountain Tear River | „Ja, aber nur spezifisch die Creatures in den Support Zones des River-Heroes." | `_zielwahlAbschliessen` meldet gewählte Kreaturen in der Support Zone jetzt in einem eigenen `_checkSurpriseWindow`-Aufruf; das Fenster öffnet nur für den Helden, in dessen Support die Kreatur steht; nur Skripte mit `surpriseFiresOnSupportCreature` reagieren (nur Mountain Tear River). Kreaturenwahlen über `promptDamageTarget` und `promptMultiTarget` meldete die Karte schon seit v703. Andere Surprises unverändert (`a-04` prüft 13 gegen). `a-04` (Basis 6 ✗) |

## Ergebnis in Zahlen

* Repros: **alle 1224 Repros grün** (vorher 1218; 5 neue), 0 Rückschritte; kein altes Repro umgestellt.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice.
* Dauerfeuer: 20 Karten × 2 Seiten, 0 Unterschiede.
* `Bugfix-Note`-Zeilen (Spike Trap, Mountain Tear River, `_engine`) in den Commits.

## Beobachtungen (nicht geändert)

* Ruft ein Spell den Dispatcher nur mit `title` auf (z. B. Aligning Goals), hat die Quelle im Helden-Fenster `heroIdx -1`; Surprises, die den Angreifer brauchen (Spike Trap, Mountain Tear River bei Heldenwahl), lösen dort nicht aus.
* Löst eine Surprise aus der Auflösung einer Kette aus (z. B. durch die Kreaturenwahl von Racket Arrow), öffnet sie kein eigenes Fenster „performs" und zählt nur (Frage 5).
* Seit v1154 blockt `_canHeroActivateSurprise` über `canPlayCard` (Mirjam, Idej Sword Muras/Kogarasu) die Aktivierung einer Attack-/Spell-Surprise, wenn der Held sein Limit schon erreicht hat (Frage 1).

## Offene Rückfragen an Al

Alle sechs sind beantwortet und in [FIXES-WELLE-48.md](FIXES-WELLE-48.md) umgesetzt bzw. bestätigt (dort stehen die neuen Rückfragen).
