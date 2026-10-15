'use strict';
// W13 / Q147 (M02-20) · Overflowing Chalice und Pressed Skill: „a Hero you control" = nach aktueller Kontrolle (`heroesControlledBy`), Al: „Ja, nach aktueller Kontrolle"
// Erwartung: ein vom Gegner gecharmter eigener Held steht NICHT zur Wahl; ein von mir gecharmter Gegnerheld steht zur Wahl;
// bei Chalice darf der gewählte geliehene Held die Zusatzaktion ausführen (Prompt `heroAction` mit `heroOwner`); bei Pressed Skill landet die Ability bei ihm. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const charm = (t, seat, hi, by) => { const h = t.gs.players[seat].heroes[hi]; h.charmedBy = by; h.charmedFromOwner = seat; h.charmedHeroIdx = hi; h.statuses = { ...(h.statuses || {}), charmed: { controller: by, appliedTurn: t.gs.turn } }; };
  async function chalice(setup, wahl) {
    const t = await H.fresh({ hand: [['Overflowing Chalice'], []], hp: 800 });
    setup(t);
    let opt = null, heroAction = null;
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => { opt = d.options.map(o => ({ id: o.id, label: o.label })); const w = wahl ? d.options.find(o => wahl.test(o.label)) : d.options[0]; return { optionId: w.id }; } });
    t.script.push({ match: d => d.type === 'heroAction', answer: (d) => { heroAction = { heroIdx: d.heroIdx, heroOwner: d.heroOwner, name: d.heroName }; return null; } });
    await t.play(0, 'Overflowing Chalice', { hero: 0 });
    return { t, opt, heroAction };
  }
  let x = await chalice(t => charm(t, 0, 1, 1));
  R.check('Chalice: eigener, vom Gegner gecharmter Held (Rick) nicht zur Wahl', x.opt && !x.opt.some(o => /Rick/.test(o.label)), x.opt);
  x = await chalice(t => charm(t, 1, 0, 0));
  R.check('Chalice: von mir gecharmter Gegnerheld steht zur Wahl (3 eigene + 1 geliehener)', x.opt && x.opt.some(o => o.id === '1:0') && x.opt.length === 4, x.opt);
  // gezielt den geliehenen Gegnerhelden (Sitz 1, Held 0) wählen; Hand mit einem Attack, damit die Zusatzaktion etwas anbietet
  { const t = await H.fresh({ hand: [['Overflowing Chalice', 'Attack'], []], hp: 800 });
    charm(t, 1, 0, 0);
    const geliehen = t.hero(1, 0).name;
    let hat = null;
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options.find(o => o.label === geliehen && /^1:0$/.test(o.id)).id }) });
    t.script.push({ match: d => d.type === 'heroAction', answer: (d) => { hat = { heroIdx: d.heroIdx, heroOwner: d.heroOwner }; return null; } });
    await t.play(0, 'Overflowing Chalice', { hero: 0 });
    R.check('Chalice: gewählter geliehener Held bekommt die Zusatzaktion (heroAction mit Brettseite 1)', hat && hat.heroIdx === 0 && hat.heroOwner === 1, hat);
    R.check('Chalice: Nachteil greift (Aktionssperre)', !!t.gs.players[0].actionLocked, t.gs.players[0].actionLocked);
    R.check('Chalice: keine Engine-Fehler', t.errors.length === 0, t.errors); }
  async function ps(setup) {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    setup(t);
    let el = null, ziele = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { el = d.eligibleHeroIdxs; return null; } });
    t.targetFn = (valid) => { ziele = valid.map(v => `${v.owner}:${v.heroIdx}`); return null; };
    await t.play(0, 'Pressed Skill', { hero: 0 });
    return { t, el, ziele };
  }
  let p = await ps(t => charm(t, 0, 1, 1));
  R.check('Pressed Skill: eigener, vom Gegner gecharmter Held 1 ist kein Ziel', p.el && !p.el.includes(1) && p.el.includes(0), p.el);
  const perma = (t) => { charm(t, 1, 0, 0); const h = t.gs.players[1].heroes[0]; h.permaControlBy = 0; h.permaControlFrom = 1; h.permaControlHeroIdx = 0; delete h.statuses.charmed; };
  p = await ps(t => charm(t, 1, 0, 0));
  R.check('Pressed Skill: nur temporär gecharmter Gegnerheld (Rechte ohne Abilities) ist kein Ziel', p.el && p.el.length === 3 && !p.ziele, { el: p.el, ziele: p.ziele });   // nur die drei eigenen (Abilities-Rechte fehlen bei Charme)
  p = await ps(perma);
  R.check('Pressed Skill: dauerhaft übernommener Gegnerheld (1:0) steht zur Wahl', p.ziele && p.ziele.includes('1:0') && p.ziele.includes('0:0'), p.ziele);
  { const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    perma(t);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.targetFn = (valid) => [valid.find(v => v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Pressed Skill', { hero: 0 });
    const hat = (t.gs.players[1].abilityZones[0] || []).some(z => (z || []).includes('Wealth'));
    R.check('Pressed Skill: Ability landet beim geliehenen Gegnerhelden (Brettseite 1)', r === true && hat, { r, zonen: t.gs.players[1].abilityZones[0] });
    R.check('Pressed Skill: keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
