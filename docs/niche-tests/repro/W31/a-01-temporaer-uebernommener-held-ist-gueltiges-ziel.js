'use strict';
// W31a · Frage 1 aus W28a (Angry Cheese) · Al, 22.10.2026: „Doch, auch temporäre Heroes sind mögliche Ziele, auch wenn der Schaden verpufft. Also korrekt as is."
// ALLGEMEINE REGEL: ein TEMPORÄR übernommener Gegnerheld (Charme Lv3: „unaffected by other cards and effects") ist ein gültiges Ziel bzw. Kostenziel für Karten mit „Hero/target you control";
//   dass die Wirkung am Helden verpufft (Schaden/Gift prallt ab), macht ihn NICHT zum ungültigen Ziel. Die Kosten gelten als bezahlt, der Rest der Karte läuft.
//   W28a hatte den Charme-Gegnerhelden bei Torchure, The Yeeting, Mana Absorbing Crystal, Experimental Potion und Sickly Cheese ausgeschlossen („nimmt Gift/Schaden nicht an") – zurückgenommen.
// AUSNAHME (Ruling W7b/F03-12, Al 14.10.: „Giftimmun macht ein Ziel ineligible"): Sickly Cheese bleibt bei ECHTER Giftimmunität (`negative_status_immune`-Buff, Immunitäts-Anhängsel, Light Ball,
//   Johanna …) gesperrt (`ineligible`). Der bloße Charme-Schutz zählt dafür NICHT (Entscheidung W31a: die allgemeinere Regel von heute gewinnt; kein Konflikt mit W7b, das echte Immunität meint).
// Aufbau: Sitz 0 am Zug mit drei Helden (0:0/0:1/0:2), Sitz 1 mit 1:0; Sitz 0 übernimmt 1:0 temporär (`actionStealHero` = Charme-Schutz) bzw. dauerhaft; die Karte wird gespielt und der Gegnerheld 1:0 gewählt.
// Aufruf: node docs/niche-tests/repro/W31/a-01-temporaer-uebernommener-held-ist-gueltiges-ziel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const D = H.INERT.creature;

async function aufbau(karte, z, o = {}) {
  const t = await H.fresh({ hand: [[karte, ...(o.hand || [])], []], deckSize: 30, deck: [o.deck || Array(30).fill('Fireball'), Array(30).fill('Fireball')] });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of Blackport', 800); t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  t.put(1, 2, 0, D);   // irgendeine Nicht-Helden-Karte auf dem Brett (The Yeeting)
  if (!o.keinGrant) for (const hi of [0, 1, 2]) t.grantFor(0, hi, karte);
  if (z === 'temporaer') { await t.engine.actionStealHero(0, 1, 0); await sleep(250); }
  if (z === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  return t;
}
const waehle10 = (t) => { t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0 && !v.ineligible); return [(h || valid.find(v => !v.ineligible) || valid[0]).id]; }; };
const deck30 = (spitze) => spitze.concat(Array(30 - spitze.length).fill('Fireball'));

(async () => {
  const R = H.runner();
  for (const z of ['temporaer', 'dauerhaft']) {
    const wirkt = z === 'dauerhaft';   // bei dauerhafter Übernahme wirkt alles am Helden; bei temporärer (Charme-Schutz) verpufft es

    R.section(`Torchure · ${z}`);
    { const t = await aufbau('Torchure', z); waehle10(t);
      const r = await t.play(0, 'Torchure', { hero: 1 });
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`Torchure / ${z}: der übernommene Gegnerheld 1:0 wird als Ziel angeboten`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`Torchure / ${z}: Karte gespielt (Kosten bezahlt: nicht mehr auf der Hand, in der Ablage)`, r === true && !t.pile(0, 'hand').includes('Torchure') && t.pile(0, 'discardPile').includes('Torchure'), { r, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
      R.check(`Torchure / ${z}: Gift ${wirkt ? 'liegt auf 1:0' : 'verpufft (Charme-Schutz)'}`, !!t.hero(1, 0).statuses?.poisoned === wirkt, Object.keys(t.hero(1, 0).statuses || {}));
      R.check(`Torchure / ${z}: der gleich indizierte eigene Held 0:0 bleibt gesund`, !t.hero(0, 0).statuses?.poisoned, null);
      R.check(`Torchure / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`The Yeeting · ${z}`);
    { const t = await aufbau('The Yeeting', z); waehle10(t);
      const r = await t.play(0, 'The Yeeting', { hero: 1 });
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`The Yeeting / ${z}: der übernommene Gegnerheld 1:0 wird als Ziel angeboten`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`The Yeeting / ${z}: Karte gespielt, Schaden ${wirkt ? 'trifft' : 'verpufft'} (HP 1:0 ${wirkt ? '650' : '800'})`, r === true && t.hp(1, 0) === (wirkt ? 650 : 800), { r, hp: t.hp(1, 0) });
      R.check(`The Yeeting / ${z}: die Brettkarte wurde trotzdem weggeschickt (Kosten bezahlt, Rest läuft)`, t.inst(c => c.name === D && c.zone === 'support').length === 0, t.inst(c => c.zone === 'support').map(c => c.name));
      R.check(`The Yeeting / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Mana Absorbing Crystal · ${z}`);
    { const t = await aufbau('Mana Absorbing Crystal', z, { keinGrant: true }); waehle10(t);
      t.phase(2);
      await t.run(() => t.engine.doHandActivate(0, 'Mana Absorbing Crystal', 0));
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`Mana Absorbing Crystal / ${z}: der übernommene Gegnerheld 1:0 wird als Ziel angeboten`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`Mana Absorbing Crystal / ${z}: 200 Selbstschaden ${wirkt ? 'treffen 1:0' : 'verpuffen (HP 800)'}`, t.hp(1, 0) === (wirkt ? 600 : 800), t.hp(1, 0));
      R.check(`Mana Absorbing Crystal / ${z}: Karte gelöscht (Kosten bezahlt)`, !t.pile(0, 'hand').includes('Mana Absorbing Crystal') && t.pile(0, 'deletedPile').includes('Mana Absorbing Crystal'), { hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
      R.check(`Mana Absorbing Crystal / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Experimental Potion · ${z}`);
    { const t = await aufbau('Experimental Potion', z, { keinGrant: true }); waehle10(t);
      const r = await t.play(0, 'Experimental Potion', { hero: 1 });
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`Experimental Potion / ${z}: der übernommene Gegnerheld 1:0 wird als Ziel angeboten`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`Experimental Potion / ${z}: Trank verbraucht, Gift ${wirkt ? 'liegt samt Dauermarke auf 1:0' : 'und Dauermarke verpuffen (Charme-Schutz)'}`,
        r === true && !t.pile(0, 'hand').includes('Experimental Potion') && !!t.hero(1, 0).statuses?.poisoned === wirkt && !!t.hero(1, 0)._experimentalPotion === wirkt,
        { r, st: Object.keys(t.hero(1, 0).statuses || {}), flag: t.hero(1, 0)._experimentalPotion });
      R.check(`Experimental Potion / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Sickly Cheese · ${z}`);
    { const t = await aufbau('Sickly Cheese', z, { keinGrant: true, deck: deck30(['Accusation']) });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Accusation' }) });
      waehle10(t);
      const r = await t.play(0, 'Sickly Cheese', { hero: 1 });
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`Sickly Cheese / ${z}: der übernommene Gegnerheld 1:0 ist wählbar (nur Charme-Schutz macht ihn NICHT ineligible)`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`Sickly Cheese / ${z}: Karte gespielt, Gift ${wirkt ? 'liegt auf 1:0' : 'verpufft'}, die Suche läuft trotzdem (Accusation auf der Hand)`,
        r === true && !!t.hero(1, 0).statuses?.poisoned === wirkt && t.pile(0, 'hand').includes('Accusation'), { r, st: Object.keys(t.hero(1, 0).statuses || {}), hand: t.pile(0, 'hand') });
      R.check(`Sickly Cheese / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Angry Cheese · ${z}`);
    { const t = await aufbau('Angry Cheese', z, { keinGrant: true, deck: deck30(['Fireball']) });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
      waehle10(t);
      const r = await t.play(0, 'Angry Cheese', { hero: 1 });
      const angeboten = t.targets.some(e => e.valid.some(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0));
      R.check(`Angry Cheese / ${z}: der übernommene Gegnerheld 1:0 wird als Kostenziel angeboten (korrekt as is)`, angeboten, t.targets.map(e => e.valid.map(v => v.id)));
      R.check(`Angry Cheese / ${z}: 100 Schaden ${wirkt ? 'treffen 1:0' : 'verpuffen (HP 800)'}, die Suche läuft (Fireball auf der Hand)`, r === true && t.hp(1, 0) === (wirkt ? 700 : 800) && t.pile(0, 'hand').includes('Fireball'), { r, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
      R.check(`Angry Cheese / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }

  // ── Sickly Cheese: ECHTE Giftimmunität macht ein Ziel weiter ineligible (Ruling W7b / F03-12) ──
  R.section('Sickly Cheese · echte Giftimmunität bleibt ineligible');
  for (const z of ['normal', 'temporaer', 'dauerhaft']) {
    const t = await aufbau('Sickly Cheese', z, { keinGrant: true, deck: deck30(['Accusation']) });
    // Wirt mit echter Immunität: der Buff `negative_status_immune` am Helden 1:0 (übernommen) bzw. 0:0 (normal)
    const [s, h] = z === 'normal' ? [0, 0] : [1, 0];
    t.hero(s, h).buffs = { ...(t.hero(s, h).buffs || {}), negative_status_immune: true };
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Accusation' }) });
    let liste = null;
    t.targetFn = (valid) => { if (!liste) liste = valid.map(v => ({ id: v.id, ineligible: !!v.ineligible })); const ok = valid.find(v => !v.ineligible); return ok ? [ok.id] : null; };
    await t.play(0, 'Sickly Cheese', { hero: 1 });
    const eintrag = (liste || []).find(v => v.id === `hero-${s}-${h}`);
    // Die Harness reicht der Zielwahl nur die WÄHLBAREN Ziele (`ineligible` ist ausgeblendet): der immune Held darf nicht darunter sein.
    R.check(`Sickly Cheese / ${z}: der echt giftimmune Held ${s}:${h} ist ineligible (nicht wählbar)`, !eintrag || eintrag.ineligible === true, liste);
    R.check(`Sickly Cheese / ${z}: ein nicht immuner Held bleibt wählbar`, (liste || []).some(v => !v.ineligible), liste);
    R.check(`Sickly Cheese / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
