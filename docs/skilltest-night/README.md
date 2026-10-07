# Skill Test — Nachttraining (2026-10-06/07)

Zwei Läufe mit unterschiedlichen Regeln, damit die Werte nicht vermischt werden:

| Ordner | Regeln | Partien | Inhalt |
|---|---|---:|---|
| `lv1-start-abilities/` | Start-Abilities der Heroes auf **Stufe 1** (wie im Normalspiel, doppelte auf 2) | 75 742 | Kartenlisten alle ~5000 Partien (`report-N.md`, `milestone-N.json`), `index.md`, `bench.jsonl` (trainiert gegen untrainiert), `profile-lv1.json` (fertiges Profil dieses Laufs) |
| (dieser Ordner) | Start-Abilities auf **Stufe 3**, Lernen der Nutzbarkeit/Nutzung behaltener Karten | 77 712 | dieselben Dateien für den zweiten Lauf; die Personas stammen aus dem ersten Lauf (Fitness zurückgesetzt), alle Kartenwerte werden neu gelernt |

Grund für den Neustart: Attacks und Spells hatten niedrige Werte, weil sie zu selten wirklich wirkbar waren. Mit Stufe-3-Start-Abilities ermöglicht jeder Hero eine ganze Schule.
`scripts/skilltest-explorer.js` erzeugt aus den Listen eines Ordners eine sortier-/filterbare HTML-Seite.

## Zweiter Lauf (Stufe 3) — Ergebnis

- **Dateien:** `report-N.md` / `milestone-N.json` (alle 5 000 Partien; `report-77713.md` ist der Endstand), `index.md`, `bench.jsonl`,
  `profile-lv3.json` (**fertiges Profil**, kompakt, `--min-n 4`; wird vom Server wie `data/skilltest-profile.json` gelesen),
  `persona-bench.md` / `.json` (großer Vergleich je Persona, 240 Partien je Variante), `final-analysis.md` (nie/fast nie gespielte Karten, Analyse der Patt-Partien).
- **Verlauf:** 25 139 Partien mit dem ersten Stand der Stufe-3-Regeln, dann Neustart mit gespielten Normal-Artifacts / Artifact-Creatures / Area- und
  Anhänger-Zaubern (bis dahin vom Bot nie gespielt; Werte der 150 betroffenen Karten zurückgesetzt) und weitere Hänger-Korrekturen (siehe `skilltest/README.md`,
  „Endlosschleifen und Hänger"). Pool: am Ende **993 Karten** (26 nicht funktionsfähige Karten gesperrt, `docs/skilltest-illegal-cards.md`).
- **Karten:** Die Reihenfolge ist seit rund 35 000 Partien stabil. Spitze: Broghan, Styx, Waflav, Grand Inquisitor Karian, Thorad; Schluss: Idej Lords, Sorin, Hel.
  Spells und Attacks bleiben im Mittel bei null (Spell −0,004, Attack −0,001), auch mit Stufe-3-Start-Abilities: eine einzelne Karte verändert nur eine Aktion von vielen.
- **Hänger:** drei Ursachen gefunden und behoben (Skeleton Reaper unter Dark Ocean, Garius mit Artifact-Creatures, Difficulty Lever); danach 0 Hänger,
  0 Endlosschleifen. Verworfene Partien (≈ 0,5 %) sind Patt-Enden (Rundenlimit 151, betäubte/immune Überlebende, 1-HP-Helden), siehe `final-analysis.md`.
- **Spielstärke:** Das Profil bringt gegen Standard-Bots keinen belastbaren Vorteil (Platzierung ≈ 0). Einzelne Personas weichen ab (Berserker: Siegquote 36 %
  bei 25 % Erwartung; Allrounder `pmuyb9mfe7`: Platzierung +0,13 ± 0,04), siehe `persona-bench.md`.
