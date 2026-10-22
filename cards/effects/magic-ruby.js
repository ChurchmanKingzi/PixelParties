// COST-DISCARD-CHANNEL: n/a in dieser Datei — die Kosten („eine Karte
//   abwerfen, um das Juwel zu behalten") sitzen im geteilten Helfer
//   `_magic-gem-shared.js`, der den Kanal fuer alle sieben Gems
//   bedient (v1041).
// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Ruby"
//  Artifact (Normal, Cost 10)
//
//  Choose a Hero your opponent controls and Stun
//  it for 1 turn.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
//  You can only play 1 "Magic Ruby" per turn.
//
//  W49a (Al, 22.10.2026): der letzte Satz steht jetzt auch im Kartentext
//  (wie bei Topaz/Amethyst). Die Sperre selbst gab es schon: `canActivate`
//  fragt `canPlayMagicGem` (HOPT `Magic Ruby:<Spieler>`), der Stempel wird
//  erst am Ende des Effekts in `maybeKeepGemInHand` gesetzt (gespielt und
//  verpufft stempelt, ganz negiert nicht — Z7b).
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');
const { opponentOfGs } = require('./_opp');

const CARD_NAME = 'Magic Ruby';
const STUN_DURATION = 1;

/** Helden, die der Gegner von `pi` kontrolliert (ohne Engine: dessen Spalte). */
function gegnerHelden(gs, pi, engine) {
  const oi = opponentOfGs(gs, pi);
  if (engine?.heroesControlledBy) return engine.heroesControlledBy(oi);
  return (gs.players[oi]?.heroes || []).map((hero, heroIdx) => ({ physOwner: oi, heroIdx, hero }));
}

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  // W16e (F02-08): „a Hero your opponent controls" = Kontrolle (`heroSideOf`), IDs = Brettseite — beide Spalten.
  canActivate(gs, pi, engine) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // Need at least one alive opponent hero. Existing immunities are
    // checked by the standard status-application gate at apply time.
    return gegnerHelden(gs, pi, engine).some(({ hero: h }) => h?.name && h.hp > 0);
  },

  getValidTargets(gs, pi, engine) {
    const out = [];
    for (const { physOwner, heroIdx: hi, hero: h } of gegnerHelden(gs, pi, engine)) {
      if (!h?.name || h.hp <= 0) continue;
      out.push({ id: `hero-${physOwner}-${hi}`, type: 'hero', owner: physOwner, heroIdx: hi, cardName: h.name });
    }
    return out;
  },

  targetingConfig: {
    description: 'Choose an opponent Hero to Stun for 1 turn.',
    confirmLabel: '💫 Stun!',
    confirmClass: 'btn-warning',
    cancellable: true,
    maxTotal: 1,
    appliesStatus: 'stunned',
  },

  validateSelection(selectedIds) { return selectedIds.length === 1; },

  resolve: async (engine, pi, selectedIds) => {
    const id = (selectedIds || [])[0] || '';
    const m = id.match(/^hero-(\d+)-(\d+)$/);
    if (!m) return { keepInHand: false };
    const tpi = parseInt(m[1]);
    const hi = parseInt(m[2]);
    const ziel = engine.gs.players[tpi]?.heroes?.[hi];
    if (!ziel?.name || engine.heroSideOf(tpi, ziel) === pi) return { keepInHand: false }; // must be opponent (Kontrolle, W16e)

    await engine.addHeroStatus(tpi, hi, 'stunned', {
      duration: STUN_DURATION,
      appliedBy: pi,
    });

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
