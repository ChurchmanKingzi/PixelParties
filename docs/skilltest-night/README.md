# Skill Test — Nachttraining (2026-10-06/07)

Zwei Läufe mit unterschiedlichen Regeln, damit die Werte nicht vermischt werden:

| Ordner | Regeln | Partien | Inhalt |
|---|---|---:|---|
| `lv1-start-abilities/` | Start-Abilities der Heroes auf **Stufe 1** (wie im Normalspiel, doppelte auf 2) | 75 742 | Kartenlisten alle ~5000 Partien (`report-N.md`, `milestone-N.json`), `index.md`, `bench.jsonl` (trainiert gegen untrainiert), `profile-lv1.json` (fertiges Profil dieses Laufs) |
| (dieser Ordner) | Start-Abilities auf **Stufe 3**, Lernen der Nutzbarkeit/Nutzung behaltener Karten | läuft | dieselben Dateien für den zweiten Lauf; die Personas stammen aus dem ersten Lauf (Fitness zurückgesetzt), alle Kartenwerte werden neu gelernt |

Grund für den Neustart: Attacks und Spells hatten niedrige Werte, weil sie zu selten wirklich wirkbar waren. Mit Stufe-3-Start-Abilities ermöglicht jeder Hero eine ganze Schule.
`scripts/skilltest-explorer.js` erzeugt aus den Listen eines Ordners eine sortier-/filterbare HTML-Seite.
