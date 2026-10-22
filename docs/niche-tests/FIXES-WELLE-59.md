# Fix-Welle 59 – Diver Helmet nimmt einen Helden von Rioting Village aus

Eine Entscheidung von Al (22.10.2026), umgesetzt vom Agenten **W59a** (Zweig `wave59/W59a`). Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 59 / W59a"; Repro `docs/niche-tests/repro/W59/a-01` (beide Sitze, 74 Prüfungen; auf dem alten Stand 62 ✗, jetzt alle grün).

| Punkt | Al | Umsetzung |
|---|---|---|
| Diver Helmet / Rioting Village | „Diver Helmet soll einen Hero von Village ausnehmen – von BEIDEN Komponenten! Wird Helmet equipped, während Village schon aktiv ist, verschwindet der Village-Buff von ihm." | Ein Held mit Diver Helmet bekommt **keine ATK-Verdopplung** (Faktor 1 = ATK wie ohne Dorf) und erleidet **keinen Rückstoß**. Zentral: `engine.heldIstVonAreasAusgenommen(Seite, Held)` (nutzt die bestehende Helm-Prüfung `heroHasDiverHelmet`); `_atkAuraFaktor` überspringt Area-Multiplikatoren für ausgenommene Helden, `rioting-village.js` fragt dieselbe Prüfung. Dynamik ohne Ereignisbehandlung: der Abgleich der Aura läuft aus dem Ist-Zustand bei jedem `sync()` und vor jeder Hook-Meldung (`runHooks`, nur wenn eine Area liegt oder eine Restbuchung existiert) |

* **Dynamik (Differenztest, 90 Folgen × 16 Schritte je Sitz):** Held mit Helm == Szene ohne Dorf, Held ohne Helm == 2^Dörfer × Szene ohne Dorf, nach jedem Schritt. Helm anlegen → Verdopplung sofort weg; Helm zerstört / abgelegt / gelöscht / auf die Hand / per Fridge oder Ceremony umgehängt (am neuen Wirt weg, am alten zurück) / Wirt besiegt → Verdopplung kehrt zurück; Dorf kommt neu bei liegendem Helm → Held bleibt undoppelt; mehrere Dörfer (Helm = 2^0); Club, Fluch (alle Reihenfolgen), Cykyran, Aufstieg/Abstieg, Wiederbelebung, Teleportation Powder; Gegnerseite; Wirt gefroren/betäubt/negiert/gecharmt (Ausrüstung ruht nie, Ruling W7a/W27a).
* **Nebenfund beim Bauen** (nur im ersten Entwurf, nicht im Repo-Stand): ein Abgleich vor der Reset-Meldung `afterHeroAtkChange` des Formwechsels verdoppelte den aufgestiegenen Helden doppelt — der `runHooks`-Abgleich nimmt diese Meldung deshalb aus.
* **Auslegung „beide Komponenten":** ATK-Verdopplung und Rückstoß. Das Spieler-Limit „no player can use more than 1 Attack per turn" betrifft den *Spieler* und bleibt unverändert (die Attack des Helm-Helden zählt weiter) — Frage 1.
* **Audit der übrigen Areas:** nur Rioting Village nutzt die zentrale Stat-Aura; keine weitere Fundstelle derselben Fehlerklasse. Zwei Area-Skripte ohne Helm-Guard (andere Fehlerklasse, nicht angefasst): **Shared Blood Tanks**, **Acid Rain** — Fragen 2 und 3. 11 Area-Karten haben noch kein Skript.
* `Bugfix-Note`: Rioting Village (Helm-Held wurde trotzdem verdoppelt und erlitt den Rückstoß).

## Offene Rückfragen an Al

1. **Spieler-Limit:** soll der Diver Helmet den Helden auch von „no player can use more than 1 Attack per turn" befreien (seine Attacks zählen nicht für das Limit / sind nicht gesperrt) — ja/nein? (Bisher gelesen: „beide Komponenten" = Verdopplung + Rückstoß.)
2. **Shared Blood Tanks:** Ketten-Bleed-Schaden soll Helden und Kreaturen mit Diver Helmet ausnehmen — ja/nein?
3. **Acid Rain:** der Pollution Token soll nicht in die freien Support Zones eines Helden mit Diver Helmet gelegt werden dürfen — ja/nein?
