# Fix-Welle 63b – Card Game Player Inya: der Fantasy Buddy Token ersetzt die Karte, nicht die Wirkung

Umgesetzt vom Agenten **W63b** (Zweig `wave63/W63b`), Befund von Al (Spieldesigner): „Wenn Inya mit ihrem Effekt einen Creature-Token aus dem Spell Eraser Beam macht und dieser dann getötet wird und das Spielfeld verlässt, feuert der lingering Effect von Eraser Beam (also der Instant-Kill) nie!" Details und Audit-Tabelle: `cards/effects/CARD_API.md`, Abschnitt „Welle 63 / W63b"; Repros `docs/niche-tests/repro/W63/b-01` … `b-04` (Exit 0 = korrekt).

| Befund | Ursache | Umsetzung |
|---|---|---|
| **Eraser Beam + Inya-Token:** „Instant-Kill feuert nie" | **Nicht reproduzierbar für Eraser Beam selbst:** „defeat it" läuft vollständig in `onPlay`, Inyas Hook (`afterSpellResolved`) kommt danach. Der Kill steht in allen drei Fällen (Token überlebt / Token stirbt oder verlässt das Feld / Verwandlung löscht nichts); `_spellLockTurn` und Einmal-pro-Spiel-Stempel hängen am Spieler und bleiben. | Als Regel abgesichert (`b-01`, 48 Prüfungen, beide Sitze, Schaden/Zerstören/Opfer/Rückgabe, Held- und Kreaturenziel, Gegenproben mit Inya „nein" und ohne Inya). |
| **Echter „lingering"-Verlust (Bug-Klasse):** Zauber, deren Wirkung an der **Karteninstanz** hängt (`gs._spellKeepInstance`: Anti Magic Zone, Calm Diatribe, Weapon Unleashing, Mission of the Light Brigade) | Inyas Token setzt `_spellPlacedOnBoard`; `doPlaySpell` räumte die gespielte Instanz in diesem Zweig weder ab noch zonte es sie in die Ablage um → Geist in `hand`, Marke blieb stehen. **Anti Magic Zone verlor ihr Fenster** (später beschworene Kreaturen nicht negiert, Token überlebt wie gestorben); die anderen liefen nur zufällig über den Geist. | `engine.zauberInstanzNachBrettzug`: Hand-Instanz abräumen, bei `_spellKeepInstance` als **Wirkungsträger in die Ablage** (unabhängig vom Token); Inya stempelt `_spellBecameToken`. `b-02` (72 Prüfungen). |
| **Sofort-Güsse** (Zusatzaktionen via `_castSpellImmediately`) mit Träger-Instanz | Räumte die Instanz IMMER ab und ließ `_spellKeepInstance` stehen (auch ohne Inya): Anti Magic Zone als Sofort-Guss negierte später beschworene Kreaturen nie. | Derselbe Helfer; abgebrochener Guss löscht die Marke. `b-04`. |
| **Token trägt das Zauber-Skript** | Der Buddy heißt wie der Zauber → dessen Hooks (Eraser Beams `afterSpellResolved`-Lauscher, Anhang-/Aura-Hooks wie Idej Projection, Market Crash …) liefen am Token auf dem Brett. | `CardInstance.loadScript()`: ein Fantasy Buddy Token hat kein Zauber-Skript. `b-01`. |
| Inyas Rückfrage | `if (!confirmed)` las `{ confirmed: false }` als Ja. | `engine._confirmSaidYes`; kein Buddy für einen Zauber, der auf die Hand zurückkehrt (`_spellReturnToHand`). |

* **Schon korrekt (Parität mit/ohne Inya, Token überlebt/stirbt):** Hand of Death (verzögerter Defeat am Ende des gegnerischen Zuges, `nachholenOhneKarte`), Teleportal, Trial of Knowledge (`b-03`, 30 Prüfungen, grün auf altem und neuem Stand).
* **Nebenfund, nicht geändert:** Anhänge und Permanents lassen die gespielte Hand-Instanz ebenfalls als Geist in `hand` zurück (ohne Inya) – die Räumung wirkt auf alle Anhangs-Hooks, daher eigene Welle.
* **Nicht angefasst:** Kartentexte in `data/cards.json`; `repro-status.json`/Index.
* `Bugfix-Note` (Commit-Nachricht): Anti Magic Zone, Calm Diatribe, Weapon Unleashing, Mission of the Light Brigade, Eraser Beam, Card Game Player Inya, Bausteine `_engine`.

## Tests

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W63/b-01-eraser-beam-inya-token-ueberlebt-stirbt.js` | Eraser Beam + Inya, beide Sitze: Kill sofort, Token überlebt (2 Zugwechsel), Token stirbt (Schaden, Zerstören, Opfer, Rückgabe), Inya „nein", Heldenziel, Sperre/Stempel, Geist, Token-Skript, Inyas Schadensschild | 48 | 14 ✗ (Geist, Token-Skript, „nein") |
| `repro/W63/b-02-inya-token-ersetzt-zauber-fortwirkung-an-instanz.js` | Anti Magic Zone, Calm Diatribe, Weapon Unleashing, Mission × (ohne Inya / Token überlebt / Token stirbt) × beide Sitze: Wirkung == ohne Token, Träger in der Ablage, keine Restmarke | 72 | 30 ✗ (AMZ-Wirkung verloren; Geister, Marke) |
| `repro/W63/b-03-inya-token-hand-of-death-teleportal-trial-of-knowledge.js` | Hand of Death (Kreatur/Held/eingefroren), Teleportal, Trial of Knowledge: Parität | 30 | 0 ✗ (Gegenprobe, bereits korrekt) |
| `repro/W63/b-04-sofort-guss-traegerinstanz-bleibt.js` | Sofort-Guss Anti Magic Zone ohne/mit Inya | 8 | 6 ✗ |

## Rückfragen an Al

1. Meinst du mit „lingering Effect" bei Eraser Beam die Spell-Sperre/den Einmal-Stempel bzw. bei Hand of Death den verzögerten Defeat? Beides funktioniert mit Token überlebt wie gestorben – falls du etwas anderes gesehen hast, bitte den genauen Ablauf (Karten, Reihenfolge).
2. Eraser Beam gegen Inya mit lebendem Buddy: „defeat" läuft durch die Schadenspfade, Inyas Schadensschild greift (Held überlebt). Soll „defeat it" den Schild umgehen? Derzeit **nein**.
3. Stirbt ein Buddy, landet die Spell-Karte darunter im Gelöscht-Stapel (W5a): gewollt, oder soll der Buddy rückstandslos verschwinden? Derzeit **Gelöscht-Stapel**.
