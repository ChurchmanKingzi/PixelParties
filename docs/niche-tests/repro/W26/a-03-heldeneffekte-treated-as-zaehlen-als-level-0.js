'use strict';
// W26a · Entscheidungen Al (21.10.2026, N2-08): (3) Flooding („chosen by an Attack or Spell") erfasst auch als Attack/Spell geltende Heldeneffekte (bestätigt);
// (4) Glass Wall („level 1 or lower …"): als Attack/Spell geltende Heldeneffekte OHNE Karte (Broghan, Brackle, Arthor, Kohta, Heragas, Alice) zählen als LEVEL 0.
// Gleiche Stufenregel für Test Flight („Attack or Spell whose level is lower than that Hero's Magic Arts level") und Future Tech Escape Device („… level equal to or lower than
// the number of … in your discard pile"). Gegenproben: ein gewöhnlicher Heldeneffekt (Siphem) hat keine Stufe und löst nichts aus; Anti Magic liest weiter nur Spells (Broghan = Attack).
// Aufruf: node docs/niche-tests/repro/W26/a-03-heldeneffekte-treated-as-zaehlen-als-level-0.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const HELDEN = {
  'Alice': 'Alice, the Puppeteer Girl', 'Broghan': 'Broghan, the Frozen Guardian of the North', 'Brackle': 'Brackle, the Catapulting Turtle',
  'Arthor': 'Arthor, Inheritor of the Barbarian Sword', 'Kohta': 'Kohta, Master of Super-Killing', 'Siphem': 'Siphem, the Deepsea Demon',
};
function wirker(t, me, held) {
  t.setHero(me, 0, HELDEN[held], 800);
  if (held === 'Alice') { for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; } }
  if (held === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
  if (held === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
}
async function zielen(t, me, op, held) {
  t.targetFn = (v) => {
    if (held === 'Brackle' && v.every(x => x.type === 'equip')) return [v[0].id];                 // Opferwahl
    const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0); return h ? [h.id] : undefined;
  };
  return t.activateHero(me, 0, held === 'Kohta' ? { phase: 3 } : {});   // Kohta: Aktionskosten, nur in der Aktionsphase
}
(async () => {
  const R = H.runner();
  // Einheit: der Helfer
  {
    const t = await H.fresh({});
    const e = t.engine;
    for (const [n, dt, soll] of [[HELDEN.Broghan, 'attack', 0], [HELDEN.Brackle, 'attack', 0], [HELDEN.Arthor, 'attack', 0], [HELDEN.Kohta, 'attack', 0],
      ['Heragas, the Monster Slayer', 'attack', 0], [HELDEN.Alice, 'destruction_spell', 0], [HELDEN.Broghan, 'destruction_spell', null], [HELDEN.Alice, 'attack', null],
      [HELDEN.Siphem, 'hero', null], [HELDEN.Siphem, 'attack', null], ['Fireball', 'attack', null]]) {
      R.check(`_heldenEffektStufe(${n}, ${dt}) = ${soll}`, e._heldenEffektStufe(n, dt) === soll, e._heldenEffektStufe(n, dt));
    }
  }
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Alice', 'Broghan', 'Brackle', 'Arthor', 'Kohta', 'Siphem']) {
      R.section(`Sitz ${me}: ${held}-Effekt gegen Sitz ${op}`);
      const treated = held !== 'Siphem';
      // Glass Wall (Level 1 or lower)
      { const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.putSurprise(op, 0, 'Glass Wall'); t.grantFor(op, 0, 'Glass Wall');
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        const hp0 = t.hp(op, 0);
        await zielen(t, me, op, held);
        R.check(`Glass Wall ${treated ? 'öffnet sich (Stufe 0)' : 'bleibt verdeckt'}`, (gefragt(t, 'Glass Wall') >= 1) === treated, gefragt(t, 'Glass Wall'));
        if (treated) R.check('Glass Wall negiert den Effekt (kein Schaden am Träger)', t.hp(op, 0) === hp0, { hp0, hp: t.hp(op, 0) });
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
      // Flooding (bestätigt)
      { const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.putSurprise(op, 0, 'Flooding'); t.grantFor(op, 0, 'Flooding');
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        await zielen(t, me, op, held);
        R.check(`Flooding ${treated ? 'öffnet sich' : 'bleibt verdeckt'}`, (gefragt(t, 'Flooding') >= 1) === treated, gefragt(t, 'Flooding'));
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
      // Test Flight: Gegner-Held hat Magic Arts 1 (Stufe 1 > 0)
      { const t = await H.fresh({ hand: me === 0 ? [[], ['Test Flight']] : [['Test Flight'], []], deckSize: 30 });
        t.grantFor(op, 0, 'Test Flight');
        t.script.push({ match: d => d.title === 'Test Flight', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        const hp0 = t.hp(op, 0);
        await zielen(t, me, op, held);
        const angeboten = gefragt(t, 'Test Flight') >= 1;
        R.check(`Test Flight ${treated ? 'wird angeboten' : 'wird nicht angeboten'} (Quelle Stufe 0 < Magic Arts 1)`, angeboten === treated, gefragt(t, 'Test Flight'));
        if (treated) R.check('Test Flight: Held bleibt unversehrt', t.hp(op, 0) === hp0, { hp0, hp: t.hp(op, 0) });
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
      // Future Tech Escape Device: 0 Kopien in der Ablage → Stufe 0 ≤ 0
      { const t = await H.fresh({ hand: me === 0 ? [[], ['Future Tech Escape Device']] : [['Future Tech Escape Device'], []], deckSize: 30 });
        t.script.push({ match: d => d.title === 'Future Tech Escape Device', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        await zielen(t, me, op, held);
        const angeboten = gefragt(t, 'Future Tech Escape Device') >= 1;
        R.check(`Future Tech Escape Device ${treated ? 'wird angeboten' : 'wird nicht angeboten'}`, angeboten === treated, gefragt(t, 'Future Tech Escape Device'));
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
