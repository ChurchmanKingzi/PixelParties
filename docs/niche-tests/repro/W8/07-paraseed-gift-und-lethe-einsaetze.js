'use strict';
// W8/07 · Nachtrag 2 Welle 8 (Al, 15.10.2026):
//  • Paraseed (Frage 6): „Das Paraseed-Gift sollte ruhen, aber bei reaktivierter Paraseed sofort zurückkehren." Auch ein von der
//    Paraseed schon ÜBERNOMMENES Gift fällt, solange sie ruht, und liegt bei Reaktivierung wieder auf dem Wirt (nur über die
//    Hooks, ohne manuellen Abgleich). Ein von Anfang an fremdes Gift (Paraseed ruht schon, bevor sie es sehen konnte) bleibt.
//  • Lethe (Frage 7): „Ja" - ihre 3 Necromancy-Einsätze ruhen, wenn sie ruht (leichte Negation: Abilities laufen, Lethes Effekt nicht).
// Aufruf: node docs/niche-tests/repro/W8/07-paraseed-gift-und-lethe-einsaetze.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const LETHE = 'Lethe, the Forgetful Fixer';

(async () => {
  const R = H.runner();

  // ── Paraseed ───────────────────────────────────────────────────────────────────────────────
  { const t = await H.fresh({ hp: 800 });
    await t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, duration: 5 });          // fremdes Gift zuerst
    const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
    await t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: p, toZone: 'support', toHeroIdx: 0 }));
    await wait(100);
    R.check('Paraseed wirksam: Gift übernommen (unheilbar, Stempel)', !!t.hero(1, 0).statuses.poisoned?._paraseed, t.hero(1, 0).statuses.poisoned);
    await t.engine.applyCreatureStatus(p, 'frozen', { sourceOwner: 0, duration: 1 });
    await wait(100);
    R.check('Paraseed gefroren: das übernommene Gift ruht (fällt)', !t.hero(1, 0).statuses.poisoned, t.hero(1, 0).statuses);
    for (let i = 0; i < 4 && t.engine.isCreatureEffectSuppressed(p); i++) { await t.endTurn(); await wait(100); }
    R.check('Paraseed reaktiviert: Gift kehrt sofort zurück (ohne manuellen Abgleich)', !!t.hero(1, 0).statuses.poisoned?._paraseed, t.hero(1, 0).statuses);
    R.check('Paraseed: keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { // Negation statt Frost
    const t = await H.fresh({ hp: 800 });
    const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
    await t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: p, toZone: 'support', toHeroIdx: 0 }));
    await wait(100);
    R.check('Paraseed (Negation): Wirt vergiftet', !!t.hero(1, 0).statuses.poisoned);
    await t.engine.actionNegateCreature(p, 'Test'); await wait(100);
    R.check('Paraseed negiert: Gift ruht', !t.hero(1, 0).statuses.poisoned, t.hero(1, 0).statuses);
    // Die Negation endet (Entfernen über die echte Status-Entfernung, die den Hook feuert)
    await t.engine.removeCreatureStatus?.(p, 'negated', {}).catch?.(() => {});
    if (p.counters.negated) { delete p.counters.negated; await t.run(() => t.engine.runHooks('onStatusRemoved', { target: p, status: 'negated', statusName: 'negated' })); }
    await wait(100);
    R.check('Paraseed Negation vorbei: Gift kehrt zurück', !!t.hero(1, 0).statuses.poisoned, t.hero(1, 0).statuses);
    R.check('Paraseed (Negation): keine Engine-Fehler', t.errors.length === 0, t.errors); }

  // ── Lethe: 3 Necromancy-Einsätze ───────────────────────────────────────────────────────────
  for (const [name, set] of [[null, null], ['negiert (Effekt)', (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true })]]) {
    const t = await H.fresh({ heroes: [[LETHE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [[H.INERT.creature, H.INERT.creature, H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Necromancy', 'Necromancy', 'Necromancy'], [], []]);
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Necromancy', answer: (d) => ({ cardName: d.cards[0].name }) });
    t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const z = (d.zones || d.options || [])[0]; return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : {}; } });
    if (set) set(t);
    t.gs.activePlayer = 0; t.phase(2);
    const brett = () => t.gs.players[0].supportZones.flat().filter(z => z.length).length;
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    await wait(200);
    const nach1 = brett();
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    await wait(200);
    const nach2 = brett();
    R.check(`Lethe ${name || 'ohne Status'}: erster Einsatz beschwört`, nach1 === 1, nach1);
    R.check(`Lethe ${name || 'ohne Status'}: zweiter Einsatz ${name ? 'nicht möglich (3 Einsätze ruhen)' : 'möglich (3 Einsätze)'}`, name ? nach2 === 1 : nach2 === 2, { nach1, nach2 });
    R.check(`Lethe ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
