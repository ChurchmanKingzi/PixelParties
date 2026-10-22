'use strict';
// W49a · Punkt 3 · Al, 22.10.2026 (Stand vor der Fix-Welle): „Divine Gift of Coolness, und vielleicht andere Attachments, erlauben es nicht, Afflicted Pests in Reaktion zu aktivieren."
// Kartentext Afflicted Pests: „Activate this Surprise when your opponent equips or attaches a card into a Hero's Support Zone. Choose a card in any Hero's Support Zone and send it
//   to the discard pile, then place this Creature into one of the user's free Support Zones. …"
// Matrix (beide Sitze; Pests liegt beim Gegner des Anlegers): JEDER Weg, auf dem der Gegner eine Karte an einen Helden anlegt/ausrüstet, öffnet das Fenster:
//   (a) alle Ausrüstungen (Equipment) von der Hand, (b) alle Spell-/Attack-Anhängsel (inkl. Divine Gift of Coolness), (c) Ausrüsten PER EFFEKT (Cool Repair, Treasure Hunter's Backpack,
//   Gate to the Armory, Overcharge, Initiation Ritual, Looting), (d) Coolness-Stack-Ausrüstung (Modnir). Gegenproben: das EIGENE Anlegen löst die eigene Pests nicht aus; UMHÄNGEN
//   von ANHÄNGSELN (Inheritance Ceremony) öffnet seit W51a (Al 22.10.2026) das Fenster wie das Anlegen; Abilities lösen nicht aus (Q59).
//   W50a (Al, 22.10.2026) umgestellt: der EQUIP-Teil der Ceremony verhält sich wie Slippery Fridge (öffnet das Fenster, siehe W50/a-02); Tempeluna öffnet es NICHT (W50/a-03).
// Divine Gift of Coolness: Pests öffnet auch bei ihm; die frisch angelegte Karte steht zur Wahl, aber nicht die unverrückbare Divine Gift selbst („cannot be removed … in any way").
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PESTS = 'Afflicted Pests';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const pestsGefragt = (t) => t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d)));
const pestsAktiv = (t) => pestsGefragt(t) || t.inst(c => c.name === PESTS && c.zone === 'support').length > 0;
const stuetz = (t, s, hi) => (t.gs.players[s].supportZones[hi] || []).flat();
const ANHAENGSEL = ['Alliance', 'Anti Magic', 'Berserk', 'Call of the Deepsea', 'Castling', 'Curse', 'Decisive Defeat', 'Dichotomy of Luna and Tempeste',
  'Divine Gift of Coolness', 'Energy Aura', 'Forbidden Curse of Aging', 'Gathering Storm', 'Guardian Angel', 'Intrude', 'Invisibility', 'Light Ball',
  'Overheal Shock', 'Prayer', 'Prophecy of Tempeste', 'Quest of the Chosen One', 'Royal Treasury', 'Siege'];

function equipOpts(E, me) {
  const o = { gold: 500 };
  const hand = [[], []]; hand[me] = [E]; o.hand = hand;
  const heroes = [null, null];
  if (/^Crusader's/.test(E)) heroes[me] = ['Cecilia, the Harrowing Crusader', 'Cecilia, the Harrowing Crusader', H.BLANK_HEROES[2]];
  if (/^Idej (Blade|Sword)/.test(E)) heroes[me] = ['Idej Lord Daiyo', 'Idej Lord Nobunakin', 'Idej Lord Shoguwana'];
  if (heroes[me]) o.heroes = heroes;
  if (me) o.active = 1;
  return o;
}
const LUN = { 'Lunatic Cycle - Crescent Moon': 'Lunatic Cycle - New Moon', 'Lunatic Cycle - Half Moon': 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Gibbous Moon': 'Lunatic Cycle - Half Moon', 'Lunatic Cycle - Full Moon': 'Lunatic Cycle - Gibbous Moon' };

(async () => {
  const R = H.runner();
  const eqs = Object.values(H.DB).filter(c => (c.subtype || '').toLowerCase() === 'equipment').map(c => c.name)
    .filter(n => !['Modnir, Hammer of Coolness', 'Swellpnir, Mount of Coolness', 'Cool Tech Jetpack', 'Future Tech Control Device'].includes(n));
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' legt an, Pests bei Sitz ' + op);
    // Pests-Wahl des Gegners: den Dummy opfern (nicht die frisch angelegte Karte), damit die Karte des Anlegers sichtbar bleibt.
    const mit = (t) => {
      t.putSurprise(op, 0, PESTS); t.grantFor(op, 0, PESTS); t.put(op, 0, 0, H.INERT.creature);
      const vorher = t.targetFn;
      t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorher ? vorher(v, cfg) : undefined);
    };

    // (a) Ausrüstungen von der Hand
    let geprueft = 0; const nichtSpielbar = [];
    for (const E of eqs) {
      const t = await H.fresh(equipOpts(E, me));
      mit(t);
      if (LUN[E]) t.put(me, 2, 0, LUN[E]);
      if (E === 'Secret Lab Entrance') t.setAbilities(me, 0, [['Inventing'], [], []]);
      const ok = await t.play(me, E, { hero: 0 });
      if (ok !== true || !t.inst(c => c.name === E && c.zone === 'support').length) { nichtSpielbar.push(E); continue; }
      geprueft++;
      R.check(E + ' ausgerüstet: Afflicted Pests des Gegners öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check(E + ': keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    R.check('mindestens 85 Ausrüstungen geprüft (Rest: ' + nichtSpielbar.join(', ') + ')', geprueft >= 85, { geprueft, nichtSpielbar });

    // (a2) Control Device (Cross-Side: auf einen Helden des Pests-Besitzers)
    { const t = await H.fresh({ hand: me === 0 ? [['Future Tech Control Device'], []] : [[], ['Future Tech Control Device']], gold: 500, ...(me ? { active: 1 } : {}) });
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 1) || v.find(x => x.owner === op); return [(h || v[0]).id]; };
      mit(t);
      const ok = await t.play(me, 'Future Tech Control Device', { hero: 1, targetOwner: op });
      R.check('Control Device an einen Gegnerhelden: gespielt', ok === true && t.inst(c => c.name === 'Future Tech Control Device' && c.zone === 'support').length === 1, ok);
      R.check('Control Device: Afflicted Pests öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check('Control Device: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // (b) Anhängsel (Spell/Attack, Untertyp Attachment) — an Gegnerhelden gespielt
    for (const n of ANHAENGSEL) {
      const t = await H.fresh({ hand: me === 0 ? [[n], []] : [[], [n]], gold: 500, ...(me ? { active: 1 } : {}) });
      mit(t);
      const r = await t.play(me, n, { hero: 0, targetOwner: op });
      if (r !== true || !t.inst(c => c.name === n && c.zone === 'support').length) { R.note(n + ': im Harness nicht anlegbar (' + JSON.stringify(r) + ')', t.inst(c => c.name === n).map(c => c.zone)); continue; }
      R.check(n + ' angelegt: Afflicted Pests des Gegners öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check(n + ': keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    // (b2) Divine Gift of Coolness: Pests-Wahl — die unverrückbare Divine Gift ist nicht wählbar, eine andere Karte schon
    { const t = await H.fresh({ hand: me === 0 ? [['Divine Gift of Coolness'], []] : [[], ['Divine Gift of Coolness']], gold: 500, ...(me ? { active: 1 } : {}) });
      mit(t); t.put(me, 0, 1, 'Glass Sword');
      let angeboten = null;
      const alt = t.targetFn;
      t.targetFn = (valid, cfg) => { if (cfg && cfg.title === PESTS) { angeboten = valid.map(v => v.cardName); const g = valid.find(v => v.cardName === 'Glass Sword'); return [(g || valid[0]).id]; } return alt ? alt(valid, cfg) : [valid[0].id]; };
      const r = await t.play(me, 'Divine Gift of Coolness', { hero: 0 });
      R.check('Divine Gift of Coolness: gespielt und angelegt', r === true && stuetz(t, me, 0).includes('Divine Gift of Coolness') || stuetz(t, op, 0).includes('Divine Gift of Coolness') || stuetz(t, me, 1).length > 0, { r });
      R.check('Divine Gift: Afflicted Pests öffnet und fragt nach einer Karte', pestsGefragt(t) && Array.isArray(angeboten), { angeboten, prompts: t.prompts.map(p => p.d.type) });
      R.check('Divine Gift selbst steht NICHT zur Wahl („cannot be removed … in any way")', Array.isArray(angeboten) && !angeboten.includes('Divine Gift of Coolness'), angeboten);
      R.check('Glass Sword steht zur Wahl und wird abgelegt', Array.isArray(angeboten) && angeboten.includes('Glass Sword') && t.pile(me, 'discardPile').includes('Glass Sword'), { angeboten, abl: t.pile(me, 'discardPile') });
      R.check('Divine Gift bleibt liegen', t.inst(c => c.name === 'Divine Gift of Coolness' && c.zone === 'support').length === 1);
      R.check('Divine Gift: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // (b3) Frisch angelegte (nicht unverrückbare) Karte steht bei der Pests-Wahl zur Verfügung
    { const t = await H.fresh({ hand: me === 0 ? [['Curse'], []] : [[], ['Curse']], gold: 500, ...(me ? { active: 1 } : {}) });
      mit(t);
      let angeboten = null;
      t.targetFn = (valid, cfg) => { if (cfg && cfg.title === PESTS) { angeboten = valid.map(v => v.cardName); return [valid[0].id]; } const h = valid.find(v => v.type === 'hero' && v.owner === op && v.heroIdx === 0); return [(h || valid[0]).id]; };
      await t.play(me, 'Curse', { hero: 0, targetOwner: op });
      R.check('Curse: die gerade angelegte Karte steht bei der Pests-Wahl zur Verfügung', Array.isArray(angeboten) && angeboten.includes('Curse'), angeboten); }

    // (c) Ausrüsten per Effekt
    const effekte = [
      ['Cool Repair', async () => { const t = await H.fresh({ hand: me === 0 ? [['Cool Repair'], []] : [[], ['Cool Repair']], discard: me === 0 ? [['Club of Gobbo'], []] : [[], ['Club of Gobbo']], gold: [500, 500], ...(me ? { active: 1 } : {}) });
        t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Club of Gobbo' }) });
        t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0); return [(h || v[0]).id]; };
        mit(t); await t.play(me, 'Cool Repair', { hero: 0 }); return t; }, 'Club of Gobbo'],
      ["Treasure Hunter's Backpack", async () => { const B = "Treasure Hunter's Backpack"; const t = await H.fresh({ hand: me === 0 ? [[B], []] : [[], [B]], deck: me === 0 ? [['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy'], []] : [[], ['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy']], gold: [500, 500], ...(me ? { active: 1 } : {}) });
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === B, answer: () => ({ cardName: 'Club of Gobbo', source: 'deck' }), once: false });
        t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}), once: false });
        t.targetFn = (valid) => { if (!valid.length) return []; const z = valid.find(v => v.type === 'equip' && v.owner === me && v.heroIdx === 0); return [(z || valid[0]).id]; };
        mit(t); await t.play(me, B); return t; }, 'Club of Gobbo'],
      ['Gate to the Armory', async () => { const t = await H.fresh({ hand: me === 0 ? [['Gate to the Armory'], []] : [[], ['Gate to the Armory']], deck: me === 0 ? [['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy'], []] : [[], ['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy']], ...(me ? { active: 1 } : {}) });
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: () => ({ cardName: 'Club of Gobbo', source: 'deck' }) });
        t.policy.confirm = true; mit(t); await t.play(me, 'Gate to the Armory', { hero: 0 }); return t; }, 'Club of Gobbo'],
      ['Overcharge', async () => { const t = await H.fresh({ hand: me === 0 ? [['Overcharge'], []] : [[], ['Overcharge']], hp: 800, deck: me === 0 ? [['ZZ Dummy', 'Club of Gobbo', 'ZZ Dummy'], []] : [[], ['ZZ Dummy', 'Club of Gobbo', 'ZZ Dummy']], ...(me ? { active: 1 } : {}) });
        t.setAbilities(me, 0, [['Magic Arts'], [], []]); t.put(me, 0, 1, 'Glass Sword');
        t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Club of Gobbo' }) });
        mit(t); await t.play(me, 'Overcharge', { hero: 0, noGrant: true }); return t; }, 'Club of Gobbo'],
    ];
    for (const [name, bau, karte] of effekte) {
      const t = await bau();
      R.check(name + ': Ausrüstung (' + karte + ') liegt am Helden', stuetz(t, me, 0).includes(karte), stuetz(t, me, 0));
      R.check(name + ': Afflicted Pests des Gegners öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check(name + ': sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    // (c2) Initiation Ritual: gefallener Held wird als Ausrüstung angelegt
    { const t = await H.fresh({ hand: me === 0 ? [['Initiation Ritual'], []] : [[], ['Initiation Ritual']], gold: [100, 100], ...(me ? { active: 1 } : {}), abilities: { [me]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
      mit(t);
      const gefallen = t.hero(me, 1).name;
      await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: op }, t.hero(me, 1), 9999, 'true'));
      t.gs.turn = 7; t.hero(me, 1).diedOnTurn = 5;
      const r = await t.play(me, 'Initiation Ritual', { noAutoConfirm: true });
      let pt = t.gs.potionTargeting;
      const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
      if (v) await t.run(() => t.host.doConfirmPotion(t.room, me, { selectedIds: [v.id] }));
      pt = t.gs.potionTargeting;
      if (pt) { const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip')); if (w) await t.run(() => t.host.doConfirmPotion(t.room, me, { selectedIds: [w.id] })); }
      const angelegt = stuetz(t, me, 0).includes(gefallen);
      R.check('Initiation Ritual: Gefallener liegt als Ausrüstung am lebenden Helden', r === true && angelegt, { r, zone: stuetz(t, me, 0) });
      R.check('Initiation Ritual: Afflicted Pests des Gegners öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check('Initiation Ritual: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // (d) Gegenproben
    { const n = 'Light Ball';   // eigenes Anlegen: die eigene Pests (bei Sitz me) öffnet nicht
      const t = await H.fresh({ hand: me === 0 ? [[n], []] : [[], [n]], gold: 500, ...(me ? { active: 1 } : {}) });
      t.putSurprise(me, 0, PESTS); t.grantFor(me, 0, PESTS); t.put(me, 0, 0, H.INERT.creature);
      await t.play(me, n, { hero: 0 });
      R.check('Eigenes Anlegen löst die eigene Pests nicht aus', !pestsGefragt(t) && t.inst(c => c.name === PESTS && c.zone === 'support').length === 0, t.prompts.map(p => p.d.type)); }
    for (const ab of ['Fighting', 'Resistance']) {
      const t = await H.fresh({ gold: [500, 500], hand: [[], []], ...(me ? { active: 1 } : {}) });
      mit(t); t.reset();
      await t.play(me, ab, { hero: 0 });
      R.check(ab + ' (Ability) angelegt: Pests löst nicht aus', !pestsAktiv(t), t.prompts.map(p => p.d.type));
    }
    { // Umhängen eines ANHÄNGSELS per Inheritance Ceremony öffnet das Equip-Fenster (W51a, Al 22.10.2026: Umhängen = auch „Equip/Attachment gained"; vorher „bleibt still")
      const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Energy Aura', 'Inheritance Ceremony'] : []), deckSize: 30 });
      t.script.push({ match: d => d.type === 'confirm' && !/Afflicted Pests/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Energy Aura', { hero: 0 });
      mit(t); t.reset();
      t.targetFn = (v, cfg) => {
        if (cfg && cfg.title === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (v.some(x => x.type === 'equip')) return v.filter(x => x.cardName === 'Energy Aura').map(x => x.id);
        return [v.find(x => x.type === 'hero' && x.heroIdx === 1).id];
      };
      const r = await t.play(me, 'Inheritance Ceremony', { hero: 0 });
      R.check('Inheritance Ceremony: Aura wurde auf Held 1 umgehängt', r === true && stuetz(t, me, 1).includes('Energy Aura') && !stuetz(t, me, 0).includes('Energy Aura'), { r, h0: stuetz(t, me, 0), h1: stuetz(t, me, 1) });
      R.check('Umhängen eines Anhängsels (Inheritance Ceremony, Energy Aura) öffnet das Equip-Fenster: Pests des Gegners löst aus', pestsAktiv(t), t.prompts.map(p => p.d.type)); }
    { // Slippery Fridge: Text „equip them to a different Hero" — das Umlegen öffnet (wie bisher) das Equip-Fenster
      const F = 'Slippery Fridge';
      const t = await H.fresh({ hand: me === 0 ? [['Club of Gobbo', F], []] : [[], ['Club of Gobbo', F]], gold: 500, ...(me ? { active: 1 } : {}) });
      await t.play(me, 'Club of Gobbo', { hero: 0, slot: 0 });
      mit(t); t.reset();
      const vorher = t.targetFn;
      t.targetFn = (valid, cfg) => { const ti = (cfg && cfg.title) || ''; if (ti === F) { const v = valid.find(x => x.cardName === 'Club of Gobbo'); return v ? [v.id] : undefined; } if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(x => x.type === 'hero' && x.heroIdx === 1); return v ? [v.id] : undefined; } return vorher(valid, cfg); };
      await t.play(me, F);
      R.check('Slippery Fridge („equip them to a different Hero"): Pests öffnet wie bisher', pestsAktiv(t), t.prompts.map(p => [p.d.type, (p.d.message || '').slice(0, 60)])); }

    // Petrification Break (betäubter Held); Divine Awakening/Anti Magic Enchantment sind im Harness nicht spielbar (Stufe 4 / Reaktion) – sie nutzen denselben Anlege-Baustein (`_attachment-shared`)
    { const t = await H.fresh({ hand: me === 0 ? [['Petrification Break'], []] : [[], ['Petrification Break']], gold: 500, ...(me ? { active: 1 } : {}) });
      mit(t); t.heroStatus(me, 0, 'stunned');
      const r = await t.play(me, 'Petrification Break', { hero: 0 });
      R.check('Petrification Break (betäubter Held): angelegt', r === true && t.inst(c => c.name === 'Petrification Break' && c.zone === 'support').length === 1, r);
      R.check('Petrification Break: Afflicted Pests öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type)); }
  }

  // (e) Modnir (Coolness Stack) — Ausrüsten aus dem Coolness Stack
  for (const [me, op] of [[0, 1], [1, 0]]) {
    const t = await H.fresh({ gold: [500, 500], ...(me ? { active: 1 } : {}) });
    t.putSurprise(op, 0, PESTS); t.grantFor(op, 0, PESTS); t.put(op, 0, 0, H.INERT.creature);
    const inst = t.put(me, 0, 0, 'Modnir, Hammer of Coolness');
    await t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: inst, cardName: inst.name, toZone: 'support', toOwner: me, toHeroIdx: 0, fromZone: 'coolnessStack' }));
    R.check('Sitz ' + me + ': Modnir aus dem Coolness Stack ausgerüstet (Enter-Ereignis): Pests öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
