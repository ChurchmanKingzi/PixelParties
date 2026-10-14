'use strict';
// W7-b/04 · Saint Nicolas / Santa Klaus (H03-heroes-14) und Sickly Cheese (F03-12) – Welle 7, Entscheidung Al 14.10.2026
//   Saint Nicolas / Santa Klaus: die Aktion ist gesperrt, solange der Gegner die Pflicht-Karten nicht annehmen kann (Hand-Sperre ODER Such-Sperre der Gegnerhand).
//   Sickly Cheese: ein giftimmuner Held (Buff `negative_status_immune` ODER Status `poison_immune`) ist kein wählbares Ziel; die Karte ist nur gesperrt, wenn es GAR KEIN wählbares Ziel gibt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];

  // ── Saint Nicolas / Santa Klaus ──
  for (const [held, hand, karten] of [['Saint Nicolas', ['Attack', 'Elixir of Quickness'], 1], ['Santa Klaus', ['Attack', 'Heal', 'Heal'], 2]]) {
    for (const [lbl, setze] of [['ohne Sperre', null], ['Gegner handLocked', (p) => { p.handLocked = true; }], ['Gegner searchLocked', (p) => { p.searchLocked = true; }]]) {
      const t = await H.fresh({ heroes: [[held, ...fill], null], hp: 600, hand: [hand, []], deck: [Array(20).fill('Heal'), Array(20).fill('Heal')] });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
      t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => ({ handIndex: d.eligibleIndices[d.eligibleIndices.length - 1] }) });
      if (setze) setze(t.gs.players[1]);
      const r = await t.play(0, 'Attack', { hero: 0 });
      const abgegeben = t.pile(1, 'hand').length;
      if (!setze) R.check(`${held} ${lbl}: Aktion läuft, ${karten} Karte(n) abgegeben`, r === true && abgegeben === karten, { r, abgegeben });
      else R.check(`${held}, ${lbl}: Aktion gesperrt (Attack bleibt auf der Hand, nichts abgegeben)`, r === false && abgegeben === 0 && t.pile(0, 'hand').length === hand.length, { r, abgegeben, hand0: t.pile(0, 'hand') });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
  }

  // ── Sickly Cheese ──
  const sc = H.loadCardEffect('Sickly Cheese');
  async function szene(setup) {
    const t = await H.fresh({ hand: [['Sickly Cheese'], []], deck: [['Accusation', 'Bird', 'Bird']], gold: 100 });
    setup(t);
    return t;
  }
  let t = await szene((t) => { t.hero(0, 0).statuses.poison_immune = {}; });
  let ziele = sc.getValidTargets(t.gs, 0, t.engine);
  R.check('Status poison_immune macht Held 0 zum ineligible Ziel (Held 1 und 2 wählbar)', ziele.find(z => z.heroIdx === 0).ineligible === true && !ziele.find(z => z.heroIdx === 1).ineligible && !ziele.find(z => z.heroIdx === 2).ineligible, ziele);
  R.check('… die Karte bleibt aktivierbar (es gibt wählbare Ziele)', sc.canActivate(t.gs, 0, t.engine) === true);
  t = await szene((t) => { for (let h = 0; h < 3; h++) t.hero(0, h).statuses.poison_immune = {}; });
  R.check('alle drei Helden poison_immune: Karte nicht aktivierbar', sc.canActivate(t.gs, 0, t.engine) === false);
  let r = await t.play(0, 'Sickly Cheese');
  R.check('… und nicht spielbar (Karte bleibt auf der Hand, Gold unverändert)', r === false && t.pile(0, 'hand').includes('Sickly Cheese') && t.gs.players[0].gold === 100, { r, gold: t.gs.players[0].gold });
  t = await szene((t) => { t.hero(0, 0).hp = 0; t.hero(0, 1).hp = 0; t.hero(0, 2).buffs = { negative_status_immune: { source: 'Test' } }; });
  R.check('einziger lebender Held giftimmun (zwei tot): Karte nicht aktivierbar', sc.canActivate(t.gs, 0, t.engine) === false);
  t = await szene(() => {});
  ziele = sc.getValidTargets(t.gs, 0, t.engine);
  R.check('Kontrolle ohne Immunität: alle drei wählbar, aktivierbar', ziele.length === 3 && ziele.every(z => !z.ineligible) && sc.canActivate(t.gs, 0, t.engine) === true, ziele);
  // Server-Tor: ein ineligible Ziel wird bei der Antwort abgewiesen (v915), Held 0 gewählt ⇒ funktioniert
  t = await szene((t) => { t.hero(0, 1).buffs = { negative_status_immune: { source: 'Test' } }; });
  t.targetFn = (v) => [v.find(x => x.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Sickly Cheese', answer: () => ({ cardName: 'Accusation', source: 'deck' }) });
  r = await t.play(0, 'Sickly Cheese');
  R.check('Held 1 giftimmun, Held 0 gewählt: gespielt, Held 0 vergiftet, Karte geholt', r === true && !!t.hero(0, 0).statuses.poisoned && t.pile(0, 'hand').includes('Accusation'), { r, hand: t.pile(0, 'hand') });
  // Angry Cheese bleibt unverändert (Selbstschaden 100 wird auch von Schilden geschluckt; kein Ineligible-Kriterium – Welle 7: nicht angefasst)
  const ac = H.loadCardEffect('Angry Cheese');
  t = await szene((t) => { t.hero(0, 0).buffs = { negative_status_immune: { source: 'Test' } }; });
  R.check('Angry Cheese: giftimmuner Held bleibt wählbar (Schaden ist keine Statuswirkung)', ac.getValidTargets(t.gs, 0).every(z => !z.ineligible));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
