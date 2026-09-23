# Pixel Parties — Card Effect API Reference

Every card with game logic gets a `.js` file in `cards/effects/`.
The filename is derived from the card name: `"Cool Repair"` → `cool-repair.js`.

This document covers **everything** a card script can export and every method
available on the `ctx` object inside hooks.

---

## ★★★ DIE STILLEN FEHLSCHLÄGE — LESEN, BEVOR DU EINE KARTE BAUST

> Zusammengetragen am 18.9.2026 beim Bau von „Tempeluna, the Convergence
> Fairy" und „Dive Down". In dieser einen Sitzung sind **sieben** Fehler
> aufgetreten, und sie hatten alle dieselbe Form.

### Die Form

Ein Feldname zeigt ins Leere, oder eine Prüfung steigt vorzeitig aus —
und **nichts sagt etwas**. Keine Ausnahme, kein Log, keine rote Zeile in
der Konsole. Die Karte tut einfach nur nicht, was sie soll:

* der Drag-and-Drop bleibt folgenlos,
* die Galerie öffnet sich leer,
* die Karte erscheint ohne Flug an ihrem Platz,
* die Animation läuft nicht,
* der Schutz greift beim Zielen, aber nicht beim Treffen.

Das ist die mit Abstand häufigste Fehlerklasse in diesem Projekt und die
teuerste zu finden, weil es nichts zu lesen gibt. **Wer eine neue Karte
baut, prüft die folgenden sieben Stellen aktiv, statt auf eine
Fehlermeldung zu warten.**

---

### ① Aufstieg: es sind ZWEI Riegel, an ZWEI Karten

**Symptom:** Der Held hat die Bedingung erfüllt, der Drag der
Ascended-Karte auf ihn bleibt folgenlos. Keine Meldung.

| Was | Wo | Wozu |
|---|---|---|
| `ascensionCondition(gs, pi, heroIdx, engine)` | auf der **Ascended**-Karte | der Server prüft beim Ausführen |
| `refreshAscensionReadiness(engine, pi, hi)` | auf **jedem Basis**-Helden | setzt `ascensionReady` + `ascensionTarget(s)` — **erst danach bietet der Client den Aufstieg an** |

Die Bedingung allein reicht nicht: `heroCanAscendTo` im Client verlangt
`ascensionReady` UND die Zielkarte in `ascensionTarget(s)`. Die
Bereitschaft **nimmt sich auch wieder zurück**, und zwar nur die eigene
(`hero.ascensionTarget === MEINE_KARTE` prüfen), sonst löscht eine Karte
die Bereitschaft einer anderen mit. Muster: `checkTempelunaAscension`
in `_fairy-shared.js`, `checkMoniaAscension` in `_monia-shared.js`.

**Dazu:** `_getAscensionLineage` liest die Basen aus dem gedruckten Text
(`on top of a "X"`). Nennt der Satz **mehrere** Basen („… or „Y" you
control"), werden seit v1187 alle gelesen — vorher nur die erste, und
die zweite war als Basis unsichtbar.

**Verhindern:** Eine neue Ascended-Karte ist erst fertig, wenn jeder
Held, der zu ihr aufsteigen kann, `refreshAscensionReadiness` trägt.
Testfall: `engine._refreshAscensionReadiness()` aufrufen und
`hero.ascensionTargets` prüfen.

---

### ② Galerie-Einträge: `name` rein, `cardName` raus

**Symptom:** Die Galerie öffnet sich **leer**.

```
HINEIN:  [{ name, source?, count?, cost?, selectable? }]
ZURÜCK:  { cardName, source }
```

Der Vertrag ist asymmetrisch. Wer die Antwortform für die Eingabe hält —
der naheliegende Schluss — baut `{ cardName: … }`, der Client liest
`entry.name`, findet `undefined` und zeichnet nichts.

Seit v1189 **vereinheitlicht `promptGeneric` die Einträge selbst**
(`name` / `cardName` / `card` / blosser String) und warnt auf der
Konsole, wenn gar kein Name zu holen ist. Das ist ein Netz, kein
Freibrief: `scripts/check-gallery-entries.js` hält den Quelltext auf der
kanonischen Form.

**Verhindern:** Beim Schreiben laut mitsprechen — „rein `name`, raus
`cardName`". Und die eigenen Teststubs müssen die **Antwortform**
nachbilden (`{ cardName: eintrag.name }`), sonst spiegeln sie den Fehler
und der Test wird grün, obwohl nichts geht. Genau so ist es passiert.

---

### ③ Kartenflug: Quelle und Ziel haben getrennte Feldsätze

**Symptom:** Die Karte erscheint ohne Bewegung an ihrem Platz.

```
QUELLE:  from, fromOwner?, fromHeroIdx, fromSlotIdx, fromHandIdx, fromPermId
ZIEL:    to,   toOwner?,   toHeroIdx,   toSlotIdx,   toHandIdx
```

Der Handler steigt **still** aus, wenn eines der beiden Elemente fehlt:
`if (!srcEl || !tgtEl) return;`. Wer beim Ziel die Quellnamen schreibt
(`heroIdx` statt `toHeroIdx`), bekommt gar keine Bewegung.

| `to` | braucht |
|---|---|
| `support` / `ability` | `toHeroIdx` + `toSlotIdx` |
| `surprise` / `hero` | `toHeroIdx` |
| `hand` | `toHandIdx` (+ `finalHandSize`) |
| `discard` / `deleted` / `deck` / `potionDeck` / `area` / `coolnessStack` | nichts |

Zwei Reihenfolge-Regeln: der Flug wird **vor** dem Splice aus der Hand
gesendet (sonst ist der Startplatz weg), und ist die Karte bereits
entnommen, lässt man `fromHandIdx` **weg** — der Handler nimmt dann den
Handbereich als Ganzes. Ein `sfx: '<klang>'` gibt dem Flug einen Klang;
fürs Anlegen aufs Brett ist `placement` der passende.

Wächter: `scripts/check-flight-targets.js`.

---

### ④ Animationen: Keyframes gehören in die eigene Komponente

**Symptom:** Die Animation läuft an einer Stelle, an einer anderen nicht
— bei identischem Code.

Ein Keyframe aus dem `<style>`-Block einer **anderen** Komponente
existiert nur, solange die gerade gemountet ist. Läuft sie nicht mit,
bleibt das Element bei `opacity: 0` stehen.

Erlaubt sind genau zwei Quellen: der **eigene** `<style>`-Block oder
`public/style.css` (global geteilt, z.B. `healSparkleParticle`,
`waterRipple`). Wächter: `scripts/check-anim-keyframes.js` — er hat
gleich einen zweiten Fall gefunden, `monkee_shield` (v347), dessen
Animation seit ihrer Entstehung nie lief.

**Verhindern:** Wer eine Animation baut, die nur manchmal zusammen mit
einer anderen läuft, testet sie **auch allein**. Und: Partikel sollen
sichtbar sein — 2-px-Punkte und Null-Boxen gehen neben dem Kartenbild
unter, 4–9 px mit doppeltem Schein nicht.

---

### ⑤ Geschichtete Klänge brauchen `category: null`

**Symptom:** Von drei Klangschichten hört man eine oder keine.

`playSFXForZoneAnim` stempelt jede Schicht ohne eigene Angabe auf
`category: 'effect'`, und diese Sammelkategorie lässt pro Rahmen genau
**einen** Klang durch. Richtig für gleichzeitige Treffer (Bauregel 7 der
SFX-Familie), falsch für einen geschichteten Cue.

**Verhindern:** Ein mehrschichtiger Klang setzt an JEDER Schicht
`category: null` plus ein `dedupe`, damit eine Serie trotzdem nicht
matscht. Vorbilder: `ddg_manifest`, `buff`, `tempeluna_infuse`.

---

### ⑥ Zielschutz: „cannot be chosen" ist NICHT „or hit"

**Symptom:** Der Gegner kann den Helden nicht anklicken, Flächenschaden
trifft ihn trotzdem.

Der `untargetable`-Status wird **nur** in den Zielwählern durchgesetzt.
Sagt der Kartentext „cannot be chosen **or hit**", braucht es
`blocksTargeting(gs, engine, info)` — die Engine liest den Vertrag an
drei Stellen: beide Zielwähler und `_actionDealDamageImpl`.

Zwei Dinge, an denen das bis v1193 trotzdem scheiterte und die jetzt
stimmen: die Prüfung im Schadenspfad stand **innerhalb** des
Surprise-Blocks und erbte dessen Bedingungen (`skipSurpriseCheck`,
`source.heroIdx >= 0`, Typfilter) — `actionAoeHit` schaltete sie damit
komplett ab. Und `chooserIdx` wurde nicht mitgegeben, worauf jedes
Skript gatet, das „your opponent's" prüfen will.

**Verhindern:** Wer einen Zielschutz baut, testet ihn mit **beidem** —
einem gezielten Spell und einer echten Flächenkarte. Und liest genau:
„other **Heroes**" (Stealth) ist etwas anderes als „other **targets**"
(Dive Down, Kreaturen zählen mit). Gemeinsam bleibt: ein zweiter
gleichgeschützter Held zählt **nicht** als Ausweichziel, sonst schützen
zwei einander ins Nichts.

**Liegt die regelgebende Karte nicht mehr auf dem Brett** (eine
Reaction, die sich selbst löscht), hängt sie ihre Regel an den Helden:
`engine.addHeroTargetBlocker(pi, heroIdx, 'Dive Down', { untilTurn })`.
Der Eintrag nennt nur den Kartennamen, die Regel bleibt im Skript. Und:
**ein Schutz, der sich wie ein Buff verhält, braucht ein Abzeichen** —
Eintrag in `TARGET_BLOCKER_BADGES` (app-shared.jsx), sonst sucht der
Gegner den Grund, warum er nicht klicken kann.

---

### ⑦ AoE: Anti-AoE muss reagieren können

**Symptom:** „Deepsea Idol" geht nicht auf, „Interference" greift nicht.

Es sind **zwei** Klammern, und sie hängen an verschiedenen Dingen:
`beginMultiHit(n)` bedient Interference (Heldenseite), **2+ Einträge in
EINEM `processCreatureDamageBatch`** bedienen Deepsea Idol
(Kreaturenseite). Wer seine Kreaturen in einer Schleife einzeln
abarbeitet, erzeugt je Kreatur einen Batch der Größe 1 — das Fenster
verlangt zwei. Details und die zwei erlaubten Bauformen im Kapitel
„ANTI-AoE MUSS REAGIEREN KÖNNEN"; `beginAoeStrike` setzt beides auf
einmal.

**Karten ohne Schaden zählen mit** (Als Regel 18.9.): Gift, Freeze,
Negation, Buffs auf eine ganze Gruppe deklarieren
`hitsMultipleTargets: true` von Hand — die Autoerkennung hängt an der
Schadensklammer und sieht sie sonst nicht.

---

### ⑧ Abzeichen: drei Stellen, an denen es sterben kann

Dieselbe Klasse, schon dreimal getroffen (v1140–v1142, dazu v1192).
Ein Abzeichen erscheint nur, wenn **alle drei** Stellen stimmen:

1. **Die Zeile entsteht.** Die Badge-Zeile des Helden hing früher an
   einer langen Oder-Bedingung (`isFrozen || isStunned || …`) — ein
   Held mit ausschließlich einem neuen Zustand fiel durch jede Prüfung
   und die Zeile wurde nie gezeichnet. Sie hängt seit v1142 nur noch an
   `hero?.name`; wer eine neue Zeile baut, macht es genauso.
2. **Der Block liegt im richtigen Zweig.** v1141: der Eintrag stand
   innerhalb von `if (s.negated || c.negated)` und konnte für eine
   Karte, die gar nichts negiert, nie erscheinen. Anhängsel- und
   Zustands-Abzeichen hängen an **keiner** äußeren Bedingung.
3. **Die Daten kommen an.** `StatusBadges` bekommt `statuses` /
   `counters` / `buffs` — alles andere muss ausdrücklich
   durchgereicht werden (`_targetBlockers: hero._targetBlockers`,
   v1192). Ein Feld, das nur am Helden hängt und nicht im
   Props-Objekt steht, ist für die Abzeichen unsichtbar.

**Verhindern:** Beim Bau eines Abzeichens mit einem **vorhandenen**
vergleichen, das sicher funktioniert (Als Hinweis 15.9.: „vergleich das
mit existierenden Debuffs wie Poisoned"). Und einen Testfall schreiben,
der die Karte mit **ausschließlich** diesem einen Zustand aufstellt —
nur so fällt auf, wenn die Zeile gar nicht erst entsteht.

### Die Wächter — was wovon abgedeckt ist

Alle unter `node scripts/<name>.js`, alle Exit 1 bei Verstoß:

| Wächter | fängt |
|---|---|
| `check-aoe-window` | Kreaturenschaden in einer Schleife ohne Flächenklammer |
| `check-aoe-text` | AoE laut Kartentext, aber nicht als AoE erkennbar (Ratchet) |
| `check-gallery-entries` | Galerie-Einträge mit `cardName` statt `name` |
| `check-flight-targets` | Flüge ins Brett ohne `toHeroIdx`/`toSlotIdx` |
| `check-anim-keyframes` | Animationen, deren Keyframes nirgends stehen |
| `check-search-template` | Such-Galerien ohne `searchToHand`-Kennzeichnung |
| `check-ascension-bonus` | Ascended Hero mit Bonus in `cards.json`, aber ohne `onAscensionBonus` bzw. ohne die Ability im Code (v1264) |
| `check-hero-hopt` | Heldenskript mit „once per turn", das seine Sperre an Heldenplatz oder Instanz bindet statt pro Spieler (v1275) |
| `check-action-hook` | Ein Server-Aktionsweg feuert `onAnyActionResolved` nicht (v1284) |
| `check-damage-types` · `check-no-splice` · `check-areas` · … | siehe die jeweiligen Kopfkommentare |

**Vor jeder Auslieferung laufen alle**, nicht nur die passenden:

```
for w in scripts/check-*.js; do node $w || echo "ROT: $w"; done
```

### Prüfliste für eine neue Karte

1. Alle Wächter grün.
2. Alle Skripte laden (`require` über `cards/effects/`).
3. Testfälle gegen die **echte Engine**, nicht gegen Mocks — und die
   Stubs müssen die echten Antwortformen nachbilden.
4. Für jede sichtbare Wirkung eine **Gegenprobe**: Läuft die Animation
   auch allein? Fliegt die Karte? Öffnet sich die Galerie mit Inhalt?
   Greift der Schutz auch gegen Flächenschaden?
5. Ist die Karte fertig, liegt sie im ZIP — mit `data/cards.json`.

## ★ ZIELENDE KARTEN SIND IMMER ABBRECHBAR — UND ZEIGEN SICH ERST BEIM AUFLÖSEN (Als Regel 23.9. — MANDATORY)

> Al 23.9.: „Zielende Attacks/Spells/Creature Effects sollten immer
> abbrechbar sein. Und natürlich soll das Bild der benutzten Karte nur
> zum Gegner gestreamt werden, wenn sie auch wirklich resolved."

**1. Jede Zielwahl hat einen Cancel-Button** — Ziel-Prompt, Galerie,
Zonenwahl, jede Stufe einer mehrstufigen Auswahl: `cancellable: true`.
Ausnahme ist nur, was nach dem Zusagepunkt kommt (die Karte ist schon
verbraucht, z.B. der Bonus einer Ascension) oder eine Pflichtwahl, die
der Kartentext erzwingt — dann steht der Grund als Kommentar daneben.
Anlass: Midnight Assault (v1295) hatte keinen.

**2. Abbruch heißt: nichts ist passiert.** Die Karte bleibt auf der
Hand, die Aktion wird erstattet, der Gegner hat nichts gesehen.

| Weg | Abbruch melden |
|---|---|
| Spell / Attack aus der Hand | `gs._spellCancelled = true` (Wächter `check-spell-cancel`) |
| Creature Effect | `onCreatureEffect` gibt `false` zurück |
| Ability / Hero Effect | `false` zurück (siehe „Cancelling out of an additional Action") |

Die ctx-Helfer `promptDamageTarget` / `promptMultiTarget` setzen das
Spell-Flag selbst; wer `engine.promptEffectTarget` / `promptGeneric` roh
benutzt, setzt es von Hand — auf JEDEM Abbruchweg, auch bei „Zustand hat
sich zwischen Angebot und Antwort verschoben".

**3. Das Kartenbild geht erst beim Auflösen zum Gegner.** Der Server hält
den Reveal zurück (`gs._pendingCardReveal`) und feuert ihn bei der
ersten bestätigten Antwort bzw. nach der Auflösung; im Abbruchzweig wirft
er ihn weg. Bei **mehrstufiger** Auswahl reicht das nicht — die erste
Antwort ist noch kein Auflösen. Dann `gs._holdCardReveal = true` bis zum
Zusagepunkt, dort `engine._firePendingCardReveal()`, und im `finally`
die Sperre löschen (Muster weiter unten unter „Der Reveal feuert beim
ERSTEN Klick"). Vorbild: Ultimate Weapon Experiment (Galerie → Held).
Dasselbe gilt für ALLES Sichtbare vor dem Zusagepunkt: kein Flug, keine
Animation, kein Klang (v1122, Brainstorming).

**4. Nicht wählbare Ziele werden ausgegraut, nicht verschwiegen**
(Als Regel 21.8., für die zentrale Zielwahl nachgezogen in v1294):
`t.ineligible = true` statt aus der Liste nehmen. Der Server lässt
ausgegraute Ziele nie zu, auch nicht für die CPU.

**Prüfung im Repro (Pflicht):** Abbruch an jeder Stufe → `_spellCancelled`
bzw. `false`, Karte in der Hand, KEIN `card_reveal`, keine Animation.

## ★ JEDE **NEUE** ANIMATION BRAUCHT EINEN KLANG (Als Regel 19.8.)

> „Jede NEUE Animation soll einen Sound haben. Bestehende lasse ich
> nur ändern, wenn sie mir negativ auffallen."

Verbindlich für jede **neu gebaute** Animation. BESTEHENDE stumme
Animationen werden NICHT auf Vorrat nachgerüstet — nur auf Zuruf.
Wer eine vorhandene Animation für eine neue Karte wiederverwenden
will und ihr einen Klang geben möchte, legt dafür einen EIGENEN Typ
an (`ZONE_ANIM_SFX` hängt am Typ, ein Eintrag klingt sonst überall
mit) — Vorbild `trex_chomp`, das `dino_bite` unverändert weiterzeichnet.

Die Zuordnung ist zentral — kein Karten-Code ruft `playSFX` selbst auf:

* **Zonen-Animationen** (`play_zone_animation`): Eintrag in
  `ZONE_ANIM_SFX` in `public/app-shared.jsx`. Form:
  `typ: { name: 'sfx_name', opts: { rate, delay, volume, category } }`.
  Der Verteiler (`playSFXForZoneAnim`) hängt animationsrelative Delays
  automatisch an den Einbau-Versatz an. Bewusst still? Dann
  `typ: null` eintragen — ein FEHLENDER Eintrag ist ein Versehen, ein
  `null`-Eintrag eine Entscheidung.
* **Klänge liegen in `public/sounds/*.ogg`** (52 Stück). Erst dort
  nachsehen, ob etwas passt, bevor ein neuer gebaut wird; über `rate`
  lässt sich ein vorhandener Klang umfärben (schwerer, leichter).
  Beispiel: `earth_rift` nutzt `heavy_impact` mit `rate: 0.85`.
* **Prüfliste beim Bau einer neuen Animation:** Komponente in
  `ANIM_REGISTRY` (app-board.jsx) · CSS-Keyframes (nur `transform`
  und `opacity`) · **Eintrag in `ZONE_ANIM_SFX`** · Repro-Zusicherung
  auf das gesendete `play_zone_animation`.


## ★ SCHADENSTYPEN — DAS VOLLSTÄNDIGE VOKABULAR

Der `type`-Parameter jedes Schadensaufrufs. **Es gibt keine
Registrierung und keine Validierung** — ein Tippfehler fällt nirgends
auf, er ändert nur stillschweigend das Verhalten. Deshalb hier die
verbindliche Liste:

| Typ | Wofür |
|---|---|
| `'creature'` | **Der Normalfall für Kreatureffekte.** Alles, was eine Creature mit ihrem Effekt an Schaden austeilt. |
| `'attack'` | Ein Angriff eines HELDEN. Auch dann, wenn eine Creature ihn auslöst und der Text sagt „treated as that Hero hitting the target" (Infected Greatmaw) — die Quelle ist dann der Held. |
| `'hero'` | **Der Normalfall für HELDEN-Effekte** (v905). Schaden, den ein Held mit seinem aktivierbaren Effekt austeilt, ohne dass der Text ihn zum Angriff erklärt. Öffnet Surprises und Reaktionen wie jeder andere gezielte Karteneffekt. |
| `'destruction_spell'` | Schaden eines Zaubers. NICHT für Kreatureffekte, die zufällig groß sind. |
| `'artifact'` | Schaden eines Artefakts. |
| `'potion'` | Schaden einer Potion (v907). Acid Vial, Punch in the Box, Bottled Lightning. |
| `'decay_spell'` | Verfallszauber (v907). Bisher nur Forbidden Zone. |
| `'recoil'` | **Rückstoß** — Schaden, der auf einen Treffer hin zurückschlägt (Gigantisaur Stegon). Seit v520 in Gebrauch. |
| `'status'` / `'poison'` / `'fire'` | Status-Ticks. Die Engine setzt sie selbst; Karten schreiben sie praktisch nie. |
| `'other'` | Alles, was in keine Schublade passt — z.B. eine Selbstverletzung als Kosten (Ska Harpyformer). Bewusste Entscheidung, kein Auffangbecken. |

**`'normal'` ist KEIN gültiger Typ** und war nie einer. Bis v519 stand
er in vier Kreaturmodulen und hat sich wie ein unbekannter Wert
verhalten.

**Wer liest den Typ überhaupt?** Genau vier Stellen, und deshalb ist
eine Fehlzuweisung ein echter Regelfehler, kein Schönheitsfleck:

* **Dark Ocean** (`_engine.js`, Kreaturenstapel): „Creatures take no
  damage, except from Attacks and Spells" — durch kommen NUR `attack`
  und `destruction_spell`.
* **Angler Angel**: erhöht Effektschaden von Kreaturen; ausgenommen
  sind `attack` und die Status-Typen.
* **Surprise-Fenster** (`SURPRISE_SKIP_TYPES`): `status`, `burn`,
  `poison`, `recoil` und `other` öffnen das Standardfenster nicht.
* **Zsos Ssar** benutzt dieselbe Ausnahmeliste.

**Wächter (v905):** `node scripts/check-damage-types.js` prüft jeden
Schadensaufruf mit LITERALEM Typ gegen genau diese Tabelle. Ratchet
gegen `scripts/damage-types-baseline.json` wie bei `check-no-splice`:
der Bestand darf stehen, NEUES nicht; nach einer Bereinigung
`--update`. Wird der Typ über eine Variable gereicht, kann der Wächter
nichts sagen und schweigt. Ein neuer Typ gehört ERST in diese Tabelle,
dann in die Liste `VOKABULAR` im Wächter.

Faustregel beim Bau einer Creature: **`'creature'`, außer der
Kartentext sagt ausdrücklich etwas anderes.**

## ★ JEDE EINGESETZTE KARTE GEHÖRT INS LOG (Als Regel 20.8.)

> „Jede Karte, die eingesetzt wird, sollte einen Logeintrag haben!"

Zwei Hälften, und BEIDE müssen stimmen:

1. **Engine-seitig** eine Zeile schreiben (`engine.log(typ, {...})`).
   Für die normalen Spielwege macht das der Server schon
   (`_setPendingPlayLog` → `spell_played`, `creature_effect_activated`,
   `ability_activated`, `card_played`, …), für Reaktionsfenster die
   Engine selbst.
2. **Client-seitig** einen Fall in `formatLogEntry` (app-board.jsx).
   **Ohne den ist die Zeile unsichtbar** — `formatLogEntry` gibt für
   unbekannte Typen `null` zurück und der Eintrag wird verworfen.

Genau daran hing der Befund vom 20.8.: alle 16 Hand-Reaktionsfenster
loggten korrekt, hatten aber keinen Client-Fall — die 25 Karten, die
über diese Fenster laufen (Troop Annihilation & Co.), erschienen nie im
Log. Behoben über die Tabelle `REAKTIONS_ANLAESSE` in app-board.jsx: ein
neues Fenster trägt sich dort mit einer Zeile ein.

Kartenspezifische Zusatzzeilen (`blue_ice_shatter`, `angler_boost`, …)
sind davon unberührt — die sind Beiwerk. Pflicht ist die Zeile
„Spieler setzt Karte X ein".

## ★ JEDER GETRIGGERTE PASSIVE EFFEKT ZEIGT SEINE KARTE BEIDEN SPIELERN (Als Regel 21.8./1.9./6.9. — MANDATORY)

> Al 6.9.: „Wenn sich der passive Effekt einer Karte aktiviert (also per
> Trigger, wie Melissa), soll diese Karte grundsätzlich IMMER an beide
> Spieler gestreamt werden, um zu zeigen, dass sie sich aktiviert hat."

Das ist eine GRUNDREGEL, keine Kosmetik: ohne den Auftritt sieht kein
Spieler, WELCHE Karte gerade etwas auslöst. Sie gilt für jede Karte, deren
Wirkung aus einem HOOK heraus feuert — „Whenever …", „When … you may …",
Reaktionsfenster ohne Handkarte, Todes-/Zieh-/Gold-/Schadens-Trigger.
Gemeint ist der `card_reveal` **links neben dem Feld** über den Zugphasen,
an BEIDE Spieler (und Zuschauer).

**Warum das Kartenskript es selbst tun muss:** die expliziten
Aktivierungspfade (Hero-Effekt, Ability, Creature-Effekt, Artefakt,
Surprise, Spell aus der Hand) streamen im Server. Aus einem Hook heraus
gibt es keinen solchen Weg — und `announceActiveEffect` reicht NICHT, es
schickt nur an den Besitzer. Deshalb:

```js
// in dem Moment, in dem der Effekt WIRKLICH feuert:
await engine.showTriggeredEffect(CARD_NAME);
```

Das ist der EINE Helfer (v817; `announceHookActivation` ist nur noch ein
Alias mit den alten Vorgaben). Optionen: `replace` (Reaktion löst die
Karte ab, auf die sie reagiert — Key), `source` (siehe unten), `sfx`,
`delayMs`, `playerIdx`.

**Zeitpunkt (v736, MANDATORY):** HINTER der letzten Stelle, an der der
Spieler noch abbrechen kann. Nach einem „you may" also erst nach dem Ja;
nach einer Auswahl erst nach der bindenden Wahl. Ein abgelehnter Trigger
zeigt NICHTS. Details unten unter „Auftritt erst, wenn der Effekt
WIRKLICH läuft".

**★★ v1122 — DIE REGEL GILT FÜR JEDE SICHTBARKEIT, nicht nur für
Trigger-Auftritte.** Al 15.9.: „Brainstorming verlässt aktuell die Hand,
BEVOR sie confirmed wurde! Man kann also noch abbrechen, nachdem sie
visuell schon weggeflogen ist!"

Genau diese Regel stand hier — und ich habe sie mit einem
`play_pile_transfer` verletzt, weil ich sie nur auf `play_card_appear`
bezogen gelesen hatte. Sie gilt für **Flüge, Animationen, Aufdeckungen,
Klänge — alles, was der Spieler wahrnimmt**.

Die Prüffrage beim Bauen: *Kann der Spieler nach dieser Zeile noch nein
sagen?* Wenn ja, darf hier nichts sichtbar werden. Bei „Brainstorming"
ist der verbindliche Punkt der geglückte Hand-Add; der Selbst-Flug steht
seitdem dahinter, und ein Testfall prüft, dass ein Abbruch **gar keinen**
Flug auslöst.

**★ Flüge können jetzt einen Klang mitbringen (v1122):**
`play_pile_transfer` nimmt `sfx: 'draw'` entgegen. Vorher hatte nur der
Deck→Hand-Weg seinen eigenen (v1111) — jeder andere Flug war stumm.

**Einmal je Auslöser (Als Regel 21.8.):** trifft ein Flächenschlag drei
Helden oder bringt EIN Ziehvorgang drei Karten und der Trigger antwortet
je Treffer/Karte, zeigt sich die Karte trotzdem nur EINMAL. Dafür das
Quellobjekt bzw. die Vorgangskennung als `source` mitgeben
(`ctx._drawBatch`, das Schadens-`source`-Objekt, `ctx._goldSource`) —
gleicher Wert = kein zweiter Auftritt. Wo der Effekt selbst schon je
Vorgang entprellt (Melissa an `_drawBatch`), reicht der schlichte Aufruf.

**Was NICHT zählt:** dauerhaft laufende Passiva, die nur einen Wert
nachrechnen (Angler Angel, Tempeste −100, Warhorse +50, Future Tech Gun,
Laser Cannon) — die würden bei jedem Treffer blinken. Und kein Auftritt,
wenn der Effekt im konkreten Fall nichts bewirkt (Gear mit 0 Kopien in
der Ablage): die Anzeige kündigt etwas an, sie meldet keinen Leerlauf.

**Prüfung im Repro (Pflicht für jeden neuen Trigger):** Reveal beim Ja,
KEIN Reveal beim Nein, EIN Reveal bei mehreren Treffern aus einer Quelle.
Vorbilder: Cute Meanie Melissa (Zieh-Trigger, nach dem Ja), Monami (nach
der Galerie-Wahl), Hunting (nach dem Confirm), Key (Reaktion mit
`replace`), Lifeforce Howitzer und Royal Treasury (`source`).

## ★ JEDE AREA DEFINIERT EINEN HINTERGRUND, SOLANGE SIE LIEGT (Als Regel 7.9. — MANDATORY)

Eine Area verändert das Spielfeld sichtbar — nicht nur im Area-Slot.
Für JEDE Area-Karte gehört deshalb zur Implementierung ein Hintergrund-
Overlay im Client, das genau so lange gezeigt wird, wie die Area in
einer der beiden Area-Zonen liegt (beide Seiten, wie die Regel-Prüfung
`areaZones` es auch tut):

1. `public/app-board.jsx`: eine Komponente `<NameOverlay />` neben
   `StinkyStablesOverlay` / `FirstCircleOfHellOverlay` / `BoardOfKingsOverlay`
   — `position: absolute; inset: 0; pointer-events: none; overflow:
   hidden`, KEIN zIndex (liegt damit unter der Karten-Ebene), Layer aus
   Gradients/SVG/Emoji-Glyphen, Animationen per eingebettetem `<style>`.
   Was sich bewegt, braucht keinen Klang (Ambiente, kein Ereignis).
2. In die Registry `AREA_OVERLAYS` (app-board.jsx, direkt über
   `BoardOfKingsOverlay`) eintragen — mit `tier` (v824, Als
   Schichtsystem 7.9.):
   - `opaque`: füllt den Hintergrund vollständig (Schachbrett, Dark
     Ocean, Doom Clock …) → immer ZUUNTERST. Zwei verschiedene opaque-
     Areas zugleich → faseriger Diagonalschnitt links oben → rechts
     unten; links/unten der betrachtende Spieler, rechts/oben der Gegner.
   - `translucent`: deckt alles, aber halbdurchsichtig → Mitte.
   - `partial`: deckt nur Teile → obenauf.
   Was nicht in der Registry steht, wird NICHT gerendert.
3. Dann `node scripts/build.js` + `check-bundles`, Bundle mitliefern.

**Ein Eintrag genügt — der Puzzle Creator hängt mit dran (v1202).** Die
Schicht ist die Komponente `<AreaBackgrounds areaZones myIdx oppIdx />`
(app-board.jsx, per `window.AreaBackgrounds` exportiert); der Creator
rendert dieselbe Komponente in `.pz-plane-clip` (app-puzzle.jsx), mit
`myIdx: 0` (YOU, unten) und `oppIdx: 1` (OPPONENT, oben). Eine neue Area
erscheint damit automatisch AUCH im Editor — keine zweite Registry, kein
Nachziehen. Der Schalter „🖼️ BACKGROUNDS" in der Creator-Kopfleiste
blendet die ganze Schicht aus; er ist reine Ansicht (eigener
localStorage-Schlüssel `pz-creator-backgrounds`, überlebt RESET) und hat
auf Puzzle-Daten, Export und den Testkampf keinen Einfluss.

**4. Und die Karte muss sich SELBST in die Zone legen.** Areas landen
nicht von allein im Slot. Ohne das greift in JEDEM Spielpfad die
Standard-Entsorgung Hand → Ablage — die Karte wird bezahlt, die Aktion
ist weg, und sie liegt in der Ablage (Lehre aus dem Cottage-Fall v186,
noch einmal gebrochen von Pangaia, v902):

```js
module.exports = {
  // 'hand' fuer das Selbstlegen, 'area' fuer die passiven Hooks.
  // Fehlt 'hand', feuert onPlay beim Spielen GAR NICHT.
  activeIn: ['hand', 'area'],
  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;              // beide Wachen noetig,
      if (ctx.playedCard?.id !== ctx.card?.id) return;  // sonst legt sie sich
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);  // bei FREMDEN Karten neu
    },
    // Jeder passive Hook wird gegengeguertet:
    onCardEnterZone: async (ctx) => { if (ctx.cardZone !== 'area') return; /* … */ },
  },
};
```

Der `'hand'`-Eintrag in `activeIn` hat einen Preis: die passiven Hooks
feuern damit AUCH aus der Hand. Jeder von ihnen braucht deshalb
`if (ctx.cardZone !== 'area') return;` — sonst wirkt die Area schon aus
der Hand (bei Pangaia hätte jede Lv3+-Beschwörung ihre +200 doppelt
bekommen). Artefakt-Areas (Smuggler's Pier) gehen über `resolve` statt
über die Hook-Kette und rufen `placeArea` dort.

**Wächter:** `node scripts/check-areas.js` prüft alle drei Punkte für
jede implementierte Area (Selbstlegen, `activeIn` mit `'hand'`,
Registry-Eintrag) und gehört vor jede Auslieferung mit Area-Karten in
die Prüfrunde — zusammen mit `check-no-splice`, `check-scope` und
`check-bundles`.

Eine Area ohne Overlay ist unfertig. Board of Kings: Schachbrett in
leichter Perspektive mit Walnuss-Rahmen, Holzmaserung, Vignette und
aufsteigenden Figuren-Silhouetten.

## ★ FOIL-KARTEN: EIN ANSCHLUSS, `<CardFoil card={…} />` (v1203)

`foil` steht in cards.json auf der Karte selbst (`secret_rare` |
`diamond_rare`) und ist damit eine Eigenschaft der KARTE, nicht des
einzelnen Exemplars. Die Schicht darüber hat seit v1204 **vier Lagen**:

1. **Textur** — die Prägung der Folie. Secret Rare: feine Schrägrillen;
   Diamond Rare: breite 45°-Facetten (ein feines Gitter beißt sich mit
   dem Pixelraster der Karten). Bewusst fast unsichtbar.
   **★ v1205 (Als Befund 18.9.): ab 120 px Kartenbreite fällt die
   Prägung weg** — Rillen haben eine feste Breite und werden auf einer
   groß gezeichneten Karte zu gemalten Balken. Das gilt für die Lage
   selbst UND für die Rillen im Band (`.foil-band::after`), die dieselbe
   Prägung nur beleuchtet zeigen. Umgesetzt als Größenregel, nicht als
   Liste von Stellen: `.foil-shine-overlay` ist `container-type:
   inline-size`, die Lagen hängen an `@container (min-width: 120px)`.
   Damit greift es automatisch im großen Tooltip, in den Helden-Plätzen
   des Deck-Editors, im Karten-Auftritt und in allem, was später
   dazukommt; Brett, Hand und Galerien liegen mit 64–100 px darunter.
2. **Schimmer** — farbige Interferenz über die ganze Karte.
3. **Bänder** — wandernde Lichtstreifen, `mix-blend-mode: screen`, mit
   heißem weißem Kern (`::before`) und den Rillen der Prägung als
   Schatten IM Licht (`::after`, multiply). Dass die Textur beleuchtet
   statt aufgemalt wird, ist das, was sie physisch wirken lässt.
   **★ v1205: Diamond Rare hat jetzt ebenfalls Bänder** (vorher keine) —
   drei statt fünf, deutlich breiter, flacher geneigt und rund doppelt
   so langsam, in Türkis/Aqua/Tiefblau mit weißem Kern. Licht, das über
   eine geschliffene Fläche GLEITET, statt Folie, die blitzt; die
   Palette steht in `DIAMOND_BAND_GRADIENTS`.
4. **Funken + Staub** — Lichtkreuze mit langen Spitzen und Bloom, dazu
   langsam aufsteigende Staubkörner.

**Alles läuft per CSS.** Bis v1203 schob ein JS-Zeitgeber je Karte alle
150–850 ms ein Band in den React-Zustand — Dutzende Re-Renders je
Sekunde für reine Deko. Seit v1204 bekommt jede Karte EINMAL fünf
Bandbeschreibungen mit gestaffelten Laufzeiten; jedes Band belegt nur
40 % seines Taktes und wartet den Rest unsichtbar ab. Gleiche
unregelmäßige Dichte, null React-Arbeit nach dem ersten Render.

Jede animierte Lage hat einen Grundzustand, der ohne Animation richtig
aussieht (`opacity: 0` bei Funken/Bändern/Staub, `.18` beim Schimmer) —
sonst stünden bei „Play Animations: aus" starre Lichtkreuze auf der
Karte.

Genau das war die Bruchstelle: jede Anzeigestelle trug ihre eigene
Kopie derselben sechs Anschlusszeilen, und eine davon (der große
Tooltip, beim Herauslösen aus BoardCard) stand auf `bands={[]}` — die
Karte funkelte weiter, aber kein Band lief je über sie. Eine zweite
rechnete `isFoil` aus und zeichnete gar nichts, eine dritte (die
Handkarten des Puzzle-Creators) hatte nie eine Schicht bekommen.

**Deshalb gilt: wer ein Kartenbild zeigt, hängt `<CardFoil card={…} />`
als Geschwister direkt daneben — mehr nicht.** Die Komponente
(app-shared, per `window.CardFoil`) hält Bänder, Schimmerphase und
Funkenversatz selbst und rendert bei Nicht-Foil-Karten `null`. Der
Elternknoten braucht `position: relative` (die Schicht liegt absolut
auf `inset: 0`) — sonst hängt sie sich an den nächsten positionierten
Vorfahren, im Zweifel die ganze Leiste.

`FoilOverlay` bleibt exportiert, ist aber ein Rohteil:
`scripts/check-foil.js` lässt `<FoilOverlay>` nur noch im Rumpf von
`CardFoil` stehen und meldet jede neue Kopie. `useFoilBands` ist mit
v1204 entfallen.

**Diamond Rare ist durchgehend türkis-blau gehalten** (Als Vorgabe
18.9.): Rahmenpuls, Schimmerfolie, Facetten, Bänder, Funken und Staub
ziehen alle an derselben Palette. Die Trennung zur Secret Rare ist
bewusst farblich UND im Takt — Regenbogen/schnell gegen Türkis/langsam;
sonst sind die beiden Seltenheiten auf einen Blick nicht zu
unterscheiden.


## ★ ZONEN-EINSCHLAG: JEDE PLATZIERUNG WIRD SICHTBAR (v1206 — Als Vorgabe 18.9.)

„Wird eine Karte in einer Zone platziert (Abilities, Creatures, Equips,
Attachments, Heroes, völlig egal), soll allgemein immer eine hübsche
kleine Particle-Animation gespielt werden."

**Für Kartenskripte ist dabei NICHTS zu tun.** Der Effekt hängt an
keinem Platzierungsweg, sondern am Ergebnis: Kampfbrett und
Puzzle-Editor vergleichen nach jeder Zustandsänderung die Belegung
aller Zonen (`Platzschlüssel → Stapelhöhe|oberste Karte`) mit der
vorigen, und was sich ändert, ist eine Platzierung. Gespielt,
beschworen, platziert, wiederbelebt, gestohlen, umgezogen, per Puzzle
geladen — alles fällt automatisch darunter, auch alles, was später
dazukommt. Einen Kanal je Weg abzuhorchen wäre bei Dutzenden
platzierenden Skripten ein Fass ohne Boden.

Was daraus folgt, wenn du an der Oberfläche baust:

* Die Zone muss ihr **DOM-Anker-Attribut** tragen — im Kampf
  `data-hero-zone` / `data-ability-zone` / `data-support-zone` /
  `data-surprise-zone` / `data-area-zone` (jeweils mit `-owner` und den
  Index-Attributen), im Editor `data-pz-zone="<si>-<zt>-<hi>-<slot>"`
  bzw. `data-pz-perm`. Eine neue Zonenart ohne Anker bekommt keinen
  Einschlag; die Zuordnung steht in `zonenSelektor` (app-board).
* **Zähler, HP und Status lösen nichts aus** — nur Name oder
  Stapelhöhe zählen. Ein Equip auf eine Kreatur erhöht den Stapel und
  feuert also; 40 Schaden auf denselben Helden nicht.
* Die **Farbe kommt aus dem Kartentyp** (`typeColor`): Creatures grün,
  Heroes violett, Abilities blau, Artefakte gold. Der Blick weiß damit
  schon an der Farbe, was gelandet ist.
* **★ v1207: Kreaturen werden BESCHWOREN statt eingeschlagen.**
  Statt Ring und Funken zwei gegenläufige Runenringe am Fuß der Zone
  (flachgedrückt, damit sie auf dem gekippten Spielfeld am Boden
  liegen), eine Lichtsäule nach oben und aufsteigende Irrlichter —
  langsamer als der Einschlag, weil Beschwörung ein Vorgang ist und
  kein Aufprall. Wer die Variante bekommt, entscheidet
  `zoneLandStyle`: Kartentyp mit „Creature" (`Creature`,
  `Creature/Token`) **oder ein Token MIT HP** — die Spielsteine mit HP
  (Mummy, Invader, Leprochaun, Biomancy) stehen als Kreatur auf dem
  Brett, der Pollution Token und die HP-losen Puppets nicht. Aktuell
  trifft das 418 der 1413 Karten. Weitere Varianten hängen sich an
  derselben Stelle ein (`opts.variant` in `spawnZoneLandFx`).
* Gefüllt wird über `spawnZoneLandFxBatch` — mehrere Plätze auf einen
  Schlag laufen **gestaffelt** (45 ms) und gedeckelt (14). Der
  Spielstart legt sechs Helden und ein Dutzend Abilities gleichzeitig;
  ohne Staffelung wäre das ein Blitz statt eines Effekts.
* Der **erste Durchlauf setzt nur die Grundlinie** (ebenso nach einem
  Partiewechsel und beim Öffnen eines gespeicherten Puzzles) — sonst
  detoniert beim Betreten eines laufenden Spiels das halbe Brett.

Der Effekt selbst (`spawnZoneLandFx`, app-shared) ist bewusst **ohne
React** gebaut: eine feste Schicht auf `document.body`, Koordinaten aus
`getBoundingClientRect`, drei CSS-Lagen (Schein, Ring in Zonenform,
gezogene Funken). Dieselbe Bauform wie die Kartenflüge — und der Grund,
warum Kampfbrett und Editor, die in völlig verschiedenen Bäumen leben,
dieselbe Funktion rufen können.

**★ v1209 — die Beschwörung liegt in ZWEI Ebenen** (Als Vorgabe 18.9.:
„Die Lichtsäule soll durchaus über der Karte sein, nur der Kreis-Teil
darunter"). **Unten**, im Brettbaum: nur die Runenringe — die Karte
steht damit im Kreis. **Oben**, auf der festen Schicht: Lichtsäule,
Schein, ein diagonaler Glanzstreifen über die ganze Karte, Irrlichter
und derselbe Funkenflug wie beim Einschlag. Ohne den zweiten Teil
leuchtete nur der Fuß der Karte und der Effekt wirkte zu klein.

Beim Einhängen in den Brettbaum gilt `ppUiScale` (v837): der Wirt liegt
unter `zoom: var(--ui-scale)`, `getBoundingClientRect` liefert aber
echte Fensterpixel. Ungewandelt landet der Kreis um genau diesen Faktor
daneben — im Kampffeld (`ui-noscale`) fällt es nicht auf, im
Puzzle-Editor sofort. Gegen drei Maßstäbe (0,7 / 1 / 1,25) geprüft.

**★ v1208 — Einschlag liegt OBEN, Beschwörung UNTEN.** Ein Kreis am
Boden, der über der Karte liegt, ist ein Widerspruch (Als Befund
18.9.). Der Einschlag bleibt auf der festen Schicht — er schlägt ja auf
der Karte ein. Die Beschwörung wird stattdessen in den Brettbaum
gehängt: in `.board-plane-clip` bzw. `.pz-plane-clip`, **nach** den
Area-Hintergründen und **vor** die Ebene mit den Karten. Eine eigene
Schicht mit kleinerem `z-index` reicht dafür NICHT — die Karten liegen
hinter dem `transform` der Brettebene in einem eigenen Stapelkontext,
da kommt ein Geschwister auf `document.body` nicht drunter. Zonen
außerhalb der Ebene (Permanents) fallen automatisch auf die feste
Schicht zurück.

## ★ HANDKARTEN: NEIGUNG UND ZIEH-KLÄNGE (v1210 — Als Vorgabe 18.9.)

**Neigung.** Solange eine Karte gezogen wird — umsortiert ODER aufs
Brett — stehen alle Karten **der gezogenen Reihe** um denselben festen
Winkel (`HAND_TILT_GRAD`, **5°**) vom Zeiger weggedreht; nur die
Richtung hängt davon ab, auf welcher Seite des Zeigers die Karte liegt.
`applyHandTilt` (app-shared) schreibt den Wert als `--hand-tilt` an die
Knoten, das Aussehen steht in style.css, `clearHandTilt` stellt zurück.

**★ v1217 — DIE LÜCKE STATT DER MESSUNG.** Im Kampf zitterten die
Karten weiter, und die Ursache sitzt tiefer als jede Messtechnik:
`calcDropIdx` bestimmt die Einfügestelle, indem es die Kartenplätze
MISST — und die eingefügte Lücke verschiebt genau diese Plätze um eine
Kartenbreite. Steht der Zeiger nahe einer Grenze, wandert die Karte
unter ihm hin und her, und mit ihr die Seite, auf der sie liegt. Gegen
einen Sprung von Kartenbreite hilft keine Hysterese auf Pixelebene.

Beim Umsortieren in der Hand ist die Lücke aber bereits **die
Zeigerposition, in Karten ausgedrückt**. Also wird für die Neigung gar
nicht mehr gemessen: `applyHandTilt(…, { gapIndex })` kippt alles vor
der Lücke nach links, alles dahinter nach rechts. Gemessen: **0
Layout-Zwänge** (vorher 12 je Mausbewegung) und 0 Schreibvorgänge,
solange die Lücke steht. Der Effekt läuft entsprechend nur noch, wenn
die Lücke SPRINGT, nicht sechzigmal je Sekunde.

Der Vorrat und die Zuege aufs Brett haben keine Lücke; dort bleibt der
Messweg, aber mit grobem 30-px-Raster im Effekt-Takt.

**★ v1217 — DER ZIEH-SCHALTER SITZT AN DEN HANDREIHEN**, nicht mehr an
`<html>` (Als Befund: „es fühlt sich spürbar ruckelig an, wenn man
initial eine Karte greift"). Eine Klasse am Wurzelelement zwingt den
Browser bei jedem Wechsel, das ganze Dokument gegen ein 690-KB-Blatt
neu abzugleichen — einmal beim Greifen, einmal beim Loslassen.
`setHandDragFlag` (app-shared) setzt `.pp-dragging` stattdessen auf die
vier Handreihen; die Ungültigkeit bleibt in deren Teilbäumen.

**★ v1216 — ERST MESSEN, DANN SCHREIBEN** (Als Befund: „die Rotation
buggt leicht und es fühlt sich laggy an, als würde da permanent irgendwas
neuberechnet"). Genau das tat es: die Schleife las einen Kasten, schrieb
einen Wert, las den nächsten … Jede Schreiboperation macht den Stil
ungültig, jede folgende Messung erzwingt ein neues Layout — zwölf
erzwungene Layouts JE MAUSBEWEGUNG. Jetzt zwei getrennte Durchgänge,
dazu zwei Sparbremsen: gleicher Winkel wie zuletzt wird gar nicht erst
geschrieben (gemessen: 0 statt 8 Schreibvorgänge bei zehn Bewegungen
innerhalb derselben Karte), und eine Hysterese von 10 px verhindert das
Flackern direkt an der Kartenmitte.

Zwei Korrekturen aus Als Tests, beide mit Anlass:

* **Pauschal statt abgestuft** (v1211). Der erste Anlauf ließ die
  Neigung mit dem Abstand zum Zeiger abfallen — „sieht so leider gar
  nicht gut aus". Pauschal ist eine klare Geste, der Verlauf war Matsch.
  `opts.grad` bleibt als Regler, die Vorgabe ist flach.
* **5° statt 30°** und **nur die gezogene Reihe** (v1212). 30° kippten
  die Karten übereinander, die Hand war nicht mehr zu lesen — die
  Neigung ist ein Hinweis, keine Fächerbewegung. Und es gibt mehrere
  Kartenreihen: im Kampf Hand und Vorrat, im Editor zusätzlich beide
  Gegnerreihen. Gedreht wird die, aus der die Karte stammt
  (`fromCreation` im Kampf, `dragHandSource` → `PZ_HAND_REIHEN` im
  Editor); kommt sie aus der Galerie oder von einer Brettzone, neigt
  sich keine. Beide zugleich zu kippen behauptet einen Zusammenhang,
  den es nicht gibt — eine Vorratskarte ist keine Handkarte (Als Regel
  28.8.).

Zwei Fallen, die dabei schon zugeschnappt sind:

* **Messung ohne Rückkopplung.** Gedreht wird die KARTE, gemessen ihr
  PLATZ (`hand-slot`, nie gedreht) plus `offsetWidth` der Karte, das vom
  `transform` unberührt bleibt. Wer den Kartenrahmen selbst misst,
  bekommt Neigung → Messung → Neigung und damit Zittern. Im
  Puzzle-Editor IST die Karte der Platz — dort liegt der Drehpunkt
  deshalb in der Mitte (`50% 50%`), wo die Kartenmitte unter der Drehung
  fest bleibt; im Kampf darf er unten liegen (`50% 85%`, Fächer-Optik).
* **Der Effekt steht HINTER dem Zustand, den er liest.** Weiter oben
  wäre die Abhängigkeitsliste beim Rendern `undefined`:
  `transform-block-scoping` macht aus dem `const` ein hochgezogenes
  `var`, der Rumpf läuft also später richtig, die Liste wird aber sofort
  ausgewertet — der Effekt liefe genau einmal und die Neigung stünde
  still. Steht als Warnung auch in `scripts/build.js`.

**Klänge.** `playCardDragSFX(art)` mit `reorder` | `release` | `cancel`
(★ v1213: `pickup` **entfällt** — Als Befund: „der irritiert beim
laufenden Spiel". Während einer Partie hebt man ständig Karten an, um
zu vergleichen oder Ziele zu prüfen; ein Ton bei jedem dieser Griffe
meldet ein Ereignis, das keines ist.) — eine Tabelle in app-shared, damit Kampf, Puzzle-Editor und
Deck-Bauer nicht drei Handschriften bekommen. Ausgewählt nach dem
gemessenen Charakter der Dateien, nicht nach ihrem Namen: `ui_click`
ist kurz und hell (0,25 s, 95 % der Energie im ersten Fünftel) —
heruntergestimmt ein Anheben; `draw` ist der kurze Kartenrutscher.
`placement` (1,07 s, dunkel) spielt die Engine beim Landen ohnehin, beim
Loslassen kommt darum nur ein leiser Tick dazu.

**★ PEGEL RECHNEN, NICHT SCHÄTZEN (v1211, Als Befund: „viel zu leise,
beim Pick-Up höre ich GAR NICHTS").** Am Ausgang stehen DREI Faktoren
übereinander: die Eigenlautstärke des Klangs
(`SFX_VOLUME_OVERRIDES` — `ui_click` steht auf **0,5**), der globale
Dämpfer `SFX_MASTER_MULTIPLIER` (**0,33**) und erst dann `opts.volume`.
Ein „leiser" 0,38 wird damit zu 6 % Pegel, also zu nichts. Werte über 1
sind ausdrücklich zulässig; als Maßstab dient `placement` bei
1 × 1 × 0,33 = 0,33. Die Tabelle steht heute bei 0,26–0,36 und nennt den
gerechneten Endwert je Zeile im Kommentar.

Der Loslass-Klang sitzt an EINER Stelle ganz oben in `onUp` und nicht in
den Zweigen: `onUp` hat über ein Dutzend davon, und jeder neue wäre
wieder einer, der ihn vergisst. Im eigenen Bereich losgelassen heißt
Umsortieren, sonst Loslassen.

## ★ `waveAnimation`: EINE WELLE VOM WIRKER STATT BILDER JE ZIEL (v1213)

Anlass „Flame Avalanche" (Als Vorgabe 18.9.): „zeigt aktuell einfach
nur Flammen auf ihren Zielen an — sollte aber eine Lawine aus Flammen
zeigen, die vom Caster ausgehen und alle Ziele überwalzen."

`ctx.aoeHit({ …, animationType: null, waveAnimation: { type, duration,
delay } })`. Die Engine sendet daraufhin EINE brettweite Animation
(`zoneType: 'board'`) mit dem wirkenden Helden als
`originOwner`/`originHeroIdx` **und der Zielliste** (`targets:
[{owner, heroIdx, zoneSlot}]`, `zoneSlot: -1` = Held). `delay` hält den
Ablauf an, bis die Geschosse bei den Zielen sind — ohne das fällt der
Schaden, bevor die Animation ankommt.

Aufgelöst werden Ursprung und Ziele erst im Client (`onZoneAnim`,
Zweig `zoneType: 'board'`): nur der kennt `myIdx` und das DOM. Nicht
gefundene Ziele (außerhalb des Bildes, inzwischen tot) fallen still
heraus. Die Komponente bekommt fertige Bildschirmpunkte als `ox`/`oy`
und `targetPoints`.

★ v1215/v1216, zweiter Anlauf bei „Flame Avalanche": der erste war eine
WAND, die über das Brett rollt — Als Urteil: nicht gut. Eine Wand kommt
von nirgendwo, ein Flammenwerfer hat Quelle UND Ziel. Jetzt läuft je
Ziel ein Strom aus **26** Geschossen (v1216, „noch breiter"; Obergrenze
170 gesamt, damit acht Ziele das Brett nicht ausbremsen), alle aus demselben Punkt beim Wirker,
fächerförmig gestreut, auf leicht durchhängenden Bahnen (lauter Geraden
sehen aus wie ein Speichenrad) und mit einem Einschlag am Ziel. Viele
Ziele gleichzeitig ergeben die Breite: aus dem Strahl wird die Lawine.

**Warum in der Engine und nicht im Kartenrumpf:** die Welle muss NACH
der Zielwahl losrollen. Sendet die Karte sie selbst, startet sie, während
Idas Einzelziel-Frage noch offen steht. `_spieleWellenAnimation` wird
deshalb in BEIDEN Zweigen von `actionAoeHit` gerufen — Einzelziel nach
dem Prompt, Fläche nach allen Abwehr-Fenstern, damit ein negierter
Zauber sie gar nicht erst zeigt.

Die Einzeltreffer-Animation fällt dabei weg (`animationType: null`) —
die Welle IST das Bild. Schadenszahlen laufen unverändert. Für den
NEGIERTEN Guss zeigt `spellVisual` weiter etwas Kleines auf den Zielen
(Flame Avalanche: `flame_strike`): eine Lawine, die über alles
hinwegrollt und dann nichts tut, wäre das falsche Bild.

## ★ HANDKARTE UNTER DEM ZEIGER (v1214 — Als Vorgabe 18.9.)

Die gehoverte Handkarte wird **1,42× größer**, bekommt eine Umrandung
plus Schein in `--player-color` und verschiebt sich 18 px. Sie überdeckt
dabei ihre Nachbarn (`z-index: 60` auf Karte UND Platz) und bricht aus
der Handleiste aus — beide Leisten stehen dafür schon auf
`overflow: visible`.

* **Richtung nach Seite:** eigene Reihen (Hand, Vorrat) heben sich nach
  OBEN, Gegnerreihen schieben nach UNTEN. Andersherum liefe die
  vergrößerte Karte aus dem Fenster. Im Kampf gilt es für aufgedeckte
  Gegnerkarten (`.revealed-hand-card`) — verdeckte poppen nicht.
* **`outline` statt `border`:** der Rahmen trägt schon Zustände (Foil,
  gesperrt, wählbar), und eine Umrandung außerhalb des Kastens ändert
  das Layout nicht.
* **Die Neigung bleibt Teil der Transformation** (`rotate(var(--hand-tilt))`
  als LETZTER Schritt), sonst richtete sich die Karte beim Hovern mitten
  im Ziehen wieder auf — und das Heben bliebe nicht senkrecht im Bild.
* **Riegel `html.pp-card-dragging`:** während eines Kartenzuges hebt
  nichts ab. Sonst poppt die Nachbarkarte auf, über die der Zeiger beim
  Umsortieren gerade hinwegfährt.
  **★ v1215 — ZWEI GURTE, nachdem einer nicht reichte** (Als Befund:
  „manchmal wird eine andere Handkarte groß gehighlightet"):
  1. Die Klasse wird **synchron in den Ziehstellen** gesetzt
     (`onMove`, sobald das Ziehen beginnt; `onDragStart` im Editor) und
     ganz oben in `onUp` / `onDragEnd` wieder gelöst — nicht mehr nur
     über den React-Effekt. Der läuft erst nach dem nächsten Render,
     und genau in diesem Fenster steht der Zeiger schon über der
     Nachbarkarte.
  2. Solange die Klasse steht, nehmen Handkarten im KAMPF **gar keinen
     Zeiger** mehr an (`pointer-events: none`).
     **★ v1216 — im Puzzle-Editor NICHT** (Als Befund: „im Puzzle
     Editor kann ich GAR NICHT MEHR drag/droppen"). Dort läuft der Zug
     über HTML5-Drag&Drop, und die gezogene Karte ist selbst das
     Quellelement; nimmt man ihr im `dragstart` den Zeiger, bricht der
     Browser den Zug sofort ab. Im Kampf ist es ungefährlich, weil
     Bewegung und Loslassen am Fenster hängen. Der Riegel gegen das
     Aufpoppen wirkt im Editor trotzdem — er hängt an
     `html:not(.pp-card-dragging)` in den Hover-Regeln selbst.
     **★ v1216 — die beiden `:has()`-Regeln sind raus.** `:has()`
     zwingt die Stil-Engine, bei jeder Änderung an einer Karte deren
     Vorfahren neu zu bewerten, und während eines Zuges ändert sich
     laufend etwas. Gebraucht werden sie nicht: `.hand-slot` ist zwar
     `position: relative`, aber ohne eigenes `z-index` kein
     Stapelkontext — das `z-index: 60` der Karte gilt direkt in der
     Handreihe. Nachgemessen mit `elementFromPoint` im Überlappbereich. `:hover` ist während eines Zuges
     nicht verlässlich: der Platz der gezogenen Karte fällt auf Breite 0
     zusammen, das DOM unter dem Zeiger wechselt mitten in der Bewegung,
     und der Zustand bleibt an einem Knoten hängen, über dem der Zeiger
     längst nicht mehr steht — dasselbe Muster, gegen das es
     `useStickyHoverFlag` gibt. Die Ablage-Erkennung stört das nicht:
     sie rechnet mit Koordinaten, nicht mit Treffern im DOM.

## ★ HERVORHEBUNGEN BEIM ZIEHEN UND HOVERN (v1219)

**Ablagezone.** Die Reihe, über der der Zeiger steht, leuchtet während
eines Zuges auf (`.pp-drop-aktiv`, inset-Schein in `--player-color`).
Der Editor machte das schon lange — als Inline-Stil an zwei Stellen;
jetzt liegt das Aussehen einmal in style.css und **beide Oberflächen**
setzen dieselbe Klasse über `setHandDragFlag(an, zielSelektor)`.

Im Duell kostet das **nichts**: `handDrag` ist genau dann gesetzt, wenn
der Zeiger in der eigenen Hand bzw. im Vorrat steht (`onMove` schaltet
dort auf Umsortier-Modus um). Die Zone weiß es also ohne eine einzige
zusätzliche Messung; die Klasse wechselt zweimal je Zug.

**Zone auf dem Brett unter dem Zeiger.** Wie in der Hand, nur
**1,14 statt 1,42** — auf dem Brett stehen die Karten dicht an dicht und
tragen Zähler, Abzeichen und Statusringe; alles darüber verdeckt mehr,
als es zeigt.

**★ v1220 — ES WÄCHST DIE ZONE, NICHT DIE KARTE** (Als Befund: keine
Wirkung bei Abilities und Areas, und tote Helden verlieren beim Hovern
ihre Ausgrauung). Alle drei hatten dieselbe Ursache: die Regel griff auf
`.board-zone > .board-card`, aber der Ability-STAPEL und die Area
zeichnen ihre Karten über eigene Bauteile statt als direktes Kind — und
der tote Held wird von `.board-zone-dead::before` verschleiert, einer
Lage INNERHALB der Zone. Die vergrößerte Karte ragte darunter hervor,
und das `z-index` auf der Karte hob sie zusätzlich über den Schleier.

Wächst die **Zone**, wächst alles darin mit — Karte, Schleier,
Versteinerung, Zähler, Abzeichen, Stapel, Area-Kunst — und die
Schichtung bleibt unangetastet. Der Zustand der Basiskarte wird damit
nicht kopiert, sondern ist schlicht derselbe. `BoardZone` vergibt
`board-zone` + `zone-has-card` für ALLE Arten (Held, Ability, Support,
Surprise, Area), eine Regel genügt also; `zone-has-card` hält leere
Zonen heraus.

**★ Gezoomt wird über die eigenständige `scale`-Eigenschaft, nicht über
`transform`.** Area-Zonen tragen bereits ein `transform:
translateY(-50%)` (teils mit `!important`); ein Hover-`transform` hätte
das weggeworfen und die Zone verspringen lassen. `scale` legt sich davor,
ohne es anzufassen — und ganz nebenbei entfällt damit die Sonderregel
für umgedrehte Karten (`.flipped`, 180°), weil deren `transform`
unberührt bleibt.

Beides ruht während eines Zuges (`.pp-dragging`, jetzt auch auf
`.board-plane`) — sonst poppt auf, worüber die gezogene Karte gerade
hinwegfährt.

## ★ EIN HANDSYSTEM FÜR BEIDE OBERFLÄCHEN (v1218)

Als Frage (18.9.): „Warum sind Puzzle-Mode-Drag/Drop und
Duell-Drag/Drop überhaupt verschieden?"

**Verschieden ist nur der EINGABEWEG.** Das Duell zieht mit eigenen
Maus-Ereignissen am Fenster — es braucht Touch-Verfolgung und
Ablageziele im 3D-gekippten Brett. Der Editor nutzt HTML5-Drag&Drop.
Die Logik darunter war dagegen zweimal dasselbe, zweimal getippt: der
Kommentar an `tropfIndex` verwies wörtlich auf `calcDropIdx`, und beide
Kopien wurden an verschiedenen Tagen gegen DENSELBEN Fehler
nachgebessert (Index-Räume 28.8., Lücken-Flackern 18.9.).

Seit v1218 liegt die Logik in app-shared und wird von beiden benutzt:

| Funktion | ersetzt |
|---|---|
| `handDropIndex(kasten, mouseX, {slots, skip})` | `calcDropIdx`, `calcCreationDropIdx`, `tropfIndex` |
| `handMove(liste, von, nach)` | die Splice-Blöcke in `onUp` und `sortiereUm` |
| `handItemsWithGap(liste, dragIdx, dropIdx)` | die Lücken-Konstruktion in `displayHand` |

Dazu, schon seit v1210–v1217 gemeinsam: `applyHandTilt` /
`clearHandTilt`, `setHandDragFlag`, `playCardDragSFX` und die
Hover-Regeln in style.css.

**Die Index-Räume stehen damit an EINER Stelle** — die Falle, in die
beide Oberflächen schon einmal getappt sind: `handDropIndex` zählt
OHNE die gezogene Karte (0..n), `handMove` rechnet deshalb nichts ab,
und `handItemsWithGap` addiert die `+1` für die Anzeige, in der die
Karte noch drinsteht (ihr DOM-Knoten wird für die Touch-Verfolgung
gebraucht). Abgesichert durch `node test-hand.js`-artige Prüfungen der
Invariante „Vorschau = Ergebnis" über alle Kombinationen.

**Was BEWUSST nicht vereinheitlicht wurde:** der Eingabeweg. Das Duell
schreibt bei jeder Mausbewegung Zustand und rendert damit das ganze
Brett neu; den Editor auf dieselbe Mechanik zu heben hieße, genau diese
Schwäche in die Oberfläche zu tragen, die heute sauber läuft — und der
Editor zieht mehr als Hände (Galerie → Brett, Zone → Zone), er bekäme
also zwei Mechaniken statt einer.

## ★ NACH DEM HAND-FLUG SOFORT ABGLEICHEN (v1221)

Als Befund (18.9.): „Wenn man Dive Down benutzt, erscheint die Karte
nach ihrer Move-from-hand-to-discard-Animation für einen Moment wieder
in der Hand."

Der Client verdeckt den Startplatz einer abfliegenden Handkarte, aber
**nur solange die Hand noch so groß ist wie beim Abflug** — der
Schlüssel trägt die Handgröße (v1063), die Verdeckung fällt also von
selbst weg, sobald der nächste `sync` die Hand kürzt. Ein Zeitgeber ist
nur der Notnagel für Flüge, nach denen die Hand gar nicht schrumpft.

Mit 700 ms war dieser Notnagel aber die Regel statt die Ausnahme:
Reaktionen schicken den Flug los und öffnen **danach** erst ihr
Kettenfenster. Bis der nächste `sync` kommt, vergeht länger — der
Zeitgeber hob die Verdeckung auf, während die Karte im Zustand noch in
der Hand lag, und da stand sie dann wieder. Im Puzzle-Modus fällt es am
meisten auf, weil dort die Gegnerhand offen liegt.

Zwei Hebel, beide gezogen:
* **Client:** Notnagel auf 4 s. Länger verdeckt bleibt dadurch nichts —
  der Schlüssel passt nicht mehr, sobald die Hand kürzer wird.
* **Kartenskripte:** nach `hand.splice(…)` **`engine.sync()`** rufen.
  Das Bild soll nicht an einer Wartezeit hängen. Der Flug geht weiterhin
  VOR dem Splice raus (Startplatz muss noch existieren, siehe
  „FLUG-ZIELFELDER"), der Abgleich direkt danach.

**★ v1222 — GRÜNDLICH NACHGEZOGEN** (Als Vorgabe: „zieh die noch nach,
ich möchte das gründlich gefixt haben"). Alle Hand-Abgänge mit Flug
sind durchgegangen — **31 Stellen** in Engine und Kartenskripten:

* **20 hatten schon einen Abgleich**, er lag nur außerhalb meines
  ersten 14-Zeilen-Suchfensters. An 9 Stellen hatte ich deshalb
  zunächst einen doppelten eingesetzt und wieder entfernt: wo der
  vorhandene `sync()` auf demselben Weg und derselben Ebene folgt,
  braucht es keinen zweiten. Behalten habe ich ihn dort, wo ein
  bedingter Ausstieg dazwischenliegt und der spätere Abgleich also
  übersprungen werden kann.
* **11 Stellen** bekamen einen — und zwar an der jeweils richtigen
  Stelle, nicht stumpf hinter dem Splice:
  * Wo direkt danach ins Ablage-Routing geschrieben wird, steht der
    Abgleich **dahinter**. Sonst sähe der Client zwei Schritte statt
    einem und startete einen zweiten Flug vom Brett — das ist der
    Vertrag, der dort im Kommentar steht.
  * Bei „Tempeluna" (Hand → Support Zone) **nach** dem Belegen der
    Zone; ein Abgleich dazwischen zeigte die Karte für einen Takt
    nirgends.
* **Zentral in der Stapel-Schicht:** `_takeFromPileCore` gleicht
  Hand-Abgänge jetzt selbst ab (`if (pile === 'hand') this.sync()`).
  Damit ist jede Karte abgedeckt, die über `takeFromPile` & Co. geht —
  bewusst nur die Hand: Deck, Ablage und Gelöscht-Stapel haben keine
  solche Verdeckung, und ein Abgleich je gezogener Karte würde Such-
  und Mahl-Schleifen ohne Gegenwert vervielfachen.

**Wächter `scripts/check-hand-flight-sync.js`** hält das fest: wer
`play_pile_transfer` mit `from: 'hand'` sendet und danach aus `hand`
splict, braucht innerhalb von 30 Zeilen ein `sync()`. Wer die
Stapel-Schicht benutzt, ist ohnehin versorgt.

## ★ ATTACHMENTS ÖFFNEN KEINEN STATISTIK-DIALOG (Puzzle-Editor, v1221)

Als Befund (18.9.): „Man kann auf Attachments klicken wie auf Creatures,
aber es gibt keinerlei Buffs oder andere Parameter für Attachments,
dieses Menü ist also leer und unnötig."

Der Dialog blendet für Attachments HP, Statuseffekte UND Buffs aus — es
bleibt nichts übrig. Der Klick öffnet ihn deshalb gar nicht mehr, genau
wie bei Abilities in Support Zones (v771).

**Der SUBTYPE entscheidet, nicht der Kartentyp.** „Overheal Shock" ist
ein Spell, „Divine Gift of Coolness" ein *Attack* — beide mit Subtype
Attachment. Die Abschnitte im Dialog prüfen bis heute
`cardType === 'Spell'` und ließen die Attack-Variante durchrutschen.

Ausnahmen stehen in `PZ_ATTACHMENT_MIT_WERTEN` (app-puzzle): Attachments
mit einem EIGENEN Schalter — derzeit nur „Anti Magic" (Stufe 1–3).
„Alliance" braucht keinen Eintrag, es biegt vorher in seine eigene
Verbindungswahl ab. Von 37 Attachments öffnen damit 35 nichts mehr.

## ★ `layer: 'overAreas'` — BRETTWEITE LAGE ZWISCHEN AREA UND KARTEN (v1223)

Anlass „Pink Sky" (Als Vorgabe): „ein pinkfarbener Himmel mit weißen
Wattewolken auf dem Background-Layer (**ÜBER Area-Backgrounds**), der
für ein paar Sekunden langsam scrollt und ausfadet."

`layer: 'background'` (v1088, „Cleansing of the Land") reicht dafür
NICHT: die Animationen werden im Baum des Spielbretts gerendert, die
Area-Hintergründe liegen dagegen IN `.board-plane-clip`. Wer zwischen
beide will, muss dorthin — genauso wie der Beschwörungskreis seit v1208.

```js
engine._broadcastEvent('play_zone_animation', {
  type: 'pink_sky', zoneType: 'board', layer: 'overAreas',
  duration: 4200, owner: pi, heroIdx: -1, zoneSlot: -1,
});
```

`onZoneAnim` hängt daraufhin einen **nackten** Knoten in
`.board-plane-clip`, direkt vor `.board-plane` — also nach den
Hintergründen, vor den Karten — und räumt ihn nach `duration` wieder ab.
Der Knoten besteht aus Wurzel plus **drei freien Lagen** (`i`); was er
zeigt, steht in style.css unter `.pp-bg-anim-<typ>` (Unterstriche werden
zu Bindestrichen). Die Laufzeit kommt als `--pp-bg-dauer` mit. Jede
weitere Karte nimmt denselben Weg, ohne dass am Verteiler etwas
dazukommt.

## ★ NEUE KARTE: „Pink Sky" (v1223)

Artifact · Cute · PP MOE · **Kosten 4** (von 5 heruntergesetzt, Als
Vorgabe). „Negate the effects of all Creatures both players currently
control until the end of your opponent's next turn, except 'Cute'
Creatures."

* **★ v1224 — ARTEFAKTE HABEN EINEN EIGENEN VERTRAG.** Erst gebaut mit
  `hooks.onPlay` wie ein Zauber — Als Befund: „in der Hand nicht
  ausgegraut, aber auf Klick und Drag passiert nichts". Genau das ist
  das Bild: der Haken wird auf dem Artefakt-Weg **nie gerufen**. Ein
  Artefakt exportiert `isTargetingArtifact`, `canActivate(gs, pi,
  engine)` und `async resolve(engine, pi, selectedIds, validTargets)`
  (Muster „Blueprints" für den zielfreien Fall, „Angry Cheese" für den
  zielenden). `resolve` gibt `{ ok: true }` bzw. `{ cancelled: true }`
  zurück.
* `canActivate` verlangt mindestens EINE Kreatur, die die Karte treffen
  kann. Stehen nur „Cute"-Kreaturen (oder gar keine) auf dem Brett,
  wären die 4 Gold verloren.
* **Schablone „Anti Magic Zone"** — gleiche Dauer-Rechnung
  (`expiresAtTurn = gs.turn + 2`, `expiresForPlayer = Wirker`; aufgeräumt
  wird zu Beginn des übernächsten eigenen Zuges, und das IST das Ende
  des gegnerischen nächsten Zuges) und `actionNegateCreature` je Kreatur
  statt eines eigenen Status, damit Cardinal-Immunität, Ablauf-Sweeps
  und der `clearCountersOnExpire`-Vertrag von der Engine kommen.
  `selfInflicted: true`, weil die Karte ein globaler Effekt ist und
  „Defending the Gate" deshalb nicht auslösen soll.
* **„except 'Cute' Creatures"** läuft über `isCuteCreatureInst`
  (_cute-shared), nicht über den gedruckten Archetyp allein: eine
  Kreatur im Support einer Heldin mit „Cute Wings" ZÄHLT als Cute und
  bleibt ebenfalls verschont. Die Anführungszeichen im Kartentext sind
  genau die Schreibweise für „zählt als".
* **„This counts as a negative status effect"** braucht keine eigene
  Zeile — `negated` steht in STATUS_EFFECTS als negativ, damit greifen
  Immunitäten und Gegenmittel von selbst.
* Die verschonten Cute-Kreaturen bekommen ein eigenes kleines Wölkchen
  (`pink_sky_puff`) — sonst sähe es aus, als hätte die Karte sie
  übersehen statt sie auszunehmen. Dasselbe Bild dient als
  `spellVisual`, wenn die Karte selbst negiert wird.

## ★ GESTOHLENE KARTEN GEHEN IN DIE ABLAGE IHRES BESITZERS (v1224)

Als Befund (18.9.): „Eine durch Herbithorn Demon gestohlene und dann
gespielte Karte landet im Discard Pile (oder Deleted Pile) des Diebs
statt dem des ursprünglichen Besitzers."

Die Maschinerie dafür war vollständig — nur das Etikett fehlte:
`CardInstance.originalOwner` („never changes — for discard pile
routing"), `_consumeHandCardOrigin` liest es beim Spielen und Abwerfen,
und der Server routet an acht Stellen danach. Gesetzt wurde es aber nie,
wenn eine Karte aus einer FREMDEN Ablage auf die Hand kam.

Der Riegel sitzt jetzt in `addCardFromDiscardToHand` — dem einen Tor für
„aus der Ablage auf die Hand" (v1068), durch das jeder Ablagen-Griff
läuft:

```js
if (inst && fromOwnerIdx !== toPlayerIdx) inst.originalOwner = fromOwnerIdx;
```

Zentral und nicht in Herbithorn Demon, damit auch jede andere Karte
versorgt ist, die in eine fremde Ablage greift (neun Aufrufstellen
außerhalb der Engine). Passt zum Ruling vom 14.9. für Anhängsel: „die
Karte geht zum Discard ihres ursprünglichen Besitzers."

## ★ FLUG UND LANDUNG MÜSSEN DENSELBEN STAPEL MEINEN (v1225)

Als Befund (18.9.): „Visuell fliegt die Karte zu MEINEM Discard statt
dem des ursprünglichen Besitzers, landet dann aber immerhin dort."

Seit v1224 wählt die Landung den richtigen Stapel — der Flug nicht:

* Der **Artefakt-/Potion-Weg** schickte `owner: pi` und meinte damit
  BEIDE Enden. Jetzt `fromOwner: pi, toOwner: pileOwner`; die Herkunft
  wird vor dem Flug gelesen statt danach.
* Der **Zauber-Weg** schickte **gar keinen** Flug — der Client leitete
  ihn aus dem Zustandsunterschied ab und nahm dabei den eigenen
  Ablagestapel an. Jetzt gibt es dort einen ausdrücklichen Flug, VOR der
  Entnahme (Als Regel 17.8.) und mit beiden Enden.

Ebenso bei der **Aufnahme aus einer fremden Ablage** (Herbithorn Demon):
der Eintrag in der Galerie merkt sich jetzt, aus welcher Ablage er
stammt. **★ v1226:** Liegt eine Karte in BEIDEN Ablagen, gewinnt seit
heute die des GEGNERS — vorher zählte die eigene, weil sie zuerst
eingelesen wird, und der Flug startete dort. Regeltechnisch sind beide
Kopien dieselbe Karte („either is correct"); dem Spieler nützt die
gegnerische mehr, weil sie dem Gegner die Ressource nimmt, und sie ist
das, was man sehen will. Die ANZEIGE bleibt eigene Ablage zuerst. Vorher wurde die Quelle beim Ziehen über den NAMEN neu geraten
und dabei die eigene Ablage bevorzugt — bei gleichnamigen Karten also
falsch. Nebenbei stand dort `searchPile: 'deck'`, obwohl die Karte aus
der ABLAGE nimmt; die Such-Sperre bekam damit die falsche Quelle
gemeldet.

**Merksatz:** Wer einen Stapel per `_consumeHandCardOrigin` wählt, nennt
denselben Wert auch im Flug. Sonst zeigt die Animation eine andere
Geschichte als der Zustand.

## ★ CYCLING DEMONS: VOM DECK SICHTBAR AUFS BRETT (v1225)

Als Vorgabe (18.9.). Der Nachfolger wurde bis dahin still aus dem Deck
gezogen und stand plötzlich in der Zone. Jetzt: Flug `deck → support`
auf den frei gewordenen Platz (VOR der Entnahme, damit der Deckstapel
als Startpunkt noch steht), 520 ms Flugzeit, dann die normale
Beschwörungsanimation aus `summonCreatureWithHooks` — und `takeFromPile`
mit `shuffle: true`, was die Misch-Animation des Decks auslöst.

## ★ DIE GEISTERKARTE HÄNGT AM GRIFFPUNKT (v1225)

Als Befund (18.9.): „Wenn ich im oberen Drittel geklickt habe, halte ich
die Kopie plötzlich an ihrem unteren Drittel fest; bei Diamond-Karten
liegt sie deutlich ÜBER dem Cursor."

Der Geisterkarte lag ein FESTER Versatz von 32/45 zugrunde — die halbe
Karte bei Maßstab 1. Damit hängt sie erstens immer an ihrer Mitte statt
am Griff, und zweitens stimmt selbst die Mitte nicht, sobald
`--board-scale` oder der Kartenrahmen davon abweichen. Der Griff wird
jetzt EINMAL beim Drücken gemessen (`griffX`/`griffY`) und über alle
drei Ziehzustände mitgeführt.

**★ v1226 — GEMESSEN WIRD DER PLATZ, NICHT DIE KARTE.** Der erste
Anlauf maß den Kasten der KARTE — und der ist im Moment des Drückens
**hervorgehoben**: 1,42-fach und 18 px angehoben (Hover-Highlight seit
v1214). Gemessen: Kasten 127×179 statt 90×126 und um 63 px nach oben
verschoben, ein Griff im oberen Fünftel kam damit als (64, 88) heraus —
fast die volle Kartenhöhe, also „ich halte sie am unteren Drittel fest".
Jetzt liefert der PLATZ (`.hand-slot` / `.creation-slot`, nie
transformiert) die Lage und `offsetWidth/offsetHeight` der Karte die
Größe; beide sind vom `transform` unberührt. Dieselbe Trennung wie bei
der Handneigung seit v1210. Nachgemessen: Zeiger auf 20 % Kartenhöhe →
Griff (45, 25) auf 90×126.

## ★ VERZÖGERTER EFFEKT ≠ VERZÖGERTES ERSCHEINEN (v1227)

Als Befund (18.9.): „Während des Delays zwischen Bewegungsanimation und
Galerie ist er unsichtbar. Er sollte sichtbar sein, und seine
Beschwörungsanimation sollte auch schon spielen — NUR die Galerie
sollte delayed sein."

Der Dämon stand zu dem Zeitpunkt längst im Zustand, aber der Client
hatte ihn noch nicht gesehen: die Platzierung läuft in
`summonCreatureWithHooks`, und der nächste Abgleich kam erst NACH dem
Bonus. Gewartet wurde also vor einer leeren Zone.

**Merksatz: erst `engine.sync()`, dann `_delay`, dann der Dialog.** Wer
eine Pause vor einem Prompt einlegt, gleicht vorher ab — sonst wartet
der Spieler vor einem Zustand, den er nicht sieht, und die
Beschwörungsanimation läuft ins Leere.

## ★ DER STAPELKOPF VERSCHWINDET BEIM ABFLUG (v1227)

Als Befund: „Wählt man die OBERSTE Karte eines Discards, bleibt sie
sichtbar, während eine Kopie zur Hand fliegt."

Für den umgekehrten Weg — Karte fliegt IN die Ablage — gibt es die
Verdeckung des Stapelkopfs längst (`setMyDiscardHidden` & Co.); für den
Abflug fehlte sie. `onPileTransfer` verdeckt jetzt auch dort, aber nur
wenn die fliegende Karte WIRKLICH obenauf liegt — sonst ist am Stapel
nichts zu sehen, was verschwinden müsste. Gilt für `discard` und
`deleted`, beide Seiten.

## ★ KARTENGALERIE: SUCHFELD UND HERKUNFTS-MARKE (v1227)

* **Suchfeld** ab acht Einträgen (darunter sieht man alles auf einen
  Blick, und ein Feld über vier Karten ist nur Rand). Gefiltert wird
  nach Name UND `label`, „opp" sammelt also gleich die gegnerische
  Ablage ein. Der Zustand liegt in `GameBoard`, nicht im Galerie-Rumpf —
  der ist eine sofort ausgeführte Funktion in JSX, dort sind Haken nicht
  erlaubt. Ein neuer Dialog startet mit leerem Feld.
* **Herkunft:** `entry.label` ersetzt das Quellen-Abzeichen (v862) — der
  Platz war da, wurde aber nie benutzt. Herbithorn setzt jetzt `YOURS`
  bzw. `OPPONENT`. Kurz halten: das Abzeichen ist ein schmaler Streifen
  unter der Karte.
* **★ v1228 — `entry.labelSide: 'me' | 'opp'`** färbt die Marke in der
  jeweiligen Spielerfarbe (`me.color` / `opp.color`). Die Karte schickt
  nur die SEITE — welche Farbe das ist, weiß nur der Client.

## ★ JEDE KARTE, DIE AUF DER HAND LANDET, KLINGT WIE EIN ZUG (v1228)

Als Vorgabe (18.9.): „Der Kartenflug Discard → Hand hat noch keinen
Sound. Der sollte allgemein immer, egal durch welchen Effekt, denselben
Sound in derselben Lautstärke machen wie ein Draw."

`onPileTransfer` spielte den Zug-Klang nur bei `from === 'deck'`. Jetzt
bei jedem Flug auf die Hand — außer der Aufrufer hat mit `sfx` einen
eigenen Klang mitgeschickt, sonst gäbe es zwei. Gleiche Lautstärke und
dieselbe Entprellung wie beim echten Zug.

## ★ VERDECKUNG ENDET AM ZUSTAND, NICHT AN DER UHR (v1228)

Als Befund: „Gegen Ende der Fluganimation blitzt kurz eine weiter unten
gelegene Karte des Discard Pile auf, als wäre sie nach oben gerutscht."

Die Verdeckung des Stapelkopfs (v1227) lief auf einer Uhr. Kam der
Abgleich FRÜHER als sie, war der Stapel schon kürzer UND es wurde
weiterhin eine Karte verdeckt — sichtbar wurde die Karte DARUNTER, bis
die Uhr ablief. Jetzt wacht die Stapellänge: wird ein Stapel kürzer, ist
sein Kopf ohnehin weg und jede Verdeckung hat sich erledigt. Nur beim
SCHRUMPFEN — eine Karte, die IN den Stapel fliegt, muss verdeckt
bleiben, bis sie landet. Die Uhr bleibt als Notnagel (1,2 s).

**Das Muster ist dasselbe wie beim Hand-Flug (v1221/v1222):** eine
Verdeckung endet am Zustand, der sie überflüssig macht — eine Frist ist
nur der Notnagel für den Fall, dass dieser Zustand nie eintritt.

## ★ IM EDITOR ZIEHT JEDE KARTE MIT GEBAUTEM ZIEHBILD (v1228)

Als Befund: „Spezifisch im Puzzle-Editor und spezifisch NUR
Diamond-Rare-Karten werden beim Drag/Drop deutlich ÜBER dem Cursor
angezeigt."

Die Handreihen riefen `setDragGhost` gar nicht — der Browser baute sein
Ziehbild dann selbst aus dem Quellelement. Für eine normale Karte passt
das ungefähr; eine Diamond Rare trägt aber einen pulsierenden Schein
(`box-shadow` bis 12 px, im Hover 20/40 px), und der gehört zum gemalten
Umfang. Das Abbild wurde dadurch deutlich höher als die Karte, der
Zeiger saß entsprechend weit unten darin. Secret Rares traf es
schwächer, deshalb fiel es nur bei Diamond auf.

Jetzt bekommt jeder Zug dasselbe gebaute Bild (60×84, ohne Schein) —
und den Griffpunkt gleich mit, gemessen über den Layout-Kasten
(`offsetLeft/Top/Width/Height`), der von Hover-Vergrößerung und Neigung
unberührt bleibt. Gleiche Trennung wie im Duell seit v1226.

## ★ ZUSTANDSWACHEN GEHÖREN VOR DAS ZEICHNEN (v1229)

Als Befund: „Es kann nach wie vor zu einem — deutlich kürzeren —
Aufblitzen kommen, allerdings auch nicht immer."

Die Längenwache aus v1228 hing an `useEffect`, und der läuft **nach**
dem Zeichnen. Genau ein Bild lang stand damit der gekürzte Stapel MIT
der alten Verdeckung im Bild, und man sah die Karte darunter. Dass es
„nicht immer" auftrat, passt: es hängt daran, ob Abgleich und Bild im
selben Takt zusammenfallen.

**Regel: Wer eine Verdeckung, Maske oder Position aus dem Zustand
NACHFÜHRT, nimmt `useLayoutEffect`.** `useEffect` ist für Arbeit, die
der Betrachter nicht sieht (Klänge, Netzwerk, Protokoll).

## ★ WAS BEIM HOVERN WEICH WANDERN DARF (v1229)

Als Befund: „Wenn ich sehr schnell zwischen Karten hin- und herhovere,
fühlt es sich laggy an, und einzelne Karten werden kurz sehr dunkel."

Zwei getrennte Ursachen:

* **Der Übergang war zu breit.** Mitbewegt wurde auch `box-shadow` —
  dessen Schein hat 42 px Unschärfe. Ein weicher Schatten lässt sich
  nicht im Compositor verschieben, er muss JEDES BILD neu gezeichnet
  werden, und beim schnellen Wechsel laufen mehrere solcher Übergänge
  gleichzeitig. Jetzt wandert nur noch `transform` weich; Rand und
  Schein springen an und aus — das sieht man nicht, spart aber die
  Zeichenarbeit. Der schwarze Schlagschatten ist zusätzlich von 22 px /
  65 % auf 12 px / 45 % zurück.
* **Das Dunkle war der Schleier gesperrter Karten.** Eine nicht
  spielbare Handkarte trägt `rgba(12,12,20,.7)`; unter dem Zeiger wird
  sie 1,42-fach vergrößert, der Schleier wächst mit und legt sich über
  die Nachbarn. Beim schnellen Hin- und Herfahren wandert so ein
  dunkler Block durch die Hand. Unter dem Zeiger ist der Schleier jetzt
  deutlich dünner (0,28) — das löst den Eindruck auf, und man kann die
  Karte, die man gerade anschaut, auch lesen, wenn man sie nicht
  spielen kann.

## ★ DER ZIEH-RIEGEL FÄLLT ERST MIT DER NÄCHSTEN MAUSBEWEGUNG (v1230)

Als Befund (18.9.): „Ändert man per Drag/Drop die Reihenfolge der Karten
in der Hand im Puzzle-Editor, wird nach dem Drop die Karte an dem Index,
den zuvor die bewegte Karte hatte, kurz größer."

Das ist **eingefrorenes `:hover`**. Während eines HTML5-Zuges schickt
der Browser keine Mausbewegungen — der Hover-Zustand bleibt auf dem
Knoten stehen, über dem der Zeiger beim Aufnehmen stand, also auf dem
Platz der GEZOGENEN Karte. Nach dem Ablegen sitzt dort eine andere Karte
(die Plätze sind positionsgebunden), und im selben Augenblick fiel der
Zieh-Riegel `.pp-dragging` — die falsche Karte poppte auf.

**Im Duell tritt es nicht auf**, und das ist die Bestätigung der
Diagnose: der eigene Maus-Zug schickt laufend Bewegungen, der
Hover-Zustand ist dort also aktuell. Genau derselbe Unterschied wie bei
der Geisterkarte (v1226/v1228) — zwei Eingabewege, eine gemeinsame
Logik.

Der Riegel wird deshalb erst mit der nächsten echten Mausbewegung
gelöst (`mousemove` / `touchstart`, einmalig), dann hat der Browser den
Hover neu bewertet.

**★ v1231 — ES DARF NUR EINE STELLE LÖSEN.** v1230 allein half nicht,
und der Grund war nicht die Diagnose, sondern eine zweite Stelle: im
Rumpf des Zieh-Effekts stand `setHandDragFlag(dragCardName != null)` —
also auch das Lösen. Endet ein Zug, läuft erst die Aufräumfunktion (die
verzögert lösen will) und unmittelbar danach dieser Rumpf mit `false`.
Die Verzögerung war damit wirkungslos. Der Rumpf **setzt** jetzt nur
noch; gelöst wird ausschließlich über `ziehRiegelLoesen`.

**Und ohne Uhr.** Eine Frist löst den Riegel irgendwann von selbst — und
wenn der Zeiger bis dahin stillsteht, ist der Hover immer noch
eingefroren, die falsche Karte poppt also nur später auf. Bleibt der
Zeiger liegen, bleibt der Riegel eben stehen: sichtbar ist das nicht,
denn ohne Bewegung gibt es auch nichts hervorzuheben. Das ist der
Unterschied zu den Verdeckungen (v1228/v1229), wo die Uhr als Notnagel
sinnvoll ist: dort beseitigt ein ZUSTAND den Grund, hier eine
BEWEGUNG — und auf die kann man beliebig lange warten.

## ★ VON AUSSEN GESETZTE ZUSTÄNDE GEHÖREN NICHT IN `className` (v1232)

Als Befund, dritter Anlauf zum „Aufploppen nach dem Drop": „Auch das hat
es noch nicht gefixt."

Die eigentliche Ursache lag unter beiden vorherigen Anläufen. Der
Zieh-Riegel war eine **Klasse** an den Handreihen (`.pp-dragging`,
gesetzt von `setHandDragFlag`) — und `className` gehört React. Im
Editor steht dort:

```jsx
className={'pz-hand-cards' + (dragOverZone === 'hand' ? ' pp-drop-aktiv' : '')}
```

Der Wert **ändert sich während des Zuges** (`dragOverZone` wechselt bei
jedem Überfahren), React schreibt das Attribut also neu — und wischt
dabei jede von außen gesetzte Klasse weg. Der Riegel war damit die
meiste Zeit gar nicht da; meine Arbeit an Zeitpunkten (v1230) und an der
doppelten Löse-Stelle (v1231) war richtig, lief aber ins Leere.

**Im Duell steht dort ein fester String** (`className="game-hand-cards"`).
React fasst das Attribut nach dem Einhängen nie wieder an, die Klasse
überlebte — genau deshalb trat der Fehler NUR im Editor auf, und das
war die ganze Zeit der entscheidende Hinweis.

Gemessen, drei React-Renders während eines Zuges:

| Träger | nach den Renders noch da? | Karte |
|---|---|---|
| Klasse `.pp-dragging` | **nein** | 128 px (poppt) |
| `data-pp-dragging` | ja | 90 px |

**Regel: Was von außen an ein von React gerendertes Element gehängt
wird, gehört in ein Datenattribut, das in keinem JSX steht.** React
verwaltet nur, was es selbst schreibt — `className` und `style` also
nicht anfassen, `data-*` dagegen bleibt unberührt. Gilt für
`data-pp-dragging` und `data-pp-drop`; der Editor setzt seine
Ablagezonen-Markierung weiter über React (`.pp-drop-aktiv`), die
CSS-Regel akzeptiert beide Schreibweisen.

## ★ DIE HAND IST GEFÄCHERT — WER SIE MISST, MISST ÜBER `handFanCardBox` (v1233)

Seit v1233 stehen alle vier Handreihen (Duell eigen/gegnerisch, Editor
eigen/gegnerisch) leicht aufgefächert: jede Karte trägt einen Winkel,
die Reihe einen flachen Bogen. Gerechnet wird das an einer Stelle —
`handFanGeometry` / `handFanStyle` in `app-shared.jsx` —, angewandt in
style.css („DAS HANDFÄCHER").

Drei Dinge daran sind Vertrag, nicht Geschmack:

**1. Der Handplatz (`.hand-slot`) wird NIE gedreht.** Er trägt nur den
Bogen (`translate`). Ein gedrehter Kasten liefert
`getBoundingClientRect` nur noch seinen achsenparallelen Hüllkasten —
breiter und höher als die Karte, linke obere Ecke daneben. Rund ein
Dutzend Flüge im Kampfbrett bestimmt seinen Landepunkt genau so.

**2. Wer eine Handkarte misst, nimmt `window.handFanCardBox(el)`, nicht
`getBoundingClientRect()`.** In Gegner-, Zuschauer- und Editorhand gibt
es keine Platz-Hülle, dort dreht die Karte selbst — und ihr Hüllkasten
ist bei 9° rund 6 px zu breit und 8 px zu hoch. Der Helfer rechnet den
echten Kasten zurück (Mitte bleibt unter einer Drehung um die Mitte
erhalten, Breite/Höhe über das Gleichungspaar des Hüllkastens) und gibt
den Winkel als `rot` mit — fliegende Karten drehen sich damit im Flug
in ihre Landelage, statt beim Ankommen zu springen. Bei einem Handplatz
gibt er unverändert dessen Kasten zurück, der Aufrufer muss die Seiten
also nicht unterscheiden.

**3. Der Abstand von Platz zu Platz ist gleich der Platzbreite.**
`.game-hand-cards` hat kein `gap`; die Überlappung kommt aus der
Flex-Basis (`--fan-pitch`, 58 px bei 64 px Karte). Drei Flüge
projizieren den Platz einer noch nicht existierenden Karte mit genau
dieser Gleichsetzung („die Hand ist zentriert, eine Karte mehr rückt
die Reihe"). Wer den Abstand künftig über negative Ränder oder `gap`
ändert, verstimmt diese Projektionen still.

**Hand UND Stapel sind größer als Brettzonen (v1234/v1235).** Nicht
64×90, sondern `--hand-card-w` / `--hand-card-h` (64×90 ×
`--hand-card-scale`, derzeit 1.44). Grund: die Brettebene ist gekippt
und um 1.26 gezoomt, ihre Karten erscheinen dadurch zwischen 0.90× und
1.44× — eine ungetrimmte Handkarte wirkte daneben kleiner.

**Ab v1251 haben die Stapel ihren EIGENEN Maßstab**
(`--pile-card-scale`, derzeit 1.44) und sind damit kleiner als die
Hand: die Handkarten sind seither zweimal gewachsen, die Ränder
sollten es nicht. Eine Karte zwischen Hand und Stapel ändert dabei
ihre Größe — bewusst so, `--ptScale` fährt es weich.

Zuvor (v1235–v1250) trugen dasselbe Maß auch **Deck, Potion-Deck,
Ablage und Gelöscht-Stapel** (`--pile-zone-w/h` für die Zone, `--sidebar-w` für
die Spalte — beide aus dem Kartenmaß abgeleitet). Damit gilt: **eine
Karte, die zwischen Hand und einem dieser Stapel unterwegs ist, wird
auf dem Weg nicht mehr skaliert.** Nur Brettzonen (Held, Support,
Ability, Surprise, Area) bleiben bei 64×90.

Und die AREA-ZONEN (v1237): sie liegen auf der Faltlinie zwischen den
Feldhälften und haben dort Luft, also tragen sie dasselbe Maß. Ihr
Standplatz zwischen den Heldengruppen (`.board-area-spacer`) wächst
mit, sonst ragte die breitere Zone in die Nachbarspalten — und der
Maßstab rechnet diesen Zuwachs in seinen Bezugswert ein.

Dasselbe Maß tragen die HANDREIHEN UND STAPEL DES PUZZLE-EDITORS
(v1236) — dort sind Hand und Stapel dieselben Orte, also auch dieselbe
Größe — und jede Zieh-Darstellung: die schwebende Karte im Duell
(`.hand-floating-card > .board-card`), das HTML5-Ziehbild des Editors
(nimmt die Größe seiner Quellkarte) und das Touch-Ziehbild. Eine Karte
ändert ihre Größe beim Greifen also nicht mehr.

Wer einen Flug baut, nimmt deshalb das Maß seiner QUELLE und lässt
`--ptScale` (Ziel ÷ Quelle) den Rest machen — so macht es der
`play_pile_transfer`-Handler; Zieh-Animation, Zieh-Lücke und der
Abwurfflug aus der Hand (`.discard-anim-hand`) hängen ebenfalls am
Handmaß. `--hand-min-h` leitet sich davon ab, die Leiste wächst also
mit, und der Brett-Maßstab rechnet Leistenhöhe wie Spaltenbreite in
EINEM Schritt ein (`updateScale`, app-board.jsx) statt sich
einzupendeln.

**VERDECKTE Gegnerkarten stehen auf dem Kopf (v1238/v1240).** Sie
tragen `180deg` ZUSÄTZLICH zum Fächerwinkel, damit sie vom Gegner aus
richtig herum stünden. Am Fächer ändert das nichts Sichtbares (eine
Karte ist 180°-symmetrisch), am Bild alles. Die Regel hängt an
`.face-down`: AUFGEDECKTE Karten (`revealed-hand-card`) bleiben
aufrecht und damit lesbar. Der Puzzle-Editor bleibt ganz aufrecht —
dort wird gebaut, nicht gespielt, und seine Handkarten tragen das volle
Duellmaß ohne `--board-scale` (v1240).

**Wie die Hand mit Enge umgeht (v1241/v1242).** In dieser Reihenfolge:
erst schieben sich die PLÄTZE zusammen (`flex-shrink` bis
`--hand-min-anteil`, derzeit 0.34 — höchstens 66 % Überdeckung), dann
erst scrollt die Reihe. Entscheidend ist, dass der Platz schrumpft und
die KARTE darin ihre Maße behält: schrumpft der Kartenkasten selbst,
schneidet `object-fit: cover` die Seiten weg. Im Editor ist die Karte
deshalb seit v1242 in `.pz-hand-card-inner` verpackt — außen der Platz,
innen die Karte, genau wie `.hand-slot` und `.board-card` im Duell (`overflow-x: auto` +
`justify-content: safe center`, damit der Anfang erreichbar bleibt).
Damit das Flex-Layout die wahre Breite kennt, ist der LETZTE Platz so
breit wie seine Karte, nicht wie der Abstand. Die linke Karte liegt
über der rechten (`--fan-z`, absteigend; auf der Gegnerseite
gespiegelt). Und die Reihe sinkt um ein Drittel dessen ab, was der
Bogen oben aus der Leiste hinausschiebt (`--hand-max-lift` →
`--hand-ueberstand`).

**Die Gegnerhand fächert nur zu einem Drittel (v1244,
`FAECHER.gegnerAnteil`)** — Winkel wie Bogen. Ihre Karten sind
Information, keine Bedienfläche, und ein voller Fächer wirkte dort zu
laut. Wer den Höchsthub abfragt (`handFanMaxLift`), muss die Seite
mitgeben, sonst senkt sich die Reihe um einen Überstand, den sie gar
nicht hat.

**Der Bogen des Fächers ist ein ANTEIL DER KARTENHÖHE, keine
Pixelzahl (v1240), und seine Form hat einen Exponenten (v1246:
`bogenSchaerfe`, oben flacher, zu den Rändern steiler).** `--fan-lift` kommt einheitenlos aus
`handFanGeometry` und wird in style.css mit `--hand-card-h`
multipliziert. Die feste Zahl davor war bei zwei Größenänderungen
zurückgeblieben — 10 px sind auf einer 90er-Karte ein Bogen, auf einer
130er eine schiefe Treppe.

**Und eine Lehre aus derselben Runde, die über Karten hinausgeht:
gemessen und gesetzt wird im SELBEN Raum.** Die Position der
Area-Zonen kam aus `getBoundingClientRect` (projizierter Raum des
gekippten Bretts), minus einer Layout-Breite, geschrieben als `left`
(wieder Layout). Drei Räume in einer Zeile — und weil die Projektion um
den mittleren Helden arbeitet, verzog sie die beiden Zonen ungleich
(11 px). Jetzt läuft die Rechnung in Layout-Koordinaten
(`offsetLeft`-Kette bis zur Brettebene) plus `--center-offset`, den die
Heldenzeilen als Transform tragen und der Area-Kasten nicht.

**Und: der Fächer liegt in `translate` / `rotate`, nicht in
`transform`.** Zustände wie `.hand-pick-selected` (+6 px),
`.blind-pick-selected` (+8 px) oder die Materialize-Animation schreiben
`transform` auf denselben Knoten. Die eigenständigen Eigenschaften
werden davor angewandt und komponieren mit allem, was dort steht —
ein neuer Zustand erbt den Fächer damit automatisch, statt ihn
überschreiben zu müssen.

## ★ AKTIVE EFFEKTE KOSTEN NUR DANN EINE AKTION, WENN SIE ES SAGEN (Als Regel 7.9. — MANDATORY)

> Al 7.9.: „Aktive Effekte (Hero, Creature) kosten NUR eine Action, wenn
> sie das explizit sagen."

Die Engine ist so gebaut — ein Helden-Effekt (`heroEffect: true` +
`onHeroEffect`) und ein Kreatureneffekt (`onCreatureEffect`) sind
AKTIONSFREI. Eine Aktion kosten sie erst durch die ausdrücklichen
Opt-ins `heroEffectActionCost: true` bzw. `creatureActionCost`, und die
setzt man NUR, wenn der Kartentext es sagt („as an Action", „use this
Hero's Action"). Ein „You may once per turn …" ohne solchen Zusatz ist
frei; die Einmal-pro-Zug-Sperre macht die Engine (HOPT). Wer eine
Aktion verlangt, wo der Text keine nennt, baut die Karte falsch.

## ★ KEIN DIREKTES SPLICEN AN DECK UND ABLAGE (Als Regel 7.9. — MANDATORY)

> Al 7.9.: „Direktes Splicen ist verboten; alle Search/Add/Draw/Discard/
> Summon-Effekte nutzen vorhandene Funktionen."

`ps.mainDeck.splice(…)`, `ps.discardPile.splice(…)`, `ps.deletedPile.splice`
gehören NICHT in ein Kartenskript. Die Stapel sind Engine-Zustand mit
Sperren (Knight of Kings [B] `pileOutAllowed`, Stab-Sperre
`_discardOutAllowed`), Deckkopf-Sichtbarkeit, Lethe-Stempeln, Tracking,
Flug-Animationen und Log — ein direkter Splice umgeht alles davon.
Wächter: `node scripts/check-no-splice.js` (Ratchet gegen
`scripts/no-splice-baseline.json`; jede Migration senkt die Zahl, dann
`--update`; Exit 1, sobald eine Datei NEU oder MEHR spliced).

**Die Stapel-Schicht (v820) — EIN Ausgang, dünne Komposita:**

| Wirkung | Primitive |
|---|---|
| Karte aus Deck/Ablage/Gelöscht/Hand ENTNEHMEN (Gates, Deckkopf, Untracking, Log) | `await engine.takeFromPile(pi, pile, name \| index, { source, sourceOwner, last, shuffle })` → `{ name, idx }` \| null |
| Rückgabe nach Fehlschlag | `engine.returnToPile(pi, pile, name, idx?)` |
| Kreatur aus Hand/Deck/Ablage BESCHWÖREN | `await engine.summonFromPile(pi, pile, name, heroIdx, slot, { source, hookExtras })` → Instanz \| null |
| Kreatur aus Hand/Deck/Ablage PLATZIEREN | `await engine.placeFromPile(pi, pile, name, heroIdx, slot, { source })` → Instanz \| null |
| Deck/Ablage/Gelöscht → HAND (Deck = Tutor mit Reveal) | `await engine.addFromPileToHand(pi, pile, name, opts)` → bool |
| Deck/Ablage → GELÖSCHT | `await engine.deleteFromPile(pi, pile, name, { source })` → bool |
| Oberste N ansehen / entnehmen | `engine.revealTop(pi, n)` / `await engine.takeTop(pi, n, { source })` |
| Deck-innere Umsortierung (keine Bewegung) | `engine.reorderDeck(pi, namesTopFirst)` |
| Ziehen | `engine.actionDrawCards(pi, n, opts)` |
| Mill | `engine.actionMillCards(pi, n, opts)` |
| Zonenwechsel einer getrackten Instanz | `engine.actionMoveCard(inst, toZone, heroIdx, slot, opts)` |
| Handkarte abwerfen | `engine.actionDiscardHandCard(pi, name, handIdx, opts)` |
| Spell sofort gießen (Hand/Deck) | `engine._castSpellImmediately(pi, heroIdx, name, { fromZone, pool, poolIndex })` |
| Hand ODER Deck wählen → platzieren/beschwören | `_of-kings-shared`: `collectHandAndDeck` → `pickFromHandOrDeck` → `placeFromHandOrDeck` / `summonFromHandOrDeck` |

Komposita legen die Karte bei Fehlschlag ZURÜCK und geben null/false;
`takeFromPile` sendet keinen Flug — das Ziel entscheidet (`play_pile_
transfer` from/to). Fehlt für einen Ablauf wirklich eine Primitive
(Deck → Ausrüstungszone, Deck → Area): `takeFromPile` + Ziel-Primitive,
und die Lücke Al melden — nie ein Splice.

Stand v821: ALLE Kartenskripte laufen über die Schicht — 136 Stellen in
108 Dateien migriert, Baseline von `check-no-splice.js` steht auf 0.
Migrationsformen, damit neue Karten dieselbe Sprache sprechen:
- Entnahme → `const taken = await engine.takeFromPile(ps, pile, nameOrIdx,
  { source: CARD_NAME[, shuffle: true][, last: true] }); if (!taken) <bail>;`
  — `ps` oder `pi`, beides geht; Ergebnis `{ name, idx }`.
- Kontexte ohne `await` (CPU-Bewertungsproben, Sync-Helfer) →
  `takeFromPileSync` (Stab-Sperre gilt dort hart, kein Freikauf-Prompt).
- Rückschieben an dieselbe Stelle (Bewertungsprobe, geplatzte
  Beschwörung) → `engine.returnToPile(ps, pile, name, idx)` (mit Index:
  exakt zurück, kein Mischen; ohne: ans Ende + Mischen).
- Oberste N weg → `takeTop`; Umsortieren → `moveWithinDeck` / `reorderDeck`.
- Gegnerstapel (Cybug BEE, Pusher, Infiltration) → `sourceOwner: pi`
  mitgeben: der Bewegende ist der Wirkende, nicht der Stapelbesitzer.
- `takeFromPile` untrackt die verwaiste Ablage-/Gelöscht-Instanz selbst;
  wer die Karte danach neu zont, legt mit `_trackCard` eine frische an.

## ★ „OF KINGS" — SCHACH-ARCHETYP (v818) UND DIE ENGINE-VERTRÄGE, DIE ER GEBRACHT HAT

Geteiltes Modul `_of-kings-shared.js` (Familie, Namensauflösung,
Adjazenz, Deckung, Level-Reduktion, Hand-oder-Deck-Wahl). Die 16 Karten
stehen als Vorbilder; die neuen Verträge gelten allgemein:

**Engine-Patches in `_createContext` (Lehre v822):** die ctx-Methoden
(`promptDamageTarget`, `promptMultiTarget`, …) sind Objekt-Literale im
Rumpf von `_createContext` — dort ist die Engine `engine`, NICHT `this`.
Ein `this._boardGuardsCreatureChoice(...)` warf in v818 still „is not a
function", jede Attack/jeder Spell mit Kreaturzielen fizzelte und jede
Kreaturaktivierung mit Zielwahl scheiterte; AoE (ohne Zielprompt) lief
weiter. Headless-Proben ohne Kreaturziele sahen es nicht; ein Selfplay-
Lauf (`PP_NETTEST=1 node server.js`) sah es sofort. Deshalb: vor jedem
Paket ein Netbench-Lauf, nicht nur die Headless-Proben.

**Kopienfamilie `[B]`/`[W]` (Al 6.9.):** `Name [B]` und `Name [W]` sind
DIESELBE Karte. Kopienlimits zählen im Deckbuilder über den Namensstamm
(`copyFamilyKey`, app-shared.jsx); Namensbezüge treffen als Teilstring
beide Farben. Bilder: `X.png` (schwarz) und `X.1.png` (weiß) — Zuordnung
in `/api/cards/available`, NICHT umbenennen. `maxCopies` steht in
cards.json (Pawn: 8 über beide Farben ZUSAMMEN).

**Wahl bei freiem Haupt-Slot (Ruling 7):** „You may sacrifice … to make
this count as an additional Action" — die Karte ist inhärent, sobald ein
Ziel existiert; bei FREIEM Haupt-Slot (`mainActionSlotFree`) bekommt der
Spieler die Wahl. „Nein" → `gs._spellForcesActionConsume = true`
(Curse-Vertrag, Spells) bzw. Big-Gwen-Form für Kreaturen
(`beforeSummon` + `gs._summonModeUpgradedToInherent`). Gate to the
Armory ist darauf umgestellt. `gs._spellFreeAction` gibt seit v818 auch
den HAUPT-Slot zurück (vorher nur Zusatzaktions-Quellen — Fire Bolts und
Cool Rescue liefen deshalb in eine stehende Phase).

**„Unaffected" dynamisch — Brett-Wächter:** ein Skript einer Brettkarte
(Area oder Support) exportiert `guardsCreatureFromOpp(engine, inst,
sourceOwner, source, guardInst) → bool` und/oder
`guardsCreatureChoice(engine, inst, choosingPi, guardInst) → bool`. Die
Engine liest sie in `isOppEffectImmuneFrom` / `isOppDamageImmuneFrom`
(dieselben Stellen wie Sparkfly Attendants Aura: Zerstören, Negieren,
Status, Schadensbatch) bzw. in beiden Zielsammlern. Truth-Seeing Eye
umgeht über `ignoreUntargetable` NUR das Wählen, nie „unaffected"
(Ruling 6). Board of Kings: Deckung durch niedrigeren Nachbarn in der
9er-Reihe, nicht rekursiv, Board beider Seiten zählt.

**Effekt-Immunität für Kreaturen:** `engine.grantCreatureEffectImmunity
(inst, sourceObj)` / `creatureHasEffectImmunity(inst)` — Gegenstück zu
`grantEffectImmunity` (Helden), gleiche Liste, gleiches Fenster.

**Board-seitiges Post-Target-Fenster:** `isPostTargetBoardReaction:
true`, `postTargetBoardCondition(gs, pi, engine, targets, source, inst,
info)`, `postTargetBoardResolve(engine, pi, targets, source, inst,
info)` — läuft VOR dem Hand-Fenster, Verteidiger zuerst, Reichweite wie
Escape Device. Castling (Held negieren + Beschwörung als Zusatzaktion),
Rook [B] (≥ 2 eigene Ziele → alle eigenen Ziele immun).

**EIN Stummschalt-Prädikat:** `engine.isCreatureEffectSuppressed(inst,
{ honorNegStatusImmune })` ersetzt die verstreuten
`negated/nulled/frozen/stunned`-Abfragen (runHooks, isCardEffectActive,
getActivatableCreatures, Server-Gate, Gerrymander). Negations-Wächter:
`protectsCreatureEffects(engine, inst, guardInst) → bool` (Queen [B]) —
die Statuseffekte bleiben liegen, die Effekte feuern; und
`actionNegateCreature` legt `negated`/`nulled` durch den Gegner gar nicht
erst an. Neue Stellen, die Kreaturstatus prüfen, nehmen das Prädikat.

**Hand-Spielsperre:** `ps._handPlayLock = { turn, allow }` — sperrt
ALLES aus der Hand (auch Reaktionen: 22 Fenster, `validateActionPlay`,
`getHeroPlayableCards`). `allow: 'of-kings'` = Ausnahme für Karten,
deren Name ODER Effekttext „of Kings" enthält, solange ein Board liegt.
Prüfen: `engine.isHandPlayLocked(pi, cardName)`.

**Stapel-Ausgangssperre (MANDATORY für direkte Splices):**
`engine.pileOutAllowed(pi, 'deck'|'discard', opts) → bool`. Skript-
Vertrag `blocksOpponentPileOut(engine, pileOwner, pile, guardInst)`
(Knight [B]). Hängt in `actionAddCardFromDeckToHand`, `actionMillCards`
(auch Self-Mill, Ruling 11), `actionMoveCard` aus Deck/Ablage,
`_castSpellImmediately` (Deck), `_discardOutAllowed`. Nur Bewegungen des
Besitzers selbst (Bewegender = laufende Effektquelle, sonst Zugspieler);
Draws laufen nie darüber. **Jedes Skript, das `ps.mainDeck.splice` /
`ps.discardPile.splice` selbst aufruft, fragt vorher `pileOutAllowed`.**
Altlast: 74 Skripte splicen das Deck und 39 die Ablage direkt, ohne
das Gate — Sweep-Aufgabe, kein Teil von v818.

**„Nur Beschwörung/Platzierung" (v834, Al 8.9.):** dasselbe Prinzip für
`ps.summonLocked` — Modul-Flag `blockedBySummonLock` (Loader-Auto-
Erkennung: Beschwörungs-/Platzierungs-Primitive im Code, sonst nichts;
Kommentare werden vor jeder Erkennung entfernt). Gilt auch in den
Reaktionsfenstern (Pawn Chain wird im Todes-Fenster einer Primordium-
Löschung gar nicht angeboten) — alle drei Sperren laufen über EIN Prädikat
`_handPlayLockedFor`. Karten, die ihre Bewegung über einen Shared-Helfer
machen (The Core's Awakening → `schickeVonDeckInAblage`), sieht die
Erkennung nicht: manuelles Flag. Summon-only: Pawn Chain, Paraseed
Zombie, Powder Keg, Monster in a Bottle.

**„Nur Stapel-Bewegung" → gar nicht spielbar (v826, Al 8.9.):** Karten,
deren EINZIGER Effekt eine Entnahme aus Deck/Ablage ist (Magnetic Potion,
Magnetic Glove, Cute Cheese, Elixir of Mana …), sind unter der Stapel-
Ausgangssperre nicht bezahlbar-und-verpuffend, sondern GAR NICHT
spielbar — Präzedenz `blockedByHandLock` (Draw-only unter Hand-Sperre).
Vertrag: Modul-Flag `blockedByPileLock` (Loader erkennt `resolve`-Module
und reine Handkarten automatisch — Stapel-Primitive im Quelltext, kein
anderer Effekt; Draws, Gelöscht-Stapel und Gegnerstapel zählen nicht);
ein manuelles `blockedByPileLock: true/false` gewinnt immer (Magic
Emerald, Misfire, Monster in a Bottle, Pressed Skill stehen auf false).
Gelesen von `validateActionPlay`, den Ability-/Potion-Listen, dem
Server-Play-Gate und `cardGateBlockedCards` (Client graut aus).
Prüfung: `engine.isPileLockedFor(pi)`.

**`isReaction` ohne `reactionCondition` = reagiert auf ALLES (Lehre v830):**
das generische Kettenfenster fragt jede Handkarte mit `isReaction: true`;
fehlt `reactionCondition`, gilt sie bei jedem Kartenspiel als spielbar
(Pawn Chain promptete bei jeder Aktivierung, Al 8.9.). Spezialfenster
(`isCreatureDefeatedReaction`, `isPreDamageReaction`, `isPostTarget-
Reaction` …) brauchen `isReaction` NICHT — nur ihr eigenes Flag.

**„When this Creature is summoned via an effect" (v831, Tamed-Archetyp):**
`onPlay` mit `ctx.playedCard?.id === ctx.card.id`, `ctx.card.zone ===
'support'` und `!ctx._isNormalSummon` (Spieler-Beschwörung aus der
Hand). PLATZIEREN durch einen Effekt (Barker, Kasperov [B], Pawn Chain —
`_isPlacement: true`) ZÄHLT als Effekt-Beschwörung und löst On-Summon-
Effekte aus (Al 8.9.); „placed" beschreibt nur die fehlenden
Voraussetzungen (Level, Aktion, Heldenzustand). Eigene Folge-Beschwörungen tragen ein
hookExtra (`_summonedByTamedPrimordium`), an dem die Ausnahme „except
the effect of X" hängt. Namenssperre für den Rest des Zuges:
`ps._creationLockedNames` (Set; validateActionPlay, Potions, Artefakte,
Client-Ausgrauen; fällt am Zugbeginn). Beschwörungssperre:
`ctx.lockSummons()` → `ps.summonLocked` — sperrt in der Engine Hand-,
Effekt-Beschwörungen UND Platzierungen; „delete … and you cannot summon
afterwards" heißt deshalb: ERST löschen (Todes-Fenster darf noch
platzieren), DANN sperren (v833).
„Delete this Creature" vom Brett SICHTBAR: `inst._redirectToDeleted =
true; await engine.actionDestroyCard(source, inst, opts)` (Vacarn-/
Remora-Vertrag; der Flug geht direkt nach `deleted`). Ein nacktes
`actionMoveCard(inst, 'deleted')` lässt die Karte ohne Flug erscheinen.
`beforeSummon`: die Spieler-Beschwörung aus der Hand trägt seit v833
`ctx._isNormalSummon: true` — eine Wahl wie bei Knight of Kings [W]
(„Zusatzaktion oder normal?") darf NUR dann gestellt werden; Effekt-
beschwörungen (`summonCreatureWithHooks`) tragen es nicht.

**CPU-Antworten für abbrechbare Prompts (v828):** die Engine bricht
ABBRECHBARE Prompts (`cancellable: true` — Galerie, Zonenwahl, Ja/Nein,
optionPicker) für die CPU grundsätzlich ab, sofern das Skript keine
`cpuResponse` liefert. Ein getriggerter Effekt, der so einen Prompt
öffnet, ist für die CPU sonst tot (Castling beschwor nie, Al 8.9.).
Jede of-Kings-Karte endet ihre `cpuResponse` mit
`ofKingsCpuAnswer(engine, kind, payload)` (_of-kings-shared: Ja, erste
Handkarte vor Deckkarte, erste Zone, erste Nicht-Cancel-Option). Neue
Karten mit Galerie/Zonenwahl: dasselbe Muster oder `cancellable: false`.
`performImmediateAction` (heroAction-Banner) beantwortet die CPU IMMER
mit Abbruch — für Beschwörungen aus getriggerten Effekten den direkten
Weg nehmen (Galerie → `summonZonesFor` → `summonFromPile`).

**Synergie-Kanal der CPU (Al 7.9.):** `synergyRules[card]['syn:<Partner>']`
— je Hand-Kreatur und eigenem Zug gelernt (fired = beschworen), Partner
= Familienstamm jeder eigenen Brettkreatur PLUS `cpuMeta.boardAliasNames
(engine, inst) → string[]` (Queen meldet Knight/Bishop/Rook). Prior in
`estimateHandCardValueFor`; Log `synergyDecisions`. Eine Karte, die auf
dem Brett als andere Namen zählt, exportiert die Aliasse — der Pilot
trägt kein Archetyp-Wissen.

## Quick Start

```js
// cards/effects/my-new-card.js
module.exports = {
  // 1. Declare what kind of card this is (pick one or more flags)
  actionCost: true,

  // 2. Implement the activation handler
  onActivate: async (ctx, level) => {
    const goldGain = 10 * level;
    await ctx.gainGold(goldGain);
    ctx.log('my_card_activated', { hero: ctx.heroName(), gold: goldGain });
  },
};
```

That's it — the engine handles registration, caching, and lifecycle automatically.

---

## ★ `banned` ist KEIN Grund, eine Karte nicht zu implementieren (Als Regel 17.8.)

> „`banned` in cards.json hat keine Auswirkung darauf, ob eine Karte
> implementiert werden sollte und kann bis auf weiteres ignoriert werden."

Das Feld `banned` in `data/cards.json` ist eine Balance-Notiz, kein
Bauauftrag. Eine gebannte Karte wird **genauso vollstaendig gebaut und
getestet** wie jede andere — sie muss im Puzzle Mode und in Testaufbauten
funktionieren, und ein Bann kann jederzeit zurueckgenommen werden.

Auch nicht tun: den Bann im Kartenkopf als Sonderfall kommentieren oder
ihn in Tests zusichern. Eine Zusicherung auf `banned` misst eine
Balance-Entscheidung und wird rot, sobald Al sie aendert.

**Stand der Technik (17.8. gemessen, damit niemand ein Gate vermutet, das
es nicht gibt):** `banned` wird im ganzen Projekt an **genau einer** Stelle
gelesen — `getDailyHeroPool` in server.js schliesst gebannte Helden aus der
Tagesauswahl aus. Der Deck-Editor prueft es **nicht**; eine gebannte Karte
ist derzeit also deckbaulich voll zugelassen.

---

## Module Exports — Card Type Flags

At least one of these must be present, or the loader will ignore the file.

| Flag | Type | Description |
|------|------|-------------|
| `hooks` | `object` | Map of hook names → handler functions (reactive effects) |
| `effects` | `object` | Chain-based effect definitions (advanced) |
| `actionCost` | `bool` | Ability that consumes an action when activated |
| `freeActivation` | `bool` | Ability that activates without consuming an action |
| `isPotion` | `bool` | Potion card (targeting + resolve flow) |
| `isEquip` | `bool` | Equipment artifact (placed in Support Zone) |
| `equipOwnSideOnly` | `bool` | Ausruestung nur auf EIGENE Helden (v796) |
| `isTargetingArtifact` | `bool` | Non-equip artifact with a targeting UI |
| `isReaction` | `bool` | Reaction/Surprise card (chains onto other effects) |
| `heroEffect` | `bool` | Hero with an activatable Main Phase effect |
| `isTargetRedirect` | `bool` | Surprise that redirects incoming targeting |
| `isSurprise` | `bool` | Surprise card (face-down placement, triggered activation) |

---

## Module Exports — Behavioral Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `activeIn` | `string[]` | all zones | Zones where this card's hooks fire. Values: `'hand'`, `'deck'`, `'ability'`, `'support'`, `'surprise'`, `'area'`, `'hero'`, `'permanent'`, `'discard'`, `'deleted'` |
| `oncePerGame` | `bool` | `false` | Card can only be played once per game. Uses `_oncePerGameUsed` Set on player state. |
| `oncePerGameKey` | `string` | card name | Shared key for `oncePerGame` — cards with the same key share the restriction (e.g. all "Divine Gift" variants share `'divineGift'`). |
| `inherentAction` | `bool \| fn(gs, pi, heroIdx, engine)` | `false` | Playable during Main Phase without needing an additional action. If a function, evaluated per hero. |
| `isWildcardAbility` | `bool` | `false` | When stacked on an ability, counts as that ability's spell school for school-requirement checks. |
| `potionLockAfterN` | `number` | — | Hero flag: after the controlling player uses N potions in a turn, their potions are locked. |
| `customPlacement` | `{ canPlace(zone) → bool }` | — | Overrides standard ability placement logic. Receives the current zone array, returns whether this card can be placed there. |
| `manualGoldCost` | `bool` | `false` | Artifact handles its own gold deduction in `resolve()` instead of the engine auto-deducting. |
| `deferBroadcast` | `bool` | `false` | Don't broadcast the card reveal to the opponent before resolution (card handles it manually). |
| `noDefaultFlash` | `bool` | `false` | Skip the default activation flash animation. |
| `animationType` | `string` | `'explosion'` | Animation played on resolved potion/artifact targets. Use `'none'` to skip. |
| `cpuMeta` | `object` | — | CPU evaluation hints — see "CPU Metadata (cpuMeta)" below. |
| `bypassStatusFilter` | `bool` | `false` | When `true`, the card's hooks fire even while the card is Frozen / Stunned / Negated. Same flag the engine has long honoured for Hero / Ability passives; extended to support-zone Creatures for "cannot be negated" passives like Chilly Wizard's status mirror. |
| `selfFreezeImmune` | `bool` | `false` | **Opt-in marker.** Set to `true` on any Creature whose `onPlay` stamps `inst.counters.freeze_immune` (or otherwise becomes freeze-immune the moment it lands). Pickers that need to filter out Creatures that can't be Frozen — currently SnowItAll's hand-summon picker; future "Freeze-as-cost" cards — read this flag to exclude them before the player can pick. Cardinal Beasts are filtered via their existing omni-immune name list, so they don't need the flag. **When adding a new Creature that stamps `freeze_immune` in `onPlay`, set this flag too.** |
| `firesOnAnyDamageTarget` | `bool` | `false` | Surprise opt-in. Routes the surprise through `_checkDamageSurpriseWindow`, which fires on incoming damage to ANY target you control (Hero or Creature). Standard `_checkSurpriseWindow` only fires for Hero targets and is unchanged. Banner Bearer is the first consumer. Surprise's `onSurpriseActivate` may return `{ damageReduced: N, effectNegated: bool }` to reduce/negate the damage event. |
| `surpriseFiresOnSupportCreature` | `bool` | `false` | Surprise opt-in (v703). The standard targeting window `_checkSurpriseWindow` only opens for Hero targets. With this flag a Creature target ALSO opens the window of the Hero whose Support Zone it occupies (activator = that Hero; Brain Spider cross-host rule applies as usual). The script sees the chosen Creature as `sourceInfo.chosenCreature` (`{type:'creature', owner, heroIdx, slotIdx, cardName, cardInstance?}`, `null` for a Hero pick); attacker fields (`owner/heroIdx/cardInstance`) are unchanged. Covers the single-target picker (`promptDamageTarget`/`promptTarget`) and `promptMultiTarget`; AoE fan-outs still carry `_isAoeCheck`. Mountain Tear River („the user or a Creature in one of its Support Zones") is the first consumer. |
| `sacrificableFromHand` | `bool` | `false` | Creature opt-in: while this card sits in HAND it is injected as a selectable tribute into every "sacrifice a Creature you control" picker (`type: 'hand'` entry). Hand substitutes are EXEMPT from the cost's own filter (e.g. "not summoned this turn") — the card REPLACES the would-be tribute. **Precondition (Al's ruling): a LEGAL TRIBUTE FOR THIS COST must exist on the controller's board**, since "when you WOULD sacrifice a Creature you control" presupposes a sacrifice that could actually happen. Not merely any Creature — it must survive the cost's own `spec.filter` and must not be the card paying the cost (`selfId`). The substitute itself stays exempt from that filter (the restriction describes the tribute being REPLACED). A gate of the form `getSacrificableCreatures(pi).some(<the same filter>)` is exactly equivalent to this precondition and stays in sync. Enforced centrally in `_collectSacrificeCandidates` — build sacrifice pickers from that (or `resolveSacrificeCost` / `canSatisfySacrifice`), NEVER from the board-only `getSacrificableCreatures` or a raw `_getHandSacrificeSubstitutes` call, or your card will not see substitutes and its gate will disagree with its payment path. Chosen Sacrifice is the only consumer so far. |

---

## CPU Metadata (`cpuMeta`)

Per-card declarations the CPU's `evaluateState` reads to weigh boards
correctly without hand-coding card names. Add to a card's `module.exports`
as needed; omit entirely if the card has no special CPU semantics.

```js
cpuMeta: {
  // Creatures: value to OWNER when this Creature dies. Used to
  // discount the slot's "alive value" — own copies become attractive
  // sacrifice targets, opp copies become unattractive Attack targets
  // (don't fuel their plan). Magnitude is rough score-units.
  // Example: Hell Fox = 12 (deck-search → +20 hand value, less the
  // corpse delete and animation cost).
  onDeathBenefit: <number>,

  // Creatures: I'm a "chain source" — when an ALLY Creature dies and
  // my `triggersOn` predicate matches, my owner gets `valuePerTrigger`
  // worth of value. The eval credits this bonus to OTHER ally
  // Creatures' effective on-death value, so the CPU sacrifices them
  // to feed the chain. Chain sources themselves are NEVER discounted
  // by chain bonuses (would-kill-its-own-engine). Example: Loyal
  // Terrier and Loyal Shepherd.
  chainSource: {
    // True iff the source is currently armed (window up, HOPT
    // unfired, etc.). Returning false skips this source for the
    // duration of the eval call.
    isArmed(engine, inst) → bool,
    // True iff a death of `tributeInst` would trigger this source.
    // Use to filter by tribe / archetype / specific names.
    triggersOn(engine, tributeInst, sourceInst) → bool,
    // Score-units per chain trigger. Estimate the actual benefit
    // (50-dmg hit ≈ 50; deck-tutor ≈ 25; etc.).
    valuePerTrigger: <number>,
  },

  // Abilities: this is a deck-defining "engine" ability. The eval
  // adds `engineValue × stack_size` to the owner's score for every
  // matching ability stack on their heroes. Performance copies on
  // top of the engine inherit the base's role. Example: Divinity
  // = 120 (≈ "as valuable as a Lv4 Creature").
  engineValue: <number>,

  // Generic per-instance eval bonus the CPU's `evaluateState` adds
  // to (or subtracts from) the owner's score. Called once per
  // tracked cardInstance in any zone; the script decides what
  // contributes value based on the inst's state. Use this for:
  //   • Game-defining bodies on the board (Gigantisaur Chimera
  //     returns +300 while alive in support — outweighs the 3-
  //     discard summon cost).
  //   • Equipment whose value isn't visible in immediate effects
  //     (The Great Wall of Deri returns +150 for the FIRST Wall on
  //     a side; duplicates contribute nothing).
  //   • Artifacts whose post-resolve grant is conditionally
  //     valuable (Giga Steroids returns +100 ONLY when its grant
  //     is alive AND the owner has a non-Spell/Attack/Creature
  //     Action ready to spend it on).
  // The function decides per-inst whether to return a bonus; dedup
  // / gating logic lives inside the function. Thrown errors are
  // swallowed (inst contributes 0).
  cpuInstBonus(engine, inst, ownerIdx) → number,

  // CPU should defer playing this card from hand until every OTHER
  // viable additional-Action play has been exhausted. Used for
  // cards whose `onPlay` force-ends the turn — Gigantisaur Chimera
  // sends the controller to phase 5 immediately, so playing it
  // first would skip every remaining Spell / Attack / Creature in
  // hand. The CPU's `fireAdditionalActions` hand-iteration runs in
  // two passes: non-deferred cards first, deferred cards only when
  // the first pass finds nothing.
  cpuDeferUntilLast: true,
}
```

The CPU brain reads these declarations generically — **never** hard-codes
card names. New cards opt in by exporting the relevant fields; no CPU
brain edits required.

---

## Turn-1 Immunity

**Rule: during turn 1, every card belonging to the non-turn player is completely immune to anything the turn player can do.** `gs.firstTurnProtectedPlayer` holds that player's index (cleared when the starting player's turn ends).

You normally do not need to handle this. Both target chokepoints strip protected-owned entries automatically:

* `engine.promptEffectTarget()` — inner prompts built inside `resolve` / hooks
* `normalizeValidTargets()` (server) — the `getValidTargets` + `targetingConfig` session

The filter is skipped when the PROMPTED player is the protected one (they may always pick their own cards). Opt out with `ignoreFirstTurnProtection: true` in the prompt config.

**What you DO have to handle: your play gate.** The filter runs at prompt time, not at gate time — so a `canActivate` / `canFreeActivate` / `inherentAction` that counts opponent cards will still report "playable", the card gets played, gold is spent and the picker then comes up empty. Gate on what the actor can actually touch:

```js
canActivate(gs, pi) {
  const prot = gs.firstTurnProtectedPlayer;
  for (let p = 0; p < 2; p++) {
    if (prot != null && p === prot && pi !== prot) continue;  // unreachable this turn
    …
  }
}
```

If EVERY mode of your card targets the opponent, gate the whole card off: `if (gs.firstTurnProtectedPlayer === oi) return false;` (Charme does this). Fizzling mid-resolution instead is worse — the activation was already offered and its once-per-turn slot already spent.

`GameEngine.isAbilityRemovalProtected(gs, ownerIdx)` is the named predicate for one-off checks.

## `onStatusApplied` — both field names

The status name arrives under **both** `ctx.statusName` and `ctx.status`; they are always identical. Historically the six fire sites disagreed — `addHeroStatus` sent only `statusName`, `actionApplyStatus` only `status`, `applyCreatureStatus` both — so a listener reading one name was blind to half the engine. All sites now send both. Either name is safe; new cards should still read `ctx.statusName || ctx.status` so they keep working against older engine copies.

**Hero targets vs Creature targets differ in STORAGE, not in the hook.** A Hero keeps statuses in `hero.statuses[name] = { duration, … }` and the duration always exists (default 1). A Creature keeps them in `inst.counters[name] = 1` with a companion `inst.counters[name + 'Duration']` that is only written when the duration exceeds 1. Reading `ctx.target.statuses?.<x>` therefore silently skips every Creature — check `ctx.target.counters` for the Creature branch (`ctx._onCreature` is set on the `applyCreatureStatus` path). Extending a plain one-turn Creature status means WRITING 2, not incrementing a missing field.

If your card should only react to Hero targets, guard on identity (`ctx.target !== <your hero>`) rather than relying on the field name.

## Ascension & Descend

Default Ascension gates on the spell-school orb path (`hero.ascensionReady` + `hero.ascensionTarget`, both set by the BASE hero's script). Cards whose own text names a different price declare it themselves, on the ASCENDED card:

| Export | Shape | Meaning |
| --- | --- | --- |
| `ascensionCondition` | `(gs, pi, heroIdx, engine) → bool` | Replaces the `ascensionReady` check. Evaluated BEFORE the hand splice, so a refusal never eats the card. |
| `payAscensionCost` | `(engine, pi, heroIdx)` | Charged immediately after the splice; the condition guarantees affordability. |
| `blockEndPhaseOnAscend` | `bool` | "Ascending this Hero does not end your turn." |
| `formsAscensionStack` | `bool` | Push the previous form onto `hero._formStack` so a later Descend pops exactly one level. |
| `evolutionAnimation` | `bool` | Fire `play_evolution_animation` and wait out its duration before resolving on. |
| `onAscensionBonus` | `async (engine, pi, heroIdx)` | Card-specific bonus fired after the Ascension hook. |

`engine.performDescend(pi, heroIdx)` is the mirror: it pops one level off `hero._formStack`, reverses the intrinsic HP delta (printed max HP of both forms, so mid-game max-HP buffs survive a round trip) with current HP FLOORED AT 1, re-points the hero instance, clears the cached script, re-runs the landed form's `onAscendSetup`, and returns the shed form to hand so cycling is repeatable.

**Multiple Ascension targets.** `hero.ascensionTargets` (array) sits alongside the legacy scalar `hero.ascensionTarget`; the client accepts either. Set both when a Hero has more than one legal form.

**Several once-per-turn effects on one Hero Effect.** The engine stamps a single shared `hero-effect:<name>:<pi>:<heroIdx>` HOPT after `onHeroEffect` returns anything but `false`. A card with independent once-per-turn options must therefore keep its OWN keys and `return false` — and drain the pending reveal itself, since the engine only drains it on the `!== false` path.

**Teaching the CPU which form to pick.** Route the choice through a `cardGallery` prompt with a STABLE `title` / `source`. That is all the wiring needed: `_logGalleryPick` records every live gallery resolution as `{src, picked, t}`, the trainer turns those into `tutorPickRules['<src>→<card>']` with Advantage labels and recency weighting, and the gallery scorer adds the learned value back when ranking. Renaming the source string silently invalidates every trained profile.

## CPU Prompt Overrides (`cpuResponse`)

A card can answer its own prompts for the CPU instead of letting the generic brain decide:

```js
cpuResponse(engine, kind, payload) { ... }   // return undefined to fall through
```

**Two rules decide whether your handler is ever reached. Get either wrong and it is silently dead code — the CPU falls back to "cancellable → decline" and your card simply never works for the CPU.**

**1. `kind` is `'generic'` or `'effectTarget'` — never `'target'`.** Those are the only two strings the engine sends (`_getCpuGenericResponse`, `_getCpuTargetResponse`) and the only one `_cpu.js` sends. A guard like `if (kind !== 'target') return undefined;` disables the whole handler.

| Prompt call | `kind` | `payload` |
| --- | --- | --- |
| `promptGeneric` | `'generic'` | the prompt data object (`type`, `options`, …) |
| `promptEffectTarget` | `'effectTarget'` | `{ validTargets, config, playerIdx }` |

**2. The dispatch key is `config.source || config.title`, and it must be the exact card name.** The engine resolves it with `loadCardEffect()`, so a decorated title does not match:

```js
// BROKEN — loadCardEffect('The Yeeting — Choose Target') returns null
await engine.promptEffectTarget(pi, targets, { title: `${CARD_NAME} — Choose Target`, … });

// CORRECT — decorated title for the player, real name for the dispatch
await engine.promptEffectTarget(pi, targets, {
  title: `${CARD_NAME} — Choose Target`, source: CARD_NAME, …
});
```

Any prompt whose `title` carries a dash, colon or interpolation needs an explicit `source`.

**Keep the play-gate and the handler on the same logic.** If `cpuResponse` will only ever pick certain targets (e.g. opponent-owned ones), gate the play itself with `cpuShouldPlay(engine, pi) → bool` using the SAME predicate. Otherwise the CPU plays the card, declines its own prompt, and the resolve aborts — repeatedly, since `{ aborted: true }` re-opens the targeting session.

## Module Exports — Lifecycle Methods

### Abilities (actionCost / freeActivation)

| Method | Signature | Description |
|--------|-----------|-------------|
| `onActivate` | `async (ctx, level) → void` | Called when an `actionCost` ability is activated. `level` = stack size. |
| `onFreeActivate` | `async (ctx, level) → void` | Called when a `freeActivation` ability is activated. |
| `canActivateAction` | `(gs, pi, heroIdx, level, engine) → bool` | Extra check beyond standard HOPT/phase/status checks. Return `false` to gray out. |
| `canFreeActivate` | `(gs, pi, heroIdx, level, engine) → bool` | Same, for free-activation abilities. |

### Potions & Targeting Artifacts

| Method | Signature | Description |
|--------|-----------|-------------|
| `canActivate` | `(gs, playerIdx) → bool` | Can this card be used right now? |
| `getValidTargets` | `(gs, playerIdx[, engine]) → target[]` | Build array of valid targets for the targeting UI. |
| `targetingConfig` | `object \| fn(gs, pi, goldCost) → object` | UI config sent to frontend (see Targeting Config below). |
| `validateSelection` | `(selectedIds, validTargets) → bool` | Validate the player's target selection before resolving. |
| `resolve` | `async (engine, playerIdx, selectedIds, validTargets) → result` | Execute the card's effect. Return `{ aborted: true }` to re-enter targeting. |

### Spells & Attacks

| Method | Signature | Description |
|--------|-----------|-------------|
| `spellPlayCondition` | `(gs, playerIdx) → bool` | Extra condition beyond spell school/level. Return `false` to block play. |
| `canPlayCard` | `(gs, pi, heroIdx, cardData, engine) → bool` | Hero-level play restriction (e.g. duplicate attack bans). Exported by hero scripts. |
| `payActivationCost` | `async (ctx) → void` | **Runs BEFORE the reaction chain window.** Use for costs that must be paid at activation and are NOT refunded by negation (e.g. Cold Coffin's Pollution placement). `ctx` is a standard card ctx built from the hand-zone instance — includes `promptZonePick`, `promptGeneric`, etc. If the spell is later negated by Anti Magic Shield / The Master's Plan / any counter-spell, the cost stays paid. Make `onPlay`'s target prompt `cancellable: false` since the cost is committed. |

### Heroes

| Method | Signature | Description |
|--------|-----------|-------------|
| `heroEffect` | `bool` | Flag indicating this hero has an activatable effect. |
| `onHeroEffect` | `async (ctx) → false \| any` | Called when the hero effect is activated. **Return `false` on every abort path** — see below. |

### ★ AUFTRITT BEI PASSIVEN EFFEKTEN, DIE SICH AKTIVIEREN (Als Regel 21.8.)

Verbindlich ausformuliert GANZ OBEN unter „★ JEDER GETRIGGERTE PASSIVE
EFFEKT ZEIGT SEINE KARTE BEIDEN SPIELERN". Kurzfassung:

- Effekte auf einem der Aktivierungswege (Hero-Effekt, Ability,
  Creature-Effekt, Artefakt, Surprise) bekommen den Auftritt geschenkt —
  die Wege rufen `armEffectAnnounce(cardName, owner, origin)`, und
  `announceActiveEffect()` löst ihn aus.
- Effekte, die aus einem HOOK heraus feuern (Future Tech Gear an
  `onDraw`, Weathercock an seinem Reaktionsfenster), rufen selbst
  `await engine.showTriggeredEffect(CARD_NAME)` — NICHT
  `announceActiveEffect` (nur Besitzer) und NICHT einen rohen
  `_broadcastEvent('card_reveal', …)` (keine Quellen-Entprellung, keine
  Sim-Wache).
- Dauerhaft laufende Passiva (Angler Angel, Future Tech Gun, Laser
  Cannon) bekommen KEINEN Auftritt; ebenso wenig ein Trigger, der im
  konkreten Fall nichts bewirkt.

**★ RUECKGABEVERTRAG von `onHeroEffect` (Als Befund 17.8.):** die Engine
stempelt das Einmal-pro-Zug NUR, wenn der Rueckgabewert `!== false` ist
(`doActivateHeroEffect` in server.js) — und meldet den Effekt sonst als
gefeuert (`announceActiveEffect`, `noteActivationOutcome`). Ein blosses
`return;` liefert `undefined` und gilt damit als ERFOLG: der Zug ist
verbraucht, obwohl nichts geschehen ist. Genau so fiel Cecilia auf —
Abbruch der Kartenauswahl kostete die Aktivierung.

Also: **jeder** Pfad, der nichts bewirkt, gibt `false` zurueck — abgebrochene
Abfrage, fehlgeschlagene Zahlung, Ziel zwischenzeitlich verschwunden, Gate
nachtraeglich nicht mehr erfuellt. Der Erfolgspfad gibt `true` zurueck (oder
irgendetwas ausser `false`).

Sonderfall MEHRFACHNUTZUNG pro Runde (Kassaran, 3x): dort fuehrt die Karte
ihren Verbrauch selbst und setzt `ctx._skipHeroEffectHopt = true`, statt
`false` zurueckzugeben — `false` hiesse zusaetzlich "abgebrochen" und wuerde
`onAnyActionResolved` und die CPU-Erkennung mit aushebeln.
| `canActivateHeroEffect` | `(ctx) → bool` | Extra activation condition (beyond alive/not-frozen/HOPT). |

### Creatures

| Method | Signature | Description |
|--------|-----------|-------------|
| `canSummon` | `(ctx) → bool` | Extra summoning condition. Return `false` to block. |

### Reactions

| Method | Signature | Description |
|--------|-----------|-------------|
| `reactionCondition` | `(ctx, chainCtx) → bool` | Can this reaction be added to the current chain? |
| `onChainAdd` | `async (ctx) → void` | Fires when the reaction is added to the chain. |

### Target Redirect

| Method | Signature | Description |
|--------|-----------|-------------|
| `canRedirect` | `(ctx, target, validTargets) → bool` | Can this card redirect the incoming targeting? |
| `onRedirect` | `async (ctx, target, validTargets) → target` | Execute the redirect, return the new target. |

### Surprises

Surprises are cards (Spell/Attack/Creature with `subtype: 'Surprise'` in cards.json) that can be placed face-down in a Hero's Surprise Zone during Main Phase. When their trigger condition is met, the owner is prompted to activate. On activation the card flips face-up, its effect resolves, and it goes to discard (or enters a Support Zone for Creatures).

| Export | Type | Description |
|--------|------|-------------|
| `isSurprise` | `bool` | **Required.** Marks this card as a Surprise. |
| `surpriseTrigger` | `(gs, ownerIdx, heroIdx, sourceInfo, engine) → bool` | Trigger condition. `sourceInfo`: `{ cardName, owner, heroIdx, cardInstance }`. Return `true` to prompt activation. |
| `onSurpriseActivate` | `async (ctx, sourceInfo) → result` | Called when the owner confirms activation. Return `{ effectNegated: true }` to fully negate the triggering effect. |

**Placement:** Any Surprise can be placed face-down by its owner during Main Phase 1 or 2 into a living Hero's empty Surprise Zone. No ability/level check is required for placement (bluffs are allowed).

**Activation check:** The engine verifies the Hero can activate (alive, not Frozen/Stunned, meets spell school & level requirements). For Creature surprises, a free Support Zone is also required.

**Timing:** The surprise window fires after a hero is confirmed as a target of a Spell, Attack, or Creature effect, after the card is revealed to the opponent, but before the effect resolves.

```js
// Example: booby-trap.js
module.exports = {
  isSurprise: true,
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const attacker = engine.gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    if (!attacker) return null;
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: sourceInfo.owner,
      heroIdx: sourceInfo.heroIdx, zoneSlot: -1,
    });
    await engine._delay(600);
    await ctx.dealDamage(attacker, 100, 'destruction_spell');
    if (attacker.hp <= 0) return { effectNegated: true };
    return null;
  },
};
```

---

## Targeting Config Object

Sent to the frontend to control the targeting UI:

```js
targetingConfig: {
  description: 'Select 1 Ability or any number of Equip Artifacts.',
  confirmLabel: '🔥 Destroy!',       // Button text
  confirmClass: 'btn-danger',         // CSS class (btn-danger, btn-info, btn-success)
  cancellable: true,                  // Show cancel button
  exclusiveTypes: true,               // Can't mix target types in selection
  maxPerType: { ability: 1, equip: Infinity },
  maxTotal: 3,                        // Max total selections
  minRequired: 1,                     // Min required before confirm enabled
  alwaysConfirmable: true,            // Confirm enabled even with 0 selections
  greenSelect: true,                  // Green highlight instead of red
  damageType: 'destruction_spell',    // Optional — tag damage-targeting (see below)
  baseDamage: 100,                    // REQUIRED for damage targeting (see below)
}
```

### Damage Targeting vs Non-Damage Targeting

The engine distinguishes "damage targeting" from "non-damage targeting"
via `config.baseDamage > 0`. Cards that pick a target and DEAL damage to
it MUST set `baseDamage` to the per-target damage amount (`baseDamage:
hero.atk` for Attacks, fixed values for damage Spells / Artifacts). This
signal is consulted by several engine filters:

* **Great Wall of Deri** (and any future `isNondamageOpponentShield`
  card): protects the controller's Creatures from being chosen as
  targets by opp's cards / effects EXCEPT when the picker is tagged
  damage targeting. Set `baseDamage > 0` on every damage picker so opp
  can still legally aim damage spells / attacks at your protected
  Creatures.

* **Status-application pickers** (Freeze, Stun, Negate, Charm, Poison,
  Burn-as-status, Bind, etc.) should set `damageType: 'status'` and
  leave `baseDamage` undefined. The Wall filter treats these as
  non-damage and correctly excludes the protected opp Creatures from
  the picker.

### Adding a New Card That Targets Opp Creatures Non-Damage

If your script targets opp Creatures via a NON-damage effect (steal /
control / status apply / bounce / destroy-without-damage / etc.), the
engine's chokepoints (`promptDamageTarget`, `promptMultiTarget`,
`promptEffectTarget`, `normalizeValidTargets`) automatically filter
out protected opp Creatures — your picker will list zero opp
Creatures if all of them are Wall-protected.

For cards whose **`canActivate` / `canFreeActivate` requires opp
Creatures to be selectable** (so they can correctly gray out in hand
when zero legal targets remain — Dark Gear / Diplomacy pattern), add
an explicit short-circuit at the top of your target-eligibility
helper:

```js
const oppIdx = pi === 0 ? 1 : 0;
// Per-side non-damage shield (The Great Wall of Deri etc.). Card is
// non-damage, so opp's protected Creatures are unreachable — short-
// circuit so the card is correctly grayed out in hand instead of
// opening an empty picker.
if (engine._isSideNondamageShielded(oppIdx)) return [];
```

For cards whose effect is **auto-triggered** rather than player-picked
(Cute Angel Molinda's afterCreatureDamageBatch steal, Treacherous
Crystal's server-side trigger, etc.), check per-creature in the
trigger handler:

```js
const tgtCtrl = inst.controller ?? inst.owner;
if (engine._isSideNondamageShielded?.(tgtCtrl)) continue;
```

The Wall's "except direct damage" exception means damage-dealing
auto-triggers (recoil damage, on-summon damage, etc.) do NOT need the
check — the damage itself bypasses the shield by definition.

---

## Hooks

Hooks are reactive — they fire when game events occur. Declare them
in the `hooks` object. Each receives a `ctx` object (see next section).

### Game Flow

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onGameStart` | Game begins | — |
| `onTurnStart` | A new turn starts (after burn/poison) | `turn`, `activePlayer` |
| `onTurnEnd` | Turn ends | `turn`, `activePlayer` |
| `onPhaseStart` | Phase changes | `phase`, `phaseIndex` |
| `onPhaseEnd` | Phase about to change | `phase`, `phaseIndex` |
| `onBeforeHandDraw` | Before starting hands are drawn | — |

### Card Movement

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `beforeDraw` | Card about to be drawn | `amount` (modifiable) |
| `onDraw` | Card was drawn | `drawnCards` |
| `beforePlay` | Card about to be played | `cardName`, `zone` |
| `onPlay` | Card was played/placed | `playedCard`, `cardName`, `zone`, `heroIdx`, `zoneSlot` |
| `onDiscard` | Card sent to discard | `cardName` |
| `onDelete` | Card sent to deleted pile | `cardName` |
| `onCardEnterZone` | Card enters a zone | `enteringCard`, `toZone`, `toHeroIdx` |
| `onCardLeaveZone` | Card leaves a zone | `card`, `fromZone`, `fromHeroIdx` |

### Combat

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onAttackDeclare` | Attack declared — **AFTER target pick, BEFORE animation + damage** (see "onAttackDeclare slot" below) | `source`, `target`, `amount` (modifiable via `modifyAmount` / `setAmount` / `addFlatBonus`) |
| `beforeDamage` | Damage about to be dealt | `amount` (modifiable), `target`, `source`, `type`, `sourceHeroIdx` |
| `afterDamage` | Damage was dealt | `amount`, `target`, `source`, `type` |
| `onHeroKO` | Hero HP reaches 0 | `deadHero`, `heroIdx` |
| `onHeroRevive` | Hero revived | `heroIdx` |
| `onCreatureDeath` | Creature removed from board | `card`, `heroIdx` |
| `beforeCreatureDamageBatch` | Batch creature damage about to apply | `entries[]` (modifiable) |
| `afterCreatureDamageBatch` | Batch creature damage applied | `entries[]` |

### Resources & Levels

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onResourceGain` | Gold gained | `amount` |
| `onResourceSpend` | Gold spent | `amount` |
| `beforeLevelChange` | Level about to change | `delta` (modifiable) |
| `afterLevelChange` | Level changed | `delta` |

### Status Effects

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onStatusApplied` | Status effect applied | `statusName`, `target` |
| `onStatusRemoved` | Status effect removed | `statusName`, `target` |

### Chain & Reactions

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onChainStart` | Chain begins | — |
| `onChainResolve` | Chain link resolves | — |
| `onEffectNegated` | An effect was negated | `negatedCard` |
| `onReactionActivated` | Reaction added to chain | `reactionCardName` |
| `onCardActivation` | Card effect about to resolve | `cardName` |
| `afterSpellResolved` | Spell/Attack fully resolved | `spellName`, `damageTargets`, `heroIdx`, `casterIdx` |

### Actions

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onActionUsed` | Any action consumed | `actionType`, `playerIdx`, `heroIdx`, `playedCardName`, `isAdditional` |
| `onAdditionalActionUsed` | Additional action consumed | `actionType`, `playerIdx`, `heroIdx`, `playedCardName` |
| `onAnyActionResolved` | Any action resolved (normal, inherent, additional, free) — fires AFTER the play | `actionType`, `playerIdx`, `heroIdx`, `playedCardName`, `isAdditional`, `isInherent`, `isFree` |

> **`ctx.cardName` is the LISTENER, never the played card.** `_createContext`
> overwrites `cardName` with the listening card's name. Read the played
> card via **`ctx.playedCardName`** (or `ctx.playedCard` on `onPlay`).

---

## ctx Object — Full API Reference

Every hook handler receives a `ctx` object. This is the **only** interface
card scripts have to the game engine.

### Card Identity

| Field | Type | Description |
|-------|------|-------------|
| `ctx.card` | `CardInstance` | The card instance whose hook is firing |
| `ctx.cardName` | `string` | Card name |
| `ctx.cardOwner` | `number` | Player index who owns this card (0 or 1) |
| `ctx.cardController` | `number` | Player who currently controls this card |
| `ctx.cardZone` | `string` | Current zone |
| `ctx.cardHeroIdx` | `number` | Hero column index (-1 if N/A) |
| `ctx.attachedHero` | `object\|null` | The hero object this card is attached to |

### Game State (read-only)

| Field | Type | Description |
|-------|------|-------------|
| `ctx.phase` | `string` | Current phase name (`'START'`, `'RESOURCE'`, `'MAIN1'`, `'ACTION'`, `'MAIN2'`, `'END'`) |
| `ctx.phaseIndex` | `number` | Current phase index (0–5) |
| `ctx.turn` | `number` | Current turn number |
| `ctx.activePlayer` | `number` | Index of the active player |
| `ctx.isMyTurn` | `bool` | Whether this card's controller is the active player |
| `ctx.players` | `array` | Both player state objects (full access) |

### Event Modification (for "before" hooks)

| Method | Description |
|--------|-------------|
| `ctx.cancel()` | Cancel the event entirely |
| `ctx.modifyAmount(delta)` | Add/subtract from the event's `amount` |
| `ctx.setAmount(val)` | Set the event's `amount` to an exact value |
| `ctx.negate()` | Negate the triggering effect |
| `ctx.setFlag(key, value)` | Set a flag on the hook context (survives through all hooks, read by engine after) |

### Game Actions (async — each fires its own hooks)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.dealDamage(target, amount, type)` | `Promise` | Deal damage to a hero. `type`: siehe **Schadenstypen** unten — `'creature'` ist der Normalfall für Kreatureffekte. |
| `ctx.dealTrueDamage(target, amount, type, opts)` | `Promise<{dealt}>` | **"Cannot be reduced or negated"** damage. Works on both heroes and creatures. Bypasses buff multipliers (Cloudy, medusa_petrified), Charmed/Submerged immunity, Immortal/HP-1 caps, Smug Coin, Gate Shield, Guardian. Still respects first-turn protection and absolute creature immunities (Cardinal Beast, Baihu Petrify). Sets the `_damagedOnTurn` tracker so "took damage this turn" effects (Medusa's Curse) see it. Use this for Acid Vial / Rockfall / future true-damage cards. |
| `ctx.healHero(target, amount)` | `Promise` | Heal a hero |
| `ctx.reviveHero(playerIdx, heroIdx, hp, opts)` | `Promise` | Revive a KO'd hero |
| `ctx.increaseMaxHp(target, amount, opts)` | — | Increase a hero's max HP. `opts.cap` to set upper limit. |
| `ctx.decreaseMaxHp(target, amount)` | — | Decrease a hero's max HP |
| `ctx.drawCards(playerIdx, count)` | `Promise<string[]>` | Draw cards from deck. Returns drawn card names. |
| `ctx.destroyCard(targetCard)` | `Promise` | Destroy a card instance (→ discard) |
| `ctx.moveCard(targetCard, toZone, toHeroIdx, toSlot)` | `Promise` | Move a card to a new zone |
| `ctx.discardCards(playerIdx, count)` | `Promise` | Force player to discard N cards (opens prompt) |
| `ctx.safePlaceInSupport(cardName, pi, heroIdx, slot)` | `{inst, actualSlot}\|null` | Place card in Support Zone with fallback. Does NOT fire onPlay/onCardEnterZone — caller must do that. |
| `ctx.addStatus(target, statusName, opts)` | `Promise` | Apply a status effect. `opts`: `{ duration, permanent, stacks, bypassImmune, addStacks }`. For **heroes** only. **For creatures**, use `engine.applyCreatureStatus(inst, statusName, opts)` — see below. |
| `ctx.removeStatus(target, statusName)` | `Promise` | Remove a status effect |
| `ctx.addBuff(hero, pi, heroIdx, buffName, opts)` | `Promise` | Add a buff to a hero. `opts`: `{ expiresAtTurn, expiresForPlayer }` |
| `ctx.addCreatureBuff(inst, buffName, opts)` | `Promise` | Add a buff to a creature |
| `ctx.removeBuff(hero, pi, heroIdx, buffName, opts)` | `Promise` | Remove a buff from a hero |
| `ctx.removeCreatureBuff(inst, buffName, opts)` | `Promise` | Remove a buff from a creature |
| `ctx.changeLevel(delta, target?)` | `Promise` | Change a card's level. Defaults to this card if no target. |
| `ctx.negateCreature(inst, source, opts)` | `Promise` | Negate a creature's effects. `opts`: `{ expiresAtTurn, expiresForPlayer }` |
| `ctx.grantAtk(amount)` | — | Grant ATK to this card's hero (tracked for auto-revocation) |
| `ctx.revokeAtk()` | — | Revoke ATK previously granted by this card |
| `ctx.gainGold(amount)` | `Promise` | Gain gold for the controller. Plays animation. |
| `ctx.lockSummons()` | — | Lock summoning for the controller this turn |
| `ctx.isSummonLocked()` | `bool` | Check if controller has summons locked |

### Player Prompts (async — pauses game until player responds)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.promptTarget(targets, config)` | `Promise<string[]\|null>` | Show targeting UI. Returns selected IDs or null. Auto-handles redirect. |
| `ctx.promptDamageTarget(config)` | `Promise<target\|null>` | Build targets + show picker. Config: `{ side, types, condition, damageType, title, description, ... }` |
| `ctx.promptMultiTarget(config)` | `Promise<target[]>` | Multi-select version. Config adds `{ min, max }`. |
| `ctx.executeAttack(config)` | `Promise<{target,damage}\|null>` | Full attack flow: target select → ATK-based damage → animations. Config: `{ damageMultiplier, flatDamage, side, types, excludeSelf, ... }` |
| `ctx.promptConfirmEffect(config)` | `Promise<bool>` | Yes/no dialog. Config: `{ title, message }` |
| `ctx.promptCardGallery(cards, config)` | `Promise<{cardName}\|null>` | Card picker. `cards`: `[{ name, source, cost, ... }]`. **Do NOT use for hand-only picks — see "Hand-only pickers" rule below.** |
| `ctx.promptCardGalleryMulti(cards, config)` | `Promise<{selectedCards[]}\|null>` | Multi-select card picker. Config adds `{ selectCount, minSelect, maxBudget, costKey }`. **Do NOT use for hand-only picks — see "Hand-only pickers" rule below.** |
| `ctx.promptZonePick(zones, config)` | `Promise<{heroIdx, slotIdx}\|null>` | Zone picker. `zones`: `[{ heroIdx, slotIdx, label }]` |
| `ctx.promptStatusSelect(targetName, statuses, config)` | `Promise<{selectedStatuses[]}\|null>` | Status effect picker for removal. |
| `ctx.chooseTarget(type, filter)` | `Promise` | Low-level target chooser |
| `ctx.chooseCards(zone, count, filter)` | `Promise` | Low-level card chooser |
| `ctx.chooseOption(options)` | `Promise` | Low-level option chooser |
| `ctx.confirm(message)` | `Promise<bool>` | Low-level confirm dialog |
| `ctx.performImmediateAction(heroIdx, config)` | `Promise<{played, cardName?, cardType?}>` | Hero-locked additional Action — see below |

### Prompts show the source card's image (automatic)

**Rule:** any prompt that asks the player to **activate an effect, choose between effects, or cancel** displays the prompting card's image, so the player always sees *which* card is asking. This is handled by the engine — you normally do **nothing**:

- **Target prompts** (`promptDamageTarget`, `promptTarget`, `executeAttack`) render a `CardMini` of the source card in the targeting panel via `previewCardName`.
- **Confirms** opened with `promptConfirmEffect` set `showCard` to the source card.
- **Zone pickers** (`promptZonePick`) preview the source card.
- **Direct `engine.promptGeneric` calls** of type `confirm` / `optionPicker` made while a card's hook (`onPlay`, `onCreatureSacrificed`, reactions, …) or activated creature effect is executing are auto-stamped with the resolving card's `showCard` — the engine tracks the active card in `_promptCardStack` and fills it in.

Overrides:
- Pass an explicit `showCard: '<Card Name>'` / `previewCardName: '<Card Name>'` to preview a *different* card (e.g. the equip a Creature is offering).
- Pass `showCard: null` to suppress the image for a prompt where it would be redundant.

Notes:
- Auto-injected images are cosmetic only: they are tagged `_autoShowCard` so they do **not** make a plain cast-confirmation gate Gerrymander-eligible. Only an **explicit** `showCard` on a cancellable confirm is the Gerrymander "you may" marker (see `gerrymander.js`).
- Galleries (`promptCardGallery` / `promptCardGalleryMulti`) already display the choosable cards, so they're exempt from this rule.

### Hand-only pickers — ALWAYS use `handPick`, NEVER a gallery

**Rule:** any prompt that picks one or more cards FROM THE PLAYER'S HAND (and only from the hand) MUST use the `handPick` prompt — `promptCardGallery` / `promptCardGalleryMulti` are reserved for picks that span deck / discard / multi-source pools where a popup is the only sensible UI.

The `handPick` prompt is rendered in-place over the player's existing hand:
- Eligible cards are highlighted via `eligibleIndices` and clickable.
- Click toggles selection; clicking a selected card deselects it.
- Ineligible cards (and dynamically-ineligible ones — name caps full, total maxed, name-locked, etc.) get dimmed automatically.
- The player never leaves the board view, never sees their hand duplicated in a gallery, and can keep dragging / interacting with the rest of the UI exactly as during a normal turn.

Galleries hide the rest of the board behind a modal overlay, force the player to re-recognise their cards in a new layout, and don't compose with hand-level highlighting / drag affordances. For any "pick N cards from hand" mechanic, that's strictly the wrong tool — Visionary Genius Heinz, Leadership, Horn in a Bottle, Mischief Invasion, and every future hand-only multi-pick must funnel through `handPick`.

Reach for `promptCardGallery` / `promptCardGalleryMulti` ONLY when the candidate pool is NOT (or not solely) the hand — Necromancy's discard-pile gallery, Sparkfly Queen's opp-deck steal preview, Saint Nicolas's Potion Deck reveal, etc.

```js
// Canonical hand-only picker. Engine: `engine.promptGeneric(pi, { ... })`.
const result = await engine.promptGeneric(pi, {
  type: 'handPick',
  title: CARD_NAME,
  description: 'Click cards in your hand to mark them. Click again to unmark.',
  eligibleIndices: [...],   // hand indices that may be picked at all
  minSelect: 0,             // 0 lets the player confirm with no picks
  maxSelect: N,             // total cap across all picks
  cancellable: true,
  confirmLabel: '✨ Confirm!',

  // Optional per-type caps. Each hand index maps to a "type" string,
  // and each type has its own cap. The picker dims further copies of a
  // type once its cap is filled (in addition to the global maxSelect).
  cardTypes: { 0: 'Creature', 2: 'Creature', 5: 'Spell' },
  typeLimits: { Creature: 2, Spell: 1 },

  // Optional Heinz-style name lock: after the first pick, only cards
  // sharing that name remain clickable. Toggling the last pick off
  // releases the lock and re-enables every eligible card.
  nameLockOnFirstSelect: true,
});

// Response shape:
//   null OR { cancelled: true }                   → player cancelled
//   { selectedCards: [{ handIndex, cardName }] }  → committed picks
//                                                   (length may be 0 if
//                                                   minSelect was 0)
```

Frontend reference: `app-board.jsx` handles `gameState.effectPrompt.type === 'handPick'` — see `isHandPickEligible`, `isHandPickSelected`, `isHandPickTypeFull`, `isHandPickMaxed`, `isHandPickNameLocked`.

### Immediate Additional Actions (hero-locked)

For "[Hero] may immediately perform an additional Action" effects
(Coffee, Trample Sounds in the Forest, Compulsory Body Swap,
Mana Beacon, Legendary Sword's combo, Invisibility Cloak's Counter-
Attack, etc.), call **`ctx.performImmediateAction(heroIdx, config)`**.
This is the canonical helper — do NOT roll your own by setting
`_spellFreeAction`, `_bonusMainActions`, or pushing into
`heroesActedThisTurn`.

```js
const heroName = engine.gs.players[pi].heroes[heroIdx]?.name || 'the user';
await ctx.performImmediateAction(heroIdx, {
  title: CARD_NAME,
  description: `You may perform an additional Action with ${heroName}!`,
});
```

What you get:
- A banner popup showing the configured title + description.
- Click / drag-drop hard-locked to that hero — Spells, Attacks, and
  Creatures clicked in hand auto-route to the locked hero (no hero
  picker), and only cards the hero can legally cast are highlighted /
  clickable. Action-cost Abilities on the same hero are clickable
  on their ability zones; effects on other heroes (e.g. another
  hero's Adventurousness) are invisible to the prompt.
- Auto-skip when the hero has nothing eligible to do — no empty popup.
- Standard `onPlay` / `afterSpellResolved` lifecycle on the picked
  card, so Wisdom, Bartas, Reiza, chain reactions, etc. all compose
  normally.
- The action does NOT count as the player's main turn-Action — it's
  truly additional.

**★ WHAT AN ADDITIONAL ACTION CAN PAY FOR (Al's ruling, 28.8.)**

The Hero gets an Action **for himself**. That means exactly four things:

| Allowed | Contract |
|---------|----------|
| Play an Attack / Spell / Creature from hand | (card types) |
| Activate his own Hero Effect | `heroEffectActionCost: true` |
| Activate an Ability in his own zones | `actionCost: true` |
| — | — |
| **NOT** a Creature effect in his Support Zones | `creatureActionCost: true` |

The exclusion is deliberate, not an oversight: a Creature is
independent of its slot's Hero, so the granted Action does not reach
it. The Spawn Mother cannot be bounced with a Chalice Action.

A config that RESTRICTS the action (`allowedCardTypes` or
`cardNameFilter` — Invisibility Cloak's "Attack only", Spider Dance's
"a Spider Creature") describes a narrowed action and therefore pays
for **no** board activation at all; only hand cards remain.

`config` options: `title`, `description`, `allowedCardTypes` (subset
of `['Attack','Spell','Creature']`), `skipAbilities`,
`skipHeroEffects`, `cardNameFilter`.

### Action Locks

Two shapes exist, and **`engine.areActionsBlocked(playerIdx)` is the
only place to ask**. Never read the raw flags — that split is exactly
what let Overflowing Chalice and Kent each leak the half the other
covered (fixed 28.8.).

| Source | Field | Shape |
|--------|-------|-------|
| Overflowing Chalice, Puzzle editor | `ps.actionLocked` | boolean, cleared at turn start |
| Kent (negative Gold) | `blocksActions(engine, pi)` on a Hero script | live condition |
| Kent's after-effect | `ps._playerActionLockedTurn` | turn stamp |
| Treasure Hunter's Backpack, Lethe | `hero._actionLockedTurn` | per-hero turn stamp |

Scope: normal Actions, bonus Actions and inherent additional Actions
are all blocked. Hero Effects, Abilities and Creature effects are
blocked **only** when they explicitly cost an Action — a free effect
is not an Action. **Placing** a Creature is never blocked (Staff of
Illusions keeps working); playing a card that places one is (Create
Illusion is a Spell, and a Spell is an Action).

The client receives the answer as the computed `actionLocked` boolean
on the player state — same pattern as `potionLocked`.

### Cancelling out of an additional Action

Picking an Action and then backing out of **that Action's own** prompt
(target picker, confirmation) returns the player to the chooser — it
does not consume the additional Action. Only cancelling the chooser
itself ("Cancel (Esc)") ends it. The re-prompt loop is capped at 24
rounds so a CPU whose every pick auto-cancels can't hang the turn.

Every retry path must roll back what it touched before returning:

| Branch | Cancel signal | Rollback |
|--------|---------------|----------|
| Spell / Attack | `gs._spellCancelled` | card back to its original hand index, instance untracked, return flight broadcast |
| Creature | `summonCreatureWithHooks` returns falsy and the card didn't self-place | card back to its original hand index |
| Ability | `onActivate` returns `false` | `hoptUsed` entry deleted |
| Hero Effect | `onHeroEffect` returns `false` | nothing — the core never stamped HOPT |

A **Gerrymander veto** is not a cancel: the activator committed and the
opponent declined for them, so HOPT stays consumed and the Action is
spent. A **negated** Hero Effect is likewise spent, not retried.

Both `performImmediateAction` and `performImmediateActionAnyHero`
resolve a pick through the same private `_resolveImmediateActionPick`,
so the two behave identically; they differ only in how the acting Hero
is chosen.

### Offering a board activation from inside a prompt

**Highlighting and clicking are two separate conditions.** The client
guards every board activation with `isEffectLocked`, which is true
while ANY prompt is open — including the very prompt that offers the
activation. The highlight classes don't use that guard, so a forgotten
exception looks like "the zone glows, the click does nothing".

Both paths that a `heroAction` prompt offers carry the exception:

```js
// Hero portrait
(isHeroEffectActive && (!isEffectLocked || heroActionEffectEntry) && …)
// Ability zone
(canActivate && (!isEffectLocked || isHeroActionActivatable)) ? … : …
```

Paths the prompt does NOT offer (Creature effects, Equip effects,
Areas, Permanents) keep the plain `!isEffectLocked` guard — there the
highlight is off too, so the two stay consistent.

### Resolving a Hero Effect from a card`engine.resolveHeroEffectActivation(pi, heroIdx, chosen, opts)` runs
the whole lifecycle — negation chain, Surprise window, reveal,
`onHeroEffect`, HOPT stamp, `onAnyActionResolved`, phase advance —
without any action-economy bookkeeping of its own. `server.js`
(`doActivateHeroEffect`) and `performImmediateAction` both go through
it; `opts` says whether an Action was spent, whether it was an
additional one, and whether the main slot was consumed.

### Additional Action System

| Method | Description |
|--------|-------------|
| `ctx.registerAdditionalActionType(typeId, config)` | Register a new additional action type. Config: `{ label, allowedCategories, filter }` |
| `ctx.grantAdditionalAction(typeId)` | Grant an additional action from this card |
| `ctx.expireAdditionalAction()` | Expire this card's additional action |
| `ctx.expireAllAdditionalActions(typeId)` | Expire all of a type for this controller |

### HOPT (Hard Once Per Turn)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.hardOncePerTurn(effectId)` | `bool` | Returns `true` on first use per turn, `false` on subsequent. Auto-marks as used. |

### Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.getCards(filter)` | `CardInstance[]` | Find card instances. `filter`: object or shorthand string (`'mySupports'`, `'enemySupports'`, `'myAbilities'`, `'enemyAbilities'`, `'myHand'`, `'enemyHand'`, `'mySurprises'`, `'enemySurprises'`). |
| `ctx.getHero(playerIdx, heroIdx)` | `hero\|null` | Get a hero object |
| `ctx.getMyHeroes()` | `hero[]` | Get controller's heroes |
| `ctx.getEnemyHeroes()` | `hero[]` | Get opponent's heroes |
| `ctx.isCreatureImmune(inst, immuneType)` | `bool` | Check creature immunity (e.g. `'targeting_immune'`, `'control_immune'`) |
| `ctx.heroName()` | `string` | Get this card's hero's name |

### Utility

| Method | Description |
|--------|-------------|
| `ctx.log(event, data)` | Log a game event |

### Internal (use sparingly)

| Field | Description |
|-------|-------------|
| `ctx._engine` | Direct engine reference. Use for `engine.sync()`, `engine._broadcastEvent()`, `engine._delay(ms)`, `engine._trackCard()`, `engine._getCardDB()`, `engine.promptGeneric()`, `engine.promptEffectTarget()`, etc. |
| `ctx._triggers` | Array for registering follow-up triggers |

---

## Status Effects

Defined in `_hooks.js`. Use with `ctx.addStatus()` / `ctx.removeStatus()`.

| Name | Negative? | Icon | Immune Key |
|------|-----------|------|------------|
| `frozen` | ✅ | ❄️ | `freeze_immune` |
| `stunned` | ✅ | 💫 | `stun_immune` |
| `negated` | ✅ | ⚡ | `negate_immune` |
| `burned` | ✅ | 🔥 | `burn_immune` |
| `poisoned` | ✅ | ☠️ | `poison_immune` |
| `immune` | ❌ | 🛡️ | — |
| `shielded` | ❌ | ✨ | — |

### Applying creature statuses

`engine.applyCreatureStatus(inst, statusName, opts)` is the **single** chokepoint every creature-status applier must use. Direct `inst.counters.<status> = 1` writes are forbidden in new card scripts — they bypass `canApplyCreatureStatus` (immunity gate) and skip the `ON_STATUS_APPLIED` hook fire, which would silently break Bear Rider's hand-level recompute, Chilly Wizard's status mirror, Colored Snow's reaction trigger, and any future creature-status-aware Creature.

```js
await engine.applyCreatureStatus(inst, 'frozen', {
  duration:    2,            // optional — multi-turn statuses
  stacks:      3,            // for stack-bearing statuses (currently only `poisoned`)
  addStacks:   true,         // additive vs overwrite — true for poison stacking
  sourceOwner: pi,           // player who applied — written to `<status>AppliedBy`
  source:      'Cool Card',  // card-name string or { name } object — for logs
  animationType: 'ice_encase', // OPTIONAL — omit / 'none' if you broadcast your own animation
  logEvent:    false,        // default false — opt in for a `status_apply` log entry
});
// → true iff the status actually changed. Idempotent: re-applying an
//   already-present non-stacking status returns false.
```

Returns `true` when the status changed, `false` when blocked (immune, already present and non-stacking, etc.). The helper handles every creature-status convention: `inst.counters[status] = 1` flag, `inst.counters.poisonStacks`, `inst.counters[status + 'Duration']`, `inst.counters[status + 'AppliedBy']` (plus legacy `poisonAppliedBy` / `burnAppliedBy` aliases).

Hero-side, keep using `engine.addHeroStatus(playerIdx, heroIdx, statusName, opts)` — it already fires `ON_STATUS_APPLIED` and is the equivalent hook contract for the hero status map.

`ON_STATUS_APPLIED` and `ON_STATUS_REMOVED` fire for both Heroes and Creatures. The creature path stamps `ctx._onCreature = true` on the hook context so listeners can discriminate; `ctx.target` is the hero object for hero events and the `inst` for creature events.

## Buff Effects

Defined in `_hooks.js`. Use with `ctx.addBuff()` / `ctx.removeBuff()`.

| Name | Icon | Effect |
|------|------|--------|
| `cloudy` | ☁️ | Takes half damage from all sources |
| `submerged` | 🌊 | Untargetable while other targets exist |
| `negative_status_immune` | 😎 | Immune to all negative status effects |

---

## Game State Communication Flags

Card scripts can set these on `gs` (via `ctx._engine.gs`) to communicate
back to the server's play handler:

| Flag | Set by | Effect |
|------|--------|--------|
| `gs._spellCancelled = true` | Spell/Attack `onPlay` | Spell returns to hand (player cancelled target selection). Overridden by `_spellNegatedByEffect` — negated spells always go to discard. |
| `gs._spellFreeAction = true` | Spell/Attack `onPlay` | This spell didn't consume the action — grant another |
| `gs._spellPlacedOnBoard = true` | Spell/Attack `onPlay` | Don't send to discard after resolution (card placed itself) |
| `gs._spellReturnToHand = true` | Spell/Attack `onPlay` | After resolution, return the card to its caster's hand instead of the discard pile (Rocket Fist). Distinct from `_spellCancelled` — the effect DID resolve. |
| `gs._preventPhaseAdvance = true` | Any hook | Keep the current phase open (e.g. bonus actions) |

---

## Speed Levels (Chain System)

| Constant | Value | Can chain onto... |
|----------|-------|-------------------|
| `SPEED.NORMAL` | 1 | Can only START a chain |
| `SPEED.QUICK` | 2 | Speed 1 or 2 |
| `SPEED.COUNTER` | 3 | Anything |

---

## Phases

| Constant | Index | Name |
|----------|-------|------|
| `PHASES.START` | 0 | START |
| `PHASES.RESOURCE` | 1 | RESOURCE |
| `PHASES.MAIN1` | 2 | MAIN1 |
| `PHASES.ACTION` | 3 | ACTION |
| `PHASES.MAIN2` | 4 | MAIN2 |
| `PHASES.END` | 5 | END |

---

## The `onAttackDeclare` slot — "before an Attack's animation"

`onAttackDeclare` is the canonical hook for effects that need to land
**between target selection and the Attack's impact animation/damage**.
Doq's detective guess is the prototype: pick a card from the opp's hand,
declare a type, draw + boost on a hit — all *before* the swoosh, so the
modified damage and any visible UX bursts (the prompt itself, the
"correct!" sparkles) read as a single beat.

### Listening (any card)

```js
module.exports = {
  activeIn: ['hero'],
  hooks: {
    onAttackDeclare: async (ctx) => {
      // Gate to YOUR card's role. ctx.source is { name, owner, heroIdx,
      // controller, [usesHeroAtk] } — the Hero making the attack.
      if (ctx.source?.heroIdx !== ctx.card.heroIdx) return;
      if ((ctx.source?.owner ?? ctx.source?.controller) !== ctx.cardOwner) return;
      // ctx.target is the picked target (object) or array (multi-target).
      // ctx.amount is the about-to-deal damage; mutate via:
      //   ctx.modifyAmount(delta)  — add/subtract
      //   ctx.setAmount(val)       — replace
      //   ctx.addFlatBonus(delta)  — bonus that bypasses buff multipliers
      ctx.modifyAmount(50);
    },
  },
};
```

### Firing it from a new Attack card

Attack scripts that build their own resolution flow MUST call
`engine._fireAttackDeclare(source, target, baseDamage)` AFTER target
selection but BEFORE the impact animation, then use the returned amount
in their damage calls:

```js
const target = await ctx.promptDamageTarget({ /* ... */ });
if (!target) return;

const attackSource = { name: 'My Attack', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseDamage);

// (animation broadcasts go here)
engine._broadcastEvent('play_ram_animation', { /* ... */ });
await engine._delay(400);

// Damage uses finalDmg (post-listener)
await engine.actionDealDamage(attackSource, hero, finalDmg, 'attack');
```

`ctx.executeAttack` already fires the hook internally — Attacks that
delegate to it (Heavy Hit and similar generic ATK-stat hits) need no
additional plumbing.

#### `trailType` bei `play_ram_animation` (v672)

Optionales Feld, drei Werte:

| Wert | Wirkung |
|---|---|
| *(weggelassen)* | Standard-Ram: `ramCharge`, kurzer Glut-Schleier |
| `'fire_stars'` | Basis-Monia / Warrior of Teocuilatl: Feuer + Sterne |
| `'fire'` | **Jetpack-Dash** (Monia Bot): eigene Flugkurve `ramJetCharge`, Auspuff-Fahne am Heck, Schweif als eigene Ebene ENTLANG der Flugbahn |

Der Jetpack-Schweif liegt bewusst **nicht** im Kartenelement — Puffs im
Kartenelement fliegen mit und ergeben per Bauart keinen Schweif. Die
Flug-Anteile stehen doppelt: als `JET` in `public/app-board.jsx` und als
Keyframe `ramJetCharge` in `public/style.css`. Wer eine davon
verschiebt, muss die andere mitziehen; `JET.arriveAt × duration` ist
ausserdem mit dem `_delay(...)` der aufrufenden Karte verzahnt, damit
der Treffer direkt nach dem Aufprall folgt.

`ramCharge` selbst ist fuer laengere Dauern gebaut: bei `duration: 600`
faellt der gesamte Hinflug in 42 ms und die Karte steht danach 420 ms
still. Wer eine Ram-Animation kurz takten will, braucht eine eigene
Kurve — nicht nur eine kleinere `duration`.

### Auto-fire safety net

If an Attack script forgets to call `_fireAttackDeclare`, the engine
auto-fires it from inside `actionDealDamage` / `processCreatureDamageBatch`
when the source is a Hero-attributed Attack-type damage event
(`type === 'attack'`, `source.heroIdx >= 0`, `source.owner` set). In that
fallback the prompt lands *after* the script's animation but still
*before* damage applies — listeners still get their bonus applied. Per-
source dedup via `source._attackDeclareFired = true` ensures the hook
fires exactly once per attack regardless of which path triggered it.

`usesHeroAtk: true` on the source is **not required** — the slot is
formula-agnostic (fires for `atk`-based, `baseAtk`-based, fixed, or
custom-math damage equally).

---

## Common Patterns

### Dealing damage to a prompted target
```js
onPlay: async (ctx) => {
  const target = await ctx.promptDamageTarget({
    side: 'enemy', types: ['hero', 'creature'],
    title: 'My Card', description: 'Deal 100 damage.',
    confirmLabel: '💥 Blast! (100)', cancellable: true,
  });
  if (!target) return;
  const engine = ctx._engine;
  engine._broadcastEvent('play_zone_animation', {
    type: 'explosion', owner: target.owner,
    heroIdx: target.heroIdx, zoneSlot: target.slotIdx ?? -1,
  });
  await engine._delay(400);
  if (target.type === 'hero') {
    await ctx.dealDamage(ctx.players[target.owner].heroes[target.heroIdx], 100, 'destruction_spell');
  } else if (target.cardInstance) {
    await engine.dealCreatureDamage([{ inst: target.cardInstance, amount: 100, source: ctx.card, type: 'destruction_spell' }]);
  }
}
```

### HOPT ability with gold gain
```js
module.exports = {
  actionCost: true,
  onActivate: async (ctx, level) => {
    await ctx.gainGold(10 * level);
  },
};
```

### Once-per-game spell with shared key
```js
module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'mySharedKey', // Other cards with same key share the restriction
  hooks: {
    onPlay: async (ctx) => { /* ... */ },
  },
};
```

### Passive hero with per-turn tracking
```js
module.exports = {
  activeIn: ['hero'],
  hooks: {
    onTurnStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (hero) hero._myCardTracking = []; // Reset own tracking
    },
    onActionUsed: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      // React to actions...
    },
  },
};
```

### Hand-Reaktionen: wer castet? (v619, Als Regel 29.8. — MANDATORY)

Reaction-**Attacks, Spells und Creatures** aus der Hand brauchen einen
castenden Helden: lebend, nicht Frozen/Stunned/**Negated** (jede Form),
der Schule **und** Level der Karte erfuellt (Wisdom zaehlt; Reaction-
Creatures brauchen zusaetzlich eine freie Support Zone). Reaction-
**Artefakte und Potions** haben KEINE dieser Einschraenkungen (Strong
Shield feuert auch bei drei toten Helden).

Eine Auslegung: `engine._rxHandCastingHero(pi, cardName)` (Index des
Casters, `-1` = keiner, `null` = braucht keinen) bzw.
`engine._rxHandCardCastable(ps, cardName)`. **Jedes** Hand-Reaktions-
fenster fragt dort; ein neues Fenster setzt die Zeile direkt hinter
seinen `'seen'`-Vermerk. `_canHeroActivateSurprise` traegt die
Negated-Sperre ebenfalls — auch Surprises vom Brett castet ein
negierter Held nicht mehr.

### Klang einer Animation wird verschluckt? — die 'effect'-Kategorie (v625)

Jeder Klang aus `ZONE_ANIM_SFX` laeuft (ohne eigenes `category`) in der
Kategorie **`effect`**, und die faltet innerhalb von **400 ms** alle
Klaenge dieser Kategorie auf EINEN zusammen. Folge: ein Einschlag, der
kurz nach dem Spell-Cast-Cue (oder einem anderen Effektklang) faellt,
ist stumm — so ging es Meteor Crash und dem Blitzregen des Piercer.

Wenn ein Auftritt seinen Klang **zuverlaessig** und/oder **mehrfach**
(je Blitz, je Einschlag) braucht, spielt die Komponente ihn selbst:
`window.playSFX(name, { ..., dedupe: 0 })` — **ohne** `category` — per
`setTimeout` auf den Moment des Aufschlags, und der Typ bekommt
**keinen** `ZONE_ANIM_SFX`-Eintrag (sonst doppelt). Vorbilder:
`LightningRainEffect`, `MeteorCrashEffect`. Das Kategorie-Fenster
selbst bleibt fuers Erste unangetastet (Als Entscheidung 29.8.).

### „One or more of your Creatures are defeated" — Sammel-Fenster (v1292)

Das Einzel-Fenster `isCreatureDefeatedReaction` (Pawn Chain, Troop
Annihilation) feuert je Tod — bei einem Flächenschlag also schon beim
ersten Opfer. Für „choose one of THOSE Creatures" gibt es das
**Sammel-Fenster**: die beiden Todeswege (`processCreatureDamageBatch`,
`actionDestroyCard`) öffnen einen Sammler (`_mitNiederlagenSammler`,
verschachtelt zählt nur der äußerste), jeder `onCreatureDeath` trägt
sich ein, und beim Schließen öffnet sich das Fenster EINMAL mit allen
Opfern — am fertigen Zustand (Ablage, Anspruch, Extra Life erledigt).
Besiegen ohne Schaden zählt mit (Als Ruling 23.9.).

```js
isCreaturesDefeatedReaction: true,
creaturesDefeatedCondition(gs, pi, engine, defeated) → bool,
async creaturesDefeatedResolve(engine, pi, defeated, { casterIdx }),
// defeated = [{ name, owner, originalOwner, controller, heroIdx,
//               zoneSlot, instId, source, type }]  — nur Seite pi
```

Caster, Kosten, Flug in die Ablage, Auftritt und Log macht die Engine
(`_rxHandkarteEinsetzen`, gemeinsam mit dem Einzel-Fenster). Log-Typ
`creatures_defeated_reaction`. Vorbild: Zombified Assault.

**Brett-Seite (v1301):** Derselbe Vorgang liefert danach den Hook
`onCreaturesDefeated` (`HOOKS.ON_CREATURES_DEFEATED`) mit `ctx.defeated`
— EIN Aufruf je Vorgang, beide Seiten in der Liste. Für passive Effekte
auf „when a Creature you control is defeated", die nur einmal je
Flächenschlag feuern sollen. Vorbild: Junshi, the Tactical Genius
(Gegenschlag per `performImmediateAction` mit `cardNameFilter`).

### Aufstieg aus dem Deck — `performAscension(… { fromDeck, skipChain })` (v1296)

`opts.fromDeck: true` nimmt den Ascended Hero aus dem DECK statt aus der
Hand: Entnahme über die Stapel-Schicht (Sperren, Deckkopf, danach
gemischt), Flug Deck → Held; der `handIndex` wird ignoriert. Kein Umweg
über die Hand (Throne-Robber-Trick) — ein Zustandsversand dazwischen hätte
die Karte dort kurz gezeigt.

`opts.skipChain: true` lässt das eigene Kettenfenster des Aufstiegs weg,
wenn die auslösende Karte ihre Kette schon hatte. Anders als
`notAnAscension` zählt der Aufstieg VOLL: Bedingung, Kosten
(`payAscensionCost`), `ON_ASCENSION`, Bonus, Aufstiegs-Reaktionen.

Das Zugende des Aufstiegs gibt eine Spell-Karte über
`gs._spellEndsTurn = 'baseMechanic'` weiter: es feuert NACH der
Auflösung der Karte und ist Grundmechanik — Zug-Ende-Immunität (Tuscan
Prisoner) greift nicht (Als Ruling 16.8.). Formen mit
`blockEndPhaseOnAscend` liefern `skipEndPhase: false`, dann passiert
nichts. Vorbild: Ultimate Weapon Experiment.

### Reaktionssperre und unaufhaltsames Besiegen (v1293)

`await engine.ohneGegnerReaktion(pi, fn)` — solange `fn` läuft, kann der
Gegner von `pi` auf nichts reagieren (Hand, Surprise, Kette,
Brett-Reaktionen). Für das Kettenfenster der Karte SELBST zusätzlich das
Skript-Flag `opponentCannotReact: true`. Vorbild: Midnight Assault.

`opts.unaufhaltsam` an `actionDestroyCard` / `actionDefeatHero`:
„ignores any effect that would prevent the target from being defeated".
Überspringt Unzerstörbarkeit, Immunitäten, Wächter, Rettungsfenster und
Hooks, die den Tod verhindern. Die Erstrunden-Schonung bleibt (Regel,
kein Effekt).

### Eigene Levelsenkung zählt einmal — `selbstsenkungZaehlt` (v1293)

„This card's level is reduced by …": die Engine fragt JEDE aktive
Instanz. Zwei Kopien auf der Hand senkten doppelt. Pflicht in jedem
`reduceCardLevel`, der die EIGENE Karte senkt:
`if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx[, { zone: 'hand' }])) return 0;`
(`_hooks.js`; `zone` nur, wenn die Senkung laut Text nur in einer Zone gilt).

### Wiederbeleben ohne Beschwörung — `reviveCreatureFromDiscard` + `onRevive` (v1292)

`await engine.reviveCreatureFromDiscard(pi, pileOwner, name, heroIdx, slot, { source, animType, animMs })`
holt eine Kreatur aus einer Ablage zurück: Flug Ablage → Zone, frische
Instanz mit vollen HP, **keine** On-Summon-Hooks, kein
`creature_summoned`. Rückgabe Instanz oder `null` (Karte liegt dann
wieder in der Ablage).

Weil dabei `onCardEnterZone` nicht läuft, bekommt die wiederbelebte
Karte — und NUR sie — ihren eigenen `onRevive(ctx)` (Modulebene, nicht
in `hooks`). Dorthin gehört, was eine Kreatur sonst beim Betreten der
Zone an sich selbst setzt (Doomed Town Guards Schirm). Derselbe Aufruf
läuft auch im hooklosen Extra-Life-/Bone-Dog-Weg.

### „Vom Brett per Effekt in die Ablage" — `onBoardSentToDiscard` (v697)

Exportiert eine Karte `async onBoardSentToDiscard(ctx)`, ruft die
Engine sie auf, NACHDEM ein EFFEKT die Karte von einer Brettzone
(support / surprise / ability / area) in einen Discard Pile bewegt
hat — The Yeeting, Mizunes Opfer, jeder kuenftige Entferner. NICHT
dabei: die Ablage einer Surprise nach ihrer EIGENEN Aufloesung,
Schadenstode von Creatures, Abwuerfe aus der Hand. ctx: `_engine`,
`cardOwner`, `cardName`, `fromZone`, `fromHeroIdx`, `zoneSlot`,
`source`, `sourceOwner`. Aufrufstellen: Ende von `actionMoveCard`
(Discard-Ziel) und `engine._fireBoardSentToDiscard(...)` fuer
manuelle Pfade (Mizune). Tiefenriegel 6 gegen Endlosketten —
Ketten (Aquatic) sind Design. Vorbilder: aquatic-arrows/-shield/-spear.

### Surprise-Fenster des VERURSACHERS — `surpriseDealtDamageTrigger` (v697)

„Activate this Surprise when YOU deal damage …": Flag/Funktion
`surpriseDealtDamageTrigger(gs, ownerIdx, hostHeroIdx, info, engine)`
laesst die Surprise ueber `_checkSurpriseOnDealtDamage` feuern,
nachdem der BESITZER Schaden ausgeteilt hat — Helden- UND
Kreaturenziele, beide Seiten, mit `realDealt`. `info` traegt
`targetKind` ('hero'|'creature'), `targetOwner/HeroIdx/SlotIdx`,
`targetInst`, `targetCardName`, `targetAlive`, `amount`,
`damageType`. Status-Ticks zaehlen NICHT (Als Ruling; Helden-Ticks
blockt der owner-lose Quell-Gate, Kreaturen-Ticks der
`isStatusDamage`-Waechter am Batch-Aufruf). Das Flag steht in der
Skip-Liste des generischen Fensters. Vorbild: aquatic-spear.

### Eintritts-Fenster „Creature betritt eine Support Zone" (v699)

„Activate this Surprise when a Creature ENTERS a Support Zone …"
(Aquatic Arrows, Als neuer Effekttext): Flag/Funktion
`surpriseCreatureEnterSupportTrigger(gs, ownerIdx, hostHeroIdx, info,
engine)` feuert ueber `_checkSurpriseOnCreatureEnterSupport` fuer
JEDEN offenen Kreatureneintritt — Beschwoerung, place-Effekt UND
reine Bewegung (Slippery-Familie, Slippery Skates, Dark Gear,
Engine-Transfers, Hunting-Uebernahme). `info`: `zoneOwner`
(BRETTSEITE der betretenen Zone), `heroIdx`, `cardName`,
`cardInstance`, `isMove`, `isPlacement`. Verdrahtung: eigener Block
im onCardEnterZone-Verteiler von `runHooks`, ABSICHTLICH ohne den
`_skipReactionCheck`-Gate des aelteren Surprise-Verteilers (das Flag
meint die Hand-Reaktionskette und steht an fast jedem Eintrittspfad);
eigener Unterdruecker `_skipEnterSupportSurprise`; nimmt auch die
actionMoveCard-Form (`hookCtx.card`) an; Hunting-Uebernahme ruft das
Fenster explizit in `_redeemDeathClaim` (sie feuert per Ruling keine
Hooks, betritt die Zone aber trotzdem). NICHT dabei: verdeckte
Eintritte (Bakhm-Sets) und der Flip eines liegenden Bakhm-Hosts (der
betritt nicht). Flag steht in der Skip-Liste des generischen
Fensters. Beide Spieler werden gescannt.

### Prae-Schaden-Fenster: Selbstquelle + Status-Ticks (Opt-ins, v697)

`_checkDamageSurpriseWindow` (Banner-Bearer-Kanal,
`firesOnAnyDamageTarget: true`) sieht per Default weiterhin nur
GEGNER-Schaden ohne Status-Ticks. Zwei neue Opt-ins erweitern das
je Skript: `firesOnSelfSourcedDamage: true` (eigenquelliger Schaden,
The Yeeting auf den eigenen Helden) und `firesOnStatusTickDamage:
true` (Burn/Poison-Ticks — Quellen `{name:'Burn'|'Poison'}` ohne
owner, Helden-Pfad). Bestandskarten bleiben unveraendert. Vorbild:
aquatic-shield.

### Einmal-Schadensschilde (Engine-generisch, v697)

„Reduce the next damage <target> would take … by N":
`engine._grantOneShotDamageShield(kind, holder, amount, sourceName,
ownerIdx)` mit kind 'hero' (holder = Hero-Objekt) oder 'creature'
(holder = Instanz). Verbrauch zentral in beiden Schadenspfaden:
flat NACH Punkt-vor-Strich, ALLE Ladungen eines Ziels kumulativ am
NAECHSTEN Schadensereignis > 0 (Als Ruling: 3×100 = 300 auf den
ersten Treffer, alle verbraucht). `cannotBeReduced` (Tempeste, Ida)
laesst sie wirkungslos UND unverbraucht. Verfall zu Zugbeginn des
`ownerIdx` (vor den Status-Ticks). Anzeige (v698): beim Verbrauch die
bestehende `shield_block`-Animation; solange Ladungen liegen, rendert
`StatusBadges` einen 🌊-Badge mit Summen-Tooltip direkt aus der Liste
(Helden: `hero._oneShotDmgShields` per Spread; Creatures:
`counters._oneShotDmgShields`) — die Liste geht wortwoertlich in den
Sync, Karten muessen NICHTS fuer die Anzeige tun und bauen auch KEINE
eigene Verbrauchs-/Verfallslogik.

### Surprise-Confirms: Skalare fuer Karten-`cpuResponse` (v697)

Die Aktivierungs-Confirms der Fenster tragen nackte Skalare, damit
ein Karten-`cpuResponse` lagebezogen entscheiden kann:
`_hostHeroIdx` (Scanner, alle Fenster), `_damageAmount`
(Prae-Schaden-Fenster), fensterspezifische Extras via
`promptConfig.extra` (Verursacher-Fenster: `_targetIsOwn`). NUR
serialisierbare Skalare in Prompt-Payloads — nie Instanzen.

### Zielwahl-Fenster: NEGATION statt Umleitung (v701, Rolling Boulder)

Eine `isSurpriseRedirect`-Surprise darf aus `onSurpriseActivate` statt
`{ redirectTo }` auch `{ negateEffect: true }` liefern: der
anvisierende Effekt ist KOMPLETT negiert. `_checkTargetRedirectOnce`
gibt dann das Sentinel `{ _redirectNegated: true, _bySurprise }`
zurueck (Log `target_negated_by_surprise`); `_checkTargetRedirect`
rekursiert darauf nicht; `applyRedirectWindows` liefert eine LEERE
Auswahl (jedes Karten-Skript bricht darauf ab), der
`promptTarget`-Pfad bricht das Targeting mit `null` ab und raeumt das
Spell-Log. `applyRedirectWindows` reicht die Pick-Anzahl als
`config._redirectPickCount` an die Fenster (der Einzelziel-Picker
traegt keine und zaehlt als 1) — Gate fuer „exactly 1 target".
Der Scan liefert nur Ziele des scannenden Spielers: `selected.owner
=== pi` gilt strukturell, Karten brauchen dafuer kein Gate. Der
Redirect-Confirm traegt jetzt auch `showCardLeft` (v700-Konvention).

Als Ruling: „cannot be redirected" ≠ „cannot be negated".
`cannotBeRedirected` (Quell-Skript, Targeting-Konfiguration, Truth-
Seeing Eye) sperrt nur die UMLEITUNGS-Ausgaenge — intern als
`config._noRedirectOutcome`: Hand- und Helden-Scans entfallen,
umleitende Surprises schweigen, negierende Surprises
(`isSurpriseNegation: true` neben `isSurpriseRedirect`) werden weiter
angeboten. Nur ein Effekt, der selbst „cannot be negated" ist
(`cannotBeNegated` am Quell-Skript oder `config.cannotBeNegated`),
oeffnet kein Negations-Fenster. Ein Negierer traegt BEIDE Flags.

Zonen-Animation `rolling_boulder` (v702): Start am rechten Rand auf
50 % Spielfeld-Hoehe (`.board-mid-row`), geradlinig im Winkel aufs Ziel
und in derselben Linie hinaus, konstante Geschwindigkeit, Drehung an
die Wegstrecke gekoppelt (π·d), Aufprall FEST bei 380 ms (Einlauf
darauf normiert, Auslaufdauer bildschirmabhaengig) — Karten setzen
ihre Folgewirkung auf den Aufprall (`_delay(420)`) und senden
`duration: 2400` mit. LEHRE: der Zonen-Dispatcher raeumt Animationen
nach 1000 ms ab — jede laengere Animation braucht `duration` im
Broadcast. Klang: `ZONE_ANIM_SFX` darf seit v702 eine SEQUENZ sein
(Array von {name, opts}); Sequenzteile tragen `category: null` und
`dedupe: 0`, sonst schluckt die Kategorie-/Namenssperre jeden zweiten
Schlag. LEHRE (v702): `playSFX` beurteilt verzoegerte Klaenge jetzt
im Moment des Abspielens — vorher liefen die Dedupe-Pruefungen zur
AUFRUFZEIT, und ein Klang mit `delay` wurde von einem Effekt-Klang
verschluckt, der kurz VOR dem Aufruf gespielt hatte (der Fels blieb
komplett stumm, weil die Surprise-Aufdeckung die Kategorie belegte).

`_targeting-shared.js`: `isOppCreatureEffect(engine, pi, sourceCard)`
— die EINE Auslegung „gegnerischer Creature-Effekt" (aus Shield of
Wisdom extrahiert; Rolling Boulder ist der zweite Nutzer).

### `actionPlaceCreature` von der Hand: sichtbarer Flug (v700)

Platzierungen mit `source: 'hand'` (Standard) senden seit v700 SELBST
den `play_pile_transfer`-Flug Hand → Support Zone (vor dem Splice, mit
exaktem `fromHandIdx`) und warten 720 ms auf die Landung, BEVOR die
Poof-Animation und die Eintritts-Hooks laufen — Folge-Effekte (Monamis
Draw) duerfen nicht vor dem sichtbaren Eintreffen ablaufen
(Hunting-Lehre). Als Befund v700: Monamis geplacte Creature „erschien
einfach". Aufrufer senden KEINEN eigenen Flug mehr (Doppelflug);
`opts.skipPileTransfer` fuer eigene Choreographien. Im Fast
Mode/MCTS entfaellt beides.

### Zonen-Animationen `shield_block` + `aquatic_arrow_rain` (v700)

`shield_block` ({owner, heroIdx, zoneSlot}) ist seit v700 REGISTRIERT
— der Typ wurde seit jeher gesendet (Shield of Wisdom, Aquatic Shield,
Einmal-Schild-Verbrauch), lief aber still ins Leere: NIE einen
Broadcast-Typ senden, ohne seine Registrierung in ANIM_REGISTRY zu
pruefen. Klang 'heavy_impact' rate 1.25 (gedaempfter Aufprall), dedupe.
`aquatic_arrow_rain` ist die Wasser-Fassung von `arrow_rain` (Aquatic
Arrows, je getroffener Creature ueber `animType` am Batch-Eintrag);
Klang 'projectile' rate 1.15 mit dedupe.

### Surprise-Confirms zeigen die Surprise LINKS (v700)

Beide Aktivierungs-Confirms (`_scanSurpriseEntriesForPlayer` und
`_checkDamageSurpriseWindow`) senden `showCardLeft` = die angebotene
Surprise selbst; `showCard` (rechts) bleibt der Ausloeser. Der Client
rendert `showCardLeft` bereits generisch — kuenftige Fenster geben es
einfach mit.

### Vom Deck verdeckt in eine Zone legen: Reihenfolge (v698)

Fliegt eine Karte sichtbar in eine SURPRISE Zone (der Aquatic-
Nachschub), gilt: erst der `play_pile_transfer`-Broadcast (`to:
'surprise'`, `toHeroIdx`, `faceDown: true`), dann `_delay(700)` (die
Transitzeit des Pile-Flugs beim Client), ERST DANACH Zonen-Push,
`_trackCard` und `sync()`. Der Client kennt fuer Surprise-Ziele kein
Ziel-Verstecken (das existiert nur fuer Support-Slots), also traegt
der Server die Ordnung — sonst steht die Karte schon in der Zone,
waehrend der Flug erst losgeht (Als Befund v698). Waehrend der
Transitzeit ist die Karte bewusst nirgends (aus dem Deck gezogen,
noch nicht in der Zone); der Ablauf haelt dort ohnehin.

### Archetyp „Aquatic" (v697)

Namensbezug „an \"Aquatic\" Surprise" = Teilstring im Kartennamen
(bindende Namensregel), EINE Auslegungsstelle: `_aquatic-shared.js`
(`isAquaticSurprise`) — dort auch der geteilte Discard-Rider
`offerAquaticReplacement(engine, pi, heroIdx, sourceName)`:
Galerie („you may"), Reveal fuer beide, verdeckt in die
freigewordene Zone, Deck mischen. KOMPLETT vom Helden-Zustand
losgeloest (Als Ruling: auch die Zone eines toten Helden wird
nachbestueckt); einzige Bedingungen sind Herkunft = Surprise Zone
und freie Zone. CPU-Galerie-Antwort: `cpuPickReplacement`. Aquatic Spear (v698)
sendet vor dem Wasser die eigene Zonen-Animation
`aquatic_spear_strike` (Speer stuerzt und spiesst auf, Einschlag
~280 ms; Klang: ZONE_ANIM_SFX → 'projectile' rate 0.75 delay 180).

### Hand-Abwurf: Flug und Takt kommen aus dem Helfer (v696)

Alle drei Hand→Ablage-Wege (`actionDiscardHandCard`,
`actionPromptForceDiscard`, `actionDiscardCardsAnimated`) senden den
`play_pile_transfer`-Flug vom exakten Hand-Slot SELBST und halten
ueber eine gemeinsame Zeitmarke (`engine._lastHandDiscardAt`,
Wanduhr, nicht im Spielzustand) den Abwurf-Takt `DISCARD_PACE_MS`
(0,5 s) ein — auch ueber GEMISCHTE Folgen und ueber Karten-
Klickschleifen hinweg (Cute Hydra, Cute Dog, Annoyance Mini). Eine
Karte, die je Pick `actionDiscardHandCard` ruft, braucht daher
**keinen eigenen Broadcast und keinen eigenen `_delay`** — ein
zusaetzlicher Broadcast waere ein zweiter Flug derselben Karte.
Bei menschlicher Wahl kostet der Takt nichts (der Abstand ist laengst
da); bei CPU-Picks verhindert er den Gleichzeitigkeits-Burst.

Opt-outs von `actionDiscardHandCard`, nur fuer bewusst abweichende
Zeitfuehrung: `flightStyle` (Champion: `'windstorm'`), `_noPace`
(eigener, engerer Takt — Champion), `_noFlight` (Aufrufer sendet den
Flug selbst, z.B. Draw: beide Fluege auf EINEM Takt vor beiden
Splices). Gestempelt wird immer, damit der naechste Abwurf Abstand
haelt. Sim-sicher: in Fast Mode/MCTS wird weder gewartet noch
gestempelt.

### Discard-out-Sperre und Freikauf (v626)

„You cannot move cards out of your discard pile for the rest of the
turn" = `ps._discardLockedTurn = gs.turn` (Staebe). The Eye of Ren
haengt einen **einmaligen** Freikauf daran:
`ps._discardLockBuyout = { cost: 6, turn, source, paidTurn: null }`.

EINE Auslegung: `await engine._discardOutAllowed(pi, opts)` — gefragt
von `addCardFromDiscardToHand`, `actionRecycleCards`,
`actionPlaceCreature` (source 'discard'), `actionMoveCard` (aus dem
Discard) und First Circle's Massen-Loeschung. Ein **Pflicht**effekt
uebergibt `{ mandatory: true }` und bekommt den Freikauf mit allem
vorhandenen Gold (auch 0); optionale Wege fragen den Spieler bei
ausreichend Gold. Wer Karten aus dem Discard bewegt, geht durch einen
dieser Wege — nie per `discardPile.splice` vorbei.

**Ablehnung = Abbruch (v627):** lehnt der Spieler den Freikauf ab,
gilt das Ausspielen der Karte als Cancellation — `executeCardWithChain`
macht aus dem Ergebnis `{ cancelled: true }` (Karte bleibt in der Hand,
Kosten zurueck). Hat die Karte VOR der Discard-Bewegung schon etwas
Bleibendes getan, setzt sie `discardOutDeclineConsumes: true` und ist
dann trotzdem verbraucht.

### Artefakte aus Skripten ausruesten (v628) — `_orchestra-shared.js`

Kein Pile-Splice + Zone-Push + `_trackCard` mehr in Kartenskripten:
`equipDestinations(engine, pi, cardName, { sides })` liefert freie
Basisplaetze lebender, nicht eingefrorener Helden, die das Skript-Gate
`canEquipToHero` bestehen; `equipArtifactToHero(engine, pi, cardName,
ownerOfHero, heroIdx, slotIdx, { from: 'hand'|'deck'|'discard', source })`
entnimmt, legt, trackt, animiert, feuert `onPlay` + `onCardEnterZone`.
Der Besitzer bleibt `pi` — auch wenn die Karte beim Gegner liegt
(Orchester: „Heroes on the board"). Aus dem Discard gilt die
Discard-out-Sperre. Cool Repair, Gate to the Armory & Co. sind noch
handgestrickt — bei der naechsten Beruehrung umstellen.

**Instrument-Trigger** („when this Artifact equipped to a Hero you
control is sent to the discard pile … once per turn"):
`instrumentDiscardTrigger(ctx, cardName, hoptKey)` in `onCardLeaveZone`
mit `activeIn: ['support']` und `bypassDeadHeroFilter: true` (feuert
auch beim Equip-Abbau nach Heldentod). Deckt „you control" (Controller
= Besitzer) und das Einmal-pro-Zug je Kartenname ab.

**Multi-Galerie `exactBudget` + `distinctNames`** (v628/v629): mit
`costKey` — Confirm nur, wenn die Kostensumme der Auswahl GENAU diesen
Wert trifft; `distinctNames: true` verbietet denselben Namen zweimal
(z.B. aus zwei Quellen). Karten „von ueberall" anbieten heisst: je
(Name, Quelle) EIN Eintrag wie bei Barker, die Antwort ueber
`selectedIndices` aufloesen (die Quelle steckt im Eintrag). Serverseitig
trotzdem nachpruefen (CPU-Antworten laufen nicht durch den Client).

### Heldenstatus `damage_proof` (v628)

Positiver Status (Storm Piano): `_actionDealDamageImpl` blockt jeden
normalen Schaden, **True Damage trifft trotzdem** (Als Ruling; die
Carris-Ausnahme steht nur dort im Text). Setzen mit
`addHeroStatus(pi, hi, 'damage_proof', { armedTurn: gs.turn, source })`;
laeuft am Zugende des Besitzers ab, sofern `armedTurn !== gs.turn`
(= „until the end of your next turn"). Client zeigt 🎹.

### Helden-Vertrag `firewallModifiers` (v633)

Firewall liest vom Helden, unter dem die Surprise liegt (nur lebend):
`firewallModifiers: { extraDamage, burnAllOpponentTargets }` (Objekt oder
Funktion `(gs, pi, heroIdx, engine)`). Luna: +100 und permanenter Burn
auf alle Ziele des Gegners. Muster fuer weitere „This Hero's <Karte> …"-
Texte: der Vertrag traegt den Kartennamen, nie der Heldenname im Karten-
skript.

### Abilities koennen das Zielen blocken (v634)

`heroBlocksTargeting` fragt neben den Support-Karten (Jetpack) auch die
ABILITY-Zonen: ein Ability-Skript mit `blocksTargeting(gs, engine, info)`
(info: `sourceData`, `damageType`, `cardName`, `chooserIdx`, `heroOwner`,
`heroIdx`) macht den Helden in den Ziel-Pickern `ineligible`. Im
Schadenspfad („or hit", Flaechen) fehlt `chooserIdx` — Stealth blockt
dort bewusst nicht („cannot be CHOSEN"). Anti-Lock gehoert ins Skript
(Stealth: nur, wenn ein anderer waehlbarer Held existiert). Abzeichen
leitet der Client aus der Ability-Zone ab — kein Status, kein Puzzle-
Editor-Feld.

### Art einer Effektquelle — `engine.sourceEffectKind(src)` (v637)

`'attack' | 'spell' | 'creature' | 'hero' | 'artifact' | 'potion' |
'ability' | 'surprise' | null` fuer die Karteninstanz hinter einem
Picker/Schaden (Zone zuerst, dann Kartentyp). Umleitungs-Vertraege
bekommen die Quelle als 8. Argument: `canHeroRedirect(gs, ownerIdx,
heroIdx, selected, validTargets, config, engine, sourceCard)` — Alleria
leitet nur `attack`/`spell`/`creature` um (Heldeneffekte wie Locke
nicht).

### Umleitungsfenster — `engine.applyRedirectWindows(...)` (v672)

`await engine.applyRedirectWindows(pickedIds, validTargets, config,
sourceCard)` ist die **eine** Auslegung von „nach der Zielwahl darf der
Zielbesitzer umleiten". Sie ersetzt drei getrennte Vorpruefungen
(`ctx.promptTarget`, `promptEffectTarget`, `doConfirmPotion` in
server.js), die alle dieselbe Schranke `selectedIds.length === 1`
trugen — ein Effekt mit mehreren Zielen (Book of Doom) kam damit an
jeder Umleitung vorbei.

* **Je gewaehltem Ziel ein eigenes Fenster.** Ein Umleiter reagiert auf
  jedes Ziel einzeln und beliebig oft pro Runde (Als Vorgabe 31.8.).
* **Laenge und Reihenfolge der ID-Liste bleiben.** Aufrufer, die Kosten
  aus `selectedIds.length` rechnen, bleiben unberuehrt. Leiten zwei
  Ziele auf denselben Helden um, steht seine ID zweimal drin — der
  Effekt trifft ihn dann auch zweimal.
* Riegel: keine Quelle, `config.cannotBeRedirected`,
  `config._skipRedirectCheck`, Rekursionssperre `_inRedirectWindow`,
  Ziel-Art nur `hero`/`equip`, und die umgeleitete ID muss in
  `validTargets` stehen.
* **Karten rufen das NICHT selbst.** `ctx.promptTarget` reicht seine
  `cardInstance` als `config._redirectSource` an `promptEffectTarget`
  durch; wer eine eigene Zielsitzung baut, nimmt
  `engine._redirectSourceFor(playerIdx, config)` fuer die Quelle mit
  Besitzer.
* Bekannte Grenze: der CPU-/Fast-Mode-Schnellpfad in
  `promptEffectTarget` kehrt vor dem Fenster zurueck — waehlt die CPU
  ueber diesen Dispatcher, oeffnet weder Umleitung noch
  Post-Target-Reaktion. Ziel-Artefakte und Traenke sind nicht betroffen,
  die laufen bei beiden Seiten durch `doConfirmPotion`.

### Confirm-Antworten auswerten — `engine._confirmSaidYes(antwort)` (v672)

`promptGeneric` liefert bei einem Nein **drei** verschiedene Dinge: der
Mensch `{ cancelled: true }`, die Standard-CPU `null`, ein Kartenskript
mit eigenem `cpuResponse` aber `{ confirmed: false }` — und das ist ein
wahrheitsfaehiges Objekt. `if (!antwort)` liest so ein Nein als Ja.
Immer `engine._confirmSaidYes(antwort)` benutzen (dritter Fund dieser
Falle; zuvor `normalizeConfirm` und Soul Shard Shut).

### Platzieren statt Aufsteigen — `notAnAscension` / `notADescend` (v673)

Optionen an `performAscension` / `performDescend`, für Karten, die einen
Ascended Hero auf einen Helden setzen (oder wieder herunternehmen),
ohne dass es als Ascending bzw. Descending gilt — Open Invitation ist
der erste Fall.

`performAscension(pi, heroIdx, name, handIndex, { notAnAscension: true })`
sperrt genau das, was am BEGRIFF „Ascending" hängt:
* den `ON_ASCENSION`-Hook (Reaktionsfenster),
* den Ascension Bonus der Zielkarte,
* die Aufstiegs-Handreaktionen (`isAscensionReaction`),
* das automatische Zugende (Grundmechanik des Aufstiegs),
* das innere Negations-Fenster (`executeCardWithChain`) — die Karte wird
  PLATZIERT und steckt schon in der Kette der platzierenden Karte.

Die Zustandsübertragung — Name, HP-Delta, Zonen, Instanz-Umhängung,
`onAscendSetup`, `formsAscensionStack` — läuft unverändert; das IST das
Platzieren. Der Log-Eintrag heißt `hero_form_placed` statt
`hero_ascension`; der Broadcast bleibt `hero_ascension` (er ist die
ANZEIGE des Formwechsels, kein Regelbegriff).

**`skipBonus` nicht zusätzlich mitgeben** — `notAnAscension` deckt ihn
ab, und zwei Riegel für dieselbe Sache heißen, dass ein Rückbau an
einem davon unbemerkt bleibt.

`performDescend(pi, heroIdx, { notADescend: true })` ist das
Gegenstück. Heute unterscheidet es nur den Log-Eintrag
(`hero_form_returned`), weil `_hooks.js` gar kein `ON_DESCEND` kennt —
es ist bewusst vorab da und die EINE Stelle, die ein künftiges
Descend-Fenster abfragen muss.

### Kadaver beanspruchen — `onCreatureDeathClaim` + `_deathClaim` (v679b)

Fuer Karten, die eine sterbende Creature fuer sich beanspruchen
(„statt sie auf den Ablagestapel zu legen …", „nimm die Kontrolle").

Der Hook `onCreatureDeathClaim` feuert in **beiden** Todespfaden —
im Schadens-Batch und in `actionDestroyCard` (Insta-Kills wie Ralzish,
Sacrifices) — jeweils **bevor** der Kadaver auf einen Stapel gelegt und
bevor der Flug dorthin gesendet wird, und vor `ON_CREATURE_DEATH`.
`ctx.type` ist dort der Schadenstyp bzw. `'destroy'`. Die Einloesung
teilen sich beide Pfade in `_redeemDeathClaim(claim, herkunft)`.
Nicht abgedeckt ist der Auto-Promote in `actionMoveCard` (support →
discard ohne `actionDestroyCard`) — dort ist der Flug schon gesendet,
bevor die Engine vom Tod weiss. Das ist entscheidend: fragt man
erst im Todes-Hook, sieht der Spieler die Karte zuerst zum
Ablagestapel fliegen und wird danach gefragt (Als Befund 31.8.).

Wer beansprucht, stempelt auf die sterbende Instanz:

```js
inst._deathClaim = { to: 'hand',    name, owner, by };
inst._deathClaim = { to: 'support', name, owner, heroIdx, zoneSlot,
                     keepOriginalOwner, negate, by };
```

Der Tod laeuft danach voellig normal weiter — `onCardLeaveZone` und
`ON_CREATURE_DEATH` feuern, on-death-Effekte greifen. Nur die Ablage
entfaellt: es gibt **keinen Zwischenstopp im Ablagestapel**, weder im
Zustand noch sichtbar. Eingeloest wird nach allen Todeslistenern und
nach dem Untracking.

`to: 'support'` ist eine **BEWEGUNG, keine Beschwoerung** (Als Ruling
31.8.): kein `summonCreatureWithHooks`, also keine on-summon-Effekte
und **keine Summoning Sickness** — der `turnPlayed` der alten Instanz
wandert mit, damit Frische-Filter (Alice, Hive's Crown, Singing,
Bomblebee) die Creature so alt sehen wie zuvor. Die neue Instanz
bekommt die gedruckten HP („fully heal"); `counters.currentHp` MUSS
gesetzt werden, sonst rechnet der Schadenspfad `undefined - x` zu NaN.
`keepOriginalOwner` friert den Eigentuemer ein wie
`actionTransferCreature` — die Karte kehrt spaeter in die Ablage ihres
URSPRUENGLICHEN Besitzers zurueck.

**Animation — drei Fallstricke, alle drei bereits eingetreten:**
* Der Flug wird mit `fromOwner`/`toOwner` gesendet, nicht mit `owner`:
  Quelle und Ziel liegen auf verschiedenen Seiten, und `owner` allein
  laesst die Karte auf der EIGENEN Seite starten.
* Ein Flug in die Hand braucht `toHandIdx` + `finalHandSize`, sonst
  zielt der Client auf die MITTE des Handbereichs statt auf den Platz,
  auf dem die Karte landet.
* `to: 'support'` braucht einen eigenen `play_card_transfer` (derselbe
  Flug, den `actionTransferCreature` fuer Dark Gear spielt) — sonst
  erscheint die Creature ohne Wanderung am Ziel. VOR dem Eintrag ins
  Board-Array senden und die Flugdauer abwarten.

* Zwischen Anspruch und Flug liegen alle Todes-Effekte (Heragas'
  Draw …), und der Slot ist im Zustand schon leer. Damit die Creature
  in dieser Zeit nicht unsichtbar ist, sendet die Engine im
  Anspruchsfenster `death_claim_hold` — der Client zeigt sie als
  stehenden BoardCard am alten Slot weiter und loest den Halter in
  dem Moment, in dem ihr Flug beginnt. Der Halter kommt automatisch,
  eine Karte muss nichts dafuer tun.

Begleitanimationen der beanspruchenden Karte gehoeren in
`claim.redeemEvent = { type, data }`. Die Engine sendet sie beim
EINLOESEN, gemeinsam mit dem Kartenflug. Im Anspruchsfenster gesendet
liefen sie lange vorher — dazwischen liegt der ganze Todeszweig.

**Gleichlauf.** Soll die Begleitanimation die Karte FESTHALTEN (Huntings
Netz), reicht „gleichzeitig starten" nicht — sie muss sich identisch
bewegen. Die Engine vergibt beide Zeiten an EINER Stelle und gibt sie
an beide Seiten: `catchMs` als Vorlauf (die Engine wartet ihn ab,
bevor der Kartenflug losgeht) und `flyMs` als Wanderdauer, die
zugleich `duration` des `play_card_transfer` ist. Clientseitig muss
die Begleitanimation dieselbe Kurve fahren wie `cardTransferFly`:
`ease-in-out`, Bogen `-30px` bei 50 %, Skalenspitze `1.15`. Weicht
eines davon ab, laufen die beiden sichtbar auseinander (Als Befund
31.8.).

Eine Begleitanimation, die zugleich ihre eigene Form aendert und
wandert, braucht ZWEI verschachtelte Elemente — beide Teile animieren
`transform` und wuerden sich auf einem Element gegenseitig
ueberschreiben. Aussen die Wanderung, innen die Verformung.

### Toeten und Wiederbeleben — `_reviveAfterDeath`

Der Stempel, den eine Karte im `onCreatureDeath`-Hook auf die
sterbende Instanz setzt. Er wird NACH allen Todeslistenern und nach
dem Untracking eingeloest — die Creature ist also wirklich gestorben
(on-death und on-kill feuern regulaer), bevor eine frische Instanz
entsteht. Frisch heisst: volle HP, leere Counter.

```js
inst._reviveAfterDeath = {
  name, owner, heroIdx, zoneSlot,
  originalOwner,          // aus wessen Ablage der Kadaver geholt wird
  bypassSummoningSickness,
  fireHooks,              // false = keine on-summon-Reiter (Standard)
  by,
};
```

Dieser Weg ist eine echte Wiederbeschwoerung aus der Ablage (mit
Summoning Sickness, sofern nicht `bypassSummoningSickness`). Wer eine
BEWEGUNG ohne Beschwoerung braucht, nimmt `_deathClaim` oben.

### Jeder sich aktivierende Effekt zeigt seine Karte (v696, ALLGEMEINE REGEL)

(Seit v817 als ★-Grundregel ganz oben in dieser Datei — dort steht die
verbindliche Fassung samt `source`-Entprellung; hier die Herkunft.)

Al 1.9.: „Jeder sich aktivierende Effekt sollte seine Karte anzeigen —
das gehoert zur Uebersichtlichkeit und Nachvollziehbarkeit." Die
expliziten Aktivierungspfade (Hero-Effekt, Ability, Creature-Effekt,
Artefakt, Surprise) tun das im Server. GETRIGGERTE Effekte in Hooks
(„Whenever …", „When … you may …") rufen `engine.showTriggeredEffect
(CARD_NAME, opts)` — in dem Moment, in dem der Effekt WIRKLICH feuert:
nach einem „you may" also erst nach dem Ja, damit ein abgelehnter
Trigger nichts zeigt. `opts.replace: true` fuer Reaktionen, die die
Karte abloesen, auf die sie reagieren (Key). Passive Dauermodifikatoren
(Tempeste −100, Warhorse +50) zaehlen NICHT als Aktivierung — die
wuerden bei jedem Treffer blinken.

Vorbilder: Monami (nach der Galerie-Wahl), Hunting (nach dem Confirm),
Heragas (Draw-Trigger), Key (Reaktion mit `replace`). Wer einen neuen
Trigger baut, prueft im Repro: Reveal beim Ja, KEIN Reveal beim Nein.

**★ VERSCHÄRFUNG (Al 12.9.), verbindlich:**

> „Jeder passive Effekt, der getriggert wird statt 24/7 aktiv zu sein,
> MUSS das Kartenbild an beide Spieler streamen (Standard-Auftritt links
> vom Battlefield)."

Also kein „sollte" mehr. Die Trennlinie ist **ausgelöst vs. dauerhaft**:
ein Effekt, der auf ein Ereignis hin feuert, zeigt seine Karte; ein
Dauermodifikator, der jeden Treffer stillschweigend verrechnet, nicht.
Alle vier Bonded Companions hatten den Auftritt vergessen — das
Selbst-Highlight auf dem Brett (`effect_source_glow`) ist ein ANDERES
Signal und ersetzt ihn nicht: es zeigt dem Besitzer, welche Karte
gerade arbeitet, streamt dem Gegner aber kein Kartenbild.

**Wächter:** `node scripts/check-triggered-reveal.js`. Er meldet einen
REAKTIVEN Hook (`onDraw`, `onResourceGain`, `onAnyActionResolved`,
`onSacrificeBatch`, `onCreatureDeath`, `afterDamage`, …) in einer Datei
ohne `showTriggeredEffect`, wenn der Hook entweder eine sichtbare
Handlung ausführt ODER eine Abfrage öffnet — ein Dauermodifikator tut
beides nie. Ratchet gegen `triggered-reveal-baseline.json`: der Bestand
(37 Dateien) darf stehen, Neues nicht; nach einer Bereinigung
`--update`. Die explizit aktivierten Pfade (Hero-Effekt, Ability,
Creature-Aktiv, Artefakt, Surprise, Potion) sind ausgenommen, dort
streamt der Server selbst.

### Helden-Effekt-Reaktionen im Kettenfenster (v691)

Ein Held kann ohne Handkarte auf die Kette reagieren (Key, the Cursed
Thief). Das Reaktionsfenster (`_checkReactionCards`) sammelt neben
Hand- und Surprise-Reaktionen auch Helden, deren Skript exportiert:

```js
isHeroReaction: true,
heroReactionCondition(gs, pi, engine, chainCtx, heroIdx) → bool,
async payActivationCost(engine, pi, chainCtx, heroIdx) → false = nicht bezahlt,
async heroReactionResolve(engine, pi, chain, myIndex, heroIdx),
```

Nur lebende, nicht stummgeschaltete Helden (`_isHeroEffectSilenced`)
werden angeboten; die Option heisst wie der Held (`source: 'hero'`).
Der Prompt zeigt die Karte, auf die reagiert wird (`showCard`, auch in
der Galerie), und im Pre-Damage-Fenster laeuft das `card_reveal` der
Reaktion VOR dem Konter — der Spieler soll sehen, worauf er reagiert.
Bei der Aktivierung wird der Held selbst angezeigt:
`card_reveal { cardName: <Held>, replace: true }` — `replace` raeumt
den Reveal-Stapel, der Held LOEST die Karte ab, statt sich daneben zu
stellen (v694).
Der Link traegt `fromHero: true` und `cardType: 'Hero Effect'`; die
Kettenauflösung legt ihn nie ab. Beim Aktivieren sendet die Engine
`hero_effect_reaction` (Ring am Helden). HOPT stempelt das Skript
selbst (`gs.hoptUsed`), die Bedingung liest ihn.

**Ohne Kette (v692):** das Pre-Damage-Handreaktionsfenster (Strong
Shield, Bamboo Shield, Escape, Homerun, Sculpture Guards, Spectral
Armor) loest seine Karte direkt auf. Dort bietet
`_offerHeroCounterToHandReaction` den Helden des ANDEREN Spielers
denselben Vertrag ueber einen Pseudo-Link an — VOR Flug, Entnahme und
Bezahlung. Stiehlt der Held, wandert die Karte Hand → Hand, kein
Preis, keine Aufloesung, der Schaden laeuft weiter.

### Negierte Karte stehlen — `negateChainLink(…, { stealToHandOf })` (v691)

Gegenstueck zu `deleteCard` (Lunar Eclipse): die negierte Karte geht
in die HAND des Spielers `stealToHandOf` statt in eine Ablage. Fuer
die Initialkarte via `chainResult.negatedToHandOf` →
`routeNegatedInitialCard` (Flug Hand → Hand mit Handplatz-Ziel); fuer
Reaktions-Links direkt in `_resolveReactionChain`, inklusive
Rueckgabe des beim Ketten schon abgezogenen Reaktionspreises.
„Der Gegner muss nicht zahlen" ist bei negierten Initialkarten
ohnehin so — der Server zieht den Artefaktpreis erst nach der Kette
und nur ohne Negation ab (Rusty Touch erzwingt ihn ausdruecklich).

**Herkunft (v692/v693) — ALLGEMEINE REGEL (Al 1.9.):** jeder Effekt,
der eine Karte in eine fremde Hand legt, markiert sie mit
`_tagHandCardOrigin(dieb, name, besitzer)` (Magic-Lamp-Muster:
Hand-Instanz mit `originalOwner`). Abwerfen (`actionDiscardHandCard`),
Spielen (`_consumeHandCardOrigin` in den Server-Pfaden), Mulligan
(`actionMulliganCards`) und Hand→Deck (`actionShuffleBackToDeck`)
lesen das — die Karte kehrt in Ablage bzw. Deck des URSPRUENGLICHEN
Besitzers zurueck. Getaggt sind: Key, Infiltration (alle Stufen),
Enigma, Hunting Stufe 1, Magic Lamp, Birthday Present, Charme,
Sculpture Theft, Sid, Saint Nicolas, Winged Skeleton, Noble Mummy
Guards, Letter of Misinformations, Divine Gift of Time, Sparkfly.
Brett-Uebernahmen (Dark Gear, Hunting Stufe 2/3, Chilly Wizard,
`actionTransferCreature`) laufen ueber das bei der Erstellung
eingefrorene `originalOwner` der Instanz. Wer NEU eine fremde Karte
in eine Hand legt: taggen, sonst landet sie beim Dieb.

**Flug (v692):** Server-Pfade, die VOR der Entnahme einen Flug zur
Ablage senden (doConfirmPotion, doPlayArtifact Nicht-Equip), lassen
ihn bei `chainResult.negatedToHandOf` aus — sonst fliegt die Karte
gleichzeitig zur Ablage und in die fremde Hand.

### Punkt vor Strich — Schadensmodifikatoren im Heldenpfad (v688)

Als Regel 1.9.: Halbieren/Verdoppeln wird ZUERST verrechnet, flat
Modifikatoren danach — unabhaengig von der Listener-Reihenfolge.
`beforeDamage` sammelt deshalb getrennt und die Engine rechnet NACH
der Runde einmal: `ceil(basis × Π Multiplikatoren) + Σ flat`.

* `ctx.multiplyAmount(f)` — Halbieren (0.5), Verdoppeln (2). Unter
  `cannotBeReduced` werden Faktoren < 1 abgewiesen.
* `ctx.modifyAmount(±n)` — flat. Unter `cannotBeReduced` werden
  Abzuege abgewiesen.
* `ctx.setAmount(v)` — ABSOLUT (Deckel, Nullsetzen). Setzt die Basis
  und loescht alles bisher Gesammelte; danach gesammelte Aenderungen
  wirken wieder. NICHT fuer Halbieren/Verdoppeln benutzen: es liest
  die Projektion, in der fremde flat Modifikatoren schon stecken
  koennen — das Ergebnis haengt dann von der Reihenfolge ab.
* `ctx.amount` liest die LIVE-Projektion (Basis × Produkt + Summe).
* `ctx.lockReduction()` verwirft bereits gesammelte Abzuege — sie
  wuerden nach der Multiplikation abgezogen und waeren damit eine
  „weitere" Reduktion.
* Engine-Buffs (`damageMultiplier`: Cloudy, Petrify …) wandern ins
  selbe Produkt. Arrows zaehlen zur BASIS und werden mitmultipliziert.

**Kreaturenseite (v689):** dieselbe Regel in `processCreatureDamageBatch`.
Jeder Eintrag bekommt vor dem `beforeCreatureDamageBatch`-Hook die
Helfer `e.modifyAmount / e.multiplyAmount / e.setAmount /
e.lockReduction`, und `e.amount` wird zum Accessor: Lesen liefert die
Projektion, direktes Schreiben `e.amount = x` (die alte Form) ist
ABSOLUT wie setAmount — deshalb: Halbieren/Verdoppeln IMMER ueber
`multiplyAmount`, flat ueber `modifyAmount`; `e.amount = 0` zum
Nullsetzen bleibt richtig. Nach dem Verrechnen (nach den
Buff-Multiplikatoren) ist `amount` wieder eine plain Zahl. Engine-
Schritte, die zur BASIS gehoeren (Arrows, Elixir of Strength),
arbeiten auf `e._base`, nicht ueber `e.amount` — sonst backen sie die
gesammelten flat Modifikatoren in die Basis. Hydra Bloods Null ist
absolut und leert die Sammler.

### „Damage this Hero takes cannot be reduced or negated" — zielseitig (v687)

Ein Heldenskript exportiert `heroDamageCannotBeReducedOrNegated: true`
(oder ein Praedikat `(engine, ownerIdx, heroIdx) → bool`). Die Engine
setzt dann fuer JEDEN Treffer gegen diesen Helden `cannotBeNegated` +
`cannotBeReduced` auf den hookCtx — VOR `beforeDamage`, damit
`setAmount`/`modifyAmount` anderer Listener schon abweisen. Das
toppt Schilde, Cloudy-Multiplikatoren, beforeDamage-Abbrueche, Anti
Magic und die Pre-Damage-Handreaktionen (Strong Shield, Bamboo
Shield …) — deren ANGEBOT wird bei unaufhaltbarem Schaden gleich
uebersprungen, sonst waere die Karte fuer nichts verbraucht.
Gegenstueck zu `heroSelfDamageImmune` (Carris), mit zwei
Unterschieden: es ist ein EFFEKT des Helden und gilt deshalb nur,
solange er lebt und nicht stummgeschaltet ist (`_isHeroEffectSilenced`
— dieselbe Regel wie der Hook-Filter: Stunned/Webbed, Frozen ohne
Chilly Dog, Negated, Mummy Token); und es ist kein True Damage — die
Unsterblichkeits-Deckel bleiben.

**Hook-Vertrag:** `ctx.amount` im `beforeDamage` ist seit v688 eine
LIVE-Projektion (siehe „Punkt vor Strich"). Wer wissen will, ob seine
Reduktion greift, prueft `ctx.cannotBeReduced`; wer ein Vorher/Nachher
loggen will, liest `ctx.amount` VOR und NACH seinem Aufruf.

### „… before / since the end of your last turn" — `_turn-end-recency-shared`

Gemeinsame Zeitmarke fuer Ralzish (darf KEINE seit dem eigenen
Rundenende beschworene Creature waehlen) und Heragas (darf NUR davor
beschworene waehlen). `lastTurnEndTick(ps, gs)` liefert `gs.turn` am
Ende der letzten eigenen Runde; gestempelt wird sie von jedem Traeger
ueber `stampTurnEnd(ctx)` im `onTurnEnd` (mit `bypassStatusFilter:
true`, damit die Marke auch unter CC stimmt). Ohne Stempel gilt
`max(0, gs.turn - 2)` — nie unter 0, weil `turnPlayed = 0` die
Konvention fuer „lag schon vor Spielbeginn" ist (Puzzle-Loader) und
nie als frisch gelten darf. Praedikate: `summonedSinceLastTurnEnd`
(turnPlayed > tick) und `summonedBeforeLastTurnEnd` (das Gegenteil).

### „When this Hero defeats …" — den Toeter erkennen

Es gibt KEINEN On-Kill-Hook. Wer auf „dieser Held besiegt X" hoert,
liest im `onCreatureDeath` die Schadensquelle:

```js
if (ctx.source?.owner !== pi || ctx.source?.heroIdx !== hi) return;
```

Das gilt fuer Schaden UND Zerstoerung (`actionDestroyCard` reicht
`source` ins Anspruchsfenster durch). 60 von 63 Schadens- und 14 von
50 Zerstoerungs-Aufrufern bauen ihre Quelle als
`{ name, owner, heroIdx }` — das sind die Heldeneffekte. Ohne
`heroIdx` sind es Kreaturen- oder Gegenstandseffekte (Afflicted
Vermin, Spinnen, Blood-Soaked Coin) und zaehlen bewusst nicht.

Nicht selbst pruefen muss man den Zustand des eigenen Helden:
`runHooks` filtert Abilities toter, eingefrorener, betaeubter und
negierter Helden bereits zentral heraus.

### Aufstiegs-Erlass je Handkopie — `_handAscensionGrants` (v676)

Für Karten, die EINER bestimmten Handkopie erlauben, ihre
Ascension-Bedingung zu ignorieren (Perilous Journey). Handindex-Feld
(`registerHandIndexedField`), Wert `{ turn, byCard }`: folgt der
physischen Kopie durch Splices und Umsortierungen und fällt mit ihr aus
der Hand — Kopien desselben Namens bleiben leer (Als Ruling 31.8.).

Die gewährende Karte stempelt nach der Suche:

```js
ps._handAscensionGrants[ps.hand.lastIndexOf(geholt)] = {
  turn: gs.turn + 2,        // „during your next turn"
  byCard: CARD_NAME,        // wer den Preis eintreibt
};
```

Alles Weitere ist Engine:
* Die Anzeige läuft über das EIGENE, INDEXBASIERTE Feld
  `getAscensionGrantOffers(playerIdx)` → `{ handIdx: [heroIdx…] }` —
  NICHT über die namensbasierte `ascensionSkipTargets`-Liste. Der
  erste Wurf tat genau das, und bei zwei namensgleichen Handkopien
  leuchteten BEIDE als spielbar (Als Befund 31.8.). Der Client
  (`heroCanAscendTo`, vierter Parameter `handIdx`) verodert beide
  Quellen; alle fünf Aufrufer reichen ihren Handindex durch.
* Die Aufstiegsroute in `performAscension` trägt NUR, wenn der
  Normalweg verschlossen ist (Bedingung nicht erfüllt bzw. kein
  `ascensionReady`) — niemand zahlt den Preis, wenn er ihn nicht
  braucht. Der Stempel muss auf GENAU der GESPIELTEN Kopie sitzen
  (`_handAscensionGrantFor(pi, name, handIndex)` — der Index aus dem
  `ascend_hero`-Aufruf); eine ungestempelte namensgleiche Kopie wird
  abgelehnt. Verbraucht wird ebenfalls exakt die gestempelte Kopie,
  nie still eine namensgleiche; ist die gestempelte weg, schlägt der
  Aufstieg fehl. `payAscensionCost` wird auf diesem Weg NICHT gerufen
  (die Bedingung ist erlassen, ihre Kosten mit ihr).
* Nach vollzogenem Aufstieg ruft die Engine
  `byCard.onAscensionGrantUsed(engine, pi, heroIdx)` — dort wohnt der
  Preis (Perilous Journey: Dauerbrand mit `unhealable` auf allen
  eigenen Zielen; Kreaturen zusätzlich `counters.burnedUnhealable`,
  der Cold-Coffin-Kanon).

Wichtig für die Zuweisung von `_ascGrant` in der Route: die gesamte
Entscheidung (Fenster, Unumgehbar, Namensbindung, Normalweg-Vorrang)
steckt IN der Zuweisung. Stünde der Vorrang daneben, bliebe die
Variable auch bei genommenem Normalweg gefüllt und der Preis feuerte
fälschlich — genau so gefunden.

### Abstieg ohne Formstapel — der Linien-Rückfall (v675)

Den `_formStack` führen nur die Waflav-Familie (`formsAscensionStack`)
und erzwungene Aufstiege (Throne Robber, Open Invitation). Ein NORMAL
aufgestiegener Held (Monia Bot über das Jetpack) hat keinen — und war
damit für jede Descend-Karte unsichtbar: `performDescend` stieg still
aus. Seit v675 fällt `performDescend` in diesem Fall auf die
Abstammungslinie zurück, wenn die getragene Form laut Datenbank ein
Ascended Hero ist UND ihre Linien-Basis eine echte Karte ist.

Der zweite Wächter schützt die Waflav-Familie: deren Linien-Basis ist
das Familien-Kürzel „Waflav", keine Karte — welcher konkrete Waflav
darunter steckt, weiß nur der Stapel (und Waflavs führen ihn immer).
Ohne den Wächter bliebe bei einem stacklosen Waflav ein Müll-Stapel
`['Waflav']` am Helden kleben. Descend-Karten brauchen also KEINE
eigene Stapel-Vorsorge mehr — `performDescend` genügt; Vorbild:
`audience-with-a-hostile-king.js`.

### HP beim ABSTIEG (v674) — Als Ruling 31.8., bindend

Gilt für JEDEN Abstieg, nicht nur für Open Invitation: Waflav und
Throne Robber eingeschlossen.

* Die HP ändern sich **konsequent um die Differenz zwischen Ascended
  max HP und normal max HP** — aus den GEDRUCKTEN Werten, nicht aus
  `hero.maxHp`: Buffs und Ausrüstung gehören dem Helden, nicht der
  Form, und wandern beim Formwechsel nicht mit.
* Ist die Differenz negativ (Basisform hat mehr max HP), wird sie als
  **Heilung gutgeschrieben** — gedeckelt bei `maxHp`, aber nie unter
  das, wo der Held schon stand (Overheal bleibt Overheal).
* Ein **toter** Held wird durch den Abstieg **niemals wiederbelebt oder
  geheilt**, auch nicht durch eine Gutschrift. Er bleibt bei 0 — auf
  BEIDEN Wegen, echter Abstieg wie Pseudo-Abstieg.
  Das ist eine bewusste Verhaltensaenderung an **Throne Robber**: bis
  v673 hob ihn der Boden bei 1 HP wieder auf die Beine, wenn er bei
  Ablauf besiegt war. Al hat den neuen Stand am 31.8. ausdruecklich
  bestaetigt („Tot bleibt tot") — den alten Boden nicht wieder
  einbauen.
* **Tödlich nur beim Pseudo-Abstieg** (`opts.notADescend`, also der
  Rücknahme einer nur PLATZIERTEN Form — Open Invitation). Dort KANN
  ein lebender Held sterben, wenn seine HP auf 0 fallen; genau 0 zählt,
  nicht erst darunter.
* **Ein echter Abstieg ist unmöglich tödlich** (Als Korrektur 31.8.):
  Waflav und Throne Robber landen bei mindestens 1 HP. Der
  Waflav-Kreislauf darf sich nicht selbst abwürgen.
* Der Tod gilt ausdrücklich **NICHT als Schaden**: kein Verursacher,
  keine Schadensauslöser, kein Schild. Er läuft über `actionDefeatHero`
  mit `reason: 'descend'` und `respectFirstTurnProtection: false`,
  damit Ausrüstung, Extra-Leben, Guardian Angel, Cybug SCARAB und die
  Siegprüfung genau einmal und an der üblichen Stelle greifen.

`opts.notADescend` trägt damit ZWEI Folgen, weil es dasselbe
unterscheidet: keine (künftigen) on-descend-Auslöser, und die
Tödlichkeit der Differenz. Wer eine Karte baut, die eine geliehene Form
zurücknimmt, setzt es; wer einen echten Abstieg auslöst, nicht.

**Keine eigenen Revive-Riegel in Karten bauen.** Bis v673 hob der Boden
bei 1 HP tote Helden wieder an, und Open Invitation trug einen eigenen
Gegenriegel — beides ist weg. Ein zweiter Riegel in einer Karte hieße,
dass ein Rückbau dieser Regel unbemerkt bliebe.

Weitere Bausteine, die eine solche Karte braucht (siehe
`open-invitation.js`):
* `engine.isAscensionConditionUnskippable(name)` — die sechs Karten mit
  gedrucktem Umgehungs-Verbot dürfen so nicht ins Spiel kommen.
* `engine.getAscendedFormsFor(heldName)` — „appropriate Hero" ist die
  gedruckte Namensbindung, kein eigener Begriff. Achtung Waflav: die
  Familienbindung trifft auch die EIGENE Form, `hero.name === name`
  muss die Karte selbst ausschließen.
* Rückweg über `_identityExpiresTurn` + `_identityCleanupCard` am
  Helden-Instanz-Sweep, NICHT über ein eigenes `onTurnEnd` — nach dem
  Platzieren heißt der Held wie der Ascended, ein eigener Hook wäre
  unerreichbar.
* `performDescend` floort die HP auf 1: einen besiegten Helden vorher
  merken und danach wieder auf 0 setzen, sonst ist der Rückbau ein
  Gratis-Revive.

### Handkarte statt Galerie — `pickHandCard` mit `hostZoneKind` (v673)

Wenn eine Karte den Spieler aus seiner HAND wählen lässt, gehört das in
den Hand-Picker, nicht in ein Galerie-Submenü (Als Vorgabe 31.8. zu
Open Invitation): die zulässigen Karten leuchten in der Hand und werden
dort direkt angeklickt — oder gleich auf ihren Wirt gezogen.

```js
const pick = await engine.promptGeneric(pi, {
  type: 'pickHandCard',
  title: CARD_NAME,
  instruction: 'Click a highlighted card — or drag it onto the Hero it joins.',
  eligibleIndices,                 // Handindizes, die leuchten
  eligibleHostsByCardName,         // { Kartenname: [{ heroIdx, slotIdx }] }
  dragSummonMode: true,
  hostZoneKind: 'hero',            // v673 — sonst Support Zones
  cancellable: true,
});
```

* Klick → `{ cardName, handIndex }`; die Karte löst den Wirt selbst auf.
* Drop auf einen Wirt → zusätzlich `targetHeroIdx` / `targetSlotIdx`,
  die zweite Abfrage entfällt. **Immer gegenprüfen** — zwischen Abfrage
  und Antwort kann sich der Zustand verschoben haben.
* `hostZoneKind: 'hero'` (neu) lässt den Drop auf HELDEN-Zonen zu;
  die Hosts tragen dann `slotIdx: -1`, unpassende Helden dimmen, der
  Wirt unter dem Zeiger bekommt den Aufstiegs-Schein. Ohne das Feld
  gilt weiter das Support-Zonen-Verhalten (Gigantisaur Raptoren).
* **Den NAMEN aus der Antwort nehmen, nicht `ps.hand[pick.handIndex]`.**
  Der Index stammt vom Zeitpunkt der Abfrage; eine Reaktion kann in der
  Zwischenzeit eine Karte davor aus der Hand genommen haben. Danach den
  Index frisch über `indexOf(name)` suchen. (Dieselbe Lehre wie bei
  Copy Device, v573.)

### Zugende aus einem Artefakt — `gs._spellEndsTurn` (v673)

Der bestehende Vertrag „diese Karte beendet den Zug, sobald sie fertig
aufgelöst hat" (Tanuki Escape, Premonition, Raise the Minions) wurde bis
v672 nur an drei Stellen eingelöst, alle im Spell-Pfad. Seit v673 löst
ihn auch `doUseArtifactEffect` ein. Ein `resolve` setzt einfach
`gs._spellEndsTurn = true` und ist fertig.

**Nicht selbst `advanceToPhase` rufen.** Ein Zugende in die noch
laufende Kette hinein ist die Deadlock-Falle, an der Cooldin hing; der
Server macht es nach Kette, Kartenentnahme und Entsorgung.

### Support-Karten sperren die Aktionen ihres Helden (v640)

`blocksHostHeroActions: true` auf einem Support-Skript (Plant Golem) —
`canHeroPerformAction` fragt die Zonen des Helden; greift bei
Spell/Attack/Creature-Plays, Ability-Aktionen und Helden-Effekt-
Aktionen. Kreatureneffekte mit `creatureActionCost` laufen NICHT ueber
dieses Gate (Kreatur ≠ Held) — so bleibt der Golem-Kill moeglich.
Negierte / verdeckte Instanzen sperren nicht.

Cross-Side-Beschwoerung ohne Besitzerwechsel: `playOnAnyHeroSide` +
Verlegung in `onPlay` mit NUR `inst.controller` (Plant Golem) — der
Golem bleibt Karte des Beschwoerers (Discard-Routing, Chasing, Bounce).

### „Seit Beginn deines Zuges wurde eine Kreatur besiegt" (v645)

`ps._lastCreatureDefeatedTurn` — Zugstempel des Controllers, gesetzt an
der einen Kreaturentod-Stelle in `runHooks` (ON_CREATURE_DEATH).
Pruefung: `=== gs.turn` (Spielerzug). Call for Help nutzt es als
`spellPlayCondition`.

**Spell sofort giessen — aus Hand ODER Deck (v646):**
`await engine._castSpellImmediately(pi, heroIdx, name, { fromZone, pool, poolIndex, by })`
ist der eine Guss-Kern (Wisdom, Aufloesungstiefe, `onPlay`,
`afterSpellResolved`, Abbruch-Rueckgabe in den Pool, Discard-Routing);
die Zusatzaktion `_resolveImmediateActionPick` nutzt ihn fuer die Hand,
Call for Help auch fuer das Deck. Der Kern prueft KEINE Level-/Schul-
anforderung — der Aufrufer hat die Karte bereits freigegeben. Sperren,
die auch die normale Aktion traefen (`supportSpellLocked` = Friendship 1,
`areActionsBlocked`, `spellPlayCondition`), prueft der Aufrufer selbst —
Saya und Call for Help tun das.

### Attachment-Spells anlegen (v650) — `_attachment-shared.js` (MANDATORY)

Der Subtyp „Attachment" hat keinen Engine-Automatismus — die Karte legt
sich in `onPlay` selbst in eine Support Zone. Seit v650 gibt es dafuer
EINE Auslegung, auf der alle 14 gebauten Attachments laufen:

- `attachmentHostsFor(gs, pi, engine, { heroFilter })` — Empfaenger-Zonen
  der EIGENEN Seite fuer den Engine-Vertrag `attachmentHosts` (Drop-
  Hervorhebung beim Ziehen). `candidateHosts(gs, pi, engine, { sides,
  heroFilter })` ist dieselbe Liste ueber beliebige Seiten (fuer
  `spellPlayCondition`).
- `pickAttachmentHost(ctx, CARD_NAME, { sides, heroFilter, preferCaster,
  description, confirmLabel })` — Wirt waehlen: Drop-Hinweise des
  Servers, Automatik bei nur einem Platz, sonst Prompt (Held = linkester
  freier Platz oder konkrete Zone). Setzt `gs._spellCancelled` bei
  Abbruch.
- `placeAttachment(ctx, CARD_NAME, host, { skipMagicImmune,
  skipEnterHook, animationType })` — Anti-Magic-Schutz (nur Spells;
  Anti Magic selbst nutzt `skipMagicImmune`), Slot-Nachwahl, Instanz mit
  Besitzer = WIRT-Seite und `originalOwner` = Caster,
  `gs._spellPlacedOnBoard`, `onCardEnterZone`.
- `attachToHero(ctx, CARD_NAME, opts)` — beides hintereinander.

### ★ REGEL: `[B]` / `[W]` sind KOSMETIK, kein Namensbestandteil (Al 11.9.)

Im Spiel heissen „Pawn of Kings [B]" und „Pawn of Kings [W]" beide
schlicht **„Pawn of Kings"**. Das Anhaengsel unterscheidet nur die
Variante (Effekt und Kartenbild) — fuer JEDEN Namensvergleich zaehlt der
BASISNAME:

```js
const { sameCardName, baseCardName, cardVariantTag } = require('./_hooks');

if (sameCardName(a, b)) { /* dieselbe Karte */ }          // ✅
if (a === b) { /* [B] und [W] gelten faelschlich als verschieden */ }  // ❌
```

Betroffen ist alles, was ueber Namen entscheidet: „a card with a
different name", „the same name", Namenssperren fuer den Rest des
Zuges, Suchen nach „a card named X". `cardVariantTag` ist NUR fuer
Anzeige und Bildauswahl da.

Ausloesender Fall (Al 11.9.): Old Couple bot „Pawn of Kings [B]" als
Partner zu „Pawn of Kings [W]" an — zwei Karten mit demselben Namen.

**Stand:** Der Helfer liegt in `_hooks` (`_of-kings-shared.familyName`
leitet darauf um). Alte Skripte, die Namen noch direkt vergleichen, sind
NICHT durchgesweept — wer einen anfasst, stellt ihn um.

### ★ REGEL: Gezogene Zone gewinnt (Als Vorgabe 11.9.)

**Ein Equip oder Attachment landet in GENAU DER Support Zone, in die es
gezogen wurde — solange die frei und erlaubt ist.** Die linkeste freie
Zone ist der Rueckfall fuer den Fall, dass gar keine Zone benannt wurde
(Drop auf die HELDEN-Kachel statt auf eine Zone, Klick statt Ziehen,
Platzierung durch einen Effekt) — sie ist nie eine Korrektur einer
Wahl, die der Spieler bereits getroffen hat.

Die Hinweiskette dahinter, damit sie beim Kartenbau nicht abreisst:

| Stufe | Traeger | Faellt aus, wenn … |
|---|---|---|
| Drop trifft Zone | Client setzt `targetSlot` | auf die Heldenkachel gezogen (dann `-1`, gewollt) |
| Emit | `attachmentZoneSlot` **immer**, `attachHeroIdx` NUR bei deklariertem `attachmentHosts` | Karte deklariert den Vertrag nicht |
| Server | `gs._attachmentZoneSlot` / `gs._attachmentHeroIdx` / `gs._attachmentOwner` | Hinweis kam nicht an |
| Karte | `pickAttachmentHost` liest die Hinweise | — |

**Daraus zwei Pflichten fuer jede neue Anlege-Karte:**

1. `attachmentHosts(gs, pi, engine)` deklarieren (in aller Regel
   `attachmentHostsFor(...)` mit demselben `heroFilter` wie beim
   Anlegen). Ohne den Vertrag hebt der Client die Zonen beim Ziehen
   nicht hervor UND schickt keinen Helden-Hinweis mit.
2. Den Wirt ueber `pickAttachmentHost` / `attachToHero` waehlen, nie
   selbst „erste freie Zone" rechnen — die Auslegung der Hinweise steht
   an genau einer Stelle (`_attachment-shared.js`).

`pickAttachmentHost` wertet seit v856 auch einen Slot-Hinweis OHNE
Helden-Hinweis aus (Slot + Caster-Held ergeben einen eindeutigen Platz).
Das ist ein Sicherheitsnetz, kein Ersatz fuer Pflicht 1.

Der Fall, der die Regel ausgeloest hat (Als Befund 11.9.): Intrude
deklarierte `attachmentHosts` nicht, der Helden-Hinweis fehlte deshalb,
die ganze Hinweis-Stufe fiel aus — und die Karte landete unabhaengig
vom Ziehziel immer in der linkesten freien Zone.

**Cross-Side (v651):** `attachmentHostsFor(gs, pi, engine, { sides: [oppIdx] })`
liefert Eintraege mit `owner` — der Client bietet dann gegnerische Zonen
und Helden als Drop-Ziel, sendet `attachOwner`, der Server stellt
`gs._attachmentOwner`, der Picker liest es. Berserk/Curse/Anti Magic/
Guardian Angel/Dichotomy: beide Seiten; Overheal Shock: nur Gegner.
`placeAttachment` nimmt die Karte SOFORT aus der Hand (vor Auftritt
und Sync) und loescht `_resolvingCard`.

Kartenspezifische Zwischenlogik (Anti Magic detacht vorher, Curse
prueft den inhaerenten Modus, Overheal Shock den Erstzug-Schutz) sitzt
ZWISCHEN pick und place. `activeIn` muss `'hand'` enthalten. Ein neues
Attachment ohne diese Bausteine gilt als falsch gebaut.

### Ability- und Artifact-Ziele einsammeln

**Immer ueber die zentralen Sammler gehen, nie selbst `ps.abilityZones`
oder die Support-Zonen durchlaufen.** Sonst uebersieht der Effekt
Sonderfaelle wie Cloak of Edge, die in einer SUPPORT-Zone liegt, dort
aber als Ability zaehlt.

```js
// Alle Abilities, die der Spieler kontrolliert — aus Ability-Zonen UND
// aus Support-Zonen (Karten mit `countsAsAbilityInZone`).
const ziele = engine.getAbilityTargets(pi, {
  heroIdx: 2,            // optional: nur dieser Held
  livingHeroOnly: true,  // optional: nur bei lebendem Traeger
  cardName: 'Fighting',  // optional: nur dieser Name
});
// -> [{ id, type, zoneKind, owner, heroIdx, slotIdx, cardName, level, cardInstance }]
//    zoneKind: 'ability' (type 'ability') | 'support' (type 'equip')
//    `type` folgt der ZONE, damit Ziel-Picker unveraendert funktionieren.

// Gegenstueck: Artefakte in Support-Zonen, OHNE die dort als Ability
// zaehlenden Karten.
const artefakte = engine.getArtifactTargets(pi);
```

Eine neue Karte, die sich auf dem Brett als anderer Typ verhaelt, setzt
dafuer nur ein Flag am Skript — die Sammler ziehen automatisch nach:

```js
module.exports = {
  isEquip: true,
  countsAsAbilityInZone: true,   // zaehlt in der Support-Zone als Ability
};
```

### Equipment artifact
```js
module.exports = {
  isEquip: true,
  hooks: {
    onPlay: async (ctx) => {
      ctx.grantAtk(20); // Auto-revoked when card leaves zone
    },
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      ctx.revokeAtk();
    },
  },
};
```

### Potion with targeting
```js
module.exports = {
  isPotion: true,
  canActivate(gs, pi) { return this.getValidTargets(gs, pi).length > 0; },
  getValidTargets(gs, pi) {
    const targets = [];
    // Build targets...
    return targets;
  },
  targetingConfig: {
    description: 'Select a target.',
    confirmLabel: '✨ Use!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },
  validateSelection(selected, validTargets) {
    return selected.length === 1;
  },
  async resolve(engine, pi, selectedIds, validTargets) {
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    // Resolve effect...
  },
};
```

### Gold: gain, spend — and *set* (`actionSetGold`)

Three primitives, three different meanings. Picking the wrong one is a
rules bug, not a style choice:

| Primitive | Meaning | Fires | Blocked by `goldLocked` |
|---|---|---|---|
| `actionGainGold(pi, n, opts)` | the player **gains** gold | `onResourceGain` → `afterResourceGain` | yes |
| `actionSpendGold(pi, n)` | the player **pays** gold | `onResourceSpend` → `afterResourceSpend` | yes |
| `actionSetGold(pi, n, opts)` | gold **becomes** n | `afterGoldSet` only | **no** |

`actionSetGold` exists because a wipe or a forced value is **neither a
gain nor a payment** (Al's ruling 16.8. on *Market Crash*: "Both
players' Gold becomes 0"). Consequences, all deliberate:

- Cards that trigger on a **payment** (*Criminal Monkee* — "when you
  pay exactly 4 Gold") must NOT fire on a wipe. They don't, because
  `afterResourceSpend` is not raised.
- *Golden Arrow*'s lock ("cannot gain or spend Gold") does NOT stop a
  set, for the same reason.
- **State-based** gold rules still have to work. *Logan, the Investment
  Monkee* — "If you ever have 0 Gold, remove all Invest Counters" —
  describes a standing condition, not a moment. That is what
  `afterGoldSet` is for; Logan listens to all three carriers.

`afterGoldSet` fires **even when the value did not change**: it reports
a state, not a movement, and "if you ever have X" is exactly the rule
shape that a change-only check would miss. It is deliberately **not**
in `HOOK_DESCRIPTIONS`, so it opens no reaction window.

Negative gold is not representable today (every deduction clamps at 0)
and `actionSetGold` clamps too. If the *Debt-O-Tron* archetype ("while
you have less than 0 Gold") is ever built, that clamp is the single
place to change.

---

### State-based Gold rules — use `goldStateRule`, not the movement hooks

> **The trap:** a rule phrased *"if you **ever** have 0 Gold …"* is a
> standing condition, not an event. Hanging it on
> `afterResourceGain` / `afterResourceSpend` / `afterGoldSet` misses
> every path that changes Gold some other way — most importantly
> **paying a card's Cost**, which is deducted raw at ~20 sites and
> fires none of those hooks.

Export a synchronous function from the **Hero's** module:

```js
// Called after EVERY change to this player's Gold, whatever caused it.
goldStateRule(engine, playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if ((ps.gold || 0) > 0) return;
  // … enforce the standing condition …
}
```

The engine walks it from `_checkGoldStateRules(playerIdx)`, which every
Gold path calls: `actionGainGold`, `actionSpendGold`, `actionSetGold`,
`actionStealGold` (for the victim) and `_payCardCost`.

**It must be synchronous.** Cost deductions sit inside resolution paths
that are partly synchronous; an un-awaited promise there is exactly the
class of bug that cost the v386–v394 hunt. Mutating state, logging,
broadcasting and `sync()` are all fine — awaiting is not. The walker is
re-entrancy guarded, so a rule may call `sync()` itself.

**Paying a Cost: always `await engine._payCardCost(playerIdx, cost)`**,
never `ps.gold -= cost`. What it fires, and why:

| Hook | Fired? | Why |
|---|---|---|
| `AFTER_RESOURCE_SPEND` | **yes** | Al's ruling 16.8.: a Card Cost *is* a payment, so "when you pay exactly N Gold" cards (Criminal Monkee) must see it. |
| `ON_RESOURCE_SPEND` | **no** | The pre-hook is *cancellable*. A listener could block the Cost of a card that is already resolving — played, but never paid for. Costs are not negotiable at that point. |
| `goldStateRule` | **yes, last** | Same order as `actionSpendGold`: the standing condition gets the last word, after every reaction to the payment has settled. |

It reports the amount **actually** deducted, not the amount asked
for — if the player could not cover it, they did not pay N, and
"exactly N" must not fire.

It is `async` because of the hook; every call site awaits it.
`goldStateRule` stays synchronous regardless.

**NEVER write `ps.gold` directly** — not `-=`, not `+=`, not `=`. Any
raw write is invisible to *both* rule families at once, and the card
doing it still works, so nothing looks broken:

| What you are doing | Use |
|---|---|
| Paying a card's Cost (incl. variable / `manualGoldCost` costs) | `await engine._payCardCost(pi, amount)` |
| Gaining Gold from an effect | `await engine.actionGainGold(pi, amount)` |
| Spending Gold outside a Cost | `await engine.actionSpendGold(pi, amount)` |
| Setting Gold to a fixed value (a wipe) | `await engine.actionSetGold(pi, amount)` |
| Taking Gold from the opponent | `await engine.actionStealGold(pi, amount)` |

This one keeps coming back: on 16.8. the same mistake surfaced three
times in a row — 19 raw Cost deductions in the engine, then those same
sites firing no payment hook, then **18 more inside card scripts**
(cards with `manualGoldCost` compute their own Cost, so they were
never covered by the engine-side fix). Al found the last batch on
*Book of Doom*: exactly 4 Gold for one target, down to 0, and neither
Logan nor Criminal Monkee reacted.

So it now reports itself: **`_gold-audit.js` scans every card script
at server start** and warns about raw `.gold` writes. If your card is
a real exception — Swagdri briefly inflates Gold purely to suppress a
display artefact, Tool Freezer refunds a Cost that was never paid —
add it to that file's `ALLOWLIST` **with a reason**.

Logan, the Investment Monkee is the first and so far only consumer.

---

### Negative Gold (Debt-O-Tron) — three contracts

Gold could not go below zero until v407; every deduction clamped and
every affordability gate compared against the balance. The Debt-O-Tron
archetype opens that up, but only under conditions, and only through
these contracts. **With none of them present the credit line is 0 and
everything behaves exactly as before.**

| Contract | Lives on | Shape | What it does |
|---|---|---|---|
| `goldOverdraft(engine, pi)` | a **Hero** | → number | How much *new debt* a single payment may take on. Kent returns 20, regardless of the current balance. |
| `selfGoldOverdraft` | any **card** | `true` / number / fn | Credit that applies **only when that card is the one being paid for**. `Debt-O-Tron Damage Fees` uses `true` (unlimited). Never bleeds onto other payments. |
| `blocksActions(engine, pi)` | a **Hero** | → bool | Player-wide Action lock, as a *standing* condition. Synchronous, like `goldStateRule`. |

The engine asks via `goldOverdraftLimit(pi, cardName)`,
`canAffordGold(pi, cost, cardName)` and `areActionsBlocked(pi)`.

**The measure is always "new debt", never an absolute floor.** A
payment may be at most `max(0, gold) + limit`, so from −10 with a limit
of 20 you may still pay 20 and land at −30. The same formula drives the
"for every 10 Gold you spent in excess of your current Gold" cards:
`amount − max(0, goldBefore)`.

**`areActionsBlocked` is checked wherever `hero._actionLockedTurn` is**,
which gives it the right scope for free: normal *and* additional
Actions, plus Hero effects and Abilities **only when those cost an
Action**. Free Hero effects stay usable.

Two traps worth naming:

- **Any `gold > 0` test in existing code is now suspect.** Before v407
  it was interchangeable with `!== 0`; it no longer is. Logan's "if you
  ever have 0 Gold" wiped his counters at −5 until this was caught.
- **Artifacts do not go through `validateActionPlay`.** `doPlayArtifact`
  now consults `canPlayWithHero` itself (v408) — before that, a
  card-side gate on an Artifact was display-only and a direct call went
  straight through.

---

### Conditional inherent additional Actions

`inherentAction` may be a **function** `(gs, pi, heroIdx, engine) → bool`.
Returning `true` means "this play does not consume an Action".

Read the card text carefully: a clause like *"You may use this Spell as
an additional Action while &lt;condition&gt;"* gates only the **action
economy**, not the card. Such a card stays playable without the
condition — it just costs the Action. That is `inherentAction` alone;
adding a `spellPlayCondition` would be wrong and would also grey the
card out for the human player. Models: *Quick Attack* (first Attack of
the turn), *Overheal Shock* (caster's school levels), *Market Crash*
(more Gold than the opponent). *Gate to the Armory* is the opposite
shape — there the free mode has a **cost** (it ends your turn), so its
`inherentAction` returns `false` whenever a real Action slot is free.

Two engine stamps set by `doPlaySpell` **before** `onPlay` let a card
see which route it took:

```js
const modus = gs._spellWasInherent      ? 'frei'     // inherent grant
            : gs._spellConsumedMainAction ? 'main'   // burned the Action
            :                               'zusatz'; // external grant
```

Note the CPU consequence: the enumerator **skips** inherent-action
cards in the Action Phase and defers them to `fireAdditionalActions` in
Main Phase. A card whose `inherentAction` is currently `true` is
therefore only ever considered on the free path — and `cpuPlayVeto`
receives `{ additional: true }` there and `{ additional: false }` on the
regular path, which is the clean place to hang a per-mode CPU decision.

---

### Hero-side inherent Actions — `grantsInherentActionForCard` (v601)

A **Hero** can make a card played *with it* free, mirroring the card-side
`inherentAction` — "Once per turn, summoning a "Horned Demon" with this
Hero counts as an additional Action" (Baaliel, the Demon General):

```js
// on the HERO script — same signature as canBypassLevelReqForCard
grantsInherentActionForCard(gs, playerIdx, heroIdx, cardData, engine) {
  if (!isHornedDemonCreature(cardData)) return false;
  return gs.hoptUsed?.[`baaliel-free-summon:${playerIdx}:${heroIdx}`] !== gs.turn;
},
hooks: {
  // stamp the once-per-turn AFTER the play actually happened
  onAnyActionResolved: async (ctx) => {
    if (ctx.actionType !== 'creature' || !ctx.isInherent) return;
    if (ctx.playerIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
    /* … name check, then gs.hoptUsed[key] = gs.turn … */
  },
},
```

Both sources are read by **one** engine helper,
`engine.cardHasInherentAction(pi, heroIdx, cardData, opts)` — used by
`getHeroPlayableCards`, `validateActionPlay` and the server's legacy
`inherentActionCards` / `inherentActionHeroes` lists. Do **not** re-add
per-site checks. Only a *living* Hero grants; `opts` (`zoneSlot`) is
forwarded to the card-side contract only. Keep the once-per-turn in
`gs.hoptUsed` (survives MCTS snapshots) and stamp it in
`onAnyActionResolved` (server fires it with `isInherent` after the
summon) — never in the grant function itself, which is a pure query
that runs many times per listing.

### Demon Counters — one module (v601)

`_demon-counter-shared.js` is the single place for `inst.counters.demonCounter`:
`isHornedDemonName` (substring, case-sensitive — Al's name-reference rule),
`hornedDemonsOnBoard` (both sides), `placeDemonCounters` (animation
`soul_shard_dark_grant` + log `demon_counter_placed` + sync),
`demonCountersOn`. Board badge (app-board.jsx) and Puzzle editor
(app-puzzle.jsx, gated on the card text mentioning "Demon Counter") are
wired. Al's ruling (29.8.): Horned Demon's "number of counters" means
**Demon Counters only**, and its strike is activatable **only with ≥ 1**.

### Areas — respect "Diver Helmet" (MANDATORY for every Area)

> **Diver Helmet** (Artifact / Equipment): *"The equipped Hero and all
> cards in its Support Zones are unaffected by Areas."*

Diver Helmet is **passive** — it has no behaviour of its own. The rule
is enforced *by every Area*. When you author or modify ANY Area card
(or engine-level Area rule) that **directly affects a Hero or a
Creature** — damage, status, stat changes, HP buffs, forced movement,
control changes, healing locks, being chosen/targeted by the Area's
own optional action, etc. — you **must** skip every Hero / Creature
protected by a Diver Helmet. Areas that only touch hands, decks, gold,
levels, piles, or global rules need no guard.

Use the shared helper — never re-implement the lookup:

```js
const {
  heroHasDiverHelmet,   // (engine, playerIdx, heroIdx) -> bool
  isAreaImmuneInst,     // (engine, cardInstance) -> bool  (Creature/support card)
  isAreaImmuneHeroObject, // (engine, heroObj) -> bool
} = require('./_diver-helmet-shared');

// Hero-damage Area (e.g. via ctx.aoeHit): exclude protected Heroes —
// no effect AND no animation on them.
await ctx.aoeHit({
  side, types: ['hero'], damage: 100, /* … */,
  heroFilter: (hero, hi, tpi) => !heroHasDiverHelmet(ctx._engine, tpi, hi),
});

// Creature-affecting Area: skip protected Creatures.
for (const inst of myCreatures) {
  if (isAreaImmuneInst(engine, inst)) continue;
  // … apply the Area's effect …
}

// beforeDamage-style hero modifier:
const hi = (engine.gs.players[ownerIdx]?.heroes || []).indexOf(target);
if (hi >= 0 && heroHasDiverHelmet(engine, ownerIdx, hi)) return;
```

Engine-level Area rules delegate via `this._isDiverHelmetProtectedTarget(target)`
(accepts a Hero object OR a support-zone CardInstance) — see the
Stinky Stables poison-heal-lock sites in `_engine.js` for the pattern.

---

### Targeting / redirect effects — respect "Truth-Seeing Eye" (MANDATORY)

> **Truth-Seeing Eye** (Artifact / Equipment): *"The equipped Hero can
> choose any target with Attacks and Spells, negating all effects that
> would prevent those targets from being chosen, and the equipped
> Hero's Attacks and Spells cannot be redirected."*

Like Diver Helmet, Truth-Seeing Eye is **passive** — it has no
behaviour of its own. The rule is enforced *by every effect that
restricts target selection or redirects something*. When you author or
modify ANY card or engine rule that **(a) makes a target impossible /
harder to choose** (a new untargetable-style status, a per-instance
"can't be chosen by opp" flag, a taunt / forced-targeting filter, a
target-exclusion list, a side-wide targeting shield, an
insta-fizzle-on-selection, …) **or (b) redirects an Attack / Spell /
effect** (a new `isTargetRedirect` / `isSurprise`+`isSurpriseRedirect`
/ `heroRedirect` card, a post-target reaction returning `newTargets`,
or any bespoke "the effect now hits a different target" path) — you
**must** make it a no-op when the source is an Attack / Spell cast by a
Hero wearing a Truth-Seeing Eye.

**Card-side twin (v616):** a Spell / Attack whose text says it "can
always choose any target, ignoring any other effects" (Piercer of
Heavens) declares `ignoresTargetingRestrictions: true` on its script.
The three pickers consult `engine._sourceIgnoresTargetingRestrictions(src)`
(= Eye OR flag) and flip `ignoreUntargetable` + `_truthSeeingEye`; the
**no-redirect** clause stays Eye-only (choosing ≠ redirecting). Pass
`_skipPostTargetReactions: true` yourself if the card also ignores
post-target reactions such as Invisibility Cloak.

The single source of truth is the engine helper:

```js
// true iff `sourceCard` is an actual Attack OR Spell CARD being cast
// by a Hero with a live (face-up, non-negated) Truth-Seeing Eye in a
// Support Zone. Scoped to Attack/Spell ONLY — a Creature effect from
// the same Hero is NOT its "Attack or Spell" and is still
// restrictable / redirectable.
engine._sourceHasTruthSeeingEye(sourceCard) → bool
```

**You usually get this for free.** The three core pickers
(`promptDamageTarget`, `promptMultiTarget`, `promptTarget`) already
call the helper and, when it matches, set on the live `config`:

* `ignoreUntargetable: true` — the long-standing master switch every
  built-in "can't be chosen" filter is already gated on (`if
  (!config.ignoreUntargetable) { … }`: untargetable status, Golden
  Wings `untargetable_by_opponent`, Perfect Disguise soft-untargetable,
  The Great Wall of Deri non-damage shield).
* `_truthSeeingEye: true` — gates the filters that are NOT covered by
  `ignoreUntargetable`: the forced-targeting / taunt filter
  (`_applyForcesTargetingFilter`) and the `gs._spellExcludeTargets`
  exclusion list (Invisibility Cloak's post-negation lockout, Bartas
  second-cast).
* `cannotBeRedirected: true` — the existing gate the redirect call
  sites honour; `_checkTargetRedirect` *also* early-returns `null` on
  the helper directly.

So: **if your new "can't be chosen" filter is gated on
`!config.ignoreUntargetable`, and your damage/effect routes through one
of the three pickers, you are already compliant.** Anything else MUST
add an explicit guard:

```js
// (a) A NEW target-selection filter inside a picker — gate it like the
//     built-ins, OR additionally honour the dedicated flag if it isn't
//     an `ignoreUntargetable`-class restriction:
if (!config.ignoreUntargetable && !config._truthSeeingEye) {
  // …remove the now-unchooseable targets…
}

// (b) An ENGINE-LEVEL chokepoint or an AUTO-TRIGGERED restriction /
//     redirect that never sees a picker `config` (server-side
//     targeting, a reaction that swaps the target, a bespoke
//     "redirect" path) — consult the helper directly:
if (engine._sourceHasTruthSeeingEye(sourceCard)) return;          // don't restrict
if (engine._sourceHasTruthSeeingEye(sourceCard)) return null;     // don't redirect
```

Canonical redirect paths are already compliant — `_checkTargetRedirect`
guards at the top (covers `isTargetRedirect` Challenge / Martyry /
Anti-Magnet, `heroRedirect`, and the `isSurpriseRedirect` Shield of
Wisdom scan). A NEW redirect mechanism that does **not** flow through
`_checkTargetRedirect` (e.g. a post-target reaction returning
`newTargets`) must add the `engine._sourceHasTruthSeeingEye(sourceCard)`
check itself before swapping the target.

**Scope / non-goals (do NOT over-apply):**
- Attack / Spell sources **only**. A Creature effect (even from the
  same Eye Hero) is still restrictable and redirectable.
- It does **not** suppress post-target *negation* reactions
  (Invisibility Cloak fully negating, Storm Ring negating a
  multi-target Spell) — those still resolve. The Eye governs which
  targets can be *chosen* and that the cast can't be *redirected*,
  nothing else.
- `submerged` is a damage / status immunity, not a target-list filter
  — leave it alone (the Eye doesn't make submerged targets take
  damage).

Reference implementations: the helper + picker injection + filter gates
in `_engine.js`; the passive equip script `truth-seeing-eye.js`; the
redirect cards `anti-magnet.js` (`isTargetRedirect`) and
`shield-of-wisdom.js` (`isSurpriseRedirect`).

---

### "place" ignores the host Hero entirely (MANDATORY)

Als Ruling (18.8.), verbindlich fuer JEDE Karte:

> **Sagt der Kartentext "place", ist der Zustand des zugehoerigen
> Helden komplett egal.**

Tot, eingefroren, betaeubt, gebunden, negiert, bezaubert — oder gar
kein Held in der Spalte: die Support-Zone bleibt ein gueltiges Ziel.
Eine Platzierung braucht keinen handlungsfaehigen Wirt, weil niemand
"beschwoert"; die Karte wird schlicht hingelegt.

**"summon" ist das Gegenteil.** Dort MUSS der Held handlungsfaehig
sein — er ist der Beschwoerer, und Frozen/Stunned/tot verhindern die
Beschwoerung. Wer eine Karte baut, liest also zuerst das Verb im
Kartentext und waehlt danach die Zonen.

Praktisch heisst das:

* `engine.getFreeSupportZones(pi, opts)` **ohne** `livingHeroesOnly`
  aufrufen. Die Option existiert fuer Beschwoerungswege; auf einem
  place-Pfad ist sie ein Fehler. (`namedHeroesOnly` ebenso: nur setzen,
  wenn der Kartentext ausdruecklich einen Helden verlangt.)
* Sammelt eine Karte ihre Zielzonen selbst, darf der Filter **nicht**
  `hero.hp <= 0` oder einen Status abfragen.
* `engine.actionPlaceCreature` prueft von sich aus KEINEN Heldenzustand
  — das ist Absicht und darf nicht "nachgebessert" werden.

Der Fehler, der zu dieser Regel gefuehrt hat: `Infinitely Reproducing
Slime` ("place it into the Support Zone of any Hero you control") rief
`getFreeSupportZones` mit `livingHeroesOnly: true` und konnte deshalb
nicht zu einem gefallenen Helden nachlegen.

Reference implementations: `infinitely-reproducing-slime.js`
(`placementZones`), `drill-sergeant.js` (place from hand under the
host Hero, base + island zones), `actionPlaceCreature` in `_engine.js`.

Since v607 `getFreeSupportZones` also returns **island zones** (Flying
Island in the Sky, slots 3+, `isIsland: true`) — they may only hold
Creatures, and every caller of this collector places Creatures. Do not
hand-roll a `for (si < 3)` loop for a Creature placement.

### Support-Zone effects — respect "Defending the Gate" (MANDATORY)

> **Defending the Gate** (Artifact / Surprise): a face-down Surprise
> that, once activated, shields **every card in the activating
> player's Support Zones** — Creatures, Equipment, and Attachments —
> from being destroyed, moved, stolen, or otherwise removed from the
> board by an opponent's card or effect for the rest of the turn.

When you author or modify ANY card or effect that **removes or
relocates a card in a Support Zone** — destroy → discard/deleted,
steal-to-hand, bounce-to-deck/hand, control transfer, an opponent's
forced sacrifice, a bespoke "pull this Creature off the board" path,
etc. — it **must** give the card's controller a chance to raise
Defending the Gate, and abort if that side is shielded.

The single source of truth is the engine pair:

```js
await engine._triggerGateCheck(side, sourceName); // async — opens the activation window
engine._isGateShielded(side) → bool                // true once that side raised it
```

**You usually get this for free.** The engine chokepoints already
trigger + honour it — `actionDestroyCard`, `actionMoveCard`
(support → anywhere), `actionTransferCreature`, the Fire Bomb /
ability-removal paths. If your card routes its Support-Zone removal
through one of those, you are already compliant.

Anything that does **raw Support-Zone manipulation** — splicing a
card out of `supportZones` directly instead of going through a
chokepoint (`_sparkfly-shared.stealBoardCardToHand`, Tengu Windstorm's
bounce, …) — MUST trigger + check the gate itself:

```js
const gateSide = targetInst.controller ?? targetInst.owner;
await engine._triggerGateCheck(gateSide, sourceName);
if (engine._isGateShielded(gateSide)) return; // shielded — abort the removal
```

Defending the Gate is a **face-down Surprise** — unknown at targeting
time — so a card CANNOT gray itself out / pre-filter gate-protected
targets. Trigger the check at **resolution** (as Fire Bomb and Capture
Net do): the effect targets normally, then fizzles cleanly if the gate
goes up. The card and its cost are still spent.

Scope: `_isGateShielded` is keyed to the side whose Support card you
are affecting — your own gate, untriggered against your own effects,
never blocks you. Damage to Support-Zone Creatures is governed by the
damage pipeline, not this rule.

Reference: `_isGateShielded` / `_triggerGateCheck` in `_engine.js`;
`fire-bomb.js`; `capture-net.js` (via `stealBoardCardToHand`).

---

### Spell-school filters — read BOTH fields, never `spellSchool1` alone (MANDATORY)

> **Al's ruling (16.8.):** a card that is *partly* a given school **counts as
> that school**. Friendship locks a Spell that is only half Support Magic;
> Holy Cheese finds it; Angry Cheese finds a half-Destruction Spell, and so on.
> A dual-school card belongs to **both** of its schools, everywhere.

Use the shared helper — never compare a field directly:

```js
const { hasSpellSchool } = require('./_hooks');

if (hasSpellSchool(cd, 'Support Magic')) { /* … */ }        // ✅
if (cd.spellSchool1 === 'Support Magic') { /* … */ }        // ❌ misses half of them
if (cd.spellSchool1 === 'X' || cd.spellSchool2 === 'X') {}  // works, but don't add new ones
```

Sweep 6.9. (v800): der letzte einseitige Rest im Kartenbestand war
`call-for-help.js` (Friendship-Sperre gegen Energy Drain, Holy Selection,
Sacrifice to Divinity lief ins Leere) — nachgezogen. Alle anderen Skripte
lesen beide Felder oder den Helfer.

**Why a one-sided read is not a 50/50 gamble but a systematic miss:** since the
dual-school ordering rule (Al, 11.8.) the two fields are **alphabetically
sorted**, not "main school first". So a school always lands in the same slot
relative to its partner:

| School            | Sorts | Can appear in `spellSchool2`?          |
|-------------------|-------|----------------------------------------|
| Decay Magic       | 1st   | never (always field 1)                 |
| Destruction Magic | 2nd   | only paired with Decay                 |
| Fighting          | 3rd   | —                                      |
| Magic Arts        | 4th   | paired with Decay / Destruction        |
| Summoning Magic   | 5th   | paired with any of the above           |
| Support Magic     | 6th   | **always** — it sorts behind all others |

`spellSchool1 === 'Support Magic'` therefore misses **every** dual-school
Support Spell there is. That was a live bug in ten places until v425
(Friendship, Lizbeth, Divine Gift of The Light, Thalia, the playability gate,
the hand grey-out and the "support spell used this turn" flag). The six cards
it silently exempted: Dangerous Knowledge, Energy Drain, Holy Selection,
Sacrifice to Divinity, The Light Brigade Marches, Spectral Armor.

**The one exception** is the de-duplication idiom when *collecting* a card's
schools — that one is about field identity, not membership, and stays:

```js
const schools = [];
if (cd.spellSchool1) schools.push(cd.spellSchool1);
if (cd.spellSchool2 && cd.spellSchool2 !== cd.spellSchool1) schools.push(cd.spellSchool2);
```

---

### Removing a *chosen* board card to a pile — anchor the flight by ZONE, not name (MANDATORY)

> **The bug:** the client's diff-based board→discard/deleted fly-out
> animator (`animsFromBoard` / `captureBoardRects` in `app-board.jsx`)
> resolves the flight's **source by card NAME** and takes the *first*
> captured rect. With duplicate-named cards on the board (same Creature
> in two Support slots, same Ability on two Heroes, a `?` for multiple
> face-down opp Surprises, …) it animates from the **left-most** one —
> the wrong slot.

Any card/effect that lets a player **pick a specific board card and
move it off the board** needs a zone-anchored `play_pile_transfer` for
that exact instance. **In den meisten Fällen musst du dafür NICHTS tun:**

> **`actionDestroyCard` sendet den verankerten Flug selbst** — und zwar
> ERST NACH allen Abbruchpfaden (Immunität, Cardinal Beast, First-Turn-
> Schutz, Gate Shield, Monias `beforeCreatureAffected`). Wird die
> Zerstörung abgewehrt, fliegt also korrekt nichts.

**Sende hier KEINEN eigenen `play_pile_transfer`.** Ein zusätzlicher
Broadcast erzeugt einen Doppelflug; steht er wie früher VOR dem Aufruf,
animiert er die Karte sogar dann weg, wenn die Zerstörung anschließend
abgewehrt wird (im Feld beobachtet: The Yeeting → Monias Rettung).

```js
// RICHTIG — die Engine erledigt den Flug:
await engine.actionDestroyCard(source, targetInst);

// Nur wenn die Karte eine EIGENE Leichen-Animation besitzt
// (Brackle's Katapult, Berserk):
await engine.actionDestroyCard(source, targetInst, { skipPileTransfer: true });
```

**Selbst senden musst du nur, wenn du die Karte MANUELL bewegst**, also
ohne `actionDestroyCard` — etwa per `splice` + `discardPile.push`
(Silent Water Mizune, Weird Doll). Dann gilt: Anker vorher merken,
Broadcast NACH der tatsächlichen Bewegung senden.

```js
engine._broadcastEvent('play_pile_transfer', {
  owner: inst.owner,                // oder fromOwner/toOwner cross-side
  cardName: inst.name,
  from: 'surprise', to: 'discard',  // 'support' | 'ability' | …
  fromHeroIdx: inst.heroIdx,
  fromSlotIdx: inst.zoneSlot,       // bei surprise weglassen
});
```

Scope / exclusions:
- **area** → `actionMoveCard` already broadcasts `area→discard`
  (owner-scoped, one Area per side — no name ambiguity). Don't double it.
- **coolnessStackTop** → flies via `actionPopCoolnessStackTo`.
- **permanent** → not captured by the diff animator; pass `fromPermId`
  instead of `fromSlotIdx` if you do animate it.

The frontend's `onPileTransfer` pre-suppression bucket covers
`from ∈ {hand, support, ability, surprise}` → `{discard, deleted}` so
the duplicate name-keyed diff flight is dropped and only the
zone-anchored flight plays. `to: 'hand'` / `to: 'deck'` have their own
handled paths.

Reference implementations:
- **Ralzish**, **The Yeeting**, **_spider-shared** — destroy→discard;
  sie sendeten den Broadcast früher SELBST und erzeugten damit einen
  Doppelflug. Seit 1.8. verlassen sie sich auf `actionDestroyCard`.
  NICHT als Vorlage für eigene Broadcasts nehmen.
- **Sparkfly Worker** (`_sparkfly-shared.stealBoardCardToHand`) and
  **Tengu Windstorm** (`_bounceToDeck`) — already correct: they emit a
  zone-anchored `play_pile_transfer` (`to: 'hand'` / `to: 'deck'`,
  `fromOwner`/`toOwner`, `fromPermId` for permanents).
- **Dive Bomblebee** — already correct via a different route: it plays
  a zone-anchored *impact* animation (`bomblebee_dive` keyed to
  owner/heroIdx/zoneSlot) and never resolves a source by name (the card
  just leaves on the next sync; no flight), so the bug can't occur.

When in doubt: if the player *chose* the card and it *leaves the
board*, send the zone-anchored `play_pile_transfer` yourself.

---

### Permanent control transfer — ALWAYS physically moves the Creature (MANDATORY)

> **Rule:** any card / effect that grants **permanent control** of an
> opp Creature MUST physically relocate it to a free Support Zone on
> the new controller's side. A bare `inst.controller = newOwner` flip
> WITHOUT a move is **wrong** — it leaves the Creature sitting in the
> previous controller's slot while card-text reads ("Creatures you
> control", "your Support Zone", board-position-based interactions)
> partially disagree about where it lives.

The standard engine path:

```js
// 1. Build the free-zone list on the new controller's side.
const freeZones = [];
for (let hi = 0; hi < newOwnerPs.heroes.length; hi++) {
  if (!newOwnerPs.heroes[hi]?.name) continue;     // empty hero slot
  for (let si = 0; si < 3; si++) {
    if (((newOwnerPs.supportZones[hi] || [])[si] || []).length === 0) {
      freeZones.push({ heroIdx: hi, slotIdx: si });
    }
  }
}
// 2. No free zone → effect fizzles (or stays on the previous side,
//    depending on the card's wording — most "take control" effects
//    just fail when there's no room).
if (freeZones.length === 0) return;

// 3. Pick a destination. The new controller's player picks for
//    intentional control plays (Dark Gear, Diplomacy). For automatic
//    triggers (Jumper Spider's start-of-turn ping-pong), use
//    promptZonePick so the controller still gets to choose.
const picked = await engine.promptZonePick(newOwnerPi, freeZones, {
  title: sourceCardName, description: `Move ${inst.name} where?`,
});
const dest = picked || freeZones[0];

// 4. Single chokepoint — handles source-zone splice, the
//    onCardLeaveZone hook, the slide-across transfer animation,
//    destination placement, controller/owner/zone reassignment,
//    guardian-immunity sync, onCardEnterZone (with _isMove: true),
//    and the onTakeControl hook.
await engine.actionTransferCreature(inst, newOwnerPi, dest.heroIdx, dest.slotIdx);
```

**Defending the Gate**: if the effect SHOULD be blockable by the gate
(Dark Gear / Diplomacy — opp's effortful "I want this creature" play),
the CALLER runs the gate check BEFORE `actionTransferCreature` (see
the preceding section). If the effect is unconditional (Jumper
Spider's automatic ping-pong — card text says it just happens),
skip the gate check entirely.

**Why this matters:**
- The diff-detector, status-removal targeting, ability-zone reads, and
  every "card in your Support Zone" gate look at `(inst.controller,
  inst.heroIdx, inst.zoneSlot)` together. A controller-only flip leaves
  the Creature physically in opp's column — visible to both players in
  the wrong column, and a footgun for any future card that gates on
  "in your Support Zone" semantics.
- `actionTransferCreature` is the **only** path that plays the slide-
  across animation, syncs guardian immunity, fires `onTakeControl`,
  and updates `inst.zone` / `inst.heroIdx` / `inst.zoneSlot` /
  `inst.controller` / `inst.owner` in lockstep. Hand-rolling any of
  those steps drifts from the engine contract.

Reference implementations:
- **Dark Gear**, **Diplomacy** — proactive "take control" plays. Build
  freeZones, prompt for a slot, then `actionTransferCreature`.
- **Jumper Spider** — automatic start-of-turn ping-pong. Uses the same
  flow on each turn flip; if the new turn player has no free zone, the
  transfer simply skips this turn (Jumper Spider stays under the
  current controller and tries again next turn).

---

### Immunities block effects, NEVER animations (MANDATORY)

> **Rule:** when a card's effect on a target is blocked by an immunity
> / protection / negation gate (Anti Magic Enchantment, Resistance,
> Diver Helmet, Cardinal-Beast immunity, charmed-hero damage gate,
> first-turn protection, untargetable, Wall of Deri, Truth-Seeing
> Eye's redirect block, magic_immune, …), the **gate stops the
> effect's state mutation, not its visuals**. Projectile flights,
> impact bursts, channel beams, hand→target swooshes, screen flashes —
> all of these still play.

**Why this matters.** A blocked effect with no visual reads as "the
card did nothing" or "the game lagged" — players can't tell that the
opponent's protection was the reason. Playing the animation first and
*then* fizzling the state change makes the block itself a visible
beat: the heart/fireball/beam lands, and only then does the protection
sigil / "✗" flash announce that the effect bounced. Same UX as
Anti Magic Shield (the spell still animates → then the chain shows
the negation): the player sees what they paid for, and the protection
gets credit for the save.

**Authoring contract.** In any `onPlay` / `resolve` / activated effect
where you check an immunity gate:

```js
// 1. Play the animation(s) FIRST — projectile flight, impact burst,
//    channel beam, whatever the card uses. await their duration so
//    the visual finishes landing before any state mutation OR fizzle.
engine._broadcastEvent('play_projectile_animation', { /* … */ });
await engine._delay(PROJECTILE_MS);
engine._broadcastEvent('play_zone_animation', { type: 'love_burst', /* … */ });
engine.sync();

// 2. NOW consult the immunity gate(s). On block, optionally play a
//    "protection sigil" flash (anti_magic_block / resistance_flash /
//    etc.) so the block reads clearly, log it, and return.
if (engine._isHeroSpellProtected(targetHero, CARD_NAME)) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'anti_magic_block', owner: tOwner, heroIdx: tHeroIdx, zoneSlot: -1,
  });
  engine.log('blocked', { /* … */ });
  return;
}
// Resistance / other beforeHeroEffect gates: same shape.
const effectCtx = { /* … */ cancelled: false, _skipReactionCheck: true };
await engine.runHooks('beforeHeroEffect', effectCtx);
if (effectCtx.cancelled) { engine.log('resisted', { /* … */ }); return; }

// 3. Effect lands — state mutation goes here.
```

**Exceptions.** Two narrow carve-outs where the engine *itself*
short-circuits before the visual can fire, by design:
- **Reaction-chain Spell negation** (Anti Magic Shield, Storm Ring,
  Invisibility Cloak's pre-effect window, etc.) runs in the chain
  window *before* the casting card's `onPlay`. The cast's `onPlay`
  simply never runs, so its visuals don't fire. The chain UI shows
  the negation itself, which is the visible beat in this case.
- **`_spellNegatedByEffect` mid-resolve** void in `_actionDealDamage`
  Impl: if a post-target reaction sets the flag, subsequent damage
  events from the same Spell silently zero. This is intentional — the
  Spell's earlier visual already played; the silent void only affects
  *further* damage events the Spell would have tried to deal.

For everything else: **animate, then gate**. Don't ever write a gate
check at the top of `onPlay` that returns before the visual fires.

Reference implementation: **Love Shot** — the heart projectile flies
+ the `love_burst` lands BEFORE the Anti Magic / Resistance check, so
a protected target visibly sees the heart hit before the block reads.

---

### Instance card-data overrides — always read them via `getEffectiveCardData` (MANDATORY)

> **The pattern:** a few cards put a card on the board under one name
> while it *is*, for game-rules purposes, something else. A **Biomancy
> Token** is the canonical case: the Potion itself is placed in the
> Support Zone and only `inst.counters._cardDataOverride` turns it into
> a `Creature/Token`.

Any code that asks *"what kind of card is this instance?"* must go
through the engine helper, never the raw database:

```js
const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];  // ✅
const cd = cardDB[inst.name];                                       // ❌
```

`getEffectiveCardData` returns the plain DB entry when no override
exists, so the swap is free for every ordinary card. Reading raw is a
silent bug: the instance answers with the *underlying* card's type, HP
and level, and rules code quietly excludes it. Two real ones, both
fixed after Al reported them: the AoE target collectors (hence the
`token-override-aware` comments scattered through `_engine.js` and the
shared modules) and `getSacrificableCreatures`, where Biomancy Tokens
were not sacrificable at all until v399.

**The one deliberate exception** is a card that asks about the
*underlying* card on purpose. Kyli, the Deceptive Sapling reads *"when
you sacrifice a Creature that is **not a Potion**"* — her anti-loop
clause exists precisely because a Biomancy Token is a Potion. That
check uses the raw DB via `_biomancy-shared.isPotionCardName`, and it
says so in a comment. If you write such a check, say why.

**Creating a Biomancy Token:** don't rebuild the counter block. Call
`placeBiomancyToken(engine, pi, heroIdx, potionName, level, opts)` from
`_biomancy-shared.js` — the single interpretation site, shared by
`biomancy.js`, `kyli-the-deceptive-sapling.js` and the puzzle loader in
`server.js`. Need only the counters (no placement)? Use
`biomancyTokenCounters(potionData, level)`.

---

### Borrowed identity — a card that *is* another card for one turn (v573)

> **The pattern:** Future Tech Copy Device takes on another Artifact's
> name, Cost and effect for the rest of the turn — including becoming
> an Equipment if it copied one.

Nothing is renamed. The instance keeps its own name and carries three
counters that already existed, each with its own job:

| Counter | Does | Precedent |
|---|---|---|
| `_effectOverride` | hooks + `activeIn` come from the copied card | Soul Shard Sah |
| `_cardDataOverride` | name, Cost, type, effect text via `getEffectiveCardData` | Biomancy Token |
| `treatAsEquip` | `isEquipInZone` says yes | Initiation Ritual |

Renaming would have meant finding the right entry again at turn end —
piles are name lists, so several identical entries are indistinguishable.
The overlay just falls off.

**Every lookup that resolves a script from a NAME must go through the
override**, or the card is highlighted and the click does nothing:

```js
const script = loadCardEffect(inst.counters?._effectOverride || cardName);  // ✅
```

Current sites: `CardInstance.getHook`, `CardInstance.isActiveIn`,
`getActivatableEquips`, `getActivatableEquipsCrossSide`,
`doActivateEquipEffect` and its cross-side instance lookup. For
anything resolved out of a **Support Zone** there is now one helper —
use it instead of `loadCardEffect(cardName)`:

```js
const script = engine.supportCardScript(owner, heroIdx, cardName);   // ✅
```

It backs `heroBlocksTargeting` (Jetpack), the equipped post-target
reaction pass (Weathercock) and the `lethalProtection` scan. **A new
name-keyed lookup needs the same treatment.**

#### A card must not look for ITSELF by name

The mirror of the same rule, on the card side. A borrowed identity
sits in the zone under the CARRIER's name, so this finds nothing:

```js
for (const slot of ps.supportZones[hi]) if (slot.includes(CARD_NAME)) return hi;  // ❌
```

Prefer the instance: `ctx.card` in hooks and equip effects, and — for
the equipped post-target reaction — `opts.inst` / `opts.heroIdx`, which
the reaction pass now hands in. Where a contract genuinely has no
instance (`canEquipToHero`), count instances by EFFECTIVE identity
(`inst.counters._effectOverride || inst.name`) rather than scanning
zone names; Future Tech Gear's "only 1 equipped" is the worked example.
Both bugs were live until v575 and neither showed up in normal play —
they only appear once a copy is involved.

#### `onIdentityExpire(ctx)` — the expiry that cannot be shadowed

A borrowed identity ends at turn end. That expiry **must not** live in
the card's own `onTurnEnd`: `getHook` reads hooks off the *copied* card
while an override is set, so copying anything that has its own
`onTurnEnd` (Future Tech Control Device does) would shadow the
rollback and the identity would stick forever.

The engine therefore sweeps it in `switchTurn`, right beside
`_expireTurnEndAdditionalActions` and for the same reason — *an expiry
the expiring thing can switch off is not an expiry*:

```js
// The card marks itself:
inst.counters._identityExpiresTurn = engine.gs.turn;

// The engine calls the OWN script (never the override) at turn end:
async onIdentityExpire(ctx) { /* drop an equipped copy, clear aliases … */ }
```

`_expireBorrowedIdentities()` clears `_effectOverride`,
`_cardDataOverride`, `_identityExpiresTurn` and `treatAsEquip`
afterwards in every case — even when the card exports no contract or
its cleanup threw. A stuck identity is the worse state. The contract is
listed in `_loader.js` so a card whose whole content is this hook still
loads.

---

### Activating a card FROM THE DISCARD PILE (v582)

> Future Tech Prototypes is the first card that does something while
> sitting in the discard: *"While this card is in your discard pile,
> you may once per turn change its name…"*. Every other activation
> path runs through hand, board, ability or area zones.

The contract mirrors `equipEffect` on purpose:

```js
module.exports = {
  activeIn: ['discard'],        // stay tracked there
  discardEffect: true,
  canActivateDiscardEffect(gs, pi, engine, inst) { … },
  async onDiscardEffect(engine, pi, inst) { … },
};
```

**The pile is a NAME LIST, not an instance list.** A card that acts
from there needs an instance for its counters and its per-turn lock, so
`getActivatableDiscardCards` pairs each pile entry with one tracked
`zone: 'discard'` instance and offers nothing when there is none — most
cards reach the discard as a bare name. If your card must be usable
there, re-zone its instance yourself when it arrives (the Ladder to the
Sky pattern).

**The whole chain, five links** — a missing one shows up as "the card
is highlighted and clicking does nothing":

1. the card (above)
2. `engine.getActivatableDiscardCards(pi)` — the collector
3. `activatableDiscard` in **both** state projections (server.js)
4. `doActivateDiscardEffect` + the `activate_discard_effect` socket route
5. the pile dialog renders `.pile-card-activatable` and emits the click

The server re-checks everything the collector checked — active player,
phase, and membership in the collector's own offer. The collector drives
the *display*; the handler drives the *effect*, and a manipulated client
must not slip past it (same reasoning as `neverPlayable`).

---

### `cannotBeIncreased` — "this damage cannot be increased" (v579)

> Future Tech Doomsday Bomb is the first card with this clause. It is
> **not** the same as true damage: `actionDealTrueDamage` also strips
> reductions, immunities and lethal saves, which the text does not say.

Pass it as an option on either damage path; the engine clamps the
amount back down if a `beforeDamage` / `beforeCreatureDamageBatch`
listener raised it:

```js
await engine.actionDealDamage(src, hero, n, 'artifact', { cannotBeIncreased: true });
await engine.actionDealCreatureDamage(src, inst, n, 'artifact',
  { sourceOwner: pi, cannotBeIncreased: true });
```

**One-sided on purpose.** Listeners still run (they set flags and have
side effects), and REDUCTIONS still apply — shields, Cloudy and the
rest keep working. Only an increase is taken back, and the engine logs
`damage_increase_blocked` when it does. The symmetric sibling is
`amountIsFinal`, used for redirected damage.

**Both halves are needed.** Boosters live on two hooks — Angler Angel
raises hero damage in `beforeDamage` and creature damage in
`beforeCreatureDamageBatch`. Wiring only the hero side leaves the rule
half-implemented, and no test that merely checks "the creature died"
will notice.

---

### Puzzle Mode — every card must work there, and every Counter must be authorable (MANDATORY)

> **Al's rule (16.8.):** every new card is play-tested through **Puzzle
> Mode**. It must work there. And **if a card uses Counters, those
> Counters must be settable in the Puzzle Editor** — otherwise the one
> state that matters most for the card can't be reproduced in a test.

Puzzle Mode is not a reduced engine — it runs the same `GameEngine`, so
a card that works in a normal game usually works there too. The two
things that differ, and that you have to think about:

1. **No MCTS.** Reaction chains and puzzles run the heuristic CPU path
   (`cpuReactionDecision`, `_getCpuGenericResponse`), not the search.
   A card whose CPU behaviour lives only in `evaluateState` will look
   inert in a puzzle. If the CPU must do something specific, give the
   card a `cpuResponse` — that is the path a puzzle actually takes.
2. **Starting state is authored, not played into.** Anything the card
   needs in order to be interesting has to be reachable from the
   editor: HP, ATK, statuses, buffs, gold (`pz.gold`, per player),
   Areas, Surprises, hand contents — **and Counters.**

**Wiring a new Counter into the editor.** There is no generic registry;
each Counter type is declared in two places that must agree. Follow the
existing pairs (Head Counter / Change Counter / Evolution Counter /
Invest Counter / Balance / Bunny Bomb / Anti Magic level):

- **Client — `public/app-puzzle.jsx`:** one `useState` for the value
  (`editXCounter`), hydrated in `openStatEditor` and gated so the
  section stays hidden for unrelated cards. Gate by card name, by an
  explicit `Set`, or by `archetype` from the card DB — prefer the
  archetype/`Set` route so a later sibling card works without touching
  the editor (`isWaflavHeroName` is the model). Hero Counters are saved
  on the hero as `hero._xCounters`; card Counters go under
  `_creatureStatuses[<heroIdx>-<slot>].x`.
- **Server — the puzzle loader in `server.js` (`createPuzzleGame` →
  `buildPlayerState`):** one block that copies the authored value onto
  the live object — `hero._xCounters` for Heroes,
  `inst.counters.x` for support-zone cards.

If a Counter exists in the engine but in neither of those places, the
card is untestable by Al's workflow and counts as unfinished.

---

### Deferred side-effects — NEVER use `setTimeout` / `setImmediate` for animation bursts (MANDATORY)

> **Rule:** any code path that calls `engine._broadcastEvent(...)` (or
> any other side-effect with externally-visible state) MUST be reached
> via `await engine._delay(N)`, NEVER scheduled via `setTimeout(fn, N)`,
> `setImmediate(fn)`, `queueMicrotask(fn)`, or a raw
> `new Promise(r => setTimeout(r, N))`.

**Why this matters.** The CPU brain runs MCTS rollouts inside
`engine.enterFastMode()` / snapshot → action → restore boundaries. In
fast-mode, `engine._broadcastEvent` is a no-op (`_engine.js` —
`_broadcastEvent` returns early when `_fastMode === true`) AND
`engine._delay(N)` is a microtask-only `Promise.resolve()` (no real
wait). So a sequence of `flash(); await _delay(200); flash()` runs to
completion **synchronously inside the fast-mode window** and the
broadcasts are correctly dropped.

A `setTimeout(flash, 200)` is fundamentally different: the callback is
queued as a macrotask and **does not run during the rollout**. By the
time Node services the timer, the rollout has already `restore()`d its
snapshot and `exitFastMode()`d — so `_fastMode = false` and the
broadcast goes through with whatever coordinates the closure captured.
Those coordinates often reference the *simulated* board state (slots
that don't exist on the live board, or wrong-owner slots), so phantom
animations paint on random / empty zones of the live UI.

Past field bugs (both fixed):
- **Diamond Spider** — staggered triple `diamond_sparkle` burst on
  Surprise-activated draw used `setTimeout(flashEvent, 200/400)`. Every
  simulated Surprise activation across an MCTS turn (dozens per
  rollout × dozens of rollouts) leaked late-firing sparkles onto live
  client zones.
- **Great Detective Doq** — same `setTimeout`-burst pattern for the
  "correct prediction!" `gold_sparkle` flourish.

**Authoring contract.** When you need a staggered visual burst:

```js
// CORRECT — entire sequence inside the fast-mode window.
const flash = () => engine._broadcastEvent('play_zone_animation', { ... });
flash();
await engine._delay(200);
flash();
await engine._delay(200);
flash();
```

```js
// WRONG — late macrotasks leak past the rollout boundary.
const flash = () => engine._broadcastEvent('play_zone_animation', { ... });
flash();
setTimeout(flash, 200);
setTimeout(flash, 400);
```

**Logic helpers (not broadcasts).** If you must use `setTimeout(0)` /
`setImmediate` for batch deferral or async re-checks that DON'T
broadcast — Divine Gift of Time's discard-batch consolidation, Big
Gwen's hand-limit recheck — guard the queue at scheduling time:

```js
if (engine._fastMode) return; // skip during MCTS rollouts
setImmediate(() => { /* live-state recheck */ });
```

Otherwise the simulated trigger fires a deferred callback that runs
against the post-restore live state, which usually no-ops but can
surface unexpected prompts in edge cases.

## „Up to X times per turn" — EIN Verfahren (ab v417)

**Als Regel (16.8., verbindlich):** X-mal in MEINER Runde, dann
FRISCHE X-mal in der Gegnerrunde. `gs.turn` zählt jeden Spielerzug
hoch, der Rundenstempel im gemeinsamen Zähler setzt das automatisch um.

```js
const { usesLeft, spendUse, refundUse } = require('./_charges');
const USE_KEY = 'meineKarte';   // frei wählbar, pro Karte eindeutig

module.exports = {
  chargesPerTurn: 3,        // Anzeige oben rechts (nur bei X > 1!)
  chargeKey: USE_KEY,       // mehr braucht die Anzeige nicht

  hooks: {
    irgendeinTrigger: async (ctx) => {
      const gs = ctx._engine?.gs;
      // prüft UND verbucht in einem — false heißt „nichts mehr frei"
      if (!spendUse(ctx.card, gs, { key: USE_KEY, max: 3 })) return;
      …
    },
  },
};
```

| Funktion | Zweck |
|---|---|
| `usesLeft(inst, gs, {key, max})` | Nur lesen — z.B. für Prompt-Texte |
| `spendUse(inst, gs, {key, max})` | Prüfen + verbuchen, `false` wenn leer |
| `refundUse(inst, gs, {key})` | Reservierung zurückgeben (Abbruch) |

### Verbuchen erst NACH der Zusage

**Al-Regel (16.8.):** Bricht der Spieler ab, darf ihn das KEINE Ladung
kosten. Also `spendUse` erst rufen, wenn die Wahl steht:

```js
const frei = usesLeft(ctx.card, gs, { key: USE_KEY, max: 3 });
if (frei <= 0) return;                       // Gate: nur prüfen

const target = await ctx.promptDamageTarget({ … });
if (!target) return;                          // Abbruch — nichts verbucht

spendUse(ctx.card, gs, { key: USE_KEY, max: 3 });   // erst JETZT
```

Braucht die Karte einen Schutz gegen ihre eigene Wiedereintritts-
schleife (Antonia iteriert über eine Schadensrunde), darf sie
stattdessen vorab reservieren — muss dann aber auf JEDEM Abbruchpfad
`refundUse` rufen.

**KEIN `onTurnStart` zum Zurücksetzen schreiben.** Der Stempel erledigt
das. Genau diese vergessbare Rücksetzung war der Bug bei Archer und
Golden Vermin: ihre Hooks liefen nur beim EIGENEN Rundenbeginn, damit
galt ein Kontingent für beide Züge zusammen.

**Bei genau EINER Ladung wird nichts angezeigt** — solche Karten sind
Schalter. `chargesPerTurn: 1` ist erlaubt, die Engine filtert es raus.

Hängt die Anzeige an einer Bedingung, statt `chargeKey` eine Funktion
`remainingCharges(inst, gs)` liefern, die `null` zurückgibt, wenn
nichts angezeigt werden soll (Vorbild: Smug Mastermind Antonia zeigt
nur, solange „Cool Rescuer Monia" unter ihr liegt).

---

## Puppets-Archetyp — Engine-Verträge (v704)

Erster Nutzer: Tri Fecta / Tri Ad + die sechs Puppet-Tokens (`_puppets-shared.js`
ist die einzige Auslegungsstelle des Archetyps). Alle Verträge sind generisch.

| Skript-Flag / Hook | Wo | Bedeutung |
|---|---|---|
| `choosableAsCreature: true` | Token | „can still be chosen like one": die Zielwähler (`promptDamageTarget`, `promptMultiTarget`, `getCreatureTargets`), die Aktivierungsliste (`getActivatableCreatures`) und die **„any target"-AoE** (`types` enthält `hero` UND `creature`) nehmen die Instanz wie eine Creature. `hasCardType(…,'Creature')` bleibt unverändert — sie zählt nirgends als Creature. Helfer: `engine.isChoosableAsCreature(inst, cd)`. |
| `sharesHpWithHero: true` | Token | Kreaturenschaden an die Instanz wird am Kopf von `processCreatureDamageBatch` auf den Helden derselben Spalte umgebucht (`_reroutePooledCreatureDamage`; Heldenpfad inkl. Punkt-vor-Strich/Schilde, OHNE Zielwahl-Surprise-Fenster). Status-Ticks laufen mit. `actionHealCreature` → `actionHealHero`. Batch-Eintrag trägt `_pooledToHero`, `{dealt}` spiegelt den Heldenpfad. |
| `cannotChangeSupportZone: true` | Token | `actionMoveCard` blockt Support→Support in eine andere Spalte/Slot/Seite (`move_blocked`); Zerstörung/Ablage bleibt (anders als `immovable`). |
| `supportZonesLocked(engine, pi, heroIdx, {source, cardName, via})` | Held | Zonensperre der Spalte. Gates: `doPlayCreature` (server), `summonCreatureWithHooks`, `actionPlaceCreature`, `actionMoveCard`, `getFreeSupportZones` (Opt-out `includeLocked`). **Reaktives Netz** für Direkt-Schreiber (Bakhm-Sets, Mummy Token, Ushabti, Illusionen …): `_enforceSupportZoneLock` im `onCardEnterZone`-Verteiler nimmt eine unerlaubte Platzierung zurück (Karte → Hand des Besitzers, Token → Deleted, Log `placement_reverted`). |
| `plainHeroForm: true` (Skript) bzw. `performAscension(…, { plainHeroForm })` | Held / Engine | Ein NORMALER Hero (DB-Typ `Hero`) wird als **Form** auf einen Helden gelegt — Bedienung wie Ascension (Drag auf den Helden / Klick → `ascend_hero`; der Client bekommt die Namen als `gameState.plainHeroForms` aus `getPlainHeroFormNames()`). `performAscension` erkennt das Skript-Flag, erzwingt `notAnAscension` (kein Bonus, keine Trigger, kein Zugende) und ruft danach `onPlainFormPlaced(engine, pi, heroIdx)`. Die Karte gilt weiterhin nicht als Ascended. Bereitschaft (`ascensionReady`/`ascensionTargets`) pflegt der BASIS-Held über `refreshAscensionReadiness`; die Form-Karte exportiert `ascensionCondition` (+ `ascensionConditionUnskippable`) und `formsAscensionStack`. Rückweg wie Open Invitation: `performDescend({ noDiscard, notADescend })` + Karte zurück in die Hand. |
| `isBoardRedirect` + `canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine)` + `onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard)` | Support-Instanz **oder lebender Held** (v708: `_boardGuardInstances`); ein Skript darf mehrere Wächter als `boardGuards: [ … ]` exportieren, jeder mit eigenem `guardCardName` für den Prompt | Vierter Scan im Umleitungsfenster (`_checkTargetRedirectOnce`, nach Hand/Held, vor Surprises). Rückgabe `{ redirectTo }` (Laki) oder `{ dropTargetIds: [...] }` (Teil-Negation, Vinny — mit `isBoardNegation: true`, schweigt bei `cannotBeNegated`). `config._redirectPickedIds` = die ganze aktuelle Auswahl. `applyRedirectWindows` entfernt die genannten IDs (leere Auswahl → `[]`); im Einzelziel-Pfad wirkt ein Drop wie eine Negation. Optionaler Prompt-Text `boardRedirectPrompt(attackerName, selected, engine)`. Eine Ablehnung stempelt `gs._boardGuardDeclined["<owner>:<source>"] = turn`. |
| `boardAoeGuard` + `canGuardAoe(...)` + `onGuardAoe(engine, ownerIdx, inst, entries, sourceCard) → { dropInstIds }` | Support-Instanz | `_applyBoardAoeGuards` in `actionAoeHit` nach dem Sammeln der Kreatureneinträge (nur gegnerische Quelle). |
| `boardEffectGuard` + `canGuardEffect(gs, ownerIdx, inst, targetInsts, source, kind, engine)` + `onGuardEffect(engine, ownerIdx, inst, targetInsts, source, kind) → { dropInstIds }` | Support-Instanz | `_offerBoardEffectGuard` für Pfade OHNE Zielwahl-Fenster: Kreaturen-Schadensbatch (manuelle Schleifen; `kind:'damage'`, Status-Ticks fragen nicht), `actionDestroyCard` (`'destroy'`), `applyCreatureStatus` (`'status'`). Opt-out je Aufruf `_skipBoardGuard`. Dieselbe Quelle fragt nach einer Ablehnung im selben Zug nicht erneut. |
| `notAStartingHero` / Kartentext „cannot be one of your Starting Heroes" | Held | Deckbuilder (`isNonStartingHero` in app-shared.jsx: `canAddCard`/`canCardTypeEnterSection`) und Server (`canCardTypeEnterPool`, Daily-Hero-Pool) lesen den **Kartentext** — neue Karten mit dem Satz sind automatisch erfasst. |

Puppet-Konventionen (`_puppets-shared.js`): Luck-Umleitung (`LUCK_GUARD`) und Preserve-Negation (`PRESERVE_GUARD`) hängen als `boardGuards` an Tri Fecta/Tri Ad — Counter sind jederzeit einlösbar, auch ohne Laki/Vinny; kontrolliert ein Spieler keinen der beiden Helden mehr, verschwinden alle seine Luck/Preserve Counter (`purgePuppetCountersIfOrphaned`, `onHeroKO` + Token-Niederlage). Tausch = eigener Alias-Klang je Token (`puppet_swap_*`, `puppet_form_change`; Client ZONE_ANIM_SFX), waehrend des gesamten Formwechsels sind alle Puppets der Spalte gesperrt — ab dem Identitaetswechsel in `performAscension` (generischer Engine-Stempel `gs._formChangeInProgress[pi-hi] = {turn}`, nur bei `plainHeroForm`) bzw. ab Tri Ads Rueckweg vor `performDescend` (`setPuppetSwapLock`), Abfrage `isPuppetSwapInProgress`; Token-Glanz ohne Wartezeit ueber `puppetGlow` (direkter `effect_source_glow` mit Koordinaten); Puzzle-Editor setzt Luck (`hero._luckCounter`, `counters.luck`) und Preserve (`counters.preserve`), sobald ein Spieler Tri Fecta/Tri Ad kontrolliert, Preserve/Luck Counter ueberleben den Tausch (`PERSISTENT_COUNTERS`); Pavi laeuft als Immediate-Action-Subroutine (`performImmediateActionAnyHero`, Creature-only, abbrechbar). `collectNonHeroBoardTargets` liefert Surprises als `surprise-<owner>-<heroIdx>` / Typ `surprise` (v706-Korrektur, betraf auch The Yeeting). Tokens haben nie Summoning Sickness (`markNoSummoningSickness`: `turnPlayed 0` + `_hasHaste`), Token-Paare `TO_AD`/`TO_FECTA`, `swapPuppetTokens` (stiller Austausch am Platz: Slot-Name + Instanz ersetzt, frische ID = frisches HOPT, `turnPlayed 0`, je Token eine eigene Zonen-Animation), Aktivsperre `gs._puppetActiveLock[pi-hi] = {turn, instId}` (`canUsePuppetActive` / `lockPuppetActives`), `checkPuppetHeroDefeat` (Helden-Hook liest `ctx.leavingCard`, Token-Hook `PUPPET_TOKEN_HOOKS` meldet den eigenen Abgang — zwei Netze), `collectAllyTargets` (Puppets zählen bei „Creatures you control"-Effekten des Archetyps mit — Als Ruling). Luck Counter: `hero._luckCounter` / `counters.luck` (🍀, numerisch, Laki zählt hoch), Preserve Counter: `counters.preserve` (🔒, numerisch); beim Einlösen wird die Karte des Puppets gestreamt (`announceRedeem` → `card_reveal`).

---

## Bleed — Statuseffekt (v712)

Als Regeln (3./4.9.): boolescher Status `bleeding` (wie Burn, „for the rest of the game", cleansbar, Immunität `bleed_immune`, Icon 🩸), **kein Tick**. Der Träger nimmt **nach** jeder eigenen, vollständig aufgelösten Handlung 50 Schaden:

| Auslöser | Bleed? | Pfad |
|---|---|---|
| Action: Attack / Spell / Creature-Beschwörung (auch Zusatz-, Inherent-, Freiaktionen) | ja | `runHooks('onAnyActionResolved')` → `_processBleedAfterAction` (`actionType` `attack`/`spell`/`creature` — Attacks haben den eigenen cardType `Attack`) |
| Ability / Heldeneffekt **mit** Action-Kosten | ja | dito (`ability_activation` nur mit `!isFree && !isInherent`, `hero_effect`) |
| Aktiver Heldeneffekt **ohne** Action-Kosten (Elana) | ja | `resolveHeroEffectActivation` ruft `_processBleedAfterAction` direkt |
| Aktiver Creature-Effekt | ja (die Creature) | `doActivateCreatureEffect` → `_processBleedAfterCreatureEffect(inst)` |
| Equipment/Artifact/Potion, `place`, Surprises, Ascension, passive Trigger | nein | — |

Schaden: Basis `BLEED_BASE_DAMAGE = 50`, vorher Hook **`beforeBleedDamage`** mit `ctx.amount` (veränderbar) und `ctx.bleedTarget = { kind:'hero'|'creature', owner, heroIdx, inst? }` — der Vertrag für Karten, die Bleed-Schaden verändern. Typ `status` (kein Zielwahl-/Surprise-/Vinny-Fenster, Schilde greifen, kann töten). Opt-out je Aufruf: `hookCtx._noBleed`. Client: `BleedingOverlay` (Dauer-Tropfen, Puls über `bleed_tick`), Badge; Animationen: `bleed_apply`/`bleed_tick`/`blood_splatter` = spritzendes Blut (zusätzlich zur normalen Angriffs-Animation), `bloody_cut` = blutiger Schnitt (Fester/Ghoul Guard) — Helden über `animationType` am Status, Creatures per Broadcast aus `bleedCreature`; Puzzle-Editor Status-Toggle für Helden und Creatures.

`_bleed-shared.js`: `bleedHero` / `bleedCreature` / `bleedTarget` (Picker-Ziel; `opts.animationType`), `isTargetBleeding`, `collectPlayerTargets(engine, pi, {notBleeding})` (Helden + wählbare Support-Instanzen inkl. Puppets), `anyTargetBleeding`, `heroFightingLevel`. Karten: Devlin (`beforeDamage`/`afterDamage` + Batch-Paar; Discard nur für **vorher** blutende Ziele), Sorin (`canBypassLevelReqForCard` Attacks ≤ Lv 3; eigener Attack-Schaden gegen nicht-blutende Ziele → 0 bzw. Batch-Eintrag gestrichen), Ghoul Guard (`onCreatureDeath`; Gegnerquelle per `isAttackSpellOrCreatureSource` — Quelle braucht `cardName`), Doctor Fester (`canBypassLevelReq` bei Fighting ≥ 2 + `normalSummonBypass: true`, damit `getHeroBypassSummonCards` die Zonen des Helden im Client freigibt — Karten-seitige Bypässe ohne dieses Flag (Deepsea-Placement) bleiben dort ausgeschlossen; Zusatzbeschwörung nach dem Archer-Muster: `inherentAction` solange kein Ziel blutet (normaler Summon-Pfad — Drag und Klick — läuft als Zusatzaktion), `beforeSummon` erhebt bei `isInherentAction` die Kosten (Held blutet nach Rückfrage; Abbruch lässt die Karte in der Hand), der Summon ist dann die erste Handlung des Blutenden → 50; HOPT-Creature-Effekt).

## Abilities in SUPPORT ZONES — `abilitiesInSupportZones` (v767)

Ein Held (Xal, the Animated Armor) oder ein an ihm ausgeruestetes
Artefakt (Xalibur) setzt am Skript:

```js
module.exports = { abilitiesInSupportZones: true, … };
```

Damit darf dieser Held Abilities in seine Support Zones legen. Sie
sind dort VOLLWERTIG (Al 5.9.): sie stapeln wie in einer Ability-Zone
(Stapelhoehe = Level) und belegen den Platz — daneben passt keine
Creature.

Zwei Engine-Helfer bedienen das, mehr braucht kein Aufrufer:
* `engine.heroAcceptsAbilitiesInSupport(pi, heroIdx)` — liest das Flag
  am Helden UND an seinen Artefakten.
* `engine.heroSupportAbilityStacks(pi, heroIdx)` — die Stapel in der
  Form einer Ability-Zone.

Angehaengt werden sie an genau zwei Stellen, und dadurch zaehlen sie
ueberall: `_getCandidateAbilityZoneSets` (davon haengt der GANZE
`heroMeetsLevelReq`-Vertrag ab) und `effectiveSchoolLevelForCaster`
(alle schulskalierenden Karten). Wer selbst `abilityZones[heroIdx]`
durchlaeuft, sieht sie NICHT — solche Stellen gehoeren auf die beiden
Helfer umgestellt.

Platzierung: `doPlayAbility` (server.js) weicht auf eine Support Zone
aus, wenn alle drei Ability-Zonen belegt sind und der Held es kann.
Stapeln folgt derselben Regel — gleicher Name, hoechstens 3.

Beim Loeschen eines Helden (`deleteHero`) teilt eine Ability in einer
Support Zone das Schicksal der Abilities: sie wird GELOESCHT, nicht
abgelegt.

## Einen Helden RESTLOS loeschen — `deleteHero` (v762)

`await engine.deleteHero(pi, heroIdx, sourceName)` nimmt einen Helden
restlos aus dem Spiel: der PLATZ IN DER SPALTE BLEIBT LEER
(`heroes[i].name === null`), die Heldeninstanz wird ausgebucht, der
Held landet im Deleted Pile.

Was mit ihm geht, folgt zwei verschiedenen Regeln (Al 5.9.):
* ABILITY ZONES → Deleted Pile (das loescht der Aufrufer mit).
* SUPPORT ZONES → Standardregel fuer einen sterbenden Helden:
  Equips, Attachments und angelegte Helden in die ABLAGE,
  Creatures und Tokens BLEIBEN IM SPIEL, `immovable` bleibt liegen.

Diese Support-Aufraeumung macht `deleteHero` selbst, obwohl es dafuer
`handleHeroDeathCleanup` gibt: der sucht den Helden ueber
`heroes.findIndex(h => h === hero)` und findet ihn nicht mehr, sobald
sein Platz geleert ist.

Jede mitgenommene Karte bekommt einen AUSDRUECKLICHEN
`play_pile_transfer` — `actionMoveCard` allein sagt keinen Flug an,
und der Diff-Erkenner des Clients greift zu spaet, wenn der Held im
selben Zug verschwindet.

Unterschied zu „besiegt": ein gefallener Held steht weiter im Feld und
laesst sich wiederbeleben. „Geloescht" heisst mehr — nichts bleibt.

Wer nach Helden sucht, prueft ohnehin schon ueberall `hero?.name`; ein
leerer Platz ist damit ein bekannter Zustand. EINE Stelle musste
mitziehen: `checkAllHeroesDead` zaehlte fruehe „gibt es hier
ueberhaupt Helden?" ueber `some(h => h?.name)` und haette einen
Spieler, dessen Helden alle geloescht statt besiegt wurden, nie
verlieren lassen. Gezaehlt werden jetzt PLAETZE.

## Dauerhafte Kontrolle ueber einen HELDEN (v718, Als Ruling 4.9.)

> „Ein dauerhaft gestohlener Held zaehlt genau wie ein Held, den man
> von Anfang an beherrscht. Ist er der einzige verbleibende, zaehlt er
> trotzdem als vollwertiger lebender Held."

Primitive: `engine.actionTakeHeroPermanently(neuerPi, besitzerPi, heroIdx, opts)`.

Anders als eine Creature WANDERT ein Held nicht — drueben ist kein
Platz frei. Er bleibt in der Spalte seines urspruenglichen Besitzers
stehen und wechselt nur die Seite. Umgesetzt ueber die bestehende
Charme-Marke `charmedBy` (daran haengen Client, Server und saemtliche
Ziel- und Aktionssammler) plus den dauerhaften Stempel
`permaControlBy`, den `startTurn` nicht loescht, sondern neu setzt.
Der `charmed`-STATUS wird bewusst NICHT gefuehrt: er sperrt das
Ausruesten, und ein eigener Held ist ausruestbar.

Wer nach Seiten rechnet, fragt **nie** die Spalte, sondern:

```js
engine.heroSideOf(physOwner, hero)   // → kontrollierender Spieler
engine.heroesControlledBy(pi)        // → [{ physOwner, heroIdx, hero }]
```

Betroffen und bereits umgestellt:
* `checkAllHeroesDead` zaehlt DAUERHAFT kontrollierte Helden
  (`heroesControlledBy(pi, { permanentOnly: true })`), nicht die
  Spalte — und ausdruecklich NICHT die geliehenen: wer per Love Shot
  oder Charme voruebergehend den letzten gegnerischen Helden haelt,
  gewinnt dadurch nicht (Als Klarstellung 4.9.).
* `actionAoeHit` laeuft ueber beide Spalten und filtert nach Seite —
  „all enemy Heroes" trifft damit auch einen eigenen Helden, den der
  Gegner uebernommen hat (Als Beispiel: Flame Avalanche).
* Zielsammler und Aktionssammler tragen die Charme-Weiche laengst und
  gelten damit automatisch.

Jede NEUE Karte, die „Heroes you control" / „your opponent's Heroes"
auswertet, nimmt `heroSideOf` — eine Schleife ueber `players[pi].heroes`
ist ab v718 nur noch fuer PHYSISCHE Fragen richtig (Support Zones,
Spaltenrendering).

## Fenster „eine eigene Surprise wurde per Effekt abgelegt" (v730)

Opt-in `surpriseSurpriseDiscardedTrigger` (bool oder Filterfunktion mit
der ueblichen Signatur `(gs, ownerIdx, heroIdx, info, engine)`).

Geoeffnet aus `_fireBoardSentToDiscard`, also aus derselben Quelle, die
den `onBoardSentToDiscard`-Reiter der Aquatic-Serie speist — nur fuer
ZUSCHAUER statt fuer die abgelegte Karte. Damit sind automatisch
ausgeschlossen: Schadenstode, Handabwuerfe und die Selbst-Ablage einer
Surprise am Ende ihrer eigenen Aufloesung.

`info`: `{ zoneOwner, fromHeroIdx, zoneSlot, cardName, source,
sourceOwner }`. Die abgelegte Karte hat ihre Zone in diesem Moment
bereits verlassen und bietet sich deshalb nie selbst an; wer ganz
sicher gehen will, vergleicht zusaetzlich `info.cardName` und
`info.fromHeroIdx` mit dem eigenen Traeger (Water Golem tut das).

Der Ausloeser gehoert wie jeder getypte Ausloeser in die
Ausschlussliste von `_checkSurpriseWindow` — das ist bereits
geschehen, damit solche Karten nicht zusaetzlich im normalen
Ziel-Fenster auftauchen.

## „… but cannot be increased by other effects" — `ctx.preventIncrease()` (v742)

Ein Hook, der Schaden veraendert und ihn danach FESTNAGELN will
(Spirit of the Ultimate Gun: „doubled, but cannot be increased by
other effects"), ruft im `beforeDamage`-Hook:

```js
ctx.multiplyAmount(2);
ctx.preventIncrease();      // ab hier keine Erhoehungen mehr
```

Es MUSS der Helfer sein. Ein `ctx.cannotBeIncreased = true` landet nur
auf dem Wrapper, den der Hook sieht, nicht auf dem hookCtx — die
Klammer bliebe wirkungslos.

Der Helfer merkt sich die PROJEKTION (Basis × bisherige
Multiplikatoren + flat), nicht die Rohbasis: waehrend der Hook-Runde
steht in `hookCtx.amount` noch der Grundbetrag, die Multiplikatoren
liegen in `_mul`. Ausgewertet wird die Klammer entsprechend erst NACH
dem Zusammenrechnen — sonst haette sie die eigene Verdopplung
weggeklemmt.

Im Stapelpfad (`beforeCreatureDamageBatch`) gibt es keinen Wrapper:
dort `e.cannotBeIncreased = true; e._noIncreaseFrom = e.amount;`
direkt am Eintrag (dessen `amount`-Getter liefert bereits die
Projektion).

Die Klammer sperrt ab v743 SOFORT und umfassend: `modifyAmount` mit
positivem Delta und `multiplyAmount` mit Faktor > 1 laufen ins Leere,
sobald sie steht — nicht erst rueckwirkend nach der Hook-Runde. Damit
stapeln sich auch zwei Quellen derselben Karte nicht (zwei „Spirit of
the Ultimate Gun" verdoppeln einmal, nicht viermal), und ein
karteneigener „schon gemacht"-Merker eruebrigt sich — der taugte
ohnehin nicht, weil jeder Listener seinen eigenen ctx-Wrapper sieht.

`preventIncrease()` HEBT eine bestehende Obergrenze nie an: steht
schon eine, bleibt die niedrigere.

Einseitig, wie der Text: Reduktionen (Tempeste, Schilde, Cloudy)
wirken weiter.

## „Seit Zugbeginn ein gegnerisches Ziel besiegt" (v744)

`ps._defeatedOppTargetTurn === gs.turn` — gesetzt an der einen Stelle,
durch die jeder Tod laeuft (`runHooks`, ON_CREATURE_DEATH und
ON_HERO_KO), fuer die Seite der QUELLE, sofern das Opfer der anderen
Seite gehoerte. Gegenstueck zum vorhandenen
`_lastCreatureDefeatedTurn` (eigene Gefallene).

Solche Stempel gehoeren in die ENGINE, nicht in die Karte, die sie
liest: eine Karte, die erst NACH dem Ereignis auf die Hand kommt
(Coreling), kann es nicht beobachtet haben, muss es aber trotzdem
sehen. Faustregel: was der Kartentext als Tatsache des Spielstands
formuliert („if you have … since the beginning of this turn"), wird
zentral gestempelt.

## Mehrfach-Picker: Summen- und Namensschranke (v750)

Zwei neue Optionen fuer `promptEffectTarget`, live im Client geprueft:

* `uniqueBy: 'cardName'` — ein zweites Ziel mit demselben Wert in
  diesem Feld laesst sich nicht anklicken („Creatures with different
  names").
* `maxBudget: <zahl>` zusammen mit `budgetCost` an JEDEM Ziel — die
  Summe der Kosten darf die Schranke nicht ueberschreiten („whose
  combined levels do not exceed 4").

Beides ersetzt die Unart, mehrere Ziele ueber HINTEREINANDER geoeffnete
Picker zu waehlen: das las sich wie getrennte Entscheidungen und machte
den Abbruchknopf mehrdeutig. EIN Picker, `maxTotal` fuer die Anzahl,
„✓ Done" bestaetigt auch eine Teilauswahl, Cancel/Escape bricht den
ganzen Effekt ab.

Der Client ist dabei nur die Bequemlichkeit — die Karte rechnet die
Auswahl serverseitig nach und verwirft, was die Schranken verletzt.

⚠ Die Prompt-Konfiguration in `promptEffectTarget` ist eine WEISSE
LISTE: was dort nicht ausdruecklich uebernommen wird, erreicht den
Client nie. Wer eine neue Option einbaut, muss sie an BEIDEN Stellen
eintragen — Client-Regel UND Weiterreichung. In v750 fehlte die
Weiterreichung, die Regel war eingebaut und wirkungslos.

## `onAttackDeclare`: Boni werden zusammengerechnet (v760)

Das Fenster gab bis v760 den ROHWERT zurueck. `ctx.modifyAmount` und
`ctx.multiplyAmount` schreiben aber in die Sammler `_flat`/`_mul`, und
das Zusammenrechnen (`_projectedAmount`) gab es dort nicht — JEDER
Bonus, den ein Zuhoerer hier auflegte, verfiel stillschweigend.
Betroffen waren Shattered Trident, Angler Angel und Great Detective
Doq auf diesem Weg (Als Befund 5.9.).

`_fireAttackDeclare` projiziert jetzt vor der Rueckgabe. Fuer Karten
aendert sich nichts an der Schreibweise — `ctx.modifyAmount(bonus)`
wirkt hier ab sofort so wie im Schadenspfad.

## Zweistufiger Kreatureffekt — `prepareCreatureEffect` (v749)

Damit mehrere Kreatureffekte ECHT GLEICHZEITIG aufloesen koennen
(Spirit of the Forbidden Grimoire: „both effects are performed at the
same time"), darf ein Kreaturenskript seine Zielwahl von seiner
Wirkung trennen:

```js
module.exports = {
  // Stufe 1: NUR fragen. Nichts am Spielstand aendern.
  async prepareCreatureEffect(ctx) {
    const target = await ctx.promptDamageTarget({ … });
    return target ? { target } : null;      // null = Abbruch
  },

  // Stufe 2: wirken. Liegt ein Plan an, NICHT noch einmal fragen.
  async onCreatureEffect(ctx) {
    const target = ctx.plan?.target || await ctx.promptDamageTarget({ … });
    …
  },
};
```

Der Plan ist ein beliebiges Objekt und nur fuer die Karte selbst
verstaendlich; die Engine reicht ihn unveraendert durch.

Aufrufseite: `engine.prepareCreatureEffectFor(inst, pi, opts)` →
`{ ok, plan }`, danach `engine.reactivateCreatureEffect(inst, pi,
{ plan })`. Wer zwei Effekte gleichzeitig will, sammelt ERST alle
Plaene und wirkt DANN alle.

Der Vertrag ist OPTIONAL. Karten ohne `prepareCreatureEffect` laufen
wie bisher — sie fragen ihr Ziel erst beim Wirken. Der Grimoire
mischt beides sauber: vorbereitete Effekte haben ihre Ziele bereits,
die uebrigen holen sie im Wirkschritt nach.

Bisher umgestellt: `cannon-tower.js` (Vorlage zum Abschauen). Jede
weitere Kreatur mit Zielwahl kann in wenigen Zeilen folgen — der
Regelfall ist genau die Aufteilung oben.

## Effekt fuer den Rest des Zuges sperren — `_effectLockedTurn` (v748)

`inst.counters._effectLockedTurn = gs.turn` sperrt den AKTIVEN Effekt
dieser Kreatur haerter als die normale Rundensperre: geprueft wird sie
im Server-Aktivierungspfad UND in `reactivateCreatureEffect`. Damit
greift sie auch fuer geschenkte Wiederholungen (Kohta) und fuer ein
zweites Ausleihen — „cannot be used another time for the rest of the
turn IN ANY WAY" (Spirit of the Forbidden Grimoire).

Wer eine Wiederholung anstoesst, setzt seine eigene Rundensperre VOR
dem Lauf, nicht danach: die Wiederholung kann selbst wieder toeten und
oeffnet an ihrem Ende erneut `afterCreatureEffect`. Eine erst danach
gesetzte Sperre sieht die verschachtelte Runde nicht — das lief bis
zum Hook-Deckel bei 10 000 durch (v753). Steigt das Skript aus, wird
die Sperre wieder zurueckgegeben.

Die harte Sperre `_effectLockedTurn` setzt man dagegen NACH dem
Gebrauch: sie bedeutet „ab jetzt nicht mehr", und vorher gesetzt
haette sie Beobachter blind gemacht, die WAEHREND des Blocks
reagieren.

Wer AUF Effekte reagiert und sie wiederholen will (Kohta), muss die
Sperre in seiner EIGNUNG pruefen, nicht erst beim Ausfuehren: sonst
kommt eine Rueckfrage, deren Zusage ins Leere laeuft und bei der der
Spieler nichts passieren sieht.

Wer die Sperre selbst setzt und den Effekt danach noch EINMAL laufen
lassen will, ruft `reactivateCreatureEffect(inst, pi,
{ ignoreEffectLock: true })`. Zusaetzlich sollte er die normale
Rundensperre `creature-effect:<instId>` mitstempeln, damit der Client
die Kreatur ausgraut.

## Welcher AKTIVE Kreatureffekt laeuft gerade? (v740)

`engine._activeCreatureEffect` → `{ instId, cardName, owner }` oder
undefined. Gesetzt von `doActivateCreatureEffect` (server.js) und von
`engine.reactivateCreatureEffect`, jeweils um den Aufruf von
`onCreatureEffect` herum.

**Nicht** `_currentEffectSource` dafuer benutzen: `runHooks`
ueberschreibt das je Zuhoerer mit dessen EIGENER Karte, ein Hook saehe
dort also immer sich selbst statt des Ausloesers. Genau daran ist die
erste Fassung von Kohta gescheitert.

Das Fenster `afterCreatureEffect` feuert nach JEDER abgeschlossenen
Aufloesung eines aktiven Kreatureffekts — auch nach einer geschenkten
(Kohta) oder geliehenen (Grimoire). Sonst saehe ein Beobachter Kills
nicht, die ein geliehener Effekt gemacht hat (Als Befund 5.9.).

Dazu passt das Fenster `afterCreatureEffect`
(`{ creature, cardName, activator, heroIdx, zoneSlot }`), das der
Server nach einer erfolgreichen Aufloesung oeffnet. Reaktionen auf den
VERLAUF eines Kreatureffekts gehoeren dorthin — waehrend er laeuft,
waere jeder Eingriff ein Aufbrechen einer offenen Aufloesung. Muster
(Kohta): im Todes-Hook nur MERKEN, im Fenster handeln.

`engine.reactivateCreatureEffect(inst, pi)` wiederholt einen
Aktiveffekt: dieselbe Kern-Aufloesung wie regulaer (Kontext,
Prompt-Stapel, Quelle, Auftritt, Bleed-Nachlauf), aber ohne
Kostenpruefung, ohne Aktion und ohne HOPT-Stempel — eine geschenkte
Wiederholung, kein zweiter Einsatz. Das Skript sieht `ctx._isRetrigger`.
Rueckgabe: `true`, wenn der Effekt durchlief; `false`, wenn das Skript
selbst ausgestiegen ist. Wer eine Sperre daran haengt, prueft das.

### Erzwungene Aufloesung — `_forceNonCancellable` (v741)

Waehrend der Wiederholung setzt die Engine einen Zaehler, den
`promptGeneric` und `promptEffectTarget` lesen: jeder Prompt verliert
seinen Abbruchknopf (`cancellable: false`, `cancelLabel` entfaellt).
Die WAHL bleibt — welches Ziel, welcher Modus —, nur das Aussteigen
faellt weg.

Grund (Als Vorgabe 5.9.): wer eine geschenkte Wiederholung zusagt,
soll den Effekt nicht mittendrin doch noch abwuergen koennen; sonst
waeren Auftritt und Rundensperre des Gebers schon verbraucht. Der
Zaehler ist verschachtelungsfest und wird im `finally` zurueckgesetzt.

Wer denselben Riegel fuer einen anderen erzwungenen Ablauf braucht,
hebt und senkt ihn genauso — nie als Flagge setzen, immer als Zaehler.

## Auftritt erst, wenn der Effekt WIRKLICH laeuft (v736 — MANDATORY)

(Zeitpunkt-Teil der ★-Grundregel „JEDER GETRIGGERTE PASSIVE EFFEKT ZEIGT
SEINE KARTE BEIDEN SPIELERN" ganz oben in dieser Datei.)

> Als Regel 5.9.: „Auftritt immer nur, wenn ein Effekt wirklich
> durchlaeuft und NICHT mehr gecancelt werden kann."

`showTriggeredEffect` (und jedes andere Einblenden des Kartenbilds,
`card_reveal`, Auftritts-Animationen, Klaenge) gehoert HINTER die
letzte Stelle, an der der Spieler noch abbrechen kann — nicht davor.

Falsch:

```js
await engine.showTriggeredEffect(CARD_NAME);      // ← zu frueh
const wahl = await engine.promptGeneric(pi, { …, cancellable: true });
if (!wahl || wahl.cancelled) return;              // Auftritt lief umsonst
```

Richtig:

```js
const wahl = await engine.promptGeneric(pi, { …, cancellable: true });
if (!wahl || wahl.cancelled) return;              // spurlos
await engine.showTriggeredEffect(CARD_NAME);      // ← jetzt
… Wirkung …
```

Dasselbe gilt fuer alles andere, was ein Abbruch nicht anfassen darf:
Rundensperren (`claimHOPT`), Einmal-pro-Spiel-Marken, Kosten,
Zugstempel. Faustregel: nach einem Abbruch muss der Spielstand
aussehen, als haette die Karte nie angesetzt — auch das Angebot
selbst darf im selben Zug erneut kommen.

Kosten, die der Text VOR die Wirkung stellt („discard a card to …",
„send an Artifact … to play this card"), sind die Ausnahme: sie
werden bezahlt, und ab da ist die Karte gespielt. Dann ist genau
dieser Punkt die letzte Abbruchstelle, und der Auftritt folgt
unmittelbar danach.

## „Counts as an additional Action" — IMMER `inherentAction` (v733 — MANDATORY)

Sagt ein Kartentext „this counts as an additional Action" / „summoning
this counts as an additional Action", gehoert an das Skript:

```js
module.exports = {
  inherentAction: true,   // oder (gs, pi, heroIdx, engine, opts) => bool
  …
};
```

Das ist der EINE Vertrag dafuer (v601, `cardHasInherentAction`). Er
wird VOR dem Spielen gelesen und ist deshalb die einzige Stelle, die
die Karte auch in der MAIN PHASE und bei bereits verbrauchtem
Zug-Slot spielbar macht. Server-Freigabe, Client-Ausgrauung und
Phasenlogik haengen alle daran.

`gs._spellFreeAction` ist NICHT der Ersatz dafuer und war v732 genau
dieser Fehler (Als Befund 4.9.: „Refreshing Night laesst sich nicht in
der Main Phase spielen"). Das Flag wirkt erst NACH der Aufloesung und
gibt lediglich eine bereits verbrauchte Zusatzaktion zurueck. Es
gehoert ausschliesslich in den Fall, dass eine Karte WAEHREND ihrer
Aufloesung entscheidet, doch keine Aktion zu kosten (Cool Rescue,
Fire Bolts).

Der heldenseitige Zwilling ist
`grantsInherentActionForCard(gs, pi, heroIdx, cardData, engine)`
(Baaliel) — ebenfalls von `cardHasInherentAction` gelesen.

## Tutor-Spezifikation — `searchSpec` (v734)

Jeder Aufruf von `actionAddCardFromDeckToHand` darf mitgeben, WAS die
Karte suchen durfte:

```js
await engine.actionAddCardFromDeckToHand(pi, gewaehlt, {
  source: CARD_NAME, reveal: true,
  searchSpec: { label: 'Creature', filter: (cd) => isPileCreature(cd) },
  // uneingeschraenkt:  { label: 'card', filter: null }
});
```

Gelesen von Karten, die eine Suche VERDOPPELN („an additional card
with … the same specifications" — Koperniko, the Stargazer). Die
Engine fuehrt dazu je Quelle eine Strichliste (`engine._deckAddTally`,
bewusst NICHT auf `gs`, weil `filter` eine Funktion ist); ausgewertet
wird sie in `afterSpellResolved` / `afterArtifactUsed`, wo feststeht,
ob es bei EINER Karte geblieben ist.

Fehlt `searchSpec`, faellt der Leser auf die Kartenart der geholten
Karte zurueck — nie grosszuegiger als das Original. JEDER neue Tutor
gibt die Spec trotzdem mit.

Deklariert (Sweep 5.9., alle Einzel-Tutoren unter Spell/Attack/
Artifact): Angry/Cool/Cute/Holy/Nerdy/Sickly Cheese, Cuteness Sensor,
Magnetic Glove, Magnetic Potion, Brilliant Idea, Idol of Crestina,
Rain Viola, Graveyard Gathering, Gate to the Armory, Blueprints,
Misfire.

MEHRFACH-Tutoren (Divine Gift of Creation, Future Tech Database,
Spider Dance, Trial of Loyalty …) brauchen KEINE Spec: die
Strichliste zaehlt zwei oder mehr Namen, und ein Verdoppler mit der
Klausel „exactly 1 card" greift dort gar nicht erst.

Namensgebundene Tutoren („a copy of it", „a Spell with the same
name") melden `filter: (cd, n) => n === name`. Zusammen mit der
Klausel „different name" bleibt dann korrekt nichts uebrig.

Karten, die ihren Zugriff aus historischen Gruenden VON HAND buchen,
rufen `engine.noteDeckTutor(pi, cardName, source, spec)` zusaetzlich —
sonst sind sie fuer Verdoppler unsichtbar. Besser ist der kanonische
Helfer; Graveyard Gathering wurde bei diesem Sweep darauf umgestellt.

## Abwurf-Kosten: kein Ja/Nein-Vorspann (v718, Als Vorgabe 4.9. — STANDARD)

> „Gehe einfach direkt in Force Discard und gib dem Spieler per Escape
> oder einem Cancel-Button ein Opt-Out, das den Effekt abbricht und
> nicht konsumiert."

Fuer JEDEN Effekt, dessen Kosten ein Handabwurf sind:

```js
const handVorher = (ps.hand || []).length;
await engine.actionPromptForceDiscard(pi, 1, {
  title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
  cancellable: true,                      // ← Escape/Cancel erlaubt
  description: 'Discard 1 card to …',
});
if ((ps.hand || []).length === handVorher) return false;   // abgebrochen
```

* KEIN vorgeschaltetes „Discard? Yes/No" — die Abwurf-Auswahl IST die
  Frage, ihr Cancel ist das Nein.
* Der Rueckgabewert `false` heisst „nicht verbraucht": kein HOPT-
  Stempel, keine Aktion, keine Kosten.
* Hat der Spieler dagegen eine echte WAHL zwischen mehreren Effekten,
  ist das Optionsmenue richtig — und die Abwurf-Auswahl folgt direkt
  darauf, ohne Zwischenschritt.

## Vor-Niederlage-Fenster gegen INSTA-KILLS — `firesOnDefeat` (v718)

Al 4.9.: dass „would be defeated"-Reaktionen gegen Eraser Beam und
Hand of Death stumm blieben, war ein BUG. `actionDefeatHero` — der
einzige Weg fuer Heldentode ohne Schaden — oeffnet deshalb jetzt
`_checkPreDamageHandReactions` mit `type: 'defeat'`, `instaKill: true`
und dem synthetischen Betrag „aktuelle HP".

Angeboten werden dort NUR Skripte mit `firesOnDefeat: true`. Das Flag
gehoert an jede Reaktion, deren Text „would be defeated" sagt und die
den Tod ERSETZEN kann (Escape, Paraseed Zombie; kuenftig Emergency
Spell Armor, Last Second Escape, Cheat Chair). Reine Schadensminderer
(Spectral Armor „halve that damage", Cloud in a Bottle, Strong Shield)
tragen es NICHT — sie haetten an einem Insta-Kill nichts zu halbieren
und wuerden fuer nichts verbraucht.

Ein `{ negated: true }` aus `preDamageResolve` bricht die Niederlage
ab; die Karte darf die HP dabei selbst setzen (Paraseed Zombie: „that
Hero's HP drop to 1 instead"). Ein Selbstopfer (`opts.isSacrifice`)
oeffnet kein Fenster.

## Zustandsgebundene Status — `noAbsorb` (v718)

Ein Status, den eine Karte auf dem Brett dauerhaft AUFRECHT haelt
(Paraseeds Gift: „While this Creature is in a Hero's Support Zone,
that Hero is Poisoned"), laesst sich nicht wegfangen — er liegt im
naechsten Abgleich sofort wieder auf. Abfang-Effekte dafuer eine
Ladung verbrennen zu lassen waere reine Verschwendung (Als Ruling
4.9.). Solche Status werden mit `noAbsorb: true` aufgelegt;
`resistance.js` (und jeder kuenftige Abfaenger) uebergeht sie.

## Aufstieg aus dem Tod heraus — `ascendsFromDefeat` (v718)

`performAscension` weist einen Helden mit `hp <= 0` normalerweise ab.
Eine Ascended-Karte, deren gedruckte Bedingung GENAU der Tod der
Grundform ist, erklaert das mit `ascendsFromDefeat: true` auf ihrem
Skript. Sie MUSS dann selbst HP setzen (`onAscensionBonus`), sonst
steigt eine Leiche auf und faellt sofort wieder um. Erster Nutzer:
`"Bloom", the Continent Corruptor`.

## Eine Karte liegt AUF einer anderen — Zone `nested` (v774)

> „Monster Nest": *„…place it on top of this card. […] the new Creature
> replaces this one until the end of the turn. At the end of your turn,
> remove any Creature placed on top of this one and delete it. This
> doesn't count as the Creature being defeated."*

**Nicht zu verwechseln mit der Anhaengsel-Familie.** Goff/Gon,
Clausss/Klaus, Smugbeth, Stellin, Wolflesia, Antonia und Vullary legen
einen HELDEN UNTER eine Kreatur (`actionAttachHeroToCreature`); dort
bleibt die Kreatur die Kreatur des Platzes und der Held ist ein
Counter. Hier ist es umgekehrt: eine KREATUR kommt oben drauf und
ERSETZT die untere.

**Als Rulings (5.9.):** die verdeckte Karte ist KOMPLETT vom Brett —
nicht zielbar, zaehlt nicht als kontrollierte Kreatur. Stirbt die
obenliegende Kreatur noch in derselben Runde, ist die verdeckte Karte
SOFORT wieder normal da. Darstellung wie Copy Device / Performance.

### Das Modell

Verdecken heisst NICHT „zwei Namen in einem Support-Platz". Der Platz
ist zwar ein Array, aber alle rund 131 Leser fragen `slot[0]` nach dem
Namen — ein zweiter Eintrag dort haette an jeder dieser Stellen
mitgedacht werden muessen. Stattdessen:

* Der Name der verdeckten Karte **verlaesst den Platz**. Danach steht
  dort ausschliesslich die obenliegende Kreatur, und jede bestehende
  Stelle liest automatisch die richtige Karte.
* Die **Instanz** bleibt bestehen und wandert in die Zone
  `ZONES.NESTED` (`'nested'`). Damit ist sie fuer jede Brettabfrage
  weg — HP, Counter, Status, `turnPlayed` und die Instanz-ID bleiben
  unveraendert erhalten. `heroIdx` / `zoneSlot` merken sich den Platz.

**Warum eine eigene Zone und kein Verdeckt-Flag** (dieselbe Ueberlegung
wie bei `CREATION` fuer Crestina): 274 Stellen in 192 Kartenskripten
zaehlen Kreaturen ueber `cardInstances` mit `zone === 'support'`. Ein
Flag haette jede davon einzeln nachziehen muessen. Nachgemessen (5.9.):
JEDE Slot→Instanz-Suche in Engine, Server und CPU filtert vorher auf
die Zone, es gibt also keine Stelle, die eine verdeckte Instanz doch
noch findet. `creatureCounters` und `buildSupportStacks` sieben sie
ebenfalls schon von selbst aus.

### `_nest-shared.js`

Die Mechanik ist generisch und liegt vollstaendig im Modul; die Karte
sagt nur, WANN:

| Funktion | Tut |
|---|---|
| `sink(engine, nestInst)` | Name raus aus dem Platz, Instanz nach `nested`. Gibt den freigewordenen Platzindex zurueck. |
| `surface(engine, nestInst, opts)` | Zurueck auf den gemerkten Platz. Ist der belegt, ein freier Platz DESSELBEN Helden; gibt es keinen, geht die Karte in die Ablage (`nest_surface_failed`), damit keine Instanz in der Zwischenzone haengenbleibt. |
| `reconcile(engine, nestInst)` | „Liegt noch etwas oben?" — idempotenter Zustands-Abgleich, holt die Karte hoch, sobald nichts mehr auf ihr liegt. |
| `coveringInstance(engine, nestInst)` | Die Kreatur, die gerade oben liegt — ueber die Instanz-ID, nicht ueber den Platz. Liegt dort inzwischen etwas ANDERES, ist das ausdruecklich keine Karte „placed on top of this one". |
| `deleteWithoutDefeat(engine, inst, opts)` | Brett → Deleted Pile OHNE Todespfad: keine `onCreatureDeath`-Listener, kein Kadaver-Anspruch, keine on-kill-Effekte. Nur `onCardLeaveZone` fuer die Karte selbst plus das Pflicht-Rettungsfenster `_tryBeforeDelete`. Loggt bewusst NICHT selbst — der Aufrufer kennt den Anlass und nimmt einen Typ, fuer den es einen Renderer gibt. |

### Pflichten einer Karte dieser Bauform

* **`activeIn: ['support', ZONES.NESTED]`.** Ohne den zweiten Eintrag
  verwirft `CardInstance.isActiveIn` alle Hooks der verdeckten Instanz
  — das Aufraeumen am Zugende liefe nie und die gelegte Kreatur bliebe
  fuer immer liegen.
* **Zwei Auftauch-Wege anmelden.** `onCreatureDeath` fuer den
  Normalfall und `afterCreatureDamageBatch` als Netz darunter
  (dieselbe Lehre wie beim Paraseed-Kadaver, v718: nicht jeder Weg vom
  Brett feuert dieselben Hooks). Beide rufen nur `reconcile`, der ist
  idempotent.
* **`summonCreatureWithHooks`, nicht `actionPlaceCreature`,** wenn der
  Text „counts as that Creature being summoned" sagt: nur so feuern
  onPlay / onCardEnterZone, zaehlt `_creaturesSummonedThisTurn` hoch,
  wird `turnPlayed` gestempelt und gelten die eigenen
  Beschwoerungsbedingungen der gelegten Kreatur (`canSummon`,
  `beforeSummon`-Tribute).
* **Erst `sink`, dann beschwoeren.** `safePlaceInSupport` verlangt
  einen freien Platz; ein noch besetzter wuerde die Kreatur woanders
  hin verschieben. Schlaegt die Beschwoerung fehl, muss die Karte
  vollstaendig zuruecknehmen (`surface({ silent: true })` + Karte
  zurueck ins Deck) — der Effekt gilt dann als nicht benutzt.

### Was ausdruecklich NICHT feuert

Weder `onCardLeaveZone` beim Verdecken noch `onCardEnterZone` beim
Auftauchen (Als Auslegung 5.9., bestaetigt). Der Kartentext beschreibt
eine ERSETZUNG, keine Entfernung mit spaeterer Rueckkehr: die verdeckte
Karte wird nicht neu beschworen, und ein Eintritts-Fenster (v699)
wuerde beim Auftauchen Beobachter auf eine Karte hetzen, die die ganze
Zeit da war.

### Darstellung

`AttachableCreatureCard` hat dafuer die Variante `nestedUnder` —
dieselbe Hover-Flip-Bauform wie `attachedHero` / `mimicCreature`, mit
Abzeichen 🪺. Ungehovert steht die obenliegende Kreatur da (das ist der
Spielzustand), beim Hovern kommt die verdeckte Karte zum Vorschein.
Gespeist wird sie aus `counters._nestedUnder` auf der OBENLIEGENDEN
Instanz, das ueber `creatureCounters` ohnehin schon beim Client
ankommt. Der Zweig steht VOR der Mimik-Pruefung: die Verdeckung ist die
wichtigere Information, sie verschwindet am Zugende.

### Der Platz wird NIE leer (v776, Als Vorgabe 5.9.)

> „Die ganze Idee ist, dass Monster Nest aus Perspektive des Spielers
> nie die Zone verlaesst und die andere Creature nur darueber kommt."

Der erste Anlauf (v775) hat den Aufdeck-ZEITPUNKT verschoben — Nest
zurueck in den Platz zwischen Splice und Flug. Das reichte nicht, aus
zwei Gruenden:

1. **Der Client versteckt den Quell-Slot.** `onPileTransfer` setzt fuer
   `from === 'support'` 720 ms lang `data-bounce-hiding` auf den Platz,
   und das CSS blendet ALLE Kinder aus. Die Sicherung war dafuer
   gedacht, ein Doppelbild der abfliegenden Karte zu verhindern, und
   ging davon aus, dass der Platz danach ohnehin leer ist. Mit einer
   verdeckten Karte darunter stimmt das nicht mehr — sie wurde
   mitversteckt. **Der Schluessel traegt jetzt den Namen der
   abfliegenden Karte** (`owner-hero-slot::cardName`); zeigt der Platz
   inzwischen etwas anderes, bleibt es sichtbar.
2. **Jede Reihenfolge hat ein Dazwischen.** Solange der Name den Platz
   verlaesst und spaeter zurueckkehrt, gibt es einen Zustand ohne ihn —
   und irgendein Pfad zeigt den irgendwann. Deshalb bleibt er jetzt
   einfach liegen.

**Das Modell seit v776:** `sink` nimmt den Namen NICHT mehr aus dem
Platz, sondern dreht nur die Zone der Instanz auf `nested`. Die
darueberkommende Karte wird per `safePlaceInSupport(..., { coverNested:
true })` mit `unshift` VORNE eingefuegt:

    supportZones[hi][slot] = ['<gelegte Kreatur>', 'Monster Nest']

`slot[0]` ist und bleibt die Karte, die den Platz definiert — alle rund
131 `slot[0]`-Leser lesen weiterhin die richtige. Geht die obere Karte
weg, streicht der ganz normale Splice (`indexOf(name)`) ihren Namen und
uebrig bleibt `['Monster Nest']`. `surface` hat dann nichts mehr
einzusetzen und dreht nur die Zone zurueck.

`coverNested` ist AUSDRUECKLICH opt-in und prueft zusaetzlich, dass der
Platz ausschliesslich Namen verdeckter Instanzen traegt — ein fremder
Beschwoerungseffekt kann hier nicht hineinrutschen.

Der Ausnahmezweig in `surface` (gemerkter Platz belegt → freier Platz
desselben Helden → Ablage) bleibt fuer den Fall, dass ein fremder Effekt
den Platz doch geleert hat.

### Darstellung: zwei Ebenen (v776)

Der Renderzweig zeichnet das Nest als **Grundschicht** und die gelegte
Kreatur in `.nest-cover-layer` (absolut, `z-index: 2`) darueber. Nicht
aus optischen Gruenden — die obere Karte deckt die untere ohnehin ganz
ab — sondern fuer den Bestand: geht die obere weg, steht die untere
schon da, ohne dass ein Render-Wechsel dazwischen eine Luecke reissen
kann. Der Hover-Tausch auf der oberen Karte (`nestedUnder`, 🪺) bleibt
zusaetzlich erhalten.

### Der Verdeckungs-Platz ist KEIN geteilter Platz (v777)

Ein Platz mit einer verdeckten Karte darunter traegt zwei Namen. Der
Brett-Renderer hatte dafuer schon eine Schranke — `cards.length === 1`
entscheidet, ob der reiche Kreaturzweig laeuft oder der ALICE-Zweig
(`board-stack`), der `cards[cards.length-1]` mit einem Stueckzahl-
Abzeichen zeichnet. Ein Nest-Platz fiel dort hinein und zeigte prompt
das NEST mit einer „2" statt der Kreatur darauf.

Die Schranke lautet jetzt `cards.length === 1 || cc?._nestedUnder`.
Dazu gibt es im Kreaturzweig `_slotTopName` — „welcher Name BESTIMMT
diesen Platz": normal der letzte (Ausruestungsstapel; Alice-Kopien
tragen ohnehin denselben Namen), bei einer Verdeckung der ERSTE. Jede
kuenftige Auswertung im Kreaturzweig liest den, nicht
`cards[cards.length-1]`.

**Merksatz fuer die naechste Karte dieser Bauform:** ein zweiter Name
im Platz laeuft im Client per Vorgabe als Alice-Stapel. Wer verdeckt,
muss diese Schranke mitnehmen.

### Die Richtung der Ebenen (v777)

Die verdeckte Karte ist die absolut positionierte GRUNDSCHICHT
(`.nest-base-layer`, mit denselben Flex-Regeln zentriert wie der Platz
selbst); die obenliegende Kreatur bleibt gewoehnlicher Inhalt des
Platzes. Umgekehrt — Kreatur in einer Deckschicht — saesse sie an der
oberen linken Ecke statt mittig, weil der Platz 68x95 misst und die
Karte 64x90.

### Wanderung vom Deck in die Zone (v776)

`resolveZone` in `onCardTransfer` kennt jetzt `sourceZoneKind: 'deck'`
und loest auf `[data-my-deck]` / `[data-opp-deck]` auf. Damit fliegt
eine aus dem Deck gelegte Karte sichtbar zum Platz, statt dort einfach
zu erscheinen. Der Flug laeuft VOR `sink` und vor der Beschwoerung —
in dieser Zeit ist das Nest noch eine ganz normale Karte im Platz (samt
richtiger HP-Anzeige) und die Kreatur wandert sichtbar darauf zu.
`play_card_transfer` bringt seinen Klang mit, es entsteht keine neue
Animation.

### Nebenwirkung, die richtig ist

Geht die obenliegende Kreatur WEG statt zu sterben (Bounce, Umzug,
dauerhafter Kontrollwechsel), wird der Platz frei und die verdeckte
Karte taucht auf — und sie wird am Zugende folgerichtig NICHT
geloescht, denn sie liegt dann nicht mehr „on top of this one".

## Ability-Stufe eines Helden — `heroAbilityLevel` (v778)

```js
const { heroAbilityLevel, heroFightingLevel } = require('./_hooks');

heroAbilityLevel(engine, pi, heroIdx, 'Fighting')   // Stufe, 0 = nicht vorhanden
heroFightingLevel(engine, pi, heroIdx)              // Kuerzel dafuer
```

Nimmt die HOECHSTE Stufe ueber alle Kandidaten-Zonensaetze des Helden
(`_getCandidateAbilityZoneSets`) — ein Held kann mehrere haben, etwa
waehrend eines Formwechsels.

Die Funktion lag bis v778 in `_bleed-shared.js`, weil sie fuer Doctor
Fester gebaut wurde; mit Bleed hat sie nichts zu tun. `_bleed-shared`
reicht `heroFightingLevel` weiter, bestehende Aufrufer bleiben gueltig.

## `afterSpellResolved` — wessen Held? `heroOwner` (v778)

Der Vertrag fuehrt jetzt `heroOwner`: in WESSEN Heldenreihe `heroIdx`
zeigt. Ohne das Feld war der Hook bei einem bezauberten Helden
mehrdeutig — `casterIdx` ist dann der Gegner, `heroIdx` aber ein Index
in die Reihe des BESITZERS, und ein Lauscher konnte „mein Held hat
angegriffen" nicht von „der gleichindizierte Held der Gegenseite hat
angegriffen" unterscheiden. Beide Aufrufstellen (server.js und
`_castSpellImmediately`) liefern es.

**Und die Falle daneben, im Repro aufgefallen (5.9.):** `ctx.cardOwner`
meldet den KONTROLLEUR. Bei einem bezauberten Helden steht dort der
Gegner — `players[ctx.cardOwner].heroes[heroIdx]` traefe dessen
gleichindizierten Helden statt des eigenen. Die Heldenreihe, in der die
Karte steckt, sagt `ctx.card.owner`; der wechselt nie. Jede Karte, die
von ihrem eigenen Helden AUS auf dessen Heldenobjekt zugreift, nimmt
`ctx.card.owner`, nicht `ctx.cardOwner`.

## „Der Angriff hat AUFGELOEST" — `afterSpellResolved` statt `onAnyActionResolved` (v778)

Beide feuern nach einem Angriff, aber nur `afterSpellResolved` ist
schon auf „nicht negiert" gefiltert: Server und `_castSpellImmediately`
rufen ihn ausschliesslich im `!gs._spellNegatedByEffect`-Zweig, und die
Marke ist zum Zeitpunkt von `onAnyActionResolved` bereits geloescht.
Der Hook heisst „Spell", laeuft aber ausdruecklich auch fuer Attacks —
sie gehen durch denselben Pfad. Ein abgebrochener Guss
(`_spellCancelled`) kommt gar nicht erst so weit.

Wer also „nachdem dieser Held einen Angriff ausgefuehrt hat" braucht
und negierte Angriffe ausnehmen will, haengt sich dorthin (Gobbo,
Chief of Goblin ist der erste Fall).

## HP senken, ohne zu heilen — die Reihenfolge (v778)

`decreaseMaxHp` hebt die aktuellen HP auf mindestens 1 an. Wer beides
senkt („reduce this Hero's current and max HP by N"), muss deshalb
ERST die Max-HP senken und DANN die aktuellen setzen — andersherum
holt der Helfer einen gerade auf 0 gebrachten Helden wieder zurueck
(dieselbe Falle wie beim Paraseed-Gifttick, v718):

```js
const hpVorher = hero.hp;
engine.decreaseMaxHp(hero, verlust);            // Boden: Max HP 1
const zielHp = hpVorher - verlust;              // darf rechnerisch <= 0 sein
hero.hp = Math.max(1, Math.min(zielHp, hero.maxHp));
if (zielHp <= 0) await engine.actionDefeatHero(ctx.card, hero, { reason: CARD_NAME });
```

`actionDefeatHero` verlangt HP > 0, um ueberhaupt anzulaufen — deshalb
steht der Held eine Zeile vorher vorlaeufig auf 1, ohne dass ein
Zustandsversand dazwischen liegt. Er oeffnet das Vor-Niederlage-Fenster
(Escape & Co., v718) und faehrt danach den vollen Todesablauf.

## Zielwahl, die einen ZWEITEN Schritt voraussetzt (v780)

„Overcharge": *„Choose an Artifact equipped to a Hero you control and
send it to the discard pile. Then, choose an equippable Artifact with a
Cost between 1 and 10 Gold higher than the discarded one from your deck
…"*

Als Vorgabe (5.9.): waehlbar sind **nur** Ausruestungen, fuer die es im
Deck tatsaechlich eine Aufwertung gibt. Ein Equip ohne Nachfolger steht
gar nicht erst zur Wahl — sonst wirft man seine Ausruestung weg und
bekommt nichts zurueck.

**Das Muster dahinter** (gilt fuer jede Karte mit „waehle A, dann waehle
B abhaengig von A"):

1. Die Kandidatenliste fuer Schritt 2 wird **je moeglichem Ziel aus
   Schritt 1 vorab berechnet**. Bleibt sie leer, faellt das Ziel aus.
   Schritt 1 darf bei genau einem Ziel uebersprungen werden — Schritt 2
   nie, siehe „Der Zusagepunkt" weiter unten.
2. Dieselbe Pruefung sitzt zusaetzlich als `spellPlayCondition` — ohne
   ein einziges taugliches Paar ist die Karte ausgegraut. Das ist die
   bereits dokumentierte Lehre „Gate on what the actor can actually
   touch"; der Filter im Prompt allein liesse die Karte spielbar
   aussehen und dann mit leerer Auswahl dastehen.
3. **Erst fragen, dann verbrauchen.** Overcharge legt die alte
   Ausruestung ERST ab, nachdem die neue gewaehlt ist — bricht der
   Spieler in der Galerie ab, ist noch nichts passiert. Umgekehrt waere
   der Abbruch ein Totalverlust.

`spellPlayCondition` hat die Signatur `(gs, playerIdx, engine)` — KEIN
`heroIdx` dazwischen. `inherentAction` dagegen bekommt
`(gs, pi, heroIdx, engine)`; die beiden sehen aehnlich aus und sind es
nicht.

**Aktionsoekonomie:** „If the user has at least Magic Arts 1, this
counts as an additional Action" ist reine Oekonomie — die Karte bleibt
ohne Magic Arts spielbar, sie kostet dann nur die Aktion. Das ist
`inherentAction` als Funktion (Modelle: Quick Attack, Overheal Shock,
Market Crash), NICHT `spellPlayCondition`; letzteres wuerde die Karte
faelschlich ausgrauen. Die Stufe kommt aus
`heroAbilityLevel(engine, pi, heroIdx, 'Magic Arts')`.

**Ausruesten aus dem Deck** laeuft wie in „Gate to the Armory":
`safePlaceInSupport`, danach `onPlay` + `onCardEnterZone` von Hand
feuern (Vertrag: wer platziert, feuert die Hooks selbst) und den
oncePerGame-Riegel stempeln. „equippable" heisst dort wie hier: Subtype
Equipment, kein `neverPlayable`, `canEquipToHero` erfuellt, oncePerGame
nicht verbraucht.

### Abbrechen heisst ABBRECHEN (v781, Als Befund 5.9.)

> „Wenn man Overcharge cancelled, sollte die Karte dadurch nicht
> gestreamt und nicht konsumiert werden. […] cancelling at any point
> before Confirm just cancels it all." — und nachgeschoben: „Der letzte
> Confirm-Dialog ist unnoetig. In der Gallery auf das Equip zu klicken,
> das man rausbringen will, sollte reichen. Deswegen soll diese Gallery
> auch angezeigt werden, wenn es nur ein moegliches Ziel gibt!"

**Der Zusagepunkt darf ein Klick sein — aber es muss ihn geben.** Ein
eigener Confirm-Dialog hinter einer Auswahl ist doppelt gemoppelt: die
Auswahl selbst ist die Zusage. Daraus folgt aber die Pflicht, den
auswaehlenden Prompt NIE wegzukuerzen, auch nicht bei genau einer
Moeglichkeit — sonst laeuft der Effekt ohne jede Rueckfrage durch.
Bequemlichkeits-Abkuerzungen („nur eine Option, also automatisch")
gehoeren an vorgelagerte Schritte, nicht an den letzten.

Zwei Fallen, die man beide leicht uebersieht:

**1. `return false` bricht NICHTS ab.** Der Server verbucht den Guss
dann als aufgeloest — Karte weg, Aktion weg. Der Abbruch heisst
`gs._spellCancelled = true`; erst dann erstattet `doPlaySpell` die
Heldenkosten, laesst die Karte in der Hand, untrackt die Instanz, rollt
die Aktionsbuchhaltung zurueck (`restoreAdditionalAction`,
`_actionsPlayedThisPhase`, `_bonusMainActions`) und wirft den
ausstehenden Reveal weg. Auf JEDEM Abbruchweg setzen, auch bei
„Zustand hat sich zwischen Gate und Aufloesung verschoben".

**2. Der Reveal feuert beim ERSTEN Klick.** `promptGeneric` ruft
`_firePendingCardReveal()` bei jeder nicht abgebrochenen Antwort. Bei
mehrstufiger Auswahl hat der Gegner die Karte also laengst gesehen,
wenn der Spieler im dritten Schritt abbricht — obwohl sie in der Hand
bleibt. Dagegen gibt es seit v781 `gs._holdCardReveal`:

```js
gs._holdCardReveal = true;
try {
  /* … Auswahl, Auswahl … bis zum Zusagepunkt */
  gs._holdCardReveal = false;
  engine._firePendingCardReveal();   // erst jetzt sieht der Gegner sie
  /* … wirken … */
} finally {
  delete gs._holdCardReveal;         // Pflicht — sonst bleibt die naechste Karte stumm
}
```

Die Sperre kann nur verzoegern, nichts verschlucken: der Server raeumt
`_pendingCardReveal` im Abbruchzweig weg und feuert es sonst nach der
Aufloesung nach.

**Und die Reihenfolge:** alles Verbrauchende gehoert HINTER den
Zusagepunkt. Overcharge waehlt beide Karten und legt erst nach dem
Galerie-Klick ab und zieht erst dann. Ist der Punkt ueberschritten, gibt es
kein Zurueck mehr — schlaegt die Platzierung dann noch fehl, wandert
die neue Karte zurueck ins Deck, aber der Guss gilt als geschehen.

### `promptZonePick`: Held als Klick-Abkuerzung — `heroShortcut` (v783)

Ein Klick auf die HELDENKARTE waehlt per Vorgabe dessen linkeste
taugliche Zone aus. Das ist richtig bei „waehle einen PLATZ"
(Platzierung, Beschwoerung, Umzug): dort ist der Held gemeint und der
Platz nur das Wohin.

Es ist FALSCH bei „waehle die KARTE, die dort liegt". Bei Overcharge
entfernte ein Klick auf den Helden kommentarlos dessen linkeste
Ausruestung (Als Befund 5.9.) — der Spieler hat den Helden angeklickt
und eine Karte verloren, die er nicht gewaehlt hat.

```js
await ctx.promptZonePick(zonen, { …, heroShortcut: false });
```

**Faustregel:** waehlt der Prompt eine FREIE Zone → Abkuerzung an
(Vorgabe). Waehlt er eine BELEGTE Zone, weil es um die Karte darin geht
→ `heroShortcut: false`.

**„Send it to the discard pile" ist eine BEWEGUNG**, keine
Zerstoerung: `actionMoveCard(inst, 'discard')`. `onCardLeaveZone` laeuft
mit, ATK-Boni und Anhaengsel werden also sauber zurueckgenommen, und
Zerstoerungs-Trigger bleiben stumm.

## Skalierende Effekte: Klemmen statt Ausfallen — `scaledByLevel` (v784)

> Als Regel (5.9.): „Scalende Effekte nehmen immer ihr Minimum bei X=0
> und ihr Maximum, falls X groesser ist als die angegebenen
> Moeglichkeiten."

Gilt fuer JEDE Karte in der Form „1/2/3", „100/200/300", „up to 1/2/3
targets, depending on …". Der Wert wird an einer Stufe abgelesen; was
ausserhalb der aufgezaehlten Stufen liegt, wird geklemmt — nicht
ignoriert, nicht auf null gesetzt:

| Abgelesene Stufe | Ergebnis |
|---|---|
| 0 oder nicht vorhanden | der KLEINSTE angegebene Wert |
| 1 … n | der Wert dieser Stufe |
| groesser als n | der GROESSTE angegebene Wert |

```js
const { scaledByLevel } = require('./_hooks');

scaledByLevel(0, [1, 2, 3]);   // → 1
scaledByLevel(2, [1, 2, 3]);   // → 2
scaledByLevel(9, [1, 2, 3]);   // → 3
```

Praktische Folge: eine skalierende Faehigkeit faellt NIE aus, nur weil
die Stufe fehlt. „Land Sharks" trifft ohne jedes Summoning Magic
weiterhin 1 Ziel; ein Effekt, der bei Stufe 0 gar nicht laufen soll,
muss das ausdruecklich in `canActivate…` sagen.

Die alte Handarbeit `WERTE[level - 1]` ist damit ueberholt — bei Stufe 0
liest sie Index -1 und liefert `undefined`. Wo sie noch steht, ersetzen.

## Kreaturen, die mehrere Support Zones belegen — `_multizone-shared.js` (v784)

„This Creature occupies 3 Support Zones" (Populated Island Turtle, Land
Sharks). Die Kreatur sitzt in EINEM Platz, die uebrigen bekommen den
Platzhalternamen `_ZoneBlocked`. Der blockt weitere Platzierungen (die
Frei-Pruefung kennt nur `slot.length === 0`) und ist fuer jede
Zielsuche unsichtbar, weil `cardDB['_ZoneBlocked']` undefined liefert.

```js
const multizone = require('./_multizone-shared');

canSummon(ctx) { return multizone.canSummonMultiZone(ctx, CARD_NAME); },
hooks: {
  ...multizone.multiZoneHooks(CARD_NAME, { claimLog: '…_zones_claimed' }),
  /* eigene Hooks daneben */
},
```

`canSummonMultiZone` beantwortet BEIDE Fragen der Engine: pro Held
(sind dessen drei Plaetze frei, eigene Instanz ausgenommen) und
kartenweit (`cardHeroIdx === -1`, steuert die Ausgrauung auf der Hand).

`multiZoneHooks` liefert drei Hooks: `onPlay` (Platzhalter setzen),
`onGameStart` (Platzhalter NACHTRAGEN) und `onCardLeaveZone`
(abraeumen).

**Warum `onGameStart` dazugehoert (v786, Als Befund 5.9.):** der
Puzzle-Lader legt Karten direkt in die Support Zones und ueberspringt
`onPlay` vollstaendig. Eine im Editor gesetzte Mehrzonen-Kreatur
belegte deshalb nur ihren eigenen Platz. `onGameStart` laeuft im
Puzzle-Startpfad nach dem Aufbau des Bretts und holt es nach — dieselbe
Bauform wie bei vorab ausgeruesteten Artefakten (Sacred Hammer, Club of
Gobbo), und generisch statt als weiterer By-Name-Sonderfall in der
langen Nachhol-Kette des Laders.

Nachgetragen wird nur in LEERE Plaetze: hat der Autor daneben bewusst
etwas platziert, bleibt das stehen. `claimZones` meldet dann „nichts
getan" und schreibt auch keine Logzeile — sonst haette jeder
Nachhol-Durchlauf eine zweite erzeugt.

**Merksatz:** jede Karte, deren `onPlay` den Brettzustand VERAENDERT
(Statuszeichen, Zonenbelegung, ATK-Zuschlaege), braucht denselben
Nachtrag ueber `onGameStart` — sonst stimmt sie im Puzzle-Modus nicht.

`onCardLeaveZone` deckt jeden Weg vom Brett ab;
fehlt `fromHeroIdx`, wird ueber alle eigenen Helden nach VERWAISTEN
Platzhaltern gesucht — Plaetze mit Platzhalter, in denen nirgends mehr
die Ankerkarte liegt.

### Inselzonen und Mehrzonen-Kreaturen (v787)

„Flying Island in the Sky" haengt einem Helden zusaetzliche Support
Zones HINTEN an das Array an (`islandZoneCount` zaehlt sie), und diese
Zonen nehmen ausdruecklich Kreaturen auf. Daraus folgen drei Regeln
(Als Vorgabe 5.9.):

1. **Ueber die tatsaechliche Zonenzahl laufen, nie ueber die feste 3.**
   `zonenAnzahl(ps, heroIdx)` statt einer Konstanten in jeder Schleife.
2. **Die Bedingung ist „mindestens N FREIE Zonen", nicht „alle Zonen
   frei".** Sonst waere die Karte an einem Helden MIT Insel
   unbeschwoerbar, obwohl der mehr Platz hat als noetig. Belegt werden
   dann auch nur N Zonen — an einem Helden mit 5 bleiben zwei frei.
3. **Faellt eine belegte Inselzone weg, wird UMGESCHICHTET.**
   `handleIslandRemoval` laeuft in `removeIslandZones` vor der
   Todesschleife: reichen die verbleibenden Zonen, zieht die Kreatur
   dorthin um (Instanz behaelt HP, Counter und ID); sonst geht sie in
   die ABLAGE — sie stirbt NICHT. Das weicht bewusst vom Inseltext ab
   („any Creatures in those Support Zones are defeated"), der die
   gewoehnliche Ein-Zonen-Kreatur meint.

Erkannt werden diese Kreaturen an `multiZone: <n>` in ihrem Skript.
Jede Karte dieser Bauform MUSS das exportieren, sonst faellt sie beim
Inselabbau in die Todesschleife.

Nebenbei gefunden und behoben: die Todesschleife in `removeIslandZones`
schob jeden Namen aus der Zone in den Ablagestapel — auch den
Platzhalter `_ZoneBlocked`, der als Zeichenkette dort gelandet waere.

Verbleibende Kante: ein Leser, der `supportZones[hi][si][0]` ROH
auswertet ohne cardDB-Nachschlag, saehe die Platzhalter-Zeichenkette.
Nachgemessen (5.9.): einen solchen Leser gibt es im Projekt nicht.


## Ausruestung: welche Seite? — `equipOwnSideOnly` (v796)

**Die Vorgabe im Haus ist frei-seitig.** Eine reine Equipment-Karte ohne
eigene Beschraenkung darf an einen Helden BEIDER Seiten — das ist
gewollt (eine Ausruestung mit Nachteil gehoert dem Gegner an den Hals).
Wer das nicht will, sagt es ausdruecklich:

```js
module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,   // „Equip this card to a Hero you control."
};
```

Gelesen wird die Fahne an ZWEI Stellen, und beide braucht es:
`getFreeSideEquipArtifacts` (was der Client ueberhaupt anbietet) und
`doPlayArtifact` (der Riegel, der zaehlt). Eine Aenderung nur in der
Engine-Liste waere reine Oberflaeche.

**Warum nicht ueber `canEquipToHero`.** Ein blosses `() => true` haette
denselben Nebeneffekt gehabt — die Anwesenheit der Funktion gilt als
„beschraenkt" —, schreibt die Karte aber zugleich in
`equipEligibleHeroes`, den Topf fuer HELDEN-Beschraenkungen, nach dem
der Client Heldenkacheln ausgraut. Zwei Aussagen in einer Fahne, von
denen nur eine gemeint war. `equipOwnSideOnly` sagt genau das eine.

**Der Kartentext bindet (Als Regel 5.9.).** Steht auf einer
Equipment-Karte „Equip this card to a Hero you control", gehoert die
Fahne gesetzt — die Hausvorgabe gilt nur, wo der Text schweigt.
Nachgezogen wurde das in einem Durchlauf: **49** nicht gebannte
Equipment-Karten tragen die Klausel und sind jetzt ausnahmslos
seitengebunden (15 davon schon vorher ueber ein `canEquipToHero`, 24
per Fahne ergaenzt, 10 haben dafuer eine eigene, sonst leere
Skriptdatei bekommen). Karten OHNE die Klausel wurden nicht angefasst.

**Nicht gebunden — drei Grenzfaelle.** „Communication Device", „Rain
Viola" und „Thunder Trumpet" nennen „a Hero you control" nur in einer
WIRKUNGS-Bedingung („When this Artifact equipped to a Hero you control
is sent to the discard pile …"), nicht in einer Ausruest-Klausel. Auf
einem gegnerischen Helden sind sie damit erlaubt, aber wirkungslos —
das ist etwas anderes als verboten. Sie bleiben frei-seitig, bis Al
etwas anderes sagt.

## Brettkarte per Effekt in die Ablage — `sendBoardCardToDiscard` (v800)

„Send it to the discard pile" von einer **Support- oder Ability-Zone**
aus ist KEINE Zerstoerung: keine Board-Waechter, keine Immunitaeten
gegen Gegnereffekte, kein `destroy`-Anlass. Dafuer gibt es jetzt genau
EINE Primitive:

```js
await engine.sendBoardCardToDiscard(inst, { source: CARD_NAME, sourceOwner: pi });
// → true, wenn die Karte die Zone verlassen hat (immovable / Cardinal prallen ab)
```

Sie sendet den Flug VOR dem Splice (`play_pile_transfer` bzw.
`ability_zone_to_discard`) und laeuft dann ueber `actionMoveCard` — damit
feuern `onCardLeaveZone` (Fighting nimmt seinen ATK zurueck, Toughness
seine HP), Untracking, Stapel des URSPRUENGLICHEN Besitzers,
Identitaets-Anker, Handlimit-Nachpruefung, `onBoardSentToDiscard`
(Aquatic-Serie) und das Cosmic-Malfunction-Fenster bei gegnerischer
Quelle.

`discardAbilityTopCopy(eintrag, opts)` (eine Kopie vom Stapel) und
`_crusader-shared.artefaktInDieAblage` delegieren dorthin. **Befund
6.9.:** der alte Ability-Zweig warf nur den NAMEN ab — die Instanz blieb
als Leiche in `cardInstances`, der Leave-Hook blieb stumm, eine per Cybug
Ladybug abgeworfene Fighting behielt ihren ATK-Bonus. `ragnarock.js` und
`crusader-s-arm-cannon.js` tragen dieselbe Namens-Schleife noch inline
(nicht angefasst — bei naechster Gelegenheit auf die Primitive ziehen).

Nicht ueber diese Primitive: Schadenstode (Batch), Opfer/Zerstoerung
(`actionDestroyCard`), Abwuerfe aus der Hand.

## Hand-Reaktionen: WER castet, und Wisdom (v800, Als Vorgabe 6.9.)

Bis v799 kannten die acht Hand-Reaktionsfenster
(`_checkPreDamageHandReactions` und Geschwister) keinen Caster — sie
fragten nur „kann irgendein Held die Karte?" und zahlten Gold. **Wisdom
wurde nie eingezogen**: ein Held, der Spectral Armor oder Escape nur ueber
Wisdom erreichte, spielte sie kostenlos.

Jetzt legt `_rxCastPlan(ps, cardName, script, { targetHeroIdx })` in
jedem Fenster den Caster fest und `_rxPayWisdom` zieht direkt nach dem
Gold den Abwurf ein (`Wisdom Cost`, wie im Ketten-Fenster). Zwei
Skript-Vertraege:

| Export | Bedeutung |
|---|---|
| `casterIsTarget: true` | Der GETROFFENE Held ist der Caster („a Hero you control that can use it", „the user"). Er muss die Karte castfaehig sein — sonst kein Angebot, auch wenn ein anderer Held es koennte. Nur im Helden-Vor-Schadens-Fenster wirksam (nur dort gibt es ein Ziel). Traeger: Escape, Paraseed Zombie, Weapon Absorption. |
| `handlesOwnWisdomCost: true` | Die Karte zieht Wisdom SELBST ein — fuer Effekte, bei denen erst nach der Aufloesung feststeht, ob eine Luecke bleibt (Weapon Absorption). |

Ohne `casterIsTarget` nimmt das Fenster unter allen castfaehigen Helden
den mit den GERINGSTEN Wisdom-Kosten (0 gewinnt sofort, Reihenfolge bei
Gleichstand). Bewusst KEIN Helden-Picker — die Fenster haben nie danach
gefragt. Der gewaehlte Caster steht im Prompt unter
`_preDamageContext.casterHeroIdx` (plus `wisdomCost`), fuer CPU-Antworten.

## „This Spell's level is reduced by …" — Weapon Absorption (v800)

*„Play this card immediately when the user would take any damage. Choose
any number of Artifacts equipped and Abilities attached to the user and
send them to the discard pile. The user heals for 80 HP times the number
of cards sent. This Spell's level is reduced by the number of Abilities
you send with this effect."*

**Als Ruling (6.9.):** die Level-Pruefung laeuft VOR den Kosten — eine
Magic-Arts-Ability, die der Held mit dem Effekt abschickt, zaehlt noch
fuer sein Level. Reicht das Level nicht, muss er MINDESTENS so viele
Abilities schicken, dass die Luecke zu ist; das wird erzwungen.

Bauform (Modell fuer jede Karte, deren Level sich durch die eigenen
Kosten aendert):

1. **Tuersteher:** das Fenster fragt `heroMeetsLevelReq`. Die Karte
   exportiert `canBypassLevelReq(gs, pi, heroIdx, cardData, engine)`
   und probiert dort k = 0..N geschickte Abilities durch — mit einer
   KOPIE der Kartendaten (`{ ...cd, level: cd.level − k }`) und
   `opts.noPlacementBypass: true`, sonst rekurriert der Bypass auf sich
   selbst. Divinity, Mana Absorbing Crystal, Rocky-Slime-Offsets laufen
   dadurch automatisch mit. Tote Helden: `false` (die Engine fragt den
   Bypass auch im Toten-Zweig).
2. **Auswahl:** Brett-Schleife nach Greenhouse-Muster (v720) —
   `autoConfirm`, `maxTotal: 1`, ein Klick schickt EINE Karte (bei
   Ability-Stapeln die oberste Kopie via `discardAbilityTopCopy`), dann
   neu fragen. `cancellable` (= „✓ Done") erst, wenn die Luecke zu ist.
   Ein Einmal-Picker kennt nur ganze Slots, keine Kopien.
3. **Wisdom:** `handlesOwnWisdomCost` — erst bei „Done" steht fest, was
   noch fehlt; deckt Wisdom den Rest und gibt die Hand es her, wird der
   Abwurf dann faellig, sonst bleibt „Done" gesperrt.
4. Heilung ueber `actionHealHero` (Max-HP-Kappe), Rueckgabe `{}` — der
   Schaden landet danach normal.

Hilfsfunktionen im Skript: `getAbilityTargets` (Abilities inkl.
Cloak-of-Edge-Karten), `getArtifactTargets` gefiltert auf Subtype
Equipment (= „equipped"; Artifact-Creatures und Normal-Artefakte in
Support Zones sind nicht ausgeruestet).

### Nachtrag v801 (Als Befund 6.9.): Cast-Zeitpunkt

Die Level-Probe im Resolve laeuft gegen einen SCHNAPPSCHUSS der
Ability-Zonen vom Cast (`withCastZones`): wer zuerst seine einzige Magic
Arts schickt, hat sie fuer die Pruefung noch. Vorher las die Probe die
Live-Zonen und verlangte nach dem ersten Abwurf einen zweiten.

## Karten, die mit ABILITIES bezahlen — Lernkanal `abilityCostRules` (v801)

Al (6.9.): „ein extra ML-Pfad fuer Absorption und kuenftige
‚kostet Abilities'-Karten, bei dem das Profil lernt, welche Abilities
weniger wert sind als andere und wann genau es sich lohnt, wie viele
Abilities zu bezahlen."

**Vertrag der Karte** — an JEDEN Schleifen-Prompt der Auswahl:

```js
await engine.promptEffectTarget(pi, ziele, {
  title: CARD_NAME, autoConfirm: true, maxTotal: 1, cancellable: <darf aufhoeren>,
  _abilityCost: {
    cardName: CARD_NAME, heroIdx, sent, abilitiesSent, amount,   // amount = anstehender Schaden, 0 wenn keiner
    needMore: <Luecke nur durch eine weitere ABILITY schliessbar>,
    wisdomPending: <Aufhoeren ginge, kostet aber Wisdom-Abwuerfe>,
  },
});
```

Ziele tragen `type: 'ability'|'equip'`, `cardName`, `slotIdx`. Menschen
sehen das Feld nie (Weisse Liste in `promptEffectTarget`).

**Was das Gehirn daraus macht** (`_deck-profile.abilityCostPick`, im
Prompt-Wrapper des CPU-Gehirns VOR der Karten-Heuristik):

* je Kandidat Tags aus `classifyAbilityCostTags`: `ac:kind:ability|equip`,
  `ac:ab:<Ability>` (DIE Achse „welche Ability ist entbehrlich"),
  `ac:lvl:1|2|3`, `ac:school:core|side|none` (Deckkarten mit dieser
  Schule, Schwelle 8), `ac:used:0|1-2|3+` (bisherige Casts/Aktivierungen
  aus `_schoolUse`), `ac:equip-cost:lo|mid|hi`, `ac:need|ac:optional`,
  `ac:wisdom-pending`, `ac:sent:0..3+`, `ac:dmg:lethal|heavy|light`,
  `ac:hp:lo|mid|hi`, `ac:behind|even|ahead` (lebende Helden),
  `ac:t:early|mid|late`
* Regel im Profil (`abilityCostRules[cardName][tag]`, Summe ±20): Score
  ≥ 4 → schicken (bester Kandidat), ≤ −4 bei allen → aufhoeren (nur
  wenn erlaubt), sonst keine Meinung → **Karten-Heuristik**
  (`cpuResponse('effectTarget')`), deren Schritt NACHGETRAGEN wird
  (`noteAbilityCostChoice`), damit der Trainer nicht nur Exploration sieht
* Exploration: `PP_ABILITYCOST_EXPLORE` (0.25), ε-Rest `PP_RULE_EXPLORE`
* Log `engine._abilityCostLog` → Recorder-Feld `abilityCostDecisions`
  (eine Zeile je Kandidat und Schritt, `fired` = geschickt) → Trainer
  lernt je Karte fired-vs-held je Tag mit Praevalenzfilter, Welch-t ≥ 2.5
  und Schrumpfung n/(n+60) (Bauart Descend-Kanal). Synthetik-Kontrollen
  6.9.: mit eingebautem Zusammenhang `ac:ab:Fighting −18.7 /
  ac:ab:Premonition +15.2`, Negativkontrolle leer

**OB die Reaktion ueberhaupt feuert**, lernt der bestehende
Reaktions-Kanal (`reactionFireDecision`, Bucket lethal/heavy/light).
Damit eine Karte dort NICHT am Gehirn vorbeigreift, liefert sie ihre
Vorentscheidung als `cpuMeta.reactionHeuristic(engine, promptData) →
true|false` statt als `cpuResponse('generic')` — Letzteres wuerde vor
dem Gehirn antworten und weder loggen noch lernen. Im Puzzle-Modus
feuert die CPU immer und schickt alles (Engine-Standard: erster
Kandidat, bis nichts mehr da ist) — deshalb liefern beide Karten-
Antworten dort `undefined`.

### Traeger von `casterIsTarget` (Stand v803)

Escape, Paraseed Zombie, Weapon Absorption, Emergency Spell Armor. Neue
Reaktionen mit „a Hero you control THAT CAN USE IT" oder „the user"
gehoeren dazu.

## Quellen-Typ einer Schadensreaktion — „by a Spell or Creature effect" (v803)

Emergency Spell Armor prueft die Quelle ueber die Kartendatenbank:
`hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature')` am
`source.name`. Damit zaehlen Artifact Creatures und Tokens als Creature,
und eigene Spells genauso wie fremde (der Text sagt nichts von
„opponent's"). NICHT gedeckt: Attacks, Helden-Effekte, Artefakte,
Status-Ticks, Quellen ohne Kartennamen. „current and max HP drop to 1"
ist wie bei Paraseed Zombie eine Ersetzung (`{ negated: true }` + HP
setzen), zusaetzlich `maxHp = 1` dauerhaft.

## REGEL: Max-HP fallen NIE unter 1 (Al, 6.9.)

Jede Senkung des Max-HP laeuft ueber `engine.decreaseMaxHp(hero, amount)`
— die Primitive klemmt bei 1 und zieht die aktuellen HP nach. Kein
Skript schreibt `hero.maxHp -= …` von Hand. Geprueft 6.9.: Toughness
nimmt ueber `decreaseMaxHp` zurueck (ein Held mit Max-HP 1 nach Emergency
Spell Armor bleibt bei 1, der Abzug verpufft), Paraseed klemmt selbst
(`Math.max(1, …)`, bewusst ohne `decreaseMaxHp`, weil dessen HP-Klammer
einen gerade getoeteten Helden wiederbeleben wuerde). Die einzigen
`maxHp = 0` sind das Leeren eines Helden-Slots nach Entfernung
(Initiation Ritual, Quetzahuitl) — kein lebender Held.

## Modul `_ability-cost-shared` — Bezahlen mit Abilities/Equips (v804)

`sendCardsLoop(engine, pi, heroIdx, { cardName, kinds, min, max, amount,
confirmLabel, describe })` ist die Brett-Schleife aus Weapon Absorption
als Modul: ein Klick = eine Karte (Ability-Stapel kopienweise), „✓ Done"
erst ab `min`, jeder Prompt traegt `_abilityCost` (Lernkanal v801).
`cpuSendFallback(engine, promptData, { school, wantMore })` ist der
Heuristik-Rueckfall fuer `cpuResponse('effectTarget')`. Nutzer: Weapon
Storm (any number, min 1), Barrier of Faith (nur Abilities, exakt N).
`sendables` / `abilityCardCount` liefern die Kandidaten (Equip =
Subtype Equipment, Cloak-of-Edge-Karten zaehlen als Ability).

## Weapon Storm (v804) — „40/50/60 times the number of cards sent"

Als Ruling: der Satz je Karte richtet sich nach dem Fighting-Level des
Nutzers NACH dem Senden (Lv1 40, Lv2 50, Lv3+ 60; Lv0 → 40 als
Untergrenze, Annahme). Attack-Muster (`hooks.onPlay`, `ctx.cardHeroIdx`),
Schleife zuerst, dann `ctx.promptDamageTarget` mit dem fertigen Betrag.
`canPlayWithHero` verlangt mindestens eine sendbare Karte.

## Barrier of Faith (v804) — Post-Target + Effekt-Immunitaet mit Kosten

„would be affected by a card or effect" = `isPostTargetReaction` (jede
Wirkung, jede Quelle). Schutz = `grantEffectImmunity` (v543) fuer EINEN
Helden gegen die laufende Aufloesung. 3/2/1 nach dem Support-Magic-Level
des Casters (hoechster Stand unter den castfaehigen Helden), die
Abilities kommen vom GESCHUETZTEN Helden (mind. N Ability-Karten, sonst
kein Angebot). CPU-Vorstufe: nur gegen `_rxDamageCtx.tag === 'lethal'`.

## Weapon Unleashing (v804) — proaktiver „Reaction"-Spell mit Phasenriegel

Als Ruling: nur Main Phase 1 oder Action Phase (`gs.currentPhase` 2|3),
nie nach geschlossener Action Phase. `canPlayWithHero`: der Nutzer traegt
einen Stapel der Hoehe 3. Kosten: alle 3 Kopien ueber
`discardAbilityTopCopy`. Effekt: helden-gebundener Second-Action-Grant
nach Giga-Steroids-Bauart auf der Karten-INSTANZ (`activeIn:
['hand','discard']`, `heroRestricted: true`, `expiresAtTurnEnd: true`);
`inst.heroIdx` wird auf den Nutzer gepinnt und in `onCardEnterZone`
wiederhergestellt, weil der Zonenwechsel in die Ablage ihn zuruecksetzt.

### Nachtraege v805 (Als Befunde 6.9.)

* **Effekt-Immunitaet gilt jetzt fuer JEDE Schadensquelle.** Die Pruefung
  in `_actionDealDamageImpl` sass nur im Surprise-Zweig, der
  `source.heroIdx >= 0` verlangt — Book of Doom (`{ name, owner }`) lief
  daran vorbei, Barrier of Faith triggerte und der Schaden kam trotzdem
  an. Jetzt steht sie davor; Status-Ticks bleiben ausgenommen.
* **Barrier of Faith: Caster-Wahl.** Kein automatischer Vorzug des
  hoechsten Levels — bei mehreren legalen Castern waehlt der Spieler
  (Beschreibung nennt je Held Kosten, Level und Wisdom), die Kosten
  richten sich nach dem GEWAEHLTEN Caster; sein Wisdom-Abwurf wird im
  Skript eingezogen (das Post-Target-Fenster zieht Wisdom nicht zentral
  ein). Danach die Wahl des geschuetzten Helden.
* **Abilities in Support Zones (Xal, Xalibur):** `collectSupportZoneAbilities`
  liefert einen echten Stapel jetzt als EINEN Eintrag (Level = Hoehe,
  vertreten durch die oberste Kopie) statt einer Zeile je Instanz;
  `getAbilityTargets` reicht `istEchteAbility` durch. Kartenzaehler
  nehmen `level` fuer alle Eintraege; Level-Berechnungen laufen ueber
  `effectiveSchoolLevelForCaster` (inkl. Support-Stapel). Weapon
  Unleashing findet 3er-Stapel auch dort.
* **Weapon Unleashing** ist KEINE Reaction (cards.json-Fehler, Subtype jetzt
  Normal), sondern eine inherente Zusatzaktion (`inherentAction: true`,
  Archer-Muster) — das Spielen kostet keine Aktion, der Grant gibt die zweite.
* **Weapon Storm:** Broadcast `play_weapon_barrage` (10-20 Waffen-Emojis
  als Strahl vom Nutzer zum Ziel, Client-Handler in app-board.jsx).

### Nachtraege v806 (Als Befunde 6.9.)

* Effekt-Immunitaet prallt jetzt auch Schaden vom Typ `'other'` ab —
  das ist der Typ der Artefakte (Book of Doom). Ausgenommen bleiben nur
  echte Status-Ticks (`status`/`burn`/`poison`).
* Barrier of Faith: Caster-Wahl ueber den `optionPicker` mit Helden-
  Buttons (wie im Ketten-Fenster), Kosten/Level/Wisdom stehen am Button.
* `sendCardsLoop`: „✓ Done" kommt vom Client als `null` (Cancel-Pfad des
  Pickers) und ist ein regulaeres Aufhoeren — Abbruch ist nur die
  stillgelegte Engine (`engine._aborted`). Vorher brach Weapon Storm
  nach „Done" den ganzen Angriff ab.
* Weapon-Storm-Barrage: Glyphen-Grundausrichtung (🗡️ Spitze unten-links,
  🔱 oben, 🪓 Blatt oben-rechts, ⚔️ eine Klinge oben-rechts) wird auf Ost
  gedreht, dann mit dem Zielwinkel — die Spitzen zeigen aufs Ziel.

### Nachtrag v807 — Einmal-Karten mit Second-Action-Grant (Weapon Unleashing)

Die geteilten `secondActionHooks` raeumen den Helden-Badge
(`second_action_grant`) in `onCardLeaveZone` (self) weg, sobald die
tragende Instanz ihre Zone verlaesst. Fuer einen SPELL, der nach dem
Resolve Hand → Ablage wandert, ist genau dieser Zug kein Verlust des
Grants — die Karte ueberschreibt den Hook (nach dem Spread!) und laesst
`fromZone === 'hand'` durch; `onCardEnterZone` stellt Helden-Pin und
Badge wieder her. Abbrechen ist bis zur Wahl des Stapels moeglich
(Picker immer, auch bei einem Stapel; Cancel → `gs._spellCancelled`).

## `gs._spellKeepInstance` — Spell, dessen Wirkung an der Instanz haengt (v808)

Der Server ENTSORGT die Instanz eines Spells/Attacks nach dem Resolve
(`_untrackCard`), waehrend der Artefakt-Pfad seine Instanz behaelt. Ein
Spell, der nach dem Resolve noch etwas TRAEGT — Weapon Unleashing haengt
seinen Second-Action-Grant an die eigene Instanz (Giga-Steroids-Bauart)
— setzt in `onPlay` `gs._spellKeepInstance = true`. Der Server zont die
Instanz dann in die Ablage um (`zone = 'discard'`, `heroIdx` bleibt), es
feuert KEIN Leave/Enter-Hook. Befund 6.9.: ohne das war die zweite
Aktion nie einloesbar — der Grant verschwand mit der Instanz.

Reveal-Steuerung dazu: `gs._holdCardReveal = true` vor dem ersten Prompt
(Abbruch bleibt verdeckt), nach der bindenden Wahl loeschen,
`_firePendingCardReveal()` (Gegner) und ein eigenes `card_reveal` an den
eigenen Socket, wenn BEIDE Spieler das Kartenbild sehen sollen.

## Glass Sword (v810) — Schwester des Tridents, nicht optional

`onAttackDeclare` mit genau einem Ziel: `ctx.modifyAmount(50)`, Schwert
SOFORT ueber `sendBoardCardToDiscard` in die Ablage (das Senden ist die
Kosten), kein Prompt, keine Einloese-Hooks. Negation danach aendert nichts
mehr (Trident-Ruling: Negation verbraucht). Animation `glass_shatter` =
`pink_glass_shatter` mit `palette` (Scherben-/Staubfarben und `--gp-*`-
CSS-Variablen fuer Scheibe, Risse, Ring) — jede weitere Glasfarbe ist
ein neuer Alias mit eigener Palette und eigenem Klang.

## Attachment mit Klick-Effekt — KEINE neue Kartenklasse (Prayer, v811)

Al fragte, ob „Attachments mit aktivem On-Click-Effekt" eine neue Klasse
brauchen. Nein: `equipEffect: true` + `onEquipEffect(ctx)` (+ optional
`canActivateEquipEffect(ctx)`) ist der Vertrag „Karte in einer Support
Zone mit Klick-Effekt" — `getActivatableEquips` scannt die Support Zones
und fragt nicht nach `isEquip`; Crimson Web (Surprise-Spell) laeuft so.
Die Engine haelt die weiche Einmal-je-Zug-Sperre (`equip-effect:<instId>`)
und den Status-Filter des Wirts; `onEquipEffect` gibt `false` zurueck,
wenn die Sperre NICHT verbraucht werden soll (Abbruch im Picker).
Anlegen weiterhin ueber `attachToHero` (MANDATORY); „Attach to the user"
= `heroFilter` auf den Caster + `preferCaster` — ein Drop-Hinweis auf
einen anderen Helden verfaellt, weil er nicht in der gefilterten
Wirt-Liste liegt. Zieh-Sperre fuer den Rest des Zuges: `ps.drawLocked`
(Sacred-Jewel-Lock, faellt am Zugende).

## Ziehvorgang-Kennung im `onDraw`-Kontext (v815)

`onDraw` feuert je gezogener KARTE. Seit v815 traegt der Kontext
`_drawBatch` (laufende Nummer des Ziehvorgangs aus `actionDrawCards`),
`_drawCount`, `_drawIndex` und `_drawSource`. Effekte mit „whenever …
draws 1 or more cards" (Cute Meanie Melissa) antworten je VORGANG genau
einmal: letzte Kennung am Helden/der Instanz merken, gleiche Kennung →
schweigen. `_isResourceDraw` trennt weiterhin den Ressourcen-Phase-Zug
von „via an effect".

## „You may draw N" — Zieh-Entscheidungs-Kanal `drawDecisionRules` (v816)

Al (6.9.): die CPU darf nur ziehen, wenn sie sich damit nicht ausmillt,
und das ML soll lernen, wann Ziehen gut ist (meistens) und wann schlecht
(auf dem Weg in den Mill-Tod). JE KARTE (Ruling 24.8.), nie gemittelt.

```js
const deckProfile = require('./_deck-profile');
// im cpuResponse('generic') der Nachfrage:
return deckProfile.optionalDrawChoice(engine, pi, CARD_NAME, count) ? { confirmed: true } : null;
```

Die Nachfrage traegt `_ownerIdx`, damit `cpuResponse` den Spieler kennt
(im Training sind beide Seiten CPU; `engine._cpuPlayerIdx` reicht nicht).
Entscheidung: Regel (`drawDecisionRules[cardName][tag]`, Summe ±20,
Schwelle ±4) → Exploration im Training (`PP_DRAW_EXPLORE` 0.2, ε-Rest
`PP_RULE_EXPLORE`) → Mill-Heuristik (ziehen, wenn danach ≥ 3 Karten im
Deck bleiben). Puzzle: immer ja. Tags: `dr:deck:0-2|3-5|6-10|11+`,
`dr:hand:*`, `dr:count:1|2|3+`, `dr:mill-risk`, `dr:t:*`,
`dr:behind|even|ahead`, `dr:own-turn|opp-turn`. Log `_drawDecisionLog`
→ Recorder `drawDecisions` → Trainer (Descend-Bauart). Synthetik 6.9.:
`dr:mill-risk −20 / dr:deck:11+ +18.2`, Negativkontrolle leer.
Traeger: Cute Meanie Melissa, Prayer (Extra-Karte), Emergency Spell Armor.

## „Punkt vor Strich" gilt ÜBERALL — `_settleAmount` (v840)

Seit dem Umbau auf Punkt-vor-Strich (1.9.) schreiben `ctx.modifyAmount`
und `ctx.multiplyAmount` nicht mehr direkt auf `hookCtx.amount`, sondern
sammeln in `hookCtx._flat` bzw. `hookCtx._mul`; zusammengerechnet wird
erst NACH der Hook-Runde. Umgestellt worden war damals nur der
Schadenspfad. Jede andere Stelle, die nach `runHooks` weiter
`hookCtx.amount` las, bekam seither die ROHBASIS — jeder `modifyAmount`-
Bonus verfiel dort **still**.

Aufgefallen an Treasure Huntress Semi: 4 statt 10 Gold zu Rundenbeginn
(Al, 9.9.). Betroffen waren vier Stellen — Goldgewinn, Goldausgabe
(`onResourceSpend`), Bleed (`beforeBleedDamage`) und Gift
(`modifyPoisonDamage`); Träger u.a. Semi, Wealth, Golden Vermin, Golden
Abomination, Bloom/Paraseed. `setAmount` und `ctx.amount = …` liefen
weiter, weil die direkt schreiben — deshalb fiel es nicht überall auf.

```js
// Engine, nach JEDER Hook-Runde, deren Ergebnis weiterverwendet wird:
await this.runHooks('onResourceGain', hookCtx);
this._settleAmount(hookCtx);      // projizieren, amount setzen, Sammler leeren
const gain = hookCtx.amount;      // erst JETZT steht der echte Betrag drin
```

**Regel für neue Engine-Pfade:** wer `runHooks` mit einem `hookCtx`
aufruft, der ein `amount` trägt, und den Betrag danach weiterverwendet,
ruft `_settleAmount(hookCtx)` dazwischen. Der Schadenspfad behält seinen
eigenen Ablauf (er mischt die Buff-Multiplikatoren noch VOR dem
Zusammenrechnen ein). Gleiche Bugklasse wie der Shattered-Trident-Fix
vom 5.9.: ein neuer Rechenweg wurde eingeführt, aber nur an einer von
mehreren Lesestellen nachgezogen.


## Selbstschaden IMMER mit Besitzer-Quelle (v845, Lehre 11.9.)

Schilde und Schadensumlenkungen ordnen ihre Quelle einem Spieler zu über
`source.owner ?? source.controller`. Eine Karte, die ein nacktes
Objektliteral als Quelle übergibt, ist damit besitzerlos (`-1`) und
rutscht durch jeden Schild, der „Schaden von der Gegenseite" prüft:
Angry Cheese traf Tazune trotz stehender Ladungen.

```js
// FALSCH — besitzerlos:
await engine.actionDealDamage(pi, hi, 100, { name: 'Angry Cheese' });
// RICHTIG:
await engine.actionDealDamage(pi, hi, 100, { name: 'Angry Cheese', owner: pi, controller: pi });
// Am besten gar nicht selbst bauen:
await ctx.dealDamage(ziel, 100);   // übergibt die Karteninstanz als Quelle
```

Betroffen waren genau zwei Stellen im Bestand (Angry Cheese, Diamond,
the Keeper of Peace), beide gefixt. **Burn, Poison und Bleed sind
absichtlich besitzerlos** — Tick-Schaden gehört keiner Quelle und soll
durch solche Schilde hindurchgehen.


## Prompts im GEGNERZUG halten die CPU-Uhren an — `beginHumanWait` (v848)

Ein Prompt an den SPIELER kann mitten im CPU-Zug aufgehen — jede
Schadensreaktion tut das (Shield of Death, Shield of Life, Surprises).
Die Uhren der CPU liefen dabei weiter, obwohl nicht die CPU rechnet,
sondern der Mensch überlegt: `_cpuCardDeadline` (Karten-Hardcap, 30 s)
und `_cpuTurnDeadline` (`MAX_CPU_TURN_MS`, 90 s). Wer kurz in einen
anderen Tab wechselte, riss beide — der Hardcap-Timer gab die Karte auf
und leerte dabei `gs.potionTargeting`: Prompt weg, Promise weiter offen,
Zug endet nie. Chronischer Hänger, von Al am 11.9. eingekreist.

```js
this.beginHumanWait();          // verschachtelungsfest über einen Zähler
try { const antwort = await /* Wartezeit */; }
finally { this.endHumanWait(); }  // schiebt BEIDE Uhren um die Wartezeit nach hinten
```

* `isWaitingForHuman()` — true, solange `_pendingPrompt` oder
  `_pendingGenericPrompt` steht. Der Hardcap-Timer fragt das ab und legt
  sich wieder schlafen, statt abzubrechen.
* **No-Op in Sim und Fast-Mode.** Das ist Absicht: sonst leckt die
  Verlängerung in den Live-Zug, genau wie seinerzeit bei
  `extendCpuTurnDeadline`.
* `promptEffectTarget` und `promptGeneric` klammern bereits selbst —
  Kartenskripte brauchen die Helfer **nicht** aufzurufen. Wer einen
  EIGENEN Wartepfad an der Engine vorbei baut, muss es tun.


## Taunt nur für Creatures — `forcesTargeting_creaturesOnly` (v849)

Der Schutzschirm des Taunts (`_applyForcesTargetingFilter`) entfernt
normalerweise jedes andere Ziel auf der Seite des Taunters — Creatures
UND Helden (Deepsea Horror Clown). Für Karten vom Schlag „your opponent
cannot choose other **Creatures** you control" (Doomed Town Guard) gibt
es die schmale Form:

```js
inst.counters.forcesTargeting = true;                  // der Taunt selbst
inst.counters.forcesTargeting_creaturesOnly = true;    // v849: Helden bleiben wählbar
```

Die Engine liest das Flag auch aus `inst.counters.buffs`. Es wirkt NUR
zusammen mit `forcesTargeting` und nur bei Creature-Taunern; ohne das
Flag gilt unverändert die volle Form. Client-Abzeichen: 🛡️ „Guarding"
(`BUFF_BADGES` in app-shared.jsx).

**Puzzle-Editor (★-Regel 16.8.: jeder Counter muss setzbar sein):**
Schalter `🛡️ Guarding` in `BUFF_LIST` (app-puzzle.jsx), `scope:
'creature'` — er erscheint nur an einer Support Zone, in der wirklich
eine Creature liegt. Der Puzzle-Loader in server.js setzt **beide**
Zähler, weil die Variante ohne den Taunt selbst nichts täte; ein
angehakter Schalter, der nichts bewirkt, wäre eine Falle für den
Puzzle-Autor.


## Area-Hintergründe: Nachzügler geschlossen (v902)

Vollzähligkeitsprüfung 12.9.: drei implementierte Areas hatten kein
Overlay und verletzten damit die ★-Regel vom 7.9. Nachgeliefert in
app-board.jsx, Registry jetzt 23/23 — jede implementierte Area-Karte
hat einen Hintergrund:

| Area | tier | Bild |
|---|---|---|
| Pangaia, the Dino Domain | `opaque` | riesige Insel im Meer, Vulkan, wandernde Sauropoden |
| Smuggler's Pier | `translucent` | Bohlendeck über dunklem Hafenwasser, Kisten, Laternen |
| The Great Clock Tower „Big Gwen" | `partial` | Big-Ben-Turm am rechten Rand, laufende Zeiger |

Die Prüfung ist mechanisch und gehört vor jede Auslieferung mit neuen
Area-Karten: jede Karte mit `subtype: 'Area'`, zu der ein Skript
existiert, MUSS als Schlüssel in `AREA_OVERLAYS` stehen — der Name dort
ist der Kartenname aus cards.json, zeichengenau.

Bei Big Gwen NICHT mit der Aktivierungs-Animation verwechseln
(`big_gwen_clock_activation`, die große Uhr in der Brettmitte): die ist
ein Ereignis und hat ihren Klang, der Hintergrund ist Ambiente und
braucht keinen.


## Pangaia: eine Area, die nie in der Zone ankam (v902, Als Befund 12.9.)

Beim Spielen wanderte „Pangaia, the Dino Domain" direkt in die Ablage;
lag sie (per Puzzle-Editor) schon in der Zone, wirkte ihr Effekt
einwandfrei. Genau dieses Zwiegesicht ist die Signatur des Fehlers:
gebrochen war nicht der Effekt, sondern der WEG dorthin.

Zwei Defekte in derselben Datei, die einander verdeckten:

* `activeIn: ['area']` — aus der Hand feuerte gar kein Hook.
* kein `onPlay`, also nirgends ein `placeArea` — selbst mit gesetztem
  `'hand'` hätte sich die Karte nicht gelegt.

Beides ist unsichtbar für Syntaxprüfung, Loader (das Modul trägt Hooks
und lädt sauber), `check-scope` und den Puzzle-Mode. Nur ein echter
Spielweg zeigt es. Seitdem prüft `scripts/check-areas.js` den Vertrag
mechanisch; die Gegenprobe gegen den alten Stand meldet beide Punkte.

Offen für ein Ruling: die Engine KÖNNTE nach dem Auflösen einer Karte
mit `subtype: 'Area'` prüfen, ob `gs._spellPlacedOnBoard` gestempelt
wurde, und sonst selbst platzieren. Das wäre ein zweiter Gurt, ändert
aber das Verhalten für alle Areas — deshalb nicht ohne Entscheidung.


## Neue Karte: „Vena, the Bounty Huntress" (v904, Als Buff 12.9.)

Held, 400 HP / 100 ATK. Markiert vor den Starthänden einen gegnerischen
Helden als **Kopfgeld** und hat danach einmal pro Zug für **5 Gold** drei
Wirkungen gegen genau diesen Helden zur Wahl: **150 Schaden** (von 100
gebufft), eine Karte aus seinen Support Zones auf die Ablage, oder Stun
für 1 Zug.

**Die Marke liegt auf dem ZIEL, nicht auf Vena.** `hero._bountyBy =
<Spielerindex der Jägerin>` auf dem markierten Helden. Eine gespeicherte
Koordinate auf Vena hätte drei Dinge einzeln nachhalten müssen, die so
von selbst stimmen: stirbt das Ziel, geht die Marke mit ihm (kein Zeiger
ins Leere); Heldenwechsel und Ascension tragen sie mit; und beide Spieler
können je eine Vena spielen, weil jede nur GEGNERISCHE Helden markiert
und pro Seite höchstens eine Marke existiert. Beim Setzen räumt
`bountyMarkieren` jede ältere Marke derselben Jägerin weg.

**Ruling (Al, 12.9.): die Neuwahl hängt ausschließlich an Venas eigenem
tödlichem Schaden.** Fällt das Kopfgeld anders — Angriff, Zauber, ein
anderer Held —, bekommt Vena KEIN neues Ziel und ist für den Rest der
Partie wirkungslos. `canActivateHeroEffect` gibt dann `false` zurück.
Das ist ausdrücklich so gewollt und keine Lücke; wer hier später eine
Auffangregel einbaut, ändert die Karte.

**Aktionsfrei.** Der Text nennt keine Action, also KEIN
`heroEffectActionCost` (★-Regel 7.9.).

**Schadenstyp `'hero'` (v905).** Vena ist kein Angriff, kein Zauber,
kein Kreatureffekt und kein Artefakt — deshalb der eigene Typ für
Heldeneffekt-Schaden. Anders als das früher benutzte `'other'` umgeht er
weder Surprises noch den Zielschutz. Siehe den Abschnitt
„Schadenstyp `'hero'`" unten.

**Support Zones halten NAMEN, nicht Instanzen.** Beim Bau ist mir genau
das durchgerutscht: `gs.players[pi].supportZones[hi][slot]` ist ein
Array von Kartennamen (ein Stapel — Monster Nest legt übereinander). Die
Instanz mit `id`, `counters` und Zonenkoordinaten lebt in
`engine.cardInstances`, und nur sie taugt für `actionMoveCard`. Der
richtige Weg ist `engine.findCards({ controller, zone: 'support',
heroIdx })`. Ein Zugriff über den Zonenspiegel sieht im Editor richtig
aus und stirbt erst beim Ausführen mit `arr.indexOf is not a function`.

**Puzzle-Editor (★-Regel 16.8.).** Schalter `🎯 Bounty` am Helden,
sichtbar nur, wenn die GEGENSEITE eine Vena kontrolliert (Gate über den
Heldennamen, nicht über die Marke — sonst ließe sich der
Ausgangszustand gar nicht herstellen). Speicherform `hero._bountyBy`,
durchgereicht vom Puzzle-Loader in server.js. Ohne das wäre die Karte im
Puzzle nicht testbar, weil ihre Neuwahl am eigenen Kill hängt.

**Das Markieren ist kein Effekt AUF den Helden** (Als Ruling 12.9.). Es
ändert nichts an ihm, es notiert nur auf Venas Seite, wer das Kopfgeld
ist. Die Zielwahl trägt deshalb `_skipPostTargetReactions: true` und
`_skipRedirectCheck: true` — ohne die beiden Riegel negierte **Castling**
die Markierung, und das Umleitungsfenster stand ebenfalls offen. Gilt
für den Spielbeginn UND die Neuwahl nach einem tödlichen Treffer: beides
ist dieselbe Buchführung. Die DREI Einzeleffekte sind davon unberührt —
Schaden, Konfiszieren und Stun laufen über die normalen Aktionswege und
bleiben voll reaktionsfähig.

**Beide Zielwahlen tragen `maxTotal: 1`** (siehe eigener Abschnitt
weiter unten). Ohne das fällt der Picker
still auf „unbegrenzt" zurück: man klickt mehrere Ziele an, alle bleiben
markiert, und der Effekt nimmt am Ende das ZUERST geklickte (Als Befund
12.9.). Mit `maxTotal: 1` greift die Client-Regel „ein Klick TAUSCHT die
Auswahl aus". Dieselbe Klasse Fehler fiel schon an Scrap Plow und Cheeky
Monkee auf — **jede** neue Einfachauswahl über `promptEffectTarget`
braucht `maxTotal: 1`, das ist keine Vena-Besonderheit.

**Client.** Abzeichen 🎯 oben rechts am markierten Helden
(`.vena-bounty-badge` in style.css), Tooltip unterscheidet eigene und
gegnerische Jägerin. Zonen-Animationen sind durchweg vorhandene Typen
(`anger_mark` beim Markieren, `gunshot_barrage` beim Schuss,
`gold_sparkle` bei der Zahlung) — keine NEUE Animation, also kein neuer
`ZONE_ANIM_SFX`-Eintrag nötig.


## Schadenstyp `'hero'` — Heldeneffekt-Schaden (v905, Als Vorgabe 12.9.)

Bis v904 lief Schaden aus einem aktivierbaren HELDEN-Effekt als
`'other'`, weil keiner der übrigen Typen passt: kein Angriff, kein
Zauber, kein Kreatureffekt, kein Artefakt. `'other'` steht aber in
`SURPRISE_SKIP_TYPES` — mit zwei Folgen, die beide falsch waren:

1. Das Standardfenster für die **Surprise-Zone des getroffenen Helden**
   ging nicht auf.
2. Im selben Block hängt **`heroBlocksTargeting`**. Ein Held, der
   „cannot be chosen as a target" ist (Escape Device), wurde von solchem
   Schaden trotzdem getroffen. Das war der ernstere Teil.

Gemessen an der laufenden Engine öffnete ein `'other'`-Treffer sieben
andere Fenster durchaus (Handreaktionen beider Seiten, die
Reaktionskette, das breite Banner-Bearer-Fenster, beide Nach-Schaden-
Fenster) — „öffnet keine Surprises" war zu grob. Gesperrt war genau das
eine, plus der Zielschutz.

`'hero'` steht bewusst NICHT in `SURPRISE_SKIP_TYPES` und verhält sich
damit wie jeder andere gezielte Karteneffekt. Gleichzeitig ist er ein
eigenes Merkmal, das künftige Karten abfragen können („damage from a
Hero's effect") — was mit `'other'` nicht ginge, weil dort auch
Selbstverletzung und Artefaktschaden liegen.

```js
await engine.actionDealDamage(quelle, hero, 150, 'hero');
```

**Wer ihn trägt:** Vena, the Bounty Huntress · Kit, the Shark Researcher
· Deep-Drowned Waflav · Logan, the Investment Monkee (letzterer lief
vorher als `'creature'`, was ihn fälschlich als Kreatureffekt auswies).

**Wer ihn NICHT bekommt:** Brackle und Broghan bleiben `'attack'` — ihr
Kartentext sagt ausdrücklich „This is treated as an Attack". Sleeping
Beauty bleibt `'creature'`: sie IST eine Creature. Selbstverletzung als
Kosten (Angry Cheese, Diamond, Mana Absorbing Crystal, Ska Harpyformer)
und Rückstoß (Spiky Armor, Spike Trap, Smugness, Lizbeth) bleiben
`'other'` bzw. `'recoil'` — dort ist die Sperre richtig.

**Angepasste Leser:** `angler-angel.js` (`KEIN_EFFEKTSCHADEN`) und
`zsos-ssar-the-serpent-warlord.js` (`skipTypes`) haben `'hero'`
aufgenommen. Bei Angler Angel ist das nur der Gürtel — die tragende
Prüfung ist ohnehin die Quelle; bei Zsos Ssar hält der Eintrag das
Verhalten exakt gleich, weil `'other'` dort schon ausgenommen war.
Dark Ocean braucht nichts: sie lässt ausschließlich `'attack'` und
`'destruction_spell'` durch, `'hero'` ist wie `'other'` geblockt.

Die zwei Altlasten, die der Wächter zutage gefördert hatte, sind mit
`'potion'` und `'decay_spell'` erledigt (siehe unten) — die Grundlinie
`damage-types-baseline.json` ist wieder leer.


## Schadenstypen `'potion'` und `'decay_spell'` (v907, Als Vorgabe 12.9.)

Zwei weitere Etiketten, damit künftige Effekte gezielt auf sie zugreifen
können („damage from a Potion"). Heute liest sie **niemand** — kein
Reader schließt sie ein oder aus.

| Typ | Träger |
|---|---|
| `'potion'` | Acid Vial · Punch in the Box · Bottled Lightning |
| `'decay_spell'` | Forbidden Zone |

`bottled-lightning.js` lief bis dahin auf `'normal'` — ein Typ, der nie
gültig war und den die v519-Bereinigung übersehen hatte.
`forbidden-zone.js` führte `'decay_spell'` bereits, nur ohne
Legitimation; jetzt steht er im Vokabular.

**Die Umstellung ist verhaltensneutral, und das ist gemessen**, nicht
geschlossen: gleiche Quellform, alter gegen neuen Typ, gezählt über
alle Fenster und die Zielschutz-Prüfung. Acid Vial, Punch in the Box und
Bottled Lightning tragen **keine Heldenquelle** (`heroIdx` fehlt bzw.
ist `-1`), und das Standardfenster verlangt `source.heroIdx >= 0` — es
ging bei ihnen vorher nicht auf und geht jetzt nicht auf. Forbidden Zone
hat eine Heldenquelle und öffnet es, vorher wie nachher.

**Eine Feinheit, die zu kennen ist:** die beiden neuen Typen verhalten
sich NICHT ganz wie `'other'`. `'other'` steht in
`SURPRISE_SKIP_TYPES` und in Zsos Ssars `skipTypes`; `'potion'` und
`'decay_spell'` stehen in keiner der beiden Listen. Bei den vier
heutigen Trägern macht das keinen Unterschied (siehe Messung oben),
aber eine KÜNFTIGE Potion mit Heldenquelle würde das Standardfenster
öffnen, wo eine `'other'`-Potion es überginge. Das ist Absicht und
dieselbe Linie wie bei `'hero'`: ein gezielter Karteneffekt soll
Surprises und Zielschutz nicht umgehen.


## ★ EINFACHAUSWAHL BRAUCHT `maxTotal: 1` (v909, Bestandsdurchgang 12.9.)

`promptEffectTarget` ohne `maxTotal` (bzw. `selectCount`) fällt im Client
still auf „unbegrenzt" zurück. Der Spieler klickt mehrere Ziele an, ALLE
bleiben markiert, und der Effekt nimmt am Ende nur das **zuerst**
geklickte. Mit `maxTotal: 1` greift die längst vorhandene Client-Regel
„ein Klick TAUSCHT die Auswahl aus" (`togglePotionTarget`).

Al hatte das an Scrap Plow und Cheeky Monkee gesehen, dort wurde es
einzeln geflickt — der Bestand blieb. Beim Durchgang am 12.9. hatten
**53 von 59** unbegrenzten Zielwahlen genau dieses Problem; alle tragen
jetzt `maxTotal: 1`.

Nicht betroffen und bewusst unangetastet sind die vier echten
Mehrfachauswahlen: `divine-zeal.js` (`maxPerType: { hero: 99, equip: 99 }`,
`pickedIds.map`), `sun-beam.js` (`for (const t of picked)`),
`mischief-militia-colored-snow.js` (reicht die Liste an `script.resolve`
weiter) und `swagdri-forger-of-coolness.js` (bekommt die config als
Variable, nicht als Literal).

**Wächter:** `node scripts/check-single-target.js`. Ein Aufruf gilt als
Einfachauswahl, wenn das Ergebnis ausschließlich über Index 0 gelesen
wird (`ids[0]`, `ids?.[0]`) und nirgends durchlaufen, weitergereicht
oder anders indiziert wird. Alles andere meldet er gar nicht erst — im
Zweifel schweigt er lieber, als Fehlalarme zu produzieren.

**Nebenbefund aus demselben Durchgang:** eine zeilenweise
Kommentarentfernung, die Blockkommentare ersatzlos streicht, verschiebt
alle Zeilennummern danach (bei großen Kopfkommentaren zweistellig). Beide
Wächter ersetzen Blockkommentare jetzt durch ihre eigenen
Zeilenumbrüche — `check-damage-types.js` hatte denselben Fehler in seinen
Berichtszeilen.


## Neue Karte: „Kohta, Master of Super-Killing" (v910, Als Update 12.9.)

Ascended Hero, 400 HP / 90 ATK. Aufstieg von „Kohta, the Silent
Observer", der **beide** Ausrüstungen trägt: „Super-Killing Knife, the
Tool of Liquidation" UND „Summoning Instructions". Einmal pro Zug die
**Aktion** ausgeben, ein beliebiges Ziel auf dem Brett wählen und es
besiegen — als Angriff dieses Helden, der nie mehr als 1 Ziel trifft.

**Aufstieg nach Riffel-Muster.** `_kohta-shared.js` hält Bedingung und
Zustandspflege; der BASISHELD pflegt `ascensionReady` über
Enter/Leave seiner eigenen Support Zones, die beiden Equip-Skripte
bleiben unberührt. Die Ascended-Karte liest die Bedingung über
`ascensionCondition`. Der Text nennt KEINE Ausnahme vom Zugende, also
kein `blockEndPhaseOnAscend` — der Aufstieg beendet den Zug wie üblich.

**Die HARTE Einmal-pro-Zug-Sperre (Al 12.9.).** Der Text sagt es
zweimal; die zweite Zeile ist die harte Form. Der Engine-Stempel
`hero-effect:<Name>:<pi>:<heroIdx>` reicht dafür NICHT: **Sleeping
Beauty liest genau diesen Stempel als Beweis**, dass der Held seinen
Effekt schon benutzt hat, und ruft danach `onHeroEffect` DIREKT auf — am
Engine-Gate vorbei. Die Karte führt deshalb einen eigenen Schlüssel, der
weder an der Heldeninstanz noch am Heldenplatz hängt, sondern nur am
Spieler:

```js
const HOPT_KEY = 'kohta-super-kill';          // → `kohta-super-kill:<pi>`
if (engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn) return false;
// … Zielwahl …
if (!engine.claimHOPT(HOPT_KEY, pi)) return false;   // erst NACH der Wahl
```

Beansprucht wird erst nach der Zielwahl — sonst frisst ein Abbruch die
Nutzung des Zuges. `canActivateHeroEffect` liest denselben Schlüssel,
damit der Knopf bei stehender Sperre gar nicht erst anklickbar ist.

**Das Muster ist allgemein:** wer eine WIRKLICH harte Einmal-pro-Zug-
Sperre braucht, nimmt einen eigenen `claimHOPT`-Schlüssel ohne
Heldenindex. Der Engine-Stempel allein sperrt nur den normalen
Aktivierungsweg.

**„Treated as this Hero hitting the target with an Attack".** Die
Zielwahl läuft über `ctx.promptDamageTarget` mit `damageType: 'attack'`
und `dealsDamage: false` (Niederlage statt Schaden — reine
Schadensminderung wie Spectral Armor soll nicht ins Leere laufen).
Danach wird das Angriffsfenster ausdrücklich erklärt:
`engine._fireAttackDeclare(quelle, ziel, ATK)`. Fällt die Projektion auf
0, hat ein Zuhörer den Angriff negiert (Future Tech Doomsday Bomb macht
genau das über `setAmount(0)`) — dann IST der Angriff erklärt worden, er
verpufft nur: kein Kill, aber Aktion und Sperre bleiben verbraucht.

**„Can never hit more than 1 target"** ist über `maxTotal: 1` und den
Verzicht auf jeden Flächenweg (`actionAoeHit`) umgesetzt. Im Bestand
gibt es heute nichts, was einen Angriff auf mehr Ziele ausweiten würde;
die Klausel ist ein Riegel für später.

**Zielmenge:** Helden UND Kreaturen beider Seiten („any target on the
board" schließt eigene ein). Artefakte, Abilities und Surprises sind
NICHT dabei — „defeat" ist das Vokabular für HP-Ziele, alles andere
würde „destroyed" heißen.


## Neue Karte: „Rha'Bi, the Living Skeleton" (v912, Als Update 12.9.)

Hero, 300 HP / 40 ATK, Necromancy + Toughness. Beliebig oft im eigenen
Zug: aktuelle UND maximale HP um 100 senken, dafür die oberste Karte des
eigenen Decks **verdeckt** in eine freie Support Zone eines gegnerischen
Helden legen — nur bei einem Helden, der noch keine Karte aus diesem
Effekt trägt. Zu Beginn des nächsten eigenen Zuges kommen alle noch
liegenden Karten auf die Hand, die Trägerhelden nehmen je 200 Schaden,
und Rha'Bi bekommt je Karte 100 aktuelle und maximale HP zurück.

**Zwei Verträge, die man leicht falsch baut:**

1. **Beliebig oft, nicht einmal pro Zug.** Die Engine stempelt nach
   jedem wahrheitsgemäßen `onHeroEffect` ihren Einmal-pro-Zug-Schlüssel.
   `ctx._skipHeroEffectHopt = true` setzt das aus (Muster von Kassaran).
   Der naheliegende Weg „immer `false` zurückgeben" wäre falsch: für die
   Engine heißt `false` **abgebrochen**, und die CPU könnte gefeuert
   nicht von abgebrochen unterscheiden.

2. **Das Einsammeln läuft auch bei gelähmtem Rha'Bi** (Als Ruling 12.9.:
   „NUR sein Tod verhindert es"). Der Hook-Filter der Engine schaltet
   Helden-Hooks stumm, sobald der Held Frozen, Stunned, Negated oder
   Mummy ist (`_isHeroEffectSilenced`). Genau dafür gibt es
   `bypassStatusFilter: true` — ohne das Flag wäre der Rückhol-Zug eines
   gefrorenen Rha'Bi stillschweigend ausgefallen. Der Tod bleibt
   wirksam: den fängt der Filter über `hero.hp <= 0` ohnehin ab, und der
   Hook prüft ihn zusätzlich selbst.

**Eine Karte in der Zone des GEGNERS.** Der Zonenspiegel liest
`inst.owner`, die Stapel (Ablage, Delete) lesen `inst.originalOwner`.
Also: `owner` = Gegner, `originalOwner` = Leger. Damit landet die Karte
beim Zurückholen auf SEINER Hand und beim Löschen auf SEINEM
Delete-Stapel, obwohl sie beim Gegner lag. Vor dem Zug auf die Hand wird
`inst.owner` auf den Leger zurückgesetzt — sonst schriebe
`_addCardToState` sie in die gegnerische Hand.

**`_trackCard(name, owner, zone, heroIdx, slot)` BAUT die Instanz** und
hängt sie in die Verfolgung. Nicht mit einer fertigen Instanz aufrufen:
der erste Anlauf tat das und legte eine zweite, kaputte Instanz an,
deren `name` ein Objekt war — der Hook-Filter stolperte dann über
`cardName.toLowerCase is not a function`.

**Bewusst ohne Beschwörungs-Hooks.** Eine verdeckte Karte ist keine
beschworene Kreatur; `onCreatureSummoned` und Konsorten haben dort
nichts zu suchen. Deshalb `_trackCard` + `_addCardToState` statt
`actionPlaceCreature`.

**Marke auf der KARTE, nicht auf Rha'Bi:**
`inst.counters._rhabiPlaced = { by, turn }`. Sie verschwindet mit der
Karte, überlebt jeden Zonenwechsel und trägt den Leger — so kommen sich
zwei Rha'Bi (beide Seiten) nicht in die Quere.

**Kostengrenze (Als Ruling 12.9.):** der Effekt ist schlicht nicht
aktivierbar, solange einer der beiden HP-Werte unter 101 liegt. Grund:
`decreaseMaxHp` klemmt bei maximal `maxHp − 1` ab — bei 100 maximalen HP
würden also nur 99 abgezogen, und Rha'Bi bekäme die Platzierung zum
Rabatt. 101 ist genau der Wert, bei dem die vollen 100 noch fallen
(er landet dann auf 1/1).

Geprüft wird an vier Stellen, die alle denselben Helfer `bezahlbar`
lesen: `canActivateHeroEffect` (grauer Knopf),
`cpuShouldUseHeroEffect`, der Einstieg in `onHeroEffect` und die
Nachprüfung nach der Zielwahl. Die letzte ist nicht redundant —
zwischen Anzeige und Antwort kann Rha'Bi Schaden genommen haben.


## ★ DAS FELD HEISST `activePlayer` — `gs.currentPlayer` GIBT ES NICHT (v914, Als Befund 12.9.)

Rha'Bis Rückhol-Hook lief nie: er verglich gegen `gs.currentPlayer`, ein
Feld, das im ganzen Spiel nicht existiert. Der Vergleich war damit immer
falsch, der Hook stieg sofort aus, die gelegten Karten blieben liegen.
Kein Fehler, kein Log — ein erfundenes Feld liefert einfach `undefined`.

Der Zugspieler heißt **`gs.activePlayer`**. Bei `onTurnStart` trägt der
Hook-Ctx ihn ohnehin mit: `ctx.activePlayer ?? gs.activePlayer`.

**Warum der Prüfstand das nicht gesehen hat** — und das ist die
eigentliche Lehre: er baute seinen Spielstand selbst und schrieb
`currentPlayer: 0` hinein, weil ich beim Test denselben Tippfehler
machte wie im Code. Danach rief er den Hook DIREKT auf und übersprang so
die Verteilung der Engine. Zwei Fehler, die sich gegenseitig bestätigt
haben. Ein Hook-Test gehört über `engine.runHooks(...)` gefahren, nicht
über `script.hooks.onX(...)` — nur so laufen Zonen- und Statusfilter mit.

**Wächter:** `node scripts/check-gamestate-fields.js` meldet jedes
`gs.<Feld>` in einem Kartenskript, das weder in `_engine.js`/`server.js`
vorkommt noch von der Datei selbst gesetzt wird. Felder mit führendem
Unterstrich sind ausgenommen — `gs._foo` ist die etablierte Form für
karteneigenen Kramzustand (39 Stellen im Bestand). Der verräterische
Fall ist genau das Feld, das nur GELESEN und nie geschrieben wird.


## ★ `ineligible` WAR NUR KOSMETIK (v915, Als Befund 12.9.)

Ein Tryse mit Stealth 2 wurde von einer Lv-1-Quick-Attack getroffen,
obwohl andere Ziele offenstanden. **Stealth war nicht kaputt.** Die
Aufnahme des Spiels führt ihn in `validTargets` korrekt mit
`ineligible: true` — der Schutz hat gegriffen, er wurde nur nicht
gelesen:

* **`_cpu.js`, `resolveTargetingPrompt`** gab dem Ziel-Picker
  `gs.potionTargeting.validTargets` **roh** weiter, also samt der als
  unwählbar markierten Einträge. `promptEffectTarget` filtert für seinen
  eigenen CPU-Zweig längst (`_waehlbar`) — dieser zweite Eingang tat es
  nicht. Die CPU griff zu.
* **`server.js`, `doConfirmPotion`** prüfte `ineligible` überhaupt nicht
  nach. Das Wort kam im ganzen Server nicht vor. Der Client graut die
  Ziele aus, der Server nahm sie trotzdem an — jede Quelle, die den
  Picker umgeht, kam an Stealth, Jetpack und jedem anderen
  `blocksTargeting`-Schutz vorbei.

Beides geschlossen: die CPU sortiert vor dem Picken aus, und der Server
weist eine Antwort mit unwählbarem Ziel ab (Abfrage bleibt offen, Log
`targeting_blocked`). Die Serverprüfung ist der eigentliche Riegel — sie
gilt für JEDEN Weg, nicht nur den der CPU.

**Lehre:** ein Schutz, der nur eine Markierung in der Zielliste setzt,
ist erst dann ein Schutz, wenn der autoritative Flaschenhals ihn prüft.
Die Markierung allein ist eine Anzeige.


## Handdiebstahl: der BESTOHLENE sah den Gegner nachziehen (v916, Als Befund 12.9.)

Klaut der Gegner eine Handkarte (Charme Lv 2, Thieving Strike, Loot the
Leftovers — alle über `play_hand_steal`), flog sie sichtbar von der
eigenen Hand herüber, verschwand dort und der Gegner zog stattdessen
eine Karte aus SEINEM DECK.

Der Client hatte für den Fall genau einen Zähler, `stealSkipDrawRef`,
und Phase 3 des Handlers setzte ihn **nur beim Dieb**:

```js
if (!iAmVictim) stealSkipDrawRef.current = stealIndices.length;
```

Der deckt die EIGENE Hand ab. Aus Sicht des Bestohlenen wächst aber die
GEGNERHAND, und deren Diff-Melder ist ein eigener Block. Der fand keinen
Diebstahl mehr im Gange — `stealInProgressRef` wird in derselben Phase 3
gelöscht, und der Server wartet mit der Zustandsänderung bewusst so
lange, bis Phase 3 durch ist — und ließ den Gegner die Karte aus seinem
Deck ziehen.

Gegenstück eingebaut: `oppStealSkipDrawRef`, in Phase 3 für das Opfer
gesetzt und im Gegnerhand-Block **vor** Klang und Animation verbraucht.
Wächst die Hand um mehr Karten als gestohlen wurden (Lillys Nachzieher
auf einen Diebstahl), behält der Rest seinen normalen Deckflug — der
Zähler nimmt nur so viele, wie er hat.

**Gilt für alle Diebstahlwege**, nicht nur Charme: `actionStealFromHand`
in `_engine.js` sendet dasselbe Ereignis in derselben Form, und über den
Helfer laufen Thieving Strike, Loot the Leftovers und die
Hand-Interaktions-Registry.

**Muster, das hier zum zweiten Mal auffällt:** eine Animation, die es
für die eigene Seite gibt, aber nicht für die gegnerische. Beim
Ascension-Flug (v911) war es der Selektor, der immer die falsche Hand
traf; hier ein Zähler, den nur eine der beiden Seiten setzt. Wer einen
Flug zwischen zwei Händen baut, prüft ihn aus BEIDEN Perspektiven.


## Neues Werkzeug: alle Profile gegen ein neues Deck (v917)

Kommt ein Structure Deck dazu, kennen die vorhandenen Profile das
Matchup nicht — sie wurden gegen ein Feld trainiert, in dem es noch
nicht vorkam.

```
node scripts/train-vs-deck.js --deck "Hellfire Battery" --games 120
```

Das Werkzeug darunter gab es bereits: **`PP_TRAIN_OPP`** (Gegnerfilter,
Substring) im Batch-Runner von server.js. Wer nur ein einzelnes Deck
nachziehen will, kann es weiter von Hand setzen. Was fehlte, war der
Durchstich: `train-all-decks.js` reicht die Variable nicht durch, und
die Resume-Logik über die Zeilenzahl braucht eine AUFSTOCKENDE Zielzahl
statt einer festen.

Geschrieben wird in die **vorhandene** Sammeldatei
`data/training/<deck>.jsonl` — das Profil entsteht danach aus altem Feld
PLUS neuem Matchup. Eine eigene Datei würde entweder alles Bisherige
verlieren oder erst zusammengeführt werden müssen.

Schalter: `--games` (zusätzliche Spiele je Deck, Default 120), `--jobs`,
`--only` / `--skip`, `--all` (auch Decks ohne Profil), `--fast 0`
(volles MCTS-Budget), `--no-retrain`, `--list` (Trockenlauf mit
Zeitschätzung), `--heap`.

**Deck → Profil NICHT aus dem Dateinamen ableiten.** Das Sammeldeck
heißt `Structure Deck Bamboo Warrior.txt` und trägt intern
`Name: Structure Deck: Bamboo Warrior`, das Profil heißt aber
`bamboo-warrior.json` und führt `deck: "Bamboo Warrior"`. Der erste
Anlauf leitete den Profilnamen ab und verlor dabei 39 von 42 Decks. Das
Skript liest den Deckbezug jetzt AUS den Profilen und ordnet über den
normalisierten Namen zu.

Serveraufruf (nie als root, nie ohne systemd):

```
sudo systemd-run --unit=pp-vsdeck --collect \
  --slice=pixelparties-training.slice --uid=pixelparties --gid=pixelparties \
  --working-directory=/opt/pixelparties \
  $(command -v node) scripts/train-vs-deck.js --deck "Hellfire Battery" --games 120
```

Danach die Wirksamkeit nachmessen — mit eigenem `--tag`, damit die
Messung nicht in den Topf der Grundmessung läuft:
`node scripts/ab-all.js --games 400 --tag vs-hellfirebattery`


## ★ AUFTRITTE ERST NACH DEM COMMIT (Als Regel 12.9. — MANDATORY)

> Al: „Auftritte werden immer erst gestreamed, wenn sie nicht mehr
> abgebrochen werden können, also NACH dem Confirm."

Ein Auftritt ist eine Behauptung gegenüber dem Gegner: *das passiert
gerade*. Wird der Effekt danach abgebrochen, hat er etwas gesehen, das
nie stattgefunden hat — und trifft womöglich Entscheidungen danach.

Der zweistufige Weg der Engine macht das von selbst richtig:
`armEffectAnnounce` meldet nur an, `announceActiveEffect` löst aus,
`clearEffectAnnounce` bricht ab. Wer stattdessen **direkt**
`engine._broadcastEvent('card_reveal', …)` sendet, umgeht die Stufen und
muss die Reihenfolge selbst einhalten.

**Der Fall (Charme Lv 1, v918):** Charme sendete den Reveal der
kopierten Ability, BEVOR es deren Handler aufrief. Leadership öffnet
dort seine eigene abbrechbare Auswahl („welche Karte wird
zurückgelegt?") — brach der Spieler dort ab, hatte der Gegner längst ein
Leadership gesehen, das nie passiert ist. Charme selbst behandelte den
Abbruch sonst sauber (HOPT freigeben, `_pendingCardReveal` löschen); nur
dieser eine direkte Broadcast war schon raus. Der Reveal steht jetzt im
`result !== false`-Zweig, also am Commit.

**Blinder Fleck beim Suchen:** ein Muster-Scan nach „Reveal, danach noch
eine abbrechbare Abfrage im selben Funktionsrumpf" findet genau diesen
Fall NICHT — die Abfrage liegt in der GERUFENEN Funktion, nicht in
Charme. Wer nach dieser Klasse sucht, muss dem Aufruf folgen.

**Bestandsprüfung 12.9.:** 57 direkte `card_reveal`-Broadcasts in
Kartenskripten, davon 10 mit nachfolgender Abfrage im selben Rumpf — alle
zehn geprüft und korrekt (der Reveal steht dort jeweils nach einem
Commit: `takeFromPile` erfolgreich, Confirm bereits beantwortet, oder
eine nicht abbrechbare Zonenwahl). Horn in a Bottle und Hive's Crown
sagen es sogar im Kommentar. Charme war der einzige echte Verstoß.


## ★ `blocksTargeting` GEHOERT AN DEN DISPATCHER (v919, Als Befund 12.9.)

Stealth hat zum zweiten Mal nicht gegriffen — diesmal gegen **Overheal
Shock** (Spell Lv 1, Attachment). Ursache ist NICHT Stealth und diesmal
auch nicht `ineligible` (v915), sondern eine schlichte Lücke:

**`promptEffectTarget` fragte den Vertrag `blocksTargeting` gar nicht
ab.** Er hing ausschließlich an `promptDamageTarget` und
`promptMultiTarget`. Jede Karte, die ihre Zielliste SELBST baut und
hier hereinreicht, lief daran vorbei — Attachments
(`_attachment-shared`), Ziel-Artefakte, Heldeneffekte, viele Zauber.
Für die existierten Stealth, Jetpack und jeder andere
`blocksTargeting`-Schutz schlicht nicht.

Die Prüfung sitzt jetzt an diesem Flaschenhals, neben dem vorhandenen
`untargetable_all`-Filter. Markiert wird (`ineligible`), nicht gelöscht:
der Client graut aus, der CPU-Zweig filtert über `_waehlbar`, und die
Serverprüfung aus v915 weist eine Antwort mit markiertem Ziel ab. Die
Quelle wird wie beim CPU-Dispatch aufgelöst
(`sourceCardName` → `sourceCard` → `source` → `previewCardName` →
`title`), Opt-out bleibt `ignoreUntargetable` / `_truthSeeingEye`.

**Damit sind alle drei Ebenen geschlossen:** die Karte markiert
(`blocksTargeting`), der Dispatcher wendet an, der Server prüft nach.
Vorher hing der Schutz an genau zwei von vielen Eingängen.

## Rha'Bi: jede Karte ein eigener Trigger (v919, Als Ruling 12.9.)

Nicht erst alle Karten einsammeln, dann alle Schäden, dann heilen.
Sondern je Karte: Flug → auf die Hand → dieses Ziel nimmt seine 200 →
Rha'Bi bekommt seine 100 → erst dann die nächste. Dadurch öffnet jede
Karte ihre eigenen On-Hit-Fenster beim jeweiligen Ziel, statt dass drei
Treffer als Block ankommen.

Fällt Rha'Bi mitten in der Kette (Reaktion auf den vorigen Treffer),
bricht die Schleife ab — die restlichen Karten bleiben liegen.

Gemessen wird die Reihenfolge im Repro über einen Beobachter auf
`actionDealDamage`: beim Schaden der i-ten Karte müssen i Karten auf der
Hand liegen und i−1 Heilungen gelaufen sein (die eigene kommt erst NACH
dem Schaden).

## Neue Animation: `divine_punishment` (v919)

Rote Blitze, die von oben auf den negierten Helden regnen — sieben
gezackte Pfade mit versetztem Einsatz, unten ein kurzer Einschlagblitz.
Klang: `elem_lightning` tiefer gestimmt (`rate: 0.78`) und laut
(`volume: 2.0`) — strafend statt spritzig. Divine Punishment nutzte
vorher `holy_revival`, eine geliehene Animation.


## ★ AUCH DAS SURPRISE-FENSTER GEHOERT AN DEN DISPATCHER (v920, Als Befund 12.9.)

Spike Trap („Activate this Surprise when the user is chosen by an Attack
or Spell") feuerte nicht, als Overheal Shock sich an den Helden hängte.
Dasselbe Loch wie beim Zielschutz eine Version zuvor, nur eine Ebene
weiter: **das Surprise-Fenster hing nur an `promptDamageTarget`,
`promptMultiTarget` und `actionAoeHit`.** Ein Attachment wählt seinen
Helden über `promptEffectTarget` — dort gab es kein Fenster.

Jetzt öffnet der Dispatcher es selbst, mit denselben Riegeln wie das
Post-Target-Fenster darüber: nur HELDEN-Ziele, nur mit echter Quelle,
Rekursionssperre. Die beiden Picker, die es schon selbst öffnen,
markieren ihre Delegation mit `_callerHandlesSurprise: true` — sonst
fragte jede Attacke zweimal.

**Das Muster ist jetzt dreimal aufgetreten** und lohnt die Merkregel:
Was am Ziel hängt — Schutz, Reaktion, Surprise —, gehört an
`promptEffectTarget`, nicht an die Schadens-Picker. Die Picker sind nur
EIN Eingang von vielen; Attachments, Ziel-Artefakte, Heldeneffekte und
viele Zauber bauen ihre Liste selbst und kommen direkt am Dispatcher an.

| Ebene | seit | Was |
|---|---|---|
| `ineligible` wird serverseitig geprüft | v915 | vorher rein kosmetisch |
| `blocksTargeting` am Dispatcher | v919 | Stealth/Jetpack galten nur im Schadenspfad |
| Surprise-Fenster am Dispatcher | v920 | Spike Trap & Co. sahen Attachments nicht |

## Divine Gift of Forgetting kostet eine Aktion (v920, Als Befund 12.9.)

Die Karte trug `inherentAction: true`, obwohl ihr Text keine Zusatzaktion
nennt — vermutlich aus der Familie übernommen, wo die meisten Karten sie
tatsächlich im Text führen. Entfernt: ein Spell kostet die Aktion des
Zuges, wenn er nichts anderes sagt.

Bestandsprüfung der ganzen Divine-Gift-Familie: **Forgetting war der
einzige Fehler.** `Divine Gift of Death` sieht im ersten Blick falsch
aus (kein `inherentAction: true`), führt es aber als FUNKTION — korrekt,
denn dort hängt die Zusatzaktion an einer Bedingung („if at least 2
Heroes are revived"). `Divine Gift of Edge` trägt das Flag als Reaction,
wo es ohnehin folgenlos ist (Reactions kosten nie eine Aktion) —
unangetastet gelassen.


## Neue Karte: „Sword in a Bottle" (v921)

Potion. „Choose a Hero you control and a target your opponent controls.
Deal damage equal to your Hero's Attack stat to the opponent's target.
This is treated as an Attack. You can only play 1 per turn."

**Zwei Picks in EINEM Fenster.** Der Trank-Picker hat nur eine
Zielliste, also stehen beide Wahlen darin: die eigenen Helden als
ANGREIFER, die gegnerischen Ziele als OPFER. `validateSelection`
verlangt genau eines von jeder Seite und lässt die Klickreihenfolge
offen. Die Alternative (Opfer im Trank-Fenster, Angreifer in einer
zweiten Abfrage) wären zwei Fenster für eine Entscheidung.

**`targetingConfig` als FUNKTION**, nicht als Objekt: der
`baseDamage`-Hinweis für den CPU-Zielbewerter hängt am stärksten
eigenen Helden und ist damit nicht konstant. Ohne ihn bewertet
`inferDamage` jeden Treffer mit 0 und die CPU würfelt ihr Ziel aus.

**`hero.atk` IST der laufende Angriffswert** — Buffs und Ausrüstung
schreiben direkt hinein, `hero.baseAtk` ist der gedruckte. Einen
Engine-Helfer dafür gibt es nicht; `attack.js` und `ctx.executeAttack`
lesen dasselbe Feld. (Mein erster Anlauf rief ein erfundenes
`engine.getHeroAttack()` auf — ein Fall für
`check-gamestate-fields`' Schwesterproblem: geratene API.)

**„Treated as an Attack"** über Schadenstyp `'attack'`. Damit feuert die
Engine das Angriffsfenster im AUTO-FALLBACK selbst, Super-Killing Knife
& Co. sehen einen echten Angriff, und Dark Ocean lässt den Schaden zu
Kreaturen durch. Die Quelle trägt `heroIdx` des gewählten Helden —
daran erkennen die Zuhörer, WER zuschlägt.

**Einmal pro Zug** über einen eigenen HOPT-Schlüssel am SPIELER
(`sword-in-a-bottle:<pi>`), nicht an der Instanz: die Regel gilt der
Karte, nicht der einzelnen Kopie. Geprüft in `canActivate` (grauer
Trank), gestempelt in `resolve` am Punkt ohne Rückkehr.

**Inszenierung: Dash statt doppeltem Schnitt** (Als Vorgabe 12.9.). Der
Angreifer fliegt über `play_ram_animation` sichtbar ins Ziel und zurück
(Muster von Phoenix Tackle), der Schnitt `quick_slash` kommt erst im
Moment des Aufpralls — und NUR auf dem Ziel. Damit zeigt die Animation
ohne Textzeile, wer zuschlägt.

**★ Falle bei mehrfach zielenden Potions:** `doUsePotion` sendet die
Hüllen-Animation `animationType` mit `destroyedIds: selectedIds`, also
auf **alle** gewählten Ziele. Bei dieser Karte ist der ANGREIFER eines
davon — der Schnitt erschien deshalb auf beiden Helden. `animationType:
'none'` schaltet die Hülle ab, dann inszeniert `resolve` selbst. Wer
eine Potion baut, deren Auswahl nicht nur Opfer enthält, braucht das.

**★ `isPotion: true` IST PFLICHT** (Als Befund 12.9.). `doUsePotion`
steigt ohne die Flagge in der ERSTEN Zeile still aus:

```js
if (!script?.isPotion) return false;
```

Kein Fehler, kein Log. Die Karte war im Client als nutzbar
hervorgehoben — `canActivate` lief ja —, aber Klick und Drag taten
nichts. Alle 29 übrigen Potion-Skripte tragen die Flagge; Sword in a
Bottle war das einzige ohne.

**Wächter:** `node scripts/check-card-flags.js` prüft für jede Karte mit
Skript, ob die Pflichtflagge zu ihrem `cardType` gesetzt ist. Die
Tabelle im Skript ist bewusst klein — sie wächst, sobald ein weiterer
Spielweg eine Flagge ZWINGEND verlangt. Erkennbar sind solche Stellen an
der Form `if (!script?.xyz) return false;` im Server; heute gibt es
genau eine (`isPotion`).


## Neue Serie: „Bonded Companions" (v924)

Vier Kreaturen (Humby, Mellvy, Orphy, Thuly), Lv 0, HP 0, Summoning
Magic. **Sechs der sieben Sätze auf jeder Karte sind wortgleich** —
die stehen in `_bonded-companions-shared.js`, jede Karte bringt nur
ihren siebten mit. Der Helfer baut das Gerüst über `companion({ name,
eigeneHooks })` und verkettet den gemeinsamen `onCardLeaveZone` mit
einem eigenen, falls die Karte einen mitbringt.

| Klausel | Umsetzung |
|---|---|
| 1 Kopie im Deck | `maxCopies: 1` in cards.json |
| 1 Companion je Held | `supportZonesLocked` auf der KARTE (neu, s.u.) |
| kein Zonenwechsel | `cannotChangeSupportZone` (Puppets-Vertrag v704) |
| geteilter HP-Pool | `sharesHpWithHero` (Puppets-Vertrag v704) |
| unantastbar für Kreatur-only | `unaffectedByCreatureOnly` (neu, s.u.) |
| Abgang besiegt den Helden | `onCardLeaveZone` im Helfer |

**Zwei neue Engine-Verträge** waren nötig; der Rest kam aus dem
Puppets-Archetyp.

**`supportZonesLocked` liest jetzt auch Karten IN der Spalte.** Bisher
war die Zonensperre rein heldenseitig. Für „A Hero can only have 1
'Bonded Companion' Creature in its Support Zones" ist die Bedingung
aber die schon liegende KARTE. Die Sperrfunktion sieht `opts.cardName`
und blockt deshalb gezielt nur weitere Companions, statt die Spalte
dichtzumachen — eine normale Kreatur darf weiter dazu.

**`unaffectedByCreatureOnly: true`** — „unaffected by cards and effects
that can't affect Heroes". Geprüft am Dispatcher (`promptEffectTarget`),
neben `blocksTargeting`: kann die Abfrage laut `config.types` überhaupt
keinen Helden treffen, fällt die Instanz als `ineligible` heraus.
Enthält `types` auch `hero`, bleibt sie wählbar — genau das sagt der
Text. Ohne Typangabe greift die Klausel nicht, sie schützt nur vor
KREATUR-ONLY.

Wichtig bei Klausel 3: `cannotChangeSupportZone`, **nicht** `immovable`.
Letzteres würde auch Zerstörung und Ablage blocken — die Karte SOLL das
Brett verlassen können, sonst liefe Klausel 6 nie.


## ★ `onCardLeaveZone` FEUERT FÜR JEDE KARTE (v925, Als Befund 12.9.)

Ein Bonded Companion riss seinen Helden mit, sobald **irgendwo** auf dem
Brett eine Karte eine Support Zone verließ — aufgefallen an Castling auf
der GEGNERSEITE, und der geblockte Effekt war beliebig.

Der Hook meldet nicht „du gehst", sondern „hier geht jemand".
`ctx.card` ist der ZUHÖRER, `ctx.leavingCard` die Karte, die wirklich
geht. Ohne den Vergleich reagiert jeder Zuhörer auf fremde Abgänge:

```js
const ich = ctx.card;
const geht = ctx.leavingCard || ich;   // manche Aufrufe setzen nur `card`
if (!ich || geht?.id !== ich.id) return;
```

Die Puppet-Tokens führen exakt diese Wache (`PUPPET_TOKEN_HOOKS`) — ich
hatte sie beim Bau der Companions übersehen. Wer auf den eigenen Abgang
reagiert, braucht sie immer.

**Gegenstück nachgetragen:** stirbt der Held, geht der Companion mit
(`onHeroKO` im Helfer). `sharesHpWithHero` bucht zwar allen Schaden auf
den Helden um — fällt der aber auf einem anderen Weg (Insta-Kill,
Opferung), bliebe die Kreatur sonst allein stehen. Kein Kreislauf, weil
`companionAbgang` aussteigt, sobald der Held bereits besiegt ist.

**HP-Anzeige:** Karten mit `sharesHpWithHero` haben keinen eigenen
Vorrat (0 HP in der Datenbank). Der Client zeigt jetzt die HP des
Helden derselben Spalte; dafür trägt die `creatureCounters`-Projektion
das Flag `_sharesHpWithHero` (beide Projektionsstellen in server.js).

**Selbst-Highlight:** Creativity blinkt ihre Ability-Zone auf
(`ability_activated`); das Gegenstück für eine Karte in der Support Zone
ist `effect_source_glow` mit `origin: 'board'` — derselbe Weg wie
`puppetGlow`. Alle vier Companions rufen ihn jetzt beim Auslösen, sonst
zieht Orphy drei Karten und niemand sieht, woher sie kommen.

## Eine Auswahlregel je Seite: `uniqueBy: 'owner'` (v925)

Sword in a Bottle ließ als zweiten Pick auch ein EIGENES Ziel anklicken;
der Effekt scheiterte dann erst beim Bestätigen. `maxTotal: 2` begrenzt
nur die Anzahl. Die passende Regel gab es schon: **`uniqueBy: 'owner'`**
— zwei Ziele dürfen sich im genannten Feld nicht gleichen, der zweite
Klick auf dieselbe Seite prallt im Picker ab. `validateSelection` bleibt
als serverseitiger Riegel bestehen.


## Zonensperre gehört auch in die Spielbarkeitsliste (v926, Als Befund 12.9.)

`doPlayCreature` weist eine Beschwörung in eine gesperrte Spalte ab —
die Spielbarkeitsliste `getHeroPlayableCards` wusste davon nichts. Ein
Held mit einem Bonded Companion wurde deshalb samt seiner freien Support
Zones als gültiges Ziel angezeigt, und der Server lehnte dann ab.

Der Client rechnet hier nichts selbst: er liest `heroPlayableCards.own`
vom Server und leitet daraus Heldenwahl und Drop-Zonen ab. Die Sperre
gehört also in die Engine-Projektion, nicht in die Oberfläche — dort
wirkt sie sofort für Drag&Drop, Klickpfad und Heldenpicker gleichzeitig.

Weil die Sperre den anklopfenden Kartennamen sieht, bleibt eine normale
Kreatur beim selben Helden weiter spielbar; nur der zweite Companion
fällt heraus.

**Merksatz für Spielzeit-Riegel:** `getHeroPlayableCards` ist der
Spiegel von `validateActionPlay` / `doPlayCreature`. Jeder neue Riegel
dort braucht seine Entsprechung hier, sonst zeigt die Oberfläche Züge
an, die der Server ablehnt — die Datei sagt das an mehreren Stellen
selbst („mirror of the validateActionPlay gate").


## ★ „WAR ICH DAS?" — `zone` REICHT ALS PRÜFUNG NICHT (v927, Als Befund 12.9.)

Tryses Effekt („when this Hero defeats a target …") feuerte für JEDE
Kreatur in seinen Support Zones, aufgefallen an Thuly.

Seine Wache war `if (src.zone === 'support') return false;` — und die
greift nur bei LIVE-Instanzen. Kreaturen bauen ihre Schadensquelle aber
meist synthetisch:

```js
const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };
```

Kein `zone`, dafür der heroIdx IHRER SPALTE — also genau die Signatur,
an der Tryse „das bin ich" festmacht. Der Kommentar im Code nahm
ausdrücklich an, dass synthetische Quellen immer von Attacks/Spells
stammen; Kreaturen bauen aber genauso welche.

**Richtig ist die Typisierung über den KARTENNAMEN.** Dafür gibt es
`isCreatureSource(engine, source)` in `_hooks.js`: sie schlägt den Namen
in der Kartendatenbank nach und fällt nur bei unbekannten Namen (rare
Tokens) auf das `zone`-Signal zurück. Sie erkennt zusätzlich die
Creature-Caster-Annotation (Demon's Gate).

```js
if (isCreatureSource(ctx._engine, src)) return false;
```

**Wer sonst noch so prüft, prüft zu schwach.** Jede Karte mit „when THIS
Hero defeats/deals/…" braucht diese Unterscheidung — der Heldenindex
allein sagt nur, in welcher SPALTE etwas passiert ist, nicht WER es war.

## Einzelner Potion-Zug bekam keinen eigenen Sync (v927)

Mellvys Karte erschien ohne Flug in der Hand. In
`actionDrawFromPotionDeck` stand der Zwischen-Sync hinter
`if (interDrawDelay > 0)` — und `interDrawDelay` ist bei EINER Karte 0.
Der Zug wurde damit erst beim nächsten Sync des Aufrufers sichtbar,
gebündelt mit allem anderen, und der Hand-Diff-Melder des Clients hatte
keinen Moment, in dem nur dieser eine Zug passiert ist. Jetzt wird
immer synchronisiert; die Staffelung zwischen mehreren Karten bleibt
unverändert.


## ★ ZIEH-SURPRISES NACH DEM AKTIONS-HOOK EINLÖSEN (v928, Als Befund 12.9.)

Pure Advantage Camel bekam sein Fenster nicht, als eine gegnerische
Melissa auf einen Zug reagierte — dafür ging es verspätet an einer
völlig fremden Kette auf.

Zieh-Surprises werden absichtlich gesammelt (`_pendingSurpriseDraws`)
und am Ende einer Auflösung gebündelt eingelöst
(`_flushSurpriseDrawChecks`), damit „Wheels zieht 3" nur EIN Fenster
öffnet. Nur: **`onAnyActionResolved` feuert in jedem Aktionspfad HINTER
dem letzten Flush.** Gemessen an allen sechs Feuerstellen:

| Pfad | letzter Flush | Hook |
|---|---|---|
| server.js | 7386 | 7664 |
| server.js | 8462 | 8976 |
| server.js | 8462 | 9316 |
| _engine.js (performImmediateAction ×2, Heldeneffekt) | davor | 16651 / 16729 / 31382 |

Zieht eine Karte erst in diesem Hook — Mellvy tut genau das —, landet
der Eintrag im Zwischenspeicher und bleibt dort, bis die NÄCHSTE
Auflösung ihn leert. Jetzt steht hinter jedem der sechs Hooks ein
eigener Flush.

**Merksatz:** wer einen neuen Hook ganz ans Ende eines Aktionspfads
hängt, hängt ihn hinter den Flush. Alles, was dort noch zieht, Schaden
macht oder Ziele wählt, braucht seine Fenster danach noch einmal.

## Einzelner Potion-Zug: die Klammer von Alchemy (v928)

Alchemy legt um ihren Potion-Zug ein `engine.sync()` — der Client
bekommt dadurch einen Zustand, in dem NUR dieser Zug passiert ist, und
sein Hand-Diff-Melder kann den Flug auslösen. Mellvy zog mitten im
Aktions-Hook, wo derselbe Zustand mit allem anderen gebündelt ankam.
Jetzt dieselbe Klammer: sync davor, sync danach.

Der Melder selbst kennt Potion-Züge übrigens längst (`deckDecreased`
prüft beide Stapel, und die Quellkoordinate wählt je Karte zwischen
`[data-my-deck]` und `[data-my-potion-deck]`) — es fehlte nur der
Moment, in dem er die Änderung isoliert sieht.


## Zug-Animation braucht ZWEI Zustände (v930)

Der Hand-Diff-Melder des Clients erkennt einen Zug daran, dass die Hand
WÄCHST und gleichzeitig ein Stapel schrumpft — und dafür braucht er zwei
getrennte Zustände: einen vor und einen nach dem Zug.

**`showTriggeredEffect` liefert den nicht.** Es sendet nur ein Ereignis
(`card_reveal`) und wartet 250 ms; einen `sync()` macht es NICHT. Wer
den Auftritt für den Zwischenstand hält, zieht ins Leere.

Deshalb bei einem Zug aus einem Hook ausdrücklich:

```js
engine.sync();                 // Ausgangslage rausschicken
await engine._delay(180);      // der Client soll sie verarbeiten
await engine.actionDrawFromPotionDeck(pi, 1);   // synchronisiert seit v927 selbst
```

Alchemy braucht das nicht, weil ihr Zug am Ende einer Ability-Aktivierung
steht — der Server hat den Vorzustand dort ohnehin schon geschickt.

## `play_ram_animation` kann auch aus einer Support Zone starten (v930)

Der Dash ist nicht auf Helden beschränkt: mit `sourceZoneSlot` schaltet
der Client von der Heldenzone auf die Kreaturenzone um
(`[data-support-zone]` statt `[data-hero-zone]`). Thuly fliegt damit
selbst ins Ziel, statt dass der Schnitt aus dem Nichts erscheint —
dieselbe Inszenierung wie bei Sword in a Bottle: Dash, 150 ms bis zum
Aufprall, dann die Trefferanimation NUR auf dem Ziel.


## `modifyAmount` verstärkt, `afterResourceGain` legt NACH (v931, Als Vorgabe 12.9.)

Humby („you may gain 15 additional Gold") hing an `onResourceGain` und
meldete den Zuschlag über `ctx.modifyAmount(15)` an. Das ist Punkt vor
Strich — richtig für einen VERSTÄRKER, aber hier falsch: der Spieler sah
einen einzigen Gewinn von X+15 statt zweier Ereignisse.

Die Trennlinie:

| Kartentext | Hook | Mittel |
|---|---|---|
| „gain X **more/additional** Gold **instead**", „+50 damage" — verändert den laufenden Betrag | `onResourceGain` / Schadens-Hooks | `ctx.modifyAmount(n)` |
| „gain X **additional** Gold" als eigener Vorgang | `afterResourceGain` | `engine.actionGainGold(pi, n)` |

`afterResourceGain` feuert, wenn das ursprüngliche Gold schon gelandet
ist; ein `actionGainGold` dort ist ein zweiter, sichtbarer Gewinn und
löst seinerseits die Gold-Trigger aus — was richtig ist, denn er IST ein
Gewinn durch einen Effekt.

**Keine Endlosschleife:** der eigene Zuschlag feuert den Hook erneut,
aber die Ladung des Zuges ist dann schon verbraucht und der zweite
Durchlauf steigt bei `usesLeft` aus. Wer diesen Bau ohne
Rundenzähler nachahmt, braucht eine andere Sperre.


## Neue Karte: „Explosive Drone" (v932)

Creature / **Reaction** (Subtype in cards.json von `Normal` geändert),
Lv 0, 10 HP, Summoning Magic.

**Auslöser (Hand):** jedes ZIEL zählt — Held ODER Creature. Die Karte
hängt deshalb an BEIDEN Tod-Fenstern (`onCreatureDeath`, `onHeroKO`) mit
derselben Bedingung: das Opfer gehört MIR, die Quelle dem Gegner. Eigene
Opferungen, Rückstoß und Statusschaden ohne Verursacher lösen nicht aus.
Bauart wie Doomed Town Guard und Chaorc Rider Warg: Bestätigung →
Zonenwahl → `summonCreatureWithHooks`.

**Kein `isReaction: true`** — das meldet eine Karte im generischen
Kettenfenster bei JEDEM Kartenspiel als spielbar (Lehre aus Pawn Chain,
v830). Der Auslöser ist der eigene Hook. Das gilt für alle
Reaction-Creatures im Bestand.

**Unterschied zu Doomed Town Guard:** dort steht „one or more targets",
also EIN Prompt für ein ganzes Sterbe-Ereignis — mit Klammer über den
Spielerzustand (`_dtgSummonedForDeath`). Hier steht „a target", jeder Tod
ist sein eigener Auslöser. Eine Klammer gibt es deshalb bewusst nicht;
gegen doppelte Beschwörung genügt die Handprüfung.

**„as an additional Action":** die Beschwörung läuft über den Hook, nicht
über den Aktionsweg — sie verbraucht die Zug-Aktion ohnehin nicht. Kein
`inherentAction`-Flag nötig, das gilt dem regulären Ausspielen aus der
Hand.

**Ein Hook, zwei Rollen.** `onCreatureDeath` trägt hier beide Hälften der
Karte: auf der HAND ist ein fremder Tod der Auslöser, in der SUPPORT ZONE
ist der EIGENE Tod die Detonation. Die Weiche ist `ctx.cardZone`, und im
Support-Zweig steht zusätzlich der Identitätsvergleich
(`ctx.creature.id === ctx.card.id`) — sonst detoniert die Drohne beim Tod
jeder anderen Kreatur (die `onCardLeaveZone`-Falle aus v925, nur in Grün).


## ★ `onCreatureDeath` LIEFERT KEINE INSTANZ (v933, Als Befund 12.9.)

Explosive Drone detonierte nie. Der Grund ist eine Feinheit, die man
genau einmal falsch macht:

```js
if (tot.id !== ich.id) return;            // ← FALSCH, immer wahr
if ((tot.instId ?? tot.id) !== ich.id) return;   // richtig
```

Der Hook übergibt unter `creature` **kein Instanzobjekt**, sondern einen
`deathInfo`-Schnappschuss: `{ name, owner, originalOwner, heroIdx,
zoneSlot, instId }`. Die Kennung heißt dort **`instId`**, nicht `id` —
`tot.id` ist `undefined`, der Vergleich schlägt immer an, und die Karte
steigt aus. Vorbild ist Exploding Skull, das genau so vergleicht.

Und wieder war mein Prüfstand mitschuldig: er reichte die Instanz selbst
durch und bestätigte damit ein Verhalten, das es in der Engine nicht
gibt. Jetzt schickt er einen echten `deathInfo`.

## Reaktions-Beschwörungen flogen nicht (v933)

Der reguläre Spielweg sendet den Flug Hand → Support Zone im Server. Der
HOOK-Weg tat es bei **keiner** Reaktions-Kreatur — die Karte erschien
ohne Bewegung in der Zone. Betraf Explosive Drone, Doomed Town Guard und
Chaorc Rider Warg gleichermaßen.

`summonCreatureWithHooks` nimmt dafür jetzt `opts.fromHandIdx`: ist er
gesetzt, geht ein `play_pile_transfer` von diesem Handplatz in die
Zielzone raus. Der Aufrufer nimmt die Karte ohnehin vor dem Beschwören
aus der Hand und kennt den Index. Ohne den Parameter ändert sich nichts,
Beschwörungen aus Deck oder Ablage bleiben also unberührt.

**Der Parameter wirkt NICHT automatisch** — jede Karte muss ihn
durchreichen. Stand v934:

| Reaction-Creature | Weg | Flug |
|---|---|---|
| Explosive Drone | Hook | ✓ |
| Doomed Town Guard | Hook | ✓ |
| Chaorc Rider Warg | Hook | ✓ |
| Elven Rider | Hook | ✓ |
| Rebelliokai Courtly Kirin | Kettenweg (`isReaction` + `resolve`) | offen |

**Kirin läuft anders** und braucht `fromHandIdx` gar nicht: sie trägt
`isReaction: true`, wird also über das Kettenfenster aus der Hand
gespielt, und die Engine verbraucht die Handkarte selbst — der Index
wäre zum Zeitpunkt ihres `summonCreatureWithHooks` bereits bedeutungslos.
Ob dieser Weg den Flug sendet, ist NICHT geprüft; Kirin trägt zusätzlich
`skipPostResolveDiscard`, geht also nicht den üblichen
Hand→Ablage-Flug. Wer dort eine Lücke vermutet, prüft den Kettenweg,
nicht diesen Parameter.

Die drei Reaction-Creatures ohne Skript (Enhanced Guard Dog, Front
Soldier, Wendy) brauchen ihn beim Bau.


## Neue Karte: „Friedhelm, the Misled Avenger" (v935)

Hero, 400 HP / 100 ATK, Hunting + Hunting. Für die Aktion des Zuges eine
Attack oder einen Spell AUS DEM DECK spielen, als käme die Karte von der
Hand — die dann aber nur 1 Ziel treffen darf. Und: höchstens 1 Aktion je
Zug.

**Aus dem Deck spielen** gibt es im Bestand sonst nirgends. Der Weg ist
aus vorhandenen Stücken gebaut:

1. Galerie über die Attacks/Spells im eigenen Deck, gefiltert mit
   **`engine.heroMeetsLevelReq(pi, hi, cd)`** — genau der Prüfung, die
   auch `getHeroPlayableCards` benutzt (mit `levelOverrideCards`,
   `bypassLevelReq`, Performance und Wisdom). Ohne sie böte die Karte
   Züge an, die der Server danach ablehnt — und die Karte wäre aus dem
   Deck heraus und die Aktion weg.
2. **`_castSpellImmediately(pi, heroIdx, name, { fromZone: 'deck',
   pool: ps.mainDeck, poolIndex, by })`** — dieselbe Brücke, die die
   Sofortaktion intern benutzt, nur direkt gerufen. Sie kann das DECK
   als Quelle von Haus aus (`fromZone: 'deck'`, mit `pileOutAllowed`-
   Prüfung), und es läuft der ganze normale Spielweg: Zielwahl,
   Reaktionsfenster, Kosten, Auflösung.

**Kein Umweg über die Hand, kein zweiter Dialog** (Als Vorgabe 12.9.).
Der erste Anlauf legte die Karte auf die Hand und rief
`performImmediateAction` mit `cardNameFilter` — funktional richtig, aber
der Spieler landete in einem Picker, in dem er die Karte noch einmal
ausspielen musste. Direkt ist besser: ein Klick in der Galerie, dann
sofort die Zielwahl der Karte.

**Die Zielwahl ist nicht abbrechbar.** Dafür gibt es
`engine._forceNonCancellable` (v741) — ein ZÄHLER, kein Schalter, damit
verschachtelte Auflösungen sich nicht gegenseitig freigeben.
`promptEffectTarget` und `promptGeneric` lesen ihn und überschreiben
`cancellable`. Hoch- und runterzählen gehört in ein `try/finally`.

**`forcesSingleTargetAny` (neu)** — dieselbe Maschinerie wie Idas
`forcesSingleTarget`, aber ohne die Beschränkung auf Destruction Spells.
Beide Leser (`promptMultiTarget`, `actionAoeHit`) kennen jetzt beide
Flaggen; Idas bleibt typgebunden. Die Flagge steht NUR während dieser
einen Auflösung und wird im `finally` abgeräumt — auch nach Abbruch oder
Fehler. Bliebe sie stehen, wären auch normal gespielte Karten des Helden
einzelzielig.

**„Can never perform more than 1 Action per turn"** ist ein vorhandener
Engine-Vertrag: `hero._maxActionsPerTurn = 1` im `onGameStart`, gelesen
an drei Stellen (Aktivierungslisten, Spielbarkeit, Sofortaktionen).
Denselben Weg nimmt „Sol Rym, the Thunder Djinn".

**Zwei geratene APIs, beide vor dem Ausliefern gefunden:**
`engine.canHeroPlayCard` existiert nicht (das ist eine CLIENT-Funktion) —
richtig ist `heroMeetsLevelReq`. Und `promptCardGallery` hängt am **ctx**
(`_createContext`), nicht an der Engine; `engine.promptCardGallery` ist
`undefined` und hätte beim ersten Einsatz geworfen.

**★ GALERIE-EINTRÄGE SIND OBJEKTE, KEINE STRINGS** (Als Befund 12.9.).
`promptCardGallery` erwartet `[{ name, source?, cost?, … }]` und gibt
`{ cardName }` zurück. Mit nackten Strings öffnet sich die Galerie und
bleibt **leer** — die Karte sah aus, als fände sie nichts im Deck,
obwohl die Kandidatenliste voll war. Der Doc-Block steht nur bei
`promptCardGalleryMulti`; für die Einzelvariante gilt dasselbe.

Das ist die verräterischste Ausprägung dieser Fehlerklasse: kein
Absturz, keine Log-Zeile, nur ein leeres Fenster. Vorbilder mit
korrekter Form: `_cycling-demons-shared.js`
(`entries.push({ name, source: 'discard' })`), Barker, Cloudy Slime.

**AoE-Karten gehören ausdrücklich dazu** (Als Ruling 12.9.): sie werden
angeboten und treffen dann — wie bei Ida — nur ein Ziel. Der Filter
schließt sie deshalb NICHT aus; das erledigt
`forcesSingleTargetAny` zur Auflösung.


## Deck-Cast: Flug in die Ablage (v938, Als Befund 12.9.)

Eine über `_castSpellImmediately` mit `fromZone: 'deck'` gespielte Karte
landete am Ende still in der Ablage. `deck_search_add` zeigt sie am
Anfang, danach verschwand sie ohne Bewegung. Aus der HAND braucht es das
nicht — dort sieht man sie die Hand verlassen.

Die Brücke sendet jetzt selbst `play_pile_transfer` mit
`from: 'deck', to: 'discard'` — vor dem Ablegen, nach dem Abbruchzweig
(ein abgebrochener Cast fliegt nicht). `from: 'deck'` kennt der Client
längst; Vorbild ist `_cybug-shared.js` (Deck → Deleted). Gilt für jeden
Deck-Cast, nicht nur für Friedhelm.

## Altfehler nebenbei: netbench-Bericht starb in der temporalen Todeszone

Der Selfplay-Lauf meldete `ReferenceError: Cannot access 'cpuAlle'
before initialization` — ein Fehler im Berichtsteil von
`runNetBenchmark`, nicht in der Engine.

Der Fix von v378 hatte sieben Deklarationen aus `diagnoseDrucken()`
herausgezogen, aber nur bis HINTER den Null-Partien-Zweig. Der ruft
`diagnoseDrucken()` jedoch VORHER, und `let` ist bis zu seiner
Auswertung in der temporalen Todeszone. Ergebnis: der Bericht starb
ausgerechnet in dem Fall, für den die Diagnose gebaut wurde — wenn
keine Partie sauber durchkommt.

Dieselbe Verwechslung wie damals, nur eine Ebene früher: die FUNKTION
ist hoisted, ihre `let`-Variablen sind es nicht. Deklarationen stehen
jetzt vor dem `if (gewertet === 0)`.

**Beim Verschieben prompt in die zweite Falle getappt:** der erste
Anlauf setzte den Block INNERHALB des if-Zweigs — damit waren die
Variablen für den ganzen Rest der Funktion weg. `check-scope` hat das
sofort gemeldet (22 Stellen in einer Datei); ohne den Wächter wäre es
erst beim nächsten vollständigen Lauf aufgefallen.


## Deck-Cast: Auftritt der gespielten Karte (v939, Als Vorgabe 12.9.)

Beide Spieler sollen sehen, WAS aus dem Deck kommt. Friedhelm streamt
deshalb den Standard-Auftritt der GEWÄHLTEN Karte
(`showTriggeredEffect(name, { playerIdx: pi })`), zusätzlich zu dem
Auftritt, den der Held für seine eigene Aktivierung ohnehin bekommt.

**`deck_search_add` ist etwas anderes** — eine Suchanzeige, die
`_castSpellImmediately` im Deck-Zweig sendet, kein Auftritt links vom
Battlefield.

**Zum Zeitpunkt:** die Regel lautet „erst nach dem Commit". Hier ist die
GALERIE-WAHL der Commit — die folgende Zielwahl ist über
`_forceNonCancellable` nicht abbrechbar, es gibt also keinen Weg zurück.
Ein Abbruch in der Galerie zeigt dagegen nichts; eine eigene Zusicherung
prüft genau das.

Der Auftritt steht bewusst in der KARTE und nicht in
`_castSpellImmediately`: dort dürfte er nicht stehen, weil andere
Aufrufer (die Sofortaktion aus der Hand) eine abbrechbare Zielwahl
haben — ein Auftritt davor würde eine Karte zeigen, die nie auflöst.


## Neue Karte: „Realmniversal Emperor" (v940)

Creature, Summoning Magic Lv 3, 100 HP. „When this Creature is defeated,
deal 150 damage to all Heroes your opponent controls. You can only use
this effect of \"Realmniversal Emperor\" once per turn."

**Das Once-per-turn ist HART** (Als Vorgabe 12.9.) — der Wortlaut „You
can only use this effect … once per turn" ist die harte Form, also je
SPIELER einmal je Zug, nicht je Instanz. Sterben zwei Emperors derselben
Seite in einer Runde, feuert der zweite schlicht nicht mehr: still, ohne
Prompt, ohne Auftritt. `engine.claimHOPT('realmniversal-emperor', pi)`
macht genau das (Schlüssel `<key>:<pi>`, Rücksetzung am Zugwechsel
automatisch). Beide SEITEN haben eigene Zähler — stirbt je ein Emperor
bei beiden Spielern im selben Zug, feuern beide. Gleiche Auslegung wie
Exploding Skull und Icy Slime.

**Keine Geschwister-Marke nötig.** Exploding Skull stempelt zusätzlich
ein `_explodingSkullSuppressed` auf alle anderen Skulls derselben Seite,
um den Tod mehrerer Karten in EINEM Schadens-Batch abzudecken. Hier
reicht das HOPT: beide Todeswege (`actionMoveCard` und
`processCreatureDamageBatch`) laufen die Hooks je Sterbefall sequenziell
mit `await` durch, der Anspruch des ersten liegt also, bevor der zweite
seinen Hook betritt. Im Repro nachgewiesen (zwei Emperors, ein Batch, ein
Schlag). Und der eigene Schaden trifft nur HELDEN — er kann gar keinen
zweiten Emperor in denselben Batch ziehen.

**Flächenschaden über `engine.actionAoeHit(ich, { side: 'enemy', types:
['hero'] })`** statt einer eigenen Schleife. Der Trichter entscheidet
über `heroSideOf` an der SEITE, nicht an der Spalte: ein per Charme oder
dauerhafter Übernahme vom Gegner kontrollierter Held der eigenen Spalte
gehört zu „Heroes your opponent controls" und wird getroffen, ein von mir
übernommener Gegnerheld dagegen nicht (Als Ruling 4.9. zu Flame
Avalanche). Dazu Shielded-Filter, Surprise-Fenster, Animation und
Schadens-Hooks in einem Durchgang. Die sterbende Instanz taugt als
`cardInst` — `controller` und `heroIdx` stehen zum Hook-Zeitpunkt noch.

**Anspruch erst nach der Zielprüfung.** Kontrolliert der Gegner keinen
lebenden Helden, bleibt das Once-per-turn für den Rest des Zuges frei
(Exploding-Skull-Muster).

**`onDeathBenefit` als Funktion** (Bunny-Bombs-Form): 0, solange das HOPT
in diesem Zug schon verbraucht ist — sonst würde die CPU einen zweiten
Emperor in derselben Runde als Opferfutter verheizen, obwohl er nichts
mehr auslöst. Sonst `25 × lebende Gegnerhelden + 35 × tödlich getroffene`,
gedeckelt bei 140. Dazu `preferDead: true`.

**Client-Fall nicht vergessen:** `realmniversal_blast` steht in
`formatLogEntry`. Bei der Gelegenheit hat auch `exploding_skull_blast`
endlich einen bekommen — die Zeile wurde seit jeher geschrieben und war
nie sichtbar.


## Neue Animation: `cosmic_distortion` (v941, Als Vorgabe 12.9.)

Die Todeswelle des Realmniversal Emperor. Zwei Hälften, die zusammen
erst den Eindruck machen:

1. **Spiralgalaxie über der Heldenkarte** — eine gekippte Scheibe aus
   drei weichen Armen (`filter: blur`), die sich dreht und am Ende in
   sich zusammenfällt, dazu ein gleißender Kern, 22 einstürzende Sterne
   und ein Verzerrungsring, der auf dem Höhepunkt nach außen läuft. Die
   KIPPUNG steht als statisches `rotateX(58deg)` im Stil, gedreht wird
   nur im Keyframe — die Regel „Keyframes bewegen ausschließlich
   `transform` und `opacity`" bleibt damit gewahrt.

2. **Die Karte selbst wird verzerrt.** Die Komponente hängt der
   nächstgelegenen Heldenzone die Klasse `cosmic-warped` an und nimmt
   sie nach 950 ms wieder ab (Muster `whirlwind_spin` /
   `stranglehold_squeeze`). `cosmicWarp` schert, staucht und kippt die
   Karte durch fünf Stationen und endet wieder bei `transform: none`.

**★ Die Klasse trifft die KINDER der Zone, nicht die Zone** —
`.cosmic-warped > *`. Die Layoutbox von `[data-hero-zone]` geht in die
Positionsrechnung der Area Zones ein; verformt man den Wrapper selbst,
driften die Area Zones mit. Genau diese Lehre steht schon bei
`.escape-dodging > *` im CSS. Für jede künftige Karten-Verformung einer
Heldenzone gilt sie mit.

**Klang** (`ZONE_ANIM_SFX`, zweiteilig): `elem_dark` tief und sofort =
das Aufreißen, `ddg_manifest` bei 320 ms = der Verzerrungsschlag. Der
erste Teil läuft in der Sammelkategorie `'effect'` und fällt damit bei
mehreren gleichzeitig getroffenen Helden von selbst zu EINEM Klang
zusammen. Der zweite braucht deshalb `category: null` — sonst
verschluckt ihn die eigene erste Lage — und stattdessen ein
`dedupe: 700` über den NAMEN, sonst spielt er bei drei Helden drei Mal
übereinander. **Das ist die Bauform für jede mehrlagige Animation, die
auf mehreren Zielen gleichzeitig läuft**: erste Lage über die Kategorie,
alle weiteren über Namens-Dedupe.

**`animDelay` gehört zur Animation.** `actionAoeHit` wartet zwischen
Animation und Schaden standardmäßig 300 ms; hier hat die Verzerrung
ihren Höhepunkt erst bei ~480 ms, deshalb `animDelay: 520` im
Kartenskript. Ohne das fällt der Schaden, bevor die Karte verzogen ist.


## Neue Karte: „Wavilion" (v942)

Creature, Summoning Magic Lv 0, 50 HP, **banned** (kein Grund, sie nicht
zu bauen — Als Regel 17.8.). „When the corresponding Hero defeats a
target with an Attack, permanently increase its Attack stat by 100
afterwards."

**„its" ist der entsprechende Held**, nicht das Ziel — das ist ja gerade
besiegt worden. Und „corresponding Hero" heißt wie immer: der Held, in
dessen Support Zone die Karte liegt (Vokabular-Ruling 8.8.).

**★ DAUERHAFT heißt hier wirklich dauerhaft** (Als Vorgabe 12.9.): der
Zuwachs bleibt, auch wenn Wavilion das Brett verlässt. Deshalb
`engine._applyHeroAtkDelta(hero, pi, heroIdx, +100)` und **nicht**
`ctx.grantAtk`. Der Unterschied ist die Buchführung:

| | `actionGrantAtk` / `ctx.grantAtk` | `_applyHeroAtkDelta` |
|---|---|---|
| schreibt `counters.atkGranted` | ja | nein |
| per `revokeAtk` rücknehmbar | ja | nein |
| Curse-Unterdrückung | ja | ja |
| `fighting_atk_change` | ja | ja |

Die Engine widerruft **nichts von allein** — nur Karten, die `revokeAtk`
selbst rufen (jede Ausrüstung in ihrem `onCardLeaveZone`), nehmen etwas
zurück. Wavilion tut das bewusst nie und trägt deshalb auch kein
`onCardLeaveZone`. Vorbild: Nero Zira.

**Auslöser „besiegt ein Ziel mit einem Angriff"** ist die Bauform von
Explosivo's Sword, derselbe Satz: Held als Ziel über `afterDamage`
(`type === 'attack'`, Quelle = der entsprechende Held, `target.hp <= 0`),
Creature als Ziel über `afterCreatureDamageBatch` (je Eintrag dieselben
Tore plus `inst.counters.currentHp <= 0`). `source.zone === 'support'`
hält Kreaturen draußen, die im selben Slot sitzen und denselben
`heroIdx` tragen.

**EINMAL JE ANGRIFF, nicht je besiegtem Ziel.** Ein Flächenangriff, der
drei Ziele umlegt, gibt +100. Die Marke hängt an der QUELLENINSTANZ des
Angriffs — dieselbe Identität, die die Engine für ihre eigene
Angriffs-Entprellung benutzt (`source._attackDeclareFired`, und im
Schadens-Batch ein Set über die eindeutigen Quellen). Der Schlüssel
enthält die KARTEN-ID (`_wavilionFired_<id>`): zwei Wavilions beim
selben Helden geben je 100, denn der Text kennt keine Einmal-Klausel.

**★ `cpuMeta.cpuInstBonus` MUSS EINE FUNKTION SEIN.** Die Schleife in
`evaluateState` prüft `typeof fn !== 'function'` und überspringt alles
andere — eine blanke Zahl ist eine tote Anmeldung. Im Bestand gibt es
genau einen solchen Fall: `disgruntled-forest-warden.js` deklariert
`cpuInstBonus: 20` und hat seit jeher nichts bewirkt. NICHT
mitkorrigiert, weil das Aktivieren eines nie wirksamen Bonus eine
Balance-Änderung wäre, keine Reparatur — Al entscheidet.


## Neue Animation: `water_blessing` (v943, Als Vorgabe 12.9.)

Wavilions Zuwachs. Als Vorgabe: ein **buffender** Wasserzauber auf dem
Helden — kein Treffer, kein Aufprall. Das Wasser steigt hinter der Karte
auf (Säule mit `scaleY` aus dem Boden), drei Schaumkronen laufen sie
hoch, 16 Blasen treiben mit, **Wavilion selbst schwimmt als Fisch im
Bogen nach oben** (zwei 🐟-Glyphen, der zweite gespiegelt und später),
und oben setzt sich der Segen als heller Ring plus Aufleuchten ab.

**Der Zuwachs fällt NACH dem Aufstieg** (`_delay(620)` im Kartenskript,
danach `_applyHeroAtkDelta`): die Zahl springt dann zum abgesetzten
Segen hoch und nicht davor. Dieselbe Überlegung wie `animDelay` bei
`cosmic_distortion`, nur hier von Hand, weil der Zuwachs nicht über
`actionAoeHit` läuft.

**Klang** (zweiteilig, gleiche Bauform wie `cosmic_distortion`):
`elem_water` sofort für die Säule, `buff` bei 500 ms für den Segen. Die
erste Lage läuft in der Sammelkategorie `'effect'`, die zweite mit
`category: null` und Namens-Dedupe — sonst schluckt die erste die
zweite, und bei zwei Wavilions beim selben Helden klänge der Segen
doppelt.

**Dauer über die Nutzlast.** `onZoneAnim` spreizt alle Extrafelder des
`play_zone_animation` in die Animationsoptionen, deshalb setzt die Karte
`duration: 1200` direkt im Broadcast (Standard wären 1000 ms, und die
Komponente läuft 1140 ms).


## Neue Karte: „Aquanian Orkallion" (v944)

Creature, Summoning Magic Lv 1 (Al hat das Level in cards.json von 2 auf
1 gesetzt), 100 HP. „When you summon this Creature, you may search your
deck for an Area and bring it into play, regardless of its level. When
this Creature leaves the board, destroy all Areas on the board."

**Auslöser der Beschwörung:** `onPlay` mit `playedCard === self` in der
Support Zone — **ohne** das `_isNormalSummon`-Tor der Tamed-Karten. Die
sagen „summoned via an effect", Orkallion sagt schlicht „when you
summon": Handbeschwörung, Effektbeschwörung und Platzieren zählen alle.

**★ `isTutorableArea` hat jetzt eine bewegliche Schwelle.** Planet in a
Bottle, Reality Crack und Cooldin sagen wortgleich „a level 3 or lower
Area"; Orkallion sagt „regardless of its level". Der REST der Regel ist
identisch (Typ Spell/Attack/Creature, Subtyp Area, und die Karte muss
überhaupt ein Level HABEN — sonst zöge man Smuggler's Pier). Deshalb ist
nur die Schwelle in `_area-shared.js` zum Parameter geworden:
`isTutorableArea(cd, engine, pi, { maxLevel: Infinity })`. Die drei
Altnutzer bleiben unverändert bei 3. Der Level-EXISTENZ-Riegel bleibt in
jedem Fall stehen: „regardless of its level" setzt ein Level voraus, es
hebt den Begriff nicht auf.

**„bring it into play"** läuft exakt wie bei Reality Crack: Instanz
anlegen, den EIGENEN `onPlay` der Area über `_onlyCard` feuern (jede Area
legt sich selbst in die Zone, v903), und nur falls das ausbleibt, per
`placeArea` nachhelfen. So laufen Selbstlege-Vertrag,
Hintergrund-Schichtsystem und Platzierungs-Surprises normal mit.

**EINE AREA JE SPIELER** (Regelwerk): kontrolliert der Beschwörer schon
eine, wird gar nicht erst gesucht — dasselbe Tor, das
`getHeroPlayableCards` beim Ausspielen einer Area aus der Hand zieht
(`areaZones[pi].length > 0`). Der Effekt ist ein „you may" und darf
folgenlos verpuffen. **Al kann das anders rulen** (Ersetzen statt
Aussetzen wäre `placeArea(..., { replaceExisting: true })`).

**Abgang:** `onCardLeaveZone` mit dem Selbsttest aus v925
(`leavingCard.id !== card.id` → raus) und `fromZone === 'support'`. Der
eine Hook deckt beide Wege ab, über die eine Kreatur das Brett verlässt
— den Schadens-Batch (`_onlyCard` vor `onCreatureDeath`) und
`actionMoveCard` (Opferung, Rückgabe auf die Hand, Löschen). Zerstört
werden ALLE Areas, auch die eigene und die gerade selbst geholte.

**CPU:** die Galerie ist abbrechbar, und abbrechbare Prompts bricht die
Engine für die CPU grundsätzlich ab, wenn das Skript keine `cpuResponse`
liefert (Befund v828). Ohne den Eintrag wäre der Sucheffekt für jeden
CPU-Gegner tot. Gewählt wird die Area mit dem HÖCHSTEN Level.

## Neue Animation: `maelstrom` (v944, Als Vorgabe 12.9.)

Ein riesiger Strudel über dem GANZEN Spielfeld, bei beiden Ereignissen
der Karte: wenn die Area hochkommt und wenn sie weggerissen wird.

**`zoneType: 'board'`** ist der Kanal dafür (v580, Doomsday Bomb): die
Animation hängt an keiner Zone, `w`/`h` sind das Brett statt einer
Karte, und alles skaliert daran (`durch = min(breite × .98, höhe × 2)`).
`owner` ist bedeutungslos — es gibt nur ein Kampffeld.

Aufbau wie bei der Galaxie: die Scheibe ist STATISCH gekippt
(`perspective(900px) rotateX(58deg)`), gedreht wird nur im Keyframe.
Fünf Ringe laufen gegenläufig mit unterschiedlichen Drehzahlen —
**gestrichelte Ränder lassen die Drehung überhaupt erst sehen**, ein
gleichmäßiger Ring sieht rotierend aus wie stehend. In der Mitte saugt
der dunkle Trichter, außen fliegt Gischt weg.

**Klang:** `elem_water` tief (rate 0.5) sofort für das Aufreißen,
`elem_wind` bei 620 ms für den Sog — zweite Lage wie immer mit
`category: null` und Namens-Dedupe.

**Laufzeit über die Nutzlast:** `duration: 2000`, sonst hängt die
Komponente nach 1000 ms ab (die Standard-Lebensdauer von
`play_zone_animation`) und der Strudel verschwindet mitten im Lauf —
dieselbe Falle, die Cataclysm im Kommentar festhält.


## ★ „SPELL SCHOOL ABILITY" — DIE FÜNF, ZENTRAL (Als Vorgabe 12.9., v945)

Genau fünf Ability-Karten sind Zauberschulen: **Decay Magic,
Destruction Magic, Magic Arts, Summoning Magic, Support Magic.**
Fighting ist keine (das Regelheft nennt sie ausdrücklich „die einzige
Nicht-Zauberschule"), und die Nutz-Abilities (Adventurousness, Luck,
Wisdom, Performance …) sind es auch nicht — Performance zählt beim
LEVEL als Joker mit, ist aber selbst keine Schule.

Die Liste steht jetzt EINMAL, in `_hooks.js`:

```js
const { SPELL_SCHOOL_ABILITIES, spellSchoolAbilitiesOn } = require('./_hooks');
spellSchoolAbilitiesOn(abZones)                       // Namen an EINEM Helden
spellSchoolAbilitiesOn(abZones, teilmenge)            // eingeschränkt
```

Cosmic Skeleton hatte sie bis v944 als eigenes Array im Skript
(`['Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic']`)
und leitet sie jetzt ab: `SPELL_SCHOOL_ABILITIES.filter(s => s !==
'Summoning Magic')` — sein Text sagt „except Summoning Magic". Verhalten
unverändert, im Repro gegengeprüft. Jede künftige Karte mit „Spell
School Ability" im Text liest diese Liste, nie eine eigene.

## Neue Karte: „Sarcophagus of Sealed Magic" (v945)

Creature, Summoning Magic Lv 1, 60 HP. „You may once per turn choose a
target and deal damage equal to 60 times the number of Spell School
Abilities with different names attached to your undefeated Heroes to
it."

**Gezählt werden NAMEN, nicht Karten und nicht Stapel.** Dreimal Decay
Magic auf einem Helden ist EINS; Decay Magic auf zwei Helden ist auch
EINS. Höchstwert also 5 × 60 = **300**. „undefeated Heroes" = HP > 0,
gezählt auf der SEITE der Kreatur (`physicalSide`), damit eine
übernommene Kreatur die Party ihres Kontrolleurs liest.

**Kein Zustand am Wirtshelden.** Anders als Cosmic Skeleton („if the
corresponding Hero … is not defeated") stellt dieser Text keine
Bedingung an den Slot-Helden — Kreaturen sind von ihm unabhängig, der
Sarkophag feuert auch aus der Zone eines gefallenen Helden.

**Gesperrt bei 0 Schulen** (`canActivateCreatureEffect`): der Effekt
würde 0 Schaden machen und die weiche Einmal-Nutzung verbrennen.

## Strahlensystem: seitlicher Versatz `offset` (v945)

Als Vorgabe waren **zwei dünne rote Laser** statt Cosmic Skeletons einem
dicken. Zwei `play_beam_animation`-Broadcasts mit denselben Endpunkten
lägen aber deckungsgleich übereinander — man sähe einen Strahl.

`onBeamAnimation` kennt deshalb jetzt **`offset`**: Pixel quer zur
Flugrichtung, Vorzeichen = Seite. Verschoben werden BEIDE Endpunkte
(Start und Ziel), damit die Strahlen parallel laufen statt zu
divergieren. Der Sarkophag feuert mit `+7 / −7` und `thickness: 2`.
Ohne das Feld ändert sich für jeden bisherigen Aufrufer nichts.

**Der Klang bleibt einer:** das Strahlensystem spielt `laser` selbst,
mit `dedupe: 60` und der Sammelkategorie `'effect'` — der zweite Strahl
fällt von allein still. Kein ZONE_ANIM_SFX-Eintrag nötig, Beams laufen
nicht über diese Tabelle.

**Selbstziel** bleibt beim `laser_burst` in alle Richtungen (Cosmic-
Skeleton-Muster) — ein Strahl von der Karte auf sich selbst hätte die
Länge 0.


## Neue Reihe: „Spices" — DECKBAU-Karten ohne Effektskript (v946)

Fünf Artefakte (Secret Blue / Golden / Green / Red Spice, Secret Spice
Jar), alle Kosten 0, alle mit demselben Satz:

> „For every 2 copies of this card in your deck, your deck may contain a
> copy of \"X\" or \"Y\"."

**Sie bekommen KEIN `.js`.** Im Spiel tun sie nichts — die ganze Karte
ist eine Deckbauregel, und die lebt in `public/app-shared.jsx` bei
`getCardMax` / `canAddCard` / `trimOverLimitCopies`, zusammen mit den
Klauseln von The Sacred Jewel und Cecilia. Standard-Deckbauregeln werden
ausschließlich im CLIENT geprüft (die Serverroute `PUT /api/decks`
speichert, was sie bekommt; `validateDraftedDeck` gilt nur für den Cube
Draft) — dort gehört die Klausel also hin, und nur dorthin.

**★ DIE LESART (Al, 12.9., nach zwei Fehlversuchen): die Gewürze öffnen
das MAIN DECK.** Ins Potion Deck dürfen 2 Kopien jeder Potion ohnehin —
„your deck may contain" wäre dort kein Effekt. Ein Gewürz wirkt also wie
ein auf einzelne Namen beschränkter **Nicolas**: je 2 Kopien des
Gewürzes darf EINE Kopie einer der genannten Potions ins Main Deck (und
ist damit ziehbar). Der Platz ist geteilt — jede Kopie einer anderen
Potion derselben Liste IM MAIN DECK verbraucht ihn.

**Unverändert bleibt alles andere:** höchstens 2 Kopien je Potion über
Main- und Potion-Deck zusammen, höchstens 15 Potions insgesamt.
`getCardMax` für Potions steht deshalb wieder schlicht bei 2 — die
Klausel sitzt in `canAddCard` (Zweig `main`), nicht in der Kopiengrenze.

**Zwei Fehlversuche, beide lehrreich:**
* v946 las es als ZUSATZKOPIE oberhalb der 2 — falsch, die Grenze steht.
* v947 las es als ZUGANG ZUM DECK ALLGEMEIN (Potion Deck gesperrt ohne
  Gewürz) — falsch, dort war nie etwas gesperrt.
Für künftige „your deck may contain"-Klauseln also drei Möglichkeiten
durchgehen: hebt sie eine GRENZE an (Sacred Jewel, Cecilia), öffnet sie
eine ZONE (Spices, Nicolas), oder gibt sie überhaupt erst Zugang? Im
Zweifel: welche Lesart macht die Karte zu einem Effekt statt zu einer
Selbstverständlichkeit?

**★ GEWÜRZ-PLÄTZE ZÄHLEN NICHT GEGEN DIE 15 (Als Vorgabe 12.9.).**
Sonst gilt: höchstens 15 Potions über Main- und Potion-Deck zusammen.
Was über einen Gewürz-Platz im Main Deck liegt, ist davon ausgenommen —
mit Zamorin und 16 Gewürz-Artefakten liegen also 16 Potions im Main Deck
UND weiterhin 5–15 im Potion Deck (im Repro durchgespielt). Nur was
allein über Nicolas im Main Deck liegt, zählt normal mit.

Die Rechnung steht in `countedPotions(deck)` und `spiceExemptMainPotions(deck)`
und ist in sich schlüssig, weil `spiceMainDeckAllowance` die
Main-Deck-Kopien der ANDEREN Potions derselben Liste bereits abzieht:
die Summe der Befreiungen kann den Vorrat des Gewürzes nie
überschreiten. Beide Tore in `canAddCard` UND die Legalitätsprüfung
`isDeckLegal` lesen sie — sonst meldete die Prüfung ein legales Deck
als illegal.

**Auto-Aufräumen:** fällt ein Gewürz (oder Zamorin) aus dem Deck,
verlieren die freigeschalteten Potions ihren Platz im Main Deck.
`trimOverLimitCopies` schiebt sie dann ins Potion Deck, solange dort
Platz ist — dieselbe Rettung, die der Deck-Builder beim Entfernen von
Nicolas von Hand macht — und lässt sie sonst fallen.

**Die Tabelle wird aus dem KARTENTEXT gelesen**, nicht abgeschrieben:
jedes Artefakt mit Archetyp „Spices" und diesem Satz trägt seine Namen
in Anführungszeichen. Ein sechstes Gewürz wirkt damit ohne
Code-Änderung.

**Zamorin, the Spice Rajah** („Every \"Secret Spice\" Artifact you add to
your deck during deck building counts as two copies of itself for its
own effect") verdoppelt die Zählung — auch er ohne Skript, erkannt über
den Archetyp auf einem HELDEN im Team.

**★ Warum nicht über den Namen:** nach der Namensbezugs-Regel
(Teilstring im ganzen Kartennamen) träfe „Secret Spice" nur den „Secret
Spice Jar" — „Secret Blue Spice" enthält die Folge nicht. Gemeint ist
ersichtlich die ganze Reihe, deshalb entscheidet hier der ARCHETYP.
Das ist die erste Stelle, an der ein Namensbezug am Wortlaut scheitert;
bei künftigen Reihen mit Einschüben im Namen dasselbe prüfen.

**Trimmen inklusive:** fällt ein Gewürz aus dem Deck, stutzt
`trimOverLimitCopies` die Zusatzkopien automatisch zurück — der Aufruf
lag schon an jeder Entfern-Stelle, die Klausel hängt sich ohne weiteres
Zutun ein.

## Neue Karte: „Spice Mortar" (v946)

Artifact, Kosten 0. „Reveal the top 10 cards of your opponent's deck.
Add a Potion from among those cards to your hand, if possible. Your
opponent may shuffle their deck afterwards." Gehört NICHT zum Archetyp
„Spices" (leeres Feld) und ist keine Deckbaukarte — sie teilt nur den
Namen.

Gebaut nach **Enigma, the Seller of Secrets** (dieselbe Grundfigur):
`stealsOpponentCards: true` für die Boris-Sperre, Tore auf leeres
Gegnerdeck / eigene Handsperre / Erstzug-Schonung, Entnahme über
`play_pile_transfer` (Flug Deck→Hand) → `takeFromPile` →
`_tagHandCardOrigin` → Hook `onCardTakenFromOpponent`. Und
`blockedByPileLock: false`, weil der Zugriff auf das GEGNER-Deck keine
gesperrte Stapelbewegung ist (v826).

**„Reveal" an BEIDE Spieler geht nur über das Log.** Der Wirkende sieht
die zehn Karten in der Galerie; einen Anzeigekanal für zehn Karten an
den Gegner gibt es nicht — `deckSearchReveal` zeigt genau eine. Die
Logzeile `spice_mortar_reveal` listet sie deshalb vollständig (mit
eigenem Client-Fall in `formatLogEntry`, sonst wäre sie unsichtbar).

**„if possible" = Pflicht, wenn möglich:** liegt eine Potion darunter,
ist die Galerie nicht abbrechbar; bei genau einer Potion gibt es gar
keine Frage. **„may shuffle" ist die Entscheidung des GEGNERS** — die
Bestätigung geht an ihn, nicht an den Wirkenden, und `cpuResponse`
beantwortet beide Prompts (die CPU kann auf jeder der beiden Seiten
sitzen).


## Neue Karte: „Rakah, the Loan Shark" (v950)

Hero, 350 HP / **0 ATK**, Fighting + Occultism. „Whenever you sacrifice
a Creature you control with 150 or less HP, this Hero's Attack stat is
permanently increased by that Creature's current HP." (Die Schwelle
stand bis v950 bei 100 — Als Anpassung 12.9., in cards.json UND im
Skript.)

**Auslöser `onCreatureSacrificed`.** Die Engine führt in diesem Hook die
zentrale Opfer-Buchhaltung, jeder Weg, der ein Opfer darstellt, läuft
durch ihn — Rakah braucht also keine Kenntnis der auslösenden Karten.
Zwei Tore wie bei Sacrificial Dagger: die Kreatur gehört MEINER Seite
UND ich habe das Opfer gebracht (`ctx.source.owner`), sonst füttert ein
gegnerischer Effekt, der meine Kreatur opfert, auch noch meinen Helden.

**HP ist in beiden Satzhälften die AKTUELLE HP.** Die zweite sagt es
ausdrücklich („that Creature's current HP"), und nur so passen Schwelle
und Ertrag zusammen: was gemessen wird, ist auch das, was man bekommt.
Eine Kreatur mit 200 gedruckten, aber 60 verbliebenen HP zählt also und
bringt 60.

**★ DAUERHAFT GILT AUCH ÜBER DEN TOD** (Als Vorgabe 12.9.).
`_applyHeroAtkDelta` schreibt direkt auf `hero.atk`, ohne
Rücknahme-Zähler auf einer Karteninstanz — und es gibt in der Engine
keinen Weg, der das zurückdreht: `actionReviveHero` fasst `atk` nicht
an, und die einzigen Rückbuchungen (`actionRevokeAtk`, Ablauf von
`_tempAtkGrants`) rücken nur eigene, ausdrücklich gebuchte Gaben
zurück. Im Repro durchgespielt: 300 gesammelt → Rakah stirbt → 300 →
wiederbelebt → 300 → sammelt weiter.

**Während Rakah besiegt ist, sammelt er nicht** — der Zuhörer-Filter der
Engine lässt Karten an einem toten Helden grundsätzlich aus (Regelheft:
Effekte eines besiegten Helden sind negiert). Das bereits Angesammelte
bleibt davon unberührt. Kein Once-per-turn: drei Opfer in einem Zug
geben dreimal.


## ★ NEUES FENSTER `afterBleedDamage` (v951)

Bleed hatte bisher nur `beforeBleedDamage` — dort wird der BETRAG
verhandelt. Für „whenever a target takes Bleed damage" braucht es den
Moment DANACH. Beide Bleed-Wege der Engine feuern ihn jetzt mit
derselben Nutzlast, damit eine Karte nicht zwei Fälle braucht:

```js
{ bleedTarget: { kind: 'hero'|'creature', owner, heroIdx, inst? },
  amount,            // was tatsächlich ausgeteilt wurde
  after }            // 'spell' | 'attack' | 'creature' | 'hero_effect' | 'creature_effect'
```

Gefeuert in `_processBleedAfterAction` (Held nach einer Handlung) und
`_processBleedAfterCreatureEffect` (Creature nach ihrem Aktiveffekt),
jeweils NACH dem Schaden und vor dem abschließenden `sync()`.

## Neue Karte: „Shared Blood Tanks" (v951)

Spell / **Area**, Decay Magic Lv 1. „A Bleeding Hero may perform this
Spell regardless of its level. Whenever a target takes Bleed damage,
except from this effect, all other Bleeding targets its owner controls
also take Bleed damage."

**Level-Freigabe:** `canBypassLevelReq` ist der KARTEN-seitige Vertrag
dafür — das Gegenstück zu Sorins heldenseitigem
`canBypassLevelReqForCard`. Blutet der wirkende Held, fällt die
Anforderung ganz; bei einer Lv-1-Karte heißt „regardless of its level"
praktisch „ohne Decay Magic spielbar", denn ein Level unter 1 gibt es
nicht. Ein BESIEGTER Held kommt trotzdem nicht durch (der Dead-Hero-Zweig
in `heroMeetsLevelReq` fragt denselben Vertrag, das Skript verlangt
`hp > 0`).

**Bezugspunkt der Kette ist der BESITZER des getroffenen Ziels**, nicht
der Besitzer der Area — die Karte steht beiden Seiten im Weg. Blütet der
Gegner, trifft es seine Ziele.

**„except from this effect" ist Bauart, keine Flagge:** der Kettenschaden
wird vom Kartenskript selbst ausgeteilt und feuert `afterBleedDamage`
bewusst NICHT erneut. Damit ist auch der Doppelfall sauber: kontrollieren
BEIDE Spieler eine Kopie, löst der ursprüngliche Tick beide Ketten aus,
die Ketten selbst lösen nichts mehr aus. Der Auslöser nimmt dann seinen
einen Tick, die anderen blutenden Ziele je zwei (im Repro
nachgestellt: `[350, 300, 300]`).

**Der Kettenschaden ist echter Bleed-Schaden:** Betrag über
`engine._bleedDamageAmount` (also inklusive fremder
`beforeBleedDamage`-Änderungen), Typ `status`, ohne Zielwahl- und
Surprise-Fenster, Schilde greifen, kann töten. Vor jedem einzelnen
Schlag wird neu geprüft, ob das Ziel noch blutet — ein vorheriger Tick
kann es getötet haben.

**Area-Vertrag erfüllt:** `activeIn: ['hand','area']`, Selbstlegen im
`onPlay`, Hintergrund `SharedBloodTanksOverlay` (tier `partial`:
Glastanks am unteren Rand, durch einen Schlauch verbunden, aufsteigende
Blasen). `check-areas` grün.


## Neue Karte: „Hat of Madness" (v952)

Artifact / **Equipment**, Kosten **6** (stand bis v952 bei 10 — Als
Anpassung 12.9., in cards.json). „Whenever the equipped Hero performs an
Action, its controller must add a card from their hand to their
opponent's hand."

**★ WAS IST EINE „ACTION"?** `onAnyActionResolved` feuert in JEDEM
Aktionspfad — auch für Artefakte, Potions und kostenlose
Ability-Aktivierungen, die eben KEINE Aktion sind. Das Sieb dafür gibt
es in der Engine schon: **`_bleedTriggersForAction`**, die Auslegung
hinter Als Bleed-Regeln (3./4.9.) — Attack, Spell, Creature (auch als
Zusatz-, Inherent- oder Freiaktion), Heldeneffekt und Ability MIT
Aktionskosten. Genau diese Menge ist gemeint, deshalb wird sie
WIEDERVERWENDET statt nachgebaut: „was blutet, ist eine Handlung".
Kostenlose Heldeneffekte (Elana) erreichen den Hook ohnehin nie — sie
laufen daran vorbei direkt in den Bleed-Pfad. **Für jede künftige
„whenever … performs an Action"-Karte dieselbe Stelle nehmen.**

**„its controller" ist der Spieler, der den HELDEN kontrolliert** — also
der Handelnde, nicht der Besitzer des Hutes. Verglichen wird deshalb die
SEITE des Huts (`physicalSide`): an einen gegnerischen Helden
ausgerüstet zahlt der Gegner und der Besitzer bekommt die Karte (im
Repro nachgestellt).

**„must" ist Pflicht:** die Handkarten-Wahl ist nicht abbrechbar. Leere
Hand → nichts; gesperrte Gegnerhand → nichts (die Engine prüft das in
`actionTransferCardToOppHand` selbst, samt Reaktionsfenster für
Hand-Interaktionen). Die Übergabe läuft über dieses Primitiv, damit alle
Zuhörer mitfeuern (Mary Crestmas, Letter of Misinformations, Ambush the
Scout). Zwei Hüte am selben Helden feuern zweimal.

Der CPU-Responder für `pickHandCard` existiert bereits generisch
(zufälliger zulässiger Handplatz) — die Karte braucht kein eigenes
`cpuResponse`.


## Neue Karte: „Skullmael's Greatsword" (v953)

Artifact / **Equipment**, Kosten 10. „Once per turn, when the equipped
Hero defeats a target with an Attack, you may immediately summon a
Creature from your discard pile with it as an additional Action."

**★ „SUMMON", NICHT „PLACE" (Als Vorgabe 12.9.).** Das Level wird NICHT
ignoriert, und der ausgerüstete Held muss die Kreatur wirklich
beschwören KÖNNEN. Geprüft wird genau das, was der normale
Beschwörungsweg prüft:

| Tor | Aufruf |
|---|---|
| echtes Schul-Level | `heroMeetsLevelReq(pi, hi, cd, { pileSide: 'discard', noPlacementBypass: true })` |
| kartenseitige `canSummon`-Tore | `isCreatureSummonable(name, pi, hi)` |
| freie Support Zone AM WIRT | eigene Prüfung |
| Summon-Lock | `ps.summonLocked` |
| Held handlungsfähig | lebt, nicht Frozen / Stunned / Webbed / Negated |

**`noPlacementBypass` ist Pflicht** — sonst schaltet ein bounce-bares
Deepsea auf dem Brett den Platzierungs-Bypass scharf und der Held holt
Kreaturen über seinem Schul-Level (Als Ruling aus dem Necromancy-Fall).
Und **kein** `_bypassBeforeSummon` bei `isCreatureSummonable`: anders als
Necromancy läuft diese Karte über `summonFromPile` →
`summonCreatureWithHooks`, führt `beforeSummon` also wirklich aus —
Tribute und Kosten werden bezahlt.

Strikt `cardType === 'Creature'`: Artifact-Creatures zählen bei
Beschwörungen aus der Ablage nicht (Design-Regel, Necromancy und
Geschwister).

**Level 0 bleibt schulfrei.** Eine Lv-0-Kreatur mit Schulangabe ist auch
ohne diese Schule beschwörbar (`combined >= level` mit level 0) — das ist
Regelwerk, nicht ein Löcher im Tor. Im Repro beides geprüft: Lv1 ohne
Summoning Magic fällt raus, Lv0 bleibt.

**„as an additional Action"** braucht kein Flag: die Beschwörung läuft
über den HOOK, nicht über den Aktionsweg, und verbraucht die Zug-Aktion
damit ohnehin nicht (dieselbe Überlegung wie bei Explosive Drone).

**„Once per turn" ohne Zusatz = WEICH, je Instanz** (v249). HOPT-Schlüssel
mit der Karten-ID, beansprucht ERST beim Zugriff — ein abgelehntes „you
may" bleibt für einen späteren Treffer im selben Zug nutzbar
(Sacrificial-Dagger-Muster). Zwei Schwerter am selben Helden haben eigene
Schlüssel. Ein Angriff, der Held UND Kreaturen umlegt, fragt trotzdem nur
einmal: Marke an der Quelleninstanz des Angriffs (Wavilion-Muster).


## Neue Animation: `undead_revival` (v954, Als Vorgabe 12.9.)

Die Beschwörung von Skullmael's Greatsword: schwarze Magie und
Nekromantie, die Kreatur wird UNTOT wiederbelebt. Ein Runenkreis
öffnet sich flach auf der Zielzone (statisch gekippt, gedreht nur im
Keyframe, gegenläufiger Innenring), 14 nekrotische Flammen in Gift- und
Violetttönen schlagen hoch, fünf Knochen- und Schädelglyphen steigen
auf, zum Schluss ein dunkler Blitz — und genau dann steht die Kreatur.

**Bewusst ein EIGENER Typ, nicht das vorhandene `necromancy_summon`.**
Das ist der Schädel-Ausbruch der Ability an der Ability-Zone; hier
steigt etwas aus dem Boden. Und `ZONE_ANIM_SFX` hängt am TYP: ein
gemeinsamer Eintrag klänge überall mit. Dieselbe Trennung wie
`trex_chomp` vs `dino_bite` (★-Regel 19.8.).

**Klang** zweilagig: `elem_dark` tief und sofort für den Runenkreis,
`summon` bei 660 ms für den dunklen Blitz — zweite Lage mit
`category: null` und Namens-Dedupe, sonst schluckt die erste sie.

**Der Vorlauf gehört in die Karte:** `_delay(760)` zwischen Broadcast
und `summonFromPile`, damit das Ritual läuft, bevor die Karte aus der
Ablage einfliegt. `duration: 1400` in der Nutzlast, sonst hängt die
Komponente nach 1000 ms ab. Bei abgelehntem „you may" wird gar nichts
gesendet (im Repro geprüft).


## Neue Karte: „Golden Exploding Skull" (v955)

Creature, Summoning Magic Lv 1, 1 HP. „When this Creature is defeated,
deal 50 damage to all targets you control. You gain 5 Gold for each
target hit by this effect." Das Gegenstück zum Exploding Skull:
derselbe Todes-Auslöser, aber der Schlag geht auf die EIGENE Seite und
zahlt dafür Gold. **Kein Once per turn** im Text — jede Instanz feuert
bei jedem eigenen Tod.

Flächenschaden über `actionAoeHit(ich, { side: 'own' })`, damit die
Seiten-statt-Spalten-Regel, Shielded-Filter und Surprise-Fenster gelten.

**★ DER STERBENDE SCHÄDEL IST KEIN ZIEL.** Zum Hook-Zeitpunkt ist sein
Zonenplatz schon geräumt, `inst.zone` steht aber noch auf `'support'` —
ohne `creatureFilter: inst => inst.id !== ich.id` nimmt der Trichter ihn
selbst mit und zählt ihn als Treffer. Gilt für jede künftige Karte, die
aus ihrem eigenen Todes-Hook heraus eine AoE auf die eigene Seite legt.

**★ „HIT" WIRD AM HP-STAND GEMESSEN, UND DIE SNAPSHOTS HALTEN
INSTANZ-REFERENZEN.** Gezählt wird, bei wem der Schaden ankommt (ein
Schild, eine Immunität oder eine Reduktion auf 0 zählt nicht). Der erste
Anlauf merkte sich nur Kennungen und zählte hinterher über
`cardInstances` nach — eine Creature, die AM SCHLAG STIRBT, ist dort
aber schon untrackt und fiel aus der Zählung. Im Repro aufgefallen: zwei
goldene Schädel nebeneinander, der zweite stirbt am ersten (und löst
seinerseits aus), aber der erste zahlte nur 15 statt 20. Mit gemerkten
Instanz-Referenzen stimmt die Kette: 20 + 15 = 35 Gold.

## Neue Animation: `golden_explosion` (v955, Als Vorgabe 12.9.)

Weißgoldener Blitz, Feuerball in Goldönen, Druckwelle, 24 Funken und
sieben Münzen, die hochfliegen und wieder fallen. Bewusst ein eigener
Typ neben der rot-orangen `explosion`: der Klang hängt am Typ, und hier
gehört der Münzregen dazu.

**Klang** zweilagig: `heavy_impact` sofort (Sammelkategorie `'effect'` —
bei vier getroffenen Zielen fällt das von selbst zu EINEM Knall
zusammen), `gold_gain` bei 320 ms für den Münzregen, ohne Kategorie und
mit Namens-Dedupe.


## Neue Karte: „Don Quisto, the Gold Seeker" (v956)

Hero, 400 HP / 80 ATK, Inventing + Leadership. Zwei Hälften: „When this
Hero hits exactly 1 target with an Attack, you may spend 20 Gold to
increase that Attack's damage by this Hero's Attack stat." und „When this
Hero defeats one or more targets with an Attack, gain 10 Gold per
target."

**Teil 1 hängt an `onAttackDeclare`** — dem Fenster zwischen Zielwahl
und Aufprall (Vorbild Great Detective Doq). Die Rückfrage steht damit
VOR dem Schlag, und der Bonus liegt auf dem Betrag, bevor die Engine ihn
austeilt. `ctx.modifyAmount(bonus)` statt `setAmount`, damit „Punkt vor
Strich" gewahrt bleibt und fremde Multiplikatoren korrekt weiterrechnen.

**★ Der Bonus ist der AKTUELLE ATK-Wert** (Als Vorgabe 12.9.):
`hero.atk`, nicht `baseAtk`. Buffs, Ausrüstung und Dauerzuwächse
(Rakah, Wavilion) zählen mit — Don Quisto verdoppelt effektiv seinen
Angriff, im Repro mit 200 ATK auf 400 geprüft.

**„exactly 1 target":** `ctx.target` ist bei Einzelzielen ein Objekt und
bei Mehrfachzielen ein ARRAY — so reichen die Attack-Karten es an
`_fireAttackDeclare` weiter. Array → kein Angebot.

**Zahlung über `actionSpendGold`**, vorher `canAffordGold` (kennt den
Debt-O-Tron-Kreditrahmen). Das Primitiv kennt die Gold-Sperre (Golden
Arrow) und feuert `afterResourceSpend` (Criminal Monkee); scheitert die
Zahlung, gibt es keinen Bonus. Reicht das Gold nicht, wird gar nicht erst
gefragt.

**Teil 2** zahlt je besiegtem Ziel: Helden über `afterDamage`, Kreaturen
über `afterCreatureDamageBatch` (Summe der toten Einträge). Ein
Flächenangriff, der zwei Kreaturen und einen Helden umlegt, bringt 30 —
der Auftritt der Karte wird dabei über die Angriffsquelle entprellt und
erscheint einmal.

**★ „War ich das?"** — eine Kreatur in Don Quistos Support Zone baut
ihre Schadensquelle mit genau seinem `heroIdx`. Geprüft wird deshalb mit
`isCreatureSource` (v927), nicht nur über `source.zone`.


## Neue Karte: „Teocuilatl, the Embodiment of Gods" (v957)

Hero, 500 HP / 80 ATK, Leadership + Wealth. „You may once per turn
sacrifice a Creature you control that was not summoned this turn to gain
10 Gold OR a Hero you control to gain 30 Gold. After you have sacrificed
a Hero with this effect, immediately end your turn. You can only
sacrifice 1 Hero per game with this effect."

**Aktivierbarer Heldeneffekt OHNE Aktionskosten** — der Text sagt nichts
davon, und aktive Effekte kosten nur dann eine Aktion, wenn sie es sagen
(★-Regel 7.9.). Das „once per turn" stempelt der Server beim Aktivieren
selbst, wie bei jedem `heroEffect`.

**Zwei Wege, ein `optionPicker`** — angeboten wird nur, was gerade geht;
ist keiner der beiden Wege möglich, ist der Effekt gar nicht aktivierbar.

| Weg | Umsetzung |
|---|---|
| Creature | `resolveSacrificeCost` mit `filter: c => c.inst.turnPlayed !== turn` — dieselbe Auslegung von „not summoned this turn" wie bei den drei Teocuilatl-Kreaturen. Bringt Picker, Opferfenster, Ablage und Buchhaltung mit. |
| Hero | `actionDefeatHero(..., { isSacrifice: true, respectFirstTurnProtection: false })` — der Weg von Divine Gift of Sacrifice. `isSacrifice` markiert die Niederlage als freiwilliges Opfer (Temple of Sacrifice liest das), und eine freiwillige Selbst-Niederlage darf an keinem Schutz scheitern. |

**Teocuilatl selbst ist ein zulässiges Opfer** — „a Hero you control"
nimmt ihn nicht aus. Das Gold kommt auch dann, er ist danach besiegt (im
Repro geprüft).

**„immediately end your turn"** über die Terror-Mechanik
(`gs._terrorForceEndTurn` + `_terrorForceEndSource`, Doom-Prophecy-
Muster): der Server wartet, bis Prompts, Effekte und eine laufende Kette
durch sind, und fährt dann die End Phase. **Nur** nach dem Helden-Opfer,
nicht nach dem Kreatur-Opfer — und nicht mehr, wenn das Spiel durch das
Opfer bereits entschieden ist.

**„1 Hero per game"** als Marke am Spielerzustand
(`ps._teocuilatlHeroSacrificed`), gesetzt VOR der Niederlage, damit eine
daran hängende Kette den Weg nicht ein zweites Mal sieht.
Unterstrich-Felder sind die etablierte Form für karteneigenen
Kramzustand und überleben den Zugwechsel.

**CPU:** nimmt immer die Kreatur. 30 Gold sind einen eigenen Helden und
das sofortige Zugende nicht wert; steht nur der Heldenweg zur Wahl,
antwortet die Karte gar nicht und der Prompt wird abgebrochen.


## Neue Karte: „Boulder in a Bottle" (v958)

Potion. „Place this card into the free Support Zone of a Hero your
opponent controls. While it is in a Support Zone, this card is treated
as a level 3 Creature with 150 HP and the following effect: \"This
Creature occupies all free Support Zones of the corresponding Hero. This
Creature cannot be sacrificed.\""

**★ DIE POTION BLEIBT LIEGEN.** Potions wandern nach dem Auflösen in
den Gelöscht-Stapel — diese nicht. Der vorgesehene Weg ist das Fenster
**`afterPotionUsed` mit `ctx.setFlag('placed', true)`** (Biomancy macht
es für seine Token genauso). BEWUSST NICHT über
`gs._spellPlacedOnBoard`: dieser Zweig steht in `doUsePotion` VOR dem
Potion-Zweig und würde `afterPotionUsed` UND `checkPotionLock`
mitüberspringen. Für jede künftige Potion, die auf dem Brett bleibt,
denselben Weg nehmen.

**★ SIE LIEGT IN DER SPALTE DES GEGNERS UND GEHÖRT DAMIT IHM.**
`safePlaceInSupport(name, oppIdx, …)` trägt den Besitzer der ZONE ein —
und das ist hier genau richtig: der Brocken belegt SEINE Plätze, steht
auf SEINER Seite, und die Klausel „cannot be sacrificed" richtet sich
gegen IHN (sonst opfert er den Brocken weg und hat seine Zonen zurück).

**„treated as a level 3 Creature with 150 HP"** über den Zähler
`_cardDataOverride` (Biomancy-Muster): `getEffectiveCardData` liest ihn,
und damit behandelt die ganze Engine die Karte als Kreatur — Ziel- und
Schadenspfade, AoE, Stufenabfragen, Tooltip. Typ `Creature/Token` wie
beim Biomancy-Token, damit sie beim Verlassen des Bretts in den
GELÖSCHT-Stapel geht statt in die Ablage: es ist und bleibt eine Potion.

**„occupies all free Support Zones"** über `_multizone-shared`:
`claimZones` belegt jede noch FREIE Zone des Gastgebers mit dem
Platzhalter und lässt belegte in Ruhe — genau der Wortlaut. Bewusst
OHNE `multiZone: 3` am Modul: dieses Flag verspricht „braucht 3 Zonen",
und der Brocken darf auch zu einem Helden mit nur einer freien Zone.

**★ Neuer Engine-Vertrag `cannotBeSacrificed` (v958).**
`getSacrificableCreatures` überspringt Instanzen, deren Skript das Flag
trägt oder deren Zähler es setzt. Bewusst NICHT über `_cardinalImmune`
gelöst — das sperrt JEDEN Effekt, hier geht es nur ums Opfern. Der
Zähler deckt Instanzen ab, die ihre Kartenidentität erst zur Laufzeit
bekommen (Override-Tokens, Puzzle-Aufbau).

**Animation:** `rolling_boulder` wiederverwendet — vorhandener Typ mit
eigener Polter-Klangfolge, also kein neuer Klang nötig.


## Neue Karte: „Phoenix Bombardment" (v959)

Spell, Destruction Magic Lv 2. „Reduce a target's HP to 1. Then, the
user takes damage equal to the amount of HP reduced by this effect.
Immediately end your turn afterwards. This Spell can never hit more than
1 target at a time."

**★ „REDUCE … TO 1" IST KEIN SCHADEN.** Die HP werden GESETZT
(`hero.hp = 1` bzw. `inst.counters.currentHp = 1`) — das Muster von
Emergency Spell Armor, Paraseed Zombie und Guardian Angel. Folgen, alle
gewollt: keine Schadens-Hooks, keine Schilde, keine Reduktion, kein
Surprise-Fenster — und das Ziel STIRBT NICHT, es bleibt bei 1. Die
Max-HP bleiben unberührt; der Text spricht nur von HP. (Wer beides
senken will, braucht die Reihenfolge aus v778 — hier ausdrücklich nicht.)

**Der Rückstoss ist dagegen echter Schaden:** `HP vorher − 1`, Typ
`'recoil'`. Er kann den Anwender töten (wie bei Phoenix Tackle gewollt)
und öffnet als `recoil` kein Surprise-Fenster — richtig für
Selbstschaden.

**Stand das Ziel schon auf 1 HP**, ist die Senkung 0, es gibt keinen
Rückstoss — der Zug endet trotzdem, denn der Zauber hat aufgelöst. Bei
ABGEBROCHENER Zielwahl passiert dagegen gar nichts, auch kein Zugende.

**★ „can never hit more than 1 target at a time" IST NICHT VON SELBST
ERFÜLLT** (Als Hinweis 12.9., mein Fehlschluss in v959). **„Bomb
Berserker Bartas"** lässt einen normalen Destruction-Zauber unter seiner
eigenen Stufe ein ZWEITES Ziel treffen, indem er `onPlay` ein zweites
Mal fährt — die eigene Zielwahl mit `maxTotal: 1` deckt nur die EINE
Auflösung ab, nicht den zweiten Durchlauf.

Der Riegel dafür existiert seit Basketskull: **`neverMultiTarget: true`**
am Spell-Skript. Bartas fragt es ab und verzichtet dann auf sein
Zweitziel. **Jede Karte mit diesem Satz im Text braucht das Flag** — die
Klausel beschreibt keinen Zustand, sondern wehrt fremde Effekte ab.
Nicht zu verwechseln mit der Gegenrichtung (Helden-Flaggen, die eine
Auswahl auf 1 KAPPEN): `singleTargetAttack`, `forcesSingleTarget`,
`forcesSingleTargetAny`.

**Zugende** über die Terror-Mechanik (`_terrorForceEndTurn` +
`_terrorForceEndSource`). Animationen aus der vorhandenen
Phoenix-Familie (`flame_avalanche` auf dem Ziel, `flame_strike` auf dem
Anwender) — kein neuer Typ, also kein neuer Klang nötig.


## Neue Animation: `phoenix_bombardment` (v960, Als Vorgabe 12.9.)

Ein SCHWARM Phoenixe mit Feuer-Particles hinter ihnen, der ins Ziel
kracht — je Vogel eine eigene Explosion.

**22 Vögel** (v974: aus sieben wurden 22, Als Vorgabe „deutlich mehr")
fliegen aus dem oberen Halbkreis von außerhalb auf das Ziel zu (der
Container sitzt auf dem Ziel, es fliegt also alles auf 0,0), jeder in
Flugrichtung gedreht, mit schlagenden Schwingen (`clipPath`-Silhouette
in Feuerfarben) und drei Funken, die DIESELBE Bahn mit Versatz fliegen —
so entsteht der Schweif ohne JS-Partikelsystem. Jeder Einschlag zündet
seine eigene Explosionsblüte.

**Beim Aufstocken drei Stellschrauben mitdrehen** (sonst zieht sich das
Bombardement oder erschlägt die Bildmitte):
* Ankunftszeiten DICHTER statt länger — `200 + (i/(N-1)) * 900 ms`
  verteilt über dasselbe Fenster, nicht `i * 110`.
* Winkel im Zickzack über den Bogen (`i % 2` schaltet zwischen Anfang
  und Ende), damit benachbarte Nummern nicht nebeneinander einschlagen.
* Funken je Vogel und Größe der Blüte runter (22 x 5 Elemente statt
  7 x 7; Blüte von 0,9 auf 0,62 Zonenbreite).

**Klang** dreilagig, weil das Bombardement drei Momente hat: `elem_fire`
sofort für den Anflug (Sammelkategorie `'effect'`), dann zwei versetzte
`heavy_impact` für den ersten und den letzten Einschlag — beide ohne
Kategorie (sonst schluckt sie die erste Lage) und mit `dedupe: 0`, damit
sie sich nicht gegenseitig verschlucken.

**`duration: 1800`** in der Nutzlast, und im Kartenskript `_delay(1150)`
zwischen Broadcast und HP-Senkung: der Schwarm ist durch, dann fällt der
Wert. Die zweite `heavy_impact`-Lage rückte mit auf 950 ms.


## Neue Karte: „Difficulty Lever" (v961)

Artifact (Normal, Kosten 10). „Choose a Spell with an original level of
3 or lower and a Spell School that none of your Heroes (including
defeated ones) has from your hand. Then, choose a Hero you control. That
Hero immediately performs that Spell regardless of its level as an
additional Action. This must be the only Action to perform this turn.
You can only play 1 \"Difficulty Lever\" per game."

**„a Spell School that NONE of your Heroes has"** — gesammelt werden die
Schulen ALLER eigenen Helden, **auch der besiegten** (der Text sagt es
ausdrücklich). Gelesen über `spellSchoolAbilitiesOn` aus `_hooks.js`,
also dieselbe Stelle wie bei Cosmic Skeleton und Sarcophagus. Ein Zauber
taugt, wenn MINDESTENS EINE seiner Schulen fehlt — „a Spell School" ist
Singular, bei Doppelschul-Zaubern reicht eine. Performance zählt nicht
als Schule.

**„original level"** ist der gedruckte Wert aus cards.json, nicht das
effektive (gleiche Lesart wie bei Bomb Berserker Bartas).

**„regardless of its level"** kommt von selbst: `_castSpellImmediately`
prüft keine Levelanforderung — die Brücke fährt den vollen Spielweg
(Zielwahl, Reaktionsfenster, Kosten, Auflösung), nur ohne das
Schul-/Levelgatter davor. Genau deshalb filtert Friedhelm seine Galerie
mit `heroMeetsLevelReq` — hier soll das Gatter ausdrücklich fehlen.

**★ „This must be the only Action to perform this turn" ist eine Klammer
in BEIDE Richtungen:**
* vorher: der Spieler darf in DIESEM ZUG noch keine Aktion benutzt haben
  — `ps.heroesActedThisTurn` ist leer. **Die PHASE ist ausdrücklich kein
  Kriterium** (Als Präzisierung 12.9., Korrektur an v961): wer seine
  Action Phase einfach beendet, ohne zu handeln, darf den Hebel in MAIN
  PHASE 2 noch ziehen. Ein genereller Aktions-Riegel (Kent, Chalice)
  sperrt weiterhin — das ist keine Klausel der Karte, sondern eine
  fremde Sperre, die jede Aktion trifft.
* nachher: `ps._playerActionLockedTurn = gs.turn` — der spielerweite
  Riegel, den `areActionsBlocked` liest (Kents Vorbild). Er hält auch
  dann, wenn der wirkende Held anschließend fällt.
* und `gs._spellFreeAction` wird abgeräumt: eine Gratisaktion, die der
  gewirkte Zauber selbst gewährt, darf die Klammer nicht aufbrechen.

**★ DREI SCHRITTE, ZWEI RÜCKWEGE** (Als Vorgaben 12.9.):

| Schritt | Abbruch bedeutet |
|---|---|
| Zauber-Galerie | **die Karte wird gar nicht gespielt** |
| Caster-Wahl | zurück zur Galerie (`↩ BACK`) |
| Zielwahl DES GEWIRKTEN ZAUBERS | zurück zur Caster-Wahl (`↩ BACK`) |

Bei nur EINEM fähigen Helden entfällt der Caster-Schritt; ein Rückweg aus
der Zielwahl landet dann direkt in der Galerie (sonst liefe er gegen eine
Wahl ohne Alternative). Die Einmal-je-Partie-Marke fällt erst, wenn der
Zauber wirklich gelaufen ist.

**★ `{ cancelled: true }` STATT `false`.** Nur dieses Signal wertet
`doUseArtifactEffect` aus: es räumt `_pendingCardReveal` und
`_pendingPlayLog` weg und kehrt VOR Bezahlung und Hand-Entnahme um —
**kein Gold, kein Auftritt, die Karte bleibt auf der Hand**. Ein bloßes
`false` tut nichts davon (die Karte wäre bezahlt und abgelegt).
**Jede abbrechbare Nicht-Equip-Artefaktkarte muss so zurückgeben.**

**★ Neuer Engine-Vertrag `_promptCancelLabel` (v976).** Fährt eine Karte
einen FREMDEN Effekt und fängt dessen Abbruch selbst ab, um einen
Schritt zurückzuspringen, soll auch der Knopf das sagen. Der Aufrufer
setzt `engine._promptCancelLabel = '↩ BACK'` um den fremden Aufruf herum
(im `finally` wieder weg); `promptGeneric` und `promptEffectTarget`
tragen es in jeden abbrechbaren Prompt OHNE eigenes Label ein. Die
gerufene Karte weiß davon nichts.

**★ `oncePerGame` wird im Artefakt-Weg NICHT ausgewertet.**
`doUseArtifactEffect` kennt das Flag nicht (anders als der Aktions- und
der Equip-Weg, die beide prüfen UND stempeln). Eine Nicht-Equip-Karte
mit „once per game" muss es deshalb selbst tun: `canActivate` prüft
`ps._oncePerGameUsed`, `resolve` setzt die Marke — vor dem Cast, damit
eine Kette den Hebel nicht ein zweites Mal sieht.


## Neue Karte: „Dangerous Knowledge" (v962)

Spell / **Normal**, Decay Magic + Support Magic, Lv 1. „Choose a Hero
your opponent controls with a different name from all Heroes you control
(including defeated ones). The user gains that Hero's effects in addition
to its own for the rest of the game. A Hero's effects can only be gained
once per game with this effect. This counts as an additional Action."

**★ KEINE REACTION MEHR (v980, Als Vorgabe 12.9.).** Meine erste Lesart
— Subtyp Reaction ohne Trigger-Text = generisches Kettenfenster — war
technisch möglich, aber **UX-Gift: ständige Reaktionsfenster nerven**.
Die Karte ist jetzt ein NORMALER Zauber mit `inherentAction: true`
(„This counts as an additional Action", Vorbild Aligning Goals) und
läuft über `onPlay`. Der Subtyp in cards.json wechselte von `Reaction`
auf `Normal`; `isReaction` und `canActivate: () => false` sind raus.

**Merksatz:** eine Karte, die „irgendwann dazwischen" spielbar sein soll,
ist fast immer besser als Zusatzaktion aufgehoben als als
bedingungslose Reaction — die zweite fragt den Gegenspieler bei JEDEM
Kartenspiel.

**„The user"** ist der wirkende Held: bei einem normal gespielten Zauber
schlicht `ctx.cardHeroIdx`.

**★ „gains that Hero's effect IN ADDITION to its own"** ist wortgleich
mit Initiation Ritual, also derselbe Weg: eine Instanz der fremden
Heldenkarte mit `counters.treatAsEquip = true` und
`isActiveIn = () => true`. Damit greifen beide Hälften — aktivierbare
Effekte über den Equip-Zweig von `getActiveHeroEffects`, passive Hooks
über den `isActiveIn`-Override (ohne den fiele ein Heldenskript mit
`activeIn: ['hero']` aus der Support Zone heraus; Befund 28.8.).

**UNTERSCHIED zu Initiation Ritual: KEIN Zonenplatz.** Die Instanz
bekommt `zoneSlot: -1`, und `supportZones` wird nicht angefasst. Sie
belegt also nichts, wird nicht gerendert, taucht in keiner Zielliste auf
(jeder Sammler filtert auf Kreaturen oder läuft über die Zonen-Arrays)
— und kann deshalb auch nicht zerstört werden. Genau das heißt „for the
rest of the game". **Bauform für jedes künftige „gains the effect of
…" ohne sichtbare Karte.**

**Namensvergleich** über `baseCardName` (v876), besiegte eigene Helden
zählen mit. **„once per game"** als Register am Spielerzustand
(`ps._dangerousKnowledgeGained`), je Spieler eigenes — „this effect" ist
der Effekt DIESES Spielers. Ein Gegnerheld ohne eigenes Skript hat nichts
zu verschenken und wird gar nicht angeboten.


## Neue Karte: „Wire Hatchling" (v963)

Creature, Summoning Magic Lv 2, 50 HP. „When you summon this Creature,
choose any target on the board and deal damage to it equal to half its
current HP (rounded up)."

**Auslöser** `onPlay` mit Selbsttest, Zonenprüfung und
`counters.isPlacement` als Riegel: **platziert ist nicht beschworen**
(Muster Knight of Kings). Eine EFFEKT-Beschwörung (Skullmael's
Greatsword, Necromancy) ist dagegen eine und löst mit aus.

**„half its CURRENT HP (rounded up)"** — `Math.ceil(hp / 2)` auf dem
AKTUELLEN Wert, und dieser Wert wird ERST NACH der Zielwahl genommen
(zwischen Angebot und Auflösung kann sich das Brett ändern). Aus der
Aufrundung folgt der einzige tödliche Randfall: ein Ziel mit 1 HP nimmt
1 und stirbt; ab 2 HP überlebt es rechnerisch immer — Halbieren tötet
nicht. Beides im Repro festgehalten.

## Neue Animation: `paralyzing_bolts` (v963, Als Vorgabe 12.9.)

Etliche kleine Blitze, die das Ziel von ALLEN Seiten treffen und es
paralysieren: 14 Blitze schlagen aus einem Ring rundum ein, jeder als
gezackter Pfad (`clipPath`-Zickzack), in Flugrichtung gedreht und nur
kurz sichtbar — das Flackern (`steps(2, end)`, zweimal) macht das
Gewitter. Darüber der Starrkrampf: ein elektrischer Käfig, der zweimal
hell aufblitzt und dann steht, plus knisternde Funken auf dem Ziel.

**★ Falle dabei:** die Drehung jedes Blitzes steht INLINE am Element.
Ein `transform` im Keyframe überschreibt sie — im ersten Anlauf schnappten
alle Blitze waagerecht. Der Keyframe animiert deshalb NUR `opacity`; wer
zusätzlich skalieren will, braucht ein inneres Element.

**Klang** zweilagig: `elem_lightning` höher und sofort für das Gewitter,
`debuff` bei 560 ms für den Starrkrampf (ohne Kategorie, mit Dedupe).
**`stun` gibt es im Katalog NICHT** — ein erfundener Name fällt still auf
404 und die Lage bliebe stumm; die gültigen Namen stehen in `SFX_NAMES`
in `app-shared.jsx`.


## Neue Karte: „Pyraga" (v964)

Creature, Summoning Magic Lv 1, 80 HP. „Up to 4 times per turn, when a
Creature activates its active effect for the first time that turn while
you control this Creature, you may choose a target and deal 80 damage to
it."

**Auslöser** `afterCreatureEffect` — das Fenster feuert in BEIDEN Wegen
(reguläre Aktivierung im Server, Wiederholung über
`retriggerCreatureEffect`) und für JEDE Kreatur auf dem Brett. Der Text
macht keine Seiteneinschränkung: auch der Aktiveffekt einer GEGNERISCHEN
Kreatur lässt Pyraga feuern (im Repro geprüft).

**★ „for the FIRST TIME that turn"** (Als Präzisierung 12.9.) zielt auf
Kreaturen, die MEHRFACH je Zug aktivieren können — 3-Headed Giant (bis
zu dreimal), Elven Leader (Wiederholung je Kreatur). Nur der erste
Einsatz einer Kreatur im Zug zählt. Pyraga führt dafür ein EIGENES
Register je Zug (`_pyragaSeenIds`) statt sich auf fremde Stempel zu
verlassen: die Wiederholungswege stempeln unterschiedlich, das eigene
Register ist davon unabhängig richtig.

**Zwei Zähler, zwei Zeitpunkte** — die Unterscheidung steckt im
Wortlaut: das Register wird IMMER gesetzt, auch bei Ablehnung (der
Auslöser hat stattgefunden), der 4er-Zähler steigt NUR bei
tatsächlicher Nutzung („UP TO 4 times … you MAY"). Eine abgebrochene
Zielwahl verbraucht ebenfalls nichts.

Beide Zähler hängen an der INSTANZ statt in `counters`: reine
Buchhaltung, die weder Client noch Puzzle-Editor sehen muss.
Zugstempel, damit nichts in den nächsten Zug hineinreicht.

**Animation:** die von Fireball (Als Vorgabe) — fliegender 🔥 aus
Pyragas Zone (`play_projectile_animation` mit `baseAngle: 90`, weil das
Emoji nach oben zeigt und der Dreh-Rahmen Osten annimmt), beim Aufschlag
`flame_strike`. Vorhandene Typen, also kein neuer Klang nötig.


## Neue Karte: „Duigno, the Flaming Phoenix" (v965)

Creature, Summoning Magic Lv 2, 100 HP. „While you control this
Creature, you may perform a second Action during each of your Action
Phases, but if you do, you cannot perform any other additional Actions
during your turn."

**Die Zweitaktion** kommt aus `_second-action-shared` — dasselbe
Gespann wie bei Soul Shard Ba und Giga Steroids: Anbieter-Registrierung,
Helden-Abzeichen, `_preventPhaseAdvance`, Verpuffen bei fremd
verbrauchter zweiter Aktion, Aufräumen am Phasenende.
`heroRestricted: false`, denn der Text bindet die Aktion an keinen
Helden.

**★ DAUERWIRKUNG, NICHT EINMALIG** — „during EACH of your Action
Phases". Der Zuschlag wird an ZWEI Stellen gesetzt: beim Beschwören
(Duigno kommt selbst in der Action Phase aufs Brett, der Zuschlag muss
noch im selben Zug greifen) und zu Beginn jeder eigenen Action Phase
(`onPhaseStart`, `phaseIndex === 3`, nur wenn `activePlayer` der eigene
ist). `secondActionGrant` ist idempotent, der Doppelaufruf kostet nichts.

**★ Neuer Engine-Vertrag `additionalActionsLocked` (v965).** Gegenstück
zu `areActionsBlocked`, aber enger: gesperrt sind nur ZUSATZaktionen,
die reguläre Zug-Aktion bleibt erlaubt. Ein Rundenstempel am Spieler
(`ps._additionalActionsLockedTurn`), gelesen an den beiden Stellen,
durch die JEDE Suche nach einem Anbieter läuft
(`findAdditionalActionForCategory` und `findAdditionalActionForCard`) —
Client-Ausgrauung und Server-Prüfung teilen sich damit dieselbe Antwort.

Gesetzt wird er, wenn DUIGNOS Zuschlag eingelöst ist: in
`onAdditionalActionUsed`, nachdem der gemeinsame Hook des Shared-Moduls
gelaufen ist und die eigenen Zuschüsse der Instanz auf 0 stehen.
**Die Sperre gilt nur in DIESE Richtung** — wer zuerst eine andere
Zusatzaktion nimmt, darf Duignos zweite danach trotzdem noch; der Text
verbietet nur das Umgekehrte (im Repro in beide Richtungen geprüft).

**Beim eigenen Hook einen Shared-Hook überschreiben:** `onAdditionalActionUsed`
steht in `secondActionHooks` UND in der Karte. Der Spread setzt den
gemeinsamen zuerst, die eigene Fassung ersetzt ihn — sie ruft ihn
deshalb ausdrücklich selbst auf (`secondActionHooks.onAdditionalActionUsed(ctx)`),
sonst fällt das Abzeichen-Aufräumen still aus.


## Neue Karte: „Moonlight Butterfly" (v966)

Creature, Summoning Magic Lv 0, 10 HP. „At the end of your opponent's
turn, you may add this Creature you control back to your hand, and if
you do, deal 150 damage to the opponent's Hero in the same position as
the corresponding Hero."

**Auslöser** `onTurnEnd` mit `if (ctx.isMyTurn) return;` — es ist der
Zug des GEGNERS, der endet. **`ctx.isMyTurn` rechnet `_createContext`
selbst aus `gs.activePlayer`**; ein Wert im hookCtx wird überschrieben
(im Prüfstand muss also der Spielstand umgestellt werden, nicht der
hookCtx — der erste Testlauf lief genau da hinein).

**Prompt im Gegnerzug** → `beginHumanWait()` / `endHumanWait()` um den
Confirm, sonst zählt die Bedenkzeit gegen die Zug-Uhr. Im `finally`,
damit ein Abbruch das Fenster nicht offen lässt.

**„the opponent's Hero in the same position as the corresponding Hero"**
ist die Spalte gegenüber: derselbe `heroIdx` wie der Wirt des Falters.
Steht dort kein lebender Held, fällt nur der Schaden aus — die
Rücknahme ist trotzdem geschehen („you MAY add … and IF YOU DO": die
Rücknahme ist die Bedingung, nicht der Schaden). Der Prompt sagt vorher,
ob gegenüber jemand steht.

**Rücknahme** über `returnSupportCreatureToHand` — die eine Stelle, die
die Zone räumt, den Flug sendet, `onCardLeaveZone` feuert und die
Instanz abmeldet. **Sie nimmt seit v966 einen `opts.animationType`
entgegen** (Standard bleibt `deep_sea_bubbles`): der Weg ist längst
nicht mehr nur Deepsea, und der Falter steigt ins Mondlicht statt in
Blasen.

## Neue Animation: `moonlight_beam` (v966, Als Vorgabe 12.9.)

Bläuliches Mondlicht, das von oben auf das Ziel fällt: eine kalte
Mondscheibe weit oben, darunter ein nach unten aufgefächerter
Lichtschacht (`clipPath`-Trapez, `scaleY` aus der Höhe herab, Ursprung
oben) mit hellerem Kern, 16 Staubfunken, die im Strahl nach oben
treiben, und ein Lichtteich auf dem Ziel.

**Klang** zweilagig: `elem_holy` tief und sofort für den Schacht,
`elem_ice` höher bei 420 ms für das kalte Funkeln — ohne Kategorie und
mit Namens-Dedupe, weil der Typ **zweimal je Auslösung** läuft
(Rücknahme des Falters und Schlag gegenüber).


## Galerie mit nicht waehlbaren Eintraegen — `selectable` / `highlight` (v967)

Der `cardGallery`-Prompt kennt jetzt zwei Felder JE EINTRAG:

| Feld | Wirkung |
|---|---|
| `selectable: false` | Eintrag ist reine Anzeige — abgedunkelt, graustichig, nicht anklickbar |
| `highlight: true` | Eintrag bekommt einen leuchtenden Rahmen |

Gebraucht fuer Galerien, die ALLES zeigen, aber nur einen Teil zur Wahl
stellen. Ohne beide Felder bleibt jede bestehende Galerie unveraendert.

**CPU-Antworten muessen mitziehen:** `promptData.cards[0]` kann jetzt ein
nicht waehlbarer Eintrag sein — `find(c => c.selectable !== false)`
nehmen und, wenn nichts waehlbar ist, `{ cancelled: true }` melden.

## ★ DECK-PEEK: Karten liegen in der Bildmitte (v968, Als Vorgabe 12.9.)

Ein neuer Anzeigeweg für „decke N Karten auf und wähle daraus":

| Ereignis / Typ | Bedeutung |
|---|---|
| `deck_peek_reveal` `{ owner, cards:[{name,selectable,highlight}], title }` | Die Karten fliegen EINZELN vom Deck des `owner` in ein Raster in der Bildmitte und BLEIBEN dort liegen (5 je Reihe, 190 ms Staffelung) |
| Prompt `deckPeekPick` `{ cards, title, description }` | Macht die liegenden Karten für den Gefragten anklickbar — nur `selectable`-Einträge, `highlight` leuchtet; dazu ein DONE-Knopf unter dem Raster |
| `deck_peek_clear` `{ chosen, toOwner }` | Die gewählte Karte fliegt von ihrem Platz in die Hand, der Rest sinkt ab; die Anzeige räumt sich selbst weg |

**Abgrenzung zu den beiden Nachbarn:**
* `card_reveal` ist der Kanal für Karten-AUFTRITTE (eine Karte zeigt
  sich links neben dem Feld, weil ihr Effekt feuert) — **nicht** für
  aufgedeckte Deckkarten (Als Hinweis 12.9.; mein erster Anlauf lag da
  falsch).
* `mill_center_reveal` zieht Karten vom Deck in die Mitte und dann
  WEITER in einen Stapel. Deck-Peek nimmt denselben Weg, lässt sie aber
  liegen — die liegenden Karten SIND die Galerie.

Beide Spieler sehen die Karten; nur wer den Prompt hat, wählt. Die
CPU-Antwort geht auf `deckPeekPick` und nimmt den ersten Eintrag mit
`selectable !== false`, sonst `{ cancelled: true }`.

**★ HANDSCHLAG GEGEN DIE ZWEITE ANIMATION (v969, Als Befund).** Eine
Karte aus dem GEGNERDECK lässt meine Hand wachsen, ohne dass MEIN Deck
kleiner wird — genau dieser Fall fällt im Handzuwachs-Erkenner in den
Rückfallzweig „vermutlich aus der Gegnerhand gestohlen" und spielte eine
ZWEITE Bewegung Gegnerhand → meine Hand, nachdem die Karte längst aus der
Mitte geflogen war. `deck_peek_clear` bucht deshalb beim Nehmer eine
Gutschrift auf `stealSkipDrawRef` — derselbe Handschlag, den der
Mitten-Auftritt mit `dest: 'hand'` schon benutzt. **Jeder neue Weg, der
eine Karte von aussen in die eigene Hand legt, braucht ihn**, sonst
doppelt der Erkenner.

## „Spice Mortar" — Mitten-Galerie (v967/v968, Als Vorgabe 12.9.)

Die zehn Karten fliegen **einzeln** vom Gegnerdeck in die Bildmitte und
bleiben dort liegen (Deck-Peek, siehe oben) — Potions leuchten und sind
anklickbar, der Rest liegt abgedunkelt daneben. Die Wahl fliegt von
ihrem Platz in die Hand; die Entnahme selbst läuft weiter den
Enigma-Weg (`takeFromPile`, `_tagHandCardOrigin`,
`onCardTakenFromOpponent`).

Die Galerie hat IMMER einen Done-Knopf (`cancellable: true`,
`cancelLabel: '✓ DONE'`) — schon damit sie sich schliessen laesst, wenn
keine Potion dabei war. Wer ihn bei vorhandener Potion drueckt, nimmt
nichts mit; das weicht vom „if possible" des Kartentexts ab und ist so
gewollt, solange Al nichts anderes sagt.


## „Skullmael's Greatsword" — zwei Nachbesserungen (v970, Als Befunde 12.9.)

**★ DIE AN DIESEM ANGRIFF GEFALLENE KOPIE STEHT NICHT ZUR WAHL.**
Stirbt eine EIGENE Kreatur an genau dem Angriff, der das Schwert
auslöst, sind ihr Tod und der Trigger **gleichzeitig** — auch wenn das
Schwert erst danach auflöst. Sie darf sich also nicht selbst
zurückholen lassen. Die Strichliste hängt an der Quelleninstanz des
Angriffs (`source._skullmaelFresh`) und zählt **je Name**: liegt noch
eine ÄLTERE Kopie desselben Namens in der Ablage, bleibt die wählbar —
die Ablage führt nur Namen, keine Instanzen, und ein reiner
Namensausschluss würde die alte Kopie mit sperren. Verglichen wird
darum Anzahl-in-Ablage gegen Anzahl-eben-gefallen.
**Vorlage für jede Karte, die aus einem Todes-/Kill-Fenster heraus aus
der eigenen Ablage holt.**

**★ „BACK" IN DER ZONENWAHL FÜHRT ZUR KREATURWAHL ZURÜCK**, nicht aus
dem Effekt heraus — man kann es sich zwischen den beiden Schritten
anders überlegt haben. Umgesetzt als Schleife um beide Prompts: nur ein
Abbruch IN DER GALERIE beendet das Angebot, ein Abbruch in der Zonenwahl
springt zurück. Der Knopf heißt dort `↩ BACK` statt `✕ CANCEL`.
**Gilt als Muster für jeden mehrstufigen „you may"-Effekt**: Zwischen-
schritte gehen zurück, nur der erste Schritt bricht ab.


## ★ Fremdziele im Opfer-Waehler — `spec.extraTargets` (v972)

`resolveSacrificeCost` nimmt jetzt zusätzliche Picker-Ziele entgegen,
die KEINE Opfer sind. Wird eines geklickt, opfert der Helfer nichts und
gibt **`{ extraPicked: <ziel> }`** zurück; der Aufrufer entscheidet
dann selbst. Damit bleibt „Kreatur ODER etwas anderes" EINE Zielwahl auf
dem Brett, **ohne die Opfer-Maschinerie nachzubauen** — und genau darum
geht es: der **Hand-Ersatz „Chosen Sacrifice"** (samt der
Sonderbehandlung, dass die Handkarte erst NACH ihrer eigenen Belohnung
in die Ablage fliegt), Cardinal-Immunität, `cannotBeSacrificed`,
Messer-Animation, `onCreatureSacrificed`, Strichliste und
`onSacrificeBatch` sind dort und nur dort richtig.

**Dazu:** mit Fremdzielen verpufft der Helfer NICHT mehr, wenn es kein
gültiges Opfer gibt — der Wähler öffnet dann eben nur mit den
Fremdzielen. Ohne das wäre Teocuilatls Helden-Weg unerreichbar, sobald
keine Kreatur opferbar ist (im Repro als eigener Fall).

## „Teocuilatl" — Zielwahl statt Submenue (v971/v972, Als Vorgabe 12.9.)

Der Heldeneffekt oeffnet **kein** `optionPicker`-Submenue mehr, sondern
EINE Zielwahl auf dem Brett: hervorgehoben ist alles, was gerade legal
ist, und der KLICK entscheidet den Weg — Kreatur → 10 Gold, Held → 30
Gold und Zugende.

Hervorgehoben wird nur, was wirklich geht: Kreaturen nur, wenn sie
nicht in diesem Zug beschworen wurden (`inst.turnPlayed !== gs.turn`,
auf `getSacrificableCreatures` aufgesetzt, also inklusive
Cardinal-Immunitaet und `cannotBeSacrificed`), Helden nur, solange das
Einmal-je-Partie offen ist. Ist gar nichts wählbar, ist der Effekt nicht
aktivierbar.

**Und trotzdem über `resolveSacrificeCost`** (Als Vorgabe 12.9.: „dass
Chosen Sacrifice funktioniert, IST wichtig"): die Helden hängen als
`spec.extraTargets` im selben Wähler, der Kreatur-Weg bleibt der
normale Opfer-Weg samt Hand-Ersatz. Mein Zwischenstand v971, der das
Opfer von Hand nachbaute, ist damit wieder raus.

**★ Teocuilatl selbst ist KEIN Ziel** (Textfassung 12.9.: „a Hero you
control, except this one") — sein eigener Heldenindex fällt aus den
`extraTargets`.

**Die CPU-Antwort wechselt mit dem Prompt-Typ:** von `generic`/
`optionPicker` auf `effectTarget`, erkannt an `promptData.config.title`,
und nimmt den ersten Nicht-Helden.


## „Boulder in a Bottle" — Felsregen und Mittelplatz (v973, Als Vorgaben 12.9.)

**Neue Animation `falling_boulder`:** ein Brocken fällt von oben mit
leichter Drehung in die Zone, schlägt auf (kurzer Stauchimpuls), wirft
eine Staubwelle und Geröll nach außen. **Ein Aufruf JE FREIER ZONE**,
von der Karte um 220 ms gestaffelt — deshalb zeichnet die Komponente
bewusst EINEN Fels und nicht drei. Klang: `heavy_impact` tief bei 370 ms;
die Sammelkategorie `'effect'` fällt die drei Auftreffer von selbst zu
einem Poltern zusammen, statt dreimal zu knallen.

Getroffen werden genau die Zonen, die gleich blockiert sind — der
Landeplatz des Brockens selbst gehört dazu.

**★ Landeplatz:** sind alle drei Grundzonen frei, landet die Karte in der
**MITTLEREN**; der Fels liegt dann zwischen den beiden blockierten
Plätzen statt am Rand. Sonst der erste freie Platz. Umgesetzt über den
Slot-Parameter von `safePlaceInSupport` statt über dessen
Automatik (`-1` nimmt immer den ersten freien).


## ★ JEDER WEG IN DIE ABLAGE ZEIGT EINE BEWEGUNG (v977, Als Regel 12.9.)

„Das soll IMMER passieren, egal WIE eine Karte zum Discard bewegt wird."

Anlass: ein über `_castSpellImmediately` gewirkter Zauber (Difficulty
Lever, Friedhelm, jede Zusatzaktion über `performImmediateAction`)
landete am Ende still im Stapel. v938 hatte dort nur `from: 'deck'`
abgedeckt — mit der Begründung, aus der HAND sehe man die Karte ja
verschwinden. Das stimmt hier nicht: die Hand schrumpft schon VOR der
Auflösung (der Splice steht ganz oben in der Funktion), und am Schluss
bewegt sich nichts mehr.

**★ DIE KARTE BLEIBT IN DER HAND, BIS DER ZAUBER WIRKLICH AUFLÖST
(v979, Als Vorgabe 12.9.).** Bis v978 wurde sie ganz oben aus der Hand
geschnitten — beim Difficulty Lever also schon bei der Caster-Wahl, und
sie fehlte während der gesamten Zielwahl. **Entnahme UND Flug stehen
jetzt am Ende**, in dem Moment, in dem der Zauber auflöst (Flug vor dem
Splice, Hausregel 17.8.).

Drei Folgen, alle gewollt:
* **Abbruch lässt die Hand völlig unberührt** — kein Zurücklegen, kein
  Hin- und Rückflug. Genau richtig für einen „Back"-Weg.
* **Die Wisdom-Abfrage nimmt die Karte kurz heraus** und legt sie danach
  auf ihren Platz zurück — sonst könnte der Spieler ausgerechnet den
  Zauber abwerfen, den er gerade wirkt.
* **Am Ende wird nach dem Namen gesucht.** Hat der Effekt die Karte
  selbst schon aus der Hand bewegt (ein Zauber, der die eigene Hand
  abwirft, liegt ja noch mit drin), findet die Suche nichts und wir
  rühren sie nicht an — ohne diese Prüfung läge sie doppelt in der
  Ablage.

Der DECK-Fall entnimmt weiter sofort (dort gibt es keinen Handplatz, der
stehenbleiben könnte, und `deck_search_add` zeigt die Karte ohnehin von
Anfang an); sein Flug bleibt am Ende.

**Für neue Karten:** wer selbst `discardPile.push(...)` macht, sendet
davor den passenden `play_pile_transfer` (`from: 'hand' | 'deck' |
'support'`, `to: 'discard'`). Die Regel gilt für jeden Weg, nicht nur
für den bequemen.


## ★ FEHLERKLASSE: ABGEBROCHEN, ABER TROTZDEM VERBRAUCHT (v981)

Zwei Erscheinungsformen derselben Sache — der Spieler bricht ab, die
Karte ist trotzdem weg:

| Kartentyp | Was der Abbruch melden MUSS |
|---|---|
| Spell / Attack (Handweg) | `gs._spellCancelled = true` — nur das legt die Karte zurück auf die Hand |
| Artifact (nicht Equipment) | `return { cancelled: true }` aus `resolve` — ein bloßes `false` bezahlt und legt ab |

**Die ctx-Helfer erledigen den Spell-Fall selbst:**
`ctx.promptDamageTarget` (opt-out `noSpellCancel`) und
`ctx.promptMultiTarget` setzen `_spellCancelled`, wenn der Spieler
abbricht. **Wer den ROHEN Wähler benutzt** (`engine.promptEffectTarget`,
`engine.promptGeneric`, `ctx.promptCardGallery`, `ctx.promptZonePick`),
**muss es von Hand tun** — genau daran scheiterte „Dangerous Knowledge".

**Wächter `check-spell-cancel.js`** (neu): meldet Spell-/Attack-Skripte
mit rohem, abbrechbarem Wähler, die `_spellCancelled` nie erwähnen.
Reaction-, Area- und Surprise-Subtypen sind ausgenommen (sie kehren nie
auf die Hand zurück), ebenso Karten, die zusätzlich einen ctx-Helfer
benutzen. Die verbleibenden sieben Treffer sind **einzeln nachgelesen**
und stehen mit Begründung in der Ausnahmeliste des Wächters (Prompt im
Brett-Hook, Frage an den Gegner, Deck-Suche mit `minSelect: 0` …). Neue
Karten mit dem echten Fehler schlagen damit auf.

## Tooltip: „Also has the effects of …" (v981, Als Vorgabe 12.9.)

Ein Held, der fremde Heldeneffekte mitträgt, nennt sie jetzt im
Hover-Tooltip — die NAMEN ganz oben, direkt über dem Kartentext, die
vollen Texte darunter im vorhandenen „Inherited Effects"-Block.

Vertrag: **`hero.gainedEffectNames`** (Array von Kartennamen am
Helden-Objekt, wird mitsynchronisiert). Der Client baut daraus die
Kopfzeile (`_copiedHeroes`) und die geerbten Texte
(`_inheritedEffects`). Nötig, weil die Wissens-Instanz von Dangerous
Knowledge ohne Zonenplatz liegt und auf dem Brett unsichtbar ist — ohne
diese Zeile sähe der Spieler nirgends, was sein Held gelernt hat.


## ★ TOT, ABER NOCH IN DER ZONE (v982, Als Befund 12.9.)

`zone === 'support'` ist KEIN Lebensnachweis. Der Tod einer Kreatur wird
im Schadens-Batch erst NACH der laufenden Hook-Runde vollzogen — bis
dahin steht die Instanz noch in ihrer Zone und hat nur 0 HP.

Aufgefallen bei **Pyraga**: haben beide Spieler eines und das erste
erschießt das zweite, hängt das tote am SELBEN Auslöser und kam
trotzdem dran — es feuerte aus dem Grab.

**Merksatz für jeden Hook-Lauscher auf dem Brett:** wer prüft, ob er
noch da ist, prüft Zone UND HP-Stand (und ob die Instanz noch getrackt
ist):

```js
function lebt(engine, inst) {
  if (!inst || inst.zone !== 'support') return false;
  if ((inst.counters?.currentHp ?? 0) <= 0) return false;
  return engine.cardInstances.includes(inst);
}
```

Und die Prüfung gehört vor JEDEN Schritt, nicht nur an den Anfang: bei
einem „you may" mit Zielwahl können zwischen Rückfrage und Schlag zwei
weitere Fenster vergehen, in denen der Lauscher selbst fällt (im Repro
beide Fälle festgehalten).


## ★ „ZWEITE AKTION" — PHASE ODER ZUG? (v983, Als Präzisierung 12.9.)

`_actionsPlayedThisPhase` zählt **nur in der Action Phase**. Eine
Zusatzaktion aus einer MAIN PHASE (Quick Attack, Dangerous Knowledge)
taucht dort gar nicht auf — und damit sah ein Zweitaktions-Zuschlag nach
der einen Aktion der Action Phase immer noch „erst eine Aktion".

Neu daneben: **`ps._actionsPlayedThisTurn`**, hochgezählt in `runHooks`
beim `onAnyActionResolved` (die eine Stelle, durch die JEDER Aktionspfad
läuft, phasenunabhängig), gefiltert mit derselben Auslegung von „ist das
eine Aktion", die auch Bleed benutzt (`_bleedTriggersForAction` —
Artefakte und Potions zählen also nicht). Zurückgesetzt zu Zugbeginn
neben `heroesActedThisTurn`.

**Opt-in je Zuschlag:** `secondActionOfTurn: true` in den Optionen von
`secondActionGrant`. `_isSecondActionGrantAvailable` verlangt dann
zusätzlich `_actionsPlayedThisTurn === 1`. **Zuschläge ohne die Flagge
bleiben bei der alten, phasenbezogenen Regel** — Duignos strengere
Lesart schaltet fremde Effekte ausdrücklich NICHT ab.

**★ Und der Zuschlag muss verpuffen, nicht nur stumm bleiben.** Der
gemeinsame `onActionUsed` des Shared-Moduls hält den Spieler über
`_preventPhaseAdvance` in der Action Phase fest, solange ein Zuschlag
lebt — ein unbenutzbarer Zuschlag sperrt ihn dort ein (die Phase endete
nicht). Duigno fängt den Hook deshalb ab und lässt den Zuschlag
ablaufen, BEVOR der gemeinsame Hook die Phase offenhält.

**★ ZEITPUNKT: `onActionUsed` feuert VOR `onAnyActionResolved`** (v984,
Als Befund). Der Zugzähler hat die gerade gespielte Aktion beim
`onActionUsed` also noch NICHT gesehen. „Diese Aktion war die erste des
Zuges" heißt dort deshalb **Zähler === 0**, nicht === 1 — mein erster
Anlauf prüfte auf `> 1` und lief immer zu spät, die Phase blieb offen.
Wer im `onActionUsed` mit dem Zähler rechnet, muss die laufende Aktion
selbst dazuzählen.


## ★ ZWEI LÖCHER IM PHASENWECHSEL (v985, Als Befund 12.9.)

Wer Duigno frisch beschwor und dann die zweite Aktion nahm, saß in einer
aktionslosen Action Phase fest. Zwei unabhängige Ursachen:

**1. `_preventPhaseAdvance` ist EINMALIG — der Kreaturweg verbrauchte es
nie.** `doPlaySpell` prüft das Flag und löscht es danach;
`doPlayCreature` tat weder das eine noch das andere. Eine Kreatur, die
beim Beschwören einen Zweitaktions-Zuschlag gibt (Duigno), SETZT es
aber — und es blieb liegen und verschluckte den Phasenwechsel nach der
nächsten Aktion. `doPlayCreature` hat jetzt dasselbe `delete` am Ende
seines Advance-Blocks. **Jeder neue Aktionspfad muss das Flag
verbrauchen.**

**2. `advanceToPhase` blieb bei jedem VORHANDENEN Zuschlag stehen, nicht
nur bei einem EINLÖSBAREN.** Der Riegel, der den Spieler nach Aktion 1
in der Action Phase hält, scannte nur auf `isSecondActionGrant` — ein
Zuschlag mit strengerer Bedingung (`secondActionOfTurn`) kann da längst
tot sein. Er fragt jetzt zusätzlich `_isSecondActionGrantAvailable`.


## Neue Karte: „Gravedigger" (v986)

Creature, Summoning Magic **Lv 0** (von 1 gesenkt, Als Anpassung 12.9.),
20 HP. „When you summon this Creature, your opponent must send the top 3
cards from their deck to the discard pile OR delete 8 cards from their
discard pile (their choice). You may once per turn send the top card of
your opponent's deck to the discard pile."

**★ DER GEGNER WÄHLT, ALSO LÄUFT DER PICKER BEI IHM** — und damit in
einem fremden Zug: `beginHumanWait` / `endHumanWait` um beide Abfragen,
sonst läuft seine Bedenkzeit gegen die Zug-Uhr des Ausspielenden.

**★ „delete 8 cards" ist eine ZAHL, keine Geste.** Liegen weniger als
acht Karten in seiner Ablage, kann er den Weg gar nicht gehen — dann
wird er nicht angeboten und der Mill passiert ohne Rückfrage. WELCHE
acht sagt der Text nicht; weil die Wahl den Wert stark ändert, wählt der
Gegner sie selbst (`cardGalleryMulti` mit `selectCount: 8`, nicht
abbrechbar — die Entscheidung für diesen Weg ist schon gefallen).
Kommt keine oder eine zu kleine Auswahl zurück, trifft es die obersten
acht.

**Löschen aus der Ablage** über den kanonischen Dreischritt (Muster
`_rebelliokai-shared`): `takeFromPileSync`, dann
`discard_to_deleted_animation`, nach dem Flug in den Gelöscht-Stapel.
Alle acht in EINEM Broadcast, damit der Client sie gestaffelt fliegen
lässt — acht Einzelbroadcasts wären acht überlagerte Flüge.

**Teil 2** ist ein aktiver Kreatureffekt (`creatureEffect`): „You may
once per turn" — die Sperre stempelt die Engine selbst. Beide Mills
laufen über `actionMillCards` (Deck-Sperre `pileOutAllowed` und
Mitten-Aufdeckung inklusive).


## ★ DISCARD-WERT-LERNKANAL (v987, Als Auftrag 12.9.)

**Befund:** „Was ist eine Karte in MEINER Ablage wert?" war bisher NICHT
lernbar. Es gab nur `cpuMeta.pileFuel` — von Hand geschriebene Zahlen
auf der VERBRAUCHENDEN Karte (Soul Shards, Cute Phoenix). Ein Deck, das
aus der Ablage lebt (Necromancy, Skelette) oder sie als Treibstoff
nutzt, konnte den Wert seiner eigenen Ablage nicht aus Ergebnissen
lernen.

**Neu, vier Teile:**

| Stelle | Was |
|---|---|
| `_deck-profile.discardCardValue(engine, pi, card)` | gelernter Wert aus `profile.discardValueRules[card]`; ohne Regel eine BERECHNETE Ersatzzahl aus passenden `pileFuel`-Quellen und `reviveBonus` |
| `_deck-profile.discardPileValue(engine, pi)` | Summe des **gelernten** Anteils (`learnedOnly`) — das Eval liest nur diesen, damit ohne Training nichts kippt und `pileFuel` nicht doppelt zählt |
| `_train-recorder` | `discardCardFates` (je Karte: gelöscht/behalten) und `discardChoices` (Weg + Lage-Tags) |
| `train-deck-profile` | fittet daraus `discardValueRules` (Arme: gelöscht vs. behalten) und `discardVsMillRules` (Arme: delete vs. mill, je Tag) |

**★ Kopien zählen, nicht Namen:** die Ablage enthält Doppelte. Ein
Namens-Set würde jede Kopie als „gelöscht" markieren, der
Behalten-Arm bliebe leer und der Fit wäre wertlos. Die Lernspur zählt
deshalb pro Name ab (im Repro festgehalten: 12 Karten → 8 gelöscht,
4 behalten).

Dazu zwei Kennzahlen für „wie knapp ist mein Deck?", die jede
Mill-Entscheidung braucht: **`deckDrainPerTurn`** (Startgröße minus
jetzige Größe, geteilt durch die eigenen Züge, Untergrenze 1) und
**`deckTurnsLeft`** (Deckgröße geteilt durch den Abfluss). Die absolute
Kartenzahl sagt allein nichts — 20 Karten sind viel oder wenig, je
nachdem, wie schnell sie verschwinden.

**Gravediggers Entscheidung** (Als drei Regeln) sitzt in
`gravediggerWeg` und liest genau diese Kennzahlen: Deck gefährlich klein
→ nie millen; Ablage ist Treibstoff (Gesamtwert hoch) → fast immer
millen; acht wertlose Karten da → löschen. Darüber liegt der Lernkanal
`discardVsMillDecision`, der die Heuristik übersteuert, sobald das
Profil Regeln hat. Beim Löschen wählt die CPU die BILLIGSTEN acht
(aufsteigend nach `discardCardValue`).


## Neue Karte: „Inconspicuous Lawn Gnome" (v988)

Creature, Summoning Magic Lv 0, 50 HP. „You may once per turn change
this card's level in your hand or on your side of the board to any level
from 0 to 3."

**★ ZWEI ORTE, ZWEI VERTRÄGE.** Die Karte ist in der HAND und auf dem
BRETT aktivierbar:
* Hand: `handActivatedEffect` + `handActivateLabel` + `canHandActivate`
  + `onHandActivate(ctx)` mit `ctx.handIndex` (Muster Luna Kiai) — die
  Karte wird angeklickt, ohne gespielt zu werden.
* Brett: `creatureEffect` + `onCreatureEffect`.

**★ GESETZT, NICHT GESENKT — neuer Engine-Vertrag (v988).** Die
vorhandene Levelmechanik kennt nur REDUKTIONEN (`reduceCardLevel`,
`_handLevelOffsets`, `_magicLevelReductions`) und den heldengebundenen
`levelOverrideCards`. Für „auf Stufe N setzen" gibt es jetzt:

| Ort | Speicher | Gelesen von |
|---|---|---|
| Hand | `inst.counters.levelSet` an der HANDINSTANZ | `_handLevelSetFor` — aufgerufen in `heroMeetsLevelReq` UND `effectiveCardLevel` |
| Brett | `counters._cardDataOverride` mit geänderter `level` | `getEffectiveCardData` (bestehend, s. Boulder in a Bottle) |

**An der INSTANZ, nicht am Handplatz** — so überlebt die Setzung jedes
Nachrutschen der Hand (im Repro geprüft). Mit `opts.handIdx` gilt genau
diese Kopie, ohne ihn die niedrigste im Bestand — dieselbe „wenn
IRGENDEINE Kopie spielbar ist"-Lesart, die die Offsets daneben schon
benutzen.

**Die Stufe darf auch STEIGEN**, und das ist kein Unsinn: manche Effekte
verlangen eine MINDESTstufe (Tribute, „Creature of level 2 or higher").
Die CPU setzt auf 0 — damit ist der Gnom immer beschwörbar, und mehr
will sie von ihm nicht.


## ★ FEHLERKLASSE: STUFE AUS DER DATENBANK STATT AUS DER INSTANZ (v989)

Eine Karte auf dem Brett kann eine ANDERE Identität tragen als ihr
Datenbankeintrag — `counters._cardDataOverride`: der Lawn Gnome setzt
seine Stufe frei, Boulder in a Bottle ist als Potion getrackt und auf
dem Brett eine Lv-3-Kreatur, Biomancy-Token tragen den Namen ihrer
Potion. Wer `cardDB[inst.name].level` liest, rechnet mit der GEDRUCKTEN
Stufe. **Garius und Brackle lasen den Gnom deshalb immer als Level 0**
(Als Befund 12.9.).

**`effectiveCardLevel` nimmt jetzt die Instanz entgegen:**

```js
engine.effectiveCardLevel(cd, pi, { heroIdx, inst })   // inst schlägt cd
engine.getEffectiveCardData(inst).level                // direkt
```

Steht `opts.inst`, ersetzt die wirksame Kartenidentität das übergebene
`cardData` — der Rest der Rechnung (Hand-Setzungen, Offsets,
Reduzierer) läuft unverändert darauf weiter.

**Nachgezogen:** Garius (Opferstufe und CPU-Sortierer), Divine Gift of
the Deepsea (zwei Stellen), Deepsea Castle, Shapeshift, Diplomacy,
Sabrina. `getSacrificableCreatures` war schon richtig (seit dem
Kyli-Fix) — Brackle bekam seinen Wert also von dort und war nur
mittelbar betroffen.

**Wächter `check-level-source.js`** (neu): meldet Kartenskripte, die
eine Kartendatenbank mit `…inst.name` nachschlagen und das Ergebnis nach
`.level` fragen oder an `effectiveCardLevel` reichen, ohne die Instanz
mitzugeben. **Für jede künftige Karte mit adaptiver Stufe ist das der
Unterschied zwischen „funktioniert" und „funktioniert scheinbar".**


## Neue Animation: `promotion_burst` (v990, Als Vorgabe 12.9.)

Garius' Tausch bekommt eine GROSSE Beförderung — und zwar **auf der
Support Zone, in der getauscht wurde**, nicht auf Garius' Heldenzone.
Aufbau von unten nach oben, weil es hinauf geht: Lichtsockel unter der
Zone, Säulenschacht (`clipPath`-Trapez, `scaleY` vom Boden aus), drei
Aufstiegsringe nacheinander, 26 Funken, die IM Schacht aufsteigen (nicht
herabfallen), und ein goldener Kranz, der sich zum Schluss schließt.

Der kleine `gold_sparkle` auf Garius' Heldenzone bleibt — er sagt, WER
das veranlasst hat; die große Animation sagt, WO es passiert ist.

**Klang** zweilagig: `buff` tief und sofort für den Sockel, `gold_gain`
bei 540 ms für den Kranz (ohne Kategorie, mit Namens-Dedupe).
`duration: 1400` in der Nutzlast, sonst hängt die Komponente nach
1000 ms ab.


## Neue Karte: „Zhigao, the Heavenly Emperor" (v991)

Hero, 300 HP / 0 ATK, Divinity + Divinity. „If this is one of your
starting Heroes, you may only bring 1 other starting Hero to the game.
This Hero may perform a second Action during each of your Action Phases."

**Teil 1 ist DECKBAU, kein Spielzug.** Mit Zhigao im Team besteht die
Aufstellung aus GENAU ZWEI Helden. Umgesetzt in `app-shared.jsx`, wo
alle Aufstellungsgrenzen wohnen: `requiredHeroCount(deck)` (2 statt 3),
eine eigene Fehlermeldung in `isDeckLegal`, und in `canAddCard` die
Sperre gegen den dritten Helden (in beide Richtungen — auch Zhigao
selbst passt nicht mehr dazu, wenn schon zwei andere stehen).

**Im Deck-Editor ist der übrige Platz DURCHGEKREUZT** (v992/v993, Als
Vorgabe 12.9.) — **und zwar ab dem Moment, in dem Zhigao im Team steht,
nicht erst wenn zwei Helden dastehen**: die Sperre hängt an der
KAPAZITÄT (`heroes.length - requiredHeroCount`, gesperrt werden die
hinteren FREIEN Plätze), nicht an der Belegung. Zhigao allein heißt
schon „−1 Platz", und das soll man sehen — und zwar in derselben Optik wie eine von „Boulder in a
Bottle" blockierte Support Zone: dunkelroter Verlauf, gestrichelter
roter Rand, großes rotes ✕ (`.db-hero-slot-blocked` in `style.css`,
Farben wörtlich aus dem `_ZoneBlocked`-Zweig in `app-board.jsx`
übernommen). **„Hier geht nichts" soll im ganzen Spiel gleich
aussehen.** Auch die Kopfzeile zählt gegen 2 statt 3 — sie liest
dieselbe `requiredHeroCount`, es gibt nur EINE Quelle für die Sollzahl.

**★ ZHIGAO ZÄHLT NUR DIE ACTION PHASE, DUIGNO DEN GANZEN ZUG** (Als
Vorgabe 12.9.). Beide benutzen `_second-action-shared`; der Unterschied
ist genau eine Option:

| Karte | Option | Bedeutung |
|---|---|---|
| Duigno | `secondActionOfTurn: true` | im GANZEN ZUG darf erst eine Aktion gelaufen sein — eine Main-Phase-Zusatzaktion verbraucht ihn |
| Zhigao | (weggelassen) | Grundregel „zweite Aktion DIESER Action Phase" — Main-Phase-Aktionen sind ihm egal |

Dazu `heroRestricted: true`: „THIS Hero may perform" — die zweite
Aktion gehört Zhigao, nicht der Aufstellung.

**★ BEIDE MEINEN DIESELBE ZWEITE AKTION.** Wer Duignos Zuschlag
einlöst, hat seine zweite Aktion verbraucht; Zhigaos Zuschlag steht dann
zwar noch da, ist aber nicht mehr einlösbar, und die Action Phase endet.
Dafür sorgt die Engine, nicht die Karte: die beiden
`hasMoreSecondAction`-Prüfungen in `server.js` fragen seit v991 nicht
mehr „gibt es noch einen Zuschlag?", sondern **„gibt es noch einen
EINLÖSBAREN?"** (`_isSecondActionGrantAvailable`) — dieselbe Korrektur,
die `advanceToPhase` in v985 bekam. Ohne sie säße der Spieler in einer
aktionslosen Action Phase fest.


## „Barkeeper" — neuer Effekt (v994, Als Vorgabe 12.9.)

Creature, Summoning Magic Lv 0, 30 HP. Kompletter Effekttausch: „When
you summon this Creature, you may add copies of \"Beer\" from outside
the game to your hand until your hand contains 7 cards."

**★ „FROM OUTSIDE THE GAME" — die Karten kommen aus KEINEM Stapel,
also auch OHNE FLUG** (v995, Als Vorgabe 12.9.). Eine Karte ohne
Herkunftsort kann nirgendwoher fliegen; vorher sprang der
Handzuwachs-Erkenner ein und liess sie aus der GEGNERHAND anfliegen —
dieselbe Fehlerklasse wie beim Deck-Peek (v969).

Der Weg jetzt: `card_reveal` (beide sehen, WAS kommt) →
**`hand_card_materialize`** → `hand.push` + `_trackCard`. Das neue
Ereignis tut zweierlei: es bucht beim Besitzer die Gutschrift auf
`stealSkipDrawRef` (damit der Erkenner keinen Flug erfindet) und zeigt
**auf der gerade erschienenen Karte** ein warmes Aufleuchten mit
Lichtring und 16 aufsteigenden Funken.

**★ Zwei Feinheiten dabei (v996, Als Befunde):**
* **★ KEIN INDEX AUS DEM SOCKET-HANDLER (v999).** Der erste Anlauf
  merkte sich dort `gameState.players[myIdx].hand.length` als künftigen
  Handplatz — aber **`gameState` ist im Handler STALE**: der
  Effekt-Haken hängt nicht an jeder Zustandsänderung. Die Marke landete
  auf einem falschen Platz (eine Karte: gar keine Animation; mehrere:
  nur eine). Jetzt zählt der Handler bloss **wie viele** Karten gerade
  erscheinen (`handFxPending`), und der RENDERER entscheidet welche:
  die letzten n der AKTUELLEN Hand, denn neue Karten werden hinten
  angehängt. **Wer in einem Socket-Handler mit `gameState` rechnet,
  rechnet mit einem alten Stand.**
* **★ GAR NICHT MESSEN — RECHNEN** (v998, nach zwei Fehlversuchen).
  `.game-hand-cards .hand-slot` ist `flex: 0 1 68px` mit
  `min-width: 18px`: bei voller Hand schrumpfen die Plätze, und die
  64×90-Karten ragen über ihren Platz hinaus. Beide
  `getBoundingClientRect`-Anläufe (erst der Slot, dann die Karte darin)
  landeten am linken Kartenrand. Der Effekt hängt jetzt IM Handplatz
  (`.hand-slot` ist `position: relative`) und sitzt per CSS auf
  `left: calc(32px * var(--board-scale))` /
  `top: calc(45px * var(--board-scale))` — der Mitte einer 64×90-Karte.
  **Kein DOM, keine Messung, kein Versatz; für jeden Effekt auf einer
  Handkarte der richtige Weg.** Die gemessene Variante bleibt nur für
  die Gegnerseite, wo es keine Handindizes gibt.
* **Die Karte fädet von 100 % Transparenz ein**
  (`.hand-card-materializing`, 760 ms) — sie fällt ja nicht ein,
  sondern entsteht. **Jede Karte, die von ausserhalb des Spiels kommt, nimmt diesen
Weg** — Crestina ist mit umgestellt. Karten, die aus dem DECK auf die
Hand gehen, behalten `deck_search_add` (dort ist der Flug richtig).

Bewusst **nicht** `actionAddCardFromDeckToHand` — die Karte lag nie in
einem Deck, und der Stapel-Weg würde sie dort suchen (im Repro
mitgeprüft: Deck und Ablage bleiben unberührt).

**★ „UNTIL YOUR HAND CONTAINS 7 CARDS" ist ein AUFFÜLLEN**, keine feste
Zahl. Gezählt wird die Hand NACH der Beschwörung — der Barkeeper selbst
ist da schon draußen. Bei 7 oder mehr Karten passiert nichts und es wird
auch nicht gefragt; bei leerer Hand sind es sieben Beer.

Ausgeschenkt wird **einzeln**, mit Auftritt und Flug je Kopie und 220 ms
Takt — ein Sammelbroadcast wäre eine einzige Karte, die aus dem Nichts
auf sieben springt.


## Neue Karte: „The Hands of Big Gwen" (v1000)

Artifact / **Equipment**, Kosten 20. „The equipped Hero's Attack stat is
increased by 10. Once per turn, when the equipped Hero hits one or more
targets with an Attack, its controller may choose a card from their
discard pile that is not an Attack and add it to their hand."

**ATK-Zuschlag über den Ausrüstungs-Dreiklang** (Muster Blade of the
Swamp Witch): `ctx.grantAtk` beim Anlegen, dasselbe in `onGameStart`
(Puzzle-Aufbau, wenn die Karte schon liegt), `ctx.revokeAtk` beim
Verlassen der Zone. **Kein `_applyHeroAtkDelta`** — der wäre DAUERHAFT,
die Ausrüstung gibt aber nur, solange sie liegt.

**★ „HITS one or more targets" — nicht „defeats".** Ausgelöst wird,
sobald der Angriff bei irgendeinem Ziel ANKOMMT; das Ziel darf
weiterleben. Ein Angriff mit mehreren Zielen fragt trotzdem nur EINMAL:
Marke an der Quelleninstanz des Angriffs (Wavilion-Muster).

**„Once per turn" ohne Zusatz = WEICH, je Instanz** (v249). HOPT mit der
Karten-ID, beansprucht erst beim Zugriff — ein abgelehntes „may" bleibt
im selben Zug nutzbar (Sacrificial-Dagger-Muster).

**„not an Attack"** filtert über den KARTENTYP (`cardType === 'Attack'`),
nicht über den Subtyp. Sind nur Attacks in der Ablage, wird gar nicht
gefragt.

**„its controller"** ist der Spieler, der den HELDEN kontrolliert — an
einen gegnerischen Helden angelegt gehört die Rückholung ihm
(`physicalSide`, wie bei Hat of Madness). Die CPU nimmt die teuerste
Karte zurück.


## Neue Karte: „Pillar of Light" (v1001)

Spell, Magic Arts Lv 1. „Declare a card name. Your opponent must search
their deck for a card with that name and add it to their hand, if
possible. If they find a card with the declared name, this counts as an
additional Action and you may draw a card. You can only play 1 \"Pillar
of Light\" per turn."

Namensansage über `cardNamePicker` (Accusation-Muster, volle Liste ohne
Tokens); Abbruch meldet `gs._spellCancelled`. Gesucht wird mit
`baseCardName`, damit Farbvarianten mitzählen.

**★ DIE ZUSATZAKTION IST BEDINGT** (Als Vorgabe 12.9.) — in zwei Stufen:

**1. Spielbarkeit.** Die Karte ist nur dann eine Zusatzaktion, wenn
DANACH noch eine reguläre Aktion zur Verfügung steht — `inherentAction`
als FUNKTION statt als `true`. Als verfügbar zählt die Aktion der
Action Phase, solange sie offen ist, und ein EINLÖSBARER
Zweitaktions-Zuschlag (Zhigao, Torchure, Duigno). Ohne kommende Aktion
gäbe es nichts zu verrechnen, also ist die Karte dann gar nicht
spielbar (`spellPlayCondition` prüft dieselbe Bedingung — in Main
Phase 1 zählt „in diesem Zug noch nicht gehandelt", in Main Phase 2 ist
Schluss).

**2. Auflösung.** Findet der Gegner die Karte, BLEIBT es eine
Zusatzaktion — die kommende Aktion ist unangetastet, dazu der optionale
Zug. Findet er nichts, wird sie NACHTRÄGLICH verbraucht: der Held kommt
in `heroesActedThisTurn`, der Phasenzähler steigt, und in der Action
Phase geht es weiter.

**★ DER VERBRAUCH LÄUFT NACH DER AUFLÖSUNG, NICHT DARIN** (v1003, Als
Befund). `advanceToPhase` weist JEDEN Phasenwechsel ab, solange
`_spellResolutionDepth > 0` — und der läuft während `onPlay`. Mein
erster Anlauf rief den Wechsel deshalb ins Leere: im Repro (ohne
Tiefenzähler) sah alles grün aus, im Spiel passierte nichts. Die Karte
setzt jetzt nur die Marke **`gs._pendingActionBurn = { pi, heroIdx }`**;
abgearbeitet wird sie nach dem Freigeben der Tiefe — in `doPlaySpell`
neben `_spellEndsTurn` (gleiche Bauform, gleicher Grund) und in der
Sofort-Cast-Brücke, über die ein Zauber ebenfalls laufen kann
(Difficulty Lever, Friedhelm).

**Neue Engine-Methode `burnUpcomingAction(playerIdx, heroIdx)`** macht
die drei Schritte für alle Karten dieser Bauart:

**★ AUS DER MAIN PHASE 1 HERAUS SPRINGT DER ZUG ZUERST IN DIE ACTION
PHASE**: dort liegt die Aktion, die verbraucht wird.
Der Wechsel ist dabei kein Beiwerk — er fährt `onPhaseStart`, und genau
daran hängen die Zweitaktions-Zuschläge (Zhigao grantet erst beim
Betreten der Action Phase). Ohne diesen Schritt säße der Spieler in der
Main Phase 1 fest und hätte die Aktion trotzdem verloren.

**★ Wohin es danach geht, entscheidet `advanceToPhase(pi, 4)` von
selbst.** Der Riegel dort hält den Spieler in der Action Phase, wenn ein
einlösbarer Zweitaktions-Zuschlag offen ist, und lässt ihn sonst in die
Main Phase 2 — genau die zwei Fälle aus Als Vorgabe, ohne eigenen
Nachbau. (Der Phasenzähler wird beim Verlassen der Action Phase von der
Engine selbst zurückgesetzt; wer ihn danach prüft, sieht 0.)

**„1 pro Zug"** als HOPT-Schlüssel je Spieler, gesetzt nach der
Namensansage — ein Abbruch verbraucht die Grenze nicht.


## Neue Karte: „Mission of the Light Brigade" (v1004)

Spell, Support Magic Lv 4. „You may perform up to 2 additional Actions
this turn. You cannot perform any other additional Actions this turn."

**★ ALLES, WAS NICHT DIE ERSTE AKTION DER ACTION PHASE IST, IST EINE
ZUSATZAKTION** (Als Auslegung 12.9.) — auch „zweite Aktionen" (Zhigao,
Duigno, Torchure) und auch INHÄRENTE (Quick Attack).

**Daraus folgt die Spielbarkeit:** Mission kann NUR die erste Aktion der
Action Phase sein — in jedem anderen Fall wäre ihr eigener Einsatz schon
eine Zusatzaktion und bräche ihre eigene Bedingung.

**★ Und „erste Aktion" heißt erste Aktion des ZUGES** (v1006, Als
Präzisierung): wer vorher schon eine Zusatzaktion ausgegeben hat — Quick
Attack in einer Main Phase, Dangerous Knowledge, ein Zuschlag —, kann
Mission diese Runde nicht mehr spielen. Dafür taugen die Phasenzähler
nicht: `_actionsPlayedThisPhase` zählt nur in der Action Phase, und
`heroesActedThisTurn` bekommt von einer inhärenten Aktion nichts mit.
Gelesen wird **`_actionsPlayedThisTurn`** (der Zugzähler aus v983, der
jeden Aktionspfad sieht) — zusätzlich zu den beiden anderen.

**Die zwei Aktionen sind ein normaler Zuschlag-Typ mit ZWEI Ladungen**
(`aaGrants[typeId]` ist eine ZAHL, nicht nur ein Flag) — so greift die
ganze vorhandene Maschinerie ohne Nachbau: Menü, Auswahl, Verbrauch,
Rücknahme bei Abbruch. Kategorien: alle fünf.

**★ TRÄGER IST DIE EIGENE INSTANZ + `gs._spellKeepInstance = true`**
(v1005, Korrektur). Ein Zauber, dessen Wirkung an seiner INSTANZ hängt,
sagt das dem Spielweg — dann wandert sie in die Ablage, statt untracked
zu werden (Muster Weapon Unleashing, v808). Mein erster Anlauf legte
eine eigene Phantom-Instanz an; die überlebte den Spielweg nicht, und
mit ihr fielen Anzeige UND Sperre aus.

**★ ZWEI ZAHLEN, EINE FÜHRENDE.** Die Ladungen an der Instanz braucht
die Zuschlag-Maschinerie (Menü, Auswahl, Rücknahme bei Abbruch);
**Anzeige und Inhärenz-Tor lesen `ps._missionCharges`**, damit sie auch
dann stimmen, wenn die Instanz aus irgendeinem Grund verschwindet. Das
`onConsume` des Typs hält beide zusammen, und der inhärente Weg senkt
den Spielerzähler notfalls direkt (im Repro festgehalten: Instanz
untracked → Anzeige, Sperre und Verbrauch laufen weiter).

**Die Sperre fremder Zuschläge** ist eine Spielermarke
(`ps._missionLockTurn = gs.turn`), ausgewertet in der Engine über
`missionLockActive` / `missionChargesLeft`. Drei Berührungspunkte:

| Stelle | Wirkung unter der Sperre |
|---|---|
| `getAdditionalActions`, `findAdditionalActionForCard`, `findAdditionalActionForCategory` | lassen nur noch Missions Typ durch |
| `cardHasInherentAction` | verneint, sobald keine Ladung mehr da ist — **Quick Attack ist dann nicht mehr spielbar** |
| `runHooks('onAnyActionResolved')` | zieht bei einer INHÄRENTEN Aktion eine Ladung ab |

Der letzte Punkt ist der unauffällige: die ausdrücklich GEWÄHLTEN
Zusatzaktionen bucht `consumeAdditionalAction` selbst, der inhärente Weg
kennt aber gar keinen Verbrauch — ohne diesen Haken wären Quick Attacks
unter Mission gratis (im Repro beide Fälle festgehalten, inklusive „kein
doppelter Abzug").

**Anzeige:** `missionActions` in beiden Spieler-Projektionen, gerendert
in der Leiste oben links (🎺, mit Restzahl und dem Hinweis, dass keine
anderen Zusatzaktionen möglich sind).


## „Dance of the Flame Pillars" — GENAU X Ziele (v1005, Als Befund 12.9.)

„Choose as many different targets as there are …" ist eine ZAHL, kein
Höchstwert: wer wählen kann, MUSS voll wählen. `min: N` statt `min: 1`
in der Mehrfachwahl (`min === max`), und der Prompttext sagt „Choose N",
nicht „up to N".

Der Fall „weniger Ziele auf dem Brett als Zauber in der Ablage" ist eine
Zeile darüber schon abgefangen — dort schlägt die Karte flächendeckend
mit 150 zu. Im Mehrfach-Zweig stehen also immer mindestens N Ziele.


## Neue Karte: „Breaking Strike" (v1007)

Attack, Fighting Lv 1. „Discard any number of Artifacts equipped to the
user and choose a target. This Attack deals the user's Attack stat times
the number of discarded Artifacts to that target."

Bauform von **Weapon Storm**: `hooks.onPlay`, `ctx.cardHeroIdx` ist der
Nutzer, Abwurf über die Brett-Schleife aus `_ability-cost-shared` — hier
aber nur `kinds: ['equip']`, denn der Text nennt ausschließlich
Artefakte. Ohne Ausrüstung ist der Angriff nicht spielbar
(`canPlayWithHero`).

**★ DER ATK-WERT WIRD ERST NACH DEM ABWURF GELESEN** (Als Vorgabe
12.9.). Das ist keine Feinheit, sondern die halbe Karte: die
abgeworfenen Artefakte sind häufig genau die, die den Angriff erhöhen.
`hero.atk` steht deshalb NACH der Schleife, nicht davor. Im Repro
festgehalten: ATK 200 mit zwei +50-Waffen → beide abgeworfen → 100 × 2 =
**200**, nicht 400.

**Animation `glass_blade_shatter`** (Als Vorgabe): Schwertstreich, der
klirrend Glasscherben hinterlässt. **★ Die Klinge sitzt MITTIG auf dem
Ankerpunkt** (`top: -5` bei Höhe 10, v1008) — mein erster Anlauf setzte
sie auf `-hh * 0.7` und damit weit über die Zielkarte; der Schlag muss
durch SIE gehen. Drei Takte — die Klinge fährt als
schmaler glasiger Streifen schräg durchs Bild, am Einschlag blitzt ein
weißer Riss auf, 22 dreieckige Scherben stieben auseinander und fallen
dabei (Schwerkraft-Zuschlag auf die Senkrechte), jede mit eigener
Drehung. Klang zweilagig: `slash` sofort, `elem_ice` hoch abgespielt bei
220 ms fürs Klirren — der Katalog hat keinen Glasklang, die Eislage
kommt dem Splittern am nächsten.

**★ `cancelAtZero` — Abbruch, SOLANGE NICHTS ABGELEGT IST** (v1009, Als
Vorgabe). Neue Option von `sendCardsLoop`: der ERSTE Wähler bekommt
einen `✕ CANCEL`-Knopf, und ein Druck darauf liefert
`{ aborted: true, sent: 0 }` — die Karte löst dann gar nicht auf
(`gs._spellCancelled`) und bleibt auf der Hand. **Ab der ersten
abgelegten Karte heißt der Knopf wieder „✓ Done" und beendet nur das
Sammeln** — sonst wäre die Ausrüstung weg und der Angriff trotzdem
verpufft (die Lehre vom 6.9. bei Weapon Storm). Opt-in pro Karte; wer
die Option nicht setzt, behält das alte Verhalten.

**Testhinweis:** Ein Monkey-Patch auf `sendCardsLoop` am shared-Modul
greift NICHT — die Karte destrukturiert die Funktion beim Laden. Im
Repro wird stattdessen die echte Schleife über `promptEffectTarget`
gefahren (n Klicks, dann „Done").


## Neue Karte: „Aurora Borealis" (v1010)

Spell, Magic Arts Lv 1. „Choose up to 1/2/3 Spells with different names
from your deck, reveal them and add them to your hand. If the user has
Magic Arts 3, you may delete 2 of your chosen Spells to immediately
perform the third one as an additional Action with the user."

**★ „1/2/3" IST DAS MAGIC-ARTS-LEVEL DES NUTZERS** (Als Vorgabe 12.9.):
Lv 1 → eine Karte, Lv 2 → zwei, Lv 3 und höher → drei. Gelesen mit
`effectiveSchoolLevelForCaster`, das Ability-Stapel in Support Zones
mitzählt (Xal, Xalibur) — **nicht** die rohe Ability-Zone.

„up to" heißt: weniger geht, gar keine nicht. Der Wähler
(`cardGalleryMulti`, `minSelect: 1`) lässt sich abbrechen, dann meldet
die Karte `gs._spellCancelled`.

**Die Karten kommen aus dem DECK**, also `card_reveal` +
`deck_search_add` (Flug aus dem Deck) — NICHT `hand_card_materialize`,
das ist für Karten von außerhalb des Spiels (v995; im Repro
mitgeprüft).

**★ Der dritte Zauber** nur bei Magic Arts 3 UND drei geholten Karten.
Angeboten werden nur Zauber, die der Nutzer auch wirklich wirken kann
(`heroMeetsLevelReq`) — der Text sagt „perform … with the user", nicht
„regardless of its level". Die anderen zwei werden gelöscht (Hand →
Gelöscht mit Flug, Muster `routeNegatedInitialCard`), dann läuft der
dritte über `_castSpellImmediately`: die Brücke wirkt ihn ohne
Aktionskosten, und genau das meint „as an additional Action".

Nebenbei: **„Perfect Disguise" kostet jetzt 12** (war 4).


## „Rha'Bi, the Living Skeleton" — neuer Wortlaut (v1011, Als Vorgaben 12.9.)

Schaden **150 statt 200** (cards.json und `SCHADEN` im Skript).

**★ DIE ZIELSPERRE HÄNGT JETZT AM ZUG, NICHT AN DER KARTE.** Alter
Text: „a Hero … that does not already have a card in any of its Support
Zones from this effect" — neuer Text: „**that has not been chosen by
this effect yet this turn**". Zwei Unterschiede, die im Spiel wirklich
vorkommen:

* Kommt die gelegte Karte zwischendurch weg (zerstört, gebounct), ist
  der Held **trotzdem** für den Rest des Zuges tabu.
* Liegt die Karte noch, ist der Held im NÄCHSTEN Zug **wieder wählbar**.

Geführt wird das an der SPIELERSEITE (`ps._rhabiChosenTurn` +
`_rhabiChosenHeroes`), nicht an der Karte — genau das beschreibt die
Sperre: seine Wahl in diesem Zug. Die Karten-Marke `_rhabiPlaced`
bleibt daneben bestehen, sie trägt weiter das Einsammeln und die
Löschung beim Tod.

Der Rest des Textes ist gleich geblieben; die frühere Bedingung „if …
this Hero is not defeated" beim Einsammeln fehlt im neuen Wortlaut,
ändert aber nichts: die Defeat-Klausel löscht die Karten ohnehin, und
die Todesprüfung im Einsammel-Hook bleibt als Gürtel-und-Hosenträger
stehen.


## Neue Karte: „Iceage" (v1012)

Spell, Decay Magic + Magic Arts, **Level 2 → 3**, neuer Text: „Freeze
all targets your opponent controls for 1 turn. You may treat this
Spell's level as 4 when you use it. If you do, Freeze those targets for
2 turns instead."

„all targets your opponent controls" = seine lebenden **Helden** und
alle **Kreaturen** auf seiner Seite; Ausrüstung und Abilities sind keine
Ziele. Frost über die zwei vorhandenen Wege (`addHeroStatus` /
`applyCreatureStatus`), beide mit `appliedBy`.

**★ DIE STUFENWAHL PASSIERT BEIM WIRKEN.** Gespielt wird die Karte als
Stufe 3 (das normale Tor); erst in der Auflösung fragt sie, ob sie als
Stufe 4 gelten soll. Angeboten wird das nur, wenn der Nutzer eine
Stufe-4-Karte dieser Schulen überhaupt wirken könnte — geprüft mit
denselben Kartendaten, nur `level: 4` (`heroMeetsLevelReq`). So bleibt
die Entscheidung dort, wo der Text sie hinlegt, ohne dem Spielweg ein
zweites Levelgatter unterzuschieben.

**Wichtig beim Testen:** Bei ZWEI Schulen **summiert** die Engine beide
Stufen (`_testLevelReqForZones`: `combined >= level`). Decay 3 +
Magic Arts 3 erfüllt also auch Stufe 4 — für den Fall „Stufe 3 ja,
Stufe 4 nein" braucht ein Repro Summe genau 3.

**Animation:** ein globaler Blizzard (`iceage_blizzard`) als
Vollbild-Overlay direkt im DOM, Bauform wie der Divine-Rain-Vorhang —
Schleier, 220 schräg jagende Schneestreifen, Frost von allen vier
Rändern, Kälteblitz, Klang `elem_ice` + `elem_wind`. Anders als der
Regen räumt er sich nach 2,6 s **selbst** ab (kein Gegenstück zum
Abschalten), und der Handler meldet sich beim Aufräumen wieder ab. Dazu
je Ziel ein `ice_encase`, damit man sieht, wen es erwischt hat.


## ★ Mehrrundiger Frost an KREATUREN wurde nie angezeigt (v1013, Als Befund 12.9.)

Beim HELDEN ist `statuses.frozen` ein Objekt mit `duration`. Bei der
KREATUR setzt `applyCreatureStatus` nur **`counters.frozen = 1`** und
legt die Dauer daneben in **`counters.frozenDuration`** — genau den
Zähler, den der Rundenabbau herunterzählt (und den es nur gibt, wenn
`duration > 1`).

`StatusBadges` schaute ausschließlich nach `fr.duration`. Für Kreaturen
war das immer `null`, also stand am Badge nie eine Rundenzahl und der
Tooltip sagte „wears off at the end of its owner's turn" — bei jeder
mehrrundigen Kreatur-Vereisung falsch: **Iceage Stufe 4, Divine Gift of
Biseria, Blue Ice Dragon**. Der Zustand war immer richtig, nur die
Anzeige log.

Das Badge liest jetzt beide Stellen. Wer eine neue mehrrundige
Kreatur-Statuslage baut, muss denselben Doppelweg bedenken:
`counters.<status>` ist nur die Anwesenheit, die Dauer steht in
`counters.<status>Duration`.


## Neue Karte: „Bomb Mite" (v1014)

Creature, Summoning Magic Lv 0, 1 HP. Zündschaden **150 → 100** (Als
Vorgabe 12.9.); der Rückschlag bleibt bei 100.

**★ „AT THE END OF YOUR NEXT TURN AFTER SUMMONING IT" ist das ZWEITE
eigene Zugende**, nicht das erste: beschworen in Zug T, zündet sie am
Ende von Zug T+2, weil der gegnerische Zug dazwischenliegt. Geprüft
mit `ctx.isMyTurn && gs.turn > inst.turnPlayed` — am eigenen Zugende ist
das erst beim nächsten eigenen Zug wahr.

**★ Der Rückschlag braucht einen FREMDEN Täter.** `ctx.source` des
Todes-Hooks trägt die tötende Karte; ohne Quelle (Zustands-Tod,
Selbstopfer) und bei eigener Quelle passiert nichts — „by an OPPONENT's
card or effect". Ohne diese Prüfung sprengt sich der Spieler beim
eigenen Opferritual die Helden weg. Zusätzlich setzt der Zünd-Zweig
`_bombMiteSelfSend`, damit die eigene Detonation nicht über den
Todes-Zweig zurückschlägt (im Repro festgehalten).

**Waldweg-Notiz:** `check-damage-types` hat meinen ersten Anlauf mit
einem erfundenen Typ `'effect'` zu Recht rot gemeldet — für
Kreatureffekte ist **`'creature'`** der Normalfall (so macht es auch
Exploding Skull).


## Neue Karte: „Cute Conversion" (v1015) — und `omniImmune` beim Diebstahl

Spell, Magic Arts Lv 2, Archetyp „Cute". „Take control of all Creatures
your opponent controls for the rest of the turn. Creatures controlled by
this effect are unaffected by all cards and effects while they are
controlled. This Spell's level in your hand is reduced by the number of
„Cute" Creatures you control."

Kontrolle über `actionStealCreature` — derselbe Weg wie im
Kreaturzweig von Deepsea Succubus. Der Diebstahl ist von Haus aus
temporär: `_revertStolenCreatures` gibt zu Zugbeginn alles zurück, ganz
ohne eigenen Aufräumhook.

**★ NEUE OPTION `omniImmune` (Engine).** Für „unaffected by all cards
and effects" reicht `damageImmune` NICHT — das deckt nur Schaden.
`actionStealCreature(pi, inst, { omniImmune: true })` setzt jetzt
dieselben Marken wie bei den Cardinal Beasts:

| Marke | wofür |
|---|---|
| `_cardinalImmune` | lesen Schadens-, Status-, Zonen-, Zerstörungs- **und Opferpfade** direkt |
| `_omniImmune` | deckt `isOmniImmune` mit ab |
| `_stealOmniImmune` | merkt sich, dass die Immunität zum Diebstahl gehört |

Die dritte Marke ist die wichtige: `_revertStolenCreatures` räumt
`_cardinalImmune` / `_omniImmune` **nur dann** ab, wenn sie mit dem
Diebstahl kamen — eine von woanders stammende Immunität (Golden Wings)
bleibt stehen. Im Repro beide Richtungen festgehalten.

**★ NACHTRAG v1016 (Als Befund):** Die geliehenen Kreaturen ließen sich
nicht mehr AKTIVIEREN, Succubus-geliehene schon. Ursache: sie liegen
physisch weiter beim Gegner, die Aktivierung kommt deshalb mit
`charmedOwner = Gegner` herein — und `doActivateCreatureEffect` weist
`charmedOwner !== pi` **plus `_cardinalImmune`** ab (ein Tor gegen
Treacherous Crystals Verleih an Cardinal Beasts). Die Immunität richtet
sich aber gegen FREMDE Karten, nicht gegen den Kontrolleur, der den
Effekt seiner Leihgabe benutzt. Das Tor kennt jetzt die Ausnahme
„eigene Leihgabe" (`inst.stolenBy === pi && _stealOmniImmune`). Ein
echter Cardinal kann dadurch nicht durchrutschen: `actionStealCreature`
verweigert den Diebstahl omni-immuner Kreaturen, `stolenBy` steht bei
ihnen also nie.

Damit können die geliehenen Kreaturen insbesondere **nicht geopfert
werden** (Als Vorgabe 12.9.). Das scheiterte zwar schon daran, dass
`owner` beim Gegner bleibt und `getSacrificableCreatures` nach `owner`
filtert — jetzt hängt es aber am Vertrag statt am Zufall.

Level in der Hand über `reduceCardLevel` nach der Ruin-Mourner-Bauform:
nur die Handkopie mit der kleinsten ID trägt bei, sonst multipliziert
die Engine die Senkung je Kopie.

**Animation `cute_hearts`:** sieben tiefrote Herzen je Ziel, versetzt
und unterschiedlich groß, die aufsteigend größer und durchsichtiger
werden (bis `scale(2.6)` bei Deckkraft 0). Reines CSS — zwei Kreise
plus gedrehtes Quadrat —, damit das Rot wirklich tiefrot ist und nicht
vom Zeichensatz abhängt.


## Neue Karte: „Off Duty" (v1017) — und `toDeck` beim Negieren

Spell (Reaction), Decay Magic Lv 2. „Play this card immediately when
your opponent summons a Creature. Negate the summoning and shuffle the
Creature back into the deck. If the Creature was their Action, your
opponent may immediately perform a different Action afterwards."

Bauform **Lunar Eclipse** (gleiche Textform: negieren, anders
entsorgen, Ersatzaktion anbieten).

**★ „NEGATE THE SUMMONING" = DAS SPIEL ERKENNT DIE BESCHWÖRUNG GAR
NICHT AN** (Als Vorgabe 12.9.): kein On-Summon-Effekt, kein Hook, kein
Trigger. Dafür braucht es **kein neues Fenster** — das KETTENFENSTER
leistet es schon: `executeCardWithChain` läuft in `doPlayCreature`
**vor** `_runBeforeSummon` und vor der Platzierung. Wird dort negiert,
hat die Beschwörung nie stattgefunden, statt hinterher
zurückgedreht zu werden.

Daraus folgt Als geforderte Reihenfolge von selbst: Off Dutys Trigger
liegt VOR allen anderen On-Summon-Reaktionen, weil die
(`_checkPostSummonHandReactions` am `onCardEnterZone`) an der
GELANDETEN Karte hängen und nie erreicht werden. Im Repro sind beide
Reihenfolgen am Bauplan festgehalten.

**★ NEUE OPTION `toDeck` (Engine).** `negateChainLink(chain, i,
{ toDeck: true })` setzt `_negatedToDeck`; `executeCardWithChain` reicht
es als `chainResult.negatedToDeck` durch, und `routeNegatedInitialCard`
fliegt die Karte sichtbar zum Deckstapel und **mischt danach** — sonst
läge sie obenauf und der Gegner zöge sie sofort wieder. Reiht sich neben
die vorhandenen Ziele `negatedToDeleted` (Lunar Eclipse) und
`negatedToHandOf` (Key).

**Ersatzaktion:** wie bei Lunar Eclipse — die Aktion IST verbraucht, der
Gegner bekommt eine neue angeboten, und zwar über
`queuePostChainAction` NACH der Kette (währenddessen sperrt der
Reaktionsriegel noch jedes Kartenspiel, das Angebot liefe ins Leere).
Nur bei einer echten Aktion: keine Initialkarte oder inhärente
Beschwörung → kein Angebot.


## ★ Negierte INHÄRENTE Beschwörung kostete trotzdem die Aktion (v1018, Als Befund 12.9.)

Symptom: eine Kreatur, die inhärent gespielt werden kann (Aggressive
Town Guard, solange noch nichts beschworen wurde), wird in der Action
Phase von „Off Duty" negiert. Off Duty gibt **richtig** keine
Ersatzaktion — die Beschwörung hat ja gar keine gekostet. Trotzdem flog
der Spieler aus der Action Phase.

Ursache: der Negat-Zweig von `doPlayCreature` schaltete die Phase mit
`if (isActionPhase && !usingAdditional)` weiter — **ohne
`!isInherentAction`**. Der Helden-Stempel eine Zeile darüber hatte den
Riegel, die Phasenschaltung nicht. Der Normalweg prüft
`!effectiveIsInherent` seit jeher, der Zauberweg ebenso; nur dieser
Zweig fiel durch.

Angeglichen — samt der v991-Nachbesserung, dass ein zweiter Zuschlag
auch **einlösbar** sein muss, nicht nur vorhanden. Merksatz: wer im
Negat-Zweig etwas an der Aktionswirtschaft ändert, muss beide Riegel
(Stempel UND Phasenschaltung) am Normalweg gegenprüfen.


## ★ Inhärent NACH der ersten Aktion ist die ZWEITE Aktion (v1019, Als Ruling 12.9.)

**Regel:** Alles, was nicht die ERSTE Aktion der Action Phase ist, ist
eine Zusatzaktion — auch eine **inhärente** (Aggressive Town Guard,
Quick Attack). Wer mit einem Zweitaktions-Zuschlag (Zhigao) in der
Action Phase steht, seine erste Aktion hatte und dann etwas Inhärentes
spielt, hat damit seine zweite Aktion gemacht: der Zuschlag ist durch,
die Phase endet.

Vorher war eine inhärente Aktion **durchgehend** gratis und rührte die
Aktionswirtschaft gar nicht an — der Spieler blieb mit unverbrauchtem
Zhigao in der Action Phase hängen, obwohl er zwei Aktionen gemacht
hatte. Aufgefallen ist das an einer Kette, die genau dorthin führt:
Beschwörung → von „Off Duty" negiert → Ersatzaktion → inhärente
Beschwörung.

Implementiert als ein Prädikat in der Engine
(`inherentCountsAsExtraAction`), gelesen an **beiden** Spielwegen
(`doPlaySpell` für Zauber und Attacken, `doPlayCreature`). Dort wird
`_actionsPlayedThisPhase` hochgesetzt und DANN gewechselt — die
Reihenfolge ist load-bearing: der Riegel in `advanceToPhase` liest
genau diesen Zähler, um zu erkennen, dass Zhigaos Zuschlag nicht mehr
einlösbar ist. Steht ein WEITERER einlösbarer Zuschlag bereit (Mission
of the Light Brigade), hält er den Spieler weiterhin in der Phase —
auch das ergibt sich aus demselben Riegel.

**Die erste Aktion der Phase bleibt ausgenommen:** eine inhärente Karte
vor jeder anderen Aktion ist weiterhin gratis.


## ★ Ausgrauung während einer Sofort-Aktion mit freier Heldenwahl (v1020, Als Befund 12.9.)

Zhigaos Ausgrauung (`additionalActionDimmed`) greift, sobald der Spieler
seine erste Aktion hatte und alle offenen Zuschläge **heldengebunden**
sind — dann sind die übrigen Helden grau. Das ist richtig, solange es um
die zweite Aktion der Action Phase geht.

Es galt aber auch **während einer Sofort-Aktion mit freier Heldenwahl**
(`performImmediateActionAnyHero`, z.B. Off Dutys Ersatzaktion). Dort darf
jeder lebende Held handeln — der Prompt lässt `heroIdx` bewusst weg —,
die Anzeige behauptete aber das Gegenteil. Rein optisch: der Klick auf
einen anderen Helden ging die ganze Zeit durch.

Die Ausgrauung weicht jetzt einem offenen `heroAction`-Prompt **ohne**
`heroIdx` (und nur dem eigenen). Der Fall mit festem Helden (Coffee)
graut die anderen unverändert aus — dafür sorgt `heroActionDimmed`
daneben, das genau auf `heroIdx !== undefined` prüft.


## Neue Karte: „Creepy Villager" (v1021) — und `controlCannotChange`

Creature, Summoning Magic Lv 0, 1 HP. Drei Teile:

**★ „CONTROL OF THIS CREATURE CANNOT CHANGE" ist ein EIGENER, ENGER
VERTRAG** (`controlCannotChange: true`) — ausdrücklich **nicht** die
Omni-Immunität der Cardinal Beasts. Der Villager bleibt angreifbar,
zerstörbar und **opferbar**; nur der Kontrolleur steht fest. Gelesen von
`engine.controlIsLocked(inst)` an **beiden** Kontrollwegen:
`actionTransferCreature` (dauerhaft) und `actionStealCreature`
(temporär). Eine Instanzmarke `counters._controlLocked` tut es ebenso —
so kann ein Effekt die Sperre später auch verleihen.

**Der Tausch** ist die Abkürzung zum Dark Deepsea God: statt zwei
Kreaturen mit zusammen Level 4+ **und** einer Aktion geht EIN Villager
zurück auf die Hand, und der Gott nimmt seine Zone. Bedingungen: nicht
in diesem Zug beschworen, ein DDG auf der Hand. Der Villager nennt keine
Aktion → aktionsfrei (★-Regel 7.9.); „once per turn" trägt die
generische Kreatureffekt-HOPT.

**★ Platzieren durch einen Effekt zählt als Effekt-Beschwörung und löst
On-Summon-Effekte aus** (Als Ruling 8.9.). DDGs Flächenschaden liegt
aber in seinem `beforeSummon`, nicht in `onPlay` — er würde bei einer
Platzierung also NICHT feuern. DDG exportiert deshalb jetzt seinen
AoE-Helfer (`fireDdgAoE`), den der Villager ausdrücklich zündet. Der
Einmal-pro-Zug-Riegel (`ddg_aoe`) steckt im Helfer selbst, der Weg kann
also nicht doppelt zünden.

**Der Abwurf beim Tod** trifft den KONTROLLEUR („this Creature YOU
control"), nicht den Besitzer. `actionPromptForceDiscard` nimmt die
Handgröße von selbst als Obergrenze — „oder die ganze Hand" braucht
keinen Sonderfall.


## Neue Karte: „Deepsea Treasure" (v1022) — und `treasure_reveal`

Spell, Support Magic Lv 2. Von 2 auf **3** Karten erhöht, Text neu:
„Reveal the top 3 cards of your deck. You may play any Artifacts you
find there immediately without paying their Cost. Add all other revealed
cards to your hand."

**★ NEUER CLIENT-TAKT `treasure_reveal`** (Als Vorgabe): die Karte
fliegt vom Deckstapel in die **Bildmitte**, klappt dabei auf, verharrt
kurz — und fliegt dann an **ihren** Handplatz, wo sie ab der Ankunft
dauerhaft liegt.

**★ Das Verharren ist fast null** (90 ms, v1024, Als Befund): bei 620 ms
erreichte die zweite Karte die Mitte, während die erste noch dort stand
— sie überlagerten sich. Der Versatz zwischen den Karten (560 ms) muss
größer bleiben als die Haltezeit; beide Zahlen stehen in Client UND
Kartenskript und werden im Repro gegeneinander geprüft.

**★ Drei Takte in JS statt einer CSS-Kurve** (v1023, Als Befund): der
Zielplatz existiert beim Losfliegen noch nicht, eine vorab berechnete
Kurve landete deshalb in der **Mitte des Handkastens**. Takt ③ sucht den
Platz erst beim Abflug dorthin — zuerst den echten
`.hand-slot[data-hand-idx]`, als Rückfall projiziert (mit
`finalHandSize`, denn die Hand ist zentriert und die Reihe rückt beim
Wachsen; ohne die Endgröße landet jede Karte eine halbe Kartenbreite
daneben).

Zwei Dinge gehören zwingend dazu:
* **Der Zielplatz wird bis zur Ankunft verdeckt** (`setBounceReturnHidden`)
  — die Karte steht schon im Zustand (sonst gäbe es den Platz beim
  Anflug nicht), läge also sonst doppelt da.
* **Die Ankunft wird vorangemeldet**
  (`pileTransferToHandPendingMeRef`) — sonst legt die automatische
  Zieh-Animation zusätzlich einen Flug vom Deck obendrauf („die
  ungewollte Zieh-Animation").

**Alle drei gehen auf die Hand**, auch die Artefakte: der Text sagt
„play any Artifacts … immediately", gespielt wird also VON der Hand.
Wer das Angebot ausschlägt, behält sie dort.

**★ Was „sofort spielen" heißt, hängt an der Unterart:**

| Unterart | Weg |
|---|---|
| Equipment | `equipArtifactToHero` — sofort an einen gewählten Helden, mit `onPlay` / `onCardEnterZone` |
| Artifact/Creature | `actionPlaceCreature` — sofort in eine gewählte Support Zone |
| alles andere (Normal, Reaction, Area, Surprise) | Nullpreis-Vermerk `_freeArtifactNames[name]` (Misfire-Vertrag) — der Spieler spielt sie im selben Zug regulär, aber kostenlos |

Der letzte Fall ist bewusst so: `doPlayArtifact` im Server sind ~570
Zeilen mit Kettenfenster, Zielwahl, HOPT und drei Zahlstellen — das
lässt sich aus einem Kartenskript nicht sauber nachbauen, und der
Nullpreis-Vermerk erreicht dasselbe Ergebnis über den regulären Weg.


## Neue Karte: „Mass Routing" (v1025)

Spell, Decay Magic Lv 1 — **steht weiter auf der Bannliste** (nicht
angerührt). Zug je Kreatur von 2 auf **1** gesenkt: „Shuffle all
Creatures on the board up to level 1/2/3 back into their original
owners' decks. Then, both players draw 1 card for each of their
Creatures shuffled back by this effect."

**★ „1/2/3" ist das Decay-Magic-Level des Nutzers** — dieselbe Lesart
wie bei Create Illusion und Iceage, gelesen mit
`effectiveSchoolLevelForCaster` (zählt Ability-Stapel in Support Zones
mit) und auf 1..3 begrenzt.

**★ Geprüft wird das WIRKSAME Level** (`getEffectiveCardData`), nicht
der Datenbankwert — sonst liefe jede Stufensetzung ins Leere (Lawn
Gnome, Shapeshift); `check-level-source` sieht genau darauf.

**★ Ziel ist das Deck des `originalOwner`**, nicht des Kontrolleurs:
eine übernommene Kreatur geht nach Hause. Daran hängt auch das Ziehen —
„their Creatures" meint die eigenen, egal wer sie zuletzt kontrollierte.

Gemischt wird **einmal je betroffenem Deck**, nachdem alles drin ist.
Omni-immune Kreaturen bleiben stehen und zählen dann auch nicht fürs
Ziehen.

**Testhinweis:** Nach dem Mischen ZIEHT der Besitzer — eine
zurückgemischte Karte kann also im Deck **oder** schon auf seiner Hand
liegen. Ein Repro darf deshalb nicht auf der Deckgröße bestehen,
sondern muss den Weg prüfen (Log-Zähler bzw. „Deck oder Hand").


## Neue Karte: „Last Resort" (v1026)

Spell, Destruction Magic Lv 3. Neuer Schlusssatz (von „Flame Avalanche"
übernommen): „You cannot deal any other damage the turn you activate
this card."

**★ Der Schaden steht VOR dem eigenen Tod:** „twice the user's CURRENT
HP" wird gelesen, bevor der Nutzer fällt — andersherum wäre es immer 0.

**★ Die Spielende-Prüfung wird bis zum Schluss angehalten**
(`_deferGameOverCheck`, Bauform Bunny Bombs). Sonst wertete die Engine
schon nach dem Schaden aus, während der Nutzer noch lebt — „if all
Heroes of BOTH players are defeated" könnte dann gar nicht zutreffen.

**★ Der Gewinn bei doppelter Auslöschung** läuft über
`gs._drawLoserIdx` — dieselbe Stelle, an der Bunny Bombs den Verlierer
benennt, nur andersherum: hier verliert der GEGNER. Ohne den Hinweis
entschiede die Schleifenreihenfolge (Spieler 0 verlöre stillschweigend).
Ein vorhandener Hinweis wird gesichert und danach wiederhergestellt.

Die Niederlage des Nutzers ist **kein Schaden**, sondern
`actionDefeatHero` mit `respectFirstTurnProtection: false` (ein
freiwilliges Selbstopfer darf nicht am eigenen Schutzschild scheitern)
und `skipAllDeadCheck: true` (die Auswertung kommt gleich, einmal).

Die Sperre `ps.damageLocked` wird **zuletzt** gesetzt — vorher blockte
sie den eigenen Treffer. Wie bei Flame Avalanche ist die Karte zudem gar
nicht spielbar, wenn in diesem Zug schon Schaden ausgeteilt wurde.

**★ Animation (v1027, Als Vorgabe):** erst der **Ansturm**
(`play_ram_animation`, Bauform Phoenix Tackle: der Nutzer wirft sich
selbst ins Ziel), dann im Moment der Berührung — bei ~12 % der
Flugdauer, also nach 150 ms — die **eigene große Explosion**
`last_resort_blast` plus schwerer Bildrüttler. Fünf Lagen: weißer Kern,
Feuerball über gut **drei Zonenbreiten**, zwei zeitversetzte
Druckwellen, 26 Trümmersplitter mit Schwerkraft im Fall, 14 nachglühende
Funken. Klang dreilagig (`heavy_impact` → `elem_fire` → `hero_death`).
Dieselbe Explosion noch einmal auf dem Platz des Nutzers, wenn er fällt;
der Rücksprung des Rams geht darin unter.

**Testhinweis:** Kreaturinstanzen führen ihren Stand in
`counters.currentHp`; `inst.hp` ist bei ihnen `undefined`.


## ★ „Einmal pro Spiel" galt für TRÄNKE gar nicht (v1028, Als Befund 12.9.)

Symptom: „Teleportation Powder" ließ sich über zwei Züge **zweimal**
spielen, obwohl das Skript `oncePerGame` meldet.

Ursache: Der Zauber-, Artefakt- und Überraschungsweg prüfen `oncePerGame`
UND setzen die Marke `ps._oncePerGameUsed`. Der **Trankweg tat beides
nicht** — weder `doUsePotion` noch `doConfirmPotion`. Ohne Stempel wäre
selbst ein Tor wirkungslos geblieben, also musste beides nachgezogen
werden:

* Tor am Anfang von `doUsePotion`,
* Stempel über `_markOncePerGamePotion(ps, script, cardName)` an **beiden**
  Verbrauchsstellen — ohne Zielwahl in `doUsePotion`, mit Zielwahl in
  `doConfirmPotion`. Die zweite ist die, über die Powder tatsächlich
  läuft; nur eine zu stempeln hätte den Fehler bloß verschoben.

**Merksatz:** Wer einem Trank eine neue Einmal-Regel gibt, prüft beide
Enden — Tränke haben zwei Spielwege, je nachdem ob sie ein Ziel
brauchen.

## Textänderungen (v1029)

* **„Learning"** — „you **may** choose" in allen drei Stufen (nur Text).
* **„Rha'Bi, the Living Skeleton"** — Schaden 150 → **100** (Text und
  `SCHADEN` im Skript).
* **„Teleportation Powder"** — „Choose an undefeated Hero **your
  opponent controls**" statt „any … on the board". `getValidTargets`
  liefert jetzt nur noch `getHeroTargets(oi)`, und `canActivate`
  verlangt einen lebenden Gegnerhelden. Der Erstrunden-Schutz gilt
  weiter — unter ihm gibt es nun gar kein Ziel mehr, die Karte ist also
  schlicht nicht spielbar.


## ★ „Einmal pro Spiel" — vollständige Bestandsaufnahme (v1030, Als Auftrag 12.9.)

Nach dem Trank-Fund (v1028) habe ich **alle** Wege durchgesehen. Die
Regel braucht immer ZWEI Hälften: ein **Tor** (gegen einen zweiten
Versuch am Server — Doppelklick, CPU, Wiederholung) und einen
**Stempel** (ohne ihn greift kein Tor).

| Weg | vorher | jetzt |
|---|---|---|
| Zauber (`doPlaySpell`) | nur Stempel — **Tor fehlte** | beides |
| Artefakt | beides | beides |
| Überraschung | beides | beides |
| Trank | **keins von beidem** (v1028) | beides |
| Kreatur-Beschwörung | **keins von beidem** | beides |

Beim Zauberweg lebte die Sperre allein von der Ausgrauung im Client
(`getPlayableCards`) — am Server wäre ein zweiter Versuch
durchgegangen.

**Beschwörungen stempeln erst, wenn die Kreatur GELANDET ist** (direkt
vor `onPlay`/`onCardEnterZone`), nicht schon am Tor: eine negierte oder
abgebrochene Beschwörung („Off Duty") darf die Partie-Grenze nicht
verbrauchen.

### Neu: `oncePerGameEffect` für AKTIVIERTE Effekte

`oncePerGame` begrenzt das SPIELEN einer Karte. „You can only use this
effect once per game" ist etwas anderes — und beides kann nebeneinander
stehen (Black Marketeer: 1 Beschwörung je Partie, Effekt je Zug).
Deshalb ein eigener Vertrag:

* Karten melden **`oncePerGameEffect: true`** (optional
  `oncePerGameEffectKey`, wenn mehrere Karten sich eine Grenze teilen).
* Engine: `oncePerGameEffectUsed(pi, script, cardName)` /
  `markOncePerGameEffect(…)`. Gespeichert im selben Set
  `ps._oncePerGameUsed`, aber mit Präfix **`effect:`** — so erbt der
  Vertrag Serialisierung und Snapshot-Wiederherstellung, ohne mit dem
  Kartenschlüssel zu kollidieren.
* Gelesen wird er an vier Stellen: `getActivatableCreatures` und die
  Heldeneffekt-Liste (damit die Knöpfe verschwinden),
  `doActivateCreatureEffect` und alle **drei** Sammelzweige von
  `doActivateHeroEffect` (eigener Held, Mummy Token, Ausrüstung).
* **Der Stempel für Heldeneffekte sitzt in
  `resolveHeroEffectActivation` (Engine), nicht im Server-Handler** —
  `performImmediateAction` fährt denselben Weg, und eine zweite
  Wahrheit wäre genau die Lücke, durch die die Regel wieder durchfiele.

Die beiden bestehenden Karten mit einer Partie-Grenze (**Black
Marketeer**: „only summon 1 per game", **Teocuilatl**: „only sacrifice
1 Hero per game") führen ihre Marke weiterhin selbst am Spielerzustand
und sind unverändert — sie funktionierten schon. Der neue Vertrag ist
für alles Künftige da.


## ★ Die geteilte „Divine Gift"-Grenze — geprüft und eine Lücke geschlossen (v1031, Als Frage 12.9.)

Alle **17** „Divine Gift"-Karten melden korrekt
`oncePerGame: true` + `oncePerGameKey: 'divineGift'`, teilen sich also
eine Partie-Grenze. Das ist die richtige Bauform — aber sie greift nur
dort, wo der Spielweg sie liest.

**Die Lücke:** Vier der siebzehn sind **Reaktionen** (Rain, Guardian,
Time, Edge). Die werden im **generischen Kettenfenster**
(`executeCardWithChain`) aus der Hand angeboten — und das prüfte
`oncePerGame` NICHT und stempelte auch nicht. Ein bereits verbrauchtes
Geschenk wäre dort wieder angeboten worden. Die
Schadens-Fenster (`_checkPreDamageHandReactions` & Co.) hatten beides
seit jeher; nur dieses eine Fenster fiel durch.

Jetzt hat es beides. **Der Stempel sitzt dort, wo die Karte die Hand
verlässt** — ab da IST sie aktiviert („You can only ACTIVATE 1 … per
game"), unabhängig davon, ob ein Gegenzug sie später negiert.

Mitgeprüft und in Ordnung:
* Die 12 Normal-Spells und die eine Attack laufen über `doPlaySpell` —
  Tor seit v1030, Stempel seit jeher.
* Die Marke `ps._oncePerGameUsed` ist ein **Set** und überlebt
  Snapshot/Restore als Set (der JSON-Rückfallpfad rehydriert Sets
  ausdrücklich) — sonst wäre die Grenze nach jedem MCTS-Rollout weg.
* Ausgrauung im Client: `getBlockedSpells`,
  `getHeroEligibleActionCards` und die Projektion `oncePerGameUsed`.


## ★ Puzzle-Editor: Tooltip lag unter der Hand (v1032, Als Befund 12.9.)

`.board-tooltip` liegt im gemeinsamen CSS auf **z-index 9999**, die
Staging-Hand des Puzzle-Editors aber auf **10000** — der Karten-Tooltip
verschwand also samt Kartentext hinter den Handkarten.

Der Aufschlag steht **im Editor** (inline `zIndex: 10020` am
`.board-tooltip`-div von `app-puzzle.jsx`), nicht im gemeinsamen CSS:
das Problem ist eine Eigenart dieses Editors — im Spielbrett gibt es
keine Hand auf 10000, und eine Anhebung dort könnte andere Ebenen
stören. 10020 liegt über Hand (10000) und Debuff-Klappe (10001), aber
unter dem Entfernen-Knopf (999999).

Der kleine Texttooltip (`.game-tooltip`, `app-shared.jsx`) lag auf
**genau** 10000 — bei Gleichstand entscheidet der Stapelkontext, also
mal so, mal so. Ebenfalls auf 10020, weiterhin unter den Animationen
(ab 10150).


## ★ Endbildschirm lag unter der Hand (v1033, Als Befund 12.9.)

`.modal-overlay` liegt auf **z-index 1000**, die eigene Handleiste
(`.game-hand-me`) aber auf **10000** — und in der Handy-Queransicht
quellen ihre Karten nach OBEN über das Brett (`overflow: visible`,
absichtlich). Dort verdeckten sie den Victory-/Defeat-Screen samt
Rematch- und Cancel-Knopf.

Angehoben auf **10080** wurden gezielt:
* die drei Ergebnis-Overlays in `app-board.jsx` (Rundenergebnis,
  Set-Abschluss, Bo1/Rückfall),
* `.first-choice-panel` (das Rematch-Panel nach einer Niederlage, war
  9600) — es bleibt klein und verschiebbar, die Hand also weiterhin
  sichtbar; es gewinnt nur die Überlappung.

**`.modal-overlay` bleibt global auf 1000**: die Klasse tragen auch
Lobby, Deckbau und andere Fenster, deren Ebenen sich nicht
mitverschieben sollen. 10080 liegt über der Hand (10000) und über dem
Deck-Such-Fenster (10070), aber unter den Animationen (ab 10150).

**Waldweg-Notiz:** Ein JSX-Kommentar `{/* … */}` darf NICHT direkt
hinter `{bedingung && (` stehen — dort wird ein Ausdruck erwartet, und
Babel bricht mit `UnexpectedToken` ab. Der Kommentar gehört über die
Bedingung.


## ★ Kartenauftritte: aktiv nur beim Gegner, passiv bei beiden (v1034, Als Regel 12.9.)

Die große Kartenansicht links vom Brett ging bisher an beide Seiten. Für
den handelnden Spieler ist sie Störung statt Information — er weiß, was
er anklickt, und die Ansicht verdeckt ihm dabei das Brett. Neue Regel:

* **Aktiver Einsatz** (Karte gespielt, Kreatur-/Helden-/Ability-/Area-/
  Equip-Effekt aktiviert) → **nur der Gegner** (und die Zuschauer).
* **Passiver Effekt**, der von allein anspringt (Baaliel sammelt Zähler)
  → **weiterhin beide**. Genau die will der Spieler sehen, weil er sie
  nicht selbst ausgelöst hat.

Zwei Stellen tragen das:

1. **`showTriggeredEffect`** unterscheidet über den Aktivierungsmerker
   `_activationSource` (den `armEffectAnnounce` an JEDEM aktiven Weg
   setzt): meldet sich die Karte **selbst** während ihres **eigenen**
   aktiven Einsatzes, geht der Auftritt mit `toPlayers: [Gegner]` raus.
   Jede andere Meldung — anderer Kartenname, kein Merker, oder ein
   Merker aus einem früheren Halbzug — geht wie bisher an beide. Das
   deckt auch die vielen Kartenskripte ab, die sich in ihrem eigenen
   `onPlay` selbst ankündigen.

2. **`announceActiveEffect`** sendete genau EINE Sache: die Kopie für
   den Aktivierenden (Regel 12.8.). Die entfällt. Der Gegner hatte
   seinen Auftritt ohnehin über `_firePendingCardReveal`, das an jedem
   aktiven Weg gesetzt wird und an Gegner **und** Zuschauer geht.

Der Klang bleibt dem Spieler erhalten — der Klick auf einen Effekt hat
seinen eigenen; der Auftritt war nie die einzige Rückmeldung.


## Neue Karte: „Classical Harpyformer" (v1035) — inkl. cards.json

Creature, Summoning Magic Lv 0, 50 HP, Archetyp **Harpyformers**
(neuer Eintrag in `data/cards.json`, Werte und Set wie die neun
Geschwister; die Datei ist NICHT alphabetisch sortiert — der Eintrag
steht bei den anderen Harpyformern).

Die Familienform, drei Klauseln:

① **`inherentAction: harpyformerInherentAction`** — gratis, solange in
diesem Zug noch keine Kreatur beschworen wurde. Das ist eine KAUSALE
Bedingung, keine Wertfrage: kommt eine andere Kreatur zuerst, ist die
Gratis-Aktion ersatzlos weg. Deshalb trägt die Karte wie ihre
Geschwister `cpuMeta.playOrderPriority: 100`.

② **★ Die Suche kostet NICHTS** — anders als bei Ska, der 50 Schaden am
Wirtshelden zahlt. Der Text nennt keine Kosten. Das „you may" bleibt
trotzdem als Frage, weil die Suche die Karte dem Gegner aufdeckt.

③ Einmal je Zug: eine „Wealth"-Ability abwerfen für **5 Gold**. Abwurf
über `harpyformerDiscardCost` (feuert den regulären Abwurf-Hook, damit
„wenn abgeworfen"-Karten es mitbekommen), Gold über `actionGainGold` —
das achtet auf die Goldsperre (Golden Arrow, im Repro mitgeprüft).
Bricht der Abwurf ab, meldet `onCreatureEffect` **false**, damit die
Engine den Einmal-je-Zug-Stempel nicht setzt.


## ★ Zwei Kopien beim Hand-Abflug (v1036, Als Befund 12.9.)

Symptom: Wird eine Kreatur von „Off Duty" aus der Hand ins Deck
gemischt, bleibt die Handkarte sichtbar, während der Flug schon läuft —
zwei Kopien gleichzeitig.

Ursache liegt NICHT bei Off Duty: die Negat-Wege lassen die Karte bei
`from: 'hand'` **absichtlich** noch im Zustand und verzögern ihren Sync
(`if (vonZone !== 'hand') this.sync();`), weil der Client den Handplatz
als Startpunkt des Fluges braucht (`fromHandIdx`). Nur fehlte das
Gegenstück: der Platz wurde nie verdeckt.

Der Client verdeckt jetzt jeden Hand-Abflug mit Startplatz
(`bounceReturnHidden`, Schlüssel `owner-handIdx`) und räumt nach der
Flugdauer (700 ms) wieder auf — danach hat der Sync die Karte ohnehin
entfernt, und ein stehengebliebener Schlüssel würde nach dem Nachrücken
die FALSCHE Handkarte verdecken. Der Platz bleibt dabei im DOM
(`visibility: hidden`), sonst verlöre der Flug seinen Anker.

**Das betraf alle Hand-Abflüge**, nicht nur Off Duty: „Lunar Eclipse"
(Hand → Gelöscht) und „Key" (Hand → fremde Hand) laufen über denselben
Flug. Beide Handseiten lesen dasselbe Versteck.


## ★ Lernkanal für ABWURFKOSTEN (v1037, Als Auftrag 12.9.)

**Anlass:** Ob sich ein Effekt eine Handkarte wert ist, lässt sich nicht
gegen eine feste Punktzahl messen — die Effekte sind nicht
gegeneinander aufrechenbar. Vorher entschied genau das: eine
150er-Schwelle aus dem Abwurf-DUELL (Bottled Flame), wo „abbrechen"
= „ich nehme den Schaden" heißt. Bei Kosten heißt es „der Effekt
passiert nicht" — die Bedeutung war invertiert.

**Die Kette, Ende zu Ende:**

| Stufe | Wo | Was |
|---|---|---|
| Markierung | Prompt | `costFor: <Quellkarte>` am `forceDiscardCancellable` |
| Aufzeichnung | `_decision-log.js` | `engine._costDiscardLog`: `{pi, t, c, paid, card, tags}` |
| Lage-Tags | `_deck-profile.costDiscardTags` | Grundtags + **sortenabhängige** Tags (s.u.) |
| Sammlung | `_train-recorder.js` | `costDiscards` je Spiel, nur die gepinnte Seite |
| Fit | `scripts/train-deck-profile.js` | `costDiscardRules[Karte]` + `['tag:<Lage>']`, ≥5 Beispiele je Arm |
| Nutzung | `_cpu.js` | eigener Zweig für `costFor`-Prompts, fragt `costDiscardDecision` |

**★ Die Aufzeichnung sitzt in der Prompt-Hülle, nicht im Kartenskript** —
damit bedient JEDE künftige Karte den Kanal, sobald sie ihren
Abwurf-Prompt mit `costFor` kennzeichnet. Die zehn Harpyformer tun das
über `_harpyformer-shared.js` von selbst.

**★ Beide Arme müssen entstehen:** `costDiscardDecision` würfelt unter
`PP_TRAIN` mit `PP_RULE_EXPLORE` (bzw. 40 %, solange es keine Regeln
gibt) bewusst zwischen zahlen und ablehnen. Ohne Gegenbeispiele kann der
Trainer nichts fitten — und das alte Verhalten zahlte fast immer.

**Ohne Meinung wird gezahlt**, nicht abgelehnt: die 150er-Sperre gilt
nur noch für das Abwurf-Duell, für das sie gedacht war.

**Nachgemessen:** ein Trainingslauf mit „Bamboo Warrior" (enthält
Harpyformer) schreibt Zeilen der Form
`{c:'Ska Harpyformer', t:14, paid:1, card:'Performance',
tags:['handFull','late','boardWide']}`.


## ★ Kosten-Lernkanal: die Lage hängt vom EFFEKT ab (v1038, Als Präzisierung 12.9.)

„Die Kriterien sind je nach Effekt unterschiedlich — es ist wirklich
case-by-case." Drei Ausbaustufen:

**① Sorten-Tags.** Jede Karte nennt am Prompt die **Art ihrer
Gegenleistung** (`costKind`), und `costDiscardTags` hängt die passenden
Lage-Tags an:

| `costKind` | zusätzliche Lage |
|---|---|
| `gold` | Goldstand (`goldBroke` … `goldRich`) |
| `damage` / `burn` / `poison` | Restpunkte des schwächsten gegnerischen Helden (`oppLethalRange` / `oppHurt` / `oppHealthy`) + gegnerische Brettbreite |
| `heal` | schlechtester eigener HP-Anteil (`selfCritical` / `selfHurt` / `selfHealthy`) |
| `tutor` / `draw` | Deckrest (`deckThin` / `deckMid` / `deckDeep`) |
| `draw` zusätzlich | `deckoutRisk` / `deckSafe` — der Netto-Gewinn ist fest (+1), die EINZIGE Frage ist das Ausmillen (Als Vorgabe 12.9.). Gemessen an `deckTurnsLeft` + `deckoutDangerSizeOf`, nicht an der blanken Deckgröße |
| `protect` | Wert der besten eigenen Kreatur (`guardPrize` / `guardSolid` / `guardCheap`) **und ihr Zustand** (`guardSquishy` / `guardWorn` / `guardTanky`); ohne Kreatur `noCreature` |

Die Grundtags (Handgröße, Zug, eigene Brettbreite) bleiben überall
dabei — „kann ich mir die Karte leisten?" stellt sich immer gleich.
`costTags: [...]` nimmt Sondertags für Einzelfälle.

**② Ausgangs-Tags.** Manches entscheidet sich erst NACH der Zahlung —
„hat der Schaden getötet?". Dafür `engine.noteCostDiscardOutcome(pi,
Quellkarte, tags)`: hängt Tags an die jüngste eigene Zeile derselben
Quellkarte im selben Zug. Metal Harpyformer nutzt es
(`killed`/`noKill`, `hitOpp`/`hitSelf`, `hitHero`/`hitCreature`).

**③ Fit je Karte × Lage.** Der Trainer fittet jetzt
`costDiscardRules['Karte|tag']` zuerst; die allgemeine `tag:`-Regel
bleibt Rückfall für Karten mit zu wenigen eigenen Daten. Der Leser
bevorzugt entsprechend die karteneigene Regel. Damit kann „goldBroke"
für den Goldeffekt etwas anderes bedeuten als für den Schadenseffekt —
und „killed" gibt es nur dort, wo es einen Sinn hat.

**Nachgemessen** (Bamboo Warrior, echte Trainingszeile):
`{c:'Metal Harpyformer', paid:1, card:'Fighting',
tags:['handFull','mid','boardWide','oppLethalRange','oppBoardWide','killed','hitOpp','hitHero']}`.


## Kosten-Sorten der zehn Harpyformer (v1039, Als Vorgaben 12.9.)

| Karte | Gegenleistung | `costKind` |
|---|---|---|
| Classical | 5 Gold | `gold` |
| Country | 6 Gold | `gold` |
| Metal | 50 Schaden | `damage` (+ Ausgangs-Tags) |
| Grunge | Brand | `burn` |
| Rap | Gift | `poison` |
| Ballad | 100 Heilung | `heal` |
| Shanty / Ska | Suchen bzw. Ability anlegen | `tutor` |
| Techno | 2 Karten ziehen | `draw` |
| Choir | Schadensminderung an einer Kreatur | `protect` |

**★ Choir ist ohne eigene Kreatur nicht mehr aktivierbar** (Als Vorgabe:
„Hat man keine Creatures, sollte Choir nie genutzt werden") — der Schutz
verpuffte sonst samt Ability-Karte. Der Choir selbst zählt mit, er ist
ja eine Kreatur.

**Waldweg-Notiz zu den `guard`-Tags:** Der Startwert für „beste eigene
Kreatur" muss `null` sein, nicht 0. Ohne gelerntes Profil ist jeder
Kartenwert 0, und mit `wert > bestWert` bliebe der ZUSTAND auf seinem
Anfangswert stehen — eine fast tote Kreatur galt dann als „zäh". Bei
Wertgleichstand entscheidet jetzt der schlechtere Zustand: die
gefährdete Kreatur ist die, um die es geht.


## ★ PFLICHT: „you may discard X to do Y" gehört in den Lernkanal (v1040, Als Regel 12.9.)

**Diese Regel gilt für JEDEN künftigen Effekt mit Abwurfkosten**, nicht
nur für Harpyformer. Sobald der Spieler freiwillig eine Karte abwirft,
um etwas auszulösen, ist das eine Kosten-Entscheidung — und die ist
nicht objektiv gegen eine Zahl messbar (Als Begründung: „die Kriterien
sind je nach Effekt unterschiedlich, es ist wirklich case-by-case").
Ohne Kennzeichnung lernt die CPU für diese Karte **nie**, wann sich die
Zahlung lohnt; sie fällt auf eine Faustregel zurück, die für
Abwurf-DUELLE (Bottled Flame) geschrieben wurde und hier das Falsche
misst.

**Was eine neue Karte tun muss:**

```js
const antwort = await engine.promptGeneric(pi, {
  type: 'forceDiscardCancellable',
  costFor: CARD_NAME,        // ← PFLICHT: schaltet den Lernkanal ein
  costKind: 'gold',          // ← Sorte der Gegenleistung (Tabelle oben)
  costTags: ['…'],           //   optional: Sondertags für Einzelfälle
  eligibleIndices, cancellable: true, …
});
```

Läuft der Abwurf über `harpyformerDiscardCost`, ist `costFor` schon
gesetzt — dann genügt `costKind` am Aufrufer.

**Entscheidet sich der Nutzen erst NACH der Zahlung** (hat der Schaden
getötet? hat die Suche etwas gefunden?), gehört das dazu:

```js
engine.noteCostDiscardOutcome(pi, CARD_NAME, [getoetet ? 'killed' : 'noKill']);
```

**Keine frei gewählten Kosten?** Erzwungener Abwurf, Abwurf als
Nebenwirkung, Abwurf-Duell — dann ausdrücklich abmelden, mit
Begründung:

```js
// COST-DISCARD-CHANNEL: n/a — erzwungener Abwurf, keine Wahl des Spielers
```

**Wächter `check-cost-discard.js`** liest die Kartentexte, sucht das
Muster „discard … to …" und meldet jede Karte, deren Skript weder
`costFor` noch `harpyformerDiscardCost` noch die Abmeldung trägt. Der
**Grundlinie ist LEER** (v1041): der Altbestand wurde einzeln
durchgegangen. Jede Karte mit Abwurfkosten bedient jetzt entweder den
Kanal oder trägt die Abmeldung mit Begründung. Grundlinie bewusst neu
schreiben: `node scripts/check-cost-discard.js --update`.

### Der Altbestand, case-by-case (v1041)

**Angeschlossen (25), mit Sorte:**

| Sorte | Karten |
|---|---|
| `tutor` | Cute Annoyance Mini, Cute Dog, Life-Searcher, Lunatic Cycle – New Moon, Navigation, Paraseed Greenhouse, Training |
| `draw` | Gigantisaur Pteranos, Gigantisaur Triceras, Inventing, Prayer, Visionary Genius Heinz |
| `protect` | Cool Rescuer Monia, Cute Phoenix, Gigantisaur Brachion, Gigantisaur Stegon |
| `disrupt` *(neu)* | Destructive Puppet Shishi, Gigantisaur Ankylos, Plant Golem, Smug Mastermind Antonia |
| `mill` *(neu)* | Cute Nerd Magenta |
| nur Grundtags | Big Gwen Guard, Cute Bird, Skeleton Necromancer, die sieben **Magic**-Gems (über `_magic-gem-shared.js`) |

Zwei Sorten kamen dabei dazu: **`mill`** (eigenes Deck füttern —
derselbe Zwiespalt wie beim Ziehen, mit Deckout-Tags) und **`disrupt`**
(Störung auf der Gegnerseite — nicht Schaden zählt, sondern wie viel
dort steht: `oppBoardEmpty` / `oppBoardThin` / `oppBoardWide` +
`oppHurt`).

**Abgemeldet (27)**, jede mit Begründung im Skriptkopf. Drei Muster:
* **der GEGNER wirft ab** — Jean, Mary Crestmas, Spike Trap, The White
  Eye, Future Tech Control Device, Magic Ambers Haupteffekt;
* **die Karte wirft sich SELBST ab** — Cute Cat, Cool Tech Jetpack,
  Idej Projection, Loyal Bone Dog, Stormkissed Waflav, Skull Necklace;
* **die Kosten sind keine Handkarte** — Lolek (Artefakt), Spirit of the
  Shattered Trident (gelöschtes Artefakt), Steam Dwarf (Opfer),
  Guardian Beast Shu (Beschwörungsbedingung), …

**★ Zwei Fallen aus diesem Durchgang:**
1. **Ein Prompt gehört nicht automatisch dem Zahlenden.** Bei *Magic
   Amber* landete die Marke zuerst am Abwurf des GEGNERS (dem
   Haupteffekt); die eigenen Kosten sitzen im geteilten Gem-Helfer, der
   jetzt alle sieben Juwelen auf einmal versorgt.
2. **Ein Kosten-Prompt muss kein Abwurf-Wähler sein.** „Eine Karte
   abwerfen, um …?" kommt auch als Ja/Nein-Frage oder Kartengalerie.
   Die Aufzeichnungshülle wertet beides aus (`cardName` **oder**
   `confirmed`), und `actionPromptForceDiscard` reicht die Marken jetzt
   an seinen internen Prompt durch.

**Nachgemessen** (Cute Commando, 4 Spiele): 56 Kosten-Zeilen über fünf
Karten — Inventing 29×, Visionary Genius Heinz 14×, Cute Dog 5×,
Cool Rescuer Monia 5×, Cute Annoyance Mini 3×.


## Neue Ability: „Interference" (v1042) — Schutz gegen FLÄCHENSCHADEN

```
1) This Hero takes half damage from sources that hit other targets in addition to it (rounded up).
2) This Hero takes no damage from sources that hit other targets in addition to it.
3) No Heroes you control take damage from sources that hit other targets in addition to them.
```

**★ ENTSCHEIDEND IST „EINE QUELLE, MEHRERE ZIELE IN EINEM SCHLAG"**
(Als Vorgabe 12.9.). Eine Karte, die nacheinander mehrere
EINZELinstanzen austeilt — Rha'Bi — ist NICHT betroffen. Der Schutz
hängt deshalb **nicht am Kartennamen**, sondern an einer Klammer, die
nur die Flächenwege setzen:

```js
engine.beginMultiHit(anzahlZiele);   // Helden UND Kreaturen zählen
try { …Schaden austeilen… } finally { engine.endMultiHit(); }
```

`actionDealDamage` liest den Merker: ab **zwei** Zielen („in addition to
it") greift `interferenceShare(besitzer, held)` — 0.5 bei Stufe 1
(`Math.ceil` auf den Rest, also „rounded up"), 1 bei Stufe 2, und bei
Stufe 3 für JEDEN Helden dieser Seite, egal an welchem Helden die
Ability hängt. Die Stufe kommt aus `countAbilitiesForSchool`, zählt also
Wildcard-Abilities korrekt mit.

Die Klammer ist **verschachtelbar** (Tiefenzähler) und wird im `finally`
gelöst, damit ein abgebrochener Schlag sie nicht stehen lässt — sonst
wären alle folgenden Einzeltreffer fälschlich geschützt.

**Wer klammert schon:**
* `actionAoeHit` — der generische Trichter, damit **12 Karten auf einen
  Schlag** (Flame Avalanche, Blood Rock, Rain of Arrows, Boiling Oil,
  Butterfly Cloud, Cavalry, Dance of the Flame Pillars, Divine Gift of
  Fire, Energy Drain, Future Tech Organnon, Rebelliokai Oblivious Oni,
  Spider Avalanche);
* **Chain Lightning** — springt zwar von Ziel zu Ziel, ist aber EINE
  Quelle über die ganze Kette;
* **Whirlwind Strike** — zwei Helden plus deren Kreaturen in einem
  Schlag.

**Nachgezogen (v1043, Als Rulings 12.9.)** — 14 weitere Karten mit
eigenem Schadensweg klammern jetzt selbst: Bomb Mite, Carpet Bomblebee,
Cataclysm, Dark Deepsea God, Exploding Skull, Explosivo's Sword,
Forbidden Zone, Future Tech Bomb, Gangster Angel, Holy Selection, Laser
Volley, Spirit of the Barbarian Sword, The Spawn Mother, Thebinxan War
Counselor.

Zwei Sonderfälle:
* **Explosivo's Sword** — nur der 100er-Splash ist ein Flächenschlag;
  der ursprüngliche Angriffsschaden des Trägers läuft getrennt und
  bleibt unberührt. Die Klammer sitzt deshalb eng um die Splash-Phase.
* **Invisibility** — ausdrücklich NICHT betroffen, keine Klammer.

**★ ES ZÄHLT DIE ECHTE ZIELMENGE, NICHT DIE GEPLANTE** (Als Ruling
12.9.). Jede Klammer bekommt die Zahl der Ziele, die WIRKLICH getroffen
werden:
* „Ida" macht aus einem Flächenzauber einen Einzelzauber — dieser Weg
  kehrt in `actionAoeHit` **vor** der Klammer zurück, also kein Schutz;
* verschonte Ziele (Laser Volley) und tote Helden werden
  herausgefiltert;
* ist der Interference-Held das einzige legale Ziel, steht die Zahl auf
  1 und der Schutz greift nicht.

Deshalb überall `filter(… hp > 0 …)` bzw. `filter(t => !spared…)` statt
der rohen Zielliste — eine Klammer mit geplanten statt getroffenen
Zielen wäre die stille Variante desselben Fehlers.


## ★ „Interference" v1049 — Träger-Gate, Xal, und was die CPU davon weiß

**① BUGFIX: der Schutz hängt am HANDLUNGSFÄHIGEN Träger** (Als Ruling
14.9.). Die Erstfassung prüfte gar keinen Zustand — ein eingefrorener
oder negierter Held schützte weiter, auf Stufe 3 sogar die ganze Seite.
Jetzt läuft jede Stufe über den neuen Helfer:

```js
engine.interferenceLevel(ownerIdx, heroIdx)   // 0, wenn er nicht schützen kann
```

Er verlangt einen LEBENDEN und nicht stummgeschalteten Träger und fragt
dafür `_isHeroEffectSilenced` — **dasselbe Prädikat, das den globalen
Hook-Filter speist** (Stunned / Webbed, Frozen mit Chilly-Dog-Ausnahme,
Negated in jeder Form, Mummy). Tempeste benutzt es für die wortgleiche
Formulierung. Eine zweite Statusliste an dieser Stelle wäre genau die
Dublette, die bei der nächsten Status-Änderung still ausschert.

**② Xals Support-Zonen-Abilities zählen mit** (Als Ruling 14.9.). Der
Helfer hängt `heroSupportAbilityStacks` an die echten Ability-Zonen —
derselbe Griff wie in `_getCandidateAbilityZoneSets` und
`effectiveSchoolLevelForCaster`. Performance-Wildcards rechnet
`countAbilitiesForSchool` wie gewohnt mit.

**③ ZIELSAMMLER, EINE WAHRHEIT.** Aus `actionAoeHit` herausgelöst, weil
der Pilot dieselbe Zielmenge braucht:

| Methode | liefert |
|---|---|
| `aoeTargetPlayers(pi, config)` | die gemeinten Seiten (`enemy`/`own`/`both`) |
| `collectAoeHeroTargets(targetPlayers, config)` | `{hero, heroIdx, owner}`, Seiten-statt-Spalten-Vertrag v718, ohne `shielded`-Filter |
| `collectAoeCreatureTargets(targetPlayers, config, types)` | `{inst, cd, currentHp}`, Puppet-Regel v704 |
| `projectAoeTargets(pi, config)` | die CPU-Projektion: `{kind, hp, owner, heroIdx}` |

Eine nachgebaute Sammelschleife im Piloten wäre bei jeder Filter-Änderung
still auseinandergelaufen — Rain of Arrows' handgeschriebene Fassung
kannte weder v718 noch geschirmte Helden.

**④ `cpuProjectedDamage` trägt jetzt ZIEL-IDENTITÄT.** Neue Felder
`owner` und (bei Helden) `heroIdx`; ohne sie kann
`projectImpactFeatures` die Minderung nicht je Held nachschlagen. Alte
Deklarationen ohne die Felder verhalten sich unverändert. Muster:

```js
cpuProjectedDamage(gs, pi, engine) {
  return {
    amount: 150,
    targets: engine.projectAoeTargets(pi, { side: 'enemy', types: ['hero', 'creature'] }),
  };
}
```

**⑤ ★ NICHT „halber Wert", sondern HALBIERTER SCHADEN** (Als Korrektur
14.9.). `projectImpactFeatures` rechnet je Held mit
`Math.ceil(amount × (1 − share))` weiter — die Engine-Rundung. Der
Unterschied zählt bei Overkill: 150 auf einen 40-HP-Helden bleiben
halbiert mit 75 tödlich, der Held-Kill fällt also NICHT weg; 150 auf
100 HP verlieren ihn. Eine pauschale Halbierung des Beitrags hätte
beides falsch bewertet.

**⑥ MODUL-FLAG `hitsMultipleTargets`** (Loader-Autoerkennung
`detectMultiHit`, Bauform von `blockedByPileLock` v826 /
`blockedBySummonLock` v834). Erkannt wird `aoeHit(` oder
`beginMultiHit(` im Quelltext, Kommentare vorher gestrippt; manuelles
true/false am Modul gewinnt, `neverMultiTarget` schließt aus.
**Erkennungsmerkmal ist damit dieselbe Flächenklammer, an der auch der
Schutz hängt** — was sich klammert, ist AoE, für Engine wie Pilot.
Trifft heute 28 Karten. Der Loader liest den Quelltext dafür nur noch
EINMAL je Modul (vorher bis zu zweimal).

**⑦ Der Pilot hat zwei Gurte, mit Absicht.** Die exakte Projektion aus
④/⑤ wirkt nur mit `cpuProjectedDamage` UND trainiertem Profil
(`impactWeights` + `impactRules`). Darunter liegt ein grober,
profilunabhängiger Malus in `estimateHandCardValueFor`
(`interferenceAoeDiscount`): blockierter Anteil = Σ `Gewicht × share`
über die Helden, geteilt durch das Gesamtgewicht aller Ziele. Die
Gewichte kommen aus denselben Wertfunktionen, die `pickEnemyTargets` im
Fall „Schadenshöhe unbekannt" benutzt (Held `100 × value`, Kreatur
`50 × value − 30`) — hier ist sie ebenfalls unbekannt, also keine neu
erfundene Skala. Kreaturen zählen nur im Nenner: „Interference" schützt
ausdrücklich nur Helden. Der Malus steht VOR den Ascension-/Cardinal-
Böden und der Kazena-Umkehr, gleiche Rangfolge wie beim Profil-Blend.

**Bewusste Näherung:** gewertet wird immer gegen die Gegnerseite, auch
bei Karten mit `side: 'own'`/`'both'` — die echte Seitenwahl steht in
der `config` im Kartenrumpf und ist von außen nicht lesbar. Die Näherung
kann den Malus unterschätzen, nie überschätzen.


## Neue Karte: „Spatial Crevice" (v1050) — MEHRERE AREAS GLEICHZEITIG

```
Spell · Area · Magic Arts Lv1
You may control up to 3 different Areas. At the end of each turn, the
turn player may search their deck for an Area, reveal it and add it to
their hand.
```

**① `areaLimit` — der neue Vertrag.** Bis v1049 war „nur EINE Area je
Seite" eine harte Bedingung an zwei Stellen (`validateActionPlay` und
die Spielbarkeitsliste). Jetzt entscheidet:

```js
engine.areaLimitFor(playerIdx)      // Grundwert 1
engine.canPlaceAnotherArea(playerIdx)
```

Eine Area hebt das Limit, indem ihr Skript `areaLimit: 3` exportiert.
**★ HOECHSTWERT, NICHT SUMME** — zwei Spatial Crevices ergeben weiter 3,
nicht 5: der Kartentext nennt eine Obergrenze, keinen Zuschlag. Kein
Kartenname steht in der Engine.

**★ „DIFFERENT" (Als Praezisierung 14.9.).** `canPlaceAnotherArea` nimmt
optional den Kartennamen und lehnt ab, wenn die Seite bereits eine Area
dieses Namens kontrolliert — zwei Kopien derselben Area gehen nie
zugleich. Der Riegel sitzt generisch im Gate statt in Crevice: beim
Grundlimit 1 aendert er nichts (mehr als eine Area gibt es dort ohnehin
nicht), und jede kuenftige Limit-Karte erbt ihn von selbst.

**★ Die Karte zaehlt sich selbst mit** (Als Ruling 14.9.): effektiv zwei
„echte" Areas plus Crevice. Das faellt von allein heraus, weil das Gate
die Zonengroesse prueft und Crevice in der Zone liegt.

**② `enforceAreaLimit` — das Limit wirkt auch RUECKWIRKEND.** Verlaesst
Crevice das Brett, muss der Ueberhang weg, und **der Besitzer waehlt**,
was in die Ablage geht (Als Ruling 14.9.). Der Aufruf haengt
bedingungslos am Ende von `removeArea` — no-op, solange die Zone passt,
deshalb muss ihn kein Verursacher selbst ausloesen. `_skipLimitEnforce`
bricht die Rekursion, weil die Durchsetzung selbst ueber `removeArea`
abraeumt. In Rollouts und im Schnellmodus faellt die zuletzt gelegte
Area ohne Abfrage, damit die Simulation nicht an einem Prompt haengt.

Spatial Crevice haengt zusaetzlich einen `onCardLeaveZone`-Rueckfall
dran: er deckt die Wege ab, die an `removeArea` vorbeilaufen
(generisches `actionMoveCard`, Loesch-Effekte). Doppelt ist gefahrlos,
weil `enforceAreaLimit` idempotent ist.

**③ „the TURN PLAYER", nicht „you".** Der Rundenende-Trigger gehoert dem
Spieler am Zug, ganz gleich wem Crevice gehoert — Al 14.9. ausdruecklich:
„es ist absolut moeglich, dass der Gegner den Effekt nutzt". Im Hook
steht deshalb `gs.activePlayer`, KEIN `cardOwner`-Filter. Wer so etwas
nachbaut: der `isMyTurn`-Reflex aus `onTurnStart` waere hier falsch.

**④ Der Hintergrund ist bewusst `tier: 'partial'`.** Spatial Crevice ist
die Karte, die zwei WEITERE Areas ueberhaupt erst erlaubt; ein deckender
Hintergrund wuerde genau die Hintergruende verdraengen, fuer die sie
Platz schafft.


## ★ Area-Zone: der STAPEL (v1050, Als Vorgabe 14.9.)

Seit mehrere Areas gleichzeitig liegen koennen, zeigt die Zone **alle**
statt nur der obersten. Bauform wie `.board-ability-stack`:

* **Richtung:** die NEUESTE Area liegt **vorne und unten**, genau wie bei
  Abilities. DOM-Reihenfolge entscheidet, kein z-index — die aelteren
  schauen mit ihrem oberen Streifen heraus.
* **Versatz:** `--area-stack-offset` (24 % der Kartenhoehe), ein
  Vielfaches der 5 px des Ability-Stapels. Grund ist nicht Optik,
  sondern Bedienbarkeit: **eine untere Area muss gezielt anklickbar
  sein**, um sie zu aktivieren.
* **Tooltip und Klick gehoeren der KARTE, nicht der Zone.** Beides faellt
  durch normales Hit-Testing richtig aus: unter dem Cursor gewinnt, was
  dort ganz oben liegt; eine teilverdeckte Area antwortet nur auf ihrem
  freiliegenden Streifen. Die Zone bleibt fuer die Zielwahl zustaendig
  (Potion-Ziele treffen die ZONE), die Karte fuer ihre Aktivierung —
  getrennt per `stopPropagation`.

**★ KEIN `pointer-events: none` auf den nicht aktivierbaren Karten.**
Genau daran haengt der Tooltip; ohne Maus-Ereignisse waere die halbe
Vorgabe tot. Klicks auf eine nicht aktivierbare Area blubbern ohnehin
zur Zone hoch.

**Drei Stellen, die „genau eine Area" still voraussetzten** und jetzt
mitziehen:
1. `getActivatableAreas` lieferte schon immer EINEN Eintrag JE AREA — die
   Oberflaeche nahm aber nur den ersten je Seite. Jede Karte hat ihre
   eigene HOPT und ihr eigenes `canActivateAreaEffect`.
2. Die Drop-Hervorhebung prueft „Zone hat Platz" statt „Zone leer". Das
   Limit kommt als `areaLimits: [n, n]` aus dem Sync, weil der Client
   die Kartenskripte nicht kennt.
3. `BoardZone` bekam den Opt-in `renderStack(cards)`. Ohne die Prop
   aendert sich nichts; mit ihr uebernimmt die Aufrufstelle die
   Darstellung, sodass BoardZone kein Area-Wissen braucht.

**Nebenbefund, mitgefixt:** das Ladungs-Abzeichen der „up to X times per
turn"-Areas (The Bonegrinder) sass im `children`-Slot von `BoardZone` —
und der wird NUR gerendert, solange die Zone **leer** ist. Das Abzeichen
war damit nie zu sehen, weil es eine liegende Area voraussetzt. Es haengt
jetzt am Stapel.


## ★ Area-Stapel im PUZZLE-EDITOR (v1051, Als Vorgabe 14.9.)

Der Editor muss denselben Stapel bauen koennen wie das Spiel — bis zu
drei Areas, nur verschiedene, mehr als eine nur mit „Spatial Crevice".

**Das Problem: der Editor arbeitet OFFLINE.** Er hat weder Engine noch
Kartenskripte, kann `areaLimitFor` also nicht aufrufen. Im Spiel schickt
der Server `areaLimits` mit; im Editor gibt es keinen Server. Deshalb
eine clientseitige Kopie in `public/app-shared.jsx` — gleiche Bauform
wie das vorhandene `CARD_HAND_LIMIT_MODIFIERS` daneben:

```js
window.CARD_AREA_LIMITS = { 'Spatial Crevice': 3 };
window.computeAreaLimit(areaZone)                  // Grundwert 1
window.canPlaceAnotherArea(areaZone, cardName)     // Platz UND keine Dublette
```

**★ ZWEI KOPIEN DERSELBEN REGEL LAUFEN AUSEINANDER — deshalb ein
Waechter.** `scripts/check-area-limits.js` vergleicht das Register gegen
die `areaLimit`-Exporte aller Kartenskripte, in BEIDE Richtungen. Ohne
ihn waere der Schaden still: der Editor liesse entweder zu wenig zu (die
Karte wirkt kaputt) oder zu viel (das gebaute Puzzle ist im Spiel
ungueltig). Eine neue Limit-Karte braucht also beide Eintraege.

**Vier Stellen im Editor, die „genau eine Area" voraussetzten:**
1. `placeArea` ERSETZTE die Zone und schob die alte Area zurueck auf die
   Hand — die Ersetzungs-Logik eines Ein-Karten-Slots, die den Stapel
   jedes Mal abgeraeumt haette. Jetzt haengt sie an und lehnt mit
   Begruendung ab, wenn Limit oder „different" es verbieten.
2. `canDrop` liess jede Area fallen; jetzt prueft es dieselbe Regel, so
   dass die Zone nicht mehr aufleuchtet, wenn der Ablegen-Pfad die Karte
   ohnehin abweist.
3. `removeCard` UND `clearZone` leerten die ganze Zone (`() => []`).
   `clearZone` raeumt die QUELLE eines Zonenwechsels — beim Verschieben
   einer von drei Areas haette das die anderen beiden mitgeloescht.
   Beide entfernen jetzt genau den Stapelplatz.
4. `zh(...)` las immer `areaZones[si][0]`. Jetzt bekommt jede Karte ihre
   eigenen Griffe mit ihrem Stapelplatz (Rechtsklick entfernt genau sie,
   Ziehen bewegt genau sie), und die Zonen-Huelle traegt den Platz am
   ENDE — ein Drop irgendwo in der Zone haengt an.

`.pz-area-zone` braucht ein eigenes `overflow: visible`: die Editor-Zone
traegt nicht `board-zone-area` und haette den Stapel sonst am Rand
abgeschnitten.

**★ FALLE, EINMAL HINEINGETAPPT (v1052, Als Befund 14.9.: „es werden
zwei Kopien auf einmal hinzugefuegt").** Die Stapelkarten hatten
zunaechst den GANZEN `zh(...)`-Satz — also auch `onDrop` und `onClick`.
Ein Drop auf eine Karte lief damit durch ihren eigenen Handler UND
blubberte zur Zonen-Huelle: `handleDrop` feuerte zweimal. Beide Aufrufe
lasen dieselbe, noch nicht aktualisierte Zone aus dem Closure, bestanden
beide die Legalitaetspruefung und haengten an. Derselbe Weg haette
ausserdem zwei Handkarten verbraucht.

Zwei Riegel, absichtlich beide:
1. **Zustaendigkeiten trennen.** Die Karte bekommt nur, was IHR gehoert
   (`draggable`, `onDragStart`, `onDragEnd`, `onContextMenu`); Ablegen,
   Klicken und Dragover bleiben allein bei der Huelle. Das beseitigt die
   Ursache.
2. **Das Anhaengen idempotent machen.** Die Regel wird ZUSAETZLICH im
   Updater gegen `prev` geprueft, nicht nur gegen den Closure-Stand —
   nur dort sieht sie den wirklich aktuellen Zoneninhalt. Damit kann
   auch kein kuenftiger Aufrufweg versehentlich doppelt anhaengen.

Lehre fuer jede weitere gestapelte Zone im Editor: **verschachtelte
Zonen-Griffe sind ein Doppelfeuer**, und ein Handler, der seinen
Zielzustand aus dem Closure liest, merkt es nicht.

**Der Puzzle-START brauchte nichts.** Die Instanz-Schleife in `server.js`
laeuft schon immer ueber ALLE Eintraege von `gs.areaZones[pi]`.


## Neue Karte: „Festive Werz" (v1082)

```
Creature · Summoning Magic Lv0 · 70 HP   (banned)
When you summon this Creature, pay your opponent any amount of Gold.
Then, draw a card for every 5 Gold paid that way, to a maximum of 4.
You can only activate this effect once per turn.
```

**Verwandt mit „Smuggler's Pier", aber drei Unterschiede entscheiden den
Bau:**

**① DAS GOLD GEHT AN DEN GEGNER**, es wird nicht bloss ausgegeben —
zwei Buchungen: `_payCardCost` beim Zahler UND `actionGainGold` beim
Empfaenger.
**★ Traegt der Gegner eine Gold-Sperre** (`goldLocked`, Golden Arrow),
kommt die Zahlung bei ihm NICHT an. Der Zahler hat trotzdem bezahlt und
zieht trotzdem — das ist die Wirkung der Sperre, kein Fehlschlag der
Karte. Ein Testfall haelt alle drei Teile dieses Falls fest.

**② „ANY AMOUNT OF GOLD"**, nicht „a multiple of 5". Gezogen wird nur je
VOLLE fuenf Gold, deshalb bietet die Auswahl nur die sinnvollen Stufen
(5/10/15/20) plus die Null an. **Das ist eine Darstellungsentscheidung,
keine Regelaenderung** — wer 7 zahlen wollte, bekaeme dieselbe eine
Karte wie fuer 5.

**③ KEINE Zieh-Sperre danach.** Smuggler's Pier setzt `handLocked`;
Werz' Text sagt davon nichts, also bleibt die Hand offen.

Die Obergrenze ist dreifach gedeckelt: 4 Karten, verfuegbares Gold,
Deckgroesse. Alle drei haben eigene Testfaelle.

**Animation** (Al 14.9.: „Geschenke"): neuer Zonen-Effekt `gift_shower`
— bunte Paeckchen mit Schleifenband steigen ueber dem EMPFAENGER auf.
Die Drehung faehrt ueber CSS-Variablen, weil eine laufende Animation ein
inline gesetztes `transform` ersetzt (dieselbe Falle wie beim
Pocket-Sand-Projektil, v1059).


## ★ ZWEI LIVE-BEFUNDE zu „Love Shot" (v1108, Al 15.9.)

Beide fielen erst im echten Spiel auf — kein Testfall haette sie
gefangen, weil beide an Motor-VERTRAEGEN hingen, nicht an der Kartenlogik.

### ① Der Charme-Bypass wurde NIE GEFRAGT

Al: „Mein Charme-Hero kann Love Shot NICHT casten."

**Es gibt ZWEI aehnlich benannte Vertraege, und ich hatte den falschen:**

| Vertrag | wird gelesen am | Beispiel |
|---|---|---|
| `canBypassLevelReq` | der **KARTE** | Placement-Karten, jetzt Love Shot |
| `canBypassLevelReqForCard` | dem **HELDEN** | Cute Princess Mary |

Auf einem Spell liegend wurde `canBypassLevelReqForCard` nie gefragt —
die Klausel tat schweigend gar nichts. **Ein Testfall, der nur die
Funktion aufruft, haette das nicht gefangen**; jetzt prueft er
`heroMeetsLevelReq` END-TO-END mit einem Charme-Helden ohne Magic Arts.

### ② Die geliehene Aktion sah die eigenen Ermaessigungen nicht

Al: „Ich wollte einen auf 0 reduzierten «Cataclysm» mit dem gestohlenen
Hero spielen, durfte das aber nicht."

**★ DIE FRAGE IST: WESSEN ERMAESSIGUNGEN GELTEN?** Der geliehene Held
steht auf der GEGENSEITE — von dort kommen Schulen und Stufen. Die Karte
liegt aber in MEINER Hand, und dort wirken Area-Rabatte, Ethan und die
Hand-Offsets. `heroMeetsLevelReq` las beides von derselben Seite.

Neu: **`opts.levelSourcePi`** benennt die Seite, deren HAND und
Ermaessigungen zaehlen; ohne Angabe bleibt es bei `playerIdx`, alle
bisherigen Aufrufer sind unveraendert. Der `charmed`-Zweig von
`getHeroPlayableCards` reicht sie durch — und weil der Spielweg dieselbe
Liste liest, greift der Fix an beiden Enden.

**★★ ZWEITE RUNDE (v1109): ES GIBT VIER STUFENQUELLEN, nicht drei.**
Al meldete den Fehler NACH v1108 erneut: „Der uebernommene Hero kann nach
wie vor den Lv-0-Cataclysm nicht casten — einen anderen Spell, den er
nativ casten koennte, aber schon."

v1108 hatte nur die HAND-seitigen Quellen umgestellt. Die vierte laeuft
woanders:

| Quelle | wo | in v1108 |
|---|---|---|
| gestempelter Handwert (`_handLevelSetFor`) | `heroMeetsLevelReq` | ✓ |
| Hand-Offset-Maps | `heroMeetsLevelReq` | ✓ |
| Mana-Absorbing-Zuschlag | `heroMeetsLevelReq` | ✓ |
| **brettweite Senker** (Area-Rabatte, Ethan, Taios Sun-Fencer) | **`_testLevelReqForZones` → `_applyCardLevelReductions`** | **✗** |

Die vierte sitzt eine Ebene tiefer und fragte weiter die Seite des
GELIEHENEN Helden. Jetzt reicht `_testLevelReqForZones` `levelSourcePi`
durch; `heroIdx` bleibt der SPIELENDE Held, damit pro-Held-Rabatte am
richtigen Helden greifen.

**★ LEHRE, doppelt gelernt:** „wessen Stufenquelle" ist nicht EINE
Frage, sondern eine pro Quelle. Ich hatte drei gefunden und die vierte
uebersehen, weil sie in einer anderen Funktion steht. Der Testfall
stellt jetzt den ECHTEN Fall nach — Senker auf dem BRETT, nicht nur
Hand-Offsets — samt Gegenprobe ohne Senker.


## „Memory Blast" ENTSCHAERFT (v1107) — zwei Klauseln gestrichen

```
Choose a target your opponent controls and deal damage equal to 10 times
the number of cards in your opponent's discard pile to it. If that
target was originally controlled by you, permanently regain control of
it instead.
```

Die Karte war mit zwei Bremsen gebaut; Al hat 15.9. beide gestrichen:

| gestrichen | Umsetzung faellt weg |
|---|---|
| „This must be the ONLY DAMAGE you deal this turn" | `ps.damageLocked` |
| „can NEVER HIT MORE THAN 1 TARGET" | `neverMultiTarget` |

**★ FOLGE DER ZWEITEN STREICHUNG, die man kennen sollte:**
Verdopplungs-Effekte duerfen die Karte jetzt ausweiten. „Bomb Berserker
Bartas" liest genau diese Flagge und liess Memory Blast bisher in Ruhe —
bei vollem gegnerischem Ablagestapel trifft der Zauber dann **zweimal
mit voller Wucht**. Das ist kein Versehen, sondern was die gestrichene
Klausel bisher verhindert hat.

Was bleibt: die Schadensformel und die Abzweigung („originally
controlled by you" → zurueckholen statt Schaden, ohne Rueckfall).

**Testfaelle umgebaut statt geloescht:** sie pruefen jetzt, dass nach
Memory Blast in derselben Runde **weiterer Schaden durchgeht**, und dass
weder im Code noch in `cards.json` eine der beiden Bremsen uebrig ist.

## Stufenaenderungen (Al 15.9.)

| Karte | alt | neu |
|---|---|---|
| Siege | Lv 3 | **Lv 2** |
| Decisive Defeat | Lv 2 | **Lv 1** |

Beide Stufen sind in den jeweiligen Pruefstaenden festgenagelt — samt
Schule und Subtyp, damit eine spaetere Aenderung auffaellt statt
stillschweigend durchzugehen.


## „Love Shot" NEU GEFASST (v1106) — inkl. cards.json

```
This Spell can be used by Heroes with the "Charme" Ability regardless of
its level. Draw a card from your opponent's deck. Then, choose a Hero
your opponent controls and perform an Attack or Spell from your hand
with it, if possible. That Attack or Spell counts as an additional
Action. For that Attack or Spell only, the Hero is treated as controlled
by you.
```

**DREI AENDERUNGEN, alle folgenreich:**

**① NEU: Charme traegt die Karte, egal in welcher Stufe.** Ueber
`canBypassLevelReqForCard`. Die SCHULE bleibt unberuehrt — Charme
ersetzt nur die STUFE, wie Wisdom/Divinity die Ability ersetzen (siehe
v1104).

**② Gezogen wird aus dem GEGNERDECK** statt aus dem eigenen.

## ★ NEU: `_opponent-deck-shared.js` — EIN Weg ins Gegnerdeck

Al ausdruecklich: „Draw from opponent's deck existiert schon in
Infiltration; achte darauf, dass es z.B. Lillys Effekt triggert."

Der Vorgang ist **kein Einzeiler**, sondern eine Kette mit fuenf
Gliedern, von denen jedes einzeln vergessen werden kann:

1. der **Flug-Broadcast MUSS VOR der Zustandsaenderung** raus — er
   registriert die Client-Maske, die den normalen Zieh-Anim fuer genau
   diesen Handplatz unterdrueckt. Danach gesendet, saehe die Karte aus,
   als kaeme sie aus dem EIGENEN Deck;
2. Deck kuerzen, auf die Hand legen;
3. `_tagHandCardOrigin` — die Karte kehrt am Ende zum Besitzer zurueck;
4. nur der EIGENEN Seite aufdecken;
5. **`onCardTakenFromOpponent`** — der Hook, an dem „Lilly, the Charming
   Infiltrator" haengt;
6. bei `asDraw: true` zusaetzlich **`onDraw`** — der Hook von „Cute
   Meanie Melissa" (siehe unten).

## ★★ v1184 — „Fireball" klammert seine Kreaturtreffer (Deepsea Idol greift wieder)

Ursache ② aus v1183 behoben: Fireball arbeitete seine Ziele in einer Schleife
ab, und `actionDealCreatureDamage` verpackt JEDEN Treffer in einen eigenen
Batch mit genau einem Eintrag — das Fenster „2+ eigene Kreaturen aus einer
Quelle" ging nie auf. Jetzt sammelt die Karte ihre Kreaturziele und gibt sie
in EINEM `processCreatureDamageBatch` ab, mit `animType: 'flame_strike'` am
Eintrag statt eigener Broadcasts — genau das Muster von „Aquatic Arrows".
Helden bleiben beim Einzelweg, sie haben ihre eigenen Fenster.

**Messung:** Fireball und Flame Avalanche melden jetzt beide `fired: 1`, die
Abfrage erreicht den Verteidiger, und die Kreaturen ueberleben.

**★ NOCH OFFEN — dieselbe Klammer fehlt 22 weiteren Karten**, die mehrere
Kreaturen in einer Schleife treffen (u.a. Armageddon, Explosion, Heat Wave,
Laser Volley, Cataclysm, Future Tech Barrage, Land Sharks). Fuer sie gilt
derselbe Umbau; einige brauchen dabei Ergebnisse je Treffer (Rider), das ist
je Karte zu pruefen.

## ★★ v1183 — „Deepsea Idol" triggerte nicht: ZWEI Ursachen (Als Befund 17.9.)

Gemessen mit `engine._batchWindowStats` (Zaehler im Batch-Fenster).

**① Flaechen-Zauber (Flame Avalanche) — Quellen-Zaehlung nach Objekt-Identitaet.**
Das Fenster verlangt „2+ eigene Kreaturen aus EINER Quelle" und gruppierte
dafuer nach der OBJEKT-IDENTITAET von `e.source`. Der Flaechen-Weg legt je
Eintrag ein eigenes Quell-Objekt an — also zaehlte jede Kreatur als eigene
Quelle, `_maxSameSource` blieb 1, Ausgang `srcMiss`. **Behoben:** stabiler
Schluessel aus Kartenname + Seite + Held (+ Instanz-Id); Statusschaden (Burn,
Gift) bleibt bewusst je Eintrag getrennt. Messung vorher `srcMiss: 1`,
nachher `fired: 1` samt Abfrage an den Verteidiger.

**② Schleifen-Zauber (Fireball) — gar kein Batch.** `actionDealCreatureDamage`
ruft IMMER `processCreatureDamageBatch([entry])` mit genau EINEM Eintrag.
Eine Karte, die ihre Ziele in einer Schleife abarbeitet, erzeugt damit N
Batches zu je 1 — das Fenster oeffnet gar nicht (`entries.length < 2`), im
Zaehler taucht es nicht einmal auf. Das trifft JEDE Mehrziel-Karte, die nicht
ueber `actionAoeHit` laeuft. **Noch offen**: Behebung heisst, solche Karten
ihre Kreaturtreffer in EINEM `processCreatureDamageBatch` abgeben zu lassen
(oder eine Sammel-Klammer in der Engine).

## ★★★ v1182 — Flaechen-Weg angebunden; Bilder fuer Attacks UND Creatures

**Warum „Flame Avalanche" stumm blieb — zwei Luecken:**
1. Die Karte animiert ueber `ctx.aoeHit({ animationType })`, nicht ueber
   eigene Broadcasts — die Migration von v1181 suchte nur nach
   `play_zone_animation`.
2. Der FLAECHEN-Weg (`actionAoeHit`) hat eigene Negationsfenster
   (Surprise + Post-Target) — auch die rufen jetzt `negationsBilder`.

**Zweite Migrationswelle:** Die Animationstypen werden gegen die
`ANIM_REGISTRY` des Clients gepruefen (250 Eintraege), damit Prompt- und
Schadenstypen (`confirm`, `hero`, `equip`, `destruction_spell` …) nicht
faelschlich als Bilder gelten. Erkannt werden `type:` UND `animationType:`.
Neu deklariert: **230 Karten** — 128 Creatures, 87 Spells, 15 Attacks.

**Stand:** 301 von 616 Karten mit eigener Deklaration; die uebrigen 315
(meist ohne jede eigene Animation) fallen auf die Schul-Bilder zurueck
(v1181), bleiben also ebenfalls sichtbar.

## ★★★ v1181 — ALLE offensiven Zauber am neuen Bilder-System; Abwehr-Timing

**Timing (Al 17.9.):** Die Abwehr soll erst KURZ NACH dem Beginn der
Zauberbilder sichtbar werden. Dafuer gibt es neben `nachBilder` jetzt
`waehrendBilder`: die Engine startet es PARALLEL zu den Bildern des
abgewehrten Zaubers (nicht abgewartet), die Karte legt ihre Pause selbst
fest. „MOE Shield" wartet 300 ms und setzt dann seine Schilde; das
Zerschellen bleibt `nachBilder`. Reihenfolge im Test:
Flug → Herz → Einschlag → Zerschellen.

**Migration:** 71 Zauber und Attacks tragen jetzt `spellVisual` —
66 mit ihrem Einschlag (genau eine Zonen-Animation im Skript), 5 zusaetzlich
mit ihrem Geschoss (Basketskull, Energy Drain, Hammer Throw, Ricochet, Rocket
Fist). Die Deklaration wird NUR im Negationsfall gespielt; im normalen Weg
bleibt es bei den Broadcasts im Effekt selbst, also kein Doppelbild.
Vollstaendig entkoppelt (Karte ruft `spielZauberBilder` selbst) sind wie
gehabt Fireball, Icebolt und Memory Blast — das Muster fuer neue Karten.

**★ ALLGEMEINER RUECKFALL:** Ein Zauber ganz ohne `spellVisual` bleibt bei
einer Negation trotzdem sichtbar — `_standardZauberBilder` gibt ihm ein
Geschoss nach seiner Zauberschule (Destruction 🔥, Decay 💀, Magic Arts ✨,
Summoning 🌀, Support 💫, Fighting 💥) und einen passenden Einschlag. Eine
eigene Deklaration schlaegt den Rueckfall immer.

## ★★ v1180 — Negationsbilder an ALLEN Stellen; Nachlauf der Abwehrkarte

v1179 haengte die Bilder nur an die zwei Negationsstellen in
`promptEffectTarget`. Fireball und Memory Blast laufen aber ueber
`promptDamageTarget` / `promptMultiTarget` — dort wird `_spellNegatedByEffect`
an VIER weiteren Stellen gesetzt, und genau die blieben stumm. Sichtbar war
dann nur „MOE Shield"s Platzhalter-Flug (✨).

**Jetzt EIN Weg:** `engine.negationsBilder(quelle, ziele, ergebnis)` haengt an
allen sechs Stellen (beide Fenster in `promptEffectTarget`, je zwei in
`promptDamageTarget` und `promptMultiTarget`). Er spielt

1. die eigenen Bilder des abgewehrten Zaubers (`spellVisual`, v1179) und
2. danach den **Nachlauf der Abwehrkarte**: eine Reaktion darf ihrem Ergebnis
   `nachBilder: async (engine, info) => { … }` mitgeben.

**MOE Shield** nutzt das: die Herzen stehen als Schilde, die Engine spielt die
echten Bilder des Zaubers, und erst danach zerschellt er an ihnen
(`negate_shatter`). Der Platzhalter-Flug ist raus.

## ★★★ v1179 — ZAUBERBILDER SIND VOM EFFEKT ENTKOPPELT (Al 17.9.)

Bilder steckten bisher im Effekt-Rumpf. Wurde ein Zauber negiert („MOE
Shield"), lief der Rumpf nie — man sah vom abgewehrten Zauber nichts.

**VERTRAG `spellVisual`** am Kartenskript, rein visuell (kein Zustand, kein
Schaden):

```js
spellVisual: {
  projectile: { emoji?, projectileClass?, trailClass?, projectileShape?,
                baseAngle?, emojiStyle?, sfx?, duration?, power? },
  flightMs?, stagger?,            // Wartezeit / Versatz bei mehreren Zielen
  impact: { type, power?, duration? },   // Zonen-Animation am Ziel
  impactMs?,
}
// oder als Funktion fuer eigene Ablaeufe:
async spellVisual(engine, info) { … }   // info: { cardName, owner, heroIdx,
                                        //   zoneSlot, targets, power, negiert }
```

**Engine:**
* `engine.spielZauberBilder(cardName, info)` — die Karte ruft es an der
  Stelle auf, an der frueher ihre Broadcasts standen;
* `engine.spielNegierteZauberBilder(quelle, ziele)` — ruft die ENGINE selbst,
  wenn eine Reaktion oder ein Surprise den Zauber in `promptEffectTarget`
  abfaengt (beide Negationsstellen). Der Effekt laeuft dann nicht, die Bilder
  schon; die Karte erkennt den Fall an `info.negiert`.

**Umgestellt:** Fireball (Volley + Flammenexplosion), Icebolt (Eisgeschoss +
Eishuelle), Memory Blast (Funktion, weil die Wucht Flug und Einschlag
skaliert — bei Negation halbe Kraft). Weitere Zauber folgen demselben Muster;
ohne `spellVisual` verhaelt sich eine Karte wie bisher.

## v1178 — „MOE Shield": Herzen SCHIRMEN ab, der Zauber zerschellt

Al 17.9.: „Die Animation des blockierten Spells sollte trotzdem spielen; die
Herzen schirmen die Ziele ab."

**★ Was NICHT geht und warum:** die eigene Animation des abgewehrten Zaubers
steckt in seinem Effekt-Rumpf (`onPlay` nach der Zielwahl). Wird er negiert,
liefert `promptEffectTarget` eine leere Auswahl, die Karte bricht davor ab —
ihre Bilder laufen nie. Sie nachtraeglich zu starten hiesse, den Effekt selbst
laufen zu lassen; nur der SCHADEN wird zentral abgefangen, andere Wirkungen
(Ziehen, Zerstoeren, Status) nicht.

**Gezeigt wird deshalb der Abwehr-Vorgang:**
1. die Herzen stehen als SCHILDE vor jedem Ziel (`shield: true` — Schutzring
   dreht sich, das Herz haelt still statt sofort zu verblassen);
2. der abgewehrte Zauber fliegt vom WIRKER auf jedes Ziel
   (`play_projectile_animation`, Klang `spell_cast`);
3. er zerschellt an den Schilden (neue Animation `negate_shatter`: Blitz,
   Aufprallring, 14 Scherben; Klang `negate` + heller `critical_strike`);
4. danach dehnen sich die Herzen aus und verblassen wie gehabt.

## v1177 — „MOE Shield": pinke Herzen auf allen geschuetzten Zielen

Die Karte hatte gar keine Animation. Jetzt blueht auf JEDEM Ziel, das der
negierte Zauber getroffen haette, ein grosses pinkes Herz auf (`moe_heart`):
es dehnt sich und wird ueber eine Sekunde durchsichtig, dazu zehn Funken
nach aussen. Groesse ≈ 2× die Kartenseite, gesetzt am Rechteck des Ziels
(`x`/`y`, Lehre v1154).

Die Ziele werden mit derselben Kennung entdoppelt wie die Zaehlung (ein
doppelt genanntes Ziel = EIN Herz) und um 90 ms gestaffelt angestossen, damit
es wie eine Kette klingt. Klang: `buff` (hell) plus ein weicher `heal` im
Nachklang.

## ★ v1176 — Klang zum „Memory Blast"; ZONE_ANIM_SFX darf rechnen

* **★ Gefunden beim Nachruesten:** `onProjectileAnimation` zerlegt die
  Nutzlast in eine feste Feldliste — `power` war nicht dabei und kam bei der
  Projektilform NIE an (`darkBlast` fiel immer auf 0.5 zurueck). Jetzt
  gehoert `power` zum Eintrag.
* **ZONE_ANIM_SFX-Eintrag darf eine FUNKTION sein** und die Nutzlast der
  Animation lesen: `playSFXForZoneAnim(type, payload)`. Die drei Aufrufer im
  Client reichen sie durch (Zonen-, Handkarten- und Aufloesungs-Animation).
  Bestehende Eintraege (Objekt oder Sequenz) bleiben unveraendert gueltig.
* **`dark_blast`:** `elem_dark` + `heavy_impact`, beide tiefer und lauter mit
  steigender Wucht (vol 0.64/0.55 bei power 0.2 → 1.00/0.95 bei 1.0), ab
  power > 0.55 zusaetzlich ein `critical_strike`. Der Flug selbst klingt
  weiterhin mit `elem_dark` vom Wirker los.

## v1175 — „Memory Blast": Stoss aus negativer Energie, Einschlag am Ziel

* **Sitz:** `dark_blast` las `x`/`y` nicht — `.dark-blast` stand per CSS in
  der Mitte der Animationsebene (dieselbe Lehre wie v1154). Jetzt
  `position: fixed` am Rechteck des Ziels.
* **Neue Projektilform `darkBlast`** (`DunkelBlastStrahl`, Bauart wie
  `sandStream` v1149): ein Stoss vom WIRKER zum Ziel — Kopf mit Wirbelring,
  gestreckter Schweif, Ranken aus Dunkelenergie, Funken und eine
  Leuchtspur. Klang `elem_dark`.
* **Skaliert mit dem Schaden** (`power` = Schaden ÷ voller Wucht, also der
  Zahl der Karten in der gegnerischen Ablage): Kopf 35 → 88 px, Ranken
  8 → 20, Funken 11 → 26, Flugdauer 620 → 880 ms; am Einschlag Skala
  1.26 → 3.14, Ringe 1 → 3, Splitter 11 → 30. Die Einschlagsgroesse
  beruecksichtigt zusaetzlich die Groesse des Ziels.

## ★★ v1174 — EINFACHAUSWAHL TAUSCHT IMMER (Al 17.9.)

**Bug:** Ein zweiter Klick markierte ein weiteres Ziel, statt das erste
abzuwaehlen — der Effekt nahm dann das ZUERST geklickte. Der Client tauscht
nur, wenn er eine Obergrenze kennt, und die liest er aus `maxTotal`; Karten,
die nur `maxSelect: 1` (oder `selectCount: 1`) mitgeben, fielen durch.

**Zwei Riegel statt Nachtragen je Karte:**
* `promptEffectTarget` uebersetzt `maxSelect`/`selectCount` von 1 in
  `maxTotal: 1`, bevor die Abfrage rausgeht — gilt fuer JEDE Karte;
* der Client liest in `togglePotionTarget` zusaetzlich `selectCount` und
  `maxSelect` als Obergrenze (alte Abfragen nach Wiederverbindung).

Betroffen waren 5 Aufrufe (Cheeky Monkee, Resilient Monkee, Logan, beide
Debt-O-Tron-Modelle) plus „Alluring Light", das die Grenze jetzt auch
ausdruecklich mitgibt. Der Waechter `check-single-target` bleibt als Netz
fuer Einfachauswahlen ganz ohne Angabe.

## v1173 — „Alluring Light": Anlock-Leuchten sitzt am Ziel, groesser und laenger

Dieselbe Lehre wie bei „Decapitating Strike" (v1154): die Komponente las
`x`/`y` nicht, `.lure-beacon` stand per CSS bei `left: 50%; top: 50%` der
Animationsebene — also in der Bildschirmmitte. Jetzt `position: fixed` am
Rechteck des Ziels; die Komponente liefert `left`/`top` und rechnet ihre
Groessen aus `w`/`h` (Ring ≈ 1,7× der Kartenbreite).

Dazu (Al 17.9.): ein weicher Halo, acht pulsende Lichtstrahlen, VIER statt
drei Ringe und ein groesserer Kern; die Zonen-Animation laeuft 2,4 s
(`duration`), der Guss wartet 1,3 s statt 0,7 s, bevor der Angriff losgeht.

## ★★ v1172 — „Alluring Light" blieb nach der ersten Zielwahl stehen; Waechter dagegen

**Dieselbe Falle wie bei „Ricochet" (v1150):** `promptEffectTarget` liefert
die IDs der gewaehlten Ziele (`'hero-1-0'`), NICHT die Zielobjekte. Die Karte
las `heldWahl[0].heroIdx` an einer Zeichenkette, bekam `undefined` und brach
still ab — die zweite Zielwahl ging nie auf. Jetzt fuehrt ein kleiner Helfer
(`zielVonAntwort(antwort, angebot)`) die Antwort ueber die ANGEBOTENE Liste
auf das Zielobjekt zurueck.

**★ NEUER WAECHTER `scripts/check-target-answers.js`:** meldet jede Stelle,
die die Antwort einer Zielwahl direkt wie ein Zielobjekt liest
(`.heroIdx`, `.slotIdx`, `.type`, `.owner`, `.cardInstance`), ohne sie ueber
`ziele.find(t => t.id === id)` oder `zielVonAntwort(...)` zurueckzufuehren.
Gegen die kaputte Fassung von „Alluring Light" gegengeprueft: meldet beide
Stellen, mit der Reparatur wieder gruen.

## v1171 — „Cleansing of the Land": Flug aus der Hand, lauteres Feuer

* **Flug Hand → Area:** `placeArea` meldet nur das Herabsinken IN die Zone;
  den Weg dorthin meldet der Guss selbst — `play_pile_transfer` mit
  `from: 'hand'`, `fromHandIdx` (Platz in der Hand), `to: 'area'` und
  `finalHandSize`, dann erst die Entnahme. Lehre fuer jeden Hand→Brett-Weg,
  der nicht ueber `doPlaySpell` laeuft.
* **Klang lauter:** `ZONE_ANIM_SFX.fire_sweep` jetzt 1.0 / 0.8 / 0.7 statt
  0.42 / 0.30 / 0.26.

## v1170 — „Cleansing of the Land": Feuerwand, Klang, erweiterter Effekt

**Animation:** `fire_sweep` war eine orange Linie. Jetzt eine WAND: ein
mitwanderndes Buendel aus Glutkern, Hitzeschleier, 34 flackernden
Flammenzungen ueber die ganze Hoehe, 26 Funken und 8 Rauchfahnen; dahinter
waechst eine verkohlte Spur, die verglimmt. Weiterhin auf der
Atmosphaeren-Ebene (unter den Karten), animiert werden nur `opacity` und
`transform` — die Wand wandert als Ganzes, ihre Flammen flackern an Ort und
Stelle. **Klang:** `ZONE_ANIM_SFX.fire_sweep` — leises `elem_fire`, `burn`
und ein zweites `elem_fire` im Nachlauf.

**Effekt (Al 17.9.):**
* „While there is at least 1 Area on the board, this Spell can be used as an
  additional Action." → `inherentAction(gs)` liest die Area-Zonen.
* „Send all Areas on the board to the discard pile." → `removeAllAreas(-2)`
  direkt nach der Feuerwand.
* Die Suche ist jetzt ein „may": ohne Area im Deck oder bei Abbruch endet die
  Karte, das Abraeumen bleibt — KEIN `_spellCancelled` mehr.
* „openly add it to your hand" — `actionAddCardFromDeckToHand` zeigt die
  Karte ohnehin beim Holen.
* `spellPlayCondition`: spielbar, sobald es etwas zu tun gibt — Area auf dem
  Brett ODER Area im Deck.

## ★★★ v1169 — ZUGEFUEGTE vs. PASSIVE STATUSEFFEKTE (Al 17.9.)

v1168 machte `negated` pauschal heilbar — richtig fuer ZUGEFUEGTE Negierung
(Null, Decisive Defeat), falsch fuer Negierung, die eine KARTE aufrecht
haelt. Die Unterscheidung heisst jetzt ausdruecklich so, und die Marke dafuer
gab es schon: `sourceBound: true` am Status (v731, Water Golem).

| Art | Beispiele | heilbar | uebertragbar (Tea) | Ablauf |
|---|---|---|---|---|
| **zugefuegt** | Nulls Negierung, Frost, Gift, Anhaengsel-Status (Decisive Defeat) | ja | ja | eigene Dauer; Anhaengsel folgen ihrem Status (v1168) |
| **passiv** (`sourceBound`) | Bishop of Kings [B], Water Golem, Weakening Crystal | ja — aber nur VORUEBERGEHEND | **nein**, „Tea" heilt ihn nur | endet mit der Quelle, nicht zum Zugende; die Quelle legt ihn zum naechsten Rundenbeginn und bei ihrer Erneuerung sofort neu an |

**Engine:** `istPassiverStatus(statusData)` / `istPassiverHeldenStatus(pi, hi, key)`.
**Tea:** passive Status fallen aus `transferStatuses` heraus — sie werden
geheilt, aber nicht weitergereicht (und ein zweites Ziel wird gar nicht erst
erfragt, wenn nichts uebrig bleibt).
**Weakening Crystal** traegt jetzt ebenfalls `sourceBound` (Hand-Passiv).
Bishop [B] und Water Golem trugen es schon; ihre Wiederanlage laeuft ueber
`onTurnStart` / `onCardEnterZone` (Erneuerung) wie gefordert.

## ★★★ v1168 — ANHAENGSEL FOLGEN IHREM STATUS; `negated` ist heilbar; Stranglehold

### ★ ALLGEMEINE REGEL (Al 17.9.)
„Wird ein per Anhaengsel zugefuegter Status GEHEILT, geht die Karte in die
Ablage ihres URSPRUENGLICHEN Besitzers (mit Flug); wird er UEBERTRAGEN, geht
sie in die Support Zone des neuen Traegers. Wer keine freie Support Zone hat,
kann als neuer Traeger nicht gewaehlt werden."

| Baustein | Wirkung |
|---|---|
| `anhaengselStatusHooks(CARD, STATUS, { heilenWirftAb: true })` | Heilen → `sendBoardCardToDiscard` (Flug, Ablage des urspruenglichen Besitzers). Decisive Defeat nutzt es jetzt |
| `engine.anhaengselFuerStatus(pi, hi, status)` | die Karte hinter einem `_fromAttachment`-Status |
| `engine.hatFreienSupportPlatz(pi, hi)` | Filter fuer neue Traeger |
| `engine.anhaengselUmziehen(inst, owner, heroIdx)` | Umzug samt Flug und Zonenpflege |
| `inst.counters._anhaengselZiehtUm` | setzt der uebertragende Effekt VOR dem Heilen — sonst wuerfe der Status-Hook die Karte schon dabei ab |

**Tea** merkt sich die Anhaengsel vor dem Heilen, bietet als zweites Ziel nur
Helden mit freier Support Zone an und zieht die Karten nach der Uebertragung
um; scheitert ein Umzug, greift wieder die Heil-Regel. In
`cleansableHeroEntries` steht ein Anhaengsel mit eigenem Status nur noch
EINMAL — als sein Status.

### ★ `negated` ist ein Status wie jeder andere
Die globale Sperre `cleansable: false` (v1103) machte Nulls Negierung
unheilbar und mit „Tea" nicht uebertragbar. Jetzt `cleansable: true`; wer
haerter binden will, setzt `unhealable: true` an der einzelnen Anwendung. Der
Sonderweg fuer `_byWeakeningCrystal` / `_fromAttachment` entfaellt.

### Balance
**Stranglehold:** Level 0 → 1; der Basis-ATK-Bonus haengt jetzt an Fighting 3
statt Fighting 1 (`data/cards.json` + Skript).

## ★★★ v1167 — Tester-Batch: Kreatur-Wirker, Opfer-Beschwoerung, Set-Bildschirm, Zhigao-Decks

### ★ WER HAT DEN ZAUBER GEWIRKT? (Frost Rune fror den Wirt statt der Kreatur)
Die Engine kann einen Kreatur-Wirker laengst als Quelle ausweisen
(`gs._spellCasterCreature` → `_rewriteSourceForCreatureCaster` →
`isCreatureSource`), aber JEDE castende Kreatur musste die Marke selbst
setzen — von sechs taten es drei. Jetzt setzt die Engine sie waehrend JEDES
`onCreatureEffect` (beide Aufrufstellen: `_engine.js` und `server.js`).
Damit trifft jede Reaktion, die ihre Quelle angreift (Frost Rune, Booby
Trap, Fireshield …), die Kreatur — Chaorc Friendly Fireballer, Demon's Gate
und alle kuenftigen ohne eigene Zeile.

### ★ `requiresActiveCaster` — Opfer-Beschwoerung braucht einen wachen Helden
`canBypassFreeZoneRequirement` galt im `heroParalyzed`-Zweig (Karten-Karte
UND `validateActionPlay`) als Freibrief: „Guardian of Teocuilatl",
„Suspicious Monster", Archer/Warrior of Teocuilatl liessen sich mit komplett
eingefrorener Aufstellung beschwoeren. Wer OPFERT, meldet jetzt
`requiresActiveCaster: true`; reine Platzierungen (Deepsea, DDG) bleiben
erlaubt.

### Weitere Meldungen
* **Set-Bildschirm zerrissen:** `.set-complete-overlay { position: relative }`
  ueberschrieb das `position: fixed` von `.modal-overlay` — der Abschluss war
  ein Block IM Seitenfluss. Jetzt wieder `fixed`.
* **Ungewolltes Rematch:** der 2-Sekunden-Timer fuers naechste Satzspiel lief
  weiter, wenn der Satz in der Zwischenzeit vorzeitig endete. `endGame`
  loescht ihn, `advanceToNextGame` bricht bei entschiedenem Satz ab.
* **Temple of Sacrifice ruckelte:** `mix-blend-mode: screen` auf der
  dauer-animierten Glanzebene zwang die 88 gedrehten Ziegel darunter zu
  staendigem Neurechnen. Jetzt gewoehnlicher Verlauf mit
  `will-change: opacity`.
* **Shapeshifter-Gestalt blieb liegen,** wenn sie (Slippery Fridge) zu einem
  anderen Helden zog: die Ruecknahme suchte in der urspruenglichen Zone.
  Jetzt zaehlt die Marke `_shapeshiftEquip`, nicht der Platz.
* **Zhigao-Decks galten als „incomplete":** der Server verlangte an vier
  Stellen drei Helden. Gemeinsamer Helfer `benoetigteHeldenzahl` /
  `heldenzahlOk` (Kopien-Familie eingeschlossen).
* **Icebolt:** Decay Magic + Destruction Magic. **Great Offensive:** nur noch
  Creatures mit Level ≤ 2 (`data/cards.json` + Skript).

## ★★★ v1166 — Area-Auren beim Entfernen; geerbte Heldeneffekte; Doppelschulen-Filter; zwei Balance-Aenderungen

### Area-Auren fallen jetzt auf JEDEM Weg (Al 17.9.)
`removeArea` glich ab, der allgemeine Kartenweg nicht — „The Yeeting",
Zerstoerung und Rueckhand liessen die Verdopplung stehen. `syncAlleAtkAuren()`
haengt jetzt zentral an `placeArea`, `removeArea` und `actionMoveCard`
(Austritt aus der Area Zone). Das Kartenskript braucht dafuer keine Hooks mehr.

### ★ KOPIERTE UND GEERBTE HELDENEFFEKTE
Die Hooks liefen (seit 28.8. kennt `isActiveIn` angelegte Helden), aber die
ANFANGSROUTINE des uebernommenen Skripts nicht — die steht in `onGameStart`
und ist mitten im Spiel laengst vorbei. Darum fehlte einem kopierten „Willy"
`_willyFirstTurn` (sein Zugende-Trigger prueft ihn), „Sol Rym" seine
`levelOverrideCards` und „Johanna" ihr Reinigungsstoss.

| Engine | Wirkung |
|---|---|
| `initGainedHeroEffect(inst, grund)` | feuert `onIdentityGained`, sonst `onGameStart`, fuer genau diese Instanz |
| `loseHeroEffect(inst, grund)` | feuert `onIdentityLost` — Aufraeumen am Ende einer Leihe |

Angebunden: „???, the Shapeshifter" (nach dem Umbenennen), „Initiation
Ritual" (beim Anlegen), und der Identitaets-Sweep ruft `loseHeroEffect`.
Karten: Johanna bekommt `onIdentityGained` (reinigt sofort), Sol Rym
`onIdentityLost` (nimmt Freigabe und Aktionsgrenze zurueck).

### ★ HERO-EFFEKT-HERVORHEBUNG (Al 17.9.)
`getActiveHeroEffects` verlangt jetzt ein aufrufbares `onHeroEffect` — ohne
das gibt es nichts zu aktivieren. Alleria, beide Beatos, Monia und Willy
tragen `heroEffect: true` nur als Merker fuer passive Kanaele; ihre Karten
leuchteten trotzdem, und der Klick lief ins Leere. Die inhaltlichen Gates
(??? ohne freie Zone / ohne Kandidaten, Garius ohne Opfer) liefen schon
richtig ueber `canActivateHeroEffect`.

### Doppelschulen-Filter (Deck-Builder + Puzzle-Macher)
`app-shared.jsx`: `istDoppelKarte`, `doppelFilterMoeglich`,
`doppelFilterAnwenden` (ueber `window` in beiden Bundles). Neue Auswahl unter
„Subtypes": „Spell Schools: Show all" (Standard) / „Double only" — zeigt nur
Attacks, Spells und Creatures mit ZWEI Spell Schools (36 Karten). Die Option
ist ausgegraut, sobald die uebrige Filterung keine Attacks/Spells/Creatures
mehr enthaelt, und greift dann auch gesetzt nicht.

### Balance
* **Great Offensive:** „Immediately end your turn afterwards."
  (`gs._spellEndsTurn = true`).
* **Prophecy of Tempeste:** „You can only have 1 in play at a time." — Sperre
  in `spellPlayCondition` (Tor JEDES Spielwegs) und in `attachmentHosts`.

## ★★★ v1165 — ATK-MULTIPLIKATOR-AUREN zentral; „Rioting Village" als Szene

**★ Der alte Weg war kaputt.** „Rioting Village" spiegelte jede ATK-Aenderung
selbst nach (`afterHeroAtkChange`), und das Schloss `_atkAuraTiefe` oeffnete
sich sofort wieder: `runHooks` ist ASYNCHRON, der `finally`-Block wartet nicht
auf sie. Schon EIN Dorf lief in eine Endlosschleife (MAX_HOOKS_PER_TURN, ATK
im fuenfstelligen Bereich).

**Neuer Vertrag — `heroAtkMultiplier`** (Zahl oder
`(gs, pi, hi, engine, inst) => Zahl`): die Engine rechnet
GRUNDWERT × Produkt aller Faktoren und fuehrt die Differenz in
`hero._atkAuraGrant`.

| Engine | Wirkung |
|---|---|
| `_atkAuraFaktor(pi, hi)` | Produkt aller aktiven Faktoren |
| `_syncHeroAtkAura(hero, pi, hi)` | bringt einen Helden auf Grundwert × Faktor (der ZWEITE erlaubte `hero.atk`-Schreiber, im Waechter `check-atk-funnel` eingetragen) |
| `syncAlleAtkAuren()` | alle Helden — beim Eintritt/Abgang einer Aura und beim Puzzle-Start |

Damit: **zwei Doerfer = ×4** (Al 17.9.), drei = ×8; spaetere Aenderungen des
Grundwerts ziehen automatisch nach, ein Aufstieg (`_signalHeroAtkReset`)
verwirft die Buchfuehrung und rechnet frisch. Die Karte gibt ihren Faktor nur
zurueck, solange ihr Name in `gs.areaZones` steht — `removeArea` streicht den
Eintrag VOR dem Austritts-Hook.

**Puzzle-Start:** Areas werden dort direkt in die Zone geschrieben, ein
Eintritts-Hook laeuft nie — `syncAlleAtkAuren()` holt jede Multiplikator-Aura
beim Start nach.

**Hintergrund:** „Rioting Village" hatte nur einen schwachen Schein mit
Funken; jetzt eine ganze Szene (Tier `opaque`): Nachthimmel mit Feuerschein,
Ruinen-Silhouetten in zwei Tiefen (eingestuerztes Dach, gebrochene Wand,
Brunnen, zerbrochener Zaun), fuenf flackernde Flammen, sieben Rauchfahnen,
26 Glutfunken.

## ★★ v1164 — NEUE KARTE „Petrifying Potion" + STATUS-KLICK-OPTION

**Karte (Potion):** „Choose any Hero and Stun it for 3 turns. Damage a Hero
Stunned by this effect would take becomes 0. You may heal a Hero Stunned by
this effect from this Stun at any time during your turn." Ziele sind Helden
BEIDER Seiten; die Schadensnull haengt wie bei „Petrifier" am gemeinsamen
Marker `_petrified` AM Stun-Objekt.

**★ Getrennt gefuehrter Stun (Als Regel 17.9.):** `addHeroStatus` ERSETZT ein
vorhandenes Status-Objekt — zwei Stuns nebeneinander kennt die Engine nicht.
Die Potion nimmt den vorgefundenen Stun deshalb in Verwahrung
(`stunned._ppFremd = { obj, seit }`) und stellt ihn beim Heilen mit seiner
Restdauer wieder her (eine Besitzer-Runde = zwei `gs.turn`). Geheilt wird also
nur der Potion-Stun.

**★ NEUER ALLGEMEINER MECHANISMUS — STATUS-KLICK-OPTION:**

| Baustein | Wirkung |
|---|---|
| `hero.statuses.<status>._klickHeilung = { card, by }` | macht den Helden fuer `by` anklickbar (auch auf der Gegenseite), solange dessen Zug laeuft und nichts anderes offen ist |
| Socket `status_click_option` | Server prueft Zug, Marke und Besitzer und ruft `script.onStatusClickOption(engine, pi, heroOwner, heroIdx)` |
| Client | Klick auf den Helden feuert das Ereignis; der Held traegt den Aktiv-Glanz wie ein Held mit offenem Effekt. Die Rueckfrage stellt die KARTE (Server-Prompt) |

Der Helden-Effekt-Weg schied aus: `doActivateHeroEffect` sperrt gestunnte
Helden ausdruecklich — hier ist der Stun gerade die Voraussetzung.

**Animation:** neue `stone_break` (Blitz, zwei Risse, 16 Brocken mit
Schwerkraft), Klang `heavy_impact` hoeher gestimmt.

## v1163 — Rest-Runden am Stun-Badge (Petrifier); Teleportal-Testschalter raus

* **Rest-Runden:** das Stun-Abzeichen trug keine Zahl — beim 3-Runden-Stun
  („Petrifier") sah man die Restdauer nirgends. Jetzt kommt sie wie beim
  Frost aus `restrundenFuer(statusKey, statusData)` (Status-Objekt beim
  Helden, `counters.<status>Duration` bei der Kreatur, Ablaufzug aus Buffs)
  — auch fuer die Medusa-Variante. Mitgezogen, weil dieselbe Luecke:
  **Nulled, Magic Silenced, Frightened, Bound/Silenced, Blinded**. Der
  Frost-Zweig benutzt jetzt denselben Helfer statt seines Vorlaeufers.
  Einrundige Status zeigen weiterhin keine Zahl.
* **Teleportal:** der temporaere Testschalter `TEST_ENDE_DIESES_ZUGES` ist
  entfernt; die Karte kommt wieder zu Beginn des naechsten eigenen Zuges auf
  die Hand.

## v1162 — Zwei Sitz-Fehler: Portal-Mitte und Ziel-Handplatz

* **★ LEHRE (CSS):** Prozent-Margins rechnen BEIDE gegen die BREITE des
  Elternteils. `margin-left/-top: -50%` ZUSAETZLICH zu
  `transform: translate(-50%, -50%)` verschiebt ein Teil um eine halbe
  Elternbreite nach links OBEN — der Portal-Wirbel sass deshalb auf der
  oberen linken Ecke der Karte. Zentriert wird nur noch per `transform`.
* **★ LEHRE (Flug zur Hand):** ohne `toHandIdx` (+ `finalHandSize`) faellt
  der Client auf den Handkasten zurueck und landet in dessen MITTE. Beide
  Zahlen gehoeren in jeden `play_pile_transfer` mit `to: 'hand'`; die Hand
  ist zentriert, der Zielpunkt haengt an der Endgroesse.

## ★ v1161 — „Teleportal": Flug aus der offenen Zone, Auftritt, Portal-Wirbel

* **Flug:** `play_pile_transfer` mit `from: 'permanent'`, `to: 'hand'` und
  `fromPermId` = Id des Permanent-Eintrags (`data-perm-id`). Ohne den
  Broadcast raet der Client die Herkunft aus dem Handzuwachs — die Karte
  startete in der GEGNER-Hand.
* **Auftritt:** `announceHookActivation` beim Abholen (Sas'Za-Muster), einmal
  je Zustellung.
* **Portal-Wirbel:** neue Animation `portal_warp` (dunkles Violett: Schlund,
  zwei Ringe, Kern, 18 Funken) auf der frisch offen gelegten Karte —
  `zoneType: 'permanent'` + `permId`, nach einem `sync()` plus kurzer Pause,
  damit ihr Kasten im Client schon steht. Klang: `elem_dark` → `reveal`.

## ★★ v1160 — „Teleportal": die offene Karte kam NIE zurueck; Testschalter fuers Timing

**★ LEHRE:** die offen abgelegte Karte ist eine Instanz MIT IHREM EIGENEN
NAMEN — ihr Skript ist das der gesuchten Karte, nicht das der suchenden.
Teleportals Rundenhaken lasen `ctx.card` (die TELEPORTAL-Instanz); die liegt
nach dem Guss in der Ablage, die `activeIn` gar nicht kannte. Der Haken lief
also nie, die Karte kam nie auf die Hand. Jetzt lauscht Teleportal aus Hand,
Ablage UND offener Zone und holt beim Rundenhaken alle faelligen eigenen
Eintraege ab (`zustellenAlleFaelligen`); mehrere Kopien stoeren sich nicht.

**★ TEMPORAERER TESTSCHALTER (Al 17.9.):** `TEST_ENDE_DIESES_ZUGES` am Kopf
von `teleportal.js`. `true` = Karte kommt am ENDE DIESES Zuges auf die Hand
(auch die Prompt-Beschreibung sagt das), `false` = Kartentext (Beginn des
naechsten eigenen Zuges). Zuruecknehmen heisst: eine Zeile auf `false`.

## ★★ v1159 — LEERE GALERIE: Eintraege statt roher Namen (`cardGallery`)

Al 17.9.: „Teleportal zeigt eine leere Galerie, obwohl das Deck Karten hat."

**★ VERTRAG:** `cardGallery` / `cardGalleryMulti` erwarten OBJEKTE
`{ name, source?, count?, selectable?, highlight? }` — Client, CPU-Heuristik
und MCTS-Verzweigung lesen alle `entry.name`. Teleportal (`cards:
[...ps.mainDeck]`) und **Cleansing of the Land** (`[...new Set(...)]`)
uebergaben rohe Namen; `CARDS_BY_NAME[undefined]` liess jeden Eintrag
ausfallen — die Galerie blieb leer.

**Zentral abgefangen:** `promptGeneric` normalisiert Zeichenketten jetzt zu
Eintraegen und fasst Doppelte zu `count` zusammen (`source` = `searchPile`
oder `'deck'`). Damit kann diese Falle keine Karte mehr treffen. Beide Karten
liefern das Format zusaetzlich selbst, dedupliziert wie „Magnetic Glove".

## v1158 — „The Stormblade" (Balancing, Al 17.9.)

Neuer Text: „**Once per turn**, when the equipped Hero performs an Action
**during your Action Phase** … You can only have **1** „The Stormblade"
equipped to your Heroes at a time." (`data/cards.json`, Kosten bleiben 6).

| Grenze | Umsetzung |
|---|---|
| einmal pro Runde | Einheitszaehler `_charges.js` (`usesLeft`/`spendUse`) an der INSTANZ, `max: 1` — bewusst ohne Ladungsanzeige; verbraucht wird erst, wenn der Zyklus wirklich lief (leere Hand loest nicht aus) |
| nur die eigene Action Phase | `gs.currentPhase === 3` UND `gs.activePlayer === Besitzer` |
| nur eine Klinge je Seite | `canEquipToHero` prueft ALLE eigenen Support-Zonen (Wanted Poster prueft nur den Zielhelden) |

Der Treffer-Effekt beim Gegner bleibt unbegrenzt und in jeder Phase. Die
Reaktions-Haelfte des Ausloesers (v1157) bleibt: eine Reaktion, die der Held
in der EIGENEN Action Phase wirkt, zaehlt weiter als Handlung — fuer Crescent
Moon ohnehin unveraendert.

## ★★★ v1157 — Reaktionen sind Handlungen des Wirkers; `onReactionResolved`

**Al 17.9.:** „performs an Action" reagiert auch auf Reactions (Stormblade,
Crescent Moon — und damit alle Karten mit diesem Wortlaut).

| Baustein | Wirkung |
|---|---|
| `engine._rxAufgeloest(ps, cardName, casterIdx, { spellHook })` | nach der Aufloesung JEDER Hand-Reaktion (alle 14 Fenster) und jeder Kettenreaktion mit Wirker: `afterSpellResolved` fuer Attack/Spell (sofern das Fenster ihn nicht selbst feuert) + neuer Hook `onReactionResolved` |
| `HOOKS.ON_REACTION_RESOLVED` = `'onReactionResolved'` | `{ playerIdx, heroIdx, cardName, playedCardName, actionType, isReaction: true }` |
| `_action-shared.js` → `handlungsHooks(fn)` | `{ onAnyActionResolved: fn, onReactionResolved: fn }` — „performs an Action" |

Umgestellt: **The Stormblade, Lunatic Cycle - Crescent Moon, Hat of Madness,
Bonded Companion Mellvy** (alle „performs an Action").

**★ `onAnyActionResolved` bleibt reaktionsfrei** — Flashbang („first Action"),
Bleed und die Aktions-Oekonomie haengen daran; fuer sie ist eine Reaktion
keine Aktion.

**Nebenbei geschlossen (Santa Klaus):** die Vor-Schadens- (Held/Kreatur, beide
Seiten), Vor-Niederlage-, Kreatur-besiegt-, Ressourcen-, Beschwoerungs-,
CD-Bewegungs- und gegnerische-Aktionsphasen-Fenster feuerten nie
`afterSpellResolved` — Santa zahlte dort nicht. Jetzt ueber `_rxAufgeloest`.
Diese Fenster markieren ihren Hand-Transfer deshalb mit `asPlay: true` statt
`'sole'`: der Trainings-Recorder zaehlt Attack/Spell ueber
`afterSpellResolved`, sonst doppelt.

**Kosten:** The Stormblade 10 → 6 Gold (`data/cards.json`).

## ★★ v1156 — „The Stormblade": neuer Text, jede Aktion loest aus, Auftritt

**Neuer Kartentext (Al 17.9.):** der eigene Effekt mischt „any number of cards
from your hand" statt der ganzen Hand — `handPick` in der eigenen Hand wie
Horn in a Bottle / Crescent Moon, Pflicht-Ausloeser mit `minSelect: 0`, nicht
abbrechbar. Der Treffer-Effekt beim Gegner bleibt die ganze Hand. `data/cards.json`
angepasst.

**★ LEHRE — „performs an Action" heisst `onAnyActionResolved`, nicht
`onActionUsed`.** `onActionUsed` ueberspringt inhaerente Zusatzaktionen (Quick
Attack) und Frei-Aktionen; `onAnyActionResolved` feuert in jedem Aktionspfad,
Heldeneffekte nur mit Aktionskosten (Als Ruling 4.8.). Crescent Moon, Hat of
Madness und Bonded Companion Mellvy hingen schon richtig; die Stormblade hing
am falschen Haken.

**Auftritt:** beide Effekte rufen `announceHookActivation` beim Ausloesen (vor
der nicht abbrechbaren Auswahl), bei leerer Hand weiterhin kein Ausloesen.

## ★★★ v1155 — WIRKER-PICKER fuer Hand-Reaktionen (Als Regel 17.9.)

„Koennen 2+ Heroes eine Reaction spielen, muss man eine Auswahl bekommen,
welcher legale Hero sie aktivieren soll!"

| Engine | Wirkung |
|---|---|
| `_rxCastKandidaten(ps, cardName, script, opts)` | alle castfaehigen Helden mit Wisdom-Kosten; `null` = kein Wirker noetig; `casterIsTarget` → nur der Zielheld |
| `_rxCastPlan(...)` | wie bisher der guenstigste Kandidat — nur noch fuer das GATE („ist die Reaktion ueberhaupt spielbar?") |
| `_rxCastWirkerWaehlen(ps, cardName, script, plan, opts)` | nach der Bestaetigung, VOR Entnahme und Zahlung: bei 2+ Kandidaten `optionPicker` mit Heldennamen (dieselbe Oberflaeche wie die Reaktionskette); Abbruch → `false`, die Reaktion findet nicht statt; setzt `plan.casterIdx`/`wisdomCost` |

**Angebunden an alle 14 Hand-Reaktionswege** (Vor-Schaden Held/Kreatur und
Gegenseite, Vor-Niederlage, Kreatur besiegt, Nach-Schaden Held/Kreatur,
Ressourcenphase, nach Beschwoerung, CD-Bewegung, gegnerische Action Phase,
Post-Target, Ascension). Die Reaktionskette hatte ihren Picker schon.

**CPU:** kein Prompt — bevorzugt einen Helden ohne eigenes `canPlayCard`
(Santa Klaus' Kartenpreis), dann die niedrigsten Wisdom-Kosten.

**Nach-Schaden (Held) auf die allgemeine Regel gezogen:** vorher durfte bei einem
ueberlebenden eigenen Helden NUR dieser wirken. Jetzt jeder castfaehige Held
(v619-Regel), mit Wisdom-Zahlung wie ueberall. **Fireshield** („a Hero you
control that can use it takes damage") traegt dafuer `casterIsTarget: true`.

## ★★★ v1154 — Enthauptung am richtigen Ziel; Hero-Kosten („Santa Klaus") in ALLEN Spielwegen

### Decapitating Strike

`sword_cleave` las seine Position nicht: `.sword-cleave` stand mit `left: 50%;
top: 50%` in der Mitte der Animationsebene — ungefaehr ueber dem eigenen
mittleren Helden, egal wen es traf. **LEHRE:** eine Zonen-Animation muss `x`/`y`
(und fuer ihre Groesse `w`/`h`) aus den Props lesen und `position: fixed` daran
ausrichten. Ersetzt durch `decapitation`: Klinge in Halshoehe mit Lichtbogen,
aufreissender Schnitt mit Treffer-Stopp, roter Bildschirm-Blitz, arterielle
Fontaene in drei Stoessen (80 Tropfen), 12 Blutflecken, 9 Rinnsale, Nebel —
1,7 s; Klang `ZONE_ANIM_SFX.decapitation` (slash → critical_strike →
heavy_impact). Die Niederlage folgt nach 700 ms. Kreaturziele laufen ueber die
physische Seite.

### Hero-Kosten fuer Attacks/Spells in Reaktionen und Surprises

Santa zahlte nie fuer Reaktionen. Drei Luecken, alle allgemein:

1. **`afterSpellResolved` feuerte in den Reaktionswegen nur fuer SPELLS**
   (Nach-Schaden Held/Kreatur, Post-Target, Ascension, Surprise, Kette). Der
   normale Spielweg feuert fuer Attacks UND Spells — jetzt alle Wege.
2. **Kein Wirker:** die Nach-Schadens-Wege meldeten `heroIdx: -1`, sobald nicht
   der ueberlebende eigene Held wirkte. Jetzt der Held aus
   `_rxHandCastingHero` (dieselbe Wahl wie in den uebrigen Reaktionswegen:
   der erste Held, der die Karte wirken kann) plus `heroOwner`.
3. **`canPlayCard` galt nur im normalen Spielweg.** `_canHeroActivateSurprise`
   prueft jetzt das `canPlayCard` des Helden und seiner Ausruestung, mit
   `herkunft.fromHand` = `opts.spellInHand`. `_anyHeroCanActivateSurprise`
   reicht die Optionen durch; der Gegenseiten-Pass der Nach-Schadens-Reaktion
   gibt `spellInHand: true` mit.

Attachment- und Area-Spells laufen ueber `doPlaySpell` und waren schon richtig
(getestet).

## v1153 — Klang zum Wahl-Blitz

Jeder `ziel_marke_blitz` spielt im Client einen kleinen Zielerfassungs-Klang
aus `ping`: leise beim Einblenden (rate 1.25), heller beim Einrasten des
Fadenkreuzes nach 420 ms (rate 1.9). Jede weitere Position der Kette klingt
einen Halbton hoeher (bis #13). Ohne Dedupe und ohne Kategorie, damit schnell
aufeinanderfolgende Wahlen nicht verschluckt werden.

## ★★ v1152 — ALLGEMEINE REGEL: Schadenszahlen SOFORT; Einrasten bei jeder Wahl

**Schadenszahlen (Al 17.9.: „IMMER sofort anzeigen").** Der Client leitet
Schadenszahlen aus HP-Differenzen zwischen zwei Spielstaenden ab. Weder
`actionDealDamage` noch `processCreatureDamageBatch` synchronisierten nach
dem Treffer — bei Mehrfachtreffern (Ricochet) kamen alle Zahlen gesammelt am
Ende, nur die per Ereignis gesendeten Nullen sofort. Jetzt sendet jeder
Treffer mit `actualAmount > 0` (ausser Simulation/Schnellmodus) einen
Spielstand:

* **Held:** nach `afterDamage` und den Pfeil-Ridern (Luna Kiai & Co. schicken
  dort eigene Popups samt Diff-Sperre, die vorher ankommen muessen), vor Tod
  und Handreaktionen;
* **Kreatur:** nach dem Elixir-of-Cold-Rider, vor Verursacher-Fenster und
  Todeszweig.

**Wahl-Blitz:** das Einrasten des Fadenkreuzes laeuft bei JEDER Wahl, auch bei
der eigenen; die Beschriftung lautet „YOUR #N", „OPPONENT'S #N" bzw.
„TARGET #N" fuer Zuschauer.

## ★★ v1151 — Zielmarken-Ebene: Pfad, deutlicher Gegner-Blitz, keine Beschneidung; Ricochet-CPU

**Ebene statt Abzeichen in der Zone.** Die Marke „#N" wurde oben von ihrer
Zone abgeschnitten. `ZielMarkenEbene` (app-board.jsx) liegt jetzt als feste
Ebene ueber dem Brett und misst die Bildschirm-Rechtecke der Zonen (bei jeder
Aenderung und alle 150 ms). Sie zeichnet:

* Abzeichen „#N" oben mittig am Ziel;
* den **vorhergesagten Zielpfad**: halbtransparente, laufend gestrichelte
  Linien #1 → #2 → #3 … je Quelle, mit Pfeilspitze vor der Zielzone;
* den **Wahl-Blitz**: `setzeZielMarke(ziel, label, quelle, waehler)` traegt
  jetzt den Waehler. Waehlte der GEGNER (oder man schaut zu), rastet ein
  grosses Fadenkreuz auf das Ziel ein, eine Schockwelle laeuft, die Zone
  blinkt dreimal rot und „OPPONENT'S #N" springt gross darueber (1,5 s).
  Die eigene Wahl blitzt nur kurz.

**Ricochet-CPU:** jede Wahl sendet `baseDamage` = Schaden an DIESER Position
(`schadenAnPosition`: ATK, halbiert und aufgerundet je Vorgaenger) und
`damageType: 'attack'`. Der Pilot zielt damit wie bei einem normalen
Einzelziel-Angriff (`pickEnemyTargets`: Zielwert, landender Schaden,
Kill-Bonus); bereits gewaehlte Ziele stehen nicht im Angebot. Nach einer
CPU-Wahl wartet Ricochet 1,1 s, damit der Blitz ablaufen kann.

## ★★ v1150 — „Ricochet": Zielwahl repariert; ZIELMARKEN als allgemeiner Mechanismus

**Bug:** `promptEffectTarget` liefert **IDs** (`'hero-1-0'`), keine
Zielobjekte. Ricochet behandelte die ID als Objekt — der Duplikat-Filter
bildete fuer jede Wahl denselben Schluessel und filterte nie etwas heraus
(Endlos-Auswahl bis zum 40er-Gurt), und im Schadensteil fehlten `type` und
`owner`, kein Treffer landete. **LEHRE:** Antworten von `promptEffectTarget`
immer ueber `targets.find(t => t.id === id)` auf das Zielobjekt zurueckfuehren.

**Zielmarken — fuer jede Karte mit einer Zielfolge:**

| Engine | Wirkung |
|---|---|
| `engine.setzeZielMarke(ziel, label, quelle)` | Marke in `gs.zielMarken` (Spielstand, beide Spieler + Zuschauer) + Ereignis `ziel_marke_blitz` |
| `engine.loescheZielMarken(quelle)` | alle Marken dieser Quelle weg |

Client: Abzeichen `.ziel-marke` („#1") oben mittig an Held bzw. Support-Zone,
beim Setzen ein roter Blitz `.ziel-marke-blitz` — das Live-Feedback, welches
Ziel der Gegner gerade gewaehlt hat. Waehlt die CPU, wartet Ricochet 650 ms,
damit der Blitz sichtbar ist. Die Marken bleiben stehen, bis die Kette
abgefeuert ist.

## v1149 — „Trunk Sand" als Sandstrahl (`projectileShape: 'sandStream'`)

Al 17.9.: „ein richtiger Strahl aus Sand, der auf das Ziel geschossen wird
(vgl. Sandwirbel aus Pokemon)". Die Wolke aus v1148 war zu klein.

`play_projectile_animation` mit `projectileShape: 'sandStream'` rendert statt
des Projektil-Wrappers die Komponente `SandStrahl`: 280 Koerner (1–3.5 px)
werden ueber 70 % der Dauer laufend vom Werfer abgeschossen, jedes fliegt
einzeln (240–390 ms) zum Ziel — eng an der Duese, am Ziel zum Kegel
gefaechert (Streuung Mittel ~12 px). Dazu 34 Schlieren entlang der
Flugrichtung und ein blasser Staubkanal. Letzte Bahn endet vor `dur + 200`
(Abbau des Projektils). Allgemein nutzbar fuer jeden Werfer mit
Start/Ziel aus dem Projektil-Ereignis.

Trunk Sand: Strahl 950 ms, Klang `elem_wind`; die Sanddusche (`sand_burst`)
startet nach 380 ms, wenn die ersten Koerner ankommen, der Schaden 300 ms
spaeter — beides unter dem noch fliessenden Strahl.

## v1148 — „Trunk Sand": echte Sanddusche

Al 17.9.: „deutlich mehr Particles, kleiner — eine wirkliche Sanddusche".

| Teil | vorher | jetzt |
|---|---|---|
| Projektil (`projectileShape: 'sand'`, `SAND_KOERNER`) | 22 Koerner, 3–9 px, Leuchtspur | 90 Koerner, 1–3 px, 4 Sandtoene; jedes dritte rieselt im Flug nach hinten unten ab (`.sand-streu`), Spur nur noch zarter Schleier |
| Einschlag (`sand_burst`) | 14 Koerner, 5–14 px, satte Scheibe | 110 Spruehkoerner (auseinander, dann Schwerkraft), 70 Duschkoerner von oben, flacher Staubdunst |

**Zeitbudget:** jede Bahn endet vor 950 ms — Zonen-Animationen werden nach
1000 ms abgebaut, auch beim zweiten Aufruf ueber `addHeroStatus`
(`animationType`). Wer die Dusche verlaengert, muss `duration` mitsenden.

## ★ v1147 — Sas'Za: Einheitszaehler und Auftritt; alle Waechter gruen

**Kein Regelfehler** (Al 17.9.: der Test lief mit Level-0-Creatures, die
0 Karten ziehen). Nachgezogen wurden zwei Luecken:

* **Einheitszaehler statt eigenem `hoptUsed`-Schluessel** — „Up to 3 times
  per turn" laeuft ueber `_charges.js` (`usesLeft` / `spendUse`) am
  HELDENOBJEKT, deklariert mit `chargesPerTurn: 3` + `chargeKey`. Damit
  zeigt der Client die verbleibenden Ziehungen am Heldenportrait (v417-Regel:
  EIN Zaehler fuer alle „up to X times per turn"-Effekte).
* **Auftritt bei BEIDEN Effekten** nach dem Muster von „Cute Meanie
  Melissa": `showTriggeredEffect` + `equip_flash` am Helden — beim Ziehen
  vor dem Zug, beim Rueckholen erst NACH dem Ja (v736).

Die Waechter `check-triggered-reveal` und `check-cost-discard` sind damit
wieder gruen: „Giant Exploding Skull" streamt seinen Auftritt beim
Ausloesen der Explosion; „Cats of the Pharaoh" wirft nichts als Kosten ab
und ist per `COST-DISCARD-CHANNEL: n/a` abgemeldet (der Waechter schlug auf
„discard pile" als Beschwoerungsherkunft an).

## ★★★ v1146 — Doppelte Stufensenkung durch Helden; „0" bei jeder Schadenspraevention; Armageddon-Animation

### ★ Helden-Stufensenker zaehlten ZWEIMAL

`_applyCardLevelReductions` hatte seit v1100 eine eigene Schleife ueber die
Helden — in der Annahme, Helden stuenden nicht in `cardInstances`. Sie stehen
dort (`init()` trackt sie in der Zone `hero`), die Instanzschleife rief ihr
`reduceCardLevel` also ein zweites Mal. Folgen: **Damus** senkte Armageddon
doppelt, sobald er selbst wirkte (2 Ifrits → Lv 3 − 4 = 0), **Thalia, the Fun
Fairy** senkte Support-Magic-Spells bei JEDEM Wirker doppelt. Die
Heldenschleife ist weg.

**Vertrag fuer Helden mit `reduceCardLevel`:** der eigene Platz steht in
`inst.heroIdx` / `inst.owner` (Instanz in der Zone `hero`), der WIRKER in
`heroIdx` (kann `undefined` sein — Anzeige ohne Wirker). Pro-Wirker-Senker
(Taio) vergleichen beide, handweite Senker (Damus, Thalia) lesen nur den
eigenen Platz.

### ★ ALLGEMEINE REGEL (Al 17.9.): verhinderter Schaden zeigt eine „0"

„Reduzierter Schaden soll als «0»-Schadenszahl angezeigt und nicht einfach
ausgeblendet werden — fuer jede Schadenspraevention, ohne den zugehoerigen
Effekt an sich zu negieren."

| Helfer | wann |
|---|---|
| `_flashHeroDamageZero(hero)` | Held: Schaden faellt weg |
| `_flashCreatureDamageZero(inst)` | Kreatur: Schaden faellt weg |

Neu nachgezogen: Kreaturen mit `_immuneCreature` (Quellen-Immunitaet wie
Ifrit gegen Armageddon, `protectsCreatureFromDamage` wie Damus, Cardinal,
Versteinerung, Schilde …), `creature_pre_damage_save`; Helden bei
Erst-Runden-Schild (beide Schadenswege), Charme-Immunitaet, Versteinerung und
negierender Vor-Schaden-Reaktion. Ein Eintrag zeigt seine „0" nur einmal
(`e._nullGezeigt`). **Nicht** gemeint: negierte Effekte („unaffected by all
cards and effects", Anti Magic Enchantment), Umleitungen.

### Armageddon-Animation und Brett-Ursprung

`play_zone_animation` mit `zoneType: 'board'` kennt jetzt einen optionalen
**Ursprung** `originOwner` + `originHeroIdx`; der Verteiler gibt die
Bildschirmmitte dieses Helden als `ox`/`oy` an die Komponente.
Typ `armageddon`: Glutkern am Wirker → Feuerball und Druckringe ueber das
ganze Brett → Flammen (nach Abstand verzoegert) → Feuerregen → Glut.
`power` = Schaden / 450 (0.1 … 1) steuert Groesse, Beben, Dauer
(1800 + 1400·power ms) und die Mengen (Flammen 14 → 50, Tropfen 13 → 52).
Klang: Sequenz in `ZONE_ANIM_SFX.armageddon`.

## ★★ v1145 — Wirker-Drop fuer alle Fluch-Anhaengsel; CPU heilt nie „Aged"

**Umgestellt (Al 17.9.):** Decisive Defeat, Curse, Berserk und Overheal Shock
tragen kein `attachmentHosts` mehr und rufen `pickAttachmentHost` mit
`ignoreDropHints: true` — gezogen wird auf den WIRKER, die Zielwahl oeffnet
`onPlay`. Curse spricht dieselbe Zielwahl-Sprache wie Aging: GRUEN =
qualifiziert (Zusatz-Aktion), im Zusatz-Modus die uebrigen AUSGEGRAUT.
`attachmentHosts` (28.8.) bleibt fuer Anlege-Karten ohne echte Zielwahl.

**CPU-Heilung (Als Regel):** HP-Heilung waehlt NIE einen Helden mit
Heilsperre. Gefragt wird `engine._heroHealBlocked` — dieselbe Stelle, an der
die Heilung verpufft; also „Aged" und jede kuenftige Heilsperre.

| Stelle in `_cpu.js` | Wirkung |
|---|---|
| `heroHealRoom(engine, t)` | fehlende HP, bei Sperre **0** („als staende er schon ueber Max-HP") |
| `pickHealTarget` / `pickHealTargetsMulti` | Lifeforce-Vorrang und HP-Zweig ohne gesperrte Helden; Reinigungszweig nur bei Reinigungstext mit ihnen |
| erzwungene Heilung ohne gutes Ziel | gesperrter Held nur, wenn nichts anderes bleibt |
| gelernter Ziel-Prior | wird verworfen, wenn er eine REINE HP-Heilung auf einen gesperrten Helden legt |
| `hasHealableOwnTarget` | gesperrte Helden zaehlen nicht als verletzt |

Heilungen, die AUCH Status entfernen („Cure", Text mit „negative status" /
„cleanse" / „remove … status"), duerfen den Aged-Helden weiter waehlen: das
Entfernen von „Aged" ist dort der Nutzen.

## ★★ v1144 — Anlege-Karten mit Zielwahl: Wirker ziehen, Ziele einfaerben

**Drop = Wirker, nicht Wirt.** `attachmentHosts` (28.8.) macht den Drop zum
EMPFAENGER — richtig fuer Karten ohne echte Zielwahl, falsch fuer „Forbidden
Curse of Aging": gezogen auf den eigenen Helden, der wirken sollte, wurde der
verflucht. Aging traegt den Vertrag nicht mehr; der Client hebt dann wie bei
jedem Spell die WIRKER hervor (`canHeroPlayCard`), und `onPlay` fragt nach dem
Ziel.

**Neue Optionen in `pickAttachmentHost` / `attachToHero`:**

| Option | Wirkung |
|---|---|
| `ignoreDropHints: true` | `gs._attachmentHeroIdx` / `_attachmentZoneSlot` werden ignoriert — immer Zielwahl |
| `heroDim(hero, hi, side, engine)` | Held bleibt SICHTBAR, aber ausgegraut (`t.ineligible`), nicht waehlbar; keine Auto-Wahl, solange gedimmte Helden zu zeigen sind |
| `heroAccent(hero, hi, side, engine)` | `t.accent` am Ziel, z.B. `'green'` |

**Ziel-Akzent im Client:** `t.accent === 'green'` → Klasse
`.potion-target-accent-green` (gruener Puls ueber `.potion-target-valid`) an
Held und Support-Zone. Allgemein nutzbar fuer jeden `promptEffectTarget`.

**Brett → Ablage immer mit Flug:** `sendBoardCardToDiscard` ist der Weg. Neu:
er fliegt zur Ablage des URSPRUENGLICHEN Besitzers (`fromOwner`/`toOwner`),
wenn die Karte auf der anderen Seite lag. Der Anhaengsel-Status-Helfer,
`cleanseAttachmentByKey` und `cleanseNegativeAttachments` nutzen ihn jetzt —
vorher nacktes `actionMoveCard` ohne Flug (dort landete `{ source }` zudem im
Parameter `toHeroIdx`).

## ★★★ v1143 — „Forbidden Curse of Aging": echter Status `aged`, Aktion wird wirklich bezahlt

**Warum v1140–v1142 nie einen Badge zeigten:** der Server schrieb
`heroAttachmentBadges` in das Objekt JEDES SPIELERS, der Client las es auf
oberster Ebene von `gameState` — dort stand immer `undefined`. Der ganze
Nebenkanal ist entfernt (Server, `anhaengsel`-Prop, `negativeStatusTooltip`).

### ★ Vertrag: ANHAENGSEL MIT STATUS — der Status ist der Schalter

| Baustein | wo | Wirkung |
|---|---|---|
| `attachmentStatus: '<n>'` | Kartenskript | Status gehoert zur Karte; Puzzle-Start legt ihn an |
| `engine._attachmentStatusHaelt(inst, script)` | `_hostAttachmentWith`, `_abilityNegatedOnHero` | Karten-Vertraege (`blocksHostHeal`, `blocksHostStatusRemoval`, `negatesHostAbilities`) wirken NUR, solange der Status liegt |
| `anhaengselStatusHooks(CARD, STATUS, { heilenWirftAb })` | `_attachment-shared.js` | Eintritt → Status an; Austritt der EIGENEN Karte → Status weg (zweite Kopie haelt ihn); `heilenWirftAb`: Status entfernt → alle Kopien in die Ablage des urspruenglichen Besitzers |
| `setzeAnhaengselStatus(engine, owner, hi, CARD, STATUS)` | `_attachment-shared.js` | legt den Status mit `_fromAttachment` an |

**★ LEHRE (Decisive Defeat, gleich mitgefixt):** im `onCardLeaveZone` ist
`ctx.card` die LAUSCHENDE Karte, die gehende steht in `ctx.leavingCard`
(manche Wege tragen nur `_onlyCard`). Der alte Hook von Decisive Defeat
pruefte das nicht — verliess irgendeine Karte irgendeine Zone, war die
Negierung weg.

**„its OTHER status effects":** `_heroStatusRemovalBlocked(pi, hi, statusName)`
nimmt den Status des Sperrers selbst aus. `cleanseHeroStatuses` bewertet die
Sperre als SCHNAPPSCHUSS zu Beginn — sonst hinge das Ergebnis eines Cure an
der Schluesselreihenfolge. `cleansableHeroEntries` filtert pro Schluessel und
fuehrt eine Anhaengsel-Negierung nur noch EINMAL (als `attach:`).

### ★ `gs._spellForcesActionConsume` bezahlt jetzt wirklich

Bisher drehte die Flagge nur `isInherentAction` um — das kostete allein in der
Action Phase vor der ersten Aktion etwas. Jetzt, in derselben Reihenfolge wie
ein gewoehnlicher Guss (Als Bestaetigung 17.9.):

| Lage | bezahlt |
|---|---|
| Action Phase, Grund-/Bonus-Aktion frei | Grund-Aktion (wie bisher, Sprung nach Main Phase 2) |
| Main Phase oder Aktion verbraucht, passender Geber da | der Geber (`consumeAdditionalAction`) |
| Main Phase 1 ohne Geber | `gs._pendingActionBurn` → `burnUpcomingAction` (Sprung nach Main Phase 2) |

Betrifft ausser Aging auch **Pawn Sacrifice** (schaltet in jeder Phase zurueck).
Curse, Board of Kings, Gate to the Armory und Temple of Sacrifice schalten nur
in der Action Phase vor der ersten Aktion zurueck und sind unveraendert.

`hasNormalActionAvailable`: **Main Phase 2 hat keine Grund-Aktion mehr** (war
`true`).

### ★ Schadens-Historie im Puzzle

`hero._jeGetroffen` fehlte jedem Puzzle-Helden. Editor-Schalter „⏳ Damage
History" (sichtbar, sobald eine Karte aus `SCHADENS_HISTORIE_KARTEN` im Puzzle
liegt); aeltere Puzzles ohne Angabe gelten als getroffen, wenn HP < max.

### ★ Badge-Zeile ohne Handliste

Vor `<StatusBadges>` stand in Brett und Puzzle-Editor eine zweite Liste aller
Status — genau die, an der v1142 scheiterte (Bleeding und Charmed standen nie
drin). Die Komponente liefert selbst `null`; die Listen sind weg. Helden zeigen
Immune/Shielded weiter nur ueber `ImmuneIcon`.

## ★★★ v1142 — DIE BADGE-ZEILE ENTSTAND GAR NICHT

Al 15.9.: „Badge ist nicht sichtbar, **vergleich das mit existierenden
Debuffs wie Poisoned!**"

★ Genau der Vergleich fuehrt hin. Die gesamte Badge-Zeile haengt an
einer langen Bedingung:

```jsx
{hero?.name && (isFrozen || isStunned || isBurned || isPoisoned || … ) && <StatusBadges …
```

Ein Held mit AUSSCHLIESSLICH einem Anhaengsel-Zustand („Aged") faellt
durch jede dieser Pruefungen. **Die Zeile wurde nie gezeichnet — und
meine beiden vorherigen Aenderungen an ihrem INHALT (v1140: Badge
gebaut; v1141: Badge aus dem falschen Zweig geholt) konnten deshalb gar
nichts bewirken.**

Drei Anlaeufe, drei verschiedene Stellen derselben Kette: erst der
Inhalt, dann der Zweig, jetzt die Existenz. Die Lehre ist dieselbe wie
beim Regler-Griff (v1138): **bevor man den Inhalt aendert, pruefen, ob
das Element ueberhaupt entsteht.**

## Zur Zusatz-Aktion: was nachgemessen ist

Al: „ich kann nach wie vor Curse immer als additional einsetzen …
Vielleicht macht der generelle Aufbau es somehow immer additional?"

Nachgemessen, Schicht fuer Schicht — alle vier stimmen:

| Schicht | Befund |
|---|---|
| `_jeGetroffen` nach echtem Schaden | gesetzt |
| `zielIstGratis` fuer dieses Ziel | false |
| `hasPayableActionFor` ohne freie Aktion | false → Zielliste eingeschraenkt |
| `_spellForcesActionConsume` | wird in `doPlaySpell` gelesen und bindet `isInherentAction` um |

**★ Was die Struktur trotzdem hergibt:** `inherentAction` entscheidet
VOR der Zielwahl und sagt ja, sobald IRGENDEIN Ziel taugt — so hat Al
es selbst vorgegeben. Hat der Spieler noch eine Aktion frei, ist die
Zielliste deshalb offen, und die Korrektur nach der Wahl kostet ihn die
Aktion. Hat er KEINE mehr, wird die Liste eingeschraenkt. Beides ist
getestet.

**Die drei neuen Logzeilen (v1141) zeigen ab jetzt, welcher Zweig lief** —
„cost … a normal Action" oder nicht.


## ★★★ v1141 — DREI FEHLER, DIE ALLE „NICHTS PASSIERT" AUSSAHEN

Al 15.9.: „Nichts davon hat funktioniert? … Hast du im letzten Zip
einfach nicht die geupdateten Dateien gezippt?"

**Die berechtigte Frage zuerst: doch, alles war im Paket.** Nachgeprueft,
Datei fuer Datei. Es waren drei getrennte echte Fehler — und jeder sah
von aussen aus wie „die Aenderung ist nicht angekommen".

### ① Der Badge lag im FALSCHEN ZWEIG

Mein v1140-Block stand INNERHALB von `if (s.negated || c.negated)` —
also nur fuer Helden, die ohnehin negiert sind. „Forbidden Curse of
Aging" negiert aber gar nichts am Helden, sie FRIERT nur. Der Badge
konnte nie erscheinen.

Anhaengsel-Badges haengen jetzt an KEINER Bedingung. Ein Testfall prueft
die Reihenfolge im Code, nicht nur die Existenz.

### ② Die Cleanse-Liste zeigte, was gar nicht entfernbar ist

`cleansableHeroEntries` fuehrte weiterhin `frozen`, `poisoned` & Co. auf,
obwohl „Aging" deren Entfernung sperrt (`blocksHostStatusRemoval`) und
`removeHeroStatus` sie ohnehin ablehnt.

**Damit schrumpfte die Liste nie auf EINEN Eintrag — und die Abkuerzung
aus v1140 griff nie.** Zwei Fehler, die einander verdeckten: die
Abkuerzung war richtig gebaut, bekam aber nie die Lage, fuer die sie
gedacht war.

Jetzt filtert die Liste, was der Motor ohnehin verweigert. Die Karte
selbst bleibt drin — sie ist ja das, was man loswerden kann.

### ③ Die Entscheidung war UNSICHTBAR

`curse_of_aging_no_free_action` wurde protokolliert, aber **niemand
zeichnete die Zeile**. Fuer den Spieler war nicht erkennbar, ob die
Zusatz-Aktion greift oder nicht — „kostenlos" und „hat eine Aktion
gekostet" sahen identisch aus.

**★ Ein Logeintrag ohne Darstellung ist so gut wie kein Logeintrag.**
Drei Zeilen haben jetzt eine: die Verfluchung, der Aktionsverbrauch und
die automatische Statuswahl.


## ★★ v1140 — Der Schadens-Merker gehoert an die EINE Zaehlstelle

Al 15.9.: „Selbst, wenn ich einem Hero via Book of Doom Schaden zufuege,
ist dieser danach noch immer als additional verfluchbar!"

**★ In v1139 sass `_jeGetroffen` an ZWEI einzelnen Schadenszeilen** —
also wieder das Muster, das in dieser Sitzung schon vier Mal zugeschlagen
hat (acht Flugwege, zwei Galerie-Wege, zwei Todespfade, zwei
Landezeitpunkte). Jetzt sitzt er in **`_noteDamageTaken`**, der EINEN
Stelle, die jeder Schadensweg ohnehin durchlaeuft — dieselbe, an der
auch `_damagedOnTurn` fuer „Medusa's Curse" entsteht. Wer kuenftig einen
Schadensweg baut, bekommt die Historie geschenkt.

Ein Testfall prueft, dass es **genau eine** Setzstelle gibt und dass sie
dort liegt.

## ★ „Aged" bekommt einen Badge — und zwar generisch

Al: „«Aged» braucht einen Status-Badge!"

Die Karte setzt KEINEN Status; sie wirkt als Anhaengsel. Der Badge liest
deshalb das BRETT: der Server meldet je Held die Anhaengsel mit
`countsAsNegativeStatus` (`heroAttachmentBadges`), der Client zeichnet
sie. **Das gilt damit fuer JEDES kuenftige Anhaengsel dieser Art**, nicht
nur fuer „Aging" — „Decisive Defeat" bekommt seinen Badge gratis dazu.

Neu am Kartenvertrag: `negativeStatusTooltip` fuer den Erklaertext.

## ★★ NUR EINE WAHL? DANN NICHT FRAGEN

Al: „Status-Cleanser wie Juice sollten gar nicht erst eine
Statusauswahl ANZEIGEN, wenn sie ein Aged-Ziel anvisieren; dann kann nur
Aged entfernt werden, also wird das automatisch ausgewaehlt."

Zentral in `promptGeneric`: ein `statusSelect` mit **genau einem**
Eintrag wird ohne Rueckfrage beantwortet. **Die Regel ist allgemeiner
als ihr Anlass** — eine Auswahl mit einem Eintrag ist keine Auswahl, sie
kostet nur einen Klick und suggeriert eine Entscheidung, die es nicht
gibt. Bei „Aging" entsteht der Fall zwangslaeufig: die Karte friert alle
ANDEREN Status ein, also bleibt nur sie selbst uebrig.

Alle acht Karten mit `statusSelect` profitieren davon.


## ★★ v1139 — „Forbidden Curse of Aging": ZWEI Zielbedingungen

```
… If the target has any "Charme" Abilities attached to it or has not
taken any damage yet this game, this counts as an additional Action.
```

**★ DIE DECAY-3-KLAUSEL IST ERSATZLOS GESTRICHEN.** An ihre Stelle
treten zwei unabhaengige Bedingungen — und beide haengen jetzt am ZIEL,
nicht mehr am Wirker. Das ist der eigentliche Unterschied: vorher konnte
der eigene Held die Karte bedingungslos gratis machen, jetzt entscheidet
allein, wen man trifft.

**Neu: `hero._jeGetroffen`** — eine Schadens-HISTORIE je Held, gesetzt
an BEIDEN Schadenswegen (die Lehre aus v1136 gleich angewandt) und **nie
zurueckgesetzt**: „yet this game" meint die Partie, nicht die Runde.
Null Schaden zaehlt nicht.

**Als Regel fuer die Zielliste, woertlich umgesetzt:** angeboten, solange
EIN Ziel eine der Bedingungen erfuellen kann; ohne verfuegbare
Rueckfall-Aktion auf die tauglichen Ziele beschraenkt; sonst offen fuer
jedes Ziel, verbraucht dann aber die naechste Aktion
(`zaehltAlsZusatzAktion` schaltet nach der Wahl zurueck).

**★ DER PRUEFSTAND MUSSTE UMGESTELLT WERDEN, und zwar aus einem
lehrreichen Grund:** frische Testhelden haben NIE Schaden genommen —
sie erfuellen die neue Bedingung also alle. Sieben Faelle wurden dadurch
gruen, die „keine Bedingung erfuellt" pruefen wollten. Die Grundlage
markiert ihre Helden jetzt als getroffen; `unversehrt(E, pi, hi)` dreht
das fuer einzelne zurueck.

Drei weitere Faelle prueften die gestrichene Decay-3-Klausel — sie sind
umgedreht und dokumentieren jetzt, dass sie NICHT mehr gilt.


## ★ v1138 — „Festive Werz": Geschenkflug, fliessende Anzeige, groesserer Griff

Al 15.9.: „Bunte Geschenke, die von der eigenen Goldanzeige zur
gegnerischen fliegen, waehrend das Gold nicht in einem Schritt, sondern
als fliessende Anzeige reduziert/erhoeht wird." Und: „der dragbare Teil
des Sliders ist etwas klein … vor allem auf Mobile."

**★ DIE FLIESSENDE ANZEIGE GAB ES SCHON.** `play_gold_crash` zaehlt die
Goldanzeigen weich von einem Stand zum anderen (gebaut fuer Market
Crash und Loan Shredder) und nimmt mit `to` ein ZIEL je Spieler — genau
das, was hier gebraucht wird: einer runter, einer rauf. Nachgebaut haette
ich einen zweiten Mechanismus fuer dieselbe Sache.

**Neu ist nur der Flug**: `gold_gift_flight`, gezeichnet als bunte
Paeckchen mit Band, im Bogen statt schnurgerade. **Die Anker sind
dieselben wie beim Gold-Diebstahl** (`[data-gold-player]`) — kein neuer
Aufhaenger, keine neue Fehlerquelle. Die Anzahl richtet sich nach dem
Betrag, gedeckelt auf 8: 20 Gold sollen nicht 20 Paeckchen bedeuten.

**★ Beides laeuft VOR der Buchung** und gleich lang. Sonst zaehlte die
Anzeige von einem Stand herunter, den es im Zustand schon nicht mehr
gibt — ein Testfall prueft die Reihenfolge.

## ★★ Der Reglergriff — und eine Falle beim Stylen

Der Griff ist jetzt 30 px statt der Browser-Vorgabe von etwa 12; unter
~24 px ist auf einem Telefon kaum etwas zu treffen. Gesetzt fuer
`::-webkit-slider-thumb` UND `::-moz-range-thumb`, sonst bleibt Firefox
beim Kleinen.

**★ DAS CSS HAETTE INS LEERE GEGRIFFEN:** der Regler trug gar keine
Klasse. Ein Testfall prueft deshalb ausdruecklich, dass
`className="effect-slider"` gesetzt ist — Stil ohne Aufhaenger ist
stiller Stillstand, und im Browser sieht man nur „hat sich nichts
geaendert".


## ★★★ v1137 — „Festive Werz" tat NICHTS: `optionId` statt `id`

Al 15.9.: „Der komplette Effekt funktioniert aktuell schlicht nicht.
Egal, wie viel Gold ich angebe zahlen zu wollen, ich zahle keines und
ziehe nichts!"

**Der Client antwortet auf einen `optionPicker` mit `{ optionId }` — die
Karte las `wahl?.id`.** Das war IMMER `undefined`, `kosten` damit 0, und
die Karte stieg eine Zeile spaeter kommentarlos aus. Kein Fehler, kein
Log, gar nichts.

Gelesen wird jetzt `wahl?.optionId ?? wahl?.id` — die alte Form bleibt
verstanden, falls irgendwo noch eine Antwort so gebaut wird. Ein
Testfall prueft BEIDE Formen.

**★ „Brainstorming" hatte denselben Fehler** (von mir, heute frueh
gebaut) und ist mitgefixt, bevor er auffallen konnte. Wer einen
`optionPicker` auswertet, liest `optionId`.

## ★ Der Regler bekommt Schrittweiten (v1137)

Al: „ein Slider mit Fuenferschritten statt individueller Buttons. Slider
von 0 bis min(eigenes Gold, 20), wobei nur Fuenferschritte moeglich
sind."

**Den Regler gab es schon** (`renderAs: 'slider'`, gebaut fuer Logans
Invest Counters) — nur lief er immer in Einerschritten. Neu:
`sliderStep`.

**★ Die Schrittweite wird AUCH beim Klemmen angewandt, nicht nur am
Regler.** Neben dem Schieber steht ein Zahlenfeld; ohne das Runden im
Klemmen haette man dort 17 eintippen koennen und der Betrag waere
ungueltig gewesen. Der Hoechstwert selbst bleibt erreichbar, auch wenn
er kein volles Vielfaches ist.

„Festive Werz" nutzt ihn mit `sliderMin: 0`, `sliderStep: 5` und
`sliderMax: min(eigenes Gold, 20)`. **Die Optionsliste bleibt daneben
bestehen** — sie ist der ordinale Lernkanal (FORM 3), und ihre
Beschriftungen tragen die Zahlenreihe.


## ★★★ v1136 — DIE ZWEI TODESPFADE LANDEN ZU VERSCHIEDENEN ZEITPUNKTEN

Al 15.9., und die Differenzierung ist seine: „Hell Fox erscheint im
Deleted-Pile ERST, NACHDEM sein Search durchgefuehrt wurde. Ebenso
erscheint auch der Skull erst danach im Discard! … Die Differenzierung
ist NICHT Giant Exploding Skull — sondern **«Hell Fox stirbt per
NICHT-Schaden»**! Auch Yeeting loest das aus. Vielleicht ist da ein Pfad
inkorrekt?"

**Ja — und es ist die Reihenfolge:**

| Todespfad | Reihenfolge |
|---|---|
| Schadens-Batch | Karte **landet im Stapel**, dann laufen die Todes-Hooks |
| `actionMoveCard` (jeder NICHT-Schadens-Tod) | Hooks laufen, **dann** landet die Karte |

Bei einer Karte, deren Hook Sekunden blockiert — „Hell Fox" oeffnet eine
Galerie —, haengt der Stapel deshalb sichtbar hinterher. **Und mit ihm
ALLES, was in derselben Kette noch auf seine Landung wartet**: der
Skull, dessen Explosion die Kette gestartet hat, landet erst, wenn der
Fuchs fertig ist.

Der Kadaver landet jetzt in beiden Pfaden **vor** den Hooks, mit einem
`sync()` unmittelbar danach, damit der Stapel sofort waechst. Ein
Stempel (`_ppSchonGelandet`) verhindert, dass er spaeter ein zweites Mal
abgelegt wird; ein Testfall prueft beides — waehrend des Hooks schon da,
danach genau EINE Kopie.

**★ WARUM ALS BEOBACHTUNG DEN AUSSCHLAG GAB:** „nicht Skull, sondern
Nicht-Schaden, auch Yeeting" verschiebt die Frage von einer KARTE auf
einen PFAD. Danach war es eine Minute Arbeit, die beiden Pfade
nebeneinanderzulegen. Meine eigenen Versuche zuvor suchten immer im
Client, weil der Server-Zustand ja „korrekt" war — er war nur zu spaet.


## ★★ v1135 — ZWEI BEFUNDE AUS ALS ABLAUFBESCHREIBUNG

Al 15.9., der genaue Ablauf: „Skull detoniert, geht waehrend seiner
Animation zum Discard, Schaden passiert, Hell Fox stirbt, **Skull
erscheint wieder in der Support Zone**, Fox bewegt sich zum Discard und
oeffnet seine Gallery, **Fox UND Skull verschwinden** aus ihren Support
Zones."

### ① Der Schadens-Batch kannte `deletesSelfOnDeath` nicht

Al: „Hell Fox fliegt jetzt visuell vom Board zum Discard, ehe es im
Deleted Pile landet. Das ist falsch."

**★ ES GIBT ZWEI TODESPFADE** — `actionDestroyCard` und den
Schadens-Batch. Ich hatte in v1134 nur den ersten umgestellt; der zweite
routet Ziel UND Flug voellig eigenstaendig. Beide lesen die Flagge
jetzt. **Derselbe Fehler wie bei den acht Flugwegen (v1133): eine
Absicherung an EINER Stelle ist keine Absicherung.**

### ② „BEIDE Karten kommen zurueck und gehen gemeinsam wieder"

Das passt zu keinem Einzelfehler — aber genau zu einem **ZUSTAND, der zu
spaet ankommt** und einen neueren ueberschreibt. Der alte Zustand WAR
korrekt, als er gebaut wurde; erst seine Reihenfolge beim Eintreffen
macht ihn falsch. **Deshalb konnte die Server-Diagnose ihn nie zeigen.**

Neu: **`stateSeq`**, eine laufende Nummer je Raum an jedem Zustand. Der
Client verwirft einen Zustand mit kleinerer Nummer als der zuletzt
angewandte (`window.ppZustandVeraltet`, in allen drei Oberflaechen —
Spiel, Puzzle, Kampagne). Ohne Nummer gilt wie bisher: annehmen.

Mit `?watch=alle` meldet der Client jeden verworfenen Zustand:

```
[ZUSTAND] veraltet verworfen: #412 (aktuell #418)
```

**★ Kommt diese Zeile beim Glitch, ist die Ursache bewiesen** — und
zugleich behoben. Kommt sie NICHT, war auch diese Erklaerung falsch,
und der naechste Verdacht ist die Flug-Ebene.


## ★★★ v1134 — GEFUNDEN: „Hell Fox" flog ZWEIMAL

Als Protokoll vom 15.9. zeigt es woertlich:

```
22:17:43.275 [FLUG] Hell Fox Start    — verstrichen  2 ms
22:17:43.301 [FLUG] Hell Fox Start    — verstrichen 28 ms   ← ZWEITER Flug
22:17:43.330 [FLUG] Hell Fox NEUSTART — verstrichen 57 ms
```

Zwei „Start"-Zeilen fuer dieselbe Karte, 26 ms auseinander — und im
Vergleichslauf ohne „Hell Fox" **keine einzige** Flugzeile. Damit ist
der Ausloeser eindeutig.

**★ DIE URSACHE: ZWEI BEWEGUNGEN STATT EINER.** Der Text sagt „delete
it" — die Karte landete aber ERST in der Ablage (Flug 1) und wurde DANN
ins Geloeschte umgebucht. Diese zweite Bewegung hat keinen eigenen
Flug-Broadcast, also bemerkte der **Diff-Animator** die schrumpfende
Ablage und den wachsenden Geloescht-Stapel und zeichnete selbst einen
Flug — mit einem Startpunkt, den er sich sucht. Das ist die Karte, die
im Brettbereich auftaucht.

Die Zonensonde war dabei die ganze Zeit sauber (`Zustand= []`,
`imDOM= Support`) und meldete nie eine RUECKKEHR — der Zustand war nie
falsch. Es war immer nur ein zweites, ueberfluessiges Bild.

**Die Loesung: EINE Bewegung.**

```js
deletesSelfOnDeath: true      // am Kartenskript
```

Der Motor liest die Flagge schon beim **Vorab-Flug** und schickt die
Karte gleich zum Geloescht-Stapel. Der `onCardLeaveZone`-Hook setzt
zusaetzlich `_redirectToDeleted`, damit auch der Zustand in einem Zug
stimmt; der alte Umbuch-Code bleibt als Rueckfall, falls ein anderer
Effekt dazwischenfunkt.

**★ WARUM DIE FLAGGE UND NICHT NUR DER HOOK:** `actionDestroyCard`
broadcastet den Vorab-Flug, BEVOR `onCardLeaveZone` laufen kann. Eine
Karte, die sich selbst loescht, muss das also VORHER sagen — sonst
fliegt sie sichtbar zur Ablage und wird gleich darauf weitergereicht.

**„Cute Hydra" hat dasselbe Muster** und ist mitgezogen.

**★ LEHRE: eine Karte, die ihren Kadaver umbucht, erzeugt IMMER ein
zweites Bild.** Wer „delete it", „shuffle it back" oder „return it"
nach dem Tod umsetzt, macht daraus EINE Bewegung — oder er sieht sie
zweimal fliegen.


## ★★ v1133 — ACHT FLUGWEGE, EINER ABGESICHERT

Als Lauf 15.9. brachte zwei Befunde:

**① Bis zum Ende des Ausschnitts ist alles sauber.** Beide Plaetze
melden `Zustand= [] | imDOM= Support | _dying= 1` — Zustand UND DOM sind
leer. Der Glitch passiert danach; die Aufzeichnung endet davor.

**② ★ DER SKULL TAUCHT IM FLUG-PROTOKOLL GAR NICHT AUF.** Fuer „Hell
Fox" kam `[FLUG] Hell Fox Start`, fuer den Skull KEINE Zeile. Er ist
also nie ueber die instrumentierte Bahn geflogen.

**Der Grund: `launchFlight` ist nur EINER von ACHT Wegen**, auf denen
ein Flug entsteht. Die uebrigen sieben reihen direkt in `discardAnims`
ein — und trugen keine Startzeit. Damit greift der Schutz gegen einen
Animations-Neustart (v1131) dort **gar nicht**, und die Sonde sah sie
auch nicht.

Alle acht tragen jetzt `t0` (ueber den Helfer `ppJetzt()`).

**★ LEHRE: eine Absicherung an EINER Einstiegsstelle ist keine
Absicherung.** Ich hatte `launchFlight` gefunden, fuer den einzigen Weg
gehalten und nicht nachgezaehlt — derselbe Fehler wie beim
Galerie-Scan (v1120), wo ich die Karten-Dateien durchsuchte und den
Kontext-Helfer uebersah.

## ★ RUECKKEHR-Erkennung in der Zonensonde

War ein Platz schon einmal leer und mit `_dying` markiert, und steht
jetzt wieder eine Karte darin, meldet die Sonde das rot hinterlegt als
`★★ RUECKKEHR` — samt Zustand, DOM-Inhalt, Zaehlern und offener Abfrage.
So geht der entscheidende Moment nicht mehr zwischen zwanzig aehnlichen
Zeilen unter.

**Browser-Sonden aktivieren:** `?watch=alle` an die Adresse haengen
(v1132). Sie sind BROWSER-Schalter, keine Server-Variablen — das hatte
ich beim ersten Mal nicht dazugesagt, und Al setzte sie folgerichtig
falsch.


## ★★★ v1131 — DER FLUG DARF NICHT VON VORN BEGINNEN

Al 15.9.: der Glitch bleibt, **und im Browser kam KEINE `[ZONE]`-Zeile**
— obwohl die Karte sichtbar war.

**★ DAS IST DIE ENTSCHEIDENDE AUSKUNFT.** Die Sonde sitzt in der
Renderstelle fuer Support-Karten. Kein Output bei sichtbarer Karte
heisst: **die Karte wird dort gar nicht gezeichnet.** Sie kommt aus der
FLUG-Ebene.

Und dort steht die Erklaerung im Code selbst: die Keyframes von
`.discard-anim-card` starten am BRETTPLATZ der Karte
(`left: startX; top: startY`). Wird die Animation **neu gestartet** —
weil React den Knoten neu einhaengt, etwa wenn „Hell Fox" mitten im Flug
seine Galerie oeffnet und den Teilbaum austauscht —, springt die Karte
sichtbar an ihren Ausgangspunkt zurueck. Genau das sieht man.

**Das erklaert ALLE Beobachtungen auf einmal:**

| Beobachtung | Erklaerung |
|---|---|
| nur wenn „Hell Fox" das erste Opfer ist | nur dessen Galerie oeffnet mitten im Flug |
| andere Kreatur-Effekte harmlos | keine Abfrage, kein Neu-Einhaengen |
| der gegnerische Skull harmlos | die Galerie gehoert dem anderen Client |
| Server durchgehend sauber | es war nie der Zustand |
| keine `[ZONE]`-Zeile | es ist nicht die Zonen-Renderstelle |

**Die Loesung: ein NEGATIVER `animation-delay`** in Hoehe der bereits
verstrichenen Flugzeit. Eine neu gestartete Animation setzt damit dort
fort, wo sie war, statt von vorn zu beginnen. Beim ersten Bild ist die
verstrichene Zeit ~0 — es aendert sich also nichts; **nur der Neustart
wird unsichtbar**.

Der Flug traegt dafuer seine Startzeit (`t0`) mit sich.

**★ Das gilt fuer JEDEN Flug, nicht nur fuer den Skull.** Jede Karte,
die fliegt, waehrend irgendetwas den Baum neu einhaengt, sprang bisher
an ihren Startpunkt zurueck — nur faellt es selten so deutlich auf wie
bei einer Kreatur, die dadurch scheinbar von den Toten zurueckkehrt.

**Sonden zum Nachmessen:** `window.PP_FLIGHT_WATCH = true` meldet jeden
erkannten Neustart mit verstrichener Zeit. `window.PP_ZONE_WATCH = true`
meldet sich jetzt beim ersten Durchlauf mit „Sonde aktiv", damit „kein
Output" eindeutig bleibt.


## ★★ v1129/v1130 — DER SKULL-GLITCH: was gesichert ist

Al hat den Ausloeser praezise eingegrenzt (15.9.): **nicht** Skull gegen
Skull, sondern **„Hell Fox" als erstes Opfer** — sobald dessen Suche
aufloest, blitzt der Skull in seiner Zone wieder auf.

**★ WAS DIE DIAGNOSE AUSSCHLIESST.** Jede Zeile des Laufs meldet
`Zone=[] getrackt=true dying=1 zaehlerGesendet=true` — auch die des
Skulls selbst. Der Server schickt die Karte also zu KEINEM Zeitpunkt in
ihrer Zone, und die Abschirmung liegt an. Damit sind raus: Zonen-Array,
`creatureCounters`, `supportStacks`, der Zaehler-Filter.

**★ WARUM DIE SKULLS IM ERSTEN LAUF FEHLTEN (v1129).** Die Diagnose
hatte EINEN Platz; ein Tod waehrend eines Todes ueberschrieb ihn — also
genau der Fall, den die Explosion erzeugt. Im Log fehlten fuer beide
Skulls die `sync`-Zeilen, und die 4171 ms der Explosion standen
faelschlich bei „Hell Fox". Jetzt ein STAPEL: jeder `sync` meldet an ALLE
offenen Fenster, eingerueckt nach Tiefe und mit Kartenname je Zeile.

**★ CLIENT-SONDE (v1130).** Weil der Fehler nur noch im Client liegen
kann, meldet die Renderstelle auf Wunsch jeden Fall, in dem ein Platz
eine Karte zeichnet:

```js
window.PP_ZONE_WATCH = true      // Browser-Konsole
[ZONE] 0-0-2 ["Giant Exploding Skull"] | _dying= - | Zaehler= KEINE | Abfrage= Hell Fox
```

Die vier Angaben beantworten die offene Frage: steht die Karte im
Client-Zustand (dann kam ein alter Zustand durch), fehlt die
Abschirmung (dann ist der Zaehler verlorengegangen), und lief gerade
eine Abfrage (Hell Fox' Galerie).

**★ ZWEI FALSCHE FIXES ZUVOR, beide dokumentiert** (v1126: `inst.zone`
vorgezogen — zerstoerte die Abschirmung; v1127: zurueckgenommen). Die
Lehre daraus steht bei v1127: **im Todes-Hook `inst.zone` nicht
anfassen**, die Abschirmung laeuft ueber `_dying`.


## ★★★ v1127 — MEIN v1126-FIX WAR FALSCH UND HAT GESCHADET

Al: „Das hat den Bug NICHT gefixt, der Skull erscheint noch immer
zurueck in seiner Zone!"

**Er hat ihn nicht nur nicht gefixt — er hat die vorhandene Abschirmung
ZERSTOERT.** Ich hatte `inst.zone = 'discard'` vorgezogen, um den
Zwischenstand „ehrlich" zu machen. Der Server baut `creatureCounters`
aber so:

```js
for (const inst of room.engine.cardInstances) {
  if (inst.zone !== 'support') continue;      // ← genau hier
```

Eine Instanz ausserhalb von `support` liefert also **gar keine Zaehler**
— auch nicht die Marke `_dying`, an der der Client seit v898 erkennt,
dass er den Platz leer zeichnen soll. Mein Eingriff nahm der Karte
damit genau den Schutz, den sie brauchte.

**★ LEHRE: `inst.zone` waehrend der Todes-Hooks NICHT anfassen.** Der
Motor haelt die Instanz absichtlich auf `support` — die Hooks lesen dort
ihre Zone, und der Zaehler-Transport haengt daran. Die Abschirmung
laeuft ueber `_dying`, nicht ueber die Zone. Zwei Testfaelle halten das
jetzt als INVARIANTE fest (vorher prueften sie meine falsche Annahme).

**★ WAS DIE EINGEBAUTE DIAGNOSE ZEIGT** (`PP_DEATH_WATCH=1`, v899/v900):
waehrend des Fensters steht `inst.zone === 'support'`, das Zonen-Array
ist `[]`, und `_dying = 1` ist gesetzt. Der Server SCHICKT die Marke
also, und der Client hat genau EINE Renderstelle fuer Support-Karten
— die sie prueft. Damit sind ausgeschlossen: Zonen-Array,
`supportStacks` (greift erst ab Stapelhoehe 2), Zaehler-Filter und ein
zweiter Renderpfad.

**Der Fall bleibt offen** — es ist derselbe, den v899 schon nicht loesen
konnte („Die Marke allein hat das Aufblitzen NICHT behoben — die Ursache
liegt also woanders"). Neu ist nur, dass er seit v1125 haeufiger
auftritt: die Detonation haelt das Todes-Fenster jetzt eine halbe
Sekunde offen, waehrend es vorher Bruchteile einer Millisekunde dauerte.

## ★ Klang der Detonation (v1127)

Drei Lagen, weil die Detonation drei Momente hat: `heavy_impact` tief
und sofort (der Knall), ein zweiter, noch tiefer gestimmter bei 90 ms
(die Druckwelle, im Bild der Schockring), und `elem_fire` bei 260 ms
fuer die nachbrennende Glut. Die spaeteren ohne Kategorie, sonst
schluckt sie die erste Lage; eigenes Dedupe, damit eine Kette aus zwei
Skulls nicht sechsfach knallt.


## ★★ v1126 — DAS TODES-FENSTER: „die Zone ist leer, die Marke sagt support"

Al 15.9.: „Wenn mein Giant Exploding Skull einen gegnerischen hochjagt,
wird dieser, nachdem er schon visuell zum Discard geflogen ist, noch mal
in seiner Support Zone sichtbar."

**★ DER GRUND STEHT IM MOTOR SELBST.** `actionDestroyCard` feuert den
Todes-Hook „between splice and zone-update" — also in einem Fenster, in
dem **die Support Zone bereits leer, die Instanz aber noch als
`'support'` markiert** ist.

**Alles, was in diesem Fenster einen Zustand veroeffentlicht, zeigt die
Karte noch einmal an ihrem alten Platz.** Bei „Giant Exploding Skull"
sind das gleich drei Anlaesse: die eigene Explosion mit ihrer Wartezeit,
jede Folge-Zerstoerung und der abschliessende `sync()`.

**Die Loesung: die Marke sofort auf ihren Endstand setzen.** Der
Zerstoerungspfad tut das eine Zeile spaeter ohnehin — wir ziehen es nur
vor, damit kein Zwischenstand mehr luegt. Der Zonen-PLATZ wird vorher
gemerkt, sonst zeigte die Explosion auf eine Zone, die die Karte nicht
mehr kennt.

**★ WER IM TODES-HOOK WARTET ODER SYNCT, muss das beachten.** Das gilt
fuer jede kuenftige Karte mit einem Todes-Effekt, der etwas Sichtbares
tut — ein Testfall prueft, dass waehrend der ganzen Explosion nie mehr
`'support'` gemeldet wird.

## ★ Die Detonation aufgedreht (v1126)

Al: „Die Explosion ist noch zu schwach/unbeeindruckend, da geht mehr."

Aufgedreht an FUENF Stellen statt nur an der Groesse — eine blosse
Vergroesserung haette sie duenn wirken lassen:

| | vorher | jetzt |
|---|---|---|
| Splitter | 34 | **70** |
| Druckringe | 3 | **5** |
| Reichweite | 3,2 Zonen | **5,0 Zonen** |
| Glutstuecke | — | **14, gluehen nach und fallen** |
| Schockwelle | — | **Verzerrung ueber das ganze Brett** |

**★ Die beiden NEUEN Teile tragen den Unterschied.** Reine Funken wirken
wie ein Feuerwerk; es sind die traegen, nachgluehenden Glutstuecke und
die kurze Verzerrung, die aus „ein Effekt lief" ein „da ist etwas
explodiert" machen.


## ★ v1125 — die Detonation des „Giant Exploding Skull"

Al 15.9.: „Fuege eine riesige, ueber dem Skull selbst zentrierte
Explosion hinzu!"

`skull_detonation` — Blitz, drei versetzte Druckringe, 34 Splitter und
eine Rauchkugel, zentriert auf die EIGENE Zone der Karte: die Karte ist
die Bombe, nicht das Brett.

**★ RIESIG heisst hier wirklich riesig.** Der Radius geht mit `ww * 3.2`
weit ueber die eigene Zone hinaus, weil der Effekt das GANZE Brett
raeumt — eine zonengrosse Explosion haette ausgesehen, als traefe sie nur
den Nachbarn. **Bedingung dafuer ist `overflow: visible` am Container**,
sonst schneidet die Zone alles ab, was hinausragt; ein Testfall prueft
genau diese CSS-Zeile.

**★ ZEITPUNKT: VOR den Zerstoerungen.** Sonst raeumt sich das Brett still
ab und die Explosion erklaert hinterher nichts mehr. Das widerspricht
NICHT der v736/v1122-Regel (Sichtbarkeit erst hinter dem verbindlichen
Punkt): wir sind im Todes-Hook, es gibt nichts mehr abzubrechen. Ein
Testfall haelt die Reihenfolge fest.

Drei versetzte Ringe statt eines grossen: das gibt Wucht, ohne dass ein
einzelner Ring riesig wirken muss.


## ★★ v1124 — ZWEI „Giant Exploding Skull" ergaben eine ENDLOSSCHLEIFE

Al 15.9.: „Der Versuch, Giant Exploding Skull auszuloesen, erzeugt
(vermutlich) unendlich viele Kopien von Skull, die dann zum Discard
gehen! BEIDE SPIELER hatten je einen — womoeglich haben sie sich
rekursiv immer wieder gegenseitig getoetet."

**Genau das war es.** Und Als Verdacht traf auch den Grund: sie wurden
nicht rechtzeitig abgeraeumt.

```
A explodiert → toetet B → B explodiert → toetet A → A explodiert → …
```

A lag zu diesem Zeitpunkt noch in `support` — sein Tod wurde ja gerade
erst abgearbeitet —, wurde also ein ZWEITES Mal zerstoert, feuerte
erneut, und jede Runde legte eine weitere Kopie in die Ablage.

**★ DIE KETTE SELBST IST RICHTIG.** Die Explosion IST ein
Kreatur-Effekt, also loest ein zweiter Skull, den sie mitnimmt,
seinerseits aus — so steht es auf der Karte. Falsch war nur, dass sie
nie endete. Zwei Riegel machen daraus eine endliche Kette:

| Riegel | Aufgabe |
|---|---|
| `_skullExploded` | jede Instanz explodiert **hoechstens einmal** |
| `_skullExploding` | wer gerade explodiert, ist **kein Ziel** |

Der zweite ist der weniger offensichtliche: ohne ihn zerstoerte B den
noch auf dem Brett stehenden A ein zweites Mal, und der erste Riegel
haette die Kopienflut nur verlangsamt.

**★ Der Testfall stellt Als Lage nach** (ein Skull pro Seite, dazu
Beifang) und prueft drei Dinge: die Kette endet (mit Zeitwaechter), jede
Instanz traegt genau eine Explosion, und **hoechstens eine Kopie je
Seite** landet in der Ablage — das war der sichtbare Schaden. Eine
Gegenprobe mit entfernten Riegeln laesst den Prueffall wirklich fallen.


## ★ v1123 — „The Thing in the Ship" als SPIELER-DEBUFF

Al 15.9.: „Sein «Active Abilities locked»-Zustand (fuer beide Spieler)
sollte den Spielern als Player-Debuff dargestellt werden!"

**★ DER ZUSTAND KAM GAR NICHT BEIM CLIENT AN.** `abilityActivationBlocked()`
stand nur in der Engine und sperrte still — der Spieler sah ausgegraute
Abilities und keinen Grund dafuer.

Der Server schickt ihn jetzt in beiden Zustands-Bloecken mit; der Client
macht daraus **zwei Zeilen aus EINEM Wert**:

```
⛔ You cannot activate any Ability effects while
   "The Thing in the Ship" is on the board!
⛔ <Gegner> cannot activate any Ability effects either —
   the lock hits both players!
```

**★ ZWEI ZEILEN AUS EINEM WERT, nicht zwei Werte.** Die Karte sperrt
beide Seiten gleichzeitig; wer nur die eigene Zeile zeigte, liesse den
Spieler glauben, der Gegner duerfe noch. Die Gegner-Zeile sagt das
ausdruecklich — ein Testfall prueft den Satz.

Farbgebung wie bei den uebrigen Sperren: eigene Zeile rot, die des
Gegners gedaempft.


## ★★★ v1121 — DAS SUCH-TEMPLATE (`_search-shared.js`)

Al 15.9.: „Fuege dem Spiel Search-Lock als extrem wichtigen Test fuer
kuenftige Karten hinzu … Idealerweise haben alle Such-Effekte ein
aehnliches Template, auf der kuenftige Karten ganz automatisch
aufbauen."

**Die vier Bauformen stehen jetzt an EINER Stelle**
(`cards/effects/_search-shared.js`), mit Helfern dafuer:

| Bauform | Beispiel | unter Sperre | Werkzeug |
|---|---|---|---|
| ① nur Suchen / Suche ist Schritt 1 | Brilliant Idea, Brainstorming | **gar nicht spielbar** | `blockedBySearchLock: true` |
| ② aktivierbarer Effekt, Schritt 1 ist Suche | Cute Annoyance Mini | **nicht angeboten** | `skipIfSearchBlocked(...)` |
| ③ Suche als EINE von mehreren Optionen | Soul Shard Ren | nur die **Option** faellt | `filterSearchOption(...)` |
| ④ Suche passiert nebenbei | | **Schritt** uebersprungen | `searchBlocked(...)` |

Dazu `suchAbfrage(pile)` — die Kennzeichnung fuer jede Such-Abfrage:

```js
const { suchAbfrage } = require('./_search-shared');
await ctx.promptCardGallery(karten, { ...suchAbfrage('deck'), title, … });
```

**NEUER WAECHTER `scripts/check-search-template.js`** prueft die eine
Sache, die man am leichtesten vergisst: wer eine Auswahl oeffnet UND
danach aus Deck/Ablage auf die Hand holt, muss die Abfrage kennzeichnen.
**Er fand sofort 19 weitere Karten**, die auf keiner Liste standen —
Aurora Borealis, Beato, Boomerang, Cecilia, Cooldin, Cuteness Sensor,
Dajan, Elixir of Mana, Fiona, Guardian Beast Shu, Liberation, Magic
Sapphire, Magnetic Glove, Magnetic Potion, Riffel, Shard of Chaos,
Shooting Star, Spatial Crevice, Xiong. Alle nachgezogen.

## ★ DAS ANGEBOT WIRD JETZT AUCH UNTERDRUECKT

Al: „Karten wie Deepsea Witch sollten nicht mal ihren optionalen Effekt
ANBIETEN, das sollte alles geskipped werden!"

Ein `confirm`, das nur fragt „moechtest du suchen?", traegt jetzt
dieselbe Kennzeichnung wie die Galerie dahinter — `promptGeneric`
unterdrueckt damit schon die FRAGE. Durchgereicht wird sie von
`ctx.promptConfirmEffect` und `promptOptionalOnSummon`.

## ★ WARUM ES ZWEI GALERIEN GIBT — und was daran zusammengelegt wurde

Als Frage: „Waere es nicht viel sauberer, nur EINE Standard-Galerie zu
haben?"

**Im CLIENT sind es wirklich zwei verschiedene Ansichten:** die
Einzelwahl stempelt pro Instanz (Zaehler auf Ablage-/Geloescht-
Kreaturen), die Mehrfachwahl fuehrt Auswahlzahl, Mindestmenge und ein
Kostenbudget. Beide Renderer zusammenzulegen hiesse, sie neu zu
schreiben — bei 182 Aufrufstellen.

**Die AUFRUFSEITE ist jetzt EINE**, und dort lag der eigentliche Aerger:
`ctx.promptCardGallery` schaltet selbst auf die Mehrfachansicht um,
sobald die Konfiguration mehr als eine Karte verlangt. Wer eine Galerie
braucht, kennt ab jetzt genau eine Funktion.


## ★★ v1120 — MEIN SCAN WAR BLIND FUER `ctx.promptCardGallery`

Al 15.9.: „Du liegst auf jeden Fall falsch — MINDESTENS Deepsea Witch
oeffnet (auch jetzt immer noch) einen Dialog."

**Stimmt.** Ich hatte die KARTENDATEIEN nach `type: 'cardGallery'`
durchsucht — „Deepsea Witch" ruft aber `ctx.promptCardGallery(...)`, den
Kontext-Helfer. In ihrer Datei steht kein `type:`, also fand mein Scan
sie nicht und ich erklaerte sie fuer dialoglos.

**Der Helfer reicht die Kennzeichnung jetzt durch:**

```js
ctx.promptCardGallery(cards, { searchToHand: true, searchPile: 'deck' })
```

Gleiches fuer `promptCardGalleryMulti`. Markiert sind „Deepsea Witch"
und `_cycling-demons-shared.js` — die beiden, die ueber diesen Weg auf
die Hand suchen.

**★ LEHRE: ein Scan nach Prompt-TYPEN findet nur die Karten, die den
Prompt selbst bauen.** Wer ueber einen Helfer geht, faellt durch. Beim
naechsten Mal zuerst nach den HELFERN suchen.

## ★ SPIELSPERREN nach Als eigener Liste

Al hat die Liste selbst gezogen; sie deckt sich mit meiner bis auf drei
Karten, die ich zusaetzlich gesperrt hatte und die gesperrt bleiben:
**Brilliant Idea** („Choose a card from your deck … add it to your
hand" — reiner als das geht es nicht, war schon vor heute gesetzt),
**Teleportal** und **Cleansing of the Land** (beide mit Begruendung in
ihren Dateikoepfen).

**Nicht gesperrt** bleiben Helden, Abilities, Equips und Kreaturen — bei
ihnen greift die Sperre nur an der Effekt-Aktivierung, die Karte selbst
bleibt spielbar.

## Neue Karte: „Brainstorming" (v1120)

```
Spell · Normal · Magic Arts Lv1
You can only play this card when there are 4 cards with the same name in
your discard pile. Search your deck for any card, reveal it and add it
to your hand. Then, shuffle 4 cards with the same name from your discard
pile back into your deck. This counts as an additional Action.
```

**„4 cards with the same NAME"** — vier Kopien EINER Karte, nicht vier
beliebige. Ein Testfall prueft, dass vier verschiedene Namen NICHT
genuegen.

**★ DIE REIHENFOLGE STEHT AUF DER KARTE und ist nicht beliebig:**
„Search … THEN shuffle". Wer erst mischt, koennte eine gerade
zurueckgemischte Karte sofort wieder heraussuchen. Ein Testfall prueft,
dass die Galerie nur das Deck VOR dem Mischen anbietet.

Gibt es mehrere Vierergruppen, waehlt der Spieler — die Wahl ist real,
weil die zurueckgemischten Karten aus der Ablage verschwinden
(Necromancy & Co. verlieren ihr Material).

**Vollstaendig gesperrt** (Al: „der Search ist Voraussetzung fuer den
restlichen Effekt!") — ohne Suche bliebe nur das Zurueckmischen, also
reiner Verlust.


## ★ v1119 — ALS KARTENLISTE abgearbeitet (15.9.)

Al hat die betroffenen Karten aufgezaehlt. Zwei Arbeiten daraus:

**① 33 Such-Galerien markiert** (`searchToHand: true`), in allen sechs
Cheeses, Hell Fox und Tamed Hell Fox, Cute Dog, Elven Rider, Sparkfly
Architect, Steam Dwarf Diver, Koperniko, Navigation, Rain Viola, Bishop
of Kings [W], Cute Annoyance Mini, Creative Puppet Brammi,
Life-Searcher, Debt-O-Tron Backup Duplicator, Bifab, Shanty- und
Ska-Harpyformer sowie den schon markierten aus v1118.

**② Reine Such-Karten komplett gesperrt** — Al: „VIELE davon haben
Search als ihren einzigen Effekt und muessten entsprechend komplett
geblockt und gar nicht erst aktivierbar sein." `blockedBySearchLock`
neu auf:

| Karte | warum rein |
|---|---|
| Cute Cheese | der ganze Text ist die Suche |
| Cool Cheese | Suche plus EINSCHRAENKUNG — ohne Suche bliebe nur der Nachteil |
| Holy Cheese | Suche plus ein Vorteil fuer den GEGNER — dito |
| Bifab, Bridge to Coolness | aus dem Coolness-Stack reine Suche, kostet die Karte |
| Spider Dance | die Bonus-Beschwoerung haengt an den gesuchten Karten |
| Tanuki Escape | Rueckmischen + Suche; sonst nur Kosten und Zugende |

**★ BEWUSST NICHT gesperrt** sind Kreaturen, Helden und Abilities, deren
KOERPER oder andere Zweige weiterhin nuetzen (Hell Fox, Elven Rider,
Koperniko, Navigation, Steam Dwarf Diver …). Eine Spielsperre dort
naehme mehr weg, als der Text hergibt.

## ★★ „Soul Shard Ren" — nur der HAND-Zweig faellt

Al ausdruecklich: „SPECIAL CASE, nur der «add to hand»-Zweig ist
blockiert, der Effekt bietet trotzdem den Self-Mill-Zweig an!"

Die Karte sucht im Deck und laesst DANACH waehlen: auf die Hand oder in
die Ablage. Ihre Galerie traegt deshalb **kein** `searchToHand` — sie
darf oeffnen. Erst die Zielwahl streicht die Hand-Option, wenn gesperrt;
der Ablage-Zweig bleibt.

**★ Der Rueckfall geht dann in die ABLAGE, nicht auf die Hand** — sonst
liefe eine ausbleibende Antwort in genau den verbotenen Zweig.

**Offen:** „Brainstorming" hat noch kein Skript (rein suchend, gehoert
bei Bau gesperrt). „Deepsea Witch", „Madaga", „Rebelliokai Kappa" und
„Inventing" oeffnen keine Galerie — bei ihnen greift weiterhin die
Sperre am Hand-Add.


## ★★ v1118 — „durchsuchen" ist NICHT „auf die Hand nehmen"

Al 15.9.: „Das Search-Lock verhindert ausschliesslich Effekte wie Hell
Fox oder die Cheeses, die eine Karte vom Deck gezielt AUF DIE HAND
nehmen, NICHT Garius, der eine bestimmte Creature vom Deck sucht und
INS SPIEL bringt."

**★ MEINE v1117-ERKENNUNG LAS NUR DIE QUELLE.** „Kommt aus dem Deck" ist
aber kein Kriterium — **das ZIEL entscheidet**. „Garius, the Great
Reformer" durchsucht ebenfalls das Deck und war damit faelschlich
gesperrt.

Ein Prompt muss es jetzt ausdruecklich sagen:

```js
searchToHand: true,
searchPile: 'deck' | 'discard',   // ohne Angabe: 'deck'
```

**Ohne diese Angabe passiert die Abfrage.** Die alte Sperre am HAND-ADD
greift dort weiterhin — der Spieler waehlt dann eben ins Leere, so wie
vor v1117. Das ist die sichere Richtung: **lieber ein Dialog zu viel als
ein blockierter Garius.**

**Gekennzeichnet sind die kanonischen Hand-Sucher** (14 Abfragen in 13
Karten): Hell Fox, die drei Cheeses, Brilliant Idea, Divine Gift of
Creation, Graveyard Gathering, Idol of Crestina, Perilous Journey,
Spontaneous Reappearance, Trial of Loyalty, Cleansing of the Land und
Teleportal. Wer eine weitere findet, setzt die beiden Felder.

## ★ KEIN MISCHEN NACH EINER UNTERDRUECKTEN SUCHE

Al: „Ausserdem braucht das Deck nicht gemischt zu werden, wenn ein
Search unterdrueckt wird." Stimmt — es wurde ja nichts angesehen.

Die Suchkarten mischen nach einem Abbruch von sich aus („search implies
a shuffle"). Die unterdrueckte Abfrage hinterlaesst deshalb einen
**EINMAL-Gutschein** (`_skipNextShuffle`), den `shuffleDeck` einloest.

**★ Der Gutschein wird IMMER verbraucht**, auch wenn die Karte gar nicht
mischt — er gilt nur fuer den naechsten Versuch und darf nicht
liegenbleiben, sonst verschluckt er irgendwann einen fremden
Mischvorgang. Ein Testfall prueft beides: Reihenfolge unveraendert, und
der Gutschein ist danach weg.


## ★★ v1117 — SUCH-SPERRE GREIFT JETZT VOR DER ABFRAGE

Al 15.9.: „Ich habe einen Hell Fox verloren, waehrend ich under siege
war, also nichts hinzufuegen durfte. Trotzdem musste ich waehlen, welche
Karte ich gerne hinzufuegen WUERDE, dann aber eben nicht durfte. Under
siege sollten ALLE Search-Galerien/Dialoge unterdrueckt sein!"

**★ DER RIEGEL SASS NUR AM HAND-ADD — also NACH der Wahl.** Jede
Suchkarte oeffnete ihre Galerie, der Spieler waehlte, und dann passierte
nichts. Funktional richtig, aber als Spielgefuehl unzumutbar.

**Jetzt greift er in `promptGeneric`** — fuer ALLE Suchkarten auf
einmal, ohne dass eine einzelne etwas dafuer tun muss:

```js
_suchQuelleDerAbfrage(promptData) → 'deck' | 'discard' | null
```

Erkannt wird an der QUELLE der angebotenen Karten:
* `promptData.searchPile: 'deck'|'discard'` — ausdrueckliche Angabe;
* `type: 'deckSearchReveal'` — immer Deck;
* sonst: ALLE Eintraege tragen `source: 'deck'` bzw. `'discard'`.

**★ DIE ERKENNUNG IST BEWUSST VORSICHTIG.** Eine gemischte oder
unbenannte Liste bleibt unberuehrt — lieber eine Suche uebersehen als
eine harmlose Handauswahl abwuergen. Fuenf Testfaelle halten die
Nicht-Treffer fest (keine Quelle, Handauswahl, gemischt, anderer
Prompt-Typ, leere Liste).

**Reichweite:** 127 Karten mit Galerie nennen ihre Quelle erkennbar und
sind damit abgedeckt; 46 bleiben unberuehrt. Wer eine davon nachruestet,
setzt `searchPile` — „Hell Fox" hat es als erste bekommen.

**★ TESTFALLE:** `bauEngine` ersetzt `promptGeneric` durch einen Stub —
der neue Riegel lief im ersten Anlauf gar nicht. Wer ihn pruefen will,
muss `GameEngine.prototype.promptGeneric.call(E, …)` nehmen.


## ★★ v1116 — „Love Shot" ALS Zusatzaktion sprang den Kern ueber

Al 15.9.: „Ich nutze Learning (Lv1), um Love Shot als ADDITIONAL zu
spielen … aber ich bekomme KEINE Moeglichkeit, einen Spell mit dem
geklauten Hero zu nutzen, das wird einfach uebersprungen!"

**★ DER CHARMED-ZWEIG PRUEFTE, OB NOCH EINE AKTION FREI IST.** War Love
Shot selbst die Zusatzaktion, ist danach keine mehr da — **jede** Karte
fiel aus der Liste, die Abfrage entfiel kommentarlos, und die Karte tat
sichtbar nichts.

Die Karte sagt aber ausdruecklich: „That Attack or Spell counts as an
**ADDITIONAL Action**." Sie gewaehrt die Aktion selbst; sie zu verlangen
ist der Fehler.

```js
engine.getHeroPlayableCards(pi, { charmedIgnoresActionCost: true })
```

Der Schalter gilt **nur fuer den charmed-Zweig** — der eigene bleibt
gesperrt; ein Testfall prueft das eigens.

**★ WARUM ES MIT EINER NORMALEN AKTION NIE AUFFIEL:** dann war die
Kapazitaet noch da und das Tor liess alles durch. Der Fehler brauchte
eine KETTE aus zwei Zusatzaktionen, um sichtbar zu werden. Der Testfall
stellt genau die nach: Aktion verbraucht, kein Granter mehr, und misst
die Liste einmal mit und einmal ohne Schalter.

**★ TESTFALLE:** die Kontrolle haengt an `hero.charmedBy`, NICHT am
`charmed`-Status — der macht nur Optik und Immunitaet. Mein Aufbau setzte
erst nur den Status; die Heldenschleife fand dann gar nichts.

## ★ v1115/v1116 — Badge-Wortlaut

```
Negated (Decisive Defeat): … Lasts as long as Decisive Defeat remains
attached to this Hero.

Negated (Weakening Crystal): … Lasts as long as Weakening Crystal
remains in your hand.        (beim GEGNER: „in their owner's hand")
```

Der Zusatz nennt die Karte beim Namen und sagt, WO sie liegen muss — die
beiden Quellen liegen an verschiedenen Orten (Anhaengsel am Helden,
Crystal in der Hand). Die Blickrichtung kommt ueber `isOpponentSide`
vom Aufrufer, der weiss, wessen Reihe er zeichnet.


## ★ v1114 — EIGENER BADGE, und die LEICHTE Negation

Al 15.9.: „Der Negated-Status-Badge, den Defeat anlegt, behauptet
faelschlicherweise, der Effekt wuerde auch Abilities negieren und am
Rundenende aufhoeren; beides stimmt fuer DIESEN Negated-Zustand nicht!"

**★ BEIM NACHSEHEN ZEIGTE SICH: NICHT NUR DER TEXT LOG.** Der Motor
kannte schon zwei Formen von `negated` —

| Form | Wirkung | endet |
|---|---|---|
| **HART** (Standard) | Heldeneffekt UND Ability-Zonen ausgeblendet | zum Zugende bzw. nach Dauer |
| **LEICHT** | nur der Heldeneffekt | mit der Karte |

— aber die leichte war an `_byWeakeningCrystal` allein gebunden.
**„Decisive Defeat" lief in der HARTEN Form** und blendete die
Ability-Zonen wirklich aus, obwohl ihr Text nur sagt: „that Hero's
EFFECT is negated". Der Badge log also nicht, er beschrieb das falsche
Verhalten korrekt.

**Jetzt ist die leichte Form an die KARTEN-HERKUNFT gebunden** —
`_byWeakeningCrystal` (Handkarte) ODER `_fromAttachment` (Anhaengsel) —
an fuenf Stellen in Engine und Client. Zwei Testfaelle stellen hart und
leicht nebeneinander: dieselbe Lage, einmal unspielbar, einmal spielbar.

**Der eigene Badge** (Wortlaut nach Als Vorgabe, v1115):

```
Negated (Decisive Defeat): Has its effect negated. Abilities still
work. Lasts as long as Decisive Defeat remains attached to this Hero.

Negated (Weakening Crystal): Has its effect negated. Abilities still
work. Lasts as long as Weakening Crystal remains in your hand.
```

**★ DER ZUSATZ NENNT DIE KARTE BEIM NAMEN UND SAGT, WO SIE LIEGEN
MUSS.** Erste Fassung schrieb „Lasts as long as the card is in play" —
beides nicht. Die beiden Quellen liegen naemlich an verschiedenen Orten:
ein Anhaengsel am HELDEN, „Weakening Crystal" in der HAND. Der Ort
haengt deshalb an derselben Marke wie die Heilbarkeit
(`_fromAttachment` / `_byWeakeningCrystal`).

Der Badge spricht von EINEM Effekt statt „effects and Abilities" und
nennt kein Rundenende. Der Standardtext bleibt fuer die harte Form
unveraendert.

**★ TESTFALLE, zum dritten Mal dieselbe:** mein Pruefaufbau gab dem
Helden Decay Magic und liess ihn „Icebolt" (Destruction Magic Lv2)
spielen. Beide Formen waren dann korrekt unspielbar, und der Test
beschuldigte den Fix. **Wer eine Stufenpruefung testet, muss dem Helden
GENAU die Schule der Karte geben.**


## ★★ v1113 — „Decisive Defeat" war WIRKUNGSLOS, nicht nur im Puzzle

Al 15.9.: „Das hat ueberhaupt nicht geklappt. Wenn ich ein Puzzle starte
und ein Hero dabei Decisive Defeat angelegt hat, wird dieser NICHT mit
einem Effekt belegt!"

**★ DIE URSACHE WAR GRUNDLEGENDER ALS DAS PUZZLE.** Die Karte trug seit
v1092 `silencesHostHero` — eine EIGENE Abfrage, beantwortet von
`_isHeroEffectSilenced`. **Der Spielbetrieb fragt sie nie.** Er liest
`hero.statuses.negated` DIREKT: 27 Stellen in der Engine, 8 im Server,
2 im Client. Die Karte war damit praktisch wirkungslos — im Puzzle wie
im normalen Spiel.

**Meine v1092-Begruendung war falsch.** Ich hatte den `negated`-Status
verworfen, weil er global nicht cleansbar ist — und daraus eine zweite,
parallel gefuehrte Wahrheit gebaut. Die richtige Loesung lag seit v1103
vor: den ECHTEN Status anlegen und die EINZELNE Instanz heilbar machen
(Weakening-Crystal-Muster).

**Jetzt:**

```js
attachmentStatus: 'negated',     // legt den echten Status an
countsAsNegativeStatus: true,    // bleibt in den Heil-Auswahllisten
```

Der Status traegt `_fromAttachment: 'Decisive Defeat'`. Die
Cleanse-Ausnahme aus v1103 ist verallgemeinert: heilbar ist **jede
Negation, die von einer KARTE getragen wird** — Hand (Crystal) oder
Anhaengsel. Der Statustyp bleibt global unheilbar.

`onCardLeaveZone` raeumt den Status ab — **aber erst, wenn die LETZTE
Kopie faellt**; ein Testfall prueft beide Schritte.

**`silencesHostHero` ist ERSATZLOS ENTFALLEN**, samt
`_heroSilencedByAttachment`. Ein Vertrag, den niemand liest, ist
schlimmer als keiner: er sieht im Kartenskript nach Wirkung aus.

**★ WARUM KEIN TEST DAS GEFANGEN HAT:** meine Faelle prueften
`_isHeroEffectSilenced` — also genau die Abfrage, die ich selbst gebaut
hatte. Sie war konsistent mit sich und mit nichts sonst. Die Testfaelle
messen jetzt gegen `hero.statuses.negated`, das Tor des Spielbetriebs.


## ★ PUZZLE MODE: Anhaengsel wirken ab Start (v1112)

Al 15.9.: „Wird im Puzzle Mode einem Hero Decisive Defeat in die Support
Zone getan, soll er automatisch das Puzzle negiert beginnen. Dasselbe
gilt fuer ALLE Attachments, die Statuseffekte applyen!"

**Im Puzzle laeuft KEIN `onPlay`** — die Karten werden direkt in die
Zonen gesetzt. Anhaengsel zerfallen dadurch in zwei Gruppen, und nur
eine braucht Hilfe:

| Gruppe | Beispiele | im Puzzle |
|---|---|---|
| **PASSIV** — Wirkung wird bei jeder Abfrage neu aus dem Brett gelesen | Decisive Defeat, Forbidden Curse of Aging, Siege, Energy Aura | wirkt **von selbst**, nichts zu tun |
| **STATUS/BUFF-SETZEND** — Effekt haengt an etwas, das `onPlay` anlegt | Berserk (`berserked`), Curse (`cursed`), Alliance, Anti Magic Enchantment | war **wirkungslos** |

**★ DECISIVE DEFEAT WAR SCHON RICHTIG** — sie gehoert zur passiven
Gruppe, weil `silencesHostHero` das Brett zur Laufzeit fragt. Ein
Testfall belegt das jetzt (Instanz direkt in die Zone, kein `onPlay`,
Held sofort stumm). Genau dafuer war die v1092-Entscheidung gut, den
Zustand an die KARTE zu haengen statt an einen Status.

**Zwei neue Deklarationen** fuer die andere Gruppe:

```js
attachmentStatus: 'berserked'          // Berserk, Curse
attachmentBuff:   'alliance'           // Alliance, Anti Magic Enchantment
```

`createPuzzleGame` geht nach dem Backdatieren einmal ueber alle
Support-Instanzen und stellt her, was fehlt (`appliedTurn: 0`, passend
zur Backdatierung: der Status gilt als „schon vorher zugefuegt", damit
Coffee & Co. ihn richtig einordnen).

**★ DIE BUFF-HAELFTE FIEL ERST BEIM NACHZAEHLEN AUF.** Als Wortlaut sagt
„Statuseffekte" — „Alliance" und „Anti Magic Enchantment" legen aber
einen BUFF an, kein Status. Dieselbe Luecke, anderes Feld; beide sind
mitgefixt.

**NEUER WAECHTER `scripts/check-attachment-status.js`** verlangt die
Deklaration von jedem Anhaengsel, das einen Helden-Status oder -Buff
setzt. 23 Anhaengsel haben ein Skript, vier brauchten sie.


## ★ ZIEH-KLANG BEIM DECK-FLUG (v1111)

Al 15.9.: „Die vom Gegner-Deck gezogene Karte spielt noch keinen
Draw-Sound ab."

**★ DIE URSACHE IST DIE MASKE, die den doppelten Flug unterdrueckt.**
`play_pile_transfer` registriert auf dem Client
`pileTransferToHandPendingMeRef` und blendet damit genau diesen
Handplatz aus der Zuwachs-Erkennung aus — **und an der haengt auch der
Zieh-Klang**. Gewollt war nur, die doppelte ANIMATION zu unterdruecken;
der Klang fiel als Beifang mit weg.

Zurueckgegeben wird er jetzt im selben Zweig, **nur fuer Fluege aus dem
DECK** (`from === 'deck'`), mit `dedupe` gegen Doppelklang und einer
kleinen Verzoegerung, damit er auf die Landung faellt statt auf den
Abflug.

**Das repariert nicht nur Love Shot:** 15 Kartendateien schicken
Deck→Hand-Fluege (Sid, Enigma, Crestina, Paraseed, Cybug, Aquatic …) —
alle waren stumm, alle klingen jetzt.


## ★ „ADD" ODER „DRAW"? Die Karte entscheidet (v1110)

Al 15.9.: „Zieht ein Spieler vom Deck seines Gegners, triggert das noch
NICHT Melissas Effekt."

„Cute Meanie Melissa": *„Whenever your opponent **DRAWS** 1 or more
cards via an effect, you may draw 1 card."*

**★ BEIDE KARTEN NEHMEN MECHANISCH DASSELBE — aber nur eine nennt es
Ziehen:**

| Karte | Wortlaut | `onDraw`? |
|---|---|---|
| „Love Shot" | „**DRAW** a card from your opponent's deck" | ✓ |
| „Infiltration" Lv1 | „**ADD** the top card of opponent's deck to your hand" | ✗ |

Deshalb entscheidet der AUFRUFER ueber `opts.asDraw`, nicht der Helfer.
Melissa entprellt ueber `_drawBatch`; der Helfer vergibt eine eigene
Kennung, damit ein Vorgang genau EINE Antwort ausloest.

**Beide Hooks feuern nebeneinander und gehoeren verschiedenen Seiten:**
Lilly steht beim NEHMER, Melissa beim BESTOHLENEN. Vier Testfaelle
halten beide Richtungen fest, samt der Gegenprobe, dass Infiltration
kein `onDraw` ausloest.

**Falls „Infiltration" spaeter auch als Ziehen gelten soll**, ist es ein
Wort im Aufruf — aber es waere eine Regelaenderung, keine Korrektur.

**★ Wer das nachbaut, vergisst ④ oder ⑤ — und es faellt nicht auf**,
weil die Karte ja trotzdem auf der Hand landet. Lilly bliebe einfach
still. Deshalb steht der Block jetzt EINMAL; Infiltration Lv1 ist
mitgezogen. Ein Testfall faengt den Hook ab und prueft ihn.

## ★ ③ DIE SCHADENS-IMMUNITAET IST GESTRICHEN

Der alte Satz „The controlled Hero cannot take any damage while it is
controlled by this effect" steht nicht mehr da.

**Die Immunitaet kam nie aus dieser Karte**, sondern als Beifang des
geliehenen `charmed`-Status — Charme Lv3 macht immun, und Love Shot
leiht sich denselben Mechanismus fuer die KONTROLLE. Seit v1106 fragt
der Schadensweg den Marker `_loveShot` mit ab, den die Karte ohnehin
schon setzte: **geliehene Kontrolle schuetzt NICHT, echter Charme Lv3
weiterhin schon.** Beide Faelle haben einen Testfall.

Praktisch heisst das: waehrend der geliehenen Aktion kann der Held
Rueckstoss, Gegenschlaege und Reaktionen abbekommen.


## ★ NEU: `levelCannotBeReduced` (v1104) — „Last Resort"

Al 15.9.: „Sein Level hat jetzt eine 'non-reducable'-Klausel, was sehr
wichtig fuer Balancing ist."

```
This Spell's level can never be reduced. Choose a target and deal damage
equal to twice the user's current HP to it. …
```

Ohne die Klausel liesse sich ein **Lv3-Zauber mit Sofortsieg-Bedingung**
verbilligen — und die Senkungsquellen sind zahlreich geworden: „Ethan,
the Prodigy" senkt JEDEN Spell in der Hand, „Damus" senkt Armageddon je
Ifrit, Schul-Ermaessigungen (`_magicLevelReductions`) kommen aus
Abilities.

```js
levelCannotBeReduced: true   // am Kartenskript
```

**★ DIE SPERRE SITZT GANZ VORN in `_applyCardLevelReductions`** — vor
jeder einzelnen Quelle. Eine Pruefung weiter unten haette bei der
naechsten neuen Senkungsart wieder eine Luecke gelassen; hier ist sie
strukturell dicht. Ein Testfall laesst drei Senker gleichzeitig auf die
Karte los und erwartet unveraendert 3.

**★ NICHT VERWECHSELN mit dem vorhandenen `cannotBeReduced`** — das
betrifft SCHADEN (`ctx.lockReduction()`), nicht Stufen. Die beiden
Namen sind bewusst verschieden; ein Testfall prueft, dass beide
nebeneinander im Motor stehen.

**★ WISDOM UND DIVINITY SIND DAVON NICHT BETROFFEN** (Al 15.9.:
„diese beiden agieren als Standins fuer die noetigen Abilities selbst,
sie reduzieren das Level des Spells nicht").

Der Motor sieht das genauso: die beiden laufen ueber `coverLevelGap` /
`_findLevelGapCoverage` — einen EIGENEN Weg, der
`_applyCardLevelReductions` gar nicht anfasst. Die Sperre konnte sie
also nie treffen. **Nachgemessen statt angenommen:** „Last Resort"
bleibt mit Divinity 3 und mit Wisdom 3 spielbar, und ihre Stufe bleibt
dabei 3.

Vier Testfaelle halten das fest — samt der Gegenprobe, dass sie OHNE
passende Ability unspielbar ist, und einer Strukturpruefung, dass die
Luecken-Deckung ein eigener Weg bleibt. **Wer die beiden Wege je
zusammenlegt, muss die Ausnahme ausdruecklich wieder herstellen**; ein
Kommentar an der Sperre sagt das.


## NEU: Damus / Ifrit / Armageddon (v1100) — das Apokalypse-Trio

Drei Karten, die kreuz und quer aufeinander verweisen. Gemeinsame
Abfragen stehen in `_apocalypse-shared.js`, weil „wieviele Ifrits
kontrolliert X" an sechs Stellen gebraucht wird.

**Als Textaenderungen (14.9.), in cards.json uebernommen:**
* Damus: „place an Ifrit" → „place an Ifrit **FROM YOUR HAND**"
* Damus: Support Zone **frei waehlbar**
* Damus: „Ifrits are **unaffected by** your opponent's cards and
  effects" → „**take no damage from** your opponent's cards or effects".
  ★ Deutliche Verengung: Zerstoerung, Uebernahme und Status greifen
  wieder. Ein Testfall haelt fest, dass `actionDestroyCard` durchgeht.

**Neue Motor-Vertraege:**

```js
summonOnlyFromHand: true              // Ifrit: kein Deck, keine Ablage
immuneToSourceNames: ['Armageddon']   // Karte/Held: Schaden dieser Quelle = 0
immuneToSourceCondition(engine,pi,hi) // Held: Immunitaet an Bedingung geknuepft
armageddonBonus: 100                  // Ifrit: Aufschlag, an EINER Stelle gelesen
protectsCreatureFromDamage(engine, inst, source, pi, heroIdx)  // Held schuetzt Kreaturen
```

**★ HELDEN-SKRIPTE ZAEHLEN JETZT AUCH BEI `reduceCardLevel` MIT.** Der
Motor ging nur Karten-INSTANZEN durch — ein Held, der Stufen senkt, kam
dort nie vor. Damus ist der erste; ohne diesen Zweig haette seine
Armageddon-Klausel STILL gar nichts getan.

## ★★ DIE TEUERSTE FALLE DIESER RUNDE: `continue` STATT MARKIEREN

`processCreatureDamageBatch` hat einen Loop, der Immunitaeten
**MARKIERT** (`e._immuneCreature = true`) — er wendet keinen Schaden an.
Meine erste Fassung setzte dort ein `continue`: damit uebersprang sie
die MARKIERUNG, nicht den Schaden. Die immunen Ifrits starben dadurch
**erst recht**.

Das hat fuenf Anlaeufe gekostet, weil die Immunitaet ISOLIERT
einwandfrei funktionierte — `inst.zone` blieb sogar 'support', waehrend
die Zone laengst geleert war. **Lehre: vor einem `continue` in einem
fremden Loop pruefen, was der Loop eigentlich TUT.**

## ★ ARMAGEDDON ZAEHLT DIE KREATUREN HINTERHER

Ich hatte die Zaehlung zwischenzeitlich VOR die Heldenschlaege gezogen,
mit der Begruendung, der Tod der letzten Heldenreihe raeume das Brett
mit ab. **Al: das stimmt nicht — Kreaturen ueberleben den Tod ihres
Helden.** Die leeren Zonen kamen vom `continue`-Fehler oben.

Und Nachher-Zaehlen ist nicht nur unschaedlich, sondern noetig:
**Armageddon toetet selbst Kreaturen**, die duerfen nicht mitzaehlen.
Drei Testfaelle halten das fest, darunter einer, bei dem der Gegner
VORHER zwei haette und HINTERHER null.

**Siegbedingung nur bei TOTALER Ausloeschung** (Al): steht auch nur ein
Held, greift die normale Regel. Umgesetzt ueber `_deferGameOverCheck`
(Bunny-Bombs-Vertrag) plus `_drawLoserIdx` — Gleichstand heisst
ausdruecklich, dass der WIRKER verliert.


## „Forbidden Curse of Aging" NEU GEFASST (v1096) — DREI Wirt-Vertraege

```
Spell · Attachment · Decay Magic Lv1
The HP of the Hero this Spell is attached to cannot be healed, and its
other status effects cannot be removed. Additionally, negate the effects
of all "Charme" Abilities attached to it. This counts as a status
effect. If the user has Decay Magic 3 or the target has any "Charme"
Abilities attached to it, this counts as an additional Action.
```

**Was sich gegenueber dem Bestandstext aendert:**
1. „other NEGATIVE status effects" → „other STATUS EFFECTS". Das Wort
   faellt weg, die Sperre wird breiter: auch POSITIVE Status lassen sich
   nicht mehr abnehmen. Ein Testfall haelt genau das fest.
2. „counts as a NEGATIVE status effect" → „counts as a STATUS EFFECT".
   Fuer die Entfernbarkeit aendert das nichts (v1093-Auswahllisten), sie
   zaehlt jetzt aber auch fuer Effekte, die bloss „ein Statuseffekt"
   verlangen.
3. NEU: die Zusatz-Aktions-Klausel.

**★ DREI NEUE KARTEN-VERTRAEGE, alle am WIRT und alle fallen mit der
Karte:**

```js
blocksHostHeal: true                // Heilung am Wirt verpufft
blocksHostStatusRemoval: true       // seine uebrigen Status eingefroren
negatesHostAbilities: ['Charme']    // Charme am Wirt ist tot
```

Die Ability-Negation sitzt an denselben **8 Aktivierungs-Toren** wie
„The Thing in the Ship" (v1073) **plus 2 harten Server-Sperren** — ein
Testfall zaehlt beide Zahlen nach.

**★ „OTHER" IST DER KNACKPUNKT.** Die Karte selbst bleibt entfernbar —
sonst waere sie ein unloesbares Schloss und der Satz „This counts as a
status effect" liefe leer. Die Sperre fragt nach STATUS-Namen; die Karte
ist keiner, sie haengt als Anhaengsel daneben.

**★ FEHLER, DEN DER TEST GEFANGEN HAT: der Riegel landete zuerst in
`actionAddStatus` statt in `removeHeroStatus`** — er haette das
HINZUFUEGEN von Status blockiert statt das Entfernen. Seitdem gibt es
dafuer einen eigenen Testfall („neue Status lassen sich weiterhin
auflegen"). Die `bypassUnhealable`-Ausnahme gilt auch hier: ein
Schutz-Effekt, der einen Status auf der Auftrag-Kante abfaengt, wird
nicht umgedeutet.

## ★ DIE ZUSATZ-AKTION HAENGT AM ZIEL — der Motor fragt aber VORHER

**Al fand die Luecke (14.9.):** `inherentAction` wird gefragt, BEVOR das
Ziel feststeht. Meine erste Fassung antwortete optimistisch mit
„irgendein Held traegt Charme" und liess danach JEDEN Wirt zu — wer kein
Decay Magic 3 hatte, bekam die Gratis-Aktion und durfte damit einen
Helden OHNE Charme verfluchen.

**★ DIE LOESUNG IST DIE DOPPELNATUR VON „CURSE"**, nicht eine
Zielbeschraenkung: optimistisch als Zusatz-Aktion einsteigen, und wenn
sich beim Zielen zeigt, dass die Bedingung nicht erfuellt ist, ueber
`gs._spellForcesActionConsume` auf eine normale Aktion
zurueckschalten — der Server bindet `isInherentAction` nach `onPlay`
eigens dafuer neu.

Das ist treuer als ein Zielverbot: die Karte sagt nicht „du darfst nur
Charme-Traeger treffen", sondern „gegen die zaehlt es als
Zusatz-Aktion". Wer einen Helden ohne Charme verfluchen will, darf das —
es kostet dann die normale Aktion.

Die Entscheidung liegt als eigener Export `zaehltAlsZusatzAktion(gs,
wirkerPi, wirkerHi, wirtPi, wirtHi)` vor, damit sie pruefbar ist, ohne
die ganze Zielwahl nachzustellen.

**★ ABER DER RUECKFALL BRAUCHT ETWAS ZUM VERBRAUCHEN** (Als
Nachfrage 14.9., v1098). "Dann kostet es eben die normale Aktion"
funktioniert nur, solange eine zur Verfuegung steht. In der Action
Phase, nachdem ein Held gehandelt hat, gibt es keine -- der Zauber liefe
dann DOCH gratis gegen einen Wirt ohne Charme.

**★ UND "eine Aktion" heisst NICHT nur die Grund-Aktion** (Als
zweiter Befund 14.9., v1099): "Es gibt auch noch andere Action-Granter
als nur die normale Action for turn (etwa Duigno oder Zhigao)."

Zwei Motor-Helfer:

```js
engine.hasNormalActionAvailable(playerIdx) -> bool
// nur die Grund-Aktion: Action Phase verbraucht, sobald ein Held
// gehandelt hat; Main Phases verfuegbar.

engine.hasPayableActionFor(playerIdx, cardName, heroIdx?) -> bool
// ALLE vier Quellen des Aktions-Haushalts:
//   1. die Grund-Aktion
//   2. heldengebundene Bonus-Aktionen (`bonusActions`)
//   3. allgemeine Bonus-Hauptaktionen (`_bonusMainActions`, Torchure)
//   4. KARTENPASSENDE Zusatz-Aktionen (`findAdditionalActionForCard`)
// `heroIdx` weglassen = JEDER eigene Held zaehlt.
```

Punkt 4 ist der wichtige: `findAdditionalActionForCard` prueft die
KATEGORIE der Karte mit, deckt also Duigno, Zhigao, Lunatic Hawk und
jeden kuenftigen Granter automatisch ab -- ohne Namensliste.

Die Karte koppelt ihre WIRTSLISTE daran: ohne Decay Magic 3 UND ohne
irgendeine bezahlbare Aktion werden Nicht-Charme-Helden per `heroFilter`
gar nicht erst angeboten. Sonst bleibt die Liste offen, weil der
Rueckfall dort zahlbar ist. Zwoelf Testfaelle fahren die Kombinationen
ab, je einer pro Quelle.

**Damit greifen zwei Mechanismen gestaffelt:** solange eine Aktion da
ist, entscheidet der Rueckfall (treu zum Text, jeder Wirt erlaubt);
sobald keine mehr da ist, entscheidet die Zielliste. Keiner allein
haette gereicht.

## ★ MEHRERE ANHAENGSEL AM SELBEN HELDEN (Als Vorsichtsfrage 14.9.)

Liegen ZWEI Curses (oder zwei „Decisive Defeat") am selben Helden und
wird EINE entfernt, muss die Wirkung bleiben. **Das war schon richtig**,
weil alle Wirt-Sperren nach einer PASSENDEN INSTANZ suchen statt einen
Zustand zu fuehren — aber es war ungetestet. Jetzt haben beide Karten
Testfaelle, die erst nach der ZWEITEN Entfernung eine Aenderung
erwarten.


## „MOE Shield" NEU GEFASST (v1095) — inkl. cards.json

```
Spell · Reaction · Support Magic Lv1
Play this card immediately when your opponent activates a Spell that
would affect 1 or more targets you control. Negate that Spell. If the
Spell would have affected exactly 1 target, you cannot draw cards until
the end of your next turn (including your Resource Phase).
```

Frueher kostete JEDE Nutzung die Zieh-Sperre. Jetzt nur noch gegen
EINZELZIEL-Zauber — gegen einen Flaechenschlag ist der Schild gratis
(Als Absicht: „um die Karte gegen AoE staerker zu machen").

**★ FUER DEN REAKTIONS-ZEITPUNKT GIBT ES ETWAS BESSERES ALS
INTERFERENCES SCHADENS-KLAMMER.** Al verwies auf Interference; dessen
Erkennung sitzt aber IM Schadensweg, und hier wird VOR der Aufloesung
entschieden. Das passende Werkzeug ist `isPostTargetReaction`: das
Fenster `_checkPostTargetHandReactions` feuert EINMAL je Zauber,
NACHDEM der Wirker seine Ziele gewaehlt hat und BEVOR er aufloest — mit
der ECHTEN Zielliste.

Das ist **genauer als jede Karten-Flagge**: ein Zauber, der mehrere
Ziele treffen KOENNTE, den der Wirker aber auf eines gerichtet hat,
kommt mit Laenge 1 an und zaehlt korrekt als Einzelziel. „Storm Ring"
nutzt dasselbe Fenster fuer dieselbe Frage.

**Gezaehlt wird ueber BEIDE Seiten** (Storm-Ring-Muster): „affected
exactly 1 TARGET" nennt keine Seite. Ein Ziel bei mir + eines beim
Gegner sind ZWEI → gratis. Nur die erste Bedingung („1 or more targets
YOU control") ist seitenbezogen. Doppelte Eintraege werden entdoppelt.

## ★ NEU: Zieh-Sperren ueber die Runde hinaus (v1095)

„until the end of your NEXT turn" — der uebliche `drawLocked` faellt am
Rundenwechsel. `ps.drawLockedUntilTurn` traegt jetzt die ZIELRUNDE; der
Rundenwechsel setzt `drawLocked` bis dahin NEU, statt es zu loeschen,
und raeumt den Stempel danach weg.

**Zielrunde statt Countdown**, gleiche Begruendung wie bei „Teleportal":
ein Countdown muss bei jedem Wechsel angefasst werden und geht verloren,
wenn ein Effekt Runden ueberspringt.

„including your Resource Phase" ist damit von selbst erfuellt — die
Sperre steht schon, wenn die Phase beginnt. Die Zielrunde haengt daran,
wer gerade dran ist: im Gegnerzug die naechste Zugnummer, im eigenen
Zug die uebernaechste.


## Neue Karte: „Decapitating Strike" (v1094)

```
Attack · Reaction · Fighting Lv1
Play this card immediately when a target is left at 50 or less HP after
taking damage. Defeat that target.
```

**★ DIE SCHWELLE MISST DEN REST, NICHT DEN SCHADEN** („left at 50 or
less HP AFTER taking damage"). Beide Nach-Schadens-Fenster liefern genau
das: `isAfterDamageReaction` (Helden) und
`isAfterCreatureDamageReaction` (Kreaturen). „a target" nennt weder Art
noch Seite — also beide Fenster und beide Seiten
(`firesForOpponentDefeat`).

**★ ABER NICHT AUF EINEN BEREITS TOTEN.** Bei 0 HP ist das Ziel schon
besiegt; „left at 50 or less" meint eins, das NOCH STEHT. Deshalb
**KEIN `firesOnLethalDamage`** — anders als bei „Corpse Explosion", die
es ausdruecklich braucht. Ohne diese Grenze waere die Karte auf jedem
Kill ein wirkungsloser Leerlauf. Ein Testfall prueft die Schwelle bei
400 / 51 / 50 / 1 / 0 HP einzeln.

**„Defeat that target"** ist ein Insta-Kill, kein Schaden — er laeuft an
Schadensminderung und Versteinerung vorbei, greift aber in die
Niederlage-Fenster (Extra-Leben, Guardian Angel), was richtig ist.
Bei Kreaturen geht er ueber `actionDestroyCard` und damit durch das
Fenster von „Enhanced Guard Dog" — als EINZELNE Zerstoerung, der Dog
darf sie also abfangen.

**Animation** (Al 14.9.: „ein brutaler Schwertschlag, neue
Animation!"): `sword_cleave` — die Klinge faehrt diagonal durch, die
Schnittlinie bleibt kurz stehen, dann spritzt es. Kein Emoji, gleiche
Begruendung wie beim Pocket-Sand-Projektil.

**★ FALLE: `actionDefeatHero(source, target, opts)` — die QUELLE steht
VORN.** Mein erster Aufruf uebergab das Ziel zuerst; er lief STILL ins
Leere, der Held blieb einfach stehen. Kein Fehler, keine Warnung — nur
ein Testfall, der „das Ziel ist besiegt" prueft, faengt so etwas.


## ★ SWEEP: „counts as a status effect" — wer behauptet es, wer ist es? (v1102)

Al 15.9.: „Check auch einmal per Sweep den umgekehrten Fall: Gibt es
Effekte, die als Status gelten, aber noch nicht wahrgenommen werden?"

**21 Karten** sagen in ihrem Text, dass sie als Statuseffekt zaehlen.
Das Ergebnis ist beruhigend: **alle bis auf zwei legen einen ECHTEN
Engine-Status an** und sind damit von selbst versorgt — Heilung,
Anzeige und jede „ist betroffen von"-Abfrage greifen ohne Zutun.

★ Besonders die beiden, die man verdaechtigen wuerde:
* **Berserk** haengt seine Regeln an `berserked`, nicht an der
  angehaengten Karte — der Dateikopf sagt sogar ausdruecklich
  „Cleansable".
* **Curse** haengt an `cursed`, ebenfalls cleansbar. Die
  ATK-0-Regel liest den STATUS, nicht die Karte.

Beide Status stehen in `getCleansableStatuses()`. Es gab also nichts zu
reparieren — nur zu belegen.

**Zwei begruendete Sonderwege**, beide in der Allowlist des Waechters:
* **Unwanted Audience** wirkt auf KREATUREN und haengt an
  `getCleansableCreatureStatusKeys`.
* **Weakening Crystal** — von Al entschieden, siehe unten.

**NEUER WAECHTER `scripts/check-status-claims.js`**: jede Karte, deren
Text „counts as a status effect" sagt, muss entweder einen echten Status
anlegen ODER `countsAsNegativeStatus` tragen. Sonst steht der Satz nur
auf dem Papier. Sieben der 21 haben noch kein Skript — der Waechter
nennt sie, ohne sie als Fehler zu werten.

## ★ „Weakening Crystal": HEILBAR, ABER WIEDERKEHREND (v1103)

Al 15.9.: „Den Status zu cleansen, entfernt ihn TEMPORAER von einem
Ziel. Solange Crystal auf der Hand ist, wird der Effekt (mit kleiner
Animation!) zu Beginn jeder Runde des Betroffenen neu appliziert."

**★ DIE KARTE HATTE EIN ECHTES PROBLEM, nicht bloss eine Luecke.** Sie
legte zwar einen `negated`-Status an — aber bei JEDEM `sync()` neu. Eine
Heilung war dadurch wirkungslos: der naechste Zustandspush machte sie im
selben Augenblick rueckgaengig. Der Status-Sweep (v1102) hat sie genau
deshalb erwischt.

**Neue Bauart — angelegt nur an drei Zeitpunkten** (`reapply: true`):
Eintritt in die Hand, Rundenbeginn des Betroffenen, Laden eines
Spielstands. Dazwischen **raeumt der Sync nur noch AUF**: verlaesst die
Karte die Hand, faellt der Status SOFORT, nicht erst zum naechsten Zug.

**★ EINE BEGRUENDETE AUSNAHME IM CLEANSE-RIEGEL.** `negated` bleibt
global unheilbar (echte Negation ist ein permanenter Lockout) — heilbar
ist NUR die Instanz mit `_byWeakeningCrystal`. Das ist kein Umgehen der
Regel, sondern ein Aufschub: die Karte legt den Fluch selbst wieder an.
Ein Testfall prueft beide Seiten (Crystal-Fluch geht, echtes `negated`
bleibt).

In den Heil-Listen erscheint er als **„Negated (Weakening Crystal)"**.

**Animation** `crystal_drain` — bewusst KLEIN und auf der
Hintergrund-Ebene: sie laeuft zu jedem Rundenbeginn, solange die Karte
liegt. Sie feuert nur, wenn wirklich NEU angelegt wurde; liegt der Fluch
schon, bleibt es still.

**★ NEU: `declaresStatus: '<name>'`** — dritter anerkannter Weg fuer
`check-status-claims`. Fuer Karten, deren Status der MOTOR anlegt, weil
sie keinen eigenen Aufloesungspunkt haben (Crystal liegt in der Hand).
Macht die Zustaendigkeit im Kartenskript sichtbar, statt sie in einem
geteilten Modul zu verstecken.


## ★ GIFT-STAPEL JETZT IN ALLEN SIEBEN HEIL-KARTEN (Als QoL-Vorgabe)

Bisher zeigte nur „Tea" die Stapelzahl an, weil nur Tea sie in ihre
selbstgebaute Liste schrieb. Seit alle sieben ueber
`cleansableHeroEntries` gehen, kommen `stacks`, `statusData` und
`appliedTurn` ueberall an — ohne dass eine Karte etwas dafuer tun muss.
Das ist der Nebengewinn der Konsolidierung.


## Neue Karte: „Decisive Defeat" (v1092) — ZWEI neue Anhaengsel-Vertraege

```
Spell · Attachment · Decay Magic Lv2
While this card is attached to a Hero, that Hero's effect is negated.
This counts as a negative status effect.
```

**★ WARUM NICHT EINFACH DER `negated`-STATUS? Genau daran haengt der
zweite Satz.** `negated` ist in der Engine ausdruecklich NICHT cleansbar
— der Kommentar an `getCleansableStatuses` nennt ihn einen „permanent
lockout", dessen Aufhebung „intended card balance" braeche. Decisive
Defeat sagt aber, dass es ALS NEGATIVER STATUS ZAEHLT, also entfernbar
sein soll. Beides zugleich geht mit dem Status nicht.

Der Zustand haengt deshalb an der KARTE:

```js
silencesHostHero: true        // _isHeroEffectSilenced fragt Anhaengsel mit
countsAsNegativeStatus: true  // eine Vollheilung raeumt die Karte weg
```

Faellt die Karte, ist der Held im selben Moment wieder bei Sinnen — kein
Aufraeumen, kein Status, der haengenbleiben koennte.

**An BEIDE Seiten anhaengbar:** der Text sagt nur „a Hero", ohne
Seitenangabe (anders als „Siege": „one of YOUR Heroes").

## ★ AUSWAEHLBAR IN JEDER HEIL-KARTE (v1093, Als Vorgabe 14.9.)

Die Grenze aus v1092 („nur eine Vollheilung entfernt sie") ist WEG. Das
Anhaengsel steht jetzt als eigener Eintrag in den Auswahllisten:

```js
engine.cleansableHeroEntries(pi, heroIdx)
// → [{ key: 'attach:<instId>', label: 'Negated (Decisive Defeat)', icon: '🚫' }, …]
```

Die Beschriftung kommt aus dem Kartenskript
(`negativeStatusLabel` / `negativeStatusIcon`).

**★ EIN BAUER STATT SIEBEN** (v1101, Als Nachfrage 15.9.: „Bist du
sicher, dass diese drei die einzigen Karten sind? Was ist mit Tea,
Coffee, Elixir of Recovery usw.?").

Waren sie nicht. **NEUNZEHN Karten rufen `cleanseHeroStatuses`, SIEBEN
davon bauen dem Spieler eine Auswahlliste** — Juice, Beer, Cure, Tea,
Coffee, Elixir of Recovery, Waitress. Ich hatte drei umgestellt; die
uebrigen vier haetten „Decisive Defeat" und „Forbidden Curse of Aging"
nie angezeigt.

Alle sieben lesen jetzt `engine.cleansableHeroEntries(pi, heroIdx)`. Der
Bauer liefert dafuer vier Felder: `key`, `label`, `icon` plus `stacks`,
`statusData` und `appliedTurn` — letztere, weil „Tea" Gift-Stapel
anzeigt und „Coffee" nach der Runde filtert, in der ein Status kam.
Anhaengsel bekommen `appliedTurn` aus `inst.turnPlayed`, damit Coffees
Filter auch auf sie passt.

**NEUER WAECHTER `scripts/check-cleanse-lists.js`** meldet jede neue
Handkopie. Er unterscheidet HELDEN- von KREATUR-Listen: die
Kreatur-Zweige derselben Karten bauen weiter selbst, und das ist richtig
— Anhaengsel haengen an Helden. Sein erster Entwurf tat das nicht und
meldete vier korrekte Stellen als Fehler.

**Cure brauchte zwei Nachbesserungen:** seine ZIELBERECHTIGUNG verlangte
einen cleansbaren STATUS — ein Held, der nur „Decisive Defeat" traegt,
waere fuer Cure unsichtbar geblieben. Und die Heilmenge „100 × entfernt"
zaehlt das Anhaengsel jetzt mit.

**★ SIE GEHT IN DIE ABLAGE IHRES URSPRUENGLICHEN BESITZERS** (Als
Ruling): `actionMoveCard` routet ueber `originalOwner`, das die Instanz
eigens dafuer fuehrt. Spielt Spieler 0 die Karte auf einen Helden von
Spieler 1, liegt sie physisch drueben — faellt aber zu Spieler 0
zurueck. Ein Testfall prueft beide Seiten.

**Erinnerung (v1064-Lehre):** erste Fassung schickte `negate_flash` —
einen Animationstyp, den es nicht gibt. Ein unbekannter Typ tut STILL
gar nichts. Jetzt `silence_seal`, das im Register steht; ein Testfall
prueft genau das.


## Neue Karte: „Memory Blast" (v1091)

```
Spell · Normal · Destruction Magic Lv2
Choose a target your opponent controls and deal damage equal to 10 times
the number of cards in your opponent's discard pile to it. This must be
the only damage you deal this turn, and this Spell can never hit more
than 1 target. If that target was originally controlled by you,
permanently regain control of it instead.
```

**① Schaden = 10 × GEGNERISCHER Ablagestapel**, nicht der eigene — die
Karte bestraft den, der viel abgelegt hat.

**② „the only damage you deal this turn"** ueber `ps.damageLocked`
(Flame-Avalanche-Vertrag): danach wird jeder weitere Schaden dieses
Spielers an gegnerischen Zielen zu 0.
**★ GESETZT WIRD NACH DEM EIGENEN SCHLAG.** Vorher haette die Karte
ihren eigenen Schaden geloescht — ein Testfall prueft beides in dieser
Reihenfolge.

**③ „can never hit more than 1 target"** → `neverMultiTarget: true`
(Basketskull-Vertrag). Loader und „Bomb Berserker Bartas" lesen ihn,
kein Verdopplungs-Effekt kann die Karte ausweiten.

**★ ④ DIE ABZWEIGUNG: „If that target was ORIGINALLY CONTROLLED BY YOU
… INSTEAD."** Statt Schaden. Gemessen an `inst.originalOwner`, das sich
nie aendert (die Engine fuehrt es ausdruecklich fuer solche Faelle).
Hat der Gegner mir eine Kreatur gestohlen, hole ich sie zurueck und tue
ihr NICHTS — **auch keine Schadenssperre**, denn es wurde ja kein
Schaden ausgeteilt.

**★ „instead" KENNT KEINEN RUECKFALL:** ist auf meiner Seite kein Platz
frei, passiert schlicht gar nichts — nicht ersatzweise Schaden. Ein
Testfall haelt das fest.

**Animation** (Al 14.9.): `dark_blast` bekommt die Staerke als `power`
(0..1) mit — groesserer Kern, zweiter Ring ab der Haelfte, mehr
Splitter. Die Skala steht VOR dem Start fest (`--mb-scale`), animiert
werden weiter nur `opacity` und `transform`. Volle Wucht ab 300 Schaden;
darueber waechst sie nicht weiter, sonst spraengte ein voller
Ablagestapel das halbe Brett.


## Neue Karte: „Siege" (v1090) — die STARKE Such-Sperre, brettgetragen

```
Spell · Attachment · Magic Arts Lv3
Attach this card to one of your Heroes. While this card is attached to a
Hero, your opponent cannot add cards from their deck or discard pile to
their hand outside their Resource Phase (but they can still draw cards).
```

Die zweite Stufe der Such-Sperre, fuer die seit „Cats of the Pharaoh"
(v1068) das Fundament lag: **Deck UND Ablagestapel**. „but they can
still draw cards" bestaetigt die Wahl — es ist die SUCH-Sperre, nicht
`handLocked`.

## ★ NEU: `blocksSearchFor` — Sperre als ZUSTAND statt als Flagge

Cats setzt eine Flagge, die am Zugende faellt. **Siege ist ein
Zustand:** die Sperre gilt, solange die Karte haengt, und zusaetzlich
nur AUSSERHALB der Resource Phase des Gegners. Eine Flagge muesste dafuer
bei jedem Phasenwechsel nachgefuehrt werden — und liefe beim ersten
vergessenen Pfad aus dem Tritt.

```js
blocksSearchFor(gs, pi, quelle, engine, inst) → true = GESPERRT
// pi = wer suchen will, quelle = 'deck' | 'discard'
```

`engine.searchLockLevel(pi)` fasst Flagge UND Brett zu
`{ deck, discard }` zusammen; `_isSearchBlocked` und
`_cardBlockedBySearchLock` lesen nur noch daraus. Kein Aufraeumen —
faellt die Karte vom Helden, antwortet sie nicht mehr.

**★ DER SERVER MUSSTE MIT.** Er schickte bisher die ROHE Flagge; eine
brettgetragene Sperre haette der Client nie gesehen — kein Abzeichen,
keine ausgegrauten Karten, obwohl die Sperre greift. Jetzt geht die
ABGELEITETE Stufe raus. Ein Struktur-Testfall von Cats prueft seitdem
genau diese Zeile (er fiel beim Umbau auf und wurde nachgezogen, statt
ihn zu loeschen).

**„outside THEIR Resource Phase"** meint die des GESPERRTEN Spielers.
In einer fremden Runde ist er nie in seiner eigenen Resource Phase — die
Sperre gilt dort also durchgehend. Geprueft wird deshalb BEIDES: sein
Zug UND die Resource Phase. Drei Testfaelle fahren die Kombinationen ab.


## Neue Karte: „Alluring Light" (v1089)

```
Spell · Normal · Decay Magic Lv1
Choose a Hero your opponent controls and a target you control. Your
chosen target takes damage equal to the chosen Hero's Attack stat.
This is treated as the chosen Hero attacking your chosen target.
```

**★ DIE KARTE DREHT DIE RICHTUNG UM — und das liest man leicht falsch.**
Man waehlt einen GEGNERISCHEN Helden als Angreifer und ein EIGENES Ziel
als Opfer. Der Schaden geht also auf die EIGENE Seite. Wer die Seiten
vertauscht, baut eine voellig andere Karte.

Der Sinn steckt in der letzten Zeile: **„treated as the chosen Hero
ATTACKING"** — der Angriff zaehlt dem GEGNER, samt allem, was daran
haengt (seine Angriffszaehler, Rueckstoss-Effekte wie „Rioting Village",
Gegenschlaege). Man laesst den Gegner auf sich selbst einschlagen.
Umgesetzt ueber eine Angriffsquelle mit `owner`/`controller` des
GEGNERS; ein Testfall faengt genau diese Quelle ab und prueft ihre
Seite.

**Der Attack stat ist der AKTUELLE Wert des GEGNER-Helden** — damit ist
diese Karte eine der 48, die den Stat lesen, ohne selbst ein Attack zu
sein. Genau der Grund, warum „Rioting Village" den STAT verdoppeln muss
und nicht den Attack-Schaden (siehe dort).

**Animation** (Als Vorgabe 14.9.): erst `lure_beacon` — rhythmisch
pulsende Ringe plus blinkender Kern auf dem OPFER, das Licht, das lockt
—, dann die Standard-Ramme `play_ram_animation` vom angelockten Helden
aus. Die Reihenfolge ist ein Testfall, nicht nur eine Absicht.

**★ TESTFALLE:** `counters.damageTaken` ist NICHT der Zaehler fuer
Kreaturenschaden — er blieb `undefined`, obwohl der Aufruf `dealt: 40`
meldete. Wer Kreaturenschaden pruefen will, beobachtet den AUFRUF
(Quelle, Betrag, Typ) statt eines vermuteten Zaehlers.


## Neue Karte: „Cleansing of the Land" (v1088)

```
Spell · Normal · Magic Arts Lv1
Choose an Area from your deck and add it to your hand. If one of your
Heroes can use that Area, you may immediately use it as an additional
Action.
```

**„If one of your Heroes CAN USE that Area"** ist die Stufenpruefung,
nicht „hast du einen lebenden Helden". `heroMeetsLevelReq` ist genau
diese Frage und beruecksichtigt Schule, Stufe, Wisdom und jede
Ermaessigung von selbst. Dazu `canPlaceAnotherArea` (v1050) — es muss
auch PLATZ sein, und keine Dublette.

**„as an additional Action"** kostet hier nichts: der Einsatz laeuft
mitten in der Aufloesung. Die Formulierung stellt nur klar, dass der Zug
nicht verbraucht wird.

**Such-Sperre handgesetzt** (Gruppe A): die Autoerkennung laesst die
Karte durch, weil sie neben der Suche `placeArea` aufruft — fuer sie ein
zweiter Effekt. Hier haengt der Einsatz aber VOLLSTAENDIG an der Suche;
ohne gefundene Karte gibt es nichts zu legen.

## ★ NEU: `layer: 'background'` fuer feldweite Animationen (v1088)

`zoneType: 'board'` (v580) traf bisher immer die OBERE Ebene — richtig
fuer eine Explosion, falsch fuer eine Feuerwalze, die UNTER den Karten
durchziehen soll (Al 14.9.: „aber auf Hintergrund-Layer!").

```js
engine._broadcastEvent('play_zone_animation', {
  type: 'fire_sweep', zoneType: 'board', layer: 'background', …
});
```

`layer: 'background'` mountet in `.board-plane-clip` — die
Atmosphaeren-Ebene, in der auch `BoardAmbiance` und die
Area-Hintergruende liegen. Alles Uebrige paintet davor.

**★ TESTFALLE, wieder eine andere:** „Acid Rain" ist **Decay Magic
Lv2**. Mein Testheld trug Magic Arts — die Einsatz-Abfrage blieb dann
KORREKT aus, und der Test beschuldigte die Karte. Wer eine
Stufenpruefung testet, muss dem Helden GENAU die Schule geben, die die
Karte verlangt, nicht irgendeine.


## ★ DER ATK-TRICHTER IST JETZT DICHT (v1087) — plus Waechter

Al 14.9.: „Bekannte Luecken oder Grenzen sollen IMMER gefixt werden!"

`_applyHeroAtkDelta` war als DER Trichter dokumentiert — **war es aber
nicht.** Der Waechter `scripts/check-atk-funnel.js` fand **neun**
Zuweisungen daneben. Seit v1086 haengt daran mehr als der
Fluch-Zwischenspeicher: ATK-AUREN hoeren auf `afterHeroAtkChange`, eine
Umgehung macht also zweierlei still kaputt.

**Auf den Trichter gezogen (echte Deltas):**
* `cleanseHeroStatuses` — Rueckgabe nach dem Fluch;
* `curse.js` — dieselbe Rueckgabe im Kartenskript;
* Ablauf befristeter Gaben — war eine WORTGLEICHE Nachbildung des
  Trichters, beide Zweige taten exakt dasselbe;
* `actionGrantAtk`, das Widerrufen und `grantTempHeroAtk`.

**★ NEU: `_signalHeroAtkReset(hero, heroIdx)` fuer IDENTITAETSWECHSEL.**
Aufstieg und Gestaltwechsel setzen `hero.atk = newCardData.atk` — das
ist kein Delta, sondern ein Schnitt, der Trichter passt nicht. Die
Stelle meldet stattdessen `afterHeroAtkChange` mit `reset: true`; wer
eine Aura fuehrt, verwirft seine Buchfuehrung fuer diesen Helden und
legt auf dem NEUEN Wert frisch an. Ohne das rechnete „Rioting Village"
nach einem Aufstieg mit einem Betrag weiter, den es nicht mehr gibt.

**Begruendete Ausnahmen** (in der Allowlist des Waechters, jede mit
Grund im Code): das Absenken beim Auflegen des Fluchs (zu dem Zeitpunkt
ist `cursed` noch nicht gesetzt, der Trichter wuerde sichtbar buchen
statt in den Zwischenspeicher), der Identitaetswechsel selbst, und das
Leeren eines Heldenplatzes (der ganze Held wird auf null gesetzt, nicht
seine ATK veraendert).

**★ LEHRE: „kanonischer Trichter" im Kommentar ist keine Zusicherung.**
Die Dokumentation an `_applyHeroAtkDelta` sagte seit jeher „EVERY direct
`hero.atk += N` pattern should route through here" — und neun Stellen
taten es nicht. Erst ein Waechter macht aus dem Vorsatz eine Regel.


## Neue Karte: „Rioting Village" (v1086) — ZWEI neue Motor-Vertraege

```
Spell · Area · Destruction Magic Lv1
While this Area Spell remains on the board, all Heroes have their Attack
stats doubled, but no player can use more than 1 Attack per turn and
when a Hero deals damage with an Attack, it takes half the damage dealt
as recoil (rounded up). This recoil damage cannot be reduced or negated.
```

Alle drei Wirkungen gelten fuer BEIDE Seiten — „all Heroes", „no
player". Wer sie legt, legt sie auch gegen sich selbst.

## ★ NEU: `afterHeroAtkChange` — ATK-Auren, die MITWACHSEN

ATK ist im Motor ein MUTIERTER Wert, keine Rechnung. Jede vorhandene
Aura gibt einmal beim Eintritt und nimmt einmal beim Abgang (Bauform
„Blade of the Frostbringer"). **Fuer eine VERDOPPLUNG reicht das
nicht:** gewinnt ein Held spaeter ATK dazu, muss die Verdopplung
mitwachsen, sonst friert sie auf dem Platzierungszeitpunkt ein.

Der kanonische Trichter `_applyHeroAtkDelta` meldet deshalb jede
Aenderung als `afterHeroAtkChange`. Ein Tiefenschloss (`_atkAuraTiefe`)
verhindert, dass eine Nachlage sich selbst ausloest.

**★ DAS SCHLOSS REICHT NICHT ALLEIN.** Die Eintritts-Schleife der Karte
ruft `_applyHeroAtkDelta` NICHT verschachtelt auf — der Hook feuert
also, und die Karte zaehlte ihre eigene Gabe ein zweites Mal: aus der
Verdopplung wurde eine Verdreifachung (100 → 300 statt 200), und der
Abgang rechnete doppelt zurueck auf 0. **Wer den Hook benutzt, braucht
ein eigenes Schloss um seine eigenen Gaben** (hier
`counters._rvSyncing`). Beide Faelle haben Testfaelle.

## ★ NEU: `blocksCardPlay` — brettweite Spielsperren

`canPlayCard` sitzt am HELDEN und an seiner Ausruestung. Eine AREA
gehoert keiner Heldenreihe an und hatte bisher keinen Platz, an dem sie
ein Kartenspiel verbieten kann.

```js
blocksCardPlay(gs, pi, cardData, engine, inst) → true = GESPERRT
```

Umgekehrtes Vorzeichen zu `canPlayCard`. `validateActionPlay` fragt
JEDE Instanz, deren `activeIn` sie gerade aktiv macht — also auch
Permanents, Surprises und Kreaturen, falls spaeter eine solche Karte
entsteht. Beide Seiten werden gefragt.

## Rueckstoss

„half the damage DEALT" — es zaehlt der WIRKLICH angekommene Schaden
(`ctx.realDealt`), nicht der angekuendigte; ein Testfall fuettert
200 angekuendigt / 40 angekommen und erwartet 20.

„cannot be reduced or negated" → `actionDealTrueDamage`. Kein Kreisel:
der Rueckstoss traegt `type: 'recoil'`, ist also selbst kein
Attack-Schaden, plus ein Tiefenschloss als Rueckfall.


## Neue Karte: „Petrifier" (v1085) — GEMEINSAMER Versteinerungs-Marker

```
Spell · Normal · Decay Magic Lv2
Choose a target and Stun it for 3 turns. Damage a target Stunned by this
effect would take becomes 0.
```

**★ DIE NULL HAENGT AM STUN, NICHT AN EINEM EIGENEN STATUS.** „a target
STUNNED BY THIS EFFECT" — laeuft die Betaeubung aus, faellt die
Unverwundbarkeit mit. Deshalb kein zweiter Status und kein eigenes
Ablaufdatum: der Marker sitzt AM Stun.

**★ DIE OPTIK GAB ES SCHON — unter einem karteneigenen Namen.**
„Cardinal Beast Baihu" stempelte `_baihuPetrify`, und **vier Stellen**
lasen genau diesen einen Namen: der Helden-Schadenspfad, der
Kreaturen-Schadens-Batch, der Client-Filter (Held und Kreatur) und die
CPU-Zielbewertung. Ohne Verallgemeinerung haette „Petrifier" an jeder
dieser Stellen einen eigenen Zweig gebraucht — und die naechste
Versteinerungs-Karte wieder.

Seit v1085 ist **`_petrified` der gemeinsame Name**. Baihu setzt ihn
mit; `_baihuPetrify` bleibt daneben stehen, damit laufende Spielstaende
nicht brechen. Bei Kreaturen kommt er als Begleitzaehler
(`counters._petrified`), weil Kreaturen-Status blosse Praesenz-Flaggen
sind.

**★ FALLE, IN DIE ICH GELAUFEN BIN: ich habe die Immunitaet zuerst NEU
GEBAUT.** Meine Fassung sass direkt hinter `damage_proof` — die
vorhandene Baihu-Pruefung stand 500 Zeilen weiter unten in derselben
Funktion. Zwei Stellen, die dasselbe tun, waeren genau die Dublette, die
beim naechsten Regelwechsel auseinanderlaeuft. Zurueckgenommen und die
VORHANDENE Stelle verallgemeinert.

**Aufraeumen:** beim HELDEN faellt der Marker automatisch mit dem
Status (er sitzt auf dem Statusobjekt). Bei der KREATUR musste er
ausdruecklich mitgeloescht werden — sonst bliebe sie dauerhaft
unverwundbar und grau, obwohl die Betaeubung laengst vorbei ist. Ein
Testfall prueft genau diesen Ablauf.

**True Damage geht durch**, gleiche Abgrenzung wie bei `damage_proof`.


## Neue Karte: „Teleportal" (v1084)

```
Spell · Normal · Magic Arts Lv1
Search your deck for a card and place it openly in front of you. At the
beginning of your next turn, add it to your hand. If this is the first
Spell you use this turn, this counts as an additional Action.
```

**„Openly in front of you"** ist dieselbe offene Zone wie bei „Elixir of
Immortality" (Al 14.9.): `ps.permanents` plus eine getrackte Instanz in
der Zone `'permanent'`.

**★ ABER DIE ABGELEGTE KARTE IST NICHT TELEPORTAL SELBST**, sondern die
GESUCHTE — und sie liegt dort nur als Zwischenstation. Der Eintrag
traegt deshalb `teleportalUntil` (am Permanent) bzw.
`counters._teleportalUntil` (an der Instanz). Ohne diesen Stempel waere
sie optisch und im Zustand von einem dauerhaften Permanent nicht zu
unterscheiden.

**Abzeichen** (Als Vorgabe 14.9.): `.perm-tohand-badge` (➜✋) am
Permanent, auf BEIDEN Seiten gerendert — der Gegner soll sehen, was da
gleich auf die Hand kommt.

**★ DER STEMPEL TRAEGT DIE ZIELRUNDE, NICHT EINEN COUNTDOWN**
(`gs.turn + 1`). Ein Countdown muesste bei jedem Rundenwechsel
heruntergezaehlt werden und geht verloren, wenn ein Effekt Runden
ueberspringt — ein Testfall prueft genau den Fall (Rueckkehr auch nach
vier uebersprungenen Runden).

**„First Spell this turn"** ueber `inherentAction` in Funktionsform. Der
Zaehler `ps.spellsPlayedThisTurn` wird vom Server ERHOEHT, BEVOR der
Effekt laeuft — zum Pruefzeitpunkt steht er also noch auf 0, wenn
Teleportal der erste Zauber ist.

**★ SUCH-SPERRE: HANDGESETZT, mit Begruendung.** Die Autoerkennung sieht
hier keinen bekannten Hand-Add-Weg — `takeFromPile` OHNE `toHand` (die
Karte geht ja zunaechst in die offene Zone) und eine Runde spaeter der
generische `actionAddCardToHand`, der bewusst NICHT als Deck-Suche
zaehlt (Gruppe D). Der Ertrag IST aber eine Deck-Suche auf die Hand,
also Gruppe A. Damit verschwindet Teleportal auch aus der Hinweisliste
von `check-effect-source.js` — genau der Kreislauf, fuer den der Hinweis
gebaut wurde.


## ★ „Wie viel zahlen?" GEHOERT INS ML, nicht in die Karte (v1083)

Al 14.9.: „Statt arbitraer die Haelfte zu zahlen, sollte die CPU per ML
lernen, wann wie viel zu zahlen ist."

**Meine erste Fassung von „Festive Werz" hatte eine handgeschriebene
Regel (》hoechstens die Haelfte des Vorrats《). Die war nicht nur geraten,
sondern SCHAEDLICH:** ein `cpuResponse('generic')` greift VOR dem
Piloten — die Karte haette den Lernkanal dauerhaft blockiert und nie
eine Kontrastgruppe erzeugt. Dieselbe Falle wie bei
`cpuMeta.reactionHeuristic` (6.9.).

**Der passende Kanal existiert schon: `ordinalPick` / `ordinalRules` —
》FORM 3: ORDINAL (wie viel)《.** Er liest die Zahlenreihe aus den
Optionsbeschriftungen und waehlt die Stufe, die der GELERNTEN Zielhoehe
am naechsten kommt, **je Karte** getrennt (Als Ruling 24.8.: keine
deckweiten 》You may《-Kanaele). `PP_OPTION_EXPLORE` streut im Training,
damit Kontrast entsteht.

**★ DIE KARTE MUSS NICHTS ANMELDEN — ABER ZWEI DINGE RICHTIG MACHEN:**

1. **Jede Option braucht eine ZAHL in der Beschriftung.** Der Kanal
   liest die erste Ziffer je Zeile; fehlt sie auch nur bei einer Option,
   verstummt er komplett (`zahlen.some(x => x === null)` → null). „Pay
   nothing" haette den ganzen Kanal abgeschaltet — es heisst deshalb
   **„Pay 0 Gold"**.
2. **Aufsteigend sortieren.** Der Rueckfall des Piloten ist
   》letzte Option《 und meint dokumentiert 》all in《. Mit der Null am Ende
   haette die CPU ohne Profil IMMER nichts gezahlt.

**★ TESTFALLE:** das Profil haengt am **Engine-Cache**
(`engine._deckProfileCache`), nicht am Spielerobjekt. Ein Profil an
`ps._deckProfile` zu haengen sieht plausibel aus und wirkt nicht — der
Kanal bleibt still und der Test beschuldigt die Karte.


## Neue Karte: „Ethan, the Prodigy" (v1081)

```
Creature · Summoning Magic Lv1 · 50 HP   (banned)
You may immediately summon this Creature as an additional Action when
you use a Spell with an original level of 4 or higher. While this
Creature is on the board, the levels of all Spells in both players'
hands are reduced by 1 while in hand. You can only control 1 „Ethan,
the Prodigy".
```

**★ „ORIGINAL LEVEL" IST HIER NICHT KOSMETIK.** Ethan senkt selbst
Stufen — haette man den EFFEKTIVEN Wert genommen, koennte ein zweiter
Ethan sich nie mehr ausloesen, sobald der erste liegt (und ein Lv4-Spell
faellt unter die Schwelle, kaum dass Ethan wirkt). Gelesen wird deshalb
`cardData.level` aus der Kartendatenbank, NICHT `effectiveCardLevel`.

**Die Senkung nutzt `reduceCardLevel` + `globalReduceCardLevel: true`.**
Das Flag hebt den Standardfilter auf, der sonst nur die eigene Seite
beliefert — „both players' hands" verlangt genau das. `evalOpts.pileSide`
markiert Auswertungen aus Deck, Ablage und Geloeschtem; dort gilt die
Senkung nicht („while in hand", Ruin-Mourner-Muster). Und sie wirkt nur,
solange Ethan im SUPPORT liegt — auf der Hand oder in der Ablage nicht.

**Folge, die woertlich aus dem Text faellt:** je ein Ethan pro Seite
ergibt **-2** in BEIDEN Haenden. „You can only control 1" begrenzt nur
die eigene Seite.

**★ `beforeSummon` IST KEIN HOOK**, sondern eine Karten-Funktion, die
der Motor vor JEDER Beschwoerung dieser Karte aufruft; `false` bricht ab.
Dadurch greift „You can only control 1" gegen die normale Beschwoerung
UND gegen den Sofort-Weg, ohne dass beide es einzeln pruefen. Meine
erste Fassung hatte sie faelschlich unter `hooks` gestellt — dort haette
sie nie gefeuert.

**★ TESTFALLE, wiederholt aufgetreten:** ein `promptGeneric`-Stub, der
pauschal `{confirmed:true}` liefert, beantwortet die ZONEN-Abfrage nicht.
Die Beschwoerung scheitert dann still an `undefined`-Koordinaten, und der
Test beschuldigt die Karte. Stubs muessen JEDEN Prompt-Typ bedienen, den
die Karte oeffnet.


## Neue Karte: „Giant Exploding Skull" (v1079)

```
Creature · Destruction Magic / Summoning Magic Lv1 · 1 HP
You may once per turn defeat this Creature. When this Creature is
defeated by a Creature's effect or damage inflicted by a Creature's
effect, defeat all Creatures on the board.
```

**★ DIE BEIDEN HAELFTEN GREIFEN INEINANDER: der Selbstmord IST ein
Kreatur-Effekt** — naemlich der eigene (Al bestaetigt 14.9.). Wer den
Schaedel per Knopfdruck sprengt, loest damit den Brett-Wischer aus; das
ist der Zweck der Karte und kein Nebenweg. Der Selbstmord meldet sich
deshalb mit dem EIGENEN Namen als Quelle an.

**★ UND DAS WIRD END-TO-END GEMESSEN**, nicht ueber einen gebauten
Todes-Kontext: der Pruefstand drueckt den Knopf und schaut, ob das Brett
danach leer ist. Der erste Pruefstand hatte nur „die Sprengung laeuft"
und „der Schaedel ist weg" gezeigt — beides waere auch dann gruen
gewesen, wenn der AoE gar nicht zuendet. Dazu eine Gegenprobe im
gleichen Aufbau: derselbe Tod durch einen SPELL laesst alles stehen.

Die Einmal-pro-Runde-Grenze fuehrt die Engine selbst
(`creature-effect:<instId>`), die Karte braucht keinen eigenen Zaehler —
`creatureEffect: true` genuegt.

**★ DIE ERKENNUNG IST DIE BREMSE DER KARTE.** Zwei Wege zuenden:
* **Schaden** aus einem Kreatur-Effekt → Schadenstyp `'creature'`, so
  setzt ihn „Exploding Skull" fuer genau diese Bedeutung;
* **Zerstoerung** durch einen Kreatur-Effekt → die Quelle traegt den
  Namen einer Karte vom Typ `Creature` (oder `Token`).

**Alles andere zuendet NICHT** — Spell, Attack, Artefakt, Heldeneffekt
sprengen den Schaedel wirkungslos. Genau das macht die Karte trotz
Brett-Wischer spielbar; wer hier grosszuegig erkennt, baut eine ganz
andere Karte. Vier Testfaelle halten die Nicht-Ausloeser einzeln fest.

**„all Creatures on the board"** heisst BEIDE Seiten, auch die eigenen.
**Zerstoerungs-Klammer** (v1057) drumherum: hier faellt nie nur eine
Karte, „Enhanced Guard Dog" darf also nicht feuern.

**CPU:** bewusst KEINE pauschale Zusage — der Knopf raeumt auch das
eigene Brett ab. Sie zuendet nur, wenn der Gegner mehr Kreaturen
verliert als sie selbst.


## Neue Karte: „Sas'Za, the Snaka Adventurer" (v1078)

```
Hero — Adventurousness / Hunting · 450 HP / 80 ATK   (banned)
Up to 3 times per turn, when a Creature is defeated by its opponent's
card or effect, draw cards equal to that Creature's level. You may add
your Creatures that are defeated by an opponent's card or effect back to
your hand instead of sending them to the discard pile.
```

**★ DER TEXT SIEHT SYMMETRISCH AUS, IST ES ABER NICHT.** Das ist die
ganze Schwierigkeit dieser Karte:

| Haelfte | Wortlaut | Reichweite |
|---|---|---|
| Ziehen | „when **A** Creature is defeated by **ITS** opponent's …" | JEDE Kreatur, gemessen an IHREM eigenen Gegner |
| Auf die Hand | „**YOUR** Creatures … by **AN OPPONENT's** …" | nur eigene, nur vom Gegner erledigt |

Al 14.9. ausdruecklich: „Der Draw-Effekt triggert auch fuer GEGNERISCHE
Creatures, wenn sie vom Sas'Za-Spieler besiegt werden." Sas'Za zieht
also **in beide Richtungen** — wenn der Gegner eigene Kreaturen
abraeumt UND wenn der eigene Spieler gegnerische abraeumt. Ein eigenes
Opfer (Sacrifice) gibt dagegen nichts, weder Karten noch Rueckholung.

**„Up to 3 times per turn" gehoert dem ZIEHEN**, nicht dem
Handrueckholen — der Nebensatz steht im ersten Satz. Gezaehlt werden
AUSLOESUNGEN, nicht gezogene Karten: eine Stufe-3-Kreatur zieht drei
Karten und verbraucht trotzdem nur eine der drei Gelegenheiten.

**★ ZWEI VERSCHIEDENE HOOKS, mit Absicht:**
* `onCreatureDeathClaim` fuer das Handrueckholen — das Anspruchsfenster
  laeuft VOR der Ablage (v679b), die Karte macht dort also keinen
  Zwischenstopp, weder sichtbar noch im Zustand. Anspruch per
  `_deathClaim` stempeln, Hunting-Muster. Ein FRUEHERER Anspruch
  gewinnt.
* `onCreatureDeath` fuer das Ziehen — erst wenn der Tod feststeht, sonst
  zoege man fuer eine Kreatur, die ein Anspruch noch wegschnappt.


## Neue Karte: „Santa Klaus" (v1076)

```
Hero — Divinity / Infiltration · 400 HP / 40 ATK
Whenever this Hero uses an Attack or Spell, you must add 2 cards from
your hand to your opponent's hand.
```

**★ EIN PFLICHT-PREIS BRAUCHT EINE SPIELBARKEITS-SPERRE** (Al 14.9.:
„He cannot act while the player has fewer than 2 cards in hand, not
counting the card used for the Action"). Ohne sie koennte Santa einen
Zauber wirken, dessen „must"-Kosten danach nicht zu bezahlen waeren.

Umgesetzt ueber den vorhandenen Helden-Riegel **`canPlayCard`** in
`validateActionPlay`.

**★ `canPlayCard` HAT SEIT v1077 EIN SECHSTES ARGUMENT: die HERKUNFT.**

```js
canPlayCard(gs, pi, heroIdx, cardData, engine, { handIndex, fromHand, fromCreation })
```

Die Schwelle haengt daran, ob die Karte ueberhaupt von der Hand kommt:

| Herkunft | noetige Handkarten | warum |
|---|---|---|
| von der HAND | **3** | die gespielte Karte liegt noch mit drin und ist keine Reserve |
| NICHT von der Hand (Coolness-Stack, Bifab, Ability-Aktion wie Adventurousness) | **2** | die Hand ist unangetastet |

Die Angabe stammt aus dem `handIndex`, den `validateActionPlay` ohnehin
bekommt — sie war da, wurde nur nicht weitergereicht. Der Parameter ist
rein additiv; bestehende `canPlayCard`-Fassungen ignorieren ihn.

**Ohne Herkunftsangabe** (aeltere Aufrufer) nimmt Santa den Hand-Fall an
— die strenge Richtung, weil ein unbezahlbarer „must" schlimmer waere
als eine zu strenge Sperre.

Nur Attacks und Spells sind gesperrt. Eine Kreatur zu beschwoeren oder
eine Ability anzulegen loest den Preis nicht aus und darf deshalb auch
nicht blockiert werden; ein Testfall haelt alle vier anderen Kartentypen
frei.

**Der Preis haengt an `afterSpellResolved`**, nicht an `onActionUsed`:
der Hook feuert nur, wenn die Karte WIRKLICH aufgeloest hat — ein
negierter Zauber kostet also nichts — und deckt ausdruecklich auch die
Sonderwege ab (zusaetzliche, freie, sofortige und Ersatz-Aktionen).
Dieselbe Wahl wie bei „Pharaoh, the Lone Living Being", der denselben
Textbaustein traegt; dessen Kopf begruendet sie ausfuehrlich.

Gegeben wird ueber `actionTransferCardToOppHand` (Chatty-Town-Guard-Weg),
das die Handsperren der Gegenseite mittraegt. Der Spieler waehlt selbst,
die Abfrage ist `cancellable: false`.


## Neue Karte: „Ricochet" (v1075)

```
Attack · Normal · Fighting Lv2
Both players take turns choosing targets their opponent controls that
have not been chosen with this effect yet until a player cannot choose a
new target. You choose first. The first target takes damage equal to the
attacker's Attack stat. Every subsequent target takes half as much
damage as the previous one (rounded up).
```

**★ DIE WAHL SPRINGT ZWISCHEN DEN SEITEN.** „targets THEIR OPPONENT
controls" gilt je WAEHLER: der Angreifer waehlt auf der Gegenseite, der
Gegner danach auf der Angreiferseite, und so weiter. Das ist der
Namensgeber der Karte und leicht zu ueberlesen — es steht NICHT „targets
YOUR opponent controls". Ein Ziel kann ueber beide Seiten hinweg nur
EINMAL gewaehlt werden.

Die Wahl ist **nicht abbrechbar**: „until a player CANNOT choose" kennt
kein Aussteigen, nur „keine Ziele mehr".

**Erst alles waehlen, dann schiessen.** Der Kartentext listet die
Zielwahl vollstaendig auf, bevor er vom Schaden spricht — und ein
Querschlaeger, der die ganze Kette entlangspringt, passt auch besser als
Wahl-Schuss-Wahl-Schuss. Verschwindet ein Ziel dazwischen, faellt nur
DIESER Treffer aus; die Halbierung laeuft weiter, denn sie haengt an der
POSITION in der Kette, nicht am Erfolg des Vorgaengers.

**★ EIGENSCHAFT, BEIM TESTEN AUFGEFALLEN: die Kette ist nie kuerzer als
2.** Der ANGREIFER selbst ist fuer den Gegner ein gueltiges Ziel — und
er muss leben, sonst spielt er die Karte nicht. Ricochet trifft also
faktisch IMMER mehrere Ziele und ist damit immer ein Flaechenschlag.
Mein erster Testfall wollte den Einzelziel-Fall pruefen und war schlicht
nicht konstruierbar.

**Flaechenklammer** wie „Chain Lightning" („springt zwar von Ziel zu
Ziel, ist aber EINE Quelle ueber die ganze Kette") — „Interference"
schuetzt dagegen.

**Animation** (Al 14.9.): die Flintlock-Kugel, die von Ziel zu Ziel
springt. Der erste Flug geht vom Helden aus, jeder weitere vom
vorherigen EINSCHLAG. **Der Klang kommt von selbst** —
`play_projectile_animation` spielt je Flug `sfx || 'projectile'`, „mit
einem Sound jedes Mal" ist also nichts Zusaetzliches.


## Neue Karte: „The Thing in the Ship" (v1073)

```
Creature · Normal · Decay Magic / Summoning Magic Lv2 · 100 HP
While this Creature remains on the board, neither player can activate
the active effects of their Abilities.
```

Vertrag: **`blocksAbilityActivation: true`** — mehr steht nicht in der
Karte. Die Arbeit macht `engine.abilityActivationBlocked()`.

**★ WAS EIN „AKTIVER EFFEKT" IST** (Al 14.9.: „solche wie Alchemy,
Charme etc.") steht nicht in den Kartendaten, sondern an der Bauform des
Skripts:

```js
GameEngine.abilityHasActiveEffect(script)
// true bei `onFreeActivate` (Alchemy, Charme, Trade …)
//      oder `onActivate`     (Adventurousness)
```

Passive Abilities (Toughness, Resistance, Interference) haben nur
`hooks` und bleiben unberuehrt — sie werden ja auch nicht „aktiviert".
Heute trifft die Sperre **18 der 41** Abilities.

**★ `actionCost` ALLEIN REICHT NICHT ALS MERKMAL** — es bedeutet nur
„kostet eine Aktion" und traegt genau EINE Ability (Adventurousness);
Alchemy und Charme sind FREIE Aktivierungen und waeren durchs Netz
gefallen. Ein Testfall haelt beide Zahlen (1 gegen 18) fest, damit die
Abkuerzung nicht irgendwann doch genommen wird.

**Es zaehlt aber MIT** (Als Vorgabe 14.9.: „Auch Action-Cost zaehlt als
aktiver Effekt"). Heute ist das redundant — Adventurousness hat ohnehin
`onActivate` —, aber es faengt kuenftige Karten ab, die eine Aktion
kosten und ihren Effekt anders umsetzen.

**★ VERHAELTNIS ZU „Ragnarock" (Als Nachfrage 14.9.): KEINE Dublette.**
Ragnarock stellt dieselbe Frage zu einem anderen Zeitpunkt. Es reagiert
auf eine LAUFENDE Aktivierung und liest dafuer den Ketten-Marker
`fromBoard: true`, den die beiden Aktivierungswege setzen — die
praezisere Auskunft im Moment des Geschehens. `abilityHasActiveEffect`
fragt VORHER („darf ueberhaupt aktiviert werden?"). Ragnarock bleibt
deshalb unveraendert.

**Die beiden Mengen muessen aber deckungsgleich sein**, und das wird
GEMESSEN statt behauptet: ein Testfall geht den ganzen Kartenbestand
durch und weist nach, dass nichts, was der Server aktivieren laesst
(`freeActivation` + `onFreeActivate` bzw. `actionCost` + `onActivate`),
durch `abilityHasActiveEffect` faellt.

**Vorrang statt Konflikt:** liegt „The Thing in the Ship", kommt es gar
nicht erst zu einer Aktivierung — Ragnarock hat dann nichts, worauf es
reagieren koennte.

**Acht Listen-Tore plus zwei harte Server-Sperren.** Die Engine-Listen
sind nur die Oberflaeche — ohne die Sperre in `doActivateFreeAbility`
und `doActivateAbility` liesse sich die Aktivierung per Socket-Nachricht
trotzdem ausloesen.

**„neither player"**: der Riegel fragt nur, OB so eine Kreatur auf dem
Brett liegt, nicht wem sie gehoert. Verdeckte Surprises zaehlen nicht.
**„while … remains"**: rein zustandsgebunden, keine Hooks, kein
Aufraeumen — verlaesst sie das Brett, ist die Sperre im selben Moment
weg.

**★ FALLE: DER LOADER WARF DIE KARTE WEG.** Ihr ganzer Inhalt ist EIN
Flag — keine Hooks, keine Effekte. Genau die Klasse, die der
„has no hooks, effects, or card type flags"-Filter still verwirft; der
einzige Hinweis war eine Warnzeile in der Konsole, und die Karte wirkte
schlicht nie. Neue ZUSTANDS-Vertraege muessen in dieser Filterliste
eingetragen werden (dort stehen aus demselben Grund schon
`onIdentityExpire`, `ascensionCondition`, `heroRedirect` …).


## ★ Such-Sperre: Nachzuegler und die Kreaturen-Zusicherung (v1072)

**Automatische Einordnung neuer Karten** (Al 14.9.). Die Einordnung
passiert im Loader und greift von selbst, sobald eine Karte ihr Skript
bekommt — vorausgesetzt, sie benutzt die Standard-Wege
(`searchDeckForNamedCard`, `actionAddCardFromDeckToHand`,
`addCardFromDiscardToHand` oder `takeFromPile({ toHand: true })`).

Damit man SIEHT, wenn eine neue Karte NICHT angekommen ist, meldet
`check-effect-source.js` jetzt zusaetzlich einen Hinweis: alle Karten,
deren TEXT eine Suche verspricht, die aber keine der beiden Flaggen
tragen. **Bewusst nur ein Hinweis, kein Fehler** — Side Deck (Divine
Gift of Edge), Add aufs BRETT statt auf die Hand (Gold Trap, Capture
Net) und Kosten-statt-Ertrag (Kitsune Transformation) sind legitime
Gruende.

**★ KREATUREN STEHEN NUR IN DER LISTE, SIE SIND NIE GESPERRT.** Die
breitere Erkennung (v1071) flaggt auch Kreaturen; das Tor
`_cardBlockedBySearchLock` nimmt sie ausdruecklich aus, und die
Ausgrau-Liste des Servers baut auf genau dieser Funktion auf. Ein
Testfall prueft das nicht als Behauptung, sondern misst es: er holt ALLE
geflaggten Kreaturen aus `cards.json` und weist nach, dass keine einzige
gesperrt ist — plus eine Gegenprobe, dass eine Nicht-Kreatur mit
derselben Flagge sehr wohl gesperrt ist.


## ★ Statt Sonderfall: der Standard lernt die Form (v1071)

Al 14.9.: „Sollte man dann nicht die Karten so umbauen, dass sie
Standard-Systeme nutzen und also detektierbar sind?" — ja, aber der
Umbau ging in die andere Richtung als gedacht.

**Warum die Karten ihren eigenen Weg gehen:** „Shooting Star" holt per
`takeFromPile` und legt selbst auf die Hand, weil Hin- und Rueckflug
sich kreuzen sollen (v893, Als eigene Vorgabe). Der fertige Helfer kann
das nicht. Die Karte auf ihn zu zwingen haette die Animation
zurueckgebaut.

**Also lernt der Standard die Form:** `takeFromPile(..., { toHand: true })`.
Die Absicht steht damit am Aufruf, der Riegel bleibt zentral, und die
Animation bleibt.

```js
// v1071 in takeFromPile:
if (opts.toHand && this._isSearchBlocked(pi, opts, pile === 'discard' ? 'discard' : 'deck')) return null;
```

Ein Griff ins Deck OHNE `toHand` (Beschwoerung, Mill, Coolness-Stack)
bleibt unberuehrt — das ist der ganze Zweck der Unterscheidung.

**★ DIE EIGENTLICHE URSACHE LAG TIEFER: die Erkennung sah nur Module mit
`resolve`.** Karten, die ihren Effekt ueber `hooks.onPlay` umsetzen
(Shooting Star, Aurora Borealis, Bifab), wurden nie angesehen. Deshalb
brauchten sie zunaechst handgesetzte Flaggen, obwohl ihre Quelle die
Suche klar zeigt. Seit die Erkennung auch `hooks.onPlay` prueft, fallen
alle drei Handflaggen weg.

**⚠ DIESELBE LUECKE STECKT NOCH IN `detectDrawOnly`** (nur `mod.resolve`).
Bewusst NICHT mitgeschlossen: das wuerde Karten unter dem Hand-Lock neu
sperren, die es heute nicht sind — eine Verhaltensaenderung, die Al
entscheiden sollte, keine Fehlerbehebung.

**Nebenwirkung, harmlos aber sichtbar:** die breitere Erkennung flaggt
jetzt auch einige KREATUREN (Harpyformer, Deepsea Witch, Soul Shard Ren
…). Das Tor nimmt Kreaturen ausdruecklich aus (gleiche Begruendung wie
beim Zieh-Lock), die Flagge ist dort also wirkungslos — ein Testfall
haelt das fest.


## ★ Such-Sperre: die vier Gruppen (v1070, Als Rulings 14.9.)

Al hat die Frage „gilt das immer?" in vier Gruppen entschieden:

| Gruppe | was die Karte tut | Folge |
|---|---|---|
| **A** | sucht im **DECK**, Suche ist der ganze Ertrag — auch mit Kosten/Nachteil daneben | unspielbar unter der **schwachen** Sperre |
| **B** | sucht in der **ABLAGE** | unspielbar unter der **starken** Sperre |
| **C** | legt gar nicht auf die HAND (Masterpiece → Surprise-Zone, Prophecy of Coolness → Coolness-Stack, Teleportal → vor sich hin) | **nicht betroffen** |
| **D** | Add aus BRETT oder GEGNERHAND (Capture Net, Kidnapping, Secret Entrance, Loot the Leftovers, Gold Trap) | **nicht betroffen** |

**★ KOSTEN SIND KEIN ERTRAG — und ein syntaktischer Erkenner sieht das
nicht.** Die Autoerkennung schliesst jede Karte aus, die neben der Suche
noch etwas tut. Bei „Angry Cheese" (100 Eigenschaden), „Sickly Cheese"
(Gift) und „Nerdy Cheese" (loescht erst einen Spell) ist das andere aber
eine KOSTE bzw. ein NACHTEIL: unter der Sperre zahlt man und bekommt
nichts. Diese Faelle bekommen ein **manuelles** `blockedBySearchLock`,
das im Loader gewinnt.

**★ FUER GRUPPE D MUSSTE DAS TOR ZURUECK.** `actionAddCardToHand` sah
aus wie ein Such-Weg, ist aber der GENERISCHE — „Gold Trap" holt damit
eine Kreatur vom BRETT. Die Sperre sitzt jetzt nur noch an den wirklich
quell-gebundenen Wegen (`searchDeckForNamedCard`,
`actionAddCardFromDeckToHand` fuer das Deck,
`addCardFromDiscardToHand` fuer die Ablage), und `actionAddCardToHand`
ist auch aus den Erkennungsmustern raus.

**★ OFFENE LUECKE, ehrlich vermerkt: `takeFromPile` + eigener
Hand-Push.** Mehrere Karten (Aurora Borealis, Magic Sapphire, Shooting
Star, Bifab) holen die Karte per `takeFromPile` und legen sie selbst auf
die Hand — an ALLEN Toren vorbei. Die Sperre kann sie zur Laufzeit also
nicht aufhalten. Abgefangen wird das hier ueber die
Spielbarkeits-Flagge: wer die Karte gar nicht spielen kann, laeuft auch
nicht in die Luecke. Sauberer waere, diese Karten auf die Helfer
umzustellen; das ist als Schuld vermerkt.

**Stand v1070:** 19 Deck-Sucher, 7 Ablage-Sucher. **Nicht eingeordnet**,
weil sie noch kein Skript haben oder zu verschachtelt sind: Brainstorming,
Cleansing of the Land, Crushing Defeat, Grasp the Future, Kidnapping,
Masterpiece, Secret Entrance, Teleportal, The Second Circle of Hell,
Ultimate Weapon Experiment, Kitsune Transformation, Tanuki Escape,
Bifab, Divine Gift of Edge (Side Deck).


## ★ Unter Such-Sperre: reine Such-Karten sind UNSPIELBAR (v1069)

Al 14.9.: „Karten, die NUR suchen (etwa Magnetic Potion), sollen gar
nicht erst spielbar sein. Draw-Lock sorgt da schon fuer."

Zwei automatisch erkannte Modul-Flaggen, Bauform von `detectDrawOnly`:

| Flagge | Karte sucht nur im … | gesperrt ab |
|---|---|---|
| `blockedBySearchLock` | **Deck** | schwacher Stufe |
| `blockedBySearchLockDiscard` | **Ablagestapel** | starker Stufe |

**★ WARUM ZWEI FLAGGEN:** die schwache Sperre laesst den Ablagestapel
offen. Eine Karte, die nur dort sucht („Elixir of Mana", „Boomerang"),
bleibt darunter voll spielbar und darf NICHT ausgegraut werden. Mit
einem einzigen Flag waere das nicht ausdrueckbar gewesen — meine erste
Fassung hatte genau diesen Fehler.

**★ ZWEI FEHLKLASSIFIKATIONEN der ersten Fassung**, beide beim
Durchsehen der Trefferliste gefunden:
* **Misfire** negiert ein Artefakt — `negateChainLink` fehlte in der
  Ausschlussliste;
* **Shard of Chaos** loescht Handkarten — die Loesch-Aufrufe fehlten
  ebenfalls.

Beide waeren unter der Sperre faelschlich unspielbar geworden. **Die
Trefferliste einer Autoerkennung IMMER durchlesen**, statt nur die
Gesamtzahl zu pruefen: eine zu grosse Liste macht Karten tot, und das
faellt im Spiel erst auf, wenn jemand sie spielen will.

Eine Karte, die AUCH zieht, bleibt spielbar — ihr Zieh-Teil wirkt
weiter. Kreaturen sind ausgenommen, gleiche Begruendung wie beim
Zieh-Lock: Koerper, HP und Trigger ueber den Such-Effekt hinaus.

Verdrahtet an denselben fuenf Stellen wie `blockedByDrawLock`:
`validateActionPlay`, die Ability-Aktivierungsliste, beide
Server-Validierungen, die Ausgrau-Liste `searchLockBlockedCards` im
Sync und die Handkarten-Optik im Client.


## Neue Karte: „Cats of the Pharaoh" (v1068) — NEUE SPIELER-SPERRE

```
Creature · Normal · Summoning Magic Lv1 · 10 HP
At the start of your turn, if you control no Creatures, you may summon
this Creature from your discard pile as an additional Action, but if you
do, you cannot search or add cards to your hand for the rest of the turn
afterwards (but you can still draw).
```

**★ DRITTE HAND-SPERRE, und die genaue Ergaenzung zu den beiden
vorhandenen:**

| Flagge | sperrt Draws | sperrt Suchen/Adds |
|---|---|---|
| `handLocked` | ja | ja |
| `drawLocked` (Sacred Jewel) | ja | nein |
| **`searchLocked`** (v1068) | **nein** | **ja** |

Genau diese Kombination fehlte. Der Riegel sitzt in
`_engine.js#_isSearchBlocked(pi, opts, quelle)`; die Karte setzt nur das
Flag. Zurueckgesetzt wird es am Zugwechsel, neben `drawLocked`.

**★ ZWEI STUFEN, weil „Siege" die staerkere braucht** (Al 14.9.: „aber
eine staerkere Version, die den Discard einschliesst"):

```js
ps.searchLocked = true;                  // Deck-Suche und Adds
ps.searchLockedIncludesDiscard = true;   // zusaetzlich der Ablagestapel
```

Cats setzt bewusst nur die erste — sein Ablagestapel bleibt offen.

**★ FALLE BEIM VERDRAHTEN, einmal hineingetappt:** `addFromPileToHand`
sieht aus wie das Tor fuer „aus der Ablage auf die Hand", ist es aber
nicht — fuer `pile === 'discard'` **delegiert es vorher** an
`addCardFromDiscardToHand` und erreicht seine eigene Pruefung nie. Der
Riegel gehoert in die zweite Methode. Der Test fand das sofort; wer nur
die offensichtliche Stelle belegt, baut eine Sperre, die still nicht
greift.

**„but if you do"** — der Preis faellt NUR bei geglueckter Beschwoerung
an. Lehnt der Spieler ab oder scheitert ein Gatter, bleibt die Sperre
aus und die Karte liegt weiter in der Ablage (Thep-Muster: bei
abgelehnter Beschwoerung zurueck in den Stapel, damit niemand still eine
Karte verliert).

**„if you control no Creatures"** zaehlt ueber `controller`, nicht
`owner` — eine per Cross-Side-Platzierung in der Gegnerspalte liegende
eigene Kreatur zaehlt mit. Verdeckte Surprises zaehlen nicht.

**Oberflaeche:** beide Flaggen gehen im Sync mit, und der Client zeigt
ein eigenes Abzeichen, das ausdruecklich nennt, ob der Ablagestapel
mitgesperrt ist — das ist der einzige sichtbare Unterschied der starken
Stufe.

**★ TESTFALLE:** eine ERLAUBTE Deck-Suche oeffnet ein Aufdeck-Fenster.
Ohne `promptGeneric`-Stub wirft der Aufruf, und weil die Suite in einer
async-Kette lief, brach sie ab diesem Punkt STILL ab — die restlichen
Faelle sahen aus, als gaebe es sie nicht. Seitdem faengt der Pruefstand
`unhandledRejection` ab und meldet es laut.


## ★ „Vom Gegner getroffen": EIN Helfer, vier Wege (v1067)

Al 14.9.: „Warum dann nicht das Buff-System so erweitern, dass die
Quelle immer mitgegeben wird? … Es gibt ziemlich sicher schon andere
Effekte, die auf jeden Hit reagieren — da muss auch das neue
On-Buff-System benutzt werden."

**Beides stimmte.** „Charm of Balance" traegt woertlich denselben
Trigger wie „The Stormblade" („Whenever that Hero is affected by an
opponent's card or effect") und lauschte nur auf ZWEI der vier Wege —
Schaden und Status. **Gegnerische Heilungen und Buffs liefen daran
vorbei**, obwohl der Kartentext sie einschliesst.

**`cards/effects/_affected-shared.js`** ist jetzt die einzige Stelle,
die die vier Hook-Formen kennt:

```js
const { trefferHooks } = require('./_affected-shared');
...trefferHooks(holeHeld, async (ctx, verursacher) => { … })
```

| Weg | Hook | feuert |
|---|---|---|
| Schaden | `afterDamage` | Schaden ist gelandet |
| Heilung | `afterHeal` | Heilung ist gelandet |
| Status | `onStatusApplied` | Status liegt an |
| Buff | `afterBuff` | Buff liegt an (v1066 neu) |

Jeder Hook liefert Ziel und Quelle in einer ANDEREN Form; wer den
Trigger nachbaut, muss die Formen nicht mehr kennen. Beide Karten
benutzen den Helfer, koennen also nicht wieder auseinanderlaufen.

## ★ QUELLE IST PFLICHT — und ein Waechter haelt das (v1067)

Die Lücke war messbar: von 14 `actionAddBuff`-Aufrufen gab genau EINER
eine Quelle mit. Ohne sie kann kein „affected by an OPPONENT's card or
effect"-Effekt entscheiden, ob er ausloesen darf — und schweigt dann
lieber, was den Kartentext still unvollstaendig macht.

**Nachgeruestet:** alle 14 Buff-Aufrufe (`sourceOwner`) und die
verbliebenen Status-Aufrufe ohne Quelle (`appliedBy`). Bei Status war
die Lage besser als befuerchtet — 77 von 95 hatten sie schon.

**`scripts/check-effect-source.js`** verlangt sie ab jetzt bei jedem
Helden-Buff und -Status. `source: 'Kartenname'` genuegt NICHT: daraus
folgt keine Seite. Durchreicher (`...opts`) und generische Trichter
stehen in einer benannten Ausnahmeliste.

**★ ZWEI FEHLER IM WAECHTER SELBST, beide beim ersten Lauf gefunden:**
1. Die Kurzschreibweise `appliedBy,` (ohne Doppelpunkt) galt als
   „keine Quelle" — vier Fehlalarme.
2. Die Zeilennummern zeigten auf unbeteiligten Code, weil das
   Kommentar-Strippen die Positionen verschob. Jetzt werden Kommentare
   durch gleich lange Leerzeichen ersetzt, damit die Offsets stimmen.
   **Ein Waechter, der die falsche Zeile nennt, schickt die Suche in
   die Irre und ist schlimmer als keiner.**

**Feinheit bei Anti Magic:** bei der AUFFRISCHUNG des `magic_immune`-
Buffs ist die Quelle nicht der Held-Besitzer, sondern der urspruengliche
Wirker — er steht am Zaehler `antiMagicCastBy`. Neuer Helfer
`highestRemainingCastBy` waehlt ihn nach DERSELBEN Instanz wie
`highestRemainingLevel`, damit Stufe und Wirker zusammenpassen. Ohne das
saehe „Charm of Balance" eine Auffrischung der EIGENEN Anti Magic als
Gegner-Treffer.


## „The Stormblade" ausgebaut (v1066) — war nur ein STUB

Die Datei trug bis dahin allein `equipOwnSideOnly`; der gesamte Effekt
fehlte. **Beim Abarbeiten einer Kartenliste also zuerst pruefen, ob eine
vorhandene Datei die Karte wirklich implementiert** — eine Datei zu
finden heisst nicht, dass es den Effekt gibt.

**★ „These draw effects cannot be prevented" schliesst den
SPIELER-STATUS ein** (Als Ruling 14.9.), nicht nur abfangende
Karteneffekte. Der Vertrag dafuer existiert:
`actionDrawCards(..., { _unpreventable: true })` umgeht `handLocked`,
`drawLocked` UND den `BEFORE_DRAW_BATCH`-Hook, ueber den Karten wie
Intrude eine Ziehung abfangen. „Champion, the Stormbringer" benutzt ihn
fuer dieselbe Textzeile.

**★ „HITS … WITH A CARD OR EFFECT" = ALLES, was den Helden erreicht**
(Als Ruling 14.9.): Schaden, Heilung, Buffs, Debuffs — nicht nur
Schaden. Vier Hooks, die erst feuern, wenn etwas WIRKLICH angekommen
ist: `afterDamage` · `afterHeal` · `onStatusApplied` · `afterBuff`.

**NEU: `afterBuff` (v1066).** Fuer Buffs gab es nur das abbrechbare
`BEFORE_HERO_EFFECT` — wer dort lauscht, zaehlt auch Buffs mit, die
spaeter noch abgebrochen werden. Der neue Hook ist das Gegenstueck zum
vorhandenen `afterHeal` und feuert, wenn der Buff liegt.

**★ GRENZE: `actionAddBuff` nimmt KEIN Quellen-Argument** (der Kommentar
in der Kreatur-Fassung sagt das ausdruecklich). Ein Buff loest den Sturm
deshalb nur aus, wenn der Aufrufer `opts.sourceOwner` / `opts.source`
mitgibt. Bewusst diese Richtung: lieber einmal NICHT ausloesen als beim
eigenen Staerkungszauber.

**Bei leerer Hand loest die Karte gar nicht aus** (Als Ruling 14.9.) —
nicht „mischt nichts und zieht null".

Der Zyklus selbst ist der Weg von „Elana, the Rocky Rebel", inklusive
ihrer beiden teuer gelernten Feinheiten: `shuffleBackEligibleHandCards`
filtert Hatusbal-gesperrte Karten und gezogen wird, was TATSAECHLICH
zurueckging; Karten aus dem POTION-Deck werden auch von dort
nachgezogen. Dazu ein Re-Entranz-Riegel — der Zyklus zieht Karten, und
Ziehen kann Effekte ausloesen, die den Helden treffen.

**★ TESTFALLE, einmal hineingetappt:** „nach dem Zyklus sind alle
Handkarten neu" ist KEINE gueltige Zusicherung. Die Hand wird
ZURUECKGEMISCHT und kann dieselben Karten wieder ziehen — der Test
schlug zwischen Laeufen mal an, mal nicht. Belastbar ist die BILANZ:
Hand wieder gleich gross, Deck gleich gross, Hand+Deck dieselbe
Kartenmenge wie vorher.


## Neue Karte: „Life Serum" (v1064) — inkl. cards.json

```
Potion · Normal
Choose any target on the board and increase its current and max HP by 150.
```

**v1065 (Als Balanceaenderung 14.9.):** Life Serum 200 → **150**,
Healing Potion 200 → **250**. Beide Betraege stehen jetzt als EINE
benannte Konstante im Skript (`HP_GAIN` / `HEAL_AMOUNT`) — bei Healing
Potion lag der Wert vorher als Literal an VIER Stellen (Beschreibung,
Helden-Heilung, Kreaturen-Heilung, Log). Genau so entsteht eine Karte,
deren angezeigter Text nicht mehr zu ihrer Wirkung passt; ein Testfall
haelt beides jetzt gegeneinander.

**cards.json geaendert:** Subtyp **Reaction → Normal**, und der alte
Text („Play this card immediately when either player activates a
Potion…") ist ersetzt. Die Karte ist damit eine normale Potion mit
Zielwahl, kein Reaktionsfenster mehr.

**★ DIE ARBEIT MACHT `engine.increaseMaxHp(ziel, HP_GAIN)`** — der Helfer
deckt BEIDE Zielarten ab und kennt die Feinheiten, die man von aussen
leicht falsch macht:

* **Helden:** `maxHp` UND `hp` steigen, und `maxHpCapped` wird beachtet.
  Der Helfer meldet zurueck, wie viel wirklich ankam — bei einer
  Deckelung auch 0.
* **Kreaturen:** `counters.maxHp` / `counters.currentHp` statt der
  Kartendaten, und zwar BEIDE um den vollen Betrag. Das ist Absicht und
  traegt den Nao-Ueberheil-Fall: `currentHp` darf `maxHp` uebersteigen.

Ein eigener Rechenweg in der Karte waere genau die Dublette, die bei der
naechsten HP-Regel ausschert.

**★ KEIN Ausschluss der rundengeschuetzten Seite**, anders als bei der
Vorlage „Acid Vial". Der Erstrundenschutz haelt SCHADEN ab; hier wird
niemand angegriffen, sondern beschenkt. Die Vorlage zu uebernehmen
haette ihre FORM kopiert statt ihrer BEGRUENDUNG. „Any target on the
board" heisst zudem woertlich beide Seiten — die Karte kann dem Gegner
nuetzen, das steht so im Text.

**★ ANIMATIONSTYP AUS DEM REGISTER NEHMEN.** Ein `animationType`, der
nicht im Zonen-Register von `app-board.jsx` steht, tut STILL gar nichts
— der Fehler faellt erst im Spiel auf. Erste Fassung hatte sich
`heal_glow` ausgedacht; es gibt nur `healing_hearts`. Beim Bauen einer
Karte immer gegen das Register pruefen (ein Testfall haelt das hier
fest).


## ★ Abfliegende Handkarte: der Schluessel zeigte nach dem Nachruecken
## auf die falsche Karte (v1063, Als Befund 14.9.)

**Der Befund:** „Spiele ich Book of Doom, wird die Karte, die in dessen
Handposition nachrueckt, kurzzeitig unsichtbar, waehrend Book zum
Discard fliegt."

**Kein neuer Fehler — er stammt aus v1036** und betrifft JEDEN
Hand-Abflug, nicht nur Book of Doom: Off Duty, Lunar Eclipse, Key, jede
Karte, die aus der Hand auf einen Stapel fliegt.

**Die Ursache:** der Verdeckungs-Schluessel war rein POSITIONELL
(`${owner}-${handIdx}`) und wurde 700 ms lang gehalten. Der Sync
entfernt die abfliegende Karte aber SOFORT, die folgenden ruecken nach —
ab da verdeckte derselbe Schluessel die nachgerueckte Karte.

**★ DIE WARNUNG STAND SCHON IM CODE.** Im Kommentar darueber:
„ein stehengebliebener Schluessel wuerde nach dem Nachruecken die
FALSCHE Handkarte verdecken." Die Antwort darauf war eine Zeitschranke
von 700 ms — die aber genau so lang laeuft wie der Flug, waehrend das
Nachruecken viel frueher passiert. **Eine erkannte Gefahr mit einem
Zeitgeber zu beantworten heisst, auf ein Rennen zu setzen.**

**Der richtige Bau lag direkt darunter:** `bounceOutgoingHidden` fuer
Support-Zonen haengt seit jeher den KARTENNAMEN an den Schluessel und
verdeckt nur, solange der Platz dieselbe Karte zeigt.

Ueber den Namen geht es in der Hand nicht — die GEGNERHAND kennt keine
Namen, dort liegen Rueckseiten. Stattdessen traegt der Schluessel jetzt
die HANDGROESSE beim Abflug (`${owner}-${idx}#${handLen}`): schrumpft
die Hand, passt er nicht mehr und die Verdeckung faellt von selbst weg,
ohne auf den Zeitgeber zu warten. Dieselbe Bauform wie die
Zaehler-Absicherung von `stealHiddenOpp` daneben.

**Die ANKOMMENDEN Reservierungen** (Kassaran, Geburtstagsgeschenk)
benutzen weiterhin den schlichten Schluessel — dort ist der Platz leer,
bis die Karte landet, ein Nachruecken gibt es nicht.


## ★ Kartenfluege: eigene Zeichenebene (v1062, Als Befund 14.9.)

**Der Befund:** „Der Flug von Karten zum Discard Pile sieht minimal
ruckelig aus" — in Opera OHNE Grafikbeschleunigung, in Firefox fluessig.

**★ UND GENAU DESHALB WURDE ES GEAENDERT.** Al testet bewusst im
Software-Rendering, als Fruehwarnsystem fuer zu teure Stellen. „Laeuft
auf der GPU fluessig" heisst nur, dass die Karte den Aufwand kaschiert,
nicht dass er noetig ist. Das Warnsystem hat angeschlagen, also war es
eine echte Meldung — nicht bloss eine Umgebungsfrage wie im v472-Fall.

**Was die Flugkarte je Frame kostete:** ein `<img>` mit `object-fit`,
eine `border-radius`-Beschneidung, ein weicher `box-shadow`-Schein — und
darueber eine `scale()`-Fahrt von 1 → 1.08 → 0.92 → 0.7. Ohne eigene
Ebene wird dieser ganze Teilbaum in JEDEM Frame neu gerastert, statt
einmal gerastert und dann nur noch transformiert zu werden. Die
Keyframes selbst waren schon sauber (nur `transform`/`opacity`) — die
Kosten lagen NICHT in der animierten Eigenschaft, sondern darin, was
unter ihr liegt.

Neue Regeln `.card-flight` und `.card-flight-tilt` in `style.css`. Die
Klasse haengt bereits an allen neun Flugstellen (Ablage, Deck, Hand,
Support, Coolness-Stack); EINE Regel deckt sie alle ab. Die
Neigungsebene bekommt ihre eigene, weil sie ein zweites,
VERSCHACHTELTES `rotateX` innerhalb der beschnittenen Flugkarte faehrt —
die teuerste Einzelstelle des Fluges.

**★ ABGRENZUNG ZU v811** („KEIN `will-change` bei 160 Teilchen"): dort
waeren es 160 DAUERHAFTE Ebenen gewesen. Eine Flugkarte lebt 700 ms, und
es fliegen selten mehr als eine Handvoll gleichzeitig. **Die Regel
lautet nicht „nie will-change", sondern „Kosten × Anzahl ×
Lebensdauer"** — dieselbe Denkweise wie die v470-Lehre („der Unterschied
ist nicht die Eigenschaft allein, sondern Eigenschaft × Anzahl").

Dazu die Startkoordinaten des Ablage-Fluges auf ganze Pixel gerundet:
`getBoundingClientRect()` liefert fast immer gebrochene Werte, und
zusammen mit der `scale()`-Fahrt muss die Kartenkunst sonst bei jedem
Frame zwischen Pixeln interpoliert werden. Das Ziel verschiebt sich
dadurch um hoechstens einen halben Pixel.


## ★ „Interference": die ZWEITE Luecke (v1060, Als Befund 14.9.)

**Der Befund:** „Interference funktioniert noch nicht gegen Book of
Doom (was bei 2+ Zielen auch AoE ist)."

Der v1043-Durchgang hatte Karten mit eigenem **SCHADENSWEG** erfasst.
Book of Doom hat aber einen eigenen **ZIELWÄHLER**: `maxTotal` laesst
den Spieler mehrere Ziele picken, danach teilt die Karte den Schaden
selbst aus. Genau diese Gattung fehlte.

```js
engine.beginMultiHit(targets.length);   // die ECHTE, gewaehlte Zielmenge
try { …Helden einzeln, Kreaturen im Stapel… }
finally { engine.endMultiHit(); }
```

Die Klammer umschliesst BEIDE Wege, weil auch Kreaturen zur Zielzahl
zaehlen — „hits other targets in addition to it" ist egal welcher Art.
Bei EINEM gewaehlten Ziel bleibt es ein Einzeltreffer und der Schutz
greift korrekt nicht; beides ist nachgemessen.

**★ MERKMAL FUER DIE SUCHE nach weiteren Luecken:** nicht „teilt die
Karte Schaden selbst aus?", sondern **„kann EIN Einsatz dieser Karte
mehrere Ziele treffen?"** — also `maxTotal` / `maxSelect` groesser als
1 mit eigenem Schaden dahinter.

**Nachgezogen (v1061, Als Rulings 14.9.)** — fuenf weitere Karten
klammern jetzt: Future Tech Bazooka (ab 2 Zielen), Future Tech Fists,
Gathering Storm, Guardian Beast Hou, Kit the Shark Researcher.

**★ AUSDRUECKLICH NICHT: „Sword in a Bottle".** Dort waehlt der Spieler
den ANGREIFER und das eine Ziel — `maxSelect: 2` meint also zwei
Rollen, nicht zwei Opfer. Ein Beispiel dafuer, dass die Zahl im
Zielwaehler allein nichts beweist: geprueft gehoert, WEN sie zaehlt.


## ★ Tooltip-Breite vom Einklapp-Zustand entkoppelt (v1060)

Der Kartentooltip misst seine Breite an `.chat-log-column`. Seit Log und
Chat standardmaessig eingeklappt starten (v1056), mass er die 28 px der
zusammengeschobenen Leiste — der Tooltip war ein Streifen.

Al 14.9.: „Die Bounds des AUFGEKLAPPTEN Fensters sind die ideale Breite,
aber der Tooltip soll NICHT daran gebunden sein, ob es aufgeklappt ist."

Gerechnet wird jetzt vom RECHTEN Rand der Spalte (der sich beim
Einklappen nicht bewegt) plus der ausgeklappten Breite. Die kommt aus
der letzten Messung im ausgeklappten Zustand; gab es die nie — und seit
v1056 ist das der Normalfall —, aus `--chat-col-w`, am Element gelesen,
damit eine responsive Ueberschreibung mitgenommen wird. Im ausgeklappten
Zustand ist das rechnerisch exakt das alte Ergebnis.


## Neue Karte: „Trunk Sand" (v1058) — NEUE STATUS-ABLAUFFORM

```
Attack · Normal · Fighting Lv1
Choose a target and deal damage equal to the attacker's Attack stat to
it and Blind it until the next time it takes damage.
```

**★ DRITTE ABLAUFFORM: `untilDamaged`.** Neben `duration: n` („haelt n
Runden") und `expiresAtTurn` („laeuft in Zug X aus") gibt es jetzt „bis
zum naechsten Schaden".

**★ EINE STELLE FUER ALLE DREI SCHADENSWEGE.** Abgeraeumt wird in
`_noteDamageTaken` — dem Helfer, den Helden-Schaden, True Damage und der
Kreaturen-Stapel ohnehin alle drei aufrufen, und zwar **nur bei
`amount > 0`**. Damit stimmt „nimmt Schaden" von selbst: ein
vollstaendig weggedrueckter Treffer (Spectral Armor, „Interference",
„Energy Aura") loest den Status NICHT. Das ist nachgemessen, nicht
behauptet — der Pruefstand faehrt einen Interference-Lv2-Treffer dagegen.

**Zwei Speicherformen, weil Status je nach Traeger anders liegen:**

| Traeger | Ablage | Merkmal |
|---|---|---|
| Held | `statuses[name]` ist ein OBJEKT | `untilDamaged: true` reist mit den opts mit |
| Kreatur | `counters[name] = 1`, blosse Praesenz-Flagge | Begleitzaehler `counters[name + 'UntilDamaged']` |

Die Kreaturen-Form folgt der vorhandenen Konvention neben
`…Duration` / `…AppliedBy`; beim Abraeumen fallen die Begleiter mit,
sonst bliebe Kram liegen.

**★ GRENZE, bewusst in Kauf genommen:** das Entfernen laeuft direkt und
feuert KEINE `onStatusRemoved`-Listener — `_noteDamageTaken` ist
synchron und steckt mitten im Schadenspfad. Heute nutzt nur `blinded`
diese Form, und darauf hoert nichts. Bekommt ein Status mit
Abgangs-Effekt spaeter `untilDamaged`, gehoert das Entfernen an die drei
Aufrufstellen mit `await`.

**★ REIHENFOLGE IN DER KARTE: erst Schaden, DANN blenden.** Andersherum
haette der eigene Treffer die Blendung im selben Atemzug wieder
abgeraeumt — der Kartentext waere wirkungslos gewesen.

**Attack stat, nicht base ATK.** „Ferocious Tiger Kick" (dieselbe
Bauform, dieselbe Schule) sagt ausdruecklich „base Attack stat" und
liest `hero.baseAtk`; hier steht „the attacker's Attack stat", also
`hero.atk` samt Buffs und Ausruestung. Die beiden Formulierungen sind im
Bestand bewusst verschieden — beim Nachbauen immer den Text lesen.

**Blinded auf KREATUREN.** Die Engine hatte den Fall schon vorgesehen
(`inst.counters?.blinded`, mit dem Kommentar „a future card may apply
that"); Trunk Sand ist diese Karte.

**Animation „Pocket Sand":** `play_projectile_animation` mit
`projectileShape: 'sand'` wirft eine Handvoll gelb-brauner Koerner vom
Anwender zum Ziel, danach `sand_burst` als Staubwolke am Einschlag
(neuer Eintrag im Zonen-Animationsregister plus Keyframes).

**★ KEIN EMOJI** (Als Befund 14.9.: „kein Oasen-Emote!"). Die
Erstfassung warf 🏜️ — das zeigt eine Oase, nicht geworfenen Sand.
Dieselbe Begruendung wie bei der Energieblase daneben: Emojis sind
plattformabhaengig eingefaerbt und lassen sich nicht tinten. Wer ein
gefaerbtes oder abstraktes Projektil braucht, nimmt `projectileShape`
(`bubble`, `javelin`, `arrow`, `sand`) statt eines Emojis.


## ★ ZWEI BLENDUNGS-ARTEN (v1059, Als Befund 14.9.)

**Der Befund:** der Tooltip der Trunk-Sand-Blendung behauptete weiter
„bis zum Ende der Gegnerrunde" — der Text der Smoke-Vial-Variante.

**Die Ursache war nicht der Tooltip, sondern das Datenmodell:** beide
Karten schrieben in DASSELBE `statuses.blinded`. Ein Statusobjekt kann
aber nur EINE Endbedingung tragen, die zweite Anwendung haette die
erste ueberschrieben — und welche laenger haelt, ist nie vorher klar.
Al: „theoretisch koennen auch beide Blinds gleichzeitig anliegen".

Deshalb ein EIGENER Status `blinded_hit` neben `blinded`. Beide wirken
identisch, beide tragen `blocksTargeting: true`, beide sind cleansable
und teilen `blind_immune`. Nur ihr Ende unterscheidet sich.

**★ EINE FRAGE, ZWEI STATUS.** Wer „ist geblendet?" fragt, fragt nicht
mehr `statuses.blinded`:

```js
const { BLIND_STATUSES } = require('./_hooks');   // ['blinded','blinded_hit']
engine._isHeroBlinded(pi, heroIdx)
engine._isCreatureBlinded(inst)
```

**Zwoelf Lesestellen in der Engine** haetten sonst still nur die erste
Art gesehen — der Held waere geblendet gewesen und haette trotzdem
zielen duerfen. Genau dafuer gibt es die gemeinsame Liste; eine neue
Blendungs-Art braucht kuenftig nur dort einen Eintrag.

Die Rundenende-Abrechnung fasst weiterhin NUR `blinded` an —
`blinded_hit` hat kein Rundenende und faellt ausschliesslich ueber
`untilDamaged`. Im Client sind es zwei Abzeichen (👁️ mit Dauer, 🌫️
mit „until this target next takes damage").


## Neue Karte: „Enhanced Guard Dog" (v1057) — inkl. cards.json

```
Creature · Reaction · Summoning Magic Lv1 · 50 HP
Immediately summon this Creature as an additional Action when exactly 1
card from your side of the board would be sent to the discard pile by an
opponent's card or effect. Negate that card or effect.
```

**★ DIE GANZE ABGRENZUNG STECKT IN DER WAHL DER STELLE.** Das Fenster
haengt an `actionDestroyCard` — und daraus folgen BEIDE Rulings ohne
eine einzige Sonderregel:

* **„NUR direkte Zerstoerung, NICHT Tod durch Schaden"** (Als
  wichtigstes Ruling 14.9.): der Schadenstod routet seinen Tod im
  Schadens-Batch und kommt hier nie vorbei. Das steht im Code sogar
  schon als Begruendung am Cosmic-Depths-Fenster.
* **„sent to the DISCARD PILE"**: `actionDestroyCard` routet IMMER in
  die Ablage. „Tengu Windstorm" schickt ins DECK und loest deshalb
  korrekt nicht aus (Als Befund 14.9.).

**★ UMGEKEHRT BEWUSST NICHT AN `actionMoveCard`**, obwohl auch dort
Karten in die Ablage wandern: genau dort laeuft der Schadenstod durch.
Wer dieses Fenster spaeter „vollstaendiger" machen will, hebelt damit
das Kern-Ruling aus.

**Vertrag am Kartenskript:**

```js
isDestroyReaction: true
destroyReactionCondition(gs, pi, engine, lage) → bool
async onDestroyReaction(engine, pi, lage) → bool   // true = negiert
```

`lage` traegt `victimSide`, `victimName`, `victimZone`, `victimInst`,
`sourceName`, `sourceOwner`. Seiten-Pruefung („by an OPPONENT's card")
und Einzelzerstoerung erledigt das Fenster; die Karte prueft nur ihr
Eigenes. Ohne freie Support-Zone kann der Dog nicht reagieren — ohne
Beschwoerung keine Negation (Als Bestaetigung 14.9.).

**Deckt jede Zone ab** — Support, Ability, Area, Surprise, Permanent.
**Helden NICHT:** Al hatte sie zunaechst eingeschlossen, der finale Text
sagt aber „sent to the discard pile", und eine Helden-Niederlage schickt
keine Karte in die Ablage. Der Zweig waere nicht bloss ungenutzt,
sondern falsch gewesen — er haette Insta-Kills geblockt.


## ★ ZERSTOERUNGS-KLAMMER `beginDestroyScope` (v1057)

Gegenstueck zu `beginMultiHit`. „exactly 1 card" laesst sich nicht aus
`actionDestroyCard` ablesen: der laeuft je Karte einzeln und wuesste
beim ersten Opfer nichts vom zweiten. Ein Effekt, der mehrere Karten
abraeumt, klammert deshalb seine Schleife:

```js
engine.beginDestroyScope(opfer.length);
try { …zerstoeren… } finally { engine.endDestroyScope(); }
```

Verschachtelbar (Tiefenzaehler), im `finally` zu loesen — sonst bliebe
sie stehen und ALLE folgenden Einzelzerstoerungen waeren stumm.
`istEinzelzerstoerung()` ist die Frage, die das Fenster stellt; ohne
Klammer lautet die Antwort „ja".

**Zwoelf Karten klammern** (Stand v1057): Anti Magic, Berserk, Blind
Destruction, Burning Fuse, Censpartan War Counselor, Crusader's
Cutlass, Curse, Sun Beam, The Shapeshifter, Trial of Dominance, Troop
Annihilation, das Spider-Modul. **Bewusst NICHT geklammert:** „Super
Killing Knife" — es zerstoert je gelandetem Treffer EINZELN, jede
Zerstoerung ist dort also wirklich eine.

**Fuer Zaehlungen gilt die ECHTE Zielmenge**, nicht die geplante —
Sun Beam und Censpartan klammern die GEWAEHLTEN Ziele, bei genau einem
darf der Dog also feuern. Gleiche Lehre wie bei „Interference".


## ★ „Negate that card" — WAS genau faellt weg (v1057, Als Regel 14.9.)

**Die ganze Karte, ausser was schon resolved ist — und gemeint ist
LOGISCHE Abhaengigkeit, nicht Code-Reihenfolge.**

* „Deal 150 damage. If this kills, remove 1 card" → der Schaden MUSS
  vorher gefallen sein, damit das Removal ueberhaupt ausloest. Er bleibt
  stehen, nur das Removal faellt weg.
* **The Yeeting** → der 150er-Recoil ist KEINE Voraussetzung fuer die
  Zerstoerung, er stand nur zufaellig zuerst im Code. Al 14.9.: „Aus
  Benutzer-Sicht passieren Recoil und Removal gleichzeitig", und eine
  Negation nimmt beides.

Automatisch ableiten laesst sich das nicht. **Die Regel ist eine
PLATZIERUNGS-Frage je Karte:** das Fenster gehoert an die Stelle, an der
die Karte logisch noch nichts getan hat. Bei The Yeeting ist es deshalb
VOR den Recoil gezogen worden, damit Code- und Wirkungsreihenfolge
uebereinstimmen. Wer eine neue Zerstoerungskarte baut, stellt sich
dieselbe Frage: musste irgendetwas davor passieren, damit diese
Zerstoerung ueberhaupt ansteht?

Die Negation selbst laeuft ueber `gs._spellNegatedByEffect`, die
vorhandene kanonische Marke; `actionDestroyCard` kehrt ohnehin sofort
zurueck.


## ★ Area-Limit: der ZWEITE Funnel (v1055, Als Befund 14.9.)

**Der Befund:** „Entferne ich Crevice und habe danach noch 2 Areas,
werde ich NICHT aufgefordert, eine zu waehlen."

**Zwei Fehler gleichzeitig, beide sehenswert.**

**① Der falsche Funnel.** `enforceAreaLimit` hing nur am Ende von
`removeArea`. Eine ZERSTOERTE Area laeuft da aber nicht durch:
`actionDestroyCard` routet sie als area→discard durch
**`actionMoveCard`** (The Yeeting, Hammer Skeleton, jede kuenftige
Zerstoerung). Die Obergrenze fiel also genau dann aus, wenn sie
gebraucht wird. Der Aufruf steht jetzt zusaetzlich am Ende von
`actionMoveCard` — direkt neben der reaktiven Handkarten-Grenze, die aus
demselben Anlass dort sitzt: eine Karte verlaesst das Brett und senkt
dadurch eine Obergrenze.

**② Der Rueckfall im Kartenskript war stiller Schrott.** Spatial Crevice
hatte einen `onCardLeaveZone`-Haken als Netz. Er hat nie gegriffen:

* Der Leave-Hook feuert **VOR** dem Zonenwechsel. Die Karte stand also
  noch in `areaZones`, das Limit war noch 3, und die Pruefung „zu
  viele?" sagte voellig korrekt nein.
* Der Ausweg dagegen — `queueMicrotask` plus ein Promise ohne `await`
  und mit leerem `catch` — lief immer noch VOR den offenen `await`s des
  Umzugs. Und haette er geworfen, haette es niemand erfahren.

Der Haken ist ersatzlos raus. **Ein abgekoppelter async-Aufruf in einem
Hook ist die Bauform, die Fehler verschluckt statt sie zu zeigen** — wer
nach dem Zonenwechsel arbeiten muss, gehoert an die Stelle, die den
Wechsel vollzieht, nicht in einen Hook davor.

**Lehre:** bei einer reaktiven Regel reicht es nicht, EINEN Weg zu
decken. Die Frage ist immer „welche Wege fuehren hier heraus?" — fuer
Areas sind es zwei: `removeArea` (der benannte Weg) und `actionMoveCard`
(jeder generische). Mein Prueflauf hatte nur den ersten getestet und war
deshalb gruen, waehrend das Spiel den zweiten ging.


## ★ Area-ZIELWAHL im Stapel (v1054, Als Befund 14.9.)

**Der Befund:** „Ich wollte per The Yeeting gezielt Crevice zerstoeren,
stattdessen traf es den obersten Area-Spell."

**Die Ursache war NICHT The Yeeting**, sondern ein Filter im Ziel-Sammler
`_targeting-shared.js#collectNonHeroBoardTargets`:

```js
// alt:
if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
// Begruendung im Code: „die BoardZone zeigt ohnehin nur den obersten"
```

Seit „Spatial Crevice" zeigt sie ALLE. Die unteren Areas waren damit
nicht bloss schwer zu treffen — sie standen gar nicht im Angebot, und
es gab nur EINE Ziel-ID je Seite (`area-<owner>`). Die Auswahl konnte
also nur auf der obersten landen.

**Dieselbe Annahme steckte in NEUN Dateien** — `_targeting-shared`,
`_sparkfly-shared`, Coolness Overcharge, Excavator Bucket, Hammer
Skeleton, Kappa Sword Slash, Smug Mastermind Antonia, Sun Beam, Tengu
Windstorm, Wall Breaker General Ralzish. Jede baute ihre ID selbst
zusammen und filterte selbst. Jetzt gibt es EINE Stelle:

```js
const { areaTargetId } = require('./_targeting-shared');
areaTargetId(owner, stapelPlatz)   // → `area-<owner>-<platz>`
```

**★ WARUM DER STAPELPLATZ IN DIE ID MUSS:** `gs.areaZones` ist eine
NAMENSLISTE — der Client kennt keine Instanz-IDs. Ohne den Platz koennte
er zwei Eintraege nicht auseinanderhalten. Er baut dieselbe ID aus
seinem Render-Index; beide Seiten indizieren dieselbe Liste, die Indizes
stimmen also ueberein. Jedes Ziel traegt den Platz zusaetzlich als
`slotIdx`.

**Client (v1054):** Zielwahl und Klick gehoeren jetzt der KARTE, nicht
der Zone — genauso wie schon Tooltip und Aktivierung. Die Zone markiert
nur noch, dass dort etwas waehlbar ist; ein Zonen-Klick fuer die
Zielwahl gibt es nicht mehr, weil sich daraus bei drei Areas nicht
ablesen liesse, welche gemeint ist.

**Lehre:** „die Oberflaeche zeigt ohnehin nur X" ist eine Begruendung
mit Verfallsdatum. Sie stand hier als Kommentar im Code und war beim
Schreiben richtig — der Filter ueberlebte die Oberflaechen-Aenderung um
genau eine Version.


## Neue Karte: „Energy Aura" (v1053) — SPELL-SCHILD, inkl. cards.json

```
Spell · Attachment · Support Magic Lv1
Attach this card to a Hero you control. Negate the next time the Hero
this card is attached to would be affected by a Spell, and if you do,
send this attached card to your discard pile and draw 2 cards. A Hero
can only have 1 "Energy Aura" attached to it at a time.
```

**★ „VON EINEM SPELL BETROFFEN" HAT FUENF WEGE DURCH DIE ENGINE** —
Schaden (`actionDealDamage`), Heilung (`actionHealHero`), Buff
(`actionAddBuff`), Status (`addHeroStatus`) und NIEDERLAGE
(`actionDefeatHero`, Als Ruling 14.9.: „affect" schliesst Insta-Kills
ein). Anti Magic (`magic_immune`) musste dieselben fuenf Stellen
belegen. Eine Karte, die sich das selbst zusammenbaut, verpasst
unweigerlich einen Weg — deshalb gibt es EINEN gemeinsamen Riegel:

```js
engine.heroSpellWardBlocks(target, sourceCardName, { piercing })
```

Vertrag am Kartenskript: **`heroSpellWard: true`**. Mehr braucht die
naechste Karte dieser Bauart nicht.

**Unterschiede zu Anti Magic**, alle aus Als Rulings 14.9.:
* **keine Stufenschranke** — jeder Spell, egal welchen Levels;
* **auch EIGENE Spells** loesen aus („kann z.B. vor einem eigenen
  Cataclysm schuetzen");
* **einmalig**, und zwar zwangslaeufig beim NAECHSTEN Spell — genau das
  ist die Einschraenkung der Karte, man hat keine Wahl;
* **der Spell wird NICHT negiert**; der Held gilt weiter als getroffen,
  wie bei „Interference" Stufe 2 (vgl. die Null-Regel: getroffen heisst
  getroffen, auch mit 0 Schaden);
* bei Flaechenzaubern faellt nur die Wirkung an GENAU diesem Helden aus.

**★ PIERCING GEHT DURCH UND LOEST NICHT AUS** (Als Ruling 14.9.): ein
`cannotBeNegated`-Treffer verbraucht die Aura nicht und gewaehrt keine
Karten. Dafuer gibt es `opts.piercing`.

**★ TESTFALLE, einmal hineingetappt:** `cannotBeNegated` kommt NICHT aus
`opts` von `actionDealDamage` — die Engine setzt es selbst (Ida ueber
ihren `beforeDamage`-Hook per `ctx.setFlag`, Tempeste ueber die
zielseitige Unangreifbarkeit, Alleria ueber den Redirect). Ein Test, der
`{ cannotBeNegated: true }` uebergibt, prueft nichts und schlaegt
scheinbar die Karte fehl. Der echte Weg ist einer der drei Setzer.

**★ „ANVISIERT" IST NICHT „BETROFFEN".** Wird ein Held nur als Anker
gewaehlt, um „the Creatures in that Hero's Support Zones" zu treffen,
laeuft das gar nicht durch die fuenf Wege — die Regel ergibt sich von
allein, es braucht keine Sonderbehandlung.

**★ ABRAEUMEN ERST NACH DER AUFLOESUNG** (Als Freigabe 14.9.) — und das
ist nicht nur einfacher, sondern die einzige Fassung, die STIMMT: waere
die Karte sofort weg, kaeme der ZWEITE Effekt desselben Zaubers (Schaden
plus Status) ungebremst durch. Der Riegel merkt sich den Zauber an der
Instanz (`counters._wardSpentOn`, gleiche Bauform wie das vorhandene
`counters._skipAfterResolveName`) und blockt weiter, solange derselbe
laeuft.

Abgeraeumt wird an DREI Zeitpunkten, weil `afterSpellResolved` **nicht**
feuert, wenn der Spell unterwegs negiert wird (`_spellNegatedByEffect`):
der Normalfall plus `onTurnStart` / `onTurnEnd` als Rueckfall. Das
Abraeumen ist ueber `counters._wardSettled` idempotent — ohne den Riegel
zoege ein Ueberschneiden der drei Zeitpunkte 4 oder 6 Karten statt 2.

**cards.json geaendert:** der alte Text sagte „Attach this card to the
user" und „an OPPONENT's Spell". Beides ist weg — die Karte geht jetzt
auf jeden eigenen Helden und triggert auf jeden Spell.


## Neue Karte: „Null, the Mage Slayer" (v1044) — inkl. cards.json

Hero, 450 HP / 100 ATK, Start-Abilities **Fighting + Interference**.
„Negate the effects of any targets hit by this Hero's Attacks for
2 turns. This counts as a status effect."

**Zwei Haken, ein Vertrag:** getroffene Helden über `afterDamage`,
getroffene Kreaturen über `afterCreatureDamageBatch` — der Schadensweg
ist für beide getrennt, die Regel dieselbe (Bauform Ghuanjun).

**★ „hit by THIS Hero's Attacks" sind drei Bedingungen zusammen:**
Schadensart `attack`, Quelle gehört mir, **und** ihr `heroIdx` ist
dieser Held. Ohne die dritte würde jeder Angriff der anderen eigenen
Helden mitnegieren.

**★ GETROFFEN HEISST GETROFFEN — AUCH MIT 0 SCHADEN** (Als Korrektur
12.9.). Wer den Schaden nur wegdrückt (Spectral Armor, **Interference**,
ein Schild), wird trotzdem zum Schweigen gebracht. Nur **negierte oder
ausgewichene** Angriffe (Invisibility Cloak) bringen nichts — und die
erreichen die Haken ohnehin nie: der Schadenspfad kehrt dort
**vor** `runHooks(AFTER_DAMAGE)` zurück
(`return { dealt: 0, cancelled: true }`), und Batch-Einträge tragen
`cancelled`. Eine Betragsprüfung wäre also nicht nur falsch, sondern
auch überflüssig — `!e.cancelled` ist die ganze Trennlinie.

Weil der Text „counts as a status effect" ausdrücklich sagt, läuft die
Negierung über die STATUS-Wege (`addHeroStatus('negated')` /
`actionNegateCreature`) — damit greifen Immunitäten, „Defending the
Gate" und die Statusanzeige von selbst. Ablauf wie bei Locke:
`expiresAtTurn: gs.turn + 2`, `expiresForPlayer: pi`.

**Der Auftritt gehört dazu** (`check-triggered-reveal` hat ihn
eingefordert): einmal je Schlag, über `source` entprellt, damit ein
Batch mit drei Kreaturen nicht dreimal ankündigt. Er geht an beide
Seiten — ein passiver Trigger, kein aktiver Einsatz (Regel v1034).


## ★ Negierung: Restrunden im Badge + eigenes Bild (v1046, Als Befunde 12.9.)

**① Zwei Schreibweisen für „wie lange noch".** Die Badges kannten nur
`duration: n` („hält n Runden", Frost/Stun). Die Negierung merkt sich
ihr Ende aber als ZUG (`expiresAtTurn` + `expiresForPlayer`, so machen
es Null, Locke und Bishop) — das Badge zeigte deshalb keine Zahl und
behauptete „wears off at the end of its owner's turn", bei einer
2-Runden-Negierung schlicht falsch.

`restrunden(statusData)` versteht jetzt beides und rechnet
`expiresAtTurn` in eigene Runden um (`Math.ceil((ziel - jetzt) / 2)` —
ein Halbzug je Spieler). Den Bezugspunkt stellt das Brett global bereit
(`window._ppTurn`, gleiche Bauform wie `_ppBorisBlocked`); ohne ihn
kann eine reine Anzeigekomponente das nicht rechnen.

Das quellgebundene 🚫-Badge (Water Golem: „solange X liegt") bleibt
bewusst ohne Zahl — es endet mit der Karte, nicht mit der Zeit.

**② Silence statt Blitz.** Die Negierung zeigte `electric_strike` und
sah damit aus wie eine Betäubung. Neu ist `silence_seal`: Siegelring,
der sich zusammenzieht, aufscheinendes Verbotszeichen, dunkle Schwade
und sechs nach innen fallende Zeichen — gedecktes Violett-Grau statt
gelber Blitze. Umgestellt an drei Stellen: der Client-Pfad „Held
bekommt negiert" und **beide** Standardtabellen der Engine (Kreatur und
Held). Eine Karte kann weiterhin ihr eigenes Bild vorgeben
(`opts.animationType`).


## ★ Negierung, zweiter Durchgang (v1047, Als Befunde 12.9.)

**① Bei KREATUREN steht die Frist im BUFF.** `actionNegateCreature`
setzt `counters.negated = 1` und legt die Frist daneben in
`counters.buffs[...]` ab — erkennbar daran, dass der Buff beim Ablauf
genau diesen Zähler räumt (`clearCountersOnExpire`). Wer nur
`counters.negated` liest, sieht eine „1" und keine Dauer. Das Badge
sucht jetzt über `fristAusBuffs(statusKey)` auch dort nach
`expiresAtTurn`.

**Dasselbe Muster wie beim Frost (v1013), nur eine Ebene tiefer:** dort
lag die Dauer in einem Geschwisterfeld (`frozenDuration`), hier in einem
Buff-Eintrag. Wer eine neue mehrrundige Kreatur-Statuslage baut, muss
beide Ablagen bedenken.

**② Die DAUER-Anzeige zeigte weiter Blitze.** v1046 hatte nur den
einmaligen Einschlag umgestellt; `NegatedOverlay` — das, was während
des ganzen Status auf der Karte liegt — blieb gelb und zuckte
(`negated-spark`, ⚡). Jetzt gedämpfte Siegelzeichen (🚫,
`negated-glyph`) in demselben Violett wie `silence_seal`, mit ruhigem
Auf- und Abblenden statt Flackern.

**★ `NegatedOverlay` existiert ZWEIMAL** — in `app-board.jsx` und in
`app.jsx`. Wer nur eine ändert, sieht die alte Anzeige weiterhin in
jeder Oberfläche, die die andere Datei lädt. Im Repro wird jetzt
geprüft, dass `negated-spark` in KEINER der beiden mehr vorkommt.


## ★ Dauer: die richtige Ablage wählen (v1048, Als Befund 12.9.)

„Nulls Silence zeigt keine Rundenanzahl, Iceages Lv-4-Frost schon" —
und genau darin lag es. Es gibt **drei** Ablagen, und nur zwei davon
tragen eine anzeigbare Rundenzahl:

| Ablage | Gesetzt von | Rundenzahl? |
|---|---|---|
| `statuses.<status>.duration` | `addHeroStatus(… { duration: n })` | **ja** |
| `counters.<status>Duration` | `applyCreatureStatus(… { duration: n })` | **ja** |
| `counters.buffs[…].expiresAtTurn` | `actionNegateCreature` / `addHeroStatus(… { expiresAtTurn })` | nein — „bis Zug X" |

**Regel: „hält n Runden" schreibt man als `duration: n`.** Der Ablaufzug
ist die Sonderform für „bis zum Beginn deines nächsten Zuges" (Locke,
Bishop) und trägt keine Zahl — er kann nur als Frist gelesen werden.
Null schrieb versehentlich diese Form und war deshalb stumm.

Umgestellt: Held → `addHeroStatus('negated', { duration: 2 })`,
Kreatur → `applyCreatureStatus(inst, 'negated', { duration: 2 })` — also
genau die beiden Wege, die Iceage für seinen Zwei-Runden-Frost geht.
Damit wird die Dauer angezeigt UND heruntergezählt.

Das Badge liest jetzt alle drei Ablagen (`restrundenFuer`), damit auch
Karten mit Ablaufzug wenigstens eine umgerechnete Zahl zeigen; die
`<status>Duration`-Ablage war bis v1013 eine Sonderbehandlung nur für
den Frost und gilt nun generisch.


## ★★ ANTI-AoE MUSS REAGIEREN KÖNNEN (v1185, Als Auftrag 18.9.) — PFLICHT

> **Regel für JEDE künftige Karte, die 2+ Ziele treffen kann:** sie MUSS
> ihren Schaden so austeilen, dass die Anti-AoE-Karten darauf reagieren.
> Nicht optional, nicht „später nachziehen". Der Wächter
> `scripts/check-aoe-window.js` erzwingt sie.

### Warum es ZWEI Klammern sind — und was v1184 falsch machte

Es gibt zwei Anti-AoE-Wege, und sie hängen an verschiedenen Dingen:

| Karte | Seite | Woran sie hängt |
|---|---|---|
| **Interference** (Ability) | Helden | `beginMultiHit(n)` — der Merker, den `interferenceShare` liest |
| **Deepsea Idol** (Reaction Artifact) | Kreaturen | **2+ Einträge in EINEM `processCreatureDamageBatch`** |

Das wurde verwechselt. Eine Karte, die ihre Kreaturen in einer Schleife
einzeln über `actionDealCreatureDamage` abarbeitet, erzeugt je Kreatur
EINEN Batch mit genau einem Eintrag. `_checkCreatureDamageBatchReactions`
steigt bei `entries.length < 2` sofort aus — das Fenster ging **nie** auf.

**Armageddon war genau das:** `beginMultiHit` gesetzt, Interference lief,
Idol trotzdem tot. Dieselbe Bauart hatten 15 weitere Karten. Umgekehrt
gab es fünf Karten, die sauber batchten, aber die Interference-Klammer
nicht setzten (Fireball, Pyroblast, Aquatic Arrows, Powder Keg,
Yolomungandr) — und elf, denen **beides** fehlte, darunter
Dance of the Flame Pillars, Explosion, Heat Wave und Bunny Bombs.

### Die zwei erlaubten Bauformen

**(a) Gesammelt — alle Kreaturen in EINEN Batch.** Dann öffnet die
Engine das Idol-Fenster selbst; es braucht nur noch die
Interference-Klammer:

```js
engine.beginMultiHit(helden.length + kreaturen.length);
try {
  for (const h of helden) await ctx.dealDamage(h, dmg, typ);
  if (kreaturen.length) {
    await engine.processCreatureDamageBatch(kreaturen.map(inst => ({
      inst, amount: dmg, type: typ, source: quelle, sourceOwner: pi,
      animType: 'flame_strike',
    })));
  }
} finally { engine.endMultiHit(); }
```

**(b) Nacheinander — `beginAoeStrike`.** Für Karten, deren Optik von der
Reihenfolge lebt (Chain Lightning springt, Dance of the Flame Pillars
lässt Säule für Säule fallen). Die Klammer setzt `beginMultiHit` UND
meldet dem Idol-Fenster **einmal** die vollständige Kreaturenliste des
Schlags; abgewehrte Instanzen fallen danach in jedem Einzeltreffer still
aus:

```js
await engine.beginAoeStrike(zielzahl, {
  creatures,              // Instanzen ODER { inst, amount } bei abgestuftem Schaden
  source: quelle,
  amount: dmg, type: 'destruction_spell', sourceOwner: pi,
});
try {
  …Einzeltreffer genau wie bisher…
} finally { engine.endMultiHit(); }
```

`beginAoeStrike` ist **async** — das `await` ist Pflicht, sonst läuft der
Schaden am noch offenen Fenster vorbei. Sie gibt das `Set` der
abgewehrten Instanz-Ids zurück, falls die Karte es braucht.

### Verboten

`actionDealCreatureDamage` in einer **Schleife** ohne `beginAoeStrike`.
Genau das meldet der Wächter.

### Die eine Ausnahme: mehrere EINZELinstanzen

Karten, die per Kartentext mehrere getrennte Schadensinstanzen austeilen
— „Repeat as many times as …" (Elven Leader, Future Tech Mech),
„Trigger this effect … times" (Future Tech Barrage), „deal 50 damage to
it as many times as …" (Kirin Firebreath), oder je Auslösung ein eigener
Zielprompt (Blood Moon under the Sea) — sind **kein** Flächenschlag
(Als Ruling 12.9., Rha'Bi-Präzedenz). Sie gehören mit Begründung in
`scripts/aoe-window-baseline.json`, nicht in eine Klammer.

### Zahlen und Randfälle

* **Es zählt die ECHTE Zielmenge** (Als Ruling 12.9.). `zielzahl` ist die
  Zahl der WIRKLICH getroffenen Ziele — tote Helden, verschonte Ziele
  (Laser Volley) und Ziele, die gar keinen Schaden nehmen (Heat Wave
  brennt die einen nur an), bleiben draußen.
* Immune Kreaturen zählen für das Idol-Fenster nicht mit;
  `beginAoeStrike` fragt dafür `_markCreatureDamageImmunity` — **dieselbe**
  Markierung, die auch der Batch benutzt.
* Unter zwei Kreaturen öffnet die Klammer gar kein Fenster und bleibt
  reine Interference-Klammer.
* Ein Scope fragt **genau einmal**: läuft danach noch ein echter Batch
  durch (Bauform a und b gemischt), überspringt der sein eigenes Fenster.
* Die Autoerkennung `hitsMultipleTargets` im Loader kennt jetzt drei
  Muster: `aoeHit(`, `beginMultiHit(`, `beginAoeStrike(`. Damit stieg der
  erkannte AoE-Bestand von **28 auf 52 Karten** — und der CPU-Pilot
  bewertet seither auch diese 24 korrekt gegen Interference.

### Bilder laufen auch bei abgewehrtem Schaden (v1185)

In `processCreatureDamageBatch` stand die Abbruchprüfung **vor** dem
`animType`-Broadcast. Eine von Idol (oder Gate Shield, oder einer
Surprise) abgewehrte Kreatur sprang aus der Schleife, bevor ihr Bild
lief — bei Flame Avalanche sah man die Flammen auf den Helden und auf
den geschützten Kreaturen **nichts**. Jetzt läuft das Bild immer, danach
entscheidet sich der Schaden, und die verhinderte Zahl erscheint als
„0" (Als allgemeine Regel 17.9.). Für neue Karten heißt das: `animType`
am Batch-Eintrag ist der richtige Ort für das Trefferbild — er ist
negationsfest.

### Hand-Reaktionsfenster brauchen ihren Kartenflug

Das Batch-Fenster war das letzte der Hand-Reaktionsfenster ohne
`play_pile_transfer`: es spliced nur aus der Hand und schob den Namen
später in den Ablagestapel — die Karte verschwand und tauchte woanders
wieder auf, ohne dazwischen zu fliegen. Neunte Fundstelle dieser Art
nach Escape, Spectral Armor und Cosmic Malfunction.

★ **Bewusst OHNE `asPlay`.** Dieses Fenster meldet seinen Play bereits
über das Log-Ereignis `creature_damage_batch_reaction`
(`HAND_REACTION_PLAY_EVENTS` im Recorder). Mit Marker stünde Deepsea
Idol — ein Artifact, also nicht vom Spell/Attack-Gate gedeckt — in jedem
Report **doppelt**. Wer ein neues Reaktionsfenster baut, entscheidet sich
für genau EINEN der beiden Wege.


## ★★ AoE OHNE SCHADEN MUSS SICH SELBST MELDEN (v1186, Als Regel 18.9.)

Ergänzung zur Pflichtregel oben. Die Autoerkennung des Loaders
(`detectMultiHit`) hängt an der **Schadensklammer** — `aoeHit(`,
`beginMultiHit(`, `beginAoeStrike(`. Eine Karte, die stattdessen Gift,
Burn, Frozen, eine Negation, einen Buff oder eine Kontrollübernahme
auf eine ganze Gruppe legt, teilt keinen Schaden aus und war deshalb
für Engine wie CPU-Pilot **keine** AoE-Karte. „Poisoned Well" (1 Stack
Gift auf alle gegnerischen Ziele) ist der Musterfall.

**Regel:** solche Karten deklarieren es von Hand am Modul —

```js
module.exports = {
  hitsMultipleTargets: true,   // AoE ohne Schaden
  …
};
```

Eine manuelle Angabe gewinnt im Loader seit jeher gegen die
Autoerkennung; `neverMultiTarget: true` bleibt das Gegenstück für
Karten, die per Kartentext nie mehr als ein Ziel treffen können.

**Der Wächter `scripts/check-aoe-text.js`** prüft es nach, mit dem
**Kartentext als Orakel**: was in `data/cards.json` „all targets /
all Heroes / all Creatures / every … / each …" sagt, muss als AoE
erkennbar sein — entweder über eine Schadensklammer im Skript oder
über die Handdeklaration. Der Text ist das einzige Orakel, das
unabhängig vom Code ist; eine Prüfung „Skript legt Status in einer
Schleife an" würde genau die Karten übersehen, die ihre Schleife
anders schreiben.

Er arbeitet als **Ratchet** gegen `scripts/aoe-text-baseline.json`:
gemeldet wird nur, was NEU dazukommt. Al hat den Altbestand
ausdrücklich nicht als Bedingung gesetzt („Probleme dürfen im Lauf
der Zeit auffallen und dann gefixt werden") — entscheidend ist, dass
es bei neuen Karten nie wieder passiert. In v1186 gekennzeichnet:
Poisoned Well, Iceage, Medusa's Curse, Toxic Fumes, Snowstorm
Mischief, Null Zone, Mass Routing, Cute Conversion, Healing Melody,
Anti Magic Zone, Deepsea Spores, Smoke Vial, Light Ball, Troop
Annihilation. 40 Altfälle stehen in der Baseline.


## ★★ „THIS HERO GAINS THE EFFECTS OF X" (v1186)

Vier Karten tragen diesen Satz: **Tempeluna, the Convergence Fairy**,
**Night, the Herald of Chess**, **Pseudonia, the Skill Devourer** und
**Initiation Ritual** (plus **Dangerous Knowledge** als Teilfall). Er
hat ZWEI Hälften, und bis v1186 war nur die erste umgesetzt.

### ① Hooks hängen an einer KARTENINSTANZ

Liegt die gewonnene Karte als Ausrüstung am Helden, ist **sie** der
Träger: `counters.treatAsEquip = true` plus die vorhandene Regel in
`CardInstance.isActiveIn` lassen ein `activeIn: ['hero']`-Skript aus
der Support Zone feuern — mit dem `heroIdx` des **Wirts**.

Gibt es die Karte nicht mehr (Tempelunas beide Grundfeen: eine ist
überbaut, die andere gelöscht), trägt eine **unsichtbare Support-
Instanz ohne Zonenplatz** (`zoneSlot: -1`). Das ist die Hausform seit
Dangerous Knowledge (v981): sie belegt nichts, ist auf dem Brett
unsichtbar und unzerstörbar, aber der Hook-Verteiler und
`getActiveHeroEffects` finden sie.

### ② Verträge hängen am NAMEN — und genau daran scheiterte es

Flags und Prädikate schlägt die Engine über `loadCardEffect(hero.name)`
direkt am Helden nach. Lunas ganze Wirkung steckt in
`canBypassLevelReqForCard` und `firewallModifiers`, Tempestes
Nachteil in `heroDamageCannotBeReducedOrNegated` — **kein einziger
Hook**. Eine angelegte Karteninstanz sieht davon nichts.

Deshalb `_gained-effects-shared.js`:

| Export | Bedeutung |
|---|---|
| `heroScriptOf(hero)` | Das Skript, das Engine und Server befragen: sein eigenes, ergänzt um die Verträge der gewonnenen |
| `heroScriptsOf(hero)` | Alle Skripte einzeln, eigenes zuerst |
| `gainedNames(hero)` | Die Namen aus `hero.gainedEffectNames` |
| `gainedEffectTexts(hero, cardDB)` | Die Effekttexte für den Tooltip |

**Eine reine Funktion, keine Engine-Methode** — die Frage wird auch
aus `server.js` gestellt (Helden-Effekt-Liste, Bakhm-Zonen,
Potion-Sperre), und dort ist nicht überall eine Engine-Referenz zur
Hand. Der ganze Zustand steht ohnehin am Helden. `engine.heroScript(pi,
heroIdx)` delegiert dorthin und nimmt wahlweise ein Heldenobjekt.

**★ OHNE gewonnene Effekte liefert `heroScriptOf` das eigene Skript
UNVERÄNDERT** — dasselbe Objekt, das `loadCardEffect` liefert. Die
Umstellung der **42 Abfragestellen** (37 in `_engine.js`, 5 in
`server.js`) ist damit für jede normale Partie ein No-op, und der
Schnellweg kostet einen Feldzugriff. Das war die Bedingung dafür,
Stellen im Hook-Filter und im Schadenspfad überhaupt anfassen zu
dürfen.

**★ Zwei der 37 Stellen stehen in `_createContext`** — dort heißt die
Engine `engine`, nicht `this` (v822-Lehre). Ein `this.heroScript(…)`
wäre dort still „is not a function".

### ③ Die Denylist — was NICHT mitwandert

„Effekt" meint die gedruckte **Wirkung** der Karte, nicht ihre
Identität und nicht ihren Lebenslauf. Ohne die Liste erbte Tempeluna
die Aufstiegsbedingung einer angelegten Fee und wäre von da an selbst
deren Grundform:

`hooks`, `activeIn`, `isActiveIn`, `ascensionCondition`,
`ascensionConditionUnskippable`, `payAscensionCost`, `onAscendSetup`,
`onAscensionBonus`, `formsAscensionStack`, `blockEndPhaseOnAscend`,
`evolutionAnimation`, `ascendsFromDefeat`, `plainHeroForm`,
`cheatAscensionBlocked`, `gameStartPickPriority`, `startingAbilities`,
`onIdentityGained`, `onIdentityLost`, `neverPlayable`, `banned`.

Beim Verschmelzen gewinnt das **eigene** Skript jeden Schlüssel — ein
gewonnener Effekt ergänzt, er überschreibt nie; unter den gewonnenen
gewinnt der zuerst gewonnene.

### ④ Die Registry

```js
engine.grantHeroEffect(pi, heroIdx, cardName, { traeger?, grund? })  // SYNCHRON
await engine.finishGainedHeroEffects(pi, heroIdx)                    // Anfangsroutinen
await engine.revokeHeroEffect(pi, heroIdx, cardName, grund)
```

`grantHeroEffect` ist bewusst **synchron**, damit es aus dem
synchronen `onAscendSetup` heraus aufrufbar ist; die Anfangsroutine
des geerbten Skripts (`onIdentityGained` / `onGameStart`) holt
`finishGainedHeroEffects` nach. Die Liste steht in
`hero.gainedEffectNames` — **demselben Feld, das der Tooltip seit
v981 liest** (`_copiedHeroes` oben im Tooltip, `_inheritedEffects` als
Textblock darunter). Eine zweite Liste wäre eine zweite Wahrheit
gewesen; Dangerous Knowledge ist auf den zentralen Weg konsolidiert
und gewinnt dadurch die Verträge des kopierten Helden mit.

`revokeHeroEffect` räumt nur die **unsichtbare** Trägerinstanz. Liegt
die gewonnene Karte als echte Ausrüstung in einer Zone, gehört sie dem
Weg, der sie dorthin gebracht hat — der Widerruf kommt ja gerade
daher, dass sie die Zone verlässt.

### ⑤ Stummschaltung — ein nebenbei geschlossenes Loch

Eine Heldenkarte, die als Ausrüstung an einem Helden liegt, lief
bisher am Stummschalt-Tor des Hook-Verteilers vorbei (das prüfte nur
`zone === 'hero' || 'ability'`). Eine eingefrorene Tempeluna hätte
Tempestes Reduktion behalten, obwohl die Heldin selbst dabei stumm
gewesen wäre. Jetzt zählt sie mit: Support-Zone + (`treatAsEquip` oder
`_gainedEffectOnly`) + `cardType === 'Hero'` → dasselbe
`_isHeroEffectSilenced`, das auch den eigenen Effekt gated. Betrifft
ebenso Initiation Ritual und Dangerous Knowledge.

### ⑥ Nur EIN `heroEffect` je Held — und was das für Menüs heißt

Die Engine kennt je Held genau einen aktivierbaren `heroEffect`.
Gewinnt ein Held einen zweiten (Tempeluna + „Jenny, the Class Fairy"),
muss die Karte selbst ein Menü öffnen und **eigene HOPT-Schlüssel**
je Effekt führen — sonst verbraucht Jennys Einsatz Tempelunas
Anlegen. Muster in `tempeluna-the-convergence-fairy.js`: `optionPicker`
mit den offenen Einträgen, dann `return false`, damit der
Engine-Stempel unterdrückt bleibt (siehe „Several once-per-turn
effects on one Hero Effect").

### ⑦ `payAscensionCost` wird jetzt AWAITED

Der Preis kann eine Karte vom Brett räumen (Tempeluna löscht die
zweite Fee samt Abilities über `deleteHero`), und das läuft über
Hooks. Ohne `await` lief der Aufstieg daran vorbei und die Löschung
landete irgendwann mitten im nächsten Schritt. Synchrone Preise
(Waflav & Co.) merken davon nichts.


## ★★ NEUE ASCENDED-KARTE: BEIDES BAUEN (v1187, Als Befund 18.9.)

Tempeluna liess sich nicht aufsteigen, obwohl Luna UND Tempeste auf
dem Brett standen — der Drag blieb folgenlos, ohne jede Meldung. Die
Bedingung war richtig; es fehlte die andere Hälfte.

**Ein Aufstieg hat ZWEI Riegel, und sie wohnen an verschiedenen
Karten:**

| | wo | wozu |
|---|---|---|
| `ascensionCondition(gs, pi, heroIdx, engine)` | auf der **Ascended**-Karte | der Server prüft beim Ausführen |
| `refreshAscensionReadiness(engine, pi, hi)` | auf **jedem Basis**-Helden | setzt `hero.ascensionReady` + `ascensionTarget(s)`; **nur danach bietet der Client den Aufstieg überhaupt an** |

`heroCanAscendTo` in `app-board.jsx` verlangt `ascensionReady` UND die
Zielkarte in `ascensionTarget(s)`. Die Engine läuft
`refreshAscensionReadiness` bei **jedem** `sync()` über alle Helden —
die Bereitschaft ist also immer aktuell, aber sie entsteht nicht von
selbst. Muster: `checkMoniaAscension` (`_monia-shared.js`),
`checkTempelunaAscension` (`_fairy-shared.js`).

**Nimmt die Bereitschaft auch wieder zurück** — und nur die eigene
(`hero.ascensionTarget === MEINE_KARTE` prüfen), sonst löscht eine
Karte die Bereitschaft einer anderen mit.

### Mehrere Basen in einem Satz — `_getAscensionLineage`

Die Abstammungstabelle liest die Basen aus dem gedruckten Text
(`on top of a "X"`). Tempeluna sagt **„on top of a „Luna…" or
„Tempeste…" you control"** — das alte Muster nahm nur den ERSTEN
Namen, Tempeste war als Basis unsichtbar (betraf
`getAscendedFormsFor`, die Erlass-Wege und „appropriate Hero").
Seit v1187 liest es die ganze Aufzählung (`, / or / and`).

### Tote Basis, lebender Aufsteiger (Als Ruling 18.9.)

Tempelunas Partnerin darf **tot** sein — sie wird ohnehin gelöscht,
und `deleteHero` fragt nur nach dem Namen. Der **aufsteigende Held
selbst** muss leben; das setzt `performAscension` von sich aus durch
(`hp <= 0` → Abbruch, außer `ascendsFromDefeat`). In der
Bereitschaftsprüfung deshalb `hero.hp > 0` für den Aufsteiger, aber
**kein** hp-Filter für die Partnerin.


## ★★ AoE-ERKENNUNG WAR GROSS-/KLEINSCHREIBUNGSEMPFINDLICH (v1187)

Beim Tempeluna-Bau gefunden: `MULTI_HIT_PATTERNS` im Loader suchte
den Token `'aoeHit('` als Teilstring. Das trifft den ctx-Weg
`ctx.aoeHit(` — aber **nicht** den Engine-Weg `engine.actionAoeHit(`,
weil dort ein großes `A` steht. Vier Karten benutzten den kanonischen
Flächentrichter und galten trotzdem für Loader und CPU-Pilot als
Einzelziel-Karten: **Corpse Explosion, Golden Exploding Skull, MOE
Bomb, Realmniversal Emperor** — seit v1049 still danebengelaufen.

Jetzt entscheidet ein Muster ohne Präfixbindung (`/aoeHit\(/i`).
★ **Kein `\b` davor**: zwischen `n` und `A` in `actionAoeHit(` steht
keine Wortgrenze, beides sind Wortzeichen — mit Grenze trifft das
Muster genau die vier Karten nicht, um die es geht. Derselbe Fix im
Wächter `check-aoe-text.js`.

Der erkannte AoE-Bestand steht damit bei **71 Karten** (v1049: 28,
v1185: 52, v1186: 66).

Dazu gekennzeichnet: **Giant Exploding Skull** — sie ZERSTÖRT alle
Kreaturen statt Flächenschaden auszuteilen; ihre Klammer
(`beginDestroyScope`) ist ein anderer Vertrag und wird von der
Schadens-Autoerkennung nicht gesehen.


## ★★ VORGEZOGENER FORMWECHSEL — `hero_form_preview` (v1188)

Ein Aufstieg zahlt seinen Preis, **bevor** die Engine die Identität
tauscht (`payAscensionCost` läuft vor dem `hero.name =`-Block in
`performAscension`). Bei einem Preis, der etwas vom Brett räumt, stand
die alte Karte deshalb während der ganzen Sequenz noch da und wurde
erst hinterher ausgetauscht — bei Tempeluna, deren Preis eine ganze
Heldin löscht, sind das über zwei Sekunden.

Eine Karte kann die **Anzeige** jetzt vorziehen:

```js
engine._broadcastEvent('hero_form_preview', { owner: pi, heroIdx, cardName });
```

Der Client zeichnet den Helden ab sofort als diese Karte
(`formPreview` in app-board.jsx); der echte `hero_ascension` löst das
Vorziehen lautlos ab. **Reines Anzeige-Vorziehen** — der Spielstand
wechselt weiterhin genau dann, wenn die Engine ihn wechselt. Eine
Notbremse räumt das Bild nach 6 s weg, falls der Aufstieg mitten im
Preis noch negiert wird und nie ein `hero_ascension` folgt.

## Klang und Bild einer Aufstiegs-Inszenierung

Der Aufstieg selbst klingt über das Log (`hero_ascension` → `ascension`
in `playSFXForLog`). Alles, was davor im Preis passiert, ist **stumm**,
solange die Karte nichts sagt — das war Tempelunas „hat keine Sounds".

Der billigste Weg zu Klang ist ein `play_zone_animation` mit einem
Eintrag in `ZONE_ANIM_SFX`. **Ein Typ ohne Registry-Eintrag ist
erlaubt**: `GameAnimationRenderer` gibt für unbekannte Typen `null`
zurück, der Klang läuft trotzdem — so lassen sich reine Klangmarken
setzen (`tempeluna_converge`, `tempeluna_erase`), ohne eine Animation
zu erfinden.

Für Tempeluna neu: `tempeluna_steam` (26 Schwaden + 9 warme Funken,
über die per `duration` übergebene Laufzeit gestaffelt statt als
einmaliger Stoß wie `steam_puff`), Klang aus zwei Schichten —
`elem_water` hoch gefahren für das Zischen, `elem_wind` darunter für
das Wallen. Einen eigenen Dampf-Klang gibt es im 52er-Katalog nicht.


## ★★ GALERIE-EINTRÄGE: `name` REIN, `cardName` RAUS (v1189)

Der Vertrag von `cardGallery` / `cardGalleryMulti` ist **asymmetrisch**,
und daran stolpert regelmäßig eine neue Karte:

```
HINEIN:  [{ name, source?, count?, cost?, selectable?, highlight? }]
ZURÜCK:  { cardName, source }
```

Wer die Antwortform für die Eingabe hält — ein sehr naheliegender
Schluss — baut `{ cardName: … }`. Der Client liest `entry.name`, findet
`undefined` und zeichnet eine **leere Galerie**. Kein Fehler, keine
Meldung, nichts. Dieselbe Falle in der anderen Hälfte: wer nur Namen
übergibt (`cards: [...ps.mainDeck]`), bekam bis v1159 ebenfalls eine
leere Galerie. Aufgelaufen sind daran „Teleportal", „Cleansing of the
Land" (v1159) und „Tempeluna" (v1189, beide Galerien).

**Seit v1189 vereinheitlicht `promptGeneric` die Einträge selbst** —
an derselben Stelle, an der v1159 schon die String-Variante abfängt:

| Übergeben | Wird zu |
|---|---|
| `'Firewall'` | `{ name: 'Firewall', source: searchPile \|\| 'deck', count: n }` |
| `{ cardName: 'Firewall', source: 'deck' }` | `{ name: 'Firewall', source: 'deck' }` |
| `{ card: 'Firewall' }` | `{ name: 'Firewall' }` |
| `{ name: 'Firewall', … }` | unverändert |

Die übrigen Felder bleiben unangetastet — es fehlt ja nur der Name.
Die **Antwortform bleibt `{ cardName, source }`**: 182 Aufrufstellen
lesen sie so, und ein Umbau dort wäre ein zweiter Fehler statt einer
Lösung.

Bleibt an einem Eintrag gar kein Name zu holen, schreibt die Engine
eine Warnung mit dem Quellnamen auf die Konsole — eine leere Galerie
soll man wenigstens **sehen**.

**★ Die Normalisierung ist ein Netz, kein Freibrief.** Der Wächter
`scripts/check-gallery-entries.js` hält den Quelltext auf der
kanonischen Form (`name`); er erkennt beide Bauformen — Array inline
im Aufruf und Array über eine Variable (`x.push({…})`,
`const x = […].map(() => ({…}))`). Wer `cardName` schreibt, meint
erfahrungsgemäß auch sonst die falsche Form.


## ★★ FLUG-ZIELFELDER: `to*` STATT `from*` (v1190, Als Befund 18.9.)

`play_pile_transfer` löst Quelle und Ziel über **zwei getrennte
Feldsätze** auf:

```
QUELLE:  from, fromOwner?, fromHeroIdx, fromSlotIdx, fromHandIdx, fromPermId
ZIEL:    to,   toOwner?,   toHeroIdx,   toSlotIdx,   toHandIdx
```

Und der Handler steigt **still** aus, wenn eines der beiden Elemente
nicht gefunden wird:

```js
if (!srcEl || !tgtEl) return;
```

Wer beim Ziel die Quellnamen schreibt — `heroIdx` statt `toHeroIdx`,
`zoneSlot` statt `toSlotIdx` —, bekommt deshalb **gar keine
Bewegung**: kein Fehler, keine Meldung, die Karte erscheint einfach
ohne Flug an ihrem Platz. Aufgelaufen sind daran „Tempeluna" (v1190)
und „???, the Shapeshifter" (seit v1000 stumm, gleich mitgezogen).

**Brett-Ziele und ihre Pflichtfelder:**

| `to` | braucht |
|---|---|
| `support` / `ability` | `toHeroIdx` + `toSlotIdx` |
| `surprise` / `hero` | `toHeroIdx` |
| `hand` | `toHandIdx` (+ `finalHandSize`) |
| `discard` / `deleted` / `deck` / `potionDeck` / `area` / `coolnessStack` | nichts |

Der Wächter `scripts/check-flight-targets.js` prüft das und weist
ausdrücklich auf den häufigsten Fehlgriff hin (Quellnamen am Ziel).

**Zwei Dinge zur Reihenfolge**, beide schon mehrfach falsch gemacht:

* Der Flug wird **vor** dem Splice aus der Hand gesendet — sonst ist
  der Startplatz weg, wenn der Client ihn sucht. Ist die Karte bereits
  aus ihrer Quelle entnommen, lässt man `fromHandIdx` einfach **weg**:
  der Handler nimmt dann den Handbereich als Ganzes, was für Hand,
  Deck und Ablage gleichermaßen passt (Shapeshifter-Muster).
* `sfx: '<klang>'` am Flug gibt ihm einen Klang (v1122) — für ein
  Anlegen aufs Brett ist `placement` der passende.


## ★★ ZIELREGELN EINER KARTE, DIE NICHT MEHR LIEGT (v1191)

`heroBlocksTargeting` — der Sammler hinter „cannot be chosen **or
hit**" — fragte bisher drei Quellen ab: die Support-Zonen des Ziels
(Future Tech Jetpack), seine Ability-Zonen (Stealth) und
`blocksTargetingAnywhere` auf Brettinstanzen (Alliance). Alle drei
setzen voraus, dass die regelgebende Karte **irgendwo liegt**.

Eine Reaction, die sich nach dem Auflösen selbst löscht, liegt
nirgends mehr — und trägt ihre Regel trotzdem bis zum Zugende. Dafür
die vierte Quelle:

```js
engine.addHeroTargetBlocker(pi, heroIdx, 'Dive Down', { untilTurn: gs.turn });
```

Der Eintrag landet als `hero._targetBlockers` und nennt nur den
**Kartennamen** — die Regel selbst bleibt im Skript der Karte, in
ihrem `blocksTargeting(gs, engine, info)`, genau wie bei Jetpack und
Stealth. Der Eintrag wird als `info.blocker` durchgereicht.

Abgelaufene Einträge (`untilTurn < gs.turn`) räumt der Sammler
**beiläufig** weg. Ein eigener Aufräum-Hook wäre eine zweite Stelle,
die man vergessen kann — und weil der Sammler ohnehin bei jeder
Zielfrage läuft, ist er die einzige Stelle, die garantiert drankommt.

**Warum nicht der `untargetable`-Status:** der wird NUR in den
Zielwählern durchgesetzt, nicht im Schadenspfad. Er deckt „cannot be
chosen" ab, aber nicht „or hit" — Flächenschaden träfe weiter.
`blocksTargeting` deckt beides, weil die Engine es an drei Stellen
liest (zwei Zielwähler + `_actionDealDamageImpl`).

### „other targets" ist mehr als „other Heroes"

Der Anti-Lock steht bei Stealth auf anderen **Heroes**, bei Dive Down
auf anderen **Zielen** — Kreaturen zählen dort mit. Wer eine solche
Karte baut, liest den Satz genau: die beiden Formulierungen kommen im
Bestand nebeneinander vor und meinen Verschiedenes.

Gemeinsam bleibt die Lehre aus Stealth: ein zweiter gleichgeschützter
Held zählt **nicht** als Ausweichziel, sonst schützen zwei einander
ins Nichts.

### Abzeichen für Zielsperren (v1192)

`hero._targetBlockers` geht mit dem Spielstand an den Client (das Feld
hängt am Helden, `heroes: ps.heroes` sendet es mit). Der Held reicht es
an `StatusBadges` durch; Symbol und Text stehen in der Registry
`TARGET_BLOCKER_BADGES` in app-shared.jsx — **eine Stelle für alle
künftigen Karten dieser Bauart**. Dive Down: 🫧 „Dived Down". Fehlt ein
Eintrag, wird still kein Abzeichen gezeigt; die Regel wirkt trotzdem.

Ein Schutz, der sich wie ein Buff verhält, braucht ein Abzeichen —
sonst sucht der Gegner den Grund, warum er einen Helden nicht anklicken
kann.

### ★★ „or HIT" lief seit v563 ins Leere (v1193, Als Befund 18.9.)

Der Zielschutz stand im Schadenspfad **innerhalb** des Surprise-Blocks
und erbte dessen drei Bedingungen — keine davon hat mit Zielschutz zu
tun:

* `!opts.skipSurpriseCheck` — `actionAoeHit` führt sein eigenes
  Surprise-Fenster und schaltete den Zielschutz damit ab. **Genau das
  war Als Befund: „Dive Down verhindert das Zielen, Flame Avalanche
  trifft trotzdem."**
* `source.heroIdx >= 0` — Artefakte und Potions fielen heraus.
* `!SURPRISE_SKIP_TYPES.has(type)` — `'other'` und `'recoil'` fielen
  heraus.

Und `chooserIdx` wurde gar nicht erst mitgegeben. Jedes Skript, das
„your opponent's" prüfen will — Stealth tut das seit v634, Dive Down
seit v1191 — gatet darauf und fiel hier still aus.

Seit v1193 steht der Zielschutz in einem **eigenen Block**, direkt
nach der Effekt-Immunität, gegated nur auf „Heldenziel, Schaden > 0,
kein Status-Tick", und reicht `chooserIdx`
(`source.controller ?? source.owner`) sowie `opts.ignoreUntargetable`
durch. Verhinderter Schaden zeigt dort jetzt auch die „0" (Als Regel
17.9.).

Das repariert nicht nur Dive Down: **Future Tech Jetpack und Stealth
haben ihr „or hit" damit zum ersten Mal wirklich.**


## ★★ EINE ANIMATION BRINGT IHRE KEYFRAMES SELBST MIT (v1194)

Tempelunas Anlege-Animation war komplett unsichtbar — dieselbe Zeile
Code, die beim Aufstieg Dampf zeigt. Zwei unabhängige Gründe, und
beide sind Fallen für die nächste Karte:

**① Fremde Keyframes.** Die Dampfschwaden liefen auf
`tempeluna-steam-rise`, definiert im `<style>`-Block der
**Aufstiegs**-Animation. Ein Keyframe aus dem `<style>` einer anderen
Komponente existiert nur, solange die gerade gemountet ist — läuft sie
nicht mit, bleibt das Element bei `opacity: 0` stehen. Kein Fehler,
keine Meldung.

Erlaubt sind genau zwei Quellen: der **eigene** `<style>`-Block oder
`public/style.css` (global, z.B. `healSparkleParticle`, `waterRipple`
— von vielen Karten geteilt). Der Wächter
`scripts/check-anim-keyframes.js` prüft das für alle 179 Komponenten.
Er hat dabei gleich einen zweiten Fall gefunden: **`monkee_shield`
(Resilient Monkee, v347)** verwies auf zwei Keyframes, die es
nirgends gab — die Animation lief seit ihrer Entstehung nie. Beide
sind jetzt lokal definiert.

**② Der 'effect'-Sammelklang lässt nur EINEN durch.**
`playSFXForZoneAnim` stempelt jede Schicht ohne eigene Angabe auf
`category: 'effect'`, und die Kategorie lässt pro Rahmen genau einen
Klang passieren — richtig für gleichzeitige Treffer (Bauregel 7 der
SFX-Familie), falsch für einen **geschichteten** Klang. Ein
mehrschichtiger Cue setzt deshalb an JEDER Schicht
`category: null` plus ein `dedupe`, damit eine Serie trotzdem nicht
matscht. Muster: `ddg_manifest`, `buff`, `elem_wind` — und jetzt
`tempeluna_infuse` (elem_holy + reveal + elem_water).

**Faustregel:** wer eine Animation baut, die nur manchmal zusammen mit
einer anderen läuft, testet sie AUCH allein. Sieht man dann nichts,
steht der Keyframe am falschen Ort.


## ★★ TEMPORÄRE KONTROLLE — `_charm-shared.js` (v1196)

„Take control of a Hero your opponent controls for the rest of the
turn" gibt es dreimal: **Charme Lv3**, **Love Shot**, **Golden Apple**.
Das Verfahren ist identisch, nur der Schutz unterscheidet sich — seit
v1196 steht es an einer Stelle:

```js
const { temporaereKontrolle, uebernehmbareHelden } = require('./_charm-shared');

await temporaereKontrolle(engine, {
  controllerPi, ownerPi, heroIdx,
  sourceName: 'Golden Apple',
  marker: 'onlyFromController',   // oder '_loveShot' oder null
  supportZonesLocked: false,      // nur, wenn der Kartentext sie nennt
});
```

**Die drei Riegel, die man beim Nachbauen übersieht** — alle im Modul:

1. **Erst-Zug-Schutz** (`gs.firstTurnProtectedPlayer`).
2. **`beforeHeroEffect` mit `effectType: 'charm'`** — ohne das läuft die
   Übernahme an „Resistance" vorbei und der Held bleibt *halb*
   verzaubert: `charmedBy` gesetzt, Status wieder entfernt.
3. **`hasEffectImmunity`** — `charmed` ist kein Katalogstatus und läuft
   nicht durch `addHeroStatus`, der Riegel steht von Hand.

Die **Rücknahme** am Zugende ist generisch (die Engine räumt
`charmedBy` im Zugwechsel) — eine Karte tut dafür nichts.

### Der Schutz hat drei Ausprägungen — `_charmBlocksFrom`

`statuses.charmed` trägt die Marke, `engine._charmBlocksFrom(target,
quellenSeite, opts)` beantwortet sie an **allen** Toren:

| Karte | Marke | Wirkung |
|---|---|---|
| Charme Lv3 | — | alles prallt ab (Grundform) |
| Love Shot | `_loveShot` | nur Kontrolle, **kein** Schadensschutz (Als Streichung 15.9.) |
| Golden Apple | `onlyFromController` | nur die Karten des **Kontrolleurs** prallen ab |

Der Unterschied steckt im Kartentext und ist leicht zu überlesen:
Charme sagt „unaffected by **other** cards and effects", Golden Apple
„unaffected by **your** other cards and effects". Bei Golden Apple
kommt also durch, was der ursprüngliche Besitzer auf seinen eigenen
(gerade entliehenen) Helden wirkt.

Ebenso: Charme nennt „It **and its Support Zones**", Golden Apple nur
den Helden — deshalb `supportZonesLocked` als Schalter statt als
Automatik.

### ★ Der Status-Riegel fehlte auf dem Hauptweg (v1196)

Gefunden beim Bau von Golden Apple: die Charm-Immunität gegen negative
Status stand **nur** in `actionAddStatus` (dem ctx-Weg).
`addHeroStatus` — der Hauptweg für Heldenstatus — hatte sie nicht. Ein
verzauberter Held war darüber die ganze Zeit vergiftbar, einfrierbar
und betäubbar, obwohl sein Abzeichen „immune to all effects"
verspricht. Betrifft **Charme Lv3 genauso**, nicht nur die neue Karte.

**Lehre:** Wer einen Schutz baut, sucht ALLE Wege, die ihn umgehen
könnten — `grep` auf den Statusnamen reicht nicht, weil die Tore an
verschiedenen Funktionen hängen. Für Schaden sind es
`_actionDealDamageImpl` und der AoE-Trichter, für Status
`addHeroStatus` **und** `actionAddStatus`.

### ★★ KREATUREN GEHEN NICHT MIT DEM HELDEN MIT (v1197, Als Ruling 18.9.)

> „Creatures gelten, anders als Attachments, Equips usw., als
> eigenständige Akteure und gehen also nicht einfach mit dem Hero mit."

Wer einen Helden für einen Zug übernimmt, bekommt seine **Ausrüstung,
Anhängsel und Abilities** — aber **nicht die Kreaturen** in seinen
Support Zones. Gilt für die gesamte temporäre Kontrolle: Charme Lv3,
Love Shot, Golden Apple.

Die **dauerhafte** Übernahme (`permaControlBy`) ist davon ausgenommen:
sie ist ein Besitzwechsel, und „ein übernommener Held zählt wie ein
eigener" (Als Ruling 4.9.) — dort wandert alles mit.

**Drei Stellen tragen das**, und wer eine ähnliche Regel baut, muss
alle drei kennen:

1. **`_createContext`** — der zentrale Umschalter. Eine Karte in
   `support` / `ability` / `hero` eines verzauberten Helden bekommt
   sonst automatisch den Verzauberer als `cardOwner` / `cardController`.
   Kreaturen sind seit v1197 ausgenommen (`_istKreaturenInstanz`, die
   auch `_effectOverride` berücksichtigt).
2. **`getActivatableCreatures`** — der Scan der verzauberten Gegenseite
   ist ersatzlos entfallen. Was der Client nicht angeboten bekommt,
   klickt niemand.
3. **`doActivateCreatureEffect` (server.js)** — das Tor dort lässt den
   Charme ausdrücklich durch, ein direkter Klick wäre also trotzdem
   durchgekommen. Zweiter Riegel: nur `stolenBy` oder der eigene
   `controller` darf aktivieren.

**Der Weg für geliehene Kreaturen bleibt unangetastet**: Deepsea
Succubus, Cute Conversion und Treacherous Crystal leihen sich die
KREATUR selbst (`inst.stolenBy` + geflippter `controller`) — das ist
ein anderer Vertrag als die Mitnahme über den Helden und wird weiterhin
eingesammelt.

### ★★ BESCHWÖREN MIT EINEM GELIEHENEN HELDEN (v1198, Als Ruling 18.9.)

**Der Kreaturenweg kannte `charmedOwner` nicht.** Der Spell-Weg reicht
ihn seit jeher durch (`doPlaySpell`), `doPlayCreature` nahm ihn gar
nicht erst entgegen und der Client sendete ihn bei `play_creature`
nicht mit. Ohne ihn gilt in `validateActionPlay` `heroOwner = pi` — der
`heroIdx` wird also gegen die **eigene** Heldenreihe aufgelöst.
Nachgemessen: ein Zug auf den geliehenen `P1H0` landete auf `P0H0`.
Weil `getHeroPlayableCards` Kreaturen für verzauberte Helden
ausdrücklich anbietet, leuchtete der Client und der Server schickte die
Beschwörung woanders hin.

**Das Ruling:** Die Kreatur landet in der Support Zone des geliehenen
Helden — also auf der **gegnerischen Brettseite** — und gehört
**dauerhaft dem Beschwörer**, auch nachdem der Held zurückfällt.

Die Engine hat dafür längst die Trennung `inst.owner` (Brettseite)
gegen `inst.controller` (wem sie gehört); genutzt hat sie bisher nur
der Leih-Weg `stolenBy`. Seit v1198 nimmt `safePlaceInSupport` —
und damit `summonCreature` — ein `opts.controller`:

```js
engine.summonCreature(cardName, heroOwner, heroIdx, zoneSlot, { controller: pi });
```

Ist `controller` gesetzt und verschieden von der Brettseite, bekommt
die Instanz zusätzlich `counters.crossSideControlled = <pi>`. Die Marke
hängt an der **Instanz**, nicht am Charme — sie überlebt das Zugende,
und darauf hängt das Abzeichen ⚑ „Foreign Ground" (Als Vorgabe:
„großer Marker, der das zu jeder Zeit signalisiert").

**Wer einen ähnlichen Weg baut, achtet auf die Seitentrennung:** alles,
was die ZONE betrifft (`supportZones`, `isSupportZoneLocked`,
`isCreatureSummonable`), fragt den **Heldenbesitzer**; alles, was die
AKTION betrifft (Kosten, Aktionsökonomie, Summon-Sperre, Kontrolle),
fragt den **Spieler**. In `doPlayCreature` heißen die beiden seit v1198
`heroOwner` und `pi`.

### ★ Seitenlose Indizes im Drag-Highlight (v1200)

`playDrag.targetHero` / `targetSlot` sind **blosse Indizes ohne Seite**.
Welche Brettseite gemeint ist, entscheidet eine eigene Bedingung —
`_zoneSideOk`, und die fiel ohne `targetAttachOwner` pauschal auf
`!isOpp` zurück. Beim Beschwören in die Zone eines geliehenen Helden
leuchtete deshalb die **eigene** Zone mit demselben Index als „hier
landet sie". Seit v1200 zählt `playDrag.charmedOwner` als dritte
Seitenangabe.

**Faustregel:** wo ein Drag ein Ziel auf der Gegenseite haben kann,
braucht jede Highlight-Bedingung eine ausdrückliche Seitenangabe.
Es gibt inzwischen drei: `targetAttachOwner` (Cross-Side-Attachments),
`isCrossSideEquip` / `isFreeSideEquip` (Ausrüstung) und `charmedOwner`
(geliehener Held).

### Dauerhafte Hervorhebung „Foreign Ground"

Zusätzlich zum Abzeichen ⚑ trägt eine Kreatur mit
`counters.crossSideControlled` seit v1200 einen kräftigen Ring in der
Farbe ihres Besitzers plus ruhiges Pulsen
(`@keyframes pp-crossside-pulse` in `public/style.css`). Er wird den
Zustandsfiltern **hinzugefügt**, nicht an ihre Stelle gesetzt — an
einer versteinerten oder sporifizierten Kreatur bleibt er sichtbar.

### ★★ ZÄHLER WERDEN NACH DER BRETTSEITE GESCHLÜSSELT (v1201)

`creatureCounters` (server.js, zweimal — Spieler- und Zuschauersicht)
legt die Counter einer Kreatur unter `${physicalSide}-${heroIdx}-${zoneSlot}`
ab. **Physisch heißt: in wessen `supportZones`-Array die Karte liegt**,
nicht wer sie kontrolliert:

```js
const physicalSide = (inst.stolenBy != null
    || inst.counters?.crossSideControlled != null)
  ? inst.owner
  : (inst.controller ?? inst.owner);
```

Eine mit geliehenem Helden beschworene Kreatur liegt im Array des
**Brett**besitzers und hat einen fremden `controller` — ohne den
zweiten Zweig landeten ihre Zähler unter der Seite des Kontrolleurs.
Der Client sucht sie dort, wo die Karte liegt, fand nichts und zeigte
**weder Abzeichen noch Ring**. Der Ring war also nicht zu blass, es gab
ihn gar nicht.

**Faustregel:** wer `inst.controller` von `inst.owner` abweichen lässt,
muss entscheiden, ob die Karte dabei UMZIEHT (dann schlüsselt der
Controller, Muster Chilly Wizard) oder LIEGEN BLEIBT (dann der Owner,
Muster `stolenBy` und `crossSideControlled`). Beides gibt es, und die
Wahl steht an genau dieser Stelle.

### Beschwörungsbilder gehören auf die Zielseite

`summon_effect` (goldener Schein) und `broadcastHandToBoard` (Flug aus
der Hand) liefen in `doPlayCreature` über `pi`, also den **Wirker** —
beim geliehenen Helden erschienen sie damit auf dem eigenen Brett,
während die Kreatur auf dem gegnerischen landete. Der Flug kennt dafür
seit jeher `destOwner` im Payload (Cross-Side-Muster); `summon_effect`
braucht schlicht die Brettseite. Beide nehmen jetzt `heroOwner`.

## ★★ v1264 — Ascension Bonus, Editor-Massstab unter `zoom`, Bundles nach Inhalt

### Der Ascension Bonus kommt NUR ueber `onAscensionBonus`

`performAscension` vergibt den Bonus ausschliesslich ueber den Hook der
Ascended-Karte. Es gibt keinen Rueckfall auf `cards.json` — fehlt der
Hook, steigt der Held still ohne Bonus auf. Genau so fehlte bei „True
Fairy Crestina" monatelang „Wisdom 3" (Als Befund 22.9.).

```js
async onAscensionBonus(engine, pi, heroIdx) {
  await engine.performAscensionBonus(pi, heroIdx, ['Wisdom']);
},
```

Bei Ascended Heroes beschreiben `startingAbility1/2` den BONUS, nicht
Starting Abilities. **Wächter:** `node scripts/check-ascension-bonus.js`
— jeder Bonus braucht den Hook, jeder „<Ability> N"-Bonus die Ability
als Zeichenkette im Code (Konstante genügt, siehe Cecilia).

### Messungen unter `zoom` (Puzzle-Editor-Scaler)

Menüs und Editor liegen in `.screen-full`, das `zoom: var(--ui-scale)`
trägt. Unter `zoom` liefert `getBoundingClientRect` **gezeichnete**
Pixel, `offsetHeight`/`clientHeight`/`scrollWidth` aber **Layout**-Pixel.
Wer beides mischt, rechnet nur bei `--ui-scale` = 1 (1600×900) richtig.
Der Editor-Scaler tat das: auf kleinen Fenstern kam der Überhang der
gekippten Ebene als 0 heraus (Brett ragte in die Handleiste), auf
großen wurde das Brett unnötig klein.

**Regel:** jede Länge aus einem Rechteck vor dem Vergleich mit Layout-
Maßen durch den Zoomfaktor teilen, gemessen am Element selbst:
`zoomFaktor = rect.width / el.offsetWidth` (Helfer `L()` im Scaler).
Das Kampffeld trägt `ui-noscale` und ist nicht betroffen.

### `pointer-events` und gleiche Spezifität

`.pz-hand > * { pointer-events: auto }` (v1263) hob
`.pz-hand-cards { pointer-events: none }` (v1255) wieder auf — gleiche
Spezifität, spätere Regel gewinnt. Das unsichtbare Fächerpolster fing
danach alle Klicks und Drops über den Support Zones beider Seiten.
Jetzt `.pz-hand > :not(.pz-hand-cards)`. **Faustregel:** eine
Sammelregel für Kinder schließt die Kinder, die eine eigene
Zeigerregel haben, ausdrücklich aus.

Die Editor-Handleisten umschließen seit v1264 ihren Fächerbogen
(`--hand-faecher-rand`: Hub minus das abgesenkte Drittel, plus 4 px),
damit der Scaler ihn mitzählt.

### Gemeinsame Oberflächen-Bausteine (v1264)

| Baustein | Wo | Zweck |
|---|---|---|
| `<GlanzBand klasse? />` | app-shared | Foil-Lichtstreifen (`foilSweepLoop`, `screen`) über einem Wirt mit `position: relative`. Variante `pp-glanz--logo` maskiert auf `logo.png`. Stellschrauben `--glanz-breite/-dauer/-verzug/-von/-bis/-staerke` |
| `<LotsenGlanz />` + Klasse `pp-lotse` | app-shared + style.css | Hervorhebung „hier entlang": pulsierender Schein (Deckkraft eines festen Schattens) plus Glanzband. Farbe `--lotse-farbe` (Vorgabe `#ff44cc`). Nutzer: Gast-Knopf im Login, Tutorial Raccoon |
| Klasse `pp-eckzier` | style.css | die gestuften Pixel-Ecken der Menükästen, gemeinsame Definition mit `.ornate-frame::after`. `--eck-farbe/-arm/-dicke/-abstand` |
| `PixelParticles radial farben` | app-screens | Partikelquelle statt Schwarm (SC-Glitzer `ScGlitzer`) |
| Klasse `pz-stapel-gegner` | app-puzzle | verdeckte Gegnerstapel im Editor, dieselbe 180°-Regel wie `[data-opp-deck]` |

### Bundles werden nach Inhalt gebaut

Das v1263-Paket enthielt ein veraltetes `dist/app-board.js` (sechs
Client-Fixes fehlten — dieselbe Klasse wie v495). Das Netz beim
Serverstart (`buildAll()`) griff nicht, weil es nach Zeitstempel
entschied und das Bundle jünger als seine Quelle war. Seit v1264 trägt
jedes Bundle in Zeile 1 `/* pp-quelle sha1:… */`; `needsBuild` vergleicht
diesen Hash mit der Quelle. `BUILD_FORMAT` in `scripts/build.js`
hochzählen, wenn sich die Transformation ändert.

### ★ v1265 — Menue-Masse, Ecken, Login-Leistung

**`UiScaler` misst VOR den Bildschirmen.** Er setzt `--ui-scale` seit
v1264 per `useLayoutEffect`. Mit `useEffect` lief das Setzen nach dem
`useLayoutEffect` des Hauptmenues (gleicher Commit) — das Menue mass
seine Lage ohne Zoom, die Kaesten lagen je nach Fenster bei 84, 150 oder
240 px. Zusaetzlich rechnet das Menue Rechtecke ueber
`menuZoomFaktor(el)` in Layout-Pixel um (Regel aus dem Abschnitt
„Messungen unter `zoom`"). **Faustregel:** wer in einem Layout-Effekt
misst, verlaesst sich darauf, dass `--ui-scale` schon steht — neue
Mess-Stellen nicht in `useEffect` vor den UiScaler ziehen.

**Kopfzeile des Hauptmenues:** Masse als Variablen auf
`.main-menu-screen` (`--kopf-oben/-zeile/-abstand/-discord-h`). Rechts
ein Raster (LOGOUT + Lautsprecher, darunter Discord in LOGOUT-Breite),
links Elo/SC mittig auf Discord-Hoehe — beide Seiten rechnen aus
denselben Variablen.

**Ecken-Zier als Maske.** Jede Ecke ist EINE 4×4-Rasterform (SVG-Maske
auf einer Farbflaeche), nicht mehr drei einzeln positionierte
Hintergrundflaechen — die rundete der Browser unter `zoom` einzeln, das
Stufenquadrat verrutschte. Dicke = Armlaenge / 4 (`--eck-dicke` entfaellt).

**Login-Kulisse: zugeschnittene Ebenen.** `animEbene(file, extra,
{versatzX})` (app-screens.jsx) ersetzt die Vollbild-Ebenen: jede Figur ist
nur so gross wie ihr Alpha-Rahmen (`ANIM_SPRITE_RAHMEN`, Buehnenpixel
1920×1080); `background-size/-position` und `transform-origin` werden so
umgerechnet, dass das Bild gleich bleibt (Pixelvergleich: nur
Subpixel-Kanten). Wer ein Ebenenbild austauscht, traegt den neuen Rahmen
ein; ohne Eintrag faellt die Ebene auf Vollbild zurueck. Dazu: Bloom ohne
`filter: blur`, `screen` auf den Blitzen statt auf ihrer Huelle,
Hintergrund-Partikel hinter der deckenden Kulisse abgeschaltet.
Gemessen ohne GPU-Beschleunigung: 5 → 17 Bilder/s. Groesster
verbliebener Posten: die 150 Logo-Partikel (je eigene Ebene mit zwei
Leuchtschatten).

### ★ v1266 — Login als Karte, Lotsen-Ring

**Login-Kasten** (style.css, Block „LOGIN ALS KARTE"): oben das
Kunstfenster `.auth-header` mit gemaltem Glutkern hinter dem Logo, darunter
der deckende Textkasten `.auth-rumpf` (ruhige Flaeche, 4-%-Raster, keine
Pixel-Umrisse um Text). Eigene Farbvariablen `--auth-*` nur fuer diesen
Kasten; Pink nur fuer den Gast-Einstieg, `--accent` nur fuer Anmelden,
aktiven Reiter und Fokus. Rahmen + `pp-eckzier` in Violett. Der
Explosionskern liegt wieder in der Kulisse (`.anim-explosion`, Ebene 2),
nicht mehr als `.auth-panel-explosion` im Kasten ueber dessen Flaeche.

**Gleiche Hoehe beider Reiter durch Bauart:** Anmelden fuellt die
fehlende dritte Zeile mit `.auth-zeile-hilfe` (Passwort-Link, so hoch wie
ein Eingabefeld dank eines unsichtbaren Felds darin). Hoehenausgleich am
Kastenende und `.auth-footer` sind entfallen; der Code-Hinweis beim
Registrieren steht im Platzhalter des E-Mail-Felds. Autofill-Fuellung
wird per Innenschatten auf `--auth-feld` gehalten.

**Lotse:** `.pp-lotse-schein::after` ist ein Sonar-Ring (waechst ueber
`inset` 0 → −16 px und verblasst, Takt 2.4 s wie der Puls). Untergrenze
des Pulses `--lotse-min` (Vorgabe .3) — nicht zu hoch setzen, sonst ist
der Puls neben Kartenkunst nicht zu sehen (Lehre aus v1265, .65).

## ★ v1267 — Dragonegg-Familie, Archetyp „Drago", Kontrolleur beim Tod

**`_dragonegg-shared.js`** ist die einzige Auslegungsstelle der beiden
gleich gewordeten Ei-Klauseln (Icy, Flaming): `eiInherentAction`
(„If you control no Creatures …"), `eiTodesEffekt(ctx, name, status)`
(„When this Creature is defeated during your turn …"), `eiCpuResponse`.
Ein weiteres Ei = ein Eintrag in `EI_STATUS` + eine Kartendatei mit
drei Zeilen. **Als Ruling 22.9.:** nur ein Tod in der Runde des
KONTROLLEURS loest aus; massgeblich ist die Runde, nicht der Verursacher.

**`deathInfo.controller`** steht seit v1267 in BEIDEN Todespfaden
(vorher nur im Schadens-Batch; der Zerstoerungsweg `actionDestroyCard`
lieferte ihn nicht). Alle Leser nutzen `controller ?? owner` — Folge nur
bei gestohlenen/gecharmten Kreaturen, die per Zerstoerung sterben: sie
zaehlen jetzt fuer den Kontrolleur, wie beim Schadenstod schon immer.

**Archetyp „Drago"** tragen ab v1267 alle Karten mit „Drago" im Namen,
die noch keinen Archetyp hatten (Blue-Ice Dragon, Dragolfin, Sorbereus,
Red/Green Dragoneer, Rubin, Icy/Flaming Dragonegg). Kartentexte, die
„\"Drago\" Creature" sagen, lesen weiter den NAMEN (`_drago-shared.js`),
nicht den Archetyp — Green Dragoneers CPU-Kettenwert tut das seit v1267
ebenfalls (vorher `/Drago/i` auf dem Archetyp, tot).

**Ein Archetyp je Karte:** `archetype` ist ein einzelner String, rund 35
Stellen pruefen `cd.archetype === '…'`, Deckbau- und Kampagnenfilter
ebenso. Zwei Archetypen fuer eine Karte gibt es derzeit nicht.

## ★ v1268 — Ausruesten durch Effekte: `_equip-shared.js`

Karten, die eine Ausruestung per EFFEKT aus einem Stapel an einen Helden
legen (nicht aus der Hand spielen), nutzen EINEN Weg:

| Helfer | Zweck |
|---|---|
| `istAusruestTraeger(engine, pi, hi, name)` | Traegerregel wie der Handweg: lebendig, nicht Frozen, nicht Charmed, freie Basis-Support-Zone, `canEquipCardToHero` |
| `ausruestTraeger(engine, pi, name)` | alle legalen Traeger — fuer Kandidatenfilter (Als Regel 19.8.: ohne Traeger keine legale Wahl) |
| `waehleAusruestPlatz(engine, pi, name, cfg)` | Held-oder-Zone-Wahl (`{heroIdx, slot}` oder null); `cfg.nurHelden` schraenkt ein |
| `ruesteAusStapelAus(engine, pi, stapel, name, hi, slot, {source})` | `takeFromPile` → Zone → Instanz → Flug → **`onPlay`** → **`onCardEnterZone`** |

**Beide Hooks sind Pflicht.** Ausruestungen vergeben ihre Dauerwirkung in
`onPlay` (Blade of the Frostbringer: ATK nur dort); `onCardEnterZone`
oeffnet das Surprise-Fenster beim Ausruesten. Riffel feuerte bis v1267
nur letzteres und das mit `_skipReactionCheck` — ueber ihn angelegte
Ausruestung bekam ihre Dauerwirkung nicht. Nutzer: Weapon Collecting
Wight (Ablage), Future Tech Gunslinger Riffel (Deck), Treasure Hunter's
Backpack (Deck; nimmt nur die Wahl, legt mit eigener Animation an).

**Kreatur-Effekte und Knight of Kings [B]:** `blockedByPileLock` greift
NICHT bei aktiven Kreatur- und Helden-Effekten (nur Handspiel, Abilities,
Artefakte, Potions). Eine Kreatur, deren aktiver Effekt nur eine
Stapel-Bewegung ist, prueft `engine.isPileLockedFor(pi)` selbst in
`canActivateCreatureEffect` (Muster Weapon Collecting Wight) — die
Loader-Erkennung sieht Bewegungen in geteilten Helfern nicht.

## ★ v1269/v1270 — Kampf-Oberflaeche: Tooltip und Schleier, Goldgruppe

**Tooltip ueber dem Dialog-Schleier (v1269):** `body:has(.modal-overlay)
.board-tooltip, .tooltip { z-index: 10086 }` — knapp ueber dem Schleier
(10085, seit v1259). Ohne Dialog bleibt die Hand (10000) ueber dem
Tooltip (9999).

**Hovern durch den Schleier (v1270):** `useHoverDurchSchleier()` im
GameBoard reicht NUR das Hovern weiter — Klicks bleiben beim Schleier
(Abbruch abbrechbarer Dialoge, keine Brett-Aktionen waehrend eines
Dialogs). Mechanik: je Wechsel EIN `mouseout` vom alten zum neuen
Element; React leitet `onMouseEnter`/`onMouseLeave` daraus ab. Ein
`mouseover` mit React-Element als Herkunft ignoriert React — nicht
verwenden. Neue Brettzonen brauchen dafuer nichts: jede Zone mit
Hover-Tooltip funktioniert automatisch.

**Goldgruppe der eigenen Hand (v1270):** Sort/Shuffle + Gold stehen in
`.hand-rechts` (Flex, fester Abstand, waechst nach links) statt einzeln
absolut. Seitenzonen beider Haende ueber `--hand-zone` / `--hand-strich`
auf `.game-hand` (300/286 × Massstab, Telefon 320/306) — die Variablen
stehen VOR dem Telefon-Block, damit dessen Werte gewinnen.

## ★ v1271 — „Schaden an irgendeinem Ziel", Skull Carpet Bombing

**`ps.dealtDamageAnyTarget`** (Engine): wird gesetzt, sobald ein Effekt
dieses Spielers echten Schaden > 0 an IRGENDEIN Ziel verursacht — eigene
eingeschlossen. Dieselben drei Stellen wie `dealtDamageToOpponent`
(zwei Heldenpfade, Kreaturen-Batch), zurueckgesetzt zu JEDEM Zugbeginn
fuer beide Spieler; am Zugende gibt es also genau den Schaden dieses
Zuges wieder. Das Zugende-Fenster reicht es als
`info.dealtDamageAnyTarget` an `surpriseTurnEndTrigger` durch.
**Als Rulings 22.9. (bindend):** Status-Ticks ohne Verursacher zaehlen
nicht; auf 0 reduzierter Schaden zaehlt nicht als „dealt".

Voraussetzung ist der Verursacher im Aufruf: Kreaturschaden ueber
`actionDealCreatureDamage` braucht `opts.sourceOwner` (159 von 160
Aufrufen geben ihn an; die Ausnahme ist ein bewusst besitzerloser
Burn-Tick). Wer eine neue Schadensquelle baut, reicht ihn IMMER mit.

**„placed this card into your Surprise Zone this turn"** = `turnPlayed`
der Surprise-Instanz ist der aktuelle Zug — Setzen aus der Hand UND
Platzieren per Effekt (Als Ruling 22.9.).

**Skull Carpet Bombing:** Zugende-Surprise am EIGENEN Zug, harte
Einmal-Sperre `gs.hoptUsed['skull_carpet_bombing:<pi>']`, zwei getrennte
`ctx.aoeHit` (Gegner, dann ggf. eigene Seite). Animation
`skull_carpet_bombing` bleibt unter 1000 ms, weil `aoeHit` ohne eigene
Dauer sendet (der Dispatcher raeumt Zonen-Animationen sonst nach 1 s ab).

**Test-Harness-Lehre:** die Engine kuerzt Instanz-IDs auf 12 Zeichen
(`uuidv4().substring(0, 12)`). Ein `uuid`-Ersatz fuer Offline-Tests muss
sich VORNE unterscheiden, sonst kollidieren alle IDs und `_untrackCard`
raeumt gleichnamige Karten gemeinsam ab.

## ★ v1272 — Bilder aller Ziele gleichzeitig, Puzzle-Vorbelegung

**Als Regel 22.9.: die Animationen auf ALLEN Zielen laufen gleichzeitig.**
- `processCreatureDamageBatch` startet die Bilder (`animType`) ALLER
  Eintraege gemeinsam direkt vor der Anwendungsschleife und wartet EINMAL
  300 ms (vorher je Eintrag 300 ms nacheinander). Sicher an dieser
  Stelle, weil alle Umleitungs-, Reaktions- und Surprise-Fenster in den
  Durchgaengen darueber liegen. Markierung `e._bildGelaufen` verhindert
  Doppelbilder; Eintraege, die erst waehrend der Schleife hinzukommen,
  bekommen ihr Bild wie bisher einzeln.
- `actionAoeHit` sendet die Kreaturbilder im selben Augenblick wie die
  Heldenbilder (vorher erst im Batch NACH dem Heldenschaden).
- Die Schadenszahlen bleiben getaktet (Helden 150 ms, Kreaturen 200 ms).

**Puzzle-Vorbelegung:** der Loader datiert ALLE Brettzonen, die zu Beginn
eines normalen Spiels leer sind (Support, Surprise, Area, Permanent), auf
`turnPlayed = 0` zurueck — „lag schon vor Spielbeginn". Vorher nur
Support; vorgesetzte Surprises galten als „diesen Zug gesetzt" (Befund an
Skull Carpet Bombing). Helden und Abilities bleiben beim Startzug wie im
normalen Spiel.

## ★ v1273 — Skull Carpet Bombing: beide Seiten gleichzeitig, Unentschieden

- Trifft die Karte beide Seiten, dann in EINEM Flaechentreffer
  (`side: 'both'`) — Bilder und Schaden fuer beide Seiten im selben
  Durchgang (Als Vorgabe 22.9.), nicht mehr erst Gegner, dann eigene.
- **Als Vorgabe 22.9.: faellt dabei jeder Held beider Seiten, gewinnt der
  Nutzer.** Vertrag wie Bunny Bombs / Armageddon: `_deferGameOverCheck`
  um den Schlag, danach EINE Auswertung mit `_drawLoserIdx` = Gegner.
  Gilt auch ohne Eigenschaden (Rueckstoss kann die eigene Seite leeren).
- Faustregel fuer jede Karte, die beide Seiten trifft: ohne Aufschub
  entscheidet der erste toedliche Treffer, also die Reihenfolge der
  Ziele — und ohne Hinweis verliert im Unentschieden stillschweigend
  Spieler 0.

## ★ v1275 — Pseudonia, Heldensperren pro Spieler, gewonnene Effekte ueberleben den Tod

**Als Rulings 22.9. (bindend):**
- Heldeneffekte mit „once per turn" sind IMMER hard once per turn, und
  zwar — sofern nicht anders angegeben — pro SPIELER. Zwei Traeger
  desselben Effekts auf einer Seite (Pseudonia + wiederbelebtes
  Original) teilen sich den Ausloeser; spielerübergreifend nicht.
- Pseudonia nimmt bis zu drei Heldeneffekte auf, je Held einmal pro
  Partie, dauerhaft (auch ueber Tod und Wiederbelebung). Sie muss beim
  Tod des anderen Helden leben und darf nicht stummgeschaltet sein;
  faellt sie im selben Flaechentreffer, nimmt sie nichts auf.
- Ein verwandelter ??? gibt nur SEINEN Effekt, ein per eigenem Effekt
  aufgestiegener Throne Robber nur den Throne-Robber-Effekt; regulaer
  aufgestiegene Ascended Heroes geben den Effekt ihrer Form.
- ??? als Pseudonia verliert das Aufgenommene mit der Gestalt.

**Sperren:** aktive Heldeneffekte ueber `engine.heroHoptKey(name, pi)`
(vorher `…:<pi>:<heroIdx>`; Engine 6 Stellen, Server 2). Passive ueber
`_hero-hopt-shared.js` (`heldenSperreKey/-Frei/-Setzen/-Freigeben`),
Zugstempel am Spieler statt Merker an Instanz oder Held. Umgestellt:
Alleria, Baaliel, Cool Rescuer Monia, Deep-Drowned Waflav, Diamond,
Johanna, Kasperov [W], Key, Kyli, Orthos, Rafflesia, Rubin, Stellan,
Tarleinn, Tempeluna (gewonnene Feen nutzen jetzt den Schluessel der Fee
selbst), True Fairy Crestina, Waflav. Mary Crestmas behaelt ihre
Rueckstellung zu Beginn des eigenen Zuges, der Merker liegt jetzt am
Spieler. Waechter: `scripts/check-hero-hopt.js`.

**`engine.heroEffectIdentity(pi, hi)`:** der Name, dessen Effekt ein
Held „eigentlich" traegt — `_shapeshiftBase`, sonst eine geliehene
HELDEN-Identitaet aus `_identityCleanupCard`, sonst `hero.name`.

**Heldentod:** `handleHeroDeathCleanup` raeumt die unsichtbaren Traeger
gewonnener Effekte (`_gainedEffectOnly`) nicht mehr ab. Vorher landete
der Heldenname als Geisterkarte in der Ablage und der Effekt verlor
seine Hooks, waehrend `gainedEffectNames` blieb.

**Vormerken im Flaechentreffer:** eine Reaktion, die „gleichzeitig
gestorben" ausschliessen muss, merkt waehrend `engine._multiHitScope`
nur vor und entscheidet an einem Nachlauf-Hook (Muster Pseudonia).

## v1276 — Artefakt-Flug, Lautstaerke in Kopfzeilen

- Gewoehnliche Artefakte (`doUseArtifactEffect`) fliegen nicht mehr in die
  „Permanents-Zone": kein Artefakt wird zum Permanent, und ohne gerenderte
  Zeile landete der Flug beim MITTLEREN HELDEN (Befund Treasure Chest).
  Sie verhalten sich wie Zauber: aufdecken, aufloesen, Ablage. Der Client
  faellt bei `zoneType: 'permanent'` nicht mehr auf den mittleren Helden
  zurueck — ohne Zeile kein Flug.
- `.top-bar > .volume-control:last-child { margin-left: auto }`: die
  Lautstaerkeregelung als letztes Element einer Kopfzeile sitzt immer am
  rechten Rand (Befund: PvP-Raum „GAME LOBBY" hatte keinen Abstandhalter).

## v1277 — `_spellFreeAction` gehoert zu GENAU EINER Aufloesung

Befund (Al 22.9.): Fire Bolts (verstaerkt, Main 1) mit Bartas-Zweitguss,
danach Phoenix Tackle in der Action Phase → die Phase blieb stehen, als
gaebe es noch eine freie Aktion. Ursache: der Server wertet
`_spellFreeAction` VOR `afterSpellResolved` aus; Bartas' Zweitguss laeuft
darin, Fire Bolts hielt sich dort wieder fuer den ersten Destruction-
Zauber (die Karte ist dann noch „in flight" und wird bewusst
uebersprungen), verstaerkte sich und setzte das Flag erneut — der
naechste Zauber verbrauchte es.

- Bartas klammert den Zweitguss: `_spellFreeAction` und
  `_spellForcesActionConsume` stehen danach wieder auf dem Stand davor.
  Ein Zweitguss ist kein neues Ausspielen.
- Sicherheitsnetz: `doPlaySpell` loescht `_spellFreeAction` zu Beginn
  der Aufloesung und beide Flags im Aufraeumblock am Ende; der
  Direktguss-Weg der Engine loescht es vor dem Guss.
- Zweite Quelle desselben Lecks: Bifab und String of Fine setzen das
  Flag beim Spielen vom Coolness Stack, der nie eine Aktion kostet und
  es nie auswertet — es machte den NAECHSTEN Zauber zur Freiaktion.
  Jetzt vom Sicherheitsnetz verworfen.
- Regel fuer neue Karten: `_spellFreeAction` / `_spellForcesActionConsume`
  nur im `onPlay` des Zaubers selbst setzen; Wirkung auf einen SPAETEREN
  Zauber ueber diese Flags ist nicht vorgesehen.

## v1278 — Homerun! nur noch bei Schaden ≥ max HP

Befund (Al 22.9.): Homerun! wurde KONSTANT angeboten. Ursache: ein
lockerer Einstieg im Nach-Zielwahl-Fenster (`isPostTargetReaction`) —
dort ist der Betrag unbekannt, also bot er sich an, sobald ein eigener
Held Ziel eines Schadenseffekts war. Entfernt, samt der Marken.

Es bleibt das Vor-Schaden-Fenster (`isPreDamageReaction`) mit dem
ENDGUELTIGEN Betrag: Angebot nur bei Betrag ≥ max HP; `negated: true`
hebt den Treffer samt On-Hit-Effekten auf.

**Vertrag erweitert:** `preDamageCondition(gs, pi, engine, target, heroIdx,
source, amount, type, { cannotBeNegated, cannotBeReduced })` — der neunte
Parameter ist optional. Reaktionen, die nur AUFHEBEN, bieten sich bei
durchschlagendem Schaden damit gar nicht erst an (statt bezahlt und dann
von der Engine verworfen zu werden).

**Faustregel:** eine Reaktion mit Betragsschwelle („damage equal to or
greater than …") gehoert ins Vor-Schaden-Fenster, nie ins Nach-Zielwahl-
Fenster — dort kennt niemand den Betrag.

## v1279 — Abwurfkosten unter Boris, Potions, die liegen bleiben

**Abwurfkosten (Als Befund 22.9.):** Effekte mit Abwurfkosten waren bei zu
kleiner Hand nicht aktivierbar — auch dann nicht, wenn Boris die Kosten
ohnehin erlaesst. Neu:
- `engine.discardCostWaived(pi)` — fragt die Helden ueber den Vertrag
  `waivesDiscardCosts(engine, pi)` (heute nur Boris). Die
  Spielbarkeits-Listen (`getHeroEligibleActionCards`,
  `getHeroPlayableCards`, beide Seiten) lassen einen Wisdom-Abwurf dann
  nicht mehr an der Handgroesse scheitern.
- Boris verzichtet ohne Rueckfrage, sobald die Hand die Kosten nicht
  tragen kann (auch bei leerer Hand — dort stieg er vorher ganz aus).
  Ist der Abwurf bezahlbar, fragt er wie bisher: „You MAY ignore".

**Potions, die sich selbst aufs Brett legen** (`resolve` liefert
`{ placed: true }`, Elixir of Immortality): der normale Weg
(`doUsePotion`) liest den Rueckgabewert, die DIREKTEN Wege verwarfen ihn
und schrieben die Karte zusaetzlich in die Loesch-Ablage — eine
Geisterkarte neben dem echten Permanent. Umgestellt:
- `_potion-shared.js`: `loesePotionAus` liefert bei Erfolg
  `{ gewirkt: true, placed }`; `potionBleibtLiegen(ergebnis)` ist die
  Frage fuer den Aufrufer (Tuscan Mystic, Future Tech Potion Launcher).
- Mischief Militia - Colored Snow reicht den Rueckgabewert in beide
  Zweige seiner Weiterleitung durch.
- Jede neue Karte, die eine Potion direkt aufloest, MUSS den
  Rueckgabewert auswerten, statt pauschal zu entsorgen.

**Elixir of Immortality** sendet beim Ablegen jetzt
`play_permanent_animation` (`holy_revival` → Klang `revive`) — vorher
sendete es dort gar nichts und blieb auf JEDEM Weg stumm; der Klang beim
Ausloesen (v1263) war davon unberuehrt.

## v1280 — Chilly Dog auch eingefroren, Prophecy-Deckel, Tooltip durch den Schleier

**Mischief Militia - Chilly Dog** (Textaenderung 22.9.: „(including this
one)"): ein EINGEFRORENER Chilly Dog wirkt jetzt weiter — auch fuer sich
selbst. Die Wirksamkeitspruefung `_isChillyDogActiveFor` fragt dafuer
`isCreatureEffectSuppressed(inst, { ignoriereFrozen: true })` statt
`isCardEffectActive`; die neue Option ist der einzige Weg, den eigenen
Frost auszublenden, ohne die Rekursion von v1263 (Stack Overflow)
zurueckzuholen. Negated, Stunned, Nulled, Magic Silenced legen ihn
weiterhin stumm.

**Prophecy of Tempeste:** „Damage this Hero would take cannot exceed 100"
galt nur fuer den UMGELEITETEN Treffer. Jetzt deckelt die Karte JEDEN
Treffer gegen ihren Traeger (`beforeDamage` → `ctx.setAmount(100)`).
`setAmount` ist der absolute Weg und beachtet `cannotBeReduced` — echter
Durchschlag-Schaden (Ida, Monia-Bot) bleibt wie ueberall unbeschnitten.

**Tooltips beim Hovern DURCH einen Dialog-Schleier (v1270):** der
Tooltip hat eine Sicherung, die alle 300 ms prueft, ob noch ein Element
per CSS `:hover` unter dem Zeiger liegt. Beim Durchreichen liegt der
echte `:hover` auf dem SCHLEIER — jeder so gezeigte Tooltip verschwand
darum sofort wieder (Befund: Infiltration-Overlay). Das durchgereichte
Element traegt jetzt die Marke `pp-hover-durch`, `useCardTooltip` zaehlt
sie mit. Wer eine eigene Hover-Sicherung baut, nimmt die Marke auf.

## v1281 — Menuebreiten unter `zoom`: `--menu-vw`

Befund (Al 22.9.): im Vollbild sass der Avatar im Hauptmenue falsch —
er ragte ueber den linken Bildrand und ueberlappte den Top-Players-
Kasten. Ursache: die Breiten mischten `%` (vom GEZOOMTEN Menue) mit `vw`
(vom UNGEZOOMTEN Fenster). Gemessen bei 1920×1080 (Zoom 1.2): Kasten 564
statt 470 px, Gasse nur 89 px, Avatar 192 px → Ueberstand 52 px nach
links; bei 2560×1440 (Zoom 1.6) noch mehr.

`--menu-vw` ist 1 vw in LAYOUT-Pixeln (Fensterbreite / Zoomfaktor),
gesetzt im Messlauf des Hauptmenues (app-screens.jsx, neben `panelTop`).
Daraus leiten sich `--menu-seite` (Breite der Seitenkaesten) und
`--menu-gasse` (linke Gasse) ab; der Avatar misst
`clamp(56px, var(--menu-gasse) - 48px, 160px)`. Ohne gemessenen Wert
faellt alles auf `1vw` zurueck (Verhalten bei Zoom 1).

**Faustregel (dieselbe wie beim Editor-Scaler und beim UiScaler):** unter
`zoom` sind `vw`/`vh` GEZEICHNETE Pixel, `%` und `px` LAYOUT-Pixel — in
einer Rechnung nie mischen.

## v1282 — Elixir of Immortality: verspaetete Wiederbelebung

Befund (Al 22.9.): ein gestohlener „Bear Rider" toetete per KREATUR-EFFEKT
eine eigene Creature — das Elixir tat nichts. Es loeste erst aus, als der
Gegner danach mit einer Attack einen Helden traf.

Das Elixir SAMMELT Tode (`afterCreatureDamageBatch`, `onHeroKO`) und
loest sie an Nachlauf-Punkten ein. Die waren: `afterAllStatusDamage`,
`afterSpellResolved`, `onPhaseEnd` — ein aktiver Kreatureffekt ist
keiner davon. Neu dabei: `afterCreatureEffect` (nach JEDEM
abgeschlossenen aktiven Kreatureffekt, auch einem geliehenen) und
`onAnyActionResolved` (Sammelpunkt aller uebrigen Aktionswege). Alle
fuenf Punkte laufen ueber EINEN Helfer (`loeseAusstehende`).

**Faustregel fuer jede Karte, die Tode sammelt und spaeter einloest:**
die Einloesepunkte muessen ALLE Aktionswege abdecken, nicht nur Zauber —
sonst haengt die Wirkung an der naechsten fremden Aktion.

## v1283 — Colored Snow: Klaenge und Ziel der Enthuellung

- **Klaenge** (Als Befund 22.9.: „der Effekt hat noch keine Sounds, wenn
  die Potion auf den Screen gezogen und umgedreht wird"): sie liegen auf
  den Zeitpunkten der Animation `colored-snow-reveal-in` (1500 ms) —
  `projectile` beim Herausziehen, `reveal` bei 900 ms (die Drehung laeuft
  von 60 bis 80 %), `placement` beim Landen (entfaellt im `handoff`, dort
  gehoert Bild UND Klang dem anderen Flug).
- **Ziel `permanent`** (Als Befund 22.9.): eine Potion, die sich selbst
  als Permanent ablegt (Elixir of Immortality), aendert keinen der
  Stapel, die `_detectPotionDestination` zaehlt — der Flug ging deshalb
  in die Loesch-Ablage. Die Erkennung zaehlt jetzt auch `ps.permanents`
  und meldet `{ kind: 'permanent', owner, permId }`; der Client fliegt
  zum Platz des Permanents (`[data-perm-id]`), ersatzweise zur
  Permanents-Zeile.

## v1284 — `onAnyActionResolved` in JEDEM Aktionsweg, Pseudonia 550 HP

Befund (Al 22.9.): „Book of Doom" toetete einen eigenen Helden, Pseudonia
reagierte nicht. Book of Doom klammert seine Ziele als Flaechentreffer —
Pseudonia merkt eine Aufnahme dort nur VOR und loest sie an einem
Nachlauf-Punkt ein. Der Sammelpunkt `onAnyActionResolved` fehlte aber im
ARTEFAKT-Weg (und im Trank-Weg), obwohl die Engine ihn als „alle
Action-Pfade" beschreibt. Beide feuern ihn jetzt; Waechter:
`scripts/check-action-hook.js` (prueft doPlaySpell, doPlayCreature,
doActivateAbility, doUseArtifactEffect, doUsePotion).

**Pseudonia** hat 550 statt 400 HP (Balancing 22.9.).

**Colored Snow:** legt sich die enthuellte Potion selbst als Permanent ab,
steht sie im Spielstand, sobald ihr Effekt aufloest — also waehrend die
Karte noch in der Bildmitte liegt. Ihr Platz bleibt deshalb verdeckt
(`csVerdeckt`, Schluessel `${owner}-${cardName}`), bis der Flug dorthin
angekommen ist.

## v1285 — Zielwahl-Weg, Partikel nach dem Flug, Menue gewonnener Effekte

- **`onAnyActionResolved` im Zielwahl-Weg:** ZIELENDE Artefakte und
  Traenke (Book of Doom) loesen in `doConfirmPotion` auf, nicht in
  `doUseArtifactEffect` — dort fehlte der Sammelpunkt noch (Befund:
  Pseudonia reagierte nicht auf einen so getoeteten Helden). Der
  Waechter `check-action-hook` deckt jetzt sechs Wege ab.
- **Bild und Klang nach dem Flug:** ein `play_permanent_animation` fuer
  ein Permanent, dessen Platz noch unter der Colored-Snow-Enthuellung
  verdeckt ist (v1284), wird zurueckgestellt und laeuft erst, wenn die
  Karte sichtbar wird.
- **Menue der Heldeneffekte:** `heroEffectSource(hero)`
  (`_gained-effects-shared.js`) nennt die Karte, die den AKTIVEN Effekt
  stellt — eigenes Skript zuerst, danach die gewonnenen. Engine und
  Server fragten dafuer das VERSCHMOLZENE Skript und schrieben den
  Heldennamen in den Eintrag; Pseudonia stand damit selbst im Menue,
  obwohl sie keinen aktiven Effekt hat. Sperre und Einmal-pro-Spiel
  laufen ueber denselben Namen — ein gewonnener Effekt teilt sie mit
  dem Original (v1275).

## v1286 — Todeslage robust, Permanent-Bild wartet zuverlaessig

- **Pseudonia** sucht den toten Helden nicht mehr nur ueber die
  Objektidentitaet in der Heldenreihe, sondern faellt auf
  `gs._heroKOContext` zurueck (die Engine setzt ihn um den
  ON_HERO_KO-Hook). Wird der Held waehrend der Todeskette ersetzt oder
  aus der Reihe genommen — etwa durch eine sofortige Wiederbelebung —,
  verpuffte die Aufnahme vorher lautlos. Faustregel: ein Todes-Hook darf
  sich nie allein auf die Objektidentitaet des Opfers verlassen.
- **`play_permanent_animation`** wird zurueckgestellt, sobald fuer diese
  Seite eine Colored-Snow-Enthuellung unterwegs ist. Die alte Pruefung
  suchte das Permanent in der Liste des Handlers — die zeigt den Stand
  seines Renders, in dem das neue Permanent oft noch fehlt, und das Bild
  lief dann doch sofort.

## v1287 — Menue ohne Doppel, Platz-Einschlag nach der Landung

- **Menue der Heldeneffekte:** der EIGENE Zweig (Server
  `availableEffects`, Engine `getActiveHeroEffects`) nimmt nur noch den
  GEDRUCKTEN Aktiveffekt des Helden (`eigenesHeldenSkript(hero)` in
  `_gained-effects-shared.js`). Gewonnene Aktiveffekte stehen ueber ihre
  Traegerinstanzen (`treatAsEquip`) ohnehin im Menue — v1285 liess den
  ersten zusaetzlich im eigenen Zweig einlaufen, er stand doppelt da
  (Befund Pseudonia). Ein Held ohne eigenen Aktiveffekt erscheint gar
  nicht. `heroEffectSource` bleibt fuer Fragen „wer stellt den Effekt".
  Hinweis: Traeger-Eintraege nennen ihre Karte in `equippedCard`, nicht
  in `effectName`.
- **Einschlag beim Platzieren (v1206):** ein neuer Permanent-Platz
  (`p:`-Schluessel der Belegungskarte) wartet, solange fuer diese Seite
  eine Colored-Snow-Enthuellung unterwegs ist, und wird bei der Landung
  nachgeholt — zusammen mit Bild und Klang (v1285/v1286).

## v1288 — Hook-Prioritaet, Fenster vor der Wiederbelebung, Handzaehlung

- **`hookPriority`** (Kartenvertrag, `{ [hookName]: Zahl }`): hoehere Zahl
  laeuft in `runHooks` ZUERST, noch vor „Spieler am Zug zuerst". Ohne
  Angabe 0 — fuer alle anderen Karten bleibt die Reihenfolge gleich.
- **`beforeHeroRevive`** (`HOOKS.BEFORE_HERO_REVIVE`): feuert in
  `actionReviveHero` unmittelbar vor der Wiederbelebung, der Held ist
  noch tot. ALLE echten Wiederbelebungen laufen ueber diese Funktion;
  Todes-VERHINDERER (Guardian Angel: „would be defeated → heal instead")
  nicht — dort stirbt niemand.
- **Pseudonia** (Als Vorgabe 22.9.: „vor JEDEM Revival-Effekt"): Prioritaet
  100 im Todesfenster und in allen Einloesefenstern, dazu
  `beforeHeroRevive` — eine vorgemerkte Aufnahme wird dort sofort
  entschieden, auch mitten im Schlag.
- **Elixir of Immortality** sammelt jetzt auch waehrend einer
  Flaechenklammer (`engine._multiHitScope`), nicht nur bei Zaubertiefe > 0.
  Vorher loeste es bei einem Artefakt-Flaechentreffer (Book of Doom) schon
  beim ersten Toten aus — wer mehrere Ziele zugleich verlor, konnte nicht
  waehlen.
- **`handSizeWithoutResolving(ps)`** (`_hand-resolve.js`, Engine-Methode
  gleichen Namens): Handgroesse ohne die aufloesende Karte — aber nur,
  wenn sie wirklich IN DER HAND liegt. Aus der Creation Zone gewirkt
  (True Fairy Crestina) liegt sie dort nicht. Supply Chain zog deshalb bis
  8 (Befund 22.9.); Handlimit und Pollution rechnen jetzt ebenso.
- **`engine.handFodderFor(pi, cardName)`**: Abwurfmaterial fuer
  Wisdom-Kosten. Reine Handkarte −1, liegt sie (auch) in der Creation Zone,
  steht die ganze Hand bereit. Die drei Spielbarkeits-Listen zogen
  pauschal 1 ab. Beim Spielen auf einen GEGNERISCHEN Helden zahlt der
  HANDELNDE Spieler — v1279 fragte dort faelschlich Boris des Gegners.

