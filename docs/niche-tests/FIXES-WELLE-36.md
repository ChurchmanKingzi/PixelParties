# Fix-Welle 36 – Antworten auf die W35a-Rückfragen

Al hat die drei Rückfragen aus [FIXES-WELLE-35.md](FIXES-WELLE-35.md) beantwortet (22.10.2026). Ein Agent (**W36a**) hat sie umgesetzt; Zweig `wave36/W36a` ist zusammengeführt (keine Konflikte). Details und Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 36 / W36a"; Repros `docs/niche-tests/repro/W36/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Negierter Treffer von Broghan, Brackle, Arthor, Heragas, Kohta | „Ja, definitiv." (wie bei Alice: negiert = verbraucht und zählt) | Neuer Helfer `engine.heldenEffektZielwahl(ctx, config)` liefert `{ target, negiert }` (`null` aus der Zielwahl + `gs._spellNegatedByEffect`). Negierung (Invisibility Cloak, Surprises, Schutz-/Redirect-Zweig mit neuem Flag `gs._zielNegiertDurchSchutz`) verbraucht den Einmal-Stempel (bei Kohta auch die Sperre `kohta-super-kill:<pi>`) und zählt in allen Attack-Zählern; Abbruch durch den Spieler selbst lässt den Stempel frei und zählt nicht. Brackle: das Opfer ist bei Negierung als Kosten bezahlt (Annahme nach Muster Javelin Throw). Alice und Javelin Throw an das neue Flag angeschlossen. Repros `a-01`, `a-02` |
| „A different/an additional Action"-Karten mit übernommenen Helden | „Ja"; allgemeine Regel: „Sofern ein Klau-Effekt einen Hero nicht ausdrücklich am Handeln hindert, darf er immer auch Reactions einsetzen." | The Master's Plan, Lunar Eclipse, Off Duty, Dream Dust und Shamanic Curse rufen `performImmediateActionAnyHero` mit `mitUebernommenenAktionen: true` auf (wie Hu); Abilities und Heldeneffekte übernommener Helden sind dort ausführbar, Einmal-Stempel gehören dem Spieler. Spider Dance, Loving Puppet Pavi, Traveler from the Future, The Third Circle of Hell unverändert. Repro `a-05` (5 Karten × temporär/dauerhaft × Ability/Heldeneffekt × 2 Sitze). **Audit der Allgemeinregel** (Repro `a-04`): Hand-Reaktionen (66 Karten), Surprises in Zonen übernommener Helden (39), Artefakt-/Trank-Reaktionen (32), Ausrüstungs-Reaktionen, Key und Board-Kreaturen-Reaktionen waren schon korrekt; die einzige echte Lücke waren die Folgeaktionen der fünf Karten |
| Spell-Zähler bei Sofort-Güssen | „Ja, auf jeden Fall." | Jede gespielte Spell-Karte läuft genau einmal durch `engine.zaehleAlsArt('spell', { karte: true })`: `doPlaySpell`, `_castSpellImmediately` (Hu, Coffee, Elixir of Rage, Junshi, Call for Help, Friedhelm …), Love Shot, Archibald, Chaorc Friendly Fireballer, Taio. Teleportal, Trial of …, Silence-Bonus-Spell und Fire Bolts sehen jetzt auch per Hu/Coffee gewirkte Spells. Repro `a-03` (6 Quellen × 6 Leser × 2 Sitze) |

**Nebenfunde, mit behoben:** `_castSpellImmediately` loggte `immediate_action` ohne `player` (Fire Bolts, Kitsune Transformation und Tengu Windstorm sahen Sofort-Güsse nie); ein abgebrochener Sofort-Guss feuerte trotzdem `afterSpellResolved` und stempelte `_spellResolvedTurn` (Eraser Beam); Taios Attack-Nachguss wurde nicht gezählt.

## Ergebnis in Zahlen

* Repros: **alle 1173 Repros grün** (vorher 1168; 5 neue), 0 Rückschritte (Voll-Lauf nach dem Zusammenführen bestätigt).
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E (Lauf des Agenten): rot nur battle, lobby, prep, seats, target (Ausgangszustand).
* Dauerfeuer des Agenten: 20 Karten × 2 Sitze, identisch zur Basis, 0 Engine-Fehler, Hänger oder Audit-Fehler.

## Offene Rückfragen an Al (Ja/Nein)

1. **Brackle:** Soll bei einem im Zielfenster negierten Treffer das Opfer (die geopferte Kreatur) bezahlt bleiben? (heute ja; Alternative: bei Negierung wird nichts geopfert)
2. **Controlled Attack:** Gibt dem Controlled-Attack-Spieler keine Reaktions-/Zauberkontrolle über den Helden (W20c). Gilt das weiter, obwohl die Allgemeinregel „übernommene Helden dürfen auch Reactions einsetzen" jetzt gilt? (Kartentext nennt nur „Abilities and active effect"; nichts geändert)
3. **Eraser Beam:** Liest nur aufgelöste Spells (`afterSpellResolved`); ein negierter Spell zählt dort nicht als „anderer gespielter Spell", obwohl er in `spellsPlayedThisTurn` zählt. Soll Eraser Beam auch einen negierten Spell sehen?
