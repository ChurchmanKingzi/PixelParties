// ═══════════════════════════════════════════
//  CARD EFFECT: "Gerrymander"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  Two passive board effects — both implemented
//  as engine-side redirects in `promptGeneric`,
//  not as hooks. The script exists mainly so the
//  engine can detect "this player controls a
//  board-active Gerrymander" via the standard
//  cardInstances scan.
//
//  EFFECT 1 (unlimited): Whenever a card lets
//  your opponent decide between different effects,
//  YOU choose for them. Detected as: any prompt
//  routed to opp with `type === 'optionPicker'`
//  AND `options.length >= 2`. Redirected to
//  Gerrymander's owner with a clear "choosing for
//  [opp]" indicator on the prompt.
//
//  EFFECT 2 (once per turn): The first time every
//  turn an effect says your opponent "may" do
//  something, you choose whether or not they do
//  it. Detected as: any prompt routed to opp with
//  `type === 'confirm'` AND `cancellable === true`.
//  After the first such redirect this turn, the
//  per-turn flag (`gerry-may-redirected:${owner}:
//  ${turn}`) is stamped and subsequent "may"
//  prompts go to opp normally.
//
//  Multiple Gerrymanders on the same side are
//  redundant — the engine only needs to find ONE
//  active Gerrymander to enable the redirect, and
//  Effect 2's per-turn flag is stamped once.
//
//  Disabled when Gerrymander is frozen / stunned /
//  negated / nulled (standard creature-effect
//  status filter).
// ═══════════════════════════════════════════

const CARD_NAME = 'Gerrymander';

module.exports = {
  activeIn: ['support'],

  // Marker flag — engine checks `script.isGerrymander` while scanning
  // for an active Gerrymander on a side. Future cards could opt into
  // the same redirect surface by exporting the same flag, though
  // currently only Gerrymander does.
  isGerrymander: true,

  // No hooks — passive board effect routed through engine intercept.
  hooks: {},
};
