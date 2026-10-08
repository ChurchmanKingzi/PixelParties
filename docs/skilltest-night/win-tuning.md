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

## Weitere Kampfgewichte (Koordinatenanstieg auf der ausgelieferten Persona-Basis)
Persona + ausgelieferte Zielwahl als Basis, je Gewicht zwei Werte, 480 Paare (Seeds 22000), Siegquote Basis 25,6 %:

| Gewicht → Wert | Δ Punkte | z |
|---|---|---|
| learned 1,6 | +1,9 | 2,06 |
| spell 1,5 | +1,7 | 1,63 |
| learned 0,3 / creatureEffect 0,6 / creatureEffect 1,4 / aggression 0,6 / heroEffect 0,6 | +1,0 … +0,4 | ≤ 1,0 |
| aggression 1,5 / heroEffect 1,4 / abilityUse 1,6 / reactEager 0,5 und 1,6 | −0,8 … −0,2 | ≥ −1,6 |
| summon, equip, abilityUse 0,5, healBias, abilityPlay, potion (je zwei Werte) | ±0,0 … +0,2 | ≤ 1,0 (fast keine abweichenden Partien) |

Nichts erreicht bei 24 Vergleichen eine belastbare Signifikanz. Nachprüfung der zwei besten auf frischen Seeds (600 Paare, Seeds 23000, Basis 22,8 %):
`learned 1,6` +0,2 (z 0,2) — **nicht bestätigt**; `spell 1,5` +1,2 (z 1,7), beide Läufe zusammen 28 gegen 13 abweichende Partien (z ≈ 2,3) — **bestätigt, klein**.
Ausgeliefert wird nur `spell 1,5` (`SHIPPED_TARGETING.spell`, mit den Hand-Garantien für Spells liegen mehr Zauber auf der Hand). Die übrigen Gewichte bleiben:
Aggression, Effekte, Beschwörung, Ausrüstung und Tränke sind in dieser Umgebung nicht der Hebel — der große Gewinn war die Zielwahl.
