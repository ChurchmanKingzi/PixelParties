'use strict';
// W11a · R5 („Beschwörer muss agieren können" auch für Elven Rider, Orthos, Monster Nest, Hipdall-Stack-Ausnahme „Negated + Lv0") · Al, 15.10.2026:
//   „Ja, soll es. Reaction-Creatures können, sofern sie nichts anderes spezifizieren (der Term 'place' beinhaltet z.B., dass kein aktionsfähiger Hero notwendig ist)
//   NUR von Heroes beschworen werden, die aktionsfähig sind, dasselbe für Effekte, die spezifisch 'summon' sagen."
// Erwartet: Wo der Kartentext „summon" sagt (Elven Rider: Reaction; Orthos: „summon a second Loyal"; Hipdall/Swagdri/Wildur: „summon it … from there"; Old Couple;
//   Bomblebee Cluster), beschwört kein Frozen / Stunned / Webbed / Bound / Negated Held – auch keine Lv-0-Kreatur (die frühere Hipdall-Ausnahme „Negated + Lv0" entfällt).
//   Wo der Text „place" sagt (Monster Nest), braucht es keinen aktionsfähigen Helden (Gegenprobe: das Nest wirkt auch bei gefrorenem Gastgeber).
//   Regression: ein gesunder Held beschwört weiterhin.
const H = require('../../lib/h.js');
const STATI = ['frozen', 'stunned', 'webbed', 'bound', 'negated'];
const gefragt = (t, n) => t.prompts.some(p => p.d && p.d.type === 'confirm' && new RegExp(n).test(JSON.stringify(p.d)));
(async () => {
  const R = H.runner();
  // (1) Elven Rider: ein Elven stirbt bei Held 0; der Held ist (nicht) aktionsfähig
  for (const st of [null, ...STATI]) {
    const t = await H.fresh({ hand: [['Elven Rider'], []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    const e = t.put(0, 0, 0, 'Elven Archer'); e.turnPlayed = 1;
    if (st) t.heroStatus(0, 0, st);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, e));
    const rider = !!t.find('Elven Rider', 'support');
    if (!st) R.check('Elven Rider: gesunder Held → Rider wird angeboten und beschworen (Regression)', gefragt(t, 'Elven Rider') && rider, { gefragt: gefragt(t, 'Elven Rider'), rider });
    else R.check('Elven Rider: Held ' + st + ' → kein Angebot, keine Beschwörung', !gefragt(t, 'Elven Rider') && !rider, { gefragt: gefragt(t, 'Elven Rider'), rider });
    R.check('Elven Rider/' + (st || 'ok') + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (2) Orthos: erster Loyal landet in Orthos' Zone; zweiter nur, wenn Orthos agieren kann
  for (const st of [null, 'webbed', 'bound', 'negated']) {
    const t = await H.fresh({ hand: [['Loyal Beagle', 'Loyal Terrier'], []], heroes: [['Orthos, the Loyal Guard Dog', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Loyal Terrier' }) });
    if (st) t.heroStatus(0, 0, st);
    await t.run(() => t.engine.summonCreatureWithHooks('Loyal Beagle', 0, 0, 0, { source: 'Test' }));
    const zweiter = !!t.find('Loyal Terrier', 'support');
    if (!st) R.check('Orthos: gesunder Held → zweiter Loyal wird beschworen (Regression)', zweiter, { zweiter });
    else R.check('Orthos: Held ' + st + ' → kein zweiter Loyal', !zweiter && !gefragt(t, 'Orthos'), { zweiter, gefragt: gefragt(t, 'Orthos') });
    R.check('Orthos/' + (st || 'ok') + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (3) Hipdall vom Coolness Stack: Negated + Lv0 war bisher erlaubt
  for (const st of [null, 'negated', 'webbed', 'bound', 'frozen', 'stunned']) {
    const t = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature], []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0];
    for (const n of ['Cute Bunny', 'Hipdall, Protector of Coolness']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    t.gs.activePlayer = 0; t.phase(3);
    if (st) for (let h = 0; h < 3; h++) t.heroStatus(0, h, st);
    t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
    const r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
    const da = !!t.find('Hipdall, Protector of Coolness', 'support');
    if (!st) R.check('Hipdall vom Stack: gesunde Helden → beschworen (Regression)', da && r?.played === true, r);
    else R.check('Hipdall (Lv0) vom Stack: alle Helden ' + st + ' → abgelehnt', !da && r?.aborted === true, r);
    R.check('Hipdall/' + (st || 'ok') + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (4) Monster Nest („place … This counts as that Creature being summoned"): kein aktionsfähiger Held nötig
  {
    const t = await H.fresh({ deck: [Array(20).fill(H.INERT.frail), []] });
    const nest = t.put(0, 0, 0, 'Monster Nest'); nest.turnPlayed = 1;
    t.heroStatus(0, 0, 'frozen');
    t.gs.activePlayer = 0; t.phase(2);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Monster Nest', answer: (d) => ({ cardName: d.cards[0].name }) });
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    const top = t.zone(0, 0, 0);
    R.check('Monster Nest bei gefrorenem Gastgeber: legt trotzdem („place" braucht keinen aktionsfähigen Helden)', top && top !== 'Monster Nest', top);
    R.check('Monster Nest: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
