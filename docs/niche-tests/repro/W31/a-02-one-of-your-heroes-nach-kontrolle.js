'use strict';
// W31a · Frage 2 aus W28a (Sacrifice to Divinity, Training und Ähnliche) · Al, 22.10.2026: „Ja, auch temporäre Heroes zählen, außer, sie sind durch die Kontrolle explizit immun gegen eigene Karten/Effekte."
// Regel: „one of your Heroes" / „your (other) Heroes" gilt nach aktueller KONTROLLE (nicht Besitz/Spalte):
//   • ein an den Gegner abgegebener eigener Held (dauerhaft ODER temporär) zählt NICHT;
//   • ein übernommener Gegnerheld (dauerhaft UND temporär) zählt — die Karte wirkt auf seiner Brettseite;
//   • AUSNAHME: ein temporär übernommener Held, der durch die Kontrolle ausdrücklich gegen die eigenen Karten/Effekte des Kontrolleurs immun ist (Charme Lv3 „unaffected by other cards and
//     effects"; Golden Apple/Sixth Circle „unaffected by YOUR other cards", `charmed.onlyFromController`), zählt nicht. Styx/FTCD/Molinda (`charmed.ohneSchutz`) schützen nicht → er zählt.
// Betroffene Karten (Wirte/Ziele): Sacrifice to Divinity, Resuscitation Potion („one of your defeated Heroes"), Alex (anderer Held), Siege, Weapon Collecting Wight, Modnir (Coolness Stack),
//   Ellie (Double Spell „with one of your Heroes"); Zählung „each of your Heroes": Slippery Whoolmoth; „last Hero you control": Quetzahuitl (eigener Abschnitt unten).
// Aufbau: Sitz 0 mit 0:0/0:1/0:2, Sitz 1 mit 1:0. Zustände: normal · abgegeben (dauerhaft/temporär: 0:0 gehört dem Gegner) · übernommen dauerhaft · übernommen temporär Charme (immun) ·
//   Golden-Apple-Marke (immun gegen die eigenen Karten) · ohne Schutz (Styx/FTCD). Erwartet wird die Liste der angebotenen Wirte.
// Aufruf: node docs/niche-tests/repro/W31/a-02-one-of-your-heroes-nach-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const D = H.INERT.creature;
const Q = 'Quetzahuitl, Receiver of Sacrifices';
const ZUSTAENDE = ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer', 'uebernommen-dauerhaft', 'uebernommen-charme', 'uebernommen-apple', 'uebernommen-ohneSchutz'];
const EIGENE = ['0:0', '0:1', '0:2'];
// Wirte bei „one of your Heroes" (ohne weitere Einschränkung der Karte)
const wirte = (z) => z === 'normal' ? EIGENE
  : z.startsWith('abgegeben') ? ['0:1', '0:2']
  : (z === 'uebernommen-dauerhaft' || z === 'uebernommen-ohneSchutz') ? EIGENE.concat('1:0')
  : EIGENE;   // Charme/Apple: immun gegen eigene Karten → zählt nicht
const ohne = (liste, ...x) => liste.filter(a => !x.includes(a));
const gleich = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());
const adr = (valid) => (valid || []).filter(v => v.type === 'hero').map(v => `${v.owner}:${v.heroIdx}`);

async function aufbau(opts, z, o = {}) {
  const t = await H.fresh({ deckSize: 30, ...opts });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of Blackport', 800); t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  if (o.vor) await o.vor(t);
  const nachher = o.nach;
  if (z === 'abgegeben-dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (z === 'abgegeben-temporaer') { t.engine.actionStealHero(1, 0, 0); await sleep(250); }
  if (z === 'uebernommen-dauerhaft') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  if (z.startsWith('uebernommen-') && z !== 'uebernommen-dauerhaft') {
    const hp = t.hero(1, 0).hp; if (hp <= 0) t.hero(1, 0).hp = 800;
    t.engine.actionStealHero(0, 1, 0); await sleep(250);
    if (z === 'uebernommen-apple') t.hero(1, 0).statuses.charmed.onlyFromController = true;
    if (z === 'uebernommen-ohneSchutz') t.hero(1, 0).statuses.charmed.ohneSchutz = true;
    if (hp <= 0) t.hero(1, 0).hp = 0;
  }
  if (nachher) await nachher(t);
  return t;
}

(async () => {
  const R = H.runner();

  // ── Sacrifice to Divinity ───────────────────────────────────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Sacrifice to Divinity · ${z}`);
    const t = await aufbau({ hand: [['Sacrifice to Divinity', 'Divinity'], []] }, z, { vor: (t) => { for (const hi of [0, 1, 2]) t.grantFor(0, hi, 'Sacrifice to Divinity'); t.put(0, 1, 0, D).turnPlayed = 1; } });
    let angeboten = null;
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { angeboten = d.eligibleHeroIdxs.map(i => `0:${i}`); return { heroIdx: d.eligibleHeroIdxs[d.eligibleHeroIdxs.length - 1] }; } });
    t.targetFn = (valid) => { angeboten = adr(valid); const f = valid.find(v => v.owner === 1) || valid[valid.length - 1]; return [f.id]; };
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 1 });
    const soll = wirte(z);
    R.check(`Sacrifice to Divinity / ${z}: Wirte ${soll.join(', ')}`, r === true && (soll.length === 1 || gleich(angeboten, soll)), { angeboten, r });
    // die Divinity liegt genau einmal beim gewählten Wirt (auf seiner Brettseite); bei Übernahme beim Gegnerhelden, Besitz der Karte beim Spieler
    const div = t.inst(c => c.name === 'Divinity' && c.zone === 'ability');
    R.check(`Sacrifice to Divinity / ${z}: genau eine Divinity liegt in Ability Zones`, div.length === 1, div.map(c => [c.owner, c.heroIdx]));
    if (soll.includes('1:0') && div.length === 1) R.check(`Sacrifice to Divinity / ${z}: Divinity auf der Brettseite 1 (Held 1:0), originalOwner = Sitz 0`, div[0].owner === 1 && div[0].heroIdx === 0 && div[0].originalOwner === 0, [div[0].owner, div[0].heroIdx, div[0].originalOwner]);
    if (z.startsWith('abgegeben') && div.length === 1) R.check(`Sacrifice to Divinity / ${z}: nie beim abgegebenen Helden 0:0`, !(div[0].owner === 0 && div[0].heroIdx === 0), [div[0].owner, div[0].heroIdx]);
    R.check(`Sacrifice to Divinity / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Resuscitation Potion: „one of your defeated Heroes" ─────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Resuscitation Potion · ${z}`);
    const t = await aufbau({ hand: [['Resuscitation Potion'], []] }, z, { nach: (t) => { t.hero(0, 0).hp = 0; t.hero(0, 2).hp = 0; t.hero(1, 0).hp = 0; } });
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, 'Resuscitation Potion', { hero: 1 });
    const soll = wirte(z).filter(a => a !== '0:1');   // 0:1 lebt
    R.check(`Resuscitation Potion / ${z}: besiegte Wirte ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten });
    R.check(`Resuscitation Potion / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  { // Wirkung am übernommenen Helden: Wiederbelebung auf SEINER Brettseite
    const t = await aufbau({ hand: [['Resuscitation Potion'], []] }, 'uebernommen-dauerhaft', { nach: (t) => { t.hero(1, 0).hp = 0; } });
    t.targetFn = (valid) => [valid.find(v => v.owner === 1).id];
    const r = await t.play(0, 'Resuscitation Potion', { hero: 1 });
    R.check('Resuscitation Potion / übernommen-dauerhaft: der besiegte Gegnerheld 1:0 lebt mit 50 HP, der gleich indizierte eigene 0:0 bleibt', r === true && t.hp(1, 0) === 50 && t.hp(0, 0) === 800, { r, hp10: t.hp(1, 0), hp00: t.hp(0, 0) });
    R.check('Resuscitation Potion / übernommen-dauerhaft: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  // ── Alex, Trainer of Heroes: Ability aus dem Deck an „one of your OTHER Heroes" ──────────────
  for (const z of ZUSTAENDE) {
    R.section(`Alex · ${z}`);
    const t = await aufbau({ hand: [['Leadership'], []], deck: [['Toughness', 'Toughness', 'Fighting', 'Fighting', ...Array(26).fill('Fireball')], undefined] }, z, { vor: (t) => { t.setHero(0, 1, 'Alex, Trainer of Heroes', 800); } });
    let angeboten = null;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Alex, Trainer of Heroes', answer: () => ({ cardName: 'Toughness' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { angeboten = d.eligibleHeroIdxs.map(i => `0:${i}`); return { heroIdx: d.eligibleHeroIdxs[d.eligibleHeroIdxs.length - 1] }; } });
    t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}) });
    t.targetFn = (valid) => { angeboten = adr(valid); const f = valid.find(v => v.owner === 1) || valid[valid.length - 1]; return [f.id]; };
    const r = await t.play(0, 'Leadership', { hero: 1, zoneSlot: 2 });
    const soll = ohne(wirte(z), '0:1');   // „other": Alex selbst (0:1) nicht
    R.check(`Alex / ${z}: andere Wirte ${soll.join(', ')}`, r === true && (soll.length === 1 || gleich(angeboten, soll)), { angeboten, r });
    const tough = t.inst(c => c.name === 'Toughness' && c.zone === 'ability');
    R.check(`Alex / ${z}: Toughness liegt genau einmal in einer Ability Zone und nicht bei Alex (0:1)`, tough.length === 1 && !(tough[0].owner === 0 && tough[0].heroIdx === 1), tough.map(c => [c.owner, c.heroIdx]));
    if (z.startsWith('abgegeben') && tough.length === 1) R.check(`Alex / ${z}: nie beim abgegebenen Helden 0:0`, !(tough[0].owner === 0 && tough[0].heroIdx === 0), [tough[0].owner, tough[0].heroIdx]);
    if (soll.includes('1:0') && tough.length === 1) R.check(`Alex / ${z}: bei Wahl des Gegnerhelden liegt sie auf Brettseite 1, originalOwner = Sitz 0`, tough[0].owner === 1 && tough[0].originalOwner === 0, [tough[0].owner, tough[0].originalOwner]);
    R.check(`Alex / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Siege („Attach this card to one of your Heroes"): Wirts-Vertrag `attachmentHosts` ────────
  for (const z of ZUSTAENDE) {
    R.section(`Siege · ${z}`);
    const t = await aufbau({ hand: [['Siege'], []] }, z);
    const siege = require('../../../../cards/effects/siege.js');
    const hosts = [...new Set(siege.attachmentHosts(t.gs, 0, t.engine).map(h => `${h.owner}:${h.heroIdx}`))];
    const soll = wirte(z);
    R.check(`Siege / ${z}: Wirte ${soll.join(', ')}`, gleich(hosts, soll), hosts);
    R.check(`Siege / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Weapon Collecting Wight („equip it to one of your Heroes") ───────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Weapon Collecting Wight · ${z}`);
    const t = await aufbau({ hand: [[], []], discard: [['Club of Gobbo'], []] }, z, { vor: (t) => { t.put(0, 1, 0, 'Weapon Collecting Wight').turnPlayed = 1; } });
    let angeboten = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Club of Gobbo' }) });
    t.targetFn = (valid) => { angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 1, 0);
    const soll = wirte(z);
    R.check(`Weapon Collecting Wight / ${z}: Wirte ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten });
    R.check(`Weapon Collecting Wight / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Modnir („equip it to one of your Heroes from there") ─────────────────────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Modnir · ${z}`);
    const t = await aufbau({ hand: [[], []] }, z);
    t.gs.players[0].coolnessStack.push('Modnir, Hammer of Coolness'); t.engine._trackCard('Modnir, Hammer of Coolness', 0, 'coolnessStack');
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = adr(valid); return null; };
    t.policy.cancelTargets = true;
    t.gs.activePlayer = 0; t.phase(3);
    await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
    const soll = wirte(z);
    R.check(`Modnir / ${z}: Wirte ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten });
    R.check(`Modnir / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Ellie, the Class President („Double Spell … with one of your Heroes") ────────────────────
  for (const z of ZUSTAENDE) {
    R.section(`Ellie · ${z}`);
    const t = await aufbau({ hand: [['Cell Escape'], []] }, z, { vor: (t) => { for (const s of [0, 1]) for (const hi of [0, 1, 2]) if (t.hero(s, hi)?.name) t.grantFor(s, hi, 'Cell Escape', 1); t.put(0, 1, 0, 'Ellie, the Class President').turnPlayed = 1; } });
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = adr(valid.filter(v => !v.ineligible)); return null; };
    t.policy.cancelTargets = true;
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 1, 0);
    const soll = wirte(z);
    R.check(`Ellie / ${z}: Helden ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten });
    R.check(`Ellie / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  { // Wirkung über einen dauerhaft übernommenen Gegnerhelden: der Double Spell läuft (Karte aus MEINER Hand), +1 Level
    const t = await aufbau({ hand: [['Cell Escape'], []] }, 'uebernommen-dauerhaft', { vor: (t) => { for (const hi of [0, 1, 2]) t.grantFor(0, hi, 'Cell Escape', 0); t.grantFor(1, 0, 'Cell Escape', 1); t.put(0, 1, 0, 'Ellie, the Class President').turnPlayed = 1; } });
    t.hero(0, 0).hp = 0; t.hero(0, 1).statuses = t.hero(0, 1).statuses || {}; t.hero(0, 2).hp = 0;
    t.targetFn = (valid) => [valid.find(v => v.owner === 1).id];
    t.script.push({ match: d => d && d.type === 'heroAction', answer: () => ({ cardName: 'Cell Escape', handIndex: t.pile(0, 'hand').indexOf('Cell Escape'), heroIdx: 0 }) });
    t.gs.activePlayer = 0; t.phase(2);
    const hand0 = t.pile(0, 'hand').length;
    await t.activateCreature(0, 1, 0);
    R.check('Ellie / übernommen-dauerhaft: der Double Spell wurde mit dem Gegnerhelden gewirkt (Karte aus der Hand von Sitz 0 weg)', !t.pile(0, 'hand').includes('Cell Escape') && t.pile(0, 'hand').length <= hand0, { hand: t.pile(0, 'hand') });
    R.check('Ellie / übernommen-dauerhaft: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  // ── Slippery Whoolmoth („each of your Heroes"): Stufe 0 in der Hand, wenn jeder kontrollierte Held eine Kreatur hat ─────────────
  {
    const stufe = (t) => t.engine.effectiveCardLevel(t.engine._getCardDB()['Slippery Whoolmoth'], 0, { handIdx: 0 });
    for (const [z, mitKreatur, erwartet, text] of [
      ['normal', ['0:0', '0:1', '0:2'], 0, 'jeder eigene Held hat eine Kreatur'],
      ['normal', ['0:1', '0:2'], 5, 'Held 0:0 ohne Kreatur'],
      ['abgegeben-dauerhaft', ['0:1', '0:2'], 0, 'der abgegebene Held 0:0 zählt nicht (hat keine Kreatur)'],
      ['abgegeben-temporaer', ['0:1', '0:2'], 0, 'der abgegebene Held 0:0 zählt nicht (hat keine Kreatur)'],
      ['uebernommen-dauerhaft', ['0:0', '0:1', '0:2'], 5, 'der übernommene Gegnerheld 1:0 zählt als „each of your Heroes" und hat keine Kreatur'],
      ['uebernommen-dauerhaft', ['0:0', '0:1', '0:2', '1:0'], 0, 'auch der übernommene Gegnerheld hat eine Kreatur'],
      ['uebernommen-charme', ['0:0', '0:1', '0:2'], 5, 'der temporär übernommene Held 1:0 zählt (Zählung, keine Wirkung auf ihn) und hat keine Kreatur'],
    ]) {
      const t = await aufbau({ hand: [['Slippery Whoolmoth'], []] }, z, { vor: (t) => { for (const a of mitKreatur) { const [s, h] = a.split(':').map(Number); t.put(s, h, 0, D); } } });
      R.check(`Slippery Whoolmoth / ${z} (${text}): Stufe in der Hand ${erwartet}`, stufe(t) === erwartet, stufe(t));
      R.check(`Slippery Whoolmoth / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ── Quetzahuitl („When the LAST Hero you control is defeated … delete all your Heroes …") ────
  {
    const szene = async () => {
      const t = await H.fresh({ hand: [[Q], []], deckSize: 30, deck: [['Divinity', 'Divinity', 'Divinity', ...Array(27).fill('Fireball')], undefined], active: 1 });
      t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of Blackport', 800); t.setHero(1, 0, 'Fern, the Ship Slave', 800);
      t.put(0, 0, 0, D); t.put(1, 0, 0, D);
      return t;
    };
    const toete = (t, s, h) => t.run(() => t.engine.actionDealDamage({ name: 'Killer', owner: 1, controller: 1 }, t.gs.players[s].heroes[h], 9999, 'other'));
    { const t = await szene(); t.hero(0, 1).hp = 0; t.hero(0, 2).hp = 0; await toete(t, 0, 0);
      R.check('Quetzahuitl / normal (Gegenprobe): letzter eigener Held fällt → Quetzahuitl zieht in seine Zone, drei Divinity', t.hero(0, 0).name === Q && t.pile(0, 'hand').indexOf(Q) < 0 && t.gs.players[0].abilityZones[0].flat().filter(n => n === 'Divinity').length === 3, [t.hero(0, 0).name, t.gs.players[0].abilityZones[0]]);
      R.check('Quetzahuitl / normal: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await szene(); await t.engine.actionTakeHeroPermanently(1, 0, 1); await sleep(250); t.hero(0, 2).hp = 0; await toete(t, 0, 0);
      R.check('Quetzahuitl / abgegebener eigener Held 0:1 (dauerhaft vom Gegner übernommen, lebt): 0:0 ist der LETZTE Held, den Sitz 0 kontrolliert → Quetzahuitl zieht ein', t.hero(0, 0).name === Q, [t.hero(0, 0).name, t.pile(0, 'hand')]);
      R.check('Quetzahuitl / der abgegebene Held 0:1 bleibt unberührt (lebt, gehört weiter dem Gegner, nicht gelöscht)', t.hero(0, 1).name === 'Kohta, the Silent Observer' && t.hp(0, 1) === 800 && t.hero(0, 1).permaControlBy === 1 && !t.gs.players[0].deletedPile.includes('Kohta, the Silent Observer'), { name: t.hero(0, 1).name, hp: t.hp(0, 1), pc: t.hero(0, 1).permaControlBy, del: t.gs.players[0].deletedPile });
      R.check('Quetzahuitl / abgegebener Held: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await szene(); await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); t.hero(0, 1).hp = 0; t.hero(0, 2).hp = 0; await toete(t, 0, 0);
      R.check('Quetzahuitl / Sitz 0 kontrolliert den lebenden Gegnerhelden 1:0 dauerhaft: der Fall von 0:0 ist NICHT der letzte kontrollierte Held → keine Ankunft, Quetzahuitl bleibt in der Hand', t.pile(0, 'hand').includes(Q) && t.hero(0, 0).name !== Q, [t.hero(0, 0).name, t.pile(0, 'hand')]);
      R.check('Quetzahuitl / übernommener lebender Held: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await szene(); await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); t.hero(0, 0).hp = 0; t.hero(0, 1).hp = 0; t.hero(0, 2).hp = 0; await toete(t, 1, 0);
      R.check('Quetzahuitl / der übernommene Gegnerheld 1:0 ist der letzte kontrollierte Held und fällt → Quetzahuitl zieht in eine Hero Zone der EIGENEN Spalte (0:0), drei Divinity', t.hero(0, 0).name === Q && t.gs.players[0].abilityZones[0].flat().filter(n => n === 'Divinity').length === 3, [t.hero(0, 0).name, t.gs.players[0].abilityZones[0]]);
      R.check('Quetzahuitl / „delete all your Heroes": der übernommene Held 1:0 ist gelöscht (Platz leer, Heldenkarte im Gelöscht-Stapel des Besitzers), die übrigen Helden von Sitz 1 unberührt', !t.hero(1, 0).name && t.gs.players[1].deletedPile.includes('Fern, the Ship Slave') && t.hp(1, 1) === 800 && t.hp(1, 2) === 800, { n: t.hero(1, 0).name, del1: t.gs.players[1].deletedPile });
      R.check('Quetzahuitl / übernommener Held als letzter: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
