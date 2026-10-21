# Fix-Welle 45 – Shield of Wisdom, Surprise-Umleiter, Doomed Town Guard

Al hat die drei Rückfragen aus [FIXES-WELLE-44.md](FIXES-WELLE-44.md) beantwortet (22.10.2026). Ein Agent (**W45a**) hat sie umgesetzt; Zweig `wave45/W45a` ist zusammengeführt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 45 / W45a"; Repros `docs/niche-tests/repro/W45/a-01 … a-03`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Shield of Wisdom (Artifact, Subtyp Surprise) | „Doch, das soll binden, denn das, was eigentlich zielt, ist ja ein **Creature-Effekt**. Stelle sicher, dass der von Shield of Wisdom umgeleitete Effekt weiterhin den Typ Creature hat." | Shield of Wisdom übergibt der Umleitungs-Zielwahl die umgeleitete Kreatur als Taunt-Quelle (neues `config._tauntQuelle`, `_tauntQuelleFuer` liest es zuerst); der Taunt greift nur, wenn der Spötter selbst im Pool liegt. Bewusst kein `sourceCard` (das hätte Reaktions-/Umleitungsfenster mit falschem Wirker geöffnet). `_checkTargetRedirect` rekursiert mit der ursprünglichen Quelle: am neuen Ziel liefert `sourceEffectKind` weiter `'creature'` (im Repro bietet sich dem neuen Ziel-Besitzer Challenge für den umgeleiteten Effekt an). Repro `a-01` (Exit 1 auf der Basis) |
| Challenge, Martyry, Anti-Magnet, Alleria, Empty Armor und Surprise-Zielwahlen | „Ja, das soll genauso umgestellt werden." | `engine.sourceEffectKind` liefert für Zone `surprise` jetzt den Typ nach cardType (attack/spell/creature); Artifact (Shield of Wisdom) bleibt `'surprise'`. Surprises, die `engine.promptEffectTarget` direkt rufen (Gold Trap, Jumpscare, Creature-Surprises), hatten gar keine Quelle – neuer Helfer `engine._surpriseQuelleFuer(playerIdx)` liefert die auflösende Surprise. Kein Kartenskript der fünf wurde geändert; ihre Kartentexte geben die Grenzen vor (Challenge/Martyry leiten auf einen Helden um, Anti-Magnet braucht ein zweites eigenes Ziel, Alleria genau ein gewähltes Ziel und einen Helden mit Surprise, Empty Armor greift nur bei gewähltem Helden). Nur die Umleitungsfenster werden erweitert, Zielschutz-Reaktionen und Surprise-Fenster bleiben. Repro `a-02` (Exit 1 auf der Basis) |
| Doomed Town Guard | „Nein, Town Guard, wenn sein Text keine Typ-Einschränkungen vorgibt, wirkt auf *alle* Arten von zielenden Effekten." | Ist-Zustand bestätigt: deklariert `tauntNurAttackSpellKreatur` nicht (Hardy Slime und Clown schon), sperrt andere Kreaturen bei Attack, Spell, Creature effect, Artefakt, Trank, Ability, Heldeneffekt, Ausrüstung, Pfeil, Surprise und Area. Echte Wege: Poison Vial, Book of Doom, Occultism; Gegenprobe Hardy Slime mit Artefakt/Trank/Ability: frei. Repro `a-03` |

**Leser von `'surprise'`:** nur `sourceEffectKind` und die fünf Umleiter betroffen; `tauntGiltFuerQuelle` (Fallback unverändert), `front-soldier.js`, `_hooks.js isAttackSpellOrCreatureSource`, `_targeting-shared.js isOppCreatureEffect`, `breakthrough.js`, `_train-recorder.js`, `server.js` und `bot/` lesen Zonen/Log-Marken/cardType und bleiben unverändert.

**Nebenwirkung (gewollt):** Weil das Umleitungsfenster die Surprise jetzt als Quelle bekommt, sehen auch Test Dummy, Monia Bot, Lucky Puppet Laki und Preserving Puppet Vinny die Gold-Trap- und Jumpscare-Wahl (bei Surprises mit `ctx.promptTarget` war das schon so).

Umgestellter alter Repro: `W44/a-02` (eine Zeile: „Gold Trap → spell, Bluff → attack, Water Golem → creature, Shield of Wisdom → surprise" statt „→ `'surprise'`").

## Ergebnis in Zahlen

* Repros: **alle 1214 Repros grün** (vorher 1211; 3 neue), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice, spectate-player.
* Dauerfeuer: 13 Karten × 2 Seiten + 6 Läufe mit Taunt-Stempel, 0 Unterschiede.
* `Bugfix-Note` für Shield of Wisdom im Commit.

## Offene Rückfragen an Al

Beide sind beantwortet und in [FIXES-WELLE-46.md](FIXES-WELLE-46.md) umgesetzt (dort stehen die neuen Rückfragen).
