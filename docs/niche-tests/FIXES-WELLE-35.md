# Fix-Welle 35 – Antworten auf die W34a-Rückfragen, Zusammenführung mit `main`

Al hat die vier Rückfragen aus [FIXES-WELLE-34.md](FIXES-WELLE-34.md) beantwortet (22.10.2026). Ein Agent (**W35a**) hat sie umgesetzt; Zweig `wave35/W35a` ist zusammengeführt. Danach wurde `origin/main` (77 Commits: MoniaBot, Tooltips, Draft, Variable Kosten …) in den Branch gemerged; Konflikte nur in `CARD_API.md` (Ende, beide Seiten behalten) und `inheritance-ceremony.js` (physicalSide und `ausruestOpts` kombiniert). Scope-Hinweis von Al: Karten ohne Skript sind **nicht** Teil dieses Projekts und werden nicht umgesetzt.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Alice, Einmal-Stempel bei Negierung | „Nein, wenn Alices Effekt abgeblockt/negiert wird, ist er für die Runde verbraucht." | Nur bei Silence stimmte das; bei **MOE Shield und Magic Mirror gab Alice den Stempel frei** (ein zweiter Versuch im selben Zug traf). Behoben: `null` aus `promptDamageTarget` zusammen mit `gs._spellNegatedByEffect` gilt als „negiert" (Muster Javelin Throw); der Effekt zählt als gespielter Spell, der Stempel bleibt verbraucht. Repro `W35/a-01` |
| Magic Mirror bei Alice | „X, wobei X das Ability-Level ist, ist korrekt – das ist ja laut neuem Ruling offiziell das Level des Spells." | Ist-Zustand (Pollution Tokens = Destruction-Magic-Level) bestätigt, Repro `W35/a-02` |
| Hu und übernommene Helden | „Ja, sollen sie!" | Hu bietet für einen übernommenen Helden auch **Abilities und Heldeneffekte mit Aktionskosten** an (neue Option `heroSide` in `getActivatableAbilities`/`getActiveHeroEffects`, Flag `mitUebernommenenAktionen` nur bei Hu). Der Server nimmt die Antwort nur an, wenn der Prompt genau diese Aktion für genau diesen Helden angeboten hat. Hand, Gold und Wisdom gehören dem Kontrolleur; **Einmal-Stempel gehören dem Spieler** (Muster `ability-action:<Name>:<Spieler>`, Ruling „hard once per turn"): eigene und übernommene Kopie teilen sich den Stempel. Matrix eigen ↔ übernommen (Frozen, Stunned, Webbed, Negated hart/leicht, Bound, Aktionssperre, Einmal-Stempel, Kent, Spielstart-Schutz): in allen 12 Fällen gleich. Repro `W35/a-00`. Client: nur `heroAction`-Pfad in `app-board.jsx` |
| Mirjam und „1 Attack pro Zug" | „Ja, beheben. ‚Can never use more than 1 Attack per turn' ist ziemlich eindeutig." | Ursache: Mirjams Zähler und Ghuanjuns Namenssperre hingen an `onActionUsed`, das für inhärente Zusatzaktionen (Quick Attack, Berserk-Attack) und negierte Attacks nicht feuert; `_castSpellImmediately` zählte Attack-Karten für gar keinen Zähler. Jetzt läuft jede gespielte Attack-Karte durch `engine.zaehleAlsArt('attack', { karte: true })` (`doPlaySpell` aufgelöst und negiert, `_castSpellImmediately`, Love Shot, Nieht). Repros `W35/a-03`, `a-04` |

**Nebenfund (außerhalb des Auftrags, notwendig):** `_processBleedAfterAction` traf bei einer Aktion eines übernommenen Helden den gleich nummerierten eigenen Helden des Spielers; jetzt Brettseite des handelnden Helden (`heroOwner`).

## Ergebnis in Zahlen

* Repros: **alle 1168 Repros grün** (vorher 1163; 5 neue) – auch nach dem Merge mit `main`; 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E und Dauerfeuer: siehe Abgabebericht des Merge-Laufs (unten ergänzt, falls abweichend vom Ausgangsstand).
* **Nicht im Browser geprüft:** die Klickpfade von Hu in `app-board.jsx` (nur Build-Check).
* Bot-Tests (`bot/test`) brauchen `npm install` im Ordner `bot/` und wurden nicht ausgeführt; der Bot-Code ist unverändert gegenüber `main`.

## Offene Rückfragen an Al (Ja/Nein)

1. **Broghan, Brackle, Arthor, Heragas, Kohta:** Wird ihr Treffer im Zielfenster negiert (z. B. Invisibility Cloak), bleibt heute der Einmal-Stempel frei und der Treffer zählt nicht als Attack. Soll hier dieselbe Regel gelten wie bei Alice (negiert = verbraucht und zählt)?
2. **Master's Plan, Lunar Eclipse, Off Duty, Dream Dust, Shamanic Curse („a different/an additional Action"):** Sollen sie für übernommene Helden ebenfalls Abilities und Heldeneffekte anbieten? (Eigene Helden bieten sie schon an; Hu ist nach Welle 35 die Ausnahme.)
3. **Spell-Zähler bei Sofort-Güssen:** `_castSpellImmediately` zählt Spell-Karten nicht in `spellsPlayedThisTurn`; Teleportal („first Spell"), Eraser Beam, Trial of … und der Silence-Bonus-Spell sehen einen per Hu oder Coffee gewirkten Spell nicht. Soll das wie bei den Attacks behoben werden?
