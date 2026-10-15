// W11b · Q70 (C01-08) · Candlestick Squire
// Text: „You may choose a Burned target either player controls and heal it from its Burn to summon this Creature as an additional Action."
// Al: „Normale Beschwörung sollte möglich sein!" → bei vorhandenem Brand: in der Action Phase mit freier Aktion Wahl „Normal" (1 Aktion, ohne Heilung)
//   oder „Special" (Brand heilen, Zusatzaktion = Aktion bleibt frei). Ohne freie Aktion (Main Phase) bleibt die Heilung der einzige Weg. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const S = 'Candlestick Squire';
  const wahl = (t, special) => t.script.push({ match: d => d.type === 'confirm' && /Choose how to summon/.test(d.message || ''), answer: special ? () => ({ confirmed: true }) : () => null });
  async function szene(opts) {
    const t = await H.fresh({ hand: [[S], []] });
    await t.engine.addHeroStatus(1, 0, 'burned', { duration: 5, appliedBy: 0 });
    t.grantFor(0, 0, S);
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    return t;
  }
  { // Normal
    const t = await szene(); wahl(t, false);
    const r = await t.play(0, S, {});
    R.check('Normal: gespielt, auf dem Brett', r === true && !!t.find(S, 'support'), { r });
    R.check('Normal: Brand bleibt', !!t.gs.players[1].heroes[0].statuses.burned);
    R.check('Normal: Aktion verbraucht (Phase weiter)', t.gs.currentPhase !== 3, t.gs.currentPhase);
    R.check('Normal: keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // Special
    const t = await szene(); wahl(t, true);
    const r = await t.play(0, S, {});
    R.check('Special: gespielt, auf dem Brett', r === true && !!t.find(S, 'support'), { r });
    R.check('Special: Brand geheilt', !t.gs.players[1].heroes[0].statuses.burned);
    R.check('Special: Aktion bleibt frei (Zusatzaktion)', t.gs.currentPhase === 3 && (t.gs.players[0].heroesActedThisTurn || []).length === 0, { ph: t.gs.currentPhase, acted: t.gs.players[0].heroesActedThisTurn });
    R.check('Special: keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // Special, aber Zielwahl abgebrochen -> nichts passiert
    const t = await szene(); wahl(t, true); t.targetFn = () => null;
    await t.play(0, S, {});
    R.check('Special + Abbruch: Squire bleibt auf der Hand, Brand bleibt', t.pile(0, 'hand').includes(S) && !t.find(S, 'support') && !!t.gs.players[1].heroes[0].statuses.burned);
  }
  { // Main Phase: nur der Heilungsweg
    const t = await szene();
    const r = await t.play(0, S, { phase: 2 });
    R.check('Main Phase: nur mit Heilung (Zusatzaktion), Brand weg', r === true && !!t.find(S, 'support') && !t.gs.players[1].heroes[0].statuses.burned, { r });
    R.check('Main Phase: keine Normal/Special-Frage', !t.prompts.some(p => /Choose how to summon/.test(p.d.message || '')));
  }
  { // ohne Brand: normaler Weg ohne Frage
    const t = await H.fresh({ hand: [[S], []] });
    t.grantFor(0, 0, S);
    const r = await t.play(0, S, {});
    R.check('ohne Brand: normal beschworen, keine Frage', r === true && !!t.find(S, 'support') && !t.prompts.some(p => /Choose how to summon/.test(p.d.message || '')));
  }
  R.finish();
})();
