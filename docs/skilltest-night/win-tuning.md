# Spielen auf Sieg — Messungen zur Kampf-Zielwahl der CPUs

Zielgröße ist der **Sieg** (nicht die Platzierung). Gemessen wird gepaart: je Seed stehen Tisch (2–8 Sitze), Austeilung, Aufbau und Sitzplatz fest
(geseedete Partien, `skilltest/sim.js`), nur der eine Fokus-Sitz spielt je Variante anders (`skilltest/learn/tune.js`, `scripts/skilltest-tune.js`).
Signifikanz: McNemar-z über die Paare. „Persona" = der Spielstil, den Live-CPUs aus dem gelernten Profil ziehen (`variant.persona`).

## Befund 1: Die Zielwahl war praktisch blind
Die Ziele, die der Bot bei Engine-Prompts bekommt, tragen keine HP. Die alte Wahl bevorzugte irgendeinen Gegner (Helden etwas stärker). Neu: `tgtModel 1`
liest HP, Angriffswert und Zustand aus dem Spielstand (`policy.targetInfo`).

## Befund 2: Wen zuerst? (Persona-Basis, 480 Paare, Seeds 20000)
| Variante (auf der Persona) | Siegquote | Δ zur Persona | z |
|---|---|---|---|
| Persona unverändert | 23,3 % | – | – |
| **Ausgelieferte Zielwahl** (`SHIPPED_TARGETING`: tgtModel 1, lowestHp 0, killBonus 1, focusLeader 1,5, tThreat 4, aKill 3, aDmg 1, sAtk 3) | **33,5 %** | **+10,2 Pkt** | **5,4** |
| nur die neuen Schlüssel, Persona behält lowestHp/killBonus/focusLeader | 24,6 % | +1,3 | 0,7 |
| `explore 0` | 22,7 % | −0,6 (3 Partien anders) | – |

Nach Sitzen (Persona → ausgeliefert): 2: 49→56 %, 3: 26→43 %, 4: 23→31 %, 5: 23→37 %, 6: 21→28 %, 7: 14→25 %, 8: 11→18 %.
Der Gewinn kommt aus der Zielwahl: die gelernten Personas haben `lowestHp` im Mittel 1,46 (Schwächste zuerst — auf Platzierung gezüchtet), und
„Schwächste zuerst" verliert gegen „Stärkste und Gefährlichste zuerst". `explore` ist im Live-Spiel bedeutungslos.

## Befund 3: Ausnutzbarkeit (alle CPUs spielen die ausgelieferte Zielwahl, 480 Paare, Seeds 21000)
Fokus-Sitz = Persona unverändert (Abweichler) gegen dieselbe Persona mit ausgelieferter Zielwahl, Gegner jeweils mit ausgelieferter Zielwahl:
Abweichler 23,1 % ↔ ausgeliefert 24,8 % (+1,7 Pkt, z 0,9; Platzierung −0,07 ± 0,03). Wer abweicht, gewinnt also nicht öfter — der Stil ist stabil.
Früherer Gegentest mit den *Standardgewichten* als Abweichler (frühe Fassung, ohne Persona): −3,9 Pkt gegen die Spiegelgegner; auf Persona-Basis nicht reproduziert.
Varianten in diesem Feld: `focusLeader 0` ±0,0; `focusLeader −1` +1,5; `tThreat 0` +2,7 (z 1,6) — nichts davon signifikant.

## Auslieferung
- `policy.js`: `DEFAULT_WEIGHTS` tragen die Werte; `shipped(w)` überschreibt sie in Persona-Gewichten (Live-CPUs in `battle.js`/`prep.js`, Simulation, Training).
- Die Lookahead-Suche (MCTS) brachte auf diesem Stand keinen messbaren Gewinn bei 4–12-facher Rechenzeit und bleibt unverändert.
- Weitere Dimensionen (Aggression, Zauber, Beschwörung, Effekte, Ability-Nutzung) werden als Nächstes auf dieser Basis einzeln gepaart geprüft.
