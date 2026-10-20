'use strict';
// W28a · Audit „you control = aktuelle Kontrolle (Kontrolleur), nie Besitzer" · Al, 21.10.2026: „'you control' bezieht sich IMMER auf aktuelle Kontrolle, also Kontrolleur und nicht Besitzer."
// Weitere Karten aus dem Audit (`scripts/audit-you-control.js`):
//   Experimental Potion („Choose a target you control" — Helden wie Kreaturen nach Kontrolle), Sticky Wand („Choose a Hero you control and immediately have it use an Attachment …"),
//   Cool Repair („… equip it to a Hero you control"), Divine Gift of Sacrifice („Choose another Hero you control" als Empfänger), Overcharge / Initiation Ritual / Open Invitation / Idej Projector
//   (ein an den Gegner abgegebener eigener Held ist kein Wirt/Ziel) und die Ausrüst-Zielliste der Effekt-Ausrüster (`equipDestinations`, Lolek & Co.).
// Regel: es zählen die Helden, die der Spieler GERADE KONTROLLIERT: abgegeben (dauerhaft/gecharmt) NEIN, übernommen JA (wo die Karte die Brettseite des Helden tragen kann; sonst gemeldet).
// Aufruf: node docs/niche-tests/repro/W28/a-05-weitere-you-control-sammler-nach-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ZUSTAENDE = ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer', 'uebernommen-dauerhaft', 'uebernommen-temporaer'];
const adr = (valid) => valid.filter(v => v.type === 'hero').map(v => `${v.owner}:${v.heroIdx}`).sort();
const gleich = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());
const EIGENE = ['0:0', '0:1', '0:2'];
const soll = (z, fremd) => z === 'normal' ? EIGENE : z.startsWith('abgegeben') ? ['0:1', '0:2'] : (fremd ? EIGENE.concat('1:0') : EIGENE);

async function aufbau(opts, z) {
  const t = await H.fresh({ deckSize: 30, ...opts });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of the Forgotten', 800); t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  return t;
}
async function kontrolle(t, z) {
  if (z === 'abgegeben-dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (z === 'abgegeben-temporaer') { await t.engine.actionStealHero(1, 0, 0); await sleep(250); }
  if (z === 'uebernommen-dauerhaft') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  if (z === 'uebernommen-temporaer') { await t.engine.actionStealHero(0, 1, 0); await sleep(250); }
}

(async () => {
  const R = H.runner();

  // ── Experimental Potion ─────────────────────────────────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Experimental Potion · ${z}`);
    const t = await aufbau({ hand: [['Experimental Potion'], []] }, z); await kontrolle(t, z);
    let angeboten = null;
    t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    const r = await t.play(0, 'Experimental Potion', { hero: 1 });
    const erw = z === 'uebernommen-temporaer' ? EIGENE : soll(z, true);   // temporär übernommen (Charme-Status) nimmt das Gift nicht an
    R.check(`Experimental Potion / ${z}: Helden ${erw.join(', ')}`, gleich(angeboten, erw), { angeboten, r });
    R.check(`Experimental Potion / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  { const t = await aufbau({ hand: [['Experimental Potion'], []] }, 'uebernommen-dauerhaft'); await kontrolle(t, 'uebernommen-dauerhaft');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Experimental Potion', { hero: 1 });
    R.check('Experimental Potion / übernommen: der Gegnerheld 1:0 ist vergiftet und trägt die Marke, der eigene 0:0 nicht', !!t.hero(1, 0).statuses?.poisoned && t.hero(1, 0)._experimentalPotion === true && !t.hero(0, 0).statuses?.poisoned && !t.hero(0, 0)._experimentalPotion, { st: Object.keys(t.hero(1, 0).statuses || {}), flag: t.hero(1, 0)._experimentalPotion });
    R.check('Experimental Potion / übernommen: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  // ── Sticky Wand ─────────────────────────────────────────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Sticky Wand · ${z}`);
    const t = await aufbau({ hand: [['Sticky Wand', 'Light Ball'], []] }, z);
    for (const hi of [0, 1, 2]) t.grantFor(0, hi, 'Light Ball');
    t.grantFor(1, 0, 'Light Ball');
    await kontrolle(t, z);
    let angeboten = null;
    t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    const r = await t.play(0, 'Sticky Wand', { hero: 1 });
    R.check(`Sticky Wand / ${z}: Helden ${soll(z, true).join(', ')}`, gleich(angeboten, soll(z, true)), { angeboten, r });
    R.check(`Sticky Wand / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  for (const z of ['uebernommen-dauerhaft', 'uebernommen-temporaer']) {
    const t = await aufbau({ hand: [['Sticky Wand', 'Light Ball'], []] }, z);
    for (const hi of [0, 1, 2]) t.grantFor(0, hi, 'Light Ball');
    t.grantFor(1, 0, 'Light Ball');
    await kontrolle(t, z);
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
    t.script.push({ match: d => d && d.type === 'heroAction', answer: () => ({ cardName: 'Light Ball', handIndex: t.pile(0, 'hand').indexOf('Light Ball'), heroIdx: 0 }) });
    const r = await t.play(0, 'Sticky Wand', { hero: 1 });
    const lb = t.inst(i => i.name === 'Light Ball' && i.zone === 'support').map(i => `${i.owner}:${i.heroIdx}`);
    R.check(`Sticky Wand / ${z}: der übernommene Gegnerheld 1:0 wirkt Light Ball (liegt auf Brettseite 1), Hand leer`, lb.length === 1 && lb[0] === '1:0' && !t.pile(0, 'hand').includes('Light Ball') && !t.pile(0, 'hand').includes('Sticky Wand'), { lb, hand: t.pile(0, 'hand'), r });
    R.check(`Sticky Wand / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Cool Repair ─────────────────────────────────────────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Cool Repair · ${z}`);
    const t = await aufbau({ hand: [['Cool Repair'], []], discard: [['Phalanx Pike'], []] }, z); await kontrolle(t, z); t.setGold(0, 100);
    let angeboten = null;
    t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    const fremdOk = !!t.engine.darfFremdAusruesten?.(0, 1, 0);
    t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: 'Phalanx Pike' }) });
    const r = await t.play(0, 'Cool Repair', {});
    R.check(`Cool Repair / ${z}: Träger ${soll(z, fremdOk).join(', ')}`, gleich(angeboten, soll(z, fremdOk)), { angeboten, r, fremdOk });
    R.check(`Cool Repair / ${z}: nach Abbruch Karte auf der Hand, Gold unberührt`, t.pile(0, 'hand').includes('Cool Repair') && t.gs.players[0].gold === 100, { hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
    R.check(`Cool Repair / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  for (const z of ['uebernommen-dauerhaft']) {
    const t = await aufbau({ hand: [['Cool Repair'], []], discard: [['Phalanx Pike'], []] }, z); await kontrolle(t, z); t.setGold(0, 100);
    t.targetFn = (valid) => { const h = valid.find(v => v.owner === 1 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: 'Phalanx Pike' }) });
    const r = await t.play(0, 'Cool Repair', {});
    const eq = t.inst(i => i.name === 'Phalanx Pike' && i.zone === 'support');
    R.check(`Cool Repair / ${z}: Phalanx Pike liegt am übernommenen Helden 1:0 (Brettseite 1), die Karte gehört Sitz 0`, eq.length === 1 && eq[0].owner === 1 && eq[0].heroIdx === 0 && eq[0].originalOwner === 0, eq.map(i => [i.owner, i.heroIdx, i.originalOwner]));
    R.check(`Cool Repair / ${z}: halber Preis bezahlt, Ablage leer`, t.gs.players[0].gold < 100 && !t.pile(0, 'discardPile').includes('Phalanx Pike'), { gold: t.gs.players[0].gold, abl: t.pile(0, 'discardPile'), r });
    R.check(`Cool Repair / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Divine Gift of Sacrifice: Empfänger ("another Hero you control") ───────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Divine Gift of Sacrifice · ${z}`);
    const t = await aufbau({ hand: [['Divine Gift of Sacrifice'], []] }, z); await kontrolle(t, z);
    t.grantFor(0, 1, 'Divine Gift of Sacrifice');
    const prompts = [];
    t.targetFn = (valid) => {
      const heroes = adr(valid); prompts.push(heroes);
      if (prompts.length === 1) return [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2).id];   // Opfer: eigener Held 0:2
      return null;                                                                                                       // Empfänger: Abbruch nach dem Erfassen (Pflichtwahl ⇒ Fallback)
    };
    const r = await t.play(0, 'Divine Gift of Sacrifice', { hero: 1 });
    const erwEmpf = soll(z, true).filter(a => a !== '0:2');
    if (erwEmpf.length > 1) R.check(`Divine Gift of Sacrifice / ${z}: Empfänger ${erwEmpf.join(', ')} (ohne das Opfer 0:2)`, gleich(prompts[1], erwEmpf), { prompts, r });
    else R.check(`Divine Gift of Sacrifice / ${z}: genau ein Empfänger ${erwEmpf.join(', ')} ⇒ keine Wahl nötig, Max-HP +800 dort`, t.hero(+erwEmpf[0][0], +erwEmpf[0][2]).maxHp === 1600, { prompts, r, max: t.hero(+erwEmpf[0][0], +erwEmpf[0][2]).maxHp });
    R.check(`Divine Gift of Sacrifice / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  { const z = 'uebernommen-dauerhaft';
    const t = await aufbau({ hand: [['Divine Gift of Sacrifice'], []] }, z); await kontrolle(t, z);
    t.grantFor(0, 1, 'Divine Gift of Sacrifice');
    let n = 0;
    t.targetFn = (valid) => { n++; return n === 1 ? [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2).id] : [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
    const r = await t.play(0, 'Divine Gift of Sacrifice', { hero: 1 });
    R.check('Divine Gift of Sacrifice / übernommen: der übernommene Gegnerheld 1:0 bekommt +800 Max-HP (Brettseite 1), der eigene 0:0 nicht', t.hero(1, 0).maxHp === 1600 && t.hero(0, 0).maxHp === 800 && t.hp(0, 2) <= 0, { max10: t.hero(1, 0).maxHp, max00: t.hero(0, 0).maxHp, hp02: t.hp(0, 2), r });
    R.check('Divine Gift of Sacrifice / übernommen: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  // ── Abgegebener eigener Held ist kein Wirt/Ziel: Overcharge · Initiation Ritual · Open Invitation · Idej Projector ──────────────
  R.section('Overcharge / Initiation Ritual / Open Invitation / Idej Projector (abgegebener Held)');
  for (const z of ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer']) {
    const spielbar = z === 'normal';
    { // Overcharge: Ausrüstung auf Held 0:0, Aufwertung im Deck
      const cd = H.cardDB?.['Phalanx Pike'];
      const t = await aufbau({ hand: [['Overcharge'], []], deck: [['Lifeforce Howitzer', 'Cool Cheese', 'Warhorse', 'Future Tech Gun', 'Glass Sword', 'Smug Coin', ...Array(24).fill('Fireball')], Array(30).fill('Fireball')] }, z);
      t.put(0, 0, 0, 'Phalanx Pike');   // Ausrüstung am Helden 0:0
      await kontrolle(t, z);
      const sc = loadCardEffect('Overcharge');
      const ok = !!sc.spellPlayCondition(t.gs, 0, t.engine);
      if (spielbar) R.check('Overcharge / normal: mit Ausrüstung am Helden 0:0 und Aufwertung im Deck spielbar (Gegenprobe)', ok, ok);
      else R.check(`Overcharge / ${z}: die Ausrüstung hängt am abgegebenen Helden ⇒ kein Ziel, nicht spielbar`, !ok, ok);
    }
    { // Initiation Ritual: besiegter Held 0:0 + lebender Held 0:1 mit freier Zone
      const t = await aufbau({ hand: [['Initiation Ritual'], []] }, z); await kontrolle(t, z);
      t.gs.players[0].heroes[0].hp = 0; t.gs.players[0].heroes[0].diedOnTurn = 1;
      const sc = loadCardEffect('Initiation Ritual');
      const ok = !!sc.canActivate(t.gs, 0, t.engine);
      if (spielbar) R.check('Initiation Ritual / normal: besiegter Held 0:0 + lebender Träger ⇒ spielbar (Gegenprobe)', ok, ok);
      else R.check(`Initiation Ritual / ${z}: der besiegte Held 0:0 ist abgegeben (kein „Hero you control") ⇒ nicht spielbar`, !ok, ok);
    }
  }
  { // Idej Projector: einziger Idej-Held 0:0
    for (const z of ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer']) {
      const t = await aufbau({ hand: [['Idej Projector', 'Idej Projection'], []] }, z);
      t.setHero(0, 0, 'Idej Lord Daiyo', 800);
      await kontrolle(t, z);
      const sc = loadCardEffect('Idej Projector');
      const ok = !!sc.canActivate(t.gs, 0, t.engine);
      R.check(`Idej Projector / ${z}: ${z === 'normal' ? 'Idej-Held 0:0 ⇒ spielbar (Gegenprobe)' : 'der einzige Idej-Held ist abgegeben ⇒ nicht spielbar'}`, z === 'normal' ? ok : !ok, ok);
    }
  }
  { // Open Invitation: Ascended Hero auf der Hand, passender Wirt 0:0
    const t0 = await aufbau({}, 'normal');
    const e = t0.engine;
    let paar = null;
    for (const c of Object.values(e._getCardDB())) {
      if (c.cardType !== 'Ascended Hero' || e.isAscensionConditionUnskippable(c.name)) continue;
      for (const h of Object.values(e._getCardDB())) if (h.cardType === 'Hero' && e.getAscendedFormsFor(h.name).includes(c.name)) { paar = { asc: c.name, basis: h.name }; break; }
      if (paar) break;
    }
    R.note('Open Invitation: Paar', JSON.stringify(paar));
    for (const z of ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer']) {
      const t = await aufbau({ hand: [['Open Invitation', paar.asc], []] }, z);
      t.setHero(0, 0, paar.basis, 800);
      await kontrolle(t, z);
      const sc = loadCardEffect('Open Invitation');
      let ok; try { t.gs.activePlayer = 0; t.phase(2); ok = !!sc.canPlayWithHero(t.gs, 0, 0, null, t.engine); } catch (err) { ok = 'ERR ' + err.message; }
      R.check(`Open Invitation / ${z}: ${z === 'normal' ? 'passender Wirt 0:0 ⇒ spielbar (Gegenprobe)' : 'der einzige passende Wirt ist abgegeben ⇒ nicht spielbar'}`, z === 'normal' ? ok === true : ok === false, ok);
    }
  }

  // ── Effekt-Ausrüster: `equipDestinations` ("a Hero you control", z. B. Lolek) ─────────────────────────────
  R.section('equipDestinations (Lolek, Free-Artifact-Karten)');
  { const { equipDestinations } = require('../../../../cards/effects/_orchestra-shared.js');
    for (const z of ZUSTAENDE) {
      const t = await aufbau({}, z); await kontrolle(t, z);
      const ziele = equipDestinations(t.engine, 0, 'Phalanx Pike', { sides: [0] });
      const helden = [...new Set(ziele.map(d => `${d.side}:${d.heroIdx}`))].sort();
      const fremdOk = !!t.engine.darfFremdAusruesten?.(0, 1, 0);
      const erw = z === 'normal' ? EIGENE : z.startsWith('abgegeben') ? ['0:1', '0:2'] : (fremdOk ? EIGENE.concat('1:0') : EIGENE);
      R.check(`equipDestinations / ${z}: Träger ${erw.join(', ')}`, gleich(helden, erw), { helden, fremdOk });
    }
    { // Orchester-Form („Heroes on the board", mehrere Seiten) bleibt unverändert: der abgegebene Held bleibt dort Ziel
      const t = await aufbau({}, 'abgegeben-dauerhaft'); await kontrolle(t, 'abgegeben-dauerhaft');
      const ziele = equipDestinations(t.engine, 0, 'Phalanx Pike', { sides: [0, 1] });
      const helden = [...new Set(ziele.map(d => `${d.side}:${d.heroIdx}`))];
      R.check('equipDestinations / Orchester-Form (sides [0,1]): der abgegebene Held 0:0 bleibt Ziel („Heroes on the board")', helden.includes('0:0'), helden); } }

  // ── Zentrale Zielwahl „a target you control" (`side: 'my'`: Torchure, Maya, Pharaoh, Shield of Life, String of Fine, Ballad Harpyformer, Lolki …) ──────────
  R.section('promptDamageTarget / promptMultiTarget · side my');
  for (const z of ZUSTAENDE) {
    const t = await aufbau({}, z); await kontrolle(t, z);
    const inst = t.put(0, 2, 0, H.INERT.creature);
    for (const fn of ['promptDamageTarget', 'promptMultiTarget']) {
      let angeboten = null;
      t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
      t.policy.cancelTargets = true;
      const ctx = t.engine._createContext(inst, {});
      await t.run(() => ctx[fn]({ side: 'my', types: ['hero'], title: 'Test', damageType: 'status', dealsDamage: false, cancellable: true, minRequired: 1, maxTotal: 1 }));
      R.check(`${fn}(side my) / ${z}: Helden ${soll(z, true).join(', ')}`, gleich(angeboten, soll(z, true)), { angeboten });
    }
    R.check(`side my / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.finish();
})();
