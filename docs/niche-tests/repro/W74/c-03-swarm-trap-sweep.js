'use strict';
// W74c-03 · Swarm-Trap-Sweep: bei WELCHEN Karten wird die Falle angeboten? Jede Karte (Artefakt, Trank, Spell, Attack, Ability) wird vom Gegner (Sitz 1) aus der Hand gespielt; Wahl: immer ein EIGENER Held.
// Zulässig sind nur Karten, die im Effekt (bzw. beim Anlegen) genau einen Helden als Ziel wählen. Die Liste wird mit ERWARTET verglichen – alles andere ist ein Fund.
const H = require('../../lib/h.js');
const fs = require('fs'), path = require('path');
const cards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../data/cards.json'), 'utf8'));
const TRAP = 'Flesh-Eating Swarm Trap';
const nurFilter = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const gelistet = [];

(async () => {
  const R = H.runner();
  R.section('Sweep: Falle wird angeboten bei …');
  let n = 0;
  for (const c of cards) {
    if (c.banned || c.name === TRAP || (nurFilter && !nurFilter.test(c.name))) continue;
    if (!['Spell', 'Attack', 'Artifact', 'Potion', 'Ability'].includes(c.cardType)) continue;
    n++;
    let angeboten = false, hp0, hp1, wahl = 0;
    try {
      const t = await H.fresh({ hand: [[TRAP, 'ZZ Filler'], [c.name]], gold: [50, 200], deck: [Array(12).fill('ZZ Filler'), Array(12).fill('ZZ Filler')] });
      t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
      t.put(1, 0, 0, 'ZZ Dummy'); t.put(0, 0, 0, 'ZZ Dummy');
      t.wahlen = [];
      t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid.find(v => v.type === 'hero' && v.owner === 1); if (h) t.wahlen.push(h.id); return h ? [h.id] : undefined; };
      hp0 = t.hp(1, 0);
      await Promise.race([t.play(1, c.name, { hero: 0 }), new Promise(r => setTimeout(r, 4000))]);
      wahl = t.wahlen.length;
      angeboten = t.prompts.some(p => p.d && p.d.type === 'confirm' && p.d.title === TRAP);
    } catch (e) { continue; }
    if (angeboten) {
      const art = (c.cardType === 'Ability' || /equip/i.test(c.subtype || '')) ? 'ANLEGEN' : (wahl === 1 ? 'WAHL1' : wahl === 0 ? 'OHNE-WAHL' : 'MEHR-WAHLEN');
      gelistet.push({ name: c.name, art, line: `${art} ${c.name} [${c.cardType}${c.subtype ? '/' + c.subtype : ''}] :: ${String(c.effect || '').slice(0, 110)}` });
    }
  }
  R.note(`Karten gespielt: ${n}, Falle angeboten bei ${gelistet.length}`);
  for (const art of ['OHNE-WAHL', 'MEHR-WAHLEN', 'WAHL1', 'ANLEGEN']) { R.note('── ' + art + ' ──'); for (const g of gelistet.filter(x => x.art === art)) R.note(g.line); }
  const ohne = gelistet.filter(x => x.art === 'OHNE-WAHL').map(x => x.name);
  R.check('keine Karte löst die Falle OHNE eigene Heldenwahl aus', ohne.length === 0, ohne);
  const mehr = gelistet.filter(x => x.art === 'MEHR-WAHLEN').map(x => x.name);
  R.check('Mehrfachwahlen nur bei Divine Gift of Sacrifice (Opfer = Kosten, Empfänger = Wirkung)', mehr.length === 1 && mehr[0] === 'Divine Gift of Sacrifice', mehr);
  R.check('Torchure (Kosten-Wahl) löst die Falle nicht aus', !gelistet.some(x => x.name === 'Torchure'));
  R.check('Angry Cheese / Sickly Cheese lösen die Falle nicht aus', !gelistet.some(x => /Cheese/.test(x.name)));
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
