'use strict';
// W34a · Punkt 0 · Al, 22.10.2026: Guardian Beast Hu nachziehen – „additional Action with any Hero you control" muss nach AKTUELLER KONTROLLE gehen.
// Kartentext Hu: „You may once per turn delete 5 cards total from both discard piles to immediately perform an additional Action with any Hero you control."
// REGEL: `performImmediateActionAnyHero` / `canPerformImmediateActionAnyHero` sammeln die Helden, die der Spieler GERADE KONTROLLIERT (`engine._zusatzaktionsHelden`):
//   eigene Spalte OHNE abgegebene Helden + übernommene Gegnerhelden (temporär [Steal] und dauerhaft [Paraseed]). Übernommene Helden bieten Hand-Karten (Attack/Spell/Kreatur) an –
//   der Prompt trägt sie als `fremdeHelden: { Karte: [{ heroOwner, heroIdx }] }`, die Antwort `{ …, heroIdx, heroOwner }`. Ein abgegebener eigener Held wird NICHT angeboten.
//   Dieselbe Sammlung speisen alle Nutzer des Helfers (Shamanic Curse, Lunar Eclipse, Off Duty, Dream Dust, The Master's Plan, Spider Dance, Loving Puppet Pavi,
//   Traveler from the Future, The Third Circle of Hell) – hier über den Helfer selbst geprüft.
// Aufruf: node docs/niche-tests/repro/W34/a-00-guardian-beast-hu-any-hero-nach-aktueller-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const F = H.INERT.filler, DUMMY = H.INERT.creature;
const HU = H.loadCardEffect('Guardian Beast Hu');

/** Szene: Halter h (am Zug), Hu auf Held 1 Slot 0, 5 Füllkarten in der eigenen Ablage; `hand` = Handkarten von h. */
async function aufbau(h, hand) {
  const o = 1 - h;
  const t = await H.fresh({ hand: h === 0 ? [hand, []] : [[], hand], discard: h === 0 ? [Array(5).fill(F), []] : [[], Array(5).fill(F)], deckSize: 20, active: h, hp: 800 });
  const hu = t.put(h, 1, 0, 'Guardian Beast Hu'); hu.turnPlayed = 1;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = d.cards.map((c, i) => i).slice(0, 5); return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  return { t, hu, o };
}
const kann = (t, hu) => !!HU.canActivateCreatureEffect(t.engine._createContext(hu, { event: 'canCreatureEffectCheck' }));
const geloescht = (t, h) => t.pile(h, 'deletedPile').length;
/** Antwort-Skript für den heroAction-Prompt: merkt den Prompt, antwortet mit `antwort(d)`; Hu wirkt Fireball auf Gegner-Held 1 (bzw. Held `ziel`). */
function spiele(t, o, antwort, ziel = 1) {
  const rec = { prompts: [] };
  t.script.push({ match: d => d && d.type === 'heroAction', answer: (d) => { rec.prompts.push(d); return antwort(d); } });
  t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === o && v.heroIdx === ziel); return [(x || valid[0]).id]; };
  return rec;
}
const fremd = (d, karte) => (d && d.fremdeHelden && d.fremdeHelden[karte]) || [];
const eigen = (d, karte) => (d && d.heroIndicesByCard && d.heroIndicesByCard[karte]) || [];

(async () => {
  const R = H.runner();
  for (const h of [0, 1]) {
    const o = 1 - h;

    R.section(`Halter Sitz ${h} · Gegenprobe: eigener Held (keine Übernahme)`);
    { const { t, hu } = await aufbau(h, ['Fireball']);
      t.grantFor(h, 0, 'Fireball'); t.gs.activePlayer = h; t.phase(2);
      R.check('Hu aktivierbar', kann(t, hu), null);
      const rec = spiele(t, o, (d) => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 0 }));
      const r = await t.activateCreature(h, 1, 0);
      const d = rec.prompts[0];
      R.check('Prompt bietet Fireball mit dem eigenen Helden 0 an, ohne fremde Helden', !!d && eigen(d, 'Fireball').includes(0) && fremd(d, 'Fireball').length === 0 && !d.fremdeHelden, { e: d && d.heroIndicesByCard, f: d && d.fremdeHelden });
      R.check('Fireball gewirkt (Gegner-Held 1 verliert HP), 5 Karten gelöscht', r === true && t.hp(o, 1) < 800 && geloescht(t, h) === 5, { hp: t.hp(o, 1), del: geloescht(t, h) });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · Gegnerheld übernommen – nur dieser kann Fireball`);
    for (const art of ['temporaer', 'dauerhaft']) {
      const { t, hu } = await aufbau(h, ['Fireball']);
      t.grantFor(o, 0, 'Fireball');                                 // nur der Gegnerheld 0 hat die Schule
      R.check(`${art}: VOR der Übernahme ist Hu nicht aktivierbar (kein eigener Held kann Fireball)`, !kann(t, hu), null);
      if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(h, o, 0)); else await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0));
      await sleep(250); t.gs.activePlayer = h; t.phase(2);
      R.check(`${art}: Hu ist aktivierbar (der übernommene Held zählt als „Hero you control")`, kann(t, hu), null);
      R.check(`${art}: canPerformImmediateActionAnyHero`, t.engine.canPerformImmediateActionAnyHero(h, { title: 'x' }) === true, null);
      const rec = spiele(t, o, (d) => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 0, heroOwner: o }));
      const r = await t.activateCreature(h, 1, 0);
      const d = rec.prompts[0];
      R.check(`${art}: Prompt bietet Fireball nur über den übernommenen Helden ${o}:0 an`, !!d && eigen(d, 'Fireball').length === 0 && fremd(d, 'Fireball').some(f => f.heroOwner === o && f.heroIdx === 0), { i: d && d.heroIndicesByCard, f: d && d.fremdeHelden });
      R.check(`${art}: Fireball gewirkt, Hu hat gespielt (5 Karten gelöscht), Karte in der Ablage von ${h}`, r === true && t.hp(o, 1) < 800 && geloescht(t, h) === 5 && !t.pile(h, 'hand').includes('Fireball'), { hp: t.hp(o, 1), del: geloescht(t, h), hand: t.pile(h, 'hand') });
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Halter Sitz ${h} · Gegnerheld NICHT übernommen`);
    { const { t, hu } = await aufbau(h, ['Fireball']);
      t.grantFor(o, 0, 'Fireball'); t.gs.activePlayer = h; t.phase(2);
      R.check('Gegnerheld kann Fireball, wird aber nicht kontrolliert → Hu nicht aktivierbar', !kann(t, hu), null);
      R.check('canPerformImmediateActionAnyHero verneint', t.engine.canPerformImmediateActionAnyHero(h, { title: 'x' }) === false, null);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · eigener Held abgegeben`);
    for (const art of ['temporaer', 'dauerhaft']) {
      // (a) nur der abgegebene Held kann Fireball → Hu nicht aktivierbar, nichts gelöscht
      { const { t, hu } = await aufbau(h, ['Fireball']);
        t.grantFor(h, 0, 'Fireball');
        R.check(`${art}: VOR der Abgabe ist Hu aktivierbar`, kann(t, hu), null);
        if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(o, h, 0)); else await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0));
        await sleep(250); t.gs.activePlayer = h; t.phase(2);
        R.check(`${art}: abgegebener Held ${h}:0 ist kein Aktionsträger → Hu nicht aktivierbar`, !kann(t, hu), null);
        R.check(`${art}: Hu wird bei Aktivierung nichts löschen`, (await t.activateCreature(h, 1, 0)) !== true || geloescht(t, h) === 0, { del: geloescht(t, h) });
        R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
      // (b) ein weiterer eigener Held kann es → der abgegebene Index wird nicht angeboten
      { const { t, hu } = await aufbau(h, ['Fireball']);
        t.grantFor(h, 0, 'Fireball'); t.grantFor(h, 2, 'Fireball');
        if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(o, h, 0)); else await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0));
        await sleep(250); t.gs.activePlayer = h; t.phase(2);
        const rec = spiele(t, o, (d) => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 2 }));
        const r = await t.activateCreature(h, 1, 0);
        const d = rec.prompts[0];
        R.check(`${art}: Prompt bietet Fireball nur über Held 2 an (abgegebener Held 0 fehlt)`, !!d && eigen(d, 'Fireball').join() === '2', { i: d && d.heroIndicesByCard });
        R.check(`${art}: Fireball gewirkt`, r === true && t.hp(o, 1) < 800, { hp: t.hp(o, 1) });
        R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    }

    R.section(`Halter Sitz ${h} · nicht angebotener Held wird abgelehnt`);
    { const { t, hu } = await aufbau(h, ['Fireball']);
      t.grantFor(o, 0, 'Fireball'); t.grantFor(h, 2, 'Fireball');
      await t.run(() => t.engine.actionStealHero(h, o, 1)); await sleep(250);   // übernommen wird Held 1 (der kann Fireball NICHT), Held 0 bleibt beim Gegner
      t.gs.activePlayer = h; t.phase(2);
      let n = 0;
      const rec = spiele(t, o, (d) => (++n === 1 ? { cardName: 'Fireball', handIndex: 0, heroIdx: 0, heroOwner: o } : { cancelled: true }));
      const r = await t.activateCreature(h, 1, 0);
      R.check('Antwort mit dem nicht kontrollierten Gegnerheld 0 wird abgelehnt (Prompt kommt erneut), Abbruch: nichts gewirkt, 5 Karten zurück', rec.prompts.length >= 2 && t.hp(o, 0) === 800 && t.hp(o, 1) === 800 && geloescht(t, h) === 0 && t.pile(h, 'hand').includes('Fireball'), { prompts: rec.prompts.length, del: geloescht(t, h), hand: t.pile(h, 'hand'), r });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · Kreatur über einen übernommenen Helden`);
    for (const art of ['temporaer', 'dauerhaft']) {
      const { t, hu } = await aufbau(h, [DUMMY]);
      if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(h, o, 0)); else await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0));
      await sleep(250); t.gs.activePlayer = h; t.phase(2);
      const rec = spiele(t, o, (d) => ({ cardName: DUMMY, handIndex: 0, heroIdx: 0, heroOwner: o, zoneSlot: 0 }));
      const r = await t.activateCreature(h, 1, 0);
      const d = rec.prompts[0];
      R.check(`${art}: Prompt bietet die Kreatur auch über den übernommenen Helden ${o}:0 an`, !!d && fremd(d, DUMMY).some(f => f.heroOwner === o && f.heroIdx === 0) && eigen(d, DUMMY).length >= 1, { i: d && d.heroIndicesByCard, f: d && d.fremdeHelden });
      const inst = t.engine.cardInstances.find(c => c.name === DUMMY && c.zone === 'support');
      R.check(`${art}: Kreatur steht in der Zone des übernommenen Helden (Brettseite ${o}, Held 0, Slot 0), Kontrolleur ${h}`, r === true && !!inst && inst.heroIdx === 0 && t.engine.physicalSide(inst) === o && (inst.controller ?? inst.owner) === h, { r, inst: inst && { hi: inst.heroIdx, slot: inst.zoneSlot, c: inst.controller, o: inst.owner } });
      R.check(`${art}: Karte nicht mehr auf der Hand, 5 Karten gelöscht`, !t.pile(h, 'hand').includes(DUMMY) && geloescht(t, h) === 5, { hand: t.pile(h, 'hand'), del: geloescht(t, h) });
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Halter Sitz ${h} · Helfer direkt (alle anderen Nutzer): Typ-/Namensfilter, abgegebener Held`);
    { // Spider-Dance-Muster: nur Kreaturen, Namensfilter
      const t = await H.fresh({ hand: h === 0 ? [[DUMMY], []] : [[], [DUMMY]], deckSize: 20, active: h });
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      for (const hi of [1, 2]) await t.run(() => t.engine.actionTakeHeroPermanently(o, h, hi)); await sleep(250);   // eigene Helden 1+2 abgegeben, eigener Held 0 bleibt, dazu der übernommene Gegnerheld 0
      const cfg = { title: 'Spider Dance', allowedCardTypes: ['Creature'], cardNameFilter: (n) => n === DUMMY, skipAbilities: true };
      R.check('canPerformImmediateActionAnyHero (Kreaturen-Filter) → ja', t.engine.canPerformImmediateActionAnyHero(h, cfg) === true, null);
      const rec = spiele(t, o, (d) => ({ cardName: DUMMY, handIndex: 0, heroIdx: 0, heroOwner: o, zoneSlot: 1 }));
      const res = await t.run(() => t.engine.performImmediateActionAnyHero(h, cfg));
      const inst = t.engine.cardInstances.find(c => c.name === DUMMY && c.zone === 'support');
      R.check('performImmediateActionAnyHero beschwört über den übernommenen Helden (Slot 1)', res && res.played === true && !!inst && inst.zoneSlot === 1 && t.engine.physicalSide(inst) === o, { res, inst: inst && { hi: inst.heroIdx, slot: inst.zoneSlot } });
      R.check('Prompt: eigene Helden nur Held 0 (1 und 2 sind abgegeben), dazu der übernommene Gegnerheld', rec.prompts.length >= 1 && eigen(rec.prompts[0], DUMMY).join() === '0' && fremd(rec.prompts[0], DUMMY).length === 1, { i: rec.prompts[0] && rec.prompts[0].heroIndicesByCard, f: rec.prompts[0] && rec.prompts[0].fremdeHelden });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
