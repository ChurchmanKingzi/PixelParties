'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Sinister Idol"
//  Artifact (Reaction, Cost 2)
//
//  „Play this card immediately when your opponent activates the active effect of a level 3 Ability.
//   Before the Ability resolves, remove the top copy of it from the user. The Ability then resolves at the lowered level."
//
//  ── AUSLEGUNG (W82, Vorgaben von Al) ─────────────────────────────
//  • KETTENFENSTER auf die AKTIVIERUNG einer Ability (wie Ragnarock): die Initialkarte der Kette ist eine Ability (`cardType 'Ability'`, `fromBoard` — beide Aktivierungswege
//    `doActivateFreeAbility` und `doActivateAbility`; das Anlegen aus der Hand ist keine Aktivierung). Das Glied trägt `abilityZone` ({ heroOwner, heroIdx, zoneIdx, zoneKind, level }) —
//    der Stapel, der aktiviert wird. „Level 3" = dieser Stapel hat beim Öffnen des Fensters genau 3 Karten (Stufe = Stapelhöhe; Support-Zonen-Stapel von Xal/Xalibur zählen mit).
//    „Active effect" (Al: statt des früheren „once per turn effect"): JEDE Aktivierung des aktiven Effekts einer Ability am Brett — freie und Aktions-Aktivierung, auch Abilities, die
//    mehrfach pro Zug nutzbar sind; passive/Dauerwirkungen öffnen kein Fenster. Das Fenster hängt an der Aktivierung, nicht an der Einmal-pro-Zug-Sperre. Aktivierungswege mit Fenster:
//    `doActivateFreeAbility`, `doActivateAbility` (auch Lizbeth/Smugbeth-Leihe, Charme Lv 3, Support-Zonen-Stapel), die geliehene Ability von Charme Lv 1, die Aktivierung als Sofort-Zusatzaktion
//    (`_resolveImmediateActionPick`: Guardian Beast Hu, Celia …) und die Zusatznutzung der Secret Lab Entrance (Al: ja) — die drei letzten über `engine.abilityAktivierungsFenster`
//    (Initialglied mit `abilityZone`, Surprise-Fenster, Stufe danach neu gelesen). Vollständige Wegeliste: CARD_API, Abschnitt „Welle 82 — Sinister Idol".
//    Wird die Aktivierung einer ZUSATZaktion im Fenster NEGIERT (Ragnarock …), bleibt die Zusatzaktion unverbraucht (Al): Sofort-Aktion = der Auswahl-Prompt geht erneut auf (ist nichts mehr zu wählen,
//    ist sie weg), Anbieter-Zusatzaktion = Anbieter zurück; Einmal-Stempel der negierten Ability nach Z7b frei. Secret Lab Entrance ist keine Zusatzaktion in diesem Sinn (Lab-Stempel bleibt gesetzt).
//  • „your opponent activates": der Aktivierer ist ein Gegner des Idol-Spielers (2–4 Sitze). Bezauberte/geliehene Abilities (Charme Lv 3, Lizbeth/Smugbeth): das Glied
//    trägt den Stapel, der aktiviert wird — die Kopie fällt von DIESEM Stapel („the user" = der Held, auf dem sie liegt), auch wenn er dem Idol-Spieler gehört.
//  • Wirkung: BEVOR die Ability auflöst (die Kette löst rückwärts auf, die Initialkarte zuletzt) wird die OBERSTE Kopie des Stapels in die ABLAGE ihres Besitzers geschickt
//    (`discardAbilityTopCopy`: Flug Brett → Ablage, Besitzer-Regel der Stapel, Leave-Hooks — Fighting nimmt seinen ATK-Bonus zurück …). Als Effekt auf den Helden fragt die Engine
//    Resistance (`effectOnHero`); bleibt die Kopie liegen (Resistance, Leafagami Snake), bleibt die Stufe 3.
//    Idol NEGIERT die Aktivierung nicht — sie läuft weiter („The Ability then resolves at the lowered level"): der Server liest die Stufe NACH dem Fenster neu
//    (`abilityStufeNachKette`, server.js), die Auflösung rechnet alle stufenabhängigen Werte (Wirkung, Ziele, Mengen) mit der gesenkten Stufe.
//  • KOSTEN der Ability (Al): sie bleiben die der Stufe BEIM Aktivieren — der Aktivierer zahlt nie rückwirkend nach der gesenkten Stufe (Alchemy Lv 3: gratis, auch wenn Idol auf
//    Stufe 2 senkt; Diplomacy Lv 3: 5 Gold). Technik: `ctx.kostenStufe` (server.js setzt sie auf die Stufe beim Aktivieren); nur Skripte mit stufenabhängigem GOLD-Preis
//    (Alchemy, Diplomacy) lesen sie. Abwurf-/Zugmengen (Inventing, Leadership, Navigation, Trade …) sind Teil der Wirkung und folgen der gesenkten Stufe.
//  • PFLICHT-AUFLÖSUNG (Al): hat Idol die Stufe gesenkt, darf der Aktivierer die Auflösung nicht mehr abbrechen. Zentral: `engine.mitPflichtAufloesung` setzt den vorhandenen Zwangs-Kontext
//    `gs._forcedCommitPlayer` (Learning/Copy Device) um die Auflösung — jede Wahl des Aktivierers (Ziel-, Karten-, Zonen-, Optionswahl) hat keinen Abbrechen-Knopf, die CPU nimmt die Pflichtantwort, der
//    Server weist einen Abbruch ab (`_abbruchGesperrt`: `cancel_potion`/`effect_prompt_response`). „You may"-Fragen (Ja/Nein) bleiben echte Entscheidungen: ein „No" (oder keine mögliche Wahl) lässt die
//    Ability wirkungslos, die Aktivierung und die Einmal-pro-Zug-Sperre bleiben VERBRAUCHT (Log `sinister_idol_declined`). Abilities ohne Wahl sind unberührt; Reaktionen/Fragen an den Gegner behalten ihren Abbruch.
//  • Charme Lv 1 (Al: Lücke geschlossen): die geliehene Ability wird aktiviert — Charme öffnet dafür ein Kettenfenster (`executeCardWithChain` + Surprise-Fenster, `charme.js` `_activateLv1`). Identität:
//    die geliehene Ability mit der Stufe IHRES Stapels (Charme ändert die Stufe nicht); die Kopie fällt vom Stapel des Gegners, „the user" = der Held, auf dem sie liegt (wie bei Lizbeth/Smugbeth).
//    Das trifft den Idol-Spieler selbst (es ist sein Stapel) — die CPU spielt das nie. Alternative Lesart (nicht gebaut): keine Kopie entfernen, nur die Stufe dieser Auflösung senken.
//  • Mehrere Idols: ein zweites Idol wird auf dieselbe Aktivierung nicht mehr angeboten, solange eins in der Kette liegt; löst es trotzdem auf (zwei Sitze), sieht es Stufe 2 und
//    verpufft („Level 3" nicht mehr erfüllt). Wird die Aktivierung selbst negiert (Ragnarock, Master's Plan …) bevor Idol auflöst, passiert nichts.
//  • Kosten 2 Gold: die Kettenmaschine zahlt beim Einsetzen (`_rxPay`); bei fehlendem Gold wird die Karte nicht angeboten.
//
//  ── Bild und Klang ─────────────────────────────────────────────────
//  Zonen-Animation `sinister_idol` (Client, Pixelart, ~2 s) AUF der Ability: Runensiegel und Nebel, der Götze aus dem Kartenbild (Gold/Stein mit Shading und Dithering, glühende Augen) löst
//  sich aus dem Nebel, Fluchranken und Schädel; beim Beat (~1 s) fliegt die oberste Kopie sichtbar vom Brett in die Ablage (`ability_zone_to_discard`), ein Schweif aus Fluchstaub begleitet sie
//  (`ablageBesitzer`) und schlägt auf dem Ablagestapel auf.
//
//  ── CPU ────────────────────────────────────────────────────────────
//  `cpuMeta.reactionHeuristic`: nur gegen Level-3-Abilities des Gegners, deren Stufe-2-Wirkung spürbar schwächer ist (Charme, Singing, Occultism, Trade, Training …); nie gegen
//  Abilities, die auf Stufe 2 gleich viel wirken (Alchemy: Kosten bleiben), nie auf einen Stapel der eigenen Seite.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Sinister Idol';
const ANIM_VOR_MS = 1000;  // Siegel, Götze und Ranken bauen sich auf, dann Beat: die Kopie fliegt (deckt sich mit `sinister_idol`/`FLUG_AB` im Client, Einbau-Versatz 100 ms)
const FLUG_MS = 900;       // Flug der Kopie Brett → Ablage (500 ms) + Aufprall und Nachlauf der Animation

/** Abilities, deren Stufe-2-Wirkung gegenüber Stufe 3 deutlich schwächer ist (für die CPU). */
const CPU_STARK = new Set([
  'Charme', 'Diplomacy', 'Singing', 'Necromancy', 'Occultism', 'Trade', 'Thieving', 'Training', 'Trapping',
  'Infiltration', 'Inventing', 'Leadership', 'Luck',
]);

/** Der aktivierte Stapel (live) — Namen-Array oder null. */
function stapelDerKette(engine, az) {
  if (!az) return null;
  return engine.abilityStapelAn(az.heroOwner, az.heroIdx, az.zoneKind === 'support' ? 'support' : 'ability', az.zoneIdx) || null;
}

module.exports = {
  // Reaktions-Artefakt aus der Hand (Kettenfenster der Engine), nie proaktiv spielbar.
  isReaction: true,
  canActivate: () => false,
  neverPlayable: true,

  /**
   * Angeboten, wenn die Initialkarte der Kette die AKTIVIERUNG einer Ability des GEGNERS ist und der aktivierte Stapel genau Stufe 3 hat. Wird auch ohne Kette gerufen
   * (Hand-Ausgrauen) — dann `false`.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    const chain = chainCtx?.chain;
    if (!chain || chain.length < 1) return false;
    const init = chain[0];
    if (!init || !init.isInitialCard || init.negated) return false;
    if (init.cardType !== 'Ability' || init.fromBoard !== true) return false;
    if (!engine.opponentsOf(pi).includes(init.owner)) return false;          // „your opponent activates"
    if (chain.some(l => l.cardName === CARD_NAME && !l.negated)) return false; // ein zweites Idol auf dieselbe Aktivierung ist sinnlos (es sähe Stufe 2)
    const st = stapelDerKette(engine, init.abilityZone);
    return !!st && st[0] === init.cardName && st.length === 3;                // „a level 3 Ability"
  },

  /** Reaktion beim Auflösen (LIFO, vor der Ability): die oberste Kopie vom Helden in die Ablage. */
  resolve: async (engine, pi, _selectedIds, _validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const link = chain[0];
    const az = link?.abilityZone;
    if (!link?.isInitialCard || link.negated || !az) return;                  // Aktivierung bereits negiert → die Ability löst nie auf
    const st = stapelDerKette(engine, az);
    const hero = gs.players[az.heroOwner]?.heroes?.[az.heroIdx];
    if (!st || st[0] !== link.cardName || st.length !== 3) {                  // Stufe seit dem Anbieten verändert (z. B. ein anderes Idol) → verpufft
      engine.log('sinister_idol_fizzle', { player: gs.players[pi]?.username, ability: link.cardName, hero: hero?.name || null, level: st?.length ?? 0 });
      return;
    }

    // Fluch-Animation AUF der Ability, danach fliegt die oberste Kopie sichtbar Brett → Ablage.
    engine._broadcastEvent('play_zone_animation', {
      type: 'sinister_idol', owner: az.heroOwner, heroIdx: az.heroIdx,
      ...(az.zoneKind === 'support' ? { zoneSlot: az.zoneIdx } : { zoneType: 'ability', zoneSlot: az.zoneIdx }),
      ablageBesitzer: az.heroOwner,   // der Client zeichnet Schweif und Aufprall bis zu dieser Ablage (der Flug der Kopie geht dorthin)
    });
    await engine._delay(ANIM_VOR_MS);

    const eintrag = engine.getAbilityTargets(az.heroOwner, { heroIdx: az.heroIdx })
      .find(e => e.zoneKind === az.zoneKind && e.slotIdx === az.zoneIdx && e.cardName === link.cardName);
    if (!eintrag) return;
    await engine.discardAbilityTopCopy(eintrag, { source: CARD_NAME, sourceOwner: pi, effectOnHero: true });   // Effekt auf den Helden → Resistance fragt
    await engine._delay(FLUG_MS);

    const neu = stapelDerKette(engine, az);
    engine.log('sinister_idol', {
      player: gs.players[pi]?.username, ability: link.cardName, hero: hero?.name || null, level: neu && neu[0] === link.cardName ? neu.length : 0,
    });
    engine.sync();
  },

  cpuMeta: {
    reactionHeuristic(engine) {
      const src = engine._currentEffectSource;
      const az = src?.abilityZone;
      if (!az || src.cardType !== 'Ability') return false;
      if (az.heroOwner !== src.owner) return false;                           // nie auf einen Stapel der eigenen Seite (bezaubert/geliehen)
      return CPU_STARK.has(baseCardName(src.cardName));
    },
  },
};
