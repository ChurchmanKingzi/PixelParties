# R02-reaction-area-attach-surprise – Nischenfall-Bericht
Stand/Autor: Agent R02-reaction-area-attach-surprise, 13.10.2026. Karten: 43 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### R02-01 · Mountain Tear River: „… or a Creature in one of its Support Zones is chosen" löst nie aus · Stufe A
- **Karten:** Mountain Tear River (`cards/effects/mountain-tear-river.js`), Engine `_checkSurpriseWindow`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1: Mountain Tear River in der Surprise Zone von Held 0 (Destruction Magic 1), eine Kreatur in Support Zone 1 von Held 0. Sitz 0: Burning Finger / Fireball / Pusher auf der Hand bzw. Cannon Tower auf dem Brett.
- **Schritte:** 1. Sitz 0 wählt die KREATUR von Sitz 1 mit (a) Burning Finger (Einzelziel-Spell), (b) Fireball, (c) Pusher (Attack), (d) Cannon Tower (Kreatureneffekt).
- **Erwartet** (Kartentext „Activate this Surprise when the user or a Creature in one of its Support Zones is chosen by an Attack, Spell or Creature effect. Burn the attacker."; Skriptkopf v703 `surpriseFiresOnSupportCreature`): in allen vier Fällen kommt die Frage „Mountain Tear River", der Angreifer (Held bzw. Cannon Tower) brennt.
- **Beobachtet:** nie eine Frage, nie ein Brand; der Seitenschaden an der Kreatur geschieht normal. Das Surprise-Fenster wird für das Kreaturenziel gar nicht geöffnet. Gegenprobe: wird der HELD gewählt, feuert die Karte.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/01-mountain-tear-river-kreatur-gewaehlt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Zielwahl-Eingänge (`promptDamageTarget`, `promptMultiTarget`, Dispatcher) liefern gewählte Kreaturen als `type: 'equip'` (`_engine.js` ~4927/5515), das Surprise-Fenster verlangt aber `type === 'creature'` (`_engine.js` ~34974) und die Eingänge filtern vor dem Aufruf auf `hero`/`creature` (~5353, ~5859). Nur der Flächen-Pfad (`aoeSurpriseVorab`) liefert `'creature'` – dort sperrt Mountain Tear River selbst („chosen" ⇒ keine Fläche). Die `surpriseFiresOnSupportCreature`-Klausel ist damit toter Code.

### R02-02 · Umleiter/Negierer (Martyry, Rolling Boulder) sehen Mehrfachziel-Wahlen nie (Fireball, Mr. Jiggles) · Stufe A
- **Karten:** Martyry (`martyry.js`), Rolling Boulder (`rolling-boulder.js`); betrifft jede Zielumleitung (Challenge, Anti-Magnet, Monia Bot …), soweit sie am `applyRedirectWindows` hängt.
- **Voraussetzungen / Aufbau:** (a) Sitz 1: Martyry auf der Hand (Held 1 mit Support Magic 1). Sitz 0 spielt Fireball und wählt GENAU EIN Ziel (Held 0 von Sitz 1). (b) Sitz 1: Rolling Boulder (Held 1). Sitz 0 aktiviert Mr. Jiggles („choose up to 2 targets … 100 damage") und wählt GENAU EIN Ziel.
- **Erwartet** (Martyry: „when a target you control is chosen by an Attack, Spell or Creature effect"; Rolling Boulder: „when your opponent chooses exactly 1 target you control with the effect of a Creature"; Ruling `_engine.js` ~29065 „ein Umleiter reagiert auf JEDES Ziel EINZELN", bindend 31.8.): (a) Martyry wird angeboten; (b) Rolling Boulder negiert und besiegt Jiggles.
- **Beobachtet:** (a) kein Angebot, Fireball trifft (650 HP), Martyry bleibt auf der Hand. (b) kein Angebot, Jiggles trifft (700 HP) und lebt. Gegenproben mit Einzelzielpicker (Burning Finger, Cannon Tower) lösen aus.
- **Repro:** `docs/niche-tests/repro/R02-reaction-area-attach-surprise/02-umleiter-mehrfachziel-picker.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `promptMultiTarget` (`_engine.js` ~5799) ruft `promptEffectTarget` ohne `_redirectSource`/`sourceCard`; `_redirectSourceFor()` liefert dann `null` und `applyRedirectWindows` kehrt in der ersten Zeile zurück (`if (!sourceCard) return pickedIds`, ~29116). `promptDamageTarget` öffnet das Fenster selbst, deshalb funktionieren Einzelziel-Picker.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
