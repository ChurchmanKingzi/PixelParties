'use strict';
// W14a · Rückfrage 9 (Welle 13 / W13b; M02-20 Pressed Skill, Q147-Folge) · Al, 16.10.2026:
//   „Ja, dürfen sie. Die Regel lautet, dass nur ein permanent kontrollierter Held normal von der Hand als Standard-Spielaktion eine Ability bekommen kann - aber
//    Attachments per Effekt können alle eigenen Heroes betreffen."
// Erwartet: (a) Pressed Skill (Effekt) darf die Ability auch an einen NUR gecharmten Helden anlegen (Brettseite des Helden); (b) die Standard-Spielaktion (Ability aus der
//   Hand) bleibt dem permanent kontrollierten Helden vorbehalten (`darfFremdAbilityAnlegen`, `canAttachAbilityToHero` ohne `byEffect`); (c) ein Held ohne jedes Kontrollrecht
//   (Charme Lv3: „unaffected") bleibt auch für Effekte ausgenommen; (d) der vom Gegner gecharmte EIGENE Held ist kein Ziel (Q147).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const charm = (t, seat, hi, by, rechte) => { const h = t.gs.players[seat].heroes[hi]; h.charmedBy = by; h.charmedFromOwner = seat; h.charmedHeroIdx = hi; h.statuses = { ...(h.statuses || {}), charmed: { controller: by, appliedTurn: t.gs.turn } }; if (rechte) h._kontrollRechte = rechte; };
  const perma = (t, seat, hi, by) => { charm(t, seat, hi, by); const h = t.gs.players[seat].heroes[hi]; h.permaControlBy = by; h.permaControlFrom = seat; h.permaControlHeroIdx = hi; delete h.statuses.charmed; };
  const mk = () => H.fresh({ hand: [['Pressed Skill', 'Wealth'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });

  R.section('(a) Pressed Skill auf einen nur gecharmten Gegnerhelden (Sitz 1, Held 0)');
  {
    const t = await mk();
    charm(t, 1, 0, 0);
    let ziele = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.targetFn = (valid) => { ziele = valid.map(v => `${v.owner}:${v.heroIdx}`); return [valid.find(v => v.owner === 1 && v.heroIdx === 0).id]; };
    const r = await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('der gecharmte Gegnerheld steht zur Wahl', !!ziele && ziele.includes('1:0'), ziele);
    const hat = (t.gs.players[1].abilityZones[0] || []).some(z => (z || []).includes('Wealth'));
    R.check('Wealth liegt in den Ability-Zonen des gecharmten Helden (Brettseite 1)', r === true && hat, { r, zonen: t.gs.players[1].abilityZones[0] });
    R.check('Zähler „Ability per turn" des Helden nicht verbraucht (additional)', !(t.gs.players[0].abilityGivenThisTurn || [])[0], t.gs.players[0].abilityGivenThisTurn);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(b) Standard-Spielaktion: nur der permanent kontrollierte Held');
  {
    const t = await mk();
    charm(t, 1, 0, 0);
    R.check('nur gecharmt: Standard-Anlegen (darfFremdAbilityAnlegen) NEIN', t.engine.darfFremdAbilityAnlegen(0, 1, 0) === false, t.engine.darfFremdAbilityAnlegen(0, 1, 0));
    R.check('nur gecharmt: canAttachAbilityToHero ohne byEffect NEIN, per Effekt JA', t.engine.canAttachAbilityToHero(0, 'Wealth', 0, { heroOwner: 1 }) === false && t.engine.canAttachAbilityToHero(0, 'Wealth', 0, { heroOwner: 1, byEffect: true }) === true, { ohne: t.engine.canAttachAbilityToHero(0, 'Wealth', 0, { heroOwner: 1 }), mit: t.engine.canAttachAbilityToHero(0, 'Wealth', 0, { heroOwner: 1, byEffect: true }) });
  }
  {
    const t = await mk();
    perma(t, 1, 0, 0);
    R.check('permanent übernommen: Standard-Anlegen JA', t.engine.darfFremdAbilityAnlegen(0, 1, 0) === true, t.engine.darfFremdAbilityAnlegen(0, 1, 0));
  }

  R.section('(c) Held ohne jedes Kontrollrecht (Charme Lv3) bleibt ausgenommen; (d) vom Gegner gecharmter eigener Held ist kein Ziel');
  {
    const t = await mk();
    charm(t, 1, 0, 0, { beschwoeren: false, ausruesten: false, abilities: false });
    R.check('rechtloser Held: auch per Effekt NEIN', t.engine.canAttachAbilityToHero(0, 'Wealth', 0, { heroOwner: 1, byEffect: true }) === false);
  }
  {
    const t = await mk();
    charm(t, 0, 1, 1);   // eigener Held 1, vom Gegner gecharmt
    let el = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { el = d.eligibleHeroIdxs; return null; } });
    await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('eigener, vom Gegner gecharmter Held 1 ist kein Ziel, Held 0 und 2 schon', el && !el.includes(1) && el.includes(0) && el.includes(2), el);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
