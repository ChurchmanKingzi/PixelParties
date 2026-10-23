# Fix-Welle 67 (W67a) – Inya: jeder Spell-Subtyp wird Token · übersprungener Gegnerzug zählt nicht als „next turn" · Explosive Drone abgesichert

Umgesetzt vom Agenten **W67a** (Zweig `wave67/W67a`) auf Entscheidungen von Al vom 23.10.2026. Details, Tabellen, Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 67 / W67a"; Repros `docs/niche-tests/repro/W67/` (Exit 0 = korrekt). Kartentexte (`data/cards.json`), `repro-status.json` und Index unverändert.

| Auftrag | Ergebnis |
|---|---|
| **A) Inya** (Rückfrage 2 aus W66a: „Nein.") | Im Zug des Inya-Spielers wird JEDER Spell-Subtyp zum Fantasy Buddy, sofern die Karte nach ihrem Effekt in die Ablage ginge: Handspiel, Sofort-Guss, Kettenglied, aktivierte Surprise (Skull Carpet Bombing am Zugende, Toxic Trap …), Hand-Reaktionen in Schadens-/Ziel-/Beschwörungsfenstern. Ausgenommen: Areas, Attachments, Permanents (Teleportal), Glass Wall/offen liegende Surprises, „Delete this card", zurück auf die Hand, kein freier Platz, abgelehnt, Gegnerzug. Das Duplikat-/Geister-Problem ist an der Wurzel weg: statt Spielstand-Marken trägt jeder Weg ein **Ticket** (`engine.neuesBuddyTicket`, `ctx._buddy`) – genau EINE Platzierung (Token statt Ablage), nichts bleibt stehen. `W67/a-01` (78; alt 13 ✗). |
| **B) Hand of Death & Co.** (Rückfrage 3: „Bitte ändern.") | Ein übersprungener Zug (Zhu, Hand-of-Death-Rider) zählt nicht als „your opponent's next turn": Hand of Death, Throne Robber, Create Illusion, Staff of Illusions feuern erst am Ende des nächsten echten Gegnerzuges (`_switchTurnInner({ uebersprungen: true })`). Open Invitation, Dauer-Effekte („until …") und „At the end of your opponent's turn" unverändert (Rückfragen 1–3). `W67/a-02` (42; alt 20 ✗), `W66/a-02` Fall H angepasst. |
| **C) Explosive Drone** | Von Al zurückgenommen („schließt Schaden ein"). Keine Änderung; `W67/a-03` (42) schreibt den Ist-Zustand fest (Schaden und Removal/Hero-Kill lösen Auslöser und Detonation aus; Opferung, Rückstoß, Statusschaden ohne Verursacher nicht). |

## Geänderte Dateien (Kern)
`cards/effects/_engine.js` (`neuesBuddyTicket`, `reaktionsBuddyTicket`, `_letzteHandHerkunft`; Tickets in `_castSpellImmediately`, `_activateSurprise`, `_resolveReactionChain`, allen Hand-Reaktionsfenstern/`_rxAufgeloest`, Ascension-Reaktion; `_switchTurnInner(opts.uebersprungen)`, `_expireBorrowedIdentities(opts)`), `server.js` (`doPlaySpell`), `cards/effects/card-game-player-inya.js`, `hand-of-death.js` (Kommentar), `the-throne-robber.js` (`_identitySkipAufschub`).
Angepasst: `W66/a-02` (Fall H), `W66/a-05` (Skull Carpet Bombing wird Buddy, genau einmal).

## Rückfragen an Al (Ja/Nein) – siehe CARD_API „Welle 67 / W67a", Abschnitt 4
1. „At the end of **your** next turn" (Open Invitation u. a.) bei eigenem übersprungenem Zug ebenfalls erst am nächsten echten Zug?
2. Dauer-Effekte („until the end of your opponent's next turn") über einen übersprungenen Gegnerzug hinaus?
3. „At the end of your opponent's turn" (ohne „next": Moonlight Butterfly, Fun-Fun Circus Clown, Shapeshifter) am übersprungenen Zug ausbleiben?
4. Kettenfenster-Surprises (Lunar Eclipse & Co.) ebenfalls Inya-Buddy-fähig?

## Ergebnis der Gesamtläufe
* **Gesamtlauf** (`runall`, alle 1336 Repros inkl. `W67/a-01 … a-03`; Zeitlimit je Datei 300 s): 1336 × „tritt NICHT auf" (= korrekt), 0 Fehler, 0 Zeitüberschreitungen. Auf dem Ausgangsstand (b4b43f1c) sind rot: `W67/a-01` (13), `W67/a-02` (20); `W67/a-03` ist auf beiden Ständen grün (Absicherung). `W66/a-02` (Fall H) und `W66/a-05` sind bewusst umgestellt.
* `scripts/check-*.js`: alle grün außer `check-scope.js` (63 Altstellen, identisch zum Ausgangsstand). `node --test test/*.test.js`: 7/7 grün. E2E `cards`, `draw-cards`, `sacrifice`, `artifacts` (`NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node-tools/node_modules`): je 1/1 grün.
* Ergebnisdatei: `status-after67a.json` im Scratchpad (nicht eingecheckt).
