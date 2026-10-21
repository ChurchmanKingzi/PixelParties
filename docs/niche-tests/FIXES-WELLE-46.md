# Fix-Welle 46 – Surprise-Effekte zählen überall als Attack/Spell/Creature effect

Al hat die zwei Rückfragen aus [FIXES-WELLE-45.md](FIXES-WELLE-45.md) beantwortet (22.10.2026). Ein Agent (**W46a**) hat sie umgesetzt; Zweig `wave46/W46a` ist zusammengeführt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 46 / W46a" (mit den vollständigen Tabellen); Repros `docs/niche-tests/repro/W46/a-01 … a-04`, alle auf der Basis rot (23/33/19/7 ✗), jetzt grün.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Shield of Wisdom und Creature-Surprises | „Ja. Generell gilt: Surprise Creature-Effekt sind immer noch Creature-Effekte." | `isOppCreatureEffect` (`_targeting-shared.js`, Shield of Wisdom, Rolling Boulder) liest Zone `support` **oder** `surprise` (cardType Creature). Audit aller „Creature effect"-Leser: `rolling-boulder.js` besiegt eine Creature-Surprise vor der Platzierung (Ablage, Merker `_besiegtVorPlatzierung`); `deepsea-encounter.js` erkennt auch Zone `surprise`; `engine.darkOceanBlocksReaction`: auflösende Creature-Surprise = Creature-Quelle ihres Steuerers (der Gegner darf nicht reagieren); `jumper-spider.js` reagiert jetzt auf Cybug-ANTS-Schaden; Shield-of-Wisdom-Pool nur aus Zielen, die der Effekt wählen konnte (vorher wurde der Schild bei Water Golem ohne Wirkung verbraucht). `Firewall`, `Toxic Trap`, `Mountain Tear River` lösen bei einer Creature-Surprise als Angreifer nicht mehr aus (neuer Helfer `_hooks.istUngelegteCreatureSurprise`) – früher traf der Rückschlag den Träger-Helden der Creature-Surprise. Anti-Magnet zeigt „Creature" statt „Spell" (kosmetisch). Repro `a-03` |
| Zielschutz-Reaktionen aus der Hand und Surprise-Fenster | „Ja, auch für Reactions gelten die Effekte von Surprises jeweils als Attacks/Spells!" | Ursache: `engine._zielwahlAbschliessen` gab die auflösende Surprise seit W45a nur den Umleitungsfenstern als Quelle. Jetzt geht dieselbe Quelle (`_surpriseQuelleFuer`) an **alle** Fenster: Post-Target-Reaktionen der Hand (Invisibility Cloak, Future Tech Escape Device, Test Flight, Anti Magic Shield, MOE Shield sehen Jumpscare als Spell; Chaorc Interception, Barrier of Faith, Divine Gift of Rain auch Creature-Surprises), Castling, Surprise-Fenster (Spike Trap, Crimson Web, Tharxian Horse, Frost Rune, Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Glass Wall, Spider Avalanche, Jumper Spider). Die Karten lesen Kartentyp bzw. Schadenstyp der Quelle wie bisher, an den Reaktionskarten selbst ändert sich nichts. Die Sperre `_inSurpriseResolution` entfällt nur, wenn die Quelle die auflösende Surprise selbst ist (Per-Hero-Sperre und Tiefenkappe 10 bleiben; Jumpscare gegen Jumpscare läuft ohne Hänger). Water Golem (Wahl nach der Platzierung): `_surpriseHakenMitLauf`/`_surpriseLaufAktiv`; `jumpscare.js`: Betäubung steht auf dem Spell-Stapel (Anti Magic greift), aufgeschobene Jumpscare trägt ihren Träger-Helden. **Keine Zähler/Kosten geändert** (Surprises kosten weiter keine Action). Repros `a-01`, `a-02`, `a-04` |

**Befund auf der Basis, nicht gefixt:** Crimson Web hinterlässt im Audit eine Geister-Instanz an der Angreifer-Zone, auch bei einem gewöhnlichen Fireball (bekannte Ausnahme; in `W46/a-02` zählt für Crimson Web deshalb nur „keine Engine-Fehler").

## Ergebnis in Zahlen

* Repros: **alle 1218 Repros grün** (vorher 1214; 4 neue), 0 Rückschritte; kein altes Repro umgestellt.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice.
* Dauerfeuer: 25 Karten × 2 Seiten, 0 Unterschiede.
* `Bugfix-Note`-Zeilen in den Commits.

## Offene Rückfragen an Al (Ja/Nein)

1. **Creature-Surprise als Angreifer:** Booby Trap, Frost Rune, Firewall, Toxic Trap, Mountain Tear River und Fireshield brauchen einen Angreifer auf dem Brett. Eine Creature-Surprise liegt beim Wirken noch in der Surprise Zone, also lösen sie nicht aus (früher trafen Firewall, Toxic Trap und Mountain Tear River den Träger-Helden). Soll das so bleiben?
2. **Rolling Boulder gegen eine Creature-Surprise:** Die Creature geht in die Ablage, ohne je auf dem Brett gestanden zu haben (kein Tod-Trigger). Passt das?
3. **Shield of Wisdom:** Es leitet nur auf Ziele um, die der Effekt auch wählen konnte (Afflicted Vermin: nur Kreaturen; Water Golem und Cybug ANTS: kein legales Ziel, der Schild bleibt zu). Passt das? Bei „nein" müsste das Umleitungsziel unabhängig von der Zielliste des Effekts erlaubt werden.
4. **Kettenfenster „Hero performs":** Soll die Aktivierung einer Attack-/Spell-Surprise ein Kettenfenster öffnen (Stealthy Pursuit, Arrows, Magic Topaz)? Ist-Zustand: nein.
5. **Spike Trap:** Er schlägt mit Schadenstyp `other` und ohne Reaktionsfenster zurück (Rückstoß-Ruling). Soll dieser Schaden als Spell-Schaden gelten (wie bei Fireshield, Escape, Corpse Explosion)?
6. **Zähler:** Soll eine aufgedeckte Spell-/Attack-Surprise in den „Spells/Attacks diesen Zug"-Zählern zählen? Ist-Zustand: nein.
7. **Mountain Tear River:** Soll `promptEffectTarget` das Surprise-Fenster auch für gewählte Kreaturen öffnen, für alle Quellen? Ist-Zustand: nur Helden.

**Beobachtungen** (in `CARD_API.md`): Castling wertet auch eine gewählte Kreatur in der Support Zone des Wirts als Wahl des Helden (bestehende Eigenheit); Hand-Reaktionen sehen gewählte Kreaturen aus `promptEffectTarget` nur über `postTargetKreaturWahl` (Dream Dust).
