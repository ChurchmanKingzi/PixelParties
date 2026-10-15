'use strict';
// W11a · R6 (Anti Magic Enchantment) · Al, 15.10.2026: „Jedes Equip zählt, egal wer es anlegt."
//   Text: „Play this card immediately when an Artifact is equipped to a Hero by placing 1 Pollution Token into your free Support Zone …"
// Erwartet:
//   * Legt der GEGNER (Sitz 1) ein Artefakt an seinen eigenen Helden, bietet die AME auf der Hand von Sitz 0 das Verzaubern an (vorher nur eigene Artefakte).
//   * Annehmen: Sitz 0 zahlt 1 Pollution Token in eine eigene freie Zone, AME geht in die Ablage, das Artefakt trägt den Zähler; die Negier-Fähigkeit
//     gehört dem Kontrolleur des Artefakts („the controlling player", Sitz 1).
//   * Ein Artefakt, das Sitz 1 an einen Helden von Sitz 0 anlegt (Control Device), und das eigene Anlegen (Regression) bieten es ebenfalls an.
const H = require('../../lib/h.js');
const AME = 'Anti Magic Enchantment';
const angebot = (t, pi) => t.prompts.filter(p => p.pi === pi && p.d.title === AME).length;
(async () => {
  const R = H.runner();
  // (1) Gegner legt an seinen eigenen Helden an
  {
    const t = await H.fresh({ hand: [[AME], ['Future Tech Gun']], gold: 100, active: 1 });
    t.policy.confirm = true;
    await t.play(1, 'Future Tech Gun', { hero: 0 });
    const art = t.find('Future Tech Gun', 'support');
    R.check('Gegner-Artefakt liegt bei Sitz 1', !!art && art.owner === 1, art && art.owner);
    R.check('AME von Sitz 0 wird für das Gegner-Artefakt angeboten', angebot(t, 0) >= 1, t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('AME angenommen: Artefakt trägt den Zähler, Besitzer der Fähigkeit = Kontrolleur des Artefakts (Sitz 1)', !!art.counters.antiMagicEnchanted && art.counters.antiMagicEnchanted.ownerPi === 1, art.counters.antiMagicEnchanted);
    R.check('AME in der Ablage von Sitz 0, ein Pollution Token bei Sitz 0', t.pile(0, 'discardPile').includes(AME) && t.gs.players[0].supportZones.some(h => h.some(z => z[0] && /Pollution/.test(z[0]))), { disc: t.pile(0, 'discardPile'), sup: t.gs.players[0].supportZones });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (2) Regression: das eigene Artefakt
  {
    const t = await H.fresh({ hand: [[AME, 'Future Tech Gun'], []], gold: 100 });
    t.policy.confirm = true;
    await t.play(0, 'Future Tech Gun', { hero: 0 });
    const art = t.find('Future Tech Gun', 'support');
    R.check('eigenes Artefakt: AME wird angeboten und verzaubert (Regression)', angebot(t, 0) >= 1 && !!art.counters.antiMagicEnchanted && art.counters.antiMagicEnchanted.ownerPi === 0, art && art.counters.antiMagicEnchanted);
  }
  // (3) Gegner legt eine Control Device an einen Helden von Sitz 0 an: liegt bei Sitz 0
  {
    const t = await H.fresh({ hand: [[AME], ['Future Tech Control Device']], gold: 100, active: 1 });
    t.policy.confirm = true;
    await t.play(1, 'Future Tech Control Device', { hero: 0, targetOwner: 0 });
    R.check('Cross-Side-Artefakt (Sitz 1 legt bei Sitz 0 an): AME von Sitz 0 wird angeboten', angebot(t, 0) >= 1, t.prompts.map(p => p.pi + ':' + p.d.title));
  }
  // (4) abgelehnt: nichts passiert
  {
    const t = await H.fresh({ hand: [[AME], ['Future Tech Gun']], gold: 100, active: 1 });
    t.script.push({ match: d => d.type === 'confirm' && d.title === AME, answer: () => null });
    await t.play(1, 'Future Tech Gun', { hero: 0 });
    const art = t.find('Future Tech Gun', 'support');
    R.check('AME abgelehnt: Artefakt unverändert, AME bleibt auf der Hand', !art.counters.antiMagicEnchanted && t.pile(0, 'hand').includes(AME), { hand: t.pile(0, 'hand') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
