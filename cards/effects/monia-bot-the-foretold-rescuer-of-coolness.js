// ═══════════════════════════════════════════
//  CARD EFFECT: "Monia Bot, the Foretold Rescuer of Coolness"
//  Ascended Hero — 800 HP / 120 ATK — Ascension bonus: Resistance 3
//
//  "You must play this Hero from your hand on top of a 'Cool Rescuer
//   Monia' you control that is equipped with 'Cool Tech Jetpack'.
//   Whenever another target you control would be affected by an
//   opponent's card or effect, you may redirect that card or effect
//   onto this Hero. Damage this Hero receives from effects redirected
//   this way cannot be reduced or negated."   (Text Al 30.8.)
//
//  ── Der Tank ──
//  `heroRedirect` (Alleria-Vertrag, Engine-Fenster `_checkTargetRedirect`
//  nach JEDER Einzelzielwahl): Quelle gehoert dem Gegner, das gewaehlte
//  Ziel ist ein ANDERES eigenes (Held oder Kreatur), Monia lebt — dann
//  fragt die Engine „Redirect?" (kostenlos, beliebig oft). Ruling:
//  umgeleitet wird nur, wenn Monia selbst in der Zielliste des Effekts
//  steht (`validTargets`) — ein „Kreatur zerstoeren" auf einen Helden
//  zu biegen haette kein definiertes Ergebnis, und `promptTarget`
//  wuerde eine fremde ID stumm verwerfen. Truth-Seeing Eye blockt
//  die Umleitung (Engine). Flaechen-Effekte waehlen nicht → kein Fenster.
//
//  ── True Damage ──
//  `onHeroRedirect` setzt `gs._redirectedTrueDamage` (v668); der naechste
//  Treffer auf Monia kann weder verringert noch negiert werden und
//  ignoriert immortal / capAtHPMinus1 / lethalProtection (Al: „damit
//  man sie nicht unzerstoerbar machen kann").
// ═══════════════════════════════════════════

const { ASCEND_TARGET, moniaAscensionMet } = require('./_monia-shared');

const CARD_NAME = ASCEND_TARGET;

/**
 * Monia muss selbst unter den gueltigen Zielen des Effekts stehen —
 * `promptTarget` mappt die umgeleitete ID gegen die eigene Zielliste
 * des Aufrufers; eine ID, die dort fehlt, ginge stumm verloren.
 */
function moniaIsValidTarget(validTargets, ownerIdx, heroIdx) {
  const id = `hero-${ownerIdx}-${heroIdx}`;
  return (validTargets || []).some(t => t?.id === id
    || (t?.type === 'hero' && t.owner === ownerIdx && t.heroIdx === heroIdx));
}

module.exports = {
  activeIn: ['hero'],
  heroRedirect: true,

  /**
   * CPU: der Redirect-Confirm der Engine traegt Monias Namen als Titel;
   * ohne Override liefe er in die Ablehnungs-Default. Wie Alleria ueber
   * den Protection-Lernkanal (protMeta: Schaden/HP), Fallback: ja.
   */
  cpuResponse(engine, promptType, promptData) {
    if (promptType === 'generic' && promptData?.type === 'confirm') {
      try {
        const { protectionDecision } = require('./_deck-profile');
        if (typeof protectionDecision !== 'function') return { confirmed: true };
        const meta = promptData.protMeta || { d: 0, hp: 1 };
        const pi = typeof meta.pi === 'number' ? meta.pi : engine._cpuPlayerIdx;
        return { confirmed: protectionDecision(engine, pi, promptData.title, meta) };
      } catch { return { confirmed: true }; }
    }
    return undefined;
  },

  ascensionCondition(gs, pi, heroIdx, engine) {
    return moniaAscensionMet(engine, pi, heroIdx, null);
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Resistance']);
  },

  supportYield() {
    return { drawsPerTurn: 0.5 };
  },

  canHeroRedirect(gs, ownerIdx, heroIdx, selected, validTargets, config, engine, sourceCard) {
    const monia = gs.players[ownerIdx]?.heroes?.[heroIdx];
    if (!monia?.name || monia.name !== CARD_NAME || monia.hp <= 0) return false;
    const srcOwner = sourceCard?.heroOwner ?? sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner === ownerIdx) return false;                    // nur gegnerische Karten/Effekte
    if (!selected || selected.owner !== ownerIdx) return false;   // ein eigenes Ziel
    if (selected.type === 'hero' && selected.heroIdx === heroIdx) return false; // „another"
    if (config?.cannotBeRedirected) return false;
    return moniaIsValidTarget(validTargets, ownerIdx, heroIdx);
  },

  async onHeroRedirect(engine, ownerIdx, heroIdx, selected, _validTargets, _config, sourceCard) {
    const gs = engine.gs;
    const monia = gs.players[ownerIdx]?.heroes?.[heroIdx];
    if (!monia?.name) return null;
    gs._redirectedTrueDamage = { owner: ownerIdx, heroIdx, turn: gs.turn, source: sourceCard?.name || null };
    // Dash zum geschuetzten Ziel wie die Basis-Monia, nur mit reinem
    // Jetpack-Feuerschweif (`trailType: 'fire'`, Al 30.8.).
    const physSide = selected?.cardInstance
      ? (selected.cardInstance.stolenBy != null ? selected.cardInstance.owner : (selected.cardInstance.controller ?? selected.cardInstance.owner))
      : selected?.owner;
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: ownerIdx, sourceHeroIdx: heroIdx,
      targetOwner: physSide, targetHeroIdx: selected?.heroIdx,
      targetZoneSlot: selected?.type === 'hero' ? undefined : (selected?.slotIdx ?? selected?.cardInstance?.zoneSlot),
      cardName: monia.name, duration: 600,
      trailType: 'fire',
    });
    // Nur bis zum Aufprall warten (Hinflug ~ halbe Dauer), nicht bis
    // zum Ruecklauf — der umgeleitete Treffer soll direkt folgen.
    await engine._delay(280);
    engine.log('monia_bot_redirect', {
      player: gs.players[ownerIdx]?.username, from: selected?.cardName || null, source: sourceCard?.name || null,
    });
    return {
      redirectTo: { id: `hero-${ownerIdx}-${heroIdx}`, type: 'hero', owner: ownerIdx, heroIdx, cardName: monia.name },
    };
  },
};
