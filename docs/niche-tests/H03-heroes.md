# H03-heroes – Nischenfall-Bericht
Stand/Autor: Agent H03-heroes, 12.10.2026. Karten: 37 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird fortlaufend ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – Arbeitsstand: Bericht wächst mit jedem bestätigten Befund)

Harness-Hinweis für alle Heldenkarten: `H.fresh()` ruft `startGame()` nicht auf, also feuert **`onGameStart` nicht**. Heldenskripte, die dort etwas einrichten
(Nao, Rescued Damsel Cecilia, Pinta, Lolek-Bereitschaft), brauchen in den Tests ein `t.run(() => t.engine.runHooks('onGameStart', {}))`.

## Befunde

### H03-heroes-01 · Naos Überheilung ist ein Dauer-Flag am Heldenplatz, nicht an Nao · Stufe B
- **Karten:** Nao, the Barrier Priestess (`cards/effects/nao-the-barrier-priestess.js`); Verbraucher in `_engine.js` `actionHealHero` / `actionHealCreature`
- **Voraussetzungen / Aufbau:** Sitz 0: Nao auf Platz 0 (Spielstart-Hooks gefeuert), Skeleton Healer in Naos Support Zone 0 (bzw. Nao tot / Nao leicht negiert), Held 2 mit vollen HP 400.
- **Schritte:** 1. Skeleton Healer aktivieren (heilt Held 2 um 100). 2. Variante: Nao auf 0 HP. 3. Variante: Nao trägt `negated` in der Weakening-Crystal-Form, wirkt selbst „Heal" (150) auf Held 1 (300/400).
- **Erwartet** (Kartentext: „When **this Hero** heals a target's HP while they are lower than or equal to their maximum, it can heal that target's HP beyond their maximum."; Engine-Regel: ein toter/negierter Held wirkt nicht): Überheilung nur bei Heilungen, die Nao selbst ausführt, solange sie lebt und nicht negiert ist.
- **Beobachtet:** (a) Healer in Naos Spalte heilt Held 2 auf **500** (max 400); (b) dasselbe bei **totem** Nao; (c) Nao mit leichter Negation heilt Held 1 auf **450**.
- **Repro:** `docs/niche-tests/repro/H03-heroes/01-nao-ueberheilung-slotflag.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `nao-the-barrier-priestess.js` setzt in `onGameStart`/`onPlay` einmalig `gs.heroFlags['<seite>-<heroIdx>'].overhealPassive` und nimmt es nie zurück; `_engine.js:10059` und `:10148` erlauben Überheilung, sobald `source.heroIdx` der Platz mit Flag ist – gleich ob die Quelle Nao, eine Kreatur dieser Spalte oder ein später auf den Platz gekommener Held ist, und gleich ob Nao lebt/negiert ist.

### H03-heroes-02 · Von Pseudonia gewonnene Effekte laufen nicht, wenn das Skript den eigenen Kartennamen prüft · Stufe B (Damsel-Teil: C)
- **Karten:** Pseudonia, the Skill Devourer (Mechanik `_gained-effects-shared.js`); betroffen: Monsieur Pete (`monsieur-pete-the-booty-raider.js:40`), Rha'Bi (`rha-bi-the-living-skeleton.js:397`), Monia Bot (`monia-bot-the-foretold-rescuer-of-coolness.js:84`), Rafflesia (`rafflesia-the-poison-princess.js:162`), Lilly (`lilly-the-charming-infiltrator.js:39`), Rescued Damsel Cecilia (`rescued-damsel-cecilia.js:53`)
- **Voraussetzungen / Aufbau:** Sitz 0: Pseudonia auf Platz 0, `engine.grantHeroEffect(0, 0, X)` + `finishGainedHeroEffects` (das ruft Pseudonia selbst nach der Zusage auf); Kontrolllauf mit dem echten X auf Platz 0.
- **Schritte:** je Karte der typische Auslöser: Pete – Gegner trifft den Träger mit Burning Finger; Rha'Bi – Effekt aktivieren (legt 1 Karte), Träger stirbt; Monia Bot – Gegner zielt auf Held 1; Rafflesia – Decay-Spell (Venom Infusion), Support-Spell (Heal) in der Hand; Lilly – Infiltration Lv1 (nimmt die oberste Gegnerkarte); Damsel – tödlicher Schlag.
- **Erwartet** (Pseudonia-Ruling 22.9.: „that Hero's effects" = gedruckter Effekt, auch Ascended Heroes; Kopf von `pseudonia-the-skill-devourer.js`): Pseudonia verhält sich wie X; die Kontrollläufe mit dem echten X bestehen alle.
- **Beobachtet:** Pete: keine Deck-Suche; Rha'Bi: beim Tod des Trägers bleibt die verdeckt gelegte Karte (Marke `_rhabiPlaced`) für immer in der gegnerischen Support Zone liegen, nichts löscht oder holt sie zurück; Monia Bot: kein Redirect-Angebot; Rafflesia: `rafflesia_chain` im HOPT gestempelt, aber **kein** Zusatzaktions-Anspruch (HOPT ohne Gegenwert verbrannt); Lilly: Pseudonia zieht nach dem Diebstahl nicht nach (der Hook prüft `ctx.cardZone !== 'hero'`, die Trägerinstanz liegt in `support`); Damsel: kein Extra-Leben, Träger bleibt tot (Wortlaut „The first time **this Ascended Hero** would be defeated" – für Pseudonia, die kein Ascended Hero ist, deshalb nur Stufe C).
- **Repro:** `docs/niche-tests/repro/H03-heroes/02-pseudonia-namensbindung.js` (6 ✗ für Pseudonia, die 6 Kontrollläufe mit dem echten Helden ✓)
- **Vermutete Ursache:** Die Hooks laufen über die Trägerinstanz (`attachedHero` = Pseudonia), aber die Skripte vergleichen `hero.name`/`ziel.name`/`gefallen.name` mit der eigenen Karte oder suchen die Heldeninstanz per Name (`c.name === CARD_NAME`); Lilly prüft die Zone der Trägerinstanz. Die gewonnenen Skripte müssten `hatEffekt(hero, CARD_NAME)` aus `_gained-effects-shared.js` benutzen (so wie Mithuru es mit `istHeldenTraeger` tut).
- **Frage an Al** (nur Damsel-Teil): Soll Pseudonia mit Damsels Effekt das Extra-Leben bekommen („this Ascended Hero" → Pseudonia ist keiner) – ja oder nein?

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
