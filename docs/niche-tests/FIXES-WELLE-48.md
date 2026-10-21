# Fix-Welle 48 – Silence-Sofortfenster, Spell-Auswahl sperrt Surprises, Surprise auf Surprise

Al hat die sechs Rückfragen aus [FIXES-WELLE-47.md](FIXES-WELLE-47.md) beantwortet und zwei Ergänzungen gegeben (22.10.2026). Ein Agent (**W48a**) hat sie umgesetzt; Zweig `wave48/W48a` ist zusammengeführt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 48 / W48a"; Repros `docs/niche-tests/repro/W48/a-01 … a-06`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Limits blocken Surprise-Aktivierung (Mirjam, Muras, Kogarasu); Spike-Trap-Rückstoß = Spell; Güldefaber/Brewer's Blade | „Ja, das ist korrekt so." / „Korrekt, Spike Traps Schaden gilt als Spell …" / „Ja, das funktioniert beides." | Ist-Zustand, abgesichert (`a-04`, `W47/a-02`, `W47/a-03`) |
| Silence-Bonus-Spell | „Nein – und das dürfte eigentlich überhaupt nicht möglich sein. Silence soll den Gegner SOFORT einen zusätzlichen Spell ausführen lassen, wie beispielsweise Victory Phoenix Cannon. In diesem Timeframe von ‚Choose a Spell to activate' sollte überhaupt keine Surprise aktivierbar sein!" | (a) Eine aktivierte Spell-Surprise verbraucht den Silence-Bonus nicht (`zaehleAlsArt` mit Parameter `surprise: true`; sie zählt weiter in den Spell-Zählern). (b) **Silence hatte vorher gar kein Auswahlfenster**, nur einen Token `_silenceBonusSpell` für den Rest des Zuges; jetzt bekommt Silence nach der Kette (`queuePostChainAction`, wie Master's Plan und Shamanic Curse) ein Sofort-Fenster `performImmediateActionAnyHero` (nur Spells, abbrechbar); der Token lebt nur in diesem Fenster, ein nicht gewählter Bonus-Spell verfällt. (c) Zentrale Sperre: `engine.spellAuswahlOffen()` (Zähler `_spellAuswahlTiefe`, geöffnet von `promptSpellAuswahl`/`_mitSpellAuswahl`); solange offen, liefert `_canHeroActivateSurprise` false – das Tor aller Surprise-Fenster (Zielschutz, Schaden, Hook, Draw, Hand-Listen); `_activateSurprise` bricht ab, die Surprise bleibt verdeckt (Log `surprise_blocked_spell_selection`). Hand-Reaktionen bleiben unberührt. Betroffene Auswahlstellen: Silence, `performImmediateAction` (Coffee, Elixir of Rage, Junshi, Chalice …), `performImmediateActionAnyHero` (Hu, Master's Plan, Lunar Eclipse, Off Duty, Dream Dust, Shamanic Curse), Victory Phoenix Cannon (beide Prompts), Yukana, Friedhelm, Call for Help, Difficulty Lever, Aurora Borealis, Circles of Hell, Learning, Archibald. Repros `a-01`, `a-02` (auf der Basis rot; Gold Trap aktivierte im offenen Prompt) |
| Surprise auf Surprise | „Ja, auch wenn eine Surprise auf eine Surprise reagiert, soll die ein Fenster öffnen, die Verschachtelungstiefe soll theoretisch beliebig tief gehen können." | In `_activateSurprise` entfällt die Bedingung `!_inReactionCheck` fürs „performs"-Fenster; `_surpriseNestingBlocked` (Tiefenkappe 10) liefert immer false; die Per-Hero-Sperre `_activeSurpriseHeroes` bleibt als Schutz vor Re-Entrancy desselben Helden-Slots (jede Surprise löst nur einmal aus). `a-05` |
| Creature-Surprise-Aktivierung | „Das Aktivieren einer Creature-Surprise an sich soll NICHT ‚on creature effect' feuern. Nur, wenn diese Creature-Surprise dann selbst einen Effekt auslöst, der ein Ziel anvisiert/trifft (etwa Water Golem …), löst das on creature effect aus." | Matrix gemessen (5 Creature-Surprises × 11 Leser, beide Sitze): Ist-Zustand schon korrekt, kein Code geändert. Aktivierung: nie ein Leser/Zähler; Pure Advantage Camel: nichts; Water Golem: bei der Zielwahl feuern alle Leser; Cybug ANTS: Jumpscare, Jumper Spider, Spider Avalanche, Hand-Reaktionen (Booby Trap, Firewall, Mountain Tear River bewusst nicht: kein Angreifer auf dem Brett); Afflicted Vermin: Shield of Wisdom, Rolling Boulder bei der Kreaturenwahl. `a-03` |
| Arrows/Racket Arrow nur für Angriffe eigener Helden | „Racket Arrow ist eine Reaction, keine Surprise, und sollte nur für Angriffe EIGENER Heroes aktiviert werden können. Sollte man ihn, oder irgendeinen Arrow, aktuell an einen gegnerischen Angriff ketten können, wäre das ein Fehler!" | Gemessen: kein Weg ketten Pfeile an gegnerische Angriffe, kein Code geändert. 17 Quellen × 9 Pfeil-Karten × beide Sitze mit Gegenprobe (Angreifer bekommt seine Pfeile angeboten), Bluff-Aktivierung (nur Steuerer), Charme (Kontrolleur ja, Besitzer nein); zentrale Prüfung `arrowTriggerCondition` (`initial.owner === pi`). `a-06` |

Umgestellter alter Repro: `W47/a-02` („Silence-Bonus-Spell verbraucht" → „bleibt stehen").

**Beobachtung:** `_runPostChainActions` läuft nur in den Spielhandlern und im CPU-Dispatcher; Silence auf einem Weg ohne diese Handler öffnet sein Fenster erst beim nächsten Drain und lässt bis dahin den Token stehen.

## Ergebnis in Zahlen

* Repros: **alle 1230 Repros grün** (vorher 1224; 6 neue), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: mit `NODE_PATH` grün: cards, draw-cards, sacrifice, seats (im Sammellauf einmal rot, einzeln grün).
* Dauerfeuer: 16 Karten × 2 Seiten, 0 Unterschiede.
* `Bugfix-Note`-Zeilen (Silence, Victory Phoenix Cannon u. a., `_hell-circles-shared`) im Commit.

## Offene Rückfragen an Al (Ja/Nein)

1. **Silence-Bonus-Spell:** Er wird jetzt sofort nach der Kette angeboten und verfällt, wenn man ihn dort nicht wählt (vorher: ein Spell später im selben Zug möglich). Ist das so gewollt? (entspricht deiner Aussage „SOFORT")
2. **Dark Ocean und Creature-Surprise-Platzierung:** Unter Dark Ocean kann der Gegner nicht auf die Platzierung einer Creature-Surprise reagieren (z. B. Off Duty auf Pure Advantage Camel), weil die Platzierung Teil des Surprise-Effekts ist. Soll Dark Ocean die Reaktion auf die bloße Platzierung doch zulassen? Heute nein.
3. **Hand-Reaktionen im Spell-Auswahl-Zeitfenster:** Sie bleiben möglich, gesperrt sind nur Surprises. Passt das?
